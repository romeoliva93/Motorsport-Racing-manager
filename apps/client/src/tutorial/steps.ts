/**
 * Tutorial per i nuovi giocatori: un passo per ogni sistema del gioco, con la schermata da aprire.
 * I testi descrivono il gioco com'è (niente funzioni promesse): se un sistema cambia, va aggiornato qui.
 */
import type { Section } from '../shell/Shell.tsx';

export interface TutorialStep {
  id: string;
  title: string;
  /** Schermata da mostrare con "Mostrami" (solo dentro una carriera). */
  section?: Section;
  intro: string;
  points: string[];
  tip?: string;
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Benvenuto nel paddock',
    intro:
      'Sei il manager di una squadra del motomondiale. Non guidi la moto: scegli i piloti, prepari la moto e il weekend, decidi la strategia e fai quadrare i conti.',
    points: [
      'Obiettivo: fare punti, rispettare l’obiettivo dello sponsor e non finire senza soldi.',
      'Il tempo avanza solo quando lo decidi tu, con il pulsante rosso in alto a destra: indica sempre il prossimo passo («Vai al Gran Premio», «Vai al weekend», «Chiudi la stagione»).',
      'Piloti, squadre, circuiti e marchi sono inventati: il mondo di partenza è lo stesso in ogni nuova carriera.',
    ],
    tip: 'Puoi riaprire questa guida quando vuoi dal pulsante «Guida» in basso a sinistra.',
  },
  {
    id: 'makers',
    title: 'Costruttori e squadre',
    section: 'paddock',
    intro:
      'Come nel mondiale: ogni costruttore (scuderia) ha la sua squadra ufficiale e fornisce le moto alle squadre clienti (satellite, indipendenti, private).',
    points: [
      'Si parte sempre da una squadra cliente: le squadre ufficiali appartengono ai costruttori.',
      'All’inizio scegli il costruttore che ti fornisce le moto. Ognuno offre agevolazioni diverse (moto più veloce, affidabilità, gomme, upgrade scontati o più rapidi, contributo alla firma) e chiede un canone annuo, pagato ogni mese.',
      '«Squadre e piloti» mostra tutte le squadre della categoria raggruppate per costruttore, con piloti, valutazioni e punti.',
      'In Classifiche trovi piloti, team, scuderie (costruttori) e indipendenti.',
    ],
  },
  {
    id: 'home',
    title: 'La Home',
    section: 'overview',
    intro: 'La Home riassume tutto quello che conta oggi.',
    points: [
      'Gran Premio: il prossimo circuito con lunghezza, curve, giri e previsione meteo.',
      'Da fare: le cose in sospeso (sponsor da scegliere, mercato aperto, assetto da rivedere…). Cliccale per andarci.',
      'I tuoi piloti: valutazione, morale, posizione in campionato e ultimo risultato.',
      'La tua moto: affidabilità in gara e qualità rispetto agli avversari.',
      'Prima della prima gara trovi la lista «Preparazione alla stagione»; poi lì compare la classifica.',
    ],
  },
  {
    id: 'sponsor',
    title: 'Lo sponsor',
    section: 'sponsors',
    intro: 'Prima del primo Gran Premio scegli lo sponsor della stagione. Si firma una volta all’anno.',
    points: [
      'Sicuro: meno soldi, obiettivo facile.',
      'Bilanciato: via di mezzo.',
      'Ambizioso: più soldi ma un obiettivo difficile; se non lo raggiungi incassi meno a fine stagione.',
      'Lo sponsor paga ogni mese ed è la tua entrata principale insieme ai premi per i punti.',
    ],
    tip: 'Guarda la posizione prevista della squadra prima di scegliere: un obiettivo irrealistico costa caro.',
  },
  {
    id: 'riders',
    title: 'I tuoi piloti',
    section: 'riders',
    intro:
      'Ogni pilota ha attributi (frenata, ingresso curva, gestione gomme, carburante, sorpasso…), carattere e contratto.',
    points: [
      'Morale: sale con i buoni risultati e scende con quelli brutti; torna lentamente verso la normalità.',
      'Forma: dipende dalle ultime gare e vale in pista (fino a ±1% di ritmo).',
      'Il feedback tecnico decide quanto sono chiari i suoi commenti sull’assetto.',
      'Passa da un pilota all’altro con le schede in alto.',
    ],
  },
  {
    id: 'market',
    title: 'Il mercato piloti',
    section: 'market',
    intro: 'Qui ingaggi piloti nuovi o rinnovi i tuoi.',
    points: [
      'Fai un’offerta: stipendio annuo e anni di contratto. Il manager del pilota accetta, rifiuta o fa una controproposta.',
      'Puoi accettare la controproposta, rilanciare o chiudere la trattativa.',
      'Un nuovo pilota prende il posto di uno dei tuoi: scegli chi lasciare.',
      'I piloti sotto contratto si trattano fino al primo Gran Premio e a fine stagione; gli svincolati (filtro «Svincolati») si ingaggiano in ogni momento.',
      'Nella scheda «Personale tecnico» trovi capotecnici, ingegneri, meccanici e dirigenti svincolati: il capotecnico si assegna a un pilota, più meccanici rendono più rapide le modifiche fra le sessioni.',
    ],
    tip: 'Uno stipendio alto pesa su ogni mese: controlla le Finanze prima di firmare.',
  },
  {
    id: 'garage',
    title: 'La moto e il garage',
    section: 'bike',
    intro:
      'Al centro c’è la moto della squadra; intorno, i gruppi tecnici (motore, telaio, sospensioni, freni, aerodinamica, elettronica: dipende dalla categoria).',
    points: [
      'Ogni gruppo ha livello di sviluppo, prestazione, usura e stato. Clicca una scheda: la zona della moto si illumina e sotto vedi i dettagli.',
      'Manutenzione: Automatica (ci pensa il capotecnico), Assistita (ti avvisa) o Manuale (decidi tu). Telaio e forcellone li decidi sempre tu.',
      'Ricambi: comprali in anticipo e montali quando un gruppo è usurato. Pezzi consumati = più rischio di guasto in gara.',
      'Upgrade: il ▲ indica che puoi ordinare il livello successivo alla fabbrica; arriva dopo alcuni giorni (⚙ = in produzione).',
      'In MotoGP ogni pilota ha Moto A e Moto B e i motori per la stagione sono limitati.',
    ],
  },
  {
    id: 'setup',
    title: 'L’assetto',
    section: 'bike',
    intro:
      'Nella scheda «Assetto» del garage regoli la moto di ogni pilota, per l’asciutto e per il bagnato.',
    points: [
      'Precarico forcella, mono, altezza, rapporti, freno motore, controllo di trazione (secondo la categoria), da −5 a +5.',
      'Il pilota commenta ogni regolazione; l’intesa con l’assetto vale fino a ±1,5% di ritmo.',
      'L’assetto ideale dipende dal pilota e dal circuito: va ritrovato a ogni Gran Premio.',
      'Durante il weekend hai 45 minuti di lavoro fra una sessione e l’altra: le modifiche grosse non ci stanno.',
    ],
  },
  {
    id: 'staff',
    title: 'Il personale tecnico',
    section: 'staff',
    intro: 'Ogni pilota lavora con un capotecnico e un ingegnere di pista.',
    points: [
      'Il capotecnico prepara la moto, dà il consiglio sull’assetto nella riunione tecnica e decide quanto durano le modifiche.',
      'Più sono bravi (e più c’è intesa con il pilota), più i consigli sono precisi.',
    ],
  },
  {
    id: 'weekend',
    title: 'Il weekend di gara',
    section: 'weekend',
    intro:
      'Premi «Vai al Gran Premio»: i giorni scorrono fino al weekend. Le sessioni si corrono una alla volta.',
    points: [
      'MotoGP: Prove libere 1 · Prove (i primi 10 vanno direttamente in Q2) · Prove libere 2 · Q1 · Q2 · Sprint · Warm Up · Gara.',
      'Moto2 e Moto3: Prove libere 1 · Prove (primi 14 in Q2) · Q1 · Q2 · Gara. Rookies Cup: libere, qualifica unica, gara.',
      'Ogni pilota ha un numero limitato di gomme per tutto il weekend: ogni sessione ne usa un treno.',
      'Prima di ogni sessione scegli la gomma; l’ingegnere suggerisce sempre una scelta e spiega perché.',
      'Prove e qualifiche si seguono nella schermata tempi: ogni settore si colora al passaggio (rosso miglior tempo assoluto, arancio miglior tempo personale, grigio più lento).',
      '«Simula il resto del weekend» corre tutto in automatico, gara compresa.',
    ],
  },
  {
    id: 'practice',
    title: 'Prove e riunione tecnica',
    section: 'weekend',
    intro: 'Nelle prove libere scegli per ogni pilota un programma di lavoro.',
    points: [
      'Circuito: tanti giri, cresce la confidenza col circuito.',
      'Assetto: la confidenza con la moto si avvicina all’intesa con l’assetto e i commenti del pilota diventano più chiari.',
      'Passo gara: dati sulle gomme, in gara il pilota le gestisce meglio.',
      'Dopo ogni uscita c’è la Riunione tecnica: confidenza, commenti del pilota, consiglio del capotecnico (pulsante «Applica») e cronologia di uscite e modifiche.',
      'La confidenza vale in pista per tutti, avversari compresi (fino a ±1% di ritmo).',
    ],
  },
  {
    id: 'race',
    title: 'La gara in diretta',
    section: 'weekend',
    intro:
      'Sprint e gara si guardano in diretta, in 2D (vista principale) o in 3D, e le decisioni contano mentre si corre.',
    points: [
      'Velocità da 1× a 16×, pausa, cambio 2D / 3D / Tempi senza effetti sulla gara.',
      'Ritmo a 5 livelli (da molto prudente ad attacco massimo): più veloce = più usura, più consumo, più rischio di caduta.',
      'Carburante: risparmio, standard, prestazione. Se finisce, il pilota si ritira: tieni d’occhio «carburante per N giri».',
      'Gomme: conservativa, bilanciata, prestazionale.',
      'Gli avversari usano le stesse leve. Ci sono penalità (Long Lap, limiti della pista), bandiere gialle e rosse, guasti.',
      'Puoi salvare a metà gara e riprendere esattamente dallo stesso punto. «Salta alla fine» chiude la gara subito.',
    ],
  },
  {
    id: 'after',
    title: 'Dopo la gara',
    section: 'championship',
    intro: 'A bandiera a scacchi il gioco aggiorna tutto da solo.',
    points: [
      'Punti e classifiche piloti, squadre e costruttori; premi in denaro.',
      'Forma e morale dei piloti; usura e chilometri dei pezzi della moto.',
      'Notizie sulla gara e sul mercato. Il calendario mostra le gare corse e quelle che mancano.',
    ],
  },
  {
    id: 'money',
    title: 'Le finanze',
    section: 'finance',
    intro: 'Una squadra senza soldi non va lontano.',
    points: [
      'Entrate: sponsor (ogni mese), premi per i punti.',
      'Uscite: stipendi di piloti e personale, gestione, canone di fornitura del costruttore, trasferte, ricambi, revisioni e upgrade.',
      'La Home mostra entrate e uscite del mese: se le uscite superano le entrate, rimedia prima che la cassa finisca.',
    ],
  },
  {
    id: 'manager',
    title: 'Il manager: stipendio e carriera',
    section: 'manager',
    intro:
      'Anche tu hai un contratto: la squadra ti paga uno stipendio ogni mese, che finisce nei tuoi soldi personali.',
    points: [
      'Con i tuoi soldi puoi fare corsi: Negoziazione (piloti e tecnici chiedono meno), Rapporti commerciali (sponsor più ricchi), Gestione tecnica (modifiche d’assetto più rapide).',
      'Oppure puoi investirli nella squadra, per upgrade e ingaggi.',
      'La reputazione cresce se la squadra fa meglio delle attese. A fine stagione chi fa bene riceve offerte: la squadra forte paga di più, quella media offre meno ma porta un pilota di punta, quella debole garantisce la moto migliore ma ha piloti modesti.',
      'Lo stipendio si tratta: la squadra accetta, rilancia o al terzo rifiuto si ritira. Firmando passi subito alla nuova squadra.',
    ],
  },
  {
    id: 'save',
    title: 'Salvare e fine stagione',
    intro: 'La partita si salva nel browser.',
    points: [
      '«Salva» in basso a sinistra; «Menu» torna al menu principale, dove trovi «Continua carriera» e «Carica partita».',
      'Puoi salvare anche durante una gara in diretta.',
      'Dopo l’ultima gara premi «Chiudi la stagione»: riepilogo, campioni, contratti in scadenza; poi inizia la stagione successiva.',
    ],
  },
  {
    id: 'checklist',
    title: 'Da dove cominciare',
    section: 'overview',
    intro: 'Una routine semplice per i primi Gran Premi:',
    points: [
      '1. Firma lo sponsor.',
      '2. Controlla piloti e contratti; se serve, cerca rinforzi sul mercato.',
      '3. Ordina un upgrade e lascia la manutenzione in Automatica.',
      '4. Vai al Gran Premio; nelle libere usa il programma Assetto e applica i consigli del capotecnico.',
      '5. In qualifica gomma morbida; in gara parti con il ritmo normale e cambia se serve.',
      '6. Salva spesso.',
    ],
    tip: 'Buona fortuna: il campionato è lungo.',
  },
];
