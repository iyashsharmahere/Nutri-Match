// Pure helpers shared by the 3D scenes and the normal React components.
// Must NOT import three: React components import this, and three is loaded lazily.

export const DEFAULT_SHARES = { protein: 0.28, carbs: 0.47, fat: 0.25 };

/** Energy share of each macro (4/4/9 kcal per gram) from gram targets. */
export function sharesFrom(m) {
  if (!m) return DEFAULT_SHARES;
  const p = m.protein_g * 4, c = m.carbs_g * 4, f = m.fats_g * 9, t = p + c + f;
  return t > 0 ? { protein: p / t, carbs: c / t, fat: f / t } : DEFAULT_SHARES;
}

/** [protein, carbs, fat] energy shares from planned grams. */
export function energyShares(d) {
  const p = (d?.protein || 0) * 4, c = (d?.carbs || 0) * 4, f = (d?.fat || 0) * 9, t = p + c + f;
  return t > 0 ? [p / t, c / t, f / t] : [0.3, 0.45, 0.25];
}

// ---- week skyline layout (the DOM day tabs are laid out against these) ----
export const DAYS = 7;
export const STEP = 1.32;        // spacing between bars, world units
export const VISIBLE_W = 10.4;   // world width visible along the floor line

/** Bar colour by distance from target: on target, over, or under. */
export function toneFor(ratio) {
  if (ratio > 1.1) return 0xa8472f;   // clay
  if (ratio < 0.9) return 0xc77a12;   // saffron
  return 0x25513b;                    // moss
}

/** Horizontal position (0..1 of canvas width) of bar i. */
export const labelX = (i) => 0.5 + ((i - (DAYS - 1) / 2) * STEP) / VISIBLE_W;

/** Width of the 7-column tab row as a % of the canvas, so tabs sit under their bars. */
export const TABS_WIDTH_PCT = ((DAYS * STEP) / VISIBLE_W) * 100;
