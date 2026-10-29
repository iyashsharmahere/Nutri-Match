import { ArrowRight, Calculator, Filter, ShieldCheck, CalendarDays, ShoppingBasket, ArrowRightLeft, BarChart3 } from 'lucide-react';
import { estimate } from '../lib/nutrition';
import PlateHero from './three/PlateHero';
import GrowingPlant from './three/GrowingPlant';

const STEPS = [
  { icon: Calculator, title: 'We work out your numbers', body: 'Your age, height, weight and activity give a daily calorie target using the Mifflin-St Jeor equation, the standard clinical formula.' },
  { icon: Filter, title: 'We filter, then match', body: 'Foods that break your diet or allergies are removed first. The rest are ranked by how closely their nutrients fit each meal’s share of your target.' },
  { icon: ShieldCheck, title: 'Only real foods', body: 'Every suggestion is a row in a measured dataset of 1,600+ Indian dishes. Nothing is invented, so every number can be traced.' },
];

const FEATURES = [
  { icon: CalendarDays, title: 'A whole week, varied', body: 'Seven days of meals where no dish repeats within two days, and every day lands close to your calorie target.' },
  { icon: ShoppingBasket, title: 'A shopping list that adds up', body: 'Ingredients from every recipe are combined, scaled to your portions, grouped by aisle and ready to tick off.' },
  { icon: ArrowRightLeft, title: 'Yours to change', body: 'Swap any dish, shuffle the whole day, or hide foods you never want to see again. Plans adjust without starting over.' },
  { icon: BarChart3, title: 'A nutrition check', body: 'See your macro split, calories per meal, and how fibre, iron, calcium, vitamin C and sodium compare with guideline intakes.' },
];

/** Shown while the 3D plate loads, or when WebGL isn't available. */
function PlateFallback({ est }) {
  return (
    <aside className="panel h-full p-6" aria-label="Plan summary">
      <p className="text-sm font-semibold text-soft">{est ? 'Your daily target' : 'What you’ll get'}</p>
      {est ? (
        <>
          <p className="mt-1 font-display text-5xl text-moss">{est.target.toLocaleString('en-IN')} <span className="font-sans text-base text-soft">kcal</span></p>
          <p className="mt-2 text-sm text-soft">Maintenance is about {est.tdee.toLocaleString('en-IN')} kcal.</p>
        </>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {[['Breakfast', '25%'], ['Lunch', '35%'], ['Snacks', '15%'], ['Dinner', '25%']].map(([m, p]) => (
            <li key={m} className="flex items-center justify-between py-3">
              <span className="font-medium">{m}</span>
              <span className="text-soft">{p} of your calories</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export default function Home({ go, hasPlan, inputs, macros }) {
  const est = hasPlan && inputs ? estimate(inputs) : null;
  return (
    <div className="relative">
      <GrowingPlant />
      {/* left padding leaves room for the plant in the margin */}
      <div className="relative z-10 mx-auto max-w-6xl pb-24 pl-14 pr-5 pt-10 md:pb-16 md:pl-24 md:pt-16 xl:pl-32 2xl:pl-5">
        <section className="grid items-center gap-8 md:grid-cols-[1.05fr_0.95fr] md:gap-10">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-moss">Meal planning for Indian kitchens</p>
            <h1 className="text-4xl leading-tight md:text-6xl">
              A day of eating that adds up to <em className="not-italic text-moss">your</em> numbers.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-soft">
              Tell us about your body, your goal and what you can’t eat. Get breakfast, lunch, snacks and dinner from real dishes, with portions sized to hit your calorie target.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => go('setup')} className="btn-primary">
                {hasPlan ? 'Rebuild my plan' : 'Build my plan'} <ArrowRight className="h-4 w-4" />
              </button>
              {hasPlan ? (
                <button onClick={() => go('plan')} className="btn-ghost">Open my current plan</button>
              ) : (
                <button onClick={() => go('foods')} className="btn-ghost">Browse the food library</button>
              )}
            </div>
            <p className="mt-4 text-sm text-soft">Takes about a minute. Nothing leaves your device except the numbers used to build the plan.</p>
          </div>
          <PlateHero macros={macros} fallback={<PlateFallback est={est} />} />
        </section>

        <section className="mt-24" aria-labelledby="how">
          <h2 id="how" className="text-2xl md:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="panel p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-moss-tint text-moss"><Icon className="h-5 w-5" /></span>
                  <span className="text-sm font-semibold text-soft">Step {i + 1}</span>
                </div>
                <h3 className="text-lg">{title}</h3>
                <p className="mt-2 text-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-28" aria-labelledby="more">
          <h2 id="more" className="text-2xl md:text-3xl">More than a single day</h2>
          <p className="mt-2 max-w-2xl text-soft">Once you have a plan, everything around it is built from the same numbers.</p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="panel flex gap-4 p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-moss-tint text-moss"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-lg">{title}</h3>
                  <p className="mt-1 text-soft">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-28 rounded-2xl bg-moss px-6 py-12 text-center text-white md:px-12" aria-labelledby="cta">
          <h2 id="cta" className="text-3xl md:text-4xl">Ready when you are.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">One minute of questions, then a plan you can shuffle, swap and shop from.</p>
          <button onClick={() => go('setup')} className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-moss transition-colors hover:bg-moss-tint">
            {hasPlan ? 'Rebuild my plan' : 'Build my plan'} <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <p className="mt-12 text-sm text-soft">
          NutriMatch is an educational tool, not medical advice. If you have a medical condition, check your plan with a doctor or registered dietitian.
        </p>
      </div>
    </div>
  );
}
