export interface UrlRewrite {
  pattern: string
  replacement: string
}

export interface CompiledUrlRewrite {
  regex: RegExp
  replacement: string
}

/**
 * Compiles an array of UrlRewrite specs into CompiledUrlRewrites.
 * Invalid regex patterns are silently dropped.
 */
export function compileUrlRewrites(rewrites: UrlRewrite[]): CompiledUrlRewrite[] {
  return rewrites
    .map(rewrite => {
      try {
        return { regex: new RegExp(rewrite.pattern), replacement: rewrite.replacement }
      } catch {
        return null
      }
    })
    .filter((r): r is CompiledUrlRewrite => r !== null)
}

/**
 * Applies all compiled rewrites to the input URL in sequence and returns the result.
 */
export function applyUrlRewrites(url: string, rewrites: CompiledUrlRewrite[]): string {
  let result = url
  for (const rw of rewrites) {
    result = result.replace(rw.regex, rw.replacement)
  }
  return result
}

/** JSON Schema fragment for the urlRewrites option (shared across rules). */
export const urlRewritesSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string' as const },
      replacement: { type: 'string' as const },
    },
  },
  description:
    'Regex rewrite rules applied to URLs before local file resolution. Rewrites that produce a local path are checked on disk.',
}
