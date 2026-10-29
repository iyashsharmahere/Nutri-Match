import { ShapeGeometry, Shape, TubeGeometry, MathUtils } from 'three';

/** Leaf pointing along +x, base at the origin, length 1, gently curled. */
export function leafGeometry() {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.16, 0.42, 0.62, 0.42, 1, 0);
  s.bezierCurveTo(0.62, -0.42, 0.16, -0.42, 0, 0);
  const g = new ShapeGeometry(s, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, 0.22 * x * x + 0.12 * Math.abs(y)); // curl along the length and fold at the midrib
  }
  g.computeVertexNormals();
  return g;
}

/** Tube whose radius tapers from r0 (start) to r1 (end). Index layout matches TubeGeometry. */
export function taperedTube(curve, tubular, radial, r0, r1) {
  const g = new TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.attributes.position;
  for (let i = 0; i <= tubular; i++) {
    const c = curve.getPointAt(i / tubular);
    const r = MathUtils.lerp(r0, r1, i / tubular);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

export const smooth = (x) => { const t = MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
export const clamp = MathUtils.clamp;
