import fs from 'node:fs'
import path from 'node:path'

/**
 * Returns an ordered list of candidate absolute file paths for a resolved local path.
 *
 * When the path has no file extension (a "pretty URL"), also appends:
 *   - `<path><ext>` for each extension in `extensions`
 *   - `<path>/<indexFile>`
 *
 * This mirrors the resolution strategy used by Eleventy and other static-site generators
 * that emit `about.html` or `about/index.html` for a URL like `/about`.
 */
export function getLocalFileCandidates(
  resolved: string,
  extensions: string[],
  indexFile: string
): string[] {
  const candidates: string[] = [resolved]
  if (!path.extname(resolved)) {
    for (const ext of extensions) {
      candidates.push(`${resolved}${ext}`)
    }
    candidates.push(path.join(resolved, indexFile))
  }
  return candidates
}

/**
 * Returns the first candidate path that is an existing regular file, or null.
 */
export function resolveLocalFile(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) {
        return candidate
      }
    } catch {
      // skip unreadable paths
    }
  }
  return null
}
