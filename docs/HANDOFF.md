# HANDOFF — session checkpoint (2026-06-08)

Single entry point for whoever deploys / continues this work. Read this first,
then `CHANGELOG.md` for the per-feature detail.

## 0. Repo state — READ FIRST
- The project is **uncommitted** (the git repo at `chinhguestapp0706/` has no
  commits; `motogiathinh/` is untracked). **First action for the next dev:**
  review the working tree and make the initial commit on a branch (not the
  default branch) before deploying.
- Nothing here has been **deployed** and the **backend was not run locally**
  this session (no local Python — it only exists in the `python:3.14` container).
  All backend changes are code-review-verified, not executed. Frontend was
  verified by Babel parse + headless screenshots.

## 1. What shipped this session (detail → `CHANGELOG.md`)
- **Add-profile overhaul:** OCR removed → local **QR autofill**; doc slots 4→8
  (CCCD trước/sau, QR, Thẻ 3×4, Bằng lái cũ trước/sau); field changes
  (gender dropdown, Quê quán→**Nơi tạm trú**, Nơi cấp default, CCCD `123 456 789012`).
- **Collaborator (CTV) role:** new role below staff; many-to-many branch+class
  assignment (`user_branch_assignments`, `user_class_assignments`);
  **CTV-only** active-class access gating (staff unchanged); account dialog
  assignment UI (`TagSelect`).
- **CTV portal** (`frontend/screen-guest.jsx`): full vertical mobile UI rendered
  *instead of* the admin shell when `role==='collaborator'` (wired in `app.jsx`,
  loaded via `index.html`). List / detail / add-modal, draft persistence,
  device-back nav, animations, validation, image previews, duplicate guard.
- **QR scanner:** robust web decode = native BarcodeDetector → **multi-scale
  cascade (downscale denoises; ~1000px sweet spot) → ZXing(TRY_HARDER) → jsQR**,
  + **tiling**; uploads capped ≤2400px. **Live "capturer"** (`qr-capturer.js`):
  point-and-lock camera, decode-gated full-res still (A-minus on Chromium,
  gated video frame on iOS).

## 2. DEPLOY STEPS (pending, do in order)
1. **Migrations:** `docker compose exec backend alembic upgrade head`
   → applies `f1a2b3c4d5e6` (extra doc columns) then `a2b3c4d5e6f7`
   (user_assignment tables). Confirm both apply cleanly.
2. **Rebuild/restart** backend + frontend containers (new routers, models,
   screen scripts). *(Optional)* set `DIACHI_API_KEY` in backend env for
   address conversion at scale (see §6A).
3. **Remove dev-only artifacts** (see §3) — they must NOT ship.
4. **Smoke-test** §4 verification list.

## 3. Dev-only artifacts — DELETE before/at deploy (never ship)
In `frontend/`: `_preview_static.html`, `_dialog_preview.html`,
`_guest_preview.html`, `_qrlive.html`, `_qrtry.html`, and `_https/` (self-signed
cert+key). They're throwaway previews/test rigs. The local dev servers
(http :8123, https :8443) are session-bound background tasks — they die when the
agent session ends.
**KEEP:** `frontend/vendor/jsqr.min.js`, `frontend/vendor/zxing.umd.min.js`
(real deps), `frontend/qr-capturer.js`, `frontend/screen-guest.jsx`.

## 4. Post-deploy verification
- CTV login → sees only the vertical portal; staff/admin unchanged.
- CTV "Thêm học viên": QR autofill, gate (red outlines on THÊM), duplicate CCCD
  → "CCCD này đã có hồ sơ", create succeeds.
- CTV detail shows **existing photos** (needs the new wire `docs_<key>_url` +
  files route + cookie same-origin — verify a CTV can `GET /api/files/...`).
- Admin account dialog: create a "Cộng tác viên", assign branches + active
  classes; confirm scoping.
- `GET /api/constants/profile-docs` returns 8 docs with `required` flags.

## 5. BUG-CAUTIONS / gotchas
- **`students.cccd_number` is `unique=True`** at the DB. Duplicate create returns
  409 `duplicate_cccd` (frontend maps to Vietnamese). Existing NULLs are fine.
- **QR on web camera:** the in-browser "Chụp ảnh" (file-input camera) yields a
  degraded image on some phones (browser/OS controls it) — **library upload
  decodes better**; tell CTVs to prefer it. The real fix is native ML Kit (§6B).
  Decoding the FULL-res image fails; the cascade downscales (~1000px) — do not
  "optimise" by decoding at full res.
- **Camera needs a secure context** (HTTPS or localhost). The live capturer only
  works over HTTPS in browsers; production must be HTTPS. Native app is exempt.
- **`noiTamTru` reuses the `tinh_thanh` column** (Quê quán was dropped from the
  UI). `address`→`dia_chi`, `noiTamTru`→`tinh_thanh` in create + update.
- **`index.html` was edited** (frozen file) to load `screen-guest.jsx` and
  `qr-capturer.js` — intentional plumbing.
- **`Modal` gained an optional `footer` prop** (shell.jsx); `Input`/`Select`
  gained `success`/`invalid`; `Input` gained `disabled`. All optional/back-compat
  — admin modals untouched.
- **Draft persistence** saves only text fields + qrInfo to localStorage (photos
  can't be persisted). Failed QR scan clears only the QR-derived fields.
- **`CLAUDE.md`** previously said "two roles / no UserPermission table" — corrected
  (three roles; a UserPermission table does exist).
- OCR backend (`core/ocr.py`, `/api/ocr/cccd`, `ocr_service/`) is now **unused**
  but left in place (reusable). Remove only if confirmed dead.

## 6. NEXT — tasks A & B DONE (dev); device testing + deploy remaining
### A. Address-update service — DONE (this session)
Implemented as **old→new address conversion** (Vietnam 2025 admin reform) via
diachi.io — verified live (free tier).
- Backend proxy `POST /api/address/convert` (`routers/address.py`) → diachi.io
  `convert-batch`; config `DIACHI_API_URL` + optional `DIACHI_API_KEY`
  (`config.py`); registered in `main.py`. Sends `Origin: https://diachi.io` to
  pass diachi.io's server-side origin gate; **graceful passthrough** on failure.
- Frontend `data-loader.js api.convertAddress()` wired into QR scan in
  `screen-guest.jsx` (add + detail) and admin `modals.jsx`; converts
  `qrInfo.address` before save/display; portal detail re-scan PATCHes the new
  `address` (backend already maps `address`→`dia_chi`, `noiTamTru`→`tinh_thanh`).
- **DEPLOY:** optionally set `DIACHI_API_KEY` in backend env — without it the free
  tier is throttled to ~1 batch/3 min and skips complex merged addresses; buy a
  "Standard" key (~200k VND) and set the env to lift it.
- Follow-ups (optional): surface the `notSure` flag to the user; add a
  server-side conversion safety-net in `create_student` (watch double-charging /
  double-conversion of already-new addresses).

### B. Mobile apps (Capacitor) — DEV-DONE (this session); NEEDS DEVICE TESTING
Project: `mobile/` (Capacitor, CTV portal only). Build docs: `mobile/README.md`.
- **Precompiled** bundle: `mobile/build.mjs` compiles the CTV-portal JSX → `www/`
  (no Babel-in-browser), copies css/fonts/vendor, fetches React. `npm run build`.
- **Android debug APK builds** → `mobile/dist/motogiathinh-ctv-debug.apk` (18 MB).
  Toolchain used (installed under `C:\Users\User\mgt-android`): Temurin JDK 17,
  Android cmdline-tools, SDK platform-34 + build-tools 34, Gradle 8.2 (wrapper).
  `android/local.properties` + `android/gradle.properties` (`org.gradle.java.home`)
  are machine-local — adjust on other hosts. iOS scaffolded (build on macOS:
  `pod install` then Xcode; Info.plist usage strings added).
- **Auth = Bearer** (backend change in §1/§5): login returns `token`;
  `get_current_user` accepts `Authorization: Bearer`. Native stores it (Capacitor
  Preferences) and gates boot.
- **Scanner = ML Kit** (`mobile/src/native-bridge.js`) — full-res photo + on-device
  decode, JS-cascade fallback. NOTE: currently the **unbundled** (Play-Services)
  model; for fully-offline add the bundled gradle dep (see `mobile/README.md`).
- **CONFIG BLOCKER:** `mobile/src/config.js` `MGT_API_BASE` is a placeholder. The
  app can't log in until the backend is deployed (HTTPS), `MGT_API_BASE` is set to
  it, and `npm run build && npx cap sync` is re-run.
- **NOT verified:** runtime on a real device/emulator; login vs a live backend;
  ML Kit scan + camera + back-button + animations on-device; iOS build. See §6
  recommendations from the review.

## 7. Doc map
- `CHANGELOG.md` — dated, per-feature detail of everything above.
- `HANDOFF-add-profile-qr.md` — add-profile + QR + 8 slots.
- `HANDOFF-collaborator-role.md` — CTV role, assignment, access scoping.
- `RECOMMENDATIONS.md` — R1 (persist decoded QR payload) deferred upgrade.
