import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../src/app.js";
import { configuration } from "../src/config.js";
import { defaultProfile } from "../src/domain.js";
import { one } from "../src/db.js";
// Fixture: Banana-Single.jpg by Evan-Amos, CC BY-SA 3.0.
// https://commons.wikimedia.org/wiki/File:Banana-Single.jpg
// Accept a local path, never a URL. Do not use a private photo for this smoke test.
if (!process.argv[2])
  throw new Error("Pass the local path to the licensed banana fixture.");
const dir = await mkdtemp(path.join(os.tmpdir(), "protein-pilot-live-"));
let link = "";
const s = await buildApp({
  config: {
    ...configuration(),
    production: false,
    dataDir: dir,
    smtp: undefined,
  },
  mail: async (_email, url) => {
    link = url;
  },
});
try {
  await s.app.inject({
    method: "POST",
    url: "/v1/auth/request-link",
    payload: { email: "live-test@example.com" },
  });
  const auth = await s.app.inject({
    method: "POST",
    url: "/v1/auth/verify",
    payload: { token: new URL(link).hash.slice(7) },
  });
  assert.equal(auth.statusCode, 200);
  const headers = { authorization: `Bearer ${auth.json().accessToken}` };
  await s.app.inject({
    method: "PUT",
    url: "/v1/me/profile",
    headers,
    payload: { ...defaultProfile, photoConsent: true },
  });
  const image = await readFile(process.argv[2]);
  const boundary = "ProteinPilotLiveBoundary";
  const upload = await s.app.inject({
    method: "POST",
    url:
      "/v1/analysis?mealType=snack&loggedAt=" +
      encodeURIComponent(new Date().toISOString()),
    headers: {
      ...headers,
      "idempotency-key": "live-food-photo-001",
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="banana.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      image,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(upload.statusCode, 202);
  await s.jobs!.tick();
  let job = (
    await s.app.inject({
      method: "GET",
      url: `/v1/analysis/${upload.json().id}`,
      headers,
    })
  ).json();
  const deadline = Date.now() + 70_000;
  while (["queued", "running"].includes(job.state) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    job = (
      await s.app.inject({
        method: "GET",
        url: `/v1/analysis/${job.id}`,
        headers,
      })
    ).json();
  }
  assert.equal(job.state, "succeeded", job.error);
  assert.equal(job.result.status, "food");
  assert.ok(job.result.foods.some((f: any) => /banana/i.test(f.name)));
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 0);
  const draft = (
    await s.app.inject({
      method: "GET",
      url: `/v1/drafts/${job.draftId}`,
      headers,
    })
  ).json();
  const edited = await s.app.inject({
    method: "PUT",
    url: `/v1/drafts/${draft.id}`,
    headers,
    payload: {
      ...draft,
      foods: draft.foods.map((f: any) => ({ ...f, grams: 120 })),
    },
  });
  assert.equal(edited.statusCode, 200);
  const confirm = {
    method: "POST" as const,
    url: `/v1/drafts/${draft.id}/confirm`,
    headers: { ...headers, "idempotency-key": "live-confirm-001" },
    payload: { version: edited.json().version, reviewed: true },
  };
  const saved = await s.app.inject(confirm);
  assert.equal(saved.statusCode, 200);
  const retried = await s.app.inject(confirm);
  assert.equal(saved.json().id, retried.json().id);
  assert.equal(one(s.db, "SELECT count(*) n FROM meals").n, 1);
  assert.equal(
    one(s.db, "SELECT image FROM jobs WHERE id=?", job.id).image,
    null,
  );
  console.log(
    JSON.stringify({
      status: "passed",
      model: s.config.model,
      foodIdentified: "banana",
      draftBeforeConfirmation: true,
      portionEdited: true,
      idempotentSave: true,
      imagePurged: true,
    }),
  );
} catch (error: any) {
  console.error(
    JSON.stringify({
      status: "failed",
      type: error.constructor.name,
      code: error.code || null,
      message:
        error instanceof assert.AssertionError
          ? error.message
          : "Live food flow failed.",
    }),
  );
  process.exitCode = 1;
} finally {
  await s.app.close();
  await rm(dir, { recursive: true, force: true });
}
