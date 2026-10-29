# Personalized planning and logging milestones

Research and product specification · October 27, 2026

This document reviews the existing Paper design and running implementation and specifies the next form. It does not change the app or establish a clinically validated nutrition algorithm. Evidence-backed nutrition considerations and proposed product rules are distinguished below.

## What we already designed

In [Paper: Progress & coach](https://app.paper.design/file/01M5XHNW97XJQGDG3B3QRG7J9X/p-5-0), “Small wins count” contains a featured “A week of showing up” achievement for seven days with a meal logged, “First meal,” “First target reached,” and progress toward fourteen logging days (“Finding your rhythm”). The design emphasizes accumulated participation; it does not specify consecutive-day streaks, XP, levels, leaderboards, or bonuses for extra protein.

In the app, `Explore.tsx` passes the selected progress period's logging/target counts into the milestones screen. That screen shows two counts and a generic award icon. The named achievements, earned dates, next-achievement progress, and celebration are absent. Switching week/month changes those counts; they are not lifetime achievements. The backend exposes range summaries, not an achievement ledger.

In [Paper: Plans & recipes](https://app.paper.design/file/01M5XHNW97XJQGDG3B3QRG7J9X/p-4-0), “Your week, your way” already asks for start date, meals per day, kitchen time and food preferences, and displays the daily protein target. The app bypasses this form: “Plan my week” posts only a start date. The API rotates matching starter recipes into seven lunches. It does not build a complete day, calculate an individual target, optimize portions, or meet energy/fiber requirements.

## Gamification rules to implement

These are product recommendations, not claims that a particular reward system improves health.

| Achievement | Rule | Presentation |
| --- | --- | --- |
| First meal | First server-confirmed meal, from any logging method | One-time celebration after save |
| A week of showing up | Seven distinct local calendar days with at least one confirmed meal, not necessarily consecutive | Featured green achievement and earned date |
| Finding your rhythm | Fourteen distinct logging days | Progress such as 7/14, then earned state |
| First target reached | First date whose logged protein reaches that date's accepted target | One-time badge; disclose that intake is estimated |
| Thirty days of showing up | Proposed extension: thirty distinct logging days | Next milestone after fourteen |

Separate two measures: **logging consistency** and **recorded intake relative to the target**. A logged day does not mean the person logged everything they ate. Missing entries mean unknown intake. Never award extra points for exceeding the protein target, taking more photos, adding duplicate meals, or logging more frequently in a day. Do not use food quality scores inferred from photos. Weekly progress is informational and separate from lifetime milestones.

A small celebration belongs on the saved-meal screen; the collection belongs under Progress → Milestones. Today can show one next step, e.g. “3 of 7 logging days.” Use optional motion respecting reduced-motion settings; keep normal navigation available. Gaps do not reset cumulative milestones. Offer a way to hide motivational elements.

Implementation rules: compute from authenticated confirmed meals, not drafts, uploads, planned meals or unsynced optimistic UI. Deduplicate server events and sync retries. Record the meal's local date when saved, with a documented timezone policy. Do not reinterpret old dates when the profile timezone changes. Use the target effective on each historical date; editing today's target must not rewrite yesterday's result. Reconcile meal edits/deletions against qualifying evidence. Preserve a badge when other qualifying records still meet its rule; otherwise remove its earned state without a penalty message. Undo should restore eligibility without replaying the same celebration. Tests must cover these cases and week/month independence.

## Nutrition evidence that changes the form

**There is no one universal protein number for every user.** The current US 2025–2030 guidelines give a general protein target of 1.2–1.6 g/kg/day. That policy target is distinct from the established adult RDA of 0.8 g/kg/day; the RDA describes adequacy for almost all healthy adults, not a muscle-building prescription. Keep the guidance framework and version explicit rather than silently treating these values as interchangeable. [Current US guidance](https://realfood.gov/), [Dietary Reference Intake tables](https://www.ncbi.nlm.nih.gov/books/NBK208874/).

Exercise changes the relevant evidence. MedlinePlus describes approximately 1.2–2.0 g/kg/day for athletes. The ISSN position stand discusses 1.4–2.0 g/kg/day for most exercising people and distribution across meals; its per-serving guidance is contextual, not a universal absorption ceiling. This supports collecting training type, frequency and duration alongside body weight. Do not assign an athlete's range to everyone who selects “build muscle.” [MedlinePlus](https://www.medlineplus.gov/ency/article/002458.htm), [ISSN position stand](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/).

**A full meal plan needs energy context.** USDA's DRI calculator uses age, weight, height, sex and activity, including life-stage information, to estimate nutrient and energy needs. Weight alone can support a grams-per-kilogram protein calculation but cannot establish a complete energy prescription. Offer protein-focused meal ideas independently from calorie estimation. [USDA calculator](https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator).

**Some users need a different pathway.** Kidney disease can change both the amount and sources of suitable protein; dialysis status can change needs further. Do not apply a generic high-protein multiplier to these users. Pregnancy, breastfeeding and youth also require distinct planning; the NIDDK adult weight planner explicitly excludes those populations. For an initial adult wellness product, route these cases to clinician-guided targets or general recipe browsing rather than automated weight-loss/high-protein prescriptions. This routing is our proposed scope decision, not a diagnosis. [NIDDK kidney nutrition](https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease), [NIDDK planner scope](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner).

**Allergies are hard constraints.** Provide the nine major US allergens plus an “other” option; they are not an exhaustive list of possible allergens. Distinguish allergies, celiac disease/intolerances and dislikes. Ingredient filtering cannot guarantee freedom from cross-contact. [FDA](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know).

## Proposed form: “A plan that fits your life”

Use six short steps, with profile data prefilled and editable. Show progress, Back and Save & exit. Ask only conditional questions relevant to the selected planning mode. Avoid making a long medical questionnaire the first-run experience.

### 1. Your goal and planning mode

| Exact question | Input | Requirement / use |
| --- | --- | --- |
| What would you like help with? | Maintain a routine / Support strength training / Support endurance / Use my own target | Required; distinguishes behavioral and training goals |
| What should we plan? | Protein-focused meals / A full day of eating | Required; exposes different input and nutrition requirements |
| Do you already have a daily protein target? | Use my saved target / Enter a target / Help me estimate | Required; never silently replace a saved target |
| Where did this target come from? | My preference / A clinician or dietitian / Another source | Conditional; provenance, not verification of a prescription |

Weight-loss planning should be a separately validated extension. Do not add an automatic calorie deficit just because the user wants more protein.

### 2. About you and your activity

| Exact question | Input | Requirement / use |
| --- | --- | --- |
| How old are you? | Age in years, not full birth date | Required for estimates and adult eligibility |
| What is your current weight? | Number plus kg/lb switch | Required for weight-based estimates; optional when using an existing target |
| What does a usual day look like? | Mostly seated / Some walking / Mostly on my feet / Physically demanding work | Required for energy estimates; keep separate from workouts |
| How do you train? | None / Strength / Endurance / Mixed | Required for estimated protein guidance |
| How often, and for how long? | Days/week; typical session duration; easy/moderate/hard | Conditional on training; allow rest days |
| What is your height? | cm or ft/in | Only for energy estimation or a specifically explained assessment |
| Which sex input should the energy equation use? | Equation-supported options, explanation and skip | Only for an equation that needs it; never infer from name or gender identity. Skipping offers an existing calorie target or protein-only mode |

Do not require body-fat percentage, smart-scale data, photos of the body, exact location, or a full date of birth. Do not automatically escalate targets for high body weight without a reviewed weight-selection policy; do not silently substitute “ideal weight.”

### 3. Anything your plan should account for?

Ask one optional-to-disclose screening question with: pregnancy/breastfeeding; kidney disease or a prescribed protein limit; another medically prescribed diet; none; prefer not to say. Under-18 status comes from age. If relevant needs are disclosed, explain that automated adult estimates are not suitable and offer general recipes or use of a clinician-provided plan. If the user declines the screen, offer meal ideas with their own target without claiming clinical suitability. Store the minimum routing information, not diagnoses or medications.

For full energy/weight planning, include a discreet “I prefer not to track calories or weight” path. Support a clinician-guided or non-numeric experience when calorie/weight tracking is unsuitable; do not attempt to diagnose an eating disorder through the form.

### 4. Food that fits

Required diet choice: omnivore, vegetarian, vegan, pescatarian or custom. Ask explicitly about allergies: milk, egg, fish, crustacean shellfish, tree nuts, peanuts, wheat, soy, sesame, other, or none. Keep celiac/gluten restrictions and intolerances distinct. Separate “foods I avoid” from allergies. Optional preferred protein foods, cuisines and cultural/religious requirements help ranking. Unknown ingredients or incomplete allergen data must not be labeled safe. Treat supplements as optional, never required to meet a target.

### 5. Your actual week

Start date; which days to plan; meal slots (breakfast/lunch/dinner/optional snack); meals eaten elsewhere; maximum active cooking time; available equipment (none/microwave/stovetop/oven); cooking confidence; budget with currency and a clearly defined per-person/week basis; country/region for availability; willingness to repeat meals or use leftovers; number of servings. These are practical product inputs, not protein-requirement variables. A household serving count scales a shopping list, not the individual's intake target.

Allow “no preference” or skip on optional questions. Use coarse region rather than precise location. Do not promise a price ceiling without local ingredient price data. An equipment restriction must be enforced, not merely saved in a profile.

### 6. Review before creating

Show the selected daily target and its origin; if estimated, show the evidence-based range, chosen working target, calculation inputs, source/version and an edit action. Present meal allocation as a flexible plan, not a physiological maximum. Show energy only when supported by a reviewed equation or an explicit user-entered target. Display meal coverage, restrictions, time, servings and any assumptions. Provide “Edit” for each section and an explicit “Use this target for my daily log” choice; do not mutate logging targets merely by previewing a plan.

Final actions: **Preview my plan → Adjust meals → Save this plan**. The preview must report any unmet constraints or uncovered meals. If no recipes fit, show the conflicting constraints and offer editing them; never quietly relax an allergy, diet or clinician-provided restriction. Swaps must recheck constraints and recompute planned totals. Saving a plan must never log food as eaten.

## Required states and engineering boundaries

Form states: untouched, prefilled, partially saved, validation error, unit change, edited profile, clinician-guided route, offline, preview loading, no matching recipes, insufficient catalog coverage, preview ready, save error and saved. Back navigation preserves answers. Changed form content invalidates an older preview. Retrying creation must not duplicate a plan. Start dates, meal slots and timezone must agree between UI and API.

Persist a versioned planning profile separately from onboarding: eligibility route, age/weight where needed, goal, activity/training, target source and accepted value, diet restrictions, schedule, cooking constraints, servings and optional preferences. Store a snapshot with each saved plan so edits to preferences do not silently rewrite an existing week. Include planning data in export/deletion. Do not pass screening answers to OpenAI by default; recipe generation only needs the minimum approved constraints.

Protein and nutrient arithmetic, eligibility rules, allergen filtering, portion validation and target comparison belong in deterministic backend code. AI can suggest combinations and explain them, but must not be the only source of nutrient totals or silently choose clinical rules. Use a reviewed recipe/ingredient database with portion units, cooking state, nutrient provenance, allergens, meal suitability, time and equipment. The current small approximate catalog cannot support a claim of nutritionally complete personalized planning.

## Recommended implementation sequence

1. Restore the designed named milestones with lifetime semantics and actual qualifying data.
2. Build the intake wizard and saved planning profile; expose it from Plan, prefilled from onboarding.
3. Support protein-focused plans around an explicitly accepted target, enforcing diet, ingredients, timing and coverage. Clearly label partial plans.
4. Add validated energy calculation and a larger reviewed catalog before offering a complete calorie-based plan. Obtain qualified nutrition review for target policies, special populations and nutrient adequacy.

This specification is the research/design deliverable. Paper and application code have not been modified by this review.
