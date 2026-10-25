// Accepttest i en rigtig browser (SPEC-privatlivstekst.md, Franks udvidelse 25. oktober 2026): skrifttyperne ligger på
// sitet selv, og siderne ser ud som før. Den udgivne udgave (tagget v-foer-privatliv, som henter fra Google Fonts) og den
// nye vises fra hver sin lokale webserver. For forsiden, Om mig og ordbogen sammenlignes de skrifttyper, Chrome faktisk
// tegner med; forsiden og ordbogen sammenlignes også pixel for pixel ved 390 og 1280 px over sidefoden (sidefoden har
// siden fået linket Scoring i bridge). Den nye udgave må ikke hente noget fra Google. Kræver Node 22+, git og Chrome eller Edge.
//
//   node tools/tjek_skrifttyper.mjs
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const FOER = 'v-foer-privatliv';
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

// Den udgivne udgave pakkes ud fra tagget med et midlertidigt indeks, så repoets eget indeks ikke røres
const gammel = mkdtempSync(join(tmpdir(), 'tjek-skrift-foer-'));
const indeks = { ...process.env, GIT_INDEX_FILE: join(gammel, '.indeks') };
for (const args of [['read-tree', FOER], ['checkout-index', '-a', `--prefix=${gammel.replaceAll('\\', '/')}/`]]) {
  const r = spawnSync('git', args, { cwd: ROD, env: indeks });
  if (r.status !== 0) { console.error(`git ${args[0]} fejlede: ${r.stderr}`); process.exit(2); }
}

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };
async function webserver(mappe) {
  const s = createServer((req, res) => {
    let sti = normalize(join(mappe, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!sti.startsWith(normalize(mappe))) { res.writeHead(403).end(); return; }
    if (existsSync(sti) && statSync(sti).isDirectory()) sti = join(sti, 'index.html');
    if (!existsSync(sti)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPER[extname(sti)] || 'application/octet-stream' }).end(readFileSync(sti));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { s, url: `http://127.0.0.1:${s.address().port}` };
}
const før = await webserver(gammel), nu = await webserver(ROD);

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
      // alt over sidefoden; sidefodens links er ændret siden udgaven før
      const m = await send('Runtime.evaluate', { returnByValue: true,
        expression: `({ w: document.documentElement.scrollWidth, h: Math.floor((document.querySelector('.footer') || document.body).getBoundingClientRect().top + scrollY) })` });
      const { w, h } = m.result.result.value;
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
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
      await t.åbn(nu.url + sti, bredde);
      const google = t.kald.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u));
      const egne = t.kald.filter((u) => u.includes('/fonts/') && u.endsWith('.woff2'));
      const fNu = []; for (const s of selectors) fNu.push(await t.skrifter(s));
      tjek(google.length === 0 && egne.length > 0, `${sti} ${bredde} px: intet hentes fra Google; ${egne.length} skrifttyper fra /fonts/`, google.join(' '));
      selectors.forEach((s, i) => tjek(fGammel[i] && fGammel[i] === fNu[i], `${sti} ${bredde} px: "${s}" tegnes med ${fNu[i]}`, `før: ${fGammel[i]}`));
      if (pixel) {
        const d = await forskel(t, bGammel, await t.billede());
        tjek(d.n === 0, `${sti} ${bredde} px: siden er pixel for pixel som før over sidefoden`, JSON.stringify(d));
      }
    }
  }
  await t.luk();
} finally {
  proces.kill();
  før.s.close(); nu.s.close();
  await vent(300);
  for (const m of [profil, gammel]) { try { rmSync(m, { recursive: true, force: true }); } catch {} }
}
process.exit(fejl ? 1 : 0);
