// End-to-end walkthrough against a running backend (default http://127.0.0.1:8000).
// Start it first:  cd backend && python -m uvicorn main:app --port 8000
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

beforeEach(() => { localStorage.clear(); window.scrollTo = () => {}; });

const user = () => userEvent.setup();

async function buildDefaultPlan(u) {
  await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
  await u.click(screen.getByRole('button', { name: /continue/i }));
  await u.click(screen.getByRole('button', { name: /continue/i }));
  await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
  await screen.findByRole('heading', { name: /your day on a plate/i });
}

describe('NutriMatch app', () => {
  it('walks home -> setup -> plan -> week -> groceries -> insights', async () => {
    const u = user();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/adds up to/i);

    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    // validation: clear age -> blocked on step 1
    const age = screen.getByLabelText(/^Age/);
    await u.clear(age);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/age between 10 and 100/i)).toBeTruthy();
    await u.type(age, '28');

    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: 'Dairy' }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/your target/i)).toBeTruthy();
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));

    // Plan view
    await screen.findByRole('heading', { name: /your day on a plate/i });
    expect(screen.getAllByRole('button', { name: /^swap /i }).length).toBe(8);
    expect(screen.getByText(/no dairy/i)).toBeTruthy();

    // hide a food -> it lands in the hidden list and a swap dialog opens
    const first = screen.getAllByRole('button', { name: /never suggest/i })[0];
    await u.click(first);
    await screen.findByRole('dialog');
    await u.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: /foods you’ve hidden/i })).toBeTruthy();

    // shuffle changes plan without crashing
    await u.click(screen.getByRole('button', { name: /shuffle plan/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /shuffle plan/i }).disabled).toBe(false));

    // Week
    await u.click(screen.getAllByRole('button', { name: /^week$/i })[0]);
    await u.click(await screen.findByRole('button', { name: /build my week/i }));
    await screen.findByRole('heading', { name: /your week/i });
    expect(screen.getAllByRole('tab').length).toBe(7);
    await u.click(screen.getAllByRole('tab')[3]);

    // Groceries (week scope)
    await u.click(screen.getAllByRole('button', { name: /^groceries$/i })[0]);
    await screen.findByRole('heading', { name: /grocery list/i });
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(15);
    await u.click(boxes[0]);
    expect(JSON.parse(localStorage.getItem('nutrimatch:checked:v1')).length).toBe(1);

    // Insights
    await u.click(screen.getAllByRole('button', { name: /^insights$/i })[0]);
    await screen.findByRole('heading', { name: /nutrition check/i });
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(5);
  });

  it('shows a helpful message when the API is unreachable', async () => {
    const u = user();
    const real = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new TypeError('fetch failed'));
    render(<App />);
    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/can't reach the nutrimatch server/i);
    globalThis.fetch = real;
  });

  it('restores a saved plan after reload', async () => {
    const u = user();
    const { unmount } = render(<App />);
    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
    await screen.findByRole('heading', { name: /your day on a plate/i });
    unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: /your day on a plate/i })).toBeTruthy();
  });

  it('keeps showing the built plan’s details when the form is edited but not submitted', async () => {
    const u = user();
    render(<App />);
    await buildDefaultPlan(u);
    expect(screen.getByText(/Maintain Weight · Veg/)).toBeTruthy();
    // open the form, switch goal, then cancel
    await u.click(screen.getAllByRole('button', { name: /change my details/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('radio', { name: /muscle gain/i }));
    await u.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /your day on a plate/i })).toBeTruthy();
    expect(screen.getByText(/Maintain Weight · Veg/)).toBeTruthy();
    expect(screen.queryByText(/Muscle Gain · Veg/)).toBeNull();
  });

  it('rejects out-of-range custom calories before calling the API', async () => {
    const u = user();
    render(<App />);
    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.type(screen.getByLabelText(/^Calories/), '500');
    expect(screen.getByText(/1,200 to 6,000/)).toBeTruthy();
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
    expect(screen.queryByRole('heading', { name: /your day on a plate/i })).toBeNull();
  });

  it('survives corrupted saved data', async () => {
    localStorage.setItem('nutrimatch:v3', '{"plan":{"breakfast":null},"result":5,"inputs":1}');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/adds up to/i);
  });

  it('shows friendly messages for rate limits and validation errors', async () => {
    const u = user();
    const real = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'x' }), { status: 429, headers: { 'Retry-After': '12' } });
    const { unmount } = render(<App />);
    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/wait 12 seconds/i);
    unmount();

    globalThis.fetch = async () => new Response(JSON.stringify({ detail: [{ loc: ['body', 'custom_calories'], msg: 'Input should be greater than or equal to 1200' }] }), { status: 422 });
    render(<App />);
    await u.click(within(screen.getByRole('main')).getAllByRole('button', { name: /build my plan/i })[0]);
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(screen.getByRole('button', { name: /continue/i }));
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: /^build my plan$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/custom calories/i);
    globalThis.fetch = real;
  });

  it('shows flat fallbacks for every 3D element when WebGL is unavailable', async () => {
    const u = user();
    render(<App />);
    // Home: the plate's fallback card, plus the new sections
    expect(screen.getByText(/what you’ll get/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /more than a single day/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /ready when you are/i })).toBeTruthy();
    await buildDefaultPlan(u);
    // Plan: the calorie numbers live in the DOM beside the dial, with a flat ring fallback
    expect(screen.getByText(/^of [\d,]+ kcal$/)).toBeTruthy();
    // Week: tabs show each day's calories and sit in a 7-column grid under the skyline
    await u.click(screen.getAllByRole('button', { name: /^week$/i })[0]);
    await u.click(await screen.findByRole('button', { name: /build my week/i }));
    await screen.findByRole('heading', { name: /your week/i });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(7);
    expect(tabs[0].textContent).toMatch(/Mon\s*[\d,]+/);
    expect(parseFloat(screen.getByRole('tablist').style.width)).toBeGreaterThan(80);
    // Arrow keys move between days
    tabs[0].focus();
    await u.keyboard('{ArrowRight}');
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
  });
});
