// Logic tests for the 3D scenes. They build the real scene graphs in Node (no GPU needed).
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import * as plate from './scenes/plate.js';
import * as dial from './scenes/dial.js';
import * as sky from './scenes/skyline.js';
import * as plant from './scenes/plant.js';

const ctxOf = (data, extra = {}) => ({ getData: () => data, input: { x: 0, y: 0, dragX: 0, dragY: 0, down: false }, reduced: true, invalidate() {}, ...extra });
const finite = (scene) => scene.traverse((o) => {
  assert.ok([o.position, o.scale, o.rotation].every((v) => Number.isFinite(v.x + v.y + v.z)), `non-finite transform on ${o.type}`);
  const p = o.geometry?.attributes?.position;
  if (p) for (let i = 0; i < p.array.length; i += 97) assert.ok(Number.isFinite(p.array[i]), 'NaN vertex');
});
const approx = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

// ---- plate -----------------------------------------------------------------
{
  const s = plate.sharesFrom({ protein_g: 100, carbs_g: 250, fats_g: 60 });
  approx(s.protein + s.carbs + s.fat, 1);
  approx(s.protein, 400 / (400 + 1000 + 540));                       // energy share, not gram share
  assert.deepEqual(plate.sharesFrom(undefined), plate.DEFAULT_SHARES);
  assert.deepEqual(plate.sharesFrom({ protein_g: 0, carbs_g: 0, fats_g: 0 }), plate.DEFAULT_SHARES);

  let data = { macros: { protein_g: 100, carbs_g: 250, fats_g: 60 } };
  const sc = plate.create(ctxOf(data));
  sc.resize(720, 600); sc.update(0, 0.016); sc.update(5, 0.016);
  const wedgeGroups = () => {
    const root = sc.scene.children.find((c) => c.type === 'Group');
    return root.children.flatMap((g) => g.children).filter((g) => g.type === 'Group' && g.children.length === 3 && g.children.every((m) => m.geometry?.type === 'ExtrudeGeometry'));
  };
  assert.equal(wedgeGroups().length, 1, 'three wedges for three macros');
  const before = wedgeGroups()[0].children[0].geometry.uuid;
  data = { macros: { protein_g: 200, carbs_g: 100, fats_g: 40 } };
  const sc2 = plate.create(ctxOf(data)); sc2.update(0, 0.016);
  sc.update(6, 0.016);                                             // unchanged data: no rebuild
  assert.equal(wedgeGroups()[0].children[0].geometry.uuid, before);
  finite(sc.scene); finite(sc2.scene);
  sc.resize(360, 420); assert.equal(sc.camera.fov, 42, 'portrait uses a wider lens'); sc.resize(720, 600); assert.equal(sc.camera.fov, 32);
  sc.dispose(); sc2.dispose();
}

// ---- dial ------------------------------------------------------------------
{
  const sh = dial.energyShares({ protein: 100, carbs: 250, fat: 60 });
  approx(sh[0] + sh[1] + sh[2], 1);
  approx(dial.energyShares({}).reduce((a, b) => a + b), 1);
  const visible = (sc) => sc.scene.children.find((c) => c.type === 'Group').children.filter((m) => m.geometry?.type === 'TorusGeometry' && m.visible).length;

  const part = dial.create(ctxOf({ kcal: 650, target: 1300, protein: 40, carbs: 110, fat: 28 }));
  part.resize(400, 400); part.update(1, 0.016);
  assert.equal(visible(part), 1 + 3, 'track + 3 macro segments, no overflow ring');
  const over = dial.create(ctxOf({ kcal: 1700, target: 1300, protein: 70, carbs: 190, fat: 45 }));
  over.resize(400, 400); over.update(1, 0.016);
  assert.equal(visible(over), 1 + 3 + 1, 'overflow ring appears above 100%');
  const empty = dial.create(ctxOf({ kcal: 0, target: 1300, protein: 0, carbs: 0, fat: 0 }));
  empty.resize(400, 400); empty.update(1, 0.016);
  assert.equal(visible(empty), 1, 'only the track when nothing is planned');
  const broken = dial.create(ctxOf({ kcal: 100, target: 0 })); broken.update(1, 0.016);   // target 0 must not produce NaN
  [part, over, empty, broken].forEach((s) => { finite(s.scene); s.dispose(); });
}

// ---- skyline ---------------------------------------------------------------
{
  assert.equal(sky.toneFor(1.0), 0x25513b); assert.equal(sky.toneFor(1.11), 0xa8472f); assert.equal(sky.toneFor(0.89), 0xc77a12);
  assert.equal(sky.toneFor(1.1), 0x25513b); assert.equal(sky.toneFor(0.9), 0x25513b);
  approx(sky.labelX(3), 0.5); approx(sky.labelX(0) + sky.labelX(6), 1);
  approx(sky.labelX(1) - sky.labelX(0), sky.STEP / sky.VISIBLE_W);

  let picked = -1;
  const data = { kcal: [1300, 1000, 1500, 1300, 1100, 1300, 1600], target: 1300, active: 2, onSelect: (i) => { picked = i; } };
  const sc = sky.create(ctxOf(data));
  sc.resize(880, 400); sc.update(2, 0.016);
  const bars = sc.scene.children.find((c) => c.children.length >= 7).children.filter((m) => m.geometry?.type === 'BoxGeometry' && m.userData.i !== undefined);
  assert.equal(bars.length, 7);
  const h = (i) => bars[i].scale.y;
  approx(h(0), h(3)); assert.ok(h(2) > h(0) && h(1) < h(0) && h(6) > h(2), 'height tracks calories');
  approx(h(2) / h(0), 1500 / 1300, 1e-3);
  assert.ok(bars[2].scale.x > bars[0].scale.x, 'selected bar is emphasised');

  // clicking the on-screen position of each bar selects that day
  sc.scene.updateMatrixWorld(true); sc.camera.updateMatrixWorld(true);
  for (let i = 0; i < 7; i++) {
    const p = new Vector3(bars[i].position.x, bars[i].position.y, 0).project(sc.camera);
    sc.click({ x: p.x, y: p.y });
    assert.equal(picked, i, `click on bar ${i}`);
    // and the bar's base lines up exactly with its DOM tab
    const floor = new Vector3(bars[i].position.x, 0, 0).project(sc.camera);
    approx((floor.x + 1) / 2, sky.labelX(i), 1e-6);
  }
  picked = -1; sc.click({ x: -0.99, y: 0.95 }); assert.equal(picked, -1, 'clicking empty space selects nothing');
  finite(sc.scene); sc.dispose();
}

// ---- plant -----------------------------------------------------------------
{
  const run = (progress, w = 104, h = 700) => {
    const sc = plant.create(ctxOf({ progress }));
    sc.resize(w, h); sc.update(1, 0.016);
    const [stem, , tip] = sc.scene.children.find((c) => c.type === 'Group').children;
    const groups = sc.scene.children.find((c) => c.type === 'Group').children.filter((c) => c.type === 'Group');
    return { sc, stem, tip, drawn: stem.geometry.drawRange.count, total: stem.geometry.index.count, leaves: groups.slice(0, 9), fruits: groups.slice(9) };
  };
  const a = run(0), b = run(0.5), c = run(1);
  assert.ok(a.drawn < b.drawn && b.drawn < c.drawn, 'stem lengthens with scroll progress');
  assert.ok(a.drawn / a.total < 0.2, 'only a sprout at the top of the page');
  assert.ok(c.drawn >= c.total * 0.98, 'fully grown at the bottom');
  assert.ok(a.tip.visible && !c.tip.visible, 'growing tip disappears when done');
  const open = (r) => r.leaves.filter((l) => l.scale.x > 0.05).length;
  assert.ok(open(a) < open(b) && open(b) < open(c) && open(c) === 9, `leaves unfurl as the stem passes (${open(a)}/${open(b)}/${open(c)})`);
  const fruit = (r) => r.fruits.filter((f) => f.scale.x > 0.5).length;
  assert.equal(fruit(a), 0); assert.equal(fruit(b), 0); assert.equal(fruit(c), 3, 'tomatoes only appear near the end');
  const red = (r) => r.fruits[0].userData.body.material.color.r;
  assert.ok(red(c) > red(run(0.85)), 'tomatoes ripen towards red');
  // leaves must stay inside the narrow gutter at every aspect ratio
  for (const w of [44, 80, 112]) {
    const r = run(1, w, 700); const half = (10 * (w / 700)) / 2;
    r.leaves.forEach((l) => { assert.ok(Math.abs(l.position.x) + l.userData.len * 0.9 <= half * 1.02, `leaf overflows gutter at w=${w}`); });
    finite(r.sc.scene);
  }
  [a, b, c].forEach((r) => { finite(r.sc.scene); r.sc.dispose(); });
}
console.log('3D scene tests OK');
