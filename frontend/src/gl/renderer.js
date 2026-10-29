import { WebGLRenderer, SRGBColorSpace } from 'three';

export function createRenderer(canvas, options = {}) {
  const r = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power', ...options });
  r.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = SRGBColorSpace;
  return r;
}
