import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2, Info, AlertCircle, Shuffle, EyeOff, Copy, Check } from 'lucide-react';
import { SLOTS, PORTIONS, slotTotals, dayTotals, fmt } from '../lib/nutrition';
import { getSwapOptions } from '../api';
import { planAsText, copyText } from '../lib/share';
import { Bar, Dialog, MACRO } from './ui';
import MacroDial from './three/MacroDial';

function SwapDialog({ slot, state, inputs, avoid, onPick, onClose }) {
  const [options, setOptions] = useState(null);
  const [err, setErr] = useState('');
  const idx = state.index;
  const current = state.plan[slot.key].items[idx];
  const target = state.targets[slot.key] / Math.max(1, state.plan[slot.key].items.length);

  useEffect(() => {
    let live = true;
    const exclude = SLOTS.flatMap((s) => state.plan[s.key].items.map((i) => i.food_name));
    getSwapOptions({
      slot: slot.key,
      targetCalories: target,
      diet: inputs.dietary_preference,
      allergies: inputs.allergies,
      exclude: [...exclude, ...avoid],
    }).then((r) => live && setOptions(r)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog title={`Swap ${slot.label.toLowerCase()}`} onClose={onClose}>
      <p className="mb-4 text-sm text-soft">Replacing <strong className="text-ink">{current.food_name}</strong>. These foods fit your diet and allergies and are closest in nutrients to what this meal needs.</p>
      {err && <p role="alert" className="flex items-center gap-2 text-clay"><AlertCircle className="h-4 w-4" />{err}</p>}
      {!options && !err && <p className="flex items-center gap-2 text-soft" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Finding alternatives…</p>}
      {options && options.length === 0 && <p className="text-soft">No other matching foods were found for this meal.</p>}
      <ul className="divide-y divide-line">
        {options?.map((o) => (
          <li key={o.food_name} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{o.food_name}</p>
              <p className="text-sm text-soft">{fmt(o.calories)} kcal · {fmt(o.protein_g)}g protein · {fmt(o.carbs_g)}g carbs · {fmt(o.fats_g)}g fat</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-semibold text-moss">{fmt(o.match_score)}% fit</span>
              <button className="btn-ghost !min-h-[40px] !px-4" onClick={() => onPick(o)}>Use</button>
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export default function Plan({ result, plan, setPlan, inputs, avoid, go, shuffle, shuffling, shuffleError, hideFood, unhideFood }) {
  const [copied, setCopied] = useState(false);
  const [swap, setSwap] = useState(null); // {slotKey, index}
  const [detail, setDetail] = useState(null);
  const t = result.target_macros;
  const targets = useMemo(() => Object.fromEntries(SLOTS.map((s) => [s.key, t.daily_calories * s.share])), [t]);
  const day = dayTotals(plan);
  const diff = day.kcal - t.daily_calories;

  const setPortion = (key, p) => setPlan((pl) => ({ ...pl, [key]: { ...pl[key], portion: p } }));
  const pick = (food) => {
    setPlan((pl) => {
      const items = pl[swap.slotKey].items.map((it, i) => (i === swap.index ? food : it));
      return { ...pl, [swap.slotKey]: { ...pl[swap.slotKey], items } };
    });
    setSwap(null);
  };

  const rows = [
    ['Calories', day.kcal, t.daily_calories, 'kcal', 'bg-ink'],
    ['Protein', day.protein, t.protein_g, 'g', MACRO.protein.bg],
    ['Carbs', day.carbs, t.carbs_g, 'g', MACRO.carbs.bg],
    ['Fat', day.fat, t.fats_g, 'g', MACRO.fat.bg],
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Your day on a plate</h1>
          <p className="mt-1 text-soft">{inputs.goal} · {inputs.dietary_preference}{inputs.allergies.length ? ` · no ${inputs.allergies.join(', ').toLowerCase()}` : ''}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button onClick={shuffle} disabled={shuffling} className="btn-ghost">
            {shuffling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />} Shuffle plan
          </button>
          <button
            onClick={async () => { if (await copyText(planAsText(plan, t.daily_calories))) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
            className="btn-ghost"
          >
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy as text</>}
          </button>
          <button onClick={() => go('insights')} className="btn-ghost">Nutrition check</button>
        </div>
      </div>
      {shuffleError && <p role="alert" className="mb-4 flex items-center gap-2 text-sm font-medium text-clay"><AlertCircle className="h-4 w-4" />{shuffleError}</p>}

      <section className="panel mb-8 grid gap-6 p-6 md:grid-cols-[auto_1fr] md:gap-10" aria-label="Daily totals">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <div className="relative h-48 w-48">
            <MacroDial day={day} target={t.daily_calories} className="absolute inset-0" />
            {/* Numbers stay in the DOM so they're readable, selectable and accessible */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-4xl leading-none text-moss">{fmt(day.kcal)}</span>
              <span className="mt-1 text-xs text-soft">of {fmt(t.daily_calories)} kcal</span>
            </div>
          </div>
          <p className={`text-sm font-medium ${Math.abs(diff) <= t.daily_calories * 0.1 ? 'text-moss' : 'text-clay'}`}>
            {Math.abs(diff) <= t.daily_calories * 0.1 ? 'On target' : diff > 0 ? `${fmt(diff)} kcal over` : `${fmt(-diff)} kcal under`}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(([name, v, max, unit, cls]) => (
            <div key={name}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold">{name}</span>
                <span className="text-soft">{fmt(v)} / {fmt(max)} {unit}</span>
              </div>
              <Bar value={v} max={max} colorClass={cls} label={`${name} planned versus target`} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {SLOTS.map((s) => {
          const slot = plan[s.key];
          const tot = slotTotals(slot);
          return (
            <section key={s.key} className="panel flex flex-col p-5" aria-labelledby={`h-${s.key}`}>
              <div className="flex items-baseline justify-between">
                <h2 id={`h-${s.key}`} className="text-xl">{s.label}</h2>
                <span className="text-sm text-soft">{fmt(tot.kcal)} of {fmt(targets[s.key])} kcal</span>
              </div>

              <ul className="mt-3 divide-y divide-line">
                {slot.items.map((it, i) => (
                  <li key={it.food_name} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button onClick={() => setDetail(it)} className="text-left font-semibold underline-offset-2 hover:underline">{it.food_name}</button>
                        <p className="text-sm text-soft">{it.serving} · {fmt(it.calories * slot.portion)} kcal · {fmt(it.protein_g * slot.portion)}g protein</p>
                      </div>
                      <div className="no-print flex shrink-0 gap-1.5">
                        <button onClick={() => setSwap({ slotKey: s.key, index: i })} className="btn-ghost !min-h-[40px] !px-3" aria-label={`Swap ${it.food_name}`}>
                          <ArrowRightLeft className="h-4 w-4" /> Swap
                        </button>
                        <button onClick={() => { hideFood(it.food_name); setSwap({ slotKey: s.key, index: i }); }} className="btn-ghost !min-h-[40px] !px-3" aria-label={`Never suggest ${it.food_name} again`} title="Never suggest this again">
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4">
                <span className="mb-2 block text-sm font-semibold" id={`p-${s.key}`}>Portion size</span>
                <div role="radiogroup" aria-labelledby={`p-${s.key}`} className="flex flex-wrap gap-1.5">
                  {PORTIONS.map((p) => (
                    <button key={p} role="radio" aria-checked={slot.portion === p} onClick={() => setPortion(s.key, p)} className="chip !min-h-[40px] !px-3">{p}×</button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {avoid.length > 0 && (
        <section className="panel no-print mt-6 p-5" aria-labelledby="hidden">
          <h2 id="hidden" className="text-lg">Foods you’ve hidden</h2>
          <p className="hint">These won’t appear in new plans, swaps or your week.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {avoid.map((n) => (
              <li key={n}>
                <button onClick={() => unhideFood(n)} className="chip !min-h-[40px]" aria-label={`Allow ${n} again`}>{n} <span aria-hidden className="ml-2 text-soft">×</span></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 flex items-start gap-2 text-sm text-soft"><Info className="mt-0.5 h-4 w-4 shrink-0" />Portions were sized so each meal lands near its calorie share. “Fit” compares a food’s nutrient balance to what the meal needs; it is not a health rating.</p>

      {swap && <SwapDialog slot={SLOTS.find((x) => x.key === swap.slotKey)} state={{ plan, targets, index: swap.index }} inputs={inputs} avoid={avoid} onPick={pick} onClose={() => setSwap(null)} />}
      {detail && (
        <Dialog title={detail.food_name} onClose={() => setDetail(null)}>
          <p className="text-sm text-soft">{detail.serving} · {detail.diet_type} · {detail.category}</p>
          <p className="mt-3 text-sm"><span className="font-semibold">Ingredients:</span> {detail.ingredients}</p>
        </Dialog>
      )}
    </div>
  );
}
