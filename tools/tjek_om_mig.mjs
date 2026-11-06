// Accepttest i en rigtig browser (SPEC-om-mig.md, Kortspil og privatlivsteksten, Franks valg 5. november 2026):
// Kasino og Es-makker whist linker til lobbyen, og privatlivsteksten står foldet sammen under formularen i et
// <details> med et skjold, "Se privatlivspolitik" og en pil. Testen klikker, bruger tastaturet, læser browserens
// tilgængelighedstræ, prøver siden uden JavaScript og sammenligner teksten med tagget, så den er uændret. Hver side
// åbnes i sin egen browserkontekst med tom localStorage. Med --live åbnes siden på www.kontraktbridge.dk; siden før
// kommer stadig fra tagget (SPEC-om-mig-live.md). Kræver Node 22+, git og Chrome eller Edge.
//
//   node tools/tjek_om_mig.mjs                    før fletning: siden fra arbejdsmappen
//   node tools/tjek_om_mig.mjs --live             efter en udgivelse: siden fra www.kontraktbridge.dk
//   node tools/tjek_om_mig.mjs --billeder=mappe   gemmer også kortene og kontaktkortet lukket og åbent, på dansk og
//                                                 engelsk ved 1280, 390 og 320 px (også med --live)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const TAG = 'v-foer-om-mig-kortspil';
const LOBBY = 'https://kortspil-api-20261101-v2.azurewebsites.net/lobby/';
const ACCENT = 'rgb(255, 159, 74)';
const BILLEDER = process.argv.find((a) => a.startsWith('--billeder='))?.slice('--billeder='.length);
const LIVE = process.argv.includes('--live');
const SITE = 'https://www.kontraktbridge.dk/';
const TEKST = {
  da: { se: 'Se privatlivspolitik', skjul: 'Skjul privatlivspolitik', lobby: 'Til lobbyen →', bridge: 'Se trænerne →', start: 'Om dine oplysninger.' },
  en: { se: 'View privacy policy', skjul: 'Hide privacy policy', lobby: 'To the lobby →', bridge: 'See the trainers →', start: 'About your information.' },
};
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
const vent = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json' };
/** Webserver for arbejdsmappen eller, med tag, for filerne i tagget. */
async function webserver(tag) {
  const s = createServer((req, res) => {
    let sti = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (sti === '' || sti.endsWith('/')) sti += 'index.html';
    if (sti.split('/').includes('..')) { res.writeHead(403).end(); return; }
    let indhold;
    if (tag) {
      const r = spawnSync('git', ['show', `${tag}:${sti}`], { cwd: ROD, maxBuffer: 64 * 1024 * 1024 });
      indhold = r.status === 0 ? r.stdout : null;
    } else {
      const fil = normalize(join(ROD, sti));
      if (fil.startsWith(normalize(ROD)) && existsSync(fil) && statSync(fil).isFile()) indhold = readFileSync(fil);
    }
    if (!indhold) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPER[extname(sti)] || 'application/octet-stream' }).end(indhold);
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { s, url: `http://127.0.0.1:${s.address().port}/` };
}
// Siden nu: arbejdsmappen eller, med --live, sitet. Siden før kommer altid fra tagget.
const nu = LIVE ? { s: { close() {} }, url: SITE } : await webserver();
const før = await webserver(TAG);
if (LIVE) console.log(`Siden nu: ${SITE} (GitHub Pages kan være op til 10 minutter om at vise den nye udgave)`);

const port = 9700 + Math.floor(Math.random() * 90);
const profil = mkdtempSync(join(tmpdir(), 'tjek-om-mig-'));
const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run',
  '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
async function json(sti) {
  for (let i = 0; i < 50; i++) {
    try { const svar = await fetch(`http://127.0.0.1:${port}${sti}`); if (svar.ok) return await svar.json(); } catch {}
    await vent(200);
  }
  throw new Error(`Browseren svarer ikke på ${sti}`);
}
const forbindelse = new WebSocket((await json('/json/version')).webSocketDebuggerUrl);
await new Promise((r, x) => { forbindelse.onopen = r; forbindelse.onerror = x; });
let næste = 0;
const ventende = new Map();
forbindelse.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); } };
const send = (method, params = {}, sessionId) => new Promise((r, x) => {
  const n = ++næste;
  const ur = setTimeout(() => { ventende.delete(n); x(new Error(`${method} svarede ikke inden for 60 s`)); }, 60000);
  ventende.set(n, (d) => { clearTimeout(ur); if (d.error) x(new Error(`${method}: ${d.error.message}`)); else r(d.result); });
  forbindelse.send(JSON.stringify(sessionId ? { id: n, method, params, sessionId } : { id: n, method, params }));
});

let fejl = 0;
let antal = 0;
const tjek = (ok, navn, detalje = '') => {
  antal++;
  if (!ok) fejl++;
  if (!ok) console.log(`FEJL ${navn}${detalje ? ` – ${detalje}` : ''}`);
};

/** En fane i sin egen browserkontekst; uden JavaScript, når js er false. */
async function fane(bredde, { js = true } = {}) {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId, newWindow: true });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  const mobil = bredde < 600;
  await s('Page.enable');
  await s('DOM.enable');
  await s('Accessibility.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: bredde, height: mobil ? 844 : 900, deviceScaleFactor: mobil ? 2 : 1, mobile: mobil });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  if (!js) await s('Emulation.setScriptExecutionDisabled', { value: true });
  const kør = async (expression) => {
    const d = await s('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
    if (d.exceptionDetails) throw new Error(`${expression.trim().slice(0, 80)}: ${d.exceptionDetails.exception?.description}`);
    return d.result?.value;
  };
  const node = async (vælger) => {
    const { root } = await s('DOM.getDocument', { depth: 0 });
    const { nodeId } = await s('DOM.querySelector', { nodeId: root.nodeId, selector: vælger });
    return nodeId || null;
  };
  const tast = async (key, code, kode, tekst) => {
    await s('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: kode, ...(tekst ? { text: tekst } : {}) });
    await s('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: kode });
    await vent(120);
  };
  return {
    kør,
    send: s,
    node,
    async gå(url) {
      await s('Page.navigate', { url });
      for (let i = 0; i < 100; i++) {
        await vent(50);
        const n = await node('html').catch(() => null);
        if (!js && n) { await vent(300); break; }
        if (js && (await kør('return document.readyState')) === 'complete') break;
      }
      if (js) await kør('await document.fonts.ready; return true');
      await vent(150);
    },
    // Et rigtigt klik midt på elementet (også uden JavaScript: koordinaterne kommer fra DOM-domænet)
    async klik(vælger) {
      const id = await node(vælger);
      if (!id) throw new Error(`fandt ikke ${vælger}`);
      await s('DOM.scrollIntoViewIfNeeded', { nodeId: id });
      const { model } = await s('DOM.getBoxModel', { nodeId: id });
      const [x1, y1, , , x3, y3] = model.border;
      const x = (x1 + x3) / 2, y = (y1 + y3) / 2;
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await s('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
      await vent(200);
    },
    tab: () => tast('Tab', 'Tab', 9),
    enter: () => tast('Enter', 'Enter', 13, '\r'),
    mellemrum: () => tast(' ', 'Space', 32, ' '),
    async ax(vælger) {
      const id = await node(vælger);
      if (!id) return null;
      const { nodes } = await s('Accessibility.getPartialAXTree', { nodeId: id, fetchRelatives: false });
      const n = nodes[0];
      const åben = n.properties?.find((p) => p.name === 'expanded')?.value?.value;
      return { rolle: n.role?.value, navn: n.name?.value, åben };
    },
    async åben() {
      const id = await node('details.om-privatliv');
      if (!id) return null;
      const { attributes } = await s('DOM.getAttributes', { nodeId: id });
      return attributes.includes('open');
    },
    // Runtime.evaluate virker også, når sidens egne scripts er slået fra
    vist: (vælger) => kør(`const e = document.querySelector(${JSON.stringify(vælger)}); return !!e && e.checkVisibility();`),
    async udsnit(vælger, fil) {
      const r = await kør(`const e = document.querySelector(${JSON.stringify(vælger)}); const k = e.getBoundingClientRect();
        return { x: Math.max(0, k.left - 12), y: Math.max(0, k.top + scrollY - 12), w: Math.min(document.documentElement.clientWidth, k.width + 24), h: k.height + 24 };`);
      const b = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
      writeFileSync(join(BILLEDER, fil), Buffer.from(b.data, 'base64'));
    },
    luk: () => send('Target.disposeBrowserContext', { browserContextId }).catch(() => {}),
  };
}

// Det, linjen og teksten viser, og hvor de står
const TILSTAND = `
  const d = document.querySelector('.om-kontakt details.om-privatliv');
  if (!d) return null;
  const sum = d.querySelector('summary'), p = d.querySelector('p.om-privat');
  const svg = [...sum.querySelectorAll('svg')];
  const pil = sum.querySelector('.om-pil');
  const svar = document.getElementById('kontakt-svar');
  const form = document.getElementById('kontaktform');
  const ps = p && getComputedStyle(p);
  const rod = document.documentElement;
  return {
    åben: d.open,
    linje: sum.innerText.replace(/\\s+/g, ' ').trim(),
    efterForm: !!(form.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING),
    underSvar: d.getBoundingClientRect().top >= svar.getBoundingClientRect().bottom - 0.5,
    // Et lukket <details> skjuler indholdet med content-visibility, så kun checkVisibility() siger, om teksten ses
    tekstVist: !!p && p.checkVisibility() && p.getBoundingClientRect().height > 0,
    tekstUnderLinje: !!p && p.getBoundingClientRect().top >= sum.getBoundingClientRect().bottom - 0.5,
    hjørne: ps && ps.borderTopLeftRadius + ' ' + ps.borderBottomRightRadius,
    baggrund: ps && ps.backgroundColor,
    html: p && p.innerHTML.replace(/\\s+/g, ' ').trim(),
    svg: svg.length,
    svgSkjult: svg.every((s) => s.getAttribute('aria-hidden') === 'true'),
    svgUdefra: svg.some((s) => s.querySelector('use, image, foreignObject')),
    skjoldFarve: svg[0] && getComputedStyle(svg[0]).color,
    skjoldTegnet: svg[0] && [...svg[0].querySelectorAll('path, polyline, circle, rect')].some((e) => { const c = getComputedStyle(e); return c.stroke === ${JSON.stringify(ACCENT)} || c.fill === ${JSON.stringify(ACCENT)}; }),
    pil: pil && getComputedStyle(pil).transform,
    ud: rod.scrollWidth - rod.clientWidth,
  };
`;
// Det, browseren har hentet udefra, uden sidens egne filer (SPEC-om-mig-live.md): målt med Resource Timing, så et link,
// der ikke hentes (fx <link rel="canonical">, lokalt en fremmed adresse og på sitet sidens egen), ikke tæller. Samme
// måling lokalt og live.
const UDEFRA = `return [...new Set(performance.getEntriesByType('resource').map((r) => new URL(r.name)).filter((u) => u.origin !== location.origin).map(String))].sort();`;
const KORTENE = `return [...document.querySelectorAll('#projekter .om-card')].map((k) => ({
  tag: k.tagName.toLowerCase(), href: k.getAttribute('href'), navn: k.querySelector('h3').textContent.trim(),
  fod: k.querySelector('.om-card-foot').textContent.trim(), mærke: k.querySelector('.om-tag').textContent.trim(),
  tekst: k.querySelector('p').textContent.trim() }));`;
const ROTERET = (m) => { const t = /matrix\(([^)]+)\)/.exec(m || ''); if (!t) return false; const [a, b, c, d] = t[1].split(',').map(Number); return Math.abs(a + 1) < 0.01 && Math.abs(d + 1) < 0.01 && Math.abs(b) < 0.01 && Math.abs(c) < 0.01; };

try {
  if (BILLEDER) mkdirSync(BILLEDER, { recursive: true });
  for (const lang of ['da', 'en']) {
    const T = TEKST[lang];
    // Siden før: kortene og privatlivsteksten, som de var
    const a = await fane(1280);
    await a.gå(`${før.url}om-mig/?lang=${lang}`);
    const kortFør = await a.kør(KORTENE);
    const tekstFør = await a.kør(`return document.querySelector('p.om-privat').innerHTML.replace(/\\s+/g, ' ').trim();`);
    const udefraFør = await a.kør(UDEFRA);
    await a.luk();
    console.log(`Hentet udefra på siden før (${lang}): ${udefraFør.length ? udefraFør.join(' ') : 'intet'}`);

    for (const bredde of [1280, 390, 320]) {
      const s = await fane(bredde);
      await s.gå(`${nu.url}om-mig/?lang=${lang}`);
      const navn = `${bredde} px på ${lang}`;

      // Kortspil
      const kort = await s.kør(KORTENE);
      for (const spil of ['Kasino', 'Es-makker whist']) {
        const k = kort.find((x) => x.navn === spil);
        tjek(k?.tag === 'a' && k.href === LOBBY, `${navn}: hele kortet ${spil} linker til lobbyen`, JSON.stringify(k));
        tjek(k?.fod === T.lobby, `${navn}: ${spil} siger "${T.lobby}"`, k?.fod);
        const f = kortFør.find((x) => x.navn === spil);
        tjek(k && f && k.mærke === f.mærke && k.tekst === f.tekst, `${navn}: ${spil} har samme mærke og tekst som før`);
      }
      const bridge = kort.find((x) => x.navn === 'Kontraktbridge');
      tjek(JSON.stringify(bridge) === JSON.stringify(kortFør.find((x) => x.navn === 'Kontraktbridge')) && bridge?.fod === T.bridge, `${navn}: Kontraktbridge-kortet er uændret`, JSON.stringify(bridge));
      tjek(!(await s.kør(`return /Link kommer|Link coming/.test(document.body.innerText)`)), `${navn}: "Link kommer" står ikke på siden`);

      // Privatlivsteksten, lukket ved start
      const l = await s.kør(TILSTAND);
      if (!l) { tjek(false, `${navn}: privatlivsteksten står i et <details class="om-privatliv"> i kontaktboksen`); await s.luk(); continue; }
      tjek(l.efterForm && l.underSvar, `${navn}: linjen står under formularens svarlinje`);
      tjek(!l.åben && !l.tekstVist, `${navn}: teksten er lukket ved start`, JSON.stringify({ åben: l.åben, vist: l.tekstVist }));
      tjek(l.linje === T.se, `${navn}: linjen siger "${T.se}"`, l.linje);
      tjek(l.svg === 2 && l.svgSkjult && !l.svgUdefra, `${navn}: skjoldet og pilen er inline SVG, skjult for skærmlæsere`, JSON.stringify(l));
      tjek(l.skjoldFarve === ACCENT && l.skjoldTegnet, `${navn}: skjoldet står i accentfarven ${ACCENT}`, `${l.skjoldFarve}, tegnet: ${l.skjoldTegnet}`);
      tjek(l.html === tekstFør, `${navn}: teksten er den samme som før`, `${l.html?.slice(0, 80)} …`);
      tjek(JSON.stringify(await s.kør(UDEFRA)) === JSON.stringify(udefraFør), `${navn}: siden henter intet nyt udefra`, JSON.stringify(await s.kør(UDEFRA)));
      tjek(l.ud <= 0, `${navn}: ingen vandret scroll, lukket`, `${l.ud} px`);
      const axLukket = await s.ax('details.om-privatliv > summary');
      tjek(axLukket.navn === T.se && axLukket.åben === false, `${navn}: skærmlæseren hører "${T.se}", lukket`, JSON.stringify(axLukket));
      if (BILLEDER) {
        await s.udsnit('.om-section', `${bredde}-${lang}-kortene.png`);
        await s.udsnit('.om-kontakt', `${bredde}-${lang}-kontakt-lukket.png`);
      }

      // Et klik folder ud
      await s.klik('details.om-privatliv > summary');
      const å = await s.kør(TILSTAND);
      tjek(å.åben && å.tekstVist && å.tekstUnderLinje, `${navn}: et klik folder teksten ud under linjen`, JSON.stringify({ åben: å.åben, vist: å.tekstVist }));
      tjek(å.linje === T.skjul, `${navn}: linjen siger nu "${T.skjul}"`, å.linje);
      tjek(å.hjørne === '12px 12px' && å.baggrund !== 'rgba(0, 0, 0, 0)', `${navn}: teksten står i en boks med hjørner på 12 px`, `${å.hjørne}, ${å.baggrund}`);
      tjek(l.pil !== å.pil && ROTERET(å.pil), `${navn}: pilen vender`, `${l.pil} → ${å.pil}`);
      tjek(å.ud <= 0, `${navn}: ingen vandret scroll, åben`, `${å.ud} px`);
      const axÅben = await s.ax('details.om-privatliv > summary');
      tjek(axÅben.navn === T.skjul && axÅben.åben === true, `${navn}: skærmlæseren hører "${T.skjul}", åben`, JSON.stringify(axÅben));
      if (BILLEDER) await s.udsnit('.om-kontakt', `${bredde}-${lang}-kontakt-aaben.png`);
      await s.klik('details.om-privatliv > summary');
      const igen = await s.kør(TILSTAND);
      tjek(!igen.åben && !igen.tekstVist && igen.linje === T.se && igen.pil === l.pil, `${navn}: et klik til lukker igen`, JSON.stringify({ åben: igen.åben, linje: igen.linje }));
      await s.luk();
    }

    // Tastaturet: Tab fra Send besked når linjen, Enter og mellemrum folder ud og sammen, og fokusringen er som på Send besked
    const t = await fane(1280);
    await t.gå(`${nu.url}om-mig/?lang=${lang}`);
    await t.kør(`document.getElementById('kontakt-besked').focus(); return true;`);
    await t.tab();
    const ring = `const e = document.activeElement; const c = getComputedStyle(e);
      return { hvem: e.tagName.toLowerCase() + (e.className ? '.' + e.className : ''), synlig: e.matches(':focus-visible'), ring: [c.outlineStyle, c.outlineWidth, c.outlineColor, c.outlineOffset].join(' ') };`;
    const knap = await t.kør(ring);
    await t.tab();
    const linje = await t.kør(ring);
    tjek(linje.hvem === 'summary', `tastatur på ${lang}: Tab fra Send besked når linjen`, JSON.stringify(linje));
    tjek(knap.hvem === 'button.om-send' && linje.synlig && linje.ring === knap.ring && linje.ring.startsWith('solid 2px'), `tastatur på ${lang}: fokusringen er den samme som på Send besked`, `${linje.ring} / ${knap.ring}`);
    await t.enter();
    tjek(await t.åben(), `tastatur på ${lang}: Enter folder teksten ud`);
    await t.mellemrum();
    tjek((await t.åben()) === false, `tastatur på ${lang}: mellemrum folder den sammen`);
    await t.mellemrum();
    tjek(await t.åben(), `tastatur på ${lang}: mellemrum folder den ud igen`);
    await t.luk();
  }

  // Uden JavaScript: siden er på dansk, teksten er lukket, og et klik folder den ud og sammen
  const u = await fane(390, { js: false });
  await u.gå(`${nu.url}om-mig/`);
  tjek(await u.kør(`return document.getElementById('kontaktform').hidden`), 'uden JavaScript: sidens scripts kører ikke (formularen står skjult)');
  if (await u.node('details.om-privatliv > summary')) {
    tjek((await u.åben()) === false && !(await u.vist('details.om-privatliv > p.om-privat')), 'uden JavaScript: teksten er lukket ved start');
    await u.klik('details.om-privatliv > summary');
    tjek((await u.åben()) && (await u.vist('details.om-privatliv > p.om-privat')), 'uden JavaScript: et klik folder teksten ud');
    const axU = await u.ax('details.om-privatliv > summary');
    tjek(axU?.navn === TEKST.da.skjul, 'uden JavaScript: linjen siger "Skjul privatlivspolitik", når den er åben', JSON.stringify(axU));
    await u.klik('details.om-privatliv > summary');
    tjek((await u.åben()) === false, 'uden JavaScript: et klik til folder den sammen');
  } else {
    tjek(false, 'uden JavaScript: linjen findes');
  }
  await u.luk();
} catch (e) {
  tjek(false, 'testen kørte færdig', e.message);
} finally {
  forbindelse.close();
  proces.kill();
  nu.s.close();
  før.s.close();
  await vent(300);
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
console.log(fejl ? `${fejl} FEJL ud af ${antal} tjek` : `Alt i orden: ${antal} tjek`);
process.exit(fejl ? 1 : 0);
