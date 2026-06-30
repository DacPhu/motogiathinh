// ====================================================================
// Tổ chức — chi nhánh / tài khoản / học phí / khuyến mãi /
//             giáo viên / phương tiện / nhật ký
// ====================================================================

const PASSWORD_CHECKS_CTV = [
  { label: "≥ 1 ký tự",  test: (v) => (v || "").length >= 1 },
];
const PASSWORD_CHECKS_ADMIN_STAFF = [
  { label: "≥ 6 ký tự",           test: (v) => (v || "").length >= 6 },
  { label: "1 chữ cái in hoa",    test: (v) => /[A-Z]/.test(v || "") },
  { label: "1 chữ cái in thường", test: (v) => /[a-z]/.test(v || "") },
  { label: "1 chữ số",            test: (v) => /[0-9]/.test(v || "") },
  { label: "1 ký tự đặc biệt",    test: (v) => /[^A-Za-z0-9]/.test(v || "") },
];
function pwChecksForRole(role) {
  return (role === "collaborator") ? PASSWORD_CHECKS_CTV : PASSWORD_CHECKS_ADMIN_STAFF;
}
function pwOk(v, role) {
  return pwChecksForRole(role).every(c => c.test(v));
}

function PasswordChecks({ value, checks = PASSWORD_CHECKS_ADMIN_STAFF }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: 3, marginTop: 6,
    }}>
      {checks.map((c, i) => {
        const pass = c.test(value || "");
        return (
          <span key={i} style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            letterSpacing: "0.06em",
            color: pass ? "var(--neon-lime)" : "var(--fg-4)",
            transition: "color 160ms var(--ease-out)",
          }}>{c.label}</span>
        );
      })}
    </div>
  );
}

function OrganizationScreen({ onOpenClass, onOpenStudent }) {
  const D = window.MGT_DATA;
  const [tab, setTab] = React.useState("branches");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PillTabs value={tab} onChange={setTab} tabs={[
        { id: "branches", label: "Chi nhánh",  count: D.branches.length },
        { id: "accounts", label: "Tài khoản",  count: D.accounts.length },
        { id: "fees",     label: "Học phí",    count: D.feePlans.length },
        { id: "promos",   label: "Khuyến mãi", count: D.promotions.length },
        { id: "teachers", label: "Giáo viên",  count: D.teachers.length },
        { id: "vehicles", label: "Phương tiện",count: D.vehicles.length },
        { id: "activity", label: "Lịch sử",    count: D.activityLog.length },
      ].filter(t => t.id !== "activity" || D.can("activity_log", "r"))}/>

      {tab === "branches" && <BranchesTab onOpenClass={onOpenClass}/>}
      {tab === "accounts" && <AccountsTab/>}
      {tab === "fees"     && <FeesTab/>}
      {tab === "promos"   && <PromosTab/>}
      {tab === "teachers" && <TeachersTab/>}
      {tab === "vehicles" && <VehiclesTab onOpenStudent={onOpenStudent}/>}
      {tab === "activity" && D.can("activity_log", "r") && <ActivityTab/>}
    </div>
  );
}

function BranchesTab({ onOpenClass }) {
  const D = window.MGT_DATA;
  const branchTones = window.useBranchTones();   // single hook call — index per branch below
  const [selectedId, setSelectedId] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [ctxMenu, setCtxMenu] = React.useState(null); // { id, x, y }
  const canCreate = D.can("branches", "create");
  const canUpdate = D.can("branches", "update");

  React.useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [!!ctxMenu]);

  const toggle = (id) => setSelectedId(prev => prev === id ? null : id);
  // Managers come from admin/staff accounts (any active account is eligible).
  const managerOpts = [
    { id: "", label: "— Chưa gán —" },
    ...D.accounts.filter(a => a.active !== false).map(a => ({ id: a.id, label: `${a.name} · ${a.role === "admin" ? "Admin" : "NV"}` })),
  ];
  const branchFields = [
    { id: "name",       label: "Tên chi nhánh", type: "text",   placeholder: "Chi nhánh Quận 1", fullWidth: true },
    { id: "address",    label: "Địa chỉ",       type: "text",   placeholder: "123 Lê Lợi, Q.1, TP.HCM", fullWidth: true },
    { id: "manager_id", label: "Quản lý",       type: "select", options: managerOpts, fullWidth: true },
  ];
  // address is locked on edit — immutable identifier
  const branchEditFields = branchFields.map(f => f.id === "address" ? { ...f, disabled: true } : f);
  const editing = editingId ? D.getBranch(editingId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canCreate && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {D.branches.length} chi nhánh
          </span>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>Thêm chi nhánh</Button>
        </div>
      )}
      <RecordCreatorModal open={createOpen} onClose={() => setCreateOpen(false)}
        title="Thêm chi nhánh"
        onCreate={(d) => window.MGT_DATA.api.createBranch(d).catch(e => reportWriteError(e, "Lỗi tạo chi nhánh"))}
        fields={branchFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa chi nhánh"
        subtitle={editing?.name}
        initialValues={editing || {}}
        fields={branchEditFields}
        onSave={(d) => window.MGT_DATA.api.updateBranch(editingId, d)}/>
      {/* Right-click context menu for branch cards (admin only) */}
      {ctxMenu && canUpdate && (
        <div style={{
          position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 100010,
          background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
          backdropFilter: "var(--glass-blur)", borderRadius: 10, padding: "4px 0",
          boxShadow: "var(--shadow-2)", minWidth: 140,
        }} onClick={(e) => e.stopPropagation()}>
          <div onClick={() => { setEditingId(ctxMenu.id); setCtxMenu(null); }} style={{
            padding: "8px 14px", cursor: "pointer", fontSize: 13,
            fontFamily: "var(--font-ui)", color: "var(--fg-1)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="edit" size={14}/> Sửa
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {D.branches.map(b => {
          // Use index maps — O(1) per branch instead of three full scans.
          const branchStaff   = D.accounts.filter(a => a.branchId === b.id && a.role === "staff");
          const branchStudents = D._indexes.studentsByBranchId.get(b.id) || [];
          const branchPayments = D._indexes.paymentsByBranchId.get(b.id) || [];
          const staffCount = branchStaff.length;
          const studentCount = branchStudents.length;
          let revenue = 0;
          for (const p of branchPayments) revenue += p.amount;
          const isSelected = selectedId === b.id;
          const tone = branchTones[b.id]?.tones[0] || "var(--neon-cyan)";
          return (
            <GlassCard key={b.id} padding={22}
                       onClick={() => toggle(b.id)}
                       onContextMenu={canUpdate ? (e) => { e.preventDefault(); setCtxMenu({ id: b.id, x: e.clientX, y: e.clientY }); } : undefined}
                       style={{
                         cursor: "pointer",
                         transition: "all 220ms var(--ease-out)",
                         borderColor: isSelected ? tone : "var(--glass-stroke)",
                         boxShadow: isSelected
                           ? `0 0 0 1px ${tone}, 0 0 28px color-mix(in oklab, ${tone} 42%, transparent), var(--shadow-2)`
                           : `0 0 18px color-mix(in oklab, ${tone} 14%, transparent), var(--shadow-2)`,
                         background: `linear-gradient(135deg, color-mix(in oklab, ${tone} 9%, transparent), transparent 70%), var(--glass-2)`,
                         transform: isSelected ? "translateY(-2px)" : "none",
                       }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, var(--ink-0)))`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 16px color-mix(in oklab, ${tone} 52%, transparent)`,
                  }}>
                    <Icon name="home" size={20} color="var(--ink-0)"/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{b.name}</h3>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>{b.address}</span>
                  </div>
                  {/* Sửa available via right-click → context menu (admin only) */}
                </div>

                <Divider/>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <MicroStat label="Nhân viên" value={staffCount}/>
                  <MicroStat label="Học viên"  value={studentCount}/>
                  <MicroStat label="Doanh thu" value={window.fmtVND(revenue)} mono color="var(--neon-lime)"/>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                  {(() => {
                    const mgr = D.getStaff(b.manager_id);
                    const mgrName = mgr?.name || "—";
                    return (
                      <>
                        <Avatar name={mgrName} size={26}/>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Quản lý</span>
                          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)" }}>{mgrName}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {selectedId && <BranchExpanded branchId={selectedId} onClose={() => setSelectedId(null)} onOpenClass={onOpenClass}/>}
    </div>
  );
}

// Expanded detail card — appears under the 3 branch cards on click.
// Subtle roll-down animation, content swaps in-place when selection changes.
function BranchExpanded({ branchId, onClose, onOpenClass }) {
  const D = window.MGT_DATA;
  const tone = window.useBranchTone(branchId);
  const b = D.getBranch(branchId);
  const branchStaff   = D.accounts.filter(a => a.branchId === branchId && a.role === "staff");
  const branchClasses = D.classes.filter(c => c.branchId === branchId);
  // Parse dd/mm/yyyy → ms so the sort respects calendar order.
  const dateMs = (s) => {
    if (!s) return 0;
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  // Compute revenue + student count per class first, then sort across
  // whichever key the user picked (sort menu replaces the old Đóng button).
  const enriched = branchClasses.map(cls => {
    const studentsInClass = D.studentsInClass(cls.id);
    const studentIds = new Set(studentsInClass.map(s => s.id));
    const revenue = D.payments.filter(p => studentIds.has(p.studentId)).reduce((acc, p) => acc + p.amount, 0);
    return { cls, count: studentsInClass.length, revenue,
             _openMs: dateMs(cls.openDate), _examMs: dateMs(cls.examDate) };
  });
  const sortOpts = [
    { id: "open:desc",  label: "Ngày mở: Mới → Cũ" },
    { id: "open:asc",   label: "Ngày mở: Cũ → Mới" },
    { id: "exam:desc",  label: "Ngày thi: Mới → Cũ" },
    { id: "exam:asc",   label: "Ngày thi: Cũ → Mới" },
    { id: "count:desc", label: "Sĩ số ↓" },
    { id: "count:asc",  label: "Sĩ số ↑" },
    { id: "rev:desc",   label: "Doanh thu ↓" },
    { id: "rev:asc",    label: "Doanh thu ↑" },
  ];
  const [sortKey, setSortKey] = React.useState("open:desc");
  const [skField, skDir] = sortKey.split(":");
  const skMap = { open: "_openMs", exam: "_examMs", count: "count", rev: "revenue" };
  const skProp = skMap[skField];
  const classWithRevenue = enriched.slice().sort((a, c) => {
    const av = a[skProp] || 0, cv = c[skProp] || 0;
    return skDir === "asc" ? av - cv : cv - av;
  });

  return (
    <div key={branchId} style={{ animation: "mgt-roll-down 280ms var(--ease-out)" }}>
      <style>{`
        @keyframes mgt-roll-down {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.96); transform-origin: top; max-height: 0; }
          to   { opacity: 1; transform: translateY(0) scaleY(1); max-height: 2000px; }
        }
      `}</style>
      <GlassCard padding={26}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 8, height: 28, borderRadius: 2,
              background: tone,
              boxShadow: `0 0 12px color-mix(in oklab, ${tone} 60%, transparent)`,
            }}/>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{b.name}</h3>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>{b.address} · Quản lý: {D.getStaff(b.manager_id)?.name || "—"}</span>
            </div>
            <SortMenu value={sortKey} onChange={setSortKey} options={sortOpts}/>
          </div>

          {/* Staff cards */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {branchStaff.map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12,
                  background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                }}>
                  <Avatar name={s.name} size={28}/>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Classes list */}
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "1.6fr 130px 130px 90px 130px 140px",
              padding: "10px 14px", gap: 12, borderBottom: "1px solid var(--ink-4)",
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
            }}>
              <span>Mã lớp</span><span>Ngày mở</span><span>Ngày thi</span><span>Sĩ số</span><span>Trạng thái</span><span style={{ textAlign: "right" }}>Doanh thu</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {classWithRevenue.map((row, i) => (
                <div key={row.cls.id}
                     onClick={() => onOpenClass && onOpenClass(row.cls.id)}
                     style={{
                       display: "grid", gridTemplateColumns: "1.6fr 130px 130px 90px 130px 140px",
                       padding: "12px 14px", gap: 12, alignItems: "center",
                       borderBottom: i < classWithRevenue.length - 1 ? "1px solid var(--ink-4)" : "none",
                       cursor: onOpenClass ? "pointer" : "default",
                       transition: "background 140ms var(--ease-out)",
                     }}
                     onMouseEnter={e => { if (onOpenClass) e.currentTarget.style.background = "var(--glass-2)"; }}
                     onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{row.cls.code}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.cls.openDate}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.cls.examDate}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{row.count}</span>
                  <ClassStatusPill status={row.cls.status}/>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums" }}>{window.fmtVND(row.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function AccountsTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [pwId, setPwId] = React.useState(null);
  const canCreate = D.can("accounts", "create");
  const canUpdate = D.can("accounts", "update");
  // "Bảng vàng CTV" launcher — admin/staff only. Collaborators never reach
  // this screen (AppRoot excludes them); the role check mirrors app.jsx's
  // isCtv idiom as belt-and-suspenders.
  const role = D.currentUser.role;
  const isCtv = role === "collaborator" || role === "guest";
  // No placeholder entry — "" is not an accepted value server-side, and
  // EditRecordModal/RecordCreatorModal seed selects from options[0].id so
  // the first real branch is the default.
  const branchOpts = D.branches.map(b => ({ id: b.id, label: b.name }));
  // Active classes only — collaborators are assigned to classes that are
  // currently open / running (status derived in data-loader).
  const activeClassOpts = D.classes
    .filter(c => c.status === "đang mở" || c.status === "đang diễn ra")
    .map(c => ({ value: c.id, label: c.code }));
  const accountCreateFields = [
    { id: "name",     label: "Họ tên",                  type: "text",   placeholder: "Nguyễn Văn A", fullWidth: true },
    { id: "role",     label: "Vai trò",                 type: "select", options: [{ id: "staff", label: "Nhân viên" }, { id: "admin", label: "Admin" }, { id: "collaborator", label: "Cộng tác viên" }] },
    { id: "branchId", label: "Chi nhánh",               type: "select", options: branchOpts,
      showIf: v => v.role !== "collaborator" },
    { id: "branchIds", label: "Chi nhánh được giao",    type: "tagselect",
      options: D.branches.map(b => ({ value: b.id, label: b.name })),
      showIf: v => v.role === "collaborator" },
    { id: "classIds",  label: "Lớp được giao",          type: "tagselect",
      options: activeClassOpts,
      showIf: v => v.role === "collaborator" },
    { id: "email",    label: "Tên đăng nhập (Email)",   type: "text",   placeholder: "you@motogiathinh.vn" },
    { id: "phone",    label: "Số điện thoại",           type: "phone",  placeholder: "090 123 4567" },
    { id: "password", label: "Mật khẩu tạm thời",       type: "password", placeholder: "Mật khẩu mới",
      fullWidth: true },
  ];
  // PATCH doesn't accept `password` — keep the edit form without it
  // (use Đặt lại mật khẩu instead). name and email are locked (immutable identifiers).
  const accountEditFields = accountCreateFields
    .filter(f => f.id !== "password")
    .map(f => (f.id === "name" || f.id === "email") ? { ...f, disabled: true } : f);
  const editing = editingId ? D.accounts.find(x => x.id === editingId) : null;
  const pwAccount = pwId ? D.accounts.find(x => x.id === pwId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.accounts.length} tài khoản</span>
        <div style={{ flex: 1 }}></div>
        {!isCtv && <CtvCompetitionLauncher/>}
        {canCreate && <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo tài khoản</Button>}
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo tài khoản mới"
        onCreate={(d) => window.MGT_DATA.api.createAccount(d)}
        fields={accountCreateFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa tài khoản" subtitle={editing?.name}
        initialValues={editing || {}} fields={accountEditFields}
        onSave={(d) => window.MGT_DATA.api.updateAccount(editingId, d)}/>
      <PasswordResetModal open={!!pwAccount} onClose={() => setPwId(null)}
        account={pwAccount}
        onSubmit={(pw) => window.MGT_DATA.api.resetPassword(pwId, pw)}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px 40px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Tài khoản</span><span>Vai trò</span><span>Email</span><span>Chi nhánh</span><span>Hoạt động cuối</span><span>Trạng thái</span><span></span>
      </div>
      {[...D.accounts].filter(a => a.role !== "guest").sort((a, b) => {
        // Primary: role priority (admin > staff > collaborator)
        const roleOrder = { admin: 0, staff: 1, collaborator: 2, guest: 3 };
        const ra = roleOrder[a.role] ?? 9;
        const rb = roleOrder[b.role] ?? 9;
        if (ra !== rb) return ra - rb;
        // Secondary: most recently active first
        const parseLast = (s) => { if (!s) return 0; const [d,m,yrest] = s.split("/"); const [y,t] = yrest.split(" "); return new Date(y, m-1, d, ...(t||"0:0").split(":").map(Number)).getTime(); };
        return parseLast(b.lastActive) - parseLast(a.lastActive);
      }).map((a, i) => {
        const b = D.getBranch(a.branchId);
        return (
          <div key={a.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 110px 1.4fr 1fr 140px 100px 40px",
            padding: "14px 22px", gap: 12, alignItems: "center",
            borderBottom: i < D.accounts.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={a.name} size={30}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{a.name}</span>
            </div>
            <Chip color={a.role === "admin" ? "var(--neon-violet)" : a.role === "collaborator" ? "var(--neon-cyan)" : "var(--fg-1)"}>
              {a.role === "admin" ? "Admin" : a.role === "collaborator" ? "Cộng tác viên" : "Nhân viên"}
            </Chip>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>{a.email}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{b ? b.name : "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{a.lastActive}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 8px", borderRadius: 999,
              background: a.active ? "color-mix(in oklab, var(--neon-lime) 14%, transparent)" : "var(--ink-3)",
              color: a.active ? "var(--neon-lime)" : "var(--fg-3)",
              border: `1px solid ${a.active ? "color-mix(in oklab, var(--neon-lime) 36%, transparent)" : "var(--glass-stroke)"}`,
              display: "inline-block", textAlign: "center",
            }}>{a.active ? "ACTIVE" : "DISABLED"}</span>
            <MoreMenu items={[
              { label: "Sửa", onClick: () => setEditingId(a.id), hidden: !canUpdate },
              { label: a.active ? "Vô hiệu hoá" : "Kích hoạt",
                onClick: () => window.MGT_DATA.api.updateAccount(a.id, { active: !a.active }).catch(e => reportWriteError(e, "Lỗi cập nhật")),
                hidden: !canUpdate },
              { label: "Đặt lại mật khẩu", onClick: () => setPwId(a.id), hidden: !canUpdate },
            ]}/>
          </div>
        );
      })}
    </GlassCard>
  );
}

function FeesTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const canCreate = D.can("fee_plans", "create");
  const canUpdate = D.can("fee_plans", "update");
  const feeFields = [
    { id: "name",     label: "Tên gói",  type: "text",   placeholder: "A — Trọn gói" },
    { id: "licence",  label: "Bằng",     type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
    { id: "amount",   label: "Số tiền",  type: "money",  placeholder: "1995000" },
  ];
  const editing = editingId ? D.getFeePlan(editingId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.feePlans.length} gói học phí</span>
        {canCreate && <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo gói</Button>}
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo gói học phí"
        onCreate={(d) => window.MGT_DATA.api.createFeePlan(d)}
        fields={feeFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa gói học phí" subtitle={editing?.name}
        initialValues={editing || {}} fields={feeFields}
        onSave={(d) => window.MGT_DATA.api.updateFeePlan(editingId, d)}/>
      {D.feePlans.map((f, i) => (
        <div key={f.id} style={{
          display: "grid", gridTemplateColumns: "1fr 80px 200px 40px",
          padding: "14px 22px", gap: 14, alignItems: "center",
          borderBottom: i < D.feePlans.length - 1 ? "1px solid var(--ink-4)" : "none",
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{f.name}</span>
          <Chip>{f.licence}</Chip>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--fg-1)",
            fontVariantNumeric: "tabular-nums",
          }}>{window.fmtVND(f.amount)}</span>
          <MoreMenu items={[
            { label: "Sửa", onClick: () => setEditingId(f.id), hidden: !canUpdate },
          ]}/>
        </div>
      ))}
    </GlassCard>
  );
}

function PromosTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const canCreate = D.can("promotions", "create");
  const canUpdate = D.can("promotions", "update");
  // Edit form takes the licence array directly (the create form maps fee-
  // plan ids → distinct licences before sending — preserved for parity).
  const promoEditFields = [
    { id: "name",      label: "Tên chương trình",   type: "text",      placeholder: "Hè Vui — Giảm 200K", fullWidth: true },
    { id: "discount",  label: "Số tiền giảm (đ)",   type: "money",     placeholder: "200000",             fullWidth: true },
    { id: "appliesTo", label: "Áp dụng cho bằng",   type: "multipill", color: "lime",
      options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
  ];
  // Normalize appliesTo at modal entry: some legacy rows store fee-plan
  // ids (e.g. "fee-a"); the edit form expects licences ("A"/"A1"). Map
  // through getFeePlan() for ids; pass-through anything already A/A1.
  const editing = editingId ? D.getPromotion(editingId) : null;
  const editingNorm = editing ? {
    ...editing,
    appliesTo: Array.from(new Set((editing.appliesTo || []).map(v =>
      v === "A" || v === "A1" ? v : (D.getFeePlan(v)?.licence || null)
    ).filter(Boolean))),
  } : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.promotions.length} khuyến mãi</span>
        {canCreate && <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Tạo khuyến mãi</Button>}
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Tạo khuyến mãi"
        onCreate={(d) => {
          // multipill option ids are fee-plan ids; spec stores licences (A/A1).
          // Resolve fee-plan ids → distinct licences before sending.
          const licences = Array.from(new Set(
            (d.appliesTo || []).map(id => D.getFeePlan(id)?.licence).filter(Boolean)
          ));
          return window.MGT_DATA.api.createPromotion({ ...d, appliesTo: licences });
        }}
        fields={[
          { id: "name",      label: "Tên chương trình",  type: "text",      placeholder: "Hè Vui — Giảm 200K", fullWidth: true },
          { id: "discount",  label: "Số tiền giảm (đ)",  type: "text",      placeholder: "200000",             fullWidth: true },
          { id: "appliesTo", label: "Áp dụng cho gói học phí", type: "multipill", color: "lime",
            options: D.feePlans.map(f => ({ id: f.id, label: `${f.name} · ${window.fmtVND(f.amount)}` })),
          },
        ]}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa khuyến mãi" subtitle={editing?.name}
        initialValues={editingNorm || {}} fields={promoEditFields}
        onSave={(d) => window.MGT_DATA.api.updatePromotion(editingId, d)}/>
      {D.promotions.map((p, i) => (
        <div key={p.id} style={{
          display: "grid", gridTemplateColumns: "1fr 180px 200px 40px",
          padding: "14px 22px", gap: 14, alignItems: "center",
          borderBottom: i < D.promotions.length - 1 ? "1px solid var(--ink-4)" : "none",
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{p.name}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {p.appliesTo.map(a => <Chip key={a}>{a}</Chip>)}
          </div>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700,
            color: p.discount > 0 ? "var(--neon-lime)" : "var(--fg-3)",
            fontVariantNumeric: "tabular-nums",
          }}>{p.discount > 0 ? `−${window.fmtVND(p.discount)}` : window.fmtVND(0)}</span>
          <MoreMenu items={[
            { label: "Sửa", onClick: () => setEditingId(p.id), hidden: !canUpdate },
          ]}/>
        </div>
      ))}
    </GlassCard>
  );
}

function TeachersTab() {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const canCreate = D.can("teachers", "create");
  const canUpdate = D.can("teachers", "update");
  // No placeholder entry — "" is not an accepted value server-side, and
  // EditRecordModal/RecordCreatorModal seed selects from options[0].id so
  // the first real branch is the default.
  const branchOpts = D.branches.map(b => ({ id: b.id, label: b.name }));
  const teacherFields = [
    { id: "name",     label: "Họ tên",        type: "text",   placeholder: "Trần Văn B" },
    { id: "phone",    label: "Số điện thoại", type: "phone",  placeholder: "09…" },
    { id: "branchId", label: "Chi nhánh",     type: "select", options: branchOpts },
  ];
  const editing = editingId ? D.teachers.find(x => x.id === editingId) : null;
  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)", display: "flex", alignItems: "center" }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{D.teachers.length} giáo viên</span>
        {canCreate && <Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Thêm giáo viên</Button>}
      </div>
      <RecordCreatorModal open={open} onClose={() => setOpen(false)}
        title="Thêm giáo viên"
        onCreate={(d) => window.MGT_DATA.api.createTeacher(d)}
        fields={teacherFields}/>
      <EditRecordModal open={!!editing} onClose={() => setEditingId(null)}
        title="Sửa giáo viên" subtitle={editing?.name}
        initialValues={editing || {}} fields={teacherFields}
        onSave={(d) => window.MGT_DATA.api.updateTeacher(editingId, d)}/>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px 40px",
        padding: "12px 22px", gap: 12, borderBottom: "1px solid var(--ink-4)",
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
      }}>
        <span>Họ tên</span><span>SĐT</span><span>Chi nhánh</span><span>Trạng thái</span><span></span>
      </div>
      {D.teachers.map((t, i) => {
        const b = D.getBranch(t.branchId);
        const active = t.active !== false;
        return (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1.6fr 160px 1fr 100px 40px",
            padding: "14px 22px", gap: 12, alignItems: "center",
            borderBottom: i < D.teachers.length - 1 ? "1px solid var(--ink-4)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={t.name} size={32}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{t.name}</span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{window.fmtPhone(t.phone)}</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>{b ? b.name : "—"}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
              padding: "3px 8px", borderRadius: 999,
              background: active ? "color-mix(in oklab, var(--neon-lime) 14%, transparent)" : "var(--ink-3)",
              color: active ? "var(--neon-lime)" : "var(--fg-3)",
              border: `1px solid ${active ? "color-mix(in oklab, var(--neon-lime) 36%, transparent)" : "var(--glass-stroke)"}`,
              display: "inline-block", textAlign: "center",
            }}>{active ? "ACTIVE" : "DISABLED"}</span>
            <MoreMenu items={[
              { label: "Sửa", onClick: () => setEditingId(t.id), hidden: !canUpdate },
              { label: active ? "Vô hiệu hoá" : "Kích hoạt",
                onClick: () => window.MGT_DATA.api.updateTeacher(t.id, { active: !active }).catch(e => reportWriteError(e, "Lỗi cập nhật")),
                hidden: !canUpdate },
            ]}/>
          </div>
        );
      })}
    </GlassCard>
  );
}


// --------------------------------------------------------------------
// SortMenu — small dropdown atom used in expanded detail cards. Single-
// select cycle through (field, dir) options.
// --------------------------------------------------------------------
function SortMenu({ value, onChange, options }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = options.find(o => o.id === value) || options[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 10,
        background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
        color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 12,
        cursor: "pointer",
      }}>
        <Icon name="filter" size={13}/>
        <span>Sắp xếp: {current.label}</span>
        <Icon name="arrow-down" size={11} style={{ transition: "transform 160ms var(--ease-out)", transform: open ? "rotate(180deg)" : "none" }}/>
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "100%", marginTop: 6, zIndex: 50,
          minWidth: 180, padding: 4, borderRadius: 12,
          background: "var(--glass-3)", backdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-stroke-strong)", boxShadow: "var(--shadow-3)",
        }}>
          {options.map(o => (
            <div key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
                 style={{
                   padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                   fontFamily: "var(--font-ui)", fontSize: 13,
                   color: o.id === value ? "var(--neon-cyan)" : "var(--fg-1)",
                   background: o.id === value ? "color-mix(in oklab, var(--neon-cyan) 12%, transparent)" : "transparent",
                 }}
                 onMouseEnter={(e) => { if (o.id !== value) e.currentTarget.style.background = "var(--glass-2)"; }}
                 onMouseLeave={(e) => { if (o.id !== value) e.currentTarget.style.background = "transparent"; }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Vietnamese labels for action codes. Anything missing falls back to a
// generated label from classifyAction's verb (e.g., "Tạo mới").
const ACTION_LABEL_VI = {
  "auth.login":            "Đăng nhập",
  "auth.logout":           "Đăng xuất",
  "auth.password_change":  "Đổi mật khẩu",
  "student.create":        "Tạo học viên",
  "student.update":        "Cập nhật học viên",
  "student.delete":        "Xóa học viên",
  "student.upload_doc":    "Tải tài liệu HV",
  "student.delete_doc":    "Xóa tài liệu HV",
  "payment.create":        "Thu học phí",
  "payment.rental":        "Thu thuê xe",
  "class.create":          "Tạo lớp",
  "class.update":          "Cập nhật lớp",
  "class.delete":          "Hủy lớp",
  "branches.create":       "Tạo chi nhánh",
  "branches.update":       "Cập nhật chi nhánh",
  "branches.delete":       "Xóa chi nhánh",
  "accounts.create":       "Tạo tài khoản",
  "accounts.update":       "Cập nhật tài khoản",
  "accounts.delete":       "Xóa tài khoản",
  "accounts.reset_password":      "Đặt lại mật khẩu",
  "teachers.update":       "Cập nhật giáo viên",
  "vehicles.create":       "Thêm phương tiện",
  "vehicles.update":       "Cập nhật phương tiện",
  "fee_plans.create":      "Tạo gói học phí",
  "fee_plans.update":      "Cập nhật học phí",
  "promotions.create":     "Tạo khuyến mãi",
  "promotions.update":     "Cập nhật khuyến mãi",
};

function actionLabelVi(action, fallback) {
  return ACTION_LABEL_VI[action] || fallback || action || "—";
}

// Humanize the target field on a log row — the backend sends a UUID; we
// resolve it through the in-memory store based on the action's domain.
function humanizeTarget(log) {
  const D = window.MGT_DATA;
  const t = log.target;
  if (!t) return "";
  const [domain] = String(log.action || "").split(".");
  if (domain === "student" || domain === "students") {
    const s = D.getStudent?.(t); if (s) return `${s.name} · ${s.maHV}`;
  } else if (domain === "payment" || domain === "payments" || domain === "rental") {
    // payments aren't indexed by UUID in D, scan the list once.
    const p = D.payments?.find(x => x.id === t);
    if (p) {
      const s = D.getStudent?.(p.studentId);
      return s ? `${s.name} · ${window.fmtVND?.(p.amount) || p.amount}đ` : (p.bienLaiId || t);
    }
  } else if (domain === "class" || domain === "classes") {
    const c = D.getClass?.(t); if (c) return `${c.code || c.name || ""}`;
  } else if (domain === "accounts") {
    const a = D.getStaff?.(t); if (a) return `${a.name} · ${a.email}`;
  } else if (domain === "branches") {
    const b = D.getBranch?.(t); if (b) return b.name;
  } else if (domain === "vehicles") {
    const v = D.getVehicle?.(t); if (v) return `${v.name} · ${v.plate || ""}`;
  } else if (domain === "fee_plans") {
    const f = D.getFeePlan?.(t); if (f) return f.name;
  } else if (domain === "promotions") {
    const p = D.getPromotion?.(t); if (p) return p.name;
  }
  return t;  // last resort — show the UUID
}

// classifyAction — derive (category, severity, tone) from an action string
// such as "student.create" / "payment.create" / "branches.update" /
// "auth.login_fail". Categories drive filter chips; severities drive the
// per-row tone (info=cyan for system, warn=amber for edits, danger=pink
// for deletes, money=lime for anything payment-related).
function classifyAction(action) {
  const [domain, ...rest] = String(action || "").split(".");
  const verb = rest.join(".");
  const moneyDomains = ["payment", "payments", "rental", "rentals"];
  if (moneyDomains.includes(domain)) return { cat: "money", severity: "money", verbLabel: verb || "" };
  if (verb === "delete") return { cat: "delete", severity: "danger", verbLabel: "Xóa" };
  if (verb === "update" || verb === "patch" || verb === "edit") return { cat: "edit", severity: "warn", verbLabel: "Sửa" };
  if (/auth\./.test(action) || domain === "auth" || /system|notifications\./.test(action)) return { cat: "system", severity: "system", verbLabel: verb || "" };
  if (verb === "create") return { cat: "create", severity: "info", verbLabel: "Tạo mới" };
  return { cat: "other", severity: "info", verbLabel: verb || "" };
}

function ActivityTab() {
  const D = window.MGT_DATA;
  // Per spec: "no warnings upon creation either" — `create` events are
  // off by default in Lịch sử. Edits / deletes / money are the focus.
  const [filters, setFilters] = React.useState({
    money: true, edit: true, delete: true, create: false, system: false, other: false,
  });
  const toggle = (k) => setFilters(prev => ({ ...prev, [k]: !prev[k] }));

  // Newest-first; classify + filter.
  const rows = React.useMemo(() => {
    const all = D.activityLog.slice().sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return all.map(log => ({ log, ...classifyAction(log.action) }))
      .filter(r => filters[r.cat]);
  }, [D.activityLog, filters]);

  const TONE = {
    money:  { c: "var(--neon-lime)",   g: "var(--neon-lime-glow)" },
    danger: { c: "var(--neon-pink)",   g: "var(--neon-pink-glow)" },
    warn:   { c: "var(--neon-amber)",  g: "var(--neon-amber-glow)" },
    info:   { c: "var(--neon-cyan)",   g: "var(--neon-cyan-glow)" },
    system: { c: "var(--fg-3)",        g: "transparent" },
  };

  const FilterPill = ({ k, label, color }) => (
    <button onClick={() => toggle(k)} style={{
      padding: "5px 11px", borderRadius: 999,
      background: filters[k] ? `color-mix(in oklab, ${color} 14%, transparent)` : "var(--ink-2)",
      border: `1px solid ${filters[k] ? color : "var(--glass-stroke)"}`,
      boxShadow: filters[k] ? `0 0 10px color-mix(in oklab, ${color} 40%, transparent)` : "none",
      color: filters[k] ? "var(--fg-1)" : "var(--fg-3)",
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
      cursor: "pointer", transition: "all 140ms var(--ease-out)",
    }}>{label}</button>
  );

  return (
    <GlassCard padding={0}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ink-4)",
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase", marginRight: 4 }}>
          Nhật ký · {rows.length}/{D.activityLog.length}
        </span>
        <FilterPill k="money"  label="Thanh toán" color="var(--neon-lime)"/>
        <FilterPill k="edit"   label="Sửa"        color="var(--neon-amber)"/>
        <FilterPill k="delete" label="Xóa"        color="var(--neon-pink)"/>
        <FilterPill k="create" label="Tạo mới"    color="var(--neon-cyan)"/>
        <FilterPill k="system" label="Hệ thống"   color="var(--fg-3)"/>
      </div>
      {rows.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
          Không có mục nào phù hợp với bộ lọc.
        </div>
      )}
      {rows.map(({ log, severity, verbLabel }, i) => {
        const user = D.getStaff(log.userId) || { name: "Hệ thống", role: "system" };
        const tone = TONE[severity] || TONE.info;
        return (
          <div key={log.id} style={{
            display: "grid", gridTemplateColumns: "150px 1fr 1.8fr 70px",
            padding: "14px 22px", gap: 14, alignItems: "center",
            borderBottom: i < rows.length - 1 ? "1px solid var(--ink-4)" : "none",
            borderLeft: `3px solid ${tone.c}`,
            background: severity === "danger" || severity === "money"
              ? `color-mix(in oklab, ${tone.c} 4%, transparent)` : "transparent",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{log.at}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={user.name} size={24}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)" }}>{user.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                padding: "2px 7px", borderRadius: 999,
                background: `color-mix(in oklab, ${tone.c} 18%, transparent)`,
                border: `1px solid color-mix(in oklab, ${tone.c} 40%, transparent)`,
                color: tone.c, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap",
              }} title={log.action}>{actionLabelVi(log.action, verbLabel)}</span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{humanizeTarget(log)}</span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textAlign: "right" }}>{user.role === "admin" ? "Admin" : user.role === "system" ? "Hệ thống" : user.role === "collaborator" ? "Cộng tác viên" : "Nhân viên"}</span>
          </div>
        );
      })}
    </GlassCard>
  );
}

function MicroStat({ label, value, mono, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)", fontSize: 18, fontWeight: 600, color: color || "var(--fg-1)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em" }}>{value}</span>
    </div>
  );
}

// --------------------------------------------------------------------
// MoreMenu — small popover triggered by the ··· icon button on a row.
// `items` is an array of { label, onClick, danger?, hidden? }. Click-
// outside closes the panel. Uses fixed positioning so it escapes the
// row's overflow clip.
// --------------------------------------------------------------------
function MoreMenu({ items, stopPropagation = true }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  const visible = (items || []).filter(it => !it.hidden);
  if (!visible.length) return null;
  const onToggle = (e) => {
    if (stopPropagation) e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor right-edge of menu to right-edge of trigger.
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 180) });
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={btnRef} onClick={onToggle} aria-label="Tác vụ"
        style={{
          width: 28, height: 28, borderRadius: 8, cursor: "pointer",
          background: "transparent", border: "1px solid var(--glass-stroke)",
          color: "var(--fg-3)", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 140ms var(--ease-out)",
        }}>
        <Icon name="more" size={14}/>
      </button>
      {open && ReactDOM.createPortal(
        <div ref={panelRef} onClick={e => e.stopPropagation()} style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 1100,
          minWidth: 180, padding: 6, borderRadius: 12,
          background: "var(--glass-3)", border: "1px solid var(--glass-stroke-strong)",
          boxShadow: "var(--shadow-3)",
          backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          display: "flex", flexDirection: "column",
        }}>
          {visible.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: "8px 10px", borderRadius: 8, textAlign: "left",
                fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
                color: it.danger ? "var(--neon-pink)" : "var(--fg-1)",
                transition: "background 120ms var(--ease-out)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--glass-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {it.label}
            </button>
          ))}
        </div>, document.body)}
    </>
  );
}

// --------------------------------------------------------------------
// Field-driven form helpers (shared by RecordCreatorModal/EditRecordModal).
//   fieldVisible — a field with `showIf(values) === false` is hidden.
//   stripHidden  — drop hidden fields' ids from the submitted payload so
//                  conditional values (e.g. branchId on a collaborator)
//                  never leak to the backend.
// --------------------------------------------------------------------
function fieldVisible(f, values) {
  return typeof f.showIf === "function" ? !!f.showIf(values) : true;
}
function stripHidden(draft, fields) {
  const out = { ...draft };
  for (const f of fields || []) {
    if (!fieldVisible(f, draft)) delete out[f.id];
  }
  return out;
}

// --------------------------------------------------------------------
// EditRecordModal — slim wrapper around the RecordCreatorModal field
// renderer, but seeded from `initialValues` and emitting onSave(patch).
// Used by every "Sửa" action across the Tổ chức tabs.
// --------------------------------------------------------------------
function EditRecordModal({ open, onClose, title, subtitle, fields, initialValues, onSave }) {
  const buildSeed = () => {
    const seed = {};
    for (const f of fields || []) {
      const v = initialValues?.[f.id];
      seed[f.id] = v != null ? v
                 : f.type === "select"   ? (f.options?.[0]?.id ?? "")
                 : f.type === "multipill" ? []
                 : f.type === "tagselect" ? []
                 : "";
    }
    return seed;
  };
  const [draft, setDraft] = React.useState(buildSeed);
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  // Synchronous double-submit guard — React state updates are async so a
  // burst of clicks (e2e fires .click() 3× in a row) can slip past the
  // `busy` flag before the re-render disables the button. The ref check
  // is synchronous and wins that race; the React state still drives the
  // visual disabled/label.
  const busyRef = React.useRef(false);
  React.useEffect(() => { if (open) { setDraft(buildSeed()); setBusy(false); setErr(null); busyRef.current = false; } }, [open, initialValues]);  // eslint-disable-line
  const set = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  // Await onSave; only close on success so failures stay visible inline
  // instead of vanishing with the dialog.
  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await onSave?.(stripHidden(draft, fields));
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const useGrid = (fields || []).length >= 4;
  return (
    <Modal open={open} onClose={onClose}
           title={title} subtitle={subtitle}
           primaryAction={submit}
           primaryLabel={busy ? "Đang lưu…" : "Lưu thay đổi"}
           primaryIcon="check"
           primaryDisabled={busy}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : null}
           width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          display: useGrid ? "grid" : "flex",
          gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
          flexDirection: useGrid ? undefined : "column",
          gap: 12,
        }}>
          {(fields || []).filter(f => fieldVisible(f, draft)).map((f) => {
            const span = f.fullWidth || f.type === "multipill" || f.type === "tagselect" ? 2 : 1;
            const node = f.type === "select"
              ? <Select label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)}
                        placeholder={f.placeholder || "Chọn…"}
                        disabled={f.disabled}
                        options={(f.options || []).map(o => ({ value: o.id, label: o.label }))}/>
              : f.type === "multipill"
              ? <MultiPillFieldInline label={f.label} values={draft[f.id]}
                                       options={f.options}
                                       onChange={(v) => set(f.id, v)}
                                       color={f.color || "cyan"}/>
              : f.type === "tagselect"
              ? <TagSelect label={f.label} value={draft[f.id]}
                           options={f.options}
                           onChange={(v) => set(f.id, v)}
                           placeholder={f.placeholder || "Thêm…"}
                           color={f.color || "cyan"}/>
              : <Input  label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)} placeholder={f.placeholder}
                        disabled={f.disabled}
                        type={f.type === "password" ? "password" : "text"}
                        digits={["phone","cccd","money","int","date"].includes(f.type)}
                        maxDigits={f.type === "phone" ? 10 : f.type === "cccd" ? 12 : f.type === "date" ? 8 : f.type === "money" ? 12 : undefined}
                        format={f.type === "phone" ? window.fmtPhone
                              : f.type === "cccd"  ? window.fmtCCCD
                              : f.type === "money" ? window.fmtMoneyInput
                              : f.type === "date"  ? window.fmtDateInput
                              : undefined}
                        storeFormatted={f.type === "date"}
                        mono={f.type === "money" || f.type === "int"}/>;
            return (
              <div key={f.id} style={{ gridColumn: useGrid && span === 2 ? "span 2" : "auto" }}>
                {node}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// PasswordResetModal — admin-only prompt for resetting an account's
// password. Single password field; sends POST /accounts/:id/reset-password.
// Uses the same busy/err close-after-async pattern as RecordCreatorModal /
// EditRecordModal so a backend rejection (weak password, lockout) stays
// visible inline rather than vanishing with the dialog.
// --------------------------------------------------------------------
function PasswordResetModal({ open, onClose, account, onSubmit }) {
  const [pw, setPw]     = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  const busyRef = React.useRef(false);
  const role = account?.role || "staff";
  const checks = pwChecksForRole(role);
  React.useEffect(() => { if (open) { setPw(""); setBusy(false); setErr(null); busyRef.current = false; } }, [open]);
  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await onSubmit?.(pw);
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
           title="Đặt lại mật khẩu"
           subtitle={account ? `Cho ${account.name} · ${account.email}` : ""}
           primaryAction={submit}
           primaryLabel={busy ? "Đang đặt lại…" : "Đặt lại"}
           primaryIcon="check" width={420}
           primaryDisabled={busy || !pwOk(pw, role)}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Input label="Mật khẩu mới" value={pw} onChange={setPw}
               type="password" placeholder="Mật khẩu mới"/>
        <PasswordChecks value={pw} checks={checks}/>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Người dùng sẽ phải đăng nhập lại bằng mật khẩu này.
        </span>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// ConfirmDialog — generic "Xác nhận?" prompt for destructive admin
// actions. Single message string + a primary confirm button; cancel
// closes the modal. busy state guards double-submits.
// --------------------------------------------------------------------
function ConfirmDialog({ open, onClose, title, message, primaryLabel, onConfirm }) {
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) setBusy(false); }, [open]);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm?.(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} width={440}
           title={title}
           primaryAction={submit}
           primaryLabel={busy ? "Đang xử lý…" : (primaryLabel || "Xác nhận")}
           primaryIcon="check"
           primaryDisabled={busy}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>
        {message}
      </span>
    </Modal>
  );
}

// --------------------------------------------------------------------
// CtvCompetitionLauncher — compact header pill (rendered inside the
// AccountsTab header row, left of "Tạo tài khoản") that opens the
// "Bảng vàng CTV" award dialog (top-3 collaborators of the month).
// Admin/staff only — gated by AccountsTab (collaborators never reach it).
// Matches the size="sm" Button vocabulary (height/padding/radius/font)
// but tinted AMBER (the champion colour) and styled secondary/glass so
// it pairs with — yet stays distinct from — the primary create button.
// The Dialog itself is a Modal that portals on its own.
// --------------------------------------------------------------------
function CtvCompetitionLauncher() {
  const [compOpen, setCompOpen]       = React.useState(false);
  const [compData, setCompData]       = React.useState(null);
  const [compLoading, setCompLoading] = React.useState(false);
  const [hover, setHover]             = React.useState(false);

  const openComp = async () => {
    setCompOpen(true);
    setCompLoading(true);
    setCompData(null);
    try {
      const out = await window.MGT_DATA.api.fetchCtvCompetition();
      setCompData(out);
    } catch (e) {
      reportWriteError(e, "Lỗi tải bảng vàng CTV");
      setCompOpen(false);
    } finally {
      setCompLoading(false);
    }
  };

  // Force a server recompute (bypasses the 5-min cache via `fresh`).
  // Toggles compLoading so the dialog replays its entrance animation,
  // then swaps in the fresh data. Same try/catch/report pattern as open.
  const refreshComp = async () => {
    setCompLoading(true);
    try {
      const out = await window.MGT_DATA.api.fetchCtvCompetition(undefined, undefined, { fresh: true });
      setCompData(out);
    } catch (e) {
      reportWriteError(e, "Lỗi tải bảng vàng CTV");
    } finally {
      setCompLoading(false);
    }
  };

  return (
    <>
      <button onClick={openComp}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-label="Bảng vàng CTV"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 10, cursor: "pointer",
          fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 12,
          lineHeight: 1, letterSpacing: "0.005em", whiteSpace: "nowrap",
          background: "var(--glass-2)", color: "var(--fg-1)",
          border: "1px solid color-mix(in oklab, var(--neon-amber) 42%, transparent)",
          backdropFilter: "var(--glass-blur-soft)", WebkitBackdropFilter: "var(--glass-blur-soft)",
          boxShadow: hover
            ? "0 0 0 1px color-mix(in oklab, var(--neon-amber) 30%, transparent), 0 0 16px var(--neon-amber-glow)"
            : "0 0 8px var(--neon-amber-haze)",
          transition: "all 140ms var(--ease-out)",
        }}>
        <Icon name="graduation" size={13} color="var(--neon-amber)"/>
        <span>Bảng vàng CTV</span>
      </button>
      <CtvCompetitionDialog
        open={compOpen}
        onClose={() => setCompOpen(false)}
        data={compData}
        loading={compLoading}
        onRefresh={refreshComp}
        onDownload={() => window.MGT_DATA.api.downloadCtvCompetitionXlsx()}/>
    </>
  );
}

// --------------------------------------------------------------------
// Helper — unified error toast for write failures. Surfaces a friendly
// Vietnamese message; falls back to the raw error.message for unknown
// codes. Called by every MoreMenu action.
//
// Routes through window.MGT_TOAST (vanilla bottom-right) for consistency
// with the rest of the app's soft-failure UX. Falls back to alert() only
// if MGT_TOAST is unavailable (e.g. in unit-test harnesses that strip the
// data-loader.js bootstrap).
// --------------------------------------------------------------------
function reportWriteError(e, fallback = "Lỗi") {
  const msg = String(e?.message || e || "");
  let friendly = fallback;
  if (/cannot_delete_self/i.test(msg)) friendly = "Không thể tự xoá chính tài khoản của bạn.";
  else if (/cannot_delete_last_admin/i.test(msg)) friendly = "Không thể xoá: đây là quản trị viên duy nhất còn lại.";
  else if (/branch_in_use/.test(msg)) friendly = "Không thể xóa: chi nhánh đang có lớp, học viên hoặc nhân viên.";
  else if (/in_use|in use|FK|FOREIGN/i.test(msg)) friendly = "Không thể xóa: bản ghi đang được tham chiếu.";
  else if (/password_(too_short|too|weak|needs_)/.test(msg)) friendly = "Mật khẩu không hợp lệ.";
  else if (/forbidden|admin_only|requireAdmin/i.test(msg)) friendly = "Chỉ admin mới thực hiện được thao tác này.";
  else friendly = fallback + ". Thử lại, hoặc liên hệ quản trị viên.";
  if (window.MGT_TOAST) window.MGT_TOAST(friendly);
  else alert(friendly);
}

Object.assign(window, {
  OrganizationScreen, BranchesTab, AccountsTab, FeesTab, PromosTab,
  TeachersTab, ActivityTab, RecordCreatorModal,
  MoreMenu, EditRecordModal, PasswordResetModal, ConfirmDialog,
  CtvCompetitionLauncher,
});

// --------------------------------------------------------------------
// RecordCreatorModal — shared modal used by every "+ Tạo / Thêm" button
// on the Tổ chức page. Renders a list of fields (text or select) and
// emits the resulting object via onCreate (visual-only — we don't mutate
// MGT_DATA in this prototype).
// --------------------------------------------------------------------
function RecordCreatorModal({ open, onClose, title, subtitle, fields, onCreate }) {
  // Build a draft seeded with the option `id` for any select, "" for text,
  // and [] for multipill (multi-select pills).
  const buildSeed = () => {
    const seed = {};
    for (const f of fields || []) {
      seed[f.id] = f.type === "select"   ? (f.options?.[0]?.id ?? "")
                : f.type === "multipill" ? []
                : f.type === "tagselect" ? []
                : "";
    }
    return seed;
  };
  const [draft, setDraft] = React.useState(buildSeed);
  const [busy, setBusy]   = React.useState(false);
  const [err, setErr]     = React.useState(null);
  // Synchronous double-submit guard — see EditRecordModal for rationale.
  const busyRef = React.useRef(false);
  React.useEffect(() => { if (open) { setDraft(buildSeed()); setBusy(false); setErr(null); busyRef.current = false; } }, [open]);  // eslint-disable-line

  const set = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  // Await the onCreate promise; only close on success so failure alerts
  // surface inline rather than after the dialog has already vanished.
  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await onCreate?.(stripHidden(draft, fields));
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Pair text fields into a 2-col grid when there are 4+ fields, so the
  // dialog visually matches the sectioned grids in AddStudent/AddClass.
  const useGrid = (fields || []).length >= 4;

  return (
    <Modal open={open} onClose={onClose}
           title={title}
           subtitle={subtitle}
           primaryAction={submit}
           primaryLabel={busy ? "Đang tạo…" : "Tạo mới"}
           primaryIcon="plus"
           primaryDisabled={busy}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : null}
           width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          display: useGrid ? "grid" : "flex",
          gridTemplateColumns: useGrid ? "1fr 1fr" : undefined,
          flexDirection: useGrid ? undefined : "column",
          gap: 12,
        }}>
          {(fields || []).filter(f => fieldVisible(f, draft)).map((f) => {
            // multipill / tagselect rows always span the full width — pills wrap naturally.
            const span = f.fullWidth || f.type === "multipill" || f.type === "tagselect" ? 2 : 1;
            const node = f.type === "select"
              ? <Select label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)}
                        placeholder={f.placeholder || "Chọn…"}
                        disabled={f.disabled}
                        options={(f.options || []).map(o => ({ value: o.id, label: o.label }))}/>
              : f.type === "multipill"
              ? <MultiPillFieldInline label={f.label} values={draft[f.id]}
                                       options={f.options}
                                       onChange={(v) => set(f.id, v)}
                                       color={f.color || "cyan"}/>
              : f.type === "tagselect"
              ? <TagSelect label={f.label} value={draft[f.id]}
                           options={f.options}
                           onChange={(v) => set(f.id, v)}
                           placeholder={f.placeholder || "Thêm…"}
                           color={f.color || "cyan"}/>
              : <Input  label={f.label} value={draft[f.id]}
                        onChange={(v) => set(f.id, v)} placeholder={f.placeholder}
                        disabled={f.disabled}
                        type={f.type === "password" ? "password" : "text"}
                        digits={["phone","cccd","money","int","date"].includes(f.type)}
                        maxDigits={f.type === "phone" ? 10 : f.type === "cccd" ? 12 : f.type === "date" ? 8 : f.type === "money" ? 12 : undefined}
                        format={f.type === "phone" ? window.fmtPhone
                              : f.type === "cccd"  ? window.fmtCCCD
                              : f.type === "money" ? window.fmtMoneyInput
                              : f.type === "date"  ? window.fmtDateInput
                              : undefined}
                        storeFormatted={f.type === "date"}
                        mono={f.type === "money" || f.type === "int"}/>;
            return (
              <div key={f.id} style={{ gridColumn: useGrid && span === 2 ? "span 2" : "auto" }}>
                {node}
                {f.type === "password" && <PasswordChecks value={draft[f.id]} checks={f.id === "password" ? pwChecksForRole(draft.role) : f.checks}/>}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// MultiPillFieldInline — local helper for RecordCreatorModal's multipill
// type. Renders a label + a row of selectable pills. `values` is an array
// of selected ids; each pill toggles its membership on click.
function MultiPillFieldInline({ label, values = [], options, onChange, color = "cyan" }) {
  const c = `var(--neon-${color})`;
  const isOn = (id) => values.includes(id);
  const toggle = (id) => onChange(isOn(id) ? values.filter(v => v !== id) : [...values, id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(options || []).map(o => {
          const active = isOn(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)} style={{
              // Matches the `ChipButton` pill primitive used in
              // FloatingFilterPanel for visual consistency.
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 11px", borderRadius: 999,
              background: active ? `color-mix(in oklab, ${c} 14%, transparent)` : "var(--ink-2)",
              border: `1px solid ${active ? c : "var(--glass-stroke)"}`,
              boxShadow: active ? `0 0 12px color-mix(in oklab, ${c} 40%, transparent)` : "none",
              color: active ? "var(--fg-1)" : "var(--fg-2)",
              fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
              transition: "all 140ms var(--ease-out)",
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}
