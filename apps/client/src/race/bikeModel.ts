/**
 * Modelli 3D delle moto e dei piloti, costruiti in codice (nessun file esterno, nessun marchio reale).
 *
 * Riferimento artistico: l'infografica "Le motociclette del campionato" fornita dal giocatore —
 *   premier       prototipo con alette aerodinamiche, codone alto, scarico sotto il codone
 *   intermediate  prototipo di media cilindrata, carena piena, niente alette
 *   lightweight   moto compatta ed essenziale, più stretta e bassa
 *   rookies       come la lightweight, monomarca (Lysander R250)
 * Unità: metri. Avanti = +X, su = +Y, destra del pilota = +Z.
 *
 * Ogni moto ha due livelli di dettaglio (LOD): completo da vicino, semplificato da lontano. Le parti con lo stesso
 * materiale vengono fuse in un'unica geometria (poche chiamate di disegno anche con 30 moto in pista).
 * Il gruppo 'lean' ruota sull'asse di marcia (piega); il gruppo 'rider' si sposta verso l'interno della curva.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Tier = 'premier' | 'intermediate' | 'lightweight' | 'rookies';

interface Spec {
  len: number; // fattore di scala della lunghezza
  width: number; // larghezza della carena
  wings: boolean;
  tailUp: number; // altezza del codone
  wheel: number; // raggio esterno della gomma
}
const SPECS: Record<Tier, Spec> = {
  premier: { len: 1, width: 0.42, wings: true, tailUp: 1.12, wheel: 0.3 },
  intermediate: { len: 0.98, width: 0.4, wings: false, tailUp: 1.08, wheel: 0.3 },
  lightweight: { len: 0.9, width: 0.34, wings: false, tailUp: 1.0, wheel: 0.27 },
  rookies: { len: 0.88, width: 0.34, wings: false, tailUp: 0.98, wheel: 0.27 },
};

type Part = { geo: THREE.BufferGeometry; key: MatKey };
type MatKey =
  'body' | 'accent' | 'dark' | 'metal' | 'gold' | 'tyre' | 'glass' | 'suit' | 'suit2' | 'helmet' | 'visor';

const cyl = (r1: number, r2: number, h: number, seg = 12) => new THREE.CylinderGeometry(r1, r2, h, seg);
/** Cilindro da a a b. */
const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 10) => {
  const g = cyl(r, r, a.distanceTo(b), seg);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
};
const capsule = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, a.distanceTo(b)), 4, 10);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
};
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/**
 * Superficie per sezioni: a ogni stazione una sezione "a superellisse" (fianchi piatti, spigoli morbidi) alta
 * da `bot` a `top` e larga 2×`hw`; le estremità sono chiuse. È la forma delle carene vere.
 */
function loft(st: { x: number; top: number; bot: number; hw: number }[], seg: number): THREE.BufferGeometry {
  const ring = (k: number) => {
    const s = st[k]!;
    const cy = (s.top + s.bot) / 2,
      ry = (s.top - s.bot) / 2;
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a),
        sn = Math.sin(a);
      const e = 0.6; // < 1 = sezione più squadrata
      out.push(v(s.x, cy + Math.sign(sn) * Math.abs(sn) ** e * ry, Math.sign(c) * Math.abs(c) ** e * s.hw));
    }
    return out;
  };
  const rings = st.map((_, k) => ring(k));
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < seg; i++) {
      const a = rings[k]![i]!,
        b = rings[k]![(i + 1) % seg]!,
        c = rings[k + 1]![(i + 1) % seg]!,
        d = rings[k + 1]![i]!;
      tri(a, c, b);
      tri(a, d, c);
    }
  for (const [k, flip] of [
    [0, false],
    [rings.length - 1, true],
  ] as const) {
    const r = rings[k]!;
    const ctr = r.reduce((t, p) => t.add(p), v(0, 0)).multiplyScalar(1 / r.length);
    for (let i = 0; i < seg; i++) {
      if (flip) tri(ctr, r[(i + 1) % seg]!, r[i]!);
      else tri(ctr, r[i]!, r[(i + 1) % seg]!);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function wheel(x: number, R: number, detail: boolean, front: boolean): Part[] {
  const out: Part[] = [];
  const tyre = new THREE.TorusGeometry(R - 0.06, 0.065, detail ? 10 : 6, detail ? 28 : 14);
  tyre.translate(x, R, 0);
  out.push({ geo: tyre, key: 'tyre' });
  const rim = cyl(R - 0.11, R - 0.11, 0.08, detail ? 24 : 10);
  rim.rotateX(Math.PI / 2);
  rim.translate(x, R, 0);
  out.push({ geo: rim, key: 'dark' });
  if (detail) {
    // Razze, dischi freno e pinze.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const sp = new THREE.BoxGeometry(0.03, R - 0.12, 0.05);
      sp.translate(0, (R - 0.12) / 2, 0);
      sp.rotateZ(a);
      sp.translate(x, R, 0);
      out.push({ geo: sp, key: 'accent' });
    }
    for (const side of front ? [-1, 1] : [1]) {
      const disc = cyl(front ? 0.16 : 0.11, front ? 0.16 : 0.11, 0.012, 24);
      disc.rotateX(Math.PI / 2);
      disc.translate(x, R, side * 0.07);
      out.push({ geo: disc, key: 'metal' });
      const cal = new THREE.BoxGeometry(0.09, 0.05, 0.035);
      cal.translate(x - 0.12, R + 0.08, side * 0.085);
      out.push({ geo: cal, key: 'gold' });
    }
  }
  return out;
}

function bikeParts(tier: Tier, detail: boolean): Part[] {
  const s = SPECS[tier];
  const W = s.width;
  const R = s.wheel;
  const fx = 0.7, // asse anteriore
    rx = -0.68; // asse posteriore
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, key: MatKey) => parts.push({ geo, key });

  // Carena a sezioni (muso stretto → fianchi larghi → serbatoio → codone sottile), lasciando scoperte ruota
  // posteriore, forcellone e scarico. Ogni stazione: x, quota sopra, quota sotto, mezza larghezza.
  const wk = W / 0.42; // categorie più strette
  const segs = detail ? 14 : 8;
  const stations = (list: [number, number, number, number][]) =>
    list.map(([x, t, b, hw]) => ({ x, top: t, bot: b, hw: hw * wk }));
  add(
    loft(
      stations([
        [1.0, 0.67, 0.6, 0.03],
        [0.93, 0.83, 0.47, 0.13],
        [0.78, 0.95, 0.37, 0.19],
        [0.52, 0.97, 0.33, 0.21],
        [0.25, 0.9, 0.33, 0.2],
        [0.04, 0.94, 0.36, 0.19],
        [-0.14, 0.9, 0.46, 0.16],
        [-0.26, 0.86, 0.66, 0.12],
      ]),
      segs,
    ),
    'body',
  );
  // Codone (sopra la ruota posteriore).
  add(
    loft(
      stations([
        [-0.24, 0.9, 0.74, 0.11],
        [-0.5, 0.98, 0.82, 0.1],
        [-0.78, s.tailUp - 0.02, 0.92, 0.075],
        [-0.93, s.tailUp - 0.04, s.tailUp - 0.1, 0.03],
      ]),
      segs,
    ),
    'body',
  );
  // Puntale e fascia bassa nel secondo colore.
  add(
    loft(
      stations([
        [0.62, 0.47, 0.35, 0.18],
        [0.3, 0.45, 0.31, 0.205],
        [0.0, 0.47, 0.33, 0.195],
        [-0.16, 0.52, 0.45, 0.165],
      ]),
      segs,
    ),
    'accent',
  );
  // Fascia sul codone e sella.
  add(
    loft(
      stations([
        [-0.5, 0.97, 0.9, 0.103],
        [-0.8, s.tailUp - 0.01, s.tailUp - 0.07, 0.078],
      ]),
      segs,
    ),
    'accent',
  );
  add(
    loft(
      stations([
        [-0.12, 0.95, 0.88, 0.11],
        [-0.42, 0.97, 0.9, 0.1],
      ]),
      segs,
    ),
    'dark',
  );
  // Cupolino trasparente.
  add(
    loft(
      stations([
        [0.8, 0.95, 0.9, 0.12],
        [0.66, 1.07, 0.93, 0.13],
        [0.5, 1.03, 0.95, 0.11],
      ]),
      segs,
    ),
    'glass',
  );
  // Forcella (steli inclinati), piastra e semimanubri.
  const top = v(fx - (0.82 - R) * Math.tan(0.42), 0.82); // la parte alta resta dentro la carena
  for (const z of [-0.09, 0.09]) {
    add(rod(v(fx, R, z), v(top.x, top.y, z), detail ? 0.028 : 0.03, detail ? 10 : 6), 'gold');
    if (detail) add(rod(v(0.5, 0.94, z * 1.5), v(0.42, 0.93, z * 2.4), 0.014, 6), 'dark');
  }
  // Forcellone e ammortizzatore.
  for (const z of [-0.1, 0.1]) add(rod(v(-0.12, 0.45, z), v(rx, R, z), detail ? 0.03 : 0.035, 6), 'metal');
  if (detail) add(rod(v(-0.2, 0.42, 0), v(-0.32, 0.72, 0), 0.03, 8), 'gold');
  // Motore e telaio visibili sotto la carena.
  add(new THREE.BoxGeometry(0.45, 0.25, W * 0.7).translate(-0.02, 0.42, 0), 'dark');
  // Scarico.
  if (tier === 'premier') add(rod(v(-0.2, 0.5, 0.1), v(-0.85, 0.82, 0.14), 0.05, 10), 'metal');
  else
    add(rod(v(-0.1, 0.36, 0.12), v(-0.62, 0.6, 0.2), tier === 'intermediate' ? 0.055 : 0.045, 10), 'metal');
  // Alette aerodinamiche (solo MotoGP).
  if (s.wings)
    for (const side of [-1, 1]) {
      for (const [y, l] of [
        [0.78, 0.22],
        [0.7, 0.18],
      ] as const) {
        const wg = new THREE.BoxGeometry(l, 0.02, 0.16);
        wg.rotateY(side * 0.25);
        wg.translate(0.72, y, side * (W / 2 + 0.07));
        add(wg, 'accent');
      }
    }
  parts.push(...wheel(fx, R, detail, true), ...wheel(rx, R, detail, false));
  // Scala per categoria (lunghezza) — le ruote restano centrate a terra.
  for (const p of parts) p.geo.scale(s.len, s.len, 1);
  return parts;
}

/** Pilota rannicchiato in carena: casco con visiera, tuta in due colori, guanti, stivali. */
function riderParts(tier: Tier, detail: boolean): Part[] {
  const sc = SPECS[tier].len;
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, key: MatKey) => parts.push({ geo, key });
  const hip = v(-0.3, 1.04),
    shoulder = v(0.16, 1.12),
    head = v(0.36, 1.13);
  add(capsule(hip, shoulder, 0.13), 'suit');
  if (detail) add(capsule(v(-0.22, 1.15), v(-0.02, 1.2), 0.07), 'suit2'); // gobba aerodinamica
  // Casco e visiera.
  const helmet = new THREE.SphereGeometry(0.15, detail ? 18 : 8, detail ? 14 : 6);
  helmet.scale(1.12, 1, 1);
  helmet.translate(head.x, head.y, 0);
  add(helmet, 'helmet');
  if (detail) {
    const visor = new THREE.SphereGeometry(0.152, 14, 8, -0.9, 1.8, 1.0, 0.7);
    visor.rotateY(Math.PI / 2);
    visor.scale(1.12, 1, 1);
    visor.translate(head.x + 0.005, head.y, 0);
    add(visor, 'visor');
  }
  for (const z of [-0.15, 0.15]) {
    const sh = v(shoulder.x, shoulder.y - 0.03, z * 0.95);
    const elbow = v(0.32, 0.99, z * 1.45);
    const hand = v(0.53, 0.93, z * 1.2);
    add(capsule(sh, elbow, 0.055), 'suit');
    add(capsule(elbow, hand, 0.05), 'suit2');
    add(new THREE.SphereGeometry(0.05, 8, 6).translate(hand.x, hand.y, hand.z), 'dark');
    const knee = v(0.02, 0.74, z * 1.75);
    const foot = v(-0.36, 0.5, z * 1.2);
    add(capsule(v(hip.x + 0.05, hip.y - 0.06, z * 0.75), knee, 0.075), 'suit');
    add(capsule(knee, foot, 0.06), 'suit2');
    add(new THREE.BoxGeometry(0.2, 0.09, 0.08).translate(foot.x - 0.02, foot.y - 0.03, foot.z), 'dark');
    if (detail)
      add(
        new THREE.SphereGeometry(0.045, 6, 4).translate(knee.x + 0.04, knee.y - 0.05, knee.z * 1.08),
        'metal',
      ); // saponetta
  }
  for (const p of parts) p.geo.scale(sc, sc, 1);
  return parts;
}

const cache = new Map<string, Map<MatKey, THREE.BufferGeometry>>();
function merged(kind: 'bike' | 'rider', tier: Tier, detail: boolean) {
  const key = `${kind}-${tier}-${detail}`;
  let m = cache.get(key);
  if (!m) {
    const parts = kind === 'bike' ? bikeParts(tier, detail) : riderParts(tier, detail);
    m = new Map();
    const byKey = new Map<MatKey, THREE.BufferGeometry[]>();
    for (const p of parts) {
      // Tutte non indicizzate e con gli stessi attributi, per poterle fondere.
      const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo).clone();
      for (const name of Object.keys(g.attributes))
        if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv)
        g.setAttribute(
          'uv',
          new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2),
        );
      byKey.set(p.key, [...(byKey.get(p.key) ?? []), g]);
    }
    for (const [k, list] of byKey) m.set(k, mergeGeometries(list)!);
    cache.set(key, m);
  }
  return m;
}

/** Targhetta col numero di gara (canvas → texture). */
function numberTexture(n: number, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, 128, 96);
  x.fillStyle = fg;
  x.font = 'italic 900 72px Archivo, system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(String(n), 64, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface BikeLook {
  tier: Tier;
  color: string;
  color2: string;
  number: number;
  mine: boolean;
}

/** Materiali di una squadra (condivisi fra le sue moto). */
export function materialsFor(look: BikeLook, wet: boolean) {
  const std = (
    color: THREE.ColorRepresentation,
    rough: number,
    metal = 0,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return {
    body: std(look.color, 0.32, 0.25),
    accent: std(look.color2, 0.38, 0.2),
    dark: std(0x17181b, 0.55, 0.3),
    metal: std(0xb7bcc4, 0.28, 0.85),
    gold: std(0xc99a2e, 0.3, 0.8),
    tyre: std(0x141416, wet ? 0.5 : 0.85, 0),
    glass: std(0x1d2a33, 0.05, 0.1, { transparent: true, opacity: 0.55 }),
    suit: std(look.color, 0.6, 0.05),
    suit2: std(look.color2, 0.6, 0.05),
    helmet: std(look.mine ? 0xff7a1a : 0xf3f1ec, 0.2, 0.3),
    visor: std(0x0c0e12, 0.05, 0.6),
  } satisfies Record<MatKey, THREE.Material>;
}

/**
 * Moto completa con pilota e LOD. Restituisce il gruppo da posizionare (a terra, orientato con rotation.y).
 * Figli con nome: 'lean' (piega), dentro 'rider' (spostamento in curva).
 */
export function buildBike(
  look: BikeLook,
  mats: ReturnType<typeof materialsFor>,
  lodFar: number,
): THREE.Object3D {
  const lod = new THREE.LOD();
  for (const detail of [true, false]) {
    const lean = new THREE.Group();
    lean.name = 'lean';
    for (const [k, g] of merged('bike', look.tier, detail)) {
      const m = new THREE.Mesh(g, mats[k]);
      m.castShadow = detail;
      lean.add(m);
    }
    const rider = new THREE.Group();
    rider.name = 'rider';
    for (const [k, g] of merged('rider', look.tier, detail)) {
      const m = new THREE.Mesh(g, mats[k]);
      m.castShadow = detail;
      rider.add(m);
    }
    lean.add(rider);
    if (detail) {
      // Numero sul cupolino e sui fianchi del codone.
      const tex = numberTexture(look.number, '#f3f1ec', '#111');
      const plate = new THREE.MeshBasicMaterial({ map: tex });
      const s = SPECS[look.tier];
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), plate);
      front.position.set(0.955 * s.len, 0.72 * s.len, 0);
      front.rotation.y = Math.PI / 2;
      front.rotation.x = -0.35;
      lean.add(front);
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), plate);
        p.position.set(-0.68 * s.len, (s.tailUp - 0.1) * s.len, side * (0.09 * (s.width / 0.42) + 0.006));
        if (side < 0) p.rotation.y = Math.PI;
        lean.add(p);
      }
    }
    lod.addLevel(wrap(lean), detail ? 0 : lodFar);
  }
  const g = new THREE.Group();
  g.add(lod);
  return g;
}
const wrap = (o: THREE.Object3D) => {
  const g = new THREE.Group();
  g.add(o);
  return g;
};

/** Piega (rad, + = sinistra) e spostamento del pilota verso l'interno, su entrambi i livelli di dettaglio. */
export function poseBike(obj: THREE.Object3D, lean: number) {
  obj.traverse((o) => {
    if (o.name === 'lean') o.rotation.x = -lean;
    else if (o.name === 'rider') {
      o.position.z = -lean * 0.14;
      o.rotation.x = lean * 0.25;
    }
  });
}
