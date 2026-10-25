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

console.log(`${ok} ok, ${fejl} fejl`);
process.exit(fejl ? 1 : 0);
