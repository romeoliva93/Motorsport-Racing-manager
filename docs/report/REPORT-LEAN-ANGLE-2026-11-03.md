# LEAN ANGLE — Moto Racing Manager · Report di avanzamento

*3 novembre 2026 · repository `romeoliva93/motorcycle-manager` · ramo `m1/piloti-bandiere-classifiche` (non unito a `main`)*

Questo report segue quello del 2 novembre e la revisione generale fatta sulla base della tua analisi. Le foto citate sono nella cartella `foto/`.

---

## 1. In sintesi

| Area | Stato |
|---|---|
| Garage semplificato a gruppi tecnici | **Fatto e verificato** |
| Garage "moto al centro" (stile manageriale, schede intorno) | **Prototipo funzionante, da approvare** |
| Moto realistiche nella livrea di ogni squadra | **Fatto** (41 foto) |
| Reskin completo dell'interfaccia ("Paddock Night") | **Fatto** |
| Ritratti dei piloti con età coerente | **Fatto** (36 rigenerati) |
| Assetto indipendente per pilota | **Prima versione fatta** |
| Ricambi e manutenzione delegata al capotecnico | **Prima versione fatta** |
| Vista 2D leggibile anche nei gruppi | **Fatto** |
| Simulazione incrementale (strategie in gara) | **Piano pronto, attende approvazione** |
| Prove e qualifiche simulate, briefing, confidenza | Non iniziato (dopo la simulazione incrementale) |
| Test ufficiali e privati | Non iniziato |
| 3D | Congelato (resta opzionale, nessun nuovo lavoro) |

**Verifiche**: 139 test automatici superati (erano 125), prova completa nel browser superata: carriera, gara in 2D e 3D, garage, ricambi, assetto, salvataggio e caricamento.

## 2. Cosa è cambiato

### 2.1 Reskin completo "Paddock Night" (foto 01–04, 08–12)
- Sfondo blu-nero con linee di velocità diagonali e un bagliore nel colore della squadra.
- Titoli condensati, corsivi e maiuscoli, in stile grafica TV del motorsport.
- Pannelli con angolo tagliato e filo arancio in alto; il pannello della squadra usa il colore della scuderia.
- Pulsanti, chip, schede e selettori a parallelogramma.
- Barra laterale nera con striscia del colore squadra; la voce attiva ha una barra arancio.
- Barra superiore con titolo grande e filo colorato (squadra → arancio).
- Tabelle con intestazioni piccole e spaziate, righe alternate, evidenziazione al passaggio del mouse.
- Il codice dei colori resta lo stesso: arancio = azioni, blu = informazioni, verde/giallo/rosso = stato.

### 2.2 Moto realistiche per squadra (foto 02, 05, 13)
- 41 foto, una per squadra di ogni categoria, nei colori reali della scuderia.
- Generate in locale e gratis. Per ogni squadra ci sono 2 varianti e ho scelto a mano la migliore, scartando quelle tagliate o con l'aspetto di moto stradali.
- La foto compare al centro del garage e nella card "La tua moto" della home. Accanto c'è una tabella con il numero e il nome del pilota, perché il generatore scrive numeri illeggibili.
- Le squadre create dal giocatore non hanno una foto: al suo posto c'è un'illustrazione originale nei loro colori.
- Un test verifica che ogni squadra abbia la sua foto e che il nome sia collegato al file giusto.

### 2.3 Garage
**Versione a gruppi tecnici**, che sostituisce le 14 righe di componenti:
- I gruppi per categoria sono 6 in Premier, 4 in Intermediate, 3 in Lightweight e 2 nella Rookies Cup.
- I 14 componenti fisici restano nel calcolo interno di usura e affidabilità.
- I valori sono distinti e spiegati: **condizione** (il pezzo più consumato), **usura media**, **affidabilità** (scende solo oltre metà vita), **vita residua** (chilometri e Gran Premi), **livello di sviluppo**.

**Prototipo "moto al centro"** (foto 05–07), sul modello organizzativo del riferimento manageriale ma con grafica originale:
- In alto: squadra, selettore del pilota, Moto A/B (solo in Premier), affidabilità, chilometri, stato tecnico.
- Al centro la moto della squadra; intorno le schede dei gruppi (foto 15) con immagine, livello, prestazione, usura, affidabilità, stato ed eventuale "aggiornamento disponibile".
- Sotto c'è il pannello di confronto fra il gruppo installato e il nuovo pacchetto, con livello, prestazione, condizione, affidabilità, vita residua e tempi di consegna.
- Le azioni sono tutte reali:
  - revisione (si paga subito);
  - sostituzione con un ricambio dal magazzino;
  - ordine di un ricambio;
  - ordine dell'aggiornamento in fabbrica. Alla consegna i pezzi montati sono nuovi.
- La manutenzione ha tre modalità:
  - **automatica**: il capotecnico revisiona da solo i pezzi ordinari oltre il 70%;
  - **assistita**: il capotecnico manda un avviso con il pulsante "Apri il garage sul componente";
  - **manuale**: decide tutto il manager.

  In tutte e tre le modalità telaio e forcellone restano sempre una decisione del manager.
- La scheda **Assetto** è separata dai componenti.
  - Ogni pilota ha il suo assetto, asciutto e bagnato, con le regolazioni consentite: 6 in Premier, 5 in Intermediate, 4 in Lightweight, 2 nella Rookies Cup.
  - Il pilota commenta a parole, in modo più o meno preciso secondo il suo feedback tecnico.
  - L'intesa fra assetto e pilota cambia davvero il ritmo in pista, fino a ±1,5%.
- La versione precedente del garage resta raggiungibile con un selettore finché il prototipo non viene approvato.

### 2.4 Ritratti (foto 03, 14)
- Ho controllato tutti i 135 piloti. Le età nei dati sono coerenti con le categorie: Rookies 13–16, Moto3 16–22, Moto2 18–29, MotoGP 20–36.
- I volti dei titolari fra 26 e 36 anni sembravano molto più vecchi della loro età, quindi ho rigenerato solo quei 36 ritratti.
- Lo staff non è stato toccato. I personaggi e le loro chiavi sono invariati, e un test verifica che nessun volto finisca sul personaggio sbagliato.

### 2.5 Vista 2D (foto 09)
- Etichette senza sovrapposizioni, in ordine di priorità: pilota selezionato, i propri piloti, i primi tre, poi i numeri degli altri se c'è spazio.
- Le moto non vengono mai spostate per far posto alle etichette.

## 3. Problemi aperti e limiti onesti
1. **Gare ancora precalcolate**: le strategie si scelgono solo prima del via. Il piano tecnico della simulazione incrementale è pronto (`docs/PIANO-SIMULAZIONE-INCREMENTALE.md`) e prevede:
   - ritmo a 5 livelli, 3 mappe carburante e 3 gestioni gomme;
   - squadre dell'IA che usano le stesse leve;
   - salvataggio a metà gara.

   Attende l'approvazione.
2. **Scritte inventate sulle carene**: le foto delle moto hanno scritte illeggibili. Non sono marchi reali, ma si notano.
3. **Immagini dei gruppi telaio e motore**: mostrano il pezzo in primo piano ma non isolato, perché il generatore veloce tende a disegnare la moto intera.
4. **3D**: i modelli restano semplici e le prestazioni sono state misurate solo su un server senza scheda grafica. È congelato.
5. **Roster**: ci sono 2 piloti donna in Moto2. L'indicazione "giovani uomini" le escluderebbe; non sono state modificate in attesa di una decisione.
6. **Assetto**: per ora si cambia solo dal garage. Giri di prova, tempi d'intervento e briefing arriveranno con le prove simulate.

## 4. Licenze delle immagini
- Modello usato: SDXL-Turbo, con la **Stability AI Community License** (versione del 5 luglio 2024).
- Uso commerciale gratuito sotto 1 milione di dollari di ricavi annui, con registrazione gratuita presso Stability AI.
- La proprietà delle immagini spetta a chi le genera, nei limiti della legge: in alcuni paesi le immagini generate dall'IA possono non essere protette dal diritto d'autore.
- Dettagli e inventario in `docs/ASSETS_E_LICENZE.md`.

## 5. Prossimi passi proposti
1. Approvazione del garage prototipo come schermata definitiva.
2. **Milestone B**: simulazione incrementale con strategie in gara, IA e salvataggio a metà sessione.
3. **Milestone C**: prove e qualifiche simulate, confidenza col circuito e con la moto, briefing brevi, tempi d'intervento.
4. **Milestone D–E**: upgrade con compromessi, centro ricerca e sviluppo, test ufficiali e privati.

## 6. Domande per la revisione
1. Il garage "moto al centro" è leggibile? Cosa toglieresti o aggiungeresti alle schede?
2. Il tema "Paddock Night" è coerente con un manageriale premium? Ci sono schermate che sembrano ancora vecchie?
3. Le foto delle moto per squadra vanno bene come rappresentazione ufficiale, nonostante le scritte inventate? Conviene invece un'illustrazione vettoriale curata a mano?
4. Per la simulazione incrementale: le leve proposte (5 ritmi, 3 mappe carburante, 3 gestioni gomme) sono il giusto livello di profondità?

## 7. Elenco foto

| File | Contenuto |
|---|---|
| 01-menu-principale.png | Menu principale con Impostazioni |
| 02-home-nuovo-tema.png | Home con il nuovo tema e la foto della moto della squadra |
| 03-scheda-pilota.png | Scheda pilota con foto e numero |
| 04-personale-tecnico.png | Personale tecnico |
| 05-garage-premier-componenti.png | Garage prototipo Premier: moto al centro, 6 schede, confronto |
| 06-garage-assetto-per-pilota.png | Scheda Assetto: regolazioni, commenti del pilota, intesa |
| 07-garage-moto3-semplificato.png | Garage Moto3: 3 schede, senza Moto A/B |
| 08-weekend-strategia.png | Weekend: gomme, meteo, griglia |
| 09-gara-2D.png | Gara in 2D con etichette senza sovrapposizioni |
| 10-gara-3D-stesso-istante.png | La stessa gara in 3D |
| 11-risultati.png | Risultati |
| 12-classifiche.png | Classifiche |
| 13-foto-moto-per-squadra-campione.jpg | Campione delle foto moto (2 varianti per squadra) |
| 14-ritratti-piloti-prima-dopo.jpg | 36 ritratti: prima (sinistra) e dopo (destra) |
| 15-immagini-gruppi-tecnici.jpg | Immagini dei 7 gruppi tecnici |
