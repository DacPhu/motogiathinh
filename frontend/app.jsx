// ====================================================================
// App — routing between screens + modals + detail views
// ====================================================================

// ScreenErrorBoundary — isolates a single screen's render failure so a
// crash in one tab doesn't take down the whole shell (sidebar, topbar,
// other screens). Renders a minimal Vietnamese error card with a
// "thử lại" button that re-mounts the child tree.
class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, attempt: 0, key: props.resetKey }; }
  static getDerivedStateFromError(error) { return { error }; }
  static getDerivedStateFromProps(props, state) {
    // When the parent's resetKey changes (tab/detail change), clear any
    // previous error BEFORE the next render — so the new screen gets a
    // fresh shot. If it crashes too, getDerivedStateFromError catches it.
    if (props.resetKey !== state.key) {
      return { error: null, key: props.resetKey };
    }
    return null;
  }
  componentDidCatch(error, info) { try { console.error("[ScreenErrorBoundary]", error, info); } catch {} }
  retry = () => this.setState(s => ({ error: null, attempt: s.attempt + 1 }));
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, display: "flex", flexDirection: "column", gap: 12,
          alignItems: "flex-start",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--neon-pink)" }}>Lỗi hiển thị</span>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)", maxWidth: 640 }}>
            Có lỗi xảy ra khi hiển thị màn hình này. Bấm "Thử lại" hoặc quay lại sau.
          </span>
          <button onClick={this.retry} style={{
            marginTop: 4, padding: "8px 14px", borderRadius: 10, cursor: "pointer",
            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
            color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
          }}>Thử lại</button>
        </div>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

function App() {
  // ThemeProvider wraps the whole app so theme toggles instantly
  // propagate to any component reading `useTheme()` / `useBranchTones()`.
  // Collaborators (CTV) and guests (kiosk operators) get the standalone
  // vertical portal (GuestApp) instead of the admin shell entirely.
  const _role = window.MGT_DATA.currentUser.role;
  const isCtv = _role === "collaborator" || _role === "guest";
  return (
    <ThemeProvider>
      {isCtv ? <GuestApp/> : <AppRoot/>}
    </ThemeProvider>
  );
}

function AppRoot() {
  const D = window.MGT_DATA;
  const isAdmin = D.can("dashboard", "r");  // admin-only pseudo-resource
  const isCtv = D.currentUser.role === "collaborator" || D.currentUser.role === "guest";  // restricted web app

  // Re-render whenever data-loader fires 'mgt:datachanged' (after any
  // successful create/update/delete). The frozen screens read D.<arrays>
  // directly with no React state binding, so without this they'd only
  // refresh on tab-bounce.
  const [, _bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => _bump();
    window.addEventListener("mgt:datachanged", fn);
    return () => window.removeEventListener("mgt:datachanged", fn);
  }, []);

  // Print mode (?print=dashboard) — sidebar hidden, all sections rendered
  // expanded, used by the headless-chromium PDF route. Detected once at
  // mount from window.location.search.
  const printMode = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("print") === "dashboard";

  // route: { tab: "students"|"payments"|..., detail: null | { type, id } }
  // Staff don't have the dashboard tab (admin-only); they land on Học viên.
  const [tab, setTab]       = React.useState(isAdmin ? "dashboard" : "students");
  const [detail, setDetail] = React.useState(null);
  const [navCollapsed, setNavCollapsed] = React.useState(!!printMode);

  // modals
  const [addStudent, setAddStudent] = React.useState(false);
  const [addPayment, setAddPayment] = React.useState({ open: false, studentId: null, amount: null });
  const [addClass, setAddClass]     = React.useState(false);
  const [reportPick, setReportPick] = React.useState(false);

  const unread = D.notifications.filter(n => !n.read).length;

  // Navigation helpers
  // CTV is locked to the "students" surface — ignore any nav to other tabs.
  const goTab = (id) => { if (isCtv && id !== "students") return; setTab(id); setDetail(null); };
  const openStudent = (id, opts) => setDetail({ type: "student", id, ...(opts || {}) });
  const openPayment = (id) => setDetail({ type: "payment", id });
  const openClass   = (id) => { setTab("classes"); setDetail({ type: "class", id }); };

  // ---- Edge-swipe back gesture (mobile) ----
  const mainRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const swipeRef = React.useRef({ startX: 0, startY: 0, active: false, swiping: false });
  const swipeOffsetRef = React.useRef(0);
  const rafRef = React.useRef(0);

  React.useEffect(() => {
    swipeOffsetRef.current = 0;
    const el = mainRef.current;
    if (el) { el.style.transition = "none"; el.style.transform = ""; }
    if (overlayRef.current) overlayRef.current.style.opacity = "0";
  }, [detail]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const _swipeRaf = React.useCallback(() => {
    const el = mainRef.current;
    if (!el || !swipeRef.current.swiping) { rafRef.current = 0; return; }
    el.style.transform = "translate3d(" + swipeOffsetRef.current + "px, 0, 0)";
    if (overlayRef.current) overlayRef.current.style.opacity = String(Math.min(swipeOffsetRef.current / 250, 0.35));
    rafRef.current = requestAnimationFrame(_swipeRaf);
  }, []);

  const onMainTouchStart = React.useCallback((e) => {
    if (!detail) return;
    const t = e.touches[0];
    if (t.clientX < 15) {
      swipeRef.current = { startX: t.clientX, startY: t.clientY, active: true, swiping: false };
      const el = mainRef.current;
      if (el) el.style.transition = "none";
    }
  }, [detail]);

  const onMainTouchMove = React.useCallback((e) => {
    if (!swipeRef.current.active) return;
    const t = e.touches[0];
    const sw = swipeRef.current;
    const dx = t.clientX - sw.startX;
    const dy = t.clientY - sw.startY;
    if (!sw.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.7) {
      sw.swiping = true;
    }
    if (sw.swiping) {
      if (dx > 0) {
        const w = window.innerWidth;
        swipeOffsetRef.current = dx < w ? dx * (1 - dx / (w * 2.5)) : dx * 0.6;
      } else { swipeOffsetRef.current = dx * 0.3; }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(_swipeRaf);
    }
  }, [_swipeRaf]);

  const onMainTouchEnd = React.useCallback(() => {
    const sw = swipeRef.current;
    if (sw.active && sw.swiping) {
      const el = mainRef.current;
      const threshold = window.innerWidth * 0.33;
      if (swipeOffsetRef.current >= threshold) {
        if (el) { el.style.transition = "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)"; el.style.transform = "translate3d(100vw, 0, 0)"; }
        if (overlayRef.current) { overlayRef.current.style.transition = "opacity 250ms"; overlayRef.current.style.opacity = "0"; }
        sw.active = false; sw.swiping = false;
        setTimeout(() => {
          swipeOffsetRef.current = 0;
          setDetail(detail?.from || null);
        }, 280);
      } else {
        if (el) { el.style.transition = "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)"; el.style.transform = ""; }
        if (overlayRef.current) { overlayRef.current.style.transition = "opacity 300ms"; overlayRef.current.style.opacity = "0"; }
        swipeOffsetRef.current = 0;
        sw.active = false; sw.swiping = false;
      }
      return;
    }
    sw.active = false; sw.swiping = false;
  }, [detail]);

  const TITLES = {
    dashboard:    { title: "Tổng quan"            },
    students:     { title: "Danh sách học viên"   },
    payments:     { title: "Thanh toán"           },
    classes:      { title: "Lớp học"               },
    notifications:{ title: "Thông báo"             },
    organization: { title: "Tổ chức"               },
  };
  const meta = TITLES[tab];

  // Detail-view titles
  let detailTitle = null;
  if (detail?.type === "student") detailTitle = { title: D.getStudent(detail.id)?.name || "" };
  if (detail?.type === "payment") detailTitle = { title: detail.id };
  if (detail?.type === "class")   detailTitle = { title: D.getClass(detail.id)?.code || "" };

  return (
    <div className="mgt-canvas" style={{
      minHeight: "100vh", padding: 20,
      paddingLeft: navCollapsed ? 30 : 14,
      display: "flex", gap: navCollapsed ? 0 : 14, alignItems: "flex-start",
      transition: "padding-left 320ms var(--ease-out), gap 320ms var(--ease-out)",
    }}>
      {!printMode && <SidebarEdgeToggle collapsed={navCollapsed} onToggle={() => setNavCollapsed(v => !v)}/>}
      {!printMode && <Sidebar active={tab} onNav={goTab}
               onQuickAdd={() => setAddStudent(true)}
               unreadCount={unread}
               collapsed={navCollapsed}/>}

      {/* Dimming overlay during edge swipe */}
      <div ref={overlayRef} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        zIndex: 999, opacity: 0, pointerEvents: "none",
      }}/>
      <main ref={mainRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
             position: "relative", overflow: "hidden", zIndex: 1 }}
            onTouchStart={onMainTouchStart}
            onTouchMove={onMainTouchMove}
            onTouchEnd={onMainTouchEnd}>
        {/* Detail back link sits ABOVE the title row */}
        {detail && (
          <button onClick={() => detail.from ? setDetail(detail.from) : setDetail(null)} style={{
            background: "transparent", border: "none", color: "var(--fg-3)",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, padding: 0, alignSelf: "flex-start",
            marginBottom: 8,
          }}>
            <Icon name="arrow-up" size={14} style={{ transform: "rotate(-90deg)" }}/>
            {detail.from?.type === "class"     ? `Quay lại lớp ${D.getClass(detail.from.id)?.code || ""}` :
             detail.from?.type === "student"   ? `Quay lại học viên ${D.getStudent(detail.from.id)?.name || ""}` :
             detail.from?.type === "payment"   ? "Quay lại thanh toán" :
             /* Fall back to the current tab — label the list the user came from. */
             `Quay lại bảng ${meta.title.replace(/^Danh sách /, "")}`}
          </button>
        )}

        <TopBar
          title={detail ? detailTitle.title : meta.title}
          right={
            !detail && tab === "dashboard"
              ? <Button variant="ghost" size="sm" icon="download" onClick={() => setReportPick(true)}>Báo cáo</Button>
              : !detail && tab === "students"
              ? <Button variant="primary" icon="plus" onClick={() => setAddStudent(true)}>Thêm học viên</Button>
              : !detail && tab === "payments"
              ? <Button variant="primary" icon="plus" onClick={() => setAddPayment({ open: true, studentId: null, amount: null })}>Ghi nhận thanh toán</Button>
              : !detail && tab === "classes" && D.can("classes", "create")
              ? <Button variant="primary" icon="plus" onClick={() => setAddClass(true)}>Tạo lớp</Button>
              : null
          }
        />

        <div style={{ position: "relative", flex: 1 }}>
          {/* Each screen lives inside an error boundary so a single
              broken render doesn't unmount the entire shell. resetKey
              changes on tab/detail change so the boundary clears. */}
          <ScreenErrorBoundary resetKey={`${tab}:${detail?.type || ""}:${detail?.id || ""}`}>
            {/* Detail views (when set) */}
            {detail?.type === "student" && (
              <StudentDetail studentId={detail.id}
                             initialTab={detail.tab}
                             initialPaymentId={detail.paymentId}
                             onBack={() => setDetail(null)}
                             onAddPayment={(studentId, amount) => setAddPayment({ open: true, studentId, amount })}
                             onOpenPayment={openPayment}/>
            )}
            {detail?.type === "payment" && (
              <PaymentDetail paymentId={detail.id} onBack={() => setDetail(null)}
                             onOpenStudent={openStudent}/>
            )}
            {detail?.type === "class" && (
              <ClassDetail classId={detail.id} onBack={() => setDetail(null)}
                           onOpenStudent={openStudent} isAdmin={D.can("classes", "update")}/>
            )}

            {/* List/screen views */}
            {!detail && tab === "dashboard" && isAdmin && <DashboardScreen onOpenStudent={openStudent}/>}
            {!detail && tab === "students"      && <StudentsScreen onOpenStudent={openStudent}
                                                                   onAddStudent={() => setAddStudent(true)}/>}
            {!detail && tab === "payments"      && <PaymentsScreen onOpenStudent={openStudent}
                                                                   onAddPayment={() => setAddPayment({ open: true, studentId: null })}/>}
            {!detail && tab === "classes"       && <ClassesScreen onOpenClass={openClass}
                                                                  onAddClass={() => setAddClass(true)}
                                                                  isAdmin={D.can("classes", "create")}/>}
            {!detail && tab === "notifications" && <NotificationsScreen onOpenStudent={openStudent}/>}
            {!detail && tab === "organization"  && <OrganizationScreen onOpenClass={openClass} onOpenStudent={openStudent}/>}
          </ScreenErrorBoundary>
        </div>
      </main>

      {/* AddStudentModal owns its own create+upload lifecycle (it must gate
          close on full upload success — see modals.jsx submit()). No onSave. */}
      <AddStudentModal open={addStudent} onClose={() => setAddStudent(false)}/>
      <AddPaymentModal open={addPayment.open} defaultStudentId={addPayment.studentId}
                       defaultAmount={addPayment.amount}
                       onClose={() => setAddPayment({ open: false, studentId: null, amount: null })}
                       onSave={async (payload) => {
                         // Let errors propagate so AddPaymentModal can render
                         // them inline (busy/err pattern). The previous
                         // try/catch+alert+swallowed-upload-warn made create
                         // and upload failures invisible to the user.
                         const { bienLaiFile, ...rest } = payload;
                         const created = await D.api.createPayment(rest);
                         if (bienLaiFile) {
                           try { await D.api.uploadBienLai(created.id, bienLaiFile); }
                           catch (e) { throw new Error('Đã lưu thanh toán nhưng tải ảnh biên lai thất bại. Kiểm tra mạng rồi tải lại ảnh trong hồ sơ học viên.'); }
                         }
                       }}/>
      <AddClassModal   open={addClass} onClose={() => setAddClass(false)}
                       onSave={(payload) => D.api.createClass(payload)}/>
      <ReportChoiceModal open={reportPick} onClose={() => setReportPick(false)}/>
    </div>
  );
}

// --------------------------------------------------------------------
// ReportChoiceModal — three-way picker triggered by the "Báo cáo"
// button on the Tổng quan screen. Two distinct outputs:
//   • Trực quan  — the artistic dashboard PDF (charts + KPIs)
//   • Số liệu    — a formal table-only PDF, last 7 days, signed footer
//   • Excel      — same 7-day window, multi-sheet workbook
// --------------------------------------------------------------------
function ReportChoiceModal({ open, onClose }) {
  const D = window.MGT_DATA;
  const choose = async (fn) => { onClose && onClose(); await fn(); };
  const Option = ({ icon, title, hint, onClick }) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
      background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
      borderRadius: 14, cursor: "pointer", textAlign: "left", color: "var(--fg-1)",
      fontFamily: "var(--font-ui)", transition: "background 160ms var(--ease-out), border-color 160ms var(--ease-out)",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-3)"; e.currentTarget.style.borderColor = "var(--glass-stroke-strong)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--glass-2)"; e.currentTarget.style.borderColor = "var(--glass-stroke)"; }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={18}/>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.45 }}>{hint}</span>
      </div>
    </button>
  );
  return (
    <Modal open={open} onClose={onClose} width={520}
           title="Xuất báo cáo"
           subtitle="Chọn định dạng phù hợp với mục đích sử dụng"
           footer={null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Option icon="chart" title="Trực quan (PDF)"
                hint="Bảng tổng quan có biểu đồ và KPI — phù hợp để xem nhanh."
                onClick={() => choose(() => D.api.downloadDashboardPdf())}/>
        <Option icon="card" title="Số liệu (PDF)"
                hint="Bảng số liệu chính thức 7 ngày gần nhất — phù hợp để lưu trữ, gửi chủ doanh nghiệp."
                onClick={() => choose(() => D.api.downloadFormalReportPdf())}/>
        <Option icon="download" title="Số liệu (Excel)"
                hint="Workbook 6 sheet (Tổng quan · Học viên · Thanh toán · Lớp học · CTV ×2) — toàn bộ dữ liệu, tiện lọc và in lại."
                onClick={() => choose(() => D.api.downloadFormalReportXlsx())}/>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// Boot — wait for window.MGT_DATA_READY (the data-loader.js fetch
// promise) to resolve, then render <App/>. While loading, show a
// minimal eyebrow-style "Đang tải dữ liệu…". On error, show the
// message so devs can debug a missing/malformed CSV.
// --------------------------------------------------------------------
function Boot() {
  const [ready, setReady] = React.useState(!!window.MGT_DATA);
  const [error, setError] = React.useState(null);
  const [offline, setOffline] = React.useState(!!window._MGT_OFFLINE);
  const [autoRetried, setAutoRetried] = React.useState(false);
  React.useEffect(() => {
    if (ready) return;
    if (!window.MGT_DATA_READY) { setError(new Error("MGT_DATA_READY not found — data-loader.js failed to register")); return; }
    window.MGT_DATA_READY.then(() => setReady(true)).catch((e) => {
      setError(e);
      // Auto-retry once after 3 seconds for transient network issues.
      if (!autoRetried) {
        setAutoRetried(true);
        setTimeout(() => { window.location.reload(); }, 3000);
      }
    });
  }, []);   // eslint-disable-line
  React.useEffect(() => {
    const fn = () => setOffline(!!window._MGT_OFFLINE);
    window.addEventListener('mgt:connectivity', fn);
    return () => window.removeEventListener('mgt:connectivity', fn);
  }, []);
  if (error) {
    return (
      <div className="mgt-canvas" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, padding: 60,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--neon-pink)" }}>Không thể tải dữ liệu</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-2)" }}>Ứng dụng không kết nối được đến máy chủ. Kiểm tra kết nối internet rồi mở lại trang.</span>
        {!autoRetried ? (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>Đang thử lại tự động…</span>
        ) : (
          <button onClick={() => window.location.reload()} style={{
            marginTop: 8, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--glass-stroke)",
            background: "var(--glass-2)", color: "var(--fg-1)", fontFamily: "var(--font-ui)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Thử lại</button>
        )}
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="mgt-canvas" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 60,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Đang tải dữ liệu…</span>
      </div>
    );
  }
  return (
    <>
      {offline && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200000,
          background: "color-mix(in oklab, var(--neon-violet, #a78bfa) 80%, #000)",
          padding: "7px 16px", textAlign: "center",
          fontFamily: "var(--font-ui, system-ui)", fontSize: 12, fontWeight: 600, color: "#fff",
          letterSpacing: "0.01em",
        }}>
          Không có mạng — đang xem dữ liệu đã lưu. Kết nối internet để cập nhật.
        </div>
      )}
      <App />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Boot />);
