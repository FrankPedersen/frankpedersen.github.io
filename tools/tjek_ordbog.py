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

    def test_438_opslag_og_tallet_i_underteksten(self):
        # Version 1.3 (SPEC-ordbog-kategorier): 387 − 1 sammenlagt + 51 nye; portion 9 (SPEC-ordbog-forklaringer-9.md):
        # Norsk fordeling ud, MUD og Aktivt udspil ind; portion 11 (SPEC-ordbog-forklaringer-11.md): Pivotbord ud, RealBridge ind
        self.assertEqual(len(self.side.opslag), 438)
        self.assertIn('438 bridgeord på dansk med engelsk oversættelse.', self.html)

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
        # Alle opslag: et afsnit med forklaringen, præcis når den er en anden end definitionen. Før stod Afblokering
        # som eksemplet på en forklaring, der gentager definitionen, men portionerne giver opslagene en forklaring
        # (SPEC-ordbog-forklaringer-4.md), så testen ser på dem alle i stedet for ét fast eksempel.
        ens = forskellige = 0
        for navn, o in opslag_i_kilden().items():
            if 'ID' not in o:
                continue
            p = self.opslag[o['ID'].strip('`')]['p']
            self.assertEqual(p.count('def'), 1, navn)
            if o['Forklaring'] == o['Kort definition']:
                ens += 1
                self.assertNotIn('expl', p, navn)
            else:
                forskellige += 1
                self.assertIn('expl', p, navn)
        self.assertEqual(ens + forskellige, 438)
        # Efter portion 11 (SPEC-ordbog-forklaringer-11.md) har alle opslag deres egen forklaring, så reglen om, at en
        # forklaring, der gentager definitionen, ikke vises, tjekkes på en kilde, hvor Afkast gentager sin definition.
        self.assertEqual(ens, 0)
        self.assertIn('expl', self.opslag['bordet']['p'])
        afkast = opslag_i_kilden()['Afkast']
        kilde = KILDE.read_text(encoding='utf-8')
        ændret = kilde.replace(f"**Forklaring:** {afkast['Forklaring']}", f"**Forklaring:** {afkast['Kort definition']}", 1)
        self.assertNotEqual(ændret, kilde)
        artikel = re.search(r'<article class="entry" id="afkast".*?</article>', hent_bygger().byg(ændret), re.S).group(0)
        self.assertIn('class="def"', artikel)
        self.assertNotIn('class="expl"', artikel)

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


def opslag_i_kilden():
    """{overskrift: felter} for kildens opslag, med det afsnit (##), opslaget står under."""
    ud, afsnit, nu = {}, None, None
    for linje in KILDE.read_text(encoding='utf-8').splitlines():
        if linje.startswith('## '):
            afsnit, nu = linje[3:].strip(), None
        elif linje.startswith('### '):
            nu = ud.setdefault(linje[4:].strip(), {'afsnit': afsnit, 'antal': 0})
            nu['antal'] += 1
        elif nu is not None:
            m = re.match(r'\*\*(.+?):\*\*(?: (.*))?$', linje)
            if m:
                nu[m.group(1)] = (m.group(2) or '').strip()
    return ud


class KategorierOgNiveauer(unittest.TestCase):
    """Accepttest for SPEC-ordbog-kategorier.md: Franks godkendte forslag (docs/specs/ordbog-forslag.md), version 1.3."""

    KATEGORIER = ['Grundlæggende begreber', 'Meldinger og meldeforløb', 'Meldesystemer og konventioner', 'Konkurrencemeldinger',
                  'Spilføring', 'Modspil, udspil og signaler', 'Score og beregning', 'Turnering og organisering',
                  'Love, etik og procedure', 'Onlinebridge og digitale turneringer', 'Avancerede teknikker',
                  'Talemåder og bridgeslang']
    # Forslagets tal for de 387 opslag, uden Princippet om begrænset valg og med de 51 nye. Portion 9
    # (SPEC-ordbog-forklaringer-9.md): Marmic er flyttet til Meldesystemer og konventioner (42 → 43), Norsk fordeling er
    # fjernet, og MUD og Aktivt udspil er nye under Modspil, udspil og signaler (28 → 29 − 1 = 28). Portion 11
    # (SPEC-ordbog-forklaringer-11.md): Pivotbord (øvet) er fjernet fra Turnering og organisering (43 → 42), og RealBridge
    # (begynder) er nyt under Onlinebridge og digitale turneringer (3 → 4).
    PR_KATEGORI = {'Grundlæggende begreber': 98, 'Meldinger og meldeforløb': 60, 'Meldesystemer og konventioner': 43,
                   'Konkurrencemeldinger': 33, 'Spilføring': 44, 'Modspil, udspil og signaler': 28, 'Score og beregning': 29,
                   'Turnering og organisering': 42, 'Love, etik og procedure': 36, 'Onlinebridge og digitale turneringer': 4,
                   'Avancerede teknikker': 12, 'Talemåder og bridgeslang': 9}
    PR_NIVEAU = {'begynder': 191, 'let øvet': 136, 'øvet': 93, 'avanceret': 18}
    NYE = ['Baghånd', 'Forhånd', 'Honnørsekvens', 'Lavhonnør', 'Mellemhånd', 'Mellemkort', 'Nabohonnører',
           'Selvspillende farve', 'Spillestærk hånd', 'Toptaber', '3-trinsraketten', 'Åbningsfarve', 'Bogmelding',
           'Dobbeltspring', 'Enkeltstøtte', 'Melderunde', 'Misfit', 'Nødmelding / nødsans', 'Overmelding', 'Rundekrav',
           'Springgenmelding', 'Umeldt farve', '26-33-37', '1NT-åbning', '2NT-åbning', 'Defensiven', 'Forhåndsoffermelding',
           'Meldenød', 'Offensiven', 'Viderespærring', 'Badekup (Bath Coup)', '"Eight ever, nine never"', 'Farvebehandling',
           'Fordelingssandsynlighed', 'Forbindelser', 'Spilleplan', 'Højt i tredje hånd', 'Honnør på honnør',
           'Lavt i anden hånd', 'Stik ikke automatisk', 'Tilspil', 'Regnskab', 'Byttehandel', 'Fanget på det gale ben',
           'Kort tredje / honnør anden', 'Melde i den blå luft', 'Pointrytter', 'Pokeransigt', 'Sælge ud',
           'Unoder ved bordet', 'Urent trav']
    # Portion 1, 2, 4, 6, 7, 8 og 9 af forklaringerne (SPEC-ordbog-forklaringer-1.md, -2.md, -4.md, -6.md, -7.md, -8.md
    # og -9.md, Franks valg 6., 10., 11. og 14. november 2026) gav 42 af de nye opslag deres egen forklaring (portion 3,
    # 5 og 10 havde ingen af dem). Portion 11 (SPEC-ordbog-forklaringer-11.md, Franks valg 15. november 2026) giver de ni
    # talemåder deres, så nu har alle 51 nye opslag deres egen forklaring.
    MED_FORKLARING = set(NYE)

    @classmethod
    def setUpClass(cls):
        cls.kilde = KILDE.read_text(encoding='utf-8')
        cls.opslag = opslag_i_kilden()
        cls.side = læs_side()
        cls.html = SIDE.read_text(encoding='utf-8')

    def test_version_13_med_438_opslag(self):
        self.assertIn('_Version 1.3. Ordbogen indeholder 438 kanoniske opslag._', self.kilde)
        self.assertEqual(len(self.opslag), 438)

    def test_tolv_kategorier_og_talemaader_i_filteret(self):
        self.assertEqual([k for k in hent_bygger().parse(self.kilde)['kategorier']], self.KATEGORIER)
        for k in self.KATEGORIER:
            self.assertIn(f'data-filter="kategori" data-value="{k}"', self.html.replace('&#x27;', "'"), k)

    def test_alle_opslag_har_kategori_og_niveau_og_staar_under_deres_afsnit(self):
        for navn, o in self.opslag.items():
            self.assertIn(o.get('Kategori'), self.KATEGORIER, navn)
            self.assertIn(o.get('Niveau'), self.PR_NIVEAU, navn)
            self.assertEqual(o['afsnit'], o['Kategori'], navn)

    def test_antal_pr_kategori_og_niveau_som_i_forslaget(self):
        for felt, forventet in (('Kategori', self.PR_KATEGORI), ('Niveau', self.PR_NIVEAU)):
            antal = {}
            for o in self.opslag.values():
                antal[o[felt]] = antal.get(o[felt], 0) + 1
            self.assertEqual(antal, forventet, felt)

    def test_ingen_overskrifter_gaar_igen(self):
        overskrifter = re.findall(r'^### (.+)$', self.kilde, re.M)
        små = [o.lower() for o in overskrifter]
        self.assertEqual(sorted({o for o in små if små.count(o) > 1}), [])

    def test_de_51_nye_opslag(self):
        self.assertEqual(len(self.NYE), 51)
        for navn in self.NYE:
            self.assertIn(navn, self.opslag, navn)
            o = self.opslag[navn]
            self.assertTrue(o['Kort definition'], navn)
            if navn in self.MED_FORKLARING:
                self.assertNotEqual(o['Forklaring'], o['Kort definition'], navn)
            else:
                self.assertEqual(o['Forklaring'], o['Kort definition'], navn)
        self.assertEqual((self.opslag['Pokeransigt']['Kategori'], self.opslag['Pokeransigt']['Niveau']),
                         ('Talemåder og bridgeslang', 'øvet'))
        self.assertEqual(self.opslag['Pokeransigt']['Engelsk'], 'Poker face')
        self.assertEqual(self.opslag['Urent trav']['Engelsk'], '')

    def test_tomt_engelsk_felt_vises_ikke(self):
        artikel = re.search(r'<article class="entry" id="urent-trav".*?</article>', self.html, re.S).group(0)
        self.assertNotIn('data-en="English"', artikel)
        artikel = re.search(r'<article class="entry" id="pokeransigt".*?</article>', self.html, re.S).group(0)
        self.assertIn('<span lang="en">Poker face</span>', artikel)

    def test_soegeordene_finder_opslagene(self):
        # "aktivt udspil" finder fra portion 9 opslaget Aktivt udspil og ikke længere Neutralt udspil, hvor det var en
        # alternativ term (SPEC-ordbog-forklaringer-9.md, Franks afgørelse 14. november 2026).
        for q, mål in (('bonde', 'knaegt'), ('aktivt udspil', 'aktivt-udspil'), ('passivt udspil', 'neutralt-udspil'),
                       ('princippet om begrænset valg', 'begraenset-valg'), ('espørgemelding', 'blackwood'),
                       ('balanceret fordeling', 'jaevn-haand'), ('trækværdi', 'stikpoint'), ('frafald', 'hold-up'),
                       ('udoblet', 'doblet-kontrakt'), ('2-over-1', '2-over-1')):
            self.assertIn(mål, søg(self.side, q), q)

    def test_kipning_toppe_og_frafald_som_soegeord(self):
        # SPEC-sprog-kipning-toppe (Franks valg 31. oktober 2026)
        for q in ('kip', 'kippe', 'knibe'):
            self.assertIn('kipning', søg(self.side, q), q)
        for q in ('toppe', 'toppe farven'):
            self.assertIn('fald', søg(self.side, q), q)
        for q in ('frafald', 'falde fra'):
            self.assertIn('hold-up', søg(self.side, q), q)
            self.assertNotIn('dyk', søg(self.side, q), q)
        self.assertEqual(self.opslag['"Eight ever, nine never"']['Kort definition'],
                         'Huskeregel: Med otte kort i alt og manglende dame tages kipningen. Med ni toppes farven.')

    def test_forklaringerne_fra_forslaget(self):
        for navn, tekst in (('Doubleton', 'To kort i en farve.'), ('Kipning', 'At spille op mod en gaffel i håb om, at det manglende kort sidder i plads.'),
                            ('Turneringsleder', 'Dommeren ved en bridgeturnering. Kan justere scoren ved regelbrud.'),
                            ('Tilpasning', 'De to hænder har mindst otte fælles kort i en farve.')):
            self.assertEqual(self.opslag[navn]['Forklaring'], tekst, navn)

    def test_rettelserne(self):
        self.assertNotIn('Princippet om begrænset valg', self.opslag)
        self.assertIn('Princippet om begrænset valg', self.opslag['Begrænset valg']['Alternative termer'])
        self.assertEqual(self.opslag['Handicap']['Kort definition'],
                         'Et tal for spillerens aktuelle styrke (0–52, lavt er godt), som reguleres efter hver turnering.')
        self.assertEqual(self.opslag['Slutmelding']['Kort definition'], 'En melding, der beder makker passe; kontrakten er fundet.')
        self.assertEqual((self.opslag['Indspil']['Kategori'], self.opslag['Indspil']['afsnit']), ('Avancerede teknikker',) * 2)
        self.assertEqual(self.opslag['Stopkort']['Kort definition'], 'Et kort, der tidligere blev brugt til at markere en springmelding.')
        self.assertEqual(self.opslag['Stopkort']['Forklaring'], 'Et kort, der tidligere blev brugt til at markere en springmelding. '
                                                             'Den konkrete procedure afhænger af de gældende turneringsbestemmelser.')

    def test_husets_ord_i_ordbogens_tekst(self):
        # Kipning, knægt, hp, NT eller sans og bordet; de andre ord står kun som søgeord (og engelsk/indeks).
        tekst = '\n'.join(l for l in self.kilde[:self.kilde.index('## Engelsk-dansk indeks')].splitlines()
                          if not l.startswith(('**Alternative termer:**', '**Engelsk:**')))
        for mønster in (r'\bbonde\b', r'\bknib\w*', r'\bsnit\b', r'\bUT\b', r'\bHCP\b', r'\bblindemand\w*'):
            self.assertIsNone(re.search(mønster, tekst, re.I if mønster not in (r'\bUT\b', r'\bHCP\b') else 0), mønster)


class Portion9(unittest.TestCase):
    """SPEC-ordbog-forklaringer-9.md (Franks valg 14. november 2026): Modspil, udspil og signaler. De 22 forklaringer,
    omdøbningerne til Gennemspil og Malmømarkering, Marmic som trefarvet hånd, de nye opslag MUD og Aktivt udspil og
    indekserne."""

    MODSPIL = 'Modspil, udspil og signaler'
    DE_22 = ['Afkast', 'Farvepræferencesignal', 'Fordelingssignal', 'Gennemspil', 'Honnør på honnør', 'Højt fra intet',
             'Højt i tredje hånd', 'Indre sekvens', 'Kald-afvisning', 'Lavinthal-signal', 'Lavt i anden hånd', 'Lige antal',
             'Modspilssignal', 'Neutralt udspil', 'Regel 11', 'Spille under en honnør', 'Stik ikke automatisk', 'Tilspil',
             'Trumfpres på spilfører', 'Ulige antal', 'Øverst fra sekvens', 'Åbningsudspil']

    @classmethod
    def setUpClass(cls):
        cls.kilde = KILDE.read_text(encoding='utf-8')
        cls.opslag = opslag_i_kilden()
        cls.side = læs_side()
        cls.bygget = hent_bygger().parse(cls.kilde)

    def test_de_22_og_resten_af_kategorien_har_deres_egen_forklaring(self):
        for navn in self.DE_22:
            self.assertIn(navn, self.opslag, navn)
            self.assertEqual(self.opslag[navn]['Kategori'], self.MODSPIL, navn)
        i_kategorien = [n for n, o in self.opslag.items() if o['Kategori'] == self.MODSPIL]
        self.assertEqual(len(i_kategorien), 28)
        for navn in i_kategorien:
            self.assertNotEqual(self.opslag[navn]['Forklaring'], self.opslag[navn]['Kort definition'], navn)
        # 46 før portion 9 og 24 efter; tallet for hele ordbogen tælles nu i Portion10 (SPEC-ordbog-forklaringer-10.md).

    def test_gennemspil_i_stedet_for_gennembrud(self):
        self.assertNotIn('Gennembrud', self.opslag)
        o = self.opslag['Gennemspil']
        self.assertEqual((o['ID'], o['Engelsk'], o['Alternative termer']), ('`gennemspil`', 'Leading through', 'Gennembrud'))
        self.assertEqual(o['Kort definition'], 'At spille en farve ud, så en bestemt modstander skal lægge til før ens makker, '
                                               'typisk den hånd, der har honnørerne.')
        self.assertIn('gennemspil', søg(self.side, 'gennembrud'))
        self.assertIn('fordi et gennemspil eller en farvefortsættelse', self.opslag['Farehånd']['Kort definition'])
        self.assertNotIn('gennembrud', self.opslag['Farehånd']['Kort definition'])

    def test_malmoemarkering_i_stedet_for_laveste_lige_kort_og_norsk_fordeling_er_ude(self):
        for navn in ('Laveste lige kort', 'Norsk fordeling'):
            self.assertNotIn(navn, self.opslag)
        o = self.opslag['Malmømarkering']
        self.assertEqual((o['ID'], o['Engelsk'], o['Kategori']), ('`malmoemarkering`', 'Upside-down count', self.MODSPIL))
        self.assertEqual(o['Kort definition'], 'Et fordelingssignal, hvor et lavt kort viser et lige antal og et højt kort et ulige.')
        self.assertIn('Bridgesystem bruger Malmømarkeringer', o['Forklaring'])

    def test_marmic_er_en_trefarvet_haand_og_mud_er_udspillet(self):
        marmic = self.opslag['Marmic']
        self.assertEqual((marmic['Kategori'], marmic['afsnit']), ('Meldesystemer og konventioner',) * 2)
        self.assertEqual(marmic['Kort definition'], 'En trefarvet hånd med 4-4-4-1-fordeling (eller 5-4-4-0); navnet kommer fra det '
                                                    'italienske Marmic-system, hvor åbningerne 2♣ og 2♦ viste den.')
        self.assertEqual(marmic['Engelsk'], 'Marmic')
        self.assertNotIn('Systemafhængig', marmic)
        self.assertEqual(marmic['Relaterede begreber'], 'trefarvet-haand, usaedvanlig-2nt')
        self.assertIn('I Norge bruges ordet om et spring til 2NT', marmic['Forklaring'])
        mud = self.opslag['MUD']
        self.assertEqual((mud['ID'], mud['Engelsk'], mud['Kategori'], mud['Niveau'], mud['Systemafhængig']),
                         ('`mud`', 'MUD', self.MODSPIL, 'øvet', 'Ja'))
        self.assertEqual(mud['Kort definition'], 'Udspil af det midterste kort fra tre små kort, efterfulgt af det højeste.')
        self.assertIn('middle, up, down', mud['Forklaring'])
        self.assertIn('mud', søg(self.side, 'mud'))
        self.assertNotIn('marmic', søg(self.side, 'mud'))

    def test_indekserne_foelger_med(self):
        engelsk = {(r['engelsk'], r['id']) for r in self.bygget['indeks']}
        for række in (('Leading through', 'gennemspil'), ('Upside-down count', 'malmoemarkering'), ('MUD', 'mud'),
                      ('Marmic', 'marmic'), ('Active lead', 'aktivt-udspil')):
            self.assertIn(række, engelsk)
        for ord_ in ('Low from even', 'Norwegian count'):
            self.assertNotIn(ord_, {e for e, _ in engelsk})
        self.assertNotIn(('MUD', 'marmic'), engelsk)
        for id_ in ('gennembrud', 'laveste-lige-kort', 'norsk-fordeling'):
            self.assertNotIn(id_, {i for _, i in engelsk}, id_)
        dansk = self.kilde[self.kilde.index('## Dansk-engelsk indeks'):].splitlines()
        for linje in ('- **Gennemspil** → Leading through', '- **Malmømarkering** → Upside-down count', '- **MUD** → MUD',
                      '- **Marmic** → Marmic', '- **Aktivt udspil** → Active lead'):
            self.assertIn(linje, dansk)
        for navn in ('Gennembrud', 'Laveste lige kort', 'Norsk fordeling'):
            self.assertFalse([l for l in dansk if l.startswith(f'- **{navn}** ')], navn)
        # Det engelsk-danske indeks står stadig i alfabetisk orden.
        ord_ = [r['engelsk'] for r in self.bygget['indeks']]
        self.assertEqual(ord_, sorted(ord_, key=str.casefold))

    def test_udspil_neutralt_udspil_og_kald_afvisning(self):
        self.assertEqual(self.opslag['Udspil']['Kort definition'],
                         'Det første kort i et stik; udspillet til første stik kaldes åbningsudspillet.')
        self.assertIn('(§ 44G)', self.opslag['Udspil']['Forklaring'])
        self.assertEqual(self.opslag['Neutralt udspil']['Alternative termer'], 'Passivt udspil')
        self.assertNotIn('neutralt-udspil', søg(self.side, 'aktivt udspil'))
        # Aktivt udspil er et opslag for sig (Franks ændring før fletningen).
        o = self.opslag['Aktivt udspil']
        self.assertEqual((o['ID'], o['Engelsk'], o['Kategori'], o['afsnit'], o['Relaterede begreber']),
                         ('`aktivt-udspil`', 'Active lead', self.MODSPIL, self.MODSPIL, 'neutralt-udspil'))
        self.assertEqual(o['Kort definition'], 'Et udspil, der skal rejse eller indkassere stik, før spilfører får kastet sine tabere af.')
        self.assertTrue(o['Forklaring'].startswith('Det modsatte er et passivt eller neutralt udspil.'))
        self.assertIn('fx fra K x x i en umeldt farve', o['Forklaring'])
        self.assertEqual(søg(self.side, 'active lead'), ['aktivt-udspil'])
        self.assertEqual(self.opslag['Kald-afvisning']['Alternative termer'], 'Kald og afvisning')
        for q in ('attitude', 'encourage', 'discourage'):
            self.assertIn('kald-afvisning', søg(self.side, q), q)

    def test_begge_systemer_staar_med_navn_og_kompendiet_som_forslag(self):
        # Systemerne står stadig med navn, men spiller samme retning (SPEC-ordbog-markeringer.md, Franks afgørelse
        # 15. november 2026: Makker 2-dokumentet havde markeringerne forkert); klassen Markeringer tjekker teksten.
        kald = self.opslag['Kald-afvisning']['Forklaring']
        self.assertIn('Bridgesystem efter es-udspil', kald)
        self.assertIn('2 over 1 – Moderne majorstøtte på makkers udspil', kald)
        antal = self.opslag['Fordelingssignal']['Forklaring']
        self.assertIn('Bridgesystem bruger antal, når spilfører spiller en ny farve', antal)
        self.assertIn('2 over 1 – Moderne majorstøtte, når attitude er kendt', antal)
        for navn, forslag in (('Øverst fra sekvens', 'foreslår ALA mod sans'), ('Fjerdehøjeste', 'foreslår 1., 3. og 5. højeste'),
                              ('Kald-afvisning', 'foreslår romersk kald'), ('Modspilssignal', 'foreslår desuden omvendt forsinket kald')):
            self.assertIn('Kompendium over modspilsaftaler ' + forslag, self.opslag[navn]['Forklaring'], navn)

    def test_franks_rettelser_og_eksemplerne(self):
        self.assertIn('fra K D x x spilles kongen mod farve og 4. højeste mod sans', self.opslag['Øverst fra sekvens']['Forklaring'])
        self.assertIn('4. højeste fra E 10 7 4 2 eller K 10 7 4 2', self.opslag['Spille under en honnør']['Forklaring'])
        self.assertIn('har valgt ikke at spille ud fra E x x x mod sans', self.opslag['Spille under en honnør']['Forklaring'])
        self.assertIn('lægges med forsiden nedad (§ 41A)', self.opslag['Åbningsudspil']['Forklaring'])
        self.assertIn('kan makker se alle lavere kort, har udspilleren præcis fire', self.opslag['Fjerdehøjeste']['Forklaring'])
        self.assertIn('11 − 7 = 4 højere kort', self.opslag['Regel 11']['Forklaring'])
        self.assertIn('er tallet 12, og ved femtehøjeste 10', self.opslag['Regel 11']['Forklaring'])
        self.assertEqual(self.opslag['Tilspil']['Kort definition'],
                         'Et kort, der spilles til et stik efter udspillet; hver af de tre andre spillere spiller til efter tur.')
        self.assertEqual(self.opslag['Lige antal']['Kort definition'], 'Et lige antal kort i en farve (fx 2, 4 eller 6).')
        for navn, henvisning in (('Modspilssignal', '(§ 40A1b)'), ('Modspilssignal', '(§ 20F2)'), ('Tilspil', '(§ 44C)'),
                                 ('Lavt i anden hånd', '(§ 73D2)'), ('Åbningsudspil', '(§ 41C)')):
            self.assertIn(henvisning, self.opslag[navn]['Forklaring'], navn)


class Portion10(unittest.TestCase):
    """SPEC-ordbog-forklaringer-10.md (Franks valg 15. november 2026): Avancerede teknikker. De tolv forklaringer, seks
    rettede definitioner, Procentspil i stedet for Procentchance, Kast-ind-skvis og Par-kontrakt som alternative termer,
    de relaterede begreber (uden linket mellem Slutspil og Morton's Fork) og indekserne."""

    AVANCERET = 'Avancerede teknikker'
    DE_12 = ['Begrænset valg', 'Eliminering', 'Indspil', 'Kortlæsning', "Morton's Fork", 'Optimal kontrakt', 'Procentspil',
             'Skvis', 'Strip-squeeze', 'Taber på taber', 'Vienna Coup', 'Åbne kort']
    DEFINITIONER = {
        'Begrænset valg': 'En sandsynlighedsregel: lægger en modspiller ét af to lige store kort, er det mere sandsynligt, at '
                          'han havde kortet alene, end at han valgte det blandt to.',
        'Eliminering': 'At fjerne modspillernes sikre udspilsfarver før et indspil.',
        "Morton's Fork": 'Et kup, hvor spilføreren spiller mod en konge, så modspilleren med esset giver et stik væk, uanset '
                         'om han tager esset eller dykker.',
        'Skvis': 'En form for slutspil, hvor en modspiller må kaste et kort, han ikke kan undvære, så et af spilførerens kort '
                 'bliver et stik.',
        'Strip-squeeze': 'En form for slutspil, hvor en skvis tvinger modspilleren til at kaste et kort, han skulle vogte en '
                         'farve eller komme ud med, så han bagefter kan sættes ind: skvis og indspil efter hinanden.',
        'Vienna Coup': 'Et forberedende spil til en skvis: spilføreren indkasserer et højt kort i en farve, så modspillerens '
                       'lavere honnør bliver højeste kort, og farven ikke blokerer skvisen.',
    }
    # De seks andre definitioner er ikke forkerte og står uændret.
    UAENDREDE = {
        'Indspil': 'En form for slutspil, hvor spilføreren sætter en modspiller ind, så han må spille ud til spilførerens '
                   'fordel, fx ind i en gaffel.',
        'Kortlæsning': 'Systematisk udledning af skjulte hænder ud fra meldinger, udspil, signaler og de spillede kort.',
        'Optimal kontrakt': 'Den bedste kontrakt baseret på hænderne.',
        'Procentspil': 'Den spilleplan, der giver størst matematisk sandsynlighed for det ønskede antal stik uden yderligere '
                       'oplysninger.',
        'Taber på taber': 'At smide en taber på en taber for at undgå større tab.',
        'Åbne kort': 'Analyse hvor alle fire hænder er kendt; bruges til at beregne optimale linjer.',
    }
    RELATEREDE = {'Begrænset valg': 'kipning, fald', 'Eliminering': 'slutspil, indspil', 'Indspil': 'slutspil, eliminering, gaffel',
                  'Kortlæsning': 'taelling, fordelingssandsynlighed', "Morton's Fork": 'kipning, dyk',
                  'Optimal kontrakt': 'aabne-kort, offer',
                  'Procentspil': 'fordelingssandsynlighed, eight-ever-nine-never, sikkerhedsspil',
                  'Skvis': 'slutspil, strip-squeeze, vienna-coup', 'Strip-squeeze': 'skvis, indspil',
                  'Taber på taber': 'taber, overtrumf', 'Vienna Coup': 'skvis', 'Åbne kort': 'optimal-kontrakt'}

    @classmethod
    def setUpClass(cls):
        cls.bygger = hent_bygger()
        cls.kilde = KILDE.read_text(encoding='utf-8')
        cls.opslag = opslag_i_kilden()
        cls.side = læs_side()
        cls.paa_siden = {o['id']: o for o in cls.side.opslag}
        cls.bygget = cls.bygger.parse(cls.kilde)

    def test_de_12_har_deres_egen_forklaring(self):
        i_kategorien = sorted(n for n, o in self.opslag.items() if o['Kategori'] == self.AVANCERET)
        self.assertEqual(i_kategorien, sorted(self.DE_12))
        for navn in self.DE_12:
            self.assertEqual(self.opslag[navn]['afsnit'], self.AVANCERET, navn)
            self.assertNotEqual(self.opslag[navn]['Forklaring'], self.opslag[navn]['Kort definition'], navn)
        # 46 før portion 9, 24 efter og 12 efter portion 10; tallet for hele ordbogen tælles nu i Portion11
        # (SPEC-ordbog-forklaringer-11.md). Ingen af de tolv er blandt de 51 nye opslag.
        self.assertFalse(set(self.DE_12) & set(KategorierOgNiveauer.NYE))

    def test_seks_rettede_definitioner_og_seks_uaendrede(self):
        for navn, tekst in {**self.DEFINITIONER, **self.UAENDREDE}.items():
            self.assertEqual(self.opslag[navn]['Kort definition'], tekst, navn)

    def test_procentspil_i_stedet_for_procentchance(self):
        self.assertNotIn('Procentchance', self.opslag)
        o = self.opslag['Procentspil']
        self.assertEqual((o['ID'], o['Engelsk'], o['Alternative termer'], o['Kategori'], o['Niveau']),
                         ('`procentspil`', 'Percentage play', 'Procentchance', self.AVANCERET, 'øvet'))
        self.assertNotIn('procentchance', self.side.ids)
        self.assertEqual(søg(self.side, 'procentchance'), ['procentspil'])
        self.assertEqual(søg(self.side, 'procentspil'), ['procentspil'])
        self.assertIn('procentspil', søg(self.side, 'percentage play'))

    def test_kast_ind_skvis_og_par_kontrakt_som_alternative_termer(self):
        self.assertEqual(self.opslag['Strip-squeeze']['Alternative termer'], 'Kast-ind-skvis')
        self.assertEqual(self.opslag['Optimal kontrakt']['Alternative termer'], 'Par-kontrakt')
        self.assertEqual(søg(self.side, 'kast-ind-skvis'), ['strip-squeeze'])
        self.assertEqual(søg(self.side, 'par-kontrakt'), ['optimal-kontrakt'])

    def test_relaterede_begreber_og_intet_link_mellem_slutspil_og_mortons_fork(self):
        for navn, rel in self.RELATEREDE.items():
            self.assertEqual(self.opslag[navn].get('Relaterede begreber'), rel, navn)
        self.assertEqual(self.opslag['Slutspil']['Relaterede begreber'], 'indspil, skvis, eliminering')
        self.assertNotIn('morton-s-fork', self.paa_siden['slutspil']['rel'])
        self.assertNotIn('slutspil', self.paa_siden['morton-s-fork']['rel'])
        self.assertIn('slutspil', self.paa_siden['skvis']['rel'])

    def test_indekserne_foelger_med(self):
        engelsk = {(r['engelsk'], r['id']) for r in self.bygget['indeks']}
        self.assertIn(('Percentage play', 'procentspil'), engelsk)
        self.assertNotIn('procentchance', {i for _, i in engelsk})
        dansk = [l for l in self.kilde[self.kilde.index('## Dansk-engelsk indeks'):].splitlines() if l.startswith('- **')]
        self.assertIn('- **Procentspil** → Percentage play', dansk)
        self.assertFalse([l for l in dansk if l.startswith('- **Procentchance** ')])
        # Procentspil står på sin alfabetiske plads mellem naboerne.
        i = dansk.index('- **Procentspil** → Percentage play')
        nøgle = lambda l: self.bygger.sorteringsnøgle(l[4:l.index('** →')])
        self.assertLessEqual(nøgle(dansk[i - 1]), nøgle(dansk[i]))
        self.assertLessEqual(nøgle(dansk[i]), nøgle(dansk[i + 1]))

    def test_slutspil_indspil_skvis_og_kast_ind_skvis_haenger_sammen(self):
        for navn in ('Indspil', 'Skvis', 'Strip-squeeze'):
            self.assertTrue(self.opslag[navn]['Kort definition'].startswith('En form for slutspil, hvor '), navn)
        self.assertTrue(self.opslag['Strip-squeeze']['Forklaring'].startswith('Strip-squeezen kaldes også kast-ind-skvis.'))
        self.assertIn('skvis og indspil efter hinanden', self.opslag['Strip-squeeze']['Forklaring'])
        self.assertIn('Indspil og skvis er de almindelige former for slutspil', self.opslag['Indspil']['Forklaring'])
        self.assertIn('Skvis og indspil er de almindelige former for slutspil', self.opslag['Skvis']['Forklaring'])
        self.assertIn('Morton\'s Fork er et kup og ikke et slutspil', self.opslag["Morton's Fork"]['Forklaring'])

    def test_eksemplerne_og_tallene(self):
        for navn, uddrag in (
                ('Begrænset valg', 'Med E K 10 3 2 på bordet og 7 6 5 4 på hånden indkasseres esset, og Øst lægger damen.'),
                ('Begrænset valg', 'vinder kipningen mod knægten i ca. 65 % mod ca. 35 % for at toppe farven'),
                ('Procentspil', 'vinder det at toppe farven i 53,1 %'),
                ('Procentspil', 'esset og derefter kipningen vinder i 51,4 %'),
                ('Procentspil', 'esset og kipningen vinder i 39,6 % og at toppe farven i 32,8 %'),
                ('Procentspil', 'huskereglen "Eight ever, nine never"'),
                ('Kortlæsning', 'sidder en manglende dame hos Øst i to af tre tilfælde'),
                ('Optimal kontrakt', 'Kan Nord-Syd vinde 4♥ i zonen (620), og går Øst-Vest kun to ned i 4♠ doblet uden for '
                                     'zonen (300)'),
                ('Optimal kontrakt', '5♥ en ned (−100) er ringere for Nord-Syd end 300 (§ 77)'),
                ('Skvis', 'Nord har ♠E B og ♥K, Syd ♠4, ♥2 og ♣E, og Vest har ♠K D og ♥E.'),
                ('Indspil', 'Syd har ♠E D og ♥3, Nord ♠4 3 og ♥2, og Vest har ♠K B og ♥E.'),
                ('Eliminering', 'Syd indkasserer først ♥E, så både hånden og bordet er renonce i hjerter'),
                ('Strip-squeeze', 'Nord har ♠4 3 og ♥5 4, Syd ♠E D, ♥3 og ♣E, og Vest har ♠K B og ♥E K.'),
                ('Vienna Coup', 'Syd spiller først ♥2 til ♥E, så ♥D bliver en trussel mod Østs ♥K'),
                ('Vienna Coup', 'James Clay'),
                ('Taber på taber', 'Vest spiller ♥K ud, bordet har ♠8, ♦E K 2 og ♣3 og ingen hjerter'),
                ("Morton's Fork", 'kardinal John Morton'),
                ('Åbne kort', 'Det engelske double-dummy (DD) betyder det samme')):
            self.assertIn(uddrag, self.opslag[navn]['Forklaring'], navn)


class Portion11(unittest.TestCase):
    """SPEC-ordbog-forklaringer-11.md (Franks valg 15. november 2026): Talemåder og bridgeslang og Onlinebridge og
    digitale turneringer. De elleve forklaringer, tre rettede definitioner, de relaterede begreber, det nye opslag
    RealBridge og Pivotbord fjernet. Bagefter gentager intet opslag sin definition."""

    TALEMAADER = 'Talemåder og bridgeslang'
    ONLINE = 'Onlinebridge og digitale turneringer'
    DE_11 = ['Byttehandel', 'Fanget på det gale ben', 'Kort tredje / honnør anden', 'Melde i den blå luft', 'Pointrytter',
             'Pokeransigt', 'Sælge ud', 'Unoder ved bordet', 'Urent trav', 'Bridge Base Online', 'Selvalert']
    DEFINITIONER = {
        'Sælge ud': 'At passe og lade modparten spille kontrakten på et lavt trin i stedet for at melde videre.',
        'Unoder ved bordet': 'Opførsel, der kan give makker ubeføjede oplysninger eller ødelægge stemningen, fx kommentarer '
                             'eller mimik.',
        'Urent trav': 'Bridgeslang for at udnytte ubeføjede oplysninger fra makker, fx makkers tøven.',
    }
    UAENDREDE = {
        'Bridge Base Online': 'En digital platform til bridge, undervisning og turneringer, ofte forkortet BBO.',
        'Selvalert': 'En procedure i onlinebridge, hvor spilleren selv oplyser modstanderne om sin meldings særlige betydning '
                     'uden at informere makker.',
        'Byttehandel': 'At gå lidt ned i sin egen kontrakt i stedet for at lade modparten vinde deres.',
        'Fanget på det gale ben': 'Man har spillet i en forkert rækkefølge og kan ikke komme det rigtige sted hen.',
        'Kort tredje / honnør anden': 'Måde at beskrive en farve på: honnøren plus i alt to eller tre kort, fx "kongen tredje".',
        'Melde i den blå luft': 'At melde uden reel dækning i hånden.',
        'Pointrytter': 'En spiller, der kun tæller point og overser fordeling og stikmuligheder.',
        'Pokeransigt': 'At holde et neutralt ansigt, så man ikke afslører noget for modparten.',
    }
    RELATEREDE = {'Bridge Base Online': 'robotbridge, selvalert', 'Selvalert': 'alertering, bridge-base-online',
                  'Byttehandel': 'offer, matchpoint', 'Fanget på det gale ben': 'forbindelser, indgang',
                  'Kort tredje / honnør anden': 'doubleton, fald', 'Melde i den blå luft': 'overmelding, psykisk-melding',
                  'Pointrytter': 'fordelingspoint', 'Pokeransigt': 'tempo, bridgeetik',
                  'Sælge ud': 'genaabning, konkurrencemelding', 'Unoder ved bordet': 'bridgeetik, ubefoejede-oplysninger',
                  'Urent trav': 'ubefoejede-oplysninger, toeven, korrigeret-score',
                  'RealBridge': 'bridge-base-online, selvalert'}

    @classmethod
    def setUpClass(cls):
        cls.kilde = KILDE.read_text(encoding='utf-8')
        cls.opslag = opslag_i_kilden()
        cls.side = læs_side()
        cls.paa_siden = {o['id']: o for o in cls.side.opslag}
        cls.bygget = hent_bygger().parse(cls.kilde)

    def test_de_11_har_deres_egen_forklaring_og_intet_opslag_gentager_definitionen(self):
        i_kategorierne = sorted(n for n, o in self.opslag.items() if o['Kategori'] in (self.TALEMAADER, self.ONLINE))
        self.assertEqual(i_kategorierne, sorted(self.DE_11 + ['Robotbridge', 'RealBridge']))
        for navn in i_kategorierne:
            self.assertNotEqual(self.opslag[navn]['Forklaring'], self.opslag[navn]['Kort definition'], navn)
        # 46 før portion 9, 24 efter, 12 efter portion 10 og 0 efter portion 11 (Pivotbord er fjernet).
        gentager = [n for n, o in self.opslag.items() if o['Forklaring'] == o['Kort definition']]
        self.assertEqual(gentager, [])

    def test_de_51_nye_opslag_har_alle_deres_egen_forklaring(self):
        nye = KategorierOgNiveauer.NYE
        self.assertEqual(len(nye), 51)
        self.assertEqual(KategorierOgNiveauer.MED_FORKLARING, set(nye))
        for navn in self.DE_11[:9]:
            self.assertIn(navn, nye, navn)
        for navn in nye:
            self.assertNotEqual(self.opslag[navn]['Forklaring'], self.opslag[navn]['Kort definition'], navn)

    def test_tre_rettede_definitioner_og_otte_uaendrede(self):
        for navn, tekst in {**self.DEFINITIONER, **self.UAENDREDE}.items():
            self.assertEqual(self.opslag[navn]['Kort definition'], tekst, navn)

    def test_relaterede_begreber(self):
        for navn, rel in self.RELATEREDE.items():
            self.assertEqual(self.opslag[navn].get('Relaterede begreber'), rel, navn)
        # Justeret score har id'et korrigeret-score; justeret-score findes ikke.
        self.assertEqual(self.opslag['Justeret score']['ID'], '`korrigeret-score`')
        self.assertIn('korrigeret-score', self.paa_siden['urent-trav']['rel'])

    def test_realbridge_er_et_nyt_opslag(self):
        o = self.opslag['RealBridge']
        self.assertEqual((o['ID'], o['Engelsk'], o['Niveau'], o['Kategori'], o['afsnit']),
                         ('`realbridge`', 'RealBridge', 'begynder', self.ONLINE, self.ONLINE))
        self.assertEqual(o['Kort definition'], 'En platform til onlinebridge, hvor spillerne ser og hører hinanden med kamera '
                                               'og mikrofon.')
        self.assertTrue(o['Forklaring'].startswith('RealBridge kører i browseren på computer eller tablet'))
        self.assertIn('(DBf\'s regler for online-turneringer, 2021)', o['Forklaring'])
        self.assertIn('realbridge', søg(self.side, 'realbridge'))
        engelsk = {(r['engelsk'], r['id']) for r in self.bygget['indeks']}
        self.assertIn(('RealBridge', 'realbridge'), engelsk)
        dansk = [l for l in self.kilde[self.kilde.index('## Dansk-engelsk indeks'):].splitlines() if l.startswith('- **')]
        self.assertIn('- **RealBridge** → RealBridge', dansk)

    def test_pivotbord_er_fjernet(self):
        self.assertNotIn('Pivotbord', self.opslag)
        self.assertNotIn('pivotbord', self.side.ids)
        self.assertNotIn('pivotbord', self.kilde.lower())
        self.assertNotIn('Pivot table', {r['engelsk'] for r in self.bygget['indeks']})
        for o in self.side.opslag:
            self.assertNotIn('pivotbord', o['rel'], o['id'])
        # Pivot (holdformen) står uændret.
        self.assertEqual(self.opslag['Pivot']['ID'], '`pivot`')
        self.assertIn('pivot', self.side.ids)

    def test_indekserne_staar_i_orden(self):
        ord_ = [r['engelsk'] for r in self.bygget['indeks']]
        self.assertEqual(ord_, sorted(ord_, key=str.casefold))

    def test_eksemplerne_kilderne_og_oprindelsen(self):
        for navn, uddrag in (
                ('Bridge Base Online', 'siden 16. december 2025 kører den på motoren GIBBO med samme system'),
                ('Bridge Base Online', '(DBf\'s regler for online-turneringer, 2021)'),
                ('Selvalert', 'Ved bordet alerterer melderens makker, men på BBO alerterer spilleren sin egen melding'),
                ('Selvalert', 'kan arrangøren i stedet vælge alertreglerne fra bordet'),
                ('Byttehandel', 'koster 3♠ en ned uden for zonen 50, eller 100 doblet'),
                ('Byttehandel', '(§ 77)'),
                ('Fanget på det gale ben', 'Udtrykket kommer fra sporten'),
                ('Kort tredje / honnør anden', 'Ordbog over det danske Sprog (bind 1, 1919)'),
                ('Melde i den blå luft', '"grebet ud af den blå luft"'),
                ('Pointrytter', 'som Bridgesystem åbner efter 20-reglen: 11 hp og to femfarver giver 21'),
                ('Pokeransigt', '(§ 74C2)'),
                ('Pokeransigt', '(§ 73D2)'),
                ('Sælge ud', 'Det er ikke altid forkert at sælge ud'),
                ('Unoder ved bordet', '(§ 74C2, C5 og C6)'),
                ('Unoder ved bordet', 'modsætning til det forældede noder'),
                ('Urent trav', '(§ 16B1a)'),
                ('Urent trav', 'Udtrykket kommer fra travsporten'),
                # Franks afgørelse før fletningen: neutral form, for ordbogen bruger ikke "jeg".
                ('Byttehandel', 'Hvornår ordet kom ind i bridgesproget, står ikke i ordbøgerne.'),
                ('Sælge ud', 'Hvornår ordet kom ind i bridgesproget, står ikke i ordbøgerne.'),
                ('Pointrytter', 'Ordet står ikke i Den Danske Ordbog, og dets oprindelse er ikke fundet.')):
            self.assertIn(uddrag, self.opslag[navn]['Forklaring'], navn)
        # Uden for citater (fx "Jeg havde kongen anden i hjerter" i Kort tredje / honnør anden).
        for navn, o in self.opslag.items():
            self.assertNotRegex(re.sub(r'"[^"]*"', '', o['Forklaring']), r'\b[Jj]eg\b', navn)


class Markeringer(unittest.TestCase):
    """SPEC-ordbog-markeringer.md (Franks afgørelse 15. november 2026): Makker 2 spiller markeringerne som Bridgesystem,
    lavt kort = kald og lavt kort = lige antal. Bridgesystem bruger antal ved ny farve og efter konge-udspil, og 2 over 1 –
    Moderne majorstøtte, når attitude er kendt, eller spilfører angriber farven. Lavinthal er uændret."""

    NY = {
        'Fordelingssignal': ('Internationalt viser højt-lavt et lige antal og lavt-højt et ulige. Begge husets systemer spiller '
                             'det omvendt: lavt kort = lige antal og højt kort = ulige (Malmømarkeringer). Bridgesystem bruger '
                             'antal, når spilfører spiller en ny farve, og efter makkers konge-udspil, og 2 over 1 – Moderne '
                             'majorstøtte, når attitude er kendt, eller spilfører angriber farven.'),
        'Kald-afvisning': ('Begge husets systemer spiller lavt kort = kald og højt = afvisning: Bridgesystem efter es-udspil, '
                           'når makker skifter farve, og ved første afkast mod farvekontrakt, og 2 over 1 – Moderne '
                           'majorstøtte på makkers udspil mod både farve og sans.'),
        'Lige antal': ('Internationalt vises det med højt-lavt. Begge husets systemer viser det med et lavt kort (lavt-højt): '
                       'Bridgesystem, når spilfører spiller en ny farve, og efter makkers konge-udspil (Malmømarkering), og 2 '
                       'over 1 – Moderne majorstøtte, når attitude er kendt, eller spilfører angriber farven.'),
        'Ulige antal': ('Internationalt vises det med lavt-højt. Begge husets systemer viser det med et højt kort (højt-lavt): '
                        'Bridgesystem, når spilfører spiller en ny farve, og efter makkers konge-udspil (Malmømarkering), '
                        'hvor fx 9\'eren lægges fra 9 8 7 6 4, og 2 over 1 – Moderne majorstøtte, når attitude er kendt, '
                        'eller spilfører angriber farven.'),
        'Modspilssignal': ('og parret aftaler, hvilken der gælder hvornår. Begge husets systemer spiller lavt kort = kald og '
                           'lavt kort = lige antal. I 2 over 1 – Moderne majorstøtte kommer kald og afvisning først'),
    }
    UAENDREDE = {
        'Afkast': 'I 2 over 1 – Moderne majorstøtte er afkastet i en uinteressant farve Lavinthal: et højt kort beder om '
                  'den højeste af de to øvrige farver, et lavt om den laveste.',
        'Lavinthal-signal': 'I 2 over 1 – Moderne majorstøtte er Lavinthal en afkastmarkering, der først gælder, når kald og '
                            'afvisning ikke har mere at sige.',
        'Malmømarkering': 'Bridgesystem bruger Malmømarkeringer, når spilfører spiller en ny farve, og efter makkers '
                          'konge-udspil',
        'Farvepræferencesignal': 'Signalet kaldes også Lavinthal, og både Konventionstrænerens kort Lavinthal og 2 over 1 – '
                                 'Moderne majorstøtte bruger det.',
    }

    @classmethod
    def setUpClass(cls):
        cls.opslag = opslag_i_kilden()

    def test_de_fem_opslag_siger_lavt_kald_og_lavt_lige_for_begge_systemer(self):
        for navn, tekst in self.NY.items():
            self.assertIn(tekst, self.opslag[navn]['Forklaring'], navn)

    def test_ingen_forklaring_har_den_gamle_retning_for_2_over_1(self):
        for navn, o in self.opslag.items():
            for gammel in ('Moderne majorstøtte spiller højt kort = kald', 'sådan spiller 2 over 1 – Moderne majorstøtte',
                           'højt-lavt, og sådan spiller', 'lavt-højt, og sådan spiller'):
                self.assertNotIn(gammel, o['Forklaring'], navn)

    def test_afkast_og_lavinthal_er_uaendrede(self):
        for navn, tekst in self.UAENDREDE.items():
            self.assertIn(tekst, self.opslag[navn]['Forklaring'], navn)


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
        # Sidefoden står sidst; forsiden har også et afsnit, der hedder Opslag.
        trænere = html.rfind('>Trænere</h2>')
        opslag = html.rfind('>Opslag</h2>')
        self.assertGreater(trænere, 0, sti)
        self.assertGreater(opslag, trænere, f'{sti}: Opslag skal stå efter Trænere')
        rest = html[opslag:html.find('</nav>', opslag)]
        self.assertRegex(rest, r'<a href="/ordbog/"[^>]*>Bridgeordbog</a>', sti)
        self.assertRegex(rest, r'<a href="/fordelingstraeneren/#analyse"[^>]*>Analyse</a>', sti)
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


class Lovhenvisninger(unittest.TestCase):
    """SPEC-ordbog-lovhenvisninger.md (Franks valg 11. november 2026): henvisninger i formen fra Love for Turneringsbridge
    2017 (DBf's danske udgave), lovenes definitioner med bogens ord og lovens ord i Afgivelse af stik og Forkert oplysning."""

    @classmethod
    def setUpClass(cls):
        cls.opslag = opslag_i_kilden()

    def test_bogens_henvisningsform(self):
        for navn, o in self.opslag.items():
            for felt in ('Kort definition', 'Forklaring'):
                self.assertIsNone(re.search(r'§ \d+ [A-H]\b', o.get(felt, '')), (navn, felt))

    def test_lovenes_definitioner_med_danske_ord(self):
        for navn, o in self.opslag.items():
            self.assertIsNone(re.search(r'definition af (infraction|play period|artificial call|misinformation)\b',
                                        o.get('Forklaring', '')), navn)

    def test_dansk_nummerering(self):
        # WBF's § 73A2 (obligatoriske pauser) er § 73A1 i den danske udgave.
        self.assertIn('(§ 73A1)', self.opslag['Lang tænkepause']['Forklaring'])

    def test_lovens_ord(self):
        self.assertIn('Lovene kalder det afkald på stik', self.opslag['Afgivelse af stik']['Forklaring'])
        self.assertIn('Lovene kalder det misinformation', self.opslag['Forkert oplysning']['Forklaring'])
        # SPEC-ordbog-forklaringer-8.md: bogens § 23 hedder "Tilsvarende melding".
        self.assertIn('Lovene kalder den en tilsvarende melding (§ 23).', self.opslag['Sammenlignelig melding']['Forklaring'])
        self.assertIn('kan et fordækt udspil uden for tur dog tages tilbage uden turneringslederen',
                      self.opslag['Med bagsiden opad']['Forklaring'])


if __name__ == '__main__':
    unittest.main()
