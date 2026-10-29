import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: ".env.local", quiet: true });
export type Config = ReturnType<typeof configuration>;
export function configuration() {
  const production = process.env.NODE_ENV === "production";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const config = {
    production,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3100),
    dataDir: path.resolve(process.env.DATA_DIR || "./data"),
    appUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
    origins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(
      ",",
    ),
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
    dailyLimit: Number(process.env.AI_DAILY_LIMIT || 20),
    smtp: process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: smtpPort,
          secure: smtpPort === 465,
          requireTLS: smtpPort !== 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        }
      : undefined,
    mailFrom: process.env.MAIL_FROM || "Protein Pilot <hello@example.com>",
  };
  if (!Number.isInteger(config.dailyLimit) || config.dailyLimit < 1)
    throw new Error("Invalid AI_DAILY_LIMIT");
  if (
    production &&
    (!config.smtp ||
      !config.appUrl.startsWith("https://") ||
      !config.apiKey ||
      config.origins.some((o) => !o.startsWith("https://")))
  ) {
    throw new Error(
      "Production requires SMTP, OPENAI_API_KEY, and HTTPS app/origins",
    );
  }
  return config;
}
