# Changes — session 29 Jun 2026 — CTV "Bảng vàng" polish (round 4)

Four tweaks to the CTV award dialog + Excel sheet 3.

### Taller cards + breathing room (`screen-org-ctv-competition.jsx`)
Card `minH` bumped (232→264 champion, 196→228 flanks) and an explicit spacer row
(22px champion / 18px flanks) inserted between the name and the hero number — sits
exactly where the removed branch line was, a bit taller, so the cards aren't cramped.

### Avatar glow → outward particle stream (`screen-org-ctv-competition.jsx`)
The weak `ctv-glow-pulse` aura is replaced by a continuous outward particle flow:
16 bright glitter/spark dots (`CTV_PARTICLES` + `ctv-spark` keyframe) stream out
linearly in evenly-spaced directions and loop, staggered so emission is steady, not
a synced burst. Each spark carries its own `box-shadow` glow for contrast. The static
background aura is kept but dimmed (opacity 0.4, glow 20→14px) so sparks read crisp.

### Confetti wipe-in now matches wipe-out, both 5s (`screen-org-ctv-competition.jsx`)
Both `ctv-confetti-in` and `ctv-confetti-out` are now 5000ms linear (were 420/520ms),
so the downward clip-path wipe is slow enough to notice on both entry and exit. Exit
unmount timer bumped to 5000ms to cover the full wipe-out.

### Excel sheet 3 podium — symmetric right gutter (`reports_xlsx.py`)
The board had a dark night gutter on column A (left) but nothing mirroring it on the
right. Bumped `NCOL` 7→8 so column H becomes a matching night gutter (width 6, same as
A); the rest-list header/rows/merges extended to col 8 so nothing dangles. Board is now
left-right symmetric. Verified via openpyxl smoke render (full + 0/2/4-CTV edge cases).

---

# Changes — session 29 Jun 2026 — CTV "Bảng vàng" polish (round 3)

Six tweaks to the CTV award dialog + Excel, all in `screen-org-ctv-competition.jsx`,
`reports_xlsx.py`, `reports.py`.

### Confetti now plays for everyone (`screen-org-ctv-competition.jsx`)
Dropped the reduced-motion branch entirely — the full falling loop now runs regardless
of the OS "Show animations" setting (the static-scatter fallback is gone). Appear/disappear
is now a **downward clip-path wipe** (`inset(0 0 100% 0)` → `inset(0 0 0 0)` on open, and
on→`inset(100% 0 0 0)` on close) instead of a flat fade, so it reads as confetti starting /
stopping at the source while the tail keeps falling. Exit timer bumped 480→540ms to cover it.

### Avatar idle glow (`screen-org-ctv-competition.jsx`)
The avatar's static background glow is now an **outward-flowing looping pulse** — a radial
aura behind the circle that scales out and fades (`ctv-glow-pulse`), staggered per place.

### Card flash on all three (`screen-org-ctv-competition.jsx`)
The shimmer sweep used to be champion-only. Every card now flashes; the champion's is
stronger (30% tint) and faster (2600ms), the flanks weaker (15%) and slower (4400ms).

### Branch line removed (`screen-org-ctv-competition.jsx`)
Dropped the branch sub-label under each podium name — name + count only now.

### HẠNG → TOP everywhere (`reports_xlsx.py`)
All remaining "HẠNG" buzzwords (column headers + the podium pedestal label) are now "TOP"
(e.g. "TOP 1"). Matches the in-app pill wording.

### Sheet 3 renamed (`reports.py`)
The gamey podium sheet "Podium CTV" → **"Bảng vàng CTV đẹp"** (sheet 2 list keeps "Bảng vàng CTV").

---

# Changes — session 29 Jun 2026 — CTV "Bảng vàng" polish (follow-up fixes)

Two corrections after the first polish pass.

### Confetti never showed (`screen-org-ctv-competition.jsx`)
The confetti layer was the **only** element with a `prefers-reduced-motion: reduce` guard,
and that guard set `opacity: 0 !important` → it hid confetti entirely. On Windows the OS
"Show animations" toggle maps to that query and is **off** on many machines, so users saw
the cards animate but zero confetti. Fix: reduced-motion now renders a **static scattered
celebration** (pieces frozen across the viewport, each given a `top`/`rot`) instead of
nothing; full falling loop is unchanged for everyone else. Detection moved to a live
`matchMedia` listener in JS (a CSS media query can't set per-piece scatter positions).

### Excel podium board added as **sheet 3** (`reports_xlsx.py`, `reports.py`)
The first pass replaced sheet 2 with a rank-ascending *list* — it dropped the approved
gamey board. Corrected: sheet 2 (the bordered list) is **kept intact**; a new
`ctv_podium_sheet` builds a **visual 2-1-3 podium** as sheet 3 ("Podium CTV"):
three colored pillars on a deep-night arena, champion center+raised (amber, thick gold
frame), rank 2 left (lime), rank 3 right (cyan). Each pillar stacks merged rows so the
profile count is a big hero number, name medium, branch small; a darker pedestal "HẠNG N"
step sits under each. "CÁC CTV KHÁC" list follows for rank 4+. Shares
`compute_ctv_ranking` (single source of truth); handles <3 and 0 CTVs gracefully.
Verified via openpyxl smoke render (full 3-sheet workbook + 2-CTV + 0-CTV edge cases).

---

# Changes — session 29 Jun 2026 — CTV "Bảng vàng" polish

Polish pass on the already-shipped CTV competition feature. Four disjoint files touched.
Rank→color is now **amber (1) / lime (2) / cyan (3)** everywhere — dialog, Excel, and the
launcher pill all agree (was cyan/lime/pink).

## Frontend

### Launcher pill relocated (`screen-org.jsx`)
- `CtvCompetitionLauncher` was a floating bottom-right body-portal pill; it's now a **compact
  inline pill in the AccountsTab header row, immediately left of "Tạo tài khoản"** (same line,
  right edge). Restyled to the `Button size="sm"` vocabulary (padding `7px 12px`, radius 10,
  font 12), tinted amber via `--neon-amber` border/icon + `-glow`/`-haze` shadows on `--glass-2`.
- Removed the old `OrganizationScreen`-level mount + its now-unused `role`/`isCtv` locals; the
  admin/staff guard now lives in `AccountsTab` (`{!isCtv && <CtvCompetitionLauncher/>}`).
- Added `refreshComp` (calls `fetchCtvCompetition(…, { fresh: true })`, toggles loading) wired
  to the dialog's new `onRefresh`.

### Dialog polish (`screen-org-ctv-competition.jsx`)
- **Recolored** podium to amber/lime/cyan; loading spinner now amber.
- **Cleaner layout**: dropped the redundant numeric medal disc (rank now in a single tone "HẠNG N"
  pill), grouped avatar+name+branch into one quiet identity block, count-up number is the hero.
- **Entrance animation**: replaced the springy `ctv-rise` with `ctv-grow-up` — a `clip-path` upward
  wipe on a firm overshoot-free ease (no bounce), reads like a leaderboard column rising. Staggered
  champion-first.
- **Confetti** (`CtvConfetti`): full-viewport portal layer (zIndex 1001, `pointer-events:none`),
  84 pieces, burst-on-open (negative delays seed mid-flight) → infinite loop → fade + 48px downward
  drift on close (no abrupt cut). Respects `prefers-reduced-motion`.
- **Footer**: "Đóng" replaced with ghost **"Làm mới"** (recompute + replay). Close stays on Modal
  X / Esc. Podium keyed on a `renderKey` nonce so cards remount + CountUp replays on open and refresh.

### Data loader (`data-loader.js`)
- `fetchCtvCompetition(month, year, opts)` — `opts.fresh === true` appends `?fresh=1`. Query string
  built robustly via array join. New `cached` field documented.

## Backend

### Ranking cache (`reports.py`, `core/cache.py`)
- `GET /reports/ctv-competition.json` caches its payload in Redis, key `ctv_competition:{year}:{month}`
  (`CacheKeys.CTV_COMPETITION`), TTL 300s. Adds `"cached": bool` to the response (shape otherwise
  unchanged). `?fresh=1` bypasses + refreshes the cache.
- New `_resolve_month_year()` helper resolves the default month **before** building the cache key
  (no-DB), so the default-month case caches under its real key. `cache.get`/`set` wrapped in
  try/except → Redis outage degrades to compute-and-return, never 500s.

### Excel trophy-banner (`reports_xlsx.py`)
- `ctv_competition_sheet` rebuilt into a bold report: tall merged 🏆 banner, month band, totals,
  then a 4-col podium block with 🥇👑/🥈/🥉 medals in amber/lime/cyan, **thick dark-amber frame on
  the champion row**, medium teal boxes on 2/3, ranked list below.
- Rank fill palette updated to amber/lime/cyan across **both** CTV sheets (`ctv_students_sheet` +
  `ctv_competition_sheet`) so dialog + Excel agree.

---

# Changes — sessions 25–26 Jun 2026

All changes below are committed in one batch on top of `4915eee` (right-click edit branch dialog).
Everything is deployed live to `https://motogiathinh.centersai.com`.

---

## Backend

### 8-char student/payment ID support (`students.py`, `files.py`, `student_docs.py`)

The wire now sends `student.id` as an 8-char hex prefix (`s.id.hex[:8]`) instead of a full UUID.
All incoming IDs on mutating endpoints are resolved back to full UUID via a `LIKE 'xxxxxxxx%'` lookup.

- **`students.py`** — added `_get_student(db, id_str)` helper that resolves 8-char or full UUID.
  `_to_wire()` now returns `"id": s.id.hex[:8]`. Doc file URLs use short ID too.
  `update_student` uses `_get_student` instead of bare `uuid.UUID()` parse.

- **`files.py`** — added `_resolve_rec_uuid(db, kind, rec_id)` so `GET /api/files/students/{id}/{file}`
  accepts 8-char `rec_id`. MinIO fetch still uses full UUID path internally.

- **`student_docs.py`** — simplified CTV doc-upload access: dropped the old `assigned_class_ids`
  (all-time class) path; now uses standard `_student_accessible` (active classes only) via
  the shared `_get_student` helper imported from `students.py`.

- **`dependencies.py`** — removed `assigned_class_ids` function (no longer referenced anywhere).

### Excel report — new file `reports_xlsx.py` + updated `reports.py`

`backend/app/routers/reports_xlsx.py` is a **new file** containing all openpyxl sheet builders.
`reports.py` imports it as `rx` and calls `rx.student_sheet(...)`, `rx.ctv_students_sheet(...)` etc.

**`GET /api/reports/data.xlsx`** now produces a 6-sheet workbook:

| Sheet | Builder | Notes |
|-------|---------|-------|
| Tổng quan | `summary_sheet` | KPI summary, per-branch table |
| Học viên | `student_sheet` | 18 columns — see below |
| Thanh toán | `payment_sheet` | full payment ledger |
| Lớp học | `class_sheet` | all classes |
| CTV tháng M-YYYY | `ctv_students_sheet` | current month |
| CTV tháng M-YYYY | `ctv_students_sheet` | previous month |

**`student_sheet` column layout (18 cols):**

| # | Header | Source |
|---|--------|--------|
| 1 | MÃ HV | `s.ma_hoc_vien` |
| 2 | HỌ TÊN | `s.ten_hoc_vien` |
| 3 | NGÀY SINH | `s.ngay_sinh` |
| 4 | GIỚI TÍNH | enum → Vietnamese label |
| 5 | SỐ CCCD | `s.cccd_number` |
| 6 | Nơi thường trú - trên CCCD | `s.dia_chi` ← already populated |
| 7 | Nơi thường trú - địa chỉ mới | `s.noi_thuong_tru_moi` ← **empty until DB column added** |
| 8 | Mã QR CCCD | `s.cccd_qr_raw` ← **empty until DB column added** |
| 9 | ĐIỆN THOẠI | `s.so_dien_thoai` |
| 10 | LOẠI BẰNG | enum |
| 11 | TRẠNG THÁI | enum → Vietnamese label |
| 12 | NGÀY ĐĂNG KÝ | `s.ngay_dang_ky` |
| 13 | CHI NHÁNH | branch name |
| 14 | ĐÃ THANH TOÁN (đ) | sum of positive payments |
| 15 | CÒN LẠI (đ) | `total_fee - paid` |
| 16 | TRẠNG THÁI THANH TOÁN | derived |
| 17 | NGƯỜI TẠO | `responsible_staff.full_name` |
| 18 | GHI CHÚ | `s.ghi_chu` |

**`ctv_students_sheet` column layout (8 cols):**

`MÃ HV, HỌ TÊN, LOẠI BẰNG, NGÀY ĐĂNG KÝ, CHI NHÁNH, NGƯỜI TẠO, SỐ HỒ SƠ, HẠNG`

- SỐ HỒ SƠ = count of students this CTV referred in the month
- HẠNG = `"TOP 1"`, `"TOP 2"`, `"TOP 3"` … (string prefix, sorted by count desc)
- NGƯỜI TẠO renamed from old "NGƯỜI GIỚI THIỆU"

---

## Frontend

### `app.jsx` — export dialog footer hidden

The "Xuất báo cáo" `<Modal>` now has `footer={null}` — the Hủy/Lưu buttons are gone.
Users pick a format by clicking an option card; the dialog auto-closes after the download starts.

### `screen-dashboard.jsx` — branch palette + hero KPI editor

- Branch colour palette extended to `br-4` (Amber) and `br-5` (Lime) with a cyclic fallback
  function `_tonesFor()` for any `br-N` beyond the static map.
- Hero KPI cards are now editable: click a card to open a catalog picker, persisted to `localStorage`.
- Monthly KPI stats added to the single-pass stats loop.

### `screen-guest.jsx` — QR scan passthrough + download button

- `scanQr(file, preDecoded)` — if the native ML Kit scanner already decoded the QR (returned
  `raw` + `fields`), the client-side re-decode is skipped. Avoids double-decode on iOS.
- Download app button restyled from a full-width labelled button to a compact icon pill.

### `shell.jsx`

Minor layout/styling fixes (exact diff in git).

---

## What is NOT done yet — see `PENDING.md`

Cols 7 and 8 in the student Excel sheet (`noi_thuong_tru_moi`, `cccd_qr_raw`) will be empty
until the DB migration in `PENDING.md` is run.
