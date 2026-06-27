// ====================================================================
// Dashboard — 4 sections:
//   1. Tổng       — cumulative line charts + 4 KPIs (total + latest each)
//   2. Biến động  — time-series line charts with hour/day/month switcher
//                   and configurable node count; legend toggles
//   3. So sánh    — 3 branches overlaid on the same chart, 2 charts stacked
//                   full-width. Per-branch color tone, 3 hues per branch.
//   4. Hiệu suất  — full-width branch performance bar charts; money in
//                   "1,100.95 triệu" format with dimmed decimal.
// ====================================================================

// --------------------------------------------------------------------
// Branch color palette — each branch owns a hue family, 3 tones.
// Exposed globally so all screens (dashboard, org, classes) can light
// their UI in the same color for the same branch.
// Light-mode replacement set restores contrast on the paper surface
// (the dark-mode neons would otherwise wash out to near-invisible).
// --------------------------------------------------------------------
const BRANCH_TONES = {
  "br-1": { name: "Cyan",   tones: ["#00E5FF", "#0096B0", "#03657A"] },
  "br-2": { name: "Pink",   tones: ["#FF3D8A", "#C2185B", "#7A1140"] },
  "br-3": { name: "Violet", tones: ["#B6A0FF", "#7B5BD9", "#4B2F8E"] },
  "br-4": { name: "Amber",  tones: ["#FFB020", "#CC8810", "#7A5200"] },
  "br-5": { name: "Lime",   tones: ["#B6FF3C", "#7ACC20", "#4A7A10"] },
};
const BRANCH_TONES_LIGHT = {
  "br-1": { name: "Cyan",   tones: ["#0096C7", "#006FA0", "#003F66"] },
  "br-2": { name: "Pink",   tones: ["#D81B60", "#A8154E", "#6E0E32"] },
  "br-3": { name: "Violet", tones: ["#6E48F2", "#5837C2", "#3A2580"] },
  "br-4": { name: "Amber",  tones: ["#CC7700", "#AA5500", "#7A3300"] },
  "br-5": { name: "Lime",   tones: ["#5A8500", "#3D6600", "#264000"] },
};
// Fallback palette for any br-N beyond the static entries above
const _BRANCH_FALLBACK_DARK  = [["#00E5FF","#0096B0","#03657A"],["#FF3D8A","#C2185B","#7A1140"],["#B6A0FF","#7B5BD9","#4B2F8E"],["#FFB020","#CC8810","#7A5200"],["#B6FF3C","#7ACC20","#4A7A10"]];
const _BRANCH_FALLBACK_LIGHT = [["#0096C7","#006FA0","#003F66"],["#D81B60","#A8154E","#6E0E32"],["#6E48F2","#5837C2","#3A2580"],["#CC7700","#AA5500","#7A3300"],["#5A8500","#3D6600","#264000"]];
function _tonesFor(map, fallbackPalette, id) {
  if (map[id]) return map[id];
  const n = parseInt((id || "").replace("br-", ""), 10);
  const t = Number.isFinite(n) ? fallbackPalette[(n - 1) % fallbackPalette.length] : fallbackPalette[0];
  return { name: id, tones: t };
}
// Pick the right map at call time so theme switches apply instantly.
function currentBranchTones() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? BRANCH_TONES_LIGHT
    : BRANCH_TONES;
}
// Helper: pick the primary tone for a branch id (with safe fallback).
function branchTone(branchId) {
  return (currentBranchTones()[branchId]?.tones[0]) || "var(--neon-cyan)";
}
window.BRANCH_TONES = BRANCH_TONES;
window.BRANCH_TONES_LIGHT = BRANCH_TONES_LIGHT;
window.currentBranchTones = currentBranchTones;
window.branchTone   = branchTone;

// useBranchTones — hook variant that subscribes to theme via context,
// so any component reading branch tones will re-render instantly when
// the theme toggles. Components that render branch-colored UI should
// use this hook instead of calling currentBranchTones() directly.
function useBranchTones() {
  const [theme] = window.useTheme();
  return theme === "light" ? BRANCH_TONES_LIGHT : BRANCH_TONES;
}
function useBranchTone(branchId) {
  const map = useBranchTones();
  return map[branchId]?.tones[0] || "var(--neon-cyan)";
}
window.useBranchTones = useBranchTones;
window.useBranchTone  = useBranchTone;

// --------------------------------------------------------------------
// Chart series colors — kept as concrete hex per theme so SVG
// `stroke` attributes (which do not accept CSS variables) can use
// them directly. Mirrors the neon palette defined in
// colors_and_type.css. Light values darken to pass AA contrast on the
// paper surface.
// --------------------------------------------------------------------
const CHART_COLORS_DARK = {
  cyan:   "#00E5FF",
  lime:   "#B6FF3C",
  pink:   "#FF3D8A",
  violet: "#8B6CFF",
  amber:  "#FFB020",
};
const CHART_COLORS_LIGHT = {
  cyan:   "#0096C7",
  lime:   "#1E8F37",
  pink:   "#D81B60",
  violet: "#6E48F2",
  amber:  "#D97500",
};
function useChartColors() {
  const [theme] = window.useTheme();
  return theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS_DARK;
}
window.useChartColors = useChartColors;

// --------------------------------------------------------------------
// SectionHeader — title + info "?" tooltip + optional right
// --------------------------------------------------------------------
function SectionHeader({ title, info, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 18 }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{title}</h2>
        {info && <InfoTooltip text={info}/>}
      </div>
      {right}
    </div>
  );
}

function InfoTooltip({ text }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      style={{ position: "relative", display: "inline-flex", outline: "none" }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999,
        border: "1px solid var(--neon-cyan)",
        color: "var(--neon-cyan)",
        background: open ? "color-mix(in oklab, var(--neon-cyan) 18%, transparent)" : "transparent",
        boxShadow: open ? "0 0 14px var(--neon-cyan-glow)" : "0 0 8px var(--neon-cyan-haze)",
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "help",
        transition: "all 140ms var(--ease-out)",
        lineHeight: 1,
      }}>?</span>
      {open && (
        <span style={{
          position: "absolute", top: "calc(100% + 8px)", left: -8, zIndex: 40,
          minWidth: 240, maxWidth: 340,
          padding: "10px 12px",
          background: "var(--ink-2)",
          border: "1px solid var(--neon-cyan)",
          boxShadow: "0 0 24px var(--neon-cyan-haze), 0 12px 32px rgba(0,0,0,0.6)",
          borderRadius: 12,
          fontFamily: "var(--font-ui)", fontSize: 12, lineHeight: 1.5,
          color: "var(--fg-2)",
          pointerEvents: "none",
          animation: "fadeIn 160ms var(--ease-out)",
        }}>{text}</span>
      )}
    </span>
  );
}

// --------------------------------------------------------------------
// BucketControls — grain (hour/day/month) + count picker
// --------------------------------------------------------------------
function BucketControls({ grain, setGrain, count, setCount, grainOptions, countOptions }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)", alignSelf: "center", marginRight: 4 }}>Bước</span>
        <PillTabs value={grain} onChange={setGrain} tabs={grainOptions.map(g => ({ id: g, label: ({hour:"Giờ",day:"Ngày",month:"Tháng"})[g] }))}/>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)", alignSelf: "center", marginRight: 4 }}>Số mốc</span>
        <PillTabs value={String(count)} onChange={(v) => setCount(parseInt(v, 10))} tabs={countOptions.map(n => ({ id: String(n), label: String(n) }))}/>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// TimeFrameControls — used by SectionTong
//   ĐƠN VỊ pill tabs  +  CHỌN KHUNG 2×3 grid of preset pills.
//   The CHỌN KHUNG label is a clickable trigger that opens a custom
//   date-range popover. A custom range becomes a big overlay pill
//   covering the 6-pill grid; click it to dismiss back to presets.
// --------------------------------------------------------------------
function ColHeading({ children, onClick, trailing, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6,
        background: "transparent", border: "none", padding: 0,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
        textTransform: "uppercase", color: "var(--fg-3)",
        height: 36,
        ...style,
      }}>
      {children}
      {trailing}
    </button>
  );
}

function MiniPill({ active, children, onClick, full }) {
  return (
    <button onClick={onClick} style={{
      gridColumn: full ? "span 3" : "auto",
      width: 140, height: 34,
      padding: "0 6px", borderRadius: 9,
      background: active ? "var(--ink-3)" : "var(--ink-2)",
      border: `1px solid ${active ? "var(--neon-cyan)" : "var(--glass-stroke)"}`,
      boxShadow: active ? "0 0 14px var(--neon-cyan-haze)" : "none",
      color: active ? "var(--fg-1)" : "var(--fg-2)",
      fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600,
      letterSpacing: "-0.005em",
      cursor: "pointer",
      transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out), color 140ms var(--ease-out)",
      whiteSpace: "nowrap",
      overflow: "visible",
      textAlign: "center",
    }}>{children}</button>
  );
}

// --------------------------------------------------------------------
// SegmentCell — one cell of the CHỌN KHUNG 3×2 segmented control.
// The outer container provides the shared pill chrome; each cell is
// borderless until selected, then a single rounded outline + neon-cyan
// glow runs around the cell only — like PillTabs but in a grid.
// --------------------------------------------------------------------
function SegmentCell({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      height: 30, padding: "0 6px", border: "none",
      borderRadius: 10, cursor: "pointer",
      background: active ? "var(--glass-3)" : "transparent",
      color: active ? "var(--fg-1)" : "var(--fg-3)",
      boxShadow: active ? "0 0 0 1px var(--neon-cyan), 0 0 14px var(--neon-cyan-glow)" : "none",
      fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 600,
      letterSpacing: "-0.012em", whiteSpace: "nowrap", textAlign: "center",
      transition: "background 140ms var(--ease-out), color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
    }}>{children}</button>
  );
}

function TimeFrameControls({ grain, setGrain, preset, setPreset, customRange, setCustomRange }) {
  const presets = presetsForGrain(grain);
  const row0 = presets.filter(p => p.row === 0);
  const row1 = presets.filter(p => p.row === 1);

  // Enter custom mode: seed with (first day of current month → today)
  // so the user starts with a meaningful range, not an empty pill.
  const enterCustom = () => {
    if (customRange) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    setCustomRange({ start, end });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      {/* ĐƠN VỊ — label + 3 pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ColHeading>Đơn vị</ColHeading>
        <PillTabs value={grain} onChange={setGrain} tabs={[
          { id: "hour",  label: "Giờ"   },
          { id: "day",   label: "Ngày"  },
          { id: "month", label: "Tháng" },
        ]}/>
      </div>

      {/* CHỌN KHUNG — label + 3×2 grid, all on the same row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ColHeading onClick={enterCustom}
                    trailing={<Icon name="calendar" size={11} color={customRange ? "var(--neon-cyan)" : "var(--fg-3)"}/>}>
          Chọn khung
        </ColHeading>

        <div style={{ position: "relative" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 116px)",
            padding: 4,
            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
            borderRadius: 16,
            opacity: customRange ? 0.25 : 1,
            transition: "opacity 200ms var(--ease-out)",
            pointerEvents: customRange ? "none" : "auto",
          }}>
            {[...row0, ...row1].map(p => (
              <SegmentCell key={p.id}
                           active={!customRange && preset === p.id}
                           onClick={() => { setCustomRange(null); setPreset(p.id); }}>
                {p.label}
              </SegmentCell>
            ))}
          </div>

          {/* Custom-range overlay pill — inline date editor */}
          {customRange && (
            <DateRangePill range={customRange}
                           onChange={setCustomRange}
                           onClear={() => setCustomRange(null)}/>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// DateRangePill — the big neon pill that covers the 6-pill grid when
// the user picks a custom range. Contains two inline editable date
// fields and a mini Monday-start calendar dropdown for each.
// --------------------------------------------------------------------
function DateRangePill({ range, onChange, onClear }) {
  const dayCount = Math.max(1, Math.round((range.end - range.start) / 86400000));
  // Auto-swap: if user picks a start past the current end (or vice versa),
  // the two sides flip so the range always stays well-ordered.
  const setStart = (d) => {
    const ns = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    if (range.end < ns) {
      const ne = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59);
      onChange({ start: ne < ns ? ne : ns, end: ns < ne ? ne : ns });
      // (Both sides resolve to a sorted pair via the comparisons above.)
      return;
    }
    onChange({ start: ns, end: range.end });
  };
  const setEnd = (d) => {
    const ne = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    if (ne < range.start) {
      const ns = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), 0, 0, 0);
      onChange({ start: ne < ns ? ne : ns, end: ns < ne ? ne : ns });
      return;
    }
    onChange({ start: range.start, end: ne });
  };

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 14px", borderRadius: 12,
      background: "var(--ink-3)",
      border: "1px solid var(--neon-cyan)",
      boxShadow: "0 0 24px var(--neon-cyan-haze), inset 0 0 0 1px rgba(0,229,255,0.08)",
      color: "var(--fg-1)",
      animation: "fadeIn 200ms var(--ease-out)",
    }}>
      <Icon name="calendar" size={13} color="var(--neon-cyan)"
            style={{ filter: "drop-shadow(0 0 6px var(--neon-cyan-glow))" }}/>
      <DateField value={range.start} onChange={setStart}/>
      <span style={{ color: "var(--fg-3)" }}>–</span>
      <DateField value={range.end} onChange={setEnd}/>
      <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
        ({dayCount} ngày)
      </span>
      <button onClick={onClear} title="Bỏ chọn khoảng tùy chỉnh"
              style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--fg-3)", display: "inline-flex" }}>
        <Icon name="x" size={12}/>
      </button>
    </div>
  );
}

// --------------------------------------------------------------------
// DateField — text input that displays "dd/mm/yyyy", select-all on
// focus, opens a Monday-start mini-calendar below.
// --------------------------------------------------------------------
function DateField({ value, onChange }) {
  const fmt = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const parse = (str) => {
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getDate() !== d || dt.getMonth() !== mo - 1 || dt.getFullYear() !== y) return null;
    return dt;
  };

  const [text, setText] = React.useState(fmt(value));
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setText(fmt(value)); }, [value]);

  const inputRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = () => {
    const dt = parse(text);
    if (dt) onChange(dt);
    else    setText(fmt(value));
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={(e) => { e.target.select(); setOpen(true); }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { commit(); e.target.blur(); } }}
        style={{
          width: 110, textAlign: "center",
          background: "transparent", border: "1px solid transparent",
          color: "var(--fg-1)", borderRadius: 8,
          padding: "6px 8px",
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
          fontVariantNumeric: "tabular-nums", outline: "none",
          transition: "border-color 140ms var(--ease-out), background 140ms var(--ease-out)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--ink-4)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}/>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
        }}>
          <MiniCalendar value={value} onPick={(d) => { onChange(d); setOpen(false); }}/>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// MiniCalendar — single-month, Monday-start. Headers: T2 T3 T4 T5 T6 T7 CN.
// --------------------------------------------------------------------
function MiniCalendar({ value, onPick }) {
  const [view, setView] = React.useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const year = view.getFullYear();
  const month = view.getMonth();

  // Build day grid — Monday-start. JS Sun=0..Sat=6 → shift so Mon=0.
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  // Leading days from previous month
  for (let i = offset - 1; i >= 0; i--) {
    cells.push({ d: daysInPrev - i, otherMonth: true, dt: new Date(year, month - 1, daysInPrev - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, otherMonth: false, dt: new Date(year, month, d) });
  while (cells.length % 7 !== 0) {
    const d = cells.length - (offset + daysInMonth) + 1;
    cells.push({ d, otherMonth: true, dt: new Date(year, month + 1, d) });
  }

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const today = new Date();
  const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

  return (
    <div onMouseDown={e => e.preventDefault()} style={{
      width: 252, padding: 12,
      background: "var(--glass-3)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
      border: "1px solid var(--glass-stroke-strong)", borderRadius: 14,
      boxShadow: "var(--shadow-3)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CalArrow onClick={() => setView(new Date(year, month - 1, 1))} left/>
        <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", fontWeight: 600, letterSpacing: "0.06em" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <CalArrow onClick={() => setView(new Date(year, month + 1, 1))}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["T2","T3","T4","T5","T6","T7","CN"].map(d => (
          <span key={d} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.08em", padding: "4px 0" }}>{d}</span>
        ))}
        {cells.map((c, i) => {
          const isSel = sameDay(c.dt, value);
          const isToday = sameDay(c.dt, today);
          return (
            <button key={i} onClick={() => onPick(c.dt)} style={{
              height: 28, padding: 0, border: "none",
              borderRadius: 6, cursor: "pointer",
              background: isSel ? "var(--neon-cyan)" : "transparent",
              color: isSel ? "var(--ink-0)" : c.otherMonth ? "var(--fg-4)" : "var(--fg-1)",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: isSel ? 700 : 500,
              fontVariantNumeric: "tabular-nums",
              boxShadow: isSel
                ? "0 0 12px var(--neon-cyan-glow)"
                : isToday
                ? "inset 0 0 0 1px var(--neon-cyan)"
                : "none",
              transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
            }}
            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--ink-3)"; }}
            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              {c.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalArrow({ onClick, left }) {
  return (
    <button onClick={onClick} style={{
      width: 24, height: 24, padding: 0, borderRadius: 6,
      background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
      color: "var(--fg-2)", cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
           style={{ transform: left ? "rotate(180deg)" : "none" }}>
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

// --------------------------------------------------------------------
// ToggleLegend — clickable legend chips; emits hidden-set up
// --------------------------------------------------------------------
function ToggleLegend({ items, hidden, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map(it => {
        const isHidden = hidden.has(it.id);
        return (
          <button key={it.id} onClick={() => onToggle(it.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                    background: isHidden ? "transparent" : "var(--glass-2)",
                    border: `1px solid ${isHidden ? "var(--glass-stroke)" : "var(--glass-stroke-strong)"}`,
                    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: isHidden ? "var(--fg-4)" : "var(--fg-1)",
                    opacity: isHidden ? 0.55 : 1,
                    transition: "all 140ms var(--ease-out)",
                  }}>
            <span style={{
              width: 10, height: it.dashed ? 0 : 2,
              borderTop: it.dashed ? `2px dashed ${it.color}` : "none",
              background: it.dashed ? "transparent" : it.color,
              boxShadow: isHidden || it.dashed ? "none" : `0 0 6px ${it.color}`,
              flexShrink: 0,
            }}></span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------
// LineChart primitive — same API as before, but accepts `hidden` set
// --------------------------------------------------------------------
function LineChart({ width = 720, height = 240, padL = 32, padR = 18, padT = 14, padB = 26,
                     xLabels, series, hidden = new Set(), yFmt = (v) => v.toLocaleString(), tipFmt = (v) => v, allowFill = true }) {
  const visible = series.filter(s => !hidden.has(s.id));
  const allValues = visible.flatMap(s => s.data);
  const max = Math.max(1, ...allValues, 1);
  const xStep = xLabels.length > 1 ? (width - padL - padR) / (xLabels.length - 1) : 0;
  const y = (v) => height - padB - (v / max) * (height - padT - padB);
  const xAt = (i) => padL + i * xStep;

  const [hover, setHover] = React.useState(null);

  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* y-grid */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1={padL} x2={width - padR} y1={padT + (height - padT - padB) * p} y2={padT + (height - padT - padB) * p}
                stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4"/>
        ))}
        {[0, 0.5, 1].map((p, i) => (
          <text key={i} x={padL - 8} y={y(max * (1 - p)) + 4}
                fontFamily="var(--font-mono)" fontSize="12" fontWeight="500" fill="var(--fg-2)" textAnchor="end">
            {yFmt(max * (1 - p))}
          </text>
        ))}
        {xLabels.map((lbl, i) => {
          const skip = xLabels.length > 30 ? 6 : xLabels.length > 18 ? 4 : xLabels.length > 12 ? 3 : xLabels.length > 8 ? 2 : 1;
          if (i % skip !== 0 && i !== xLabels.length - 1) return null;
          return (
            <text key={i} x={xAt(i)} y={height - 8}
                  fontFamily="var(--font-mono)" fontSize="12" fontWeight="500" fill="var(--fg-2)" textAnchor="middle">{lbl}</text>
          );
        })}

        {visible.map((s, idx) => {
          const path = s.data.map((v, i) => `${i ? "L" : "M"}${xAt(i)},${y(v)}`).join(" ");
          const isFilled = allowFill && s.fill;
          const area = isFilled ? path + ` L${xAt(s.data.length - 1)},${height - padB} L${padL},${height - padB} Z` : null;
          const gradId = `lc-${idx}-${s.color.replace(/[^a-z0-9]/gi, "")}`;
          return (
            <g key={s.id || idx}>
              {area && (
                <>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={s.color} stopOpacity="0.25"/>
                      <stop offset="1" stopColor={s.color} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={area} fill={`url(#${gradId})`}/>
                </>
              )}
              <path d={path} fill="none" stroke={s.color}
                    strokeWidth={s.bold ? 2.4 : 1.6}
                    strokeDasharray={s.dashed ? "3 3" : "0"}
                    style={{ filter: allowFill ? `drop-shadow(0 0 5px color-mix(in oklab, ${s.color} 55%, transparent))` : "none" }}/>
              <circle cx={xAt(s.data.length - 1)} cy={y(s.data[s.data.length - 1])}
                      r="3.5" fill="#0A0C13" stroke={s.color} strokeWidth="1.5"
                      style={{ filter: allowFill ? `drop-shadow(0 0 6px ${s.color})` : "none" }}/>
            </g>
          );
        })}

        {hover != null && (
          <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={padT} y2={height - padB}
                stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3"/>
        )}
        {hover != null && visible.map((s, idx) => (
          <circle key={`hp-${idx}`} cx={xAt(hover.i)} cy={y(s.data[hover.i])}
                  r="4" fill="#0A0C13" stroke={s.color} strokeWidth="2"
                  style={{ filter: `drop-shadow(0 0 6px ${s.color})` }}/>
        ))}

        {xLabels.map((_, i) => (
          <rect key={`hit-${i}`}
                x={xAt(i) - xStep / 2} y={padT}
                width={xStep || 1} height={height - padT - padB}
                fill="transparent"
                onMouseEnter={() => setHover({ i })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "crosshair" }}/>
        ))}
      </svg>

      {hover != null && (
        <div style={{
          position: "absolute",
          left: `${(xAt(hover.i) / width) * 100}%`,
          top: 0, transform: `translateX(${hover.i > xLabels.length / 2 ? "-110%" : "10%"})`,
          // Liquid-glass tooltip — semi-transparent panel with strong blur
          background: "color-mix(in oklab, var(--ink-1) 55%, transparent)",
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          border: "1px solid color-mix(in oklab, var(--glass-stroke-strong) 70%, transparent)",
          borderRadius: 10, padding: "10px 12px", minWidth: 180,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          pointerEvents: "none", zIndex: 2,
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 8 }}>
            {xLabels[hover.i]}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((s, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-ui)", fontSize: 12 }}>
                <span style={{ width: 8, height: 2, background: s.color, boxShadow: `0 0 6px ${s.color}`, flexShrink: 0 }}></span>
                <span style={{ flex: 1, color: "var(--fg-3)" }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>
                  {tipFmt(s.data[hover.i], s)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// DashboardScreen — the orchestrator
// ====================================================================
function DashboardScreen() {
  const D = window.MGT_DATA;
  const [heroSlots, setHeroSlots] = React.useState(_loadHeroSlots);
  const [editSlot, setEditSlot]   = React.useState(null);
  const [heroRect, setHeroRect]   = React.useState(null);
  const heroRef = React.useRef(null);

  const openCatalog = (i) => {
    if (heroRef.current) setHeroRect(heroRef.current.getBoundingClientRect());
    setEditSlot(i);
  };
  const pickCard = (key) => {
    const next = [...heroSlots]; next[editSlot] = key;
    localStorage.setItem(_HERO_KEY, JSON.stringify(next));
    setHeroSlots(next); setEditSlot(null);
  };

  // Top KPIs — single pass collects all stats needed by any card type.
  const TODAY_PREFIX = D.TODAY ? D.TODAY.slice(0, 5) : ""; // "dd/mm"
  const ACTIVE_STATUSES = new Set(["đang mở", "đang diễn ra"]);
  const cutoff7d = D._NOW ? new Date(D._NOW.getTime() - 7 * 86400000) : null;
  // Monthly keys: "mm/yyyy" extracted from D.TODAY ("dd/mm/yyyy")
  const MONTH_KEY = D.TODAY ? D.TODAY.slice(3) : "";           // e.g. "06/2026"
  const _nowM = D._NOW ? D._NOW.getMonth() : (new Date()).getMonth();
  const _nowY = D._NOW ? D._NOW.getFullYear() : (new Date()).getFullYear();
  const _prevM = _nowM === 0 ? 12 : _nowM;
  const _prevY = _nowM === 0 ? _nowY - 1 : _nowY;
  const PREV_MONTH_KEY = `${String(_prevM).padStart(2, "0")}/${_prevY}`;
  let todayRevenue = 0, todayReceipts = 0, revenue7d = 0;
  for (const p of D.payments) {
    if (TODAY_PREFIX && p.createdAt && p.createdAt.startsWith(TODAY_PREFIX)) { todayRevenue += p.amount; todayReceipts++; }
    if (cutoff7d && p.createdAt) {
      try { const [d,m,y] = p.createdAt.split("/"); if (new Date(+y,+m-1,+d) >= cutoff7d) revenue7d += p.amount; } catch {}
    }
  }
  let newToday = 0, outstanding = 0, outstandingCount = 0, activeStudents = 0, passedStudents = 0;
  let newThisMonth = 0, newLastMonth = 0, newThisMonthA = 0, newThisMonthA1 = 0;
  const licA = { A: 0, A1: 0 };
  for (const s of D.students) {
    if (TODAY_PREFIX && s.createdAt && s.createdAt.startsWith(TODAY_PREFIX)) newToday++;
    outstanding += s.balance;
    if (s.balance > 0) outstandingCount++;
    const c = D.getClass(s.classId);
    if (c && ACTIVE_STATUSES.has(c.status)) activeStudents++;
    if (s.paymentStatus === "paid" || s.status === "passed") passedStudents++;
    licA[s.licence] = (licA[s.licence] || 0) + 1;
    // Monthly new-student counters
    if (MONTH_KEY && s.createdAt && s.createdAt.slice(3) === MONTH_KEY) {
      newThisMonth++;
      if (s.licence === "A")  newThisMonthA++;
      if (s.licence === "A1") newThisMonthA1++;
    }
    if (PREV_MONTH_KEY && s.createdAt && s.createdAt.slice(3) === PREV_MONTH_KEY) newLastMonth++;
  }
  const heroStats = {
    todayRevenue, todayReceipts, todayStr: D.TODAY || "",
    newToday, outstanding, outstandingCount,
    activeStudents, licA: licA.A || 0, licA1: licA.A1 || 0,
    totalStudents: D.students.length, revenue7d, passedStudents,
    newThisMonth, newLastMonth, newThisMonthA, newThisMonthA1,
    monthLabel: MONTH_KEY ? MONTH_KEY.split("/")[0] : "",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero KPI cards — right-click any card to swap via catalog */}
      <div ref={heroRef} className="mgt-print-hide" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {heroSlots.map((key, i) => {
          const card = _CATALOG_MAP[key] || CARD_CATALOG[0];
          const { value, hint } = card.compute(heroStats);
          return (
            <ContextMenuKpi key={i} slotIndex={i} onSwap={openCatalog}>
              <KpiBig index={i} label={card.label} value={value} hint={hint} color={card.color} icon={card.icon}/>
            </ContextMenuKpi>
          );
        })}
      </div>
      {/* Catalog overlay — full-width preview of all available card types */}
      {editSlot !== null && heroRect && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100010,
          background: "rgba(0,0,0,.65)", backdropFilter: "blur(6px)",
        }} onClick={() => setEditSlot(null)}>
          <div style={{
            position: "absolute",
            left: heroRect.left, width: heroRect.width,
            top: Math.max(heroRect.top - 24, 12),
            background: "var(--glass-2)", border: "1px solid var(--glass-stroke-strong)",
            borderRadius: 22, padding: "20px 20px 24px",
            backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--shadow-2)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
                          textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 16 }}>
              Chọn thẻ — vị trí {editSlot + 1}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {CARD_CATALOG.map((card, ci) => {
                const { value, hint } = card.compute(heroStats);
                const selected = heroSlots[editSlot] === card.key;
                return (
                  <div key={card.key} onClick={() => pickCard(card.key)} style={{
                    cursor: "pointer", borderRadius: 18,
                    outline: selected ? `2px solid var(--neon-${card.color})` : "2px solid transparent",
                    outlineOffset: 4, transition: "outline 120ms",
                  }}>
                    <KpiBig index={ci} label={card.label} value={value} hint={hint} color={card.color} icon={card.icon}/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wrappers exist ONLY so the print stylesheet can break-before-
          page on each section. `display: contents` makes them invisible
          to the live flex layout (so the parent's 16px gap still spaces
          the section internals the way the original screen did);
          the print-mode CSS flips display to block with !important so
          page breaks actually break. Net effect: live dashboard is
          identical to the pre-PDF layout. */}
      <div className="mgt-print-section" style={{ display: "contents" }}><SectionTong/></div>
      <div className="mgt-print-section" style={{ display: "contents" }}><SectionBienDong/></div>
      <div className="mgt-print-section" style={{ display: "contents" }}><SectionSoSanh/></div>
      <div className="mgt-print-section" style={{ display: "contents" }}><SectionHieuSuat/></div>
    </div>
  );
}

// --------------------------------------------------------------------
// Preset frames per grain — the "Chọn khung" 6-pill grid.
//   row 0 is always [10 / 30 / 60] rolling counts
//   row 1 depends on the chosen grain (giờ / ngày / tháng)
// --------------------------------------------------------------------
function presetsForGrain(grain) {
  // Universal row 0 picker by grain — keeps the top three "Chọn khung"
  // pills semantically grain-aware:
  //   hour  → 6 / 12 / 24
  //   day   → 10 / 30 / 60
  //   month → 6 / 12 / 24
  const row0 = (grain === "hour" || grain === "month")
    ? [
        { id: "rolling-6",  label: "6",  row: 0, getFrame: () => ({ count: 6,  mode: "rolling" }) },
        { id: "rolling-12", label: "12", row: 0, getFrame: () => ({ count: 12, mode: "rolling" }) },
        { id: "rolling-24", label: "24", row: 0, getFrame: () => ({ count: 24, mode: "rolling" }) },
      ]
    : [
        { id: "rolling-10", label: "10", row: 0, getFrame: () => ({ count: 10, mode: "rolling" }) },
        { id: "rolling-30", label: "30", row: 0, getFrame: () => ({ count: 30, mode: "rolling" }) },
        { id: "rolling-60", label: "60", row: 0, getFrame: () => ({ count: 60, mode: "rolling" }) },
      ];

  // Row 1 "natural language" presets compute their bucket count from
  // the current clock (window.MGT_DATA._NOW) so the chart always shows
  // the EXACT range each label promises — e.g. "Hôm qua đến nay" at
  // 15:00 means yesterday 00:00 → today 15:00 = 40 hourly buckets.
  const D = window.MGT_DATA;
  const NOW = D._NOW;

  if (grain === "hour") {
    return [
      ...row0,
      { id: "today",     label: "Hôm nay",            row: 1,
        getFrame: () => ({ count: NOW.getHours() + 1, mode: "rolling" }) },
      { id: "yday-now",  label: "Hôm qua đến nay",    row: 1,
        getFrame: () => ({ count: 24 + NOW.getHours() + 1, mode: "rolling" }) },
      { id: "yday2-now", label: "Hôm kia đến nay",    row: 1,
        getFrame: () => ({ count: 48 + NOW.getHours() + 1, mode: "rolling" }) },
    ];
  }
  if (grain === "month") {
    return [
      ...row0,
      { id: "thisYear",  label: "Năm nay",              row: 1,
        getFrame: () => ({ count: NOW.getMonth() + 1, mode: "rolling" }) },
      { id: "lastYear",  label: "Năm trước đến nay",    row: 1,
        getFrame: () => ({ count: 12 + NOW.getMonth() + 1, mode: "rolling" }) },
      { id: "allYears",  label: "Toàn bộ các năm",      row: 1,
        getFrame: () => {
          const first = new Date(D.firstRecordMs());
          const months = (NOW.getFullYear() - first.getFullYear()) * 12
                       + (NOW.getMonth()    - first.getMonth()) + 1;
          return { count: months, mode: "rolling" };
        } },
    ];
  }
  // grain === "day"
  return [
    ...row0,
    { id: "lastWeek",   label: "Tuần trước đến nay",    row: 1,
      getFrame: () => {
        // ISO Monday-start. Sat → 5, Sun → 6, …, Mon → 0.
        const dow = NOW.getDay() === 0 ? 6 : NOW.getDay() - 1;
        // Days from Monday last week through today (inclusive).
        return { count: dow + 8, mode: "rolling" };
      } },
    { id: "thisMonth",  label: "Tháng này",              row: 1,
      getFrame: () => ({ count: NOW.getDate(), mode: "rolling" }) },
    { id: "lastMonth",  label: "Tháng trước đến nay",    row: 1,
      getFrame: () => {
        const lastMonthStart = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1);
        const days = Math.floor((NOW - lastMonthStart) / 86400000) + 1;
        return { count: days, mode: "rolling" };
      } },
  ];
}

// useTimeFrame — owns (grain, preset, customRange) and resolves to (count, mode).
// When grain flips, the preset is reset if it isn't valid for the new grain.
function useTimeFrame(initial = "rolling-30") {
  const [grain, setGrain] = React.useState("day");
  const [preset, setPreset] = React.useState(initial);
  const [customRange, setCustomRange] = React.useState(null);

  React.useEffect(() => {
    const list = presetsForGrain(grain);
    if (!list.find(p => p.id === preset)) {
      // Default to the second pill in row 0 (10/30/60 → 30; 6/12/24 → 12).
      setPreset(list[1].id);
    }
  }, [grain]); // eslint-disable-line

  const presets = presetsForGrain(grain);
  const active  = presets.find(p => p.id === preset) || presets[1];

  // Custom-range bucket count is grain-aware: hours / days / months
  // depending on the active unit (was always days before — caused month
  // grain + custom range to produce hundreds of monthly buckets).
  function customCount(range, gr) {
    if (gr === "hour")  return Math.max(1, Math.ceil((range.end - range.start) / 3_600_000));
    if (gr === "month") return Math.max(1,
      (range.end.getFullYear() - range.start.getFullYear()) * 12
      + (range.end.getMonth() - range.start.getMonth()) + 1);
    return Math.max(1, Math.round((range.end - range.start) / 86_400_000) + 1);
  }
  const frame = customRange
    ? { count: customCount(customRange, grain), mode: "rolling" }
    : active.getFrame(grain);

  // Heading suffix for the chart. Row-0 presets are anonymous numbers
  // ("rolling 30") — leave the heading as "N units gần nhất". Row-1
  // presets and custom ranges have a human label ("Tháng này",
  // "Tùy chỉnh") that should appear instead.
  const frameLabel = customRange
    ? "Tùy chỉnh"
    : (active.row === 1 ? active.label : null);

  return {
    grain, setGrain, preset, setPreset, customRange, setCustomRange,
    count: frame.count, mode: frame.mode, presets, frameLabel,
  };
}

// ====================================================================
// SECTION 1 — Tổng (cumulative)
// ====================================================================
function SectionTong() {
  const tf = useTimeFrame();
  const { grain, count, mode, frameLabel } = tf;

  const D = window.MGT_DATA;
  const revCum = D.revenueCumulative(grain, count, mode);
  const stuCum = D.studentCumulative(grain, count, mode);
  // Per-bucket buckets (NOT cumulative) — used for "mốc hiện tại" KPI deltas
  const revBkt = D.revenueBuckets(grain, count, null, mode);
  const stuBkt = D.studentBuckets(grain, count, null, mode);

  const revTongCumulative   = revCum[revCum.length - 1]?.tong || 0;
  const revCurrentIncrement = revBkt[revBkt.length - 1]?.daNhan || 0;
  const stuTongCumulative   = stuCum[stuCum.length - 1]?.tong || 0;
  const stuCurrentIncrement = stuBkt[stuBkt.length - 1]?.tong || 0;

  const currentNodeLabel = grain === "hour" ? "giờ này" : grain === "day" ? "hôm nay" : "tháng này";

  return (
    <>
      <SectionHeader title="Tổng"
                     info="Các giá trị cộng dồn xuyên suốt một khung thời gian. Thể hiện tốc độ tích lũy."
                     right={<TimeFrameControls {...tf}/>}/>

      {/* 4 mini KPIs: big total + current-node increment */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <TongKpi label="Doanh thu · cộng dồn"   value={window.fmtVND(revTongCumulative)}   big color="lime"/>
        <TongKpi label={`Doanh thu · ${currentNodeLabel}`}  value={`+${window.fmtVND(revCurrentIncrement)}`}  color="lime" dim/>
        <TongKpi label="Học viên · cộng dồn"     value={stuTongCumulative}                   big color="cyan"/>
        <TongKpi label={`Học viên · ${currentNodeLabel}`}    value={`+${stuCurrentIncrement}`}              color="cyan" dim/>
      </div>

      {/* 2 cumulative line charts — clicking a card expands it to full width.
          Click again (or click the other card) to swap focus. */}
      <ExpandableChartGrid charts={[
        { key: "revenue",  node: (exp, tog, prev, setPrev, pos) => <CumChart kind="revenue"  data={revCum} grain={grain} frameLabel={frameLabel} expanded={exp} onToggle={tog} previewing={prev} setPreviewing={setPrev} position={pos}/> },
        { key: "students", node: (exp, tog, prev, setPrev, pos) => <CumChart kind="students" data={stuCum} grain={grain} frameLabel={frameLabel} expanded={exp} onToggle={tog} previewing={prev} setPreviewing={setPrev} position={pos}/> },
      ]}/>
    </>
  );
}

// --------------------------------------------------------------------
// ExpandableChartGrid — host for two small chart cards. Either card can
// be promoted to a full-width "large" card by clicking it; clicking it
// again restores the side-by-side 1fr 1fr layout. Click bubbling is
// suppressed when the click target is inside a text element so users
// can still highlight & copy values without triggering expansion.
// --------------------------------------------------------------------
function ExpandableChartGrid({ charts }) {
  // Single bool — both cards in the section expand & collapse together
  // regardless of which one is clicked. This keeps the choreography
  // simple (left grows right, right slides down) and the layout state
  // unambiguous.
  const [expanded, setExpanded] = React.useState(false);
  // When ANY hitbox is hovered, both cards preview-slide rightward —
  // visual hint that "zoom-in" intent is being recognised.
  const [previewing, setPreviewing] = React.useState(false);
  const toggle = () => setExpanded(prev => !prev);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {charts.map((c, i) => React.cloneElement(
        c.node(expanded, toggle, previewing, setPreviewing, i === 0 ? "left" : "right"),
        { key: c.key }
      ))}
    </div>
  );
}

// Hook returning the grid-cell + hover-translate style for an
// expandable chart card. Cursor is intentionally NOT overridden so
// text-bearing children get the browser's I-beam (users can select +
// copy values) — only the ChartHitbox overlay carries the zoom cursor.
function useExpandable(expanded, previewing) {
  return {
    style: {
      gridColumn: expanded ? "1 / -1" : "auto",
      position: "relative",          // anchor for the absolute hitbox
      transform: previewing && !expanded ? "translateX(8px)" : "translateX(0)",
      transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
    },
  };
}

// ChartHitbox — large transparent zoom-affordance overlay covering the
// top-right of a chart card. Sized big to make zoom-out comfortable on
// small displays; doesn't overlap the heading (we reserve matching
// space in the header layout). The card body stays click-passive so
// text remains selectable.
function ChartHitbox({ expanded, onToggle, setPreviewing }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      onMouseEnter={() => setPreviewing(true)}
      onMouseLeave={() => setPreviewing(false)}
      onFocus={() => setPreviewing(true)}
      onBlur={() => setPreviewing(false)}
      title={expanded ? "Thu nhỏ biểu đồ" : "Phóng to biểu đồ"}
      aria-label={expanded ? "Thu nhỏ biểu đồ" : "Phóng to biểu đồ"}
      style={{
        position: "absolute", top: 0, right: 0,
        width: "50%", height: 80, padding: 0,
        background: "transparent", border: "none",
        cursor: expanded ? "zoom-out" : "zoom-in",
        zIndex: 5,
      }}
    />
  );
}

// Hook that triggers a one-shot expand/collapse keyframe animation on
// the chart card whenever its `expanded` state flips. Different
// keyframes per `position` so left and right cards animate to their
// distinct destinations simultaneously.
//
// Collapse-left is special: it uses a paired transform (outer scales
// up, inner content inverse-scales) to visually retract the card's
// right + bottom edges WITHOUT translating the card or stretching its
// text. The hook returns both refs so the caller can wire the inner
// wrapper.
function useExpansionAnim(expanded, position) {
  const ref = React.useRef(null);
  const contentRef = React.useRef(null);
  const prev = React.useRef(expanded);
  React.useEffect(() => {
    if (prev.current !== expanded && ref.current) {
      const name = expanded
        ? (position === "right" ? "mgt-chart-expand-right"   : "mgt-chart-expand-left")
        : (position === "right" ? "mgt-chart-collapse-right" : "mgt-chart-collapse-left");
      const el = ref.current;
      el.style.animation = "none";
      void el.offsetWidth;   // force reflow so the animation restarts
      el.style.animation = `${name} 420ms cubic-bezier(0.4, 0, 0.2, 1) both`;

      // Pair the outer scale with an inverse scale on the inner
      // content wrapper, but ONLY for collapse-left. All other states
      // leave the inner wrapper untransformed.
      if (contentRef.current) {
        const inner = contentRef.current;
        if (!expanded && position === "left") {
          inner.style.animation = "none";
          void inner.offsetWidth;
          inner.style.animation = `mgt-chart-collapse-left-inner 420ms cubic-bezier(0.4, 0, 0.2, 1) both`;
        } else {
          inner.style.animation = "";
        }
      }
    }
    prev.current = expanded;
  }, [expanded, position]);
  return { ref, contentRef };
}

function TongKpi({ label, value, color, big, dim }) {
  const c = `var(--neon-${color})`;
  return (
    <GlassCard padding={16}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: big ? 30 : 22, lineHeight: 1,
          color: dim ? "var(--fg-2)" : c, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
          textShadow: big && !dim ? `0 0 24px color-mix(in oklab, ${c} 30%, transparent)` : "none",
        }}>{value}</span>
      </div>
    </GlassCard>
  );
}

function CumChart({ kind, data, grain, frameLabel, expanded, onToggle, previewing, setPreviewing, position }) {
  const [hidden, setHidden] = React.useState(new Set());
  const toggle = (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); setHidden(n); };
  const labels = data.map(d => d.label);
  const exp = useExpandable(expanded, previewing);
  const { ref: animRef, contentRef } = useExpansionAnim(expanded, position);
  const cc = useChartColors();
  // When expanded, give the LineChart a wider aspect (matches SoSanhChart).
  const chartW = expanded ? 1100 : 720;
  const chartH = expanded ? 300  : 240;
  // Heading driven by grain prop (NOT inferred from label shape — "29/05"
  // and "05/26" both match the day pattern, mislabeling month-grain charts).
  // frameLabel is set for row-1 presets ("Tháng này") and custom ranges;
  // otherwise we use the generic "N units gần nhất" form.
  const unit = grain === "hour" ? "giờ" : grain === "month" ? "tháng" : "ngày";
  const heading = frameLabel
    ? `${frameLabel} · ${data.length} ${unit}`
    : `${data.length} ${unit} gần nhất`;

  if (kind === "revenue") {
    const series = [
      { id: "tong",  label: "Tổng",    color: cc.cyan, bold: true, fill: true,         data: data.map(d => d.tong) },
      { id: "daN",   label: "Đã nhận", color: cc.lime,                                  data: data.map(d => d.daNhan) },
      { id: "conN",  label: "Còn nợ",  color: cc.pink, dashed: true,                    data: data.map(d => d.conNo) },
    ];
    return (
      <div style={exp.style}>
        <ChartHitbox expanded={expanded} onToggle={onToggle} setPreviewing={setPreviewing}/>
        <div ref={animRef} style={{ transformOrigin: "top left" }}>
          <GlassCard padding={14}>
            <div ref={contentRef} style={{ transformOrigin: "top left", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>DOANH THU · CỘNG DỒN</span>
                  <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{heading}</h3>
                </div>
              </div>
              <ToggleLegend items={series} hidden={hidden} onToggle={toggle}/>
              <LineChart width={chartW} height={chartH} xLabels={labels} series={series} hidden={hidden}
                         yFmt={(v) => v >= 1e9 ? (v/1e9).toFixed(1)+"B" : v >= 1e6 ? Math.round(v/1e6)+"M" : v >= 1e3 ? Math.round(v/1e3)+"k" : v}
                         tipFmt={(v) => window.fmtVND(v)}/>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }
  const series = [
    { id: "tong",  label: "Tổng", color: cc.cyan,   bold: true, fill: true,  data: data.map(d => d.tong) },
    { id: "A",     label: "A",    color: cc.violet,                            data: data.map(d => d.A) },
    { id: "A1",    label: "A1",   color: cc.amber,                             data: data.map(d => d.A1) },
  ];
  return (
    <div style={exp.style}>
      <ChartHitbox expanded={expanded} onToggle={onToggle} setPreviewing={setPreviewing}/>
      <div ref={animRef} style={{ transformOrigin: "top left" }}>
        <GlassCard padding={14}>
          <div ref={contentRef} style={{ transformOrigin: "top left", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>HỌC VIÊN · CỘNG DỒN</span>
                <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{heading}</h3>
              </div>
            </div>
            <ToggleLegend items={series} hidden={hidden} onToggle={toggle}/>
            <LineChart width={chartW} height={chartH} xLabels={labels} series={series} hidden={hidden}
                       yFmt={(v) => Math.round(v).toString()}
                       tipFmt={(v) => `${v} HV`}/>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ====================================================================
// SECTION 2 — Biến động (per-bucket, NOT cumulative)
// ====================================================================
function SectionBienDong() {
  const tf = useTimeFrame();
  return (
    <>
      <SectionHeader title="Biến động"
                     info="Mỗi mốc thời gian có một giá trị mới phát sinh. Thể hiện nhịp độ hoạt động."
                     right={<TimeFrameControls {...tf}/>}/>
      <ExpandableChartGrid charts={[
        { key: "revenue",  node: (exp, tog, prev, setPrev, pos) => <BienDongChart kind="revenue"  grain={tf.grain} count={tf.count} mode={tf.mode} expanded={exp} onToggle={tog} previewing={prev} setPreviewing={setPrev} position={pos}/> },
        { key: "students", node: (exp, tog, prev, setPrev, pos) => <BienDongChart kind="students" grain={tf.grain} count={tf.count} mode={tf.mode} expanded={exp} onToggle={tog} previewing={prev} setPreviewing={setPrev} position={pos}/> },
      ]}/>
    </>
  );
}

function BienDongChart({ kind, grain, count, mode, expanded, onToggle, previewing, setPreviewing, position }) {
  const [hidden, setHidden] = React.useState(new Set());
  const toggle = (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); setHidden(n); };
  const exp = useExpandable(expanded, previewing);
  const { ref: animRef, contentRef } = useExpansionAnim(expanded, position);
  const cc = useChartColors();
  const chartW = expanded ? 1100 : 720;
  const chartH = expanded ? 300  : 240;

  const D = window.MGT_DATA;
  const buckets = kind === "revenue"
    ? D.revenueBuckets(grain, count, null, mode)
    : D.studentBuckets(grain, count, null, mode);
  const labels = buckets.map(b => b.label);

  const series = kind === "revenue" ? [
    { id: "tong",  label: "Tổng",    color: cc.cyan, bold: true, fill: true,         data: buckets.map(b => b.tong) },
    { id: "daN",   label: "Đã nhận", color: cc.lime,                                  data: buckets.map(b => b.daNhan) },
    { id: "conN",  label: "Còn nợ",  color: cc.pink, dashed: true,                    data: buckets.map(b => b.conNo) },
  ] : [
    { id: "tong",  label: "Tổng", color: cc.cyan,   bold: true, fill: true,  data: buckets.map(b => b.tong) },
    { id: "A",     label: "A",    color: cc.violet,                            data: buckets.map(b => b.A) },
    { id: "A1",    label: "A1",   color: cc.amber,                             data: buckets.map(b => b.A1) },
  ];

  return (
    <div style={exp.style}>
      <ChartHitbox expanded={expanded} onToggle={onToggle} setPreviewing={setPreviewing}/>
      <div ref={animRef} style={{ transformOrigin: "top left" }}>
        <GlassCard padding={14}>
          <div ref={contentRef} style={{ transformOrigin: "top left", display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{kind === "revenue" ? "DOANH THU" : "HỌC VIÊN MỚI"}</span>
              <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>Biến động theo {grain === "hour" ? "giờ" : grain === "day" ? "ngày" : "tháng"}</h3>
            </div>
            <ToggleLegend items={series} hidden={hidden} onToggle={toggle}/>
            <LineChart width={chartW} height={chartH} xLabels={labels} series={series} hidden={hidden}
                       yFmt={kind === "revenue"
                         ? (v) => v >= 1e6 ? Math.round(v/1e6)+"M" : v >= 1e3 ? Math.round(v/1e3)+"k" : v
                         : (v) => Math.round(v).toString()}
                       tipFmt={kind === "revenue" ? (v) => window.fmtVND(v) : (v) => `${v} HV`}/>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// CompactGroupedLegend — used by SectionSoSanh's two charts.
//   9 series arranged in a 3×3 grid: rows = metric, columns = branch.
//   No pill chrome — just colored line + branch short name. Click any
//   cell to hide/un-hide that series (the cell greys out).
// --------------------------------------------------------------------
function CompactGroupedLegend({ branches, metrics, seriesById, hidden, onToggle }) {
  // branches: [{ id, shortName }]
  // metrics:  [{ id: metricId, label }]   — 3 rows, top→bottom
  // seriesById: lookup `${branchId}-${metricId}` → series row, used for color/dashed
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(86px, max-content) repeat(3, minmax(112px, 1fr))",
      rowGap: 6, columnGap: 18,
      alignItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
    }}>
      {/* Branch column headers eliminated — each cell already shows the
          branch short name, so the separate header row was redundant. */}
      {metrics.map(m => (
        <React.Fragment key={m.id}>
          {/* Row label — the metric */}
          <span style={{ color: "var(--fg-3)", fontWeight: 600 }}>{m.label}</span>
          {branches.map(b => {
            const id = `${b.id}-${m.id}`;
            const s = seriesById[id];
            if (!s) return <span key={id}></span>;
            const isHidden = hidden.has(id);
            const c = isHidden ? "var(--fg-4)" : s.color;
            return (
              <button key={id} onClick={() => onToggle(id)} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "4px 0", border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left", lineHeight: 1,
                opacity: isHidden ? 0.45 : 1,
                color: isHidden ? "var(--fg-4)" : "var(--fg-1)",
                transition: "opacity 140ms var(--ease-out), color 140ms var(--ease-out)",
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                fontWeight: 600,
              }}>
                <span style={{
                  width: 22, height: s.dashed ? 0 : 2,
                  borderTop: s.dashed ? `2px dashed ${c}` : "none",
                  background: s.dashed ? "transparent" : c,
                  boxShadow: isHidden || s.dashed ? "none" : `0 0 6px ${c}`,
                  flexShrink: 0,
                }}></span>
                {b.shortName}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// Map full branch name → short token used in SectionSoSanh legend
function branchShort(name) {
  return name.split(" ")[0];
}

// ====================================================================
// SECTION 3 — So sánh (3 branches overlaid, full-width charts stacked)
// ====================================================================
function SectionSoSanh() {
  const tf = useTimeFrame();
  return (
    <>
      <SectionHeader title="So sánh"
                     info="So sánh biến động của từng chi nhánh. Cả ba chi nhánh chồng lên cùng một bảng biểu."
                     right={<TimeFrameControls {...tf}/>}/>
      <SoSanhChart kind="revenue"  grain={tf.grain} count={tf.count} mode={tf.mode}/>
      <SoSanhChart kind="students" grain={tf.grain} count={tf.count} mode={tf.mode}/>
    </>
  );
}

function SoSanhChart({ kind, grain, count, mode }) {
  const [hidden, setHidden] = React.useState(new Set());
  const toggle = (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); setHidden(n); };

  const D = window.MGT_DATA;

  // Series rows are constructed branch-major, but addressed by `${branchId}-${metricId}`
  // so the legend can lay them out as a grid (rows=metric, cols=branch).
  const series = [];
  const seriesById = {};
  const metricsCfg = kind === "revenue"
    ? [{ id: "tong", label: "Tổng", tone: 0, bold: true,  dashed: false },
       { id: "daN",  label: "Đã nhận", tone: 1, bold: false, dashed: false },
       { id: "conN", label: "Còn nợ",  tone: 2, bold: false, dashed: true }]
    : [{ id: "tong", label: "Tổng", tone: 0, bold: true,  dashed: false },
       { id: "A",    label: "A",    tone: 1, bold: false, dashed: false },
       { id: "A1",   label: "A1",   tone: 2, bold: false, dashed: true }];

  const _tonesMap = useBranchTones();
  const _isDark = _tonesMap === BRANCH_TONES;
  D.branches.forEach((b) => {
    const tones = _tonesFor(_tonesMap, _isDark ? _BRANCH_FALLBACK_DARK : _BRANCH_FALLBACK_LIGHT, b.id).tones;
    const buckets = kind === "revenue"
      ? D.revenueBuckets(grain, count, b.id, mode)
      : D.studentBuckets(grain, count, b.id, mode);
    metricsCfg.forEach(m => {
      const dataKey = kind === "revenue"
        ? (m.id === "tong" ? "tong" : m.id === "daN" ? "daNhan" : "conNo")
        : (m.id === "tong" ? "tong" : m.id);
      const row = {
        id: `${b.id}-${m.id}`,
        label: `${b.name} · ${m.label}`,
        color: tones[m.tone],
        bold: m.bold,
        dashed: m.dashed,
        data: buckets.map(x => x[dataKey]),
      };
      series.push(row);
      seriesById[row.id] = row;
    });
  });

  const labels = (kind === "revenue" ? D.revenueBuckets(grain, count, null, mode) : D.studentBuckets(grain, count, null, mode)).map(x => x.label);
  const branchesShort = D.branches.map(b => ({ id: b.id, shortName: branchShort(b.name) }));

  return (
    <GlassCard padding={14}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{kind === "revenue" ? "DOANH THU" : "HỌC VIÊN MỚI"} · 3 CHI NHÁNH</span>
            <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>So sánh theo {grain === "hour" ? "giờ" : grain === "day" ? "ngày" : "tháng"}</h3>
          </div>
          <CompactGroupedLegend
            branches={branchesShort}
            metrics={metricsCfg.map(m => ({ id: m.id, label: m.label }))}
            seriesById={seriesById}
            hidden={hidden}
            onToggle={toggle}/>
        </div>
        <LineChart xLabels={labels} series={series} hidden={hidden} allowFill={false} width={1100} height={300}
                   yFmt={kind === "revenue"
                     ? (v) => v >= 1e6 ? Math.round(v/1e6)+"M" : v >= 1e3 ? Math.round(v/1e3)+"k" : v
                     : (v) => Math.round(v).toString()}
                   tipFmt={kind === "revenue" ? (v) => window.fmtVND(v) : (v) => `${v} HV`}/>
      </div>
    </GlassCard>
  );
}

// ====================================================================
// SECTION 4 — Hiệu suất (full-width branch performance bar charts)
// ====================================================================
function SectionHieuSuat() {
  const D = window.MGT_DATA;
  const rows = D.branchPerformance();
  const [view, setView] = React.useState("branch"); // default = theo chi nhánh
  // Single bool — clicking any branch row in "Theo chi nhánh" swaps
  // ALL THREE rows together between bars and enlarged-number form.
  const [bigNumbers, setBigNumbers] = React.useState(false);
  const toggle = () => setBigNumbers(prev => !prev);

  // Per-metric semantic color — matches the dashboard's established
  // vocabulary (revenue green, outstanding red, etc).
  const metrics = [
    { id: "revenue",     label: "Doanh thu",                       accessor: (r) => r.revenue,                                              kind: "money", color: "var(--neon-lime)" },
    { id: "outstanding", label: "Còn nợ",                          accessor: (r) => r.outstanding,                                          kind: "money", color: "var(--neon-pink)" },
    { id: "students",    label: "Học viên",                        accessor: (r) => r.students,                                              kind: "count", color: "var(--neon-cyan)" },
    { id: "paidNow",     label: "Tỉ lệ thanh toán đủ ngay",        accessor: (r) => r.students ? r.paidImmediately / r.students : 0,         kind: "rate",  color: "var(--fg-1)"      },
    { id: "paidToDate",  label: "Tỉ lệ thanh toán đủ đến nay",     accessor: (r) => r.students ? r.paidFull / r.students : 0,                kind: "rate",  color: "var(--fg-1)"      },
  ];

  return (
    <>
      <SectionHeader title="Hiệu suất"
                     info="So sánh sức khỏe kinh doanh của ba chi nhánh, theo năm tiêu chí. Đối với mỗi tiêu chí, giá trị lớn nhất được thể hiện với kích thước tối đa."
                     right={
                       <PillTabs value={view} onChange={setView} tabs={[
                         { id: "branch", label: "Theo chi nhánh" },
                         { id: "metric", label: "Theo chỉ số"    },
                       ]}/>
                     }/>
      <GlassCard padding={22}>
        {view === "metric" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {metrics.map(m => <PerformanceBarRow key={m.id} metric={m} rows={rows}/>)}
          </div>
        ) : (
          /* Full-card hitbox — anywhere inside the "Theo chi nhánh"
             card toggles all three rows between bars and enlarged
             numbers. Rows themselves no longer handle clicks. */
          <div onClick={toggle}
               title={bigNumbers ? "Hiển thị thanh" : "Hiển thị số lớn"}
               style={{
                 display: "flex", flexDirection: "column", gap: 24,
                 cursor: "pointer",
               }}>
            {rows.map(r => (
              <BranchMetricsRow key={r.branchId} branch={r} metrics={metrics} allRows={rows}
                                expanded={bigNumbers}/>
            ))}
          </div>
        )}
      </GlassCard>
    </>
  );
}

// Format a metric's raw value for display. `mono=true` flips the
// money formatter to single-color (inherits from parent) — used by
// the enlarged-number form where the whole number takes a semantic
// color, not the dim-decimal default.
function fmtMetric(v, kind, mono = false) {
  if (kind === "money") return <TrieuValue n={v} mono={mono}/>;
  if (kind === "rate")  return `${(v * 100).toFixed(1)}%`;
  return v.toLocaleString("en-US");
}

function BranchMetricsRow({ branch, metrics, allRows, expanded }) {
  const _tm = useBranchTones();
  const _dark = _tm === BRANCH_TONES;
  const tone = _tonesFor(_tm, _dark ? _BRANCH_FALLBACK_DARK : _BRANCH_FALLBACK_LIGHT, branch.branchId).tones[0];
  // Per-metric max across all branches → normalize within each metric
  const maxByMetric = {};
  metrics.forEach(m => { maxByMetric[m.id] = Math.max(0.0001, ...allRows.map(r => m.accessor(r))); });

  // Row is non-interactive — the parent GlassCard owns the click.
  // We still draw the chevron in the header to hint the toggle state.
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 12,
      transition: "opacity 140ms var(--ease-out)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: tone, boxShadow: `0 0 8px ${tone}` }}/>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>{branch.name}</span>
        <span style={{ flex: 1, height: 1, background: "var(--ink-4)" }}></span>
        <Icon name="arrow-down" size={14}
              color="var(--fg-3)"
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 220ms var(--ease-out)",
              }}/>
      </div>

      {/* Enlarged-number form (expanded) — sized to occupy the same
          vertical height as a bars row (eyebrow + 16-tall bar + value
          with 6+6 gaps ≈ 60px). Each cell uses minHeight + space-between
          so the eyebrow pins to top and the big number pins to bottom,
          and the surrounding card height is identical in both states. */}
      {expanded ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 14 }}>
          {metrics.map(m => {
            const v = m.accessor(branch);
            const c = m.color || tone;
            return (
              <div key={m.id} style={{
                display: "flex", flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 60,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
                <span style={{
                  fontFamily: "var(--font-display)", fontWeight: 600,
                  fontSize: m.kind === "money" ? 30 : 38, lineHeight: 1,
                  color: c,
                  textShadow: `0 0 18px color-mix(in oklab, ${c} 30%, transparent)`,
                  fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em",
                  whiteSpace: "nowrap",
                }}>
                  {fmtMetric(v, m.kind, true)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 14 }}>
          {metrics.map(m => {
            const v = m.accessor(branch);
            const pct = (v / maxByMetric[m.id]) * 100;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>
                <div style={{ position: "relative", height: 16, background: "var(--ink-3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", background: tone,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone} 80%, white)`,
                    transition: "width 360ms var(--ease-out)",
                  }}/>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtMetric(v, m.kind)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerformanceBarRow({ metric, rows }) {
  const max = Math.max(0.0001, ...rows.map(r => metric.accessor(r)));
  const _btm = useBranchTones();
  const _btDark = _btm === BRANCH_TONES;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{metric.label}</span>
        <span style={{ flex: 1, height: 1, background: "var(--ink-4)" }}></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(r => {
          const v = metric.accessor(r);
          const pct = (v / max) * 100;
          const tone = _tonesFor(_btm, _btDark ? _BRANCH_FALLBACK_DARK : _BRANCH_FALLBACK_LIGHT, r.branchId).tones[0];
          return (
            <div key={r.branchId} style={{ display: "grid", gridTemplateColumns: "160px 1fr 200px", gap: 14, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{r.name}</span>
              <div style={{ position: "relative", height: 22, background: "var(--ink-3)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: tone,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone} 80%, white)`,
                  transition: "width 360ms var(--ease-out)",
                }}/>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--fg-1)", fontWeight: 600, fontSize: 14 }}>
                {fmtMetric(v, metric.kind)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "1,100.95 triệu" — by default the decimal portion is dimmed
// (fg-3) for the dashboard's bar/inline reading. Pass `mono` to make
// the entire number inherit the parent's color, used when the value
// itself is already tinted with a semantic color (e.g. revenue green
// in the enlarged-number form) and dimming would feel inconsistent.
function TrieuValue({ n, mono = false }) {
  const triệu = n / 1000000;
  const fixed = triệu.toFixed(2); // e.g. "1100.95"
  const [intPart, decPart] = fixed.split(".");
  const withSep = parseInt(intPart, 10).toLocaleString("en-US");
  const intColor  = mono ? "currentColor" : "var(--fg-1)";
  const decColor  = mono ? "currentColor" : "var(--fg-3)";
  // The "triệu" unit always reads as plain text (fg-1) so it doesn't
  // pull a semantic color (lime / pink) when used in the enlarged
  // number form — the digits carry the meaning, the unit is neutral.
  const unitColor = "var(--fg-1)";
  return (
    <span>
      <span style={{ color: intColor }}>{withSep}</span>
      <span style={{ color: decColor }}>.{decPart}</span>
      <span style={{ color: unitColor, fontFamily: "var(--font-ui)", fontWeight: 500, marginLeft: 4 }}>triệu</span>
    </span>
  );
}

// KpiBig is referenced elsewhere — keep its export.
function KpiBig({ label, value, hint, color = "cyan", icon, index = 0 }) {
  const c = `var(--neon-${color})`;
  const cardRef  = React.useRef(null);
  const sheenRef = React.useRef(null);
  const chromaRef= React.useRef(null);
  const [hover, setHover] = React.useState(false);
  const targetRef = React.useRef({ x: 50, y: 30 });
  const posRef    = React.useRef({ x: 50, y: 30 });

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
        <div ref={sheenRef} style={{
          position: "absolute", inset: "-12%",
          pointerEvents: "none",
          opacity: hover ? 1 : 0,
          filter: "blur(28px) saturate(1.3)",
          mixBlendMode: "screen",
          transition: "opacity 380ms var(--ease-out)",
        }}/>
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

// ─── Customisable hero cards (Task 9) ───────────────────────────────────────
const _HERO_KEY = "mgt_hero_cards_v1";
const _DEFAULT_HEROES = ["today_revenue", "today_students", "total_debt", "active_students"];

// Catalog: 7 card types. compute(stats) → { value, hint }
const CARD_CATALOG = [
  { key: "today_revenue",   label: "Đã thu hôm nay",   color: "lime",   icon: "trending-up",
    compute: (s) => ({ value: window.fmtVND(s.todayRevenue),    hint: `${s.todayReceipts} biên lai` }) },
  { key: "today_students",  label: "HV mới hôm nay",   color: "cyan",   icon: "user-plus",
    compute: (s) => ({ value: s.newToday,                        hint: `đăng ký ${s.todayStr}` }) },
  { key: "total_debt",      label: "Tổng nợ",           color: "pink",   icon: "minus",
    compute: (s) => ({ value: window.fmtVND(s.outstanding),      hint: `${s.outstandingCount} học viên` }) },
  { key: "active_students", label: "Học viên active",   color: "violet", icon: "users",
    compute: (s) => ({ value: s.activeStudents,                  hint: `A: ${s.licA} · A1: ${s.licA1}` }) },
  { key: "total_students",  label: "Tổng học viên",     color: "cyan",   icon: "graduation",
    compute: (s) => ({ value: s.totalStudents,                   hint: "tất cả thời gian" }) },
  { key: "revenue_7d",      label: "Thu 7 ngày",        color: "lime",   icon: "chart",
    compute: (s) => ({ value: window.fmtVND(s.revenue7d),        hint: "7 ngày gần nhất" }) },
  { key: "passed_students",  label: "HV hoàn thành",           color: "amber",  icon: "check",
    compute: (s) => ({ value: s.passedStudents,   hint: "đã thi đỗ hoặc tốt nghiệp" }) },
  { key: "new_this_month",   label: "HV mới tháng này",        color: "cyan",   icon: "user-plus",
    compute: (s) => ({ value: s.newThisMonth,     hint: `tháng trước: ${s.newLastMonth} HV` }) },
  { key: "new_month_a",      label: "HV hạng A mới tháng này", color: "lime",   icon: "user-plus",
    compute: (s) => ({ value: s.newThisMonthA,    hint: `hạng A · tháng ${s.monthLabel}` }) },
  { key: "new_month_a1",     label: "HV hạng A1 mới tháng này", color: "violet", icon: "user-plus",
    compute: (s) => ({ value: s.newThisMonthA1,   hint: `hạng A1 · tháng ${s.monthLabel}` }) },
];
const _CATALOG_MAP = Object.fromEntries(CARD_CATALOG.map(c => [c.key, c]));

function _loadHeroSlots() {
  try {
    const saved = JSON.parse(localStorage.getItem(_HERO_KEY));
    if (Array.isArray(saved) && saved.length === 4 && saved.every(k => _CATALOG_MAP[k])) return saved;
  } catch {}
  return [..._DEFAULT_HEROES];
}

// Right-click context menu wrapper — catalog rendering lives in DashboardScreen
function ContextMenuKpi({ slotIndex, onSwap, children }) {
  const [menu, setMenu] = React.useState(null);

  const openMenu = (e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); };
  const closeMenu = () => setMenu(null);

  React.useEffect(() => {
    if (!menu) return;
    const h = () => closeMenu();
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [menu]);

  return (
    <div onContextMenu={openMenu} style={{ position: "relative" }}>
      {children}
      {menu && (
        <div style={{
          position: "fixed", top: menu.y, left: menu.x, zIndex: 100010,
          background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
          backdropFilter: "var(--glass-blur)", borderRadius: 10, padding: "4px 0",
          boxShadow: "var(--shadow-2)", minWidth: 140,
        }} onClick={(e) => e.stopPropagation()}>
          <div onClick={() => { closeMenu(); onSwap(slotIndex); }} style={{
            padding: "8px 14px", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-ui)",
            color: "var(--fg-1)", display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="edit" size={14}/> Thay thẻ
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  DashboardScreen, SectionTong, SectionBienDong, SectionSoSanh, SectionHieuSuat,
  LineChart, BucketControls, ToggleLegend, SectionHeader, KpiBig, TrieuValue, BRANCH_TONES,
  BranchMetricsRow, CARD_CATALOG,
});
