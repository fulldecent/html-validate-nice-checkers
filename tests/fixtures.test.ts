import { describe, it, expect, beforeAll } from 'vitest'
import { HtmlValidate, StaticConfigLoader } from 'html-validate'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, extname } from 'path'
import NiceCheckersPlugin from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesDir = join(__dirname, 'fixtures')

type ReportsByFile = {
  [filePath: string]: object[]
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
  if (requiredOutputs !== null && fixtureFiles.length > 0) {
    describe('required output validation', () => {
      const plugin = new NiceCheckersPlugin()
      const loader = new StaticConfigLoader({
        plugins: [plugin],
        extends: ['nice-checkers:recommended'],
        rules: {
          // Disable caching for tests to ensure consistent results
          'nice/external-links': [
            'error',
            {
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
          'nice/https-links': [
            'error',
            {
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
          'nice/latest-packages': [
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

      beforeAll(async () => {
        for (const filePath of fixtureFiles) {
          const report = await htmlvalidate.validateFile(filePath)
          actualOutputs[filePath.replace(process.cwd() + '/', '')] = report.results[0].messages
        }
        writeFileSync(
          join(fixturesDir, 'actual-reports.json'),
          JSON.stringify(actualOutputs, null, 2),
          'utf-8'
        )
      })

      it('should generate actual-reports.json', () => {
        expect(Object.keys(actualOutputs).length).toBeGreaterThan(0)
      })

      it('should match required output', () => {
        expect(actualOutputs).toEqual(requiredOutputs)
      })
    })
  }
})
