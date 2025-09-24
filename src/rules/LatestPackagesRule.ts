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

interface PackageCacheRow {
  url: string
  current: 0 | 1
  time: number
}

interface RuleOptions {
  cacheExpirySeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
  skipUrlPatterns: string[]
}

const defaults: RuleOptions = {
  cacheExpirySeconds: 2 * 24 * 60 * 60, // Default: 2 days
  timeoutSeconds: 10,
  cacheDatabasePath: 'cache/latest-packages.db',
  skipUrlPatterns: ['googletagmanager.com'],
}

export default class LatestPackagesRule extends Rule<void, RuleOptions> {
  private db!: Database.Database

  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
  }

  public static override schema(): SchemaObject {
    return {
      cacheExpirySeconds: {
        type: 'number',
        description: 'Number of seconds to cache package version lookup results.',
      },
      timeoutSeconds: {
        type: 'number',
        description:
          'Maximum time in seconds to wait for a response from the package registry API.',
      },
      cacheDatabasePath: {
        type: 'string',
        description: 'File path for the SQLite cache database.',
      },
      skipUrlPatterns: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'An array of substrings to identify URLs that should be ignored.',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description:
        'Ensures that package assets loaded from a CDN are the latest version and have SRI attributes.',
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
      CREATE TABLE IF NOT EXISTS latest_packages (
        url TEXT UNIQUE NOT NULL,
        current INTEGER NOT NULL,
        time INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS time_idx ON latest_packages (time);
    `)

    db.exec(
      `DELETE FROM latest_packages WHERE time < unixepoch() - ${this.options.cacheExpirySeconds}`
    )
    return db
  }

  private performPackageCheck(url: string, element: HtmlElement): void {
    // Robustly parse jsDelivr NPM URLs, supporting scoped packages.
    const match = url.match(/cdn\.jsdelivr\.net\/npm\/(@?[^/]+)@([^/]+)/)
    if (!match) {
      return // Not a jsDelivr NPM URL we can check.
    }

    const packageName = match[1]
    const packageVersion = match[2]
    const apiUrl = `https://data.jsdelivr.com/v1/package/npm/${packageName}`
    const escapedUrl = shellEscape([apiUrl])
    const command = `curl --silent --fail --location --max-time ${this.options.timeoutSeconds} ${escapedUrl}`

    try {
      const result = execSync(command).toString()
      const data = JSON.parse(result)

      if (data && data.tags && Object.values(data.tags).includes(packageVersion)) {
        // The version in the URL is a valid tag (e.g., 'latest', 'beta', or a specific version tag).
        this.db
          .prepare('REPLACE INTO latest_packages (url, current, time) VALUES (?, 1, unixepoch())')
          .run(url)
      } else {
        // The version is not a recognized tag, so it's likely outdated or incorrect.
        this.db
          .prepare('REPLACE INTO latest_packages (url, current, time) VALUES (?, 0, unixepoch())')
          .run(url)
        this.report({
          node: element,
          message: `Package "${packageName}" is not using a current version tag. Found "${packageVersion}", but latest is "${data.tags.latest}".`,
        })
      }
    } catch (e: any) {
      // Log errors related to the check itself (e.g., network issues) but don't fail validation.
      console.error(
        `[html-validate-latest-packages] Error checking package version for ${url}: ${e.message}`
      )
    }
  }

  private tagReady(event: TagReadyEvent): void {
    const { target } = event
    const { tagName } = event.target
    let url: string | undefined

    if (tagName === 'script') {
      const src = target.getAttribute('src')?.value
      if (typeof src === 'string') {
        url = src
      }
    } else if (tagName === 'link' && target.getAttribute('rel')?.value === 'stylesheet') {
      const href = target.getAttribute('href')?.value
      if (typeof href === 'string') {
        url = href
      }
    } else {
      return
    }
    if (
      !url ||
      !url.startsWith('http') ||
      this.options.skipUrlPatterns.some(pattern => url!.includes(pattern))
    ) {
      return
    }

    // Enforce Subresource Integrity (SRI)
    if (!target.hasAttribute('integrity') || !target.hasAttribute('crossorigin')) {
      this.report({
        node: target,
        message: `Package resource is missing required "integrity" and "crossorigin" attributes: ${url}`,
      })
    }

    const row = this.db.prepare('SELECT current FROM latest_packages WHERE url = ?').get(url) as
      | Pick<PackageCacheRow, 'current'>
      | undefined

    if (row) {
      if (row.current === 0) {
        // Cache hit: we already know it's outdated, report it.
        this.report({
          node: target,
          message: `Package is using an outdated version: ${url}`,
        })
      }
      return // Cache hit, do nothing more.
    }

    // If not in cache, perform the live check.
    this.performPackageCheck(url, target)
  }
}
