let cached;

/** True only when a real WebGL context can be created on a capable device. */
export function webglSupported() {
  if (cached !== undefined) return cached;
  cached = false;
  try {
    if (typeof document === 'undefined' || /jsdom/i.test(navigator.userAgent)) return cached;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return cached; // very low-end phones
    const c = document.createElement('canvas');
    cached = Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { cached = false; }
  return cached;
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
