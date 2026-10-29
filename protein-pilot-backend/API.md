# API v1

Base URL locally: `http://127.0.0.1:3100`. JSON unless stated otherwise. All `/v1` routes require `Authorization: Bearer <session>` except the two sign-in endpoints. Times in responses are Unix milliseconds unless named `loggedAt` (ISO timestamp) or `day`/`week` (YYYY-MM-DD). Date ranges are inclusive. Every protected read and write is scoped to the authenticated user.

Create meal, draft, analysis, favorite, plan and support requests require `Idempotency-Key`: 8–128 alphanumeric, underscore or hyphen characters. Draft confirmation also requires it. Generate a UUID once per user action and retain it across network retries. Changed content must use a new key. Reusing a key for different data or another operation returns 409. Operations are retained for the life of the account to keep offline retries safe.

Errors: `{ "error": { "code": "version_conflict", "message": "…", "fields": [] }, "requestId": "…" }`. `fields` appears on validation errors. Handle 400 validation, 401 sign-in, 403 consent/reauth, 404 missing/inaccessible, 409 conflict, 410 expired export, 413 size, 415 image format, 422 unavailable/invalid estimate, 429 rate/quota, and 503 provider/delivery unavailable. Never clear a local draft on a failed response.

## Authentication and profile

| Method and path | Request | Response |
|---|---|---|
| POST `/v1/auth/request-link` | `{email}` | 202 accepted; dev email preview or real SMTP delivery |
| POST `/v1/auth/verify` | `{token}` from URL fragment | `{accessToken, expiresAt, userId}`; one use, 15-minute link, 30-day session |
| POST `/v1/auth/sign-out` | `{}` | `{signedOut:true}` |
| GET `/v1/me` | — | Account, profile, reminders, photo policy |
| PUT `/v1/me/profile` | Full profile below | Saved profile; revoking photo consent cancels queued/running photo jobs |
| PUT `/v1/me/target` | `{protein:140}` | `{protein,effectiveFrom,notice}`; 20–400 g, effective today in profile timezone |
| PUT `/v1/me/reminders` | `{enabled:true,times:["12:30","19:00"]}` | Saved preferences, client-local delivery mode |
| DELETE `/v1/me` | `{confirmation:"DELETE MY ACCOUNT"}` | `{deleted:true}`; session must have been verified within 10 minutes |

```json
{
  "name": "Alex", "timezone": "America/Caracas", "goal": "maintain",
  "weightKg": null, "diet": "omnivore", "allergies": [], "exclusions": [],
  "photoConsent": false
}
```

Goals: `build_muscle | maintain | feel_stronger`. Diets: `omnivore | vegetarian | vegan | pescatarian`. The server does not calculate a medical target from weight. Onboarding input collected before sign-in stays on device until verification.

## Meal and draft payload

```json
{
  "name": "Tofu bowl", "mealType": "lunch", "loggedAt": "2026-10-26T12:30:00-04:00",
  "notes": "Check sauce on the label",
  "foods": [{
    "name": "Firm tofu", "grams": 200,
    "per100g": {"calories":144,"protein":17,"carbs":3,"fat":9},
    "source": "user"
  }]
}
```

Meal types: `breakfast | lunch | dinner | snack`. Food sources: `user | photo_estimate | catalog_estimate`; these labels describe provenance, not independent verification. Nutrients are per 100 g and quantity is grams. Totals are computed server-side, rounded to one decimal. Client-supplied totals are ignored. Maximum 40 food items per meal; 20 from image analysis. Meals more than five minutes in the future are rejected; use plans for future meals.

| Method and path | Behavior |
|---|---|
| POST `/v1/meals` | Payload above → 201 meal with `id`, `version`, `day`, `totals` |
| GET `/v1/meals/:id` | Meal detail, including deletion state |
| PATCH `/v1/meals/:id` | Full meal payload plus `version`; increments version, preserves ID |
| DELETE `/v1/meals/:id` | `{version}` → removed from totals, returns next version and `undoUntil` |
| POST `/v1/meals/:id/restore` | `{version}` → restored within 30 seconds |
| POST `/v1/drafts` | Meal payload → 201 draft; does not affect totals |
| GET `/v1/drafts` | Up to 100 unconfirmed drafts, newest first |
| GET `/v1/drafts/:id` | Draft detail, including image warnings if applicable |
| PUT `/v1/drafts/:id` | Full meal payload plus `version`; rejects edits to consumed drafts |
| POST `/v1/drafts/:id/confirm` | `{version,reviewed:true}` plus idempotency key → confirmed meal |
| DELETE `/v1/drafts/:id` | `{version}` → discard unconfirmed draft |
| GET `/v1/days/:day` | Meals, totals or null, target or null, targetReached, coverage |
| GET `/v1/progress?from=…&to=…` | Up to 366 days, unknown-day gaps, target-hit counts, quality explanation |

Meal dates are computed using the user's timezone when saved/edited. Changing timezone does not move existing historical entries automatically. Existing target history is also preserved. Retrying a successful idempotent creation returns its original response; reload the resource to see subsequent edits.

## Photo → draft → confirmed meal

1. Save explicit `photoConsent:true` in profile after showing the provider/retention notice.
2. POST `/v1/analysis?mealType=lunch&loggedAt=<URL-encoded ISO timestamp>` with `multipart/form-data`, a single `photo` file and an idempotency key. Do not manually set a multipart boundary from the mobile client. JPEG, PNG and still WebP only; maximum 8 MB and 40 million decoded pixels. Server rotates/resizes to fit 1536×1536, strips metadata and converts to JPEG.
3. Receive 202 `{id,state:"queued",pollUrl}`. GET `/v1/analysis/:id` every 1–2 seconds, slowing down on repeated polls. Terminal states are `succeeded`, `failed`, `cancelled`; otherwise `queued` or `running`.
4. Success with `result.status:"food"` includes `draftId`; fetch the draft. `no_food` or `unclear` has no draft and should show retake/manual entry. Failure returns a safe code such as `analysis_timeout`, `provider_rate_limit`, `provider_configuration` or `worker_restarted`.
5. Let the user inspect and edit portions/nutrients. PUT changes to the draft, then POST confirmation with its latest version and a stable key.
6. Leaving the analysis flow can POST `/v1/analysis/:id/cancel`. If the job already finished, the API reports its terminal state and draft ID; discard that draft explicitly if desired.

At most two queued/running photos per user. Photo and coach attempts share a quota of 20 per UTC day by default. Original uploads are not public and no image-serving endpoint exists. No image URL is accepted, avoiding server-side arbitrary URL fetching.

## Foods, recipes and plans

| Method and path | Request/response |
|---|---|
| GET `/v1/foods?q=tofu` | Starter food search; empty array means no match |
| GET `/v1/favorites` | User's reusable food combinations |
| POST `/v1/favorites` | `{name,foods}` plus key → favorite |
| DELETE `/v1/favorites/:id` | Remove favorite |
| GET `/v1/recipes` | Recipes filtered using saved diet/allergy/exclusion text, plus estimate notice |
| GET `/v1/recipes/:recipeId` | Recipe detail and estimated totals; detail may be viewed even if outside preferences |
| POST `/v1/plans` | `{week:"2026-10-26"}` plus key → seven suggested lunches beginning on that date |
| GET `/v1/plans` | Most recent 52 saved plans |
| PATCH `/v1/plans/:id` | `{version,slots:[{day,mealType,recipeId}]}` → update/swap; dates within seven-day window |

Recipes are illustrative estimates. Filtering cannot certify absence of allergens or cross-contact. Each recipe ID comes from `/v1/recipes`; empty suitable catalog returns `no_matching_recipes`. Plans store suggestions only. To consume a recipe, create a draft containing its foods and the actual consumed timestamp/type, then confirm it. Change portions first if needed.

## Coach, support and export

| Method and path | Behavior |
|---|---|
| GET `/v1/coach/messages` | Last 100 messages in chronological order |
| POST `/v1/coach/messages` | `{text}` → assistant message. Sends profile, today's log and last 10 messages to OpenAI. Does not modify intake. On failure neither message is saved; client keeps composer text. |
| POST `/v1/support` | `{text}` (10–5000 characters), key → 201 `{id,status:"recorded",delivery:"local_support_queue"}` |
| POST `/v1/exports` | `{}` → 201 ready export with authenticated download URL and one-hour expiry |
| GET `/v1/exports/:id` | JSON attachment with current account data; no authentication secrets or image bytes |

Coach message POST is not automatically retried by the client: unlike meal saves it has no idempotency contract, and repeated submissions may cost another request. Export download reflects data at download time. The export URL alone is insufficient without the user's session.
