// ====================================================================
// Students — list + detail (info + payment tabs)
// LOCKED columns: ID · Mã HV · Học viên · Bằng · Lớp(full) · Thanh toán
//                  · Nhân viên (right-pushed) · Hồ sơ (right-end badge)
// No source, no retake, no trailing arrow.
// ====================================================================

function StudentsScreen({ onOpenStudent, onAddStudent }) {
  const D = window.MGT_DATA;
  const [filters, setFilters] = React.useState({ incomplete: false, owing: false, today: false });

  // Default date range: 01/01/2010 → today (a wide-open historical window).
  const _now = new Date();
  const ADV_DEFAULTS = {
    search: "", branchIds: [], licences: [], classIds: [],
    payments: [], staffIds: [], profile: [],
    dateRange: {
      start: new Date(2010, 0, 1, 0, 0, 0),
      end:   new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 23, 59, 59),
    },
  };
  const [adv, setAdv]         = React.useState(ADV_DEFAULTS);
  const [advOpen, setAdvOpen] = React.useState(false);
  const setField = (k, v) => setAdv(prev => ({ ...prev, [k]: v }));
  const clearAdv = () => setAdv(ADV_DEFAULTS);

  // Date range uses Date objects (compatible with the upgraded picker).
  const startMs = adv.dateRange?.start ? adv.dateRange.start.getTime() : null;
  const endMs   = adv.dateRange?.end   ? new Date(adv.dateRange.end.getFullYear(), adv.dateRange.end.getMonth(), adv.dateRange.end.getDate(), 23, 59, 59).getTime() : null;

  // Pre-filter pool before sort/paging.
  let pool = D.students.slice();
  if (filters.incomplete) pool = pool.filter(s => !s.profileComplete);
  if (filters.owing)      pool = pool.filter(s => s.balance > 0);
  if (filters.today)      pool = pool.filter(s => s.createdAt.startsWith("30/05"));
  if (adv.search) {
    const q = adv.search.toLowerCase();
    pool = pool.filter(s => (s.name + " " + s.phone + " " + s.maHV).toLowerCase().includes(q));
  }
  if (adv.branchIds.length) pool = pool.filter(s => adv.branchIds.includes(s.branchId));
  if (adv.licences.length)  pool = pool.filter(s => adv.licences.includes(s.licence));
  if (adv.classIds.length)  pool = pool.filter(s => adv.classIds.includes(s.classId));
  if (adv.payments.length)  pool = pool.filter(s => adv.payments.includes(s.paymentStatus));
  if (adv.staffIds.length)  pool = pool.filter(s => adv.staffIds.includes(s.responsibleStaffId));
  if (adv.profile.length)   pool = pool.filter(s => adv.profile.includes(s.profileComplete ? "complete" : "incomplete"));
  if (startMs != null)      pool = pool.filter(s => s.createdAtMs >= startMs);
  if (endMs   != null)      pool = pool.filter(s => s.createdAtMs <= endMs);

  const SORT_OPTIONS = [
    { id: "createdAt", label: "Thời điểm",  accessor: (s) => s.createdAtMs },
    { id: "name",      label: "Tên học viên", accessor: (s) => s.name.toLowerCase() },
    { id: "maHV",      label: "Mã HV",      accessor: (s) => s.maHV },
    { id: "class",     label: "Lớp",        accessor: (s) => (D.getClass(s.classId)?.code || "") },
    { id: "balance",   label: "Còn nợ",     accessor: (s) => s.balance },
  ];
  const view = useListView(pool, SORT_OPTIONS);
  const list = view.rows;

  // Column template — fixed. Nhân viên sits before the Hồ sơ badge.
  const COLS = "70px 76px 1.6fr 60px 160px 78px 110px 36px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
      <ListToolbar
        onLocClick={() => setAdvOpen(v => !v)}
        quickFilters={
          <>
            <FilterChip active={filters.incomplete} onClick={() => setFilters({ ...filters, incomplete: !filters.incomplete })}
                        icon="x" label="Thiếu hồ sơ" color="pink"/>
            <FilterChip active={filters.owing} onClick={() => setFilters({ ...filters, owing: !filters.owing })}
                        icon="wallet" label="Còn nợ" color="amber"/>
            <FilterChip active={filters.today} onClick={() => setFilters({ ...filters, today: !filters.today })}
                        icon="clock" label="Hôm nay" color="cyan"/>
          </>
        }
        sortId={view.sortId} sortDir={view.sortDir} sortOptions={SORT_OPTIONS}
        onSortId={view.setSortId} onSortDir={view.setDir}/>

      {/* Floating, draggable advanced-filter panel — hot-filters as user types/toggles */}
      <FloatingFilterPanel open={advOpen}
                           onClose={() => setAdvOpen(false)}
                           onClear={clearAdv}
                           width={undefined}>
        {/* Top row — free search + date range, full-width */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
          <FormField label="Tên / SĐT / Mã HV">
            <FormText value={adv.search}
                      onChange={(v) => setField("search", v)}
                      placeholder="Nguyễn, 091…, HV017"/>
          </FormField>
          <DateRangeField label="Khoảng đăng ký"
                          value={adv.dateRange}
                          onChange={(v) => setField("dateRange", v)}/>
        </div>

        {/* Column row — mirrors student list columns */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingTop: 4 }}>
          <FilterColumn label="Bằng">
            {[{ id: "A", label: "A" }, { id: "A1", label: "A1" }].map(o => (
              <ChipButton key={o.id} active={adv.licences.includes(o.id)} color="lime"
                          onClick={() => setField("licences", adv.licences.includes(o.id) ? adv.licences.filter(x => x !== o.id) : [...adv.licences, o.id])}>
                {o.label}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Chi nhánh">
            {D.branches.map(b => (
              <ChipButton key={b.id} active={adv.branchIds.includes(b.id)} color="cyan"
                          onClick={() => setField("branchIds", adv.branchIds.includes(b.id) ? adv.branchIds.filter(x => x !== b.id) : [...adv.branchIds, b.id])}>
                {b.name}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Lớp">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {D.classes.slice().sort((a, b) => (b._openMs || 0) - (a._openMs || 0)).map(c => (
                <ChipButton key={c.id} active={adv.classIds.includes(c.id)} color="violet"
                            onClick={() => setField("classIds", adv.classIds.includes(c.id) ? adv.classIds.filter(x => x !== c.id) : [...adv.classIds, c.id])}>
                  {c.code}
                </ChipButton>
              ))}
            </div>
          </FilterColumn>

          <FilterColumn label="Thanh toán">
            {[
              { id: "100%", label: "100%", color: "lime"  },
              { id: "50%",  label: "50%",  color: "amber" },
              { id: "0%",   label: "0%",   color: "pink"  },
            ].map(o => (
              <ChipButton key={o.id} active={adv.payments.includes(o.id)} color={o.color}
                          onClick={() => setField("payments", adv.payments.includes(o.id) ? adv.payments.filter(x => x !== o.id) : [...adv.payments, o.id])}>
                {o.label}
              </ChipButton>
            ))}
          </FilterColumn>

          <FilterColumn label="Nhân viên">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {D.accounts.filter(a => a.role === "staff").map(a => (
                <ChipButton key={a.id} active={adv.staffIds.includes(a.id)} color="cyan"
                            onClick={() => setField("staffIds", adv.staffIds.includes(a.id) ? adv.staffIds.filter(x => x !== a.id) : [...adv.staffIds, a.id])}>
                  {a.name}
                </ChipButton>
              ))}
            </div>
          </FilterColumn>

          <FilterColumn label="Hồ sơ">
            {[
              { id: "complete",   glyph: "✓", color: "lime", title: "Đầy đủ" },
              { id: "incomplete", glyph: "!", color: "pink", title: "Thiếu" },
            ].map(o => {
              const active = adv.profile.includes(o.id);
              const c = `var(--neon-${o.color})`;
              return (
                <button key={o.id} title={o.title}
                        onClick={() => setField("profile", active ? adv.profile.filter(x => x !== o.id) : [...adv.profile, o.id])}
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
          padding: "14px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>
          <span>ID</span>
          <span>Mã HV</span>
          <span>Học viên</span>
          <span>Bằng</span>
          <span>Lớp</span>
          <span>Thanh toán</span>
          <span>Nhân viên</span>
          <span style={{ textAlign: "right" }}>Hồ sơ</span>
        </div>

        {list.map((s, i) => {
          const cls = D.getClass(s.classId);
          const staff = D.getStaff(s.responsibleStaffId);
          return (
            <div key={s.id} onClick={() => onOpenStudent(s.id)} style={{
              display: "grid", gridTemplateColumns: COLS,
              padding: "14px 22px", gap: 12, alignItems: "center",
              cursor: "pointer",
              borderBottom: i < list.length - 1 ? "1px solid var(--ink-4)" : "none",
              transition: "background 140ms var(--ease-out)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--glass-2)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{s.id}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{s.maHV}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Avatar name={s.name} size={32} src={s.docs_the3x4_url || null}/>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{window.fmtPhone(s.phone)}</span>
                </div>
              </div>
              <Chip>{s.licence}</Chip>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cls ? cls.code : "—"}</span>
              <PaymentPill status={s.paymentStatus}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>{staff ? staff.name : "—"}</span>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ProfilePill complete={s.profileComplete}/>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Không có học viên phù hợp với bộ lọc.
          </div>
        )}
      </GlassCard>

      <Paginator page={view.page} totalPages={view.totalPages}
                 pageSize={view.pageSize} total={view.total}
                 onPage={view.setPage} onPageSize={view.setPageSize}/>
    </div>
  );
}

// ====================================================================
// Student Detail — pill tabs: Thông tin / Thanh toán
// ====================================================================
function StudentDetail({ studentId, initialTab, initialPaymentId, onBack, onOpenPayment, onAddPayment }) {
  const D = window.MGT_DATA;
  const s = D.getStudent(studentId);
  const [tab, setTab] = React.useState(initialTab || "info");
  const [docs, setDocs] = React.useState({ ...s?.docs });

  if (!s) return null;
  const cls = D.getClass(s.classId);
  const staff = D.getStaff(s.responsibleStaffId);
  const branch = D.getBranch(s.branchId);
  const feePlan = D.getFeePlan(s.feePlanId);
  const promo = D.getPromotion(s.promotionId);
  const studentPayments = D.paymentsForStudent(s.id);
  const docsFilledCount = Object.values(docs).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top section */}
      <GlassCard padding={26}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Avatar name={s.name} size={64} glow src={s.docs_the3x4_url || null}/>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.025em" }}>{s.name}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Chip>{s.licence}</Chip>
              {cls && <Chip>{cls.code}</Chip>}
              <ProfilePill complete={s.profileComplete} withText/>
              <PaymentPill status={s.paymentStatus} size="lg"/>
            </div>
          </div>
        </div>
      </GlassCard>

      <PillTabs value={tab} onChange={setTab} tabs={[
        { id: "info",     label: "Thông tin" },
        // Payments tab only for roles with payments read (hidden for CTV).
        ...(D.can("payments", "read") ? [{ id: "payments", label: "Thanh toán", count: studentPayments.length }] : []),
      ]}/>

      {tab === "info" && <StudentInfoTab s={s} cls={cls} staff={staff} branch={branch}
                                          feePlan={feePlan} promo={promo}
                                          docs={docs} setDocs={setDocs}
                                          docsFilledCount={docsFilledCount}/>}

      {tab === "payments" && D.can("payments", "read") && (
        <StudentPaymentsTab student={s} payments={studentPayments}
                             initialPaymentId={initialPaymentId}
                             onAddPayment={onAddPayment}/>
      )}
    </div>
  );
}

function Field({ label, value, mono, color, colSpan }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: colSpan ? `span ${colSpan}` : "auto" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
        fontSize: 14, fontWeight: 500,
        color: color || "var(--fg-1)",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
      }}>{value || "—"}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--ink-4)" }}></div>;
}

// --------------------------------------------------------------------
// StudentInfoTab — 3 cards.
//   TOP ROW: Thông tin cá nhân  |  Đăng ký & Lớp học (+ Ghi chú inline)
//   BOTTOM:  Tài liệu (full width)
// --------------------------------------------------------------------
// RowField — label LEFT, value RIGHT, both on a single horizontal row.
// Used inside the Thông tin / Đăng ký cards on the student detail page.
function RowField({ label, value, mono, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16,
      padding: "10px 0",
      borderBottom: "1px solid var(--ink-4)",
    }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)", flexShrink: 0 }}>{label}</span>
      <span style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
        fontSize: 13, fontWeight: 600,
        color: color || "var(--fg-1)",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
        textAlign: "right",
      }}>{value || "—"}</span>
    </div>
  );
}

function StudentInfoTab({ s, cls, staff, branch, feePlan, promo, docs, setDocs, docsFilledCount }) {
  const D = window.MGT_DATA;
  const [notes, setNotes] = React.useState(s.notes || "");

  const SectionTitle = ({ children }) => (
    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>{children}</h3>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top row — two cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* LEFT — Thông tin cá nhân */}
        <GlassCard padding={24}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>Thông tin cá nhân</SectionTitle>
            <div>
              <RowField label="Số CCCD"        value={window.fmtCCCD(s.idNumber)} mono/>
              <RowField label="Họ và tên"      value={s.name}/>
              <RowField label="Ngày sinh"      value={s.dob}                 mono/>
              <RowField label="Giới tính"      value={s.gender}/>
              <RowField label="Nơi tạm trú"    value={s.noiTamTru || s.address}/>
              <RowField label="Nơi thường trú" value={s.address}/>
              <RowField label="Ngày cấp"       value={s.ngayCapCCCD || "—"}  mono/>
              {/* Last row — drop the bottom border for clean edge */}
              <div style={{ marginBottom: -1 }}>
                <RowField label="Nơi cấp" value={s.noiCapCCCD || "Cục Cảnh sát QLHC về TTXH"}/>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* RIGHT — Đăng ký & Lớp học (with inline Ghi chú textarea) */}
        <GlassCard padding={24}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SectionTitle>Đăng ký & Lớp học</SectionTitle>
            <div>
              <RowField label="Mã HV"              value={s.maHV}      mono/>
              <RowField label="SĐT"                value={window.fmtPhone(s.phone)} mono/>
              <RowField label="Loại bằng"          value={s.licence}/>
              <RowField label="Lớp học"            value={cls ? cls.code : "—"}/>
              <RowField label="Nhân viên"          value={staff ? staff.name : "—"}/>
              <div style={{ marginBottom: -1 }}>
                <RowField label="Thời điểm đăng ký" value={s.createdAt} mono/>
              </div>
            </div>

            {/* Inline notes — typable textarea replaces the old Ghi chú card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ghi chú</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Nhập ghi chú…"
                        rows={4}
                        style={{
                          width: "100%", resize: "vertical",
                          background: "var(--ink-2)",
                          border: "1px solid var(--glass-stroke)",
                          color: "var(--fg-1)", borderRadius: 10,
                          padding: "10px 12px",
                          fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5,
                          outline: "none",
                          transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
                        }}
                        onFocus={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
                        onBlur={e => {
                          e.target.style.borderColor = "var(--glass-stroke)";
                          e.target.style.boxShadow = "none";
                          // Persist on blur so notes survive tab-switch / reload.
                          // Skip the round-trip if nothing actually changed.
                          if ((notes || "") !== (s.notes || "")) {
                            D.api.updateStudent(s.id, { notes }).catch(err => alert("Không thể lưu ghi chú. Kiểm tra mạng rồi thử lại."));
                          }
                        }}/>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Bottom — Tài liệu (full width) */}
      <GlassCard padding={24}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, flex: 1, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>Tài liệu</h3>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.08em" }}>{docsFilledCount}/4 · kéo & thả vào ô</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {D.PROFILE_DOCS.map(doc => (
              <DocSlot key={doc.key} doc={doc} filled={docs[doc.key]}
                       previewUrl={s['docs_' + doc.key + '_url']}
                       onDrop={(k, file) => {
                         setDocs(prev => ({ ...prev, [k]: true }));
                         if (file) {
                           D.api.uploadStudentDoc(s.id, k, file)
                             .catch(err => window.MGT_TOAST && window.MGT_TOAST("Không thể tải ảnh lên. Kiểm tra mạng rồi thử lại."));
                         }
                       }}
                       onClear={(k) => {
                         // Optimistic flip + backend DELETE. On failure restore
                         // the local flag and surface the error via toast so the
                         // UI doesn't claim the file is gone while it persists.
                         setDocs(prev => ({ ...prev, [k]: false }));
                         D.api.deleteStudentDoc(s.id, k).catch(err => {
                           setDocs(prev => ({ ...prev, [k]: true }));
                           window.MGT_TOAST && window.MGT_TOAST("Không thể xóa ảnh. Kiểm tra mạng rồi thử lại.");
                         });
                       }}/>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "color-mix(in oklab, var(--neon-cyan) 8%, transparent)", border: "1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon name="command" size={14} color="var(--neon-cyan)" style={{ marginTop: 2, flexShrink: 0 }}/>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
              Kéo ảnh CCCD vào ô đầu tiên — OCR sẽ tự điền họ tên, ngày sinh, số CCCD và địa chỉ.
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function StudentPaymentsTab({ student, payments, initialPaymentId, onAddPayment }) {
  // Sort ascending so cumulative snapshots reflect ledger order; display
  // newest-first for readability.
  const sortedAsc = React.useMemo(
    () => [...payments].sort((a, b) => a.createdAtMs - b.createdAtMs),
    [payments]
  );
  // Pre-compute running totals so each row can render the same
  // cumulative / remaining figures as the Thanh toán page rows.
  const rows = React.useMemo(() => {
    let cum = 0;
    const asc = sortedAsc.map(p => {
      cum += p.amount;
      return { p, s: student, cumulativeAfter: cum, remainingAfter: Math.max(0, student.totalFee - cum) };
    });
    return asc.slice().reverse();   // display newest-first
  }, [sortedAsc, student]);

  // Inline fly-in detail card state — same animation logic as the
  // Thanh toán page used to host.
  const [expandedId, setExpandedId] = React.useState(initialPaymentId || null);
  const [closingId,  setClosingId]  = React.useState(null);
  const pendingOpenRef = React.useRef(null);

  // If the route arrives with an `initialPaymentId`, scroll the row into
  // view on mount.
  const rowRefs = React.useRef({});
  React.useEffect(() => {
    if (initialPaymentId && rowRefs.current[initialPaymentId]) {
      rowRefs.current[initialPaymentId].scrollIntoView({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRowClick = (paymentId) => {
    if (closingId) return;
    if (expandedId === paymentId) {
      setClosingId(paymentId);
      setExpandedId(null);
      setTimeout(() => setClosingId(null), 280);
    } else if (expandedId) {
      pendingOpenRef.current = paymentId;
      setClosingId(expandedId);
      setExpandedId(null);
      setTimeout(() => {
        setClosingId(null);
        if (pendingOpenRef.current) {
          setExpandedId(pendingOpenRef.current);
          pendingOpenRef.current = null;
        }
      }, 280);
    } else {
      setExpandedId(paymentId);
    }
  };

  return (
    <GlassCard padding={24}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <SummaryStat label="Tổng học phí" value={window.fmtVND(student.totalFee)}/>
          <SummaryStat label="Đã thu" value={window.fmtVND(student.paid)} color="var(--neon-lime)"/>
          <SummaryStat label="Còn nợ" value={window.fmtVND(student.balance)} color={student.balance > 0 ? "var(--neon-pink)" : "var(--fg-1)"}/>
          <SummaryStat label="Trạng thái" value={student.paymentStatus}
                       color={student.paymentStatus === "100%" ? "var(--neon-lime)" : student.paymentStatus === "50%" ? "var(--neon-amber)" : "var(--neon-pink)"}/>
        </div>

        <Divider/>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, flex: 1, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)" }}>Lịch sử thanh toán</h3>
          <Button variant="primary" size="sm" icon="plus"
                  onClick={() => onAddPayment && onAddPayment(student.id, student.balance)}>
            Ghi nhận thanh toán
          </Button>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
            Học viên chưa có lịch sử thanh toán. Trạng thái mặc định là 0%.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "130px 90px 1.1fr 1.1fr 1.1fr 100px 60px",
              padding: "10px 12px", gap: 12, borderBottom: "1px solid var(--ink-4)",
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
            }}>
              <span>Thời điểm</span>
              <span>Mã TT</span>
              <span style={{ textAlign: "right" }}>Số tiền</span>
              <span style={{ textAlign: "right" }}>Đã thu</span>
              <span style={{ textAlign: "right" }}>Còn nợ</span>
              <span>Hình thức</span>
              <span style={{ textAlign: "center" }}>Biên lai</span>
            </div>

            {rows.map((r, i) => {
              const isOpen   = expandedId === r.p.id;
              const isClosing = closingId === r.p.id;
              const showCard  = isOpen || isClosing;
              const isLast = i === rows.length - 1;
              return (
                <React.Fragment key={r.p.id}>
                  <div ref={el => { if (el) rowRefs.current[r.p.id] = el; }}
                       onClick={() => onRowClick(r.p.id)}
                       style={{
                         display: "grid", gridTemplateColumns: "130px 90px 1.1fr 1.1fr 1.1fr 100px 60px",
                         padding: "14px 12px", gap: 12, alignItems: "center", cursor: "pointer",
                         position: "relative", zIndex: showCard ? 2 : 1,
                         borderBottom: isLast && !showCard ? "none" : "1px solid var(--ink-4)",
                         background: isOpen ? "color-mix(in oklab, var(--neon-cyan) 9%, transparent)" : "transparent",
                         // Pretty selection effect — top + side borders + outer glow.
                         // Bottom edge is intentionally open so the selection visually
                         // flows down into the fly-in detail card.
                         boxShadow: showCard
                           ? "inset 0 1px 0 var(--neon-cyan), inset 1px 0 0 var(--neon-cyan), inset -1px 0 0 var(--neon-cyan), 0 -2px 22px var(--neon-cyan-haze)"
                           : "none",
                         transition: "background 180ms var(--ease-out), box-shadow 180ms var(--ease-out)",
                       }}
                       onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "var(--glass-2)"; }}
                       onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}>
                    {/* Thời điểm */}
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{r.p.createdAt.split(" ").slice(0, 2).join(" ")}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{r.p.createdAt.split(" ")[2] || ""}</span>
                    </div>
                    {/* Mã TT */}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontWeight: 600, letterSpacing: "0.04em" }}>{r.p.id}</span>
                    {/* Số tiền (this payment) */}
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--neon-lime)", fontWeight: 600 }}>+{window.fmtVND(r.p.amount)}</span>
                    {/* Đã thu (cumulative through this payment) */}
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--fg-1)", fontWeight: 600 }}>{window.fmtVND(r.cumulativeAfter)}</span>
                    {/* Còn nợ (after this payment) */}
                    <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: r.remainingAfter > 0 ? "var(--neon-pink)" : "var(--fg-3)", fontWeight: 600 }}>{r.remainingAfter > 0 ? window.fmtVND(r.remainingAfter) : "—"}</span>
                    {/* Hình thức */}
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{r.p.method}</span>
                    {/* Biên lai */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <BienLaiMark hasPhoto={r.p.bienLaiPhoto}/>
                    </div>
                  </div>
                  {showCard && (
                    <PaymentDetailCard row={r} isClosing={isClosing} onOpenStudent={() => {}}/>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Rentals — pay-on-the-spot, informational only. Does NOT count
            toward the student's tuition balance. Operators record rentals
            from the Phương tiện page; this section just exposes them on
            the student's profile for cross-reference. */}
        <StudentRentalsSection studentId={student.id}/>
      </div>
    </GlassCard>
  );
}

// --------------------------------------------------------------------
// StudentRentalsSection — small "Thuê xe" list under the main payments.
// Hidden entirely when the student has zero rentals so it doesn't add
// noise to the common case.
// --------------------------------------------------------------------
function StudentRentalsSection({ studentId }) {
  const D = window.MGT_DATA;
  const rentals = D.rentalsForStudent(studentId);
  if (rentals.length === 0) return null;
  const sorted = [...rentals].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const total = rentals.reduce((s, r) => s + r.amount, 0);
  const totalRounds = rentals.reduce((s, r) => s + (r.rentalRounds || 0), 0);
  return (
    <>
      <Divider/>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ margin: 0, flex: 1, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)" }}>Thuê xe</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {rentals.length} lượt · {totalRounds} lượt thuê · {window.fmtVND(total)}
          </span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>
          Pay-on-the-spot — không tính vào học phí / công nợ.
        </span>
        <div style={{
          display: "grid", gridTemplateColumns: "150px 1fr 80px 130px 1fr",
          padding: "10px 12px", gap: 12, borderBottom: "1px solid var(--ink-4)",
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
        }}>
          <span>Thời điểm</span><span>Xe</span>
          <span style={{ textAlign: "right" }}>Lượt</span>
          <span style={{ textAlign: "right" }}>Số tiền</span><span>Nhân viên</span>
        </div>
        {sorted.map((r, i) => {
          const v = D.getVehicle(r.vehicleId);
          const staff = D.getStaff(r.staffId);
          return (
            <div key={r.id} style={{
              display: "grid", gridTemplateColumns: "150px 1fr 80px 130px 1fr",
              padding: "10px 12px", gap: 12, alignItems: "center",
              borderBottom: i < sorted.length - 1 ? "1px solid var(--ink-4)" : "none",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{r.createdAt}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-1)" }}>{v ? `${v.name} · ${v.plate || "—"}` : r.vehicleId || "—"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{r.rentalRounds || 0}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{window.fmtVND(r.amount)}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)" }}>{staff?.name || "—"}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SummaryStat({ label, value, color }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, lineHeight: 1,
        color: color || "var(--fg-1)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em",
      }}>{value}</span>
    </div>
  );
}

Object.assign(window, { StudentsScreen, StudentDetail, Field, Divider });
