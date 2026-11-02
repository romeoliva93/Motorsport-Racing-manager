# Asset, provenienza e licenze

> Documento tecnico, non parere legale. Prima di una distribuzione commerciale conviene una verifica legale.

## Modello di generazione immagini
| Voce | Valore |
|---|---|
| Modello | `stabilityai/sdxl-turbo` (variante pesi fp16), eseguito in locale su CPU, 4 passi, guidance 0 |
| Librerie | `diffusers` 0.42, `torch` 2.15 (CPU), `transformers` |
| Licenza | **Stability AI Community License**, ultima modifica 5 luglio 2024 (letta dal file `LICENSE.md` del modello il 2/11/2026) |
| Costo | nessuno |

### Cosa dice la licenza (sintesi)
- **Uso non commerciale/ricerca**: consentito gratuitamente.
- **Uso commerciale**: consentito gratuitamente se l'organizzazione (con le affiliate) ha **meno di 1 milione di
  dollari di ricavi annui**; serve **registrarsi** presso Stability AI (stability.ai/community-license). Oltre la
  soglia la licenza termina e serve una licenza Enterprise.
- **Output (le immagini)**: "nei rapporti con Stability AI" appartengono a chi le genera, **nei limiti della legge
  applicabile**. In alcuni ordinamenti (es. USA) le immagini generate da IA senza apporto umano sufficiente possono
  non essere proteggibili da copyright: altri potrebbero riusarle.
- Gli output **non** sono "Derivative Works": gli obblighi di attribuzione (file "Notice", "Powered by Stability AI")
  riguardano chi distribuisce il modello o sue modifiche. Il gioco distribuisce solo immagini, non il modello; per
  prudenza si può comunque citare il modello nei crediti.
- Vietato usare gli output per addestrare altri modelli di base; rispetto della Acceptable Use Policy.

### Azioni prima di vendere il gioco
1. Registrazione gratuita alla Community License (se ricavi < 1 M$).
2. Verifica legale sulla proteggibilità delle immagini nel paese di pubblicazione.
3. Controllo visivo finale di loghi casuali (il modello a volte disegna scritte inventate su divise e carene).

## Inventario degli asset
| Asset | Quantità | Origine | Dove |
|---|---|---|---|
| Ritratti personaggi | 567 (36 piloti rigenerati il 2/11) | SDXL-Turbo, `tools/portraits/generate.py` | originali `assets/portraits/`, nel gioco `assets/atlas/` (4 fogli) |
| Gruppi tecnici garage | 7 | SDXL-Turbo, `tools/portraits/parts.py` | `assets/parts/` |
| Foto moto per squadra (livrea della scuderia) | 41 | SDXL-Turbo, `tools/portraits/teambikes.py` (2 varianti, scelta in `teams-choice.json`) | `assets/teambikes/` (garage e home) |
| Foto moto per costruttore | 13 | SDXL-Turbo, `tools/portraits/bikes.py` | `assets/bikes/` (archivio, non usate nelle schermate) |
| Illustrazioni moto (profilo e dall'alto) | codice | originale (SVG) | `design-system/BikeArt.tsx`, `BikeTop.tsx` |
| Modelli 3D moto/piloti | codice | originale (Three.js) | `race/bikeModel.ts` |
| Bandiere | 1 set | `flag-icons` (licenza MIT) | dipendenza npm |
| Libreria 3D | — | Three.js (licenza MIT) | dipendenza npm |
| Font | Archivo | Google Fonts (SIL Open Font License) | caricato dal browser |

Nessun marchio reale, nessun asset preso da altri videogiochi. Le immagini di riferimento fornite dall'utente
(infografica, schermate di altri giochi) sono usate solo come riferimento di composizione, non incluse nel gioco.
