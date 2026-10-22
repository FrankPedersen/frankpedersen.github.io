// Accepttest i en rigtig browser (SPEC-kontaktformular.md, del 2): kontaktformularen på Om mig udfyldes og sendes med
// en falsk fetch, så der ikke sendes mails. Tjekker "Sender …", JSON-feltet, svarene med role="status" og role="alert",
// at formularen tømmes efter succes, og at et tomt felt stopper afsendelsen. Kræver Node 22+ og Chrome eller Edge.
//
//   node tools/tjek_kontakt.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const API = 'https://kontraktbridge-kontakt.azurewebsites.net/api/contact';
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

const port = 9400 + Math.floor(Math.random() * 500);
const profil = mkdtempSync(join(tmpdir(), 'tjek-kontakt-'));
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
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${ok || !detalje ? '' : ` – ${detalje}`}`);
};

try {
  await json('/json/version');
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
  const kør = async (kode) => {
    const svar = await send('Runtime.evaluate', { expression: `(async () => { ${kode} })()`, awaitPromise: true, returnByValue: true });
    if (svar.result.exceptionDetails) throw new Error(svar.result.exceptionDetails.exception?.description ?? 'fejl i siden');
    return svar.result.result.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(join(ROD, 'om-mig/index.html')).href });
  for (let i = 0; i < 100 && !hændelser.includes('Page.loadEventFired'); i++) await vent(100);

  // Falsk fetch: gemmer kaldet og lader testen bestemme svaret.
  await kør(`
    window.__kald = [];
    window.fetch = (url, opts) => new Promise((resolve, reject) => window.__kald.push({ url, opts, resolve, reject }));
    window.__udfyld = (navn, email, besked) => {
      const f = document.getElementById('kontaktform');
      f.querySelector('#kontakt-navn').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      f.querySelector('#kontakt-navn').value = navn;
      f.querySelector('#kontakt-email').value = email;
      f.querySelector('#kontakt-besked').value = besked;
    };
    window.__tilstand = () => {
      const f = document.getElementById('kontaktform');
      const knap = f.querySelector('button[type=submit]');
      const svar = document.getElementById('kontakt-svar');
      return { knap: knap.textContent.trim(), låst: knap.disabled, svar: svar.textContent.trim(), rolle: svar.getAttribute('role'),
               navn: f.querySelector('#kontakt-navn').value, kald: window.__kald.length };
    };
  `);

  // Et tomt felt stopper afsendelsen (browserens egen validering).
  await kør(`document.querySelector('#kontaktform button[type=submit]').click();`);
  tjek((await kør('return window.__kald.length')) === 0, 'tomme felter sender ikke');

  // Succes
  await kør(`window.__udfyld('Ada Lovelace', 'ada@example.com', 'Hej fra bridgebordet.');`);
  await vent(300);
  await kør(`document.querySelector('#kontaktform button[type=submit]').click();`);
  let t = await kør('return window.__tilstand()');
  tjek(t.kald === 1 && t.knap === 'Sender …' && t.låst, 'knappen siger "Sender …" og er låst under afsendelsen', JSON.stringify(t));
  const kald = await kør(`const k = window.__kald[0]; return { url: k.url, metode: k.opts.method, type: new Headers(k.opts.headers).get('content-type'), krop: JSON.parse(k.opts.body) };`);
  tjek(kald.url === API && kald.metode === 'POST' && kald.type?.includes('application/json'), 'POST med JSON til funktionens adresse', JSON.stringify(kald));
  const k = kald.krop;
  tjek(k.name === 'Ada Lovelace' && k.email === 'ada@example.com' && k.message === 'Hej fra bridgebordet.' && k.website === ''
    && Number.isInteger(k.elapsedMilliseconds) && k.elapsedMilliseconds >= 250, 'felterne name, email, message, website og elapsedMilliseconds', JSON.stringify(k));
  await kør(`window.__kald[0].resolve(new Response(JSON.stringify({ message: 'Tak for din besked. Den er sendt.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })); await new Promise((r) => setTimeout(r, 50));`);
  t = await kør('return window.__tilstand()');
  tjek(t.svar === 'Tak for din besked. Den er sendt.' && t.rolle === 'status', 'succes vises med role="status"', JSON.stringify(t));
  tjek(t.navn === '' && t.knap === 'Send besked' && !t.låst, 'formularen er tømt, og knappen er klar igen', JSON.stringify(t));

  // Fejl fra API'et
  await kør(`window.__udfyld('Ada', 'ada@example.com', 'Igen'); document.querySelector('#kontaktform button[type=submit]').click();`);
  await kør(`window.__kald[1].resolve(new Response(JSON.stringify({ error: 'Vent et øjeblik, og prøv at sende beskeden igen.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })); await new Promise((r) => setTimeout(r, 50));`);
  t = await kør('return window.__tilstand()');
  tjek(t.svar === 'Vent et øjeblik, og prøv at sende beskeden igen.' && t.rolle === 'alert' && t.navn === 'Ada', 'API-fejlen vises med role="alert", og felterne bliver', JSON.stringify(t));

  // API'et kan ikke nås
  await kør(`document.querySelector('#kontaktform button[type=submit]').click(); window.__kald[2].reject(new TypeError('Failed to fetch')); await new Promise((r) => setTimeout(r, 50));`);
  t = await kør('return window.__tilstand()');
  tjek(t.svar === 'Beskeden kunne ikke sendes. Prøv igen senere.' && t.rolle === 'alert' && !t.låst, 'uden forbindelse: "Beskeden kunne ikke sendes. Prøv igen senere."', JSON.stringify(t));

  ws.close();
} finally {
  proces.kill();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
