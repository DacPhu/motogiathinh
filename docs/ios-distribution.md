# Distributing the CTV iOS app — ad-hoc or TestFlight

This is the from-scratch runbook for getting a **signed iOS build** of the Moto Gia Thịnh CTV app
(`mobile/`, bundle id `vn.motogiathinh.ctv`) onto real devices. The build runs in CI —
**`.github/workflows/ios-distribute.yml`** (Actions → *Build iOS (ad-hoc / TestFlight)* → *Run
workflow*) — where you pick the **method**:

- **ad-hoc** — produces a `.ipa` installable on a **fixed set of devices** whose UDIDs are baked into
  the provisioning profile. You download the `.ipa` and install it yourself. Best for a handful of
  known devices.
- **testflight** — uploads an App Store-signed build to **App Store Connect / TestFlight**; testers
  install via the TestFlight app from an email/link. **No UDIDs.** Best when testers change often or
  you have more than a few.

The workflow is wired and ready; it just needs the signing secrets below, which only you can create
(they require an Apple Developer account). Until the secrets for the method you pick exist, the
workflow fails immediately on a preflight step naming what's missing — that's expected.

> **You need a paid Apple Developer Program membership ($99/yr).** Signing is impossible on a free
> Apple ID. Mac steps use **Keychain Access**; the rest are in the browser.
>
> **Don't have the account yet?** You can test on your own device **right now, for free** by
> sideloading an unsigned build with AltStore / Sideloadly — run the `ios-sideload.yml` workflow and
> see *"Sideload for testing"* in [`../mobile/README.md`](../mobile/README.md). The signed ad-hoc /
> TestFlight paths below are what you set up once the Developer Program is approved.

---

## Secrets this produces

Set these under **GitHub → repo → Settings → Secrets and variables → Actions → New repository
secret**. The shared four are needed for both methods; then add the set for the method(s) you use.

**Shared (both methods)**

| Secret | What it is |
|---|---|
| `IOS_DIST_CERT_P12_BASE64` | base64 of your Apple **Distribution** certificate **+ its private key** (`.p12`) |
| `IOS_DIST_CERT_PASSWORD` | the password you set when exporting the `.p12` |
| `IOS_TEAM_ID` | your 10-character Apple **Team ID** |
| `KEYCHAIN_PASSWORD` | any throwaway string (CI uses it for a temporary keychain) |

**ad-hoc only**

| Secret | What it is |
|---|---|
| `IOS_ADHOC_PROFILE_BASE64` | base64 of the **ad-hoc** `.mobileprovision` |

**testflight only**

| Secret | What it is |
|---|---|
| `IOS_APPSTORE_PROFILE_BASE64` | base64 of the **App Store** `.mobileprovision` |
| `ASC_KEY_ID` | App Store Connect API key **ID** |
| `ASC_ISSUER_ID` | App Store Connect API **issuer ID** |
| `ASC_KEY_P8_BASE64` | base64 of the App Store Connect API key (`.p8`) |

The provisioning profile's **name/UUID** are read out of the profile automatically in CI — not
secrets you set by hand.

---

## Shared setup (do this once, for either method)

### Step 0 — Enroll in the Apple Developer Program
1. <https://developer.apple.com/programs/enroll/> — enroll with your Apple ID ($99/yr).
2. <https://developer.apple.com/account> → **Membership details** → copy your **Team ID** (10 chars).
   → secret **`IOS_TEAM_ID`**.

### Step 1 — Register the App ID
<https://developer.apple.com/account/resources/identifiers/list> → **+** → **App IDs → App** →
description `Moto Gia Thinh CTV`, Bundle ID **Explicit** = `vn.motogiathinh.ctv` (must match
`mobile/capacitor.config.json`). No capabilities needed. Register.

### Step 2 — Apple Distribution certificate → `.p12` (used by BOTH methods)
On your **Mac**:
1. **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority** →
   enter your email, **Saved to disk** → save the `.certSigningRequest`.
2. <https://developer.apple.com/account/resources/certificates/list> → **+** → **Apple Distribution**
   → upload the CSR → **Download** `distribution.cer`.
3. Double-click `distribution.cer` to add it to your **login** keychain.
4. Keychain Access → **login → My Certificates** → find **Apple Distribution: <Team>**; expand it to
   confirm a **private key** is nested underneath.
5. Right-click it → **Export → Personal Information Exchange (.p12)** → save `dist.p12`, set a
   password. → that password is **`IOS_DIST_CERT_PASSWORD`**.
6. Encode + copy: `base64 -i dist.p12 | pbcopy` → paste into **`IOS_DIST_CERT_P12_BASE64`**.

Also pick any string for **`KEYCHAIN_PASSWORD`** (e.g. a random value) and add it now.

---

## Path A — ad-hoc

### A1 — Register your test devices (UDIDs)
For each device: plug into the Mac → **Finder** → select the device → click under its name until
**UDID** shows → right-click → **Copy UDID**. Then
<https://developer.apple.com/account/resources/devices/list> → **+** → iOS → paste name + UDID →
Register. (Adding a device later means regenerating the profile below + re-running.)

### A2 — Create the ad-hoc provisioning profile
<https://developer.apple.com/account/resources/profiles/list> → **+** → **Distribution → Ad Hoc** →
App ID `vn.motogiathinh.ctv` → the Apple Distribution cert (Step 2) → select all your devices → name
it (e.g. `MotoGiaThinh CTV AdHoc`) → Generate → **Download** the `.mobileprovision`.

### A3 — Set the ad-hoc secret
`base64 -i MotoGiaThinh_CTV_AdHoc.mobileprovision | pbcopy` → **`IOS_ADHOC_PROFILE_BASE64`**.

### A4 — Build + install
Actions → *Build iOS (ad-hoc / TestFlight)* → Run workflow → **method: `ad-hoc`** → download the
**`motogiathinh-ctv-ios-ad-hoc`** artifact → `MotoGiaThinhCTV-ad-hoc.ipa`. Install on a **registered**
device via **Apple Configurator 2** (drag the `.ipa` on), [Diawi](https://www.diawi.com/), or
Xcode → *Devices and Simulators*. Devices not in the profile will refuse to install.

---

## Path B — TestFlight

### B1 — Create the app record in App Store Connect
<https://appstoreconnect.apple.com> → **Apps → +** → New App → platform iOS → pick the bundle ID
`vn.motogiathinh.ctv` → fill name/primary language/SKU → Create. (TestFlight needs the app to exist;
you do **not** need to submit it for sale.)

### B2 — Create the App Store provisioning profile
<https://developer.apple.com/account/resources/profiles/list> → **+** → **Distribution → App Store
Connect** (a.k.a. "App Store") → App ID `vn.motogiathinh.ctv` → the Apple Distribution cert (Step 2)
→ name it (e.g. `MotoGiaThinh CTV AppStore`) → Generate → **Download**.
`base64 -i MotoGiaThinh_CTV_AppStore.mobileprovision | pbcopy` → **`IOS_APPSTORE_PROFILE_BASE64`**.

### B3 — Create an App Store Connect API key (for uploading)
App Store Connect → **Users and Access → Integrations → App Store Connect API** → **+** → name it,
access **App Manager** → Generate → **Download** the `AuthKey_XXXXXX.p8` (downloadable **once**).
- The **Key ID** (next to the key) → **`ASC_KEY_ID`**.
- The **Issuer ID** (top of the keys page) → **`ASC_ISSUER_ID`**.
- `base64 -i AuthKey_XXXXXX.p8 | pbcopy` → **`ASC_KEY_P8_BASE64`**.

> Alternative to the API key: an Apple ID + app-specific password works with `altool` too, but the
> API key is the recommended, 2FA-proof option and what this workflow uses.

### B4 — Build + distribute
Actions → *Build iOS (ad-hoc / TestFlight)* → Run workflow → **method: `testflight`**. The build
uploads itself to App Store Connect; after a few minutes of processing it shows up under your app →
**TestFlight**. Add internal testers (or an external group) there; they install via the **TestFlight**
app on their device. The `.ipa` is also kept as the `motogiathinh-ctv-ios-testflight` artifact.

---

## Troubleshooting

- **Preflight: "Missing required secret(s) for method 'X': …"** — that secret isn't set/empty for the
  method you chose. Names are case-sensitive.
- **`No signing certificate "Apple Distribution" found`** — the `.p12` lacked the private key or was
  the wrong cert. Redo Step 2 on the Mac that holds the key (the certificate must show a nested key).
- **`Provisioning profile doesn't include signing certificate`** — the profile was built against a
  different cert than the `.p12`. Regenerate it (A2 / B2) selecting the Step 2 cert.
- **(ad-hoc) install refused / "untrusted"** — that device's UDID isn't in the profile. Add it (A1),
  regenerate (A2), update `IOS_ADHOC_PROFILE_BASE64`, re-run.
- **(testflight) `redundant binary upload` / build number already used** — App Store Connect rejects
  duplicate build numbers. This workflow uses the GitHub **run number** as the build number, so just
  re-run (the next run number is unique).
- **(testflight) build stuck "Missing Compliance"** — handled: `patch-native.mjs` sets
  `ITSAppUsesNonExemptEncryption=false` (the app only uses standard HTTPS), so no per-build encryption
  question. If you add non-standard crypto later, revisit this.
- **(testflight) `No suitable application records were found`** — the app record (B1) doesn't exist or
  the bundle id differs. Create/fix it.
- **Cert/profile expired** — Apple Distribution certs last ~1 year; profiles match the cert. Renew via
  Step 2 + A2/B2 and update the base64 secrets.

## ad-hoc vs TestFlight — which to use

| | ad-hoc | TestFlight |
|---|---|---|
| Device registration | each UDID, up front | none |
| Tester limit | 100 devices / type / year | 100 internal + 10,000 external |
| Adding a tester | regenerate profile + rebuild | invite by email |
| Apple review | none | light (external testers only) |
| Build lifetime | until cert/profile expires | 90 days |
| Install | Configurator / Diawi | TestFlight app |

Start with **ad-hoc** for a few known phones; move to **TestFlight** once the tester list grows or
UDID juggling gets old. Both share the same certificate and CI pipeline — only the profile, export
method, and (for TestFlight) the upload differ.
