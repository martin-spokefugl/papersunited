# Dagens utfordring

Et norsk kalenderpuslespill i vanlig HTML, CSS og JavaScript. Den statiske siden publiseres på `/puzzle-a-day/` sammen med Papers United. Ingen byggesteg, kontoer, eksterne biblioteker eller tjenester er nødvendig.

## Lokal kjøring og tester

Fra rotmappen i repoet:

```sh
python3 -m http.server 8000
```

Åpne <http://localhost:8000/puzzle-a-day/>. Kjør logikk- og løsertestene med:

```sh
node --test puzzle-a-day/test/*.test.js
```

For nettlesertesten, start lokalserveren på port 8765 og sett `PLAYWRIGHT_CORE` til absolutt sti til en lokal installasjon av `playwright-core/index.mjs`. Kjør `node puzzle-a-day/test/browser.mjs`. `CHROME_PATH` kan angi en annen Chrome-binær, og `PUZZLE_URL` en annen lokal adresse. Testen bruker isolerte nettleserkontekster.

## Brett og brikker

`board.js` beskriver brettet som åtte rader med sju kolonner. De 50 spillbare rutene er 12 måneder, 31 datoer og 7 ukedager. Datoens tre mål beregnes fra nettleserens lokale kalenderdato.

`pieces.js` inneholder de ti brikkeformene som eieren har oppgitt med rader av `X` og `.`. Formene har 47 ruter til sammen. Testene kontrollerer antall brikker/ruter, sammenheng, unike ruter, rotasjoner og speilvendte orienteringer. Eksakt-cover-løseren finner plasseringer for de seks angitte prøvedatoene, alle ukedagene og alle datoer i 2026 og skuddåret 2028.

`logic.js` normaliserer koordinater etter rotasjon og speiling, dedupliserer symmetriske orienteringer, genererer lovlige plasseringer og søker med eksakt-cover/backtracking og minste antall kandidater. `validateComplete` kontrollerer løsningen uavhengig av søket: hver brikke én gang, ingen overlapp, ingen målruter dekket og alle andre spillruter dekket.

## Spill, lagring og statistikk

Velg en brikke og pek på brettet for å se plasseringen før du klikker. På berøringsskjerm trykker du på en rute for å forhåndsvise og igjen for å plassere. Grønt/✓ betyr gyldig, rødt/✕ betyr ugyldig, og ⊕ markerer festepunktet. Brikker kan også dras fra brikkefigurene eller fra brettet; på berøringsskjerm vises forhåndsvisningen litt over fingeren. Dra utenfor brettet for å avbryte. Flytting av en plassert brikke kan angres i ett trekk. Bruk knappene eller `R` / `Shift+R` for å rotere, `F` for å speile og `Esc` eller «Avbryt valg» for å velge bort. Trykk på en plassert brikke uten å ha valgt en annen for å ta den tilbake. Med tastatur velger du en brikke, går til en brettcelle med Tab og trykker Enter for å plassere.

Hint bruker solverens løsning for gjeldende plassering. «Vis løsning» krever bekreftelse og markerer runden som hjulpet. Deling bruker Web Share API når tilgjengelig, ellers utklippstavle med reserve for eldre nettlesere.

Spilltilstand og statistikk lagres lokalt i nettleseren under separate, versjonerte nøkler (`v2`). Eldre spilltilstand fra prototypen gjenopprettes ikke. Statistikken teller én beste fullføring per kalenderdato. Rekke og personlig rekord teller bare fullføringer uten hint eller løsningsvisning; gjennomsnitt og fullførte datoer inkluderer også hjulpne runder. Nettleserlagring som mangler, er ugyldig eller utilgjengelig gir en tom, spillbar økt.

## Vedlikehold og begrensninger

- Brettdata: `board.js`
- Brikkedata: `pieces.js`
- Regler og solver: `logic.js`
- Grensesnitt og spillflyt: `app.js`, `index.html`, `puzzle.css`
- Lokal lagring: `storage.js`
- Automatiserte tester: `test/game.test.js`

Søkekjøringen for de testede datoene er kort nok til å kjøre synkront uten å fryse grensesnittet; hvis brikkesettet utvides, vurder Web Worker og tidsavbrudd. Ingen kjente blokkeringer for de validerte datoene. Ingen serverbaserte resultattavler eller synkronisering mellom enheter.
