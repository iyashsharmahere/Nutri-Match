import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const MACRO = {
  protein: { label: 'Protein', color: '#25513B', bg: 'bg-moss' },
  carbs: { label: 'Carbs', color: '#C77A12', bg: 'bg-saffron' },
  fat: { label: 'Fat', color: '#A8472F', bg: 'bg-clay' },
};

/** Horizontal progress bar. Labels live outside so the meaning never depends on color alone. */
export function Bar({ value, max, colorClass = 'bg-moss', label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-line/70"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
    >
      <div className={`h-full rounded-full ${colorClass} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Accessible modal: Esc closes, focus moves in and returns, backdrop click closes. */
export function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-soft hover:bg-paper hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        return (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className="chip">
            {typeof o === 'string' ? o : o.label ?? o.value}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, unit, tone = 'text-ink' }) {
  return (
    <div>
      <div className="text-sm text-soft">{label}</div>
      <div className={`font-display text-3xl ${tone}`}>
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-medium text-soft">{unit}</span>}
      </div>
    </div>
  );
}
