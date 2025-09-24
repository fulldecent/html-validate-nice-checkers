import { describe, it, expect } from 'vitest'
import { HtmlValidate, StaticConfigLoader } from 'html-validate'
import NiceCheckersPlugin from '../src/index'

const plugin = NiceCheckersPlugin

describe('HTML-validate Nice Checkers plugin', () => {
  describe('plugin structure', () => {
    it('should have correct plugin name', () => {
      expect(plugin.name).toBe('nice-checkers-plugin')
    })

    it('should export rules object', () => {
      expect(plugin.rules).toBeDefined()
      expect(typeof plugin.rules).toBe('object')
    })

    it('should have all expected rules defined', () => {
      expect(plugin.rules).toHaveProperty('nice-checkers/no-jquery')
    })

    it('should have rule constructors that are functions', () => {
      expect(typeof plugin.rules['nice-checkers/no-jquery']).toBe('function')
    })

    it('should export configs object', () => {
      expect(plugin.configs).toBeDefined()
      expect(typeof plugin.configs).toBe('object')
    })

    it('should have recommended configuration', () => {
      expect(plugin.configs).toHaveProperty('recommended')
      expect(typeof plugin.configs.recommended).toBe('object')
    })

    it('should have rules configured in recommended config', () => {
      expect(plugin.configs.recommended.rules).toBeDefined()
      expect(typeof plugin.configs.recommended.rules).toBe('object')
    })
  })

  describe('rule schema validation', () => {
    it('should have static schema methods on rules', () => {
      for (const ruleName in plugin.rules) {
        const rule = plugin.rules[ruleName]
        expect(typeof rule.schema).toBe('function')
      }
    })
  })

  describe('ExternalLinksRule skipUrl functionality', () => {
    const testHtml = `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Test</title>
    <link rel="canonical" href="https://example.com" />
</head>
<body>
    <a href="https://dont-check-this.example.com/test">Should be skipped</a>
    <a href="https://invalid-hostname-that-doesnt-exist.test">Should be skipped</a>
    <a href="https://httpbin.io/status/404">Should not be skipped</a>
</body>
</html>`

    it('should support skipUrl configuration (singular)', async () => {
      const loader = new StaticConfigLoader({
        plugins: [plugin],
        rules: {
          'nice-checkers/external-links': [
            'error',
            {
              skipUrl: ['dont-check-this\\.example\\.com', 'invalid-hostname.*\\.test'],
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
        },
      })
      const htmlvalidate = new HtmlValidate(loader)
      const report = await htmlvalidate.validateString(testHtml)

      // Should only report one error (the httpbin.io link that's not skipped)
      const externalLinksErrors =
        report.results[0]?.messages.filter(msg => msg.ruleId === 'nice-checkers/external-links') ||
        []

      // Due to test environment issues, we might get network errors
      // but we should not get errors for the URLs that match the skip patterns
      const skippedUrls = ['dont-check-this.example.com', 'invalid-hostname-that-doesnt-exist.test']
      const errorMessages = externalLinksErrors.map(err => err.message)

      for (const skippedUrl of skippedUrls) {
        const hasErrorForSkippedUrl = errorMessages.some(msg => msg.includes(skippedUrl))
        expect(hasErrorForSkippedUrl).toBe(false)
      }
    })

    it('should support skipUrls configuration (plural)', async () => {
      const loader = new StaticConfigLoader({
        plugins: [plugin],
        rules: {
          'nice-checkers/external-links': [
            'error',
            {
              skipUrls: ['dont-check-this\\.example\\.com', 'invalid-hostname.*\\.test'],
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
        },
      })
      const htmlvalidate = new HtmlValidate(loader)
      const report = await htmlvalidate.validateString(testHtml)

      const externalLinksErrors =
        report.results[0]?.messages.filter(msg => msg.ruleId === 'nice-checkers/external-links') ||
        []

      const skippedUrls = ['dont-check-this.example.com', 'invalid-hostname-that-doesnt-exist.test']
      const errorMessages = externalLinksErrors.map(err => err.message)

      for (const skippedUrl of skippedUrls) {
        const hasErrorForSkippedUrl = errorMessages.some(msg => msg.includes(skippedUrl))
        expect(hasErrorForSkippedUrl).toBe(false)
      }
    })

    it('should handle invalid regex patterns gracefully', async () => {
      const loader = new StaticConfigLoader({
        plugins: [plugin],
        rules: {
          'nice-checkers/external-links': [
            'error',
            {
              skipUrls: ['valid-pattern\\.com', '[[[invalid-regex'], // Second pattern is invalid
              cacheExpiryFoundSeconds: 0,
              cacheExpiryNotFoundSeconds: 0,
            },
          ],
        },
      })
      const htmlvalidate = new HtmlValidate(loader)

      // Should not throw an error despite invalid regex
      const testHtmlWithInvalidPattern = `<!doctype html>
<html lang="en">
<head><title>Test</title><link rel="canonical" href="https://example.com" /></head>
<body><a href="https://valid-pattern.com/test">Test</a></body>
</html>`

      const report = await htmlvalidate.validateString(testHtmlWithInvalidPattern)

      // The valid pattern should still work to skip URLs
      const externalLinksErrors =
        report.results[0]?.messages.filter(msg => msg.ruleId === 'nice-checkers/external-links') ||
        []

      const errorMessages = externalLinksErrors.map(err => err.message)
      const hasErrorForValidPattern = errorMessages.some(msg => msg.includes('valid-pattern.com'))
      expect(hasErrorForValidPattern).toBe(false)
    })
  })
})
