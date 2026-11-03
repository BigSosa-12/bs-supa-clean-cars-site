# B's Supa Clean Cars LLC — website

Static site (Vite + three.js) for B's Supa Clean Cars LLC, Battle Creek, MI.
Scroll-driven photo-ribbon hero adapted from the supplied Vante ribbon, with static fallbacks
(reduced motion, no WebGL, no JavaScript).

## Develop / build
    npm install
    npm run dev
    SITE_URL=https://your-domain.example npm run build   # outputs dist/

`SITE_URL` (or `siteUrl` in `site.config.json`) fills canonical/social URLs, `sitemap.xml` and `robots.txt`.
Deploy the contents of `dist/` to any static host over HTTPS.

## Switching features on — `site.config.json`
This file ships to the browser: never put secret keys in it.

| Key | Effect |
|---|---|
| `formEndpoint` | URL that accepts a JSON POST (Formspree, Web3Forms, a Worker, ...). Empty = request form is disabled with an honest notice. |
| `formAccessKey` | Public access key if the form service needs one (e.g. Web3Forms). |
| `phone`, `email` | Shown as tel:/mailto: links in the booking section and added to structured data. |
| `googleProfileUrl` | Shows a "Read all reviews on Google" button; added to structured data. |
| `reviews` | `[{ "text": "...", "author": "First L." }]` — only genuine, permitted excerpts. |
| `award.source` | Awarding organisation, once confirmed. |

## Payments
Each service's deposit button links to a Stripe-hosted payment link (see `index.html`, `#svc-*`).
No card data touches this site. A visit to Stripe or a payment does not confirm an appointment;
appointments are confirmed by the business after a request.

## Photos
`scripts/optimize-images.py` produces 480/800/1200px WebP files in `public/img/` from the originals.
