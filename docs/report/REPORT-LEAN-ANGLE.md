# LEAN ANGLE — Report di stato aggiornato

*Aggiornato dopo la revisione del 2 novembre 2026 · ramo `m1/piloti-bandiere-classifiche` · non unito a `main`.*
*I report precedenti sono fuori dal repository operativo (archivio consegnato a parte; recuperabili dalla cronologia Git).*

Verifiche: **137 test automatici verdi**, prova Playwright della carriera verde (incluso cambio 2D/3D, garage,
ricambi, assetto, salvataggio/caricamento).

## Implementato e verificato
- Carriera, mercato piloti, sponsor con obiettivi, finanze, classifiche, notizie, salvataggi.
- Regolamento: formati weekend, Q1/Q2, punti, indipendenti, gomme, limiti pista, Long Lap, partenza anticipata,
  contatti, bandiere gialle/rosse, concessioni, motori a dotazione, meteo, Warm Up.
- Schermata gara: classifica, pannelli dei due piloti (gomma, carburante stimato, affidabilità), comandi.
- Stato di gara unico per 2D e 3D (`raceFrame`), cambio vista senza effetti sulla gara.
- 2D: zoom, spostamento, selezione pilota, battaglie, zone gialle, **etichette senza sovrapposizioni**.
- Usura fisica di 14 componenti per moto, moto A/B in MotoGP, affidabilità in gara legata all'usura.
- **Gruppi tecnici** per categoria (6 MotoGP, 4 Moto2, 3 Moto3, 2 Rookies) con condizione, usura, affidabilità,
  vita residua distinte e spiegate.
- **Manutenzione** automatica / assistita (avvisi con pulsante verso il garage) / manuale; telaio e forcellone
  sempre decisi dal manager.
- **Ricambi** per gruppo (acquisto, magazzino, sostituzione).
- Upgrade dalla fabbrica con tempi e costi; alla consegna i pezzi montati sono nuovi.
- **Assetto per pilota** (asciutto/bagnato), regolazioni consentite per categoria, commenti del pilota, effetto
  reale sul ritmo (±1,5%).
- Ritratti: 567, coerenti con età e ruolo (36 piloti adulti rigenerati), raccolti in 4 atlanti con test di
  associazione.

## Implementato ma da correggere / da validare
- **Garage prototipo** (moto dall'alto al centro + schede): da approvare prima di sostituire la versione attuale.
- Immagini dei gruppi "telaio" e "motore": mostrano il pezzo in primo piano ma non isolato (limite del generatore).
- Vista 3D: funzionante ma con modelli semplici; prestazioni misurate solo su macchina senza GPU.

## Parzialmente implementato
- Sviluppo tecnico: livelli 0–3 per reparto, tempi di fabbrica; mancano compromessi, R&D, moto futura.
- Strategie: scelte prima del via (ritmo 3 livelli, gomma); non modificabili in gara.

## Non implementato
- Simulazione incrementale, strategie in gara, salvataggio a metà sessione.
- Prove/qualifiche simulate con uscite, briefing, confidenza.
- Test ufficiali e privati; flag-to-flag, pressione gomme, wildcard, penalità in griglia, bandiera nera.

## Pianificato
- Milestone B–F (vedi [ROADMAP.md](../ROADMAP.md)); piano tecnico B in
  [PIANO-SIMULAZIONE-INCREMENTALE.md](../PIANO-SIMULAZIONE-INCREMENTALE.md).

## Bloccato / in attesa di decisione
- Milestone B: attende approvazione (modifica strutturale del motore di gara).
- Roster iniziale: 2 piloti donna in Moto2; la richiesta "giovani uomini" le escluderebbe → decisione dell'utente.
- 3D professionale: congelato finché non c'è un modello di moto approvato.
