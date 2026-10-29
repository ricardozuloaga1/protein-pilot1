import { clockFor } from "./clock.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "./config.js";
import { type DB, one, run } from "./db.js";
import { defaultProfile, fail } from "./domain.js";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Identity = {
  userId: string;
  sessionHash: string;
  verifiedAt: number;
};
declare module "fastify" {
  interface FastifyRequest {
    identity: Identity;
  }
}
export type Mailer = (email: string, link: string) => Promise<void>;
export function mailer(config: Config): Mailer {
  const transport = config.smtp
    ? nodemailer.createTransport(config.smtp)
    : null;
  return async (email, link) => {
    if (transport) {
      await transport.sendMail({
        from: config.mailFrom,
        to: email,
        subject: "Your Protein Pilot sign-in link",
        text: `Sign in to Protein Pilot: ${link}\nThis link expires in 15 minutes. Ignore this email if you did not request it.`,
      });
      return;
    }
    if (config.production) throw new Error("SMTP required");
    const dir = path.join(config.dataDir, "mail");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(dir, `${randomUUID()}.json`),
      JSON.stringify({ to: email, link, expiresInMinutes: 15 }),
      { mode: 0o600 },
    );
  };
}
export function registerAuth(
  app: FastifyInstance,
  db: DB,
  config: Config,
  send: Mailer,
) {
  app.decorateRequest("identity", null as unknown as Identity);
  app.addHook("preHandler", async (req: FastifyRequest) => {
    if (req.routeOptions.config.public === true || req.method === "OPTIONS")
      return;
    const token = req.headers.authorization?.match(
      /^Bearer ([A-Za-z0-9_-]{43})$/,
    )?.[1];
    if (!token) fail(401, "unauthorized", "Sign in to continue.");
    const session = one(
      db,
      "SELECT * FROM sessions WHERE hash=? AND expires_at>?",
      hash(token),
      clockFor(db).now(),
    );
    if (!session) fail(401, "session_expired", "Sign in again.");
    req.identity = {
      userId: session.user_id,
      sessionHash: session.hash,
      verifiedAt: session.verified_at,
    };
  });
  app.post(
    "/v1/auth/request-link",
    {
      config: { public: true, rateLimit: { max: 5, timeWindow: "15 minutes" } },
    },
    async (req, reply) => {
      const { email } = z
        .object({
          email: z
            .string()
            .trim()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
        })
        .parse(req.body);
      const old = one(
        db,
        "SELECT expires_at FROM auth_links WHERE email=? ORDER BY expires_at DESC LIMIT 1",
        email,
      );
      if (old && old.expires_at > clockFor(db).now() + 14 * 60_000)
        return reply.code(202).send({ status: "accepted" });
      const token = randomBytes(32).toString("base64url");
      db.transaction(() => {
        run(db, "DELETE FROM auth_links WHERE email=?", email);
        run(
          db,
          "INSERT INTO auth_links VALUES(?,?,?)",
          hash(token),
          email,
          clockFor(db).now() + 15 * 60_000,
        );
      })();
      // Fragment keeps the token out of web server access logs. The client POSTs it to /verify.
      try {
        await send(
          email,
          `${config.appUrl.replace(/\/$/, "")}/auth/verify#token=${token}`,
        );
      } catch {
        run(db, "DELETE FROM auth_links WHERE hash=?", hash(token));
        fail(
          503,
          "email_unavailable",
          "Could not send a sign-in email. Please try again.",
        );
      }
      return reply.code(202).send({ status: "accepted" });
    },
  );
  app.post(
    "/v1/auth/verify",
    {
      config: {
        public: true,
        rateLimit: { max: 15, timeWindow: "15 minutes" },
      },
    },
    async (req) => {
      const { token } = z
        .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .parse(req.body);
      return db.transaction(() => {
        const link = one(
          db,
          "SELECT * FROM auth_links WHERE hash=? AND expires_at>?",
          hash(token),
          clockFor(db).now(),
        );
        if (!link)
          fail(
            401,
            "link_expired",
            "This link expired or was already used. Request another.",
          );
        run(db, "DELETE FROM auth_links WHERE hash=?", hash(token));
        let user = one(db, "SELECT * FROM users WHERE email=?", link.email);
        if (!user) {
          const uid = randomUUID();
          run(
            db,
            "INSERT INTO users(id,email,profile,created_at) VALUES(?,?,?,?)",
            uid,
            link.email,
            JSON.stringify(defaultProfile),
            clockFor(db).now(),
          );
          user = { id: uid };
        }
        const accessToken = randomBytes(32).toString("base64url");
        const expiresAt = clockFor(db).now() + 30 * 86400_000;
        run(
          db,
          "INSERT INTO sessions VALUES(?,?,?,?)",
          hash(accessToken),
          user.id,
          expiresAt,
          clockFor(db).now(),
        );
        return { accessToken, expiresAt, userId: user.id };
      })();
    },
  );
  app.post("/v1/auth/sign-out", async (req) => {
    run(db, "DELETE FROM sessions WHERE hash=?", req.identity.sessionHash);
    return { signedOut: true };
  });
}
declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean;
  }
}
