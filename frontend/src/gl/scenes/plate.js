import {
  Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, CylinderGeometry, TorusGeometry,
  Shape, ExtrudeGeometry, SphereGeometry, ConeGeometry, CatmullRomCurve3, Vector3, Vector2, LatheGeometry,
  AmbientLight, DirectionalLight, HemisphereLight, CircleGeometry, MeshBasicMaterial, DoubleSide,
} from 'three';
import { C } from '../palette.js';
import { DEFAULT_SHARES, sharesFrom } from '../helpers.js';
import { leafGeometry, calyxGeometry, taperedTube, smooth, clamp } from '../shapes.js';

export { DEFAULT_SHARES, sharesFrom };

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

  // 1. Vine-ripe tomato with glossy skin and curved 5-star calyx
  const tomato = new Group();
  const tomatoMat = new MeshStandardMaterial({ color: 0xd12828, roughness: 0.16, metalness: 0.02 });
  const tomatoBody = new Mesh(new SphereGeometry(0.34, 28, 22), tomatoMat);
  tomatoBody.scale.set(1.08, 0.90, 1.08);
  tomato.add(tomatoBody);
  const sepalMat = new MeshStandardMaterial({ color: 0x2e6d38, roughness: 0.48, side: DoubleSide });
  const calyx = new Mesh(calyxGeometry(0.34), sepalMat);
  calyx.position.y = 0.29;
  calyx.scale.set(0.34, 0.34, 0.34);
  tomato.add(calyx);
  const tomatoStem = new Mesh(new CylinderGeometry(0.025, 0.035, 0.15, 8), sepalMat);
  tomatoStem.position.set(0.02, 0.38, 0);
  tomatoStem.rotation.z = 0.22;
  tomato.add(tomatoStem);

  // 2. Sunny citrus lemon with realistic contoured profile and stem button
  const lemon = new Group();
  const lemonPts = [
    new Vector2(0.001, 0.42),
    new Vector2(0.035, 0.40),
    new Vector2(0.07, 0.36),
    new Vector2(0.20, 0.22),
    new Vector2(0.26, 0.0),
    new Vector2(0.20, -0.22),
    new Vector2(0.07, -0.36),
    new Vector2(0.035, -0.40),
    new Vector2(0.001, -0.42),
  ];
  const lemonGeo = new LatheGeometry(lemonPts, 24);
  const lemonMat = new MeshStandardMaterial({ color: 0xf6cf22, roughness: 0.34, metalness: 0.02 });
  const lemonBody = new Mesh(lemonGeo, lemonMat);
  lemon.add(lemonBody);
  const lemonButton = new Mesh(new CylinderGeometry(0.025, 0.035, 0.03, 8), new MeshStandardMaterial({ color: 0x5a7e36, roughness: 0.6 }));
  lemonButton.position.y = -0.42;
  lemon.add(lemonButton);

  // 3. Crisp garden carrot with tapered organic root and feathery foliage top
  const carrot = new Group();
  const carrotPts = [
    new Vector2(0.001, 0.48),
    new Vector2(0.14, 0.46),
    new Vector2(0.165, 0.41),
    new Vector2(0.16, 0.25),
    new Vector2(0.14, 0.05),
    new Vector2(0.11, -0.18),
    new Vector2(0.07, -0.38),
    new Vector2(0.025, -0.50),
    new Vector2(0.001, -0.52),
  ];
  const carrotGeo = new LatheGeometry(carrotPts, 22);
  const carrotMat = new MeshStandardMaterial({ color: 0xee5f10, roughness: 0.38, metalness: 0.02 });
  const carrotRoot = new Mesh(carrotGeo, carrotMat);
  carrot.add(carrotRoot);

  const carrotGreenMat = new MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.45, side: DoubleSide });
  [-0.08, -0.03, 0.03, 0.08].forEach((x, i) => {
    const stalk = new Mesh(new CylinderGeometry(0.012, 0.022, 0.38, 6), carrotGreenMat);
    stalk.position.set(x, 0.58, 0);
    stalk.rotation.z = (i - 1.5) * 0.32;
    const frond = new Mesh(leafGeometry(), carrotGreenMat);
    frond.position.set(x * 1.5, 0.65, 0.02);
    frond.scale.set(0.18, 0.18, 0.18);
    frond.rotation.z = (i - 1.5) * 0.4;
    carrot.add(stalk, frond);
  });

  // 4. Fresh Indian red chilli with curved tapered pod, calyx cap and curved stalk
  const chilli = new Group();
  const chilliCurve = new CatmullRomCurve3([
    new Vector3(-0.42, 0.14, 0),
    new Vector3(-0.15, -0.06, 0.03),
    new Vector3(0.12, -0.02, 0),
    new Vector3(0.40, 0.18, -0.02),
  ]);
  const chilliGeo = taperedTube(chilliCurve, 24, 12, 0.082, 0.012);
  const chilliMat = new MeshStandardMaterial({ color: 0xc41d1d, roughness: 0.18, metalness: 0.02 });
  chilli.add(new Mesh(chilliGeo, chilliMat));

  const chilliCap = new Mesh(new CylinderGeometry(0.085, 0.075, 0.08, 12), sepalMat);
  chilliCap.position.set(-0.41, 0.14, 0);
  chilliCap.rotation.z = -0.55;
  chilli.add(chilliCap);

  const chilliStem = new Mesh(new CylinderGeometry(0.022, 0.03, 0.16, 8), sepalMat);
  chilliStem.position.set(-0.48, 0.21, 0);
  chilliStem.rotation.z = 0.65;
  chilli.add(chilliStem);

  // 5. Authentic garlic bulb with clustered clove lobes and papery tapered neck
  const garlic = new Group();
  const garlicMat = new MeshStandardMaterial({ color: 0xfbf7ed, roughness: 0.52, metalness: 0.02 });
  const cloveGeo = new SphereGeometry(0.13, 16, 14);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const clove = new Mesh(cloveGeo, garlicMat);
    clove.position.set(Math.cos(a) * 0.13, 0.02, Math.sin(a) * 0.13);
    clove.scale.set(0.85, 1.35, 1.0);
    clove.rotation.y = -a;
    garlic.add(clove);
  }
  const garlicCore = new Mesh(new CylinderGeometry(0.04, 0.15, 0.35, 12), garlicMat);
  garlicCore.position.y = 0.05;
  garlic.add(garlicCore);
  const garlicNeck = new Mesh(new ConeGeometry(0.07, 0.28, 10), new MeshStandardMaterial({ color: 0xebd9be, roughness: 0.75 }));
  garlicNeck.position.y = 0.30;
  garlic.add(garlicNeck);

  // 6. Fresh botanical herb leaf with realistic 3D midrib curl and petiole stalk
  const leafMat = new MeshStandardMaterial({ color: 0x2e6f3b, roughness: 0.36, metalness: 0.03, side: DoubleSide });
  const herbLeaf = new Mesh(leafGeometry(), leafMat);
  herbLeaf.scale.setScalar(0.95);
  herbLeaf.position.x = -0.38;
  const leafPetiole = new Mesh(new CylinderGeometry(0.015, 0.022, 0.25, 6), new MeshStandardMaterial({ color: 0x3d7e48, roughness: 0.5 }));
  leafPetiole.rotation.z = -Math.PI / 2;
  leafPetiole.position.set(-0.48, 0, 0);
  const leafG = new Group();
  leafG.add(herbLeaf, leafPetiole);

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

  // Natural three-point studio lighting with subtle produce rim illumination
  scene.add(new HemisphereLight(0xf4f8f0, 0xd8cbba, 1.15));
  scene.add(new AmbientLight(0xffffff, 0.30));

  const sun = new DirectionalLight(0xfff8ee, 1.9);
  sun.position.set(-4, 7, 5);
  scene.add(sun);

  const rimLight = new DirectionalLight(0xdcf0f8, 1.25);
  rimLight.position.set(4, 5, -5);
  scene.add(rimLight);

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
