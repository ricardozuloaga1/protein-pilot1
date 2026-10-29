# Protein Pilot workflow evaluation

Implemented October 28, 2026. This is an engineering evaluation, not clinical validation.

## Run and replay

From this backend directory:

```sh
npm run eval:synthetic -- --seed pilot-v1 --out evaluation/run-1
npm run eval:synthetic -- --seed pilot-v1 --scenario offline --out evaluation/offline-replay
npm run eval:synthetic -- --scenario boundaries --out evaluation/boundaries
npm run eval:report -- evaluation/run-1/results.json
npm run eval:live -- --scenario allergy --out evaluation/allergy-live
npm run eval:live -- --scenario measured-food-1 --images /absolute/path/manifest.json --out evaluation/food-live
npm run eval:report -- evaluation/live/results.json
npm run eval:serve
```

Scenario IDs: routine, strength, vegan, vegetarian, pescatarian, endurance, older, allergies, restricted, pregnancy, shift, offline, boundaries, rate-limits. Live IDs are in scripts/eval/live.ts. There is no time-changing HTTP endpoint. Evaluation controls require NODE_ENV=test and a non-production config. Real wall time still controls provider/network deadlines and production throttling. Manual worker tick/prune operations are only accessible through the in-process harness.

Each synthetic run creates fresh SQLite databases beneath the OS temporary directory. It authenticates through request-link and verify with an intercepted mailbox. Meals enter through the normal routes. Read-only assertions inspect persistence. No run opens data/protein-pilot.sqlite. The simulator API also creates its own temporary database; its location and intercepted mailbox are recorded in ignored evaluation/private/simulator.json. Restarting eval:serve starts a fresh run. Retained temporary test databases contain only evaluation inputs and should be removed when no longer needed.

## Current results

The 504-user-day run completed with 4,509 passing checkpoints, nine not-implemented coverage entries, and one not-run native offline check. A second run with the same seed had the identical fingerprint `8dca99c980e27fd7861dd2ff68314176ab509c898d1d849f6b528212c7e29f87`. Reports: evaluation/run-1 and evaluation/replay. The earlier evaluation/latest report is a superseded harness-development run; its failures were corrected runner assumptions about session expiry and deleted comparison accounts, not claimed product defects.

The initial live run dispatched 28 calls: ten coach scenarios twice and four clear negative images twice. Published standard-price cost from returned usage: $0.024059; budget commitment with 10% headroom: $0.0264649; no unknown-usage calls. This is calculated from provider token usage, not a billing invoice. All eight negative images returned no_food, no foods, and no draft. Coach semantic acceptance remains pending human review. No measured-food accuracy claim is made. Twelve measured-food and four ambiguous-image fixtures are not run because reviewed reference assets are unavailable.

## Independent expectations

Fixture version 2026-10-28.1. scripts/eval/core.ts contains explicit fictional profiles, accepted targets and schedules. Targets are test values, not recommendations. Synthetic portion labels use 200 kcal, 20 g protein, 20 g carbohydrate and 4 g fat per 100 g. Expected totals are calculated independently with scalar coefficients and one-decimal rounding, without importing application calculations. This tests arithmetic and persistence, not a real food catalog. Tolerance after rounding is zero. Missing days expect null totals, not zero. Target history uses the target effective on each date.

The dietary exclusions are explicit test inputs. Specialized attributes unsupported by the schema are listed as gaps, rather than silently removed. Plan-as-intake exclusion, deduplication, export ownership, and session/cleanup durations are product/API rules. The 42-day timeline and milestone proposals are product tests, not nutritional thresholds.

Behavioral expectations and their applicability derive from the existing research specification in ../protein-pilot-app/research/PROTEIN-GAMIFICATION-EVIDENCE.md and PLAN-INTAKE-AND-MILESTONES.md. In particular: FAO DIAAS requires matched amino-acid digestibility evidence, not a photograph or a guessed absorption percentage (https://www.fao.org/4/i3124e/i3124e.pdf); source-specific food records require provenance (https://fdc.nal.usda.gov/data-documentation/). Clinical restriction and pregnancy cases test refusal to invent prescriptions, not correct medical treatment. Missing-log uncertainty follows the absence of evidence in the journal.

Image manifests must identify asset license/source, expected behavior, rationale, measured edible grams and matched nutrient-source ID/version. The example manifest contains illustrative numbers only and MUST NOT be run as real ground truth. `image-metrics.ts` independently computes raw signed errors and flags protein errors greater than max(5 g, 20%) or energy greater than max(50 kcal, 20%). These are engineering triage thresholds. Corrected results are null until a user actually corrects and confirms a meal; raw estimates are never relabeled as corrected accuracy. Human review is required for coach outputs and flagged images. AI review alone is not sufficient.

## Live budget and reproducibility

The ignored persistent ledger evaluation/private/budget.json is shared across invocations. Do not delete or reset it to bypass the authorized 60-call/$10 ceiling. An exclusive file lock prevents concurrent writers. Reservations are saved before dispatch. Unknown-cost failures keep the full reservation. A stale lock after a hard crash requires checking that no evaluator is running before removing the lock; the ledger must remain.

Only gpt-6.1-terra with service_tier=default is priced. Pricing verified October 28, 2026 at https://developers.openai.com/api/docs/pricing : standard short-context input $1/M, output $5/M; long-context input $2/M, output $7.50/M. Each request reserves $2.10, covering the model's entire 922k input allowance and the image adapter's 5k output bound plus 10% regional headroom. Recorded costs ignore cache discounts, conservatively. Automatic retries are disabled. A request is refused when its maximum reservation would cross the cap, even if typical requests cost less. New models or pricing require a reviewed update. Provider usage, returned model, service tier, latency, response ID, fixture version and adapter source hash are retained. Repeated prompts can vary; only the synthetic suite is deterministic.

## Simulator isolation

Evaluation device: Protein Pilot Evaluation, AAA5DC5E-ACE7-4B70-9308-CFCB505109C3. API 127.0.0.1:3101. Expo port 8082 launched with EXPO_PUBLIC_API_URL=http://127.0.0.1:3101. The existing Protein Pilot simulator and development DB are untouched by this harness. The evaluation server uses deterministic AI, never silently spends the live budget.

Request a fictional email ending in @proteinpilot.test, then open its normal intercepted link:

```sh
node --import tsx scripts/eval/signin.ts ios-eval@proteinpilot.test AAA5DC5E-ACE7-4B70-9308-CFCB505109C3
```

No token is printed. Camera hardware and actual notifications require a physical device. See evaluation/SIMULATOR.md for the observed journey status.

## Prioritized remaining work

1. **P1 / inadequate reference data:** assemble 12 licensed measured-food photos with independently reviewed portions and matched label/database records, plus four ambiguous fixtures. Run each twice within the remaining 32-call allowance. Current results cannot validate food recognition or nutrient accuracy on meals.
2. **P1 / review requirement:** a human must review the 20 saved coach responses and any flagged image results. AI-assisted inspection found no obvious violations in these responses but does not satisfy acceptance.
3. **P1 / missing features:** specialized planning inputs and clinician upper-limit semantics are not implemented. An accepted target currently behaves as a goal, not a prescribed maximum. Do not interpret target-hit counts for restricted users as medically appropriate achievement logic.
4. **P2 / missing features:** personalized planner, expanded research-informed achievements and verified nutritional catalog remain absent. Existing plans are explicit recipe selections; quality score stays unavailable.
5. **P2 / coverage:** complete native final-deletion UI verification and explicit thumbnail-delete control (confirmed API deletion and cascade removal passed); photo, offline retry, plan and export/reauthentication checkpoints are now recorded in evaluation/SIMULATOR.md. Existing API and client model tests do not replace UI evidence.
6. **P2 / coverage:** worker restart recovery has a passing existing regression test, but the 42-day storyline does not yet kill/restart a real process. Add a controlled crash test through queued real API work and validate retained reservations.

A P2 floating-point rounding defect was found in the native tofu-bowl journey: 34 + 4.05 + 2.4 displayed as 40.4 g while the daily sum displayed 70.5 g after a separate 30 g meal. Backend and frontend rounding now correct decimal ties with scale-aware machine-epsilon compensation; regression tests cover both values. Previously stored rounded meal totals are not migrated by this change; the development database remains untouched. The standalone synthetic fixture values did not originally expose this case. This does not mean the full workflow is validated: the gaps above remain acceptance blockers.
