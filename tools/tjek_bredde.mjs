// Accepttest i en rigtig browser (SPEC-sprog-og-ordbog.md): ved 390 px har forsiden, Om mig og ordbogssiden ingen
// vandret rulning, på dansk og engelsk. Kræver Node 22+ (fetch og WebSocket) og Chrome eller Edge.
//
//   node tools/tjek_bredde.mjs [sider …]
//
// Stien til browseren kan gives i CHROME. Slutter med kode 1, hvis en side er bredere end skærmen.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const BREDDE = 390;
const SIDER = process.argv.length > 2 ? process.argv.slice(2) : ['index.html', 'om-mig/index.html', 'ordbog/index.html'];
const KANDIDATER = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const browser = KANDIDATER.find((p) => existsSync(p));
if (!browser) {
  console.error('Fandt hverken Chrome eller Edge; sæt CHROME til stien.');
  process.exit(2);
}

const port = 9300 + Math.floor(Math.random() * 500);
const profil = mkdtempSync(join(tmpdir(), 'tjek-bredde-'));
const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], {
  stdio: 'ignore',
});

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

/** Åbner siden ved 390 px og giver dokumentets bredde og de elementer, der stikker ud. */
async function mål(url) {
  const fane = await json(`/json/new?about:blank`, 'PUT');
  const ws = new WebSocket(fane.webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
  let id = 0;
  const ventende = new Map();
  const hændelser = [];
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (data.id && ventende.has(data.id)) { ventende.get(data.id)(data); ventende.delete(data.id); }
    else if (data.method) hændelser.push(data.method);
  };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: BREDDE, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable');
  await send('Page.navigate', { url });
  for (let i = 0; i < 100 && !hændelser.includes('Page.loadEventFired'); i++) await vent(100);
  const svar = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `document.fonts.ready.then(() => {
      const d = document.documentElement;
      const ud = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 0.5)
        .slice(0, 5)
        .map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
      return { scroll: d.scrollWidth, client: d.clientWidth, ud };
    })`,
  });
  ws.close();
  await json(`/json/close/${fane.id}`).catch(() => {});
  return svar.result.result.value;
}

let fejl = 0;
try {
  await json('/json/version');
  for (const sti of SIDER) {
    for (const lang of ['da', 'en']) {
      const url = `${pathToFileURL(resolve(ROD, sti)).href}?lang=${lang}`;
      const r = await mål(url);
      const ok = r.scroll <= r.client;
      if (!ok) fejl++;
      console.log(`${ok ? 'ok  ' : 'FEJL'} ${sti} (${lang}): ${r.scroll} px i en ${r.client} px bred skærm${ok ? '' : ` – stikker ud: ${r.ud.join(', ')}`}`);
    }
  }
} finally {
  proces.kill();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
