# Master prompt operativo — analisi e roadmap

> Confronto fra il master prompt dell'utente (2 novembre 2026) e lo stato del codice sul branch
> `phase-1/foundations` (commit `50008be`, 104 test unitari + e2e verdi).
> Legenda: ✅ completo e giocabile · 🟡 parziale · ❌ mancante.

## Stato per sezione

| § | Richiesta | Stato | Cosa c'è oggi | Cosa manca |
|---|---|---|---|---|
| 2 | Schermata Piloti con switch fra titolari | ✅ M1 (foto: vedi §3) | Tabella piloti + scheda con attributi, staff assegnato, contratto | Selettore rapido con foto/numero/bandiera/valutazione, scheda a tab, risultati e storico, numero su placca invece che sul casco |
| 3 | Ritratti fotorealistici | ❌ | Caschi illustrati per scuderia; pipeline foto sul branch `assets/photoreal-pilot` (in pausa) | Uno strumento di generazione: nel container non c'è GPU e Hugging Face è bloccato → **serve una decisione dell'utente** |
| 4 | Bandiere a colori | ✅ M1 (Accademia/Rookies/Podio arriveranno con le rispettive schermate) | Solo codici (ITA, ESP…) e nomi dei paesi | Bandiere SVG (flag-icons, MIT) in tutte le schermate |
| 5 | Classifiche dinamiche | ✅ M1 | Punti, vittorie, podi per piloti/squadre/costruttori; Sprint conteggiata; aggiornamento dopo ogni sessione | Pole position, giri veloci, storico gara per gara per pilota, statistiche stagionali e di carriera, test anti-duplicazione e dopo il caricamento |
| 6 | Circuiti ricchi e animati, moto viste dall'alto | ✅ 2D (manca il prototipo 3D di valutazione) | Canvas 2D con nastro d'asfalto, traguardo, puntini colorati | Cordoli, tribune, box, pit lane, vie di fuga, vegetazione, meteo animato, sagome delle moto, settori; valutazione 3D |
| 7 | Prove libere interattive (uscite, giri, rientri, feedback, confidenza) | ❌ | FP a tempo istantanee con scelta gomma | Programma di prova, giri, confidenza pista/moto, feedback pilota, proposte di ingegnere e capotecnico, tempo e personale per le modifiche |
| 8 | Sessioni rapide (giri indicativi), interventi limitati dopo FP1 | 🟡 | Formato FP1/Practice/FP2/Q1/Q2 reale | Numero di giri configurabile, traffico e momento d'uscita in qualifica, limiti agli interventi |
| 9 | Gare 10/12/15 giri | 🟡 | 15/13/12/10 per categoria | Lunghezza per circuito (breve/standard/lunga) |
| 10 | Ritmo dinamico in gara (5 livelli), carburante (3 mappe), delega all'ingegnere | ❌ | Ritmo pre-gara a 3 livelli | Comandi durante la replica, 5 livelli, mappe carburante con autonomia, delega |
| 11 | Moto A/B solo in Premier | 🟡 | Schema dati con slot A/B e `bikesPerRider` | Garage A/B in Premier, nascosto nelle altre categorie |
| 12 | Test pre/metà/post stagione, 4 configurazioni | ❌ | — | Tutto |
| 13 | Costruttori e satellite, componenti condivisi | 🟡 | Tipi di squadra e penalità satellite sulla moto | Forniture, specifiche, componenti sperimentali, dati condivisi |
| 14 | R&D con ≥10 livelli e 15 componenti, compromessi | 🟡 | 7 componenti × 3 livelli, tempi di fabbrica, costo | 15 componenti, 10 livelli, progettazione→produzione→test, compromessi |
| 15 | Moto della stagione successiva | ❌ | — | Ripartizione budget/ingegneri fra moto attuale e futura |
| 16 | Strutture 1–10 migliorabili | 🟡 | Strutture con livello iniziale per tipo di squadra (sola lettura) | Ampliamenti con costi, tempi, manutenzione, effetti |
| 17 | Mercato del personale | ❌ | Staff generato con attributi e contratti (rinnovo automatico) | Ricerca, assunzione, formazione, sostituzione |
| 18 | Infortuni con scelta del sostituto | 🟡 | Schema dati e documento (INJURIES_AND_TESTERS.md) | Infortuni in sessione, recupero, scelta gara per gara |
| 19 | Velocity Rookies Cup | 🟡 | Campionato monomarca, nuovi rookie ogni anno, Fabrizio Vitellino nel mondo | Campionato nazionale d'origine, palmares, tuta/moto Lysander uniformi, verifiche |
| 20 | Progressione privato → ufficiale, nuovo costruttore | 🟡 | "Crea la tua squadra" privata/indipendente/satellite | Passaggi di livello, costruttore originale |
| 21 | IA con le stesse regole | 🟡 | IA su mercato, strategie gomme, upgrade mensili, sponsor no | Test, personale, strutture, cambi di costruttore |
| 22 | Test automatici estesi | 🟡 | 104 test unitari + e2e | Selezione piloti, carburante, ritmo, infortuni, carriere molto lunghe |

## Bug e incongruenze trovati durante l'analisi

- Il numero di gara è disegnato sul casco **e** affiancato nella scheda: va tolto dal casco (richiesta §2).
- La scheda pilota non mostra risultati né storico, pur avendo i dati delle sessioni salvati.
- Le classifiche non contano pole e giri veloci, anche se `qualifying` e `fastestLap` sono già registrati.
- La nazionalità è mostrata come testo; nelle tabelle a volte come sigla.

## Roadmap operativa

L'ordine segue quello richiesto, con una sola modifica dovuta alle dipendenze: le **bandiere** e le
**statistiche** di M1 servono a quasi tutte le schermate successive, quindi vengono prima di tutto.

| Milestone | Contenuto | Stato |
|---|---|---|
| **M1 — Correzioni fondamentali** | Switch piloti, scheda a tab, placca numero, casco senza numero, bandiere ovunque, pole/giri veloci/storico/statistiche, test su classifiche e salvataggi | ✅ **completata su `m1/piloti-bandiere-classifiche`** |
| M2 — Gameplay weekend | FP interattive con giri, confidenza, feedback e briefing; sessioni rapide; gare 10/12/15; ritmo dinamico a 5 livelli; carburante; delega | da fare |
| M3 — Circuiti | Renderer 2D ricco (cordoli, tribune, box, meteo, sagome moto, settori); prototipo 2.5D/3D di valutazione | da fare |
| M4 — R&D | 15 componenti × 10 livelli, progettazione/produzione/test, compromessi; strutture 1–10; moto futura | da fare |
| M5 — Test e costruttori | Test stagionali, 4 configurazioni Premier, forniture ai satellite, componenti sperimentali | da fare |
| M6 — Carriera | Mercato personale, infortuni e sostituti, accademia, Rookies Cup completa, progressione scuderie | da fare |
| M7 — Produzione grafica | Ritratti (dopo decisione sugli strumenti), livree, loghi, ottimizzazione | in attesa di decisione |

## Decisione richiesta all'utente — ritratti fotorealistici

Strumenti verificati nel container: nessuna GPU, `huggingface.co` bloccato dalla rete. Alternative:

1. **Servizio esterno a pagamento** (es. API di generazione immagini): serve una chiave API dell'utente,
   l'autorizzazione al dominio nella rete dell'ambiente e la conferma dei costi (≈ 170 personaggi iniziali +
   nuovi rookie ogni stagione).
2. **Generazione da parte dell'utente** con il proprio strumento (es. ChatGPT) seguendo i prompt già pronti in
   `docs/ART_PROMPTS.md`; il gioco importa le immagini con la pipeline del branch `assets/photoreal-pilot`.
3. **Ambiente con GPU** (computer dell'utente collegato) e modello locale gratuito.

## M1 — cosa è stato fatto

- **Piloti**: selettore con casco, numero, nome, bandiera, ruolo e valutazione di tutti i piloti sotto contratto
  (ricavati dai contratti, nessun nome nel codice); scheda con placca del numero nei colori della scuderia e sette
  schede (Panoramica, Attributi, Risultati, Contratto, Relazioni, Preferenze tecniche, Storico). Il garage A/B
  compare solo in Premier. Il numero non è più disegnato sul casco.
- **Bandiere**: componente `Flag` con gli SVG di flag-icons (MIT), mappa dai codici del gioco a ISO 3166-1, file
  caricati solo quando servono. Presenti in Piloti, Personale, Mercato, Classifiche, risultati di sessione, vista
  di gara, Calendario, Home, Scuderia, Nuova carriera.
- **Classifiche e statistiche**: pole (griglia ufficiale) e giri veloci (gara) in classifica; storico gara per
  gara e per stagione, totali di carriera e titoli (`packages/game/src/stats.ts`). Tutto è ricavato dai risultati
  salvati, quindi non ci sono contatori da duplicare e i valori sono identici dopo il caricamento.
- **Test**: `stats.test.ts` (somme di vittorie/pole/giri veloci = gare disputate, nessuna sessione duplicata,
  storico coerente con la classifica, round trip del salvataggio, selettore dai contratti); e2e con switch piloti.
- **Verifiche**: Fabrizio Vitellino (nato il 21/4/2010) corre in Moto3 con il Lupo Blu Junior Team nel 2027,
  coerente con la fascia d'età 16–23 della categoria.

## Ritratti — pipeline pronta (in attesa dell'accesso di rete)

- **Universo fisso**: ogni nuova carriera parte dagli stessi piloti, tecnici e squadre (`UNIVERSE_SEED`), mentre
  gare, meteo, mercato ed eventi dipendono dal seme della carriera. Serve perché ogni personaggio abbia la sua foto.
- **Chiave del ritratto**: nome, cognome e giorno di nascita (`portraitKey`), quindi il volto resta lo stesso
  anche se il personaggio cambia squadra. I personaggi nati in carriera usano un volto di riserva stabile
  (`poolPortraitKey`: 120 ragazzi con la tuta ufficiale Rookies, 60 giovani con polo neutra).
- **Strumenti** (`tools/portraits/`): `export.ts` crea l'elenco (135 piloti, 252 tecnici principali, 180 volti
  di riserva) con età, nazionalità, ruolo e colori della squadra; `generate.py` crea le foto con SDXL-Turbo
  (gratuito, gira senza scheda grafica, ~30–60 s a foto), riprende da dove si è fermato e dà sempre lo stesso
  volto alla stessa persona; `setup.sh` installa le librerie.
- **Nel gioco**: il componente `Portrait` mostra la foto se esiste, altrimenti il volto di riserva, altrimenti il
  casco. L'elenco dei file è noto alla compilazione (nessuna richiesta a vuoto).
- **Blocco**: la rete dell'ambiente cloud non consente `huggingface.co`, `cdn-lfs.huggingface.co`,
  `cas-bridge.xethub.hf.co` e `download.pytorch.org`. Vanno aggiunti fra i domini consentiti nelle impostazioni
  dell'ambiente (operazione gratuita, la può fare solo il proprietario dell'account).

## M3 (anticipata su richiesta) — autodromo 2D

`apps/client/src/race/circuitScene.ts` costruisce l'autodromo attorno al tracciato della simulazione: curve
dalla curvatura, cordoli rossi/bianchi, ghiaia all'esterno delle curve, erba, barriere (reti blu dove c'è la
ghiaia, guard-rail altrove), corsia box sul lato interno del rettilineo principale con ingresso/uscita, box delle
squadre nei loro colori, edificio box, paddock con camion, torre di controllo, griglia di partenza, traguardo a
scacchi, settori S1/S2/S3 della simulazione, postazioni dei commissari, tribune con pubblico animato, vialetti
dai parcheggi con gente che cammina, maxischermi con il leader, bandiere al vento, alberi/palme e ambiente per
paese (deserto, arido, verde, tropicale, costa con il mare), pioggia animata. Il traguardo di ogni circuito è
ora a metà del rettilineo più lungo (in `sim/track.ts`).
Vista di gara: moto viste dall'alto con colori della squadra e casco; prima del via uscita dai box, corsia box,
giro di ricognizione e schieramento nella casella di griglia della simulazione; moto cadute nella ghiaia;
bandiera a scacchi; telecamera "tutto il circuito / il mio pilota / il leader" (immagine dell'autodromo
disegnata una volta ad alta risoluzione e inquadrata a ogni fotogramma).
