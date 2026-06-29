// ====================================================================
// Modals: AddStudent (with doc slots + QR auto-fill + dropdowns)
//         AddPayment
//         AddClass
// ====================================================================

// ── Draft auto-save helpers ────────────────────────────────────────
// Saves form state to localStorage so slow/elderly users don't lose
// typed data on accidental close, app kill, or network interruption.
// Keyed per user to prevent cross-user draft leakage on shared devices.
function _draftKey(suffix) {
  const userId = window.MGT_DATA?.currentUser?.id || 'anon';
  return `mgt_admin_${suffix}_draft_${userId}`;
}
function _draftSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function _draftLoad(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function _draftClear(key) {
  try { localStorage.removeItem(key); } catch {}
}

// Debounced auto-save hook — watches a form object and saves to
// localStorage after 1s of inactivity. Restores on open.
function _useDraft(draftSuffix, open, form, setForm) {
  const key = _draftKey(draftSuffix);
  const timerRef = React.useRef(null);

  // Restore draft when modal opens.
  React.useEffect(() => {
    if (open) {
      const draft = _draftLoad(key);
      if (draft && typeof draft === 'object') setForm(prev => ({ ...prev, ...draft }));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save on form change.
  React.useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => _draftSave(key, form), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [form, open]);

  return key; // return key so submit handler can clear it
}

// beforeunload guard — warns before closing tab with unsaved modal data.
let _activeDraftKeys = [];
function _registerDraft(key) { _activeDraftKeys.push(key); _updateBeforeunload(); }
function _unregisterDraft(key) { _activeDraftKeys = _activeDraftKeys.filter(k => k !== key); _updateBeforeunload(); }
function _updateBeforeunload() {
  if (_activeDraftKeys.length > 0) {
    window.onbeforeunload = () => 'Bạn có thay đổi chưa lưu. Đóng trang sẽ mất dữ liệu.';
  } else {
    window.onbeforeunload = null;
  }
}

// --------------------------------------------------------------------
// Add Student Modal — the demo centerpiece
// --------------------------------------------------------------------
function AddStudentModal({ open, onClose, onSave }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({
    name: "", gender: "", dob: "", idNumber: "", address: "", phone: "",
    noiTamTru: "", ngayCapCCCD: "", noiCapCCCD: "", notes: "",
    classId: "", feePlanId: "", promotionId: "", responsibleStaffId: "",
  });
  const [docs, setDocs] = React.useState(() => Object.fromEntries((D.PROFILE_DOCS || []).map(d => [d.key, false])));
  // Captured File objects (per doc key). Uploaded after the student is
  // created — we need the student id before POSTing to /students/:id/docs/:key.
  const [docFiles, setDocFiles] = React.useState({});
  const [qrToast, setQrToast] = React.useState(null);    // null | {msg, kind}
  const [qrBusy,  setQrBusy]  = React.useState(false);

  // Auto-save form draft to localStorage (debounced 1s).
  const _draftKey = _useDraft('student', open, form, setForm);

  // Register/unregister beforeunload guard while modal is open with data.
  React.useEffect(() => {
    if (open && form.name) { _registerDraft(_draftKey); return () => _unregisterDraft(_draftKey); }
  }, [open, form.name]);

  // Drop a doc → mark filled, stash the File, and for the QR slot
  // specifically scan the CCCD QR locally via window.MGT_QR. Returned
  // fields populate the form, skipping any field the user already typed.
  const handleDocDrop = async (key, file) => {
    setDocs(prev => ({ ...prev, [key]: true }));
    if (file) setDocFiles(prev => ({ ...prev, [key]: file }));
    if (key !== "cccdQR" || !file) return;
    setQrBusy(true);
    setQrToast({ kind: "info", msg: "Đang đọc mã QR…" });
    try {
      const out = await window.MGT_QR.scanFile(file);
      const f = (out && out.fields) || {};
      // Convert the old (pre-2025-reform) address to its new form before it
      // populates the form (both Nơi thường trú + Nơi tạm trú derive from it).
      let addrOk = true;
      if (out && out.ok && f.address && D.api && D.api.convertAddress) {
        setQrToast({ kind: "info", msg: "Đang cập nhật địa chỉ…" });
        try {
          const c = await D.api.convertAddress(f.address);
          if (c && c.converted) f.address = c.converted;
          addrOk = !!(c && c.ok);  // false ⇒ rate-limited/failed ⇒ kept the OLD address
        } catch (e) { addrOk = false; }
      }
      const applied = [];
      if (out && out.ok) {
        setForm(prev => {
          const next = { ...prev };
          // QR is the official document → authoritative. Overwrite every
          // field it reads, even ones the user already typed.
          const set = (k, v) => { if (v) { next[k] = v; applied.push(k); } };
          set("idNumber",    f.idNumber);
          set("name",        f.name);
          set("dob",         f.dob);
          set("gender",      f.gender);
          set("address",     f.address);
          set("ngayCapCCCD", f.ngayCapCCCD);
          // Nơi tạm trú defaults to the QR's Nơi thường trú (staff can edit);
          // Nơi cấp defaults to the standard issuing authority.
          set("noiTamTru",   f.address);
          next.noiCapCCCD = "Cục CS QLHC về TTXH"; applied.push("noiCapCCCD");
          if (out.raw) next.cccdQrRaw = out.raw;  // raw QR payload for export
          return next;
        });
      }
      if (out && out.ok && applied.length) {
        setQrToast(addrOk
          ? { kind: "ok", msg: `QR đã điền ${applied.length} trường` }
          : { kind: "warn", msg: `QR đã điền ${applied.length} trường — địa chỉ chưa chuyển đổi, kiểm tra lại` });
      } else {
        setQrToast({ kind: "warn", msg: "Không đọc được mã QR. Chụp lại ảnh rõ nét hơn, đảm bảo mã QR rõ ràng và đầy đủ." });
      }
    } catch (e) {
      setQrToast({ kind: "err", msg: "Không thể quét mã QR. Chụp lại ảnh rõ hơn, hoặc chọn ảnh khác từ thư viện." });
    } finally {
      setQrBusy(false);
      setTimeout(() => setQrToast(null), 4500);
    }
  };

  // Open classes that are accepting new students
  const openClasses = D.classes.filter(c => c.status === "đang mở");

  // Selected fee plan determines which promotions are valid
  const selectedFeePlan = form.feePlanId ? D.getFeePlan(form.feePlanId) : null;
  const validPromos = selectedFeePlan
    ? D.promotions.filter(p => p.appliesTo.includes(selectedFeePlan.licence))
    : [];
  const selectedPromo = form.promotionId ? D.getPromotion(form.promotionId) : null;
  const totalFee = selectedFeePlan
    ? selectedFeePlan.amount - (selectedPromo ? selectedPromo.discount : 0)
    : 0;

  const requiredDocs = (D.PROFILE_DOCS || []).filter(d => d.required !== false);
  // Modal-only slot order: swap "Giấy khám sức khỏe" (gksk) and "Thẻ 3×4"
  // (the3x4). Backend PROFILE_DOCS order is left untouched (detail screen
  // keeps the canonical order).
  const modalDocs = (() => {
    const arr = [...(D.PROFILE_DOCS || [])];
    const gi = arr.findIndex(d => d.key === "gksk");
    const ti = arr.findIndex(d => d.key === "the3x4");
    if (gi >= 0 && ti >= 0) { const tmp = arr[gi]; arr[gi] = arr[ti]; arr[ti] = tmp; }
    return arr;
  })();
  const docsComplete = requiredDocs.every(d => docs[d.key]);
  const REQUIRED_FIELDS = ["name", "gender", "dob", "idNumber", "address", "phone", "classId", "feePlanId", "promotionId", "responsibleStaffId"];
  const allFieldsFilled = REQUIRED_FIELDS.every(k => form[k]);
  const profileComplete = docsComplete && allFieldsFilled;

  // reset on close
  React.useEffect(() => {
    if (!open) {
      setForm({ name: "", gender: "", dob: "", idNumber: "", address: "", phone: "", noiTamTru: "", ngayCapCCCD: "", noiCapCCCD: "", notes: "", classId: "", feePlanId: "", promotionId: "", responsibleStaffId: "" });
      setDocs(Object.fromEntries((D.PROFILE_DOCS || []).map(d => [d.key, false])));
      setDocFiles({});
    }
  }, [open]);

  const SectionTitle = ({ children }) => (
    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>{children}</h3>
  );

  return (
    <Modal open={open} onClose={onClose} width={880}
           primaryLabel="Lưu học viên"
           primaryAction={() => { onSave && onSave({ form, docs, profileComplete, docFiles }); _draftClear(_draftKey); _unregisterDraft(_draftKey); onClose(); }}
           primaryDisabled={
             qrBusy  /* wait for QR scan + address conversion before saving */
             || !form.name || !form.classId || !form.responsibleStaffId
             || !form.feePlanId  /* required so totalFee/balance can be tracked — SPEC §3 */
             || openClasses.length === 0
           }
           footerStart={
             openClasses.length === 0 ? (
               <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-pink)" }}>
                 Không có lớp đang mở — hãy tạo lớp trước.
               </span>
             ) : !form.feePlanId ? (
               <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-pink)" }}>
                 Chưa chọn gói học phí — không thể theo dõi học phí / công nợ.
               </span>
             ) : !profileComplete ? (
               <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-amber)" }}>
                 Còn {requiredDocs.filter(d => !docs[d.key]).length} ô tài liệu và {REQUIRED_FIELDS.filter(k=>!form[k]).length} trường chưa điền.
               </span>
             ) : null
           }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* QR status — pinned at top. info/ok/warn/err tones map to
            cyan / lime / amber / pink. */}
        {qrToast && (() => {
          const tone = qrToast.kind === "ok"   ? "var(--neon-lime)"
                     : qrToast.kind === "warn" ? "var(--neon-amber)"
                     : qrToast.kind === "err"  ? "var(--neon-pink)"
                     : "var(--neon-cyan)";
          const icon = qrToast.kind === "ok" ? "check"
                     : qrToast.kind === "err" || qrToast.kind === "warn" ? "x"
                     : "clock";
          return (
            <div style={{
              padding: "8px 12px", borderRadius: 10,
              background: `color-mix(in oklab, ${tone} 14%, transparent)`,
              border: `1px solid color-mix(in oklab, ${tone} 36%, transparent)`,
              display: "flex", alignItems: "center", gap: 8,
              animation: "fadeIn 220ms ease-out",
            }}>
              <Icon name={icon} size={14} color={tone}/>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-1)", flex: 1 }}>
                {qrToast.msg}
              </span>
              {qrBusy && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: tone, letterSpacing: "0.1em" }}>…</span>}
            </div>
          );
        })()}

        {/* Top row — Thông tin cá nhân  |  Đăng ký & Lớp học. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionTitle>Thông tin cá nhân</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Số CCCD"        value={form.idNumber}    onChange={v => setForm({ ...form, idNumber: v })}    placeholder="123 456 789012"
                       digits maxDigits={12} format={window.fmtCCCD}/>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Họ và tên"      value={form.name}        onChange={v => setForm({ ...form, name: v })}        placeholder="Nguyễn Văn A"/>
              </div>
              <Input label="Ngày sinh"        value={form.dob}         onChange={v => setForm({ ...form, dob: v })}         placeholder="dd/mm/yyyy"
                     digits maxDigits={8} format={window.fmtDateInput} storeFormatted/>
              <Select label="Giới tính"       value={form.gender}      onChange={v => setForm({ ...form, gender: v })}
                      placeholder="Chọn giới tính"
                      options={[{ value: "Nam", label: "Nam" }, { value: "Nữ", label: "Nữ" }]}/>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Nơi tạm trú"    value={form.noiTamTru}   onChange={v => setForm({ ...form, noiTamTru: v })}   placeholder="Số nhà, Thành phố, Tỉnh"/>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="Nơi thường trú" value={form.address}     onChange={v => setForm({ ...form, address: v })}     placeholder="Số nhà, Thành phố, Tỉnh"/>
              </div>
              <Input label="Ngày cấp"         value={form.ngayCapCCCD} onChange={v => setForm({ ...form, ngayCapCCCD: v })} placeholder="dd/mm/yyyy"
                     digits maxDigits={8} format={window.fmtDateInput} storeFormatted/>
              <Input label="Nơi cấp"          value={form.noiCapCCCD}  onChange={v => setForm({ ...form, noiCapCCCD: v })}  placeholder="Cục CS QLHC về TTXH"/>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionTitle>Đăng ký & Lớp học</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "span 2" }}>
                <Input label="SĐT" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="090 123 4567"
                       digits maxDigits={10} format={window.fmtPhone}/>
              </div>
              <Select label="Lớp" value={form.classId} onChange={v => setForm({ ...form, classId: v })}
                      placeholder={openClasses.length === 0 ? "Chưa có lớp đang mở" : "Chọn lớp đang mở"}
                      options={openClasses.map(c => ({ value: c.id, label: c.code }))}
                      note={openClasses.length === 0 ? "Không có lớp đang mở — hãy tạo lớp trước." : null}/>
              <Select label="Nhân viên" value={form.responsibleStaffId} onChange={v => setForm({ ...form, responsibleStaffId: v })}
                      placeholder="Chọn nhân viên"
                      options={D.accounts.filter(a => a.role === "staff").map(a => ({ value: a.id, label: a.name }))}/>
              <Select label="Học phí" value={form.feePlanId} onChange={v => setForm({ ...form, feePlanId: v, promotionId: "" })}
                      placeholder="Chọn gói học phí"
                      options={D.feePlans.map(f => ({ value: f.id, label: `${f.name} · ${window.fmtVND(f.amount)}` }))}/>
              <Select label="Khuyến mãi" value={form.promotionId} onChange={v => setForm({ ...form, promotionId: v })}
                      placeholder={selectedFeePlan ? "Chọn khuyến mãi" : "Chọn học phí trước"}
                      options={validPromos.map(p => ({ value: p.id, label: p.discount > 0 ? `${p.name} · −${window.fmtVND(p.discount)}` : p.name }))}/>
            </div>
            {selectedFeePlan && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10,
                            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Tổng học phí</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--neon-lime)", fontVariantNumeric: "tabular-nums" }}>
                  {window.fmtVND(totalFee)}
                </span>
              </div>
            )}

            {/* Ghi chú — typable textarea, mirrors profile detail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ghi chú</span>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Nhập ghi chú…"
                        rows={3}
                        style={{
                          width: "100%", resize: "vertical",
                          background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
                          color: "var(--fg-1)", borderRadius: 10,
                          padding: "8px 10px",
                          fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5,
                          outline: "none",
                          transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
                        }}
                        onFocus={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 12px var(--neon-cyan-haze)"; }}
                        onBlur={e => { e.target.style.borderColor = "var(--glass-stroke)"; e.target.style.boxShadow = "none"; }}/>
            </div>
          </div>
        </div>

        {/* Bottom — Tài liệu (full width). Helper hint is inlined next
            to the heading to save vertical space. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <SectionTitle>Tài liệu</SectionTitle>
            <span style={{
              fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-cyan)",
              textShadow: "0 0 6px var(--neon-cyan-haze)",
            }}>
              Chụp từ camera, chọn ảnh, copy paste, hoặc kéo thả
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {modalDocs.map(doc => (
              <DocSlot key={doc.key} doc={doc} filled={docs[doc.key]}
                       onDrop={handleDocDrop}
                       onClear={(k) => setDocs({ ...docs, [k]: false })}
                       compact/>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------
// Add Payment Modal
// --------------------------------------------------------------------
function AddPaymentModal({ open, onClose, onSave, defaultStudentId, defaultAmount }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({ studentId: "", amount: "", method: "", bienLaiId: "" });
  const [bienLaiPhoto, setBienLaiPhoto] = React.useState(false);
  const [bienLaiFile, setBienLaiFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  // Synchronous double-submit guard — React's `busy` state updates
  // asynchronously, so a burst of .click()s can race past it. The ref
  // check is synchronous and blocks duplicate POSTs.
  const busyRef = React.useRef(false);

  // Auto-save form draft to localStorage (debounced 1s).
  const _pDraftKey = _useDraft('payment', open, form, setForm);

  // Track whether a draft was restored so we don't overwrite it with defaults.
  const _hadDraft = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      const draft = _draftLoad(_pDraftKey);
      _hadDraft.current = !!(draft && draft.studentId);
      if (!_hadDraft.current) {
        setForm({
          studentId: defaultStudentId || "",
          amount: defaultAmount != null ? String(defaultAmount) : "",
          method: "", bienLaiId: "",
        });
      }
      setBusy(false); setErr(null); busyRef.current = false;
    }
    if (!open) { setBienLaiPhoto(false); setBienLaiFile(null); _hadDraft.current = false; }
  }, [open, defaultStudentId, defaultAmount]);

  // Register/unregister beforeunload guard while modal is open with data.
  React.useEffect(() => {
    if (open && form.studentId) { _registerDraft(_pDraftKey); return () => _unregisterDraft(_pDraftKey); }
  }, [open, form.studentId]);

  const student = form.studentId ? D.getStudent(form.studentId) : null;
  const amount = parseInt(form.amount.replace(/\D/g, ""), 10) || 0;
  const newPaid = student ? student.paid + amount : 0;
  const newBalance = student ? student.totalFee - newPaid : 0;
  const newStatus = student
    ? (newPaid >= student.totalFee ? "100%" : newPaid > 0 ? "50%" : "0%")
    : "—";
  // Per BACKEND.md §8.5, payments are an event log and compensating entries
  // are intentional (deposits/holds), so over-payment is allowed by design.
  // Surface a soft inline warning before submission so the user knows a
  // surplus will be created. Does NOT block submission.
  const overAmount = student && amount > 0 ? Math.max(0, newPaid - student.totalFee) : 0;
  const isOverpayment = overAmount > 0;

  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await (onSave && onSave({ ...form, amount, bienLaiPhoto, bienLaiFile }));
      _draftClear(_pDraftKey); _unregisterDraft(_pDraftKey);
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={620}
           title="Ghi nhận thanh toán"
           primaryLabel={busy ? "Đang lưu…" : "Lưu thanh toán"}
           primaryAction={submit}
           primaryDisabled={busy || !form.studentId || !amount || !form.method || !form.bienLaiId}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : isOverpayment ? (
             <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--neon-amber)" }}
                   data-testid="overpayment-warning">
               Số tiền vượt tổng học phí (+{window.fmtVND(overAmount)}) — sẽ tạo dư.
             </span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StudentSearchPicker label="Học viên"
                             value={form.studentId}
                             onChange={v => setForm({ ...form, studentId: v })}/>

        {student && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 14, borderRadius: 12, background: "var(--ink-2)", border: "1px solid var(--glass-stroke)" }}>
            <MiniStat label="Tổng học phí" value={window.fmtVND(student.totalFee)}/>
            <MiniStat label="Đã thu"      value={window.fmtVND(student.paid)} color="var(--neon-lime)"/>
            <MiniStat label="Còn nợ"      value={window.fmtVND(student.balance)} color="var(--neon-pink)"/>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Số tiền" value={form.amount} onChange={v => setForm({ ...form, amount: v })} placeholder="0" prefix="₫"
                 digits maxDigits={12} format={window.fmtMoneyInput}/>
          <Select label="Hình thức" value={form.method} onChange={v => setForm({ ...form, method: v })}
                  placeholder="Chọn hình thức"
                  options={[{ value: "Tiền mặt", label: "Tiền mặt" }, { value: "Chuyển khoản", label: "Chuyển khoản" }]}/>
        </div>

        <Input label="Mã biên lai" value={form.bienLaiId} onChange={v => setForm({ ...form, bienLaiId: v })} placeholder="BL-2026-…" mono/>

        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>Ảnh biên lai (tuỳ chọn)</span>
          <div style={{ marginTop: 6 }}>
            <DocSlot doc={{ key: "bienLai", label: "Biên lai", hint: "Kéo & thả ảnh biên lai" }}
                     filled={bienLaiPhoto}
                     onDrop={(_k, file) => { setBienLaiPhoto(true); if (file) setBienLaiFile(file); }}
                     onClear={() => { setBienLaiPhoto(false); setBienLaiFile(null); }}
                     compact/>
          </div>
        </div>

        {/* Preview the auto-update */}
        {student && amount > 0 && (
          <div style={{
            padding: 14, borderRadius: 12,
            background: "color-mix(in oklab, var(--neon-lime) 6%, transparent)",
            border: "1px solid color-mix(in oklab, var(--neon-lime) 24%, transparent)",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--neon-lime)" }}>
              Sau khi lưu — tự cập nhật
            </span>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Đã thu: <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-1)", fontWeight: 600 }}>{window.fmtVND(newPaid)}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Còn nợ: <span style={{ fontFamily: "var(--font-mono)", color: newBalance > 0 ? "var(--neon-pink)" : "var(--neon-lime)", fontWeight: 600 }}>{window.fmtVND(newBalance)}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
                Trạng thái: <PaymentPill status={newStatus}/>
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
        color: color || "var(--fg-1)", fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
    </div>
  );
}

// --------------------------------------------------------------------
// StudentSearchPicker — typeable input that filters students by name /
// SĐT / Mã HV. Opens a dropdown of matches; clicking one fills the
// value. Replaces the long unwieldy dropdown the Select used to render.
// --------------------------------------------------------------------
function StudentSearchPicker({ label, value, onChange }) {
  const D = window.MGT_DATA;
  const selected = value ? D.getStudent(value) : null;
  const [query, setQuery] = React.useState("");
  const [open, setOpen]   = React.useState(false);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    // Whenever the parent's value changes externally, sync the visible text.
    setQuery(selected ? `${selected.name} · ${window.fmtPhone(selected.phone)}` : "");
  }, [value]);   // eslint-disable-line

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Match against name, phone, and Mã HV — case-insensitive substring.
  const q = query.trim().toLowerCase();
  const matches = (q === "" || (selected && query === `${selected.name} · ${window.fmtPhone(selected.phone)}`))
    ? D.students.slice(0, 30)
    : D.students.filter(s => (s.name + " " + s.phone + " " + s.maHV).toLowerCase().includes(q)).slice(0, 30);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</span>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm theo tên, SĐT, Mã HV…"
          style={{
            width: "100%",
            background: "var(--ink-2)", border: "1px solid var(--glass-stroke)",
            color: "var(--fg-1)", borderRadius: 10,
            padding: "10px 36px 10px 12px",
            fontFamily: "var(--font-ui)", fontSize: 13, outline: "none",
            transition: "border-color 140ms var(--ease-out), box-shadow 140ms var(--ease-out)",
          }}
          onFocusCapture={e => { e.target.style.borderColor = "var(--neon-cyan)"; e.target.style.boxShadow = "0 0 14px var(--neon-cyan-haze)"; }}
          onBlurCapture={e => { e.target.style.borderColor = "var(--glass-stroke)"; e.target.style.boxShadow = "none"; }}/>
        <Icon name="search" size={14} color="var(--fg-3)"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
      </div>
      {open && matches.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
          maxHeight: 240, overflowY: "auto",
          background: "var(--ink-2)",
          backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-stroke-strong)", borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          padding: 4,
        }}>
          {matches.map(s => {
            const isActive = s.id === value;
            return (
              <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} style={{
                display: "flex", width: "100%", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                background: isActive ? "var(--ink-3)" : "transparent",
                border: "none",
                color: "var(--fg-1)",
                transition: "background 140ms var(--ease-out)",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--ink-3)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>{window.fmtPhone(s.phone)} · {s.maHV}</span>
                </div>
                {isActive && <Icon name="check" size={13} color="var(--neon-cyan)"/>}
              </button>
            );
          })}
        </div>
      )}
      {open && matches.length === 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
          padding: "12px 14px",
          background: "var(--ink-2)",
          border: "1px solid var(--glass-stroke)", borderRadius: 10,
          fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)",
        }}>
          Không tìm thấy học viên phù hợp.
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// Add Class Modal (admin only)
//   No licence field — A & A1 students share the same class.
//   No max capacity — classes have no upper limit.
// --------------------------------------------------------------------
function AddClassModal({ open, onClose, onSave }) {
  const D = window.MGT_DATA;
  const [form, setForm] = React.useState({ code: "", openDate: "", examDate: "", branchId: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr]   = React.useState(null);
  // Synchronous double-submit guard — see AddPaymentModal for rationale.
  const busyRef = React.useRef(false);

  // Auto-save form draft to localStorage (debounced 1s).
  const _cDraftKey = _useDraft('class', open, form, setForm);

  React.useEffect(() => {
    if (!open) setForm({ code: "", openDate: "", examDate: "", branchId: "" });
    if (open) { setBusy(false); setErr(null); busyRef.current = false; }
  }, [open]);

  // Register/unregister beforeunload guard while modal is open with data.
  React.useEffect(() => {
    if (open && form.code) { _registerDraft(_cDraftKey); return () => _unregisterDraft(_cDraftKey); }
  }, [open, form.code]);

  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setBusy(true); setErr(null);
      await (onSave && onSave(form));
      _draftClear(_cDraftKey); _unregisterDraft(_cDraftKey);
      onClose();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} width={520}
           title="Tạo lớp mới"
           primaryLabel={busy ? "Đang tạo…" : "Tạo lớp"}
           primaryAction={submit}
           primaryDisabled={busy || !form.code || !form.branchId}
           footerStart={err ? (
             <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)" }}>
               {err}
             </span>
           ) : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input label="Mã lớp" value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder="MÔ TÔ 06/2026"/>
        <Select label="Chi nhánh" value={form.branchId} onChange={v => setForm({ ...form, branchId: v })}
                placeholder="Chọn chi nhánh"
                options={D.branches.map(b => ({ value: b.id, label: b.name }))}/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Ngày mở"  value={form.openDate} onChange={v => setForm({ ...form, openDate: v })} placeholder="dd/mm/yyyy"
                 digits maxDigits={8} format={window.fmtDateInput} storeFormatted/>
          <Input label="Ngày thi" value={form.examDate} onChange={v => setForm({ ...form, examDate: v })} placeholder="dd/mm/yyyy"
                 digits maxDigits={8} format={window.fmtDateInput} storeFormatted/>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { AddStudentModal, AddPaymentModal, AddClassModal });
