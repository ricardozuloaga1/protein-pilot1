import { mkdir, writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildApp } from "../../src/app.js";
import { configuration } from "../../src/config.js";
import type { AI } from "../../src/ai.js";
export const fixtureVersion = "2026-10-28.1";
export class VirtualClock {
  constructor(public time = Date.parse("2026-10-26T12:00:00Z")) {}
  now = () => this.time;
  set(iso: string | number) {
    const n = typeof iso === "number" ? iso : Date.parse(iso);
    if (n < this.time) throw Error("Clock must advance");
    this.time = n;
  }
  advance(ms: number) {
    this.set(this.time + ms);
  }
}
export type Result = {
  scenario: string;
  checkpoint: string;
  status: "pass" | "fail" | "not implemented" | "not run";
  at: string;
  expected?: unknown;
  actual?: unknown;
  reason?: string;
  category?: string;
};
export class Report {
  results: Result[] = [];
  constructor(
    public seed: string,
    public clock: VirtualClock,
  ) {}
  check(
    scenario: string,
    checkpoint: string,
    actual: unknown,
    expected: unknown,
  ) {
    let status: Result["status"] = "pass";
    try {
      assert.deepEqual(actual, expected);
    } catch {
      status = "fail";
    }
    this.results.push({
      scenario,
      checkpoint,
      status,
      at: new Date(this.clock.now()).toISOString(),
      ...(status === "fail"
        ? { expected, actual, category: "software bug" }
        : {}),
    });
  }
  gap(
    scenario: string,
    checkpoint: string,
    status: "not implemented" | "not run",
    reason: string,
  ) {
    this.results.push({
      scenario,
      checkpoint,
      status,
      reason,
      at: new Date(this.clock.now()).toISOString(),
    });
  }
  async save(dir: string, extra: object = {}) {
    await mkdir(dir, { recursive: true });
    const normalized = this.results.map(({ at, ...r }) => r);
    const out = {
      fixtureVersion,
      seed: this.seed,
      generatedAt: new Date().toISOString(),
      ...extra,
      counts: this.results.reduce(
        (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
        {} as Record<string, number>,
      ),
      fingerprint: createHash("sha256")
        .update(JSON.stringify(normalized))
        .digest("hex"),
      results: this.results,
    };
    await writeFile(
      path.join(dir, "results.json"),
      JSON.stringify(out, null, 2),
    );
    await render(path.join(dir, "results.json"));
    return out;
  }
}
export async function render(file: string) {
  const r = JSON.parse(await readFile(file, "utf8"));
  const text = `# Protein Pilot evaluation\n\nFixture: ${r.fixtureVersion}; seed: ${r.seed}.\n\n${Object.entries(
    r.counts,
  )
    .map(([k, v]) => `- **${k}:** ${v}`)
    .join(
      "\n",
    )}\n\n${r.userDays ?? 0} simulated user-days. Deterministic fingerprint: \`${r.fingerprint}\`.\n\n## Findings and coverage gaps\n\n${r.results
    .filter((x: Result) => x.status !== "pass")
    .map(
      (x: Result) =>
        `### ${x.status}: ${x.scenario} / ${x.checkpoint}\n\n${x.reason || `Expected: ${JSON.stringify(x.expected)}\n\nActual: ${JSON.stringify(x.actual)}`}\n\nReplay: \`npm run eval:synthetic -- --seed ${r.seed} --scenario ${[...profiles.map((p) => p.id), "boundaries", "rate-limits"].includes(x.scenario) ? x.scenario : "all"}\`\n`,
    )
    .join(
      "\n",
    )}\n## Interpretation\n\nPasses describe the named checkpoints only. Missing capabilities and unexecuted tests are excluded from passes. Synthetic nutrients are arithmetic fixtures, not evidence of clinical accuracy. See EVALUATION.md for sources, live evaluation, simulator coverage and limitations.\n`;
  await writeFile(path.join(path.dirname(file), "REPORT.md"), text);
}
export const profileBase = {
  name: "Synthetic",
  timezone: "America/Caracas",
  goal: "maintain",
  weightKg: null,
  diet: "omnivore",
  allergies: [] as string[],
  exclusions: [] as string[],
  photoConsent: true,
};
export const profiles = [
  ["routine", "Maya", 90, "omnivore", "maintain", [], {}],
  [
    "strength",
    "Noah",
    140,
    "omnivore",
    "build_muscle",
    [],
    { training: "strength" },
  ],
  ["vegan", "Iris", 120, "vegan", "build_muscle", [], { training: "strength" }],
  ["vegetarian", "Leo", 100, "vegetarian", "maintain", [], {}],
  ["pescatarian", "Nina", 100, "pescatarian", "maintain", [], {}],
  [
    "endurance",
    "Eli",
    130,
    "omnivore",
    "feel_stronger",
    [],
    { training: "endurance" },
  ],
  ["older", "Rosa", 90, "omnivore", "maintain", [], { age: 72 }],
  ["allergies", "Omar", 100, "vegan", "maintain", ["soy", "peanut"], {}],
  [
    "restricted",
    "Ava",
    60,
    "omnivore",
    "maintain",
    [],
    { clinicianProteinLimit: 60 },
  ],
  ["pregnancy", "Lia", 90, "vegetarian", "maintain", [], { pregnancy: true }],
  [
    "shift",
    "Sam",
    100,
    "omnivore",
    "maintain",
    [],
    { timezone: "America/New_York" },
  ],
  ["offline", "Alex", 100, "omnivore", "maintain", [], {}],
].map(([id, name, target, diet, goal, allergies, extra]: any) => ({
  id,
  name,
  target,
  extra,
  profile: {
    ...profileBase,
    name,
    diet,
    goal,
    allergies,
    timezone: extra.timezone || profileBase.timezone,
  },
  email: `${id}@proteinpilot.test`,
}));
// Purpose-created label fixtures. Exact arithmetic, never claimed as measured real foods.
export const portion = (grams = 100) => ({
  name: "Synthetic reference portion",
  grams,
  per100g: { calories: 200, protein: 20, carbs: 20, fat: 4 },
  source: "user" as const,
});
export const referenceTotals = (grams: number) => ({
  calories: Math.round(grams * 2 * 10) / 10,
  protein: Math.round(grams * 0.2 * 10) / 10,
  carbs: Math.round(grams * 0.2 * 10) / 10,
  fat: Math.round(grams * 0.04 * 10) / 10,
});
export const makeMeal = (clock: VirtualClock, grams = 100) => ({
  name: "Reference meal",
  mealType: "lunch",
  loggedAt: new Date(clock.now() - 60000).toISOString(),
  foods: [portion(grams)],
  notes: "",
});
export const fixedAI: AI = {
  analyze: async () => ({
    status: "food",
    name: "Reference meal",
    foods: [portion()],
    warnings: ["Synthetic provider response; verify portion."],
  }),
  coach: async () =>
    "Optional idea: choose a meal matching your preferences. Check ingredients.",
};
export async function fixture(
  clock: VirtualClock,
  ai: AI = fixedAI,
  rateLimits = false,
) {
  process.env.NODE_ENV = "test";
  const dataDir = await mkdtemp(path.join(tmpdir(), "protein-pilot-eval-"));
  const mailbox = new Map<string, string>();
  const s = await buildApp({
    config: {
      ...configuration(),
      production: false,
      dataDir,
      apiKey: "",
      smtp: undefined,
    },
    ai,
    mail: async (e, l) => {
      mailbox.set(e, l);
    },
    evaluation: { clock, manualWorker: true, disableRateLimits: !rateLimits },
  });
  let sequence = 0;
  const raw = async (
    method: any,
    url: string,
    body?: any,
    token?: string,
    key?: string,
  ) =>
    s.app.inject({
      method,
      url,
      payload: body,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
    });
  const call = async (
    method: any,
    url: string,
    body?: any,
    token?: string,
    key?: string,
  ) => {
    const r = await raw(method, url, body, token, key);
    if (r.statusCode >= 400)
      throw Error(`${method} ${url}: ${r.statusCode} ${r.json().error?.code}`);
    return r.json();
  };
  const signin = async (email: string) => {
    await call("POST", "/v1/auth/request-link", { email });
    const token = new URL(mailbox.get(email)!).hash.slice(7);
    return call("POST", "/v1/auth/verify", { token });
  };
  const key = () => `evaluation-${++sequence}`;
  const upload = async (token: string, image: Buffer, k = key()) => {
    const boundary = "evaluation-photo-boundary";
    const r = await s.app.inject({
      method: "POST",
      url: `/v1/analysis?mealType=lunch&loggedAt=${encodeURIComponent(new Date(clock.now()).toISOString())}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": k,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="fixture.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
        ),
        image,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    return r;
  };
  return { ...s, clock, mailbox, raw, call, signin, key, upload, dataDir };
}
export function options() {
  const args = process.argv.slice(2);
  const get = (k: string, f: string) =>
    args.includes(k) ? args[args.indexOf(k) + 1] : f;
  return {
    seed: get("--seed", "pilot-v1"),
    scenario: get("--scenario", "all"),
    out: get("--out", "evaluation/latest"),
  };
}
