// Accepttest for regnemotoren til Scoring i bridge (SPEC-scoring.md, Accepttest › Beregninger). Kører de samme
// funktioner, som siden bruger, fra scoring/beregn.js. Tjekker også, at regnestykkerne og beskederne findes på dansk og
// engelsk, og at tal skrives med decimalkomma på dansk og punktum på engelsk.
//
//   node tools/tjek_scoring.mjs
import { readFileSync } from 'node:fs';
import * as B from '../scoring/beregn.js';

let fejl = 0, ok = 0;
const tjek = (betingelse, navn, detalje = '') => {
  if (betingelse) { ok++; return; }
  fejl++;
  console.log(`FEJL ${navn}${detalje ? ` – ${detalje}` : ''}`);
};
const lig = (a, b) => Math.abs(a - b) < 1e-9;
const to = (x) => Math.round(x * 100) / 100;

// --- Score (§ 77) -------------------------------------------------------------------------------------------------
const FARVE = { '♣': 'C', '♦': 'D', '♥': 'H', '♠': 'S', NT: 'NT' };
function kontrakt(tekst) {
  const m = tekst.match(/^(\d)(♣|♦|♥|♠|NT)(XX|X)?$/);
  return { trin: Number(m[1]), farve: FARVE[m[2]], dobling: m[3] === 'XX' ? 2 : m[3] === 'X' ? 1 : 0 };
}
const SCORER = [
  ['1NT', 7, false, 90], ['2♠', 8, false, 110], ['3♥', 10, false, 170], ['3NT', 9, false, 400], ['3NT', 9, true, 600],
  ['4♥', 11, false, 450], ['4♠', 10, false, 420], ['4♠', 10, true, 620], ['5♦', 11, false, 400], ['6♠', 12, false, 980],
  ['6♠', 12, true, 1430], ['7♠', 13, false, 1510], ['7♠', 13, true, 2210], ['7NT', 13, true, 2220], ['2♥X', 8, false, 470],
  ['2♥X', 9, false, 570], ['1NTX', 9, false, 380], ['1♣X', 7, false, 140], ['1♣XX', 7, false, 230], ['1♠XX', 7, false, 520],
  ['2♥X', 8, true, 670], ['2♥XX', 8, false, 640], ['4♠X', 10, true, 790], ['4♠X', 11, true, 990], ['4♠XX', 10, true, 1080],
  ['3NTXX', 9, true, 1000], ['4♠X', 7, false, -500], ['4♠X', 6, false, -800], ['5♦X', 9, false, -300], ['2♥X', 7, true, -200],
  ['4♥', 9, false, -50], ['4♥', 8, false, -100],
];
for (const [k, stik, zone, forventet] of SCORER) {
  const r = B.score({ ...kontrakt(k), zone, stik });
  tjek(r.score === forventet, `score ${k} ${stik} stik ${zone ? 'i' : 'uden for'} zone`, `${r.score} ≠ ${forventet}`);
  const sum = r.linjer.reduce((s, l) => s + l.point, 0);
  tjek(sum === r.score, `score ${k} ${stik} stik: linjerne lægges sammen til scoren`, `${sum} ≠ ${r.score}`);
}
// Regnestykket linje for linje på begge sprog
{
  const da = B.score({ trin: 2, farve: 'H', dobling: 1, zone: false, stik: 9 }, 'da');
  const en = B.score({ trin: 2, farve: 'H', dobling: 1, zone: false, stik: 9 }, 'en');
  tjek(da.linjer.map((l) => l.point).join() === '120,300,50,100', '2♥X 9 stik: 120 + 300 + 50 + 100', da.linjer.map((l) => l.point).join());
  tjek(/stikpoint/i.test(da.linjer[0].tekst) && /udgang/i.test(da.linjer[1].tekst) && /overstik/i.test(da.linjer[3].tekst),
    'regnestykket på dansk', JSON.stringify(da.linjer.map((l) => l.tekst)));
  tjek(/trick/i.test(en.linjer[0].tekst) && /game/i.test(en.linjer[1].tekst) && /overtrick/i.test(en.linjer[3].tekst),
    'regnestykket på engelsk', JSON.stringify(en.linjer.map((l) => l.tekst)));
  const bet = B.score({ trin: 4, farve: 'S', dobling: 1, zone: false, stik: 7 }, 'en');
  tjek(bet.linjer.length === 1 && /down/i.test(bet.linjer[0].tekst), 'bet på engelsk', JSON.stringify(bet.linjer));
  const slem = B.score({ trin: 6, farve: 'S', dobling: 0, zone: true, stik: 12 }, 'da');
  tjek(slem.linjer.some((l) => /lilleslem/i.test(l.tekst) && l.point === 750), 'lilleslem i zonen: 750', JSON.stringify(slem.linjer));
  for (const lang of ['da', 'en']) {
    const u = B.score({ trin: 8, farve: 'S', dobling: 0, zone: false, stik: 7 }, lang);
    tjek(u.fejl && !u.linjer?.length, `ugyldigt trin giver en kort besked (${lang})`, JSON.stringify(u));
    const s = B.score({ trin: 1, farve: 'S', dobling: 0, zone: false, stik: 14 }, lang);
    tjek(s.fejl && (lang === 'en' ? /trick/i.test(s.fejl) : /stik/i.test(s.fejl)), `ugyldigt antal stik giver en besked (${lang})`, JSON.stringify(s));
  }
}

// --- Imp (§ 78B) --------------------------------------------------------------------------------------------------
for (const [forskel, imp] of [[10, 0], [20, 1], [420, 9], [430, 10], [450, 10], [490, 10], [500, 11], [2250, 20], [4000, 24], [-100, -3], [0, 0]]) {
  tjek(B.imp(forskel) === imp, `imp for ${forskel}`, `${B.imp(forskel)} ≠ ${imp}`);
}
tjek(B.impFraScorer(620, -170) === 13 && B.impFraScorer(620, 170) === 10, 'imp fra to scorer');

// --- Kamppoint (WBF 2013, § 202) ----------------------------------------------------------------------------------
const kp40 = JSON.parse(readFileSync(new URL('./data/kp40.json', import.meta.url), 'utf8')).vinder;
tjek(kp40.length === 96, 'kp40.json har 96 værdier');
const t40 = B.kpTabel(40);
const afvig = kp40.map((v, m) => [m, v, B.kp(m, 40).vinder]).filter(([, v, k]) => !lig(v, k));
tjek(afvig.length === 0, 'algoritmen giver DBf\'s tabel for 40 spil for alle 96 værdier 0–95 imp',
  afvig.slice(0, 8).map(([m, v, k]) => `${m} imp: DBf ${v}, algoritmen ${k}`).join('; '));
tjek(t40.length === 96 && lig(t40[95], 20), 'tabellen for 40 spil går fra 0 til 95 imp');
for (const [spil, fra] of [[16, 60], [24, 74], [32, 85], [40, 95]]) {
  tjek(lig(B.kp(fra, spil).vinder, 20) && B.kp(fra - 1, spil).vinder < 20 && lig(B.kp(fra + 30, spil).vinder, 20),
    `20,00 KP nås ved ${fra} imp (${spil} spil)`, `${B.kp(fra - 1, spil).vinder} / ${B.kp(fra, spil).vinder}`);
}
const REGRESSION = { 16: [10.31, 11.48, 12.80, 15.00, 16.73], 24: [10.25, 11.23, 12.33, 14.26, 15.83], 32: [10.22, 11.07, 12.05, 13.78, 15.24] };
for (const [spil, tal] of Object.entries(REGRESSION)) {
  [1, 5, 10, 20, 30].forEach((m, i) => tjek(lig(B.kp(m, Number(spil)).vinder, tal[i]), `KP ${spil} spil, ${m} imp = ${tal[i]}`, String(B.kp(m, Number(spil)).vinder)));
}
for (const spil of [4, 16, 40, 128]) {
  const t = B.kpTabel(spil);
  const d = t.slice(1).map((v, i) => to(v - t[i]));
  tjek(d.every((x, i) => i === 0 || x <= d[i - 1] + 1e-9), `forskellene stiger aldrig (${spil} spil)`);
}
{
  const a = B.kp(-20, 40);
  tjek(lig(a.vinder, 13.44) && lig(a.taber, 6.56), 'negativ imp-forskel giver samme vinder og taber', JSON.stringify(a));
  tjek(B.afrundImp(12.4) === 12 && B.afrundImp(12.5) === 13 && B.afrundImp(-12.5) === -13 && B.afrundImp(-12.4) === -12, 'imp afrundes, halve væk fra 0');
  tjek(B.kp(12.5, 40).imp === 13 && lig(B.kp(12.5, 40).vinder, B.kp(13, 40).vinder), 'kampens imp afrundes før omregningen');
  tjek(B.kp(10, 3).fejl && B.kp(10, 129).fejl, 'antal spil uden for 4–128 giver en besked');
}

// --- Matchpoint (§ X78) -------------------------------------------------------------------------------------------
{
  const r = B.matchpoint([450, 420, 420, 170, 140, -50, -100]);
  tjek(r.rækker.map((x) => x.mp).join() === '12,9,9,6,4,2,0', '2/1/0 = 12, 9, 9, 6, 4, 2, 0', r.rækker.map((x) => x.mp).join());
  tjek(r.rækker.map((x) => x.plusminus).join() === '6,3,3,0,-2,-4,-6', '+1/0/−1 = +6, +3, +3, 0, −2, −4, −6', r.rækker.map((x) => x.plusminus).join());
  tjek(r.sumPlusminus === 0, 'summen af +1/0/−1 er 0');
  tjek(r.rækker.map((x) => Math.round(x.pct)).join() === '100,75,75,50,33,17,0', 'procent 100, 75, 75, 50, 33, 17, 0', r.rækker.map((x) => x.pct).join());
  const række = r.rækker[1];
  tjek(række.slår === 4 && række.lige === 1 && række.taber === 1, '+420: slår 4, lige 1, taber for 1');
  tjek(B.matchpointForklaring(række, 'da') === 'Slår 4, lige 1, taber for 1: 4 × 2 + 1 = 9 point; 4 − 1 = +3',
    'regnestykket for en række på dansk', B.matchpointForklaring(række, 'da'));
  tjek(B.matchpointForklaring(række, 'en') === 'Beats 4, ties 1, loses to 1: 4 × 2 + 1 = 9 points; 4 − 1 = +3',
    'regnestykket for en række på engelsk', B.matchpointForklaring(række, 'en'));
  const øv = B.matchpoint([450, 420, 420, 170, 140, -50, -100], { øv: true });
  tjek(øv.rækker.map((x) => x.plusminus).join() === '-6,-3,-3,0,2,4,6', 'ØV med omvendt fortegn', øv.rækker.map((x) => x.plusminus).join());
}
{
  const n = B.matchpoint([500, 400, 300, 200, 100], { borde: 6 });
  tjek(lig(to(n.rækker[0].mp), 9.8) && lig(to(n.rækker[4].mp), 0.2) && n.top === 10, 'Neuberg, 5 resultater til 6 borde: top 9,8 og bund 0,2',
    `${n.rækker[0].mp} / ${n.rækker[4].mp} af ${n.top}`);
  tjek(lig(to(n.rækker[0].pct), 98), 'Neuberg: 9,8 af 10 er 98 %', String(n.rækker[0].pct));
  const p = (scorer, borde) => B.matchpoint(scorer, { borde }).rækker.map((x) => to(x.pct)).join();
  tjek(p([300], 8) === '60', 'ét resultat giver 60 %', p([300], 8));
  tjek(p([300, 200], 6) === '65,55', 'to resultater giver 65 % og 55 %', p([300, 200], 6));
  tjek(p([300, 300], 6) === '60,60', 'to ens resultater giver 60 % til begge', p([300, 300], 6));
  tjek(p([300, 200, 100], 9) === '70,60,50', 'tre resultater giver 70 %, 60 % og 50 % ved mindst 9 borde', p([300, 200, 100], 9));
  tjek(p([300, 200, 100], 8) !== '70,60,50', 'tre resultater ved færre end 9 borde bruger Neubergs formel', p([300, 200, 100], 8));
  tjek(B.matchpoint([100]).fejl && B.matchpoint(new Array(21).fill(0)).fejl, 'færre end 2 eller flere end 20 scorer uden borde giver en besked');
}

// --- Butler og cross-imp (§ 203–204) -----------------------------------------------------------------------------
{
  const scorer = [620, 620, 600, 170, 170, 140, -100, -100];
  const b = B.butler(scorer);
  tjek(lig(to(b.datum), 266.67), 'Butler: datum 266,67', String(b.datum));
  tjek(b.rækker[0].afrundet === 350 && b.rækker[0].imp === 8, 'Butler: +620 er 350 over → 8 imp', JSON.stringify(b.rækker[0]));
  tjek(b.rækker[3].afrundet === -100 && b.rækker[3].imp === -3, 'Butler: +170 er 100 under → −3 imp', JSON.stringify(b.rækker[3]));
  tjek(B.afrund10(355) === 360 && B.afrund10(-355) === -360 && B.afrund10(354) === 350, 'Butler: 5 afrundes væk fra 0');
  tjek(B.crossImp(scorer)[0] === 55, 'cross-imp for +620 er 55 imp', String(B.crossImp(scorer)[0]));
}

// --- Handicap (DBf's handicapreglement, afsnit 5) -----------------------------------------------------------------
{
  const PAR = [[22.00, 28.00, 48.34, 64.17, -0.90], [26.61, 43.69, 42.25, 62.50, -1.15], [17.03, 45.03, 44.72, 47.50, -0.16],
    [13.00, 13.00, 55.54, 46.67, 0.50], [16.11, 6.64, 56.51, 44.17, 0.70], [17.50, 18.17, 52.64, 35.00, 1.00]];
  for (const [h1, h2, forventet, opnået, regulering] of PAR) {
    const r = B.handicap({ h1, h2, gennemsnit: 22.23, par: 6, spil: 30, opgørelse: 'matchpoint', opnået });
    tjek(lig(to(r.forventet), forventet), `handicap ${h1}/${h2}: forventet ${forventet} %`, String(r.forventet));
    tjek(lig(to(r.regulering), regulering), `handicap ${h1}/${h2}: regulering ${regulering}`, String(r.regulering));
  }
  const alle = [22, 28, 26.61, 43.69, 17.03, 45.03, 13, 13, 16.11, 6.64, 17.5, 18.17];
  const g = B.handicap({ h1: 22, h2: 28, alle, par: 6, spil: 30, opgørelse: 'matchpoint', opnået: 64.17 });
  tjek(lig(to(g.gennemsnit), 22.23) && lig(to(g.regulering), -0.90), 'gennemsnittet regnes ud fra alle spilleres handicap', JSON.stringify(g));
  const loft = B.handicap({ h1: 51.80, h2: 40, gennemsnit: 30, par: 6, spil: 30, opgørelse: 'matchpoint', opnået: 30 });
  tjek(loft.regulering > 0, 'et dårligt resultat giver positiv regulering');
  tjek(lig(B.nytHandicap(51.80, 0.50), 52), 'et handicap på 51,80 med regulering +0,50 bliver 52,00', String(B.nytHandicap(51.80, 0.50)));
  tjek(lig(to(B.handicap({ h1: 22, h2: 28, gennemsnit: 22.23, par: 6, spil: 30, opgørelse: 'matchpoint', opnået: 64.17 }).nye[0]), 21.10),
    'Ole går fra 22,00 til 21,10');
  const imp = B.handicap({ h1: 20, h2: 20, gennemsnit: 20, par: 10, spil: 24, opgørelse: 'imp', opnået: 1 });
  tjek(lig(imp.forventet, 0) && imp.regulering < 0, 'imp: forventet 0 imp pr. spil ved gennemsnitligt handicap; plus giver lavere handicap', JSON.stringify(imp));
}

// --- Tal på dansk og engelsk --------------------------------------------------------------------------------------
tjek(B.tal(13.44, 2, 'da') === '13,44' && B.tal(13.44, 2, 'en') === '13.44', 'decimalkomma på dansk, punktum på engelsk');
tjek(B.tal(-0.9, 2, 'da') === '−0,90' && B.tal(0.5, 2, 'da', true) === '+0,50', 'minus med tankestreg og valgfrit plus');

// --- Siden (SPEC-scoring.md, Accepttest › Siden) -----------------------------------------------------------------
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROD = fileURLToPath(new URL('..', import.meta.url));
const læsFil = (sti) => readFileSync(join(ROD, sti), 'utf8').replace(/\r\n/g, '\n');
const MD = læsFil('scoring/Scoring_i_bridge.md');
const MD_EN = læsFil('scoring/Scoring_i_bridge.en.md');
const SIDE = læsFil('scoring/index.html');
// Siden på dansk er alt uden for <template>; den engelske tekst og indholdsfortegnelse står i hver sin <template>
const DOK = SIDE.replace(/<template[\s\S]*?<\/template>/g, '');
const skabelon = (id) => (SIDE.match(new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`)) || [])[1] ?? '';
const python = process.env.PYTHON || 'python';
const midl = mkdtempSync(join(tmpdir(), 'tjek-scoring-md-'));
const byg = (md, en = MD_EN) => {
  const sti = join(midl, 'en.md');
  writeFileSync(sti, en, 'utf8');
  return spawnSync(python, ['-I', '-X', 'utf8', 'tools/build_scoring.py', '--kilde', '-', '--en', sti, '--ud', '-'],
    { cwd: ROD, input: md, encoding: 'utf8' });
};

{
  const r = byg(MD);
  tjek(r.status === 0 && r.stdout.replace(/\r\n/g, '\n') === SIDE, 'scoring/index.html er bygget af build_scoring.py og ikke rettet i hånden', r.stderr);
  const fejler = (md, ord_, navn, en = MD_EN) => {
    const x = byg(md, en);
    tjek(x.status === 1 && x.stderr.includes(ord_), `build_scoring.py fejler ved ${navn}`, `${x.status} ${x.stderr}`);
  };
  fejler(MD.replace('<!-- beregner: imp -->', '<!-- beregner: imp -->\n\n<!-- beregner: imp -->'), 'Dobbelt id', 'dobbelte id\'er');
  fejler(MD + '\n## 8 Taktik\n\nIgen.\n', 'Dobbelt id', 'to afsnit med samme id');
  fejler(MD.replace('<!-- beregner: imp -->', '<!-- beregner: kp -->'), 'Ukendt beregnermarkør', 'en ukendt beregnermarkør');
  fejler(MD.replace('<!-- /fold -->', ''), 'slutmarkør', 'en fold uden slutmarkør');
  // Den engelske fil skal have samme overskrifter og markører som den danske (SPEC-scoring.md, leverancetrin 3)
  fejler(MD, 'overskrifter', 'en engelsk fil med en underoverskrift mindre', MD_EN.replace('### Total points\n', ''));
  fejler(MD, 'overskrifter', 'en engelsk fil med et afsnit mindre', MD_EN.replace('## 3 Pairs scored in IMPs\n', ''));
  fejler(MD, 'markører', 'en engelsk fil med markørerne i en anden rækkefølge',
    MD_EN.replace('<!-- beregner: score -->', '<!-- X -->').replace('<!-- beregner: matchpoint -->', '<!-- beregner: score -->').replace('<!-- X -->', '<!-- beregner: matchpoint -->'));
  fejler(MD, 'markører', 'en engelsk fil uden en foldboks', MD_EN.replace('<!-- fold: The formulas -->\n', '').replace(/<!-- \/fold -->\n(?![\s\S]*<!-- \/fold -->)/, ''));
  fejler(MD, 'Afsnit 7', 'et ukendt beregnernavn i det engelske afsnit 7', MD_EN.replace('**Score calculator**', '**Score machine**'));
  fejler(MD, 'Ukendt afsnit', 'et engelsk kildeafsnit, der ikke hedder Sources', MD_EN.replace('## Sources', '## Kilder'));
}
{
  tjek(skabelon('tekst-en') && skabelon('toc-en'), 'den engelske tekst og indholdsfortegnelse står i hver sin <template>');
  tjek(!SIDE.includes('English version coming soon'), 'linjen "English version coming soon." er fjernet');
  const overskrifter = (html) => [...html.matchAll(/<h([23]) id="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  const daH = overskrifter(DOK.slice(DOK.indexOf('<div class="tekst"'))), enH = overskrifter(skabelon('tekst-en'));
  tjek(daH.length > 40 && daH.join() === enH.join(), 'de engelske overskrifter har de danske id\'er i samme rækkefølge', `${daH.length}/${enH.length}`);
  tjek(skabelon('tekst-en').includes('<h3 id="kamppoint">Victory points</h3>') && skabelon('tekst-en').includes('<h3 id="butler">Butler</h3>'),
    'på engelsk står #kamppoint ved "Victory points" og #butler ved "Butler"');
  const enIds = [...skabelon('tekst-en').matchAll(/\sid="([^"$]+)"/g)].map((m) => m[1]);
  tjek(enIds.length === new Set(enIds).size, 'ingen dobbelte id\'er i den engelske tekst');
  const h2 = [...DOK.matchAll(/<h2 id="([^"]+)"><span class="nr">(\d)<\/span>/g)].map((m) => `${m[2]}:${m[1]}`);
  tjek(h2.join() === '1:scoren-for-et-spil,2:parturnering,3:parturnering-i-imp,4:holdturnering,5:taktik,6:handicap', 'afsnit 1–6, og afsnit 7 vises ikke', h2.join());
  tjek(!SIDE.includes('Beregnere på siden') && !SIDE.includes('Calculators on the page') && DOK.includes('<section class="kilder"'),
    'afsnit 7 er beregnerlinjen, og kilderne står nederst');
  const kort = [...DOK.matchAll(/<a class="indgang" href="#([^"]+)">/g)].map((m) => m[1]);
  tjek(kort.join() === 'beregner-score,parturnering,holdturnering,handicap', 'de fire indgangskort', kort.join());
  const linje = DOK.slice(DOK.indexOf('class="beregnerlinje"'), DOK.indexOf('</p>', DOK.indexOf('class="beregnerlinje"')));
  tjek(['score', 'matchpoint', 'imp', 'handicap'].every((b) => linje.includes(`href="#beregner-${b}"`)), 'beregnerlinjen linker til de fire beregnere');
  const pos = (id) => DOK.indexOf(` id="${id}"`);
  for (const [b, efter, før] of [['score', 'eksempler', 'parturnering'], ['matchpoint', 'et-eksempel', 'procent'],
    ['imp', 'kamppoint', 'board-a-match'], ['handicap', 'handicap-et-eksempel', 'matematikken']]) {
    tjek(pos(efter) > 0 && pos(efter) < pos(`beregner-${b}`) && pos(`beregner-${b}`) < pos(før), `beregneren ${b} står efter #${efter} og før #${før}`);
  }
  for (const [navn, html] of [['dansk', DOK], ['engelsk', skabelon('tekst-en')]]) {
    const folds = [...html.matchAll(/<details class="fold"([^>]*)>/g)];
    tjek(folds.length === 4 && folds.every((m) => !/open/.test(m[1])), `fire foldbokse, lukkede som standard (${navn})`, String(folds.length));
  }
  const ids = [...DOK.matchAll(/\sid="([^"$]+)"/g)].map((m) => m[1]);
  tjek(ids.length === new Set(ids).size, 'ingen dobbelte id\'er på siden');
  for (const id of ['matchpoint', 'butler', 'cross-imp', 'imp-skalaen', 'kamppoint', 'taktik', 'handicap', 'parturnering', 'holdturnering']) {
    tjek(ids.includes(id) && enIds.includes(id), `ankeret #${id} findes på begge sprog`);
  }
  tjek([...DOK.matchAll(/href="#([^"]+)"/g)].every((m) => ids.includes(m[1])), 'alle interne links peger på et id');
  tjek([...skabelon('tekst-en').matchAll(/href="#([^"]+)"/g), ...skabelon('toc-en').matchAll(/href="#([^"]+)"/g)]
    .every((m) => enIds.includes(m[1]) || ids.includes(m[1])), 'alle interne links i den engelske tekst peger på et id');
  tjek(/\[id\]\{ scroll-margin-top:\d+px; \}/.test(SIDE), 'ankrene har scroll-margin-top');
  const ressourcer = [...SIDE.matchAll(/<(?:script|img|iframe)[^>]+src="([^"]+)"|<link(?![^>]*rel="canonical")[^>]+href="([^"]+)"|url\(([^)]+)\)|import [^'"]*['"]([^'"]+)['"]/g)]
    .map((m) => m[1] || m[2] || m[3] || m[4]);
  tjek(ressourcer.length > 0 && ressourcer.every((u) => !/^(https?:)?\/\//.test(u)), 'siden henter intet uden for sitet', ressourcer.filter((u) => /^(https?:)?\/\//.test(u)).join(' '));
  tjek(SIDE.includes("import * as B from './beregn.js';"), 'beregnerne bruger scoring/beregn.js');
  tjek((SIDE.match(/aria-live="polite"/g) || []).length >= 5, 'svarene er aria-live="polite"');
  for (const sti of ['index.html', 'om-mig/index.html', 'ordbog/index.html', 'scoring/index.html']) {
    const s = læsFil(sti);
    const start = s.search(/id="foot(?:er)?-opslag"/);
    const opslag = s.slice(start, s.indexOf('</nav>', start));
    tjek(/<a href="\/ordbog\/"[^>]*>Bridgeordbog<\/a><\/li>\s*<li><a href="\/scoring\/" data-en="Scoring in bridge">Scoring i bridge<\/a>/.test(opslag),
      `sidefoden på ${sti} har Scoring i bridge under Opslag, på dansk og engelsk`);
  }
  tjek(læsFil('sitemap.xml').includes('<loc>https://www.kontraktbridge.dk/scoring/</loc>'), '/scoring/ står i sitemap');
}

// Siden i en rigtig browser (Chrome eller Edge via DevTools-protokollen); springes over, hvis ingen browser findes
const browser = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
if (!browser) {
  console.log('Advarsel: fandt hverken Chrome eller Edge; sidens tjek i browseren er sprunget over (sæt CHROME til stien).');
} else {
  const TYPER = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    let sti = normalize(join(ROD, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!sti.startsWith(normalize(ROD))) { res.writeHead(403).end(); return; }
    if (existsSync(sti) && statSync(sti).isDirectory()) sti = join(sti, 'index.html');
    if (!existsSync(sti)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPER[extname(sti)] || 'application/octet-stream' }).end(readFileSync(sti));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const SITE = `http://127.0.0.1:${server.address().port}`;
  const port = 9350 + Math.floor(Math.random() * 90);
  const profil = mkdtempSync(join(tmpdir(), 'tjek-scoring-'));
  const proces = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  const vent = (ms) => new Promise((r) => setTimeout(r, ms));
  const json = async (sti, metode = 'GET') => {
    for (let i = 0; i < 50; i++) {
      try { const s = await fetch(`http://127.0.0.1:${port}${sti}`, { method: metode }); if (s.ok) return await s.json(); } catch {}
      await vent(200);
    }
    throw new Error('Browseren svarer ikke');
  };
  try {
    await json('/json/version');
    const f = await json('/json/new?about:blank', 'PUT');
    const ws = new WebSocket(f.webSocketDebuggerUrl);
    await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
    let id = 0, indlæst = 0;
    const ventende = new Map(), kald = [], konsol = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && ventende.has(d.id)) { ventende.get(d.id)(d); ventende.delete(d.id); }
      else if (d.method === 'Page.loadEventFired') indlæst++;
      else if (d.method === 'Network.requestWillBeSent') kald.push(d.params.request.url);
      else if (d.method === 'Runtime.exceptionThrown') konsol.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((r) => { const n = ++id; ventende.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
    const kør = async (kode) => {
      const r = await send('Runtime.evaluate', { expression: `(async () => { ${kode} })()`, awaitPromise: true, returnByValue: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'fejl i siden');
      return r.result.result.value;
    };
    const tast = async (key, code = key, keyCode = 0) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, ...(key === 'Enter' ? { text: '\r' } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
      await vent(80);
    };
    await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
    const åbn = async (sti, bredde) => {
      await send('Emulation.setDeviceMetricsOverride', { width: bredde, height: bredde < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: bredde < 600 });
      const n = indlæst;
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: SITE + sti });
      for (let i = 0; i < 100 && indlæst <= n; i++) await vent(100);
      // Vent på skrifttyperne og på, at en blød rulning til et anker er faldet til ro
      await kør(`await document.fonts.ready; let y = -1, ens = 0;
        for (let i = 0; i < 60 && ens < 4; i++) { await new Promise((r) => setTimeout(r, 100)); ens = scrollY === y ? ens + 1 : 0; y = scrollY; }
        document.documentElement.style.scrollBehavior = 'auto';`);
    };

    // Fra 1000 px: indholdsfortegnelsen står fast til venstre og fremhæver det afsnit, man læser
    await åbn('/scoring/?lang=da', 1280);
    let t = await kør(`const toc = document.querySelector('.toc'); const s = getComputedStyle(toc);
      return { position: s.position, knap: getComputedStyle(toc.querySelector('.toc-knap')).display, liste: getComputedStyle(toc.querySelector('.toc-liste')).display,
               venstre: toc.getBoundingClientRect().left < document.querySelector('.tekst').getBoundingClientRect().left };`);
    tjek(t.position === 'sticky' && t.knap === 'none' && t.liste !== 'none' && t.venstre, 'fra 1000 px står indholdsfortegnelsen fast til venstre', JSON.stringify(t));
    t = await kør(`document.getElementById('cross-imp').scrollIntoView(); await new Promise((r) => setTimeout(r, 300));
      const a = document.querySelector('.toc a[aria-current="true"]'); const top = document.querySelector('.toc').getBoundingClientRect().top;
      return { aktiv: a && a.getAttribute('href'), top };`);
    tjek(t.aktiv === '#cross-imp' && t.top >= 0 && t.top < 40, 'fortegnelsen fremhæver det afsnit, man læser, og bliver stående', JSON.stringify(t));

    // Ankre åbner siden ved afsnittet, også under bjælken
    for (const bredde of [1280, 390]) {
      for (const anker of ['kamppoint', 'butler']) {
        await åbn(`/scoring/?lang=da#${anker}`, bredde);
        t = await kør(`const h = document.getElementById('${anker}').getBoundingClientRect(); const bar = document.querySelector('.toc').getBoundingClientRect();
          return { h: Math.round(h.top), bund: Math.round(${bredde < 1000} ? bar.bottom : 0) };`);
        tjek(t.h >= t.bund && t.h < 200, `/scoring/#${anker} åbner ved afsnittet ved ${bredde} px`, JSON.stringify(t));
      }
    }

    // Under 1000 px: "Indhold ▾" folder listen ud og lukker ved valg, Escape og tryk udenfor
    await åbn('/scoring/?lang=da', 390);
    const listeVist = () => kør(`return getComputedStyle(document.querySelector('.toc-liste')).display !== 'none';`);
    tjek(!(await listeVist()), 'under 1000 px er listen lukket');
    await kør(`document.querySelector('.toc-knap').click();`);
    tjek(await listeVist() && (await kør(`return document.querySelector('.toc-knap').getAttribute('aria-expanded')`)) === 'true', '"Indhold ▾" åbner listen');
    await kør(`document.querySelector('.toc-liste a[href="#butler"]').click(); await new Promise((r) => setTimeout(r, 300));`);
    t = await kør(`const h = document.getElementById('butler').getBoundingClientRect(); return { hash: location.hash, top: Math.round(h.top), bar: Math.round(document.querySelector('.toc').getBoundingClientRect().bottom) };`);
    tjek(!(await listeVist()) && t.hash === '#butler' && t.top >= t.bar, 'et valg lukker listen og springer til afsnittet under bjælken', JSON.stringify(t));
    await kør(`document.querySelector('.toc-knap').click();`);
    await tast('Escape', 'Escape', 27);
    tjek(!(await listeVist()), 'Escape lukker listen');
    await kør(`document.querySelector('.toc-knap').click(); document.querySelector('.afsnit p').click();`);
    tjek(!(await listeVist()), 'tryk uden for listen lukker den');
    t = await kør(`const d = document.documentElement; const tabeller = [...document.querySelectorAll('.tekst .tabel')];
      return { side: d.scrollWidth - d.clientWidth, ruller: tabeller.filter((x) => x.scrollWidth > x.clientWidth).length, ialt: tabeller.length };`);
    tjek(t.side <= 0 && t.ruller > 0, `ved 390 px ruller siden ikke vandret; ${t.ruller} af ${t.ialt} tabeller ruller i deres egen boks`, JSON.stringify(t));

    // Foldboksene er lukkede og kan åbnes med tastatur
    tjek((await kør(`return [...document.querySelectorAll('details.fold')].every((d) => !d.open)`)), 'foldboksene er lukkede, når siden åbnes');
    await kør(`document.querySelector('details.fold summary').focus();`);
    await tast('Enter', 'Enter', 13);
    tjek(await kør(`return document.querySelector('details.fold').open`), 'en foldboks åbner med Enter');

    // Trykflader på mindst 44 px og etiketter på alle felter
    t = await kør(`const små = [];
      for (const el of document.querySelectorAll('.beregner button, .beregner select, .beregner input:not([type=radio]):not([type=checkbox]), .beregner textarea, .valg > span, .felt-flueben, summary, .toc-knap, .toc-liste a, .afslut a, .beregnerlinje a, .indgang')) {
        const r = el.getBoundingClientRect(); if (r.width && r.height < 43.5) små.push((el.className || el.tagName) + ':' + Math.round(r.height));
      }
      const uden = [...document.querySelectorAll('.beregner input, .beregner select, .beregner textarea')].filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label')).map((el) => el.name || el.id);
      const live = [...document.querySelectorAll('[data-svar]')].every((el) => el.getAttribute('aria-live') === 'polite');
      return { små, uden, live };`);
    tjek(t.små.length === 0, 'trykfladerne er mindst 44 px', t.små.slice(0, 8).join(' '));
    tjek(t.uden.length === 0, 'alle felter i beregnerne har en etiket', t.uden.join(' '));
    tjek(t.live, 'beregnernes svar læses op (aria-live="polite")');

    // Beregnerne på dansk: standardværdierne og et skift med tastaturet
    const svar = (navn) => kør(`return document.querySelector('[data-svar="${navn}"]').innerText.replace(/\\s+/g, ' ').trim();`);
    tjek((await svar('score')).startsWith('+420 4♠ med 10 stik, uden for zonen'), 'scoreberegneren: 4♠ med 10 stik giver +420', await svar('score'));
    await kør(`document.querySelector('[name="dobling"][value="0"]').focus();`);
    await tast('ArrowRight', 'ArrowRight', 39);
    tjek((await svar('score')).startsWith('+590 4♠ doblet med 10 stik'), 'piletasten skifter til doblet: +590', await svar('score'));
    await kør(`const f = document.querySelector('[data-beregner="score"]'); f.elements.trin.value = '2'; f.elements.stik.value = '9';
      f.querySelector('[name="farve"][value="H"]').checked = true; f.dispatchEvent(new Event('input', { bubbles: true }));`);
    t = await svar('score');
    tjek(t.startsWith('+570') && t.includes('Stikpoint (2 × 30 × 2) 120') && t.includes('Udgang 300') && t.includes('Doblet kontrakt hjemme 50') && t.includes('1 overstik × 100 100'),
      'scoreberegneren: 2♥X med 9 stik er 570 med regnestykket', t);
    t = await kør(`return [...document.querySelectorAll('[data-svar="matchpoint"] tbody tr')].map((r) => r.cells[4].innerText + '/' + r.cells[6].innerText).join(' ');`);
    tjek(t === '12/+6 9/+3 9/+3 6/0 4/−2 2/−4 0/−6', 'matchpointregneren: 2/1/0 og +1/0/−1 for eksemplet', t);
    tjek((await svar('matchpoint')).includes('Summen af +1/0/−1 er 0.'), 'matchpointregneren viser kontrollen');
    await kør(`document.querySelector('[data-række="1"]').click();`);
    tjek((await svar('matchpoint')).includes('Slår 4, lige 1, taber for 1: 4 × 2 + 1 = 9 point; 4 − 1 = +3'), 'et tryk på en række viser regnestykket', await svar('matchpoint'));
    await kør(`const f = document.querySelector('[data-beregner="matchpoint"]'); f.elements.borde.value = '9'; f.dispatchEvent(new Event('input', { bubbles: true }));`);
    tjek((await svar('matchpoint')).includes('Omregnet til 9 borde med Neubergs formel.'), 'med flere borde omregnes efter Neubergs formel', await svar('matchpoint'));
    tjek((await svar('imp')).startsWith('+10 imp'), 'impomregneren: 620 mod 170 giver 10 imp', await svar('imp'));
    tjek((await svar('kp')).startsWith('13,44 – 6,56'), 'kamppoint: 20 imp i 40 spil giver 13,44 – 6,56', await svar('kp'));
    t = await svar('handicap');
    tjek(t.includes('Parhandicap 25,00') && t.includes('Forventet score 48,34 %') && t.includes('Regulering for hver spiller −0,90') && t.includes('Nye handicap 21,10 og 27,10'),
      'handicapberegneren: faktaarkets eksempel', t);
    await kør(`const f = document.querySelector('[data-beregner="handicap"]'); f.elements.par.value = 'x'; f.dispatchEvent(new Event('input', { bubbles: true }));`);
    tjek((await svar('handicap')).length > 0 && (await kør(`return document.querySelector('[data-beregner="handicap"] [name="par"]').getAttribute('aria-invalid')`)) === 'true',
      'et ugyldigt felt markeres og får en kort besked', await svar('handicap'));

    // Den danske teksts længere tekstbidder (uden kilderne), så den engelske side kan tjekkes for rester af dansk
    const danskeTekster = await kør(`return [...document.querySelectorAll('.tekst *')].filter((el) => !el.closest('.kilder') && !el.children.length)
      .map((el) => el.textContent.replace(/\\s+/g, ' ').trim()).filter((x) => x.length > 25 && /[a-zæøå]{3}/i.test(x));`);

    // Engelsk: hele siden på engelsk (SPEC-scoring.md, leverancetrin 3)
    await åbn('/scoring/?lang=en', 390);
    t = await kør(`return { snart: document.body.innerText.includes('English version coming soon'), knap: document.querySelector('.toc-knap').innerText.trim(),
      h1: document.querySelector('h1').innerText.trim(), h2: document.querySelector('.tekst h2').innerText.replace(/\\s+/g, ' ').trim(),
      toc: document.querySelector('.toc-liste a').innerText.replace(/\\s+/g, ' ').trim(), kilder: document.getElementById('kilder').innerText.trim(),
      lead: document.querySelector('.sc-lead').innerText.slice(0, 40),
      h: [...document.querySelectorAll('.beregner-h')].map((h) => h.innerText).join(' | '), lang: document.documentElement.lang };`);
    tjek(!t.snart && t.knap.startsWith('Contents') && t.lang === 'en', 'engelsk: "Contents", og linjen "English version coming soon." er væk', JSON.stringify(t));
    tjek(t.h1 === 'Scoring in bridge' && t.h2 === '1 The score for a board' && t.toc === '1 The score for a board' && t.kilder === 'Sources'
      && t.lead.startsWith('This page is about duplicate bridge'), 'engelsk: overskriften, teksten, indholdsfortegnelsen og Sources', JSON.stringify(t));
    tjek(t.h === 'Score calculator | Matchpoint calculator | IMP and VP converter | Handicap calculator', 'engelsk: beregnernes navne', t.h);
    t = await kør(`const tekster = [...document.querySelectorAll('.tekst *')].filter((el) => !el.closest('.kilder') && !el.children.length)
      .map((el) => el.textContent.replace(/\\s+/g, ' ').trim());
      return tekster.filter((x) => ${JSON.stringify(danskeTekster)}.includes(x));`);
    tjek(t.length === 0, 'engelsk: ingen af den danske teksts afsnit, tabelceller og punkter står tilbage', t.slice(0, 5).join(' | '));
    t = await kør(`const tekst = [...document.querySelectorAll('body *')].filter((el) => !el.closest('.kilder, script, style, template') && el.offsetParent !== null || el.tagName === 'TITLE')
      .flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent)).join(' ') + ' ' + document.title;
      return (tekst.match(/[^\\s.,:;()–]*[æøåÆØÅ][^\\s.,:;()–]*|\\b(og|med|stik|bet|spil|zonen|scorer|beregner|spiller|gennemsnit|antal|opnået|valgfrit|regulering|omregnet|Næste|Til toppen|Indhold|ikke|eller|hvis|af|på|til|det|der|som|skal|har|ved)\\b/g) || []);`);
    const tilladt = ['Jørgen', 'Fordelingstræneren'];
    const ord = t.filter((x) => !tilladt.includes(x));
    tjek(ord.length === 0, 'engelsk: ingen danske ord uden for kildetitlerne (kun navnet Jørgen og appens navn)', [...new Set(ord)].join(' '));
    tjek((await svar('kp')).startsWith('13.44 – 6.56') && (await svar('kp')).includes('the winner gets 13.44 VP, the loser 6.56 VP')
      && (await svar('imp')).startsWith('+10 IMPs') && (await svar('score')).includes('Trick score (4 × 30) 120'), 'engelsk: decimalpunktum, IMPs, VP og regnestykket på engelsk',
      (await svar('kp')) + ' / ' + (await svar('score')));
    await kør(`document.querySelector('[data-række="1"]').click();`);
    tjek((await svar('matchpoint')).includes('Beats 4, ties 1, loses to 1: 4 × 2 + 1 = 9 points; 4 − 1 = +3'), 'engelsk: regnestykket for en række');
    tjek(await kør(`return [...document.querySelectorAll('.afslut')].every((n) => n.innerText.includes('Back to top') && (n === document.querySelectorAll('.afslut')[5] || n.innerText.includes('Next:')))`),
      'engelsk: "Next:" og "Back to top" under afsnittene');
    t = await kør(`const tekst = [...document.querySelectorAll('.beregner, .indgange, .beregnerlinje, .toc-knap, .footer')].map((el) => el.innerText).join(' ')
      + ' ' + [...document.querySelectorAll('.beregner [placeholder], .beregner [aria-label]')].map((el) => el.getAttribute('placeholder') || el.getAttribute('aria-label')).join(' ');
      return (tekst.match(/[^\\s.,:;()]*[æøåÆØÅ][^\\s.,:;()]*|\\b(og|med|stik|bet|spil|zonen|scorer|beregner|spiller|gennemsnit|antal|opnået|valgfrit|regulering|omregnet|Næste|Til toppen|Indhold)\\b/g) || []);`);
    const rester = t.filter((x) => !['Fordelingstræneren'].includes(x));
    tjek(rester.length === 0, 'engelsk: ingen dansk i beregnerne, indgangene og navigationen', [...new Set(rester)].join(' '));

    // Ankrene virker på engelsk og står ved de engelske overskrifter
    for (const bredde of [1280, 390]) {
      for (const [anker, titel] of [['kamppoint', 'Victory points'], ['butler', 'Butler']]) {
        await åbn(`/scoring/?lang=en#${anker}`, bredde);
        t = await kør(`const el = document.getElementById('${anker}'); const h = el.getBoundingClientRect(); const bar = document.querySelector('.toc').getBoundingClientRect();
          return { tekst: el.innerText.trim(), h: Math.round(h.top), bund: Math.round(${bredde < 1000} ? bar.bottom : 0) };`);
        tjek(t.tekst === titel && t.h >= t.bund && t.h < 200, `engelsk: /scoring/#${anker} åbner ved "${titel}" ved ${bredde} px`, JSON.stringify(t));
      }
    }

    // Sprogvalget huskes mellem siderne: dansk → knappen → engelsk på ordbogen, forsiden og tilbage på scoringssiden
    await åbn('/scoring/?lang=da', 1280);
    await kør(`document.getElementById('langBtn').click();`);
    for (let i = 0; i < 50 && (await kør('return document.documentElement.lang').catch(() => '')) !== 'en'; i++) await vent(100);
    await åbn('/scoring/', 1280);
    tjek((await kør('return document.documentElement.lang')) === 'en', 'sprogknappen skifter scoringssiden til engelsk, og valget huskes');
    for (const sti of ['/ordbog/', '/', '/scoring/#kamppoint']) {
      await åbn(sti, 1280);
      t = await kør(`return { lang: document.documentElement.lang, knap: document.getElementById('langBtn').textContent.trim() };`);
      tjek(t.lang === 'en' && t.knap === 'Dansk', `engelsk huskes på ${sti}`, JSON.stringify(t));
    }
    // Ordbogens link fra Kamppoint fører til den engelske overskrift
    await åbn('/ordbog/', 1280);
    await kør(`document.querySelector('#kamppoint a[href="/scoring/#kamppoint"]').click();`);
    await vent(1500);
    await kør(`let y = -1, ens = 0; for (let i = 0; i < 60 && ens < 4; i++) { await new Promise((r) => setTimeout(r, 100)); ens = scrollY === y ? ens + 1 : 0; y = scrollY; }`);
    t = await kør(`const el = document.getElementById('kamppoint'); return { sti: location.pathname + location.hash, tekst: el.innerText.trim(), top: Math.round(el.getBoundingClientRect().top) };`);
    tjek(t.sti === '/scoring/#kamppoint' && t.tekst === 'Victory points' && t.top >= 0 && t.top < 200, 'ordbogens link fra Kamppoint åbner "Victory points" på engelsk', JSON.stringify(t));
    await åbn('/scoring/?lang=da', 1280);

    // Intet hentes uden for sitet, og ingen fejl i konsollen
    const ude = kald.filter((u) => !u.startsWith(SITE) && !u.startsWith('about:') && !u.startsWith('data:'));
    tjek(ude.length === 0, 'siden henter intet uden for sitet', ude.join(' '));
    tjek(konsol.length === 0, 'ingen fejl i konsollen', konsol.join(' | '));
    ws.close();
  } finally {
    proces.kill();
    server.close();
    await vent(300);
    for (const m of [profil, midl]) { try { rmSync(m, { recursive: true, force: true }); } catch {} }
  }
}

console.log(`${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
