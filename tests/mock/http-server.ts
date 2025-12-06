/**
 * Standalone mock HTTP server script
 *
 * This script runs the mock server in its own process, avoiding event loop
 * deadlock with html-validate's synchronous HTTP requests.
 *
 * The mockhttp package provides httpbin-compatible routes out of the box:
 * - /status/XXX - returns that HTTP status code
 * - /redirect-to?url=...&status_code=301 - performs redirects
 * See https://github.com/jaredwray/mockhttp for full documentation.
 */

import { mockhttp } from '@jaredwray/mockhttp'

const server = new mockhttp({
  port: 9876,
  autoDetectPort: false,
  rateLimit: false,
})

await server.start()

// Inject custom responses for AlternateLanguageLinksRule tests
// Page that does NOT have reciprocal link back (for violation test)
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="fr">
<head>
  <title>French page without reciprocal</title>
  <link rel="canonical" href="http://localhost:9876/fr/alt-to-fr" />
  <!-- Missing reciprocal link to English page -->
</head>
<body><p>This page does not link back to the English version.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/fr/alt-to-fr' }
)

// Page that does NOT have reciprocal link back (for violation test)
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="en">
<head>
  <title>English page without reciprocal to Spanish</title>
  <link rel="canonical" href="http://localhost:9876/en/alt-to-en" />
  <link rel="alternate" hreflang="en" href="http://localhost:9876/en/alt-to-en" />
  <!-- Missing reciprocal link to Spanish page -->
</head>
<body><p>This page does not link back to the Spanish version.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/en/alt-to-en' }
)

// Page with relative href test
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="en">
<head>
  <title>English page with relative alternate link</title>
  <link rel="canonical" href="http://localhost:9876/en/alt-relative-to-en" />
  <link rel="alternate" hreflang="en" href="http://localhost:9876/en/alt-relative-to-en" />
  <link rel="alternate" hreflang="en" href="/en/alt-relative-to-en" />
</head>
<body><p>This page has a relative alternate link.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/en/alt-relative-to-en' }
)

// Page with hreflang mismatch test
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="en">
<head>
  <title>English page with hreflang mismatch</title>
  <link rel="canonical" href="http://localhost:9876/en/alt-to-self-as-es" />
  <link rel="alternate" hreflang="es" href="http://localhost:9876/en/alt-to-self-as-es" />
</head>
<body><p>This page links to itself with wrong hreflang.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/en/alt-to-self-as-es' }
)

// Page with reciprocal link to FR
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="en">
<head>
  <title>English page with reciprocal to French</title>
  <link rel="canonical" href="http://localhost:9876/en/alt-to-en-fr" />
  <link rel="alternate" hreflang="en" href="http://localhost:9876/en/alt-to-en-fr" />
  <link rel="alternate" hreflang="fr" href="http://localhost:9876/fr/alt-to-fr-en" />
</head>
<body><p>This page correctly links back to the French version.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/en/alt-to-en-fr' }
)

// Generic accessible French page with reciprocal back to English
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="fr">
<head>
  <title>French page with reciprocal to English</title>
  <link rel="canonical" href="http://localhost:9876/fr/alt-to-fr-en" />
  <link rel="alternate" hreflang="fr" href="http://localhost:9876/fr/alt-to-fr-en" />
  <link rel="alternate" hreflang="en" href="http://localhost:9876/en/alt-to-en-fr" />
</head>
<body><p>Accessible French page with reciprocal link.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/fr/alt-to-fr-en' }
)

// Spanish page with link to English (but English doesn't reciprocate)
server.taps.inject(
  {
    response: `<!doctype html>
<html lang="es">
<head>
  <title>Spanish page with link to English</title>
  <link rel="canonical" href="http://localhost:9876/es/alt-to-es-en" />
  <link rel="alternate" hreflang="es" href="http://localhost:9876/es/alt-to-es-en" />
  <link rel="alternate" hreflang="en" href="http://localhost:9876/en/alt-to-en" />
</head>
<body><p>This page links to English, but English doesn't link back.</p></body>
</html>`,
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
  },
  { url: '/es/alt-to-es-en' }
)

// Use stdout.write to ensure immediate flush when piped
process.stdout.write(`READY:${server.port}\n`)

// Keep the process running until killed
process.on('SIGTERM', async () => {
  await server.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
