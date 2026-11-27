/**
 * GameInstance Subsystem: Hostile PvP Combat/Auras & Monster Velocity, Regen, Pathfinding & Curses (`src/server/engine/game-instance/pvp-and-monster-locomotion.ts`).
 */

import { MONMODE_RUN, MONMODE_WALK } from '../../../common/path/types.ts'
import { resolveArmorBlock113c, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { findPathWorld, type SubTilePoint } from '../../../common/path/pathfind.ts'
import { isHostilePvpCombatAllowed113c, isTownArea113c } from '../../combat/pvp-engine-113c.ts'
import type { DeathKillerKind113c } from '../../../common/progression/experience-113c.ts'
import { isBonePrisonMonsterHcIdx113c, isSubmergeCapableMonsterHcIdx113c } from '../../../common/units/monai-113c.ts'
import { resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import { isAlwaysRunAiMonster113c } from '../../ai/monumod-113c.ts'
import { doesDoorOrGateBlockMode113c, isDoorOrGateObject113c } from '../../../common/world/object-operate-113c.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { executeSUnitDmg, getPrePierceResistance113c, type SUnitDmgPacket, type CombatUnitContext } from '../combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import {
  allocateEvent3Seq113c,
  computeMonsterBaseDamageRegen113c,
  emitDotTraceEvent113c,
  hasLifeMaskState113c,
  stepMonsterEvent3HpRegen113c,
} from '../statregen-dot-113c.ts'
import { StateBus } from '../state-bus.ts'
import type { SkillTargetUnitType113c } from '../../skills/martial-dualwield-113c.ts'
import { computeDiminishingReturns } from '../../../common/data/calc-ast.ts'
import { difficultyResistPenalty } from '../difficulty-resist-penalty.ts'
import { RABIES_CONTAGION_INTERVAL_FRAMES_113C, RABIES_CONTAGION_RADIUS_SUBTILES_113C, STATE_RABIES_113C } from '../../skills/p1-wave4-skills-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord, PlayerSkillCast } from './types.ts'
import { CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C, MONSTER_ACTIVATION_RADIUS_SUBTILES, TOWN_AREAS, monsterAiBehavior, monsterHp256_113c, playerWirePosition, unitsDistanceToCoordinates113c } from './constants-and-helpers.ts'


// ===========================================================================================
// 1.13c Hostile PvP Targeting, Scaling & Damage Resolution (#1784)
// ===========================================================================================

function isHostilePvpPair113c(this: GameInstanceHost, 
  ownerPlayerIdA: number,
  areaIdA: number,
  ownerPlayerIdB: number,
  areaIdB: number,
  allowSeamAdjacent = false,
): boolean {
  if (!this.policy.allowPvpHostile) return false
  const areaOk = allowSeamAdjacent
    ? this.isAreaSeamAdjacent(areaIdA, areaIdB)
    : areaIdA === areaIdB
  return isHostilePvpCombatAllowed113c({
    allowPvpHostile: Boolean(this.policy.allowPvpHostile),
    attackerOwnerPlayerId: ownerPlayerIdA,
    attackerAreaId: areaIdA,
    defenderOwnerPlayerId: ownerPlayerIdB,
    defenderAreaId: areaIdB,
    areHostile: this.partyManager.areHostile(ownerPlayerIdA, ownerPlayerIdB),
    sameAreaOrSeamAdjacent: areaOk,
  })
}



function collectHostilePvpTargetsInArea113c(this: GameInstanceHost, 
  attackerOwnerId: number,
  attackerAreaId: number,
  allowSeamAdjacent = false,
): {
  readonly players: InternalPlayerRecord[]
  readonly mercs: InternalMercenaryRecord[]
  readonly pets: Array<{
    readonly ownerId: number
    readonly pet: SummonedPetUnit
    readonly petUnitId: number
    readonly areaId: number
  }>
} {
  if (!this.policy.allowPvpHostile || isTownArea113c(attackerAreaId)) {
    return { players: [], mercs: [], pets: [] }
  }
  const players: InternalPlayerRecord[] = []
  const mercs: InternalMercenaryRecord[] = []
  const pets: Array<{
    readonly ownerId: number
    readonly pet: SummonedPetUnit
    readonly petUnitId: number
    readonly areaId: number
  }> = []

  for (const p of this.players.values()) {
    if (p.dead || p.unitId === attackerOwnerId) continue
    if (this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, p.unitId, p.areaId, allowSeamAdjacent)) {
      players.push(p)
    }
  }
  for (const c of this.mercenaries.values()) {
    if (!c.alive || c.ownerPlayerId === attackerOwnerId) continue
    const cOwner = this.players.get(c.ownerPlayerId)
    if (!cOwner || cOwner.dead) continue
    if (this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, c.ownerPlayerId, c.areaId, allowSeamAdjacent)) {
      mercs.push(c)
    }
  }
  for (const [ownerId, mgr] of this.summonManagers.entries()) {
    if (ownerId === attackerOwnerId) continue
    const pOwner = this.players.get(ownerId)
    if (!pOwner || pOwner.dead) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      const petAreaId = (pet as unknown as { areaId?: number }).areaId ?? pOwner.areaId
      if (!this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, ownerId, petAreaId, allowSeamAdjacent)) {
        continue
      }
      const petUnitId = this.resolvePetUnitId(pet)
      pets.push({ ownerId, pet, petUnitId, areaId: petAreaId })
    }
  }
  return { players, mercs, pets }
}



function resolveHostilePvpTargetById113c(this: GameInstanceHost, 
  attackerOwnerId: number,
  attackerAreaId: number,
  targetId: number,
  targetType?: SkillTargetUnitType113c,
):
  | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
  | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
  | {
      readonly kind: 'pet'
      readonly ownerId: number
      readonly pet: SummonedPetUnit
      readonly petUnitId: number
      readonly areaId: number
    }
  | undefined {
  if (!this.policy.allowPvpHostile || isTownArea113c(attackerAreaId)) return undefined
  if (targetType === undefined || targetType === 0) {
    const targetPlayer = this.players.get(targetId)
    if (
      targetPlayer !== undefined &&
      !targetPlayer.dead &&
      this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, targetPlayer.unitId, targetPlayer.areaId)
    ) {
      return { kind: 'player', player: targetPlayer }
    }
  }
  if (targetType === undefined || targetType === 1) {
    const targetMerc = this.mercenaries.get(targetId)
    if (
      targetMerc !== undefined &&
      targetMerc.alive &&
      this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, targetMerc.ownerPlayerId, targetMerc.areaId)
    ) {
      return { kind: 'merc', merc: targetMerc }
    }
    for (const [ownerId, mgr] of this.summonManagers.entries()) {
      if (ownerId === attackerOwnerId) continue
      const pOwner = this.players.get(ownerId)
      if (!pOwner || pOwner.dead) continue
      for (const pet of mgr.getActivePets()) {
        if (pet.alive === false || pet.hp <= 0) continue
        const petUnitId = this.resolvePetUnitId(pet)
        if (petUnitId !== targetId) continue
        const petAreaId = (pet as unknown as { areaId?: number }).areaId ?? pOwner.areaId
        if (this.isHostilePvpPair113c(attackerOwnerId, attackerAreaId, ownerId, petAreaId)) {
          return { kind: 'pet', ownerId, pet, petUnitId, areaId: petAreaId }
        }
      }
    }
  }
  return undefined
}



function buildPlayerDefenderSnapshot113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly defenderCtx: CombatUnitContext
  readonly defenderStats: UnitStatList
  readonly defenderStateBus: StateBus
  readonly hadBoneArmor: boolean
  readonly activeBaPool: { current: number; max: number } | undefined
  readonly hadCycloneArmor: boolean
  readonly activeCaPool: { current: number; max: number } | undefined
} {
  const defenderStats = new UnitStatList(this.registry, undefined, {
    ownerType: 'player',
    charClass: player.classCode,
  })
  defenderStats.setBaseStat('level', player.level)
  defenderStats.setBaseStat('strength', player.strength + this.sumPlayerItemStat(player, 0))
  defenderStats.setBaseStat('vitality', player.vitality + this.sumPlayerItemStat(player, 3))
  defenderStats.setBaseStat('energy', player.energy + this.sumPlayerItemStat(player, 1))
  defenderStats.setBaseStat('tohit', this.computePlayerBaseToHit113c(player))
  let blockChance = this.sumPlayerItemStat(player, 20)
  let hasEquippedShield = false
  let hasAnyEquippedGear = false
  let rightHandWeaponType: string | undefined
  let leftHandWeaponType: string | undefined
  for (const item of player.items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    hasAnyEquippedGear = true
    const armorBlock = resolveArmorBlock113c(item.code)
    const isOffHandWeapon = item.bodyLoc === 5 && resolveWeaponBase113c(item.code) !== undefined
    if ((item.bodyLoc === 5 && !isOffHandWeapon) || (item.bodyLoc === 4 && armorBlock > 0)) {
      hasEquippedShield = true
    }
    if (item.bodyLoc === 4) {
      rightHandWeaponType = resolveWeaponBase113c(item.code)?.type
    } else if (item.bodyLoc === 5) {
      leftHandWeaponType = resolveWeaponBase113c(item.code)?.type
    }
    blockChance += armorBlock
  }
  const isClawType = (t: string | undefined) => t === 'h2h' || t === 'h2h2'
  const isDualClaw =
    !hasEquippedShield && isClawType(rightHandWeaponType) && isClawType(leftHandWeaponType)
  const equippedDex = this.sumPlayerItemStat(player, 2)
  let normalDr = this.sumPlayerItemStat(player, 34)
  let magicDr = this.sumPlayerItemStat(player, 35)
  let damageResist = this.sumPlayerItemStat(player, 36)
  let magicResist = this.sumPlayerItemStat(player, 37)
  let maxMagicResist = this.sumPlayerItemStat(player, 38)
  let fireResist = this.sumPlayerItemStat(player, 39)
  let maxFireResist = this.sumPlayerItemStat(player, 40)
  let lightResist = this.sumPlayerItemStat(player, 41)
  let maxLightResist = this.sumPlayerItemStat(player, 42)
  let coldResist = this.sumPlayerItemStat(player, 43)
  let maxColdResist = this.sumPlayerItemStat(player, 44)
  let poisonResist = this.sumPlayerItemStat(player, 45)
  let maxPoisonResist = this.sumPlayerItemStat(player, 46)
  let absorbFirePct = this.sumPlayerItemStat(player, 142)
  let absorbFire = this.sumPlayerItemStat(player, 143)
  let absorbLightPct = this.sumPlayerItemStat(player, 144)
  let absorbLight = this.sumPlayerItemStat(player, 145)
  let absorbMagicPct = this.sumPlayerItemStat(player, 146)
  let absorbMagic = this.sumPlayerItemStat(player, 147)
  let absorbColdPct = this.sumPlayerItemStat(player, 148)
  let absorbCold = this.sumPlayerItemStat(player, 149)
  const playerBaseDefense = this.computePlayerBaseDefense(player)
  const playerStats = this.playerCombatContext(player).statList
  const stateOnlyBonus = (stat: string): number => {
    let total = 0
    for (const m of playerStats.getActiveModifiers()) {
      if (m.id.startsWith('state:') || m.id.startsWith('state_')) {
        total += m.stats[stat] ?? 0
      }
    }
    return total
  }
  damageResist -= stateOnlyBonus('damageresist')
  fireResist -= stateOnlyBonus('fireresist')
  lightResist -= stateOnlyBonus('lightresist')
  coldResist -= stateOnlyBonus('coldresist')
  poisonResist -= stateOnlyBonus('poisonresist')
  defenderStats.setBaseStat('dexterity', player.dexterity + equippedDex)
  blockChance += Math.trunc(playerStats.getAccruedStat('toblock', true))
  normalDr += Math.trunc(playerStats.getAccruedStat('normal_damage_reduction'))
  magicDr += Math.trunc(playerStats.getAccruedStat('magic_damage_reduction'))
  damageResist += Math.trunc(getPrePierceResistance113c(playerStats, 'damageresist'))
  magicResist += Math.trunc(playerStats.getAccruedStat('magicresist'))
  fireResist += Math.trunc(getPrePierceResistance113c(playerStats, 'fireresist'))
  lightResist += Math.trunc(getPrePierceResistance113c(playerStats, 'lightresist'))
  coldResist += Math.trunc(getPrePierceResistance113c(playerStats, 'coldresist'))
  poisonResist += Math.trunc(getPrePierceResistance113c(playerStats, 'poisonresist'))
  maxMagicResist += Math.trunc(playerStats.getAccruedStat('maxmagicresist'))
  maxFireResist += Math.trunc(playerStats.getAccruedStat('maxfireresist'))
  maxLightResist += Math.trunc(playerStats.getAccruedStat('maxlightresist'))
  maxColdResist += Math.trunc(playerStats.getAccruedStat('maxcoldresist'))
  maxPoisonResist += Math.trunc(playerStats.getAccruedStat('maxpoisonresist'))
  absorbFirePct += Math.trunc(playerStats.getAccruedStat('item_absorbfire_percent', true))
  absorbFire += Math.trunc(playerStats.getAccruedStat('item_absorbfire', true))
  absorbLightPct += Math.trunc(playerStats.getAccruedStat('item_absorblight_percent', true))
  absorbLight += Math.trunc(playerStats.getAccruedStat('item_absorblight', true))
  absorbMagicPct += Math.trunc(playerStats.getAccruedStat('item_absorbmagic_percent', true))
  absorbMagic += Math.trunc(playerStats.getAccruedStat('item_absorbmagic', true))
  absorbColdPct += Math.trunc(playerStats.getAccruedStat('item_absorbcold_percent', true))
  absorbCold += Math.trunc(playerStats.getAccruedStat('item_absorbcold', true))
  const armorShrineBonusPct =
    player.states.has(128) && !this.playerCombatContext(player).stateBus.hasState(128) ? 100 : 0
  const baseDefWithPerLvlPct =
    playerBaseDefense +
    Math.trunc((playerBaseDefense * (this.sumPlayerItemStat(player, 215) + armorShrineBonusPct)) / 100)
  defenderStats.setBaseStat('armorclass', Math.max(0, baseDefWithPerLvlPct))
  defenderStats.setBaseStat('armorclass_vs_missile', this.sumPlayerItemStat(player, 32))
  defenderStats.setBaseStat('armorclass_vs_hth', this.sumPlayerItemStat(player, 33))
  defenderStats.setBaseStat('toblock', Math.max(0, blockChance))
  defenderStats.setBaseStat('normal_damage_reduction', normalDr)
  defenderStats.setBaseStat('magic_damage_reduction', magicDr)
  defenderStats.setBaseStat('damageresist', damageResist)
  defenderStats.setBaseStat('magicresist', magicResist)
  defenderStats.setBaseStat('fireresist', fireResist)
  defenderStats.setBaseStat('lightresist', lightResist)
  defenderStats.setBaseStat('coldresist', coldResist)
  defenderStats.setBaseStat('poisonresist', poisonResist)
  defenderStats.setBaseStat('maxmagicresist', maxMagicResist)
  defenderStats.setBaseStat('maxfireresist', maxFireResist)
  defenderStats.setBaseStat('maxlightresist', maxLightResist)
  defenderStats.setBaseStat('maxcoldresist', maxColdResist)
  defenderStats.setBaseStat('maxpoisonresist', maxPoisonResist)
  defenderStats.setBaseStat('item_absorbfire_percent', absorbFirePct)
  defenderStats.setBaseStat('item_absorbfire', absorbFire)
  defenderStats.setBaseStat('item_absorblight_percent', absorbLightPct)
  defenderStats.setBaseStat('item_absorblight', absorbLight)
  defenderStats.setBaseStat('item_absorbmagic_percent', absorbMagicPct)
  defenderStats.setBaseStat('item_absorbmagic', absorbMagic)
  defenderStats.setBaseStat('item_absorbcold_percent', absorbColdPct)
  defenderStats.setBaseStat('item_absorbcold', absorbCold)
  defenderStats.setBaseStat('item_cannotbefrozen', this.sumPlayerItemStat(player, 153))
  defenderStats.setBaseStat('item_halffreezeduration', this.sumPlayerItemStat(player, 118))
  defenderStats.setBaseStat('curse_resistance', this.sumPlayerItemStat(player, 109))
  defenderStats.setBaseStat('level', player.level)
  const defenderItemPoolStats = new UnitStatList(this.registry, undefined, {
    ownerType: 'item',
    charClass: player.classCode,
  })
  defenderItemPoolStats.setBaseStat('maxhp', this.sumPlayerItemPoolStat256(player, 7))
  defenderItemPoolStats.setBaseStat('maxmana', this.sumPlayerItemPoolStat256(player, 9))
  defenderItemPoolStats.setBaseStat('item_maxhp_percent', this.sumPlayerItemStat(player, 76))
  defenderItemPoolStats.setBaseStat('item_maxmana_percent', this.sumPlayerItemStat(player, 77))
  defenderItemPoolStats.setBaseStat('item_hp_perlevel', this.sumPlayerItemPoolStat256(player, 216))
  defenderItemPoolStats.setBaseStat('item_mana_perlevel', this.sumPlayerItemPoolStat256(player, 217))
  defenderStats.attachStatList(defenderItemPoolStats)
  defenderStats.setBaseStat('maxhp', player.maxHpFixed)
  defenderStats.setBaseStat('maxmana', player.maxManaFixed)
  for (const [skId, lvl] of player.skills.entries()) {
    defenderStats.setBaseSkillLevel(skId, lvl)
  }
  for (const passiveId of [13, 18, 29, 263]) {
    const basePts = player.skills.get(passiveId) ?? 0
    if (basePts > 0) {
      const effLvl = this.resolvePlayerSkillLevelById(player, passiveId)
      if (effLvl > basePts) {
        defenderStats.setBonusSkillLevel(passiveId, effLvl - basePts)
      }
    }
  }

  const defenderStateBus = new StateBus(defenderStats, this.registry)
  this.mirrorPersistentStates(this.playerCombat.get(player.unitId), defenderStateBus)
  defenderStats.setHp256(player.hpFixed)
  defenderStats.setMana256(player.manaFixed)
  const hasFadeActive =
    player.states.has(159) ||
    (player.states.has(157) && (player.skills.get(267) ?? 0) > 0 && (player.skills.get(258) ?? 0) === 0)
  if (hasFadeActive && !defenderStateBus.hasState('fade')) {
    const fadeRow = this.registry.getSkillById(267)
    const fadeSlvl = Math.max(1, this.resolvePlayerSkillLevelById(player, 267))
    const fadeStats =
      fadeRow !== undefined
        ? this.evaluateSkillStateStats(fadeRow, fadeSlvl, defenderStats)
        : { damageresist: fadeSlvl }
    defenderStateBus.applyState({
      stateNameOrId: 'fade',
      sourceSkillId: 267,
      slvl: fadeSlvl,
      durationFrames: player.stateTimers.get(159) ?? player.stateTimers.get(157) ?? 300,
      stats: fadeStats,
    })
  }
  if (player.states.has(10) && !defenderStateBus.hasState(10)) {
    defenderStateBus.applyState({
      stateNameOrId: 'frozenarmor',
      sourceSkillId: 40,
      slvl: Math.max(1, this.resolvePlayerSkillLevelById(player, 40)),
      durationFrames: player.stateTimers.get(10) ?? 300,
    })
  }
  if (player.states.has(20) && !defenderStateBus.hasState(20)) {
    defenderStateBus.applyState({
      stateNameOrId: 'chillingarmor',
      sourceSkillId: 60,
      slvl: Math.max(1, this.resolvePlayerSkillLevelById(player, 60)),
      durationFrames: player.stateTimers.get(20) ?? 300,
    })
  }
  if (player.states.has(30) && !defenderStateBus.hasState(30)) {
    defenderStateBus.applyState({
      stateNameOrId: 'energyshield',
      sourceSkillId: 58,
      slvl: Math.max(1, this.resolvePlayerSkillLevelById(player, 58)),
      durationFrames: player.stateTimers.get(30) ?? 300,
    })
  }
  if (player.states.has(88) && !defenderStateBus.hasState(88)) {
    defenderStateBus.applyState({
      stateNameOrId: 'shiverarmor',
      sourceSkillId: 50,
      slvl: Math.max(1, this.resolvePlayerSkillLevelById(player, 50)),
      durationFrames: player.stateTimers.get(88) ?? 300,
    })
  }
  let activeBaPool: { current: number; max: number } | undefined
  const hadBoneArmor = player.states.has(14)
  if (hadBoneArmor) {
    const baLvl = Math.max(1, this.resolvePlayerSkillLevelById(player, 68))
    const defaultBaMax =
      20 + 10 * (baLvl - 1) + 15 * ((player.skills.get(78) ?? 0) + (player.skills.get(88) ?? 0))
    activeBaPool = this.playerBoneArmorPool.get(player.unitId)
    if (activeBaPool === undefined) {
      activeBaPool = { current: defaultBaMax, max: defaultBaMax }
      this.playerBoneArmorPool.set(player.unitId, activeBaPool)
    }
    defenderStateBus.applyState({
      stateNameOrId: 'bonearmor',
      sourceSkillId: 68,
      slvl: baLvl,
      durationFrames: player.stateTimers.get(14) ?? 300,
      stats: { bonearmor: activeBaPool.current, bonearmormax: activeBaPool.max },
    })
  }
  let activeCaPool: { current: number; max: number } | undefined
  const hadCycloneArmor = player.states.has(151)
  if (hadCycloneArmor) {
    const caLvl = Math.max(1, this.resolvePlayerSkillLevelById(player, 235))
    const defaultCaMax = Math.trunc(
      ((40 + 12 * (caLvl - 1)) *
        (100 +
          7 *
            ((player.skills.get(240) ?? 0) +
              (player.skills.get(245) ?? 0) +
              (player.skills.get(250) ?? 0)))) /
        100,
    )
    activeCaPool = this.playerCycloneArmorPool.get(player.unitId)
    if (activeCaPool === undefined) {
      activeCaPool = { current: defaultCaMax, max: defaultCaMax }
      this.playerCycloneArmorPool.set(player.unitId, activeCaPool)
    }
    defenderStateBus.applyState({
      stateNameOrId: 'cyclonearmor',
      sourceSkillId: 235,
      slvl: caLvl,
      durationFrames: player.stateTimers.get(151) ?? 300,
      stats: { bonearmor: activeCaPool.current, bonearmormax: activeCaPool.max },
    })
  }
  if (hasAnyEquippedGear && !hasEquippedShield) {
    defenderStateBus.removeState(101)
    defenderStateBus.removeState('holyshield')
  } else if (player.states.has(101) && !defenderStateBus.hasState(101)) {
    const hsLvl = Math.max(1, this.resolvePlayerSkillLevelById(player, 117))
    const hsBlock = computeDiminishingReturns(10, 40, hsLvl)
    defenderStateBus.applyState({
      stateNameOrId: 'holyshield',
      sourceSkillId: 117,
      slvl: hsLvl,
      durationFrames: player.stateTimers.get(101) ?? 300,
      stats: {
        toblock: hsBlock,
        modifierlist_skill: 117,
        modifierlist_level: hsLvl,
      },
    })
  }

  const motionMoving = this.playerMotion.get(player.unitId)?.moving === true
  const isWalking =
    player.mode === 2 ||
    player.mode === 6 ||
    (motionMoving && !player.run && player.mode !== 3)
  const isRunning =
    player.mode === 3 ||
    (motionMoving && player.run && player.mode !== 2 && player.mode !== 6)

  const defenderCtx: CombatUnitContext = {
    id: `player_${player.unitId}`,
    name: player.name,
    charClass: player.classCode,
    unitType: 'player',
    statList: defenderStats,
    stateBus: defenderStateBus,
    x: player.x,
    y: player.y,
    hasShield: hasEquippedShield,
    ...(rightHandWeaponType !== undefined ? { weaponItemType: rightHandWeaponType } : {}),
    ...(leftHandWeaponType !== undefined ? { offHandWeaponItemType: leftHandWeaponType } : {}),
    isDualClaw,
    isMoving: motionMoving || isWalking || isRunning,
    isWalking,
    isRunning,
    resistPenalty: difficultyResistPenalty(this.difficulty),
  }

  return {
    defenderCtx,
    defenderStats,
    defenderStateBus,
    hadBoneArmor,
    activeBaPool,
    hadCycloneArmor,
    activeCaPool,
  }
}



function buildPvpAttackerContext113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  source: 'player' | InternalMercenaryRecord | SummonedPetUnit | { readonly petUnitId: number } = 'player',
): {
  readonly ctx: CombatUnitContext
  readonly killerType: DeathKillerKind113c
  readonly killerUnitId: number
} {
  const mercAttacker =
    typeof source === 'object' && source !== null && 'subType' in source ? source : undefined
  const petAttacker =
    typeof source === 'object' && source !== null && 'petType' in source ? source : undefined
  const detachedPet =
    typeof source === 'object' &&
    source !== null &&
    !('subType' in source) &&
    !('petType' in source) &&
    'petUnitId' in source
      ? source
      : undefined
  const attackerStats = new UnitStatList(this.registry, undefined, {
    ownerType:
      petAttacker !== undefined || mercAttacker !== undefined || detachedPet !== undefined
        ? 'monster'
        : 'player',
    charClass: owner.classCode,
  })

  if (detachedPet !== undefined) {
    attackerStats.setBaseStat('level', owner.level)
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    return {
      ctx: {
        id: `pet_${detachedPet.petUnitId}`,
        name: 'pet',
        unitType: 'minion',
        ownerUnitId: String(owner.unitId),
        statList: attackerStats,
        stateBus: attackerStateBus,
        x: owner.x,
        y: owner.y,
      },
      killerType: 'player_pet',
      killerUnitId: detachedPet.petUnitId,
    }
  }

  if (petAttacker !== undefined) {
    attackerStats.setBaseStat('level', petAttacker.statList.getAccruedStat('level') || owner.level)
    attackerStats.setBaseStat('strength', petAttacker.statList.getAccruedStat('strength'))
    attackerStats.setBaseStat('dexterity', petAttacker.statList.getAccruedStat('dexterity'))
    attackerStats.setBaseStat('tohit', petAttacker.statList.getAccruedStat('tohit'))
    attackerStats.setBaseStat('item_tohit_percent', petAttacker.statList.getAccruedStat('item_tohit_percent'))
    attackerStats.setBaseStat('armorclass', petAttacker.statList.getAccruedStat('armorclass'))
    attackerStats.setBaseStat('damagepercent', petAttacker.statList.getAccruedStat('damagepercent'))
    attackerStats.setBaseStat('mindamage', petAttacker.statList.getAccruedStat('mindamage'))
    attackerStats.setBaseStat('maxdamage', petAttacker.statList.getAccruedStat('maxdamage'))
    attackerStats.setBaseStat('maxhp', petAttacker.statList.getAccruedStat('maxhp'))
    attackerStats.setHp256(petAttacker.statList.getHp256())
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    const petUnitId = this.resolvePetUnitId(petAttacker)
    return {
      ctx: {
        id: petAttacker.uid,
        name: petAttacker.name || petAttacker.petType,
        unitType: 'minion',
        ownerUnitId: String(owner.unitId),
        statList: attackerStats,
        stateBus: attackerStateBus,
        x: petAttacker.x,
        y: petAttacker.y,
      },
      killerType: 'player_pet',
      killerUnitId: petUnitId,
    }
  }

  if (mercAttacker !== undefined) {
    const mercHireStats = resolveHirelingStatsAtLevel(
      mercAttacker.subType,
      mercAttacker.act,
      mercAttacker.difficulty,
      mercAttacker.level,
      true,
    )
    const mercStr =
      (mercHireStats?.str ?? 50 + mercAttacker.level * 2) + this.sumMercItemStat(mercAttacker, 0)
    const mercDex =
      (mercHireStats?.dex ?? 40 + mercAttacker.level * 2) + this.sumMercItemStat(mercAttacker, 2)
    const mercAr =
      (mercAttacker.ar ?? mercHireStats?.ar ?? 100 + mercAttacker.level * 20) +
      this.sumMercItemStat(mercAttacker, 19)
    attackerStats.setBaseStat('level', mercAttacker.level)
    attackerStats.setBaseStat('strength', mercStr)
    attackerStats.setBaseStat('dexterity', mercDex)
    attackerStats.setBaseStat('tohit', mercAr)
    attackerStats.setBaseStat('item_tohit_percent', this.sumMercItemStat(mercAttacker, 119))
    attackerStats.setBaseStat('armorclass', (mercAttacker.defense ?? 0) + this.sumMercItemStat(mercAttacker, 31))
    attackerStats.setBaseStat('item_deadlystrike', this.sumMercItemStat(mercAttacker, 141))
    attackerStats.setBaseStat('item_damagetargetac', this.sumMercItemStat(mercAttacker, 120))
    attackerStats.setBaseStat('maxhp', mercAttacker.maxHp * FIXED_ONE)
    attackerStats.setHp256(mercAttacker.hp * FIXED_ONE)
    const attackerStateBus = new StateBus(attackerStats, this.registry)
    this.mirrorPersistentStates(this.mercCombat.get(mercAttacker.unitId), attackerStateBus)
    return {
      ctx: {
        id: `merc_${mercAttacker.unitId}`,
        name: mercAttacker.name,
        unitType: 'mercenary',
        ownerUnitId: String(owner.unitId),
        statList: attackerStats,
        stateBus: attackerStateBus,
        x: mercAttacker.x,
        y: mercAttacker.y,
      },
      killerType: 'player_pet',
      killerUnitId: mercAttacker.unitId,
    }
  }

  attackerStats.setBaseStat('level', owner.level)
  attackerStats.setBaseStat('strength', owner.strength + this.sumPlayerItemStat(owner, 0))
  attackerStats.setBaseStat('dexterity', owner.dexterity + this.sumPlayerItemStat(owner, 2))
  attackerStats.setBaseStat('vitality', owner.vitality + this.sumPlayerItemStat(owner, 3))
  attackerStats.setBaseStat('energy', owner.energy + this.sumPlayerItemStat(owner, 1))
  attackerStats.setBaseStat('tohit', this.computePlayerBaseToHit113c(owner))
  attackerStats.setBaseStat('item_tohit_percent', this.computePlayerToHitPctBonus113c(owner))
  attackerStats.setBaseStat('armorclass', this.computePlayerBaseDefense(owner))
  attackerStats.setBaseStat('item_deadlystrike', this.sumPlayerItemStat(owner, 141))
  attackerStats.setBaseStat('item_damagetargetac', this.sumPlayerItemStat(owner, 120))
  attackerStats.setBaseStat('maxhp', this.getPlayerAccruedMaxHpFixed(owner))
  attackerStats.setHp256(owner.hpFixed)
  attackerStats.setBaseStat('maxmana', this.getPlayerAccruedMaxManaFixed(owner))
  attackerStats.setMana256(owner.manaFixed)
  const attackerStateBus = new StateBus(attackerStats, this.registry)
  this.mirrorPersistentStates(this.playerCombat.get(owner.unitId), attackerStateBus)
  return {
    ctx: {
      id: `player_${owner.unitId}`,
      name: owner.name,
      charClass: owner.classCode,
      unitType: 'player',
      statList: attackerStats,
      stateBus: attackerStateBus,
      x: owner.x,
      y: owner.y,
    },
    killerType: 'player',
    killerUnitId: owner.unitId,
  }
}



function applyPvpHitToTarget113c(this: GameInstanceHost, 
  attackerOwner: InternalPlayerRecord,
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
  spec: {
    readonly skillId: number
    readonly physDamage?: number | undefined
    readonly elemDamage?: number | undefined
    readonly elemDamage256?: number | undefined
    readonly elemType?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois' | undefined
    readonly elemDurationFrames?: number | undefined
    readonly attackKind?: 'melee' | 'missile' | 'spell' | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly nonLethal?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly skipGetHit?: boolean | undefined
    readonly suppressBlockAnim?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly toHitBonusPct?: number | undefined
    readonly concentrationAlreadyApplied?: boolean | undefined
    readonly vengeanceBasePhys?: number | undefined
    readonly multiElemPacket?: NonNullable<SUnitDmgPacket['multiElemPacket']> | undefined
    readonly source?:
      | 'player'
      | InternalMercenaryRecord
      | SummonedPetUnit
      | { readonly petUnitId: number }
      | undefined
  },
): boolean {
  const targetOwnerId =
    target.kind === 'player'
      ? target.player.unitId
      : target.kind === 'merc'
        ? target.merc.ownerPlayerId
        : target.ownerId
  const targetAreaId =
    target.kind === 'player'
      ? target.player.areaId
      : target.kind === 'merc'
        ? target.merc.areaId
        : target.areaId
  if (!this.isHostilePvpPair113c(attackerOwner.unitId, attackerOwner.areaId, targetOwnerId, targetAreaId, true)) {
    return false
  }
  // Holy Bolt (#101): undead-only gate (deals 0 damage to living players/hirelings).
  if (spec.skillId === 101) {
    return false
  }

  const atk = this.buildPvpAttackerContext113c(attackerOwner, spec.source ?? 'player')
  const atkCtx: CombatUnitContext =
    spec.vengeanceBasePhys !== undefined
      ? {
          ...atk.ctx,
          weaponMinPhys: spec.vengeanceBasePhys,
          weaponMaxPhys: spec.vengeanceBasePhys,
        }
      : atk.ctx
  const physDmg = Math.max(0, spec.physDamage ?? 0)
  const elemDmg256 =
    spec.elemDamage256 !== undefined
      ? Math.max(0, spec.elemDamage256)
      : Math.max(0, spec.elemDamage ?? 0) * FIXED_ONE
  const elemChannel =
    spec.elemType !== undefined && spec.elemType !== 'phys' ? spec.elemType : undefined
  const isSpell =
    spec.attackKind === 'spell' ||
    (spec.autoHit === true && physDmg <= 0 && elemDmg256 > 0)
  const packet: SUnitDmgPacket = {
    skillId: spec.skillId,
    attackKind: isSpell ? 'spell' : (spec.attackKind ?? 'melee'),
    srcDam: spec.multiElemPacket !== undefined ? 128 : 0,
    flatPhysMin256: spec.multiElemPacket !== undefined ? 0 : physDmg * FIXED_ONE,
    flatPhysMax256: spec.multiElemPacket !== undefined ? 0 : physDmg * FIXED_ONE,
    ...(elemChannel !== undefined && elemDmg256 > 0
      ? {
          elemType: elemChannel,
          elemMin256: elemDmg256,
          elemMax256: elemDmg256,
          elemDurationFrames: spec.elemDurationFrames ?? 0,
        }
      : {}),
    ...(spec.concentrationAlreadyApplied === true ? { concentrationAlreadyApplied: true } : {}),
    ...(spec.multiElemPacket !== undefined ? { multiElemPacket: spec.multiElemPacket } : {}),
    ...(spec.damageRate !== undefined && spec.damageRate > 0 ? { damageRate: spec.damageRate } : {}),
    ...(spec.toHitBonusPct !== undefined ? { toHitBonusPct: spec.toHitBonusPct } : {}),
    ...(spec.autoHit === true || isSpell || spec.skillId === 97 ? { autoHit: true } : {}),
    ...(spec.unblockable === true || isSpell ? { unblockable: true } : {}),
  }

  if (target.kind === 'player') {
    const defender = target.player
    if (defender.dead) return false
    const snap = this.buildPlayerDefenderSnapshot113c(defender)
    const dmgOut = executeSUnitDmg(atkCtx, snap.defenderCtx, packet, this.rng)
    if (!dmgOut.hit) {
      if (
        (dmgOut.avoidedReason === 'block' || dmgOut.avoidedReason === 'weapon_block') &&
        !spec.suppressBlockAnim
      ) {
        defender.mode = 9
        this.broadcastToArea(defender.areaId, {
          type: 'UnitMode',
          unitType: 0,
          id: defender.unitId,
          mode: 9,
          at: playerWirePosition(defender),
          lifePct:
            defender.maxHp > 0
              ? Math.max(0, Math.round((defender.hp / defender.maxHp) * 128))
              : 0,
        })
      }
      return false
    }

    // Sync Energy Shield mana deduction & collapse
    const newMana256 = snap.defenderStats.getMana256()
    if (newMana256 !== defender.manaFixed) {
      defender.manaFixed = Math.max(0, newMana256)
      defender.mana = Math.floor(defender.manaFixed / FIXED_ONE)
      this.emitToPlayer(defender.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: defender.unitId,
        statId: 8,
        value: defender.manaFixed,
      })
    }
    if (defender.states.has(30) && !snap.defenderStateBus.hasState('energyshield')) {
      this.clearUnitState(defender.states, defender.stateTimers, 'player', defender.unitId, defender.areaId, 30)
    }
    if (snap.hadBoneArmor && snap.activeBaPool !== undefined) {
      const postBa = snap.defenderStateBus.getState('bonearmor')
      const newBaPts = postBa ? (postBa.stats['bonearmor'] ?? 0) : 0
      if (newBaPts <= 0 || !snap.defenderStateBus.hasState('bonearmor')) {
        this.playerBoneArmorPool.delete(defender.unitId)
        this.clearUnitState(defender.states, defender.stateTimers, 'player', defender.unitId, defender.areaId, 14)
      } else if (newBaPts !== snap.activeBaPool.current) {
        this.playerBoneArmorPool.set(defender.unitId, {
          current: newBaPts,
          max: snap.activeBaPool.max,
        })
      }
    }
    if (snap.hadCycloneArmor && snap.activeCaPool !== undefined) {
      const postCa = snap.defenderStateBus.getState('cyclonearmor')
      const newCaPts = postCa ? (postCa.stats['bonearmor'] ?? 0) : 0
      if (newCaPts <= 0 || !snap.defenderStateBus.hasState('cyclonearmor')) {
        this.playerCycloneArmorPool.delete(defender.unitId)
        this.clearUnitState(defender.states, defender.stateTimers, 'player', defender.unitId, defender.areaId, 151)
      } else if (newCaPts !== snap.activeCaPool.current) {
        this.playerCycloneArmorPool.set(defender.unitId, {
          current: newCaPts,
          max: snap.activeCaPool.max,
        })
      }
    }

    // Thorns / Iron Maiden reflection back onto melee PvP attacker (`/ 4` PvP penalty in executeSUnitDmg)
    const reflectedDmg = Math.floor(
      ((dmgOut.attackerColdDamage256 ?? 0) + (dmgOut.reflectedPhys256 ?? 0)) / FIXED_ONE,
    )
    if (reflectedDmg > 0) {
      if (typeof spec.source === 'object' && spec.source !== null && 'subType' in spec.source) {
        this.applyDamageToMerc(spec.source, reflectedDmg, spec.source.areaId)
      } else if (typeof spec.source === 'object' && spec.source !== null && 'petType' in spec.source) {
        this.applyDamageToSummon(attackerOwner.unitId, spec.source, reflectedDmg, attackerOwner.areaId)
      } else if (!attackerOwner.dead) {
        this.applyDamageToPlayer(attackerOwner, reflectedDmg, {
          killerType: 'player',
          killerUnitId: defender.unitId,
        })
      }
    }

    const absorbHeal256 = dmgOut.absorbHeal256 ?? 0
    const poisonBitrate256 = dmgOut.poisonBitrate256 ?? 0
    const poisonDurationFrames = dmgOut.poisonDurationFrames ?? 0
    const poisonTotal256 =
      poisonBitrate256 > 0 && poisonDurationFrames > 0 ? poisonBitrate256 * poisonDurationFrames : 0
    const rawFinalDmg = Math.floor(Math.max(0, dmgOut.totalDamage256 - poisonTotal256) / FIXED_ONE)
    const finalDmg = spec.nonLethal ? Math.min(rawFinalDmg, Math.max(0, defender.hp - 1)) : rawFinalDmg
    if (absorbHeal256 > 0 && !defender.dead && defender.hpFixed > 0 && !defender.states.has(92)) {
      const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(defender)
      defender.hpFixed = Math.min(accruedMaxHpFixed, defender.hpFixed + absorbHeal256)
      defender.hp = Math.max(0, Math.ceil(defender.hpFixed / FIXED_ONE))
    }
    if (poisonBitrate256 > 0 && poisonDurationFrames > 0 && !defender.dead) {
      const defCtx = this.playerCombatContext(defender)
      const prevPois = defCtx.stateBus.getState(2) ?? defCtx.stateBus.getState('poison')
      const prevBitrate256 = prevPois
        ? Math.max(0, prevPois.stats['poisonmindam'] ?? -(prevPois.stats['hpregen'] ?? 0))
        : 0
      if (!defender.states.has(2) || prevPois === undefined || poisonBitrate256 >= prevBitrate256) {
        defCtx.stateBus.removeState('poison')
        defCtx.stateBus.applyState({
          stateNameOrId: 2,
          sourceUnitId: `player_${attackerOwner.unitId}`,
          sourceSkillId: spec.skillId ?? 0,
          slvl: Math.max(1, attackerOwner.level),
          durationFrames: poisonDurationFrames,
          currentFrame: this.currentFrame,
          stats: {
            hpregen: -poisonBitrate256,
            poisonmindam: poisonBitrate256,
            poisonlength: poisonDurationFrames,
          },
        })
        this.applyUnitState(
          defender.states,
          defender.stateTimers,
          'player',
          defender.unitId,
          defender.areaId,
          2,
          poisonDurationFrames,
        )
      }
    }
    if (elemChannel === 'cold' && (spec.elemDurationFrames ?? 0) > 0 && !defender.dead) {
      this.applyUnitState(
        defender.states,
        defender.stateTimers,
        'player',
        defender.unitId,
        defender.areaId,
        11,
        Math.max(1, spec.elemDurationFrames ?? 25),
      )
    }
    if (dmgOut.targetDefenseReduction !== undefined && dmgOut.targetDefenseReduction > 0) {
      const defCtx = this.playerCombatContext(defender)
      const prevMod =
        defCtx.stateBus.getState('damagetargetac')?.stats['armorclass'] ?? 0
      defCtx.stateBus.applyState({
        stateNameOrId: 'damagetargetac',
        durationFrames: 0,
        stats: { armorclass: prevMod - dmgOut.targetDefenseReduction },
      })
    }
    if (finalDmg > 0 && !defender.dead) {
      const pvpMissileKb =
        (spec.missileKnockbackChancePct ?? 0) > 0 &&
        this.rng.rand(100) < spec.missileKnockbackChancePct!
      this.applyDamageToPlayer(defender, finalDmg, {
        isPurePoison: elemChannel === 'pois' && physDmg <= 0,
        ...(spec.skipGetHit === true || pvpMissileKb ? { skipGetHit: true } : {}),
        killerType: atk.killerType,
        killerUnitId: atk.killerUnitId,
      })
      if (!defender.dead && pvpMissileKb) {
        this.knockbackPlayerFromBoss113c(defender, attackerOwner.x, attackerOwner.y, 2)
      }
    }
    return true
  }

  if (target.kind === 'merc') {
    const merc = target.merc
    if (!merc.alive) return false
    const defCtx = this.mercCombatContext(merc)
    const mercDef: CombatUnitContext = {
      ...defCtx,
      unitType: 'mercenary',
      ownerUnitId: String(merc.ownerPlayerId),
    }
    const dmgOut = executeSUnitDmg(atkCtx, mercDef, packet, this.rng)
    if (!dmgOut.hit) return false
    if (dmgOut.targetDefenseReduction !== undefined && dmgOut.targetDefenseReduction > 0) {
      merc.defense = Math.max(0, (merc.defense ?? 0) - dmgOut.targetDefenseReduction)
      defCtx.statList.setBaseStat('armorclass', merc.defense)
    }
    const poisonBitrate256 = dmgOut.poisonBitrate256 ?? 0
    const poisonDurationFrames = dmgOut.poisonDurationFrames ?? 0
    const poisonTotal256 =
      poisonBitrate256 > 0 && poisonDurationFrames > 0 ? poisonBitrate256 * poisonDurationFrames : 0
    if (poisonBitrate256 > 0 && poisonDurationFrames > 0) {
      defCtx.stateBus.removeState('poison')
      defCtx.stateBus.applyState({
        stateNameOrId: 2,
        sourceUnitId: `player_${attackerOwner.unitId}`,
        sourceSkillId: spec.skillId ?? 0,
        slvl: Math.max(1, attackerOwner.level),
        durationFrames: poisonDurationFrames,
        currentFrame: this.currentFrame,
        stats: {
          hpregen: -poisonBitrate256,
          poisonmindam: poisonBitrate256,
          poisonlength: poisonDurationFrames,
        },
      })
      this.applyUnitState(
        merc.states,
        merc.stateTimers,
        'monster',
        merc.unitId,
        merc.areaId,
        2,
        poisonDurationFrames,
      )
    }
    const rawDealt = Math.floor(Math.max(0, dmgOut.totalDamage256 - poisonTotal256) / FIXED_ONE)
    const dealt = spec.nonLethal ? Math.min(rawDealt, Math.max(0, merc.hp - 1)) : rawDealt
    if (dealt > 0) {
      this.applyDamageToMerc(merc, dealt, merc.areaId)
    }
    return true
  }

  const pet = target.pet
  if (pet.alive === false || pet.hp <= 0) return false
  pet.statList.setHp256(pet.hp * FIXED_ONE)
  const petDef: CombatUnitContext = {
    id: pet.uid,
    name: pet.name,
    unitType: 'minion',
    ownerUnitId: String(target.ownerId),
    statList: pet.statList,
    stateBus: pet.stateBus,
    x: pet.x,
    y: pet.y,
  }
  const dmgOut = executeSUnitDmg(atkCtx, petDef, packet, this.rng)
  if (!dmgOut.hit) return false
  const poisonBitrate256 = dmgOut.poisonBitrate256 ?? 0
  const poisonDurationFrames = dmgOut.poisonDurationFrames ?? 0
  const poisonTotal256 =
    poisonBitrate256 > 0 && poisonDurationFrames > 0 ? poisonBitrate256 * poisonDurationFrames : 0
  if (poisonBitrate256 > 0 && poisonDurationFrames > 0) {
    const vis = this.petVisualStates.get(target.petUnitId)
    if (vis !== undefined) {
      this.applyUnitState(
        vis.states,
        vis.timers,
        'monster',
        target.petUnitId,
        target.areaId,
        2,
        poisonDurationFrames,
      )
    }
  }
  const rawDealt = Math.floor(Math.max(0, dmgOut.totalDamage256 - poisonTotal256) / FIXED_ONE)
  const dealt = spec.nonLethal ? Math.min(rawDealt, Math.max(0, pet.hp - 1)) : rawDealt
  pet.hp = Math.max(0, pet.hp)
  pet.statList.setHp256(pet.hp * FIXED_ONE)
  if (dealt > 0) {
    this.applyDamageToSummon(target.ownerId, pet, dealt, target.areaId)
  }
  return true
}



function applyPvpSkillHitToTarget113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
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
  attackKind: 'melee' | 'missile' | 'spell' = 'melee',
): boolean {
  const ev = cast.evalResult
  const phys = this.rollPlayerSkillPhysDamage(player, cast)
  const elemType =
    ev.elemType === 'fire' ||
    ev.elemType === 'ltng' ||
    ev.elemType === 'cold' ||
    ev.elemType === 'mag' ||
    ev.elemType === 'pois'
      ? ev.elemType
      : undefined
  const elem =
    elemType === 'pois' && ev.durationFrames > 0
      ? Math.max(
          1,
          Math.floor(
            (this.rollInclusive(ev.minElemDmg256, ev.maxElemDmg256) * ev.durationFrames) / FIXED_ONE,
          ),
        )
      : elemType !== undefined
        ? this.rollInclusive(ev.minElemDmg, ev.maxElemDmg)
        : 0
  return this.applyPvpHitToTarget113c(player, target, {
    skillId: cast.skill.id,
    physDamage: phys,
    elemDamage: elem,
    elemType,
    elemDurationFrames: ev.durationFrames,
    attackKind,
    autoHit: attackKind === 'spell' || cast.skill.id === 97,
    unblockable: attackKind === 'spell',
  })
}



function applyPvpDebuffStateToTarget113c(this: GameInstanceHost, 
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
  stateId: number,
  durationFrames: number,
  sourceUnitId: string,
  sourceSkillId: number,
  slvl: number,
  stats?: Record<string, number>,
): void {
  if (durationFrames <= 0) return
  if (target.kind === 'player') {
    const p = target.player
    if (p.dead) return
    this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, stateId, durationFrames)
    this.playerCombatContext(p).stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId,
      sourceSkillId,
      slvl,
      durationFrames,
      currentFrame: this.currentFrame,
      ...(stats !== undefined ? { stats } : {}),
    })
    return
  }
  if (target.kind === 'merc') {
    const c = target.merc
    if (!c.alive) return
    this.applyUnitState(c.states, c.stateTimers, 'monster', c.unitId, c.areaId, stateId, durationFrames)
    this.mercCombatContext(c).stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId,
      sourceSkillId,
      slvl,
      durationFrames,
      currentFrame: this.currentFrame,
      ...(stats !== undefined ? { stats } : {}),
    })
    return
  }
  target.pet.stateBus.applyState({
    stateNameOrId: stateId,
    sourceUnitId,
    sourceSkillId,
    slvl,
    durationFrames,
    currentFrame: this.currentFrame,
    ...(stats !== undefined ? { stats } : {}),
  })
}



function buildHostileAuraPvpEnemies113c(this: GameInstanceHost, 
  attackerOwnerId: number,
  areaId: number,
  inRange: (x: number, y: number) => boolean,
): Array<{
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
  readonly ctx: CombatUnitContext
  readonly preHp256: number
}> {
  const hostiles = this.collectHostilePvpTargetsInArea113c(attackerOwnerId, areaId)
  const out: Array<{
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
    readonly ctx: CombatUnitContext
    readonly preHp256: number
  }> = []
  for (const p of hostiles.players) {
    if (!inRange(p.x, p.y)) continue
    const snap = this.buildPlayerDefenderSnapshot113c(p)
    out.push({
      target: { kind: 'player', player: p },
      ctx: snap.defenderCtx,
      preHp256: p.hpFixed,
    })
  }
  for (const c of hostiles.mercs) {
    if (!inRange(c.x, c.y)) continue
    const base = this.mercCombatContext(c)
    const ctx: CombatUnitContext = {
      ...base,
      unitType: 'mercenary',
      ownerUnitId: String(c.ownerPlayerId),
    }
    out.push({
      target: { kind: 'merc', merc: c },
      ctx,
      preHp256: c.hp * FIXED_ONE,
    })
  }
  for (const entry of hostiles.pets) {
    if (!inRange(entry.pet.x, entry.pet.y)) continue
    entry.pet.statList.setHp256(entry.pet.hp * FIXED_ONE)
    const ctx: CombatUnitContext = {
      id: entry.pet.uid,
      name: entry.pet.name,
      unitType: 'minion',
      ownerUnitId: String(entry.ownerId),
      statList: entry.pet.statList,
      stateBus: entry.pet.stateBus,
      x: entry.pet.x,
      y: entry.pet.y,
    }
    out.push({
      target: { kind: 'pet', ...entry },
      ctx,
      preHp256: entry.pet.hp * FIXED_ONE,
    })
  }
  return out
}



function syncHostileAuraPvpEnemies113c(this: GameInstanceHost, 
  pvpEnemies: ReadonlyArray<{
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
    readonly ctx: CombatUnitContext
    readonly preHp256: number
  }>,
  killerType: DeathKillerKind113c,
  killerUnitId: number,
): void {
  for (const item of pvpEnemies) {
    const { target, ctx, preHp256 } = item
    // Sync offensive aura target states (`44` holywindcold, `28` conviction)
    for (const auraStateId of [44, 28] as const) {
      const entry = ctx.stateBus.getActiveEntries().find((e) => e.stateId === auraStateId)
      if (entry !== undefined) {
        const rem = entry.expireFrame > 0 ? Math.max(1, entry.expireFrame - this.currentFrame) : 25
        this.applyPvpDebuffStateToTarget113c(
          target,
          auraStateId,
          rem,
          entry.sourceUnitId ?? `player_${killerUnitId}`,
          entry.sourceSkillId,
          entry.slvl,
          entry.stats,
        )
      }
    }
    const postHp256 = ctx.statList.getHp256()
    if (postHp256 < preHp256) {
      const dealt = Math.max(1, Math.floor((preHp256 - postHp256) / FIXED_ONE))
      if (target.kind === 'player' && !target.player.dead) {
        this.applyDamageToPlayer(target.player, dealt, {
          skipGetHit: true,
          killerType,
          killerUnitId,
        })
      } else if (target.kind === 'merc' && target.merc.alive) {
        this.applyDamageToMerc(target.merc, dealt, target.merc.areaId)
      } else if (target.kind === 'pet' && target.pet.alive !== false && target.pet.hp > 0) {
        target.pet.hp = Math.ceil(preHp256 / FIXED_ONE)
        target.pet.statList.setHp256(preHp256)
        this.applyDamageToSummon(target.ownerId, target.pet, dealt, target.areaId)
      }
    }
  }
}



/**
 * 1.13c STAT_VELOCITYPERCENT (stat 67) for a monster: base 100%, Extra Fast
 * (MonUMod 6) +50%, chill/Decrepify/Holy Freeze slow, and active Frenzy bonus.
 */
function monsterVelocityPercent(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  const velocityPct =
    100 +
    (monster.umodIds.includes(6) ? 50 : 0) +
    (monster.states.has(140) ? 50 : 0) -
    this.monsterSlowPercent(monster) +
    (this.currentFrame < monster.frenzyUntilFrame ? monster.frenzySpeedPct : 0)
  return Math.max(5, velocityPct)
}



/**
 * 1.13c movement rate: MonStats `Velocity`/`Run` are yards/s; 1 yard = 1.5 sub-tiles,
 * 25 ticks/s. Extra Fast (MonUMod 6) is +50%; chill/Decrepify/Holy Freeze halve it.
 */
function monsterStepSpeed(this: GameInstanceHost, monster: InternalMonsterRecord, running: boolean): number {
  const isSuicideSprint = running && monsterAiBehavior(monster.ai) === 'suicide'
  const yards = isSuicideSprint
    ? Math.max(14, monster.runSpeed * 1.5)
    : running
      ? monster.runSpeed
      : monster.velocity
  const base = (Math.max(1, yards || 6) * 1.5) / 25
  return base * (this.monsterVelocityPercent(monster) / 100)
}



/**
 * Total 1.13c movement-slow percentage for a monster. Cold uses `MonStats.txt`
 * `ColdEffect` (Normal -50, Nightmare -40, Hell -25 for most rows); Decrepify is
 * -50; Holy Freeze's `holywindcold` (state 44) carries the skill-level slow in
 * `velocitypercent` (`30% + 5%/lvl` diminished, cap 60).
 */
function monsterSlowPercent(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  let slowPct = 0
  if (monster.states.has(11) || (monster.chillTicks > 0 && !monster.states.has(44))) {
    slowPct += Math.min(100, Math.abs(monster.coldEffect))
  }
  const bus = this.monsterCombat.get(monster.unitId)?.stateBus
  const addStateSlow = (stateId: number, fallbackPct: number): void => {
    if (!monster.states.has(stateId) && !bus?.hasState(stateId)) return
    const entry = bus?.getState(stateId)
    slowPct += Math.min(100, Math.abs(entry?.stats.velocitypercent ?? fallbackPct))
  }
  addStateSlow(60, 50)
  // State 24 `slowed` (Clay Golem slow target): the capped `item_slow` stored when it was applied.
  if (monster.states.has(24) && monster.slowedPct113c !== undefined) slowPct += monster.slowedPct113c
  // `holywindcold` (44) is the target state; `holywind` (43) is the caster's own aura.
  if (bus?.hasState(44) || monster.states.has(44)) {
    addStateSlow(44, 25)
  } else {
    addStateSlow(43, 25)
  }
  return Math.min(95, slowPct)
}



/**
 * 1.13c per-frame poison DoT tick (`D2Game.dll` `0x6FC97410`): accumulates `poisonBitrate256`
 * (`1/256` HP/frame) over `poisonRemainingFrames` (`ELen`), subtracting whole HP points each frame
 * so the total HP lost over `ELen` frames is `(poisonBitrate256 * ELen) >> 8`.
 */
function stepMonsterPoison(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  if (monster.dead || monster.isNpc || !monster.isKillable || monster.submerged) return
  // #1886: Druid `#238 Rabies` (`rabiesplague` `#515`: `Param1 = 4`f interval, `Param2 = 7` sub-tiles)
  if (monster.rabiesInfection !== undefined) {
    const inf = monster.rabiesInfection
    const remFrames = inf.expireFrame - this.currentFrame
    if (remFrames <= 0) {
      monster.rabiesInfection = undefined
      this.clearUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        STATE_RABIES_113C,
      )
    } else if (remFrames % RABIES_CONTAGION_INTERVAL_FRAMES_113C === 0) {
      const attacker = this.players.get(inf.attackerId)
      if (attacker !== undefined) {
        for (const other of this.monsters.values()) {
          if (
            other.unitId === monster.unitId ||
            other.dead ||
            other.isNpc ||
            !other.isKillable ||
            other.submerged ||
            other.areaId !== monster.areaId ||
            other.boneConstructOwnerPlayerId !== undefined ||
            other.align !== 0 ||
            this.isMonsterConverted(other)
          ) {
            continue
          }
          if (
            other.rabiesInfection !== undefined &&
            other.rabiesInfection.expireFrame >= inf.expireFrame
          ) {
            continue
          }
          const dist = Math.hypot(other.x - monster.x, other.y - monster.y)
          if (dist > RABIES_CONTAGION_RADIUS_SUBTILES_113C) continue
          if (this.applyMonsterPoisonDot(attacker, other, inf.rawBitrate256, remFrames, 238)) {
            this.applyUnitState(
              other.states,
              other.stateTimers,
              'monster',
              other.unitId,
              other.areaId,
              STATE_RABIES_113C,
              remFrames,
            )
            other.rabiesInfection = {
              expireFrame: inf.expireFrame,
              rawBitrate256: inf.rawBitrate256,
              attackerId: inf.attackerId,
              slvl: inf.slvl,
            }
          }
        }
      }
    }
  }
  if (this.drlgRoomPopulator !== null) {
    // DRLG 1.13c path handles poison and `stat 74` DoT ticks inside `MONSTER_Event3_HpRegen` (`stepMonsterRegen`).
    if (!monster.states.has(2)) {
      monster.poisonRemainingFrames = 0
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
      monster.poisonKillSource = undefined
    }
    return
  }
  if (monster.poisonRemainingFrames <= 0 || monster.poisonBitrate256 <= 0) return
  monster.poisonRemainingFrames -= 1
  monster.poisonCarry256 += monster.poisonBitrate256
  const wholeDmg = Math.floor(monster.poisonCarry256 / FIXED_ONE)
  if (wholeDmg > 0) {
    monster.poisonCarry256 -= wholeDmg * FIXED_ONE
    monster.hp = Math.max(0, monster.hp - wholeDmg)
    this.broadcastToArea(monster.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: monster.unitId,
      statId: 6,
      value: monster.hp,
    })
    if (monster.hp <= 0) {
      const attacker =
        this.players.get(monster.poisonAttackerId) ??
        this.players.values().next().value
      const poisKillSource =
        monster.poisonKillSource ?? (monster.lastHitByMerc ? 'merc' : 'player')
      monster.poisonRemainingFrames = 0
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
      monster.poisonKillSource = undefined
      if (attacker !== undefined) {
        this.applyMonsterDeath(monster, attacker, 'pois', poisKillSource)
      } else {
        monster.dead = true
        monster.mode = 12
      }
      return
    }
  }
  if (monster.poisonRemainingFrames <= 0) {
    monster.poisonBitrate256 = 0
    monster.poisonCarry256 = 0
  }
}



/**
 * `MonStats.txt` `DamageRegen`: `maxHp * DamageRegen / 8192` life per frame.
 * The fractional remainder is carried so low regeneration rates still tick.
 */
function stepMonsterRegen(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  if (this.drlgRoomPopulator !== null) {
    if (monster.nextEvent3Frame113c !== this.currentFrame) return
    monster.nextEvent3Frame113c = undefined
    if (monster.dead || monster.isNpc || !monster.isKillable || monster.mode === 0 || monster.mode === 12) return
    if (!monster.states.has(2)) {
      monster.poisonRemainingFrames = 0
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
      monster.poisonKillSource = undefined
    }
    const combat = this.monsterCombat.get(monster.unitId)
    const stateBus = combat?.stateBus
    const hasState = (id: number): boolean =>
      monster.states.has(id) ||
      Boolean(stateBus?.hasState(id)) ||
      (id === 62 && this.monsterOpenWounds.has(monster.unitId))
    const hp0 = monsterHp256_113c(monster)
    const maxHp256 = monster.maxHp * FIXED_ONE
    const baseRegen256 = computeMonsterBaseDamageRegen113c(
      maxHp256,
      monster.damageRegen,
      monster.boneConstructOwnerPlayerId !== undefined,
    )
    const poisonMod256 = monster.states.has(2) && monster.poisonBitrate256 > 0 ? -monster.poisonBitrate256 : 0
    const owEntry = this.monsterOpenWounds.get(monster.unitId)
    const owMod256 = owEntry !== undefined && owEntry.remainingFrames > 0 ? -owEntry.bitrate256 : 0
    const statListMod256 = combat !== undefined ? Math.trunc(combat.statList.getModifierBonus('hpregen')) : 0
    const outcome = stepMonsterEvent3HpRegen113c({
      hp0,
      maxHp256,
      baseRegen256,
      modRegen256: poisonMod256 + owMod256 + statListMod256,
      hasLifeMaskState: hasLifeMaskState113c(hasState),
      hasPreventHeal: hasState(52),
      inTown: isTownArea113c(monster.areaId),
    })
    if (outcome.reschedule && !outcome.killed) {
      monster.nextEvent3Frame113c = this.currentFrame + 1
      monster.event3Seq113c = allocateEvent3Seq113c(this)
    }
    if (outcome.changed) {
      monster.hp = Math.ceil(outcome.hp1 / FIXED_ONE)
      monster.hp256 = outcome.hp1
      monster.hp256Whole = monster.hp
      emitDotTraceEvent113c({
        unitType: 1,
        unitId: monster.unitId,
        hp0,
        hp1: outcome.hp1,
      })
    }
    if (outcome.killed) {
      const attackerId = monster.states.has(2)
        ? monster.poisonAttackerId
        : (owEntry?.attackerId ?? monster.poisonAttackerId)
      const attacker =
        (attackerId ? this.players.get(attackerId) : undefined) ??
        this.players.values().next().value
      const killSource = monster.poisonKillSource ?? (monster.lastHitByMerc ? 'merc' : 'player')
      monster.poisonRemainingFrames = 0
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
      monster.poisonKillSource = undefined
      monster.nextEvent3Frame113c = undefined
      if (attacker !== undefined) {
        this.applyMonsterDeath(monster, attacker, 'pois', killSource)
      } else {
        monster.dead = true
        monster.mode = 0
      }
    }
    return
  }
  if (
    monster.dead ||
    monster.damageRegen <= 0 ||
    monster.hp >= monster.maxHp
  ) {
    return
  }
  // Poison (state 2), Open Wounds (62) and Prevent Monster Heal (52) suppress
  // natural regeneration in 1.13c.
  const stateBus = this.monsterCombat.get(monster.unitId)?.stateBus
  if (
    this.monsterOpenWounds.has(monster.unitId) ||
    monster.states.has(2) ||
    monster.states.has(62) ||
    monster.states.has(52) ||
    stateBus?.hasState(2) ||
    stateBus?.hasState(62) ||
    stateBus?.hasState(52)
  ) {
    return
  }
  monster.regenCarry += (monster.maxHp * monster.damageRegen) / 8192
  const whole = Math.floor(monster.regenCarry)
  if (whole <= 0) return
  monster.regenCarry -= whole
  const nextHp = Math.min(monster.maxHp, monster.hp + whole)
  if (nextHp === monster.hp) return
  monster.hp = nextHp
  this.broadcastToArea(monster.areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId: monster.unitId,
    statId: 6,
    value: monster.hp,
  })
}



interface IndexedWorldRoomRect {
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

interface RoomSpatialIndex113c {
  loadedAreasSize: number
  totalRoomRects: number
  readonly buckets: Map<number, IndexedWorldRoomRect[]>
}

const ROOM_SPATIAL_BUCKET_SHIFT_113C = 6 // 64x64 world sub-tile buckets
const roomSpatialIndexByHost113c = new WeakMap<GameInstanceHost, RoomSpatialIndex113c>()

function roomSpatialBucketKey113c(bx: number, by: number): number {
  return bx * 65536 + by
}

function syncRoomSpatialIndex113c(host: GameInstanceHost): RoomSpatialIndex113c {
  let totalRoomRects = 0
  for (const record of host.loadedAreas.values()) {
    totalRoomRects += record.roomRects.length
  }
  let index = roomSpatialIndexByHost113c.get(host)
  if (
    index !== undefined &&
    index.loadedAreasSize === host.loadedAreas.size &&
    index.totalRoomRects === totalRoomRects
  ) {
    return index
  }
  const buckets = new Map<number, IndexedWorldRoomRect[]>()
  for (const [areaId, record] of host.loadedAreas) {
    for (const room of record.roomRects) {
      if (room.w <= 0 || room.h <= 0) continue
      const entry: IndexedWorldRoomRect = {
        areaId,
        x: room.x,
        y: room.y,
        w: room.w,
        h: room.h,
      }
      const minBx = Math.floor(room.x) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
      const maxBx = Math.floor(room.x + room.w - 1e-6) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
      const minBy = Math.floor(room.y) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
      const maxBy = Math.floor(room.y + room.h - 1e-6) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
      for (let bx = minBx; bx <= maxBx; bx++) {
        for (let by = minBy; by <= maxBy; by++) {
          const key = roomSpatialBucketKey113c(bx, by)
          let list = buckets.get(key)
          if (list === undefined) {
            list = []
            buckets.set(key, list)
          }
          list.push(entry)
        }
      }
    }
  }
  index = {
    loadedAreasSize: host.loadedAreas.size,
    totalRoomRects,
    buckets,
  }
  roomSpatialIndexByHost113c.set(host, index)
  return index
}

function findRoomRectInArea113c(
  index: RoomSpatialIndex113c,
  areaId: number,
  x: number,
  y: number,
): IndexedWorldRoomRect | undefined {
  const bx = Math.floor(x) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
  const by = Math.floor(y) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
  const list = index.buckets.get(roomSpatialBucketKey113c(bx, by))
  if (list === undefined) return undefined
  for (let i = 0; i < list.length; i++) {
    const room = list[i]!
    if (
      room.areaId === areaId &&
      x >= room.x &&
      x < room.x + room.w &&
      y >= room.y &&
      y < room.y + room.h
    ) {
      return room
    }
  }
  return undefined
}

/**
 * 1.13c `DUNGEON_GetRoomAtPosition` (`D2Common.dll` `#11022` @ `0x6FD51330`, #2016):
 * When `referenceAreaId` is supplied, checks `referenceAreaId`'s own rooms first
 * (`0x6FD51337..0x6FD51355`), then only rooms in stitched seam-adjacent areas
 * (`ppRoomList` @ `0x6FD51357..0x6FD513A0`), returning `undefined` (`NULL`) outside
 * so cross-Act or disjoint levels sharing world coordinates never pollute collision.
 */
function lookupAreaIdWithSpatialIndex113c(
  host: GameInstanceHost,
  index: RoomSpatialIndex113c,
  x: number,
  y: number,
  referenceAreaId?: number,
): number | undefined {
  if (referenceAreaId !== undefined) {
    if (findRoomRectInArea113c(index, referenceAreaId, x, y) !== undefined) {
      return referenceAreaId
    }
    const bx = Math.floor(x) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
    const by = Math.floor(y) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
    const list = index.buckets.get(roomSpatialBucketKey113c(bx, by))
    if (list === undefined) return undefined
    for (let i = 0; i < list.length; i++) {
      const room = list[i]!
      if (
        room.areaId !== referenceAreaId &&
        x >= room.x &&
        x < room.x + room.w &&
        y >= room.y &&
        y < room.y + room.h &&
        host.isAreaSeamAdjacent(referenceAreaId, room.areaId)
      ) {
        return room.areaId
      }
    }
    return undefined
  }
  const bx = Math.floor(x) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
  const by = Math.floor(y) >> ROOM_SPATIAL_BUCKET_SHIFT_113C
  const list = index.buckets.get(roomSpatialBucketKey113c(bx, by))
  if (list === undefined) return undefined
  for (let i = 0; i < list.length; i++) {
    const room = list[i]!
    if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
      return room.areaId
    }
  }
  return undefined
}

function areaIdAtWorldPoint(
  this: GameInstanceHost,
  x: number,
  y: number,
  referenceAreaId?: number,
): number | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return lookupAreaIdWithSpatialIndex113c(this, syncRoomSpatialIndex113c(this), x, y, referenceAreaId)
}



/** D2Common path search over the area collision window (`unitSize: 1` for monsters). */
function findMonsterPath(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  targetX: number,
  targetY: number,
): readonly SubTilePoint[] {
  const check = this.terrainWalkableCheck
  const hasBoneWall = !monster.isFlying && this.hasLivingBonePrisonInArea(monster.areaId)
  if (!check && !hasBoneWall) {
    let hasClosedDoor = false
    for (const obj of this.objects.values()) {
      if (
        isDoorOrGateObject113c(obj.classId) &&
        doesDoorOrGateBlockMode113c(obj.classId, obj.mode) &&
        this.isAreaSeamAdjacent(monster.areaId, obj.areaId)
      ) {
        hasClosedDoor = true
        break
      }
    }
    if (!hasClosedDoor) {
      return [{ x: Math.round(targetX), y: Math.round(targetY) }]
    }
  }
  const margin = 20
  const minX = Math.max(0, Math.floor(Math.min(monster.x, targetX)) - margin)
  const minY = Math.max(0, Math.floor(Math.min(monster.y, targetY)) - margin)
  const maxX = Math.floor(Math.max(monster.x, targetX)) + margin
  const maxY = Math.floor(Math.max(monster.y, targetY)) + margin
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const walkable = new Uint8Array(w * h)
  const spatialIndex = syncRoomSpatialIndex113c(this)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = minX + x
      const wy = minY + y
      const pointArea =
        lookupAreaIdWithSpatialIndex113c(this, spatialIndex, wx, wy, monster.areaId) ?? monster.areaId
      const blockedByBone =
        hasBoneWall &&
        this.isBlockedByBonePrison(pointArea, wx, wy) &&
        Math.hypot(wx - monster.x, wy - monster.y) >= 1.3
      walkable[y * w + x] =
        !this.isClosedDoorAt(pointArea, wx, wy) &&
        !blockedByBone &&
        (!check || check(pointArea, wx, wy, monster.isFlying))
          ? 1
          : 0
    }
  }
  return findPathWorld(
    { subWidth: w, subHeight: h, walkable, subOriginX: minX, subOriginY: minY },
    monster.x,
    monster.y,
    targetX,
    targetY,
    { unitSize: 1, maxExpandedNodes: 2048 },
  ).path
}



/** Unit-size cell occupancy: monsters, players, mercs and pets block each other. */
function isMonsterCellOccupied(this: GameInstanceHost, monster: InternalMonsterRecord, x: number, y: number): boolean {
  const selfRadius = Math.max(0.5, 0.75 + (monster.sizeX - 2) * 0.25)
  // Units already overlapping the monster may only move *away* from that same
  // unit; every other occupant still blocks the destination cell.
  const blocksDestination = (ox: number, oy: number, oradius: number): boolean => {
    const threshold = (selfRadius + oradius) * 0.5
    if (Math.abs(ox - x) >= threshold || Math.abs(oy - y) >= threshold) return false
    const nextDist = Math.hypot(ox - x, oy - y)
    if (nextDist >= threshold) return false
    const currentDist = Math.hypot(ox - monster.x, oy - monster.y)
    if (currentDist >= threshold) return true
    return nextDist <= currentDist + 1e-6
  }

  for (const other of this.monsters.values()) {
    if (other.unitId === monster.unitId || other.dead || other.isNpc) continue
    const oradius = isBonePrisonMonsterHcIdx113c(other.hcIdx)
      ? 1.3
      : Math.max(0.5, 0.75 + (other.sizeX - 2) * 0.25)
    const threshold = (selfRadius + oradius) * 0.5
    if (Math.abs(other.x - x) >= threshold || Math.abs(other.y - y) >= threshold) continue
    if (!this.isAreaSeamAdjacent(monster.areaId, other.areaId)) continue
    if (blocksDestination(other.x, other.y, oradius)) return true
  }
  for (const p of this.players.values()) {
    if (p.dead || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) continue
    if (blocksDestination(p.x, p.y, 0.75)) return true
  }
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) continue
    const mercOwner = this.players.get(merc.ownerPlayerId)
    if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))) continue
    if (blocksDestination(merc.x, merc.y, 0.75)) return true
  }
  for (const [ownerId, mgr] of this.summonManagers) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      if (blocksDestination(pet.x, pet.y, 0.75)) return true
    }
  }
  return false
}



/**
 * Follow (or recompute) the cached path toward `(targetX, targetY)` and broadcast the
 * 1.13c `UnitMove` walk/run step. Returns the remaining distance to the target.
 */
function moveMonsterToward(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  targetX: number,
  targetY: number,
  running: boolean,
): number {
  monster.pathRunning = running
  const goalX = Math.round(targetX)
  const goalY = Math.round(targetY)
  const hasValidTarget =
    Number.isFinite(monster.pathTargetX) && Number.isFinite(monster.pathTargetY)
  const targetShift = hasValidTarget
    ? Math.hypot(goalX - monster.pathTargetX, goalY - monster.pathTargetY)
    : Number.POSITIVE_INFINITY
  const reachedCachedGoal =
    hasValidTarget && monster.path.length > 0 && monster.pathIndex >= monster.path.length
  const needsPathRecompute =
    !hasValidTarget ||
    (reachedCachedGoal && (goalX !== monster.pathTargetX || goalY !== monster.pathTargetY)) ||
    (this.currentFrame >= monster.pathNextRecomputeFrame &&
      (monster.pathIndex >= monster.path.length ||
        targetShift >= (this.terrainWalkableCheck ? 2 : 1)))
  if (needsPathRecompute) {
    monster.path = this.findMonsterPath(monster, targetX, targetY)
    monster.pathIndex = 0
    monster.pathTargetX = goalX
    monster.pathTargetY = goalY
    monster.pathNextRecomputeFrame =
      this.currentFrame +
      (this.terrainWalkableCheck ? (monster.path.length === 0 ? 12 : 8) : 0)
  }
  const speed = this.monsterStepSpeed(monster, running)
  const fromX = monster.x
  const fromY = monster.y
  let remaining = speed
  while (remaining > 0 && monster.pathIndex < monster.path.length) {
    const wp = monster.path[monster.pathIndex]!
    const dx = wp.x - monster.x
    const dy = wp.y - monster.y
    const dist = Math.hypot(dx, dy)
    if (dist <= 1e-6) {
      monster.pathIndex++
      continue
    }
    if (dist <= remaining) {
      if (
        !this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, wp.x, wp.y, monster.isFlying) ||
        this.isMonsterCellOccupied(monster, wp.x, wp.y)
      ) {
        monster.path = []
        monster.pathIndex = 0
        if (this.terrainWalkableCheck) {
          monster.pathNextRecomputeFrame = Math.max(
            monster.pathNextRecomputeFrame,
            this.currentFrame + 6,
          )
        }
        break
      }
      monster.x = wp.x
      monster.y = wp.y
      remaining -= dist
      monster.pathIndex++
    } else {
      const nx = monster.x + (dx / dist) * remaining
      const ny = monster.y + (dy / dist) * remaining
      if (
        !this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, nx, ny, monster.isFlying) ||
        this.isMonsterCellOccupied(monster, nx, ny)
      ) {
        monster.path = []
        monster.pathIndex = 0
        if (this.terrainWalkableCheck) {
          monster.pathNextRecomputeFrame = Math.max(
            monster.pathNextRecomputeFrame,
            this.currentFrame + 6,
          )
        }
        break
      }
      monster.x = nx
      monster.y = ny
      remaining = 0
    }
  }
  const moved = Math.hypot(monster.x - fromX, monster.y - fromY) > 1e-6
  if (moved) {
    // 1.13c MonMode: 2 = walk, 15 = run (3 is MONMODE_GETHIT, not run).
    monster.mode = running ? MONMODE_RUN : MONMODE_WALK
    const velocityPercent = this.monsterVelocityPercent(monster)
    const current = { x: Math.round(monster.x), y: Math.round(monster.y) }
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMove',
      unitType: 'monster',
      id: monster.unitId,
      unitId: monster.unitId,
      mode: running ? 'run' : 'walk',
      from: { x: Math.round(fromX), y: Math.round(fromY) },
      to: { x: Math.round(targetX), y: Math.round(targetY) },
      x: current.x,
      y: current.y,
      currentX: current.x,
      currentY: current.y,
      targetX: Math.round(targetX),
      targetY: Math.round(targetY),
      moveType: running ? 1 : 0,
      pathType: running ? 1 : 0,
      velocityPercent,
      areaId: monster.areaId,
      // S2C 0x67 `NPCMove` payload for every monster (not only NPCs).
      npc: {
        opcode: 0x67 as const,
        cmd: running ? 0x17 : 0x01,
        s: [
          Math.round(targetX),
          Math.round(targetY),
          1,
          running ? 1 : 0,
          velocityPercent,
          14,
          0,
        ] as const,
        driftCheckAt: current,
      },
    })
  }
  return Math.hypot(targetX - monster.x, targetY - monster.y)
}



/**
 * 1.13c room sleep: a monster only runs its AI while a player is in the same
 * area and within the room/adjacent-room activation radius. Far units still
 * process state timers and death drops, but skip pathfinding and attacks.
 */
function isAreaSeamAdjacent(this: GameInstanceHost, a: number, b: number): boolean {
  if (a === b) return true
  const forward = this.loadedAreas.get(a)?.adjacentAreaIds ?? []
  if (forward.includes(b)) return true
  const backward = this.loadedAreas.get(b)?.adjacentAreaIds ?? []
  if (backward.includes(a)) return true
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has(`${lo}:${hi}`)
}



function isMonsterInActiveAoi(this: GameInstanceHost, monster: InternalMonsterRecord): boolean {
  if (isAlwaysRunAiMonster113c(monster.umodIds, monster.alwaysRunAi)) {
    return true
  }
  let monsterRoomResolved = false
  let monsterRoom: IndexedWorldRoomRect | undefined
  let index: RoomSpatialIndex113c | undefined
  for (const player of this.players.values()) {
    if (player.dead || !this.isAreaSeamAdjacent(monster.areaId, player.areaId)) continue
    const sameArea = player.areaId === monster.areaId
    if (sameArea) {
      if (!monsterRoomResolved) {
        monsterRoomResolved = true
        const areaRooms = this.loadedAreas.get(monster.areaId)?.roomRects
        if (areaRooms !== undefined && areaRooms.length > 0) {
          index = syncRoomSpatialIndex113c(this)
          monsterRoom = findRoomRectInArea113c(index, monster.areaId, monster.x, monster.y)
        }
      }
      if (monsterRoom !== undefined && index !== undefined) {
        const playerRoom = findRoomRectInArea113c(index, monster.areaId, player.x, player.y)
        if (playerRoom !== undefined) {
          // 1.13c runs the player's room and its 8 neighbours.
          const gapX = Math.max(
            0,
            Math.max(playerRoom.x - (monsterRoom.x + monsterRoom.w), monsterRoom.x - (playerRoom.x + playerRoom.w)),
          )
          const gapY = Math.max(
            0,
            Math.max(playerRoom.y - (monsterRoom.y + monsterRoom.h), monsterRoom.y - (playerRoom.y + playerRoom.h)),
          )
          if (gapX <= 1 && gapY <= 1) return true
          continue
        }
      }
    }
    // Units outside any room (or a level without room rects) fall back to
    // the previous distance proxy.
    if (
      Math.hypot(player.x - monster.x, player.y - monster.y) <=
      MONSTER_ACTIVATION_RADIUS_SUBTILES
    ) {
      return true
    }
  }
  return false
}



/**
 * Nearest hostile (player, mercenary or summoned pet) in the area within the monster's
 * aggro radius. 1.13c monsters target all three, not only players.
 */
function nearestHostileForMonster(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  radius: number,
): { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord } | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord } | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit } | null {
  if (monster.align !== 0) return null
  let best: { kind: 'player'; x: number; y: number; player: InternalPlayerRecord } | { kind: 'merc'; x: number; y: number; merc: InternalMercenaryRecord } | { kind: 'pet'; x: number; y: number; pet: SummonedPetUnit } | null = null
  let bestDist = radius
  // 1.13c line-of-sight: strict walkable/door ray across the monster's area and any seam-adjacent area.
  // Submerge-capable water monsters (Tentacle, TentacleHead, FrogDemon) sit in walk-blocked water pools
  // (`COLLIDE_WALL` 0x0001) and check flying/missile-barrier sight (`0x0804`) + closed doors.
  const isWaterMonster = isSubmergeCapableMonsterHcIdx113c(monster.hcIdx)
  const hasLineOfSight = (x: number, y: number): boolean => {
    if (isWaterMonster) {
      if (this.loadedAreas.has(monster.areaId)) {
        return this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, x, y, true)
      }
      return !this.isRayBlockedByClosedDoor(monster.areaId, monster.x, monster.y, x, y)
    }
    return this.isMonsterStepWalkable(monster.areaId, monster.x, monster.y, x, y, monster.isFlying)
  }
  const useOctile = this.drlgRoomPopulator !== null
  const mx = Math.floor(monster.x + 0.5)
  const my = Math.floor(monster.y + 0.5)
  const distTo = (tx: number, ty: number): number =>
    useOctile
      ? unitsDistanceToCoordinates113c(mx, my, Math.floor(tx + 0.5), Math.floor(ty + 0.5))
      : Math.hypot(tx - monster.x, ty - monster.y)
  for (const p of this.players.values()) {
    if (p.dead || (useOctile && TOWN_AREAS.has(p.areaId)) || !this.isAreaSeamAdjacent(monster.areaId, p.areaId)) {
      continue
    }
    const d = distTo(p.x, p.y)
    if (d < bestDist && (useOctile || hasLineOfSight(p.x, p.y))) {
      bestDist = d
      best = { kind: 'player', x: p.x, y: p.y, player: p }
    }
  }
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || (useOctile && TOWN_AREAS.has(merc.areaId)) || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) {
      continue
    }
    const mercOwner = this.players.get(merc.ownerPlayerId)
    if (mercOwner !== undefined && (mercOwner.dead || (!useOctile && !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId)))) {
      continue
    }
    const d = distTo(merc.x, merc.y)
    if (d < bestDist && (useOctile || hasLineOfSight(merc.x, merc.y))) {
      bestDist = d
      best = { kind: 'merc', x: merc.x, y: merc.y, merc }
    }
  }
  for (const [ownerId, mgr] of this.summonManagers) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      const d = Math.hypot(pet.x - monster.x, pet.y - monster.y)
      if (d < bestDist && hasLineOfSight(pet.x, pet.y)) {
        bestDist = d
        best = { kind: 'pet', x: pet.x, y: pet.y, pet }
      }
    }
  }
  return best
}



/**
 * Applies a 1.13c monster curse (`#66` Amp, `#72` Weaken, `#82` Life Tap, `#87` Decrepify, `#91` Lower Resist,
 * `#309` Defense Curse, `#310` Blood Mana) to a player or mercenary, enforcing mutual curse exclusivity (#1822).
 */
function applyMonsterCurseToTarget113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target:
    | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord },
  skillId: number,
  slvl: number,
): void {
  const safeSlvl = Math.max(1, Math.trunc(slvl))
  let stateId = 9
  let durationFrames = 200
  let stats: Record<string, number> = {}
  switch (skillId) {
    case 66: // Amplify Damage -> state 9
      stateId = 9
      durationFrames = (8 + (safeSlvl - 1) * 3) * 25
      stats = { damageresist: -100 }
      break
    case 72: // Weaken -> state 19
      stateId = 19
      durationFrames = Math.round((14 + (safeSlvl - 1) * 2.4) * 25)
      stats = { damagepercent: -(33 + Math.floor(safeSlvl / 3)) }
      break
    case 82: // Life Tap -> state 58
      stateId = 58
      durationFrames = Math.round((16 + (safeSlvl - 1) * 2.4) * 25)
      stats = {}
      break
    case 87: // Decrepify -> state 60
      stateId = 60
      durationFrames = Math.max(100, Math.round((4 + (safeSlvl - 1) * 0.6) * 25))
      stats = {
        damageresist: -50,
        velocitypercent: -50,
        attackrate: -50,
        damagepercent: -50,
      }
      break
    case 91: { // Lower Resist -> state 61
      stateId = 61
      durationFrames = (20 + (safeSlvl - 1) * 2) * 25
      const pierce = Math.min(
        70,
        31 + Math.floor((39 * Math.floor((110 * safeSlvl) / (safeSlvl + 6))) / 100),
      )
      stats = {
        fireresist: -pierce,
        lightresist: -pierce,
        coldresist: -pierce,
        poisonresist: -pierce,
      }
      break
    }
    case 309: // Succubus Defense Curse -> state 113
      stateId = 113
      durationFrames = 200 + (safeSlvl - 1) * 75
      stats = { skill_armor_percent: -(50 + (safeSlvl - 1) * 5) }
      break
    case 310: // Succubus Blood Mana -> state 114
      stateId = 114
      durationFrames = 200 + (safeSlvl - 1) * 75
      stats = {}
      break
    default:
      return
  }
  const exclusiveCurseStateIds = [9, 19, 55, 58, 60, 61, 113, 114] as const
  if (target.kind === 'player') {
    const p = target.player
    const pCtx = this.playerCombatContext(p)
    for (const prevId of exclusiveCurseStateIds) {
      if (prevId !== stateId && p.states.has(prevId)) {
        pCtx.stateBus.removeState(prevId)
        this.clearUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, prevId)
      }
    }
    pCtx.stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId: `monster_${monster.unitId}`,
      sourceSkillId: skillId,
      slvl: safeSlvl,
      durationFrames,
      currentFrame: this.currentFrame,
      stats,
    })
    this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, stateId, durationFrames)
  } else {
    const merc = target.merc
    const mCtx = this.mercCombatContext(merc)
    for (const prevId of exclusiveCurseStateIds) {
      if (prevId !== stateId && merc.states.has(prevId)) {
        mCtx.stateBus.removeState(prevId)
        this.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, prevId)
      }
    }
    mCtx.stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId: `monster_${monster.unitId}`,
      sourceSkillId: skillId,
      slvl: safeSlvl,
      durationFrames,
      currentFrame: this.currentFrame,
      stats,
    })
    this.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, stateId, durationFrames)
  }
  const targetRef =
    target.kind === 'player'
      ? { unitType: 0 as const, id: target.player.unitId, x: target.player.x, y: target.player.y }
      : { unitType: 1 as const, id: target.merc.unitId, x: target.merc.x, y: target.merc.y }
  this.broadcastToArea(monster.areaId, {
    type: 'SkillCast',
    caster: { unitType: 1, id: monster.unitId },
    skill: skillId,
    skillId,
    level: safeSlvl,
    target: { unitType: targetRef.unitType, id: targetRef.id },
    at: { x: Math.round(targetRef.x), y: Math.round(targetRef.y) },
  })
}

export interface PvpAndMonsterLocomotionMethods {
  isHostilePvpPair113c(ownerPlayerIdA: number, areaIdA: number, ownerPlayerIdB: number, areaIdB: number, allowSeamAdjacent?: boolean | undefined): boolean
  collectHostilePvpTargetsInArea113c(attackerOwnerId: number, attackerAreaId: number, allowSeamAdjacent?: boolean | undefined): {
  readonly players: InternalPlayerRecord[]
  readonly mercs: InternalMercenaryRecord[]
  readonly pets: Array<{
    readonly ownerId: number
    readonly pet: SummonedPetUnit
    readonly petUnitId: number
    readonly areaId: number
  }>
}
  resolveHostilePvpTargetById113c(attackerOwnerId: number, attackerAreaId: number, targetId: number, targetType?: SkillTargetUnitType113c): | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
  | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
  | {
      readonly kind: 'pet'
      readonly ownerId: number
      readonly pet: SummonedPetUnit
      readonly petUnitId: number
      readonly areaId: number
    }
  | undefined
  buildPlayerDefenderSnapshot113c(player: InternalPlayerRecord): {
  readonly defenderCtx: CombatUnitContext
  readonly defenderStats: UnitStatList
  readonly defenderStateBus: StateBus
  readonly hadBoneArmor: boolean
  readonly activeBaPool: { current: number; max: number } | undefined
  readonly hadCycloneArmor: boolean
  readonly activeCaPool: { current: number; max: number } | undefined
}
  buildPvpAttackerContext113c(owner: InternalPlayerRecord, source?: 'player' | InternalMercenaryRecord | SummonedPetUnit | { readonly petUnitId: number } | undefined): {
  readonly ctx: CombatUnitContext
  readonly killerType: DeathKillerKind113c
  readonly killerUnitId: number
}
  applyPvpHitToTarget113c(attackerOwner: InternalPlayerRecord, target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      }, spec: {
    readonly skillId: number
    readonly physDamage?: number | undefined
    readonly elemDamage?: number | undefined
    readonly elemDamage256?: number | undefined
    readonly elemType?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois' | undefined
    readonly elemDurationFrames?: number | undefined
    readonly attackKind?: 'melee' | 'missile' | 'spell' | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly nonLethal?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly skipGetHit?: boolean | undefined
    readonly suppressBlockAnim?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly toHitBonusPct?: number | undefined
    readonly concentrationAlreadyApplied?: boolean | undefined
    readonly vengeanceBasePhys?: number | undefined
    readonly multiElemPacket?: NonNullable<SUnitDmgPacket['multiElemPacket']> | undefined
    readonly source?:
      | 'player'
      | InternalMercenaryRecord
      | SummonedPetUnit
      | { readonly petUnitId: number }
      | undefined
  }): boolean
  applyPvpSkillHitToTarget113c(player: InternalPlayerRecord, cast: PlayerSkillCast, target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      }, attackKind?: 'melee' | 'missile' | 'spell' | undefined): boolean
  applyPvpDebuffStateToTarget113c(target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }
    | {
        readonly kind: 'pet'
        readonly ownerId: number
        readonly pet: SummonedPetUnit
        readonly petUnitId: number
        readonly areaId: number
      }, stateId: number, durationFrames: number, sourceUnitId: string, sourceSkillId: number, slvl: number, stats?: Record<string, number>): void
  buildHostileAuraPvpEnemies113c(attackerOwnerId: number, areaId: number, inRange: (x: number, y: number) => boolean): Array<{
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
  readonly ctx: CombatUnitContext
  readonly preHp256: number
}>
  syncHostileAuraPvpEnemies113c(pvpEnemies: ReadonlyArray<{
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
    readonly ctx: CombatUnitContext
    readonly preHp256: number
  }>, killerType: DeathKillerKind113c, killerUnitId: number): void
  monsterVelocityPercent(monster: InternalMonsterRecord): number
  monsterStepSpeed(monster: InternalMonsterRecord, running: boolean): number
  monsterSlowPercent(monster: InternalMonsterRecord): number
  stepMonsterPoison(monster: InternalMonsterRecord): void
  stepMonsterRegen(monster: InternalMonsterRecord): void
  areaIdAtWorldPoint(x: number, y: number, referenceAreaId?: number): number | undefined
  findMonsterPath(monster: InternalMonsterRecord, targetX: number, targetY: number): readonly SubTilePoint[]
  isMonsterCellOccupied(monster: InternalMonsterRecord, x: number, y: number): boolean
  moveMonsterToward(monster: InternalMonsterRecord, targetX: number, targetY: number, running: boolean): number
  isAreaSeamAdjacent(a: number, b: number): boolean
  isMonsterInActiveAoi(monster: InternalMonsterRecord): boolean
  nearestHostileForMonster(monster: InternalMonsterRecord, radius: number): { readonly kind: 'player'; readonly x: number; readonly y: number; readonly player: InternalPlayerRecord } | { readonly kind: 'merc'; readonly x: number; readonly y: number; readonly merc: InternalMercenaryRecord } | { readonly kind: 'pet'; readonly x: number; readonly y: number; readonly pet: SummonedPetUnit } | null
  applyMonsterCurseToTarget113c(monster: InternalMonsterRecord, target: | { readonly kind: 'player'; readonly player: InternalPlayerRecord }
    | { readonly kind: 'merc'; readonly merc: InternalMercenaryRecord }, skillId: number, slvl: number): void
}

export const pvpAndMonsterLocomotionMethods: Record<keyof PvpAndMonsterLocomotionMethods, unknown> = {
  isHostilePvpPair113c,
  collectHostilePvpTargetsInArea113c,
  resolveHostilePvpTargetById113c,
  buildPlayerDefenderSnapshot113c,
  buildPvpAttackerContext113c,
  applyPvpHitToTarget113c,
  applyPvpSkillHitToTarget113c,
  applyPvpDebuffStateToTarget113c,
  buildHostileAuraPvpEnemies113c,
  syncHostileAuraPvpEnemies113c,
  monsterVelocityPercent,
  monsterStepSpeed,
  monsterSlowPercent,
  stepMonsterPoison,
  stepMonsterRegen,
  areaIdAtWorldPoint,
  findMonsterPath,
  isMonsterCellOccupied,
  moveMonsterToward,
  isAreaSeamAdjacent,
  isMonsterInActiveAoi,
  nearestHostileForMonster,
  applyMonsterCurseToTarget113c,
}
