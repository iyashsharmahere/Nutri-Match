import { SLOTS } from './nutrition.js';

const CATEGORIES = [
  ['Vegetables & fruit', /onion|tomato|potato|carrot|peas|beans|capsicum|cucumber|lettuce|spinach|cabbage|cauliflower|gobi|brinjal|okra|bhindi|pumpkin|gourd|zucchini|mushroom|corn|beetroot|radish|lemon|lime|mango|banana|apple|papaya|orange|coconut|broccoli|leaves|ginger|garlic|chilli|chillies|parsley|mint|salad|sprout|fruit|methi|palak|spring/i],
  ['Grains, flours & bread', /rice|atta|flour|wheat|oats|barley|ragi|bajra|jowar|maida|semolina|suji|rava|poha|bread|millet|quinoa|daliya|dalia|vermicelli|noodle|pasta|besan|cornflour|roti/i],
  ['Pulses & legumes', /dal\b|dhal|lentil|chana|rajma|moong|masoor|urad|toor|arhar|chickpea|soya|soy|tofu|lobia|peanut|gram/i],
  ['Dairy & eggs', /milk|yoghurt|yogurt|curd|paneer|cheese|cream|egg|khoa|buttermilk|dahi/i],
  ['Meat & fish', /chicken|mutton|lamb|fish|prawn|shrimp|meat|keema|beef|pork|tuna|salmon/i],
  ['Oils, ghee & fats', /\boil\b|ghee|butter|margarine|vanaspati/i],
  ['Spices & seasoning', /salt|powder|masala|seeds|pepper|turmeric|cumin|jeera|coriander seed|mustard|cardamom|clove|cinnamon|asafoetida|hing|chaat|saffron|bay leaf|tamarind|vinegar|sauce|essence/i],
  ['Nuts, seeds & sweeteners', /almond|cashew|walnut|pista|raisin|dates|sugar|jaggery|honey|flax|sesame|chia|pumpkin seed|sunflower/i],
];

export const categoryOf = (name) => {
  // Order matters: spices/oils are tested before vegetables claim "garlic powder", "mustard oil".
  const priority = [5, 6, 3, 4, 2, 1, 7, 0];
  for (const i of priority) if (CATEGORIES[i][1].test(name)) return CATEGORIES[i][0];
  return 'Other';
};

const UNIT = { gms: 'g', gm: 'g', g: 'g', ml: 'ml', number: 'pc', medium: 'pc', small: 'pc', large: 'pc', slice: 'pc' };

const title = (s) => s.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** "RICE-125 gms; Onion; Sugar, Milk" -> [{name, qty|null, unit}] */
export function parseIngredients(text) {
  if (!text || text === 'N/A') return [];
  const out = [];
  for (const raw of String(text).split(';')) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(.*?)\s*-\s*(\d+(?:\.\d+)?)\s*([A-Za-z]*)/);
    if (m) {
      const unit = UNIT[m[3].toLowerCase()] ?? (m[3] ? null : 'g');
      if (unit) { out.push({ name: m[1].trim().toLowerCase(), qty: Number(m[2]), unit }); continue; }
    }
    // Plain comma list, no quantities
    for (const n of part.split(',')) {
      const name = n.trim().toLowerCase().replace(/-\d.*$/, '');
      if (name) out.push({ name, qty: null, unit: null });
    }
  }
  return out;
}

/** plans: [{slotKey: {items, portion}}] -> grouped shopping list */
export function buildGroceryList(plans) {
  const sized = new Map(); // "name|unit" -> {name, unit, qty, uses}
  const loose = new Map(); // name -> uses
  const dishes = new Set();

  for (const plan of plans) {
    for (const s of SLOTS) {
      const slot = plan?.[s.key];
      if (!slot) continue;
      for (const it of slot.items) {
        dishes.add(it.food_name);
        for (const ing of parseIngredients(it.ingredients)) {
          if (ing.qty == null) { loose.set(ing.name, (loose.get(ing.name) || 0) + 1); continue; }
          const k = `${ing.name}|${ing.unit}`;
          const row = sized.get(k) || { name: ing.name, unit: ing.unit, qty: 0, uses: 0 };
          row.qty += ing.qty * slot.portion;
          row.uses += 1;
          sized.set(k, row);
        }
      }
    }
  }

  // Names that have a measured quantity somewhere don't need a loose entry.
  const measured = new Set([...sized.values()].map((r) => r.name));
  const groups = new Map();
  const add = (row) => {
    const cat = categoryOf(row.name);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(row);
  };
  sized.forEach((r) => add({ ...r, id: `${r.name}|${r.unit}`, label: title(r.name) }));
  loose.forEach((uses, name) => !measured.has(name) && add({ name, unit: null, qty: null, uses, id: `${name}|-`, label: title(name) }));

  const order = [...CATEGORIES.map((c) => c[0]), 'Other'];
  return {
    dishCount: dishes.size,
    groups: order
      .filter((c) => groups.has(c))
      .map((c) => ({ category: c, items: groups.get(c).sort((a, b) => a.label.localeCompare(b.label)) })),
  };
}

export function formatQty(row) {
  if (row.qty == null) return 'as needed';
  if (row.unit === 'pc') return `${Math.ceil(row.qty - 1e-9)} pc`;
  const base = row.unit === 'ml' ? ['ml', 'L'] : ['g', 'kg'];
  const q = row.qty;
  if (q >= 1000) return `${(q / 1000).toFixed(2).replace(/\.?0+$/, '')} ${base[1]}`;
  return `${q >= 20 ? Math.round(q / 5) * 5 : Math.round(q * 10) / 10} ${base[0]}`;
}
