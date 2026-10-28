# Kontraktbridge – forside, Om mig og ordbog

Det, der gælder alle repoer – arbejdsgangen, husets ord, hemmeligheder og systemdokumentationen `../SYSTEM.md` – står i `../CLAUDE.md`.

**Specerne:** afsluttede specer ligger i `docs/specs/` med én linje pr. spec i `docs/specs/README.md`. Mappen står i `.gitignore`, så specerne hverken kommer på GitHub eller på hjemmesiden (Franks valg 27. oktober 2026). En spec i arbejde ligger i roden, hvor `SPEC-*.md` også er ignoreret.

**Fagord:** kør `python tools/tjek_fagord.py` efter tekstændringer; den læser forsiden, Om mig og ordbogen.

**Hjemmesiden:** `_config.yml` udelukker udviklerfilerne (`CLAUDE.md`, `tools/`), specerne og markdownkilderne (`ordbog/*.md`, `scoring/*.md`), så kun siderne og det, de bruger, udgives (Franks valg 28. oktober 2026). `node tools/tjek_kun_siden.mjs` tjekker det og viser siderne fra en mappe med kun de udgivne filer; efter en udgivelse tjekker `--live` www.kontraktbridge.dk. En ny fil, som en side skal bruge, kommer på listen `UDGIVET` i testen.
