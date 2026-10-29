import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import type { AIObservation } from "../../src/ai.js";
// Verified 2026-10-28: https://developers.openai.com/api/docs/pricing
// Reserve the entire 922k model input allowance at long-context rates, 5k output,
// plus 10% regional uplift. No tools, caching writes, or priority tier requested.
export const reservationUSD = 2.1;
export class Budget {
  entries: any[];
  private lock: number;
  constructor(public file: string) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.lock = openSync(file + ".lock", "wx", 0o600);
    try {
      this.entries = existsSync(file)
        ? JSON.parse(readFileSync(file, "utf8"))
        : [];
    } catch (e) {
      this.close();
      throw e;
    }
  }
  save() {
    writeFileSync(this.file + ".tmp", JSON.stringify(this.entries, null, 2), {
      mode: 0o600,
    });
    renameSync(this.file + ".tmp", this.file);
  }
  reserve(id: string, model: string) {
    if (model !== "gpt-6.1-terra") throw Error("Unpriced model");
    if (this.entries.length >= 60 || this.committed() + reservationUSD > 10)
      throw Error("Evaluation budget exhausted");
    const entry = {
      id,
      model,
      reservedUSD: reservationUSD,
      chargedUSD: reservationUSD,
      status: "usage unknown",
      at: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.save();
    return this.entries.length - 1;
  }
  settle(index: number, v: AIObservation) {
    const u: any = v.usage;
    if (
      !u ||
      !Number.isFinite(u.input_tokens) ||
      !Number.isFinite(u.output_tokens) ||
      u.input_tokens < 0 ||
      u.output_tokens < 0 ||
      !v.model.startsWith("gpt-6.1-terra") ||
      v.serviceTier !== "default"
    )
      return;
    const long = u.input_tokens > 272000;
    const raw =
      (u.input_tokens * (long ? 2 : 1) + u.output_tokens * (long ? 7.5 : 5)) /
      1e6;
    // Ignore cache discounts; include regional uplift as budget headroom.
    Object.assign(this.entries[index], {
      usage: u,
      responseId: v.responseId,
      returnedModel: v.model,
      serviceTier: v.serviceTier,
      usageCostUSD: raw,
      chargedUSD: raw * 1.1,
      status: "usage recorded",
    });
    this.save();
  }
  committed() {
    return this.entries.reduce((s, e) => s + e.chargedUSD, 0);
  }
  close() {
    if (this.lock !== undefined) {
      closeSync(this.lock);
      unlinkSync(this.file + ".lock");
    }
  }
}
