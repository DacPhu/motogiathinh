// ====================================================================
// Phương tiện tab — VehiclesTab, VehicleCard, VehicleExpanded,
// RentVehicleModal. Loaded after screen-org.jsx in index.html.
// ====================================================================

function VehiclesTab({ onOpenStudent, selectedId: selectedIdProp, onSelectedIdChange }) {
  const D = window.MGT_DATA;
  const [createOpen, setCreateOpen] = React.useState(false);
  const [rentOpen,   setRentOpen]   = React.useState(false);
  // Controlled selection (when App lifts it) or self-managed fallback.
  const [localSelectedId, setLocalSelectedId] = React.useState(null);
  const selectedId    = selectedIdProp !== undefined ? selectedIdProp : localSelectedId;
  const setSelectedId = onSelectedIdChange       || setLocalSelectedId;
  const isAdmin = D.currentUser?.role === "admin";
  const branchOpts = D.getBranchOpts();
  // Vehicle reg code is the internal "Xe số N" identifier. Admin picks an
  // unused number from a dropdown; taken numbers are excluded.
  const MAX_VEHICLE_NUMBER = 50;
  const taken = new Set(D.vehicles.map(v => parseInt(v.plate, 10)).filter(n => Number.isFinite(n)));
  const plateOpts = [];
  for (let n = 1; n <= MAX_VEHICLE_NUMBER; n++) {
    if (!taken.has(n)) plateOpts.push({ id: String(n), label: `Xe số ${n}` });
  }
  const vehicleFields = [
    { id: "name",     label: "Tên xe",       type: "text",   placeholder: "Honda Wave Alpha", fullWidth: true },
    { id: "licence",  label: "Bằng",         type: "select", options: [{ id: "A", label: "A" }, { id: "A1", label: "A1" }] },
    { id: "branchId", label: "Chi nhánh",    type: "select", options: branchOpts },
    { id: "plate",    label: "Xe số",        type: "select", options: plateOpts },
    { id: "year",     label: "Năm sản xuất", type: "int",    placeholder: "2024" },
  ];
  const toggle = (id) => setSelectedId(s => s === id ? null : id);

  // Inline-expand: detail panel inserts after the last card of the selected
  // vehicle's row, pushing subsequent rows down. Columns observed via ResizeObserver.
  const gridRef = React.useRef(null);
  const [cols, setCols] = React.useState(1);
  React.useEffect(() => {
    if (!gridRef.current) return;
    const TILE = 280, GAP = 16;
    const update = () => setCols(Math.max(1, Math.floor((gridRef.current.clientWidth + GAP) / (TILE + GAP))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);
  const selectedIdx = selectedId ? D.vehicles.findIndex(v => v.id === selectedId) : -1;
  const panelAfter  = selectedIdx >= 0
    ? Math.min(Math.ceil((selectedIdx + 1) / cols) * cols - 1, D.vehicles.length - 1)
    : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {D.vehicles.length} phương tiện · {D.rentals.length} lượt thuê đã ghi
        </span>
        {isAdmin && <Button variant="secondary" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>Thêm phương tiện</Button>}
        <Button variant="primary" size="sm" icon="card" onClick={() => setRentOpen(true)}>Ghi nhận lượt thuê</Button>
      </div>

      <RecordCreatorModal open={createOpen} onClose={() => setCreateOpen(false)}
        title="Thêm phương tiện"
        onCreate={(d) => window.MGT_DATA.api.createVehicle(d).catch(e => reportWriteError(e, "Lỗi tạo phương tiện"))}
        fields={vehicleFields}/>
      <RentVehicleModal open={rentOpen} onClose={() => setRentOpen(false)}
        defaultVehicleId={selectedId || D.vehicles[0]?.id}/>

      <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {D.vehicles.map((v, i) => (
          <React.Fragment key={v.id}>
            <VehicleCard v={v} isSelected={selectedId === v.id} onToggle={() => toggle(v.id)}/>
            {i === panelAfter && (
              <div style={{ gridColumn: "1 / -1" }}>
                <VehicleExpanded vehicleId={selectedId} onOpenStudent={onOpenStudent}/>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// VehicleCard — bike-iconed card, branch-toned, no buttons. 5-row layout
// mirroring ClassCard (title · sub · meta-label · meta-value · bare-big).
// "N" is the internal Xe số number from v.plate (sequential 1..N integers).
// --------------------------------------------------------------------
// Placeholder revenue shown until real rental history exists.
function sampleRevenueFor(v) {
  const n = parseInt((String(v.id).match(/\d+/) || [1])[0], 10) || 1;
  return (n * 7 + 13) * 137000;
}

function VehicleCard({ v, isSelected, onToggle }) {
  const D = window.MGT_DATA;
  const b = D.getBranch(v.branchId);
  const rentals = D.rentalsForVehicle(v.id);
  const tone = window.useBranchTone(v.branchId);
  const realRevenue = rentals.reduce((s, r) => s + r.amount, 0);
  const revenue = realRevenue > 0 ? realRevenue : sampleRevenueFor(v);
  return (
    <GlassCard padding={22} onClick={onToggle} style={{
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
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, var(--ink-0)))`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 16px color-mix(in oklab, ${tone} 52%, transparent)`,
          }}>
            <Icon name="bike" size={20} color="var(--ink-0)"/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em",
                         whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</h3>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                             letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)",
                             whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                XE SỐ {v.plate || "—"}
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: tone, whiteSpace: "nowrap" }}>
                {b ? b.name : "—"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 10, columnGap: 14,
                      fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          <MetaCell label="Bằng" value={v.licence || "—"}/>
          <MetaCell label="Giá"  value={v.price ? window.fmtVND(v.price) : "—"} mono/>
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
          }}>{rentals.length} <span style={{ fontSize: 13, color: "var(--fg-3)", fontWeight: 600 }}>lượt thuê</span></span>
        </div>
      </div>
    </GlassCard>
  );
}

// --------------------------------------------------------------------
// VehicleExpanded — roll-down detail panel inserted in-grid below the
// selected card's row. Shows metadata + rental history with a sort menu.
// --------------------------------------------------------------------
function VehicleExpanded({ vehicleId, onOpenStudent }) {
  const D = window.MGT_DATA;
  const v = D.getVehicle(vehicleId);
  const b = D.getBranch(v?.branchId);
  const rentals = D.rentalsForVehicle(vehicleId);
  const tone = window.useBranchTone(v?.branchId);
  const sortFields = [
    { id: "createdAtMs",  label: "Thời điểm" },
    { id: "amount",       label: "Số tiền" },
    { id: "rentalRounds", label: "Số lượt" },
  ];
  const [sortField, setSortField] = React.useState("createdAtMs");
  const [sortDir,   setSortDir]   = React.useState("desc");
  const sorted = [...rentals].sort((a, c) => {
    const av = a[sortField] || 0, cv = c[sortField] || 0;
    return sortDir === "asc" ? av - cv : cv - av;
  });
  const totalAmount = rentals.reduce((s, r) => s + r.amount, 0);
  const totalRounds = rentals.reduce((s, r) => s + (r.rentalRounds || 0), 0);
  if (!v) return null;
  return (
    <div key={vehicleId} style={{ animation: "mgt-roll-down 280ms var(--ease-out)" }}>
      <style>{`@keyframes mgt-roll-down { from { opacity: 0; transform: translateY(-8px) scaleY(0.96); transform-origin: top; } to { opacity: 1; transform: none; } }`}</style>
      <GlassCard padding={26}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 8, height: 28, borderRadius: 2, background: tone,
                          boxShadow: `0 0 12px color-mix(in oklab, ${tone} 60%, transparent)` }}/>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{v.name}</h3>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>
                {v.licence || "—"} · Xe số {v.plate || "—"} · {v.year || "—"} · {b ? b.name : "—"} · Giá {v.price ? window.fmtVND(v.price) : "chưa đặt"}
              </span>
            </div>
            <SortMenu sortField={sortField} sortDir={sortDir}
                      onSortField={setSortField} onSortDir={setSortDir}
                      options={sortFields}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <MicroStat label="Số lượt thuê" value={rentals.length} mono/>
            <MicroStat label="Tổng số lượt"  value={totalRounds} mono/>
            <MicroStat label="Tổng thu"       value={window.fmtVND(totalAmount)} mono color="var(--neon-lime)"/>
          </div>

          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "150px 1fr 80px 120px 1fr",
              padding: "10px 14px", gap: 12, borderBottom: "1px solid var(--ink-4)",
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)",
            }}>
              <span>Thời điểm</span><span>Học viên</span>
              <span style={{ textAlign: "right" }}>Lượt</span>
              <span style={{ textAlign: "right" }}>Số tiền</span>
              <span>Nhân viên</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {sorted.length === 0 && (
                <div style={{ padding: "20px 14px", color: "var(--fg-4)", fontFamily: "var(--font-ui)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                  Chưa có lượt thuê nào cho xe này.
                </div>
              )}
              {sorted.map((r, i) => {
                const stu = D.getStudent(r.studentId);
                const staff = D.getStaff(r.staffId);
                const clickable = !!onOpenStudent && !!stu;
                return (
                  <div key={r.id}
                       onClick={() => clickable && onOpenStudent(r.studentId, {
                         tab: "payments", rentalId: r.id,
                         from: { type: "vehicle", id: v.id, plate: v.plate },
                       })}
                       style={{
                         display: "grid", gridTemplateColumns: "150px 1fr 80px 120px 1fr",
                         padding: "12px 14px", gap: 12, alignItems: "center",
                         borderBottom: i < sorted.length - 1 ? "1px solid var(--ink-4)" : "none",
                         cursor: clickable ? "pointer" : "default",
                         transition: "background 140ms var(--ease-out)",
                       }}
                       onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "var(--glass-2)"; }}
                       onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{r.createdAt}</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-1)" }}>{stu?.name || r.studentId}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{r.rentalRounds || 0}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{window.fmtVND(r.amount)}</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>{staff?.name || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// --------------------------------------------------------------------
// RentVehicleModal — records a vehicle rental. Amount is locked to
// vehicle.price × rounds (server validates the same). Student picker
// locks when opened with defaultStudentId (from a student profile).
// --------------------------------------------------------------------
function RentVehicleModal({ open, onClose, defaultVehicleId, defaultStudentId }) {
  const D = window.MGT_DATA;
  const studentLocked = !!defaultStudentId;
  const [vehicleId, setVehicleId] = React.useState(defaultVehicleId || D.vehicles[0]?.id || "");
  const [studentQ,  setStudentQ]  = React.useState("");
  const [studentId, setStudentId] = React.useState(defaultStudentId || "");
  const [rounds,    setRounds]    = React.useState("1");
  const [method,    setMethod]    = React.useState("Tiền mặt");
  const [busy, setBusy] = React.useState(false);
  const [err,  setErr]  = React.useState(null);
  const busyRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) return;
    setVehicleId(defaultVehicleId || D.vehicles[0]?.id || "");
    setStudentQ(""); setStudentId(defaultStudentId || ""); setRounds("1");
    setMethod("Tiền mặt"); setBusy(false); setErr(null); busyRef.current = false;
  }, [open, defaultVehicleId, defaultStudentId]);  // eslint-disable-line

  const veh = D.getVehicle(vehicleId);
  const r   = parseInt(rounds, 10) || 0;
  const total = veh && veh.price > 0 && r > 0 ? veh.price * r : 0;
  const matches = React.useMemo(() => {
    const q = studentQ.trim().toLowerCase();
    if (!q || studentId) return [];
    return D.students.filter(s =>
      (s.name || "").toLowerCase().includes(q)
      || (s.maHV || "").toLowerCase().includes(q)
      || (s.phone || "").includes(q)
    ).slice(0, 8);
  }, [studentQ, studentId]);
  const chosenStudent = studentId ? D.getStudent(studentId) : null;
  const canSubmit = !busy && veh && veh.price > 0 && r >= 1 && studentId;
  const submit = async () => {
    if (busyRef.current || !canSubmit) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await D.api.createRental({ studentId, vehicleId, rounds: r, method });
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally { busyRef.current = false; setBusy(false); }
  };

  const vehicleOpts = D.vehicles.map(v => ({
    value: v.id,
    label: `Xe số ${v.plate || "—"} · ${v.name}${v.price ? ` · ${window.fmtVND(v.price)}/lượt` : " · chưa đặt giá"}`,
  }));
  return (
    <Modal open={open} onClose={onClose} width={560}
           title="Ghi nhận lượt thuê xe"
           subtitle="Pay-on-the-spot · không tính vào doanh thu chính"
           primaryAction={submit}
           primaryLabel={busy ? "Đang ghi…" : "Ghi nhận"}
           primaryIcon="check" primaryDisabled={!canSubmit}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>{err}</span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Select label="Phương tiện" value={vehicleId} onChange={setVehicleId} options={vehicleOpts}/>
        <div>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)", display: "block", marginBottom: 6 }}>Học viên</label>
          {chosenStudent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                          background: "var(--ink-2)", border: "1px solid var(--glass-stroke)", borderRadius: 10 }}>
              <Avatar name={chosenStudent.name} size={28} src={chosenStudent.docs_the3x4_url || null}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>{chosenStudent.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{chosenStudent.maHV} · {chosenStudent.phone || "—"}</div>
              </div>
              {!studentLocked && (
                <button type="button" onClick={() => { setStudentId(""); setStudentQ(""); }}
                        style={{ background: "transparent", border: "1px solid var(--glass-stroke)", color: "var(--fg-3)",
                                 padding: "4px 10px", borderRadius: 8, cursor: "pointer",
                                 fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Đổi</button>
              )}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Input value={studentQ} onChange={setStudentQ} placeholder="Tìm theo tên / mã HV / SĐT…"/>
              {matches.length > 0 && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 30,
                              padding: 4, borderRadius: 10,
                              background: "var(--glass-3)", border: "1px solid var(--glass-stroke-strong)", boxShadow: "var(--shadow-2)",
                              maxHeight: 240, overflowY: "auto" }}>
                  {matches.map(s => (
                    <div key={s.id} onClick={() => { setStudentId(s.id); setStudentQ(s.name); }}
                         style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                                  borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13 }}
                         onMouseEnter={(e) => e.currentTarget.style.background = "var(--glass-2)"}
                         onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <Avatar name={s.name} size={24} src={s.docs_the3x4_url || null}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "var(--fg-1)", fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{s.maHV} · {s.phone || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Số lượt" value={rounds} onChange={setRounds} digits maxDigits={3} mono placeholder="1"/>
          <Select label="Hình thức" value={method} onChange={setMethod}
                  options={[{ value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" }]}/>
        </div>

        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "color-mix(in oklab, var(--neon-lime) 10%, transparent)",
          border: "1px solid color-mix(in oklab, var(--neon-lime) 28%, transparent)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>
            {veh && veh.price > 0 ? `${r || 0} lượt × ${window.fmtVND(veh.price)}` : "Chưa đủ thông tin"}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums" }}>
            {window.fmtVND(total)}
          </span>
        </div>
        {veh && (!veh.price || veh.price <= 0) && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-amber)" }}>
            ⚠ Phương tiện này chưa đặt giá thuê. Admin cần đặt giá trước khi cho thuê.
          </span>
        )}
      </div>
    </Modal>
  );
}

Object.assign(window, { VehiclesTab, RentVehicleModal });
