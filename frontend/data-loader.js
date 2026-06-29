// data-loader.js — HTTP-backed loader replacing the original CSV reader.
// Mirrors the frozen `window.MGT_DATA` contract from frontend/CLAUDE.md.
// Derived fields (paid/balance/paymentStatus/class.status) are recomputed
// locally per "derived fields are NEVER read from the wire".

(function () {
  const API = (window.MGT_API_BASE || '') + '/api';

  // Print mode (?print=dashboard) — inject stylesheet that paginates one
  // section per PDF page and kills the breathing-card animations so
  // playwright doesn't capture a mid-frame. Light theme is forced by
  // ThemeProvider; this stylesheet is layout / animation only.
  try {
    if (new URLSearchParams(window.location.search).get('print') === 'dashboard') {
      const css = document.createElement('style');
      css.textContent = `
        /* Exactly one section per page. KPI strip is hidden so the
           first section (Tổng) gets a clean page-1 to itself. */
        .mgt-print-hide { display: none !important; }
        .mgt-print-section + .mgt-print-section { break-before: page; page-break-before: always; }
        /* Live screen uses display:contents on these wrappers so they're
           invisible to layout. In print we override to block so the
           page-break-before rule has a box to break against. zoom + svg
           cap shrink So sánh's stacked charts to fit one A4 landscape. */
        .mgt-print-section { display: block !important; break-inside: avoid-page; zoom: 0.78; }
        .mgt-print-section svg { max-height: 200px !important; }
        /* Kill breathing/glow animations so the render is deterministic. */
        *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }
        /* Drop the page outer padding so each section fills the A4 page. */
        body, .mgt-canvas { background: #ffffff !important; }
        .mgt-canvas { padding: 12px !important; gap: 0 !important; }
        /* Suppress backdrop blur in print to avoid heavy raster output. */
        * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        /* @page is owned by playwright's page.pdf() — don't set it here
           or it conflicts with the scale: option. */
      `;
      document.head.appendChild(css);
    }
  } catch {}
  const p2  = (n) => String(n).padStart(2, '0');

  // Decode userId (sub claim) from a JWT without verifying the signature.
  // Used to scope the offline cache key per user — a failed decode falls
  // back to the login overlay, so no cross-user data is ever shown.
  function _decodeUserId(token) {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.sub || null;
    } catch { return null; }
  }

  // Per-user cache key. Before login (userId unknown), uses a sentinel
  // that is never read — boot always hits the API first on web.
  function _cacheKey(userId) {
    return userId ? `mgt_snapshot_v1_${userId}` : '_mgt_snapshot_v1_pending';
  }

  // Remove all mgt_snapshot_v1* keys (old format + all user-scoped).
  function _clearAllSnapshotCaches() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mgt_snapshot_v1')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  // ── Human-readable Vietnamese error mapping ───────────────────────
  // Every message: WHAT happened (plain Vietnamese) + WHAT TO DO (explicit action).
  function _humanError(err, ctx) {
    if (!err) return 'Có lỗi xảy ra. Liên hệ quản trị viên để được hỗ trợ.';
    const msg = String(err.message || err || '');

    // Network errors — most common on mobile
    const net = !navigator.onLine || err instanceof TypeError || /failed to fetch|network|NetworkError/i.test(msg);
    if (net) return 'Thiết bị không có kết nối internet. Kiểm tra WiFi hoặc sóng điện thoại, rồi thử lại.';

    if (/timeout/i.test(msg)) return 'Kết nối quá chậm — ảnh chưa tải lên được. Kiểm tra mạng rồi bấm "Thử lại".';

    // HTTP status codes (from api() or _upload: "403 /students/xxx ...")
    const m = msg.match(/^(\d{3})/);
    if (m) {
      const s = parseInt(m[1], 10);
      const detail = msg.replace(/^\d{3}\s*\S*\s*/, '');
      if (s === 400) {
        if (/file_too_large/i.test(detail))
          return 'Ảnh quá lớn (tối đa 8MB). Mở camera, chọn chất lượng thấp hơn rồi chụp lại.';
        if (/invalid_key/i.test(detail))
          return 'Loại tài liệu không hợp lệ. Liên hệ quản trị viên.';
        return 'Thông tin không hợp lệ. Kiểm tra lại các trường đã nhập và thử lại.';
      }
      if (s === 401)
        return 'Sai email hoặc mật khẩu. Kiểm tra lại thông tin đăng nhập.';
      if (s === 403)
        return 'Bạn không có quyền thao tác trên hồ sơ này. Liên hệ quản trị viên nếu cần.';
      if (s === 404)
        return 'Không tìm thấy hồ sơ. Hồ sơ có thể đã bị xóa — liên hệ quản trị viên.';
      if (s === 409)
        return 'Số CCCD này đã có trong hệ thống. Kiểm tra lại hoặc liên hệ quản trị viên.';
      if (s >= 500)
        return 'Hệ thống đang gặp sự cố. Đợi vài giây rồi thử lại. Nếu lỗi kéo dài, liên hệ quản trị viên.';
    }

    return 'Có lỗi xảy ra. Thử lại, hoặc liên hệ quản trị viên để được hỗ trợ.';
  }

  // ── Fetch with timeout — prevents infinite "Đang lưu..." hangs ────
  // Each attempt gets its own 30s budget. Throws { message: 'timeout', retryable: true }
  // so the retry layer (Task #8) can re-attempt automatically.
  async function _fetchWithTimeout(url, opts, ms = 30000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (e) {
      if (e.name === 'AbortError') {
        const err = new Error('timeout');
        err.retryable = true;  // retryable — Task #8 will re-attempt
        throw err;
      }
      throw e;
    } finally { clearTimeout(timer); }
  }

  // ── Retry with exponential backoff — for flaky mobile uploads ─────
  // Retries `fn` up to `attempts` times. Only retries when:
  //   • e.retryable === true  (explicit — set by _fetchWithTimeout or _upload)
  //   • e.retryable is unset  AND message matches network/timeout/5xx/429
  // Never retries 400/403/409 (terminal errors).
  async function _retryWithBackoff(fn, { attempts = 3, baseMs = 800, maxMs = 8000, onRetry } = {}) {
    for (let i = 0; i < attempts; i++) {
      try { return await fn(); }
      catch (e) {
        const retryable = e && (
          e.retryable === true ||
          (e.retryable !== false && /failed to fetch|timeout|network|5\d\d|429/i.test(e.message || ''))
        );
        if (!retryable || i === attempts - 1) throw e;
        if (onRetry) onRetry(i);
        const delay = Math.min(baseMs * Math.pow(2, i) + Math.random() * 400, maxMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async function api(path, opts = {}) {
    if (window._MGT_OFFLINE && opts.method && opts.method !== 'GET') {
      throw new Error('Không có kết nối internet. Bật WiFi hoặc kiểm tra sóng điện thoại rồi thử lại.');
    }
    const res = await fetch(API + path, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(window.MGT_TOKEN ? { Authorization: 'Bearer ' + window.MGT_TOKEN } : {}), ...(opts.headers || {}) },
      ...opts,
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    });
    if (res.status === 401 && path !== '/me') {
      _clearAllSnapshotCaches();
      // Also clear all user-scoped draft keys — auth failure means the
      // session is invalid and drafts may belong to a stale user.
      try {
        const dk = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mgt_guest_add_draft_')) dk.push(k);
        }
        dk.forEach(k => localStorage.removeItem(k));
      } catch {}
      window.location.reload();
      throw new Error('auth_required');
    }
    if (!res.ok) {
      let detail = ''; try { detail = JSON.stringify(await res.json()); } catch {}
      throw new Error(_humanError({ message: `${res.status} ${path} ${detail}` }, 'api'));
    }
    return res.json();
  }

  // dd/mm/yyyy [HH:MM:SS] → ms-epoch.
  function parseDT(s) {
    if (!s) return 0;
    const [d, m, y, hh = 0, mm = 0, ss = 0] = s.trim().split(/[\/\s:]/).map(n => parseInt(n, 10));
    return new Date(y, m - 1, d, hh, mm, ss).getTime();
  }

  // Lightweight transient toast — vanilla DOM, no React dep. Used for
  // "Tính năng đang phát triển" placeholders, soft-failure notices,
  // etc. Stacks bottom-right; auto-dismisses after `ms` (default 2.6s).
  window.MGT_TOAST = (msg, opts = {}) => {
    if (!msg) return;
    let host = document.getElementById('mgt-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mgt-toast-host';
      Object.assign(host.style, {
        position: 'fixed', right: '20px', bottom: '20px', zIndex: 100000,
        display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      });
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.textContent = String(msg);
    Object.assign(el.style, {
      pointerEvents: 'auto',
      fontFamily: 'var(--font-ui, system-ui, sans-serif)', fontSize: '13px', fontWeight: '500',
      color: 'var(--fg-1, #fff)',
      background: 'var(--glass-3, rgba(20,22,28,0.92))',
      border: '1px solid var(--glass-stroke-strong, rgba(255,255,255,0.16))',
      borderRadius: '12px', padding: '10px 14px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.38)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      maxWidth: '320px', opacity: '0', transform: 'translateY(6px)',
      transition: 'opacity 180ms ease-out, transform 180ms ease-out',
    });
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    const ms = opts.ms || 2600;
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
      setTimeout(() => { el.remove(); if (!host.children.length) host.remove(); }, 220);
    }, ms);
  };

  // Local Vietnamese CCCD QR scanner. Decodes a QR from an image File
  // entirely in-browser at FULL resolution, trying in order: native
  // BarcodeDetector → vendored ZXing (TRY_HARDER) → jsQR. Parses the
  // pipe-separated chip-card payload into form-field keys. No network /
  // OCR service is involved (fully offline once the libs are vendored).
  let _jsqrLoad = null; // module-level cache for the single jsQR injection
  function _loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (_jsqrLoad) return _jsqrLoad;
    _jsqrLoad = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/jsqr.min.js';
      sc.onload = () => resolve(window.jsQR);
      sc.onerror = () => reject(new Error('jsqr_load_failed'));
      document.head.appendChild(sc);
    });
    return _jsqrLoad;
  }
  let _zxingLoad = null; // vendored @zxing/library — robust ZXing decoder, offline
  function _loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (_zxingLoad) return _zxingLoad;
    _zxingLoad = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/zxing.umd.min.js';
      sc.onload = () => resolve(window.ZXing);
      sc.onerror = () => reject(new Error('zxing_load_failed'));
      document.head.appendChild(sc);
    });
    return _zxingLoad;
  }
  function _loadImg(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image_load_failed'));
      im.src = url;
    });
  }
  // Downscale large photos before upload — caps the long edge (~2400px,
  // JPEG q0.9). Keeps huge QR/detail margin for downstream re-scans while
  // keeping files reasonable. Non-images / already-small files pass through.
  async function _capImage(file, maxEdge = 2400, quality = 0.9) {
    try {
      if (!file || !/^image\//.test(file.type) || /gif|svg/.test(file.type)) return file;
      const url = URL.createObjectURL(file);
      try {
        const img = await _loadImg(url);
        const long = Math.max(img.naturalWidth, img.naturalHeight);
        if (!long || long <= maxEdge) return file;
        const scale = maxEdge / long;
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
        if (!blob) return file;
        const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
        return new File([blob], base + '.jpg', { type: 'image/jpeg' });
      } finally { URL.revokeObjectURL(url); }
    } catch { return file; }
  }
  // Draw img to a canvas, downscaling so the long edge ≤ maxEdge (0 = native).
  function _scaledCanvas(img, maxEdge) {
    let w = img.naturalWidth, h = img.naturalHeight;
    if (maxEdge && Math.max(w, h) > maxEdge) {
      const s = maxEdge / Math.max(w, h);
      w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  }
  // Crop a natural-pixel region of img and scale it to ~outEdge long-edge
  // (used to isolate a QR that's small within a busy card photo).
  function _cropCanvas(img, sx, sy, sw, sh, outEdge) {
    const s = outEdge / Math.max(sw, sh);
    const ow = Math.max(1, Math.round(sw * s)), oh = Math.max(1, Math.round(sh * s));
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
    return c;
  }
  // Try to decode a QR from a canvas: jsQR (both inversions) then ZXing
  // (TRY_HARDER). Returns the raw string or null.
  async function _decodeCanvas(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const jsQR = window.jsQR || await _loadJsQR();
      const r = jsQR(d.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) return r.data;
    } catch {}
    try {
      const ZX = window.ZXing || await _loadZxing();
      const hints = new Map();
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.QR_CODE]);
      const res = await new ZX.BrowserQRCodeReader(hints).decodeFromImageUrl(canvas.toDataURL('image/jpeg', 0.92));
      if (res && res.getText) return res.getText();
    } catch {}
    return null;
  }
  function _toVnDate(s) {
    // 8-digit "ddMMyyyy" → "dd/mm/yyyy"; anything else → null.
    if (typeof s !== 'string' || !/^\d{8}$/.test(s)) return null;
    return s.slice(0, 2) + '/' + s.slice(2, 4) + '/' + s.slice(4, 8);
  }
  window.MGT_QR = {
    // Decode a CCCD QR from an image File. Returns { ok, fields, raw, error }.
    //
    // Measured on real 12 MP phone photos: decoding the FULL-resolution image
    // almost always fails (the locator can't lock the finder patterns amid
    // sensor/JPEG noise), while a DOWNSCALED copy (~1000px) reliably succeeds
    // — downscaling acts as a denoise/low-pass filter. So we decode a ladder
    // of downscaled copies (smallest-first) with both engines (jsQR + ZXing),
    // then a tiling pass to isolate a QR that's small within a busy card.
    // The original file is untouched (saved separately at full quality).
    async scanFile(file) {
      const url = URL.createObjectURL(file);
      try {
        const img = await _loadImg(url);
        const W = img.naturalWidth, H = img.naturalHeight;
        let raw = null;

        // 0) Native BarcodeDetector on the whole image (fast; Chromium/Android).
        if ('BarcodeDetector' in window) {
          try {
            const det = new BarcodeDetector({ formats: ['qr_code'] });
            const res = await det.detect(img);
            if (res && res.length) raw = res[0].rawValue;
          } catch {}
        }

        // 1) Downscale ladder — smallest first (~1000px is the sweet spot),
        //    then larger for QRs that sit small in frame, then native.
        const scales = [1000, 1400, 1800, 2400, 0];
        for (const s of scales) {
          if (raw) break;
          raw = await _decodeCanvas(_scaledCanvas(img, s));
        }

        // 2) Tiling fallback — crop regions and blow each up to ~1200px so a
        //    small QR fills the decode frame. CCCD QR usually sits on the right.
        if (!raw && W > 800 && H > 800) {
          const R = [
            [W * 0.5, 0, W * 0.5, H], [0, 0, W * 0.5, H],                 // right / left half
            [0, 0, W, H * 0.5], [0, H * 0.5, W, H * 0.5],                 // top / bottom half
            [W * 0.25, H * 0.25, W * 0.5, H * 0.5],                       // center
            [W * 0.5, 0, W * 0.5, H * 0.5], [W * 0.5, H * 0.5, W * 0.5, H * 0.5], // right quadrants
          ];
          for (const [sx, sy, sw, sh] of R) {
            if (raw) break;
            raw = await _decodeCanvas(_cropCanvas(img, sx | 0, sy | 0, sw | 0, sh | 0, 1200));
          }
        }

        if (!raw) return { ok: false, fields: {}, raw: null, error: 'no_qr' };
        const fields = this.parseCCCD(raw);
        return { ok: Object.keys(fields).length > 0, fields, raw, error: null };
      } catch (e) {
        return { ok: false, fields: {}, raw: null, error: (e && e.message) || 'scan_failed' };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    // Parse a raw Vietnamese CCCD QR string into form fields. Exported for testing.
    parseCCCD(raw) {
      if (typeof raw !== 'string' || raw.indexOf('|') < 0) return {};
      const p = raw.split('|');
      if (p.length < 3) return {};
      const out = {};
      if (p[0]) out.idNumber = p[0];
      if (p[2]) out.name = p[2];
      const dob = _toVnDate(p[3]); if (dob) out.dob = dob;
      if (p[4]) out.gender = p[4];
      if (p[5]) out.address = p[5];
      const cap = _toVnDate(p[6]); if (cap) out.ngayCapCCCD = cap;
      return out;
    },
  };

  window.fmtVND = (n) => {
    const abs = Math.abs(Math.round(n));
    return (n < 0 ? '−' : '') + abs.toLocaleString('en-US') + 'đ';
  };
  window.fmtVNDShort = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'Mđ';
    if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.?0+$/, '') + 'Kđ';
    return n + 'đ';
  };
  // Strip non-digits — canonical store form for phone/CCCD/digit-only fields.
  window.digitsOnly = (s) => String(s || '').replace(/\D+/g, '');

  // VN mobile phone — canonical 10 digits, rendered `xxx xxx xxxx`.
  // Partial-build formatting so the mask appears WHILE the user is typing:
  //   "09" → "09" ; "0901" → "090 1" ; "0901234" → "090 123 4" ; etc.
  window.fmtPhone = (s) => {
    const d = window.digitsOnly(s).slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
    return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  };

  // VN CCCD — canonical 12 digits, rendered `xxx xxx xxx xxx`. Partial-build
  // formatting like fmtPhone so users see the spaces appear as they type.
  window.fmtCCCD = (s) => {
    // Group as 3-3-6 → "123 456 789012".
    const d = window.digitsOnly(s).slice(0, 12);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
    return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
  };

  // Money — thousands-separator with commas. Used for live-format inside
  // the input box AND for display in lists/details (alongside fmtVND which
  // adds the đ suffix). Stored value is always bare integer digits.
  window.fmtMoneyInput = (s) => {
    const d = window.digitsOnly(s);
    if (!d) return '';
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Date — build `dd/mm/yyyy` from raw digits as the user types.
  //   "1"        → "1"
  //   "12"       → "12"
  //   "1208"     → "12/08"
  //   "12082002" → "12/08/2002"
  // The stored value IS the formatted string (matches existing dd/mm/yyyy
  // column convention everywhere).
  window.fmtDateInput = (s) => {
    const d = window.digitsOnly(s).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
    return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
  };

  // Login overlay — vanilla DOM, only shown if /api/me returns 401.
  // Attaches to document.body (NOT #root) so React's reconciler doesn't
  // overwrite it on the loading-state render.
  function showLoginOverlay() {
    return new Promise((resolve) => {
      const root = document.body;
      const css = `.mgt-login{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg-0,#0b0d12);z-index:99999;font-family:var(--font-ui,system-ui,sans-serif)}
.mgt-login-card{padding:32px 28px;min-width:340px;max-width:380px;border-radius:20px;background:var(--glass-2,rgba(255,255,255,.04));border:1px solid var(--glass-stroke,rgba(255,255,255,.08));box-shadow:0 24px 60px rgba(0,0,0,.4),0 0 24px color-mix(in oklab,var(--neon-cyan,#4ad6ff) 18%,transparent)}
.mgt-login h2{margin:0;font-family:var(--font-display,inherit);font-size:22px;font-weight:600;color:var(--fg-1,#fff);letter-spacing:-.015em}
.mgt-login .sub{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-3,#888);margin:4px 0 18px}
.mgt-login label{display:block;font-size:11px;font-weight:500;color:var(--fg-2,#ccc);margin:12px 0 6px;letter-spacing:.04em}
.mgt-login input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:var(--glass-1,rgba(255,255,255,.03));border:1px solid var(--ink-4,rgba(255,255,255,.1));color:var(--fg-1,#fff);font-family:var(--font-ui,inherit);font-size:13px;outline:none}
.mgt-login input:focus{border-color:var(--neon-cyan,#4ad6ff);box-shadow:0 0 14px color-mix(in oklab,var(--neon-cyan,#4ad6ff) 30%,transparent)}
.mgt-login button{width:100%;margin-top:18px;padding:11px 16px;border-radius:12px;border:none;cursor:pointer;background:var(--neon-cyan,#4ad6ff);color:var(--bg-0,#000);font-family:var(--font-ui,inherit);font-size:13px;font-weight:600;letter-spacing:.02em;transition:filter 160ms}
.mgt-login button:hover{filter:brightness(1.08)}
.mgt-login button:disabled{opacity:.55;cursor:progress}
.mgt-login .err{margin-top:12px;padding:8px 10px;border-radius:8px;font-size:12px;background:color-mix(in oklab,var(--neon-pink,#ff5e8a) 14%,transparent);color:var(--neon-pink,#ff5e8a);display:none}`;
      const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
      const overlay = document.createElement('div'); overlay.className = 'mgt-login';
      overlay.innerHTML = `<form class="mgt-login-card" autocomplete="on">
<h2>CENTERSAI.com</h2><div class="sub">đăng nhập hệ thống CRM</div>
<label>Email</label><input name="email" type="email" autocomplete="username" required>
<label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Đăng nhập</button><div class="err"></div></form>`;
      root.appendChild(overlay);
      const form = overlay.querySelector('form'), err = overlay.querySelector('.err'), btn = overlay.querySelector('button');
      // Auto-fill saved credentials on native (set by native-bridge.js from Preferences).
      if (window.MGT_CREDS) {
        const ef = form.querySelector('input[name=email]'), pf = form.querySelector('input[name=password]');
        if (ef && window.MGT_CREDS.email) ef.value = window.MGT_CREDS.email;
        if (pf && window.MGT_CREDS.password) pf.value = window.MGT_CREDS.password;
      }
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); err.style.display = 'none'; btn.disabled = true;
        const fd = new FormData(form);
        const email = fd.get('email'), password = fd.get('password');
        try {
          const out = await api('/auth/login', { method: 'POST', body: { email: email, password: password } });
          if (out && out.token) {
            window.MGT_TOKEN = out.token;
            try { window.MGT_SAVE_TOKEN && await window.MGT_SAVE_TOKEN(out.token); } catch (e3) {}
            try { window.MGT_SAVE_CREDS && await window.MGT_SAVE_CREDS(email, password); } catch (e3) {}
          }
          overlay.remove(); style.remove(); resolve(out.user);
        } catch (e2) {
          err.textContent = /401/.test(String(e2.message)) ? 'Email hoặc mật khẩu không đúng.' : String(e2.message);
          err.style.display = 'block'; btn.disabled = false;
        }
      });
      const firstEmpty = form.querySelector('input[name=email]').value ? form.querySelector('input[name=password]') : form.querySelector('input[name=email]');
      if (firstEmpty) firstEmpty.focus();
    });
  }

  let _CACHE_KEY = '_mgt_snapshot_v1_pending';

  async function boot() {
    // Scope cache to current user: decode userId from the JWT that native
    // bridge (or login overlay) placed on window.MGT_TOKEN.
    const _userId = _decodeUserId(window.MGT_TOKEN);
    _CACHE_KEY = _cacheKey(_userId);

    // One-time cleanup: remove old-format unsoped cache key from pre-update.
    // Also clear all if JWT decode failed (userId is null).
    if (!_userId) { _clearAllSnapshotCaches(); }
    else {
      try { localStorage.removeItem('mgt_snapshot_v1'); } catch {}
    }

    let me = null, mePerms = {}, fromCache = false, rawCache = null;
    try {
      const meResp = await api('/me');
      me = meResp.user;
      mePerms = meResp.permissions || {};
    } catch (err) {
      // Detect network errors vs auth errors. Network = offline or fetch failed.
      const isNetErr = !navigator.onLine || err instanceof TypeError || /failed to fetch/i.test(String(err.message || ''));
      if (isNetErr) {
        try { rawCache = JSON.parse(localStorage.getItem(_CACHE_KEY)); } catch {}
        // Verify the cached data belongs to the current user.
        if (rawCache && rawCache.me && rawCache.me.id === _userId) {
          me = rawCache.me;
          mePerms = rawCache.mePerms || {};
          fromCache = true;
          window._MGT_OFFLINE = true;
        } else if (rawCache && rawCache.me && rawCache.me.id !== _userId) {
          // Cache belongs to a different user — discard it.
          try { localStorage.removeItem(_CACHE_KEY); } catch {}
          rawCache = null;
        }
      }
      if (!me) {
        me = await showLoginOverlay();
        try { const reMe = await api('/me'); mePerms = reMe.permissions || {}; } catch { mePerms = {}; }
        // Broadcast login to other tabs so they can react.
        try { window._mgtBroadcastLogin?.(me?.id); } catch {}
      }
    }

    let branches, accounts, feePlans, promotions, teachers, vehicles,
        classesRaw, studentsRaw, paymentsRaw, notifications, activityLog, profileDocs;

    if (fromCache && rawCache) {
      ({ branches = [], accounts = [], feePlans = [], promotions = [], teachers = [],
         vehicles = [], classesRaw = [], studentsRaw = [], paymentsRaw = [],
         notifications = [], activityLog = [], profileDocs = [] } = rawCache);
    } else {
      // Activity log is the only resource whose read permission is commonly
      // revoked for staff. If the user lacks it the endpoint 403s — swallow
      // so boot still succeeds; the Lịch sử tab is hidden by D.can() anyway.
      const safeActivityLog = () => api('/activity-log').catch(() => []);
      [branches, accounts, feePlans, promotions, teachers, vehicles,
       classesRaw, studentsRaw, paymentsRaw, notifications, activityLog, profileDocs] =
        await Promise.all([
          api('/branches'), api('/accounts'), api('/fee-plans'), api('/promotions'),
          api('/teachers'), api('/vehicles'), api('/classes'), api('/students'),
          api('/payments'), api('/notifications'), safeActivityLog(),
          api('/constants/profile-docs'),
        ]);
      // Save snapshot for next offline session (best-effort, ignore quota errors).
      try {
        localStorage.setItem(_CACHE_KEY, JSON.stringify({
          me, mePerms, branches, accounts, feePlans, promotions, teachers, vehicles,
          classesRaw, studentsRaw, paymentsRaw, notifications, activityLog, profileDocs,
        }));
      } catch {}
    }

    const NOW = new Date(), NOW_MS = NOW.getTime();
    const TODAY_STR = `${p2(NOW.getDate())}/${p2(NOW.getMonth() + 1)}/${NOW.getFullYear()}`;

    promotions.forEach(p => { p.appliesTo = (p.appliesTo_csv || '').split('|').filter(Boolean); });
    // Collaborator (CTV) accounts carry multi-branch / multi-class assignments.
    // Default to empty arrays so the account form + table render safely even
    // when the API omits them (staff/admin rows).
    accounts.forEach(a => {
      if (!Array.isArray(a.branchIds)) a.branchIds = [];
      if (!Array.isArray(a.classIds))  a.classIds  = [];
    });
    // Compat: NotificationRow reads n.detail; spec name is n.message.
    notifications.forEach(n => { if (n.detail == null) n.detail = n.message; });

    const classes = classesRaw.map(c => ({ ...c, _openMs: parseDT(c.openDate), _examMs: parseDT(c.examDate) }));
    const setClassStatus = (c) => {
      if (c.statusOverride) c.status = c.statusOverride;
      else if (c._examMs < NOW_MS) c.status = 'đã kết thúc';
      else if (c._openMs > NOW_MS) c.status = 'đang mở';
      else c.status = 'đang diễn ra';
    };
    classes.forEach(setClassStatus);

    const students = studentsRaw.map(s => ({
      ...s, createdAtMs: parseDT(s.createdAt),
      docs: { cccd: !!s.docs_cccd, gksk: !!s.docs_gksk, donDeNghi: !!s.docs_donDeNghi, the3x4: !!s.docs_the3x4, cccdBack: !!s.docs_cccdBack, cccdQR: !!s.docs_cccdQR, bangLaiFront: !!s.docs_bangLaiFront, bangLaiBack: !!s.docs_bangLaiBack },
    }));
    // Split the wire payload by kind. Existing rows that pre-date the
    // schema migration come back as kind=undefined → coerce to 'tuition'
    // so legacy behaviour is preserved.
    // `payments` (tuition) is what feeds the Thanh toán list, dashboard
    // revenue, branch performance and the student paid/balance derive.
    // `rentals` is the parallel ledger surfaced on Phương tiện cards and
    // in the formal report's "Cho thuê xe" section. Rentals never count
    // toward revenue or student outstanding balance.
    const allPaymentsRaw = paymentsRaw.map(p => ({ ...p, kind: p.kind || 'tuition', createdAtMs: parseDT(p.createdAt) }));
    const payments = allPaymentsRaw.filter(p => p.kind === 'tuition');
    const rentals  = allPaymentsRaw.filter(p => p.kind === 'rental');

    const branchesById   = new Map(branches.map(b => [b.id, b]));
    const accountsById   = new Map(accounts.map(a => [a.id, a]));
    const classesById    = new Map(classes.map(c => [c.id, c]));
    const studentsById   = new Map(students.map(s => [s.id, s]));
    const feePlansById   = new Map(feePlans.map(f => [f.id, f]));
    const promotionsById = new Map(promotions.map(p => [p.id, p]));
    const vehiclesById   = new Map(vehicles.map(v => [v.id, v]));

    const paymentsByStudentId = new Map(), paymentsByBranchId = new Map();
    const rentalsByStudentId  = new Map(), rentalsByVehicleId  = new Map();
    const pushTo = (map, key, val) => { const l = map.get(key); if (l) l.push(val); else map.set(key, [val]); };
    for (const p of payments) { pushTo(paymentsByStudentId, p.studentId, p); pushTo(paymentsByBranchId, p.branchId, p); }
    for (const r of rentals)  { pushTo(rentalsByStudentId,  r.studentId, r); if (r.vehicleId) pushTo(rentalsByVehicleId, r.vehicleId, r); }
    const studentsByClassId = new Map(), studentsByBranchId = new Map();
    for (const s of students) { pushTo(studentsByClassId, s.classId, s); pushTo(studentsByBranchId, s.branchId, s); }

    function recomputeDerived(s) {
      const sPays = paymentsByStudentId.get(s.id) || [];
      let paid = 0, hasReg = false;
      const cutoff = s.createdAtMs + 6e5;
      for (const p of sPays) {
        paid += p.amount;
        if (!hasReg && p.createdAtMs <= cutoff && p.amount >= s.totalFee) hasReg = true;
      }
      s.paid = paid; s.balance = s.totalFee - paid;
      s.paymentStatus = paid <= 0 ? '0%' : paid >= s.totalFee ? '100%' : '50%';
      s.noPayOnRegistration = !hasReg;
    }
    students.forEach(recomputeDerived);

    function bucketLabel(d, g) {
      const dd = p2(d.getDate()), mm = p2(d.getMonth() + 1), yy = String(d.getFullYear()).slice(2), hh = p2(d.getHours());
      return g === 'hour' ? `${hh}h ${dd}/${mm}` : g === 'day' ? `${dd}/${mm}` : `${mm}/${yy}`;
    }
    const Y = NOW.getFullYear(), M = NOW.getMonth(), D = NOW.getDate(), H = NOW.getHours();
    const mkBucket = (start, end, grain) => ({ start, end, label: bucketLabel(start, grain) });
    function bucketRanges(grain, count) {
      const out = [];
      for (let i = count - 1; i >= 0; i--) {
        if (grain === 'hour') {
          const end = new Date(NOW); end.setHours(H - i, 59, 59);
          const start = new Date(end); start.setMinutes(0, 0, 0);
          out.push(mkBucket(start, end, grain));
        } else if (grain === 'day') {
          out.push(mkBucket(new Date(Y, M, D - i, 0, 0, 0), new Date(Y, M, D - i, 23, 59, 59), grain));
        } else {
          out.push(mkBucket(new Date(Y, M - i, 1, 0, 0, 0), new Date(Y, M - i + 1, 0, 23, 59, 59), grain));
        }
      }
      return out;
    }
    function periodToDateRanges(grain) {
      const out = [];
      if (grain === 'hour') {
        for (let h = 0; h <= H; h++) out.push(mkBucket(new Date(Y, M, D, h, 0, 0), new Date(Y, M, D, h, 59, 59), 'hour'));
      } else if (grain === 'day') {
        const dow = NOW.getDay() === 0 ? 6 : NOW.getDay() - 1;
        const days = Math.floor((NOW - new Date(Y, M, D - dow)) / 86400000);
        for (let i = 0; i <= days; i++)
          out.push(mkBucket(new Date(Y, M, D - dow + i, 0, 0, 0), new Date(Y, M, D - dow + i, 23, 59, 59), 'day'));
      } else {
        for (let m = 0; m <= M; m++) out.push(mkBucket(new Date(Y, m, 1, 0, 0, 0), new Date(Y, m + 1, 0, 23, 59, 59), 'month'));
      }
      return out;
    }

    function patchStudentIn(raw) {
      const s = { ...raw, createdAtMs: parseDT(raw.createdAt),
        docs: { cccd: !!raw.docs_cccd, gksk: !!raw.docs_gksk, donDeNghi: !!raw.docs_donDeNghi, the3x4: !!raw.docs_the3x4, cccdBack: !!raw.docs_cccdBack, cccdQR: !!raw.docs_cccdQR, bangLaiFront: !!raw.docs_bangLaiFront, bangLaiBack: !!raw.docs_bangLaiBack } };
      students.push(s); studentsById.set(s.id, s);
      pushTo(studentsByClassId, s.classId, s); pushTo(studentsByBranchId, s.branchId, s);
      recomputeDerived(s);
      return s;
    }
    function patchPaymentIn(raw) {
      const p = { ...raw, kind: raw.kind || 'tuition', createdAtMs: parseDT(raw.createdAt) };
      if (p.kind === 'rental') {
        rentals.push(p);
        pushTo(rentalsByStudentId, p.studentId, p);
        if (p.vehicleId) pushTo(rentalsByVehicleId, p.vehicleId, p);
      } else {
        payments.push(p);
        pushTo(paymentsByStudentId, p.studentId, p);
        pushTo(paymentsByBranchId,  p.branchId,  p);
        const s = studentsById.get(p.studentId); if (s) recomputeDerived(s);
      }
      return p;
    }
    function patchClassIn(raw) {
      const c = { ...raw, _openMs: parseDT(raw.openDate), _examMs: parseDT(raw.examDate) };
      setClassStatus(c);
      classes.push(c); classesById.set(c.id, c);
      return c;
    }

    const _normPromo = (raw) => { raw.appliesTo = (raw.appliesTo_csv || '').split('|').filter(Boolean); };

    // Background data refresh — re-fetches all endpoints and updates the
    // existing arrays/Maps in place so React components keep their refs.
    // Used by _probeReconnect after network recovery.
    async function _refreshAllData() {
      const safeActivityLog = () => api('/activity-log').catch(() => []);
      const [newBranches, newAccounts, newFeePlans, newPromotions, newTeachers, newVehicles,
             newClassesRaw, newStudentsRaw, newPaymentsRaw, newNotifications, newActivityLog, newProfileDocs] =
        await Promise.all([
          api('/branches'), api('/accounts'), api('/fee-plans'), api('/promotions'),
          api('/teachers'), api('/vehicles'), api('/classes'), api('/students'),
          api('/payments'), api('/notifications'), safeActivityLog(),
          api('/constants/profile-docs'),
        ]);
      // Update permissions in case they changed.
      try { const reMe = await api('/me'); me = reMe.user; mePerms = reMe.permissions || {}; } catch {}

      const NOW2 = new Date(), NOW_MS2 = NOW2.getTime();

      // Clear and repopulate arrays (same references, new contents).
      branches.length = 0; branches.push(...newBranches);
      accounts.length = 0; accounts.push(...newAccounts);
      feePlans.length = 0; feePlans.push(...newFeePlans);
      promotions.length = 0; promotions.push(...newPromotions);
      teachers.length = 0; teachers.push(...newTeachers);
      vehicles.length = 0; vehicles.push(...newVehicles);
      notifications.length = 0; notifications.push(...newNotifications);
      activityLog.length = 0; activityLog.push(...newActivityLog);

      // Process classes
      const newClasses = newClassesRaw.map(c => ({ ...c, _openMs: parseDT(c.openDate), _examMs: parseDT(c.examDate) }));
      newClasses.forEach(setClassStatus);
      classes.length = 0; classes.push(...newClasses);

      // Process students
      const newStudents = newStudentsRaw.map(s => ({
        ...s, createdAtMs: parseDT(s.createdAt),
        docs: { cccd: !!s.docs_cccd, gksk: !!s.docs_gksk, donDeNghi: !!s.docs_donDeNghi, the3x4: !!s.docs_the3x4, cccdBack: !!s.docs_cccdBack, cccdQR: !!s.docs_cccdQR, bangLaiFront: !!s.docs_bangLaiFront, bangLaiBack: !!s.docs_bangLaiBack },
      }));

      // Process payments
      const newAllPayments = newPaymentsRaw.map(p => ({ ...p, kind: p.kind || 'tuition', createdAtMs: parseDT(p.createdAt) }));
      const newTuitionPayments = newAllPayments.filter(p => p.kind === 'tuition');
      const newRentals = newAllPayments.filter(p => p.kind === 'rental');

      // Rebuild indexes
      branchesById.clear(); branches.forEach(b => branchesById.set(b.id, b));
      accountsById.clear(); accounts.forEach(a => accountsById.set(a.id, a));
      classesById.clear(); newClasses.forEach(c => classesById.set(c.id, c));
      studentsById.clear(); newStudents.forEach(s => studentsById.set(s.id, s));
      feePlansById.clear(); feePlans.forEach(f => feePlansById.set(f.id, f));
      promotionsById.clear(); promotions.forEach(p => promotionsById.set(p.id, p));
      vehiclesById.clear(); vehicles.forEach(v => vehiclesById.set(v.id, v));

      paymentsByStudentId.clear(); paymentsByBranchId.clear();
      rentalsByStudentId.clear(); rentalsByVehicleId.clear();
      for (const p of newTuitionPayments) { pushTo(paymentsByStudentId, p.studentId, p); pushTo(paymentsByBranchId, p.branchId, p); }
      for (const r of newRentals) { pushTo(rentalsByStudentId, r.studentId, r); if (r.vehicleId) pushTo(rentalsByVehicleId, r.vehicleId, r); }
      studentsByClassId.clear(); studentsByBranchId.clear();
      for (const s of newStudents) { pushTo(studentsByClassId, s.classId, s); pushTo(studentsByBranchId, s.branchId, s); }

      // Replace students + payments + rentals arrays
      students.length = 0; students.push(...newStudents);
      payments.length = 0; payments.push(...newTuitionPayments);
      rentals.length = 0; rentals.push(...newRentals);

      // Recompute derived fields for all students
      students.forEach(recomputeDerived);

      // Update promotions (norm appliesTo)
      promotions.forEach(_normPromo);
      accounts.forEach(a => { if (!Array.isArray(a.branchIds)) a.branchIds = []; if (!Array.isArray(a.classIds)) a.classIds = []; });
      notifications.forEach(n => { if (n.detail == null) n.detail = n.message; });

      // Update MGT_DATA scalar props
      MGT_DATA.currentUserId = me.id;
      MGT_DATA.permissions = mePerms;
      MGT_DATA.PROFILE_DOCS = newProfileDocs;
      MGT_DATA.NOW = NOW2;
      MGT_DATA.TODAY = `${p2(NOW2.getDate())}/${p2(NOW2.getMonth() + 1)}/${NOW2.getFullYear()}`;

      // Update the offline cache
      try {
        localStorage.setItem(_CACHE_KEY, JSON.stringify({
          me, mePerms, branches, accounts, feePlans, promotions, teachers, vehicles,
          classesRaw: newClassesRaw, studentsRaw: newStudentsRaw, paymentsRaw: newPaymentsRaw,
          notifications, activityLog, profileDocs: newProfileDocs,
        }));
      } catch {}

      window.dispatchEvent(new Event('mgt:datachanged'));
    }

    const MGT_DATA = {
      branches, accounts, feePlans, promotions, teachers, vehicles,
      classes, students, payments, rentals, notifications, activityLog,
      _byId: { branchesById, accountsById, classesById, studentsById, feePlansById, promotionsById, vehiclesById },
      _indexes: { paymentsByStudentId, studentsByClassId, studentsByBranchId, paymentsByBranchId,
                  rentalsByStudentId, rentalsByVehicleId },

      currentUserId: me.id,
      get currentUser() { return accountsById.get(this.currentUserId) || me; },

      // Fixed per-role permission set from /api/me (no per-account editing).
      // Admin role bypasses; `dashboard` is admin-only pseudo-resource.
      permissions: mePerms,
      can(resource, verb) {
        if (this.currentUser?.role === 'admin') return true;
        if (resource === 'dashboard') return false;
        const short = (verb || '').length === 1 ? verb : (verb || '')[0];
        return !!(this.permissions?.[resource]?.[short]);
      },

      getStaff:     (id) => accountsById.get(id),
      getBranch:    (id) => branchesById.get(id),
      getClass:     (id) => classesById.get(id),
      getStudent:   (id) => studentsById.get(id),
      getFeePlan:   (id) => feePlansById.get(id),
      getPromotion: (id) => promotionsById.get(id),
      getVehicle:   (id) => vehiclesById.get(id),
      getBranchOpts() { return this.branches.map(b => ({ id: b.id, label: b.name })); },
      paymentsForStudent: (id) => paymentsByStudentId.get(id) || [],
      rentalsForStudent:  (id) => rentalsByStudentId.get(id)  || [],
      rentalsForVehicle:  (id) => rentalsByVehicleId.get(id)  || [],
      studentsInClass:    (id) => studentsByClassId.get(id) || [],

      TODAY: TODAY_STR, NOW, _NOW: NOW,
      paymentsToday()        { return payments.filter(p => p.createdAt.startsWith(TODAY_STR)); },
      studentsCreatedToday() { return students.filter(s => s.createdAt.startsWith(TODAY_STR)); },
      firstRecordMs() {
        let e = Infinity;
        for (const p of payments) if (p.createdAtMs < e) e = p.createdAtMs;
        for (const s of students) if (s.createdAtMs < e) e = s.createdAtMs;
        return e === Infinity ? NOW_MS : e;
      },
      _ranges(mode, grain, count) { return mode === 'ptd' ? periodToDateRanges(grain) : bucketRanges(grain, count); },

      revenueBuckets(grain, count, branchId = null, mode = 'rolling') {
        const ranges = this._ranges(mode, grain, count);
        const ps = branchId ? (paymentsByBranchId.get(branchId) || []) : payments;
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let daNhan = 0, tong = 0;
          for (const p of ps) if (p.createdAtMs >= sMs && p.createdAtMs <= eMs) daNhan += p.amount;
          for (const s of ss) if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) tong += s.totalFee;
          return { label: b.label, tong, daNhan, conNo: Math.max(0, tong - daNhan) };
        });
      },
      studentBuckets(grain, count, branchId = null, mode = 'rolling') {
        const ranges = this._ranges(mode, grain, count);
        const ss = branchId ? (studentsByBranchId.get(branchId) || []) : students;
        return ranges.map(b => {
          const sMs = b.start.getTime(), eMs = b.end.getTime();
          let tong = 0, A = 0, A1 = 0;
          for (const s of ss) if (s.createdAtMs >= sMs && s.createdAtMs <= eMs) {
            tong++; if (s.licence === 'A') A++; else A1++;
          }
          return { label: b.label, tong, A, A1 };
        });
      },
      revenueCumulative(grain, count, mode = 'rolling') {
        let t = 0, d = 0, c = 0;
        return this.revenueBuckets(grain, count, null, mode).map(b => {
          t += b.tong; d += b.daNhan; c += b.conNo;
          return { label: b.label, tong: t, daNhan: d, conNo: c };
        });
      },
      studentCumulative(grain, count, mode = 'rolling') {
        let t = 0, a = 0, a1 = 0;
        return this.studentBuckets(grain, count, null, mode).map(b => {
          t += b.tong; a += b.A; a1 += b.A1;
          return { label: b.label, tong: t, A: a, A1: a1 };
        });
      },
      branchPerformance() {
        return branches.map(b => {
          const sList = studentsByBranchId.get(b.id) || [];
          const pList = paymentsByBranchId.get(b.id) || [];
          let tong = 0, daNhan = 0, conNo = 0, paidFull = 0, partial = 0, unpaid = 0, noPayOnReg = 0, paidImmediately = 0;
          for (const s of sList) {
            tong += s.totalFee; conNo += s.balance;
            if (s.paymentStatus === '100%') paidFull++;
            else if (s.paymentStatus === '50%') partial++;
            else unpaid++;
            if (s.noPayOnRegistration) noPayOnReg++;
            if (s.paymentStatus === '100%' && !s.noPayOnRegistration) {
              const cutoff = s.createdAtMs + 6e5;
              for (const p of paymentsByStudentId.get(s.id) || []) {
                if (p.createdAtMs <= cutoff && p.amount >= s.totalFee) { paidImmediately++; break; }
              }
            }
          }
          for (const p of pList) daNhan += p.amount;
          return { branchId: b.id, name: b.name, students: sList.length, revenue: daNhan,
            committed: tong, outstanding: conNo, paidFull, partial, unpaid, noPayOnReg, paidImmediately };
        });
      },

      PROFILE_DOCS: profileDocs,

      api: {
        // AppRoot listens for 'mgt:datachanged' and re-renders after writes.
        _bump() { try { window.dispatchEvent(new Event('mgt:datachanged')); } catch {} },
        // Background data refresh — re-fetches all endpoints and updates
        // in place. Called by _probeReconnect after network recovery.
        refreshAllData: _refreshAllData,
        // Generic CRUD helper for admin support tables; POST/PATCH/DELETEs
        // backend then patches the local array + byId map and _bumps.
        async _crud(op, path, arr, byId, opts = {}) {
          const { id, body, sub, normalize } = opts;
          const method = { create: 'POST', update: 'PATCH', delete: 'DELETE', post: 'POST' }[op];
          const raw = await api(path + (id ? '/' + encodeURIComponent(id) : '') + (sub || ''), { method, body });
          if (op === 'create')      { normalize?.(raw); arr.push(raw); byId?.set(raw.id, raw); }
          else if (op === 'update') { normalize?.(raw); const i = arr.findIndex(r => r.id === id);
            if (i >= 0) { Object.assign(arr[i], raw); byId?.set(id, arr[i]); } }
          else if (op === 'delete') { const i = arr.findIndex(r => r.id === id);
            if (i >= 0) arr.splice(i, 1); byId?.delete(id); }
          this._bump(); return raw;
        },
        async createStudent(payload) { const r = patchStudentIn(await api('/students', { method: 'POST', body: payload })); this._bump(); return r; },
        // Old→new Vietnamese address (2025 admin reform) via diachi.io proxy.
        // Never throws — returns the original address on any failure.
        async convertAddress(address) {
          if (!address || !String(address).trim()) return { converted: address || '', notSure: false, ok: false, rateLimited: false };
          try {
            const r = await api('/address/convert', { method: 'POST', body: { addresses: [address] } });
            const it = r && r.results && r.results[0];
            const rateLimited = !!(r && r.rateLimited);
            return it ? { converted: it.converted || address, notSure: !!it.notSure, ok: !!it.ok, rateLimited }
                      : { converted: address, notSure: true, ok: false, rateLimited };
          } catch (e) { return { converted: address, notSure: true, ok: false, rateLimited: false }; }
        },
        async createPayment(payload) { const r = patchPaymentIn(await api('/payments', { method: 'POST', body: payload })); this._bump(); return r; },
        async createRental(payload) {
          // Convenience wrapper. Server computes amount = vehicle.price ×
          // rentalRounds; we just pass kind=rental + the ids.
          const body = { kind: 'rental', studentId: payload.studentId, vehicleId: payload.vehicleId,
                         rentalRounds: parseInt(payload.rounds || payload.rentalRounds, 10) || 0,
                         method: payload.method || 'Tiền mặt' };
          const r = patchPaymentIn(await api('/payments', { method: 'POST', body }));
          this._bump(); return r;
        },
        async createClass(payload)   { const r = patchClassIn(  await api('/classes',  { method: 'POST', body: payload })); this._bump(); return r; },
        createAccount(p)     { return this._crud('create', '/accounts',  accounts,   accountsById,   { body: p }); },
        updateAccount(id, p) { return this._crud('update', '/accounts',  accounts,   accountsById,   { id, body: p }); },
        resetPassword(id, newPassword) { return this._crud('post', '/accounts', accounts, null, { id, sub: '/reset-password', body: { newPassword } }); },
        async deleteAccount(id) {
          await api('/accounts/' + encodeURIComponent(id), { method: 'DELETE' });
          const idx = accounts.findIndex(a => a.id === id);
          if (idx >= 0) accounts.splice(idx, 1);
          accountsById.delete(id);
          MGT_DATA._bump();
          return { ok: true };
        },
        createFeePlan(p)     { return this._crud('create', '/fee-plans', feePlans,   feePlansById,   { body: { ...p, amount: parseInt(p.amount, 10) || 0 } }); },
        updateFeePlan(id, p) { return this._crud('update', '/fee-plans', feePlans,   feePlansById,   { id, body: 'amount' in p ? { ...p, amount: parseInt(p.amount, 10) || 0 } : p }); },
        createPromotion(p)     { return this._crud('create', '/promotions', promotions, promotionsById, { body: { ...p, discount: parseInt(p.discount, 10) || 0 }, normalize: _normPromo }); },
        updatePromotion(id, p) { return this._crud('update', '/promotions', promotions, promotionsById, { id, body: 'discount' in p ? { ...p, discount: parseInt(p.discount, 10) || 0 } : p, normalize: _normPromo }); },
        createTeacher(p)     { return this._crud('create', '/teachers',  teachers,   null,           { body: { ...p, yearsExp: parseInt(p.yearsExp, 10) || 0 } }); },
        updateTeacher(id, p) { return this._crud('update', '/teachers',  teachers,   null,           { id, body: p }); },
        createVehicle(p)     { return this._crud('create', '/vehicles',  vehicles,   vehiclesById,   { body: { ...p, year: parseInt(p.year, 10) || null, price: parseInt(p.price, 10) || 0 } }); },
        updateVehicle(id, p) { return this._crud('update', '/vehicles',  vehicles,   vehiclesById,   { id, body: 'price' in p ? { ...p, price: parseInt(p.price, 10) || 0 } : p }); },
        createBranch(p)      { return this._crud('create', '/branches',  branches,   branchesById,   { body: p }); },
        updateBranch(id, p)  { return this._crud('update', '/branches',  branches,   branchesById,   { id, body: p }); },
        deleteBranch(id)     { return this._crud('delete', '/branches',  branches,   branchesById,   { id }); },
        async deleteNotification(id) {
          await api('/notifications/' + encodeURIComponent(id), { method: 'DELETE' });
          const i = notifications.findIndex(n => n.id === id);
          if (i >= 0) notifications.splice(i, 1);
          this._bump();
          return { id };
        },
        async _upload(path, file) {
          if (window._MGT_OFFLINE) throw new Error('Không có kết nối internet. Bật WiFi hoặc kiểm tra sóng rồi thử lại.');
          return _retryWithBackoff(async () => {
            const fd = new FormData(); fd.append('file', file);
            const res = await _fetchWithTimeout(API + path, {
              method: 'POST', credentials: 'include',
              headers: window.MGT_TOKEN ? { Authorization: 'Bearer ' + window.MGT_TOKEN } : {},
              body: fd,
            });
            if (!res.ok) {
              const err = new Error(_humanError({ message: `${res.status} upload` }, 'upload'));
              err.retryable = (res.status === 429 || res.status >= 500);
              throw err;
            }
            return res.json();
          }, {
            onRetry: () => { if (window.MGT_TOAST) window.MGT_TOAST('Tải ảnh thất bại, đang thử lại…', { ms: 2000 }); },
          });
        },
        async uploadStudentDoc(studentId, key, file) {
          const capped = await _capImage(file);
          const out = await this._upload('/students/' + encodeURIComponent(studentId) + '/docs/' + encodeURIComponent(key), capped);
          const s = studentsById.get(studentId);
          if (s) {
            s.docs[key] = true; s['docs_' + key] = true;
            // Store the browser-fetchable /api/files path (not the internal
            // MinIO URL) so <img> previews work same-origin under cookie auth.
            const fn = (out && out.url ? String(out.url) : '').split('/').pop();
            s['docs_' + key + '_url'] = fn ? '/api/files/students/' + studentId + '/' + fn : ((out && out.url) || null);
          }
          this._bump(); return out;
        },
        async deleteStudentDoc(studentId, key) {
          await api('/students/' + encodeURIComponent(studentId) + '/docs/' + encodeURIComponent(key), { method: 'DELETE' });
          const s = studentsById.get(studentId);
          if (s) {
            s.docs[key] = false;
            s['docs_' + key] = false;
            s['docs_' + key + '_url'] = null;
          }
          this._bump();
          return { studentId, key };
        },
        async uploadBienLai(paymentId, file) {
          const out = await this._upload('/payments/' + encodeURIComponent(paymentId) + '/bien-lai', file);
          const p = payments.find(p => p.id === paymentId);
          if (p) { p.bienLaiPhoto = true; p.bienLaiPhoto_url = out.url; }
          this._bump(); return out;
        },
        // GET /api/reports/dashboard.pdf — backend renders the Tổng quan
        // page via headless chromium + returns a PDF blob. Triggers a
        // browser download.
        async downloadDashboardPdf() { return this._downloadReport('/reports/dashboard.pdf', 'tongquan', 'pdf', 'báo cáo trực quan'); },
        async downloadFormalReportPdf()  { return this._downloadReport('/reports/data.pdf',  'baocao',   'pdf',  'báo cáo số liệu PDF'); },
        async downloadFormalReportXlsx() { return this._downloadReport('/reports/data.xlsx', 'baocao',   'xlsx', 'báo cáo Excel'); },
        // GET /api/reports/ctv-competition.json — top-3 CTV "bảng vàng"
        // for the month. month/year optional (default current month
        // server-side). opts.fresh === true appends `?fresh=1` to bypass
        // the server's 5-min cache and force a recompute (used by the
        // dialog's "Làm mới" button). Returns { month, year, monthLabel,
        // podium, rest, totalCtv, totalProfiles, cached }.
        async fetchCtvCompetition(month, year, opts) {
          const params = [];
          if (month != null && year != null) { params.push(`month=${month}`, `year=${year}`); }
          if (opts && opts.fresh === true) params.push('fresh=1');
          const qs = params.length ? '?' + params.join('&') : '';
          const res = await fetch(API + '/reports/ctv-competition.json' + qs, { credentials: 'include' });
          if (!res.ok) throw new Error(_humanError({ message: `${res.status} reports` }, 'api'));
          return res.json();
        },
        async downloadCtvCompetitionXlsx(month, year) {
          const qs = (month != null && year != null) ? `?month=${month}&year=${year}` : '';
          return this._downloadReport('/reports/ctv-competition.xlsx' + qs, 'thi-dua-ctv', 'xlsx', 'bảng vàng CTV');
        },
        async _downloadReport(path, prefix, ext, humanLabel) {
          try {
            window.MGT_TOAST && window.MGT_TOAST(`Đang tạo ${humanLabel}…`, { ms: 6000 });
            const res = await fetch(API + path, { credentials: 'include' });
            if (!res.ok) throw new Error(_humanError({ message: `${res.status} download` }, 'api'));
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix}-${new Date().toISOString().slice(0,10)}.${ext}`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            window.MGT_TOAST && window.MGT_TOAST(`Đã tạo ${humanLabel}.`);
          } catch (e) {
            window.MGT_TOAST && window.MGT_TOAST(`Không thể tạo ${humanLabel}. Kiểm tra mạng rồi thử lại.`, { ms: 5000 });
          }
        },

        // POST a CCCD image to /api/ocr/cccd and return { fields, raw, ms,
        // confidence }. fields = { idNumber, name, dob, gender, queQuan,
        // address, ngayCapCCCD } (any subset may be null). Caller decides
        // which to apply. Does NOT persist the image — caller still needs
        // to POST /api/students/:id/docs/cccd after the student exists.
        async ocrCccd(file) {
          const fd = new FormData(); fd.append('file', file);
          const res = await fetch(API + '/ocr/cccd', { method: 'POST', credentials: 'include', body: fd });
          if (!res.ok) throw new Error(_humanError({ message: `${res.status} ocr` }, 'upload'));
          return res.json();
        },
        async updateStudent(id, patch) {
          const raw = await api('/students/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
          const ex = studentsById.get(id);
          if (ex) {
            Object.assign(ex, raw, {
              createdAtMs: parseDT(raw.createdAt),
              docs: { cccd: !!raw.docs_cccd, gksk: !!raw.docs_gksk, donDeNghi: !!raw.docs_donDeNghi, the3x4: !!raw.docs_the3x4, cccdBack: !!raw.docs_cccdBack, cccdQR: !!raw.docs_cccdQR, bangLaiFront: !!raw.docs_bangLaiFront, bangLaiBack: !!raw.docs_bangLaiBack },
            });
            recomputeDerived(ex);
          }
          this._bump();
          return ex || raw;
        },
        async updateClass(id, patch) {
          const raw = await api('/classes/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
          const ex = classesById.get(id);
          if (ex) {
            Object.assign(ex, raw, { _openMs: parseDT(raw.openDate), _examMs: parseDT(raw.examDate) });
            setClassStatus(ex);
          }
          this._bump();
          return ex || raw;
        },
        async markNotificationRead(id, read = true) {
          const raw = await api('/notifications/' + encodeURIComponent(id), { method: 'PATCH', body: { read } });
          const ex = notifications.find(n => n.id === id);
          if (ex) Object.assign(ex, raw, { detail: raw.message ?? ex.detail });
          this._bump();
          return raw;
        },
        async logout() {
          try { await api('/auth/logout', { method: 'POST' }); } catch {}
          window.MGT_TOKEN = null; try { window.MGT_CLEAR_TOKEN && await window.MGT_CLEAR_TOKEN(); } catch {}
          // Clear all snapshot caches (all users) — scoped keys prevent
          // cross-user leakage, but on explicit logout we clean up fully.
          _clearAllSnapshotCaches();
          // Clear current user's drafts (text + photos).
          try { localStorage.removeItem('mgt_guest_add_draft_' + (me?.id || '')); } catch {}
          try {
            await new Promise(resolve => {
              const req = indexedDB.deleteDatabase('mgt_guest_draft_' + (me?.id || ''));
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            });
          } catch {}
          // Broadcast logout to other tabs so they reload too.
          try { new BroadcastChannel('mgt-auth').postMessage({ type: 'logout' }); } catch {}
          window.location.reload();
        },
      },
    };

    window.MGT_DATA = MGT_DATA;
    return MGT_DATA;
  }

  // Native app sets window.MGT_BOOT_GATE (a promise that loads the stored token
  // into window.MGT_TOKEN) so the first /me call is authenticated. Web has no
  // gate → boots immediately.
  window.MGT_DATA_READY = Promise.resolve(window.MGT_BOOT_GATE)
    .then(() => boot())
    .catch(err => { console.error('[data-loader] boot failed:', err); throw err; });

  // ── Reconnect detection ────────────────────────────────────────────
  // When the app boots offline (_MGT_OFFLINE = true), listen for connectivity
  // changes and re-probe the server. On success, clear the flag so writes
  // unblock and the banner disappears.
  let _lastProbe = 0;
  async function _probeReconnect() {
    if (!window._MGT_OFFLINE) return;
    if (!window.MGT_TOKEN) return;  // don't probe after logout
    const now = Date.now();
    if (now - _lastProbe < 5000) return;  // debounce — max once per 5s
    _lastProbe = now;
    try {
      await api('/me');
      window._MGT_OFFLINE = false;
      window.dispatchEvent(new Event('mgt:connectivity'));
      // Background refresh — update data without a page reload so the
      // user keeps their scroll position, open forms, and context.
      if (window.MGT_DATA?.api?.refreshAllData) {
        if (window.MGT_TOAST) window.MGT_TOAST('Đã khôi phục kết nối — đang cập nhật dữ liệu...', { ms: 2500 });
        window.MGT_DATA.api.refreshAllData().catch(() => {});
      } else {
        if (window.MGT_TOAST) window.MGT_TOAST('Đã khôi phục kết nối.', { ms: 3000 });
      }
    } catch (e) {
      // Token expired while offline — reload so login overlay appears.
      // Do NOT clear caches here: on choppy networks the probe may fire
      // repeatedly, and wiping drafts each time would destroy in-progress work.
      if (/auth_required|401/.test(String(e?.message || ''))) { window.location.reload(); return; }
      // else: still offline — keep the flag
    }
  }
  window.addEventListener('online', _probeReconnect);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _probeReconnect();
  });

  // ── Background data polling ────────────────────────────────────────
  // Periodically checks if data has changed on the server and refreshes
  // in the background. Keeps the dashboard fresh without manual reload.
  // Only polls when tab is visible and app is online.
  let _lastPoll = 0;
  let _pollBusy = false;
  const _POLL_INTERVAL = 120000; // 120 seconds
  async function _pollRefresh() {
    if (_pollBusy) return;
    if (window._MGT_OFFLINE) return;
    if (!window.MGT_TOKEN) return;
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - _lastPoll < _POLL_INTERVAL) return;
    _lastPoll = now;
    // Snapshot current counts to detect changes.
    const D = window.MGT_DATA;
    if (!D || !D.students || !D.payments) return;
    const prevStudentCount = D.students.length;
    const prevPaymentCount = D.payments.length;
    try {
      await api('/me'); // heartbeat — validates token is still alive
      _pollBusy = true;
      await D.api.refreshAllData();
      // Show toast only if data actually changed.
      if (D.students.length !== prevStudentCount || D.payments.length !== prevPaymentCount) {
        if (window.MGT_TOAST) window.MGT_TOAST('Dữ liệu đã cập nhật.', { ms: 2500 });
      }
    } catch {}
    finally { _pollBusy = false; }
  }
  // Check on visibility change + interval timer.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _pollRefresh();
  });
  setInterval(_pollRefresh, _POLL_INTERVAL);

  // ── Multi-tab coordination ────────────────────────────────────────
  // When a different user logs in on another tab, this tab reloads to
  // prevent cross-user data visibility. Same user = no disruption.
  try {
    const _authChannel = new BroadcastChannel('mgt-auth');
    _authChannel.onmessage = (e) => {
      const { type, userId } = e.data || {};
      if (type === 'logout') { window.location.reload(); return; }
      if (type === 'login' && userId) {
        const myId = window.MGT_DATA?.currentUserId;
        if (myId && userId !== myId) window.location.reload();
      }
    };
    // Broadcast our login so other tabs can react.
    window._mgtBroadcastLogin = (userId) => {
      try { _authChannel.postMessage({ type: 'login', userId }); } catch {}
    };
  } catch {}
})();
