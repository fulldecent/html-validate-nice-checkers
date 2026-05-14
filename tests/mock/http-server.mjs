/**
 * Standalone mock HTTP server script.
 *
 * This is intentionally plain ESM JavaScript so the child process can run it
 * with `yarn node` in a Yarn PnP environment without depending on `tsx`.
 */

import { mockhttp } from '@jaredwray/mockhttp'

const server = new mockhttp({
  port: 9876,
  autoDetectPort: false,
  rateLimit: false,
})

await server.start()

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

process.stdout.write(`READY:${server.port}\n`)

process.on('SIGTERM', async () => {
  await server.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
