import { execSync } from 'node:child_process'
import { quote as shellEscape } from 'shell-quote'

export interface SyncFetchOptions {
  timeoutSeconds?: number
  userAgent?: string
  headOnly?: boolean
  maxRedirs?: number
  failOnError?: boolean
  headers?: Record<string, string>
}

export interface SyncFetchResult {
  success: boolean
  statusCode?: number
  body?: string
  headers?: string
  redirectTo?: string
  error?: string
}

/**
 * Synchronous HTTP fetch using curl.
 * Returns the response body (or headers if headOnly) and status code.
 */
export function syncFetch(url: string, options: SyncFetchOptions = {}): SyncFetchResult {
  const {
    timeoutSeconds = 5,
    userAgent = 'Mozilla/5.0 (compatible; html-validate-nice-checkers)',
    headOnly = false,
    maxRedirs = 0,
    failOnError = false,
    headers = {},
  } = options

  const escapedUrl = shellEscape([url])

  // Build curl command
  const curlArgs = [
    'curl',
    '--silent',
    '--max-time',
    String(timeoutSeconds),
    '--max-redirs',
    String(maxRedirs),
    '--user-agent',
    shellEscape([userAgent]),
  ]

  if (headOnly) {
    curlArgs.push('--head')
  }

  if (failOnError) {
    curlArgs.push('--fail')
  }

  // Add custom headers
  for (const [key, value] of Object.entries(headers)) {
    curlArgs.push('--header', shellEscape([`${key}: ${value}`]))
  }

  // Dump headers to stdout for parsing
  curlArgs.push('--dump-header', '-')

  if (headOnly) {
    curlArgs.push('--output', '/dev/null')
  }

  curlArgs.push(escapedUrl)

  const command = curlArgs.join(' ') + ' || true'

  try {
    const output = execSync(command).toString()

    // Parse HTTP status code from response headers
    const statusCodeMatch = output.match(/^HTTP\/[0-9.]+ (\d{3})/m)
    const statusCode = statusCodeMatch?.[1] ? parseInt(statusCodeMatch[1], 10) : undefined

    // Parse Location header for redirects
    const locationMatch = output.match(/^Location: (.+)/im)
    const redirectTo = locationMatch?.[1]?.trim()

    // Split headers and body (separated by double newline)
    const headerBodySplit = output.split(/\r?\n\r?\n/)
    const responseHeaders = headerBodySplit[0] || ''
    const body = headerBodySplit.slice(1).join('\n\n')

    return {
      success: statusCode !== undefined && statusCode >= 200 && statusCode < 400,
      statusCode: statusCode,
      headers: responseHeaders,
      body: headOnly ? undefined : body,
      redirectTo: redirectTo,
    } as SyncFetchResult
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Synchronous HTTP HEAD request to check if URL is accessible.
 * Returns the HTTP status code or undefined on error.
 */
export function syncHead(url: string, options: SyncFetchOptions = {}): SyncFetchResult {
  return syncFetch(url, { ...options, headOnly: true })
}
