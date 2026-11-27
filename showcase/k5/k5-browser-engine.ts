/**
 * Pure Browser [K5] Live Single-Player `D2gsKernelBridge113c` Loopback Sandbox & PNG Metadata
 * Stripper (`showcase/k5/k5-browser-engine.ts`).
 *
 * Runs genuine `D2gsKernelBridge113c` (`src/server/net/d2gs-kernel-bridge-113c.ts`) +
 * `D2gsSession` + `D2gsAdapter` over compressed Fog.#10223 ByteStream directly in the browser,
 * plus pure-TS PNG ancillary chunk stripping (`eXIf`, `c2pa`, `caBX`, `tEXt`, `zTXt`, `iTXt`, `tIME`).
 */

import { STATLIST_GetUnitStat113c } from '../../src/d2kern-113c/common/statlist.ts'
import { UNITS_GetX113c, UNITS_GetY113c } from '../../src/d2kern-113c/common/unit.ts'
import { D2UnitStrc } from '../../src/d2kern-113c/mem/layout.generated.ts'
import type { ServerEvent } from '../../src/netproto/index.ts'
import {
  D2GS_KERNEL_FRAME_MS_113C,
  D2gsKernelBridge113c,
} from '../../src/server/net/d2gs-kernel-bridge-113c.ts'

export interface LoopbackPacketEntry {
  readonly dir: 'S2C' | 'WIRE' | 'EV'
  readonly opcodeHex: string
  readonly bytesLen: number
  readonly summary: string
}

export interface LoopbackStateSnapshot {
  readonly areaId: number
  readonly charClass: number
  readonly charName: string
  readonly frame: number
  readonly tickMs: number
  readonly state: string
  readonly protocolErrors: number
  readonly x: number
  readonly y: number
  readonly mode: number
  readonly hp: number
  readonly stamina: number
  readonly roomX: number
  readonly roomY: number
  readonly roomW: number
  readonly roomH: number
  readonly trail: readonly (readonly [number, number])[]
  readonly recentLog: readonly LoopbackPacketEntry[]
}

function bytesPreviewHex(u8: Uint8Array, max = 14): string {
  const slice = u8.subarray(0, max)
  const hex = [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ')
  return u8.byteLength > max ? `${hex} …` : hex
}

export class BrowserK5LoopbackSandbox {
  private readonly bridge: D2gsKernelBridge113c
  private readonly conn: ReturnType<D2gsKernelBridge113c['connectD2gsAdapter']>
  private readonly areaId: number
  private readonly charClass: number
  private readonly charName: string
  private readonly roomX = 5000
  private readonly roomY = 5000
  private readonly roomW = 100
  private readonly roomH = 100
  private readonly trail: [number, number][] = []
  private readonly log: LoopbackPacketEntry[] = []

  constructor(opts: { areaId: number; charClass: number; charName: string; initSeed?: number }) {
    this.areaId = opts.areaId
    this.charClass = opts.charClass
    this.charName = opts.charName
    this.bridge = new D2gsKernelBridge113c({
      initSeed: opts.initSeed ?? 0xcafebabe,
      objectSeed: 0x01020304,
      difficulty: 0,
      expansion: true,
      hardcore: false,
      ladder: true,
      act: 0,
      areaId: opts.areaId,
      roomSubtileX: this.roomX,
      roomSubtileY: this.roomY,
      roomSubtileWidth: this.roomW,
      roomSubtileHeight: this.roomH,
      spawnX: 5030,
      spawnY: 5045,
    })
    this.conn = this.bridge.connectD2gsAdapter({
      logon: {
        gameHash: 0x11223344,
        gameToken: 1,
        charClass: opts.charClass,
        versionByte: 0x0d,
        charName: opts.charName,
      },
    })
    this.conn.adapter.onEvent((ev: ServerEvent) => {
      this.pushLog({
        dir: 'EV',
        opcodeHex: ev.type,
        bytesLen: 0,
        summary: `ServerEvent.${ev.type}`,
      })
    })
    this.flushPackets()
    const pPlayer = this.conn.handle.getPlayerPtr()
    if (pPlayer) {
      this.trail.push([UNITS_GetX113c(this.bridge.m, pPlayer), UNITS_GetY113c(this.bridge.m, pPlayer)])
    }
  }

  private pushLog(entry: LoopbackPacketEntry): void {
    this.log.unshift(entry)
    if (this.log.length > 60) this.log.pop()
  }

  private flushPackets(): void {
    const raw = this.bridge.drainUncompressedS2CPackets(this.conn.clientId)
    for (const p of raw) {
      this.pushLog({
        dir: 'S2C',
        opcodeHex: `0x${p.opcode.toString(16).toUpperCase().padStart(2, '0')}`,
        bytesLen: p.bytes.byteLength,
        summary: bytesPreviewHex(p.bytes),
      })
    }
    const wire = this.bridge.drainWirePackets(this.conn.clientId)
    for (const w of wire) {
      this.pushLog({
        dir: 'WIRE',
        opcodeHex: `Q${w.queue}`,
        bytesLen: w.wireBytes.byteLength,
        summary: `Fog.#10223 framed: ${bytesPreviewHex(w.wireBytes)}`,
      })
    }
  }

  moveTo(x: number, y: number, run: boolean, stepFrames = 25): LoopbackStateSnapshot {
    const clampedX = Math.max(this.roomX + 2, Math.min(this.roomX + this.roomW - 2, Math.round(x)))
    const clampedY = Math.max(this.roomY + 2, Math.min(this.roomY + this.roomH - 2, Math.round(y)))
    this.conn.adapter.send(
      run ? { type: 'RunToLocation', x: clampedX, y: clampedY } : { type: 'WalkToLocation', x: clampedX, y: clampedY },
    )
    const pPlayer = this.conn.handle.getPlayerPtr()
    for (let i = 0; i < stepFrames; i++) {
      this.bridge.advanceTimeMs(D2GS_KERNEL_FRAME_MS_113C)
      if (pPlayer) {
        const cx = UNITS_GetX113c(this.bridge.m, pPlayer)
        const cy = UNITS_GetY113c(this.bridge.m, pPlayer)
        const last = this.trail[this.trail.length - 1]
        if (!last || last[0] !== cx || last[1] !== cy) {
          this.trail.push([cx, cy])
          if (this.trail.length > 180) this.trail.shift()
        }
      }
    }
    this.flushPackets()
    return this.snapshot()
  }

  snapshot(): LoopbackStateSnapshot {
    const pPlayer = this.conn.handle.getPlayerPtr()
    const x = pPlayer ? UNITS_GetX113c(this.bridge.m, pPlayer) : 0
    const y = pPlayer ? UNITS_GetY113c(this.bridge.m, pPlayer) : 0
    const mode = pPlayer ? this.bridge.m.get(pPlayer, D2UnitStrc.dwAnimMode) : 0
    const hp = pPlayer ? STATLIST_GetUnitStat113c(this.bridge.m, pPlayer, 6, 0) >> 8 : 0
    const stamina = pPlayer ? STATLIST_GetUnitStat113c(this.bridge.m, pPlayer, 10, 0) >> 8 : 0
    return {
      areaId: this.areaId,
      charClass: this.charClass,
      charName: this.charName,
      frame: this.bridge.frame,
      tickMs: this.bridge.tickMs,
      state: this.conn.adapter.state,
      protocolErrors: this.conn.adapter.stats.protocolErrors ?? 0,
      x,
      y,
      mode,
      hp,
      stamina,
      roomX: this.roomX,
      roomY: this.roomY,
      roomW: this.roomW,
      roomH: this.roomH,
      trail: [...this.trail],
      recentLog: [...this.log],
    }
  }

  close(): void {
    void this.conn.adapter.close()
  }
}

// Pure browser mirror of `tools/oracle/k5/verify-browser-multires-e2e.ts::stripPngAncillaryChunks`
const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CRITICAL_PNG_CHUNKS = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])

export interface BrowserPngStripResult {
  readonly width: number
  readonly height: number
  readonly originalBytes: number
  readonly cleanBytes: number
  readonly keptChunks: readonly string[]
  readonly droppedChunks: readonly string[]
}

export function stripPngAncillaryChunksBrowser(rawPng: Uint8Array): BrowserPngStripResult {
  if (rawPng.byteLength < 33) throw new Error('Invalid PNG: shorter than 33 bytes')
  for (let i = 0; i < 8; i++) {
    if (rawPng[i] !== PNG_SIG[i]) throw new Error('Invalid PNG signature')
  }
  const dv = new DataView(rawPng.buffer, rawPng.byteOffset, rawPng.byteLength)
  let off = 8
  let width = 0
  let height = 0
  let cleanBytes = 8
  const keptChunks: string[] = []
  const droppedChunks: string[] = []
  while (off + 12 <= rawPng.byteLength) {
    const len = dv.getUint32(off, false)
    const total = 12 + len
    if (off + total > rawPng.byteLength) throw new Error(`Truncated PNG chunk at ${off}`)
    const type = String.fromCharCode(rawPng[off + 4]!, rawPng[off + 5]!, rawPng[off + 6]!, rawPng[off + 7]!)
    if (type === 'IHDR' && len >= 8) {
      width = dv.getUint32(off + 8, false)
      height = dv.getUint32(off + 12, false)
    }
    if (CRITICAL_PNG_CHUNKS.has(type)) {
      keptChunks.push(type)
      cleanBytes += total
    } else {
      droppedChunks.push(type)
    }
    off += total
    if (type === 'IEND') break
  }
  return { width, height, originalBytes: rawPng.byteLength, cleanBytes, keptChunks, droppedChunks }
}

/** Synthesizes a valid minimal 1x1 PNG containing injected ancillary chunks (`tEXt`, `eXIf`, `c2pa`, `tIME`) for live browser testing. */
export function buildSyntheticAnnotatedPng(): Uint8Array {
  const mkChunk = (type: string, payload: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + payload.byteLength)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, payload.byteLength, false)
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
    out.set(payload, 8)
    return out
  }
  const ihdr = new Uint8Array(13)
  const idv = new DataView(ihdr.buffer)
  idv.setUint32(0, 800, false)
  idv.setUint32(4, 600, false)
  ihdr[8] = 8
  ihdr[9] = 6
  const enc = new TextEncoder()
  const parts = [
    PNG_SIG,
    mkChunk('IHDR', ihdr),
    mkChunk('tEXt', enc.encode('Software\0TestMetadata')),
    mkChunk('eXIf', enc.encode('EXIF-DUMMY-BYTES')),
    mkChunk('c2pa', enc.encode('C2PA-MANIFEST-STUB')),
    mkChunk('tIME', new Uint8Array([0x07, 0xea, 11, 25, 0, 0, 0])),
    mkChunk('IDAT', new Uint8Array([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])),
    mkChunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((n, p) => n + p.byteLength, 0)
  const merged = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    merged.set(p, pos)
    pos += p.byteLength
  }
  return merged
}
