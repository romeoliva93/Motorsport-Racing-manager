# motorcycle-manager

**LEAN ANGLE — Moto Racing Manager**: gioco manageriale di motociclismo nel browser, in un universo originale
(squadre, piloti, costruttori e marchi inventati). Il giocatore guida una scuderia in uno dei quattro campionati
(Premier, Intermediate, Lightweight, Velocity Rookies Cup): piloti, staff, mercato, sponsor, finanze, sviluppo e
garage della moto, weekend di gara con prove, qualifiche, Sprint e gara simulate in modo deterministico, viste in
2D (principale) o 3D (sperimentale).

Stato dettagliato: [docs/report/REPORT-LEAN-ANGLE.md](docs/report/REPORT-LEAN-ANGLE.md) ·
priorità: [docs/ROADMAP.md](docs/ROADMAP.md).

**Versione online** (privata, condivisibile dal menu della pagina): https://claude.ai/artifact/Hm8aBjMgYxqp3obqHN2Bag
— build di `apps/client`; i salvataggi restano nel browser di chi gioca.

## Sviluppo

Requisiti: Node.js ≥ 22.

```bash
npm install
npm run dev          # app in sviluppo (http://localhost:5173)
npm run build        # build di produzione (apps/client/dist)
npm run check        # lint + controllo tipi + test Vitest
npm run e2e          # carriera completa nel browser con Playwright (richiede la build)
npm run worldgen:report -- <seme>   # riepilogo del mondo generato da un seme
```

Gli screenshot della prova Playwright finiscono in `test-results/screenshots/` (ignorata da Git): sono artefatti
temporanei di verifica, non vanno nel repository.

| Pacchetto | Contenuto |
|---|---|
| `packages/core` | generatore casuale con seme, ID, calendario di gioco, eventi, denaro |
| `packages/data` | schema dello stato di gioco, contenuti originali, generatore del mondo, salvataggi con migrazioni |
| `packages/sim` | motore di gara e di qualifica |
| `packages/game` | `GameEngine`: comandi, weekend, regolamento, economia, garage, assetti, viste per l'interfaccia |
| `packages/persistence` | formato dei salvataggi e archivio |
| `packages/engine-host` | motore nel Web Worker e client con Promise |
| `apps/client` | app React + Vite: design system "Paddock Night", schermate, vista gara 2D/3D |
| `tools/` | prova e2e, report del mondo, generazione locale delle immagini (`tools/portraits/`) |

Confini fra pacchetti controllati da ESLint: `core` ← `data` ← (`sim`, `game`, `persistence`) ← `engine-host` ← `apps/client`.

## Immagini del gioco

Ritratti, foto delle moto delle squadre e immagini dei gruppi tecnici sono generati **in locale e gratis**
(SDXL-Turbo, Stability AI Community License) con gli script in `tools/portraits/`. Inventario, provenienza e
licenze: [docs/ASSETS_E_LICENZE.md](docs/ASSETS_E_LICENZE.md).

## Documentazione

| Documento | Contenuto |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game Design Document |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestone e priorità |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architettura tecnica e stato effettivo del codice |
| [docs/SIMULAZIONE-INCREMENTALE.md](docs/SIMULAZIONE-INCREMENTALE.md) | Simulazione a passi, strategie in gara, salvataggio a metà sessione |
| [docs/SALVATAGGI.md](docs/SALVATAGGI.md) | Formato dei salvataggi, versioni e migrazioni |
| [docs/SIMULATION.md](docs/SIMULATION.md) | Modello di simulazione e formule |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modello dati e convenzioni |
| [docs/REGULATIONS.md](docs/REGULATIONS.md) | Regolamenti delle categorie |
| [docs/TECH_TEAM.md](docs/TECH_TEAM.md) | Squadra tecnica, Moto A/B, briefing |
| [docs/INJURIES_AND_TESTERS.md](docs/INJURIES_AND_TESTERS.md) | Infortuni, sostituti, collaudatori |
| [docs/UI_DESIGN.md](docs/UI_DESIGN.md) | Design system e regole dell'interfaccia |
| [docs/ASSETS_E_LICENZE.md](docs/ASSETS_E_LICENZE.md) | Asset, generazione, licenze |
| [docs/adr/](docs/adr) | Decisioni architetturali (ADR) |

## Regole di sviluppo

Nessun pulsante finto, nessun risultato prestabilito, nessun dato statico nelle schermate operative, sistemi
testati, formule documentate, un ramo e una PR per milestone, nessun merge su `main` senza approvazione.

## Crediti

- Bandiere: [flag-icons](https://github.com/lipis/flag-icons) di Panayiotis Lipiridis, licenza MIT.
- Grafica 3D: [Three.js](https://threejs.org), licenza MIT.
- Carattere: Archivo (Google Fonts), SIL Open Font License.
- Immagini generate con SDXL-Turbo (Stability AI Community License) — vedi docs/ASSETS_E_LICENZE.md.
