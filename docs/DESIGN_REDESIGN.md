# LEAN ANGLE — Redesign grafico premium (milestone 1)

## 1. Cosa prendiamo dalle 4 immagini di riferimento (solo composizione, identità originale)
- **Gara**: classifica live a sinistra, circuito grande al centro, due pannelli dei propri piloti a destra, barra di controllo in basso. Leggibilità a colpo d'occhio: numeri grandi, colori di stato, pochi testi.
- **Garage**: moto al centro, componenti selezionabili intorno con usura/affidabilità.
- **Piloti**: foto grande con numero sportivo accanto, schede a tab.
- Toni scuri con colori vivi solo dove c'è interazione o informazione importante.

## 2. Problemi della grafica precedente
- Il giallo era usato sia per le azioni sia per gli avvisi: confusione. Ora le azioni sono **arancioni** e il giallo vuol dire solo "attenzione".
- La vista gara aveva classifica e controlli staccati, senza dati dei propri piloti (gomme, carburante, affidabilità).
- Numeri piccoli e poco sportivi.

## 3. Design system v3 (`apps/client/src/design-system/tokens.css`)
| Ruolo | Colore |
|---|---|
| Azione primaria | arancio `--signal #ff7a1a` |
| Informazione / componenti | blu `--info #3d9bff` |
| Positivo | verde `--ok #34d17c` |
| Attenzione | giallo `--warn #ffc93d` |
| Pericolo | rosso `--bad #ff4d4d` |
Base scura (`--bg-*`), colore squadra come bordo/accento delle schede, numeri in corsivo pesante.

## 4. Nuova schermata gara (fatta)
- **Sinistra**: posizione, colore squadra, numero, bandiera, cognome, squadra, gomma (anello colorato S/M/H/W), distacco, ultimo giro.
- **Centro**: circuito 2D o 3D (stesso motore, stessa simulazione), fase di gara e ultimo messaggio della Direzione Gara sovrapposti.
- **Destra**: due pannelli dei propri piloti — foto (o casco), numero, posizione, gomma rimasta e usura, carburante, affidabilità moto, ritmo, ultimo e miglior giro.
- **Basso**: GIRO x/y grande, pausa e velocità, 2D/3D, inquadrature, salta.
- Tutti i dati vengono dalla simulazione: tempi sul giro e usura gomme ora sono registrati giro per giro dal motore di gara. Il carburante è una **stima** ricavata da avanzamento e capacità del serbatoio (22 L MotoGP, 24 L Moto2, 11 L Moto3/Rookies).

## 5. Confronto 2D vs 3D
| | 2D | 3D (Three.js, prototipo) |
|---|---|---|
| Leggibilità tattica | ottima | buona con camera "tutto il circuito" |
| Spettacolo | medio | alto |
| Peso | leggero | ~500 KB in più, caricato solo se richiesto |
| Telefoni modesti | fluido | da ottimizzare (LOD) |
Proposta: tenere il **2D come vista principale** e il 3D come opzione, finché il 3D non ha LOD, moto inclinate e telecamere TV. Non sostituisco il renderer principale senza approvazione.

## 6. Garage (fatto)
- Moto al centro, 14 componenti intorno: motore, cambio, frizione, catena, radiatori, scarico, telaio, forcellone,
  forcella, ammortizzatore, freno anteriore e posteriore, centralina, carena. Per ognuno: usura, affidabilità,
  km percorsi su vita prevista, revisioni fatte, livello di sviluppo.
- Moto A e B solo in MotoGP (le prove si dividono fra le due, qualifiche e gare sulla A).
- Collegato alla simulazione: l'usura oltre metà vita abbassa l'affidabilità della moto in gara (più guasti).
  Revisione singola o di tutti i pezzi oltre il 75%, pagata alla voce Riparazioni. Le squadre IA revisionano da sole.
- MotoGP: il motore segue la dotazione del regolamento (nuovo ogni 3 weekend).
- 3D: le moto piegano in curva (fino a ~50°), telecamera di inseguimento più vicina.

## 7. Immagini generate (gratis, in locale)
- Ritratti di piloti, staff e vivaio: `tools/portraits/generate.py` (SDXL-Turbo, ~10 s l'uno su CPU).
- Moto per costruttore e categoria: `tools/portraits/bikes.py`.
- Divise e carene descritte "semplici": il modello a volte disegna comunque piccoli loghi inventati; se uno
  ricorda un marchio reale si rigenera quel singolo file (`--only <chiave> --force`).

## 8. Prossime milestone (da approvare)
1. **Strategia in gara** (5 ritmi, 3 mappe carburante, modificabili mentre si corre): richiede di dividere la simulazione in segmenti giro per giro — modifica strutturale, serve approvazione.
2. 3D: telecamere TV/box/automatica, pubblico che reagisce, spruzzi e asfalto che si asciuga.
