# Proposta grafica e UI

> Stato: **PROPOSTA**. I mockup in `docs/mockups/` sono pagine HTML statiche con **dati
> illustrativi** per valutare lo stile; non sono codice di gioco. Nel gioco ogni valore
> proverrà dallo stato simulato.

## 1. Direzione visiva

**"Pit wall notturno"**: superfici scure stratificate, accenti rosso→arancione usati solo per
ciò che conta (azione principale, selezione, dati della propria squadra), tipografia condensata
corsiva per titoli e numeri di gara, sans-serif leggibile per i dati.

| Elemento | Scelta |
|---|---|
| Sfondo | 4 livelli di grigio-blu molto scuro (`#08090c` → `#1c202b`) per dare profondità senza ombre pesanti |
| Accento | gradiente `#e5322d` → `#ff7a1a`; arancione per link e selezioni, rosso per allarmi/azioni critiche |
| Stati | verde `#2fbf71`, ambra `#ffb020`, rosso `#ff4d4f`, blu `#4aa3ff` (sempre accompagnati da testo o icona, mai solo colore) |
| Titoli e numeri | **Barlow Condensed** (SIL Open Font License), maiuscolo, spaziatura ampia |
| Testo e tabelle | **Inter** (SIL OFL) con cifre tabulari |
| Codice/telemetria | **JetBrains Mono** (SIL OFL) |
| Icone | set SVG proprio a tratto 1,5 px (nessun pacchetto icone esterno obbligatorio) |
| Animazioni | 150–250 ms, easing morbido; numeri che cambiano con transizione; nessuna animazione decorativa durante la gara |

I font saranno inclusi nel pacchetto del gioco (nessun caricamento da Internet).

Token completi: [`docs/mockups/tokens.css`](mockups/tokens.css) (diventeranno `apps/client/src/design-system/tokens.css`).

### Risoluzioni
Layout progettato su 1920×1080 in unità `rem`; la dimensione radice scala a 1440p e 4K
(fattore 1,25 / 2). Larghezza minima supportata 1280×720. Grafici in SVG/Canvas con
`devicePixelRatio` per nitidezza in 4K.

## 2. Menu principale

![Menu principale](images/main-menu.png)

- A sinistra: marchio, scheda **"Continua"** con anteprima dell'ultimo salvataggio (squadra,
  stagione, round, quando), voci del menu.
- A destra: un circuito del gioco disegnato dai **dati reali del tracciato** con moto
  animate (nel gioco: un replay a bassa velocità di una gara simulata in background).
- Voci: Continua carriera · Nuova carriera (Squadra esistente / Crea la tua squadra) ·
  Carica partita · Impostazioni · Esci. Funzioni non ancora pronte appaiono disabilitate
  con etichetta **"In sviluppo"**, mai come pulsanti attivi.
- Navigazione completa da tastiera e controller (frecce + Invio).

### Flusso "Nuova carriera"
1. Modalità (squadra esistente / crea squadra)
2. Categoria di partenza (Lightweight · Intermediate · Premier)
3. Scelta squadra con confronto: budget, moto, piloti, obiettivi della dirigenza, difficoltà stimata
   — oppure procedura guidata di creazione (identità → tipologia → costruttore → piloti → staff → sponsor → riepilogo)
4. Opzioni: nome carriera, seme del mondo (opzionale), difficoltà, autosalvataggio
5. Generazione del mondo con barra di avanzamento (simulazione delle stagioni storiche)

## 3. Dashboard (Panoramica)

![Dashboard](images/dashboard.png)

**Struttura della shell (comune a tutte le schermate)**

- **Sidebar** con le 16 voci richieste, raggruppate:
  *Squadra* (Panoramica, Scuderia, Piloti, Personale) · *Tecnica* (Moto, Sviluppo, Strutture) ·
  *Persone e affari* (Accademia, Mercato, Sponsor, Finanze) · *Competizione* (Calendario,
  Campionato, Statistiche) · *Mondo* (Notizie, Archivio). I badge numerici indicano azioni in sospeso.
- **Top bar**: titolo schermata, data di gioco, prossimo evento, saldo, posizione squadre,
  posta, e il pulsante primario **Continua** che avanza il tempo fino al prossimo evento o
  decisione obbligatoria (come nei manageriali sportivi).

**Widget della Panoramica**

| Widget | Contenuto | Fonte dati |
|---|---|---|
| Prossimo evento | mappa circuito, caratteristiche, previsioni meteo con incertezza, programma sessioni | `Round`, `Circuit`, `WeatherForecast` |
| Piloti | posizione, punti, valutazione, morale, contratto, ultimi 5 risultati, forma fisica, sintonia con la moto | `Rider`, `Standing`, `SessionResult` |
| Classifica | prime posizioni + riga della propria squadra evidenziata | `Standing` |
| Finanze | saldo, andamento cassa, previsione di fine stagione, entrate/uscite del mese | `Transaction`, `FinanceForecast` |
| Sviluppo e moto | progetti R&D attivi con fase e tempi, motori usati / limite, affidabilità | `RnDProject`, `Bike`, `Regulation` |
| Decisioni richieste | elementi della posta che bloccano l'avanzamento o hanno scadenza | `InboxItem` |
| Obiettivi | dirigenza, sponsor, costruttore con stato | `Objective` |
| Notizie | ultime notizie e rumors generati dagli eventi | `NewsItem` |

## 4. Weekend di gara — vista 2D

![Vista gara 2D](images/race-view.png)

- **Sinistra**: classifica live con distacchi, ultimo giro, mescola, guadagni/perdite di posizioni; i piloti della squadra sono evidenziati.
- **Centro**: mappa 2D dall'alto disegnata dal tracciato del circuito, settori, corsia box, moto numerate nei colori delle squadre, segnalazione di cadute; feed degli eventi prodotti dalla simulazione.
- **Destra**: un pannello per pilota (usura e temperatura gomme, carburante con margine all'arrivo, fatica e concentrazione) e i comandi consentiti dal regolamento: ritmo, mappa motore, **pit board** con anteprima del messaggio.
- **Barra inferiore**: pausa, 1×, 2×, 4×, 8×, 16×, avanzamento gara, giro più veloce.

## 5. Scheda pilota

![Scheda pilota](images/rider-profile.png)

Intestazione con numero, valutazione, **potenziale stimato come intervallo** (dipende dagli scout),
morale, forma, stipendio. Schede: Profilo, Risultati, Contratto, Assetto preferito, Telemetria, Storico.
Nel profilo: i 17 attributi con tendenza, andamento della stagione, contratto e clausole,
relazioni con staff/compagno/rivali, preferenze di assetto ricavate dal feedback, condizione fisica.

## 6. Squadra tecnica, Moto A/B e briefing (revisione Fase 0)

Schermate per i sistemi descritti in [TECH_TEAM.md](TECH_TEAM.md). Tutti i mockup sono in Full HD 1920×1080.

### 6.1 Garage Moto A / Moto B

![Garage Moto A/B](images/bikes-ab.png)

Per ogni pilota: stato delle due moto (prontezza, disponibilità, chilometraggio, usura, affidabilità,
danni, manutenzione, assetto), **confronto corretto** B rispetto ad A con l'incertezza e il dettaglio
delle correzioni (evoluzione pista, carburante, gomme, temperatura), componenti e assetto affiancati
con le differenze evidenziate, prestazioni per settore, piano dei lavori con le ore-meccanico
disponibili e vincoli del regolamento (motori condivisi, gomme, flag-to-flag).

### 6.2 Briefing tecnico

![Briefing tecnico](images/briefing.png)

- **Sinistra – pilota**: immagine, nome, soddisfazione, fiducia nella moto e nell'ingegnere, sensazioni riportate tra virgolette, problemi con gravità percepita, richieste personali.
- **Centro – analisi**: telemetria A vs B nel tratto critico, comportamento per area (indicatori osservati), tempi per settore corretti, gomme, condizioni della sessione, storico delle decisioni del weekend.
- **Destra – staff**: ingegnere di pista e capotecnico con competenze chiave, comprensione dello stile del pilota, storico diagnosi, ipotesi con **confidenza dichiarata**; programma della sessione successiva e previsioni meteo.
- **Basso – decisioni**: soluzioni A/B/C con vantaggi e svantaggi *possibili* (non garantiti) e pulsanti Accetta modifica, Chiedi approfondimento, Prova alternativa (Moto B), Parere capotecnico, Segui il pilota, Confronta, Mantieni configurazione, Concludi briefing. Tempo del briefing sempre visibile; delega al capotecnico.

### 6.3 Mercato ingegneri

![Mercato ingegneri](images/engineer-market.png)

Filtri (ruolo, specializzazione, età, stipendio, disponibilità, compatibilità con un pilota), tabella
con valutazione attuale e potenziale **stimati** dagli scout (intervalli e "?"), stipendio richiesto,
contratto, compatibilità stimata, avanzamento dello scouting; anteprima del profilo con attributi a
intervallo, note dello scout, rivali interessati; incarichi di scouting e movimenti del mercato.

### 6.4 Scheda ingegnere

![Scheda ingegnere](images/engineer-profile.png)

Attributi del ruolo con variazione stagionale, grafico **competenze vs reputazione** (cresce la
reputazione con i podi, le competenze con il lavoro), fonti di crescita, storico delle diagnosi
(corretta / parziale / sbagliata), personalità e ambizioni, formazione, rapporti con piloti e colleghi,
contratto e azioni (rinnova, bonus, formazione, sposta, promuovi, colloquio, licenzia).

### 6.5 Gestione capotecnici e ingegneri di pista

![Squadra tecnica](images/tech-staff.png)

Un "box" per pilota con capotecnico, ingegnere di pista, analista e meccanici; per ogni coppia
pilota-tecnico i sei valori del rapporto (fiducia, comunicazione, compatibilità, esperienza condivisa,
comprensione dello stile, soddisfazione). Segnalazione dei **conflitti** con le azioni del manager,
reparti specialistici con carico di lavoro, tecnici promuovibili dall'interno e **anteprima degli
effetti** di una riassegnazione prima della conferma.

## 7. Categorie, infortuni e sostituti (revisione Fase 0)

### 7.1 Garage per categoria

![Garage moto unica](images/garage-single.png)

La schermata Garage si adatta a `Regulation.bikesPerRider`:
- **Premier (2 moto)** → Garage A/B (§6.1).
- **Lightweight, Intermediate (1 moto)** → garage a moto unica: vista grafica della moto con livrea, numero
  e costruttore (laterale, frontale, posteriore, dall'alto; il 3D è previsto come funzione avanzata),
  stato tecnico, componenti con ciò che il regolamento consente (regolabile, omologato, sigillato),
  aggiornamenti del costruttore, assetto confrontato **fra sessioni** (prima/dopo una modifica), lavori, ricambi.
- **Velocity Rookies Cup** → versione ridotta: moto monomarca, solo assetto entro intervalli e stato tecnico.
Nessun pulsante, colonna o sezione dedicata alla seconda moto compare se il regolamento non la prevede.

### 7.2 Gestione infortunio

![Gestione infortunio](images/injury.png)

Ritratto del pilota con numero, tipo e gravità dell'infortunio, prognosi in giorni, rientro previsto,
valutazione dello staff medico; calendario con la **probabilità di assenza per ogni GP**; le tre opzioni
(collaudatore, sostituto, nessun pilota) con dettagli; tabella delle **conseguenze previste**
(sportive, economiche, regolamentari, squadra) per confrontarle prima di decidere; decisione **per evento**
con le scadenze d'iscrizione.

### 7.3 Scelta del sostituto

![Scelta del sostituto](images/substitute.png)

Candidati da tutte le fonti (senza contratto, ex titolari, categorie inferiori, accademia, prestiti) con
ritratto, velocità, esperienza, adattamento alla moto, forma fisica, compatibilità con lo staff,
disponibilità, costo e idoneità regolamentare; confronto diretto fra due candidati; parere dello staff;
costruttore del **contratto temporaneo** (1 GP, più GP, fino al rientro; compenso, bonus, clausole).

## 8. Ritratti dei personaggi e immagini delle moto

Ogni pilota e membro dello staff ha un **ritratto fotografico realistico**; ogni moto ha una
**foto/render realistico** con la livrea della squadra. Il sistema separa tre livelli (vedi [ADR-0004](adr/0004-portraits.md)):
1. **Identità** — dati fissi del personaggio (aspetto descritto: età, capelli, carnagione, tratti), invariati per tutta la carriera.
2. **Ritratto** — fotografia associata al personaggio (`assets/portraits/<id>.jpg`).
3. **Abbigliamento** — tuta (piloti) o polo (staff) nei colori della squadra: quando il personaggio cambia
   squadra si usa la variante con i nuovi colori, il volto resta lo stesso.

Finché una foto non è disponibile l'interfaccia mostra un **segnaposto fotografico neutro** (sagoma con i
colori della squadra e la scritta FOTO), mai un disegno. Le istruzioni per generare le immagini sono in
[ART_PROMPTS.md](ART_PROMPTS.md).

Dimensioni per contesto: **XL** intestazione scheda pilota/infortunio (≈ 10 rem), **L** briefing e confronti
(≈ 6–7 rem), **M** card della dashboard e squadra tecnica (≈ 4 rem), **S** tabelle di mercato (≈ 2,4 rem),
**XS** classifiche e notizie (≈ 1,6 rem, facoltativo per non ridurre la leggibilità).

> Nota sulla revisione: i ritratti illustrati generati dal codice sono stati scartati perché non abbastanza
> realistici. In questo ambiente non è disponibile un generatore di immagini fotorealistiche: le foto si
> generano con **ChatGPT** seguendo ART_PROMPTS.md; le immagini vengono poi passate a Claude, che le integra
> nei mockup e nel report (procedura in ART_PROMPTS.md §0).

## 9. Altre schermate chiave (linee guida)

- **Tabelle**: intestazioni fisse, ordinamento, filtri salvabili, colonne configurabili,
  virtualizzazione oltre 100 righe, confronto di due righe.
- **Schede persona**: intestazione con numero/ruolo, attributi a barre con valore e tendenza
  (▲▼), storico, contratto, relazioni.
- **Weekend di gara**: layout a tre colonne — cronometraggio a sinistra, mappa 2D al centro,
  controlli piloti e telemetria a destra; barra delle velocità (pausa, 1×, 2×, 4×, 8×, 16×) in basso.
- **Telemetria**: grafici a traccia sovrapposta per distanza (velocità, gas, freno, piega),
  delta-tempo, confronto pilota A/B, selettore giro.

## 10. Accessibilità
Contrasto minimo AA sul testo, stati mai indicati solo dal colore, dimensione testo regolabile,
modalità per daltonici sui colori di gomme e squadre, riduzione animazioni.
