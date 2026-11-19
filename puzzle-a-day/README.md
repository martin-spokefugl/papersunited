# Daily Calendar Puzzle

A vanilla JavaScript calendar-piece puzzle page served as `/puzzle-a-day/` by the repository's static GitHub Pages site. It uses no build tools, external assets, or additional services.

## Run locally

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/puzzle-a-day/>. The game is also linked from the Papers United header and listed in `sitemap.xml`.

Run the logic tests with `node --test puzzle-a-day/test/*.test.js`.

## Model and rules

`board.js` exports the calendar labels, playable coordinates, and local-date marker mapping. The written row layout has **50** playable cells: 12 month labels, 31 dates, and 7 weekdays. It does not have the 52 cells stated elsewhere in the brief.

`pieces.js` keeps the eight photo-traced pieces in one data file. Coordinates are normalized relative cell positions; only rotations are enabled because the physical reflection rule was not established. The photo as supplied does not let us verify the traced geometry. These definitions total **41** cells, not the 49 required to cover the 47 non-target cells. Consequently completion and solver features correctly report that the puzzle is unsatisfiable; the game does not claim to produce a valid solution. Confirming the exact piece squares and resolving the board/piece totals are necessary before a playable, validated challenge can be delivered.

`logic.js` contains orientation transforms, grid-based legality checks, connectivity validation, exact-cover-style recursive search, and completion validation. The solver rejects area mismatches before searching and validates candidates against the same board model.

## Input and persistence

The date picker uses the browser's local date; target dates are validated by the native date input and JavaScript date construction. Select a piece and tap/click its desired top-left square; desktop users can drag pieces. Rotations use the control buttons or `R` / `Shift+R`; Escape clears selection. Pieces can be returned by selecting one of their occupied squares. Undo and reset are included.

Versioned localStorage saves the selected date, placements, timer, pause state, and basic completion statistics. Invalid or unavailable data falls back to a fresh game. Saved placements are structurally checked, and every move uses logical cells for validation.

## Maintenance and known limitations

Keep UI in `app.js`, isolated page styles in `puzzle.css`, and data/logic in their respective modules. Add behavioral coverage to `test/game.test.js` and run the test command above. The source photo/brief mismatch is the only known blocker to solver, hint, reveal, and full-game completion. Hints and solution reveal fail honestly until geometry is reconciled. No backend or account is required.
