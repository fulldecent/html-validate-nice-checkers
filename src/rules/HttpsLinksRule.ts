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

interface HttpsCacheRow {
  url: string
  found: 0 | 1
  time: number
}

interface RuleOptions {
  cacheExpiryFoundSeconds: number
  cacheExpiryNotFoundSeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
}

const defaults: RuleOptions = {
  cacheExpiryFoundSeconds: 30 * 24 * 60 * 60, // Default: 30 days
  cacheExpiryNotFoundSeconds: 3 * 24 * 60 * 60, // Default: 3 days
  timeoutSeconds: 10,
  cacheDatabasePath: 'cache/https-availability.db',
}

export default class HttpsLinksRule extends Rule<void, RuleOptions> {
  private db!: Database.Database

  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
  }

  public static override schema(): SchemaObject {
    return {
      cacheExpiryFoundSeconds: {
        type: 'number',
        description: 'Number of seconds to cache that a URL is available over HTTPS.',
      },
      cacheExpiryNotFoundSeconds: {
        type: 'number',
        description: 'Number of seconds to cache that a URL is NOT available over HTTPS.',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Maximum time in seconds to wait for a response when checking for HTTPS.',
      },
      cacheDatabasePath: {
        type: 'string',
        description: 'File path for the SQLite cache database.',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Report insecure HTTP links that are accessible via HTTPS.',
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
      CREATE TABLE IF NOT EXISTS urls (
        url TEXT UNIQUE NOT NULL,
        found INTEGER NOT NULL,
        time INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS time_idx ON urls (time);
    `)

    db.exec(
      `DELETE FROM urls WHERE found = 1 AND time < unixepoch() - ${this.options.cacheExpiryFoundSeconds}`
    )
    db.exec(
      `DELETE FROM urls WHERE found = 0 AND time < unixepoch() - ${this.options.cacheExpiryNotFoundSeconds}`
    )
    return db
  }

  private performHttpsCheck(url: string, element: HtmlElement): void {
    const httpsUrl = url.replace(/^http:/, 'https:')
    const escapedUrl = shellEscape([httpsUrl])

    // Use --fail to make curl exit with an error on 4xx/5xx responses.
    const command = `curl --head --silent --fail --location --max-time ${this.options.timeoutSeconds} ${escapedUrl} > /dev/null 2>&1`

    try {
      execSync(command)
      // If execSync does NOT throw, the command was successful (exit code 0).
      // This means the URL is available over HTTPS.
      this.db.prepare('REPLACE INTO urls (url, found, time) VALUES (?, 1, unixepoch())').run(url)
      this.report({
        node: element,
        message: `Insecure link can be upgraded to HTTPS: ${url}`,
      })
    } catch (error) {
      // If execSync throws, the command failed.
      // This means the URL is NOT available over HTTPS. Cache this result to avoid re-checking.
      this.db.prepare('REPLACE INTO urls (url, found, time) VALUES (?, 0, unixepoch())').run(url)
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

    const rawUrl = target.getAttribute(urlAttribute)?.value
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('http://')) {
      return
    }

    // A simple decoder. More complex entities would require a library.
    const url = rawUrl.replace(/&amp;/g, '&')

    const row = this.db.prepare('SELECT found FROM urls WHERE url = ?').get(url) as
      | Pick<HttpsCacheRow, 'found'>
      | undefined

    if (row) {
      if (row.found === 1) {
        // Cache hit: we already know it's upgradable, so report it.
        this.report({
          node: target,
          message: `Insecure link can be upgraded to HTTPS: ${url}`,
        })
      }
      // If row.found is 0, we know it's not upgradable, so we do nothing.
      return
    }

    // If not in cache, perform the live check.
    this.performHttpsCheck(url, target)
  }
}
