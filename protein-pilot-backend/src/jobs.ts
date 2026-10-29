import { clockFor } from "./clock.js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import type { AI } from "./ai.js";
import { type DB, all, one, run } from "./db.js";
import { ApiError } from "./domain.js";
export function worker(db: DB, ai: AI, options: { manual?: boolean } = {}) {
  let stopping = false;
  let busy = false;
  let active: { id: string; controller: AbortController } | undefined;
  // A crash may have happened after provider billing. Do not silently charge twice.
  run(
    db,
    "UPDATE jobs SET state='failed',error='worker_restarted',image=NULL,updated_at=? WHERE state='running'",
    clockFor(db).now(),
  );
  const prune = () => {
    run(
      db,
      "UPDATE jobs SET image=NULL,state=CASE WHEN state='queued' THEN 'failed' ELSE state END,error=CASE WHEN state='queued' THEN 'photo_expired' ELSE error END WHERE image IS NOT NULL AND created_at<?",
      clockFor(db).now() - 86400_000,
    );
    run(
      db,
      "DELETE FROM meal_photos WHERE (meal_id IS NULL AND created_at<?) OR meal_id IN (SELECT id FROM meals WHERE deleted_at IS NOT NULL AND deleted_at<?)",
      clockFor(db).now() - 7 * 86400_000,
      clockFor(db).now() - 30_000,
    );
    run(db, "DELETE FROM auth_links WHERE expires_at<?", clockFor(db).now());
    run(db, "DELETE FROM sessions WHERE expires_at<?", clockFor(db).now());
    run(db, "DELETE FROM exports WHERE expires_at<?", clockFor(db).now());
  };
  async function tick() {
    if (busy || stopping) return;
    busy = true;
    try {
      prune();
      const job = db.transaction(() => {
        const row = one(
          db,
          "SELECT * FROM jobs WHERE state='queued' ORDER BY created_at LIMIT 1",
        );
        if (row)
          run(
            db,
            "UPDATE jobs SET state='running',updated_at=? WHERE id=?",
            clockFor(db).now(),
            row.id,
          );
        return row;
      })();
      if (!job) return;
      const controller = new AbortController();
      active = { id: job.id, controller };
      const timeout = setTimeout(() => controller.abort(), 65_000);
      try {
        const result = await ai.analyze(job.image, controller.signal);
        const thumbnail =
          result.status === "food"
            ? await sharp(job.image)
                .resize(256, 256, { fit: "cover" })
                .jpeg({ quality: 78 })
                .toBuffer()
            : null;
        db.transaction(() => {
          if (
            one(db, "SELECT state FROM jobs WHERE id=?", job.id)?.state !==
            "running"
          )
            return;
          const draftId = result.status === "food" ? randomUUID() : null;
          if (draftId) {
            const metadata = JSON.parse(job.metadata);
            const data = {
              ...metadata,
              name: result.name.slice(0, 120) || "Photo meal",
              foods: result.foods.map((f) => ({
                ...f,
                source: "photo_estimate",
              })),
              notes: "",
              warnings: result.warnings,
              requiresReview: true,
            };
            run(
              db,
              "INSERT INTO drafts(id,user_id,data,created_at) VALUES(?,?,?,?)",
              draftId,
              job.user_id,
              JSON.stringify(data),
              clockFor(db).now(),
            );
            run(
              db,
              "INSERT INTO meal_photos(draft_id,user_id,image,created_at) VALUES(?,?,?,?)",
              draftId,
              job.user_id,
              thumbnail,
              clockFor(db).now(),
            );
          }
          run(
            db,
            "UPDATE jobs SET state='succeeded',result=?,draft_id=?,image=NULL,updated_at=? WHERE id=?",
            JSON.stringify(result),
            draftId,
            clockFor(db).now(),
            job.id,
          );
        })();
      } catch (error) {
        const status = (error as { status?: number }).status;
        const code =
          error instanceof ApiError
            ? error.code
            : status === 429
              ? "provider_rate_limit"
              : status === 401
                ? "provider_configuration"
                : controller.signal.aborted
                  ? "analysis_timeout"
                  : "analysis_failed";
        run(
          db,
          "UPDATE jobs SET state='failed',error=?,image=NULL,updated_at=? WHERE id=? AND state='running'",
          code,
          clockFor(db).now(),
          job.id,
        );
      } finally {
        clearTimeout(timeout);
        active = undefined;
      }
    } finally {
      busy = false;
    }
  }
  const timer = options.manual
    ? undefined
    : setInterval(() => {
        void tick();
      }, 500);
  timer?.unref();
  const cleanupTimer = options.manual ? undefined : setInterval(prune, 60_000);
  cleanupTimer?.unref();
  return {
    tick,
    prune,
    cancel(jobId: string) {
      if (active?.id === jobId) active.controller.abort();
    },
    cancelUser(userId: string) {
      for (const j of all(db, "SELECT id FROM jobs WHERE user_id=?", userId))
        if (active && j.id === active.id) active.controller.abort();
    },
    async stop() {
      stopping = true;
      clearInterval(timer);
      clearInterval(cleanupTimer);
      active?.controller.abort();
      while (busy) await new Promise((r) => setTimeout(r, 10));
    },
  };
}
