# Analytics Worker (visit + button counter)

Counts visits and taps on Call, Text, Pay-deposit, Book and Request buttons. Stores no names, IPs or cookies.
The dashboard is `owner.html` on the site (linked by a tiny "Owner" link in the footer, marked noindex).

## One-time setup (about 5 minutes, free Cloudflare plan is enough)

```bash
cd worker
npx wrangler login
npx wrangler d1 create bs-supa-analytics          # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute bs-supa-analytics --remote --file=schema.sql
npx wrangler deploy                                # prints https://bs-supa-analytics.<you>.workers.dev
```

Then put that URL in `site.config.json` as `"analyticsEndpoint"`, rebuild and redeploy the site.
`ALLOWED_ORIGINS` in `wrangler.toml` must list the site's origin (and your custom domain if you add one).

## Notes
- Deposit clicks are button taps (intent). Completed payments live in your Stripe dashboard.
- The stats endpoint is public by design (counts only, no personal data). Add a PIN later if you want it private.
