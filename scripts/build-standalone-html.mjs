import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  throw new Error('dist/assets not found — run `vite build` before building standalone HTML.');
}

const cssFile = fs
  .readdirSync(assetsDir)
  .filter((f) => f.endsWith('.css'))
  .sort()
  .pop();

if (!cssFile) {
  throw new Error('No compiled CSS file found in dist/assets.');
}

const compiledCss = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8').replace(/<\/style>/gi, '<\\/style>');

const iconSvgPath = path.join(rootDir, 'public', 'icon.svg');
const iconDataUri = fs.existsSync(iconSvgPath)
  ? 'data:image/svg+xml;base64,' + fs.readFileSync(iconSvgPath).toString('base64')
  : '';

const buildResult = esbuild.buildSync({
  entryPoints: [path.join(rootDir, 'src', 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
  write: false,
});

const rawJs = buildResult.outputFiles[0].text;
// Prevent literal "</script" sequences inside bundled strings from terminating the <script> tag prematurely
const safeJs = rawJs.replace(/<\/script/gi, '<\\/script');

const bootHelperScript = `(function(){
  function makeMemStorage(){
    var store = Object.create(null);
    return {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function(k, v){ store[String(k)] = String(v); },
      removeItem: function(k){ delete store[String(k)]; },
      clear: function(){ store = Object.create(null); },
      key: function(i){ var ks = Object.keys(store); return ks[i] || null; },
      get length(){ return Object.keys(store).length; }
    };
  }
  ['localStorage','sessionStorage'].forEach(function(name){
    try {
      var s = window[name];
      var k = '__cw_test__';
      s.setItem(k, '1');
      s.removeItem(k);
    } catch (e) {
      try {
        Object.defineProperty(window, name, { configurable: true, value: makeMemStorage() });
      } catch (_) {}
    }
  });
  function showBootError(msg){
    var box = document.getElementById('cw-boot-fallback');
    if (!box) return;
    box.style.display = 'flex';
    var detail = document.getElementById('cw-boot-detail');
    if (detail && msg) {
      detail.textContent = String(msg);
      detail.style.display = 'block';
    }
  }
  window.__cwBootOk = false;
  window.addEventListener('error', function(ev){
    if (!window.__cwBootOk) {
      showBootError((ev && ev.message) || 'Unknown script error');
    }
  });
  window.addEventListener('unhandledrejection', function(ev){
    if (!window.__cwBootOk) {
      var reason = ev && ev.reason ? (ev.reason.message || String(ev.reason)) : 'Promise rejected';
      showBootError(reason);
    }
  });
  setTimeout(function(){
    if (!window.__cwBootOk) {
      var root = document.getElementById('root');
      if (root && root.querySelector('#cw-boot-fallback')) {
        var title = document.getElementById('cw-boot-title');
        if (title) title.textContent = 'تعذّر تشغيل اللعبة في هذا العارض';
      }
    }
  }, 4000);
})();`;

const fallbackCss = `
  #cw-boot-fallback{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#020617;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;text-align:center;z-index:1}
  #cw-boot-card{max-width:420px;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.6)}
  #cw-boot-title{font-size:18px;font-weight:800;color:#fbbf24;margin-bottom:10px}
  #cw-boot-desc{font-size:13px;line-height:1.65;color:#cbd5e1;margin:0}
  #cw-boot-detail{display:none;margin-top:12px;padding:10px;border-radius:8px;background:#450a0a;border:1px solid #ef4444;color:#fecaca;font-size:11px;font-family:monospace;word-break:break-word;text-align:left;direction:ltr}
`;

const buildStamp = new Date().toISOString();
const html = `<!doctype html>
<!-- CityWorld Standalone v6 | Built ${buildStamp} | Police Stars & Military Jets, Voxel 412/416, 5 Mech Robots, Multiplayer P2P & WS, Save, HUD Scale -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>CityWorld v6 — 3D Open World Sandbox</title>
    <meta name="description" content="Explore CityWorld, a 3D open-world city with 10 districts, driveable vehicles, live traffic, police chases, dynamic weather, day/night cycle, and missions." />
    <meta name="theme-color" content="#020617" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="CityWorld" />
    ${iconDataUri ? `<link rel="icon" type="image/svg+xml" href="${iconDataUri}" />` : ''}
    <style>${fallbackCss}\n${compiledCss}</style>
  </head>
  <body class="bg-slate-950 text-white overflow-hidden select-none">
    <div id="root">
      <div id="cw-boot-fallback" dir="rtl">
        <div id="cw-boot-card">
          <div id="cw-boot-title">جاري تشغيل CityWorld 3D...</div>
          <p id="cw-boot-desc">إذا لم تفتح اللعبة، تأكد من فتح هذا الملف عبر متصفح مثل <b>Chrome</b> أو <b>Safari</b> أو <b>Edge</b> (وليس عبر «عارض HTML» المدمج أو معاينة التطبيقات لأنها تعطل JavaScript و WebGL).</p>
          <noscript><p style="margin-top:12px;color:#fca5a5;font-size:13px;">تنبيه: هذا العارض عطّل JavaScript. افتح الملف من متصفح Chrome أو Safari.</p></noscript>
          <div id="cw-boot-detail"></div>
        </div>
      </div>
    </div>
    <script>${bootHelperScript}</script>
    <script>${safeJs}</script>
    <script>(function(){var r=document.getElementById('root');if(r&&!r.querySelector('#cw-boot-fallback')){window.__cwBootOk=true;}})();</script>
  </body>
</html>
`;

const rootOut = path.join(rootDir, 'CityWorld.html');
const distOut = path.join(distDir, 'CityWorld.html');
fs.writeFileSync(rootOut, html, 'utf8');
fs.writeFileSync(distOut, html, 'utf8');
console.log(`Built standalone CityWorld.html (${html.length} bytes) -> root & dist/`);
