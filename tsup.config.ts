import { defineConfig } from 'tsup'

/**
 * tsup Configuration for Dual Package Publishing (ESM/CJS)
 *
 * Design decision: While tsup advertises as "zero-config", we need this configuration
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
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'], // Output both ESM and CJS formats for maximum compatibility
  dts: true,
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  bundle: true,
  splitting: false,
  minify: true,
  target: 'es2020',
  platform: 'node',

  // Custom file extensions for proper module resolution
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.js',
    dts: format === 'cjs' ? '.d.cts' : '.d.ts',
  }),

  // Disable faulty CommonJS interop that adds `module.exports = exports.default`
  cjsInterop: false,

  // Keep function names for better debugging
  keepNames: true,

  // Tree shake unused code
  treeshake: true,
})
