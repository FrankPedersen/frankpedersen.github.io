// Regnemotoren til Scoring i bridge (SPEC-scoring.md, Beregnerne). Rene funktioner uden DOM og netværk; siden importerer
// modulet, og tools/tjek_scoring.mjs kører de samme funktioner i Node. Tekster findes på dansk ('da') og engelsk ('en').

const T = (lang, da, en) => (lang === 'en' ? en : da);

/** Et tal med decimaler: decimalkomma på dansk, punktum på engelsk, rigtigt minustegn og valgfrit plus. */
export function tal(x, decimaler = 0, lang = 'da', medPlus = false) {
  const s = Math.abs(x).toFixed(decimaler);
  const fortegn = x < 0 && Number(s) !== 0 ? '−' : medPlus && x > 0 ? '+' : '';
  return fortegn + (lang === 'en' ? s : s.replace('.', ','));
}

// --- Scoren for et spil (Lovene § 77) -----------------------------------------------------------------------------

const STIKVÆRDI = { C: 20, D: 20, H: 30, S: 30, NT: 30 };
const FARVENAVN = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'NT' };

/** Bet for doblet kontrakt: 1., 2. og 3. bet og hver derefter, uden for og i zonen. */
function betDoblet(antal, zone) {
  let sum = 0;
  for (let i = 1; i <= antal; i++) sum += zone ? (i === 1 ? 200 : 300) : (i === 1 ? 100 : i <= 3 ? 200 : 300);
  return sum;
}

/**
 * Scoren for spilførers side. input: { trin 1–7, farve 'C'|'D'|'H'|'S'|'NT', dobling 0|1|2, zone true|false, stik 0–13 }.
 * Svar: { score, linjer: [{ tekst, point }] } (linjerne lægges sammen til scoren) eller { fejl } ved ugyldige felter.
 */
export function score({ trin, farve, dobling = 0, zone = false, stik }, lang = 'da') {
  if (!Number.isInteger(trin) || trin < 1 || trin > 7) return { fejl: T(lang, 'Trinnet skal være 1–7.', 'The level must be 1–7.'), linjer: [] };
  if (!(farve in STIKVÆRDI)) return { fejl: T(lang, 'Vælg en farve eller sans.', 'Choose a suit or notrump.'), linjer: [] };
  if (![0, 1, 2].includes(dobling)) return { fejl: T(lang, 'Vælg udoblet, doblet eller redoblet.', 'Choose undoubled, doubled or redoubled.'), linjer: [] };
  if (!Number.isInteger(stik) || stik < 0 || stik > 13) return { fejl: T(lang, 'Antal stik skal være 0–13.', 'The number of tricks must be 0–13.'), linjer: [] };

  const gang = [1, 2, 4][dobling];
  const linjer = [];
  const kræves = trin + 6;
  if (stik < kræves) {
    const bet = kræves - stik;
    const point = dobling === 0 ? bet * (zone ? 100 : 50) : betDoblet(bet, zone) * (dobling === 2 ? 2 : 1);
    linjer.push({
      tekst: T(lang, `${bet} bet${dobling ? (dobling === 2 ? ' redoblet' : ' doblet') : ''}${zone ? ' i zonen' : ' uden for zonen'}`,
        `${bet} down${dobling ? (dobling === 2 ? ' redoubled' : ' doubled') : ''}${zone ? ', vulnerable' : ', not vulnerable'}`),
      point: -point,
    });
    return { score: -point, linjer };
  }

  const stikpoint = (farve === 'NT' ? 40 + (trin - 1) * 30 : trin * STIKVÆRDI[farve]) * gang;
  const regnestykke = farve === 'NT'
    ? (trin === 1 ? '40' : `40 + ${trin - 1} × 30`) + (gang > 1 ? ` × ${gang}` : '')
    : `${trin} × ${STIKVÆRDI[farve]}` + (gang > 1 ? ` × ${gang}` : '');
  linjer.push({ tekst: T(lang, `Stikpoint (${regnestykke})`, `Trick score (${regnestykke})`), point: stikpoint });

  if (stikpoint >= 100) linjer.push({ tekst: T(lang, `Udgang${zone ? ' i zonen' : ''}`, `Game bonus${zone ? ', vulnerable' : ''}`), point: zone ? 500 : 300 });
  else linjer.push({ tekst: T(lang, 'Delkontrakt', 'Part-score bonus'), point: 50 });
  if (trin === 6) linjer.push({ tekst: T(lang, `Lilleslem${zone ? ' i zonen' : ''}`, `Small slam bonus${zone ? ', vulnerable' : ''}`), point: zone ? 750 : 500 });
  if (trin === 7) linjer.push({ tekst: T(lang, `Storeslem${zone ? ' i zonen' : ''}`, `Grand slam bonus${zone ? ', vulnerable' : ''}`), point: zone ? 1500 : 1000 });
  if (dobling) linjer.push({
    tekst: T(lang, dobling === 2 ? 'Redoblet kontrakt hjemme' : 'Doblet kontrakt hjemme', dobling === 2 ? 'Redoubled contract made' : 'Doubled contract made'),
    point: dobling === 2 ? 100 : 50,
  });
  const over = stik - kræves;
  if (over > 0) {
    const pr = dobling === 0 ? STIKVÆRDI[farve] : (zone ? 200 : 100) * (dobling === 2 ? 2 : 1);
    linjer.push({ tekst: T(lang, `${over} overstik × ${pr}`, `${over} overtrick${over > 1 ? 's' : ''} × ${pr}`), point: over * pr });
  }
  return { score: linjer.reduce((s, l) => s + l.point, 0), linjer };
}

/** Kontrakten som tekst, fx "4♠X". */
export function kontraktTekst({ trin, farve, dobling = 0 }) {
  return `${trin}${FARVENAVN[farve]}${['', 'X', 'XX'][dobling]}`;
}

// --- Imp (Lovene § 78B) -------------------------------------------------------------------------------------------

// Den laveste forskel, der giver 1, 2, … 24 imp
const IMP_GRÆNSER = [20, 50, 90, 130, 170, 220, 270, 320, 370, 430, 500, 600, 750, 900, 1100, 1300, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000];

/** Imp for en forskel i point (negativ forskel giver negative imp). */
export function imp(forskel) {
  const a = Math.abs(forskel);
  const n = IMP_GRÆNSER.filter((g) => a >= g).length;
  return forskel < 0 ? -n : n;
}

export const impFraScorer = (a, b) => imp(a - b);

/** Hele imp: halve afrundes væk fra 0 (12,5 → 13, −12,5 → −13). */
export function afrundImp(x) {
  return Math.sign(x) * Math.round(Math.abs(x));
}

// --- Kamppoint (WBF's skala fra 2013, DBf's turneringsbestemmelser § 202) -----------------------------------------

const TAU = (Math.sqrt(5) - 1) / 2;
const tabeller = new Map();

/** Vinderens kamppoint for 0 … B imp ved et antal spil; fra B imp er det 20,00. */
export function kpTabel(spil) {
  if (tabeller.has(spil)) return tabeller.get(spil);
  const b = 15 * Math.sqrt(spil);
  const B = Math.ceil(b);
  // i hundrededele, så afrundingen og justeringen er eksakt
  const v = [];
  for (let m = 0; m <= B; m++) v.push(m === B ? 2000 : Math.round(100 * (10 + 10 * (1 - TAU ** (3 * m / b)) / (1 - TAU ** 3))));
  // Forskellene mellem nabotal må aldrig stige: flyt 0,01 fra en forskel, der er større end den forrige, til den forrige.
  let flyttet = true;
  while (flyttet) {
    flyttet = false;
    for (let m = 2; m <= B; m++) {
      if (v[m] - v[m - 1] > v[m - 1] - v[m - 2]) { v[m - 1] += 1; flyttet = true; }
    }
  }
  const tabel = v.map((x) => x / 100);
  tabeller.set(spil, tabel);
  return tabel;
}

/** Kamppoint for en kamp: { imp (afrundet), vinder, taber } eller { fejl }. Forskellens fortegn er ligegyldigt. */
export function kp(impForskel, spil, lang = 'da') {
  if (!Number.isInteger(spil) || spil < 4 || spil > 128) return { fejl: T(lang, 'Antal spil skal være 4–128.', 'The number of boards must be 4–128.') };
  if (!Number.isFinite(impForskel)) return { fejl: T(lang, 'Kampens imp-forskel mangler.', 'The IMP difference of the match is missing.') };
  const m = Math.abs(afrundImp(impForskel));
  const tabel = kpTabel(spil);
  const vinder = m < tabel.length ? tabel[m] : 20;
  return { imp: afrundImp(impForskel), vinder, taber: Math.round((20 - vinder) * 100) / 100 };
}

// --- Matchpoint (DBf's turneringsbestemmelser § X78) --------------------------------------------------------------

/**
 * Matchpoint for scorerne på ét spil (NS-scorer). Med { borde } større end antal scorer omregnes til det fulde antal borde
 * efter § X78B (1, 2 og 3 resultater) og ellers Neubergs formel. Med { øv: true } vises ØV med omvendt fortegn.
 * Svar: { rækker: [{ score, slår, lige, taber, mp, pct, plusminus }], top, sumPlusminus } eller { fejl }.
 */
export function matchpoint(scorer, { borde, øv = false } = {}, lang = 'da') {
  const G = scorer.length;
  const A = borde ?? G;
  if (!scorer.every(Number.isFinite)) return { fejl: T(lang, 'Alle scorer skal være tal.', 'All scores must be numbers.') };
  if (G < 1 || G > 20 || (borde === undefined && G < 2)) return { fejl: T(lang, 'Skriv 2–20 scorer.', 'Enter 2–20 scores.') };
  if (!Number.isInteger(A) || A < G || A > 40) return { fejl: T(lang, 'Antal borde skal være mindst antallet af scorer.', 'The number of tables must be at least the number of scores.') };
  const fortegn = øv ? -1 : 1;
  const top = 2 * (A - 1);
  const rækker = scorer.map((s) => {
    const slår = scorer.filter((x) => s > x).length;
    const lige = scorer.filter((x) => s === x).length - 1;
    const taber = G - 1 - slår - lige;
    return { score: s, slår, lige, taber, p: 2 * slår + lige };
  });
  // De mulige pladser og deres procent ved 1, 2 og 3 resultater (§ X78B); ens resultater deler deres pladsers procent
  const fast = G === 1 ? [60] : G === 2 && A >= 6 ? [65, 55] : G === 3 && A >= 9 ? [70, 60, 50] : null;
  for (const r of rækker) {
    if (G === A) {
      r.mp = r.p;
    } else if (fast) {
      const pladser = fast.slice(r.taber, r.taber + r.lige + 1);
      r.mp = (pladser.reduce((a, b) => a + b, 0) / pladser.length) * top / 100;
    } else {
      r.mp = A / G * (r.p + 1) - 1; // Neubergs formel
    }
    r.pct = top ? (100 * r.mp) / top : 50;
    r.plusminus = fortegn * (r.slår - r.taber);
    if (øv) { r.mp = top - r.mp; r.pct = 100 - r.pct; }
    delete r.p;
  }
  return { rækker, top, sumPlusminus: rækker.reduce((s, r) => s + r.plusminus, 0) };
}

/** Regnestykket for én række, fx "Slår 4, lige 1, taber for 1: 4 × 2 + 1 = 9 point; 4 − 1 = +3". */
export function matchpointForklaring(r, lang = 'da') {
  const point = 2 * r.slår + r.lige;
  const pm = r.slår - r.taber;
  const pmTekst = pm > 0 ? `+${pm}` : pm < 0 ? `−${-pm}` : '0';
  return T(lang,
    `Slår ${r.slår}, lige ${r.lige}, taber for ${r.taber}: ${r.slår} × 2 + ${r.lige} = ${point} point; ${r.slår} − ${r.taber} = ${pmTekst}`,
    `Beats ${r.slår}, ties ${r.lige}, loses to ${r.taber}: ${r.slår} × 2 + ${r.lige} = ${point} point${point === 1 ? '' : 's'}; ${r.slår} − ${r.taber} = ${pmTekst}`);
}

// --- Butler og cross-imp (DBf's turneringsbestemmelser § 203–204) ------------------------------------------------

/** Nærmeste 10; en forskel, der ender på 5, afrundes væk fra 0. */
export function afrund10(x) {
  return Math.sign(x) * Math.floor(Math.abs(x) / 10 + 0.5) * 10;
}

/** Butler: datum er gennemsnittet uden de { fjern } højeste og laveste; forskellen afrundes til 10 og omregnes til imp. */
export function butler(scorer, { fjern = 1 } = {}) {
  const sorteret = [...scorer].sort((a, b) => a - b);
  const midt = sorteret.slice(fjern, sorteret.length - fjern);
  const datum = midt.reduce((s, x) => s + x, 0) / midt.length;
  return {
    datum,
    rækker: scorer.map((s) => {
      const afrundet = afrund10(s - datum);
      return { score: s, forskel: s - datum, afrundet, imp: imp(afrundet) };
    }),
  };
}

/** Cross-imp: for hver score summen af imp mod hver af de andre scorer (DBf lægger dem sammen). */
export function crossImp(scorer) {
  return scorer.map((s, i) => scorer.reduce((sum, x, j) => (i === j ? sum : sum + imp(s - x)), 0));
}

// --- Handicap (DBf's handicapreglement 2017, afsnit 5) ------------------------------------------------------------

export const HANDICAP_LOFT = 52;

/** Et nyt handicap: det gamle plus reguleringen, højst 52. */
export function nytHandicap(h, regulering) {
  return Math.min(HANDICAP_LOFT, Math.round((h + regulering) * 100) / 100);
}

/**
 * Parhandicap, forventet score og regulering for en parturnering.
 * input: { h1, h2, gennemsnit | alle (alle spilleres handicap), par, spil, opgørelse 'matchpoint'|'imp', opnået?, butler? }.
 * Matchpoint i procent, imp i imp pr. spil og pr. sammenligning.
 */
export function handicap({ h1, h2, gennemsnit, alle, par, spil, opgørelse = 'matchpoint', opnået, butler: datum = false }, lang = 'da') {
  if (![h1, h2].every((h) => Number.isFinite(h) && h <= HANDICAP_LOFT)) return { fejl: T(lang, 'Handicap skal være tal på højst 52.', 'Handicaps must be numbers of at most 52.') };
  if (!Number.isInteger(par) || par < 2) return { fejl: T(lang, 'Antal par skal være mindst 2.', 'The number of pairs must be at least 2.') };
  if (!Number.isInteger(spil) || spil < 1) return { fejl: T(lang, 'Antal spil skal være mindst 1.', 'The number of boards must be at least 1.') };
  const g = gennemsnit ?? (alle?.length ? alle.reduce((s, x) => s + x, 0) / alle.length : NaN);
  if (!Number.isFinite(g)) return { fejl: T(lang, 'Skriv gennemsnitshandicappet eller alle spilleres handicap.', 'Enter the average handicap or every player\'s handicap.') };
  const mp = opgørelse !== 'imp';
  const S = mp ? 0.6 : 0.1;
  const Cb = mp ? 2 : 12;
  const Cu = datum ? 1 : (par - 1) / par;
  const Ck = 1;
  const NB = Math.floor(par / 2);
  const parhandicap = (h1 + h2) / 2;
  const forventet = (mp ? 50 : 0) + (g - parhandicap) / (Cu * Ck * Cb);
  const svar = { gennemsnit: g, parhandicap, forventet };
  if (Number.isFinite(opnået)) {
    const faktor = (1 - (1 / 480) * (NB - 1) / (NB + S)) ** spil - 1;
    svar.regulering = faktor * Cu * Ck * Cb * (opnået - forventet);
    svar.nye = [nytHandicap(h1, svar.regulering), nytHandicap(h2, svar.regulering)];
  }
  return svar;
}
