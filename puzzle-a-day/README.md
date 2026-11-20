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

## Brett og brikker

`board.js` beskriver brettet som åtte rader med sju kolonner. De 50 spillbare rutene er 12 måneder, 31 datoer og 7 ukedager. Datoens tre mål beregnes fra nettleserens lokale kalenderdato.

`pieces.js` inneholder de ti brikkeformene som eieren har oppgitt med rader av `X` og `.`. Formene har 47 ruter til sammen. Testene kontrollerer antall brikker/ruter, sammenheng, unike ruter, rotasjoner og speilvendte orienteringer. Eksakt-cover-løseren finner plasseringer for de seks angitte prøvedatoene, alle ukedagene og alle datoer i 2026 og skuddåret 2028.

`logic.js` normaliserer koordinater etter rotasjon og speiling, dedupliserer symmetriske orienteringer, genererer lovlige plasseringer og søker med eksakt-cover/backtracking og minste antall kandidater. `validateComplete` kontrollerer løsningen uavhengig av søket: hver brikke én gang, ingen overlapp, ingen målruter dekket og alle andre spillruter dekket.

## Spill, lagring og statistikk

Velg en brikke og trykk på brettet; på datamaskin kan brikken også dras. Bruk knappene eller `R` / `Shift+R` for å rotere, `F` for å speile og `Esc` for å velge bort. Trykk på en plassert brikke for å ta den tilbake. Det er alltid mulig å nullstille eller angre plasseringer.

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
