"""Accepttest for kontaktformularen på Om mig (SPEC-kontaktformular.md, del 2): opbygningen og at e-mailadressen er væk.

    python tools/tjek_kontakt.py

Formularens opførsel (afsendelse, svar og skærmlæsere) tjekkes i Chrome med `node tools/tjek_kontakt.mjs`.
"""
import pathlib
import re
import unittest
from html.parser import HTMLParser

ROD = pathlib.Path(__file__).resolve().parent.parent
SIDE = ROD / 'om-mig' / 'index.html'
API = 'https://kontraktbridge-kontakt.azurewebsites.net/api/contact'


class Formular(HTMLParser):
    """Elementerne inde i boksen Kontakt (aside.om-kontakt) med deres attributter."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elementer = []
        self.tekst = []
        self._i_boks = 0
        self._label = None
        self.labels = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'aside' and 'om-kontakt' in a.get('class', '').split():
            self._i_boks = 1
            return
        if not self._i_boks:
            return
        if tag not in ('input', 'br', 'img'):
            self._i_boks += 1
        self.elementer.append((tag, a))
        if tag == 'label':
            self._label = [a.get('for'), '']

    def handle_endtag(self, tag):
        if not self._i_boks:
            return
        if tag == 'label' and self._label:
            self.labels[self._label[0]] = self._label[1].strip()
            self._label = None
        self._i_boks -= 1

    def handle_data(self, data):
        if self._i_boks:
            self.tekst.append(data)
            if self._label:
                self._label[1] += data


def læs():
    f = Formular()
    f.feed(SIDE.read_text(encoding='utf-8'))
    return f


class Kontaktformularen(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = SIDE.read_text(encoding='utf-8')
        cls.f = læs()
        cls.felter = {a.get('name'): (tag, a) for tag, a in cls.f.elementer if tag in ('input', 'textarea')}

    def test_e_mailadressen_staar_ikke_paa_siden(self):
        self.assertNotIn('frank.steen.pedersen', self.html)
        self.assertNotIn('mailto:', self.html)
        # De eneste adresser er pladsholderen i e-mailfeltet på dansk og engelsk.
        self.assertEqual(set(re.findall(r'[\w.+-]+@[\w-]+\.(?:com|dk|net)', self.html)) - {'din@email.dk', 'your@email.com'}, set())

    def test_boksen_beholder_overskriften_og_har_den_nye_indledning(self):
        tekst = re.sub(r'\s+', ' ', ' '.join(self.f.tekst))
        self.assertIn('Kontakt', tekst)
        self.assertIn('Har du fundet en fejl, eller har du en idé til en ny træner? Skriv til mig her. Jeg læser alle beskeder.', tekst)

    def test_felterne_med_etiketter_pladsholdere_og_krav(self):
        navn, email, besked = self.felter['name'], self.felter['email'], self.felter['message']
        for (tag, a), etiket, pladsholder, længde in (
            (navn, 'Navn', 'Hvad skal jeg kalde dig?', '120'),
            (email, 'E-mail', 'din@email.dk', '254'),
            (besked, 'Besked', 'Fx en fejl, du har fundet, eller en idé til en ny træner', '5000'),
        ):
            self.assertIn('required', a, etiket)
            self.assertEqual(a.get('maxlength'), længde, etiket)
            self.assertEqual(a.get('placeholder'), pladsholder, etiket)
            self.assertEqual(self.f.labels.get(a.get('id')), etiket, etiket)
        self.assertEqual(email[1].get('type'), 'email')
        self.assertEqual(besked[0], 'textarea')
        self.assertEqual(besked[1].get('rows'), '5')

    def test_honeypot_er_skjult_for_brugere_og_skaermlaesere(self):
        tag, a = self.felter['website']
        self.assertEqual(a.get('tabindex'), '-1')
        self.assertEqual(a.get('autocomplete'), 'off')
        self.assertEqual(self.f.labels.get(a.get('id')), 'Lad dette felt stå tomt')
        indpakning = [b for t, b in self.f.elementer if 'om-felt-skjult' in b.get('class', '').split()]
        self.assertTrue(indpakning, 'honeypot-feltet skal stå i et skjult element')
        self.assertEqual(indpakning[0].get('aria-hidden'), 'true')
        self.assertRegex(self.html, r'\.om-felt-skjult\s*\{[^}]*(?:position:\s*absolute|display:\s*none)')

    def test_knappen_svaret_og_uden_javascript(self):
        knapper = [(t, a) for t, a in self.f.elementer if t == 'button']
        self.assertEqual(len(knapper), 1)
        self.assertEqual(knapper[0][1].get('type'), 'submit')
        self.assertIn('Send besked', ''.join(self.f.tekst))
        self.assertIn('aria-live="polite"', self.html)
        self.assertRegex(self.html, r'<noscript>\s*<p[^>]*>Formularen kræver JavaScript\.</p>\s*</noscript>')

    def test_scriptet_sender_til_funktionens_adresse_uden_bibliotek(self):
        self.assertIn(f"const KONTAKT_API = '{API}'", self.html)
        self.assertIn('Beskeden kunne ikke sendes. Prøv igen senere.', self.html)
        self.assertNotRegex(self.html, r'<script[^>]+src=')


if __name__ == '__main__':
    unittest.main()
