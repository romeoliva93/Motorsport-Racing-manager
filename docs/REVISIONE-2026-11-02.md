# Revisione generale — 2 novembre 2026

Analisi fatta sul codice reale del ramo `m1/piloti-bandiere-classifiche` (non solo sul report). Stato di partenza
verificato: 125 test Vitest verdi, prova Playwright della carriera verde. Dopo gli interventi di questa revisione:
**137 test verdi** e prova Playwright verde.

| # | Problema | Evidenza (report / codice) | Priorità | Soluzione | Complessità | Rischi | Test |
|---|---|---|---|---|---|---|---|
| 1 | Gara calcolata tutta prima del via: le strategie non si cambiano in corsa | `packages/sim/src/race.ts → simulateRace()` produce tutti i fotogrammi; `weekend.ts → raceSession()` salva il risultato prima della visione | **Alta** | Simulazione incrementale a passi fissi con stato serializzabile (piano in `PIANO-SIMULAZIONE-INCREMENTALE.md`) | Alta | Rottura del determinismo, prestazioni, salvataggi vecchi | determinismo a parità di comandi, cambio ritmo/carburante, salvataggio a metà gara, compatibilità salvataggi |
| 2 | Prove e qualifiche senza simulazione visiva | `timedSession()` usa `runQualifying()` (solo giro migliore) | Alta | Stesso motore incrementale anche per le sessioni a tempo, con uscite/rientri ai box | Alta | Durata delle sessioni, noia | sessioni con giri scelti, rientri, confidenza |
| 3 | Garage con 14 componenti da gestire a mano | screenshot 10, `BikeScreen.tsx` | Alta | **Fatto**: gruppi tecnici per categoria (6/4/3/2), componenti interni invariati, manutenzione automatica/assistita/manuale | Media | — | `garage.test.ts` (gruppi, capotecnico, modalità) |
| 4 | Valori contraddittori (affidabilità 100% con usura 53%) | screenshot 10: la colonna era affidabilità, scende solo oltre metà vita | Media | **Fatto**: condizione, usura media, affidabilità, vita residua separate e spiegate | Bassa | — | `groupStatus` coerente |
| 5 | Moto centrale troppo semplice + foto esterna | screenshot 10–11 | Alta | **Fatto (prototipo)**: moto dall'alto nella livrea della squadra al centro, schede dei gruppi intorno; foto rimossa | Media | gusto grafico da validare | e2e: niente `.bike-photo`, 6 schede |
| 6 | Volti dei piloti adulti troppo vecchi | foto 13; audit 135 piloti | Media | **Fatto**: 36 piloti titolari ≥ 26 anni rigenerati con età apparente corretta; chiavi invariate | Bassa | volto diverso da quello visto prima | `portraitAtlas.test.ts` (nessuna casella sbagliata) |
| 7 | 2 foto moto con frontale stradale | report §6.7 | Bassa | **Fatto**: rigenerate (variante da pista); foto tolte dalle schermate operative | Bassa | — | e2e |
| 8 | 2D affollato nei gruppi | screenshot 06 | Media | **Fatto**: etichette con priorità e senza sovrapposizioni, linea guida se spostate; moto mai spostate | Media | — | e2e + screenshot |
| 9 | 3D con moto "giocattolo" | screenshot 08–09 | Bassa (dopo il gameplay) | Congelato: resta opzionale, nessun nuovo lavoro finché non c'è un modello approvato (Milestone F) | Alta | tempo sottratto al gameplay | — |
| 10 | Assetti uguali per i due piloti | assente nel codice | Alta | **Fatto (prima versione)**: assetto per pilota, asciutto/bagnato, regolazioni per categoria, effetto ±1,5% sul ritmo, commenti del pilota | Media | bilanciamento | `setup.test.ts` |
| 11 | Ricambi inesistenti | assente | Media | **Fatto (prima versione)**: ricambi per gruppo, acquisto e sostituzione | Bassa | economia | `setup.test.ts` |
| 12 | Upgrade sempre positivi | `upgrades.ts` | Media | Milestone D: compromessi (peso/affidabilità/consumo), progetti R&D | Media | bilanciamento | da scrivere |
| 13 | Salvataggio a metà sessione | report §6.4 | Alta | Con la simulazione incrementale: stato completo della sessione nel salvataggio | Media | dimensione salvataggi | da scrivere |
| 14 | Test ufficiali/privati assenti | — | Media | Milestone E | Alta | calendario | da scrivere |
| 15 | Regolamento incompleto (flag-to-flag, pressione gomme, wildcard, penalità griglia, bandiera nera) | `docs/REGULATIONS.md` | Media | Dopo la simulazione incrementale (flag-to-flag e pressioni richiedono passi di gara) | Media | regole contraddittorie | per regola |
| 16 | Licenza delle immagini generate da verificare | report §4.6 | Media | **Fatto**: verificata e documentata in `ASSETS_E_LICENZE.md` | Bassa | uso commerciale futuro | — |
| 17 | Due piloti donna nel roster iniziale (Moto2) | dati del mondo fisso | — | **In attesa di decisione**: la richiesta "giovani uomini" le escluderebbe; non modificate | Bassa | cambiare il mondo fisso | — |
