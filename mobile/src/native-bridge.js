// ====================================================================
// native-bridge.js — Capacitor seam for the CTV portal.
//
// Runs BEFORE data-loader.js. On a native platform it:
//   • loads the stored Bearer token into window.MGT_TOKEN and gates boot
//     (window.MGT_BOOT_GATE) so the first /me call is authenticated;
//   • exposes window.MGT_SAVE_TOKEN / MGT_CLEAR_TOKEN (Capacitor Preferences);
//   • overrides the photo picker (window.MGT_NATIVE_PICK) with the native
//     Camera/Library prompt;
//   • provides window.MGT_CAPTURE — a native QR capture that takes a full-res
//     photo and decodes it OFFLINE with ML Kit (falls back to the JS cascade).
//
// On the web (no window.Capacitor) it does nothing — the portal keeps its
// cookie + file-input behaviour.
// ====================================================================
(function () {
  var Cap = window.Capacitor;
  var native = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
  if (!native) return;
  var P = Cap.Plugins || {};
  var TOKEN_KEY = "mgt_token";

  // ── Token + credential persistence ───────────────────────────────
  var CREDS_KEY = "mgt_creds";
  window.MGT_SAVE_TOKEN = async function (t) {
    try { await P.Preferences.set({ key: TOKEN_KEY, value: t }); } catch (e) {}
  };
  window.MGT_CLEAR_TOKEN = async function () {
    try { await P.Preferences.remove({ key: TOKEN_KEY }); } catch (e) {}
  };
  window.MGT_SAVE_CREDS = async function (email, password) {
    try { await P.Preferences.set({ key: CREDS_KEY, value: JSON.stringify({ email: email, password: password }) }); } catch (e) {}
  };
  window.MGT_BOOT_GATE = (async function () {
    try {
      var r = await P.Preferences.get({ key: TOKEN_KEY });
      if (r && r.value) window.MGT_TOKEN = r.value;
    } catch (e) {}
    try {
      var c = await P.Preferences.get({ key: CREDS_KEY });
      if (c && c.value) { var parsed = JSON.parse(c.value); window.MGT_CREDS = parsed; }
    } catch (e) {}
  })();

  // ── helpers ──────────────────────────────────────────────────────
  function srcOf(photo) {
    if (photo.webPath) return photo.webPath;
    if (Cap.convertFileSrc && photo.path) return Cap.convertFileSrc(photo.path);
    return photo.path;
  }
  async function toFile(photo, name) {
    var res = await fetch(srcOf(photo));
    var blob = await res.blob();
    return new File([blob], name || ("photo." + (photo.format || "jpg")), { type: blob.type || "image/jpeg" });
  }

  // ── Native photo picker (used by every photo slot) ───────────────
  window.MGT_NATIVE_PICK = async function () {
    try {
      var photo = await P.Camera.getPhoto({
        quality: 90, resultType: "uri", source: "PROMPT",
        correctOrientation: true, presentationStyle: "fullscreen",
        promptLabelPhoto: "Thư viện", promptLabelPicture: "Chụp ảnh",
        promptLabelHeader: "Chọn ảnh", promptLabelCancel: "Hủy",
      });
      return await toFile(photo, "anh.jpg");
    } catch (e) { return null; }  // cancelled
  };

  // MGT_CAPTURE: native override using Camera.getPhoto + client-side decode cascade.
  // Loaded AFTER qr-capturer.js (see build.mjs), so this overwrites the ZXing
  // getUserMedia implementation which is unreliable in WKWebView.
  window.MGT_CAPTURE = {
    supported() { return true; },
    async open() {
      var utils = window._MGT_QR_UTILS || {};
      var gateFile = utils.gateFile;
      var parseCCCD = utils.parseCCCD || function(raw) {
        if (typeof raw !== 'string' || raw.indexOf('|') < 0) return {};
        var p = raw.split('|'); var o = {};
        if (p[0]) o.idNumber = p[0]; if (p[2]) o.name = p[2];
        var _vn = function(s) { return (typeof s === 'string' && /^\d{8}$/.test(s)) ? s.slice(0,2)+'/'+s.slice(2,4)+'/'+s.slice(4) : undefined; };
        var dob = _vn(p[3]); if (dob) o.dob = dob;
        if (p[4]) o.gender = p[4]; if (p[5]) o.address = p[5];
        var cap = _vn(p[6]); if (cap) o.ngayCapCCCD = cap;
        return o;
      };
      try {
        // Try ML Kit barcode scanner first (fast, no camera preview needed)
        var bs = P.BarcodeScanner;
        if (bs && bs.isSupported) {
          var supp = await bs.isSupported();
          if (supp && supp.supported) {
            var perm = await bs.checkPermissions();
            if (perm && perm.camera !== 'granted') perm = await bs.requestPermissions();
            if (perm && perm.camera === 'granted') {
              var scanRes = await bs.scan({ formats: ['QR_CODE'] });
              if (scanRes && scanRes.barcodes && scanRes.barcodes.length > 0) {
                var raw = scanRes.barcodes[0].rawValue;
                var fields = parseCCCD(raw);
                // After getting QR data, prompt user to take/pick the QR photo for upload
                try {
                  var qrPhoto = await P.Camera.getPhoto({
                    quality: 90, resultType: "uri", source: "PROMPT",
                    correctOrientation: true, presentationStyle: "fullscreen",
                    promptLabelHeader: "Chụp ảnh QR CCCD để lưu",
                    promptLabelPhoto: "Thư viện", promptLabelPicture: "Chụp ảnh",
                    promptLabelCancel: "Bỏ qua",
                  });
                  var file = await toFile(qrPhoto, "cccd-qr.jpg");
                  return { file: file, raw: raw, fields: fields };
                } catch (e) {
                  // Photo step skipped — return data only (file will be null)
                  return { file: null, raw: raw, fields: fields };
                }
              }
            }
          }
        }
      } catch (e) {}
      // Fallback: take/pick a photo, decode QR client-side (avoids getUserMedia)
      try {
        var photo = await P.Camera.getPhoto({
          quality: 90, resultType: "uri", source: "PROMPT",
          correctOrientation: true, presentationStyle: "fullscreen",
          promptLabelHeader: "Chụp hoặc chọn ảnh QR CCCD",
          promptLabelPhoto: "Thư viện", promptLabelPicture: "Chụp ảnh",
          promptLabelCancel: "Hủy",
        });
        var file = await toFile(photo, "cccd-qr.jpg");
        if (gateFile) {
          var raw = await gateFile(file);
          if (!raw) return null;
          return { file: file, raw: raw, fields: parseCCCD(raw) };
        }
        return { fallback: true };
      } catch (e) {
        return null; // cancelled
      }
    }
  };
})();
