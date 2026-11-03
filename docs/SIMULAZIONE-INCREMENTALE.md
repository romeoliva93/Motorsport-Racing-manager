# Piano tecnico — Simulazione incrementale (Milestone B) · DA APPROVARE

> Stato: **proposta**. Nessuna modifica al motore di gara è stata fatta. Serve l'approvazione dell'utente.

## 1. Situazione attuale (verificata nel codice)
- `packages/sim/src/race.ts → simulateRace(seed, riders, laps, cond)` simula **tutta** la gara in un colpo:
  produce fotogrammi (distanza di ogni pilota ogni `frameEvery` secondi), eventi e risultati.
- `packages/game/src/weekend.ts → raceSession()` chiama la simulazione, **salva subito** risultati, punti, notizie e
  usura, poi passa i fotogrammi al client (`ReplayData`), che li riproduce (2D e 3D).
- Conseguenza: ritmo, gomme e carburante si scelgono solo prima del via; cambiarli in corsa non ha effetto.

## 2. Proposta
### 2.1 Motore a passi
- Nuovo `RaceSim` in `packages/sim` con stato **serializzabile** (JSON): per pilota distanza, giro, gomma (età,
  temperatura, usura), carburante, ritmo/mappe, stanchezza, penalità, stato (in pista/box/ritirato); globali: tempo,
  bandiere, meteo, eventi già emessi, **stato del generatore casuale**.
- `step(state, dt=0,5 s, commands)` avanza di un passo; `simulateRace()` diventa un ciclo di `step()` senza comandi
  (stessi risultati di oggi a parità di seme → i test esistenti restano validi come regressione).
- Determinismo: un generatore per pilota derivato dal seme della sessione; i comandi sono applicati **al confine del
  passo** e registrati con il tempo di applicazione → rigiocando seme + comandi si ottiene lo stesso risultato.

### 2.2 Strategie in gara (giocatore e IA, stesse regole)
| Leva | Valori | Effetto (calcolato a ogni passo) |
|---|---|---|
| Ritmo | molto conservativo · conservativo · normale · aggressivo · attacco massimo | tempo sul giro, degrado e temperatura gomme, consumo, rischio errore, affaticamento |
| Carburante | risparmio · standard · prestazione | potenza (tempo), consumo; a secco = ritiro o ritmo forzato in risparmio |
| Gomme | conservativa · bilanciata · prestazionale | grip immediato vs degrado; interagisce col ritmo |
- IA: decisioni ogni giro con le stesse leve (distacchi, usura, carburante residuo, carattere del pilota).

### 2.3 Dove gira
- La gara gira nel **worker** (come oggi il motore di gioco). Il client chiede `advance(secondi)` con la velocità
  scelta (1×–16×); il worker restituisce lo stato per 2D/3D. Pausa = nessun avanzamento.
- Risultati, punti e usura si scrivono **solo alla bandiera a scacchi** (oggi: subito).
- "Salta alla fine" = avanzare fino al termine senza disegnare.

### 2.4 Salvataggio a metà sessione
- Nel `GameState`: `liveSession?: { roundId, kind, simState, commandLog, selectedRiderId, view }`.
- Caricando si riprende dallo stesso passo; nessun ricalcolo → nessun cambio di risultato.
- Migrazione schema 5 → 6: `liveSession` assente nei vecchi salvataggi (nessun dato da convertire).

### 2.5 Prove e qualifiche (Milestone C, stessa base)
- Sessione a tempo con uscite: il manager sceglie giri, gomme, carburante, ritmo; rientro ai box → briefing breve
  (pilota + capotecnico, 4 scelte) e modifiche d'assetto con tempi (piccole regolazioni: minuti; interventi grossi:
  molto di più; meccanici disponibili accorciano i tempi).
- Confidenza col circuito e con la moto: due valori che crescono con i giri (rendimenti decrescenti), influenzati da
  meteo, esperienza, qualità dell'assetto.

## 3. Rischi
| Rischio | Mitigazione |
|---|---|
| Risultati diversi dagli attuali (bilanciamento) | test di regressione su 200 gare: distribuzione vittorie, ritiri, distacchi entro tolleranza |
| Prestazioni (gara 16× nel worker) | passo 0,5 s × 22 piloti = calcolo leggero; misura nel test (< 50 ms per minuto di gara) |
| Determinismo rotto da ordine dei comandi | comandi applicati solo ai confini del passo, registrati e ordinati |
| Salvataggi vecchi | `liveSession` opzionale; migrazione testata |
| Complessità del codice | `RaceSim` isolato in `packages/sim`, il resto del gioco vede solo `step()` e `result()` |

## 4. Test previsti
1. stesso seme senza comandi = risultati identici a `simulateRace()` attuale;
2. stesso seme + stessi comandi = stessi risultati (anche con salvataggio/caricamento in mezzo);
3. ritmo "attacco massimo" → giri più veloci, più usura gomme e consumo, più errori (statistica su 200 gare);
4. carburante "risparmio" → consumo minore e giri più lenti; a secco → effetto previsto;
5. cambio vista 2D/3D durante il passo: nessun effetto sullo stato;
6. IA: le squadre usano le leve (non restano sempre su "normale");
7. compatibilità: salvataggi schema 5 si caricano.

## 5. Stima
Motore a passi + strategie + salvataggio: 2 milestone di lavoro. Prove/qualifiche e briefing: 1–2 milestone dopo.
