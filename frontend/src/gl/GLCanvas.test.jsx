// Lifecycle tests for the GLCanvas glue, using a fake renderer and fake scene (no GPU needed).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

const flags = { reduced: false };
vi.mock('./support.js', () => ({ webglSupported: () => true, prefersReducedMotion: () => flags.reduced }));

const renderer = { setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() };
vi.mock('./renderer.js', () => ({ createRenderer: () => renderer }));

import GLCanvas from './GLCanvas.jsx';

let scene, ctxSeen, loadFn;
const makeLoad = () => async () => ({
  create(ctx) {
    ctxSeen = ctx;
    scene = { scene: {}, camera: {}, update: vi.fn(), resize: vi.fn(), click: vi.fn(), hover: vi.fn(), dispose: vi.fn() };
    return scene;
  },
});

beforeEach(() => {
  flags.reduced = false;
  Object.values(renderer).forEach((f) => f.mockClear());
  globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb(); } disconnect() {} };
  globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb([{ isIntersecting: true }]); } disconnect() {} };
  loadFn = makeLoad();
});
afterEach(() => vi.restoreAllMocks());

const pointer = (el, type, x, y) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
const sized = (el) => { el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }); };

describe('GLCanvas', () => {
  it('loads the scene, renders frames, hides the fallback and cleans up on unmount', async () => {
    const { container, unmount } = render(<GLCanvas load={loadFn} data={{ a: 1 }} fallback={<p>flat version</p>} />);
    expect(screen.getByText('flat version')).toBeTruthy();                         // shown while loading
    await waitFor(() => expect(container.querySelector('canvas').className).toMatch(/opacity-100/));
    expect(screen.queryByText('flat version')).toBeNull();
    await waitFor(() => expect(renderer.render.mock.calls.length).toBeGreaterThan(2)); // continuous loop
    expect(scene.update).toHaveBeenCalled();
    expect(scene.resize).toHaveBeenCalled();
    expect(ctxSeen.getData()).toEqual({ a: 1 });

    unmount();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    const n = renderer.render.mock.calls.length;
    await new Promise((r) => setTimeout(r, 80));
    expect(renderer.render.mock.calls.length).toBe(n);                              // loop really stopped
  });

  it('serves the newest data to the scene without remounting it', async () => {
    const { rerender } = render(<GLCanvas load={loadFn} data={{ v: 1 }} />);
    await waitFor(() => expect(ctxSeen).toBeTruthy());
    const first = scene;
    rerender(<GLCanvas load={loadFn} data={{ v: 2 }} />);
    expect(ctxSeen.getData()).toEqual({ v: 2 });
    expect(scene).toBe(first);                       // same scene instance, not rebuilt
    expect(first.dispose).not.toHaveBeenCalled();
  });

  it('with reduced motion nothing animates by itself; data changes and drags redraw', async () => {
    flags.reduced = true;
    const { container, rerender } = render(<GLCanvas load={loadFn} data={{ v: 1 }} interactive />);
    await waitFor(() => expect(container.querySelector('canvas').className).toMatch(/opacity-100/));
    await new Promise((r) => setTimeout(r, 60));
    const idle = renderer.render.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(renderer.render.mock.calls.length).toBe(idle);                           // no autonomous frames
    rerender(<GLCanvas load={loadFn} data={{ v: 2 }} interactive />);
    await waitFor(() => expect(renderer.render.mock.calls.length).toBeGreaterThan(idle));
    expect(ctxSeen.reduced).toBe(true);
  });

  it('turns dragging into rotation input and a still tap into a click', async () => {
    const { container } = render(<GLCanvas load={loadFn} data={{}} interactive />);
    await waitFor(() => expect(scene).toBeTruthy());
    const el = container.firstChild; sized(el);

    await act(async () => { pointer(el, 'pointerdown', 100, 50); pointer(el, 'pointermove', 140, 50); pointer(el, 'pointerup', 140, 50); });
    expect(ctxSeen.input.dragX).toBeCloseTo(40 * 0.008, 5);
    expect(scene.click).not.toHaveBeenCalled();                                     // it was a drag, not a click

    await act(async () => { pointer(el, 'pointerdown', 150, 20); pointer(el, 'pointerup', 150, 20); });
    expect(scene.click).toHaveBeenCalledTimes(1);
    const { x, y } = scene.click.mock.calls[0][0];
    expect(x).toBeCloseTo(0.5); expect(y).toBeCloseTo(0.6);                         // (150/200)*2-1, -((20/100)*2-1)
  });

  it('is not interactive unless asked', async () => {
    const { container } = render(<GLCanvas load={loadFn} data={{}} />);
    await waitFor(() => expect(scene).toBeTruthy());
    const el = container.firstChild; sized(el);
    await act(async () => { pointer(el, 'pointerdown', 10, 10); pointer(el, 'pointerup', 10, 10); });
    expect(scene.click).not.toHaveBeenCalled();
    expect(el.style.cursor).toBe('');
  });

  it('keeps the flat fallback if the 3D scene fails to load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = async () => { throw new Error('chunk failed'); };
    render(<GLCanvas load={failing} data={{}} fallback={<p>flat version</p>} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.getByText('flat version')).toBeTruthy();
  });

  it('never lets its own `relative` override the caller\'s positioning (fixed plant, absolute dial)', () => {
    const cls = (c) => render(<GLCanvas load={loadFn} data={{}} className={c} />).container.firstChild.className.split(/\s+/);
    for (const pos of ['fixed', 'absolute', 'sticky']) {
      const c = cls(`${pos} inset-0`);
      expect(c).toContain(pos); expect(c).not.toContain('relative');
    }
    expect(cls('h-10 w-10')).toContain('relative');           // default: positioned, so fallbacks can overlay
    expect(cls('relative h-10').filter((x) => x === 'relative').length).toBe(1);
  });
});
