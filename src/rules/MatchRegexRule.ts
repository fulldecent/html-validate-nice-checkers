import { type RuleDocumentation, type DOMReadyEvent, type SchemaObject, Rule } from 'html-validate'

interface RuleOptions {
  mustMatch: (string | RegExp)[]
  mustNotMatch: (string | RegExp)[]
}

const defaults: RuleOptions = {
  mustMatch: [],
  mustNotMatch: [],
}

export default class MatchRegexRule extends Rule<void, RuleOptions> {
  private readonly mustMatchCompiled: RegExp[]
  private readonly mustNotMatchCompiled: RegExp[]

  public constructor(options: Partial<RuleOptions>) {
    super({ ...defaults, ...options })
    this.mustMatchCompiled = this.compilePatterns(this.options.mustMatch, 'mustMatch')
    this.mustNotMatchCompiled = this.compilePatterns(this.options.mustNotMatch, 'mustNotMatch')
  }

  private compilePatterns(patterns: (string | RegExp)[], optionName: string): RegExp[] {
    return patterns
      .map(pattern => {
        try {
          if (pattern instanceof RegExp) {
            // Preserve existing flags and add 's' (dotAll) if not already present
            const flags = pattern.flags.includes('s') ? pattern.flags : pattern.flags + 's'
            return new RegExp(pattern.source, flags)
          }
          return new RegExp(pattern, 's')
        } catch (e) {
          console.error(
            `[html-validate-nice-checkers] Invalid regex pattern in '${optionName}' configuration: "${pattern}"`
          )
          return null
        }
      })
      .filter((regex): regex is RegExp => regex !== null)
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

      for (const regex of this.mustMatchCompiled) {
        if (!regex.test(rawHTML)) {
          this.report({
            node: event.document.root,
            message: `Page source does not match required pattern: ${regex.source}`,
          })
        }
      }

      for (const regex of this.mustNotMatchCompiled) {
        if (regex.test(rawHTML)) {
          this.report({
            node: event.document.root,
            message: `Page source matches forbidden pattern: ${regex.source}`,
          })
        }
      }
    })
  }
}
