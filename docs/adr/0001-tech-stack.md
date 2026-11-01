# ADR-0001 — Stack tecnologico

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto
Manageriale con UI molto densa di dati, simulazione deterministica come nucleo, distribuzione
su PC, costi contenuti, sviluppo in ambiente cloud senza editor grafici, futura vista 3D.

## Decisione
TypeScript in un monorepo a workspace npm; logica e simulazione in pacchetti puri eseguiti
in un Web Worker; interfaccia React + Vite; vista di gara Canvas 2D dietro l'interfaccia
`RaceRenderer`; contenitore desktop Tauri 2; test con Vitest e Playwright.

## Alternative considerate
- **Godot 4**: ottimo e gratuito, ma UI gestionali (tabelle, grafici, filtri) richiedono molto
  lavoro manuale; test e CI meno immediati senza editor.
- **Unity**: forte su 3D, ma licenze e dipendenza dall'editor; UI dati non superiore al web.
- **Unreal Engine**: sovradimensionato per un manageriale; UI gestionali onerose; royalty.
- **Electron** al posto di Tauri: più semplice, ma installer ~10 volte più pesanti e consumo di memoria maggiore.

## Conseguenze
- (+) Velocità di sviluppo della UI, test rapidi, CI semplice, costi nulli, pacchetti leggeri.
- (+) La simulazione è riutilizzabile (CLI, strumenti di bilanciamento, eventuali server).
- (−) 3D di alto livello più limitato: mitigato dal formato di replay neutrale (`RaceFrame`).
- (−) WebView diverse per sistema operativo: test e2e su Windows/macOS/Linux in CI prima dei rilasci.
