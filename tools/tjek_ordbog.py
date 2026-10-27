"""Accepttest for ordbogssiden, sidefoden og sitemap (SPEC-sprog-og-ordbog.md).

    python tools/tjek_ordbog.py

Bredden ved 390 px tjekkes i en rigtig browser med `node tools/tjek_bredde.mjs`.
"""
import importlib.util
import json
import pathlib
import re
import unittest
from html.parser import HTMLParser

ROD = pathlib.Path(__file__).resolve().parent.parent
KILDE = ROD / 'ordbog' / 'Dansk_bridgeordbog.md'
SIDE = ROD / 'ordbog' / 'index.html'


def hent_bygger():
    spec = importlib.util.spec_from_file_location('build_ordbog', ROD / 'tools' / 'build_ordbog.py')
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


class Side(HTMLParser):
    """Opslagene (article.entry) med deres felter og links, alle id'er og alle interne links."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.opslag = []
        self.ids = set()
        self.interne = []
        self._nu = None
        self._i_rel = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.add(a['id'])
        if tag == 'a' and a.get('href', '').startswith('#'):
            self.interne.append(a['href'][1:])
        klasser = a.get('class', '').split()
        if tag == 'article' and 'entry' in klasser:
            self._nu = {'id': a['id'], 'search': a.get('data-search', ''), 'p': [], 'rel': []}
            self.opslag.append(self._nu)
            return
        if self._nu is None:
            return
        if tag == 'p':
            self._nu['p'].append(' '.join(klasser))
            self._i_rel = 'rel' in klasser
        if tag == 'a' and self._i_rel:
            self._nu['rel'].append(a['href'][1:])

    def handle_endtag(self, tag):
        if tag == 'article':
            self._nu = None
        if tag == 'p':
            self._i_rel = False


def læs_side():
    side = Side()
    side.feed(SIDE.read_text(encoding='utf-8'))
    return side


def søg(side, tekst):
    """Det samme som sidens søgefelt: små bogstaver, og teksten skal stå i opslagets søgetekst."""
    q = tekst.lower().strip()
    return [o['id'] for o in side.opslag if q in o['search']]


class Ordbogssiden(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.side = læs_side()
        cls.html = SIDE.read_text(encoding='utf-8')
        cls.opslag = {o['id']: o for o in cls.side.opslag}

    def test_siden_er_bygget_fra_markdown_og_ikke_rettet_i_haanden(self):
        bygger = hent_bygger()
        self.assertEqual(bygger.byg(KILDE.read_text(encoding='utf-8')), self.html)

    def test_387_opslag_og_tallet_i_underteksten(self):
        self.assertEqual(len(self.side.opslag), 387)
        self.assertIn('387 bridgeord på dansk med engelsk oversættelse.', self.html)

    def test_finesse_knibning_og_kipning_finder_kipning(self):
        for q in ('finesse', 'knibning', 'kipning', 'Knibning'):
            self.assertIn('kipning', søg(self.side, q), q)

    def test_blindemand_finder_bordet_og_indspil_finder_indspil(self):
        self.assertIn('bordet', søg(self.side, 'blindemand'))
        self.assertIn('indspil', søg(self.side, 'indspil'))

    def test_slutspil_og_indspil_linker_til_hinanden(self):
        self.assertIn('indspil', self.opslag['slutspil']['rel'])
        self.assertIn('slutspil', self.opslag['indspil']['rel'])

    def test_alle_relaterede_begreber_og_indeksets_links_peger_paa_et_anker(self):
        for o in self.side.opslag:
            for mål in o['rel']:
                self.assertIn(mål, self.side.ids, f"{o['id']} → {mål}")
        for mål in self.side.interne:
            self.assertIn(mål, self.side.ids, mål)

    def test_forklaring_vises_kun_naar_den_er_forskellig_fra_definitionen(self):
        # Afblokering: forklaringen er den samme som definitionen. Bordet: forklaringen er en anden.
        self.assertEqual(self.opslag['afblokering']['p'].count('def'), 1)
        self.assertNotIn('expl', self.opslag['afblokering']['p'])
        self.assertIn('expl', self.opslag['bordet']['p'])

    def test_engelsk_dansk_indeks_er_en_foldbar_liste_og_dansk_engelsk_vises_ikke(self):
        self.assertRegex(self.html, r'<details[^>]*>\s*<summary[^>]*>Engelsk–dansk indeks</summary>')
        self.assertNotIn('Dansk–engelsk', self.html)

    def test_soegefelt_filtre_og_a_aa_linje(self):
        self.assertRegex(self.html, r'<input[^>]+type="search"')
        self.assertIn('Ingen opslag passer', self.html)
        self.assertIn('data-filter="kategori"', self.html)
        self.assertIn('data-filter="niveau"', self.html)
        self.assertIn('href="#bogstav-a"', self.html)
        self.assertIn('href="#bogstav-å"', self.html)

    def test_sidens_faste_tekster_har_engelsk(self):
        self.assertIn('data-en="Bridge dictionary"', self.html)
        self.assertIn('data-en-placeholder=', self.html)

    def test_ingen_eksterne_scripts(self):
        self.assertNotRegex(self.html, r'<script[^>]+src=')

    def test_struktureret_data_definedtermset_med_et_definedterm_pr_opslag(self):
        blokke = re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.html, re.S)
        self.assertEqual(len(blokke), 1)
        data = json.loads(blokke[0])
        self.assertEqual(data['@context'], 'https://schema.org')
        self.assertEqual(data['@type'], 'DefinedTermSet')
        self.assertEqual(data['url'], 'https://www.kontraktbridge.dk/ordbog/')
        self.assertEqual(data['inLanguage'], 'da')
        termer = data['hasDefinedTerm']
        self.assertEqual(len(termer), len(self.side.opslag))
        self.assertEqual([t['url'].split('#')[1] for t in termer], [o['id'] for o in self.side.opslag])
        for t in termer:
            self.assertEqual(t['@type'], 'DefinedTerm')
            self.assertEqual(t['inDefinedTermSet'], data['@id'])
            self.assertTrue(t['name'] and t['description'], t['url'])
        kipning = next(t for t in termer if t['name'] == 'Kipning')
        self.assertEqual(kipning['url'], 'https://www.kontraktbridge.dk/ordbog/#kipning')
        self.assertTrue(kipning['description'].startswith('At spille mod en honnør'))
        for navn in ('Finesse', 'Knibning', 'snit'):
            self.assertIn(navn, kipning['alternateName'])


class LinksTilScoring(unittest.TestCase):
    """Leverancetrin 5 i SPEC-scoring.md: opslagene linker til Scoring i bridge via tools/data/ordbog-scoring.json."""

    TABEL = ROD / 'tools' / 'data' / 'ordbog-scoring.json'
    # Franks tabel (27. oktober 2026): specens ni emner med hans rettelser og tilføjelser. Dobling og Redobling linker ikke.
    FORVENTET = {
        'matchpoint': 'matchpoint', 'imp': 'imp-skalaen', 'international-matchpoints': 'imp-skalaen', 'kamppoint': 'kamppoint',
        'vp-skala': 'kamppoint', 'butler-beregning': 'butler', 'datum': 'butler', 'cross-imp': 'cross-imp',
        'board-a-match-bam': 'board-a-match', 'handicap': 'handicap',
        'zonestilling': 'scoren-for-et-spil', 'i-zonen': 'scoren-for-et-spil', 'uden-for-zonen': 'scoren-for-et-spil',
        'alle-i-zonen': 'scoren-for-et-spil',
        'udgang': 'bonus', 'slem': 'bonus', 'delkontrakt': 'bonus', 'bonuspoint': 'bonus', 'lilleslem': 'bonus', 'storeslem': 'bonus',
        'doblet-kontrakt': 'doblet-og-redoblet-kontrakt-hjemme', 'redoblet-kontrakt': 'doblet-og-redoblet-kontrakt-hjemme',
        'stikpoint': 'stikpoint', 'overstik': 'overstik', 'overstikspoint': 'overstik',
        'middelscore': 'middelscoremetoden', 'middelscore-plus': 'manglende-resultater-og-kunstig-score',
        'middelscore-minus': 'manglende-resultater-og-kunstig-score', 'korrigeret-score': 'manglende-resultater-og-kunstig-score',
        'top': '2-1-0', 'bund': '2-1-0', 'procentscore': 'procent',
    }

    @classmethod
    def setUpClass(cls):
        cls.html = SIDE.read_text(encoding='utf-8')
        cls.scoring = (ROD / 'scoring' / 'index.html').read_text(encoding='utf-8')
        cls.opslag = {m.group(1): m.group(0) for m in re.finditer(r'<article class="entry" id="([^"]+)".*?</article>', cls.html, re.S)}

    def test_tabellen_er_franks(self):
        links = json.loads(self.TABEL.read_text(encoding='utf-8'))['links']
        self.assertEqual(len(links), len(self.FORVENTET))
        self.assertEqual({x['opslag']: x['anker'] for x in links}, self.FORVENTET)
        self.assertNotIn('dobling', self.FORVENTET)
        self.assertNotIn('redobling', self.FORVENTET)

    def test_opslagene_linker_til_ankrene_paa_scoringssiden(self):
        for opslag, anker in self.FORVENTET.items():
            self.assertIn(f' id="{anker}"', self.scoring, anker)
            m = re.search(r'<p class="scoring">(.*?)</p>', self.opslag[opslag], re.S)
            self.assertIsNotNone(m, opslag)
            self.assertIn(f'<a href="/scoring/#{anker}">', m.group(1), opslag)
            self.assertIn('<span data-en="In Scoring in bridge">I Scoring i bridge</span>', m.group(1), opslag)

    def test_kun_tabellens_opslag_har_linket(self):
        med = sorted(i for i, a in self.opslag.items() if '/scoring/#' in a)
        self.assertEqual(med, sorted(self.FORVENTET))

    def test_linkteksten_er_overskriften_ved_ankeret(self):
        for opslag, tekst in (('kamppoint', 'Kamppoint'), ('matchpoint', 'Parturnering: matchpoint'), ('handicap', 'Handicap'),
                              ('doblet-kontrakt', 'Doblet og redoblet kontrakt hjemme'), ('imp', 'Imp-skalaen'), ('butler-beregning', 'Butler'),
                              ('top', '2/1/0'), ('zonestilling', 'Scoren for et spil'), ('middelscore', 'Middelscoremetoden: +1/0/−1'),
                              ('korrigeret-score', 'Manglende resultater og kunstig score'), ('cross-imp', 'Cross-imp (imps across the field)')):
            self.assertRegex(self.opslag[opslag], rf'<a href="/scoring/#[^"]+">{re.escape(tekst)}</a>', opslag)


class Bygningen(unittest.TestCase):
    def setUp(self):
        self.bygger = hent_bygger()
        self.tekst = KILDE.read_text(encoding='utf-8')

    def test_fejler_hvis_et_opslagsord_er_et_af_husets_ikke_ord(self):
        for ord_ in ('Knibning', 'Snit', 'Den blinde'):
            ændret = self.tekst.replace('### Afkast\n', f'### {ord_}\n', 1)
            with self.assertRaises(self.bygger.OrdbogFejl, msg=ord_):
                self.bygger.byg(ændret)

    def test_fejler_ved_doede_henvisninger(self):
        ændret = self.tekst.replace('**Relaterede begreber:** slutspil, eliminering, gaffel',
                                    '**Relaterede begreber:** slutspil, findes-ikke, gaffel', 1)
        with self.assertRaises(self.bygger.OrdbogFejl):
            self.bygger.byg(ændret)

    def test_fejler_ved_ukendt_opslag_eller_anker_i_scoringstabellen(self):
        for links in ([{'opslag': 'findes-ikke', 'anker': 'kamppoint'}], [{'opslag': 'kamppoint', 'anker': 'findes-ikke'}]):
            with self.assertRaises(self.bygger.OrdbogFejl, msg=str(links)):
                self.bygger.byg(self.tekst, scoringslinks=links)

    def test_fejler_ved_dobbelte_id(self):
        ændret = self.tekst.replace('**ID:** `afkast`', '**ID:** `afblokering`', 1)
        with self.assertRaises(self.bygger.OrdbogFejl):
            self.bygger.byg(ændret)


class Sidefoden(unittest.TestCase):
    def kolonne(self, sti):
        html = (ROD / sti).read_text(encoding='utf-8')
        trænere = html.find('>Trænere</h2>')
        opslag = html.find('>Opslag</h2>')
        self.assertGreater(trænere, 0, sti)
        self.assertGreater(opslag, trænere, f'{sti}: Opslag skal stå efter Trænere')
        rest = html[opslag:html.find('</nav>', opslag)]
        self.assertRegex(rest, r'<a href="/ordbog/"[^>]*>Bridgeordbog</a>', sti)
        return html[html.rfind('<h2', 0, opslag):html.find('</nav>', opslag)]

    def test_forsiden_og_ordbogen_paa_dansk_og_engelsk(self):
        for sti in ('index.html', 'ordbog/index.html'):
            kolonne = self.kolonne(sti)
            self.assertIn('data-en="Reference"', kolonne, sti)
            self.assertIn('data-en="Bridge dictionary"', kolonne, sti)

    def test_om_mig(self):
        self.kolonne('om-mig/index.html')


class Sitemap(unittest.TestCase):
    def test_ordbogen_staar_i_sitemap(self):
        self.assertIn('<loc>https://www.kontraktbridge.dk/ordbog/</loc>', (ROD / 'sitemap.xml').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
