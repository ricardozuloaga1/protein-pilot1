# Field Notes implementation — 29 October 2026

## Implemented

- Shared ivory/forest/brass palette, fine separators, serif display typography and Manrope body text; simpler buttons, fields, notices, rows, tabs and profile controls throughout the app.
- Removed scenic full-screen backgrounds and automatic rounded-panel wrapping. Existing forms, onboarding, account/privacy/export, food editing, coach and loading/error states inherit the shared design system.
- Today: editorial heading, understated protein summary, nutrition row, journal with recipe illustrations or private uploaded photos, and a direct logging action.
- Plan: compact calendar, planned-versus-target total, ingredient quantities, inline swap controls and a disclosure for planning details. Generation, restrictions, rebuild, portion review and explicit logging remain connected to their existing API workflows.
- Progress: a calendar with unknown dates left blank, logged-day/target counts, average intake on logged days, and a live badge shelf.
- Twelve-badge collection with exact rule details. First six badges derive from confirmed server records; later six visibly say “Coming later · not yet earnable.” No simulated awards or fabricated bioavailability scores.
- Server `/v1/achievements` computes the first six rules across all retained confirmed history. Historical rolling-window achievements remain eligible after time passes. Corrections/deletion recompute evidence. No award notification ledger or animations yet.
- Clean transparent badge sprite, ingredient-matched recipe illustrations, and native scalable labels separate from imagery. Artwork is illustrative, not measurement evidence.

## Validation

- Backend TypeScript build/evaluation checks and 25 tests; frontend TypeScript and 11 tests.
- Expo lint and Prettier on changed UI files.
- Native simulator inspection: Today still shows 152/152 g and the three confirmed meal quantities; Plan preserves 152 g with the soy exclusion; Progress shows two logged days, one day at target, Seedling earned, Seven Days 2/7, Rhythm 2/5. Collection shows Mise en Place earned and later milestones unavailable.
- CUA detected the user actively navigating the simulator; automated navigation was stopped to leave control with them. Do not claim every form, modal, device size, or accessibility mode was exercised in this pass.
- Dedicated evaluation simulator and isolated SQLite database only; original development account/database untouched. Evaluation API continues to use deterministic AI fixtures; live OpenAI analysis was not repeated for this visual change.

## Deliberate implementation boundaries

This is a native implementation of the approved direction, not pixel-identical raster mockups. Native Georgia on iOS / serif on Android preserves cross-platform fallback without introducing a runtime font download. Layouts scroll and text scales. Custom motion, haptics, native glass, a new navigation architecture, day-completion tracking, and the six evidence-dependent badges are not included. Existing navigation behavior is preserved. Physical-device and Android visual verification remain outstanding.

## Assets

Built-in image generation was used, with no new API key:

- `assets/recipes/field-notes-recipes.png`: overhead 4×2 sheet showing seven catalog recipes plus an empty plate. Prompt specified the exact existing ingredient sets, no labels/props/garnish/sauce, warm ivory, soft daylight. RecipeArt displays the corresponding cell and labels it as an illustration.
- `assets/badges/field-notes-pins.png`: transparent 4×3 sprite preserving the approved twelve forest/ivory enamel and brass pins; all presentation text and background removed. BadgeArt displays one cell; text is rendered natively.
- `assets/badges/field-notes-collection.png`: original concept reference retained. The interface uses the transparent pins instead.

See `design/badges/FIELD-NOTES.md` for the approved rule definitions and design rationale. That document describes the proposal before this implementation; use this file for implementation status.
