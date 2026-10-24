/**
 * Packet capture hook (`PacketTap`) and `.d2cap` JSONL wire capture serializer/parser.
 */

export type PacketConn = 'bnet' | 'realm' | 'game' | 'ts'
export type PacketDirection = 'c2s' | 's2c'

export interface PacketTapEntry {
  readonly t: number
  readonly conn: PacketConn
  readonly dir: PacketDirection
  /** Raw wire or framed packet bytes. */
  readonly raw: Uint8Array
  /** Optional packet opcode. */
  readonly packetId?: number | undefined
  /** Optional symbolic packet name. */
  readonly packetName?: string | undefined
  /** Optional decoded packet object or summary. */
  readonly decoded?: unknown
  /** True if `raw` is a raw stream chunk rather than a split logical packet. */
  readonly isRawStreamChunk?: boolean | undefined
}

export interface PacketTap {
  record(entry: PacketTapEntry): void
}

export interface D2CapHeader {
  readonly format: 'd2cap-v1'
  readonly createdAt: string
  readonly server: string
  readonly account?: string | undefined
  readonly character?: string | undefined
  readonly scenario?: string | undefined
}

export interface D2CapRecord {
  readonly t: number
  readonly conn: PacketConn
  readonly dir: PacketDirection
  readonly hex: string
  readonly packetId?: number | undefined
  readonly packetName?: string | undefined
  readonly stream?: boolean | undefined
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/\s+/g, '')
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string length ${clean.length}`)
  }
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex byte at offset ${i * 2}`)
    }
    out[i] = byte
  }
  return out
}

export function formatD2CapHeader(header: D2CapHeader): string {
  return JSON.stringify(header)
}

export function formatD2CapEntry(entry: PacketTapEntry): string {
  const rec: D2CapRecord = {
    t: entry.t,
    conn: entry.conn,
    dir: entry.dir,
    hex: bytesToHex(entry.raw),
    ...(entry.packetId !== undefined ? { packetId: entry.packetId } : {}),
    ...(entry.packetName !== undefined ? { packetName: entry.packetName } : {}),
    ...(entry.isRawStreamChunk ? { stream: true } : {}),
  }
  return JSON.stringify(rec)
}

export class InMemoryPacketTap implements PacketTap {
  readonly entries: PacketTapEntry[] = []
  private readonly maxEntries: number

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries
  }

  record(entry: PacketTapEntry): void {
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift()
    }
    this.entries.push(entry)
  }

  clear(): void {
    this.entries.length = 0
  }

  toD2CapJsonl(header: D2CapHeader): string {
    const lines = [formatD2CapHeader(header)]
    for (const e of this.entries) {
      lines.push(formatD2CapEntry(e))
    }
    return lines.join('\n') + '\n'
  }
}

export function parseD2CapJsonl(jsonlText: string): {
  readonly header: D2CapHeader | null
  readonly records: D2CapRecord[]
} {
  const lines = jsonlText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
  let header: D2CapHeader | null = null
  const records: D2CapRecord[] = []

  for (let i = 0; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]!) as Record<string, unknown>
    if (i === 0 && parsed.format === 'd2cap-v1') {
      header = parsed as unknown as D2CapHeader
      continue
    }
    const rawConn = typeof parsed.conn === 'string' ? parsed.conn : typeof parsed.channel === 'string' ? parsed.channel : undefined
    const rawDir = typeof parsed.dir === 'string' ? parsed.dir.toLowerCase() : undefined
    const rawT = typeof parsed.t === 'number' ? parsed.t : typeof parsed.ts === 'number' ? parsed.ts : 0
    if (typeof parsed.hex === 'string' && rawConn !== undefined && (rawDir === 's2c' || rawDir === 'c2s')) {
      const connNorm = rawConn.toLowerCase()
      const conn: PacketConn =
        connNorm === 'd2gs' || connNorm === 'game'
          ? 'game'
          : connNorm === 'mcp' || connNorm === 'realm'
            ? 'realm'
            : 'bnet'
      records.push({
        t: rawT,
        conn,
        dir: rawDir as PacketDirection,
        hex: parsed.hex,
        ...(typeof parsed.packetId === 'number' ? { packetId: parsed.packetId } : {}),
        ...(typeof parsed.packetName === 'string' ? { packetName: parsed.packetName } : {}),
        ...(typeof parsed.stream === 'boolean' ? { stream: parsed.stream } : {}),
      })
    }
  }

  return { header, records }
}

export type PacketTapConn = PacketConn
export type PacketTapDir = PacketDirection
export { InMemoryPacketTap as MemoryPacketTap }

