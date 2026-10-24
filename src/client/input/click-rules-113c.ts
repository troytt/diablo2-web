/**
 * 1.13c D2Client click-processing rules for the input layer (pure functions, no I/O).
 *
 * Ground truth: static disassembly of D2Client.dll 1.13c (ImageBase 0x6FAB0000), see the RE report
 * `/tmp/d2client-hold-re/REPORT.md` (§1.4, §2.5) and the per-function notes below. Skills.txt data
 * comes from the baked `generated/input-tables-113c.ts` (Zero-Runtime-MPQ); every accessor fails
 * fast on an unknown skill id instead of defaulting.
 */

import {
  SKILL_CLT_PRG_FUNC1_113C,
  SKILL_FLAG_INTERRUPT_113C,
  SKILL_FLAG_PROGRESSIVE_113C,
  SKILL_FLAG_TARGET_ALLY_113C,
  SKILL_FLAG_TARGET_CORPSE_113C,
  SKILL_FLAG_TARGET_ITEM_113C,
  SKILL_FLAG_TARGET_PET_113C,
  SKILL_FLAG_WARP_113C,
  SKILL_INPUT_FLAGS_113C,
  SKILL_RANGE_113C,
  type SkillRange113c,
} from './generated/input-tables-113c.ts'
import type { UnitTypeName } from '../../netproto/index.ts'
import { D2Common_10399_AtSubtiles } from '../../common/path/step.ts'
import { MONSTATSFLAGINDEX_INTERACT, getMonsterPathRecord } from '../../common/path/units.ts'

// ─── Skills.txt accessors ──────────────────────────────────────────────────────

function requireSkillId113c(skillId: number, where: string): number {
  if (!Number.isInteger(skillId) || skillId < 0 || skillId >= SKILL_INPUT_FLAGS_113C.length) {
    throw new RangeError(
      `${where}: skill id ${String(skillId)} is not a 1.13c Skills.txt row (0..${String(SKILL_INPUT_FLAGS_113C.length - 1)})`,
    )
  }
  return skillId
}

function skillFlagWord113c(skillId: number, where: string): number {
  return SKILL_INPUT_FLAGS_113C[requireSkillId113c(skillId, where)]!
}

/** Skills.txt `interrupt` — busy gate 1.13c D2Client 0x6fad9f30 (`byte+7 & 0x80`). */
export function skillHasInterrupt113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasInterrupt113c') & SKILL_FLAG_INTERRUPT_113C) !== 0
}

/** Skills.txt `TargetItem` — ProcessClick 1.13c D2Client 0x6facb7f0 (`byte+7 & 0x08`). */
export function skillHasTargetItem113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasTargetItem113c') & SKILL_FLAG_TARGET_ITEM_113C) !== 0
}

/** Skills.txt `TargetCorpse` — ProcessClick dead-monster routing / 0x6fadaea0 (`byte+7 & 0x01`). */
export function skillHasTargetCorpse113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasTargetCorpse113c') & SKILL_FLAG_TARGET_CORPSE_113C) !== 0
}

/** Skills.txt `TargetPet` — ProcessClick attackable-unit path 1.13c D2Client 0x6facb9af. */
export function skillHasTargetPet113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasTargetPet113c') & SKILL_FLAG_TARGET_PET_113C) !== 0
}

/** Skills.txt `TargetAlly` — ProcessClick attackable-unit path 1.13c D2Client 0x6facb9af. */
export function skillHasTargetAlly113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasTargetAlly113c') & SKILL_FLAG_TARGET_ALLY_113C) !== 0
}

/**
 * Skills.txt `warp` — S2C 0x15 reassign 1.13c D2Client 0x6fb57e20 zeroes the weather re-select flag
 * at 0x6fb57efe when the player's used skill has it (`byte+8 & 0x40`): Teleport and Dragon Flight.
 */
export function skillHasWarp113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillHasWarp113c') & SKILL_FLAG_WARP_113C) !== 0
}

/** Skills.txt `range` (raw enum read by D2Common #10002, called from ProcessClick 0x6facb7f0). */
export function skillRange113c(skillId: number): SkillRange113c {
  return SKILL_RANGE_113C[requireSkillId113c(skillId, 'skillRange113c')]!
}

/**
 * Whether `skillId` is a Skills.txt row: the S2C 0xA3 handler's checks `skill < 0` (0x6fb5f012) and
 * `skill >= rows` (0x6fb5f01d), which return without an error for packet data.
 */
export function isSkillsTxtRow113c(skillId: number): boolean {
  return Number.isInteger(skillId) && skillId >= 0 && skillId < SKILL_INPUT_FLAGS_113C.length
}

/** Skills.txt `progressive` — S2C 0xA3 handler 1.13c D2Client 0x6fb5f03e (`byte+4 & 0x04`) → 0x6fb52950. */
export function skillIsProgressive113c(skillId: number): boolean {
  return (skillFlagWord113c(skillId, 'skillIsProgressive113c') & SKILL_FLAG_PROGRESSIVE_113C) !== 0
}

/**
 * Skills.txt `cltprgfunc1` (record +0xf6, blank = 0): the client function 0x6fb51b10 dispatches
 * through the table 0x6fb8ea48 for S2C 0xA3. Only Thunder Storm (57) carries fn #84 (0x6fb24350).
 */
export function skillCltPrgFunc1Of113c(skillId: number): number {
  return SKILL_CLT_PRG_FUNC1_113C[requireSkillId113c(skillId, 'skillCltPrgFunc1Of113c')]!
}

function collectSkillIds113c(predicate: (flags: number) => boolean): ReadonlySet<number> {
  const ids = new Set<number>()
  SKILL_INPUT_FLAGS_113C.forEach((flags, id) => {
    if (predicate(flags)) ids.add(id)
  })
  return ids
}

/** Every Skills.txt row with `TargetCorpse` = 1. */
export const TARGET_CORPSE_SKILL_IDS_113C: ReadonlySet<number> = collectSkillIds113c(
  flags => (flags & SKILL_FLAG_TARGET_CORPSE_113C) !== 0,
)

/** Every Skills.txt row with `TargetPet` = 1 or `TargetAlly` = 1. */
export const TARGET_PET_OR_ALLY_SKILL_IDS_113C: ReadonlySet<number> = collectSkillIds113c(
  flags => (flags & (SKILL_FLAG_TARGET_PET_113C | SKILL_FLAG_TARGET_ALLY_113C)) !== 0,
)

// ─── ClickGate 0x6fac85e0 ─────────────────────────────────────────────────────

/** ClickInfo flag phase: 0x4 down, 0x8 hold, 0x10 up (1.13c D2Client ClickInfo+0, REPORT §1.3). */
export type ClickPhase113c = 'down' | 'hold' | 'up'

/** Press kind global 0x6fbd34c0: 0 = none, 1 = pressed without target, 2 = pressed on a target. */
export type PressKind113c = 0 | 1 | 2

export interface ClickGateInput113c {
  readonly phase: ClickPhase113c
  /** Current value of 0x6fbd34c0. */
  readonly pressKind: PressKind113c
  /** ClickInfo+8 target (its unit type), `null` when the click has no target. */
  readonly targetType: UnitTypeName | null
  /** ClickInfo+4 player's mode (`[player+0x10]`), `null` when there is no local player unit. */
  readonly selfMode: number | null
}

export interface ClickGateResult113c {
  readonly pass: boolean
  readonly pressKind: PressKind113c
}

/**
 * 1.13c D2Client 0x6fac85e0 ClickGate (called by all six button handlers):
 * - up (0x10): `[0x6fbd34c0] = 0`, reject (0x6fac85e6) — button-up never acts.
 * - down (0x4): `[0x6fbd34c0] = target ? 2 : 1`, pass (0x6fac85f7..0x6fac860c).
 * - hold (0x8): reject when `[0x6fbd34c0] == 0` (0x6fac8611); with a target only unit types
 *   0 player / 1 monster / 5 warp pass (0x6fac8621..0x6fac862f) and not while the player is in
 *   mode 2 WL / 3 RN / 6 TW (0x6fac8638..0x6fac8648).
 */
export function clickGate113c(input: ClickGateInput113c): ClickGateResult113c {
  if (input.phase === 'up') return { pass: false, pressKind: 0 }
  if (input.phase === 'down') return { pass: true, pressKind: input.targetType !== null ? 2 : 1 }
  if (input.pressKind === 0) return { pass: false, pressKind: 0 }
  if (input.targetType !== null) {
    if (input.targetType !== 'player' && input.targetType !== 'monster' && input.targetType !== 'tile') {
      return { pass: false, pressKind: input.pressKind }
    }
    if (input.selfMode === 2 || input.selfMode === 3 || input.selfMode === 6) {
      return { pass: false, pressKind: input.pressKind }
    }
  }
  return { pass: true, pressKind: input.pressKind }
}

// ─── Busy gate 0x6fad9f30 ─────────────────────────────────────────────────────

export interface BusyGateInput113c {
  /** Local player's used skill (`#10511` = pSkills+0x10), `null` when no skill is in use. */
  readonly usedSkillId: number | null
  /** Local player's mode (`[player+0x10]`). */
  readonly selfMode: number
}

/**
 * 1.13c D2Client 0x6fad9f30 busy gate (first call of every send path: SendSkillPacket 0x6faca060
 * branches and the predict-and-send helper 0x6fada7c0): pass when no skill is in use, or the used
 * skill has Skills.txt `interrupt` (`byte+7 & 0x80`), or the player is in mode 1 NU / 5 TN.
 */
export function busyGate113c(input: BusyGateInput113c): boolean {
  if (input.usedSkillId === null) return true
  if (skillHasInterrupt113c(input.usedSkillId)) return true
  return input.selfMode === 1 || input.selfMode === 5
}

// ─── NPC interaction range 0x6facafea / 0x6fac9ef0 ───────────────────────────

/** `UNITS_GetUnitSizeX` (D2Common 0x6fd80f80) of a player unit: the unit-type-0 case returns the constant 2. */
export const PLAYER_SIZE_X_113C = 2

/**
 * ProcessClick monster case 1.13c D2Client 0x6facafea..0x6facb0fa: the click interacts at once when
 * `#10407(target, player)` (thunk 0x6fabcc70 @0x6facb0f1, signed `jg` @0x6facb0fa) is at most the
 * threshold, else it walks (0x6facaea8 → 0x6fada7c0) and queues a pending 0x13 interaction
 * (0x6fab2d50: `+0x150 = 1`, `+0x154 = 0x13`, `+0x158/+0x15c` = target). The threshold is 2 when the
 * MonStats flags byte `+0x0d` has `gdwBitMasks[1]` set (`interact`, dwMonStatsFlags bit 9) @0x6facb00f.
 */
export const NPC_CLICK_INTERACT_DISTANCE_113C = 2

/** The ProcessClick threshold for monsters without MonStats `interact` (or no MonStats row): 5 @0x6facb01b. */
export const MONSTER_CLICK_INTERACT_DISTANCE_113C = 5

/**
 * Deferred interaction 1.13c D2Client 0x6fac9ef0 (runs the pending 0x13 once the walk ends): interacts
 * when `#10407(target, player) <= 2` (`cmp eax,2 ; ja` @0x6fac9f07), else walks again.
 */
export const NPC_ARRIVAL_INTERACT_DISTANCE_113C = 2

/** `click` = ProcessClick 0x6facafea, `arrival` = deferred interaction 0x6fac9ef0. */
export type NpcInteractPhase113c = 'click' | 'arrival'

/**
 * MonStats `interact` (`dwMonStatsFlags` bit 9, the bit tested @0x6facb00a) of monster class `classId`.
 * Fails fast (`getMonsterPathRecord` throws) on a class id outside MonStats.txt instead of taking the
 * binary's defensive no-row branch.
 */
export function monsterHasInteractFlag113c(classId: number): boolean {
  return (getMonsterPathRecord(classId).monStatsFlags & (1 << MONSTATSFLAGINDEX_INTERACT)) !== 0
}

/** The `#10407` threshold of `phase` (see the constants above). */
export function npcInteractDistance113c(phase: NpcInteractPhase113c, interact: boolean): number {
  if (phase === 'arrival') return NPC_ARRIVAL_INTERACT_DISTANCE_113C
  return interact ? NPC_CLICK_INTERACT_DISTANCE_113C : MONSTER_CLICK_INTERACT_DISTANCE_113C
}

export interface NpcInteractRangeInput113c {
  readonly phase: NpcInteractPhase113c
  /** MonStats `interact` of the NPC ({@link monsterHasInteractFlag113c}). */
  readonly interact: boolean
  /** Player integer sub-tile position (`pDynamicPath->wPosX/wPosY`). */
  readonly playerX: number
  readonly playerY: number
  /** NPC integer sub-tile position. */
  readonly npcX: number
  readonly npcY: number
  /** NPC `UNITS_GetUnitSizeX` (MonStats2 `SizeX`). */
  readonly npcSizeX: number
}

/**
 * Range test of the D2Client NPC interaction: `#10407(npc, player) <= npcInteractDistance113c(...)`,
 * using the 0x6FDDABC0 table distance ({@link D2Common_10399_AtSubtiles}).
 *
 * D2Client tests this range only when the click is handled and when the pending interaction runs.
 * Once the NPC menu is open, the per-tick guard 0x6faf83b0 checks only that the player and the NPC are
 * still alive. It does not re-check the distance (#890).
 *
 * Not modelled: the deferred path's extra collision test `#10324(target, player, 0x804) == 0`
 * (thunk 0x6fabcf0a @0x6fac9f1d). The web client's collision map also contains object footprints
 * that could block an NPC that stands next to a stall. The D2GS server stays authoritative for the
 * interaction itself.
 */
export function isNpcInInteractRange113c(input: NpcInteractRangeInput113c): boolean {
  const dist = D2Common_10399_AtSubtiles(
    input.npcX,
    input.npcY,
    input.npcSizeX,
    input.playerX,
    input.playerY,
    PLAYER_SIZE_X_113C,
  )
  return dist <= npcInteractDistance113c(input.phase, input.interact)
}

// ─── Warp (UNIT_TILE = 5) interaction range & cooldown 0x6facaed0 / 0x6fadb090 ───

/**
 * `UNITS_GetUnitSizeX` (D2Common `0x6fd80f80`) of a warp/tile unit (`UNIT_TILE = 5`):
 * `switch (pUnit->dwType)` default branch returns `0` (`0x6fd80f9b`).
 */
export const WARP_SIZE_X_113C = 0

/**
 * 1.13c D2Client `0x6facaed0..0x6facafe7` (ProcessClick `UNIT_TILE = 5` branch) and
 * D2Game `0x6fcf02bc..0x6fcf0322` (`C2S 0x13` case 5):
 * Calls `D2Common #10407(pWarp, pPlayer)` (`0x6facaee7` / `0x6fcf02dc`) and compares
 * `cmp eax, 4 ; jg` (`0x6facaeec` / `0x6fcf02e1`).
 * - When `#10407(warp, player) <= 4`: immediately sends `C2S 0x13` (`InteractUnit(5, warpId)`) (`0x6facafbd..0x6facafd0`).
 * - When `#10407(warp, player) > 4`: walks/runs toward the warp (`0x6facaf25 -> 0x6facaea8 -> 0x6fada7c0`,
 *   sending `C2S 0x02`/`0x04` `MoveToUnit`) and stores a deferred `0x13` interaction in `pPlayerData`
 *   (`0x6facaf0c -> 0x6fab2d50`: `+0x150 = 1`, `+0x154 = 0x13`, `+0x158 = 5`, `+0x15c = warpId`),
 *   which fires upon arrival in `0x6fadb090` / `0x6facc41b..0x6facc4de`.
 */
export const WARP_INTERACT_DISTANCE_113C = 4

/**
 * 1.13c D2Client `[0x6fbc9828]` warp click cooldown in milliseconds (`0x1f4 = 500`):
 * Checked at `0x6facaed0..0x6facaedc` (`GetTickCount() < [0x6fbc9828]` -> ignore click) and armed
 * to `GetTickCount() + 500` at `0x6facaf16..0x6facaf1c` (`dist > 4`), `0x6facafd8..0x6facafde` (`dist <= 4`),
 * and `0x6fadb11f..0x6fadb129` (deferred arrival in `0x6fadb090`).
 */
export const WARP_CLICK_COOLDOWN_MS_113C = 500

/**
 * Range test of the 1.13c D2Client & D2Game warp (`UNIT_TILE = 5`) interaction:
 * `D2Common #10407(warp, player) <= 4` (`D2Common_10399_AtSubtiles(warpX, warpY, 0, playerX, playerY, 2) <= 4`).
 */
export function isWarpInInteractRange113c(
  playerX: number,
  playerY: number,
  warpX: number,
  warpY: number,
): boolean {
  const dist = D2Common_10399_AtSubtiles(
    warpX,
    warpY,
    WARP_SIZE_X_113C,
    playerX,
    playerY,
    PLAYER_SIZE_X_113C,
  )
  return dist <= WARP_INTERACT_DISTANCE_113C
}


// ─── Walk handler 0x6fac86a0 ──────────────────────────────────────────────────

/**
 * 1.13c D2Client 0x6fb587b0: octagonal distance approximation
 * `(max(|dx|,|dy|) * 0x3d7 + min(|dx|,|dy|) * 0x197) >> 10` (unsigned shift).
 */
export function approxDistance113c(dx: number, dy: number): number {
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
    throw new RangeError(`approxDistance113c: non-integer delta (${String(dx)}, ${String(dy)})`)
  }
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const hi = ax >= ay ? ax : ay
  const lo = ax >= ay ? ay : ax
  return ((hi * 0x3d7 + lo * 0x197) >>> 0) >>> 10
}

/** Hold-walk repeat window in game frames: `cmp eax,0x7 ; jae` @0x6fac884c. */
export const HOLD_WALK_FRAME_WINDOW_113C = 7

export interface WalkAdjustInput113c {
  readonly phase: 'down' | 'hold'
  /** ClickInfo flag 0x40 (run key / always-run with stamina). */
  readonly run: boolean
  /** Player sub-tile position (`#10867`/`#10750` path getters), integers. */
  readonly playerX: number
  readonly playerY: number
  /** ClickInfo+0xC / +0x10 world sub-tile, integers. */
  readonly clickX: number
  readonly clickY: number
  /** `[player] == 0` (unit type player) — the hold throttle only applies to players. */
  readonly selfIsPlayer: boolean
  /** `[player+0x10]` mode. */
  readonly selfMode: number
  /** Game frame counter `[0x6fbc97f8]` (incremented once per game tick @0x6faf4b22). */
  readonly frame: number
  /** `[0x6fbd34c4]` frame of the last accepted walk click. */
  readonly lastWalkFrame: number
}

export type WalkAdjustResult113c =
  | { readonly accepted: false; readonly lastWalkFrame: number }
  | { readonly accepted: true; readonly x: number; readonly y: number; readonly lastWalkFrame: number }

/**
 * 1.13c D2Client 0x6fac86a0 walk-click adjust + hold throttle (called before every walk/run send):
 * - reject when `|dx| >= 0x100 || |dy| >= 0x100` (0x6fac873c / 0x6fac874f) or `dx == dy == 0`
 *   (0x6fac8762..0x6fac8772);
 * - `dist = max(1, approxDistance(dx, dy))` (0x6fac877b..0x6fac878e);
 * - minimum step `N`: down → run ? 5 : 3, hold → run ? 5 : 4 (0x6fac8796..0x6fac87ca);
 * - `dist < N` → `dx = trunc(dx * (N / dist))`, `dy = trunc(dy * (N / dist))` (x87 `fidiv`/`fmul`,
 *   `_ftol` 0x6fb7acc4); target = player + (dx, dy) (0x6fac880a..0x6fac881d);
 * - hold + player unit in mode 2/3/6 + `(frame - lastWalkFrame) as u32 < 7` → reject without
 *   touching `[0x6fbd34c4]` (0x6fac8820..0x6fac885a); otherwise `[0x6fbd34c4] = frame`, accept.
 *
 * `[I]` x87 precision control: MSVC's default 53-bit mantissa is assumed (= JS double arithmetic).
 */
export function walkAdjust113c(input: WalkAdjustInput113c): WalkAdjustResult113c {
  for (const [name, v] of [
    ['playerX', input.playerX],
    ['playerY', input.playerY],
    ['clickX', input.clickX],
    ['clickY', input.clickY],
    ['frame', input.frame],
    ['lastWalkFrame', input.lastWalkFrame],
  ] as const) {
    if (!Number.isInteger(v)) throw new RangeError(`walkAdjust113c: ${name} must be an integer, got ${String(v)}`)
  }
  let dx = input.clickX - input.playerX
  let dy = input.clickY - input.playerY
  if (Math.abs(dx) >= 0x100 || Math.abs(dy) >= 0x100) {
    return { accepted: false, lastWalkFrame: input.lastWalkFrame }
  }
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return { accepted: false, lastWalkFrame: input.lastWalkFrame }
  }
  const dist = Math.max(1, approxDistance113c(dx, dy))
  const minStep = input.phase === 'down' ? (input.run ? 5 : 3) : input.run ? 5 : 4
  if (dist < minStep) {
    const scale = minStep / dist
    dx = Math.trunc(dx * scale)
    dy = Math.trunc(dy * scale)
  }
  const x = input.playerX + dx
  const y = input.playerY + dy
  if (
    input.selfIsPlayer &&
    input.phase === 'hold' &&
    (input.selfMode === 2 || input.selfMode === 3 || input.selfMode === 6) &&
    ((input.frame - input.lastWalkFrame) >>> 0) < HOLD_WALK_FRAME_WINDOW_113C
  ) {
    return { accepted: false, lastWalkFrame: input.lastWalkFrame }
  }
  return { accepted: true, x, y, lastWalkFrame: input.frame }
}
