/**
 * Diablo II v1.13c `D2GameStrc` initialization, game PRNG seed, and `SUNIT` unit hash tables.
 *
 * Binary evidence (`D2Game.dll`, image base `0x6FC20000`, `kb/stats/d2common-statlist-struct-113c.md` §2):
 * - `GAME_InitSeed` (`0x6FC4A900`): initializes `D2GameStrc` PRNG seed (`dwInitSeed` `+0xCC`, `seedLo` `+0xD0`,
 *   `seedHi` `+0xD4` = `0x0000029A` = `666` default carry via `SEED_InitSeed`); `D2GameStrc` is `0x1DF4` bytes
 *   (`D2Client 0x6FAB24D9` `add eax, 0x1DF4`; highest field `+0x1DF0` at `D2Game 0x6FC4C751` & `0x6FD0AA86`).
 * - `SUNIT_GetNewUnitId` (`0x6FCFF9C0`, `edx = pGame`, `ecx = dwUnitType`):
 *   increments `pGame->dwLastUnitId[dwUnitType]` (`+0x90 + type*4`); wraps `-1` (`0xFFFFFFFF`) to `1`.
 * - `0x6FD1B014` server unit hash offset table:
 *   - `0` (player):  `+0x1120` (128 buckets, `dwUnitId & 0x7F`)
 *   - `1` (monster): `+0x1320` (128 buckets, `dwUnitId & 0x7F`)
 *   - `2` (object):  `+0x1520` (128 buckets, `dwUnitId & 0x7F`)
 *   - `3` (missile): `+0x1920` (128 buckets, `dwUnitId & 0x7F`)  <-- swapped with item in D2Game!
 *   - `4` (item):    `+0x1720` (128 buckets, `dwUnitId & 0x7F`)  <-- swapped with missile in D2Game!
 *   - `5` (tile):    `+0x1B20` (1 single list head, NOT bucketed by `& 0x7F`!)
 * - `SUNIT_InsertServerUnit` (`0x6FD00310`): inserts along `pUnit + 0xE4` (`pGameHashNext`) in
 *   strictly descending `dwUnitId` order (`cmp [eax+0x0C], edi; jbe insert`).
 * - `SUNIT_GetServerUnit` (`0x6FD003A0`) / `SUNIT_RemoveServerUnit` (`0x6FD002A0`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2GameStrc, D2GameStrc_SIZE, D2UnitStrc } from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { EVENT_InitTimerQueue113c } from './timer-wheel.ts'

/** Full `D2GameStrc` allocation size (`0x1DF4` bytes). */
const D2GAME_ALLOC_SIZE_113C = 0x1df4

/** `D2Game 0x6FD1B014[unitType]` byte offset from `pGame`. */
export const SUNIT_HASH_OFFSET_BY_TYPE_113C: readonly number[] = [
  0x1120, // 0: UNIT_PLAYER
  0x1320, // 1: UNIT_MONSTER
  0x1520, // 2: UNIT_OBJECT
  0x1920, // 3: UNIT_MISSILE
  0x1720, // 4: UNIT_ITEM
  0x1b20, // 5: UNIT_TILE (single list head)
]

export interface CreateGameOptions113c {
  readonly initSeed?: number
  readonly seedHi?: number
  readonly difficulty?: number
  readonly expansion?: boolean
  readonly initTimerQueue?: boolean
}

/**
 * `@va D2Game:0x6FC4A900` (`GAME_InitSeed`, `esi = pGame + 0xCC`):
 * Initializes `pGame->dwInitSeed (+0xCC)`, `pGame->seedLo (+0xD0) = initSeed`,
 * and `pGame->seedHi (+0xD4) = 0x29A` (`666`).
 */
export function GAME_InitSeed113c(
  m: Memory113c,
  pGame: number,
  initSeed = 1,
  seedHi = 0x29a,
): void {
  const lo = initSeed >>> 0
  m.set(pGame, D2GameStrc.dwInitSeed, lo)
  m.set(pGame, D2GameStrc.seedLo, lo)
  m.set(pGame, D2GameStrc.seedHi, seedHi >>> 0)
}

/** Allocate and initialize a `D2GameStrc` (`0x1DF4` bytes) and its `0x6FC4A900` PRNG seed + timer wheel. */
export function GAME_AllocGameStrc113c(m: Memory113c, opts: CreateGameOptions113c = {}): number {
  const allocSize = D2GameStrc_SIZE >= D2GAME_ALLOC_SIZE_113C ? D2GameStrc_SIZE : D2GAME_ALLOC_SIZE_113C
  const pGame = m.alloc(allocSize)
  const seedLo = (opts.initSeed !== undefined ? opts.initSeed : 1) >>> 0
  const seedHi = (opts.seedHi !== undefined ? opts.seedHi : 666) >>> 0
  const difficulty = opts.difficulty !== undefined ? opts.difficulty : 0
  const expansion = opts.expansion !== undefined ? opts.expansion : true
  m.set(pGame, D2GameStrc.nDifficulty, difficulty & 0xff)
  m.setU8(pGame + 0x6a, expansion ? 1 : 0)
  m.set(pGame, D2GameStrc.bExpansion, expansion ? 1 : 0)
  GAME_InitSeed113c(m, pGame, seedLo, seedHi)
  if (opts.initTimerQueue !== false) {
    EVENT_InitTimerQueue113c(m, pGame)
  }
  return pGame
}

export const GAME_Create113c = GAME_AllocGameStrc113c

/** Advance `pGame`'s embedded `D2SeedStrc` (`+0xD0 / +0xD4`) by one LCG step (`SEED_Next`). */
export function GAME_SeedNext113c(m: Memory113c, pGame: number): number {
  const s: D2SeedStrc = {
    lo: m.get(pGame, D2GameStrc.seedLo),
    hi: m.get(pGame, D2GameStrc.seedHi),
  }
  const ret = seedNext(s)
  m.set(pGame, D2GameStrc.seedLo, s.lo)
  m.set(pGame, D2GameStrc.seedHi, s.hi)
  return ret
}

/** Roll `[0, nMax)` on `pGame`'s embedded `D2SeedStrc` (`+0xD0 / +0xD4`). */
export function GAME_SeedRoll113c(m: Memory113c, pGame: number, nMax: number): number {
  const s: D2SeedStrc = {
    lo: m.get(pGame, D2GameStrc.seedLo),
    hi: m.get(pGame, D2GameStrc.seedHi),
  }
  const ret = seedRoll(s, nMax)
  m.set(pGame, D2GameStrc.seedLo, s.lo)
  m.set(pGame, D2GameStrc.seedHi, s.hi)
  return ret
}

/** `@va D2Game:0x6FCFF9C0` (`SUNIT_GetNewUnitId`, `edx = pGame`, `ecx = dwUnitType`). */
export function SUNIT_GetNewUnitId113c(m: Memory113c, pGame: number, unitType: number): number {
  if ((unitType >>> 0) >= 6) return 0xffffffff
  let next = (m.get(pGame, D2GameStrc.dwLastUnitId, unitType) + 1) >>> 0
  if (next === 0xffffffff) {
    next = 1
  }
  m.set(pGame, D2GameStrc.dwLastUnitId, next, unitType)
  return next
}

function hashHeadAddr(pGame: number, unitType: number, unitId: number): number {
  const baseOff = SUNIT_HASH_OFFSET_BY_TYPE_113C[unitType]
  if (baseOff === undefined) return 0
  if (unitType === 5) return (pGame + baseOff) >>> 0
  return (pGame + baseOff + ((unitId & 0x7f) << 2)) >>> 0
}

/**
 * `@va D2Game:0x6FD00310` (`SUNIT_InsertServerUnit`, `edx = pGame`, `esi = pUnit`).
 * Keeps bucket chain sorted in descending `dwUnitId` (`cmp [eax + 0x0C], edi; jbe`).
 */
export function SUNIT_InsertServerUnit113c(m: Memory113c, pGame: number, pUnit: number): void {
  if (pGame === 0 || pUnit === 0) return
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if ((unitType >>> 0) >= 6) return
  const unitId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
  const headAddr = hashHeadAddr(pGame, unitType, unitId)
  if (headAddr === 0) return

  let prev = 0
  let cur = m.u32(headAddr)
  while (cur !== 0 && (m.get(cur, D2UnitStrc.dwUnitId) >>> 0) > unitId) {
    prev = cur
    cur = m.get(cur, D2UnitStrc.pGameHashNext)
  }
  m.set(pUnit, D2UnitStrc.pGameHashNext, cur)
  if (prev === 0) {
    m.setU32(headAddr, pUnit)
  } else {
    m.set(prev, D2UnitStrc.pGameHashNext, pUnit)
  }
}

/** `@va D2Game:0x6FD003A0` (`SUNIT_GetServerUnit`, `ecx = pGame`, `eax = dwUnitType`, `edx = dwUnitId`). */
export function SUNIT_GetServerUnit113c(
  m: Memory113c,
  pGame: number,
  unitType: number,
  unitId: number,
): number {
  if (pGame === 0 || (unitType >>> 0) >= 6) return 0
  const targetId = unitId >>> 0
  const headAddr = hashHeadAddr(pGame, unitType, targetId)
  if (headAddr === 0) return 0

  for (let cur = m.u32(headAddr); cur !== 0; cur = m.get(cur, D2UnitStrc.pGameHashNext)) {
    const id = m.get(cur, D2UnitStrc.dwUnitId) >>> 0
    if (id === targetId) return cur
    if (id < targetId) return 0 // bucket is sorted descending!
  }
  return 0
}

/**
 * `@va D2Game:0x6FD002A0` (`SUNIT_RemoveServerUnit`, `edx = pGame`, `esi = pUnit`).
 * Unlinks `pUnit` from its hash bucket chain (`0x6FD002E7..0x6FD00304`), leaving `pUnit + 0xE4`
 * (`pGameHashNext`) untouched.
 */
export function SUNIT_RemoveServerUnit113c(m: Memory113c, pGame: number, pUnit: number): void {
  if (pGame === 0 || pUnit === 0) return
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if ((unitType >>> 0) >= 6) return
  const unitId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
  const headAddr = hashHeadAddr(pGame, unitType, unitId)
  if (headAddr === 0) return

  let prev = 0
  let cur = m.u32(headAddr)
  while (cur !== 0 && cur !== pUnit) {
    prev = cur
    cur = m.get(cur, D2UnitStrc.pGameHashNext)
  }
  if (cur === pUnit) {
    const next = m.get(pUnit, D2UnitStrc.pGameHashNext)
    if (prev === 0) m.setU32(headAddr, next)
    else m.set(prev, D2UnitStrc.pGameHashNext, next)
  }
}
