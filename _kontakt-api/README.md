# Kontakt-API til Kontraktbridge

Azure Function App'en `kontraktbridge-kontakt`, der modtager kontaktformularen på www.kontraktbridge.dk/om-mig/ og sender beskeden til Frank med Azure Communication Services (SPEC-kontaktformular.md, del 1). Koden er kopieret fra Proteinkøkkens kontakt-API (`protein-opskrifter/api`); kun emnelinjen er ændret.

Mappen ligger i repoet `frankpedersen.github.io`, men starter med `_`, så GitHub Pages (Jekyll) udgiver den ikke.

## Hvad funktionen gør

`POST /api/contact` (anonym) med JSON: `name`, `email`, `message`, `website` (honeypot) og `elapsedMilliseconds`.

- Mailen har emnet "Ny besked fra Kontraktbridge", går til modtageren og har afsenderens adresse som svar-til.
- Spambeskyttelse: udfyldt honeypot giver et falsk "sendt" (og tæller ikke med i grænsen), formularen skal have været åben i mindst 2 sekunder, højst 3 beskeder pr. IP pr. 15 minutter på tværs af instanser (se Grænsen pr. IP) og højst 10 kB.
- Svarene er på dansk og engelsk: `{ "message": "Tak for din besked. Den er sendt.", "messageEn": "Thank you for your message. It has been sent." }` ved succes, ellers `{ "error": "…", "errorEn": "…" }` med status 400, 413, 415, 429, 502 eller 503. Ordlyden står kun i `src/contact-messages.js`; Om mig viser det sprog, siden står på (SPEC-beskrivende-form, A2).

## App-indstillinger

Sættes i Function App'en, aldrig i filer i repoet:

- `COMMUNICATION_SERVICES_CONNECTION_STRING`: forbindelsesstrengen til ACS-ressourcen.
- `CONTACT_SENDER`: afsenderadressen i ACS' e-maildomæne.
- `CONTACT_RECIPIENT`: modtageradressen.
- `IP_HASH_KEY`: nøglen til HMAC af IP'en i grænsen pr. IP; en egen værdi, ikke Post Mortems.
- `AzureWebJobsStorage`: funktionens eget lager (`kontraktbridgekontakt`), som også har grænsens tabel.

Værdierne er de samme som i Proteinkøkkens Static Web App og kan kopieres uden at blive skrevet ud:

```bash
az staticwebapp appsettings list -n <static-web-app> -g <gruppe> --query properties -o json > tmp.json
# … sæt dem med az functionapp config appsettings set, og slet tmp.json
```

## Grænsen pr. IP

Højst 3 beskeder pr. IP pr. 15 minutter på tværs af instanser (SPEC-kontakt-ip-graense.md, `src/contact-rate-limit.js`, samme model som Post Mortem). Tælleren står i tabellen `kontaktgraense` i funktionens eget lager: én række pr. 15-minutters vindue (PartitionKey er vinduets start i UTC, fx `202611131215`) og pr. HMAC-SHA256 af IP'en med `IP_HASH_KEY` (RowKey, 64 hex-tegn). Rækken har kun `antal`, og opdateringer bruger ETag, så samtidige kald ikke tæller forbi hinanden. Den 4. besked i vinduet får 429 med `Retry-After` til vinduets slutning.

Timer-funktionen `deleteContactWindows` (`src/functions/contact-cleanup.js`) kører hvert 5. minut og sletter vinduer, der begyndte for mindst 15 minutter siden, så en hash står højst 20 minutter. Svarer lageret ikke, logges "kontakt: grænse-lageret fejlede (fejltype)", og beskeden går igennem; mangler `IP_HASH_KEY` eller lageret (fx lokalt), logges "kontakt: grænsen er slået fra". IP'en og hashen logges aldrig, og SDK'ens log holdes på advarsler og fejl.

Nøglen og tabellen sættes én gang. Nøglen laves i en underskal og skrives aldrig ud:

```bash
MSYS_NO_PATHCONV=1 az functionapp config appsettings set -g Kontraktbridge -n kontraktbridge-kontakt \
  --settings "IP_HASH_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')" -o none
MSYS_NO_PATHCONV=1 az storage table create --name kontaktgraense --account-name kontraktbridgekontakt --auth-mode key -o none
MSYS_NO_PATHCONV=1 az storage table exists --name kontaktgraense --account-name kontraktbridgekontakt --auth-mode key
```

## CORS

Sat i Function App'ens platformsindstillinger, ikke i koden: `https://www.kontraktbridge.dk` og `https://kontraktbridge.dk`. Platformen svarer selv på browserens `OPTIONS`.

```bash
az functionapp cors add -n kontraktbridge-kontakt -g Kontraktbridge --allowed-origins https://www.kontraktbridge.dk https://kontraktbridge.dk
```

## Lokalt

```bash
npm ci
npm test          # node --test; testene af grænsen starter Azurite med npx (hentes første gang)
func start        # kræver Azure Functions Core Tools og en local.settings.json (står i .gitignore)
```

## Udrulning

Uden Functions Core Tools, med zip og fjernbygning:

```bash
python -c "import zipfile,pathlib; z=zipfile.ZipFile('kontakt.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p) for p in ['host.json','package.json','package-lock.json',*map(lambda f: f.as_posix(), pathlib.Path('src').rglob('*.js'))]]; z.close()"
az functionapp deployment source config-zip -g Kontraktbridge -n kontraktbridge-kontakt --src kontakt.zip --build-remote true
```

Zip-filen skal have stier med `/`. Windows PowerShells `Compress-Archive` skriver `\`, og så finder Azure (Linux) ingen funktioner ("Found zero files matching src/functions/*.js"). I Git Bash skal `MSYS_NO_PATHCONV=1` sættes, når az får ressource-id'er.

Med Core Tools: `func azure functionapp publish kontraktbridge-kontakt`.
