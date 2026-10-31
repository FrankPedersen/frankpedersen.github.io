"""Bydeformtest (SPEC-beskrivende-form.md; husets regel i ../CLAUDE.md, Franks valg 30. oktober 2026): instruktioner og
forklaringer skrives i beskrivende form, ikke i bydeform. Knapper og links og navnene på opgaver og øvelser er undtaget.

    python tools/tjek_bydeform.py

Testen læser samme danske tekst som tools/tjek_fagord.py og desuden sidernes danske attributter (meta-beskrivelser,
aria-label, placeholder, title), de danske strenge i scripts, regnemaskinernes modul scoring/beregn.js og kontakt-API'ets
svar (_kontakt-api/src/contact-messages.js). Den fejler, hvis en sætning eller et led efter kolon eller semikolon begynder
med et udsagnsord i bydeform. Ordbogens opslagsord er navne og springes over.
"""
import html
import pathlib
import re
import sys
import unittest

ROD = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROD / 'tools'))
from tjek_fagord import dansk_tekst  # noqa: E402

# Udsagnsord i bydeform, der kan stå først i en dansk instruktion. "Pas" og "lav" mangler med vilje: det er meldingen og
# tillægsordet. Som Fordelingstrænerens src/sprog/bydeform.ts plus de ord, forsiden og konventionstræneren brugte.
BYDEFORMER = set('''
afbryd angiv annullér behold bemærk brug byg eksportér erstat find fjern flyt fold følg fortsæt gem gentag giv gruppér
gå gæt hent hold husk importér indsæt kig kip klik kom kopiér kryds lad luk lås læg læs markér navngiv noter notér
nulstil opdatér overskriv prøv regn ret ryd sammenlign se send sikr skift skriv slet slå spil spring start stop svar sæt
tag tast tjek træk tryk tæl tænk udfyld udled undgå vent vis vælg vurdér øv åbn
træn søg filtrér skjul lær spørg indtast bekræft tilføj vend afslut overvej meld byd dobl doble genmeld genåbn kæmp ofr
kontrollér vær bliv gør glem sørg gennemgå lån sælg udskriv
'''.split())

# Knapper, links og navne, der bliver i bydeform (gruppe 1 og 2 i docs/specs/beskrivende-form.md). Et regulært udtryk
# dækker en tekst med et indsat navn eller tal.
UNDTAGELSER = [
    # Knapper og links
    'Se trænerne',
    'Se trænerne →',
    'Åbn træneren →',
    'Åbn analysen →',
    'Åbn →',
    'Send besked',
    'Regn en score',
    'Tilføj score',
    'Vis for ØV',
    'Fjern scoren',
    'Fjern score',
    re.compile(r'^Vis regnestykket for\b'),
    'Prøv igen senere.',
    'Prøv selv',
    # Ordbogens etiketter for skærmlæsere
    'Søg og filtrér',
    'Spring til bogstav',
]

# Sætninger, der begynder med et af ordene, men ikke er bydeform.
FALSKE_TRÆF = [
    re.compile(r'^Spil i kampen\b'),  # scoringens tabel: antal spil
]

PREFIX = re.compile(r'^[\s"\'“„«(\[▶→←↓↑✓✗·•–—#*>-]*')
# Sætninger (ikke efter forkortelser som "pr." og "fx."; også efter "**Råd.**"), led efter kolon og semikolon (også
# "**Råd:**") og linjer.
SPLIT = re.compile(r'(?<=[.!?])(?<!\b[Pp]r\.)(?<!\b[Cc]a\.)(?<!\b[Ff]x\.)(?<!\b[Kk]l\.)(?<!\b[Nn]r\.)\**\s+|[:;]\**\s+|\n+')
STRENG = r"""'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*\""""
# Kommentarer og strenge i et script, fra venstre mod højre, så en apostrof i en kommentar eller // i en adresse ikke
# forveksles.
JS_TOKEN = re.compile(r'/\*.*?\*/|//[^\n]*|`(?:[^`\\]|\\.)*`|' + STRENG, re.S)
ATTRIBUT = re.compile(r'\s(?:content|aria-label|placeholder|title|alt)="([^"]*)"')
# Engelsk i scripts: T('da', 'en'), T(lang, 'da', 'en'), EN ? 'en' : 'da' og en: { … }.
ENGELSK = [
    (re.compile(r'\bT\(\s*(?:lang\s*,\s*)?(' + STRENG + r')\s*,\s*(?:' + STRENG + r')\s*\)'), r'\1'),
    (re.compile(r'\bEN\s*\?\s*(?:' + STRENG + r')\s*:\s*(' + STRENG + r')'), r'\1'),
    (re.compile(r'\ben:\s*\{[^{}]*\}'), ''),
]


def undtaget(tekst):
    t = tekst.strip()
    return any(u == t if isinstance(u, str) else u.search(t) for u in UNDTAGELSER)


def bydeform(tekst):
    """Sætningerne i en dansk tekst, der begynder med et udsagnsord i bydeform, også efter kolon og semikolon. Knapper,
    links og navne på undtagelseslisten og de falske træf tæller ikke."""
    # Et enkelt ord med små bogstaver er kode (fx 'hold'), ikke en instruktion.
    if undtaget(tekst) or re.fullmatch(r'[a-zæøå-]+', tekst.strip()):
        return []
    ud = []
    for led in SPLIT.split(tekst):
        s = PREFIX.sub('', led).strip()
        første = re.match(r'[A-Za-zÆØÅæøåÉé]+', s)
        # Et ord med store bogstaver er en forkortelse (ØV, NS), ikke et udsagnsord.
        if not første or første.group(0).lower() not in BYDEFORMER or første.group(0).isupper():
            continue
        if undtaget(s) or any(r.search(led.strip()) or r.search(s) for r in FALSKE_TRÆF):
            continue
        ud.append(s)
    return ud


def script_tekster(kode):
    """De danske strenge i et script, uden kommentarer og uden den engelske udgave."""
    for mønster, erstatning in ENGELSK:
        kode = mønster.sub(erstatning, kode)
    ud = []
    for m in JS_TOKEN.finditer(kode):
        token = m.group(0)
        if token.startswith(('/*', '//')):
            continue
        indhold = token[1:-1]
        if token.startswith('`'):
            # Skabelonstrenge: teksten mellem tags og strengene i ${…}
            ud += [t[1:-1] for t in re.findall(STRENG, indhold)]
            indhold = re.sub(r'\$\{[^}]*\}', ' ', indhold)
        ud += [html.unescape(v) for v in ATTRIBUT.findall(indhold)]
        ud += [html.unescape(t).strip() for t in re.split(r'<[^>]+>', indhold) if t.strip()]
    return ud


def tekster(navn, tekst):
    """Tekststykkerne i en fil, som en læser kan se eller høre."""
    if navn.endswith('.md'):
        if navn.startswith('ordbog/'):
            # Ordbogens opslagsord er navne (gruppe 2).
            tekst = '\n'.join(linje for linje in tekst.splitlines() if not linje.startswith('#'))
        return [tekst]
    ud = []
    for del_ in re.split(r'(<script\b[^>]*>.*?</script>)', tekst, flags=re.S):
        if del_.startswith('<script'):
            ud += script_tekster(re.sub(r'^<script\b[^>]*>|</script>$', '', del_))
            continue
        del_ = re.sub(r'<!--.*?-->', ' ', del_, flags=re.S)
        ud += [html.unescape(v) for v in ATTRIBUT.findall(del_)]
        ud += [html.unescape(t).strip() for t in re.split(r'<[^>]+>', del_) if t.strip()]
    return ud


def al_dansk_tekst():
    """(navn, tekststykker) for al dansk tekst: fagordstestens filer, regnemaskinernes modul og kontakt-API'ets svar."""
    ud = [(navn, tekster(navn, tekst)) for navn, tekst in dansk_tekst()]
    ud.append(('scoring/beregn.js', script_tekster((ROD / 'scoring' / 'beregn.js').read_text(encoding='utf-8'))))
    svar = (ROD / '_kontakt-api' / 'src' / 'contact-messages.js').read_text(encoding='utf-8')
    ud.append(('_kontakt-api/src/contact-messages.js', [m.group(1) for m in re.finditer(r"\bda:\s*'([^']*)'", svar)]))
    return ud


class Bydeform(unittest.TestCase):
    def test_sidernes_danske_tekster_er_i_beskrivende_form(self):
        for navn, stykker in al_dansk_tekst():
            fund = [s for stykke in stykker for s in bydeform(stykke)]
            self.assertEqual(fund, [], navn)

    def test_testen_læser_attributterne_scripts_og_api_svarene(self):
        filer = dict(al_dansk_tekst())
        self.assertIn('Gratis bridgetrænere til meldinger, fordelinger, pointregnskab, spilføring og håndvurdering. '
                      'De kører i browseren, også på mobilen, og kræver intet login.', filer['index.html'])
        self.assertIn('Dette felt skal være tomt', filer['om-mig/index.html'])
        self.assertIn('Beskeden kunne ikke sendes. Prøv igen senere.', filer['om-mig/index.html'])
        self.assertIn('Kampens imp-forskel mangler.', filer['scoring/beregn.js'])
        self.assertIn('E-mailadressen er ikke gyldig.', filer['_kontakt-api/src/contact-messages.js'])
        self.assertNotIn('Remove the score', [s for stykker in filer.values() for s in stykker])

    def test_bydeform_inde_i_sætningen_er_rettet(self):
        # Testen ser kun på sætningernes begyndelse; de her fandt Frank på skærmbillederne (Tillæg T3, hans svar
        # 31. oktober 2026). Om mig tjekkes af tjek_privatliv.py.
        scoring = {sprog: (ROD / 'scoring' / f'Scoring_i_bridge{sprog}.md').read_text(encoding='utf-8') for sprog in ('', '.en')}
        self.assertIn('Modspillerne gør omvendt: de sparer et overstik, før de går efter at bete kontrakten.', scoring[''])
        self.assertIn('Men først skal det være sikkert, at de vinder udgangen, og at resten af feltet melder den.',
                      scoring[''])
        self.assertIn('Defenders do the opposite: they save an overtrick before going all out to beat the contract.',
                      scoring['.en'])
        self.assertIn('But first it must be certain that they make their game and that the rest of the field bids it.',
                      scoring['.en'])

    def test_fejler_ved_bydeform_også_efter_kolon_og_semikolon(self):
        self.assertEqual(bydeform('Vælg en træner, og gå i gang.'), ['Vælg en træner, og gå i gang.'])
        self.assertEqual(bydeform('Foran sidst i kampen: spil normalt og sikkert.'), ['spil normalt og sikkert.'])
        self.assertEqual(bydeform('Der er ingen konto; åbn en træner.'), ['åbn en træner.'])
        self.assertEqual(bydeform('Træn bridge lidt hver dag'), ['Træn bridge lidt hver dag'])
        self.assertEqual(bydeform('Indtast en gyldig e-mailadresse.'), ['Indtast en gyldig e-mailadresse.'])
        self.assertEqual(bydeform('**Meld udgangene.** Lad være.'), ['Meld udgangene.', 'Lad være.'])

    def test_beskrivende_form_knapper_og_falske_træf_består(self):
        self.assertEqual(bydeform('Hver træner har sin egen daglige træning, og du går i gang med det samme.'), [])
        self.assertEqual(bydeform('Udgangene skal meldes.'), [])
        self.assertEqual(bydeform('Se trænerne'), [])
        self.assertEqual(bydeform('Beskeden kunne ikke afleveres. Prøv igen senere.'), [])
        self.assertEqual(bydeform('Spil i kampen'), [])
        self.assertEqual(bydeform('pr. spil. Det giver ca. 2 stik.'), [])
        self.assertEqual(bydeform('hold'), [])
        self.assertEqual(bydeform('(Med fortegn: ØV får det modsatte fortegn.)'), [])


if __name__ == '__main__':
    unittest.main()
