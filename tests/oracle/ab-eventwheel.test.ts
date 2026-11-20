/**
 * Genuine Head-to-Head A/B Evaluation for Milestone 31 [K0] (Decision 3):
 * Full 1.13c `D2TimerStrc` (`0xA20` = 2,592 bytes) & `D2EventStrc` (`0x30` = 48 bytes).
 *
 * Binary ground truth (`D2Game.dll`, base `0x6FC20000`):
 * - `0x6FCAE420` `EVENT_AllocChunk` (`0x7088` bytes: 600 * `0x30` nodes + `+0x7080 pFreeHead` + `+0x7084 pNextChunk`)
 * - `0x6FCAE630` `EVENT_InitTimerQueue` (`0xA20` bytes: `+0x004 pSlotTail[320]`, `+0x504 pSlotHead[320]`, `+0xA04 pPersistentHead[5]`, `+0xA18 pSavedNext`, `+0xA1C pPool`)
 * - `0x6FCAE540` `EVENT_AllocNode` / `0x6FCAE680` `EVENT_CreateNode` (`unit+0xDC` head-insert)
 * - `0x6FCAE6F0` `EVENT_FreeNode` (`fFlags & 0x01` -> `0x08` deferred free, `pSavedNext` cursor advance, `[node+2] = 0x0002`)
 * - `0x6FCAE810` `EVENT_SetPersistentEvent` (`dwFrame = 0xFFFFFFFF`, `fFlags |= 0x04`, LIFO head-insert)
 * - `0x6FCAEA80` `EVENT_SetEvent` (`frame <= dwGameFrame` -> `dwGameFrame + 1`, `5 * 64` FIFO tail->head)
 * - `0x6FCAE880` `EVENT_RemoveUnitEvents` / `0x6FCAE8C0` `EVENT_DeleteEventByType`
 * - `0x6FCAE490` `EVENT_GetNextEventFrame`
 * - `0x6FCAF070` `EVENT_UpdateTimers` (partition walk `[2, 0, 1, 3, 4]`: persistent LIFO then slot FIFO)
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { Heap113c } from '../../src/d2kern-113c/mem/heap.ts'
import {
  D2EventStrc,
  D2EventStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2TimerStrc,
  D2TimerStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c, type Memory113c } from '../../src/d2kern-113c/mem/sparse-memory.ts'
import { STATES_CheckState113c, STATLIST_FLAG_EXTENDED } from '../../src/d2kern-113c/common/statlist.ts'
import {
  EVENT_CHUNK_FREE_OFF_113C,
  EVENT_CHUNK_NEXT_OFF_113C,
  EVENT_CHUNK_SIZE_113C,
  EVENT_DeleteEventByType113c,
  EVENT_FLAG_DEFERRED_FREE,
  EVENT_FLAG_FIRING,
  EVENT_FLAG_PERSISTENT,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_NODES_PER_CHUNK_113C,
  EVENT_NODE_SIZE_113C,
  EVENT_PARTITION_BY_UNIT_TYPE_113C,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventFull113c,
  EVENT_UPDATE_PARTITION_ORDER_113C,
  EVENT_UpdateTimers113c,
  type EventWheelHooks113c,
} from '../../src/d2kern-113c/game/timer-wheel.ts'
import { parseVectorHeader } from '../../tools/oracle/vectors/vector-format.ts'
import {
  decodeEventWheelRecord,
  EVTWHEEL_RECORD_SIZE,
  type EventWheelRecord,
} from '../../tools/oracle/vectors/eventwheel-vector.ts'

// === BEGIN CANDIDATE A CORE ===
export interface D2EventObj {
  va: number
  nType: number
  fFlags: number
  dwFrame: number
  unit: D2UnitObj | null
  rawUnitVa: number
  dwUnitId: number
  dwUnitType: number
  dwArg14: number
  dwArg18: number
  wheelNewer: D2EventObj | null
  wheelOlder: D2EventObj | null
  unitNext: D2EventObj | null
  unitPrev: D2EventObj | null
  pfnHandler: number
  isExternalStub: boolean
}

export interface D2PoolChunkObj {
  va: number
  nodes: D2EventObj[]
  freeHead: D2EventObj | null
  nextChunk: D2PoolChunkObj | null
  isExternalStub: boolean
}

export interface D2TimerObj {
  va: number
  nCurrentSlot: number
  slotTail: (D2EventObj | null)[]
  slotHead: (D2EventObj | null)[]
  persistentHead: (D2EventObj | null)[]
  savedNext: D2EventObj | null
  poolHead: D2PoolChunkObj | null
}

export interface D2UnitObj {
  va: number
  dwUnitType: number
  dwClassId: number
  dwUnitId: number
  dwAnimMode: number
  eventFirst: D2EventObj | null
  activeStates: Set<number>
  rawBytes?: Uint8Array
}

export interface D2GameObj {
  va: number
  dwGameFrame: number
  timer: D2TimerObj | null
  nextSyntheticVa: number
  rawBytes?: Uint8Array
}

export interface EventWheelHooksObjA {
  readonly checkState: (unit: D2UnitObj, stateId: number) => boolean
  readonly onMonsterAiEventWithState36: (unit: D2UnitObj) => void
}

export type EventDispatchCallbackObjA = (
  game: D2GameObj,
  unit: D2UnitObj | null,
  rawUnitVa: number,
  eventType: number,
  arg14: number,
  arg18: number,
  pfnHandler: number,
  node: D2EventObj,
) => void

function makeEmptyEventObj(va: number, isExternalStub = false): D2EventObj {
  return {
    va,
    nType: 0,
    fFlags: 0,
    dwFrame: 0,
    unit: null,
    rawUnitVa: 0,
    dwUnitId: 0,
    dwUnitType: 0,
    dwArg14: 0,
    dwArg18: 0,
    wheelNewer: null,
    wheelOlder: null,
    unitNext: null,
    unitPrev: null,
    pfnHandler: 0,
    isExternalStub,
  }
}

export function createGameObjA(initialFrame = 0, va = 0x10000000): D2GameObj {
  return {
    va,
    dwGameFrame: initialFrame >>> 0,
    timer: null,
    nextSyntheticVa: (va + 0x00100000) >>> 0,
  }
}

export function createUnitObjA(game: D2GameObj, unitType: number, unitId: number): D2UnitObj {
  const va = game.nextSyntheticVa
  game.nextSyntheticVa = (game.nextSyntheticVa + D2UnitStrc_SIZE) >>> 0
  return {
    va,
    dwUnitType: unitType >>> 0,
    dwClassId: 0,
    dwUnitId: unitId >>> 0,
    dwAnimMode: 0,
    eventFirst: null,
    activeStates: new Set<number>(),
  }
}

export function EVENT_AllocChunkA(game: D2GameObj, timer: D2TimerObj): D2PoolChunkObj {
  const chunkVa = game.nextSyntheticVa
  game.nextSyntheticVa = (game.nextSyntheticVa + EVENT_CHUNK_SIZE_113C) >>> 0
  const nodes: D2EventObj[] = new Array<D2EventObj>(EVENT_NODES_PER_CHUNK_113C)
  for (let i = 0; i < EVENT_NODES_PER_CHUNK_113C; i++) {
    nodes[i] = makeEmptyEventObj((chunkVa + i * EVENT_NODE_SIZE_113C) >>> 0, false)
  }
  for (let i = 0; i < EVENT_NODES_PER_CHUNK_113C - 1; i++) {
    nodes[i]!.wheelNewer = nodes[i + 1]!
  }
  nodes[EVENT_NODES_PER_CHUNK_113C - 1]!.wheelNewer = null

  const chunk: D2PoolChunkObj = {
    va: chunkVa,
    nodes,
    freeHead: nodes[0]!,
    nextChunk: null,
    isExternalStub: false,
  }
  const first = timer.poolHead
  if (first === null) {
    timer.poolHead = chunk
  } else {
    chunk.nextChunk = first.nextChunk
    first.nextChunk = chunk
  }
  return chunk
}

export function EVENT_InitTimerQueueA(game: D2GameObj): D2TimerObj {
  const timerVa = game.nextSyntheticVa
  game.nextSyntheticVa = (game.nextSyntheticVa + D2TimerStrc_SIZE) >>> 0
  const timer: D2TimerObj = {
    va: timerVa,
    nCurrentSlot: 0,
    slotTail: new Array<D2EventObj | null>(320).fill(null),
    slotHead: new Array<D2EventObj | null>(320).fill(null),
    persistentHead: new Array<D2EventObj | null>(5).fill(null),
    savedNext: null,
    poolHead: null,
  }
  game.timer = timer
  EVENT_AllocChunkA(game, timer)
  return timer
}

function resetPoppedNodeA(node: D2EventObj): D2EventObj {
  node.nType = 0
  node.fFlags = 0
  node.dwFrame = 0
  node.unit = null
  node.rawUnitVa = 0
  node.dwUnitId = 0
  node.dwUnitType = 0
  node.dwArg14 = 0
  node.dwArg18 = 0
  node.wheelNewer = null
  node.wheelOlder = null
  node.unitNext = null
  node.unitPrev = null
  node.pfnHandler = 0
  node.isExternalStub = false
  return node
}

export function EVENT_AllocNodeA(game: D2GameObj, timer: D2TimerObj, allowGrowth = true): D2EventObj {
  for (let chunk = timer.poolHead; chunk !== null; chunk = chunk.nextChunk) {
    const node = chunk.freeHead
    if (node === null) continue
    chunk.freeHead = node.wheelNewer
    return resetPoppedNodeA(node)
  }
  if (!allowGrowth) {
    throw new Error('EVENT_AllocNodeA: pool exhausted without chunk growth')
  }
  const newChunk = EVENT_AllocChunkA(game, timer)
  const node = newChunk.freeHead!
  newChunk.freeHead = node.wheelNewer
  return resetPoppedNodeA(node)
}

export function EVENT_CreateNodeA(game: D2GameObj, unit: D2UnitObj | null, allowGrowth = true): D2EventObj {
  const timer = game.timer
  if (timer === null) throw new Error('EVENT_CreateNodeA: missing timer queue')
  const node = EVENT_AllocNodeA(game, timer, allowGrowth)
  node.unit = unit
  node.rawUnitVa = unit !== null ? unit.va : 0

  const oldFirst = unit !== null ? unit.eventFirst : null
  node.unitNext = oldFirst
  if (oldFirst !== null) oldFirst.unitPrev = node
  node.unitPrev = null

  if (unit !== null) {
    unit.eventFirst = node
    node.dwUnitType = unit.dwUnitType >>> 0
    node.fFlags &= 0xfffd
    node.dwUnitId = unit.dwUnitId >>> 0
  } else {
    node.dwUnitType = 6
    node.fFlags &= 0xfffd
    node.dwUnitId = 0xffffffff
  }
  return node
}

export function EVENT_FreeNodeA(game: D2GameObj, node: D2EventObj | null): void {
  if (node === null || game.timer === null) return
  if ((node.fFlags & EVENT_FLAG_FIRING) !== 0) {
    node.fFlags = (node.fFlags & 0xff00) | ((node.fFlags | EVENT_FLAG_DEFERRED_FREE) & 0xff)
    return
  }

  const timer = game.timer
  const newer = node.wheelNewer
  const older = node.wheelOlder

  if (timer.savedNext === node) {
    timer.savedNext = newer
  }

  const part = EVENT_PARTITION_BY_UNIT_TYPE_113C[node.dwUnitType] ?? 0
  const frame = node.dwFrame >>> 0

  if (older !== null) {
    older.wheelNewer = newer
  } else if (frame === 0xffffffff) {
    timer.persistentHead[part] = newer
  } else if (part >= 0) {
    const slot = part * 64 + (frame & 63)
    timer.slotTail[slot] = newer
  }

  if (newer !== null) {
    newer.wheelOlder = older
  } else if (frame !== 0xffffffff && part >= 0) {
    const slot = part * 64 + (frame & 63)
    if (timer.slotHead[slot] === node) {
      timer.slotHead[slot] = older
    }
  }

  // 0x6FCAE7B6..0x6FCAE7E3: unlink from unit->pEventFirst while leaving node's own +0x08/+0x24/+0x28 fields intact
  const unit = node.unit
  if (unit !== null) {
    const uNext = node.unitNext
    const uPrev = node.unitPrev
    if (uNext !== null) uNext.unitPrev = uPrev
    if (uPrev !== null) uPrev.unitNext = uNext
    else if (unit.eventFirst === node) {
      unit.eventFirst = uNext
    }
  } else if (node.rawUnitVa !== 0) {
    const uNext = node.unitNext
    const uPrev = node.unitPrev
    if (uNext !== null) uNext.unitPrev = uPrev
    if (uPrev !== null) uPrev.unitNext = uNext
  }

  const firstChunk = timer.poolHead
  if (firstChunk !== null) {
    node.wheelNewer = firstChunk.freeHead
    node.wheelOlder = null
    firstChunk.freeHead = node
  }
  node.fFlags = 0x0002
}

export function EVENT_SetPersistentEventA(
  game: D2GameObj,
  unit: D2UnitObj | null,
  type: number,
  handler: number,
  arg14: number,
  arg18: number,
  allowGrowth = true,
): D2EventObj | null {
  if ((type | 0) >= 15) return null
  const node = EVENT_CreateNodeA(game, unit, allowGrowth)
  node.fFlags = (node.fFlags & 0xff00) | ((node.fFlags | EVENT_FLAG_PERSISTENT) & 0xff)
  node.dwArg14 = arg14 >>> 0
  node.nType = (node.nType & 0xff00) | (type & 0xff)
  node.dwFrame = 0xffffffff
  node.dwArg18 = arg18 >>> 0
  node.pfnHandler = handler >>> 0

  const unitType = unit === null ? 6 : unit.dwUnitType
  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[unitType]
  if (partition === undefined || partition < 0) {
    throw new Error(`EVENT_SetPersistentEventA: invalid unit type ${unitType}`)
  }
  const timer = game.timer!
  const oldHead = timer.persistentHead[partition]!
  node.wheelNewer = oldHead
  node.wheelOlder = null
  if (oldHead !== null) oldHead.wheelOlder = node
  timer.persistentHead[partition] = node
  return node
}

export function EVENT_SetEventA(
  game: D2GameObj,
  unit: D2UnitObj | null,
  type: number,
  frame: number,
  handler = 0,
  arg14 = 0,
  arg18 = 0,
  hooks?: EventWheelHooksObjA,
  allowGrowth = true,
): D2EventObj | null {
  if ((type | 0) >= 15) return null
  if ((frame | 0) === -1) {
    return EVENT_SetPersistentEventA(game, unit, type, 0, arg14, arg18, allowGrowth)
  }

  let f = frame | 0
  if (f <= (game.dwGameFrame | 0)) {
    f = (game.dwGameFrame + 1) | 0
  }

  if (unit !== null && unit.dwUnitType === 1 && type === 2) {
    const hasState36 = hooks ? hooks.checkState(unit, 0x36) : unit.activeStates.has(0x36)
    if (hasState36 && hooks) {
      hooks.onMonsterAiEventWithState36(unit)
    }
  }

  const node = EVENT_CreateNodeA(game, unit, allowGrowth)
  node.dwArg14 = arg14 >>> 0
  node.nType = (node.nType & 0xff00) | (type & 0xff)
  node.dwFrame = f >>> 0
  node.dwArg18 = arg18 >>> 0
  node.pfnHandler = handler >>> 0

  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[node.dwUnitType]
  if (partition === undefined || partition < 0) {
    throw new Error('EVENT_SetEventA: unit type without a partition')
  }
  const slot = partition * 64 + (f & 63)
  const timer = game.timer!
  const oldHead = timer.slotHead[slot]!
  node.wheelNewer = null
  node.wheelOlder = oldHead
  if (oldHead !== null) oldHead.wheelNewer = node
  timer.slotHead[slot] = node
  if (timer.slotTail[slot] === null) {
    timer.slotTail[slot] = node
  }
  return node
}

export function EVENT_DeleteUnitEventsA(game: D2GameObj, unit: D2UnitObj | null): void {
  if (unit === null || game.timer === null) return
  let cur = unit.eventFirst
  while (cur !== null) {
    const next = cur.unitNext
    EVENT_FreeNodeA(game, cur)
    // 0x6FCAE8A1: mov [eax+8], 0 (clears only pUnit, leaving pUnitNext/pUnitPrev intact)
    cur.unit = null
    cur.rawUnitVa = 0
    cur = next
  }
  unit.eventFirst = null
}

export function EVENT_DeleteEventByTypeA(
  game: D2GameObj,
  unit: D2UnitObj | null,
  type: number,
  handler?: number,
): void {
  if (unit === null || game.timer === null) return
  let cur = unit.eventFirst
  while (cur !== null) {
    const next = cur.unitNext
    if (
      (cur.nType & 0xff) === (type & 0xff) &&
      (handler === undefined || cur.pfnHandler === (handler >>> 0))
    ) {
      EVENT_FreeNodeA(game, cur)
    }
    cur = next
  }
}

export function EVENT_GetNextFrameA(unit: D2UnitObj | null, type: number): number {
  if (unit === null) return 0
  let best = 0
  for (let cur = unit.eventFirst; cur !== null; cur = cur.unitNext) {
    if ((cur.nType & 0xff) !== (type & 0xff)) continue
    const fr = cur.dwFrame | 0
    if (fr > 0 && (best === 0 || fr < best)) {
      best = fr
    }
  }
  return best >>> 0
}

export function EVENT_UpdateTimersA(game: D2GameObj, dispatch: EventDispatchCallbackObjA): number {
  const timer = game.timer
  if (timer === null) return 0
  const frame = game.dwGameFrame >>> 0
  const slotMod = frame & 63
  timer.nCurrentSlot = slotMod

  let firedCount = 0

  for (const part of EVENT_UPDATE_PARTITION_ORDER_113C) {
    let node: D2EventObj | null = timer.persistentHead[part] ?? null
    while (node !== null) {
      timer.savedNext = node.wheelNewer
      node.fFlags = (node.fFlags & 0xff00) | ((node.fFlags | EVENT_FLAG_FIRING) & 0xff)
      const unit = node.unit
      const rawUnitVa = unit !== null ? unit.va : node.rawUnitVa
      const evType = node.nType & 0xff
      const arg14 = node.dwArg14
      const arg18 = node.dwArg18
      const fn = node.pfnHandler
      firedCount++
      dispatch(game, unit, rawUnitVa, evType, arg14, arg18, fn, node)

      const postLow = (node.fFlags & 0xff) & ~EVENT_FLAG_FIRING
      node.fFlags = (node.fFlags & 0xff00) | postLow
      if ((postLow & EVENT_FLAG_DEFERRED_FREE) !== 0) {
        EVENT_FreeNodeA(game, node)
      }
      node = timer.savedNext
    }

    const slot = part * 64 + slotMod
    node = timer.slotTail[slot] ?? null
    while (node !== null) {
      timer.savedNext = node.wheelNewer
      if ((node.dwFrame >>> 0) === frame) {
        node.fFlags = (node.fFlags & 0xff00) | ((node.fFlags | EVENT_FLAG_FIRING) & 0xff)
        const unit = node.unit
        const rawUnitVa = unit !== null ? unit.va : node.rawUnitVa
        const evType = node.nType & 0xff
        const arg14 = node.dwArg14
        const arg18 = node.dwArg18
        const fn = node.pfnHandler
        firedCount++
        dispatch(game, unit, rawUnitVa, evType, arg14, arg18, fn, node)

        const postLow = (node.fFlags & 0xff) & ~EVENT_FLAG_FIRING
        node.fFlags = (node.fFlags & 0xff00) | postLow
        EVENT_FreeNodeA(game, node)
      }
      node = timer.savedNext
    }
    timer.savedNext = null
  }

  return firedCount
}

export function EVENT_PartitionFireOrderA(
  game: D2GameObj,
  partition: number,
): { node: D2EventObj; persistent: boolean }[] {
  const timer = game.timer
  if (timer === null) return []
  const frame = game.dwGameFrame >>> 0
  const out: { node: D2EventObj; persistent: boolean }[] = []
  for (let n: D2EventObj | null = timer.persistentHead[partition] ?? null; n !== null; n = n.wheelNewer) {
    if (n.isExternalStub) break
    out.push({ node: n, persistent: true })
  }
  for (let n: D2EventObj | null = timer.slotTail[partition * 64 + (frame & 63)] ?? null; n !== null; n = n.wheelNewer) {
    if (n.isExternalStub) break
    if ((n.dwFrame >>> 0) === frame) {
      out.push({ node: n, persistent: false })
    }
  }
  return out
}
// === END CANDIDATE A CORE ===

// === BEGIN CANDIDATE A CODEC ===
export interface DecodedSnapshotGraphA {
  readonly game: D2GameObj
  readonly unit: D2UnitObj | null
  readonly timer: D2TimerObj
  readonly unitsByVa: Map<number, D2UnitObj>
  readonly eventsByVa: Map<number, D2EventObj>
  readonly chunksByVa: Map<number, D2PoolChunkObj>
  readonly auxBlocks: Map<number, Uint8Array>
}

export function decodeSnapshotFromMemory113c(
  blocks: readonly (readonly [number, Uint8Array])[],
  pGameVa: number,
  pUnitVa = 0,
): DecodedSnapshotGraphA {
  const blockMap = new Map<number, Uint8Array>()
  for (const [addr, bytes] of blocks) {
    if (bytes.byteLength > 0) blockMap.set(addr >>> 0, bytes)
  }

  const gameBytes = blockMap.get(pGameVa >>> 0)
  if (!gameBytes || gameBytes.byteLength < 0xc0) {
    throw new Error(`decodeSnapshotFromMemory113c: missing D2GameStrc prefix at 0x${(pGameVa >>> 0).toString(16)}`)
  }
  const gameView = new DataView(gameBytes.buffer, gameBytes.byteOffset, gameBytes.byteLength)
  const dwGameFrame = gameView.getUint32(D2GameStrc.dwGameFrame.off, true)
  const pTimerVa = gameView.getUint32(D2GameStrc.pTimer.off, true)

  const timerBytes = blockMap.get(pTimerVa)
  if (!timerBytes || timerBytes.byteLength !== D2TimerStrc_SIZE) {
    throw new Error(`decodeSnapshotFromMemory113c: missing 0xA20 D2TimerStrc at 0x${pTimerVa.toString(16)}`)
  }
  const timerView = new DataView(timerBytes.buffer, timerBytes.byteOffset, timerBytes.byteLength)

  const unitsByVa = new Map<number, D2UnitObj>()
  const eventsByVa = new Map<number, D2EventObj>()
  const chunksByVa = new Map<number, D2PoolChunkObj>()
  const auxBlocks = new Map<number, Uint8Array>()

  for (const [addr, bytes] of blockMap) {
    if (addr === (pGameVa >>> 0) || addr === pTimerVa) continue
    if (bytes.byteLength === D2UnitStrc_SIZE || bytes.byteLength === 0x100) {
      const uv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const activeStates = new Set<number>()
      const slexVa = uv.getUint32(D2UnitStrc.pStatListEx.off, true)
      const slexBytes = slexVa !== 0 ? blockMap.get(slexVa) : undefined
      if (slexBytes && slexBytes.byteLength === D2StatListExStrc_SIZE) {
        auxBlocks.set(slexVa, new Uint8Array(slexBytes))
        const sv = new DataView(slexBytes.buffer, slexBytes.byteOffset, slexBytes.byteLength)
        if ((sv.getUint32(D2StatListExStrc.dwFlags.off, true) & STATLIST_FLAG_EXTENDED) !== 0) {
          const sfVa = sv.getUint32(D2StatListExStrc.pStateFlags.off, true)
          const sfBytes = sfVa !== 0 ? blockMap.get(sfVa) : undefined
          if (sfBytes && sfBytes.byteLength === 0x30) {
            auxBlocks.set(sfVa, new Uint8Array(sfBytes))
            const sfv = new DataView(sfBytes.buffer, sfBytes.byteOffset, sfBytes.byteLength)
            for (let w = 0; w < 6; w++) {
              const bits = sfv.getUint32(w * 4, true)
              if (bits === 0) continue
              for (let b = 0; b < 32; b++) {
                const sid = w * 32 + b
                if (sid < 185 && (bits & (1 << b)) !== 0) activeStates.add(sid)
              }
            }
          }
        }
      }
      unitsByVa.set(addr, {
        va: addr,
        dwUnitType: uv.getUint32(D2UnitStrc.dwUnitType.off, true),
        dwClassId: uv.getUint32(D2UnitStrc.dwClassId.off, true),
        dwUnitId: uv.getUint32(D2UnitStrc.dwUnitId.off, true),
        dwAnimMode: uv.getUint32(D2UnitStrc.dwAnimMode.off, true),
        eventFirst: null,
        activeStates,
        rawBytes: new Uint8Array(bytes),
      })
    }
  }

  const resolveEvent = (va: number): D2EventObj | null => {
    const uVa = va >>> 0
    if (uVa === 0) return null
    const existing = eventsByVa.get(uVa)
    if (existing !== undefined) return existing

    const eb = blockMap.get(uVa)
    if (!eb || eb.byteLength !== D2EventStrc_SIZE || auxBlocks.has(uVa)) {
      const stub = makeEmptyEventObj(uVa, true)
      eventsByVa.set(uVa, stub)
      return stub
    }

    const ev = makeEmptyEventObj(uVa, false)
    eventsByVa.set(uVa, ev)
    const dv = new DataView(eb.buffer, eb.byteOffset, eb.byteLength)
    ev.nType = dv.getUint16(0x00, true)
    ev.fFlags = dv.getUint16(0x02, true)
    ev.dwFrame = dv.getUint32(D2EventStrc.dwFrame.off, true)
    const evUnitVa = dv.getUint32(D2EventStrc.pUnit.off, true)
    ev.rawUnitVa = evUnitVa
    ev.unit = unitsByVa.get(evUnitVa) ?? null
    ev.dwUnitId = dv.getUint32(D2EventStrc.dwUnitId.off, true)
    ev.dwUnitType = dv.getUint32(D2EventStrc.dwUnitType.off, true)
    ev.dwArg14 = dv.getUint32(D2EventStrc.dwArg14.off, true)
    ev.dwArg18 = dv.getUint32(D2EventStrc.dwArg18.off, true)
    ev.wheelNewer = resolveEvent(dv.getUint32(D2EventStrc.pWheelNewer.off, true))
    ev.wheelOlder = resolveEvent(dv.getUint32(D2EventStrc.pWheelOlder.off, true))
    ev.unitNext = resolveEvent(dv.getUint32(D2EventStrc.pUnitNext.off, true))
    ev.unitPrev = resolveEvent(dv.getUint32(D2EventStrc.pUnitPrev.off, true))
    ev.pfnHandler = dv.getUint32(D2EventStrc.pfnHandler.off, true)
    return ev
  }

  for (const [addr, bytes] of blockMap) {
    if (addr === (pGameVa >>> 0) || addr === pTimerVa || unitsByVa.has(addr) || auxBlocks.has(addr)) continue
    if (bytes.byteLength === D2EventStrc_SIZE) {
      resolveEvent(addr)
    }
  }

  for (const u of unitsByVa.values()) {
    const uv = new DataView(u.rawBytes!.buffer, u.rawBytes!.byteOffset, u.rawBytes!.byteLength)
    u.eventFirst = resolveEvent(uv.getUint32(D2UnitStrc.pEventFirst.off, true))
  }

  const resolveChunk = (chunkVa: number): D2PoolChunkObj | null => {
    const uChunk = chunkVa >>> 0
    if (uChunk === 0) return null
    const existing = chunksByVa.get(uChunk)
    if (existing !== undefined) return existing

    const hdrAddr = (uChunk + EVENT_CHUNK_FREE_OFF_113C) >>> 0
    const hb = blockMap.get(hdrAddr)
    if (!hb || hb.byteLength !== 8) {
      const stub: D2PoolChunkObj = {
        va: uChunk,
        nodes: [],
        freeHead: null,
        nextChunk: null,
        isExternalStub: true,
      }
      chunksByVa.set(uChunk, stub)
      return stub
    }

    const hv = new DataView(hb.buffer, hb.byteOffset, hb.byteLength)
    const chunk: D2PoolChunkObj = {
      va: uChunk,
      nodes: [],
      freeHead: null,
      nextChunk: null,
      isExternalStub: false,
    }
    chunksByVa.set(uChunk, chunk)
    chunk.freeHead = resolveEvent(hv.getUint32(0, true))
    chunk.nextChunk = resolveChunk(hv.getUint32(4, true))
    return chunk
  }

  const slotTail = new Array<D2EventObj | null>(320)
  const slotHead = new Array<D2EventObj | null>(320)
  for (let i = 0; i < 320; i++) {
    slotTail[i] = resolveEvent(timerView.getUint32(D2TimerStrc.pSlotTail.off + i * 4, true))
    slotHead[i] = resolveEvent(timerView.getUint32(D2TimerStrc.pSlotHead.off + i * 4, true))
  }
  const persistentHead = new Array<D2EventObj | null>(5)
  for (let p = 0; p < 5; p++) {
    persistentHead[p] = resolveEvent(timerView.getUint32(D2TimerStrc.pPersistentHead.off + p * 4, true))
  }

  const timer: D2TimerObj = {
    va: pTimerVa,
    nCurrentSlot: timerView.getUint32(D2TimerStrc.nCurrentSlot.off, true),
    slotTail,
    slotHead,
    persistentHead,
    savedNext: resolveEvent(timerView.getUint32(D2TimerStrc.pSavedNext.off, true)),
    poolHead: resolveChunk(timerView.getUint32(D2TimerStrc.pPool.off, true)),
  }

  const game: D2GameObj = {
    va: pGameVa >>> 0,
    dwGameFrame,
    timer,
    nextSyntheticVa: 0x50000000,
    rawBytes: new Uint8Array(gameBytes),
  }

  const targetUnit = pUnitVa !== 0 ? (unitsByVa.get(pUnitVa >>> 0) ?? null) : null
  return { game, unit: targetUnit, timer, unitsByVa, eventsByVa, chunksByVa, auxBlocks }
}

export function encodeSnapshotToMemory113c(snap: DecodedSnapshotGraphA, outMem: SparseMemory113c): void {
  const { game, timer, unitsByVa, eventsByVa, chunksByVa, auxBlocks } = snap

  for (const [addr, bytes] of auxBlocks) {
    outMem.loadBlock(addr, bytes)
  }

  const gameOut = game.rawBytes ? new Uint8Array(game.rawBytes) : new Uint8Array(0x100)
  const gv = new DataView(gameOut.buffer, gameOut.byteOffset, gameOut.byteLength)
  gv.setUint32(D2GameStrc.dwGameFrame.off, game.dwGameFrame >>> 0, true)
  gv.setUint32(D2GameStrc.pTimer.off, timer.va >>> 0, true)
  outMem.loadBlock(game.va, gameOut)

  const timerOut = new Uint8Array(D2TimerStrc_SIZE)
  const tv = new DataView(timerOut.buffer)
  tv.setUint32(D2TimerStrc.nCurrentSlot.off, timer.nCurrentSlot >>> 0, true)
  for (let i = 0; i < 320; i++) {
    tv.setUint32(D2TimerStrc.pSlotTail.off + i * 4, timer.slotTail[i]?.va ?? 0, true)
    tv.setUint32(D2TimerStrc.pSlotHead.off + i * 4, timer.slotHead[i]?.va ?? 0, true)
  }
  for (let p = 0; p < 5; p++) {
    tv.setUint32(D2TimerStrc.pPersistentHead.off + p * 4, timer.persistentHead[p]?.va ?? 0, true)
  }
  tv.setUint32(D2TimerStrc.pSavedNext.off, timer.savedNext?.va ?? 0, true)
  tv.setUint32(D2TimerStrc.pPool.off, timer.poolHead?.va ?? 0, true)
  outMem.loadBlock(timer.va, timerOut)

  for (const chunk of chunksByVa.values()) {
    if (chunk.isExternalStub) continue
    const hdrOut = new Uint8Array(8)
    const hv = new DataView(hdrOut.buffer)
    hv.setUint32(0, chunk.freeHead?.va ?? 0, true)
    hv.setUint32(4, chunk.nextChunk?.va ?? 0, true)
    outMem.loadBlock((chunk.va + EVENT_CHUNK_FREE_OFF_113C) >>> 0, hdrOut)
  }

  for (const u of unitsByVa.values()) {
    const unitOut = u.rawBytes ? new Uint8Array(u.rawBytes) : new Uint8Array(D2UnitStrc_SIZE)
    const uv = new DataView(unitOut.buffer, unitOut.byteOffset, unitOut.byteLength)
    uv.setUint32(D2UnitStrc.dwUnitType.off, u.dwUnitType >>> 0, true)
    uv.setUint32(D2UnitStrc.dwClassId.off, u.dwClassId >>> 0, true)
    uv.setUint32(D2UnitStrc.dwUnitId.off, u.dwUnitId >>> 0, true)
    uv.setUint32(D2UnitStrc.dwAnimMode.off, u.dwAnimMode >>> 0, true)
    uv.setUint32(D2UnitStrc.pEventFirst.off, u.eventFirst?.va ?? 0, true)
    outMem.loadBlock(u.va, unitOut)
  }

  for (const ev of eventsByVa.values()) {
    if (ev.isExternalStub) continue
    const evOut = new Uint8Array(D2EventStrc_SIZE)
    const dv = new DataView(evOut.buffer)
    dv.setUint16(0x00, ev.nType & 0xffff, true)
    dv.setUint16(0x02, ev.fFlags & 0xffff, true)
    dv.setUint32(D2EventStrc.dwFrame.off, ev.dwFrame >>> 0, true)
    dv.setUint32(D2EventStrc.pUnit.off, (ev.unit ? ev.unit.va : ev.rawUnitVa) >>> 0, true)
    dv.setUint32(D2EventStrc.dwUnitId.off, ev.dwUnitId >>> 0, true)
    dv.setUint32(D2EventStrc.dwUnitType.off, ev.dwUnitType >>> 0, true)
    dv.setUint32(D2EventStrc.dwArg14.off, ev.dwArg14 >>> 0, true)
    dv.setUint32(D2EventStrc.dwArg18.off, ev.dwArg18 >>> 0, true)
    dv.setUint32(D2EventStrc.pWheelNewer.off, ev.wheelNewer?.va ?? 0, true)
    dv.setUint32(D2EventStrc.pWheelOlder.off, ev.wheelOlder?.va ?? 0, true)
    dv.setUint32(D2EventStrc.pUnitNext.off, ev.unitNext?.va ?? 0, true)
    dv.setUint32(D2EventStrc.pUnitPrev.off, ev.unitPrev?.va ?? 0, true)
    dv.setUint32(D2EventStrc.pfnHandler.off, ev.pfnHandler >>> 0, true)
    outMem.loadBlock(ev.va, evOut)
  }
}
// === END CANDIDATE A CODEC ===

const ACT_NONE = 0
const ACT_SELF_DELETE_BY_TYPE = 1
const ACT_DELETE_UNIT_TYPE = 2
const ACT_REMOVE_UNIT = 3
const ACT_SPAWN_TIMED = 4
const CUSTOM_HANDLER_TAG = 0x77770001

function packAction(kind: number, p1: number, p2: number): number {
  return ((kind & 0xff) | ((p1 & 0xff) << 8) | ((p2 & 0xffff) << 16)) >>> 0
}

/**
 * Candidate A runner over the exact 256-scenario `eventwheel-emitter.c` protocol.
 */
function runScenarioCandidateA(
  scenarioId: number,
  masterSeed: number,
  nextFrameDigestOut?: number[],
): EventWheelRecord {
  const game = createGameObjA(0)
  const units: D2UnitObj[] = []
  for (let u = 0; u < 16; u++) {
    units.push(createUnitObjA(game, u % 5, 100 + u))
  }

  let eventCount = 0
  let firedCount = 0
  let cancelledCount = 0
  let checksum = 0x811c9dc5
  const fnvMix = (v: number): void => {
    checksum = Math.imul((checksum ^ (v >>> 0)) >>> 0, 0x01000193) >>> 0
  }

  let gen = ((masterSeed >>> 0) ^ Math.imul((scenarioId + 1) >>> 0, 0x9e3779b9)) >>> 0
  const nextRand = (): number => {
    gen = (Math.imul(gen, 1103515245) + 12345) >>> 0
    return gen
  }

  const family = (scenarioId >>> 6) & 3
  const sub = scenarioId & 63
  const baseFrames = [0, 1, 31, 62, 63, 64, 65, 127, 128, 511, 789, 820, 1023, 2048, 4095, 8192]
  const wrapDelays = [-5, -2, 0, 1, 2, 3, 62, 63, 64, 65, 66, 126, 127, 128, 129, 192]

  let initialFrame = 0
  let advanceFrames = 64
  if (family === 0) {
    initialFrame = (baseFrames[sub & 15]! + (sub >>> 4) * 7) >>> 0
    advanceFrames = 140 + (sub % 70)
  } else if (family === 1) {
    initialFrame = (100 + scenarioId * 3) >>> 0
    advanceFrames = 72
  } else if (family === 2) {
    initialFrame = (780 + sub) >>> 0
    advanceFrames = 80
  } else {
    initialFrame = (200 + sub * 11) >>> 0
    advanceFrames = sub < 8 ? 48 : 96
  }

  game.dwGameFrame = initialFrame
  EVENT_InitTimerQueueA(game)

  if (family === 0) {
    const numEvents = 16 + (sub % 16)
    for (let e = 0; e < numEvents; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const unit = uIdx < 16 ? units[uIdx]! : null
      const evType = (r >>> 8) % 14
      const d = wrapDelays[(e + (r >>> 16)) & 15]!
      let targetSigned = (initialFrame | 0) + d
      if (targetSigned === -1) targetSigned = -2
      EVENT_SetEventA(game, unit, evType, targetSigned >>> 0, CUSTOM_HANDLER_TAG, e + 1, 0)
      eventCount++
    }
  } else if (family === 1) {
    const numPersist = 4 + (sub % 7)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const unit = units[r & 15]!
      const evType = (r >>> 4) % 14
      const act = (r >>> 12) & 1 ? packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0) : 0
      EVENT_SetPersistentEventA(game, unit, evType, CUSTOM_HANDLER_TAG, 0x100 + p, act)
      eventCount++
    }
    const sameSlotOffsets = [1, 2, 65, 66]
    const numTimed = 18 + (sub % 15)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const unit = uIdx < 16 ? units[uIdx]! : null
      const evType = (r >>> 5) % 14
      const targetFrame = (initialFrame + sameSlotOffsets[(r >>> 10) & 3]!) >>> 0
      EVENT_SetEventA(game, unit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x200 + e, 0)
      eventCount++
    }
    if ((sub & 1) !== 0) {
      EVENT_DeleteEventByTypeA(game, units[sub & 15]!, sub % 14, CUSTOM_HANDLER_TAG)
      cancelledCount++
    }
    if ((sub & 2) !== 0) {
      EVENT_DeleteUnitEventsA(game, units[(sub + 5) & 15]!)
      cancelledCount++
    }
  } else if (family === 2) {
    const numPersist = 5 + (sub % 6)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 14
      const actChoice = (r >>> 8) & 3
      let act = 0
      if (actChoice === 0) act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
      else if (actChoice === 1) act = packAction(ACT_DELETE_UNIT_TYPE, (uIdx + 1) & 15, evType)
      else if (actChoice === 2) act = packAction(ACT_REMOVE_UNIT, (uIdx + 3) & 15, 0)
      else act = packAction(ACT_SPAWN_TIMED, (uIdx + 2) & 15, 1 + ((r >>> 16) & 65))
      EVENT_SetPersistentEventA(game, units[uIdx]!, evType, CUSTOM_HANDLER_TAG, 0x300 + p, act)
      eventCount++
    }
    const numTimed = 24 + (sub % 16)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 6
      const delay = ((r >>> 10) & 3) === 0 ? 64 + ((r >>> 12) & 3) : 1 + ((r >>> 12) & 7)
      const actKind = (r >>> 16) % 5
      const act = packAction(actKind, (r >>> 20) & 15, (r >>> 24) & 0x7f)
      EVENT_SetEventA(
        game,
        units[uIdx]!,
        evType,
        (initialFrame + delay) >>> 0,
        CUSTOM_HANDLER_TAG,
        0x400 + e,
        act,
      )
      eventCount++
    }
  } else {
    const totalInitial = sub < 8 ? 650 + sub * 40 : 32 + (sub % 48)
    for (let e = 0; e < totalInitial; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const unit = uIdx < 16 ? units[uIdx]! : null
      const evType = (r >>> 5) % 14
      if ((r & 15) === 0 && unit !== null) {
        const act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
        EVENT_SetPersistentEventA(game, unit, evType, CUSTOM_HANDLER_TAG, 0x500 + e, act)
      } else {
        const delay = (r >>> 10) % 132
        let actKind = ((r >>> 20) & 7) < 4 ? (r >>> 20) & 3 : (r >>> 20) === 4 ? ACT_SPAWN_TIMED : ACT_NONE
        if (unit === null && actKind === ACT_SELF_DELETE_BY_TYPE) actKind = ACT_NONE
        const act = packAction(actKind, (r >>> 24) & 15, (r >>> 16) & 0x7f)
        let targetFrame = (initialFrame + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        EVENT_SetEventA(game, unit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x600 + e, act)
      }
      eventCount++
    }
  }

  if (nextFrameDigestOut) {
    let nfHash = 0x811c9dc5
    for (let u = 0; u < 16; u++) {
      for (let t = 0; t < 14; t++) {
        nfHash = Math.imul((nfHash ^ EVENT_GetNextFrameA(units[u]!, t)) >>> 0, 0x01000193) >>> 0
      }
    }
    nextFrameDigestOut.push(nfHash)
  }

  let curFrame = initialFrame
  for (let step = 0; step < advanceFrames; step++) {
    curFrame = (curFrame + 1) >>> 0
    game.dwGameFrame = curFrame
    EVENT_UpdateTimersA(game, (g, unit, _rawVa, evType, arg14, arg18) => {
      const cf = g.dwGameFrame >>> 0
      const uType = unit !== null ? unit.dwUnitType >>> 0 : 6
      const uId = unit !== null ? unit.dwUnitId >>> 0 : 0xffffffff

      firedCount++
      fnvMix(cf)
      fnvMix(uType)
      fnvMix(uId)
      fnvMix(evType & 0xff)
      fnvMix(arg14 >>> 0)
      fnvMix(arg18 >>> 0)

      const actKind = arg18 & 0xff
      const actParam1 = (arg18 >>> 8) & 0xff
      const actParam2 = (arg18 >>> 16) & 0xffff

      if (actKind === ACT_SELF_DELETE_BY_TYPE) {
        if (unit !== null) {
          EVENT_DeleteEventByTypeA(g, unit, evType & 0xff, CUSTOM_HANDLER_TAG)
          cancelledCount++
        }
      } else if (actKind === ACT_DELETE_UNIT_TYPE) {
        const targetUnit = units[actParam1 & 15]!
        const targetType = actParam2 % 14
        EVENT_DeleteEventByTypeA(g, targetUnit, targetType, CUSTOM_HANDLER_TAG)
        cancelledCount++
      } else if (actKind === ACT_REMOVE_UNIT) {
        const targetUnit = units[actParam1 & 15]!
        EVENT_DeleteUnitEventsA(g, targetUnit)
        cancelledCount++
      } else if (actKind === ACT_SPAWN_TIMED) {
        const targetUnit = units[actParam1 & 15]!
        const delay = actParam2 & 0xff
        let targetFrame = (cf + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        const nextType = (evType + 1) % 14
        EVENT_SetEventA(
          g,
          targetUnit,
          nextType,
          targetFrame,
          CUSTOM_HANDLER_TAG,
          (arg14 + 0x10000) >>> 0,
          0,
        )
        eventCount++
      }
    })
  }

  return {
    initialFrame,
    eventCount,
    advanceFrames,
    firedCount,
    cancelledCount,
    finalFrame: curFrame,
    checksum,
    reserved: 0,
  }
}

/**
 * Candidate B runner over the exact 256-scenario `eventwheel-emitter.c` protocol on any `Memory113c`
 * (`Heap113c` linear memory or `SparseMemory113c` page-mapped memory).
 */
function runScenarioCandidateB(
  m: Memory113c,
  scenarioId: number,
  masterSeed: number,
  nextFrameDigestOut?: number[],
): EventWheelRecord {
  const pGame = m.alloc(D2GameStrc_SIZE)
  const units: number[] = []
  for (let u = 0; u < 16; u++) {
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, u % 5)
    m.set(pUnit, D2UnitStrc.dwUnitId, 100 + u)
    units.push(pUnit)
  }

  let eventCount = 0
  let firedCount = 0
  let cancelledCount = 0
  let checksum = 0x811c9dc5
  const fnvMix = (v: number): void => {
    checksum = Math.imul((checksum ^ (v >>> 0)) >>> 0, 0x01000193) >>> 0
  }

  let gen = ((masterSeed >>> 0) ^ Math.imul((scenarioId + 1) >>> 0, 0x9e3779b9)) >>> 0
  const nextRand = (): number => {
    gen = (Math.imul(gen, 1103515245) + 12345) >>> 0
    return gen
  }

  const family = (scenarioId >>> 6) & 3
  const sub = scenarioId & 63
  const baseFrames = [0, 1, 31, 62, 63, 64, 65, 127, 128, 511, 789, 820, 1023, 2048, 4095, 8192]
  const wrapDelays = [-5, -2, 0, 1, 2, 3, 62, 63, 64, 65, 66, 126, 127, 128, 129, 192]

  let initialFrame = 0
  let advanceFrames = 64
  if (family === 0) {
    initialFrame = (baseFrames[sub & 15]! + (sub >>> 4) * 7) >>> 0
    advanceFrames = 140 + (sub % 70)
  } else if (family === 1) {
    initialFrame = (100 + scenarioId * 3) >>> 0
    advanceFrames = 72
  } else if (family === 2) {
    initialFrame = (780 + sub) >>> 0
    advanceFrames = 80
  } else {
    initialFrame = (200 + sub * 11) >>> 0
    advanceFrames = sub < 8 ? 48 : 96
  }

  m.set(pGame, D2GameStrc.dwGameFrame, initialFrame)
  EVENT_InitTimerQueue113c(m, pGame)

  if (family === 0) {
    const numEvents = 16 + (sub % 16)
    for (let e = 0; e < numEvents; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 8) % 14
      const d = wrapDelays[(e + (r >>> 16)) & 15]!
      let targetSigned = (initialFrame | 0) + d
      if (targetSigned === -1) targetSigned = -2
      EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetSigned >>> 0, CUSTOM_HANDLER_TAG, e + 1, 0)
      eventCount++
    }
  } else if (family === 1) {
    const numPersist = 4 + (sub % 7)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const pUnit = units[r & 15]!
      const evType = (r >>> 4) % 14
      const act = (r >>> 12) & 1 ? packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0) : 0
      EVENT_SetPersistentEventFull113c(m, pGame, pUnit, evType, CUSTOM_HANDLER_TAG, 0x100 + p, act)
      eventCount++
    }
    const sameSlotOffsets = [1, 2, 65, 66]
    const numTimed = 18 + (sub % 15)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 5) % 14
      const targetFrame = (initialFrame + sameSlotOffsets[(r >>> 10) & 3]!) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x200 + e, 0)
      eventCount++
    }
    if ((sub & 1) !== 0) {
      EVENT_DeleteEventByType113c(m, pGame, units[sub & 15]!, sub % 14, CUSTOM_HANDLER_TAG)
      cancelledCount++
    }
    if ((sub & 2) !== 0) {
      EVENT_RemoveUnitEvents113c(m, pGame, units[(sub + 5) & 15]!)
      cancelledCount++
    }
  } else if (family === 2) {
    const numPersist = 5 + (sub % 6)
    for (let p = 0; p < numPersist; p++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 14
      const actChoice = (r >>> 8) & 3
      let act = 0
      if (actChoice === 0) act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
      else if (actChoice === 1) act = packAction(ACT_DELETE_UNIT_TYPE, (uIdx + 1) & 15, evType)
      else if (actChoice === 2) act = packAction(ACT_REMOVE_UNIT, (uIdx + 3) & 15, 0)
      else act = packAction(ACT_SPAWN_TIMED, (uIdx + 2) & 15, 1 + ((r >>> 16) & 65))
      EVENT_SetPersistentEventFull113c(m, pGame, units[uIdx]!, evType, CUSTOM_HANDLER_TAG, 0x300 + p, act)
      eventCount++
    }
    const numTimed = 24 + (sub % 16)
    for (let e = 0; e < numTimed; e++) {
      const r = nextRand()
      const uIdx = r & 15
      const evType = (r >>> 4) % 6
      const delay = ((r >>> 10) & 3) === 0 ? 64 + ((r >>> 12) & 3) : 1 + ((r >>> 12) & 7)
      const actKind = (r >>> 16) % 5
      const act = packAction(actKind, (r >>> 20) & 15, (r >>> 24) & 0x7f)
      EVENT_SetEventFull113c(
        m,
        pGame,
        units[uIdx]!,
        evType,
        (initialFrame + delay) >>> 0,
        CUSTOM_HANDLER_TAG,
        0x400 + e,
        act,
      )
      eventCount++
    }
  } else {
    const totalInitial = sub < 8 ? 650 + sub * 40 : 32 + (sub % 48)
    for (let e = 0; e < totalInitial; e++) {
      const r = nextRand()
      const uIdx = r % 17
      const pUnit = uIdx < 16 ? units[uIdx]! : 0
      const evType = (r >>> 5) % 14
      if ((r & 15) === 0 && pUnit !== 0) {
        const act = packAction(ACT_SELF_DELETE_BY_TYPE, 0, 0)
        EVENT_SetPersistentEventFull113c(m, pGame, pUnit, evType, CUSTOM_HANDLER_TAG, 0x500 + e, act)
      } else {
        const delay = (r >>> 10) % 132
        let actKind = ((r >>> 20) & 7) < 4 ? (r >>> 20) & 3 : (r >>> 20) === 4 ? ACT_SPAWN_TIMED : ACT_NONE
        if (pUnit === 0 && actKind === ACT_SELF_DELETE_BY_TYPE) actKind = ACT_NONE
        const act = packAction(actKind, (r >>> 24) & 15, (r >>> 16) & 0x7f)
        let targetFrame = (initialFrame + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        EVENT_SetEventFull113c(m, pGame, pUnit, evType, targetFrame, CUSTOM_HANDLER_TAG, 0x600 + e, act)
      }
      eventCount++
    }
  }

  if (nextFrameDigestOut) {
    let nfHash = 0x811c9dc5
    for (let u = 0; u < 16; u++) {
      for (let t = 0; t < 14; t++) {
        nfHash = Math.imul((nfHash ^ EVENT_GetNextEventFrame113c(m, units[u]!, t)) >>> 0, 0x01000193) >>> 0
      }
    }
    nextFrameDigestOut.push(nfHash)
  }

  let curFrame = initialFrame
  for (let step = 0; step < advanceFrames; step++) {
    curFrame = (curFrame + 1) >>> 0
    m.set(pGame, D2GameStrc.dwGameFrame, curFrame)
    EVENT_UpdateTimers113c(m, pGame, (_mem, g, pUnit, evType, arg14, arg18) => {
      const cf = m.get(g, D2GameStrc.dwGameFrame) >>> 0
      const uType = pUnit !== 0 ? m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0 : 6
      const uId = pUnit !== 0 ? m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0 : 0xffffffff

      firedCount++
      fnvMix(cf)
      fnvMix(uType)
      fnvMix(uId)
      fnvMix(evType & 0xff)
      fnvMix(arg14 >>> 0)
      fnvMix(arg18 >>> 0)

      const actKind = arg18 & 0xff
      const actParam1 = (arg18 >>> 8) & 0xff
      const actParam2 = (arg18 >>> 16) & 0xffff

      if (actKind === ACT_SELF_DELETE_BY_TYPE) {
        if (pUnit !== 0) {
          EVENT_DeleteEventByType113c(m, g, pUnit, evType & 0xff, CUSTOM_HANDLER_TAG)
          cancelledCount++
        }
      } else if (actKind === ACT_DELETE_UNIT_TYPE) {
        const targetUnit = units[actParam1 & 15]!
        const targetType = actParam2 % 14
        EVENT_DeleteEventByType113c(m, g, targetUnit, targetType, CUSTOM_HANDLER_TAG)
        cancelledCount++
      } else if (actKind === ACT_REMOVE_UNIT) {
        const targetUnit = units[actParam1 & 15]!
        EVENT_RemoveUnitEvents113c(m, g, targetUnit)
        cancelledCount++
      } else if (actKind === ACT_SPAWN_TIMED) {
        const targetUnit = units[actParam1 & 15]!
        const delay = actParam2 & 0xff
        let targetFrame = (cf + delay) >>> 0
        if (targetFrame === 0xffffffff) targetFrame = 0
        const nextType = (evType + 1) % 14
        EVENT_SetEventFull113c(
          m,
          g,
          targetUnit,
          nextType,
          targetFrame,
          CUSTOM_HANDLER_TAG,
          (arg14 + 0x10000) >>> 0,
          0,
        )
        eventCount++
      }
    })
  }

  return {
    initialFrame,
    eventCount,
    advanceFrames,
    firedCount,
    cancelledCount,
    finalFrame: curFrame,
    checksum,
    reserved: 0,
  }
}

interface ParsedFnRec {
  readonly fn: string
  readonly frame: number
  readonly args: readonly number[]
  readonly preBlocks: readonly (readonly [number, Uint8Array])[]
  readonly postBlocks: readonly (readonly [number, Uint8Array])[]
  readonly preAddrs: ReadonlySet<number>
}

function loadFnRecFixture(absPath: string): ParsedFnRec[] {
  const raw = gunzipSync(readFileSync(absPath)).toString('utf8')
  const out: ParsedFnRec[] = []
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue
    const parsed = JSON.parse(line) as {
      fn: string
      frame: number
      args: number[]
      pre: [number, string][]
      post: [number, string][]
    }
    const preBlocks = parsed.pre
      .filter(([, h]) => h !== '')
      .map(([a, h]) => [a >>> 0, Uint8Array.from(Buffer.from(h, 'hex'))] as const)
    const postBlocks = parsed.post
      .filter(([, h]) => h !== '')
      .map(([a, h]) => [a >>> 0, Uint8Array.from(Buffer.from(h, 'hex'))] as const)
    out.push({
      fn: parsed.fn,
      frame: parsed.frame,
      args: parsed.args,
      preBlocks,
      postBlocks,
      preAddrs: new Set(preBlocks.map(([a]) => a)),
    })
  }
  return out
}

function replaySetEventCandidateA(rec: ParsedFnRec): string | null {
  const [pGame, pUnit, type, frame, handler, arg14, arg18] = rec.args as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const snap = decodeSnapshotFromMemory113c(rec.preBlocks, pGame, pUnit)
  EVENT_SetEventA(
    snap.game,
    snap.unit,
    type,
    frame,
    handler,
    arg14,
    arg18,
    {
      checkState: (u, stateId) => u.activeStates.has(stateId),
      onMonsterAiEventWithState36: () => {
        throw new Error('0x6FD02240 not ported')
      },
    },
    false,
  )
  const outMem = new SparseMemory113c()
  encodeSnapshotToMemory113c(snap, outMem)

  for (const [addr, want] of rec.postBlocks) {
    if (!rec.preAddrs.has(addr)) continue
    const got = outMem.readBytes(addr, want.length)
    for (let i = 0; i < want.length; i++) {
      if (want[i] !== got[i]) {
        return `F${rec.frame} Candidate A mismatch at 0x${addr.toString(16)}+0x${i.toString(16)}: want ${want[i]} got ${got[i]}`
      }
    }
  }
  return null
}

function replaySetEventCandidateB(rec: ParsedFnRec): string | null {
  const m = new SparseMemory113c()
  for (const [addr, bytes] of rec.preBlocks) m.loadBlock(addr, bytes)
  const [pGame, pUnit, type, frame, handler, arg14, arg18] = rec.args as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const realHooks: EventWheelHooks113c = {
    checkState: (ptrUnit, stateId) => STATES_CheckState113c(m, ptrUnit, stateId) !== 0,
    onMonsterAiEventWithState36: () => {
      throw new Error('0x6FD02240 not ported')
    },
  }
  EVENT_SetEventFull113c(m, pGame, pUnit, type, frame, handler, arg14, arg18, realHooks)

  for (const [addr, want] of rec.postBlocks) {
    if (!rec.preAddrs.has(addr)) continue
    const got = m.readBytes(addr, want.length)
    for (let i = 0; i < want.length; i++) {
      if (want[i] !== got[i]) {
        return `F${rec.frame} Candidate B mismatch at 0x${addr.toString(16)}+0x${i.toString(16)}: want ${want[i]} got ${got[i]}`
      }
    }
  }
  return null
}

function partitionFireOrderB(
  m: Memory113c,
  pGame: number,
  partition: number,
): { node: number; persistent: boolean }[] {
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  if (pTimer === 0) return []
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const out: { node: number; persistent: boolean }[] = []
  for (let n = m.get(pTimer, D2TimerStrc.pPersistentHead, partition); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    out.push({ node: n, persistent: true })
  }
  const slot = partition * 64 + (frame & 63)
  for (let n = m.get(pTimer, D2TimerStrc.pSlotTail, slot); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    if ((m.get(n, D2EventStrc.dwFrame) >>> 0) === frame) {
      out.push({ node: n, persistent: false })
    }
  }
  return out
}

function loadOracleOrderByFrame(absPath: string): Map<number, number[][]> {
  const raw = gunzipSync(readFileSync(absPath)).toString('utf8')
  const map = new Map<number, number[][]>()
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue
    const parsed = JSON.parse(line) as { frame?: number; ord?: number[][] }
    if (typeof parsed.frame === 'number' && Array.isArray(parsed.ord)) {
      map.set(parsed.frame, parsed.ord)
    }
  }
  return map
}

/** Counts non-blank, non-comment TypeScript source lines (SLOC). */
function countSourceLines(src: string): number {
  const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, '')
  let count = 0
  for (const rawLine of withoutBlockComments.split('\n')) {
    const trimmed = rawLine.trim()
    if (trimmed === '' || trimmed.startsWith('//')) continue
    count++
  }
  return count
}

function extractRegion(fileText: string, beginMarker: string, endMarker: string): string {
  const start = fileText.indexOf(beginMarker)
  const end = fileText.indexOf(endMarker)
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Missing region markers: ${beginMarker} .. ${endMarker}`)
  }
  return fileText.slice(start + beginMarker.length, end)
}

function resolveD2tvFixturePath(): string {
  const primary = resolve(import.meta.dirname, '../../tools/oracle/vectors/eventwheel-113c.d2tv')
  if (existsSync(primary)) return primary
  const fallback = resolve(import.meta.dirname, '../fixtures/oracle/vectors/eventwheel-113c.d2tv')
  return fallback
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >>> 1
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

describe('A/B Evaluation: Full 1.13c EventWheel (0x30 D2EventStrc + 0xA20 D2TimerStrc, 5x64 Partitions + Persistent LIFO)', () => {
  it('verifies exact 1.13c binary structure dimensions (D2EventStrc = 0x30, D2TimerStrc = 0xA20, chunk = 0x7088)', () => {
    expect(D2EventStrc_SIZE).toBe(0x30)
    expect(EVENT_NODE_SIZE_113C).toBe(0x30)
    expect(D2TimerStrc_SIZE).toBe(0xa20)
    expect(D2TimerStrc.pSlotTail.off).toBe(0x004)
    expect(D2TimerStrc.pSlotTail.count).toBe(320)
    expect(D2TimerStrc.pSlotHead.off).toBe(0x504)
    expect(D2TimerStrc.pSlotHead.count).toBe(320)
    expect(D2TimerStrc.pPersistentHead.off).toBe(0xa04)
    expect(D2TimerStrc.pPersistentHead.count).toBe(5)
    expect(D2TimerStrc.pSavedNext.off).toBe(0xa18)
    expect(D2TimerStrc.pPool.off).toBe(0xa1c)
    expect(EVENT_NODES_PER_CHUNK_113C).toBe(600)
    expect(EVENT_CHUNK_FREE_OFF_113C).toBe(0x7080)
    expect(EVENT_CHUNK_NEXT_OFF_113C).toBe(0x7084)
    expect(EVENT_CHUNK_SIZE_113C).toBe(0x7088)
  })

  it('passes all 256 EVTWHEEL .d2tv multi-frame scenarios (45,101 fired events + EVENT_GetNextFrame) with 0 mismatches on BOTH Candidate A and Candidate B', () => {
    const vectorPath = resolveD2tvFixturePath()
    expect(existsSync(vectorPath)).toBe(true)
    const raw = readFileSync(vectorPath)
    const vectorBytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
    const header = parseVectorHeader(vectorBytes)
    expect(header.kind).toBe('EVTWHEEL')
    expect(header.recordCount).toBe(256)

    const masterSeed = Number(header.seed & 0xffffffffn) >>> 0
    const nextFrameDigestsA: number[] = []
    const nextFrameDigestsB: number[] = []

    let mismatchesA = 0
    let mismatchesBHeap = 0
    let mismatchesBSparse = 0
    let totalFiredA = 0
    let totalFiredB = 0

    for (let i = 0; i < header.recordCount; i++) {
      const expected = decodeEventWheelRecord(vectorBytes, 32 + i * EVTWHEEL_RECORD_SIZE)
      const actualA = runScenarioCandidateA(i, masterSeed, nextFrameDigestsA)
      const actualBHeap = runScenarioCandidateB(new Heap113c(131072), i, masterSeed, nextFrameDigestsB)
      const actualBSparse = runScenarioCandidateB(new SparseMemory113c(), i, masterSeed)

      totalFiredA += actualA.firedCount
      totalFiredB += actualBHeap.firedCount

      const eqExpected = (r: EventWheelRecord): boolean =>
        r.initialFrame === expected.initialFrame &&
        r.eventCount === expected.eventCount &&
        r.advanceFrames === expected.advanceFrames &&
        r.firedCount === expected.firedCount &&
        r.cancelledCount === expected.cancelledCount &&
        r.finalFrame === expected.finalFrame &&
        r.checksum === expected.checksum

      if (!eqExpected(actualA)) mismatchesA++
      if (!eqExpected(actualBHeap)) mismatchesBHeap++
      if (!eqExpected(actualBSparse)) mismatchesBSparse++
    }

    expect(mismatchesA).toBe(0)
    expect(mismatchesBHeap).toBe(0)
    expect(mismatchesBSparse).toBe(0)
    expect(totalFiredA).toBe(45_101)
    expect(totalFiredB).toBe(45_101)
    expect(nextFrameDigestsA).toEqual(nextFrameDigestsB)
  })

  it('preserves freed node unit/link fields in EVENT_FreeNodeA matching 0x6FCAE6F0 & Candidate B', () => {
    const gameA = createGameObjA(10)
    EVENT_InitTimerQueueA(gameA)
    const unitA = createUnitObjA(gameA, 1, 12)
    const e1A = EVENT_SetEventA(gameA, unitA, 2, 15)!
    const e2A = EVENT_SetEventA(gameA, unitA, 3, 16)!
    expect(unitA.eventFirst).toBe(e2A)
    expect(e2A.unitNext).toBe(e1A)
    EVENT_FreeNodeA(gameA, e2A)
    expect(unitA.eventFirst).toBe(e1A)
    expect(e1A.unitPrev).toBeNull()
    expect(e2A.unit).toBe(unitA)
    expect(e2A.rawUnitVa).toBe(unitA.va)
    expect(e2A.unitNext).toBe(e1A)
    expect(e2A.fFlags).toBe(0x0002)

    const heap = new Heap113c(131072)
    const pGame = heap.alloc(D2GameStrc_SIZE)
    heap.set(pGame, D2GameStrc.dwGameFrame, 10)
    EVENT_InitTimerQueue113c(heap, pGame)
    const pUnit = heap.alloc(D2UnitStrc_SIZE)
    heap.set(pUnit, D2UnitStrc.dwUnitType, 1)
    heap.set(pUnit, D2UnitStrc.dwUnitId, 12)
    const n1 = EVENT_SetEventFull113c(heap, pGame, pUnit, 2, 15)
    const n2 = EVENT_SetEventFull113c(heap, pGame, pUnit, 3, 16)
    EVENT_FreeNode113c(heap, pGame, n2)
    expect(heap.get(pUnit, D2UnitStrc.pEventFirst)).toBe(n1)
    expect(heap.get(n2, D2EventStrc.pUnit)).toBe(pUnit)
    expect(heap.get(n2, D2EventStrc.pUnitNext)).toBe(n1)
    expect(heap.u16(n2 + 0x02)).toBe(0x0002)
  })

  it('replays all 94 recorded D2Game.dll EVENT_SetEvent fnrec snapshots and verifies all 41 EVENT_UpdateTimers frames against D2Game.dll ord log (a1c-ord-f785)', () => {
    const setEventPath = join(
      import.meta.dirname,
      '../fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz',
    )
    const setEventRecs = loadFnRecFixture(setEventPath)
    expect(setEventRecs.length).toBe(94)

    const errorsA: string[] = []
    const errorsB: string[] = []
    for (const rec of setEventRecs) {
      const errA = replaySetEventCandidateA(rec)
      const errB = replaySetEventCandidateB(rec)
      if (errA !== null) errorsA.push(errA)
      if (errB !== null) errorsB.push(errB)
    }
    expect(errorsA).toEqual([])
    expect(errorsB).toEqual([])

    const timersPath = join(
      import.meta.dirname,
      '../fixtures/oracle/route2/a1c-fnrec-timers-f785.ndjson.gz',
    )
    const ordPath = join(
      import.meta.dirname,
      '../fixtures/oracle/route2/a1c-ord-f785.ndjson.gz',
    )
    const timerRecs = loadFnRecFixture(timersPath)
    const ordByFrame = loadOracleOrderByFrame(ordPath)
    expect(timerRecs.length).toBe(41)
    expect(ordByFrame.size).toBe(41)

    let abParityMismatches = 0
    let dllOrdMismatchesNonCrossPartition = 0
    let nonCrossPartitionFrames = 0

    for (const rec of timerRecs) {
      const pGame = rec.args[0]!
      const snapA = decodeSnapshotFromMemory113c(rec.preBlocks, pGame, 0)
      const mB = new SparseMemory113c()
      for (const [addr, bytes] of rec.preBlocks) mB.loadBlock(addr, bytes)

      const nonPlayerSeqA: number[][] = []
      const nonPlayerSeqB: number[][] = []

      for (const part of EVENT_UPDATE_PARTITION_ORDER_113C) {
        const orderA = EVENT_PartitionFireOrderA(snapA.game, part)
        const orderB = partitionFireOrderB(mB, pGame, part)

        const fullTupleA = orderA.map((f) => [
          f.node.va,
          f.persistent ? 2 : 1,
          f.node.nType & 0xff,
          f.node.dwUnitType,
          f.node.dwUnitId,
        ])
        const fullTupleB = orderB.map((f) => [
          f.node,
          f.persistent ? 2 : 1,
          mB.get(f.node, D2EventStrc.nType),
          mB.get(f.node, D2EventStrc.dwUnitType),
          mB.get(f.node, D2EventStrc.dwUnitId),
        ])
        if (JSON.stringify(fullTupleA) !== JSON.stringify(fullTupleB)) {
          abParityMismatches++
        }

        for (const f of orderA) {
          if (f.node.dwUnitType !== 0) {
            nonPlayerSeqA.push([f.persistent ? 2 : 1, f.node.nType & 0xff, f.node.dwUnitType, f.node.dwUnitId])
          }
        }
        for (const f of orderB) {
          const ut = mB.get(f.node, D2EventStrc.dwUnitType)
          if (ut !== 0) {
            nonPlayerSeqB.push([
              f.persistent ? 2 : 1,
              mB.get(f.node, D2EventStrc.nType),
              ut,
              mB.get(f.node, D2EventStrc.dwUnitId),
            ])
          }
        }
      }

      const dllOrd = (ordByFrame.get(rec.frame) ?? []).map((row) => row.slice(0, 4))
      if (rec.frame === 801) {
        // F801 pre-walk snapshot captures D2TimerStrc at EVENT_UpdateTimers entry BEFORE partition 0
        // (Player #1 melee hit) kills Fallen #12 and invokes EVENT_RemoveUnitEvents(#12) prior to partition 1.
        const expectedPreWalk801 = [
          [2, 0, 1, 13],
          [2, 0, 1, 14],
          [2, 0, 1, 12],
          [1, 2, 1, 9],
          [1, 2, 1, 10],
          [1, 2, 1, 11],
        ]
        expect(nonPlayerSeqA).toEqual(expectedPreWalk801)
        expect(nonPlayerSeqB).toEqual(expectedPreWalk801)
        expect(dllOrd).toEqual(expectedPreWalk801.filter((e) => e[3] !== 12))
      } else {
        nonCrossPartitionFrames++
        if (
          JSON.stringify(nonPlayerSeqA) !== JSON.stringify(dllOrd) ||
          JSON.stringify(nonPlayerSeqB) !== JSON.stringify(dllOrd)
        ) {
          dllOrdMismatchesNonCrossPartition++
        }
      }
    }

    expect(abParityMismatches).toBe(0)
    expect(nonCrossPartitionFrames).toBe(40)
    expect(dllOrdMismatchesNonCrossPartition).toBe(0)
  })

  it('measures real wall-clock throughput (ms & ns/event) and exact SLOC of Candidate A (Core + Codec) vs Candidate B', () => {
    const vectorPath = resolveD2tvFixturePath()
    const raw = readFileSync(vectorPath)
    const vectorBytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
    const header = parseVectorHeader(vectorBytes)
    const masterSeed = Number(header.seed & 0xffffffffn) >>> 0

    const setEventPath = join(
      import.meta.dirname,
      '../fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz',
    )
    const setEventRecs = loadFnRecFixture(setEventPath)

    // Warmup both candidates
    for (let w = 0; w < 2; w++) {
      for (let i = 0; i < header.recordCount; i++) {
        runScenarioCandidateA(i, masterSeed)
        runScenarioCandidateB(new Heap113c(131072), i, masterSeed)
        runScenarioCandidateB(new SparseMemory113c(), i, masterSeed)
      }
      for (const rec of setEventRecs) {
        replaySetEventCandidateA(rec)
        replaySetEventCandidateB(rec)
      }
    }

    const SCENARIO_RUNS = 7
    const stepSamplesA: number[] = []
    const stepSamplesBHeap: number[] = []
    const stepSamplesBSparse: number[] = []

    for (let r = 0; r < SCENARIO_RUNS; r++) {
      const t0 = performance.now()
      for (let i = 0; i < header.recordCount; i++) {
        runScenarioCandidateA(i, masterSeed)
      }
      stepSamplesA.push(performance.now() - t0)

      const t1 = performance.now()
      for (let i = 0; i < header.recordCount; i++) {
        runScenarioCandidateB(new Heap113c(131072), i, masterSeed)
      }
      stepSamplesBHeap.push(performance.now() - t1)

      const t2 = performance.now()
      for (let i = 0; i < header.recordCount; i++) {
        runScenarioCandidateB(new SparseMemory113c(), i, masterSeed)
      }
      stepSamplesBSparse.push(performance.now() - t2)
    }

    const FNREC_RUNS = 25
    const fnrecSamplesA: number[] = []
    const fnrecSamplesB: number[] = []
    for (let r = 0; r < FNREC_RUNS; r++) {
      const t0 = performance.now()
      for (const rec of setEventRecs) {
        const err = replaySetEventCandidateA(rec)
        if (err !== null) throw new Error(err)
      }
      fnrecSamplesA.push(performance.now() - t0)

      const t1 = performance.now()
      for (const rec of setEventRecs) {
        const err = replaySetEventCandidateB(rec)
        if (err !== null) throw new Error(err)
      }
      fnrecSamplesB.push(performance.now() - t1)
    }

    const TOTAL_FIRED = 45_101
    const stepMedianMsA = median(stepSamplesA)
    const stepMedianMsBHeap = median(stepSamplesBHeap)
    const stepMedianMsBSparse = median(stepSamplesBSparse)
    const nsPerEventA = (stepMedianMsA * 1e6) / TOTAL_FIRED
    const nsPerEventBHeap = (stepMedianMsBHeap * 1e6) / TOTAL_FIRED
    const nsPerEventBSparse = (stepMedianMsBSparse * 1e6) / TOTAL_FIRED

    const fnrecMedianMsA = median(fnrecSamplesA)
    const fnrecMedianMsB = median(fnrecSamplesB)
    const usPerCallA = (fnrecMedianMsA * 1e3) / setEventRecs.length
    const usPerCallB = (fnrecMedianMsB * 1e3) / setEventRecs.length

    // Count exact SLOC of Candidate A vs Candidate B
    const thisFileText = readFileSync(join(import.meta.dirname, 'ab-eventwheel.test.ts'), 'utf8')
    const candACoreSloc = countSourceLines(
      extractRegion(thisFileText, '// === BEGIN CANDIDATE A CORE ===', '// === END CANDIDATE A CORE ==='),
    )
    const candACodecSloc = countSourceLines(
      extractRegion(thisFileText, '// === BEGIN CANDIDATE A CODEC ===', '// === END CANDIDATE A CODEC ==='),
    )
    const candATotalSloc = candACoreSloc + candACodecSloc

    const timerWheelText = readFileSync(
      resolve(import.meta.dirname, '../../src/d2kern-113c/game/timer-wheel.ts'),
      'utf8',
    )
    const candBTimerWheelSloc = countSourceLines(timerWheelText)
    const candBCodecSloc = 0
    const candBTotalSloc = candBTimerWheelSloc + candBCodecSloc

    console.info(
      JSON.stringify({
        benchmark: 'ab-eventwheel-113c',
        scenarios: 256,
        totalFiredEvents: TOTAL_FIRED,
        fnrecCalls: setEventRecs.length,
        sloc: {
          candidateACore: candACoreSloc,
          candidateACodec: candACodecSloc,
          candidateATotal: candATotalSloc,
          candidateBTimerWheel: candBTimerWheelSloc,
          candidateBCodec: candBCodecSloc,
          candidateBTotal: candBTotalSloc,
        },
        d2tv256: {
          candidateAMs: Number(stepMedianMsA.toFixed(3)),
          candidateANsPerFiredEvent: Number(nsPerEventA.toFixed(1)),
          candidateBHeapMs: Number(stepMedianMsBHeap.toFixed(3)),
          candidateBHeapNsPerFiredEvent: Number(nsPerEventBHeap.toFixed(1)),
          candidateBSparseMs: Number(stepMedianMsBSparse.toFixed(3)),
          candidateBSparseNsPerFiredEvent: Number(nsPerEventBSparse.toFixed(1)),
        },
        fnrec94: {
          candidateAMs: Number(fnrecMedianMsA.toFixed(3)),
          candidateAUsPerCall: Number(usPerCallA.toFixed(2)),
          candidateBMs: Number(fnrecMedianMsB.toFixed(3)),
          candidateBUsPerCall: Number(usPerCallB.toFixed(2)),
        },
      }),
    )

    expect(candACoreSloc).toBeGreaterThan(200)
    expect(candACodecSloc).toBeGreaterThan(100)
    expect(candBTimerWheelSloc).toBeGreaterThan(200)
    expect(stepMedianMsA).toBeGreaterThan(0)
    expect(stepMedianMsBHeap).toBeGreaterThan(0)
    expect(fnrecMedianMsA).toBeGreaterThan(0)
    expect(fnrecMedianMsB).toBeGreaterThan(0)
  })
})
