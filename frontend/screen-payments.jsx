// ====================================================================
// Payments — per-payment ledger with inline fly-in detail card.
//   Each row = one payment record. Clicking a row reveals an expanded
//   card flying down from under that row. Clicking the same row (or
//   another row) collapses the open card (reverse animation) before
//   revealing the next one. No navigation away from the list.
// ====================================================================

function PaymentsScreen({ onOpenStudent, onAddPayment }) {
  const D = window.MGT_DATA;

  // KPIs in a single pass — was 3 separate D.students.filter calls.
  const TODAY = "30/05";
  let todayCollected = 0, todayReceiptCount = 0;
  for (const p of D.payments) {
    if (p.createdAt.startsWith(TODAY)) { todayCollected += p.amount; todayReceiptCount++; }
  }
  let partialCount = 0, partialOwedTotal = 0, overdueCount = 0;
  for (const s of D.students) {
    if (s.paymentStatus === "50%") { partialCount++; partialOwedTotal += s.balance; }
    if (s.balance > 0) {
      const c = D.getClass(s.classId);
      if (c && c.status === "đang diễn ra") overdueCount++;
    }
  }
  // (Removed the .length-on-a-number alias for clarity.)

  // Per-payment rows + running totals so each row reads as a ledger snapshot.
  const byStudent = {};
  for (const p of D.payments) (byStudent[p.studentId] ||= []).push(p);
  for (const sid in byStudent) byStudent[sid].sort((a, b) => a.createdAtMs - b.createdAtMs);

  const [filters, setFilters] = React.useState({ today: false, thisWeek: false, thisMonth: false });

  // Hot-applied advanced filters (floating panel). Default date range
  // is 01/01/2010 → today — a wide-open historical window.
  const _now = new Date();
  const ADV_DEFAULTS = {
    search: "", branchIds: [], classIds: [], methods: [],
    paymentStatuses: [], staffIds: [], bienLai: [],
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

  // "Today" = 30/05/2026; use rolling windows ending at end-of-today.
  const todayDate = new Date(2026, 4, 30, 23, 59, 59);
  const startOfToday = new Date(2026, 4, 30, 0, 0, 0).getTime();
  const startOfWeek  = todayDate.getTime() - 6 * 86400000;  // last 7 days incl. today
  const startOfMonth = new Date(2026, 4, 1, 0, 0, 0).getTime();

  let pool = D.payments.map(p => {
    const s = D.getStudent(p.studentId);
    const list = byStudent[p.studentId];
    const cumulativeAfter = list.filter(x => x.createdAtMs <= p.createdAtMs).reduce((a, x) => a + x.amount, 0);
    const remainingAfter = Math.max(0, s.totalFee - cumulativeAfter);
    return { p, s, cumulativeAfter, remainingAfter };
  });
  if (filters.today)     pool = pool.filter(r => r.p.createdAtMs >= startOfToday);
  if (filters.thisWeek)  pool = pool.filter(r => r.p.createdAtMs >= startOfWeek);
  if (filters.thisMonth) pool = pool.filter(r => r.p.createdAtMs >= startOfMonth);
  if (adv.search) {
    const q = adv.search.toLowerCase();
    pool = pool.filter(r => (r.s.name + " " + r.s.phone + " " + r.s.maHV + " " + r.p.id + " " + r.p.bienLaiId).toLowerCase().includes(q));
  }
  if (adv.branchIds.length)       pool = pool.filter(r => adv.branchIds.includes(r.p.branchId));
  if (adv.classIds.length)        pool = pool.filter(r => adv.classIds.includes(r.s.classId));
  if (adv.methods.length)         pool = pool.filter(r => adv.methods.includes(r.p.method));
  if (adv.paymentStatuses.length) pool = pool.filter(r => adv.paymentStatuses.includes(r.s.paymentStatus));
  if (adv.staffIds.length)        pool = pool.filter(r => adv.staffIds.includes(r.p.staffId));
  if (adv.bienLai.length)         pool = pool.filter(r => adv.bienLai.includes(r.p.bienLaiPhoto ? "yes" : "no"));
  if (advStartMs != null)         pool = pool.filter(r => r.p.createdAtMs >= advStartMs);
  if (advEndMs   != null)         pool = pool.filter(r => r.p.createdAtMs <= advEndMs);

  const SORT_OPTIONS = [
    { id: "createdAt", label: "Thời điểm", accessor: (r) => r.p.createdAtMs },
    { id: "amount",    label: "Số tiền",    accessor: (r) => r.p.amount },
    { id: "remaining", label: "Còn nợ",     accessor: (r) => r.remainingAfter },
    { id: "student",   label: "Học viên",   accessor: (r) => r.s.name.toLowerCase() },
    { id: "method",    label: "Hình thức",  accessor: (r) => r.p.method },
  ];
  const view = useListView(pool, SORT_OPTIONS);
  const rows = view.rows;

  // 9 cols: Thời điểm · Mã TT · Học viên · Lớp · Số tiền · Hình thức · Trạng thái · Nhân viên · Biên lai
  const COLS = "110px 84px 1.5fr 110px 1fr 92px 84px 1fr 50px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
        <KpiBig index={0} label="Đã thu hôm nay" value={window.fmtVND(todayCollected)} hint={`${todayReceiptCount} biên lai`} color="lime"  icon="trending-up"/>
        <KpiBig index={1} label="HV còn nợ" value={`${partialCount} học viên`}    hint={`Tổng còn nợ ${window.fmtVND(partialOwedTotal)}`} color="amber" icon="clock"/>
        <KpiBig index={2} label="Quá hạn"        value={`${overdueCount} học viên`}    hint="Lớp sắp kết thúc"     color="pink"  icon="x"/>
      </div>

      <ListToolbar
        onLocClick={() => setAdvOpen(v => !v)}
        quickFilters={
          <>
            <FilterChip active={filters.today} onClick={() => setFilters({ ...filters, today: !filters.today })}
                        icon="clock" label="Hôm nay" color="cyan"/>
            <FilterChip active={filters.thisWeek} onClick={() => setFilters({ ...filters, thisWeek: !filters.thisWeek })}
                        icon="trending-up" label="Tuần này" color="lime"/>
            <FilterChip active={filters.thisMonth} onClick={() => setFilters({ ...filters, thisMonth: !filters.thisMonth })}
                        icon="trending-up" label="Tháng này" color="violet"/>
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
          <FormField label="Mã TT / Mã biên lai / Tên HV / SĐT">
            <FormText value={adv.search}
                      onChange={(v) => setField("search", v)}
                      placeholder="PMT-00123, BL-2026-, Nguyễn…"/>
          </FormField>
          <DateRangeField label="Khoảng thời điểm"
                          value={adv.dateRange}
                          onChange={(v) => setField("dateRange", v)}/>
        </div>

        {/* Column row — mirrors payment list columns */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingTop: 4 }}>
          <FilterColumn label="Chi nhánh">
            {D.branches.map(b => (
              <ChipButton key={b.id} active={adv.branchIds.includes(b.id)} color="cyan"
                          onClick={() => setField("branchIds", adv.branchIds.includes(b.id) ? adv.branchIds.filter(x => x !== b.id) : [...adv.branchIds, b.id])}>
                {b.name}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Lớp">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {D.classes.slice().sort((a, b) => (b._openMs || 0) - (a._openMs || 0)).map(c => (
                <ChipButton key={c.id} active={adv.classIds.includes(c.id)} color="violet"
                            onClick={() => setField("classIds", adv.classIds.includes(c.id) ? adv.classIds.filter(x => x !== c.id) : [...adv.classIds, c.id])}>
                  {c.code}
                </ChipButton>
              ))}
            </div>
          </FilterColumn>

          <FilterColumn label="Hình thức">
            {[
              { id: "Tiền mặt",     label: "Tiền mặt",     color: "lime"   },
              { id: "Chuyển khoản", label: "Chuyển khoản", color: "violet" },
            ].map(o => (
              <ChipButton key={o.id} active={adv.methods.includes(o.id)} color={o.color}
                          onClick={() => setField("methods", adv.methods.includes(o.id) ? adv.methods.filter(x => x !== o.id) : [...adv.methods, o.id])}>
                {o.label}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Trạng thái">
            {[
              { id: "100%", label: "100%", color: "lime"  },
              { id: "50%",  label: "50%",  color: "amber" },
              { id: "0%",   label: "0%",   color: "pink"  },
            ].map(o => (
              <ChipButton key={o.id} active={adv.paymentStatuses.includes(o.id)} color={o.color}
                          onClick={() => setField("paymentStatuses", adv.paymentStatuses.includes(o.id) ? adv.paymentStatuses.filter(x => x !== o.id) : [...adv.paymentStatuses, o.id])}>
                {o.label}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Nhân viên">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {D.accounts.filter(a => a.role === "staff").map(a => (
                <ChipButton key={a.id} active={adv.staffIds.includes(a.id)} color="cyan"
                            onClick={() => setField("staffIds", adv.staffIds.includes(a.id) ? adv.staffIds.filter(x => x !== a.id) : [...adv.staffIds, a.id])}>
                  {a.name}
                </ChipButton>
              ))}
            </div>
          </FilterColumn>

          <FilterColumn label="Biên lai">
            {[
              { id: "yes", glyph: "✓", color: "lime", title: "Đã đính kèm ảnh" },
              { id: "no",  glyph: "!", color: "pink", title: "Chưa đính kèm ảnh" },
            ].map(o => {
              const active = adv.bienLai.includes(o.id);
              const c = `var(--neon-${o.color})`;
              return (
                <button key={o.id} title={o.title}
                        onClick={() => setField("bienLai", active ? adv.bienLai.filter(x => x !== o.id) : [...adv.bienLai, o.id])}
                        style={{
                          width: 26, height: 26, padding: 0, borderRadius: 999,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          background: active ? `color-mix(in oklab, ${c} 18%, transparent)` : "var(--ink-2)",
                          color: active ? c : "var(--fg-4)",
                          border: `1px solid ${active ? `color-mix(in oklab, ${c} 50%, transparent)` : "var(--glass-stroke)"}`,
                          boxShadow: active ? `0 0 10px color-mix(in oklab, ${c} 35%, transparent)` : "none",
                          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, lineHeight: 1,
                          cursor: "pointer",
                          transition: "all 140ms var(--ease-out)",
                        }}>{o.glyph}</button>
              );
            })}
          </FilterColumn>
        </div>
      </FloatingFilterPanel>

      <GlassCard padding={0}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS,
          padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>
          <span>Thời điểm</span>
          <span>Mã TT</span>
          <span>Học viên</span>
          <span>Lớp</span>
          <span style={{ textAlign: "right" }}>Số tiền</span>
          <span>Hình thức</span>
          <span>Trạng thái</span>
          <span>Nhân viên</span>
          <span style={{ textAlign: "center" }}>Biên lai</span>
        </div>

        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          const cls = D.getClass(r.s.classId);
          const staff = D.getStaff(r.p.staffId);
          return (
            <div key={r.p.id}
                 onClick={() => onOpenStudent(r.s.id, { tab: "payments", paymentId: r.p.id })}
                 style={{
                   display: "grid", gridTemplateColumns: COLS,
                   padding: "14px 22px", gap: 12, alignItems: "center",
                   borderBottom: isLast ? "none" : "1px solid var(--ink-4)",
                   cursor: "pointer", transition: "background 140ms var(--ease-out)",
                 }}
                 onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-2)"; }}
                 onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{r.p.createdAt.split(" ").slice(0, 2).join(" ")}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{r.p.createdAt.split(" ")[2] || ""}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontWeight: 600, letterSpacing: "0.04em" }}>{r.p.id}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar name={r.s.name} size={28} src={r.s.docs_the3x4_url || null}/>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{r.s.maHV}</span>
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cls ? cls.code : "—"}</span>
              <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--neon-lime)", fontWeight: 600 }}>+{window.fmtVND(r.p.amount)}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{r.p.method}</span>
              <PaymentPill status={r.s.paymentStatus}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staff ? staff.name : "—"}</span>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BienLaiMark hasPhoto={r.p.bienLaiPhoto}/>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Không có bản ghi thanh toán phù hợp.
          </div>
        )}
      </GlassCard>

      <Paginator page={view.page} totalPages={view.totalPages}
                 pageSize={view.pageSize} total={view.total}
                 onPage={view.setPage} onPageSize={view.setPageSize}/>
    </div>
  );
}

// --------------------------------------------------------------------
// BienLaiMark — same "✓ / !" badge logic as profile completion.
//   Green check = ảnh biên lai đã đính kèm.
//   Amber bang  = chưa đính kèm.
// --------------------------------------------------------------------
function BienLaiMark({ hasPhoto }) {
  const c = hasPhoto ? "var(--neon-lime)" : "var(--neon-amber)";
  return (
    <span title={hasPhoto ? "Đã đính kèm ảnh biên lai" : "Chưa đính kèm ảnh biên lai"} style={{
      width: 22, height: 22, borderRadius: 999,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: `color-mix(in oklab, ${c} 18%, transparent)`,
      color: c, border: `1px solid color-mix(in oklab, ${c} 42%, transparent)`,
      boxShadow: `0 0 8px color-mix(in oklab, ${c} 30%, transparent)`,
      fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, lineHeight: 1,
    }}>{hasPhoto ? "✓" : "!"}</span>
  );
}

// --------------------------------------------------------------------
// PaymentDetailCard — flies down from under the clicked row.
//   Reverses (flies back up) when `isClosing` is true.
// --------------------------------------------------------------------
function PaymentDetailCard({ row, isClosing, onOpenStudent }) {
  const D = window.MGT_DATA;
  const { p, s } = row;
  const cls   = D.getClass(s.classId);
  const staff = D.getStaff(p.staffId);
  const branch = D.getBranch(p.branchId);

  return (
    <div style={{
      borderBottom: "1px solid var(--ink-4)",
      overflow: "hidden",
      transformOrigin: "top center",
      animation: `${isClosing ? "mgt-fly-up" : "mgt-fly-down"} 260ms var(--ease-out) both`,
    }}>
      <div style={{
        padding: "20px 22px 22px",
        background: "color-mix(in oklab, var(--neon-cyan) 3%, transparent)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {/* Header: student + amount */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar name={s.name} size={48} src={s.docs_the3x4_url || null}/>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Học viên</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <button onClick={() => onOpenStudent(s.id)} style={{
                background: "transparent", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em",
                textAlign: "left",
              }}>{s.name}</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontWeight: 600 }}>{s.maHV}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip>{s.licence}</Chip>
              {cls && <Chip>{cls.code}</Chip>}
              <PaymentPill status={s.paymentStatus}/>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Số tiền</span>
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1,
              letterSpacing: "-0.025em", color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums",
              textShadow: "0 0 20px var(--neon-lime-glow)",
            }}>+{window.fmtVND(p.amount)}</span>
          </div>
        </div>

        {/* Detail grid + biên lai */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{
            padding: 18, borderRadius: 14,
            background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
          }}>
            <Field label="Mã thanh toán" value={p.id} mono/>
            <Field label="Mã biên lai"   value={p.bienLaiId} mono/>
            <Field label="Hình thức"      value={p.method}/>
            <Field label="Thời gian"      value={p.createdAt} mono/>
            <Field label="Nhân viên thu" value={staff ? staff.name : "—"}/>
            <Field label="Chi nhánh"      value={branch ? branch.name : "—"}/>
            <Field label="Lớp"            value={cls ? cls.code : "—"}/>
            <Field label="Còn nợ sau"      value={row.remainingAfter > 0 ? window.fmtVND(row.remainingAfter) : "Đã đủ"} mono color={row.remainingAfter > 0 ? "var(--neon-pink)" : "var(--neon-lime)"}/>
          </div>
          <div style={{
            padding: 18, borderRadius: 14,
            background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ảnh biên lai</span>
            <BienLaiPreview hasPhoto={p.bienLaiPhoto} photoUrl={p.bienLaiPhoto_url}
                            onUpload={(file) => D.api.uploadBienLai(p.id, file).catch(e => alert("Lỗi tải ảnh biên lai: " + e.message))}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// BienLaiPreview — placeholder slot showing the receipt photo state.
//   Plumbed: when no photo is attached and `onUpload` is supplied, the
//   amber empty-state becomes a drop / click target that uploads the
//   selected File via the caller's handler. When a photoUrl is present
//   we render the actual image (still visually framed in lime/cyan).
// --------------------------------------------------------------------
function BienLaiPreview({ hasPhoto, photoUrl, onUpload }) {
  const fileRef = React.useRef(null);
  const [hover, setHover] = React.useState(false);

  if (hasPhoto) {
    if (photoUrl) {
      return (
        <a href={photoUrl} target="_blank" rel="noopener" style={{
          display: "block", textDecoration: "none",
          height: 140, borderRadius: 10, overflow: "hidden",
          background: "linear-gradient(135deg, color-mix(in oklab, var(--neon-lime) 14%, transparent), color-mix(in oklab, var(--neon-cyan) 10%, transparent))",
          border: "1px dashed color-mix(in oklab, var(--neon-lime) 40%, transparent)",
        }}>
          <img src={photoUrl} alt="Ảnh biên lai" style={{
            width: "100%", height: "100%", objectFit: "contain", display: "block",
          }}/>
        </a>
      );
    }
    return (
      <div style={{
        height: 140, borderRadius: 10,
        background: "linear-gradient(135deg, color-mix(in oklab, var(--neon-lime) 14%, transparent), color-mix(in oklab, var(--neon-cyan) 10%, transparent))",
        border: "1px dashed color-mix(in oklab, var(--neon-lime) 40%, transparent)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="check" size={28} color="var(--neon-lime)" style={{ filter: "drop-shadow(0 0 8px var(--neon-lime-glow))" }}/>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)" }}>Đã đính kèm ảnh biên lai</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>Bấm để xem bản gốc</span>
      </div>
    );
  }

  // Empty state — if onUpload is wired, allow drop / click to attach.
  const canUpload = typeof onUpload === "function";
  const pick = (file) => { if (file && canUpload) onUpload(file); };

  return (
    <div
      onClick={canUpload ? () => fileRef.current && fileRef.current.click() : undefined}
      onDragOver={canUpload ? (e => { e.preventDefault(); setHover(true); }) : undefined}
      onDragLeave={canUpload ? (() => setHover(false)) : undefined}
      onDrop={canUpload ? (e => { e.preventDefault(); setHover(false); pick(e.dataTransfer?.files?.[0]); }) : undefined}
      style={{
        height: 140, borderRadius: 10, position: "relative",
        background: hover ? "color-mix(in oklab, var(--neon-cyan) 12%, transparent)" : "color-mix(in oklab, var(--neon-amber) 8%, transparent)",
        border: `1px dashed color-mix(in oklab, ${hover ? "var(--neon-cyan)" : "var(--neon-amber)"} 40%, transparent)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        cursor: canUpload ? "pointer" : "default",
        transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
      }}>
      {canUpload && (
        <input ref={fileRef} type="file" accept="image/*"
               onChange={e => pick(e.target.files?.[0])}
               style={{ display: "none" }}/>
      )}
      <span style={{
        width: 32, height: 32, borderRadius: 999,
        background: "color-mix(in oklab, var(--neon-amber) 22%, transparent)",
        color: "var(--neon-amber)",
        boxShadow: "0 0 12px color-mix(in oklab, var(--neon-amber) 30%, transparent)",
        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, lineHeight: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>!</span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)" }}>Chưa có ảnh biên lai</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
        {canUpload ? "Kéo & thả ảnh — hoặc bấm để chọn" : "Kéo & thả ảnh để đính kèm"}
      </span>
    </div>
  );
}

function KpiBig({ label, value, hint, color = "cyan", icon, index = 0 }) {
  const c = `var(--neon-${color})`;
  const cardRef  = React.useRef(null);
  const sheenRef = React.useRef(null);
  const chromaRef= React.useRef(null);
  const [hover, setHover] = React.useState(false);
  const targetRef = React.useRef({ x: 50, y: 30 });
  const posRef    = React.useRef({ x: 50, y: 30 });

  // While hovering, drive an rAF loop that
  //   1. lerps the rendered position toward the cursor
  //   2. draws 4 drifting metaball orbs + 1 cursor orb into a CSS background
  // The result is a liquid-glass field (no hard edges thanks to overlap + blur).
  React.useEffect(() => {
    if (!hover) return;
    let raf;
    const startMs = performance.now();
    const orbs = [
      { phase: 0,   sa: 1.10, sb: 0.80, ax: 28, ay: 22, r: 200 },
      { phase: 1.3, sa: 0.70, sb: 1.20, ax: 30, ay: 22, r: 220 },
      { phase: 2.4, sa: 0.90, sb: 1.00, ax: 26, ay: 24, r: 190 },
      { phase: 3.5, sa: 1.30, sb: 0.75, ax: 30, ay: 20, r: 210 },
    ];
    const tick = (now) => {
      const t = ((now - startMs) / 1000) * 0.16;
      const tgt = targetRef.current, p = posRef.current;
      p.x += (tgt.x - p.x) * 0.06;
      p.y += (tgt.y - p.y) * 0.06;
      if (sheenRef.current) {
        const layers = orbs.map(o => {
          const x = 50 + Math.cos(t * o.sa + o.phase) * o.ax;
          const y = 50 + Math.sin(t * o.sb + o.phase) * o.ay;
          return `radial-gradient(${o.r}px ${o.r}px at ${x}% ${y}%, rgba(255,255,255,0.045), transparent 64%)`;
        });
        layers.push(`radial-gradient(260px 230px at ${p.x}% ${p.y}%, color-mix(in oklab, ${c} 18%, rgba(255,255,255,0.06)), transparent 62%)`);
        sheenRef.current.style.background = layers.join(",");
      }
      if (chromaRef.current) {
        chromaRef.current.style.background =
          `radial-gradient(150px 120px at ${p.x - 5}% ${p.y}%, rgba(120,220,255,0.16), transparent 60%),
           radial-gradient(150px 120px at ${p.x + 5}% ${p.y}%, rgba(255,160,220,0.13), transparent 60%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hover, c]);

  const onMove = (e) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    targetRef.current.x = ((e.clientX - r.left) / r.width) * 100;
    targetRef.current.y = ((e.clientY - r.top) / r.height) * 100;
  };

  return (
    <div className="mgt-pulse" style={{ animationDelay: `${(index % 4) * 0.6}s` }}>
      <div
        ref={cardRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={onMove}
        style={{
          position: "relative",
          borderRadius: 20,
          padding: 22,
          border: "1px solid var(--glass-stroke)",
          background: `linear-gradient(135deg, color-mix(in oklab, ${c} 9%, transparent), transparent 70%), var(--glass-2)`,
          boxShadow: hover
            ? `0 0 0 1px ${c}, 0 0 28px color-mix(in oklab, ${c} 42%, transparent), var(--shadow-2)`
            : `0 0 18px color-mix(in oklab, ${c} 14%, transparent), var(--shadow-2)`,
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          overflow: "hidden",
          willChange: "transform, box-shadow",
          backfaceVisibility: "hidden",
          transform: hover ? "translate3d(0,-2px,0) scale(1.012)" : "translate3d(0,0,0) scale(1)",
          transition: "transform 720ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 640ms var(--ease-out)",
          cursor: "default",
        }}>
        {/* Liquid-glass metaball field — 4 drifting orbs + cursor orb,
            heavily blurred so they fuse with no hard edges. */}
        <div ref={sheenRef} style={{
          position: "absolute", inset: "-12%",
          pointerEvents: "none",
          opacity: hover ? 1 : 0,
          filter: "blur(28px) saturate(1.3)",
          mixBlendMode: "screen",
          transition: "opacity 380ms var(--ease-out)",
        }}/>
        {/* Chromatic dispersion — cool/warm split around the cursor */}
        <div ref={chromaRef} style={{
          position: "absolute", inset: 0,
          pointerEvents: "none",
          opacity: hover ? 1 : 0,
          filter: "blur(14px)",
          mixBlendMode: "screen",
          transition: "opacity 320ms var(--ease-out)",
        }}/>

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 36, lineHeight: 1,
              letterSpacing: "-0.03em", color: "var(--fg-1)", fontVariantNumeric: "tabular-nums",
            }}>{value}</span>
            {hint && <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>{hint}</span>}
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 55%, var(--ink-0)))`,
            boxShadow: `0 0 16px color-mix(in oklab, ${c} 52%, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon name={icon || "check"} size={20} color="var(--ink-0)"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// PaymentDetail (standalone page) — retained for deep-linking but the
// list itself no longer routes here. Kept lean.
// ====================================================================
function PaymentDetail({ paymentId, onBack, onOpenStudent }) {
  const D = window.MGT_DATA;
  const p = D.payments.find(p => p.id === paymentId);
  if (!p) return null;
  const s = D.getStudent(p.studentId);
  const cls = D.getClass(s.classId);
  const staff = D.getStaff(p.staffId);
  const branch = D.getBranch(p.branchId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GlassCard padding={26}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Avatar name={s.name} size={64} glow src={s.docs_the3x4_url || null}/>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Học viên</span>
            <h2 onClick={() => onOpenStudent(s.id)} style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.025em", cursor: "pointer" }}>{s.name} <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-3)" }}>{s.maHV}</span></h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Chip>{s.licence}</Chip>
              {cls && <Chip>{cls.code}</Chip>}
              <PaymentPill status={s.paymentStatus} size="lg"/>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Số tiền</span>
            <span style={{
              fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 40, lineHeight: 1,
              letterSpacing: "-0.03em", color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums",
              textShadow: "0 0 28px var(--neon-lime-glow)",
            }}>+{window.fmtVND(p.amount)}</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

Object.assign(window, { PaymentsScreen, PaymentDetail, PaymentDetailCard, BienLaiPreview, KpiBig, BienLaiMark });
