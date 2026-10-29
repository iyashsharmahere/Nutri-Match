import { useEffect, useRef, useState } from 'react';
import { webglSupported, prefersReducedMotion } from './support.js';

/**
 * Hosts one three.js scene. `load` is a dynamic import of a scene module that
 * exports create(ctx) -> { scene, camera, update?, resize?, click?, dispose? }.
 *
 * Progressive enhancement: until the scene is ready (or if WebGL is missing)
 * the optional `fallback` is shown. Rendering pauses when off-screen or the tab
 * is hidden, and with reduced motion nothing animates on its own: frames are
 * drawn only in response to data changes, scrolling or dragging.
 */
// Tailwind emits `.relative` after `.fixed` / `.absolute`, so a hard-coded `relative` would silently
// override the caller's positioning. Only add it when the caller hasn't chosen one.
const POSITIONED = /(^|\s)(fixed|absolute|relative|sticky)(\s|$)/;

export default function GLCanvas({ load, data, className = '', label, interactive = false, fallback = null }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const dataRef = useRef(data);
  const invalidateRef = useRef(() => {});
  // Decided once, up front: no WebGL means the flat fallback from the very first render.
  const [state, setState] = useState(() => (webglSupported() ? 'loading' : 'failed'));

  useEffect(() => { dataRef.current = data; invalidateRef.current(); }, [data]);

  useEffect(() => {
    if (!webglSupported()) return undefined;
    let disposed = false, raf = 0, visible = true, renderer = null, scene = null, ro = null, io = null;
    const reduced = prefersReducedMotion();
    const input = { x: 0, y: 0, dragX: 0, dragY: 0, down: false };
    const el = wrap.current;
    const cleanups = [];

    const schedule = () => { if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(frame); };
    const invalidate = () => { if (reduced) schedule(); };
    invalidateRef.current = invalidate;
    let last = performance.now();

    function frame(now) {
      raf = 0;
      if (disposed || !scene) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.update?.(now / 1000, dt);
      renderer.render(scene.scene, scene.camera);
      if (!reduced) schedule();
    }

    (async () => {
      try {
        const [{ createRenderer }, mod] = await Promise.all([import('./renderer.js'), load()]);
        if (disposed) return;
        renderer = createRenderer(canvas.current);
        const ctx = { getData: () => dataRef.current, input, reduced, invalidate };
        scene = mod.create(ctx);

        const fit = () => {
          const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
          renderer.setSize(w, h, false);
          scene.resize?.(w, h);
          invalidate();
          schedule();
        };
        ro = new ResizeObserver(fit);
        ro.observe(el);
        fit();

        io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); schedule(); } });
        io.observe(el);
        const onVis = () => { if (!document.hidden) { last = performance.now(); schedule(); } };
        document.addEventListener('visibilitychange', onVis);
        cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

        if (interactive) {
          let sx = 0, sy = 0, moved = 0;
          const ndc = (e) => {
            const r = el.getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
          };
          const down = (e) => { input.down = true; sx = e.clientX; sy = e.clientY; moved = 0; el.setPointerCapture?.(e.pointerId); };
          const move = (e) => {
            const p = ndc(e);
            input.x = p.x; input.y = p.y;
            if (input.down) {
              input.dragX += (e.clientX - sx) * 0.008; input.dragY += (e.clientY - sy) * 0.008;
              moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
              sx = e.clientX; sy = e.clientY;
            }
            scene.hover?.(p);
            invalidate();
          };
          const up = (e) => { input.down = false; if (moved < 6) scene.click?.(ndc(e)); invalidate(); };
          const leave = () => { input.down = false; input.x = 0; input.y = 0; scene.hover?.(null); invalidate(); };
          el.addEventListener('pointerdown', down);
          el.addEventListener('pointermove', move);
          el.addEventListener('pointerup', up);
          el.addEventListener('pointerleave', leave);
          cleanups.push(() => {
            el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up); el.removeEventListener('pointerleave', leave);
          });
        }
        setState('ready');
        schedule();
      } catch (err) {
        console.warn('3D scene unavailable, using the flat version:', err);
        setState('failed');
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect(); io?.disconnect();
      cleanups.forEach((fn) => fn());
      scene?.dispose?.();
      renderer?.dispose();
      renderer?.forceContextLoss?.();
      invalidateRef.current = () => {};
    };
  }, [load, interactive]);

  return (
    <div
      ref={wrap}
      className={`${POSITIONED.test(className) ? '' : 'relative '}${className}`}
      style={interactive ? { touchAction: 'pan-y', cursor: 'grab' } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas ref={canvas} className={`block h-full w-full transition-opacity duration-700 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`} />
      {state !== 'ready' && fallback && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}
