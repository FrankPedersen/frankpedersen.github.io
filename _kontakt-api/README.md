# Kontakt-API til Kontraktbridge

Azure Function App'en `kontraktbridge-kontakt`, der modtager kontaktformularen på www.kontraktbridge.dk/om-mig/ og sender beskeden til Frank med Azure Communication Services (SPEC-kontaktformular.md, del 1). Koden er kopieret fra Proteinkøkkens kontakt-API (`protein-opskrifter/api`); kun emnelinjen er ændret.

Mappen ligger i repoet `frankpedersen.github.io`, men starter med `_`, så GitHub Pages (Jekyll) udgiver den ikke.

## Hvad funktionen gør

`POST /api/contact` (anonym) med JSON: `name`, `email`, `message`, `website` (honeypot) og `elapsedMilliseconds`.

- Mailen har emnet "Ny besked fra Kontraktbridge", går til modtageren og har afsenderens adresse som svar-til.
- Spambeskyttelse som i Proteinkøkken: udfyldt honeypot giver et falsk "sendt", formularen skal have været åben i mindst 2 sekunder, højst 3 beskeder pr. IP pr. 15 minutter og højst 10 kB.
- Svarene er på dansk og engelsk: `{ "message": "Tak for din besked. Den er sendt.", "messageEn": "Thank you for your message. It has been sent." }` ved succes, ellers `{ "error": "…", "errorEn": "…" }` med status 400, 413, 415, 429, 502 eller 503. Ordlyden står kun i `src/contact-messages.js`; Om mig viser det sprog, siden står på (SPEC-beskrivende-form, A2).

## App-indstillinger

Sættes i Function App'en, aldrig i filer i repoet:

- `COMMUNICATION_SERVICES_CONNECTION_STRING`: forbindelsesstrengen til ACS-ressourcen.
- `CONTACT_SENDER`: afsenderadressen i ACS' e-maildomæne.
- `CONTACT_RECIPIENT`: modtageradressen.

Værdierne er de samme som i Proteinkøkkens Static Web App og kan kopieres uden at blive skrevet ud:

```bash
az staticwebapp appsettings list -n <static-web-app> -g <gruppe> --query properties -o json > tmp.json
# … sæt dem med az functionapp config appsettings set, og slet tmp.json
```

## CORS

Sat i Function App'ens platformsindstillinger, ikke i koden: `https://www.kontraktbridge.dk` og `https://kontraktbridge.dk`. Platformen svarer selv på browserens `OPTIONS`.

```bash
az functionapp cors add -n kontraktbridge-kontakt -g Kontraktbridge --allowed-origins https://www.kontraktbridge.dk https://kontraktbridge.dk
```

## Lokalt

```bash
npm ci
npm test          # node --test
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
