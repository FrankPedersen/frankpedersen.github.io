// Accepttest i en rigtig browser (SPEC-privatlivstekst.md, Franks udvidelse 25. oktober 2026): Om mig på engelsk.
// Siden vises fra en lille lokal webserver, så links og det gemte sprogvalg virker som på sitet. Testen samler al dansk
// tekst på Om mig (tekst, pladsholdere, aria-labels, titel og formularens svar), trykker på sprogknappen og tjekker, at
// ingen af de danske tekster er tilbage. Til sidst går den til forsiden og tilbage og tjekker, at valget er husket.
// Kræver Node 22+ og Chrome eller Edge.
//
//   node tools/tjek_engelsk_om_mig.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES, errorBody, messageBody } from '../_kontakt-api/src/contact-messages.js';

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

// Navne og tegn, der er de samme på begge sprog
const NAVNE = ['Kontraktbridge', 'Frank Pedersen', 'Fordelingstræneren', 'Kasino', 'Es-makker whist', 'Bridge', 'E-mail', '7NT',
  '© 2026 Frank Pedersen', 'English', 'Dansk', '→'];
// Danske småord, som ikke findes på engelsk
const DANSKE_ORD = /\b(og|jeg|du|din|dit|dine|mig|til|med|ikke|eller|har|af|på|kan|vil|skal|alle|fra|om|hvad|besked|beskeder|navn|kontakt|trænere|sendt|sender)\b/i;
// Svarene fra kontakt-API'et står på dansk og engelsk i _kontakt-api/src/contact-messages.js; siden skal vise de engelske.
// Et svar uden engelsk (en ukendt fejl fra serveren) giver sidens egen engelske standardbesked.
const STATUS = { sent: 200, notJson: 415, tooLarge: 413, notConfigured: 503, rateLimited: 429, notDelivered: 502 };
const API_SVAR = [
  ...Object.entries(MESSAGES).map(([nøgle, m]) => (nøgle === 'sent' ? [200, messageBody(m)] : [STATUS[nøgle] || 400, errorBody(m)])),
  [500, { error: 'En ukendt fejl fra serveren.' }],
  ['net', null],
];

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const server = createServer((req, res) => {
  let sti = normalize(join(ROD, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!sti.startsWith(normalize(ROD))) { res.writeHead(403).end(); return; }
  if (existsSync(sti) && statSync(sti).isDirectory()) sti = join(sti, 'index.html');
  if (!existsSync(sti)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPER[extname(sti)] || 'application/octet-stream' }).end(readFileSync(sti));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SITE = `http://127.0.0.1:${server.address().port}`;

const port = 9800 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-engelsk-'));
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
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${!ok && detalje ? ` – ${detalje}` : ''}`);
};

// Al tekst, en besøgende kan se eller høre: synlig tekst, pladsholdere, aria-labels, title-attributter og sidens titel.
const SAML = `
  const ud = new Set([document.title]);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode, el = n.parentElement;
    if (!el || el.closest('script, style, noscript')) continue;
    const t = n.textContent.replace(/\\s+/g, ' ').trim();
    if (t) ud.add(t);
  }
  document.querySelectorAll('[placeholder], [aria-label], [title]').forEach((el) => {
    ['placeholder', 'aria-label', 'title'].forEach((a) => { const v = el.getAttribute(a); if (v) ud.add(v.trim()); });
  });
  return [...ud];
`;
// Formularens svar: knappen under afsendelse og svaret for hvert af API'ets svar
const SVAR = `
  const form = document.getElementById('kontaktform');
  const knap = form.querySelector('button[type=submit]');
  const svar = document.getElementById('kontakt-svar');
  const ud = [];
  for (const [status, krop] of ${JSON.stringify(API_SVAR)}) {
    let løs, afvis;
    window.fetch = () => new Promise((r, f) => { løs = r; afvis = f; });
    form.querySelector('#kontakt-navn').value = 'Ada';
    form.querySelector('#kontakt-email').value = 'ada@example.com';
    form.querySelector('#kontakt-besked').value = 'Hej';
    form.querySelector('#kontakt-navn').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    knap.click();
    ud.push(knap.textContent.trim());
    if (status === 'net') afvis(new TypeError('Failed to fetch'));
    else løs(new Response(JSON.stringify(krop), { status, headers: { 'Content-Type': 'application/json' } }));
    await new Promise((r) => setTimeout(r, 60));
    ud.push(svar.textContent.trim(), knap.textContent.trim());
  }
  return ud;
`;

try {
  await json('/json/version');
  const fane = await json('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(fane.webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
  let id = 0;
  const ventende = new Map();
  let indlæst = 0;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); }
    else if (d.method === 'Page.loadEventFired') indlæst++;
  };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const kør = async (kode) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${kode} })()`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'fejl i siden');
    return r.result.result.value;
  };
  const gåTil = async (fn) => {
    const før = indlæst;
    await fn();
    for (let i = 0; i < 100 && indlæst === før; i++) await vent(100);
    await vent(150);
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.enable');

  // Dansk som standard
  await gåTil(() => send('Page.navigate', { url: `${SITE}/om-mig/` }));
  tjek((await kør('return document.documentElement.lang')) === 'da', 'Om mig er på dansk som standard');
  const knapDa = await kør(`const b = document.getElementById('langBtn'); return b && { tekst: b.textContent.trim(), lang: b.getAttribute('lang') };`);
  tjek(knapDa?.tekst === 'English' && knapDa?.lang === 'en', 'sprogknappen står i topbjælken som på forsiden ("English")', JSON.stringify(knapDa));
  const dansk = new Set([...(await kør(SAML)), ...(await kør(SVAR))]);

  // Tryk på sprogknappen
  await gåTil(() => kør(`document.getElementById('langBtn').click();`));
  tjek((await kør('return document.documentElement.lang')) === 'en', 'efter tryk på sprogknappen er siden på engelsk');
  tjek((await kør(`return localStorage.getItem('lang')`)) === 'en', "valget er gemt under 'lang' som på forsiden og i ordbogen");
  const engelsk = [...(await kør(SAML)), ...(await kør(SVAR))];
  const neutral = (t) => NAVNE.some((n) => t === n) || /^[\d\s.,:;!?()–—…/@+→-]*$/.test(t);
  const tilbage = engelsk.filter((t) => !neutral(t) && dansk.has(t));
  tjek(tilbage.length === 0, 'ingen af Om migs danske tekster er tilbage på engelsk', JSON.stringify(tilbage));
  const rest = (t) => NAVNE.reduce((s, n) => s.split(n).join(' '), t);
  const mistænkt = engelsk.filter((t) => !neutral(t) && t !== 'Dansk' && (/[æøåÆØÅ]/.test(rest(t)) || DANSKE_ORD.test(rest(t))));
  tjek(mistænkt.length === 0, 'ingen danske bogstaver eller småord i den engelske tekst', JSON.stringify(mistænkt));
  console.log(`     ${dansk.size} danske og ${engelsk.length} engelske tekster sammenlignet`);
  const knapEn = await kør(`const b = document.getElementById('langBtn'); return { tekst: b.textContent.trim(), lang: b.getAttribute('lang') };`);
  tjek(knapEn.tekst === 'Dansk' && knapEn.lang === 'da', 'knappen hedder nu "Dansk"', JSON.stringify(knapEn));

  // Valget følger med til forsiden og tilbage
  await gåTil(() => kør(`document.querySelector('.bar a.brand, nav a.brand').click();`));
  const forside = await kør(`return { sti: location.pathname, lang: document.documentElement.lang, knap: document.getElementById('langBtn').textContent.trim() };`);
  tjek(forside.sti === '/' && forside.lang === 'en' && forside.knap === 'Dansk', 'forsiden er på engelsk, når man kommer fra Om mig', JSON.stringify(forside));
  await gåTil(() => kør(`document.querySelector('a[href="/om-mig/"]').click();`));
  const tilbageTil = await kør(`return { sti: location.pathname, lang: document.documentElement.lang };`);
  tjek(tilbageTil.sti === '/om-mig/' && tilbageTil.lang === 'en', 'Om mig husker engelsk, når man går tilbage fra forsiden', JSON.stringify(tilbageTil));

  // Og tilbage til dansk
  await gåTil(() => kør(`document.getElementById('langBtn').click();`));
  const igen = await kør(`return { lang: document.documentElement.lang, h1: document.querySelector('h1').textContent.trim() };`);
  tjek(igen.lang === 'da' && igen.h1 === 'Hej, jeg hedder Frank', '"Dansk" skifter tilbage til dansk', JSON.stringify(igen));
  ws.close();
} finally {
  proces.kill();
  server.close();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
process.exit(fejl ? 1 : 0);
