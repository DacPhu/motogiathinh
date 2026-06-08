// ====================================================================
// qr-capturer.js  —  LIVE CCCD QR "capturer" (point-and-lock)
//
// Committed feature. Self-contained: one global window.MGT_CAPTURE; no other
// file imports from it. Pairs with the library/upload path (multi-scale
// decode cascade in data-loader): users do library-first for batch, and turn
// on the camera to rescue a failing image.
//
// Opens a fullscreen camera overlay, decodes frames continuously with the
// vendored ZXing, and locks the instant the QR is readable — then grabs a
// still from that frame to save. Solves QR *localisation* (you aim; the QR
// fills the frame) which still photos struggle with. Requires a SECURE
// CONTEXT (https or localhost) for camera access.
//
//   window.MGT_CAPTURE.open() → Promise resolving to:
//     { file, raw, fields }   on a successful lock (file = JPEG still)
//     { fallback: true }      user chose "Chọn từ thư viện"
//     null                    user cancelled / camera unavailable
// ====================================================================
(function () {
  function loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/zxing.umd.min.js';
      s.onload = () => res(window.ZXing);
      s.onerror = () => rej(new Error('zxing_load_failed'));
      document.head.appendChild(s);
    });
  }
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/jsqr.min.js';
      s.onload = () => res(window.jsQR);
      s.onerror = () => rej(new Error('jsqr_load_failed'));
      document.head.appendChild(s);
    });
  }
  function _vn(s) { return (typeof s === 'string' && /^\d{8}$/.test(s)) ? s.slice(0, 2) + '/' + s.slice(2, 4) + '/' + s.slice(4) : undefined; }
  function _parseCCCD(raw) {
    if (typeof raw !== 'string' || raw.indexOf('|') < 0) return {};
    const p = raw.split('|'); const o = {};
    if (p[0]) o.idNumber = p[0]; if (p[2]) o.name = p[2];
    const dob = _vn(p[3]); if (dob) o.dob = dob;
    if (p[4]) o.gender = p[4]; if (p[5]) o.address = p[5];
    const cap = _vn(p[6]); if (cap) o.ngayCapCCCD = cap;
    return o;
  }
  // Decode a canvas (jsQR + ZXing). Used to GATE the saved still: we only
  // accept a frame that re-decodes from the exact bytes we'll save.
  async function _decodeCanvas(c) {
    try {
      const jsQR = window.jsQR || await loadJsQR();
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      const r = jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) return r.data;
    } catch (e) {}
    try {
      const ZX = window.ZXing;
      if (ZX) {
        const h = new Map();
        h.set(ZX.DecodeHintType.TRY_HARDER, true);
        h.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.QR_CODE]);
        const res = await new ZX.BrowserQRCodeReader(h).decodeFromImageUrl(c.toDataURL('image/jpeg', 0.92));
        if (res && res.getText) return res.getText();
      }
    } catch (e) {}
    return null;
  }
  // Decode-gate a (full-res) photo File via downscaled copies — mirrors the
  // production cascade insight (downscaling helps the locator lock). Returns
  // the raw QR string if any scale decodes, else null.
  async function _gateFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = url; });
      for (const m of [1400, 1000, 2000]) {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (Math.max(w, h) > m) { const s = m / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const raw = await _decodeCanvas(c);
        if (raw) return raw;
      }
      return null;
    } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
  }

  window.MGT_CAPTURE = {
    supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
    },
    async open() {
      const ZX = await loadZxing().catch(() => null);
      return new Promise((resolve) => {
        let done = false, reader = null, verifying = false;

        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000;display:flex;flex-direction:column;';
        const video = document.createElement('video');
        video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
        video.style.cssText = 'flex:1;width:100%;min-height:0;object-fit:cover;background:#000;';
        ov.appendChild(video);

        const ret = document.createElement('div');
        ret.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:64vw;max-width:300px;aspect-ratio:1;border:3px solid #19d2e6;border-radius:18px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45);pointer-events:none;';
        ov.appendChild(ret);
        const hint = document.createElement('div');
        hint.textContent = 'Đưa mã QR trên CCCD vào khung';
        hint.style.cssText = 'position:absolute;left:0;right:0;top:10%;text-align:center;color:#fff;font-family:system-ui;font-size:15px;font-weight:600;text-shadow:0 1px 4px #000;';
        ov.appendChild(hint);

        const bar = document.createElement('div');
        bar.style.cssText = 'position:relative;display:flex;gap:10px;padding:16px;background:#000;';
        const mk = (label, fg) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'flex:1;padding:14px;border:none;border-radius:12px;font:600 15px system-ui;cursor:pointer;background:#1b2230;color:' + fg; return b; };
        const bLib = mk('Chọn từ thư viện', '#cfe'); const bCancel = mk('Hủy', '#ffd27a');
        bar.appendChild(bLib); bar.appendChild(bCancel); ov.appendChild(bar);
        document.body.appendChild(ov);

        const cleanup = () => {
          try { reader && reader.reset && reader.reset(); } catch (e) {}
          try { const st = video.srcObject; st && st.getTracks && st.getTracks().forEach(t => t.stop()); } catch (e) {}
          try { ov.remove(); } catch (e) {}
        };
        const finish = (val) => { if (done) return; done = true; cleanup(); resolve(val); };
        bCancel.onclick = () => finish(null);
        bLib.onclick = () => finish({ fallback: true });

        // ZXing fires this when a QR is in view. We then grab the BEST still
        // and decode-gate it (so the saved image is provably scannable):
        //   1) full-res via ImageCapture.takePhoto() (Chromium/Android) → A-minus
        //   2) fallback: the current video frame (iOS Safari) → C+gate
        // A still that doesn't re-decode (motion/focus) is skipped; next frame.
        const onResult = async (result) => {
          if (done || verifying || !result || !result.getText) return;
          verifying = true;
          try {
            let file = null, raw = null;
            // 1) Full-resolution photo where supported.
            if ('ImageCapture' in window) {
              try {
                const st = video.srcObject;
                const track = st && st.getVideoTracks ? st.getVideoTracks()[0] : null;
                if (track) {
                  const blob = await new ImageCapture(track).takePhoto();
                  const f = new File([blob], 'cccd-qr.jpg', { type: blob.type || 'image/jpeg' });
                  const r = await _gateFile(f);
                  if (r) { file = f; raw = r; }
                }
              } catch (e) {}
            }
            // 2) Fallback: gated video frame.
            if (!file) {
              const c = document.createElement('canvas');
              c.width = video.videoWidth || 1280; c.height = video.videoHeight || 720;
              if (!c.width || !c.height) { verifying = false; return; }
              c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
              const r = await _decodeCanvas(c);
              if (!r) { hint.textContent = 'Giữ yên cho nét…'; verifying = false; return; }
              const blob = await new Promise(rs => c.toBlob(rs, 'image/jpeg', 0.92));
              file = blob ? new File([blob], 'cccd-qr.jpg', { type: 'image/jpeg' }) : null;
              raw = r;
            }
            if (!file || !raw) { verifying = false; return; }
            const fields = (window.MGT_QR && window.MGT_QR.parseCCCD) ? window.MGT_QR.parseCCCD(raw) : _parseCCCD(raw);
            finish({ file, raw, fields });
          } catch (e) { verifying = false; }
        };

        (async () => {
          if (!this.supported()) { hint.textContent = 'Camera cần HTTPS — hãy dùng "Chọn từ thư viện".'; return; }
          if (!ZX) { hint.textContent = 'Không tải được bộ giải mã QR.'; return; }
          try {
            const hints = new Map();
            hints.set(ZX.DecodeHintType.TRY_HARDER, true);
            hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.QR_CODE]);
            reader = new ZX.BrowserQRCodeReader(hints);
            const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false };
            await reader.decodeFromConstraints(constraints, video, (result) => onResult(result));
          } catch (e) {
            hint.textContent = 'Không mở được camera: ' + (e && e.message ? e.message : e);
          }
        })();
      });
    }
  };
})();
