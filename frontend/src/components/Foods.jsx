import { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import FOODS from '../data/foods.json';
import { Dialog, Segmented } from './ui';
import { fmt } from '../lib/nutrition';

const PAGE = 24;
const CATEGORIES = ['All', ...Array.from(new Set(FOODS.flatMap((f) => f.category.split(',').map((c) => c.trim())))).filter(Boolean).sort()];
const SORTS = {
  name: ['Name A–Z', (a, b) => a.name.localeCompare(b.name)],
  protein: ['Most protein', (a, b) => b.protein - a.protein],
  kcalAsc: ['Fewest calories', (a, b) => a.kcal - b.kcal],
  fibre: ['Most fibre', (a, b) => b.fibre - a.fibre],
};

export default function Foods() {
  const [q, setQ] = useState('');
  const [diet, setDiet] = useState('All');
  const [cat, setCat] = useState('All');
  const [sort, setSort] = useState('name');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const dq = useDeferredValue(q);

  const list = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return FOODS.filter((f) =>
      (diet === 'All' || f.diet === diet) &&
      (cat === 'All' || f.category.includes(cat)) &&
      (!s || f.name.toLowerCase().includes(s) || f.ingredients.toLowerCase().includes(s))
    ).sort(SORTS[sort][1]);
  }, [dq, diet, cat, sort]);

  const reset = (fn) => (v) => { fn(v); setShown(PAGE); };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <h1 className="text-3xl md:text-4xl">Food library</h1>
      <p className="mt-1 text-soft">{fmt(FOODS.length)} dishes with measured nutrition. Amounts are for one listed serving.</p>

      <div className="panel mt-6 grid gap-4 p-4 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <label htmlFor="q" className="sr-only">Search foods or ingredients</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
          <input id="q" type="search" value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Search dishes or ingredients, e.g. paneer" className="field pl-9" />
        </div>
        <div>
          <label htmlFor="cat" className="sr-only">Category</label>
          <select id="cat" value={cat} onChange={(e) => reset(setCat)(e.target.value)} className="field md:w-48">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)} className="field md:w-44">
            {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="md:col-span-3"><Segmented label="Diet" value={diet} options={['All', 'Veg', 'Eggetarian', 'Non-Veg']} onChange={reset(setDiet)} /></div>
      </div>

      <p className="mt-4 text-sm text-soft" role="status">{fmt(list.length)} {list.length === 1 ? 'result' : 'results'}</p>

      {list.length === 0 ? (
        <div className="panel mt-4 p-10 text-center">
          <p className="font-semibold">Nothing matches those filters.</p>
          <button className="btn-ghost mt-4" onClick={() => { setQ(''); setDiet('All'); setCat('All'); }}>Clear filters</button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((f) => (
            <li key={f.name}>
              <button onClick={() => setOpen(f)} className="panel h-full w-full p-4 text-left transition-colors hover:border-moss">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-sans text-base font-semibold leading-snug">{f.name}</h2>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${f.diet === 'Non-Veg' ? 'bg-clay-tint text-clay' : f.diet === 'Eggetarian' ? 'bg-saffron-tint text-saffron' : 'bg-moss-tint text-moss'}`}>{f.diet}</span>
                </div>
                <p className="mt-1 text-sm text-soft">{f.category}</p>
                <p className="mt-3 text-sm"><strong>{fmt(f.kcal)}</strong> kcal · <strong>{fmt(f.protein)}</strong>g protein · <strong>{fmt(f.carbs)}</strong>g carbs · <strong>{fmt(f.fat)}</strong>g fat</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown < list.length && (
        <div className="mt-6 text-center"><button className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>Show more ({fmt(list.length - shown)} left)</button></div>
      )}

      {open && (
        <Dialog title={open.name} onClose={() => setOpen(null)}>
          <p className="text-sm text-soft">{open.serving} · {fmt(open.weight)} g · {open.diet} · {open.category}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[['Calories', open.kcal, 'kcal'], ['Protein', open.protein, 'g'], ['Carbs', open.carbs, 'g'], ['Fat', open.fat, 'g'], ['Sugar', open.sugar, 'g'], ['Fibre', open.fibre, 'g'], ['Sodium', open.sodium, 'mg'], ['Calcium', open.calcium, 'mg'], ['Iron', open.iron, 'mg'], ['Vitamin C', open.vitc, 'mg']].map(([k, v, u]) => (
              <div key={k} className="border-b border-line pb-2"><dt className="text-sm text-soft">{k}</dt><dd className="font-semibold">{fmt(v, 1)} {u}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-sm"><span className="font-semibold">Allergens:</span> {open.allergy}</p>
          <p className="mt-2 text-sm"><span className="font-semibold">Ingredients:</span> {open.ingredients}</p>
        </Dialog>
      )}
    </div>
  );
}
