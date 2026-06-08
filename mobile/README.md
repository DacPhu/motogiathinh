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
Permissions (CAMERA, media) are merged from the Camera/ML-Kit plugins.

### Offline ML Kit model (recommended)
By default ML Kit downloads the model via Google Play Services on first use.
To **bundle** it (fully offline from install), add to `android/app/build.gradle`
`dependencies { … }`:
```gradle
implementation 'com.google.mlkit:barcode-scanning:17.3.0'
```

## iOS (build on macOS)
Prereqs: macOS + Xcode + CocoaPods.
```bash
cd ios/App && pod install && cd -
npx cap open ios             # → Xcode → run, or export .ipa for Sideloadly
```
`Info.plist` already declares camera + photo-library usage strings.

## Notes / known follow-ups
- `src/config.js` API base is a placeholder until the backend is deployed.
- Login uses the web overlay (themed) for now; a native-styled login is a nice-to-have.
- See `../docs/HANDOFF.md` for backend (Bearer) + deploy context.
