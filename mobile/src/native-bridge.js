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

  // ── Token persistence + boot gate ────────────────────────────────
  window.MGT_SAVE_TOKEN = async function (t) {
    try { await P.Preferences.set({ key: TOKEN_KEY, value: t }); } catch (e) {}
  };
  window.MGT_CLEAR_TOKEN = async function () {
    try { await P.Preferences.remove({ key: TOKEN_KEY }); } catch (e) {}
  };
  window.MGT_BOOT_GATE = (async function () {
    try {
      var r = await P.Preferences.get({ key: TOKEN_KEY });
      if (r && r.value) window.MGT_TOKEN = r.value;
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

  // ── Native QR capturer: full-res photo + OFFLINE ML Kit decode ───
  window.MGT_CAPTURE = {
    supported: function () { return true; },
    async open() {
      var photo;
      try {
        photo = await P.Camera.getPhoto({
          quality: 95, resultType: "uri", source: "CAMERA",
          correctOrientation: true, presentationStyle: "fullscreen",
        });
      } catch (e) { return null; }  // user cancelled the camera

      var raw = null;
      try {
        var out = await P.BarcodeScanning.readBarcodesFromImage({ path: photo.path, formats: ["QR_CODE"] });
        var codes = (out && out.barcodes) || [];
        if (codes.length) raw = codes[0].rawValue || codes[0].displayValue || null;
      } catch (e) {}

      var file = null;
      try { file = await toFile(photo, "cccd-qr.jpg"); } catch (e) {}

      // Fallback: decode the captured image with the JS cascade (jsQR/ZXing).
      if (!raw && file && window.MGT_QR && window.MGT_QR.scanFile) {
        try { var s = await window.MGT_QR.scanFile(file); if (s && s.ok) return { file: file, raw: s.raw, fields: s.fields }; } catch (e) {}
      }
      if (!raw) return { fallback: true };   // couldn't read → let caller pick from library
      var fields = (window.MGT_QR && window.MGT_QR.parseCCCD) ? window.MGT_QR.parseCCCD(raw) : {};
      return { file: file, raw: raw, fields: fields };
    }
  };
})();
