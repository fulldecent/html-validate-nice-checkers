import {
  type RuleDocumentation,
  type TagReadyEvent,
  type HtmlElement,
  type SchemaObject,
  Rule,
} from 'html-validate'
import { CsvDatabase } from '../utils/csvDatabase'
import { syncFetch } from '../utils/syncFetch'

interface RuleOptions {
  cacheExpirySeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
  skipUrlPatterns: string[]
}

const defaults: RuleOptions = {
  cacheExpirySeconds: 2 * 24 * 60 * 60, // Default: 2 days
  timeoutSeconds: 5,
  cacheDatabasePath: 'cache/latest-packages.csv',
  skipUrlPatterns: ['googletagmanager.com'],
}

export default class LatestPackagesRule extends Rule<void, RuleOptions> {
  private db!: CsvDatabase

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
        description: 'File path for the CSV cache database.',
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
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#rules',
    }
  }

  public override setup(): void {
    this.db = CsvDatabase.open(
      this.options.cacheDatabasePath,
      ['url', 'current', 'time'],
      row => !(Number(row.time) >= Math.floor(Date.now() / 1000) - this.options.cacheExpirySeconds)
    )
    this.on('tag:ready', (event: TagReadyEvent) => this.tagReady(event))
    this.on('dom:ready', () => this.db.close())
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

    const fetchResult = syncFetch(apiUrl, {
      timeoutSeconds: this.options.timeoutSeconds,
      maxRedirs: 0,
    })

    if (!fetchResult.success || !fetchResult.body) {
      // Log errors related to the check itself (e.g., network issues) but don't fail validation.
      console.error(
        `[html-validate-latest-packages] Error checking package version for ${url}: ${fetchResult.error ?? 'Unknown error'}`
      )
      return
    }

    try {
      const data = JSON.parse(fetchResult.body)

      const time = String(Math.floor(Date.now() / 1000))
      if (data && data.tags && Object.values(data.tags).includes(packageVersion)) {
        // The version in the URL is a valid tag (e.g., 'latest', 'beta', or a specific version tag).
        this.db.set({ url, current: '1', time })
      } else {
        // The version is not a recognized tag, so it's likely outdated or incorrect.
        this.db.set({ url, current: '0', time })
        this.report({
          node: element,
          message: `Package "${packageName}" is not using a current version tag. Found "${packageVersion}", but latest is "${data.tags.latest}".`,
        })
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      // Log errors related to the check itself (e.g., JSON parse issues) but don't fail validation.
      console.error(
        `[html-validate-latest-packages] Error parsing package info for ${url}: ${errorMessage}`
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

    const row = this.db.get(url)

    if (row) {
      if (row.current === '0') {
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
