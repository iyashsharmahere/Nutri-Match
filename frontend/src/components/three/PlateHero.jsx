import { useMemo } from 'react';
import GLCanvas from '../../gl/GLCanvas.jsx';
import { sharesFrom } from '../../gl/helpers.js';
import { MACRO } from '../ui';

const load = () => import('../../gl/scenes/plate.js');
const pct = (x) => `${Math.round(x * 100)}%`;

/** 3D plate whose sections are the user's protein / carbs / fat split, with produce drifting around it. */
export default function PlateHero({ macros, fallback }) {
  const shares = sharesFrom(macros);
  const data = useMemo(() => ({ macros }), [macros]);
  return (
    <figure className="m-0">
      <GLCanvas load={load} data={data} interactive className="h-[300px] w-full md:h-[380px]" fallback={fallback} />
      <figcaption className="mt-2 text-center text-sm text-soft">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {['protein', 'carbs', 'fat'].map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${MACRO[k].bg}`} aria-hidden />
              <span className="font-semibold text-ink">{MACRO[k].label}</span> {pct(shares[k])}
            </li>
          ))}
        </ul>
        <p className="mt-1">{macros ? 'Your daily split by energy. Drag to turn the plate.' : 'An example split. Build your plan to see yours.'}</p>
      </figcaption>
    </figure>
  );
}
