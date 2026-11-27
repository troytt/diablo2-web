/**
 * 1.13c `Hireable` monster AI (`MonAI.txt` row 61, `gpMonsterAiFunctionTable` `0x6FD2E788` entry
 * `{0, 0, 0x6FC3DD40, 0}`) + `.d2s` mercenary spawn (`SAVE_LoadMercData` `0x6FD0D980` ->
 * `MERCS_CreateUnit` `0x6FCE1250` -> `MERCS_SetStats` `0x6FC68BA0`) + Rogue Scout projectile
 * launch/collision (`D2Common #10413` `0x6FDBBE60` + `MISSMODE_SrvDmg01` `0x6FC5A850`) on the DRLG
 * oracle path.
 *
 * Whole-call-tree disassembly, basic-block logic, and RNG draw tables:
 * `kb/monsters/d2game-mercenary-hire-aura-113c.md` and `kb/monsters/d2game-pet-hireable-ai-113c.md`.
 */

import { evaluateCalc, type CalcEvalContext } from '../../../common/data/calc-ast.ts'
import { PATH_ComputeDirection as pathComputeDirection } from '../../../common/path/index.ts'
import { SEED_RollRandomNumber, type D2SeedStrc } from '../../../common/rng/d2-rng.ts'
import {
  chooseMercSkill113c,
  computeMercSetStats113c,
  resolveHirelingLevelFromExp113c,
} from '../../../common/units/hireling-table.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { getMonsterKindByHcIdx } from '../../../common/units/monsters-data.ts'
import { emitSUnitDmgTraceEvent113c, type CombatUnitContext } from '../combat-pipeline.ts'
import {
  difficultyMonsterColdDivisor,
  difficultyMonsterFreezeDivisor,
} from '../difficulty-resist-penalty.ts'
import { linearMissileStep16_113c } from '../missile-path-113c.ts'
import { FIXED_ONE } from '../stat-list.ts'
import {
  TOWN_AREAS,
  UNIT_TYPE_113C,
  missileSpeedSubtilesPerFrame113c,
  unitsDistanceToCoordinates113c,
} from './constants-and-helpers.ts'
import type { GameInstanceHost } from './host.ts'
import { armMonsterEvent3AfterDamage113c } from './monster-damage.ts'
import type {
  InternalMercenaryRecord,
  InternalMissileRecord,
  InternalMonsterRecord,
  InternalPlayerRecord,
} from './types.ts'
import {
  rollLimitedSeed113c,
  rollMonsterInitStats113c,
  rollMonsterOutfit113c,
} from './unit-seeds-113c.ts'

const MODE_NU = 1
const MODE_WL = 2
const MODE_A1 = 4
const MODE_RN = 15

const PATHTYPE_IDASTAR = 1
const PATHTYPE_STRAIGHT = 7
const PATHTYPE_TOWARD_FINISH = 13
const PATHTYPE_WALL_FOLLOW = 15
const DEFAULT_NEW_DIST = 5

/** `0x6FD1CEE0` / `0x6FD1CED8`: 8-direction follow rotation table (`AIMERC_HireablePetMove` `0x6FC3D43A`). */
const HIREABLE_FOLLOW_DIR_TABLE_113C: readonly number[] = [4, 3, 2, 1, 0, 7, 6, 5]
/** `D2Common #10740` (`0x6FD6A270`): 8-direction unit vector. */
const DIR8_DX_113C: readonly number[] = [0, -1, -1, -1, 0, 1, 1, 1]
const DIR8_DY_113C: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1]

export interface PendingMercSkillAction113c {
  readonly skillId: number
  readonly slvl: number
  readonly mode: number
  readonly targetUnitId: number
  readonly targetX: number
  readonly targetY: number
}

export interface OracleHireableAiState113c {
  readonly subTypeId: number
  readonly isExpansion: boolean
  nextAiFrame: number
  ovPathType: number
  ovVelocity: number
  ovNewDist: number
  activeVelBonus: number
  animEndFrame: number
  actionFrame: number
  pendingAction: PendingMercSkillAction113c | undefined
  idleCounter: number
}

interface MercCtx113c {
  readonly host: GameInstanceHost
  readonly owner: InternalPlayerRecord
  readonly merc: InternalMercenaryRecord
  readonly ai: OracleHireableAiState113c
  readonly seed: D2SeedStrc
}

function dir64To8_10266(dir64: number): number {
  const d = dir64 & 0xff
  if (d >= 64) throw new Error(`#10266: direction ${dir64} outside 64-entry table`)
  return d < 4 || d >= 60 ? 0 : (d + 4) >> 3
}

/**
 * `PLAYER_UpdateHistoryPos` (`D2Game.dll` `0x6FC99BF0`): maintains the 20-entry player breadcrumb
 * ring buffer scanned by `AIMERC_HireablePetMove` state 1 (`0x6FC3D630`) when `dx*dx + dy*dy > 45`.
 */
export function updatePlayerBreadcrumbs113c(player: InternalPlayerRecord): void {
  const px = Math.floor(player.x + 0.5)
  const py = Math.floor(player.y + 0.5)
  let bc = player.breadcrumbs113c
  if (bc === undefined || bc.length === 0) {
    player.breadcrumbs113c = [{ x: px, y: py }]
    return
  }
  const head = bc[0]!
  const dx = px - head.x
  const dy = py - head.y
  if (dx * dx + dy * dy > 45) {
    bc = [{ x: px, y: py }, ...bc]
    if (bc.length > 20) bc.length = 20
    player.breadcrumbs113c = bc
  }
}

/**
 * `SAVE_LoadMercData` (`0x6FD0D980`) -> `MERCS_CreateUnit` (`0x6FCE1250`) -> `MERCS_InitFromSave`
 * (`0x6FC68FC0`) -> `MERCS_SetStats` (`0x6FC68BA0`):
 * Runs on player join BEFORE `PLAYER_UpdateRooms` activates town rooms and spawns Town NPCs, so a
 * live `.d2s` mercenary receives `unitId = 1` (`1` `gameSeed` draw overwritten by `{ seed, 666 }`),
 * rolls outfit (`8` draws) + `MONSTER_InitStats` (`1` draw), spawns at `(ownerX, ownerY)` in
 * `MONMODE_NEUTRAL (1)`, applies `Hireling.txt` stats, and schedules first AI think at `frame = 3`.
 */
export function initOracleHireableMerc113c(
  host: GameInstanceHost,
  owner: InternalPlayerRecord,
  savedMerc: {
    readonly flags?: number | undefined
    readonly seed: number
    readonly nameId?: number | undefined
    readonly typeId: number
    readonly experience?: number | undefined
    readonly dead?: boolean | undefined
  },
  isExpansion: boolean,
): InternalMercenaryRecord {
  const mercUnitId = host.allocateUnitId(UNIT_TYPE_113C.monster, true)
  const mercSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${mercUnitId}`)
  if (mercSeed === undefined) {
    throw new Error(`initOracleHireableMerc113c: missing allocated unit seed for merc ${mercUnitId}`)
  }

  const mercExp = Math.max(0, Math.trunc(savedMerc.experience ?? 0))
  const mercLevel =
    mercExp > 0
      ? Math.min(owner.level, resolveHirelingLevelFromExp113c(savedMerc.typeId, mercExp, isExpansion, 98))
      : Math.min(98, owner.level)

  const stats = computeMercSetStats113c(savedMerc.typeId, mercLevel, isExpansion)
  if (stats === null) {
    throw new Error(`initOracleHireableMerc113c: no Hireling.txt row for subType=${savedMerc.typeId} level=${mercLevel}`)
  }

  const hcIdx = stats.row.classId
  const kind = getMonsterKindByHcIdx(hcIdx, host.difficulty)
  if (kind === undefined) {
    throw new Error(`initOracleHireableMerc113c: no MonStats kind for hcIdx=${hcIdx}`)
  }
  // `MERCS_CreateUnit` (`0x6FCE1484: xor eax, eax; call 0x6FD00F40`) passes `pRoom = NULL` to
  // `SUNIT_InitUnit`, so `0x6FCEA5F0` returns `NULL` without touching `pGame->pMonReg[nAct]` and
  // `MONSTER_ChooseOutfit` (`0x6FCCF7AA`) rolls the 16 component slots directly on `mercSeed`.
  rollMonsterOutfit113c(null, hcIdx, mercSeed)
  rollMonsterInitStats113c({
    kind,
    difficulty: host.difficulty,
    isBoss: false,
    noRatio: Boolean(kind.noRatio),
    isExpansion,
    unitSeed: mercSeed,
  })

  const sx = Math.floor(owner.x + 0.5)
  const sy = Math.floor(owner.y + 0.5)
  host.areaPathWorld.spawnMonster(
    owner.areaId,
    { unitId: mercUnitId, hcIdx, areaId: owner.areaId, x: sx, y: sy, mode: MODE_NU, dead: false },
    host.currentFrame,
  )

  const firstThinkFrame = Math.max(1, host.currentFrame) + 2
  const act = (
    stats.row.act === 1 || stats.row.act === 2 || stats.row.act === 3 || stats.row.act === 5
      ? stats.row.act
      : 1
  ) as 1 | 2 | 3 | 5
  const hireDifficulty = (
    stats.row.difficulty === 3 ? 3 : stats.row.difficulty === 2 ? 2 : 1
  ) as 1 | 2 | 3
  const wholeHp = Math.ceil(stats.maxHp256 / FIXED_ONE)

  const mercRecord: InternalMercenaryRecord = {
    unitId: mercUnitId,
    ownerPlayerId: owner.unitId,
    act,
    subType: stats.row.subTypeId,
    difficulty: hireDifficulty,
    name: stats.row.hireling,
    classId: hcIdx,
    level: stats.level,
    areaId: owner.areaId,
    x: sx,
    y: sy,
    hp: wholeHp,
    maxHp: wholeHp,
    damage: Math.floor((stats.secondaryMinDamage + stats.secondaryMaxDamage) / 2),
    ar: stats.toHit,
    defense: stats.defense,
    resist: stats.baseResist,
    reach: hcIdx === 271 || hcIdx === 359 ? 20 : 2.5,
    aggroRadius: 24,
    speed: (MONSTATS_113C_ROWS[hcIdx]?.velocity ?? 7) / 25,
    cooldown: 15,
    cooldownTicks: 0,
    activeAura: undefined,
    state: 'idle',
    alive: true,
    experience: mercExp,
    expPerLvl: stats.row.expPerLvl,
    equipment: [],
    regenCarry256: 0,
    mode: MODE_NU,
    strength: stats.strength,
    dexterity: stats.dexterity,
    minDmg: stats.secondaryMinDamage,
    maxDmg: stats.secondaryMaxDamage,
    maxHp256: stats.maxHp256,
    hp256: stats.hp256,
    hpRegen256: stats.hpRegen256,
    oracleMercAi113c: {
      subTypeId: stats.row.subTypeId,
      isExpansion,
      nextAiFrame: firstThinkFrame,
      ovPathType: 0,
      ovVelocity: 0,
      ovNewDist: 0,
      activeVelBonus: 0,
      animEndFrame: 0,
      actionFrame: 0,
      pendingAction: undefined,
      idleCounter: 0,
    },
    states: new Set<number>(),
    stateTimers: new Map<number, number>(),
  }

  host.mercenaries.set(mercUnitId, mercRecord)
  host.mercCombatContext(mercRecord)
  return mercRecord
}

function mercSlowPct113c(merc: InternalMercenaryRecord, mercCtx: CombatUnitContext): number {
  let slow = 0
  if (merc.states.has(11)) slow += 50
  if (merc.states.has(60)) slow += 50
  const statVel = Math.trunc(mercCtx.statList.getAccruedStat(67))
  return slow - statVel
}

function mercVelocityPct113c(c: MercCtx113c): number {
  const mercCtx = c.host.mercCombatContext(c.merc)
  return 75 + c.ai.activeVelBonus - mercSlowPct113c(c.merc, mercCtx)
}

function mercDefaultRunBonus113c(hcIdx: number): number {
  const row = MONSTATS_113C_ROWS[hcIdx]
  if (row === undefined) throw new Error(`Hireable: no MonStats row for hcIdx=${hcIdx}`)
  if (row.velocity <= 0) return 100
  const b = Math.trunc((row.run * 100) / row.velocity) - 100
  return b < 100 ? b : 100
}

/**
 * Steps one server frame of an oracle `Hireable` mercenary (`MONSTER_Regen`, pending attack/cast
 * keyframe, animation completion, dynamic path walk/run step + area seam sync, and `Hireable` AI think).
 */
export function stepOracleHireableMerc113c(
  host: GameInstanceHost,
  owner: InternalPlayerRecord,
  merc: InternalMercenaryRecord,
): void {
  const ai = merc.oracleMercAi113c
  if (ai === undefined) return
  const seed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${merc.unitId}`)
  if (seed === undefined) {
    throw new Error(`stepOracleHireableMerc113c: merc ${merc.unitId} has no unit seed`)
  }

  // Re-sync stats if level changed on a kill (`MERCS_SetStats` `0x6FC68BA0`).
  const expectedStats = computeMercSetStats113c(ai.subTypeId, merc.level, ai.isExpansion)
  if (expectedStats !== null && merc.strength !== expectedStats.strength) {
    merc.strength = expectedStats.strength
    merc.dexterity = expectedStats.dexterity
    merc.defense = expectedStats.defense
    merc.ar = expectedStats.toHit
    merc.minDmg = expectedStats.secondaryMinDamage
    merc.maxDmg = expectedStats.secondaryMaxDamage
    merc.resist = expectedStats.baseResist
    merc.maxHp256 = expectedStats.maxHp256
    merc.hp256 = expectedStats.maxHp256
    merc.hpRegen256 = expectedStats.hpRegen256
    merc.maxHp = Math.ceil(expectedStats.maxHp256 / FIXED_ONE)
    merc.hp = merc.maxHp
    merc.expPerLvl = expectedStats.row.expPerLvl
  }

  // 1. 8.8 fixed-point `MONSTER_Regen` (`0x6FC96740`).
  const mercCtx = host.mercCombatContext(merc)
  const isPoisoned =
    merc.states.has(2) || mercCtx.stateBus.hasState(2) || mercCtx.stateBus.hasState('poison')
  const baseRegen256 = isPoisoned
    ? 0
    : (merc.hpRegen256 ?? Math.max(0, Math.trunc((merc.maxHp256 ?? merc.maxHp * FIXED_ONE) / 2000)))
  const itemRegen256 = Math.trunc(host.sumMercItemStat(merc, 74))
  const stateRegen256 = Math.trunc(mercCtx.statList.getAccruedStat('hpregen'))
  const totalRegen256 = baseRegen256 + itemRegen256 + stateRegen256
  const maxHp256 = mercCtx.statList.getMaxHp256()
  const curHp256 = merc.hp256 ?? merc.hp * FIXED_ONE
  if (totalRegen256 !== 0 && (totalRegen256 < 0 || curHp256 < maxHp256)) {
    const prevHp = merc.hp
    const nextHp256 = Math.min(maxHp256, Math.max(FIXED_ONE, curHp256 + totalRegen256))
    merc.hp256 = nextHp256
    merc.hp = Math.ceil(nextHp256 / FIXED_ONE)
    mercCtx.statList.setHp256(nextHp256)
    if (merc.hp !== prevHp) {
      host.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
    }
  }

  // Ensure the mercenary has a dynamic path registered in `merc.areaId` (e.g. after cross-area
  // warp/waypoint/portal relocation or town resurrection).
  const existingMercPath = host.areaPathWorld.getUnitPathState113c(
    merc.areaId,
    UNIT_TYPE_113C.monster,
    merc.unitId,
  )
  if (existingMercPath === null) {
    host.areaPathWorld.removeMonster(merc.unitId)
    merc.mode = MODE_NU
    ai.activeVelBonus = 0
    host.areaPathWorld.spawnMonster(
      merc.areaId,
      {
        unitId: merc.unitId,
        hcIdx: merc.classId,
        areaId: merc.areaId,
        x: Math.floor(merc.x + 0.5),
        y: Math.floor(merc.y + 0.5),
        mode: MODE_NU,
        dead: false,
      },
      host.currentFrame,
    )
  }

  const c: MercCtx113c = { host, owner, merc, ai, seed }

  // 2. Animation action keyframe (`EVENTTYPE_ANIMATION` -> `MONSTER_DispatchSkillOrAttack`).
  if (ai.actionFrame > 0 && host.currentFrame >= ai.actionFrame) {
    const act = ai.pendingAction
    ai.actionFrame = 0
    ai.pendingAction = undefined
    if (act !== undefined) {
      executeMercSkillAction113c(c, act)
    }
  }

  // 3. Animation end (`MONMODE_NEUTRAL`).
  if (ai.animEndFrame > 0 && host.currentFrame >= ai.animEndFrame) {
    ai.animEndFrame = 0
    if (merc.mode !== MODE_NU && merc.mode !== MODE_WL && merc.mode !== MODE_RN) {
      merc.mode = MODE_NU
      ai.activeVelBonus = 0
      host.areaPathWorld.stopMonsterMove113c(merc.areaId, merc.unitId, MODE_NU)
    }
  }

  // 4. Dynamic path walk/run step (`0x6FC965E0` -> `D2Common_10226`).
  let immediateAi = false
  if (merc.mode === MODE_WL || merc.mode === MODE_RN) {
    const prevX = merc.x
    const prevY = merc.y
    const prevAreaId = merc.areaId
    const res = host.areaPathWorld.stepMonsterMove113c({
      areaId: merc.areaId,
      unitId: merc.unitId,
      hcIdx: merc.classId,
      velocityPct: mercVelocityPct113c(c),
      mode: merc.mode,
    })
    if (res === null) {
      merc.mode = MODE_NU
      merc.state = 'idle'
      ai.activeVelBonus = 0
      immediateAi = true
    } else {
      merc.x = res.x
      merc.y = res.y
      const migratedArea = host.areaPathWorld.getMonsterAreaId113c(merc.unitId)
      if (migratedArea !== undefined && migratedArea !== merc.areaId) {
        merc.areaId = migratedArea
      }
      if (merc.x !== prevX || merc.y !== prevY || merc.areaId !== prevAreaId) {
        host.broadcastToArea(merc.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: merc.unitId,
          unitId: merc.unitId,
          from: { x: Math.round(prevX), y: Math.round(prevY) },
          to: { x: Math.round(merc.x), y: Math.round(merc.y) },
          x: merc.x,
          y: merc.y,
          mode: merc.mode === MODE_RN ? 'run' : 'walk',
          areaId: merc.areaId,
        })
        host.syncUnitMoveAcrossViewerAoi113c(
          'monster',
          merc.unitId,
          prevAreaId,
          prevX,
          prevY,
          merc.areaId,
          merc.x,
          merc.y,
          merc.ownerPlayerId,
        )
      }
      if (res.stepped !== 0) {
        merc.state = 'follow'
        return
      }
      merc.mode = MODE_NU
      merc.state = 'idle'
      ai.activeVelBonus = 0
      host.areaPathWorld.stopMonsterMove113c(merc.areaId, merc.unitId, MODE_NU)
      immediateAi = true
    }
  }

  if (!immediateAi && host.currentFrame < ai.nextAiFrame) return
  hireableThink113c(c)
}

function sizeDistMercTo(c: MercCtx113c, unitType: number, unitId: number): number {
  const d = c.host.areaPathWorld.unitSizeSubtractedDistToTarget(
    c.merc.areaId,
    c.merc.unitId,
    unitType,
    unitId,
  )
  if (d === null) {
    const uPos =
      unitType === UNIT_TYPE_113C.player
        ? c.host.players.get(unitId)
        : c.host.monsters.get(unitId)
    if (uPos === undefined) return 0x7fffffff
    return unitsDistanceToCoordinates113c(
      Math.floor(c.merc.x + 0.5),
      Math.floor(c.merc.y + 0.5),
      Math.floor(uPos.x + 0.5),
      Math.floor(uPos.y + 0.5),
    )
  }
  return d
}

/**
 * `AITHINK_Fn057_Hireable` (`D2Game.dll` `0x6FC3DD40..0x6FC3E139`).
 * See `kb/monsters/d2game-mercenary-hire-aura-113c.md` §3.1.
 */
function hireableThink113c(c: MercCtx113c): void {
  const { host, owner, merc, ai, seed } = c

  if (owner.dead || owner.mode === 0 || owner.mode === 17) {
    aiStall113c(c, 10)
    return
  }

  // `0x6FC3DE39`: clear `STATE_HIDE (12)` if present.
  if (merc.states.has(12)) {
    host.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, 12)
  }

  // `0x6FC3DE4F`: moving guard (0 RNG draws).
  const mode = merc.mode ?? MODE_NU
  if (mode === MODE_WL || mode === MODE_RN) {
    return
  }

  // `0x6FC3DE68..0x6FC3DEA0`: distance thresholds (`aip1` is 0 on all vanilla mercenaries).
  const monRow = MONSTATS_113C_ROWS[merc.classId]
  const p1 = monRow?.aip1[host.difficulty] ?? 0
  let farDist = 24
  let midDist = 16
  let orbitBase = 5
  if (p1 > 16 && p1 < 20) {
    midDist = p1
    farDist = p1 * 2
    orbitBase = p1 >> 1
  }

  // `0x6FC3DEA1..0x6FC3DF47`: leash & owner-follow checks.
  const ownerDist = sizeDistMercTo(c, UNIT_TYPE_113C.player, owner.unitId)
  if (ownerDist > 100 || !host.isAreaSeamAdjacent(merc.areaId, owner.areaId)) {
    hireablePetMove113c(c, 3, 0, 0, 0)
    return
  }
  if (ownerDist > farDist) {
    hireablePetMove113c(c, 1, 1, 60, 0)
    return
  }
  if (ownerDist > midDist) {
    if (owner.mode === 2 || owner.mode === 6) {
      hireablePetMove113c(c, 0, 0, 0, 0)
      return
    }
    if (owner.mode === 3) {
      hireablePetMove113c(c, 0, 1, 60, 0)
      return
    }
  }

  // `0x6FC3DF4A..0x6FC3DF8C`: non-neutral guard -> stall 5.
  if (mode !== MODE_NU) {
    aiStall113c(c, 5)
    return
  }

  // `0x6FC3DF8F..0x6FC3E016`: crowded check (`#10851` mask `0x0040`).
  let crowded = false
  if (host.areaPathWorld.checkMonsterCrowdedMask113c(merc.areaId, merc.unitId, 0x0040)) {
    crowded = true
    const thr = merc.classId === 338 || merc.classId === 560 || merc.classId === 561 ? 6 : 12
    if ((SEED_RollRandomNumber(seed) & 0x7f) < thr) {
      if (aiIdleWander113c(c, 5)) return
    }
  }

  // `0x6FC3E019..0x6FC3E069`: combat target scan outside town (`targetDist < 25`).
  if (!TOWN_AREAS.has(merc.areaId)) {
    const found = aiFindNearestTargetForMerc113c(c)
    if (found.target !== null && found.dist < 25) {
      aiMercEngageTarget113c(c, found.target)
      return
    }
  }

  // `0x6FC3E06C..0x6FC3E084`: deferred crowded wander.
  if (crowded) {
    if (aiIdleWander113c(c, 5)) return
  }

  // `0x6FC3E087..0x6FC3E0DD`: tile zone (`#10916`) mismatch.
  const ownerPath = host.areaPathWorld.getUnitPathState113c(owner.areaId, UNIT_TYPE_113C.player, owner.unitId)
  const mercPath = host.areaPathWorld.getUnitPathState113c(merc.areaId, UNIT_TYPE_113C.monster, merc.unitId)
  if (ownerPath !== null && mercPath !== null) {
    const ownerZone = host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, ownerPath.x, ownerPath.y)
    const mercZone = host.areaPathWorld.tileZoneAtPosition113c(mercPath.room, mercPath.x, mercPath.y)
    if (ownerZone !== mercZone) {
      if (hireablePetMove113c(c, 0, 1, 60, 0)) return
    }
  }

  // `0x6FC3E0E0..0x6FC3E137`: close step-off (`ownerDist <= 1` -> state 5) or `5%` orbit (`WalkAroundTarget(16)`).
  const closeDist = sizeDistMercTo(c, UNIT_TYPE_113C.player, owner.unitId)
  if (closeDist <= 1) {
    if (hireablePetMove113c(c, 5, 0, 0, orbitBase - 1)) return
    aiStall113c(c, 5)
    return
  }

  if (rollLimitedSeed113c(seed, 100) < 5) {
    if (aiMovWalkAroundTarget113c(c, Math.floor(owner.x + 0.5), Math.floor(owner.y + 0.5), midDist)) {
      return
    }
  }
  aiStall113c(c, 5)
}

/**
 * `AIMERC_HireablePetMove` (`D2Game.dll` `0x6FC3D3C0..0x6FC3DB3B`).
 * See `kb/monsters/d2game-mercenary-hire-aura-113c.md` §3.2.
 */
function hireablePetMove113c(
  c: MercCtx113c,
  state: number,
  isRun: number,
  velBonus: number,
  orbitRad: number,
): boolean {
  const { host, owner, merc, ai, seed } = c
  const ownerPath = host.areaPathWorld.getUnitPathState113c(owner.areaId, UNIT_TYPE_113C.player, owner.unitId)
  const mercPath = host.areaPathWorld.getUnitPathState113c(merc.areaId, UNIT_TYPE_113C.monster, merc.unitId)
  if (ownerPath === null || mercPath === null) {
    aiStall113c(c, 5)
    return true
  }

  const finalX = ownerPath.finalX
  const finalY = ownerPath.finalY
  const ownerX = ownerPath.x
  const ownerY = ownerPath.y
  const mercX = mercPath.x
  const mercY = mercPath.y

  switch (state) {
    case 0: {
      // `0x6FC3D408..0x6FC3D555`: project 8 subtiles ahead of owner's path target; both `isRun == 0`
      // and `isRun == 1` pass `MONMODE_WALK (2)` (`push 2` at `0x6FC3D4E5`) with `ovVelocity = velBonus`
      // (`+60` when `isRun == 1`) and `ovNewDist = 40`.
      let dir = dir64To8_10266(pathComputeDirection(ownerX, ownerY, finalX, finalY))
      const ownerZone = host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, ownerX, ownerY)
      for (let i = 0; i < 8; i++) {
        const d = HIREABLE_FOLLOW_DIR_TABLE_113C[dir]!
        const tx = (finalX + DIR8_DX_113C[d]! * 8) | 0
        const ty = (finalY + DIR8_DY_113C[d]! * 8) | 0
        if (host.areaPathWorld.tileZoneAtPosition113c(ownerPath.room, tx, ty) === ownerZone) {
          if (velBonus !== 0) ai.ovVelocity = velBonus
          ai.ovNewDist = 40
          if (aiApproachPos113c(c, MODE_WL, tx, ty, 1, 4)) return true
          if (velBonus !== 0) ai.ovVelocity = velBonus
          ai.ovNewDist = 40
          if (aiApproachPos113c(c, MODE_WL, ((mercX + tx) >>> 0) >>> 1, ((mercY + ty) >>> 0) >>> 1, 1, 4)) {
            return true
          }
        }
        dir = (dir + 1) & 7
      }
      if (aiIdleWander113c(c, 4)) return true
      const mx = Math.trunc((ownerX + mercX) / 2)
      const my = Math.trunc((ownerY + mercY) / 2)
      if (velBonus !== 0) ai.ovVelocity = velBonus
      if (aiApproachPos113c(c, MODE_WL, mx, my, 1, 4)) return true
      return aiApproachPos113c(c, MODE_WL, ownerX, ownerY, 1, 0)
    }

    case 1: {
      // `0x6FC3D55D..0x6FC3D8CE`: catch-up walk/run along owner breadcrumb history (`tHistoryPos`).
      if (owner.mode === 2) {
        ai.ovNewDist = 77
        if (aiApproachPos113c(c, MODE_WL, finalX, finalY, 1, 4)) return true
      }
      const effVel = velBonus !== 0 ? velBonus : rollLimitedSeed113c(seed, 15) + 50
      const crumbs = owner.breadcrumbs113c ?? [{ x: ownerX, y: ownerY }]
      for (const crumb of crumbs) {
        if (unitsDistanceToCoordinates113c(mercX, mercY, crumb.x, crumb.y) <= 5) continue
        ai.ovPathType = PATHTYPE_TOWARD_FINISH
        ai.ovVelocity = effVel
        ai.ovNewDist = 40
        if (aiApproachPos113c(c, MODE_WL, crumb.x, crumb.y, 1, 4)) return true
        ai.ovPathType = PATHTYPE_WALL_FOLLOW
        ai.ovVelocity = effVel
        ai.ovNewDist = 40
        if (aiApproachPos113c(c, isRun !== 0 ? MODE_RN : MODE_WL, crumb.x, crumb.y, 1, 4)) return true
      }
      ai.ovPathType = PATHTYPE_IDASTAR
      ai.ovVelocity = effVel
      ai.ovNewDist = 40
      if (aiApproachPos113c(c, isRun !== 0 ? MODE_RN : MODE_WL, ownerX, ownerY, 1, 4)) return true
      const ownerDist = sizeDistMercTo(c, UNIT_TYPE_113C.player, owner.unitId)
      ai.ovVelocity = 15
      if (aiIdleWander113c(c, Math.max(4, ownerDist >> 2))) return true
      aiStall113c(c, 5)
      return true
    }

    case 3: {
      // `0x6FC3D8D4..0x6FC3D9A0`: leash teleport to owner + stall 5.
      const prevAreaId = merc.areaId
      const prevX = merc.x
      const prevY = merc.y
      host.areaPathWorld.removeMonster(merc.unitId)
      merc.areaId = owner.areaId
      merc.x = ownerX
      merc.y = ownerY
      merc.mode = MODE_NU
      ai.activeVelBonus = 0
      host.areaPathWorld.spawnMonster(
        owner.areaId,
        { unitId: merc.unitId, hcIdx: merc.classId, areaId: owner.areaId, x: ownerX, y: ownerY, mode: MODE_NU, dead: false },
        host.currentFrame,
      )
      host.broadcastToArea(merc.areaId, {
        type: 'UnitReassign',
        unitType: 1,
        id: merc.unitId,
        unitId: merc.unitId,
        at: { x: Math.round(merc.x), y: Math.round(merc.y) },
        x: merc.x,
        y: merc.y,
        snap: true,
        areaId: merc.areaId,
      })
      host.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        merc.unitId,
        prevAreaId,
        prevX,
        prevY,
        merc.areaId,
        merc.x,
        merc.y,
        merc.ownerPlayerId,
      )
      aiStall113c(c, 5)
      return true
    }

    case 5: {
      // `0x6FC3DA56..0x6FC3DB1E`: step off owner (`ovPathType = 7` `PATHTYPE_STRAIGHT`, `WalkAroundTarget(orbitRad)`).
      const rad = Math.max(1, orbitRad)
      ai.ovPathType = PATHTYPE_STRAIGHT
      if (aiMovWalkAroundTarget113c(c, ownerX, ownerY, rad)) return true
      ai.ovNewDist = 40
      if (aiApproachPos113c(c, MODE_WL, finalX, finalY, 1, 4)) return true
      aiStall113c(c, 5)
      return true
    }

    default:
      aiStall113c(c, 5)
      return true
  }
}

/**
 * `AIMOV_WalkAroundTarget` (`D2Game.dll` `0x6FD12870..0x6FD1299E`):
 * 4 draws on `pMerc->tSeed` around `(centerX, centerY)` with box radius `radius`.
 */
function aiMovWalkAroundTarget113c(
  c: MercCtx113c,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  if (radius <= 0) return false
  const s1 = SEED_RollRandomNumber(c.seed)
  let dx: number
  let dy: number
  if ((s1 & 1) !== 0) {
    dy = rollLimitedSeed113c(c.seed, radius)
    dx = radius
  } else {
    dx = rollLimitedSeed113c(c.seed, radius)
    dy = radius
  }
  if ((SEED_RollRandomNumber(c.seed) & 1) !== 0) dx = -dx
  if ((SEED_RollRandomNumber(c.seed) & 1) !== 0) dy = -dy
  return aiApproachPos113c(c, MODE_WL, centerX + dx, centerY + dy, 1, 0)
}

/**
 * `AI_IdleWander` (`D2Game.dll` `0x6FD11B10`): 4 draws on `pMerc->tSeed` around `(mercX, mercY)`.
 */
function aiIdleWander113c(c: MercCtx113c, range: number): boolean {
  const mercPath = c.host.areaPathWorld.getUnitPathState113c(c.merc.areaId, UNIT_TYPE_113C.monster, c.merc.unitId)
  if (mercPath === null) return false
  return aiMovWalkAroundTarget113c(c, mercPath.x, mercPath.y, range)
}

function aiApproachPos113c(
  c: MercCtx113c,
  mode: number,
  x: number,
  y: number,
  stepNum: number,
  flags: number,
): boolean {
  void flags
  const pathType = c.ai.ovPathType !== 0 ? c.ai.ovPathType : PATHTYPE_TOWARD_FINISH
  const newDist = c.ai.ovNewDist !== 0 ? c.ai.ovNewDist : DEFAULT_NEW_DIST
  const nextVelBonus =
    c.ai.ovVelocity !== 0
      ? c.ai.ovVelocity
      : mode === MODE_RN
        ? mercDefaultRunBonus113c(c.merc.classId)
        : 0
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  c.ai.activeVelBonus = nextVelBonus

  const pts = c.host.areaPathWorld.startMonsterMoveToPos113c({
    areaId: c.merc.areaId,
    unitId: c.merc.unitId,
    hcIdx: c.merc.classId,
    targetX: x | 0,
    targetY: y | 0,
    pathType,
    stepNum,
    velocityPct: mercVelocityPct113c(c),
    maxDist: newDist,
  })
  if (pts > 0) {
    c.merc.mode = mode
    c.merc.state = 'follow'
    return true
  }
  c.ai.activeVelBonus = 0
  return false
}

function aiApproachUnit113c(
  c: MercCtx113c,
  mode: number,
  target: InternalMonsterRecord,
  newDist: number,
): boolean {
  const nextVelBonus =
    c.ai.ovVelocity !== 0
      ? c.ai.ovVelocity
      : mode === MODE_RN
        ? mercDefaultRunBonus113c(c.merc.classId)
        : 0
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  c.ai.activeVelBonus = nextVelBonus

  const pts = c.host.areaPathWorld.startMonsterMoveToTarget113c({
    areaId: c.merc.areaId,
    unitId: c.merc.unitId,
    hcIdx: c.merc.classId,
    targetUnitType: UNIT_TYPE_113C.monster,
    targetUnitId: target.unitId,
    pathType: PATHTYPE_TOWARD_FINISH,
    stepNum: 1,
    velocityPct: mercVelocityPct113c(c),
    maxDist: newDist > 0 ? newDist : DEFAULT_NEW_DIST,
  })
  if (pts > 0) {
    c.merc.mode = mode
    c.merc.state = 'chase'
    return true
  }
  c.ai.activeVelBonus = 0
  return false
}

function aiStall113c(c: MercCtx113c, frames: number): void {
  if (c.merc.mode !== MODE_NU) {
    c.merc.mode = MODE_NU
    c.host.areaPathWorld.stopMonsterMove113c(c.merc.areaId, c.merc.unitId, MODE_NU)
  }
  c.merc.state = 'idle'
  c.ai.ovPathType = 0
  c.ai.ovVelocity = 0
  c.ai.ovNewDist = 0
  c.ai.activeVelBonus = 0
  c.ai.nextAiFrame = c.host.currentFrame + (frames <= 0 ? 1 : frames)
}

/**
 * `AI_FindNearestTarget` (`0x6FCD1BC0` / `0x6FCD1C90`) from the mercenary's position:
 * scans alive hostile monsters within `MonStats.aidist` (35 when 0) across seam-adjacent outdoor areas.
 */
function aiFindNearestTargetForMerc113c(
  c: MercCtx113c,
): { readonly target: InternalMonsterRecord | null; readonly dist: number } {
  const { host, merc } = c
  const mx = Math.floor(merc.x + 0.5)
  const my = Math.floor(merc.y + 0.5)
  const rawAiDist = MONSTATS_113C_ROWS[merc.classId]?.aidist[host.difficulty] ?? 0
  const radius = rawAiDist !== 0 ? rawAiDist : 35
  let best: InternalMonsterRecord | null = null
  let bestDist = radius
  let minSeen = 0x7fffffff

  for (const m of host.monsters.values()) {
    if (m.dead || m.isNpc || !m.isKillable || m.align !== 0) continue
    if (TOWN_AREAS.has(m.areaId) || !host.isAreaSeamAdjacent(merc.areaId, m.areaId)) continue
    if (host.isMonsterConverted(m)) continue
    const d = unitsDistanceToCoordinates113c(Math.floor(m.x + 0.5), Math.floor(m.y + 0.5), mx, my)
    if (d < minSeen) minSeen = d
    if (d >= 0x37) continue
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return best === null ? { target: null, dist: minSeen } : { target: best, dist: bestDist }
}

/**
 * `AIMERC_EngageTarget` (`D2Game.dll` `0x6FC3C8A0..0x6FC3CACB`) + `AIMERC_ChooseSkill` (`0x6FC3C4E0`).
 * See `kb/monsters/d2game-mercenary-hire-aura-113c.md` §4.1–§4.2.
 */
function aiMercEngageTarget113c(
  c: MercCtx113c,
  target: InternalMonsterRecord,
): void {
  const { host, owner, merc, ai, seed } = c
  const monRow = MONSTATS_113C_ROWS[merc.classId]
  const aip1 = monRow?.aip1[host.difficulty] ?? 0
  const isMeleeMerc = merc.classId === 338 || merc.classId === 560 || merc.classId === 561
  const engagePct = isMeleeMerc ? 98 : Math.min(95, aip1 + 40 + 2 * merc.level)

  // `0x6FC3C905`: `AIMERC_EngageTarget` recomputes size-subtracted octile distance (`0x6FCD0A20`).
  const targetDist = sizeDistMercTo(c, UNIT_TYPE_113C.monster, target.unitId)

  const canAct = (SEED_RollRandomNumber(seed) >>> 0) % 100 < engagePct
  if (canAct) {
    ai.idleCounter = 0
  } else {
    ai.idleCounter += 10
  }

  if (aip1 === 0) {
    // Ranged (`roguehire` #271, `act3hire` #359): close-range kite check when `targetDist < 4` (`0x6FC3C9A6`).
    if (targetDist < 4) {
      if ((SEED_RollRandomNumber(seed) >>> 0) % 100 < 50) {
        const ownerX = Math.floor(owner.x + 0.5)
        const ownerY = Math.floor(owner.y + 0.5)
        if (aiMovWalkAroundTarget113c(c, ownerX, ownerY, 4)) return
        const mx = Math.floor(merc.x + 0.5)
        const my = Math.floor(merc.y + 0.5)
        const tx = Math.floor(target.x + 0.5)
        const ty = Math.floor(target.y + 0.5)
        const awayX = mx + Math.sign(mx - tx) * 4
        const awayY = my + Math.sign(my - ty) * 4
        if (aiApproachPos113c(c, MODE_WL, awayX, awayY, 1, 0)) return
        aiMercChooseAndStartSkill113c(c, target, targetDist)
        return
      }
    }
    if (!canAct) {
      aiStall113c(c, 10)
      return
    }
    aiMercChooseAndStartSkill113c(c, target, targetDist)
    return
  }

  // Melee (`act2hire` #338, `act5hire1/2` #560/#561).
  if (targetDist < 3) {
    if (canAct) {
      aiMercChooseAndStartSkill113c(c, target, targetDist)
    } else {
      aiStall113c(c, 10)
    }
    return
  }

  const meleeRng = monRow?.meleeRng ?? 2
  if (aiApproachUnit113c(c, MODE_RN, target, meleeRng === 0xff ? 1 : Math.max(1, meleeRng))) {
    return
  }
  aiStall113c(c, 10)
}

function resolveMercAttackTiming113c(
  c: MercCtx113c,
  mode: number,
): { readonly totalFrames: number; readonly actionFrame: number } {
  const { host, merc } = c
  const mercCtx = host.mercCombatContext(merc)
  const attackRateBonus = Math.trunc(mercCtx.statList.getAccruedStat('attackrate'))
  if (merc.classId === 271) {
    // `RGA1BW` (`AnimData.d2`): `framesPerDirection = 15`, `actionFrame = 6`, `animationSpeed = 256`.
    const fpd = 15
    const baseAction = 6
    const effSpeed = Math.max(32, Math.floor((256 * (100 + attackRateBonus)) / 100))
    const totalFrames = Math.max(2, Math.ceil((fpd * 256) / effSpeed))
    const actionFrame = Math.max(1, Math.min(totalFrames - 1, Math.floor((baseAction * 256) / effSpeed)))
    return { totalFrames, actionFrame }
  }
  const code = MONSTATS_113C_ROWS[merc.classId]?.code?.trim().toUpperCase() ?? 'RG'
  const modeToken = mode === 5 ? 'A2' : 'A1'
  const rec =
    host.registry.getAnimDataRecord(`${code}${modeToken}HTH`) ??
    host.registry.getAnimDataRecord(`${code}${modeToken}BW`)
  const fpd = rec?.framesPerDirection ?? 15
  const baseSpeed = rec?.animationSpeed ?? 256
  const triggerFrame = rec?.events.find((e) => e.code !== 0)?.frame
  const baseAction = triggerFrame !== undefined && triggerFrame > 0 ? triggerFrame : 6
  const effSpeed = Math.max(32, Math.floor((baseSpeed * (100 + attackRateBonus)) / 100))
  const totalFrames = Math.max(2, Math.ceil((fpd * 256) / effSpeed))
  const actionFrame = Math.max(1, Math.min(totalFrames - 1, Math.floor((baseAction * 256) / effSpeed)))
  return { totalFrames, actionFrame }
}

function aiMercChooseAndStartSkill113c(
  c: MercCtx113c,
  target: InternalMonsterRecord,
  targetDist: number,
): void {
  const { host, owner, merc, ai, seed } = c
  const activeAuraIds = new Set<number>()
  if (merc.activeAura !== undefined) {
    const sk = host.registry.getSkill(merc.activeAura)
    if (sk !== undefined) activeAuraIds.add(sk.id)
  }

  const choice = chooseMercSkill113c(
    ai.subTypeId,
    merc.level,
    ai.isExpansion,
    (limit) => rollLimitedSeed113c(seed, limit),
    {
      activeAuraSkillIds: activeAuraIds,
      targetDistanceSubtiles: targetDist,
      defaultRogueSkillId: 6,
    },
  )
  if (choice === null) {
    aiStall113c(c, 10)
    return
  }

  // Aura activation (`Skills[skillId].aura` / `Hireling.txt` `Mode == 1`, e.g. Act 2 Desert Mercenary).
  if (choice.kind === 'skill' && choice.skillId > 0) {
    const skRow = host.registry.getSkillById(choice.skillId)
    if (skRow?.aura || choice.mode === 1) {
      merc.activeAura = skRow?.skill ?? choice.skillName
      host.syncMercenaryOwnerAura(owner, merc.activeAura, merc, false)
      aiStall113c(c, 10)
      return
    }
  }

  const animMode = choice.mode === 5 ? 5 : MODE_A1
  const timing = resolveMercAttackTiming113c(c, animMode)
  host.areaPathWorld.stopMonsterMove113c(merc.areaId, merc.unitId, animMode)
  merc.mode = animMode
  merc.state = 'attack'
  ai.activeVelBonus = 0
  ai.actionFrame = host.currentFrame + timing.actionFrame
  ai.animEndFrame = host.currentFrame + timing.totalFrames
  ai.nextAiFrame = host.currentFrame + timing.totalFrames + 1
  ai.pendingAction = {
    skillId: choice.skillId,
    slvl: choice.slvl,
    mode: animMode,
    targetUnitId: target.unitId,
    targetX: Math.floor(target.x + 0.5),
    targetY: Math.floor(target.y + 0.5),
  }
}

function buildMercSkillCalcCtx113c(
  host: GameInstanceHost,
  merc: InternalMercenaryRecord,
  skillId: number,
  slvl: number,
): CalcEvalContext | null {
  const skill = host.registry.getSkillById(skillId)
  if (skill === undefined) return null
  const mercCtx = host.mercCombatContext(merc)
  return {
    registry: host.registry,
    activeSkill: skill,
    slvl,
    blvl: slvl,
    ulvl: merc.level,
    getBaseSkillLevel: (id: number) => (id === skillId ? slvl : 0),
    getEffectiveSkillLevel: (id: number) => (id === skillId ? slvl : 0),
    getUnitStat: (stat: string | number, baseOnly?: boolean) =>
      mercCtx.statList.getAccruedStat(stat, baseOnly),
  }
}

function executeMercSkillAction113c(c: MercCtx113c, act: PendingMercSkillAction113c): void {
  const { host, owner, merc, seed } = c

  // `#8 Inner Sight` (`SKILLS_SrvDo006` `0x6FC6CA30`): 0 RNG draws, radial `-armorclass` (`state 17`) within 20 subtiles.
  if (act.skillId === 8) {
    const calcCtx = buildMercSkillCalcCtx113c(host, merc, 8, act.slvl)
    if (calcCtx === null) return
    const acPenalty = Math.max(0, evaluateCalc('edmn', calcCtx))
    const durFrames = 200 + Math.max(0, act.slvl - 1) * 100
    const mx = Math.floor(merc.x + 0.5)
    const my = Math.floor(merc.y + 0.5)
    for (const m of host.monsters.values()) {
      if (m.dead || m.isNpc || !m.isKillable || m.align !== 0) continue
      if (TOWN_AREAS.has(m.areaId) || !host.isAreaSeamAdjacent(merc.areaId, m.areaId)) continue
      if (host.isMonsterConverted(m)) continue
      const dist = unitsDistanceToCoordinates113c(mx, my, Math.floor(m.x + 0.5), Math.floor(m.y + 0.5))
      if (dist > 20) continue
      host.applyUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, 17, durFrames)
      const mCtx = host.monsterCombatContext(m)
      mCtx.stateBus.applyState({
        stateNameOrId: 17,
        sourceUnitId: `merc_${merc.unitId}`,
        sourceSkillId: 8,
        durationFrames: durFrames,
        stats: { armorclass: -acPenalty },
      })
    }
    return
  }

  // Rogue Scout bow / elemental arrow (`#6` default bow shot -> `#1 arrow`, `#7 Fire Arrow` -> `#31 firearrow`, `#11 Cold Arrow` -> `#40 coldarrow`).
  if (merc.classId === 271) {
    const liveTarget = host.monsters.get(act.targetUnitId)
    const tx =
      liveTarget !== undefined && !liveTarget.dead
        ? Math.floor(liveTarget.x + 0.5)
        : act.targetX
    const ty =
      liveTarget !== undefined && !liveTarget.dead
        ? Math.floor(liveTarget.y + 0.5)
        : act.targetY
    const sx = Math.floor(merc.x + 0.5)
    const sy = Math.floor(merc.y + 0.5)

    const skillRow = act.skillId > 0 ? host.registry.getSkillById(act.skillId) : undefined
    let missileId = 1
    if (act.skillId === 11) {
      missileId = 40
    } else if (act.skillId === 7) {
      missileId = 31
    } else if (skillRow?.srvMissileA) {
      const mByName = host.registry.getMissileByName(skillRow.srvMissileA)
      if (mByName !== undefined) missileId = mByName.id
    }
    const mRow = host.registry.getMissileById(missileId)
    if (mRow === undefined) {
      throw new Error(`executeMercSkillAction113c: missing Missiles.txt row ${missileId}`)
    }

    // 1. Allocate server missile (`1` `gameSeed` draw).
    const mUnitId = host.allocateUnitId(UNIT_TYPE_113C.missile, true)

    // 2. `D2Common #10413` (`0x6FDBBE60` `MISSILE_BuildStatsDamage`):
    // Unconditionally consumes `1` `mercSeed` draw for missile crit (`rollLimited(100) < critChance`).
    // Unarmed Rogue Scout (`bEquippedWeapon == 0` and `MonStats[271].A1MinD/A1MaxD == 0`) writes `0`
    // weapon physical damage; armed Rogue Scout carries `Hireling.txt` + bow min/max physical damage.
    const mercCtx = host.mercCombatContext(merc)
    const critChance = Math.trunc(mercCtx.statList.getAccruedStat('item_deadlystrike'))
    const isCrit = rollLimitedSeed113c(seed, 100) < critChance

    const hasEquippedWeapon = merc.equipment.some(
      (it) => it.bodyLoc === 4 || it.bodyLoc === 5,
    )
    const physMin256 = hasEquippedWeapon
      ? Math.max(0, Math.trunc(mercCtx.statList.getAccruedStat('secondary_mindamage')) + host.sumMercItemStat(merc, 21)) * FIXED_ONE
      : 0
    const physMax256 = hasEquippedWeapon
      ? Math.max(physMin256, (Math.trunc(mercCtx.statList.getAccruedStat('secondary_maxdamage')) + host.sumMercItemStat(merc, 22)) * FIXED_ONE)
      : 0
    const physEdPct =
      Math.trunc(mercCtx.statList.getAccruedStat('dexterity')) +
      Math.trunc(mercCtx.statList.getAccruedStat('damagepercent'))

    let elemType: 'fire' | 'cold' | 'mag' | undefined
    let elemMin256 = 0
    let elemMax256 = 0
    let coldLenFrames = 0
    let srvDmgFunc = 0
    if (act.skillId === 11 || act.skillId === 7) {
      const calcCtx = buildMercSkillCalcCtx113c(host, merc, act.skillId, act.slvl)
      if (calcCtx !== null) {
        elemType = act.skillId === 11 ? 'cold' : 'fire'
        elemMin256 = Math.max(0, evaluateCalc('enms', calcCtx))
        elemMax256 = Math.max(elemMin256, evaluateCalc('exms', calcCtx))
        if (act.skillId === 11) {
          coldLenFrames = Math.max(0, evaluateCalc('edln', calcCtx))
        }
        srvDmgFunc = 1
      }
    }

    const rawVel = mRow.vel + Math.trunc((mRow.velLev * act.slvl) / 8)
    const speed = missileSpeedSubtilesPerFrame113c(rawVel)
    const { vx, vy } = linearMissileStep16_113c(sx, sy, tx, ty, speed)
    const remainingFrames = Math.max(1, mRow.range + act.slvl * mRow.levRange)

    const missileRec: InternalMissileRecord = {
      unitId: mUnitId,
      missileId,
      skillId: act.skillId === 6 ? 0 : act.skillId,
      ownerType: 'player',
      ownerId: owner.unitId,
      areaId: merc.areaId,
      x: sx,
      y: sy,
      vx,
      vy,
      damage: 0,
      remainingFrames,
      ticksElapsed: 0,
      createdFrame: host.currentFrame,
      collideType: mRow.collideType,
      size: Math.max(1, mRow.size),
      pierce: !mRow.collideKill,
      srcDamage: mRow.srcDamage,
      nextHit: Boolean(mRow.nextHit),
      nextDelay: mRow.nextDelay,
      element: elemType ?? 'phys',
      physDamage: 0,
      elemDamage: 0,
      elemDurationFrames: coldLenFrames,
      hitCooldowns: new Map<number, number>(),
      guaranteedHit: false,
      mercOwnerUnitId: merc.unitId,
      mercSlvl113c: act.slvl,
      mercSrvDmgFunc113c: srvDmgFunc,
      mercPhysMin256: physMin256,
      mercPhysMax256: physMax256,
      mercPhysEdPct: physEdPct,
      mercDeadlyStrike: isCrit,
      mercElemType: elemType,
      mercElemMin256: elemMin256,
      mercElemMax256: elemMax256,
      mercColdLenFrames: coldLenFrames,
    }
    host.missiles.set(mUnitId, missileRec)
    return
  }

  // Melee mercenary fallback (`act2hire` / `act5hire`).
  const liveTarget = host.monsters.get(act.targetUnitId)
  if (liveTarget !== undefined && !liveTarget.dead) {
    host.applyDamageToMonster(owner, liveTarget, merc.damage, act.skillId, 'phys', 'merc', {
      attackKind: 'melee',
    })
  }
}

/**
 * `MISSMODE_SrvDmg01` (`D2Game.dll` `0x6FC5A850`) -> `SUNITDMG_ExecuteMissileDamage` (`0x6FCFE0E0`):
 * Resolves a mercenary arrow collision against a DRLG hostile monster with exact 1.13c RNG draws:
 * - `1` `mercSeed` draw in `SUNITDMG_RollToHit` (`rollLimited(100)`),
 * - `1` `missileSeed` draw for physical span (when `physMax256 > physMin256`) + `1` `missileSeed` draw
 *   for elemental span (`eMax256 > eMin256`),
 * - `emitSUnitDmgTraceEvent113c` matching `d2oracle.c` `SUNITDMG_ApplyDamage` hook,
 * - `1` `targetSeed` draw (`rollLimited(100) < 20`) for cold shatter on kill BEFORE `applyMonsterDeath`
 *   (`TREASURE_DropItem` draw).
 */
export function resolveMercMissileCollision113c(
  host: GameInstanceHost,
  missile: InternalMissileRecord,
  target: InternalMonsterRecord,
): void {
  const mercId = missile.mercOwnerUnitId
  if (mercId === undefined) return
  const merc = host.mercenaries.get(mercId)
  const owner = host.players.get(missile.ownerId)
  if (merc === undefined || owner === undefined || target.dead) return

  const mercSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${merc.unitId}`)
  const missileSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.missile}:${missile.unitId}`)
  const targetSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${target.unitId}`)
  if (mercSeed === undefined || missileSeed === undefined) {
    throw new Error(`resolveMercMissileCollision113c: missing merc or missile seed`)
  }

  const mercCtx = host.mercCombatContext(merc)
  const defCtx = host.monsterCombatContext(target)

  // 1. `SUNITDMG_RollToHit` (`0x6FCFDE90`): 1 `mercSeed` draw (`rollLimited(100)`).
  let skillToHitPct = 0
  if (missile.skillId > 0) {
    const calcCtx = buildMercSkillCalcCtx113c(host, merc, missile.skillId, missile.mercSlvl113c ?? 1)
    if (calcCtx !== null) {
      skillToHitPct = evaluateCalc('toht', calcCtx)
    }
  }
  const baseAr = Math.trunc(mercCtx.statList.getAccruedStat('tohit'))
  const arPct = Math.trunc(mercCtx.statList.getAccruedStat('item_tohit_percent')) + skillToHitPct
  const effAr = Math.max(0, Math.trunc((baseAr * (100 + arPct)) / 100))
  const effAc = Math.max(0, Math.trunc(defCtx.statList.getAccruedStat('armorclass')))
  const alvl = Math.max(1, merc.level)
  const dlvl = Math.max(1, target.level)
  const denom = effAr + effAc
  const rawCth =
    denom > 0 ? Math.trunc((2 * Math.trunc((effAr * 100) / denom) * alvl) / (alvl + dlvl)) : 100
  const cth = Math.max(5, Math.min(95, rawCth))
  if (rollLimitedSeed113c(mercSeed, 100) >= cth) {
    return
  }

  // 2. Monster shield block check (`target.toBlock` is already gated by `canMonsterBlock113c` at spawn).
  const toBlock = Math.trunc(defCtx.statList.getAccruedStat('toblock'))
  if (toBlock > 0 && target.states.has(25) === false) {
    const clampedBlock = Math.min(75, toBlock)
    if (targetSeed !== undefined && rollLimitedSeed113c(targetSeed, 100) < clampedBlock) {
      return
    }
  }

  // 3. Roll physical & elemental damage on `missileSeed` (`0x6FC59B40` / `0x6FDBCA50`).
  let rawPhys256 = 0
  const pMin = missile.mercPhysMin256 ?? 0
  const pMax = missile.mercPhysMax256 ?? 0
  if (pMax > 0) {
    const rolledBase = pMax > pMin ? pMin + rollLimitedSeed113c(missileSeed, pMax - pMin) : pMin
    const edPct = missile.mercPhysEdPct ?? 0
    rawPhys256 = Math.max(0, Math.trunc((rolledBase * (100 + edPct)) / 100))
    if (missile.mercDeadlyStrike) rawPhys256 *= 2
  }

  let rawFire256 = 0
  let rawCold256 = 0
  let rawMag256 = 0
  const eMin = missile.mercElemMin256 ?? 0
  const eMax = missile.mercElemMax256 ?? 0
  if (missile.mercElemType !== undefined && eMax > 0) {
    const rolledElem = eMax > eMin ? eMin + rollLimitedSeed113c(missileSeed, eMax - eMin) : eMin
    if (missile.mercElemType === 'cold') rawCold256 = rolledElem
    else if (missile.mercElemType === 'fire') rawFire256 = rolledElem
    else rawMag256 = rolledElem
  }

  // `SrvDmgFunc = 1` (`#11 Cold Arrow` / `#7 Fire Arrow` `calc1`% physical -> elemental conversion).
  if (missile.mercSrvDmgFunc113c === 1 && rawPhys256 > 0 && missile.skillId > 0) {
    const calcCtx = buildMercSkillCalcCtx113c(host, merc, missile.skillId, missile.mercSlvl113c ?? 1)
    const sk = host.registry.getSkillById(missile.skillId)
    const convPct = calcCtx !== null && sk !== undefined ? Math.min(100, Math.max(0, evaluateCalc(sk.calc1, calcCtx))) : 0
    if (convPct > 0) {
      const converted = Math.trunc((rawPhys256 * convPct) / 100)
      rawPhys256 -= converted
      if (missile.mercElemType === 'cold') rawCold256 += converted
      else if (missile.mercElemType === 'fire') rawFire256 += converted
    }
  }

  // 4. Defender resistances (`SUNITDMG_ApplyResistances` `0x6FCFB3C0`).
  const applyRes = (dmg256: number, statName: string): number => {
    if (dmg256 <= 0) return 0
    const res = Math.min(100, Math.max(-100, Math.trunc(defCtx.statList.getAccruedStat(statName))))
    if (res >= 100) return 0
    return Math.max(0, dmg256 - Math.trunc((dmg256 * res) / 100))
  }
  const finalPhys256 = applyRes(rawPhys256, 'damageresist')
  const finalFire256 = applyRes(rawFire256, 'fireresist')
  const finalCold256 = applyRes(rawCold256, 'coldresist')
  const finalMag256 = applyRes(rawMag256, 'magicresist')

  let finalColdLen = 0
  if ((missile.mercColdLenFrames ?? 0) > 0 && target.coldEffect !== 0) {
    const coldRes = Math.min(100, Math.max(-100, Math.trunc(defCtx.statList.getAccruedStat('coldresist'))))
    if (coldRes < 100) {
      const resScaledLen = Math.max(0, (missile.mercColdLenFrames ?? 0) - Math.trunc(((missile.mercColdLenFrames ?? 0) * coldRes) / 100))
      const div = Math.max(1, difficultyMonsterColdDivisor(host.difficulty))
      finalColdLen = Math.trunc(resScaledLen / div)
    }
  }

  const totalDmg256 = finalPhys256 + finalFire256 + finalCold256 + finalMag256
  const hpBefore256 = target.hp256 ?? target.hp * FIXED_ONE
  let hpAfter256 = hpBefore256 - totalDmg256
  if (hpAfter256 < FIXED_ONE) hpAfter256 = 0
  const willDie = hpAfter256 <= 0

  // 5. Emit `SUNITDMG_ApplyDamage` trace event (`0x6FCFC0B0`).
  const hitFlags = (0x20 | (finalPhys256 > 0 || rawPhys256 > 0 ? 0x02 : 0)) >>> 0
  const resultFlags = (0x01 | (totalDmg256 > 0 ? 0x04 : 0) | (missile.mercDeadlyStrike && finalPhys256 > 0 ? 0x2000 : 0)) >>> 0
  emitSUnitDmgTraceEvent113c({
    att: [UNIT_TYPE_113C.monster, merc.unitId],
    def: [UNIT_TYPE_113C.monster, target.unitId],
    hp: [hpBefore256 >>> 0, hpBefore256 >>> 0],
    ret: totalDmg256 >>> 0,
    raw: [
      hitFlags,
      resultFlags,
      finalPhys256 >>> 0,
      0,
      finalFire256 >>> 0,
      finalPhys256 > 0 ? 2 : 0,
      0,
      0,
      finalMag256 >>> 0,
      finalCold256 >>> 0,
      0,
      0,
      finalColdLen >>> 0,
      0,
      0,
      0,
      0,
      0,
    ],
  })

  if (totalDmg256 <= 0 && finalColdLen <= 0) return

  if (target.aiAwake === false) {
    target.nextAiFrame = Math.max(target.nextAiFrame, host.currentFrame + 1)
  }
  target.aiAwake = true
  target.lastDamagedFrame113c = host.currentFrame
  target.lastHitByMerc = true
  target.hp256 = hpAfter256
  target.hp = Math.ceil(hpAfter256 / FIXED_ONE)
  target.hp256Whole = target.hp

  if (willDie) {
    // `SUNITDMG_ApplyColdEffect` (`0x6FCFD1F0`): 20% shatter roll on `targetSeed` BEFORE `TREASURE_DropItem`!
    const didShatter =
      finalColdLen > 0 &&
      target.coldEffect !== 0 &&
      targetSeed !== undefined &&
      rollLimitedSeed113c(targetSeed, 100) < 20
    host.applyMonsterDeath(target, owner, didShatter ? 'cold' : 'phys', 'merc')
    return
  }
  armMonsterEvent3AfterDamage113c(host, target)

  if (finalColdLen > 0) {
    void difficultyMonsterFreezeDivisor
    host.applyMonsterState(target.unitId, 11, finalColdLen)
  }
  host.maybeEnterMonsterHitRecovery(target, Math.max(1, Math.floor(totalDmg256 / FIXED_ONE)), {
    dmg256: totalDmg256,
  })
}
