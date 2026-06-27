# Handoff — Collaborator (CTV) role + active-class access scoping

**Date:** 2026-06-07
**Status:** Code complete & parse/integration-checked. **Not deployed** — needs the new migration run (see Deferred steps).

---

## What changed (product)

1. **New role `collaborator` (CTV)** — lower than staff. Permissions are **fixed by role**: `students` create + read only; everything else denied. (Admin = all; staff = DB permission grid, unchanged.)
2. **CTV multi-assignment** — a CTV can be assigned to **multiple branches AND multiple classes** (many-to-many). Staff still uses its single `branch_id`.
3. **Active-class access gating (CTV ONLY)** — collaborators can only interact with student profiles whose **assigned** class is **`đang mở`** or **`đang diễn ra`** (not `đã kết thúc`). **Staff are unchanged** — branch-scoped, all classes (incl. đã kết thúc). Admin sees all.
4. **Account form** — `TẠO TÀI KHOẢN` now offers **Cộng tác viên**; when chosen, the single "Chi nhánh" select is replaced by **"Chi nhánh được giao"** + **"Lớp được giao"**, both add-one-at-a-time dropdown→pill controls. "Lớp được giao" lists only **active** classes.

> The CTV-facing **portal** (where a CTV actually adds profiles) is still future work. This builds the role, assignment model, access scoping, and the admin UI to manage CTVs.

---

## Access model (single source of truth)

`accessible_class_ids(db, user)` (in `dependencies.py`) — **collaborator-only**:
- **admin** → `None` (no filter, sees all).
- **staff** → `None` (NOT class-gated; branch scoping applied in routers, unchanged — staff still see every class incl. đã kết thúc).
- **collaborator** → set of active classes among the user's **assigned** classes (`user_class_assignments`).

"Active" = status ∈ {`đang mở`, `đang diễn ra`}. `compute_class_status(cls, now)` mirrors the frontend formula: override (`Class.trang_thai` `cancelled`/`completed`) wins → `ngay_ket_thuc < today` = đã kết thúc → `ngay_khai_giang > today` = đang mở → else đang diễn ra.

Per-role access (`_student_accessible` + list filter):
- **staff** → student in the staff's branch (`Student.branch_id == user.branch_id`), all classes — **original behavior, untouched**.
- **collaborator** → student enrolled (non-deleted `ClassEnrollment`) in an assigned active class; create validates target class ∈ accessible set (403 `class_not_accessible`); inaccessible reads → 404.
- **admin** → unrestricted.

---

## Files changed

### Backend
- `app/models/enums.py` — `RoleName.collaborator`.
- `app/models/user_assignment.py` — **NEW**: `UserBranchAssignment` (`user_branch_assignments`), `UserClassAssignment` (`user_class_assignments`); UUID pk + soft-delete, unique (user_id, branch_id)/(user_id, class_id), FKs `ON DELETE CASCADE`.
- `app/models/__init__.py` — register the two new models.
- `app/dependencies.py` — `load_permissions` collaborator branch; new `compute_class_status`, `accessible_class_ids`, `load_user_assignments`.
- `app/routers/students.py` — list/`_student_accessible` scoping via enrollment subquery; create/update/docs/`{id}/payments` gated.
- `app/routers/accounts.py` — create/update accept `branchIds`/`classIds`, resolve slugs→uuids, replace join rows, **audit `log_action`** (+commit); wire shape returns assignments; allows `collaborator`.
- `app/schemas/auth.py`, `app/routers/me.py`, `app/routers/auth.py` — `WireUser` + `/me` + login carry `branchIds`/`classIds`.
- `alembic/versions/a2b3c4d5e6f7_add_user_assignment_tables.py` — **NEW** migration. revision `a2b3c4d5e6f7`, down_revision `f1a2b3c4d5e6` (current head). Creates/drops both tables.

### Frontend
- `atoms.jsx` — **NEW `TagSelect`** atom (dropdown adds one option at a time as a removable pill; only selected pills shown; dropdown lists the rest). Exported on `window`.
- `screen-org.jsx` — role option **Cộng tác viên** + labels; `RecordCreatorModal`/`EditRecordModal` gain `type: "tagselect"` + conditional fields via `showIf(values)` (`fieldVisible` filters render, `stripHidden` drops hidden fields from the payload). Account fields: `branchId` shown when `role !== collaborator`; `branchIds` (branches) + `classIds` (active classes only) shown when `role === collaborator`.
- `data-loader.js` — account objects default `branchIds`/`classIds` to `[]`; `createAccount`/`updateAccount` forward them.

---

## Wire contract
- Account gains `branchIds: string[]` (branch **slugs**) + `classIds: string[]` (class **UUIDs**). Empty for admin/staff; staff keeps `branchId`.
- Role wire value `collaborator`.

---

## Deferred manual steps (deploy)
1. Run migrations: `docker compose exec backend alembic upgrade head` → applies `f1a2b3c4d5e6` then `a2b3c4d5e6f7`.
2. Rebuild/restart backend + frontend.
3. Verify: create a Cộng tác viên with 2 branches + 2 active classes; confirm it sees only students in those active classes; confirm an ended class drops out of "Lớp được giao".

## Notes / assumptions (from build)
- Class model file is `class_model.py`; `openDate=ngay_khai_giang`, `examDate=ngay_ket_thuc`. No dedicated `status_override` column — override is derived from `Class.trang_thai` (`cancelled`/`completed`), consistent with `routers/classes.py`.
- No single-student GET endpoint exists; the per-student `GET /students/{id}/payments` is the gated read.
- The repo `CLAUDE.md` previously said "two roles / no UserPermission table" — the actual code has a UserPermission table; now three roles.
