// ====================================================================
// native-bridge.js — Capacitor seam for the CTV portal.
//
// Runs BEFORE data-loader.js. On a native platform it:
//   • loads the stored Bearer token into window.MGT_TOKEN and gates boot
//     (window.MGT_BOOT_GATE) so the first /me call is authenticated;
//   • exposes window.MGT_SAVE_TOKEN / MGT_CLEAR_TOKEN (Capacitor Preferences);
//   • overrides the photo picker (window.MGT_NATIVE_PICK) with the native
//     Camera/Library prompt;
//   • provides window.MGT_CAPTURE — a live native QR scanner via the MgtQrScanner
//     plugin (Apple Vision/AVFoundation on iOS, CameraX + ML Kit on Android); the
//     locked frame is the upload image (falls back to Camera.getPhoto + JS cascade).
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

  // Convert a MgtQrScanner result (a file:// URI or base64 JPEG) into an upload
  // File. Mirrors the `toFile` idiom (convertFileSrc → fetch → blob).
  async function scanResultToFile(res, name) {
    name = name || "cccd-qr.jpg";
    try {
      if (res && res.savedUri) {
        var url = Cap.convertFileSrc ? Cap.convertFileSrc(res.savedUri) : res.savedUri;
        var r = await fetch(url);
        var b = await r.blob();
        return new File([b], name, { type: b.type || "image/jpeg" });
      }
      if (res && res.imageBase64) {
        var dataUrl = res.imageBase64.indexOf("data:") === 0 ? res.imageBase64 : "data:image/jpeg;base64," + res.imageBase64;
        var r2 = await fetch(dataUrl);
        var b2 = await r2.blob();
        return new File([b2], name, { type: b2.type || "image/jpeg" });
      }
    } catch (e) {}
    return null;
  }

  // MGT_CAPTURE: native override. PRIMARY = the MgtQrScanner native plugin (Apple
  // Vision/AVFoundation on iOS, CameraX + ML Kit on Android) — a live point-and-lock
  // scanner whose locked frame doubles as the upload image. FALLBACK (plugin missing
  // / unsupported / permission denied) = the old Camera.getPhoto + client-side
  // ZXing/jsQR decode cascade. Loaded AFTER qr-capturer.js (see build.mjs) so it
  // overrides the WKWebView-unreliable getUserMedia path. Set
  // window.MGT_USE_NATIVE_QR = false (e.g. in config.js) to force the fallback.
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

      // ── PRIMARY: native live scanner (Apple Vision / CameraX+ML Kit) ──
      var Qr = P.MgtQrScanner;
      if (Qr && typeof Qr.scan === "function" && window.MGT_USE_NATIVE_QR !== false) {
        try {
          var res = await Qr.scan({ formats: ["QR_CODE"], imageReturn: "file" });
          if (res && res.raw) {
            var nf = await scanResultToFile(res, "cccd-qr.jpg");
            if (nf) return { file: nf, raw: res.raw, fields: parseCCCD(res.raw) };
            // Decoded but no usable image — open camera for user to snap the QR
            try {
              var fbPhoto = await P.Camera.getPhoto({
                quality: 90, resultType: "uri", source: "CAMERA",
                correctOrientation: true, presentationStyle: "fullscreen",
                promptLabelPicture: "Chụp ảnh QR CCCD", promptLabelCancel: "Hủy",
              });
              var fbFile = await toFile(fbPhoto, "cccd-qr.jpg");
              if (fbFile) return { file: fbFile, raw: res.raw, fields: parseCCCD(res.raw) };
            } catch (e2) {}
            // Both failed — return decoded fields without photo; UI will prompt re-scan
            return { file: null, raw: res.raw, fields: parseCCCD(res.raw) };
          }
        } catch (e) {
          var code = (e && (e.code || e.message)) || "";
          if (code === "cancelled") return null;   // user backed out of the scanner
          // unavailable / denied / busy → fall through to the photo cascade
        }
      }

      // ── FALLBACK: take/pick a photo, decode QR client-side (avoids getUserMedia) ──
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

  // ── Back button (Android hardware back / gesture navigation) ─────
  //
  // MAPPING POLICY — Android back button:
  //   ✓ Close add-student modal      → popstate → setAddOpen(false)
  //   ✓ Navigate back (detail → list) → popstate → setViewingId(null)
  //   ✓ Dismiss camera overlay        → native ScannerActivity owns its lifecycle
  //   ✗ Exit from home screen         → BLOCKED (too disruptive on shared device)
  //   ✗ Undo student/payment creation → irreversible, never map
  //
  // MAPPING POLICY — iPhone left-edge swipe (web-level touch gesture):
  //   ✓ Navigate back (detail → list) → same as Android back
  //   ✗ Close modal                   → feels wrong — modal was opened by
  //                                      explicit tap, not navigation push
  //   ✗ Exit to login                 → same as Android: too disruptive
  //   ✗ Dismiss camera                → camera has its own cancel button;
  //                                      swipe-from-edge conflicts with
  //                                      camera pan/gesture area
  var _appPlugin = P.App;
  if (_appPlugin && typeof _appPlugin.addListener === "function") {
    _appPlugin.addListener("backButton", function () {
      // Web popstate handler (screen-guest.jsx) already closes modals + detail.
      // At root nothing is pushed — prevent Capacitor's default exit.
      if (window.history.length <= 1) return;
      window.history.back();
    });
  }
})();
