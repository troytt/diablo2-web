/**
 * GameInstance Subsystem: Monster Melee Attacks, Corpse Resurrection, Player Defense & Hit Resolution (`src/server/engine/game-instance/monster-melee-attacks.ts`).
 */

import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { computeOneShotTicks, resolveArmorBlock113c, resolveCharacterAnimSpeedParams, resolveEquippedWeaponClass, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import type { DeathKillerKind113c } from '../../../common/progression/experience-113c.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { monaiParam113c, normalizeMonAiName113c } from '../../../common/units/monai-113c.ts'
import { MON_UMOD } from '../../../common/units/monster-death-fx.ts'
import { CURSED_PROC_CHANCE_PCT_113C, computeCursedAmplifyDamage113c, computeManaBurnDrainFixed113c, isPhysicalOrWeaponMonsterHit113c, rollEnchantedAttackBonus113c } from '../../ai/monumod-113c.ts'
import { scaleMonStatsPoisonRider113c } from '../../ai/monster-missile-damage-113c.ts'
import { computeEquippedArmorPieceDefense113c, computeWornSetSiblingMasks113c } from '../../items/server-item-data.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { computeToHitChance, emitSUnitDmgTraceEvent113c, executeSUnitDmg, getPrePierceResistance113c, rollItemKnockback113c, type CombatUnitContext } from '../combat-pipeline.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { allocateEvent3Seq113c, computeMonsterBaseDamageRegen113c } from '../statregen-dot-113c.ts'
import { StateBus } from '../state-bus.ts'
import { computeDiminishingReturns } from '../../../common/data/calc-ast.ts'
import { difficultyMonsterColdDivisor, difficultyMonsterFreezeDivisor, difficultyResistPenalty } from '../difficulty-resist-penalty.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMonsterRecord, InternalPlayerRecord, MissileDamageChannel } from './types.ts'
import {
  collectPlayerDefenderItemEventsLifo113c,
  computeDamageToManaGain256_113c,
  computeIronMaidenReflectRawPhys256_113c,
  computePreDamageAbsorbAndLife113c,
  computeStaticFieldTargetLtng256_113c,
  computeThornsAuraReflectRawPhys256_113c,
  monStatsCritPct113c,
  monsterFillPacketPhysRange113c,
  resolveSecondaryMonsterSUnitDmg113c,
  rollPlayerDefenderArmorDurability113c,
  rollPlayerDefenderCtcEntry113c,
} from './sunitdmg-player-defender-113c.ts'
import { monsterHp256_113c, monsterProfile113c, normalizeMissileElement, playerWirePosition, resolveArmorCombatMeta113c, TOWN_AREAS, UNIT_TYPE_113C } from './constants-and-helpers.ts'


/** Pick the 1.13c melee mode (A1/A2/S1) and schedule damage on its action frame. */
function beginMonsterMeleeAttack(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  player: InternalPlayerRecord,
): void {
  const hasA2 = monster.hasAttack2 && monster.attack2MaxDmg > 0
  const hasS1 = monster.hasSpecial1 && monster.special1MaxDmg > 0
  const rawA2Chance = monster.aiParams[1] ?? 0
  const a2Chance = hasA2
    ? Math.max(0, Math.min(100, Math.floor(rawA2Chance > 0 ? rawA2Chance : 35)))
    : 0
  const s1Chance = hasS1 ? (!hasA2 && monster.maxDmg <= 0 ? 100 : 25) : 0
  const roll = this.rng.rand(100)
  const skillMode: 'A1' | 'A2' | 'S1' =
    roll < s1Chance ? 'S1' : roll < s1Chance + a2Chance ? 'A2' : 'A1'
  // ThornHulk row 27: `aip6` is the number of consecutive A2 swings needed
  // before the `aip4` frenzy chance; `aip5` is the frenzy speed bonus.
  const profile = monsterProfile113c(monster.ai)
  const frenzy = profile.frenzy
  if (frenzy !== undefined) {
    if (skillMode === 'A2') {
      monster.consecutiveA2 += 1
      const required = Math.max(
        1,
        Math.floor(
          monaiParam113c(profile, monster.aiParams, frenzy.consecutiveParam, 3),
        ),
      )
      if (monster.consecutiveA2 >= required) {
        monster.consecutiveA2 = 0
        const chance = Math.max(
          0,
          Math.min(
            100,
            monaiParam113c(profile, monster.aiParams, frenzy.thresholdParam, 0),
          ),
        )
        if (chance > 0 && this.rng.rand(100) < chance) {
          monster.frenzyUntilFrame = this.currentFrame + 100
          monster.frenzySpeedPct = Math.max(
            0,
            monaiParam113c(profile, monster.aiParams, frenzy.speedParam, 0),
          )
        }
      }
    } else {
      monster.consecutiveA2 = 0
    }
  }
  const mode = skillMode === 'A1' ? 4 : skillMode === 'A2' ? 5 : 8
  const minDmg =
    skillMode === 'S1'
      ? monster.special1MinDmg
      : skillMode === 'A2'
        ? monster.attack2MinDmg
        : monster.minDmg
  const maxDmg =
    skillMode === 'S1'
      ? monster.special1MaxDmg
      : skillMode === 'A2'
        ? monster.attack2MaxDmg
        : monster.maxDmg
  monster.mode = mode
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: monster.unitId,
    mode,
    at: { x: Math.round(player.x), y: Math.round(player.y) },
    lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
  })
  const timing = this.monsterAttackTiming(monster, skillMode)
  monster.cooldown = Math.max(monster.cooldownTicks, timing.totalFrames)
  monster.pendingAttack = {
    playerId: player.unitId,
    frame: this.currentFrame + timing.actionFrame,
    mode,
    skillMode,
    minDmg,
    maxDmg,
  }
}



/** AnimData `{code}A1/A2/S1HTH` action frame and full animation duration. */
function monsterAttackTiming(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  mode: 'A1' | 'A2' | 'S1' | 'S2',
): { readonly actionFrame: number; readonly totalFrames: number } {
  const attackRatePct = Math.max(
    15,
    100 -
      this.monsterSlowPercent(monster) +
      (this.currentFrame < monster.frenzyUntilFrame ? monster.frenzySpeedPct : 0) +
      (monster.umodIds.includes(37) ? 30 : 0) +
      (monster.states.has(49) ? 30 : 0) +
      (monster.states.has(140) ? 50 : 0) +
      monster.monProps.iasPct +
      (monster.monEquipLoadout?.iasPct ?? 0),
  )
  const code = MONSTATS_113C_ROWS[monster.hcIdx]?.code?.trim().toUpperCase()
  if (code !== undefined && code !== '') {
    const record = this.registry.getAnimDataRecord(`${code}${mode}HTH`)
    if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
      const speed = Math.max(1, Math.floor((record.animationSpeed * attackRatePct) / 100))
      const event = record.events.find((entry) => entry.code !== 0)
      // The mode starts with the anim frame accumulator at 0 and every later server frame adds
      // `speed`; the AnimData event fires once `accumulator >> 8` reaches the event frame index, i.e.
      // `ceil(eventFrame * 256 / speed)` frames after the mode change (same index the player
      // AnimDispatcher uses). Oracle: zombie #9 enters A2 (`ZMA2HTH`, event frame 9, speed 256) on
      // frame 748 of p52-paladin-auras and draws its to-hit roll on frame 757
      // (kb/monsters/d2game-zombie-ai-113c.md §Attack timing).
      const actionIdx = event !== undefined ? event.frame : record.framesPerDirection
      return {
        actionFrame: Math.max(1, Math.ceil((actionIdx * 256) / speed)),
        totalFrames: Math.max(1, Math.floor((record.framesPerDirection * 256) / speed)),
      }
    }
  }
  const baseAction = mode === 'A1' ? 4 : 5
  const baseTotal = mode === 'A1' ? 8 : 10
  return {
    actionFrame: Math.max(1, Math.floor((baseAction * 100) / attackRatePct)),
    totalFrames: Math.max(1, Math.floor((baseTotal * 100) / attackRatePct)),
  }
}



function stepPendingResurrection(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const pending = monster.pendingResurrection
  if (pending === undefined || this.currentFrame < pending.frame) return
  if (
    monster.dead ||
    monster.frozenTicks > 0 ||
    monster.states.has(1) ||
    monster.states.has(29) ||
    monster.states.has(21) ||
    monster.states.has(25) ||
    this.currentFrame < monster.hitRecoveryUntilFrame
  ) {
    monster.pendingResurrection = undefined
    return
  }
  monster.pendingResurrection = undefined
  const corpse = this.monsters.get(pending.corpseUnitId)
  if (
    corpse === undefined ||
    !corpse.dead ||
    corpse.shattered ||
    corpse.corpseConsumed ||
    corpse.states.has(104) ||
    corpse.areaId !== monster.areaId
  ) {
    return
  }
  this.reviveMonsterCorpse(monster, corpse)
}



/** Apply the 1.13c Resurrect action frame: full life, cleared death states. */
function reviveMonsterCorpse(this: GameInstanceHost, 
  caster: InternalMonsterRecord,
  corpse: InternalMonsterRecord,
): void {
  if (corpse.pendingDropItems !== undefined) {
    const pendingItems = corpse.pendingDropItems
    corpse.pendingDropItems = undefined
    this.spawnDroppedItems(pendingItems, corpse.areaId, corpse.x, corpse.y)
  }
  corpse.dead = false
  corpse.hp = corpse.maxHp
  corpse.mode = 1
  corpse.revivedByShaman = true
  corpse.experience = 0
  corpse.baseXp = 0
  corpse.alreadyGrantedKillRewards = true
  for (const stateId of corpse.states) {
    this.broadcastToArea(caster.areaId, {
      type: 'UnitState',
      unitType: 'monster',
      unitId: corpse.unitId,
      state: stateId,
      active: false,
      areaId: caster.areaId,
    })
    this.broadcastToArea(caster.areaId, {
      type: 'StateEnd',
      unit: { unitType: 1, id: corpse.unitId },
      state: stateId,
    })
  }
  corpse.states.clear()
  corpse.stateTimers.clear()
  corpse.path = []
  corpse.pathIndex = 0
  corpse.pathTargetX = Number.NaN
  corpse.pathTargetY = Number.NaN
  this.broadcastToArea(caster.areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId: corpse.unitId,
    statId: 6,
    value: corpse.hp,
  })
  if (corpse.areaId === 8) {
    this.syncDenOfEvilProgress113c(undefined)
  }
  this.broadcastToArea(caster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: corpse.unitId,
    mode: 1,
    lifePct: 128,
  })
}



function stepPendingMonsterAttack(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const pending = monster.pendingAttack
  if (!pending || this.currentFrame < pending.frame) return
  if (
    monster.dead ||
    monster.frozenTicks > 0 ||
    monster.states.has(1) ||
    monster.states.has(29) ||
    monster.states.has(21) ||
    monster.states.has(25) ||
    this.currentFrame < monster.hitRecoveryUntilFrame
  ) {
    monster.pendingAttack = undefined
    return
  }
  monster.pendingAttack = undefined
  const player = this.players.get(pending.playerId)
  if (!player || player.dead || !this.isAreaSeamAdjacent(monster.areaId, player.areaId)) return
  // 1.13c `MONSTER_MeleeAttack` (`0x6FC64AC0` -> `SUNITDMG_RollMelee` `0x6FCFE5A0..0x6FCFE629`):
  // Action-frame melee reach uses `UNITS_IsInMeleeRange(pMonster, pPlayer, bonus = 3)` (`0x6FCFE60D`).
  const exactInRange =
    this.drlgRoomPopulator !== null
      ? this.areaPathWorld.isMonsterInMeleeRange113c(monster.areaId, monster.unitId, 0, player.unitId, 3)
      : null
  if (exactInRange !== null) {
    if (!exactInRange) return
  } else {
    const maxMeleeReach = Math.max(3.5, monster.meleeRange + 1.5)
    if (Math.hypot(player.x - monster.x, player.y - monster.y) > maxMeleeReach) return
  }
  this.resolveMonsterAttackOnPlayer(monster, player, pending)
}



/** MonStats `El1..3` elemental rider attached to the chosen melee mode. */
function rollMonsterElementalRider(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  mode: 'A1' | 'A2' | 'S1',
): { readonly element: MissileDamageChannel; readonly damage: number; readonly durationFrames: number } | undefined {
  for (const el of monster.elementalAttacks) {
    if (el.mode !== mode) continue
    const chance = Math.max(0, Math.min(100, el.chancePct ?? 100))
    if (this.rng.rand(100) >= chance) continue
    const element = normalizeMissileElement(el.type)
    if (element === undefined || element === 'phys') continue
    const min = Math.max(0, el.minDamage ?? el.min ?? 0)
    const max = Math.max(min, el.maxDamage ?? el.max ?? min)
    if (element === 'pois') {
      const pois = scaleMonStatsPoisonRider113c(min, max, el.durationFrames ?? 25)
      return {
        element,
        damage: this.rollInclusive(pois.minCumulHp, pois.maxCumulHp),
        durationFrames: pois.durationFrames,
      }
    }
    return {
      element,
      damage: this.rollInclusive(min, max),
      durationFrames: Math.max(0, el.durationFrames ?? 0),
    }
  }
  return undefined
}



/** Schedule a melee swing against a mercenary / summon on the AnimData action frame. */
function beginMonsterMeleeAttackOnAlly(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  target: { readonly kind: 'merc' | 'pet'; readonly id: number | string },
): void {
  const timing = this.monsterAttackTiming(monster, 'A1')
  monster.cooldown = Math.max(monster.cooldownTicks, timing.totalFrames)
  monster.pendingAllyAttack = {
    targetKind: target.kind,
    targetId: target.id,
    frame: this.currentFrame + timing.actionFrame,
    mode: 4,
    skillMode: 'A1',
    minDmg: monster.minDmg,
    maxDmg: monster.maxDmg,
  }
}



function stepPendingAllyAttack(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const pending = monster.pendingAllyAttack
  if (!pending || this.currentFrame < pending.frame) return
  if (
    monster.dead ||
    monster.frozenTicks > 0 ||
    monster.states.has(1) ||
    monster.states.has(29) ||
    monster.states.has(21) ||
    monster.states.has(25) ||
    this.currentFrame < monster.hitRecoveryUntilFrame
  ) {
    monster.pendingAllyAttack = undefined
    return
  }
  monster.pendingAllyAttack = undefined
  const rider = this.rollMonsterElementalRider(monster, pending.skillMode)
  const swing = {
    skillId: 0,
    physDamage: this.rollInclusive(pending.minDmg, pending.maxDmg),
    elemDamage: rider?.damage ?? 0,
    element: rider?.element ?? ('phys' as MissileDamageChannel),
    elemDurationFrames: rider?.durationFrames ?? 0,
  }
  if (pending.targetKind === 'merc') {
    const merc = this.mercenaries.get(pending.targetId as number)
    if (!merc || !merc.alive || !this.isAreaSeamAdjacent(monster.areaId, merc.areaId)) return
    const mercOwner = this.players.get(merc.ownerPlayerId)
    if (mercOwner !== undefined && (mercOwner.dead || !this.isAreaSeamAdjacent(monster.areaId, mercOwner.areaId))) return
    const maxAllyReach = Math.max(3.5, monster.meleeRange + 1.5)
    if (Math.hypot(merc.x - monster.x, merc.y - monster.y) > maxAllyReach) return
    const prevHp = merc.hp
    const nextHp = this.applyMonsterMissileToDefender(
      monster,
      swing,
      {
        id: `merc_${merc.unitId}`,
        name: merc.name,
        unitType: 'mercenary',
        level: merc.level,
        hp: merc.hp,
        maxHp: merc.maxHp,
        defense: merc.defense,
        resist: merc.resist,
        equipment: merc.equipment,
      },
      'melee',
    )
    if (nextHp < prevHp) {
      this.applyDamageToMerc(merc, prevHp - nextHp, merc.areaId)
    }
    return
  }
  let pet: SummonedPetUnit | undefined
  for (const [ownerId, mgr] of this.summonManagers) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead || !this.isAreaSeamAdjacent(monster.areaId, owner.areaId)) continue
    for (const candidate of mgr.getActivePets()) {
      const mappedId =
        this.petUnitIds.get(candidate.uid) ??
        (candidate as unknown as { unitId?: number }).unitId
      if (
        candidate.uid === String(pending.targetId) ||
        mappedId === pending.targetId ||
        Number(candidate.uid) === pending.targetId
      ) {
        pet = candidate
        break
      }
    }
    if (pet !== undefined) break
  }
  if (pet === undefined || pet.alive === false || pet.hp <= 0) return
  if (this.drlgRoomPopulator !== null && pet.oracleAi113c !== undefined) {
    resolveDrlgMonsterSwingOnPet113c(this, monster, pet, pending)
    return
  }
  const maxPetReach = Math.max(3.5, monster.meleeRange + 1.5)
  if (Math.hypot(pet.x - monster.x, pet.y - monster.y) > maxPetReach) return
  const prevHp = pet.hp
  const nextHp = this.applyMonsterMissileToDefender(
    monster,
    swing,
    {
      id: pet.uid,
      name: pet.name,
      unitType: 'minion',
      level: pet.statList.getAccruedStat('level'),
      hp: pet.hp,
      maxHp: pet.maxHp,
      stats: pet.statList,
      stateBus: pet.stateBus,
      x: pet.x,
      y: pet.y,
    },
    'melee',
  )
  if (nextHp < prevHp) {
    pet.hp = prevHp
    this.applyDamageToSummon(pet, prevHp - nextHp, monster.areaId)
  }
}

/**
 * DRLG oracle path: a monster's melee action frame on a 1:1-ported NecroPet summon (`0x6FC64AC0` ->
 * `0x6FCFE5A0` -> `0x6FCFDDE0`), same `SUNITDMG` order as the player defender
 * (kb/combat/d2game-sunitdmg-player-defender-113c.md §1-§3):
 * 1. reach `#11138 UNITS_IsInMeleeRange(pMonster, pPet, 3)` (`0x6FCFE60D..0x6FCFE624`), no draw when out of reach;
 * 2. to-hit `rand(100)` on the monster seed (`0x6FCFE017`, `0x6FCFDE90` chance clamped `[5, 95]`), a miss
 *    ends the swing (oracle: every zombie swing on the Valkyrie / Clay Golem draws once and misses);
 * 3. defender block on the pet seed only when its block rate is positive (`0x6FCFB7F8`);
 * 4. `FillPacket` physical `min + RAND(max - min)` (mode damage, aura `%ED`), `RAND(1)`, `MonStats.crit`;
 * 5. the pet's `damageresist`, then life in 256ths.
 * The landed-hit branch has no oracle sample yet (no zombie hit lands on a pet in the goldens).
 */
function resolveDrlgMonsterSwingOnPet113c(
  host: GameInstanceHost,
  monster: InternalMonsterRecord,
  pet: SummonedPetUnit,
  pending: NonNullable<InternalMonsterRecord['pendingAllyAttack']>,
): void {
  const petUnitId = host.petUnitIds.get(pet.uid)
  if (petUnitId === undefined) throw new Error(`resolveDrlgMonsterSwingOnPet113c: pet ${pet.uid} has no unit id`)
  const inReach = host.areaPathWorld.isMonsterInMeleeRange113c(
    monster.areaId,
    monster.unitId,
    UNIT_TYPE_113C.monster,
    petUnitId,
    3,
  )
  if (inReach === null) throw new Error(`resolveDrlgMonsterSwingOnPet113c: no path units for ${monster.unitId} -> ${petUnitId}`)
  if (!inReach) return
  const monsterSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${monster.unitId}`)
  const petSeed = host.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${petUnitId}`)
  if (monsterSeed === undefined || petSeed === undefined) {
    throw new Error(`resolveDrlgMonsterSwingOnPet113c: missing seed for ${monster.unitId} / ${petUnitId}`)
  }
  const attackerCtx = host.buildMonsterAttackerContext(monster, pending.skillMode)
  const cth = computeToHitChance({
    attackerAr: Math.trunc(attackerCtx.statList.getAccruedStat('tohit')),
    defenderDef: Math.max(0, Math.trunc(pet.statList.getAccruedStat('armorclass'))),
    attackerLvl: Math.max(1, monster.level),
    defenderLvl: Math.max(1, Math.trunc(pet.statList.getAccruedStat('level'))),
    attackKind: 'melee',
  })
  if (rollLimitedSeed113c(monsterSeed, 100) >= cth) return
  const petBlock = Math.trunc(pet.statList.getAccruedStat('toblock'))
  if (petBlock > 0 && rollLimitedSeed113c(petSeed, 100) < Math.min(75, petBlock)) return
  const range = monsterFillPacketPhysRange113c(
    pending.minDmg,
    pending.maxDmg,
    attackerCtx.statList.getAccruedStat('item_normaldamage'),
  )
  const edPct = Math.max(-90, Math.trunc(attackerCtx.statList.getModifierBonus('damagepercent')))
  const min = range.min256 + Math.trunc((range.min256 * edPct) / 100)
  const max = range.max256 + Math.trunc((range.max256 * edPct) / 100)
  let phys = max > min ? min + rollLimitedSeed113c(monsterSeed, max - min) : min
  rollLimitedSeed113c(monsterSeed, 1)
  const crit = monStatsCritPct113c(monster.hcIdx)
  if (crit > 0 && rollLimitedSeed113c(monsterSeed, 100) < crit) phys *= 2
  const res = Math.min(100, Math.max(-100, Math.trunc(pet.statList.getAccruedStat('damageresist'))))
  const dealt256 = res >= 100 ? 0 : Math.max(0, phys - Math.trunc((phys * res) / 100))
  if (dealt256 <= 0) return
  const prevHp = pet.hp
  const nextHp256 = Math.max(0, prevHp * FIXED_ONE - dealt256)
  const nextHp = nextHp256 < FIXED_ONE ? 0 : Math.ceil(nextHp256 / FIXED_ONE)
  if (nextHp < prevHp) host.applyDamageToSummon(pet, prevHp - nextHp, monster.areaId)
}



function buildMonsterAttackerContext(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  skillMode: 'A1' | 'A2' | 'S1' = 'A1',
): CombatUnitContext {
  const attackerStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
  attackerStats.setBaseStat('level', monster.level)
  const modeToHit =
    skillMode === 'S1'
      ? monster.special1Ar
      : skillMode === 'A2'
        ? monster.attack2Ar
        : monster.ar
  attackerStats.setBaseStat('tohit', modeToHit)
  attackerStats.setBaseStat('armorclass', monster.ac)
  attackerStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  attackerStats.setHp256(monster.hp * FIXED_ONE)
  attackerStats.setBaseStat('damageresist', monster.resistances.phys)
  attackerStats.setBaseStat('magicresist', monster.resistances.magic)
  attackerStats.setBaseStat('fireresist', monster.resistances.fire)
  attackerStats.setBaseStat('lightresist', monster.resistances.light)
  attackerStats.setBaseStat('coldresist', monster.resistances.cold)
  attackerStats.setBaseStat('poisonresist', monster.resistances.poison)
  const cbPct = monster.monProps.crushingBlowPct + (monster.monEquipLoadout?.crushingBlowPct ?? 0)
  if (cbPct > 0) attackerStats.setBaseStat('item_crushingblow', cbPct)
  const dsPct = monster.monEquipLoadout?.deadlyStrikePct ?? 0
  if (dsPct > 0) attackerStats.setBaseStat('item_deadlystrike', dsPct)
  const owPct = monster.monEquipLoadout?.openWoundsPct ?? 0
  if (owPct > 0) attackerStats.setBaseStat('item_openwounds', owPct)
  if (monster.monProps.extraFirePct > 0) {
    attackerStats.setBaseStat('passive_fire_mastery', monster.monProps.extraFirePct)
  }
  const attackerStateBus = new StateBus(attackerStats, this.registry)
  this.mirrorPersistentStates(this.monsterCombat.get(monster.unitId), attackerStateBus)
  return {
    id: `monster_${monster.unitId}`,
    name: monster.name,
    unitType: 'monster',
    statList: attackerStats,
    stateBus: attackerStateBus,
    x: monster.x,
    y: monster.y,
    isUndead: monster.isUndead,
    isDemon: monster.isDemon,
    isBoss: monster.isBoss,
    isPrimeEvil: monster.isPrimeEvil,
    weaponMinPhys: 0,
    weaponMaxPhys: 0,
  }
}



function computePlayerBaseDefense(this: GameInstanceHost, player: InternalPlayerRecord): number {
  // 1.13c `UNITS_GetDefense` (`0x6FD82890`, #1863): `floor(totalDex / 4)` includes base + gear +
  // active 10x4 charms + buff/modifier dexterity.
  const buffDex = this.playerCombat.get(player.unitId)?.statList.getModifierBonus('dexterity') ?? 0
  const totalDex = Math.max(0, player.dexterity + this.sumPlayerItemStat(player, 2) + buffDex)
  let defense = Math.floor(totalDex / 4)
  const worn = player.items.filter(
    (it) => it.location === 'equipped' && it.bodyLoc !== 11 && it.bodyLoc !== 12,
  )
  const hasSetGear = worn.some(
    (it) =>
      it.quality === 5 ||
      (it.rawItemData?.setItemId !== undefined &&
        it.rawItemData.setItemId >= 0 &&
        it.rawItemData.setItemId !== 0xfff),
  )
  const tables = hasSetGear ? getEmbeddedDropTables() : undefined
  const counts = hasSetGear ? this.wornSetPieceCounts(worn) : undefined
  const siblingMasks =
    hasSetGear && tables ? computeWornSetSiblingMasks113c(worn, tables.sets.items) : undefined
  for (const item of worn) {
    if (item.identified === false || item.rawItemData?.identified === false) {
      if (item.rawItemData?.defense !== undefined) {
        defense += item.rawItemData.defense
      } else {
        const meta = resolveArmorCombatMeta113c(item.code)
        if (meta !== undefined && meta.minAc > 0) {
          defense += item.ethereal ? Math.floor((meta.minAc * 3) / 2) : meta.minAc
        }
      }
      continue
    }
    if (item.rawItemData?.broken === true) continue
    const setId = item.rawItemData?.setItemId
    const setItem =
      tables && setId !== undefined && setId >= 0 && setId !== 0xfff
        ? tables.sets.items.getById(setId)
        : undefined
    defense += computeEquippedArmorPieceDefense113c(
      item,
      resolveArmorCombatMeta113c(item.code),
      setItem && tables
        ? {
            wornCount: counts?.get(setItem.set) ?? 1,
            siblingMask: siblingMasks?.get(setItem.set) ?? 0,
            setItemsTable: tables.sets.items,
          }
        : undefined,
    )
  }
  defense += this.sumPlayerItemStat(player, 31)
  return defense
}



/**
 * 1.13c player armor class (`D2Common_10672` / `UNITS_GetDefense` @ `0x6FD82890`, #1634 / #1800):
 * - Includes `214 item_armor_perlevel` (`/ 8`), `215 item_armorpercent_perlevel` (`/ 8`),
 *   `16 item_armor_percent` (off-armor/set/aura), `171 skill_armor_percent` (Shout / Defiance / Iron Skin / Chilling Armor / Conviction),
 *   Holy Shield (`state 101`, `Skills.txt` #117 `calc1 = 25 + 15*(slvl-1) + 15*blvl('Defiance')`), `182 armor_override_percent`, and Armor Shrine (`state 128`).
 */
function computePlayerDefense(this: GameInstanceHost, player: InternalPlayerRecord): number {
  let defense = this.computePlayerBaseDefense(player)
  const combat = this.playerCombatContext(player)
  const overridePct = combat.statList.getAccruedStat('armor_override_percent')
  if (overridePct <= -100) {
    return 0
  }
  if (overridePct !== 0) {
    defense += Math.trunc((defense * overridePct) / 100)
  }
  const hasEquippedGear = player.items.some(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  const canApplyHolyShield = !hasEquippedGear || this.hasPlayerEquippedShield(player)
  const hsMod = canApplyHolyShield
    ? combat.statList
        .getActiveModifiers()
        .find((m) => m.stateId === 101 || m.stateName === 'holyshield')
    : undefined
  let hsPct = 0
  if (hsMod !== undefined || (canApplyHolyShield && player.states.has(101))) {
    const hsLvl = Math.max(
      1,
      hsMod?.stats['modifierlist_level'] ?? hsMod?.slvl ?? this.resolvePlayerSkillLevelById(player, 117),
    )
    const defianceBlvl = Math.max(
      0,
      player.skills.get(104) ?? combat.statList.getBaseSkillLevel(104),
    )
    hsPct = Math.max(
      0,
      25 + 15 * (hsLvl - 1) + 15 * defianceBlvl - (hsMod?.stats['skill_armor_percent'] ?? 0),
    )
  }
  const defensePct =
    combat.statList.getModifierBonus('skill_armor_percent') +
    combat.statList.getModifierBonus('item_armor_percent') +
    this.sumPlayerItemStat(player, 215) +
    hsPct +
    (player.states.has(128) && !combat.stateBus.hasState(128) ? 100 : 0)
  if (defensePct !== 0) {
    defense = Math.max(0, defense + Math.trunc((defense * defensePct) / 100))
  }
  return Math.max(0, defense)
}



function resolveMonsterAttackOnPlayer(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  player: InternalPlayerRecord,
  swing?: {
    readonly minDmg: number
    readonly maxDmg: number
    readonly skillMode: 'A1' | 'A2' | 'S1'
    /** Missile hits use the projectile block/dodge path; melee uses the melee path. */
    readonly attackKind?: 'melee' | 'missile' | undefined
    readonly skillId?: number | undefined
    readonly missileId?: number | undefined
    /** Skill `%AR` bonus (`Skills.txt` `ToHit` / `ToHitCalc`, e.g. Charge `+50%+15%/lvl`, Jab `+10%+9%/lvl`). */
    readonly arBonusPct?: number | undefined
    /** Explicit projectile element (Missiles.txt EType) instead of a MonStats El1..3 rider. */
    readonly elementType?: MissileDamageChannel | undefined
    readonly elemMin?: number | undefined
    readonly elemMax?: number | undefined
    readonly elemDurationFrames?: number | undefined
    /** Projectile hits must not re-roll the monster's melee El1..3 rider. */
    readonly fromMissile?: boolean | undefined
    /** Death-effect novae or `ResultFlags & 1` skills bypass `RollToHit` vs Defense. */
    readonly autoHit?: boolean | undefined
    /** Explicit block override (e.g. `false` on `#198 DiabRun` / `#301 Stomp` so Shield Block still rolls). */
    readonly unblockable?: boolean | undefined
  },
): boolean {
  const attackerCtx = this.buildMonsterAttackerContext(monster, swing?.skillMode ?? 'A1')

  const defenderStats = new UnitStatList(this.registry, undefined, {
    ownerType: 'player',
    charClass: player.classCode,
  })
  defenderStats.setBaseStat('level', player.level)
  defenderStats.setBaseStat('strength', player.strength + this.sumPlayerItemStat(player, 0))
  defenderStats.setBaseStat('vitality', player.vitality + this.sumPlayerItemStat(player, 3))
  defenderStats.setBaseStat('energy', player.energy + this.sumPlayerItemStat(player, 1))
  defenderStats.setBaseStat('tohit', this.computePlayerBaseToHit113c(player))
  // 1.13c defense & mitigation from active worn items (excluding swap 11/12), sockets, charms, set bonuses, and per-level stats (#1629, #1634).
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
  // Passive statlists (`passive_skill_*`, e.g. `#153 Natural Resistance`) and persistent states (`state_*`,
  // e.g. `#267 Fade` `damageresist` & resistances) are re-attached on `defenderStats` by
  // `syncPlayerSkillLevelsToStatList113c` and `mirrorPersistentStates`; strip them from the copied base totals
  // so they count once (#1803, #1945).
  const passiveOrStateBonus = (stat: string): number => {
    let total = 0
    for (const m of playerStats.getActiveModifiers()) {
      if (
        m.id.startsWith('passive_skill_') ||
        m.id.startsWith('state:') ||
        m.id.startsWith('state_')
      ) {
        total += m.stats[stat] ?? 0
      }
    }
    return total
  }
  damageResist -= passiveOrStateBonus('damageresist')
  fireResist -= passiveOrStateBonus('fireresist')
  lightResist -= passiveOrStateBonus('lightresist')
  coldResist -= passiveOrStateBonus('coldresist')
  poisonResist -= passiveOrStateBonus('poisonresist')
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
  // Set base defense before skill/aura percentage scaling (`defenderStateBus` mirrors active states/auras,
  // so `defenderStats.getAccruedStat('armorclass')` applies `skill_armor_percent` once without double-scaling #1634).
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
  defenderStats.setBaseStat(
    'item_poisonlengthresist',
    this.sumPlayerItemStat(player, 110) +
      Math.trunc(playerStats.getAccruedStat('item_poisonlengthresist', true)),
  )
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
  // 1.13c defensive passive statlists at their exact `SKILLS_GetSkillLevel` level (`#13 Dodge`, `#18 Avoid`,
  // `#29 Evade`, `#263 Weapon Block`, `#145 Iron Skin`, `#153 Natural Resistance`; #1796, #1802..#1804).
  this.syncPlayerSkillLevelsToStatList113c(player, defenderStats, this.playerCombat.get(player.unitId)?.stateBus)

  const defenderStateBus = new StateBus(defenderStats, this.registry)
  // Mirror persistent buffs / received auras first, then overlay live Bone Armor / Cyclone Armor
  // remaining absorb pools so `StateBus.triggerReactiveEvents` uses the exact remaining pool (#1793).
  this.mirrorPersistentStates(this.playerCombat.get(player.unitId), defenderStateBus)
  defenderStats.setHp256(player.hpFixed)
  defenderStats.setMana256(player.manaFixed)
  // 1.13c `#267 Fade` (`state 159`, or legacy tests seeding `state 157` when `skills.get(267) > 0`, #1945):
  // grants `+slvl%` physical `damageresist` (`stat 36`), resistances (`dm34(10, 75)`), and `curse_resistance` (`dm12(19, 85)`).
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
  if (player.states.has(54) && !defenderStateBus.hasState(54)) {
    defenderStateBus.applyState({
      stateNameOrId: 54,
      durationFrames: player.stateTimers.get(54) ?? 25,
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
    // Holy Shield #117 aurastatcalc1 = dm56 (10, 40) + modifierlist_skill/level (#1678, #1800).
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
    armorClassIncludesDex: true,
    hasShield: hasEquippedShield,
    ...(rightHandWeaponType !== undefined ? { weaponItemType: rightHandWeaponType } : {}),
    ...(leftHandWeaponType !== undefined ? { offHandWeaponItemType: leftHandWeaponType } : {}),
    isDualClaw,
    isMoving: motionMoving || isWalking || isRunning,
    isWalking,
    isRunning,
    resistPenalty: difficultyResistPenalty(this.difficulty),
  }

  const swingMode = swing?.skillMode ?? 'A1'
  const rider =
    swing?.fromMissile === true
      ? undefined
      : monster.elementalAttacks.find(
          (entry) =>
            entry.mode === swingMode &&
            (entry.chancePct >= 100 || this.rng.rand(100) < entry.chancePct),
        )
  const rawRiderType = rider?.type
  const resolvedRiderElem =
    rawRiderType === 'rand'
      ? (['fire', 'ltng', 'cold', 'pois'] as const)[this.rng.rand(4)]
      : rawRiderType === 'ltng'
        ? 'ltng'
        : rawRiderType === 'cold' || rawRiderType === 'frze'
          ? 'cold'
          : rawRiderType === 'pois'
            ? 'pois'
            : rawRiderType === 'mag'
              ? 'mag'
              : rawRiderType === 'fire'
                ? 'fire'
                : undefined
  const equipElem =
    swing?.fromMissile !== true || (swing.skillId === 0 && (swing.minDmg ?? 0) + (swing.maxDmg ?? 0) > 0)
      ? monster.monEquipLoadout
      : undefined
  const equipElemType =
    equipElem !== undefined
      ? equipElem.fireMaxDamage > 0
        ? 'fire'
        : equipElem.coldMaxDamage > 0
          ? 'cold'
          : equipElem.ltngMaxDamage > 0
            ? 'ltng'
            : equipElem.poisMaxDamage > 0
              ? 'pois'
              : equipElem.magicMaxDamage > 0
                ? 'mag'
                : undefined
      : undefined
  const elementalType = swing?.elementType ?? resolvedRiderElem ?? equipElemType
  const auraDmgPct = this.monsterAuraDamageBonusPct(monster)
  const physMin = swing?.fromMissile === true ? (swing.minDmg ?? 0) : (swing?.minDmg ?? monster.minDmg)
  const physMax = swing?.fromMissile === true ? (swing.maxDmg ?? 0) : (swing?.maxDmg ?? monster.maxDmg)
  const equipElemMin =
    equipElem !== undefined && elementalType !== undefined
      ? elementalType === 'fire'
        ? equipElem.fireMinDamage
        : elementalType === 'cold'
          ? equipElem.coldMinDamage
          : elementalType === 'ltng'
            ? equipElem.ltngMinDamage
            : elementalType === 'pois'
              ? equipElem.poisMinDamage
              : equipElem.magicMinDamage
      : 0
  const equipElemMax =
    equipElem !== undefined && elementalType !== undefined
      ? elementalType === 'fire'
        ? equipElem.fireMaxDamage
        : elementalType === 'cold'
          ? equipElem.coldMaxDamage
          : elementalType === 'ltng'
            ? equipElem.ltngMaxDamage
            : elementalType === 'pois'
              ? equipElem.poisMaxDamage
              : equipElem.magicMaxDamage
      : 0
  const riderPoisScaled =
    swing?.fromMissile !== true && elementalType === 'pois' && rider !== undefined
      ? scaleMonStatsPoisonRider113c(
          rider.minDamage ?? rider.min ?? 0,
          rider.maxDamage ?? rider.max ?? 0,
          rider.durationFrames ?? rider.duration ?? 25,
        )
      : undefined
  const rawElemMin =
    (swing?.fromMissile === true
      ? (swing.elemMin ?? 0)
      : riderPoisScaled !== undefined
        ? riderPoisScaled.minCumulHp
        : (rider?.minDamage ?? rider?.min ?? 0)) + equipElemMin
  const rawElemMax =
    (swing?.fromMissile === true
      ? (swing.elemMax ?? 0)
      : riderPoisScaled !== undefined
        ? riderPoisScaled.maxCumulHp
        : (rider?.maxDamage ?? rider?.max ?? 0)) + equipElemMax
  const fireMasteryScale =
    elementalType === 'fire' && monster.monProps.extraFirePct > 0
      ? (100 + monster.monProps.extraFirePct) / 100
      : 1
  const elemMin = Math.floor(rawElemMin * fireMasteryScale)
  const elemMax = Math.floor(rawElemMax * fireMasteryScale)
  const rawElemDuration =
    swing?.fromMissile === true
      ? (swing.elemDurationFrames ?? (elementalType === 'cold' ? (equipElem?.coldLengthFrames ?? 0) : 0))
      : (riderPoisScaled?.durationFrames ??
          rider?.durationFrames ??
          rider?.duration ??
          (elementalType === 'cold'
            ? (equipElem?.coldLengthFrames ?? 0)
            : elementalType === 'pois'
              ? (equipElem?.poisLengthFrames ?? 0)
              : 0))
  const elemDuration =
    elementalType === 'pois' && elemMax > 0 && rawElemDuration <= 0 ? 50 : rawElemDuration
  const missileRec =
    swing?.fromMissile === true && swing.missileId !== undefined
      ? this.registry.getMissileById(swing.missileId)
      : undefined
  // Pure elemental monster projectiles (`physMax <= 0 && elemMax > 0`) are spell missiles (#1796):
  // Shield Block cannot block them (`unblockable: true`), whereas Assassin dual-claw `Weapon Block` (#263)
  // and Amazon `Avoid` (#18) / `Evade` (#28) CAN!
  const isPureElemMonsterMissile =
    swing?.fromMissile === true && physMax <= 0 && elemMax > 0
  const resolvedAttackKind = isPureElemMonsterMissile
    ? 'spell'
    : swing?.fromMissile === true
      ? 'missile'
      : (swing?.attackKind ?? 'melee')
  // 1.13c `SUNITDMG` rolls the to-hit / damage / burn draws on `pAttacker->pSeed` (the monster) and the
  // block / avoid draws on `pDefender->pSeed` (the player), exactly like the player -> monster path in
  // `applyDamageToMonster`. Oracle trace: a missed zombie A2 swing draws once from the zombie seed.
  const monsterSeed113c =
    this.drlgRoomPopulator !== null
      ? this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${monster.unitId}`)
      : undefined
  const playerSeed113c =
    monsterSeed113c !== undefined
      ? this.unitSeeds.get(`${UNIT_TYPE_113C.player}:${player.unitId}`)
      : undefined
  // 1.13c monster melee swing (`kb/combat/d2game-sunitdmg-player-defender-113c.md` §2-§3):
  // `SUNITDMG_FillPacket` (`0x6FCFC530`) reads the attacker's `STAT_MINDAMAGE` / `STAT_MAXDAMAGE`
  // (21 / 22, the current A1/A2/S1 mode's MonStats damage) plus `item_normaldamage` (111) in 256ths and
  // `0x6FCFBED0` rolls `min + RAND(&pAttacker->pSeed, max - min)` (exclusive span, mask when the span is
  // a power of two). The FillDamageValues tail (`RAND(1)` + `MonStats.crit`) follows in `executeSUnitDmg`.
  const d2MeleeFillPacket113c =
    monsterSeed113c !== undefined && swing?.fromMissile !== true
      ? monsterFillPacketPhysRange113c(physMin, physMax, attackerCtx.statList.getAccruedStat('item_normaldamage'))
      : undefined
  const d2MonStatsCrit113c =
    d2MeleeFillPacket113c !== undefined ? monStatsCritPct113c(monster.hcIdx) : undefined
  const useExact113cDefenderDispatch =
    playerSeed113c !== undefined && !player.states.has(10) && !player.states.has(88)
  const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
    skillId: swing?.skillId ?? 0,
    attackKind: resolvedAttackKind,
    ...(monsterSeed113c !== undefined
      ? { d2AttackerSeed113c: monsterSeed113c, d2DefenderSeed113c: playerSeed113c }
      : {}),
    ...(useExact113cDefenderDispatch ? { deferDefenderReactiveEvents113c: true } : {}),
    ...(d2MeleeFillPacket113c !== undefined
      ? {
          srcDam: 128,
          riderSrcDam: 0,
          unrolledWeaponBase113c: {
            min256: d2MeleeFillPacket113c.min256,
            max256: d2MeleeFillPacket113c.max256,
            // `FillPacket` %ED pool: `STAT 25 damagepercent` (+ 17 / 18) of the attacker, which carries curses
            // such as Weaken (state 19, oracle `p52-necromancer-curses` F=1137: 512..768 at -33% -> 475).
            edPct: auraDmgPct + Math.trunc(attackerCtx.statList.getModifierBonus('damagepercent')),
            srcDam: 128,
          },
          monStatsCritPct113c: d2MonStatsCrit113c,
          // Only read by the `attackedinmelee` reactive events (`0x6FCFC0B0` callers); the physical roll
          // above uses `unrolledWeaponBase113c`.
          flatPhysMin256: d2MeleeFillPacket113c.min256,
          flatPhysMax256: d2MeleeFillPacket113c.max256,
        }
      : {
          // `weaponMaxPhys` is `0` on `attackerCtx`, so `srcDam: 128` adds 0 weapon damage while
          // enabling `executeSUnitDmg`'s physical-missile Crushing Blow & knockback checks (`#1897`, `#1898`).
          srcDam: resolvedAttackKind === 'missile' ? 128 : 0,
          flatPhysMin256: Math.floor(physMin * FIXED_ONE * (1 + auraDmgPct / 100)),
          flatPhysMax256: Math.floor(physMax * FIXED_ONE * (1 + auraDmgPct / 100)),
        }),
    ...(elementalType !== undefined
      ? {
          elemType: elementalType,
          elemMin256: Math.max(0, elemMin) * FIXED_ONE,
          elemMax256: Math.max(0, elemMax) * FIXED_ONE,
          elemDurationFrames: elemDuration,
        }
      : {}),
    ...(missileRec !== undefined && missileRec.damageRate > 0
      ? { damageRate: missileRec.damageRate }
      : {}),
    ...(playerSeed113c !== undefined && missileRec !== undefined && !missileRec.getHit
      ? { noHitRecovery: true }
      : {}),
    ...(swing?.arBonusPct !== undefined ? { toHitBonusPct: swing.arBonusPct } : {}),
    ...(swing?.autoHit === true || isPureElemMonsterMissile ? { autoHit: true } : {}),
    ...(swing?.unblockable !== undefined
      ? { unblockable: swing.unblockable }
      : isPureElemMonsterMissile
        ? { unblockable: true }
        : {}),
  }, this.rng)

  if (dmgOut.hit) {
    // Sync Energy Shield mana deduction & potential state collapse back to player
    const newMana256 = defenderStats.getMana256()
    if (newMana256 !== player.manaFixed) {
      player.manaFixed = Math.max(0, newMana256)
      player.mana = Math.floor(player.manaFixed / FIXED_ONE)
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId: 8,
        value: player.manaFixed,
      })
    }
    if (player.states.has(30) && !defenderStateBus.hasState('energyshield')) {
      this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 30)
    }
    // Sync Bone Armor (#68, state 14) & Cyclone Armor (#235, state 151) remaining absorb pools & shatter (#1793)
    if (hadBoneArmor && activeBaPool !== undefined) {
      const postBa = defenderStateBus.getState('bonearmor')
      const newBaPts = postBa ? (postBa.stats['bonearmor'] ?? 0) : 0
      if (newBaPts <= 0 || !defenderStateBus.hasState('bonearmor')) {
        this.playerBoneArmorPool.delete(player.unitId)
        this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 14)
      } else if (newBaPts !== activeBaPool.current) {
        this.playerBoneArmorPool.set(player.unitId, { current: newBaPts, max: activeBaPool.max })
        const persistent = this.playerCombat.get(player.unitId)
        persistent?.stateBus.applyState({
          stateNameOrId: 14,
          sourceUnitId: `player_${player.unitId}`,
          sourceSkillId: 68,
          slvl: postBa?.slvl ?? Math.max(1, this.resolvePlayerSkillLevelById(player, 68)),
          durationFrames: player.stateTimers.get(14) ?? 0,
          currentFrame: this.currentFrame,
          stats: {
            bonearmor: newBaPts * FIXED_ONE,
            bonearmormax: activeBaPool.max * FIXED_ONE,
          },
        })
        this.broadcastToArea(player.areaId, {
          type: 'StateSet',
          unit: { unitType: 0, id: player.unitId },
          state: 14,
          complete: true,
          stats: [
            { statId: 132, param: 0, value: newBaPts * FIXED_ONE },
            { statId: 133, param: 0, value: activeBaPool.max * FIXED_ONE },
          ],
        })
      }
    }
    if (hadCycloneArmor && activeCaPool !== undefined) {
      const postCa = defenderStateBus.getState('cyclonearmor')
      const newCaPts = postCa ? (postCa.stats['bonearmor'] ?? 0) : 0
      if (newCaPts <= 0 || !defenderStateBus.hasState('cyclonearmor')) {
        this.playerCycloneArmorPool.delete(player.unitId)
        this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 151)
      } else if (newCaPts !== activeCaPool.current) {
        this.playerCycloneArmorPool.set(player.unitId, { current: newCaPts, max: activeCaPool.max })
        const persistent = this.playerCombat.get(player.unitId)
        persistent?.stateBus.applyState({
          stateNameOrId: 151,
          sourceUnitId: `player_${player.unitId}`,
          sourceSkillId: 235,
          slvl: postCa?.slvl ?? Math.max(1, this.resolvePlayerSkillLevelById(player, 235)),
          durationFrames: player.stateTimers.get(151) ?? 0,
          currentFrame: this.currentFrame,
          stats: {
            bonearmor: newCaPts * FIXED_ONE,
            bonearmormax: activeCaPool.max * FIXED_ONE,
          },
        })
        this.broadcastToArea(player.areaId, {
          type: 'StateSet',
          unit: { unitType: 0, id: player.unitId },
          state: 151,
          complete: true,
          stats: [
            { statId: 132, param: 0, value: newCaPts * FIXED_ONE },
            { statId: 133, param: 0, value: activeCaPool.max * FIXED_ONE },
          ],
        })
      }
    }

    // Sync reactive Cold Armor (Frozen Armor / Shiver Armor) states & damage onto attacking monster
    for (const stName of dmgOut.attackerStatesApplied ?? []) {
      if (stName === 'freeze' && monster.resistances.cold < 100 && monster.coldEffect !== 0) {
        const rawFreezeFrames =
          attackerCtx.stateBus.getState('freeze')?.durationFrames ??
          this.resolveSkillColdOrFreezeDuration113c(player, 40, 'cold').rawFrames
        const divisor = Math.max(1, difficultyMonsterFreezeDivisor(this.difficulty))
        const freezeTicks = Math.trunc(rawFreezeFrames / divisor)
        if (freezeTicks > 0) {
          this.applyMonsterState(monster.unitId, 1, freezeTicks)
        }
      } else if (
        (stName === 'cold' || stName === 'chill') &&
        monster.resistances.cold < 100 &&
        monster.coldEffect !== 0
      ) {
        const rawChillFrames =
          attackerCtx.stateBus.getState(stName)?.durationFrames ??
          this.resolveSkillColdOrFreezeDuration113c(player, 50, 'cold').rawFrames
        const divisor = Math.max(1, difficultyMonsterColdDivisor(this.difficulty))
        const chillTicks = Math.trunc(rawChillFrames / divisor)
        if (chillTicks > 0) {
          this.applyMonsterState(monster.unitId, 11, chillTicks)
        }
      }
    }
    const applySecondaryMonsterHit113c = (
      targetMon: InternalMonsterRecord,
      resultFlags: number,
      rawPhys256: number,
      rawLtng256: number,
      channel: 'phys' | 'ltng',
    ): void => {
      if (targetMon.dead || !targetMon.isKillable) return
      const mStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
      mStats.setBaseStat('damageresist', targetMon.resistances.phys)
      mStats.setBaseStat('lightresist', targetMon.resistances.light)
      const mStateBus = new StateBus(mStats, this.registry)
      this.mirrorPersistentStates(this.monsterCombat.get(targetMon.unitId), mStateBus)
      const sec = resolveSecondaryMonsterSUnitDmg113c({
        playerUnitId: player.unitId,
        monsterUnitId: targetMon.unitId,
        monsterHpBefore256: monsterHp256_113c(targetMon),
        monsterMaxHp256: targetMon.maxHp * FIXED_ONE,
        resultFlags,
        rawPhys256,
        rawLtng256,
        monsterPhysRes: Math.trunc(getPrePierceResistance113c(mStats, 'damageresist')),
        monsterLtngRes: Math.trunc(getPrePierceResistance113c(mStats, 'lightresist')),
        casterLtngPierce: this.sumPlayerItemStat(player, 334),
      })
      emitSUnitDmgTraceEvent113c(sec.traceEvent)
      if (this.drlgRoomPopulator !== null && targetMon.aiAwake === false) {
        targetMon.nextAiFrame = Math.max(targetMon.nextAiFrame, this.currentFrame + 1)
      }
      targetMon.aiAwake = true
      targetMon.lastDamagedFrame113c = this.currentFrame
      targetMon.hp256 = sec.monsterHpAfter256
      targetMon.hp = Math.ceil(sec.monsterHpAfter256 / FIXED_ONE)
      targetMon.hp256Whole = targetMon.hp
      this.broadcastToArea(targetMon.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: targetMon.unitId,
        statId: 6,
        value: targetMon.hp,
      })
      if (sec.killed) {
        this.applyMonsterDeath(targetMon, player, channel)
      } else if (this.drlgRoomPopulator !== null && sec.dealt256 > 0 && targetMon.hp > 0) {
        const baseRegen256 = computeMonsterBaseDamageRegen113c(
          targetMon.maxHp * FIXED_ONE,
          targetMon.damageRegen,
          targetMon.boneConstructOwnerPlayerId !== undefined,
        )
        const poisonMod256 =
          targetMon.states.has(2) && targetMon.poisonBitrate256 > 0 ? -targetMon.poisonBitrate256 : 0
        const statListMod256 = Math.trunc(
          this.monsterCombat.get(targetMon.unitId)?.statList.getModifierBonus('hpregen') ?? 0,
        )
        if (baseRegen256 + poisonMod256 + statListMod256 !== 0) {
          targetMon.nextEvent3Frame113c = this.currentFrame + 1
          targetMon.event3Seq113c = allocateEvent3Seq113c(this)
        }
      }
    }

    const poisonBitrate256 = dmgOut.poisonBitrate256 ?? 0
    const poisonDurationFrames = dmgOut.poisonDurationFrames ?? 0
    const poisonTotal256 =
      poisonBitrate256 > 0 && poisonDurationFrames > 0 ? poisonBitrate256 * poisonDurationFrames : 0
    const signedTotalAll256 = dmgOut.signedTotalDamage256 ?? dmgOut.totalDamage256
    const signedInstant256 = signedTotalAll256 - poisonBitrate256
    const resultFlags113c = dmgOut.resultFlags113c ?? 0x05

    if (useExact113cDefenderDispatch && playerSeed113c !== undefined) {
      // 1.13c `0x6FCFE1E2`: Attacker `ITEMEVENTS_Dispatch(5 /* domeleedamage */)` (`#76 Iron Maiden` `state 55`).
      if (swing?.fromMissile !== true && !monster.dead && monster.isKillable && monster.states.has(55)) {
        const imState = attackerCtx.stateBus.getState('ironmaiden') ?? attackerCtx.stateBus.getState(55)
        const imPct =
          imState?.stats['thorns_percent'] ??
          200 + 25 * (Math.max(1, imState?.slvl ?? 1) - 1)
        const rawIm256 = computeIronMaidenReflectRawPhys256_113c(
          dmgOut.signedPhysDamage256 ?? dmgOut.physDamage256,
          imPct,
          false,
        )
        if (rawIm256 > 0) {
          applySecondaryMonsterHit113c(monster, 0x4021, rawIm256, 0, 'phys')
        }
      }
      // 1.13c `0x6FCFE1F2` / `0x6FCFE1D6`: Defender `ITEMEVENTS_Dispatch(1 | 2)` in LIFO equip order.
      const eventBit = swing?.fromMissile === true ? 0x04 : 0x02
      const itemEvents = collectPlayerDefenderItemEventsLifo113c(player.items)
      for (const node of itemEvents.nodes) {
        if ((node.eventMask & eventBit) === 0) continue
        if (node.statId === 78) {
          const atd =
            Math.trunc(defenderStats.getAccruedStat('item_attackertakesdamage')) +
            this.sumPlayerItemStat(player, 78)
          if (atd > 0) {
            applySecondaryMonsterHit113c(monster, 0x4021, atd * FIXED_ONE, 0, 'phys')
          }
        } else if (node.statId === 128) {
          const atld =
            Math.trunc(defenderStats.getAccruedStat('item_attackertakeslightdamage')) +
            this.sumPlayerItemStat(player, 128)
          if (atld > 0) {
            applySecondaryMonsterHit113c(monster, 0x4021, 0, atld * FIXED_ONE, 'ltng')
          }
        } else if (node.statId === 114) {
          const dtmPct =
            Math.trunc(defenderStats.getAccruedStat('item_damagetomana')) +
            this.sumPlayerItemStat(player, 114)
          const dtmOut = computeDamageToManaGain256_113c(
            signedTotalAll256,
            dtmPct,
            player.manaFixed,
            this.getPlayerAccruedMaxManaFixed(player),
          )
          if (dtmOut.gain256 > 0) {
            player.manaFixed = dtmOut.nextMana256
            player.mana = Math.floor(player.manaFixed / FIXED_ONE)
            this.emitToPlayer(player.unitId, {
              type: 'UnitStatUpdate',
              unitType: 'player',
              unitId: player.unitId,
              statId: 8,
              value: player.manaFixed,
            })
          }
        } else if (node.statId === 201 && !player.states.has(54)) {
          const ctc = itemEvents.ctcChanceByLayer.get(node.layer)
          if (ctc !== undefined && rollPlayerDefenderCtcEntry113c(playerSeed113c, resultFlags113c, ctc.chance)) {
            if (ctc.skillId === 42) {
              const radius = 5 + (ctc.slvl - 1)
              const r2 = radius * radius
              const cx = Math.floor(player.x)
              const cy = Math.floor(player.y)
              const staticMin = this.difficulty === 2 ? 50 : this.difficulty === 1 ? 33 : 0
              const sfTargets = [...this.monsters.values()]
                .filter((m) => {
                  if (m.dead || !m.isKillable || m.isNpc || m.submerged || m.align !== 0 || this.isMonsterConverted(m)) {
                    return false
                  }
                  if (TOWN_AREAS.has(m.areaId)) return false
                  if (m.areaId !== player.areaId && !this.isAreaSeamAdjacent(player.areaId, m.areaId)) return false
                  const dx = Math.floor(m.x) - cx
                  const dy = Math.floor(m.y) - cy
                  return dx * dx + dy * dy <= r2
                })
                .sort((a, b) => b.unitId - a.unitId)
              for (const m of sfTargets) {
                if (m.dead) continue
                const mStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
                mStats.setBaseStat('lightresist', m.resistances.light)
                const mStateBus = new StateBus(mStats, this.registry)
                this.mirrorPersistentStates(this.monsterCombat.get(m.unitId), mStateBus)
                const rawLtng256 = computeStaticFieldTargetLtng256_113c({
                  curHp256: monsterHp256_113c(m),
                  maxHp256: m.maxHp * FIXED_ONE,
                  staticFieldMinPct: staticMin,
                  rawTargetLtngRes: Math.trunc(getPrePierceResistance113c(mStats, 'lightresist')),
                })
                if (rawLtng256 !== null) {
                  applySecondaryMonsterHit113c(m, 0x4001, 0, rawLtng256, 'ltng')
                }
              }
            } else {
              this.executePlayerItemProcSkill113c(player, ctc.skillId, ctc.slvl, 201, { target: monster })
            }
          }
        }
      }
    } else {
      const atdBonus256 =
        swing?.fromMissile !== true
          ? (Math.trunc(defenderStats.getAccruedStat('item_attackertakesdamage')) +
              this.sumPlayerItemStat(player, 78)) *
            Math.max(0, Math.trunc((100 - monster.resistances.phys) * FIXED_ONE / 100))
          : 0
      const atldBonus256 =
        swing?.fromMissile !== true
          ? (Math.trunc(defenderStats.getAccruedStat('item_attackertakeslightdamage')) +
              this.sumPlayerItemStat(player, 128)) *
            Math.max(0, Math.trunc((100 - monster.resistances.light) * FIXED_ONE / 100))
          : 0
      const reactiveMonsterDmg = Math.floor(
        ((dmgOut.attackerColdDamage256 ?? 0) +
          (dmgOut.reflectedPhys256 ?? 0) +
          atdBonus256 +
          atldBonus256) /
          FIXED_ONE,
      )
      if (reactiveMonsterDmg > 0 && !monster.dead && monster.isKillable) {
        monster.hp = Math.max(0, monster.hp - reactiveMonsterDmg)
        this.broadcastToArea(monster.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: monster.unitId,
          statId: 6,
          value: monster.hp,
        })
        if (monster.hp <= 0) {
          this.applyMonsterDeath(monster, player, 'phys')
        }
      }
      const dtmPct =
        Math.trunc(defenderStats.getAccruedStat('item_damagetomana')) +
        this.sumPlayerItemStat(player, 114)
      const dtmOut = computeDamageToManaGain256_113c(
        signedTotalAll256,
        dtmPct,
        player.manaFixed,
        this.getPlayerAccruedMaxManaFixed(player),
      )
      if (dtmOut.gain256 > 0) {
        player.manaFixed = dtmOut.nextMana256
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 8,
          value: player.manaFixed,
        })
      }
    }

    // 1.13c `SUNITDMG_ApplyPoison` (`0x6FCFCAB0`) & `SUNITDMG_ExecuteEvents` (`0x6FCFE237`, #1989):
    // Poison damage (`poisonBitrate256 * poisonDurationFrames`) is NEVER deducted instantaneously on impact;
    // it arms `STATE_POISON` (`2`) with `STAT_HPREGEN = -poisonBitrate256`, ticked per frame in `stepPlayerVitals`
    // (`0x6FC97CB0`, clamped at `256` = `1 HP`).
    const instantDamage256 = useExact113cDefenderDispatch
      ? Math.max(0, signedInstant256)
      : Math.max(0, dmgOut.totalDamage256 - poisonTotal256)
    const finalDmg = Math.floor(instantDamage256 / FIXED_ONE)
    if (poisonBitrate256 > 0 && poisonDurationFrames > 0 && !player.dead) {
      const playerCtx = this.playerCombatContext(player)
      const prevPois = playerCtx.stateBus.getState(2) ?? playerCtx.stateBus.getState('poison')
      const prevBitrate256 = prevPois
        ? Math.max(0, prevPois.stats['poisonmindam'] ?? -(prevPois.stats['hpregen'] ?? 0))
        : 0
      if (!player.states.has(2) || prevPois === undefined || poisonBitrate256 >= prevBitrate256) {
        playerCtx.stateBus.removeState('poison')
        playerCtx.stateBus.applyState({
          stateNameOrId: 2,
          sourceUnitId: `monster_${monster.unitId}`,
          sourceSkillId: swing?.skillId ?? 0,
          slvl: Math.max(1, monster.level),
          durationFrames: poisonDurationFrames,
          currentFrame: this.currentFrame,
          stats: {
            hpregen: -poisonBitrate256,
            poisonmindam: poisonBitrate256,
            poisonlength: poisonDurationFrames,
          },
        })
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          2,
          poisonDurationFrames,
        )
      }
    }
    const absorbHeal256 = dmgOut.absorbHeal256 ?? 0
    let exact113cKilledPlayer = false
    if (useExact113cDefenderDispatch && !player.dead) {
      // 1.13c `0x6FCFE200..0x6FCFE269`: clamp `dwPhysDamage <= curHp256`, apply `dwAbsorbLife` heal,
      // subtract exact `dwDmgTotal` in 256ths (`< 0x100 -> 0`), then roll durability (`0x6FCFEE2B`)
      // and `0x6FCB8A70` `stat 131` `thorns_percent` (`0x6FCFEE8E`).
      const lifeOut = computePreDamageAbsorbAndLife113c({
        hpBefore256: player.hpFixed,
        maxHp256: this.getPlayerAccruedMaxHpFixed(player),
        signedPhys256: dmgOut.signedPhysDamage256 ?? dmgOut.physDamage256,
        signedTotalInstant256: signedInstant256,
        absorbHeal256,
        hasDeathDelayState: player.states.has(92),
      })
      exact113cKilledPlayer = lifeOut.killed
      if (lifeOut.hpAfter256 !== player.hpFixed) {
        player.hpFixed = lifeOut.hpAfter256
        player.hp = Math.max(0, Math.ceil(player.hpFixed / FIXED_ONE))
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 6,
          value: player.hpFixed,
        })
        this.emitToPlayer(player.unitId, {
          type: 'LifeMana',
          life: player.hp,
          mana: player.mana,
          stamina: player.stamina,
          at: playerWirePosition(player),
          vx: 0,
          vy: 0,
        })
      }
      if (
        elementalType === 'cold' &&
        elemDuration > 0 &&
        swing?.fromMissile !== true &&
        dmgOut.elemDamage256 > 0 &&
        player.hp > 0
      ) {
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          11,
          elemDuration,
        )
      }
      if (playerSeed113c !== undefined && swing?.fromMissile !== true) {
        const durabilityDraws = rollPlayerDefenderArmorDurability113c(
          playerSeed113c,
          player.items.filter(
            (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
          ),
        )
        if (durabilityDraws > 0) {
          this.syncPlayerEquippedSetStates113c(player)
        }
      }
      if (
        (resultFlags113c & 0x04) !== 0 &&
        swing?.fromMissile !== true &&
        !monster.dead &&
        monster.isKillable
      ) {
        const thornsPct =
          Math.trunc(defenderStats.getAccruedStat('thorns_percent')) +
          this.sumPlayerItemStat(player, 131)
        const rawThorns256 = computeThornsAuraReflectRawPhys256_113c(
          lifeOut.lifeClampedPhys256,
          thornsPct,
          false,
        )
        if (rawThorns256 > 0) {
          applySecondaryMonsterHit113c(monster, 0x4021, rawThorns256, 0, 'phys')
        }
      }
    } else {
      // 1.13c `SUNITDMG_ExecuteEvents` (`0x6FCFE237` -> `SUNITDMG_AddLife` `0x6FCFB570`):
      // Add `dwAbsorbLife` (`dmgOut.absorbHeal256`) to defender life (clamped at `maxhp`) BEFORE
      // subtracting `dwTotalDamage` (`finalDmg`).
      if (absorbHeal256 > 0 && !player.dead && player.hpFixed > 0 && !player.states.has(92)) {
        const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
        const nextHpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + absorbHeal256)
        if (nextHpFixed !== player.hpFixed) {
          player.hpFixed = nextHpFixed
          player.hp = Math.max(0, Math.ceil(player.hpFixed / FIXED_ONE))
          if (finalDmg <= 0) {
            this.emitToPlayer(player.unitId, {
              type: 'UnitStatUpdate',
              unitType: 'player',
              unitId: player.unitId,
              statId: 6,
              value: player.hpFixed,
            })
            this.emitToPlayer(player.unitId, {
              type: 'LifeMana',
              life: player.hp,
              mana: player.mana,
              stamina: player.stamina,
              at: playerWirePosition(player),
              vx: 0,
              vy: 0,
            })
          }
        }
      }
      if (
        elementalType === 'cold' &&
        elemDuration > 0 &&
        swing?.fromMissile !== true &&
        dmgOut.elemDamage256 > 0 &&
        !player.dead
      ) {
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          11,
          elemDuration,
        )
      }
      // 1.13c `SUNITDMG_ExecuteCombat` (`0x6FCFED30`) -> `0x6FCFEBA0`: after a landed hit, a player defender
      // picks a weighted armor slot and may lose durability (2-3 draws on `pDefender->pSeed`), before the
      // GetHit / mode decision of `SUNITDMG_ExecuteEvents` (`0x6FCFCF20`).
      if (playerSeed113c !== undefined && swing?.fromMissile !== true) {
        rollPlayerDefenderArmorDurability113c(
          playerSeed113c,
          player.items.filter(
            (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
          ),
        )
      }
    }
    if (useExact113cDefenderDispatch && exact113cKilledPlayer && finalDmg <= 0) {
      const monKillerTypeOnFractionalDeath: DeathKillerKind113c =
        monster.convertedUntilFrame > this.currentFrame && monster.convertedByPlayerId > 0
          ? 'player_pet'
          : 'monster'
      this.triggerPlayerCtcProcs113c(player, 197, { target: monster })
      this.killPlayer(player, {
        killerType: monKillerTypeOnFractionalDeath,
        killerUnitId: monster.unitId,
      })
    }
    if (finalDmg > 0) {
      const isPhysicalOrWeaponHit = isPhysicalOrWeaponMonsterHit113c({
        autoHit: swing?.autoHit,
        fromMissile: swing?.fromMissile,
        physMax,
        elemMax,
        elementType: swing?.elementType,
      })
      // 1.13c `Missiles.txt` `NoUniqueMod` (`D2Game.dll` `0x6FC42026..0x6FC42032`, #2017):
      // Skips `MonUMod` hit riders (`#7 Cursed`, `#25 Mana Burn`, `#9/#17/#18/#23/#27/#36` Enchanted)
      // when `MissilesTxt.NoUniqueMod != 0`.
      const allowUniqueModRiders = isPhysicalOrWeaponHit && missileRec?.noUniqueMod !== true
      // 1.13c `MonUMod #7` (`Cursed`, `D2Game.dll` `0x6FC44250`, boss-only `bBoss != 0`, #1904 / #1993 / #2003):
      // Rolls `75%` chance (`rand(100) < 75`) on physical/weapon hits to apply `#66 Amplify Damage` (`state 9`)
      // at `slvl = floor(mlvl / 5) + 1` for `200 + 75 * (slvl - 1)` frames (scaled by `curse_resistance`).
      if (
        allowUniqueModRiders &&
        monster.rank !== 'minion' &&
        monster.umodIds.includes(MON_UMOD.CURSE) &&
        this.rng.rand(100) < CURSED_PROC_CHANCE_PCT_113C &&
        !player.states.has(57)
      ) {
        const curseRes = Math.trunc(defenderStats.getAccruedStat('curse_resistance'))
        const cursed = computeCursedAmplifyDamage113c(monster.level, curseRes)
        const rawCursed = computeCursedAmplifyDamage113c(monster.level, 0)
        if (cursed.durationFrames > 0) {
          const playerCtx = this.playerCombatContext(player)
          for (const prevCurseId of [19, 55, 58, 60, 61, 113, 114]) {
            if (player.states.has(prevCurseId)) {
              playerCtx.stateBus.removeState(prevCurseId)
              this.clearUnitState(
                player.states,
                player.stateTimers,
                'player',
                player.unitId,
                player.areaId,
                prevCurseId,
              )
            }
          }
          this.applyUnitState(
            player.states,
            player.stateTimers,
            'player',
            player.unitId,
            player.areaId,
            9,
            rawCursed.durationFrames,
          )
          playerCtx.stateBus.applyState({
            stateNameOrId: 'amplifydamage',
            sourceUnitId: `monster_${monster.unitId}`,
            sourceSkillId: 66,
            slvl: cursed.slvl,
            durationFrames: rawCursed.durationFrames,
            currentFrame: this.currentFrame,
            stats: { damageresist: -100 },
          })
        }
      }
      // 1.13c `MonUMod #25` (`Mana Burn`, `D2Game.dll` `0x6FC421D0` / `0x6FC422DD: shl esi, 0x8`, #1905 / #2003):
      // Drains `66%..100%` (`33%..50%` minion) of monster physical base damage on physical/weapon hits,
      // with melee `<< 8` (`256x`) shift. Pure elemental spell missiles never proc Mana Burn.
      if (allowUniqueModRiders && monster.umodIds.includes(MON_UMOD.MANahit)) {
        const drainFixed = computeManaBurnDrainFixed113c({
          isMinion: monster.rank === 'minion',
          isMelee: swing?.fromMissile !== true,
          baseMinDmg: swing?.minDmg ?? monster.minDmg,
          baseMaxDmg: swing?.maxDmg ?? monster.maxDmg,
          rollInt: (lo, hi) => lo + this.rng.rand(Math.max(1, hi - lo + 1)),
        })
        const nextManaFixed = Math.max(0, player.manaFixed - drainFixed)
        if (nextManaFixed !== player.manaFixed) {
          player.manaFixed = nextManaFixed
          player.mana = Math.floor(player.manaFixed / FIXED_ONE)
          this.emitToPlayer(player.unitId, {
            type: 'UnitStatUpdate',
            unitType: 'player',
            unitId: player.unitId,
            statId: 8,
            value: player.manaFixed,
          })
          this.emitPlayerVitals(player)
        }
      }
      const monKillerType: DeathKillerKind113c =
        monster.convertedUntilFrame > this.currentFrame && monster.convertedByPlayerId > 0
          ? 'player_pet'
          : 'monster'
      // 1.13c melee/weapon elemental riders (`#9 Fire`, `#17 Lightning`, `#18 Cold`, `#23 Poison`,
      // boss-only `#27 Spectral Hit` 1-of-5 roll, and `#36 Ghostly`; #1890, #1903, #2003).
      if (
        allowUniqueModRiders &&
        (monster.umodIds.includes(MON_UMOD.FIRE) ||
          monster.umodIds.includes(MON_UMOD.LIGHTNING) ||
          monster.umodIds.includes(MON_UMOD.COLD) ||
          monster.umodIds.includes(MON_UMOD.POISON) ||
          (monster.rank !== 'minion' && monster.umodIds.includes(MON_UMOD.SPECTRALHIT)) ||
          monster.umodIds.includes(MON_UMOD.GHOSTLY))
      ) {
        const ench = rollEnchantedAttackBonus113c({
          umodIds: monster.umodIds,
          isMinion: monster.rank === 'minion',
          mlvl: monster.level,
          baseMinDmg: swing?.minDmg ?? monster.minDmg,
          baseMaxDmg: swing?.maxDmg ?? monster.maxDmg,
          rollInt: (lo, hi) => lo + this.rng.rand(Math.max(1, hi - lo + 1)),
        })
        if (
          ench.fireDmg > 0 ||
          ench.lightDmg > 0 ||
          ench.coldDmg > 0 ||
          ench.magicDmg > 0 ||
          ench.poisonDmg > 0
        ) {
          this.applyPlayerElementalDamage(
            player,
            {
              ...(ench.fireDmg > 0 ? { fire: ench.fireDmg } : {}),
              ...(ench.lightDmg > 0 ? { light: ench.lightDmg } : {}),
              ...(ench.coldDmg > 0 ? { cold: ench.coldDmg } : {}),
              ...(ench.magicDmg > 0 ? { mag: ench.magicDmg } : {}),
              ...(ench.poisonDmg > 0
                ? {
                    pois: ench.poisonDmg,
                    poisDurationFrames: ench.poisonFrames > 0 ? ench.poisonFrames : 50,
                  }
                : {}),
            },
            { skipGetHit: true, killerType: monKillerType, killerUnitId: monster.unitId },
          )
        }
        if (
          ench.chillFrames > 0 &&
          !player.dead &&
          defenderStats.getAccruedStat('item_cannotbefrozen') <= 0
        ) {
          const effColdRes = this.playerResistPct(player, 'cold')
          if (effColdRes < 100) {
            let mitigatedChill = Math.floor((ench.chillFrames * (100 - effColdRes)) / 100)
            if (defenderStats.getAccruedStat('item_halffreezeduration') > 0) {
              mitigatedChill = Math.floor(mitigatedChill / 2)
            }
            if (mitigatedChill > 0) {
              this.applyUnitState(
                player.states,
                player.stateTimers,
                'player',
                player.unitId,
                player.areaId,
                11,
                Math.max(player.stateTimers.get(11) ?? 0, mitigatedChill),
              )
            }
          }
        }
      }
      // 1.13c `MISSILES_ApplyDamageInner` (`D2Game.dll` `0x6FC5AEAB..0x6FC5AEEB`, #2017):
      // `MissilesTxt.GetHit == 0` never sets `RESULTFLAG_GETHIT (0x0004)` (`#675 megademoninferno`,
      // `#176 diabfire`, `#180 diabwall`, etc.), while `MissilesTxt.KnockBack > 0` (`byte [ebx+0xAE]`)
      // rolls `rand(100) < KnockBack` to set `RESULTFLAG_KNOCKBACK (0x0008)`.
      const missileKnockbackTriggered =
        missileRec !== undefined &&
        missileRec.knockBack > 0 &&
        this.rng.rand(100) < missileRec.knockBack
      const skipMissileGetHit =
        missileRec !== undefined && !missileRec.getHit && !missileKnockbackTriggered
      const resolvedHitClassForGetHit = this.resolveMonsterHitClass113c(
        monster,
        swing?.skillId ?? 0,
        swing?.missileId ?? 0,
      )
      const isPurePoisonHit = elementalType === 'pois' && physMin <= 0 && physMax <= 0
      if (useExact113cDefenderDispatch) {
        if (exact113cKilledPlayer || player.hp <= 0) {
          this.triggerPlayerCtcProcs113c(player, 197, { target: monster })
          this.killPlayer(player, {
            killerType: monKillerType,
            killerUnitId: monster.unitId,
          })
        } else if (
          (resultFlags113c & 0x04) !== 0 &&
          !skipMissileGetHit &&
          !missileKnockbackTriggered
        ) {
          this.maybeEnterPlayerHitRecovery(player, finalDmg, {
            dmg256: instantDamage256,
            hitClass: resolvedHitClassForGetHit,
            isPurePoison: isPurePoisonHit,
          })
        }
      } else {
        this.applyDamageToPlayer(player, finalDmg, {
          ...(d2MeleeFillPacket113c !== undefined ? { dmg256: instantDamage256 } : {}),
          hitClass: resolvedHitClassForGetHit,
          isPurePoison: isPurePoisonHit,
          ...(skipMissileGetHit || missileKnockbackTriggered ? { skipGetHit: true } : {}),
          killerType: monKillerType,
          killerUnitId: monster.unitId,
        })
        // 1.13c `item_skillongethit` (201): a damaging hit that the player survives (#1797).
        if (!player.dead && player.hp > 0) {
          this.triggerPlayerCtcProcs113c(player, 201, { target: monster })
        }
      }
      // `#1897` / `#1898` / `#2017` `Missiles.txt` `KnockBack`, `MonProp.txt` & `MonEquip.txt` on-hit effects:
      if (!player.dead && missileKnockbackTriggered) {
        this.knockbackPlayerFromBoss113c(player, monster.x, monster.y, 2)
      } else if (
        !player.dead &&
        (monster.monProps.knockback || Boolean(monster.monEquipLoadout?.knockback)) &&
        !isPureElemMonsterMissile &&
        rollItemKnockback113c(this.rng, { unitType: 'player', sizeX: 2 })
      ) {
        this.knockbackPlayerFromBoss113c(player, monster.x, monster.y, 2)
      }
      // 2) `MonEquip.txt` CtC curses on striking (`#66`, `#87`, `#72`, `#91`):
      if (!player.dead && monster.monEquipLoadout && monster.monEquipLoadout.ctcProcs.length > 0) {
        for (const proc of monster.monEquipLoadout.ctcProcs) {
          if (proc.chancePct > 0 && this.rng.rand(100) < proc.chancePct) {
            this.applyMonsterCurseToTarget113c(
              monster,
              { kind: 'player', player },
              proc.skillId,
              Math.max(1, proc.slvl),
            )
          }
        }
      }
      // 3) `#1895` `BloodLord` (`#328 BloodLordFrenzy`): stacks attack & move haste on melee hits!
      if (
        !monster.dead &&
        swing?.fromMissile !== true &&
        (monster.ai === 'BloodLord' || monster.skills.some((s) => s.skillId === 328))
      ) {
        const prevStacks = this.currentFrame < monster.frenzyUntilFrame ? monster.frenzySpeedPct : 0
        monster.frenzySpeedPct = Math.min(100, Math.max(25, prevStacks + 25))
        monster.frenzyUntilFrame = this.currentFrame + 150
        this.applyMonsterState(monster.unitId, 141, 150)
      }
      // 4) `MonStats.txt` `El1Type` (`mana` on `wraith1..9` Ghost, `stam` on `swarm`/`mosquito`,
      // `life` on `foulcrow6`, `stun` on `thornhulk`/`snowyeti`/`duriel`):
      const riderDrainOrStun = swing?.fromMissile === true ? undefined : rider?.type
      if (riderDrainOrStun === 'mana' && !player.dead) {
        const mLo = Math.max(1, rider?.minDamage ?? rider?.min ?? 1)
        const mHi = Math.max(mLo, rider?.maxDamage ?? rider?.max ?? mLo)
        const drained = this.rollInclusive(mLo, mHi)
        player.manaFixed = Math.max(0, player.manaFixed - drained * FIXED_ONE)
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 8,
          value: player.manaFixed,
        })
      } else if (riderDrainOrStun === 'stam' && !player.dead) {
        const sLo = Math.max(1, rider?.minDamage ?? rider?.min ?? 1)
        const sHi = Math.max(sLo, rider?.maxDamage ?? rider?.max ?? sLo)
        const drained = this.rollInclusive(sLo, sHi)
        player.staminaFixed = Math.max(0, player.staminaFixed - drained * FIXED_ONE)
        player.stamina = Math.floor(player.staminaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 10,
          value: player.staminaFixed,
        })
      } else if (riderDrainOrStun === 'life' && !monster.dead) {
        const lLo = Math.max(1, rider?.minDamage ?? rider?.min ?? 1)
        const lHi = Math.max(lLo, rider?.maxDamage ?? rider?.max ?? lLo)
        const healed = this.rollInclusive(lLo, lHi)
        const nextHp = Math.min(monster.maxHp, monster.hp + healed)
        if (nextHp !== monster.hp) {
          monster.hp = nextHp
          this.broadcastToArea(monster.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: monster.unitId,
            statId: 6,
            value: monster.hp,
          })
        }
      } else if (riderDrainOrStun === 'stun' && !player.dead) {
        const stunDur = Math.max(10, rider?.durationFrames ?? rider?.duration ?? 25)
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          21,
          stunDur,
        )
      }
      // 1.13c `MISSMODE_SrvHit31_Firehead` (`D2Game.dll` `0x6FC5A920`, `#277 firehead` / `#333 VampireMissile`, #2007):
      // Heals `pOwner` by `100%` of actual damage dealt (`add eax, esi`), clamped to `maxHp`.
      // Other Vampire spells (`#169 VampireFireball`, `#170 VampireFirewall`, `#171 VampireMeteor`) do NOT steal life;
      // Vampire innate life drain applies strictly to melee swings (`!swing?.fromMissile`, `0x6FC95E10`).
      const missileSrvHitFunc =
        swing?.fromMissile === true && swing.missileId !== undefined
          ? this.registry.getMissileById(swing.missileId)?.pSrvHitFunc
          : undefined
      if (missileSrvHitFunc === 31 && finalDmg > 0 && !monster.dead) {
        const nextHp = Math.min(monster.maxHp, monster.hp + finalDmg)
        if (nextHp !== monster.hp) {
          monster.hp = nextHp
          this.broadcastToArea(monster.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: monster.unitId,
            statId: 6,
            value: monster.hp,
          })
        }
      }
      // MonAi innate drain rows (Vampire/BatDemon/BloodLord melee life, WillOWisp
      // mana, Swarm stamina, Mosquito life). 1.13c returns half the hit.
      const isVampireMissile =
        swing?.fromMissile === true && normalizeMonAiName113c(monster.ai) === 'vampire'
      const drainKind =
        riderDrainOrStun === 'mana' ||
        riderDrainOrStun === 'stam' ||
        riderDrainOrStun === 'life' ||
        missileSrvHitFunc === 31 ||
        isVampireMissile
          ? undefined
          : monsterProfile113c(monster.ai).drain
      const drainAmount = Math.max(1, Math.floor(finalDmg / 2))
      if (drainKind === 'life' && !monster.dead) {
        const nextHp = Math.min(monster.maxHp, monster.hp + drainAmount)
        if (nextHp !== monster.hp) {
          monster.hp = nextHp
          this.broadcastToArea(monster.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: monster.unitId,
            statId: 6,
            value: monster.hp,
          })
        }
      } else if (drainKind === 'mana') {
        player.manaFixed = Math.max(0, player.manaFixed - drainAmount * FIXED_ONE)
        player.mana = Math.floor(player.manaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 8,
          value: player.manaFixed,
        })
      } else if (drainKind === 'stamina') {
        player.staminaFixed = Math.max(
          0,
          player.staminaFixed - drainAmount * FIXED_ONE,
        )
        player.stamina = Math.floor(player.staminaFixed / FIXED_ONE)
        this.emitToPlayer(player.unitId, {
          type: 'UnitStatUpdate',
          unitType: 'player',
          unitId: player.unitId,
          statId: 10,
          value: player.staminaFixed,
        })
      }
    }
  } else if (
    (dmgOut.avoidedReason === 'block' || dmgOut.avoidedReason === 'weapon_block') &&
    // 1.13c `D2Game.dll` `0x6FC5AF0D..0x6FC5AF3B` (#2017): blocking a `GetHit == 0 && KnockBack == 0`
    // stream clears `RESULTFLAG_HIT`, sets `RESULTFLAG_SOFTHIT`, and suppresses `PLRMODE_BLOCK` (`mode 9`).
    !(missileRec !== undefined && !missileRec.getHit && missileRec.knockBack <= 0)
  ) {
    // `0x6FCFD2F8..0x6FCFD337` (kb/engine/d2game-plrmode-gethit-113c.md §1): the BL mode is only started when
    // `dwGameFrame - STAT 95 > 15 + STAT 102 (FBR) / 8`; `STAT 95 = dwGameFrame` afterwards.
    let blockModeAllowed = true
    if (this.drlgRoomPopulator !== null) {
      const combatForFbr = this.playerCombat.get(player.unitId)
      const fbr =
        this.sumPlayerItemStat(player, 102) +
        (combatForFbr?.statList ? Math.trunc(combatForFbr.statList.getModifierBonus('item_fasterblockrate')) : 0)
      blockModeAllowed = this.currentFrame - (player.lastBlockFrame113c ?? 0) > 15 + Math.trunc(fbr / 8)
    }
    if (blockModeAllowed && !this.isPlayerSkillUninterruptible113c(player)) {
      this.interruptPendingPlayerAnimAction113c(player, 'BL')
      const blockFrames = this.playerBlockRecoveryFrames(player)
      player.mode = 9
      player.blockRecoveryMode113c = 9
      // `SUNITDMG_ExecuteEvents` (`0x6FCFCF20`) starts `PLRMODE_BLOCK` inside the MONSTER's update, after
      // the player's own unit update of this frame, so the BL animation accumulator first advances on the
      // next frame: the mode lasts `ceil(frames * 256 / speed)` frames = `computeOneShotTicks + 1`
      // (oracle `p52-amazon-defense`: BL at F=916, NU at F=922). See
      // `kb/combat/d2game-sunitdmg-player-defender-113c.md` §7.
      player.blockRecoveryUntilFrame =
        this.currentFrame + blockFrames + (this.drlgRoomPopulator !== null ? 1 : 0)
      player.targetX = player.x
      player.targetY = player.y
      const motion = this.playerMotion.get(player.unitId)
      if (motion !== undefined) {
        motion.mover.setPosition(player.x, player.y)
        motion.x = player.x
        motion.y = player.y
        motion.moving = false
        motion.plannedX = Number.NaN
        motion.plannedY = Number.NaN
      }
      this.broadcastToArea(player.areaId, {
        type: 'UnitMode',
        unitType: 0,
        id: player.unitId,
        mode: 9,
        at: playerWirePosition(player),
        lifePct:
          player.maxHp > 0
            ? Math.max(0, Math.round((player.hp / player.maxHp) * 128))
            : 0,
      })
    }
    if (blockModeAllowed && this.drlgRoomPopulator !== null) {
      player.lastBlockFrame113c = this.currentFrame
    }
  } else if (
    this.drlgRoomPopulator !== null &&
    (dmgOut.avoidedReason === 'dodge' || dmgOut.avoidedReason === 'avoid')
  ) {
    // `SUNITDMG_ExecuteEvents` player branch (`0x6FCFD1CE..0x6FCFD258`, kb/engine/d2game-plrmode-gethit-113c.md §1):
    // dodge (`0x80`) / avoid (`0x100`) read the skill of state 65 / 66 (`#10871` + `#10680(.., 350)` + `#10630`)
    // and start `PLRMODE_StartMode(13 = S1, skill)` (`0x6FC98430`); no state / skill -> no mode.
    const passiveStateId = dmgOut.avoidedReason === 'dodge' ? 65 : 66
    const passiveSkillId = dmgOut.avoidedReason === 'dodge' ? 13 : 18
    const passiveCombat = this.playerCombat.get(player.unitId)
    const hasPassiveState =
      player.states.has(passiveStateId) ||
      Boolean(passiveCombat?.stateBus.hasState(passiveStateId)) ||
      Boolean(passiveCombat?.statList.getActiveModifiers().some((m) => m.stateId === passiveStateId))
    if (hasPassiveState && this.resolvePlayerSkillLevelById(player, passiveSkillId) > 0) {
      const equippedForAnim = player.items.filter(
        (item) => item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12,
      )
      const s1Params = resolveCharacterAnimSpeedParams(player.classCode, 's1', {
        equipment: equippedForAnim.map((item) => ({ code: item.code, bodyLoc: item.bodyLoc })),
        weaponClass: resolveEquippedWeaponClass(
          equippedForAnim.map((item) => ({ code: item.code, bodyLoc: item.bodyLoc })),
        ),
        skillId: passiveSkillId,
      })
      this.interruptPendingPlayerAnimAction113c(player, 'BL')
      player.mode = 13
      // Started inside the monster's update: visible for `ceil(frames * 256 / speed)` frames (§2).
      player.blockRecoveryUntilFrame =
        this.currentFrame + computeOneShotTicks(s1Params.frames, s1Params.stepSpeed256) + 1
      player.blockRecoveryMode113c = 13
      player.targetX = player.x
      player.targetY = player.y
      this.broadcastToArea(player.areaId, {
        type: 'UnitMode',
        unitType: 0,
        id: player.unitId,
        mode: 13,
        at: playerWirePosition(player),
        lifePct:
          player.maxHp > 0
            ? Math.max(0, Math.round((player.hp / player.maxHp) * 128))
            : 0,
      })
    }
  }
  return dmgOut.hit
}

export interface MonsterMeleeAttacksMethods {
  beginMonsterMeleeAttack(monster: InternalMonsterRecord, player: InternalPlayerRecord): void
  monsterAttackTiming(monster: InternalMonsterRecord, mode: 'A1' | 'A2' | 'S1' | 'S2'): { readonly actionFrame: number; readonly totalFrames: number }
  stepPendingResurrection(monster: InternalMonsterRecord): void
  reviveMonsterCorpse(caster: InternalMonsterRecord, corpse: InternalMonsterRecord): void
  stepPendingMonsterAttack(monster: InternalMonsterRecord): void
  rollMonsterElementalRider(monster: InternalMonsterRecord, mode: 'A1' | 'A2' | 'S1'): { readonly element: MissileDamageChannel; readonly damage: number; readonly durationFrames: number } | undefined
  beginMonsterMeleeAttackOnAlly(monster: InternalMonsterRecord, target: { readonly kind: 'merc' | 'pet'; readonly id: number | string }): void
  stepPendingAllyAttack(monster: InternalMonsterRecord): void
  buildMonsterAttackerContext(monster: InternalMonsterRecord, skillMode?: 'A1' | 'A2' | 'S1' | undefined): CombatUnitContext
  computePlayerBaseDefense(player: InternalPlayerRecord): number
  computePlayerDefense(player: InternalPlayerRecord): number
  resolveMonsterAttackOnPlayer(monster: InternalMonsterRecord, player: InternalPlayerRecord, swing?: {
    readonly minDmg: number
    readonly maxDmg: number
    readonly skillMode: 'A1' | 'A2' | 'S1'
    /** Missile hits use the projectile block/dodge path; melee uses the melee path. */
    readonly attackKind?: 'melee' | 'missile' | undefined
    readonly skillId?: number | undefined
    readonly missileId?: number | undefined
    readonly arBonusPct?: number | undefined
    /** Explicit projectile element (Missiles.txt EType) instead of a MonStats El1..3 rider. */
    readonly elementType?: MissileDamageChannel | undefined
    readonly elemMin?: number | undefined
    readonly elemMax?: number | undefined
    readonly elemDurationFrames?: number | undefined
    /** Projectile hits must not re-roll the monster's melee El1..3 rider. */
    readonly fromMissile?: boolean | undefined
    /** Death-effect novae or `ResultFlags & 1` skills bypass `RollToHit` vs Defense. */
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
  }): boolean
}

export const monsterMeleeAttacksMethods: Record<keyof MonsterMeleeAttacksMethods, unknown> = {
  beginMonsterMeleeAttack,
  monsterAttackTiming,
  stepPendingResurrection,
  reviveMonsterCorpse,
  stepPendingMonsterAttack,
  rollMonsterElementalRider,
  beginMonsterMeleeAttackOnAlly,
  stepPendingAllyAttack,
  buildMonsterAttackerContext,
  computePlayerBaseDefense,
  computePlayerDefense,
  resolveMonsterAttackOnPlayer,
}
