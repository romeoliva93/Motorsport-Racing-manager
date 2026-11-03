# Design system — "Paddock Night"

Interfaccia scura da box di gara, colori vivaci solo dove servono. File: `apps/client/src/design-system/`
(`tokens.css` → colori e misure, `app.css` → componenti, `skin.css` → tema Paddock Night).

## Colori funzionali
| Ruolo | Token | Uso |
|---|---|---|
| Azione | `--signal` arancio | pulsanti principali, selezione, accenti dei pannelli |
| Informazione | `--info` blu | dati tecnici, componenti, suggerimenti |
| Positivo | `--ok` verde | condizioni buone |
| Attenzione | `--warn` giallo | usura alta, avvisi |
| Pericolo | `--bad` rosso | guasti, fine vita, errori |
| Squadra | `--team` | impostato dalla shell col colore della scuderia (barra laterale, bagliore, pannello "accent") |

## Grammatica visiva
- Pannelli con angolo superiore destro tagliato e filo arancio; titoli condensati, corsivi, maiuscoli.
- Pulsanti, chip, schede e selettori a parallelogramma; il pulsante principale è arancio in maiuscolo.
- Tabelle con intestazioni piccole e spaziate, righe alternate.
- Numeri di gara grandi in corsivo condensato; bandiere `flag-icons`; ritratti dagli atlanti.

## Regole
- Nessun pulsante senza funzione; nessun dato inventato nelle schermate operative.
- Ogni valore mostrato viene dalle viste del motore (`packages/game/src/views.ts`).
- Testi in italiano; importi in euro (milioni sopra 100 mila).
- La moto della squadra ha una sola rappresentazione: `TeamBike` (foto nella livrea, illustrazione come riserva).
- 2D è la vista di gara principale; 3D opzionale e congelato.
