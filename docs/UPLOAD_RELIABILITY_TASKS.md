# Upload Reliability — Complete Task Brief

> **Purpose:** Authoritative reference for agents picking up any of these tasks.
> Read the relevant task section end-to-end before touching code. Every task is
> self-contained with: context, problem, exact files/lines, solution, acceptance
> criteria, and gotchas. Tasks are ordered easiest → deepest.

> **User profile:** CTV operators are older, not tech-savvy. Every interaction
> must be dead-simple, explicit, and Vietnamese. No error should ever be
> shown as a raw code or English string. If something fails, the UI must say
> *what* failed and *what to do next* — in terms the user understands.

---

## File Map (for reference)

| File | Role | Editable? |
|------|------|-----------|
| `frontend/data-loader.js` | HTTP seam — all API calls, `_upload`, `api()`, `_capImage`, boot/offline logic | YES — primary editable seam |
| `frontend/screen-guest.jsx` | CTV portal UI — add/edit modals, photo slots, QR slot, submit logic | YES — plumbing edits |
| `frontend/native-bridge.js` | Capacitor seam — token, photo picker, native QR scanner | YES — lives in `mobile/src/` |
| `mobile/src/config.js` | API base URL | YES |
| `backend/app/core/storage.py` | MinIO upload_bytes / get_object_bytes | YES — backend |
| `backend/app/routers/student_docs.py` | Doc upload/delete routes | YES — backend |
| `backend/app/routers/students.py` | Student CRUD + access scoping | YES — backend |
| `backend/app/routers/address.py` | Address conversion proxy (diachi.io) | YES — backend |
| `backend/app/models/enums.py` | All enums | YES — backend |

---

## TASK 1 — Simplify LicenseType enum (A1 only)
**Priority:** trivial | **Risk:** very low | **Scope:** backend only

### Context
The mobile app only uses two license types: **A** and **A1**. The DB enum has 8 values
(A1, A2, B1, B2, C, D, E, F) that are remnants of the design system. The wire
(`license_to_wire/db`) already collapses everything to A/A1. The mobile `LicencePill`
only offers two buttons. Nobody uses the others.

### Problem
Legacy enum values exist in the codebase and could confuse future developers or cause
validation errors if they ever surface.

### Files
- `backend/app/models/enums.py` — `LicenseType` enum (line 4)

### Plan
1. Remove all `LicenseType` values except `A1 = "A1"` and `A = "A"`.
2. Grep for any hardcoded references to removed values (A2, B1, B2, C, D, E, F) and remove.
3. **No DB migration needed** — the DB column stores a VARCHAR, not a PostgreSQL enum type.
   Existing rows with old values will still load; the Python enum just won't map them.
   The wire (`license_to_wire`) handles unknown values gracefully.

### Acceptance criteria
- `LicenseType` has exactly 2 members: `A` and `A1`.
- `license_to_wire` and `license_to_db` in `utils/dates.py` still handle A and A1.
- No other file references the removed values.

### Gotchas
- **Do NOT touch the DB.** This is a code-only cleanup. Old DB rows with "B1" etc. remain
  but will never be served to the frontend (the wire maps everything through
  `license_to_wire` which only returns "A" or "A1").

---

## TASK 2 — All UI errors in Vietnamese
**Priority:** high (UX) | **Risk:** low | **Scope:** frontend only

### Context
Users are older Vietnamese operators who don't read English. Currently, upload errors
surface as raw `Error` messages like `"upload_failed: 500"` or `"HTTP 500 /students/xxx/docs/cccd"`.
Nobody understands these.

### Problem
- `_upload` throws `"upload_failed: " + res.status` (data-loader.js:769) — raw HTTP code.
- `api()` throws `"HTTP ${res.status} ${path} ${detail}"` (data-loader.js:55) — raw.
- `uploadStudentDoc` catch blocks show `e.message` directly (screen-guest.jsx:563, 341).
- QR scan errors say "QR chưa rõ" but don't guide the user.

### Files
- `frontend/data-loader.js` — `_upload` (line 764), `api()` (line 42)
- `frontend/screen-guest.jsx` — submit catch blocks (lines 563, 341), QR error messages

### Plan
1. Create a shared `_humanError(err, context)` helper at the top of data-loader.js that
   maps error types to Vietnamese:
   - Network/TypeError/offline → `"Không có mạng. Kiểm tra kết nối internet.`
   - Timeout → `"Kết nối quá chậm. Thử lại hoặc kiểm tra mạng.`
   - 400 → based on response detail:
     - `file_too_large` → `"Ảnh quá lớn (tối đa 8MB). Chụp lại với chất lượng thấp hơn.`
     - `invalid_key` → `"Loại tài liệu không hợp lệ.`
     - Default → `"Dữ liệu không hợp lệ. Kiểm tra lại thông tin.`
   - 401 → `"Phiên đăng nhập hết hạn. Đang đăng nhập lại...`
   - 403 → `"Bạn không có quyền thực hiện thao tác này.`
   - 404 → `"Không tìm thấy hồ sơ.`
   - 409 → `"CCCD này đã tồn tại trong hệ thống.`
   - 500/502/503 → `"Lỗi hệ thống. Thử lại sau vài giây.`
   - Upload failed → `"Tải ảnh thất bại. Kiểm tra mạng và thử lại.`
   - Default → wrap in `"Có lỗi xảy ra: {original}"`
2. In `_upload` (data-loader.js:769): replace `throw new Error('upload_failed: ' + res.status)`
   with `throw new Error(_humanError(err, 'upload'))`.
3. In `api()` (data-loader.js:55): replace `throw new Error(...)` with
   `throw new Error(_humanError(err, 'api'))`.
4. In screen-guest.jsx submit catch blocks: replace raw `e.message` display with
   the already-humanized error (since `_humanError` ran at throw time). But also
   add a **concrete next-step instruction** where helpful, e.g.:
   - Upload failure → "Tải ảnh thất bại. Kiểm tra mạng rồi bấm 'Thử lại'."
   - Auth expired → "Phiên hết hạn, đang đăng nhập lại..."
   - Unknown → "Có lỗi xảy ra. Thử lại hoặc liên hệ quản trị."
5. **CRITICAL:** Every error displayed to the user must:
   - Be in Vietnamese.
   - Say WHAT failed (in plain language).
   - Say WHAT TO DO (retry, check network, contact admin).
   - Never show raw HTTP codes, stack traces, or English strings.

### Acceptance criteria
- Every `throw` and every user-visible `err` string in data-loader.js and
  screen-guest.jsx is Vietnamese and human-readable.
- No raw HTTP status codes ever appear in the UI.
- Error banners use the existing pink `G_ERROR_BANNER` styling.

### Gotchas
- Don't break the login overlay error handling (data-loader.js:387) — it already
  has a Vietnamese message for 401.
- The `gToast()` calls in the submit handlers (line 563, 341) are fire-and-forget.
  They'll need to use the humanized message too.

---

## TASK 3 — QR scan saves the captured photo as the CCCD QR image
**Priority:** medium (UX + data completeness) | **Risk:** low | **Scope:** frontend

### Context
When a CTV scans a student's CCCD QR code, the app decodes the text payload (name, DOB,
address, etc.) AND should save the **photo of the QR code** as the student's `cccdQR`
document. This photo is important: it's used later when staff/Admin pick up the profile
and need to re-scan or verify the QR visually.

### Current behavior (verified by code trace)
The native scanner path (`MGT_CAPTURE.open()` → `MgtQrScanner.scan()`) returns:
- `res.raw` — the decoded QR string
- `res.savedUri` — the captured frame as a file URI on disk

`scanResultToFile(res)` (native-bridge.js:73) converts `savedUri` to a `File` object.
The returned `{ file, raw, fields }` flows into `scanQr(file, preDecoded)`.
`scanQr` stores the file via `setNewFiles(prev => ({ ...prev, cccdQR: file }))` (line 317/501).
On submit, `uploadMap.cccdQR` includes this file, and `uploadStudentDoc(id, 'cccdQR', file)` runs.

**This should work.** BUT there are two failure paths that silently lose the photo:

1. **`scanResultToFile` returns `null`** (native-bridge.js:88) — if `savedUri` is corrupted,
   empty, or the `fetch(url)` fails. In this case `MGT_CAPTURE.open()` returns
   `{ file: null, raw: "..." }`, and `scanQr` receives `file = null`. The decoded fields
   are set but the **photo is gone**. The QR slot shows the decoded ID number but no image.
   No toast, no error, no indication the photo was lost.

2. **`Qr.scan` returns `raw` but no `savedUri`** — if `imageReturn: "file"` doesn't
   produce a file (permission issue, disk full). Same null-file path.

### Problem
When the native scanner decodes successfully but fails to produce an image, the user
never knows the photo wasn't captured. The student is created without `cccdQR` image.

### Files
- `mobile/src/native-bridge.js` — `MGT_CAPTURE.open()` (line 99-153), `scanResultToFile` (line 73-90)
- `frontend/screen-guest.jsx` — `scanQr` (lines 295-321 for detail, 478-507 for add)

### Plan
1. In `MGT_CAPTURE.open()` (native-bridge.js): after the primary scanner returns
   `{ file: nf, raw: res.raw, ... }` where `nf` is null:
   - Instead of silently falling through, **capture a fallback photo** using
     `Camera.getPhoto({ source: "CAMERA" })` — immediately opens the camera so the user
     can snap the QR code. This is the photo that gets saved.
   - If the fallback camera also fails (user cancels), then proceed with `file: null`
     but **set a flag** so the UI can indicate the photo is missing.
   - Log the failure path: `console.warn('[mgt] QR scan: decoded but no image, fallback camera')`.

2. In `scanQr` (screen-guest.jsx): after the QR decode succeeds but `file` is null,
   **show a clear Vietnamese message** in the QR slot area:
   `"Quét thành công nhưng ảnh QR không lưu được. Chụp lại ảnh QR."`
   This tells the user exactly what happened and what to do.

3. In the add-modal's submit validation (screen-guest.jsx:511-516): `missing.qr` already
   gates on `!qrInfo?.idNumber` — but should ALSO gate on `!docFiles.cccdQR` (no photo file).
   Currently if the QR decoded but the photo is null, the submit proceeds without the image.
   **Change `missing.qr` to require BOTH** `qrInfo?.idNumber` AND `docFiles.cccdQR`.

### Acceptance criteria
- After a successful QR decode, a photo file is ALWAYS available for upload (either from
  the native scanner's frame capture, or from the fallback camera).
- If neither produces a photo, the user sees a Vietnamese message telling them to re-scan.
- The submit button is disabled until BOTH the QR is decoded AND a photo exists.

### Gotchas
- Don't break the web fallback path (no native scanner) — web already picks a photo
  manually, so `file` is always the picked image.
- The fallback camera should use `source: "CAMERA"` (not `"PROMPT"`) to avoid confusion —
  the user just tapped a QR scanner, they expect the camera, not a dialog.

---

## TASK 4 — Address conversion: backend owns it, client doesn't do it
**Priority:** high (data integrity) | **Risk:** medium | **Scope:** frontend + backend

### Context
Vietnam's 2025 admin reform renamed/merged provinces. CCCD QR codes carry OLD addresses.
The backend has a conversion endpoint (`POST /api/address/convert` → diachi.io proxy)
that maps old → new. This conversion MUST happen before storing the address.

### Current behavior (WRONG — conversion is client-side)
- `scanQr` (screen-guest.jsx:307-313) calls `D.api.convertAddress(address)` — this
  calls `POST /api/address/convert` from the frontend.
- The converted address is then sent as `address` in the student create form.
- The backend stores `address` as `dia_chi` and computes `dia_chi_cccd` from the raw QR
  payload (`old_address_from_qr(f.cccdQrRaw)`).

**Problems with this approach:**
1. If the diachi.io API is down or rate-limited, the **frontend** gets an error and the
   user sees "Địa chỉ chưa chuyển đổi" — but the profile isn't created yet.
   The conversion failure **blocks profile creation**. It shouldn't.
2. The backend's own address router already has a Redis cache, sub-ward stripping, and
   rate-limit handling — but the frontend bypasses all of this by calling directly.
3. Future: changing the API provider requires updating frontend code, not just backend.

### Correct behavior (per user's intent)
1. Frontend sends the **OLD address** (from QR payload) in the create form.
2. Backend's `create_student` handler calls the address conversion internally.
3. Backend stores **both**: `dia_chi` = new address (converted), `dia_chi_cccd` = old address.
4. If conversion fails for any reason (API down, rate-limited, unknown address):
   **Fallback: `dia_chi` = old address** (same as `dia_chi_cccd`). Profile is STILL created.
5. Conversion is best-effort, never blocks student creation.
6. Future API provider change: only `address.py` or the backend handler changes.

### Files
- `backend/app/routers/students.py` — `create_student` (line 234) + `update_student` (line 357)
- `backend/app/routers/address.py` — existing proxy (already has caching + fallback)
- `frontend/screen-guest.jsx` — `scanQr` (lines 307-313 for detail, 490-497 for add)
- `frontend/data-loader.js` — `convertAddress` (line 714-723)

### Plan

**Backend (`students.py`):**
1. In `create_student` (line 234), after extracting `f.address`:
   - Call the address conversion logic directly (not via HTTP — import the function from
     `address.py` or extract the core logic into a shared utility in `utils/vn_address.py`).
   - The conversion is: `old_addr → diachi.io → new_addr`. On any failure, `new_addr = old_addr`.
   - Store: `s.dia_chi = new_addr` (the converted/new address)
   - Store: `s.dia_chi_cccd = f.address or old_address_from_qr(f.cccdQrRaw)` (the old address)
   - The conversion call should be wrapped in try/except so it NEVER raises — profile
     creation must succeed regardless.

2. In `update_student` (line 357), when `address` or `cccdQrRaw` changes:
   - Re-run the conversion and update `dia_chi` (new) + `dia_chi_cccd` (old).
   - Same fallback: on failure, `dia_chi = dia_chi_cccd`.

**Frontend (`screen-guest.jsx`):**
3. Remove the `D.api.convertAddress(address)` call from both `scanQr` functions
   (lines 307-313 and 490-497). The frontend no longer converts — it just sends the raw
   old address from the QR payload. The backend handles it.

4. Remove the "Địa chỉ chưa chuyển đổi" warning from the add modal
   (lines 617-619) and the detail view (lines 395-397) — this is now a backend concern
   and will never surface to the user (fallback ensures old address is always stored).

**Backend utility extraction (`utils/vn_address.py` or `routers/address.py`):**
5. Extract the conversion call into a reusable async function:
   `async def convert_single_address(address: str) -> tuple[str, bool]`
   Returns `(converted_address, ok)`. On any failure, returns `(address, False)`.
   This function encapsulates: split → check cache → call diachi.io → recombine → cache.
   Both `address.py:convert_address` and `students.py:create_student` call this.

### Acceptance criteria
- Creating a student with a QR-parsed old address always succeeds (never blocked by conversion).
- `dia_chi` in DB = new (converted) address when API works, old address when it fails.
- `dia_chi_cccd` in DB = always the old address from the QR.
- Frontend `scanQr` no longer calls any address conversion API.
- Changing the diachi.io provider in the future only requires editing backend code.

### Gotchas
- The address conversion is **async** (uses httpx). The `create_student` endpoint is
  already async, so this is fine — but add a short timeout (e.g. 10s) on the httpx call
  so a hung API doesn't block the request indefinitely.
- When the user's existing insight #9 says "the backend will then store a newly received
  address, alongside with the old address, and they both should accompany from then on" —
  this means `dia_chi` (new) and `dia_chi_cccd` (old) are BOTH persisted. The wire
  already exposes both in `_to_wire` (students.py:78 for address, and the Excel export
  uses `dia_chi_cccd`).

---

## TASK 5 — Incremental draft save (progress persistence)
**Priority:** high (UX) | **Risk:** low-medium | **Scope:** frontend

### Context
CTV operators are old and slow. They might:
- Pick a photo, get interrupted, close the app.
- Fill half the form, accidentally tap outside the modal.
- Have an upload fail mid-way, need to close and reopen.

They need to **never lose work**. Every field and photo should persist as they fill it,
so reopening the modal picks up exactly where they left off.

### Current behavior (partial)
- Text fields (`name, phone, licence, classId, qrInfo`) are saved to `localStorage`
  under `mgt_guest_add_draft` on modal close (screen-guest.jsx:464-466) and restored
  on open (lines 453-461). This WORKS for text.
- **Photos are NOT saved** — `docFiles` (the File objects) are dropped on close.
  Files can't be serialized to localStorage. After a close/reopen, all picked photos
  are gone.

### Problem
When a CTV picks photos then closes the modal (accidentally or due to error), the photos
are lost. They must re-pick every photo from scratch. On a slow connection where uploads
take time, this is very painful.

### Files
- `frontend/screen-guest.jsx` — `GuestAddStudentModal` (lines 417-645)

### Plan
Photos can't go in localStorage, but they CAN be cached in **IndexedDB** (which can
store Blobs and has no strict size limits):

1. Create a small IndexedDB wrapper at the top of screen-guest.jsx (or in data-loader.js):
   ```js
   // mgtDraftStore — IndexedDB-backed draft photo cache
   const _DB_NAME = 'mgt_guest_draft';
   const _DB_STORE = 'photos';
   function _openDB() { ... } // returns IDBDatabase
   async function draftSavePhoto(key, file) { ... } // put blob under key
   async function draftLoadPhoto(key) { ... } // returns File or null
   async function draftClearPhotos() { ... } // clear the store
   ```

2. In `GuestAddStudentModal`:
   - When a photo is picked (`pickInto`), immediately also save it to IndexedDB:
     `draftSavePhoto(key, file)`.
   - On modal open (the `useEffect` at line 448-468): after restoring text fields,
     also load photos from IndexedDB:
     ```js
     for (const key of ['cccd','cccdBack','cccdQR','the3x4','bangLaiFront','bangLaiBack']) {
       const f = await draftLoadPhoto(key);
       if (f) setDocFiles(prev => ({ ...prev, [key]: f }));
     }
     ```
   - On successful submit (after all uploads complete): clear the IndexedDB draft:
     `draftClearPhotos()` AND `localStorage.removeItem(DRAFT_KEY)`.

3. Same pattern for `GuestStudentDetail`:
   - Save picked photos to IndexedDB on pick.
   - Load from IndexedDB on mount (restoring from where they left off).
   - Clear on successful save.

### Acceptance criteria
- Pick a photo, close the modal, reopen → photo is still there.
- Pick a photo, kill the app, reopen → photo is still there (IndexedDB persists).
- Successfully save → draft is cleared, fresh start next time.
- Text fields continue to work via localStorage (no regression).

### Gotchas
- **IndexedDB is async** — loading photos on modal open needs to be async. Use a
  loading indicator ("Đang khôi phục ảnh...") or load them silently before the
  modal renders.
- IndexedDB keys should be scoped to avoid collisions: use `draft_{studentId}_{key}`
  for the detail view and `draft_new_{key}` for the add modal.
- On iOS WKWebView, IndexedDB has a storage limit (~50MB). 6 photos at ~2MB each
  = ~12MB — well within limits. But cap stored files at e.g. 5MB to be safe.
- The `draftClearPhotos` on success must happen AFTER all upload promises resolve,
  not before. Currently, `setSuccess(...)` fires before docs finish uploading
  (this is a separate bug — Task #7). Don't clear draft until Task #7 is also done.

---

## TASK 6 — Silent re-authentication (no page reload on 401)
**Priority:** high (data preservation) | **Risk:** medium | **Scope:** frontend

### Context
The mobile app uses Bearer tokens (JWT, 14-day TTL). When a token expires mid-session:
- `api()` (data-loader.js:52) does `window.location.reload()` — destroys all React state
  including picked photos, modal state, scroll position.
- `_upload` (data-loader.js:769) doesn't handle 401 at all — just throws
  `"upload_failed: 401"`.
- The native app stores login credentials in Capacitor Preferences (native-bridge.js:32-33).
  These are available for silent re-login.

### Problem
A 401 during the add-student flow wipes the modal and every photo the user picked.
On a long session (CTV working all day), this is a realistic scenario.

### Files
- `frontend/data-loader.js` — `api()` (line 42-58), `_upload` (line 764-769)
- `mobile/src/native-bridge.js` — `MGT_CREDS` (line 42), `MGT_SAVE_TOKEN` (line 26)

### Plan
1. Add a module-level `_reauth()` function in data-loader.js:
   ```js
   let _reauthing = null;  // singleton — don't fire multiple re-auths
   async function _reauth() {
     if (_reauthing) return _reauthing;
     _reauthing = (async () => {
       try {
         const creds = window.MGT_CREDS;
         if (!creds || !creds.email || !creds.password) return false;
         const res = await fetch(API + '/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: creds.email, password: creds.password }),
         });
         if (!res.ok) return false;
         const out = await res.json();
         if (out && out.token) {
           window.MGT_TOKEN = out.token;
           try { window.MGT_SAVE_TOKEN && await window.MGT_SAVE_TOKEN(out.token); } catch {}
           return true;
         }
         return false;
       } catch { return false; }
       finally { _reauthing = null; }
     })();
     return _reauthing;
   }
   ```

2. In `api()` (line 52): replace the hard reload:
   ```js
   // OLD: if (res.status === 401 && path !== '/me') { window.location.reload(); ... }
   // NEW:
   if (res.status === 401 && path !== '/me') {
     if (await _reauth()) {
       // Retry the original request once with the new token
       return api(path, opts);  // recursive — but guarded by one-shot via _reauth
     }
     // Re-auth failed — this is a guest/CTV with no saved creds. Show login overlay.
     window.location.reload();
     throw new Error('auth_required');
   }
   ```
   **IMPORTANT:** Add a recursion guard — track `_retriedPaths` or a boolean flag so
   `api()` doesn't infinitely retry after re-auth succeeds but the retry also 401s.

3. In `_upload` (line 764): add the same 401 handling:
   ```js
   if (res.status === 401) {
     if (await _reauth()) {
       // Retry the upload with new token
       const fd2 = new FormData(); fd2.append('file', file);
       const res2 = await fetch(API + path, { method: 'POST', credentials: 'include',
         headers: window.MGT_TOKEN ? { Authorization: 'Bearer ' + window.MGT_TOKEN } : {},
         body: fd2 });
       if (!res2.ok) throw new Error(_humanError(new Error('upload_failed:' + res2.status), 'upload'));
       return res2.json();
     }
     throw new Error(_humanError(new Error('auth_expired'), 'auth'));
   }
   ```

4. **NO reload during the add/edit flow.** The key invariant: if `_reauth()` succeeds,
   React state is preserved — the modal stays open, photos stay picked, the user
   doesn't notice anything happened.

### Acceptance criteria
- Token expiry during add-student: re-auth happens silently, photos survive, upload
  completes normally.
- Token expiry during edit-student: same — photos survive, save completes.
- If re-auth fails (no saved creds): graceful fallback to reload (web path unchanged).
- No infinite retry loops (one re-auth attempt per request).

### Gotchas
- **Web users (no native bridge) have no saved creds.** `_reauth()` returns false,
  and the existing reload behavior fires. This is correct — web users log in via
  the login overlay after reload.
- The `_reauth` singleton must clear on completion so subsequent 401s (different token
  expiry) trigger a fresh re-auth.
- Don't re-auth on the `/me` endpoint itself (already guarded by `path !== '/me'`).

---

## TASK 7 — Prevent ALL partial success (the success gate)
**Priority:** CRITICAL (highest importance per user) | **Risk:** high | **Scope:** frontend

### Context
The user's #1 complaint: "NEVER allow partial success or fill in later or any of that shit."
Currently, both submit handlers create the student first, then upload photos in a loop.
If ANY photo fails, the error is swallowed into a toast and the green success screen
still shows. The student exists in the DB but is missing documents. The user thinks
everything saved. This is unacceptable.

### Current behavior (CONFIRMED by code trace)

**Add modal** (`GuestAddStudentModal.submit`, screen-guest.jsx:526-576):
```
Line 556: const created = await D.api.createStudent(...)   ← student created in DB
Line 560-564: for loop over photos:
  catch (e) { gToast(`Lỗi tải ảnh ${key}: ${e.message}`, "error"); }  ← swallowed!
Line 566: setSuccess({...})  ← ALWAYS fires, even if photos failed
```

**Detail view** (`GuestStudentDetail.submit`, screen-guest.jsx:325-347):
```
Line 336: await D.api.updateStudent(...)   ← fields saved
Line 337-341: for loop over photos:
  catch (e) { gToast(`Lỗi tải ảnh ${key}: ${e.message}`, "error"); }  ← swallowed!
Line 342: gToast("Đã lưu thay đổi.", "success")  ← ALWAYS shows success toast
```

### Plan

**Add modal — full rewrite of the submit success path:**

1. Collect upload results instead of swallowing:
   ```js
   const results = [];  // { key, ok, error }
   for (const [key, file] of Object.entries(uploadMap)) {
     if (!file) continue;
     try {
       await D.api.uploadStudentDoc(created.id, key, file);
       results.push({ key, ok: true });
     } catch (e) {
       results.push({ key, ok: false, error: e.message });
     }
   }
   ```

2. Define which docs are "required" (the ones that block success):
   ```js
   const REQUIRED_DOCS = ['cccd', 'cccdBack', 'the3x4', 'cccdQR'];
   const failedRequired = results.filter(r => !r.ok && REQUIRED_DOCS.includes(r.key));
   const failedOptional = results.filter(r => !r.ok && !REQUIRED_DOCS.includes(r.key));
   ```

3. Branch on results:

   **A) ALL uploads succeeded (or only optional docs failed):**
   - Show the green success screen (`setSuccess(...)`).
   - Toast for optional failures: `"Ảnh bằng lái chưa tải được, có thể bổ sung sau."`
   - Clear the draft (IndexedDB + localStorage).

   **B) ANY required doc failed:**
   - **DO NOT show the success screen.** Show a new "partial success" state instead.
   - This state shows:
     - Green banner: `"Hồ sơ đã tạo thành công!"` (the student IS created).
     - Then a clear section listing what failed:
       `"Một số ảnh chưa tải được:"` + a list of the failed required docs with
       their Vietnamese labels (CCCD trước, CCCD sau, Ảnh chân dung, Mã QR).
     - A **prominent retry button**: `"Tải lại ảnh còn thiếu"` — reruns only the
       failed uploads against `created.id`.
     - A secondary "Đóng" button to dismiss (student remains created, can complete
       photos later via the detail view).
   - Store `created.id` + the failed `File` objects in state so the retry button
     can access them.
   - The retry button uses the same sequential-upload loop, with a max 3 attempts
     (leveraging the retry-with-backoff from Task #8 if available).

   **C) `createStudent` itself failed:**
   - No student was created. Show the error in the existing `err` banner.
   - The modal stays open with all fields intact for retry.

4. **Document label map** for the failed-doc list:
   ```js
   const DOC_LABELS = {
     cccd: 'CCCD mặt trước', cccdBack: 'CCCD mặt sau',
     cccdQR: 'Mã QR CCCD', the3x4: 'Ảnh chân dung',
     bangLaiFront: 'Bằng lái trước', bangLaiBack: 'Bằng lái sau',
     gksk: 'Giấy khám sức khỏe', donDeNghi: 'Đề nghị',
   };
   ```

**Detail view — same pattern, adapted:**

5. In `GuestStudentDetail.submit`: collect results, check if any required docs failed.
   If so, show an error banner `"Các ảnh sau chưa được tải lên:"` + list + retry button.
   **Keep `newFiles` in state** (don't clear them) so the retry can access the File objects.
   Only clear `newFiles` after ALL uploads succeed.

6. **Clear `newFiles` ONLY on full success:**
   - Currently `setNewFiles({})` runs unconditionally at line 342.
   - Change to: only clear after verifying all results are `ok`.

### Acceptance criteria
- Creating a student where 1-2 required photos fail → user sees WHICH photos failed
  + a "Tải lại" button, NOT the green success screen.
- The retry button successfully uploads the remaining photos.
- Only when ALL required photos are uploaded does the green "TẠO HỒ SƠ THÀNH CÔNG"
  screen appear.
- The detail edit view has the same honest-failure behavior.
- Optional docs (bangLai) failing → still show success with a note.

### Gotchas
- The **student record is already created** when doc uploads run. We do NOT delete it
  on partial failure. The CTV can complete photos later via the detail view.
  This is the correct behavior because `students.delete = False` for CTVs.
- The retry button must be idempotent — calling `uploadStudentDoc` for an already-uploaded
  key simply overwrites the file (atomic single-column UPDATE in student_docs.py:68).
- **DON'T clear the draft** (IndexedDB) until the full success path. If the user closes
  mid-retry, the failed photos should still be in IndexedDB for next time.
- This task depends on the error humanization from Task #2 for the failed-doc labels.

---

## TASK 8 — Retry with exponential backoff on uploads
**Priority:** high (reliability) | **Risk:** low-medium | **Scope:** frontend

### Context
Mobile connections are flaky. A single network blip should not permanently lose a photo.

### Problem
`_upload` (data-loader.js:764) does a single `fetch` and throws on the first failure.
No retry, no backoff.

### Files
- `frontend/data-loader.js` — `_upload` (line 764), new retry helper

### Plan
1. Add a `_retryWithBackoff` helper:
   ```js
   async function _retryWithBackoff(fn, { attempts = 3, baseMs = 800, maxMs = 8000 } = {}) {
     for (let i = 0; i < attempts; i++) {
       try { return await fn(); }
       catch (e) {
         const retryable = !e || e.retryable !== false && (
           /failed to fetch|timeout|network|5\d\d|429/i.test(e.message || '') ||
           e.name === 'TypeError' || e.name === 'AbortError'
         );
         if (!retryable || i === attempts - 1) throw e;
         const delay = Math.min(baseMs * Math.pow(2, i) + Math.random() * 400, maxMs);
         await new Promise(r => setTimeout(r, delay));
       }
     }
   }
   ```

2. Wrap `_upload`'s fetch call in `_retryWithBackoff`:
   ```js
   async _upload(path, file) {
     if (window._MGT_OFFLINE) throw new Error('Không có mạng...');
     return _retryWithBackoff(async () => {
       const fd = new FormData(); fd.append('file', file);
       const res = await fetch(API + path, { method: 'POST', credentials: 'include',
         headers: window.MGT_TOKEN ? { Authorization: 'Bearer ' + window.MGT_TOKEN } : {},
         body: fd });
       if (res.status === 401) { /* re-auth logic from Task #6 */ }
       if (!res.ok) {
         const err = new Error(_humanError(/* ... */));
         err.retryable = (res.status === 429 || res.status >= 500);
         throw err;
       }
       return res.json();
     });
   }
   ```

3. **DO NOT retry `createStudent`** — it's a POST that creates a resource.
   Retrying could create duplicates. The 409 duplicate-CCD guard would catch it,
   but the error handling is wrong. Only retry the document uploads (which are
   idempotent: atomic column overwrite).

4. Surface attempt count in the toast for transparency:
   - If attempt 1 fails and retry starts: `gToast("Tải ảnh thất bại, đang thử lại...", "info")`.
   - If retry succeeds: no extra toast (the success state handles it).
   - If all retries fail: the error propagates to Task #7's result collector.

### Acceptance criteria
- A single network blip during upload → automatic retry, user sees brief "đang thử lại"
  toast, then success.
- 3 consecutive failures → error propagates honestly to the submit handler (Task #7).
- No retry on 400/403/409 (terminal errors).
- No retry on `createStudent` (non-idempotent).

### Gotchas
- The `AbortController` timeout from Task #9 (if implemented) should fire per-attempt,
  not per-retry-cycle. Each attempt gets its own timeout.
- Backoff jitter prevents thundering herd if multiple CTVs are uploading simultaneously.

---

## TASK 9 — Upload timeout via AbortController
**Priority:** high (UX) | **Risk:** very low | **Scope:** frontend

### Context
Without a timeout, a stalled connection leaves "Đang lưu..." displayed forever. The user
thinks the app is frozen and may force-kill it, causing data loss.

### Files
- `frontend/data-loader.js` — `_upload` (line 764)

### Plan
1. Add a `_fetchWithTimeout` wrapper:
   ```js
   async function _fetchWithTimeout(url, opts, ms = 30000) {
     const ctrl = new AbortController();
     const timer = setTimeout(() => ctrl.abort(), ms);
     try {
       const res = await fetch(url, { ...opts, signal: ctrl.signal });
       return res;
     } catch (e) {
       if (e.name === 'AbortError') {
         const err = new Error('timeout');
         err.retryable = true;  // Task #8 should retry this
         throw err;
       }
       throw e;
     } finally { clearTimeout(timer); }
   }
   ```

2. Use it inside `_upload` (and inside the retry wrapper from Task #8):
   ```js
   const res = await _fetchWithTimeout(API + path, { method: 'POST', ... }, 30000);
   ```

3. 30 seconds is generous for a mobile photo upload. If the user is on 2G/EDGE,
   the retry layer (Task #8) gives 3 chances. Total worst-case: ~3 × 30s + backoff.

### Acceptance criteria
- Stalled upload → after 30s, throws `timeout` error with `retryable = true`.
- Retry layer retries the timed-out attempt.
- "Đang lưu..." never stays on screen for more than ~30-40 seconds.

### Gotchas
- `AbortController` is supported in all modern browsers and WKWebView.
- The `clearTimeout` in `finally` prevents timer leaks on success.

---

## TASK 10 — Offline mode audit and fix
**Priority:** high (reliability) | **Risk:** medium | **Scope:** frontend

### Context
The user says offline mode was "developed pretty sloppy." Currently:
- `_MGT_OFFLINE` is set `true` on cached boot (data-loader.js:413).
- It's **never reset** — no `online` event listener, no re-probe.
- It blocks ALL writes (api() line 43, _upload line 765).
- The offline banner (app.jsx:337) reads `window._MGT_OFFLINE` as a **plain property**
  during React render — **non-reactive**, so even fixing the reset won't update the UI
  without a re-render trigger.

### Files
- `frontend/data-loader.js` — lines 43, 413, 765, new reconnect logic
- `frontend/app.jsx` — line 337-347 (offline banner)

### Plan

**Part A: Reconnect detection (data-loader.js):**

1. Add an `online` event listener after boot:
   ```js
   window.addEventListener('online', async () => {
     if (!window._MGT_OFFLINE) return;
     try {
       await api('/me');  // lightweight probe
       window._MGT_OFFLINE = false;
       window.dispatchEvent(new Event('mgt:connectivity'));
     } catch {}  // still offline — keep the flag
   });
   ```

2. Add a **visibilitychange** re-probe (for native WKWebView where `online` is unreliable):
   ```js
   document.addEventListener('visibilitychange', async () => {
     if (document.visibilityState !== 'visible' || !window._MGT_OFFLINE) return;
     try {
       await api('/me');
       window._MGT_OFFLINE = false;
       window.dispatchEvent(new Event('mgt:connectivity'));
     } catch {}
   });
   ```

3. When reconnecting, optionally **refresh the data snapshot** (re-fetch all entities
   and update the cache). This ensures the user sees current data after being offline.
   But this is secondary — clearing the flag to unblock writes is the priority.

**Part B: Reactive banner (app.jsx):**

4. Convert the offline banner from a plain property read to a React state hook:
   ```jsx
   function Boot() {
     const [offline, setOffline] = React.useState(!!window._MGT_OFFLINE);
     React.useEffect(() => {
       const fn = () => setOffline(!!window._MGT_OFFLINE);
       window.addEventListener('mgt:connectivity', fn);
       return () => window.removeEventListener('mgt:connectivity', fn);
     }, []);
     // ... render using `offline` instead of `window._MGT_OFFLINE`
   }
   ```

**Part C: Audit all `_MGT_OFFLINE` references:**

5. Grep for `_MGT_OFFLINE` across all files. Confirm each usage:
   - `data-loader.js:43` — `api()` blocks writes. KEEP (correct: don't POST while offline).
   - `data-loader.js:413` — set on cached boot. KEEP (correct: start in offline mode if booted from cache).
   - `data-loader.js:765` — `_upload` blocks. KEEP (can't upload without network).
   - `app.jsx:337` — banner display. FIX (make reactive per Part B).

6. Ensure the flag is **reset** (not just checked) when connectivity returns:
   - `window._MGT_OFFLINE = false` on successful `/me` probe.
   - The `mgt:connectivity` event triggers the banner update.

### Acceptance criteria
- User boots offline → banner shows. Gets Wi-Fi → banner disappears within seconds.
- After reconnect, uploads work without app restart.
- The banner updates reactively (no stale state).
- The `online` event + `visibilitychange` together cover both web and native.

### Gotchas
- **WKWebView `online` event is unreliable on iOS.** The `visibilitychange` fallback
  is essential for native. When the user switches back to the app (opens from background),
  it re-probes.
- Don't re-probe too frequently — debounce to avoid hammering `/me` on rapid
  visibility changes. A simple flag (`_lastProbe`) with a 5-second cooldown works.
- The `api('/me')` call during re-probe uses the Bearer token (if set) or cookie.
  On native, the token is in `window.MGT_TOKEN` from the boot gate. If it expired
  while offline, the probe 401s and `_MGT_OFFLINE` stays true (correct: need re-login).
- Consider adding a subtle **"Đã khôi phục kết nối"** toast when coming back online,
  so the user knows uploads will work again.

---

## Implementation Order

Recommended execution sequence. Each task is independent but some benefit from
earlier tasks being done first:

```
1. TASK 1  — LicenseType cleanup         (trivial, backend-only, quick win)
2. TASK 2  — Vietnamese errors            (no dependencies, immediate UX win)
3. TASK 3  — QR scan photo save           (no dependencies, data completeness)
4. TASK 9  — Upload timeout               (no dependencies, builds foundation)
5. TASK 8  — Retry with backoff           (benefits from Task 9's retryable flag)
6. TASK 4  — Address conversion on backend (medium, self-contained)
7. TASK 5  — Draft persistence            (no deps on upload fixes, but synergy)
8. TASK 6  — Silent re-auth               (benefits from Task 2's error mapping)
9. TASK 10 — Offline mode audit           (benefits from Task 6's _reauth pattern)
10. TASK 7 — Success gate                 (the capstone — depends on #2, #5, #6, #8)
```

**Deploy cadence:** Tasks 1-4 can be deployed immediately (backend + frontend).
Tasks 5-6 need frontend rebuild only. Tasks 7-10 benefit from being deployed together
as a "reliability batch."
