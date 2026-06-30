# STATUS — single source of truth

> **This is the ONE keeping file. Read it first; it is the only state/tracking doc.**
> It supersedes and absorbs every prior HANDOFF / CHANGELOG / TASKS / PLAN / CHANGES doc.
> Those were deleted on 2026-06-30 because they fragmented the picture and several
> carried a false "nothing is deployed yet" premise that would mislead a future agent.
>
> Three sections below: **(1) where we are now**, **(2) what's genuinely pending**,
> **(3) the dated change log** (folded in from the old `CHANGES.md`).
>
> - **How things work (reference, not tracking):** `CLAUDE.md` (root + `frontend/`), `AGENTS.md`.
> - **Process runbooks (still valid):** `docs/ios-distribution.md`, `mobile/README.md`.

---

## Where we are — checkpoint 2026-06-30

- **Repo:** git is live. Branch **`dev`**, last commit **`70a55af`**
  (`fix(isolate+ux): per-user cache scoping, background refresh, admin auto-save`).
- **Deployment model:** changes ship to the VPS by **`scp` to `/opt/motogiathinh/`**,
  often *ahead of* a git commit. So **"deployed" ≠ "committed."** The live site is
  `https://motogiathinh.centersai.com`.
- **Everything described as "pending deploy" in the old docs is LIVE.** Migrations are
  applied, the CTV role + portal, QR add-profile, address conversion, upload-reliability
  work, and cache isolation are all in production.

### Uncommitted-but-DEPLOYED working-tree changes (as of this checkpoint)

These are `scp`'d to the VPS and live, but still show as modified in `git status`.
Commit them when convenient (see `feedback_commits` — only push meaningful changes):

- **CTV data scope** — student + payment lists filtered by `responsible_staff_id`
  (a CTV sees only profiles they created, not the whole class). `students.py`, `payments.py`.
- **Admin guardrails** — account **deletion disabled** (403); account **name/email**
  and branch **address** locked as immutable identifiers (greyed in edit forms).
  `accounts.py`, `branches.py`, `screen-org.jsx`, `atoms.jsx`.
- **Account list** — default sort role (Admin→Staff→CTV) then lastActive desc.
- **Password policy** — CTV ≥1 char; admin/staff ≥6 + upper/lower/digit/special.
- **Guest role** — zeroed permissions, hidden from all UI (kept in enum for a future
  4th level). `dependencies.py`, `screen-org.jsx`.
- **Bảng vàng CTV dialog** — loading state is now a **skeleton podium** (3 mini cards
  matching the real layout) and the grow-up entrance is slower (1120ms, harder
  deceleration). `screen-org-ctv-competition.jsx` (this file is also still untracked in git).
- **Tài khoản page crash fix** — restored the `submit` fn in `PasswordResetModal`.
  Deployed; **awaiting user confirmation it renders.**
- **Add-profile submit gate + photo-draft symmetry** (01 Jul) — admin/staff `AddStudentModal`
  now gates close on full upload success (partial state + retry) and persists photos to
  IndexedDB like the CTV flow. `modals.jsx`, `app.jsx`, `screen-guest.jsx`. Deployed;
  **awaiting user confirmation.** See §3 change log for detail.

---

## Genuinely pending (real future work)

1. **8-char UUID native migration** — *only when the dataset is wiped/reset; do NOT do
   while live.* Today the wire truncates UUID→8 hex (`s.id.hex[:8]`) with `LIKE 'xxxxxxxx%'`
   resolvers. Native migration = change PK to `CHAR(8)`, generate via `secrets.token_hex(4)`,
   drop the LIKE resolvers, update `data-migration/migrate.py` + alembic.
2. **Notifications auto-recompute is a stub** — real upsert needs a `severity` column +
   nullable `user_id` on notifications (model tracks per-user delivery; sibling treats them
   as system-wide). Follow-up alembic migration pending. (See `CLAUDE.md`.)
3. **Mobile (Capacitor CTV app)** — Android debug APK builds; **iOS needs Apple Developer
   signing secrets** (full runbook: `docs/ios-distribution.md`). Before either ships:
   set `mobile/src/config.js` `MGT_API_BASE` to the prod HTTPS backend, `npm run build &&
   npx cap sync`, then **device-test** ML Kit scan + camera + back-nav (never verified on a
   real device).
4. **Deferred perf/security** — C3 query optimization, JWT blacklist on logout, and the
   remaining LOW-scope audit items.

---

## Resolved / obsolete — do NOT re-do (these are the traps in the old docs)

| Old doc claimed | Reality |
|---|---|
| "Uncommitted, make the initial commit, nothing deployed" | FALSE — fully committed (`70a55af`) + deployed |
| Run migrations `f1a2b3c4d5e6`, `a2b3c4d5e6f7` | Already applied in prod |
| Delete dev artifacts (`_qrlive.html`, `_https/`, …) | Already gone |
| Add `cccd_qr_raw` DB column | DONE — migration `c5d6e7f8a9b0` |
| Add `noi_thuong_tru_moi` DB column | **ABANDONED** — superseded by the two-column address model: `dia_chi_cccd` (OLD, on CCCD) + `dia_chi` (NEW, diachi.io-converted). Excel cols F/G/H use these. |
| Address conversion should move to backend | DONE — backend-owned (`address.py` `convert_single_address`) |
| Upload-reliability TASKS 1–10 | ALL DONE (commits `4b4a063`, `0b79b45`) — task 6 dropped by design |
| Cache/auth isolation plan | DONE (`70a55af`) |
| RECOMMENDATIONS R1 (persist QR payload) | DONE — `cccd_qr_raw` populated |

---

## Loose ends a future agent should know about

- **`build/`** — gitignored build/deploy output (contains a dated `.zip`). Not a tracking doc.

### Deleted 2026-06-30 (recorded so nobody hunts for them)

- **`_ctv_backup/`** (parent dir, *outside* git) — pre-commit snapshot + `ctv_feature.patch`
  from base `d390b8d`, taken before the CTV-competition work landed. That work is now committed,
  so the backup was obsolete. Deleted. *Not* git-reversible — but redundant with git history.
- **`frontend/data-loader-mock.js`** — untracked mock-data file for local UI preview, not
  referenced by any `index.html`. Orphan. Deleted.
- **`CHANGES.md`** — folded into the change log below, then deleted, so this file is the only
  keeping doc. Nothing lost; all entries are reproduced verbatim in §3.

---

## §3 — Change log (folded in from the old `CHANGES.md`)

### Session 01 Jul 2026 — CTV success gate (Task 7) + offline banner on portal

Closed the **partial-success hole** in the CTV portal (`screen-guest.jsx`). Both the
add-modal and the detail-view used to create/patch the student, then loop-upload photos
swallowing each failure into a toast, then show the green "thành công" screen
**unconditionally** — so a CTV could believe a profile was complete when half its required
docs never landed (and in the detail view, failed files were then discarded + the IndexedDB
draft wiped → permanent photo loss).

- **Success gate** — submit now **collects** per-upload results. The green `GuestSuccessView`
  (add modal) / success toast (detail) only fires when **every required doc** uploaded.
  Required = `cccd, cccdBack, cccdQR, the3x4` (`CTV_REQUIRED_DOCS`); the old-licence
  `bangLai*` pair is optional and never blocks success.
- **Partial state** — if a required doc fails, the flow holds in a `partial` state: banner
  naming the missing docs (`DOC_LABELS`) + "Tải lại ảnh còn thiếu" retry button that
  re-uploads **only** the failures. Photos + IndexedDB draft are **kept** on partial (no
  data loss); cleared only on full success.
- **Create/patch failure** → pink banner, form intact, student not left half-made.
- **Race hardening** (from adversarial plan audit) — `mountedRef` guards every post-await
  `setResult` (no unmounted-component updates if the user navigates away mid-upload);
  `retryBusyRef` (synchronous, not state) blocks double-tap retries; `failedDocs` cloned at
  retry start to dodge stale-closure reads; detail-view preserves `qrInfo` when `cccdQR` is
  among the failures so the retry isn't disabled by the QR-required guard.
- **Offline banner on the CTV portal** — the violet "Không có mạng" bar (already on the admin
  shell) now also renders at the top of `GuestApp` when `_MGT_OFFLINE` is set, so a CTV sees
  *why* uploads are blocked instead of hitting per-photo errors. (Reconnect detection +
  reactive clear were added in the prior offline-mode session.)
- Deployed; **awaiting user confirmation.** Offline-mode end-to-end refinement still open
  (see Pending).

### Session 01 Jul 2026 — admin/staff add-profile submit gate + photo-draft symmetry

Brought the **admin/staff** add-student web flow up to the same reliability guarantees the
**CTV/mobile** flow already had (`screen-guest.jsx`). Admin + staff share `AddStudentModal`
(only CTVs use the separate portal), so both roles are covered.

- **Submit gate** (`modals.jsx`, `app.jsx`) — the old admin modal fired `onSave()` then
  `onClose()` **synchronously**, so it closed into "success" the instant Save was clicked,
  regardless of whether photos actually uploaded (each upload failure was only a
  `console.warn` + transient toast). Now `AddStudentModal` owns the full create+upload
  lifecycle in its own `submit()`: `await createStudent`, then upload each doc one-by-one
  and **collect** failures. It only closes on full success (student created AND every
  attached photo landed). Partial uploads hold the modal open in a `partial` state — amber
  banner naming the missing docs + "Tải lại ảnh còn thiếu" retry button that re-uploads only
  the failures (no duplicate student). Create failure → pink banner, form intact.
  Double-submit guarded by `busyRef`. Removed the now-dead `onSave` handler in `app.jsx`
  (modal calls `D.api` directly; `createStudent` already `_bump()`s the list).
- **Photo-draft persistence** (`modals.jsx`, `screen-guest.jsx`) — admin modal previously
  kept picked photos only in React state, so any close lost them (text fields were already
  drafted via `_useDraft`). Now mirrors mobile: photos persist to IndexedDB on pick, restore
  on open, delete on slot-clear, and clear on full success (and on "Để sau" defer, since the
  student already exists). Reuses the mobile helpers — exposed from `screen-guest.jsx` as
  `window.MGT_DRAFT_PHOTOS.{save,load,clear,del}` (added a single-key `draftDeletePhoto`),
  under a separate `admin_new` prefix so admin and CTV drafts never collide.
- All three files pass a Babel JSX transform. Deployed; **awaiting user confirmation** —
  more fixes planned before the big commit + push.

### Session 30 Jun 2026 — docs cleanup + Bảng vàng polish + crash fix

**Tracking-doc consolidation.** Deleted nine stale tracking docs that carried a false
"nothing is deployed / make the initial commit" premise (repo is committed at `70a55af` on
`dev` and fully deployed): `PENDING.md`, `docs/HANDOFF.md`, `docs/HANDOFF-add-profile-qr.md`,
`docs/HANDOFF-collaborator-role.md`, `docs/CHANGELOG.md`, `docs/RECOMMENDATIONS.md`,
`docs/UPLOAD_RELIABILITY_CHANGELOG.md`, `docs/UPLOAD_RELIABILITY_TASKS.md`,
`docs/cache-isolation-fix-plan.md`. Replaced with this single `docs/STATUS.md`. Later also
absorbed `CHANGES.md` (this log) and deleted the two orphans above. Repointed live references
in `CLAUDE.md`, `mobile/README.md`, `frontend/CLAUDE.md`. Kept `docs/ios-distribution.md`.

**Bảng vàng CTV — skeleton loading + slower entrance** (`screen-org-ctv-competition.jsx`).
Loading state replaced the spinner + "Đang tổng hợp…" text with a **skeleton podium**: 3 mini
cards in the same 2-1-3 grid/colors as the real podium, pulsing placeholder elements (TOP pill,
avatar, name bar, count bar). When data lands, cards grow up from the skeleton silhouette.
Grow-up duration doubled (560ms→1120ms) with a harder end-deceleration ease
(`cubic-bezier(0.12, 1, 0.15, 1)`); stagger widened (80/220/360ms→120/340/560ms). Removed the
now-unused `ctv-spin` keyframe.

**Tài khoản page crash fix** (`screen-org.jsx`). Restored the `submit` function in
`PasswordResetModal` that was accidentally deleted during an earlier role/checks edit — its
absence threw a ReferenceError that the error boundary caught, blocking the whole tab.

### Session 30 Jun 2026 — CTV permission lockdown + admin guardrails + password/guest

- **CTV student visibility scoped to creator** (`students.py`) — `GET /api/students` for
  collaborator now also filters `responsible_staff_id == current_user.id`. thaianh (CTV)
  dropped 121 → 2 visible students.
- **CTV edit locked to own profiles** (`students.py`) — `_student_accessible()` checks
  `responsible_staff_id` first; a CTV can't PATCH/PUT students they didn't create.
- **CTV payment visibility scoped to own students** (`payments.py`).
- **Admin account deletion disabled** (`accounts.py`) — `DELETE` returns 403; accounts can
  only be deactivated. Prevents churning accounts under the 20-account billing threshold.
- **Account name + email locked on edit** (`accounts.py`, `screen-org.jsx`) — immutable
  identifiers for usage tracking; greyed in the edit modal.
- **Branch address locked on edit** (`branches.py`, `screen-org.jsx`) — permanent identifier.
- **Accounts default sort** (`screen-org.jsx`) — role priority (Admin→Staff→CTV) then
  lastActive desc.
- **`Select` atom `disabled` support** (`atoms.jsx`); `EditRecordModal`/`RecordCreatorModal`
  forward `f.disabled` to fields (`screen-org.jsx`).
- **Role-specific password rules** (`screen-org.jsx`) — CTV ≥1 char; admin/staff ≥6 +
  upper/lower/digit/special. Applied dynamically by role in creator + reset modals.
- **Guest role zeroed** (`dependencies.py`, `screen-org.jsx`) — no permissions anywhere;
  filtered out of the accounts list + role selector. Reserved for a future 4th-level role.

### Session 29 Jun 2026 — CTV "Bảng vàng" polish (round 4)

- **Taller cards + breathing room** (`screen-org-ctv-competition.jsx`) — `minH` bumped
  (232→264 champion, 196→228 flanks) + explicit spacer row (22/18px) between name and number.
- **Avatar glow → outward particle stream** — `ctv-glow-pulse` aura replaced by 16 bright
  glitter sparks (`CTV_PARTICLES` + `ctv-spark`) streaming out linearly, staggered for steady
  emission. Background aura kept but dimmed (opacity 0.4, glow 20→14px).
- **Confetti wipe-in matches wipe-out, both 5s** — `ctv-confetti-in`/`-out` now 5000ms linear
  (were 420/520ms); exit unmount timer bumped to 5000ms.
- **Excel sheet 3 podium — symmetric right gutter** (`reports_xlsx.py`) — `NCOL` 7→8 so col H
  is a matching night gutter; verified via openpyxl smoke render (full + 0/2/4-CTV edges).

### Session 29 Jun 2026 — CTV "Bảng vàng" polish (round 3)

- **Confetti plays for everyone** — dropped the reduced-motion branch; appear/disappear is a
  **downward clip-path wipe**; exit timer 480→540ms.
- **Avatar idle glow** — outward-flowing looping radial pulse (`ctv-glow-pulse`), staggered.
- **Card flash on all three** — champion stronger (30%/2600ms), flanks weaker (15%/4400ms).
- **Branch line removed** — name + count only.
- **HẠNG → TOP everywhere** (`reports_xlsx.py`) — headers + pedestal label.
- **Sheet 3 renamed** (`reports.py`) — "Podium CTV" → "Bảng vàng CTV đẹp" (sheet 2 keeps
  "Bảng vàng CTV").

### Session 29 Jun 2026 — CTV "Bảng vàng" polish (follow-up fixes)

- **Confetti never showed** — the confetti layer was the only element with a
  `prefers-reduced-motion: reduce` guard (`opacity:0 !important`); Windows "Show animations"
  off triggered it. Fixed: reduced-motion now renders a static scattered celebration; detection
  moved to a live `matchMedia` listener in JS.
- **Excel podium board added as sheet 3** (`reports_xlsx.py`, `reports.py`) — sheet 2 list kept
  intact; new `ctv_podium_sheet` builds a visual 2-1-3 podium (champion center+raised amber,
  rank 2 left lime, rank 3 right cyan), "CÁC CTV KHÁC" list for rank 4+. Shares
  `compute_ctv_ranking`; handles <3 and 0 CTVs. Verified via openpyxl smoke render.

### Session 29 Jun 2026 — CTV "Bảng vàng" polish (initial pass)

Rank→color unified to **amber (1) / lime (2) / cyan (3)** across dialog, Excel, launcher pill.

- **Launcher pill relocated** (`screen-org.jsx`) — from floating bottom-right body-portal to a
  compact inline pill in the AccountsTab header, left of "Tạo tài khoản"; `Button size="sm"`
  vocabulary, amber tint. Admin/staff guard moved into `AccountsTab`. Added `refreshComp`.
- **Dialog polish** (`screen-org-ctv-competition.jsx`) — amber/lime/cyan recolor; dropped medal
  disc (rank in a single "HẠNG N" pill); `ctv-grow-up` clip-path wipe replaces springy
  `ctv-rise`; confetti portal (84 pieces, burst→loop→fade+drift); footer "Đóng"→ghost "Làm mới";
  podium keyed on `renderKey` so CountUp replays.
- **Data loader** (`data-loader.js`) — `fetchCtvCompetition(month, year, opts)`; `opts.fresh`
  appends `?fresh=1`; new `cached` field.
- **Ranking cache** (`reports.py`, `core/cache.py`) — Redis key `ctv_competition:{year}:{month}`,
  TTL 300s, `?fresh=1` bypass; `_resolve_month_year()` resolves default month before key build;
  cache wrapped in try/except so Redis outage degrades gracefully.
- **Excel trophy-banner** (`reports_xlsx.py`) — `ctv_competition_sheet` rebuilt: 🏆 banner,
  month band, totals, 4-col podium with medals, thick dark-amber champion frame; rank palette
  amber/lime/cyan across both CTV sheets.

### Sessions 25–26 Jun 2026

Committed in one batch on top of `4915eee`; deployed live.

- **8-char student/payment ID support** (`students.py`, `files.py`, `student_docs.py`) — wire
  sends `s.id.hex[:8]`; mutating endpoints resolve back via `LIKE 'xxxxxxxx%'`. Added
  `_get_student` helper; `files.py` `_resolve_rec_uuid`; removed dead `assigned_class_ids`
  (`dependencies.py`).
- **Excel report — new `reports_xlsx.py`** + updated `reports.py` → 6-sheet workbook (Tổng quan,
  Học viên [18 cols], Thanh toán, Lớp học, CTV current month, CTV previous month).
  `ctv_students_sheet` 8 cols: `MÃ HV, HỌ TÊN, LOẠI BẰNG, NGÀY ĐĂNG KÝ, CHI NHÁNH, NGƯỜI TẠO,
  SỐ HỒ SƠ, HẠNG`. (Student-sheet cols F/G/H — see the Resolved table above for the current
  `dia_chi_cccd`/`dia_chi`/`cccd_qr_raw` sources; the old CHANGES.md table here was stale.)
- **Export dialog footer hidden** (`app.jsx`) — `footer={null}`; auto-closes after download.
- **Dashboard** (`screen-dashboard.jsx`) — branch palette extended to `br-4`/`br-5` + cyclic
  `_tonesFor()`; editable hero KPI cards persisted to localStorage; monthly KPI stats.
- **Guest portal** (`screen-guest.jsx`) — `scanQr` skips client re-decode when native ML Kit
  already decoded; download button → compact icon pill.
- **`shell.jsx`** — minor layout/styling fixes.
