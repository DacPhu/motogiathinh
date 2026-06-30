# CLAUDE.md — frontend package contract

> **You are an AI agent integrating this frontend with a backend.**
> Read this entire file before touching anything.

This folder ships with a **frozen visual design system**: the colors,
fonts, atom structure, layout, choreography, and screen-level information
hierarchy are signed off and must not regress. Polish sessions have
since landed a small set of admin-tool plumbing primitives (MoreMenu,
EditRecordModal, PasswordResetModal, DocLightbox) that live alongside
the original atoms — these are explicitly in-scope for future work.

You have **two jobs**:
1. wire the in-memory loader to your real backend, and
2. plumb new admin tooling consistent with the existing atom vocabulary.

If you're unsure whether a UX change is plumbing vs. visual, stop and ask.

---

## What you may edit

**`data-loader.js`** — the HTTP seam. Replace per-table fetches with
calls to your backend. The shape of `window.MGT_DATA` is frozen (see
`../BACKEND.md` "§5 Read endpoints" for the canonical entity schemas).
If your backend returns the data in a different shape, transform inside
`data-loader.js` to match.

**`*.jsx`** — for plumbing-only callback wiring + new admin tooling
that follows the existing visual idiom. Examples that landed in the
polish session:

- `MoreMenu` (the `···` row-action popover used across `screen-org.jsx`)
- `EditRecordModal` + `RecordCreatorModal` (shared field-driven dialogs)
- `PasswordResetModal` (admin row action for accounts)
- `DocLightbox` (inline preview for uploaded student docs)
- `ScreenErrorBoundary` (per-screen isolation wrapper)
- `branches CRUD UI` (`BranchesTab` create/edit/delete)
- `BienLaiPreview` drag-drop upload state in the payment modal

See `../DEPLOY.md §14 — Frontend deviations` for the authoritative
running list of what landed and why.

## What you may NOT edit without sign-off

The frozen visual design system. Specifically:

```
frontend/index.html              ← entry HTML, asset wiring, CSS keyframes
frontend/colors_and_type.css     ← design tokens (colors, type, spacing)
frontend/fonts/*                 ← SF Pro Display + SF Pro Text font files
frontend/assets/*                ← logo + brand SVGs
```

For `app.jsx`, `shell.jsx`, `atoms.jsx`, `list-tools.jsx`, `modals.jsx`,
`screen-*.jsx`: plumbing edits and admin-tool additions are in-scope,
but **changes to colors, fonts, spacing, animation timings, atom
structure, or screen layout require design sign-off**.

**If you find a UX bug in a frozen visual, stop and ask.** Don't fix
it yourself. The customer trusts that the visual + UX artefacts are
unchanged unless explicitly approved.

---

## How to integrate your backend

The contract you must satisfy is straightforward — the rest of the
app will call these methods on `window.MGT_DATA` and expect the
shapes documented in `../BACKEND.md`.

### Step 1 — choose your integration mode

| Mode | What you do |
|---|---|
| **A. Keep CSVs as your dev database** | Your real backend writes to / reads from the same CSV files. No code changes needed in `data-loader.js`. Useful when you're prototyping. |
| **B. Replace fetch with HTTP** | In `data-loader.js`, change the per-table `loadCsv(name, schema)` calls to fetch JSON from your API. Adapt the response into the same row shape. |
| **C. WebSocket / GraphQL** | Same as B but with your transport. The interface (`window.MGT_DATA`) doesn't change. |

### Step 2 — replace the data source (mode B example)

Inside `data-loader.js`, find:

```js
async function loadCsv(name, schema) {
  const res = await fetch("data/" + name + ".csv");
  ...
}
```

Replace with something like:

```js
async function loadEntity(name, schema) {
  const res = await fetch("/api/" + name);   // your backend route
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  const rows = await res.json();
  return rows.map(r => coerceRow(r, schema || {}));
}
```

Then change every `loadCsv("...", schema)` call to `loadEntity(...)`.
Coercion still happens via the schema map; your backend JSON should
already use the right field names.

### Step 3 — keep `window.MGT_DATA` shape identical

The frozen screens depend on these methods existing and returning
exactly these shapes:

```
MGT_DATA.branches        : Array<Branch>
MGT_DATA.accounts        : Array<Account>
MGT_DATA.feePlans        : Array<FeePlan>
MGT_DATA.promotions      : Array<Promotion>          // promotion.appliesTo = string[]
MGT_DATA.teachers        : Array<Teacher>
MGT_DATA.vehicles        : Array<Vehicle>
MGT_DATA.classes         : Array<Class>              // status derived from openDate/examDate vs _NOW
MGT_DATA.students        : Array<Student>            // paid/balance/paymentStatus/noPayOnRegistration derived from payments
MGT_DATA.payments        : Array<Payment>            // event log
MGT_DATA.notifications   : Array<Notification>
MGT_DATA.activityLog     : Array<ActivityLogEntry>

MGT_DATA.currentUser     : Account
MGT_DATA.NOW             : Date                      // server time
MGT_DATA.TODAY           : "dd/mm/yyyy"

MGT_DATA.getStaff(id)        → Account | undefined
MGT_DATA.getBranch(id)       → Branch  | undefined
MGT_DATA.getClass(id)        → Class   | undefined
MGT_DATA.getStudent(id)      → Student | undefined
MGT_DATA.getFeePlan(id)      → FeePlan | undefined
MGT_DATA.getPromotion(id)    → Promotion | undefined

MGT_DATA.paymentsForStudent(studentId)   → Payment[]
MGT_DATA.studentsInClass(classId)        → Student[]
MGT_DATA.paymentsToday()                 → Payment[]
MGT_DATA.studentsCreatedToday()          → Student[]
MGT_DATA.firstRecordMs()                 → number

MGT_DATA.revenueBuckets(grain, count, branchId?, mode)    → Array<{ label, tong, daNhan, conNo }>
MGT_DATA.studentBuckets(grain, count, branchId?, mode)    → Array<{ label, tong, A, A1 }>
MGT_DATA.revenueCumulative(grain, count, mode)            → same shape, cumulative
MGT_DATA.studentCumulative(grain, count, mode)            → same shape, cumulative
MGT_DATA.branchPerformance()                              → Array<{ branchId, name, students, revenue, committed, outstanding, paidFull, partial, unpaid, noPayOnReg, paidImmediately }>

MGT_DATA.PROFILE_DOCS    : Array<{ key, label, hint }>
```

Plus performance indices, exposed for direct read in tight render
loops — keep these populated:

```
MGT_DATA._byId.{branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById}
MGT_DATA._indexes.{paymentsByStudentId, studentsByClassId, studentsByBranchId, paymentsByBranchId}
```

### Step 4 — derived fields are NEVER read from the wire

These are computed in `data-loader.js` **after** the raw arrays load:

- `student.paid` `student.balance` `student.paymentStatus`
- `student.noPayOnRegistration`
- `class.status`

If your backend returns these, **ignore them**. Let `data-loader.js`
recompute. This guarantees consistency with the payment event log
and is non-negotiable.

---

## Mock clock

The package ships with a **fixed mock clock**: `30/05/2026 15:00`.
Find these two lines at the top of `data-loader.js`:

```js
// EDIT-ME ⇩  mock clock — drop this when shipping
const TODAY_STR = "30/05/2026";
const NOW       = new Date(2026, 4, 30, 15, 0, 0);
// ⇧ EDIT-ME
```

When you wire up the real backend, replace them with:

```js
const NOW       = new Date();
const TODAY_STR = `${String(NOW.getDate()).padStart(2,"0")}/${String(NOW.getMonth()+1).padStart(2,"0")}/${NOW.getFullYear()}`;
```

…and propagate `NOW` through to wherever it's referenced (the dashboard
time-frame presets, the live KPI hint strings).

The CSVs were generated relative to that mock clock — once you switch
the clock you'll also want to retire the CSVs and source from your DB.

---

## Verification checklist

After your changes, run **all** of these — none should regress:

1. `frontend/index.html` opens. The page renders within 2 seconds. No
   console errors except the standard Babel-in-browser warning.
2. Sidebar shows all 6 nav items. `CENTERSAI.com` wordmark, no eyebrow.
3. Tổng quan loads with 4 KPI cards showing real numbers — `Đã thu hôm
   nay`, `HV mới hôm nay`, `TỔNG NỢ`, `Học viên active`.
4. Tổng / Biến động / So sánh / Hiệu suất sections all render charts
   without empty data.
5. Học viên list paginates. Click a row → detail. The student's
   `paid / balance / paymentStatus` match the sum of their payments.
6. Lớp học grid renders. Click a class → detail. Enrolled students
   sum correctly.
7. Tổ chức loads. Click a branch tile → expanded panel with classes
   sorted by `openDate` desc.
8. Theme toggle flips dark ↔ light without recomputing data.
9. Vehicle-mode toggle clicks (UI-only, no behaviour wired).
10. Filter dialogs open from each list, apply / clear correctly.

If any of these regress, your data-loader change has broken the
contract.

---

## Where to read more

- `../docs/STATUS.md` — the single keeping doc: current checkpoint, pending work, and the dated change log
- `../CLAUDE.md` — backend + architecture rules (wire shape, auth, roles, derived fields)
- `./README.md` — quick orientation for human devs
- `./data/README.md` — current dataset's intent + how to swap subsets
