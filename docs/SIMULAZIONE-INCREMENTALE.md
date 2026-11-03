# Simulazione incrementale della gara (Milestone B) · IMPLEMENTATA

Sprint e gara si simulano **a passi** mentre il giocatore le guarda: le strategie dei propri piloti si cambiano in
corsa, l'IA usa le stesse leve, e la partita si può salvare a metà gara e riprendere dallo stesso punto.

## Motore (`packages/sim/src/race.ts`)
- `class RaceSim`: passo fisso `RACE_DT = 0,25 s`; `advanceTo(t)`, `step()`, `runToEnd()`, `result()`.
- Stato serializzabile: `snapshot()` / `RaceSim.restore()` (comprese le estrazioni casuali: `Rng.snapshot()` conserva
  anche la normale di riserva). Gli infiniti sono codificati come ±1e12 per stare in JSON.
- `runRace(setup)` = `new RaceSim(setup).runToEnd()`: la gara non in diretta usa lo stesso codice.
- Per pilota: distanza, giro, gomma (usura, temperatura), carburante, stanchezza, penalità, stato.

## Leve (giocatore e IA, stesse regole)
| Leva | Valori | Effetti |
|---|---|---|
| Ritmo | molto conservativo · conservativo · normale · attacco · attacco massimo | tempo sul giro, rischio caduta, degrado e temperatura gomme, consumo, stanchezza, sorpassi |
| Carburante | risparmio · standard · prestazione | potenza e consumo; a secco = ritiro (`fuel`) |
| Gomme | conservativa · bilanciata · prestazionale | grip immediato contro degrado |

- Serbatoio per categoria (`FUEL_CAPACITY` in `weekend.ts`); il carico di partenza basta per la gara con il 6% di
  margine a ritmo standard, quindi spingere a lungo in "prestazione" obbliga a risparmiare dopo.
- IA (`aiDecide`, una volta per giro): distacchi, usura, carburante residuo, giri mancanti.
- Ogni cambio è un evento `strategy` nella cronaca della gara.

## Dove gira
- Nel Web Worker, dentro `GameEngine`: `RunSession { live: true }` prepara la gara (`startLiveRace`), crea la
  `RaceSim` e scrive `state.liveSession`.
- Il visore (`RaceViewer.tsx`) chiede blocchi con `liveAdvance(t, fromFrame, fromEvent, viewerT)` e tiene un piccolo
  anticipo (≥ 4 s di gara, di più alle velocità alte); la riproduzione non supera mai i fotogrammi già calcolati.
- Risultati, punti, usura, forma e morale si scrivono **solo alla fine** (`completeLiveRace`).
- "Salta alla fine" = comando `FinishLiveRace`.
- Durante la gara in diretta i comandi ammessi sono solo `SetRaceStrategy` (solo per i propri piloti) e
  `FinishLiveRace`.

## Salvataggio a metà gara
- `liveSession = { prep, snapshot, viewerT }` (campo facoltativo di `GameState`): preparazione della gara, stato
  completo della simulazione e posizione del visore.
- Al caricamento `GameEngine` ricostruisce la `RaceSim`; il weekend riapre il visore da `viewerT`.
- Test: salvare, serializzare, ricaricare e finire dà risultati **identici** a non aver salvato
  (`packages/game/src/live.test.ts`); l'e2e salva al giro 3 e riprende al giro 3–4 con la strategia mantenuta.

## Verifiche (`packages/sim/src/raceSim.test.ts`)
- a passi = tutta insieme; snapshot/ripresa identica; un cambio di strategia cambia il risultato;
- attacco massimo contro molto conservativo: più veloce, più usura, più consumo, più cadute;
- mappa risparmio e ritiro per carburante; l'IA usa le leve;
- bilanciamento su 120 gare (vittorie dei primi 5 per valore > 50%, ritiri medi 0,3–4, ritiri per carburante rari).
  Confronto su 200 gare con il motore precedente: vittorie dei primi 5 0,665 → 0,625; ritiri medi 0,45 → 0,64.

## Prossimo passo (Milestone C)
Prove libere e qualifiche con uscite dai box, giri, confidenza, briefing con pilota e capotecnico, modifiche
d'assetto con tempi di lavoro e riunione tecnica: vedi `ROADMAP.md`.
