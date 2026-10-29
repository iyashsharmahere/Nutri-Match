import {
  Scene, OrthographicCamera, Group, Mesh, MeshStandardMaterial, SphereGeometry, ConeGeometry, CatmullRomCurve3, Vector3,
  AmbientLight, DirectionalLight, HemisphereLight, DoubleSide, Color, MathUtils,
} from 'three';
import { C } from '../palette.js';
import { leafGeometry, taperedTube, smooth } from '../shapes.js';

const H = 10;                       // world height of the viewport
const TUBULAR = 220, RADIAL = 8;
const LEAF_NODES = [0.12, 0.23, 0.34, 0.45, 0.56, 0.67, 0.78, 0.89, 0.965];
const FRUIT_NODES = [0.31, 0.55, 0.79];
const MIN_GROWTH = 0.07;            // a small sprout is visible before any scrolling

/** 0..1 through the page; tests/harness can override with data.progress. */
function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? MathUtils.clamp(window.scrollY / max, 0, 1) : 0;
}

export function create(ctx) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-0.65, 0.65, H, 0, 0.1, 50);
  camera.position.z = 10;

  scene.add(new HemisphereLight(0xfffaf0, 0xcfc6b2, 1.2));
  scene.add(new AmbientLight(0xffffff, 0.3));
  const sun = new DirectionalLight(0xffffff, 1.9); sun.position.set(-3, 6, 8); scene.add(sun);

  const plant = new Group();
  scene.add(plant);
  const leafGeo = leafGeometry();
  const stemMat = new MeshStandardMaterial({ color: C.mossLight, roughness: 0.7 });
  const leafMats = [C.moss, C.mossLight].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.6, side: DoubleSide, flatShading: true }));

  let W = 1.3, curve, stem, stemIndexCount = 0, tip, leaves = [], fruits = [];
  let target = 0, cur = 0, started = false;

  // Redraw on scroll. In normal mode the render loop already runs every frame,
  // but with reduced motion frames are only drawn on demand, so scrolling must ask for one.
  const onScroll = () => ctx.invalidate();
  if (typeof window !== 'undefined') window.addEventListener('scroll', onScroll, { passive: true });

  function dropPlant() {
    plant.traverse((o) => { if (o.geometry && o.geometry !== leafGeo) o.geometry.dispose(); if (o.material && !leafMats.includes(o.material) && o.material !== stemMat) [].concat(o.material).forEach((m) => m.dispose()); });
    plant.clear();
  }

  function layout() {
    dropPlant();
    const amp = 0.09 * W;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new Vector3(amp * Math.sin(t * 5.2 + 0.4) * (0.5 + 0.5 * t), 0.35 + 9.1 * t, 0));
    }
    curve = new CatmullRomCurve3(pts);
    const geo = taperedTube(curve, TUBULAR, RADIAL, 0.075 * W, 0.028 * W);
    stem = new Mesh(geo, stemMat);
    stemIndexCount = geo.index.count;
    plant.add(stem);

    const mound = new Mesh(new SphereGeometry(0.5 * W, 16, 10), new MeshStandardMaterial({ color: C.soil, roughness: 1, flatShading: true }));
    mound.scale.y = 0.38; mound.position.set(0, 0.12, 0); plant.add(mound);

    tip = new Mesh(new SphereGeometry(0.07 * W, 10, 8), new MeshStandardMaterial({ color: C.mossPale, roughness: 0.5 }));
    plant.add(tip);

    leaves = LEAF_NODES.map((t, k) => {
      const side = k % 2 === 0 ? 1 : -1;
      const g = new Group();
      const m = new Mesh(leafGeo, leafMats[(k >> 1) % 2]);
      g.add(m);
      const p = curve.getPointAt(t);
      g.position.copy(p);
      g.userData = { t, side, len: W * (0.46 - 0.17 * t), k };
      g.scale.setScalar(0.0001);
      plant.add(g);
      return g;
    });

    fruits = FRUIT_NODES.map((t, k) => {
      const side = k % 2 === 0 ? -1 : 1;
      const g = new Group();
      const r = 0.15 * W;
      const body = new Mesh(new SphereGeometry(r, 14, 12), new MeshStandardMaterial({ color: C.moss, roughness: 0.45 }));
      const cap = new Mesh(new ConeGeometry(r * 0.55, r * 0.35, 6), new MeshStandardMaterial({ color: C.moss, roughness: 0.7 }));
      cap.position.y = r * 0.85;
      g.add(body, cap);
      const p = curve.getPointAt(t);
      g.position.set(p.x + side * (0.075 * W * (1 - 0.6 * t) + r * 0.95), p.y - r * 0.9, 0.05);
      g.userData = { body, t, k };
      g.scale.setScalar(0.0001);
      plant.add(g);
      return g;
    });
    apply(cur, 0);
  }

  const unripe = new Color(C.mossLight), ripe = new Color(C.clay);

  function apply(p, time) {
    const g = MIN_GROWTH + (1 - MIN_GROWTH) * p;
    // stem draws upward
    const segs = Math.max(2, Math.floor(g * TUBULAR));
    stem.geometry.setDrawRange(0, Math.min(stemIndexCount, segs * RADIAL * 6));
    const tp = curve.getPointAt(Math.min(g, 1));
    tip.position.copy(tp);
    tip.visible = g < 0.985;

    leaves.forEach((lf) => {
      const { t, side, len, k } = lf.userData;
      const u = smooth((g - t) / 0.13);                   // 0 -> 1 as the stem passes the node
      lf.scale.setScalar(Math.max(0.0001, len * u));
      const open = 1.45 - 0.95 * u;                      // folded against the stem, then opening out
      const sway = ctx.reduced ? 0 : Math.sin(time * 1.2 + k * 1.7) * 0.05 * u;
      lf.rotation.z = side > 0 ? open + sway : Math.PI - open - sway;
      lf.rotation.x = side * 0.45 * u;
      lf.rotation.y = side * 0.3 * (1 - u);
    });

    fruits.forEach((fr) => {
      const { body, k } = fr.userData;
      const u = smooth((p - (0.72 + k * 0.05)) / 0.2);
      fr.scale.setScalar(Math.max(0.0001, u));
      body.material.color.copy(unripe).lerp(ripe, smooth((p - 0.82) / 0.18));
    });
  }

  return {
    scene, camera,
    resize(w, h) {
      W = H * (w / h);
      camera.left = -W / 2; camera.right = W / 2; camera.updateProjectionMatrix();
      layout();
    },
    update(time, dt) {
      const d = ctx.getData();
      target = d?.progress != null ? d.progress : scrollProgress();
      cur = ctx.reduced || !started ? target : cur + (target - cur) * (1 - Math.exp(-dt * 5));
      started = true;
      apply(cur, time);
    },
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('scroll', onScroll);
      dropPlant(); leafGeo.dispose(); stemMat.dispose(); leafMats.forEach((m) => m.dispose());
    },
  };
}
