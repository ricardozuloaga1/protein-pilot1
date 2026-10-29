import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "./core.js";
const file = process.argv[2] || "evaluation/run-1/results.json";
const r = JSON.parse(await readFile(file, "utf8"));
if (r.userDays !== undefined) await render(file);
else {
  const rows = r.results
    .map(
      (x: any) =>
        `## ${x.scenario}\n\nStatus: ${x.status}; ${x.reviewStatus || x.reason || x.error || ""}\n\nExpected: ${x.expectation || "Reference not ready"}\n\n${x.actual?.text || "```json\n" + JSON.stringify(x.actual || null, null, 2) + "\n```"}\n`,
    )
    .join("\n");
  await writeFile(
    path.join(path.dirname(file), "REPORT.md"),
    `# Live evaluation — human review required\n\nModel: ${r.model}. Provider usage cost (published standard pricing, not an invoice): $${r.usageCostUSD.toFixed(6)}. Unknown-cost calls: ${r.unknownCostRequests}. Budget committed including headroom: $${r.budgetCommittedUSD.toFixed(6)}.\n\nExecuted responses are not semantic passes until reviewed. Eight negative-image checks can be evaluated exactly against no_food, empty foods and no draft. Coach outputs require human review.\n\n${rows}`,
  );
}
