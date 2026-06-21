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

  // MGT_CAPTURE (live QR scanner) is provided by qr-capturer.js (loaded after this
  // file). It uses getUserMedia for a live-stream ZXing decode which works in
  // Capacitor's WKWebView/WebView with the camera permission already granted.
})();
