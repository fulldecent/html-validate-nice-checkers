import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'

const base = 'http://localhost:9876'
let proc: ChildProcess | null = null

async function fetchWithStatus(path: string) {
  const res = await fetch(`${base}${path}`)
  const text = await res.text()
  return { status: res.status, body: text, headers: res.headers }
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    proc = spawn('yarn', ['tsx', 'tests/mock/http-server.ts'])
    const timeout = setTimeout(() => reject(new Error('mock server start timeout')), 5000)
    proc.stdout?.on('data', (data: unknown) => {
      const str = String(data)
      if (str.includes('READY:9876')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    proc.on('exit', (code: number | null) => {
      if (code && code !== 0) reject(new Error(`mock server exited ${code}`))
    })
  })
}

function stopServer(): Promise<void> {
  return new Promise(resolve => {
    if (!proc) return resolve()
    proc.kill()
    proc.on('exit', () => resolve())
    proc = null
  })
}

describe('mock server validation against PLAN.md', () => {
  beforeAll(async () => {
    await startServer()
  })

  afterAll(async () => {
    await stopServer()
  })

  describe('built-in httpbin routes', () => {
    it('GET /status/200 returns 200', async () => {
      const { status } = await fetchWithStatus('/status/200')
      expect(status).toBe(200)
    })

    it('GET /status/404 returns 404', async () => {
      const { status } = await fetchWithStatus('/status/404')
      expect(status).toBe(404)
    })

    it('GET /status/400 returns 400', async () => {
      const { status } = await fetchWithStatus('/status/400')
      expect(status).toBe(400)
    })

    it('GET /status/500 returns 500', async () => {
      const { status } = await fetchWithStatus('/status/500')
      expect(status).toBe(500)
    })

    it('GET /status/200/page-that-is-404-that-happens-to-have-status-200-prefix returns 404', async () => {
      const { status } = await fetchWithStatus(
        '/status/200/page-that-is-404-that-happens-to-have-status-200-prefix'
      )
      expect(status).toBe(404)
    })

    it('GET /redirect-to redirects and returns 200 final', async () => {
      const res = await fetch(
        `${base}/redirect-to?url=http%3A%2F%2Flocalhost%3A9876%2Fstatus%2F200&status_code=301`
      )
      expect(res.status).toBe(200)
    })
  })

  describe('custom taps (alternate language)', () => {
    it('GET /fr/alt-to-fr returns 200 with html body', async () => {
      const { status, body } = await fetchWithStatus('/fr/alt-to-fr')
      expect(status).toBe(200)
      expect(body.length).toBeGreaterThan(40)
      expect(body).toContain('html')
    })

    it('GET /en/alt-to-en-fr returns 200 with html and reciprocal to fr', async () => {
      const { status, body } = await fetchWithStatus('/en/alt-to-en-fr')
      expect(status).toBe(200)
      expect(body).toContain('hreflang="fr"')
      expect(body).toContain('http://localhost:9876/fr/alt-to-fr-en')
    })

    it('GET /fr/alt-to-fr-en returns 200 with html and reciprocal to en', async () => {
      const { status, body } = await fetchWithStatus('/fr/alt-to-fr-en')
      expect(status).toBe(200)
      expect(body).toContain('hreflang="en"')
      expect(body).toContain('http://localhost:9876/en/alt-to-en-fr')
    })

    it('GET /en/alt-relative-to-en returns 200 with relative href', async () => {
      const { status, body } = await fetchWithStatus('/en/alt-relative-to-en')
      expect(status).toBe(200)
      expect(body).toContain('/en/alt-relative-to-en')
    })

    it('GET /en/alt-to-self-as-es returns 200 with hreflang es mismatch', async () => {
      const { status, body } = await fetchWithStatus('/en/alt-to-self-as-es')
      expect(status).toBe(200)
      expect(body).toContain('hreflang="es"')
    })

    it('GET /en/alt-to-en returns 200 self link', async () => {
      const { status, body } = await fetchWithStatus('/en/alt-to-en')
      expect(status).toBe(200)
      expect(body).toContain('hreflang="en"')
    })

    it('GET /es/alt-to-es-en returns 200 with reciprocal to en', async () => {
      const { status, body } = await fetchWithStatus('/es/alt-to-es-en')
      expect(status).toBe(200)
      expect(body).toContain('hreflang="en"')
      expect(body).toContain('http://localhost:9876/en/alt-to-en')
    })
  })

  describe('external links rule fixtures', () => {
    it('GET /status/200 returns 200 for external link validation', async () => {
      const { status } = await fetchWithStatus('/status/200')
      expect(status).toBe(200)
    })

    it('GET /status/400 returns 400 for external link validation', async () => {
      const { status } = await fetchWithStatus('/status/400')
      expect(status).toBe(400)
    })

    it('GET /status/500 returns 500 for external link validation', async () => {
      const { status } = await fetchWithStatus('/status/500')
      expect(status).toBe(500)
    })
  })

  describe('https links rule', () => {
    it('GET /status/200 available for https test', async () => {
      const { status } = await fetchWithStatus('/status/200')
      expect(status).toBe(200)
    })
  })
})
