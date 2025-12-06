import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration
 *
 * Design decision: configured for TypeScript testing with coverage reporting.
 * Uses Node.js test environment since we're building a Node.js library.
 * Coverage excludes build artifacts and config files.
 */
export default defineConfig({
  test: {
    // Use Node.js environment for library testing
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'dist/', 'coverage/', '*.config.{js,ts}', 'tests/'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
})
