# Security

This is the public website for B's Supa Clean Cars LLC. It is a static site: it has no login, no database and
no server of its own, and it never touches the owner's computer.

## How it is protected
- **Browser wall (Content-Security-Policy):** every page tells the browser to run only its own scripts and to talk
  only to the booking form service and the first-party counter. Injected code can't run or send data elsewhere.
- **No secrets in the repo:** no keys, passwords or tokens are stored here (history was scanned). Payments happen on
  Stripe's own pages; the site never sees card details.
- **Counter backend:** the Cloudflare Worker only accepts events from this site's origin, rate-limits each visitor,
  stores no IP addresses or names, and honors Do Not Track.
- **Repo guardrails:** secret scanning with push protection, weekly dependency updates (Dependabot), CodeQL and
  `npm audit` on every change, and owner review required via CODEOWNERS.

## Reporting a problem
Email bssupacleancars@gmail.com with what you found and how to reproduce it. Please don't test against real
customers or payments. Reports are read as soon as possible.
