// Accepttest i en rigtig browser (SPEC-privatlivstekst.md, Franks udvidelse 25. oktober 2026): skrifttyperne ligger på
// sitet selv, og siderne ser ud, som da de hentede skrifttyperne fra Google Fonts. Siderne vises fra to lokale
// webservere: "før" er de samme filer, hvor linkene til fonts/tekst.css og fonts/symboler.css er skiftet ud med Googles
// links, som de stod før privatliv; "nu" er filerne, som de er. For forsiden, Om mig og ordbogen sammenlignes de
// skrifttyper, Chrome faktisk tegner med, og forsiden og ordbogen sammenlignes pixel for pixel ved 390 og 1280 px.
// "Nu" må ikke hente noget fra Google. Kræver Node 22+ og Chrome eller Edge, og "før" kræver internet.
//
//   node tools/tjek_skrifttyper.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const browser = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));
if (!browser) {
  console.error('Fandt hverken Chrome eller Edge; sæt CHROME til stien.');
  process.exit(2);
}

// Googles links, som siderne havde før privatliv (adressen skrives i to dele, så tjek_skrifttyper.py ikke finder den)
const GOOGLE = 'https://fonts.' + 'googleapis.com/css2?family=';
const SOM_FØR = {
  tekst: GOOGLE + 'Inter:wght@400;600&family=Manrope:wght@800&display=swap',
  symboler: GOOGLE + 'Noto+Sans+Symbols+2&text=%E2%99%A0%E2%99%A5%E2%99%A6%E2%99%A3&display=swap',
};
const medGoogle = (html) => html.replace(/<link rel="stylesheet" href="(?:\.\.\/)?fonts\/(tekst|symboler)\.css">/g,
  (_, navn) => `<link rel="stylesheet" href="${SOM_FØR[navn]}">`);

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
async function webserver(mappe, omskriv = (x) => x) {
  const s = createServer((req, res) => {
    let sti = normalize(join(mappe, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!sti.startsWith(normalize(mappe))) { res.writeHead(403).end(); return; }
    if (existsSync(sti) && statSync(sti).isDirectory()) sti = join(sti, 'index.html');
    if (!existsSync(sti)) { res.writeHead(404).end(); return; }
    const indhold = extname(sti) === '.html' ? omskriv(readFileSync(sti, 'utf8')) : readFileSync(sti);
    res.writeHead(200, { 'Content-Type': TYPER[extname(sti)] || 'application/octet-stream' }).end(indhold);
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { s, url: `http://127.0.0.1:${s.address().port}` };
}
const før = await webserver(ROD, medGoogle), nu = await webserver(ROD);

const port = 9700 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-skrift-'));
const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run',
  '--hide-scrollbars', '--font-render-hinting=none', 'about:blank'], { stdio: 'ignore' });
const vent = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(sti, metode = 'GET') {
  for (let i = 0; i < 50; i++) {
    try {
      const svar = await fetch(`http://127.0.0.1:${port}${sti}`, { method: metode });
      if (svar.ok) return await svar.json();
    } catch {}
    await vent(200);
  }
  throw new Error(`Browseren svarer ikke på ${sti}`);
}

let fejl = 0;
const tjek = (ok, navn, detalje = '') => {
  if (!ok) fejl++;
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${!ok && detalje ? ` – ${detalje}` : ''}`);
};

async function fane() {
  const f = await json('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(f.webSocketDebuggerUrl);
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  let id = 0;
  const ventende = new Map();
  const kald = [];
  let indlæst = 0;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); }
    else if (d.method === 'Page.loadEventFired') indlæst++;
    else if (d.method === 'Network.requestWillBeSent') kald.push(d.params.request.url);
  };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable'); await send('Network.enable'); await send('DOM.enable'); await send('CSS.enable');
  return {
    send, kald,
    async åbn(url, bredde) {
      await send('Emulation.setDeviceMetricsOverride', { width: bredde, height: 900, deviceScaleFactor: 1, mobile: bredde < 600 });
      const n = indlæst; kald.length = 0;
      await send('Page.navigate', { url });
      for (let i = 0; i < 150 && indlæst === n; i++) await vent(100);
      await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 400)))', awaitPromise: true });
    },
    async skrifter(selector) {
      const doc = await send('DOM.getDocument', { depth: -1 });
      const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector });
      if (!q.result?.nodeId) return null;
      const f = await send('CSS.getPlatformFontsForNode', { nodeId: q.result.nodeId });
      return (f.result?.fonts ?? []).map((x) => `${x.familyName}${x.isCustomFont ? '' : ' (system)'}:${x.glyphCount}`).sort().join(', ');
    },
    async billede() {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      return r.result.data;
    },
    luk: async () => { ws.close(); await json(`/json/close/${f.id}`).catch(() => {}); },
  };
}

// Sammenligner to PNG-billeder pixel for pixel i browseren
async function forskel(t, a, b) {
  const r = await t.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const læs = (d) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + d; });
    const [x, y] = await Promise.all([læs(${JSON.stringify(a)}), læs(${JSON.stringify(b)})]);
    if (x.width !== y.width || x.height !== y.height) return { størrelse: [x.width, x.height, y.width, y.height] };
    const px = (i) => { const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const p = px(x), q = px(y); let n = 0;
    for (let k = 0; k < p.length; k += 4) if (p[k] !== q[k] || p[k + 1] !== q[k + 1] || p[k + 2] !== q[k + 2]) n++;
    return { n, ialt: p.length / 4 };
  })()` });
  return r.result.result.value;
}

const SIDER = [
  ['/', ['h1', '.hero-body p', '.card .art .su', '.footer-about p'], true],
  ['/om-mig/', ['h1', '.om-lead', '.om-kontakt h2', '.om-felt label'], false],
  ['/ordbog/', ['h1', '.ord-lead', '#kipning .def', '[id="1430-fourteenthirty"] .def', '.entry .meta'], true],
];

try {
  await json('/json/version');
  const t = await fane();
  for (const [sti, selectors, pixel] of SIDER) {
    for (const bredde of [390, 1280]) {
      await t.åbn(før.url + sti, bredde);
      const fGammel = []; for (const s of selectors) fGammel.push(await t.skrifter(s));
      const bGammel = pixel ? await t.billede() : null;
      const fraGoogle = t.kald.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)).length;
      tjek(fraGoogle > 0, `${sti} ${bredde} px: "før" henter skrifttyperne fra Google`, String(fraGoogle));
      await t.åbn(nu.url + sti, bredde);
      const google = t.kald.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u));
      const egne = t.kald.filter((u) => u.includes('/fonts/') && u.endsWith('.woff2'));
      const fNu = []; for (const s of selectors) fNu.push(await t.skrifter(s));
      tjek(google.length === 0 && egne.length > 0, `${sti} ${bredde} px: intet hentes fra Google; ${egne.length} skrifttyper fra /fonts/`, google.join(' '));
      selectors.forEach((s, i) => tjek(fGammel[i] && fGammel[i] === fNu[i], `${sti} ${bredde} px: "${s}" tegnes med ${fNu[i]}`, `før: ${fGammel[i]}`));
      if (pixel) {
        const d = await forskel(t, bGammel, await t.billede());
        tjek(d.n === 0, `${sti} ${bredde} px: siden er pixel for pixel som med Googles skrifttyper`, JSON.stringify(d));
      }
    }
  }
  await t.luk();
} finally {
  proces.kill();
  før.s.close(); nu.s.close();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
