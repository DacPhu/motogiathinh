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

## Tasks pending (not yet implemented)

| # | Task | Priority | Depends on |
|---|------|----------|------------|
| 6 | Silent re-authentication via saved creds | high | — |
| 7 | Prevent ALL partial success (success gate) | CRITICAL | #2, #5, #6, #8 |
| 10 | Offline mode audit and fix | high | #6 |

Recommended remaining order: 6 → 10 → 7

---

## Files modified (cumulative)

| File | Tasks touched |
|------|---------------|
| `backend/app/models/enums.py` | #1 |
| `backend/app/utils/dates.py` | #1 |
| `backend/alembic/versions/e7f8a9b0c1d2_...py` | #1 (new) |
| `backend/app/routers/address.py` | #4 |
| `backend/app/routers/students.py` | #4 |
| `frontend/data-loader.js` | #2, #8, #9 |
| `frontend/screen-guest.jsx` | #2, #3, #4, #5 |
| `frontend/native-bridge.js` (mobile/src/) | #3 |
| `frontend/qr-capturer.js` | #2 |
| `frontend/modals.jsx` | #2 |
| `frontend/app.jsx` | #2 |
| `frontend/screen-classes.jsx` | #2 |
| `frontend/screen-org.jsx` | #2 |
| `frontend/screen-org-vehicles.jsx` | #2 |
| `frontend/screen-payments.jsx` | #2 |
| `frontend/screen-students.jsx` | #2 |
| `frontend/test-draft-store.html` | #5 (new, test only) |
