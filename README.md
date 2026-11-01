# motorcycle-manager

**LEAN ANGLE — Moto Racing Manager** (titolo provvisorio): videogioco manageriale motociclistico
per PC in un universo originale. Il giocatore è il Team Principal di una scuderia della
*Velocity World Championship* e gestisce piloti, personale, moto, sviluppo, sponsor e finanze,
mentre una simulazione deterministica fa correre ogni sessione del weekend.

## Stato del progetto

| Fase | Stato |
|---|---|
| 0 — Progettazione | Completata (PR in revisione) |
| 1 — Fondamenta | **In corso**: M1.1 infrastruttura, M1.2 `core`, M1.3 schema dati, M1.4 generatore del mondo completati |
| 2–6 | Pianificate, vedi [roadmap](docs/ROADMAP.md) |

Il codice contiene le fondamenta (`packages/core`, `packages/data`): generatore casuale deterministico,
identificativi, tempo di gioco, eventi, denaro, schema delle entità, validatore delle regole del mondo,
salvataggio versionato, **contenuti originali e generatore del mondo** (4 categorie, 41 squadre, 135 piloti,
oltre 500 membri dello staff, 20 circuiti, calendario, contratti, moto, strutture, budget).
**Non c'è ancora nulla di giocabile**: simulazione e interfaccia arrivano nelle milestone successive.

## Sviluppo

Requisiti: Node.js ≥ 22.

```bash
npm install
npm run check        # lint + controllo tipi + test
npm test             # solo test (Vitest)
npm run format       # formattazione (Prettier)
npm run worldgen:report -- <seme>   # riepilogo del mondo generato da un seme
```

| Pacchetto | Contenuto |
|---|---|
| `packages/core` | `Rng`/`RngStreams` (SFC32 con seme), `IdFactory`, `GameCalendar`, `EventLog`, `Result`, denaro intero, utilità matematiche |
| `packages/data` | entità (mondo, persone, squadre, moto, contratti, finanze), `GameState` normalizzato, `validateGameState`, serializzazione con migrazioni, contenuti originali (`content/`) e `generateWorld` (`worldgen/`) |

I confini fra pacchetti sono controllati da ESLint (`core` non importa nulla; `data` solo `core`).

## Documentazione

| Documento | Contenuto |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game Design Document: universo, modalità, campionati, sistemi |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Analisi repository, scelta tecnologica, architettura, cartelle |
| [docs/TECH_TEAM.md](docs/TECH_TEAM.md) | Squadra tecnica, Moto A/B, briefing, mercato e crescita degli ingegneri |
| [docs/REGULATIONS.md](docs/REGULATIONS.md) | Regolamenti delle categorie (moto per pilota, età, sostituzioni, test) |
| [docs/INJURIES_AND_TESTERS.md](docs/INJURIES_AND_TESTERS.md) | Infortuni, decisione sul posto vacante, sostituti, collaudatori, test |
| [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md) | Schede per generare ritratti e moto realistici |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modello dati e convenzioni |
| [docs/SIMULATION.md](docs/SIMULATION.md) | Modello di simulazione e formule principali |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fasi, milestone, funzionalità della v0.1, primo modulo |
| [docs/UI_DESIGN.md](docs/UI_DESIGN.md) | Proposta grafica, menu principale, dashboard |
| [docs/adr/](docs/adr) | Decisioni tecniche (Architecture Decision Records) |
| [docs/mockups/](docs/mockups) | Mockup HTML statici (dati illustrativi) |
| [docs/report/](docs/report) | Report completo scaricabile (PDF e Markdown) |
| [docs/images/collage-tutti-i-mockup.jpg](docs/images/collage-tutti-i-mockup.jpg) | Tutti i mockup in un’unica immagine |

## Tecnologia proposta

TypeScript (monorepo npm) · simulazione in pacchetti puri su Web Worker · React + Vite ·
Canvas 2D (3D futuro dietro un'interfaccia di rendering) · Tauri 2 per il desktop ·
Vitest + Playwright. Dettagli e alternative in [ADR-0001](docs/adr/0001-tech-stack.md).

## Regole di sviluppo
Nessun pulsante finto, nessun risultato prestabilito, nessun dato statico nelle schermate
operative, sistemi indipendenti e testati, formule documentate, PR per ogni milestone e
nessun merge su `main` senza approvazione.
