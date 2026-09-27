# KONNI MMA GYM — Leipzig

Website für KONNI MMA GYM: Studio, Tarife, Online-Mitgliedschaft mit Vertrag, AGB, Widerruf und Hausordnung.

Gebaut mit React, Vite, GSAP ScrollTrigger und Lenis. Logo und Konrad-Foto bleiben die Original-Assets.

## Lokal starten

```bash
npm install
npm run dev
```

Öffnet [http://127.0.0.1:43177](http://127.0.0.1:43177).

```bash
npm run build
npm run preview
npm test
```

## Mitgliedschaft

Das Formular unter `/mitglied` schreibt nach `/api/mitglied`. Pflichtfelder kommen aus den Verträgen (12/24 Monate), plus Day Pass.

Ohne Mail-Zugang liegen Anträge in `data/memberships.json` (gitignored). Liste:

```bash
npm run mitglied:list
```

Tarife:

- Standard — 99,99 € / Monat, 24 Monate
- Flex — 109,99 € / Monat, 12 Monate
- Day Pass — 19,99 € / Tag

Zahlung laut 12- und 24-Monats-Vertrag per SEPA-Lastschrift, in der Regel zum 1. des Monats. Zahlungspflicht erst ab echter Eröffnung.

Live auf Vercel braucht `api/mitglied.js`. Optional dieselben Brevo-Variablen wie die alte Warteliste.

## Rechtstexte

AGB, Impressum und Datenschutz stehen als Seiten. Als PDF liegt nur die Widerrufsbelehrung:

- `public/legal/widerrufsbelehrung.pdf` — Stand 27. September 2026

Anbieter: KONNI MMA GYM GbR, Konrad Dyrschka und Mehmet-Deniz Celik, Wittenberger Straße 15, 04129 Leipzig, info@mma-in-leipzig.de.

## SEO

Titel, Snippet und Open Graph stehen in `src/brand/seo.ts`. Share-Bild: `public/og-image.jpg`.

```bash
VITE_SITE_URL=https://www.example.com npm run build
```
