import { Budget } from "./budget.js";
import { guardedAI } from "./guarded-ai.js";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../src/app.js";
import { configuration } from "../../src/config.js";
import { systemClock } from "../../src/clock.js";
import { fixedAI } from "./core.js";
process.env.NODE_ENV = "test";
const resume = process.argv.includes("--resume");
const dataDir = resume
  ? JSON.parse(await readFile("evaluation/private/simulator.json", "utf8"))
      .dataDir
  : await mkdtemp(path.join(tmpdir(), "protein-pilot-simulator-eval-"));
if (
  !path
    .resolve(dataDir)
    .startsWith(path.join(tmpdir(), "protein-pilot-simulator-eval-"))
)
  throw Error("Refusing non-evaluation database");
await mkdir(path.join(dataDir, "mail"), { recursive: true });
const live = process.argv.includes("--live");
const config = configuration();
if (live && !config.apiKey) throw Error("Existing OpenAI key unavailable");
const budget = live
  ? new Budget(path.resolve("evaluation/private/budget.json"))
  : null;
const s = await buildApp({
  config: {
    ...configuration(),
    production: false,
    dataDir,
    port: 3101,
    host: "127.0.0.1",
    apiKey: "",
    smtp: undefined,
  },
  ai: budget ? guardedAI(config, budget) : fixedAI,
  mail: async (to, link) => {
    await writeFile(
      path.join(dataDir, "mail", randomUUID() + ".json"),
      JSON.stringify({ to, link }),
      { mode: 0o600 },
    );
  },
  evaluation: { clock: systemClock },
});
await mkdir("evaluation/private", { recursive: true });
await writeFile(
  "evaluation/private/simulator.json",
  JSON.stringify({
    dataDir,
    port: 3101,
    ai: live ? "budgeted live OpenAI" : "deterministic fixture",
    pid: process.pid,
  }),
  { mode: 0o600 },
);
await s.app.listen({ host: "127.0.0.1", port: 3101 });
console.log(
  `Isolated simulator API on 127.0.0.1:3101; ${live ? "budgeted live AI" : "deterministic AI fixture"}; no development database access.`,
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, async () => {
    await s.app.close();
    budget?.close();
    process.exit(0);
  });
