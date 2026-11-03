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
   Stato al 3/11/2026: moto rifatte con img2img e varianti scelte per avere carene pulite; restano piccoli segni
   illeggibili su poche carene (es. Lupo Blu Junior, Pampas) e su alcune divise dei ritratti.

## Inventario degli asset
| Asset | Quantità | Origine | Dove |
|---|---|---|---|
| Ritratti personaggi | 567 (36 piloti rigenerati il 2/11, 2 nuovi piloti Moto2 il 3/11) | SDXL-Turbo, `tools/portraits/generate.py` | nel gioco `assets/atlas/` (4 fogli, `index.json` chiave → casella); nuovi ritratti in `tools/portraits/out/` poi `atlas.py --inplace` (riscrive solo i fogli toccati) |
| Gruppi tecnici garage | 7 | SDXL-Turbo, `tools/portraits/parts.py`; telaio con `tools/portraits/chassis.py` (disegno della sagoma → img2img), motore isolato scelto fra le varianti; scritta inventata tolta dall'immagine dei freni | `assets/parts/` |
| Foto moto per squadra (livrea della scuderia) | 41 | SDXL-Turbo **immagine → immagine** (forza 0,7) partendo dal disegno `BikeArt` nei colori della squadra: `render-liveries.cjs` (pagina `apps/client/livery.html`) → `teambikes.py` → scelta in `teams-choice.json` → `--install`. Stessa sagoma dell'illustrazione, colori esatti, nessuna scritta voluta | `assets/teambikes/` (garage e home) |
| Illustrazione moto (riserva per squadre senza foto) | codice | originale (SVG) | `design-system/BikeArt.tsx` |
| Modelli 3D moto/piloti | codice | originale (Three.js) | `race/bikeModel.ts` |
| Bandiere | 1 set | `flag-icons` (licenza MIT) | dipendenza npm |
| Libreria 3D | — | Three.js (licenza MIT) | dipendenza npm |
| Font | Archivo | Google Fonts (SIL Open Font License) | caricato dal browser |

Nessun marchio reale, nessun asset preso da altri videogiochi. Le immagini di riferimento fornite dall'utente
(infografica, schermate di altri giochi) sono usate solo come riferimento di composizione, non incluse nel gioco.
