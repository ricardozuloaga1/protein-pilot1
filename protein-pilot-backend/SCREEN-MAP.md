# Paper screen integration

Design file: https://app.paper.design/file/01M5XHNW97XJQGDG3B3QRG7J9X/p-1-0

| Screens | API and client behavior |
|---|---|
| O01–O05 onboarding | `PUT /v1/me/profile`, `PUT /v1/me/target`; keep pre-auth input on device until email verification. |
| O06–O08 email sign-in | Request link → system email → fragment token → verify; expired links show `link_expired`. |
| T01/T02/T06/T07 Today and journal | `GET /v1/days/:day`; show empty state for `totals: null`; `targetReached` powers reached state. |
| T03/T04 meal details/options | Get/patch meal with version. Re-log by creating a new draft, preserving the original. |
| T05 remove/undo | DELETE meal → restore within 30 seconds using returned version. |
| T08 offline | Device outbox stores complete meal and stable request ID; sync only for original account. Network failure keeps item queued. |
| L01–L04 capture/analyzing | Device chooses source and handles camera permission; backend consent plus multipart upload → poll job. |
| L05/L06/L10/L16/L17 review/edit | Fetch/update draft; change grams, per-100g values, meal type and timestamp; API recomputes totals on confirmation. |
| L07 saved | Show only after successful confirmed-meal response. |
| L08/L09/L13 search/manual | Foods and favorites endpoints; zero search matches → manual entry. No hidden fallback data. |
| L11/L12 failure/denied | No-food/unclear result or job error → retake/manual; OS camera denial handled on device. |
| L14–L18 save failure/discard/validation | Preserve local draft on errors, retry same key, use field errors; delete draft on discard, cancel pending job. |
| P00–P07 planning | Recipes, plans and versioned swaps; generate seven suggested lunches, not a complete diet. Client loading/failure states follow real requests. To eat a planned meal, create a draft from recipe foods, then confirm. |
| G01/G03/G04 progress/milestones | Range progress endpoint; unknown days remain gaps. Target-hit counts available; badge artwork and presentation remain client work. |
| G02/G05 quality | Plain-language explanation; API intentionally returns no invented numerical quality score. |
| C01–C03 coach | Get/post messages; timeout/error leaves composer text intact. No automatic changes to meals or targets. |
| A01–A04 settings | Profile, target and reminder APIs. Device notification permission and scheduling remain client responsibilities. |
| A05/A08/A09 privacy/delete | Photo-consent settings, retention notice, recent email verification and exact deletion confirmation. |
| A06/A11 support | Durable queue acceptance; UI says recorded rather than email sent. |
| A07 sign-out | Resolve pending offline work on device, revoke session, clear keychain. |
| A10 export | Create export → authenticated download link valid for one hour; response is ready immediately, not a fictitious email-delivery state. |

The screens are design artifacts. This backend does not implement camera UI, mobile OS permissions, local notification delivery, frontend navigation or secure device storage.
