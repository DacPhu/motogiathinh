// ====================================================================
// App shell — Sidebar + TopBar + Modal (Vietnamese)
// ====================================================================

const NAV_ITEMS = [
  { id: "dashboard",    label: "Tổng quan",    icon: "home" },
  { id: "students",     label: "Học viên",      icon: "graduation" },
  { id: "payments",     label: "Thanh toán",    icon: "wallet" },
  { id: "classes",      label: "Lớp học",       icon: "users" },
  { id: "notifications",label: "Thông báo",     icon: "bell" },
  { id: "organization", label: "Tổ chức",        icon: "settings" },
];

function Sidebar({ active, onNav, onQuickAdd, unreadCount, collapsed }) {
  const D = window.MGT_DATA;
  const user = D.currentUser;
  const branch = D.getBranch(user.branchId);
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const [downloadOpen, setDownloadOpen] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(null);
  return (
    // Wrapper reserves layout space; the aside inside transforms independently
    // so it looks like a card being pulled out of (or pushed back into) a deck
    // sitting just off-screen to the left.
    <div style={{
      width: collapsed ? 0 : 216, flexShrink: 0,
      position: "sticky", top: 20, alignSelf: "flex-start",
      height: "calc(100vh - 40px)",
      transition: "width 460ms cubic-bezier(0.22, 1, 0.36, 1)",
      overflow: "visible",
      pointerEvents: collapsed ? "none" : "auto",
    }}>
      <aside style={{
        width: 216, height: "100%",
        display: "flex", flexDirection: "column", gap: 14,
        background: "var(--glass-2)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-stroke)",
        // Only the right-side corners are rounded — the left edge is flush
        // against the screen frame so the card reads as half-off-screen.
        borderRadius: "0 20px 20px 0",
        borderLeft: "none",
        padding: 16, boxShadow: "var(--shadow-2)",
        // Deck-pull animation: transform-only so the browser can promote
        // the layer and animate at full framerate. `will-change` hints to
        // the compositor; a custom ease-out curve smooths the deceleration.
        transform: collapsed ? "translate3d(-100%, 0, 0) scale(1.04)" : "translate3d(0, 0, 0) scale(1)",
        transformOrigin: "right center",
        opacity: collapsed ? 0 : 1,
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        transition: "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 12px", borderBottom: "1px solid var(--glass-stroke)" }}>
        <img src="assets/logo.png" alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" }}/>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>CENTERSAI.com</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.filter(it => {
          // Collaborators (CTV) get a restricted web app: only "Học viên"
          // (view their students + add profiles). Staff/admin unchanged.
          if (window.MGT_DATA.currentUser.role === "collaborator") return it.id === "students";
          return it.id !== "dashboard" || window.MGT_DATA.can("dashboard", "r");
        }).map(it => {
          const isActive = active === it.id;
          const showBadge = it.id === "notifications" && unreadCount > 0;
          return (
            <button key={it.id} onClick={() => onNav(it.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 10px", borderRadius: 10,
                      fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
                      background: isActive ? "var(--ink-3)" : "transparent",
                      border: isActive ? "1px solid var(--neon-cyan)" : "1px solid transparent",
                      boxShadow: isActive ? "0 0 18px var(--neon-cyan-haze)" : "none",
                      color: isActive ? "var(--fg-1)" : "var(--fg-2)",
                      cursor: "pointer", textAlign: "left",
                      transition: "all 140ms var(--ease-out)",
                    }}>
              <Icon name={it.icon} size={16}
                    color={isActive ? "var(--neon-cyan)" : "currentColor"}
                    style={{ filter: isActive ? "drop-shadow(0 0 6px var(--neon-cyan-glow))" : "none" }}/>
              <span style={{ flex: 1 }}>{it.label}</span>
              {showBadge && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 999, background: "var(--neon-pink)",
                  color: "var(--ink-0)", boxShadow: "0 0 10px var(--neon-pink-glow)",
                }}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }}></div>

      {/* Download pill — sits above the vehicle-mode toggle, right-aligned */}
      <div style={{ display: "flex", padding: "0 4px", gap: 8 }}>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setDownloadOpen(true)} title="Tải ứng dụng"
          style={{
            flex: 1, height: 32, padding: 3, border: "none",
            cursor: "pointer", borderRadius: 999, background: "var(--glass-2)",
            border: "1px solid var(--glass-stroke-strong)",
            backdropFilter: "var(--glass-blur-soft)", WebkitBackdropFilter: "var(--glass-blur-soft)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "background 220ms var(--ease-out)", overflow: "hidden",
          }}>
          <Icon name="smartphone" size={14} color="var(--fg-3)"/>
        </button>
      </div>

      {/* Theme toggle + vehicle-mode toggle — fill the nav-card width */}
      <div style={{ display: "flex", padding: "0 4px", gap: 8 }}>
        <ThemeToggle/>
        <VehicleModeToggle/>
      </div>

      {/* User pill — click opens logout confirm dialog */}
      <button onClick={() => setLogoutOpen(true)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: 10,
        borderRadius: 14, background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "all 140ms var(--ease-out)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--neon-cyan)"; e.currentTarget.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--glass-stroke)"; e.currentTarget.style.boxShadow = "none"; }}>
        <Avatar name={user.name} size={32} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-3)" }}>{user.role === "admin" ? "Admin" : user.role === "collaborator" ? "Cộng tác viên" : "Nhân viên"}{branch ? " · " + branch.name : ""}</span>
        </div>
      </button>
      </aside>

      <Modal open={downloadOpen} onClose={() => { setDownloadOpen(false); setCopiedLink(null); }}
             title="Tải ứng dụng" width={380} footer={null}>
        <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
          {[
            { key: "ios",     label: "iOS",     color: "var(--neon-cyan)", url: "https://motogiathinh.centersai.com/downloads/MotoGiaThinhCTV-unsigned.ipa" },
            { key: "android", label: "Android", color: "var(--neon-lime)", url: "https://motogiathinh.centersai.com/downloads/app-debug.apk" },
          ].map(({ key, label, color, url }) => {
            const copied = copiedLink === key;
            return (
              <button key={key} onClick={() => {
                navigator.clipboard.writeText(url).then(() => {
                  setCopiedLink(key);
                  setTimeout(() => setCopiedLink(null), 3000);
                });
              }} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "18px 12px", borderRadius: 16, cursor: "pointer",
                background: copied
                  ? "color-mix(in oklab, var(--neon-lime) 12%, transparent)"
                  : `color-mix(in oklab, ${color} 10%, transparent)`,
                border: `1px solid ${copied ? "color-mix(in oklab, var(--neon-lime) 40%, transparent)" : `color-mix(in oklab, ${color} 30%, transparent)`}`,
                transition: "all 200ms var(--ease-out)",
              }}>
                <Icon name={copied ? "check" : "smartphone"} size={20} color={copied ? "var(--neon-lime)" : color}/>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, color: copied ? "var(--neon-lime)" : "var(--fg-1)", textAlign: "center", lineHeight: 1.35 }}>
                  {copied ? "Đã copy link tải điện thoại" : label}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)}
             title="Đăng xuất khỏi tài khoản?"
             primaryAction={() => { setLogoutOpen(false); D.api.logout(); }}
             primaryLabel="Đăng xuất"
             primaryIcon="logout"
             width={460}/>
    </div>
  );
}

// --------------------------------------------------------------------
// SidebarEdgeToggle — thin clickable strip on the screen's left edge
// that hides / reveals the sidebar. When the sidebar is open the
// strip overlaps its right border discreetly; when collapsed it sits
// at the very edge as the only chrome left.
// --------------------------------------------------------------------
function SidebarEdgeToggle({ collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? "Hiện thanh điều hướng" : "Ẩn thanh điều hướng"}
      title={collapsed ? "Hiện thanh điều hướng" : "Ẩn thanh điều hướng"}
      style={{
        position: "fixed",
        left: 0, top: 6, bottom: 6,
        width: 14,
        padding: 0, margin: 0,
        borderRadius: "0 8px 8px 0",
        background: collapsed ? "var(--glass-3)" : "var(--glass-2)",
        border: "1px solid var(--glass-stroke)",
        borderLeft: "none",
        backdropFilter: "var(--glass-blur-soft)",
        WebkitBackdropFilter: "var(--glass-blur-soft)",
        cursor: "pointer",
        zIndex: 60,
        color: "var(--fg-3)",
        boxShadow: collapsed ? "0 0 18px var(--neon-cyan-haze)" : "none",
        transition: "background 200ms var(--ease-out), box-shadow 200ms var(--ease-out)",
      }}/>
  );
}

function TopBar({ title, right }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "0 0 18px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.025em", color: "var(--fg-1)", margin: 0 }}>{title}</h1>
      </div>
      <div style={{ flex: 1 }}></div>

      {right}
    </header>
  );
}

// --------------------------------------------------------------------
// Theme toggle — pill switch with sun + moon glyphs, persisted to LS.
// --------------------------------------------------------------------
// --------------------------------------------------------------------
// Theme — single source of truth via React Context.
//
// `<ThemeProvider>` owns the state; `useTheme()` subscribes any
// component to the current theme. Components depending on JS-derived
// theme values (e.g. branch tones) must call `useTheme()` (or a hook
// built on it like `useBranchTones`) so they re-render on toggle.
//
// `data-theme` is mirrored onto <html> for CSS-var swap, and the
// choice persists to localStorage("mgt-theme").
// --------------------------------------------------------------------
const ThemeContext = React.createContext(null);

function ThemeProvider({ children }) {
  // ?print=dashboard forces light + skips localStorage persistence so the
  // PDF renders consistently regardless of the user's saved preference.
  const isPrintMode = () => {
    try { return new URLSearchParams(window.location.search).get("print") === "dashboard"; }
    catch { return false; }
  };
  const [theme, setTheme] = React.useState(() => {
    if (isPrintMode()) return "light";
    try { return localStorage.getItem("mgt-theme") || "dark"; } catch { return "dark"; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (isPrintMode()) return;       // don't pollute the user's saved theme
    try { localStorage.setItem("mgt-theme", theme); } catch {}
  }, [theme]);
  const value = React.useMemo(() => [theme, setTheme], [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Fallback (no Provider): read once from localStorage, no subscription.
    // Components that toggle from outside the tree should wrap with the
    // Provider for reactive updates.
    const t = (() => { try { return localStorage.getItem("mgt-theme") || "dark"; } catch { return "dark"; } })();
    return [t, () => {}];
  }
  return ctx;
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isLight = theme === "light";
  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      title={isLight ? "Chuyển sang Dark" : "Chuyển sang Light"}
      style={{
        position: "relative",
        flex: 1, height: 32, padding: 3, border: "none", cursor: "pointer",
        borderRadius: 999,
        background: "var(--glass-2)",
        border: "1px solid var(--glass-stroke-strong)",
        backdropFilter: "var(--glass-blur-soft)",
        WebkitBackdropFilter: "var(--glass-blur-soft)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        display: "inline-flex", alignItems: "center",
        transition: "background 220ms var(--ease-out)",
        overflow: "hidden",
      }}>
      {/* Track icons — sit at the inner edges */}
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isLight ? 1 : 0.45, transition: "opacity 140ms" }}>
        <SunGlyph size={14}/>
      </span>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isLight ? 0.45 : 1, transition: "opacity 140ms" }}>
        <MoonGlyph size={13}/>
      </span>
      {/* Knob — oval pill, brand gradient, slides edge-to-edge with a
          firm cubic-bezier (no spring overshoot). Brand swaps to amber
          family in light mode. */}
      <span style={{
        position: "absolute", top: 3,
        left: isLight ? 3 : "calc(100% - 47px)",
        width: 44, height: 24, borderRadius: 999,
        background: isLight
          ? "linear-gradient(135deg, #FFB020, #D97500)"
          : "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
        boxShadow: isLight
          ? "0 0 14px rgba(217,117,0,0.55), 0 1px 2px rgba(0,0,0,0.25)"
          : "0 0 14px var(--neon-cyan-glow), 0 1px 2px rgba(0,0,0,0.35)",
        border: isLight
          ? "1px solid rgba(217,117,0,0.7)"
          : "1px solid color-mix(in oklab, var(--neon-cyan) 70%, transparent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "left 180ms cubic-bezier(0.65, 0, 0.35, 1)",
        color: "var(--ink-0)",
      }}>
        {isLight ? <SunGlyph size={13}/> : <MoonGlyph size={11}/>}
      </span>
    </button>
  );
}

function SunGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}
function MoonGlyph({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// --------------------------------------------------------------------
// VehicleModeToggle — pill switch between 2-wheel (motorcycle) and
// 4-wheel (car) service mode. Visual + persistence only; no further
// behavior wired today.
// --------------------------------------------------------------------
function useVehicleMode() {
  const [mode, setMode] = React.useState(() => {
    try { return localStorage.getItem("mgt-mode") || "2w"; } catch { return "2w"; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    try { localStorage.setItem("mgt-mode", mode); } catch {}
  }, [mode]);
  return [mode, setMode];
}

function VehicleModeToggle() {
  const [mode, setMode] = useVehicleMode();
  const [theme] = useTheme();
  const isCar = mode === "4w";
  const isLight = theme === "light";
  return (
    <button
      onClick={() => setMode(isCar ? "2w" : "4w")}
      title={isCar ? "Chuyển sang 2 bánh" : "Chuyển sang 4 bánh"}
      style={{
        position: "relative",
        flex: 1, height: 32, padding: 3, border: "none", cursor: "pointer",
        borderRadius: 999,
        background: "var(--glass-2)",
        border: "1px solid var(--glass-stroke-strong)",
        backdropFilter: "var(--glass-blur-soft)",
        WebkitBackdropFilter: "var(--glass-blur-soft)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
        display: "inline-flex", alignItems: "center",
        transition: "background 220ms var(--ease-out)",
        overflow: "hidden",
      }}>
      {/* Track icons */}
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isCar ? 0.45 : 1, transition: "opacity 140ms" }}>
        <BikeGlyph size={14}/>
      </span>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)", display: "inline-flex", opacity: isCar ? 1 : 0.45, transition: "opacity 140ms" }}>
        <CarGlyph size={14}/>
      </span>
      {/* Knob — same brand pill as the theme toggle, amber in light mode */}
      <span style={{
        position: "absolute", top: 3,
        left: isCar ? "calc(100% - 47px)" : 3,
        width: 44, height: 24, borderRadius: 999,
        background: isLight
          ? "linear-gradient(135deg, #FFB020, #D97500)"
          : "linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))",
        boxShadow: isLight
          ? "0 0 14px rgba(217,117,0,0.55), 0 1px 2px rgba(0,0,0,0.25)"
          : "0 0 14px var(--neon-cyan-glow), 0 1px 2px rgba(0,0,0,0.35)",
        border: isLight
          ? "1px solid rgba(217,117,0,0.7)"
          : "1px solid color-mix(in oklab, var(--neon-cyan) 70%, transparent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "left 180ms cubic-bezier(0.65, 0, 0.35, 1)",
        color: "var(--ink-0)",
      }}>
        {isCar ? <CarGlyph size={12}/> : <BikeGlyph size={13}/>}
      </span>
    </button>
  );
}

function BikeGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17" r="3.5"/>
      <circle cx="18.5" cy="17" r="3.5"/>
      <path d="M5.5 17l4-7h5l3 7"/>
      <path d="M14 6h3l1.5 4"/>
    </svg>
  );
}
function CarGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l2-5a2 2 0 0 1 2-1.5h10A2 2 0 0 1 19 8l2 5"/>
      <path d="M3 13h18v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <circle cx="7.5" cy="16" r="0.6" fill="currentColor"/>
      <circle cx="16.5" cy="16" r="0.6" fill="currentColor"/>
    </svg>
  );
}

// --------------------------------------------------------------------
// Modal — generic. Portals to document.body so it always escapes the
// stacking context of whatever component invoked it (e.g. the Sidebar's
// sticky wrapper, a fixed-positioned floating panel, etc). This keeps
// the layering system simple: modals are always at the top, period.
// --------------------------------------------------------------------
function Modal({ open, onClose, title, subtitle, children, primaryAction, primaryLabel = "Lưu", primaryIcon = "check", width = 560, primaryDisabled, secondary, footerStart, footer }) {
  // Esc-to-dismiss: only attach while open. Inputs/textareas/selects
  // don't natively consume Escape in HTML (it's not a typing key), so
  // we close unconditionally — matches OS-level dialog behaviour.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose && onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Backdrop click is intentionally NOT a close trigger — the user reported
  // accidental dismissals losing typed form data. Close affordances are:
  // the X icon, the Hủy button, and the Escape key.
  const node = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width, maxHeight: "92vh", overflow: "auto",
        background: "var(--glass-3)",
        backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--glass-stroke-strong)", borderRadius: 24,
        padding: 22, boxShadow: "var(--shadow-3)",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {title && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{title}</h2>
              {subtitle && <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>{subtitle}</span>}
            </div>
            <Button variant="icon" onClick={onClose}><Icon name="x" size={14}/></Button>
          </div>
        )}
        {children}
        {footer !== undefined ? (
          <div style={{ paddingTop: 4 }}>{footer}</div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{footerStart || null}</div>
            {secondary !== undefined ? secondary : <Button variant="ghost" onClick={onClose}>Hủy</Button>}
            <Button variant="primary" onClick={primaryAction} icon={primaryIcon} disabled={primaryDisabled}>{primaryLabel}</Button>
          </div>
        )}
      </div>
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
}

Object.assign(window, { Sidebar, SidebarEdgeToggle, TopBar, Modal, NAV_ITEMS, ThemeToggle, ThemeProvider, useTheme, VehicleModeToggle, useVehicleMode });
