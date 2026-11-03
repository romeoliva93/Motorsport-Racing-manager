# LEAN ANGLE — Report di stato

*3 novembre 2026 · ramo `m2/pulizia-garage-simulazione` · **non unito a `main`** (serve la tua autorizzazione).*

## Verifiche finali
| Controllo | Esito |
|---|---|
| Typecheck (tutti i pacchetti + client) | 0 errori |
| ESLint | 0 problemi |
| Vitest | **161 test verdi** (26 file) |
| Build di produzione | ok |
| Playwright (carriera completa) | **E2E OK**: home, garage, prove con riunione tecnica, Sprint in diretta, cambio 2D↔3D, strategia in gara, salvataggio a metà gara e ripresa, gara, classifiche, salvataggio/caricamento, squadra nuova |
| Salvataggi | migrazioni 1→6 testate; salvataggio a metà gara = risultati identici |
| Asset | atlanti = roster (test), 41 foto moto = 41 squadre (test), nessun ritratto duplicato (controllo percettivo) |

## Funzioni completate
- **Pulizia del repository** (Fase 1): vedi sotto.
- **Garage definitivo** (Fase 2): moto della squadra al centro, schede essenziali (livello, prestazione, usura,
  stato, upgrade), schema tecnico con la zona del gruppo selezionato illuminata, numero e nome come grafica
  sovrapposta. Vecchio garage e selettore rimossi.
- **Foto**: 41 moto rifatte partendo dal disegno della livrea (niente scritte sulle carene); motore e telaio isolati;
  2 nuovi piloti Moto2 con ritratto originale.
- **Home a dashboard** (Fase 3): prossimo GP con meteo e caratteristiche, attività da fare, piloti (morale,
  posizione, ultimo risultato), moto, classifica o preparazione, finanze, notizie. Forma e morale aggiornati dopo
  ogni gara e con effetto in pista.
- **Simulazione incrementale** (Fase 4): Sprint e gara in diretta, ritmo a 5 livelli, carburante a 3 mappe, gomme
  a 3 gestioni, IA con le stesse leve, salvataggio e ripresa esatta a metà gara.
- **Prove e riunione tecnica** (Fase 5): programma per pilota (circuito / assetto / passo gara), confidenza col
  circuito e con la moto (±1% di ritmo, IA comprese), commenti del pilota più chiari con i giri, consiglio del
  capotecnico applicabile, 45 minuti di lavoro fra le sessioni, cronologia del weekend.
- **Griglia iniziale solo maschile**: Beatrice Galimberti → Elia Rinaldini (ITA, 19), Paula Urquiza → Gonzalo
  Llorente (ESP, 27). Stessi ID e dati; resto del mondo identico (verificato); migrazione dei salvataggi v5→v6.

## Problemi risolti
Scritte inventate sulle carene e sui freni · "telaio" e "motore" che mostravano moto intere · due garage e selettore
· CSS orfano (~600 righe) · gare precalcolate senza scelte in corsa · ripresa dopo il caricamento non allineata ·
assetto scollegato dalle prove · pilote nel roster iniziale contro la richiesta.

## Pulizia del repository
| | Prima | Dopo |
|---|---|---|
| File tracciati | 918 | 249 |
| Peso dei file | 51,3 MB | 6,0 MB |
| File eliminati | 680 (44,8 MB) | |

- **Eliminati**: 568 ritratti originali (il gioco usa i 4 atlanti), 67 immagini e 15 mockup in `docs/`, 14 foto moto
  per costruttore inutilizzate, 4 report intermedi e 4 documenti superati, cache Python.
- **Codice rimosso**: vecchio garage, `BikeTop`, `Bike.tsx`, anteprime, ~600 righe di CSS orfano.
- **Dipendenze**: nessuna rimossa o aggiunta (tutte in uso).
- **Mantenuti**: motore 3D (congelato), atlanti, foto moto, immagini dei gruppi, strumenti di generazione.
- **Dubbi**: nessun file eliminato in dubbio; la cronologia Git (171 MB) non è stata riscritta, come richiesto.
- Screenshot e archivi non sono nel repository (`test-results/` e `*.zip` in `.gitignore`); l'archivio storico è
  consegnato a parte.

## Ancora mancante / limiti noti
- Alcune divise dei ritratti e 2–3 carene hanno piccoli segni illeggibili (limite del generatore).
- Le divise dei ritratti hanno i colori della squadra al momento della generazione: dopo un trasferimento il colore
  non cambia.
- Prove: niente rientri ai box durante la sessione né scelta del numero di giri; la qualifica non ha ancora un
  programma.
- 3D congelato (modelli semplici, nessuna prova su GPU reale).
- Test ufficiali e privati, flag-to-flag, pressione gomme, wildcard, penalità in griglia, bandiera nera.

## Prossima milestone
**C2 — Prove a uscite**: uscite multiple per sessione con rientro ai box, giri scelti, gomme usate e nuove,
briefing a ogni rientro, programma anche in qualifica; poi **D — Sviluppo tecnico** (compromessi, R&D, moto della
stagione successiva).
