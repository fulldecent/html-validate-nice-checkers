import {
  type RuleDocumentation,
  type TagReadyEvent,
  type HtmlElement,
  type SchemaObject,
  Rule,
} from 'html-validate'
import fs from 'node:fs'
import path from 'node:path'

interface RuleOptions {
  webRoot: string
  alternativeExtensions: string[]
  indexFile: string
}

const defaults: RuleOptions = {
  webRoot: path.join(process.cwd(), 'build'),
  alternativeExtensions: ['.html', '.php'],
  indexFile: 'index.html',
}

export default class InternalLinksRule extends Rule<void, RuleOptions> {
  private readonly fileExistsCache = new Map<string, boolean>()
  private readonly fileIdsCache = new Map<string, Set<string>>()

  public constructor(options: Partial<RuleOptions>) {
    /* assign default values if not provided by user */
    super({ ...defaults, ...options })
  }

  public static override schema(): SchemaObject {
    return {
      webRoot: {
        type: 'string',
        description: 'The root directory for resolving absolute links (starting with "/").',
      },
      alternativeExtensions: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'List of file extensions to check for extensionless links (e.g., [".html"]).',
      },
      indexFile: {
        type: 'string',
        description: "The file to look for in directory links (e.g., 'index.html').",
      },
    }
  }

  public override documentation(): RuleDocumentation {
    return {
      description: 'Validate that all internal links point to existing files.',
      url: 'https://github.com/fulldecent/html-validate-nice-checkers/blob/main/README.md#rules',
    }
  }

  public override setup(): void {
    this.on('tag:ready', (event: TagReadyEvent) => this.tagReady(event))
  }

  private doesFileExist(filePath: string): boolean {
    if (this.fileExistsCache.has(filePath)) {
      return this.fileExistsCache.get(filePath) as boolean
    }

    if (!fs.existsSync(filePath)) {
      this.fileExistsCache.set(filePath, false)
      return false
    }

    if (!fs.lstatSync(filePath).isFile()) {
      this.fileExistsCache.set(filePath, false)
      return false
    }

    // Check case sensitivity by comparing with actual directory listing
    // This prevents issues where macOS treats /abc.webp and /AbC.webp as the same
    // but Linux would treat them differently
    try {
      const dirPath = path.dirname(filePath)
      const requestedBasename = path.basename(filePath)

      // Read actual directory contents to get exact case
      const actualFiles = fs.readdirSync(dirPath)
      const exists = actualFiles.includes(requestedBasename)

      this.fileExistsCache.set(filePath, exists)
      return exists
    } catch (e) {
      this.fileExistsCache.set(filePath, false)
      return false
    }
  }

  private checkLink(internalLink: string, fragment: string | null, element: HtmlElement): void {
    let resolvedPath: string

    // Resolve absolute paths from the web root, relative paths from the current file's location.
    if (internalLink.startsWith('/')) {
      resolvedPath = path.join(this.options.webRoot, internalLink)
    } else {
      const basePath = path.dirname(element.location.filename)
      resolvedPath = path.resolve(basePath, internalLink)
    }

    // Case 1: Link ends with '/', check for an index file in that directory.
    if (internalLink.endsWith('/')) {
      const directoryPath = resolvedPath
      if (fs.existsSync(directoryPath) && fs.lstatSync(directoryPath).isDirectory()) {
        const indexPath = path.join(directoryPath, this.options.indexFile)
        if (this.doesFileExist(indexPath)) {
          if (fragment) {
            this.checkFragment(fragment, indexPath, path.basename(directoryPath) + '/', element)
          }
          return // Link is valid.
        }
      }
    } else {
      // Case 2: Link does not end with '/'.
      // Check for a direct file match or a file with an alternative extension.
      if (this.doesFileExist(resolvedPath)) {
        if (fragment) {
          this.checkFragment(fragment, resolvedPath, internalLink, element)
        }
        return // Direct file match is valid.
      }
      
      // Check alternative extensions
      for (const ext of this.options.alternativeExtensions) {
        if (this.doesFileExist(resolvedPath + ext)) {
          if (fragment) {
            this.checkFragment(fragment, resolvedPath + ext, internalLink, element)
          }
          return // Extensionless link is valid.
        }
      }

      // Also check if it's a directory containing an index file.
      // E.g., a link to "/about" can resolve to "/about/index.html".
      if (fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isDirectory()) {
        const indexPath = path.join(resolvedPath, this.options.indexFile)
        if (this.doesFileExist(indexPath)) {
          if (fragment) {
            this.checkFragment(fragment, indexPath, internalLink, element)
          }
          return // Directory link is valid.
        }
      }
    }

    // If no valid file was found after all checks, report the error.
    this.report({
      node: element,
      message: `Internal link to "${internalLink}" is broken.`,
    })
  }

  private getFileIds(filePath: string): Set<string> {
    if (this.fileIdsCache.has(filePath)) {
      return this.fileIdsCache.get(filePath) as Set<string>
    }

    const ids = new Set<string>()
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      // Match id attribute: requires whitespace before 'id', handles quoted values
      // Uses capturing group to ensure matching quotes (double or single)
      const idRegex = /\sid=(["'])([^"']*)\1/gi
      let match
      while ((match = idRegex.exec(content)) !== null) {
        if (match[2]) {
          ids.add(match[2])
        }
      }
    } catch {
      // File cannot be read, return empty set
    }
    this.fileIdsCache.set(filePath, ids)
    return ids
  }

  private checkFragment(fragment: string, filePath: string, displayPath: string, element: HtmlElement): void {
    const ids = this.getFileIds(filePath)
    if (!ids.has(fragment)) {
      this.report({
        node: element,
        message: `Fragment "#${fragment}" not found in "${displayPath}".`,
      })
    }
  }

  private checkSelfFragment(fragment: string, element: HtmlElement): void {
    // For self-links, check the current document
    const currentFile = element.location.filename
    const ids = this.getFileIds(currentFile)
    if (!ids.has(fragment)) {
      this.report({
        node: element,
        message: `Fragment "#${fragment}" not found in current document.`,
      })
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
    if (typeof rawUrl !== 'string' || !rawUrl) {
      return
    }

    // Extract fragment if present
    const fragmentMatch = rawUrl.match(/#([^?]*)/)
    const fragment = fragmentMatch?.[1] ?? null

    // Strip fragment and query parameters.
    const url = rawUrl.replace(/[#?].*$/, '')
    
    // Handle self-links (just a fragment, no file path)
    if (!url && fragment) {
      this.checkSelfFragment(fragment, target)
      return
    }
    
    if (!url) {
      return
    }

    // Skip absolute URLs.
    // An internal link does not have a protocol (http:, mailto:, etc.).
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return
    }

    // The URL is internal, now check if it's valid.
    this.checkLink(url, fragment, target)
  }
}
