import { useMemo } from 'react';
import GLCanvas from '../../gl/GLCanvas.jsx';
import { energyShares } from '../../gl/helpers.js';

const load = () => import('../../gl/scenes/dial.js');
const HEX = ['#25513B', '#C77A12', '#A8472F'];

/** Flat ring used while the 3D dial loads, or when WebGL isn't available. */
function FlatRing({ day, target }) {
  const fill = Math.min(1, target > 0 ? day.kcal / target : 0);
  const sh = energyShares(day);
  const ends = sh.map((_, i) => sh.slice(0, i + 1).reduce((t, x) => t + x, 0) * fill * 360);
  const stops = sh.map((_, i) => `${HEX[i]} ${i ? ends[i - 1] : 0}deg ${ends[i]}deg`);
  stops.push(`#E2DACB ${ends[ends.length - 1]}deg 360deg`);
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="aspect-square h-[88%] rounded-full" style={{ background: `conic-gradient(from 0deg, ${stops.join(', ')})` }}>
        <div className="m-[15%] h-[70%] w-[70%] rounded-full bg-card" />
      </div>
    </div>
  );
}

/** Planned calories as a ring split by macro; drag to tilt. The numbers live in the DOM (see Plan). */
export default function MacroDial({ day, target, className = '' }) {
  const data = useMemo(
    () => ({ kcal: day.kcal, target, protein: day.protein, carbs: day.carbs, fat: day.fat }),
    [day.kcal, day.protein, day.carbs, day.fat, target]
  );
  return <GLCanvas load={load} data={data} interactive className={className} fallback={<FlatRing day={day} target={target} />} />;
}
