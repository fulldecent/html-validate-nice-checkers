import { execFileSync } from 'node:child_process'

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

const STATUS_MARK = '__SYNC_FETCH_STATUS__:'
const REDIRECT_MARK = '__SYNC_FETCH_REDIRECT__:'
const DEV_NULL = process.platform === 'win32' ? 'NUL' : '/dev/null'

export function syncFetch(url: string, options: SyncFetchOptions = {}): SyncFetchResult {
  const {
    timeoutSeconds = 5,
    userAgent = 'Mozilla/5.0 (compatible; html-validate-nice-checkers)',
    headOnly = false,
    maxRedirs = 0,
    failOnError = false,
    headers = {},
  } = options

  const args = [
    '--silent',
    '--show-error',
    '--max-time',
    String(timeoutSeconds),
    '--max-redirs',
    String(maxRedirs),
    '--user-agent',
    userAgent,
    '--dump-header',
    '-',
    '-w',
    `\n${STATUS_MARK}%{http_code}\n${REDIRECT_MARK}%{redirect_url}`,
  ]

  if (headOnly) {
    args.push('--head', '--output', DEV_NULL)
  }

  if (failOnError) {
    args.push('--fail')
  }

  for (const [key, value] of Object.entries(headers)) {
    args.push('--header', `${key}: ${value}`)
  }

  args.push(url)

  try {
    const output = execFileSync('curl', args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    return parseCurlOutput(output, headOnly)
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    if (typeof err.stdout === 'string' && err.stdout.includes(STATUS_MARK)) {
      return parseCurlOutput(err.stdout, headOnly)
    }
    return {
      success: false,
      error: (typeof err.stderr === 'string' && err.stderr.trim()) || err.message || String(e),
    }
  }
}

export function syncHead(url: string, options: SyncFetchOptions = {}): SyncFetchResult {
  return syncFetch(url, { ...options, headOnly: true })
}

function parseCurlOutput(output: string, headOnly: boolean): SyncFetchResult {
  const statusIdx = output.lastIndexOf(`\n${STATUS_MARK}`)
  const raw = statusIdx === -1 ? output : output.slice(0, statusIdx)
  const footer = statusIdx === -1 ? '' : output.slice(statusIdx + 1)

  const writeOutStatus = footer.match(/^__SYNC_FETCH_STATUS__:(\d{3})/m)?.[1]
  const headerStatuses = [...raw.matchAll(/^HTTP\/[0-9.]+ (\d{3})/gm)].map(m => m[1])
  const statusText =
    writeOutStatus && writeOutStatus !== '000'
      ? writeOutStatus
      : headerStatuses[headerStatuses.length - 1]
  const statusCode = statusText ? parseInt(statusText, 10) : undefined

  const writeOutRedirect = footer.match(/^__SYNC_FETCH_REDIRECT__:(.*)$/m)?.[1]?.trim()
  const location = raw.match(/^Location: (.+)/im)?.[1]?.trim()
  const redirectTo = location || writeOutRedirect || undefined

  const headerBodySplit = raw.split(/\r?\n\r?\n/)
  const responseHeaders = headerBodySplit[0] || ''
  const body = headerBodySplit.slice(1).join('\n\n')

  return {
    success: statusCode !== undefined && statusCode >= 200 && statusCode < 400,
    headers: responseHeaders,
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(headOnly ? {} : { body }),
    ...(redirectTo === undefined ? {} : { redirectTo }),
  }
}
