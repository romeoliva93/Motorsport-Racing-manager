# ADR-0002 — Stato di gioco e persistenza

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto
Il gioco deve simulare un mondo intero (squadre, persone, contratti, gare) e salvare carriere
pluriennali con storico e statistiche.

## Decisione
- Stato corrente come **database relazionale in memoria** normalizzato (`Record<Id, Entity>` per tabella).
- Modifiche solo tramite **comandi** validati e **sistemi** che emettono **eventi di dominio**.
- **PRNG con seme** (`sfc32`) diviso in flussi per sottosistema, salvato con lo stato.
- Salvataggi: `meta.json` + `state.json.gz` + archivio per stagione, con `schemaVersion` e migrazioni.
- Adapter di storage: filesystem via Tauri (desktop), IndexedDB (sviluppo nel browser).

## Alternative considerate
- **SQLite come stato primario**: query potenti, ma la simulazione richiede comunque lo stato in
  memoria; il doppio modello aumenta complessità e tempi di avanzamento. Riconsiderato per il solo
  archivio statistico se supera ~50 MB per carriera.
- **ECS** (Entity Component System): utile per migliaia di entità in tempo reale; qui le entità
  sono poche centinaia/migliaia e prevalgono le relazioni, quindi un modello relazionale è più chiaro.

## Conseguenze
- (+) Determinismo, replay, riproducibilità dei bug, test golden.
- (+) Salvataggio/caricamento semplici e veloci.
- (−) Lo storico cresce: archiviazione per stagione e caricamento su richiesta.
