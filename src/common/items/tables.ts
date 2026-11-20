/**
 * Diablo II data tables (`data/global/excel/*.txt`).
 *
 * Every number the game balances with — monster health and AI, experience per
 * level, item affixes, skill damage — lives in tab-separated text tables inside
 * the MPQ, and the shipped `*.bin` files are just a compiled form of the same
 * rows. Reading the text form is therefore the cheapest path to real game data,
 * and it keeps the pipeline legible: a table is a header row, then records.
 *
 * Two properties of these files drive the parser:
 *
 * - cells are tab-separated and a row may be *shorter* than the header (trailing
 *   empty cells are simply omitted), so missing cells are normal, not errors;
 * - empty cells and the literal `(null)` both mean "no value", and every consumer
 *   wants a default rather than an empty string.
 *
 * Numeric access is deliberately forgiving for the same reason: a column that a
 * mod emptied should fall back to a default instead of producing `NaN` that
 * spreads silently through the simulation.
 */

/** A parsed table: column names plus one record per row. */
export interface DataTable {
  /** Column names, in file order. */
  readonly columns: readonly string[]
  /** Records keyed by column name. */
  readonly rows: readonly Readonly<Record<string, string>>[]
}

/** Raised when a table cannot be parsed at all. */
export class TableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TableError'
  }
}

/** Cell text that means "no value". */
const NULL_CELL = '(null)'

/**
 * Parse a tab-separated data table.
 *
 * @param text - the file's text.
 * @returns the parsed table.
 */
export function parseTable(text: string): DataTable {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  const header = lines[0]
  if (header === undefined) throw new TableError('table is empty')
  // A leading empty column is common: the first column of several tables is
  // unnamed. It is kept as an empty name so indices still line up.
  const columns = header.split('\t').map(name => name.trim())
  if (columns.every(name => name === '')) throw new TableError('table has no column names')

  const rows: Record<string, string>[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    const row: Record<string, string> = {}
    columns.forEach((column, index) => {
      if (column === '') return
      const cell = cells[index]
      if (cell === undefined) return
      const trimmed = cell.trim()
      if (trimmed === '' || trimmed === NULL_CELL) return
      row[column] = trimmed
    })
    rows.push(row)
  }
  return { columns, rows }
}

/**
 * Read a numeric cell.
 *
 * @param row - the record.
 * @param column - column name.
 * @param fallback - value to use when the cell is missing or unparsable.
 * @returns the number.
 */
export function numberCell(row: Readonly<Record<string, string>>, column: string, fallback: number): number {
  const raw = row[column]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/**
 * Read a text cell.
 *
 * @param row - the record.
 * @param column - column name.
 * @param fallback - value to use when the cell is missing.
 * @returns the text.
 */
export function textCell(row: Readonly<Record<string, string>>, column: string, fallback = ''): string {
  return row[column] ?? fallback
}

/**
 * Look up a record by one column's value.
 *
 * @param table - the table.
 * @param column - the column to match.
 * @param value - the value to match (case-insensitive).
 * @returns the record, or undefined.
 */
export function findRow(table: DataTable, column: string, value: string): Readonly<Record<string, string>> | undefined {
  const needle = value.toLowerCase()
  return table.rows.find(row => (row[column] ?? '').toLowerCase() === needle)
}

/**
 * A source of strings addressed by index — a decoded `.tbl`.
 */
export interface TextSource {
  /**
   * Resolve one index.
   *
   * @param index - the string index.
   * @returns the text, or undefined when the index is unused.
   */
  get: (index: number) => string | undefined
}

/**
 * Wrap decoded table entries as a text source.
 *
 * @param entries - a decoded `.tbl`, or null when the archive has none.
 * @returns the source (empty when there is no table).
 */
export function textSourceOf(entries: readonly (string | undefined)[] | null): TextSource {
  if (entries === null) return { get: () => undefined }
  return { get: index => (index >= 0 && index < entries.length ? entries[index] : undefined) }
}

/**
 * Resolve a table cell that holds either a literal or a string index.
 *
 * Diablo II tables mix the two: `Skills.txt` names skills by index into
 * `string.tbl`, while mods and many tools write the words directly. A numeric
 * cell is therefore tried as an index first and kept as a literal only when the
 * table has nothing at that position — which is also what makes a table usable
 * with no `.tbl` loaded at all.
 *
 * @param cell - the raw cell text.
 * @param source - the text source, when a table is loaded.
 * @returns the resolved text.
 */
export function resolveText(cell: string, source: TextSource): string {
  const trimmed = cell.trim()
  if (trimmed === '') return ''
  if (!/^\d+$/.test(trimmed)) return trimmed
  return source.get(Number(trimmed)) ?? trimmed
}

/**
 * Case-insensitive, whitespace-tolerant Map that preserves original key casing for iteration.
 */
export class CaseInsensitiveMap<V> extends Map<string, V> {
  private readonly _keyMap = new Map<string, string>()

  override get(key: string): V | undefined {
    if (typeof key !== 'string') return undefined
    const lower = key.trim().toLowerCase()
    const original = this._keyMap.get(lower)
    return original !== undefined ? super.get(original) : super.get(key)
  }

  override has(key: string): boolean {
    if (typeof key !== 'string') return false
    const lower = key.trim().toLowerCase()
    return this._keyMap.has(lower) || super.has(key)
  }

  override set(key: string, value: V): this {
    const lower = typeof key === 'string' ? key.trim().toLowerCase() : String(key).trim().toLowerCase()
    const prevOriginal = this._keyMap.get(lower)
    if (prevOriginal !== undefined && prevOriginal !== key) {
      super.delete(prevOriginal)
    }
    this._keyMap.set(lower, key)
    return super.set(key, value)
  }

  override delete(key: string): boolean {
    const lower = typeof key === 'string' ? key.trim().toLowerCase() : String(key).trim().toLowerCase()
    const original = this._keyMap.get(lower)
    this._keyMap.delete(lower)
    return super.delete(original ?? key)
  }

  override clear(): void {
    this._keyMap.clear()
    super.clear()
  }
}
