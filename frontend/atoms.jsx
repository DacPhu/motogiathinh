// ====================================================================
// Atoms — Icon, Button, Chip, Avatar, Input, Toggle, Spark
// ====================================================================

const ICONS = {
  "home":       <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  "users":      <g><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-6-6.93"/></g>,
  "calendar":   <g><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></g>,
  "wallet":     <g><path d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><circle cx="17" cy="14" r="1.2"/></g>,
  "chart":      <path d="M3 3v18h18M7 14l4-4 4 4 5-5"/>,
  "settings":   <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>,
  "search":     <g><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></g>,
  "plus":       <path d="M12 5v14M5 12h14"/>,
  "bell":       <g><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></g>,
  "arrow-up":   <path d="M5 12l7-7 7 7M12 19V5"/>,
  "arrow-down": <path d="M19 12l-7 7-7-7M12 5v14"/>,
  "arrow-right":<path d="M5 12h14m-7-7 7 7-7 7"/>,
  "more":       <g><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></g>,
  "user-plus":  <g><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M22 11h-6"/></g>,
  "filter":     <path d="M3 6h18M6 12h12M10 18h4"/>,
  "download":   <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></g>,
  "phone":      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>,
  "check":      <path d="M20 6L9 17l-5-5"/>,
  "x":          <path d="M18 6 6 18M6 6l12 12"/>,
  "clock":      <g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g>,
  "card":       <g><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20M6 16h3"/></g>,
  "logout":     <g><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></g>,
  "menu":       <path d="M3 6h18M3 12h18M3 18h18"/>,
  "command":    <path d="M18 3a3 3 0 0 0 0 6h-3V6a3 3 0 1 0-3 3h6m0 0v6m0-6h3a3 3 0 1 1 0 6h-3v-3m0 0h-6m6 0v3a3 3 0 1 1-3-3h3"/>,
  "trending-up":<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>,
  "minus":      <path d="M5 12h14"/>,
  "graduation": <g><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></g>,
  "edit":       <g><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></g>,
  "eye":        <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></g>,
  "eye-off":    <g><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></g>,
  "bike":       <g><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2.5l1.5 11M5.5 17.5l4-9h6l3 9M9.5 8.5h6"/></g>,
};

function Icon({ name, size = 18, color = "currentColor", className = "", style = {} }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style}>
      {path}
    </svg>
  );
}

// --------------------------------------------------------------------
// Button
// --------------------------------------------------------------------
function Button({ variant = "primary", size = "md", icon, children, onClick, disabled, style = {} }) {
  const bs = {
    fontFamily: "var(--font-ui)",
    fontWeight: 600,
    fontSize: size === "sm" ? 12 : 13,
    padding: size === "sm" ? "7px 12px" : "10px 16px",
    borderRadius: size === "sm" ? 10 : 14,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    lineHeight: 1,
    letterSpacing: "0.005em",
    whiteSpace: "nowrap",
    transition: "all 140ms var(--ease-out)",
    opacity: disabled ? 0.4 : 1,
  };
  const variants = {
    primary: { background: "var(--neon-cyan)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-cyan), 0 0 24px var(--neon-cyan-glow)" },
    success: { background: "var(--neon-lime)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-lime), 0 0 24px var(--neon-lime-glow)" },
    danger:  { background: "var(--neon-pink)", color: "var(--fg-inverse)",
               boxShadow: "0 0 0 1px var(--neon-pink), 0 0 24px var(--neon-pink-glow)" },
    secondary: { background: "var(--glass-2)", color: "var(--fg-1)",
                 border: "1px solid var(--glass-stroke-strong)",
                 backdropFilter: "var(--glass-blur-soft)", WebkitBackdropFilter: "var(--glass-blur-soft)" },
    ghost: { background: "transparent", color: "var(--fg-2)",
             border: "1px solid var(--glass-stroke)" },
    icon: { background: "var(--glass-2)", color: "var(--fg-1)",
            border: "1px solid var(--glass-stroke)", padding: 10, borderRadius: 10 },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
            style={{ ...bs, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
    </button>
  );
}

// --------------------------------------------------------------------
// GlassCard
//
// Padding tier reference (use these values consistently across screens):
//   26 → Detail hero            (StudentDetail, PaymentDetail, ClassDetail,
//                                BranchExpanded)
//   22 → Section / selector     (BranchCard, Section 4 Hiệu suất)
//   18 → Default                (most general-purpose container)
//   14 → Compact / chart        (line-chart hosts, TongKpi)
//    0 → List shell             (header strip + scrollable body inside)
// --------------------------------------------------------------------
function GlassCard({ children, padding = 18, style = {}, soft = false, onClick }) {
  const cardStyle = {
    background: soft ? "var(--glass-1)" : "var(--glass-2)",
    backdropFilter: "var(--glass-blur)",
    WebkitBackdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-stroke)",
    borderRadius: 20,
    padding,
    boxShadow: "var(--shadow-2)",
    cursor: onClick ? "pointer" : "default",
    transition: "all 220ms var(--ease-out)",
    ...style,
  };
  return <div style={cardStyle} onClick={onClick}>{children}</div>;
}

// --------------------------------------------------------------------
// Chip (status pill with glow)
// --------------------------------------------------------------------
const STATUS_MAP = {
  paid:       { c: "var(--neon-lime)",   g: "var(--neon-lime-glow)",  label: "Paid" },
  pending:    { c: "var(--neon-amber)",  g: "var(--neon-amber-glow)", label: "Pending" },
  overdue:    { c: "var(--neon-pink)",   g: "var(--neon-pink-glow)",  label: "Overdue" },
  "in-lesson":{ c: "var(--neon-cyan)",   g: "var(--neon-cyan-glow)",  label: "In lesson" },
  scheduled:  { c: "var(--neon-violet)", g: "var(--neon-violet-glow)",label: "Scheduled" },
  ready:      { c: "var(--neon-lime)",   g: "var(--neon-lime-glow)",  label: "Ready to test" },
};
function StatusChip({ status, dot = true }) {
  const s = STATUS_MAP[status] || { c: "var(--fg-3)", g: "transparent", label: status };
  return (
    <span style={{
      fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
      padding: "4px 9px", borderRadius: 999,
      background: `color-mix(in oklab, ${s.c} 14%, transparent)`,
      color: s.c, border: `1px solid color-mix(in oklab, ${s.c} 36%, transparent)`,
      display: "inline-flex", alignItems: "center", gap: 6, lineHeight: 1, whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: s.c, boxShadow: `0 0 10px ${s.g}` }}></span>}
      {s.label}
    </span>
  );
}

function Chip({ children, color }) {
  return (
    <span style={{
      fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
      padding: "4px 9px", borderRadius: 999,
      background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
      color: color || "var(--fg-1)", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// --------------------------------------------------------------------
// Avatar
// --------------------------------------------------------------------
const GRADIENTS = [
  "linear-gradient(135deg, #00E5FF, #8B6CFF)",
  "linear-gradient(135deg, #FF3D8A, #FFB020)",
  "linear-gradient(135deg, #B6FF3C, #00E5FF)",
  "linear-gradient(135deg, #8B6CFF, #FF3D8A)",
  "linear-gradient(135deg, #FFB020, #B6FF3C)",
];
function Avatar({ name, size = 32, glow = false, src = null }) {
  const [imgUrl, setImgUrl] = React.useState(null);
  const [imgErr, setImgErr] = React.useState(false);
  React.useEffect(() => {
    if (!src) { setImgUrl(null); setImgErr(false); return; }
    setImgErr(false);
    if (window.MGT_TOKEN) {
      let alive = true, objUrl = null;
      const full = /^https?:/.test(src) ? src : (window.MGT_API_BASE || "") + src;
      fetch(full, { headers: { Authorization: "Bearer " + window.MGT_TOKEN } })
        .then(r => r.ok ? r.blob() : Promise.reject("err"))
        .then(b => { if (alive) { objUrl = URL.createObjectURL(b); setImgUrl(objUrl); } })
        .catch(() => { if (alive) setImgErr(true); });
      return () => { alive = false; if (objUrl) URL.revokeObjectURL(objUrl); };
    }
    setImgUrl(src);
  }, [src]);
  const initials = (name || "?").split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
  const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const grad = GRADIENTS[hash % GRADIENTS.length];
  const base = {
    width: size, height: size, borderRadius: 999, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    boxShadow: glow ? "0 0 14px var(--neon-cyan-glow)" : "0 1px 3px rgba(0,0,0,0.4)",
  };
  if (imgUrl && !imgErr) {
    return (
      <span style={{ ...base, overflow: "hidden", background: grad }}>
        <img src={imgUrl} alt="" onError={() => setImgErr(true)}
             style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
      </span>
    );
  }
  return (
    <span style={{ ...base, background: grad, fontFamily: "var(--font-display)", fontWeight: 600,
                   fontSize: size * 0.38, color: "var(--ink-0)" }}>{initials}</span>
  );
}

// --------------------------------------------------------------------
// Input
//
// `type` is forwarded straight to the underlying <input> — defaults to
// "text". Callers wanting a masked password field pass type="password"
// (RecordCreatorModal threads this through via field metadata).
// --------------------------------------------------------------------
function Input({ label, value, onChange, placeholder, mono = false, prefix, type = "text",
                 digits = false, maxDigits, format, storeFormatted = false, disabled = false, success = false, invalid = false }) {
  // digits=true     → strip non-digits on every keystroke (cap at maxDigits).
  // format          → live mask fn (e.g. fmtPhone, fmtMoneyInput, fmtDateInput).
  //                   Applied to the visible input value AS THE USER TYPES.
  // storeFormatted  → onChange emits the formatted display value (use for
  //                   dates where storage form IS the formatted string).
  //                   Default: onChange emits the bare digit-stripped value.
  // Cursor preservation: we track caret position by *digit count to the left*
  // of the caret, then restore that digit-count after re-format. This keeps
  // the caret intuitively placed even when masks add/remove separators.
  const [focused, setFocused] = React.useState(false);
  // Password-only: toggle visibility. The eye button on the right swaps
  // the rendered `type` between "password" and "text". Lives next to the
  // input inside the same focus-styled wrapper.
  const [revealed, setRevealed] = React.useState(false);
  const inputRef = React.useRef(null);
  const caretRef = React.useRef(null);
  const rawValue = String(value ?? "");
  const display  = format ? format(rawValue) : rawValue;
  const isPassword     = type === "password";
  const effectiveType  = isPassword && revealed ? "text" : type;
  // After every render where a caret target is queued, restore selection.
  React.useEffect(() => {
    if (!inputRef.current || caretRef.current == null) return;
    const want = caretRef.current; caretRef.current = null;
    const cur = inputRef.current.value;
    // Walk `cur` and find the offset where `want` digits have been counted.
    let digitsSeen = 0, i = 0;
    while (i < cur.length && digitsSeen < want) {
      if (/\d/.test(cur[i])) digitsSeen++;
      i++;
    }
    try { inputRef.current.setSelectionRange(i, i); } catch {}
  });
  const handle = (e) => {
    if (!onChange) return;
    const raw = e.target.value;
    // Count digits before the caret in the user-typed string. We'll restore
    // the caret after format() to the position with that many digits.
    if (format && digits) {
      const caret = e.target.selectionStart ?? raw.length;
      let d = 0;
      for (let i = 0; i < caret; i++) if (/\d/.test(raw[i])) d++;
      caretRef.current = d;
    }
    if (!digits) return onChange(raw);
    let d = raw.replace(/\D+/g, "");
    if (maxDigits) d = d.slice(0, maxDigits);
    onChange(storeFormatted && format ? format(d) : d);
  };
  const usingMono = mono || digits;  // digit fields always render in tabular-nums
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>{label}</label>}
      {/* Focus styling is on the wrapper — not the inner <input> — so the
          cyan ring traces the visible capsule edge instead of the smaller
          inner element. The inner input's focus-visible box-shadow is
          explicitly nulled to suppress the global ring. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: success ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)"
                  : invalid ? "color-mix(in oklab, var(--neon-pink) 10%, transparent)" : "var(--ink-2)",
        border: `1px solid ${focused && !disabled ? "var(--neon-cyan)" : success ? "var(--neon-lime)" : invalid ? "var(--neon-pink)" : "var(--glass-stroke)"}`,
        boxShadow: focused && !disabled ? "0 0 14px var(--neon-cyan-haze)" : "none",
        borderRadius: 10, padding: "0 12px",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "auto",
        transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
      }}>
        {prefix && <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-3)" }}>{prefix}</span>}
        <input ref={inputRef} value={display} onChange={handle} placeholder={placeholder}
               type={effectiveType}
               disabled={disabled}
               inputMode={digits ? "numeric" : undefined}
               autoComplete={isPassword ? "new-password" : undefined}
               onFocus={() => setFocused(true)}
               onBlur={() => setFocused(false)}
               style={{
                 flex: 1, background: "transparent", border: "none", outline: "none",
                 padding: "10px 0", color: "var(--fg-1)",
                 fontFamily: usingMono ? "var(--font-mono)" : "var(--font-ui)",
                 fontSize: 14, fontVariantNumeric: usingMono ? "tabular-nums" : "normal",
                 boxShadow: "none",  // disable the global *:focus-visible ring on the inner input
               }}/>
        {isPassword && (
          // tabIndex=-1 so the eye sits outside the natural tab order
          // (users tabbing past the password shouldn't land on the toggle).
          // onMouseDown preventDefault keeps the password input focused
          // when the icon is clicked, so the caret doesn't jump away.
          <button type="button" tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRevealed(v => !v)}
                  aria-label={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  title={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  style={{
                    background: "transparent", border: "none", padding: 4,
                    margin: 0, display: "flex", alignItems: "center",
                    cursor: "pointer", color: "var(--fg-3)",
                    transition: "color 140ms var(--ease-out)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg-1)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--fg-3)"}>
            <Icon name={revealed ? "eye-off" : "eye"} size={16}/>
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Progress bar
// --------------------------------------------------------------------
function Progress({ value, total, color = "var(--neon-cyan)", glow = "var(--neon-cyan-glow)" }) {
  const pct = Math.min(100, (value / total) * 100);
  return (
    <div style={{ width: "100%", height: 4, background: "var(--ink-3)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: 999,
        boxShadow: `0 0 8px ${glow}`, transition: "width 360ms var(--ease-out)",
      }}/>
    </div>
  );
}

// --------------------------------------------------------------------
// Sparkline
// --------------------------------------------------------------------
function Sparkline({ data, color = "#00E5FF", width = 200, height = 36 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.4" points={pts} style={{ filter: `drop-shadow(0 0 4px ${color})` }}/>
    </svg>
  );
}

// --------------------------------------------------------------------
// Count-up (200ms tick-up on mount)
// --------------------------------------------------------------------
function CountUp({ value, duration = 600, fmt = (n) => n.toLocaleString() }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{fmt(n)}</span>;
}

// --------------------------------------------------------------------
// Pill tabs (used in detail screens)
// --------------------------------------------------------------------
function PillTabs({ value, onChange, tabs }) {
  return (
    <div style={{
      display: "inline-flex", padding: 4,
      background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
      borderRadius: 999,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600,
          padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
          background: value === t.id ? "var(--glass-3)" : "transparent",
          color: value === t.id ? "var(--fg-1)" : "var(--fg-3)",
          boxShadow: value === t.id ? "0 0 0 1px var(--neon-cyan), 0 0 14px var(--neon-cyan-glow)" : "none",
          transition: "all 140ms var(--ease-out)",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {t.label}
          {t.count != null && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              padding: "2px 6px", borderRadius: 999,
              background: value === t.id ? "var(--ink-2)" : "var(--glass-2)",
              color: value === t.id ? "var(--fg-1)" : "var(--fg-3)",
            }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------
// Filter chip (multi-select-style for the students list)
// --------------------------------------------------------------------
function FilterChip({ active, onClick, icon, label, color = "cyan" }) {
  const c = `var(--neon-${color})`;
  const g = `var(--neon-${color}-glow)`;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      padding: "6px 12px", borderRadius: 999, cursor: "pointer",
      background: active ? `color-mix(in oklab, ${c} 18%, transparent)` : "var(--glass-2)",
      border: `1px solid ${active ? c : "var(--glass-stroke)"}`,
      color: active ? c : "var(--fg-2)",
      boxShadow: active ? `0 0 14px color-mix(in oklab, ${c} 20%, transparent)` : "none",
      transition: "all 140ms var(--ease-out)",
    }}>
      {icon && <Icon name={icon} size={13}/>}
      {label}
    </button>
  );
}

// --------------------------------------------------------------------
// Document slot — drag-and-drop placeholder for student documents
// --------------------------------------------------------------------
function DocSlot({ doc, filled, onDrop, onClear, compact = false, previewUrl }) {
  const [hover, setHover] = React.useState(false);
  const [lightbox, setLightbox] = React.useState(false);
  // Click-to-pick via hidden <input type=file> alongside DnD. Both invoke
  // onDrop(key, file?) — second arg is the File for callers who upload it.
  // When the slot has a previewUrl (already uploaded), the click opens a
  // lightbox to view it; the small upload-arrow button replaces it.
  const fileRef = React.useRef(null);
  const pick = (file) => { setHover(false); onDrop && onDrop(doc.key, file || null); };
  const openPicker = (e) => { e.stopPropagation(); fileRef.current && fileRef.current.click(); };
  const openLightbox = (e) => { e.stopPropagation(); setLightbox(true); };
  return (
    <div onDragOver={e => { e.preventDefault(); setHover(true); }}
         onDragLeave={() => setHover(false)}
         onDrop={e => { e.preventDefault(); pick(e.dataTransfer?.files?.[0]); }}
         onClick={previewUrl ? openLightbox : openPicker}
         style={{
           borderRadius: 16, padding: compact ? 14 : 18,
           border: `1px dashed ${filled ? "var(--neon-lime)" : hover ? "var(--neon-cyan)" : "var(--glass-stroke-strong)"}`,
           background: filled
             ? "color-mix(in oklab, var(--neon-lime) 8%, transparent)"
             : hover ? "color-mix(in oklab, var(--neon-cyan) 8%, transparent)" : "var(--ink-2)",
           display: "flex", flexDirection: "column", gap: 8,
           minHeight: compact ? 80 : 132, position: "relative", cursor: "pointer",
           transition: "all 140ms var(--ease-out)",
         }}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf"
             onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }}
             onClick={(e) => e.stopPropagation()}
             style={{ display: "none" }}/>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={filled ? "check" : "plus"} size={14}
              color={filled ? "var(--neon-lime)" : "var(--fg-3)"}
              style={{ filter: filled ? "drop-shadow(0 0 6px var(--neon-lime-glow))" : "none" }}/>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                       color: filled ? "var(--neon-lime)" : "var(--fg-3)" }}>
          {doc.label}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          {previewUrl && (
            <button onClick={openPicker}
                    title="Thay tệp"
                    style={{ background: "transparent", border: "none", color: "var(--fg-3)", cursor: "pointer", padding: 0 }}>
              <Icon name="upload" size={12}/>
            </button>
          )}
          {filled && onClear && (
            <button onClick={(e) => { e.stopPropagation(); onClear(doc.key); }}
                    title="Xóa"
                    style={{ background: "transparent", border: "none", color: "var(--fg-3)", cursor: "pointer", padding: 0 }}>
              <Icon name="x" size={12}/>
            </button>
          )}
        </span>
      </div>
      {!compact && (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.4 }}>
          {previewUrl ? "Nhấn để xem · biểu tượng tải lên để thay" :
           filled ? "Đã có tệp · nhấn để xem" : doc.hint || "Kéo & thả · chụp · paste"}
        </span>
      )}
      {filled && (
        <div style={{ flex: 1, minHeight: 30, marginTop: 4, borderRadius: 8,
                      background: previewUrl ? "transparent" : "linear-gradient(135deg, rgba(0,229,255,0.08), rgba(139,108,255,0.08))",
                      border: "1px solid var(--glass-stroke)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden" }}>
          {previewUrl
            ? <img src={previewUrl} alt={doc.label} style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain" }}/>
            : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                {doc.key.toUpperCase()}.JPG
              </span>}
        </div>
      )}
      {lightbox && previewUrl && (
        <DocLightbox url={previewUrl} label={doc.label} onClose={() => setLightbox(false)}/>
      )}
    </div>
  );
}

// Lightbox — vanilla portal-style overlay for viewing an uploaded file.
// Image renders inline; PDF / unknown opens in a new tab as fallback.
function DocLightbox({ url, label, onClose }) {
  React.useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const isPdf = /\.pdf(?:$|\?)/i.test(url);
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 30,
      animation: "fadeIn 180ms ease-out",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: "92vw", maxHeight: "92vh", display: "flex", flexDirection: "column",
        background: "var(--ink-1)", borderRadius: 16, border: "1px solid var(--glass-stroke)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px",
                      borderBottom: "1px solid var(--glass-stroke)", gap: 10 }}>
          <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10,
                         letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
          <a href={url} target="_blank" rel="noopener noreferrer"
             style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--neon-cyan)",
                      textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Mở trong tab mới ↗
          </a>
          <button onClick={onClose} style={{ background: "transparent", border: "none",
                  color: "var(--fg-3)", cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={16}/>
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 200, minWidth: 320,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--bg-0)" }}>
          {isPdf
            ? <iframe src={url} title={label}
                      sandbox="allow-same-origin"
                      style={{ width: "80vw", height: "80vh", border: "none" }}/>
            : <img src={url} alt={label} style={{ maxWidth: "88vw", maxHeight: "82vh", objectFit: "contain" }}/>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// --------------------------------------------------------------------
// Payment status pill — only 0% / 50% / 100% (red / yellow / green)
// Snug sizing.
// --------------------------------------------------------------------
function PaymentPill({ status, size = "sm" }) {
  // Accept legacy strings — collapse to 0/50/100 bands.
  const norm = (status === "FULL")     ? "100%"
             : (status === "OVERDUE")  ? "0%"
             : (status === "WAIVED")   ? "100%"
             : status;
  const map = {
    "0%":   { c: "var(--neon-pink)",  g: "var(--neon-pink-glow)"  },
    "50%":  { c: "var(--neon-amber)", g: "var(--neon-amber-glow)" },
    "100%": { c: "var(--neon-lime)",  g: "var(--neon-lime-glow)"  },
  };
  const m = map[norm] || map["0%"];
  const padding = size === "lg" ? "5px 12px" : "2px 8px";
  const fontSize = size === "lg" ? 12 : 10;
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize, fontWeight: 700, letterSpacing: "0.04em",
      padding, borderRadius: 999, whiteSpace: "nowrap",
      background: `color-mix(in oklab, ${m.c} 14%, transparent)`,
      color: m.c, border: `1px solid color-mix(in oklab, ${m.c} 36%, transparent)`,
      boxShadow: `0 0 10px color-mix(in oklab, ${m.c} 22%, transparent)`,
      display: "inline-flex", alignItems: "center", lineHeight: 1,
    }}>{norm}</span>
  );
}

// --------------------------------------------------------------------
// Hồ sơ status — tiny badge only (✓ or ! ), no text label
// --------------------------------------------------------------------
function ProfilePill({ complete, withText = false }) {
  const c = complete ? "var(--neon-lime)" : "var(--neon-pink)";
  const g = complete ? "var(--neon-lime-glow)" : "var(--neon-pink-glow)";
  if (withText) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
        padding: "4px 10px", borderRadius: 999,
        background: `color-mix(in oklab, ${c} 14%, transparent)`,
        color: c, border: `1px solid color-mix(in oklab, ${c} 36%, transparent)`,
        whiteSpace: "nowrap",
      }}>
        <Icon name={complete ? "check" : "x"} size={11} color={c} style={{ filter: `drop-shadow(0 0 5px ${g})` }}/>
        {complete ? "Đủ hồ sơ" : "Thiếu hồ sơ"}
      </span>
    );
  }
  return (
    <span title={complete ? "Đủ hồ sơ" : "Thiếu hồ sơ"} style={{
      width: 20, height: 20, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: `color-mix(in oklab, ${c} 18%, transparent)`,
      color: c, border: `1px solid color-mix(in oklab, ${c} 42%, transparent)`,
      boxShadow: `0 0 8px color-mix(in oklab, ${c} 30%, transparent)`,
      fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, lineHeight: 1,
    }}>{complete ? "✓" : "!"}</span>
  );
}

// --------------------------------------------------------------------
// Class status pill (đang mở / đang diễn ra / đã kết thúc)
// --------------------------------------------------------------------
function ClassStatusPill({ status, onClick, glow }) {
  const map = {
    "đang mở":       { c: "var(--neon-lime)",   label: "Đang mở" },
    "đang diễn ra":  { c: "var(--neon-cyan)",   label: "Đang diễn ra" },
    "đã kết thúc":   { c: "var(--fg-3)",        label: "Đã kết thúc" },
  };
  const m = map[status] || map["đang mở"];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? "Bấm để chỉnh sửa lớp" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
        padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap",
        background: `color-mix(in oklab, ${m.c} 12%, transparent)`,
        color: m.c, border: `1px solid color-mix(in oklab, ${m.c} 32%, transparent)`,
        boxShadow: glow ? `0 0 14px color-mix(in oklab, ${m.c} 50%, transparent)` : "none",
        cursor: onClick ? "pointer" : "default",
        transition: "all 140ms var(--ease-out)",
      }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: m.c, boxShadow: `0 0 8px ${m.c}` }}></span>
      {m.label}
    </button>
  );
}

// --------------------------------------------------------------------
// Select dropdown — used for Học phí, Khuyến mãi, Class, etc.
// --------------------------------------------------------------------
function Select({ label, value, onChange, options, placeholder = "Chọn…", note, success = false, invalid = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select value={value || ""} onChange={e => onChange && onChange(e.target.value)} style={{
          width: "100%", appearance: "none",
          background: success ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)"
                    : invalid ? "color-mix(in oklab, var(--neon-pink) 10%, transparent)" : "var(--ink-2)",
          border: `1px solid ${success ? "var(--neon-lime)" : invalid ? "var(--neon-pink)" : "var(--glass-stroke)"}`,
          borderRadius: 10, padding: "10px 36px 10px 12px",
          color: value ? "var(--fg-1)" : "var(--fg-4)",
          fontFamily: "var(--font-ui)", fontSize: 14, cursor: "pointer", outline: "none",
        }}>
          {/* Disabled "Chọn…" only when nothing is selected — once the
              user picks a value (or the form is seeded with one), the
              placeholder line disappears from the dropdown so it can't
              be mistaken for an acceptable value. */}
          {!value && <option value="" disabled>{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="arrow-down" size={14}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--fg-3)" }}/>
      </div>
      {note && <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--fg-3)" }}>{note}</span>}
    </div>
  );
}

// --------------------------------------------------------------------
// TagSelect — dropdown-add + removable pills multi-select.
//
// `value` is an array of selected ids (selection order preserved). The
// dropdown lists only options not yet selected; picking one appends its
// id and resets the dropdown back to the placeholder. Each selected id
// renders as a removable pill (label + ×). Visual idiom mirrors Select
// (dropdown capsule) and the neon-accent pill primitives (FilterChip /
// multipill).
// --------------------------------------------------------------------
function TagSelect({ label, value = [], onChange, options = [], placeholder = "Thêm…", color = "cyan" }) {
  const c = `var(--neon-${color})`;
  const selected = Array.isArray(value) ? value : [];
  const optById = new Map(options.map(o => [o.value, o]));
  const available = options.filter(o => !selected.includes(o.value));
  const add = (id) => { if (id && !selected.includes(id)) onChange && onChange([...selected, id]); };
  const remove = (id) => onChange && onChange(selected.filter(v => v !== id));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "var(--fg-3)",
      }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select value="" onChange={e => { add(e.target.value); }}
                disabled={available.length === 0}
                style={{
          width: "100%", appearance: "none", background: "var(--ink-2)",
          border: "1px solid var(--glass-stroke)", borderRadius: 10, padding: "10px 36px 10px 12px",
          color: "var(--fg-4)",
          fontFamily: "var(--font-ui)", fontSize: 14,
          cursor: available.length === 0 ? "not-allowed" : "pointer", outline: "none",
          opacity: available.length === 0 ? 0.5 : 1,
        }}>
          <option value="" disabled>{available.length === 0 ? "Đã chọn tất cả" : placeholder}</option>
          {available.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="arrow-down" size={14}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--fg-3)" }}/>
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {selected.map(id => {
            const o = optById.get(id);
            return (
              <span key={id} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 8px 5px 11px", borderRadius: 999,
                background: `color-mix(in oklab, ${c} 14%, transparent)`,
                border: `1px solid ${c}`,
                boxShadow: `0 0 12px color-mix(in oklab, ${c} 40%, transparent)`,
                color: "var(--fg-1)",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                whiteSpace: "nowrap",
              }}>
                {o ? o.label : id}
                <button type="button" onClick={() => remove(id)} aria-label="Bỏ chọn"
                        style={{
                          background: "transparent", border: "none", padding: 0, margin: 0,
                          display: "inline-flex", alignItems: "center", cursor: "pointer",
                          color: "var(--fg-3)", transition: "color 140ms var(--ease-out)",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--fg-1)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--fg-3)"}>
                  <Icon name="x" size={12}/>
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  Icon, Button, GlassCard, StatusChip, Chip, Avatar, Input, Progress, Sparkline, CountUp, STATUS_MAP,
  PillTabs, FilterChip, DocSlot, PaymentPill, ProfilePill, ClassStatusPill, Select, TagSelect,
});
