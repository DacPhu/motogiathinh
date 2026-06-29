// ====================================================================
// Classes — grid + detail. NO max capacity. Full class names everywhere.
// ====================================================================

function ClassesScreen({ onOpenClass, onAddClass, isAdmin }) {
  const D = window.MGT_DATA;
  // Default selected: lớp "đang mở" + "đang diễn ra" (lớp đã kết thúc ẩn đi)
  const [filters, setFilters] = React.useState({ open: true, ongoing: true, ended: false });

  // Hot-applied advanced filters (floating panel). Default date range
  // is 01/01/2010 → today — a wide-open historical window.
  const _now = new Date();
  const ADV_DEFAULTS = {
    search: "", branchIds: [], statuses: [],
    dateRange: {
      start: new Date(2010, 0, 1, 0, 0, 0),
      end:   new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59),
    },
  };
  const [adv, setAdv]         = React.useState(ADV_DEFAULTS);
  const [advOpen, setAdvOpen] = React.useState(false);
  const setField = (k, v) => setAdv(prev => ({ ...prev, [k]: v }));
  const clearAdv = () => setAdv(ADV_DEFAULTS);
  const advStartMs = adv.dateRange?.start ? adv.dateRange.start.getTime() : null;
  const advEndMs   = adv.dateRange?.end   ? new Date(adv.dateRange.end.getFullYear(), adv.dateRange.end.getMonth(), adv.dateRange.end.getDate(), 23, 59, 59).getTime() : null;

  const dateMs = (s) => {
    if (!s) return 0;
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  // Quick-filter chips work as OR: any selected status passes through.
  // Defensive: if all three are off, fall back to showing everything.
  let pool = D.classes.slice();
  const anyStatusFilter = filters.open || filters.ongoing || filters.ended;
  if (anyStatusFilter) {
    pool = pool.filter(c =>
      (filters.open    && c.status === "đang mở") ||
      (filters.ongoing && c.status === "đang diễn ra") ||
      (filters.ended   && c.status === "đã kết thúc")
    );
  }
  if (adv.search) {
    const q = adv.search.toLowerCase();
    pool = pool.filter(c => (c.code + " " + (D.getBranch(c.branchId)?.name || "")).toLowerCase().includes(q));
  }
  if (adv.branchIds.length) pool = pool.filter(c => adv.branchIds.includes(c.branchId));
  if (adv.statuses.length)  pool = pool.filter(c => adv.statuses.includes(c.status));
  if (advStartMs != null)   pool = pool.filter(c => dateMs(c.openDate) >= advStartMs);
  if (advEndMs   != null)   pool = pool.filter(c => dateMs(c.openDate) <= advEndMs);

  pool = pool.map(c => ({
    cls: c,
    enrolled: D.studentsInClass(c.id).length,
    openMs: dateMs(c.openDate),
    examMs: dateMs(c.examDate),
  }));

  const SORT_OPTIONS = [
    { id: "createdAt", label: "Thời điểm", accessor: (r) => r.openMs },
    { id: "code",      label: "Mã lớp",    accessor: (r) => r.cls.code },
    { id: "enrolled",  label: "Sĩ số",     accessor: (r) => r.enrolled },
    { id: "examDate",  label: "Ngày thi",  accessor: (r) => r.examMs },
  ];
  const view = useListView(pool, SORT_OPTIONS);
  const rows = view.rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
      <ListToolbar
        onLocClick={() => setAdvOpen(v => !v)}
        quickFilters={
          <>
            <FilterChip active={filters.open} onClick={() => setFilters({ ...filters, open: !filters.open })}
                        icon="plus" label="Đang mở" color="lime"/>
            <FilterChip active={filters.ongoing} onClick={() => setFilters({ ...filters, ongoing: !filters.ongoing })}
                        icon="clock" label="Đang diễn ra" color="cyan"/>
            <FilterChip active={filters.ended} onClick={() => setFilters({ ...filters, ended: !filters.ended })}
                        icon="x" label="Đã kết thúc" color="pink"/>
          </>
        }
        sortId={view.sortId} sortDir={view.sortDir} sortOptions={SORT_OPTIONS}
        onSortId={view.setSortId} onSortDir={view.setDir}/>

      {/* Floating, draggable advanced-filter panel — hot-filters as user types/toggles */}
      <FloatingFilterPanel open={advOpen}
                           onClose={() => setAdvOpen(false)}
                           onClear={clearAdv}>
        {/* Top row — free search + date range */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
          <FormField label="Mã lớp / Chi nhánh">
            <FormText value={adv.search}
                      onChange={(v) => setField("search", v)}
                      placeholder="MÔ TÔ 05/2026, 331A…"/>
          </FormField>
          <DateRangeField label="Khoảng ngày mở"
                          value={adv.dateRange}
                          onChange={(v) => setField("dateRange", v)}/>
        </div>

        {/* Column row — mirrors class card properties */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingTop: 4 }}>
          <FilterColumn label="Chi nhánh">
            {D.branches.map(b => (
              <ChipButton key={b.id} active={adv.branchIds.includes(b.id)} color="cyan"
                          onClick={() => setField("branchIds", adv.branchIds.includes(b.id) ? adv.branchIds.filter(x => x !== b.id) : [...adv.branchIds, b.id])}>
                {b.name}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Trạng thái">
            {[
              { id: "đang mở",      label: "Đang mở",       color: "lime" },
              { id: "đang diễn ra", label: "Đang diễn ra",  color: "cyan" },
              { id: "đã kết thúc",  label: "Đã kết thúc",   color: "pink" },
            ].map(o => (
              <ChipButton key={o.id} active={adv.statuses.includes(o.id)} color={o.color}
                          onClick={() => setField("statuses", adv.statuses.includes(o.id) ? adv.statuses.filter(x => x !== o.id) : [...adv.statuses, o.id])}>
                {o.label}
              </ChipButton>
            ))}
          </FilterColumn>
        </div>
      </FloatingFilterPanel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {rows.map(r => <ClassCard key={r.cls.id} cls={r.cls} onOpen={() => onOpenClass(r.cls.id)}/>)}

        {rows.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 60, textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Không có lớp phù hợp.
          </div>
        )}
      </div>

      <Paginator page={view.page} totalPages={view.totalPages}
                 pageSize={view.pageSize} total={view.total}
                 onPage={view.setPage} onPageSize={view.setPageSize}/>
    </div>
  );
}

function ClassCard({ cls, onOpen }) {
  const D = window.MGT_DATA;
  const enrolled = D.studentsInClass(cls.id);
  const branch = D.getBranch(cls.branchId);
  const isLocked = cls.status === "đã kết thúc";
  const tone = window.useBranchTone(cls.branchId);

  // Total revenue for this class = sum of payments by its students.
  const studentIds = new Set(enrolled.map(s => s.id));
  const revenue = D.payments
    .filter(p => studentIds.has(p.studentId))
    .reduce((acc, p) => acc + p.amount, 0);

  // --- Hover effect (no orbs, just outward scale + branch-tone glow) ---
  const [hover, setHover] = React.useState(false);

  return (
    <div className="mgt-pulse" style={{
      animationDelay: `${(parseInt(cls.id.replace(/\D/g, "")) % 5) * 0.5}s`,
    }}>
      <div
        onClick={onOpen}
        onMouseEnter={() => !isLocked && setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "relative",
          borderRadius: 20,
          padding: 22,
          border: "1px solid var(--glass-stroke)",
          background: `linear-gradient(135deg, color-mix(in oklab, ${tone} 9%, transparent), transparent 70%), var(--glass-2)`,
          boxShadow: isLocked
            ? "var(--shadow-2)"
            : hover
              ? `0 0 0 1px ${tone}, 0 0 28px color-mix(in oklab, ${tone} 42%, transparent), var(--shadow-2)`
              : `0 0 18px color-mix(in oklab, ${tone} 14%, transparent), var(--shadow-2)`,
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          overflow: "hidden",
          cursor: "pointer",
          opacity: isLocked ? 0.7 : 1,
          willChange: "transform, box-shadow",
          backfaceVisibility: "hidden",
          // Outward expansion only — no Y translate.
          transform: hover && !isLocked ? "translate3d(0,0,0) scale(1.010)" : "translate3d(0,0,0) scale(1)",
          transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms var(--ease-out)",
        }}>

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header — code (left) + status pill stack (right with branch below) */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{cls.code}</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <ClassStatusPill status={cls.status}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
                             color: tone, whiteSpace: "nowrap" }}>{branch ? branch.name : "—"}</span>
            </div>
          </div>

          {/* Meta — 2×2 grid so values don't shift around when zooming.
              Row 1: Mở / Thi (labelled dates). Row 2: Doanh thu / Học viên
              (visually intuitive, no labels — bigger glowing values). */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 10, columnGap: 14,
                        fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            <MetaCell label="Mở"  value={cls.openDate}/>
            <MetaCell label="Thi" value={cls.examDate}/>
            {/* Bottom row — bare values, larger size, subtle glow */}
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700,
              color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em", lineHeight: 1,
              textShadow: "0 0 12px color-mix(in oklab, var(--neon-lime) 55%, transparent)",
            }}>{window.fmtVND(revenue)}</span>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700,
              color: "var(--fg-1)", fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em", lineHeight: 1,
              textShadow: "0 0 10px rgba(255,255,255,0.18)",
            }}>{enrolled.length} <span style={{ fontSize: 13, color: "var(--fg-3)", fontWeight: 600 }}>HV</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulletDot() {
  return <span style={{ width: 3, height: 3, borderRadius: 999, background: "var(--fg-4)" }}/>;
}

// One labelled cell in the ClassCard meta grid. Fixed-position values
// so 2x2 layout doesn't reflow when the viewport / zoom changes.
function MetaCell({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function SplitBar({ count, total, label, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.06em" }}>
        <span style={{ color: `var(--neon-${color})`, fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "var(--ink-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `var(--neon-${color})`, boxShadow: `0 0 6px var(--neon-${color}-glow)` }}/>
      </div>
    </div>
  );
}

// ====================================================================
// Class Detail
// ====================================================================
function ClassDetail({ classId, onBack, onOpenStudent, isAdmin }) {
  const D = window.MGT_DATA;
  const cls = D.getClass(classId);
  if (!cls) return null;
  const branch = D.getBranch(cls.branchId);
  const tone = window.useBranchTone(cls.branchId);
  const list = D.studentsInClass(classId);
  const [status, setStatus] = React.useState(cls.status);
  const [editOpen, setEditOpen] = React.useState(false);
  const locked = status === "đã kết thúc";

  // Total revenue for this class — same logic as ClassCard.
  const studentIds = new Set(list.map(s => s.id));
  const revenue = D.payments
    .filter(p => studentIds.has(p.studentId))
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GlassCard padding={26}>
        {/* Locked-width header row. Each block has flex-shrink: 0 except
            the title column (flex: 1, min-width: 0). This prevents
            zoom / viewport changes from shoving blocks around. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            flexShrink: 0,
            width: 64, height: 64, borderRadius: 16,
            background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px var(--neon-cyan-haze)",
          }}>
            <Icon name="graduation" size={28} color="var(--ink-0)"/>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.025em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cls.code}</h2>
            <div style={{ display: "flex", gap: 14, fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ flexShrink: 0, color: tone, fontWeight: 600 }}>{branch ? branch.name : "—"}</span>
              <span style={{ flexShrink: 0 }}>Ngày mở: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{cls.openDate}</span></span>
              <span style={{ flexShrink: 0 }}>Ngày thi: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{cls.examDate}</span></span>
              <span style={{ flexShrink: 0 }}>Sĩ số: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>{list.length}</span></span>
            </div>
          </div>
          <div style={{
            flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
          }}>
            {/* Status pill — clickable for admins, opens the edit modal */}
            <ClassStatusPill status={status} glow
                             onClick={isAdmin ? () => setEditOpen(true) : undefined}/>
            {/* Big green revenue number replaces the old Sửa lớp button */}
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1,
              letterSpacing: "-0.025em", color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums",
              textShadow: "0 0 18px var(--neon-lime-glow)",
              whiteSpace: "nowrap",
            }}>{window.fmtVND(revenue)}</span>
          </div>
        </div>
        {locked && (
          <div style={{
            marginTop: 18, padding: "10px 14px", borderRadius: 10,
            background: "color-mix(in oklab, var(--neon-pink) 8%, transparent)",
            border: "1px solid color-mix(in oklab, var(--neon-pink) 30%, transparent)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Icon name="x" size={14} color="var(--neon-pink)"/>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
              Lớp đã kết thúc — hồ sơ và thanh toán đã khóa.
            </span>
          </div>
        )}
      </GlassCard>

      <ClassEditModal open={editOpen} onClose={() => setEditOpen(false)} cls={cls}
                      currentStatus={status}
                      onSaveStatus={async ({ status: newStatus, openDate, examDate }) => {
                        const patch = { statusOverride: newStatus };
                        // Only forward date fields when they actually changed
                        // so an admin who only toggles the status doesn't
                        // accidentally rewrite the wall-clock dates.
                        if (openDate && openDate !== cls.openDate) patch.openDate = openDate;
                        if (examDate && examDate !== cls.examDate) patch.examDate = examDate;
                        // Let rejections propagate to ClassEditModal so it can
                        // render the error inline + stay open. Only flip local
                        // status state AFTER the server confirms.
                        await window.MGT_DATA.api.updateClass(cls.id, patch);
                        setStatus(newStatus);
                      }}/>

      <GlassCard padding={0}>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, flex: 1, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)" }}>Danh sách học viên</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{list.length} học viên</span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "76px 1.8fr 130px",
          padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>
          <span>Mã HV</span><span>Học viên</span><span>Thanh toán</span>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
            Lớp chưa có học viên đăng ký.
          </div>
        ) : list.map((s, i) => {
          return (
            <div key={s.id} onClick={() => onOpenStudent(s.id, { from: { type: "class", id: classId } })} style={{
              display: "grid", gridTemplateColumns: "76px 1.8fr 130px",
              padding: "14px 22px", gap: 12, alignItems: "center",
              borderBottom: i < list.length - 1 ? "1px solid var(--ink-4)" : "none",
              cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--glass-2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontWeight: 600 }}>{s.maHV}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={s.name} size={30} src={s.docs_the3x4_url || null}/>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{s.licence}</span>
                </div>
              </div>
              <PaymentPill status={s.paymentStatus}/>
            </div>
          );
        })}
      </GlassCard>
    </div>
  );
}

Object.assign(window, { ClassesScreen, ClassDetail, ClassCard });

// --------------------------------------------------------------------
// ClassEditModal — admin edits class info (status, ngày mở, ngày thi).
//   Reuses the shared Modal shell; status is the most commonly changed
//   field so it leads.
// --------------------------------------------------------------------
function ClassEditModal({ open, onClose, cls, currentStatus, onSaveStatus }) {
  const [draft, setDraft] = React.useState({
    status: currentStatus,
    openDate: cls.openDate,
    examDate: cls.examDate,
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  // Synchronous double-submit guard — React state updates are async so a
  // burst of .click()s can race past the `busy` flag before re-render.
  const busyRef = React.useRef(false);
  // Reset draft whenever the modal reopens for a different class.
  React.useEffect(() => {
    if (open) {
      setDraft({ status: currentStatus, openDate: cls.openDate, examDate: cls.examDate });
      setBusy(false); setErr(null); busyRef.current = false;
    }
  }, [open, cls.id, currentStatus]);  // eslint-disable-line

  const branch = window.MGT_DATA.getBranch(cls.branchId);

  // Await onSaveStatus; only close on success so the user sees the error
  // inline if the API rejects.
  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await onSaveStatus({
        status: draft.status,
        openDate: draft.openDate,
        examDate: draft.examDate,
      });
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
           title={`Sửa lớp ${cls.code}`}
           primaryAction={submit}
           primaryLabel={busy ? "Đang lưu…" : "Lưu thay đổi"}
           primaryIcon="check"
           primaryDisabled={busy}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : null}
           width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <FormField label="Trạng thái lớp">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { id: "đang mở",      label: "Đang mở",      color: "var(--neon-lime)" },
              { id: "đang diễn ra", label: "Đang diễn ra", color: "var(--neon-cyan)" },
              { id: "đã kết thúc",  label: "Đã kết thúc",  color: "var(--neon-pink)" },
            ].map(s => {
              const active = draft.status === s.id;
              return (
                <button key={s.id} onClick={() => setDraft({ ...draft, status: s.id })} style={{
                  // Standard pill: 8×14 padding, white text when active,
                  // accent border + glow for affordance.
                  padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                  background: active ? `color-mix(in oklab, ${s.color} 16%, transparent)` : "var(--ink-2)",
                  border: `1px solid ${active ? s.color : "var(--glass-stroke)"}`,
                  boxShadow: active ? `0 0 14px color-mix(in oklab, ${s.color} 45%, transparent)` : "none",
                  color: active ? "var(--fg-1)" : "var(--fg-2)",
                  fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
                  textAlign: "center",
                  transition: "all 140ms var(--ease-out)",
                }}>{s.label}</button>
              );
            })}
          </div>
        </FormField>
        <FormRow>
          <FormField label="Ngày mở">
            <FormText value={draft.openDate} onChange={(v) => setDraft({ ...draft, openDate: v })} placeholder="dd/mm/yyyy"/>
          </FormField>
          <FormField label="Ngày thi">
            <FormText value={draft.examDate} onChange={(v) => setDraft({ ...draft, examDate: v })} placeholder="dd/mm/yyyy"/>
          </FormField>
        </FormRow>
      </div>
    </Modal>
  );
}
