# Pipeline degli asset fotorealistici

> Stato: **in preparazione — lotto di prova**. Scelta dell'utente: generazione **gratuita in locale**.

## 1. Strumenti verificati (1 novembre 2026)

| Possibilità | Esito |
|---|---|
| Strumenti di generazione immagini collegati alla sessione | nessuno |
| Chiavi API di servizi di immagini nell'ambiente | nessuna |
| Connettori MCP pertinenti | Hugging Face (non installato; generazione legata a quote gratuite limitate) |
| Servizi a pagamento (Replicate, OpenAI) | proposti con costi; **non scelti** dall'utente |
| Generazione locale su CPU | **scelta**: 4 core con AVX-512, 15 GB di RAM, nessuna GPU |

## 2. Modello e motore
- **FLUX.1-schnell** (Black Forest Labs, licenza **Apache 2.0**: uso commerciale consentito), versione compressa
  GGUF Q4_K_S + encoder T5 Q5_K_M (~11 GB di file, scaricati fuori dal repository).
- **stable-diffusion.cpp** (binding Python `stable-diffusion-cpp-python` 0.4.7), compilato con le istruzioni
  native della CPU. Generazione in 4 passi.
- **Requisito di rete**: download dei modelli da `huggingface.co` e dai suoi host di file (`*.huggingface.co`, `*.hf.co`).
  Oggi bloccati dalla politica di rete dell'ambiente: vanno aggiunti agli *Allowed domains*.
- Tempi attesi su questa CPU: indicativamente alcuni minuti per immagine (da misurare nel lotto di prova).

## 3. Flusso
```
tools/assets/manifest.json   identità permanenti (id, seed, aspetto, età, nazionalità, squadra, numero)
        │  tools/assets/generate.py  (prompt deterministico + seed fisso)
        ▼
assets/<cartella>/<id>/master.png   originale = riferimento permanente dell'identità
                       web.webp     ottimizzata per l'interfaccia (1024 px)
                       thumb.webp   miniatura (256 px)
                       meta.json    prompt, seed, modello, hash (cache e riproducibilità)
```
- **Cache**: un soggetto con lo stesso hash non viene rigenerato.
- **Controllo qualità**: ogni immagine viene esaminata (realismo, età, tuta e livrea, difetti di mani/occhi,
  testo illeggibile); se ha difetti si rigenera con `--seed-offset` e il seed definitivo viene salvato nel manifest.
- **Mockup**: leggono `web.webp`/`thumb.webp` per id; dove manca l'immagine compare il segnaposto.

## 4. Cartelle
`assets/riders`, `assets/rookies`, `assets/engineers`, `assets/crew`, `assets/bikes/<id>/<vista>`,
`assets/liveries`, `assets/teams`, `assets/circuits`, `assets/environments`. Identificativi stabili:
`rdr-…` piloti, `rky-…` Rookies, `eng-…` ingegneri, `crw-…` personale, `bk-…` moto.

## 5. Identità persistente, cambi di squadra, invecchiamento
- L'identità è definita da **seed + descrizione dell'aspetto + master.png** (archiviata, mai rigenerata
  dopo l'approvazione).
- **Cambio squadra** e **invecchiamento**: si parte dalla master come immagine di riferimento e si modifica
  solo tuta/colori o età. Il motore supporta immagini di riferimento ed editing guidato; i modelli di editing
  con licenza commerciale libera (es. Qwen-Image-Edit, Apache 2.0) richiedono più memoria di quella
  disponibile qui: da valutare con una macchina con GPU o un servizio esterno, **prima della Fase 3**.
  Alternativa leggera: maschera della tuta e ricolorazione/inpainting della sola area dell'abbigliamento.
- Nuovi personaggi a ogni stagione (es. Rookies): stesso flusso, generati **in fase di sviluppo dei contenuti
  o su richiesta esplicita dell'utente**, mai automaticamente durante la partita con servizi a pagamento.

## 6. Moto: viste multiple
Le viste (tre quarti, laterale, frontale, posteriore, dall'alto) sono generate con lo stesso seed e la stessa
descrizione, ma un generatore 2D **non garantisce geometria identica** fra le viste. Per una coerenza esatta
servirà un modello 3D per ciascun costruttore (Fase 6) oppure un modello di editing a partire dalla vista
principale. Il lotto di prova mostrerà il livello di coerenza ottenibile.

## 7. Ottimizzazione e repository
- Interfaccia: WebP (qualità 82), miniature per tabelle e liste, caricamento progressivo (miniatura → web),
  `loading="lazy"`, cache in memoria con limite, originali caricati solo su richiesta (es. zoom).
- Dimensioni stimate: master ~1–2 MB, web ~100–200 KB, miniatura ~15 KB per soggetto. Database iniziale
  (~300 soggetti + moto) ≈ 0,5–0,8 GB di originali: si propone **Git LFS** per `master.png` (quota gratuita
  GitHub: 1 GB di spazio e 1 GB di banda al mese) — da attivare con il tuo consenso prima della produzione completa.
- Nessuna credenziale nel repository; i file del modello restano fuori dal repository.
