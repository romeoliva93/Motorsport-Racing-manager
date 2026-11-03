# Architettura tecnica

> Stato: **PROPOSTA — in attesa di approvazione** (Fase 0).
> Nessun modulo di gioco è ancora implementato.

## 1. Analisi del repository (1 novembre 2026)

| Verifica | Esito |
|---|---|
| Repository | `romeoliva93/motorcycle-manager` (privato) |
| Branch | `main` (unico), commit `57880d3` "Initial commit" |
| File presenti | solo `README.md` (titolo) |
| Tecnologie già in uso | nessuna |
| Modifiche non salvate / PR aperte | nessuna |
| Toolchain disponibile nell'ambiente cloud | Node.js 22, npm 10, Rust/Cargo, Python 3.13, Chromium + Playwright |

Il progetto parte quindi da zero: la scelta tecnologica non è vincolata da codice esistente.

## 2. Valutazione delle tecnologie

Il gioco è un **manageriale**: il 90% del tempo il giocatore legge tabelle, grafici,
schede e prende decisioni; il restante 10% guarda una simulazione 2D (in futuro 3D).
Il cuore tecnico è una **simulazione deterministica** che deve essere testabile senza interfaccia.

| Criterio (peso) | Godot 4 | Unity 6 | Unreal 5 | **TypeScript + React + Tauri** |
|---|---|---|---|---|
| UI densa di dati: tabelle, grafici, filtri, 4K (alto) | Discreta (Control node, tabelle e grafici da scrivere a mano) | Discreta (UI Toolkit) | Scarsa per UI gestionali (UMG pesante) | **Eccellente** (CSS Grid, tipografia, virtualizzazione, SVG) |
| Testabilità della simulazione headless (alto) | Buona (GUT / C#) | Buona (NUnit, ma richiede editor/batchmode) | Media (C++ automation) | **Eccellente** (Vitest, millisecondi, CI semplice) |
| Modularità / manutenibilità (alto) | Buona | Buona | Media | **Eccellente** (workspace npm, pacchetti tipizzati) |
| Prestazioni simulazione (medio) | Buone | Ottime | Ottime | Buone (V8 JIT + Web Worker; ampiamente sufficienti per 22–34 moto) |
| Futuro 3D, replay, telecamere (medio) | Buono | Ottimo | Ottimo | Discreto (Three.js / Babylon.js, stile non fotorealistico) |
| Costi e licenze (alto) | Gratis (MIT) | Piani a pagamento sopra soglie | 5% royalty oltre 1 M$ | **Gratis** (MIT/Apache) |
| Distribuzione PC (alto) | Win/Mac/Linux | Win/Mac/Linux | Win/Mac/Linux | Win/Mac/Linux, installer ~10–15 MB, compatibile Steam |
| Sviluppo in ambiente cloud senza editor grafico (alto) | Limitato | Molto limitato | Molto limitato | **Completo** (build, test e screenshot via CLI/Playwright) |

### Raccomandazione

**Stack web/desktop in TypeScript**:

- **TypeScript (strict)** per tutto il codice di gioco.
- **Simulazione e logica di gioco in pacchetti puri** (nessuna dipendenza da DOM o UI), eseguiti in un **Web Worker**.
- **React + Vite** per l'interfaccia.
- **Canvas 2D** per la vista di gara dall'alto, dietro un'interfaccia `RaceRenderer` intercambiabile.
- **Tauri 2** come contenitore desktop (Windows/macOS/Linux). Più leggero di Electron, usa la WebView di sistema e un backend Rust minimo per filesystem e salvataggi.
- **Vitest** per i test, **ESLint + Prettier** per la qualità del codice.

Rischio principale: la qualità 3D in Fase 6. Mitigazione: la simulazione produce un
**flusso di frame neutrale rispetto al motore** (posizione lungo pista, offset laterale,
angolo di piega, velocità, eventi). Un renderer Three.js/Babylon.js può consumarlo
direttamente; se in futuro servisse un 3D di alto livello, lo stesso formato di replay
può essere letto da un visualizzatore Godot/Unity separato senza riscrivere la simulazione.

Decisione formalizzata in [ADR-0001](adr/0001-tech-stack.md).

## 3. Principi architetturali

1. **La simulazione è separata dall'interfaccia.** I pacchetti `core`, `sim`, `game` non importano React né API del browser.
2. **Il giocatore e l'IA usano gli stessi comandi.** Ogni azione è un `Command` validato dal motore (`SignContract`, `StartRnDProject`, `SetPitBoard`…). La UI può mostrare solo i comandi che il motore dichiara disponibili, così non esistono pulsanti finti.
3. **Determinismo.** Tutta la casualità passa da un PRNG con seme (`sfc32`), diviso in flussi per sottosistema (meteo, gara, mercato…). Con lo stesso seme e gli stessi comandi si ottiene lo stesso risultato: replay, riproduzione dei bug e test affidabili. Non esistono risultati prestabiliti.
4. **Stato normalizzato.** Lo stato di gioco è un database relazionale in memoria (tabelle `Record<Id, Entity>` con chiavi esterne), serializzabile e versionato.
5. **Eventi di dominio.** I sistemi emettono eventi (`RaceFinished`, `ContractSigned`, `ComponentFailed`…) consumati da notizie, statistiche, morale, archivio e sponsor. In questo modo i sistemi restano disaccoppiati.
6. **Sistemi piccoli e testabili.** Ogni sistema è un modulo con input/output espliciti: `(state, ctx) => events`. Niente classi "God object".
7. **Dati di contenuto separati dal codice.** Circuiti, costruttori, nomi, sponsor e regolamenti sono *content pack* JSON validati da script, quindi modificabili e moddabili.
8. **Conoscenza separata dalla verità.** Lo stato reale (problemi di assetto, potenziale, meteo futuro) resta nel motore; UI e IA gestionale leggono solo osservazioni, sensazioni e ipotesi tramite `KnowledgeView(teamId)` ([ADR-0003](adr/0003-knowledge-model.md)).
9. **Formule documentate.** Ogni formula di simulazione ha un riferimento in [SIMULATION.md](SIMULATION.md) e un test che ne fissa il comportamento.

## 4. Architettura a livelli

```
┌───────────────────────────────────────────────────────────────────┐
│ apps/desktop (Tauri)   – finestra, filesystem, salvataggi su disco │
├───────────────────────────────────────────────────────────────────┤
│ apps/client (React)    – design system, schermate, renderer 2D     │
│        │  comandi ▼            ▲ snapshot / query / eventi          │
├────────┼──────────────────────┼───────────────────────────────────┤
│ packages/engine-host   – Web Worker, RPC tipizzato, loop temporale │
├───────────────────────────────────────────────────────────────────┤
│ packages/game   – carriera, calendario, economia, mercato, staff,  │
│                   R&D, strutture, sponsor, media, IA, regolamenti  │
│ packages/sim    – weekend, sessioni, gara, gomme, meteo, setup,    │
│                   telemetria, incidenti (motore deterministico)    │
│ packages/data   – schema entità, generatore del mondo, content pack│
│ packages/persistence – serializzazione, migrazioni, adapter storage│
├───────────────────────────────────────────────────────────────────┤
│ packages/core   – ID, PRNG, matematica, tempo di gioco, eventi,    │
│                   Result/Errori, utilità di validazione            │
└───────────────────────────────────────────────────────────────────┘
```

Regola delle dipendenze: un pacchetto può dipendere solo da quelli **sotto** di lui.
`sim` non dipende da `game`; `game` usa `sim` per far correre i weekend.
La regola è verificata in CI con un controllo dei confini degli import (ESLint `no-restricted-imports`).

### Flusso di un'azione

```
UI (click "Firma contratto")
  → engineClient.dispatch({ type: 'SignContract', … })      [main thread]
  → Worker: validate(command, state) → apply → events[]     [engine-host]
  → sistemi reattivi (morale, news, finanze) consumano eventi
  → Worker invia { stateVersion, changedTables, events }
  → UI aggiorna solo le viste interessate (selettori memoizzati)
```

### Flusso di una gara

```
sim.RaceSession(seed, grid, track, weather, strategies)
  step(dt) ×N  →  RaceFrame (ring buffer)  → RaceRenderer2D (interpolazione 60 fps)
               →  TelemetrySample[]        → grafici telemetria
               →  RaceEvent[]              → feed, regia, penalità, news
Velocità 1×/2×/4×/8×/16×: cambia quanti step il worker calcola per secondo reale.
Pausa: il worker sospende il loop; i comandi (pit board, mappa) restano accodabili.
```

## 5. Organizzazione delle cartelle

```
motorcycle-manager/
├── apps/
│   ├── client/                 # UI React (gira anche nel browser in sviluppo)
│   │   ├── src/
│   │   │   ├── design-system/  # token, tipografia, componenti base (Button, Table, Card, Chart…)
│   │   │   ├── layout/         # shell: sidebar, top bar, routing interno
│   │   │   ├── screens/        # una cartella per menu: overview/, team/, riders/, staff/, bike/,
│   │   │   │                   #   development/, facilities/, academy/, market/, sponsors/,
│   │   │   │                   #   finance/, calendar/, championship/, stats/, news/, archive/,
│   │   │   │                   #   main-menu/, new-career/, race-weekend/
│   │   │   ├── race-view/      # RaceRenderer2D (Canvas), camera 2D, overlay
│   │   │   ├── engine-client/  # proxy tipizzato verso il worker
│   │   │   └── i18n/           # it (default), en
│   │   └── tests/              # test componenti + e2e Playwright
│   └── desktop/                # Tauri: src-tauri/ (Rust minimale), configurazione bundle
├── packages/
│   ├── core/                   # rng/, ids/, math/, time/, events/, result/
│   ├── data/                   # schema/, worldgen/, content/ (JSON), validators/
│   ├── sim/                    # track/, bike/, rider/, tyres/, weather/, setup/,
│   │                           #   race/, quali/, practice/, telemetry/, incidents/
│   ├── game/                   # career/, calendar/, economy/, contracts/, market/, staff/,
│   │                           #   briefing/, garage/ (Moto A/B, lavori, prontezza), knowledge/,
│   │                           #   riders/, academy/, rnd/, facilities/, sponsors/, media/,
│   │                           #   regulations/, ai/, stats/, commands/
│   ├── engine-host/            # worker entry, scheduler, protocollo RPC
│   └── persistence/            # save format, migrazioni, adapter (IndexedDB, Tauri FS)
├── tools/
│   ├── balance/                # simulazioni headless di massa (es. 1000 stagioni) e report
│   ├── content-check/          # validazione content pack e controllo nomi reali
│   └── sim-cli/                # esegue una gara da terminale (debug, regressioni)
├── docs/                       # GDD, architettura, modello dati, roadmap, UI, ADR, mockup
├── .github/workflows/          # CI: lint, typecheck, test, build
├── package.json                # workspace npm
└── tsconfig.base.json
```

## 6. Dipendenze previste (minime)

| Ambito | Libreria | Motivo |
|---|---|---|
| UI | `react`, `react-dom` | framework UI |
| Build | `vite`, `typescript` | bundling e tipi |
| Test | `vitest`, `@playwright/test` (già nell'ambiente) | unit/integration ed e2e |
| Qualità | `eslint`, `prettier` | stile e confini dei pacchetti |
| Desktop | `@tauri-apps/cli`, `@tauri-apps/api` | shell desktop e filesystem |
| Salvataggi | `fflate` (~8 KB) | compressione salvataggi |

Volutamente **non** previsti: state manager esterni (usiamo `useSyncExternalStore` sul client
del motore), librerie di grafici (i grafici di telemetria sono componenti SVG/Canvas interni,
ottimizzati per i nostri dati), ORM o database server. Ogni nuova dipendenza richiede un ADR.

## 7. Persistenza e "database"

Il "database" del gioco ha tre livelli:

1. **Content database** (`packages/data/src/content`): dati di partenza originali (costruttori,
   circuiti, squadre, sponsor, nomi per nazionalità, regolamenti iniziali, personaggi scritti a mano),
   come moduli TypeScript tipizzati e verificati dai test (`content.test.ts`); un formato JSON per i mod
   potrà essere aggiunto in seguito.
2. **Game state**: database relazionale in memoria, generato dal content database con un seme
   e poi fatto evolvere dalla simulazione (vedi [DATA_MODEL.md](DATA_MODEL.md)).
3. **Salvataggi**: per ogni slot una cartella con
   - `meta.json` (nome carriera, squadra, data di gioco, versione schema, anteprima);
   - `state.json.gz` (stato corrente compresso);
   - `archive/season-YYYY.json.gz` (storico delle stagioni concluse, caricato su richiesta).

   Salvataggio manuale, autosalvataggio (inizio weekend, fine gara, fine stagione) a rotazione
   e slot multipli. Ogni salvataggio contiene `schemaVersion`; i caricamenti passano dalle
   **migrazioni** in `persistence/migrations`.

SQLite è stato valutato e rimandato: lo stato deve comunque vivere interamente in memoria per
essere simulato, e la mappatura oggetti/tabelle aggiungerebbe complessità. Se l'archivio
pluriennale superasse dimensioni gestibili (>50 MB per carriera), si introdurrà SQLite solo per
l'archivio statistico (vedi [ADR-0002](adr/0002-state-and-persistence.md)).

## 8. Qualità e processo

- **TypeScript `strict`**, nessun `any` implicito.
- **Test**: unit per formule e sistemi; property test per invarianti (es. somma punti = punti
  assegnati, bilancio = somma transazioni); **golden test** di gara (seme fisso → classifica
  attesa) per intercettare regressioni; **test statistici** di bilanciamento in `tools/balance`.
- **CI GitHub Actions**: lint, typecheck, test, build per ogni PR.
- **Branch**: un branch per milestone, PR verso `main`, nessun merge senza approvazione.
- **Feature flag**: le voci di menu dei sistemi non ancora sviluppati sono nascoste o mostrate
  come "In sviluppo" e disabilitate, mai finte.
- **Prestazioni**: obiettivo di 16× in gara con 34 moto a < 4 ms per frame nel worker;
  avanzamento di una giornata di gioco < 50 ms.
- **Scala UI**: layout in `rem` con scala radice legata alla risoluzione (1080p = 100%,
  1440p = 125%, 4K = 200%), testato con screenshot Playwright.

---

## Stato effettivo (2 novembre 2026)

### Simulazione
- `packages/sim/src/race.ts`: `RaceSim`, gara a passi di 0,25 s con stato serializzabile (snapshot/ripresa),
  strategie in corsa (ritmo, carburante, gomme) per giocatore e IA → fotogrammi, eventi, risultati. `runRace` la
  porta a termine in un colpo. Qualifiche/prove: `runQualifying` (solo giro migliore). Deterministica dal seme.
- `packages/game/src/weekend.ts`: traduce piloti/moto/assetti in parametri (`toRaceRider`), prepara e chiude le
  sessioni (`prepareRace` / `finalizeRace`), salva risultati, notizie, forma e morale, aggiunge i chilometri al
  garage. Gara in diretta: `startLiveRace` / `completeLiveRace`, gestite da `GameEngine` (`liveAdvance`,
  `state.liveSession`). Dettagli: `docs/SIMULAZIONE-INCREMENTALE.md`.

### Renderer
- `apps/client/src/race/raceState.ts → raceFrame(t)`: unica funzione di stato per un istante (classifica,
  posizioni, bandiere, cadute, battaglie). Il 2D (`circuitScene.ts`, canvas) e il 3D (`Race3D.tsx` + `bikeModel.ts`,
  Three.js caricato su richiesta) disegnano lo stesso risultato. Tempo, velocità e pausa vivono nel visore.

### Garage e usura
- Modello fisico: 14 componenti per moto (`content/garage.ts`), chilometri per sessione (prove divise fra moto A e
  B), usura = km / vita; affidabilità del pezzo piena fino a metà vita, poi in calo; la moto in gara usa
  affidabilità base × prodotto dei componenti^0,2.
- Vista giocatore: gruppi tecnici per categoria (`TECH_GROUPS`), stato del gruppo (`groupStatus`), manutenzione
  `garageMode` auto/assistita/manuale (`crewChiefMaintenance`), ricambi (`spares`), decisioni importanti
  (`pendingDecisions`). Upgrade consegnati → pezzi nuovi (`fitNewParts`).
- Assetto: `packages/game/src/setup.ts` (per pilota, asciutto/bagnato, ideale nascosto da attributi e circuito).

### Salvataggi
- `GameState` normalizzato, schema 5. Campi opzionali aggiunti senza migrazione: `garageMode`, `spares`, `setups`,
  `Bike.parts`. La sessione in corso non è ancora salvata (Milestone B: `liveSession`).

### Asset
- Vedi `docs/ASSETS_E_LICENZE.md`. Ritratti in atlanti (`assets/atlas/index.json` chiave → foglio/colonna/riga).

### Test
- Vitest: `packages/*/src/**/*.test.ts` e `apps/client/src/**/*.test.ts` (137). Playwright: `tools/e2e/smoke.cjs`
  (carriera completa, 2D/3D, garage, salvataggio).
