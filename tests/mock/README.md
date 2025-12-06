# Mock HTTP server routes

The mock HTTP server shall supports the following routes and behaviors for testing purposes:

## Mock routes

- built-in httpbin routes
  - `http://localhost:9876/status/200` → 200, minimal body ok
  - `http://localhost:9876/status/404` → 404, empty body ok
  - `http://localhost:9876/status/400` → 400, empty body ok
  - `http://localhost:9876/status/500` → 500, empty body ok
  - `http://localhost:9876/redirect-to?url=http%3A%2F%2Flocalhost%3A9876%2Fstatus%2F200&status_code=301` → 301 then 200 final
  - `http://localhost:9876/status/200/page-that-is-404-that-happens-to-have-status-200-prefix` → 404 (not tapped)

- custom taps (must return html bodies)
  - `http://localhost:9876/fr/alt-to-fr` → 200; no reciprocal link back to en
  - `http://localhost:9876/en/alt-to-en-fr` → 200; has reciprocal link to fr page
  - `http://localhost:9876/fr/alt-to-fr-en` → 200; has reciprocal link to en canonical

- alternate language fixtures expectations
  - `http://localhost:9876/status/404` → 404; other page is flagged for linking to this page which does not link back
  - `http://localhost:9876/en/alt-relative-to-en` → 200; has alt link to en (/en/alt-relative-to-en); flagged for relative href
  - `http://localhost:9876/en/alt-to-self-as-es` → 200; link to es (.../es/alt-to-self-as-es); flagged for hreflang mismatch
  - `http://localhost:9876/en/alt-to-en` → 200; link to en (.../en/alt-to-en)
  - `http://localhost:9876/en/alt-to-en-fr` → 200; has alt link to en, fr (.../fr/alt-to-fr-en)
  - `http://localhost:9876/fr/alt-to-fr-en` → 200; has alt link to fr, en (.../en/alt-to-en-fr)
  - `http://localhost:9876/es/alt-to-es-en` → 200; has alt link to es, en (.../en/alt-to-en); flagged for missing reciprocal link back from en

- external link rule fixtures
  - `http://localhost:9876/status/200` → 200
  - `http://localhost:9876/status/400` → 400
  - `http://localhost:9876/status/500` → 500
  - `http://localhost:9876/redirect-to?url=http%3A%2F%2Flocalhost%3A9876%2Fstatus%2F200&status_code=301` → 301 redirect then 200 final
  - `http://localhost:9876/status/200/page-that-is-404-that-happens-to-have-status-200-prefix` → 404 (not tapped)

- https links rule
  - `http://localhost:9876/status/200` → 200; no https upgrade available (mock has no tls)

## Other routes

FYI, here are all the other URLs accessed during tests, but which are not on the mock server:

- external link rule fixtures
  - `https://----.invalid.test` → fetch fails
  - `https://-..-..-.-.-` → fetch fails
  - `http://site.invalid/url-is-skipped-by-regex-and-never-checked` → skipped by regex config
  - `http://site.invalid/url-is-accepted-as-existing-and-never-checked` (manually reviewed) → approved without fetch
  - `https://x.com/...`, `https://www.linkedin.com/...`, `https://dont-check-this.invalid/page` → skipped by regex config

- cdn assets
  - `https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/js/bootstrap.min.js` → 200
  - `https://code.jquery.com/jquery-3.7.1.min.js` → 200
  - `https://data.jsdelivr.com/v1/package/npm/bootstrap` → JSON with some `$.tags.*` set to `5.3.8`
