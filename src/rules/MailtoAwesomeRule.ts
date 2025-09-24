import { type RuleDocumentation, type TagReadyEvent, type SchemaObject, Rule } from 'html-validate'

interface RuleOptions {
  requiredParameters: string[]
}

const defaults: RuleOptions = {
  requiredParameters: ['subject', 'body'],
}

export default class MailtoAwesomeRule extends Rule<void, RuleOptions> {
  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
  }

  public static override schema(): SchemaObject {
    return {
      requiredParameters: {
        type: 'array',
        items: {
          type: 'string',
        },
        description:
          'An array of parameters that must be present in a mailto: link (e.g., ["subject", "body"]).',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Enforce that mailto: links contain specific parameters.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.m#rules',
    }
  }

  public override setup(): void {
    this.on('tag:ready', (event: TagReadyEvent) => this.tagReady(event))
  }

  private tagReady(event: TagReadyEvent): void {
    const { target } = event

    // This rule only applies to <a> tags.
    if (target.tagName !== 'a') {
      return
    }

    const href = target.getAttribute('href')?.value
    if (typeof href !== 'string' || !href) {
      return
    }
    if (!href.startsWith('mailto:')) {
      return
    }

    try {
      const url = new URL(href)
      const missingParams = this.options.requiredParameters.filter(param => {
        return !url.searchParams.has(param)
      })

      if (missingParams.length > 0) {
        this.report({
          node: target,
          message: `mailto: link is missing required parameters: ${missingParams.join(', ')}`,
        })
      }
    } catch (e) {
      // Handle cases where the mailto: URL is malformed and cannot be parsed.
      this.report({
        node: target,
        message: 'mailto: link is malformed and could not be parsed.',
      })
    }
  }
}
