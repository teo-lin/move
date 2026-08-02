# Kineto Private App Plan

## Context

This is a clean-room private exercise app based on the local exercise library in this repo. It is not a fork of the closed Play Store package `com.vratsev.bpex`; it uses a new package id so it can be installed alongside the original app during testing.

Target users: me and my brother. No Google Play publishing is required.

## Phase 1 - Installable Private APK

Goal: produce a minimal APK that can be installed on Android phones from GitHub Releases or via ADB.

1. Use a native Android/Kotlin app structure.

   - Prefer native Android over Expo to avoid cloud build dependencies.
   - Keep the app fully local and easy to package as an APK.
   - Use the package id `app.move.kineto`.
2. Seed the app from local assets.

   - Use `assets/exercises/*.gif` as the bundled exercise media.
   - Generate structured exercise data from the existing 120-item catalog.
   - Keep exercise metadata in a reviewable source format.
3. Build the minimal app.

   - Exercise catalog screen.
   - Exercise detail screen with bundled GIF.
   - Hardcoded workout runner for at least the two current routines:
     - `PeSpate: abs`
     - `PatruLabe: upper body`
   - Local session history.
4. Sign APKs for private distribution.

   - Create one release keystore outside git, for example `C:\_____\_SECRETS\kineto-release.jks`.
   - Keep `keystore.properties` out of git.
   - Use the same signing key for all updates so Android can install upgrades cleanly.
5. Test install paths.

   - Debug install with ADB:
     ```powershell
     adb install -r app-debug.apk
     ```
   - Release install from a downloaded APK.
   - Confirm the app launches and data persists after restart.
6. Distribute through GitHub Releases.

   - Attach versioned APKs, for example `kineto-v0.1.0.apk`.
   - On phones, enable "Install unknown apps" for the browser or file manager used to open the APK.
   - Do not implement in-app update checks initially, to preserve the no-server-call rule.

## Phase 1 Acceptance Criteria

- APK builds locally.
- APK installs on the connected Android phone.
- App launches without network access.
- 120 bundled exercises are visible.
- At least one bundled GIF renders correctly.
- A workout can be completed.
- Completion creates a local history entry.
- History can be exported as CSV.

## Phase 2 - Incremental App Changes

### 0. Remove Server Communication, Ads, and Tracking

Because this is a clean-room app, start with none of these:

- no ads SDK
- no Firebase
- no Sentry
- no analytics
- no billing
- no remote config
- no push notifications
- no network permission unless explicitly needed

Check `AndroidManifest.xml` before every release. If the app does not need internet, it should not request `android.permission.INTERNET`.

### 1. European Calendar

Change calendar behavior and display:

- week starts on Monday
- dates display as `dd.MM.yyyy`
- week/month views match European expectations
- session history groups by local date

### 2. Extra Exercise Proof of Concept

Add one new exercise end to end:

- define metadata
- generate or create original visual media
- bundle the new image/GIF locally
- show it in the exercise catalog
- include it in a test routine
- complete a session containing it

### 3. Stats UI for `back-exercises.csv`

Implement a statistics/export screen that can produce the same core CSV currently maintained at:

`C:\_____\_CODE\body\baseline\back-exercises.csv`

Required format:

```csv
"Date","Workout","Completion","Duration"
```

Rows should be generated from the app's local session history, not from ADB UI scraping.

### 4. Easy Sync

Implement a simple no-server sync path first:

- export CSV to a predictable folder, such as `Download/kineto/back-exercises.csv`
- support Android share sheet if useful
- support ADB pull into the health repo

Target command:

```powershell
adb pull /sdcard/Download/kineto/back-exercises.csv C:\_____\_CODE\body\baseline\back-exercises.csv
```

Optional later: add a script in `C:\_____\_CODE\body\scripts` that pulls the exported CSV and merges it with existing metrics.

### 5. Add More Exercises and Routines

Use `C:\_____\_CODE\body\sessions.md` and the personal exercise plan as the source for routines.

Initial routines:

- Core-First A
- Core-First B
- PeSpate: abs
- PatruLabe: upper body

Later additions:

- band-based pull work
- glute and hip work
- thoracic mobility
- neck and upper-back mobility
- calisthenics progressions
- travel/light-equipment routines

Progression rules should respect the existing plan:

- core first
- no same activity on consecutive days
- do both sides for single-limb moves
- stop on sharp lumbar pain
- vertical pulling only after the core gate
- core gate: forearm plank at least 30 seconds and superman at least 20 seconds, pain-free

## Near-Term Milestone: v0.1.0

`v0.1.0` should be deliberately small:

- native Android app skeleton
- local-only permissions
- bundled 120-exercise catalog
- GIF rendering
- two starter workouts
- workout runner
- local history
- CSV export compatible with `baseline/back-exercises.csv`
- debug APK installed successfully on the phone
- release APK attached to a GitHub Release
