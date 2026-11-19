import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE, type Scene, type V } from './circuitScene.ts';
import type { RaceFrame } from './raceState.ts';
import { buildBike, materialsFor, poseBike, type Tier } from './bikeModel.ts';
import type { Quality } from '../prefs.ts';

/**
 * Vista 3D della gara (Three.js, licenza MIT). Disegna lo stesso `RaceFrame` della vista 2D: posizioni, eventi,
 * bandiere e meteo arrivano dalla stessa funzione (raceState.ts), qui cambia solo il modo di mostrarli.
 * Caricata solo quando si sceglie il 3D (import dinamico), così chi resta in 2D non scarica la libreria.
 * Alla chiusura libera geometrie, materiali, texture e il contesto WebGL: si può passare da 2D a 3D quante volte
 * si vuole senza consumare memoria.
 */
const K = 1000; // unità del mondo 3D (≈ metri) per unità normalizzata del tracciato

export type Cam3D = 'auto' | 'tv' | 'chase' | 'trackside' | 'box' | 'all';

export interface Race3DProps {
  scene: Scene;
  frame: RaceFrame;
  tier: Tier;
  cam: Cam3D;
  leaderNumber: number | null;
  quality: Quality;
}

const QUALITY = {
  low: { dpr: 1, aa: false, shadows: false, lod: 60, crowd: 0.35, animCrowd: false },
  medium: { dpr: 1.5, aa: true, shadows: false, lod: 140, crowd: 0.7, animCrowd: true },
  high: { dpr: 2, aa: true, shadows: true, lod: 320, crowd: 1, animCrowd: true },
} as const;

/** Texture di rumore (grana di asfalto, erba, ghiaia) generata in codice. */
function noiseTexture(base: string | number, amount: number, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const col = new THREE.Color(base);
  const img = x.createImageData(size, size);
  let seed = 1234567;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 16807) % 2147483647;
    const n = 1 + ((seed / 2147483647) * 2 - 1) * amount;
    img.data[i * 4] = Math.min(255, col.r * 255 * n);
    img.data[i * 4 + 1] = Math.min(255, col.g * 255 * n);
    img.data[i * 4 + 2] = Math.min(255, col.b * 255 * n);
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Race3D(props: Race3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const sc = props.scene;
    const q = QUALITY[props.quality];
    const qset = q; // `q` più sotto indica anche i quadrilateri delle tribune
    const rain = props.frame.rain;
    const renderer = new THREE.WebGLRenderer({ antialias: q.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    const sky = rain > 0 ? 0x7d8794 : 0x9cc6ea;
    world.background = new THREE.Color(sky);
    world.fog = new THREE.Fog(sky, 300, rain > 0 ? 900 : 1800);
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.3, 5000);
    world.add(new THREE.HemisphereLight(0xdfeeff, 0x4b5b3a, rain > 0 ? 0.9 : 1.1));
    const sun = new THREE.DirectionalLight(0xfff4e0, rain > 0 ? 0.7 : 2.2);
    sun.position.set(400, 800, 300);
    sun.castShadow = q.shadows;
    if (q.shadows) {
      sun.shadow.mapSize.set(2048, 2048);
      const sc2 = sun.shadow.camera;
      sc2.left = sc2.bottom = -60;
      sc2.right = sc2.top = 60;
      sc2.near = 1;
      sc2.far = 2000;
    }
    world.add(sun, sun.target);

    const X = (p: V) => p[0] * K;
    const Z = (p: V) => p[1] * K;
    const N = sc.pts.length;
    const at = (i: number) => sc.pts[((i % N) + N) % N]!;
    const nr = (i: number) => sc.nor[((i % N) + N) % N]!;
    const mat = (color: string | number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra });

    // Nastro fra due bordi (offset dalla linea centrale), alto h.
    const ribbon = (
      from: number,
      to: number,
      inner: (i: number) => number,
      outer: (i: number) => number,
      h: number,
      material: THREE.Material,
    ) => {
      const pos: number[] = [];
      for (let j = from; j < to; j++) {
        const a = at(j),
          b = at(j + 1),
          na = nr(j),
          nb = nr(j + 1);
        const ia = inner(((j % N) + N) % N),
          oa = outer(((j % N) + N) % N),
          ib = inner((((j + 1) % N) + N) % N),
          ob = outer((((j + 1) % N) + N) % N);
        const p1: V = [a[0] + na[0] * ia, a[1] + na[1] * ia],
          p2: V = [a[0] + na[0] * oa, a[1] + na[1] * oa],
          p3: V = [b[0] + nb[0] * ob, b[1] + nb[1] * ob],
          p4: V = [b[0] + nb[0] * ib, b[1] + nb[1] * ib];
        for (const p of [p1, p2, p3, p1, p3, p4]) pos.push(X(p), h, Z(p));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      // UV in coordinate del mondo: le texture (asfalto, erba, ghiaia) si ripetono senza deformarsi.
      const uv: number[] = [];
      for (let k = 0; k < pos.length; k += 3) uv.push(pos[k]! / 6, pos[k + 2]! / 6);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, material);
      m.receiveShadow = true;
      world.add(m);
      return m;
    };
    const pal = PALETTE[sc.env];
    const twoSided = { side: THREE.DoubleSide } as const;

    // Terreno.
    const bw = (sc.bounds.x1 - sc.bounds.x0) * K,
      bh = (sc.bounds.y1 - sc.bounds.y0) * K;
    const groundTex = noiseTexture(pal.ground, 0.1, 512);
    groundTex.repeat.set((bw * 3) / 40, (bh * 3) / 40);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(bw * 3, bh * 3),
      mat(pal.ground, { map: groundTex }),
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(((sc.bounds.x0 + sc.bounds.x1) / 2) * K, 0, ((sc.bounds.y0 + sc.bounds.y1) / 2) * K);
    world.add(ground);
    if (sc.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(bw * 3, 2000), mat(0x2f7ea8));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(ground.position.x, 0.2, sc.sea[0][1] * K + 1000);
      world.add(sea);
    }
    const w2 = sc.width / 2;
    // Bordo d'erba, ghiaia, pista, linee, cordoli.
    ribbon(
      0,
      N,
      () => -w2 - 0.035,
      () => w2 + 0.035,
      0.05,
      mat(pal.verge, { ...twoSided, map: noiseTexture(pal.verge, 0.12) }),
    );
    for (const g of sc.gravel) {
      ribbon(
        g.from,
        g.to,
        () => (w2 + 0.004) * g.side,
        (i) => {
          const j = i < g.from ? i + N : i;
          const t = Math.min(1, (j - g.from) / 5, (g.to - j) / 5);
          return (w2 + 0.006 + g.depth * Math.max(0, t)) * g.side;
        },
        0.1,
        mat(0xd6c18f, { ...twoSided, map: noiseTexture('#d6c18f', 0.22) }),
      );
    }
    ribbon(
      0,
      N,
      () => -w2 - 0.0015,
      () => w2 + 0.0015,
      0.15,
      mat(0xf2f2f2, twoSided),
    );
    ribbon(
      0,
      N,
      () => -w2,
      () => w2,
      0.2,
      // Asfalto: grana fine; bagnato = più scuro e lucido (riflessi).
      mat(0xffffff, {
        ...twoSided,
        map: noiseTexture(rain > 0 ? '#45484f' : '#6a6d74', 0.14),
        roughness: rain > 0.5 ? 0.25 : rain > 0 ? 0.5 : 0.85,
        metalness: rain > 0.5 ? 0.35 : 0.05,
      }),
    );
    const red = mat(0xd7262e, twoSided),
      white = mat(0xf4f4f4, twoSided);
    for (const k of sc.kerbs) {
      for (let j = k.from; j < k.to; j++) {
        const a = (w2 - 0.002) * k.side,
          b = (w2 + 0.003) * k.side;
        ribbon(
          j,
          j + 1,
          () => Math.min(a, b),
          () => Math.max(a, b),
          0.25,
          j % 2 ? red : white,
        );
      }
    }
    // Traguardo.
    ribbon(
      -1,
      1,
      () => -w2,
      () => w2,
      0.3,
      mat(0xffffff, twoSided),
    );
    // Corsia box e anello della Long Lap.
    const laneMesh = (path: V[], width: number, color: number, h: number) => {
      const pos: number[] = [];
      for (let k = 0; k < path.length - 1; k++) {
        const a = path[k]!,
          b = path[k + 1]!;
        const d: V = [b[0] - a[0], b[1] - a[1]];
        const l = Math.hypot(d[0], d[1]) || 1;
        const n: V = [(-d[1] / l) * width, (d[0] / l) * width];
        const q = [
          [a[0] + n[0], a[1] + n[1]],
          [a[0] - n[0], a[1] - n[1]],
          [b[0] - n[0], b[1] - n[1]],
          [b[0] + n[0], b[1] + n[1]],
        ] as V[];
        for (const p of [q[0]!, q[1]!, q[2]!, q[0]!, q[2]!, q[3]!]) pos.push(X(p), h, Z(p));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      world.add(new THREE.Mesh(g, mat(color, twoSided)));
    };
    laneMesh(sc.pitLane, 0.0055, 0x46484e, 0.18);
    if (sc.longLap) laneMesh(sc.longLap.path, 0.0045, 0x46484e, 0.22);

    // Barriere: muri bassi (blu dove c'è la ghiaia).
    for (const side of [1, -1] as const) {
      const arr = sc.barrier[side === 1 ? 0 : 1];
      const pos: number[] = [];
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a: V = [at(i)[0] + nr(i)[0] * arr[i]! * side, at(i)[1] + nr(i)[1] * arr[i]! * side];
        const b: V = [at(j)[0] + nr(j)[0] * arr[j]! * side, at(j)[1] + nr(j)[1] * arr[j]! * side];
        pos.push(
          X(a),
          0,
          Z(a),
          X(b),
          0,
          Z(b),
          X(b),
          1.4,
          Z(b),
          X(a),
          0,
          Z(a),
          X(b),
          1.4,
          Z(b),
          X(a),
          1.4,
          Z(a),
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      world.add(new THREE.Mesh(g, mat(0x3a6fc4, twoSided)));
    }

    // Edifici a forma di quadrilatero (box, motorhome, tribune).
    const block = (quad: [V, V, V, V], height: number, color: string | number, y = 0) => {
      const shape = new THREE.Shape(quad.map((p) => new THREE.Vector2(X(p), -Z(p))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat(color));
      m.position.y = y;
      world.add(m);
      return m;
    };
    for (const b of sc.buildings) block(b.quad, 7, b.color);
    for (const m of sc.motorhomes) block(m.quad, 4, m.color);
    for (const gr of sc.garages) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 9), mat(gr.color));
      const p: V = [gr.at[0] + gr.dir[0] * 0.012, gr.at[1] + gr.dir[1] * 0.012];
      box.position.set(X(p), 3, Z(p));
      box.rotation.y = -Math.atan2(gr.dir[1], gr.dir[0]);
      world.add(box);
    }
    // Tribune a gradoni con il pubblico (istanze colorate).
    const crowdGeo = new THREE.BoxGeometry(0.7, 1.1, 0.7);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const COLORS = [0xe5484d, 0xffd21f, 0xf3f1ec, 0x3d7bfd, 0x2b2d31, 0xf07c1f, 0x2fbf71, 0xc9ccd2];
    const people: { x: number; y: number; z: number }[] = [];
    for (const st of sc.stands) {
      const [p0, p1, , p3] = st.quad;
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows,
          t1 = (r + 1) / rows;
        const q: [V, V, V, V] = [
          [p0[0] + (p3[0] - p0[0]) * t0, p0[1] + (p3[1] - p0[1]) * t0],
          [p1[0] + (p3[0] - p0[0]) * t0, p1[1] + (p3[1] - p0[1]) * t0],
          [p1[0] + (p3[0] - p0[0]) * t1, p1[1] + (p3[1] - p0[1]) * t1],
          [p0[0] + (p3[0] - p0[0]) * t1, p0[1] + (p3[1] - p0[1]) * t1],
        ];
        block(q, 1.5 + r * 1.5, 0x8b9099);
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * K;
        const n = Math.floor(len / 1.2);
        for (let k = 0; k < n; k++) {
          if ((k * 7 + r * 13) % 10 < 1) continue;
          if (((k * 31 + r * 17) % 100) / 100 >= qset.crowd) continue; // densità secondo la qualità
          const u = (k + 0.5) / n,
            tm = (t0 + t1) / 2;
          const x = p0[0] + (p1[0] - p0[0]) * u + (p3[0] - p0[0]) * tm;
          const z = p0[1] + (p1[1] - p0[1]) * u + (p3[1] - p0[1]) * tm;
          people.push({ x: x * K, y: 1.5 + r * 1.5 + 0.55, z: z * K });
        }
      }
      // Tetto.
      const roof = block(
        [
          [p3[0] - (p3[0] - p0[0]) * 0.3, p3[1] - (p3[1] - p0[1]) * 0.3],
          [st.quad[2][0] - (st.quad[2][0] - p1[0]) * 0.3, st.quad[2][1] - (st.quad[2][1] - p1[1]) * 0.3],
          st.quad[2],
          p3,
        ],
        0.5,
        0xe8e9ec,
      );
      roof.position.y = 13;
    }
    const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, Math.max(1, people.length));
    const dummy = new THREE.Object3D();
    people.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
      crowd.setColorAt(i, new THREE.Color(COLORS[(i * 7919) % COLORS.length]!));
    });
    world.add(crowd);

    // Alberi (istanze): chioma + tronco; palme più alte e sottili.
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.6, 1, 6),
      mat(0x6b4a2b),
      sc.trees.length,
    );
    const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat(pal.tree), sc.trees.length);
    sc.trees.forEach((tr, i) => {
      const r = tr.r * K;
      const hgt = tr.palm ? r * 2.6 : r * 1.2;
      dummy.position.set(X(tr.at), hgt / 2, Z(tr.at));
      dummy.scale.set(1, hgt, 1);
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.set(X(tr.at), hgt + r * 0.3, Z(tr.at));
      dummy.scale.set(r, tr.palm ? r * 0.35 : r * 0.9, r);
      dummy.updateMatrix();
      crown.setMatrixAt(i, dummy.matrix);
    });
    world.add(trunk, crown);

    // ---- Pubblicità a bordo pista (pannelli originali, nessun marchio reale) ----
    const adWords = ['RACING MANAGER', sc.name.toUpperCase(), 'GRAN PREMIO', 'PADDOCK', 'RACE CONTROL'];
    const adMats = adWords.map((w, i) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 64;
      const x = c.getContext('2d')!;
      x.fillStyle = ['#ff7a1a', '#14161a', '#3d9bff', '#f3f1ec', '#34d17c'][i % 5]!;
      x.fillRect(0, 0, 512, 64);
      x.fillStyle = i % 5 === 3 ? '#14161a' : '#ffffff';
      x.font = 'italic 900 40px Archivo, system-ui, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(w.slice(0, 22), 256, 34);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
    });
    const adGeo = new THREE.PlaneGeometry(12, 1.5);
    for (let i = 0; i < N; i += Math.max(4, Math.floor(N / 70))) {
      const side = i % 2 ? 1 : -1;
      const arr = sc.barrier[side === 1 ? 0 : 1];
      const off = arr[i]! * side;
      const p: V = [at(i)[0] + nr(i)[0] * (off - 0.0006 * side), at(i)[1] + nr(i)[1] * (off - 0.0006 * side)];
      const m = new THREE.Mesh(adGeo, adMats[((i / 4) % adMats.length) | 0]!);
      m.position.set(X(p), 0.9, Z(p));
      const tn = sc.tan[i]!;
      m.rotation.y = -Math.atan2(tn[1], tn[0]) + (side > 0 ? Math.PI : 0);
      world.add(m);
    }

    // ---- Postazioni dei commissari: bandiera gialla dove serve ----
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xffd21f, side: THREE.DoubleSide });
    const redFlagMat = new THREE.MeshBasicMaterial({ color: 0xe5484d, side: THREE.DoubleSide });
    const flags: THREE.Mesh[] = [];
    for (let k = 0; k < 12; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), flagMat);
      f.visible = false;
      world.add(f);
      flags.push(f);
    }
    const marshalPost = (frac: number): V => {
      const i = Math.floor((((frac % 1) + 1) % 1) * N) % N;
      const side = sc.curv[i]! > 0 ? -1 : 1;
      const arr = sc.barrier[side === 1 ? 0 : 1];
      return [at(i)[0] + nr(i)[0] * (arr[i]! + 0.002) * side, at(i)[1] + nr(i)[1] * (arr[i]! + 0.002) * side];
    };

    // ---- Moto (modelli per categoria, livrea della squadra, LOD) ----
    const bikeObjs = new Map<string, THREE.Object3D>();
    const teamMats = new Map<string, ReturnType<typeof materialsFor>>();
    const getBike = (b: RaceFrame['bikes'][number]) => {
      let o = bikeObjs.get(b.id);
      if (!o) {
        const look = { tier: props.tier, color: b.color, color2: b.color2, number: b.number, mine: b.mine };
        const mk = `${b.color}|${b.color2}|${b.mine}`;
        let mats = teamMats.get(mk);
        if (!mats) {
          mats = materialsFor(look, rain > 0.5);
          teamMats.set(mk, mats);
        }
        o = buildBike(look, mats, q.lod);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.9, 16),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        shadow.scale.set(1.5, 0.55, 1);
        o.add(shadow);
        o.scale.setScalar(1.5);
        world.add(o);
        bikeObjs.set(b.id, o);
      }
      return o;
    };
    // Spruzzi d'acqua dietro le moto sul bagnato.
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0xdfe6ee,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const sprayGeo = new THREE.ConeGeometry(1.1, 3.2, 10, 1, true);
    sprayGeo.rotateZ(Math.PI / 2);
    sprayGeo.translate(-2.2, 0.7, 0);

    const crashGroup = new THREE.Group();
    world.add(crashGroup);
    // Pioggia: gocce che cadono intorno alla telecamera.
    let drops: THREE.LineSegments | null = null;
    if (rain > 0) {
      const n = Math.round(4000 * rain * q.crowd);
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 160,
          y = Math.random() * 60,
          z = (Math.random() - 0.5) * 160;
        pos.set([x, y, z, x - 0.2, y - 1.4, z], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      drops = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: 0xcfd8e6, transparent: true, opacity: 0.45 }),
      );
      world.add(drops);
    }

    // ---- Telecamere ----
    // Torrette TV (alte, fuori pista) e punti a bordo pista, calcolati dal tracciato.
    const tvPosts: THREE.Vector3[] = [];
    for (let k = 0; k < 14; k++) {
      const i = Math.floor((k / 14) * N);
      const side = sc.curv[i]! > 0 ? 1 : -1;
      const arr = sc.barrier[side === 1 ? 0 : 1];
      const p: V = [
        at(i)[0] + nr(i)[0] * (arr[i]! + 0.03) * side,
        at(i)[1] + nr(i)[1] * (arr[i]! + 0.03) * side,
      ];
      tvPosts.push(new THREE.Vector3(X(p), 22, Z(p)));
    }
    const boxIdx = Math.floor((sc.pitBoxStart + sc.pitBoxEnd) / 2);
    const boxA = sc.pitLane[Math.max(0, boxIdx - 6)]!,
      boxB = sc.pitLane[Math.min(sc.pitLane.length - 1, boxIdx + 6)]!;

    const camPos = new THREE.Vector3(0, 400, 0);
    const camLook = new THREE.Vector3();
    const center = new THREE.Vector3(
      ((sc.bounds.x0 + sc.bounds.x1) / 2) * K,
      0,
      ((sc.bounds.y0 + sc.bounds.y1) / 2) * K,
    );
    const prev = new Map<string, { x: number; z: number; yaw: number; lean: number }>();
    // Curvatura di riferimento della pista (95° percentile): lì la moto arriva a ~50° di piega.
    const curv = sc.pts.map((p0, i) => {
      const t0 = sc.tan[i]!,
        t1 = sc.tan[(i + 1) % N]!;
      const ang = Math.abs(Math.atan2(t0[0] * t1[1] - t0[1] * t1[0], t0[0] * t1[0] + t0[1] * t1[1]));
      const p1 = sc.pts[(i + 1) % N]!;
      return ang / Math.max(1e-6, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * K);
    });
    const kRef = [...curv].sort((a, b) => a - b)[Math.floor(N * 0.95)] || 1;
    // Regia automatica: cambia inquadratura ogni pochi secondi o quando succede qualcosa.
    const director = { until: 0, mode: 'chase' as Exclude<Cam3D, 'auto'>, target: '' };
    const side = { post: null as THREE.Vector3 | null, frac: 0 };
    let raf = 0;
    let last = 0;
    let frameNo = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
      last = now;
      frameNo++;
      const k = (a60: number) => 1 - Math.pow(1 - a60, dt * 60);
      const p = live.current;
      const f = p.frame;
      // Moto.
      const seen = new Set<string>();
      for (const b of f.bikes) {
        seen.add(b.id);
        const m = getBike(b);
        m.visible = true;
        const x = X(b.pos),
          z = Z(b.pos),
          yaw = -Math.atan2(b.dir[1], b.dir[0]);
        m.position.set(x, 0.2, z);
        m.rotation.y = yaw;
        const pr = prev.get(b.id);
        let lean = pr?.lean ?? 0;
        if (pr) {
          const dist = Math.hypot(x - pr.x, z - pr.z);
          if (dist > 0.05 && dist < 60) {
            let dy = yaw - pr.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            const target = Math.max(-1, Math.min(1, dy / dist / kRef)) * 0.85;
            lean += (target - lean) * k(0.25);
          } else if (dist >= 60) lean = 0;
          else lean += (0 - lean) * k(0.02);
        }
        prev.set(b.id, { x, z, yaw, lean });
        poseBike(m, lean);
        let spray = m.getObjectByName('spray');
        if (f.rain > 0.5 && f.racing && !spray) {
          spray = new THREE.Mesh(sprayGeo, sprayMat);
          spray.name = 'spray';
          m.add(spray);
        }
      }
      for (const [id, m] of bikeObjs) if (!seen.has(id)) m.visible = false;
      // Moto cadute nella ghiaia.
      while (crashGroup.children.length < f.crashes.length) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.6), mat(0x2b2d31));
        c.rotation.z = Math.PI / 2.3;
        crashGroup.add(c);
      }
      f.crashes.forEach((c, i) => crashGroup.children[i]!.position.set(X(c), 0.6, Z(c)));
      // Bandiere: gialle nei tratti indicati dalla direzione gara, rosse ovunque con la gara interrotta.
      const flagSpots = f.redActive ? tvPosts.map((_, i) => i / tvPosts.length) : f.yellow;
      flags.forEach((fl, i) => {
        const fr = flagSpots[i];
        fl.visible = fr !== undefined;
        if (fr === undefined) return;
        const pp = marshalPost(fr);
        fl.material = f.redActive ? redFlagMat : flagMat;
        fl.position.set(X(pp), 2.6 + Math.sin(now / 120 + i) * 0.25, Z(pp));
        fl.rotation.y = now / 400 + i;
      });
      // Pubblico: esulta alla bandiera a scacchi, nelle battaglie e all'ultimo giro.
      if (q.animCrowd && frameNo % 2 === 0) {
        const hype = f.chequered ? 1 : f.lastLap ? 0.6 : f.battles.length ? 0.25 : 0.08;
        const tt = now / 1000;
        for (let i = 0; i < people.length; i += 1) {
          const pp = people[i]!;
          const jump = Math.max(0, Math.sin(tt * 9 + i * 1.7)) * hype * 0.5;
          dummy.position.set(pp.x, pp.y + jump, pp.z);
          dummy.updateMatrix();
          crowd.setMatrixAt(i, dummy.matrix);
        }
        crowd.instanceMatrix.needsUpdate = true;
      }
      if (drops) {
        drops.position.set(camPos.x, camPos.y - 30 - ((now / 20) % 30), camPos.z);
      }

      // Telecamera.
      const pick = (id: string) => f.bikes.find((b) => b.id === id);
      const selected = f.bikes.find((b) => b.selected) ?? f.bikes.find((b) => b.mine) ?? f.bikes[0];
      let mode: Exclude<Cam3D, 'auto'> = p.cam === 'auto' ? director.mode : p.cam;
      let target = selected;
      if (p.cam === 'auto') {
        if (now > director.until || !pick(director.target)) {
          // Priorità: bandiera a scacchi → leader; battaglia → chi è in lotta; altrimenti il pilota selezionato.
          const battle = f.battles.find(([a, b]) => pick(a)?.selected || pick(b)?.selected) ?? f.battles[0];
          const leaderBike = f.bikes.find((b) => b.number === p.leaderNumber);
          const t = f.chequered && leaderBike ? leaderBike : battle ? pick(battle[1]) : selected;
          const modes: Exclude<Cam3D, 'auto'>[] = ['chase', 'tv', 'trackside', 'tv'];
          director.mode = f.racing ? modes[Math.floor(now / 7000) % modes.length]! : 'box';
          director.target = t?.id ?? '';
          director.until = now + 6500;
          side.post = null;
        }
        mode = director.mode;
        target = pick(director.target) ?? selected;
      }
      let fov = 50;
      if (target && mode !== 'all' && mode !== 'box') {
        const tx = X(target.pos),
          tz = Z(target.pos);
        const tp = new THREE.Vector3(tx, 1.2, tz);
        const dx = target.dir[0],
          dz = target.dir[1];
        if (mode === 'chase') {
          camPos.lerp(new THREE.Vector3(tx - dx * 12, 4.6, tz - dz * 12), k(0.12));
          camLook.lerp(new THREE.Vector3(tx + dx * 9, 0.6, tz + dz * 9), k(0.18));
        } else if (mode === 'tv') {
          let best = tvPosts[0]!;
          for (const tvp of tvPosts) if (tvp.distanceTo(tp) < best.distanceTo(tp)) best = tvp;
          camPos.lerp(best, k(0.05));
          camLook.lerp(tp, k(0.25));
          fov = Math.max(
            6,
            Math.min(45, (2 * Math.atan(9 / Math.max(1, camPos.distanceTo(tp))) * 180) / Math.PI),
          );
        } else {
          // Bordo pista: telecamera bassa più avanti, la moto le passa davanti.
          if (!side.post || side.post.distanceTo(tp) > 140) {
            const near = sc.pts.reduce(
              (bst, pt, i) => {
                const d = (pt[0] - target!.pos[0]) ** 2 + (pt[1] - target!.pos[1]) ** 2;
                return d < bst.d ? { i, d } : bst;
              },
              { i: 0, d: Infinity },
            ).i;
            const j = (near + Math.max(3, Math.floor(N / 60))) % N;
            const sd = sc.curv[j]! > 0 ? -1 : 1;
            const w = sc.width / 2 + 0.006;
            side.post = new THREE.Vector3(
              X([at(j)[0] + nr(j)[0] * w * sd, 0]),
              1.1,
              Z([0, at(j)[1] + nr(j)[1] * w * sd]),
            );
          }
          camPos.lerp(side.post, k(0.5));
          camLook.lerp(tp, k(0.3));
          fov = Math.max(
            10,
            Math.min(55, (2 * Math.atan(6 / Math.max(1, camPos.distanceTo(tp))) * 180) / Math.PI),
          );
        }
      } else if (mode === 'box') {
        camPos.lerp(new THREE.Vector3(X(boxA), 4, Z(boxA)), k(0.08));
        camLook.lerp(new THREE.Vector3(X(boxB), 1, Z(boxB)), k(0.1));
        fov = 55;
      } else {
        const a = now / 1000 / 25;
        const r = Math.max(bw, bh) * 0.6;
        camPos.lerp(
          new THREE.Vector3(center.x + Math.cos(a) * r, r * 0.55, center.z + Math.sin(a) * r),
          k(0.05),
        );
        camLook.lerp(center, k(0.1));
      }
      if (Math.abs(camera.fov - fov) > 0.1) {
        camera.fov += (fov - camera.fov) * k(0.15);
        camera.updateProjectionMatrix();
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      if (q.shadows) {
        sun.position.set(camLook.x + 120, 240, camLook.z + 90);
        sun.target.position.copy(camLook);
      }
      renderer.render(world, camera);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      // Libera tutto: geometrie, materiali, texture e contesto WebGL.
      const textures = new Set<THREE.Texture>();
      world.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const ms = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of ms) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
          m.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      el.removeChild(renderer.domElement);
    };
    // La scena 3D si costruisce una volta per circuito e qualità; moto e telecamera si aggiornano via `live`.
  }, [props.scene, props.quality, props.tier]);

  return <div ref={host} className="rv-3d" aria-label="Vista 3D della gara" />;
}
