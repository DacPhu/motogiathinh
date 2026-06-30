// ====================================================================
// CtvCompetitionDialog — "e-sports podium" award screen for the top-3
// collaborators (CTV) of the month. Celebratory but on-brand with the
// neon-glass design system. All animation lives in the component-local
// <style> block (same pattern as BranchExpanded's mgt-roll-down).
//
// Data is GIVEN (never fetched/computed here). Shape:
//   { month, year, monthLabel,
//     podium: [ {rank, name, branch, count}, … ],   // 0–3 entries
//     rest:   [ {rank, name, branch, count}, … ],   // may be empty
//     totalCtv, totalProfiles }
// ====================================================================

// Locked rank palette — mirrors the Excel + backend. Champion (rank 1)
// is AMBER everywhere (gold), rank 2 LIME (silver), rank 3 CYAN (bronze).
// Only existing CSS tokens are referenced.
const CTV_RANK_TONE = {
  1: { c: "var(--neon-amber)", g: "var(--neon-amber-glow)", h: "var(--neon-amber-haze)", icon: "graduation",  label: "TOP 1" },
  2: { c: "var(--neon-lime)",  g: "var(--neon-lime-glow)",  h: "var(--neon-lime-haze)",  icon: "trending-up", label: "TOP 2" },
  3: { c: "var(--neon-cyan)",  g: "var(--neon-cyan-glow)",  h: "var(--neon-cyan-haze)",  icon: "trending-up", label: "TOP 3" },
};

// Avatar particle field: bright glitter/sparks that stream outward from the
// circle in even directions, looping continuously. Evenly-spaced angles + a
// little jitter give an organic spread; negative staggered delays mean some
// particles are always mid-flight, so the emission reads as a steady stream
// rather than a synchronized burst.
const CTV_PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.35;
  const dist = 30 + (i % 4) * 7;
  const duration = 2.2 + (i % 5) * 0.4;
  return {
    tx: Math.round(Math.cos(angle) * dist),
    ty: Math.round(Math.sin(angle) * dist),
    size: 2 + (i % 3),
    duration,
    delay: -(i / 16) * duration,
  };
});

// Full-viewport celebration confetti. Mounts a fixed, pointer-events:none
// layer over the whole screen (above the modal backdrop). Bursts in on
// open, loops continuously while shown, then fades + drifts down on close
// instead of vanishing abruptly — it stays mounted for one exit cycle
// after `show` flips false, then unmounts.
function CtvConfetti({ show }) {
  const [mounted, setMounted] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const timer = React.useRef(null);

  React.useEffect(() => {
    if (show) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setExiting(false);
      setMounted(true);
    } else if (mounted) {
      setExiting(true);
      timer.current = setTimeout(() => {
        setMounted(false); setExiting(false); timer.current = null;
      }, 5000);
    }
  }, [show]);

  // Clean up the pending exit timer on unmount.
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Deterministic-enough field generated once — stable across re-renders.
  // Negative delays seed pieces mid-flight so the whole screen is covered
  // the instant the layer mounts (reads as an immediate burst), and the
  // infinite loop keeps it lively afterwards.
  const pieces = React.useMemo(() => {
    const colors = ["var(--neon-amber)", "var(--neon-lime)", "var(--neon-cyan)", "var(--neon-pink)"];
    const arr = [];
    for (let i = 0; i < 84; i++) {
      const square = i % 3 === 0;
      const duration = 4.6 + Math.random() * 4.2;
      arr.push({
        left: Math.random() * 100,
        size: 6 + Math.random() * 8,
        square,
        color: colors[i % colors.length],
        delay: -(Math.random() * duration),
        duration,
        dx: Math.round(Math.random() * 140 - 70),
        spin: Math.round(Math.random() * 760 - 380),
      });
    }
    return arr;
  }, []);

  if (!mounted) return null;

  const node = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1001,
      pointerEvents: "none", overflow: "hidden",
      // Downward clip-path wipe: on open the layer is revealed top→bottom
      // (reads as confetti starting to fall from above), on close it's
      // clipped away top→bottom (the source stops, the tail keeps falling
      // out the bottom) — no flat fade.
      animation: exiting
        ? "ctv-confetti-out 5000ms linear both"
        : "ctv-confetti-in 5000ms linear both",
    }}>
      <style>{`
        @keyframes ctv-confetti-fall {
          0%   { transform: translate3d(0, -14vh, 0) rotate(0deg); opacity: 0; }
          9%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translate3d(var(--dx), 112vh, 0) rotate(var(--spin)); opacity: 0; }
        }
        @keyframes ctv-confetti-in {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0 0 0 0); }
        }
        @keyframes ctv-confetti-out {
          from { clip-path: inset(0 0 0 0); }
          to   { clip-path: inset(100% 0 0 0); }
        }
      `}</style>
      {pieces.map((p, i) => (
        <div key={i} className="ctv-confetti-piece" style={{
          position: "absolute",
          top: 0,
          left: `${p.left}%`,
          width: p.size, height: p.square ? p.size : Math.round(p.size * 0.55),
          background: p.color,
          borderRadius: p.square ? 2 : 999,
          opacity: 0.9,
          boxShadow: `0 0 6px ${p.color}`,
          "--dx": `${p.dx}px`,
          "--spin": `${p.spin}deg`,
          willChange: "transform, opacity",
          animation: `ctv-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
        }}/>
      ))}
    </div>
  );

  return ReactDOM.createPortal(node, document.body);
}

// One podium column. `entry` may be null → render a graceful empty slot.
// `place` (1|2|3) drives tone + height; rank 1 is tallest + center.
function CtvPodiumCard({ place, entry }) {
  const tone = CTV_RANK_TONE[place];
  const isFirst = place === 1;
  // Center column elevates; flank columns sit lower (classic podium).
  const lift = isFirst ? 0 : 26;
  const minH = isFirst ? 264 : 228;
  // Staggered entrance: center/champion lands first, flanks follow.
  const delay = isFirst ? 120 : place === 2 ? 340 : 560;

  if (!entry) {
    return (
      <div style={{ marginTop: lift, display: "flex", flexDirection: "column" }}>
        <div style={{
          minHeight: minH, borderRadius: 20, padding: 18,
          border: "1px dashed var(--glass-stroke-strong)",
          background: "var(--glass-1)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999,
            border: "1px dashed var(--glass-stroke-strong)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--fg-4)",
          }}>{place}</div>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-4)" }}>Chưa có</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: lift, display: "flex", flexDirection: "column" }}>
      {/* Bar-extension entrance: the card reveals upward from its base
          (clip-path wipe) with a firm, overshoot-free ease — reads like a
          leaderboard column rising into place. No spring, no bounce. */}
      <div style={{
        position: "relative", minHeight: minH, borderRadius: 20,
        padding: isFirst ? "20px 16px 18px" : "18px 14px 16px",
        background: `color-mix(in oklab, ${tone.c} 9%, var(--glass-2))`,
        border: `1px solid color-mix(in oklab, ${tone.c} 42%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in oklab, ${tone.c} 22%, transparent), 0 0 ${isFirst ? 40 : 24}px color-mix(in oklab, ${tone.g} ${isFirst ? 70 : 45}%, transparent), var(--shadow-2)`,
        backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        overflow: "hidden",
        animation: `ctv-grow-up 1120ms cubic-bezier(0.12, 1, 0.15, 1) ${delay}ms both`,
      }}>
        {/* Shimmer sweep — every card flashes, but the champion's is stronger
            and faster; the flanks get a slower, weaker pass. */}
        <div style={{
          position: "absolute", top: 0, left: "-60%", width: "60%", height: "100%",
          background: `linear-gradient(105deg, transparent, color-mix(in oklab, ${tone.c} ${isFirst ? 30 : 15}%, transparent), transparent)`,
          animation: `ctv-shimmer ${isFirst ? 2600 : 4400}ms var(--ease-in-out) ${isFirst ? 700 : 1100}ms infinite`,
          pointerEvents: "none",
        }}/>

        {/* Rank marker: crown for the champion, then a single clean tone
            pill carrying the TOP label (no redundant numeric disc). */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {isFirst && (
            <span style={{
              fontSize: 22, lineHeight: 1,
              filter: `drop-shadow(0 0 10px ${tone.g})`,
              animation: "ctv-bob 2400ms var(--ease-in-out) infinite",
            }}>👑</span>
          )}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
            padding: "3px 10px", borderRadius: 999, color: tone.c,
            background: `color-mix(in oklab, ${tone.c} 16%, transparent)`,
            border: `1px solid color-mix(in oklab, ${tone.c} 55%, transparent)`,
            boxShadow: `0 0 12px ${tone.g}`,
          }}>{tone.label}</span>
        </div>

        {/* Identity group: avatar + name read as one quiet block. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          {/* Avatar with a continuous outward particle stream — bright
              glitter/sparks fly out linearly in all directions and loop.
              A dim static aura sits behind for depth, kept low so the
              sparks read crisp against it (not washed out). */}
          <div style={{
            position: "relative", display: "grid", placeItems: "center",
            width: isFirst ? 70 : 58, height: isFirst ? 70 : 58,
          }}>
            <span style={{
              position: "absolute", width: "70%", height: "70%", borderRadius: 999,
              background: `radial-gradient(circle, ${tone.g} 0%, transparent 70%)`,
              opacity: 0.4, pointerEvents: "none",
            }}/>
            {CTV_PARTICLES.map((pt, pi) => (
              <span key={pi} style={{
                position: "absolute", width: pt.size, height: pt.size, borderRadius: 999,
                background: tone.c,
                boxShadow: `0 0 ${pt.size + 3}px ${tone.c}`,
                "--ptx": `${pt.tx}px`, "--pty": `${pt.ty}px`,
                animation: `ctv-spark ${pt.duration}s linear ${pt.delay}s infinite`,
                pointerEvents: "none", willChange: "transform, opacity",
              }}/>
            ))}
            <div style={{
              position: "relative", borderRadius: 999, padding: 3,
              background: `color-mix(in oklab, ${tone.c} 18%, transparent)`,
              boxShadow: `0 0 14px ${tone.g}`,
            }}>
              <Avatar name={entry.name} size={isFirst ? 64 : 52}/>
            </div>
          </div>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 600,
            fontSize: isFirst ? 17 : 15, color: "var(--fg-1)",
            letterSpacing: "-0.015em", textAlign: "center", lineHeight: 1.2,
          }}>{entry.name}</span>
        </div>

        {/* Breathing room where the branch line used to sit — gives the
            card vertical room so name and hero number aren't cramped. */}
        <div style={{ height: isFirst ? 22 : 18, flexShrink: 0 }} aria-hidden="true"/>

        {/* Hero metric — anchored to the base, the loudest thing on the card. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, marginTop: "auto" }}>
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 600,
            fontSize: isFirst ? 42 : 33, lineHeight: 1, color: tone.c,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em",
            textShadow: `0 0 18px ${tone.g}`,
          }}>
            <CountUp value={entry.count} duration={900} fmt={(n) => n.toLocaleString("vi-VN")}/>
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "var(--fg-3)",
          }}>hồ sơ</span>
        </div>
      </div>
    </div>
  );
}

// Compact rank 4+ row.
function CtvRestRow({ entry, last }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "40px 1fr auto",
      alignItems: "center", gap: 12, padding: "10px 14px",
      borderBottom: last ? "none" : "1px solid var(--ink-4)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
        color: "var(--fg-3)", fontVariantNumeric: "tabular-nums",
      }}>#{entry.rank}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar name={entry.name} size={28}/>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{entry.name}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{entry.branch}</span>
        </div>
      </div>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
        color: "var(--fg-1)", fontVariantNumeric: "tabular-nums",
      }}>{entry.count} hồ sơ</span>
    </div>
  );
}

function CtvCompetitionDialog({ open, onClose, data, loading, onDownload, onRefresh }) {
  const [downloading, setDownloading] = React.useState(false);

  // Render nonce that bumps every time the dialog enters its "ready"
  // state (open + loaded + has data). Keying the podium off it remounts
  // the cards so the CSS entrance + the CountUp replay on first open AND
  // on every refresh (parent toggles loading→false with fresh data).
  const [renderKey, setRenderKey] = React.useState(0);
  const wasReady = React.useRef(false);
  React.useEffect(() => {
    const ready = open && !loading && !!data;
    if (ready && !wasReady.current) setRenderKey(k => k + 1);
    wasReady.current = ready;
  }, [open, loading, data]);

  const handleDownload = async () => {
    if (!onDownload || downloading) return;
    setDownloading(true);
    try { await onDownload(); }
    finally { setDownloading(false); }
  };

  // Render order: rank 2 (left), rank 1 (center), rank 3 (right) → podium.
  const byRank = {};
  (data?.podium || []).forEach(p => { byRank[p.rank] = p; });
  const podiumOrder = [2, 1, 3];

  // Footer hosts the totals (left) + Làm mới (recompute server-side) +
  // primary download (right). Closing lives on the Modal's X / Esc.
  const footer = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {!loading && data && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
            {data.totalCtv} CTV · {data.totalProfiles} hồ sơ
          </span>
        )}
      </div>
      <Button variant="ghost" onClick={onRefresh} disabled={loading}>Làm mới</Button>
      <Button variant="primary" icon="download" onClick={handleDownload}
              disabled={loading || !data || downloading}>
        {downloading ? "Đang tải…" : "Tải Excel"}
      </Button>
    </div>
  );

  return (
    <React.Fragment>
      <CtvConfetti show={open && !loading && !!data}/>
      <Modal open={open} onClose={onClose}
             title="Bảng vàng CTV"
             subtitle={loading ? "Đang tải kết quả…" : (data?.monthLabel || "")}
             width={800} footer={footer}>
        <style>{`
          @keyframes ctv-grow-up {
            from { clip-path: inset(100% 0 0 0 round 20px); opacity: 0; transform: translateY(12px); }
            to   { clip-path: inset(0 0 0 0 round 20px);    opacity: 1; transform: translateY(0); }
          }
          @keyframes ctv-skeleton-pulse {
            0%, 100% { opacity: 0.45; }
            50%      { opacity: 0.8; }
          }
          @keyframes ctv-shimmer {
            0%   { left: -60%; }
            55%  { left: 130%; }
            100% { left: 130%; }
          }
          @keyframes ctv-bob {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-4px); }
          }
          @keyframes ctv-spark {
            0%   { transform: translate3d(0, 0, 0) scale(0.5); opacity: 0; }
            15%  { opacity: 1; }
            80%  { opacity: 0.9; }
            100% { transform: translate3d(var(--ptx), var(--pty), 0) scale(1); opacity: 0; }
          }
          @keyframes ctv-fade-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {loading || !data ? (
          // ---- Loading state: skeleton podium (3 mini cards matching real
          //     layout/colors, so when data arrives the grow-up animation
          //     feels like the skeleton expanding into the real podium) ----
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1.12fr 1fr",
            gap: 14, alignItems: "end", paddingTop: 6,
          }}>
            {[2, 1, 3].map(place => {
              const tone = CTV_RANK_TONE[place];
              const isFirst = place === 1;
              return (
                <div key={place} style={{
                  marginTop: isFirst ? 0 : 26,
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    minHeight: isFirst ? 130 : 108, borderRadius: 20,
                    padding: isFirst ? "16px 16px 14px" : "14px 14px 12px",
                    background: `color-mix(in oklab, ${tone.c} 9%, var(--glass-2))`,
                    border: `1px solid color-mix(in oklab, ${tone.c} 30%, transparent)`,
                    boxShadow: `0 0 0 1px color-mix(in oklab, ${tone.c} 15%, transparent), 0 0 ${isFirst ? 24 : 16}px color-mix(in oklab, ${tone.g} ${isFirst ? 40 : 25}%, transparent), var(--shadow-2)`,
                    backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    overflow: "hidden",
                  }}>
                    {/* TOP pill skeleton */}
                    <div style={{
                      width: 48, height: 18, borderRadius: 999,
                      background: `color-mix(in oklab, ${tone.c} 14%, transparent)`,
                      border: `1px solid color-mix(in oklab, ${tone.c} 30%, transparent)`,
                      animation: "ctv-skeleton-pulse 2s ease-in-out infinite",
                    }}/>
                    {/* Avatar circle skeleton */}
                    <div style={{
                      width: isFirst ? 48 : 40, height: isFirst ? 48 : 40,
                      borderRadius: 999,
                      background: `color-mix(in oklab, ${tone.c} 10%, transparent)`,
                      border: `1px solid color-mix(in oklab, ${tone.c} 20%, transparent)`,
                      animation: "ctv-skeleton-pulse 2s ease-in-out 0.3s infinite",
                    }}/>
                    {/* Name bar skeleton */}
                    <div style={{
                      width: isFirst ? 80 : 64, height: 10, borderRadius: 6,
                      background: `color-mix(in oklab, ${tone.c} 10%, transparent)`,
                      animation: "ctv-skeleton-pulse 2s ease-in-out 0.6s infinite",
                    }}/>
                    <div style={{ height: isFirst ? 16 : 12, flexShrink: 0 }}/>
                    {/* Count bar skeleton */}
                    <div style={{
                      width: 36, height: 14, borderRadius: 6,
                      background: `color-mix(in oklab, ${tone.c} 12%, transparent)`,
                      marginTop: "auto",
                      animation: "ctv-skeleton-pulse 2s ease-in-out 0.9s infinite",
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Podium — keyed on renderKey so it remounts (and replays the
                entrance + CountUp) on first open and on every refresh. */}
            <div key={renderKey} style={{
              display: "grid", gridTemplateColumns: "1fr 1.12fr 1fr",
              gap: 14, alignItems: "end", paddingTop: 6,
            }}>
              {podiumOrder.map(place => (
                <CtvPodiumCard key={place} place={place} entry={byRank[place] || null}/>
              ))}
            </div>

            {/* Rank 4+ list */}
            {data.rest && data.rest.length > 0 && (
              <div style={{ animation: "ctv-fade-up 420ms var(--ease-out) 420ms both" }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 8, paddingLeft: 2,
                }}>Bảng xếp hạng còn lại</div>
                <GlassCard padding={0} soft>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {data.rest.map((e, i) => (
                      <CtvRestRow key={e.rank} entry={e} last={i === data.rest.length - 1}/>
                    ))}
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        )}
      </Modal>
    </React.Fragment>
  );
}

Object.assign(window, { CtvCompetitionDialog });
