import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { ACTIVITY, GOALS, DIETS, ALLERGENS, estimate, validate, fmt } from '../lib/nutrition';
import { Segmented } from './ui';

const STEPS = ['Your body', 'Goal & diet', 'Review'];

function NumberField({ id, label, unit, value, error, onChange, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label} <span className="font-normal text-soft">({unit})</span></label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`field ${error ? 'border-clay focus:border-clay focus:ring-clay/30' : ''}`}
        {...rest}
      />
      {error && <p id={`${id}-err`} className="mt-1 flex items-center gap-1 text-sm font-medium text-clay"><AlertCircle className="h-4 w-4" />{error}</p>}
    </div>
  );
}

export default function Setup({ formData, setFormData, onSubmit, loading, error, onCancel }) {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validate(formData), [formData]);
  const est = useMemo(() => (['age', 'weight_kg', 'height_cm'].some((k) => errors[k]) ? null : estimate(formData)), [formData, errors]);
  const set = (k) => (v) => setFormData((f) => ({ ...f, [k]: v }));
  const toggleAllergen = (a) =>
    setFormData((f) => ({ ...f, allergies: f.allergies.includes(a) ? f.allergies.filter((x) => x !== a) : [...f.allergies, a] }));

  const next = () => {
    if (step === 0 && ['age', 'weight_kg', 'height_cm'].some((k) => errors[k])) { setTouched(true); return; }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (step < 2) return next();
    if (Object.keys(errors).length) { setTouched(true); return; }
    onSubmit();
  };
  const shown = (k) => (touched ? errors[k] : undefined);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-8 md:pb-16 md:pt-12">
      <button onClick={onCancel} className="mb-6 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Cancel
      </button>

      <ol className="mb-8 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-moss' : 'bg-line'}`} />
            <span className={`mt-2 block text-sm ${i === step ? 'font-semibold text-ink' : 'text-soft'}`}>{i + 1}. {s}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit} className="panel p-6 md:p-8" noValidate>
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl">Tell us about your body</h1>
              <p className="hint">Used only to estimate how much energy you burn in a day.</p>
            </div>
            <div>
              <span className="label" id="gender-l">Sex</span>
              <Segmented label="Sex" value={formData.gender} options={['Male', 'Female']} onChange={set('gender')} />
              <p className="hint">The equation uses sex to estimate resting metabolism.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <NumberField id="age" label="Age" unit="years" value={formData.age} error={shown('age')} onChange={set('age')} min="10" max="100" />
              <NumberField id="weight" label="Weight" unit="kg" value={formData.weight_kg} error={shown('weight_kg')} onChange={set('weight_kg')} step="0.1" />
              <NumberField id="height" label="Height" unit="cm" value={formData.height_cm} error={shown('height_cm')} onChange={set('height_cm')} />
            </div>
            <div>
              <span className="label">How active are you?</span>
              <div role="radiogroup" aria-label="Activity level" className="grid gap-2 sm:grid-cols-2">
                {ACTIVITY.map((a) => (
                  <button key={a.value} type="button" role="radio" aria-checked={formData.activity_level === a.value} onClick={() => set('activity_level')(a.value)}
                    className="chip !h-auto flex-col !items-start py-3 text-left">
                    <span>{a.value}</span>
                    <span className={`text-xs font-normal ${formData.activity_level === a.value ? 'text-white/85' : 'text-soft'}`}>{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-7">
            <h1 className="text-3xl">Your goal and what you eat</h1>
            <div>
              <span className="label">Goal</span>
              <div role="radiogroup" aria-label="Goal" className="grid gap-2 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <button key={g.value} type="button" role="radio" aria-checked={formData.goal === g.value} onClick={() => set('goal')(g.value)} className="chip !h-auto flex-col !items-start py-3 text-left">
                    <span>{g.value}</span>
                    <span className={`text-xs font-normal ${formData.goal === g.value ? 'text-white/85' : 'text-soft'}`}>{g.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Diet</span>
              <Segmented label="Diet" value={formData.dietary_preference} options={DIETS} onChange={set('dietary_preference')} />
              <p className="hint">Eggetarian includes vegetarian dishes plus egg dishes. Non-Veg includes everything.</p>
            </div>
            <div>
              <span className="label">Allergies or foods to avoid <span className="font-normal text-soft">(optional)</span></span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Allergies">
                {ALLERGENS.map((a) => (
                  <button key={a} type="button" aria-pressed={formData.allergies.includes(a)} onClick={() => toggleAllergen(a)} className="chip">{a}</button>
                ))}
              </div>
              <p className="hint">Dishes containing these are removed before any matching happens.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-3xl">Check your numbers</h1>
            {est && (
              <dl className="grid grid-cols-3 gap-4 rounded-lg bg-moss-tint p-4">
                {[['Resting burn', est.bmr], ['Daily burn', est.tdee], ['Your target', est.target]].map(([k, v], i) => (
                  <div key={k}>
                    <dt className="text-sm text-soft">{k}</dt>
                    <dd className={`font-display text-2xl ${i === 2 ? 'text-moss' : ''}`}>{fmt(v)} <span className="font-sans text-xs text-soft">kcal</span></dd>
                  </div>
                ))}
              </dl>
            )}
            <details className="rounded-lg border border-line p-4" open={Boolean(errors.custom_calories || errors.custom_protein_g || errors.custom_sugar_g)}>
              <summary className="min-h-[44px] cursor-pointer py-2.5 text-sm font-semibold">Set your own targets (optional)</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <NumberField id="cc" label="Calories" unit="kcal" value={formData.custom_calories} error={errors.custom_calories} onChange={set('custom_calories')} placeholder="Auto" />
                <NumberField id="cp" label="Protein" unit="g" value={formData.custom_protein_g} error={errors.custom_protein_g} onChange={set('custom_protein_g')} placeholder="Auto" />
                <NumberField id="cs" label="Sugar limit" unit="g" value={formData.custom_sugar_g} error={errors.custom_sugar_g} onChange={set('custom_sugar_g')} placeholder="25" />
              </div>
              <p className="hint">Leave blank to use the calculated values. Calculated calories never go below 1,200.</p>
            </details>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-clay-tint p-3 text-sm font-medium text-clay"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button>
          ) : <span />}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Building…</>) : step < 2 ? (<>Continue <ArrowRight className="h-4 w-4" /></>) : 'Build my plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
