import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const state = JSON.parse(
  await readFile("evaluation/private/simulator.json", "utf8"),
);
const email = process.argv[2] || "ios-eval@proteinpilot.test";
const device = process.argv[3];
if (!device) throw Error("Explicit evaluation simulator UUID required");
if (!email.endsWith("@proteinpilot.test"))
  throw Error("Synthetic accounts only");
// Try newest preview by file mtime, without printing credentials.
const { stat } = await import("node:fs/promises");
const files = await Promise.all(
  (await readdir(path.join(state.dataDir, "mail"))).map(async (f) => ({
    f,
    mtime: (await stat(path.join(state.dataDir, "mail", f))).mtimeMs,
  })),
);
files.sort((a, b) => b.mtime - a.mtime);
for (const { f } of files) {
  const r = JSON.parse(
    await readFile(path.join(state.dataDir, "mail", f), "utf8"),
  );
  if (r.to !== email) continue;
  const token = new URL(r.link).hash;
  const result = spawnSync(
    "xcrun",
    ["simctl", "openurl", device, `exp://127.0.0.1:8082/--/auth${token}`],
    { stdio: "pipe" },
  );
  if (result.status !== 0) throw Error("Could not open local auth link");
  console.log("Opened synthetic sign-in link without printing token");
  break;
}
