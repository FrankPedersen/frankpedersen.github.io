# Scoring i bridge

Udkast til www.kontraktbridge.dk/scoring/ · 25. oktober 2026 · version 0.1 til Franks gennemlæsning

Siden handler om turneringsbridge, hvor alle par spiller de samme spil. Først hvordan et enkelt spil scores, derefter hvordan resultaterne sammenlignes i parturnering og holdturnering, og til sidst hvad det betyder for taktikken. Honnørbonus findes kun i rubberbridge og er ikke med.

---

## 1 Scoren for et spil

Et spil giver point til det par, der vinder det. Spilførerens par får point for en kontrakt, der går hjem; modspillerne får point for hver bet. Passer alle fire, får begge sider 0.

Siden bruger de ord, man siger ved bordet. Lovene (§ 77) bruger de formelle: spilpoint om scoren, trækværdi om stikpoint, overtræk og undertræk om overstik og bet, og farezonen om zonen.

### Stikpoint

Stikpoint tælles kun for de stik, man har meldt, ud over de første seks (bogen).

| Farve | Pr. stik |
| --- | --- |
| ♣ og ♦ (minorer) | 20 |
| ♥ og ♠ (majorer) | 30 |
| Sans | 40 for første stik, 30 for de næste |

Doblet ganges stikpointene med 2, redoblet med 4.

### Bonus

| Bonus | Uden for zone | I zone |
| --- | --- | --- |
| Delkontrakt (stikpoint under 100) | 50 | 50 |
| Udgang (stikpoint 100 eller mere) | 300 | 500 |
| Lilleslem (6-trinnet), oven i udgang | 500 | 750 |
| Storeslem (7-trinnet), oven i udgang | 1000 | 1500 |
| Doblet kontrakt hjemme | 50 | 50 |
| Redoblet kontrakt hjemme | 100 | 100 |

Udgang er 3 sans, 4♥, 4♠, 5♣ og 5♦. Kun meldte stik tæller med til de 100; overstik giver aldrig udgang.

### Doblet og redoblet kontrakt hjemme

Går en doblet eller redoblet kontrakt hjemme, sker der tre ting på én gang:

1. **Stikpointene ganges** med 2 (doblet) eller 4 (redoblet). Kommer de derved op på 100 eller mere, er kontrakten udgang, selv om den er meldt på 1- eller 2-trinnet, og spilføreren får udgangsbonus i stedet for delkontraktbonus.
2. **Bonus for doblet eller redoblet kontrakt hjemme** (50 eller 100) lægges oven i, uanset zone. Den kaldes også bonus "for fornærmelsen", fordi modspillerne doblede en kontrakt, der gik hjem.
3. **Overstik** scores med deres egne satser (100 eller 200 pr. stik doblet, det dobbelte redoblet) og har intet med farvens stikværdi at gøre.

| Kontrakt | Stik | Zone | Regnestykke | Score |
| --- | --- | --- | --- | --- |
| 1♣ doblet | 7 | uden | 40 + 50 delkontrakt + 50 | 140 |
| 1♣ redoblet | 7 | uden | 80 + 50 delkontrakt + 100 | 230 |
| 1♠ doblet | 7 | uden | 60 + 50 delkontrakt + 50 | 160 |
| 1♠ redoblet | 7 | uden | 120 + 300 udgang + 100 | 520 |
| 2♥ doblet | 8 | uden / i | 120 + 300 / 500 udgang + 50 | 470 / 670 |
| 2♥ redoblet | 8 | uden | 240 + 300 udgang + 100 | 640 |
| 4♠ doblet | 10 / 11 | i | 240 + 500 + 50 (+ 200 for overstikket) | 790 / 990 |
| 4♠ redoblet | 10 | i | 480 + 500 + 100 | 1080 |

Derfor er det dyrt at doble en delkontrakt, der går hjem: 2♥ doblet hjemme uden for zone giver 470 i stedet for 110. Og derfor kan en redobling være et våben: 1♠ redoblet hjemme er udgang.

### Overstik

| | Uden for zone | I zone |
| --- | --- | --- |
| Udoblet | stikværdien (20 eller 30) | stikværdien |
| Doblet | 100 pr. overstik | 200 pr. overstik |
| Redoblet | 200 pr. overstik | 400 pr. overstik |

### Bet

| Antal bet | Udoblet, uden for zone | Udoblet, i zone | Doblet, uden for zone | Doblet, i zone |
| --- | --- | --- | --- | --- |
| 1 | 50 | 100 | 100 | 200 |
| 2 | 100 | 200 | 300 | 500 |
| 3 | 150 | 300 | 500 | 800 |
| 4 | 200 | 400 | 800 | 1100 |
| hver ekstra | +50 | +100 | +300 | +300 |

Redoblet er det dobbelte af doblet.

### Eksempler

| Kontrakt | Stik | Zone | Score |
| --- | --- | --- | --- |
| 1 sans | 7 | uden | 40 + 50 = 90 |
| 2♠ | 8 | uden | 60 + 50 = 110 |
| 3♥ | 10 | uden | 90 + 30 + 50 = 170 |
| 3 sans | 9 | uden / i | 100 + 300 = 400 / 600 |
| 4♠ | 10 | uden / i | 120 + 300 = 420 / 620 |
| 5♦ | 11 | uden | 100 + 300 = 400 |
| 6♠ | 12 | uden / i | 180 + 300 + 500 = 980 / 1430 |
| 7♠ | 13 | uden / i | 210 + 300 + 1000 = 1510 / 2210 |
| 2♥ doblet | 9 | uden | 120 + 300 + 50 + 100 = 570 |
| 1 sans doblet | 9 | uden | 80 + 50 + 50 + 200 = 380 |
| 4♠ doblet | 7 | uden | −500 |
| 2♥ doblet | 7 | i | −200 |

De to doblede eksempler er værd at lægge mærke til: 2♥ doblet med et overstik koster 570, ikke 110. 1 sans doblet med to overstik giver kun 380, fordi 80 stikpoint ikke er udgang.

<!-- beregner: score -->

---

## 2 Parturnering: matchpoint

### Resultater er relative

I en parturnering sammenlignes dit resultat kun med de par, der har haft de samme kort og siddet i samme retning: alle NS-par for sig og alle ØV-par for sig. Du konkurrerer ikke mod hele lokalet, kun mod dem, der har spillet de samme hænder.

Det betyder, at det ikke er størrelsen af scoren, der tæller, men hvor mange du slår. +620 mod +590 tæller lige så meget som +1430 mod −100.

### 2/1/0

Hvert resultat sammenlignes med hvert af de andre på samme spil:

| Mod hvert andet par | Point |
| --- | --- |
| Du slår dem | 2 |
| Samme score | 1 |
| De slår dig | 0 |

Er spillet spillet ved *n* borde, er toppen 2 × (*n* − 1), og middel er *n* − 1. Ved 7 borde er toppen 12, og rækken fra top til bund er 12 – 10 – 8 – 6 – 4 – 2 – 0.

Har flere par samme score, deler de pointene for de pladser, de tilsammen fylder. Lovene kalder metoden parpointberegning (§ 78A).

### Et eksempel

Syv NS-par har spillet samme spil, ingen i zonen. De fleste har meldt 4♥. Hvert par sammenlignes med de seks andre:

| NS-score | Kontrakt | Slår | Lige | Taber for | 2/1/0 | Procent | +1/0/−1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| +450 | 4♥ med et overstik | 6 | 0 | 0 | 12 | 100 % | +6 |
| +420 | 4♥ hjemme | 4 | 1 | 1 | 9 | 75 % | +3 |
| +420 | 4♥ hjemme | 4 | 1 | 1 | 9 | 75 % | +3 |
| +170 | 3♥ med et overstik | 3 | 0 | 3 | 6 | 50 % | 0 |
| +140 | 3♥ hjemme | 2 | 0 | 4 | 4 | 33 % | −2 |
| −50 | 4♥ én bet | 1 | 0 | 5 | 2 | 17 % | −4 |
| −100 | 4♥ to bet | 0 | 0 | 6 | 0 | 0 % | −6 |

**Sådan læses rækken for +420:** parret slår fire par (+170, +140, −50 og −100), spiller lige med det andet par med +420 og taber til +450.

- **2/1/0:** 4 × 2 + 1 × 1 + 1 × 0 = 9 point.
- **+1/0/−1:** 4 × (+1) + 1 × 0 + 1 × (−1) = +3.

**Hvorfor får nogen minus?** I +1/0/−1 betyder minus ikke, at parret har en dårlig score ved bordet, men at det har tabt flere sammenligninger, end det har vundet. +140 er en fin plusscore, men fire par fik mere ud af kortene, og kun to fik mindre: 2 − 4 = −2. Parret ligger altså under middel, og 2/1/0 siger det samme: 4 point, hvor middel er 6. Tallet i +1/0/−1 er afstanden fra middel: +170 slår lige så mange, som det taber for, og får 0, præcis middel.

Minus i +1/0/−1 og minus i NS-scoren er to forskellige ting. −50 er en minusscore ved bordet, men slår stadig −100 og får 2 point i 2/1/0.

De to par med +420 deler pladserne 2 og 3: (10 + 8) / 2 = 9 hver. Summen af 2/1/0-pointene er 42 = 7 × 6, altså middel for hvert par, og summen af +1/0/−1 er 0. Overstikket gav +450 hele 3 point mere end +420. Det er lige så meget, som 4♥ hjemme (+420) gav mere end 3♥ med et overstik (+170).

<!-- beregner: matchpoint -->

### Procent

Pointene omregnes til procent af toppen, så alle spil vejer ens uanset antal borde. 50 % er middel; en turnering vindes typisk med 60–65 %.

### Middelscoremetoden: +1/0/−1

Ved den praktiske udregning tæller man i stedet +1 for hver sammenligning, man vinder, 0 for lige og −1 for hver, man taber. Rækken ved 7 borde bliver +6, +4, +2, 0, −2, −4, −6, og ved 6 borde +5, +3, +1, −1, −3, −5. Afstanden mellem to pladser er stadig 2.

Tallene viser afstanden fra middel. Det gør regnskabet lettere at lægge sammen og at kontrollere.

### NS og ØV hænger sammen

Når NS-parrene har fået deres point, får hvert ØV-par det samme tal som sine modstandere, men med omvendt fortegn. Det NS-par, der fik +6, havde et ØV-par imod sig, der får −6.

### Afstemning

1. **Summen af NS-pointene på hvert spil skal være 0.** Er den ikke det, er der en regnefejl. Det skal kontrolleres, før ØV får deres tal; ellers bliver fejlen gentaget med modsat fortegn og skjult.
2. **Når alle runder er lagt sammen,** skal summen af alle positive og negative tal igen være 0.
3. **Undtagelser:** justerede scorer, fx strafpoint (summen af de negative bliver størst) og erstatningspoint (summen af de positive bliver størst). Et standardfradrag i strafpoint er 10 % af forskellen mellem top og bund i parturnering og ½ KP i en holdkamp på mindst 13 spil (§ 211).

### Resultatlisten

I middelscoremetoden viser listen udsvinget fra middel. Ved 6 borde og 28 spil er middelscoren 28 × 5 = 140 i 2/1/0-point. Står der +12, har parret 140 + 12 = 152; står der −5, har det 135. Listen bør have en overskrift som "Middel 140 +".

### Manglende resultater og kunstig score

Kan et spil ikke spilles færdigt, giver turneringslederen en kunstig score (§ 12C2): middel plus (mindst 60 %) til den, der er uden skyld, middel (50 %) til den, der er delvist skyld, og middel minus (højst 40 %) til den, der er skyld. Scorer et par uden skyld mere end 60 % i resten af sektionen, får det sin egen procent i stedet; scorer et par med skyld under 40 %, får det også sin egen.

Mangler et resultat, eller er der givet kunstig score, sammenlignes de andre resultater kun med hinanden. Pointene omregnes derefter til det fulde antal borde (DBf's turneringsbestemmelser § X78B):

| Resultater i gruppen | Point |
| --- | --- |
| 1 | 60 % |
| 2 (mindst 6 borde i alt) | 65 % og 55 % (ens resultater: 60 % til begge) |
| 3 (mindst 9 borde i alt) | 70 %, 60 % og 50 % |
| ellers | Neubergs formel |

<!-- fold: Neubergs formel -->
**Neubergs formel:** *P'* = *A* / *G* × (*P* + 1) − 1, hvor *P* er parrets point i 2/1/0 inden for gruppen, *G* antallet af resultater i gruppen og *A* det fulde antal borde. Ved 5 af 6 resultater bliver toppen (8 + 1) × 6 / 5 − 1 = 9,8 af 10, og bunden (0 + 1) × 6 / 5 − 1 = 0,2.
<!-- /fold -->

Et par, der sidder over, får ingen score på spillet. Den samlede score opgøres i procent.

<!-- fold: Den gamle håndregel -->
**Den gamle håndregel** (Ruder Es, 1992) gav i stedet alle resultater middelscore for den manglende sammenligning: i 2/1/0 sænkes toppen og hæves bunden med 1 for hvert manglende resultat (top 9 og bund 1 ved 5 af 6), og i +1/0/−1 regnes rækken bare som færre borde. Den er nem i hånden, men Neubergs formel er den, der gælder i dag.
<!-- /fold -->

---

## 3 Parturnering i imp

Nogle parturneringer scores i imp i stedet for matchpoint (imp-skalaen står i afsnit 4). Så tæller størrelsen af gevinsten, og taktikken er holdturneringens.

### Butler

Efter DBf's turneringsbestemmelser § 204:

1. **Datum:** den højeste og den laveste score fjernes (arrangøren kan bestemme, at fx de to højeste og laveste fjernes), og datum er gennemsnittet af resten.
2. **Forskellen** mellem parrets score og datum afrundes til nærmeste 10 (en forskel, der ender på 5, afrundes væk fra 0).
3. **Den afrundede forskel** omregnes til imp.

Eksempel, NS i zonen: +620, +620, +600, +170, +170, +140, −100, −100. Uden én +620 og én −100 er datum (620 + 600 + 170 + 170 + 140 − 100) / 6 = 266,67. Et par med +620 er 353,33 over, afrundet 350 → 8 imp; et par med +170 er 96,67 under, afrundet −100 → −3 imp.

Middel plus giver +2 imp og middel minus −2 imp.

### Totalpoint

Ved totalpointberegning (§ 78C) er scoren summen af spilpointene i alle spil. Den bruges sjældent, fordi ét stort spil kan afgøre alt.

### Cross-imp (imps across the field)

Dit resultat sammenlignes med hvert af de andre resultater på spillet, og hver forskel omregnes til imp. DBf lægger dem sammen (§ 203); nogle steder deles summen med antallet af sammenligninger, så tallet ligner en holdkamp.

Samme eksempel, +620: mod +620 0, mod +600 1, mod +170 10, mod +170 10, mod +140 10, mod −100 12, mod −100 12. I alt 55 imp (7,86 pr. sammenligning).

Middel plus giver +2 imp og middel minus −2 imp for hver sammenligning.

Cross-imp er mere retfærdig end Butler, fordi én vild score ikke flytter datum, men den er tungere at regne i hånden.

### Multiholdberegning

Hvert par gøres op mod alle andre borde, der har spillet de samme spil, som en lille holdkamp efter kamppointskalaen for rundens spil (afsnit 4). Parrets score er gennemsnittet af de kamppoint (§ 205). I holdturnering er det et vejledende tal for hvert par; det kan også bruges som parturneringsform.

---

## 4 Holdturnering: imp og kamppoint

### Hvordan en kamp spilles

Et hold har fire spillere (eller flere). Det ene par sidder NS ved det ene bord, det andet par ØV ved det andet, og spillene flyttes mellem bordene. Hvert spil spilles altså to gange, én gang med holdets NS-par og én gang med holdets ØV-par. Holdets to scorer lægges sammen, og forskellen omregnes til imp.

Eksempel, i zonen: vores NS melder 4♠ og vinder +620. Ved det andet bord stopper modstandernes NS i 3♠ og tager 10 stik, så vores ØV får −170. Tilsammen +450, som giver 10 imp.

### Imp-skalaen

| Forskel | Imp | Forskel | Imp | Forskel | Imp |
| --- | --- | --- | --- | --- | --- |
| 0–10 | 0 | 370–420 | 9 | 1500–1740 | 17 |
| 20–40 | 1 | 430–490 | 10 | 1750–1990 | 18 |
| 50–80 | 2 | 500–590 | 11 | 2000–2240 | 19 |
| 90–120 | 3 | 600–740 | 12 | 2250–2490 | 20 |
| 130–160 | 4 | 750–890 | 13 | 2500–2990 | 21 |
| 170–210 | 5 | 900–1090 | 14 | 3000–3490 | 22 |
| 220–260 | 6 | 1100–1290 | 15 | 3500–3990 | 23 |
| 270–310 | 7 | 1300–1490 | 16 | 4000 og mere | 24 |
| 320–360 | 8 | | | | |

Skalaen er aftagende: de første 400 point giver 9 imp, de næste 1600 kun 10 mere. En misset udgang i zonen koster typisk 10 imp, et overstik 1.

### Kamppoint

Kampens imp-forskel omregnes til kamppoint (KP), så en kamp altid giver 20 point i alt. Uafgjort er 10–10. DBf bruger WBF's skala fra 2013 med to decimaler i alle holdturneringer undtagen cupkampe (§ 201–202). Har spillene brøkdele af imp, afrundes kampens imp-forskel først til helt tal (halve væk fra 0). For et antal spil uden offentliggjort tabel konstrueres skalaen efter WBF's formel:

<!-- fold: Kamppointformlen -->
KP = 10 + 10 × (1 − τ^(3*m*/*B*)) / (1 − τ³)

hvor *m* er imp-forskellen, τ = (√5 − 1) / 2 ≈ 0,618 og *B* = 15 × √(antal spil). Fra *B* imp får vinderen 20,00. Tallene afrundes til to decimaler og justeres, så et imp ekstra aldrig er mere værd end det foregående.
<!-- /fold -->

| Spil i kampen | 20,00 KP fra |
| --- | --- |
| 16 | 60 imp |
| 24 | 74 imp |
| 32 | 85 imp |
| 40 | 95 imp |

Udsnit for 40 spil (DBf's tabel):

| Imp-forskel | Vinder | Taber |
| --- | --- | --- |
| 0 | 10,00 | 10,00 |
| 5 | 10,96 | 9,04 |
| 10 | 11,85 | 8,15 |
| 20 | 13,44 | 6,56 |
| 30 | 14,80 | 5,20 |
| 50 | 16,98 | 3,02 |
| 70 | 18,58 | 1,42 |
| 95 | 20,00 | 0,00 |

De første 10 imp giver 1,85 KP, imp 60–70 kun 0,74. Hele skalaen for 40 spil står på bridge.dk.

**Kunstig score i holdkamp:** middel plus er +3 imp og middel minus −3 imp (§ 12C2b), højst 3 spil hver vej pr. kamp; flere annullerede spil udgår, og skalaen for færre spil bruges.

**Særlige kampe** (§ 202): et hold, der sidder over, får 12 KP. Møder man et hold, der udebliver, får man mindst 13 KP. Må alle spil i en kamp udgå, fordi begge hold er skyld i det (fx har siddet forkert), får begge 8 KP.

<!-- beregner: imp -->

### Board-a-match

I board-a-match giver hvert spil 2–0, 1–1 eller 0–2 til det hold, der fik flest point på spillet (§ 206). Størrelsen er ligegyldig, ligesom i matchpoint, så taktikken er parturneringens.

### Cupkampe

En enkeltkamp (cupkamp) afgøres direkte i imp uden kamppoint. Ender den uafgjort, vinder det hold, der sluttede højest i en forudgående kvalifikation; ellers det hold med flest spilpoint i alt, og står de stadig lige, spilles 4 spil ekstra (§ 222).

### Ved pointlighed

- **Parturnering** (§ 223): flest point i de indbyrdes opgør, så flest runder over middel, og så færrest bunde.
- **Holdturnering, alle mod alle** (§ 221): flest KP i de indbyrdes kampe, så bedste kvotient mellem vundne og tabte imp i de indbyrdes kampe, og så i alle kampe.

---

## 5 Taktik

### Kort fortalt

| Situation | Matchpoint (par) | Imp (hold, Butler, cross-imp) |
| --- | --- | --- |
| Hvad tæller | hvor ofte du er bedre end de andre | hvor meget du vinder eller taber |
| Et overstik | kan flytte dig fra 50 % til 100 % | 1 imp, næsten ingenting |
| En katastrofe | koster ét spil, højst 0 % | kan koste 12–17 imp og kampen |
| Udgang | meldes ved ca. 50 % | meldes ved 45 % uden for zone og 37 % i zone |
| Lilleslem | ca. 50 % | 50 % |
| Storeslem | over 50 % | 56–57 % |
| Sikkerhedsspil | sjældent; det koster overstik | ja; kontrakten først |
| Ofring | ofte rigtig, når den er billigere end deres udgang | kun når den er klart billigere |
| Dobling af delkontrakt | ja, når +200 slår din egen score | sjældent; doblet hjemme kan være udgang |

### Parturnering (matchpoint)

- **Hvert spil vejer det samme.** En top og en bund er 50 % i snit; mange små plusser vinder turneringer.
- **Overstik tæller.** Er de fleste i samme kontrakt, spiller spilføreren for flest stik, også med lidt risiko for kontrakten, når chancen for overstikket er størst. Modspillerne gør omvendt: de sparer et overstik, før de går efter at bete kontrakten.
- **Sans og major.** 3 sans med et overstik (430) slår 4♠ (420), og 1 sans med 8 stik (120) slår 2♥ med 8 stik (110). Sans er bedst, når stikkene er de samme; major er bedst, når trumfen giver et stik mere.
- **Minorudgang er sjælden.** 5♦ (400) taber til 3 sans (400 + overstik) og til 4♥/4♠. 3 sans er det første valg.
- **Delkontrakterne er værd at kæmpe om.** Modstanderne skal ikke spille på 2-trinnet med et fit; I genåbner og byder 3 over deres 2, når I har et fit. Delkontraktspil afgør de fleste parturneringer.
- **De 200 point.** Modstandernes delkontrakt giver dem +110 eller +140. Går du én bet doblet i zonen (−200), er det næsten altid en bund. Omvendt: kan du doble dem én bet i zonen (+200), slår det enhver delkontrakt, du selv kunne have spillet.
- **Ofring.** Uden for zonen mod modstandere i zonen er tre bet doblet (−500) billigere end deres udgang (−620). Men først skal det være sikkert, at de vinder udgangen, og at resten af feltet melder den.
- **Normal kontrakt.** I en god kontrakt, som feltet ikke har meldt, spiller du sikkert. I samme kontrakt som feltet spiller du for flest stik.

### Holdturnering (imp)

- **Kontrakten først.** Sikkerhedsspil, der koster et overstik (1 imp) men redder kontrakten (10–12 imp), er altid rigtige.
- **Udgangene skal meldes.** Uden for zonen vinder en udgang 6 imp, når den går hjem, og taber 5, når den går bet (+420 mod +170 og −50 mod +140); den skal derfor holde i ca. 45 %. I zonen er det +10 mod −6 imp, så 37 % er nok.
- **Slem.** Lilleslem kræver ca. 50 % i begge zoner. Storeslem kræver 56–57 %, fordi man risikerer en sikker lilleslem.
- **Delkontrakter er små.** En delkontrakt mere eller mindre er 2–5 imp. Der skal kæmpes, men ikke for enhver pris.
- **En dobling må ikke gøre deres delkontrakt til udgang.** 2♥ doblet hjemme uden for zonen er 470 i stedet for 110, og det koster 8 imp. Delkontrakter skal kun dobles, når du er sikker på bet.
- **Ofring.** 5♦ doblet to bet uden for zonen (−300) mod deres 4♠ i zonen (−620) vinder 8 imp. Går den tre bet (−500), vinder den kun 3. Og kunne 4♠ være gået bet, taber ofringen 12 imp. En ofring er kun rigtig, når du er sikker på, at de vinder deres kontrakt.
- **Butler og cross-imp:** taktikken er den samme, men du sammenlignes med feltets gennemsnit. Normale kontrakter, der går hjem, giver jævne plusser.

### Kamppoint

- **Skalaen er aftagende.** De første imp er mest værd. En sejr på 20 imp i en kamp på 40 spil giver 13,44 KP; at tredoble den til 60 imp giver kun 4,40 KP mere (17,84).
- **Foran sidst i kampen:** du spiller normalt og sikkert, melder de udgange og slemmer, feltet melder, og undgår ofringer og frække doblinger.
- **Bagud sidst i kampen:** du tager chancer, melder de tynde udgange og slemmer og prøver det usædvanlige udspil eller den modige dobling; der skal swing til.
- **I en lang turnering** tæller de samlede kamppoint. Uden de store tab kommer resultaterne.

---

## 6 Handicap

### DBf's handicapsystem

- **Alle medlemmer har et handicap,** og jo lavere, jo bedre har man klaret sig. Det højeste er 52, og nye medlemmer starter normalt der (en spiller, der ikke er begynder, kan få et andet starthandicap).
- **Handicappet reguleres efter hver turnering,** op eller ned efter, hvordan man har klaret sig i forhold til det forventede. Alle turneringer regulerer undtagen cupkampe som Pokalturneringen.
- **Systemet er relativt:** når nogen går ned, går andre op.

### Parturnering

1. **Turneringens gennemsnitshandicap** er gennemsnittet af alle spilleres handicap.
2. **Parhandicappet** er gennemsnittet af de to spilleres handicap.
3. **Forventet score:** et par med lavere parhandicap end turneringens gennemsnit forventes at score over 50 %, et par med højere under. Én handicapenhed svarer til ca. ½ procentpoint; ti enheders forskel giver ca. 5 procentpoint.
4. **Regulering:** scorer parret bedre end forventet, går begge spillere ned i handicap med samme tal; scorer det dårligere, går de op. Over 24 spil giver 10 procentpoint bedre end forventet ca. én handicapenhed ned.

Antallet af par, borde og spil tæller med: en lille turnering er mere tilfældig, så den flytter handicappet mindre pr. spil.

### Et eksempel

Fra DBf's faktaark: seks par, gennemsnitshandicap 22,23.

| Par | Parhandicap | Forventet | Opnået | Regulering |
| --- | --- | --- | --- | --- |
| Ole – Bente (22,00 og 28,00) | 25,00 | 48,34 % | 64,17 % | −0,90 |
| Birthe – Else (26,61 og 43,69) | 35,15 | 42,25 % | 62,50 % | −1,15 |
| Lene – Jytte (17,03 og 45,03) | 31,03 | 44,72 % | 47,50 % | −0,16 |
| Ole – Jette (13,00 og 13,00) | 13,00 | 55,54 % | 46,67 % | +0,50 |
| Henrik – Tove (16,11 og 6,64) | 11,37 | 56,51 % | 44,17 % | +0,70 |
| Inga – Jørgen (17,50 og 18,17) | 17,84 | 52,64 % | 35,00 % | +1,00 |

Turneringen er på 3 borde og 30 spil. Lene og Jytte scorede under middel (47,50 %), men bedre end de 44,72 %, der var forventet, så de går 0,16 ned. Ole og Bente går fra 22,00 og 28,00 til 21,10 og 27,10. (Faktaarket skriver 56,61 % for Henrik og Tove; formlen giver 56,51 %.)

<!-- beregner: handicap -->

### Matematikken

<!-- fold: Formlerne -->
DBf's handicapreglement (2017, afsnit 5) bygger på det svenske forbunds system. For en parturnering med *N*ₚ par, *N*_B borde og *N*_G spil:

**Forventet score** i procent:

r̂ = 50 + (gennemsnitligt parhandicap − parhandicap) / (*C*ᵤ × *C*ₖ × *C*_b)

**Regulering** for hver af de to spillere:

Δh = [(1 − 1/480 × (*N*_B − 1) / (*N*_B + *S*))^*N*_G − 1] × *C*ᵤ × *C*ₖ × *C*_b × (r − r̂)

| Faktor | Parturnering med matchpoint | Turnering i imp |
| --- | --- | --- |
| *S* (spredning) | 0,6 | 0,1 |
| *C*_b (procent eller imp pr. handicapenhed) | 2 | 12 |
| *C*ᵤ (udvanding) | (*N*ₚ − 1) / *N*ₚ; 1 ved datumscore | samme |
| *C*ₖ (ejerskab af resultatet) | 1 for par, ½ for hold, 2 for enkeltmand | samme |

I imp regnes r og r̂ i imp pr. spil og pr. sammenligning. Formlen giver præcis faktaarkets tal. Med 1/480 udfases gamle resultater langsomt: efter 480 spil (ca. 20 klubaftener) stammer omkring en tredjedel af handicappet fra ældre resultater. Handicappet kan ikke blive over 52, så summen af ændringerne er kun 0, når ingen rammer loftet.
<!-- /fold -->

### Handicapturnering

Der spilles som en almindelig turnering, men præmierne går til de par, der har klaret sig bedst i forhold til deres handicap, altså sænket deres handicap mest. Mesterpoint (bronzepoint) gives stadig efter den almindelige stilling.

### Holdturnering

- **Med multiberegning** får hvert par på holdet et parhandicap, og reguleringen sker efter hver halvleg ud fra eget parhandicap og modstanderparrets.
- **Uden multiberegning** får holdet et holdhandicap (gennemsnittet af de fire spillere), og holdet med det laveste forventes at vinde. Reguleringen sker efter kampen.

Cupkampe, Monrad, hjemmelavede skifteplaner og enkeltmandsturneringer regulerer ikke handicap. Rettelser inden for 14 dage efter indlæsning i BridgeCentral regnes automatisk igen.

Resultaterne og ens handicap kan følges under fanebladet Handicap på klubbens hjemmeside.

---

## 7 Beregnere på siden

Hver beregner står i det afsnit, den hører til, og samles desuden under Beregnere øverst på siden.

- **Scoreberegner** (afsnit 1): kontrakt (trin og farve), doblet eller redoblet, zone og antal stik → scoren med regnestykket (stikpoint, bonus, overstik eller bet).
- **Matchpointregner** (afsnit 2): scorerne for et spil → 2/1/0, procent og +1/0/−1, med kontrollen sum = 0. Kan også regne med manglende resultater (Neuberg).
- **Imp- og kamppointomregner** (afsnit 4): to scorer eller en forskel → imp; kampens imp-forskel og antal spil → kamppoint efter WBF's formel.
- **Handicapberegner** (afsnit 6): spillernes handicap, antal par og antal spil → parhandicap, forventet score og, med den opnåede procent, reguleringen.

---

## Kilder

- Bilag D og E i "2 over 1 – Moderne majorstøtte" (Frank og Makker 2).
- "Beregning af score i en parturnering", Nyt fra Ruder Es nr. 50, maj 1992.
- Danmarks Bridgeforbund: Kamppoint for 40 spil, bridge.dk/4000/Kamppointskala.html.
- Danmarks Bridgeforbund: DBf's handicapsystem, faktaark november 2017, og Handicapreglement, 2. januar 2017.
- Danmarks Bridgeforbund: DBf's turneringsbestemmelser – håndbog for turneringsledere, gyldig fra 1. september 2025 (§ X78, § 201–206, § 211, § 221–223).
- Danmarks Bridgeforbund: Lovene for turneringsbridge 2017 (dansk udgave, gældende fra 1. september 2017), § 12C2, § 77 og § 78.
- WBF: Laws of Duplicate Bridge 2017 (scoringstabellen, lov 77) og WBF's kamppointskala (2013).
