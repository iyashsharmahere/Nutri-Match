import { SLOTS, PORTIONS } from './nutrition.js';

// Bump when the saved shape changes; older saves are then ignored, not mis-read.
export const STORAGE_KEY = 'nutrimatch:v3';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

export function validPlan(p) {
  return isObj(p) && SLOTS.every((s) => {
    const slot = p[s.key];
    return isObj(slot) && PORTIONS.includes(slot.portion) && Array.isArray(slot.items) && slot.items.length > 0 &&
      slot.items.every((i) => isObj(i) && typeof i.food_name === 'string' && Number.isFinite(i.calories));
  });
}

export const validResult = (r) =>
  isObj(r) && isObj(r.target_macros) && ['daily_calories', 'protein_g', 'carbs_g', 'fats_g', 'sugar_g'].every((k) => Number.isFinite(r.target_macros[k]));

export const validWeek = (w) => isObj(w) && Array.isArray(w.days) && w.days.length === 7 && w.days.every((d) => typeof d.label === 'string' && validPlan(d.plan));

/** Reads saved state and returns only the parts that pass validation. */
export function restore(storage = globalThis.localStorage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(STORAGE_KEY)); } catch { return {}; }
  if (!isObj(raw)) return {};
  const out = {};
  if (isObj(raw.formData)) out.formData = raw.formData;
  if (Array.isArray(raw.avoid)) out.avoid = raw.avoid.filter((x) => typeof x === 'string').slice(0, 200);
  // A plan is only usable together with the inputs it was built from.
  if (validResult(raw.result) && validPlan(raw.plan) && isObj(raw.inputs)) {
    out.result = raw.result; out.plan = raw.plan; out.inputs = raw.inputs;
    if (validWeek(raw.week)) out.week = raw.week;
  }
  return out;
}

export function persist(state, storage = globalThis.localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
