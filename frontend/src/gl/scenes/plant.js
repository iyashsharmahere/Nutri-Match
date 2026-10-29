import {
  Scene, OrthographicCamera, Group, Mesh, MeshStandardMaterial, SphereGeometry, CylinderGeometry, CatmullRomCurve3, Vector3,
  AmbientLight, DirectionalLight, HemisphereLight, DoubleSide, Color, MathUtils,
} from 'three';
import { leafGeometry, calyxGeometry, taperedTube, smooth } from '../shapes.js';

const H = 10;                       // world height of the viewport
const TUBULAR = 220, RADIAL = 12;   // smooth round stem
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

  // Natural three-point lighting with subtle foliage rim highlight
  scene.add(new HemisphereLight(0xf2f8ee, 0x3d3024, 1.25));
  scene.add(new AmbientLight(0xffffff, 0.25));

  const sun = new DirectionalLight(0xfff6ea, 1.8);
  sun.position.set(-3, 7, 7);
  scene.add(sun);

  const rim = new DirectionalLight(0xdcf2d8, 1.35);
  rim.position.set(3, 5, -5);
  scene.add(rim);

  const plant = new Group();
  scene.add(plant);

  // Botanically sculpted leaf with midrib and realistic 3D curl
  const leafGeo = leafGeometry();
  const calyxGeo = calyxGeometry(1.0);

  // Organic satin foliage materials with gentle specular sheen
  const stemMat = new MeshStandardMaterial({ color: 0x367245, roughness: 0.50, metalness: 0.04 });
  const leafMats = [
    new MeshStandardMaterial({ color: 0x245838, roughness: 0.36, metalness: 0.04, side: DoubleSide }),
    new MeshStandardMaterial({ color: 0x3c7e4c, roughness: 0.40, metalness: 0.03, side: DoubleSide }),
  ];
  const calyxMat = new MeshStandardMaterial({ color: 0x286333, roughness: 0.48, side: DoubleSide });

  let W = 1.3, curve, stem, stemIndexCount = 0, tip, leaves = [], fruits = [];
  let target = 0, cur = 0, started = false;

  // Redraw on scroll. In normal mode the render loop already runs every frame,
  // but with reduced motion frames are only drawn on demand, so scrolling must ask for one.
  const onScroll = () => ctx.invalidate();
  if (typeof window !== 'undefined') window.addEventListener('scroll', onScroll, { passive: true });

  function dropPlant() {
    plant.traverse((o) => {
      if (o.geometry && o.geometry !== leafGeo && o.geometry !== calyxGeo) o.geometry.dispose();
      if (o.material && !leafMats.includes(o.material) && o.material !== stemMat && o.material !== calyxMat) {
        [].concat(o.material).forEach((m) => m.dispose());
      }
    });
    plant.clear();
  }

  function layout() {
    dropPlant();
    const amp = 0.09 * W;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = amp * Math.sin(t * 5.2 + 0.4) * (0.5 + 0.5 * t);
      const y = 0.35 + 9.1 * t;
      const z = amp * 0.35 * Math.cos(t * 4.2 + 0.5) * (0.4 + 0.6 * t);
      pts.push(new Vector3(x, y, z));
    }
    curve = new CatmullRomCurve3(pts);
    const geo = taperedTube(curve, TUBULAR, RADIAL, 0.075 * W, 0.028 * W);
    stem = new Mesh(geo, stemMat);
    stemIndexCount = geo.index.count;
    plant.add(stem);

    // Rich organic soil mound base
    const mound = new Mesh(
      new SphereGeometry(0.52 * W, 24, 16),
      new MeshStandardMaterial({ color: 0x382418, roughness: 0.95, flatShading: false })
    );
    mound.scale.set(1.0, 0.34, 1.0);
    mound.position.set(0, 0.12, 0);
    plant.add(mound);

    // Apical growing tip bud
    tip = new Mesh(
      new SphereGeometry(0.065 * W, 14, 12),
      new MeshStandardMaterial({ color: 0x8ed46c, roughness: 0.35, metalness: 0.03 })
    );
    tip.scale.set(0.85, 1.25, 0.85);
    plant.add(tip);

    // Tomato compound foliage (petiole + terminal leaflet + lateral leaflets)
    leaves = LEAF_NODES.map((t, k) => {
      const side = k % 2 === 0 ? 1 : -1;
      const g = new Group();
      const p = curve.getPointAt(t);
      g.position.copy(p);
      const len = W * (0.46 - 0.17 * t);
      g.userData = { t, side, len, k };

      // Main leaflet blade
      const m = new Mesh(leafGeo, leafMats[(k >> 1) % 2]);
      m.position.set(0.18, 0, 0);
      m.scale.set(0.82, 0.95, 0.95);
      g.add(m);

      // Slender petiole connecting stem node to leaf blade
      const petiole = new Mesh(new CylinderGeometry(0.016, 0.024, 0.22, 8), stemMat);
      petiole.rotation.z = -Math.PI / 2;
      petiole.position.set(0.10, 0, 0);
      g.add(petiole);

      // Lateral leaflets (botanical tomato foliage)
      const subMat = leafMats[((k >> 1) + 1) % 2];
      const sub1 = new Mesh(leafGeo, subMat);
      sub1.position.set(0.11, 0.042, 0.02);
      sub1.rotation.z = 0.52;
      sub1.scale.set(0.34, 0.34, 0.34);
      const sub2 = new Mesh(leafGeo, subMat);
      sub2.position.set(0.11, -0.042, 0.02);
      sub2.rotation.z = -0.52;
      sub2.scale.set(0.34, -0.34, 0.34);
      g.add(sub1, sub2);

      g.scale.setScalar(0.0001);
      plant.add(g);
      return g;
    });

    // Vine-ripened tomatoes with glossy skin, 5-star calyx, and vine pedicel
    fruits = FRUIT_NODES.map((t, k) => {
      const side = k % 2 === 0 ? -1 : 1;
      const g = new Group();
      const r = 0.15 * W;

      // Glossy plump oblate tomato body
      const body = new Mesh(
        new SphereGeometry(r, 28, 22),
        new MeshStandardMaterial({ color: 0x60a854, roughness: 0.18, metalness: 0.02 })
      );
      body.scale.set(1.08, 0.90, 1.08);

      // Star-shaped calyx hugging top of the fruit
      const calyx = new Mesh(calyxGeo, calyxMat);
      calyx.position.y = r * 0.86;
      calyx.scale.set(r, r, r);

      // Vine pedicel stalk
      const stalk = new Mesh(
        new CylinderGeometry(0.028 * r, 0.04 * r, 0.35 * r, 8),
        calyxMat
      );
      stalk.position.set(side * 0.035 * r, r * 1.02, 0.02);
      stalk.rotation.z = -side * 0.28;

      g.add(body, calyx, stalk);

      const p = curve.getPointAt(t);
      g.position.set(p.x + side * (0.075 * W * (1 - 0.6 * t) + r * 0.95), p.y - r * 0.9, 0.05);
      g.userData = { body, t, k };
      g.scale.setScalar(0.0001);
      plant.add(g);
      return g;
    });

    apply(cur, 0);
  }

  const unripe = new Color(0x60a854); // vibrant fresh crisp green
  const ripe = new Color(0xc92424);   // deep succulent garden tomato red

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
      lf.rotation.x = side * 0.45 * u + (ctx.reduced ? 0 : Math.cos(time * 0.9 + k) * 0.03 * u);
      lf.rotation.y = side * 0.3 * (1 - u);
    });

    fruits.forEach((fr) => {
      const { body, k } = fr.userData;
      const u = smooth((p - (0.72 + k * 0.05)) / 0.2);
      fr.scale.setScalar(Math.max(0.0001, u));
      const ripeness = smooth((p - 0.82) / 0.18);
      body.material.color.copy(unripe).lerp(ripe, ripeness);
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
      dropPlant();
      leafGeo.dispose();
      calyxGeo.dispose();
      stemMat.dispose();
      leafMats.forEach((m) => m.dispose());
      calyxMat.dispose();
    },
  };
}
