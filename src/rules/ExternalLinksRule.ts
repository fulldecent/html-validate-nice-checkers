import {
  type RuleDocumentation,
  type TagReadyEvent,
  type HtmlElement,
  type SchemaObject,
  Rule,
} from 'html-validate'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { quote as shellEscape } from 'shell-quote'
import path from 'node:path'

interface UrlCacheRow {
  url: string
  status: number
  redirect_to: string | null
  time: number
}

interface RuleOptions {
  proxyUrl: string
  skipRegexes: string[]
  cacheExpiryFoundSeconds: number
  cacheExpiryNotFoundSeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
  userAgent: string
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
  private db!: Database.Database

  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
    this.skipRegexesCompiled = this.compileRegexes(this.options.skipRegexes)
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
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Require all external links to be live.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.m#rules',
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

  private performCheck(originalUrl: string, element: HtmlElement, requestUrl?: string): void {
    const normalizedUrl = normalizeUrl(originalUrl)
    const escapedUrl = shellEscape([requestUrl ?? originalUrl])

    const command = `curl --head --silent --max-time ${this.options.timeoutSeconds} --max-redirs 0 \
      --user-agent "${this.options.userAgent}" \
      --header "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9" \
      --dump-header - --output /dev/null ${escapedUrl} || true`
    const output = execSync(command).toString()
    const statusCodeMatch = output.match(/^HTTP\/[0-9.]+ (\d{3})/m)
    const statusCode =
      statusCodeMatch && statusCodeMatch[1] ? parseInt(statusCodeMatch[1], 10) : 500
    const locationMatch = output.match(/^Location: (.+)/im)
    const redirectTo = locationMatch && locationMatch[1] ? locationMatch[1].trim() : null

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
