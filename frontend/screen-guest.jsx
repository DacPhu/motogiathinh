// ====================================================================
// GuestApp — vertical, mobile-first CTV (Cộng tác viên) portal.
//
// Rendered by app.jsx INSTEAD of the admin shell when currentUser.role
// === "collaborator". Reuses the shared atoms (Icon, Avatar, Input,
// Select, Button, Modal, useTheme) and wires to OUR state:
//   - window.MGT_DATA          (D.* — students/classes/api, server-scoped)
//   - window.MGT_QR.scanFile   (LOCAL CCCD QR scan — no backend OCR)
//   - doc keys: cccd · cccdBack · cccdQR · the3x4  (our backend DOC_KEYS)
// One page: a big "Thêm học viên" card on top, the operator's student
// list below; tap a row → detail/edit. Add via the modal.
// ====================================================================

const GUEST_MAX_WIDTH = 420;

// Success / toast keyframes (the admin index.html doesn't define these).
(function injectGuestKeyframes() {
  if (typeof document === "undefined" || document.getElementById("mgt-guest-kf")) return;
  const s = document.createElement("style");
  s.id = "mgt-guest-kf";
  s.textContent = `
    @keyframes mgt-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes mgt-success-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes mgt-success-glow { 0%,100% { box-shadow: 0 0 0 0 var(--neon-lime-glow); } 50% { box-shadow: 0 0 28px 4px var(--neon-lime-glow); } }
    @keyframes mgt-success-pill-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes mgt-slide-in-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes mgt-slide-in-left  { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
  `;
  document.head.appendChild(s);
})();

const G_LABEL = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" };
const G_ERROR_BANNER = {
  marginTop: 8, padding: "8px 12px", borderRadius: 10,
  fontFamily: "var(--font-mono)", fontSize: 12,
  background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
  color: "var(--neon-pink)", border: "1px solid var(--neon-pink)",
};

// User-facing toast → ToastHost (mounted once in GuestApp) via an event bus.
const gToast = (msg, type = "info") => {
  try { window.dispatchEvent(new CustomEvent("mgt:toast", { detail: { msg, type } })); } catch {}
};

// Web photo picker — hidden <input type=file>. (Native camera lands with
// the Capacitor wrapper later.)
function gPickPhoto() {
  // Native (Capacitor) provides a Camera/Library prompt; web falls back to a
  // plain file input (which on mobile browsers still offers camera + gallery).
  if (window.MGT_NATIVE_PICK) return window.MGT_NATIVE_PICK();
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}

// ── IndexedDB draft photo store ───────────────────────────────────
// Persists picked photos across accidental closes / app kills.
// Text fields already use localStorage; photos need IndexedDB (File
// objects are Blobs — localStorage can't hold them).
const _DB_NAME = 'mgt_guest_draft';
const _DB_STORE = 'photos';
const _DB_VERSION = 1;
const _DRAFT_MAX_FILE = 5 * 1024 * 1024; // 5MB per file (iOS WKWebView ~50MB budget)
let _draftWarned = false;  // toast once per session, not per pick

function _openDraftDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, _DB_VERSION);
    req.onupgradeneeded = () => { try { req.result.createObjectStore(_DB_STORE); } catch {} };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function draftSavePhoto(prefix, key, file) {
  if (!file || (file.size && file.size > _DRAFT_MAX_FILE)) return;
  try {
    const db = await _openDraftDB();
    const tx = db.transaction(_DB_STORE, 'readwrite');
    tx.objectStore(_DB_STORE).put(file, prefix + '_' + key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch (e) {
    if (!_draftWarned) {
      _draftWarned = true;
      gToast("Không thể lưu ảnh tạm thời. Ảnh sẽ bị mất nếu đóng ứng dụng.", "error");
    }
  }
}

async function draftLoadPhoto(prefix, key) {
  try {
    const db = await _openDraftDB();
    const tx = db.transaction(_DB_STORE, 'readonly');
    const req = tx.objectStore(_DB_STORE).get(prefix + '_' + key);
    return await new Promise((res) => { req.onsuccess = () => res(req.result || null); req.onerror = () => res(null); });
  } catch { return null; }
}

async function draftClearPhotos(prefix) {
  try {
    const db = await _openDraftDB();
    const tx = db.transaction(_DB_STORE, 'readwrite');
    const store = tx.objectStore(_DB_STORE);
    const range = IDBKeyRange.bound(prefix + '_', prefix + '￿');
    store.delete(range);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch {}
}

function GuestApp() {
  const D = window.MGT_DATA;
  const me = D.currentUser;
  const [, _bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => _bump();
    window.addEventListener("mgt:datachanged", fn);
    return () => window.removeEventListener("mgt:datachanged", fn);
  }, []);

  const [addOpen, setAddOpen] = React.useState(false);
  const [viewingId, setViewingId] = React.useState(null);
  const myStudents = D.students;  // server already scopes to this CTV
  const viewing = viewingId ? D.getStudent(viewingId) : null;

  // ---- Device/browser Back → in-app nav (History API) ----
  // Keep live refs so the single popstate handler reads current state.
  const addOpenRef = React.useRef(addOpen);
  const viewingIdRef = React.useRef(viewingId);
  const skipPushRef = React.useRef(false);  // suppress pushState when a popstate is driving the close
  React.useEffect(() => { addOpenRef.current = addOpen; }, [addOpen]);
  React.useEffect(() => { viewingIdRef.current = viewingId; }, [viewingId]);

  // Push a history entry when a modal or detail opens (but not when the
  // open was itself caused by a Back press unwinding the stack).
  React.useEffect(() => {
    if (skipPushRef.current) return;
    if (addOpen) { try { history.pushState({ mgtView: "modal" }, ""); } catch {} }
  }, [addOpen]);
  React.useEffect(() => {
    if (skipPushRef.current) return;
    if (viewingId) { try { history.pushState({ mgtView: "detail" }, ""); } catch {} }
  }, [viewingId]);

  React.useEffect(() => {
    const onPop = () => {
      // Consume the event for in-app state; never let it navigate away.
      if (addOpenRef.current) {
        skipPushRef.current = true;
        setAddOpen(false);
        setTimeout(() => { skipPushRef.current = false; }, 0);
      } else if (viewingIdRef.current) {
        skipPushRef.current = true;
        setViewingId(null);
        setTimeout(() => { skipPushRef.current = false; }, 0);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Manual closes go through history.back() so the pushed entry is popped
  // (back → popstate → state cleared). Keeps the history stack balanced.
  const closeAdd = React.useCallback(() => {
    if (addOpenRef.current) { try { history.back(); } catch { setAddOpen(false); } }
    else setAddOpen(false);
  }, []);
  const backToList = React.useCallback(() => {
    if (viewingIdRef.current) { try { history.back(); } catch { setViewingId(null); } }
    else setViewingId(null);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  alignItems: "center", background: "var(--ink-1)" }}>
      {window._MGT_OFFLINE && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200000,
          background: "color-mix(in oklab, var(--neon-violet, #a78bfa) 80%, #000)",
          padding: "7px 16px", textAlign: "center",
          fontFamily: "var(--font-ui, system-ui)", fontSize: 12, fontWeight: 600, color: "#fff",
        }}>
          Không có mạng — đang xem dữ liệu đã lưu. Kết nối internet để cập nhật.
        </div>
      )}
      <div style={{
        width: "100%", maxWidth: GUEST_MAX_WIDTH,
        height: "100dvh", minHeight: "100vh", maxHeight: "100dvh", overflow: "hidden",
        display: "flex", flexDirection: "column", background: "var(--glass-1)",
        borderLeft: "1px solid var(--glass-stroke)", borderRight: "1px solid var(--glass-stroke)",
      }}>
        <header style={{
          paddingTop: "max(16px, env(safe-area-inset-top, 16px))", paddingBottom: 16, paddingLeft: 18, paddingRight: 18,
          display: "flex", alignItems: "center", gap: 10, minHeight: 80,
          background: viewing ? "var(--glass-3)" : "var(--glass-2)",
          borderBottom: "1px solid var(--ink-4)", position: "relative", flex: "0 0 auto",
        }}>
          {viewing ? (
            <button onClick={backToList} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", alignSelf: "stretch", minHeight: 56,
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
              color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800,
              letterSpacing: "0.02em", textAlign: "left",
            }}>
              <Icon name="arrow-up" size={28} style={{ transform: "rotate(-90deg)" }}/>
              QUAY LẠI
            </button>
          ) : (<>
            <GuestUserChip me={me} count={myStudents.length}/>
            <div style={{ flex: 1 }}/>
            <GuestThemeToggle/>
          </>)}
        </header>

        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px 32px" }}>
          {viewing ? (
            <div key={viewingId} style={{ animation: "mgt-slide-in-right 260ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
              <GuestStudentDetail student={viewing} onBack={backToList}/>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14,
                          animation: "mgt-slide-in-left 260ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
              <button onClick={() => setAddOpen(true)} style={{
                padding: "22px 18px", borderRadius: 16, border: "none", cursor: "pointer",
                background: "var(--neon-cyan)", color: "var(--ink-0)",
                boxShadow: "0 0 28px var(--neon-cyan-haze), 0 0 0 1px var(--neon-cyan)",
                display: "flex", alignItems: "center", gap: 14,
                fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(0,0,0,0.18)",
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="user-plus" size={22} color="var(--ink-0)"/>
                </div>
                <span style={{ flex: 1, textAlign: "left" }}>Thêm học viên</span>
              </button>
              <GuestStudentList students={myStudents} onOpen={(id) => setViewingId(id)}/>
            </div>
          )}
        </main>
      </div>

      <GuestAddStudentModal open={addOpen} onClose={closeAdd}/>
      <GuestToastHost/>
    </div>
  );
}

// --------------------------------------------------------------------
// ToastHost — bottom-anchored stack, portaled to <body>.
// --------------------------------------------------------------------
const G_TOAST_TTL = 3400;
const gToastAccent = (t) => t === "error" ? "var(--neon-pink)" : t === "success" ? "var(--neon-lime)" : "var(--neon-cyan)";
const gToastIcon   = (t) => t === "error" ? "x" : t === "success" ? "check" : "bell";

function GuestToastHost() {
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(0);
  const dismiss = React.useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  React.useEffect(() => {
    const onToast = (e) => {
      const { msg, type = "info" } = e.detail || {};
      if (!msg) return;
      const id = ++idRef.current;
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => dismiss(id), G_TOAST_TTL);
    };
    window.addEventListener("mgt:toast", onToast);
    return () => window.removeEventListener("mgt:toast", onToast);
  }, [dismiss]);
  if (!toasts.length) return null;
  return ReactDOM.createPortal(
    <div style={{
      position: "fixed", left: "50%", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      transform: "translateX(-50%)", zIndex: 99999,
      display: "flex", flexDirection: "column", gap: 8, width: "min(92vw, 380px)", pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const accent = gToastAccent(t.type);
        return (
          <div key={t.id} role="status" onClick={() => dismiss(t.id)} style={{
            pointerEvents: "auto", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 12, background: "var(--glass-3)", border: `1px solid ${accent}`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.34), 0 0 0 1px ${accent}`,
            backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
            color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
            animation: "mgt-toast-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}>
            <Icon name={gToastIcon(t.type)} size={16} color={accent}/>
            <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{t.msg}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

function GuestStudentList({ students, onOpen }) {
  if (students.length === 0) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--fg-3)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>Chưa có học viên nào</div>
      </div>
    );
  }
  const sorted = [...students].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)} style={{
          padding: "14px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
          background: "var(--glass-2)", border: "1px solid var(--glass-stroke)",
          display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
          transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--neon-cyan)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-stroke)"; }}>
          <Avatar name={s.name} size={40} src={s.docs_the3x4_url || null}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-1)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)",
                          fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{window.fmtPhone ? window.fmtPhone(s.phone || "") : (s.phone || "")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------
// Detail — edit SĐT, hạng bằng, + re-upload photos. Task 7: collect
// upload results; only show success when ALL required docs uploaded.
// --------------------------------------------------------------------
function GuestStudentDetail({ student, onBack }) {
  const D = window.MGT_DATA;
  const [phone,   setPhone]   = React.useState(student.phone   || "");
  const [licence, setLicence] = React.useState(student.licence || "");
  const [newFiles, setNewFiles] = React.useState({});
  const [qrInfo, setQrInfo] = React.useState(null);
  const [qrErr,  setQrErr]  = React.useState(null);
  const [qrBusy, setQrBusy] = React.useState(false);
  // Task 7: unified result state replaces busy/err/success toast
  const [result, setResult] = React.useState(null); // null | { status, errMsg, failedDocs }
  const [retryBusy, setRetryBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const retryBusyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const ex = student.docs || {};

  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fieldsDirty = (phone !== (student.phone || "")) || (licence !== (student.licence || ""));
  const otherPhotosDirty = !!(newFiles.cccd || newFiles.cccdBack || newFiles.the3x4 || newFiles.bangLaiFront || newFiles.bangLaiBack);
  const qrReplaced = !!newFiles.cccdQR;
  const isDirty = fieldsDirty || otherPhotosDirty || qrReplaced;

  // Task 7: check if retry has pending failed uploads
  const hasPendingUploads = !!(result?.status === 'partial' || result?.status === 'failed') && (result.failedDocs || []).length > 0;

  const pickInto = (key, file) => { if (file) { setNewFiles(prev => ({ ...prev, [key]: file })); draftSavePhoto(student.id, key, file); } };

  // Restore photos from IndexedDB on mount (async — they pop in after render).
  React.useEffect(() => {
    (async () => {
      const keys = ['cccd', 'cccdBack', 'cccdQR', 'the3x4', 'bangLaiFront', 'bangLaiBack'];
      const files = {};
      for (const k of keys) { const f = await draftLoadPhoto(student.id, k); if (f) files[k] = f; }
      if (Object.keys(files).length) setNewFiles(prev => ({ ...prev, ...files }));
    })();
  }, [student.id]); // eslint-disable-line

  const scanQr = async (file, preDecoded = null) => {
    setNewFiles(prev => { const { cccdQR, ...rest } = prev; return rest; });
    setQrBusy(true); setQrErr(null); setQrInfo(null);
    try {
      let out;
      if (preDecoded && preDecoded.fields && preDecoded.fields.idNumber) {
        out = { ok: true, fields: preDecoded.fields, raw: preDecoded.raw };
      } else if (file) {
        out = await window.MGT_QR.scanFile(file);
      } else {
        throw new Error("qr");
      }
      if (!out || !out.ok || !out.fields || !out.fields.idNumber) throw new Error("qr");
      out.fields.qrRaw = out.raw;
      setQrInfo(out.fields);
      if (file) {
        setNewFiles(prev => ({ ...prev, cccdQR: file }));
        draftSavePhoto(student.id, 'cccdQR', file);
      } else {
        gToast("Quét thành công nhưng ảnh QR chưa lưu được. Bấm vào ô QR để chụp lại.", "info");
      }
    } catch (e) {
      setQrErr("Không đọc được mã QR. Hãy giữ yên, chụp lại ảnh rõ nét hơn.");
    } finally { setQrBusy(false); }
  };

  // Task 7: canSubmit allows retry when there are pending uploads
  const busyOp = busyRef.current || retryBusyRef.current;
  const canSubmit = !busyOp && !qrBusy && (isDirty || hasPendingUploads) && (!qrReplaced || !!qrInfo?.idNumber);

  // Task 7: submit now collects upload results — never shows success if required docs failed
  const submit = async () => {
    if (busyRef.current || retryBusyRef.current || !canSubmit) return;
    busyRef.current = true;
    try {
      setResult({ status: 'creating' });
      // 1) Update fields
      const patch = {};
      if (phone   !== (student.phone   || "")) patch.phone   = phone   || null;
      if (licence !== (student.licence || "")) patch.licence = licence || null;
      if (qrReplaced && qrInfo?.idNumber)      patch.idNumber = qrInfo.idNumber;
      if (qrReplaced && qrInfo?.address)       patch.address  = qrInfo.address;
      if (qrReplaced && qrInfo?.qrRaw)         patch.cccdQrRaw = qrInfo.qrRaw;
      if (Object.keys(patch).length) {
        try { await D.api.updateStudent(student.id, patch); }
        catch (e) { if (!mountedRef.current) return; setResult({ status: 'failed', errMsg: e?.message || 'Có lỗi xảy ra.', failedDocs: [] }); return; }
      }
      // 2) Upload photos, collect results
      if (!mountedRef.current) return;
      setResult({ status: 'uploading' });
      const entries = Object.entries(newFiles).filter(([, f]) => !!f);
      if (entries.length === 0) {
        if (mountedRef.current) { setResult(null); gToast("Đã lưu thay đổi.", "success"); }
        return;
      }
      const results = [];
      for (const [key, file] of entries) {
        try { await D.api.uploadStudentDoc(student.id, key, file); results.push({ key, ok: true }); }
        catch (e) { results.push({ key, ok: false, error: e?.message || 'Thất bại' }); }
      }
      if (!mountedRef.current) return;
      const failedRequired = results.filter(r => !r.ok && CTV_REQUIRED_DOCS.includes(r.key));
      if (failedRequired.length === 0) {
        // Full success — clear state
        setNewFiles({}); setQrInfo(null);
        draftClearPhotos(student.id);
        setResult(null);
        gToast("Đã lưu thay đổi.", "success");
      } else {
        // Partial — keep files for retry, show which failed
        setResult({ status: 'partial', failedDocs: failedRequired });
      }
    } catch (e) {
      if (mountedRef.current) setResult({ status: 'failed', errMsg: e?.message || 'Có lỗi xảy ra.', failedDocs: [] });
    } finally { busyRef.current = false; }
  };

  // Task 7: retry only the failed uploads (detail view)
  const retryFailedUploads = async () => {
    if (retryBusyRef.current) return;
    const failedDocs = result?.failedDocs;
    if (!failedDocs || !failedDocs.length) return;
    // Clone to avoid stale closure issues
    const docsToRetry = [...failedDocs];
    retryBusyRef.current = true;
    try {
      setRetryBusy(true);
      setResult(prev => ({ ...prev, status: 'uploading' }));
      const retryResults = [];
      for (const d of docsToRetry) {
        const file = newFiles[d.key];
        if (!file) { retryResults.push({ key: d.key, ok: false, error: 'File không còn' }); continue; }
        try { await D.api.uploadStudentDoc(student.id, d.key, file); retryResults.push({ key: d.key, ok: true }); }
        catch (e) { retryResults.push({ key: d.key, ok: false, error: e?.message || 'Thất bại' }); }
      }
      if (!mountedRef.current) return;
      const stillFailed = retryResults.filter(r => !r.ok);
      if (stillFailed.length === 0) {
        setNewFiles({}); setQrInfo(null); draftClearPhotos(student.id);
        setResult(null); gToast("Đã tải lại ảnh thành công.", "success");
      } else {
        setResult(prev => ({ ...prev, status: 'partial', failedDocs: stillFailed }));
      }
    } catch (e) {
      if (mountedRef.current) setResult(prev => prev ? { ...prev, status: 'partial' } : null);
    } finally { retryBusyRef.current = false; setRetryBusy(false); }
  };

  const cls = D.getClass(student.classId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: "18px 16px", borderRadius: 16, background: "var(--glass-2)",
                    border: "1px solid var(--glass-stroke)", display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar name={student.name} size={56} glow src={student.docs_the3x4_url || null}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--fg-1)",
                        letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
                           color: cls ? "var(--neon-cyan)" : "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="calendar" size={13}/>{cls?.code || "Chưa có lớp"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={G_LABEL}>Họ tên</label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        minHeight: 40, padding: "0 14px", borderRadius: 10,
                        background: "color-mix(in oklab, var(--neon-lime) 10%, transparent)", border: "1px solid var(--neon-lime)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--fg-1)",
                           whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name || "—"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{student.dob || "—"}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <Input label="Số điện thoại" value={phone} onChange={setPhone} digits maxDigits={10} format={window.fmtPhone}/>
          <LicencePill value={licence} onChange={setLicence}/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PhotoSlot label="CCCD mặt trước" file={newFiles.cccd}     filled={!!ex.cccd}     src={student.docs_cccd_url}     onPick={(f) => pickInto("cccd", f)}/>
          <PhotoSlot label="CCCD mặt sau"   file={newFiles.cccdBack} filled={!!ex.cccdBack} src={student.docs_cccdBack_url} onPick={(f) => pickInto("cccdBack", f)}/>
          <QrSlot file={newFiles.cccdQR} filled={!!ex.cccdQR} src={student.docs_cccdQR_url} busy={qrBusy} error={qrErr}
                  ok={qrReplaced ? !!qrInfo?.idNumber : !!ex.cccdQR}
                  idNumber={qrInfo?.idNumber || (qrReplaced ? null : student.idNumber)} onPick={scanQr}/>
          <PhotoSlot label="Ảnh chân dung" file={newFiles.the3x4} filled={!!ex.the3x4} src={student.docs_the3x4_url} onPick={(f) => pickInto("the3x4", f)}/>
          <PhotoSlot label="Bằng lái cũ mặt trước" file={newFiles.bangLaiFront} filled={!!ex.bangLaiFront} src={student.docs_bangLaiFront_url} onPick={(f) => pickInto("bangLaiFront", f)}/>
          <PhotoSlot label="Bằng lái cũ mặt sau"  file={newFiles.bangLaiBack}  filled={!!ex.bangLaiBack}  src={student.docs_bangLaiBack_url} onPick={(f) => pickInto("bangLaiBack", f)}/>
        </div>
      </div>

      {/* Task 7: partial/failed upload banners */}
      {result?.status === 'partial' && (
        <div style={{ padding: "12px 14px", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8,
                      background: "color-mix(in oklab, var(--neon-amber, #f59e0b) 10%, transparent)",
                      border: "1px solid color-mix(in oklab, var(--neon-amber, #f59e0b) 40%, transparent)" }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--neon-amber, #f59e0b)" }}>
            Một số ảnh chưa tải lên được:
          </span>
          {(result.failedDocs || []).map(d => (
            <span key={d.key} style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-2)" }}>
              {DOC_LABELS[d.key] || d.key}
            </span>
          ))}
          {retryBusy && <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>Đang tải lại…</span>}
          {!retryBusy && <button onClick={retryFailedUploads} style={{
            marginTop: 4, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "var(--neon-amber, #f59e0b)", color: "#000",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, width: "100%",
          }}>Tải lại ảnh còn thiếu</button>}
        </div>
      )}
      {result?.status === 'failed' && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--neon-pink)",
                      padding: "8px 12px", borderRadius: 10,
                      background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
                      border: "1px solid var(--neon-pink)" }}>
          {result.errMsg || "Có lỗi xảy ra. Thử lại, hoặc liên hệ quản trị viên."}
        </div>
      )}

      <button onClick={submit} disabled={!canSubmit} style={{
        padding: "14px 16px", borderRadius: 14, border: "none", cursor: canSubmit ? "pointer" : "not-allowed",
        background: canSubmit ? "var(--neon-cyan)" : "var(--glass-2)", color: canSubmit ? "var(--ink-0)" : "var(--fg-3)",
        boxShadow: canSubmit ? "0 0 0 1px var(--neon-cyan), 0 0 18px var(--neon-cyan-haze)" : "none",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: (result?.status === 'creating' || result?.status === 'uploading') ? 0.6 : 1,
      }}>
        <Icon name="check" size={16}/>
        {result?.status === 'creating' ? "Đang lưu…" :
         result?.status === 'uploading' ? "Đang tải ảnh…" :
         hasPendingUploads ? "Lưu thay đổi" :
         !isDirty ? "Không có thay đổi" :
         (qrReplaced && !qrInfo?.idNumber) ? "Chờ QR hợp lệ" : "Lưu thay đổi"}
      </button>
    </div>
  );
}

// --------------------------------------------------------------------
// Add modal — name auto-fills from QR; force-pick phone, hạng bằng, lớp,
// and all photos. classId limited to this CTV's assigned ACTIVE classes.
// --------------------------------------------------------------------
function GuestAddStudentModal({ open, onClose }) {
  const D = window.MGT_DATA;
  const [name,    setName]    = React.useState("");
  const [phone,   setPhone]   = React.useState("");
  const [licence, setLicence] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [docFiles, setDocFiles] = React.useState({});
  const [qrInfo, setQrInfo] = React.useState(null);
  const [qrErr,  setQrErr]  = React.useState(null);
  const [qrBusy, setQrBusy] = React.useState(false);
  // Task 7: unified result state replaces busy/err/success
  const [result, setResult] = React.useState(null); // null | { status, errMsg, studentId, name, licence, classCode, failedDocs }
  const [retryBusy, setRetryBusy] = React.useState(false);
  const [dupErr, setDupErr] = React.useState(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const busyRef = React.useRef(false);
  const retryBusyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const DRAFT_KEY = "mgt_guest_add_draft";

  // Detect a duplicate CCCD already in the system for the given idNumber.
  const isDuplicateCccd = React.useCallback((idNumber) => {
    try {
      return !!idNumber && (window.MGT_DATA.students || []).some(s => s.idNumber && s.idNumber === idNumber);
    } catch { return false; }
  }, []);

  // On OPEN: restore text draft. On CLOSE: persist text draft (not Files).
  const prevOpen = React.useRef(open);
  React.useEffect(() => {
    const wasOpen = prevOpen.current;
    prevOpen.current = open;
    if (open && !wasOpen) {
      // Opening — reset transient state, then pre-fill from saved draft.
      setDocFiles({}); setQrErr(null); setQrBusy(false);
      setResult(null); setRetryBusy(false); setDupErr(null); setShowErrors(false);
      busyRef.current = false; retryBusyRef.current = false;
      let draft = null;
      try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) draft = JSON.parse(raw); } catch {}
      setName(draft?.name || "");
      setPhone(draft?.phone || "");
      setLicence(draft?.licence || "");
      setClassId(draft?.classId || "");
      setQrInfo(draft?.qrInfo || null);
      if (draft?.qrInfo?.idNumber && isDuplicateCccd(draft.qrInfo.idNumber)) {
        setDupErr("CCCD này đã có hồ sơ trong hệ thống.");
      }
      // Restore photos from IndexedDB (async — they pop in after text fields).
      (async () => {
        const keys = ['cccd', 'cccdBack', 'cccdQR', 'the3x4', 'bangLaiFront', 'bangLaiBack'];
        const files = {};
        for (const k of keys) { const f = await draftLoadPhoto('new', k); if (f) files[k] = f; }
        if (Object.keys(files).length) setDocFiles(prev => ({ ...prev, ...files }));
      })();
    } else if (!open && wasOpen) {
      // Closing — save text fields + qrInfo so an accidental exit is recoverable.
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, phone, licence, classId, qrInfo }));
      } catch {}
    }
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  // CTV's assigned, active classes only.
  const myClassIds = new Set(D.currentUser.classIds || []);
  const classOpts = D.classes
    .filter(c => myClassIds.has(c.id) && (c.status === "đang mở" || c.status === "đang diễn ra"))
    .map(c => ({ value: c.id, label: c.code }));

  const pickInto = (key, file) => { if (file) { setDocFiles(prev => ({ ...prev, [key]: file })); draftSavePhoto('new', key, file); } };

  const scanQr = async (file, preDecoded = null) => {
    setDocFiles(prev => { const { cccdQR, ...rest } = prev; return rest; });
    setQrBusy(true); setQrErr(null);
    try {
      let out;
      if (preDecoded && preDecoded.fields && preDecoded.fields.idNumber) {
        out = { ok: true, fields: preDecoded.fields, raw: preDecoded.raw };
      } else if (file) {
        out = await window.MGT_QR.scanFile(file);
      } else {
        throw new Error("qr");
      }
      if (!out || !out.ok || !out.fields || !out.fields.idNumber) throw new Error("qr");
      out.fields.qrRaw = out.raw;
      setQrInfo(out.fields);
      setName(out.fields.name || "");
      if (file) {
        setDocFiles(prev => ({ ...prev, cccdQR: file }));
        draftSavePhoto('new', 'cccdQR', file);
      } else {
        gToast("Quét thành công nhưng ảnh QR chưa lưu được. Bấm vào ô QR để chụp lại.", "info");
      }
      setDupErr(isDuplicateCccd(out.fields.idNumber) ? "CCCD này đã có hồ sơ trong hệ thống." : null);
    } catch (e) {
      setQrInfo(null); setName(""); setDupErr(null);
      setQrErr("Không đọc được mã QR. Giữ yên điện thoại, chụp lại ảnh rõ nét hơn.");
    } finally { setQrBusy(false); }
  };

  // Required fields (bangLai OPTIONAL). Phone must be a full 10 digits.
  const phoneDigits = window.digitsOnly ? window.digitsOnly(phone) : String(phone || "").replace(/[^0-9]/g, "");
  const missing = {
    qr: !qrInfo?.idNumber || !docFiles.cccdQR, name: !name.trim(), phone: phoneDigits.length !== 10,
    licence: !licence, classId: !classId,
    cccd: !docFiles.cccd, cccdBack: !docFiles.cccdBack, the3x4: !docFiles.the3x4,
  };
  const isComplete = !Object.values(missing).some(Boolean);
  const missingList = [
    missing.qr && "quét QR CCCD", missing.name && "họ tên", missing.phone && "SĐT đủ 10 số",
    missing.licence && "hạng bằng", missing.classId && "lớp",
    missing.cccd && "ảnh CCCD trước", missing.cccdBack && "ảnh CCCD sau", missing.the3x4 && "ảnh chân dung",
  ].filter(Boolean).join(", ");
  // Red outline on a required field — only after a failed THÊM (outline adds
  // no layout height, so the dialog doesn't grow).
  const outErr = (bad) => bad ? { outline: "2px solid var(--neon-pink)", outlineOffset: 2 } : null;

  const submit = async () => {
    if (busyRef.current || retryBusyRef.current) return;
    if (qrBusy) { gToast("Đang xử lý mã QR, đợi một chút…", "info"); return; }
    if (dupErr || !isComplete) {
      setShowErrors(true);
      gToast(dupErr ? "CCCD này đã có hồ sơ." : "Còn thiếu thông tin bắt buộc.", "error");
      return;
    }
    if (isDuplicateCccd(qrInfo?.idNumber)) {
      setDupErr("CCCD này đã có hồ sơ trong hệ thống."); setShowErrors(true);
      gToast("CCCD này đã có hồ sơ.", "error");
      return;
    }
    busyRef.current = true;
    try {
      setResult({ status: 'creating' });
      const form = {
        name: name.trim(), phone: phone.trim() || null, licence, classId: classId || null,
        idNumber: qrInfo.idNumber,
        ...(qrInfo.dob && { dob: qrInfo.dob }),
        ...(qrInfo.gender && { gender: qrInfo.gender }),
        ...(qrInfo.address && { address: qrInfo.address }),
        ...(qrInfo.ngayCapCCCD && { ngayCapCCCD: qrInfo.ngayCapCCCD }),
        ...(qrInfo.qrRaw && { cccdQrRaw: qrInfo.qrRaw }),
      };
      const uploadMap = { cccd: docFiles.cccd, cccdBack: docFiles.cccdBack, cccdQR: docFiles.cccdQR, the3x4: docFiles.the3x4,
                          bangLaiFront: docFiles.bangLaiFront, bangLaiBack: docFiles.bangLaiBack };
      const docs = { cccd: !!uploadMap.cccd, cccdBack: !!uploadMap.cccdBack, cccdQR: !!uploadMap.cccdQR, the3x4: !!uploadMap.the3x4,
                     bangLaiFront: !!uploadMap.bangLaiFront, bangLaiBack: !!uploadMap.bangLaiBack };
      let created;
      try {
        created = await D.api.createStudent({ form, docs, profileComplete: false });
      } catch (e) {
        if (!mountedRef.current) return;
        const msg = e?.message || String(e);
        if (e?.code === "duplicate_cccd" || /duplicate/i.test(msg)) {
          setDupErr("CCCD này đã có hồ sơ trong hệ thống.");
        }
        setResult({ status: 'failed', errMsg: msg, studentId: null, name: form.name, licence: form.licence,
                    classCode: D.getClass(form.classId)?.code || "—", failedDocs: [] });
        return;
      }
      // Student created — drop text draft (student data is on server now).
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      // Task 7: upload docs and COLLECT results — never swallow failures.
      if (!mountedRef.current) return;
      setResult({ status: 'uploading', studentId: created.id, name: form.name, licence: form.licence,
                  classCode: D.getClass(form.classId)?.code || "—", failedDocs: [] });
      const results = [];
      for (const [key, file] of Object.entries(uploadMap)) {
        if (!file) continue;
        try { await D.api.uploadStudentDoc(created.id, key, file); results.push({ key, ok: true }); }
        catch (e) { results.push({ key, ok: false, error: e?.message || 'Thất bại' }); }
      }
      if (!mountedRef.current) return;
      const failedRequired = results.filter(r => !r.ok && CTV_REQUIRED_DOCS.includes(r.key));
      if (failedRequired.length === 0) {
        // Full success — ALL required docs uploaded
        draftClearPhotos('new');
        setResult({ status: 'full', studentId: created.id, name: form.name, licence: form.licence,
                    classCode: D.getClass(form.classId)?.code || "—", failedDocs: [] });
      } else {
        // Partial success — student exists but required docs missing. Keep draft for retry.
        setResult({ status: 'partial', studentId: created.id, name: form.name, licence: form.licence,
                    classCode: D.getClass(form.classId)?.code || "—", failedDocs: failedRequired });
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setResult({ status: 'failed', errMsg: e?.message || 'Có lỗi xảy ra.', studentId: null,
                  name: name.trim(), licence, classCode: D.getClass(classId)?.code || "—", failedDocs: [] });
    } finally { busyRef.current = false; }
  };

  // Task 7: retry only the failed uploads (add modal)
  const retryFailedUploads = async () => {
    if (retryBusyRef.current || !result?.studentId) return;
    const failedDocs = result?.failedDocs;
    if (!failedDocs || !failedDocs.length) return;
    const docsToRetry = [...failedDocs]; // clone to avoid stale closure
    retryBusyRef.current = true;
    try {
      setRetryBusy(true);
      setResult(prev => prev ? { ...prev, status: 'uploading' } : prev);
      const retryResults = [];
      for (const d of docsToRetry) {
        const file = docFiles[d.key];
        if (!file) { retryResults.push({ key: d.key, ok: false, error: 'File không còn' }); continue; }
        try { await D.api.uploadStudentDoc(result.studentId, d.key, file); retryResults.push({ key: d.key, ok: true }); }
        catch (e) { retryResults.push({ key: d.key, ok: false, error: e?.message || 'Thất bại' }); }
      }
      if (!mountedRef.current) return;
      const stillFailed = retryResults.filter(r => !r.ok);
      if (stillFailed.length === 0) {
        draftClearPhotos('new');
        setResult(prev => prev ? { ...prev, status: 'full', failedDocs: [] } : prev);
      } else {
        setResult(prev => prev ? { ...prev, status: 'partial', failedDocs: stillFailed } : prev);
      }
    } catch (e) {
      if (mountedRef.current) setResult(prev => prev ? { ...prev, status: 'partial' } : prev);
    } finally { retryBusyRef.current = false; setRetryBusy(false); }
  };

  // Task 7: derived flags for UI
  const isOperating = result?.status === 'creating' || result?.status === 'uploading';
  const hasPendingUploads = (result?.status === 'partial' || result?.status === 'failed') && (result.failedDocs || []).length > 0;

  // Task 7: partial-success banner for the add modal
  const PartialSuccessBanner = result?.status === 'partial' ? (
    <div style={{ padding: "16px", borderRadius: 14, display: "flex", flexDirection: "column", gap: 12,
                  background: "color-mix(in oklab, var(--neon-lime) 8%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--neon-lime) 30%, transparent)" }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--neon-lime)" }}>
        Hồ sơ đã tạo thành công!
      </span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--fg-2)" }}>
        Một số ảnh chưa tải lên được:
      </span>
      {(result.failedDocs || []).map(d => (
        <span key={d.key} style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>
          {DOC_LABELS[d.key] || d.key}
        </span>
      ))}
      {retryBusy && <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)" }}>Đang tải lại…</span>}
      {!retryBusy && <button onClick={retryFailedUploads} style={{
        marginTop: 4, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer",
        background: "var(--neon-cyan)", color: "var(--ink-0)",
        fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, width: "100%",
      }}>Tải lại ảnh còn thiếu</button>}
    </div>
  ) : null;

  return (
    <Modal open={open} onClose={onClose} width={GUEST_MAX_WIDTH}
           footer={result?.status === 'full' ? (
             <Button variant="primary" onClick={onClose} icon="x"
                     style={{ width: "100%", justifyContent: "center", padding: "16px", fontSize: 15 }}>Đóng</Button>
           ) : result?.status === 'partial' ? (
             <Button variant="primary" onClick={onClose} icon="x"
                     style={{ width: "100%", justifyContent: "center", padding: "16px", fontSize: 15 }}>Đóng</Button>
           ) : (
             <div style={{ display: "flex", gap: 10 }}>
               <Button variant="ghost" onClick={onClose}
                       style={{ flex: 1, justifyContent: "center", padding: "16px", fontSize: 15 }}>HỦY</Button>
               <Button variant="primary" onClick={submit} disabled={isOperating || retryBusy}
                       style={{ flex: 1, justifyContent: "center", padding: "16px", fontSize: 15 }}>
                 {result?.status === 'creating' ? "Đang lưu…" : result?.status === 'uploading' ? "Đang tải ảnh…" : "THÊM"}
               </Button>
             </div>
           )}>
      {result?.status === 'full' ? <GuestSuccessView info={result}/> : result?.status === 'partial' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PartialSuccessBanner}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {result?.status === 'failed' && (
            <div style={{ padding: "8px 12px", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 11,
                          background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
                          color: "var(--neon-pink)", border: "1px solid var(--neon-pink)" }}>
              {result.errMsg || "Có lỗi xảy ra. Thử lại, hoặc liên hệ quản trị viên."}
            </div>
          )}
          <Select label="Lớp" value={classId} onChange={setClassId} placeholder="Chọn lớp" options={classOpts}
                  success={!missing.classId} invalid={showErrors && missing.classId}/>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={G_LABEL}>Họ tên</label>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                          minHeight: 40, padding: "0 14px", borderRadius: 10,
                          background: qrInfo ? "color-mix(in oklab, var(--neon-lime) 10%, transparent)" : "var(--ink-2)",
                          border: `1px solid ${qrInfo ? "var(--neon-lime)" : "var(--glass-stroke)"}`,
                          ...outErr(showErrors && missing.name) }}>
              {qrInfo ? (<>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--fg-1)",
                               whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name || "—"}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{qrInfo.dob || "—"}</span>
              </>) : (
                <span style={{ ...G_LABEL, fontSize: 11, color: "var(--fg-3)" }}>(Quét mã QR để tự điền)</span>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
            <Input label="Số điện thoại" value={phone} onChange={setPhone} placeholder="090 123 4567" digits maxDigits={10} format={window.fmtPhone}
                   success={!missing.phone} invalid={showErrors && missing.phone}/>
            <LicencePill value={licence} onChange={setLicence} invalid={showErrors && missing.licence}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <PhotoSlot label="CCCD mặt trước" file={docFiles.cccd} invalid={showErrors && missing.cccd} onPick={(f) => pickInto("cccd", f)}/>
            <PhotoSlot label="CCCD mặt sau" file={docFiles.cccdBack} invalid={showErrors && missing.cccdBack} onPick={(f) => pickInto("cccdBack", f)}/>
            <QrSlot file={docFiles.cccdQR} busy={qrBusy} ok={!!qrInfo?.idNumber} idNumber={qrInfo?.idNumber} invalid={showErrors && missing.qr} error={qrErr} onPick={scanQr}/>
            <PhotoSlot label="Ảnh chân dung" file={docFiles.the3x4} invalid={showErrors && missing.the3x4} onPick={(f) => pickInto("the3x4", f)}/>
            <PhotoSlot label="Bằng lái cũ mặt trước" file={docFiles.bangLaiFront} onPick={(f) => pickInto("bangLaiFront", f)}/>
            <PhotoSlot label="Bằng lái cũ mặt sau"  file={docFiles.bangLaiBack}  onPick={(f) => pickInto("bangLaiBack", f)}/>
          </div>
          {dupErr && <div style={G_ERROR_BANNER}>{dupErr}</div>}
          {showErrors && missingList && (
            <div style={{ padding: "8px 12px", borderRadius: 10, fontFamily: "var(--font-ui)", fontSize: 12,
                          background: "color-mix(in oklab, var(--neon-pink) 12%, transparent)",
                          color: "var(--neon-pink)", border: "1px solid var(--neon-pink)" }}>
              Còn thiếu: {missingList}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function GuestSuccessView({ info }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "12px 8px 6px" }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: "var(--neon-lime)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    animation: "mgt-success-pop 460ms cubic-bezier(0.34, 1.56, 0.64, 1) both, mgt-success-glow 2.6s ease-in-out 460ms infinite" }}>
        <Icon name="check" size={48} color="var(--ink-0)"/>
      </div>
      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700,
                   color: "var(--neon-lime)", letterSpacing: "0.04em", textAlign: "center",
                   textShadow: "0 0 16px var(--neon-lime-glow)" }}>TẠO HỒ SƠ MỚI THÀNH CÔNG!</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
        <GuestSuccessPill icon="users"    text={info.name}              delay="180ms"/>
        <GuestSuccessPill icon="bike"     text={`Hạng ${info.licence}`} delay="300ms"/>
        <GuestSuccessPill icon="calendar" text={info.classCode}          delay="420ms"/>
      </div>
    </div>
  );
}

function GuestSuccessPill({ icon, text, delay }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999,
                  background: "color-mix(in oklab, var(--neon-lime) 12%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--neon-lime) 36%, transparent)", color: "var(--neon-lime)",
                  fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, maxWidth: "90%",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0,
                  animation: `mgt-success-pill-in 320ms cubic-bezier(0.22, 1, 0.36, 1) ${delay} both` }}>
      <Icon name={icon} size={14}/>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}

function GuestAuthedImage({ file, src, style }) {
  // file = freshly-picked File (objectURL preview); src = existing server
  // path (/api/files/... — same-origin, cookie-auth, so a plain <img> works).
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (file) { const obj = URL.createObjectURL(file); setUrl(obj); return () => URL.revokeObjectURL(obj); }
    // Native (Bearer auth): server files need the Authorization header, so a
    // plain <img src> would 401 — fetch as a blob instead. Web (cookie) just
    // uses the path directly.
    if (src && window.MGT_TOKEN) {
      let obj = null, alive = true;
      const full = /^https?:/.test(src) ? src : (window.MGT_API_BASE || "") + src;
      fetch(full, { headers: { Authorization: "Bearer " + window.MGT_TOKEN } })
        .then(r => r.ok ? r.blob() : null)
        .then(b => { if (alive && b) { obj = URL.createObjectURL(b); setUrl(obj); } })
        .catch(() => {});
      return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
    }
    setUrl(src || null);
  }, [file, src]);
  if (!url) return null;
  return <img src={url} alt="" style={style}/>;
}

function QrSlot({ file, filled, busy, ok, idNumber, invalid, error, src, onPick }) {
  const hasImg = !!file || !!src;
  const hasPhoto = hasImg || !!filled;
  // QR slot capture: live capturer (full-res, decode-gated) with a library
  // fallback. If the capturer isn't loaded, falls back to the file picker.
  const open = async () => {
    if (busy) return;
    let f = null, preDecoded = null;
    if (window.MGT_CAPTURE) {
      const r = await window.MGT_CAPTURE.open();
      if (r === null) return;                                   // cancelled
      f = r.file || (r.fallback ? await gPickPhoto() : null);   // library fallback
      // If native scanner already decoded the QR (ML Kit), pass it through
      // so scanQr can skip the redundant client-side re-decode.
      if (r.raw && r.fields) preDecoded = { raw: r.raw, fields: r.fields };
    } else {
      f = await gPickPhoto();
    }
    if (f || preDecoded) onPick(f, preDecoded);
  };
  const border = busy ? "2px solid var(--neon-cyan)" : ok ? "3px solid var(--neon-lime)" : (invalid || error) ? "2px solid var(--neon-pink)" : "1px dashed var(--glass-stroke-strong)";
  const chip = { position: "absolute", left: 8, bottom: 6, zIndex: 1, padding: "2px 8px", borderRadius: 8,
                 background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 600 };
  return (
    <button type="button" onClick={open} disabled={busy} style={{
      position: "relative", overflow: "hidden", width: "100%", padding: file ? 0 : "16px 12px", borderRadius: 12,
      cursor: busy ? "wait" : "pointer", textAlign: "center", background: "var(--ink-2)", border,
      color: ok ? "var(--neon-lime)" : (invalid || error) ? "var(--neon-pink)" : "var(--fg-2)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      minHeight: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
    }}>
      {hasImg ? (
        <GuestAuthedImage file={file} src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: busy ? 0.4 : 1 }}/>
      ) : (<>
        <span>Mã QR trên CCCD</span>
        {error ? <span style={{ color: "var(--neon-pink)", fontSize: 11, fontWeight: 600, padding: "0 6px" }}>{error}</span>
               : (!filled && <Icon name="plus" size={36} color="var(--fg-3)"/>)}
      </>)}
      {busy && <span style={{ ...chip, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>ĐANG QUÉT…</span>}
      {!busy && ok && idNumber && (
        <span style={{ ...chip, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>Mã QR {idNumber}</span>
      )}
      {!busy && hasPhoto && !idNumber && <span style={chip}>Mã QR</span>}
    </button>
  );
}

function PhotoSlot({ label, file, filled, src, invalid, onPick }) {
  const hasImg = !!file || !!src;          // an actual image to show (picked or existing)
  const has = hasImg || !!filled;          // filled = boolean-only (no URL) → "đã có"
  const open = async () => { const f = await gPickPhoto(); if (f) onPick(f); };
  return (
    <button type="button" onClick={open} style={{
      position: "relative", overflow: "hidden", width: "100%", padding: hasImg ? 0 : "16px 12px", borderRadius: 12,
      cursor: "pointer", textAlign: "center", background: "var(--ink-2)",
      border: has ? "3px solid var(--neon-lime)" : invalid ? "2px solid var(--neon-pink)" : "1px dashed var(--glass-stroke-strong)",
      color: has ? "var(--neon-lime)" : invalid ? "var(--neon-pink)" : "var(--fg-2)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600,
      minHeight: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      {hasImg ? (<>
        <GuestAuthedImage file={file} src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}/>
        <span style={{ position: "absolute", left: 8, bottom: 6, zIndex: 1, padding: "2px 8px", borderRadius: 8,
                       background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, fontWeight: 600 }}>{label}</span>
      </>) : (<>
        <span>{label}</span>
        {filled ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--neon-lime)" }}>ĐÃ CÓ ẢNH</span>
                : <Icon name="plus" size={36} color="var(--fg-3)"/>}
      </>)}
    </button>
  );
}

function GuestUserChip({ me, count }) {
  const D = window.MGT_DATA;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const logout = async () => { try { await D.api.logout(); } catch {} };
  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", width: "80%", minWidth: 0 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        background: open ? "var(--ink-2)" : "transparent", border: "1px solid",
        borderColor: open ? "var(--glass-stroke-strong)" : "transparent", borderRadius: 14, padding: "10px 14px",
        cursor: "pointer", flex: 1, minWidth: 0, textAlign: "left", fontFamily: "inherit",
        transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
      }}>
        <Avatar name={me.name} size={36}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--neon-cyan)",
                        textShadow: "0 0 14px var(--neon-cyan-glow)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.name}</div>
          <div style={{ ...G_LABEL, fontSize: 10, letterSpacing: "0.12em", display: "flex",
                        justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 3 }}>
            <span style={{ whiteSpace: "nowrap" }}>Cộng tác viên</span>
            <span style={{ whiteSpace: "nowrap" }}>{count} hồ sơ</span>
          </div>
        </div>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, minWidth: 200, padding: 4, borderRadius: 12,
                      background: "var(--glass-3)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)",
                      border: "1px solid var(--glass-stroke-strong)", boxShadow: "var(--shadow-3)" }}>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px",
                  borderRadius: 8, cursor: "pointer", background: "transparent", border: "none", color: "var(--neon-pink)",
                  fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, textAlign: "left" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in oklab, var(--neon-pink) 12%, transparent)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <Icon name="logout" size={14}/>Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function GuestThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isLight = theme === "light";
  return (
    <button onClick={() => setTheme(isLight ? "dark" : "light")} title={isLight ? "Chuyển sang Dark" : "Chuyển sang Light"}
            style={{ width: 36, height: 36, borderRadius: 999, cursor: "pointer", background: "var(--glass-2)",
                     border: "1px solid var(--glass-stroke)", color: isLight ? "#D97500" : "var(--neon-cyan)",
                     display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 160ms var(--ease-out)",
                     boxShadow: isLight ? "0 0 12px rgba(217,117,0,0.35)" : "0 0 12px var(--neon-cyan-haze)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {isLight
          ? (<g><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></g>)
          : (<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>)}
      </svg>
    </button>
  );
}

function LicencePill({ value, onChange, invalid = false, options = [{ id: "A1", label: "A1" }, { id: "A", label: "A" }] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={G_LABEL}>Hạng bằng</label>
      <div style={{ display: "inline-flex", padding: 3, gap: 3, background: "var(--ink-2)",
                    border: `1px solid ${invalid ? "var(--neon-pink)" : "var(--glass-stroke)"}`, borderRadius: 10, height: 40, alignItems: "stretch" }}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{
              flex: 1, padding: "0 14px", borderRadius: 8, cursor: "pointer",
              background: active ? "var(--neon-lime)" : "transparent", color: active ? "var(--ink-0)" : "var(--fg-2)",
              border: "none", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600,
              boxShadow: active ? "0 0 12px var(--neon-lime-glow)" : "none", transition: "all 140ms var(--ease-out)",
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { GuestApp });
