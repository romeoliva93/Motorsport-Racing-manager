# Regolamenti delle categorie

> Stato: **PROPOSTA — revisione Fase 0**. Valori iniziali della stagione di partenza.
> Ogni valore è un campo di `Regulation` (vedi [DATA_MODEL.md](DATA_MODEL.md)) e può cambiare nelle
> stagioni successive tramite le decisioni della federazione IVF.

## 1. Quadro generale

| Parametro | Velocity Rookies Cup | Lightweight | Intermediate | Premier |
|---|---|---|---|---|
| Ruolo | giovanile monomarca | 1ª classe mondiale | 2ª classe mondiale | classe regina |
| Moto | Lysander R250 Rookies (monomarca) | 250 cc monocilindrico, costruttori | 800 cc tre cilindri, motore unico Orvane + telai | prototipi 1000 cc, costruttori |
| **Moto per pilota (`bikesPerRider`)** | **1** | **1** | **1** | **2 (Moto A e Moto B)** |
| Garage nell'interfaccia | moto unica | moto unica | moto unica | Garage A/B |
| Cambio moto in gara (`flagToFlag`) | no | no | no | sì |
| Gara con cambio meteo | bandiera rossa e ripartenza | bandiera rossa e ripartenza | bandiera rossa e ripartenza | flag-to-flag |
| Età pilota | 13–17 anni, max 2 stagioni | 16–28 anni (esordienti max 25) | ≥ 16 anni | ≥ 18 anni |
| Licenza richiesta | selezione Rookies | Lightweight | Intermediate | Premier |
| Libertà tecnica | solo assetto entro intervalli fissati, componenti sigillati | assetto, manutenzione, componenti omologati del costruttore | assetto, sospensioni e telaio; motore ed elettronica unici e sigillati | sviluppo completo entro limiti, concessioni |
| Motori per stagione (per pilota) | forniti e ruotati dall'organizzatore | 6 | sigillati, sostituiti dall'organizzatore | 7 (condivisi fra Moto A e B) |
| Squadre | gestita dall'organizzatore (piloti iscritti individualmente) | 14 squadre × 2 | 15 squadre × 2 | 11 squadre × 2 |
| Collaudatori | no | facoltativi | facoltativi | sì (squadre ufficiali; satelliti tramite accordo) |
| Test in stagione | 1 giornata collettiva pre-stagione | pre-stagione + 2 sessioni | pre-stagione + 2 sessioni | pre-stagione + sessioni ogni ~5 GP |

## 2. Moto per pilota e riserve

- `bikesPerRider` decide quante moto un pilota può usare in un weekend. **Valori iniziali: Rookies 1,
  Lightweight 1, Intermediate 1, Premier 2.**
- Nelle categorie con una moto, la squadra può tenere **parti di ricambio** (telaio di scorta, motore
  di dotazione) ma non una seconda moto pronta: dopo una caduta la moto va riparata o ricostruita nei
  tempi consentiti (`rebuildAllowedBetweenSessions`). Nella Rookies Cup le riparazioni sono a carico
  dell'organizzatore.
- Nei test valgono gli stessi limiti; la squadra può portare **moto da test** solo se il regolamento
  lo prevede (`testBikesPerTeam`: Premier 2 aggiuntive per i collaudatori, Lightweight/Intermediate 1, Rookies 0).
- L'interfaccia si adatta: se `bikesPerRider = 1` non compaiono pulsanti, colonne o sezioni della seconda moto.

## 3. Velocity Rookies Cup

- Monomarca: tutti i piloti usano la **Lysander R250 Rookies**, stesse specifiche, stesse gomme,
  stessa tuta (con nome, numero e bandiera del pilota).
- 24 piloti per stagione, **nuovi ingressi ogni anno** tramite la selezione autunnale: vi accedono i
  migliori dei campionati nazionali giovanili e delle Continental Talent Cups. Massimo 2 stagioni.
- Assetto regolabile solo entro intervalli fissi; il valore del pilota emerge più chiaramente
  (vetrina per gli scout).
- Il giocatore non gestisce una squadra Rookies: segue i piloti della propria **accademia** iscritti,
  ne riceve i risultati e può offrire contratti di accademia o junior.
- In caso di infortunio l'organizzatore può chiamare un **pilota di riserva** dalla lista della
  selezione; nessun obbligo di sostituzione.

**Esempio di storia — Fabrizio Vitellino (ITA)**: a 14 anni vince il campionato nazionale giovanile
italiano (fittizio), viene selezionato per la Rookies Cup, chiude la prima stagione 6° con una vittoria
e la seconda da campione; riceve offerte da due accademie e debutta in Lightweight a 16 anni.
Il generatore crea storie diverse per ogni talento (rivalità nelle serie giovanili, infortuni,
stagioni deludenti, promozioni anticipate), registrate nello storico carriera e nelle notizie.

## 4. Assenze per infortunio e sostituzioni

Parametri per categoria:

| Parametro | Rookies | Lightweight | Intermediate | Premier |
|---|---|---|---|---|
| Sostituzione consentita | solo riserva dell'organizzatore | sì | sì | sì |
| Posto vacante consentito (`vacancyAllowed`) | sì | sì | sì | sì |
| Penalità per posto vacante | nessuna | nessuna | nessuna | nessuna (valore iniziale) |
| Obbligo di partecipazione | — | — | — | accordo commerciale: quota partecipazione ridotta in proporzione ai GP senza pilota |
| Scadenza comunicazione pilota (`entryDeadline`) | — | giovedì 12:00 dell'evento | giovedì 12:00 | giovedì 12:00 |
| Requisiti del sostituto | lista riserve | licenza Lightweight, limiti d'età | licenza Intermediate | licenza Premier (o deroga per collaudatore con km di test sufficienti) |
| Punti | al pilota che corre; squadra/costruttore normalmente | idem | idem | idem |

- **Nessuna penalità viene applicata se non è prevista dal regolamento.** Le conseguenze del posto
  vacante sono quelle naturali (punti non ottenuti, sponsor, visibilità) più quelle contrattuali
  previste (es. quota di partecipazione Premier, clausole degli sponsor).
- La federazione può introdurre in futuro obblighi o penalità tramite il sistema di votazione.

## 5. Collaudatori e test

- I collaudatori hanno contratto con la squadra (o con il costruttore, nel caso dei satelliti che ne
  usufruiscono tramite l'accordo di fornitura).
- Possono sostituire un titolare se rispettano licenza ed età della categoria.
- Sessioni di test in stagione: Premier circa ogni 5 GP (calendario), Lightweight e Intermediate
  2 sessioni, Rookies nessuna. Numero di moto nei test secondo §2.

## 6. Coerenza fra categorie (verifiche automatiche previste)

Controlli da eseguire in `tools/content-check` e nei test del generatore del mondo:
- nessuna categoria con `bikesPerRider` diverso da 1 o 2;
- `flagToFlag = true` solo se `bikesPerRider = 2`;
- Garage A/B, confronto A/B e cambio moto disponibili solo se `bikesPerRider = 2`;
- ogni sostituto rispetta licenza ed età della categoria;
- nessun pilota iscritto contemporaneamente a due eventi nello stesso fine settimana;
- nessun contratto duplicato (titolare + sostituto sullo stesso posto nello stesso evento).


## Confronto con il regolamento MotoGP (novembre 2026)

Versione di gioco: regole semplificate ma con la stessa logica di quelle reali. Legenda: ✅ nel gioco · 🟡 parziale ·
❌ non ancora.

| Regola | Stato | Come funziona nel gioco |
|---|---|---|
| Formato del weekend (FP1, Prove, FP2, Q1/Q2, Sprint, Warm Up, Gara) | ✅ | MotoGP con Warm Up la domenica; Moto2/Moto3 senza FP2/Sprint/Warm Up; Rookies con qualifica unica |
| Accesso alla Q2 dalle Prove (10 MotoGP, 14 Moto2/Moto3) e promossi dalla Q1 (2/4) | ✅ | Griglia ufficiale = Q2 + resto della Q1 |
| Punti gara (25…1) e Sprint (12…1) | ✅ | Vittorie e podi solo dalla gara della domenica |
| Classifiche piloti, squadre, costruttori (miglior pilota per marca) | ✅ | |
| Miglior squadra e miglior pilota indipendente | ✅ | Squadre non ufficiali |
| Dotazione gomme per weekend, gomme da pioggia | ✅ | Un treno per sessione |
| Limiti della pista, Long Lap (singola e doppia), posizione persa all'ultimo giro | ✅ | Soglie 3 (Sprint) / 5 (gara) |
| Partenza anticipata | ✅ | Doppia Long Lap |
| Contatto / guida irresponsabile | ✅ | Long Lap |
| Bandiera gialla (divieto di sorpasso) | ✅ | 25 s nel tratto della caduta |
| Bandiera rossa, ripartenza, regola dei 2/3 | ✅ | Gara conclusa oltre i 2/3, altrimenti ripartenza da fermo con gomme nuove |
| Concessioni ai costruttori (fasce A–D) | ✅ | Costo e tempi degli upgrade, motori a stagione |
| Limite di motori a stagione, partenza dai box se superato | ✅ | 8 motori (10 in fascia D), durata 3 weekend |
| Meteo, gara bagnata | ✅ | Condizioni per sessione |
| Bandiera bianca e cambio moto (flag-to-flag) | ❌ | Richiede pioggia che cambia in gara e Moto A/B |
| Pressione minima delle gomme | ❌ | Richiede il modello della pressione |
| Giornate di test e collaudatori con concessioni | ❌ | Arriva con i test stagionali (M5) |
| Wildcard | ❌ | |
| Peso minimo pilota+moto, carburante | 🟡 | Il carburante incide sul tempo sul giro; niente limiti di serbatoio |
| Penalità in griglia (posizioni indietro) | ❌ | |
| Bandiera nera / nero-arancio | ❌ | Ritiri per guasto già simulati |
