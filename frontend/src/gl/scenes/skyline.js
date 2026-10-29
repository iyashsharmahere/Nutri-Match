import {
  Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, BoxGeometry, PlaneGeometry, MeshBasicMaterial,
  AmbientLight, DirectionalLight, HemisphereLight, Raycaster, Vector2, Color, MathUtils,
} from 'three';
import { C } from '../palette.js';
import { clamp, smooth } from '../shapes.js';
import { DAYS, STEP, VISIBLE_W, toneFor, labelX } from '../helpers.js';

const UNIT = 2.1;                   // bar height that equals 100% of target
const FOV = 28;

export { DAYS, STEP, VISIBLE_W, toneFor, labelX };

export function create(ctx) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 2, 0.1, 80);

  scene.add(new HemisphereLight(0xfffaf0, 0xcfc6b2, 1.1));
  scene.add(new AmbientLight(0xffffff, 0.3));
  const sun = new DirectionalLight(0xffffff, 2.0); sun.position.set(-4, 8, 6); scene.add(sun);

  const root = new Group();
  scene.add(root);

  const wall = new Mesh(new PlaneGeometry(VISIBLE_W + 1, 5), new MeshBasicMaterial({ color: C.card }));
  wall.position.set(0, 2.2, -0.9); root.add(wall);
  const floor = new Mesh(new BoxGeometry(DAYS * STEP + 0.5, 0.14, 1.9), new MeshStandardMaterial({ color: C.line, roughness: 0.8 }));
  floor.position.set(0, -0.07, 0); root.add(floor);

  // target line across the wall and floor edge
  const line = new Mesh(new BoxGeometry(DAYS * STEP + 0.5, 0.035, 0.02), new MeshBasicMaterial({ color: C.ink }));
  line.position.set(0, UNIT, -0.88); root.add(line);

  const bars = Array.from({ length: DAYS }, (_, i) => {
    const m = new Mesh(new BoxGeometry(0.86, 1, 0.86), new MeshStandardMaterial({ color: C.moss, roughness: 0.5 }));
    m.position.x = (i - (DAYS - 1) / 2) * STEP;
    m.userData = { i, h: 0.001, sel: 0, hov: 0 };
    root.add(m);
    return m;
  });

  const ray = new Raycaster();
  let hovered = -1, born = 0, started = false, size = { w: 2, h: 1 };

  // Camera placed so the floor line (y = 0) is exactly VISIBLE_W wide on screen;
  // the DOM day tabs under the canvas are laid out against that width.
  const PITCH = 0.2, TARGET_Y = 1.45;
  const frameCamera = () => {
    const aspect = size.w / size.h;
    const depthAtFloor = VISIBLE_W / 2 / (Math.tan(MathUtils.degToRad(FOV / 2)) * aspect);
    const D = depthAtFloor - TARGET_Y * Math.sin(PITCH);
    camera.aspect = aspect;
    camera.position.set(0, TARGET_Y + D * Math.sin(PITCH), D * Math.cos(PITCH));
    camera.lookAt(0, TARGET_Y, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };

  const pick = (p) => {
    ray.setFromCamera(new Vector2(p.x, p.y), camera);
    const hit = ray.intersectObjects(bars, false)[0];
    return hit ? hit.object.userData.i : -1;
  };

  return {
    scene, camera,
    resize(w, h) { size = { w, h }; frameCamera(); },
    hover(p) { hovered = p ? pick(p) : -1; },
    click(p) { const i = pick(p); if (i >= 0) ctx.getData()?.onSelect?.(i); },
    update(t, dt) {
      const d = ctx.getData() || {};
      if (!started) { born = t; started = true; }
      const k = 1 - Math.exp(-dt * 6);
      bars.forEach((m, i) => {
        const ratio = d.target > 0 ? (d.kcal?.[i] ?? 0) / d.target : 0;
        const h = Math.max(0.02, clamp(ratio, 0, 1.6) * UNIT);
        const intro = ctx.reduced ? 1 : smooth((t - born - i * 0.07) / 0.7);
        const u = m.userData;
        u.h = ctx.reduced ? h : u.h + (h - u.h) * k;
        const sel = d.active === i ? 1 : 0, hov = hovered === i ? 1 : 0;
        u.sel += (sel - u.sel) * (ctx.reduced ? 1 : k);
        u.hov += (hov - u.hov) * (ctx.reduced ? 1 : k);
        const hh = Math.max(0.001, u.h * intro);
        m.scale.set(1 + 0.1 * u.sel, hh, 1 + 0.1 * u.sel);
        m.position.y = hh / 2;
        const base = new Color(toneFor(ratio));
        m.material.color.copy(base);
        m.material.emissive.copy(base).multiplyScalar(0.28 * Math.max(u.sel, u.hov * 0.6));
        m.material.opacity = 1;
      });
    },
    dispose() {
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    },
  };
}
