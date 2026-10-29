import { useMemo, useState } from 'react';
import { Loader2, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react';
import { SLOTS, slotTotals, dayTotals, fmt } from '../lib/nutrition';
import { Bar, Dialog, MACRO } from './ui';
import WeekSkyline from './three/WeekSkyline';
import { TABS_WIDTH_PCT } from '../gl/helpers';

export default function Week({ week, loading, error, onBuild, result }) {
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState(null);
  const target = result.target_macros;
  const kcal = useMemo(() => (week ? week.days.map((d) => dayTotals(d.plan).kcal) : []), [week]);

  const onTabKey = (e) => {
    const n = week?.days.length ?? 0;
    const next = { ArrowRight: (active + 1) % n, ArrowLeft: (active - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  if (!week) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-12 text-center md:pb-16">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-moss-tint text-moss"><CalendarDays className="h-6 w-6" /></span>
        <h1 className="text-3xl md:text-4xl">Plan the whole week</h1>
        <p className="mx-auto mt-3 max-w-md text-soft">Seven days built from your numbers. No dish repeats within two days, and anything you’ve hidden stays hidden.</p>
        {error && <p role="alert" className="mx-auto mt-5 flex max-w-md items-start gap-2 rounded-lg bg-clay-tint p-3 text-left text-sm font-medium text-clay"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        <button onClick={() => onBuild()} disabled={loading} className="btn-primary mt-6">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your week…</> : 'Build my week'}
        </button>
      </div>
    );
  }

  const day = week.days[active];
  const t = dayTotals(day.plan);
  const avg = week.days.reduce((a, d) => a + dayTotals(d.plan).kcal, 0) / week.days.length;
  const rows = [['Calories', t.kcal, target.daily_calories, 'kcal', 'bg-ink'], ['Protein', t.protein, target.protein_g, 'g', MACRO.protein.bg], ['Carbs', t.carbs, target.carbs_g, 'g', MACRO.carbs.bg], ['Fat', t.fat, target.fats_g, 'g', MACRO.fat.bg]];

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Your week</h1>
          <p className="mt-1 text-soft">{week.unique} different dishes · averages {fmt(avg)} kcal a day against a {fmt(target.daily_calories)} kcal target</p>
        </div>
        <button onClick={() => onBuild(Math.floor(Math.random() * 1e6))} disabled={loading} className="btn-ghost no-print">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} New week
        </button>
      </div>
      {error && <p role="alert" className="mb-4 text-sm font-medium text-clay">{error}</p>}

      <WeekSkyline kcal={kcal} target={target.daily_calories} active={active} onSelect={setActive} />

      {/* The 7 columns line up under the 7 bars: their total width is the bars' share of the skyline's visible width */}
      <div role="tablist" aria-label="Days" className="no-print mx-auto mb-6 mt-2 grid grid-cols-7 gap-1" style={{ width: `${TABS_WIDTH_PCT}%` }}>
        {week.days.map((d, i) => (
          <button
            key={d.label} role="tab" id={`tab-${i}`} aria-selected={active === i} aria-controls="day-panel"
            tabIndex={active === i ? 0 : -1} onClick={() => setActive(i)} onKeyDown={onTabKey}
            className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg border px-0.5 text-sm font-semibold transition-colors ${active === i ? 'border-moss bg-moss text-white' : 'border-line bg-card text-ink hover:border-moss'}`}
          >
            {d.label.slice(0, 3)}
            <span className={`text-[11px] font-medium ${active === i ? 'text-white/85' : 'text-soft'}`}>{fmt(kcal[i])}</span>
          </button>
        ))}
      </div>

      <div id="day-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {SLOTS.map((s) => {
            const slot = day.plan[s.key];
            return (
              <section key={s.key} className="panel p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg">{s.label}</h2>
                  <span className="text-sm text-soft">{fmt(slotTotals(slot).kcal)} kcal · {slot.portion}×</span>
                </div>
                <ul className="mt-2 divide-y divide-line">
                  {slot.items.map((it) => (
                    <li key={it.food_name} className="py-2.5">
                      <button onClick={() => setDetail(it)} className="text-left font-semibold underline-offset-2 hover:underline">{it.food_name}</button>
                      <p className="text-sm text-soft">{it.serving}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <aside className="panel h-fit p-5" aria-label={`${day.label} totals`}>
          <h2 className="text-lg">{day.label}</h2>
          <div className="mt-4 space-y-4">
            {rows.map(([n, v, max, u, cls]) => (
              <div key={n}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">{n}</span><span className="text-soft">{fmt(v)} / {fmt(max)} {u}</span></div>
                <Bar value={v} max={max} colorClass={cls} label={`${n} for ${day.label}`} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {detail && (
        <Dialog title={detail.food_name} onClose={() => setDetail(null)}>
          <p className="text-sm text-soft">{detail.serving} · {detail.diet_type} · {detail.category}</p>
          <p className="mt-3 text-sm"><span className="font-semibold">Per serving:</span> {fmt(detail.calories)} kcal · {fmt(detail.protein_g)} g protein · {fmt(detail.carbs_g)} g carbs · {fmt(detail.fats_g)} g fat</p>
          <p className="mt-3 text-sm"><span className="font-semibold">Ingredients:</span> {detail.ingredients}</p>
        </Dialog>
      )}
    </div>
  );
}
