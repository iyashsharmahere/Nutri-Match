import GLCanvas from '../../gl/GLCanvas.jsx';

const load = () => import('../../gl/scenes/plant.js');

/** A tomato plant in the page margin. It grows as you scroll and ripens as you reach the bottom. */
export default function GrowingPlant() {
  return (
    <GLCanvas
      load={load}
      className="pointer-events-none fixed bottom-14 left-0 top-14 z-0 w-11 md:bottom-0 md:top-16 md:w-20 xl:w-28 no-print"
    />
  );
}
