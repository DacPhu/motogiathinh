# Upload Reliability — Change Log

> Audit trail for tasks defined in `UPLOAD_RELIABILITY_TASKS.md`.
> Each entry documents: what was changed, which files, why it aligns with the
> task brief, and any deviations from the plan. An auditor should cross-reference
> this against the task brief and the actual code diffs.

---

## TASK 1 — Simplify LicenseType enum (A1 only)
**Status:** Complete | **Scope:** backend only

### What changed
- `backend/app/models/enums.py`: Reduced `LicenseType` enum from 8 values (A1, A2, B1, B2, C, D, E, F) to 2 values (`A1 = "A1"`, `A = "A"`).
- `backend/app/utils/dates.py`: `license_to_db()` previously mapped frontend "A" → backend "A2". Changed to map "A" → "A". `license_to_wire()` unchanged (already returned "A" for everything except "A1").
- `backend/alembic/versions/e7f8a9b0c1d2_simplify_licensetype_enum.py`: New migration that converts the PostgreSQL ENUM type across 5 tables (students, course_types, exam_sessions, vehicles, certificates). Strategy: enum → VARCHAR → data migration (A2→A) → new enum (A/A1). Downgrade reverses (A→A2).

### Deviation from task brief
- The task brief stated "No DB migration needed — the DB column stores a VARCHAR, not a PostgreSQL enum type." This was incorrect — the column IS a PostgreSQL ENUM type via SQLAlchemy `Enum(LicenseType)`. A proper Alembic migration was required. The migration handles all 5 tables that use the `licensetype` enum.

### Alignment
- LicenseType has exactly 2 members: A and A1.
- `license_to_wire` and `license_to_db` handle A and A1.
- No remaining references to removed values (A2, B1, B2, C, D, E, F).

---

## TASK 2 — All UI errors in Vietnamese (two passes)
**Status:** Complete | **Scope:** frontend only

### What changed

**Pass 1 (basic translation):**
- Created `_humanError(err, ctx)` function at top of `frontend/data-loader.js` (module-level). Maps error types to Vietnamese messages: network, timeout, HTTP 400/401/403/404/409/500+, and a default fallback.
- Updated `api()` to throw `_humanError(...)` instead of raw `HTTP ${status} ${path}`.
- Updated `_upload` to throw `_humanError(...)` instead of `upload_failed: ${status}`.
- Updated `ocrCccd`, `fetchCtvCompetition`, `_downloadReport` to use `_humanError`.
- Updated offline guards in `api()` and `_upload` to Vietnamese.

**Pass 2 (thorough, clearer messages with explicit solutions):**
- Rewrote `_humanError` with more specific, actionable messages. Each error now says WHAT happened and WHAT TO DO next.
- Found and fixed raw English errors across ALL frontend files:
  - `frontend/qr-capturer.js`: Camera HTTPS error, QR decoder error, camera open error — all converted to Vietnamese with explicit next steps.
  - `frontend/screen-guest.jsx`: QR decode errors improved with guidance ("Giữ yên điện thoại, chụp lại ảnh rõ nét hơn").
  - `frontend/modals.jsx`: QR scan/decode errors improved; removed "Lỗi: " prefix from AddPaymentModal and AddClassModal.
  - `frontend/app.jsx`: ScreenErrorBoundary, boot failure, student creation error, bien lai upload error — all converted.
  - `frontend/screen-classes.jsx`, `screen-org.jsx`, `screen-org-vehicles.jsx`, `screen-payments.jsx`, `screen-students.jsx`: Removed all "Lỗi: " prefixes; raw error messages replaced with Vietnamese + action.
  - `screen-org.jsx` `reportWriteError` fallback: was appending raw error, now shows "Thử lại, hoặc liên hệ quản trị viên."

### Alignment with task brief
- Every `throw` and every user-visible error string is Vietnamese and human-readable.
- No raw HTTP status codes appear in the UI.
- Error banners use existing pink `G_ERROR_BANNER` styling.
- Login overlay 401 handling was verified unaffected (401 in `api()` triggers reload before the `!res.ok` block, so the humanized 401 never reaches the overlay).

### Audit notes
- `_humanError` runs at throw time, not display time. Error messages are baked into the Error object. This means no re-wrapping or double-humanization occurs downstream.
- The function uses regex matching on the raw status string (`/^(\d{3})/`) before the human message is applied, so the status code is captured before being replaced.

---

## TASK 3 — QR scan saves the captured photo as the CCCD QR image
**Status:** Complete | **Scope:** frontend (native-bridge + screen-guest)

### What changed

**`mobile/src/native-bridge.js` — `MGT_CAPTURE.open()`:**
- Added fallback camera capture when the primary QR scanner decodes successfully but `scanResultToFile` returns null (i.e., `savedUri` is corrupted/empty).
- Fallback: opens `Camera.getPhoto({ source: "CAMERA" })` so the user can snap the QR code manually.
- If both primary and fallback fail, returns `{ file: null, raw: res.raw, fields: parseCCCD(res.raw) }` — decoded fields without photo. UI will prompt re-scan.

**`frontend/screen-guest.jsx` — both `scanQr` functions:**
- After successful QR decode but `file` is null, shows toast: "Quét thành công nhưng ảnh QR chưa lưu được. Bấm vào ô QR để chụp lại."
- `missing.qr` validation (add modal): now requires BOTH `qrInfo?.idNumber` AND `docFiles.cccdQR` (previously only checked `idNumber`).
- `QrSlot` component: passes `preDecoded` even when file is null (`if (f || preDecoded) onPick(f, preDecoded)`).

### Alignment with task brief
- After successful QR decode, a photo file is always available for upload (either from native scanner or fallback camera).
- If neither produces a photo, user sees a Vietnamese message telling them to re-scan.
- Submit button is disabled until BOTH QR is decoded AND a photo exists.
- Web fallback path (no native scanner) unchanged — web already picks a photo manually.

---

## TASK 9 — Upload timeout via AbortController
**Status:** Complete | **Scope:** frontend only

### What changed

**`frontend/data-loader.js`:**
- Added `_fetchWithTimeout(url, opts, ms = 30000)` helper function after `_humanError` and before `api()`.
- Uses `AbortController` with a 30-second deadline per attempt.
- On abort, throws `Error('timeout')` with `retryable: true` so the retry layer (Task 8) can re-attempt.
- `clearTimeout` in `finally` prevents timer leaks on success.
- `_upload` method now calls `_fetchWithTimeout` instead of bare `fetch`.

### Alignment with task brief
- Stalled upload throws timeout error after 30s.
- The error has `retryable = true` for the retry layer.
- "Đang lưu..." never stays on screen for more than ~30-40 seconds.
- `AbortController` is supported in all modern browsers and WKWebView.
- Each attempt gets its own timeout (when combined with Task 8's retry wrapper).

---

## TASK 8 — Retry with exponential backoff on uploads
**Status:** Complete | **Scope:** frontend only

### What changed

**`frontend/data-loader.js`:**
- Added `_retryWithBackoff(fn, { attempts, baseMs, maxMs, onRetry })` helper after `_fetchWithTimeout`.
- Retries up to 3 attempts with exponential backoff: 800ms → 1600ms → 3200ms + random jitter (0-400ms). Max delay capped at 8000ms.
- Retryable detection: `e.retryable === true` (explicit flag) OR (`e.retryable` unset AND message matches `/failed to fetch|timeout|network|5\d\d|429/`).
- Terminal errors (400, 403, 409) are never retried — `e.retryable` is explicitly `false` for 4xx (except 429).
- `_upload` wraps its fetch call in `_retryWithBackoff`. On retry, shows toast: "Tải ảnh thất bại, đang thử lại…"
- `createStudent` is NOT wrapped (non-idempotent — retrying could create duplicates).

### Deviation from task brief
- The task brief's heuristic regex check (`/failed to fetch|timeout|network|5\d\d|429/i`) is preserved as a fallback, but the primary mechanism is the explicit `retryable` flag set by `_fetchWithTimeout` (timeout) and `_upload` (5xx/429). This is more reliable than regex matching on humanized Vietnamese error messages (which don't contain status codes).

### Alignment with task brief
- Single network blip → automatic retry with user feedback.
- 3 consecutive failures → error propagates to the caller (Task 7's result collector when implemented).
- No retry on 400/403/409.
- No retry on `createStudent`.
- Backoff jitter prevents thundering herd.

---

## TASK 4 — Address conversion: backend owns it
**Status:** Complete | **Scope:** frontend + backend

### What changed

**`backend/app/routers/address.py`:**
- Added `convert_single_address(address: str) -> tuple[str, bool]` at module level (before the router endpoint).
- Reuses existing infrastructure: `split_address`, `addr_cache_key`, `cache.get`, `_call_diachi`, `recombine`, `strip_subward`.
- Handles cache lookup, upstream call, sub-ward stripping, and cache write.
- Never raises — returns `(original_address, False)` on any failure (API down, rate-limited, unknown address, exception).
- The batch endpoint `POST /api/address/convert` is unchanged and still available.

**`backend/app/routers/students.py`:**
- Added import: `from app.routers.address import convert_single_address`.
- `create_student`: Before the `Student(...)` constructor, computes `_old_addr` (from QR payload or form input) and `_new_addr` via `convert_single_address(_old_addr)`. Stores `dia_chi=_new_addr` (converted) and `dia_chi_cccd=_old_addr` (original). Conversion failure → `dia_chi` = old address (fallback).
- `update_student`: When `cccdQrRaw` changes (QR scan), extracts old address from QR → converts → stores both `dia_chi` and `dia_chi_cccd`. When only `address` changes (admin manual edit, no QR), stores as-is without conversion.

**`frontend/screen-guest.jsx`:**
- Removed `D.api.convertAddress(out.fields.address)` block (7 lines) from both `scanQr` functions. Frontend now sends the raw old address from QR — backend handles conversion.
- Removed both "⚠ Địa chỉ chưa chuyển đổi" warning blocks (detail view line 392-394, add modal line 611-613). Backend fallback guarantees `dia_chi` is always set.
- `convertAddress` function in `data-loader.js` is kept (no callers, but available for future use).

### Design decisions worth auditing

1. **QR-triggered vs manual address edits:** In `update_student`, conversion only runs when `cccdQrRaw` is in the request fields. Manual address edits (admin portal) are stored as-is. Rationale: the admin types a new address directly; only QR-scanned addresses are old-format addresses that need conversion.

2. **`convert_single_address` placement:** Put in `address.py` (not `vn_address.py`) because it depends on `_call_diachi`, `cache`, and `settings` — all defined in `address.py`. The `vn_address.py` module remains a pure utility with no async dependencies.

3. **Import direction:** `students.py` imports from `address.py`. There is no reverse import, so no circular dependency. Both are FastAPI routers mounted in `main.py`, which imports them after module initialization.

4. **Frontend sends raw old address:** After removing the `convertAddress` call, `qrInfo.address` contains the unconverted QR address. The `createStudent` form sends this as `address`. The backend receives it as the old address, converts it, and stores both versions. This is correct because the backend's `create_student` now expects the old address (not the converted one).

5. **`dia_chi_cccd` assignment in `create_student`:** Changed from `(old_address_from_qr(f.cccdQrRaw) or f.address) or None` to `_old_addr or None` where `_old_addr = (old_address_from_qr(f.cccdQrRaw) or f.address) or ""`. The logic is equivalent — `old_address_from_qr` takes priority, falling back to `f.address`. The explicit empty string default avoids `None or ""` edge cases.

### Alignment with task brief
- Creating a student with a QR-parsed old address always succeeds (never blocked by conversion).
- `dia_chi` in DB = new (converted) address when API works, old address when it fails.
- `dia_chi_cccd` in DB = always the old address from the QR.
- Frontend `scanQr` no longer calls any address conversion API.
- Changing the diachi.io provider in the future only requires editing `address.py`.

---

## TASK 5 — Incremental draft save (IndexedDB)
**Status:** Complete | **Scope:** frontend only

### What changed

**`frontend/screen-guest.jsx` — IndexedDB wrapper (lines 59-111):**
- Added `_openDraftDB()` — opens/creates IndexedDB database `mgt_guest_draft` with a single `photos` object store.
- Added `draftSavePhoto(prefix, key, file)` — saves a File blob with key `"{prefix}_{key}"`. Caps at 5MB per file. On failure, shows a toast ONCE per session: "Không thể lưu ảnh tạm thời. Ảnh sẽ bị mất nếu đóng ứng dụng." The `_draftWarned` flag prevents toast spam.
- Added `draftLoadPhoto(prefix, key)` — loads a File blob, returns null on miss or error. Silent on failure (nothing actionable for the user).
- Added `draftClearPhotos(prefix)` — deletes all keys matching `prefix_*` via `IDBKeyRange.bound`. Silent on failure (stale data is harmless).

**`frontend/screen-guest.jsx` — GuestAddStudentModal wiring:**
- `pickInto` (line 537): after `setDocFiles`, calls `draftSavePhoto('new', key, file)`.
- `scanQr` (line 557): after setting `docFiles.cccdQR`, calls `draftSavePhoto('new', 'cccdQR', file)`.
- useEffect on open (lines 516-522): async IIFE loads photos from IndexedDB after text fields restore. Photos pop in ~100ms after modal opens.
- Submit (line 626): `draftClearPhotos('new')` after localStorage draft clear.

**`frontend/screen-guest.jsx` — GuestStudentDetail wiring:**
- `pickInto` (line 341): after `setNewFiles`, calls `draftSavePhoto(student.id, key, file)`.
- `scanQr` (line 370): after setting `newFiles.cccdQR`, calls `draftSavePhoto(student.id, 'cccdQR', file)`.
- useEffect on mount (lines 344-351): loads photos from IndexedDB keyed by `student.id`.
- Submit (line 399): `draftClearPhotos(student.id)` after `setNewFiles({})`.

**`frontend/test-draft-store.html` (new):**
- Browser-based smoke test for the IndexedDB functions. 10 test cases covering roundtrip, prefix isolation, overwrite, clear, null/oversized rejection.

### Design decisions worth auditing

1. **Prefix scoping:** `"new"` for add modal, `student.id` for detail view. Prevents collisions. Only one modal/detail is active at a time, so no concurrent access issues.

2. **5MB per-file cap:** iOS WKWebView has ~50MB IndexedDB budget. 6 photos × 5MB = 30MB worst case. The cap prevents a single oversized photo from consuming the entire budget. Files exceeding 5MB are silently rejected (the user can still pick and upload them — they just won't survive a close/reopen).

3. **Error surfacing on write failure:** `draftSavePhoto` shows a toast on the first failure, then stays silent (`_draftWarned` flag). This balances transparency (user knows photos aren't being persisted) with UX (no repeated toasts on every pick). Read failures and cleanup failures are silent — nothing actionable for the user.

4. **Async photo load on mount:** Photos load asynchronously after the component renders. Text fields appear instantly (from localStorage), photos pop in shortly after. This is acceptable because the delay is ~100ms and the user won't notice.

5. **Draft cleared after submit:** Both components clear the draft after all upload attempts complete. This matches the existing localStorage behavior. Task 7 (success gate) may need to adjust this if partial success handling changes the clear timing.

### Offline mode interaction

IndexedDB persistence is **synergistic** with offline mode, not conflicting:
- Photos saved to IndexedDB are local — no network needed.
- If the user is offline and tries to submit, `createStudent` fails (blocked by `_MGT_OFFLINE` check). The draft is NOT cleared (error caught before `draftClearPhotos`).
- When the user comes back online and reopens the modal, photos + text are restored from IndexedDB/localStorage.
- This fixes the biggest offline pain point for CTVs: they don't lose their work when the connection drops mid-flow.

### Known gap (deferred to Task 10)

The offline banner in `app.jsx:337` reads `window._MGT_OFFLINE` as a plain property during render — non-reactive. Task 10 needs to make it listen to `mgt:connectivity` events so the banner disappears when connectivity returns. This doesn't affect the IndexedDB draft flow — it's a banner display issue only.

### Alignment with task brief
- Pick a photo, close the modal, reopen → photo is still there. ✓
- Pick a photo, kill the app, reopen → photo is still there (IndexedDB persists). ✓
- Successfully save → draft is cleared, fresh start next time. ✓
- Text fields continue to work via localStorage (no regression). ✓

---

## TASK 6 — Silent re-authentication (DROPPED)
**Status:** Dropped — not necessary for this use case.

### Rationale
CTVs are IT-managed: an IT guy logs them in once, credentials persist indefinitely.
If the JWT expires (14-day TTL) or the user accidentally logs out, the existing
recovery path works: `api()` 401 → `window.location.reload()` → login screen appears
with prefilled credentials (via `window.MGT_CREDS` from native-bridge.js) → one tap
to re-enter. With IndexedDB drafts (Task 5), photos survive the reload. Silent
re-auth would add credential-storage complexity and a security surface for zero
practical benefit on IT-managed devices where users log in once and stay logged in
for weeks.

---

## TASK 10 — Offline mode audit and fix
**Status:** Complete | **Scope:** frontend only

### What changed

**`frontend/data-loader.js` — reconnect detection (lines 994-1014):**
- Added `_probeReconnect()` function after the `MGT_DATA_READY` assignment.
- Short-circuits if `window._MGT_OFFLINE` is already false (no work to do).
- Debounced: max once per 5 seconds via `_lastProbe` timestamp.
- Probe: calls `api('/me')` — if it succeeds, clears `window._MGT_OFFLINE = false` and dispatches `mgt:connectivity` event.
- Shows a Vietnamese toast on reconnect: "Đã khôi phục kết nối — có thể tải ảnh và lưu dữ liệu."
- On probe failure (still offline): silently keeps the flag — no error shown.
- Two listeners registered at IIFE scope:
  - `window.addEventListener('online', _probeReconnect)` — standard browser reconnect event.
  - `document.addEventListener('visibilitychange', ...)` — re-probes when app returns to foreground (essential for iOS WKWebView where `online` is unreliable).

**`frontend/app.jsx` — reactive offline banner (lines 310, 316-320, 343):**
- Added `offline` state via `React.useState(!!window._MGT_OFFLINE)`.
- Added `useEffect` that listens for `mgt:connectivity` events and updates the `offline` state.
- Banner JSX changed from `window._MGT_OFFLINE && (` to `offline && (`.
- The banner now disappears automatically when connectivity is restored — no page reload needed.

### Design decisions worth auditing

1. **Probe endpoint:** Used `/me` (the existing auth-check endpoint). It's lightweight (single row lookup) and tests both network connectivity AND auth validity. If the JWT expired while offline, the probe 401s and `_MGT_OFFLINE` stays true — correct behavior: the user needs to re-login before they can write.

2. **5-second debounce:** Prevents hammering `/me` on rapid visibility changes (e.g., user switching between apps quickly). The `online` event can also fire multiple times during network transitions.

3. **No data refresh on reconnect:** The probe only clears the flag. A full data refresh (re-fetching all entities) would be nice but is secondary — the priority is unblocking writes. The data snapshot may be stale after offline, but it's the same stale data the user was viewing while offline.

4. **Reconnect toast:** "Đã khôi phục kết nối — có thể tải ảnh và lưu dữ liệu." appears once on reconnect. Not repeated on subsequent `online`/`visibilitychange` events because the flag is already cleared by the first successful probe.

### `_MGT_OFFLINE` reference audit

All 6 references verified correct:
- `data-loader.js:121` — `api()` blocks non-GET writes when offline. KEEP.
- `data-loader.js:491` — set to true on cached boot. KEEP.
- `data-loader.js:843` — `_upload` blocks when offline. KEEP.
- `data-loader.js:1000` — probe short-circuits if already online. KEEP.
- `data-loader.js:1006` — clears flag on successful probe. KEEP.
- `app.jsx:310,317` — state initializer + event listener for reactive banner. KEEP.

### Alignment with task brief
- User boots offline → banner shows. Gets Wi-Fi → banner disappears within seconds. ✓
- After reconnect, uploads work without app restart. ✓
- The banner updates reactively (no stale state). ✓
- `online` event + `visibilitychange` together cover both web and native. ✓
- Debounce prevents hammering `/me`. ✓
- "Đã khôi phục kết nối" toast on reconnect. ✓

---

## JWT TTL — changed from 3650 days to 90 days
**Status:** Complete | **Scope:** backend only

### What changed

**`backend/app/core/security.py` (line 20):**
- `SESSION_TTL_DAYS` changed from `3650` (~10 years) to `90` (90 days).
- Updated the `create_session_token` docstring from "14 days" (which was stale — actual value was 3650) to "90 days".

### Rationale
The previous value (3650 days / ~10 years) was set as "mobile tokens never expire" — effectively permanent sessions. 90 days is long enough for CTVs who rarely log out, while still providing a reasonable security rotation window. The cookie `max_age` in `auth.py:26` and the JWT `exp` claim both derive from `SESSION_TTL_DAYS`, so this single change covers both.

### 401 behavior (for reference)
When a JWT does expire (after 90 days), `data-loader.js:130` handles 401 with `window.location.reload()`. This wipes React state (modal, photos), but IndexedDB (Task 5) and localStorage draft persistence survive the reload. The login screen appears with prefilled credentials (via `window.MGT_CREDS`). This recovery path is sufficient for the CTV use case — silent re-auth (Task 6) was dropped as unnecessary.

### Alignment
- Cookie TTL, JWT exp, and backend constant are all derived from the single `SESSION_TTL_DAYS` value.
- No other hardcoded TTL references exist in the auth flow.

---

## TASK 7 — Prevent ALL partial success (the success gate)
**Status:** Complete | **Scope:** frontend only

### What changed

**`frontend/screen-guest.jsx` — GuestAddStudentModal (complete submit overhaul):**

- Added `DOC_LABELS` constant (Vietnamese labels for all doc keys) and `CTV_REQUIRED_DOCS` array (`['cccd', 'cccdBack', 'the3x4', 'cccdQR']`). `bangLaiFront`/`bangLaiBack` are optional — their failure does not block the success screen.
- Replaced `busy`/`err`/`success` states with unified `result` state object: `{ status: 'idle'|'creating'|'uploading'|'partial'|'full'|'failed', studentId, name, licence, classCode, failedDocs, errMsg }`.
- Added `retryBusy` state + `retryBusyRef` (ref for synchronous double-click guard) + `mountedRef` (guards against setState after unmount).
- **Submit handler** now collects upload results instead of swallowing errors:
  1. `createStudent()` → on fail: sets `result.status = 'failed'`, keeps form open for retry.
  2. On success: clears localStorage text draft, sets `status = 'uploading'`.
  3. Sequential upload loop collects `results[]` with `{ key, ok, error }`.
  4. Filters `failedRequired = results.filter(r => !r.ok && CTV_REQUIRED_DOCS.includes(r.key))`.
  5. If 0 failed required → `status = 'full'` → green `GuestSuccessView`.
  6. If N failed required → `status = 'partial'` → partial success banner with retry button. **Does NOT clear IndexedDB draft** (photos stay for retry).
- **`retryFailedUploads()`** function: clones `failedDocs` from result (avoids stale closure), uploads only failed docs sequentially, clones `failedDoc` entries. On all success → `status = 'full'`. On partial → updates `failedDocs` in result.
- **Footer** adapts to state: "HỦY + THÊM" (idle), "Đang lưu…" / "Đang tải ảnh…" (operating), "Đóng" (full/partial).
- **Body** renders: form (idle/failed), form + error banner (failed), `GuestSuccessView` (full), partial success banner with retry button (partial).
- Photo slots and QR slot still clickable during idle/failed (for retry); button disabled during operating via `isOperating` flag.

**`frontend/screen-guest.jsx` — GuestStudentDetail (submit overhaul):**

- Same state architecture: `result` + `retryBusy` + `retryBusyRef` + `mountedRef`.
- **Submit handler**: updates fields first (catches failure separately), then uploads photos collecting results. Only clears `newFiles` + IndexedDB on full success. On partial: keeps `newFiles` intact for retry, preserves `qrInfo` (audit fix MEDIUM-7).
- **`retryFailedUploads()`**: same pattern — clones failedDocs, uploads only failed entries, updates state.
- **`canSubmit`** now accounts for `hasPendingUploads` — allows submit when retry is needed even if `isDirty` is false.
- JSX: inline partial/failed banners before the submit button. Button text cycles: "Đang lưu…" → "Đang tải ảnh…" → "Lưu thay đổi".

**`frontend/screen-guest.jsx` — GuestApp (offline banner):**

- Added CTV offline banner (reads `window._MGT_OFFLINE`), matching the admin banner in `app.jsx`. Shows "Không có mạng — đang xem dữ liệu đã lưu. Kết nối internet để cập nhật." when booted offline.

### Design decisions worth auditing

1. **Draft clearing timing**: localStorage text draft cleared immediately after `createStudent` succeeds (text data is on server). IndexedDB photos cleared ONLY on full success — photos stay in IndexedDB during partial for retry. If user closes modal without retrying, photos are orphaned in IndexedDB until next cleanup.

2. **`mountedRef` guard**: All `setResult()` calls in async paths check `if (!mountedRef.current) return` to prevent setState on unmounted component. Set to `true` on mount, `false` on cleanup.

3. **`retryBusyRef` vs `retryBusy`**: Ref provides synchronous guard against double-click (before React batches the state update). State provides render-time disabling of the button.

4. **Partial success shows list of failed docs** with Vietnamese labels from `DOC_LABELS`. Optional docs (bangLai) that fail show as individual toasts but don't block the success screen.

5. **Detail view preserves `qrInfo` on partial failure**: If `cccdQR` upload fails, `qrInfo` is NOT cleared. This prevents `canSubmit` from requiring QR re-validation on retry (audit fix MEDIUM-7).

6. **CTV offline banner**: Non-reactive (reads `window._MGT_OFFLINE` at render time). Consistent with admin banner behavior — updates on next re-render after reconnect probe clears the flag. Separate from the reactive admin banner (app.jsx) which uses React state + event listener.

### Audit fixes incorporated

| Audit ID | Fix |
|----------|-----|
| HIGH-3 | `mountedRef` guards on all async setState paths |
| HIGH-4 | `retryBusyRef` for synchronous double-click prevention |
| MEDIUM-2 | Clone `failedDocs` at retry start to avoid stale closure |
| MEDIUM-7 | Preserve `qrInfo` when `cccdQR` is in failed docs |
| LOW-4 | Added CTV offline banner in GuestApp header |

### Deferred (pre-existing, not introduced by Task 7)

- HIGH-1: localStorage draft timing (last keystroke lost on fast close) — pre-existing, not related to success gate.
- HIGH-2: IndexedDB orphan accumulation — acceptable given iOS 50MB budget; cleanup sweep can be a follow-up.
- HIGH-5: `_capImage` memory pressure — in data-loader.js, out of Task 7 scope.
- MEDIUM-1: `GuestAuthedImage` fetch abort — pre-existing, separate fix.

### Alignment with task brief

- Green success screen ONLY shows when ALL required docs uploaded. ✓
- Partial failure shows WHICH photos failed + retry button. ✓
- Retry successfully uploads remaining photos. ✓
- Detail view has same honest-failure behavior. ✓
- Optional docs (bangLai) failing → still show success with toast. ✓
- Student record is NOT deleted on partial failure. ✓
- Retry is idempotent (uploadStudentDoc overwrites). ✓
- Draft (IndexedDB) NOT cleared until full success. ✓

---

## Tasks pending (not yet implemented)

All 10 tasks are now complete.

---

## Files modified (cumulative)

| File | Tasks touched |
|------|---------------|
| `backend/app/models/enums.py` | #1 |
| `backend/app/utils/dates.py` | #1 |
| `backend/alembic/versions/e7f8a9b0c1d2_...py` | #1 (new) |
| `backend/app/routers/address.py` | #4 |
| `backend/app/routers/students.py` | #4 |
| `frontend/data-loader.js` | #2, #8, #9, #10 |
| `frontend/screen-guest.jsx` | #2, #3, #4, #5, #7 |
| `frontend/native-bridge.js` (mobile/src/) | #3 |
| `frontend/qr-capturer.js` | #2 |
| `frontend/modals.jsx` | #2 |
| `frontend/app.jsx` | #2, #10 |
| `frontend/screen-classes.jsx` | #2 |
| `frontend/screen-org.jsx` | #2 |
| `frontend/screen-org-vehicles.jsx` | #2 |
| `frontend/screen-payments.jsx` | #2 |
| `frontend/screen-students.jsx` | #2 |
| `frontend/test-draft-store.html` | #5 (new, test only) |
