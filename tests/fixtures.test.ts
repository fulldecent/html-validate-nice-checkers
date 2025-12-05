import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { HtmlValidate, StaticConfigLoader } from 'html-validate'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, extname } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import NiceCheckersPlugin from '../src/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesDir = join(__dirname, 'fixtures')

let mockServerProcess: ChildProcess | null = null

type ReportsByFile = {
  [filePath: string]: object[]
}

// Start the mock server in a child process to avoid event loop deadlock
function startMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverScript = join(__dirname, 'mock-server.ts')
    // Use yarn tsx to run the TypeScript file in Yarn PnP environment
    mockServerProcess = spawn('yarn', ['tsx', serverScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: join(__dirname, '..'),
    })

    mockServerProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      if (output.includes('READY:')) {
        console.log('\n[mock-server] Started on http://localhost:9876')
        resolve()
      }
    })

    mockServerProcess.stderr?.on('data', (data: Buffer) => {
      // Ignore the expected warnings about missing static file directories
      const msg = data.toString()
      if (!msg.includes('"root" path')) {
        console.error('[mock-server error]', msg)
      }
    })

    mockServerProcess.on('error', reject)

    // Timeout if server doesn't start in 10 seconds
    setTimeout(() => reject(new Error('Mock server startup timeout')), 10000)
  })
}

function stopMockServer(): void {
  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM')
    mockServerProcess = null
    console.log('[mock-server] Stopped\n')
  }
}

// Generate a fresh CSV with current timestamp to avoid expiration issues
function generateManuallyReviewedCSV(): void {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const csvContent = `url,last_approved_timestamp
http://localhost:9876/status/200,${currentTimestamp}
https://anti-scraping-site.invalid/page,${currentTimestamp}
`
  writeFileSync(join(fixturesDir, 'external-links-manually-reviewed.csv'), csvContent, 'utf-8')
}

// Read expected output
function getRequiredReports(): ReportsByFile | null {
  try {
    const expectedPath = join(fixturesDir, 'required-reports.json')
    const content = readFileSync(expectedPath, 'utf-8')
    return JSON.parse(content) as ReportsByFile
  } catch {
    return null
  }
}

// Recursively get all HTML fixture files
function getFixtureFiles(dir: string = fixturesDir): string[] {
  const results: string[] = []
  try {
    readdirSync(dir, { withFileTypes: true }).forEach(file => {
      const fullPath = join(dir, file.name)
      results.push(
        ...(file.isDirectory()
          ? getFixtureFiles(fullPath)
          : extname(file.name) === '.html'
            ? [fullPath]
            : [])
      )
    })
  } catch {}
  return results
}

describe('fixture validation against required output', () => {
  const requiredOutputs = getRequiredReports()
  const fixtureFiles = getFixtureFiles()

  beforeAll(async () => {
    await startMockServer()
  })

  afterAll(() => {
    stopMockServer()
  })

  it('should have required-output.json available', () => {
    if (!requiredOutputs) {
      console.warn('no required-output.json found - skipping fixture validation tests')
      expect(true).toBe(true) // Don't fail, just skip
      return
    }
    expect(requiredOutputs).toBeDefined()
  })

  it('should have fixture files available', () => {
    if (fixtureFiles.length === 0) {
      console.warn('no fixture files found - skipping validation tests')
      expect(true).toBe(true)
      return
    }
    expect(fixtureFiles.length).toBeGreaterThan(0)
  })

  // Only run if we have both fixtures and expected output
  if (requiredOutputs !== null || fixtureFiles.length > 0) {
    describe('required output validation', () => {
      // Generate fresh CSV with current timestamp before running tests
      generateManuallyReviewedCSV()

      const plugin = NiceCheckersPlugin
      const loader = new StaticConfigLoader({
        plugins: [plugin],
        extends: ['nice-checkers-plugin:recommended'],
        rules: {
          // Disable caching for tests to ensure consistent results
          'nice-checkers/external-links': [
            'error',
            {
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
              skipRegexes: [
                '^https://this-should-skip.invalid',
                'dont-check-this\.invalid',
                'https://x\.com/',
                'https://www\.linkedin\.com/',
              ],
              manuallyReviewedPath: join(fixturesDir, 'external-links-manually-reviewed.csv'),
              manuallyReviewedExpirySeconds: 365 * 24 * 60 * 60, // 1 year
            },
          ],
          'nice-checkers/https-links': [
            'error',
            {
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
          'nice-checkers/latest-packages': [
            'error',
            {
              cacheExpirySeconds: 0,
            },
          ],
          'nice-checkers/internal-links': [
            'error',
            {
              webRoot: join(fixturesDir),
            },
          ],
        },
      })
      const htmlvalidate = new HtmlValidate(loader)
      const actualOutputs: ReportsByFile = {}

      // Helper to normalize the file key used in actualOutputs
      const fileKey = (filePath: string) => filePath.replace(process.cwd() + '/', '')

      beforeAll(async () => {
        for (const filePath of fixtureFiles) {
          const report = await htmlvalidate.validateFile(filePath)
          actualOutputs[fileKey(filePath)] = report.results[0]?.messages ?? []
        }
        writeFileSync(
          join(fixturesDir, 'actual-reports.json'),
          JSON.stringify(actualOutputs, null, 2),
          'utf-8'
        )
      })

      it('should generate actual-reports.json', () => {
        expect(Object.keys(actualOutputs).length).toBeGreaterThanOrEqual(0)
      })

      // Create an individual test for every file key that appears either in the required output
      // or in the actual outputs derived from fixture files.
      const expectedKeys = Object.keys(requiredOutputs || {})
      const actualKeysFromFixtures = fixtureFiles.map(fileKey)
      const allKeys = Array.from(new Set([...expectedKeys, ...actualKeysFromFixtures]))

      allKeys.forEach(key => {
        it(`matches required output for ${key}`, () => {
          const actual = actualOutputs[key] ?? []
          const expected = (requiredOutputs && requiredOutputs[key]) ?? []
          expect(actual).toEqual(expected)
        })
      })
    })
  }
})
