# Protein Pilot

Expo / React Native mobile app and Fastify / SQLite backend, with the Field Notes interface, profile-derived protein targets, automatic meal planning, OpenAI food-photo analysis, and progress badges.

## Repository layout

- `protein-pilot-app/`: mobile app, UI assets, design concepts, research notes and tests.
- `protein-pilot-backend/`: API, SQLite persistence, AI integration, tests and synthetic evaluation harness.
- `docs/ingredient-photo-review.md`: proposed next iteration for ingredient-level photo review.

## Local development

Use Node.js 22 or later. Install dependencies independently with `npm ci` in each project directory.

Backend: copy `.env.example` to `.env.local`, configure the OpenAI key only in that local backend file, then run `npm run dev`. See the backend README for authentication, SMTP and API setup.

Frontend: configure `EXPO_PUBLIC_API_URL` using the app's `.env.example` (default `http://127.0.0.1:3100`), then run `npm run ios`. Physical devices need a reachable backend address rather than device-local loopback.

## Verification

Run `npm run check` in both project directories and `npm run lint` in the app. The backend includes `eval:synthetic`, `eval:report`, `eval:live`, and `eval:serve`; see `protein-pilot-backend/EVALUATION.md`. Live evaluation makes billable requests and uses its own budget guard.

## Current scope

The first six Field Notes badges derive from persisted records. Six additional badges are explicitly marked coming later. Meal plans use a small starter recipe catalog; they are not comprehensive clinical nutrition plans. Unsupported profile guidance is surfaced rather than silently assigned a target.

See `protein-pilot-app/design/field-notes-implementation/README.md` for the UI implementation and its verification limits. Existing project notes may contain machine-specific evidence paths from development.

Credentials, local databases, authentication mail previews, private evaluation state, generated evaluation runs, dependencies and build output are intentionally excluded. No production deployment is implied by this source snapshot.
