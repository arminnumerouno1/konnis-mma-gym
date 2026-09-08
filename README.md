# KONNI'S MMA GYM — Leipzig

Immersive 3D scroll experience for KONNI'S MMA GYM. The page is a single camera move through an underground fight space: blackout intro, gym, disciplines, Leipzig skyline, trailer end card.

Built with React, Three.js, React Three Fiber, Drei, GSAP ScrollTrigger, and Lenis.

## Run locally

```bash
npm install
npm run dev
```

Opens at [http://127.0.0.1:43177](http://127.0.0.1:43177).

```bash
npm run build
npm run preview
```

## How it works

Scroll drives camera position, look-target, FOV, lights, and fog. There is no autoplay against the user. Desktop uses a full lighting and post-process pass. Mobile and weaker GPUs drop particles, lights, and effects automatically. `prefers-reduced-motion` freezes the camera and shows the same copy as a readable page.

## Brand

The octagon emblem is drawn from a shared Leipzig skyline profile so the 3D city matches the metal plate. The logo graphic stays intact — it is staged as a physical object, not redesigned in 3D.
