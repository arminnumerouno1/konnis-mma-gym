# KONNI MMA GYM — Leipzig

Immersive 3D scroll experience for KONNI MMA GYM — the MMA gym of MMA professional Konrad Dyrschka in Leipzig. The page is a single camera move through the gym: blackout intro, cage, disciplines, the Völkerschlachtdenkmal, trailer end card.

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

## Waitlist

The finale has a waitlist form for opening and location updates. It posts to `/api/waitlist`. In `npm run dev` and `npm run preview` Vite serves that route. After `npm run build`, `npm start` serves `dist/` plus the same API.

Without mail credentials, signups are stored in `data/waitlist.json` (gitignored). List them with:

```bash
npm run waitlist:list
```

Do **not** send the newsletters from a private Gmail account. For Germany, use double opt-in and a proper sender. The intended setup is [Brevo](https://www.brevo.com) (EU, GDPR, German UI).

1. Create a free account: [app.brevo.com/account/register](https://app.brevo.com/account/register) (use `info@mma-in-leipzig.de` and confirm the mail).
2. Create an API key: [app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api). Put it in `.env` as `BREVO_API_KEY` (never `VITE_`).
3. Run `npm run waitlist:brevo`. That checks the account, creates the list **KONNI MMA GYM Warteliste**, and writes `BREVO_LIST_ID`.
4. Confirm the sender `info@mma-in-leipzig.de` in Brevo if you want real outbound mail.
5. Optional: a double-opt-in template id as `BREVO_DOI_TEMPLATE_ID`.
6. When the location or opening date is ready, send a **campaign** to that list from Brevo. That is how everyone on the list gets the same update, including unsubscribe.

The live site is on Vercel. The form needs the serverless route in `api/waitlist.js` **and** these project environment variables (Production + Preview):

- `BREVO_API_KEY`
- `BREVO_LIST_ID` (`3` for the current KONNI list)
- `VITE_SITE_URL=https://mma-in-leipzig.de` (build-time, for canonical/OG URLs)

Without those keys the live form cannot reach Brevo. Set them in Vercel → Project → Settings → Environment Variables, then redeploy.

The live host must be able to run the Node API. A static-only upload of `dist/` will make the form fail. `npm start` is the production shape on a VPS: static files plus `/api/waitlist`.

## How it works

Scroll drives camera position, look-target, FOV, lights, and fog. There is no autoplay against the user. Desktop uses a full lighting and post-process pass. Mobile and weaker GPUs drop particles, lights, and effects automatically. On narrow screens and in the Handy-Ansicht, slogans switch from 3D type to large HTML captions sized to the stage, not the desktop window. `prefers-reduced-motion` freezes the camera and shows the same copy as a readable page.

## Brand

The KONNI MMA GYM emblem is the original artwork, extracted from the designer PDF (a 1254×1254 Photoshop raster, not a vector file) into a transparent PNG. The 3D intro renders that PNG without mipmaps and at up to 2× device pixel ratio so it stays sharp on phones. True infinitely sharp edges would need an AI, EPS, or SVG from the designer. The Leipzig beat is a 3D Völkerschlachtdenkmal — mound, staircase, granite hall, bell dome, and the twelve guardians — not a generic skyline.
