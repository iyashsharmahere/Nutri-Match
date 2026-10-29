import {
  Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, TorusGeometry, SphereGeometry,
  AmbientLight, DirectionalLight, HemisphereLight, MathUtils,
} from 'three';
import { C } from '../palette.js';
import { clamp } from '../shapes.js';
import { energyShares } from '../helpers.js';

const R = 1.62, TUBE = 0.3, GAP = 0.035;

export { energyShares };

export function create(ctx) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 8.4);

  scene.add(new HemisphereLight(0xfffaf0, 0xcfc6b2, 1.1));
  scene.add(new AmbientLight(0xffffff, 0.3));
  const sun = new DirectionalLight(0xffffff, 2.0); sun.position.set(-3, 4, 6); scene.add(sun);

  const dial = new Group();
  scene.add(dial);

  const track = new Mesh(new TorusGeometry(R, TUBE * 0.72, 12, 96), new MeshStandardMaterial({ color: C.line, roughness: 0.8 }));
  dial.add(track);

  const colors = [C.moss, C.saffron, C.clay];
  const segs = colors.map((c) => { const m = new Mesh(undefined, new MeshStandardMaterial({ color: c, roughness: 0.45 })); dial.add(m); return m; });
  const capA = new Mesh(new SphereGeometry(TUBE, 20, 14), new MeshStandardMaterial({ color: colors[0], roughness: 0.45 }));
  const capB = new Mesh(new SphereGeometry(TUBE, 20, 14), new MeshStandardMaterial({ color: colors[2], roughness: 0.45 }));
  dial.add(capA, capB);

  const over = new Mesh(undefined, new MeshStandardMaterial({ color: C.clay, roughness: 0.5 }));
  dial.add(over);

  let fill = 0, overFill = 0, lastKey = "";

  // Clockwise from 12 o'clock: phi (clockwise) maps to torus theta = PI/2 - phi.
  const place = (mesh, phi0, phi1, radius, tube) => {
    mesh.geometry?.dispose();
    const arc = Math.max(0.0001, phi1 - phi0);
    mesh.geometry = new TorusGeometry(radius, tube, 14, Math.max(4, Math.ceil(arc * 18)), arc);
    mesh.rotation.z = Math.PI / 2 - phi1;
    mesh.visible = arc > 0.012;
  };
  const point = (phi, radius = R) => [Math.cos(Math.PI / 2 - phi) * radius, Math.sin(Math.PI / 2 - phi) * radius];

  function rebuild(shares) {
    const total = fill * Math.PI * 2;
    let a = 0;
    shares.forEach((s, i) => {
      const span = s * total;
      const g = span > 0.2 ? GAP : 0;
      place(segs[i], a + g, a + span - g, R, TUBE);
      a += span;
    });
    const showCaps = fill > 0.004;
    capA.visible = capB.visible = showCaps;
    if (showCaps) {
      const [x0, y0] = point(0); capA.position.set(x0, y0, 0);
      const [x1, y1] = point(total); capB.position.set(x1, y1, 0);
    }
    place(over, 0, overFill * Math.PI * 2, R + TUBE * 1.55, TUBE * 0.36);
  }

  return {
    scene, camera,
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    update(t, dt) {
      const d = ctx.getData() || {};
      const ratio = d.target > 0 ? d.kcal / d.target : 0;
      const tFill = clamp(ratio, 0, 1), tOver = clamp(ratio - 1, 0, 1);
      const k = 1 - Math.exp(-dt * 4);
      fill = ctx.reduced ? tFill : fill + (tFill - fill) * k;
      overFill = ctx.reduced ? tOver : overFill + (tOver - overFill) * k;
      const key = `${fill.toFixed(3)}|${overFill.toFixed(3)}|${energyShares(d).map((x) => x.toFixed(3))}`;
      if (key !== lastKey) { lastKey = key; rebuild(energyShares(d)); }

      const sway = ctx.reduced ? 0 : Math.sin(t * 0.6) * 0.1;
      dial.rotation.y = MathUtils.clamp(ctx.input.dragX, -0.8, 0.8) + sway;
      dial.rotation.x = -0.5 + MathUtils.clamp(ctx.input.dragY, -0.5, 0.5);
    },
    dispose() {
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    },
  };
}
