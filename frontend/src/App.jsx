import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import Header from './components/Header';
import Home from './components/Home';
import Setup from './components/Setup';
import Plan from './components/Plan';
import Insights from './components/Insights';
import Week from './components/Week';
import Groceries from './components/Groceries';
import ErrorBoundary from './components/ErrorBoundary';
import { getMealRecommendations, getWeekPlan } from './api';
import { SLOTS } from './lib/nutrition';
import { restore, persist } from './lib/storage';

const Foods = lazy(() => import('./components/Foods'));

const DEFAULTS = {
  age: 24, gender: 'Male', weight_kg: 70, height_cm: 175,
  activity_level: 'Moderately Active', goal: 'Maintain Weight',
  dietary_preference: 'Veg', allergies: [],
  custom_calories: '', custom_protein_g: '', custom_sugar_g: '',
};

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const randomSeed = () => Math.floor(Math.random() * 1e6);

const toPlan = (dayPlan) =>
  Object.fromEntries(SLOTS.map((s) => [s.key, { items: dayPlan[s.key].items, portion: dayPlan[s.key].portion ?? 1 }]));

const toPayload = (src, avoid, seed) => ({
  age: Number(src.age),
  gender: src.gender,
  weight_kg: Number(src.weight_kg),
  height_cm: Number(src.height_cm),
  activity_level: src.activity_level,
  goal: src.goal,
  dietary_preference: src.dietary_preference,
  allergies: src.allergies,
  avoid_foods: avoid,
  custom_calories: num(src.custom_calories),
  custom_protein_g: num(src.custom_protein_g),
  custom_sugar_g: num(src.custom_sugar_g),
  seed,
});

export default function App() {
  const [saved] = useState(restore);
  const [view, setView] = useState(saved.result ? 'plan' : 'home');
  // formData = what's being edited in the form right now.
  // inputs   = the exact details the current plan was built from (never half-edited).
  const [formData, setFormData] = useState({ ...DEFAULTS, ...saved.formData });
  const [inputs, setInputs] = useState(saved.inputs || null);
  const [avoid, setAvoid] = useState(saved.avoid || []);
  const [result, setResult] = useState(saved.result || null);
  const [plan, setPlan] = useState(saved.plan || null);
  const [week, setWeek] = useState(saved.week || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState('');

  useEffect(() => {
    persist({ formData, inputs, avoid, result, plan, week });
  }, [formData, inputs, avoid, result, plan, week]);

  const go = useCallback((v) => { setView(v); window.scrollTo({ top: 0 }); }, []);

  // `source` is the form on first build, or the saved `inputs` when shuffling.
  const build = async (source, seed, { stay = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await getMealRecommendations(toPayload(source, avoid, seed));
      setInputs({ ...source });
      setResult(res);
      setPlan(toPlan(res.full_day_plan));
      setWeek(null); // a week built from old inputs no longer matches
      if (!stay) go('plan');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildWeek = async (seed) => {
    setWeekLoading(true);
    setWeekError('');
    try {
      const res = await getWeekPlan(toPayload(inputs, avoid, seed));
      setWeek({ days: res.days.map((d) => ({ label: d.label, plan: toPlan(d.plan) })), unique: res.unique_foods });
    } catch (e) {
      setWeekError(e.message);
    } finally {
      setWeekLoading(false);
    }
  };

  const hideFood = (name) => {
    setAvoid((a) => (a.includes(name) ? a : [...a, name]));
    // Drop a saved week that still contains the food; rebuilding takes a moment.
    setWeek((w) => (w && w.days.some((d) => SLOTS.some((s) => d.plan[s.key].items.some((i) => i.food_name === name))) ? null : w));
  };
  const unhideFood = (name) => setAvoid((a) => a.filter((x) => x !== name));

  const hasPlan = Boolean(result && plan && inputs);
  const needPlan = (el) => (hasPlan ? el : <Home go={go} hasPlan={false} inputs={null} macros={undefined} />);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-moss focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <Header view={view} go={go} hasPlan={hasPlan} />
      <main id="main">
        <ErrorBoundary key={view} onReset={() => go('home')}>
          {view === 'home' && <Home go={go} hasPlan={hasPlan} inputs={inputs} macros={result?.target_macros} />}
          {view === 'setup' && <Setup formData={formData} setFormData={setFormData} onSubmit={() => build(formData)} loading={loading} error={error} onCancel={() => go(hasPlan ? 'plan' : 'home')} />}
          {view === 'plan' && needPlan(<Plan result={result} plan={plan} setPlan={setPlan} inputs={inputs} avoid={avoid} go={go} shuffle={() => build(inputs, randomSeed(), { stay: true })} shuffling={loading} shuffleError={error} hideFood={hideFood} unhideFood={unhideFood} />)}
          {view === 'week' && needPlan(<Week week={week} loading={weekLoading} error={weekError} onBuild={buildWeek} result={result} />)}
          {view === 'groceries' && needPlan(<Groceries plan={plan} week={week} go={go} />)}
          {view === 'foods' && <Suspense fallback={<p className="p-10 text-center text-soft" role="status">Loading food library…</p>}><Foods /></Suspense>}
          {view === 'insights' && needPlan(<Insights result={result} plan={plan} inputs={inputs} />)}
        </ErrorBoundary>
      </main>
    </div>
  );
}
