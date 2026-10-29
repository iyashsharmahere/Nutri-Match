import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { buildGroceryList, formatQty } from '../lib/grocery';
import { copyText } from '../lib/share';

const KEY = 'nutrimatch:checked:v1';
const readChecked = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch { return new Set(); } };

export default function Groceries({ plan, week, go }) {
  const [scope, setScope] = useState(week ? 'week' : 'today');
  const [checked, setChecked] = useState(readChecked);
  const [copied, setCopied] = useState(false);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify([...checked])); } catch { /* blocked */ } }, [checked]);

  const list = useMemo(() => buildGroceryList(scope === 'week' && week ? week.days.map((d) => d.plan) : [plan]), [scope, week, plan]);
  const total = list.groups.reduce((n, g) => n + g.items.length, 0);
  const done = list.groups.reduce((n, g) => n + g.items.filter((i) => checked.has(i.id)).length, 0);

  const toggle = (id) => setChecked((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const text = () => list.groups.map((g) => `${g.category}\n${g.items.filter((i) => !checked.has(i.id)).map((i) => `  - ${i.label}: ${formatQty(i)}`).join('\n')}`).join('\n\n');

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">Grocery list</h1>
          <p className="mt-1 text-soft">{list.dishCount} dishes · {done} of {total} items ticked</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={async () => { if (await copyText(text())) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }} className="btn-ghost">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
          </button>
          <button onClick={() => window.print()} className="btn-ghost"><Printer className="h-4 w-4" /> Print</button>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="List covers">
        <button role="radio" aria-checked={scope === 'today'} onClick={() => setScope('today')} className="chip">Today’s plan</button>
        <button role="radio" aria-checked={scope === 'week'} onClick={() => (week ? setScope('week') : go('week'))} className="chip">{week ? 'Whole week' : 'Whole week (build it first)'}</button>
        {checked.size > 0 && <button onClick={() => setChecked(new Set())} className="ml-auto min-h-[44px] px-2 text-sm font-semibold text-soft underline hover:text-ink">Clear ticks</button>}
      </div>

      {total === 0 ? (
        <p className="panel p-8 text-center text-soft">No ingredient data is available for these dishes.</p>
      ) : (
        <div className="space-y-6">
          {list.groups.map((g) => (
            <section key={g.category} className="panel p-5" aria-labelledby={`g-${g.category}`}>
              <h2 id={`g-${g.category}`} className="text-lg">{g.category}</h2>
              <ul className="mt-2 divide-y divide-line">
                {g.items.map((i) => {
                  const on = checked.has(i.id);
                  return (
                    <li key={i.id}>
                      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-2">
                        <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="h-5 w-5 shrink-0 accent-moss" />
                        <span className={`flex-1 ${on ? 'text-soft line-through' : ''}`}>{i.label}</span>
                        <span className={`text-sm ${on ? 'text-soft' : 'font-semibold'}`}>{formatQty(i)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-soft">Quantities come from each dish’s recipe for one listed serving, scaled by your portion size. “As needed” means the dataset lists the ingredient without an amount. Round up when you shop.</p>
    </div>
  );
}
