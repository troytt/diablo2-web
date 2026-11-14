/**
 * GameInstance Subsystem: Mercenary Auras, Hiring, Weapon Riders, CTC Procs, Missiles & AI (`src/server/engine/game-instance/mercenaries.ts`).
 */

import { hirelingExpThreshold, MAX_MERCENARY_LEVEL_113C } from '../../../common/progression/experience-113c.ts'
import { ALL_CASTER_AURA_STATE_IDS_113C, FRIENDLY_AURA_TARGET_STATE_IDS_113C } from '../../../common/skills/paladin-auras.ts'
import { computeMercResurrectCost113c, resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import type { ServerEvent, ItemStat } from '../../../netproto/index.ts'
import { HIREABLE_AI_113C } from '../../ai/monster-ai.ts'
import { computeMercenaryWeaponProfile113c, extractMercenaryStrikeProcs113c, scaleMercenaryBossDamage113c, stepMercenaryAiAndChooseAction113c } from '../../ai/mercenary-ai.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { rollItemKnockback113c, type CombatUnitContext } from '../combat-pipeline.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { aggregateCtcProcs113c, isCtcRadialNovaSkill113c } from '../../skills/passives-procs-113c.ts'
import { AuraScanner, type CorpseContext } from '../aura-scanner.ts'
import { isWithinAuraRange, passesAuraFilter } from '../../../common/skills/aura-filter.ts'
import { evaluateSkill113c } from '../../skills/registry.ts'
import type { GameInstanceHost } from './host.ts'
import { stepOracleHireableMerc113c } from './hireable-ai-113c.ts'
import type { HireMercenarySpec, InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord, MercAuraRuntime, MercAuraSourceEntry, ServerItemEntry, ServerMercenaryState } from './types.ts'
import { MERC_AURA_TO_SKILL_ID, MERC_AURA_TO_STATE_ID, TOWN_AREAS, collectItemStats, normalizeMissileElement, UNIT_TYPE_113C } from './constants-and-helpers.ts'


/**
 * Resolve all 1.13c aura sources active on a mercenary:
 * 1. Innate Act 2 aura (`activeAura` -> `MERC_AURA_TO_SKILL_ID`, `slvl` from `Hireling.txt` + `+allskills`).
 * 2. Item-granted auras (`STAT_ITEM_AURA` = 151 on `merc.equipment`, stacking `slvl` across items).
 */
function resolveMercenaryAuraSources113c(this: GameInstanceHost, 
  merc: InternalMercenaryRecord,
  activeAuraOverride?: string | undefined,
): {
  readonly skillId: number
  readonly slvl: number
  readonly isItemAura: boolean
  readonly radiusSubtiles: number
  readonly casterStateId: number | undefined
  readonly targetStateId: number | undefined
}[] {
  const out: {
    readonly skillId: number
    readonly slvl: number
    readonly isItemAura: boolean
    readonly radiusSubtiles: number
    readonly casterStateId: number | undefined
    readonly targetStateId: number | undefined
  }[] = []
  let allSkillsBonus = 0
  const itemAurasBySkill = new Map<number, number>()
  for (const item of merc.equipment ?? []) {
    for (const stat of collectItemStats(item)) {
      if (stat.statId === 127 && stat.value > 0) {
        allSkillsBonus += stat.value
      } else if (stat.statId === 151 && stat.param > 0 && stat.value > 0) {
        itemAurasBySkill.set(stat.param, (itemAurasBySkill.get(stat.param) ?? 0) + stat.value)
      }
    }
  }

  const auraName = activeAuraOverride ?? merc.activeAura
  if (auraName) {
    const auraKey = auraName.trim().toLowerCase()
    const skillId = MERC_AURA_TO_SKILL_ID[auraKey]
    if (skillId !== undefined) {
      const hireStats = resolveHirelingStatsAtLevel(
        merc.subType,
        merc.act,
        merc.difficulty,
        merc.level,
        true,
      )
      const matchingSkill = hireStats?.skills.find(
        (s) =>
          s.skillId === skillId ||
          MERC_AURA_TO_SKILL_ID[s.skillName.trim().toLowerCase()] === skillId,
      )
      const baseSlvl = matchingSkill?.effectiveLevel ?? Math.max(1, Math.min(20, Math.floor(merc.level / 3)))
      const slvl = Math.max(1, baseSlvl + allSkillsBonus)
      const skill = this.registry.getSkillById(skillId)
      const casterStateId = skill?.auraState
        ? this.registry.getStateByName(skill.auraState)?.id
        : MERC_AURA_TO_STATE_ID[auraKey]
      const targetStateId = skill?.auraTgtState
        ? this.registry.getStateByName(skill.auraTgtState)?.id
        : undefined
      out.push({
        skillId,
        slvl,
        isItemAura: false,
        radiusSubtiles: this.auraRangeSubtiles(skillId, slvl),
        casterStateId,
        targetStateId,
      })
    }
  }

  for (const [skillId, slvl] of itemAurasBySkill) {
    const skill = this.registry.getSkillById(skillId)
    if (!skill || !skill.aura || !skill.auraState || skill.passive) continue
    const itemSlvl = Math.max(1, slvl)
    const existingIdx = out.findIndex((s) => s.skillId === skillId)
    if (existingIdx !== -1) {
      const existing = out[existingIdx]!
      if (itemSlvl > existing.slvl) {
        out[existingIdx] = {
          ...existing,
          slvl: itemSlvl,
          isItemAura: true,
          radiusSubtiles: this.auraRangeSubtiles(skillId, itemSlvl),
        }
      }
      continue
    }
    const casterStateId = skill.auraState
      ? this.registry.getStateByName(skill.auraState)?.id
      : undefined
    const targetStateId = skill.auraTgtState
      ? this.registry.getStateByName(skill.auraTgtState)?.id
      : undefined
    out.push({
      skillId,
      slvl: itemSlvl,
      isItemAura: true,
      radiusSubtiles: this.auraRangeSubtiles(skillId, itemSlvl),
      casterStateId,
      targetStateId,
    })
  }
  return out
}



/** Stop a mercenary's active / item auras and clear its caster aura states. */
function stopMercenaryAura(this: GameInstanceHost, merc: InternalMercenaryRecord): void {
  const runtime = this.mercAuraScanners.get(merc.unitId)
  this.mercAuraScanners.delete(merc.unitId)
  const mercCombat = this.mercCombat.get(merc.unitId)
  if (runtime !== undefined) {
    for (const entry of runtime.sources) {
      if (entry.casterStateId !== undefined) {
        this.clearUnitState(
          merc.states,
          merc.stateTimers,
          'monster',
          merc.unitId,
          merc.areaId,
          entry.casterStateId,
        )
        mercCombat?.stateBus.removeState(entry.casterStateId)
      }
    }
  }
  for (const stateId of ALL_CASTER_AURA_STATE_IDS_113C) {
    if (merc.states.has(stateId)) {
      this.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, stateId)
    }
    mercCombat?.stateBus.removeState(stateId)
  }
}



function syncMercenaryOwnerAura(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  activeAura: string | undefined,
  mercOverride?: InternalMercenaryRecord | undefined,
  forcePulse = false,
): void {
  const merc =
    mercOverride ??
    [...this.mercenaries.values()].find((m) => m.ownerPlayerId === owner.unitId && m.alive)
  if (merc === undefined || !merc.alive || merc.hp <= 0) {
    if (merc !== undefined && this.mercAuraScanners.has(merc.unitId)) {
      this.stopMercenaryAura(merc)
    }
    return
  }

  const desiredSpecs = this.resolveMercenaryAuraSources113c(merc, activeAura)
  if (desiredSpecs.length === 0) {
    if (this.mercAuraScanners.has(merc.unitId)) {
      this.stopMercenaryAura(merc)
    }
    return
  }

  const signature = desiredSpecs
    .map((s) => `${s.skillId}:${s.slvl}:${s.isItemAura ? 1 : 0}`)
    .join(',')
  let runtime = this.mercAuraScanners.get(merc.unitId)
  const signatureChanged = runtime === undefined || runtime.signature !== signature
  if (signatureChanged) {
    const nextCasterIds = new Set<number>()
    for (const spec of desiredSpecs) {
      if (spec.casterStateId !== undefined) nextCasterIds.add(spec.casterStateId)
    }
    if (runtime !== undefined) {
      for (const prev of runtime.sources) {
        if (prev.casterStateId !== undefined && !nextCasterIds.has(prev.casterStateId)) {
          this.clearUnitState(
            merc.states,
            merc.stateTimers,
            'monster',
            merc.unitId,
            merc.areaId,
            prev.casterStateId,
          )
          this.mercCombat.get(merc.unitId)?.stateBus.removeState(prev.casterStateId)
        }
      }
    }
    const scanner = new AuraScanner(this.registry, (this.currentMapSeed ^ merc.unitId) >>> 0)
    const mercCtx = this.mercCombatContext(merc)
    const sources: MercAuraSourceEntry[] = []
    const pulseTick = Math.max(1, this.currentFrame)
    for (const spec of desiredSpecs) {
      const source = scanner.setActiveAura(mercCtx, spec.skillId, spec.slvl, pulseTick)
      if (source === null) continue
      if (spec.casterStateId !== undefined) {
        this.applyPersistentUnitState(
          merc.states,
          merc.stateTimers,
          'monster',
          merc.unitId,
          merc.areaId,
          spec.casterStateId,
        )
      }
      sources.push({
        ...spec,
        source,
      })
    }
    runtime = {
      scanner,
      signature,
      sources,
      needsInitialPulse: true,
    }
    this.mercAuraScanners.set(merc.unitId, runtime)
  } else if (runtime !== undefined) {
    for (const entry of runtime.sources) {
      if (entry.casterStateId !== undefined && !merc.states.has(entry.casterStateId)) {
        this.applyPersistentUnitState(
          merc.states,
          merc.stateTimers,
          'monster',
          merc.unitId,
          merc.areaId,
          entry.casterStateId,
        )
      }
    }
  }

  if (forcePulse && runtime !== undefined) {
    runtime.needsInitialPulse = true
    this.pulseMercenaryAuraRuntime113c(merc, owner, runtime, signatureChanged || forcePulse)
  }
}



/** Execute one mercenary's `AuraScanner` tick (plus immediate entry pulses for newly-in-range units). */
function pulseMercenaryAuraRuntime113c(this: GameInstanceHost, 
  merc: InternalMercenaryRecord,
  owner: InternalPlayerRecord,
  runtime: MercAuraRuntime,
  forceRefresh = false,
): void {
  if (runtime.sources.length === 0) return
  runtime.scanner.syncCasterPosition(merc.x, merc.y)
  const maxRadius = runtime.sources.reduce((acc, s) => Math.max(acc, s.radiusSubtiles), 0)
  const inRange = (x: number, y: number) => isWithinAuraRange(x - merc.x, y - merc.y, maxRadius)
  const targets = this.collectFriendlyAuraAllies113c({
    ownerPlayerId: owner.unitId,
    areaId: merc.areaId,
    originX: merc.x,
    originY: merc.y,
    maxRadius,
    selfMerc: merc,
  })
  const enemyRecords = [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      !m.isNpc &&
      m.isKillable &&
      m.align === 0 &&
      !this.isMonsterConverted(m) &&
      m.areaId === merc.areaId &&
      inRange(m.x, m.y),
  )
  const corpseRecords = [...this.monsters.values()].filter(
    (m) => m.dead && !m.shattered && !m.isNpc && m.areaId === merc.areaId && inRange(m.x, m.y),
  )
  const enemies = enemyRecords.map((m) => this.monsterCombatContext(m))
  const pvpAuraEnemies = this.buildHostileAuraPvpEnemies113c(owner.unitId, merc.areaId, inRange)
  const allAuraEnemies = [...enemies, ...pvpAuraEnemies.map((e) => e.ctx)]
  const corpses: CorpseContext[] = corpseRecords.map((m) => ({
    id: String(m.unitId),
    consumed: false,
    x: m.x,
    y: m.y,
  }))
  const auraEnv = {
    isTown: TOWN_AREAS.has(merc.areaId),
    hasLineOfSight: (src: CombatUnitContext, tgt: { x?: number; y?: number }) =>
      src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
        ? false
        : this.isMonsterStepWalkable(merc.areaId, src.x, src.y, tgt.x, tgt.y, true),
    rng: this.rng,
  }
  const pulseTick = Math.max(1, this.currentFrame)
  if (runtime.needsInitialPulse) {
    runtime.needsInitialPulse = false
    for (const entry of runtime.sources) {
      this.applyAuraPulseSideEffects113c(runtime.scanner.pulseAura(entry.source, pulseTick, targets.allAllies, allAuraEnemies, corpses, auraEnv), merc.x, merc.y, merc.areaId)
    }
  } else {
    this.applyAuraPulseSideEffects113c(runtime.scanner.tick(this.currentFrame, targets.allAllies, allAuraEnemies, corpses, auraEnv), merc.x, merc.y, merc.areaId)
    for (const entry of runtime.sources) {
      if (entry.targetStateId === undefined) continue
      const tgtState = entry.targetStateId
      if (entry.skillId === 114 || entry.skillId === 123) {
        const unpulsedMonsters = enemies.filter((e, idx) => {
          const m = enemyRecords[idx]!
          if (!isWithinAuraRange(m.x - merc.x, m.y - merc.y, entry.radiusSubtiles)) return false
          if (m.isPrimeEvil || (entry.skillId === 114 && m.coldEffect === 0)) return false
          if (auraEnv.isTown) return false
          return !e.stateBus.hasState(tgtState)
        })
        const unpulsedPvp = pvpAuraEnemies
          .filter((pe) => {
            if (auraEnv.isTown || pe.ctx.x === undefined || pe.ctx.y === undefined) return false
            if (!isWithinAuraRange(pe.ctx.x - merc.x, pe.ctx.y - merc.y, entry.radiusSubtiles)) return false
            return !pe.ctx.stateBus.hasState(tgtState)
          })
          .map((pe) => pe.ctx)
        const unpulsedEnemies = [...unpulsedMonsters, ...unpulsedPvp]
        if (unpulsedEnemies.length > 0) {
          this.applyAuraPulseSideEffects113c(runtime.scanner.pulseAura(entry.source, pulseTick, [], unpulsedEnemies, [], auraEnv), merc.x, merc.y, merc.areaId)
        }
      } else if (FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(tgtState)) {
        const unpulsedAllies = targets.allAllies.filter((a) => {
          if (a.id === `merc_${merc.unitId}` || a.x === undefined || a.y === undefined) return false
          if (!isWithinAuraRange(a.x - merc.x, a.y - merc.y, entry.radiusSubtiles)) return false
          if (a.stateBus.hasState(tgtState)) return false
          return passesAuraFilter(entry.source.skill.auraFilter, {
            kind: a.unitType === 'player' ? 'player' : 'monster',
            relation: 'ally',
            dead: a.statList.getHp256() <= 0,
            inTown: auraEnv.isTown,
          })
        })
        if (unpulsedAllies.length > 0) {
          runtime.scanner.pulseAura(entry.source, pulseTick, unpulsedAllies, [], [], auraEnv)
        }
      }
    }
  }

  const casterStateIds = this.getMercOwnCasterAuraStates113c(merc.unitId)
  this.syncFriendlyAuraTargets113c(targets, merc.areaId, {
    skipSelfMercId: merc.unitId,
    selfMercCasterStates: casterStateIds,
    forceRefresh,
  })
  enemyRecords.forEach((m, i) => {
    const enemyCtx = enemies[i]!
    this.syncAuraEnemyStates113c(m, enemyCtx)
    const hpAfter = Math.max(0, Math.ceil(enemyCtx.statList.getHp256() / FIXED_ONE))
    const dealt = m.hp - hpAfter
    if (dealt > 0) {
      const dmgSkillId =
        runtime.sources.find(
          (s) => s.skillId === 114 || s.skillId === 102 || s.skillId === 118 || s.skillId === 119,
        )?.skillId ??
        runtime.sources[0]?.skillId ??
        0
      this.finishMonsterDamage(
        owner,
        m,
        dealt,
        dmgSkillId,
        this.resolveSkillDamageChannel(dmgSkillId),
        undefined,
        undefined,
        true,
      )
    }
  })
  this.syncHostileAuraPvpEnemies113c(pvpAuraEnemies, 'player_pet', merc.unitId)
  corpseRecords.forEach((m, i) => {
    if (corpses[i]!.consumed) m.shattered = true
  })
}



/** Step every alive mercenary's innate + item-granted (`STAT_ITEM_AURA`) `AuraScanner` pulses. */
function stepMercenaryAuras(this: GameInstanceHost): void {
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || merc.hp <= 0) {
      if (this.mercAuraScanners.has(merc.unitId)) {
        this.stopMercenaryAura(merc)
      }
      continue
    }
    const owner = this.players.get(merc.ownerPlayerId)
    if (!owner || owner.dead) continue
    this.syncMercenaryOwnerAura(owner, merc.activeAura, merc, false)
    const runtime = this.mercAuraScanners.get(merc.unitId)
    if (runtime !== undefined) {
      this.pulseMercenaryAuraRuntime113c(merc, owner, runtime)
    }
  }
}



function hireMercenary(this: GameInstanceHost, ownerPlayerId: number, spec: HireMercenarySpec = {}): number {
  const owner = this.players.get(ownerPlayerId)
  for (const [mId, existing] of this.mercenaries.entries()) {
    if (existing.ownerPlayerId === ownerPlayerId) {
      this.stopMercenaryAura(existing)
      this.mercCombat.delete(mId)
      this.broadcastToArea(existing.areaId, {
        type: 'UnitRemove',
        unitType: 'monster',
        id: mId,
        unitId: mId,
      })
      this.mercenaries.delete(mId)
    }
  }

  const act: 1 | 2 | 3 | 5 = spec.act ?? 2
  const level = Math.max(1, Math.min(MAX_MERCENARY_LEVEL_113C, Math.floor(spec.level ?? owner?.level ?? 1)))
  const difficulty: 1 | 2 | 3 =
    spec.difficulty ?? ((this.difficulty + 1) as 1 | 2 | 3)
  const defaultSubType =
    act === 1
      ? difficulty === 1
        ? 0
        : difficulty === 2
          ? 2
          : 4
      : act === 2
        ? difficulty === 1
          ? 7
          : difficulty === 2
            ? 11
            : 13
        : act === 3
          ? difficulty === 1
            ? 16
            : difficulty === 2
              ? 19
              : 22
          : difficulty === 1
            ? 24
            : difficulty === 2
              ? 26
              : 28
  const requestedSubType = spec.subType ?? defaultSubType
  const candidateStats = resolveHirelingStatsAtLevel(requestedSubType, act, difficulty, level, true)
  const stats =
    candidateStats && candidateStats.act === act
      ? candidateStats
      : resolveHirelingStatsAtLevel(defaultSubType, act, difficulty, level, true)
  if (!stats || stats.act !== act) {
    throw new Error(
      `hireMercenary: missing Hireling.txt record for act=${act}, difficulty=${difficulty}, subType=${requestedSubType}`,
    )
  }
  const subType = stats.record.subTypeId

  const unitId = this.allocateUnitId(UNIT_TYPE_113C.monster)
  const maxHp = Math.max(1, spec.maxHp ?? spec.hp ?? stats.hp)
  const hp = Math.max(1, Math.min(maxHp, spec.hp ?? maxHp))
  const damage = this.rng.range(stats.minDmg, Math.max(stats.minDmg, stats.maxDmg))
  const auraSkill = stats.skills.find(
    (s) => s.mode === 1 && s.effectiveLevel > 0,
  )
  const activeAura = spec.activeAura ?? auraSkill?.skillName
  const areaId = owner?.areaId ?? this.defaultAreaId ?? 1
  const x = spec.x ?? (owner ? owner.x + 1 : 128)
  const y = spec.y ?? (owner ? owner.y + 1 : 128)
  const name = spec.name ?? stats.record.hireling ?? `Mercenary_${unitId}`
  const classId = stats.classId

  const isDead = spec.dead === true
  const expPerLvl = stats?.record.expPerLvl ?? 110
  const minLevelExp = hirelingExpThreshold(level, expPerLvl)
  const initialExp =
    spec.experience !== undefined && spec.experience >= 0
      ? Math.max(Math.floor(spec.experience), minLevelExp)
      : minLevelExp
  const record: InternalMercenaryRecord = {
    unitId,
    ownerPlayerId,
    act,
    subType,
    classId,
    level,
    difficulty,
    name,
    areaId,
    x,
    y,
    hp: isDead ? 0 : hp,
    maxHp,
    damage,
    ar: stats.ar,
    defense: stats.defense,
    resist: stats.resist,
    reach:
      act === 1
        ? HIREABLE_AI_113C.ACT1_RANGED_REACH_SUBTILES
        : act === 3
          ? HIREABLE_AI_113C.ACT3_RANGED_REACH_SUBTILES
          : act === 2
            ? HIREABLE_AI_113C.ACT2_MELEE_REACH_SUBTILES
            : HIREABLE_AI_113C.ACT5_MELEE_REACH_SUBTILES,
    aggroRadius: HIREABLE_AI_113C.AGGRO_SUBTILES,
    speed:
      act === 5
        ? HIREABLE_AI_113C.ACT5_VELOCITY
        : HIREABLE_AI_113C.ACT123_VELOCITY,
    cooldown: 0,
    cooldownTicks: HIREABLE_AI_113C.AI_DELAY_FRAMES,
    activeAura,
    state: isDead ? 'dead' : 'idle',
    alive: !isDead,
    experience: initialExp,
    expPerLvl,
    equipment: [],
    states: new Set<number>(),
    stateTimers: new Map<number, number>(),
  }
  this.mercenaries.set(unitId, record)
  if (isDead) {
    // D2Game.dll 0x6fcb75a8: send S2C 0x9B MercReviveCost(nameId, cost) on game join with a dead hireling.
    this.emitToPlayer(ownerPlayerId, {
      type: 'Merc',
      kind: 'stat',
      nameId: subType,
      value: computeMercResurrectCost113c(level),
    })
    return unitId
  }

  this.broadcastToArea(areaId, {
    type: 'UnitAssign',
    unitType: 'monster',
    unitId,
    classId,
    name,
    x,
    y,
    areaId,
    unit: {
      unitType: 1,
      id: unitId,
      classId,
      name,
      x,
      y,
      mode: 1,
      lifePct: 128,
    },
  })
  this.broadcastToArea(areaId, {
    type: 'Merc',
    kind: 'assign',
    mercId: unitId,
    ownerId: ownerPlayerId,
    classId,
  })
  // D2Game.dll 0x6fc6906a: clear any prior S2C 0x9B dead-hireling record (`nameId = 0xFFFF, cost = 0`) upon hiring.
  this.emitToPlayer(ownerPlayerId, {
    type: 'Merc',
    kind: 'stat',
    nameId: 0xffff,
    value: 0,
  })
  this.broadcastToArea(areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId,
    statId: 12,
    value: Math.max(1, Math.floor(level)),
  })
  this.broadcastToArea(areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId,
    statId: 13,
    value: Math.max(0, Math.floor(initialExp)),
  })
  this.broadcastAllyHp(areaId, unitId, hp)
  if (owner) {
    this.syncMercenaryOwnerAura(owner, activeAura, record, true)
  }
  return unitId
}



function getMercenaryForOwner(this: GameInstanceHost, 
  ownerPlayerId: number,
): ServerMercenaryState | undefined {
  for (const m of this.mercenaries.values()) {
    if (m.ownerPlayerId === ownerPlayerId) {
      return {
        unitId: m.unitId,
        ownerPlayerId: m.ownerPlayerId,
        act: m.act,
        subType: m.subType,
        classId: m.classId,
        level: m.level,
        difficulty: m.difficulty,
        name: m.name,
        areaId: m.areaId,
        x: m.x,
        y: m.y,
        hp: m.hp,
        maxHp: m.maxHp,
        damage: m.damage,
        activeAura: m.activeAura,
        state: m.state,
        alive: m.alive,
        experience: m.experience,
        expPerLvl: m.expPerLvl,
        states: m.states,
      }
    }
  }
  return undefined
}



function getMercenaryState(this: GameInstanceHost, 
  unitIdOrOwnerId: number,
): ServerMercenaryState | undefined {
  const m = this.mercenaries.get(unitIdOrOwnerId)
  if (m) {
    return {
      unitId: m.unitId,
      ownerPlayerId: m.ownerPlayerId,
      act: m.act,
      subType: m.subType,
      classId: m.classId,
      level: m.level,
      difficulty: m.difficulty,
      name: m.name,
      areaId: m.areaId,
      x: m.x,
      y: m.y,
      hp: m.hp,
      maxHp: m.maxHp,
      damage: m.damage,
      activeAura: m.activeAura,
      state: m.state,
      alive: m.alive,
      experience: m.experience,
      expPerLvl: m.expPerLvl,
      states: m.states,
    }
  }
  return this.getMercenaryForOwner(unitIdOrOwnerId)
}



function getMercenaryOrPetArea(this: GameInstanceHost, unitId: number): number | undefined {
  const merc = this.mercenaries.get(unitId)
  if (merc) return merc.areaId
  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    for (const pet of mgr.getActivePets()) {
      const mappedId =
        this.petUnitIds.get(pet.uid) ??
        (pet as unknown as { unitId?: number }).unitId
      if (mappedId === unitId) {
        return this.players.get(ownerId)?.areaId ?? this.defaultAreaId
      }
    }
  }
  return undefined
}



function getMonsterOrAllyArea(this: GameInstanceHost, unitId: number): number | undefined {
  const m = this.monsters.get(unitId)
  if (m) return m.areaId
  return this.getMercenaryOrPetArea(unitId)
}



function collectServerItemEntryStats113c(this: GameInstanceHost, item: ServerItemEntry): ItemStat[] {
  const out = collectItemStats(item)
  const rawHasStats =
    ((item.rawItemData?.stats?.length ?? 0) > 0) ||
    ((item.rawItemData?.runewordStats?.length ?? 0) > 0)
  if (!rawHasStats && item.rawItemData !== undefined && item.stats && item.stats.size > 0) {
    for (const [statId, value] of item.stats) {
      out.push({ statId, param: 0, value })
    }
  }
  return out
}



function applyMercElementalWeaponRiders113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  merc: InternalMercenaryRecord,
  target: InternalMonsterRecord,
  attackKind: 'melee' | 'missile',
): void {
  if (target.dead) return
  const fireMin = this.sumMercItemStat(merc, 48)
  const fireMax = Math.max(fireMin, this.sumMercItemStat(merc, 49))
  if (fireMax > 0 && !target.dead) {
    const dmg = this.rng.range(Math.max(1, fireMin), fireMax)
    this.applyDamageToMonster(owner, target, dmg, 0, 'fire', merc, {
      attackKind,
      autoHit: true,
      unblockable: true,
    })
  }
  const ltngMin = this.sumMercItemStat(merc, 50)
  const ltngMax = Math.max(ltngMin, this.sumMercItemStat(merc, 51))
  if (ltngMax > 0 && !target.dead) {
    const dmg = this.rng.range(Math.max(1, ltngMin), ltngMax)
    this.applyDamageToMonster(owner, target, dmg, 0, 'ltng', merc, {
      attackKind,
      autoHit: true,
      unblockable: true,
    })
  }
  const magMin = this.sumMercItemStat(merc, 52)
  const magMax = Math.max(magMin, this.sumMercItemStat(merc, 53))
  if (magMax > 0 && !target.dead) {
    const dmg = this.rng.range(Math.max(1, magMin), magMax)
    this.applyDamageToMonster(owner, target, dmg, 0, 'mag', merc, {
      attackKind,
      autoHit: true,
      unblockable: true,
    })
  }
  const coldMin = this.sumMercItemStat(merc, 54)
  const coldMax = Math.max(coldMin, this.sumMercItemStat(merc, 55))
  const coldLen = Math.max(25, this.sumMercItemStat(merc, 56))
  if (coldMax > 0 && !target.dead) {
    const dmg = this.rng.range(Math.max(1, coldMin), coldMax)
    this.applyDamageToMonster(owner, target, dmg, 0, 'cold', merc, {
      attackKind,
      autoHit: true,
      unblockable: true,
      elemDurationFrames: coldLen,
    })
  }
  const poisMin = this.sumMercItemStat(merc, 57)
  const poisMax = Math.max(poisMin, this.sumMercItemStat(merc, 58))
  const poisLen = Math.max(25, this.sumMercItemStat(merc, 59) || 50)
  if (poisMax > 0 && !target.dead) {
    const rawRate256 = this.rng.range(Math.max(1, poisMin), poisMax)
    const scaledRate256 =
      target.isPrimeEvil || this.actBossQuestId(target.defId, target.hcIdx) !== undefined
        ? scaleMercenaryBossDamage113c(rawRate256, this.difficulty)
        : rawRate256
    this.applyMonsterPoisonDot(owner, target, scaledRate256, poisLen, 0, 'merc')
  }
}



function triggerMercCtcProcs113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  merc: InternalMercenaryRecord,
  target: InternalMonsterRecord | undefined,
  triggerStatId: 195 | 196 | 198 | 201,
): void {
  const allStats: ItemStat[] = []
  for (const eq of merc.equipment) {
    if (eq.identified === false || eq.rawItemData?.identified === false) continue
    if (
      (eq as { readonly broken?: boolean }).broken === true ||
      eq.rawItemData?.broken === true
    ) {
      continue
    }
    allStats.push(...this.collectServerItemEntryStats113c(eq))
  }
  const procs =
    triggerStatId === 201 || triggerStatId === 196
      ? aggregateCtcProcs113c(allStats, triggerStatId)
      : extractMercenaryStrikeProcs113c(allStats)
  for (const proc of procs) {
    if (proc.statId !== triggerStatId) continue
    if (proc.chancePct < 100 && this.rng.rand(100) >= proc.chancePct) continue
    const procSkill = this.registry.getSkillById(proc.skillId)
    if (!procSkill) continue
    const mercCtx = this.mercCombatContext(merc)
    const ev = evaluateSkill113c({
      registry: this.registry,
      skill: procSkill,
      slvl: proc.slvl,
      blvl: proc.slvl,
      statList: mercCtx.statList,
      stateBus: mercCtx.stateBus,
      difficulty: this.difficulty,
    })
    if (procSkill.auraState && procSkill.srcDam <= 0) {
      const stateId = this.registry.getStateByName(procSkill.auraState)?.id
      if (stateId !== undefined) {
        if (stateId === 157 || stateId === 159) {
          const oppositeStateId = stateId === 157 ? 159 : 157
          const oppositeStateName = stateId === 157 ? 'fade' : 'quickness'
          if (merc.states.has(oppositeStateId)) {
            this.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, oppositeStateId)
          }
          mercCtx.stateBus.removeState(oppositeStateId)
          mercCtx.stateBus.removeState(oppositeStateName)
        }
        const dur = Math.max(0, ev.durationFrames)
        const stateStats = this.evaluateSkillStateStats(procSkill, proc.slvl, mercCtx.statList)
        mercCtx.stateBus.applyState({
          stateNameOrId: stateId,
          sourceUnitId: `merc_${merc.unitId}`,
          sourceSkillId: proc.skillId,
          slvl: proc.slvl,
          durationFrames: dur,
          currentFrame: this.currentFrame,
          stats: stateStats,
        })
        if (dur > 0) {
          this.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, stateId, dur)
        } else {
          this.applyPersistentUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, stateId)
        }
      }
      continue
    }
    if (procSkill.auraTgtState && target !== undefined) {
      const stateId = this.registry.getStateByName(procSkill.auraTgtState)?.id
      if (stateId !== undefined) {
        const dur = Math.max(50, ev.durationFrames > 0 ? ev.durationFrames : 100 + proc.slvl * 25)
        const radius = Math.max(3.5, ev.radiusSubtiles > 0 ? ev.radiusSubtiles : 6)
        const stateStats = this.evaluateSkillStateStats(procSkill, proc.slvl, mercCtx.statList)
        if (proc.skillId === 87 && stateStats['damageresist'] === undefined) {
          stateStats['damageresist'] = -50
        } else if (proc.skillId === 66 && stateStats['damageresist'] === undefined) {
          stateStats['damageresist'] = -100
        }
        for (const m of this.monsters.values()) {
          if (m.dead || m.isNpc || !m.isKillable || m.submerged || m.areaId !== merc.areaId) continue
          if (Math.hypot(m.x - target.x, m.y - target.y) <= radius) {
            if (this.applyMonsterState(m.unitId, stateId, dur)) {
              this.monsterCombatContext(m).stateBus.applyState({
                stateNameOrId: stateId,
                sourceUnitId: `merc_${merc.unitId}`,
                sourceSkillId: proc.skillId,
                slvl: proc.slvl,
                durationFrames: dur,
                currentFrame: this.currentFrame,
                stats: stateStats,
              })
            }
          }
        }
      }
      continue
    }
    if (isCtcRadialNovaSkill113c(proc.skillId)) {
      const radius = Math.max(6, ev.radiusSubtiles > 0 ? ev.radiusSubtiles : 9)
      const originX = triggerStatId === 201 ? merc.x : (target?.x ?? merc.x)
      const originY = triggerStatId === 201 ? merc.y : (target?.y ?? merc.y)
      for (const m of [...this.monsters.values()]) {
        if (m.dead || m.isNpc || !m.isKillable || m.submerged || m.areaId !== merc.areaId) continue
        if (Math.hypot(m.x - originX, m.y - originY) <= radius) {
          if (ev.elemType === 'pois' && ev.durationFrames > 0) {
            const bitrate256 = this.rollInclusive(ev.minElemDmg256, ev.maxElemDmg256)
            if (bitrate256 > 0) {
              this.applyMonsterPoisonDot(owner, m, bitrate256, ev.durationFrames, proc.skillId, 'merc')
            }
            continue
          }
          const elem: 'cold' | 'ltng' = proc.skillId === 44 ? 'cold' : 'ltng'
          const eMin = Math.max(1, ev.minElemDmg256 >> 8)
          const eMax = Math.max(eMin, ev.maxElemDmg256 >> 8)
          const chillFrames = proc.skillId === 44 ? Math.max(75, ev.durationFrames || 200) : 0
          this.applyDamageToMonster(owner, m, this.rng.range(eMin, eMax), proc.skillId, elem, merc, {
            attackKind: 'spell',
            autoHit: true,
            unblockable: true,
            elemDurationFrames: chillFrames || undefined,
          })
        }
      }
      continue
    }
    const eMin = Math.max(1, (ev.minElemDmg256 >> 8) || ev.minElemDmg || 0)
    const eMax = Math.max(eMin, (ev.maxElemDmg256 >> 8) || ev.maxElemDmg || eMin)
    if (eMax > 0 && target !== undefined && !target.dead) {
      const channel = normalizeMissileElement(procSkill.eType) ?? 'mag'
      this.applyDamageToMonster(owner, target, this.rng.range(eMin, eMax), proc.skillId, channel, merc, {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        elemDurationFrames: ev.durationFrames || undefined,
      })
    }
  }
}



function applyMercSplashPvp113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  merc: InternalMercenaryRecord,
  areaId: number,
  cx: number,
  cy: number,
  radiusSubtiles: number,
  msl: {
    readonly skillId: number
    readonly element: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag'
    readonly elemDamage: number
    readonly elemDurationFrames: number
  },
  excludeIdKey?: number,
): void {
  const pvpTargets = this.collectHostilePvpTargetsInArea113c(owner.unitId, areaId)
  for (const p of pvpTargets.players) {
    if (excludeIdKey === -p.unitId || Math.hypot(p.x - cx, p.y - cy) > radiusSubtiles) continue
    this.applyPvpHitToTarget113c(
      owner,
      { kind: 'player', player: p },
      {
        skillId: msl.skillId,
        elemDamage: msl.elemDamage,
        elemType: msl.element,
        elemDurationFrames: msl.elemDurationFrames || undefined,
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        source: merc,
      },
    )
  }
  for (const c of pvpTargets.mercs) {
    const idKey = -(1_000_000 + c.unitId)
    if (excludeIdKey === idKey || Math.hypot(c.x - cx, c.y - cy) > radiusSubtiles) continue
    this.applyPvpHitToTarget113c(
      owner,
      { kind: 'merc', merc: c },
      {
        skillId: msl.skillId,
        elemDamage: msl.elemDamage,
        elemType: msl.element,
        elemDurationFrames: msl.elemDurationFrames || undefined,
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        source: merc,
      },
    )
  }
  for (const entry of pvpTargets.pets) {
    const idKey = -(2_000_000 + entry.petUnitId)
    if (excludeIdKey === idKey || Math.hypot(entry.pet.x - cx, entry.pet.y - cy) > radiusSubtiles) continue
    this.applyPvpHitToTarget113c(
      owner,
      { kind: 'pet', ...entry },
      {
        skillId: msl.skillId,
        elemDamage: msl.elemDamage,
        elemType: msl.element,
        elemDurationFrames: msl.elemDurationFrames || undefined,
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        source: merc,
      },
    )
  }
}



function stepMercenaryMissiles113c(this: GameInstanceHost): void {
  for (const [mslId, msl] of [...this.mercMissiles.entries()]) {
    const prevX = msl.x
    const prevY = msl.y
    const nextX = prevX + msl.vx
    const nextY = prevY + msl.vy
    msl.remainingFrames -= 1

    if (!this.isMonsterStepWalkable(msl.areaId, prevX, prevY, nextX, nextY, true)) {
      if (msl.splashRadiusSubtiles > 0 && msl.elemDamage > 0) {
        const owner = this.players.get(msl.ownerPlayerId)
        const merc = this.mercenaries.get(msl.mercUnitId)
        if (owner && merc) {
          for (const m of this.monsters.values()) {
            if (
              m.dead ||
              m.isNpc ||
              !m.isKillable ||
              m.submerged ||
              m.align !== 0 ||
              this.isMonsterConverted(m) ||
              m.areaId !== msl.areaId
            ) {
              continue
            }
            if (Math.hypot(m.x - prevX, m.y - prevY) <= msl.splashRadiusSubtiles) {
              this.applyDamageToMonster(owner, m, msl.elemDamage, msl.skillId, msl.element, merc, {
                attackKind: 'spell',
                autoHit: true,
                unblockable: true,
                elemDurationFrames: msl.elemDurationFrames || undefined,
              })
            }
          }
          this.applyMercSplashPvp113c(
            owner,
            merc,
            msl.areaId,
            prevX,
            prevY,
            msl.splashRadiusSubtiles,
            msl,
          )
        }
      }
      this.mercMissiles.delete(mslId)
      continue
    }

    msl.x = nextX
    msl.y = nextY

    const segDx = nextX - prevX
    const segDy = nextY - prevY
    const segLenSq = segDx * segDx + segDy * segDy
    let hitMonster: InternalMonsterRecord | undefined
    let hitPvpCand:
      | {
          readonly idKey: number
          readonly x: number
          readonly y: number
          readonly target:
            | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
            | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
            | {
                readonly kind: 'pet'
                readonly ownerId: number
                readonly pet: SummonedPetUnit
                readonly petUnitId: number
                readonly areaId: number
              }
        }
      | undefined
    let bestHitT = Infinity

    for (const m of this.monsters.values()) {
      const sameOrWildernessSeam =
        m.areaId === msl.areaId ||
        (!TOWN_AREAS.has(msl.areaId) &&
          !TOWN_AREAS.has(m.areaId) &&
          this.isAreaSeamAdjacent(msl.areaId, m.areaId))
      if (
        m.dead ||
        m.isNpc ||
        !m.isKillable ||
        m.submerged ||
        m.align !== 0 ||
        this.isMonsterConverted(m) ||
        !sameOrWildernessSeam ||
        msl.hitUnitIds.has(m.unitId)
      ) {
        continue
      }
      let t = 1
      if (segLenSq > 1e-6) {
        t = Math.max(0, Math.min(1, ((m.x - prevX) * segDx + (m.y - prevY) * segDy) / segLenSq))
      }
      const cx = prevX + segDx * t
      const cy = prevY + segDy * t
      const hitRadius = Math.max(1.8, (m.sizeX || 2) * 0.65)
      if (Math.hypot(m.x - cx, m.y - cy) <= hitRadius && t < bestHitT) {
        bestHitT = t
        hitMonster = m
        hitPvpCand = undefined
      }
    }

    const pvpTargets = this.collectHostilePvpTargetsInArea113c(msl.ownerPlayerId, msl.areaId)
    const checkPvpCand = (
      idKey: number,
      tx: number,
      ty: number,
      target:
        | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
        | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
        | {
            readonly kind: 'pet'
            readonly ownerId: number
            readonly pet: SummonedPetUnit
            readonly petUnitId: number
            readonly areaId: number
          },
    ): void => {
      if (msl.hitUnitIds.has(idKey)) return
      let t = 1
      if (segLenSq > 1e-6) {
        t = Math.max(0, Math.min(1, ((tx - prevX) * segDx + (ty - prevY) * segDy) / segLenSq))
      }
      const cx = prevX + segDx * t
      const cy = prevY + segDy * t
      if (Math.hypot(tx - cx, ty - cy) <= 1.8 && t < bestHitT) {
        bestHitT = t
        hitMonster = undefined
        hitPvpCand = { idKey, x: tx, y: ty, target }
      }
    }
    for (const p of pvpTargets.players) {
      checkPvpCand(-p.unitId, p.x, p.y, { kind: 'player', player: p })
    }
    for (const c of pvpTargets.mercs) {
      checkPvpCand(-(1_000_000 + c.unitId), c.x, c.y, { kind: 'merc', merc: c })
    }
    for (const entry of pvpTargets.pets) {
      checkPvpCand(-(2_000_000 + entry.petUnitId), entry.pet.x, entry.pet.y, { kind: 'pet', ...entry })
    }

    if (hitMonster !== undefined) {
      msl.hitUnitIds.add(hitMonster.unitId)
      const owner = this.players.get(msl.ownerPlayerId)
      const merc = this.mercenaries.get(msl.mercUnitId)
      if (owner && merc) {
        let physLanded = false
        if (msl.physDamage > 0) {
          physLanded = this.applyDamageToMonster(
            owner,
            hitMonster,
            msl.physDamage,
            msl.skillId,
            'phys',
            merc,
            {
              attackKind: 'missile',
              autoHit: msl.guaranteedHit,
            },
          )
        }
        if (msl.elemDamage > 0 && !hitMonster.dead && (msl.guaranteedHit || msl.physDamage <= 0 || physLanded)) {
          this.applyDamageToMonster(
            owner,
            hitMonster,
            msl.elemDamage,
            msl.skillId,
            msl.element,
            merc,
            {
              attackKind: msl.guaranteedHit ? 'spell' : 'missile',
              autoHit: true,
              unblockable: msl.guaranteedHit,
              elemDurationFrames: msl.elemDurationFrames || undefined,
            },
          )
        }
        if (msl.isWeaponAttack && (physLanded || msl.guaranteedHit)) {
          this.applyMercElementalWeaponRiders113c(owner, merc, hitMonster, 'missile')
          this.triggerMercCtcProcs113c(owner, merc, hitMonster, 198)
        }
        if (msl.splashRadiusSubtiles > 0 && msl.elemDamage > 0) {
          for (const other of this.monsters.values()) {
            if (
              other.unitId === hitMonster.unitId ||
              other.dead ||
              other.isNpc ||
              !other.isKillable ||
              other.submerged ||
              other.align !== 0 ||
              this.isMonsterConverted(other) ||
              other.areaId !== msl.areaId
            ) {
              continue
            }
            if (Math.hypot(other.x - hitMonster.x, other.y - hitMonster.y) <= msl.splashRadiusSubtiles) {
              this.applyDamageToMonster(
                owner,
                other,
                msl.elemDamage,
                msl.skillId,
                msl.element,
                merc,
                {
                  attackKind: 'spell',
                  autoHit: true,
                  unblockable: true,
                  elemDurationFrames: msl.elemDurationFrames || undefined,
                },
              )
            }
          }
          this.applyMercSplashPvp113c(
            owner,
            merc,
            msl.areaId,
            hitMonster.x,
            hitMonster.y,
            msl.splashRadiusSubtiles,
            msl,
          )
        }
      }
      if (!msl.pierce) {
        this.mercMissiles.delete(mslId)
        continue
      }
    } else if (hitPvpCand !== undefined) {
      msl.hitUnitIds.add(hitPvpCand.idKey)
      const owner = this.players.get(msl.ownerPlayerId)
      const merc = this.mercenaries.get(msl.mercUnitId)
      if (owner && merc) {
        this.applyPvpHitToTarget113c(owner, hitPvpCand.target, {
          skillId: msl.skillId,
          physDamage: msl.physDamage,
          elemDamage: msl.elemDamage,
          elemType: msl.element,
          elemDurationFrames: msl.elemDurationFrames || undefined,
          attackKind: msl.guaranteedHit ? 'spell' : 'missile',
          autoHit: msl.guaranteedHit,
          unblockable: msl.guaranteedHit,
          source: merc,
        })
        if (msl.splashRadiusSubtiles > 0 && msl.elemDamage > 0) {
          for (const other of this.monsters.values()) {
            if (
              other.dead ||
              other.isNpc ||
              !other.isKillable ||
              other.submerged ||
              other.align !== 0 ||
              this.isMonsterConverted(other) ||
              other.areaId !== msl.areaId
            ) {
              continue
            }
            if (Math.hypot(other.x - hitPvpCand.x, other.y - hitPvpCand.y) <= msl.splashRadiusSubtiles) {
              this.applyDamageToMonster(
                owner,
                other,
                msl.elemDamage,
                msl.skillId,
                msl.element,
                merc,
                {
                  attackKind: 'spell',
                  autoHit: true,
                  unblockable: true,
                  elemDurationFrames: msl.elemDurationFrames || undefined,
                },
              )
            }
          }
          this.applyMercSplashPvp113c(
            owner,
            merc,
            msl.areaId,
            hitPvpCand.x,
            hitPvpCand.y,
            msl.splashRadiusSubtiles,
            msl,
            hitPvpCand.idKey,
          )
        }
      }
      if (msl.pierceRemaining !== undefined) {
        if (msl.pierceRemaining > 0) {
          msl.pierceRemaining -= 1
          msl.pierce = true
        } else {
          msl.pierce = false
        }
      }
      if (!msl.pierce) {
        this.mercMissiles.delete(mslId)
        continue
      }
    }

    if (msl.remainingFrames <= 0) {
      this.mercMissiles.delete(mslId)
    }
  }
}



function stepMercenaries(this: GameInstanceHost): void {
  this.stepMercenaryMissiles113c()

  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || merc.hp <= 0) {
      if (this.mercAuraScanners.has(merc.unitId)) {
        this.stopMercenaryAura(merc)
      }
      continue
    }
    if (merc.states && merc.stateTimers) {
      this.stepUnitStates(
        merc.states,
        merc.stateTimers,
        'monster',
        merc.unitId,
        merc.areaId,
      )
    }
    const owner = this.players.get(merc.ownerPlayerId)
    if (!owner || owner.dead) continue
    if (merc.oracleMercAi113c !== undefined && this.drlgRoomPopulator !== null) {
      stepOracleHireableMerc113c(this, owner, merc)
      continue
    }

    // 1.13c `MERCS_SetStats` (`D2Game.dll` `0x6FC68EE6..0x6FC68F0D`, #1671) & `MONSTER_Regen` (`0x6FC96740`, #1989):
    // Mercenaries have natural `stat 74 hpregen = maxhp_256 / 2000` (`>= 0`, `~1000` frames = 40s full heal),
    // suppressed while `STATE_POISON` (`2`) is active (`0x6FC9675B..0x6FC9676E`), plus equipped `item_replenish_life`
    // (`stat 74`) and active `StateBus` `hpregen` (Prayer `+`, Poison `-poisonBitrate256`).
    const mercCtx = this.mercCombat.get(merc.unitId)
    const hasPoisonUnitState = merc.states?.has(2) ?? false
    if (
      mercCtx !== undefined &&
      !hasPoisonUnitState &&
      (mercCtx.stateBus.hasState(2) || mercCtx.stateBus.hasState('poison'))
    ) {
      mercCtx.stateBus.removeState(2)
      mercCtx.stateBus.removeState('poison')
    }
    const isMercPoisoned =
      hasPoisonUnitState ||
      (mercCtx !== undefined && (mercCtx.stateBus.hasState(2) || mercCtx.stateBus.hasState('poison')))
    const baseRegen256 = isMercPoisoned ? 0 : Math.max(0, Math.floor((merc.maxHp * FIXED_ONE) / 2000))
    const itemRegen256 = Math.trunc(this.sumMercItemStat(merc, 74))
    const stateRegen256 = mercCtx ? Math.trunc(mercCtx.statList.getAccruedStat('hpregen')) : 0
    const totalRegen256 = baseRegen256 + itemRegen256 + stateRegen256
    if (totalRegen256 > 0 && merc.hp < merc.maxHp) {
      merc.regenCarry256 = Math.max(0, merc.regenCarry256 ?? 0) + totalRegen256
      if (merc.regenCarry256 >= FIXED_ONE) {
        const healWhole = Math.floor(merc.regenCarry256 / FIXED_ONE)
        merc.regenCarry256 -= healWhole * FIXED_ONE
        const nextHp = Math.min(merc.maxHp, merc.hp + healWhole)
        if (nextHp !== merc.hp) {
          merc.hp = nextHp
          this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
        }
      }
    } else if (totalRegen256 < 0 && merc.hp > 0) {
      merc.regenCarry256 = Math.min(0, merc.regenCarry256 ?? 0) + totalRegen256
      if (merc.regenCarry256 <= -FIXED_ONE) {
        const drainWhole = Math.floor(-merc.regenCarry256 / FIXED_ONE)
        merc.regenCarry256 += drainWhole * FIXED_ONE
        if (TOWN_AREAS.has(merc.areaId)) {
          // 1.13c `MONSTER_Regen` (`0x6FC967EC..0x6FC9680F`): in town, negative `hpregen` clamps at `1 HP`.
          if (merc.hp > 1) {
            const clampedDrain = Math.min(drainWhole, merc.hp - 1)
            if (clampedDrain > 0) {
              this.applyDamageToMerc(merc, clampedDrain, merc.areaId)
            }
          }
        } else {
          this.applyDamageToMerc(merc, drainWhole, merc.areaId)
          if (!merc.alive) continue
        }
      }
    } else {
      merc.regenCarry256 = 0
    }
    if (merc.subType === undefined) continue

    const mercPrevAreaId = merc.areaId
    const mercPrevX = merc.x
    const mercPrevY = merc.y
    if (merc.areaId !== owner.areaId) {
      merc.areaId = owner.areaId
      merc.x = owner.x + 1
      merc.y = owner.y + 1
      merc.state = 'idle'
      this.broadcastToArea(merc.areaId, {
        type: 'UnitReassign',
        unitType: 'monster',
        id: merc.unitId,
        unitId: merc.unitId,
        at: { x: merc.x, y: merc.y },
        x: merc.x,
        y: merc.y,
        areaId: merc.areaId,
        snap: true,
      })
      this.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        merc.unitId,
        mercPrevAreaId,
        mercPrevX,
        mercPrevY,
        merc.areaId,
        merc.x,
        merc.y,
        merc.ownerPlayerId,
      )
      continue
    }

    if (merc.cooldown > 0) {
      merc.cooldown--
    }

    const ownerDist = Math.hypot(owner.x - merc.x, owner.y - merc.y)
    if (ownerDist > HIREABLE_AI_113C.TELEPORT_SUBTILES) {
      merc.x = owner.x
      merc.y = owner.y
      merc.state = 'idle'
      this.broadcastToArea(merc.areaId, {
        type: 'UnitReassign',
        unitType: 1,
        id: merc.unitId,
        unitId: merc.unitId,
        areaId: merc.areaId,
        at: { x: Math.round(merc.x), y: Math.round(merc.y) },
        x: Math.round(merc.x),
        y: Math.round(merc.y),
        snap: true,
      })
      this.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        merc.unitId,
        mercPrevAreaId,
        mercPrevX,
        mercPrevY,
        merc.areaId,
        merc.x,
        merc.y,
        merc.ownerPlayerId,
      )
      continue
    }

    const visionRadius = Math.max(merc.aggroRadius, HIREABLE_AI_113C.AGGRO_SUBTILES)
    const nearbyMonsterEntries: {
      readonly record: InternalMonsterRecord
      readonly dist: number
    }[] = []
    type MercHostileEntry113c =
      | {
          readonly kind: 'monster'
          readonly record: InternalMonsterRecord
          readonly unitId: number
          readonly x: number
          readonly y: number
          readonly hp: number
          readonly maxHp: number
          readonly hasInnerSightState: boolean
          readonly dist: number
        }
      | {
          readonly kind: 'pvp'
          readonly target:
            | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
            | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
            | {
                readonly kind: 'pet'
                readonly ownerId: number
                readonly pet: SummonedPetUnit
                readonly petUnitId: number
                readonly areaId: number
              }
          readonly unitId: number
          readonly x: number
          readonly y: number
          readonly hp: number
          readonly maxHp: number
          readonly hasInnerSightState: boolean
          readonly dist: number
        }
    const nearbyHostileEntries: MercHostileEntry113c[] = []
    for (const m of this.monsters.values()) {
      const sameOrWildernessSeam =
        m.areaId === merc.areaId ||
        (!TOWN_AREAS.has(merc.areaId) &&
          !TOWN_AREAS.has(m.areaId) &&
          this.isAreaSeamAdjacent(merc.areaId, m.areaId))
      if (
        m.dead ||
        m.isNpc ||
        !m.isKillable ||
        m.submerged ||
        m.petIgnore ||
        m.align !== 0 ||
        this.isMonsterConverted(m) ||
        !sameOrWildernessSeam
      ) {
        continue
      }
      const d = Math.hypot(m.x - merc.x, m.y - merc.y)
      if (d <= visionRadius) {
        nearbyMonsterEntries.push({ record: m, dist: d })
        nearbyHostileEntries.push({
          kind: 'monster',
          record: m,
          unitId: m.unitId,
          x: m.x,
          y: m.y,
          hp: m.hp,
          maxHp: m.maxHp,
          hasInnerSightState: m.states.has(17),
          dist: d,
        })
      }
    }
    const pvpTargets = this.collectHostilePvpTargetsInArea113c(owner.unitId, merc.areaId)
    for (const p of pvpTargets.players) {
      const d = Math.hypot(p.x - merc.x, p.y - merc.y)
      if (d <= visionRadius) {
        nearbyHostileEntries.push({
          kind: 'pvp',
          target: { kind: 'player', player: p },
          unitId: p.unitId,
          x: p.x,
          y: p.y,
          hp: p.hp,
          maxHp: p.maxHp,
          hasInnerSightState: p.states.has(17),
          dist: d,
        })
      }
    }
    for (const c of pvpTargets.mercs) {
      const d = Math.hypot(c.x - merc.x, c.y - merc.y)
      if (d <= visionRadius) {
        nearbyHostileEntries.push({
          kind: 'pvp',
          target: { kind: 'merc', merc: c },
          unitId: c.unitId,
          x: c.x,
          y: c.y,
          hp: c.hp,
          maxHp: c.maxHp,
          hasInnerSightState: c.states.has(17),
          dist: d,
        })
      }
    }
    for (const entry of pvpTargets.pets) {
      const d = Math.hypot(entry.pet.x - merc.x, entry.pet.y - merc.y)
      if (d <= visionRadius) {
        nearbyHostileEntries.push({
          kind: 'pvp',
          target: { kind: 'pet', ...entry },
          unitId: entry.petUnitId,
          x: entry.pet.x,
          y: entry.pet.y,
          hp: entry.pet.hp,
          maxHp: entry.pet.maxHp,
          hasInnerSightState: entry.pet.stateBus.hasState(17),
          dist: d,
        })
      }
    }
    nearbyMonsterEntries.sort((a, b) => a.dist - b.dist || a.record.unitId - b.record.unitId)
    nearbyHostileEntries.sort((a, b) => a.dist - b.dist || a.unitId - b.unitId)

    const nearbyPlayers = [...this.players.values()]
      .filter((p) => !p.dead && p.areaId === merc.areaId && !this.isHostilePvpPair113c(owner.unitId, merc.areaId, p.unitId, p.areaId))
      .map((p) => ({ unitId: p.unitId, x: p.x, y: p.y }))

    const hirelingStats = resolveHirelingStatsAtLevel(
      merc.subType,
      merc.act,
      merc.difficulty,
      merc.level,
      true,
    )
    const weaponProfile = computeMercenaryWeaponProfile113c(
      merc,
      hirelingStats,
      (statId, opts) => this.sumMercItemStat(merc, statId, opts),
      (it) => this.collectServerItemEntryStats113c(it as ServerItemEntry),
    )

    const rollMercScaledPhysDamage = (skillEdPct = 0, skillFlatDmg = 0): number => {
      const rawBase =
        this.rng.range(weaponProfile.baseMinDmg, weaponProfile.baseMaxDmg) + skillFlatDmg
      const edPct = Math.max(
        -90,
        weaponProfile.statBonusPct + weaponProfile.offWeaponItemEdPct + skillEdPct,
      )
      return Math.max(1, Math.trunc((rawBase * (100 + edPct)) / 100))
    }

    const bestHostile = nearbyHostileEntries[0]
    const bestDist = bestHostile?.dist ?? Infinity
    const engageRange =
      merc.act === 1
        ? HIREABLE_AI_113C.ACT1_RANGED_REACH_SUBTILES
        : merc.act === 3
          ? HIREABLE_AI_113C.ACT3_RANGED_REACH_SUBTILES
          : Math.max(merc.reach, weaponProfile.meleeReachSubtiles)
    const readyToEngage = bestHostile !== undefined && bestDist <= engageRange && merc.cooldown <= 0

    const aiStep = stepMercenaryAiAndChooseAction113c({
      merc: {
        unitId: merc.unitId,
        act: merc.act,
        subType: merc.subType,
        level: merc.level,
        difficulty: merc.difficulty,
        x: merc.x,
        y: merc.y,
        hp: merc.hp,
        maxHp: merc.maxHp,
        alive: merc.alive,
        activeAura: merc.activeAura,
        hasFrozenArmorState: merc.states.has(10),
      },
      owner: { unitId: owner.unitId, x: owner.x, y: owner.y },
      nearbyPlayers,
      nearbyMonsters: nearbyHostileEntries.map((entry) => ({
        unitId: entry.unitId,
        x: entry.x,
        y: entry.y,
        hp: entry.hp,
        maxHp: entry.maxHp,
        hasInnerSightState: entry.hasInnerSightState,
      })),
      currentFrame: this.currentFrame,
      readyToAct: readyToEngage,
      weaponProfile,
      rollBasePhysDamage: () => rollMercScaledPhysDamage(0, 0),
      registry: this.registry,
      rng: this.rng,
    })

    if (aiStep.activeAura) {
      merc.activeAura = aiStep.activeAura
    }
    this.syncMercenaryOwnerAura(owner, merc.activeAura, merc)

    if (bestHostile !== undefined) {
      if (bestDist <= engageRange) {
        merc.state = 'attack'
        if (merc.cooldown <= 0 && aiStep.chosenAction !== undefined) {
          merc.cooldown = weaponProfile.attackCooldownFrames
          const action = aiStep.chosenAction
          if (action.kind === 'frozen_armor') {
            this.applyUnitState(
              merc.states,
              merc.stateTimers,
              'monster',
              merc.unitId,
              merc.areaId,
              10,
              action.durationFrames,
            )
            this.mercCombatContext(merc).stateBus.applyState({
              stateNameOrId: 10,
              sourceUnitId: `merc_${merc.unitId}`,
              sourceSkillId: 40,
              slvl: action.slvl,
              durationFrames: action.durationFrames,
              currentFrame: this.currentFrame,
              stats: { item_armor_percent: action.defenseBonusPct },
            })
          } else if (action.kind === 'inner_sight') {
            for (const entry of nearbyHostileEntries) {
              if (entry.dist > action.radiusSubtiles) continue
              if (entry.kind === 'monster') {
                const m = entry.record
                if (m.dead) continue
                this.applyUnitState(
                  m.states,
                  m.stateTimers,
                  'monster',
                  m.unitId,
                  m.areaId,
                  17,
                  action.durationFrames,
                )
                this.monsterCombatContext(m).stateBus.applyState({
                  stateNameOrId: 17,
                  sourceUnitId: `merc_${merc.unitId}`,
                  sourceSkillId: 8,
                  slvl: action.slvl,
                  durationFrames: action.durationFrames,
                  currentFrame: this.currentFrame,
                  stats: { armorclass: -action.enemyDefensePenalty },
                })
              } else {
                this.applyPvpDebuffStateToTarget113c(
                  entry.target,
                  17,
                  action.durationFrames,
                  `merc_${merc.unitId}`,
                  8,
                  action.slvl,
                  { armorclass: -action.enemyDefensePenalty },
                )
              }
            }
          } else if (action.kind === 'missile') {
            const isWeaponShot = merc.act === 1
            if (isWeaponShot && bestHostile.kind === 'monster') {
              this.triggerMercCtcProcs113c(owner, merc, bestHostile.record, 195)
            }
            const mSpec = action.missile
            const mRec = this.registry.getMissileById(mSpec.missileId)
            const baseAngle = Math.atan2(bestHostile.y - merc.y, bestHostile.x - merc.x)
            const count = Math.max(1, mSpec.boltCount)
            const mercPiercePct = isWeaponShot
              ? Math.max(0, Math.min(100, this.sumMercItemStat(merc, 156)))
              : 0
            for (let b = 0; b < count; b++) {
              let mercPierceRemaining: number | undefined
              if (mRec !== undefined && mRec.collideKill && mRec.pierce) {
                let pCount = 0
                if (mercPiercePct > 0) {
                  while (pCount < 4) {
                    if (mercPiercePct >= 100 || this.rng.rand(100) < mercPiercePct) {
                      pCount += 1
                    } else {
                      break
                    }
                  }
                }
                mercPierceRemaining = pCount
              }
              const spread = count > 1 ? (b - (count - 1) / 2) * 0.14 : 0
              const ang = baseAngle + spread
              const vx = Math.cos(ang) * mSpec.velSubtilesPerFrame
              const vy = Math.sin(ang) * mSpec.velSubtilesPerFrame
              const projId = this.allocateUnitId(UNIT_TYPE_113C.missile)
              const tx = Math.round(merc.x + Math.cos(ang) * Math.max(4, bestDist))
              const ty = Math.round(merc.y + Math.sin(ang) * Math.max(4, bestDist))
              this.mercMissiles.set(projId, {
                unitId: projId,
                missileClassId: mSpec.missileId,
                mercUnitId: merc.unitId,
                ownerPlayerId: owner.unitId,
                areaId: merc.areaId,
                x: merc.x,
                y: merc.y,
                vx,
                vy,
                remainingFrames: mSpec.rangeFrames,
                pierce:
                  mRec !== undefined && !mRec.collideKill
                    ? true
                    : mercPierceRemaining !== undefined
                      ? mercPierceRemaining > 0
                      : false,
                ...(mercPierceRemaining !== undefined
                  ? { pierceRemaining: mercPierceRemaining }
                  : {}),
                guaranteedHit: mSpec.guaranteedHit,
                skillId: mSpec.skillId,
                slvl: mSpec.slvl,
                element: mSpec.element,
                physDamage: mSpec.physDamage,
                elemDamage: mSpec.elemDamage,
                elemDurationFrames: mSpec.elemDurationFrames,
                splashRadiusSubtiles: mSpec.splashRadiusSubtiles,
                isWeaponAttack: isWeaponShot,
                hitUnitIds: new Set<number>(),
              })
              const at = { x: Math.round(merc.x), y: Math.round(merc.y) }
              const tgt = { x: tx, y: ty }
              this.broadcastToArea(merc.areaId, {
                type: 'CreateMissile',
                missileId: projId,
                missileClassId: mSpec.missileId,
                at,
                target: tgt,
                x: at.x,
                y: at.y,
                targetX: tgt.x,
                targetY: tgt.y,
                skillId: mSpec.skillId,
                level: mSpec.slvl,
                ownerType: 1,
                ownerUnitType: 'monster',
                ownerId: merc.unitId,
                sourceUnitId: merc.unitId,
                areaId: merc.areaId,
              } as ServerEvent)
            }
          } else if (bestHostile.kind === 'monster') {
            const bestTarget = bestHostile.record
            // Melee attack (`Attack` #0, Act 2 `Jab` #10 2-hit sequence, Act 5 `Bash` #126, Act 5 `Stun` #139)
            this.triggerMercCtcProcs113c(owner, merc, bestTarget, 195)
            for (let hitIdx = 0; hitIdx < action.hitCount; hitIdx++) {
              if (bestTarget.dead) break
              const physDmg = rollMercScaledPhysDamage(action.skillEdPct, action.skillFlatDmg)
              const landed = this.applyDamageToMonster(
                owner,
                bestTarget,
                physDmg,
                action.skillId,
                'phys',
                merc,
                {
                  attackKind: 'melee',
                  toHitBonusPct: action.skillArPct,
                },
              )
              if (landed) {
                if (action.stunFrames > 0 && !bestTarget.dead) {
                  this.applyMonsterState(bestTarget.unitId, 21, action.stunFrames)
                }
                if (!bestTarget.dead) {
                  this.applyMercElementalWeaponRiders113c(owner, merc, bestTarget, 'melee')
                }
                if (!bestTarget.dead && this.sumMercItemStat(merc, 117) > 0) {
                  this.applyMonsterState(bestTarget.unitId, 52, 120_000)
                }
                if (
                  !bestTarget.dead &&
                  !action.knockback &&
                  this.sumMercItemStat(merc, 81) > 0 &&
                  rollItemKnockback113c(this.rng, {
                    unitType: 'monster',
                    sizeX: bestTarget.sizeX,
                  })
                ) {
                  this.knockbackMonster(bestTarget, merc.x, merc.y)
                }
                this.triggerMercCtcProcs113c(owner, merc, bestTarget, 198)
              }
            }
          } else {
            for (let hitIdx = 0; hitIdx < action.hitCount; hitIdx++) {
              const physDmg = rollMercScaledPhysDamage(action.skillEdPct, action.skillFlatDmg)
              const landed = this.applyPvpHitToTarget113c(owner, bestHostile.target, {
                skillId: action.skillId,
                physDamage: physDmg,
                attackKind: 'melee',
                toHitBonusPct: action.skillArPct,
                source: merc,
              })
              if (landed && action.stunFrames > 0) {
                this.applyPvpDebuffStateToTarget113c(
                  bestHostile.target,
                  21,
                  action.stunFrames,
                  `merc_${merc.unitId}`,
                  action.skillId,
                  1,
                )
              }
            }
          }
        }
      } else if (this.currentFrame % 2 === 0 && bestDist > 0.01) {
        merc.state = 'chase'
        const dx = bestHostile.x - merc.x
        const dy = bestHostile.y - merc.y
        const runVel =
          merc.act === 5 ? HIREABLE_AI_113C.ACT5_RUN : HIREABLE_AI_113C.ACT123_RUN
        const stepSubtiles = (runVel * 2) / 25
        const nextX =
          Math.round((merc.x + (dx / bestDist) * stepSubtiles) * 100) / 100
        const nextY =
          Math.round((merc.y + (dy / bestDist) * stepSubtiles) * 100) / 100
        if (
          this.isMonsterStepWalkable(
            merc.areaId,
            merc.x,
            merc.y,
            nextX,
            nextY,
            false,
          )
        ) {
          merc.x = nextX
          merc.y = nextY
          this.broadcastToArea(merc.areaId, {
            type: 'UnitMove',
            unitType: 'monster',
            id: merc.unitId,
            unitId: merc.unitId,
            areaId: merc.areaId,
            mode: 'walk',
            to: { x: Math.round(merc.x), y: Math.round(merc.y) },
            x: Math.round(merc.x),
            y: Math.round(merc.y),
          })
        }
      }
    } else if (
      ownerDist > HIREABLE_AI_113C.FOLLOW_WALK_SUBTILES &&
      this.currentFrame % 2 === 0
    ) {
      merc.state = 'follow'
      const dx = owner.x - merc.x
      const dy = owner.y - merc.y
      const moveVel =
        ownerDist > HIREABLE_AI_113C.LEASH_RUN_SUBTILES
          ? merc.act === 5
            ? HIREABLE_AI_113C.ACT5_RUN
            : HIREABLE_AI_113C.ACT123_RUN
          : merc.speed
      const stepSubtiles = (moveVel * 2) / 25
      const nextX =
        Math.round((merc.x + (dx / ownerDist) * stepSubtiles) * 100) / 100
      const nextY =
        Math.round((merc.y + (dy / ownerDist) * stepSubtiles) * 100) / 100
      if (
        this.isMonsterStepWalkable(
          merc.areaId,
          merc.x,
          merc.y,
          nextX,
          nextY,
          false,
        )
      ) {
        merc.x = nextX
        merc.y = nextY
        this.broadcastToArea(merc.areaId, {
          type: 'UnitMove',
          unitType: 'monster',
          id: merc.unitId,
          unitId: merc.unitId,
          areaId: merc.areaId,
          mode: 'walk',
          to: { x: Math.round(merc.x), y: Math.round(merc.y) },
          x: Math.round(merc.x),
          y: Math.round(merc.y),
        })
      }
    } else {
      merc.state = 'idle'
    }
    if (merc.x !== mercPrevX || merc.y !== mercPrevY || merc.areaId !== mercPrevAreaId) {
      this.syncUnitMoveAcrossViewerAoi113c(
        'monster',
        merc.unitId,
        mercPrevAreaId,
        mercPrevX,
        mercPrevY,
        merc.areaId,
        merc.x,
        merc.y,
        merc.ownerPlayerId,
      )
    }
  }
}

export interface MercenariesMethods {
  resolveMercenaryAuraSources113c(merc: InternalMercenaryRecord, activeAuraOverride?: string | undefined): {
  readonly skillId: number
  readonly slvl: number
  readonly isItemAura: boolean
  readonly radiusSubtiles: number
  readonly casterStateId: number | undefined
  readonly targetStateId: number | undefined
}[]
  stopMercenaryAura(merc: InternalMercenaryRecord): void
  syncMercenaryOwnerAura(owner: InternalPlayerRecord, activeAura: string | undefined, mercOverride?: InternalMercenaryRecord | undefined, forcePulse?: boolean | undefined): void
  pulseMercenaryAuraRuntime113c(merc: InternalMercenaryRecord, owner: InternalPlayerRecord, runtime: MercAuraRuntime, forceRefresh?: boolean | undefined): void
  stepMercenaryAuras(): void
  hireMercenary(ownerPlayerId: number, spec?: HireMercenarySpec | undefined): number
  getMercenaryForOwner(ownerPlayerId: number): ServerMercenaryState | undefined
  getMercenaryState(unitIdOrOwnerId: number): ServerMercenaryState | undefined
  getMercenaryOrPetArea(unitId: number): number | undefined
  getMonsterOrAllyArea(unitId: number): number | undefined
  collectServerItemEntryStats113c(item: ServerItemEntry): ItemStat[]
  applyMercElementalWeaponRiders113c(owner: InternalPlayerRecord, merc: InternalMercenaryRecord, target: InternalMonsterRecord, attackKind: 'melee' | 'missile'): void
  triggerMercCtcProcs113c(owner: InternalPlayerRecord, merc: InternalMercenaryRecord, target: InternalMonsterRecord | undefined, triggerStatId: 195 | 196 | 198 | 201): void
  applyMercSplashPvp113c(owner: InternalPlayerRecord, merc: InternalMercenaryRecord, areaId: number, cx: number, cy: number, radiusSubtiles: number, msl: {
    readonly skillId: number
    readonly element: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag'
    readonly elemDamage: number
    readonly elemDurationFrames: number
  }, excludeIdKey?: number): void
  stepMercenaryMissiles113c(): void
  stepMercenaries(): void
}

export const mercenariesMethods: Record<keyof MercenariesMethods, unknown> = {
  resolveMercenaryAuraSources113c,
  stopMercenaryAura,
  syncMercenaryOwnerAura,
  pulseMercenaryAuraRuntime113c,
  stepMercenaryAuras,
  hireMercenary,
  getMercenaryForOwner,
  getMercenaryState,
  getMercenaryOrPetArea,
  getMonsterOrAllyArea,
  collectServerItemEntryStats113c,
  applyMercElementalWeaponRiders113c,
  triggerMercCtcProcs113c,
  applyMercSplashPvp113c,
  stepMercenaryMissiles113c,
  stepMercenaries,
}
