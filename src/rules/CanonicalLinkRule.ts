import { type RuleDocumentation, type DOMReadyEvent, Rule } from 'html-validate'

export default class CanonicalLinkRule extends Rule {
  public override documentation(): RuleDocumentation {
    return {
      description: "Requires a <link rel='canonical'> in the <head> with a specific href format.",
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
   * Helper method to validate the document's canonical link.
   *
   * @param event - The dom:ready event object.
   */
  private domReady(event: DOMReadyEvent): void {
    const { document } = event
    const linkCanonical = document.querySelector('head > link[rel="canonical"]')

    if (linkCanonical === null) {
      // Report error if the canonical link is missing entirely.
      this.report({
        node: document.querySelector('head')!,
        message: '<head> is missing <link rel="canonical" ...>',
      })
      return
    }

    // Safely get the href attribute's value. It will be undefined if href is missing.
    const href = linkCanonical.getAttribute('href')?.value
    if (typeof href !== 'string' || !href) {
      this.report({
        node: linkCanonical,
        message: "<link rel='canonical'> is missing a non-empty href attribute",
      })
      return
    }

    // Check for file extensions like .html, .php, etc.
    if (/\.\w+$/.test(href)) {
      this.report({
        node: linkCanonical,
        message: 'Canonical link href should be extensionless (no .html, .php, etc.)',
      })
    }

    // Check if the link unnecessarily ends with /index.
    if (href.toLowerCase().endsWith('/index')) {
      this.report({
        node: linkCanonical,
        message: 'Canonical link href should be "/" instead of ending with "/index"',
      })
    }
  }
}
