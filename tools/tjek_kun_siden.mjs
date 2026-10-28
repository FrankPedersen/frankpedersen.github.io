// Accepttest (SPEC-kun-siden.md): kun siderne og det, de bruger, udgives på www.kontraktbridge.dk. Repoets filer filtreres
// med _config.yml efter Jekylls regler, og resultatet skal være præcis UDGIVET. Uden argument lægges de filer i en
// midlertidig mappe, og forsiden, Om mig, ordbogen og Scoring i bridge åbnes derfra i Chrome på dansk og engelsk: alt,
// siden henter og linker til på sitet, skal svare 200, scriptet må ikke kaste fejl, sproget skal skifte, og beregnerne
// skal regne. Med --live køres det samme mod www.kontraktbridge.dk, og desuden skal de udelukkede filer give 404, og
// kontakt-API'et skal stadig tillade sitet (CORS). Kræver Node 22+, git og Chrome eller Edge.
//
//   node tools/tjek_kun_siden.mjs          før fletning
//   node tools/tjek_kun_siden.mjs --live   efter fletning
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const LIVE = process.argv.includes('--live');
const SITE = 'https://www.kontraktbridge.dk';
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

// Det, der udgives (SPEC-kun-siden.md): filerne og alt under mapperne, der slutter med /. En ny fil, som en side skal
// bruge, kommer på listen her.
const UDGIVET = ['CNAME', 'favicon.svg', 'fonts/', 'index.html', 'om-mig/', 'ordbog/index.html', 'robots.txt',
  'scoring/beregn.js', 'scoring/index.html', 'sitemap.xml'];
const påListen = (fil) => UDGIVET.some((u) => (u.endsWith('/') ? fil.startsWith(u) : fil === u));
// Franks liste over det, _config.yml skal udelukke
const UDELUKKET = ['CLAUDE.md', 'tools', 'docs', 'SPEC-*.md', '.claude', 'ordbog/*.md', 'scoring/*.md'];
// Udelukkede filer og de sider, GitHub Pages lavede af markdownfilerne før _config.yml (fx /CLAUDE.html og /CLAUDE)
const SKJULT = ['/CLAUDE.md', '/CLAUDE.html', '/CLAUDE', '/tools/build_ordbog.py', '/tools/tjek_kun_siden.mjs',
  '/SPEC-scoring.md', '/docs/specs/README.md', '/ordbog/Dansk_bridgeordbog.md', '/ordbog/Dansk_bridgeordbog.html',
  '/ordbog/Forslag_danske_opslagsord.md', '/ordbog/Forslag_danske_opslagsord.html', '/scoring/Scoring_i_bridge.md',
  '/scoring/Scoring_i_bridge.html', '/scoring/Scoring_i_bridge.en.md', '/scoring/Scoring_i_bridge.en.html'];
// De to apps ligger i egne repoer under samme domæne
const ANDRE_REPOER = /^\/(fordelingstraeneren|konventionstraener)\//;

let fejl = 0;
const tjek = (ok, navn, detalje = '') => {
  if (!ok) fejl++;
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${!ok && detalje ? ` – ${detalje}` : ''}`);
};

// Jekyll 3 (GitHub Pages): filer og mapper, der begynder med _ . # eller ~ eller ender på ~, udgives ikke, og et navn i
// exclude udelukker filen og alt under mappen; * og ? er mønstre
function exclude() {
  const blok = readFileSync(join(ROD, '_config.yml'), 'utf8').match(/^exclude:\r?\n((?:[ \t]+-[^\n]*\n?)+)/m);
  return blok ? blok[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').replace(/\s+#.*$/, '').trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean) : [];
}
const mønster = (m) => new RegExp(`^${m.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
const jekyllUdgiver = (fil, ud) => !fil.split('/').some((d) => /^[_.#~]/.test(d) || d.endsWith('~'))
  && !ud.some((m) => fil.startsWith(m) || mønster(m).test(fil));

const ud = existsSync(join(ROD, '_config.yml')) ? exclude() : [];
const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROD, encoding: 'utf8' });
if (git.status !== 0) { console.error(`git ls-files fejlede: ${git.stderr}`); process.exit(2); }
const filer = git.stdout.split('\0').filter((f) => f && existsSync(join(ROD, f)));
const udgivne = filer.filter((f) => jekyllUdgiver(f, ud));

tjek(existsSync(join(ROD, '_config.yml')), '_config.yml findes');
for (const m of UDELUKKET) tjek(ud.includes(m), `_config.yml udelukker ${m}`, ud.join(', '));
const forMeget = udgivne.filter((f) => !påListen(f));
tjek(forMeget.length === 0, `kun siderne og det, de bruger, udgives (${udgivne.length} filer)`, forMeget.join(' '));
const mangler = [...UDGIVET.filter((u) => !udgivne.some((f) => (u.endsWith('/') ? f.startsWith(u) : f === u))),
  ...filer.filter((f) => påListen(f) && !udgivne.includes(f))];
tjek(mangler.length === 0, 'alt på listen udgives', mangler.join(' '));
const sluppet = SKJULT.filter((s) => /\.(md|py|mjs)$/.test(s) && jekyllUdgiver(s.slice(1), ud));
tjek(sluppet.length === 0, 'de udelukkede filer udgives ikke efter Jekylls regler', sluppet.join(' '));

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
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

// Før fletning: kun de filer, Jekyll ville udgive, i en midlertidig mappe
let side = null, mappe = null;
if (!LIVE) {
  mappe = mkdtempSync(join(tmpdir(), 'tjek-kun-siden-'));
  for (const f of udgivne) { mkdirSync(dirname(join(mappe, f)), { recursive: true }); copyFileSync(join(ROD, f), join(mappe, f)); }
  side = await webserver(mappe);
}
const BASE = LIVE ? SITE : side.url;

if (LIVE) {
  const cache = ' (GitHub Pages kan være op til 10 minutter om at vise den nye udgave)';
  for (const s of SKJULT) {
    const r = await fetch(SITE + s);
    tjek(r.status === 404, `${s} giver 404`, `${r.status}${cache}`);
  }
  // GitHub Pages bruger CNAME til domænet og viser ikke selve filen
  for (const f of udgivne.filter((f) => f !== 'CNAME')) {
    const sti = '/' + f.replace(/(^|\/)index\.html$/, '$1');
    const r = await fetch(SITE + sti);
    tjek(r.status === 200, `${sti} svarer 200`, String(r.status));
  }
  const api = readFileSync(join(ROD, 'om-mig/index.html'), 'utf8').match(/const KONTAKT_API = '([^']+)'/)?.[1];
  const r = await fetch(api, { method: 'OPTIONS',
    headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  tjek(r.headers.get('access-control-allow-origin') === SITE, `kontakt-API'et tillader ${SITE} (OPTIONS ${r.status})`,
    String(r.headers.get('access-control-allow-origin')));
}

const port = 9800 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-kun-siden-profil-'));
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

async function fane() {
  const f = await json('/json/new?about:blank', 'PUT');
  const ws = new WebSocket(f.webSocketDebuggerUrl);
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  let id = 0;
  const ventende = new Map();
  const svar = [], undtagelser = [], adresser = new Map();
  let indlæst = 0;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); }
    else if (d.method === 'Page.loadEventFired') indlæst++;
    else if (d.method === 'Network.requestWillBeSent') adresser.set(d.params.requestId, d.params.request.url);
    else if (d.method === 'Network.responseReceived') svar.push({ url: d.params.response.url, status: d.params.response.status });
    else if (d.method === 'Network.loadingFailed' && !d.params.canceled) {
      svar.push({ url: adresser.get(d.params.requestId) ?? '', status: d.params.errorText });
    }
    else if (d.method === 'Runtime.exceptionThrown') undtagelser.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const kør = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result?.value;
  await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  return {
    kør, svar, undtagelser,
    async åbn(url) {
      const n = indlæst; svar.length = 0; undtagelser.length = 0;
      await send('Page.navigate', { url });
      for (let i = 0; i < 150 && indlæst === n; i++) await vent(100);
      await kør('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 400)))');
    },
    luk: async () => { ws.close(); await json(`/json/close/${f.id}`).catch(() => {}); },
  };
}

const SIDER = [['/', 'forsiden'], ['/om-mig/', 'Om mig'], ['/ordbog/', 'ordbogen'], ['/scoring/', 'Scoring i bridge']];
const SPROGKNAP = { da: 'English', en: 'Dansk' };

// Beregnerne regner, når siden åbnes (4♠ med 10 stik uden for zonen); derefter skiftes til 11 stik
const BEREGNERE = `(() => {
  const s = document.querySelector('[data-svar="score"]');
  const før = { tal: s.querySelector('.svar-tal')?.textContent, tekst: s.querySelector('.svar-tekst')?.textContent };
  const f = document.querySelector('[data-beregner="score"]');
  f.elements.stik.value = '11';
  f.dispatchEvent(new Event('input', { bubbles: true }));
  const tomme = [...document.querySelectorAll('[data-svar]')].filter((e) => !e.textContent.trim()).map((e) => e.dataset.svar);
  return { før, efter: s.querySelector('.svar-tal')?.textContent, felter: document.querySelectorAll('[data-svar]').length, tomme };
})()`;

try {
  await json('/json/version');
  const t = await fane();
  const links = new Set();
  for (const [sti, navn] of SIDER) {
    for (const lang of ['da', 'en']) {
      const hvor = `${navn} (${lang})`;
      await t.åbn(`${BASE}${sti}?lang=${lang}`);
      const egne = t.svar.filter((s) => s.url.startsWith(BASE) && !s.url.endsWith('/favicon.ico'));
      const dårlige = egne.filter((s) => s.status !== 200);
      tjek(egne.length > 0 && dårlige.length === 0, `${hvor}: ${egne.length} filer hentet fra sitet, alle 200`,
        dårlige.map((s) => `${s.status} ${s.url}`).join(' '));
      const skrifter = egne.filter((s) => /\/fonts\/[^/]+\.woff2$/.test(s.url)).length;
      tjek(skrifter > 0, `${hvor}: ${skrifter} skrifttyper fra /fonts/`);
      tjek(t.undtagelser.length === 0, `${hvor}: ingen fejl i scriptet`, t.undtagelser.join(' | '));
      const s = await t.kør(`({ lang: document.documentElement.lang, knap: document.getElementById('langBtn')?.textContent.trim(),
        h1: document.querySelector('h1')?.textContent.trim(),
        links: [...document.querySelectorAll('a[href]')].map((a) => a.href) })`);
      tjek(s.lang === lang && s.knap === SPROGKNAP[lang] && s.h1, `${hvor}: siden er på ${lang === 'da' ? 'dansk' : 'engelsk'} ("${s.h1}", knappen "${s.knap}")`,
        JSON.stringify({ lang: s.lang, knap: s.knap }));
      for (const l of s.links) if (l.startsWith(BASE)) links.add(new URL(l).pathname);
      if (sti === '/om-mig/') {
        tjek(await t.kør(`!!document.querySelector('#kontaktform button[type=submit]')`), `${hvor}: kontaktformularen er der`);
      }
      if (sti === '/scoring/') {
        const b = await t.kør(BEREGNERE);
        const tekst = lang === 'da' ? 'med 10 stik' : 'with 10 tricks';
        tjek(b.før.tal === '+420' && b.før.tekst?.includes(tekst), `${hvor}: scoreberegneren giver +420 for 4♠ ${tekst}`, JSON.stringify(b.før));
        tjek(b.efter === '+450', `${hvor}: med 11 stik giver den +450`, String(b.efter));
        tjek(b.felter === 5 && b.tomme.length === 0, `${hvor}: alle ${b.felter} beregnere har et svar`, b.tomme.join(' '));
      }
    }
  }
  await t.luk();
  // Links på siderne til andet på sitet end de to apps
  const døde = [];
  for (const sti of [...links].filter((l) => !ANDRE_REPOER.test(l)).sort()) {
    const r = await fetch(BASE + sti);
    if (r.status !== 200) døde.push(`${r.status} ${sti}`);
  }
  tjek(døde.length === 0, `linkene mellem siderne virker (${[...links].filter((l) => !ANDRE_REPOER.test(l)).length} adresser)`, døde.join(' '));
} finally {
  proces.kill();
  side?.s.close();
  await vent(300);
  for (const m of [profil, mappe].filter(Boolean)) { try { rmSync(m, { recursive: true, force: true }); } catch {} }
}
process.exit(fejl ? 1 : 0);
