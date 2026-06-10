# Moto Gia Thịnh — CTV mobile app (Capacitor)

Native Android + iOS wrapper of the **CTV portal** (the web `screen-guest.jsx`
vertical UI). The web source is **precompiled** into `www/` (no Babel-in-browser);
Capacitor loads that bundle and adds native QR scanning, camera, and token auth.

## What it includes
- The full CTV portal: login, student list, detail/edit, add-student (QR autofill,
  8 doc slots, address conversion, validation, draft persistence, animations).
- **Auth:** Bearer token (login returns a token; stored via Capacitor Preferences;
  sent as `Authorization: Bearer`). No cookies on native.
- **QR:** native **ML Kit** barcode scanning (`window.MGT_CAPTURE`) — takes a
  full-res photo and decodes it on-device; falls back to the JS cascade.
- **Photos:** native Camera/Library prompt (`window.MGT_NATIVE_PICK`).

## One-time config
Edit **`src/config.js`** → set `MGT_API_BASE` to your deployed HTTPS backend
(the app calls `<MGT_API_BASE>/api/...`). Native cannot use same-origin.

## Build the web bundle
```bash
cd mobile
npm install
npm run build      # compiles JSX → www/, copies assets, fetches React
npx cap sync       # copies www/ into android/ + ios/, updates plugins
```
Re-run `npm run build && npx cap sync` after any change to the web source.

## Android
Prereqs: JDK 17 + Android SDK (platform 34, build-tools 34).
```bash
npx cap open android         # → Android Studio → Run / Build APK
# or headless:
cd android && ./gradlew assembleDebug
#   → app/build/outputs/apk/debug/app-debug.apk
```
No CAMERA permission is declared, and none is needed: `@capacitor/camera`
delegates capture to the system camera app via `ACTION_IMAGE_CAPTURE` (it only
requires CAMERA at runtime if you explicitly declare it). The QR decode reads a
file (`readBarcodesFromImage`), so it needs no camera permission either.

### Offline ML Kit model — already bundled ✔
The QR scanner is **already fully offline**. `@capacitor-mlkit/barcode-scanning`
v6.2.0 ships the **bundled** model (`com.google.mlkit:barcode-scanning:17.2.0`),
and the app uses `readBarcodesFromImage`, which uses it. The `.tflite` models are
inside the APK (`assets/mlkit_barcode_models/`) — verified. Nothing to add.
(The unbundled Play-Services artifact `play-services-mlkit-barcode-scanning` is
**not** used.)

## iOS (build on macOS)
Prereqs: macOS + **Xcode** (full app, not just Command-Line-Tools) + CocoaPods
(`sudo gem install cocoapods`).
```bash
npm run build
npx cap add ios              # if ios/ doesn't exist yet
npm run patch-native         # injects camera/photo Info.plist usage strings
cd ios/App && pod install && cd -
npx cap open ios             # → Xcode → run, or export .ipa for Sideloadly
```
`npm run ios` chains build → sync → patch-native → open. The camera +
photo-library usage strings are injected by **`patch-native.mjs`** (a fresh
`cap add ios` does NOT include them — without them iOS crashes on camera access).

### Signed ad-hoc IPA (CI)
To get a signed `.ipa` installable on real (registered) devices without the App Store, run the
**Build iOS ad-hoc IPA** GitHub Actions workflow (`.github/workflows/ios-adhoc.yml`). The one-time
Apple setup — Developer Program, distribution certificate, ad-hoc provisioning profile, and the five
GitHub secrets it needs — is documented step-by-step in
[`../docs/ios-adhoc-build.md`](../docs/ios-adhoc-build.md).

## Notes / known follow-ups
- `src/config.js` API base is a placeholder until the backend is deployed.
- Login uses the web overlay (themed) for now; a native-styled login is a nice-to-have.
- See `../docs/HANDOFF.md` for backend (Bearer) + deploy context.
