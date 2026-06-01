import {
  Rule,
  type RuleDocumentation,
  type DOMReadyEvent,
  type HtmlElement,
  type SchemaObject,
} from 'html-validate'
import { syncFetch } from '../utils/syncFetch'
import * as cheerio from 'cheerio'
import fs from 'node:fs'
import path from 'node:path'
import {
  type UrlRewrite,
  type CompiledUrlRewrite,
  compileUrlRewrites,
  applyUrlRewrites,
  urlRewritesSchema,
} from '../utils/urlRewrites'
import { getLocalFileCandidates, resolveLocalFile } from '../utils/localPath'

interface RuleOptions {
  urlRewrites: UrlRewrite[]
}

const defaults: RuleOptions = {
  urlRewrites: [],
}

export default class AlternateLanguageLinksRule extends Rule<void, RuleOptions> {
  private readonly compiledUrlRewrites: CompiledUrlRewrite[]

  public constructor(options: Partial<RuleOptions>) {
    super({ ...defaults, ...options })
    this.compiledUrlRewrites = compileUrlRewrites(this.options.urlRewrites)
  }

  public static override schema(): SchemaObject {
    return {
      urlRewrites: {
        ...urlRewritesSchema,
        description:
          'Regex rewrite rules mapping alternate URLs to local file paths for reciprocal checks.',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description:
        'Enforces best practices for alternate language links (rel="alternate" hreflang) in the <head> of HTML documents.',
      url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
    }
  }

  public override setup(): void {
    this.on('dom:ready', (event: DOMReadyEvent) => this.domReady(event))
  }

  private loadLocalHtml(localPathRaw: string): string | null {
    let resolved: string
    if (localPathRaw.startsWith('file://')) {
      try {
        resolved = new URL(localPathRaw).pathname
      } catch {
        return null
      }
    } else {
      resolved = path.isAbsolute(localPathRaw) ? localPathRaw : path.resolve(localPathRaw)
    }
    const candidates = getLocalFileCandidates(resolved, ['.html'], 'index.html')
    const found = resolveLocalFile(candidates)
    if (!found) return null
    return fs.readFileSync(found, 'utf8')
  }

  private fetchHtml(url: string): string | null {
    const rewrittenUrl = applyUrlRewrites(url, this.compiledUrlRewrites)

    if (!/^https?:\/\//.test(rewrittenUrl)) {
      return this.loadLocalHtml(rewrittenUrl)
    }

    const result = syncFetch(rewrittenUrl, { timeoutSeconds: 10, maxRedirs: 5 })
    if (!result.success || !result.body) {
      return null
    }
    return result.body
  }

  private domReady(event: DOMReadyEvent): void {
    const { document } = event
    const htmlElement = document.querySelector('html')
    if (!htmlElement) return
    // Only run once per document
    this.checkAlternateLanguageLinks(htmlElement)
  }

  private checkAlternateLanguageLinks(htmlElement: HtmlElement): void {
    const head = htmlElement.querySelector('head')
    if (!head) return

    const alternates = head.querySelectorAll('link[rel="alternate"][hreflang]')
    if (alternates.length === 0) return

    const canonical = head.querySelector('link[rel="canonical"]')
    if (!canonical) return
    const canonicalUrlAttr = canonical.getAttribute('href')?.value
    if (!canonicalUrlAttr || typeof canonicalUrlAttr !== 'string') return
    const canonicalUrl: string = canonicalUrlAttr

    const pageLang = htmlElement.getAttribute('lang')?.value

    // 1. Must have a self-link
    let hasSelfLink = false
    for (const alt of alternates) {
      const hrefAttr = alt.getAttribute('href')?.value
      const href: string | undefined = typeof hrefAttr === 'string' ? hrefAttr : undefined
      const hreflang = alt.getAttribute('hreflang')?.value
      if (href === canonicalUrl) {
        hasSelfLink = true
        if (pageLang && hreflang !== pageLang) {
          this.report({
            node: alt,
            message: `Self alternate link hreflang (${hreflang}) does not match page lang (${pageLang})`,
          })
        }
      }
      // 2. Must be fully qualified
      if (!href || !/^https?:\/\//.test(href)) {
        this.report({
          node: alt,
          message: `Alternate link href must be fully qualified: ${href ?? '(empty)'}`,
        })
      }
    }
    if (!hasSelfLink) {
      this.report({
        node: head,
        message: 'No self-link found in alternate language links (must match canonical URL)',
      })
    }

    // 3. Reciprocal linking
    for (const alt of alternates) {
      const hrefAttr2 = alt.getAttribute('href')?.value
      const href: string | undefined = typeof hrefAttr2 === 'string' ? hrefAttr2 : undefined
      if (!href || href === canonicalUrl) continue

      const remoteHtml = this.fetchHtml(href)
      if (!remoteHtml) {
        this.report({
          node: alt,
          message: `Alternate page ${href} is not accessible`,
        })
        continue
      }

      // Check for reciprocal link in the fetched HTML
      // The remote page must have an alternate link back to this page's canonical URL
      // with hreflang matching this page's lang
      const expectedHreflang = pageLang ?? ''

      // Parse the remote HTML for alternate links using cheerio
      const $ = cheerio.load(remoteHtml)
      const remoteAlternates = $('link[rel="alternate"][hreflang]')

      let foundReciprocal = false
      remoteAlternates.each((_, element) => {
        const remoteHref = $(element).attr('href')
        const remoteHreflang = $(element).attr('hreflang')

        if (remoteHref === canonicalUrl && remoteHreflang === expectedHreflang) {
          foundReciprocal = true
          return false // break out of each loop
        }
        return
      })

      if (!foundReciprocal) {
        this.report({
          node: alt,
          message: `Reciprocal alternate link not found on ${href} (must link back to ${canonicalUrl} with hreflang="${expectedHreflang}")`,
        })
      }
    }
  }
}
