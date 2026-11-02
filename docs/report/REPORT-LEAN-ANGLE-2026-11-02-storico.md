> **Copia storica** del report inviato il 2 novembre 2026 (prima della revisione). Lo stato aggiornato è in [REPORT-LEAN-ANGLE.md](REPORT-LEAN-ANGLE.md).

# LEAN ANGLE — Moto Racing Manager · Report di avanzamento

*Data: 2 novembre 2026 · Repository: `romeoliva93/motorcycle-manager` · Ramo di lavoro: `m1/piloti-bandiere-classifiche` (non ancora unito a `main`)*

Questo report riassume lo stato del gioco, cosa è stato fatto nelle ultime milestone, come è verificato e cosa resta aperto. Le foto citate sono nella cartella `foto/` allegata.

---

## 1. Cos'è il gioco

Gioco manageriale di motociclismo nel browser, in italiano. Il giocatore guida una squadra in un campionato con quattro categorie, tutte con nomi e marchi inventati:
- **Premier** (stile MotoGP)
- **Intermediate** (stile Moto2)
- **Lightweight** (stile Moto3)
- **Velocity Rookies Cup**: monomarca su Lysander R250

Le aree di gestione sono: piloti, staff, mercato, sponsor, sviluppo della moto, garage e finanze. Il weekend di gara ha prove, qualifiche, Sprint e gara.

Regole del progetto:
- tutto gratuito;
- nessun dato finto nelle schermate operative;
- nessun pulsante senza funzione;
- nessuna risorsa presa da giochi esistenti;
- lavoro su rami separati, senza unire a `main` senza autorizzazione.

## 2. Tecnologia

- **Linguaggio e struttura:** monorepo TypeScript, circa 20.000 righe.
  - `core`: generatore casuale deterministico, denaro, calendario.
  - `data`: schema dello stato di gioco, contenuti, generazione del mondo.
  - `sim`: motore di gara.
  - `game`: regole, weekend, economia, viste.
  - `persistence`: salvataggi.
  - `engine-host`: il motore gira in un worker.
- **Interfaccia:** React 19 e Vite 8. La vista 3D usa Three.js (licenza MIT) e si carica solo quando serve.
- **Qualità:** 125 test automatici (Vitest) e una prova completa nel browser (Playwright) che gioca un intero flusso di carriera e salva gli screenshot.
- **Mondo fisso:** gli stessi personaggi compaiono in ogni carriera. La carriera ha un suo seme casuale e le simulazioni sono riproducibili.

## 3. Funzionalità già presenti (sintesi)

- **Carriera:** scelta di una squadra esistente o creazione di una propria; calendario a 20 gare; più stagioni.
- **Piloti:**
  - scheda con tab (panoramica, attributi, risultati, contratto, relazioni, preferenze tecniche, storico);
  - foto realistica con il numero di gara accanto (foto 03).
- **Personale tecnico, mercato piloti con trattativa, sponsor con obiettivi stagionali, finanze mensili** (foto 02, 04).
- **Regolamento in stile MotoGP:**
  - formati del weekend per categoria, accesso a Q2, punti, classifica indipendenti;
  - allocazione gomme;
  - limiti della pista, Long Lap Penalty, partenze anticipate e contatti;
  - bandiere gialle e rosse con ripartenza;
  - concessioni da A a D;
  - motori a dotazione (8 o 10, 3 weekend di vita ciascuno);
  - Warm Up;
  - meteo per paese, con temperatura dell'aria e dell'asfalto.
- **Circuiti generati dalla geometria**, tra cui un circuito ispirato al Mugello e uno a Misano:
  - cordoli, ghiaia, erba, corsia box e garage;
  - tribune con pubblico, motorhome, vialetti;
  - anello della Long Lap.

## 4. Lavoro delle ultime milestone

### 4.1 Schermata gara ridisegnata (foto 06 e 07)
- **A sinistra:** classifica live con posizione, colore della squadra, numero, bandiera, pilota, squadra, gomma (S, M, H, W), distacco e ultimo giro.
- **Al centro:** il circuito in 2D o in 3D.
- **A destra:** i due piloti del giocatore, ciascuno con:
  - foto, numero e posizione;
  - gomma rimasta e usura;
  - carburante (stimato da avanzamento e serbatoio);
  - affidabilità della moto;
  - ritmo, ultimo e miglior giro.
- **In basso:** giro attuale su totale, pausa e velocità da 1× a 16×, scelta della vista, telecamere, eventi e messaggi della Direzione Gara.
- **Colori:** arancione per le azioni, blu per le informazioni, verde per il positivo, giallo per l'attenzione, rosso per il pericolo.

### 4.2 Un'unica simulazione, due modi di vederla
- Il motore calcola la gara una volta sola. Una funzione pura (`raceFrame(t)`) restituisce, per ogni istante, classifica, posizioni, giro, bandiere, cadute, battaglie e meteo.
- La vista 2D e la vista 3D disegnano lo stesso risultato. Pannelli e classifica sono condivisi.
- Passare da una vista all'altra non riavvia e non altera nulla: restano uguali tempo, pausa e velocità.

### 4.3 Vista 2D strategica
- Moto viste dall'alto nei colori della squadra, orientate nel verso di marcia, ciascuna con il numero.
- Pilota selezionabile con un clic sulla moto o sulla classifica: viene evidenziato e seguito dalla telecamera.
- Battaglie (piloti a meno di 0,6 s) evidenziate; tratto di pista in bandiera gialla colorato.
- Zoom con la rotella, spostamento trascinando, pulsante "Vista completa".

### 4.4 Vista 3D immersiva (foto 07, 08, 09)
- **Moto per categoria** (riferimento artistico: l'infografica delle quattro moto del campionato):
  - Premier con alette aerodinamiche;
  - Intermediate;
  - Lightweight più compatta;
  - Rookies.

  Ognuna ha carena sagomata a sezioni, cupolino, ruote con dischi e pinze, forcella, forcellone, scarico e numero sul muso e sul codone.
- **Piloti:** casco con visiera, tuta in due colori, guanti e stivali. Piegano in curva fino a circa 50° e si spostano verso l'interno.
- **Ambiente:**
  - asfalto con grana, lucido sul bagnato; erba e ghiaia con texture;
  - pannelli pubblicitari originali;
  - pubblico che esulta (battaglie, ultimo giro, arrivo);
  - commissari con bandiere gialle e rosse;
  - pioggia e spruzzi.
- **Sei telecamere:** Regia automatica, TV, Inseguimento, Bordo pista, Box, Panoramica.
- **Prestazioni:**
  - moto semplificate da lontano (LOD);
  - parti con lo stesso materiale fuse insieme, per disegnare con meno passaggi;
  - qualità Bassa, Media e Alta;
  - liberazione completa della memoria alla chiusura.
- **Ripieghi:** senza WebGL il 3D è disattivato e la gara resta in 2D. Se il 3D si guasta, si torna al 2D senza fermare la gara.

### 4.5 Garage con 14 componenti (foto 10 e 11)
- Moto al centro con 14 componenti intorno: motore, cambio, frizione, catena, radiatori, scarico, telaio, forcellone, forcella, ammortizzatore, freno anteriore, freno posteriore, centralina, carena.
- Per ogni componente: usura, affidabilità, chilometri sulla vita prevista, revisioni fatte e livello di sviluppo.
- Moto A e B solo in Premier: le prove si dividono fra le due moto, qualifiche e gare si corrono sulla A.
- **Collegato alla simulazione:** oltre metà vita l'affidabilità del pezzo cala, e con essa quella della moto in gara (più guasti).
- La revisione si paga alla voce "Riparazioni". Le squadre controllate dal computer revisionano da sole.
- In Premier il motore segue la dotazione del regolamento.
- Lo sviluppo in fabbrica (7 reparti, livelli da 0 a 3) ha tempi di consegna che dipendono dai reparti e dalle concessioni.

### 4.6 Immagini generate (gratis, in locale)
- **567 ritratti realistici** di piloti, staff, vivaio e Rookies Cup, con divise nei colori della squadra (foto 13).
  - Modello: SDXL-Turbo, licenza Stability AI Community, gratuita sotto 1 milione di dollari di ricavi.
  - Generati sulla CPU del server, circa 10 secondi l'uno.
  - Raccolti in 4 "atlanti" (fogli unici) per caricarli più in fretta.
- **13 foto di moto**, una per costruttore e categoria (foto 14).
- Nota: il modello a volte disegna piccoli loghi inventati sulle divise. Se uno ricorda un marchio reale, si rigenera quella sola immagine.

### 4.7 Impostazioni
Nel menu principale si sceglie la vista di gara preferita (2D o 3D) e la qualità 3D. Le scelte vengono salvate nel browser.

## 5. Verifiche

- **125 test automatici superati.** Fra questi:
  - la funzione di stato di gara è pura: lo stesso istante dà le stesse posizioni;
  - selezione e vista non cambiano la classifica;
  - il giro non torna mai indietro;
  - all'arrivo la classifica a schermo coincide con il risultato ufficiale. Questo test ha trovato un errore di ordinamento all'arrivo, poi corretto.
- **Prova completa nel browser superata**, compresi i controlli sul cambio vista:
  - in pausa, dopo 2D → 3D → 2D, tempo, giro e classifica sono identici;
  - la velocità resta quella scelta e il tempo scorre in 3D;
  - 10 cambi consecutivi senza perdite (memoria JS 29 → 29 MB) e un solo contesto 3D attivo.
- **Prova senza WebGL:** la gara si apre in 2D e il pulsante 3D è disattivato.

**Prestazioni misurate** (stessa Sprint, 1920×1080, server cloud *senza scheda grafica*: il 3D è disegnato dal processore e i valori assoluti sono molto più bassi di un PC reale; conta il confronto):

| Vista | Fotogrammi/s | Caricamento |
|---|---|---|
| 2D | 60 | immediato |
| 3D bassa | 5,8 | 1,6 s |
| 3D media | 3,7 | 1,6 s |
| 3D alta (ombre) | 3,3 | 2,4 s |

## 6. Problemi aperti e prossimi passi

1. **Strategie durante la gara** (5 ritmi, 3 mappe carburante, gestione gomme, rientri ai box):
   - oggi la gara è calcolata tutta prima del via, quindi le strategie si scelgono solo prima della partenza;
   - servono per cambiarle mentre si corre: la simulazione deve avanzare a segmenti di giro;
   - è una modifica strutturale ed è in attesa di approvazione.
2. **Vista 2D/3D anche in prove libere e qualifiche:** oggi quelle sessioni producono solo il giro migliore. Bisogna far generare anche lì i fotogrammi.
3. **Realismo del 3D:** i modelli sono costruiti in codice. Molto meglio dei blocchi iniziali, ma non fotorealistici come l'infografica di riferimento. Servirebbero modelli 3D professionali (glTF): da valutare fonti gratuite con licenza libera, oppure asset a pagamento previa autorizzazione e preventivo.
4. **Salvataggio a metà gara:** il risultato è già salvato, ma la visione riparte dall'inizio.
5. **Test ufficiali e privati:** non esistono ancora nel gioco.
6. **Regolamento ancora mancante:** flag-to-flag, pressione gomme, wildcard, penalità in griglia, bandiera nera.
7. **Due foto moto da rigenerare** (Rookies, Moto3 Takaido): hanno un muso troppo "stradale".

## 7. Domande aperte per la revisione

- È meglio rendere la simulazione a segmenti per tutte le sessioni (prove, qualifiche, gara) oppure solo per Sprint e gara?
- Per il 3D realistico: quali fonti di modelli 3D gratuiti con licenza libera (CC0 o CC-BY) sono adatte a moto da corsa e piloti, senza marchi reali?
- Priorità consigliata fra: strategie in gara, 2D/3D in prove e qualifiche, modelli 3D realistici, test privati.

## 8. Elenco foto allegate

| File | Contenuto |
|---|---|
| 01-menu-principale.png | Menu principale con Impostazioni |
| 02-home-squadra.png | Home della squadra |
| 03-scheda-pilota.png | Scheda pilota con foto e numero accanto |
| 04-personale-tecnico.png | Staff con foto e competenze |
| 05-weekend-strategia.png | Weekend: gomme, meteo, griglia, consiglio dell'ingegnere |
| 06-gara-vista-2D.png | Gara in 2D: classifica, mappa, pannelli piloti |
| 07-gara-vista-3D-stesso-istante.png | La stessa gara in 3D, stessi dati |
| 08-telecamere-3D.jpg | Le telecamere 3D (inseguimento, TV, bordo pista, box, panoramica) e il 2D |
| 09-modelli-3D-moto-4-categorie.png | Modelli 3D delle 4 categorie in piega |
| 10-garage-14-componenti.png | Garage: moto al centro, 14 componenti con usura e affidabilità |
| 11-moto-e-upgrade.png | Sviluppo in fabbrica e foto della moto del costruttore |
| 12-classifiche.png | Classifiche del campionato |
| 13-campione-ritratti-generati.jpg | Campione dei 567 ritratti generati |
| 14-foto-moto-per-costruttore.jpg | Le 13 foto delle moto per costruttore e categoria |
| 15-risultati-gara.png | Risultati di gara |
