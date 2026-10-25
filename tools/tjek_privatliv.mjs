// Accepttest i en rigtig browser (SPEC-privatlivstekst.md): privatlivsteksten på Om mig står synligt under formularens
// svarlinje, har mindst 4,5:1 i kontrast mod den mørke boks, og siden ruller ikke vandret ved 390 px. Kræver Node 22+
// og Chrome eller Edge.
//
//   node tools/tjek_privatliv.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const port = 9900 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-privatliv-'));
const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
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
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${detalje ? ` – ${detalje}` : ''}`);
};

// Kontrast efter WCAG 2: relativ luminans af to farver "rgb(r, g, b)"
const lum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

try {
  await json('/json/version');
  for (const [bredde, mobil] of [[390, true], [1280, false]]) {
    const fane = await json('/json/new?about:blank', 'PUT');
    const ws = new WebSocket(fane.webSocketDebuggerUrl);
    await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
    let id = 0;
    const ventende = new Map();
    const hændelser = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); } else if (d.method) hændelser.push(d.method);
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const kør = async (kode) => (await send('Runtime.evaluate', { expression: `(async () => { ${kode} })()`, awaitPromise: true, returnByValue: true })).result.result.value;

    await send('Emulation.setDeviceMetricsOverride', { width: bredde, height: mobil ? 844 : 900, deviceScaleFactor: mobil ? 2 : 1, mobile: mobil });
    await send('Page.enable');
    await send('Page.navigate', { url: pathToFileURL(join(ROD, 'om-mig/index.html')).href });
    for (let i = 0; i < 100 && !hændelser.includes('Page.loadEventFired'); i++) await vent(100);
    // Svarlinjen vises med en tekst, som efter en afsendelse
    await kør(`document.getElementById('kontakt-svar').textContent = 'Tak for din besked. Den er sendt.';`);

    const r = await kør(`
      const p = document.querySelector('.om-kontakt .om-privat');
      if (!p) return null;
      const boks = document.querySelector('.om-kontakt');
      const svar = document.getElementById('kontakt-svar').getBoundingClientRect();
      const b = p.getBoundingClientRect();
      const s = getComputedStyle(p);
      const fed = getComputedStyle(p.querySelector('strong'));
      const d = document.documentElement;
      return { synlig: b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden', under: b.top >= svar.bottom,
               farve: s.color, fedFarve: fed.color, fedVægt: fed.fontWeight, bund: getComputedStyle(boks).backgroundColor,
               størrelse: s.fontSize, tekst: p.textContent.replace(/\\s+/g, ' ').trim(), scroll: d.scrollWidth, klient: d.clientWidth };
    `);
    if (!r) { tjek(false, `${bredde} px: privatlivsteksten findes`); ws.close(); continue; }
    tjek(r.synlig && r.under, `${bredde} px: teksten står synligt under formularens svarlinje`);
    tjek(r.tekst.startsWith('Om dine oplysninger.') && Number(r.fedVægt) >= 600, `${bredde} px: "Om dine oplysninger." står med fed`);
    const k = kontrast(r.farve, r.bund), kf = kontrast(r.fedFarve, r.bund);
    tjek(k >= 4.5 && kf >= 4.5, `${bredde} px: kontrast ${k.toFixed(1)}:1 (fed ${kf.toFixed(1)}:1) i ${r.størrelse}`, `${r.farve} på ${r.bund}`);
    tjek(r.scroll <= r.klient, `${bredde} px: ingen vandret rulning (${r.scroll}/${r.klient} px)`);
    ws.close();
    await json(`/json/close/${fane.id}`).catch(() => {});
  }
} finally {
  proces.kill();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
