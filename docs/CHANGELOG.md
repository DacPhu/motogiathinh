# Changelog

Reverse-chronological. Each entry links its detailed handoff. Nothing below is
deployed yet — see "Pending deploy".

## 2026-06-08

### Mobile app — CTV portal (Capacitor; Android APK builds)
- `mobile/` Capacitor project wrapping the CTV portal. **Precompiled** bundle (`build.mjs`: JSX→JS, copies assets, fetches React — no Babel-in-browser). Android + iOS projects scaffolded (6 plugins); **Android debug APK builds locally** → `mobile/dist/motogiathinh-ctv-debug.apk` (18 MB, Gradle 8.2 / JDK 17 / SDK 34).
- **Bearer auth** for native: `/auth/login` now also returns `token`; `get_current_user` accepts `Authorization: Bearer` (cookie still works for web). `data-loader.js` token mode — stores token (Capacitor Preferences), boot-gate, Bearer on every call + uploads, authed image fetch; `screen-guest.jsx` `GuestAuthedImage` fetches server images with the header on native.
- **Native bridge** (`mobile/src/native-bridge.js`): ML Kit barcode scan (`MGT_CAPTURE` — full-res photo + on-device decode, JS-cascade fallback), Camera prompt for all photo slots (`MGT_NATIVE_PICK`), Preferences token store. Web seams unchanged (no-op off-native).
- **Config:** `mobile/src/config.js` `MGT_API_BASE` is a placeholder — must point at the deployed HTTPS backend, then rebuild.
- Verified: bundle boots (login renders), APK compiles. NOT yet run on a device; iOS build needs macOS.

### Address conversion — diachi.io (old→new, 2025 admin reform)
When a CCCD QR yields an address it's now converted from the **old** administrative form to the **new** (post-2025-merger) form before use. Verified live: "…Hoà Khánh Bắc, Liên Chiểu, Đà Nẵng" → "…Phường Liên Chiểu, Thành phố Đà Nẵng".
- **Backend proxy** `POST /api/address/convert` (`routers/address.py`) → diachi.io `convert-batch`. Sends `Origin: https://diachi.io` (the service gates foreign origins server-side with `CORS_BLOCKED`) + optional `key`. Graceful **passthrough** (returns originals, `notSure`) on rate-limit / invalid-key / network. Config: `DIACHI_API_URL`, `DIACHI_API_KEY` (`config.py`); router registered in `main.py`.
- **Free tier works** but is throttled to ~1 batch / 3 min and skips complex merged addresses; set `DIACHI_API_KEY` (buy "Standard", ~200k VND) to lift it.
- **Frontend** `data-loader.js api.convertAddress()` (never throws); wired into QR scan in `screen-guest.jsx` (add modal + detail) and admin `modals.jsx` add-profile — `qrInfo.address` is converted before it's saved/displayed; portal detail re-scan also PATCHes the converted `address`.

### CTV portal — shorter add dialog + capsule feedback
- Add modal: **removed the "Thêm học viên" heading** (and the top X); close is now a bottom **HỦY** (ghost) next to **THÊM**, both `flex:1` (≈half-width each) with taller padding — big tap targets for older users. Done via a new optional `Modal` `footer` prop (`shell.jsx`; admin modals unaffected).
- Field feedback moved into the `Input`/`Select` atoms (`success`/`invalid` → green/red **capsule border + tint**, matching HỌ TÊN); removed the misaligned wrapper `outline` rings.

### CTV portal — add-modal field polish
- **Class selector ("LỚP")** moved from the footer into the dialog body, at the top above HỌ TÊN, using the shared `Select` (same size/style as other fields).
- **Green "filled" outline** added to the class selector and SĐT (and applied via a `ring()` helper that's green when filled / red when missing after THÊM) — consistent with the already-green slots/name box.
- **Hạng bằng pill** active colour changed cyan → green (`--neon-lime`) for consistency across the modal.
- A failed QR scan now wipes only the QR-derived fields (name + QR data + QR image), keeping manually-entered SĐT/hạng/lớp and other photos.

### CTV portal — image previews + QR re-scan reset
1. **Image previews in slots** — picked images already preview in the add modal; the detail view now shows **existing** photos too. Backend `_to_wire` exposes `docs_<key>_url` as a browser-fetchable `/api/files/students/<id>/<filename>` path; `files.py` now lets **collaborators** fetch files for students in their assigned active classes (was branch-only → would 403 a CTV); `data-loader` stores the `/api/files` path on upload; `GuestAuthedImage`/`PhotoSlot`/`QrSlot` render `src`.
2. **QR re-scan on every new image** (already wired via `onPick`); on a **failed** scan the QR slot shows the error **inside the slot** and the add modal **wipes all filled data** (name/SĐT/hạng/lớp/ảnh) to force a clean redo. (Detail just reverts the new QR pick + in-slot error.) Removed the duplicate QR error banner (kept the dialog from lengthening).

### CTV portal — add-modal validation pass (7 tweaks)
`frontend/screen-guest.jsx`:
1. QR slot already uses the QR/capturer decode logic (confirmed).
2/3. **THÊM is always clickable**; on click with gaps it sets `showErrors` → missing required fields get a **red outline** and the **"Còn thiếu: …"** tip shows (red) — the tip now appears ONLY after a failed THÊM (no permanent hint).
4. **SĐT must be a full 10 digits** — otherwise flagged ("SĐT đủ 10 số") and outlined.
5. Slot labels → "Bằng lái cũ mặt trước" / "Bằng lái cũ mặt sau".
6. QR-filled overlay chip → "Mã QR <số>" (was "CCCD <số>").
7. Outlines use CSS `outline` (no layout height) and the always-on hint was removed, so the modal doesn't grow.

### CTV portal — UX pass (9 tweaks)
`frontend/screen-guest.jsx` (+ backend `students.py` for #5):
1. **Unified, scroll-frozen header** — outer column `100dvh`/`overflow:hidden`, `<main>` the sole scroller; `<header>` fixed `minHeight:72` + centered so the account bar and the "QUAY LẠI" bar are the same height.
2. **Uniform photo slots** — removed the full-width QR/chân dung; all 6 slots are equal cells (add modal + detail).
3. **Green success border** on every filled slot (lime) + QR-fill name box.
4. **"Lưu thay đổi"** enables on any edit (phone/hạng bằng/photo) and disables when reverted to the saved state.
5. **No duplicate profiles** — client guard (CCCD already in `MGT_DATA.students` → Vietnamese error) + **backend** 409 `duplicate_cccd` on `cccd_number` (`students.py create_student`); submit maps it to "CCCD này đã có hồ sơ…".
6. **Draft persistence** — on close the add-modal text fields + qrInfo save to `localStorage['mgt_guest_add_draft']`, restored on open, cleared on successful submit (photos not persisted).
7. **Completion gate** — requires name/phone/hạng/lớp/QR + CCCD trước/sau + chân dung; bằng lái optional; inline "Còn thiếu: …" hint.
8. **Device Back wired** — history pushState on modal/detail open; popstate closes modal → returns to list (never leaves the site); manual closes call `history.back()`.
9. **Navigation animations** — detail slides in from the right, list returns (mgt-slide-in-*), for clear motion cues.

### Live QR capturer — committed (web; A-minus where supported)
- `frontend/qr-capturer.js` (`window.MGT_CAPTURE.open()`) — a fullscreen live camera scanner (vendored ZXing continuous decode + aiming reticle). On lock it grabs a **full-resolution still via `ImageCapture.takePhoto()`** (Chromium/Android = **A-minus**), **decode-gates** it via downscaled copies, and saves only a frame that re-decodes → **the saved image is provably scannable**. On iOS Safari (no `ImageCapture`) it falls back to a **decode-gated video frame** (C+gate). Requires a secure context (HTTPS/localhost) for camera.
- **Dual capture, by design:** library/upload (full-res Camera-app photos → multi-scale cascade) is the **primary/batch** path = Option **B**; the live capturer is the **rescue** path for a failing image. The QR slot (`screen-guest.jsx`) opens the capturer with a "Chọn từ thư viện" fallback; if the capturer isn't loaded it reverts to the file picker.
- Committed (removed the trial/teardown scaffolding). Dev-only test rig kept locally: `_qrlive.html` + `_https/` self-signed cert + the 8443 HTTPS server (not part of the app; remove before push).
- Open compromise (accepted): on **iOS web** the artifact is a gated video frame, not full-res — the **native (Capacitor) build with ML Kit** is the endgame that makes iOS capture full-res too. Honest option map: web = B (library) + C+gate→A-minus (capturer); mobile target = A-minus.

### QR scanner upgrade (web) — Option B
- `window.MGT_QR.scanFile` (shared by admin add-profile + CTV portal) now decodes at **full resolution** in order: native **BarcodeDetector** → **ZXing `@zxing/library` with TRY_HARDER** (vendored `frontend/vendor/zxing.umd.min.js`, offline) → **jsQR** (last resort, both inversions). Removed the old 1600px pre-decode downscale (a major cause of failures, esp. on iOS Safari where BarcodeDetector is absent).
- Decode-gate unchanged (callers accept only when `fields.idNumber` decodes) → the saved QR image is provably scannable.
- New `_capImage` helper downsizes uploaded photos to ≤2400px long-edge / JPEG q0.9 in `uploadStudentDoc` (all slots, admin + portal) — keeps big re-scan margin, smaller files.
- Photo source confirmed for **all** slots: plain `accept="image/*"` (no `capture` attr) → OS sheet offers **Chụp ảnh + Thư viện + Tệp**, all full-res; native (Capacitor) will use Camera `Prompt`.
- Deferred: **R1** (persist decoded payload) in `docs/RECOMMENDATIONS.md`; **mobile** scanner = ML Kit (bundled, offline) with the Capacitor wrap.

## 2026-06-07

### CTV portal — phase 2: native vertical UI (matches the guest-app)
- New `frontend/screen-guest.jsx` — a vertical, mobile-first `GuestApp` rendered **instead of** the admin shell when `role === collaborator` (wired in `app.jsx`; script added to `index.html`). Faithfully mirrors the standalone guest-app: user chip (name · "Cộng tác viên" · N hồ sơ) + theme toggle, big "Thêm học viên" card, student list (gradient avatars + mono phone), detail/edit (hero + SĐT + hạng bằng A1/A + CCCD trước/sau + QR + chân dung), add modal with QR-autofill + success popup, bottom toast host.
- Built against **our** state: shared atoms (Icon/Avatar/Input/Select/Button/Modal/Theme), `window.MGT_DATA`, **local** `window.MGT_QR.scanFile` (no backend OCR), our doc keys (`cccd/cccdBack/cccdQR/the3x4`), `createStudent({form,docs,profileComplete})`. Class picker limited to the CTV's assigned **active** classes.
- Added **Bằng lái cũ — trước / sau** photo slots to the portal (add modal + detail), optional; keys `bangLaiFront`/`bangLaiBack` (mapping verified end-to-end: model columns, `DOC_KEYS`, upload/delete routing, `_to_wire`, data-loader docs object).
- Known follow-ups: existing-photo inline preview needs doc URLs on the student wire (currently shows "ĐÃ CÓ ẢNH"); login screen is still the shared admin login (guest-style login card = later, likely with the mobile entry); native camera lands with the Capacitor wrapper.

### CTV web app restriction (portal — phase 1)
- A `collaborator` logging into the web app now gets a **restricted surface**: sidebar shows **only "Học viên"** (view their assigned-active-class students + add/edit profiles). Dashboard, payments, classes, tổ chức, thông báo, reports, permissions are hidden; `goTab` ignores any nav to other tabs; the payments tab inside a student profile is hidden (no `payments` read perm). User pill shows the "Cộng tác viên" role. **Staff/admin unchanged.**
- Files: `shell.jsx` (nav filter + role label), `app.jsx` (`isCtv` + `goTab` guard), `screen-students.jsx` (payments tab gated by `D.can("payments","read")`).
- Next: tailor the CTV student list/detail to a cleaner mobile-style layout (UI inspiration from the standalone guest-app), then the Capacitor mobile wrapper.

### Collaborator (CTV) role + access scoping
- New `collaborator` role (lower than staff): `students` create+read only.
- Many-to-many CTV↔branch and CTV↔class assignment (`user_branch_assignments`, `user_class_assignments`).
- **CTV-only** active-class gating (`đang mở`/`đang diễn ra`); **staff unchanged** (branch-scoped, all classes); admin sees all.
- Account dialog: "Cộng tác viên" role + "Chi nhánh được giao"/"Lớp được giao" dropdown→pill (`TagSelect`); Lớp lists active classes only.
- Detail: `docs/HANDOFF-collaborator-role.md`. Migration `a2b3c4d5e6f7`.

### Add-profile (Thêm hồ sơ) overhaul
- Disabled OCR auto-fill; added **local QR scan** of the CCCD (jsQR, no service).
- Document slots **4 → 8**: + CCCD mặt sau, QR CCCD, Bằng lái mặt trước/sau.
- Field changes: Giới tính → Nam/Nữ dropdown; Quê quán → **Nơi tạm trú** (auto-copies Nơi thường trú on scan); Nơi cấp default "Cục CS QLHC về TTXH"; Số CCCD formats `123 456 789012`; placeholders updated.
- Detail: `docs/HANDOFF-add-profile-qr.md`. Migration `f1a2b3c4d5e6`.

## Pending deploy → see `HANDOFF.md` (master checkpoint)
1. `docker compose exec backend alembic upgrade head` → `f1a2b3c4d5e6` then `a2b3c4d5e6f7`.
2. Rebuild/restart backend + frontend.
3. Delete dev-only files (never ship): `frontend/_preview_static.html`, `_dialog_preview.html`, `_guest_preview.html`, `_qrlive.html`, `_qrtry.html`, `_https/`.
4. Next big tasks (not started): **address-update service**; **mobile apps** (Capacitor + ML Kit). See `HANDOFF.md` §6.
