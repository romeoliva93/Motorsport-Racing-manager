# ADR-0003 — Modello di conoscenza (verità vs informazioni della squadra)

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto
Briefing tecnici, confronto Moto A/B, scouting di piloti e ingegneri e previsioni meteo richiedono
che il giocatore (e le squadre IA) prendano decisioni con **informazioni incomplete e rumorose**,
mentre la simulazione deve conoscere lo stato reale.

## Decisione
- Separare in `packages/sim` lo **stato reale** (`TruthState`: problemi reali di assetto, potenziale reale,
  meteo futuro) dalle **osservazioni** (`Observation`, `RiderFeedback`, `StaffHypothesis`, `ScoutReport`,
  `Forecast`), generate da funzioni pure con PRNG dedicato.
- La UI e l'IA gestionale leggono **solo** le osservazioni, tramite selettori di "conoscenza della squadra"
  (`KnowledgeView(teamId)`). Un test di architettura vieta l'import dei tipi `Truth*` fuori da `sim` e
  dai risolutori interni di `game`.
- Le decisioni vengono applicate allo stato reale; i risultati tornano come nuove osservazioni.

## Alternative considerate
- **Mostrare i valori reali con un filtro nella UI**: semplice, ma fragile (basta un bug per svelare la soluzione)
  e non utilizzabile per un'IA "onesta".
- **Nessuna incertezza**: rende il briefing decorativo, contrario all'obiettivo di gameplay.

## Conseguenze
- (+) Briefing e scouting diventano vere meccaniche; le IA competono alla pari.
- (+) Test semplici: si verifica la calibrazione (es. ingegnere con Diagnosi 80 → ~75% diagnosi corrette).
- (−) Più tipi e più dati da salvare (storico delle ipotesi): gestito con archivio per stagione.
