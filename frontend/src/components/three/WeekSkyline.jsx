import { useMemo } from 'react';
import GLCanvas from '../../gl/GLCanvas.jsx';
import { toneFor } from '../../gl/helpers.js';

const load = () => import('../../gl/scenes/skyline.js');
const CSS = { 0x25513b: 'bg-moss', 0xc77a12: 'bg-saffron', 0xa8472f: 'bg-clay' };

function FlatBars({ kcal, target }) {
  return (
    <div className="flex h-full items-end justify-around gap-2 px-3 pb-2" aria-hidden>
      {kcal.map((k, i) => (
        <div key={i} className={`w-full rounded-t ${CSS[toneFor(k / target)]}`} style={{ height: `${Math.min(100, (k / target) * 62)}%` }} />
      ))}
    </div>
  );
}

/** 3D bars for each day's calories against the target line. Click a bar to select that day. */
export default function WeekSkyline({ kcal, target, active, onSelect }) {
  const data = useMemo(() => ({ kcal, target, active, onSelect }), [kcal, target, active, onSelect]);
  return (
    <div className="panel overflow-hidden" style={{ aspectRatio: '2.2 / 1' }}>
      <GLCanvas
        load={load}
        data={data}
        interactive
        label={`Calories for each day of the week against your ${Math.round(target)} calorie target. Use the day tabs below to choose a day.`}
        className="h-full w-full"
        fallback={<FlatBars kcal={kcal} target={target} />}
      />
    </div>
  );
}
