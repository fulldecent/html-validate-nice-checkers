import {
  type RuleDocumentation,
  type TagReadyEvent,
  type HtmlElement,
  type SchemaObject,
  Rule,
} from 'html-validate'
import { CsvDatabase } from '../utils/csvDatabase'
import { syncHead } from '../utils/syncFetch'

interface RuleOptions {
  cacheExpiryFoundSeconds: number
  cacheExpiryNotFoundSeconds: number
  timeoutSeconds: number
  cacheDatabasePath: string
}

const defaults: RuleOptions = {
  cacheExpiryFoundSeconds: 30 * 24 * 60 * 60, // Default: 30 days
  cacheExpiryNotFoundSeconds: 3 * 24 * 60 * 60, // Default: 3 days
  timeoutSeconds: 5,
  cacheDatabasePath: 'cache/https-availability.csv',
}

export default class HttpsLinksRule extends Rule<void, RuleOptions> {
  private db!: CsvDatabase

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
        description: 'File path for the CSV cache database.',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Report insecure HTTP links that are accessible via HTTPS.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#rules',
    }
  }

  public override setup(): void {
    this.db = CsvDatabase.open(this.options.cacheDatabasePath, ['url', 'found', 'time'], row => {
      const expirySeconds =
        row.found === '1'
          ? this.options.cacheExpiryFoundSeconds
          : this.options.cacheExpiryNotFoundSeconds
      return !(Number(row.time) >= Math.floor(Date.now() / 1000) - expirySeconds)
    })
    this.on('tag:ready', (event: TagReadyEvent) => this.tagReady(event))
    this.on('dom:ready', () => this.db.close())
  }

  private performHttpsCheck(url: string, element: HtmlElement): void {
    const httpsUrl = url.replace(/^http:/, 'https:')

    const result = syncHead(httpsUrl, {
      timeoutSeconds: this.options.timeoutSeconds,
      maxRedirs: 0,
    })

    const time = String(Math.floor(Date.now() / 1000))
    if (result.success) {
      // The URL is available over HTTPS.
      this.db.set({ url, found: '1', time })
      this.report({
        node: element,
        message: `Insecure link can be upgraded to HTTPS: ${url}`,
      })
    } else {
      // The URL is NOT available over HTTPS. Cache this result to avoid re-checking.
      this.db.set({ url, found: '0', time })
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

    const row = this.db.get(url)

    if (row) {
      if (row.found === '1') {
        // Cache hit: we already know it's upgradable, so report it.
        this.report({
          node: target,
          message: `Insecure link can be upgraded to HTTPS: ${url}`,
        })
      }
      // If row.found is '0', we know it's not upgradable, so we do nothing.
      return
    }

    // If not in cache, perform the live check.
    this.performHttpsCheck(url, target)
  }
}
