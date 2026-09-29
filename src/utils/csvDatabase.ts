import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type CsvRow = Record<string, string>

const WRITE_EVERY_UPDATES = 10

// Shared per resolved path because html-validate creates rule instances for every document
const openDatabases = new Map<string, CsvDatabase>()
let exitHookInstalled = false

/** Parses RFC 4180 CSV text into records, skipping blank lines */
export function parseCsv(text: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  return records.filter(r => !(r.length === 1 && r[0] === ''))
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function stringifyCsv(records: string[][]): string {
  return records.map(record => record.map(csvField).join(',')).join('\n') + '\n'
}

/**
 * A CSV file with a header row, held in memory as a Map keyed by the first column.
 *
 * Writes go to a temporary file which is then renamed over the original.
 */
export class CsvDatabase {
  private readonly rows = new Map<string, CsvRow>()
  private pendingUpdates = 0

  private constructor(
    private readonly filePath: string,
    private readonly columns: string[],
    private isExpired: (row: CsvRow) => boolean
  ) {
    this.load()
  }

  public static open(
    filePath: string,
    columns: string[],
    isExpired: (row: CsvRow) => boolean
  ): CsvDatabase {
    const resolvedPath = path.resolve(filePath)
    let db = openDatabases.get(resolvedPath)
    if (db) {
      db.isExpired = isExpired
    } else {
      db = new CsvDatabase(resolvedPath, columns, isExpired)
      openDatabases.set(resolvedPath, db)
    }

    if (!exitHookInstalled) {
      process.on('exit', () => openDatabases.forEach(openDb => openDb.close()))
      exitHookInstalled = true
    }
    return db
  }

  public get(key: string): CsvRow | undefined {
    const row = this.rows.get(key)
    return row && !this.isExpired(row) ? row : undefined
  }

  public set(row: CsvRow): void {
    this.rows.set(row[this.columns[0]!] ?? '', row)
    this.pendingUpdates++
    if (this.pendingUpdates >= WRITE_EVERY_UPDATES) {
      this.write()
    }
  }

  /** Writes to disk if there are unsaved updates */
  public close(): void {
    if (this.pendingUpdates > 0) {
      this.write()
    }
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      return
    }

    const [header, ...records] = parseCsv(fs.readFileSync(this.filePath, 'utf-8'))
    if (!header) {
      return
    }

    const indexes = this.columns.map(column => header.indexOf(column))
    for (const record of records) {
      const row: CsvRow = {}
      this.columns.forEach((column, i) => {
        row[column] = record[indexes[i]!] ?? ''
      })
      const key = row[this.columns[0]!]
      if (!key) continue
      if (this.isExpired(row)) {
        this.rows.delete(key)
      } else {
        this.rows.set(key, row)
      }
    }
  }

  private write(): void {
    for (const [key, row] of this.rows) {
      if (this.isExpired(row)) {
        this.rows.delete(key)
      }
    }

    const records = [...this.rows.values()].map(row =>
      this.columns.map(column => row[column] ?? '')
    )
    const tempPath = `${this.filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(tempPath, stringifyCsv([this.columns, ...records]))
    fs.renameSync(tempPath, this.filePath)
    this.pendingUpdates = 0
  }
}
