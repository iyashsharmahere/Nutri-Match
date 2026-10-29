// Integration: real scroll position -> real plant scene, through the real GLCanvas (only the GPU is faked).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

const flags = { reduced: false };
vi.mock('./support.js', () => ({ webglSupported: () => true, prefersReducedMotion: () => flags.reduced }));
const renderer = { setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() };
vi.mock('./renderer.js', () => ({ createRenderer: () => renderer }));

import GLCanvas from './GLCanvas.jsx';

const load = () => import('./scenes/plant.js');
const PAGE = 3000, VIEW = 800;

function scrollTo(y) {
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
}
/** Draw range (how much stem is visible) of the most recently rendered frame. */
function stemDrawn() {
  const calls = renderer.render.mock.calls;
  const scene = calls[calls.length - 1][0];
  const group = scene.children.find((c) => c.type === 'Group');
  return group.children[0].geometry.drawRange.count;
}
const settle = (ms = 60) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeEach(() => {
  Object.values(renderer).forEach((f) => f.mockClear());
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: PAGE, configurable: true });
  window.innerHeight = VIEW;
  window.scrollY = 0;
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb(); } disconnect() {} };
  globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb([{ isIntersecting: true }]); } disconnect() {} };
});

for (const reduced of [false, true]) {
  describe(`plant growth from real scrolling (reduced motion: ${reduced})`, () => {
    it('grows as the page scrolls down and shrinks back when scrolled up', async () => {
      flags.reduced = reduced;
      const { unmount } = render(<GLCanvas load={load} data={{}} className="h-[700px] w-[100px]" />);
      await waitFor(() => expect(renderer.render).toHaveBeenCalled());
      await settle();
      const top = stemDrawn();

      scrollTo((PAGE - VIEW) / 2);
      await settle(reduced ? 60 : 1200);                 // normal mode eases towards the target
      const mid = stemDrawn();

      scrollTo(PAGE - VIEW);
      await settle(reduced ? 60 : 1800);
      const bottom = stemDrawn();

      expect(mid).toBeGreaterThan(top * 2);
      expect(bottom).toBeGreaterThan(mid);

      scrollTo(0);
      await settle(reduced ? 60 : 1800);
      expect(stemDrawn()).toBeLessThan(mid);
      unmount();
    }, 15000);
  });
}

it('stops listening for scroll after unmount', async () => {
  flags.reduced = true;
  const add = vi.spyOn(window, 'addEventListener'), remove = vi.spyOn(window, 'removeEventListener');
  const { unmount } = render(<GLCanvas load={load} data={{}} className="h-[700px] w-[100px]" />);
  await waitFor(() => expect(renderer.render).toHaveBeenCalled());
  const added = add.mock.calls.filter(([t]) => t === 'scroll').length;
  expect(added).toBeGreaterThan(0);
  unmount();
  expect(remove.mock.calls.filter(([t]) => t === 'scroll').length).toBe(added);
});
