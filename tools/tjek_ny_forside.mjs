// Accepttest i en rigtig browser (SPEC-ny-forside.md): den nye forside og den kompakte sidefod på alle forsidens sider.
//
//   node tools/tjek_ny_forside.mjs                    tjekker
//   node tools/tjek_ny_forside.mjs --billeder=mappe   gemmer også skærmbillederne ved 1280 og 390 px, med menuen lukket og åben
//
// Kræver Node 22+ og Chrome eller Edge. Stien til browseren kan gives i CHROME.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const BILLEDER = process.argv.find((a) => a.startsWith('--billeder='))?.slice('--billeder='.length);
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) {
  console.error('Fandt hverken Chrome eller Edge; sæt CHROME til stien.');
  process.exit(2);
}

const SIDER = ['index.html', 'om-mig/index.html', 'ordbog/index.html', 'scoring/index.html'];
// Sidefodens højde før den nye forside (tagget v-foer-ny-forside).
const HØJDE_FØR = { 1280: 355, 390: 629 };

const vent = (ms) => new Promise((r) => setTimeout(r, ms));
let fejl = 0;
const tjek = (ok, navn, detalje = '') => {
  if (!ok) fejl++;
  console.log(`${ok ? 'ok  ' : 'FEJL'} ${navn}${!ok && detalje ? ` – ${detalje}` : ''}`);
};

const profil = mkdtempSync(join(tmpdir(), 'ny-forside-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--lang=da-DK', 'about:blank'], { stdio: 'ignore' });

let targets;
for (let i = 0; i < 100 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await vent(200); }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((ok, nej) => { ws.onopen = ok; ws.onerror = nej; });
let id = 0;
const venter = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && venter.has(d.id)) { venter.get(d.id)(d); venter.delete(d.id); } };
const send = (method, params = {}) => new Promise((ok) => { const n = ++id; venter.set(n, ok); ws.send(JSON.stringify({ id: n, method, params })); });
const kør = async (expression) => {
  const d = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (d.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${d.result.exceptionDetails.exception?.description}`);
  return d.result?.result?.value;
};
await send('Page.enable');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const åbn = async (side, bredde, højde = 900, query = '') => {
  await send('Emulation.setDeviceMetricsOverride', { width: bredde, height: højde, deviceScaleFactor: 1, mobile: bredde < 600 });
  await send('Page.navigate', { url: pathToFileURL(join(ROD, side)).href + query });
  await vent(700);
  await kør('document.fonts.ready.then(() => true)');
};
const tast = async (key) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key });
  await vent(120);
};
const gem = async (fil, helSide) => {
  if (!BILLEDER) return;
  mkdirSync(BILLEDER, { recursive: true });
  await vent(250);
  const h = helSide ? await kør('Math.max(document.documentElement.scrollHeight, innerHeight)') : null;
  const bredde = await kør('innerWidth');
  const r = await send('Page.captureScreenshot', helSide ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: bredde, height: h, scale: 1 } } : { format: 'png' });
  writeFileSync(join(BILLEDER, fil), Buffer.from(r.result.data, 'base64'));
};

try {
  // Topbåndet: tekst og eksempel side om side ved 1280 px, kun teksten ved 999 og 390 px.
  await åbn('index.html', 1280);
  const bred = await kør(`(() => {
    const k = (x) => { const e = document.querySelector(x); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }; };
    return { tekst: k('.hero-body'), eksempel: k('.demo'), ud: document.documentElement.scrollWidth - document.documentElement.clientWidth, burger: k('.burger'), links: k('.nav-links'), h1: document.querySelector('h1').textContent.trim() };
  })()`);
  tjek(bred.tekst && bred.eksempel && bred.tekst.right <= bred.eksempel.left, 'Ved 1280 px: teksten og eksemplet står side om side', JSON.stringify(bred));
  tjek(bred.h1 === 'Bedre bridge på 5 minutter om dagen', 'Overskriften er den nye', bred.h1);
  tjek(bred.links && !bred.burger, 'Ved 1280 px: menuen står i båndet, uden ☰', JSON.stringify({ links: bred.links, burger: bred.burger }));
  await gem('1280-forside.png', true);
  for (const b of [999, 390]) {
    await åbn('index.html', b);
    const r = await kør(`(() => ({ eksempel: !!document.querySelector('.demo')?.getClientRects().length, tekst: !!document.querySelector('.hero-body')?.getClientRects().length, burger: !!document.querySelector('.burger')?.getClientRects().length, ud: document.documentElement.scrollWidth - document.documentElement.clientWidth }))()`);
    tjek(!r.eksempel && r.tekst && r.burger && r.ud <= 0, `Ved ${b} px: kun teksten og ☰`, JSON.stringify(r));
  }

  tjek(readFileSync(join(ROD, 'sitemap.xml'), 'utf8').includes('<loc>https://www.kontraktbridge.dk/postmortem/</loc>'), 'Post Mortem står i sitemap.xml');

  // Indholdet: tal, kort og links.
  await åbn('index.html', 1280);
  const ind = await kør(`(() => {
    const tekst = (e) => e.textContent.replace(/\\s+/g, ' ').trim();
    const titel = (e) => tekst(e.querySelector('h3'));
    const synlige = (x) => [...document.querySelectorAll(x)].filter((e) => e.getClientRects().length);
    const a = (x) => synlige(x).map((e) => e.getAttribute('href'));
    return {
      tal: synlige('.tal-tal').map(tekst),
      trænere: synlige('#traenere .card').map(titel),
      opslag: synlige('#opslag .opslag').map(titel),
      start: synlige('#start .path').map(titel),
      startHref: a('#start .path'),
      trænerHref: a('#traenere .card'),
      opslagHref: a('#opslag .opslag'),
      menu: synlige('.nav-links a').map(tekst),
      menuHref: a('.nav-links a'),
      knapper: synlige('.hero-btns a').map((e) => [tekst(e), e.getAttribute('href')]),
      punkter: synlige('.points li').map(tekst),
      eyebrow: tekst(document.querySelector('.eyebrow')),
      saadan: !!document.querySelector('#h-saadan'),
      mærkater: synlige('#traenere .badge').map(tekst),
      lead: tekst(document.querySelector('#traenere .lead')),
      pm: (() => { const k = [...document.querySelectorAll('#traenere .card')].find((c) => c.getAttribute('href') === '/postmortem/'); return k ? { kicker: synlige('#traenere .card[href="/postmortem/"] .kicker').map(tekst), tekst: synlige('#traenere .card[href="/postmortem/"] p').map(tekst), mærke: synlige('#traenere .card[href="/postmortem/"] .badge').map(tekst) } : null; })(),
    };
  })()`);
  tjek(JSON.stringify(ind.tal) === JSON.stringify(['45', '657', '39', '437']), 'Fire tal: 45, 657, 39 og 437', ind.tal.join());
  // Post Mortem er det sjette kort (SPEC-postmortem-1c-app.md i postmortem-repoet).
  tjek(JSON.stringify(ind.trænere) === JSON.stringify(['Konventionstræner', 'Fordeling', 'Pointregnskab', 'Farvebehandling', 'Håndevaluering', 'Post Mortem']), 'Fem trænerkort og Post Mortem, uden Analyse', ind.trænere.join());
  tjek(ind.trænerHref.at(-1) === '/postmortem/', 'Post Mortem-kortet fører til /postmortem/', ind.trænerHref.join());
  tjek(JSON.stringify(ind.pm) === JSON.stringify({ kicker: ['Analyse'], tekst: ['Med linket til jeres klubaften fra bridge.dk viser analysen, hvor pointene gik tabt.'], mærke: ['Ny'] }), 'Post Mortem-kortet: Analyse, teksten og mærket Ny', JSON.stringify(ind.pm));
  tjek(ind.lead === 'Fem trænere og en analyse af jeres klubaften. Hele kortet er et link.', 'Ledeteksten over kortene', ind.lead);
  tjek(JSON.stringify(ind.opslag) === JSON.stringify(['Analyse', 'Bridgeordbog', 'Scoring i bridge']), 'Tre opslagskort med Analyse først', ind.opslag.join());
  tjek(JSON.stringify(ind.start) === JSON.stringify(['Fordeling og Håndevaluering', 'Konventionstræner og Pointregnskab', 'Farvebehandling og Analyse']), 'Hvor starter jeg? har tre kort', ind.start.join());
  tjek(JSON.stringify(ind.startHref) === JSON.stringify(['/fordelingstraeneren/#fordeling', '/konventionstraener/', '/fordelingstraeneren/#farvebehandling']), 'Hvert af de tre kort fører til den første træner', ind.startHref.join());
  tjek(ind.opslagHref[0] === '/fordelingstraeneren/#analyse', 'Analyse-kortet fører til modulet', ind.opslagHref.join());
  tjek(JSON.stringify(ind.menu) === JSON.stringify(['Trænere', 'Opslag', 'Om mig og kontakt']) && JSON.stringify(ind.menuHref) === JSON.stringify(['#traenere', '#opslag', '/om-mig/']), 'Menuen: Trænere, Opslag og Om mig og kontakt', ind.menu.join());
  tjek(JSON.stringify(ind.knapper) === JSON.stringify([['Start træningen', '#start'], ['Se alle trænere', '#traenere']]), 'Knapperne i båndet', JSON.stringify(ind.knapper));
  tjek(ind.punkter.length === 3 && ind.eyebrow === 'Gratis bridgetræning · ingen login', 'Mærkaten og de tre punkter i båndet', JSON.stringify([ind.eyebrow, ind.punkter]));
  tjek(!ind.saadan, 'Sådan virker det er væk som eget afsnit');
  tjek(JSON.stringify(ind.mærkater) === JSON.stringify(['45 konventioner', '5 min om dagen', '657 kombinationer', 'God til begyndere', 'Ny']), 'Mærkaterne på trænerkortene', ind.mærkater.join());
  const hover = await kør(`(() => { const kilde = [...document.querySelectorAll('style')].map((s) => s.textContent).join(' '); const m = kilde.match(/\\.card:hover\\{([^}]*)\\}/); return m ? m[1] : ''; })()`);
  tjek(/translateY\(-3px\)/.test(hover) && /inset 0 3px 0 0 var\(--primary\)|inset 0 3px 0 0 #ff9f4a/.test(hover), 'Ved hover løftes kortet 3 px, med skygge og en orange streg øverst', hover);
  await kør(`document.fonts.ready.then(() => true)`);

  // Mobil: kompakte rækker og to og to tal.
  await åbn('index.html', 390, 844);
  const mob = await kør(`(() => {
    const k = (e) => e.getBoundingClientRect();
    const synlige = (x) => [...document.querySelectorAll(x)].filter((e) => e.getClientRects().length);
    const tal = synlige('.tal > div').map(k);
    const art = synlige('#traenere .art-lille').map(k);
    const kort = synlige('#traenere .card');
    return { tal: [tal[0].top === tal[1].top, tal[1].top < tal[2].top], art: art.map((a) => [Math.round(a.width), Math.round(a.height)]), række: kort.every((c) => { const b = c.querySelector('.card-tekst').getBoundingClientRect(); const a = c.querySelector('.art-lille').getBoundingClientRect(); return a.right <= b.left; }), knapper: synlige('.hero-btns a').map((e) => [e.textContent.trim(), Math.round(k(e).width)]), bånd: Math.round(k(document.querySelector('.hero-body')).width), burger: [Math.round(k(document.querySelector('.burger')).width), Math.round(k(document.querySelector('.burger')).height)] };
  })()`);
  tjek(mob.tal[0] && mob.tal[1], 'Ved 390 px: tallene står to og to');
  tjek(mob.art.length === 6 && mob.art.every(([b, h]) => b === 72 && h === 72) && mob.række, 'Ved 390 px: trænerne er rækker med et billede på 72 × 72 px til venstre', JSON.stringify(mob.art));
  tjek(mob.knapper.length === 1 && mob.knapper[0][0] === 'Start træningen' && mob.knapper[0][1] === mob.bånd, 'Ved 390 px: kun Start træningen i fuld bredde', JSON.stringify(mob));
  tjek(mob.burger[0] === 44 && mob.burger[1] === 44, 'Ved 390 px: ☰ er 44 × 44 px', mob.burger.join());
  await gem('390-forside-menu-lukket.png', true);

  // Menuen.
  const menu = () => kør(`(() => {
    const m = document.querySelector('#menu');
    const b = document.querySelector('.burger');
    const a = document.activeElement;
    return { åben: !!m && m.getClientRects().length > 0, udvidet: b.getAttribute('aria-expanded'), fokus: a === b ? 'burger' : a?.id || a?.getAttribute('aria-label') || a?.textContent?.trim() || '', mørk: !!document.querySelector('.menu-bag')?.getClientRects().length };
  })()`);
  const åbnMenu = async () => { await kør(`document.querySelector('.burger').focus(); document.querySelector('.burger').click(); true`); await vent(120); };
  let m = await menu();
  tjek(!m.åben && m.udvidet === 'false', 'Menuen er lukket fra start', JSON.stringify(m));
  await åbnMenu();
  m = await menu();
  tjek(m.åben && m.udvidet === 'true' && m.mørk, '☰ åbner menuen, og resten af siden mørklægges', JSON.stringify(m));
  tjek(m.fokus === 'menuLuk', 'Fokus flytter til ✕, når menuen åbner', m.fokus);
  const inMenu = await kør(`(() => {
    const t = (e) => e.textContent.replace(/\\s+/g, ' ').trim();
    const g = [...document.querySelectorAll('#menu .menu-gruppe')];
    return { titler: g.map((x) => t(x.querySelector('.menu-titel'))), trænere: [...g[0].querySelectorAll('a')].map((a) => t(a)), trænerHref: [...g[0].querySelectorAll('a')].map((a) => a.getAttribute('href')), opslag: [...g[1].querySelectorAll('a')].map((a) => [t(a), a.getAttribute('href')]), bund: [...document.querySelectorAll('#menu .menu-bund a, #menu .menu-bund button')].map(t) };
  })()`);
  tjek(JSON.stringify(inMenu.titler) === JSON.stringify(['Trænere', 'Opslag']), 'Menuen har Trænere og Opslag', inMenu.titler.join());
  tjek(JSON.stringify(inMenu.trænere) === JSON.stringify(['KonventionstrænerMeldinger', 'FordelingOptælling', 'PointregnskabOptælling', 'FarvebehandlingSpilføring', 'HåndevalueringVurdering', 'Post MortemAnalyse']), 'Trænerne og Post Mortem i menuen har kategorien til højre', inMenu.trænere.join());
  tjek(inMenu.trænerHref.at(-1) === '/postmortem/', 'Post Mortem i menuen fører til /postmortem/', inMenu.trænerHref.join());
  tjek(inMenu.opslag[0][0] === 'Analyse' && inMenu.opslag[0][1] === '/fordelingstraeneren/#analyse' && inMenu.opslag.length === 3, 'Analyse står under Opslag i menuen', JSON.stringify(inMenu.opslag));
  tjek(JSON.stringify(inMenu.bund) === JSON.stringify(['Om mig og kontakt', 'English']), 'Om mig og kontakt og English nederst i menuen', inMenu.bund.join());
  await gem('390-forside-menu-aaben.png', false);
  // Tab bliver i menuen.
  for (let i = 0; i < 14; i++) await tast('Tab');
  tjek(await kør(`document.querySelector('#menu').contains(document.activeElement)`), 'Tab bliver i menuen');
  await kør(`document.querySelector('#menuLuk').click(); true`);
  await vent(120);
  m = await menu();
  tjek(!m.åben && m.fokus === 'burger' && m.udvidet === 'false', '✕ lukker menuen, og fokus går tilbage til ☰', JSON.stringify(m));
  await åbnMenu();
  await tast('Escape');
  m = await menu();
  tjek(!m.åben && m.fokus === 'burger', 'Esc lukker menuen, og fokus går tilbage til ☰', JSON.stringify(m));
  await åbnMenu();
  await kør(`document.querySelector('.menu-bag').click(); true`);
  await vent(120);
  m = await menu();
  tjek(!m.åben && m.fokus === 'burger', 'Et tryk uden for menuen lukker den', JSON.stringify(m));

  // Sidefoden på alle sider.
  const fod = () => kør(`(() => {
    const f = document.querySelector('footer');
    const t = (e) => e.textContent.replace(/\\s+/g, ' ').trim();
    const k = (e) => e.getBoundingClientRect();
    const synlig = (e) => e.getClientRects().length > 0;
    const kolonner = [...f.querySelectorAll('nav')].map((n) => ({ titel: t(n.querySelector('h2')), links: [...n.querySelectorAll('a')].map((a) => [t(a), a.getAttribute('href')]) }));
    const cs = getComputedStyle(f);
    const logo = f.querySelector('.logo');
    const links = [...f.querySelectorAll('nav a')];
    const cta = [...f.querySelectorAll('a')].find((a) => /Om mig og kontakt|About me and contact/.test(t(a)));
    const brand = f.querySelector('a.brand');
    return { højde: Math.round(k(f).height), kolonner, polstring: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '), linjehøjde: cs.lineHeight, logo: [Math.round(k(logo).width), Math.round(k(logo).height)], rækker: links.map((a) => Math.round(k(a).height)), afstand: Math.round(k(links[1].closest('li')).top - k(links[0].closest('li')).bottom), samme: Math.abs((k(cta).top + k(cta).height / 2) - (k(brand).top + k(brand).height / 2)) < 2, ctaHøjde: Math.round(k(cta).height), om: /Jeg er bridgeentusiast/.test(f.textContent), legal: t(f.querySelector('.legal')), p: synlig(f.querySelector('p')), ud: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  })()`);
  const KOLONNER = JSON.stringify([
    { titel: 'Trænere', links: [['Konventionstræner', '/konventionstraener/'], ['Fordeling', '/fordelingstraeneren/#fordeling'], ['Pointregnskab', '/fordelingstraeneren/#pointregnskab'], ['Farvebehandling', '/fordelingstraeneren/#farvebehandling'], ['Håndevaluering', '/fordelingstraeneren/#haandevaluering'], ['Post Mortem', '/postmortem/']] },
    { titel: 'Opslag', links: [['Analyse', '/fordelingstraeneren/#analyse'], ['Bridgeordbog', '/ordbog/'], ['Scoring i bridge', '/scoring/']] },
  ]);
  const ens = {};
  for (const side of SIDER) {
    for (const bredde of [1280, 390]) {
      await åbn(side, bredde, 900);
      const f = await fod();
      const hvor = `Sidefoden på ${side} ved ${bredde} px`;
      tjek(f.højde < HØJDE_FØR[bredde], `${hvor}: lavere end i dag (${HØJDE_FØR[bredde]} px)`, `${f.højde} px`);
      tjek(JSON.stringify(f.kolonner) === KOLONNER, `${hvor}: Trænere (fem og Post Mortem) og Opslag (Analyse, Bridgeordbog, Scoring i bridge)`, JSON.stringify(f.kolonner));
      tjek(f.linjehøjde === '20px', `${hvor}: linjehøjde 20 px`, f.linjehøjde);
      if (bredde === 1280) {
        tjek(f.polstring === '24px 28px 18px 28px' && f.logo[0] === 32 && f.afstand === 4, `${hvor}: polstring 24/28 px, logo 32 px og 4 px mellem links`, JSON.stringify([f.polstring, f.logo, f.afstand]));
      } else {
        tjek(f.polstring === '18px 18px 14px 18px' && f.logo[0] === 30 && f.afstand === 2, `${hvor}: polstring 18 px, logo 30 px og 2 px mellem links`, JSON.stringify([f.polstring, f.logo, f.afstand]));
        tjek(f.rækker.every((h) => h >= 24), `${hvor}: alle links har mindst 24 px rækkehøjde`, f.rækker.join());
        tjek(f.samme && f.ctaHøjde >= 44, `${hvor}: logo og Om mig og kontakt på samme række, med en trykflade på 44 px`, JSON.stringify([f.samme, f.ctaHøjde]));
      }
      tjek(f.ud <= 0, `${hvor}: intet stikker ud`, `${f.ud} px`);
      (ens[bredde] ??= new Set()).add(JSON.stringify([f.højde, f.polstring, f.logo, f.rækker, f.legal]));
    }
  }
  for (const bredde of [1280, 390]) tjek(ens[bredde].size === 1, `Sidefoden er ens på alle sider ved ${bredde} px`, [...ens[bredde]].join(' | '));

  // Ingen vandret scroll ved 320 px.
  for (const side of SIDER) {
    await åbn(side, 320, 700);
    const ud = await kør('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    tjek(ud <= 0, `${side} ved 320 px: ingen vandret scroll`, `${ud} px`);
  }

  // Knappen står inden for sidefodens polstring ved de smalle bredder og på begge sprog; teksten må brække.
  // "Stikker ud" måles mod clientWidth: i mobilvisning vokser innerWidth med det, der stikker ud, så tjekket aldrig ville fejle.
  for (const [lang, sprog] of [['da', 'dansk'], ['en', 'engelsk']]) {
    for (const bredde of [390, 360, 320]) {
      await åbn('index.html', bredde, 900, `?lang=${lang}`);
      const ud = await kør(`(() => { const f = document.querySelector('.footer'); const r = f.getBoundingClientRect().right - parseFloat(getComputedStyle(f).paddingRight); return Math.round(f.querySelector('a.footer-cta').getBoundingClientRect().right - r); })()`);
      tjek(ud <= 0, `Knappen ved ${bredde} px på ${sprog}: inden for polstringen`, `${ud} px`);
    }
  }

  // Engelsk: ingen dansk tekst i det synlige ved 1280 og 390 px, heller ikke i menuen.
  for (const bredde of [1280, 390]) {
    await åbn('index.html', bredde, 900, '?lang=en');
    if (bredde === 390) await åbnMenu();
    const en = await kør(`(() => {
      const ud = [];
      const DANSK = /[æøåÆØÅ]|\\b(og|med|af|der|det|en|et|fra|til|som|eller|gratis|bordet|hånden|mål|stik|linje|lille|trænere|opslag)\\b/i;
      const gå = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = gå.nextNode(); n; n = gå.nextNode()) {
        const t = n.textContent.trim();
        if (!t || ['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) continue;
        if (n.parentElement.closest('[hidden]') || !n.parentElement.getClientRects().length) continue;
        if (/Kontraktbridge|Frank Pedersen/.test(t) && t.length < 40) continue;
        if (DANSK.test(t) && !/^(Suit combinations|In|Free|With)\\b/.test('') ) ud.push(t.slice(0, 50));
      }
      return { lang: document.documentElement.lang, h1: document.querySelector('h1').textContent.trim(), ud, knap: document.querySelector('#langBtn').textContent };
    })()`);
    tjek(en.lang === 'en' && en.h1 === 'Better bridge in 5 minutes a day', `Engelsk ved ${bredde} px: overskriften`, en.h1);
    tjek(en.ud.length === 0, `Engelsk ved ${bredde} px: ingen dansk tekst`, en.ud.slice(0, 6).join(' | '));
    tjek(en.knap === 'Dansk', `Engelsk ved ${bredde} px: knappen hedder Dansk`, en.knap);
  }
  await åbn('index.html', 1280, 900, '?lang=en');
  const startEn = await kør(`({ start: document.querySelector('#h-start').textContent.trim(), knap: document.querySelector('.hero-btns a').textContent.trim() })`);
  tjek(startEn.start === 'Where do I start?' && startEn.knap === 'Start training', 'Engelsk: Where do I start? og Start training', JSON.stringify(startEn));
  for (const side of SIDER.slice(1)) {
    await åbn(side, 390, 900, '?lang=en');
    const f = await fod();
    tjek(f.kolonner[0].titel === 'Trainers' && f.kolonner[1].titel === 'Reference' && f.kolonner[1].links[0][0] === 'Analysis', `Engelsk: sidefoden på ${side}`, JSON.stringify(f.kolonner));
  }
  await åbn('index.html', 390, 900, '?lang=da');
} catch (e) {
  tjek(false, 'testen kørte færdig', e.message);
} finally {
  proc.kill();
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
console.log(fejl ? `\n${fejl} FEJL` : '\nAlt i orden');
process.exit(fejl ? 1 : 0);
