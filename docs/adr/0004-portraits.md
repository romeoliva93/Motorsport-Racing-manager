# ADR-0004 — Ritratti dei personaggi

- **Stato**: Proposto (in attesa di approvazione)
- **Data**: 2026-11-01

## Contesto
Ogni pilota e membro dello staff deve avere un volto riconoscibile, costante per tutta la carriera,
con l'abbigliamento della squadra attuale. Il mondo contiene centinaia di personaggi generati e ne
crea di nuovi ogni stagione (es. Velocity Rookies Cup). L'ambiente di sviluppo non dispone di uno
strumento di generazione di fotografie.

## Decisione
- Separare **identità visiva** (`Appearance`, generata dal seme del personaggio), **ritratto**
  (`PortraitAsset`: illustrato generato dal gioco oppure fotografia) e **abbigliamento** (`Outfit`, legato alla squadra).
- I ritratti sono **fotografie realistiche** (cartella `assets/portraits/<personId>.jpg` o content pack);
  le varianti di dimensione vengono create all'importazione.
- Senza foto si mostra un **segnaposto fotografico neutro**. Il ritratto illustrato generato dal codice è
  stato valutato e **scartato** in revisione perché non abbastanza realistico.
- Per i personaggi generati in grandi quantità (es. nuovi Rookies ogni stagione) servirà una pipeline di
  generazione immagini (servizio esterno o modello locale): da decidere prima della Fase 3.
- Il ritratto si compone a strati: sfondo → abbigliamento (colori squadra) → volto → capelli.
  Cambiando squadra cambia solo lo strato abbigliamento (per le foto: cornice e sfondo nei colori squadra).
- Linee guida per i contenuti: nessuna somiglianza intenzionale con persone reali; controllo dei nomi
  già previsto in `tools/content-check`.

## Alternative considerate
- **Solo fotografie**: impossibile coprire i personaggi generati ogni stagione senza un servizio di
  generazione immagini integrato (costi, licenze, dipendenza esterna).
- **Solo illustrazioni**: meno immersivo per i personaggi principali.

## Conseguenze
- (+) Volto stabile per tutta la carriera; abbigliamento separato dal volto.
- (−) Le foto sono un lavoro di contenuti separato; finché mancano compare un segnaposto.
- (−) Serve una soluzione per generare automaticamente foto dei personaggi creati durante la carriera.
