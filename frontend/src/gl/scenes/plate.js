import {
  Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, CylinderGeometry, TorusGeometry,
  Shape, ExtrudeGeometry, SphereGeometry, ConeGeometry, TubeGeometry, CatmullRomCurve3, Vector3,
  AmbientLight, DirectionalLight, HemisphereLight, CircleGeometry, MeshBasicMaterial, DoubleSide,
} from 'three';
import { C } from '../palette.js';
import { DEFAULT_SHARES, sharesFrom } from '../helpers.js';
import { leafGeometry, smooth, clamp } from '../shapes.js';

export { DEFAULT_SHARES, sharesFrom };

const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, flatShading: true, ...extra });

function buildWedges(shares) {
  const group = new Group();
  const parts = [['protein', C.moss], ['carbs', C.saffron], ['fat', C.clay]];
  const GAP = 0.07;
  let start = 0;
  parts.forEach(([key, color], i) => {
    const span = shares[key] * Math.PI * 2;
    const a0 = start + GAP / 2, a1 = start + span - GAP / 2;
    start += span;
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, 1.72, a0, a1, false);
    shape.lineTo(0, 0);
    const h = 0.2 + shares[key] * 1.15;
    const geo = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 28 });
    geo.rotateX(-Math.PI / 2);
    const m = new Mesh(geo, new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 }));
    const mid = (a0 + a1) / 2;
    m.position.set(Math.cos(mid) * 0.05, 0.1, -Math.sin(mid) * 0.05);
    m.userData = { delay: i * 0.12 };
    group.add(m);
  });
  return group;
}

function produce() {
  const items = [];
  const add = (obj, o) => { items.push({ obj, ...o }); return obj; };

  const tomato = new Group();
  tomato.add(new Mesh(new SphereGeometry(0.34, 18, 14), mat(C.clay)));
  const cap = new Mesh(new ConeGeometry(0.17, 0.12, 6), mat(C.moss)); cap.position.y = 0.3; tomato.add(cap);

  const lemon = new Group();
  const body = new Mesh(new SphereGeometry(0.3, 18, 14), mat(C.saffronLight)); body.scale.set(1.3, 0.92, 0.92); lemon.add(body);
  const nub = new Mesh(new ConeGeometry(0.06, 0.1, 6), mat(C.saffronLight)); nub.rotation.z = -Math.PI / 2; nub.position.x = 0.4; lemon.add(nub);

  const carrot = new Group();
  const root = new Mesh(new ConeGeometry(0.17, 0.85, 10), mat(C.saffron)); root.rotation.z = Math.PI; carrot.add(root);
  [-0.07, 0, 0.07].forEach((x, i) => { const t = new Mesh(new ConeGeometry(0.035, 0.28, 5), mat(C.mossLight)); t.position.set(x, 0.55, 0); t.rotation.z = (i - 1) * 0.35; carrot.add(t); });

  const chilli = new Group();
  const curve = new CatmullRomCurve3([new Vector3(-0.4, 0.1, 0), new Vector3(-0.1, -0.08, 0), new Vector3(0.2, 0, 0), new Vector3(0.45, 0.22, 0)]);
  chilli.add(new Mesh(new TubeGeometry(curve, 16, 0.075, 8), mat(C.clayDark)));
  const stem = new Mesh(new CylinderGeometry(0.03, 0.04, 0.14, 6), mat(C.moss)); stem.position.set(-0.45, 0.14, 0); stem.rotation.z = 0.7; chilli.add(stem);

  const garlic = new Group();
  const bulb = new Mesh(new SphereGeometry(0.3, 16, 12), mat(C.cream)); bulb.scale.y = 0.85; garlic.add(bulb);
  const top = new Mesh(new ConeGeometry(0.1, 0.28, 8), mat(C.cream)); top.position.y = 0.32; garlic.add(top);

  const leaf = new Mesh(leafGeometry(), mat(C.mossLight, { side: DoubleSide })); leaf.scale.setScalar(0.95); leaf.position.x = -0.45;
  const leafG = new Group(); leafG.add(leaf);

  const list = [
    [tomato, 3.15, 0.2, 1.55, 0.13], [lemon, 3.35, 1.25, 0.55, -0.1], [carrot, 3.05, 2.2, 1.35, 0.12],
    [chilli, 3.3, 3.2, 0.7, -0.14], [garlic, 3.1, 4.2, 1.5, 0.1], [leafG, 3.4, 5.25, 0.95, -0.12],
  ];
  list.forEach(([o, r, a, y, spd], i) => add(o, { r, a, y, spd, phase: i * 1.3, spin: 0.4 + i * 0.07 }));
  return items;
}

export function create(ctx) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1.2, 0.1, 60);
  camera.position.set(0, 6.4, 10.6);
  camera.lookAt(0, 0.1, 0);

  scene.add(new HemisphereLight(0xfffaf0, 0xcfc6b2, 1.05));
  scene.add(new AmbientLight(0xffffff, 0.35));
  const sun = new DirectionalLight(0xffffff, 2.1); sun.position.set(-4, 7, 5); scene.add(sun);

  const root = new Group();
  scene.add(root);

  // plate
  const plate = new Group();
  const dish = new Mesh(new CylinderGeometry(2.4, 2.05, 0.2, 72), new MeshStandardMaterial({ color: C.card, roughness: 0.35 }));
  dish.position.y = -0.0; plate.add(dish);
  const rim = new Mesh(new TorusGeometry(2.38, 0.07, 12, 96), new MeshStandardMaterial({ color: C.line, roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.1; plate.add(rim);
  root.add(plate);

  const shadow = new Mesh(new CircleGeometry(3.1, 48), new MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.07 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.12; scene.add(shadow);

  let wedges = null, key = '', born = 0, introDone = false;
  const items = produce();
  items.forEach((it) => { it.obj.scale.setScalar(1.3); root.add(it.obj); });

  const rebuild = (shares, t) => {
    if (wedges) { plate.remove(wedges); wedges.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    wedges = buildWedges(shares);
    plate.add(wedges);
    born = t; introDone = ctx.reduced;
  };

  let yaw = 0;
  return {
    scene, camera,
    resize(w, h) { camera.aspect = w / h; camera.fov = w / h < 1 ? 42 : 32; camera.updateProjectionMatrix(); },
    update(t, dt) {
      const shares = sharesFrom(ctx.getData()?.macros);
      const k = `${shares.protein.toFixed(3)}|${shares.carbs.toFixed(3)}|${shares.fat.toFixed(3)}`;
      if (k !== key) { key = k; rebuild(shares, t); }

      if (!ctx.reduced) yaw += dt * 0.22;
      const targetYaw = yaw + ctx.input.dragX;
      root.rotation.y = targetYaw;
      root.rotation.x = clamp(ctx.input.dragY * 0.4, -0.35, 0.35) + 0.0;
      plate.rotation.y = 0;

      // wedges grow in
      wedges.children.forEach((m) => {
        const p = introDone ? 1 : smooth((t - born - m.userData.delay) / 0.9);
        m.scale.y = Math.max(0.001, p);
      });
      if (!introDone && t - born > 1.4) introDone = true;

      items.forEach((it) => {
        const ang = it.a + (ctx.reduced ? 0 : t * it.spd);
        it.obj.position.set(Math.cos(ang) * it.r, it.y + (ctx.reduced ? 0 : Math.sin(t * 0.9 + it.phase) * 0.12), Math.sin(ang) * it.r);
        it.obj.rotation.y = ctx.reduced ? it.phase : t * it.spin + it.phase;
        it.obj.rotation.z = ctx.reduced ? 0.15 : Math.sin(t * 0.7 + it.phase) * 0.2;
      });
    },
    dispose() {
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    },
  };
}
