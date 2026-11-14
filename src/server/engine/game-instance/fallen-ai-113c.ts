/**
 * DRLG oracle path: 1.13c `AiFallen` (MonAI 6, think `0x6FCA3130` = `[0x6FD2E788 + 6 * 16 + 8]`) and the
 * `pAiGeneral` group helpers it uses. Pseudocode, RNG table and open items:
 * kb/monsters/d2game-fallen-ai-113c.md.
 */
import { SEED_RollRandomNumber } from '../../../common/rng/d2-rng.ts'
import type { D2SeedStrc } from '../../../common/rng/d2-rng.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord } from './types.ts'
import { areaToAct, unitsDistanceToCoordinates113c } from './constants-and-helpers.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'

export type DrlgAiTarget113c =
  | { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord }
  | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord }
  | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit }

/** `MONSTER_StartMode` path type for a moving mode (`PATHTYPE_TOWARD_FINISH`, kb zombie §4). */
const MONSTER_MOVE_PATHTYPE_113C = 13
const MODE_NU = 1
const MODE_WL = 2
const MODE_S2 = 9

export interface FallenThinkCtx113c {
  readonly seed: D2SeedStrc
  readonly target: DrlgAiTarget113c | null
  readonly dist: number
  readonly inMelee: boolean
  readonly alwaysChase: boolean
  readonly aip: (n: 1 | 2 | 3 | 4) => number
  readonly aiInterval: number
}

/** `0x6FD122C0(pGame, pMonster, n)`: `MONSTER_StartMode(NU)` unless already NU, next AI event `+max(1, n)`. */
export function drlgAiStall113c(host: GameInstanceHost, monster: InternalMonsterRecord, frames: number): void {
  if (monster.mode !== MODE_NU) {
    monster.mode = MODE_NU
    host.areaPathWorld.stopMonsterMove113c(monster.areaId, monster.unitId, MODE_NU)
  }
  monster.runVelocityBonus = 0
  monster.nextAiFrame = host.currentFrame + Math.max(1, frames)
}

/**
 * `MONSTER_StartMode(A1/A2)` with the AI target (`0x6FD12220`): the action frame resolves the melee swing
 * (`stepPendingMonsterAttack` / `stepPendingAllyAttack`), the one-shot end returns to NU.
 */
export function startDrlgMonsterAttack113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  target: DrlgAiTarget113c,
  skillMode: 'A1' | 'A2',
): void {
  const mode = skillMode === 'A1' ? 4 : 5
  const minDmg = skillMode === 'A2' ? monster.attack2MinDmg : monster.minDmg
  const maxDmg = skillMode === 'A2' ? monster.attack2MaxDmg : monster.maxDmg
  const timing = host.monsterAttackTiming(monster, skillMode)
  monster.mode = mode
  monster.actionAnimEndFrame = host.currentFrame + timing.totalFrames
  const frame = host.currentFrame + timing.actionFrame
  if (target.kind === 'player') {
    monster.pendingAttack = { playerId: target.player.unitId, frame, mode, skillMode, minDmg, maxDmg }
  } else if (target.kind === 'merc') {
    monster.pendingAllyAttack = { targetKind: 'merc', targetId: target.merc.unitId, frame, mode, skillMode, minDmg, maxDmg }
  } else {
    monster.pendingAllyAttack = { targetKind: 'pet', targetId: target.pet.uid, frame, mode, skillMode, minDmg, maxDmg }
  }
}

/** `MONSTER_StartMode` for a one-shot mode without a hit (e.g. Fallen `S2` war cry, `0x6FCA33B4`). */
function startDrlgMonsterOneShot113c(host: GameInstanceHost, monster: InternalMonsterRecord, skillMode: 'S2'): void {
  const timing = host.monsterAttackTiming(monster, skillMode)
  monster.mode = MODE_S2
  monster.actionAnimEndFrame = host.currentFrame + timing.totalFrames
}

/**
 * `AI_ApproachTarget(pGame, pMonster, pTarget, WL, 0, 0, 1, nFlags)` (`0x6FD12540`) toward a unit target.
 * Returns the `MONSTER_StartMode` result. Failure flags: `4` frees the pending type-2 events (none on this
 * path), `1` sets `pAiGeneral+0x08 |= 0x40` (not modelled), `2` draws `lo % 100 < 70 ? wander(4) : stall(10)`.
 */
export function drlgApproachTarget113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  seed: D2SeedStrc,
  target: DrlgAiTarget113c,
  flags: number,
  aiInterval: number,
): boolean {
  const slowPct = host.monsterSlowPercent(monster)
  const velocityPct = 75 - slowPct
  const petTargetUnitId = target.kind === 'pet' ? host.petUnitIds.get(target.pet.uid) : undefined
  let pts: number
  if (target.kind === 'player') {
    pts = host.areaPathWorld.startMonsterMoveToTarget113c({
      areaId: monster.areaId,
      unitId: monster.unitId,
      hcIdx: monster.hcIdx,
      targetUnitType: 0,
      targetUnitId: target.player.unitId,
      pathType: MONSTER_MOVE_PATHTYPE_113C,
      stepNum: 1,
      velocityPct,
    })
  } else if (target.kind === 'merc' || (petTargetUnitId !== undefined && target.pet.oracleAi113c !== undefined)) {
    pts = host.areaPathWorld.startMonsterMoveToTarget113c({
      areaId: monster.areaId,
      unitId: monster.unitId,
      hcIdx: monster.hcIdx,
      targetUnitType: 1,
      targetUnitId: target.kind === 'merc' ? target.merc.unitId : petTargetUnitId!,
      pathType: MONSTER_MOVE_PATHTYPE_113C,
      stepNum: 1,
      velocityPct,
    })
  } else {
    throw new Error(`AiFallen approach: pet ${target.pet.uid} is not a ported path unit`)
  }
  if (pts > 0) {
    monster.mode = MODE_WL
    monster.runVelocityBonus = 0
    return true
  }
  handleApproachFailure113c(host, monster, seed, flags, aiInterval)
  return false
}

function handleApproachFailure113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  seed: D2SeedStrc,
  flags: number,
  aiInterval: number,
): void {
  monster.mode = MODE_NU
  monster.runVelocityBonus = 0
  if ((flags & 2) !== 0) {
    // 0x6FD12641..0x6FD12685
    if (rollLimitedSeed113c(seed, 100) < 70) {
      drlgIdleWander113c(host, monster, seed, 4, aiInterval)
    } else {
      drlgAiStall113c(host, monster, 10)
    }
    return
  }
  // No AI event is queued by a failed StartMode; the replica re-thinks after `aidel` (same model as the
  // zombie port).
  monster.nextAiFrame = host.currentFrame + aiInterval
}

/** `AI_IdleWander(pGame, pMonster, nRange)` (`0x6FD11B10`, kb zombie §3): 4 draws, then a WL approach. */
export function drlgIdleWander113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  seed: D2SeedStrc,
  range: number,
  aiInterval: number,
): void {
  const s1 = SEED_RollRandomNumber(seed)
  let dx: number
  let dy: number
  if ((s1 & 1) !== 0) {
    dy = rollLimitedSeed113c(seed, range)
    dx = range
  } else {
    dx = rollLimitedSeed113c(seed, range)
    dy = range
  }
  if ((SEED_RollRandomNumber(seed) & 1) !== 0) dx = -dx
  if ((SEED_RollRandomNumber(seed) & 1) !== 0) dy = -dy
  monster.runVelocityBonus = 0
  const pts = host.areaPathWorld.startMonsterMoveToPos113c({
    areaId: monster.areaId,
    unitId: monster.unitId,
    hcIdx: monster.hcIdx,
    targetX: Math.round(monster.x) + dx,
    targetY: Math.round(monster.y) + dy,
    pathType: MONSTER_MOVE_PATHTYPE_113C,
    stepNum: 1,
    velocityPct: 75 - host.monsterSlowPercent(monster),
  })
  if (pts > 0) {
    monster.mode = MODE_WL
  } else {
    monster.mode = MODE_NU
    monster.nextAiFrame = host.currentFrame + aiInterval
  }
}

/** `0x6FC40EC0`: pop the head of the `pAiGeneral` command stack. */
function popAiCommand113c(monster: InternalMonsterRecord): void {
  monster.aiCommands113c?.pop()
}

/** `0x6FC412F0` + `0x6FC41290`: push command `type` to every minion of the shouter's leader, then to itself. */
function broadcastGroupCommand113c(host: GameInstanceHost, shouter: InternalMonsterRecord, type: number): void {
  const leaderId = shouter.groupLeader113c
  const leader = leaderId !== undefined ? host.monsters.get(leaderId) : undefined
  if (leader !== undefined) {
    for (const id of leader.groupMinions113c ?? []) {
      const m = host.monsters.get(id)
      if (m === undefined) continue
      ;(m.aiCommands113c ??= []).push(type)
    }
  }
  ;(shouter.aiCommands113c ??= []).push(type)
}

/**
 * `0x6FD12D80(pFrom, pGame, pMonster, n = 12, bFlag = 1)`: walk `n` subtiles away from `pFrom` on each axis
 * (`sign(monster - from)`), `pAiControl+0x20 = min(n, 77)` new distance, then
 * `AI_ApproachTarget(NULL, WL, x, y, 1, bFlag ? 4 : 0)`. `AiFallen` sets `pAiControl+0x1C = 50` first.
 */
function fallenFleeFrom113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  from: DrlgAiTarget113c | null,
  aiInterval: number,
  seed: D2SeedStrc,
): boolean {
  if (from === null) return false
  const n = 12
  const mx = Math.floor(monster.x + 0.5)
  const my = Math.floor(monster.y + 0.5)
  const fx = Math.floor(from.x + 0.5)
  const fy = Math.floor(from.y + 0.5)
  const sx = fx > mx ? -1 : fx < mx ? 1 : 0
  const sy = fy > my ? -1 : fy < my ? 1 : 0
  const pts = host.areaPathWorld.startMonsterMoveToPos113c({
    areaId: monster.areaId,
    unitId: monster.unitId,
    hcIdx: monster.hcIdx,
    targetX: mx + n * sx,
    targetY: my + n * sy,
    pathType: MONSTER_MOVE_PATHTYPE_113C,
    stepNum: 1,
    velocityPct: 75 + 50 - host.monsterSlowPercent(monster),
    maxDist: n,
  })
  if (pts > 0) {
    monster.mode = MODE_WL
    monster.runVelocityBonus = 50
    return true
  }
  handleApproachFailure113c(host, monster, seed, 4, aiInterval)
  return false
}

/** `AiFallen` think (`0x6FCA3130`). */
export function stepFallenThink113c(host: GameInstanceHost, monster: InternalMonsterRecord, ctx: FallenThinkCtx113c): void {
  const { seed, target, dist, inMelee, aip, aiInterval } = ctx
  const populator = host.drlgRoomPopulator
  if (populator === null) throw new Error('AiFallen: DRLG populator required')
  const mx = Math.floor(monster.x + 0.5)
  const my = Math.floor(monster.y + 0.5)

  // 0x6FCA31A5..0x6FCA3285: a monster in DT (mode 0) from a near room's death ring within 15 -> flee.
  for (const id of populator.recentDeathIdsNear113c(areaToAct(monster.areaId), mx, my)) {
    const dying = host.monsters.get(id)
    if (dying === undefined || dying.mode !== 0) continue
    const d = unitsDistanceToCoordinates113c(Math.floor(dying.x + 0.5), Math.floor(dying.y + 0.5), mx, my)
    if (d >= 15) continue
    monster.fallenAfraid113c = true
    popAiCommand113c(monster)
    if (fallenFleeFrom113c(host, monster, target, aiInterval, seed)) {
      // 0x6FCA3320..0x6FCA334D: `lo % 20 < 1` -> unit sound event 0x11 (`0x6FCFFFD0`, no draw).
      rollLimitedSeed113c(seed, 20)
      return
    }
    break
  }

  // 0x6FCA328F: anything but NU stalls 10.
  if (monster.mode !== MODE_NU) {
    drlgAiStall113c(host, monster, 10)
    return
  }

  // 0x6FCA32A3..0x6FCA32CB + 0x6FCA34B2: a pending group command.
  const commands = monster.aiCommands113c
  if (commands !== undefined && commands.length > 0) {
    if (commands[commands.length - 1] !== 1) {
      popAiCommand113c(monster)
      drlgAiStall113c(host, monster, 10)
      return
    }
    if (target === null) throw new Error(`AiFallen ${monster.unitId}: command branch without a target`)
    if (inMelee) {
      if (rollLimitedSeed113c(seed, 100) < aip(3)) {
        startDrlgMonsterAttack113c(host, monster, target, rollLimitedSeed113c(seed, 100) < aip(4) ? 'A1' : 'A2')
      } else {
        drlgAiStall113c(host, monster, 5)
      }
      return
    }
    if (!drlgApproachTarget113c(host, monster, seed, target, 0, aiInterval)) popAiCommand113c(monster)
    return
  }

  if (target === null) throw new Error(`AiFallen ${monster.unitId}: no target`)

  // 0x6FCA32D1..0x6FCA32F2: md+0x54 in {3, 0x13} ("always chase") and not in melee range.
  if (!inMelee && ctx.alwaysChase) {
    drlgApproachTarget113c(host, monster, seed, target, 0, aiInterval)
    return
  }

  // 0x6FCA335C..0x6FCA33B4: the pack leader within 15 rolls `aip1` to shout (S2) an attack command.
  if (dist < 15 && monster.groupLeader113c === monster.unitId) {
    if (rollLimitedSeed113c(seed, 100) < aip(1)) {
      broadcastGroupCommand113c(host, monster, 1)
      startDrlgMonsterOneShot113c(host, monster, 'S2')
      return
    }
  }

  if (inMelee) {
    // 0x6FCA33CF..0x6FCA346D
    if (!monster.fallenAfraid113c) {
      if (rollLimitedSeed113c(seed, 100) >= aip(3)) {
        if (rollLimitedSeed113c(seed, 100) < 30) {
          startDrlgMonsterOneShot113c(host, monster, 'S2')
        } else {
          drlgAiStall113c(host, monster, 10)
        }
        return
      }
    }
    monster.fallenAfraid113c = false
    startDrlgMonsterAttack113c(host, monster, target, rollLimitedSeed113c(seed, 100) < aip(4) ? 'A1' : 'A2')
    return
  }

  // 0x6FCA3473..0x6FCA34AD
  if (dist > aip(2)) {
    if (rollLimitedSeed113c(seed, 100) < 30) {
      drlgIdleWander113c(host, monster, seed, 3, aiInterval)
    } else {
      drlgAiStall113c(host, monster, 10)
    }
    return
  }
  drlgApproachTarget113c(host, monster, seed, target, 7, aiInterval)
}
