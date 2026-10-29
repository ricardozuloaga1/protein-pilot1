import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { configuration } from "../src/config.js";
import { defaultProfile } from "../src/domain.js";
import { one, run } from "../src/db.js";
import { database } from "../src/db.js";
import { worker } from "../src/jobs.js";
import { syncMealOutbox, type ProteinPilotClient } from "../src/client.js";

test("expired magic links cannot be redeemed", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pilot-expiry-"));
  let link = "";
  const { app, db } = await buildApp({
    config: { ...configuration(), dataDir: dir },
    startWorker: false,
    mail: async (_e, url) => {
      link = url;
    },
  });
  t.after(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });
  await app.inject({
    method: "POST",
    url: "/v1/auth/request-link",
    payload: { email: "expired@example.com" },
  });
  run(db, "UPDATE auth_links SET expires_at=?", Date.now() - 1);
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/verify",
    payload: { token: new URL(link).hash.slice(7) },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(one(db, "SELECT count(*) n FROM users").n, 0);
});

test("restart fails interrupted analysis without replay; expired queued photo is removed", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pilot-restart-"));
  let db = database(dir);
  const uid = randomUUID();
  run(
    db,
    "INSERT INTO users(id,email,profile,created_at) VALUES(?,?,?,?)",
    uid,
    "restart@example.com",
    JSON.stringify(defaultProfile),
    Date.now(),
  );
  for (const [state, age] of [
    ["running", 0],
    ["queued", 2 * 86400_000],
  ] as const)
    run(
      db,
      "INSERT INTO jobs(id,user_id,state,image,metadata,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      randomUUID(),
      uid,
      state,
      Buffer.from("old-photo"),
      "{}",
      Date.now() - age,
      Date.now() - age,
    );
  db.close();
  db = database(dir);
  let calls = 0;
  const w = worker(db, {
    analyze: async () => {
      calls++;
      return { status: "no_food", name: "", foods: [], warnings: [] };
    },
    coach: async () => "",
  });
  t.after(async () => {
    await w.stop();
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  await w.tick();
  assert.equal(calls, 0);
  assert.equal(
    one(
      db,
      "SELECT count(*) n FROM jobs WHERE state='failed' AND image IS NULL",
    ).n,
    2,
  );
  assert.equal(
    one(db, "SELECT count(*) n FROM jobs WHERE error='worker_restarted'").n,
    1,
  );
});

test("offline sync retains failed entries and refuses cross-account uploads", async () => {
  const pending: any[] = [
    {
      requestId: "offline-request-001",
      userId: "alice",
      meal: { name: "Lunch" },
    },
  ];
  let stored = structuredClone(pending);
  let key = "";
  const storage = {
    load: async () => structuredClone(stored),
    save: async (rows: any[]) => {
      stored = structuredClone(rows);
    },
  };
  const client = {
    logMeal: async (_meal: any, requestId: string) => {
      key = requestId;
      throw new Error("Network lost after save");
    },
  } as unknown as ProteinPilotClient;
  await assert.rejects(syncMealOutbox(client, storage, "alice"));
  assert.equal(stored.length, 1);
  assert.equal(key, "offline-request-001");
  key = "";
  await assert.rejects(syncMealOutbox(client, storage, "bob"));
  assert.equal(key, "");
  assert.equal(stored.length, 1);
  const successful = {
    logMeal: async (_meal: any, requestId: string) => {
      assert.equal(requestId, "offline-request-001");
      return { id: "saved" };
    },
  } as unknown as ProteinPilotClient;
  await syncMealOutbox(successful, storage, "alice");
  assert.equal(stored.length, 0);
});
