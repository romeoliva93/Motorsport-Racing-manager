# Game Design Document

> Stato: **PROPOSTA — Fase 0**. Tutti i nomi sono originali e provvisori. Prima di una
> pubblicazione commerciale serve una verifica legale su marchi e nomi.

## 1. Visione

**Titolo provvisorio: LEAN ANGLE — Moto Racing Manager**
(alternative: *Apex Paddock*, *Throttle Chief*).

Il giocatore è il **Team Principal** di una scuderia nel motomondiale immaginario della
**Velocity World Championship (VWC)**, gestito dalla **International Velocity Federation (IVF)**.
Deve vincere in pista, far quadrare i conti, sviluppare la moto, far crescere i talenti e
muoversi nella politica del paddock. La profondità viene da **sistemi interconnessi**,
non da risultati preparati in anticipo: ogni stagione è diversa.

**Pilastri**

1. **Simulazione credibile**: tempi sul giro, gomme, meteo, sorpassi e cadute nascono da modelli fisici e comportamentali.
2. **Decisioni con conseguenze**: ogni scelta ha un costo opportunità (budget, tempo, morale, affidabilità).
3. **Persone, non numeri**: piloti e personale hanno personalità, relazioni, ambizioni e memoria.
4. **Mondo vivo**: squadre IA che crescono, entrano in crisi, cambiano costruttore; regolamenti che evolvono.
5. **Chiarezza**: interfaccia premium che spiega il perché dei risultati (telemetria, report, consigli dello staff).

## 2. Universo originale

### Federazione e campionati

| Livello | Nome | Moto | Note |
|---|---|---|---|
| Premier | VWC Premier | Prototipi 1000 cc, 4 cilindri (regolamento modificabile) | costruttori, concessioni, sviluppo libero entro limiti |
| Intermediate | VWC Intermediate | Motore unico 800 cc tre cilindri *Orvane*, telai dei costruttori di telai | sviluppo telaio/sospensioni, elettronica unica |
| Lightweight | VWC Lightweight | 250 cc monocilindrico | limite di età 28 anni, costi bassi |
| Feeder | Junior Velocity Cup | monomarca 250 cc | 13–17 anni, scouting |
| Feeder | Continental Talent Cups (Europa, Asia-Pacifico, Americhe) | 250 cc | campionati regionali |
| Feeder | Campionati nazionali | — | simulati in modo statistico, fonte di giovani |

### Costruttori (Premier)

| Costruttore | Paese | Identità tecnica |
|---|---|---|
| **Ardena** | Italia | motore potente, aerodinamica avanzata, consumo gomme alto |
| **Hoshiro** | Giappone | equilibrio, grande affidabilità, sviluppo lento |
| **Takaido** | Giappone | agilità e percorrenza, poca potenza |
| **Vohrmann** | Austria | telaio rigido, frenata eccellente, difficile da guidare |
| **Corvane** | Francia | costruttore giovane con concessioni, elettronica innovativa |

Altri marchi: **Lysander** (Regno Unito, presente in Lightweight, candidato a entrare in Premier),
costruttori di telai Intermediate **Navarra Chassis** (Spagna) e **Bertoldi Telai** (Italia).

### Fornitori tecnici
Gomme **Velgrip** (unico fornitore), carburante **Petrava**, centralina unica **Cortex Dynamics**,
freni **Ferrox** e **Kaiten**, sospensioni **Ölund** e **Sorriva**.

### Squadre Premier iniziali (11 × 2 piloti)
Ufficiali: *Ardena Corse*, *Hoshiro Racing Works*, *Takaido Factory Racing*, *Vohrmann Performance*,
*Corvane Moto Sport*. Satellite/indipendenti: *Scuderia Lupo Blu* (Ardena), *Team Meridian* (Ardena),
*Akane Racing* (Hoshiro), *Atlas Motorsport* (Takaido), *Alpenwerk Racing* (Vohrmann),
*Équipe Bastide* (Corvane). Le categorie inferiori avranno 14–16 squadre ciascuna.

### Calendario di esempio (20 round, tutti circuiti immaginari)
Al-Rimal International (gara notturna) · Autódromo Cerro Azul · Shiranami Circuit ·
Circuit de Serrablanca · Circuit des Hautes Landes · Autodromo del Monte Ferro · Brennholz-Ring ·
Vltava Ring · Rijnvaart Circuit · Lakeside Park Raceway · Dunavár Circuit · Circuito do Atlântico ·
Autodromo Valle del Savio · Anatolia Park · Phang-Rai International · Pulau Hijau Circuit ·
Coral Coast Raceway · Nusa Biru Circuit · Autódromo Sierra Dorada · Lone Pine Motorsports Park.

Ogni circuito ha tracciato originale disegnato come polilinea, caratteristiche (velocità media,
frenate, abrasività, sorpassi) e clima stagionale.

### Persone
Piloti e personale sono generati da **pool di nomi per nazionalità** combinati con un seme,
più un piccolo gruppo di personaggi scritti a mano. Uno script di controllo
(`tools/content-check`) confronta i nomi con una lista di piloti e personaggi reali per
evitare coincidenze. Sponsor di esempio: *Voltaris Energy*, *Nexora Telecom*, *Fulmine Drinks*,
*Kestrel Watches*, *Aurum Bank*, *Helix Helmets*, *Pantera Apparel*.

Loghi e livree sono generati proceduralmente (forme, monogrammi, palette) e personalizzabili.

## 3. Modalità di gioco

### 3.1 Carriera con squadra esistente
Scelta di categoria e squadra. La difficoltà deriva dalla squadra stessa (budget, reputazione,
obiettivi della dirigenza). Ogni squadra ha piloti, staff completo, costruttore, moto, budget,
sponsor, contratti, strutture, reputazione, obiettivi e storia (generata simulando le stagioni
precedenti all'inizio della carriera, così lo storico è coerente e non scritto a mano).

### 3.2 Crea la tua squadra
Personalizzazione: nome, logo (editor procedurale), nazionalità, sede, colori, livrea, divise,
numeri, sponsor iniziali, tipologia, budget iniziale (determinato da tipologia e difficoltà).
Selezione di costruttore, piloti, capotecnici, ingegneri, meccanici, direttore tecnico e
responsabili dei reparti dal mercato dei liberi e da un pool di "disponibili alla nuova squadra".

| Tipologia | Budget | Moto | Sviluppo | Vincoli / vantaggi |
|---|---|---|---|---|
| **Privato** | molto basso | moto clienti dell'anno precedente | solo assetto ed elettronica | massima libertà di sponsor; reputazione bassa |
| **Indipendente** | basso-medio | moto in leasing della stagione | piccoli pacchetti (sospensioni, freni) | trattativa annuale col costruttore |
| **Satellite** | medio | specifica attuale o dell'anno prima | nessuno sul motore, dati condivisi | il costruttore può imporre piloti ed obiettivi |
| **Ufficiale** | alto | specifica di fabbrica | completo | aspettative alte, pressione della casa madre |
| **Nuovo costruttore** | altissimo, con investitori | progettata da zero | completo | concessioni regolamentari, prestazioni iniziali basse, costi enormi |

### 3.3 Percorso di carriera
Si può iniziare in Lightweight o Intermediate e salire di categoria (iscrizione approvata dalla
federazione in base a reputazione, finanze e posti disponibili), oppure acquisire il posto di
una squadra in difficoltà. Si può essere licenziati se gli obiettivi falliscono ripetutamente,
con offerte da altre squadre in base alla reputazione del giocatore.

## 4. Sistemi principali (sintesi)

| Sistema | Contenuto | Riferimento tecnico |
|---|---|---|
| Personale | 19 ruoli, attributi per ruolo, personalità, morale, compatibilità, offerte rivali | DATA_MODEL §3, TECH_TEAM §3 |
| **Squadra tecnica** | mercato e scouting degli ingegneri, attributi per ruolo, crescita professionale, rapporti pilota-staff, conflitti | GDD §16, TECH_TEAM §3–6 |
| **Moto A / Moto B** | due moto per pilota con stato individuale, confronto equo, preparazione, cambio flag-to-flag | GDD §16, TECH_TEAM §1 |
| **Briefing tecnico** | sensazioni del pilota, diagnosi dello staff, decisioni del manager, sviluppo dell'assetto nel weekend | GDD §16, TECH_TEAM §2, §7–8 |
| Piloti | 17 attributi + potenziale, crescita/declino, forma, infortuni, rivalità, ritiri, sostituti, collaudatori | SIMULATION §4 |
| Contratti e mercato | stipendio, durata, bonus, clausole, opzioni, ruoli, obiettivi; trattative con controfferte; IA autonoma; indiscrezioni | GDD §5 |
| Accademia | scouting internazionale, istruttori, programmi (minibike, flat track, motard, simulatore, atletica), contratti junior, prestiti, promozione | GDD §6 |
| Moto | 9 componenti, 10 caratteristiche prestazionali derivate | SIMULATION §2 |
| R&D | progetti conservativi/equilibrati/aggressivi/sperimentali, ingegneri, budget, tempi, produzione, test, fallimenti | GDD §7 |
| Strutture | 12 strutture con livelli, costi, manutenzione, benefici | GDD §8 |
| Weekend | formato configurabile per categoria/stagione; controllo diretto di prove e qualifiche | GDD §9 |
| Assetto | 8 gruppi di regolazioni, preferenze pilota, proposte di capotecnico e ingegnere | SIMULATION §9 |
| Telemetria | tempi, settori, velocità, freno, gas, temperature, consumi, gomme, distacchi, passo; confronto piloti | SIMULATION §11 |
| Gara | vista 2D dall'alto, velocità pausa–16×, eventi, bandiere, interruzioni | SIMULATION |
| Strategie | ritmo, aggressività, gomme, carburante, mappe; pit board / messaggi cruscotto secondo regolamento | GDD §10 |
| Meteo e gomme | meteo dinamico, asfalto, pioggia, vento, asciugatura; mescole, temperature, usura | SIMULATION §6–8 |
| Economia | entrate/uscite, bilanci, previsioni, prestiti, flussi di cassa | GDD §11 |
| Sponsor | budget, durata, bonus, obiettivi, aspettative, attività promozionali | GDD §11 |
| Media | conferenze, interviste, notizie, rumors, rivalità, rapporti coi costruttori | GDD §12 |
| IA | profilo strategico per squadra, decisioni periodiche con stesse regole e stesse informazioni del giocatore (anche Moto A/B, staff e briefing) | GDD §13, TECH_TEAM §9 |
| Regolamenti | punti, penalità, limiti tecnici, motori, congelamenti, formati, votazioni | GDD §14 |

## 5. Mercato e contratti
- Finestra di mercato aperta tutto l'anno con picchi (pausa estiva, fine stagione).
- Ogni negoziazione: offerta → risposta (accetta / rifiuta / controproposta) con valutazione
  dell'utilità per il pilota: soldi, moto competitiva, ruolo (primo pilota), progetto,
  fedeltà, rapporto con il personale, nazionalità/sponsor.
- **Offerte concorrenti**: le squadre IA possono inserirsi; il pilota comunica scadenze.
- **Indiscrezioni**: le trattative generano rumors con affidabilità variabile, che influenzano
  il morale dei piloti attuali.
- Clausole: rescissione, uscita per prestazioni, opzione di rinnovo unilaterale, promozione
  dall'accademia, obblighi mediatici, bonus per vittorie/podi/titolo.

## 6. Accademia
Livello della struttura → numero di posti e qualità dei programmi. Gli istruttori aumentano
la crescita di attributi specifici. I giovani corrono nelle serie feeder (in squadre proprie
o in prestito) e accumulano esperienza. Promozione in Lightweight o direttamente in squadra.

## 7. Ricerca e sviluppo
- **Conservativo**: guadagno piccolo, quasi nessun rischio, tempi brevi.
- **Equilibrato**: guadagno medio, rischio moderato.
- **Aggressivo**: guadagno alto, rischio di fallimento e affidabilità iniziale bassa.
- **Sperimentale**: nuovi concetti (es. dispositivi aero), possibilità di bocciatura regolamentare.
Fasi: progettazione → produzione (dipende dalla fabbrica) → test (banco/pista/collaudatore) →
omologazione → montaggio. I limiti regolamentari (congelamento motori, gettoni sviluppo,
concessioni) vincolano cosa si può sviluppare e quando.

## 8. Strutture
Reparto motori, telaio, aerodinamica, elettronica, fabbrica, centro telemetria, centro
simulazione, centro medico, palestra, accademia, hospitality, uffici commerciali.
Ogni struttura: livelli 1–5, costo di costruzione, tempo di lavori, manutenzione mensile,
benefici (es. centro medico: −% tempi di recupero; hospitality: +soddisfazione sponsor).

## 9. Weekend di gara
Formato configurabile da regolamento. Esempio Premier: conferenza stampa → FP1 → Prove valide
per la qualifica (top 10 in Q2) → FP2 → Q1/Q2 → Sprint → Warm-up → Gara.
Nelle prove: mandare in pista/richiamare, scegliere gomme, cambiare assetto, provare componenti,
simulazioni di passo, analizzare telemetria. In qualifica: gestione di traffico (cercare la scia
o il giro libero), meteo, gomme e numero di tentativi.

## 10. Strategie e comunicazioni
Prima della gara: mescole, mappa, obiettivo (vittoria, punti, gestione gomme), istruzioni
condizionali. Durante la gara, in base alla `radioPolicy` del regolamento:
- `none`: solo **pit board** (messaggi brevi e distacchi, visibili a fine rettilineo);
- `dashboard`: messaggi predefiniti sul cruscotto (es. cambio mappa, avviso bandiera, long lap);
- `full`: comunicazione libera (prevista come opzione regolamentare futura).
Il pilota può ignorare le indicazioni in base a personalità, morale e situazione.
Gara flag-to-flag: cambio moto ai box se cambia il meteo (tempo, personale, prontezza della seconda moto, gomme, assetto ed errori sono simulati: vedi TECH_TEAM §1.6).

## 11. Economia e sponsor
Entrate: sponsor, premi, diritti commerciali (quota per posizione nella classifica squadre),
investitori, merchandising, forniture tecniche. Uscite: stipendi, contratti, sviluppo,
produzione, trasferte (in base alla distanza dei circuiti), strutture, riparazioni (cadute),
logistica. Bilancio mensile, previsioni a 12 mesi, prestiti con interessi, rischio di
insolvenza (con conseguenze: vendita di asset, perdita del posto in griglia).
Sponsor: offerte in base a reputazione e visibilità; obiettivi (posizione, podi, mercati);
attività promozionali che consumano tempo dei piloti e influenzano morale e soddisfazione.

## 12. Media e rivalità
Conferenze con domande contestuali generate dagli eventi (cadute, contratti, risultati).
Le risposte (diplomatica, ambiziosa, polemica…) modificano reputazione, morale e relazioni.
Rivalità tra piloti nascono da contatti, battaglie ripetute, dichiarazioni; aumentano
l'aggressività negli scontri diretti.

## 13. Intelligenza artificiale
Ogni squadra IA ha un profilo (ambizione, prudenza finanziaria, priorità tecniche, propensione
a puntare sui giovani) e prende decisioni periodiche tramite **valutazione di utilità**
sugli stessi comandi del giocatore: mercato, rinnovi, staff, sponsor, R&D, strutture, strategie
di gara, voti sui regolamenti. Il successo cambia budget e reputazione: le squadre possono
crescere, declinare, cambiare costruttore o ritirarsi.

## 14. Regolamenti
Regolamento per categoria e stagione: punti, formato, penalità, peso minimo, carburante,
numero di motori, mescole, congelamenti, concessioni per costruttori in difficoltà.
Le modifiche vengono proposte (dalla federazione o dai costruttori) e votate dalla
commissione con gli interessi di ciascun membro; entrano in vigore nelle stagioni successive.

## 15. Salvataggi e storico
Salvataggio manuale, autosalvataggio, slot multipli, carriere pluriennali, archivio di ogni
stagione (classifiche, risultati, trasferimenti), storico di piloti e squadre, record e statistiche.

## 16. Squadra tecnica, Moto A/B e briefing (revisione Fase 0)

Obiettivo: rendere il Team Principal protagonista delle decisioni tecniche, costruendo una squadra
competente e scegliendo come sviluppare la moto durante il weekend. Specifica completa in
[TECH_TEAM.md](TECH_TEAM.md); qui la sintesi di design.

- **Moto A / Moto B**: ogni pilota ha (se il regolamento lo prevede) due moto con componenti,
  assetto, chilometraggio, usura, affidabilità, danni, manutenzione, prontezza e disponibilità propri.
  Usi tipici: A di riferimento e B sperimentale, oppure A asciutto e B bagnato. Un solo motore fisico
  per entrambe. Il confronto A/B è corretto per evoluzione della pista, carburante, gomme e temperatura
  e mostra sempre l'incertezza.
- **Briefing tecnico** dopo ogni sessione: il pilota descrive le sensazioni, ingegnere di pista e
  capotecnico propongono ipotesi e soluzioni con vantaggi/svantaggi incerti; il manager accetta,
  chiede un'altra analisi, confronta, sente il capotecnico, privilegia il pilota, mantiene o
  sperimenta sulla Moto B. Le decisioni cambiano davvero assetto, fiducia, rapporti e tempo disponibile.
  Delegabile.
- **Conoscenza imperfetta**: il motore conosce il problema reale; squadra e giocatore vedono solo
  dati, sensazioni e ipotesi. Nessuna soluzione perfetta viene rivelata automaticamente.
- **Mercato degli ingegneri** profondo quanto quello piloti: scouting con attributi a intervallo,
  giovani emergenti, specialisti, capotecnici, direttori tecnici; contratti con ruolo e pilota garantiti.
- **Crescita professionale**: le competenze crescono col lavoro svolto (sessioni, diagnosi, formazione,
  mentoring), la reputazione con i risultati. Potenziale individuale con curve diverse.
- **Rapporti pilota-staff**: fiducia, comunicazione, compatibilità, esperienza condivisa, comprensione
  dello stile, soddisfazione. Una coppia nuova può già funzionare bene; il tempo la migliora. Conflitti e
  interventi del manager.
- **Gestione in carriera**: licenziare, ingaggiare, promuovere, spostare fra piloti, rinnovare, bonus, corsi.
- **Weekend e meteo**: assetto base dalla libreria → briefing dopo ogni sessione → briefing finale
  pre-gara (strategia, gomme, carburante, scenari di pioggia, piano di emergenza). Previsioni incerte:
  dedicare tempo alla preparazione da bagnato è una scommessa.
- **IA**: le squadre avversarie usano gli stessi sistemi con le proprie risorse e informazioni.
