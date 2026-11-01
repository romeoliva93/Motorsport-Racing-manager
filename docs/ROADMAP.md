# Roadmap

> Stato: **PROPOSTA**. Ogni milestone corrisponde a un branch e a una Pull Request.
> Nessuna milestone viene integrata in `main` senza approvazione.
> "Completato" significa: implementato, testato, collegato ai dati reali e documentato.

## Fase 0 — Progettazione (questa PR)
Analisi del repository, scelta tecnologica, architettura, modello dati, GDD, modello di
simulazione, design system e mockup di menu principale e dashboard.

## Fase 1 — Fondamenta

| Milestone | Contenuto | Criteri di accettazione |
|---|---|---|
| **M1.1 Infrastruttura** | workspace npm, TS strict, Vite, Vitest, ESLint/Prettier, CI GitHub Actions, controllo confini pacchetti | `npm test` e `npm run build` verdi in CI |
| **M1.2 Core** | PRNG con seme e flussi, ID, calendario di gioco (`GameDay`), bus eventi, `Result`, utilità matematiche | test di determinismo e distribuzione del PRNG |
| **M1.3 Schema dati** | tipi delle entità (incluse `Bike` con slot A/B, `StaffAssignment`, `RiderStaffBond`, `Briefing`), separazione tipi `Truth*` / osservazioni, validatori, `GameState` normalizzato, serializzazione | round-trip senza perdite; test che vieta l'uso dei tipi `Truth*` fuori dal motore |
| **M1.4 Content e generatore del mondo** | content pack originali (costruttori, squadre, circuiti, sponsor, nomi), generatore di piloti e staff con attributi per ruolo (ingegneri di pista, capotecnici, specialisti), controllo nomi reali | stesso seme → stesso mondo; invarianti (2 piloti per squadra, 1 capotecnico + 1 ingegnere di pista per pilota, età per categoria) |
| **M1.5 Engine host** | Web Worker, protocollo comandi/query, avanzamento del tempo | test di integrazione comando → evento |
| **M1.6 Design system e shell** | token, tipografia, componenti base, sidebar a 16 voci, top bar, scala Full HD/4K | screenshot Playwright 1080p e 4K |
| **M1.7 Menu e nuova carriera** | menu principale, scelta squadra esistente, salvataggio iniziale | partita creata dal generatore e visibile nella shell |
| **M1.8 Schermate dati** | Scuderia, Piloti (lista + scheda), Personale (lista + scheda) collegate allo stato | nessun dato statico nelle schermate |

## Fase 2 — Prima stagione giocabile (v0.1)

| Milestone | Contenuto |
|---|---|
| M2.1 Calendario e tempo | stagione Premier, avanzamento giorni, eventi, inbox decisioni |
| M2.2 Moto e componenti | modello componenti → parametri fisici, usura, affidabilità base |
| M2.3 Motore di gara | profilo di velocità, modello pilota, traffico, scia, sorpassi, errori/cadute base, gomme base |
| M2.4 Vista 2D | renderer Canvas, classifica live, velocità pausa–16×, feed eventi |
| M2.5 Weekend | FP, qualifiche, gara (formato da regolamento), risultati e punti |
| **M2.5b Assetto e briefing base** | assetto base da libreria, problemi reali di assetto → sintomi del pilota, 1–2 proposte di ingegnere/capotecnico dopo ogni sessione, scelta del manager (accetta / mantieni / segui il pilota), effetto reale sulla sessione successiva; delega |
| M2.6 Classifiche | piloti, squadre, costruttori; schermata Campionato |
| M2.7 Economia base | stipendi, premi, sponsor esistenti, trasferte; schermata Finanze |
| M2.8 Salvataggi | slot multipli, manuale, autosalvataggio, migrazioni |
| M2.9 Bilanciamento | `tools/balance`: distribuzione vittorie, distacchi e cadute verosimili |

**Funzionalità della prima versione giocabile (v0.1)**
- Nuova carriera con squadra esistente in **Premier**.
- Mondo generato: 11 squadre, 22 piloti, staff, 5 costruttori, 20 circuiti, sponsor.
- Stagione completa di 20 round con formato prove/qualifiche/gara (Sprint opzionale da regolamento).
- Gara simulata con vista 2D, velocità pausa–16×, sorpassi, errori, cadute, guasti base, gomme e carburante.
- Strategia pre-gara (mescola, mappa, obiettivo) e pit board base.
- Un capotecnico e un ingegnere di pista per pilota con attributi tecnici di base.
- Feedback del pilota dopo le prove e prime modifiche all'assetto (briefing semplificato), con modello verità/osservazioni già attivo.
- **Una sola moto per pilota** in gara (lo schema dati prevede già Moto A/B: nessuna migrazione futura).
- Classifiche piloti/squadre/costruttori, risultati di ogni sessione.
- Finanze base con bilancio reale derivato dalle transazioni.
- Salvataggi su slot e autosalvataggio.
- Schermate attive: Panoramica, Scuderia, Piloti, Personale, Moto (sola lettura), Finanze,
  Calendario, Campionato, Notizie (generate dagli eventi). Le altre voci sono visibili come
  "In sviluppo" e disabilitate.

## Fase 3 — Gestione avanzata
Mercato piloti e staff, negoziazione contratti con controfferte, sponsor e negoziazione,
accademia, strutture, ricerca e sviluppo completa, modalità **Crea la tua squadra**,
categorie Intermediate e Lightweight giocabili, serie feeder simulate.

**Squadra tecnica (livello intermedio)**
- M3.x **Mercato ingegneri**: scouting dello staff con attributi a intervallo, contratti (ruolo e pilota garantiti), offerte delle squadre IA.
- M3.x **Crescita professionale**: competenze dal lavoro svolto, reputazione dai risultati, potenziale e curve di carriera, corsi di formazione.
- M3.x **Rapporti pilota-staff**: fiducia, comunicazione, compatibilità, comprensione dello stile; riassegnazioni.
- M3.x **Moto A / Moto B**: due moto per pilota, stato individuale, lavori e prontezza, condivisione dei motori.

## Fase 4 — Simulazione avanzata
Assetto completo con feedback e proposte dello staff, telemetria con grafici e confronto,
strategie di gara complete, IA di gara e IA gestionale delle squadre, meteo dinamico con
asciugatura e flag-to-flag, incidenti, bandiere, penalità, interruzioni.

**Squadra tecnica (completamento intermedio → avanzato)**
- Briefing interattivi completi (seconda analisi, confronto soluzioni, parere del capotecnico, sperimentazione su Moto B) e briefing finale pre-gara con scenari di pioggia.
- Confronto A/B corretto per le condizioni, con incertezza (richiede la telemetria di questa fase).
- Programma delle sessioni e preparazione al bagnato (richiede meteo dinamico).
- **Cambio moto flag-to-flag completamente simulato** (richiede Moto A/B di Fase 3 + meteo con asciugatura).
- IA delle squadre su staff, briefing, Moto A/B e preparazione alla pioggia.

## Fase 5 — Mondo dinamico
Rivalità, media e conferenze, regolamenti con votazioni, evoluzione e crisi delle squadre,
ingresso/uscita di costruttori, storia del campionato, record, archivio pluriennale.

**Squadra tecnica (avanzato)**: diagnosi approfondite e analisi telemetrica avanzata, errori di
interpretazione e confidenza "falsata" dalla personalità, formazione specialistica e mentoring,
relazioni e conflitti complessi (richieste di sostituzione, tecnici che seguono un pilota), storico
delle diagnosi per ingegnere.

## Dipendenze dei nuovi sistemi

```
Schema dati con Bike A/B + Truth/Observation (Fase 1)
   └─► Assetto + problemi reali + sintomi + briefing base (Fase 2, MVP)
         ├─► Staff con attributi completi ─► Mercato ingegneri ─► Crescita ─► Rapporti (Fase 3)
         ├─► Moto A/B, lavori e prontezza (Fase 3)
         │     └─► Confronto A/B corretto (Fase 4, richiede telemetria)
         └─► Briefing interattivi completi (Fase 4)
Meteo dinamico + asciugatura (Fase 4) ─┬─► Preparazione al bagnato nei briefing
                                       └─► Flag-to-flag simulato (richiede anche Moto A/B)
```

**Cosa resta fuori dall'MVP e perché**: seconda moto, mercato ingegneri, crescita e confronto A/B
richiedono telemetria, meteo e mercato completi; inserirli nella v0.1 ritarderebbe la prima stagione
giocabile. Lo schema dati li prevede fin dall'inizio, quindi verranno aggiunti senza riscritture.

## Fase 6 — Grafica avanzata
Modelli moto e livree avanzate, paddock, telecamere, replay (dal flusso `RaceFrame` già
registrato), eventuale renderer 3D (Three.js/Babylon.js) dietro l'interfaccia `RaceRenderer`.

## Primo modulo da sviluppare

**M1.1 + M1.2 + M1.3 → `packages/core` e `packages/data/schema`.**

Motivazione: ogni altro sistema (simulazione, economia, UI) dipende dal PRNG deterministico,
dal tempo di gioco e dallo schema delle entità. Sono moduli piccoli, interamente testabili
senza interfaccia, e fissano le convenzioni del progetto.

In parallelo propongo uno **spike tecnico** isolato (`tools/sim-cli`, non integrato nel gioco):
calcolo del tempo sul giro con il profilo di velocità su un circuito di prova, per validare
presto che il modello fisico produca tempi e velocità realistiche. È il rischio tecnico
principale del progetto e conviene affrontarlo subito.
