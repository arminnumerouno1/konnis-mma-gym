# KONNI'S MMA GYM — Leipzig

Immersive 3D scroll experience for KONNI'S MMA GYM. The page is a single camera move through an underground fight space: blackout intro, gym, disciplines, the Völkerschlachtdenkmal in Leipzig, trailer end card.

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

## Share preview and SEO

Tab title, Google snippet, and Open-Graph/Twitter cards are defined in `src/brand/seo.ts`. The share image is `public/og-image.jpg` (1200×630).

For a live domain, set the public URL (no trailing slash) so Canonical, `og:url`, and `sitemap.xml` become absolute:

```bash
VITE_SITE_URL=https://www.example.com npm run build
```

Copy `.env.example` to `.env` if you want that URL during local `npm run dev`. After launch, add the sitemap line in `public/robots.txt`.

## How it works

Scroll drives camera position, look-target, FOV, lights, and fog. There is no autoplay against the user. Desktop uses a full lighting and post-process pass. Mobile and weaker GPUs drop particles, lights, and effects automatically. On narrow screens and in the Handy-Ansicht, slogans switch from 3D type to large HTML captions sized to the stage, not the desktop window. `prefers-reduced-motion` freezes the camera and shows the same copy as a readable page.

## Brand

The original KONNI'S MMA GYM emblem (bear, crossed swords, octagon, Leipzig skyline) is staged as a thick metal plate. The artwork is not redrawn. The Leipzig beat is a 3D Völkerschlachtdenkmal — mound, staircase, granite hall, bell dome, and the twelve guardians — not a generic skyline.
