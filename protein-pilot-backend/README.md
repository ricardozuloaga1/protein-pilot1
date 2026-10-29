# Protein Pilot backend

A runnable TypeScript/Fastify API for the Paper revamp, with SQLite persistence and OpenAI food-photo analysis. The old Expo app was used as a domain reference; its direct provider-key calls and non-atomic meal writes were not carried over.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run check
npm run build
npm start
```

The API listens on `http://127.0.0.1:3100`. `GET /health` checks the process. The existing `.env.local` contains the securely provisioned OpenAI key; it is ignored by Git. Do not copy it into the mobile app, Docker image, logs or a repository. The selected key expires after 30 days; rotate it before expiration. Configuration options are in `.env.example`.

In development, request a sign-in email with `POST /v1/auth/request-link`. Without SMTP, the private `data/mail/` directory contains a local email preview. Open the latest preview locally, then POST its fragment token to `/v1/auth/verify`. The API never returns login links from a public endpoint. The client should clear the URL fragment immediately after consuming it. Use the resulting access token as `Authorization: Bearer …`; keep it in iOS Keychain / Android Keystore.

Production startup refuses to run without SMTP, an OpenAI key and HTTPS app/origin settings. A frontend at `PUBLIC_APP_URL` must implement `/auth/verify` and POST the fragment token; the Paper designs are not executable UI.

## Implemented

- Single-use email links, expiring/revocable sessions, per-route rate limits, account isolation and recent-sign-in protection for deletion.
- Onboarding profile, dietary preferences, explicit photo consent, date-effective protein targets and reminder preferences.
- Meals, portions, manual entry, favorites, drafts, optimistic edit versions, atomic confirmation, retry-safe create requests, delete/30-second undo and client outbox helpers.
- Private uploads, verified image decoding, metadata stripping, durable analysis jobs, cancellation, timeouts, quotas and editable AI drafts. Images are deleted after processing/failure/cancellation; unprocessed images expire after 24 hours while the service is running. They are pruned on the next worker tick after downtime.
- Daily journal, timezone-aware log dates, progress with missing days represented as unknown, historical targets and target-reached counts.
- Recipe browsing and a seven-day starter plan with one suggested lunch per day; swaps/additional slots support up to four meal slots per day. Plans never count as intake.
- Coach conversation, durable support intake, authenticated JSON export and account deletion.

See [API.md](API.md) for request contracts and [SCREEN-MAP.md](SCREEN-MAP.md) for the Paper-to-API mapping. `src/client.ts` provides a mobile-facing client and an offline meal sync helper. Run `npm run smoke:openai` to make one live paid request with a synthetic non-food image; it prints only safe validation metadata.

## Food analysis behavior

`POST /v1/analysis` accepts one image; the client polls the returned job URL. A successful analysis returns a draft ID, never a logged meal. Review portions and food identities, update the draft, then explicitly confirm it. Retrying confirmation cannot add the same draft twice, even with a new request key. Cancellation wins over late provider responses.

The provider is the OpenAI Responses API with structured outputs, `store: false`, and the configurable `gpt-6.1-terra` model. Structured outputs constrain shape, not nutritional accuracy. Food identities, portions and nutrients remain estimates; there are no fabricated confidence percentages, bounding boxes, or protein-quality scores. The first legacy-model live smoke incorrectly identified food in a blank image; the current model and stricter instructions passed the same negative check. A representative real-food evaluation set is still needed before launching to users.

Provider errors fail visibly and preserve manual logging. Attempts count against a shared per-user photo/coach quota of 20 per UTC day, including failed or cancelled attempts. SDK automatic retries are disabled to prevent hidden repeated charges. Interrupted running jobs fail after a restart rather than silently charging for a replay. Failed jobs can be resubmitted with a new request key. No external image URLs are fetched by the API.

OpenAI's `store: false` does not promise zero provider retention; review the provider's [data controls](https://developers.openai.com/api/docs/guides/your-data). Implementation references: [vision inputs](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [model capabilities](https://developers.openai.com/api/docs/models/gpt-6.1-terra).

## Deployment boundaries

This is a single-instance backend connected to the rebuilt native frontend in the sibling `protein-pilot-app` directory. The complete photo review/logging flow has been exercised in iOS Simulator. It has not been publicly deployed.

1. Run one service process on a persistent, encrypted disk; do not place this SQLite version on ephemeral/serverless storage or scale it to multiple hosts. Use HTTPS at the reverse proxy and configure allowed origins. Proxy trust is deliberately disabled; set a verified proxy policy before enabling forwarded client IPs, so rate limits work correctly behind that proxy.
2. Configure a real SMTP service and the frontend magic-link landing page. Development mail previews are local testing artifacts, not sent mail. Delete expired previews; do not enable preview mode on a production host.
3. Set a project budget/alerts at OpenAI in addition to API quotas. Protect `.env.local`/secret-manager configuration, restrict filesystem access and monitor sanitized errors. Native SQLite and image libraries require a supported deployment platform.
4. Provide backups, retention and restore procedures. Backups may contain user nutrition data; encrypt them and account for them in deletion policy. Account deletion removes live rows/images/sessions, but cannot erase independent backups or provider logs. Deploy migration changes with explicit versioned migrations; schema v1 is bootstrapped by `src/db.ts`.
5. Configure support operations to consume the stored support queue. This service records a ticket; it does not claim an email was delivered or that someone is monitoring the queue. Reminders use the mobile OS's local notification scheduler; the backend only stores preferences.
6. Replace the small, explicitly approximate starter food catalog with a reviewed nutrition source before public launch. Recipe allergen filtering is a convenience, not an allergy safety guarantee. The app must show ingredient-check notices. Target values are user-selected, not medical prescriptions. Coach sends the current profile, today's log and recent conversation to OpenAI when the user explicitly submits a message; disclose that in the UI.

The old repository contains an embedded xAI credential. Rotate/revoke that legacy credential and remove it from distributed builds/history as appropriate. It was not copied into this backend.

## Validation

`npm run check` compiles the API and runs isolated integration tests with temporary databases and injected model/email adapters. Tests cover sign-in replay, session revocation, user isolation, idempotency, draft confirmation, timezone boundaries, historical targets, missing-day gaps, edit conflicts, undo, photo validation/consent, late cancellation, provider errors, quotas, dietary plan filters, exports and account deletion. Mocked integration tests verify application behavior; the separate live smoke validates API connectivity and the non-food rejection case.
