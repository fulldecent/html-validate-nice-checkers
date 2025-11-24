import { type RuleDocumentation, type DOMReadyEvent, Rule } from 'html-validate'

/**
 * AlternateLanguageUrlRule
 *
 * Ensures that all <link rel="alternate" hreflang="..."> elements use fully qualified URLs.
 *
 * According to Google's best practices for international websites, alternate language links
 * must use fully qualified URLs including the protocol (https://).
 *
 * Reference: https://developers.google.com/search/docs/specialty/international/localized-versions
 * "The value of the hreflang attribute identifies the language (in ISO 639-1 format) and
 * optionally a region (in ISO 3166-1 Alpha 2 format) of an alternate URL. The href attribute
 * contains the full URL of the alternate version."
 *
 * @example Valid:
 * <link rel="alternate" hreflang="es" href="https://example.com/es/page" />
 *
 * @example Invalid:
 * <link rel="alternate" hreflang="es" href="/es/page" />
 * <link rel="alternate" hreflang="es" href="es/page.html" />
 */
export default class AlternateLanguageUrlRule extends Rule {
  public override documentation(): RuleDocumentation {
    return {
      description:
        'Requires <link rel="alternate" hreflang="..."> to use fully qualified URLs with protocol (https://).',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.m#rules',
    }
  }

  public override setup(): void {
    // When the DOM is fully parsed, run the domReady method.
    this.on('dom:ready', (event: DOMReadyEvent) => {
      this.domReady(event)
    })
  }

  /**
   * Helper method to validate alternate language links in the document.
   *
   * @param event - The dom:ready event object.
   */
  private domReady(event: DOMReadyEvent): void {
    const { document } = event

    // Find all <link> elements with rel="alternate" and an hreflang attribute
    const alternateLinks = document.querySelectorAll('link[rel="alternate"][hreflang]')

    for (const link of alternateLinks) {
      const href = link.getAttribute('href')?.value

      // Skip if href is missing or empty
      if (typeof href !== 'string' || !href) {
        continue
      }

      // Check if the href contains :// which indicates a protocol and fully qualified URL
      // Valid patterns: https://, http://, etc.
      if (!href.includes('://')) {
        this.report({
          node: link,
          message: `Alternate language link must use a fully qualified URL (with protocol://), found: ${href}`,
        })
      }
    }
  }
}
