"""Bygger siden Scoring i bridge, scoring/index.html, fra scoring/Scoring_i_bridge.md og den engelske udgave
scoring/Scoring_i_bridge.en.md (SPEC-scoring.md).

    python tools/build_scoring.py                                # skriver scoring/index.html
    python tools/build_scoring.py --kilde - --en STI --ud -      # dansk fra stdin, siden til stdout (bruges af testene)

index.html rettes aldrig i hånden. Markdownfilerne er Franks tekst; scriptet kender to markører i dem:
<!-- beregner: score|matchpoint|imp|handicap --> indsætter en beregner, og <!-- fold: Titel --> … <!-- /fold --> gør
indholdet til en foldbar boks. Scriptet stopper med en fejl ved dobbelte id'er, en ukendt markør og en foldboks uden
slutmarkør. Afsnit 7 vises ikke; det giver beregnerlinjen øverst. Beregnerne regner med scoring/beregn.js; siden henter
intet uden for sitet.

Den danske tekst står i siden; den engelske tekst og indholdsfortegnelse står i hver sin <template>, som sprogscriptet
sætter ind, når sproget er engelsk (leverancetrin 3). Ankrene er de samme på begge sprog: de engelske overskrifter får
den danske fils id'er, overskrift for overskrift i samme rækkefølge. Derfor stopper scriptet, hvis de to filer ikke har
samme afsnit, samme antal underoverskrifter i hvert afsnit og de samme markører i samme rækkefølge. Kildeafsnittet
hedder Kilder på dansk og Sources på engelsk, og det engelske afsnit 7 bruger beregnernes engelske navne fra BEREGNERE.
"""
import html
import pathlib
import re
import sys

ROD = pathlib.Path(__file__).resolve().parent.parent
KILDE = ROD / 'scoring' / 'Scoring_i_bridge.md'
KILDE_EN = ROD / 'scoring' / 'Scoring_i_bridge.en.md'
SIDE = ROD / 'scoring' / 'index.html'


class ScoringFejl(Exception):
    pass


BEREGNERE = {
    'score': ('Scoreberegner', 'Score calculator'),
    'matchpoint': ('Matchpointregner', 'Matchpoint calculator'),
    'imp': ('Imp- og kamppointomregner', 'IMP and VP converter'),
    'handicap': ('Handicapberegner', 'Handicap calculator'),
}

# Tekster i afsnittene, som ikke står i markdownfilerne
ORD = {
    'da': {'kilder': 'kilder', 'nysgerrige': 'For de nysgerrige', 'videre': 'Videre', 'næste': 'Næste:', 'top': 'Til toppen', 'navn': 0},
    'en': {'kilder': 'sources', 'nysgerrige': 'For the curious', 'videre': 'Next', 'næste': 'Next:', 'top': 'Back to top', 'navn': 1},
}


def e(tekst):
    return html.escape(tekst, quote=True)


def slug(tekst):
    """Stabilt id ud fra en overskrift: uden nummer og parentes, delen før kolon, æ ø å som ae oe aa."""
    t = re.sub(r'^\d+\s+', '', tekst)
    t = re.sub(r'\([^)]*\)', '', t).split(':')[0]
    t = t.lower().replace('æ', 'ae').replace('ø', 'oe').replace('å', 'aa')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def inline(tekst):
    t = html.escape(tekst, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\*([^*\n]+?)\*', r'<em>\1</em>', t)
    return re.sub(r'[♥♦]', lambda m: f'<span class="r">{m.group(0)}</span>', t)


class Id:
    """Sidens id'er. Et underpunkt, hvis id allerede findes, får afsnittets id foran; ellers er et dobbelt id en fejl."""

    def __init__(self):
        self.brugt = set()

    def tag(self, id_, kilde):
        if id_ in self.brugt:
            raise ScoringFejl(f'Dobbelt id "{id_}" ({kilde})')
        self.brugt.add(id_)
        return id_

    def underpunkt(self, tekst, afsnit):
        s = slug(tekst)
        return self.tag(f'{afsnit}-{s}' if s in self.brugt else s, tekst)


def tabel(rækker):
    hoved, *krop = rækker
    krop = [r for r in krop if not all(re.fullmatch(r':?-+:?', c) for c in r)]
    th = ''.join(f'<th scope="col">{inline(c)}</th>' for c in hoved)
    tr = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in krop)
    return f'<div class="tabel"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


def indhold(linjer, afsnit, ids, beregnere, sprog, faste=None):
    """HTML for et afsnits linjer og listen over dets underpunkter [(id, titel)]. Med faste (de danske id'er) får
    underoverskrifterne dem i rækkefølge i stedet for nye."""
    ud, punkter, i, fold = [], [], 0, None
    while i < len(linjer):
        ln = linjer[i]
        s = ln.strip()
        if not s or s == '---':
            i += 1
            continue
        if s.startswith('<!--'):
            m = re.fullmatch(r'<!--\s*beregner:\s*([\w-]+)\s*-->', s)
            f = re.fullmatch(r'<!--\s*fold:\s*(.+?)\s*-->', s)
            if m:
                if m.group(1) not in BEREGNERE:
                    raise ScoringFejl(f'Ukendt beregnermarkør: {s}')
                ids.tag(f'beregner-{m.group(1)}', s)
                beregnere.append(m.group(1))
                ud.append(BEREGNER_HTML[m.group(1)])
            elif f:
                if fold:
                    raise ScoringFejl(f'Foldboksen "{fold}" mangler sin slutmarkør, før "{f.group(1)}" begynder')
                fold = f.group(1)
                ud.append(f'<details class="fold"><summary><span class="fold-k">{ORD[sprog]["nysgerrige"]}</span> '
                          f'{inline(fold)}</summary><div class="fold-indhold">')
            elif re.fullmatch(r'<!--\s*/fold\s*-->', s):
                if not fold:
                    raise ScoringFejl('Slutmarkør uden foldboks: <!-- /fold -->')
                ud.append('</div></details>')
                fold = None
            else:
                raise ScoringFejl(f'Ukendt markør: {s}')
            i += 1
            continue
        if ln.startswith('### '):
            titel = ln[4:].strip()
            id_ = ids.tag(faste.pop(0), titel) if faste is not None else ids.underpunkt(titel, afsnit)
            punkter.append((id_, titel))
            ud.append(f'<h3 id="{id_}">{inline(titel)}</h3>')
            i += 1
            continue
        if ln.startswith('#'):
            raise ScoringFejl(f'Uventet overskrift i afsnit "{afsnit}": {ln}')
        if s.startswith('|'):
            rækker = []
            while i < len(linjer) and linjer[i].strip().startswith('|'):
                rækker.append([c.strip() for c in linjer[i].strip().strip('|').split('|')])
                i += 1
            ud.append(tabel(rækker))
            continue
        if re.match(r'(- |\d+\. )', s):
            tag = 'ol' if s[0].isdigit() else 'ul'
            punkter_ = []
            while i < len(linjer) and re.match(r'(- |\d+\. )', linjer[i].strip()):
                punkter_.append(re.sub(r'^(- |\d+\. )', '', linjer[i].strip()))
                i += 1
            ud.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in punkter_) + f'</{tag}>')
            continue
        afsnit_ = []
        while i < len(linjer) and linjer[i].strip() and not re.match(r'(#|\||- |\d+\. |<!--|---$)', linjer[i].strip()):
            afsnit_.append(linjer[i].strip())
            i += 1
        ud.append(f'<p>{inline(" ".join(afsnit_))}</p>')
    if fold:
        raise ScoringFejl(f'Foldboksen "{fold}" mangler sin slutmarkør <!-- /fold -->')
    return '\n'.join(ud), punkter


def læs(md, sprog='da'):
    """(titel, indledning, afsnit [(nummer, titel, linjer)], afsnit 7's linjer, kildernes linjer)."""
    titel, indledning, afsnit, nu = None, [], [], None
    for ln in md.replace('\r\n', '\n').split('\n'):
        if ln.startswith('# '):
            titel = ln[2:].strip()
            continue
        if ln.startswith('## '):
            m = re.match(r'##\s+(\d+)\s+(.+)$', ln)
            nu = [int(m.group(1)), m.group(2).strip(), []] if m else [None, ln[3:].strip(), []]
            afsnit.append(nu)
            continue
        if nu is None:
            indledning.append(ln)
        else:
            nu[2].append(ln)
    if not titel:
        raise ScoringFejl('Kilden mangler en titel (# …)')
    syv = next((a for a in afsnit if a[0] == 7), None)
    kilder = next((a for a in afsnit if a[0] is None and a[1].lower() == ORD[sprog]['kilder']), None)
    andre = [a for a in afsnit if a[0] is None and a is not kilder]
    if andre:
        raise ScoringFejl(f'Ukendt afsnit uden nummer: {andre[0][1]}')
    return titel, indledning, [a for a in afsnit if a[0] is not None and a[0] != 7], syv, kilder


def struktur(md, sprog):
    """Afsnittenes numre, antallet af underoverskrifter i hvert afsnit og markørerne i rækkefølge."""
    _, _, afsnit, _, _ = læs(md, sprog)
    markører = []
    for nr, _, linjer in afsnit:
        for ln in linjer:
            s = ln.strip()
            m = re.fullmatch(r'<!--\s*(beregner:\s*[\w-]+|fold|/fold)(?::.*?)?\s*-->', s)
            if m:
                markører.append(re.sub(r'\s+', ' ', m.group(1)))
    return [nr for nr, _, _ in afsnit], [sum(ln.startswith('### ') for ln in linjer) for _, _, linjer in afsnit], markører


def sammenlign(md_da, md_en):
    """Stopper, hvis den engelske fil ikke har samme opbygning som den danske."""
    da, en = struktur(md_da, 'da'), struktur(md_en, 'en')
    if da[0] != en[0]:
        raise ScoringFejl(f'De to filer har ikke de samme overskrifter: afsnittene {da[0]} på dansk og {en[0]} på engelsk')
    for nr, a, b in zip(da[0], da[1], en[1]):
        if a != b:
            raise ScoringFejl(f'De to filer har ikke de samme overskrifter: afsnit {nr} har {a} underoverskrifter på dansk og {b} på engelsk')
    if da[2] != en[2]:
        første = next((i for i, (a, b) in enumerate(zip(da[2], en[2])) if a != b), min(len(da[2]), len(en[2])))
        raise ScoringFejl(f'De to filer har ikke de samme markører i samme rækkefølge: nr. {første + 1} er '
                          f'"{(da[2] + ["ingen"])[første]}" på dansk og "{(en[2] + ["ingen"])[første]}" på engelsk')


def tekst(md, sprog, plan=None):
    """En sprogudgave af sidens tekst: titel, indledning, indholdsfortegnelse, afsnit med kilder, beregnernes navne i
    afsnit 7 og planen (afsnittenes og underoverskrifternes id'er), som den engelske udgave bruger."""
    o = ORD[sprog]
    titel, indledning, afsnit, syv, kilder = læs(md, sprog)
    ids = Id()
    ids.tag('top', 'toppen')
    ids.tag('indhold', 'indholdsfortegnelsen')
    beregnere = []
    # Indledningen: linjen med dato og version står kun i kilden; resten er sidens indledning.
    linjer = [ln for ln in indledning if ln.strip() and ln.strip() != '---']
    lead = ' '.join(ln.strip() for ln in linjer if '·' not in ln)

    ny_plan, sektioner, toc = [], [], []
    for k, (nr, overskrift, linjer_) in enumerate(afsnit):
        if plan is None:
            id_ = ids.tag(slug(overskrift), overskrift)
            alias = None
            if ':' in overskrift:
                a = slug(overskrift.split(':', 1)[1])
                if a and a not in ids.brugt:
                    alias = ids.tag(a, overskrift)
            krop, punkter = indhold(linjer_, id_, ids, beregnere, sprog)
            ny_plan.append((id_, alias, [p for p, _ in punkter]))
        else:
            id_, alias, faste = plan[k]
            ids.tag(id_, overskrift)
            if alias:
                ids.tag(alias, overskrift)
            krop, punkter = indhold(linjer_, id_, ids, beregnere, sprog, list(faste))
        sektioner.append([nr, id_, overskrift, f'<span id="{alias}" class="alias"></span>' if alias else '', krop])
        toc.append((nr, id_, overskrift, punkter))
    for k, (nr, id_, overskrift, alias, krop) in enumerate(sektioner):
        næste = sektioner[k + 1] if k + 1 < len(sektioner) else None
        nav = (f'<nav class="afslut" aria-label="{o["videre"]}">'
               + (f'<a href="#{næste[1]}"><span>{o["næste"]}</span> {inline(næste[2])}</a>' if næste else '')
               + f'<a href="#top">{o["top"]}</a></nav>')
        sektioner[k] = (f'<section class="afsnit" aria-labelledby="{id_}">{alias}\n<h2 id="{id_}"><span class="nr">{nr}</span> '
                        f'{inline(overskrift)}</h2>\n{krop}\n{nav}\n</section>')
    mangler = [b for b in BEREGNERE if b not in beregnere]
    if mangler:
        raise ScoringFejl(f'Beregneren mangler sin markør: {", ".join(mangler)}')

    toc_html = '\n'.join(
        f'<li><a href="#{id_}"><span class="nr">{nr}</span> {inline(t)}</a>'
        + ('<ul>' + ''.join(f'<li><a href="#{p}">{inline(pt)}</a></li>' for p, pt in punkter) + '</ul>' if punkter else '')
        + '</li>' for nr, id_, t, punkter in toc)
    # Beregnerne i afsnit 7: navnene i den rækkefølge, de står der, på sprogets navne fra BEREGNERE
    navne = re.findall(r'^- \*\*(.+?)\*\*', '\n'.join(syv[2]) if syv else '', re.M)
    nøgler = []
    for navn in navne:
        nøgle = next((k for k, v in BEREGNERE.items() if v[o['navn']] == navn), None)
        if not nøgle:
            raise ScoringFejl(f'Afsnit 7 nævner en ukendt beregner: "{navn}" (navnene står i BEREGNERE)')
        nøgler.append(nøgle)
    kilder_html = ''
    if kilder:
        punkter = [re.sub(r'^- ', '', ln.strip()) for ln in kilder[2] if ln.strip().startswith('- ')]
        ids.tag('kilder', kilder[1])
        kilder_html = (f'<section class="kilder" aria-labelledby="kilder"><h2 id="kilder">{e(kilder[1])}</h2><ul>'
                       + ''.join(f'<li>{inline(p)}</li>' for p in punkter) + '</ul></section>')
    return {'titel': titel, 'lead': inline(lead), 'toc': toc_html, 'tekst': '\n'.join(sektioner) + '\n' + kilder_html,
            'beregnere': nøgler, 'plan': ny_plan if plan is None else plan}


def tjek_id(side, sprog):
    """Ingen id må stå to gange, og alle interne links skal pege på et id."""
    alle = re.findall(r'\sid="([^"]+)"', side)
    dobbelt = sorted({x for x in alle if alle.count(x) > 1})
    if dobbelt:
        raise ScoringFejl(f'Dobbelt id på siden ({sprog}): {", ".join(dobbelt)}')
    for mål in re.findall(r'href="#([^"]+)"', side):
        if mål not in alle:
            raise ScoringFejl(f'Link til et id, der ikke findes ({sprog}): #{mål}')


def byg(md, md_en):
    da = tekst(md, 'da')
    sammenlign(md, md_en)
    en = tekst(md_en, 'en', da['plan'])
    if en['beregnere'] != da['beregnere']:
        raise ScoringFejl('Afsnit 7 nævner ikke de samme beregnere i samme rækkefølge på dansk og engelsk')
    linje = '\n'.join(f'<a href="#beregner-{k}" data-en="{e(BEREGNERE[k][1])}">{e(BEREGNERE[k][0])}</a>' for k in da['beregnere'])

    def side(hoved, skabeloner):
        return (SKABELON.replace('{{TITEL}}', e(da['titel'])).replace('{{TITEL_EN}}', e(en['titel']))
                .replace('{{LEAD}}', da['lead']).replace('{{LEAD_EN}}', e(en['lead']))
                .replace('{{TOC}}', hoved['toc']).replace('{{TEKST}}', hoved['tekst'])
                .replace('{{BEREGNERLINJE}}', linje)
                .replace('{{TOC_EN}}', en['toc'] if skabeloner else '').replace('{{TEKST_EN}}', en['tekst'] if skabeloner else ''))

    # Siden, som den ser ud på hvert sprog, efter at sprogscriptet har sat den engelske tekst ind
    tjek_id(side(da, False), 'dansk')
    tjek_id(side(en, False), 'engelsk')
    return side(da, True)


def main(args):
    kilde = args[args.index('--kilde') + 1] if '--kilde' in args else None
    kilde_en = args[args.index('--en') + 1] if '--en' in args else None
    ud = args[args.index('--ud') + 1] if '--ud' in args else None
    md = sys.stdin.buffer.read().decode('utf-8') if kilde == '-' else (pathlib.Path(kilde) if kilde else KILDE).read_text(encoding='utf-8')
    md_en = (pathlib.Path(kilde_en) if kilde_en else KILDE_EN).read_text(encoding='utf-8')
    try:
        side = byg(md, md_en)
    except ScoringFejl as fejl:
        print(f'Fejl i kilden: {fejl}', file=sys.stderr)
        return 1
    if ud == '-':
        sys.stdout.buffer.write(side.encode('utf-8'))
    else:
        mål = pathlib.Path(ud) if ud else SIDE
        mål.write_text(side, encoding='utf-8', newline='\n')
        print(f'{mål.relative_to(ROD) if mål.is_relative_to(ROD) else mål}: {side.count("<section class=\"afsnit\"") // 2} afsnit på hvert sprog')
    return 0


# --- Beregnernes felter (teksterne på engelsk i data-en) ---------------------------------------------------------

def kort(nøgle, indhold_):
    da, en = BEREGNERE[nøgle]
    return (f'<div class="beregner" id="beregner-{nøgle}" role="group" aria-labelledby="beregner-{nøgle}-h">\n'
            f'<p class="beregner-k" data-en="Try it yourself">Prøv selv</p>\n'
            f'<h3 class="beregner-h" id="beregner-{nøgle}-h" data-en="{e(en)}">{e(da)}</h3>\n{indhold_}\n</div>')


def valg(navn, legend_da, legend_en, muligheder, valgt):
    knapper = ''.join(
        f'<label class="valg"><input type="radio" name="{navn}" value="{v}"{" checked" if v == valgt else ""}>'
        f'<span{f" data-en={chr(34)}{e(en)}{chr(34)}" if en else ""}>{da}</span></label>' for v, da, en in muligheder)
    return f'<fieldset class="felt-valg"><legend data-en="{e(legend_en)}">{legend_da}</legend><div class="valg-raekke">{knapper}</div></fieldset>'


BEREGNER_HTML = {
    'score': kort('score', '<form class="felter" data-beregner="score" novalidate>'
        '<label class="felt"><span data-en="Level">Trin</span><select name="trin">'
        + ''.join(f'<option{" selected" if t == 4 else ""}>{t}</option>' for t in range(1, 8)) + '</select></label>'
        + valg('farve', 'Farve', 'Strain', [('C', '♣', ''), ('D', '<span class="r">♦</span>', ''), ('H', '<span class="r">♥</span>', ''),
                                             ('S', '♠', ''), ('NT', 'Sans', 'NT')], 'S')
        + valg('dobling', 'Dobling', 'Double', [('0', 'Udoblet', 'Undoubled'), ('1', 'Doblet', 'Doubled'), ('2', 'Redoblet', 'Redoubled')], '0')
        + valg('zone', 'Zone', 'Vulnerability', [('0', 'Uden for zonen', 'Not vulnerable'), ('1', 'I zonen', 'Vulnerable')], '0')
        + '<label class="felt"><span data-en="Tricks taken">Stik</span><select name="stik">'
        + ''.join(f'<option{" selected" if s == 10 else ""}>{s}</option>' for s in range(0, 14)) + '</select></label>'
        '</form><div class="svar" aria-live="polite" data-svar="score"></div>'),
    'matchpoint': kort('matchpoint', '<form class="felter" data-beregner="matchpoint" novalidate>'
        '<fieldset class="felt-scorer"><legend data-en="NS scores on the board">NS-scorerne på spillet</legend>'
        '<div class="scorer" data-scorer></div>'
        '<button type="button" class="knap" data-tilfoej data-en="Add a score">Tilføj score</button></fieldset>'
        '<label class="felt"><span data-en="Tables in all (if results are missing)">Borde i alt (hvis der mangler resultater)</span>'
        '<input name="borde" inputmode="numeric" autocomplete="off"></label>'
        '<label class="felt-flueben"><input type="checkbox" name="oev"><span data-en="Show for EW">Vis for ØV</span></label>'
        '</form><div class="svar" aria-live="polite" data-svar="matchpoint"></div>'),
    'imp': kort('imp', '<form class="felter" data-beregner="imp" novalidate>'
        '<fieldset class="felt-gruppe"><legend data-en="IMPs">Imp</legend>'
        '<label class="felt"><span data-en="Score 1">Score 1</span><input name="s1" inputmode="numeric" autocomplete="off" value="620"></label>'
        '<label class="felt"><span data-en="Score 2 (or leave empty and enter a difference in score 1)">Score 2 (eller tom, så er score 1 forskellen)</span>'
        '<input name="s2" inputmode="numeric" autocomplete="off" value="170"></label></fieldset>'
        '<div class="svar" aria-live="polite" data-svar="imp"></div>'
        '<fieldset class="felt-gruppe"><legend data-en="Victory points">Kamppoint</legend>'
        '<label class="felt"><span data-en="IMP difference in the match">Kampens imp-forskel</span><input name="kimp" inputmode="decimal" autocomplete="off" value="20"></label>'
        '<label class="felt"><span data-en="Boards (4–128)">Antal spil (4–128)</span><input name="spil" inputmode="numeric" autocomplete="off" value="40"></label></fieldset>'
        '</form><div class="svar" aria-live="polite" data-svar="kp"></div>'),
    'handicap': kort('handicap', '<form class="felter" data-beregner="handicap" novalidate>'
        '<label class="felt"><span data-en="Handicap, player 1">Handicap, spiller 1</span><input name="h1" inputmode="decimal" autocomplete="off" value="22,00"></label>'
        '<label class="felt"><span data-en="Handicap, player 2">Handicap, spiller 2</span><input name="h2" inputmode="decimal" autocomplete="off" value="28,00"></label>'
        '<label class="felt"><span data-en="Average handicap of the event">Turneringens gennemsnitshandicap</span><input name="gennemsnit" inputmode="decimal" autocomplete="off" value="22,23"></label>'
        '<label class="felt"><span data-en="Or every player\'s handicap (replaces the average)">Eller alle spilleres handicap (erstatter gennemsnittet)</span>'
        '<textarea name="alle" rows="2" autocomplete="off"></textarea></label>'
        '<label class="felt"><span data-en="Pairs">Antal par</span><input name="par" inputmode="numeric" autocomplete="off" value="6"></label>'
        '<label class="felt"><span data-en="Boards">Antal spil</span><input name="spil" inputmode="numeric" autocomplete="off" value="30"></label>'
        + valg('opg', 'Opgørelse', 'Scoring', [('matchpoint', 'Matchpoint', 'Matchpoints'), ('imp', 'Imp', 'IMPs')], 'matchpoint')
        + '<label class="felt-flueben"><input type="checkbox" name="butler"><span data-en="Datum scoring (Butler)">Datumscore (Butler)</span></label>'
        '<label class="felt"><span data-en="Result achieved (per cent, or IMPs per board) – optional">Opnået (procent eller imp pr. spil) – valgfrit</span>'
        '<input name="opnaaet" inputmode="decimal" autocomplete="off" value="64,17"></label>'
        '</form><div class="svar" aria-live="polite" data-svar="handicap"></div>'),
}


SKABELON = r'''<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{{TITEL}} – Kontraktbridge</title>
<meta name="description" content="Sådan scores et spil bridge, og sådan sammenlignes resultaterne i par- og holdturnering: matchpoint, Butler, cross-imp, imp, kamppoint og DBf's handicap, med beregnere.">
<meta name="theme-color" content="#1a1a1a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="canonical" href="https://www.kontraktbridge.dk/scoring/">
<meta property="og:type" content="website">
<meta property="og:locale" content="da_DK">
<meta property="og:site_name" content="Kontraktbridge">
<meta property="og:title" content="{{TITEL}} – Kontraktbridge">
<meta property="og:description" content="Sådan scores et spil bridge, og sådan sammenlignes resultaterne i par- og holdturnering.">
<meta property="og:url" content="https://www.kontraktbridge.dk/scoring/">
<link rel="stylesheet" href="../fonts/tekst.css">
<link rel="stylesheet" href="../fonts/symboler.css">
<style>
/* Bygget af tools/build_scoring.py fra scoring/Scoring_i_bridge.md; ret aldrig i hånden.
   Samme farver, skrift, topbjælke og sidefod som forsiden, Om mig og ordbogen (Subtle Gradient). */
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
html{ -webkit-text-size-adjust:100%; scroll-behavior:smooth; }
body{ margin:0; background:var(--canvas-soft); color:var(--ink); font:16px/1.6 var(--sans); }
a{ color:var(--ink); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible{ outline:2px solid var(--ink); outline-offset:3px; border-radius:var(--r-md); }
[hidden]{ display:none !important; }
[id]{ scroll-margin-top:24px; }
.r{ color:#c62828; }

/* topbjælke i fuld bredde som på ordbogen, med sprogknappen */
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

.sc{ max-width:1200px; margin:0 auto; padding:56px clamp(16px,3vw,40px) 48px; display:flex; flex-direction:column; gap:40px; }
.sc-eyebrow{ font-size:14px; line-height:20px; font-weight:600; color:var(--eyebrow); }
.sc h1{ margin:10px 0 18px; font:800 clamp(40px,6vw,64px)/.95 var(--display); letter-spacing:-.02em; }
.sc-lead{ margin:0; max-width:680px; font-size:19px; line-height:30px; color:#3a3a3a; }

/* indgangskortene og beregnerlinjen */
.indgange{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-top:28px; }
.indgang{ display:flex; flex-direction:column; gap:6px; min-height:44px; padding:20px 22px; border-radius:var(--r-xl); background:var(--canvas);
  box-shadow:inset 0 0 0 1px var(--line); text-decoration:none; color:var(--ink); }
.indgang:hover{ box-shadow:inset 0 0 0 1px var(--ink); }
.indgang strong{ font:800 20px/1.2 var(--display); }
.indgang span{ font-size:14px; line-height:20px; color:var(--body); }
.beregnerlinje{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin:16px 0 0; font-size:14px; color:var(--body); }
.beregnerlinje a{ display:inline-flex; align-items:center; min-height:44px; padding:0 10px; border-radius:var(--r-pill); font-weight:600; }

/* indholdsfortegnelsen: kolonne fra 1000 px, bjælke med "Indhold ▾" under */
.layout{ display:grid; grid-template-columns:260px minmax(0,1fr); gap:32px; align-items:start; }
.toc{ position:sticky; top:16px; max-height:calc(100vh - 32px); overflow:auto; padding:18px 16px; border-radius:var(--r-xl); background:var(--canvas);
  box-shadow:inset 0 0 0 1px var(--line); font-size:14px; line-height:20px; }
.toc-knap{ display:none; }
.toc ul{ margin:0; padding:0; list-style:none; }
.toc li ul{ margin:2px 0 8px 22px; }
.toc a{ display:block; padding:5px 8px; border-radius:var(--r-md); text-decoration:none; color:var(--body); }
.toc > ul > li > a{ font-weight:600; color:var(--ink); }
.toc a:hover{ background:var(--canvas-soft); }
.toc a[aria-current="true"]{ background:var(--primary-pale); color:var(--ink); box-shadow:inset 3px 0 0 var(--primary); }
.nr{ display:inline-block; min-width:1.4em; color:var(--eyebrow); }

/* afsnittene */
.tekst{ display:flex; flex-direction:column; gap:24px; min-width:0; }
.afsnit{ padding:28px clamp(18px,3vw,36px); border-radius:var(--r-xl); background:var(--canvas); box-shadow:inset 0 0 0 1px var(--line); overflow-wrap:anywhere; }
.afsnit h2{ margin:0 0 12px; font:800 clamp(26px,3.4vw,34px)/1.1 var(--display); letter-spacing:-.015em; }
.afsnit h3{ margin:28px 0 8px; font-size:20px; line-height:28px; font-weight:600; letter-spacing:-.3px; }
.afsnit p, .afsnit li{ max-width:72ch; color:var(--body); }
.afsnit p{ margin:0 0 12px; }
.afsnit strong{ color:var(--ink); }
.afsnit ul, .afsnit ol{ margin:0 0 12px; padding-left:22px; }
.afsnit li{ margin:4px 0; }
.tabel{ max-width:100%; overflow-x:auto; margin:12px 0 18px; border-radius:var(--r-md); box-shadow:inset 0 0 0 1px var(--line); }
.tabel table{ border-collapse:collapse; min-width:100%; font-size:15px; line-height:22px; font-variant-numeric:tabular-nums; }
.tabel th, .tabel td{ padding:8px 12px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); white-space:nowrap; }
.tabel th{ background:var(--canvas-soft); font-weight:600; }
.tabel tr:last-child td{ border-bottom:0; }
.fold{ margin:12px 0 18px; border-radius:var(--r-md); background:var(--canvas-soft); }
.fold summary{ min-height:44px; padding:12px 16px; cursor:pointer; font-weight:600; }
.fold-k{ margin-right:6px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--eyebrow); }
.fold-indhold{ padding:0 16px 12px; }
.afslut{ display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px 16px; margin-top:24px; padding-top:16px; border-top:1px solid var(--line); font-size:14px; }
.afslut a{ display:inline-flex; align-items:center; gap:.35em; min-height:44px; font-weight:600; }
.kilder{ padding:20px clamp(18px,3vw,36px); font-size:13px; line-height:20px; color:var(--muted); }
.kilder h2{ margin:0 0 6px; font-size:14px; }
.kilder ul{ margin:0; padding-left:18px; }

/* beregnerne */
.beregner{ margin:20px 0 24px; padding:20px clamp(16px,2.6vw,24px); border-radius:var(--r-lg); background:var(--primary-pale); box-shadow:inset 0 0 0 1px #f5d4b3; }
.beregner-k{ margin:0; font-size:12px; letter-spacing:.06em; text-transform:uppercase; font-weight:600; color:var(--eyebrow); }
.beregner .beregner-h{ margin:4px 0 14px; font:800 22px/1.2 var(--display); }
.felter{ display:flex; flex-wrap:wrap; gap:12px 16px; align-items:flex-end; }
.felt, .felt-valg, .felt-scorer, .felt-gruppe{ display:flex; flex-direction:column; gap:6px; margin:0; padding:0; border:0; min-width:0; font-size:14px; font-weight:600; }
.felt-gruppe{ flex:1 1 100%; flex-direction:row; flex-wrap:wrap; gap:12px 16px; }
.felt-gruppe legend, .felt-scorer legend, .felt-valg legend{ padding:0; margin-bottom:6px; font-size:14px; font-weight:600; }
.felt-scorer{ flex:1 1 100%; }
.felt select, .felt input, .felt textarea, .scorer input{ min-height:44px; padding:8px 12px; border:0; border-radius:var(--r-md); background:var(--canvas);
  box-shadow:inset 0 0 0 1px #d9c4ae; color:var(--ink); font:16px/1.4 var(--sans); }
.felt textarea{ min-width:min(100%,320px); resize:vertical; }
.felt input{ width:9em; }
.felt input[aria-invalid="true"], .scorer input[aria-invalid="true"]{ box-shadow:inset 0 0 0 2px #c62828; }
.valg-raekke{ display:flex; flex-wrap:wrap; gap:6px; }
.valg{ position:relative; }
.valg input{ position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
.valg > span{ display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; padding:0 12px; border-radius:var(--r-pill);
  background:var(--canvas); box-shadow:inset 0 0 0 1px #d9c4ae; font-weight:600; }
.valg input:checked + span{ background:var(--ink); color:#fff; box-shadow:none; }
.valg input:checked + span .r{ color:#ff8a80; }
.valg input:focus-visible + span{ outline:2px solid var(--ink); outline-offset:3px; }
.felt-flueben{ display:inline-flex; align-items:center; gap:10px; min-height:44px; font-size:14px; font-weight:600; }
.felt-flueben input{ width:22px; height:22px; margin:0; }
.scorer{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
.score-linje{ display:inline-flex; align-items:center; gap:4px; }
.scorer input{ width:7em; }
.knap{ min-height:44px; padding:0 16px; border:0; border-radius:var(--r-pill); background:var(--ink); color:#fff; font:600 14px/1 var(--sans); cursor:pointer; }
.fjern{ min-width:44px; min-height:44px; border:0; border-radius:var(--r-pill); background:transparent; color:var(--body); font:600 18px/1 var(--sans); cursor:pointer; }
.fjern:hover{ background:rgba(0,0,0,.06); }
.vh{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.svar{ margin-top:16px; }
.svar:empty{ display:none; }
.svar-tal{ margin:0; font:800 32px/1.1 var(--display); }
.svar-tekst{ margin:4px 0 0; color:var(--body); }
.svar ul{ margin:8px 0 0; padding:0; list-style:none; font-variant-numeric:tabular-nums; }
.svar li{ display:flex; justify-content:space-between; gap:16px; max-width:420px; padding:4px 0; border-bottom:1px solid #f0d9c2; }
.svar .fejl{ margin:0; color:#a11; font-weight:600; }
.svar .tabel{ background:var(--canvas); }
.svar td button{ min-height:44px; padding:0 10px; border:0; border-radius:var(--r-md); background:transparent; font:600 15px/1 var(--sans); color:var(--ink); cursor:pointer; text-decoration:underline; }
.svar tr[aria-current="true"] td{ background:var(--primary-pale); }
.svar .kontrol{ margin:8px 0 0; font-weight:600; }
.svar .forklaring{ margin:8px 0 0; padding:10px 12px; border-radius:var(--r-md); background:var(--canvas); }

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

@media (max-width:999px){
  .layout{ display:block; }
  [id]{ scroll-margin-top:76px; }
  .toc{ position:sticky; top:0; z-index:5; max-height:none; overflow:visible; margin:0 calc(-1 * clamp(16px,3vw,40px)) 20px; padding:6px clamp(16px,3vw,40px);
    border-radius:0; box-shadow:0 1px 0 var(--line); }
  .toc-knap{ display:inline-flex; align-items:center; gap:6px; min-height:44px; padding:0 14px; border:0; border-radius:var(--r-pill); background:var(--canvas-soft);
    color:var(--ink); font:600 15px/1 var(--sans); cursor:pointer; }
  .toc-liste{ display:none; position:absolute; left:clamp(16px,3vw,40px); right:clamp(16px,3vw,40px); top:calc(100% + 4px); max-height:70vh; overflow:auto;
    padding:12px; border-radius:var(--r-lg); background:var(--canvas); box-shadow:0 12px 32px rgba(0,0,0,.18), inset 0 0 0 1px var(--line); }
  .toc[data-aaben] .toc-liste{ display:block; }
  .toc a{ min-height:44px; display:flex; align-items:center; }
}
@media (max-width:760px){
  .sc{ padding-top:32px; gap:28px; }
  .sc-lead{ font-size:17px; line-height:27px; }
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

<main class="sc">
  <header id="top">
    <span class="sc-eyebrow" data-en="Reference">Opslag</span>
    <h1 data-en="{{TITEL_EN}}">{{TITEL}}</h1>
    <p class="sc-lead" data-en="{{LEAD_EN}}">{{LEAD}}</p>
    <nav class="indgange" aria-label="Indgange" data-en-aria="Start here">
      <a class="indgang" href="#beregner-score"><strong data-en="Work out a score">Regn en score</strong><span data-en="Trick score, bonuses, overtricks and undertricks">Stikpoint, bonus, overstik og bet</span></a>
      <a class="indgang" href="#parturnering"><strong data-en="Pairs">Parturnering</strong><span data-en="Matchpoints, Butler and cross-IMPs">Matchpoint, Butler og cross-imp</span></a>
      <a class="indgang" href="#holdturnering"><strong data-en="Teams">Holdturnering</strong><span data-en="IMPs, victory points and board-a-match">Imp, kamppoint og board-a-match</span></a>
      <a class="indgang" href="#handicap"><strong data-en="Handicap">Handicap</strong><span data-en="The Danish federation's handicap system">DBf's handicapsystem</span></a>
    </nav>
    <p class="beregnerlinje"><span data-en="Calculators:">Beregnere:</span>
{{BEREGNERLINJE}}
    </p>
  </header>

  <div class="layout">
    <nav class="toc" id="indhold" aria-label="Indhold" data-en-aria="Contents">
      <button class="toc-knap" type="button" aria-expanded="false" aria-controls="toc-liste"><span data-en="Contents">Indhold</span> <span aria-hidden="true">▾</span></button>
      <ul class="toc-liste" id="toc-liste">
{{TOC}}
      </ul>
    </nav>
    <div class="tekst" id="tekst">
{{TEKST}}
    </div>
  </div>
  <!-- Den engelske udgave (scoring/Scoring_i_bridge.en.md); sprogscriptet sætter den ind, når sproget er engelsk -->
  <template id="toc-en">
{{TOC_EN}}
  </template>
  <template id="tekst-en">
{{TEKST_EN}}
  </template>

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
/* Sprog som på forsiden, Om mig og ordbogen: dansk som standard, engelsk med knappen; valget gemmes under 'lang', og
   ?lang=en eller ?lang=da virker også. På engelsk sættes den engelske tekst og indholdsfortegnelse ind fra deres
   <template> (SPEC-scoring.md, leverancetrin 3), før data-en-teksterne skiftes, og før beregnerne og indholdsfortegnelsen
   kobles til. Overskrifterne har de samme id'er på begge sprog, så et anker i adressen virker på begge. */
(function () {
  var lang = 'da';
  try { if (localStorage.getItem('lang') === 'en') lang = 'en'; } catch (e) {}
  var q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'da') { lang = q; try { localStorage.setItem('lang', q); } catch (e) {} }
  var EN = lang === 'en';
  document.documentElement.lang = lang;
  if (EN) {
    document.getElementById('toc-liste').replaceChildren(document.getElementById('toc-en').content.cloneNode(true));
    document.getElementById('tekst').replaceChildren(document.getElementById('tekst-en').content.cloneNode(true));
    document.title = 'Scoring in bridge – Kontraktbridge';
    document.querySelectorAll('[data-en]').forEach(function (el) { el.innerHTML = el.getAttribute('data-en'); });
    document.querySelectorAll('[data-en-aria]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-en-aria')); });
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

  /* Indholdsfortegnelsen: under 1000 px foldes listen ud med "Indhold ▾" og lukker ved valg, Escape og tryk udenfor.
     Fra 1000 px står den fast i venstre side; det afsnit, man læser, fremhæves. */
  var toc = document.getElementById('indhold');
  var knap = toc.querySelector('.toc-knap');
  function luk() { toc.removeAttribute('data-aaben'); knap.setAttribute('aria-expanded', 'false'); }
  knap.addEventListener('click', function () {
    var aaben = toc.hasAttribute('data-aaben');
    if (aaben) luk(); else { toc.setAttribute('data-aaben', ''); knap.setAttribute('aria-expanded', 'true'); }
  });
  toc.querySelectorAll('.toc-liste a').forEach(function (a) { a.addEventListener('click', luk); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && toc.hasAttribute('data-aaben')) { luk(); knap.focus(); } });
  document.addEventListener('click', function (e) { if (toc.hasAttribute('data-aaben') && !toc.contains(e.target)) luk(); });
  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-liste a'));
  var maal = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  function marker() {
    var nu = null;
    maal.forEach(function (el) { if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) nu = el; });
    links.forEach(function (a, i) { if (maal[i] === nu) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function () { marker(); }, { rootMargin: '0px 0px -60% 0px' });
    maal.forEach(function (el) { if (el) io.observe(el); });
  }
  window.addEventListener('scroll', marker, { passive: true });
  // Den engelske tekst er sat ind efter den danske; gå til ankeret i adressen igen, så det er den engelske overskrift
  if (EN && location.hash) {
    var anker = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (anker) anker.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  marker();
})();
</script>
<script type="module">
/* Beregnerne (SPEC-scoring.md, Beregnerne): al logik ligger i beregn.js; her læses felterne, og svaret skrives, mens man
   skriver. Intet gemmes. Tal skrives med decimalkomma på dansk. */
import * as B from './beregn.js';
const EN = document.documentElement.lang === 'en';
const lang = EN ? 'en' : 'da';
const T = (da, en) => (EN ? en : da);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const farv = (s) => esc(s).replace(/[♥♦]/g, (c) => `<span class="r">${c}</span>`);
const tal = (x, d = 0, plus = false) => B.tal(x, d, lang, plus);
const tilTal = (s) => {
  const t = String(s ?? '').trim().replace(/[−–]/g, '-').replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  return /^[+-]?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};
const fejl = (tekst) => `<p class="fejl">${esc(tekst)}</p>`;
function markér(input, ok) { if (ok) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true'); }
const svar = (navn) => document.querySelector(`[data-svar="${navn}"]`);
const form = (navn) => document.querySelector(`[data-beregner="${navn}"]`);
const ZONE = (z) => T(z ? 'i zonen' : 'uden for zonen', z ? 'vulnerable' : 'not vulnerable');

// Scoreberegner
function regnScore() {
  const f = form('score');
  const v = (n) => f.elements[n].value;
  const input = { trin: Number(v('trin')), farve: v('farve'), dobling: Number(v('dobling')), zone: v('zone') === '1', stik: Number(v('stik')) };
  const r = B.score(input, lang);
  if (r.fejl) { svar('score').innerHTML = fejl(r.fejl); return; }
  const strain = input.farve === 'NT' ? T(' sans', 'NT') : { C: '♣', D: '♦', H: '♥', S: '♠' }[input.farve];
  const kontrakt = farv(`${input.trin}${strain}${['', T(' doblet', ' doubled'), T(' redoblet', ' redoubled')][input.dobling]}`);
  svar('score').innerHTML = `<p class="svar-tal">${tal(r.score, 0, true)}</p>`
    + `<p class="svar-tekst">${kontrakt} ${T('med', 'with')} ${input.stik} ${T('stik', 'tricks')}, ${ZONE(input.zone)}</p>`
    + `<ul>${r.linjer.map((l) => `<li><span>${esc(l.tekst)}</span><span>${tal(l.point)}</span></li>`).join('')}</ul>`;
}

// Matchpointregner
const scorerEl = document.querySelector('[data-scorer]');
let nr = 0;
function scoreLinje(værdi = '') {
  nr++;
  const div = document.createElement('div');
  div.className = 'score-linje';
  div.innerHTML = `<label class="vh" for="mp-${nr}">${T('Score', 'Score')}</label><input id="mp-${nr}" inputmode="numeric" autocomplete="off" value="${esc(værdi)}">`
    + `<button type="button" class="fjern" aria-label="${T('Fjern scoren', 'Remove the score')}">×</button>`;
  div.querySelector('.fjern').addEventListener('click', () => {
    if (scorerEl.children.length > 1) { div.remove(); nummerér(); regnMatchpoint(); }
  });
  scorerEl.appendChild(div);
  nummerér();
}
function nummerér() {
  [...scorerEl.children].forEach((d, i) => {
    d.querySelector('label').textContent = `${T('Score', 'Score')} ${i + 1}`;
    d.querySelector('.fjern').setAttribute('aria-label', `${T('Fjern score', 'Remove score')} ${i + 1}`);
  });
  document.querySelector('[data-tilfoej]').disabled = scorerEl.children.length >= 20;
}
let valgtRække = null;
function regnMatchpoint() {
  const f = form('matchpoint');
  const inputs = [...scorerEl.querySelectorAll('input')];
  const scorer = [];
  let ugyldig = false;
  for (const i of inputs) {
    const x = tilTal(i.value);
    markér(i, x === null || Number.isFinite(x));
    if (Number.isNaN(x)) ugyldig = true; else if (x !== null) scorer.push(x);
  }
  const bordeTekst = f.elements.borde.value;
  const borde = tilTal(bordeTekst);
  markér(f.elements.borde, borde === null || (Number.isInteger(borde) && borde >= scorer.length));
  if (ugyldig) { svar('matchpoint').innerHTML = fejl(T('Skriv scorerne som hele tal, fx 420 eller −50.', 'Enter the scores as whole numbers, e.g. 420 or −50.')); return; }
  const r = B.matchpoint(scorer, { borde: borde === null ? undefined : borde, øv: f.elements.oev.checked }, lang);
  if (r.fejl) { svar('matchpoint').innerHTML = fejl(r.fejl); return; }
  const omregnet = borde !== null && borde > scorer.length;
  const metode = !omregnet ? '' : scorer.length <= 3 && (scorer.length === 1 || (scorer.length === 2 && borde >= 6) || (scorer.length === 3 && borde >= 9))
    ? T(`Omregnet til ${borde} borde efter § X78B.`, `Converted to ${borde} tables under § X78B.`)
    : T(`Omregnet til ${borde} borde med Neubergs formel.`, `Converted to ${borde} tables with Neuberg's formula.`);
  const d = (x) => (Number.isInteger(x) ? tal(x) : tal(x, 2));
  const rækker = r.rækker.map((x, i) => `<tr${valgtRække === i ? ' aria-current="true"' : ''}><td><button type="button" data-række="${i}" aria-label="${T('Vis regnestykket for', 'Show the working for')} ${tal(x.score, 0, true)}">${tal(x.score, 0, true)}</button></td>`
    + `<td>${x.slår}</td><td>${x.lige}</td><td>${x.taber}</td><td>${d(x.mp)}</td><td>${tal(x.pct, omregnet ? 1 : 0)} %</td><td>${tal(x.plusminus, 0, true)}</td></tr>`).join('');
  const valgt = valgtRække !== null && r.rækker[valgtRække];
  svar('matchpoint').innerHTML = `<div class="tabel"><table><thead><tr><th scope="col">${T('Score', 'Score')}</th><th scope="col">${T('Slår', 'Beats')}</th>`
    + `<th scope="col">${T('Lige', 'Ties')}</th><th scope="col">${T('Taber for', 'Loses to')}</th><th scope="col">2/1/0</th><th scope="col">${T('Procent', 'Per cent')}</th>`
    + `<th scope="col">+1/0/−1</th></tr></thead><tbody>${rækker}</tbody></table></div>`
    + `<p class="kontrol">${T(`Summen af +1/0/−1 er ${tal(r.sumPlusminus)}.`, `The sum of +1/0/−1 is ${tal(r.sumPlusminus)}.`)}${metode ? ' ' + esc(metode) : ''}</p>`
    + (valgt ? `<p class="forklaring">${esc(B.matchpointForklaring(valgt, lang))}${f.elements.oev.checked ? esc(T(' (ØV får det modsatte fortegn.)', ' (EW get the opposite sign.)')) : ''}</p>`
      : `<p class="svar-tekst">${T('Tryk på en score for at se regnestykket.', 'Tap a score to see the working.')}</p>`);
  svar('matchpoint').querySelectorAll('[data-række]').forEach((b) => b.addEventListener('click', () => {
    valgtRække = Number(b.dataset.række); regnMatchpoint();
    svar('matchpoint').querySelector(`[data-række="${valgtRække}"]`).focus();
  }));
}

// Imp- og kamppointomregner
function regnImp() {
  const f = form('imp');
  const s1 = tilTal(f.elements.s1.value), s2 = tilTal(f.elements.s2.value);
  markér(f.elements.s1, s1 !== null && Number.isFinite(s1));
  markér(f.elements.s2, s2 === null || Number.isFinite(s2));
  if (s1 === null || Number.isNaN(s1) || Number.isNaN(s2)) { svar('imp').innerHTML = fejl(T('Skriv to scorer eller én forskel.', 'Enter two scores or one difference.')); return; }
  const forskel = s2 === null ? s1 : s1 - s2;
  const imp = B.imp(forskel);
  const impOrd = T('imp', Math.abs(imp) === 1 ? 'IMP' : 'IMPs');
  svar('imp').innerHTML = `<p class="svar-tal">${tal(imp, 0, true)} ${impOrd}</p><p class="svar-tekst">`
    + (s2 === null ? T(`Forskellen ${tal(forskel, 0, true)}`, `A difference of ${tal(forskel, 0, true)}`)
      : `${tal(s1, 0, true)} − ${s2 < 0 ? '(' + tal(s2) + ')' : tal(s2, 0, true)} = ${tal(forskel, 0, true)}`)
    + T(' giver ', ' gives ') + `${tal(imp, 0, true)} ${impOrd}.</p>`;
}
function regnKp() {
  const f = form('imp');
  const m = tilTal(f.elements.kimp.value), spil = tilTal(f.elements.spil.value);
  markér(f.elements.kimp, m !== null && Number.isFinite(m));
  markér(f.elements.spil, Number.isInteger(spil) && spil >= 4 && spil <= 128);
  if (m === null || Number.isNaN(m)) { svar('kp').innerHTML = fejl(T('Skriv kampens imp-forskel.', 'Enter the IMP difference of the match.')); return; }
  const r = B.kp(m, spil, lang);
  if (r.fejl) { svar('kp').innerHTML = fejl(r.fejl); return; }
  const a = Math.abs(r.imp);
  const fra = Math.max(0, a - 5);
  const rækker = [];
  for (let x = fra; x <= a + 5; x++) {
    const k = B.kp(x, spil);
    rækker.push(`<tr${x === a ? ' aria-current="true"' : ''}><td>${x}</td><td>${tal(k.vinder, 2)}</td><td>${tal(k.taber, 2)}</td></tr>`);
  }
  svar('kp').innerHTML = `<p class="svar-tal">${tal(r.vinder, 2)} – ${tal(r.taber, 2)}</p>`
    + `<p class="svar-tekst">${a} ${T('imp', a === 1 ? 'IMP' : 'IMPs')} ${T('i', 'in')} ${spil} ${T('spil', 'boards')}${m !== r.imp ? T(` (${tal(m, 1)} afrundet til ${r.imp})`, ` (${tal(m, 1)} rounded to ${r.imp})`) : ''}: `
    + `${T('vinderen får', 'the winner gets')} ${tal(r.vinder, 2)} ${T('KP', 'VP')}, ${T('taberen', 'the loser')} ${tal(r.taber, 2)} ${T('KP', 'VP')}.</p>`
    + `<div class="tabel"><table><thead><tr><th scope="col">${T('Imp-forskel', 'IMP difference')}</th><th scope="col">${T('Vinder', 'Winner')}</th><th scope="col">${T('Taber', 'Loser')}</th></tr></thead><tbody>${rækker.join('')}</tbody></table></div>`;
}

// Handicapberegner
function regnHandicap() {
  const f = form('handicap');
  const læs = (n) => tilTal(f.elements[n].value);
  const h1 = læs('h1'), h2 = læs('h2'), gennemsnitHc = læs('gennemsnit'), par = læs('par'), spil = læs('spil'), opnået = læs('opnaaet');
  const alleTekst = f.elements.alle.value.trim();
  const alle = alleTekst ? alleTekst.split(/[\s;]+/).map((x) => tilTal(x)) : null;
  const imp = f.elements.opg.value === 'imp';
  f.elements.butler.closest('label').hidden = !imp;
  for (const [n, x] of [['h1', h1], ['h2', h2], ['par', par], ['spil', spil]]) markér(f.elements[n], x !== null && Number.isFinite(x));
  markér(f.elements.gennemsnit, alle || (gennemsnitHc !== null && Number.isFinite(gennemsnitHc)));
  markér(f.elements.alle, !alle || alle.every(Number.isFinite));
  markér(f.elements.opnaaet, opnået === null || Number.isFinite(opnået));
  if (alle && !alle.every(Number.isFinite)) { svar('handicap').innerHTML = fejl(T('Skriv alle handicap som tal adskilt af mellemrum.', 'Enter every handicap as numbers separated by spaces.')); return; }
  if ([h1, h2, par, spil].some((x) => x === null || Number.isNaN(x)) || (!alle && (gennemsnitHc === null || Number.isNaN(gennemsnitHc))) || Number.isNaN(opnået)) {
    svar('handicap').innerHTML = fejl(T('Udfyld handicap, gennemsnit, antal par og antal spil med tal.', 'Fill in the handicaps, the average, the pairs and the boards as numbers.')); return;
  }
  const r = B.handicap({ h1, h2, gennemsnit: alle ? undefined : gennemsnitHc, alle: alle || undefined, par, spil, opgørelse: imp ? 'imp' : 'matchpoint',
    opnået: opnået === null ? undefined : opnået, butler: imp && f.elements.butler.checked }, lang);
  if (r.fejl) { svar('handicap').innerHTML = fejl(r.fejl); return; }
  const enhed = imp ? T(' imp pr. spil', ' IMPs per board') : ' %';
  let html = `<ul><li><span>${T('Gennemsnitshandicap', 'Average handicap')}</span><span>${tal(r.gennemsnit, 2)}</span></li>`
    + `<li><span>${T('Parhandicap', 'Pair handicap')}</span><span>${tal(r.parhandicap, 2)}</span></li>`
    + `<li><span>${T('Forventet score', 'Expected score')}</span><span>${tal(r.forventet, 2)}${enhed}</span></li>`;
  if (r.regulering !== undefined) {
    html += `<li><span>${T('Opnået', 'Achieved')}</span><span>${tal(opnået, 2)}${enhed}</span></li>`
      + `<li><span>${T('Regulering for hver spiller', 'Adjustment for each player')}</span><span>${tal(r.regulering, 2, true)}</span></li>`
      + `<li><span>${T('Nye handicap', 'New handicaps')}</span><span>${tal(r.nye[0], 2)} ${T('og', 'and')} ${tal(r.nye[1], 2)}</span></li>`;
  }
  svar('handicap').innerHTML = html + '</ul>' + (r.regulering !== undefined ? `<p class="svar-tekst">${T('Handicappet bliver højst 52.', 'A handicap is never higher than 52.')}</p>` : '');
}

// Svarene opdateres, mens man skriver
for (const s of [450, 420, 420, 170, 140, -50, -100]) scoreLinje(B.tal(s, 0, lang, true));
document.querySelector('[data-tilfoej]').addEventListener('click', () => {
  if (scorerEl.children.length < 20) { scoreLinje(); scorerEl.lastElementChild.querySelector('input').focus(); regnMatchpoint(); }
});
form('score').addEventListener('input', regnScore);
form('matchpoint').addEventListener('input', () => { valgtRække = null; regnMatchpoint(); });
form('imp').addEventListener('input', () => { regnImp(); regnKp(); });
form('handicap').addEventListener('input', regnHandicap);
for (const f of document.querySelectorAll('[data-beregner]')) f.addEventListener('submit', (e) => e.preventDefault());
// Talfelternes standardværdier med komma på dansk, punktum på engelsk
for (const i of document.querySelectorAll('[data-beregner="handicap"] input[value], [data-beregner="imp"] input[value]')) {
  const x = tilTal(i.value);
  if (Number.isFinite(x)) i.value = Number.isInteger(x) && !i.value.includes(',') ? String(x) : B.tal(x, 2, lang);
}
regnScore(); regnMatchpoint(); regnImp(); regnKp(); regnHandicap();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
