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

## 9. Gara in 2D e 3D — prototipo comparativo (fatto)
**Architettura.** Un solo motore di gara (`packages/sim`) calcola tutto prima del via; la vista riceve i
fotogrammi e gli eventi. `apps/client/src/race/raceState.ts → raceFrame(t)` è l'unica funzione che, dato l'istante,
restituisce classifica, posizioni, giro, bandiere, cadute, battaglie, meteo. Il 2D (`circuitScene.ts`) e il 3D
(`Race3D.tsx` + `bikeModel.ts`) disegnano lo stesso risultato. Tempo, velocità e pausa vivono nel visore: cambiare
vista non li tocca. Classifica a sinistra, pannelli piloti a destra e barra comandi sono gli stessi nelle due viste.

**2D.** Moto viste dall'alto che ruotano col tracciato, nei colori della squadra, con numero; pilota selezionato
(clic sulla moto o sulla classifica) con anello e seguito dalla telecamera; battaglie (< 0,6 s) evidenziate; tratto
in bandiera gialla colorato; rotella = zoom, trascina = sposta, "Vista completa" per tornare.

**3D.** Moto per categoria (MotoGP con alette e codone alto, Moto2, Moto3, Rookies) con carena a sezioni,
cupolino, ruote con dischi e pinze, forcella, forcellone, scarico, numero su muso e codone; pilota con casco e
visiera, tuta in due colori, guanti, stivali, che piega e si sposta verso l'interno curva. Asfalto con grana (lucido
sul bagnato), erba e ghiaia con texture, pannelli pubblicitari originali, pubblico che esulta (battaglie, ultimo giro,
traguardo), commissari con bandiere gialle/rosse, pioggia e spruzzi. Telecamere: Regia automatica, TV, Inseguimento,
Bordo pista, Box, Panoramica. LOD (moto semplificate da lontano), parti fuse per materiale, qualità Bassa/Media/Alta.

**Preferenze.** Menu principale → Impostazioni: vista preferita (2D/3D) e qualità 3D, salvate nel browser. Senza
WebGL il 3D è disattivato e la gara resta in 2D; se il 3D si guasta durante la gara si torna al 2D senza fermarla.

**Prestazioni misurate** (stessa Sprint, 1920×1080, macchina cloud *senza scheda grafica*: il 3D è disegnato dal
processore, quindi i valori assoluti del 3D sono molto più bassi di un PC reale; conta il confronto):
| Vista | fotogrammi/s | caricamento |
|---|---|---|
| 2D | 60 | immediato |
| 3D bassa | 5,8 | 1,6 s |
| 3D media | 3,7 | 1,6 s |
| 3D alta (ombre) | 3,3 | 2,4 s |
10 cambi 2D↔3D consecutivi: memoria JS invariata (29 → 29 MB), un solo contesto 3D attivo.

**Test.** `raceState.test.ts`: stessa t → stesse posizioni; selezione/vista non cambiano classifica; il giro non
torna indietro; all'arrivo la classifica coincide col risultato della simulazione (ha trovato e corretto un errore
di ordine all'arrivo). E2E: pausa mantenuta, stesso tempo/giro/classifica dopo 2D→3D→2D, velocità mantenuta, tempo che
scorre in 3D, 10 cambi senza contesti WebGL accumulati. Prova separata senza WebGL: si apre in 2D, 3D disattivato.

**Ancora da fare (prossime milestone).**
- Vista 2D/3D anche in prove libere e qualifiche: oggi quelle sessioni si calcolano in un istante (solo il giro
  migliore), serve far produrre alla simulazione i fotogrammi anche lì.
- Strategie modificabili durante la gara (ritmo, gomme, carburante): richiede di far avanzare la simulazione a
  segmenti invece che tutta prima del via.
- Salvare a metà gara e riprendere allo stesso secondo (oggi il risultato è già salvato, la visione riparte).
- Modelli 3D: costruiti in codice, molto migliori dei cubi ma non fotorealistici; per il livello dell'infografica
  servono modelli 3D professionali (file glTF) — da valutare fonti gratuite con licenza libera.
