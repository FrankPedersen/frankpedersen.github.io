// Fast test i en rigtig browser: skrifttyperne ligger på sitet selv. Forsiden, Om mig og ordbogen vises fra en lokal
// webserver ved 390 og 1280 px, og intet må hentes fra Google. Chrome skal tegne overskrifterne med Manrope,
// brødteksten med Inter og spillefarverne med Noto Sans Symbols 2, alle fra fonts/ og ikke fra systemet. (Accepttesten
// for privatlivsteksten sammenlignede også med Googles skrifttyper og pixel for pixel; den er bestået.) Kræver Node 22+
// og Chrome eller Edge.
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
const nu = await webserver(ROD);

const port = 9700 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-skrift-'));
const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run',
  'about:blank'], { stdio: 'ignore' });
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
    kald,
    async åbn(url, bredde) {
      await send('Emulation.setDeviceMetricsOverride', { width: bredde, height: 900, deviceScaleFactor: 1, mobile: bredde < 600 });
      const n = indlæst; kald.length = 0;
      await send('Page.navigate', { url });
      for (let i = 0; i < 150 && indlæst === n; i++) await vent(100);
      await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 400)))', awaitPromise: true });
    },
    // Skrifttyperne, Chrome tegner elementet med, som { familie, egen } (egen: fra sitet, ikke fra systemet)
    async skrifter(selector) {
      const doc = await send('DOM.getDocument', { depth: -1 });
      const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector });
      if (!q.result?.nodeId) return [];
      const f = await send('CSS.getPlatformFontsForNode', { nodeId: q.result.nodeId });
      return (f.result?.fonts ?? []).map((x) => ({ familie: x.familyName, egen: x.isCustomFont }));
    },
    luk: async () => { ws.close(); await json(`/json/close/${f.id}`).catch(() => {}); },
  };
}

// Hver sides elementer og den skrifttype, de skal tegnes med
const SIDER = [
  ['/', { h1: 'Manrope', '.hero-body p': 'Inter', '.card .art .su': 'Noto Sans Symbols 2', '.footer-about p': 'Inter' }],
  ['/om-mig/', { h1: 'Manrope', '.om-lead': 'Inter', '.om-kontakt h2': 'Manrope', '.om-felt label': 'Inter' }],
  ['/ordbog/', { h1: 'Manrope', '.ord-lead': 'Inter', '#kipning .def': 'Inter', '[id="1430-fourteenthirty"] .def': 'Inter',
    '.entry .meta': 'Inter' }],
];

try {
  await json('/json/version');
  const t = await fane();
  for (const [sti, skrift] of SIDER) {
    for (const bredde of [390, 1280]) {
      await t.åbn(nu.url + sti, bredde);
      const google = t.kald.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u));
      const egne = t.kald.filter((u) => u.includes('/fonts/') && u.endsWith('.woff2'));
      tjek(google.length === 0 && egne.length > 0, `${sti} ${bredde} px: intet hentes fra Google; ${egne.length} skrifttyper fra /fonts/`, google.join(' '));
      for (const [selector, familie] of Object.entries(skrift)) {
        const skrifter = await t.skrifter(selector);
        const vist = skrifter.map((x) => `${x.familie}${x.egen ? '' : ' (system)'}`).sort().join(', ');
        tjek(skrifter.some((x) => x.egen && x.familie.startsWith(familie)), `${sti} ${bredde} px: "${selector}" tegnes med ${familie} fra sitet`, vist);
      }
    }
  }
  await t.luk();
} finally {
  proces.kill();
  nu.s.close();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
