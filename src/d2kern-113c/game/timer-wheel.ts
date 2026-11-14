/**
 * Diablo II v1.13c complete 64-slot event timer wheel & chunk pool allocator (`D2TimerStrc`).
 *
 * Binary evidence (`D2Game.dll`, image base `0x6FC20000`):
 * - `0x6FCAE420`: `EVENT_AllocChunk` (`sizeof = 0x7088`: 600 nodes * `0x30` + `+0x7080 pFreeHead` + `+0x7084 pNextChunk`)
 * - `0x6FCAE630`: `EVENT_InitTimerQueue` (`sizeof = 0xA20`: allocates `D2TimerStrc` + initial `0x7088` chunk)
 * - `0x6FCAE540`: `EVENT_AllocNode` (walks chunks, grows by allocating new `0x7088` chunk when exhausted)
 * - `0x6FCAE680`: `EVENT_CreateNode` (links at head of `unit+0xDC` along `+0x24/+0x28`)
 * - `0x6FCAE6F0`: `EVENT_FreeNode` (`fFlags & 0x01` deferred `0x08` re-entrant guard, `pSavedNext` advance, wheel + unit unlink, push free-list)
 * - `0x6FCAE810`: `EVENT_SetPersistentEvent` (`dwFrame = 0xFFFFFFFF`, `fFlags |= 0x04`, LIFO head-insert at `T+0xA04+part*4`)
 * - `0x6FCAEA80`: `EVENT_SetEvent` (`frame <= dwGameFrame` -> `dwGameFrame + 1`, state-`0x36` `0x6FD02240` refresh, FIFO tail->head at `T+0x004` / `T+0x504`)
 * - `0x6FD02240`: `MONSTER_RefreshAiEvent` (`STATES_ToggleState(0x36, bSet)`, `0x5C` check, frees `nType == 2` AI events on monster)
 * - `0x6FCAE880`: `EVENT_RemoveUnitEvents`
 * - `0x6FCAE8C0`: `EVENT_DeleteEventByType` (matches `nType` and `pfnHandler` `+0x2C`)
 * - `0x6FCAE900`: `EVENT_DeleteEventByArg14` (matches `nType` and, when `arg14 != 0`, `dwArg14` `+0x14`)
 * - `0x6FCAE490`: `EVENT_GetNextEventFrame`
 * - `0x6FCAF070`: `EVENT_UpdateTimers` (partition order `[2, 0, 1, 3, 4]`: persistent list first, then slot `frame & 63`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2EventStrc,
  D2GameStrc,
  D2TimerStrc,
  D2TimerStrc_SIZE,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  EVENT_PARTITION_BY_UNIT_TYPE_113C,
  EVENT_UPDATE_PARTITION_ORDER_113C,
  type EventWheelHooks113c,
} from '../mem/event-wheel-113c.ts'
import { STATES_CheckState113c, STATES_ToggleGfxStateFlag113c } from '../common/statlist.ts'
import { UNITROOM_RefreshUnit113c } from '../common/unit.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'

export { EVENT_PARTITION_BY_UNIT_TYPE_113C, EVENT_UPDATE_PARTITION_ORDER_113C, type EventWheelHooks113c }

export const EVENT_NODES_PER_CHUNK_113C = 600
export const EVENT_NODE_SIZE_113C = 0x30
export const EVENT_CHUNK_FREE_OFF_113C = 0x7080
export const EVENT_CHUNK_NEXT_OFF_113C = 0x7084
export const EVENT_CHUNK_SIZE_113C = 0x7088

export const EVENT_FLAG_FIRING = 0x01
export const EVENT_FLAG_PERSISTENT = 0x04
export const EVENT_FLAG_DEFERRED_FREE = 0x08

export const STATE_UNINTERRUPTABLE_113C = 0x36
export const STATE_CORPSE_DELAY_113C = 0x5c

export type EventDispatchCallback113c = (
  m: Memory113c,
  pGame: number,
  pUnit: number,
  eventType: number,
  arg14: number,
  arg18: number,
  pfnHandler: number,
  pNode: number,
) => void

/** `@va D2Game:0x6FCAE420`: allocate one `0x7088` chunk of 600 `0x30`-byte `D2EventStrc` nodes. */
export function EVENT_AllocChunk113c(m: Memory113c, pTimer: number): number {
  const chunk = m.alloc(EVENT_CHUNK_SIZE_113C)
  for (let i = 0; i < EVENT_NODES_PER_CHUNK_113C - 1; i++) {
    const node = chunk + i * EVENT_NODE_SIZE_113C
    const nextNode = chunk + (i + 1) * EVENT_NODE_SIZE_113C
    m.setU32(node + 0x1c, nextNode)
  }
  m.setU32(chunk + (EVENT_NODES_PER_CHUNK_113C - 1) * EVENT_NODE_SIZE_113C + 0x1c, 0)
  m.setU32(chunk + EVENT_CHUNK_FREE_OFF_113C, chunk)

  const firstChunk = m.get(pTimer, D2TimerStrc.pPool)
  if (firstChunk === 0) {
    m.setU32(chunk + EVENT_CHUNK_NEXT_OFF_113C, 0)
    m.set(pTimer, D2TimerStrc.pPool, chunk)
  } else {
    // 0x6FCAE570: links newly allocated overflow chunk directly after `firstChunk`.
    const secondChunk = m.u32(firstChunk + EVENT_CHUNK_NEXT_OFF_113C)
    m.setU32(chunk + EVENT_CHUNK_NEXT_OFF_113C, secondChunk)
    m.setU32(firstChunk + EVENT_CHUNK_NEXT_OFF_113C, chunk)
  }
  return chunk
}

/** `@va D2Game:0x6FCAE630`: allocate `D2TimerStrc` (`0xA20`) and initial `0x7088` node pool chunk. */
export function EVENT_InitTimerQueue113c(m: Memory113c, pGame: number): number {
  const pTimer = m.alloc(D2TimerStrc_SIZE)
  m.set(pGame, D2GameStrc.pTimer, pTimer)
  EVENT_AllocChunk113c(m, pTimer)
  return pTimer
}

/** `@va D2Game:0x6FCAE540`: pop a free `D2EventStrc` node across pool chunks, allocating a new chunk if full. */
export function EVENT_AllocNodeWithGrowth113c(m: Memory113c, pTimer: number): number {
  for (let chunk = m.get(pTimer, D2TimerStrc.pPool); chunk !== 0; chunk = m.u32(chunk + EVENT_CHUNK_NEXT_OFF_113C)) {
    const node = m.u32(chunk + EVENT_CHUNK_FREE_OFF_113C)
    if (node === 0) continue
    m.setU32(chunk + EVENT_CHUNK_FREE_OFF_113C, m.u32(node + 0x1c))
    m.fill(node, EVENT_NODE_SIZE_113C, 0)
    return node
  }
  const newChunk = EVENT_AllocChunk113c(m, pTimer)
  const node = m.u32(newChunk + EVENT_CHUNK_FREE_OFF_113C)
  m.setU32(newChunk + EVENT_CHUNK_FREE_OFF_113C, m.u32(node + 0x1c))
  m.fill(node, EVENT_NODE_SIZE_113C, 0)
  return node
}

/** `@va D2Game:0x6FCAE680`: allocate event node and prepend to `pUnit->pEventFirst (+0xDC)`. */
export function EVENT_CreateNodeWithGrowth113c(m: Memory113c, pGame: number, pUnit: number): number {
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const node = EVENT_AllocNodeWithGrowth113c(m, pTimer)
  m.set(node, D2EventStrc.pUnit, pUnit)
  const oldFirst = pUnit === 0 ? 0 : m.get(pUnit, D2UnitStrc.pEventFirst)
  m.set(node, D2EventStrc.pUnitNext, oldFirst)
  if (oldFirst !== 0) m.set(oldFirst, D2EventStrc.pUnitPrev, node)
  m.set(node, D2EventStrc.pUnitPrev, 0)
  if (pUnit !== 0) {
    const type = m.get(pUnit, D2UnitStrc.dwUnitType)
    m.set(pUnit, D2UnitStrc.pEventFirst, node)
    m.set(node, D2EventStrc.dwUnitType, type)
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) & 0xfd)
    m.set(node, D2EventStrc.dwUnitId, m.get(pUnit, D2UnitStrc.dwUnitId))
  } else {
    m.set(node, D2EventStrc.dwUnitType, 6)
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) & 0xfd)
    m.set(node, D2EventStrc.dwUnitId, 0xffffffff)
  }
  return node
}

/**
 * `@va D2Game:0x6FCAE6F0` (`EVENT_FreeNode`, `edi = pGame`, `eax = pNode`).
 * Implements re-entrancy deferred free (`fFlags & 0x01` -> `fFlags |= 0x08`), `pSavedNext` cursor
 * advance, wheel unlink, unit list unlink, and free-list return.
 */
export function EVENT_FreeNode113c(m: Memory113c, pGame: number, pNode: number): void {
  if (pGame === 0 || pNode === 0) return
  const flags = m.get(pNode, D2EventStrc.fFlags)
  if ((flags & EVENT_FLAG_FIRING) !== 0) {
    m.set(pNode, D2EventStrc.fFlags, flags | EVENT_FLAG_DEFERRED_FREE)
    return
  }

  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const newer = m.get(pNode, D2EventStrc.pWheelNewer)
  const older = m.get(pNode, D2EventStrc.pWheelOlder)

  if (m.get(pTimer, D2TimerStrc.pSavedNext) === pNode) {
    m.set(pTimer, D2TimerStrc.pSavedNext, newer)
  }

  const unitType = m.get(pNode, D2EventStrc.dwUnitType)
  const part = EVENT_PARTITION_BY_UNIT_TYPE_113C[unitType]
  if (part === undefined) {
    throw new RangeError(`EVENT_FreeNode113c: invalid unitType=${unitType}`)
  }
  const frame = m.get(pNode, D2EventStrc.dwFrame) >>> 0

  if (older !== 0) {
    m.set(older, D2EventStrc.pWheelNewer, newer)
  } else if (frame === 0xffffffff) {
    if (part >= 0) {
      m.set(pTimer, D2TimerStrc.pPersistentHead, newer, part)
    }
  } else if (part >= 0) {
    const slot = part * 64 + (frame & 63)
    m.set(pTimer, D2TimerStrc.pSlotTail, newer, slot)
  }

  if (newer !== 0) {
    m.set(newer, D2EventStrc.pWheelOlder, older)
  } else if (frame !== 0xffffffff && part >= 0) {
    const slot = part * 64 + (frame & 63)
    if (m.get(pTimer, D2TimerStrc.pSlotHead, slot) === pNode) {
      m.set(pTimer, D2TimerStrc.pSlotHead, older, slot)
    }
  }

  // Unlink from `pUnit->pEventFirst` (`0x6FCAE7B6..0x6FCAE7E3`: leaves `pNode` fields +0x08/+0x24/+0x28 untouched)
  const pUnit = m.get(pNode, D2EventStrc.pUnit)
  if (pUnit !== 0) {
    const uNext = m.get(pNode, D2EventStrc.pUnitNext)
    const uPrev = m.get(pNode, D2EventStrc.pUnitPrev)
    if (uNext !== 0) m.set(uNext, D2EventStrc.pUnitPrev, uPrev)
    if (uPrev !== 0) m.set(uPrev, D2EventStrc.pUnitNext, uNext)
    else m.set(pUnit, D2UnitStrc.pEventFirst, uNext)
  }

  // Push onto first pool chunk free-list (`chunk + 0x7080`) and mark freed (`0x6FCAE805: word [eax+2] = 2`)
  const firstChunk = m.get(pTimer, D2TimerStrc.pPool)
  if (firstChunk !== 0) {
    const prevFree = m.u32(firstChunk + EVENT_CHUNK_FREE_OFF_113C)
    m.set(pNode, D2EventStrc.pWheelNewer, prevFree)
    m.set(pNode, D2EventStrc.pWheelOlder, 0)
    m.setU32(firstChunk + EVENT_CHUNK_FREE_OFF_113C, pNode)
  }
  m.setU16(pNode + 0x02, 0x0002)
}

/**
 * `@va D2Game:0x6FD009D0` (`SUNIT_GetLastAttacker`, `eax = pUnit`, `ecx = pGame`):
 * If `(pUnit->dwFlags2 (+0xC8) & 0x20000) == 0`, returns `0`; otherwise resolves the attacker unit via
 * `SUNIT_GetServerUnit113c(m, pGame, u32(pUnit + 0x9C), u32(pUnit + 0xA0))`.
 */
export function SUNIT_GetLastAttacker113c(m: Memory113c, pGame: number, pUnit: number): number {
  if (pUnit === 0 || pGame === 0) return 0
  if ((m.get(pUnit, D2UnitStrc.dwFlags2) & 0x20000) === 0) return 0
  return SUNIT_GetServerUnit113c(m, pGame, m.u32(pUnit + 0x9c), m.u32(pUnit + 0xa0))
}

/**
 * `@va D2Game:0x6FD02240` (`MONSTER_SetUninterruptable` / `MONSTER_RefreshAiEvent`, `ecx = pUnit`, `edx = bSet`).
 * - Toggles `STATE_UNINTERRUPTABLE` (`0x36 = 54`) via `D2Common.#10945` (`STATES_ToggleGfxStateFlag113c` at `0x6FD0224D`).
 * - Loads `pGame = pUnit->pGame (+0x80)` (`0x6FD02276`); if `pGame == 0`, returns immediately (`0x6FD0227E`).
 * - When `bSet == 0` and `STATE_CORPSE_DELAY` (`0x5C = 92`) is set (`0x6FD02280..0x6FD022D1`), clears `0x5C`
 *   via `D2Common.#10945`, resolves killer via `0x6FD009D0` (`SUNIT_GetLastAttacker113c`), and:
 *   - if `pKiller != 0` (`0x6FD022B9..0x6FD022D1`), zeroes `D2DamageStrc`, sets `wResultFlags = 2`, and calls
 *     `0x6FCFCF20(pGame, pKiller, pUnit, 1, &dmg)` (`SUNITDMG_ExecuteDamageResult`);
 *   - if `pKiller == 0` (`0x6FD022A9..0x6FD022B7`), calls `0x6FCFEEE0(pGame, pUnit, 0, 1)` (`SUNITDMG_KillMonster`),
 *     which returns immediately at `0x6FCFEF0C..0x6FCFEF1A` when `uType == 1 && (dwAnimMode == 0 || dwAnimMode == 12)`.
 * - When `pUnit->dwUnitType == 1` (`UNIT_MONSTER`), walks `pUnit->pEventFirst` (`+0xDC`) and frees all
 *   `nType == 2` (`MON_EVENT_AI_THINK`) nodes via `EVENT_FreeNode113c` (`0x6FCAE6F0`).
 */
export function MONSTER_RefreshAiEvent113c(
  m: Memory113c,
  pUnit: number,
  bSet: number,
  onCorpseNoDrawKill?: (m: Memory113c, pGame: number, pUnit: number, pKiller: number) => void,
): void {
  if (pUnit === 0) return
  STATES_ToggleGfxStateFlag113c(m, pUnit, STATE_UNINTERRUPTABLE_113C, bSet)
  const pGame = m.get(pUnit, D2UnitStrc.pGame)
  if (pGame === 0) return

  if (bSet === 0 && STATES_CheckState113c(m, pUnit, STATE_CORPSE_DELAY_113C) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, STATE_CORPSE_DELAY_113C, 0)
    const pKiller = SUNIT_GetLastAttacker113c(m, pGame, pUnit)
    if (onCorpseNoDrawKill !== undefined) {
      onCorpseNoDrawKill(m, pGame, pUnit, pKiller)
    } else {
      const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
      const curMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
      if (pKiller !== 0 || uType !== 1 || (curMode !== 0 && curMode !== 12)) {
        throw new Error(
          'MONSTER_RefreshAiEvent113c (0x6FD02240): live state-0x5C kill requires onCorpseNoDrawKill (0x6FCFCF20 / 0x6FCFEEE0)',
        )
      }
    }
  }

  if (m.get(pUnit, D2UnitStrc.dwUnitType) === 1) {
    let cur = m.get(pUnit, D2UnitStrc.pEventFirst)
    while (cur !== 0) {
      const next = m.get(cur, D2EventStrc.pUnitNext)
      if (m.get(cur, D2EventStrc.nType) === 2) {
        EVENT_FreeNode113c(m, pGame, cur)
      }
      cur = next
    }
  }
}

/** `@va D2Game:0x6FCAE810` (`EVENT_SetPersistentEvent`). */
export function EVENT_SetPersistentEventFull113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  handler: number,
  arg14: number,
  arg18: number,
): number {
  if ((type | 0) >= 15) return 0
  const node = EVENT_CreateNodeWithGrowth113c(m, pGame, pUnit)
  m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_PERSISTENT)
  m.set(node, D2EventStrc.dwArg14, arg14 >>> 0)
  m.set(node, D2EventStrc.nType, type & 0xff)
  m.set(node, D2EventStrc.dwFrame, 0xffffffff)
  m.set(node, D2EventStrc.dwArg18, arg18 >>> 0)
  m.set(node, D2EventStrc.pfnHandler, handler >>> 0)

  const unitType = pUnit === 0 ? 6 : m.get(pUnit, D2UnitStrc.dwUnitType)
  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[unitType]
  if (partition === undefined || partition < 0) {
    throw new Error(`EVENT_SetPersistentEventFull113c: invalid unit type ${unitType}`)
  }
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const oldHead = m.get(pTimer, D2TimerStrc.pPersistentHead, partition)
  m.set(node, D2EventStrc.pWheelNewer, oldHead)
  m.set(node, D2EventStrc.pWheelOlder, 0)
  if (oldHead !== 0) m.set(oldHead, D2EventStrc.pWheelOlder, node)
  m.set(pTimer, D2TimerStrc.pPersistentHead, node, partition)
  return node
}

/** `@va D2Game:0x6FCAEA80` (`EVENT_SetEvent`) with automatic chunk growth and default state-`0x36` `0x6FD02240` refresh. */
export function EVENT_SetEventFull113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  frame: number,
  handler = 0,
  arg14 = 0,
  arg18 = 0,
  hooks?: EventWheelHooks113c,
): number {
  if ((type | 0) >= 15) return 0
  if ((frame | 0) === -1) {
    return EVENT_SetPersistentEventFull113c(m, pGame, pUnit, type, 0, arg14, arg18)
  }
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame)
  let f = frame | 0
  if (f <= (gameFrame | 0)) f = (gameFrame + 1) | 0

  if (pUnit !== 0 && m.get(pUnit, D2UnitStrc.dwUnitType) === 1 && type === 2) {
    if (hooks !== undefined) {
      if (hooks.checkState(pUnit, STATE_UNINTERRUPTABLE_113C)) {
        hooks.onMonsterAiEventWithState36(pUnit)
      }
    } else if (STATES_CheckState113c(m, pUnit, STATE_UNINTERRUPTABLE_113C) !== 0) {
      MONSTER_RefreshAiEvent113c(m, pUnit, 0)
    }
  }

  const node = EVENT_CreateNodeWithGrowth113c(m, pGame, pUnit)
  m.set(node, D2EventStrc.dwArg14, arg14 >>> 0)
  m.set(node, D2EventStrc.nType, type & 0xff)
  m.set(node, D2EventStrc.dwFrame, f >>> 0)
  m.set(node, D2EventStrc.dwArg18, arg18 >>> 0)
  m.set(node, D2EventStrc.pfnHandler, handler >>> 0)

  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[m.get(node, D2EventStrc.dwUnitType)]
  if (partition === undefined || partition < 0) {
    throw new Error('EVENT_SetEventFull113c: unit type without a partition')
  }
  const slot = partition * 64 + (f & 63)
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const oldHead = m.get(pTimer, D2TimerStrc.pSlotHead, slot)
  m.set(node, D2EventStrc.pWheelNewer, 0)
  m.set(node, D2EventStrc.pWheelOlder, oldHead)
  if (oldHead !== 0) m.set(oldHead, D2EventStrc.pWheelNewer, node)
  m.set(pTimer, D2TimerStrc.pSlotHead, node, slot)
  if (m.get(pTimer, D2TimerStrc.pSlotTail, slot) === 0) {
    m.set(pTimer, D2TimerStrc.pSlotTail, node, slot)
  }
  return node
}

/** `@va D2Game:0x6FCAE880` (`EVENT_RemoveUnitEvents`). */
export function EVENT_RemoveUnitEvents113c(m: Memory113c, pGame: number, pUnit: number): void {
  if (pGame === 0 || pUnit === 0) return
  let cur = m.get(pUnit, D2UnitStrc.pEventFirst)
  while (cur !== 0) {
    const next = m.get(cur, D2EventStrc.pUnitNext)
    // Detach unit pointer even if `cur` is currently firing (`fFlags & 0x01`) per `0x6FCAE8A1: mov [eax+8], 0`.
    EVENT_FreeNode113c(m, pGame, cur)
    m.set(cur, D2EventStrc.pUnit, 0)
    cur = next
  }
  m.set(pUnit, D2UnitStrc.pEventFirst, 0)
}

/**
 * `@va D2Game:0x6FCAE8C0` (`EVENT_DeleteEventByType`, `ecx = pGame`, `eax = pUnit`, `ebx = type`, `[esp+4] = pfnHandler`).
 * Frees every node on `pUnit` where `nType == (type & 0xff)` AND `pfnHandler (+0x2C) == (handler >>> 0)`.
 */
export function EVENT_DeleteEventByType113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  handler = 0,
): void {
  if (pGame === 0 || pUnit === 0) return
  const expectedType = type & 0xff
  const expectedHandler = handler >>> 0
  let cur = m.get(pUnit, D2UnitStrc.pEventFirst)
  while (cur !== 0) {
    const next = m.get(cur, D2EventStrc.pUnitNext)
    if (
      m.get(cur, D2EventStrc.nType) === expectedType &&
      m.get(cur, D2EventStrc.pfnHandler) === expectedHandler
    ) {
      EVENT_FreeNode113c(m, pGame, cur)
    }
    cur = next
  }
}

/**
 * `@va D2Game:0x6FCAE900` (`EVENT_DeleteEventByArg14`, `ecx = pGame`, `eax = pUnit`, `[esp+4] = evType`, `ebx = arg14`).
 * Frees every node on `pUnit` where `nType == (evType & 0xff)` and (`arg14 == 0` OR `dwArg14 (+0x14) == (arg14 >>> 0)`).
 */
export function EVENT_DeleteEventByArg14_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
  arg14 = 0,
): void {
  if (pGame === 0 || pUnit === 0) return
  const expectedType = evType & 0xff
  const expectedArg14 = arg14 >>> 0
  let cur = m.get(pUnit, D2UnitStrc.pEventFirst)
  while (cur !== 0) {
    const next = m.get(cur, D2EventStrc.pUnitNext)
    if (
      m.get(cur, D2EventStrc.nType) === expectedType &&
      (expectedArg14 === 0 || m.get(cur, D2EventStrc.dwArg14) === expectedArg14)
    ) {
      EVENT_FreeNode113c(m, pGame, cur)
    }
    cur = next
  }
}

/** `@va D2Game:0x6FCAE490` (`EVENT_GetNextEventFrame`, `eax = pUnit`, `esi = type`). */
export function EVENT_GetNextEventFrame113c(m: Memory113c, pUnit: number, type: number): number {
  if (pUnit === 0) return 0
  let best = 0
  for (let cur = m.get(pUnit, D2UnitStrc.pEventFirst); cur !== 0; cur = m.get(cur, D2EventStrc.pUnitNext)) {
    if (m.get(cur, D2EventStrc.nType) !== (type & 0xff)) continue
    const fr = m.get(cur, D2EventStrc.dwFrame) | 0
    if (fr > 0 && (best === 0 || fr < best)) {
      best = fr
    }
  }
  return best >>> 0
}

/**
 * `@va D2Game:0x6FCAF070` (`EVENT_UpdateTimers`):
 * Walks partitions `[2, 0, 1, 3, 4]`; in each partition walks persistent events LIFO (`+0x1C` from head)
 * followed by current slot (`dwGameFrame & 63`) FIFO (`+0x1C` from tail where `dwFrame == dwGameFrame`).
 */
export function EVENT_UpdateTimers113c(
  m: Memory113c,
  pGame: number,
  dispatch: EventDispatchCallback113c,
): number {
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  if (pTimer === 0) return 0
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const slotMod = frame & 63
  m.set(pTimer, D2TimerStrc.nCurrentSlot, slotMod)

  let firedCount = 0

  for (const part of EVENT_UPDATE_PARTITION_ORDER_113C) {
    // 1. Persistent list (`T + 0xA04 + part * 4`), LIFO (head -> pWheelNewer)
    let node = m.get(pTimer, D2TimerStrc.pPersistentHead, part)
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const fn = m.get(node, D2EventStrc.pfnHandler)
      firedCount++
      dispatch(m, pGame, pUnit, evType, arg14, arg18, fn, node)

      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
        EVENT_FreeNode113c(m, pGame, node)
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }

    // 2. Timed wheel slot (`T + 0x004 + (part * 64 + slotMod) * 4`), FIFO (tail -> pWheelNewer)
    const slot = part * 64 + slotMod
    node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        const pUnit = m.get(node, D2EventStrc.pUnit)
        const evType = m.get(node, D2EventStrc.nType)
        const arg14 = m.get(node, D2EventStrc.dwArg14)
        const arg18 = m.get(node, D2EventStrc.dwArg18)
        const fn = m.get(node, D2EventStrc.pfnHandler)
        firedCount++
        dispatch(m, pGame, pUnit, evType, arg14, arg18, fn, node)

        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        // Slot event is always freed after firing (`0x6FCAEC32: call 0x6FCAE6F0`) unless already detached
        EVENT_FreeNode113c(m, pGame, node)
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }
    m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  }

  return firedCount
}
