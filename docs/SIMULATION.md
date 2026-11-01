# Modello di simulazione

> Stato: **PROPOSTA**. Le costanti indicate sono valori di partenza da calibrare con
> `tools/balance`. Ogni formula avrà un test dedicato quando verrà implementata.

La simulazione è il cuore del gioco. Usa un modello **"quasi-statico a profilo di velocità"**
(la tecnica alla base dei simulatori di tempo sul giro usati in ingegneria), arricchito
da un **modello comportamentale del pilota** e da **interazioni in pista** a ogni tick.

## 1. Pista

Ogni circuito è definito da:

- **Linea centrale** (polilinea x/y in metri) usata per il disegno 2D e, in futuro, 3D.
- **Profilo campionato** ogni 2 m: curvatura `κ(s)`, pendenza, camber, grip della superficie,
  settore, zona di frenata, zona di sorpasso (difficoltà 0–1), larghezza.
- **Parametri globali**: lunghezza, abrasività, sensibilità al vento, esposizione al sole,
  linee di drenaggio (velocità di asciugatura), corsia box.

Da `κ(s)` il raggio è `R(s) = 1/|κ(s)|`.

## 2. Moto: dai componenti alle prestazioni

Ogni componente (motore, telaio, forcellone, sospensioni, freni, elettronica, cambio,
aerodinamica, raffreddamento) ha valori 0–100 su attributi propri. La moto calcola
parametri fisici derivati:

| Parametro | Fonte principale | Esempio Premier |
|---|---|---|
| `P_max` potenza (kW) | motore, raffreddamento (derating termico) | 190–210 kW |
| `m` massa moto+pilota (kg) | regolamento (minimo), pilota | 157 + 68 |
| `CdA` resistenza aerodinamica (m²) | aerodinamica, carenatura | 0,26–0,32 |
| `μ_lean` sfruttamento laterale | telaio, sospensioni, gomme | 0,95–1,05 |
| `a_brake_max` (m/s²) | freni, telaio, aero (stabilità) | 13–15 |
| `traction` 0–1 | elettronica, forcellone, sospensioni | |
| `wheelie_limit` (m/s²) | aero, elettronica, geometria | |
| `agility` | telaio, massa, geometria | cambi di direzione |
| `stability` | telaio, forcellone, aero | errori in frenata |
| `tyre_stress` | sospensioni, elettronica, setup | usura |
| `fuel_rate` (l/100 km) | motore, mappatura | |
| `reliability` (tasso di guasto) | ogni componente, chilometraggio | |

## 3. Profilo di velocità limite (per pilota, per giro)

Per ogni punto `s` del profilo:

**Velocità limite in curva** (equilibrio tra forza centripeta e aderenza):

```
v_corner(s) = sqrt( μ_eff(s) · g · R(s) )
μ_eff = μ_tyre(compound, T_tyre, wear) · μ_track(wetness, rubber, temp) · μ_lean · Q_setup^0.5
```

**Accelerazione disponibile** in uscita/rettilineo:

```
a_acc(v) = min( P(v)/(m·v) − (½·ρ·CdA·v²)/m − C_rr·g ,   // potenza − aria − rotolamento
                traction · μ_eff · g ,                    // limite di trazione
                wheelie_limit )                           // impennata
```

**Decelerazione disponibile** in frenata:

```
a_dec(v) = min( a_brake_max , μ_eff · g · k_stoppie ) + (½·ρ·CdA·v²)/m
```

Il profilo limite `v_lim(s)` si ottiene con il classico doppio passaggio:
- **in avanti** integrando `a_acc` da ogni punto di minimo;
- **all'indietro** integrando `a_dec` prima di ogni curva;
- `v_lim(s) = min(v_corner, v_forward, v_backward)`.

Il profilo viene ricalcolato solo quando cambiano gomme, meteo, carburante o mappa (non a ogni tick).

## 4. Modello del pilota

Il pilota non guida al 100% del limite. In ogni settore sceglie un **margine**:

```
u = u_base + 0.055·Skill_seg + 0.012·Aggr + 0.010·Confidence − Fatigue − TyreFear − Pressure
v_target(s) = v_lim(s) · u_seg · (1 + ε),   ε ~ N(0, σ),   σ = 0.006 · (1 − Costanza)
```

- `Skill_seg`: media pesata degli attributi pertinenti al tipo di segmento
  (frenata nelle zone di frenata, inserimento in ingresso curva, accelerazione in uscita,
  velocità in rettilineo/curva veloce, bagnato se la pista è umida).
- `Confidence`: qualità del setup rispetto alle preferenze, feeling con la moto, morale.
- `Fatigue`: cresce con i giri, ridotta da forma fisica e resistenza.
- `Pressure`: posizione, rivali, ordini della squadra, resistenza mentale.
- `u_base ≈ 0.925`: calibrato perché i migliori stiano entro ~1,5% dal limite.

### Errori e cadute

Probabilità di errore per curva (modello a rischio esponenziale):

```
p_err = p0 · exp( k · (u − u_safe) ) · (1 − 0.6·Concentrazione) · W_wet · W_cold_tyre
u_safe = 0.97 + 0.02·Costanza
```

Un errore viene classificato con un secondo estratto: **largo** (perdita 0,3–1,5 s),
**fuori pista** (2–8 s, possibile danno), **caduta** (ritiro o ripartenza se la moto è
utilizzabile e il regolamento lo consente). Le cadute in gruppo valutano i piloti vicini.

## 5. Interazioni in pista

A ogni tick (`dt = 0,1 s` di tempo simulato):

- **Scia**: se un pilota segue entro 25 m in rettilineo, `CdA_eff = CdA · (1 − 0.25·f(gap))`.
- **Traffico**: chi segue non può superare la velocità di chi precede se non è in una
  zona di sorpasso o non tenta un attacco; segue con penalità di aria sporca/temperatura gomme.
- **Tentativo di sorpasso** (in zone di frenata o uscite):
  ```
  P_try  = f(Δvelocità, Aggressività, Sorpassi, ordine squadra, giri rimanenti)
  P_pass = σ( 1.8·(Sorpassi_A − Difesa_B) + 2.5·Δv_norm + 1.2·Δfrenata + zona_sorpasso − 0.8 )
  ```
  Esito: sorpasso riuscito, fallito (perdita di tempo per chi attacca), **controsorpasso**
  in uscita (valutato su trazione e accelerazione), **contatto** (probabilità crescente con
  l'aggressività di entrambi) che può causare cadute e indagini dei commissari.
- **Penalità**: limiti della pista (contatore per pilota), long lap penalty, ride-through,
  sanzioni di griglia, per irregolarità valutate dalla direzione gara secondo regolamento.

## 6. Pneumatici

Mescole per categoria definite dal regolamento (es. Premier: soft/medium/hard, intermedia,
rain; anteriore e posteriore separati).

```
grip(T, w) = grip_base · exp( −((T − T_opt)/T_width)² ) · (1 − α·w^β)
dT/dt      = k_heat · energia_slittamento − k_cool · (T − T_air_track) · f(v)
dw/dt      = k_wear · energia_slittamento · abrasività · tyre_stress · (1 + surriscaldamento)
```

- `energia_slittamento` dipende dall'accelerazione laterale/longitudinale effettivamente richiesta
  (quindi da stile di guida, assetto, elettronica e ritmo scelto).
- Gomme fredde nei primi giri e dopo una bandiera rossa; anteriore che si surriscalda in scia.
- La "Gestione pneumatici" del pilota riduce l'energia di slittamento a parità di tempo.

## 7. Carburante

```
consumo_giro = Σ_s fuel_rate(mappa, potenza erogata(s)) · ds
massa = m_base + massa_carburante → influenza accelerazione, frenata e usura
```
Se il serbatoio rischia di non bastare, il pilota (o la mappa) riduce la potenza: è il
compromesso tra mappatura aggressiva e arrivo al traguardo.

## 8. Meteo e pista

Stato meteo con evoluzione a fronti (catena di Markov su nuvolosità + celle di pioggia):

```
wetness' = rain_rate · k_wet − (evaporazione(T_track, vento, sole) + k_line · passaggi_moto) · k_dry
μ_track  = μ_dry · (1 − 0.45·wetness) + μ_wet_tyre_bonus(wetness, compound)
```

Le previsioni mostrate al giocatore hanno un'incertezza che diminuisce avvicinandosi
all'evento e aumenta con il livello basso del responsabile strategia.

## 9. Assetto

Assetto = vettore di regolazioni (geometria, precarico, idraulica, molle, distribuzione pesi,
rapporti, mappatura, traction control, freno motore, configurazione aero).
Ogni circuito ha un **assetto ideale nascosto**, ogni pilota delle **preferenze** di stile.

```
distanza = Σ w_i · (setup_i − ideale_i(pista, meteo, pilota))²
Q_setup  = exp(−distanza / scala)    ∈ (0, 1]
```

Il giocatore non vede l'ideale: lo scopre dal feedback del pilota (accurato in base al suo
attributo "Feedback tecnico"), dai suggerimenti del capotecnico e dell'ingegnere di pista
(accurati in base alle loro abilità e alla compatibilità con il pilota) e dalla telemetria.

## 10. Affidabilità

Ogni componente ha un tasso di guasto che cresce con l'usura (curva a vasca):

```
h(t) = λ0 · (1 − affidabilità) · (1 + (km/km_vita)^γ) · stress_termico
P(guasto nel tick) = 1 − exp(−h · dt)
```
Le soluzioni "aggressive" del reparto R&D hanno `λ0` più alto finché non vengono collaudate.

## 11. Output

- `RaceFrame` (a ogni tick): per pilota `s`, offset laterale, velocità, angolo di piega,
  stato (in pista, box, caduto), giro, settore. Il renderer 2D interpola a 60 fps.
- `TelemetrySample` (10 Hz per i piloti della squadra del giocatore, settore/giro per tutti):
  velocità, acceleratore, freno, piega, marcia, temperature e usura gomme, carburante, distacchi.
- `RaceEvent`: sorpassi, errori, cadute, guasti, penalità, bandiere, ingressi ai box.

Tutto ciò che è mostrato in telemetria e classifica deriva da questi output: nessun dato
viene inventato dall'interfaccia.

## 12. Simulazione rapida

Le gare delle altre categorie e delle serie minori usano lo **stesso motore** senza
renderer (centinaia di volte più veloce del tempo reale). Le serie nazionali di basso
livello usano un modello statistico semplificato a livello di gara, documentato a parte,
perché non sono visibili in dettaglio al giocatore.
