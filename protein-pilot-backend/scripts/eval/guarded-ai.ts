import { appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { openai, type AI } from "../../src/ai.js";
import type { Config } from "../../src/config.js";
import { Budget } from "./budget.js";
export function guardedAI(config: Config, budget: Budget): AI {
  mkdirSync("evaluation/onboarding", { recursive: true });
  function requestAI(kind: string, context?: any) {
    let reservation = -1;
    const started = performance.now();
    const id = `simulator-${kind}-${randomUUID()}`;
    return openai(config, {
      beforeRequest: () => {
        reservation = budget.reserve(id, config.model);
      },
      onResponse: (observation) => {
        budget.settle(reservation, observation);
        appendFileSync(
          "evaluation/onboarding/ai-observations.jsonl",
          JSON.stringify({
            id,
            ...observation,
            latencyMs: Math.round(performance.now() - started),
            ...(context ? { context } : {}),
          }) + "\n",
        );
      },
    });
  }
  return {
    analyze: (image, signal) => requestAI("image").analyze(image, signal),
    coach: (context, question, signal) =>
      requestAI("coach", context).coach(context, question, signal),
  };
}
