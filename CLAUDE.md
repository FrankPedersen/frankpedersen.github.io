# Kontraktbridge – forside, Om mig og ordbog

Det, der gælder alle repoer – arbejdsgangen, husets ord, hemmeligheder og systemdokumentationen `../SYSTEM.md` – står i `../CLAUDE.md`.

**Specerne:** afsluttede specer ligger i `docs/specs/` med én linje pr. spec i `docs/specs/README.md`. Mappen står i `.gitignore`, så specerne hverken kommer på GitHub eller på hjemmesiden (Franks valg 27. oktober 2026). En spec i arbejde ligger i roden, hvor `SPEC-*.md` også er ignoreret.

**Fagord:** kør `python tools/tjek_fagord.py` efter tekstændringer; den læser forsiden, Om mig og ordbogen.

**Beskrivende form:** `python tools/tjek_bydeform.py` læser de samme sider, regnemaskinerne i `scoring/beregn.js` og kontakt-API'ets beskeder og fejler, hvis en dansk instruktion eller forklaring begynder med et udsagnsord i bydeform (specen og listen ligger i `docs/specs/`). Knapper, links og navne står på testens `UNDTAGELSER`; en ny knap i bydeform kommer på listen.

**Hjemmesiden:** `_config.yml` udelukker udviklerfilerne (`CLAUDE.md`, `tools/`), specerne og markdownkilderne (`ordbog/*.md`, `scoring/*.md`), så kun siderne og det, de bruger, udgives (Franks valg 28. oktober 2026). `node tools/tjek_kun_siden.mjs` tjekker det og viser siderne fra en mappe med kun de udgivne filer; efter en udgivelse tjekker `--live` www.kontraktbridge.dk. En ny fil, som en side skal bruge, kommer på listen `UDGIVET` i testen.

**Forsiden** (docs/specs/SPEC-ny-forside.md; bygget på grenen `ny-forside`, før: `v-foer-ny-forside`; godkendt af Frank og udgivet 5. november 2026): `node tools/tjek_ny_forside.mjs` tjekker topbåndet, menuen, kortene og sidefoden på alle fire sider, ved 1280, 999, 390 og 320 px og på engelsk. Sidefodens mål står under Afklaret i specen. **Tallene i topbåndets fire kort (45 konventioner, 657 farvekombinationer, 39 fordelingsmønstre, 437 ord) og på kortene hentes ikke automatisk og skal rettes, når de ændrer sig.**

**Om mig, kortspil og privatlivsteksten** (docs/specs/SPEC-om-mig.md; bygget på grenen `om-mig-kortspil`, før: `v-foer-om-mig-kortspil`; godkendt af Frank og udgivet 5. november 2026): Kasino og Es-makker whist linker til lobbyen, og privatlivsteksten står foldet sammen under formularen i et `<details>`. `node tools/tjek_om_mig.mjs` tjekker begge dele på dansk og engelsk ved 1280, 390 og 320 px, med klik, tastatur, skærmlæser og uden JavaScript; `--billeder=mappe` gemmer kortene og kontaktkortet lukket og åbent. Et lukket `<details>` skjuler indholdet med `content-visibility`, så en test spørger `checkVisibility()`, om teksten ses.

