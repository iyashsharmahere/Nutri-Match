import { BufferGeometry, Float32BufferAttribute, TubeGeometry, MathUtils } from 'three';

/** Botanical leaf pointing along +x, base at the origin, length 1, realistic 3D curl and midrib. */
export function leafGeometry() {
  const segU = 16, segV = 8;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const wBase = Math.sin(Math.PI * Math.pow(u, 0.72));
    const lobe = 1 + 0.05 * Math.sin(u * 14) * Math.sin(Math.PI * u);
    const halfWidth = 0.30 * wBase * lobe;
    const arch = -0.12 * Math.sin(Math.PI * Math.pow(u, 1.1));

    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const x = u;
      const y = v * halfWidth;
      const midrib = 0.02 * (1 - Math.abs(v)) * Math.sin(Math.PI * u);
      const cup = 0.12 * (v * v) * Math.sin(Math.PI * Math.pow(u, 0.6));
      const edgeWave = 0.012 * Math.sin(u * 12 + v * 3) * Math.abs(v);
      const z = cup + arch - midrib + edgeWave;

      positions.push(x, y, z);
      uvs.push(u, (v + 1) / 2);
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + (j + 1);
      const d = i * (segV + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** 5-pointed star calyx that curves down over the tomato crown. */
export function calyxGeometry(r = 1) {
  const positions = [];
  const indices = [];
  const numSepals = 5;

  positions.push(0, 0, 0.04 * r);

  for (let i = 0; i < numSepals; i++) {
    const a = (i / numSepals) * Math.PI * 2;
    const aMid = a + Math.PI / numSepals;

    const notchR = 0.22 * r;
    const nx = Math.cos(a) * notchR;
    const ny = Math.sin(a) * notchR;
    const nz = 0.01 * r;

    const midR = 0.52 * r;
    const mx = Math.cos(aMid) * midR;
    const my = Math.sin(aMid) * midR;
    const mz = -0.07 * r;

    const tipR = 0.85 * r;
    const tx = Math.cos(aMid) * tipR;
    const ty = Math.sin(aMid) * tipR;
    const tz = -0.22 * r;

    const baseIdx = positions.length / 3;
    positions.push(nx, ny, nz);
    positions.push(mx, my, mz);
    positions.push(tx, ty, tz);

    indices.push(0, baseIdx, baseIdx + 1);
    indices.push(baseIdx + 1, baseIdx + 2, 0);
  }

  const g = new BufferGeometry();
  g.setIndex(indices);
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
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
