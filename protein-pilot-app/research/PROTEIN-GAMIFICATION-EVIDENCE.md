# Evidence-informed protein achievements

Research and proposed product rules · October 27, 2026

Extends PLAN-INTAKE-AND-MILESTONES.md. This is a research specification, not an implemented or clinically validated scoring system. Nutrition evidence supports the behaviors described below; it does not validate our badge names, point values, or milestone thresholds. Review populations and outcomes before transferring a study's result to all users.

## Proposed dimensions

| Dimension | Research implication | Product behavior | Measurement limits |
| --- | --- | --- | --- |
| Logging consistency | Self-monitoring is an engagement behavior; a log is not a physiological outcome | Cumulative logging-day milestones; acknowledge returning after a gap | One logged meal does not establish a complete day's intake |
| Individual protein adequacy | Enough total daily protein matters for training adaptations; more is not indefinitely better | Celebrate days meeting an accepted personal target or range; cap achievement credit | Targets require the intake form and reviewed guidance; no generic target for every user |
| Protein quality | Digestibility and indispensable amino-acid profile matter | Explain source-specific evidence, teach suitable combinations and offer alternatives | A photograph cannot measure absorption; quality values need curated matching food/preparation data |
| Protein per calorie | A useful arithmetic comparison when fitting protein into an energy budget | Optional comparison card and goal-specific meal-building challenge | Not a health score or an instruction to eat fewer calories |
| Distribution | A practical way to spread protein across the user's meals; long-term outcome evidence is less definitive than total intake | Optional meal-coverage challenge, no rigid timer | No universal 30-g absorption ceiling; missed timing does not make food wasted |
| Overall food pattern | Protein foods also contribute fiber, fats and other nutrients | Variety and plant-protein exploration; suggest alternatives to processed meat | A narrow protein ranking must not override the overall pattern or dietary restrictions |

## Evidence and interpretation

### Daily amount and diminishing returns

Morton et al.'s meta-analysis of 49 resistance-training trials found supplementation improved training outcomes, with an estimated fat-free-mass breakpoint around 1.62 g/kg/day (95% CI 1.03–2.20). This is a group estimate in the studied setting, not an individual ceiling, toxicity limit or target for every person. Product implication: prioritize adequate intake and stop escalating rewards for more grams. [Study](https://pubmed.ncbi.nlm.nih.gov/28698222/).

### What “bioavailability” can mean in the app

Use the more precise label **protein quality: digestibility + essential amino acids**. FAO's DIAAS framework evaluates digestible indispensable amino acids against a reference pattern. It is not a percentage of protein an individual absorbs. Mixed meals require amino-acid-level data; averaging source scores is not a valid substitute. Processing and the tested food form matter. Product implication: attach sourced information only to well-matched foods; otherwise display “not enough data.” Do not multiply logged grams by a quality score to invent “usable protein.” [FAO report](https://www.fao.org/4/i3124e/i3124e.pdf).

Protein sources should not be ranked simply as animal good / plant bad. A 2025 meta-analysis found no pooled muscle-mass difference between soy and milk protein, while some non-soy comparisons favored animal sources. A 2026 supplement meta-analysis, largely involving soy, found no statistically significant differences for several body-composition and strength outcomes; absence of significance is not universal proof of equivalence. The food, dose, population and total diet matter. [2025 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12166177/), [2026 review](https://pubmed.ncbi.nlm.nih.gov/41994089/).

A useful boundary example: a small randomized trial in healthy older women found whey stimulated muscle protein synthesis more effectively than collagen under its protocol. Do not treat collagen as nutritionally interchangeable with whey for muscle-support recommendations, or generalize this into a claim that collagen has no uses. Logged label protein remains logged protein, with contextual guidance. [Trial](https://pmc.ncbi.nlm.nih.gov/articles/PMC7049534/).

### Protein per calorie

Define it transparently: **protein density = protein grams ÷ kcal × 100**, expressed as grams per 100 kcal. For an illustrative meal with 30 g protein and 400 kcal, the result is 7.5 g/100 kcal. Calculate a meal's ratio from its summed protein and energy, never the average of ingredient ratios. Missing/zero energy yields “unavailable,” not infinity or a maximum score.

No universal density cutoff establishes that a meal is healthy. Select any product threshold as a labeled design rule, not a research discovery. Apply comparisons to equivalent purposes and meal scope: a protein ingredient and a complete dinner are different comparisons. Include oils, sauces and actual preparation. For someone needing more energy, maximizing this ratio may be counterproductive. Use it as an optional decision aid rather than an always-on reward.

Use matched USDA records or actual product labels for nutrient calculations. FoodData Central distinguishes analytical food data, dietary-survey foods and manufacturer-label data; those sources have different provenance. Keep source IDs, serving units, cooking state and version. [USDA documentation](https://fdc.nal.usda.gov/data-documentation/).

### Distribution and timing

Distribution research has plausible physiological mechanisms, but long-term muscle outcomes are less consistent. A 2025 timing meta-analysis found no significant total lean-mass difference for the timing comparisons it studied. Timing around exercise and distribution across daily meals are related but distinct questions. Product implication: offer flexible protein-containing meals that fit the user's routine; do not claim a narrow post-workout window or exact spacing is required. [Distribution review](https://pubmed.ncbi.nlm.nih.gov/32429355/), [timing meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12250900/).

### Broader nutritional value

American Heart Association guidance favors plant protein sources, regular fish/seafood, lower-fat dairy and lean unprocessed meats when included. Beans/lentils bring fiber, while certain fish supply omega-3 fats. A density-only competition misses those contributions. Product implication: variety and pattern-level guidance should coexist with protein quantity. Dietary preferences and allergies determine which options are eligible. [AHA guidance](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/picking-healthy-proteins).

## What “best protein options” means for recommendations

Use separate filters rather than one leaderboard. Candidate categories for the reviewed food library:

| User need | Candidate foods to compare | Context the card must show |
| --- | --- | --- |
| Protein within a tighter energy budget | Lean poultry, white fish, egg whites, lower-fat plain strained yogurt/cottage cheese, appropriate soy foods or protein supplements | Actual product/recipe protein and kcal; never claim identical values across preparations |
| Plant-based muscle support | Tofu, tempeh, edamame, soy products; varied legumes/grains and suitable complementary protein blends | Whole-day adequacy and source-specific evidence; soy trials do not prove every plant food is equivalent |
| Protein plus fiber | Beans, lentils, chickpeas | Fiber contribution; do not punish their carbohydrate content |
| Protein plus beneficial fats | Oily fish; nuts/seeds as part of meals | Energy density can serve a purpose; nuts are not interchangeable gram-for-gram with lean protein foods |
| Convenient gap filling | Whey, soy or another appropriately formulated protein product | Optional, not a prerequisite; label, allergens, formulation and actual dietary gap |

These are categories for database-backed comparison, not a researched numerical ranking of every listed food. A reviewed catalog is required before awarding food-specific achievements. Cost, tolerance, availability, preference and preparation also determine the best option for an individual.

## Concrete achievement proposals

All counts below are proposed UX thresholds, not medically validated doses.

- **Showing up:** 7 / 14 / 30 distinct days with a confirmed meal. Keep lifetime progress.
- **Finding your range:** a chosen number of sufficiently logged days meeting the accepted personal protein goal. Credit caps at the goal; extra grams earn no extra XP. A user check-in about log completeness improves context but does not make intake verified.
- **Across your day:** include a meaningful, plan-defined protein portion in the person's selected meals. Optional; no universal breakfast/lunch/dinner requirement or late-night penalty.
- **Protein know-how:** learn how amino acids and digestibility affect source selection, then build/review a suitable meal or combination. Initially educational; do not award a fabricated absorption score.
- **Fits your plan:** assemble a meal that fits both its assigned protein and energy allocation, only where those allocations are appropriate and explicitly accepted. Prefer this to “lowest calories wins.”
- **Explore your options:** try a new eligible protein source or a plant-protein recipe. Count meaningful servings, not garnishes; never require meat/dairy/fish for vegan users.

A weekly view could show three selected challenges, progress, and a concise “Why this matters” explanation with sources. Keep other dimensions available as optional challenges. A source card can independently show protein per serving, density, quality evidence and fiber/fat context. Do not compress them into an unvalidated 0–100 health score.

## Data and behavior requirements

The current app has protein, kcal, carbs and fat plus source labels. It lacks verified ingredient IDs, amino-acid/digestibility data, fiber, saturated fat, sodium and reliable preparation metadata. It can currently support logging milestones and clearly labeled estimated density; it cannot support a defensible individual absorption score or complete quality assessment.

Add curated food identity and provenance, nutrients needed for the chosen insight, portion/preparation, and separately sourced quality evidence. Distinguish photo-estimated, user-entered, label-linked and database-linked records; missing evidence must not count against the user. AI may identify candidate foods and explain curated findings. It must not invent DIAAS, leucine, digestibility, absorbed grams or a precision confidence percentage from a photo.

Reward confirmed actions once; exclude drafts/plans and deduplicate retries. Keep manual and photo logging equally eligible. Preserve cumulative progress through gaps. No bonus for excess intake, duplicate logs, more frequent app opening, buying supplements or unusually low calories. Support reduced motion and hiding motivational features. Evaluate adherence, user understanding, usability and unwanted pressure; engagement alone is not a health outcome.

Research on app gamification spans heterogeneous interventions and populations; it does not establish that our exact protein badges improve nutrition or muscle outcomes. Treat the achievement design as a product hypothesis to test, with nutrition review before release. [Systematic review of gamified health apps](https://pmc.ncbi.nlm.nih.gov/articles/PMC11701442/).

Recommended release order: consistency and accepted-target milestones first; sourced comparison cards and food-variety challenges second; flexible distribution challenges third. Add nutrient-quality achievements only when the data and eligibility rules support them. No application or Paper changes were made during this research.
