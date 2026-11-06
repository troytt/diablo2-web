/**
 * GameInstance Subsystem: Elemental Absorb, Ally Damage, Monster Auras, Kill Quest Hooks & Experience/Level-Up (`src/server/engine/game-instance/monster-death-and-xp.ts`).
 */

import { PANDEMONIUM_FINALE_AREA_ID_113C, UBER_PRIME_EVIL_SET_113C } from '../../world/pandemonium-113c.ts'
import { findStandableNear } from '../../world/area-bootstrap.ts'
import { QUEST_FLAG_COMPLETED_113C, QUEST_FLAG_COMPLETED_NOW_113C, QUEST_FLAG_CUSTOM_5_113C, QUEST_FLAG_PRIMARY_GOAL_DONE_113C, QUEST_FLAG_REWARD_PENDING_113C, QUEST_FLAG_STARTED_113C, hasQuestFlag113c } from '../quests-113c.ts'
import { calculateKillExperienceGain113c, evaluateMercenaryKillExperience113c, isWithinPartyExpRange113c, PARTY_EXP_MAX_MEMBERS_113C, partyExpPool113c, partyExpShare113c, type DeathKillerKind113c } from '../../../common/progression/experience-113c.ts'
import { PALADIN_AURA_STATE_BY_SKILL_ID, PALADIN_AURA_TARGET_STATE_BY_SKILL_ID, calculateConvictionStats, calculateFanaticismStats, calculateHolyFireStats, calculateHolyFreezeStats, calculateHolyShockStats, calculateMightStats } from '../../../common/skills/paladin-auras.ts'
import { resolveInnateMonsterAura113c, resolveMonsterAuraDivisor113c } from '../../../common/units/monai-113c.ts'
import { CANONICAL_CHARSTATS } from '../../../common/units/classes.ts'
import { computeMercResurrectCost113c, resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import { BONE_FETISH_EXPLOSION_RADIUS, DURIEL_MAGGOT_HCIDX, DURIEL_MAGGOT_OFFSETS, MON_UMOD, calcBoneFetishDeathDamage, calcColdEnchantedDeathNova, calcFireEnchantedDeathDamage, calcSuicideMinionExplosionDamage, D2CLIENT_NOVA_RING_X, D2CLIENT_NOVA_RING_Y, getBossDeathFxSpec, isBoneFetishMonster, isDurielMonster, isPoisonDeadMonster, isScarabMonster, isSuicideMinionMonster } from '../../../common/units/monster-death-fx.ts'
import { NOVADEATH_MISSILE_ID_113C, NOVADEATH_RANGE_TICKS_113C, POISONDEAD_CLOUD_MISSILE_ID_113C, computeNovaDeathDamageRange113c, computePoisonDeadCloudDamage113c, shouldKillMinionsOnDeath113c } from '../../ai/monumod-113c.ts'
import { PET_TYPE_IDX_BY_NAME_113C } from '../../../common/units/pet-type-table.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { applyElementalAbsorb113c, getPrePierceResistance113c, resolveConvictionPierce113c, resolveLowerResistPierce113c, resolvePhysCursePierce113c } from '../combat-pipeline.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { isWithinAuraRange } from '../../../common/skills/aura-filter.ts'
import { evaluateCalc } from '../../../common/data/calc-ast.ts'
import { mulDiv113c } from '../../../common/data/mul-div-113c.ts'
import { difficultyResistPenalty } from '../difficulty-resist-penalty.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord } from './types.ts'
import { ANCIENT_BARBARIANS_113C, MAX_PLAYER_LEVEL_113C, QUEST_BOSS_KILL_113C, SEAL_BOSS_113C, areaToAct, experienceForLevel113c, monsterAiBehavior, playerWirePosition, stableUnitKey } from './constants-and-helpers.ts'


/**
 * Player resistance % from equipped item stats + persistent states (monster damage side).
 * Player branch of `D2Game.dll` 0x6FCFB3C0: elemental channels add `DifficultyLevels.txt`
 * `ResistPenalty`, then `res <= 0 ? max(-100, res) : min(res, cap)` with
 * cap = 50 (`damageresist`) or `min(95, 75 + max{elem}resist)`.
 */
function playerResistPct(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  kind: 'phys' | 'fire' | 'cold' | 'light' | 'poison',
): number {
  const resStatId = { phys: 36, fire: 39, cold: 43, light: 41, poison: 45 }[kind]
  const maxStatId = { phys: undefined, fire: 40, cold: 44, light: 42, poison: 46 }[kind]
  // 1.13c (#1864): sum equipped gear + socketed runes/gems + set bonuses + per-level stats +
  // active `10×4` inventory charms (`cm1`/`cm2`/`cm3`), strictly excluding stash/cube charms.
  let value = this.sumPlayerItemStat(player, resStatId)
  let maxBonus = maxStatId !== undefined ? this.sumPlayerItemStat(player, maxStatId) : 0
  const combat = this.playerCombatContext(player)
  const passiveOnly = (stat: string): number => {
    let total = 0
    for (const m of combat.statList.getActiveModifiers()) {
      if (m.id.startsWith('passive_skill_')) total += m.stats[stat] ?? 0
    }
    return total
  }
  if (kind === 'phys') {
    value += Math.trunc(getPrePierceResistance113c(combat.statList, 'damageresist'))
    value -= resolvePhysCursePierce113c(combat)
    return value <= 0 ? Math.max(-100, value) : Math.min(value, 50)
  }
  const elemStatName =
    kind === 'fire'
      ? 'fireresist'
      : kind === 'cold'
        ? 'coldresist'
        : kind === 'light'
          ? 'lightresist'
          : 'poisonresist'
  value += Math.trunc(getPrePierceResistance113c(combat.statList, elemStatName)) + passiveOnly(elemStatName)
  if (elemStatName !== 'poisonresist') {
    value -= resolveConvictionPierce113c(combat, elemStatName)
  }
  value -= resolveLowerResistPierce113c(combat, elemStatName)
  value += difficultyResistPenalty(this.difficulty)
  const maxStatName =
    kind === 'fire'
      ? 'maxfireresist'
      : kind === 'cold'
        ? 'maxcoldresist'
        : kind === 'light'
          ? 'maxlightresist'
          : 'maxpoisonresist'
  maxBonus += Math.trunc(combat.statList.getAccruedStat(maxStatName))
  const cap = Math.min(95, 75 + maxBonus)
  return value <= 0 ? Math.max(-100, value) : Math.min(value, cap)
}



/** Player elemental absorb (% and flat, incl. /lvl & active 10x4 charms) from items + persistent combat stats (#1864). */
function playerElementalAbsorb(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  kind: 'fire' | 'cold' | 'light',
): { readonly pct: number; readonly flat: number } {
  const pctStatId = kind === 'fire' ? 142 : kind === 'light' ? 144 : 148
  const flatStatId = kind === 'fire' ? 143 : kind === 'light' ? 145 : 149
  const pctStatName =
    kind === 'fire'
      ? 'item_absorbfire_percent'
      : kind === 'light'
        ? 'item_absorblight_percent'
        : 'item_absorbcold_percent'
  const flatStatName =
    kind === 'fire'
      ? 'item_absorbfire'
      : kind === 'light'
        ? 'item_absorblight'
        : 'item_absorbcold'
  let pct = this.sumPlayerItemStat(player, pctStatId)
  let flat = this.sumPlayerItemStat(player, flatStatId)
  const combat = this.playerCombatContext(player)
  pct += Math.trunc(combat.statList.getAccruedStat(pctStatName, true))
  flat += Math.trunc(combat.statList.getAccruedStat(flatStatName, true))
  return { pct: Math.max(0, pct), flat: Math.max(0, flat) }
}



/** Apply the 1.13c physical + elemental split with player resistances, elemental absorb, damage reduce, and Poison DoT. */
function applyPlayerElementalDamage(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  parts: {
    readonly phys?: number | undefined
    readonly fire?: number | undefined
    readonly cold?: number | undefined
    readonly light?: number | undefined
    readonly ltng?: number | undefined
    readonly mag?: number | undefined
    readonly pois?: number | undefined
    readonly poisDurationFrames?: number | undefined
  },
  options?: {
    readonly hitClass?: number | string | undefined
    readonly skipGetHit?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  },
): void {
  let total = 0
  let absorbHeal256 = 0
  const damageRate = Math.trunc(options?.damageRate ?? 0)
  if (damageRate > 0) {
    // 1.13c `D2Game.dll` `0x6FCFC13B..0x6FCFC519` (#1795 / #2017): continuous stream / object missiles
    // with `DamageRate > 0` (`#172 diablight` `DamageRate = 82`, etc.) scale flat PDR (`stat 34`) and
    // flat MDR (`stat 35`) by `mulDiv(rate, dr256, 1024)` in `1/256` fixed-point, spilling signed
    // PDR/MDR overflow across physical and non-poison elemental channels before resistances & absorb.
    const flatPdr256 = mulDiv113c(
      damageRate,
      Math.max(0, this.sumPlayerItemStat(player, 34)) * FIXED_ONE,
      1024,
    )
    let remMdr256 = mulDiv113c(
      damageRate,
      Math.max(0, this.sumPlayerItemStat(player, 35)) * FIXED_ONE,
      1024,
    )
    let signedOverflow256 = 0
    let postPhysAndMag256 = 0
    const rawPhys256 = Math.max(0, (parts.phys ?? 0) * FIXED_ONE)
    if (rawPhys256 > 0) {
      const afterPdr256 = rawPhys256 - flatPdr256
      if (afterPdr256 <= 0) {
        signedOverflow256 += -afterPdr256
      } else {
        const physRes = this.playerResistPct(player, 'phys')
        postPhysAndMag256 += Math.max(0, Math.trunc((afterPdr256 * (100 - physRes)) / 100))
      }
    }
    const rawMag256 = Math.max(0, (parts.mag ?? 0) * FIXED_ONE)
    if (rawMag256 > 0) {
      const mdrUsed = remMdr256
      remMdr256 = 0
      const afterMdr256 = rawMag256 - mdrUsed
      if (afterMdr256 <= 0) {
        signedOverflow256 += -afterMdr256
      } else {
        const magRes = Math.max(-100, Math.min(95, this.sumPlayerItemStat(player, 37)))
        postPhysAndMag256 += Math.max(0, Math.trunc((afterMdr256 * (100 - magRes)) / 100))
      }
    }
    const elemChannels = {
      fire: Math.max(0, (parts.fire ?? 0) * FIXED_ONE),
      light: Math.max(0, ((parts.light ?? 0) + (parts.ltng ?? 0)) * FIXED_ONE),
      cold: Math.max(0, (parts.cold ?? 0) * FIXED_ONE),
    }
    let postElem256 = 0
    for (const kind of ['fire', 'light', 'cold'] as const) {
      const raw256 = elemChannels[kind]
      if (raw256 <= 0) continue
      const mdrUsed = remMdr256
      remMdr256 = 0
      const afterMdr256 = raw256 - mdrUsed
      if (afterMdr256 <= 0) {
        signedOverflow256 += -afterMdr256
        continue
      }
      const resPct = this.playerResistPct(player, kind)
      const postRes256 = Math.max(0, Math.trunc((afterMdr256 * (100 - resPct)) / 100))
      if (postRes256 > 0) {
        const abs = this.playerElementalAbsorb(player, kind)
        if (abs.pct > 0 || abs.flat > 0) {
          const absOut = applyElementalAbsorb113c(postRes256, abs.pct, abs.flat * FIXED_ONE)
          postElem256 += absOut.remainingDamage256
          absorbHeal256 += absOut.absorbHeal256
          continue
        }
      }
      postElem256 += postRes256
    }
    const combined256 = Math.max(0, postPhysAndMag256 + postElem256 - signedOverflow256)
    total = Math.floor(combined256 / FIXED_ONE)
  } else {
    const normalizedParts = {
      phys: parts.phys ?? 0,
      fire: parts.fire ?? 0,
      cold: parts.cold ?? 0,
      light: (parts.light ?? 0) + (parts.ltng ?? 0),
    }
    for (const kind of ['phys', 'fire', 'cold', 'light'] as const) {
      const dmg = normalizedParts[kind]
      if (dmg <= 0) continue
      const postRes = Math.max(0, Math.round(dmg * (1 - this.playerResistPct(player, kind) / 100)))
      if (kind !== 'phys' && postRes > 0) {
        const abs = this.playerElementalAbsorb(player, kind)
        if (abs.pct > 0 || abs.flat > 0) {
          const absOut = applyElementalAbsorb113c(postRes * FIXED_ONE, abs.pct, abs.flat * FIXED_ONE)
          total += Math.floor(absOut.remainingDamage256 / FIXED_ONE)
          absorbHeal256 += absOut.absorbHeal256
          continue
        }
      }
      total += postRes
    }
    const rawMag = parts.mag ?? 0
    if (rawMag > 0) {
      const magMdr = Math.max(0, this.sumPlayerItemStat(player, 35))
      const magRes = Math.max(-100, Math.min(95, this.sumPlayerItemStat(player, 37)))
      const afterMdr = Math.max(0, rawMag - magMdr)
      total += Math.max(0, Math.round(afterMdr * (1 - magRes / 100)))
    }
  }
  const rawPois = parts.pois ?? 0
  if (rawPois > 0 && !player.dead) {
    const poisRes = this.playerResistPct(player, 'poison')
    if (poisRes < 100) {
      const plrRaw =
        this.sumPlayerItemStat(player, 110) +
        Math.trunc(
          this.playerCombatContext(player).statList.getAccruedStat('item_poisonlengthresist', true),
        )
      const plrClamped = Math.max(-100, Math.min(75, plrRaw))
      const baseDur = Math.max(25, parts.poisDurationFrames ?? 75)
      const durFrames = Math.max(1, Math.trunc((baseDur * (100 - plrClamped)) / 100))
      const rawBitrate256 = Math.floor((rawPois * FIXED_ONE) / baseDur)
      const poisonBitrate256 = Math.max(
        1,
        Math.trunc((rawBitrate256 * (100 - poisRes)) / 100),
      )
      const playerCtx = this.playerCombatContext(player)
      const prevPois = playerCtx.stateBus.getState(2) ?? playerCtx.stateBus.getState('poison')
      const prevBitrate256 = prevPois
        ? Math.max(0, prevPois.stats['poisonmindam'] ?? -(prevPois.stats['hpregen'] ?? 0))
        : 0
      if (!player.states.has(2) || prevPois === undefined || poisonBitrate256 >= prevBitrate256) {
        playerCtx.stateBus.removeState('poison')
        playerCtx.stateBus.applyState({
          stateNameOrId: 2,
          sourceUnitId: `trap_${options?.killerUnitId ?? 0}`,
          sourceSkillId: 0,
          slvl: 1,
          durationFrames: durFrames,
          currentFrame: this.currentFrame,
          stats: {
            hpregen: -poisonBitrate256,
            poisonmindam: poisonBitrate256,
            poisonlength: durFrames,
          },
        })
        this.applyUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          2,
          durFrames,
        )
      }
    }
  }
  if (absorbHeal256 > 0 && !player.dead && player.hpFixed > 0 && !player.states.has(92)) {
    const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
    const nextHpFixed = Math.min(accruedMaxHpFixed, player.hpFixed + absorbHeal256)
    if (nextHpFixed !== player.hpFixed) {
      player.hpFixed = nextHpFixed
      player.hp = Math.max(0, Math.ceil(player.hpFixed / FIXED_ONE))
      if (total <= 0) {
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
  if (total > 0) this.applyDamageToPlayer(player, total, options)
}



/** Broadcast a mercenary/pet HP change and its death removal (UNIT_MONSTER view). */
function broadcastAllyHp(this: GameInstanceHost, areaId: number, unitId: number, hp: number): void {
  const merc = this.mercenaries.get(unitId)
  let ownerId = merc?.ownerPlayerId
  let maxHp = merc?.maxHp ?? 0
  if (!merc) {
    for (const [candidateOwnerId, mgr] of this.summonManagers) {
      for (const pet of mgr.getActivePets()) {
        if (this.petUnitIds.get(pet.uid) === unitId) {
          ownerId = candidateOwnerId
          maxHp = pet.maxHp
          break
        }
      }
      if (ownerId !== undefined) break
    }
  }
  if (maxHp > 0) {
    this.broadcastToArea(areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId,
      statId: 7,
      value: Math.max(1, Math.floor(maxHp)),
    })
  }
  this.broadcastToArea(areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId,
    statId: 6,
    value: Math.max(0, Math.floor(hp)),
  })
  if (ownerId !== undefined && maxHp > 0) {
    const lifePct100 =
      hp <= 0 ? 0 : Math.min(100, Math.max(1, Math.round((hp * 100) / maxHp)))
    this.emitToPlayer(ownerId, {
      type: 'Party',
      kind: 'memberState',
      isPlayer: false,
      relation: 0,
      unitId,
      lifePct: lifePct100,
      areaId,
    })
  }
}



function resolvePetUnitId(this: GameInstanceHost, pet: SummonedPetUnit): number {
  const existing =
    this.petUnitIds.get(pet.uid) ??
    (pet as unknown as { unitId?: number }).unitId
  if (existing !== undefined) return existing
  const allocated = stableUnitKey(pet.uid)
  this.petUnitIds.set(pet.uid, allocated)
  ;(pet as unknown as { unitId?: number }).unitId = allocated
  return allocated
}



function handlePetDeath(this: GameInstanceHost, 
  pet: SummonedPetUnit,
  areaId: number,
  petUnitId: number,
  ownerIdOverride?: number,
): void {
  pet.hp = 0
  pet.alive = false
  this.petAuraScanners.delete(pet.uid)
  this.petVisualStates.delete(petUnitId)
  for (const [ownerPlayerId, mgr] of this.summonManagers) {
    if (ownerIdOverride !== undefined && ownerPlayerId !== ownerIdOverride) continue
    if (ownerIdOverride === undefined && !mgr.getActivePets().some((p) => p === pet)) continue
    const removed =
      typeof (mgr as { removeSummon?: (id: string | number) => unknown }).removeSummon === 'function'
        ? (mgr as { removeSummon: (id: string | number) => unknown }).removeSummon(pet.uid)
        : typeof (mgr as { removePetByUid?: (uid: string) => unknown }).removePetByUid === 'function'
          ? (mgr as { removePetByUid: (uid: string) => unknown }).removePetByUid(pet.uid)
          : undefined
    if (removed || ownerIdOverride !== undefined) {
      this.petUnitIds.delete(pet.uid)
      if (pet.sourceSkillId === 90) {
        const ownerRec = this.players.get(ownerPlayerId)
        if (ownerRec) ownerRec.ironGolemItem = null
      }
      const petTypeIdx = PET_TYPE_IDX_BY_NAME_113C[pet.petType] ?? 1
      this.emitToPlayer(ownerPlayerId, {
        type: 'Merc',
        kind: 'assign',
        isSummonAction: true,
        summonAction: 0,
        petType: petTypeIdx,
        mercId: petUnitId,
        ownerId: ownerPlayerId,
        classId: pet.sourceSkillId,
      })
      break
    }
  }
  this.broadcastAllyRemoved(areaId, petUnitId)
}



function broadcastAllyRemoved(this: GameInstanceHost, areaId: number, unitId: number): void {
  this.broadcastToArea(areaId, {
    type: 'UnitRemove',
    unitType: 'monster',
    id: unitId,
    unitId,
    areaId,
  })
}



function applyDamageToMerc(this: GameInstanceHost, 
  mercUnitIdOrRecord: number | InternalMercenaryRecord,
  damage: number,
  areaIdOverride?: number,
  options?: { readonly skipGetHit?: boolean | undefined },
): void {
  const merc =
    typeof mercUnitIdOrRecord === 'number'
      ? this.mercenaries.get(mercUnitIdOrRecord)
      : mercUnitIdOrRecord
  if (!merc || !merc.alive) return
  const dmg = Math.max(0, Math.floor(damage))
  merc.hp = Math.max(0, merc.hp - dmg)
  const areaId = areaIdOverride ?? merc.areaId
  this.broadcastAllyHp(areaId, merc.unitId, merc.hp)
  if (merc.hp <= 0) {
    merc.hp = 0
    merc.hp256 = 0
    merc.mode = 12
    merc.alive = false
    merc.state = 'dead'
    if (merc.oracleMercAi113c !== undefined) {
      merc.oracleMercAi113c.activeVelBonus = 0
      merc.oracleMercAi113c.ovPathType = 0
      merc.oracleMercAi113c.ovVelocity = 0
      merc.oracleMercAi113c.ovNewDist = 0
      merc.oracleMercAi113c.actionFrame = 0
      merc.oracleMercAi113c.animEndFrame = 0
      merc.oracleMercAi113c.pendingAction = undefined
    }
    this.areaPathWorld.removeMonster(merc.unitId)
    this.stopMercenaryAura(merc)
    // D2Game.dll 0x6fcb8120 -> 0x6fcb8200..0x6fcb8235: emit S2C 0x9B MercReviveCost(nameId, cost)
    // and broadcast 13B S2C 0x7A SummonAction(action=0, petUnitId=merc.unitId) on hireling death.
    this.emitToPlayer(merc.ownerPlayerId, {
      type: 'Merc',
      kind: 'stat',
      nameId: merc.subType,
      value: computeMercResurrectCost113c(merc.level),
    })
    this.broadcastToArea(areaId, {
      type: 'Merc',
      kind: 'assign',
      isSummonAction: true,
      summonAction: 0,
      petType: 0,
      mercId: merc.unitId,
      ownerId: 0,
      classId: 0,
    })
    this.broadcastAllyRemoved(areaId, merc.unitId)
  } else if (dmg > 0 && !options?.skipGetHit) {
    const owner = this.players.get(merc.ownerPlayerId)
    if (owner !== undefined && !owner.dead) {
      this.triggerMercCtcProcs113c(owner, merc, undefined, 201)
    }
  }
}



function applyDamageToSummon(this: GameInstanceHost, 
  ownerIdOrPet: number | SummonedPetUnit,
  petOrDamage: SummonedPetUnit | string | number,
  damageOverride?: number,
  areaIdOverride?: number,
): void {
  let ownerId: number | undefined
  let pet: SummonedPetUnit | undefined
  let damage = 0
  let areaId = areaIdOverride
  if (typeof ownerIdOrPet === 'number') {
    ownerId = ownerIdOrPet
    pet =
      typeof petOrDamage === 'object' && petOrDamage !== null
        ? petOrDamage
        : this.getPetState(petOrDamage)
    damage = damageOverride ?? 0
  } else {
    pet = ownerIdOrPet
    damage = typeof petOrDamage === 'number' ? petOrDamage : (damageOverride ?? 0)
    if (areaId === undefined && typeof damageOverride === 'number') {
      areaId = damageOverride
    }
    for (const [candidateOwnerId, mgr] of this.summonManagers) {
      if (mgr.getActivePets().some((p) => p === pet || p.uid === pet!.uid)) {
        ownerId = candidateOwnerId
        break
      }
    }
  }
  if (!pet || pet.alive === false) return
  const dmg = Math.max(0, Math.floor(damage))
  pet.hp = Math.max(0, pet.hp - dmg)
  pet.statList?.setHp256(pet.hp * FIXED_ONE)
  const owner = ownerId !== undefined ? this.players.get(ownerId) : undefined
  const resolvedAreaId =
    areaId ??
    (pet as unknown as { areaId?: number }).areaId ??
    owner?.areaId ??
    this.defaultAreaId ??
    1
  const petUnitId = this.resolvePetUnitId(pet)
  this.broadcastAllyHp(resolvedAreaId, petUnitId, pet.hp)
  if (pet.hp <= 0) {
    this.handlePetDeath(pet, resolvedAreaId, petUnitId, ownerId)
  }
}



/** Death explosions also hit the mercenary / summons the issue called out. */
function damageMercsAndPetsInRadius(this: GameInstanceHost, 
  areaId: number,
  x: number,
  y: number,
  radius: number,
  damage: number,
  element: 'phys' | 'fire' | 'cold' | 'light' = 'phys',
): void {
  const resistStat =
    element === 'fire'
      ? 'fireresist'
      : element === 'cold'
        ? 'coldresist'
        : element === 'light'
          ? 'lightresist'
          : 'damageresist'
  for (const merc of this.mercenaries.values()) {
    if (!merc.alive || merc.areaId !== areaId) continue
    const mercOwner = this.players.get(merc.ownerPlayerId)
    if (mercOwner !== undefined && (mercOwner.dead || mercOwner.areaId !== areaId)) continue
    if (Math.hypot(merc.x - x, merc.y - y) > radius) continue
    const applied = Math.max(
      1,
      Math.floor(damage * (1 - Math.max(-100, Math.min(100, merc.resist)) / 100)),
    )
    this.applyDamageToMerc(merc, applied, areaId)
  }
  for (const [ownerId, mgr] of this.summonManagers) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead || owner.areaId !== areaId) continue
    for (const pet of [...mgr.getActivePets()]) {
      if (pet.alive === false || pet.hp <= 0) continue
      if (Math.hypot(pet.x - x, pet.y - y) > radius) continue
      const petResist = Math.max(
        -100,
        Math.min(100, pet.statList.getAccruedStat(resistStat)),
      )
      const applied = Math.max(1, Math.floor(damage * (1 - petResist / 100)))
      this.applyDamageToSummon(ownerId, pet, applied, areaId)
    }
  }
}



/** `Skills.txt` `aurarangecalc` of an aura row evaluated at `slvl` (sub-tiles, 0x6FCC0C70 radius). */
function auraRangeSubtiles(this: GameInstanceHost, skillId: number, slvl: number): number {
  const skill = this.registry.getSkillById(skillId)
  if (!skill || !skill.auraRangeCalc) return 0
  return evaluateCalc(skill.auraRangeCalc, {
    registry: this.registry,
    activeSkill: skill,
    slvl,
    blvl: slvl,
    getBaseSkillLevel: () => slvl,
    getEffectiveSkillLevel: () => slvl,
  })
}



function resolveEffectiveMonsterAuraLevel(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  if (monster.auraLevel !== undefined && monster.auraLevel > 0) {
    return monster.auraLevel
  }
  const innate = resolveInnateMonsterAura113c(monster.hcIdx, this.difficulty, monster.skills)
  if (innate !== undefined && innate.auraSkillId === monster.auraSkillId) {
    return innate.auraLevel
  }
  const divisor = resolveMonsterAuraDivisor113c(monster.auraSkillId ?? 98)
  return Math.max(1, Math.floor(Math.max(1, monster.level) / divisor))
}



/** Might / Fanaticism aura damage bonus for a monster (party bonus for allies). */
function monsterAuraDamageBonusPct(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  let bonusPct = 0
  for (const auraMonster of this.monsters.values()) {
    if (
      auraMonster.dead ||
      auraMonster.isNpc ||
      auraMonster.areaId !== monster.areaId ||
      auraMonster.auraSkillId === undefined
    ) {
      continue
    }
    const auraSlvl = this.resolveEffectiveMonsterAuraLevel(auraMonster)
    const dx = auraMonster.x - monster.x
    const dy = auraMonster.y - monster.y
    if (auraMonster.auraSkillId === 98) {
      const might = calculateMightStats(auraSlvl)
      if (isWithinAuraRange(dx, dy, might.radiusSubtiles)) bonusPct = Math.max(bonusPct, might.damagePercent)
    } else if (auraMonster.auraSkillId === 122) {
      const fan = calculateFanaticismStats(auraSlvl)
      if (isWithinAuraRange(dx, dy, fan.radiusSubtiles)) {
        bonusPct = Math.max(
          bonusPct,
          auraMonster === monster ? fan.casterDamagePercent : fan.partyDamagePercent,
        )
      }
    }
  }
  return bonusPct
}



/** Innate Boss Aura (#1820) & Aura Enchanted (`MonUMod` 30, #1819): apply the 1.13c aura to nearby units each tick. */
function applyMonsterAura(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const auraId = monster.auraSkillId
  if (auraId === undefined || monster.dead) return
  const leaderStateId = PALADIN_AURA_STATE_BY_SKILL_ID[auraId]
  if (leaderStateId !== undefined && !monster.states.has(leaderStateId)) {
    this.applyPersistentUnitState(
      monster.states,
      monster.stateTimers,
      'monster',
      monster.unitId,
      monster.areaId,
      leaderStateId,
    )
  }
  const auraSlvl = this.resolveEffectiveMonsterAuraLevel(monster)
  // 0x6FCC0C70: radius = the aura row's evaluated `aurarangecalc` at effective `auraSlvl`
  // (Holy Freeze `ln12` = 6 + (auraSlvl-1), Conviction `ln12` = 20 + 0), hit when sub-tile `dx² + dy² <= r²`.
  const radius = this.auraRangeSubtiles(auraId, auraSlvl)
  const outOfRange = (x: number, y: number): boolean => !isWithinAuraRange(x - monster.x, y - monster.y, radius)

  if (auraId === 98 || auraId === 108 || auraId === 122) {
    // Might (#98, mlvl/6), Blessed Aim (#108, mlvl/5), Fanaticism (#122, mlvl/8):
    // 1.13c `MonUMod 30` (`0x6FD2E4A0`) friendly monster aura pulses onto nearby fellow monsters.
    if (this.currentFrame % 25 !== 0) return
    const auraSkill = this.registry.getSkillById(auraId)
    const tgtState = PALADIN_AURA_TARGET_STATE_BY_SKILL_ID[auraId]
    if (auraSkill === undefined || tgtState === undefined) return
    for (const m of this.monsters.values()) {
      if (m === monster || m.dead || m.isNpc || !m.isKillable || m.align !== monster.align || this.isMonsterConverted(m)) continue
      if (m.areaId !== monster.areaId || outOfRange(m.x, m.y)) continue
      const mCtx = this.monsterCombatContext(m)
      mCtx.stateBus.applyState({
        stateNameOrId: tgtState,
        sourceUnitId: `monster_${monster.unitId}`,
        sourceSkillId: auraId,
        slvl: auraSlvl,
        durationFrames: 75,
        currentFrame: this.currentFrame,
        stats: this.evaluateSkillStateStats(auraSkill, auraSlvl, mCtx.statList),
        isAuraOverride: true,
      })
      this.applyUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, tgtState, 75)
    }
    return
  }

  if (auraId === 114) {
    // Holy Freeze: chill nearby players & mercenaries (`aurafilter = 0x4A283` enemy-only)
    // at `auraSlvl` (`mlvl/7` for Aura Enchanted, `4/7/10` for Duriel, `14` for Uber Duriel)
    // and pulse cold damage every 50 frames (`Skills.txt` `perdelay = 50`).
    if (this.currentFrame % 25 !== 0) return
    const hfSkill = this.registry.getSkillById(114)
    const shouldPulseDmg = this.currentFrame % 50 === 0
    const hfPulse = shouldPulseDmg ? calculateHolyFreezeStats(auraSlvl) : undefined
    const pulseDmg =
      hfPulse !== undefined
        ? hfPulse.pulseMin +
          this.rng.rand(Math.max(1, hfPulse.pulseMax - hfPulse.pulseMin + 1))
        : 0
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (outOfRange(p.x, p.y)) continue
      const pCtx = this.playerCombatContext(p)
      if (hfSkill !== undefined) {
        pCtx.stateBus.applyState({
          stateNameOrId: 44,
          sourceUnitId: `monster_${monster.unitId}`,
          sourceSkillId: 114,
          slvl: auraSlvl,
          durationFrames: 75,
          currentFrame: this.currentFrame,
          stats: this.evaluateSkillStateStats(hfSkill, auraSlvl, pCtx.statList),
          isAuraOverride: true,
        })
      }
      this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 11, 75)
      this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 44, 75)
      if (pulseDmg > 0) {
        this.applyPlayerElementalDamage(
          p,
          { cold: pulseDmg },
          { killerType: 'monster', killerUnitId: monster.unitId },
        )
      }
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || merc.hp <= 0 || merc.areaId !== monster.areaId) continue
      if (outOfRange(merc.x, merc.y)) continue
      const mCtx = this.mercCombatContext(merc)
      if (hfSkill !== undefined) {
        mCtx.stateBus.applyState({
          stateNameOrId: 44,
          sourceUnitId: `monster_${monster.unitId}`,
          sourceSkillId: 114,
          slvl: auraSlvl,
          durationFrames: 75,
          currentFrame: this.currentFrame,
          stats: this.evaluateSkillStateStats(hfSkill, auraSlvl, mCtx.statList),
          isAuraOverride: true,
        })
      }
      this.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, 11, 75)
      this.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, 44, 75)
    }
    if (pulseDmg > 0) {
      this.damageMercsAndPetsInRadius(
        monster.areaId,
        monster.x,
        monster.y,
        radius,
        pulseDmg,
        'cold',
      )
    }
    return
  }
  if (auraId === 123) {
    // Conviction: state 28 on nearby players & mercenaries at `auraSlvl` (`floor(mlvl/8)` for
    // Aura Enchanted, or `slvl = 20` -> `-125%` resist / `-90%` def for Uber Mephisto #704).
    if (this.currentFrame % 25 !== 0) return
    const convSlvl = auraSlvl
    const conv = calculateConvictionStats(convSlvl)
    const convStats = {
      fireresist: -conv.resistanceReductionPct,
      lightresist: -conv.resistanceReductionPct,
      coldresist: -conv.resistanceReductionPct,
      skill_armor_percent: -conv.defenseReductionPct,
    }
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (outOfRange(p.x, p.y)) continue
      this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 28, 75)
      this.playerCombatContext(p).stateBus.applyState({
        stateNameOrId: 'conviction',
        sourceUnitId: `monster_${monster.unitId}`,
        sourceSkillId: 123,
        slvl: convSlvl,
        durationFrames: 75,
        currentFrame: this.currentFrame,
        stats: convStats,
        isAuraOverride: true,
      })
    }
    for (const merc of this.mercenaries.values()) {
      if (!merc.alive || merc.hp <= 0 || merc.areaId !== monster.areaId) continue
      if (outOfRange(merc.x, merc.y)) continue
      this.applyUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, 28, 75)
      this.mercCombatContext(merc).stateBus.applyState({
        stateNameOrId: 'conviction',
        sourceUnitId: `monster_${monster.unitId}`,
        sourceSkillId: 123,
        slvl: convSlvl,
        durationFrames: 75,
        currentFrame: this.currentFrame,
        stats: convStats,
        isAuraOverride: true,
      })
    }
    // `aurafilter = 0xA583` carries `0x8000` (enemy only): fellow monsters are not convicted.
    return
  }
  if (auraId === 102 || auraId === 118) {
    // Holy Fire (`mlvl/6`) / Holy Shock (`mlvl/8`) elemental pulse every 50 ticks (1.13c perdelay).
    if (this.currentFrame % 50 !== 0) return
    const pulse =
      auraId === 102
        ? calculateHolyFireStats(auraSlvl)
        : calculateHolyShockStats(auraSlvl)
    const dmg =
      pulse.pulseMin +
      this.rng.rand(Math.max(1, pulse.pulseMax - pulse.pulseMin + 1))
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (outOfRange(p.x, p.y)) continue
      this.applyPlayerElementalDamage(
        p,
        auraId === 102 ? { fire: dmg } : { light: dmg },
        { killerType: 'monster', killerUnitId: monster.unitId },
      )
    }
    if (dmg > 0) {
      this.damageMercsAndPetsInRadius(
        monster.areaId,
        monster.x,
        monster.y,
        radius,
        dmg,
        auraId === 102 ? 'fire' : 'light',
      )
    }
  }
}



function onMonsterKilled(this: GameInstanceHost, 
  killer: InternalPlayerRecord | undefined,
  monster: InternalMonsterRecord,
  killSource: 'player' | 'merc' | 'pet' | 'other' = monster.lastHitByMerc ? 'merc' : 'player',
): void {
  const isSuicide = isSuicideMinionMonster(monster.hcIdx, monster.defId)
  const baseXp = Math.trunc(monster.experience)
  if (!isSuicide && !monster.alreadyGrantedKillRewards && killer) {
    // 1.13c LAEK (`stat 86`), Life After Demon Kill (`stat 139`), and MAEK (`stat 138`)
    // (`D2Game.dll` `0x6FCFBA40`, #1938):
    // Evaluated strictly on `pAttacker` (the unit that landed the killing blow) — NEVER resolved
    // up to `pOwner`! Mercenary, summon pet, and Assassin sentry trap kills NEVER grant the
    // owning player LAEK/MAEK.
    if (killSource === 'player' && !killer.dead) {
      const laek =
        Math.max(0, this.sumPlayerItemStat(killer, 86)) +
        (monster.isDemon ? Math.max(0, this.sumPlayerItemStat(killer, 139)) : 0)
      const maek = Math.max(0, this.sumPlayerItemStat(killer, 138))
      if (laek > 0 || maek > 0) {
        if (laek > 0 && killer.hpFixed > 0) {
          const maxHpFixed = this.getPlayerAccruedMaxHpFixed(killer)
          killer.hpFixed = Math.min(maxHpFixed, killer.hpFixed + laek * FIXED_ONE)
          killer.hp = Math.min(killer.maxHp, Math.ceil(killer.hpFixed / FIXED_ONE))
          this.emitToPlayer(killer.unitId, {
            type: 'UnitStatUpdate',
            unitType: 'player',
            unitId: killer.unitId,
            statId: 6,
            value: killer.hpFixed,
          })
        }
        if (maek > 0) {
          const maxManaFixed = this.getPlayerAccruedMaxManaFixed(killer)
          killer.manaFixed = Math.min(maxManaFixed, killer.manaFixed + maek * FIXED_ONE)
          killer.mana = Math.min(killer.maxMana, Math.floor(killer.manaFixed / FIXED_ONE))
          this.emitToPlayer(killer.unitId, {
            type: 'UnitStatUpdate',
            unitType: 'player',
            unitId: killer.unitId,
            statId: 8,
            value: killer.manaFixed,
          })
        }
        this.emitPlayerVitals(killer)
      }
    } else if (killSource === 'merc') {
      for (const merc of this.mercenaries.values()) {
        if (merc.ownerPlayerId !== killer.unitId || !merc.alive || merc.areaId !== monster.areaId) {
          continue
        }
        const mercLaek =
          Math.max(0, this.sumMercItemStat(merc, 86)) +
          (monster.isDemon ? Math.max(0, this.sumMercItemStat(merc, 139)) : 0)
        if (mercLaek > 0 && merc.hp > 0 && merc.hp < merc.maxHp) {
          merc.hp = Math.min(merc.maxHp, merc.hp + mercLaek)
          this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
        }
      }
    }
  }
  if (!isSuicide && !monster.alreadyGrantedKillRewards && killer && baseXp > 0) {

    // 1.13c hireling XP (`D2Game.dll` `0x6FCFEA00` -> `0x6FCFC030` -> `0x6FCFB6B0` -> `0x6FCFDCB0`):
    // runs BEFORE the party player experience loop (`0x6FCFEA61..0x6FCFEB39` before `0x6FCFEB3E..0x6FCFEB92`),
    // so `merc.level < killer.level` uses the owner's pre-kill level.
    // - `0x6FCFC030`: level-diff (`0x6FCFAA40`), `ExpRatio` (`0x6FCFA9E0`), signed `stat 85`,
    //   clamped via `0x6FCFB6B0` (`(Threshold(lvl + 1) - Threshold(lvl)) >> 6`).
    // - `0x6FCFEB1B..0x6FCFEB2C`: `100%` on merc killing blow (`lastHitByMerc`), or `floor(exp * 86 / 256)` on owner/pet kills.
    // - `0x6FCFDCB0`: guards `merc.level < killer.level && merc.level < 98`, credits `2 * expGain` to `STAT_EXPERIENCE (13)`,
    //   levels up against `Hireling.txt` `Exp/Lvl` thresholds, and calls `MERCS_SetStats` (`0x6FC68BA0`).
    for (const merc of this.mercenaries.values()) {
      if (merc.ownerPlayerId !== killer.unitId || !merc.alive || merc.areaId !== monster.areaId) {
        continue
      }
      const mercAddExpPct = Math.trunc(this.sumMercItemStat(merc, 85))
      const mercOut = evaluateMercenaryKillExperience113c({
        rawExp: baseXp,
        mercLevel: merc.level,
        ownerLevel: killer.level,
        currentExp: merc.experience,
        expPerLvl: merc.expPerLvl,
        mlvl: monster.level,
        addExpPct: mercAddExpPct,
        lastHitByMerc: monster.lastHitByMerc,
      })
      if (mercOut.expAdded > 0) {
        merc.experience = mercOut.newExp
        this.broadcastToArea(merc.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: merc.unitId,
          statId: 13,
          value: merc.experience,
        })
        if (mercOut.leveledUp) {
          merc.level = mercOut.newLevel
          const nextStats = resolveHirelingStatsAtLevel(
            merc.subType,
            merc.act,
            merc.difficulty,
            merc.level,
            true,
          )
          if (nextStats) {
            merc.expPerLvl = nextStats.record.expPerLvl || merc.expPerLvl
            merc.maxHp = Math.max(merc.maxHp, nextStats.hp)
            merc.hp = merc.maxHp
            merc.damage = Math.max(
              merc.damage,
              Math.floor((nextStats.minDmg + nextStats.maxDmg) / 2),
            )
            merc.ar = Math.max(merc.ar ?? 0, nextStats.ar)
            merc.defense = Math.max(merc.defense, nextStats.defense)
            merc.resist = Math.max(merc.resist, nextStats.resist)
            const auraSkill = nextStats.skills.find(
              (s) => s.mode === 1 && s.effectiveLevel > 0,
            )
            if (auraSkill?.skillName) {
              merc.activeAura = auraSkill.skillName
              this.syncMercenaryOwnerAura(killer, merc.activeAura, merc, false)
            }
          }
          this.broadcastToArea(merc.areaId, {
            type: 'UnitStatUpdate',
            unitType: 'monster',
            unitId: merc.unitId,
            statId: 12,
            value: merc.level,
          })
          this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
        }
      }
    }

    const recipients: InternalPlayerRecord[] = []
    for (const p of this.players.values()) {
      if (recipients.length >= PARTY_EXP_MAX_MEMBERS_113C) break
      if (p.dead || p.areaId !== monster.areaId) continue
      // 1.13c SUNITDMG_PartyExpCallback (D2Game.dll 0x6FCFAED0 at 0x6FCFAFCA):
      // only same-party players within dx^2 + dy^2 <= 0x1900 (6400, 80 sub-tiles, max 8) share the kill.
      if (!isWithinPartyExpRange113c(p.x, p.y, monster.x, monster.y)) continue
      if (
        p.unitId === killer.unitId ||
        (killer.partyId !== 0xffff && p.partyId === killer.partyId)
      ) {
        recipients.push(p)
      }
    }
    if (recipients.length === 0) recipients.push(killer)

    const totalXp = partyExpPool113c(baseXp, recipients.length)
    const sumLevels = recipients.reduce((sum, p) => sum + Math.max(1, p.level), 0)
    for (const p of recipients) {
      const shareXp = partyExpShare113c(totalXp, p.level, sumLevels)
      if (shareXp > 0) this.grantExperience(p, shareXp, monster.level)
    }

    this.rollMonsterDeathDrop(killer, monster)
    monster.alreadyGrantedKillRewards = true
  } else if (!isSuicide) {
    monster.alreadyGrantedKillRewards = true
  }

  // 1.13c Pandemonium Finale (`D2Game.dll` `0x6FD0AA30..0x6FD0AB09`, #1841):
  // Track killed Uber Prime Evils (`#704`, `#705`, `#709`) in Area `136`; only the 3rd (last)
  // killed drops `1` Unique `cm2` `Hellfire Torch` + `max(1, players.size)` `Standard of Heroes` (`std`)
  // and despawns all remaining summoned Uber Tristram minions.
  if (
    monster.areaId === PANDEMONIUM_FINALE_AREA_ID_113C &&
    UBER_PRIME_EVIL_SET_113C.has(monster.hcIdx)
  ) {
    this.handleUberTristramBossKilled113c(monster)
  }

  // 1.13c side/quest bosses complete their quest on death and drop their quest items:
  // - Radament (0x6FCE7660): Book of Skill ('ass')
  // - Hephasto (0x6FCDA810): Hellforge Hammer ('hfh')
  // - Mephisto (0x6FD09C0D): Mephisto's Soulstone ('mss') on first kill
  if (killer) {
    // A3Q1 Jade Figurine (j34) drop (`D2Game.dll` @ `0x6fc44b32 -> 0x6fc56140 -> 0x6fd08200 -> 0x6fd08010`):
    // First unique/superunique/boss monster killed in Act 3 (`areaToAct === 2`, excluding `hcIdx === 407`
    // Fetish Gidbinn boss and town NPCs/pets) drops j34 once per game when the killer has not completed a3q1.
    const isUniqueOrBossForA3Q1 =
      monster.rank === 'unique' ||
      monster.rank === 'boss' ||
      monster.superUniqueId !== undefined ||
      monster.isBoss
    if (
      !this.a3q1JadeFigurineDropped &&
      areaToAct(monster.areaId) === 2 &&
      isUniqueOrBossForA3Q1 &&
      !monster.isNpc &&
      monster.isKillable &&
      !monster.petIgnore &&
      monster.classId !== 407 &&
      monster.hcIdx !== 407 &&
      !hasQuestFlag113c(
        killer.questFlags,
        'a3q1',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !this.playerOrGroundHasQuestItem(killer, 'j34') &&
      !this.playerOrGroundHasQuestItem(killer, 'g34') &&
      !this.playerOrGroundHasQuestItem(killer, 'xyz')
    ) {
      const figurine = this.createQuestDropItem('j34', monster.level)
      if (figurine) {
        this.spawnDroppedItems([figurine], monster.areaId, monster.x, monster.y)
        this.a3q1JadeFigurineDropped = true
      }
    }

    const defId = monster.defId.toLowerCase()
    const suId = (monster.superUniqueId ?? '').toLowerCase()
    const isHephasto =
      defId.startsWith('hephasto') ||
      suId.includes('hephasto')
    if (
      isHephasto &&
      !hasQuestFlag113c(
        killer.questFlags,
        'a4q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !this.playerOrGroundHasQuestItem(killer, 'hfh')
    ) {
      const hammer = this.createQuestDropItem('hfh', monster.level)
      if (hammer) this.spawnDroppedItems([hammer], monster.areaId, monster.x, monster.y)
    }
    if (
      defId.startsWith('mephisto') &&
      !hasQuestFlag113c(
        killer.questFlags,
        'a4q2',
        QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C,
      ) &&
      !this.playerOrGroundHasQuestItem(killer, 'mss')
    ) {
      const soulstone = this.createQuestDropItem('mss', monster.level)
      if (soulstone) this.spawnDroppedItems([soulstone], monster.areaId, monster.x, monster.y)
    }
    const quest =
      defId === 'izualghost' || monster.hcIdx === 406
        ? undefined
        : QUEST_BOSS_KILL_113C.find(
            ([prefix]) => defId.startsWith(prefix) || (suId !== '' && suId.startsWith(prefix)),
          )
    if (quest !== undefined) {
      if (
        quest[1] === 'a2q1' &&
        !this.playerOrGroundHasQuestItem(killer, 'ass')
      ) {
        const book = this.createQuestDropItem('ass', monster.level)
        if (book) this.spawnDroppedItems([book], monster.areaId, monster.x, monster.y)
      }
      // 1.13c D2Game.dll ACT4Q1 (`0x6fcdabf0..0x6fcdad32`, word 25, #2011),
      // ACT5Q1 (`0x6fc7869f` / `0x6fc78774`, word 35) & ACT5Q4 (`0x6fc778de` / `0x6fc77a00`, word 38):
      // Izual, Shenk, and Nihlathak kills set ONLY `QFLAG_REWARDPENDING | QFLAG_COMPLETEDNOW` (`0x2002`), leaving
      // `QFLAG_REWARDGRANTED` (`0x0001`) clear until Tyrael (`#367`, `0x6fcda768`), Larzuk (`0x6fc785cf`),
      // or Anya (`0x6fc77803`) completes the turn-in (#1987, #2011).
      const mask =
        quest[1] === 'a4q1' || quest[1] === 'a5q1' || quest[1] === 'a5q4'
          ? QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C
          : quest[1] === 'a2q1'
            ? QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C | QUEST_FLAG_CUSTOM_5_113C
            : QUEST_FLAG_COMPLETED_113C
      const alreadyCreditedMask =
        quest[1] === 'a4q1' || quest[1] === 'a5q1' || quest[1] === 'a5q4'
          ? QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_REWARD_PENDING_113C
          : QUEST_FLAG_COMPLETED_113C
      let completedFirstTime = false
      for (const recipient of this.getQuestEligiblePartyRecipients113c(
        killer,
        monster.areaId,
        { includeSameActTown: false },
      )) {
        if (hasQuestFlag113c(recipient.questFlags, quest[1], alreadyCreditedMask)) continue
        completedFirstTime = true
        this.setPlayerQuestFlag(recipient, quest[1], mask)
        if (quest[1] === 'a5q4') {
          this.syncHarrogathA5Q3State113c(recipient)
        }
      }
      if (quest[1] === 'a4q1') {
        // D2Game.dll `ACT4Q1_SpawnIzualGhost` (`0x6fcda960..0x6fcdaa2b`, #2011):
        // spawn Izual's Spirit (`MonStats.txt` `hcIdx 406` `izualghost`, `inTown=1`, `Align=2`, `killable=0`)
        // at `(monster.x, monster.y)` when Izual (`hcIdx 256`) dies.
        const hasIzualGhost = [...this.monsters.values()].some(
          (m) => m.areaId === monster.areaId && m.hcIdx === 406 && !m.dead,
        )
        if (!hasIzualGhost) {
          this.spawnMonster({
            classId: 406,
            defId: 'izualghost',
            name: 'Izual',
            x: Math.round(monster.x),
            y: Math.round(monster.y),
            areaId: monster.areaId,
            isNpc: true,
            experience: 0,
          })
        }
      }
      if (quest[1] === 'a1q4' && completedFirstTime) {
        // D2Game.dll 0x6fc88cc6 -> 0x6fc85e90: spawn `towerchestspawner` (`Missiles.txt #332`, `Range = 400`)
        // for closed Countess quest chest(s) (`Objects.txt 371`) in the Tower Cellar Level 5 room (#1988).
        for (const obj of this.objects.values()) {
          if (obj.areaId !== monster.areaId || obj.classId !== 371 || obj.mode !== 0) continue
          if (this.activeTowerChestSpawners.some((s) => s.chestUnitId === obj.unitId)) continue
          this.activeTowerChestSpawners.push({
            areaId: monster.areaId,
            chestUnitId: obj.unitId,
            remainingFrames: 400,
            armed: false,
            killerUnitId: killer.unitId,
          })
        }
      }
      if (quest[1] === 'a5q1') {
        this.activeShenkBombardments.push({
          areaId: monster.areaId,
          centerX: monster.x,
          centerY: monster.y,
          nextStrikeFrame: this.currentFrame + 8,
          endFrame: this.currentFrame + 160,
          ownerUnitId: killer.unitId,
        })
      }
    }
  }

  // 1.13c Act Boss death completion (`D2Game.dll` A1Q6..A5Q6, #1931, #1960):
  // - Credits ONLY `killer` and allied same-party members in the boss area or the same-Act town
  //   (NEVER unpartied bystanders!).
  // - A1Q6 (`andariel` #156, `0x6fc88150..0x6fc88275`, #1960): sets `QFLAG_PRIMARYGOALDONE | QFLAG_COMPLETEDNOW`
  //   (`0x3000`) on death, deferring `0x0001 | 0x0010` until Warriv (`#155`) interaction/travel.
  // - A5Q6 (`baalcrab` #544, `0x6fc7daf0`): spawns `tyrael3` (MonStats #521) at `(x - 5, y - 5)` (`0x6fc7c1f0`)
  //   and `"Destruction's End"` `LastPortal` (Objects.txt #565, OperateFn 72) in `OBJMODE_OPENED (2)` at `(x, y - 5)` (`0x6fc7d760`).
  // - A4Q3 (`diablo` #243, #1928): does NOT spawn `Harrogath` portal (#566) inside Chaos Sanctuary (`108`);
  //   Tyrael (`#367`) in Pandemonium Fortress (`103`) opens `#566` (`ACT4Q2_NpcActivate`).
  const actBossQuest = this.actBossQuestId(monster.defId, monster.hcIdx)
  if (actBossQuest !== undefined) {
    // A2Q6 (`duriel` #211, `D2Game.dll` `0x6fce8800` + `D2Client.dll` `0x6faccf1d`, #1982):
    // sets `0x1004` (`STARTED | PRIMARY_GOAL_DONE`, without `0x2000` so `quest-log-state` reaches
    // `0x0008` "Talk to Jerhyn" / `0x0010` "Talk to Meshif"), opens `tyrael's door` (`Objects.txt 153`),
    // and ensures `tyrael1` (`#251`) is spawned in Duriel's Lair.
    const actBossMask =
      actBossQuest === 'a1q6'
        ? QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_COMPLETED_NOW_113C
        : actBossQuest === 'a2q6'
          ? QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C
          : QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C
    const actBossRecipients =
      killer !== undefined
        ? this.getQuestEligiblePartyRecipients113c(killer, monster.areaId, {
            includeSameActTown: true,
          })
        : [...this.players.values()].filter(
            (p) => !p.dead && p.areaId === monster.areaId,
          )
    for (const p of actBossRecipients) {
      this.setPlayerQuestFlag(p, actBossQuest, actBossMask)
    }
    if (actBossQuest === 'a2q6') {
      this.syncDurielsLairA2Q6State113c(monster.areaId, monster.x, monster.y)
    } else if (actBossQuest === 'a5q6') {
      // D2Game.dll 0x6FC7C1F0 (`push 0x64 -> call 0x6FC54130`) & 0x6FC7D760 (`push 0x64 -> call 0x6FC54130`, #2018):
      // snaps `tyrael3` (#521) from `(baal.x - 5, baal.y - 5)` and `Destruction's End` (`Objects.txt 565`) from
      // `(tyrael.x + 5, tyrael.y)` onto connected walkable floor within 100 subtiles so chasm-edge Baal deaths
      // in Worldstone Chamber (`Area 132`) never drop Tyrael or `LastPortal` into unwalkable void.
      const hasLoadedArea = this.loadedAreas.has(monster.areaId)
      const existingTyrael3 = [...this.monsters.values()].find(
        (m) => m.areaId === monster.areaId && m.hcIdx === 521 && !m.dead,
      )
      const rawTyraelX = monster.x - 5
      const rawTyraelY = monster.y - 5
      const tyraelStand = hasLoadedArea
        ? findStandableNear(
            (x, y) => this.isWorldWalkableForPlayer(monster.areaId, x, y),
            rawTyraelX,
            rawTyraelY,
            100,
          )
        : null
      let tyraelAnchorX = existingTyrael3?.x ?? tyraelStand?.x ?? rawTyraelX
      let tyraelAnchorY = existingTyrael3?.y ?? tyraelStand?.y ?? rawTyraelY
      if (existingTyrael3 === undefined && (!hasLoadedArea || tyraelStand !== null)) {
        const tyraelId = this.spawnMonster({
          classId: 521,
          defId: 'tyrael3',
          name: 'Tyrael',
          x: tyraelAnchorX,
          y: tyraelAnchorY,
          areaId: monster.areaId,
          isNpc: true,
          experience: 0,
        })
        const spawnedTyrael = this.monsters.get(tyraelId)
        if (spawnedTyrael !== undefined) {
          tyraelAnchorX = spawnedTyrael.x
          tyraelAnchorY = spawnedTyrael.y
        }
      }
      const existingLastPortal = [...this.objects.values()].find(
        (o) => o.areaId === monster.areaId && o.classId === 565,
      )
      if (existingLastPortal !== undefined) {
        this.setObjectMode(existingLastPortal, 2)
      } else {
        const rawPortalX = tyraelAnchorX + 5
        const rawPortalY = tyraelAnchorY
        const tyraelCellX = Math.round(tyraelAnchorX)
        const tyraelCellY = Math.round(tyraelAnchorY)
        const portalStand = hasLoadedArea
          ? (findStandableNear(
              (x, y) =>
                this.isWorldWalkableForPlayer(monster.areaId, x, y) &&
                (x !== tyraelCellX || y !== tyraelCellY),
              rawPortalX,
              rawPortalY,
              100,
            ) ??
            findStandableNear(
              (x, y) => this.isWorldWalkableForPlayer(monster.areaId, x, y),
              rawPortalX,
              rawPortalY,
              100,
            ))
          : null
        if (!hasLoadedArea || portalStand !== null) {
          this.spawnObject({
            classId: 565,
            x: portalStand?.x ?? rawPortalX,
            y: portalStand?.y ?? rawPortalY,
            areaId: monster.areaId,
            mode: 2,
          })
        }
      }
    } else if (actBossQuest === 'a3q6') {
      // D2Game.dll 0x6FD0A950: Mephisto's death opens Hellgate (Objects.txt 342 -> Area 103).
      for (const o of this.objects.values()) {
        if (o.areaId === monster.areaId && o.classId === 342) {
          o.destAreaId = o.destAreaId ?? 103
          this.setObjectMode(o, 2)
        }
      }
    }
  }

  // Chaos Sanctuary (#1928): record seal boss death and check if all 5 seals & all 3 bosses are complete.
  if (
    monster.superUniqueId !== undefined &&
    Object.values(SEAL_BOSS_113C).some((boss) => boss.superUniqueId === monster.superUniqueId)
  ) {
    let deaths = this.sealBossDeaths.get(monster.areaId)
    if (deaths === undefined) {
      deaths = new Set()
      this.sealBossDeaths.set(monster.areaId, deaths)
    }
    deaths.add(monster.superUniqueId)
    this.tryTriggerChaosDiabloSpawn113c(monster.areaId)
  }

  // 1.13c A3Q5 Travincal Council (`D2Game.dll` `0x6FD073C0` / `0x6FD07DB0`, #1984):
  // - Travincal (`Area 83`) only spawns `councilmember1` (`Ismail Vilehand` + `Toorc Icefist`, `hcIdx 345`)
  //   and `councilmember2` (`Geleb Flamefinger`, `hcIdx 346`), NEVER `councilmember3` (`hcIdx 347`, which
  //   only spawns in Durance L3 `Area 102` and Throne of Destruction `Area 131`).
  // - `0x6FD073C0` registers spawned Travincal Council `unitId` GUIDs (`areaId < 0x6C`, excluding `102`/`131`).
  // - `0x6FD07E2F`: first Travincal Council kill drops `'qf1'` (`Khalim's Flail`) when any eligible recipient
  //   has not completed `a3q3` and lacks `'qf1'`/`'qf2'`.
  // - `0x6FD07EA4`: subsequent Travincal Council kill in `Area 83` drops backup `'box'` (`Horadric Cube`)
  //   when an eligible recipient lacks `'box'`.
  // - `0x6FD07F00`: `a3q5` completes once `0` living Council Members remain in `Area 83` (or `>= 3` dead
  //   with `0` living in synthetic non-DRLG unit test areas).
  const isCouncilMember =
    monster.defId.toLowerCase().startsWith('councilmember') ||
    (monster.classId >= 345 && monster.classId <= 347)
  const isTravincalDrlgArea = monster.areaId === 83 && this.loadedAreas.has(83)
  const isSyntheticCouncilTestArea =
    !this.loadedAreas.has(monster.areaId) &&
    monster.areaId !== 102 &&
    monster.areaId !== 131
  if (isCouncilMember && (isTravincalDrlgArea || isSyntheticCouncilTestArea)) {
    let deaths = this.councilDeaths.get(monster.areaId)
    if (deaths === undefined) {
      deaths = new Set()
      this.councilDeaths.set(monster.areaId, deaths)
    }
    deaths.add(monster.unitId)
    let dropGates = this.councilDropGates.get(monster.areaId)
    if (dropGates === undefined) {
      dropGates = { flailDropped: false, cubeDropped: false }
      this.councilDropGates.set(monster.areaId, dropGates)
    }

    if (killer) {
      const eligibleRecipients = this.getQuestEligiblePartyRecipients113c(
        killer,
        monster.areaId,
        { includeSameActTown: false },
      )
      const recipients = eligibleRecipients.length > 0 ? eligibleRecipients : [killer]

      if (!dropGates.flailDropped) {
        const missingFlailRecipients = recipients.filter(
          (r) =>
            !hasQuestFlag113c(r.questFlags, 'a3q3', QUEST_FLAG_COMPLETED_113C) &&
            !this.playerHasQuestItem(r, 'qf1') &&
            !this.playerHasQuestItem(r, 'qf2'),
        )
        let groundFlailCount = 0
        for (const gItem of this.groundItems.values()) {
          if (gItem.areaId !== monster.areaId) continue
          const gc = gItem.code.trim().toLowerCase()
          if (gc === 'qf1' || gc === 'qf2') groundFlailCount++
        }
        const neededFlails = Math.max(0, missingFlailRecipients.length - groundFlailCount)
        if (neededFlails > 0) {
          const flails: NonNullable<ReturnType<typeof this.createQuestDropItem>>[] = []
          for (let i = 0; i < neededFlails; i++) {
            const flail = this.createQuestDropItem('qf1', monster.level)
            if (flail) flails.push(flail)
          }
          if (flails.length > 0) {
            this.spawnDroppedItems(flails, monster.areaId, monster.x, monster.y)
            dropGates.flailDropped = true
          }
        }
      } else if (monster.areaId === 83 && !dropGates.cubeDropped) {
        const missingCubeRecipients = recipients.filter(
          (r) => !this.playerOrGroundHasQuestItem(r, 'box'),
        )
        if (missingCubeRecipients.length > 0) {
          const cubes = missingCubeRecipients
            .map(() => this.createQuestDropItem('box', monster.level))
            .filter((it): it is NonNullable<typeof it> => it !== null)
          if (cubes.length > 0) {
            this.spawnDroppedItems(cubes, monster.areaId, monster.x, monster.y)
            dropGates.cubeDropped = true
          }
        }
      }

      const anyPendingCouncil = isTravincalDrlgArea
        ? [...(this.pendingPresetMonsters.get(monster.areaId)?.byRoom.values() ?? [])].some(
            (roomPresets) =>
              roomPresets.monsters.some((preset) => preset.classId >= 345 && preset.classId <= 347),
          )
        : false
      const anyLivingCouncil =
        anyPendingCouncil ||
        [...this.monsters.values()].some(
          (m) =>
            m.areaId === monster.areaId &&
            m.unitId !== monster.unitId &&
            !m.dead &&
            m.hp > 0 &&
            (m.defId.toLowerCase().startsWith('councilmember') ||
              (m.classId >= 345 && m.classId <= 347)),
        )
      const enoughKills = isTravincalDrlgArea ? deaths.size >= 1 : deaths.size >= 3
      if (!anyLivingCouncil && enoughKills) {
        for (const recipient of eligibleRecipients) {
          if (hasQuestFlag113c(recipient.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)) continue
          this.setPlayerQuestFlag(recipient, 'a3q5', QUEST_FLAG_COMPLETED_113C)
        }
      }
    }
  }

  // Ancients: killing all three barbarians completes a5q5 for alive same-party members on the Summit (#1931).
  if (
    monster.superUniqueId !== undefined &&
    ANCIENT_BARBARIANS_113C.some((boss) => boss.superUniqueId === monster.superUniqueId)
  ) {
    let deaths = this.ancientDeaths.get(monster.areaId)
    if (deaths === undefined) {
      deaths = new Set()
      this.ancientDeaths.set(monster.areaId, deaths)
    }
    deaths.add(monster.superUniqueId)
    if (deaths.size >= ANCIENT_BARBARIANS_113C.length) {
      // D2Game.dll 0x6FC7E660 & ACT5Q5_GrantReward (0x6FC7BF70): upon killing all three Ancients,
      // restore statues 474..476 and SummitDoor 564 to mode 2 (#2020) and award a5q5 completion + XP to eligible
      // party members in the Summit arena meeting the difficulty level requirement (20 / 40 / 60).
      for (const obj of this.objects.values()) {
        if (
          obj.areaId === monster.areaId &&
          (obj.classId === 474 ||
            obj.classId === 475 ||
            obj.classId === 476 ||
            obj.classId === 564)
        ) {
          this.setObjectMode(obj, 2)
        }
      }
      const requiredAncientsLevel = (this.difficulty + 1) * 20
      const ancientsRecipients =
        killer !== undefined
          ? this.getQuestEligiblePartyRecipients113c(killer, monster.areaId, {
              requireExactArea: true,
              excludeDead: true,
              minCharLevel: requiredAncientsLevel,
            })
          : [...this.players.values()].filter(
              (p) => !p.dead && p.areaId === monster.areaId && p.level >= requiredAncientsLevel,
            )
      for (const p of ancientsRecipients) {
        this.setPlayerQuestFlag(
          p,
          'a5q5',
          QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
        )
      }
    }
  }

  // Act I Den of Evil (`A1Q1`, `areaId = 8`, `D2Game.dll` `0x6fc81d40`, #1931, #1959):
  // emits `S2C 0x5D` (`QuestState` `kind: 'status'`) remaining-monster countdown (`1..5`)
  // and completes `a1q1` when `remainingCount === 0` after all DRLG rooms are populated.
  if (monster.areaId === 8) {
    this.syncDenOfEvilProgress113c(killer, monster.unitId)
  }

  // Act V Rescue on Mount Arreat (`A5Q2`, `D2Game.dll` `0x6fc7a310..0x6fc7a4ff`, #2021):
  // - `act5pow` (`hcIdx 534`) death before rescue increments `arreatDeadPowCount`.
  // - `prisondoor` (`hcIdx 434`) destruction breaches the nearest walled Barbarian pen (`Objects.txt 473`),
  //   spawns temporary rescue portal (`Objects.txt 189`), rescues surviving `act5pow`, and advances `questFlags[36]`.
  if (monster.hcIdx === 534 && monster.areaId === 111) {
    this.arreatDeadPowCount += 1
  } else if (monster.hcIdx === 434) {
    let nearestPen: (typeof this.objects extends Map<number, infer V> ? V : never) | undefined
    let bestPenDist = 24
    for (const candidate of this.objects.values()) {
      if (
        candidate.areaId !== monster.areaId ||
        candidate.classId !== 473 ||
        candidate.useCount > 0
      ) {
        continue
      }
      const d = Math.hypot(candidate.x - monster.x, candidate.y - monster.y)
      if (d <= bestPenDist) {
        bestPenDist = d
        nearestPen = candidate
      }
    }
    if (nearestPen !== undefined) {
      this.breachArreatPrisonPen113c(nearestPen, killer, {
        x: monster.x + 2,
        y: monster.y,
      })
    }
  }

  // 1.13c pack morale: a Fallen/Fetish death scares same-race minions within the
  // pack radius with the AI's own `aip1` percentage (30/40/50 Normal/NM/Hell).
  if (monsterAiBehavior(monster.ai) === 'flee') {
    const fleeChancePct = Math.max(
      0,
      Math.min(100, Math.floor(monster.aiParams[0] ?? 0)),
    )
    for (const ally of this.monsters.values()) {
      if (
        ally.dead ||
        ally.isNpc ||
        ally.unitId === monster.unitId ||
        ally.areaId !== monster.areaId ||
        ally.monType !== monster.monType ||
        ally.isBoss ||
        ally.isPrimeEvil ||
        ally.rank === 'champion'
      ) {
        continue
      }
      if (
        Math.hypot(ally.x - monster.x, ally.y - monster.y) <= 12 &&
        this.rng.rand(100) < fleeChancePct
      ) {
        ally.fleeTicks = Math.max(ally.fleeTicks, 45)
      }
    }
  }

  const diffKey: 'normal' | 'nightmare' | 'hell' =
    this.difficulty === 2
      ? 'hell'
      : this.difficulty === 1
        ? 'nightmare'
        : 'normal'

  // 1.13c Boss Death Controller & Minion Purge (`D2Game.dll` `QUESTSFX_MainHandler` / `0x6FAD0FB0`, #1823, #1906):
  // Emits controller missile (`brdeathcontrol` #284 for Blood Raven #267, etc.) and purges nearby minions
  // strictly from `MonStats.txt` `killminions` / `SplEndDeath === 1` / `umod 15` / Blood Raven / Shenk
  // (NEVER from `MonUMod #41` `always_run_ai`).
  const bossDeathSpec = getBossDeathFxSpec(monster.hcIdx, monster.defId)
  const bossDeathSpecEligible =
    bossDeathSpec !== null &&
    (!bossDeathSpec.requiresQuestCompleteUMod ||
      monster.umodIds.includes(MON_UMOD.QUESTCOMPLETE))
  if (bossDeathSpecEligible && bossDeathSpec.controllerClassId !== null) {
    this.broadcastExplosionMissile(monster, bossDeathSpec.controllerClassId)
  }
  const killMinionsDecision = shouldKillMinionsOnDeath113c({
    hcIdx: monster.hcIdx,
    defId: monster.defId,
    superUniqueId: monster.superUniqueId,
    killMinions: monster.killMinions,
    umodIds: monster.umodIds,
  })
  const purgeRadius =
    bossDeathSpecEligible && bossDeathSpec.minionPurge !== undefined
      ? bossDeathSpec.minionPurge.radiusSubTiles
      : monster.killMinions || killMinionsDecision.purge
        ? Math.max(25, killMinionsDecision.radiusSubTiles)
        : 0
  if (purgeRadius > 0) {
    for (const surrounding of this.monsters.values()) {
      if (
        surrounding.dead ||
        surrounding.isNpc ||
        surrounding.align !== 0 ||
        !surrounding.isKillable ||
        surrounding.unitId === monster.unitId ||
        surrounding.areaId !== monster.areaId ||
        surrounding.isBoss ||
        surrounding.isPrimeEvil ||
        surrounding.superUniqueId !== undefined
      ) {
        continue
      }
      if (Math.hypot(surrounding.x - monster.x, surrounding.y - monster.y) <= purgeRadius) {
        surrounding.hp = 0
        surrounding.dead = true
        surrounding.mode = 12
        surrounding.alreadyGrantedKillRewards = true
        surrounding.selfResurrectCheckFrame = 0
        this.broadcastToArea(surrounding.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: surrounding.unitId,
          mode: 12,
          at: { x: Math.round(surrounding.x), y: Math.round(surrounding.y) },
          lifePct: 0,
        })
      }
    }
  }

  // 1.13c SuicideMinion (`hcIdx 461..468`) self-detonation (`D2Game.dll` `0x6FC45A18..0x6FC45BD0`, #1824):
  // Destroys corpse (`shattered = true`), broadcasts `#426/#427/#428`, and deals physical + fire/cold explosion in 4 sub-tiles.
  if (isSuicideMinionMonster(monster.hcIdx, monster.defId)) {
    monster.shattered = true
    const aip1Override = monster.aiParams.length > 0 ? monster.aiParams[0] : undefined
    // Note: MonStats `suicideminion1..8` `aip1` in `MONSTATS_AIP1_FLAT_113C` selects fire(1)/ice(>=2)/corpse(0);
    // only pass `aip1Override` when explicitly set to 0/1/2 (since runtime `aiParams[0]` can hold AI % params).
    const smDmg = calcSuicideMinionExplosionDamage(
      monster.minDmg,
      monster.maxDmg,
      monster.maxHp,
      monster.hcIdx,
      diffKey,
      aip1Override !== undefined && aip1Override <= 3 ? aip1Override : undefined,
      this.rng.rand(101) / 100,
    )
    this.broadcastExplosionMissile(monster, smDmg.missileClassId)
    this.damageMercsAndPetsInRadius(
      monster.areaId,
      monster.x,
      monster.y,
      smDmg.radiusSubTiles,
      smDmg.physDmg,
      'phys',
    )
    this.damageMercsAndPetsInRadius(
      monster.areaId,
      monster.x,
      monster.y,
      smDmg.radiusSubTiles,
      smDmg.elemDmg,
      smDmg.elemType,
    )
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (Math.hypot(p.x - monster.x, p.y - monster.y) <= smDmg.radiusSubTiles) {
        const phys =
          smDmg.physDmg > 0 && this.rollPlayerExplosionShieldBlock113c(p) ? 0 : smDmg.physDmg
        this.applyPlayerElementalDamage(
          p,
          {
            phys,
            ...(smDmg.elemType === 'cold' ? { cold: smDmg.elemDmg } : { fire: smDmg.elemDmg }),
          },
          { killerType: 'monster', killerUnitId: monster.unitId },
        )
        if (smDmg.elemType === 'cold' && !p.dead) {
          this.applyUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, 11, 100)
        }
      }
    }
  }

  // F12.5: Fire Enchanted (MonUMod #9 `fire`) 1.13c corpse explosion (`D2Game.dll` `0x6FC466B0..0x6FC46862`, #1821).
  // Uses unmultiplied base monster max HP (`unscaledMaxHp`), `[3/4, 1/3, 1/8]` difficulty ratios, `60%..100%` roll,
  // 50% physical + 50% fire within 4 sub-tiles (minions excluded).
  const isFireEnchanted =
    monster.umodIds.includes(MON_UMOD.FIRE) && monster.rank !== 'minion'
  if (isFireEnchanted) {
    const feDmg = calcFireEnchantedDeathDamage(
      monster.unscaledMaxHp,
      diffKey,
      this.rng.rand(101) / 100,
    )
    const radius = feDmg.radiusSubTiles
    this.broadcastExplosionMissile(monster, 82)
    // 1.13c corpse-boom resolves a short time after the death animation starts.
    monster.pendingDeathExplosion = {
      frame: this.currentFrame + 5,
      radius,
      phys: feDmg.physDmg,
      fire: feDmg.fireDmg,
      total: Math.max(1, feDmg.totalDmg),
    }
  }

  // Cold Enchanted (MonUMod #18 `cold`) Frost Nova on death (non-minions only).
  // `coldunique` (#194) is the 1.13c MonUMod missile; stepMissiles applies the
  // rolled cold damage and the chill state (11), never Conviction (28).
  const isColdEnchanted =
    monster.umodIds.includes(MON_UMOD.COLD) && monster.rank !== 'minion'
  if (isColdEnchanted) {
    const ceNova = calcColdEnchantedDeathNova(monster.level, diffKey)
    const novaDmg = Math.max(
      ceNova.coldMinDmg,
      ceNova.coldMinDmg +
        this.rng.rand(Math.max(1, ceNova.coldMaxDmg - ceNova.coldMinDmg + 1)),
    )
    // D2Client 0x6fb51020 emits the full 64-entry nova ring; scale the client
    // ring (radius 30) down to coldunique's Range 14.
    for (let i = 0; i < D2CLIENT_NOVA_RING_X.length; i++) {
      const rx = D2CLIENT_NOVA_RING_X[i]!
      const ry = D2CLIENT_NOVA_RING_Y[i]!
      const len = Math.max(1, Math.hypot(rx, ry))
      this.spawnMonsterMissile(
        monster,
        monster.x + (rx / len) * ceNova.rangeTicks,
        monster.y + (ry / len) * ceNova.rangeTicks,
        novaDmg,
        194,
        194,
        { guaranteed: true },
      )
    }
  }

  // MonUMod #42 NovaDeath (`D2Game.dll` `0x6FC41A90` -> `0x6FC46520` -> `0x6FCC2800`, #1995):
  // Boss-only (`rank !== 'minion'`) 64-bolt ring of `Missiles.txt` ID `90` (`nova`, `Skill = 48 Nova`, `Range = 13`).
  if (
    monster.umodIds.includes(MON_UMOD.NOVADEATH) &&
    monster.rank !== 'minion'
  ) {
    const novaRange = computeNovaDeathDamageRange113c(1)
    const novaDmg =
      novaRange.maxLtng > novaRange.minLtng
        ? novaRange.minLtng + this.rng.rand(novaRange.maxLtng - novaRange.minLtng + 1)
        : novaRange.minLtng
    for (let i = 0; i < D2CLIENT_NOVA_RING_X.length; i++) {
      const rx = D2CLIENT_NOVA_RING_X[i]!
      const ry = D2CLIENT_NOVA_RING_Y[i]!
      const len = Math.max(1, Math.hypot(rx, ry))
      this.spawnMonsterMissile(
        monster,
        monster.x + (rx / len) * NOVADEATH_RANGE_TICKS_113C,
        monster.y + (ry / len) * NOVADEATH_RANGE_TICKS_113C,
        novaDmg,
        NOVADEATH_MISSILE_ID_113C,
        48,
        {
          skillLevel: novaRange.slvl,
          physDamage: 0,
          elemDamage: novaDmg,
          element: 'ltng',
          guaranteed: true,
          skipMultishot: true,
        },
      )
    }
  }

  // MonUMod #20 Scarab (`D2Game.dll` `0x6FC41B00` -> `0x6FC460D0`, #1995):
  // Emits 8 radial `buglightning` (#225) bolts on `MONMODE_DEATH` (`mode = 0`) across all monster ranks.
  if (
    monster.umodIds.includes(MON_UMOD.SCARAB) ||
    isScarabMonster(monster.hcIdx, monster.defId)
  ) {
    this.emitScarabBugLightningBurst113c(monster)
  }

  // Bone Fetish / Undead Stygian Doll physical death explosion
  if (
    isBoneFetishMonster(monster.hcIdx, monster.defId) ||
    monster.umodIds.includes(MON_UMOD.BONEFETISH)
  ) {
    const bfDmg = calcBoneFetishDeathDamage(monster.maxHp, diffKey)
    const rolledBfPhys =
      bfDmg.maxPhys > bfDmg.minPhys
        ? bfDmg.minPhys + this.rng.rand(bfDmg.maxPhys - bfDmg.minPhys + 1)
        : bfDmg.minPhys
    const explosionDmg = Math.max(1, Math.floor(rolledBfPhys))
    const radius = Math.max(4, BONE_FETISH_EXPLOSION_RADIUS)
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (Math.hypot(p.x - monster.x, p.y - monster.y) <= radius) {
        this.applyDamageToPlayer(p, explosionDmg, {
          killerType: 'monster',
          killerUnitId: monster.unitId,
        })
      }
    }
  }

  // MonUMod #10 PoisonDead (`D2Game.dll` `0x6FC41A90` -> `0x6FC46230`, #1995):
  // Spawns stationary `Missiles.txt` ID `155` (`corpsepoisoncloud`, `Range = 80`, `ELen = 175`, `HitShift = 1`)
  // across all monster ranks so nearby units take real resisted 175-frame poison DoT.
  if (
    isPoisonDeadMonster(monster.hcIdx, monster.defId) ||
    monster.umodIds.includes(MON_UMOD.POISONDEAD)
  ) {
    const poisonSpec = computePoisonDeadCloudDamage113c(monster.level)
    const cloudMissileId = this.spawnMonsterMissile(
      monster,
      monster.x,
      monster.y,
      poisonSpec.totalPoisonHp,
      POISONDEAD_CLOUD_MISSILE_ID_113C,
      0,
      {
        skillLevel: poisonSpec.slvl,
        physDamage: 0,
        elemDamage: poisonSpec.totalPoisonHp,
        element: 'pois',
        elemDurationFrames: poisonSpec.durationFrames,
        guaranteed: true,
        skipMultishot: true,
      },
    )
    const cloudRec = this.missiles.get(cloudMissileId)
    if (cloudRec !== undefined) {
      cloudRec.size = 3
    }
    for (const p of this.players.values()) {
      if (p.dead || p.areaId !== monster.areaId) continue
      if (Math.hypot(p.x - monster.x, p.y - monster.y) <= 3.5) {
        this.resolveMonsterAttackOnPlayer(monster, p, {
          minDmg: 0,
          maxDmg: 0,
          skillMode: 'A1',
          attackKind: 'missile',
          skillId: 0,
          missileId: POISONDEAD_CLOUD_MISSILE_ID_113C,
          elementType: 'pois',
          elemMin: poisonSpec.totalPoisonHp,
          elemMax: poisonSpec.totalPoisonHp,
          elemDurationFrames: poisonSpec.durationFrames,
          fromMissile: true,
          autoHit: true,
        })
        cloudRec?.hitCooldowns.set(p.unitId, this.currentFrame + 4)
      }
    }
  }

  // Duriel spawns 5 Maggots on death
  if (
    isDurielMonster(monster.hcIdx, monster.defId) ||
    monster.umodIds.includes(MON_UMOD.DURIELDEAD)
  ) {
    for (const offset of DURIEL_MAGGOT_OFFSETS) {
      this.spawnMonster({
        classId: DURIEL_MAGGOT_HCIDX,
        x: Math.round(monster.x + offset.dx),
        y: Math.round(monster.y + offset.dy),
        areaId: monster.areaId,
      })
    }
  }
}



/**
 * 1.13c signed `STAT_ITEM_ADDEXPERIENCE` (stat 85) total (`D2Common_10519_GetStatSigned(pUnit, 85, 0)`
 * at `D2Game.dll` `0x6FCFC099`), combining equipped/charm/set item bonuses (`sumPlayerItemStat(player, 85)`)
 * with active state modifiers (`statList.getModifierBonus('item_addexperience')`, including
 * Experience Shrine `state 137` `+50` from `0x6FD1A600` / `0x6FC8ABB0`).
 */
function getPlayerAddExperiencePct(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const itemBonus = Math.trunc(this.sumPlayerItemStat(player, 85))
  const combat = this.playerCombatContext(player)
  const stateBonus = Math.trunc(combat.statList.getModifierBonus('item_addexperience'))
  const directShrineBonus =
    player.states.has(137) && !combat.stateBus.hasState(137) ? 50 : 0
  return itemBonus + stateBonus + directShrineBonus
}



function grantExperience(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  xpGain: number,
  monsterLevel: number = player.level,
): void {
  // 1.13c SUNITDMG_CalculateExperienceGain (0x6FCFC030):
  // 0x7FFFFF input clamp -> clvl >= 99 returns 0 -> 0x6FCFAA40 level diff ->
  // 0x6FCFA9E0 ExpRatio -> signed stat 85 (including Experience Shrine state 137 +50).
  const addExpPct = this.getPlayerAddExperiencePct(player)
  const granted = calculateKillExperienceGain113c({
    rawExp: xpGain,
    clvl: player.level,
    mlvl: monsterLevel,
    addExpPct,
    maxLevel: MAX_PLAYER_LEVEL_113C,
  })
  if (granted <= 0) return
  // 1.13c SUNITDMG_AddPlayerExperience (0x6FCFDCF0): experience never exceeds the level-99 threshold.
  player.experience = Math.min(
    experienceForLevel113c(MAX_PLAYER_LEVEL_113C),
    player.experience + granted,
  )
  this.emitToPlayer(player.unitId, {
    type: 'UnitStatUpdate',
    unitType: 'player',
    unitId: player.unitId,
    statId: 13,
    value: player.experience,
  })
  this.emitToPlayer(player.unitId, {
    type: 'Experience',
    value: player.experience,
    isDelta: false,
  })

  while (
    player.level < MAX_PLAYER_LEVEL_113C &&
    player.experience >= experienceForLevel113c(player.level + 1)
  ) {
    player.level++
    player.statPts += 5
    player.newSkills += 1
    // 1.13c `item_skillonlevelup` (199) fires once per gained level around the player (#1797).
    this.triggerPlayerCtcProcs113c(player, 199, {})
    const base = CANONICAL_CHARSTATS[player.classCode]
    const lifeAddFixed = Math.round(base.perLevel.life * FIXED_ONE)
    const manaAddFixed = Math.round(base.perLevel.mana * FIXED_ONE)
    const stamAddFixed = Math.round(base.perLevel.stamina * FIXED_ONE)

    player.maxHpFixed += lifeAddFixed
    player.maxManaFixed += manaAddFixed
    player.maxStaminaFixed += stamAddFixed

    const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
    const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
    const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)

    player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
    // 1.13c `D2Game.dll` `0x6FD0B090` (`0x6FD0B141..0x6FD0B163`, #1672): only refill life if `hitpoints > 0`.
    if (player.hpFixed > 0 && !player.dead) {
      player.hpFixed = accruedMaxHpFixed
      player.hp = player.maxHp
    }

    player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
    player.manaFixed = accruedMaxManaFixed
    player.mana = player.maxMana

    player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))
    player.staminaFixed = accruedMaxStaminaFixed
    player.staminaExhausted = false
    player.stamina = player.maxStamina

    const nextExp =
      player.level < MAX_PLAYER_LEVEL_113C
        ? experienceForLevel113c(player.level + 1)
        : experienceForLevel113c(MAX_PLAYER_LEVEL_113C)

    for (const [statId, value] of [
      [12, player.level],
      [30, nextExp],
      [4, player.statPts],
      [5, player.newSkills],
      [6, player.hpFixed],
      [7, player.maxHpFixed],
      [8, player.manaFixed],
      [9, player.maxManaFixed],
      [10, player.staminaFixed],
      [11, player.maxStaminaFixed],
    ] as const) {
      this.emitToPlayer(player.unitId, {
        type: 'UnitStatUpdate',
        unitType: 'player',
        unitId: player.unitId,
        statId,
        value,
      })
      this.emitToPlayer(player.unitId, {
        type: 'StatSet',
        stat: statId,
        value,
      })
    }
  }
}

export interface MonsterDeathAndXpMethods {
  playerResistPct(player: InternalPlayerRecord, kind: 'phys' | 'fire' | 'cold' | 'light' | 'poison'): number
  playerElementalAbsorb(player: InternalPlayerRecord, kind: 'fire' | 'cold' | 'light'): { readonly pct: number; readonly flat: number }
  applyPlayerElementalDamage(player: InternalPlayerRecord, parts: {
    readonly phys?: number | undefined
    readonly fire?: number | undefined
    readonly cold?: number | undefined
    readonly light?: number | undefined
    readonly ltng?: number | undefined
    readonly mag?: number | undefined
    readonly pois?: number | undefined
    readonly poisDurationFrames?: number | undefined
  }, options?: {
    readonly hitClass?: number | string | undefined
    readonly skipGetHit?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly killerType?: DeathKillerKind113c
    readonly killerUnitId?: number | undefined
  }): void
  broadcastAllyHp(areaId: number, unitId: number, hp: number): void
  resolvePetUnitId(pet: SummonedPetUnit): number
  handlePetDeath(pet: SummonedPetUnit, areaId: number, petUnitId: number, ownerIdOverride?: number): void
  broadcastAllyRemoved(areaId: number, unitId: number): void
  applyDamageToMerc(
    mercUnitIdOrRecord: number | InternalMercenaryRecord,
    damage: number,
    areaIdOverride?: number,
    options?: { readonly skipGetHit?: boolean | undefined },
  ): void
  applyDamageToSummon(ownerIdOrPet: number | SummonedPetUnit, petOrDamage: SummonedPetUnit | string | number, damageOverride?: number, areaIdOverride?: number): void
  damageMercsAndPetsInRadius(areaId: number, x: number, y: number, radius: number, damage: number, element?: 'phys' | 'fire' | 'cold' | 'light' | undefined): void
  auraRangeSubtiles(skillId: number, slvl: number): number
  resolveEffectiveMonsterAuraLevel(monster: InternalMonsterRecord): number
  monsterAuraDamageBonusPct(monster: InternalMonsterRecord): number
  applyMonsterAura(monster: InternalMonsterRecord): void
  onMonsterKilled(killer: InternalPlayerRecord | undefined, monster: InternalMonsterRecord, killSource?: 'player' | 'merc' | 'pet' | 'other' | undefined): void
  getPlayerAddExperiencePct(player: InternalPlayerRecord): number
  grantExperience(player: InternalPlayerRecord, xpGain: number, monsterLevel?: number | undefined): void
}

export const monsterDeathAndXpMethods: Record<keyof MonsterDeathAndXpMethods, unknown> = {
  playerResistPct,
  playerElementalAbsorb,
  applyPlayerElementalDamage,
  broadcastAllyHp,
  resolvePetUnitId,
  handlePetDeath,
  broadcastAllyRemoved,
  applyDamageToMerc,
  applyDamageToSummon,
  damageMercsAndPetsInRadius,
  auraRangeSubtiles,
  resolveEffectiveMonsterAuraLevel,
  monsterAuraDamageBonusPct,
  applyMonsterAura,
  onMonsterKilled,
  getPlayerAddExperiencePct,
  grantExperience,
}
