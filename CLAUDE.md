# Kontraktbridge – forside, Om mig og ordbog

Det, der gælder alle repoer – arbejdsgangen, husets ord, hemmeligheder og systemdokumentationen `../SYSTEM.md` – står i `../CLAUDE.md`.

**Specerne:** afsluttede specer ligger i `docs/specs/` med én linje pr. spec i `docs/specs/README.md`. Mappen står i `.gitignore`, så specerne hverken kommer på GitHub eller på hjemmesiden (Franks valg 27. oktober 2026). En spec i arbejde ligger i roden, hvor `SPEC-*.md` også er ignoreret.

**Fagord:** kør `python tools/tjek_fagord.py` efter tekstændringer; den læser forsiden, Om mig og ordbogen.
