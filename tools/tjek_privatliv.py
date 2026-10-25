"""Accepttest for privatlivsteksten på Om mig, den private systemdokumentation og reglen i CLAUDE.md
(SPEC-privatlivstekst.md).

    python tools/tjek_privatliv.py

Placeringen under formularen, kontrasten og bredden ved 390 px tjekkes i Chrome med `node tools/tjek_privatliv.mjs`;
formularen tjekkes som før med `tools/tjek_kontakt.py` og `tools/tjek_kontakt.mjs`.
"""
import html
import pathlib
import re
import subprocess
import unittest

ROD = pathlib.Path(__file__).resolve().parent.parent
SIDE = ROD / 'om-mig' / 'index.html'
SYSTEM = ROD / 'docs' / 'SYSTEM.md'
FOER = 'v-foer-privatliv'

DANSK = ('Om dine oplysninger. Når du sender en besked, går dit navn, din e-mail og din besked gennem Microsoft Azure '
         'til min e-mail, så jeg kan svare dig. Siden gemmer ikke beskeden. Jeg sletter beskeder fra formularen og mine '
         'svar senest 14 dage efter, at jeg har modtaget dem. Din IP-adresse bruges kun i op til 15 minutter til at stoppe '
         'spam og gemmes ikke. Vil du vide, hvad jeg har om dig, eller have det slettet før, så skriv det her. '
         'Dataansvarlig: Frank Pedersen.')
ENGELSK = ('About your information. When you send a message, your name, e-mail and message go through Microsoft Azure to '
           'my e-mail so I can reply. The site does not store the message. I delete messages from the form and my replies '
           'no later than 14 days after I receive them. Your IP address is used for up to 15 minutes only to stop spam and '
           'is not stored. If you want to know what I hold about you, or want it deleted sooner, write to me here. '
           'Data controller: Frank Pedersen.')

# Reglen i CLAUDE.md (specen, med Franks valg 25. oktober 2026: filen er privat og ligger kun lokalt)
REGEL = ['**Systemdokumentation:**', 'docs/SYSTEM.md', 'beslutningsloggen og datoen øverst',
         'Hemmeligheder skrives aldrig i filen.']


def ren(tekst):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', tekst))).strip()


def git(*args):
    return subprocess.run(['git', *args], cwd=ROD, capture_output=True, text=True, encoding='utf-8')


def privatliv(side):
    """Afsnittet med privatlivsteksten: (attributterne som tekst, indholdet)."""
    m = re.search(r'<p class="om-privat"([^>]*)>(.*?)</p>', side, re.S)
    return (m.group(1), m.group(2)) if m else (None, None)


class Teksten(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.side = SIDE.read_text(encoding='utf-8')
        cls.attr, cls.indhold = privatliv(cls.side)

    def test_teksten_staar_i_boksen_kontakt_under_formularen(self):
        self.assertIsNotNone(self.indhold, 'mangler <p class="om-privat">')
        boks = self.side[self.side.index('<aside class="om-kontakt"'):self.side.index('</aside>')]
        self.assertIn('<p class="om-privat"', boks)
        self.assertLess(boks.index('</form>'), boks.index('<p class="om-privat"'))

    def test_dansk_som_i_specen_med_fed_overskrift(self):
        self.assertEqual(ren(self.indhold), DANSK)
        self.assertTrue(self.indhold.strip().startswith('<strong>Om dine oplysninger.</strong>'))

    def test_engelsk_i_data_en_med_fed_overskrift(self):
        m = re.search(r'data-en="([^"]*)"', self.attr or '')
        self.assertIsNotNone(m, 'mangler data-en')
        en = html.unescape(m.group(1))
        self.assertEqual(ren(en), ENGELSK)
        self.assertTrue(en.startswith('<strong>About your information.</strong>'))

    def test_14_dage_15_minutter_og_den_dataansvarlige(self):
        for del_ in ('14 dage', '15 minutter', 'Dataansvarlig: Frank Pedersen.'):
            self.assertIn(del_, ren(self.indhold))
        for del_ in ('14 days', '15 minutes', 'Data controller: Frank Pedersen.'):
            self.assertIn(del_, ENGELSK)

    def test_lille_tekst_med_eksisterende_vaerdier(self):
        m = re.search(r'\.om-privat\s*\{([^}]*)\}', self.side)
        self.assertIsNotNone(m, 'mangler stilen .om-privat')
        stil = m.group(1)
        self.assertIn('font-size:14px', stil.replace(' ', ''))
        self.assertIn('line-height:20px', stil.replace(' ', ''))
        # Kun værdier, siden allerede bruger
        før = git('show', f'{FOER}:om-mig/index.html').stdout
        for værdi in re.findall(r':\s*([^;]+)', stil):
            self.assertIn(værdi.strip(), før, værdi)

    def test_formularen_scriptet_og_resten_af_siden_er_uaendrede(self):
        før = git('show', f'{FOER}:om-mig/index.html').stdout
        self.assertTrue(før, f'tagget {FOER} mangler')
        uden = lambda s: re.sub(r'\n\.om-privat\s*\{[^}]*\}', '', re.sub(r'\s*<p class="om-privat".*?</p>', '', s, flags=re.S))
        self.assertEqual(uden(self.side), før)


class Systemdokumentationen(unittest.TestCase):
    def test_docs_system_md_findes(self):
        self.assertTrue(SYSTEM.is_file())

    def test_den_er_privat_og_kommer_ikke_paa_github(self):
        self.assertEqual(git('check-ignore', '-q', 'docs/SYSTEM.md').returncode, 0, 'docs/SYSTEM.md står ikke i .gitignore')
        self.assertEqual(git('ls-files', 'docs/SYSTEM.md').stdout.strip(), '')
        self.assertEqual(git('ls-files', '--cached', 'docs').stdout.strip(), '')

    def test_ingen_hemmeligheder(self):
        tekst = SYSTEM.read_text(encoding='utf-8')
        for mønster in (r'endpoint=https?://', r'accesskey=', r'AccountKey=', r'InstrumentationKey=', r'SharedAccessSignature',
                        r'[\w.+-]+@(?!kontraktbridge\.dk)[\w-]+\.(?:com|dk|net)'):
            self.assertIsNone(re.search(mønster, tekst, re.I), mønster)


class Reglen(unittest.TestCase):
    def test_claude_md_i_dette_repo(self):
        tekst = (ROD / 'CLAUDE.md').read_text(encoding='utf-8')
        for del_ in REGEL:
            self.assertIn(del_, tekst)
        # CLAUDE.md committes (Franks valg): den må ikke stå i .gitignore
        self.assertNotEqual(git('check-ignore', '-q', 'CLAUDE.md').returncode, 0, 'CLAUDE.md står i .gitignore')

    def test_de_to_andre_repoer(self):
        for repo in ('Fordelingstræneren', 'Konventionstræner'):
            sti = ROD.parent / repo / 'CLAUDE.md'
            if not sti.exists():
                self.skipTest(f'{repo} ligger ikke ved siden af dette repo')
            tekst = sti.read_text(encoding='utf-8')
            for del_ in REGEL:
                self.assertIn(del_, tekst, repo)
            self.assertIn('githubUpload', tekst, repo)


if __name__ == '__main__':
    unittest.main()
