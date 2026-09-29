import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CsvDatabase, parseCsv, stringifyCsv } from '../src/utils/csvDatabase'

const neverExpires = () => false

describe('parseCsv', () => {
  it('parses quoted fields containing commas, quotes and newlines', () => {
    const text = 'a,b\n"x,1","say ""hi""\nthere"\r\n\nplain,\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x,1', 'say "hi"\nthere'],
      ['plain', ''],
    ])
  })

  it('round-trips with stringifyCsv', () => {
    const records = [
      ['url', 'note'],
      ['https://example.com/?a=1,2', 'has "quotes"'],
      ['https://example.com/', ''],
    ]
    expect(parseCsv(stringifyCsv(records))).toEqual(records)
  })
})

describe('CsvDatabase', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-database-'))
    filePath = path.join(dir, 'nested', 'cache.csv')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('treats a missing file as empty', () => {
    const db = CsvDatabase.open(filePath, ['url', 'time'], neverExpires)
    expect(db.get('https://example.com/')).toBeUndefined()
  })

  it('lets later rows overwrite earlier rows with the same key', () => {
    fs.mkdirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, 'url,status\nhttps://a/,404\nhttps://b/,200\nhttps://a/,200\n')
    const db = CsvDatabase.open(filePath, ['url', 'status'], neverExpires)
    expect(db.get('https://a/')).toEqual({ url: 'https://a/', status: '200' })
    expect(db.get('https://b/')).toEqual({ url: 'https://b/', status: '200' })
  })

  it('maps columns by header name', () => {
    fs.mkdirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, 'status,url\n200,https://a/\n')
    const db = CsvDatabase.open(filePath, ['url', 'status'], neverExpires)
    expect(db.get('https://a/')).toEqual({ url: 'https://a/', status: '200' })
  })

  it('does not read in expired rows', () => {
    fs.mkdirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, 'url,time\nhttps://old/,100\nhttps://new/,900\n')
    const db = CsvDatabase.open(filePath, ['url', 'time'], row => Number(row.time) < 500)
    expect(db.get('https://old/')).toBeUndefined()
    expect(db.get('https://new/')).toEqual({ url: 'https://new/', time: '900' })
  })

  it('writes after every 10 updates', () => {
    const db = CsvDatabase.open(filePath, ['url', 'time'], neverExpires)
    for (let i = 0; i < 9; i++) {
      db.set({ url: `https://example.com/${i}`, time: '1' })
    }
    expect(fs.existsSync(filePath)).toBe(false)

    db.set({ url: 'https://example.com/9', time: '1' })
    expect(parseCsv(fs.readFileSync(filePath, 'utf-8'))).toHaveLength(11)
  })

  it('writes pending updates on close', () => {
    const db = CsvDatabase.open(filePath, ['url', 'redirect_to'], neverExpires)
    db.set({ url: 'https://example.com/?a=1,2', redirect_to: 'https://example.com/"x"' })
    expect(fs.existsSync(filePath)).toBe(false)

    db.close()
    expect(parseCsv(fs.readFileSync(filePath, 'utf-8'))).toEqual([
      ['url', 'redirect_to'],
      ['https://example.com/?a=1,2', 'https://example.com/"x"'],
    ])
  })

  it('leaves no temporary files behind and drops expired rows when writing', () => {
    let cutoff = 0
    const db = CsvDatabase.open(filePath, ['url', 'time'], row => Number(row.time) < cutoff)
    db.set({ url: 'https://old/', time: '100' })
    db.set({ url: 'https://new/', time: '900' })
    cutoff = 500
    db.close()

    expect(fs.readdirSync(path.dirname(filePath))).toEqual(['cache.csv'])
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('url,time\nhttps://new/,900\n')
  })

  it('shares one instance per path', () => {
    const first = CsvDatabase.open(filePath, ['url', 'time'], neverExpires)
    const second = CsvDatabase.open(
      path.join(dir, 'nested', '..', 'nested', 'cache.csv'),
      ['url', 'time'],
      neverExpires
    )
    expect(second).toBe(first)
  })
})
