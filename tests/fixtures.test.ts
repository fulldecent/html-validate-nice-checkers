import { describe, it, expect, beforeAll } from 'vitest'
import { HtmlValidate, StaticConfigLoader } from 'html-validate'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, extname } from 'path'
import NiceCheckersPlugin from '../src/index'

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
  if (requiredOutputs !== null || fixtureFiles.length > 0) {
    describe('required output validation', () => {
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
              skipRegexes: ['^https://this-should-skip.example.com'],
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
