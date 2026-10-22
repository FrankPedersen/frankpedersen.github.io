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
    ud = [(sti, dansk_html((ROD / sti).read_text(encoding='utf-8'))) for sti in ('index.html', 'om-mig/index.html')]
    ordbog = (ROD / 'ordbog' / 'index.html').read_text(encoding='utf-8')
    ud.append(('ordbog/index.html', dansk_html(re.sub(r'<!-- opslag -->.*?<!-- /opslag -->', ' ', ordbog, flags=re.S))))
    markdown = (ROD / 'ordbog' / 'Dansk_bridgeordbog.md').read_text(encoding='utf-8')
    ud.append(('ordbog/Dansk_bridgeordbog.md',
               '\n'.join(linje for linje in markdown.splitlines() if not linje.startswith('**Alternative termer:**'))))
    return ud


class Fagord(unittest.TestCase):
    def test_sidens_danske_tekster_bruger_husets_ord(self):
        for navn, tekst in dansk_tekst():
            self.assertEqual(fund(tekst), [], navn)

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
