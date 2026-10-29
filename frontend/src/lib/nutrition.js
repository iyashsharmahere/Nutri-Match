export const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', share: 0.25, time: 'Morning' },
  { key: 'lunch', label: 'Lunch', share: 0.35, time: 'Midday' },
  { key: 'snacks', label: 'Snacks', share: 0.15, time: 'Afternoon' },
  { key: 'dinner', label: 'Dinner', share: 0.25, time: 'Evening' },
];

export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const ACTIVITY = [
  { value: 'Sedentary', hint: 'Desk job, little exercise', mult: 1.2 },
  { value: 'Lightly Active', hint: 'Exercise 1–3 days a week', mult: 1.375 },
  { value: 'Moderately Active', hint: 'Exercise 3–5 days a week', mult: 1.55 },
  { value: 'Very Active', hint: 'Hard training 6–7 days a week', mult: 1.725 },
];

export const GOALS = [
  { value: 'Weight Loss', hint: '500 kcal below maintenance', delta: -500 },
  { value: 'Maintain Weight', hint: 'Eat at maintenance', delta: 0 },
  { value: 'Muscle Gain', hint: '300 kcal above maintenance', delta: 300 },
];

export const DIETS = ['Veg', 'Eggetarian', 'Non-Veg'];
export const ALLERGENS = ['Dairy', 'Gluten', 'Nuts', 'Peanut', 'Soy', 'Egg', 'Fish', 'Mushroom'];

/** Mirrors backend Mifflin-St Jeor so the form can preview before submitting. */
export function estimate({ age, gender, weight_kg, height_cm, activity_level, goal }) {
  const a = Number(age), w = Number(weight_kg), h = Number(height_cm);
  if (![a, w, h].every(Number.isFinite)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (gender === 'Male' ? 5 : -161);
  const mult = ACTIVITY.find((x) => x.value === activity_level)?.mult ?? 1.375;
  const delta = GOALS.find((x) => x.value === goal)?.delta ?? 0;
  const tdee = bmr * mult;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.max(1200, Math.round(tdee + delta)) };
}

export function validate(f) {
  const e = {};
  const age = Number(f.age), w = Number(f.weight_kg), h = Number(f.height_cm);
  if (!(age >= 10 && age <= 100)) e.age = 'Enter an age between 10 and 100.';
  if (!(w > 20 && w < 300)) e.weight_kg = 'Enter a weight between 20 and 300 kg.';
  if (!(h > 80 && h < 250)) e.height_cm = 'Enter a height between 80 and 250 cm.';
  const opt = (v) => v === '' || v == null;
  if (!opt(f.custom_calories) && !(Number(f.custom_calories) >= 1200 && Number(f.custom_calories) <= 6000)) e.custom_calories = 'Use 1,200 to 6,000 kcal, or leave blank.';
  if (!opt(f.custom_protein_g) && !(Number(f.custom_protein_g) > 0 && Number(f.custom_protein_g) <= 400)) e.custom_protein_g = 'Use 1 to 400 g, or leave blank.';
  if (!opt(f.custom_sugar_g) && !(Number(f.custom_sugar_g) >= 0 && Number(f.custom_sugar_g) <= 200)) e.custom_sugar_g = 'Use 0 to 200 g, or leave blank.';
  return e;
}

const sum = (items, k) => items.reduce((t, i) => t + (i[k] || 0), 0);

export function slotTotals(slot) {
  const p = slot?.portion ?? 1;
  const items = slot?.items ?? [];
  return {
    kcal: sum(items, 'calories') * p,
    protein: sum(items, 'protein_g') * p,
    carbs: sum(items, 'carbs_g') * p,
    fat: sum(items, 'fats_g') * p,
    sugar: sum(items, 'sugar_g') * p,
    fibre: sum(items, 'fibres_g') * p,
    sodium: sum(items, 'sodium_mg') * p,
    calcium: sum(items, 'calcium_mg') * p,
    iron: sum(items, 'iron_mg') * p,
    vitc: sum(items, 'vitamin_c_mg') * p,
  };
}

export function dayTotals(plan) {
  const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, sodium: 0, calcium: 0, iron: 0, vitc: 0 };
  return SLOTS.reduce((acc, s) => {
    const t = slotTotals(plan?.[s.key]);
    Object.keys(acc).forEach((k) => (acc[k] += t[k]));
    return acc;
  }, zero);
}

export const fmt = (n, d = 0) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtPortion = (p) => `${p}×`;
