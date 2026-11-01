# Squadra tecnica, Moto A/B e briefing

> Stato: **PROPOSTA — revisione Fase 0**. Documento di dettaglio dei sistemi aggiunti:
> due moto per pilota, briefing tecnici, mercato e crescita degli ingegneri, rapporti
> pilota-staff, sviluppo dell'assetto nel weekend, integrazione con il meteo, IA.
> Valori numerici = punti di partenza da calibrare con `tools/balance`.

## 0. Principio guida: verità, osservazioni, ipotesi

Tutti i sistemi di questo documento poggiano su un **modello di conoscenza a cinque livelli**:

| Livello | Chi lo conosce | Esempio |
|---|---|---|
| 1. **Problema tecnico reale** | solo il motore di simulazione | il controllo trazione taglia troppo tardi e l'idraulica posteriore in estensione è troppo chiusa |
| 2. **Dati osservati** | squadra (telemetria, tempi, gomme) | slittamento posteriore +18% nelle curve lente, temperatura gomma posteriore 112 °C |
| 3. **Sensazioni del pilota** | squadra (dal pilota) | "in uscita dalle curve lente il posteriore scivola" |
| 4. **Ipotesi dello staff** | squadra (dagli ingegneri) | "70%: gestione della coppia; 30%: sospensione posteriore" |
| 5. **Soluzione proposta → risultato effettivo** | proposta: squadra; risultato: emerge dalla sessione successiva | "TC +2" → −0,21 s nel settore 3, ma usura gomma +4% |

La UI riceve **solo i livelli 2–5**. Il livello 1 non esce mai dal motore (vedi [ADR-0003](adr/0003-knowledge-model.md)).
Questo rende possibile: errori di diagnosi, ingegneri più o meno bravi, giocatori che imparano a leggere i dati, e IA avversarie che non barano.

---

## 1. Sistema Moto A / Moto B

### 1.1 Regole
- Ogni pilota dispone di **fino a due moto** (`A` e `B`), secondo il regolamento della categoria:
  `bikesPerRider` (valori iniziali: **Premier 2; Intermediate, Lightweight e Rookies Cup 1**, vedi [REGULATIONS.md](REGULATIONS.md)) e
  `flagToFlag` (vero solo dove il cambio moto è ammesso).
- I limiti tecnici valgono **per pilota**, non per moto: i motori della dotazione stagionale
  sono condivisi fra A e B, così come le mescole assegnate per il weekend e i pacchetti omologati.
- **Un solo motore fisico.** A e B sono due istanze della stessa entità `Bike`: le prestazioni si
  ricavano con la stessa funzione `derivePerformance(bike, setup, conditions)` della simulazione.

### 1.2 Stato individuale di ogni moto
Componenti montati (motore, telaio, forcellone, sospensioni, freni, elettronica, aerodinamica,
cambio, accessori: serbatoio, scarico, dispositivo abbassamento, pedane/semimanubri),
chilometraggio, usura, affidabilità attuale, danni, stato di manutenzione, assetto,
**prontezza** (0–100%) e **disponibilità** per la sessione (pronta / in preparazione / danneggiata / non ammessa).

### 1.3 Ruoli d'uso
- Le sezioni seguenti (§1.2–1.6) valgono **solo dove `bikesPerRider = 2`** (Premier). Nelle altre categorie
  il pilota ha una moto: restano stato individuale, lavori, prontezza e confronto fra *sessioni* (prima/dopo una modifica).
- **Moto A — configurazione principale**: riferimento conosciuto.
- **Moto B — configurazione sperimentale**: assetto o componenti diversi da provare.
- In alternativa **A asciutto / B bagnato** quando il meteo è incerto (vedi §8).
I ruoli sono etichette decise dal manager, non vincoli: la B può diventare la moto principale.

### 1.4 Confronto equo fra A e B
I tempi grezzi ingannano: pista che migliora, carburante, gomme di età diversa, temperatura, traffico.
Il sistema stima la differenza **corretta** e la sua **incertezza**:

```
Δ_grezzo  = media(giri validi B) − media(giri validi A)
Δ_corretto = Δ_grezzo − Σ_k ĉ_k            k ∈ {evoluzione pista, carburante, età gomme, T asfalto, vento}
σ          = sqrt( σ_giro² · (1/n_A + 1/n_B) + Σ_k σ_ĉk² )
```
- I giri "non validi" (traffico, errori, bandiere gialle, giri di uscita) sono esclusi automaticamente.
- Le correzioni `ĉ_k` sono **stime**: la loro precisione cresce con l'abilità dell'analista di
  telemetria e dell'ingegnere di pista e con il livello del centro telemetria.
- La UI mostra ad esempio: **"B più veloce di 0,18 s ± 0,12 (confidenza media)"** e segnala i
  confronti non affidabili ("troppi pochi giri", "condizioni troppo diverse").
- Confronto anche per **settore**, velocità di punta, consumo gomme e carburante, feeling del pilota.

### 1.5 Preparazione della seconda moto
Ogni modifica richiede **ore-meccanico**. Tra una sessione e l'altra la squadra ha un budget di tempo:

```
ore_disponibili = n_meccanici · durata_pausa · efficienza(coordinamento capotecnico, morale)
prontezza_B    += ore_assegnate / ore_richieste(lavori)
```
Lavori tipici: cambio assetto (0,5–2 h), cambio componente (1–4 h), cambio motore (3–6 h),
riparazione dopo caduta (variabile). Se la prontezza è < 100% la moto può uscire con
lavori incompleti (rischio di errori di configurazione) oppure restare ai box.

### 1.6 Cambio moto flag-to-flag
```
t_cambio = t_corsia_box + t_scambio
t_scambio = t_base(regolamento) · (1.15 − 0.3 · coordinamento_meccanici) + ritardo_errori
P(errore) = p0 · (1 − precisione_capotecnico) · (1 + pressione) · (1 − prontezza_B)
```
Si considerano: personale disponibile ai box, prontezza della B, gomme montate e loro
temperatura (gomme fredde nei primi giri), assetto della B, mappa elettronica impostata.
Errori possibili: pressione gomme errata, mappa sbagliata, ritardo nello scambio, ripartenza
in corsia con infrazione (penalità). Il giocatore decide **quando** cambiare; il pilota può
anticipare o ritardare il rientro in base a personalità e fiducia.

---

## 2. Briefing tecnico

### 2.1 Quando
Dopo ogni sessione di prove, dopo le qualifiche e prima della gara. Ogni briefing ha un
**tempo limitato** (dipende dall'intervallo prima della sessione successiva) che si consuma con
le richieste di approfondimento e con il lavoro sulla moto.

### 2.2 Generazione delle sensazioni del pilota
1. Il motore calcola i **problemi reali**: per ogni area (frenata, ingresso, centro curva,
   uscita lenta, uscita veloce, cambi di direzione, stabilità in rettilineo, velocità di punta,
   gestione gomme) uno scostamento ricavato da assetto, componenti, gomme e condizioni.
2. Il pilota traduce i problemi in **sintomi** con una frase dal catalogo (es. "il posteriore scivola
   in uscita dalle curve lente"). Precisione:
   ```
   P(sintomo corretto) = 0.45 + 0.45·FeedbackTecnico + 0.10·esperienza_pista
   ```
   Un pilota poco preciso può confondere l'area, esagerare un problema minore o non segnalarlo.
   Lo stile di guida pesa: un pilota "staccatore" si lamenta prima della frenata.
3. La telemetria produce **indicatori osservati** con rumore (slittamento, instabilità in frenata,
   ondeggiamento, temperature, velocità di percorrenza), più precisi con centro telemetria e analisti migliori.

### 2.3 Diagnosi dello staff
Ogni membro (ingegnere di pista, capotecnico, eventuale analista) produce una lista di **ipotesi**
con una confidenza dichiarata. Probabilità che la causa principale sia corretta:
```
q = σ( 2.2·Diagnosi + 1.0·InterpretazioneFeedback·Comprensione_stile
       + 0.6·ln(1 + giri_analizzati/8) + 0.5·ConoscenzaPneumatici·(problema gomme)
       − difficoltà_problema + intuizione )
intuizione ~ con probabilità p_i = 0.04 + 0.08·ProblemSolving + 0.04·CapacitàApprendimento
             si aggiunge +1.5 (l'"idea brillante", possibile anche per un giovane)
```
La **confidenza dichiarata** non coincide con `q`: dipende anche dalla personalità
(un ingegnere presuntuoso è sicuro anche quando sbaglia). Il giocatore impara col tempo quanto
fidarsi di ciascuno; la scheda ingegnere mostra lo **storico delle diagnosi** (azzeccate / sbagliate).

### 2.4 Proposte
Ogni ipotesi genera 1–3 **soluzioni** (variazioni di parametri di assetto o di elettronica, o
"raccogliere altri dati"). Ogni soluzione mostra **vantaggi e svantaggi attesi** espressi in modo qualitativo
e con un intervallo ("guadagno stimato 0,05–0,25 s, possibile aumento usura posteriore").
Il risultato reale si vede solo provando.

### 2.5 Decisioni del Team Principal
| Decisione | Effetto |
|---|---|
| Accetta il consiglio dell'ingegnere | applica la soluzione; fiducia ingegnere ↔ manager aggiornata in base al risultato |
| Chiedi una seconda analisi | consuma tempo; nuova estrazione con più dati (q più alto), può confermare o ribaltare |
| Confronta soluzioni | mostra le proposte affiancate; nessun costo ma nessuna informazione nuova |
| Parere del capotecnico | ipotesi del capotecnico (più forte su meccanica e telaio) |
| Privilegia il feedback del pilota | applica la modifica richiesta dal pilota; +fiducia/morale del pilota, efficacia legata al suo FeedbackTecnico |
| Mantieni l'assetto | nessun rischio; perdi tempo di sviluppo; +dati per il prossimo briefing |
| Sperimenta sulla Moto B | la soluzione va sulla B, la A resta di riferimento (richiede prontezza della B) |

Conseguenze reali: qualità dell'assetto (`Q_setup`), fiducia del pilota nella moto, rapporti
(ignorare spesso il pilota → −fiducia; seguire un consiglio sbagliato → −fiducia verso l'ingegnere),
tempo residuo, crescita professionale dello staff (§4).

### 2.6 Delega
Il manager può delegare ogni briefing al capotecnico o al direttore tecnico. La qualità delle scelte
dipende dalle loro abilità; il risultato viene riassunto nella posta.

---

## 3. Personale tecnico e mercato degli ingegneri

### 3.1 Dati comuni
Nome, cognome, nazionalità, età, esperienza (anni e sessioni), reputazione, stipendio, contratto,
specializzazione, potenziale (nascosto), personalità, morale, fedeltà, ambizione, compatibilità con
ciascun pilota (calcolata, §5).

### 3.2 Attributi per ruolo (1–100)
**Ingegnere di pista**: analisi telemetrica, interpretazione del feedback, capacità diagnostica,
conoscenza assetti, gestione strategie, conoscenza pneumatici, adattamento al meteo, comunicazione
con il pilota, gestione della pressione, problem solving, capacità di apprendimento.

**Capotecnico**: conoscenza meccanica, preparazione moto, configurazione sospensioni, configurazione
telaio, interpretazione del feedback, coordinamento meccanici, gestione del tempo, affidabilità
operativa, precisione, problem solving.

**Specialisti** (motore, elettronica, telaio, aerodinamica, telemetria): attributi tecnici della
propria area (es. elettronica: mappature motore, controllo trazione, freno motore, strategie
energetiche, integrazione sensori) + attributi trasversali (problem solving, apprendimento,
lavoro di squadra). Fuori dalla specializzazione i valori sono tipicamente bassi.

**Direttore tecnico**: visione tecnica, gestione progetti R&D, leadership, allocazione risorse,
conoscenza regolamento, valutazione del personale.

### 3.3 Scouting del personale
Uguale nello spirito allo scouting dei piloti: si assegnano osservatori o si chiedono referenze;
gli attributi appaiono come **intervalli** che si restringono con il tempo di osservazione e con
il livello di chi osserva. Filtri: ruolo, specializzazione, età, stipendio richiesto, disponibilità,
lingua/nazionalità, compatibilità stimata con i propri piloti.

### 3.4 Profili presenti nel mondo
Giovani emergenti (alto potenziale, poca esperienza), esperti, specialisti di motori, elettronica,
telaio, telemetria, ingegneri di pista, capotecnici, direttori tecnici. Il generatore del mondo
assicura per ogni categoria una distribuzione realistica e un ricambio annuale (laureati, ingegneri
dalle serie minori, ritiri).

### 3.5 Contratti e mercato
Stesso sistema di negoziazione dei piloti (offerta, controfferta, scadenze, clausole, bonus,
offerte concorrenti, rumors). Clausole specifiche: **ruolo garantito** (es. capotecnico di un pilota
titolare), **pilota assegnato**, divieto di passare a un rivale per N mesi (gardening leave),
budget di formazione.

---

## 4. Crescita professionale

### 4.1 Competenze vs reputazione
Sono **due canali separati**:
- **Competenze** crescono con il lavoro svolto.
- **Reputazione, valore di mercato, richieste economiche, fiducia in se stessi** crescono con i risultati
  sportivi (vittorie, podi, titoli). Un ingegnere che vince grazie a un pilota eccezionale diventa più
  richiesto, non automaticamente più bravo.

### 4.2 Esperienza che fa crescere
```
Δattributo = Σ eventi · peso_evento · rilevanza(attributo, evento) · f_età · f_potenziale · (1 + 0.4·Apprendimento)
f_potenziale = max(0, (potenziale − valore) / potenziale)^0.7         // rallenta vicino al limite
f_età: curva per "tipo di carriera": precoce / regolare / tardivo
```
Eventi: sessioni analizzate, diagnosi corrette (peso alto) e sbagliate (peso basso ma non nullo:
si impara dagli errori), problemi risolti, collaborazione con piloti dal buon feedback, corsi di
formazione, affiancamento a colleghi più esperti (mentoring: +x% se un collega supera di 15+ punti
l'attributo), risultati dei progetti R&D, specializzazione (crescita più rapida nella propria area).

### 4.3 Potenziale
Tetto individuale nascosto + tipo di curva: alcuni crescono in fretta e si fermano presto, altri
diventano grandi specialisti dopo molti anni. Con l'età avanzata gli attributi fisici/di pressione
calano lievemente, quelli di conoscenza restano stabili.

---

## 5. Rapporto pilota – ingegnere di pista – capotecnico

### 5.1 Valori per ogni coppia pilota-membro dello staff
Fiducia, comunicazione, compatibilità (in gran parte strutturale: personalità, lingua, stile),
esperienza condivisa (sessioni insieme), comprensione dello stile di guida, soddisfazione lavorativa.

### 5.2 Effetti
```
precisione_interpretazione = base(InterpretazioneFeedback) · (0.65 + 0.35·Comprensione_stile)
Comprensione_stile(t) = c0 + (1 − c0)·(1 − e^(−sessioni/τ))     c0 = 0.35 + 0.25·compatibilità
```
`c0` garantisce che una coppia nuova possa lavorare bene fin da subito (non parte da zero); il
tempo e la compatibilità la rendono eccellente.

### 5.3 Conflitti
Generati da: divergenze ripetute sugli assetti, risultati negativi dopo consigli dello staff,
errori di comunicazione, preferenze personali, rivalità interne. Sviluppo: avviso → insoddisfazione →
richiesta di sostituzione (dal pilota) o di trasferimento (dall'ingegnere).

### 5.4 Interventi del manager
Colloquio di mediazione (esito dipende da personalità e reputazione del manager), ridefinizione dei
ruoli, attività di squadra, bonus, riassegnazione, formazione sulla comunicazione.

---

## 6. Gestione dello staff in carriera
Licenziare (con costo di rescissione e impatto sul morale di chi resta), ingaggiare, promuovere
un tecnico interno (es. analista → ingegnere di pista: periodo di adattamento), spostare un
ingegnere da un pilota all'altro (la comprensione dello stile riparte da `c0`, la fiducia resta in parte),
rinnovare, offrire bonus, finanziare corsi di formazione (costo, durata, attributo mirato).
Le squadre rivali fanno offerte ai migliori; un pilota può chiedere un tecnico specifico (anche
portarlo con sé quando cambia squadra); un ingegnere può andarsene per un ruolo più importante.

---

## 7. Sviluppo dell'assetto nel weekend

```
Assetto base  ← libreria della squadra (anno precedente sullo stesso circuito) + centro simulazione
   FP1 ──► briefing 1 ──► modifiche (A e/o B)
   PR  ──► briefing 2 ──► modifiche + confronto A/B corretto per le condizioni
   FP2 ──► briefing 3 ──► scelta configurazione per qualifica
   Q   ──► analisi post-qualifica ──► preparazione gara entro i limiti del regolamento
   WUP ──► briefing finale pre-gara
   GARA
```
**Briefing finale pre-gara**: strategia, gomme (anteriore/posteriore), gestione carburante, scenari
di pioggia, assetto finale consentito, piano di emergenza (es. "se piove prima del giro 10: cambio moto;
dopo il giro 20: restare fuori"). Le istruzioni vengono convertite in **pit board** e messaggi consentiti
dal regolamento. Ogni assetto riuscito viene salvato nella **libreria assetti** per gli anni successivi.

Il regolamento indica se dopo le qualifiche le modifiche sono libere o limitate (`setupChangesAfterQuali`).

---

## 8. Briefing e meteo
- Le previsioni sono **probabilistiche** e migliorano avvicinandosi all'evento (e con un buon
  responsabile strategia o ingegnere con "adattamento al meteo" alto).
- In ogni briefing il manager stabilisce il **programma della sessione successiva**, ripartendo i giri
  fra: sviluppo asciutto, simulazione gara, test gomme, prova della Moto B, raccolta dati in condizioni miste.
- **Dati da bagnato utilizzabili davvero**: si ottengono solo se una sessione è (almeno in parte)
  bagnata. Se è asciutto, la preparazione al bagnato passa da: assetto base da libreria, centro di
  simulazione, mappe elettroniche dedicate, e **ore-meccanico** spese per preparare la Moto B in
  configurazione bagnato. È tempo sottratto allo sviluppo dell'asciutto: il rischio è sprecarlo se la pioggia non arriva.
- L'ingegnere può suggerire: assetto alternativo, strategia gomme, preparazione Moto B, modifiche
  elettroniche, priorità delle prove.

---

## 9. Intelligenza artificiale
Le squadre IA usano **gli stessi sistemi e lo stesso livello di informazione** del giocatore:
due moto per pilota, staff con attributi reali, briefing con ipotesi generate dai loro ingegneri
(senza accesso alla verità), scelte fatte dal loro direttore tecnico/capotecnico secondo il profilo
della squadra (prudente, sperimentale…), preparazione alla pioggia in base alle loro previsioni,
mercato e formazione del personale. Per rendere veloce la simulazione delle sessioni non visibili,
il briefing IA viene risolto in forma compatta (stesse probabilità, nessun testo generato).

---

## 10. Collocazione nella roadmap (sintesi)
| Livello | Contenuto |
|---|---|
| **MVP (v0.1, Fase 2)** | 1 ingegnere di pista + 1 capotecnico per pilota, attributi di base, feedback dopo le prove (sintomi), proposte semplici di assetto (1–2 opzioni), modello verità/osservazioni già attivo, **una sola moto** (lo schema dati prevede già A/B) |
| **Intermedio (Fasi 3–4)** | mercato completo ingegneri, contratti, scouting staff, crescita, compatibilità, briefing interattivi completi, due moto per pilota, confronto A/B corretto |
| **Avanzato (Fasi 4–5)** | diagnosi approfondite, telemetria avanzata, errori di interpretazione e confidenza "falsata", formazione specialistica, relazioni e conflitti complessi, preparazione A/B per condizioni diverse, flag-to-flag completamente simulato |

Dettagli e dipendenze in [ROADMAP.md](ROADMAP.md).
