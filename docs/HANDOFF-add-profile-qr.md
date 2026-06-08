# Handoff — Add-Profile: OCR → QR + 8 document slots

**Date:** 2026-06-07
**Scope:** The "Thêm hồ sơ" (add student profile) flow — `AddStudentModal`.
**Status:** Code complete & syntax-verified. **Not yet deployed** (no DB migration run, no container restart). See *Deferred manual steps*.

---

## What changed (product)

1. **OCR auto-fill disabled.** Dropping the CCCD photo no longer calls the OCR microservice.
2. **QR auto-fill added.** A new **QR CCCD** slot scans the official CCCD QR code **locally** (no external service) and fills the form. QR data is treated as authoritative and **overwrites** fields even if already typed.
3. **Document slots: 4 → 8.** New: `cccdBack`, `cccdQR`, `bangLaiFront`, `bangLaiBack`.
4. **Modal slot order:** `Giấy khám sức khỏe` ↔ `Thẻ 3×4` swapped (modal only; detail screen keeps canonical order).
5. **Giới tính** is now a **Nam/Nữ dropdown** (was free text). QR fills it with the exact "Nam"/"Nữ" the option values expect.
6. **Quê quán → Nơi tạm trú.** The CCCD QR has **no quê quán** (only Nơi thường trú). So the `queQuan` field was renamed to **`noiTamTru`** (temporary residence, manual). On QR scan it **auto-copies Nơi thường trú** (the QR's address) — staff can edit. Backend reuses the existing `tinh_thanh` column (no migration); wire field `queQuan` → `noiTamTru`.
7. **Nơi cấp** re-enabled; QR autofill sets its default to **"Cục CS QLHC về TTXH"**.

> Atom change: `Input` (atoms.jsx) gained a `disabled` prop (greyed + non-editable) during this work; currently unused by the modal but available.

### Canonical document map (single source of truth)

| key | label | backend column | required |
|---|---|---|---|
| `cccd` | CCCD mặt trước | `cmnd_front_url` | ✓ |
| `cccdBack` | CCCD mặt sau | `cmnd_back_url` *(pre-existing col)* | ✓ |
| `cccdQR` | QR CCCD | `docs_cccd_qr_url` *(new)* | ✓ (autofill source) |
| `gksk` | Giấy khám sức khỏe | `docs_gksk_url` | ✓ |
| `donDeNghi` | Đơn đề nghị học | `docs_don_de_nghi_url` | ✓ |
| `the3x4` | Thẻ 3×4 | `anh_the_url` | ✓ |
| `bangLaiFront` | Bằng lái mặt trước | `docs_bang_lai_front_url` *(new)* | ✗ optional |
| `bangLaiBack` | Bằng lái mặt sau | `docs_bang_lai_back_url` *(new)* | ✗ optional |

Wire field names (`_to_wire` → frontend `docs` object): `docs_cccd`, `docs_cccdBack`, `docs_cccdQR`, `docs_gksk`, `docs_donDeNghi`, `docs_the3x4`, `docs_bangLaiFront`, `docs_bangLaiBack`.

---

## Files changed

### Frontend
- **`frontend/modals.jsx`** — `AddStudentModal`: removed OCR logic from `handleDocDrop`; added QR scan on the `cccdQR` slot via `window.MGT_QR.scanFile`; QR fill **overwrites** typed fields; `docs` state + completeness now derived from `D.PROFILE_DOCS` (`required` flag); footer counts missing *required* docs; modal-local `gksk`/`the3x4` order swap (`modalDocs`).
- **`frontend/data-loader.js`** — added `window.MGT_QR` (local QR engine, see below); added the 3 new keys to every per-student `docs` object (3 spots: initial load, create-normalize, update-merge). The old `api.ocrCccd()` method remains but is now unused.
- **`frontend/vendor/jsqr.min.js`** — vendored jsQR 1.4.0 (pure-JS QR decoder; lazy-loaded). Chosen over `BarcodeDetector` for cross-platform support (incl. iOS) — relevant to the planned mobile CTV Portal.

### Backend
- **`backend/app/models/student.py`** — new nullable columns `docs_cccd_qr_url`, `docs_bang_lai_front_url`, `docs_bang_lai_back_url` (`cmnd_back_url` already existed).
- **`backend/app/routers/constants.py`** — `PROFILE_DOCS` now 7 entries, each with a `required` flag.
- **`backend/app/routers/students.py`** — `_to_wire` docs mapping, `StudentDocsFlags`, `DOC_KEYS`, and upload/delete URL routing all extended for the 3 new keys.
- **`backend/alembic/versions/f1a2b3c4d5e6_add_extra_student_doc_columns.py`** — new migration (revision `f1a2b3c4d5e6`, down_revision `e1a2b3c4d5e6` = prior head). Adds the 2 new columns (`IF NOT EXISTS`), drops on downgrade.

---

## QR engine — `window.MGT_QR`

```
window.MGT_QR.scanFile(file) → Promise<{ ok, fields, raw, error }>
window.MGT_QR.parseCCCD(raw) → fields object   // exported for testing
```
- `fields` subset of `{ idNumber, name, dob, gender, address, ngayCapCCCD }`; dates as `dd/mm/yyyy`.
- Decode path: `BarcodeDetector` fast-path → vendored **jsQR** fallback. Image downscaled to ≤1600px long edge before decode.
- **CCCD QR format** (Ministry of Public Security, pipe-delimited, no header):
  `CCCD | oldCMND | FullName | dob(ddMMyyyy) | Gender | Address | issueDate(ddMMyyyy)`
  (`queQuan` is **not** in the QR — left for manual entry.)

---

## Preview locally now (no Docker)

The preview runs as an **in-memory** Node server — its program is piped to
`node` via stdin and the preview HTML is served from a string, so **nothing
is written to the repo**. It serves the real `atoms.jsx` / `modals.jsx` /
`data-loader.js` / CSS / `vendor/jsqr.min.js` from disk, but the preview
harness itself only lives in the running process.

Open **http://localhost:8123/**. Drop a CCCD photo with a clear QR onto the
**QR CCCD** slot to see real local autofill. "Lưu" logs the payload to the
console.

The server is a **session-bound background task** — when the Claude Code
session ends, the process is killed and there is **nothing left to clean
up** (no preview files were ever persisted). `vendor/jsqr.min.js` and this
handoff doc are intentionally permanent (real feature, real docs).

> Note: relying on a process signal handler to self-delete files does NOT
> work here — the harness force-kills background tasks, so signal/exit
> handlers never run. That is exactly why the preview keeps zero files on
> disk instead.

---

## Deferred manual steps (do at final deploy)

1. **Run the migration:** `docker compose exec backend alembic upgrade head` (applies `f1a2b3c4d5e6`).
2. **Rebuild/restart** backend + frontend containers so new code + columns are live.
3. **No dev artifacts to remove** — the preview is in-memory (see above). The only added file is `frontend/vendor/jsqr.min.js`, which is a real dependency to keep.
4. **Optional cleanup:** the now-unused frontend `api.ocrCccd()` method and the backend OCR `/api/ocr/cccd` route + `ocr_service` — left in place intentionally (reusable infra). Remove only if you've confirmed nothing else uses OCR.
5. **Verify** `GET /api/constants/profile-docs` returns 7 docs with `required` flags after deploy.

---

## Notes / follow-ups
- Frozen-visual contract: changes here are plumbing + the user-approved slot-order swap. No colors/fonts/spacing/animation/grid-column changes.
- Next planned work: extract this flow into the **CTV Portal** (mobile-first, cross-platform). The local QR engine + vendored jsQR were chosen to carry over directly.
