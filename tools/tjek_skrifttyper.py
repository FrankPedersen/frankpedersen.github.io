"""Accepttest: skrifttyperne ligger på sitet selv (SPEC-privatlivstekst.md, Franks udvidelse 25. oktober 2026).

    python tools/tjek_skrifttyper.py

Ingen fil i repoet henviser til Google Fonts, siderne henter fonts/tekst.css (og fonts/symboler.css, hvor de brugte
Noto Sans Symbols 2 før), og hver skrifttype, CSS'en nævner, findes i fonts/. At Chrome tegner siderne med
skrifttyperne fra sitet, tjekkes med `node tools/tjek_skrifttyper.mjs`.
"""
import pathlib
import re
import subprocess
import unittest

ROD = pathlib.Path(__file__).resolve().parent.parent
GOOGLE = ('fonts.' + 'googleapis.com', 'fonts.' + 'gstatic.com')
SIDER = {'index.html': ('fonts/tekst.css', 'fonts/symboler.css'),
         'om-mig/index.html': ('../fonts/tekst.css',),
         'ordbog/index.html': ('../fonts/tekst.css', '../fonts/symboler.css')}


def filer():
    ud = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard'], cwd=ROD, capture_output=True, text=True,
                        encoding='utf-8').stdout.split('\n')
    return [f for f in ud if f and (ROD / f).is_file() and not f.endswith(('.woff2', '.png', '.jpg', '.ico'))]


class Skrifttyperne(unittest.TestCase):
    def test_ingen_fil_henviser_til_google_fonts(self):
        for f in filer():
            tekst = (ROD / f).read_text(encoding='utf-8', errors='ignore')
            for g in GOOGLE:
                self.assertNotIn(g, tekst, f)

    def test_siderne_henter_skrifttyperne_fra_sitet(self):
        for side, css in SIDER.items():
            html = (ROD / side).read_text(encoding='utf-8')
            links = re.findall(r'<link rel="stylesheet" href="([^"]*fonts/[^"]*)">', html)
            self.assertEqual(tuple(links), css, side)
            self.assertNotIn('rel="preconnect"', html, side)

    def test_ordbogens_bygger_skriver_det_samme(self):
        bygger = (ROD / 'tools' / 'build_ordbog.py').read_text(encoding='utf-8')
        self.assertIn('<link rel="stylesheet" href="../fonts/tekst.css">', bygger)
        self.assertIn('<link rel="stylesheet" href="../fonts/symboler.css">', bygger)

    def test_hver_skrifttype_findes_og_er_woff2(self):
        for css in ('tekst.css', 'symboler.css'):
            tekst = (ROD / 'fonts' / css).read_text(encoding='utf-8')
            filer_ = re.findall(r"url\('([^']+)'\)", tekst)
            self.assertTrue(filer_, css)
            for f in filer_:
                sti = ROD / 'fonts' / f
                self.assertTrue(sti.is_file(), f)
                self.assertEqual(sti.read_bytes()[:4], b'wOF2', f)

    def test_familierne_og_vaegtene_som_foer(self):
        tekst = (ROD / 'fonts' / 'tekst.css').read_text(encoding='utf-8')
        par = set(re.findall(r"font-family: '([^']+)';\s*font-style: normal;\s*font-weight: (\d+);", tekst))
        self.assertEqual(par, {('Inter', '400'), ('Inter', '600'), ('Manrope', '800')})
        self.assertIn("font-family: 'Noto Sans Symbols 2'", (ROD / 'fonts' / 'symboler.css').read_text(encoding='utf-8'))
        self.assertNotIn('font-display: block', tekst)

    def test_licenserne_ligger_ved_skrifttyperne(self):
        for navn in ('Inter', 'Manrope', 'Noto-Sans-Symbols-2'):
            self.assertIn('SIL OPEN FONT LICENSE', (ROD / 'fonts' / f'OFL-{navn}.txt').read_text(encoding='utf-8').upper())


if __name__ == '__main__':
    unittest.main()
