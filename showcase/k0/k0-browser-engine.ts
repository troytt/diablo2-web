/**
 * Pure In-Browser [K0] `src/d2kern-113c` Sandbox Engine (`showcase/k0/k0-browser-engine.ts`).
 *
 * Runs genuine `src/d2kern-113c` primitives directly in the browser with zero Node built-ins:
 *   1. `seedRoll` (`D2Game:0x6FC21180` / `D2Common:0x6FD510B0`) against real `prng-10k.d2tv` vectors
 *   2. `D2TimerStrc` 64-slot event timer wheel (`EVENT_InitTimerQueue113c`, `EVENT_SetEventFull113c`,
 *      `EVENT_SetPersistentEventFull113c`, `EVENT_UpdateTimers113c`) on `SparseMemory113c`
 *   3. `Fog.#10223` / `D2Net.#10002` / `Fog.#10224` Huffman codec (`fogCompressPacket113c`,
 *      `frameServerPacket113c`, `unframeServerPacket113c`)
 */

import {
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventFull113c,
  EVENT_UpdateTimers113c,
} from '../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2EventStrc,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2TimerStrc,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  fogCompressPacket113c,
  frameServerPacket113c,
  unframeServerPacket113c,
} from '../../src/d2kern-113c/net/packet-sink.ts'
import { seedInit, seedRoll } from '../../src/d2kern-113c/prng.ts'

export interface PrngVectorLike {
  readonly index: number
  readonly initialLo: number
  readonly initialHi: number
  readonly nMax: number
  readonly nextLo: number
  readonly nextHi: number
  readonly rolledVal: number
}

export interface PrngSweepResult {
  readonly tested: number
  readonly matched: number
  readonly firstMismatch: {
    readonly index: number
    readonly expected: PrngVectorLike
    readonly actualNextLo: number
    readonly actualNextHi: number
    readonly actualRolled: number
  } | null
}

export function sweepPrngVectorsInBrowser(vectors: readonly PrngVectorLike[]): PrngSweepResult {
  let matched = 0
  let firstMismatch: PrngSweepResult['firstMismatch'] = null
  for (const v of vectors) {
    const seed = seedInit(v.initialLo, v.initialHi)
    const rolled = seedRoll(seed, v.nMax)
    const ok =
      (seed.lo >>> 0) === (v.nextLo >>> 0) &&
      (seed.hi >>> 0) === (v.nextHi >>> 0) &&
      (rolled >>> 0) === (v.rolledVal >>> 0)
    if (ok) {
      matched++
    } else if (!firstMismatch) {
      firstMismatch = {
        index: v.index,
        expected: v,
        actualNextLo: seed.lo >>> 0,
        actualNextHi: seed.hi >>> 0,
        actualRolled: rolled >>> 0,
      }
    }
  }
  return { tested: vectors.length, matched, firstMismatch }
}

export function stepCustomPrngRoll(
  lo: number,
  hi: number,
  nMax: number,
): { nextLo: number; nextHi: number; rolled: number } {
  const s = seedInit(lo, hi)
  const rolled = seedRoll(s, nMax)
  return { nextLo: s.lo >>> 0, nextHi: s.hi >>> 0, rolled: rolled >>> 0 }
}

export interface TimerWheelFiredEntry {
  readonly frame: number
  readonly slot: number
  readonly unitType: number
  readonly unitId: number
  readonly eventType: number
  readonly arg14: number
  readonly persistent: boolean
}

export interface TimerWheelSnapshot {
  readonly currentFrame: number
  readonly currentSlot: number
  readonly slotCounts: readonly number[]
  readonly persistentCount: number
  readonly firedHistory: readonly TimerWheelFiredEntry[]
}

export class BrowserTimerWheelSandbox {
  private readonly m = new SparseMemory113c()
  private readonly pGame: number
  private readonly pTimer: number
  private readonly unitsByType = new Map<number, number>()
  private readonly history: TimerWheelFiredEntry[] = []

  constructor(initialFrame = 786) {
    this.pGame = this.m.alloc(D2GameStrc_SIZE)
    this.m.set(this.pGame, D2GameStrc.dwGameFrame, initialFrame >>> 0)
    this.pTimer = EVENT_InitTimerQueue113c(this.m, this.pGame)
    for (const uType of [0, 1, 2, 3, 4]) {
      const pUnit = this.m.alloc(D2UnitStrc_SIZE)
      this.m.set(pUnit, D2UnitStrc.dwUnitType, uType)
      this.m.set(pUnit, D2UnitStrc.dwUnitId, 10 + uType)
      this.m.set(pUnit, D2UnitStrc.pGame, this.pGame)
      this.unitsByType.set(uType, pUnit)
    }
  }

  getFrame(): number {
    return this.m.get(this.pGame, D2GameStrc.dwGameFrame) >>> 0
  }

  scheduleTimed(unitType: number, eventType: number, targetFrame: number, arg14 = 0): number {
    const pUnit = this.unitsByType.get(unitType) ?? this.unitsByType.get(1)!
    return EVENT_SetEventFull113c(this.m, this.pGame, pUnit, eventType, targetFrame, 0x6fc969a0, arg14, 0)
  }

  schedulePersistent(unitType: number, eventType: number, arg14 = 0): number {
    const pUnit = this.unitsByType.get(unitType) ?? this.unitsByType.get(1)!
    return EVENT_SetPersistentEventFull113c(this.m, this.pGame, pUnit, eventType, 0x6fc952e0, arg14, 0)
  }

  stepOneFrame(): TimerWheelFiredEntry[] {
    const nextFrame = ((this.getFrame() + 1) >>> 0)
    this.m.set(this.pGame, D2GameStrc.dwGameFrame, nextFrame)
    const firedNow: TimerWheelFiredEntry[] = []
    EVENT_UpdateTimers113c(this.m, this.pGame, (m, _pGame, pUnit, evType, arg14, _arg18, _handler, pNode) => {
      const flags = m.get(pNode, D2EventStrc.fFlags)
      const entry: TimerWheelFiredEntry = {
        frame: nextFrame,
        slot: nextFrame & 63,
        unitType: pUnit ? m.get(pUnit, D2UnitStrc.dwUnitType) : 6,
        unitId: pUnit ? m.get(pUnit, D2UnitStrc.dwUnitId) : 0,
        eventType: evType,
        arg14: arg14 >>> 0,
        persistent: (flags & 0x04) !== 0,
      }
      firedNow.push(entry)
      this.history.unshift(entry)
      if (this.history.length > 40) this.history.pop()
    })
    return firedNow
  }

  snapshot(): TimerWheelSnapshot {
    const frame = this.getFrame()
    const slotCounts = new Array<number>(64).fill(0)
    for (let part = 0; part < 5; part++) {
      for (let s = 0; s < 64; s++) {
        let cur = this.m.get(this.pTimer, D2TimerStrc.pSlotTail, part * 64 + s)
        let guard = 0
        while (cur !== 0 && guard++ < 64) {
          slotCounts[s] = (slotCounts[s] ?? 0) + 1
          cur = this.m.get(cur, D2EventStrc.pWheelNewer)
        }
      }
    }
    let persistentCount = 0
    for (let part = 0; part < 5; part++) {
      let cur = this.m.get(this.pTimer, D2TimerStrc.pPersistentHead, part)
      let guard = 0
      while (cur !== 0 && guard++ < 64) {
        persistentCount++
        cur = this.m.get(cur, D2EventStrc.pWheelNewer)
      }
    }
    return {
      currentFrame: frame,
      currentSlot: frame & 63,
      slotCounts,
      persistentCount,
      firedHistory: [...this.history],
    }
  }
}

export interface FogHuffmanRoundtripResult {
  readonly rawHex: string
  readonly rawLen: number
  readonly compressedHex: string
  readonly compressedLen: number
  readonly framedHex: string
  readonly framedLen: number
  readonly decompressedHex: string
  readonly exactRoundtrip: boolean
  readonly ratioPct: number
}

function toHex(u8: Uint8Array): string {
  return [...u8].map((b) => b.toString(16).padStart(2, '0')).join(' ')
}

export function runFogHuffmanRoundtrip(hexInput: string, queue = 1): FogHuffmanRoundtripResult {
  const clean = hexInput.replace(/[^0-9a-fA-F]/g, '')
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error('请输入偶数个十六进制字节（例如: 59 01 00 00 00 04 42 61 72 62 00）')
  }
  const raw = new Uint8Array(clean.length / 2)
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  const compBuf = new Uint8Array(Math.max(128, raw.length * 2 + 16))
  const compLen = fogCompressPacket113c(raw, compBuf)
  const compressed = compBuf.subarray(0, compLen)
  const framed = frameServerPacket113c(queue, raw)
  const decompressed = unframeServerPacket113c(queue, framed, Math.max(516, raw.length + 32))
  let exact = decompressed.length === raw.length
  if (exact) {
    for (let i = 0; i < raw.length; i++) {
      if (decompressed[i] !== raw[i]) {
        exact = false
        break
      }
    }
  }
  return {
    rawHex: toHex(raw),
    rawLen: raw.length,
    compressedHex: toHex(compressed),
    compressedLen: compressed.length,
    framedHex: toHex(framed),
    framedLen: framed.length,
    decompressedHex: toHex(decompressed),
    exactRoundtrip: exact,
    ratioPct: raw.length > 0 ? Number(((framed.length / raw.length) * 100).toFixed(1)) : 0,
  }
}
