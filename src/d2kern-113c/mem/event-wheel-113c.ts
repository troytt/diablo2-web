/**
 * Route-2 pilot: 1.13c event wheel functions on isomorphic memory.
 * kb/engine/d2game-event-wheel-and-room-units-113c.md §1..§3.
 */
import type { Memory113c } from './sparse-memory.ts'
import { D2EventStrc, D2GameStrc, D2UnitStrc } from './layout.generated.ts'

/** `0x6FD1A3DC[unitType]`: wheel partition (player 0, monster 1, object 3, missile 2, item 4, tile -1, none 0). */
export const EVENT_PARTITION_BY_UNIT_TYPE_113C: readonly number[] = [0, 1, 3, 2, 4, -1, 0]

const TIMER_SLOT_TAIL = 0x004
const TIMER_SLOT_HEAD = 0x504
const TIMER_PERSISTENT_HEAD = 0xa04
const TIMER_POOL = 0xa1c
const POOL_CHUNK_FREE = 0x7080
const POOL_CHUNK_NEXT = 0x7084
const EVENT_NODE_SIZE = 0x30

export interface EventWheelHooks113c {
  /** `#10494(pUnit, 0x36)` for the monster type-2 branch of `EVENT_SetEvent` (`0x6FCAEAD4`). */
  readonly checkState: (pUnit: number, stateId: number) => boolean
  /** `0x6FD02240(pUnit, 0)`, called when that check succeeds. */
  readonly onMonsterAiEventWithState36: (pUnit: number) => void
}

/** Node pool allocation (`esi = timer`, canonical `@va` in `game/timer-wheel.ts`): first chunk with a free node, pop it, zero it. */
export function EVENT_AllocNode113c(m: Memory113c, timer: number): number {
  for (let chunk = m.u32(timer + TIMER_POOL); chunk !== 0; chunk = m.u32(chunk + POOL_CHUNK_NEXT)) {
    const node = m.u32(chunk + POOL_CHUNK_FREE)
    if (node === 0) continue
    m.setU32(chunk + POOL_CHUNK_FREE, m.u32(node + 0x1c))
    m.fill(node, EVENT_NODE_SIZE, 0)
    return node
  }
  throw new Error('EVENT_AllocNode113c: pool exhausted; chunk allocation not ported')
}

/** `EVENT_CreateNode` (`eax = pGame, ecx = pUnit`, canonical `@va` in `game/timer-wheel.ts`): allocate a node and link it at the head of `unit+0xDC`. */
export function EVENT_CreateNode113c(m: Memory113c, pGame: number, pUnit: number): number {
  const timer = m.get(pGame, D2GameStrc.pTimer)
  const node = EVENT_AllocNode113c(m, timer)
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

/** `EVENT_SetPersistentEvent` (canonical `@va` in `game/timer-wheel.ts`): frame -1, flag 0x04, handler from the caller, head insert per partition. */
export function EVENT_SetPersistentEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  handler: number,
  arg14: number,
  arg18: number,
): void {
  if (type >= 15) return
  const node = EVENT_CreateNode113c(m, pGame, pUnit)
  m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | 0x04)
  m.set(node, D2EventStrc.dwArg14, arg14)
  m.set(node, D2EventStrc.nType, type)
  m.set(node, D2EventStrc.dwFrame, 0xffffffff)
  m.set(node, D2EventStrc.dwArg18, arg18)
  m.set(node, D2EventStrc.pfnHandler, handler)
  const unitType = pUnit === 0 ? 6 : m.get(pUnit, D2UnitStrc.dwUnitType)
  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[unitType]
  if (partition === undefined) throw new Error(`EVENT_SetPersistentEvent113c: unit type ${unitType}`)
  const timer = m.get(pGame, D2GameStrc.pTimer)
  const headAddr = timer + TIMER_PERSISTENT_HEAD + partition * 4
  const oldHead = m.u32(headAddr)
  m.set(node, D2EventStrc.pWheelNewer, oldHead)
  m.set(node, D2EventStrc.pWheelOlder, 0)
  if (oldHead !== 0) m.set(oldHead, D2EventStrc.pWheelOlder, node)
  m.setU32(headAddr, node)
}

/**
 * `EVENT_SetEvent` (`ecx = pGame`, `edx = pUnit`, stack `type, frame, handler, arg14, arg18`; canonical `@va` in `game/timer-wheel.ts`).
 * A frame at or before the current one becomes `current + 1`.
 */
export function EVENT_SetEvent113c(
  m: Memory113c,
  hooks: EventWheelHooks113c,
  pGame: number,
  pUnit: number,
  type: number,
  frame: number,
  handler: number,
  arg14: number,
  arg18: number,
): void {
  if ((type | 0) >= 15) return
  if ((frame | 0) === -1) {
    // Persistent path is called with handler 0.
    EVENT_SetPersistentEvent113c(m, pGame, pUnit, type, 0, arg14, arg18)
    return
  }
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame)
  let f = frame | 0
  if (f <= (gameFrame | 0)) f = (gameFrame + 1) | 0
  if (pUnit !== 0 && m.get(pUnit, D2UnitStrc.dwUnitType) === 1 && type === 2 && hooks.checkState(pUnit, 0x36)) {
    hooks.onMonsterAiEventWithState36(pUnit)
  }
  const node = EVENT_CreateNode113c(m, pGame, pUnit)
  m.set(node, D2EventStrc.dwArg14, arg14)
  m.set(node, D2EventStrc.nType, type)
  m.set(node, D2EventStrc.dwFrame, f >>> 0)
  m.set(node, D2EventStrc.dwArg18, arg18)
  m.set(node, D2EventStrc.pfnHandler, handler)
  const partition = EVENT_PARTITION_BY_UNIT_TYPE_113C[m.get(node, D2EventStrc.dwUnitType)]
  if (partition === undefined || partition < 0) throw new Error('EVENT_SetEvent113c: unit type without a partition')
  const slot = partition * 64 + (f & 63)
  const timer = m.get(pGame, D2GameStrc.pTimer)
  const headAddr = timer + TIMER_SLOT_HEAD + slot * 4
  m.set(node, D2EventStrc.pWheelNewer, 0)
  const oldHead = m.u32(headAddr)
  m.set(node, D2EventStrc.pWheelOlder, oldHead)
  if (oldHead !== 0) m.set(oldHead, D2EventStrc.pWheelNewer, node)
  m.setU32(headAddr, node)
  const tailAddr = timer + TIMER_SLOT_TAIL + slot * 4
  if (m.u32(tailAddr) === 0) m.setU32(tailAddr, node)
}

/** Partition walk order of `EVENT_UpdateTimers` (canonical `@va` in `game/timer-wheel.ts`): missiles, players, monsters, objects, items. */
export const EVENT_UPDATE_PARTITION_ORDER_113C: readonly number[] = [2, 0, 1, 3, 4]

export interface WheelFire113c {
  readonly node: number
  readonly persistent: boolean
}

/**
 * The nodes one partition of `EVENT_UpdateTimers` fires, in order, from the current wheel state
 * (monster processor `0x6FCAEBC0`; kb event-wheel §3): first the persistent list from its head along
 * `+0x1C` (newest first), then the current slot from its tail along `+0x1C` (oldest first), slot nodes
 * only when `+0x04 == dwGameFrame`. Handlers that add or free nodes of these lists while the walk runs
 * are not modelled here (the original re-reads the saved next pointer at `timer+0xA18`).
 */
export function EVENT_PartitionFireOrder113c(m: Memory113c, pGame: number, partition: number): WheelFire113c[] {
  const timer = m.get(pGame, D2GameStrc.pTimer)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame)
  const out: WheelFire113c[] = []
  for (let n = m.u32(timer + TIMER_PERSISTENT_HEAD + partition * 4); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    out.push({ node: n, persistent: true })
  }
  for (let n = m.u32(timer + TIMER_SLOT_TAIL + (partition * 64 + (frame & 63)) * 4); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    if (m.get(n, D2EventStrc.dwFrame) === frame) out.push({ node: n, persistent: false })
  }
  return out
}
