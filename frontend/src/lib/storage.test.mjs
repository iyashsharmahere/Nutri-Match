import assert from 'node:assert/strict';
import { restore, persist, STORAGE_KEY, validPlan } from './storage.js';

const mem = (initial) => { let v = initial; return { getItem: () => v, setItem: (_k, x) => { v = x; } }; };
const item = (n) => ({ food_name: n, calories: 100 });
const slot = (p = 1) => ({ portion: p, items: [item('a'), item('b')] });
const plan = { breakfast: slot(), lunch: slot(0.5), snacks: slot(), dinner: slot(2) };
const result = { target_macros: { daily_calories: 2000, protein_g: 100, carbs_g: 250, fats_g: 55, sugar_g: 25 } };
const week = { days: Array.from({ length: 7 }, (_, i) => ({ label: `D${i}`, plan })) };

// empty / garbage / wrong types never throw
for (const raw of [null, '', 'not json', '[]', '"str"', '42', '{"plan": 3}']) assert.deepEqual(restore(mem(raw)), {}, String(raw));

// a good save round-trips
const good = { formData: { age: 30 }, inputs: { goal: 'x' }, avoid: ['Aloo Raita'], result, plan, week };
const s = mem(null); assert.ok(persist(good, s));
const back = restore(s);
assert.deepEqual(back.plan, plan); assert.deepEqual(back.avoid, ['Aloo Raita']); assert.equal(back.week.days.length, 7);

// plan without the inputs it was built from is dropped (would show wrong labels)
assert.equal(restore(mem(JSON.stringify({ ...good, inputs: undefined }))).plan, undefined);
// tampered pieces are dropped individually
assert.equal(restore(mem(JSON.stringify({ ...good, plan: { ...plan, lunch: { portion: 7, items: [item('a')] } } }))).plan, undefined);
assert.equal(restore(mem(JSON.stringify({ ...good, plan: { ...plan, dinner: { portion: 1, items: [] } } }))).plan, undefined);
assert.equal(restore(mem(JSON.stringify({ ...good, result: { target_macros: { daily_calories: 'lots' } } }))).result, undefined);
assert.equal(restore(mem(JSON.stringify({ ...good, week: { days: [] } }))).week, undefined);
assert.deepEqual(restore(mem(JSON.stringify({ ...good, avoid: ['ok', 5, null] }))).avoid, ['ok']);
// storage that throws (private mode / quota) is tolerated
assert.equal(persist(good, { setItem() { throw new Error('quota'); } }), false);
assert.deepEqual(restore({ getItem() { throw new Error('denied'); } }), {});
assert.ok(validPlan(plan) && STORAGE_KEY.endsWith('v3'));
console.log('storage tests OK');
