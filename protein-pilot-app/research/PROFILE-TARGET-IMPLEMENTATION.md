# Profile-derived protein targets

Implemented October 28, 2026. Algorithm version protein-profile-2026-10-28.1.

The app no longer asks users to enter a protein target during onboarding or in target settings. It collects age, current weight (kg), height (cm), actual training type/frequency and a minimal specialized-guidance routing answer. The backend previews an estimate and recomputes it when the profile is saved. The frontend never supplies an accepted numeric target. Goals alone do not make someone an athlete. Dietary preference changes food selection, not an automatic blanket protein multiplier.

## Evidence and explicit product choices

The [2025–2030 US Dietary Guidelines](https://cdn.realfood.gov/DGA.pdf) specify 1.2–1.6 g/kg/day as general protein serving guidance. [MedlinePlus athletic nutrition](https://www.medlineplus.gov/ency/article/002458.htm) describes approximately 1.2–2.0 g/kg/day for athletes. These ranges are not interchangeable with the adult RDA and do not prove a uniquely correct personalized point target.

Within the supported adult scope, the product selects a starting point of 1.2 g/kg with no regular training, 1.4 for endurance, and 1.6 for strength/mixed training. At least two training days/week qualifies as regular training for this version. Those point choices and the frequency boundary are transparent product heuristics within the cited ranges, not individually validated clinical rules. Output rounds to the nearest whole gram and shows the calculation and reference range. No calorie deficit, automatic weight-loss plan, or extra reward for excess intake is implied.

The automated scope is adults 18–64 reporting no specialized-guidance needs, with BMI 18.5 to below 30. BMI is used only to avoid applying actual-weight multipliers outside the currently supported weight-selection policy; it is not a diagnosis or body-composition assessment, and muscular people may fall outside it. The age and BMI boundaries are conservative product scope limits, not biological cutoffs or claims that everyone outside them is unhealthy. Older adults, minors, pregnancy/breastfeeding, prescribed diets/kidney conditions and declined screening receive no generated number. Logging and recipes remain available. Clinician-provided target/upper-limit support remains future work. [NIDDK kidney nutrition guidance](https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease) supports avoiding generic high-protein prescriptions for kidney conditions.

## Persistence and privacy

`POST /v1/protein-preview` is a validated, rate-limited public calculation with no AI call or persistence. `PUT /v1/me/profile` saves the profile and versioned guidance atomically. History uses guidance effective on each local date. A newly unsupported profile masks the old target from that date rather than retaining an unsuitable number. Existing historical records are preserved. Same-day edits replace that day's guidance.

Legacy manually selected targets remain readable for existing accounts until profile calculation is completed; they are not silently overwritten using missing information. The legacy numeric setter rejects requests once calculation inputs exist. Older clients cannot erase those inputs by omitting them during preference updates. No generic 140 g default remains in onboarding or settings (the chart's minimum scale is unrelated).

Guidance snapshots participate in account export and foreign-key cascade deletion. Age, height and guidance-screen answers are omitted from the coach request, including nested daily guidance. User-authored chat text is still sent as disclosed in the coach UI.

## Verification

Backend tests cover 75 kg strength → 120 g; endurance → 105 g; no regular training → 90 g; unsupported routes → null; invalid inputs; server ownership of calculation; historical changes; masking old targets; legacy client omissions; export and deletion; and coach input minimization. Backend 21 tests and frontend 9 tests passed.

In the isolated iOS simulator, entering age 30, 75 kg, 180 cm, strength training three days/week and no specialized guidance displayed 120 g/day and a 90–150 g reference range. Saving updated Settings and Today to 120 g without entering a protein number. This verifies the flow, not clinical suitability of the algorithm. The prior 504-day evaluation predates this change and uses legacy explicit test targets; it is not evidence validating this new calculation.
