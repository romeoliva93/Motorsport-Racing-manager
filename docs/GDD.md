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
| Premier | VWC Premier | Prototipi 1000 cc, 4 cilindri (regolamento modificabile) | costruttori, concessioni, sviluppo libero entro limiti; **2 moto per pilota (A/B)** |
| Intermediate | VWC Intermediate | Motore unico 800 cc tre cilindri *Orvane*, telai dei costruttori di telai | sviluppo telaio/sospensioni, elettronica unica; **1 moto per pilota** |
| Lightweight | VWC Lightweight | 250 cc monocilindrico | limite di età 28 anni, costi bassi; **1 moto per pilota** |
| Feeder | **Velocity Rookies Cup** | monomarca Lysander R250 Rookies, **1 moto per pilota** | 13–17 anni, nuovi piloti ogni stagione, vetrina per gli scout |
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
Circuit de Serrablanca · Circuit des Hautes Landes · Autodromo del Mugnone · Brennholz-Ring ·
Vltava Ring · Rijnvaart Circuit · Lakeside Park Raceway · Dunavár Circuit · Circuito do Atlântico ·
Circuito Riviera di Coriano · Anatolia Park · Phang-Rai International · Pulau Hijau Circuit ·
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

## 17. Moto per categoria, infortuni, sostituti e collaudatori (revisione Fase 0)

Specifiche: [REGULATIONS.md](REGULATIONS.md) e [INJURIES_AND_TESTERS.md](INJURIES_AND_TESTERS.md).

- **Moto per pilota dipendenti dalla categoria** (valori iniziali, configurabili da regolamento):
  Velocity Rookies Cup 1 (monomarca), Lightweight 1, Intermediate 1, **Premier 2 (Moto A e Moto B)**.
  Il sistema A/B completo (configurazioni, confronto, preparazione, flag-to-flag) esiste solo in Premier;
  nelle altre categorie l'interfaccia mostra un'unica moto e nessun comando per la seconda.
- **Infortuni** con durata in giorni confrontata col calendario (1, 2, 3, 4, 5 o più gare), visita di idoneità obbligatoria.
- **Decisione del Team Principal** per ogni evento: A) schierare il collaudatore, B) ingaggiare un
  sostituto con contratto temporaneo, C) **non schierare nessuno** (posto vacante, nessuna penalità se non prevista).
  Anteprima delle conseguenze sportive, economiche e regolamentari prima della conferma.
- **Rientro del titolare** con notifica, idoneità, fine dell'incarico del sostituto, storico delle assenze.
- **Collaudatori** con feedback tecnico e capacità di sviluppo che determinano la qualità dei test.
- **Sessioni di test** in pre-stagione e in stagione (Premier circa ogni 5 GP).
- **Velocity Rookies Cup**: monomarca, tute identiche, nuovi piloti ogni anno dai campionati nazionali,
  promozioni in Lightweight, storie di carriera generate (es. Fabrizio Vitellino).
- **IA**: le squadre avversarie scelgono fra le stesse tre opzioni in base a budget, obiettivi, durata
  dell'assenza, collaudatori, mercato, classifica e regolamento.

## 18. Mercato e creazione squadra (Fase 1, prima versione giocabile)

- **Nomi provvisori delle categorie**: MotoGP, Moto2, Moto3 (+ Rookies Cup), su richiesta durante lo sviluppo.
  Da sostituire con nomi originali prima di qualunque distribuzione pubblica.
- **Valuta**: euro; l'interfaccia mostra sempre gli importi in milioni (es. € 25,02 mln).
- **Mercato piloti** aperto fino al primo Gran Premio, su tutti i piloti (liberi o sotto contratto, di ogni
  categoria). Il giocatore va dal pilota, vede il contratto che ha (stipendio, scadenza, bonus, clausola) e fa
  un'offerta (stipendio, durata 1–3 anni, ruolo, bonus vittoria/podio, chi lascia il posto). Il pilota accetta,
  rifiuta o fa una controproposta; ogni offerta consuma pazienza. Formule in `packages/game/src/market.ts`.
- **Firma**: clausola pagata alla squadra di provenienza, pilota sostituito liberato con indennità (50% del residuo),
  capotecnico, ingegnere di pista e moto riassegnati; la squadra che perde un pilota ingaggia il miglior libero idoneo.
- **Crea la tua squadra**: nome, sigla, nazionalità, sede, colori, categoria, tipologia (privata, indipendente,
  satellite) e costruttore; staff tecnico di partenza e due posti liberi da riempire al mercato.


## 19. Moto, upgrade e sponsor con obiettivo (implementato)

**Upgrade.** Sette componenti, livello 0 (di serie) → 3. Il livello *n* costa *n* × costo base della categoria
(MotoGP 0,9 mln, Moto2 0,18 mln, Moto3 0,07 mln) e si paga subito alla voce "Sviluppo". Ogni livello aggiunge
alla qualità della moto (scala 0–1): motore 0,020, freni 0,012, telaio 0,012, aerodinamica 0,012,
sospensioni 0,010 (+5% gestione gomme), elettronica 0,006 (+2,5% affidabilità), scarico 0,006.
In gara la prestazione è 0,6 × pilota + 0,4 × moto. Sul disegno la moto di serie è nera e ogni componente
potenziato si accende del suo colore. Le squadre IA comprano un upgrade il 1° del mese con probabilità 35%
se hanno in cassa almeno 4 volte il costo.

**Sponsor con obiettivo.** Prima del primo GP si sceglie una fra tre offerte; l'obiettivo è la posizione nella
classifica squadre, calcolata dalla posizione attesa (classifica per reputazione):

| Offerta | Obiettivo | Rata mensile | Premio finale |
|---|---|---|---|
| Prudente | attesa + 2 | 15% della rata sponsor base | 1 × rata base |
| Equilibrata | attesa | 30% | 2,5 × |
| Ambiziosa | attesa − 2 | 55% | 5 × |

**Caschi.** Ogni scuderia ha un casco con un disegno proprio (motivo grafico e tinta della visiera ricavati dal
nome) e i colori ufficiali; il numero cambia per pilota. Sostituiscono i monogrammi finché non ci saranno
fotografie.

## 20. Formato gara e gomme (versione giocabile)

**Giri:** MotoGP 15, Moto2 13, Moto3 12, Rookies Cup 10.

**Gomme.** Perdita per giro rispetto alla media nuova: morbida −0,6% ma consuma 0,17% per giro di età,
media 0% / 0,063%, dura +0,3% / 0,02%. Il consumo si moltiplica per (1,3 − 0,6 × gestione gomme), per il ritmo
(prudente 0,85, normale 1, attacco 1,3) e per 14/(giri − 1), così l'equilibrio non cambia con la lunghezza
della gara. Risultato: la morbida conviene a chi tratta bene le gomme o va prudente, la dura a chi le consuma o
attacca, la media al pilota medio; le differenze su una gara vanno da pochi decimi a qualche secondo.
Prima della gara l'ingegnere mostra per ogni mescola i secondi stimati persi rispetto alla migliore; le squadre
IA usano la stessa previsione con un margine d'errore.

## 21. Weekend completo, gomme, meteo, piste, tempi di fabbrica

**Formato** (un giorno di gioco, sessioni etichettate venerdì/sabato/domenica):
- MotoGP: Prove libere 1 · Prove (i primi 10 in Q2) · Prove libere 2 · Q1 (i primi 2 salgono in Q2) · Q2
  (griglia 1–12) · Sprint (metà giri; 12-9-7-6-5-4-3-2-1 punti) · Gara.
- Moto2/Moto3: Prove libere 1 · Prove (primi 14 in Q2) · Q1 (primi 4) · Q2 · Gara. Rookies: PL1 · Qualifica · Gara.
- Vittorie e podi in classifica contano solo la gara della domenica; la Sprint dà punti e premi.

**Gomme.** Dotazione per pilota e weekend (MotoGP 4 morbide, 4 medie, 3 dure, 5 da pioggia; Moto2/Moto3 3-3-2-4;
Rookies 2-2-1-3). Ogni sessione consuma un treno nuovo della mescola scelta, prove libere comprese; una mescola
finita non si può più scegliere. Nelle sessioni a tempo la morbida è la più veloce sul giro secco.

**Meteo.** Clima per paese (temperatura media, escursione stagionale, emisfero, probabilità di pioggia) e
sequenza di condizioni per sessione con persistenza. Aria = media del mese ± variazione del weekend (max ±4 °C) +
ora del giorno − nuvole; asfalto = aria + 18 (sereno) / 12 / 5 / 1 (pioggia). Asfalto bagnato con pioggia,
umido con pioggerella o subito dopo la pioggia. Effetti: slick +4% (umido) / +16% (bagnato), gomme da pioggia
+3,5% / +7% ma sull'asciutto +7% e consumo ×3; rischio di caduta ×1,7 umido, ×2,2 bagnato (×2,5 in più con le
slick); consumo delle slick +1,2% per grado di asfalto sopra 35 °C. Prima di ogni sessione si vede la probabilità
di pioggia annunciata; circa il 15% delle sessioni non è asciutto.

**Piste disegnate.** Autodromo del Mugnone (sul modello del Mugello) e Circuito Riviera di Coriano (Gran Premio
di San Marino, sul modello di Misano) hanno un tracciato fisso; gli altri circuiti sono generati dal nome.

**Upgrade in fabbrica.** L'upgrade si ordina e si paga subito; viene montato alla consegna dopo
giorni = base (motore e telaio 21/28/35, aerodinamica 14/21/28, sospensioni 12/16/21, freni ed elettronica
10/14/18, scarico 7/10/14) × (1,3 − 0,1 × livello medio dei reparti tecnici, fra 0,7 e 1,3).
Un solo ordine alla volta per componente.

## 22. Long Lap Penalty

Versione di gioco del regolamento MotoGP, uguale per MotoGP, Moto2, Moto3 e Rookies Cup:
- **Limiti della pista**: nella Sprint la Long Lap arriva alla 3ª infrazione; in gara alla 5ª, con avviso alla 3ª.
  Probabilità di infrazione per giro = 4,2% × ritmo (attacco 2, normale 1, prudente 0,4) × (1,35 − concentrazione)
  × (1 + aggressività/2) × 1,4 sul bagnato. Oltre i limiti all'ultimo giro guadagnandoci: una posizione in meno.
- **Partenza anticipata**: doppia Long Lap. **Contatto in sorpasso**: una Long Lap (e il pilota toccato perde ~1 s).
- **Come si sconta**: entro 3 giri, passando nell'anello asfaltato all'esterno della curva più lenta del circuito
  (diverso per ogni pista, disegnato sulla mappa); costa il 2,2% del giro di riferimento (≈ 2,6 s su 2 minuti) più la
  strada persa; la doppia si sconta in due giri diversi.
- **Se non c'è più tempo**: ogni Long Lap rimasta diventa una penalità in secondi di pari durata, aggiunta al tempo finale.
- Frequenze misurate su 60 gare simulate: ~15 avvisi per i limiti della pista e ~0,6 Long Lap a gara.
