// Precompile the CTV portal (frozen web source) into a static `www/` bundle
// for Capacitor — no Babel-in-browser at runtime.
import { transformFileSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE = path.resolve(__dirname, "..", "frontend");
const WWW = path.join(__dirname, "www");
const LIB = path.join(WWW, "lib");

// 1) clean www
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(LIB, { recursive: true });

// 2) compile JSX → JS (only what the CTV portal needs)
const JSX = ["atoms.jsx", "shell.jsx", "screen-guest.jsx", "app.jsx"];
for (const f of JSX) {
  const out = transformFileSync(path.join(FE, f), { presets: ["@babel/preset-react"] }).code;
  fs.writeFileSync(path.join(WWW, f.replace(/\.jsx$/, ".js")), out);
  console.log("compiled", f);
}

// 3) copy plain JS / CSS as-is (qr-capturer.js = live QR scanner, same as web)
for (const f of ["data-loader.js", "colors_and_type.css", "qr-capturer.js"]) {
  fs.copyFileSync(path.join(FE, f), path.join(WWW, f));
}
// 4) copy native seam
for (const f of ["config.js", "native-bridge.js"]) {
  fs.copyFileSync(path.join(__dirname, "src", f), path.join(WWW, f));
}
// 5) copy asset dirs if present (fonts, vendor, assets)
for (const d of ["fonts", "vendor", "assets"]) {
  const src = path.join(FE, d);
  if (fs.existsSync(src)) { fs.cpSync(src, path.join(WWW, d), { recursive: true }); console.log("copied", d + "/"); }
}

// 6) fetch React/ReactDOM production UMD into lib/
const CDN = {
  "react.production.min.js": "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "react-dom.production.min.js": "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
};
for (const [name, url] of Object.entries(CDN)) {
  const dest = path.join(LIB, name);
  const res = await fetch(url);
  if (!res.ok) throw new Error("download failed " + url + " " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error("suspiciously small download " + name);
  fs.writeFileSync(dest, buf);
  console.log("fetched", name, buf.length);
}

// 7) index.html (script order: qr-capturer BEFORE native-bridge so native-bridge
//    can override window.MGT_CAPTURE with the native camera+ML Kit path)
const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>Moto Gia Thịnh · CTV</title>
  <link rel="stylesheet" href="colors_and_type.css">
  <style>
    html, body { height: 100%; margin: 0; background: var(--ink-1, #0b0d12); }
    #root { min-height: 100%; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="lib/react.production.min.js"></script>
  <script src="lib/react-dom.production.min.js"></script>
  <script src="config.js"></script>
  <script src="qr-capturer.js"></script>
  <script src="native-bridge.js"></script>
  <script src="data-loader.js"></script>
  <script src="atoms.js"></script>
  <script src="shell.js"></script>
  <script src="screen-guest.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(WWW, "index.html"), html);
console.log("wrote www/index.html");
console.log("DONE → www/");
