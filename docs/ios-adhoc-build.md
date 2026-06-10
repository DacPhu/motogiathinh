# Building the CTV app as an ad-hoc iOS IPA

This is the from-scratch runbook for producing a **signed ad-hoc `.ipa`** of the Moto Gia Thịnh
CTV app (`mobile/`, bundle id `vn.motogiathinh.ctv`) — an iOS build installable on a **fixed set of
devices** whose UDIDs are baked into the provisioning profile, distributed outside the App Store.

The actual build runs in CI: **`.github/workflows/ios-adhoc.yml`** (Actions → *Build iOS ad-hoc
IPA* → *Run workflow*). The workflow is wired and ready; it just needs the five signing secrets
below, which only you can create because they require an Apple Developer account. Until they exist,
the workflow fails immediately on a preflight step telling you which secrets are missing — that's
expected, not a bug.

> **You need a paid Apple Developer Program membership ($99/yr).** Ad-hoc signing is impossible on a
> free Apple ID. Steps 0–4 are done **on a Mac** (you have one); steps 5–7 are done in the browser.

---

## The five secrets this produces

Set these under **GitHub → repo → Settings → Secrets and variables → Actions → New repository
secret**. The workflow reads exactly these names:

| Secret | What it is |
|---|---|
| `IOS_DIST_CERT_P12_BASE64` | base64 of your Apple **Distribution** certificate **+ its private key** (`.p12`) |
| `IOS_DIST_CERT_PASSWORD` | the password you set when exporting the `.p12` |
| `IOS_ADHOC_PROFILE_BASE64` | base64 of the **ad-hoc** `.mobileprovision` |
| `IOS_TEAM_ID` | your 10-character Apple **Team ID** |
| `KEYCHAIN_PASSWORD` | any throwaway string (CI uses it for a temporary keychain) |

The provisioning profile's **name** and **UUID** are read out of the profile automatically in CI, so
they are *not* secrets you set by hand.

---

## Step 0 — Enroll in the Apple Developer Program

1. Go to <https://developer.apple.com/programs/enroll/> and enroll with your Apple ID ($99/yr).
2. Once active, open <https://developer.apple.com/account> → **Membership details** and copy your
   **Team ID** (10 chars, e.g. `A1B2C3D4E5`). → this becomes secret **`IOS_TEAM_ID`**.

## Step 1 — Register the App ID

1. <https://developer.apple.com/account/resources/identifiers/list> → **+** → **App IDs** → **App**.
2. Description: `Moto Gia Thinh CTV`. Bundle ID: **Explicit** → `vn.motogiathinh.ctv` (must match
   `mobile/capacitor.config.json` exactly).
3. Capabilities: none required (the app uses camera/photos via Info.plist usage strings, not an
   entitlement). Register.

## Step 2 — Register your test devices (UDIDs)

Ad-hoc builds only install on devices listed here. For each iPhone/iPad that needs the app:

1. **Get the UDID:** plug the device into your Mac → open **Finder** → click the device in the
   sidebar → click the line under the device name (it cycles to show **UDID**) → right-click →
   **Copy UDID**. (Or use Apple Configurator 2.)
2. <https://developer.apple.com/account/resources/devices/list> → **+** → platform **iOS**, paste a
   name + the UDID → Continue → Register. Repeat for every device.

> Adding a device later means **regenerating the profile** (Step 4) and re-running the workflow.

## Step 3 — Create the Apple Distribution certificate (and export it as `.p12`)

Do this **on your Mac**:

1. **Generate a signing request:** open **Keychain Access** → menu **Keychain Access → Certificate
   Assistant → Request a Certificate From a Certificate Authority**. Enter your email, leave CA
   email blank, choose **Saved to disk**. Save `CertificateSigningRequest.certSigningRequest`.
2. <https://developer.apple.com/account/resources/certificates/list> → **+** → **Apple
   Distribution** → Continue → upload the `.certSigningRequest` → Continue → **Download** the
   `distribution.cer`.
3. **Double-click `distribution.cer`** to install it into your login keychain.
4. In **Keychain Access** → **login** keychain → **My Certificates**: find **Apple Distribution:
   <Your Team>**. Expand it — it must show a **private key** underneath (if not, you generated the
   CSR on a different Mac; redo Step 3 here).
5. **Right-click the certificate → Export → File Format: Personal Information Exchange (.p12)** →
   save `dist.p12` → set an export password.
   → that password becomes secret **`IOS_DIST_CERT_PASSWORD`**.
6. Encode it for GitHub:
   ```bash
   base64 -i dist.p12 | pbcopy   # now paste into the secret
   ```
   → paste into secret **`IOS_DIST_CERT_P12_BASE64`**.

## Step 4 — Create the ad-hoc provisioning profile

1. <https://developer.apple.com/account/resources/profiles/list> → **+** → **Distribution → Ad
   Hoc** → Continue.
2. App ID: **`vn.motogiathinh.ctv`** → Continue.
3. Certificate: select the **Apple Distribution** cert from Step 3 → Continue.
4. Devices: select **all** the devices from Step 2 → Continue.
5. Name it (e.g. `MotoGiaThinh CTV AdHoc`) → Generate → **Download** the `.mobileprovision`.
6. Encode it for GitHub:
   ```bash
   base64 -i MotoGiaThinh_CTV_AdHoc.mobileprovision | pbcopy
   ```
   → paste into secret **`IOS_ADHOC_PROFILE_BASE64`**.

## Step 5 — Set the secrets in GitHub

Add all five under **Settings → Secrets and variables → Actions**:
`IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_ADHOC_PROFILE_BASE64`, `IOS_TEAM_ID`, and
`KEYCHAIN_PASSWORD` (invent any value for the last one, e.g. a random string).

## Step 6 — Run the build

GitHub → **Actions** → **Build iOS ad-hoc IPA** → **Run workflow** (optionally set the marketing
version; build number is the run number automatically). When it finishes, open the run → download
the **`motogiathinh-ctv-adhoc-ipa`** artifact → unzip to get `MotoGiaThinhCTV-adhoc.ipa`.

## Step 7 — Install on a registered device

The device **must** be one of the UDIDs in the profile, or it will refuse to install. Pick one:

- **Apple Configurator 2** (free, Mac App Store): plug in the device → drag the `.ipa` onto it.
- **A share service** like [Diawi](https://www.diawi.com/) or InstallOnAir: upload the `.ipa`, open
  the resulting link on the device, install. (Convenient for remote testers.)
- **Xcode → Window → Devices and Simulators**: drag the `.ipa` into *Installed Apps*.

Also set **`mobile/src/config.js` → `MGT_API_BASE`** to the deployed HTTPS backend before building —
native can't use same-origin (see `mobile/README.md`).

---

## Troubleshooting

- **Preflight fails "Missing required secret(s): …"** — that secret isn't set (or is empty). Re-check
  Step 5; names are case-sensitive.
- **`No signing certificate "Apple Distribution" found` / `errSecInternalComponent`** — the `.p12`
  didn't include the private key, or the wrong cert was exported. Redo Step 3 on the Mac that holds
  the key, confirming the disclosure triangle shows a private key.
- **`Provisioning profile doesn't include signing certificate`** — the profile (Step 4) was built
  against a different cert than the one in the `.p12`. Regenerate the profile selecting the Step 3
  cert.
- **App installs but device says "untrusted" / won't launch, or install is rejected** — that
  device's UDID isn't in the profile. Add it (Step 2), regenerate the profile (Step 4), update
  `IOS_ADHOC_PROFILE_BASE64`, re-run.
- **Archive fails on a CocoaPods target signing error** — rare with Capacitor 6, but if it happens
  the fix is to stop CI from forcing the app's profile onto pod targets. Add a `post_install` hook
  to the generated Podfile in the workflow (after `cap add ios`, before `pod install`) that clears
  signing on pods:
  ```ruby
  post_install do |installer|
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
      end
    end
  end
  ```
- **Cert/profile expired** — Apple Distribution certs last 1 year, profiles match the cert. Renew
  via Steps 3–4 and update the two base64 secrets.

## Alternative: TestFlight (no UDID juggling)

If managing device UDIDs becomes painful, **TestFlight** (via App Store Connect) distributes to
testers by email/link with **no UDID registration** and up to 10,000 external testers. It needs an
App Store Connect record + an App Store provisioning profile (or automatic signing via an App Store
Connect API key) instead of the ad-hoc profile, and builds are uploaded rather than downloaded as an
`.ipa`. Worth switching to if the tester list grows; ad-hoc is simpler for a handful of known
devices.
