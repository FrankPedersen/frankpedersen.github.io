"""Bygger ordbogssiden ordbog/index.html fra ordbog/Dansk_bridgeordbog.md (SPEC-sprog-og-ordbog.md, Ordbogssiden).

    python tools/build_ordbog.py

index.html rettes aldrig i hånden. Scriptet stopper med en fejl ved døde henvisninger, dobbelte id'er og et
opslagsord, der er et af husets "Ikke"-ord. Siden bruger ingen eksterne biblioteker i browseren.

Opslagene i tools/data/ordbog-scoring.json får et link til Scoring i bridge (SPEC-scoring.md, leverancetrin 5);
linkets tekst er overskriften ved ankeret på scoring/index.html. Byg derfor scoringssiden før ordbogen, når en
overskrift dér ændres. Et ukendt opslag eller anker i tabellen stopper scriptet.
"""
import html
import json
import pathlib
import re
import sys
import unicodedata

ROD = pathlib.Path(__file__).resolve().parent.parent
KILDE = ROD / 'ordbog' / 'Dansk_bridgeordbog.md'
SIDE = ROD / 'ordbog' / 'index.html'
SCORING_TABEL = ROD / 'tools' / 'data' / 'ordbog-scoring.json'
SCORING_SIDE = ROD / 'scoring' / 'index.html'

# Husets "Ikke"-ord (SPEC-sprog-og-ordbog.md, Husets fagord); de må kun stå som alternative termer.
FORBUDTE_OPSLAGSORD = {'blindemand', 'den blinde', 'knibning', 'snit', 'dobbeltknibning', 'broer'}

FELTER = {
    'ID': 'id',
    'Engelsk': 'engelsk',
    'Alternative termer': 'alternative',
    'Forkortelse': 'forkortelse',
    'Niveau': 'niveau',
    'Kategori': 'kategori',
    'Systemafhængig': 'systemafhaengig',
    'Kort definition': 'definition',
    'Forklaring': 'forklaring',
    'Relaterede begreber': 'relaterede',
}
KRÆVEDE = ('id', 'engelsk', 'niveau', 'kategori', 'definition', 'forklaring')
NIVEAUER = ['begynder', 'let øvet', 'øvet', 'avanceret']
INDEKS_EN = 'Engelsk-dansk indeks'
INDEKS_DA = 'Dansk-engelsk indeks'


class OrdbogFejl(Exception):
    pass


def parse(tekst):
    """Opslagene, kategorierne i kildens rækkefølge, det engelsk-danske indeks og antallet, kilden selv angiver."""
    opslag, kategorier, indeks = [], [], []
    angivet, afsnit, nu = None, None, None
    for nr, linje in enumerate(tekst.splitlines(), 1):
        m = re.match(r'_Version [\d.]+\. Ordbogen indeholder (\d+) kanoniske opslag\._$', linje)
        if m:
            angivet = int(m.group(1))
            continue
        if linje.startswith('## '):
            afsnit, nu = linje[3:].strip(), None
            if afsnit not in (INDEKS_EN, INDEKS_DA):
                kategorier.append(afsnit)
            continue
        if afsnit == INDEKS_DA:
            continue
        if afsnit == INDEKS_EN:
            m = re.match(r'- \*\*(.+?)\*\* → \[(.+?)\]\(#([^)]+)\)$', linje)
            if m:
                indeks.append({'engelsk': m.group(1), 'dansk': m.group(2), 'id': m.group(3), 'linje': nr})
            elif linje.strip():
                raise OrdbogFejl(f'Linje {nr}: ukendt linje i det engelsk-danske indeks: {linje}')
            continue
        if linje.startswith('### '):
            nu = {'ord': linje[4:].strip(), 'linje': nr}
            opslag.append(nu)
            continue
        m = re.match(r'\*\*(.+?):\*\* (.*)$', linje)
        if m and nu is not None:
            if m.group(1) not in FELTER:
                raise OrdbogFejl(f'Linje {nr}: ukendt felt "{m.group(1)}"')
            nu[FELTER[m.group(1)]] = m.group(2).strip()
    for o in opslag:
        for felt in KRÆVEDE:
            if not o.get(felt):
                raise OrdbogFejl(f'Linje {o["linje"]}: opslaget "{o["ord"]}" mangler {felt}')
        o['id'] = o['id'].strip('`')
        o['alternative'] = [t.strip() for t in o.get('alternative', '').split(',') if t.strip()]
        o['relaterede'] = [t.strip() for t in o.get('relaterede', '').split(',') if t.strip()]
        o['systemafhaengig'] = o.get('systemafhaengig') == 'Ja'
    return {'opslag': opslag, 'kategorier': kategorier, 'indeks': indeks, 'angivet': angivet}


def valider(ordbog):
    opslag = ordbog['opslag']
    set_ = {}
    for o in opslag:
        if o['id'] in set_:
            raise OrdbogFejl(f'Dobbelt id "{o["id"]}": "{set_[o["id"]]["ord"]}" og "{o["ord"]}"')
        set_[o['id']] = o
        if o['ord'].strip().lower() in FORBUDTE_OPSLAGSORD:
            raise OrdbogFejl(f'Linje {o["linje"]}: "{o["ord"]}" er ikke husets ord og må kun stå som alternativ term')
    for o in opslag:
        for mål in o['relaterede']:
            if mål not in set_:
                raise OrdbogFejl(f'Død henvisning i "{o["ord"]}": {mål}')
    for række in ordbog['indeks']:
        if række['id'] not in set_:
            raise OrdbogFejl(f'Linje {række["linje"]}: død henvisning i indekset: {række["id"]}')
    if ordbog['angivet'] is not None and ordbog['angivet'] != len(opslag):
        raise OrdbogFejl(f'Kilden angiver {ordbog["angivet"]} opslag, men har {len(opslag)}')


# --- Siden ---

def e(tekst):
    return html.escape(tekst, quote=True)


def sorteringsnøgle(ord_):
    """Dansk alfabetisk orden: tal først, æ, ø og å efter z, andre accenter som grundbogstavet."""
    s = ord_.lower().replace('æ', '{').replace('ø', '|').replace('å', '}')
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    return re.sub(r'[^0-9a-z{|} ]', '', s), ord_


def bogstav(ord_):
    først = sorteringsnøgle(ord_)[0].lstrip()[:1]
    if not først or først.isdigit():
        return 'tal'
    return {'{': 'æ', '|': 'ø', '}': 'å'}.get(først, først)


def søgetekst(o, ekstra):
    dele = [o['ord'], *o['alternative'], o['engelsk'], o.get('forkortelse', ''), *ekstra]
    tekst = ' '.join(d for d in dele if d).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[‐-―]', '-', tekst)).strip()


def label(da, en):
    return f'<span data-en="{e(en)}">{e(da)}</span>'


def scoring_for_opslag(links, ids, scoring_html):
    """{opslagets id: (anker, overskrift)} ud fra tabellen; overskriften er den, der står ved ankeret på scoringssiden."""
    ud = {}
    for række in links:
        opslag, anker = række['opslag'], række['anker']
        if opslag not in ids:
            raise OrdbogFejl(f'tools/data/ordbog-scoring.json: opslaget "{opslag}" findes ikke i ordbogen')
        m = re.search(rf'\sid="{re.escape(anker)}"', scoring_html)
        if not m:
            raise OrdbogFejl(f'tools/data/ordbog-scoring.json: ankeret "#{anker}" findes ikke på scoring/index.html')
        # Overskriften ved ankeret: elementet selv, eller den overskrift, der følger lige efter (afsnittenes ekstra ankre)
        h = re.compile(r'<h[23][^>]*>(.*?)</h[23]>', re.S).search(scoring_html, scoring_html.rfind('<', 0, m.start()))
        tekst = re.sub(r'<span class="nr">.*?</span>', '', h.group(1))
        ud[opslag] = (anker, html.unescape(re.sub(r'<[^>]+>', '', tekst)).strip())
    return ud


def opslag_html(o, ord_for_id, ekstra, scoring=None):
    meta = [f'{label("Engelsk", "English")}: <span lang="en">{e(o["engelsk"])}</span>']
    if o['alternative']:
        meta.append(f'{label("Alternative termer", "Alternative terms")}: {e(", ".join(o["alternative"]))}')
    if o.get('forkortelse'):
        meta.append(f'{label("Forkortelse", "Abbreviation")}: {e(o["forkortelse"])}')
    meta.append(f'{label("Niveau", "Level")}: {e(o["niveau"])}')
    meta.append(f'{label("Kategori", "Category")}: {e(o["kategori"])}')
    if o['systemafhaengig']:
        meta.append(f'{label("Systemafhængig", "System-dependent")}: {label("Ja", "Yes")}')
    linjer = [
        f'<article class="entry" id="{e(o["id"])}" data-search="{e(søgetekst(o, ekstra))}" '
        f'data-kategori="{e(o["kategori"])}" data-niveau="{e(o["niveau"])}">',
        f'<h3>{e(o["ord"])}</h3>',
        f'<p class="meta">{" · ".join(meta)}</p>',
        f'<p class="def">{e(o["definition"])}</p>',
    ]
    if o['forklaring'].strip() != o['definition'].strip():
        linjer.append(f'<p class="expl">{e(o["forklaring"])}</p>')
    if o['relaterede']:
        links = ', '.join(f'<a href="#{e(m)}">{e(ord_for_id[m])}</a>' for m in o['relaterede'])
        linjer.append(f'<p class="rel">{label("Relaterede begreber", "Related terms")}: {links}</p>')
    if scoring:
        anker, titel = scoring
        linjer.append(f'<p class="scoring">{label("I Scoring i bridge", "In Scoring in bridge")}: '
                      f'<a href="/scoring/#{e(anker)}">{e(titel)}</a></p>')
    linjer.append('</article>')
    return '\n'.join(linjer)


def knapper(navn, værdier, antal):
    ud = [f'<button type="button" class="filter" data-filter="{navn}" data-value="" aria-pressed="true" data-en="All">Alle</button>']
    for v in værdier:
        ud.append(f'<button type="button" class="filter" data-filter="{navn}" data-value="{e(v)}" aria-pressed="false">'
                  f'{e(v)} <span class="n">{antal[v]}</span></button>')
    return '\n'.join(ud)


ADRESSE = 'https://www.kontraktbridge.dk/ordbog/'


def struktureret_data(opslag, ekstra):
    """schema.org DefinedTermSet med et DefinedTerm pr. opslag (JSON-LD i sidens head)."""
    def andre_navne(o):
        navne = [o['engelsk'], *ekstra.get(o['id'], []), *o['alternative'], o.get('forkortelse', '')]
        return [x for i, x in enumerate(navne) if x and x != o['ord'] and x not in navne[:i]]

    data = {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': ADRESSE + '#ordbog',
        'name': 'Bridgeordbog',
        'description': f'{len(opslag)} bridgeord på dansk med engelsk oversættelse.',
        'url': ADRESSE,
        'inLanguage': 'da',
        'hasDefinedTerm': [
            {
                '@type': 'DefinedTerm',
                '@id': ADRESSE + '#' + o['id'],
                'name': o['ord'],
                'description': o['definition'],
                'url': ADRESSE + '#' + o['id'],
                'inDefinedTermSet': ADRESSE + '#ordbog',
                **({'alternateName': andre_navne(o)} if andre_navne(o) else {}),
            }
            for o in opslag
        ],
    }
    tekst = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return f'<script type="application/ld+json">{tekst}</script>'


def render(ordbog, scoring):
    opslag = sorted(ordbog['opslag'], key=lambda o: sorteringsnøgle(o['ord']))
    ord_for_id = {o['id']: o['ord'] for o in opslag}
    ekstra = {}
    for række in ordbog['indeks']:
        ekstra.setdefault(række['id'], []).append(række['engelsk'])
    kategorier = [k for k in ordbog['kategorier'] if any(o['kategori'] == k for o in opslag)]
    kategorier += sorted({o['kategori'] for o in opslag} - set(kategorier))
    niveauer = [n for n in NIVEAUER if any(o['niveau'] == n for o in opslag)]
    niveauer += sorted({o['niveau'] for o in opslag} - set(niveauer))
    antal = {}
    for o in opslag:
        antal[o['kategori']] = antal.get(o['kategori'], 0) + 1
        antal[o['niveau']] = antal.get(o['niveau'], 0) + 1

    grupper = {}
    for o in opslag:
        grupper.setdefault(bogstav(o['ord']), []).append(o)
    alfabet = ['tal', *'abcdefghijklmnopqrstuvwxyz', 'æ', 'ø', 'å']
    spring = []
    for b in alfabet:
        tekst = '1–9' if b == 'tal' else b.upper()
        if b in grupper:
            spring.append(f'<a href="#bogstav-{b}">{tekst}</a>')
        elif b != 'tal':
            spring.append(f'<span aria-hidden="true">{tekst}</span>')
    afsnit = []
    for b in alfabet:
        if b not in grupper:
            continue
        overskrift = '1–9' if b == 'tal' else b.upper()
        afsnit.append(f'<section class="letter" id="bogstav-{b}" aria-label="{overskrift}">\n<h2>{overskrift}</h2>\n'
                      + '\n'.join(opslag_html(o, ord_for_id, ekstra.get(o['id'], []), scoring.get(o['id'])) for o in grupper[b])
                      + '\n</section>')
    indeks = '\n'.join(f'<li><span lang="en">{e(r["engelsk"])}</span> → <a href="#{e(r["id"])}">{e(r["dansk"])}</a></li>'
                       for r in ordbog['indeks'])
    n = len(opslag)
    return (SKABELON
            .replace('{{ANTAL}}', str(n))
            .replace('{{SPRING}}', '\n'.join(spring))
            .replace('{{KATEGORIER}}', knapper('kategori', kategorier, antal))
            .replace('{{NIVEAUER}}', knapper('niveau', niveauer, antal))
            .replace('{{OPSLAG}}', '\n'.join(afsnit))
            .replace('{{INDEKS}}', indeks)
            .replace('{{STRUKTUR}}', struktureret_data(opslag, ekstra)))


def byg(tekst, scoringslinks=None, scoringsside=None):
    """Siden fra kilden. scoringslinks og scoringsside er tabellen og scoring/index.html; uden dem læses filerne."""
    ordbog = parse(tekst)
    valider(ordbog)
    if scoringslinks is None:
        scoringslinks = json.loads(SCORING_TABEL.read_text(encoding='utf-8'))['links']
    if scoringsside is None:
        scoringsside = SCORING_SIDE.read_text(encoding='utf-8')
    scoring = scoring_for_opslag(scoringslinks, {o['id'] for o in ordbog['opslag']}, scoringsside)
    return render(ordbog, scoring)


def main():
    try:
        side = byg(KILDE.read_text(encoding='utf-8'))
    except OrdbogFejl as fejl:
        print(f'Fejl i {KILDE.relative_to(ROD)}: {fejl}', file=sys.stderr)
        return 1
    SIDE.write_text(side, encoding='utf-8', newline='\n')
    print(f'{SIDE.relative_to(ROD)}: {side.count("<article ")} opslag')
    return 0


SKABELON = '''<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bridgeordbog – Kontraktbridge</title>
<meta name="description" content="{{ANTAL}} bridgeord på dansk med engelsk oversættelse, kort definition og alternative termer. Søg på dansk eller engelsk.">
<meta name="theme-color" content="#1a1a1a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="https://www.kontraktbridge.dk/ordbog/">
<meta property="og:type" content="website">
<meta property="og:locale" content="da_DK">
<meta property="og:site_name" content="Kontraktbridge">
<meta property="og:title" content="Bridgeordbog – Kontraktbridge">
<meta property="og:description" content="{{ANTAL}} bridgeord på dansk med engelsk oversættelse.">
<meta property="og:url" content="https://www.kontraktbridge.dk/ordbog/">
{{STRUKTUR}}
<link rel="stylesheet" href="../fonts/tekst.css">
<link rel="stylesheet" href="../fonts/symboler.css">
<style>
/* Bygget af tools/build_ordbog.py fra ordbog/Dansk_bridgeordbog.md; ret aldrig i hånden.
   Samme farver, skrift, topbjælke og sidefod som forsiden og Om mig (Subtle Gradient). */
:root{
  color-scheme: light;
  --primary:#ff9f4a; --on-primary:#1a1a1a; --primary-active:#ffc48f; --primary-pale:#fff1e3;
  --ink:#1a1a1a; --body:#4a4a4a; --canvas:#ffffff; --canvas-soft:#f2f3f4;
  --eyebrow:#8f4c0a; --muted:#6b6f75; --grey:#9aa0a6; --soft-text:#c9cdd2; --line:#e2e4e7;
  --display:Manrope, Inter, system-ui, sans-serif;
  --sans:Inter, system-ui, -apple-system, "Segoe UI", "Noto Sans Symbols 2", "Segoe UI Symbol", sans-serif;
  --r-md:12px; --r-lg:16px; --r-xl:24px; --r-pill:9999px;
}
*,*::before,*::after{ box-sizing:border-box; }
html{ -webkit-text-size-adjust:100%; scroll-behavior:smooth; scroll-padding-top:16px; }
body{ margin:0; background:var(--canvas-soft); color:var(--ink); font:16px/1.5 var(--sans); }
a{ color:var(--ink); }
a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible{ outline:2px solid var(--ink); outline-offset:3px; border-radius:var(--r-md); }
[hidden]{ display:none !important; }

/* topbjælke i fuld bredde som på Om mig, med sprogknappen fra forsiden */
.bar{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 20px; padding:12px clamp(16px,3vw,40px);
  background:var(--ink); color:var(--canvas-soft); font-size:14px; line-height:20px; font-weight:600; }
.brand{ display:inline-flex; align-items:center; gap:12px; color:#fff; text-decoration:none; font:800 20px/1 var(--display); letter-spacing:-.01em; }
.logo{ display:inline-flex; align-items:center; justify-content:center; flex:none; width:40px; height:40px; border-radius:10px; background:var(--primary); color:var(--ink); font:800 14px/1 var(--display); letter-spacing:-.02em; }
.nav-links{ display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
.nav-links a{ color:var(--canvas-soft); text-decoration:none; padding:10px 14px; border-radius:var(--r-pill); }
.nav-links a:hover{ background:rgba(255,255,255,.08); }
.bar a:focus-visible, .bar button:focus-visible{ outline-color:var(--primary); }
.lang{ margin-left:6px; min-height:40px; padding:0 16px; border:0; border-radius:var(--r-pill); background:transparent;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.3); color:var(--canvas-soft); font:inherit; cursor:pointer; }
.lang:hover{ background:rgba(255,255,255,.08); }

.ord{ max-width:1200px; margin:0 auto; padding:56px clamp(16px,3vw,40px) 48px; display:flex; flex-direction:column; gap:40px; }
.ord-eyebrow{ font-size:14px; line-height:20px; font-weight:600; color:var(--eyebrow); }
.ord h1{ margin:10px 0 18px; font:800 clamp(40px,6vw,64px)/.95 var(--display); letter-spacing:-.02em; }
.ord-lead{ margin:0; max-width:620px; font-size:19px; line-height:30px; color:#3a3a3a; }

/* søgning, filtre og A–Å */
.tools{ display:flex; flex-direction:column; gap:16px; padding:24px; border-radius:var(--r-xl); background:var(--canvas); box-shadow:inset 0 0 0 1px var(--line); }
.search{ display:flex; flex-direction:column; gap:6px; font-size:14px; font-weight:600; }
.search input{ width:100%; min-height:48px; padding:10px 16px; border:0; border-radius:var(--r-pill); background:var(--canvas-soft);
  box-shadow:inset 0 0 0 1px var(--line); color:var(--ink); font:16px/1.5 var(--sans); }
.filters{ display:flex; flex-direction:column; gap:10px; }
.filter-row{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0; padding:0; border:0; }
.filter-row legend{ float:left; margin-right:4px; font-size:14px; font-weight:600; color:var(--body); }
.filter{ min-height:40px; padding:6px 14px; border:0; border-radius:var(--r-pill); background:var(--canvas-soft); color:var(--ink);
  box-shadow:inset 0 0 0 1px var(--line); font:600 14px/20px var(--sans); cursor:pointer; text-align:left; }
.filter .n{ font-weight:400; color:var(--muted); }
.filter[aria-pressed="true"]{ background:var(--primary-pale); box-shadow:inset 0 0 0 2px var(--ink); }
.az{ display:flex; flex-wrap:wrap; gap:4px; font-weight:600; }
.az a, .az span{ display:inline-flex; align-items:center; justify-content:center; min-width:36px; min-height:36px; border-radius:var(--r-md); }
.az a{ text-decoration:none; background:var(--canvas-soft); }
.az a:hover{ background:var(--primary-pale); }
.az span{ color:var(--grey); }
.count{ margin:0; font-size:14px; color:var(--body); }

/* opslagene */
.letter{ display:flex; flex-direction:column; gap:16px; }
.letter h2{ margin:8px 0 0; font:800 32px/1 var(--display); }
.entry{ padding:20px 24px; border-radius:var(--r-xl); background:var(--canvas); box-shadow:inset 0 0 0 1px var(--line); overflow-wrap:anywhere; }
.entry:target{ box-shadow:inset 0 0 0 2px var(--ink); }
.entry h3{ margin:0 0 6px; font-size:22px; line-height:28px; font-weight:600; letter-spacing:-.4px; }
.entry p{ margin:8px 0 0; }
.entry .meta{ margin:0; font-size:13px; line-height:20px; color:var(--muted); }
.entry .meta span[data-en]{ font-weight:600; }
.entry .def{ color:var(--ink); }
.entry .expl{ color:var(--body); }
.entry .rel, .entry .scoring{ font-size:14px; color:var(--body); }
.empty{ margin:0; padding:24px; border-radius:var(--r-xl); background:var(--canvas); font-weight:600; }

/* indekset */
.idx{ padding:20px 24px; border-radius:var(--r-xl); background:var(--canvas); box-shadow:inset 0 0 0 1px var(--line); }
.idx summary{ cursor:pointer; font:800 24px/1.2 var(--display); }
.idx ul{ columns:2 260px; gap:32px; margin:16px 0 0; padding:0; list-style:none; font-size:15px; line-height:24px; overflow-wrap:anywhere; }
.idx li{ break-inside:avoid; }

/* sidefod som på alle sider (SPEC-om-mig.md og SPEC-sprog-og-ordbog.md) */
.footer{ display:flex; flex-direction:column; gap:28px; padding:40px 32px; background:var(--ink); color:var(--canvas-soft); border-radius:var(--r-xl); font-size:15px; line-height:22px; }
.footer-top{ display:flex; flex-wrap:wrap; justify-content:space-between; gap:32px 56px; }
.footer-about{ display:flex; flex-direction:column; align-items:flex-start; gap:12px; max-width:340px; }
.footer-about p{ margin:0; color:var(--soft-text); }
.footer-col{ display:flex; flex-direction:column; gap:10px; min-width:150px; }
.footer .footer-title{ margin:0 0 2px; font:600 12px/16px var(--sans); letter-spacing:.08em; text-transform:uppercase; color:var(--grey); }
.footer-col ul{ display:flex; flex-direction:column; gap:10px; margin:0; padding:0; list-style:none; }
.footer a{ color:#fff; text-decoration:underline; text-decoration-color:rgba(255,255,255,.35); text-underline-offset:4px; }
.footer a:hover{ color:var(--primary-active); text-decoration-color:currentColor; }
.footer a.brand{ text-decoration:none; }
.footer a.footer-cta{ display:inline-flex; align-items:center; gap:8px; min-height:44px; padding:0 18px; border-radius:var(--r-pill);
  background:var(--primary); color:var(--on-primary); font-weight:600; text-decoration:none; }
.footer a.footer-cta:hover{ background:#ffb46e; color:var(--on-primary); }
.footer a:focus-visible{ outline-color:var(--primary); }
.legal{ padding-top:20px; border-top:1px solid var(--body); font-size:12px; line-height:16px; color:var(--grey); }

@media (max-width:760px){
  .ord{ padding-top:32px; gap:32px; }
  .ord-lead{ font-size:17px; line-height:27px; }
  .tools{ padding:20px 16px; }
  .entry, .idx{ padding:18px 16px; }
  .footer{ padding:28px 20px; }
}
</style>
</head>
<body>

<nav class="bar" aria-label="Hovedmenu" data-en-aria="Main menu">
  <a class="brand" href="/"><span class="logo" aria-hidden="true">7NT</span>Kontraktbridge</a>
  <div class="nav-links">
    <a href="/#traenere" data-en="Trainers">Trænere</a>
    <a href="/om-mig/" data-en="About me and contact">Om mig og kontakt</a>
    <button class="lang" id="langBtn" type="button" lang="en">English</button>
  </div>
</nav>

<main class="ord">
  <header>
    <span class="ord-eyebrow" data-en="Reference">Opslag</span>
    <h1 data-en="Bridge dictionary">Bridgeordbog</h1>
    <p class="ord-lead" data-en="{{ANTAL}} bridge terms in Danish with English translations. The entries are in Danish.">{{ANTAL}} bridgeord på dansk med engelsk oversættelse.</p>
  </header>

  <section class="tools" aria-label="Søg og filtrér" data-en-aria="Search and filter">
    <label class="search"><span data-en="Search in Danish or English">Søg på dansk eller engelsk</span>
      <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="Fx kipning, finesse eller bordet" data-en-placeholder="E.g. finesse, kipning or dummy">
    </label>
    <div class="filters">
      <fieldset class="filter-row"><legend data-en="Category">Kategori</legend>
{{KATEGORIER}}
      </fieldset>
      <fieldset class="filter-row"><legend data-en="Level">Niveau</legend>
{{NIVEAUER}}
      </fieldset>
    </div>
    <nav class="az" aria-label="Spring til bogstav" data-en-aria="Jump to letter">
{{SPRING}}
    </nav>
    <p class="count" id="antal" aria-live="polite">{{ANTAL}} opslag</p>
  </section>

  <p class="empty" id="ingen" hidden data-en="No entries match">Ingen opslag passer</p>

<!-- opslag -->
{{OPSLAG}}

<details class="idx" id="engelsk-dansk">
<summary data-en="English–Danish index">Engelsk–dansk indeks</summary>
<ul>
{{INDEKS}}
</ul>
</details>
<!-- /opslag -->

  <footer class="footer">
    <div class="footer-top">
      <div class="footer-about">
        <a class="brand" href="/"><span class="logo" aria-hidden="true">7NT</span>Kontraktbridge</a>
        <p data-en="Free bridge training in the browser. Made by Frank Pedersen.">Gratis bridgetræning i browseren. Lavet af Frank Pedersen.</p>
        <a class="footer-cta" href="/om-mig/" data-en="About me and contact &lt;span aria-hidden=&quot;true&quot;&gt;→&lt;/span&gt;">Om mig og kontakt <span aria-hidden="true">→</span></a>
      </div>
      <nav class="footer-col" aria-labelledby="footer-traenere">
        <h2 class="footer-title" id="footer-traenere" data-en="Trainers">Trænere</h2>
        <ul>
          <li><a href="/konventionstraener/" data-en="Convention trainer">Konventionstræner</a></li>
          <li><a href="/fordelingstraeneren/" data-en="Distribution">Fordeling</a></li>
          <li><a href="/fordelingstraeneren/" data-en="Point count">Pointregnskab</a></li>
          <li><a href="/fordelingstraeneren/" data-en="Suit combinations">Farvebehandling</a></li>
          <li><a href="/fordelingstraeneren/" data-en="Hand evaluation">Håndevaluering</a></li>
          <li><a href="/fordelingstraeneren/#analyse" data-en="Analysis">Analyse</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-labelledby="footer-opslag">
        <h2 class="footer-title" id="footer-opslag" data-en="Reference">Opslag</h2>
        <ul>
          <li><a href="/ordbog/" data-en="Bridge dictionary">Bridgeordbog</a></li>
          <li><a href="/scoring/" data-en="Scoring in bridge">Scoring i bridge</a></li>
        </ul>
      </nav>
    </div>
    <div class="legal">© 2026 Frank Pedersen</div>
  </footer>
</main>

<script>
/* Sprog som på forsiden: dansk som standard, engelsk med knappen; valget gemmes under 'lang', og ?lang=en eller
   ?lang=da virker også. Sidens faste tekster har data-en; opslagene er kun på dansk. */
(function () {
  var lang = 'da';
  try { if (localStorage.getItem('lang') === 'en') lang = 'en'; } catch (e) {}
  var q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'da') { lang = q; try { localStorage.setItem('lang', q); } catch (e) {} }
  var EN = lang === 'en';
  document.documentElement.lang = lang;
  if (EN) {
    document.title = 'Bridge dictionary – Kontraktbridge';
    document.querySelectorAll('[data-en]').forEach(function (el) { el.innerHTML = el.getAttribute('data-en'); });
    document.querySelectorAll('[data-en-aria]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-en-aria')); });
    document.querySelectorAll('[data-en-placeholder]').forEach(function (el) { el.setAttribute('placeholder', el.getAttribute('data-en-placeholder')); });
  }
  var btn = document.getElementById('langBtn');
  btn.textContent = EN ? 'Dansk' : 'English';
  btn.setAttribute('lang', EN ? 'da' : 'en');
  btn.addEventListener('click', function () {
    var u = new URL(location.href);
    u.searchParams.delete('lang');
    try { localStorage.setItem('lang', EN ? 'da' : 'en'); } catch (e) { u.searchParams.set('lang', EN ? 'da' : 'en'); }
    location.href = u.toString();
  });

  /* Søgning og filtre: søgefeltet ser på opslagsord, alternative termer og engelsk (data-search), mens man skriver;
     kategori og niveau vælges med knapperne. */
  var input = document.getElementById('q');
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));
  var letters = Array.prototype.slice.call(document.querySelectorAll('.letter'));
  var count = document.getElementById('antal');
  var none = document.getElementById('ingen');
  var index = document.getElementById('engelsk-dansk');
  var chosen = { kategori: '', niveau: '' };
  function norm(s) { return s.toLowerCase().replace(/[\\u2010-\\u2015]/g, '-').replace(/\\s+/g, ' ').trim(); }
  function apply() {
    var text = norm(input.value);
    var shown = 0;
    entries.forEach(function (el) {
      var ok = (!text || el.getAttribute('data-search').indexOf(text) >= 0)
        && (!chosen.kategori || el.getAttribute('data-kategori') === chosen.kategori)
        && (!chosen.niveau || el.getAttribute('data-niveau') === chosen.niveau);
      el.hidden = !ok;
      if (ok) shown++;
    });
    letters.forEach(function (sec) { sec.hidden = !sec.querySelector('.entry:not([hidden])'); });
    none.hidden = shown > 0;
    index.hidden = !!(text || chosen.kategori || chosen.niveau);
    count.textContent = shown + (EN ? (shown === 1 ? ' entry' : ' entries') : ' opslag');
  }
  input.addEventListener('input', apply);
  document.querySelectorAll('.filter').forEach(function (b) {
    b.addEventListener('click', function () {
      var kind = b.getAttribute('data-filter');
      chosen[kind] = b.getAttribute('data-value');
      document.querySelectorAll('.filter[data-filter="' + kind + '"]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      apply();
    });
  });
  if (EN) count.textContent = entries.length + ' entries';
})();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    sys.exit(main())
