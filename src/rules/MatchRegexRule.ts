import { type RuleDocumentation, type DOMReadyEvent, type SchemaObject, Rule } from 'html-validate'

interface RuleOptions {
  mustMatch: string[]
  mustNotMatch: string[]
}

const defaults: RuleOptions = {
  mustMatch: [],
  mustNotMatch: [],
}

export default class MatchRegexRule extends Rule<void, RuleOptions> {
  public constructor(options: Partial<RuleOptions>) {
    super({ ...defaults, ...options })
  }

  public static override schema(): SchemaObject {
    return {
      mustMatch: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'An array of regex patterns (as strings) that the page source must match.',
      },
      mustNotMatch: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'An array of regex patterns (as strings) that the page source must not match.',
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description:
        'Requires page source to match all mustMatch regexes and none of the mustNotMatch regexes.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#rules',
    }
  }

  public override setup(): void {
    this.on('dom:ready', (event: DOMReadyEvent) => {
      const rawHTML = event.source.data

      for (const pattern of this.options.mustMatch) {
        const regex = new RegExp(pattern, 's')
        if (!regex.test(rawHTML)) {
          this.report({
            node: event.document.root,
            message: `Page source does not match required pattern: ${pattern}`,
          })
        }
      }

      for (const pattern of this.options.mustNotMatch) {
        const regex = new RegExp(pattern, 's')
        if (regex.test(rawHTML)) {
          this.report({
            node: event.document.root,
            message: `Page source matches forbidden pattern: ${pattern}`,
          })
        }
      }
    })
  }
}
