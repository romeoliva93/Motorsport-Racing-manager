# Salvataggi

## Dove e come
- Il motore di gioco gira nel Web Worker e lavora su un `GameState` normalizzato (tabelle per entità + campi
  globali). Il client salva su **IndexedDB** del browser (slot multipli: `packages/persistence`).
- Formato: JSON con `schemaVersion`. `packages/data/src/serialize.ts` applica in sequenza le **migrazioni**
  (`MIGRATIONS[n]` porta da n a n+1) fino alla versione corrente, poi verifica la struttura.
- Salvataggi più recenti del gioco vengono rifiutati con un messaggio chiaro; versioni senza migrazione idem.

## Cosa contiene
- Tabelle: mondo (categorie, stagioni, round, circuiti), squadre, piloti, staff, contratti, moto (con `parts`:
  chilometri e revisioni dei 14 componenti fisici), finanze, trattative, risultati, notizie, sponsor, ordini di
  upgrade.
- Campi globali: `upgrades` (livelli per reparto), `garageMode` (manutenzione per squadra), `spares` (ricambi),
  `setups` (assetto di ogni pilota, asciutto/bagnato), stato del generatore casuale e contatori degli ID.
- La gara in diretta in corso (`liveSession`): preparazione, stato completo della simulazione e posizione del
  visore. Caricando si riprende esattamente dallo stesso punto (vedi `SIMULAZIONE-INCREMENTALE.md`).

## Regole
- I campi nuovi facoltativi non richiedono migrazione (assenti = valore predefinito); un cambio di significato o
  di struttura richiede una nuova versione e una migrazione con test (`serialize.test.ts`).
- Gli ID esistenti non si riusano né si cancellano: le carriere salvate li referenziano.
- Il mondo iniziale è fisso (`UNIVERSE_SEED`): stessi personaggi in ogni nuova carriera.

## Versioni dello schema
| Versione | Cambiamento |
|---|---|
| 2 | trattative di mercato |
| 3 | risultati delle sessioni e notizie |
| 4 | upgrade dei componenti, sponsor con obiettivo |
| 5 | ordini di upgrade alla fabbrica |
| 6 | griglia iniziale solo maschile: le due pilote della Intermediate del mondo fisso diventano Elia Rinaldini (ITA) e Gonzalo Llorente (ESP). Stessi ID, contratti, attributi e risultati; aggiornate anche le notizie. |
