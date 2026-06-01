import {
  type RuleDocumentation,
  type TagReadyEvent,
  type HtmlElement,
  type SchemaObject,
  Rule,
} from 'html-validate'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { syncHead } from '../utils/syncFetch'
import {
  type UrlRewrite,
  type CompiledUrlRewrite,
  compileUrlRewrites,
  applyUrlRewrites,
  urlRewritesSchema,
} from '../utils/urlRewrites'
import { getLocalFileCandidates, resolveLocalFile } from '../utils/localPath'

interface UrlCacheRow {
  url: string
  status: number
  redirect_to: string | null
  time: number
}

interface ManuallyReviewedUrl {
  url: string
  lastApprovedTime: number
}

interface RuleOptions {
  proxyUrl: string
  skipRegexes: string[]
  cacheExpiryFoundSeconds: number
  cacheExpiryNotFoundSeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
  userAgent: string
  manuallyReviewedPath: string
  manuallyReviewedExpirySeconds: number
  urlRewrites: UrlRewrite[]
  alternativeExtensions: string[]
  indexFile: string
}

const defaults: RuleOptions = {
  proxyUrl: '',
  skipRegexes: [],
  cacheExpiryFoundSeconds: 30 * 24 * 60 * 60, // Default: 30 days
  cacheExpiryNotFoundSeconds: 3 * 24 * 60 * 60, // Default: 3 days
  timeoutSeconds: 5,
  cacheDatabasePath: 'cache/external-links.db',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.9999.999 Safari/537.36',
  manuallyReviewedPath: '',
  manuallyReviewedExpirySeconds: 365 * 24 * 60 * 60, // Default: 365 days (1 year)
  urlRewrites: [],
  alternativeExtensions: ['.html'],
  indexFile: 'index.html',
}

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    urlObj.hostname = urlObj.hostname.toLowerCase()
    return urlObj.toString()
  } catch (e) {
    return url
  }
}

export default class ExternalLinksRule extends Rule<void, RuleOptions> {
  private readonly skipRegexesCompiled: RegExp[]
  private readonly manuallyReviewedUrls: Map<string, number>
  private readonly compiledUrlRewrites: CompiledUrlRewrite[]
  private db!: Database.Database

  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
    this.skipRegexesCompiled = this.compileRegexes(this.options.skipRegexes)
    this.manuallyReviewedUrls = this.loadManuallyReviewedUrls()
    this.compiledUrlRewrites = compileUrlRewrites(this.options.urlRewrites ?? [])
  }

  public static override schema(): SchemaObject {
    return {
      proxyUrl: {
        type: 'string',
        description: 'URL of a proxy server to check external links.',
      },
      skipRegexes: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'An array of regex patterns (as strings) for URLs to skip.',
      },
      cacheExpiryFoundSeconds: {
        type: 'number',
        description: 'Number of seconds to cache successful (2xx) responses.',
      },
      cacheExpiryNotFoundSeconds: {
        type: 'number',
        description: 'Number of seconds to cache failed (non-2xx) responses.',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Maximum time in seconds to wait for a response.',
      },
      cacheDatabasePath: {
        type: 'string',
        description: 'File path for the SQLite cache database.',
      },
      userAgent: {
        type: 'string',
        description: 'User-Agent string to use for requests.',
      },
      manuallyReviewedPath: {
        type: 'string',
        description: 'Path to CSV file containing manually reviewed URLs with approval timestamps.',
      },
      manuallyReviewedExpirySeconds: {
        type: 'number',
        description:
          'Number of seconds before a manually reviewed URL approval expires (default: 365 days).',
      },
      urlRewrites: {
        ...urlRewritesSchema,
        description:
          'Regex rewrite rules mapping absolute https:// URLs to local paths. If a rewrite produces a local path, the file is checked on disk instead of over the network.',
      },
      alternativeExtensions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Extensions to try when a rewritten local path has no extension (e.g. [".html"]).',
      },
      indexFile: {
        type: 'string',
        description:
          'Filename to look for when a rewritten local path resolves to a directory (e.g. "index.html").',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Require all external links to be live.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#rules',
    }
  }

  public override setup(): void {
    this.db = this.setupDatabase()
    this.on('tag:ready', (event: TagReadyEvent) => this.tagReady(event))
  }

  private setupDatabase(): Database.Database {
    const dir = path.dirname(this.options.cacheDatabasePath)
    fs.mkdirSync(dir, { recursive: true })

    const db = new Database(this.options.cacheDatabasePath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS urls (url TEXT UNIQUE NOT NULL, status INTEGER, redirect_to TEXT, time INTEGER);
      CREATE INDEX IF NOT EXISTS time_idx ON urls (time);
    `)

    db.exec(
      `DELETE FROM urls WHERE status >= 200 AND status < 300 AND time < unixepoch() - ${this.options.cacheExpiryFoundSeconds}`
    )
    db.exec(
      `DELETE FROM urls WHERE (status < 200 OR status >= 300) AND time < unixepoch() - ${this.options.cacheExpiryNotFoundSeconds}`
    )
    return db
  }

  private compileRegexes(patterns: string[]): RegExp[] {
    return patterns
      .map(pattern => {
        try {
          return new RegExp(pattern)
        } catch (e) {
          console.error(
            `[html-validate-nice-checkers] Invalid regex pattern in 'skipRegexes' configuration: "${pattern}"`
          )
          return null
        }
      })
      .filter((regex): regex is RegExp => regex !== null)
  }

  private loadManuallyReviewedUrls(): Map<string, number> {
    const urlMap = new Map<string, number>()

    if (!this.options.manuallyReviewedPath) {
      return urlMap
    }

    try {
      if (!this.options.manuallyReviewedPath || !fs.existsSync(this.options.manuallyReviewedPath)) {
        return urlMap
      }

      const csvContent = fs.readFileSync(this.options.manuallyReviewedPath, 'utf-8')
      const lines = csvContent.split('\n')

      for (let i = 1; i < lines.length; i++) {
        // Skip header and empty lines
        const line = lines[i]
        if (!line) continue
        const trimmedLine = line.trim()
        if (!trimmedLine) continue

        // Simple CSV parsing: split by comma and handle quoted fields
        const parts = trimmedLine.split(',')
        if (parts.length < 2) continue

        const urlPart = parts[0]
        const timestampPart = parts[1]
        if (!urlPart || !timestampPart) continue

        const url = urlPart.replace(/^"|"$/g, '').trim()
        const timestampStr = timestampPart.replace(/^"|"$/g, '').trim()

        if (!url || !timestampStr) continue

        const timestamp = parseInt(timestampStr, 10)
        if (isNaN(timestamp)) continue

        urlMap.set(normalizeUrl(url), timestamp)
      }
    } catch (e) {
      console.error(
        `[html-validate-nice-checkers] Error reading manually reviewed URLs from "${this.options.manuallyReviewedPath}": ${e}`
      )
    }

    return urlMap
  }

  private isManuallyApproved(url: string): boolean {
    const normalizedUrl = normalizeUrl(url)
    const approvedTime = this.manuallyReviewedUrls.get(normalizedUrl)

    if (!approvedTime) {
      return false
    }

    const currentTime = Math.floor(Date.now() / 1000)
    const expiryTime = approvedTime + this.options.manuallyReviewedExpirySeconds

    return currentTime < expiryTime
  }

  private performCheck(originalUrl: string, element: HtmlElement, requestUrl?: string): void {
    const normalizedUrl = normalizeUrl(originalUrl)
    const urlToCheck = requestUrl ?? originalUrl

    const result = syncHead(urlToCheck, {
      timeoutSeconds: this.options.timeoutSeconds,
      userAgent: this.options.userAgent,
      maxRedirs: 0,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      },
    })

    const statusCode = result.statusCode ?? 500
    const redirectTo = result.redirectTo ?? null

    this.db
      .prepare('REPLACE INTO urls (url, status, redirect_to, time) VALUES (?, ?, ?, unixepoch())')
      .run(normalizedUrl, statusCode, redirectTo)
    if (statusCode < 200 || statusCode >= 300) {
      if (redirectTo) {
        this.report({
          node: element,
          message: `External link ${originalUrl} redirects to: ${redirectTo}`,
        })
      } else {
        this.report({
          node: element,
          message: `External link is broken with status ${statusCode}: ${originalUrl}`,
        })
      }
    }
  }

  private tagReady(event: TagReadyEvent): void {
    const { target } = event
    const { tagName } = target

    let urlAttribute: string | null = null
    if (tagName === 'a' || tagName === 'link') {
      urlAttribute = 'href'
    } else if (tagName === 'script' || tagName === 'img') {
      urlAttribute = 'src'
    } else {
      return
    }

    // Skip canonical and alternate language links as they point to the site itself
    // and may reference not-yet-published URLs during development/preview
    if (tagName === 'link') {
      const rel = target.getAttribute('rel')?.value
      if (rel === 'canonical' || rel === 'alternate') {
        return
      }
    }

    const rawUrl = target.getAttribute(urlAttribute)?.value
    if (typeof rawUrl !== 'string' || !rawUrl) {
      return
    }

    const url = rawUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

    if (!url.startsWith('http')) {
      return
    }

    if (this.skipRegexesCompiled.some(regex => regex.test(url))) {
      return
    }

    // If a rewrite rule maps this URL to a local path, check the file on disk.
    const rewritten = applyUrlRewrites(url, this.compiledUrlRewrites)
    if (!/^https?:\/\//i.test(rewritten)) {
      const resolved = path.isAbsolute(rewritten) ? rewritten : path.resolve(rewritten)
      const candidates = getLocalFileCandidates(
        resolved,
        this.options.alternativeExtensions,
        this.options.indexFile
      )
      const found = resolveLocalFile(candidates)
      if (!found) {
        this.report({
          node: target,
          message: `External link is broken (local rewrite not found): ${url}`,
        })
      }
      return
    }

    // Check if URL is manually approved
    if (this.isManuallyApproved(url)) {
      return
    }

    const normalizedUrl = normalizeUrl(url)
    const row = this.db.prepare('SELECT * FROM urls WHERE url = ?').get(normalizedUrl) as
      | UrlCacheRow
      | undefined

    if (row) {
      if (row.status >= 200 && row.status < 300) {
        return
      }
      if (row.redirect_to) {
        this.report({
          node: target,
          message: `External link ${url} redirects to: ${row.redirect_to}`,
        })
      } else {
        this.report({
          node: target,
          message: `External link is broken with status ${row.status}: ${url}`,
        })
      }
      return
    }

    if (this.options.proxyUrl) {
      this.performCheck(url, target, `${this.options.proxyUrl}?url=${encodeURIComponent(url)}`)
    } else {
      this.performCheck(url, target)
    }
  }
}
