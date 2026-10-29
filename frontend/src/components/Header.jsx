import { Leaf, Home, UtensilsCrossed, Search, BarChart3, CalendarDays, ShoppingBasket } from 'lucide-react';

const ITEMS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'plan', label: 'My plan', icon: UtensilsCrossed, needsPlan: true },
  { key: 'week', label: 'Week', icon: CalendarDays, needsPlan: true },
  { key: 'groceries', label: 'Groceries', icon: ShoppingBasket, needsPlan: true },
  { key: 'foods', label: 'Foods', icon: Search },
  { key: 'insights', label: 'Insights', icon: BarChart3, needsPlan: true },
];

export default function Header({ view, go, hasPlan }) {
  const items = ITEMS.filter((i) => !i.needsPlan || hasPlan);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <button onClick={() => go('home')} className="flex items-center gap-2 rounded-lg" aria-label="NutriMatch home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-moss text-white">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-display text-xl text-ink">NutriMatch</span>
          </button>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {items.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => go(key)}
                aria-current={view === key ? 'page' : undefined}
                className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition-colors ${view === key ? 'bg-moss-tint text-moss' : 'text-soft hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
            <button onClick={() => go('setup')} className="btn-primary ml-2">
              {hasPlan ? 'Change my details' : 'Build my plan'}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile: thumb-reach tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-paper md:hidden no-print" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => go(key)}
            aria-current={view === key ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${view === key ? 'text-moss' : 'text-soft'}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
