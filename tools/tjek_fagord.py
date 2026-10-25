"""Fagordstest (SPEC-sprog-og-ordbog.md, Den varige kontrol): husets fagord i al dansk tekst på siden.

    python tools/tjek_fagord.py

Testen læser forsiden, Om mig og ordbogssidens egne tekster og fejler, hvis et af husets "Ikke"-ord står der.
Ordbogens opslag må have de andre ord som alternative termer, der peger på husets ord; derfor læses ordbogens
markdown uden linjerne med alternative termer, og ordbogssidens opslag og indeks springes over (de bygges fra den).
"""
import pathlib
import re
import unittest

ROD = pathlib.Path(__file__).resolve().parent.parent

# Husets "Ikke"-ord og det ord, der skal stå i stedet. "i snit" (gennemsnit) er tilladt.
IKKE_ORD = [
    (re.compile(r'\bdobbeltknib\w*', re.I), 'dobbelt kipning'),
    (re.compile(r'\bknib\w*', re.I), 'kipning, kippe'),
    (re.compile(r'\bsnit(?:tet|ter|tene)?\b', re.I), 'kipning'),
    (re.compile(r'\bblindemand\w*', re.I), 'bordet'),
    (re.compile(r'\bden blinde\b', re.I), 'bordet'),
    (re.compile(r'\bbroer(?:ne)?\b', re.I), 'forbindelser, indgang'),
    # T1–T3 (Franks svar 22. oktober 2026): hp, doubleton og fittet i dansk tekst
    (re.compile(r'\bdobbeltton\w*', re.I), 'doubleton'),
    (re.compile(r'\bfittens?\b', re.I), 'fittet'),
    (re.compile(r'\bHCP\b'), 'hp'),
    # Et fit, som passer med fittet (Franks valg 22. oktober 2026): en fit, en major-fit, en 8+ major-fit …
    (re.compile(r'\ben\s+(?:\S+\s+)?(?:[0-9a-zæøå+]+-)*fit\b', re.I), 'et fit'),
]
I_SNIT = re.compile(r'\bi\s+$', re.I)


def fund(tekst):
    """Alle "Ikke"-ord i teksten som (ordet, husets ord)."""
    ud = []
    for mønster, husets in IKKE_ORD:
        for m in mønster.finditer(tekst):
            if m.group(0).lower() == 'snit' and I_SNIT.search(tekst[max(0, m.start() - 3):m.start()]):
                continue
            ud.append((m.group(0), husets))
    return ud


def dansk_html(html):
    """Sidens danske tekst: uden stilark og uden de engelske udgaver i data-en-attributterne."""
    html = re.sub(r'<style>.*?</style>', ' ', html, flags=re.S)
    return re.sub(r'\sdata-en(?:-[a-z]+)?="[^"]*"', ' ', html)


def dansk_tekst():
    """(navn, tekst) for al dansk tekst på siden."""
    ud = [(sti, dansk_html((ROD / sti).read_text(encoding='utf-8'))) for sti in ('index.html', 'om-mig/index.html', 'scoring/index.html')]
    # Scoring i bridge: kilden er Franks markdown (SPEC-scoring.md)
    ud.append(('scoring/Scoring_i_bridge.md', (ROD / 'scoring' / 'Scoring_i_bridge.md').read_text(encoding='utf-8')))
    # Opslagene, indekset og den strukturerede data bygges fra markdown, som tjekkes for sig nedenfor.
    ordbog = (ROD / 'ordbog' / 'index.html').read_text(encoding='utf-8')
    ordbog = re.sub(r'<!-- opslag -->.*?<!-- /opslag -->', ' ', ordbog, flags=re.S)
    ordbog = re.sub(r'<script type="application/ld\+json">.*?</script>', ' ', ordbog, flags=re.S)
    ud.append(('ordbog/index.html', dansk_html(ordbog)))
    # Ordbogens markdown uden de alternative termer og det engelske (Engelsk-feltet og indekslinjerne).
    markdown = (ROD / 'ordbog' / 'Dansk_bridgeordbog.md').read_text(encoding='utf-8')
    ud.append(('ordbog/Dansk_bridgeordbog.md',
               '\n'.join(linje for linje in markdown.splitlines()
                         if not linje.startswith(('**Alternative termer:**', '**Engelsk:**')) and ' → ' not in linje)))
    return ud


class Fagord(unittest.TestCase):
    def test_sidens_danske_tekster_bruger_husets_ord(self):
        for navn, tekst in dansk_tekst():
            self.assertEqual(fund(tekst), [], navn)

    def test_husets_ord_t1_til_t3(self):
        self.assertEqual(fund('12 HCP'), [('HCP', 'hp')])
        self.assertEqual(fund('dobbeltton i klør'), [('dobbeltton', 'doubleton')])
        self.assertEqual(fund('når fitten er fundet'), [('fitten', 'fittet')])
        self.assertEqual(fund('ikke det samme som en fit'), [('en fit', 'et fit')])
        self.assertEqual(fund('med en 8+ major-fit'), [('en 8+ major-fit', 'et fit')])
        self.assertEqual(fund('fittens farve'), [('fittens', 'fittet')])
        self.assertEqual(fund('12 hp, doubleton i klør, og fittet er fundet; et 4-3-fit'), [])
        self.assertEqual(fund('<td data-en="10+ HCP">10+ hp</td>'.replace(' data-en="10+ HCP"', '')), [])

    def test_fejler_hvis_man_skriver_knibning(self):
        self.assertEqual(fund('Spil en knibning mod damen.'), [('knibning', 'kipning, kippe')])
        self.assertTrue(fund('Han kniber mod kongen.'))
        self.assertTrue(fund('En dobbeltknibning'))
        self.assertTrue(fund('Læg kortene på blindemand.'))
        self.assertTrue(fund('Den blinde lægger lavt.'))
        self.assertTrue(fund('Der er ingen broer til bordet.'))
        self.assertTrue(fund('Et snit mod damen.'))

    def test_i_snit_er_tilladt(self):
        self.assertEqual(fund('I snit giver linjen 9 stik.'), [])
        self.assertEqual(fund('Det giver i snit 2,3 stik.'), [])
        self.assertEqual(fund('gennemsnit og kipning'), [])


if __name__ == '__main__':
    unittest.main()
