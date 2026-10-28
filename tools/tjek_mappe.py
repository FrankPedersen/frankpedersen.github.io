"""Accepttest for den fælles mappe Kontraktbridge (grenen ny-mappe, Franks opgave 28. oktober 2026).

    python tools/tjek_mappe.py

Repoerne Forside, Fordelingstræneren og Konventionstræner og mappen bridge-model ligger samlet i Kontraktbridge med
den private SYSTEM.md, en fælles CLAUDE.md og Kontraktbridge.code-workspace. Testen tjekker, at ingen fil henviser til
de gamle mapper i Overførsler, at den fælles CLAUDE.md har det, der gælder alle repoer, at repoernes CLAUDE.md henviser
dertil uden at gentage det, og at workspace-filen åbner de fire mapper. At SYSTEM.md ligger uden for repoerne, og at
reglen om den står i den fælles CLAUDE.md, tjekkes af tools/tjek_privatliv.py.
"""
import json
import os
import pathlib
import re
import unittest

ROD = pathlib.Path(__file__).resolve().parent.parent
MAPPE = ROD.parent
REPOER = ('Forside', 'Fordelingstræneren', 'Konventionstræner')
MAPPER = REPOER + ('bridge-model',)

# De gamle stier, også med dobbelte skråstreger som i JSON
GAMLE = re.compile(r'Downloads[\\/]+(?:githubUpload|Fordelingstr(?:æ|ae)neren|Konventionstr(?:æ|ae)ner|bridge-model)'
                   r'|githubUpload[\\/]', re.I)
TEKST = {'.md', '.py', '.mjs', '.js', '.ts', '.tsx', '.json', '.yml', '.html', '.txt', '.css'}
SPRING_OVER = {'.git', 'node_modules', 'dist', '__pycache__'}


def tekstfiler():
    for mappe in MAPPER:
        for rod, mapper, filer in os.walk(MAPPE / mappe):
            mapper[:] = [m for m in mapper if m not in SPRING_OVER]
            for fil in filer:
                if pathlib.Path(fil).suffix in TEKST:
                    yield pathlib.Path(rod) / fil
    for navn in ('CLAUDE.md', 'SYSTEM.md', 'Kontraktbridge.code-workspace'):
        yield MAPPE / navn


def claude_md(repo):
    return (MAPPE / repo / 'CLAUDE.md').read_text(encoding='utf-8')


def linjer_med(tekst, del_):
    return [nr for nr, linje in enumerate(tekst.splitlines(), 1) if del_ in linje]


class GamleStier(unittest.TestCase):
    def test_ingen_fil_henviser_til_de_gamle_mapper(self):
        fund = []
        for sti in tekstfiler():
            for nr, linje in enumerate(sti.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
                if GAMLE.search(linje):
                    fund.append(f'{sti.relative_to(MAPPE)}:{nr}')
        self.assertEqual(fund, [])

    def test_ingen_claude_md_naevner_githubupload(self):
        self.assertEqual(linjer_med((MAPPE / 'CLAUDE.md').read_text(encoding='utf-8'), 'githubUpload'), [])
        for repo in REPOER:
            self.assertEqual(linjer_med(claude_md(repo), 'githubUpload'), [], repo)


class DenFaellesClaudeMd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tekst = (MAPPE / 'CLAUDE.md').read_text(encoding='utf-8')

    def test_husets_ord(self):
        for del_ in ('bordet (ikke blindemand)', 'kipning (ikke snit)', 'forbindelser (ikke broer)', 'slutspil',
                     'indspil', 'hp (', 'doubleton (ikke dobbeltton)', 'fittet (ikke fitten)', 'et fit'):
            self.assertIn(del_, self.tekst)

    def test_arbejdsgangen(self):
        for del_ in ('**Spec:**', '**Gren:**', '**Accepttest først:**', '**Tag før ændringen:**',
                     '**Ingen push til `main` uden Franks godkendelse:**', 'stopper før fletning'):
            self.assertIn(del_, self.tekst)

    def test_hemmeligheder_kun_i_azure(self):
        self.assertRegex(self.tekst, r'Hemmeligheder[^\n]*kun i Azure')

    def test_mapperne(self):
        for mappe in MAPPER:
            self.assertIn(f'`{mappe}`', self.tekst)


class RepoernesClaudeMd(unittest.TestCase):
    GENTAGELSER = ('**Systemdokumentation:**', 'Hemmeligheder skrives aldrig', '(ikke blindemand)', 'bordet, kipning',
                   'dobbeltton', 'fitten', 'Skriv eller ret testene først')
    REPOSPECIFIKT = {
        'Forside': ('docs/specs/README.md', 'tools/tjek_fagord.py'),
        'Fordelingstræneren': ('SPEC.md', 'npm test', 'Ufravigelige regler', 'src/sprog/sprog.test.ts',
                               'scripts/sprogtjek.ts', 'scripts/ordliste.txt'),
        'Konventionstræner': ('docs/konventionskort-skabelon.md', 'tools/tjek_fagord.py', 'tools/tjek_sprog.py',
                              'tools/sprogtjek.py', '_config.yml'),
    }

    def test_henviser_til_den_faelles(self):
        for repo in REPOER:
            self.assertTrue(linjer_med(claude_md(repo), '`../CLAUDE.md`'), repo)

    def test_gentager_ikke_det_faelles(self):
        for repo in REPOER:
            tekst = claude_md(repo)
            for del_ in self.GENTAGELSER:
                self.assertEqual(linjer_med(tekst, del_), [], f'{repo}: {del_}')

    def test_det_repospecifikke_bliver(self):
        for repo, dele in self.REPOSPECIFIKT.items():
            tekst = claude_md(repo)
            for del_ in dele:
                self.assertTrue(linjer_med(tekst, del_), f'{repo}: {del_}')


class Workspace(unittest.TestCase):
    def test_de_fire_mapper(self):
        data = json.loads((MAPPE / 'Kontraktbridge.code-workspace').read_text(encoding='utf-8'))
        stier = [f['path'] for f in data['folders']]
        self.assertEqual(sorted(stier), sorted(MAPPER))
        for sti in stier:
            # Relative stier, så filen virker, uanset hvor mappen Kontraktbridge ligger
            self.assertFalse(pathlib.PureWindowsPath(sti).is_absolute() or sti.startswith('/'), sti)
            self.assertTrue((MAPPE / sti).is_dir(), sti)


if __name__ == '__main__':
    unittest.main()
