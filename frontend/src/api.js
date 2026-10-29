// Backend URL: set VITE_API_URL in frontend/.env to point at a deployed API.
const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// Free hosting tiers can take ~30-60s to wake up, so be patient before giving up.
const TIMEOUT_MS = 45000;

/** Turn FastAPI's validation payload into one readable sentence. */
function describe422(detail) {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail) || !detail.length) return '';
  const d = detail[0];
  const field = String(d.loc?.slice(-1)[0] ?? '').replace(/_/g, ' ');
  return field ? `Please check “${field}”: ${d.msg}.` : d.msg;
}

async function post(path, body, fallback) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e) {
    throw new Error(
      e.name === 'AbortError'
        ? 'The server is taking too long to respond. If it was idle, it may still be waking up. Please try again in a moment.'
        : `Can't reach the NutriMatch server at ${API}. Start the backend (see README) and try again.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.ok) return res.json();

  let detail = '';
  try { detail = (await res.json()).detail; } catch { /* body wasn't JSON */ }
  if (res.status === 429) {
    const wait = res.headers.get('Retry-After');
    throw new Error(`You’re going a little fast. Please wait${wait ? ` ${wait} seconds` : ' a moment'} and try again.`);
  }
  if (res.status === 422) throw new Error(describe422(detail) || fallback);
  if (res.status >= 500) throw new Error(typeof detail === 'string' && detail ? detail : 'The server had a problem. Please try again.');
  throw new Error(fallback);
}

export const getMealRecommendations = (payload) =>
  post('/recommend', payload, 'Could not build your plan. Please check your details.');

export const getWeekPlan = (payload) =>
  post('/recommend/week', payload, 'Could not build your week. Please check your details.');

export const getSwapOptions = ({ slot, targetCalories, diet, allergies, exclude }) =>
  post(
    '/recommend/swap',
    {
      meal_slot: slot,
      target_calories: targetCalories,
      dietary_preference: diet,
      allergies,
      exclude_foods: exclude,
    },
    'Could not load alternatives.'
  );
