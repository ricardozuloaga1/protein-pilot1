import { achievements } from "./achievements.js";
import { makePlan, planSignature, planningProfile } from "./planner.js";
import { estimateProtein } from "./protein.js";
import { clockFor, bindClock, type Clock } from "./clock.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ApiError,
  date,
  id,
  meal,
  profile,
  food,
  today,
  dayInZone,
  totals,
  fail,
} from "./domain.js";
import { configuration, type Config } from "./config.js";
import { database, all, one, run } from "./db.js";
import { registerAuth, mailer, hash, type Mailer } from "./auth.js";
import { openai, type AI } from "./ai.js";
import { worker } from "./jobs.js";
import {
  owned,
  decode,
  expectVersion,
  idempotent,
  saveMeal,
  summary,
  userProfile,
  reserveAI,
} from "./service.js";
import { recipes, foods, suitable, catalogNotice } from "./catalog.js";
const version = z.number().int().positive();
const paramsId = (req: { params: unknown }) =>
  z.object({ id }).parse(req.params).id;
const key = (req: { headers: Record<string, unknown> }) =>
  z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .parse(req.headers["idempotency-key"]);
export async function buildApp(
  options: {
    config?: Config;
    ai?: AI;
    mail?: Mailer;
    startWorker?: boolean;
    evaluation?: {
      clock: Clock;
      manualWorker?: boolean;
      disableRateLimits?: boolean;
    };
  } = {},
) {
  const config = options.config || configuration();
  if (
    options.evaluation &&
    (config.production || process.env.NODE_ENV !== "test")
  )
    throw new Error(
      "Evaluation controls require NODE_ENV=test and non-production configuration",
    );
  const db = database(config.dataDir);
  if (options.evaluation) bindClock(db, options.evaluation.clock);
  const ai = options.ai || openai(config);
  const app = Fastify({
    bodyLimit: 128 * 1024,
    logger: {
      level: "warn",
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: false,
  });
  await app.register(cors, {
    origin: config.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: () => options.evaluation?.disableRateLimits === true,
  });
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  });
  app.addHook("onSend", async (_req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
  });
  app.setErrorHandler((error: any, req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Check the highlighted fields.",
          fields: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        requestId: req.id,
      });
    if (error instanceof ApiError)
      return reply.code(error.status).send({
        error: { code: error.code, message: error.message },
        requestId: req.id,
      });
    const status =
      error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 500;
    // Never serialize provider errors, request bodies, email links or images to logs.
    if (status === 500)
      app.log.error(
        { requestId: req.id, errorType: error?.constructor?.name },
        "Request failed",
      );
    return reply.code(status).send({
      error: {
        code:
          status === 413
            ? "upload_too_large"
            : status === 429
              ? "rate_limited"
              : status === 500
                ? "internal_error"
                : "invalid_request",
        message:
          status === 500
            ? "The request could not be completed. Please retry."
            : "The request was rejected. Check its size, format, or retry later.",
      },
      requestId: req.id,
    });
  });
  registerAuth(app, db, config, options.mail || mailer(config));
  const jobs =
    options.startWorker === false
      ? null
      : worker(db, ai, { manual: options.evaluation?.manualWorker });
  app.addHook("onClose", async () => {
    await jobs?.stop();
    db.close();
  });
  app.get("/health", { config: { public: true } }, async () => ({
    status: "ok",
    version: "0.1.0",
  }));
  app.post("/v1/protein-preview", { config: { public: true } }, async (req) =>
    estimateProtein(req.body),
  );
  app.get("/v1/me", async (req) => {
    const row = one(db, "SELECT * FROM users WHERE id=?", req.identity.userId);
    return {
      id: row.id,
      email: row.email,
      profile: JSON.parse(row.profile),
      reminders: JSON.parse(row.reminders),
      photoPolicy: {
        images:
          "Analysis uploads are deleted after processing; queued uploads expire after 24 hours. A private thumbnail is kept with your meal. Unlogged thumbnails expire after seven days. Deleting a meal removes its thumbnail after the 30-second undo window.",
        provider: "OpenAI",
        providerStorage: false,
        notice:
          "OpenAI may retain abuse-monitoring data according to its API data policy. Photo estimates require your review.",
      },
    };
  });
  app.put("/v1/me/profile", async (req) => {
    let data = profile.parse(req.body);
    const uid = req.identity.userId;
    const previous = userProfile(db, uid);
    // Older clients editing diet must not accidentally erase calculation inputs.
    if (previous.proteinInputs && !data.proteinInputs)
      data = { ...data, proteinInputs: previous.proteinInputs };
    const guidance = data.proteinInputs
      ? estimateProtein({
          weightKg: data.weightKg,
          proteinInputs: data.proteinInputs,
        })
      : null;

    db.transaction(() => {
      run(
        db,
        "UPDATE users SET profile=? WHERE id=?",
        JSON.stringify(data),
        uid,
      );
      if (guidance) {
        const day = today(data.timezone, clockFor(db));
        run(
          db,
          "INSERT INTO target_guidance(user_id,day,data) VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET data=excluded.data",
          uid,
          day,
          JSON.stringify({
            ...guidance,
            inputs: { weightKg: data.weightKg, ...data.proteinInputs },
          }),
        );
      }
      if (previous.photoConsent && !data.photoConsent) {
        jobs?.cancelUser(uid);
        run(
          db,
          "UPDATE jobs SET state='cancelled',image=NULL,updated_at=? WHERE user_id=? AND state IN ('queued','running')",
          clockFor(db).now(),
          uid,
        );
      }
    })();
    return data;
  });
  app.put("/v1/me/target", async (req) => {
    if (userProfile(db, req.identity.userId).proteinInputs)
      fail(
        409,
        "profile_derived_target",
        "Update your profile to recalculate your protein target.",
      );

    const { protein } = z
      .object({ protein: z.number().min(20).max(400) })
      .parse(req.body);
    const uid = req.identity.userId;
    const day = today(userProfile(db, uid).timezone, clockFor(db));
    run(
      db,
      "INSERT INTO targets VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET protein=excluded.protein",
      uid,
      day,
      protein,
    );
    return {
      protein,
      effectiveFrom: day,
      notice: "Your chosen tracking target; not a medical recommendation.",
    };
  });
  app.put("/v1/me/reminders", async (req) => {
    const data = z
      .object({
        enabled: z.boolean(),
        times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(5),
      })
      .parse(req.body);
    run(
      db,
      "UPDATE users SET reminders=? WHERE id=?",
      JSON.stringify(data),
      req.identity.userId,
    );
    return {
      ...data,
      delivery: "client_local_notifications",
      requiresDevicePermission: true,
    };
  });
  app.get("/v1/days/:day", async (req) =>
    summary(db, req.identity.userId, date.parse((req.params as any).day)),
  );
  app.get("/v1/achievements", async (req) =>
    achievements(db, req.identity.userId),
  );
  app.get("/v1/progress", async (req) => {
    const { from, to } = z.object({ from: date, to: date }).parse(req.query);
    const days = (Date.parse(to) - Date.parse(from)) / 86400_000;
    if (days < 0 || days > 365)
      fail(400, "invalid_range", "Select a range of up to 366 days.");
    const entries = Array.from({ length: days + 1 }, (_, i) => {
      const s = summary(
        db,
        req.identity.userId,
        new Date(Date.parse(from) + i * 86400_000).toISOString().slice(0, 10),
      );
      return {
        day: s.day,
        totals: s.totals,
        proteinTarget: s.proteinTarget,
        targetReached: s.targetReached,
        coverage: s.coverage,
      };
    });
    return {
      days: entries,
      daysWithEntries: entries.filter((d) => d.totals !== null).length,
      daysAtTarget: entries.filter((d) => d.targetReached).length,
      quality: {
        score: null,
        explanation:
          "Photos cannot measure protein quality. Variety and food sources can provide context, but this app does not fabricate a quality score.",
      },
    };
  });
  app.post("/v1/meals", async (req, reply) => {
    const data = meal.parse(req.body);
    const result = idempotent(
      db,
      req.identity.userId,
      key(req),
      "create_meal",
      data,
      () => saveMeal(db, req.identity.userId, data),
    );
    return reply.code(201).send(result);
  });
  app.get("/v1/meals/:id", async (req) =>
    decode(owned(db, "meals", req.identity.userId, paramsId(req))),
  );
  app.get("/v1/meals/:id/photo", async (req, reply) => {
    const row = owned(db, "meals", req.identity.userId, paramsId(req));
    const photo = one(
      db,
      "SELECT image FROM meal_photos WHERE meal_id=? AND user_id=?",
      row.id,
      req.identity.userId,
    );
    if (row.deleted_at || !photo)
      fail(404, "not_found", "No meal photo available.");
    return reply
      .header("Cache-Control", "private, no-store")
      .type("image/jpeg")
      .send(photo.image);
  });
  app.delete("/v1/meals/:id/photo", async (req) => {
    const row = owned(db, "meals", req.identity.userId, paramsId(req));
    run(
      db,
      "DELETE FROM meal_photos WHERE meal_id=? AND user_id=?",
      row.id,
      req.identity.userId,
    );
    return { deleted: true };
  });
  app.patch("/v1/meals/:id", async (req) => {
    const data = meal.extend({ version }).parse(req.body);
    const uid = req.identity.userId;
    return db.transaction(() => {
      const row = owned(db, "meals", uid, paramsId(req));
      expectVersion(row, data.version);
      if (row.deleted_at)
        fail(409, "meal_deleted", "Restore the meal before editing it.");
      if (Date.parse(data.loggedAt) > clockFor(db).now() + 300_000)
        fail(422, "future_meal", "Use a plan for future meals.");
      const { version: _, ...value } = data;
      run(
        db,
        "UPDATE meals SET data=?,day=?,version=version+1 WHERE id=?",
        JSON.stringify({ ...value, totals: totals(value.foods) }),
        dayInZone(value.loggedAt, userProfile(db, uid).timezone),
        row.id,
      );
      return decode(owned(db, "meals", uid, row.id));
    })();
  });
  app.delete("/v1/meals/:id", async (req) => {
    const data = z.object({ version }).parse(req.body);
    const row = owned(db, "meals", req.identity.userId, paramsId(req));
    expectVersion(row, data.version);
    if (row.deleted_at)
      fail(409, "meal_deleted", "This meal is already removed.");
    run(
      db,
      "UPDATE meals SET deleted_at=?,version=version+1 WHERE id=?",
      clockFor(db).now(),
      row.id,
    );
    return {
      id: row.id,
      version: row.version + 1,
      undoUntil: clockFor(db).now() + 30_000,
    };
  });
  app.post("/v1/meals/:id/restore", async (req) => {
    const data = z.object({ version }).parse(req.body);
    const row = owned(db, "meals", req.identity.userId, paramsId(req));
    expectVersion(row, data.version);
    if (!row.deleted_at || row.deleted_at < clockFor(db).now() - 30_000)
      fail(
        409,
        "undo_expired",
        "The undo window has ended. You can log the meal again.",
      );
    run(
      db,
      "UPDATE meals SET deleted_at=NULL,version=version+1 WHERE id=?",
      row.id,
    );
    return decode(owned(db, "meals", req.identity.userId, row.id));
  });
  app.post("/v1/drafts", async (req, reply) => {
    const data = meal.parse(req.body);
    return reply.code(201).send(
      idempotent(
        db,
        req.identity.userId,
        key(req),
        "create_draft",
        data,
        () => {
          const did = randomUUID();
          run(
            db,
            "INSERT INTO drafts(id,user_id,data,created_at) VALUES(?,?,?,?)",
            did,
            req.identity.userId,
            JSON.stringify(data),
            clockFor(db).now(),
          );
          return decode(owned(db, "drafts", req.identity.userId, did));
        },
      ),
    );
  });
  app.get("/v1/drafts", async (req) => ({
    items: all(
      db,
      "SELECT * FROM drafts WHERE user_id=? AND meal_id IS NULL ORDER BY created_at DESC LIMIT 100",
      req.identity.userId,
    ).map(decode),
  }));
  app.get("/v1/drafts/:id", async (req) =>
    decode(owned(db, "drafts", req.identity.userId, paramsId(req))),
  );
  app.put("/v1/drafts/:id", async (req) => {
    const data = meal.extend({ version }).parse(req.body);
    const row = owned(db, "drafts", req.identity.userId, paramsId(req));
    expectVersion(row, data.version);
    if (row.meal_id)
      fail(409, "draft_consumed", "This draft was already logged.");
    const { version: _, ...value } = data;
    run(
      db,
      "UPDATE drafts SET data=?,version=version+1 WHERE id=?",
      JSON.stringify(value),
      row.id,
    );
    return decode(owned(db, "drafts", req.identity.userId, row.id));
  });
  app.post("/v1/drafts/:id/confirm", async (req) => {
    const data = z
      .object({ version, reviewed: z.literal(true) })
      .parse(req.body);
    const uid = req.identity.userId;
    const did = paramsId(req);
    return idempotent(db, uid, key(req), `confirm:${did}`, data, () => {
      const row = owned(db, "drafts", uid, did);
      if (row.meal_id) return decode(owned(db, "meals", uid, row.meal_id));
      expectVersion(row, data.version);
      const result = saveMeal(db, uid, meal.parse(JSON.parse(row.data)));
      run(
        db,
        "UPDATE drafts SET meal_id=?,version=version+1 WHERE id=?",
        result.id,
        did,
      );
      run(
        db,
        "UPDATE meal_photos SET meal_id=? WHERE draft_id=? AND user_id=?",
        result.id,
        did,
        uid,
      );
      return result;
    });
  });
  app.delete("/v1/drafts/:id", async (req) => {
    const { version: v } = z.object({ version }).parse(req.body);
    const row = owned(db, "drafts", req.identity.userId, paramsId(req));
    expectVersion(row, v);
    if (row.meal_id)
      fail(409, "draft_consumed", "Delete the logged meal instead.");
    db.transaction(() => {
      run(db, "UPDATE jobs SET draft_id=NULL WHERE draft_id=?", row.id);
      run(db, "DELETE FROM drafts WHERE id=?", row.id);
    })();
    return { deleted: true };
  });
  app.post(
    "/v1/analysis",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const uid = req.identity.userId;
      if (!userProfile(db, uid).photoConsent)
        fail(
          403,
          "photo_consent_required",
          "Enable photo analysis consent first.",
        );
      if (!config.apiKey && !options.ai)
        fail(
          503,
          "ai_unavailable",
          "Photo analysis is not configured. Log manually.",
        );
      const metadata = meal
        .pick({ mealType: true, loggedAt: true })
        .parse(req.query);
      const requestKey = key(req);
      const file = await req.file();
      if (!file) fail(400, "photo_required", "Choose a photo.");
      const bytes = await file.toBuffer();
      if (file.file.truncated)
        fail(413, "photo_too_large", "Choose a photo under 8 MB.");
      let image: Buffer;
      try {
        const decoder = sharp(bytes, {
          limitInputPixels: 40_000_000,
          failOn: "error",
        });
        const info = await decoder.metadata();
        if (
          !["jpeg", "png", "webp"].includes(info.format || "") ||
          (info.pages || 1) > 1
        )
          fail(415, "invalid_image", "Use a still JPEG, PNG or WebP photo.");
        image = await decoder
          .rotate()
          .resize({
            width: 1536,
            height: 1536,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch (error) {
        if (error instanceof ApiError) throw error;
        fail(415, "invalid_image", "This photo could not be read.");
      }
      const result = idempotent(
        db,
        uid,
        requestKey,
        "analysis",
        { metadata, imageHash: hash(bytes.toString("base64")) },
        () => {
          if (
            one(
              db,
              "SELECT count(*) AS n FROM jobs WHERE user_id=? AND state IN ('queued','running')",
              uid,
            ).n >= 2
          )
            fail(
              429,
              "analysis_busy",
              "Wait for your current photos to finish.",
            );
          reserveAI(db, uid, config.dailyLimit);
          const jid = randomUUID();
          const now = clockFor(db).now();
          run(
            db,
            "INSERT INTO jobs(id,user_id,state,image,mime,metadata,created_at,updated_at) VALUES(?,?,'queued',?,'image/jpeg',?,?,?)",
            jid,
            uid,
            image,
            JSON.stringify(metadata),
            now,
            now,
          );
          return { id: jid, state: "queued", pollUrl: `/v1/analysis/${jid}` };
        },
      );
      return reply.code(202).send(result);
    },
  );
  app.get("/v1/analysis/:id", async (req) => {
    const j = owned(db, "jobs", req.identity.userId, paramsId(req));
    return {
      id: j.id,
      state: j.state,
      draftId: j.draft_id,
      error: j.error,
      result: j.result ? JSON.parse(j.result) : null,
      updatedAt: j.updated_at,
    };
  });
  app.post("/v1/analysis/:id/cancel", async (req) => {
    const j = owned(db, "jobs", req.identity.userId, paramsId(req));
    if (["queued", "running"].includes(j.state)) {
      run(
        db,
        "UPDATE jobs SET state='cancelled',image=NULL,updated_at=? WHERE id=?",
        clockFor(db).now(),
        j.id,
      );
      jobs?.cancel(j.id);
      return { id: j.id, state: "cancelled" };
    }
    return { id: j.id, state: j.state, draftId: j.draft_id };
  });
  app.get("/v1/foods", async (req) => {
    const { q } = z
      .object({ q: z.string().max(100).default("") })
      .parse(req.query);
    return {
      items: foods.filter((f) =>
        f.name.toLowerCase().includes(q.toLowerCase()),
      ),
      notice: catalogNotice,
    };
  });
  app.get("/v1/favorites", async (req) => ({
    items: all(
      db,
      "SELECT * FROM favorites WHERE user_id=?",
      req.identity.userId,
    ).map(decode),
  }));
  app.post("/v1/favorites", async (req) => {
    const data = z
      .object({
        name: z.string().min(1).max(120),
        foods: z.array(food).min(1).max(40),
      })
      .parse(req.body);
    return idempotent(
      db,
      req.identity.userId,
      key(req),
      "favorite",
      data,
      () => {
        const fid = randomUUID();
        run(
          db,
          "INSERT INTO favorites VALUES(?,?,?)",
          fid,
          req.identity.userId,
          JSON.stringify(data),
        );
        return { id: fid, ...data };
      },
    );
  });
  app.delete("/v1/favorites/:id", async (req) => {
    const row = owned(db, "favorites", req.identity.userId, paramsId(req));
    run(db, "DELETE FROM favorites WHERE id=?", row.id);
    return { deleted: true };
  });
  app.get("/v1/recipes", async (req) => ({
    items: suitable(planningProfile(userProfile(db, req.identity.userId))).map(
      (r) => ({
        ...r,
        totals: totals(r.foods),
      }),
    ),
    notice: catalogNotice,
  }));
  app.get("/v1/recipes/:recipeId", async (req) => {
    const r = recipes.find((r) => r.id === (req.params as any).recipeId);
    if (!r) fail(404, "not_found", "Recipe not found.");
    return { ...r, totals: totals(r.foods), notice: catalogNotice };
  });
  app.post("/v1/plans", async (req) => {
    const data = z.object({ week: date }).parse(req.body);
    const uid = req.identity.userId;
    return idempotent(db, uid, key(req), "plan", data, () => {
      if (
        one(
          db,
          "SELECT id FROM plans WHERE user_id=? AND week<=? AND date(week,'+6 days')>=?",
          uid,
          new Date(Date.parse(data.week) + 6 * 86400000)
            .toISOString()
            .slice(0, 10),
          data.week,
        )
      )
        fail(
          409,
          "plan_exists",
          "A plan already covers part of this week. Rebuild that plan or choose a later starting date.",
        );
      const generated = makePlan(userProfile(db, uid), data.week);
      const pid = randomUUID();
      run(
        db,
        "INSERT INTO plans(id,user_id,week,data) VALUES(?,?,?,?)",
        pid,
        uid,
        data.week,
        JSON.stringify(generated),
      );
      return decode(owned(db, "plans", uid, pid));
    });
  });
  app.get("/v1/plans", async (req) => ({
    items: all(
      db,
      "SELECT * FROM plans WHERE user_id=? ORDER BY week DESC LIMIT 52",
      req.identity.userId,
    ).map((row) => {
      const plan = decode(row);
      return {
        ...plan,
        week: row.week,
        needsRebuild:
          plan.profileSignature !==
          planSignature(userProfile(db, req.identity.userId)),
      };
    }),
  }));
  app.post("/v1/plans/:id/regenerate", async (req) => {
    const data = z.object({ version }).parse(req.body);
    const uid = req.identity.userId;
    const pid = paramsId(req);
    return idempotent(
      db,
      uid,
      key(req),
      "regenerate-plan",
      { ...data, id: pid },
      () => {
        const row = owned(db, "plans", uid, pid);
        expectVersion(row, data.version);
        const generated = makePlan(userProfile(db, uid), row.week);
        run(
          db,
          "UPDATE plans SET data=?,version=version+1 WHERE id=?",
          JSON.stringify(generated),
          pid,
        );
        return decode(owned(db, "plans", uid, pid));
      },
    );
  });
  app.patch("/v1/plans/:id", async (req) => {
    const data = z
      .object({
        version,
        slots: z
          .array(
            z.object({
              day: date,
              mealType: meal.shape.mealType,
              recipeId: z.string().max(80),
            }),
          )
          .max(28),
      })
      .parse(req.body);
    const row = owned(db, "plans", req.identity.userId, paramsId(req));
    expectVersion(row, data.version);
    const allowed = suitable(userProfile(db, req.identity.userId));
    if (
      data.slots.some(
        (s) =>
          Date.parse(s.day) < Date.parse(row.week) ||
          Date.parse(s.day) > Date.parse(row.week) + 6 * 86400_000 ||
          !allowed.some((r) => r.id === s.recipeId),
      )
    )
      fail(
        422,
        "invalid_plan",
        "Choose recipes matching your preferences and dates within this plan.",
      );
    if (
      new Set(data.slots.map((s) => `${s.day}:${s.mealType}`)).size !==
      data.slots.length
    )
      fail(400, "duplicate_slot", "Use one recipe per meal slot.");
    const generated = makePlan(
      userProfile(db, req.identity.userId),
      row.week,
      data.slots,
    );
    run(
      db,
      "UPDATE plans SET data=?,version=version+1 WHERE id=?",
      JSON.stringify(generated),
      row.id,
    );
    return decode(owned(db, "plans", req.identity.userId, row.id));
  });
  app.get("/v1/coach/messages", async (req) => ({
    items: all(
      db,
      "SELECT id,role,text,created_at AS createdAt FROM messages WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
      req.identity.userId,
    ).reverse(),
  }));
  app.post(
    "/v1/coach/messages",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req) => {
      const { text } = z
        .object({ text: z.string().trim().min(1).max(2000) })
        .parse(req.body);
      const uid = req.identity.userId;
      if (!config.apiKey && !options.ai)
        fail(503, "ai_unavailable", "Coach is not configured.");
      reserveAI(db, uid, config.dailyLimit);
      const p = userProfile(db, uid);
      const { targetGuidance: privateGuidance, ...coachDay } = summary(
        db,
        uid,
        today(p.timezone, clockFor(db)),
      );
      const context = {
        profile: {
          name: p.name,
          goal: p.goal,
          diet: p.diet,
          allergies: p.allergies,
          exclusions: p.exclusions,
        },
        today: coachDay,
        recentMessages: all(
          db,
          "SELECT role,text FROM messages WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
          uid,
        ).reverse(),
      };
      let answer: string;
      try {
        answer = await ai.coach(context, text, AbortSignal.timeout(65_000));
      } catch {
        fail(
          503,
          "coach_unavailable",
          "The coach could not respond. Your message was not saved. Please retry.",
        );
      }
      const messageId = randomUUID();
      db.transaction(() => {
        if (!one(db, "SELECT id FROM users WHERE id=?", uid))
          fail(401, "account_deleted", "Account no longer exists.");
        run(
          db,
          "INSERT INTO messages VALUES(?,?,?,?,?)",
          randomUUID(),
          uid,
          "user",
          text,
          clockFor(db).now(),
        );
        run(
          db,
          "INSERT INTO messages VALUES(?,?,?,?,?)",
          messageId,
          uid,
          "assistant",
          answer,
          clockFor(db).now() + 1,
        );
      })();
      return { id: messageId, role: "assistant", text: answer };
    },
  );
  app.post("/v1/support", async (req, reply) => {
    const { text } = z
      .object({ text: z.string().trim().min(10).max(5000) })
      .parse(req.body);
    const result = idempotent(
      db,
      req.identity.userId,
      key(req),
      "support",
      { text },
      () => {
        const sid = randomUUID();
        run(
          db,
          "INSERT INTO support VALUES(?,?,?,?)",
          sid,
          req.identity.userId,
          text,
          clockFor(db).now(),
        );
        return { id: sid, status: "recorded", delivery: "local_support_queue" };
      },
    );
    return reply.code(201).send(result);
  });
  app.post("/v1/exports", async (req, reply) => {
    const eid = randomUUID();
    run(
      db,
      "INSERT INTO exports VALUES(?,?,?,?)",
      eid,
      req.identity.userId,
      clockFor(db).now(),
      clockFor(db).now() + 3600_000,
    );
    return reply.code(201).send({
      id: eid,
      status: "ready",
      downloadUrl: `/v1/exports/${eid}`,
      expiresAt: clockFor(db).now() + 3600_000,
    });
  });
  app.get("/v1/exports/:id", async (req, reply) => {
    const row = owned(db, "exports", req.identity.userId, paramsId(req));
    if (row.expires_at < clockFor(db).now())
      fail(410, "export_expired", "Request another export.");
    const uid = req.identity.userId;
    const user = one(
      db,
      "SELECT email,profile,reminders,created_at FROM users WHERE id=?",
      uid,
    );
    const result: any = {
      formatVersion: 1,
      exportedAt: new Date(clockFor(db).now()).toISOString(),
      account: {
        ...user,
        profile: JSON.parse(user.profile),
        reminders: JSON.parse(user.reminders),
      },
    };
    for (const table of [
      "targets",
      "target_guidance",
      "meals",
      "drafts",
      "favorites",
      "plans",
      "messages",
      "support",
      "ai_usage",
    ])
      result[table] = all(
        db,
        `SELECT * FROM ${table} WHERE user_id=?`,
        uid,
      ).map(({ user_id, ...r }) =>
        r.data ? { ...r, data: JSON.parse(r.data) } : r,
      );
    result.analyses = all(
      db,
      "SELECT id,state,result,error,created_at FROM jobs WHERE user_id=?",
      uid,
    );
    return reply
      .header(
        "Content-Disposition",
        'attachment; filename="protein-pilot-export.json"',
      )
      .send(result);
  });
  app.delete("/v1/me", async (req) => {
    z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).parse(req.body);
    if (req.identity.verifiedAt < clockFor(db).now() - 10 * 60_000)
      fail(
        403,
        "reauth_required",
        "Sign in with a fresh email link before deleting your account.",
      );
    const uid = req.identity.userId;
    jobs?.cancelUser(uid);
    db.transaction(() => {
      const user = one(db, "SELECT email FROM users WHERE id=?", uid);
      run(db, "DELETE FROM auth_links WHERE email=?", user.email);
      run(db, "UPDATE jobs SET draft_id=NULL WHERE user_id=?", uid);
      run(db, "UPDATE drafts SET meal_id=NULL WHERE user_id=?", uid);
      run(db, "DELETE FROM users WHERE id=?", uid);
    })();
    db.pragma("wal_checkpoint(TRUNCATE)");
    return { deleted: true };
  });
  return { app, db, jobs, config };
}
