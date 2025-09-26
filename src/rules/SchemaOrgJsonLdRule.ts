import { type RuleDocumentation, type DOMReadyEvent, Rule, type HtmlElement } from 'html-validate'
import { load as cheerioLoad } from 'cheerio'
import schema from '../vendor/schemaorg-current-https.json' assert { type: 'json' }

interface SchemaDef {
  '@id': string
  '@type': string | string[]
  'rdfs:label': string
}

type SchemaContext = Record<string, string>

export default class SchemaOrgJsonLdRule extends Rule {
  private readonly validClasses: Set<string> = new Set()
  private readonly validProperties: Set<string> = new Set()

  public constructor() {
    super()

    try {
      const context = schema['@context'] as SchemaContext
      const rdfsClassUrl = context.rdfs + 'Class'
      const rdfPropertyUrl = context.rdf + 'Property'

      if (schema['@graph']) {
        for (const def of schema['@graph'] as SchemaDef[]) {
          const types = Array.isArray(def['@type']) ? def['@type'] : [def['@type']]

          if (types.includes('rdfs:Class') || types.includes(rdfsClassUrl)) {
            this.validClasses.add(def['rdfs:label'])
          }

          if (types.includes('rdf:Property') || types.includes(rdfPropertyUrl)) {
            this.validProperties.add(def['rdfs:label'])
          }
        }
      }

      if (this.validClasses.size === 0 || this.validProperties.size === 0) {
        throw new Error(
          'Schema loading resulted in zero classes or properties. The vocabulary format may have changed.'
        )
      }
    } catch (error: any) {
      throw new Error(
        `[SchemaOrgJsonLdRule] CRITICAL: Failed to load or process schema: ${error.message}`
      )
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Validates JSON-LD against the bundled Schema.org vocabulary.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#schema-org-json-ld',
    }
  }

  public override setup(): void {
    // Wait for the entire document to be parsed.
    this.on('dom:ready', (event: DOMReadyEvent) => {
      const { document, source } = event
      const selector = 'script[type="application/ld+json"]'

      // Use html-validate's selector engine to see if this file has matches or
      // not. And also use the nodes for reporting later.
      const scriptNodes = document.querySelectorAll(selector)

      // If no matching script tags are found, there's nothing to do.
      if (scriptNodes.length === 0) {
        return
      }

      // We use Cheerio because html-validate's parser fails to provide the
      // text content of script tags. This is a robust workaround.
      const $ = cheerioLoad(source.data)

      // Find the same script tags using Cheerio to extract their content.
      const cheerioScripts = $(selector)

      cheerioScripts.each((index, cheerioElement) => {
        // Get the text content from the Cheerio element.
        const content = $(cheerioElement).text()
        if (!content || content.trim() === '') return

        // Get the corresponding html-validate node for reporting.
        // This links the content from Cheerio back to the source location from html-validate.
        const reportNode = scriptNodes[index]!

        let data: any
        try {
          data = JSON.parse(content)
        } catch (error: any) {
          this.report({ node: reportNode, message: `Invalid JSON syntax: ${error.message}` })
          return
        }
        this.validateSchemaObject(data, reportNode, true)
      })
    })
  }

  private validateSchemaObject(data: any, node: HtmlElement, isTopLevel: boolean): void {
    if (Array.isArray(data)) {
      // When the top-level is an array, each item is considered a top-level entity.
      data.forEach(item => this.validateSchemaObject(item, node, isTopLevel))
      return
    }

    if (typeof data !== 'object' || data === null) {
      return
    }

    // Handle the @graph pattern
    if (isTopLevel && data['@graph'] && Array.isArray(data['@graph'])) {
      // If @graph exists at the top level, we validate its children as top-level entities.
      // The container object itself doesn't need a @type.
      this.validateSchemaObject(data['@graph'], node, true)
      return // Stop processing the container object here.
    }

    const typeValue = data['@type']

    // The @type property is required for a top-level entity.
    if (isTopLevel && !typeValue) {
      this.report({
        node,
        message: 'Top-level JSON-LD object is missing required "@type" property.',
      })
      // Stop validating this object if its fundamental type is missing.
      return
    }

    if (typeValue) {
      const types = Array.isArray(typeValue) ? typeValue : [typeValue]
      for (const type of types) {
        if (!this.validClasses.has(type)) {
          this.report({
            node,
            message: `Schema.org type "${type}" is not a valid class.`,
          })
        }
      }
    }

    for (const key in data) {
      if (key.startsWith('@')) {
        continue
      }

      if (!this.validProperties.has(key)) {
        this.report({
          node,
          message: `Schema.org property "${key}" is not a valid property.`,
        })
      }

      // Recurse into nested objects. These are no longer considered "top-level".
      const value = data[key]
      if (typeof value === 'object' && value !== null) {
        this.validateSchemaObject(value, node, false)
      }
    }
  }
}
