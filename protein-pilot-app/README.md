# Protein Pilot iOS app

Native Expo/React Native implementation of the Protein Pilot Paper screens, connected to the sibling `protein-pilot-backend` API. The interface uses Manrope, warm off-white backgrounds, forest-green actions, editable food estimates, and the Today / Plan / Log / Progress navigation.

## Ready to test

The dedicated **Protein Pilot** simulator (iPhone 17 Pro, iOS 26.0) is configured with Expo Go and signed in as the disposable local account `simulator@proteinpilot.test`. A banana fixture is available in its photo library. The existing logged banana was analyzed by OpenAI and confirmed through the app, not seeded directly into the database.

Simulator ID: `0FB84DC5-5270-47A3-855F-46B01048A6A5`.

1. Open **Log → Choose a photo** and select a food photo.
2. Review the photo-sharing consent and start analysis.
3. Review the returned foods; tap a food to adjust grams or nutrition.
4. Choose the meal type and time, then **Confirm & log meal**.
5. Check Today and Progress. Tap the saved meal to edit, favorite, re-log, or remove with undo.

The API key lives only in the backend's ignored `.env.local`. Never put an OpenAI key in `EXPO_PUBLIC_*`, app source, or a mobile bundle.

## Restart locally

Requires Node 22+, Xcode with the iOS 26 simulator, and dependencies installed with `npm ci` in each project.

Terminal one, in the sibling backend directory:

```sh
npm run build
npm start
```

Terminal two, in this app directory:

```sh
npx expo start --localhost --port 8081
```

Then open the configured simulator:

```sh
open -a Simulator
xcrun simctl boot 0FB84DC5-5270-47A3-855F-46B01048A6A5
xcrun simctl openurl 0FB84DC5-5270-47A3-855F-46B01048A6A5 'exp://127.0.0.1:8081?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1'
```

Skip `boot` if already booted. API defaults to `http://127.0.0.1:3100`. The app's `.env.example` documents its sole public configuration variable. The simulator can reach the host's loopback address; a physical device needs a reachable HTTPS API and a development build.

### Local email sign-in

SMTP is not configured: emails are private development previews, not delivered messages. Request a link through the app first, then run:

```sh
node scripts/open-local-signin.mjs simulator@proteinpilot.test 0FB84DC5-5270-47A3-855F-46B01048A6A5
```

The helper opens the newest local preview's single-use token without printing it. It uses the normal verification endpoint, not an authentication bypass. Request a new link if the previous link was consumed or expired. Production needs SMTP and an HTTPS email-link landing page/associated-domain handoff to the native app.

## Connected flows

| Area | Implemented behavior |
| --- | --- |
| Welcome and onboarding | Goal, profile, target, dietary preferences, real email-link verification, expired-link recovery |
| Today and journal | Empty/logged/target-complete states, date navigation, real totals, draft resume, offline outbox |
| Food logging | Camera/library permissions, consent, JPEG normalization, upload, analysis polling, retry/cancel, no-food/error states, review and portion editing |
| Manual food | Catalog search, favorites, per-100g nutrition and gram portions, meal type, date/time, notes |
| Saved meals | Edit with version checks, favorite, re-log, delete and undo |
| Planning | Seven-day starter lunches, swap/add slots, recipes, dietary settings; plans never count as intake |
| Progress | Week/month data, missing-day gaps, target counts, milestones and nutrition context |
| Pilot | Real OpenAI conversation with explicit context-sharing disclosure |
| Settings | Profile, goals, diet, reminders, consent, JSON export, support intake, sign-out and reauthenticated deletion |

The source Paper file is https://app.paper.design/file/01M5XHNW97XJQGDG3B3QRG7J9X/p-1-0. Backend `SCREEN-MAP.md` maps the design states to APIs. Shared native components implement repeated visual states rather than duplicating every artboard into a separate route.

## Verification

`npm run check` passes TypeScript and seven focused tests covering portions, timezone dates, stable idempotency keys, nested edit identity, and lost-response recovery for edit/draft/confirmation requests. The backend's separate suite has 15 passing integration tests.

Verified interactively in iOS Simulator on October 27, 2026:

- Four-step onboarding and single-use email-link sign-in.
- Native photo-library selection → live OpenAI analysis → editable banana portion → confirmation → correct Today totals.
- Meal name edit persisted without adding another meal; favorite creation succeeded.
- Seven-day plan generation and lunch swap persisted without changing intake totals.
- Progress showed the logged day and six unknown days, not fabricated zero intake.
- Pilot returned a live vegetarian dinner suggestion and retained the conversation.

Not yet device-verified: physical camera capture, reminder delivery, share-sheet destinations, and App Store/development-build behavior. Account deletion and several failure paths are covered at API level, not exhaustively driven through simulator UI. This is a local test build in Expo Go, not a signed standalone release or public deployment.

## Implementation notes and remaining release work

- Sessions, draft meals, cached profile and queued manual logs use SecureStore. Photo confirmation is explicit and retry-safe. Manual entries can queue offline; analysis and coach require the server.
- SDK 58 uploads use `expo/fetch` with `expo-file-system` File blobs. Picker images are converted to JPEG before upload. The server strips metadata and removes processed photos.
- Food estimates and the small starter catalog need broader nutrition evaluation before public launch. Plans are starter suggestions, and targets are selected by the user.
- Support submissions are stored, not emailed to a staffed support team. Configure support operations before launch.
- Local reminders are scheduled through the OS; remote push is not implemented. Test scheduling on a signed physical-device build.
- The current Expo CLI dependency tree reports a Zod 3 advisory. A forced audit fix would change the Expo toolchain; review a compatible Expo update before release. The backend uses patched Zod 4 independently. Metro is bound to localhost for this test setup.
- Configure production API hosting, SMTP/deep links, backups, privacy/retention, and release signing before distributing to users. Backend README describes those deployment boundaries.

The public banana test image is Evan-Amos's [Banana-Single.jpg](https://commons.wikimedia.org/wiki/File:Banana-Single.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); it is a simulator test fixture, not bundled product artwork.
