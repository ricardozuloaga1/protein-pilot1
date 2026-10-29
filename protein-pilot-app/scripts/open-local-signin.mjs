import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
// Only opens an existing local development preview. Never prints a token or bypasses verification.
const email = process.argv[2] || "simulator@proteinpilot.test";
const dir = fileURLToPath(
  new URL("../../protein-pilot-backend/data/mail/", import.meta.url),
);
const rows = [];
for (const name of await readdir(dir)) {
  if (!name.endsWith(".json")) continue;
  const file = path.join(dir, name);
  const row = JSON.parse(await readFile(file, "utf8"));
  const info = await stat(file);
  if (row.to === email && Date.now() - info.mtimeMs < 15 * 60000)
    rows.push({ ...row, modified: info.mtimeMs });
}
rows.sort((a, b) => b.modified - a.modified);
const token = rows[0]?.link.match(/#token=([A-Za-z0-9_-]{43})$/)?.[1];
if (!token) {
  console.error(
    "No recent local sign-in preview. Request a link in the app first.",
  );
  process.exit(1);
}
const result = spawnSync(
  "xcrun",
  [
    "simctl",
    "openurl",
    process.argv[3] || "booted",
    `exp://127.0.0.1:8081/--/auth#token=${token}`,
  ],
  { stdio: "pipe" },
);
if (result.status !== 0) {
  console.error("Could not open the sign-in link in the simulator.");
  process.exit(1);
}
console.log(
  "Opened the local sign-in link in iOS Simulator. No token printed.",
);
