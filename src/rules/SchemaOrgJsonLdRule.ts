import {
  type RuleDocumentation,
  type ElementReadyEvent,
  Rule,
  type HtmlElement,
} from 'html-validate'
import schema from '../vendor/schemaorg-current-https.json' with { type: 'json' }

interface SchemaDef {
  '@id': string
  '@type': string | string[]
  'rdfs:label': string
  'rdfs:subClassOf'?: { '@id': string } | { '@id': string }[]
}

type SchemaContext = Record<string, string>

export default class SchemaOrgJsonLdRule extends Rule {
  private static readonly ANNOTATION_PATTERN = /^(.+)-(input|output)$/

  private readonly validClasses: Set<string> = new Set()
  private readonly validProperties: Set<string> = new Set()
  /**
   * All Schema.org classes that are Action or a subtype of Action (transitively).
   * Used to scope -input/-output annotations: per the Actions spec, these annotations
   * are only valid within the property graph of an Action.
   * Reference: https://schema.org/docs/actions.html (Part 4: Input and Output constraints)
   */
  private readonly actionSubclasses: Set<string> = new Set()

  public constructor() {
    super()

    try {
      const context = schema['@context'] as SchemaContext
      const rdfsClassUrl = context.rdfs + 'Class'
      const rdfPropertyUrl = context.rdf + 'Property'

      // child label -> parent labels mapping, for building actionSubclasses
      const subClassChildren = new Map<string, string[]>()

      if (schema['@graph']) {
        for (const def of schema['@graph'] as SchemaDef[]) {
          const types = Array.isArray(def['@type']) ? def['@type'] : [def['@type']]

          if (types.includes('rdfs:Class') || types.includes(rdfsClassUrl)) {
            this.validClasses.add(def['rdfs:label'])

            // Build parent->children map for BFS below.
            // IDs use "schema:ClassName" prefix; extract the label after the colon.
            const subClassOf = def['rdfs:subClassOf']
            if (subClassOf) {
              const parents = Array.isArray(subClassOf) ? subClassOf : [subClassOf]
              for (const parent of parents) {
                const parentId = parent['@id']
                const parentLabel = parentId.includes(':')
                  ? (parentId.split(':')[1] ?? parentId)
                  : (parentId.split('/').pop() ?? parentId)
                if (!subClassChildren.has(parentLabel)) subClassChildren.set(parentLabel, [])
                subClassChildren.get(parentLabel)!.push(def['rdfs:label'])
              }
            }
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

      // BFS from Action to collect all Action subtypes.
      const bfsQueue = ['Action']
      this.actionSubclasses.add('Action')
      while (bfsQueue.length > 0) {
        const current = bfsQueue.shift()!
        for (const child of subClassChildren.get(current) ?? []) {
          if (!this.actionSubclasses.has(child)) {
            this.actionSubclasses.add(child)
            bfsQueue.push(child)
          }
        }
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
    this.on('element:ready', (event: ElementReadyEvent) => this.elementReady(event))
  }

  private elementReady(event: ElementReadyEvent): void {
    const { target } = event

    // This rule only applies to <script type="application/ld+json"> tags.
    if (target.tagName !== 'script') {
      return
    }

    const typeAttr = target.getAttribute('type')?.value
    if (typeAttr !== 'application/ld+json') {
      return
    }

    // Access the text content directly from the element.
    const content = target.textContent
    if (!content || content.trim() === '') {
      return
    }

    let data: any
    try {
      data = JSON.parse(content)
    } catch (error: any) {
      this.report({ node: target, message: `Invalid JSON syntax: ${error.message}` })
      return
    }

    this.validateSchemaObject(data, target, true)
  }

  /**
   * Returns true if the property key is valid in the given context.
   *
   * In addition to direct property names, Schema.org Actions support open-ended
   * property annotations using a hyphen suffix. Any property of an Action (or any
   * object nested within an Action's property graph) can be annotated with "-input"
   * (indicating how to fill in that property before executing the action) or
   * "-output" (indicating what will be present in the completed action).
   * For example, "query-input" annotates the "query" property of SearchAction.
   *
   * These annotations are only valid inside an Action's property graph, not on
   * arbitrary top-level objects such as WebSite or Person.
   *
   * Reference: https://schema.org/docs/actions.html (Part 4: Input and Output constraints)
   */
  private isValidProperty(key: string, insideAction: boolean): boolean {
    if (this.validProperties.has(key)) {
      return true
    }
    const annotationMatch = SchemaOrgJsonLdRule.ANNOTATION_PATTERN.exec(key)
    if (annotationMatch && insideAction) {
      const baseProperty = annotationMatch[1] ?? ''
      return this.validProperties.has(baseProperty)
    }
    return false
  }

  private validateSchemaObject(
    data: any,
    node: HtmlElement,
    isTopLevel: boolean,
    insideAction = false
  ): void {
    if (Array.isArray(data)) {
      // When the top-level is an array, each item is considered a top-level entity.
      data.forEach(item => this.validateSchemaObject(item, node, isTopLevel, insideAction))
      return
    }

    if (typeof data !== 'object' || data === null) {
      return
    }

    // Handle the @graph pattern
    if (isTopLevel && data['@graph'] && Array.isArray(data['@graph'])) {
      // If @graph exists at the top level, we validate its children as top-level entities.
      // The container object itself doesn't need a @type.
      this.validateSchemaObject(data['@graph'], node, true, insideAction)
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
      // Once we enter an Action (or Action subtype), annotations are valid for
      // this object and all objects recursively nested within it.
      if (types.some(t => this.actionSubclasses.has(t))) {
        insideAction = true
      }
    }

    for (const key in data) {
      if (key.startsWith('@')) {
        continue
      }

      if (!this.isValidProperty(key, insideAction)) {
        this.report({
          node,
          message: `Schema.org property "${key}" is not a valid property.`,
        })
      }

      // Recurse into nested objects. These are no longer considered "top-level".
      const value = data[key]
      if (typeof value === 'object' && value !== null) {
        this.validateSchemaObject(value, node, false, insideAction)
      }
    }
  }
}
