# Move

Private Android exercise app for personal use. Package id: `app.move.kineto`.

The app is intentionally local-only:

- no `INTERNET` permission
- no ads SDK
- no analytics SDK
- no Firebase/Sentry/billing dependencies
- bundled exercise GIFs from `assets/exercises`

## Phase 1 Behavior

Workouts are guided and timed:

- each exercise has repetitions, seconds per repetition, and position in the workout
- exercises can be moved up/down in the workout setup list
- repetitions and seconds per repetition can be adjusted before starting
- the runner speaks the exercise name
- it plays five countdown clicks, says "Go", then chimes at the configured repetition rhythm
- two-sided exercises pause halfway, say "Change side", count down again, then continue
- each exercise auto-advances when its timed repetitions finish
- the runner controls are icon-only: previous, repeat, pause/resume, next, finish
- finishing the last exercise automatically saves the workout to local history

## Build

Install Android Studio or a local Android SDK/JDK toolchain, then install JavaScript dependencies:

```powershell
npm install
```

Build:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The debug APK is produced under:

```text
android/app/build/outputs/apk/debug/
```

Install on a connected phone:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The debug build uses package id `app.move.kineto.debug`, so it can coexist with the eventual signed release build.

## Release Signing

Create a release keystore outside git:

```powershell
keytool -genkeypair -v -keystore C:\_____\_SECRETS\move-release.jks -alias move -keyalg RSA -keysize 4096 -validity 10000
```

Copy `android/keystore.properties.example` to `android/keystore.properties`, fill in the passwords, then build:

```powershell
cd android
.\gradlew.bat assembleRelease
```

The release APK is produced under:

```text
android/app/build/outputs/apk/release/
```

Install or upgrade:

```powershell
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Keep the same keystore forever. Android treats a build signed by a different key as a different trust line and will not install it over the existing release app.

## GitHub Releases

The workflow in `.github/workflows/android-release.yml` builds on tags named `v*`.

For signed release APKs in GitHub Actions, add these repository secrets:

- `MOVE_KEYSTORE_BASE64`: base64 contents of `move-release.jks`
- `MOVE_STORE_PASSWORD`
- `MOVE_KEY_ALIAS`
- `MOVE_KEY_PASSWORD`

Then tag and push:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

The workflow uploads `move-v0.1.0.apk` to the GitHub Release.

## CSV Export

The app exports session history to:

```text
/sdcard/Download/move/back-exercises.csv
```

Pull it into the health repo with:

```powershell
adb pull /sdcard/Download/move/back-exercises.csv C:\_____\_CODE\body\baseline\back-exercises.csv
```
