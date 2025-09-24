import { type TagReadyEvent, Rule, type RuleDocumentation } from 'html-validate'

export default class NoJqueryRule extends Rule {
  public override documentation(): RuleDocumentation {
    return {
      description: 'Disallow script tag with src including jQuery',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.m#rules',
    }
  }

  public override setup(): void {
    this.on('tag:ready', (event: TagReadyEvent) => {
      const { target } = event
      if (target.tagName !== 'script') {
        return
      }
      const src = target.getAttribute('src')?.value
      if (typeof src !== 'string' || !src) {
        return
      }
      if (!src.toLowerCase().includes('jquery')) {
        return
      }
      this.report({
        node: target,
        message: 'Script tag with src including jQuery is not allowed',
      })
    })
  }
}
