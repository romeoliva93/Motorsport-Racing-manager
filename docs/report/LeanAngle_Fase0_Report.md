# Sintesi della proposta

**Repository**: `romeoliva93/motorcycle-manager` · branch
`design/phase-0-proposal` · Pull Request \#1 (in revisione, non
integrata in `main`).

**Stato**: solo progettazione. Nessun sistema di gioco è ancora
implementato; i mockup usano dati illustrativi.

| Tema                            | Proposta                                                                                                                                                                                                                                                                                                                               |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tecnologia                      | TypeScript (monorepo npm) · simulazione in pacchetti puri su Web Worker · React + Vite · Canvas 2D · Tauri 2 per PC · Vitest + Playwright                                                                                                                                                                                              |
| Architettura                    | simulazione separata dalla UI; comandi validati uguali per giocatore e IA; PRNG con seme (determinismo, replay); stato relazionale in memoria; eventi di dominio                                                                                                                                                                       |
| Universo                        | federazione IVF, campionato Velocity World Championship; categorie Lightweight 250 cc, Intermediate 800 cc motore unico, Premier 1000 cc; feeder Junior Velocity Cup e Continental Talent Cups; costruttori Ardena, Hoshiro, Takaido, Vohrmann, Corvane; 11 squadre Premier; 20 circuiti immaginari                                    |
| Simulazione                     | profilo di velocità fisico (aderenza, potenza, aria, frenata) + modello comportamentale del pilota + traffico, scia, sorpassi, errori, gomme, carburante, meteo, assetto, affidabilità                                                                                                                                                 |
| Prima versione giocabile (v0.1) | stagione Premier completa con squadra esistente, gara 2D da pausa a 16×, prove/qualifiche/gara, classifiche, finanze base, salvataggi                                                                                                                                                                                                  |
| Squadra tecnica (revisione 2)   | Moto A/B per pilota con confronto corretto e cambio flag-to-flag; briefing tecnico come meccanica di gioco (verità vs osservazioni vs ipotesi); mercato, attributi, crescita e rapporti degli ingegneri; IA con gli stessi sistemi. MVP: 1 capotecnico + 1 ingegnere per pilota, feedback e prime modifiche all'assetto, una sola moto |
| Primo modulo                    | infrastruttura + `packages/core` + schema dati (M1.1–M1.3) e spike del tempo sul giro                                                                                                                                                                                                                                                  |

**Decisioni richieste**: (1) stack tecnologico; (2) titolo e nomi
dell'universo; (3) primo modulo e spike del tempo sul giro.

**Indice**: 1 Game Design Document · 2 Squadra tecnica, Moto A/B e
briefing · 3 Architettura · 4 Modello dati · 5 Modello di simulazione ·
6 Roadmap · 7 Proposta grafica · 8 Decisioni tecniche (ADR) · Appendice:
galleria screenshot.

# Game Design Document

> Stato: **PROPOSTA — Fase 0**. Tutti i nomi sono originali e
> provvisori. Prima di una pubblicazione commerciale serve una verifica
> legale su marchi e nomi.

## 1. Visione

**Titolo provvisorio: LEAN ANGLE — Moto Racing Manager** (alternative:
*Apex Paddock*, *Throttle Chief*).

Il giocatore è il **Team Principal** di una scuderia nel motomondiale
immaginario della **Velocity World Championship (VWC)**, gestito dalla
**International Velocity Federation (IVF)**. Deve vincere in pista, far
quadrare i conti, sviluppare la moto, far crescere i talenti e muoversi
nella politica del paddock. La profondità viene da **sistemi
interconnessi**, non da risultati preparati in anticipo: ogni stagione è
diversa.

**Pilastri**

1.  **Simulazione credibile**: tempi sul giro, gomme, meteo, sorpassi e
    cadute nascono da modelli fisici e comportamentali.
2.  **Decisioni con conseguenze**: ogni scelta ha un costo opportunità
    (budget, tempo, morale, affidabilità).
3.  **Persone, non numeri**: piloti e personale hanno personalità,
    relazioni, ambizioni e memoria.
4.  **Mondo vivo**: squadre IA che crescono, entrano in crisi, cambiano
    costruttore; regolamenti che evolvono.
5.  **Chiarezza**: interfaccia premium che spiega il perché dei
    risultati (telemetria, report, consigli dello staff).

## 2. Universo originale

### Federazione e campionati

| Livello      | Nome                                                      | Moto                                                                      | Note                                                   |
|--------------|-----------------------------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------|
| Premier      | VWC Premier                                               | Prototipi 1000 cc, 4 cilindri (regolamento modificabile)                  | costruttori, concessioni, sviluppo libero entro limiti |
| Intermediate | VWC Intermediate                                          | Motore unico 800 cc tre cilindri *Orvane*, telai dei costruttori di telai | sviluppo telaio/sospensioni, elettronica unica         |
| Lightweight  | VWC Lightweight                                           | 250 cc monocilindrico                                                     | limite di età 28 anni, costi bassi                     |
| Feeder       | Junior Velocity Cup                                       | monomarca 250 cc                                                          | 13–17 anni, scouting                                   |
| Feeder       | Continental Talent Cups (Europa, Asia-Pacifico, Americhe) | 250 cc                                                                    | campionati regionali                                   |
| Feeder       | Campionati nazionali                                      | —                                                                         | simulati in modo statistico, fonte di giovani          |

### Costruttori (Premier)

| Costruttore  | Paese    | Identità tecnica                                            |
|--------------|----------|-------------------------------------------------------------|
| **Ardena**   | Italia   | motore potente, aerodinamica avanzata, consumo gomme alto   |
| **Hoshiro**  | Giappone | equilibrio, grande affidabilità, sviluppo lento             |
| **Takaido**  | Giappone | agilità e percorrenza, poca potenza                         |
| **Vohrmann** | Austria  | telaio rigido, frenata eccellente, difficile da guidare     |
| **Corvane**  | Francia  | costruttore giovane con concessioni, elettronica innovativa |

Altri marchi: **Lysander** (Regno Unito, presente in Lightweight,
candidato a entrare in Premier), costruttori di telai Intermediate
**Navarra Chassis** (Spagna) e **Bertoldi Telai** (Italia).

### Fornitori tecnici

Gomme **Velgrip** (unico fornitore), carburante **Petrava**, centralina
unica **Cortex Dynamics**, freni **Ferrox** e **Kaiten**, sospensioni
**Ölund** e **Sorriva**.

### Squadre Premier iniziali (11 × 2 piloti)

Ufficiali: *Ardena Corse*, *Hoshiro Racing Works*, *Takaido Factory
Racing*, *Vohrmann Performance*, *Corvane Moto Sport*.
Satellite/indipendenti: *Scuderia Lupo Blu* (Ardena), *Team Meridian*
(Ardena), *Akane Racing* (Hoshiro), *Atlas Motorsport* (Takaido),
*Alpenwerk Racing* (Vohrmann), *Équipe Bastide* (Corvane). Le categorie
inferiori avranno 14–16 squadre ciascuna.

### Calendario di esempio (20 round, tutti circuiti immaginari)

Al-Rimal International (gara notturna) · Autódromo Cerro Azul ·
Shiranami Circuit · Circuit de Serrablanca · Circuit des Hautes Landes ·
Autodromo del Monte Ferro · Brennholz-Ring · Vltava Ring · Rijnvaart
Circuit · Lakeside Park Raceway · Dunavár Circuit · Circuito do
Atlântico · Autodromo Valle del Savio · Anatolia Park · Phang-Rai
International · Pulau Hijau Circuit · Coral Coast Raceway · Nusa Biru
Circuit · Autódromo Sierra Dorada · Lone Pine Motorsports Park.

Ogni circuito ha tracciato originale disegnato come polilinea,
caratteristiche (velocità media, frenate, abrasività, sorpassi) e clima
stagionale.

### Persone

Piloti e personale sono generati da **pool di nomi per nazionalità**
combinati con un seme, più un piccolo gruppo di personaggi scritti a
mano. Uno script di controllo (`tools/content-check`) confronta i nomi
con una lista di piloti e personaggi reali per evitare coincidenze.
Sponsor di esempio: *Voltaris Energy*, *Nexora Telecom*, *Fulmine
Drinks*, *Kestrel Watches*, *Aurum Bank*, *Helix Helmets*, *Pantera
Apparel*.

Loghi e livree sono generati proceduralmente (forme, monogrammi,
palette) e personalizzabili.

## 3. Modalità di gioco

### 3.1 Carriera con squadra esistente

Scelta di categoria e squadra. La difficoltà deriva dalla squadra stessa
(budget, reputazione, obiettivi della dirigenza). Ogni squadra ha
piloti, staff completo, costruttore, moto, budget, sponsor, contratti,
strutture, reputazione, obiettivi e storia (generata simulando le
stagioni precedenti all'inizio della carriera, così lo storico è
coerente e non scritto a mano).

### 3.2 Crea la tua squadra

Personalizzazione: nome, logo (editor procedurale), nazionalità, sede,
colori, livrea, divise, numeri, sponsor iniziali, tipologia, budget
iniziale (determinato da tipologia e difficoltà). Selezione di
costruttore, piloti, capotecnici, ingegneri, meccanici, direttore
tecnico e responsabili dei reparti dal mercato dei liberi e da un pool
di "disponibili alla nuova squadra".

| Tipologia             | Budget                     | Moto                                | Sviluppo                               | Vincoli / vantaggi                                                  |
|-----------------------|----------------------------|-------------------------------------|----------------------------------------|---------------------------------------------------------------------|
| **Privato**           | molto basso                | moto clienti dell'anno precedente   | solo assetto ed elettronica            | massima libertà di sponsor; reputazione bassa                       |
| **Indipendente**      | basso-medio                | moto in leasing della stagione      | piccoli pacchetti (sospensioni, freni) | trattativa annuale col costruttore                                  |
| **Satellite**         | medio                      | specifica attuale o dell'anno prima | nessuno sul motore, dati condivisi     | il costruttore può imporre piloti ed obiettivi                      |
| **Ufficiale**         | alto                       | specifica di fabbrica               | completo                               | aspettative alte, pressione della casa madre                        |
| **Nuovo costruttore** | altissimo, con investitori | progettata da zero                  | completo                               | concessioni regolamentari, prestazioni iniziali basse, costi enormi |

### 3.3 Percorso di carriera

Si può iniziare in Lightweight o Intermediate e salire di categoria
(iscrizione approvata dalla federazione in base a reputazione, finanze e
posti disponibili), oppure acquisire il posto di una squadra in
difficoltà. Si può essere licenziati se gli obiettivi falliscono
ripetutamente, con offerte da altre squadre in base alla reputazione del
giocatore.

## 4. Sistemi principali (sintesi)

| Sistema              | Contenuto                                                                                                                                     | Riferimento tecnico         |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|
| Personale            | 19 ruoli, attributi per ruolo, personalità, morale, compatibilità, offerte rivali                                                             | DATA_MODEL §3, TECH_TEAM §3 |
| **Squadra tecnica**  | mercato e scouting degli ingegneri, attributi per ruolo, crescita professionale, rapporti pilota-staff, conflitti                             | GDD §16, TECH_TEAM §3–6     |
| **Moto A / Moto B**  | due moto per pilota con stato individuale, confronto equo, preparazione, cambio flag-to-flag                                                  | GDD §16, TECH_TEAM §1       |
| **Briefing tecnico** | sensazioni del pilota, diagnosi dello staff, decisioni del manager, sviluppo dell'assetto nel weekend                                         | GDD §16, TECH_TEAM §2, §7–8 |
| Piloti               | 17 attributi + potenziale, crescita/declino, forma, infortuni, rivalità, ritiri, sostituti, collaudatori                                      | SIMULATION §4               |
| Contratti e mercato  | stipendio, durata, bonus, clausole, opzioni, ruoli, obiettivi; trattative con controfferte; IA autonoma; indiscrezioni                        | GDD §5                      |
| Accademia            | scouting internazionale, istruttori, programmi (minibike, flat track, motard, simulatore, atletica), contratti junior, prestiti, promozione   | GDD §6                      |
| Moto                 | 9 componenti, 10 caratteristiche prestazionali derivate                                                                                       | SIMULATION §2               |
| R&D                  | progetti conservativi/equilibrati/aggressivi/sperimentali, ingegneri, budget, tempi, produzione, test, fallimenti                             | GDD §7                      |
| Strutture            | 12 strutture con livelli, costi, manutenzione, benefici                                                                                       | GDD §8                      |
| Weekend              | formato configurabile per categoria/stagione; controllo diretto di prove e qualifiche                                                         | GDD §9                      |
| Assetto              | 8 gruppi di regolazioni, preferenze pilota, proposte di capotecnico e ingegnere                                                               | SIMULATION §9               |
| Telemetria           | tempi, settori, velocità, freno, gas, temperature, consumi, gomme, distacchi, passo; confronto piloti                                         | SIMULATION §11              |
| Gara                 | vista 2D dall'alto, velocità pausa–16×, eventi, bandiere, interruzioni                                                                        | SIMULATION                  |
| Strategie            | ritmo, aggressività, gomme, carburante, mappe; pit board / messaggi cruscotto secondo regolamento                                             | GDD §10                     |
| Meteo e gomme        | meteo dinamico, asfalto, pioggia, vento, asciugatura; mescole, temperature, usura                                                             | SIMULATION §6–8             |
| Economia             | entrate/uscite, bilanci, previsioni, prestiti, flussi di cassa                                                                                | GDD §11                     |
| Sponsor              | budget, durata, bonus, obiettivi, aspettative, attività promozionali                                                                          | GDD §11                     |
| Media                | conferenze, interviste, notizie, rumors, rivalità, rapporti coi costruttori                                                                   | GDD §12                     |
| IA                   | profilo strategico per squadra, decisioni periodiche con stesse regole e stesse informazioni del giocatore (anche Moto A/B, staff e briefing) | GDD §13, TECH_TEAM §9       |
| Regolamenti          | punti, penalità, limiti tecnici, motori, congelamenti, formati, votazioni                                                                     | GDD §14                     |

## 5. Mercato e contratti

- Finestra di mercato aperta tutto l'anno con picchi (pausa estiva, fine
  stagione).
- Ogni negoziazione: offerta → risposta (accetta / rifiuta /
  controproposta) con valutazione dell'utilità per il pilota: soldi,
  moto competitiva, ruolo (primo pilota), progetto, fedeltà, rapporto
  con il personale, nazionalità/sponsor.
- **Offerte concorrenti**: le squadre IA possono inserirsi; il pilota
  comunica scadenze.
- **Indiscrezioni**: le trattative generano rumors con affidabilità
  variabile, che influenzano il morale dei piloti attuali.
- Clausole: rescissione, uscita per prestazioni, opzione di rinnovo
  unilaterale, promozione dall'accademia, obblighi mediatici, bonus per
  vittorie/podi/titolo.

## 6. Accademia

Livello della struttura → numero di posti e qualità dei programmi. Gli
istruttori aumentano la crescita di attributi specifici. I giovani
corrono nelle serie feeder (in squadre proprie o in prestito) e
accumulano esperienza. Promozione in Lightweight o direttamente in
squadra.

## 7. Ricerca e sviluppo

- **Conservativo**: guadagno piccolo, quasi nessun rischio, tempi brevi.
- **Equilibrato**: guadagno medio, rischio moderato.
- **Aggressivo**: guadagno alto, rischio di fallimento e affidabilità
  iniziale bassa.
- **Sperimentale**: nuovi concetti (es. dispositivi aero), possibilità
  di bocciatura regolamentare. Fasi: progettazione → produzione (dipende
  dalla fabbrica) → test (banco/pista/collaudatore) → omologazione →
  montaggio. I limiti regolamentari (congelamento motori, gettoni
  sviluppo, concessioni) vincolano cosa si può sviluppare e quando.

## 8. Strutture

Reparto motori, telaio, aerodinamica, elettronica, fabbrica, centro
telemetria, centro simulazione, centro medico, palestra, accademia,
hospitality, uffici commerciali. Ogni struttura: livelli 1–5, costo di
costruzione, tempo di lavori, manutenzione mensile, benefici (es. centro
medico: −% tempi di recupero; hospitality: +soddisfazione sponsor).

## 9. Weekend di gara

Formato configurabile da regolamento. Esempio Premier: conferenza stampa
→ FP1 → Prove valide per la qualifica (top 10 in Q2) → FP2 → Q1/Q2 →
Sprint → Warm-up → Gara. Nelle prove: mandare in pista/richiamare,
scegliere gomme, cambiare assetto, provare componenti, simulazioni di
passo, analizzare telemetria. In qualifica: gestione di traffico
(cercare la scia o il giro libero), meteo, gomme e numero di tentativi.

## 10. Strategie e comunicazioni

Prima della gara: mescole, mappa, obiettivo (vittoria, punti, gestione
gomme), istruzioni condizionali. Durante la gara, in base alla
`radioPolicy` del regolamento:

- `none`: solo **pit board** (messaggi brevi e distacchi, visibili a
  fine rettilineo);
- `dashboard`: messaggi predefiniti sul cruscotto (es. cambio mappa,
  avviso bandiera, long lap);
- `full`: comunicazione libera (prevista come opzione regolamentare
  futura). Il pilota può ignorare le indicazioni in base a personalità,
  morale e situazione. Gara flag-to-flag: cambio moto ai box se cambia
  il meteo (tempo, personale, prontezza della seconda moto, gomme,
  assetto ed errori sono simulati: vedi TECH_TEAM §1.6).

## 11. Economia e sponsor

Entrate: sponsor, premi, diritti commerciali (quota per posizione nella
classifica squadre), investitori, merchandising, forniture tecniche.
Uscite: stipendi, contratti, sviluppo, produzione, trasferte (in base
alla distanza dei circuiti), strutture, riparazioni (cadute), logistica.
Bilancio mensile, previsioni a 12 mesi, prestiti con interessi, rischio
di insolvenza (con conseguenze: vendita di asset, perdita del posto in
griglia). Sponsor: offerte in base a reputazione e visibilità; obiettivi
(posizione, podi, mercati); attività promozionali che consumano tempo
dei piloti e influenzano morale e soddisfazione.

## 12. Media e rivalità

Conferenze con domande contestuali generate dagli eventi (cadute,
contratti, risultati). Le risposte (diplomatica, ambiziosa, polemica…)
modificano reputazione, morale e relazioni. Rivalità tra piloti nascono
da contatti, battaglie ripetute, dichiarazioni; aumentano l'aggressività
negli scontri diretti.

## 13. Intelligenza artificiale

Ogni squadra IA ha un profilo (ambizione, prudenza finanziaria, priorità
tecniche, propensione a puntare sui giovani) e prende decisioni
periodiche tramite **valutazione di utilità** sugli stessi comandi del
giocatore: mercato, rinnovi, staff, sponsor, R&D, strutture, strategie
di gara, voti sui regolamenti. Il successo cambia budget e reputazione:
le squadre possono crescere, declinare, cambiare costruttore o
ritirarsi.

## 14. Regolamenti

Regolamento per categoria e stagione: punti, formato, penalità, peso
minimo, carburante, numero di motori, mescole, congelamenti, concessioni
per costruttori in difficoltà. Le modifiche vengono proposte (dalla
federazione o dai costruttori) e votate dalla commissione con gli
interessi di ciascun membro; entrano in vigore nelle stagioni
successive.

## 15. Salvataggi e storico

Salvataggio manuale, autosalvataggio, slot multipli, carriere
pluriennali, archivio di ogni stagione (classifiche, risultati,
trasferimenti), storico di piloti e squadre, record e statistiche.

## 16. Squadra tecnica, Moto A/B e briefing (revisione Fase 0)

Obiettivo: rendere il Team Principal protagonista delle decisioni
tecniche, costruendo una squadra competente e scegliendo come sviluppare
la moto durante il weekend. Specifica completa in
[TECH_TEAM.md](TECH_TEAM.md); qui la sintesi di design.

- **Moto A / Moto B**: ogni pilota ha (se il regolamento lo prevede) due
  moto con componenti, assetto, chilometraggio, usura, affidabilità,
  danni, manutenzione, prontezza e disponibilità propri. Usi tipici: A
  di riferimento e B sperimentale, oppure A asciutto e B bagnato. Un
  solo motore fisico per entrambe. Il confronto A/B è corretto per
  evoluzione della pista, carburante, gomme e temperatura e mostra
  sempre l'incertezza.
- **Briefing tecnico** dopo ogni sessione: il pilota descrive le
  sensazioni, ingegnere di pista e capotecnico propongono ipotesi e
  soluzioni con vantaggi/svantaggi incerti; il manager accetta, chiede
  un'altra analisi, confronta, sente il capotecnico, privilegia il
  pilota, mantiene o sperimenta sulla Moto B. Le decisioni cambiano
  davvero assetto, fiducia, rapporti e tempo disponibile. Delegabile.
- **Conoscenza imperfetta**: il motore conosce il problema reale;
  squadra e giocatore vedono solo dati, sensazioni e ipotesi. Nessuna
  soluzione perfetta viene rivelata automaticamente.
- **Mercato degli ingegneri** profondo quanto quello piloti: scouting
  con attributi a intervallo, giovani emergenti, specialisti,
  capotecnici, direttori tecnici; contratti con ruolo e pilota
  garantiti.
- **Crescita professionale**: le competenze crescono col lavoro svolto
  (sessioni, diagnosi, formazione, mentoring), la reputazione con i
  risultati. Potenziale individuale con curve diverse.
- **Rapporti pilota-staff**: fiducia, comunicazione, compatibilità,
  esperienza condivisa, comprensione dello stile, soddisfazione. Una
  coppia nuova può già funzionare bene; il tempo la migliora. Conflitti
  e interventi del manager.
- **Gestione in carriera**: licenziare, ingaggiare, promuovere, spostare
  fra piloti, rinnovare, bonus, corsi.
- **Weekend e meteo**: assetto base dalla libreria → briefing dopo ogni
  sessione → briefing finale pre-gara (strategia, gomme, carburante,
  scenari di pioggia, piano di emergenza). Previsioni incerte: dedicare
  tempo alla preparazione da bagnato è una scommessa.
- **IA**: le squadre avversarie usano gli stessi sistemi con le proprie
  risorse e informazioni.

# Squadra tecnica, Moto A/B e briefing

> Stato: **PROPOSTA — revisione Fase 0**. Documento di dettaglio dei
> sistemi aggiunti: due moto per pilota, briefing tecnici, mercato e
> crescita degli ingegneri, rapporti pilota-staff, sviluppo dell'assetto
> nel weekend, integrazione con il meteo, IA. Valori numerici = punti di
> partenza da calibrare con `tools/balance`.

## 0. Principio guida: verità, osservazioni, ipotesi

Tutti i sistemi di questo documento poggiano su un **modello di
conoscenza a cinque livelli**:

| Livello                                          | Chi lo conosce                                                 | Esempio                                                                                          |
|--------------------------------------------------|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| 1\. **Problema tecnico reale**                   | solo il motore di simulazione                                  | il controllo trazione taglia troppo tardi e l'idraulica posteriore in estensione è troppo chiusa |
| 2\. **Dati osservati**                           | squadra (telemetria, tempi, gomme)                             | slittamento posteriore +18% nelle curve lente, temperatura gomma posteriore 112 °C               |
| 3\. **Sensazioni del pilota**                    | squadra (dal pilota)                                           | "in uscita dalle curve lente il posteriore scivola"                                              |
| 4\. **Ipotesi dello staff**                      | squadra (dagli ingegneri)                                      | "70%: gestione della coppia; 30%: sospensione posteriore"                                        |
| 5\. **Soluzione proposta → risultato effettivo** | proposta: squadra; risultato: emerge dalla sessione successiva | "TC +2" → −0,21 s nel settore 3, ma usura gomma +4%                                              |

La UI riceve **solo i livelli 2–5**. Il livello 1 non esce mai dal
motore (vedi [ADR-0003](adr/0003-knowledge-model.md)). Questo rende
possibile: errori di diagnosi, ingegneri più o meno bravi, giocatori che
imparano a leggere i dati, e IA avversarie che non barano.

------------------------------------------------------------------------

## 1. Sistema Moto A / Moto B

### 1.1 Regole

- Ogni pilota dispone di **fino a due moto** (`A` e `B`), secondo il
  regolamento della categoria: `bikesPerRider` (Premier 2; Intermediate
  e Lightweight 1 + telaio di scorta, configurabile) e `flagToFlag`
  (vero solo dove il cambio moto è ammesso).
- I limiti tecnici valgono **per pilota**, non per moto: i motori della
  dotazione stagionale sono condivisi fra A e B, così come le mescole
  assegnate per il weekend e i pacchetti omologati.
- **Un solo motore fisico.** A e B sono due istanze della stessa entità
  `Bike`: le prestazioni si ricavano con la stessa funzione
  `derivePerformance(bike, setup, conditions)` della simulazione.

### 1.2 Stato individuale di ogni moto

Componenti montati (motore, telaio, forcellone, sospensioni, freni,
elettronica, aerodinamica, cambio, accessori: serbatoio, scarico,
dispositivo abbassamento, pedane/semimanubri), chilometraggio, usura,
affidabilità attuale, danni, stato di manutenzione, assetto,
**prontezza** (0–100%) e **disponibilità** per la sessione (pronta / in
preparazione / danneggiata / non ammessa).

### 1.3 Ruoli d'uso

- **Moto A — configurazione principale**: riferimento conosciuto.
- **Moto B — configurazione sperimentale**: assetto o componenti diversi
  da provare.
- In alternativa **A asciutto / B bagnato** quando il meteo è incerto
  (vedi §8). I ruoli sono etichette decise dal manager, non vincoli: la
  B può diventare la moto principale.

### 1.4 Confronto equo fra A e B

I tempi grezzi ingannano: pista che migliora, carburante, gomme di età
diversa, temperatura, traffico. Il sistema stima la differenza
**corretta** e la sua **incertezza**:

    Δ_grezzo  = media(giri validi B) − media(giri validi A)
    Δ_corretto = Δ_grezzo − Σ_k ĉ_k            k ∈ {evoluzione pista, carburante, età gomme, T asfalto, vento}
    σ          = sqrt( σ_giro² · (1/n_A + 1/n_B) + Σ_k σ_ĉk² )

- I giri "non validi" (traffico, errori, bandiere gialle, giri di
  uscita) sono esclusi automaticamente.
- Le correzioni `ĉ_k` sono **stime**: la loro precisione cresce con
  l'abilità dell'analista di telemetria e dell'ingegnere di pista e con
  il livello del centro telemetria.
- La UI mostra ad esempio: **"B più veloce di 0,18 s ± 0,12 (confidenza
  media)"** e segnala i confronti non affidabili ("troppi pochi giri",
  "condizioni troppo diverse").
- Confronto anche per **settore**, velocità di punta, consumo gomme e
  carburante, feeling del pilota.

### 1.5 Preparazione della seconda moto

Ogni modifica richiede **ore-meccanico**. Tra una sessione e l'altra la
squadra ha un budget di tempo:

    ore_disponibili = n_meccanici · durata_pausa · efficienza(coordinamento capotecnico, morale)
    prontezza_B    += ore_assegnate / ore_richieste(lavori)

Lavori tipici: cambio assetto (0,5–2 h), cambio componente (1–4 h),
cambio motore (3–6 h), riparazione dopo caduta (variabile). Se la
prontezza è \< 100% la moto può uscire con lavori incompleti (rischio di
errori di configurazione) oppure restare ai box.

### 1.6 Cambio moto flag-to-flag

    t_cambio = t_corsia_box + t_scambio
    t_scambio = t_base(regolamento) · (1.15 − 0.3 · coordinamento_meccanici) + ritardo_errori
    P(errore) = p0 · (1 − precisione_capotecnico) · (1 + pressione) · (1 − prontezza_B)

Si considerano: personale disponibile ai box, prontezza della B, gomme
montate e loro temperatura (gomme fredde nei primi giri), assetto della
B, mappa elettronica impostata. Errori possibili: pressione gomme
errata, mappa sbagliata, ritardo nello scambio, ripartenza in corsia con
infrazione (penalità). Il giocatore decide **quando** cambiare; il
pilota può anticipare o ritardare il rientro in base a personalità e
fiducia.

------------------------------------------------------------------------

## 2. Briefing tecnico

### 2.1 Quando

Dopo ogni sessione di prove, dopo le qualifiche e prima della gara. Ogni
briefing ha un **tempo limitato** (dipende dall'intervallo prima della
sessione successiva) che si consuma con le richieste di approfondimento
e con il lavoro sulla moto.

### 2.2 Generazione delle sensazioni del pilota

1.  Il motore calcola i **problemi reali**: per ogni area (frenata,
    ingresso, centro curva, uscita lenta, uscita veloce, cambi di
    direzione, stabilità in rettilineo, velocità di punta, gestione
    gomme) uno scostamento ricavato da assetto, componenti, gomme e
    condizioni.
2.  Il pilota traduce i problemi in **sintomi** con una frase dal
    catalogo (es. "il posteriore scivola in uscita dalle curve lente").
    Precisione:
        P(sintomo corretto) = 0.45 + 0.45·FeedbackTecnico + 0.10·esperienza_pista

    Un pilota poco preciso può confondere l'area, esagerare un problema
    minore o non segnalarlo. Lo stile di guida pesa: un pilota
    "staccatore" si lamenta prima della frenata.
3.  La telemetria produce **indicatori osservati** con rumore
    (slittamento, instabilità in frenata, ondeggiamento, temperature,
    velocità di percorrenza), più precisi con centro telemetria e
    analisti migliori.

### 2.3 Diagnosi dello staff

Ogni membro (ingegnere di pista, capotecnico, eventuale analista)
produce una lista di **ipotesi** con una confidenza dichiarata.
Probabilità che la causa principale sia corretta:

    q = σ( 2.2·Diagnosi + 1.0·InterpretazioneFeedback·Comprensione_stile
           + 0.6·ln(1 + giri_analizzati/8) + 0.5·ConoscenzaPneumatici·(problema gomme)
           − difficoltà_problema + intuizione )
    intuizione ~ con probabilità p_i = 0.04 + 0.08·ProblemSolving + 0.04·CapacitàApprendimento
                 si aggiunge +1.5 (l'"idea brillante", possibile anche per un giovane)

La **confidenza dichiarata** non coincide con `q`: dipende anche dalla
personalità (un ingegnere presuntuoso è sicuro anche quando sbaglia). Il
giocatore impara col tempo quanto fidarsi di ciascuno; la scheda
ingegnere mostra lo **storico delle diagnosi** (azzeccate / sbagliate).

### 2.4 Proposte

Ogni ipotesi genera 1–3 **soluzioni** (variazioni di parametri di
assetto o di elettronica, o "raccogliere altri dati"). Ogni soluzione
mostra **vantaggi e svantaggi attesi** espressi in modo qualitativo e
con un intervallo ("guadagno stimato 0,05–0,25 s, possibile aumento
usura posteriore"). Il risultato reale si vede solo provando.

### 2.5 Decisioni del Team Principal

| Decisione                           | Effetto                                                                                                       |
|-------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Accetta il consiglio dell'ingegnere | applica la soluzione; fiducia ingegnere ↔ manager aggiornata in base al risultato                             |
| Chiedi una seconda analisi          | consuma tempo; nuova estrazione con più dati (q più alto), può confermare o ribaltare                         |
| Confronta soluzioni                 | mostra le proposte affiancate; nessun costo ma nessuna informazione nuova                                     |
| Parere del capotecnico              | ipotesi del capotecnico (più forte su meccanica e telaio)                                                     |
| Privilegia il feedback del pilota   | applica la modifica richiesta dal pilota; +fiducia/morale del pilota, efficacia legata al suo FeedbackTecnico |
| Mantieni l'assetto                  | nessun rischio; perdi tempo di sviluppo; +dati per il prossimo briefing                                       |
| Sperimenta sulla Moto B             | la soluzione va sulla B, la A resta di riferimento (richiede prontezza della B)                               |

Conseguenze reali: qualità dell'assetto (`Q_setup`), fiducia del pilota
nella moto, rapporti (ignorare spesso il pilota → −fiducia; seguire un
consiglio sbagliato → −fiducia verso l'ingegnere), tempo residuo,
crescita professionale dello staff (§4).

### 2.6 Delega

Il manager può delegare ogni briefing al capotecnico o al direttore
tecnico. La qualità delle scelte dipende dalle loro abilità; il
risultato viene riassunto nella posta.

------------------------------------------------------------------------

## 3. Personale tecnico e mercato degli ingegneri

### 3.1 Dati comuni

Nome, cognome, nazionalità, età, esperienza (anni e sessioni),
reputazione, stipendio, contratto, specializzazione, potenziale
(nascosto), personalità, morale, fedeltà, ambizione, compatibilità con
ciascun pilota (calcolata, §5).

### 3.2 Attributi per ruolo (1–100)

**Ingegnere di pista**: analisi telemetrica, interpretazione del
feedback, capacità diagnostica, conoscenza assetti, gestione strategie,
conoscenza pneumatici, adattamento al meteo, comunicazione con il
pilota, gestione della pressione, problem solving, capacità di
apprendimento.

**Capotecnico**: conoscenza meccanica, preparazione moto, configurazione
sospensioni, configurazione telaio, interpretazione del feedback,
coordinamento meccanici, gestione del tempo, affidabilità operativa,
precisione, problem solving.

**Specialisti** (motore, elettronica, telaio, aerodinamica, telemetria):
attributi tecnici della propria area (es. elettronica: mappature motore,
controllo trazione, freno motore, strategie energetiche, integrazione
sensori) + attributi trasversali (problem solving, apprendimento, lavoro
di squadra). Fuori dalla specializzazione i valori sono tipicamente
bassi.

**Direttore tecnico**: visione tecnica, gestione progetti R&D,
leadership, allocazione risorse, conoscenza regolamento, valutazione del
personale.

### 3.3 Scouting del personale

Uguale nello spirito allo scouting dei piloti: si assegnano osservatori
o si chiedono referenze; gli attributi appaiono come **intervalli** che
si restringono con il tempo di osservazione e con il livello di chi
osserva. Filtri: ruolo, specializzazione, età, stipendio richiesto,
disponibilità, lingua/nazionalità, compatibilità stimata con i propri
piloti.

### 3.4 Profili presenti nel mondo

Giovani emergenti (alto potenziale, poca esperienza), esperti,
specialisti di motori, elettronica, telaio, telemetria, ingegneri di
pista, capotecnici, direttori tecnici. Il generatore del mondo assicura
per ogni categoria una distribuzione realistica e un ricambio annuale
(laureati, ingegneri dalle serie minori, ritiri).

### 3.5 Contratti e mercato

Stesso sistema di negoziazione dei piloti (offerta, controfferta,
scadenze, clausole, bonus, offerte concorrenti, rumors). Clausole
specifiche: **ruolo garantito** (es. capotecnico di un pilota titolare),
**pilota assegnato**, divieto di passare a un rivale per N mesi
(gardening leave), budget di formazione.

------------------------------------------------------------------------

## 4. Crescita professionale

### 4.1 Competenze vs reputazione

Sono **due canali separati**:

- **Competenze** crescono con il lavoro svolto.
- **Reputazione, valore di mercato, richieste economiche, fiducia in se
  stessi** crescono con i risultati sportivi (vittorie, podi, titoli).
  Un ingegnere che vince grazie a un pilota eccezionale diventa più
  richiesto, non automaticamente più bravo.

### 4.2 Esperienza che fa crescere

    Δattributo = Σ eventi · peso_evento · rilevanza(attributo, evento) · f_età · f_potenziale · (1 + 0.4·Apprendimento)
    f_potenziale = max(0, (potenziale − valore) / potenziale)^0.7         // rallenta vicino al limite
    f_età: curva per "tipo di carriera": precoce / regolare / tardivo

Eventi: sessioni analizzate, diagnosi corrette (peso alto) e sbagliate
(peso basso ma non nullo: si impara dagli errori), problemi risolti,
collaborazione con piloti dal buon feedback, corsi di formazione,
affiancamento a colleghi più esperti (mentoring: +x% se un collega
supera di 15+ punti l'attributo), risultati dei progetti R&D,
specializzazione (crescita più rapida nella propria area).

### 4.3 Potenziale

Tetto individuale nascosto + tipo di curva: alcuni crescono in fretta e
si fermano presto, altri diventano grandi specialisti dopo molti anni.
Con l'età avanzata gli attributi fisici/di pressione calano lievemente,
quelli di conoscenza restano stabili.

------------------------------------------------------------------------

## 5. Rapporto pilota – ingegnere di pista – capotecnico

### 5.1 Valori per ogni coppia pilota-membro dello staff

Fiducia, comunicazione, compatibilità (in gran parte strutturale:
personalità, lingua, stile), esperienza condivisa (sessioni insieme),
comprensione dello stile di guida, soddisfazione lavorativa.

### 5.2 Effetti

    precisione_interpretazione = base(InterpretazioneFeedback) · (0.65 + 0.35·Comprensione_stile)
    Comprensione_stile(t) = c0 + (1 − c0)·(1 − e^(−sessioni/τ))     c0 = 0.35 + 0.25·compatibilità

`c0` garantisce che una coppia nuova possa lavorare bene fin da subito
(non parte da zero); il tempo e la compatibilità la rendono eccellente.

### 5.3 Conflitti

Generati da: divergenze ripetute sugli assetti, risultati negativi dopo
consigli dello staff, errori di comunicazione, preferenze personali,
rivalità interne. Sviluppo: avviso → insoddisfazione → richiesta di
sostituzione (dal pilota) o di trasferimento (dall'ingegnere).

### 5.4 Interventi del manager

Colloquio di mediazione (esito dipende da personalità e reputazione del
manager), ridefinizione dei ruoli, attività di squadra, bonus,
riassegnazione, formazione sulla comunicazione.

------------------------------------------------------------------------

## 6. Gestione dello staff in carriera

Licenziare (con costo di rescissione e impatto sul morale di chi resta),
ingaggiare, promuovere un tecnico interno (es. analista → ingegnere di
pista: periodo di adattamento), spostare un ingegnere da un pilota
all'altro (la comprensione dello stile riparte da `c0`, la fiducia resta
in parte), rinnovare, offrire bonus, finanziare corsi di formazione
(costo, durata, attributo mirato). Le squadre rivali fanno offerte ai
migliori; un pilota può chiedere un tecnico specifico (anche portarlo
con sé quando cambia squadra); un ingegnere può andarsene per un ruolo
più importante.

------------------------------------------------------------------------

## 7. Sviluppo dell'assetto nel weekend

    Assetto base  ← libreria della squadra (anno precedente sullo stesso circuito) + centro simulazione
       FP1 ──► briefing 1 ──► modifiche (A e/o B)
       PR  ──► briefing 2 ──► modifiche + confronto A/B corretto per le condizioni
       FP2 ──► briefing 3 ──► scelta configurazione per qualifica
       Q   ──► analisi post-qualifica ──► preparazione gara entro i limiti del regolamento
       WUP ──► briefing finale pre-gara
       GARA

**Briefing finale pre-gara**: strategia, gomme (anteriore/posteriore),
gestione carburante, scenari di pioggia, assetto finale consentito,
piano di emergenza (es. "se piove prima del giro 10: cambio moto; dopo
il giro 20: restare fuori"). Le istruzioni vengono convertite in **pit
board** e messaggi consentiti dal regolamento. Ogni assetto riuscito
viene salvato nella **libreria assetti** per gli anni successivi.

Il regolamento indica se dopo le qualifiche le modifiche sono libere o
limitate (`setupChangesAfterQuali`).

------------------------------------------------------------------------

## 8. Briefing e meteo

- Le previsioni sono **probabilistiche** e migliorano avvicinandosi
  all'evento (e con un buon responsabile strategia o ingegnere con
  "adattamento al meteo" alto).
- In ogni briefing il manager stabilisce il **programma della sessione
  successiva**, ripartendo i giri fra: sviluppo asciutto, simulazione
  gara, test gomme, prova della Moto B, raccolta dati in condizioni
  miste.
- **Dati da bagnato utilizzabili davvero**: si ottengono solo se una
  sessione è (almeno in parte) bagnata. Se è asciutto, la preparazione
  al bagnato passa da: assetto base da libreria, centro di simulazione,
  mappe elettroniche dedicate, e **ore-meccanico** spese per preparare
  la Moto B in configurazione bagnato. È tempo sottratto allo sviluppo
  dell'asciutto: il rischio è sprecarlo se la pioggia non arriva.
- L'ingegnere può suggerire: assetto alternativo, strategia gomme,
  preparazione Moto B, modifiche elettroniche, priorità delle prove.

------------------------------------------------------------------------

## 9. Intelligenza artificiale

Le squadre IA usano **gli stessi sistemi e lo stesso livello di
informazione** del giocatore: due moto per pilota, staff con attributi
reali, briefing con ipotesi generate dai loro ingegneri (senza accesso
alla verità), scelte fatte dal loro direttore tecnico/capotecnico
secondo il profilo della squadra (prudente, sperimentale…), preparazione
alla pioggia in base alle loro previsioni, mercato e formazione del
personale. Per rendere veloce la simulazione delle sessioni non
visibili, il briefing IA viene risolto in forma compatta (stesse
probabilità, nessun testo generato).

------------------------------------------------------------------------

## 10. Collocazione nella roadmap (sintesi)

| Livello                   | Contenuto                                                                                                                                                                                                                                    |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **MVP (v0.1, Fase 2)**    | 1 ingegnere di pista + 1 capotecnico per pilota, attributi di base, feedback dopo le prove (sintomi), proposte semplici di assetto (1–2 opzioni), modello verità/osservazioni già attivo, **una sola moto** (lo schema dati prevede già A/B) |
| **Intermedio (Fasi 3–4)** | mercato completo ingegneri, contratti, scouting staff, crescita, compatibilità, briefing interattivi completi, due moto per pilota, confronto A/B corretto                                                                                   |
| **Avanzato (Fasi 4–5)**   | diagnosi approfondite, telemetria avanzata, errori di interpretazione e confidenza "falsata", formazione specialistica, relazioni e conflitti complessi, preparazione A/B per condizioni diverse, flag-to-flag completamente simulato        |

Dettagli e dipendenze in [ROADMAP.md](ROADMAP.md).

# Architettura tecnica

> Stato: **PROPOSTA — in attesa di approvazione** (Fase 0). Nessun
> modulo di gioco è ancora implementato.

## 1. Analisi del repository (1 novembre 2026)

| Verifica                                  | Esito                                                              |
|-------------------------------------------|--------------------------------------------------------------------|
| Repository                                | `romeoliva93/motorcycle-manager` (privato)                         |
| Branch                                    | `main` (unico), commit `57880d3` "Initial commit"                  |
| File presenti                             | solo `README.md` (titolo)                                          |
| Tecnologie già in uso                     | nessuna                                                            |
| Modifiche non salvate / PR aperte         | nessuna                                                            |
| Toolchain disponibile nell'ambiente cloud | Node.js 22, npm 10, Rust/Cargo, Python 3.13, Chromium + Playwright |

Il progetto parte quindi da zero: la scelta tecnologica non è vincolata
da codice esistente.

## 2. Valutazione delle tecnologie

Il gioco è un **manageriale**: il 90% del tempo il giocatore legge
tabelle, grafici, schede e prende decisioni; il restante 10% guarda una
simulazione 2D (in futuro 3D). Il cuore tecnico è una **simulazione
deterministica** che deve essere testabile senza interfaccia.

| Criterio (peso)                                        | Godot 4                                                       | Unity 6                                     | Unreal 5                               | **TypeScript + React + Tauri**                                     |
|--------------------------------------------------------|---------------------------------------------------------------|---------------------------------------------|----------------------------------------|--------------------------------------------------------------------|
| UI densa di dati: tabelle, grafici, filtri, 4K (alto)  | Discreta (Control node, tabelle e grafici da scrivere a mano) | Discreta (UI Toolkit)                       | Scarsa per UI gestionali (UMG pesante) | **Eccellente** (CSS Grid, tipografia, virtualizzazione, SVG)       |
| Testabilità della simulazione headless (alto)          | Buona (GUT / C#)                                              | Buona (NUnit, ma richiede editor/batchmode) | Media (C++ automation)                 | **Eccellente** (Vitest, millisecondi, CI semplice)                 |
| Modularità / manutenibilità (alto)                     | Buona                                                         | Buona                                       | Media                                  | **Eccellente** (workspace npm, pacchetti tipizzati)                |
| Prestazioni simulazione (medio)                        | Buone                                                         | Ottime                                      | Ottime                                 | Buone (V8 JIT + Web Worker; ampiamente sufficienti per 22–34 moto) |
| Futuro 3D, replay, telecamere (medio)                  | Buono                                                         | Ottimo                                      | Ottimo                                 | Discreto (Three.js / Babylon.js, stile non fotorealistico)         |
| Costi e licenze (alto)                                 | Gratis (MIT)                                                  | Piani a pagamento sopra soglie              | 5% royalty oltre 1 M\$                 | **Gratis** (MIT/Apache)                                            |
| Distribuzione PC (alto)                                | Win/Mac/Linux                                                 | Win/Mac/Linux                               | Win/Mac/Linux                          | Win/Mac/Linux, installer ~10–15 MB, compatibile Steam              |
| Sviluppo in ambiente cloud senza editor grafico (alto) | Limitato                                                      | Molto limitato                              | Molto limitato                         | **Completo** (build, test e screenshot via CLI/Playwright)         |

### Raccomandazione

**Stack web/desktop in TypeScript**:

- **TypeScript (strict)** per tutto il codice di gioco.
- **Simulazione e logica di gioco in pacchetti puri** (nessuna
  dipendenza da DOM o UI), eseguiti in un **Web Worker**.
- **React + Vite** per l'interfaccia.
- **Canvas 2D** per la vista di gara dall'alto, dietro un'interfaccia
  `RaceRenderer` intercambiabile.
- **Tauri 2** come contenitore desktop (Windows/macOS/Linux). Più
  leggero di Electron, usa la WebView di sistema e un backend Rust
  minimo per filesystem e salvataggi.
- **Vitest** per i test, **ESLint + Prettier** per la qualità del
  codice.

Rischio principale: la qualità 3D in Fase 6. Mitigazione: la simulazione
produce un **flusso di frame neutrale rispetto al motore** (posizione
lungo pista, offset laterale, angolo di piega, velocità, eventi). Un
renderer Three.js/Babylon.js può consumarlo direttamente; se in futuro
servisse un 3D di alto livello, lo stesso formato di replay può essere
letto da un visualizzatore Godot/Unity separato senza riscrivere la
simulazione.

Decisione formalizzata in [ADR-0001](adr/0001-tech-stack.md).

## 3. Principi architetturali

1.  **La simulazione è separata dall'interfaccia.** I pacchetti `core`,
    `sim`, `game` non importano React né API del browser.
2.  **Il giocatore e l'IA usano gli stessi comandi.** Ogni azione è un
    `Command` validato dal motore (`SignContract`, `StartRnDProject`,
    `SetPitBoard`…). La UI può mostrare solo i comandi che il motore
    dichiara disponibili, così non esistono pulsanti finti.
3.  **Determinismo.** Tutta la casualità passa da un PRNG con seme
    (`sfc32`), diviso in flussi per sottosistema (meteo, gara,
    mercato…). Con lo stesso seme e gli stessi comandi si ottiene lo
    stesso risultato: replay, riproduzione dei bug e test affidabili.
    Non esistono risultati prestabiliti.
4.  **Stato normalizzato.** Lo stato di gioco è un database relazionale
    in memoria (tabelle `Record<Id, Entity>` con chiavi esterne),
    serializzabile e versionato.
5.  **Eventi di dominio.** I sistemi emettono eventi (`RaceFinished`,
    `ContractSigned`, `ComponentFailed`…) consumati da notizie,
    statistiche, morale, archivio e sponsor. In questo modo i sistemi
    restano disaccoppiati.
6.  **Sistemi piccoli e testabili.** Ogni sistema è un modulo con
    input/output espliciti: `(state, ctx) => events`. Niente classi "God
    object".
7.  **Dati di contenuto separati dal codice.** Circuiti, costruttori,
    nomi, sponsor e regolamenti sono *content pack* JSON validati da
    script, quindi modificabili e moddabili.
8.  **Conoscenza separata dalla verità.** Lo stato reale (problemi di
    assetto, potenziale, meteo futuro) resta nel motore; UI e IA
    gestionale leggono solo osservazioni, sensazioni e ipotesi tramite
    `KnowledgeView(teamId)` ([ADR-0003](adr/0003-knowledge-model.md)).
9.  **Formule documentate.** Ogni formula di simulazione ha un
    riferimento in [SIMULATION.md](SIMULATION.md) e un test che ne fissa
    il comportamento.

## 4. Architettura a livelli

    ┌───────────────────────────────────────────────────────────────────┐
    │ apps/desktop (Tauri)   – finestra, filesystem, salvataggi su disco │
    ├───────────────────────────────────────────────────────────────────┤
    │ apps/client (React)    – design system, schermate, renderer 2D     │
    │        │  comandi ▼            ▲ snapshot / query / eventi          │
    ├────────┼──────────────────────┼───────────────────────────────────┤
    │ packages/engine-host   – Web Worker, RPC tipizzato, loop temporale │
    ├───────────────────────────────────────────────────────────────────┤
    │ packages/game   – carriera, calendario, economia, mercato, staff,  │
    │                   R&D, strutture, sponsor, media, IA, regolamenti  │
    │ packages/sim    – weekend, sessioni, gara, gomme, meteo, setup,    │
    │                   telemetria, incidenti (motore deterministico)    │
    │ packages/data   – schema entità, generatore del mondo, content pack│
    │ packages/persistence – serializzazione, migrazioni, adapter storage│
    ├───────────────────────────────────────────────────────────────────┤
    │ packages/core   – ID, PRNG, matematica, tempo di gioco, eventi,    │
    │                   Result/Errori, utilità di validazione            │
    └───────────────────────────────────────────────────────────────────┘

Regola delle dipendenze: un pacchetto può dipendere solo da quelli
**sotto** di lui. `sim` non dipende da `game`; `game` usa `sim` per far
correre i weekend. La regola è verificata in CI con un controllo dei
confini degli import (ESLint `no-restricted-imports`).

### Flusso di un'azione

    UI (click "Firma contratto")
      → engineClient.dispatch({ type: 'SignContract', … })      [main thread]
      → Worker: validate(command, state) → apply → events[]     [engine-host]
      → sistemi reattivi (morale, news, finanze) consumano eventi
      → Worker invia { stateVersion, changedTables, events }
      → UI aggiorna solo le viste interessate (selettori memoizzati)

### Flusso di una gara

    sim.RaceSession(seed, grid, track, weather, strategies)
      step(dt) ×N  →  RaceFrame (ring buffer)  → RaceRenderer2D (interpolazione 60 fps)
                   →  TelemetrySample[]        → grafici telemetria
                   →  RaceEvent[]              → feed, regia, penalità, news
    Velocità 1×/2×/4×/8×/16×: cambia quanti step il worker calcola per secondo reale.
    Pausa: il worker sospende il loop; i comandi (pit board, mappa) restano accodabili.

## 5. Organizzazione delle cartelle

    motorcycle-manager/
    ├── apps/
    │   ├── client/                 # UI React (gira anche nel browser in sviluppo)
    │   │   ├── src/
    │   │   │   ├── design-system/  # token, tipografia, componenti base (Button, Table, Card, Chart…)
    │   │   │   ├── layout/         # shell: sidebar, top bar, routing interno
    │   │   │   ├── screens/        # una cartella per menu: overview/, team/, riders/, staff/, bike/,
    │   │   │   │                   #   development/, facilities/, academy/, market/, sponsors/,
    │   │   │   │                   #   finance/, calendar/, championship/, stats/, news/, archive/,
    │   │   │   │                   #   main-menu/, new-career/, race-weekend/
    │   │   │   ├── race-view/      # RaceRenderer2D (Canvas), camera 2D, overlay
    │   │   │   ├── engine-client/  # proxy tipizzato verso il worker
    │   │   │   └── i18n/           # it (default), en
    │   │   └── tests/              # test componenti + e2e Playwright
    │   └── desktop/                # Tauri: src-tauri/ (Rust minimale), configurazione bundle
    ├── packages/
    │   ├── core/                   # rng/, ids/, math/, time/, events/, result/
    │   ├── data/                   # schema/, worldgen/, content/ (JSON), validators/
    │   ├── sim/                    # track/, bike/, rider/, tyres/, weather/, setup/,
    │   │                           #   race/, quali/, practice/, telemetry/, incidents/
    │   ├── game/                   # career/, calendar/, economy/, contracts/, market/, staff/,
    │   │                           #   briefing/, garage/ (Moto A/B, lavori, prontezza), knowledge/,
    │   │                           #   riders/, academy/, rnd/, facilities/, sponsors/, media/,
    │   │                           #   regulations/, ai/, stats/, commands/
    │   ├── engine-host/            # worker entry, scheduler, protocollo RPC
    │   └── persistence/            # save format, migrazioni, adapter (IndexedDB, Tauri FS)
    ├── tools/
    │   ├── balance/                # simulazioni headless di massa (es. 1000 stagioni) e report
    │   ├── content-check/          # validazione content pack e controllo nomi reali
    │   └── sim-cli/                # esegue una gara da terminale (debug, regressioni)
    ├── docs/                       # GDD, architettura, modello dati, roadmap, UI, ADR, mockup
    ├── .github/workflows/          # CI: lint, typecheck, test, build
    ├── package.json                # workspace npm
    └── tsconfig.base.json

## 6. Dipendenze previste (minime)

| Ambito     | Libreria                                         | Motivo                        |
|------------|--------------------------------------------------|-------------------------------|
| UI         | `react`, `react-dom`                             | framework UI                  |
| Build      | `vite`, `typescript`                             | bundling e tipi               |
| Test       | `vitest`, `@playwright/test` (già nell'ambiente) | unit/integration ed e2e       |
| Qualità    | `eslint`, `prettier`                             | stile e confini dei pacchetti |
| Desktop    | `@tauri-apps/cli`, `@tauri-apps/api`             | shell desktop e filesystem    |
| Salvataggi | `fflate` (~8 KB)                                 | compressione salvataggi       |

Volutamente **non** previsti: state manager esterni (usiamo
`useSyncExternalStore` sul client del motore), librerie di grafici (i
grafici di telemetria sono componenti SVG/Canvas interni, ottimizzati
per i nostri dati), ORM o database server. Ogni nuova dipendenza
richiede un ADR.

## 7. Persistenza e "database"

Il "database" del gioco ha tre livelli:

1.  **Content database** (`packages/data/content`): dati di partenza
    originali (costruttori, circuiti, sponsor, pool di nomi per
    nazionalità, regolamenti iniziali), in JSON validato.

2.  **Game state**: database relazionale in memoria, generato dal
    content database con un seme e poi fatto evolvere dalla simulazione
    (vedi [DATA_MODEL.md](DATA_MODEL.md)).

3.  **Salvataggi**: per ogni slot una cartella con

    - `meta.json` (nome carriera, squadra, data di gioco, versione
      schema, anteprima);
    - `state.json.gz` (stato corrente compresso);
    - `archive/season-YYYY.json.gz` (storico delle stagioni concluse,
      caricato su richiesta).

    Salvataggio manuale, autosalvataggio (inizio weekend, fine gara,
    fine stagione) a rotazione e slot multipli. Ogni salvataggio
    contiene `schemaVersion`; i caricamenti passano dalle **migrazioni**
    in `persistence/migrations`.

SQLite è stato valutato e rimandato: lo stato deve comunque vivere
interamente in memoria per essere simulato, e la mappatura
oggetti/tabelle aggiungerebbe complessità. Se l'archivio pluriennale
superasse dimensioni gestibili (\>50 MB per carriera), si introdurrà
SQLite solo per l'archivio statistico (vedi
[ADR-0002](adr/0002-state-and-persistence.md)).

## 8. Qualità e processo

- **TypeScript `strict`**, nessun `any` implicito.
- **Test**: unit per formule e sistemi; property test per invarianti
  (es. somma punti = punti assegnati, bilancio = somma transazioni);
  **golden test** di gara (seme fisso → classifica attesa) per
  intercettare regressioni; **test statistici** di bilanciamento in
  `tools/balance`.
- **CI GitHub Actions**: lint, typecheck, test, build per ogni PR.
- **Branch**: un branch per milestone, PR verso `main`, nessun merge
  senza approvazione.
- **Feature flag**: le voci di menu dei sistemi non ancora sviluppati
  sono nascoste o mostrate come "In sviluppo" e disabilitate, mai finte.
- **Prestazioni**: obiettivo di 16× in gara con 34 moto a \< 4 ms per
  frame nel worker; avanzamento di una giornata di gioco \< 50 ms.
- **Scala UI**: layout in `rem` con scala radice legata alla risoluzione
  (1080p = 100%, 1440p = 125%, 4K = 200%), testato con screenshot
  Playwright.

# Modello dati

> Stato: **PROPOSTA**. Le interfacce sono indicative e verranno tradotte
> in tipi TypeScript in `packages/data/schema` durante la Fase 1.

## 1. Convenzioni

- **ID** stringhe con prefisso e progressivo: `rdr_000123` (pilota),
  `stf_…` (personale), `tem_…` (squadra), `mfr_…` (costruttore), `cir_…`
  (circuito), `ctr_…` (contratto)…
- **Date di gioco**: interi "giorni dal 1° gennaio dell'anno 0 della
  carriera" (`GameDay`), convertiti in data per la UI. Evita fusi orari
  e problemi di serializzazione.
- **Denaro**: interi in unità intere della valuta di gioco ("crediti",
  simbolo `₡`), mai float.
- **Attributi**: interi 1–100 visibili; internamente float 0–1 per la
  simulazione. Gli attributi "nascosti" (potenziale reale, ideale di
  assetto) non sono mai inviati alla UI senza passare dal filtro di
  conoscenza dello scouting.
- **Tabelle**: `GameState.tables.<nome>: Record<Id, Entity>`; le
  relazioni usano ID, mai oggetti annidati.
- **Storico**: le entità correnti hanno solo lo stato attuale; i
  cambiamenti significativi generano eventi e righe in tabelle di
  storico/archivio.

## 2. Diagramma (sintesi)

    Federation ─┬─ Regulation(season, category) ── RegulationProposal ── Vote
                └─ Category ── Season ── Round(Event) ── Session ── SessionResult
                                   │           └─ Circuit ── TrackLayout
                                   └─ Standing (riders / teams / constructors)

    Manufacturer ─ supplies ─► Team ◄─ Contract ─► Person (Rider | StaffMember)
                               │  ├─ StaffAssignment (pilota ↔ capotecnico/ingegnere) ─ RiderStaffBond
                               │  ├─ Bike A / Bike B per pilota ─ SetupSheet ─ SetupLibraryEntry
                               │  └─ Briefing ─ RiderFeedback / StaffHypothesis / SetupProposal / ABComparison
         │                     │  ├─ Facility[]        │
         │                     │  ├─ Bike ─ Component[] ─ ComponentDesign ◄─ RnDProject
         │                     │  ├─ FinanceAccount ─ Transaction[] / Loan[]
         │                     │  ├─ SponsorDeal ─ Sponsor
         │                     │  └─ Academy ─ AcademyRider / Instructor
         └─ Supplier (gomme, carburante, elettronica)

    Person ─ Relationship (compatibilità, rivalità, fedeltà) ─ Person/Team
    Event log ─► NewsItem / Rumour / PressConference ; Stats ; Records ; SeasonArchive

## 3. Entità principali

### Mondo e competizione

``` ts
GameMeta      { saveName, seed, schemaVersion, currentDay, playerTeamId, difficulty,
                options: { units, simDetail, autosave } }
Federation    { id, name, acronym, presidentId, politicalBalance }
Category      { id, tier: 'lightweight'|'intermediate'|'premier'|'feeder', name,
                engineRules, ageLimits, maxGrid }
Regulation    { id, categoryId, season, points: number[], sprintPoints: number[],
                weekendFormat: SessionSpec[], engineAllocation, tyreAllocation,
                minWeight, fuelCapacity, techLimits, devFreezes, concessions,
                radioPolicy: 'none'|'dashboard'|'full', penaltiesTable, budgetCap? }
RegulationProposal { id, proposedBy, change, voteDeadline, votes: Record<Id,'yes'|'no'|'abstain'>, status }
Season        { id, year, categoryId, roundIds[], status, championRiderId?, championTeamId? }
Round         { id, seasonId, circuitId, startDay, sessionIds[], pressConferenceId? }
SessionSpec   { type: 'FP'|'PR'|'Q1'|'Q2'|'SPRINT'|'WUP'|'RACE', duration|laps, rules }
Session       { id, roundId, spec, weatherTimeline, status, resultId?, seed }
SessionResult { id, sessionId, rows: { riderId, position, time, gap, laps, bestLap,
                status: 'finished'|'dnf'|'dns'|'dsq', points, penalties[] }[] }
Standing      { seasonId, kind: 'rider'|'team'|'constructor', rows: { refId, points, wins, podiums }[] }
Circuit       { id, name, country, length, layoutId, abrasiveness, overtakingIndex,
                climate: { tempProfile, rainProbabilityByMonth, wind }, characteristics }
TrackLayout   { id, centerline: [x,y][], profile: TrackSample[], sectors, pitLane }
```

### Persone

``` ts
Person        { id, firstName, lastName, nationality, birthDay, reputation, morale,
                personality: { ambition, loyalty, temperament, professionalism, mediaSavvy },
                contractId?, status: 'active'|'free'|'retired'|'injured', history[] }

Rider extends Person {
  number, category, ridingStyle,
  attributes: { speed, racePace, braking, acceleration, cornerEntry, overtaking, defending,
                tyreManagement, fuelManagement, wet, consistency, aggression, concentration,
                technicalFeedback, adaptability, fitness, mentalStrength },
  potential (nascosto), growthCurve, form (−1..1), fatigue, injuries: Injury[],
  setupPreferences, crewChiefId?, trackEngineerId?, role: 'race'|'test'|'reserve'|'academy',
  careerStats, seasonStats
}
Injury        { type, bodyPart, startDay, expectedReturnDay, severity, fitToRideRisk }

StaffMember extends Person {
  role: 'technicalDirector'|'crewChief'|'trackEngineer'|'engineEngineer'|'electronicsEngineer'|
        'chassisEngineer'|'aeroEngineer'|'strategyChief'|'telemetryAnalyst'|'mechanic'|
        'productionManager'|'sportingDirector'|'athleticTrainer'|'physio'|'talentScout'|
        'sponsorManager'|'financeManager'|'logisticsManager'|'academyInstructor',
  skills: Record<RoleSkill, number>, experience, potential, assignedRiderId?
}
Relationship  { aId, bId, compatibility (−100..100), rivalry (0..100), trust, lastChangeDay }

// --- Squadra tecnica (revisione Fase 0, vedi TECH_TEAM.md) ---
StaffMember (campi aggiuntivi) {
  specialization: 'engine'|'electronics'|'chassis'|'aero'|'telemetry'|'trackside'|'mechanics'|'management',
  attributes: Record<StaffAttribute, number>,     // set dipendente dal ruolo (TECH_TEAM §3.2)
  potentialCeiling (nascosto), careerCurve: 'early'|'regular'|'late',
  ambition, loyalty, confidence, marketValue,
  experienceLog: { sessionsAnalyzed, diagnosesCorrect, diagnosesWrong, problemsSolved, trainingsDone },
  diagnosisHistory: Id[]                          // StaffHypothesis valutate (visibili al giocatore)
}
RiderStaffBond { riderId, staffId, trust, communication, compatibility, sharedSessions,
                 styleUnderstanding, satisfaction, conflictLevel, lastEventDay }
StaffAssignment { teamId, riderId, crewChiefId, trackEngineerId, analystId?, mechanicIds[], fromDay }
TrainingCourse  { id, staffId, targetAttributes[], cost, startDay, endDay, provider }
StaffScoutReport{ id, staffId, observerId, day, attributeRanges: Record<StaffAttribute,[min,max]>, notes }
```

### Organizzazioni

``` ts
Manufacturer  { id, name, country, engineeringStrength, budget, philosophy,
                concessionsRank, suppliedTeamIds[], partnershipContracts[] }
Team          { id, name, shortName, nationality, baseCity, type:
                'private'|'independent'|'satellite'|'factory'|'newManufacturer',
                categoryIds[], manufacturerId, colors, livery, logo, raceNumbers[],
                reputation, boardObjectives[], history: TeamSeasonRecord[], aiProfile? }
Supplier      { id, kind: 'tyres'|'fuel'|'electronics'|'brakes'|'suspension', name, quality, cost }
Sponsor       { id, name, industry, country, budgetRange, reputationRequired, expectations,
                riskAppetite, exclusivityGroup }
Academy       { id, teamId, level, instructorIds[], riderIds[], programs[], budget }
```

### Tecnica

``` ts
Bike          { id, teamId, riderId, slot: 'A'|'B', label: 'reference'|'experimental'|'dry'|'wet'|'spare',
                categoryId, season, components: Record<Slot, ComponentId>,   // Slot include 'accessories'
                setupId, mileageKm, wear, reliabilityNow, damage: Damage[], maintenance: MaintenanceState,
                readiness (0..1), availability: 'ready'|'preparing'|'damaged'|'notAllowed' }
EngineAllocation { riderId, season, allowed, usedEngineIds[] }   // condivisa fra Moto A e B
Damage          { componentId, severity, repairHours, cause, day }
MaintenanceState{ hoursSinceService, pendingJobs: Job[] }
Job             { id, bikeId, kind: 'setup'|'component'|'engine'|'repair'|'service', hoursRequired, hoursDone, assignedMechanicIds[] }
Component     { id, slot, designId, serial, mileageKm, condition, status: 'available'|'fitted'|'broken'|'sealed' }
ComponentDesign { id, ownerId (team|manufacturer), slot, version, stats: Record<Stat, number>,
                  reliability, weight, unitCost, homologated, seasonIntroduced }
RnDProject    { id, teamId, slot, approach: 'conservative'|'balanced'|'aggressive'|'experimental',
                budget, engineerIds[], startDay, expectedEndDay, progress, risk,
                targetStats, status: 'design'|'production'|'testing'|'done'|'failed'|'cancelled' }
Facility      { id, teamId, type, level, upgrade?: { targetLevel, endDay, cost }, upkeepPerMonth }
SetupSheet    { id, riderId, bikeId?, circuitId, conditions: 'dry'|'wet'|'mixed', values: Record<SetupParam, number>,
                notes, origin: 'library'|'briefing'|'rider'|'simulator', parentId? }
SetupLibraryEntry { teamId, circuitId, conditions, setupId, season, rating }

// --- Briefing e conoscenza (ADR-0003). I tipi Truth* restano nel motore. ---
TruthSetupIssue   (solo sim) { bikeId, area, cause: SetupParam[], magnitude }
SessionRunPlan    { sessionId, riderId, items: { goal: 'dryDev'|'raceSim'|'tyreTest'|'bikeB'|'wetData', laps }[] }
Observation       { id, sessionId, bikeId, kind: TelemetryIndicator, value, noise, laps }
RiderFeedback     { id, sessionId, riderId, bikeId, symptoms: { area, phraseKey, severity }[], satisfaction }
StaffHypothesis   { id, briefingId, staffId, area, suspectedCauses: SetupParam[], declaredConfidence,
                    outcome?: 'correct'|'partial'|'wrong' }   // outcome calcolato dopo la prova
SetupProposal     { id, hypothesisId, changes: Partial<Record<SetupParam, number>>, expectedGain: [min,max],
                    expectedDrawbacks: string[], targetBike: 'A'|'B' }
Briefing          { id, sessionId, riderId, kind: 'post'|'postQuali'|'preRace', timeBudgetMin, timeUsedMin,
                    feedbackId, hypothesisIds[], proposalIds[], decision?: BriefingDecision, delegatedTo? }
BriefingDecision  { type: 'accept'|'secondOpinion'|'compare'|'askCrewChief'|'riderFirst'|'keep'|'experimentB',
                    proposalId?, day }
ABComparison      { id, sessionId, riderId, deltaRaw, corrections: Record<string, number>, deltaCorrected,
                    sigma, validLapsA, validLapsB, reliability: 'low'|'medium'|'high' }
RacePlan          { riderId, roundId, tyres, fuelMode, paceTargets, rainScenarios: { condition, action }[],
                    contingency: string[], pitBoardScript[] }
```

### Contratti, mercato, economia

``` ts
Contract      { id, kind: 'rider'|'staff'|'sponsor'|'supply'|'manufacturer'|'academy'|'loan',
                employerId, counterpartyId, startDay, endDay, salaryPerYear,
                bonuses: { condition, amount }[], clauses: Clause[], options: RenewalOption[],
                role, objectives[], status }
Clause        { type: 'release'|'performanceExit'|'buyout'|'promotion'|'noCompete'|'mediaDuties', params }
Negotiation   { id, subjectId, partyIds[], offers: Offer[], deadlineDay, status, rumourLevel }
Offer         { fromId, terms: Partial<Contract>, day, response?: 'accept'|'reject'|'counter' }
FinanceAccount{ teamId, balance, creditLimit, loans: Loan[] }
Transaction   { id, teamId, day, amount, category: IncomeCategory|ExpenseCategory, refId?, note }
Loan          { id, lender, principal, rate, startDay, termMonths, remaining }
SponsorDeal   { id, sponsorId, teamId, contractId, placement, valuePerYear,
                objectives[], satisfaction, activitiesDone[] }
```

### Media, storico, statistiche

``` ts
DomainEvent   { id, day, type, payload }            // log degli eventi di dominio
NewsItem      { id, day, headline, body, tags[], refs[], importance, sourceEventIds[] }
Rumour        { id, day, subjectId, claim, reliability, revealedTruth? }
PressConference { id, roundId, questions: { text, options: Answer[] }[], effects }
RecordEntry   { kind, categoryId, holderId, value, day }
SeasonArchive { seasonId, finalStandings, rounds summary, champions, awards, transfers }
CareerStats   { starts, wins, podiums, poles, fastestLaps, points, dnfs, titles, perSeason[] }
```

## 4. Conoscenza e nebbia di guerra

La UI riceve **viste** dei dati, non le entità grezze. Esempio:
potenziale di un giovane pilota = intervallo stimato la cui ampiezza
dipende dal livello degli scout e dalle osservazioni effettuate. Questo
evita che la UI possa mostrare per errore dati nascosti.

## 5. Versionamento

`schemaVersion` intero incrementato a ogni modifica incompatibile; ogni
incremento ha una migrazione testata in
`packages/persistence/migrations`.

# Modello di simulazione

> Stato: **PROPOSTA**. Le costanti indicate sono valori di partenza da
> calibrare con `tools/balance`. Ogni formula avrà un test dedicato
> quando verrà implementata.

La simulazione è il cuore del gioco. Usa un modello **"quasi-statico a
profilo di velocità"** (la tecnica alla base dei simulatori di tempo sul
giro usati in ingegneria), arricchito da un **modello comportamentale
del pilota** e da **interazioni in pista** a ogni tick.

## 1. Pista

Ogni circuito è definito da:

- **Linea centrale** (polilinea x/y in metri) usata per il disegno 2D e,
  in futuro, 3D.
- **Profilo campionato** ogni 2 m: curvatura `κ(s)`, pendenza, camber,
  grip della superficie, settore, zona di frenata, zona di sorpasso
  (difficoltà 0–1), larghezza.
- **Parametri globali**: lunghezza, abrasività, sensibilità al vento,
  esposizione al sole, linee di drenaggio (velocità di asciugatura),
  corsia box.

Da `κ(s)` il raggio è `R(s) = 1/|κ(s)|`.

## 2. Moto: dai componenti alle prestazioni

Ogni componente (motore, telaio, forcellone, sospensioni, freni,
elettronica, cambio, aerodinamica, raffreddamento) ha valori 0–100 su
attributi propri. La moto calcola parametri fisici derivati:

| Parametro                          | Fonte principale                          | Esempio Premier    |
|------------------------------------|-------------------------------------------|--------------------|
| `P_max` potenza (kW)               | motore, raffreddamento (derating termico) | 190–210 kW         |
| `m` massa moto+pilota (kg)         | regolamento (minimo), pilota              | 157 + 68           |
| `CdA` resistenza aerodinamica (m²) | aerodinamica, carenatura                  | 0,26–0,32          |
| `μ_lean` sfruttamento laterale     | telaio, sospensioni, gomme                | 0,95–1,05          |
| `a_brake_max` (m/s²)               | freni, telaio, aero (stabilità)           | 13–15              |
| `traction` 0–1                     | elettronica, forcellone, sospensioni      |                    |
| `wheelie_limit` (m/s²)             | aero, elettronica, geometria              |                    |
| `agility`                          | telaio, massa, geometria                  | cambi di direzione |
| `stability`                        | telaio, forcellone, aero                  | errori in frenata  |
| `tyre_stress`                      | sospensioni, elettronica, setup           | usura              |
| `fuel_rate` (l/100 km)             | motore, mappatura                         |                    |
| `reliability` (tasso di guasto)    | ogni componente, chilometraggio           |                    |

## 3. Profilo di velocità limite (per pilota, per giro)

Per ogni punto `s` del profilo:

**Velocità limite in curva** (equilibrio tra forza centripeta e
aderenza):

    v_corner(s) = sqrt( μ_eff(s) · g · R(s) )
    μ_eff = μ_tyre(compound, T_tyre, wear) · μ_track(wetness, rubber, temp) · μ_lean · Q_setup^0.5

**Accelerazione disponibile** in uscita/rettilineo:

    a_acc(v) = min( P(v)/(m·v) − (½·ρ·CdA·v²)/m − C_rr·g ,   // potenza − aria − rotolamento
                    traction · μ_eff · g ,                    // limite di trazione
                    wheelie_limit )                           // impennata

**Decelerazione disponibile** in frenata:

    a_dec(v) = min( a_brake_max , μ_eff · g · k_stoppie ) + (½·ρ·CdA·v²)/m

Il profilo limite `v_lim(s)` si ottiene con il classico doppio
passaggio:

- **in avanti** integrando `a_acc` da ogni punto di minimo;
- **all'indietro** integrando `a_dec` prima di ogni curva;
- `v_lim(s) = min(v_corner, v_forward, v_backward)`.

Il profilo viene ricalcolato solo quando cambiano gomme, meteo,
carburante o mappa (non a ogni tick).

## 4. Modello del pilota

Il pilota non guida al 100% del limite. In ogni settore sceglie un
**margine**:

    u = u_base + 0.055·Skill_seg + 0.012·Aggr + 0.010·Confidence − Fatigue − TyreFear − Pressure
    v_target(s) = v_lim(s) · u_seg · (1 + ε),   ε ~ N(0, σ),   σ = 0.006 · (1 − Costanza)

- `Skill_seg`: media pesata degli attributi pertinenti al tipo di
  segmento (frenata nelle zone di frenata, inserimento in ingresso
  curva, accelerazione in uscita, velocità in rettilineo/curva veloce,
  bagnato se la pista è umida).
- `Confidence`: qualità del setup rispetto alle preferenze, feeling con
  la moto, morale.
- `Fatigue`: cresce con i giri, ridotta da forma fisica e resistenza.
- `Pressure`: posizione, rivali, ordini della squadra, resistenza
  mentale.
- `u_base ≈ 0.925`: calibrato perché i migliori stiano entro ~1,5% dal
  limite.

### Errori e cadute

Probabilità di errore per curva (modello a rischio esponenziale):

    p_err = p0 · exp( k · (u − u_safe) ) · (1 − 0.6·Concentrazione) · W_wet · W_cold_tyre
    u_safe = 0.97 + 0.02·Costanza

Un errore viene classificato con un secondo estratto: **largo** (perdita
0,3–1,5 s), **fuori pista** (2–8 s, possibile danno), **caduta** (ritiro
o ripartenza se la moto è utilizzabile e il regolamento lo consente). Le
cadute in gruppo valutano i piloti vicini.

## 5. Interazioni in pista

A ogni tick (`dt = 0,1 s` di tempo simulato):

- **Scia**: se un pilota segue entro 25 m in rettilineo,
  `CdA_eff = CdA · (1 − 0.25·f(gap))`.
- **Traffico**: chi segue non può superare la velocità di chi precede se
  non è in una zona di sorpasso o non tenta un attacco; segue con
  penalità di aria sporca/temperatura gomme.
- **Tentativo di sorpasso** (in zone di frenata o uscite):
      P_try  = f(Δvelocità, Aggressività, Sorpassi, ordine squadra, giri rimanenti)
      P_pass = σ( 1.8·(Sorpassi_A − Difesa_B) + 2.5·Δv_norm + 1.2·Δfrenata + zona_sorpasso − 0.8 )

  Esito: sorpasso riuscito, fallito (perdita di tempo per chi attacca),
  **controsorpasso** in uscita (valutato su trazione e accelerazione),
  **contatto** (probabilità crescente con l'aggressività di entrambi)
  che può causare cadute e indagini dei commissari.
- **Penalità**: limiti della pista (contatore per pilota), long lap
  penalty, ride-through, sanzioni di griglia, per irregolarità valutate
  dalla direzione gara secondo regolamento.

## 6. Pneumatici

Mescole per categoria definite dal regolamento (es. Premier:
soft/medium/hard, intermedia, rain; anteriore e posteriore separati).

    grip(T, w) = grip_base · exp( −((T − T_opt)/T_width)² ) · (1 − α·w^β)
    dT/dt      = k_heat · energia_slittamento − k_cool · (T − T_air_track) · f(v)
    dw/dt      = k_wear · energia_slittamento · abrasività · tyre_stress · (1 + surriscaldamento)

- `energia_slittamento` dipende dall'accelerazione
  laterale/longitudinale effettivamente richiesta (quindi da stile di
  guida, assetto, elettronica e ritmo scelto).
- Gomme fredde nei primi giri e dopo una bandiera rossa; anteriore che
  si surriscalda in scia.
- La "Gestione pneumatici" del pilota riduce l'energia di slittamento a
  parità di tempo.

## 7. Carburante

    consumo_giro = Σ_s fuel_rate(mappa, potenza erogata(s)) · ds
    massa = m_base + massa_carburante → influenza accelerazione, frenata e usura

Se il serbatoio rischia di non bastare, il pilota (o la mappa) riduce la
potenza: è il compromesso tra mappatura aggressiva e arrivo al
traguardo.

## 8. Meteo e pista

Stato meteo con evoluzione a fronti (catena di Markov su nuvolosità +
celle di pioggia):

    wetness' = rain_rate · k_wet − (evaporazione(T_track, vento, sole) + k_line · passaggi_moto) · k_dry
    μ_track  = μ_dry · (1 − 0.45·wetness) + μ_wet_tyre_bonus(wetness, compound)

Le previsioni mostrate al giocatore hanno un'incertezza che diminuisce
avvicinandosi all'evento e aumenta con il livello basso del responsabile
strategia.

## 9. Assetto

Assetto = vettore di regolazioni (geometria, precarico, idraulica,
molle, distribuzione pesi, rapporti, mappatura, traction control, freno
motore, configurazione aero). Ogni circuito ha un **assetto ideale
nascosto**, ogni pilota delle **preferenze** di stile.

    distanza = Σ w_i · (setup_i − ideale_i(pista, meteo, pilota))²
    Q_setup  = exp(−distanza / scala)    ∈ (0, 1]

Il giocatore non vede l'ideale: lo scopre dal feedback del pilota
(accurato in base al suo attributo "Feedback tecnico"), dai suggerimenti
del capotecnico e dell'ingegnere di pista (accurati in base alle loro
abilità e alla compatibilità con il pilota) e dalla telemetria.

## 10. Affidabilità

Ogni componente ha un tasso di guasto che cresce con l'usura (curva a
vasca):

    h(t) = λ0 · (1 − affidabilità) · (1 + (km/km_vita)^γ) · stress_termico
    P(guasto nel tick) = 1 − exp(−h · dt)

Le soluzioni "aggressive" del reparto R&D hanno `λ0` più alto finché non
vengono collaudate.

## 11. Output

- `RaceFrame` (a ogni tick): per pilota `s`, offset laterale, velocità,
  angolo di piega, stato (in pista, box, caduto), giro, settore. Il
  renderer 2D interpola a 60 fps.
- `TelemetrySample` (10 Hz per i piloti della squadra del giocatore,
  settore/giro per tutti): velocità, acceleratore, freno, piega, marcia,
  temperature e usura gomme, carburante, distacchi.
- `RaceEvent`: sorpassi, errori, cadute, guasti, penalità, bandiere,
  ingressi ai box.

Tutto ciò che è mostrato in telemetria e classifica deriva da questi
output: nessun dato viene inventato dall'interfaccia.

## 12. Simulazione rapida

Le gare delle altre categorie e delle serie minori usano lo **stesso
motore** senza renderer (centinaia di volte più veloce del tempo reale).
Le serie nazionali di basso livello usano un modello statistico
semplificato a livello di gara, documentato a parte, perché non sono
visibili in dettaglio al giocatore.

## 13. Due moto per pilota

La simulazione non distingue fra Moto A e Moto B: ogni moto è un'istanza
di `Bike` e passa dalla stessa funzione
`derivePerformance(bike, setup, conditions)`. Durante prove e qualifiche
il pilota usa la moto indicata dal programma della sessione; ogni giro
registra `bikeId`, così telemetria e confronti sono separati. Formule di
confronto corretto, preparazione e cambio moto: [TECH_TEAM.md
§1](TECH_TEAM.md).

## 14. Problemi di assetto reali e sensazioni

Dalla distanza fra assetto attuale e ideale (§9) il motore ricava, per
area di guida, i **problemi reali**
`TruthSetupIssue { area, cause, magnitude }` (es. uscita curve lente ←
TC + idraulica posteriore). Questi influenzano direttamente il modello
pilota (velocità nelle sezioni interessate, usura gomme, errori) e sono
la sorgente dei **sintomi** riferiti dal pilota e degli **indicatori**
di telemetria. Probabilità di sintomo corretto, diagnosi dello staff e
intuizioni: [TECH_TEAM.md §2](TECH_TEAM.md).

## 15. Cambio moto flag-to-flag

Quando un pilota entra ai box per il cambio, il motore applica: tempo di
corsia box (limitatore), tempo di scambio (regolamento × coordinamento
meccanici), eventuali errori (dipendenti da precisione del capotecnico,
pressione e prontezza della seconda moto), quindi il pilota riparte con
le gomme e l'assetto della seconda moto (gomme a temperatura iniziale →
fase di riscaldamento).

# Roadmap

> Stato: **PROPOSTA**. Ogni milestone corrisponde a un branch e a una
> Pull Request. Nessuna milestone viene integrata in `main` senza
> approvazione. "Completato" significa: implementato, testato, collegato
> ai dati reali e documentato.

## Fase 0 — Progettazione (questa PR)

Analisi del repository, scelta tecnologica, architettura, modello dati,
GDD, modello di simulazione, design system e mockup di menu principale e
dashboard.

## Fase 1 — Fondamenta

| Milestone                               | Contenuto                                                                                                                                                                                         | Criteri di accettazione                                                                                                           |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **M1.1 Infrastruttura**                 | workspace npm, TS strict, Vite, Vitest, ESLint/Prettier, CI GitHub Actions, controllo confini pacchetti                                                                                           | `npm test` e `npm run build` verdi in CI                                                                                          |
| **M1.2 Core**                           | PRNG con seme e flussi, ID, calendario di gioco (`GameDay`), bus eventi, `Result`, utilità matematiche                                                                                            | test di determinismo e distribuzione del PRNG                                                                                     |
| **M1.3 Schema dati**                    | tipi delle entità (incluse `Bike` con slot A/B, `StaffAssignment`, `RiderStaffBond`, `Briefing`), separazione tipi `Truth*` / osservazioni, validatori, `GameState` normalizzato, serializzazione | round-trip senza perdite; test che vieta l'uso dei tipi `Truth*` fuori dal motore                                                 |
| **M1.4 Content e generatore del mondo** | content pack originali (costruttori, squadre, circuiti, sponsor, nomi), generatore di piloti e staff con attributi per ruolo (ingegneri di pista, capotecnici, specialisti), controllo nomi reali | stesso seme → stesso mondo; invarianti (2 piloti per squadra, 1 capotecnico + 1 ingegnere di pista per pilota, età per categoria) |
| **M1.5 Engine host**                    | Web Worker, protocollo comandi/query, avanzamento del tempo                                                                                                                                       | test di integrazione comando → evento                                                                                             |
| **M1.6 Design system e shell**          | token, tipografia, componenti base, sidebar a 16 voci, top bar, scala Full HD/4K                                                                                                                  | screenshot Playwright 1080p e 4K                                                                                                  |
| **M1.7 Menu e nuova carriera**          | menu principale, scelta squadra esistente, salvataggio iniziale                                                                                                                                   | partita creata dal generatore e visibile nella shell                                                                              |
| **M1.8 Schermate dati**                 | Scuderia, Piloti (lista + scheda), Personale (lista + scheda) collegate allo stato                                                                                                                | nessun dato statico nelle schermate                                                                                               |

## Fase 2 — Prima stagione giocabile (v0.1)

| Milestone                         | Contenuto                                                                                                                                                                                                                                      |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| M2.1 Calendario e tempo           | stagione Premier, avanzamento giorni, eventi, inbox decisioni                                                                                                                                                                                  |
| M2.2 Moto e componenti            | modello componenti → parametri fisici, usura, affidabilità base                                                                                                                                                                                |
| M2.3 Motore di gara               | profilo di velocità, modello pilota, traffico, scia, sorpassi, errori/cadute base, gomme base                                                                                                                                                  |
| M2.4 Vista 2D                     | renderer Canvas, classifica live, velocità pausa–16×, feed eventi                                                                                                                                                                              |
| M2.5 Weekend                      | FP, qualifiche, gara (formato da regolamento), risultati e punti                                                                                                                                                                               |
| **M2.5b Assetto e briefing base** | assetto base da libreria, problemi reali di assetto → sintomi del pilota, 1–2 proposte di ingegnere/capotecnico dopo ogni sessione, scelta del manager (accetta / mantieni / segui il pilota), effetto reale sulla sessione successiva; delega |
| M2.6 Classifiche                  | piloti, squadre, costruttori; schermata Campionato                                                                                                                                                                                             |
| M2.7 Economia base                | stipendi, premi, sponsor esistenti, trasferte; schermata Finanze                                                                                                                                                                               |
| M2.8 Salvataggi                   | slot multipli, manuale, autosalvataggio, migrazioni                                                                                                                                                                                            |
| M2.9 Bilanciamento                | `tools/balance`: distribuzione vittorie, distacchi e cadute verosimili                                                                                                                                                                         |

**Funzionalità della prima versione giocabile (v0.1)**

- Nuova carriera con squadra esistente in **Premier**.
- Mondo generato: 11 squadre, 22 piloti, staff, 5 costruttori, 20
  circuiti, sponsor.
- Stagione completa di 20 round con formato prove/qualifiche/gara
  (Sprint opzionale da regolamento).
- Gara simulata con vista 2D, velocità pausa–16×, sorpassi, errori,
  cadute, guasti base, gomme e carburante.
- Strategia pre-gara (mescola, mappa, obiettivo) e pit board base.
- Un capotecnico e un ingegnere di pista per pilota con attributi
  tecnici di base.
- Feedback del pilota dopo le prove e prime modifiche all'assetto
  (briefing semplificato), con modello verità/osservazioni già attivo.
- **Una sola moto per pilota** in gara (lo schema dati prevede già Moto
  A/B: nessuna migrazione futura).
- Classifiche piloti/squadre/costruttori, risultati di ogni sessione.
- Finanze base con bilancio reale derivato dalle transazioni.
- Salvataggi su slot e autosalvataggio.
- Schermate attive: Panoramica, Scuderia, Piloti, Personale, Moto (sola
  lettura), Finanze, Calendario, Campionato, Notizie (generate dagli
  eventi). Le altre voci sono visibili come "In sviluppo" e
  disabilitate.

## Fase 3 — Gestione avanzata

Mercato piloti e staff, negoziazione contratti con controfferte, sponsor
e negoziazione, accademia, strutture, ricerca e sviluppo completa,
modalità **Crea la tua squadra**, categorie Intermediate e Lightweight
giocabili, serie feeder simulate.

**Squadra tecnica (livello intermedio)**

- M3.x **Mercato ingegneri**: scouting dello staff con attributi a
  intervallo, contratti (ruolo e pilota garantiti), offerte delle
  squadre IA.
- M3.x **Crescita professionale**: competenze dal lavoro svolto,
  reputazione dai risultati, potenziale e curve di carriera, corsi di
  formazione.
- M3.x **Rapporti pilota-staff**: fiducia, comunicazione, compatibilità,
  comprensione dello stile; riassegnazioni.
- M3.x **Moto A / Moto B**: due moto per pilota, stato individuale,
  lavori e prontezza, condivisione dei motori.

## Fase 4 — Simulazione avanzata

Assetto completo con feedback e proposte dello staff, telemetria con
grafici e confronto, strategie di gara complete, IA di gara e IA
gestionale delle squadre, meteo dinamico con asciugatura e flag-to-flag,
incidenti, bandiere, penalità, interruzioni.

**Squadra tecnica (completamento intermedio → avanzato)**

- Briefing interattivi completi (seconda analisi, confronto soluzioni,
  parere del capotecnico, sperimentazione su Moto B) e briefing finale
  pre-gara con scenari di pioggia.
- Confronto A/B corretto per le condizioni, con incertezza (richiede la
  telemetria di questa fase).
- Programma delle sessioni e preparazione al bagnato (richiede meteo
  dinamico).
- **Cambio moto flag-to-flag completamente simulato** (richiede Moto A/B
  di Fase 3 + meteo con asciugatura).
- IA delle squadre su staff, briefing, Moto A/B e preparazione alla
  pioggia.

## Fase 5 — Mondo dinamico

Rivalità, media e conferenze, regolamenti con votazioni, evoluzione e
crisi delle squadre, ingresso/uscita di costruttori, storia del
campionato, record, archivio pluriennale.

**Squadra tecnica (avanzato)**: diagnosi approfondite e analisi
telemetrica avanzata, errori di interpretazione e confidenza "falsata"
dalla personalità, formazione specialistica e mentoring, relazioni e
conflitti complessi (richieste di sostituzione, tecnici che seguono un
pilota), storico delle diagnosi per ingegnere.

## Dipendenze dei nuovi sistemi

    Schema dati con Bike A/B + Truth/Observation (Fase 1)
       └─► Assetto + problemi reali + sintomi + briefing base (Fase 2, MVP)
             ├─► Staff con attributi completi ─► Mercato ingegneri ─► Crescita ─► Rapporti (Fase 3)
             ├─► Moto A/B, lavori e prontezza (Fase 3)
             │     └─► Confronto A/B corretto (Fase 4, richiede telemetria)
             └─► Briefing interattivi completi (Fase 4)
    Meteo dinamico + asciugatura (Fase 4) ─┬─► Preparazione al bagnato nei briefing
                                           └─► Flag-to-flag simulato (richiede anche Moto A/B)

**Cosa resta fuori dall'MVP e perché**: seconda moto, mercato ingegneri,
crescita e confronto A/B richiedono telemetria, meteo e mercato
completi; inserirli nella v0.1 ritarderebbe la prima stagione giocabile.
Lo schema dati li prevede fin dall'inizio, quindi verranno aggiunti
senza riscritture.

## Fase 6 — Grafica avanzata

Modelli moto e livree avanzate, paddock, telecamere, replay (dal flusso
`RaceFrame` già registrato), eventuale renderer 3D (Three.js/Babylon.js)
dietro l'interfaccia `RaceRenderer`.

## Primo modulo da sviluppare

**M1.1 + M1.2 + M1.3 → `packages/core` e `packages/data/schema`.**

Motivazione: ogni altro sistema (simulazione, economia, UI) dipende dal
PRNG deterministico, dal tempo di gioco e dallo schema delle entità.
Sono moduli piccoli, interamente testabili senza interfaccia, e fissano
le convenzioni del progetto.

In parallelo propongo uno **spike tecnico** isolato (`tools/sim-cli`,
non integrato nel gioco): calcolo del tempo sul giro con il profilo di
velocità su un circuito di prova, per validare presto che il modello
fisico produca tempi e velocità realistiche. È il rischio tecnico
principale del progetto e conviene affrontarlo subito.

# Proposta grafica e UI

> Stato: **PROPOSTA**. I mockup in `docs/mockups/` sono pagine HTML
> statiche con **dati illustrativi** per valutare lo stile; non sono
> codice di gioco. Nel gioco ogni valore proverrà dallo stato simulato.

## 1. Direzione visiva

**"Pit wall notturno"**: superfici scure stratificate, accenti
rosso→arancione usati solo per ciò che conta (azione principale,
selezione, dati della propria squadra), tipografia condensata corsiva
per titoli e numeri di gara, sans-serif leggibile per i dati.

| Elemento          | Scelta                                                                                                                   |
|-------------------|--------------------------------------------------------------------------------------------------------------------------|
| Sfondo            | 4 livelli di grigio-blu molto scuro (`#08090c` → `#1c202b`) per dare profondità senza ombre pesanti                      |
| Accento           | gradiente `#e5322d` → `#ff7a1a`; arancione per link e selezioni, rosso per allarmi/azioni critiche                       |
| Stati             | verde `#2fbf71`, ambra `#ffb020`, rosso `#ff4d4f`, blu `#4aa3ff` (sempre accompagnati da testo o icona, mai solo colore) |
| Titoli e numeri   | **Barlow Condensed** (SIL Open Font License), maiuscolo, spaziatura ampia                                                |
| Testo e tabelle   | **Inter** (SIL OFL) con cifre tabulari                                                                                   |
| Codice/telemetria | **JetBrains Mono** (SIL OFL)                                                                                             |
| Icone             | set SVG proprio a tratto 1,5 px (nessun pacchetto icone esterno obbligatorio)                                            |
| Animazioni        | 150–250 ms, easing morbido; numeri che cambiano con transizione; nessuna animazione decorativa durante la gara           |

I font saranno inclusi nel pacchetto del gioco (nessun caricamento da
Internet).

Token completi: [`docs/mockups/tokens.css`](mockups/tokens.css)
(diventeranno `apps/client/src/design-system/tokens.css`).

### Risoluzioni

Layout progettato su 1920×1080 in unità `rem`; la dimensione radice
scala a 1440p e 4K (fattore 1,25 / 2). Larghezza minima supportata
1280×720. Grafici in SVG/Canvas con `devicePixelRatio` per nitidezza in
4K.

## 2. Menu principale

![Menu principale](../images/main-menu.png)

- A sinistra: marchio, scheda **"Continua"** con anteprima dell'ultimo
  salvataggio (squadra, stagione, round, quando), voci del menu.
- A destra: un circuito del gioco disegnato dai **dati reali del
  tracciato** con moto animate (nel gioco: un replay a bassa velocità di
  una gara simulata in background).
- Voci: Continua carriera · Nuova carriera (Squadra esistente / Crea la
  tua squadra) · Carica partita · Impostazioni · Esci. Funzioni non
  ancora pronte appaiono disabilitate con etichetta **"In sviluppo"**,
  mai come pulsanti attivi.
- Navigazione completa da tastiera e controller (frecce + Invio).

### Flusso "Nuova carriera"

1.  Modalità (squadra esistente / crea squadra)
2.  Categoria di partenza (Lightweight · Intermediate · Premier)
3.  Scelta squadra con confronto: budget, moto, piloti, obiettivi della
    dirigenza, difficoltà stimata — oppure procedura guidata di
    creazione (identità → tipologia → costruttore → piloti → staff →
    sponsor → riepilogo)
4.  Opzioni: nome carriera, seme del mondo (opzionale), difficoltà,
    autosalvataggio
5.  Generazione del mondo con barra di avanzamento (simulazione delle
    stagioni storiche)

## 3. Dashboard (Panoramica)

![Dashboard](../images/dashboard.png)

**Struttura della shell (comune a tutte le schermate)**

- **Sidebar** con le 16 voci richieste, raggruppate: *Squadra*
  (Panoramica, Scuderia, Piloti, Personale) · *Tecnica* (Moto, Sviluppo,
  Strutture) · *Persone e affari* (Accademia, Mercato, Sponsor, Finanze)
  · *Competizione* (Calendario, Campionato, Statistiche) · *Mondo*
  (Notizie, Archivio). I badge numerici indicano azioni in sospeso.
- **Top bar**: titolo schermata, data di gioco, prossimo evento, saldo,
  posizione squadre, posta, e il pulsante primario **Continua** che
  avanza il tempo fino al prossimo evento o decisione obbligatoria (come
  nei manageriali sportivi).

**Widget della Panoramica**

| Widget              | Contenuto                                                                                                | Fonte dati                            |
|---------------------|----------------------------------------------------------------------------------------------------------|---------------------------------------|
| Prossimo evento     | mappa circuito, caratteristiche, previsioni meteo con incertezza, programma sessioni                     | `Round`, `Circuit`, `WeatherForecast` |
| Piloti              | posizione, punti, valutazione, morale, contratto, ultimi 5 risultati, forma fisica, sintonia con la moto | `Rider`, `Standing`, `SessionResult`  |
| Classifica          | prime posizioni + riga della propria squadra evidenziata                                                 | `Standing`                            |
| Finanze             | saldo, andamento cassa, previsione di fine stagione, entrate/uscite del mese                             | `Transaction`, `FinanceForecast`      |
| Sviluppo e moto     | progetti R&D attivi con fase e tempi, motori usati / limite, affidabilità                                | `RnDProject`, `Bike`, `Regulation`    |
| Decisioni richieste | elementi della posta che bloccano l'avanzamento o hanno scadenza                                         | `InboxItem`                           |
| Obiettivi           | dirigenza, sponsor, costruttore con stato                                                                | `Objective`                           |
| Notizie             | ultime notizie e rumors generati dagli eventi                                                            | `NewsItem`                            |

## 4. Weekend di gara — vista 2D

![Vista gara 2D](../images/race-view.png)

- **Sinistra**: classifica live con distacchi, ultimo giro, mescola,
  guadagni/perdite di posizioni; i piloti della squadra sono
  evidenziati.
- **Centro**: mappa 2D dall'alto disegnata dal tracciato del circuito,
  settori, corsia box, moto numerate nei colori delle squadre,
  segnalazione di cadute; feed degli eventi prodotti dalla simulazione.
- **Destra**: un pannello per pilota (usura e temperatura gomme,
  carburante con margine all'arrivo, fatica e concentrazione) e i
  comandi consentiti dal regolamento: ritmo, mappa motore, **pit board**
  con anteprima del messaggio.
- **Barra inferiore**: pausa, 1×, 2×, 4×, 8×, 16×, avanzamento gara,
  giro più veloce.

## 5. Scheda pilota

![Scheda pilota](../images/rider-profile.png)

Intestazione con numero, valutazione, **potenziale stimato come
intervallo** (dipende dagli scout), morale, forma, stipendio. Schede:
Profilo, Risultati, Contratto, Assetto preferito, Telemetria, Storico.
Nel profilo: i 17 attributi con tendenza, andamento della stagione,
contratto e clausole, relazioni con staff/compagno/rivali, preferenze di
assetto ricavate dal feedback, condizione fisica.

## 6. Squadra tecnica, Moto A/B e briefing (revisione Fase 0)

Schermate per i sistemi descritti in [TECH_TEAM.md](TECH_TEAM.md). Tutti
i mockup sono in Full HD 1920×1080.

### 6.1 Garage Moto A / Moto B

![Garage Moto A/B](../images/bikes-ab.png)

Per ogni pilota: stato delle due moto (prontezza, disponibilità,
chilometraggio, usura, affidabilità, danni, manutenzione, assetto),
**confronto corretto** B rispetto ad A con l'incertezza e il dettaglio
delle correzioni (evoluzione pista, carburante, gomme, temperatura),
componenti e assetto affiancati con le differenze evidenziate,
prestazioni per settore, piano dei lavori con le ore-meccanico
disponibili e vincoli del regolamento (motori condivisi, gomme,
flag-to-flag).

### 6.2 Briefing tecnico

![Briefing tecnico](../images/briefing.png)

- **Sinistra – pilota**: immagine, nome, soddisfazione, fiducia nella
  moto e nell'ingegnere, sensazioni riportate tra virgolette, problemi
  con gravità percepita, richieste personali.
- **Centro – analisi**: telemetria A vs B nel tratto critico,
  comportamento per area (indicatori osservati), tempi per settore
  corretti, gomme, condizioni della sessione, storico delle decisioni
  del weekend.
- **Destra – staff**: ingegnere di pista e capotecnico con competenze
  chiave, comprensione dello stile del pilota, storico diagnosi, ipotesi
  con **confidenza dichiarata**; programma della sessione successiva e
  previsioni meteo.
- **Basso – decisioni**: soluzioni A/B/C con vantaggi e svantaggi
  *possibili* (non garantiti) e pulsanti Accetta modifica, Chiedi
  approfondimento, Prova alternativa (Moto B), Parere capotecnico, Segui
  il pilota, Confronta, Mantieni configurazione, Concludi briefing.
  Tempo del briefing sempre visibile; delega al capotecnico.

### 6.3 Mercato ingegneri

![Mercato ingegneri](../images/engineer-market.png)

Filtri (ruolo, specializzazione, età, stipendio, disponibilità,
compatibilità con un pilota), tabella con valutazione attuale e
potenziale **stimati** dagli scout (intervalli e "?"), stipendio
richiesto, contratto, compatibilità stimata, avanzamento dello scouting;
anteprima del profilo con attributi a intervallo, note dello scout,
rivali interessati; incarichi di scouting e movimenti del mercato.

### 6.4 Scheda ingegnere

![Scheda ingegnere](../images/engineer-profile.png)

Attributi del ruolo con variazione stagionale, grafico **competenze vs
reputazione** (cresce la reputazione con i podi, le competenze con il
lavoro), fonti di crescita, storico delle diagnosi (corretta / parziale
/ sbagliata), personalità e ambizioni, formazione, rapporti con piloti e
colleghi, contratto e azioni (rinnova, bonus, formazione, sposta,
promuovi, colloquio, licenzia).

### 6.5 Gestione capotecnici e ingegneri di pista

![Squadra tecnica](../images/tech-staff.png)

Un "box" per pilota con capotecnico, ingegnere di pista, analista e
meccanici; per ogni coppia pilota-tecnico i sei valori del rapporto
(fiducia, comunicazione, compatibilità, esperienza condivisa,
comprensione dello stile, soddisfazione). Segnalazione dei **conflitti**
con le azioni del manager, reparti specialistici con carico di lavoro,
tecnici promuovibili dall'interno e **anteprima degli effetti** di una
riassegnazione prima della conferma.

## 7. Altre schermate chiave (linee guida)

- **Tabelle**: intestazioni fisse, ordinamento, filtri salvabili,
  colonne configurabili, virtualizzazione oltre 100 righe, confronto di
  due righe.
- **Schede persona**: intestazione con numero/ruolo, attributi a barre
  con valore e tendenza (▲▼), storico, contratto, relazioni.
- **Weekend di gara**: layout a tre colonne — cronometraggio a sinistra,
  mappa 2D al centro, controlli piloti e telemetria a destra; barra
  delle velocità (pausa, 1×, 2×, 4×, 8×, 16×) in basso.
- **Telemetria**: grafici a traccia sovrapposta per distanza (velocità,
  gas, freno, piega), delta-tempo, confronto pilota A/B, selettore giro.

## 8. Accessibilità

Contrasto minimo AA sul testo, stati mai indicati solo dal colore,
dimensione testo regolabile, modalità per daltonici sui colori di gomme
e squadre, riduzione animazioni.

# ADR-0001 — Stack tecnologico

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto

Manageriale con UI molto densa di dati, simulazione deterministica come
nucleo, distribuzione su PC, costi contenuti, sviluppo in ambiente cloud
senza editor grafici, futura vista 3D.

## Decisione

TypeScript in un monorepo a workspace npm; logica e simulazione in
pacchetti puri eseguiti in un Web Worker; interfaccia React + Vite;
vista di gara Canvas 2D dietro l'interfaccia `RaceRenderer`; contenitore
desktop Tauri 2; test con Vitest e Playwright.

## Alternative considerate

- **Godot 4**: ottimo e gratuito, ma UI gestionali (tabelle, grafici,
  filtri) richiedono molto lavoro manuale; test e CI meno immediati
  senza editor.
- **Unity**: forte su 3D, ma licenze e dipendenza dall'editor; UI dati
  non superiore al web.
- **Unreal Engine**: sovradimensionato per un manageriale; UI gestionali
  onerose; royalty.
- **Electron** al posto di Tauri: più semplice, ma installer ~10 volte
  più pesanti e consumo di memoria maggiore.

## Conseguenze

- (+) Velocità di sviluppo della UI, test rapidi, CI semplice, costi
  nulli, pacchetti leggeri.
- (+) La simulazione è riutilizzabile (CLI, strumenti di bilanciamento,
  eventuali server).
- (−) 3D di alto livello più limitato: mitigato dal formato di replay
  neutrale (`RaceFrame`).
- (−) WebView diverse per sistema operativo: test e2e su
  Windows/macOS/Linux in CI prima dei rilasci.

# ADR-0002 — Stato di gioco e persistenza

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto

Il gioco deve simulare un mondo intero (squadre, persone, contratti,
gare) e salvare carriere pluriennali con storico e statistiche.

## Decisione

- Stato corrente come **database relazionale in memoria** normalizzato
  (`Record<Id, Entity>` per tabella).
- Modifiche solo tramite **comandi** validati e **sistemi** che emettono
  **eventi di dominio**.
- **PRNG con seme** (`sfc32`) diviso in flussi per sottosistema, salvato
  con lo stato.
- Salvataggi: `meta.json` + `state.json.gz` + archivio per stagione, con
  `schemaVersion` e migrazioni.
- Adapter di storage: filesystem via Tauri (desktop), IndexedDB
  (sviluppo nel browser).

## Alternative considerate

- **SQLite come stato primario**: query potenti, ma la simulazione
  richiede comunque lo stato in memoria; il doppio modello aumenta
  complessità e tempi di avanzamento. Riconsiderato per il solo archivio
  statistico se supera ~50 MB per carriera.
- **ECS** (Entity Component System): utile per migliaia di entità in
  tempo reale; qui le entità sono poche centinaia/migliaia e prevalgono
  le relazioni, quindi un modello relazionale è più chiaro.

## Conseguenze

- (+) Determinismo, replay, riproducibilità dei bug, test golden.
- (+) Salvataggio/caricamento semplici e veloci.
- (−) Lo storico cresce: archiviazione per stagione e caricamento su
  richiesta.

# ADR-0003 — Modello di conoscenza (verità vs informazioni della squadra)

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto

Briefing tecnici, confronto Moto A/B, scouting di piloti e ingegneri e
previsioni meteo richiedono che il giocatore (e le squadre IA) prendano
decisioni con **informazioni incomplete e rumorose**, mentre la
simulazione deve conoscere lo stato reale.

## Decisione

- Separare in `packages/sim` lo **stato reale** (`TruthState`: problemi
  reali di assetto, potenziale reale, meteo futuro) dalle
  **osservazioni** (`Observation`, `RiderFeedback`, `StaffHypothesis`,
  `ScoutReport`, `Forecast`), generate da funzioni pure con PRNG
  dedicato.
- La UI e l'IA gestionale leggono **solo** le osservazioni, tramite
  selettori di "conoscenza della squadra" (`KnowledgeView(teamId)`). Un
  test di architettura vieta l'import dei tipi `Truth*` fuori da `sim` e
  dai risolutori interni di `game`.
- Le decisioni vengono applicate allo stato reale; i risultati tornano
  come nuove osservazioni.

## Alternative considerate

- **Mostrare i valori reali con un filtro nella UI**: semplice, ma
  fragile (basta un bug per svelare la soluzione) e non utilizzabile per
  un'IA "onesta".
- **Nessuna incertezza**: rende il briefing decorativo, contrario
  all'obiettivo di gameplay.

## Conseguenze

- (+) Briefing e scouting diventano vere meccaniche; le IA competono
  alla pari.

- (+) Test semplici: si verifica la calibrazione (es. ingegnere con
  Diagnosi 80 → ~75% diagnosi corrette).

- (−) Più tipi e più dati da salvare (storico delle ipotesi): gestito
  con archivio per stagione.

# Appendice — Galleria screenshot

Tutte le immagini sono mockup HTML renderizzati con Chromium in
1920×1080; i dati sono illustrativi.

![main menu](../images/main-menu.png)

![dashboard](../images/dashboard.png)

![race view](../images/race-view.png)

![rider profile](../images/rider-profile.png)

![bikes ab](../images/bikes-ab.png)

![briefing](../images/briefing.png)

![engineer market](../images/engineer-market.png)

![engineer profile](../images/engineer-profile.png)

![tech staff](../images/tech-staff.png)

![main menu dettaglio](../images/main-menu-dettaglio.png)

![dashboard topbar](../images/dashboard-topbar.png)

![dashboard sidebar](../images/dashboard-sidebar.png)

![dashboard widget 1 prossimo
evento](../images/dashboard-widget-1-prossimo-evento.png)

![dashboard widget 2 piloti](../images/dashboard-widget-2-piloti.png)

![dashboard widget 3
classifica](../images/dashboard-widget-3-classifica.png)

![dashboard widget 4 finanze](../images/dashboard-widget-4-finanze.png)

![dashboard widget 5 sviluppo](../images/dashboard-widget-5-sviluppo.png)

![dashboard widget 6 decisioni](../images/dashboard-widget-6-decisioni.png)

![dashboard widget 7 obiettivi](../images/dashboard-widget-7-obiettivi.png)

![dashboard widget 8 notizie](../images/dashboard-widget-8-notizie.png)

![race view mappa 2d](../images/race-view-mappa-2d.png)

![race view classifica live](../images/race-view-classifica-live.png)

![race view controlli piloti](../images/race-view-controlli-piloti.png)

![race view velocita
simulazione](../images/race-view-velocita-simulazione.png)

![rider profile intestazione](../images/rider-profile-intestazione.png)

![rider profile attributi](../images/rider-profile-attributi.png)

![rider profile relazioni](../images/rider-profile-relazioni.png)

![rider profile assetto](../images/rider-profile-assetto.png)

![main menu 1440p](../images/main-menu-1440p.png)

![dashboard 1440p](../images/dashboard-1440p.png)

![main menu 4k](../images/main-menu-4k.png)

![dashboard 4k](../images/dashboard-4k.png)
