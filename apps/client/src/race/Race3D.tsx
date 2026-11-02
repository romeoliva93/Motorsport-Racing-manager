import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE, type BikeDraw, type Scene, type V } from './circuitScene.ts';

/**
 * Vista 3D della gara (Three.js, licenza MIT). Usa la stessa geometria dell'autodromo 2D (`Scene`) e le stesse
 * posizioni delle moto calcolate dalla vista di gara: cambia solo il modo di disegnarle.
 * Caricata solo quando si sceglie il 3D (import dinamico), così chi resta in 2D non scarica la libreria.
 */
const K = 1000; // unità del mondo 3D per unità normalizzata del tracciato

export interface Race3DProps {
  scene: Scene;
  bikes: BikeDraw[];
  cam: 'all' | 'mine' | 'leader';
  leaderNumber: number | null;
  rain: number;
  crashes: V[];
}

export default function Race3D(props: Race3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const sc = props.scene;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    const sky = props.rain > 0 ? 0x7d8794 : 0x9cc6ea;
    world.background = new THREE.Color(sky);
    world.fog = new THREE.Fog(sky, 300, props.rain > 0 ? 900 : 1800);
    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.5, 5000);
    world.add(new THREE.HemisphereLight(0xffffff, 0x4b5b3a, props.rain > 0 ? 0.7 : 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, props.rain > 0 ? 0.6 : 1.4);
    sun.position.set(400, 800, 300);
    world.add(sun);

    const X = (p: V) => p[0] * K;
    const Z = (p: V) => p[1] * K;
    const N = sc.pts.length;
    const at = (i: number) => sc.pts[((i % N) + N) % N]!;
    const nr = (i: number) => sc.nor[((i % N) + N) % N]!;
    const mat = (color: string | number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
      new THREE.MeshLambertMaterial({ color, ...extra });

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
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, material);
      world.add(m);
      return m;
    };
    const pal = PALETTE[sc.env];
    const twoSided = { side: THREE.DoubleSide } as const;

    // Terreno.
    const bw = (sc.bounds.x1 - sc.bounds.x0) * K,
      bh = (sc.bounds.y1 - sc.bounds.y0) * K;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(bw * 3, bh * 3), mat(pal.ground));
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
      mat(pal.verge, twoSided),
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
        mat(0xd6c18f, twoSided),
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
      mat(props.rain > 0 ? 0x2c2e33 : 0x3b3d42, twoSided),
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
    const crowdMat = new THREE.MeshLambertMaterial();
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

    // Moto: carena nei colori della squadra, pilota, casco, ruote; ombra sotto.
    const bikeMeshes = new Map<string, THREE.Group>();
    const makeBike = (b: BikeDraw) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.55), mat(b.color));
      body.position.y = 0.75;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), mat(b.color2));
      tail.position.set(-0.85, 1.15, 0);
      const rider = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.5), mat(b.color2));
      rider.position.set(-0.2, 1.3, 0);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        mat(b.mine ? 0xff7a1a : 0xf3f1ec),
      );
      helmet.position.set(0.25, 1.55, 0);
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 14);
      wheelGeo.rotateX(Math.PI / 2);
      const w1 = new THREE.Mesh(wheelGeo, mat(0x111111));
      w1.position.set(0.85, 0.34, 0);
      const w2b = new THREE.Mesh(wheelGeo, mat(0x111111));
      w2b.position.set(-0.85, 0.34, 0);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.1, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.26;
      shadow.scale.set(1.3, 0.6, 1);
      g.add(body, tail, rider, helmet, w1, w2b, shadow);
      g.scale.setScalar(1.6);
      world.add(g);
      return g;
    };
    const crashGroup = new THREE.Group();
    world.add(crashGroup);

    const camPos = new THREE.Vector3(0, 400, 0);
    const camLook = new THREE.Vector3();
    const center = new THREE.Vector3(
      ((sc.bounds.x0 + sc.bounds.x1) / 2) * K,
      0,
      ((sc.bounds.y0 + sc.bounds.y1) / 2) * K,
    );
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const p = live.current;
      // Aggiorna le moto.
      const seen = new Set<string>();
      for (const b of p.bikes) {
        const key = `${b.number}-${b.color}`;
        seen.add(key);
        let m = bikeMeshes.get(key);
        if (!m) {
          m = makeBike(b);
          bikeMeshes.set(key, m);
        }
        m.visible = true;
        m.position.set(X(b.pos), 0.2, Z(b.pos));
        m.rotation.y = -Math.atan2(b.dir[1], b.dir[0]);
      }
      for (const [k, m] of bikeMeshes) if (!seen.has(k)) m.visible = false;
      // Moto cadute.
      while (crashGroup.children.length < p.crashes.length) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1.2), mat(0x2b2d31));
        c.rotation.z = Math.PI / 2.3;
        crashGroup.add(c);
      }
      p.crashes.forEach((c, i) => crashGroup.children[i]!.position.set(X(c), 0.6, Z(c)));
      // Telecamera.
      const target =
        p.cam === 'mine'
          ? p.bikes.filter((b) => b.mine).at(-1)
          : p.cam === 'leader'
            ? p.bikes.find((b) => b.number === p.leaderNumber)
            : undefined;
      if (target) {
        const tx = X(target.pos),
          tz = Z(target.pos);
        const dx = target.dir[0],
          dz = target.dir[1];
        camPos.lerp(new THREE.Vector3(tx - dx * 28, 12, tz - dz * 28), 0.08);
        camLook.lerp(new THREE.Vector3(tx + dx * 25, 1.5, tz + dz * 25), 0.12);
      } else {
        const a = now / 1000 / 25;
        const r = Math.max(bw, bh) * 0.6;
        camPos.lerp(
          new THREE.Vector3(center.x + Math.cos(a) * r, r * 0.55, center.z + Math.sin(a) * r),
          0.05,
        );
        camLook.lerp(center, 0.1);
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
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
      renderer.dispose();
      world.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      el.removeChild(renderer.domElement);
    };
    // La scena 3D si costruisce una volta per circuito; moto e telecamera si aggiornano via `live`.
  }, [props.scene]);

  return <div ref={host} className="rv-3d" aria-label="Vista 3D della gara" />;
}
