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

### Signed builds — ad-hoc or TestFlight (CI)
To get a signed build onto real devices, run the **Build iOS (ad-hoc / TestFlight)** GitHub Actions
workflow (`.github/workflows/ios-distribute.yml`) and pick a method:
- **ad-hoc** — a `.ipa` installable on specific registered devices (UDIDs), downloaded as an artifact.
- **testflight** — uploaded to App Store Connect / TestFlight for invite-by-email testers (no UDIDs).

The one-time Apple setup (Developer Program, distribution certificate, the provisioning profile(s),
and the GitHub secrets each method needs) is documented step-by-step in
[`../docs/ios-distribution.md`](../docs/ios-distribution.md).

### Sideload for testing — free, no Apple account (while you wait)
No $99 Apple Developer account yet? Run the **Build iOS unsigned IPA (sideload)** workflow
(`.github/workflows/ios-sideload.yml`) — it needs **no secrets and no Apple account**. It produces an
**unsigned device `.ipa`**; download the `motogiathinh-ctv-ios-unsigned-ipa` artifact and install it
with a **free Apple ID** using either:
- **[AltStore](https://altstore.io/)** — run AltServer on a Mac/PC; it installs and auto-refreshes the app, or
- **[Sideloadly](https://sideloadly.io/)** — plug in the device, drop in the `.ipa`, sign in with your Apple ID.

Both re-sign the app with your Apple ID at install. Caveat: free-Apple-ID apps **expire after 7 days**
and must be re-signed (AltStore can auto-refresh on the same Wi-Fi); max 3 sideloaded apps per device.
Camera, photos, and QR scanning all work. Once your paid account is approved, switch to the signed
ad-hoc / TestFlight paths above for longer-lived, easier distribution to other testers.

## Notes / known follow-ups
- `src/config.js` API base is a placeholder until the backend is deployed.
- Login uses the web overlay (themed) for now; a native-styled login is a nice-to-have.
- See `../docs/STATUS.md` for the current checkpoint (what's live, what's pending).
