# Infortuni, sostituzioni e collaudatori

> Stato: **PROPOSTA — revisione Fase 0**. Regole per categoria in [REGULATIONS.md](REGULATIONS.md).

## 1. Infortunio

### 1.1 Origine
Cadute in gara, prove o test (gravità legata a velocità e punto della caduta), incidenti in
allenamento (raro), ricadute di un infortunio non guarito.

### 1.2 Durata: giorni, non gare
La durata è calcolata in **giorni** e confrontata con il calendario. Non esiste un numero fisso di
gare saltate.

```
giorni_recupero = base(tipo, gravità) × (1 − 0.25·livello_centro_medico/5)
                  × (1 − 0.15·fisioterapista) × (1 − 0.10·forma_fisica) × f_età × ε
ε ~ LogNormale(0, 0.18)          // variabilità individuale
```

| Esempio di tipo | Gravità | Base (giorni) |
|---|---|---|
| Contusione, abrasioni | lieve | 3–8 |
| Frattura dito / mano | media | 14–28 |
| Frattura clavicola | media | 21–42 |
| Frattura polso / caviglia | grave | 35–70 |
| Frattura femore / bacino | molto grave | 70–150 |
| Commozione cerebrale | variabile | 7–21 (protocollo obbligatorio) |

Dai giorni si ricavano le **gare a rischio**: per ogni evento in calendario la probabilità che il
pilota non sia idoneo. Esempio mostrato all'utente: "salterà con certezza R7 e R8, probabile R9 (70%),
possibile R10 (30%)". Il risultato può essere 1, 2, 3, 4, 5 o più gare.

### 1.3 Idoneità sportiva
Il pilota rientra solo dopo la **visita medica di idoneità** prima dell'evento. Se manca poco al
recupero completo può tentare il rientro anticipato: passa la visita con una probabilità che dipende
dai giorni mancanti; se corre non al 100% ha prestazioni ridotte e rischio di ricaduta.

## 2. Decisione del Team Principal

Quando un titolare è dichiarato non idoneo, il manager riceve una notifica e apre la **schermata
infortunio**. Tre opzioni, decise **per ogni evento** e modificabili fino alla scadenza d'iscrizione.

### A — Schierare il collaudatore
- Corre con la moto (o le moto A/B in Premier) e lo staff del titolare.
- Rendimento secondo i suoi attributi; ottiene punti, esperienza e reputazione.
- Resta sotto il suo contratto (eventuale bonus per le gare disputate previsto nel contratto).
- Al rientro del titolare torna collaudatore, salvo nuove decisioni.
- Deve rispettare licenza, età e requisiti di partecipazione.
- Mentre corre, i test previsti con lui sono sospesi (costo opportunità per lo sviluppo).

### B — Ingaggiare un sostituto
- Candidati: piloti senza contratto, piloti esperti, ex titolari (ritirati da ≤ 2 anni, forma ridotta),
  piloti di categorie inferiori (con il permesso della loro squadra e senza conflitti di calendario),
  giovani dell'accademia idonei, piloti disponibili tramite accordi temporanei (es. collaudatore del
  costruttore per un team satellite).
- **Contratto temporaneo**: 1 gara, più gare, oppure fino al rientro del titolare; compenso per gara,
  bonus (punti, top 10, podio), clausole (rilascio anticipato al rientro del titolare, opzione di
  estensione, costo di liberazione/prestito verso la squadra di provenienza).
- Confronto dei candidati: velocità, esperienza, **adattamento alla moto** (conosce il costruttore o
  la categoria?), condizione fisica, costo totale, compatibilità con lo staff del titolare, disponibilità (quante gare).
- Le squadre IA usano lo stesso mercato: un candidato può essere ingaggiato da un rivale prima di te.

### C — Non schierare nessuno
- Il posto resta **vacante**; la squadra corre solo con gli altri piloti disponibili.
- Il pilota assente non ottiene punti; il campionato prosegue normalmente.
- Conseguenze possibili: punti mancati nel campionato squadre, obiettivi stagionali più difficili,
  insoddisfazione degli sponsor (secondo le clausole di visibilità), perdita di visibilità,
  riduzione della quota di partecipazione Premier, **nessuna penalità se il regolamento non la prevede**.
- Vantaggio: nessun costo d'ingaggio; nessuna usura delle moto del titolare; staff disponibile per
  altri lavori (es. preparazione dell'altra moto, analisi).
- Possibile solo se `vacancyAllowed` della categoria lo consente.

### 2.1 Anteprima delle conseguenze (prima della conferma)
Per ogni opzione la schermata mostra stime, non certezze:
- **Sportive**: punti attesi per la squadra (dal rendimento stimato del pilota schierato), effetto
  sulla posizione nel campionato squadre e sugli obiettivi.
- **Economiche**: costo d'ingaggio e stipendio temporaneo, bonus attesi, riduzione quota partecipazione,
  rischio di penali sponsor, costi di riparazione attesi.
- **Regolamentari**: idoneità del sostituto (licenza, età), scadenza d'iscrizione, penalità previste (se presenti).
- **Squadra**: morale del titolare (vede chi lo sostituisce), fiducia dello staff, test sospesi.

## 3. Rientro del titolare
1. Notifica al manager quando la data di recupero si avvicina.
2. Visita medica di idoneità prima dell'evento.
3. Il titolare torna a correre.
4. Il sostituto termina l'incarico (clausola di rilascio) o torna al suo ruolo (collaudatore, accademia, categoria inferiore).
5. Le assegnazioni dello staff tornano a quelle del titolare (il rapporto con il sostituto resta nello storico).
6. Lo storico registra gare saltate, sostituti, punti ottenuti dai sostituti e costi.

## 4. Collaudatori

### 4.1 Dati
Ritratto (fotografia o ritratto illustrato, vedi [UI_DESIGN.md](UI_DESIGN.md)), nome, cognome,
nazionalità, età, attributi di guida (gli stessi dei piloti), esperienza (km di test, anni),
**feedback tecnico**, **capacità di sviluppo** (quanto le sue prove fanno avanzare e validare i
progetti R&D), contratto (ruolo, disponibilità come sostituto, bonus per gara), stipendio.

### 4.2 Effetti
```
qualità_dati_test   = 0.5·FeedbackTecnico + 0.3·Costanza + 0.2·Esperienza_test
avanzamento_validazione_R&D ∝ CapacitàSviluppo · km_test · livello_centro_simulazione
rumore_osservazioni ∝ (1 − qualità_dati_test)
```
Un buon collaudatore rende più affidabili i confronti tra configurazioni e più rapida l'omologazione
dei nuovi componenti; un collaudatore veloce ma poco preciso produce dati più rumorosi.

## 5. Sessioni di test
- Pre-stagione e in stagione (Premier circa ogni 5 GP, compatibilmente con calendario e regolamento).
- Il manager sceglie collaudatore e/o titolari (se consentito), componenti da provare, programma
  (giri per obiettivo), analizza telemetria, confronta configurazioni, raccoglie feedback e fa i briefing.
- Moto disponibili: Premier sistema A/B + moto da test consentite; categorie inferiori una moto per pilota.

## 6. Intelligenza artificiale
Le squadre IA scelgono fra le stesse tre opzioni con una valutazione di utilità:

```
U(opzione) = valore_punti(posizione, obiettivi) · punti_attesi
           + impatto_sponsor + impatto_reputazione
           − costo · (1 / solidità_budget) − rischio
```
Fattori: budget, obiettivi, gravità e durata dell'assenza, qualità dei collaudatori, disponibilità
sul mercato, posizione in campionato, regolamento. Una squadra in difficoltà economica può lasciare
il posto vacante; una squadra in lotta per il titolo costruttori tende a schierare il miglior sostituto possibile.
