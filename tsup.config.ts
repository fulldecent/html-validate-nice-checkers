import { defineConfig } from 'tsup'

/**
 * tsup Configuration for Dual Package Publishing (ESM/CJS)
 *
 * Design Decision: While tsup advertises as "zero-config", we need this configuration
 * to ensure proper dual ESM/CJS publishing with:
 * 1. Correct file extensions (.js/.cjs) for module resolution
 * 2. Proper TypeScript declaration files (.d.ts/.d.cts)
 * 3. Clean builds and proper source maps for debugging
 * 4. Bundle splitting disabled to maintain individual module structure
 *
 * This setup ensures compatibility with both modern ESM and legacy CJS environments
 * while maintaining type safety and IDE support.
 */
export default defineConfig({
  // Entry points - main package export
  entry: ['src/index.ts'],

  // Output both ESM and CJS formats for maximum compatibility
  format: ['cjs', 'esm'],

  // Generate TypeScript declaration files
  dts: true,

  // Clean output directory before build
  clean: true,

  // Output directory
  outDir: 'dist',

  // Generate source maps for debugging
  sourcemap: true,

  // Don't bundle dependencies - keep as external requires/imports
  bundle: false,

  // Don't split code - keep modules separate
  splitting: false,

  // Minify for production
  minify: false,

  // Target modern Node.js
  target: 'es2020',
  platform: 'node',

  // Custom file extensions for proper module resolution
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js',
    dts: format === 'cjs' ? '.d.cts' : '.d.ts',
  }),

  // Enable CommonJS interop
  cjsInterop: true,

  // Keep function names for better debugging
  keepNames: true,

  // Tree shake unused code
  treeshake: true,
})
