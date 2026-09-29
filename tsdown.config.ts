import { defineConfig } from 'tsdown'

// target is omitted so tsdown compiles to package.json engines.node
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  minify: false,
  // .js/.d.ts for import and .cjs/.d.cts for require, matching package.json exports
  fixedExtension: false,
  // CJS is kept on purpose for html-validate's cjsResolver, which calls require() on plugins
  checks: { legacyCjs: false },
})
