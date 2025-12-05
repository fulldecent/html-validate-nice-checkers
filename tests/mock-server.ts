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
