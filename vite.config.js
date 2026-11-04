import { defineConfig } from 'vite';
import fs from 'node:fs';
import { resolve } from 'node:path';

const cfg = JSON.parse(fs.readFileSync('./site.config.json', 'utf8'));
const siteUrl = (process.env.SITE_URL || cfg.siteUrl || '').replace(/\/$/, '');
const NAME = "B's Supa Clean Cars LLC";
const DESC =
  "Mobile interior car and SUV detailing in Battle Creek, Michigan and the surrounding 30-mile area. Clear prices, Stripe-secured deposits, and request-a-time booking. Open daily 9:30 am to 9 pm.";

const offers = [
  ['Standard Service', 150], ['Deep Clean Package', 185], ['Supa Clean Package', 225],
  ['SUV Standard Service', 175], ['SUV Deep Clean Package', 225], ['SUV Supa Clean Package', 250],
].map(([name, price]) => ({
  '@type': 'Offer', priceCurrency: 'USD', price: String(price),
  itemOffered: { '@type': 'Service', name },
}));

const jsonld = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: NAME,
  description: DESC,
  founder: { '@type': 'Person', name: 'Brian Battle' },
  address: { '@type': 'PostalAddress', addressLocality: 'Battle Creek', addressRegion: 'MI', addressCountry: 'US' },
  areaServed: {
    '@type': 'GeoCircle',
    geoMidpoint: { '@type': 'GeoCoordinates', latitude: 42.3212, longitude: -85.1797 },
    geoRadius: 48280,
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    opens: '09:30',
    closes: '21:00',
  },
  award: `${cfg.award.title}, ${cfg.award.place}, ${cfg.award.category}`,
  makesOffer: offers,
  ...(siteUrl && { url: siteUrl + '/', image: siteUrl + '/og-image.jpg' }),
  ...(cfg.phone && { telephone: '+1' + cfg.phone.replace(/\D/g, '').slice(-10) }),
  ...(cfg.email && { email: cfg.email }),
  ...((cfg.googleProfileUrl || cfg.facebookUrl) && { sameAs: [cfg.googleProfileUrl, cfg.facebookUrl].filter(Boolean) }),
};

const head = (page) =>
  siteUrl
    ? `<link rel="canonical" href="${siteUrl}/${page}">
    <meta property="og:url" content="${siteUrl}/${page}">
    <meta property="og:image" content="${siteUrl}/og-image.jpg">
    <meta name="twitter:image" content="${siteUrl}/og-image.jpg">`
    : '';

function sitePlugin() {
  return {
    name: 'site-tokens',
    transformIndexHtml(html, ctx) {
      const page = ctx.filename.endsWith('index.html') ? '' : ctx.path.replace(/^\//, '');
      return html
        .replace('<!--SEO-->', head(page))
        .replace('<!--JSONLD-->', page === '' ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : '');
    },
    generateBundle() {
      this.emitFile({
        type: 'asset', fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`,
      });
      if (siteUrl) {
        const urls = ['', 'privacy.html', 'terms.html']
          .map((p) => `  <url><loc>${siteUrl}/${p}</loc></url>`).join('\n');
        this.emitFile({
          type: 'asset', fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [sitePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
      },
    },
  },
});
