import { SLOTS, slotTotals, dayTotals, fmt } from './nutrition.js';

export function planAsText(plan, target, title = 'My NutriMatch plan') {
  const day = dayTotals(plan);
  const lines = [title, `Target ${fmt(target)} kcal | Planned ${fmt(day.kcal)} kcal | Protein ${fmt(day.protein)} g`, ''];
  for (const s of SLOTS) {
    const slot = plan[s.key];
    lines.push(`${s.label} (${slot.portion}x, ${fmt(slotTotals(slot).kcal)} kcal)`);
    slot.items.forEach((i) => lines.push(`  - ${i.food_name} (${i.serving})`));
  }
  return lines.join('\n');
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}
