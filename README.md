# motorcycle-manager

**LEAN ANGLE — Moto Racing Manager** (titolo provvisorio): videogioco manageriale motociclistico
per PC in un universo originale. Il giocatore è il Team Principal di una scuderia della
*Velocity World Championship* e gestisce piloti, personale, moto, sviluppo, sponsor e finanze,
mentre una simulazione deterministica fa correre ogni sessione del weekend.

## Stato del progetto

| Fase | Stato |
|---|---|
| 0 — Progettazione | **Proposta in revisione** |
| 1 — Fondamenta | Non iniziata (in attesa di approvazione) |
| 2–6 | Pianificate, vedi [roadmap](docs/ROADMAP.md) |

Al momento il repository contiene solo documentazione e mockup grafici: **nessun sistema di
gioco è ancora implementato**.

## Documentazione

| Documento | Contenuto |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game Design Document: universo, modalità, campionati, sistemi |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Analisi repository, scelta tecnologica, architettura, cartelle |
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
