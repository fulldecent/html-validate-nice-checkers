import { describe, it, expect } from 'vitest'
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
})
