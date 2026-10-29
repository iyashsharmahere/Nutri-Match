import { Printer } from 'lucide-react';
import { SLOTS, slotTotals, dayTotals, fmt } from '../lib/nutrition';
import { Bar, MACRO } from './ui';

// Approximate adult reference intakes (WHO / ICMR-NIN ballpark). Not medical targets.
const refs = (gender) => [
  { key: 'fibre', label: 'Fibre', unit: 'g', ref: 25, kind: 'min' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', ref: 1000, kind: 'min' },
  { key: 'iron', label: 'Iron', unit: 'mg', ref: gender === 'Female' ? 21 : 17, kind: 'min' },
  { key: 'vitc', label: 'Vitamin C', unit: 'mg', ref: gender === 'Female' ? 65 : 80, kind: 'min' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', ref: 2000, kind: 'max' },
];

export default function Insights({ result, plan, inputs }) {
  const t = result.target_macros;
  const day = dayTotals(plan);
  const kcalFromMacros = day.protein * 4 + day.carbs * 4 + day.fat * 9 || 1;
  const split = [
    ['protein', day.protein * 4],
    ['carbs', day.carbs * 4],
    ['fat', day.fat * 9],
  ];
  const tgt = t.protein_g * 4 + t.carbs_g * 4 + t.fats_g * 9 || 1;
  const tgtSplit = { protein: t.protein_g * 4, carbs: t.carbs_g * 4, fat: t.fats_g * 9 };
  const sugarOver = day.sugar > t.sugar_g;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Nutrition check</h1>
          <p className="mt-1 text-soft">How your plan as it stands today compares with your targets.</p>
        </div>
        <button onClick={() => window.print()} className="btn-ghost no-print"><Printer className="h-4 w-4" /> Print</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6" aria-labelledby="where">
          <h2 id="where" className="text-xl">Where the calories come from</h2>
          <div className="mt-4 flex h-4 overflow-hidden rounded-full" role="img" aria-label={`Energy split: ${split.map(([k, v]) => `${MACRO[k].label} ${Math.round((v / kcalFromMacros) * 100)} percent`).join(', ')}`}>
            {split.map(([k, v]) => <div key={k} className={MACRO[k].bg} style={{ width: `${(v / kcalFromMacros) * 100}%` }} />)}
          </div>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="text-left text-soft"><th className="py-1 font-medium">Nutrient</th><th className="py-1 text-right font-medium">Your plan</th><th className="py-1 text-right font-medium">Target</th></tr></thead>
            <tbody>
              {split.map(([k, v]) => (
                <tr key={k} className="border-t border-line">
                  <td className="py-2"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-sm ${MACRO[k].bg}`} />{MACRO[k].label}</td>
                  <td className="py-2 text-right font-semibold">{fmt((v / kcalFromMacros) * 100)}%</td>
                  <td className="py-2 text-right text-soft">{fmt((tgtSplit[k] / tgt) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel p-6" aria-labelledby="meals">
          <h2 id="meals" className="text-xl">Calories by meal</h2>
          <ul className="mt-4 space-y-4">
            {SLOTS.map((s) => {
              const k = slotTotals(plan[s.key]).kcal;
              const target = t.daily_calories * s.share;
              return (
                <li key={s.key}>
                  <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">{s.label}</span><span className="text-soft">{fmt(k)} / {fmt(target)} kcal</span></div>
                  <Bar value={k} max={target} label={`${s.label} calories versus target`} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-6 lg:col-span-2" aria-labelledby="micro">
          <h2 id="micro" className="text-xl">Vitamins, minerals and fibre</h2>
          <p className="mt-1 text-sm text-soft">Compared with approximate adult daily reference intakes. Sodium is a ceiling; the rest are minimums.</p>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {refs(inputs.gender).map((r) => {
              const v = day[r.key];
              const ok = r.kind === 'min' ? v >= r.ref * 0.8 : v <= r.ref;
              return (
                <li key={r.key}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold">{r.label}</span>
                    <span className={ok ? 'font-medium text-moss' : 'font-medium text-clay'}>{ok ? (r.kind === 'min' ? 'Good' : 'Within limit') : r.kind === 'min' ? 'Low' : 'High'}</span>
                  </div>
                  <Bar value={v} max={r.ref} colorClass={ok ? 'bg-moss' : 'bg-clay'} label={`${r.label} versus reference`} />
                  <p className="mt-1 text-sm text-soft">{fmt(v)} of {r.kind === 'min' ? '' : 'max '}{fmt(r.ref)} {r.unit}</p>
                </li>
              );
            })}
            <li>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold">Sugar</span>
                <span className={sugarOver ? 'font-medium text-clay' : 'font-medium text-moss'}>{sugarOver ? 'Over your limit' : 'Within limit'}</span>
              </div>
              <Bar value={day.sugar} max={t.sugar_g} colorClass={sugarOver ? 'bg-clay' : 'bg-moss'} label="Sugar versus limit" />
              <p className="mt-1 text-sm text-soft">{fmt(day.sugar)} of max {fmt(t.sugar_g)} g</p>
            </li>
          </ul>
        </section>
      </div>
      <p className="mt-6 text-sm text-soft">Reference values are general guidance for healthy adults, not medical advice.</p>
    </div>
  );
}
