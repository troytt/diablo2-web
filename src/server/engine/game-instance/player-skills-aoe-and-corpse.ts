/**
 * GameInstance Subsystem: Player AoE, Corpse, Trap, Bone Wall/Prison, Whirlwind, Mind Blast & Strafe Skills (`src/server/engine/game-instance/player-skills-aoe-and-corpse.ts`).
 */

import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import { getEmbeddedDropTables } from '../../../common/items/embedded-drop-tables.ts'
import { resolveArmorSpeed113c, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { scaleLowQualityWeaponBand113c } from '../../../common/items/drop-tables.ts'
import { FRIENDLY_AURA_TARGET_STATE_IDS_113C, calculateHolyFreezeStats } from '../../../common/skills/paladin-auras.ts'
import { isBonePrisonMonsterHcIdx113c, isTentacleHcIdx113c, isTentacleHeadHcIdx113c } from '../../../common/units/monai-113c.ts'
import type { ServerEvent, ItemStat } from '../../../netproto/index.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { calculateCrushingBlow113c, executeSUnitDmg, resolveHitClassCode113c, computeCorpseExplosion113c, type CombatUnitContext } from '../combat-pipeline.ts'
import { calculateBonePrisonStats, calculateBoneWallStats } from '../missile-engine.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { advanceUnitPierceSeed } from '../missile-pierce.ts'
import { StateBus } from '../state-bus.ts'
import { getAttackWeaponInfo, isInMeleeRange113c } from '../../../common/skills/weapon-combat-meta.ts'
import { AuraScanner, type CorpseContext } from '../aura-scanner.ts'
import { isWithinAuraRange } from '../../../common/skills/aura-filter.ts'
import { computeDiminishingReturns, evaluateCalc } from '../../../common/data/calc-ast.ts'
import { difficultyLifeStealDivisor, difficultyManaStealDivisor, difficultyMonsterColdDivisor, difficultyMonsterFreezeDivisor } from '../difficulty-resist-penalty.ts'
import { computeMindBlastConversionChance, computeMindBlastStunDuration } from '../../skills/assassin-shadow.ts'
import { calculateFindItemStats, rollFindPotionDrop113c } from '../../skills/barbarian-warcries.ts'
import { calcBladeFury113c, calcBladeSentinel113c, calcBladeShield113c } from '../../skills/assassin-traps.ts'
import { calculateConversionStats, calculateVengeanceStats } from '../../skills/paladin-combat.ts'
import { STATE_BLADESHIELD_113C, STATE_CONVERSION_SAVE_113C, STATE_SLOWMISSILES_113C, STATE_TERROR_113C, computeBonePrisonRingPositions113c, computeBoneWallSegmentPositions113c, computeConversionLevelScaling113c, computeGrimWardStats113c, computeSlowMissilesStats113c } from '../../skills/p1-wave4-skills-113c.ts'
import { generateMonsterHorkDrop113c } from '../../items/drop-generator.ts'
import { advanceWhirlwindSpinFrame113c, computeOpenWoundsBitrate256113c, computeWhirlwindDamageAndAr113c, computeWhirlwindStepDistancePerFrame113c, createWhirlwindSpinState113c, resolveWhirlwindWeaponHands113c, type WhirlwindEquippedHandInput113c, type WhirlwindHandWeaponSpec113c, type WhirlwindSpinState113c } from '../../skills/whirlwind-113c.ts'
import { classifyPlayerSrvDoMissile113c, srvdo008FanTargets113c, srvdoRing64Targets113c, strafeShotCount113c } from '../player-srvdo-113c.ts'
import { findStandableNear } from '../../world/area-bootstrap.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMissileRecord, InternalMonsterRecord, InternalPlayerRecord, PlayerSkillCast, ServerItemEntry } from './types.ts'
import { BODYLOC_LEFT_ARM, BODYLOC_RIGHT_ARM, PER_LEVEL_STAT_MAP_113C, PLAYER_MELEE_REACH_SUBTILES, SKILL_UNSUMMON, SRVDOFUNC_WHIRLWIND, STAT_ITEM_MAXDAMAGE_PERCENT, STAT_MAXDAMAGE, STAT_MINDAMAGE, STAT_SECONDARY_MAXDAMAGE, STAT_SECONDARY_MINDAMAGE, TOWN_AREAS, areaToAct, collectItemStats, UNIT_TYPE_113C, missileSpeedSubtilesPerFrame113c } from './constants-and-helpers.ts'


function applyPlayerSkillEffect(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
  targetMonster: InternalMonsterRecord | undefined,
): void {
  const { skill, evalResult } = cast
  if (skill.id === SKILL_UNSUMMON) {
    this.unsummonPetAt(player.unitId, tx, ty)
    return
  }
  if (skill.summon !== '' || skill.petType !== '') {
    const validCorpse =
      targetMonster !== undefined &&
      targetMonster.areaId === player.areaId &&
      this.canSelectMonsterCorpse113c(targetMonster, false)
        ? targetMonster
        : undefined
    this.summonPet(player.unitId, {
      skillId: skill.id,
      slvl: cast.slvl,
      x: tx,
      y: ty,
      corpseMonsterId: validCorpse?.unitId,
    })
    if (validCorpse?.shattered && !validCorpse.corpseConsumed) {
      validCorpse.corpseConsumed = true
      validCorpse.states.add(118)
    }
    // Summon rows that also carry a caster `aurastate` (Dopplezon, Shadow Warrior, Iron Golem
    // thorns) only take that state through the pet's own runtime.
    return
  }
  const stateByName = (name: string): number => {
    const rec = this.registry.getStateByName(name)
    if (rec === undefined) {
      throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown States.txt row "${name}"`)
    }
    return rec.id
  }
  if (skill.id === 277) {
    this.activateBladeShieldState113c(player, cast.slvl)
    return
  }
  if (skill.aura) {
    if (skill.auraState === '') return
    const stateId = stateByName(skill.auraState)
    const previous = this.playerActiveAuraState.get(player.unitId)
    if (previous !== undefined && previous !== stateId) {
      const stillGrantedByItem = this.playerItemAuraScanners
        .get(player.unitId)
        ?.sources.some((s) => s.casterStateId === previous)
      if (!stillGrantedByItem) {
        this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, previous)
        this.playerCombat.get(player.unitId)?.stateBus.removeState(previous)
      }
      player.states.delete(85)
      this.playerCombat.get(player.unitId)?.stateBus.removeState('nomanaregen')
    }
    this.playerActiveAuraState.set(player.unitId, stateId)
    // 1.13c `SKILLS_ActivateAura` (0x6FCCDB30): immediately pulse `immediate=1` auras on activation
    // and schedule periodic `perdelay` pulses through `AuraScanner` on global frame boundaries.
    const ownerCtx = this.playerCombatContext(player)
    const scanner = new AuraScanner(this.registry, (this.currentMapSeed ^ player.unitId) >>> 0)
    const activeSource = scanner.setActiveAura(ownerCtx, skill.id, cast.slvl, this.currentFrame + 1)
    const targetStateId = skill.auraTgtState ? this.registry.getStateByName(skill.auraTgtState)?.id : undefined
    this.playerAuraScanners.set(player.unitId, {
      scanner,
      skillId: skill.id,
      radiusSubtiles: evalResult.radiusSubtiles,
      source: activeSource ?? undefined,
      targetStateId,
    })
    if (activeSource) {
      const inRange = (x: number, y: number) => isWithinAuraRange(x - player.x, y - player.y, evalResult.radiusSubtiles)
      const targets = this.collectFriendlyAuraAllies113c({
        ownerPlayerId: player.unitId,
        areaId: player.areaId,
        originX: player.x,
        originY: player.y,
        maxRadius: evalResult.radiusSubtiles,
        selfPlayerCtx: ownerCtx,
      })
      const enemyRecords = [...this.monsters.values()].filter(
        (m) => !m.dead && !m.isNpc && !m.submerged && m.isKillable && m.align === 0 && !this.isMonsterConverted(m) && m.areaId === player.areaId && inRange(m.x, m.y),
      )
      const corpseRecords = [...this.monsters.values()].filter(
        (m) => this.canSelectMonsterCorpse113c(m, false) && m.areaId === player.areaId && inRange(m.x, m.y),
      )
      const enemies = enemyRecords.map((m) => this.monsterCombatContext(m))
      const pvpAuraEnemies = this.buildHostileAuraPvpEnemies113c(player.unitId, player.areaId, inRange)
      const allAuraEnemies = [...enemies, ...pvpAuraEnemies.map((e) => e.ctx)]
      const corpses: CorpseContext[] = corpseRecords.map((m) => ({ id: String(m.unitId), consumed: false, x: m.x, y: m.y }))
      const initialPulse = scanner.pulseAura(activeSource, this.currentFrame + 1, targets.allAllies, allAuraEnemies, corpses, {
        isTown: TOWN_AREAS.has(player.areaId),
        hasLineOfSight: (src, tgt) =>
          src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
            ? false
            : this.isMonsterStepWalkable(player.areaId, src.x, src.y, tgt.x, tgt.y, true),
        rng: this.rng,
      })
      this.applyAuraPulseSideEffects113c(initialPulse, player.x, player.y, player.areaId)
      // Apply persistent caster state AFTER `pulseAura` populates `ownerCtx.stateBus` so `StateSet` carries `packetStats`!
      this.applyPersistentUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
      const ownCasterStates = this.getPlayerOwnCasterAuraStates113c(player.unitId)
      this.syncFriendlyAuraTargets113c(targets, player.areaId, {
        skipSelfPlayerId: player.unitId,
        selfPlayerCasterStates: ownCasterStates,
      })
      enemyRecords.forEach((m, i) => {
        this.syncAuraEnemyStates113c(m, enemies[i]!)
        const hpAfter = Math.max(0, Math.ceil(enemies[i]!.statList.getHp256() / FIXED_ONE))
        const dealt = m.hp - hpAfter
        if (dealt > 0) {
          this.finishMonsterDamage(player, m, dealt, skill.id, this.resolveSkillDamageChannel(skill.id))
        }
      })
      this.syncHostileAuraPvpEnemies113c(pvpAuraEnemies, 'player', player.unitId)
      corpseRecords.forEach((m, i) => {
        if (corpses[i]!.consumed) this.consumeMonsterCorpse113c(m, 104)
      })
    } else {
      this.applyPersistentUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
    }
    return
  }
  if (skill.auraTgtState !== '' && evalResult.durationFrames > 0) {
    const stateId = stateByName(skill.auraTgtState)
    // 1.13c `#264 Cloak of Shadows` (`SrvDo047` @ `0x6FCB4B10`, #1944):
    // Centers a 30-subtile (`20`-yard) radius on the caster (`player.x, player.y`), applying
    // `state 156` (`cloaked`) with `skill_armor_percent = -min(95, dm12(15, 95, slvl))`
    // while caster receives `state 153` (`cloak_of_shadows`) with `+(10 + 3*(slvl-1))%` defense.
    const radius = skill.id === 264 ? Math.max(30, evalResult.radiusSubtiles) : evalResult.radiusSubtiles
    const originX = skill.id === 264 ? player.x : tx
    const originY = skill.id === 264 ? player.y : ty
    const casterStats = this.playerCombatContext(player).statList
    const stats =
      skill.id === 264
        ? { skill_armor_percent: -Math.min(95, computeDiminishingReturns(15, 95, cast.slvl)) }
        : this.evaluateSkillStateStats(skill, cast.slvl, casterStats)
    for (const m of this.monsters.values()) {
      if (m.dead || m.isNpc || m.submerged || m.areaId !== player.areaId) continue
      if (!FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(stateId) && (m.align !== 0 || this.isMonsterConverted(m))) continue
      const inArea = radius > 0 ? Math.hypot(m.x - originX, m.y - originY) <= radius : m === targetMonster
      if (inArea) {
        if (this.applyMonsterState(m.unitId, stateId, evalResult.durationFrames)) {
          this.monsterCombatContext(m).stateBus.applyState({
            stateNameOrId: stateId,
            sourceUnitId: `player_${player.unitId}`,
            sourceSkillId: skill.id,
            slvl: cast.slvl,
            durationFrames: m.stateTimers.get(stateId) ?? evalResult.durationFrames,
            currentFrame: this.currentFrame,
            stats,
          })
        }
      }
    }
    if (!FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(stateId) && radius > 0) {
      const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
      for (const p of pvp.players) {
        if (Math.hypot(p.x - originX, p.y - originY) <= radius) {
          this.applyPvpDebuffStateToTarget113c(
            { kind: 'player', player: p },
            stateId,
            evalResult.durationFrames,
            `player_${player.unitId}`,
            skill.id,
            cast.slvl,
            stats,
          )
        }
      }
      for (const c of pvp.mercs) {
        if (Math.hypot(c.x - originX, c.y - originY) <= radius) {
          this.applyPvpDebuffStateToTarget113c(
            { kind: 'merc', merc: c },
            stateId,
            evalResult.durationFrames,
            `player_${player.unitId}`,
            skill.id,
            cast.slvl,
            stats,
          )
        }
      }
      for (const entry of pvp.pets) {
        if (Math.hypot(entry.pet.x - originX, entry.pet.y - originY) <= radius) {
          this.applyPvpDebuffStateToTarget113c(
            { kind: 'pet', ...entry },
            stateId,
            evalResult.durationFrames,
            `player_${player.unitId}`,
            skill.id,
            cast.slvl,
            stats,
          )
        }
      }
    }
  }
  if (skill.auraState !== '' && skill.srvDoFunc !== SRVDOFUNC_WHIRLWIND) {
    const stateId = stateByName(skill.auraState)
    // 1.13c Assassin `#258 Burst of Speed` (`state 157` `quickness`) & `#267 Fade` (`state 159` `fade`)
    // mutual exclusion (#1945): activating one clears the other from both `player.states` and `stateBus`.
    if (stateId === 157 || stateId === 159) {
      const oppositeStateId = stateId === 157 ? 159 : 157
      const oppositeStateName = stateId === 157 ? 'fade' : 'quickness'
      const ctx = this.playerCombatContext(player)
      if (player.states.has(oppositeStateId)) {
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          oppositeStateId,
        )
      }
      ctx.stateBus.removeState(oppositeStateId)
      ctx.stateBus.removeState(oppositeStateName)
    }
    if (skill.srvDoFunc === 116) {
      // 1.13c `D2Game.dll` `SKILLS_SrvDo116_Wearwolf_Wearbear` (`0x6FC66210`) + `sub_6FCBEA30`:
      // Clears group-3 shapeshift & charge states (`wolf` 139, `bear` 140, `feralrage` 120, `maul` 117)
      // or `delerium` (177). If the unit was already in `skill.auraState`, toggles off to human form
      // with 0 mana spent (`nocostinstate = 1`) and clamps HP >= 256 (1 HP survival floor).
      const wasInTargetState = player.states.has(stateId)
      const groupStates = stateId === 177 ? [177] : [139, 140, 177, 120, 117]
      const ctx = this.playerCombatContext(player)
      for (const sid of groupStates) {
        if (player.states.has(sid)) {
          this.clearUnitState(
            player.states,
            player.stateTimers,
            'player',
            player.unitId,
            player.areaId,
            sid,
          )
        }
        ctx.stateBus.removeState(sid)
      }
      ctx.stateBus.removeState('wolf')
      ctx.stateBus.removeState('wearwolf')
      ctx.stateBus.removeState('bear')
      ctx.stateBus.removeState('wearbear')
      ctx.stateBus.removeState('delerium')
      ctx.stateBus.removeState('feralrage')
      ctx.stateBus.removeState('maul')
      if (wasInTargetState) {
        this.refreshPlayerAccruedMaxPools(player)
        if (player.hpFixed > 0) {
          player.hpFixed = Math.max(
            FIXED_ONE,
            Math.min(player.hpFixed, this.getPlayerAccruedMaxHpFixed(player)),
          )
          player.hp = Math.max(1, Math.ceil(player.hpFixed / FIXED_ONE))
        }
        return
      }
    }
    const ctx = this.playerCombatContext(player)
    const rawStateStats = this.evaluateSkillStateStats(skill, cast.slvl, ctx.statList)
    if (skill.id === 52 && Math.hypot(player.x - tx, player.y - ty) > 0.5) {
      const targetMerc = [...this.mercenaries.values()].find(
        (m) =>
          m.alive &&
          m.areaId === player.areaId &&
          (m.ownerPlayerId === player.unitId ||
            (player.partyId !== 0xffff && this.players.get(m.ownerPlayerId)?.partyId === player.partyId)) &&
          Math.hypot(m.x - tx, m.y - ty) <= 2.5,
      )
      if (targetMerc !== undefined) {
        const mercCtx = this.mercCombatContext(targetMerc)
        mercCtx.stateBus.applyState({
          stateNameOrId: stateId,
          sourceUnitId: ctx.id,
          sourceSkillId: skill.id,
          slvl: cast.slvl,
          durationFrames: Math.max(0, evalResult.durationFrames),
          currentFrame: this.currentFrame,
          stats: rawStateStats,
        })
        if (evalResult.durationFrames > 0) {
          this.applyUnitState(
            targetMerc.states,
            targetMerc.stateTimers,
            'monster',
            targetMerc.unitId,
            targetMerc.areaId,
            stateId,
            evalResult.durationFrames,
          )
        } else {
          this.applyPersistentUnitState(
            targetMerc.states,
            targetMerc.stateTimers,
            'monster',
            targetMerc.unitId,
            targetMerc.areaId,
            stateId,
          )
        }
        return
      }
    }
    // 1.13c `Bone Armor` (#68, state 14) & `Cyclone Armor` (#235, state 151) (#1793):
    // `Skills.txt` `aurastatcalc1` / `aurastatcalc2` returns `poolPts * 256` (`bonearmor` / `bonearmormax`).
    // Persist the live integer pool on `GameInstance` so consecutive hits deduct from remaining capacity
    // instead of rebuilding `max` on every incoming hit!
    if (skill.id === 68) {
      const rawPool256 = rawStateStats['bonearmor'] ?? 0
      const poolPts =
        rawPool256 >= FIXED_ONE
          ? Math.trunc(rawPool256 / FIXED_ONE)
          : 20 +
            10 * (cast.slvl - 1) +
            15 * ((player.skills.get(78) ?? 0) + (player.skills.get(88) ?? 0))
      this.playerBoneArmorPool.set(player.unitId, { current: poolPts, max: poolPts })
    } else if (skill.id === 235) {
      const rawPool256 = rawStateStats['bonearmor'] ?? 0
      const poolPts =
        rawPool256 >= FIXED_ONE
          ? Math.trunc(rawPool256 / FIXED_ONE)
          : Math.trunc(
              ((40 + 12 * (cast.slvl - 1)) *
                (100 +
                  7 *
                    ((player.skills.get(240) ?? 0) +
                      (player.skills.get(245) ?? 0) +
                      (player.skills.get(250) ?? 0)))) /
                100,
            )
      this.playerCycloneArmorPool.set(player.unitId, { current: poolPts, max: poolPts })
    }
    ctx.stateBus.applyState({
      stateNameOrId: stateId,
      sourceUnitId: ctx.id,
      sourceSkillId: skill.id,
      slvl: cast.slvl,
      durationFrames: Math.max(0, evalResult.durationFrames),
      currentFrame: this.currentFrame,
      stats: rawStateStats,
    })
    if (evalResult.durationFrames > 0) {
      this.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId, evalResult.durationFrames)
    } else {
      this.applyPersistentUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
    }
    this.refreshPlayerAccruedMaxPools(player)
  }
}



/**
 * Move the player for a movement skill (Teleport, Charge, Leap, Leap Attack, Dragon Flight,
 * Whirlwind) to the validated arrival point, sync server motion predictor + seamless area border
 * + AOI room streaming, broadcast authoritative `0x15` re-assign, and optionally relocate
 * followers (`#54 Teleport` / `#275 Dragon Flight`).
 */
function relocatePlayerForSkill(
  this: GameInstanceHost,
  player: InternalPlayerRecord,
  x: number,
  y: number,
  throughWalls: boolean,
  relocateFollowers = false,
): boolean {
  let destX = Math.round(x)
  let destY = Math.round(y)
  if (throughWalls) {
    if (TOWN_AREAS.has(player.areaId)) return false
    if (this.loadedAreas.has(player.areaId)) {
      const stand = findStandableNear(
        (sx, sy) => this.isWorldWalkableForPlayer(player.areaId, sx, sy),
        destX,
        destY,
        5,
      )
      if (stand === null) return false
      destX = stand.x
      destY = stand.y
    } else if (
      this.terrainWalkableCheck !== undefined ||
      this.isBlockedByBonePrison(player.areaId, destX, destY) ||
      this.isClosedDoorAt(player.areaId, destX, destY)
    ) {
      let found: { x: number; y: number; distSq: number } | undefined
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const distSq = dx * dx + dy * dy
          if (found !== undefined && distSq >= found.distSq) continue
          const cx = destX + dx
          const cy = destY + dy
          if (this.isWorldWalkableForPlayer(player.areaId, cx, cy)) {
            found = { x: cx, y: cy, distSq }
          }
        }
      }
      if (found === undefined) return false
      destX = found.x
      destY = found.y
    }
    // 1.13c Levels.txt `Teleport === 2` (Area 73 Duriel's Lair): wall/door LOS blocks Teleport.
    if (
      player.areaId === 73 &&
      !this.isMonsterStepWalkable(player.areaId, player.x, player.y, destX, destY, true)
    ) {
      return false
    }
  } else {
    const path = this.findPlayerPath(player.areaId, Math.round(player.x), Math.round(player.y), destX, destY)
    const last = path[path.length - 1]
    if (last === undefined) return false
    destX = last.x
    destY = last.y
  }
  this.movePlayer(player.unitId, destX, destY)
  this.maybeSwitchPlayerAreaSeamless(player)
  if (this.loadedAreas.has(player.areaId)) {
    this.activatePresetRoomsNearPlayer113c(player)
    this.streamWildernessRoomsForPlayer(player)
    this.revealAreaRoomsNearPlayer(player, true)
  }
  this.broadcastToArea(player.areaId, {
    type: 'UnitReassign',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    at: { x: destX, y: destY },
    x: destX,
    y: destY,
    snap: true,
    areaId: player.areaId,
  })
  if (relocateFollowers) {
    this.relocatePlayerFollowersToPlayer(player, true)
  }
  return true
}



/** Point `standoff` sub-tiles short of (tx, ty) on the line from the player (melee arrival spot). */
function pointBefore(this: GameInstanceHost, player: InternalPlayerRecord, tx: number, ty: number, standoff: number): { x: number; y: number } {
  const dx = tx - player.x
  const dy = ty - player.y
  const dist = Math.hypot(dx, dy)
  if (dist <= standoff) return { x: player.x, y: player.y }
  return { x: tx - (dx / dist) * standoff, y: ty - (dy / dist) * standoff }
}



/**
 * Whirlwind (`srvdofunc` 76): spin along the path to (tx, ty), striking each hostile within melee
 * reach of the path once with the skill's weapon damage.
 */
function resolvePlayerWeaponRangeAdder(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const equipped = player.items.filter(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  const right = equipped.find((i) => i.bodyLoc === BODYLOC_RIGHT_ARM)
  const left = equipped.find((i) => i.bodyLoc === BODYLOC_LEFT_ARM)
  const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
  const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
  const weaponBase = rightBase ?? leftBase
  return weaponBase?.rangeadder ?? 0
}



function isPlayerMeleeInRangeOfMonster(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  fromX = player.x,
  fromY = player.y,
): boolean {
  if (isTentacleHcIdx113c(monster.hcIdx) || isTentacleHeadHcIdx113c(monster.hcIdx)) {
    return isInMeleeRange113c(
      fromX,
      fromY,
      2,
      monster.x,
      monster.y,
      monster.sizeX,
      this.resolvePlayerWeaponRangeAdder(player),
      false,
      null,
      monster.hcIdx,
    )
  }
  return Math.hypot(monster.x - fromX, monster.y - fromY) <= PLAYER_MELEE_REACH_SUBTILES
}



/**
 * Resolve cached 1.13c `MonStats.txt` + `MonStats2.txt` flags (`corpseSel`, `soft`, `isAtt`,
 * `align`, `boss`, `primeevil`, `killable`) for corpse-targeting (`D2Common.#11018` / `#11019`)
 * and conversion (`#273 Mind Blast`, `#116 Conversion`).
 */
function resolveMonsterTableFlags113c(this: GameInstanceHost, monster: InternalMonsterRecord): {
  readonly corpseSel: boolean
  readonly soft: boolean
  readonly isAtt: boolean
  readonly align: number
  readonly monStatsBoss: boolean
  readonly primeevil: boolean
  readonly killable: boolean
} {
  const cacheKey = `${monster.hcIdx}:${monster.defId.toLowerCase()}`
  const cached = this.monTableFlagsCache.get(cacheKey)
  if (cached !== undefined) return cached

  const monStats =
    this.registry.monStatsByHcIdx.get(monster.hcIdx) ??
    this.registry.monStatsById.get(monster.defId.toLowerCase())
  const monStats2 =
    monStats !== undefined && monStats.monStatsEx !== ''
      ? this.registry.monStats2ById.get(monStats.monStatsEx.toLowerCase())
      : undefined
  const raw = monStats2?.raw
  const parseMonStats2Flag = (
    colCamel: string,
    colLower: string,
    missingRowFallback: boolean,
  ): boolean => {
    if (raw === undefined) return missingRowFallback
    const val = raw[colCamel] ?? raw[colLower]
    if (val === undefined || val.trim() === '') return false
    return Number(val) !== 0
  }
  const flags = {
    corpseSel: parseMonStats2Flag('corpseSel', 'corpsesel', true),
    soft: parseMonStats2Flag('soft', 'soft', true),
    isAtt: parseMonStats2Flag('isAtt', 'isatt', true),
    align: monStats?.align ?? 0,
    monStatsBoss: Boolean(monStats?.boss),
    primeevil: Boolean(monStats?.primeevil),
    killable: monStats !== undefined ? Boolean(monStats.killable) : true,
  }
  this.monTableFlagsCache.set(cacheKey, flags)
  return flags
}



/**
 * True Act / Quest Boss check (`MonStats.boss == 1`, `primeevil == 1`, `rank === 'boss'`, or
 * `actBossQuestId !== undefined`). Note `spawnMonster` sets `monster.isBoss = true` on `rank === 'unique'`
 * packs too, whereas in 1.13c Random Uniques and Travincal Council SuperUniques (`MonStats.boss == 0`,
 * `corpseSel == 1`) ARE valid targets for `#131 Find Potion` and `#142 Find Item`!
 */
function isTrueBossForCorpse113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  flags = this.resolveMonsterTableFlags113c(monster),
): boolean {
  return (
    monster.rank === 'boss' ||
    monster.isPrimeEvil ||
    flags.primeevil ||
    flags.monStatsBoss ||
    this.actBossQuestId(monster.defId, monster.hcIdx) !== undefined ||
    (monster.isBoss && monster.rank !== 'unique')
  )
}



/**
 * 1.13c corpse eligibility (`D2Common.#11018` when `requireSoft = true` for `#131 Find Potion` /
 * `#150 Grim Ward`; `D2Common.#11019` when `requireSoft = false` for `#142 Find Item`, `#74 CE`,
 * `#124 Redemption`, and `#70/#80/#95` Summons).
 */
function canSelectMonsterCorpse113c(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  requireSoft: boolean,
): boolean {
  if (
    !monster.dead ||
    monster.shattered ||
    monster.corpseConsumed ||
    monster.isNpc ||
    !monster.isKillable ||
    monster.states.has(104) ||
    monster.states.has(118)
  ) {
    return false
  }
  const flags = this.resolveMonsterTableFlags113c(monster)
  if (!flags.killable || !flags.corpseSel || this.isTrueBossForCorpse113c(monster, flags)) {
    return false
  }
  if (requireSoft && !flags.soft) {
    return false
  }
  return true
}



function findNearestSelectableCorpse113c(this: GameInstanceHost, 
  areaId: number,
  tx: number,
  ty: number,
  requireSoft: boolean,
  explicitTarget?: InternalMonsterRecord,
): InternalMonsterRecord | undefined {
  if (explicitTarget !== undefined) {
    return explicitTarget.areaId === areaId &&
      this.canSelectMonsterCorpse113c(explicitTarget, requireSoft)
      ? explicitTarget
      : undefined
  }
  let bestCorpse: InternalMonsterRecord | undefined
  let bestDist = Number.POSITIVE_INFINITY
  const maxSearchDist = Math.max(PLAYER_MELEE_REACH_SUBTILES, 12)
  for (const m of this.monsters.values()) {
    if (m.areaId !== areaId || !this.canSelectMonsterCorpse113c(m, requireSoft)) continue
    const d = Math.hypot(m.x - tx, m.y - ty)
    if (d <= maxSearchDist && d < bestDist) {
      bestDist = d
      bestCorpse = m
    }
  }
  return bestCorpse
}



/**
 * Single-use 1.13c corpse consumption (`STATE_CORPSE_NOSELECT = 118` or `STATE_REDEEMED = 104`):
 * locks the corpse across `#131 Find Potion`, `#142 Find Item`, `#150 Grim Ward`, `#74 CE`,
 * `#124 Redemption`, `#70/#80/#95` Summons, and Shaman resurrection, and notifies clients.
 */
function consumeMonsterCorpse113c(this: GameInstanceHost, corpse: InternalMonsterRecord, stateId: 104 | 118 = 118): void {
  corpse.corpseConsumed = true
  corpse.shattered = true
  this.applyPersistentUnitState(
    corpse.states,
    corpse.stateTimers,
    'monster',
    corpse.unitId,
    corpse.areaId,
    stateId,
  )
  this.broadcastToArea(corpse.areaId, {
    type: 'UnitRemove',
    unitType: 1,
    id: corpse.unitId,
    unitId: corpse.unitId,
    areaId: corpse.areaId,
  })
}



/**
 * `#1809` — Barbarian `Find Potion (#131)` (`SrvSt33` @ `0x6FC47270`, `SrvDo069` @ `0x6FC47600`):
 * consumes a soft non-boss corpse, rolls `dm12(0, 100)` (`15%` slvl 1, `67%` slvl 10, `84%` slvl 20)
 * and `60% Healing / 30% Mana / 10% Rejuvenation` tier by act & difficulty, spawning 1 potion at `(corpse.x, corpse.y)`.
 */
function executeFindPotion(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  corpse: InternalMonsterRecord,
): void {
  this.consumeMonsterCorpse113c(corpse, 118)
  const actIndex = Math.max(0, Math.min(4, areaToAct(player.areaId)))
  const rollRes = rollFindPotionDrop113c(
    cast.slvl,
    actIndex,
    this.difficulty,
    this.rng.rand(100),
    this.rng.rand(100),
  )
  if (!rollRes.dropped || rollRes.potionCode === null) return
  const pot = this.createQuestDropItem(rollRes.potionCode, Math.max(1, corpse.level))
  if (pot !== undefined) {
    this.spawnDroppedItems([pot], corpse.areaId, corpse.x, corpse.y)
  }
}



/**
 * `#1810` — Barbarian `Find Item (#142)` (`SrvSt34` @ `0x6FC47240`, `SrvDo072` @ `0x6FC476D0`):
 * consumes a non-boss corpse (`soft == 0` skeletons included), rolls `dm12(5, 60)` (`13%` slvl 1,
 * `42%` slvl 10, `51%` slvl 20; 0 Find Potion synergy in 1.13c), and on success executes the
 * monster's `TreasureClassEx` (`Normal` / `Champion` / `Unique` / `SuperUnique`) with `NoDrop = 0`
 * (`ignoreNoDrop: true`) and the Barbarian's active weapon-hand `%MF` (`80`) & `%GF` (`79`).
 */
function executeFindItem(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  corpse: InternalMonsterRecord,
): void {
  this.consumeMonsterCorpse113c(corpse, 118)
  const { dropChancePct } = calculateFindItemStats(cast.slvl)
  if (this.rng.rand(100) >= dropChancePct) return
  const tables = getEmbeddedDropTables()
  const difficulty =
    this.difficulty === 2 ? 'hell' : this.difficulty === 1 ? 'nightmare' : 'normal'
  const items = generateMonsterHorkDrop113c({
    dropTables: tables,
    difficulty,
    x: corpse.x,
    y: corpse.y,
    subjectId: corpse.defId,
    monsterIndex: corpse.unitId,
    monsterLevel: corpse.level,
    monsterRank: corpse.rank,
    ...(corpse.superUniqueId !== undefined ? { superUniqueId: corpse.superUniqueId } : {}),
    playerMf: this.sumPlayerItemStat(player, 80),
    playerGf: this.sumPlayerItemStat(player, 79),
    gamePlayers: this.playersX,
    partyPlayers: this.countPartyPlayersInArea(player, player.areaId),
    ...(corpse.monsterPlayerCount !== undefined
      ? { monsterPlayerCount: corpse.monsterPlayerCount }
      : {}),
    seed: this.rng.rand(0x7fffffff) || 1,
    spawnedUniqueIds: this.spawnedUniqueIds,
  })
  if (items.length > 0) {
    this.spawnDroppedItems(items, corpse.areaId, corpse.x, corpse.y)
  }
}



/**
 * `#1881` — Barbarian `Grim Ward (#150)` (`SrvSt33` + `SrvDo075` @ `0x6FC47C90`):
 * Consumes a soft non-boss corpse (`state 104` + `state 118`), spawns a persistent Grim Ward
 * totem object + stationary visual totem missile (`250/253/256` `grimwardsmall/medium/large`)
 * for `Param3 = 1000` frames (`40s`), and pulses `STATE_TERROR` (`state 56`) every `25` frames
 * within `3 + (slvl - 1)` sub-tiles on eligible normal monsters so they flee away from the ward.
 */
function executeGrimWard(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  corpse: InternalMonsterRecord,
): void {
  this.consumeMonsterCorpse113c(corpse, 104)
  corpse.states.add(118)
  const stats = computeGrimWardStats113c(cast.slvl)
  const wx = Math.round(corpse.x)
  const wy = Math.round(corpse.y)
  const objectUnitId = this.spawnObject({
    classId: 0,
    x: wx,
    y: wy,
    areaId: corpse.areaId,
    mode: 1,
  })
  const totemMissileId = corpse.sizeX <= 1 ? 250 : corpse.sizeX === 2 ? 253 : 256
  const totemMissileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  this.broadcastToArea(corpse.areaId, {
    type: 'CreateMissile',
    missileId: totemMissileUnitId,
    missileClassId: totemMissileId,
    at: { x: wx, y: wy },
    target: { x: wx, y: wy },
    x: wx,
    y: wy,
    targetX: wx,
    targetY: wy,
    skillId: 150,
    level: cast.slvl,
    ownerType: 0,
    ownerUnitType: 'player',
    ownerId: player.unitId,
    areaId: corpse.areaId,
  } as ServerEvent)
  const ward = {
    objectUnitId,
    ownerPlayerId: player.unitId,
    areaId: corpse.areaId,
    x: corpse.x,
    y: corpse.y,
    slvl: cast.slvl,
    radiusSubtiles: stats.radiusSubtiles,
    fleeDurationFrames: stats.fleeDurationFrames,
    expireFrame: this.currentFrame + stats.durationFrames,
    nextPulseFrame: this.currentFrame + stats.pulseIntervalFrames,
  }
  this.activeGrimWards.set(objectUnitId, ward)
  this.pulseGrimWard113c(ward)
}



function pulseGrimWard113c(this: GameInstanceHost, ward: {
  readonly objectUnitId: number
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly slvl: number
  readonly radiusSubtiles: number
  readonly fleeDurationFrames: number
}): void {
  for (const m of this.monsters.values()) {
    if (m.dead || m.isNpc || m.submerged || m.areaId !== ward.areaId) continue
    if (m.align !== 0 || this.isMonsterConverted(m)) continue
    if (!this.isMonsterEligibleForConversion113c(m)) continue
    if (Math.hypot(m.x - ward.x, m.y - ward.y) <= ward.radiusSubtiles) {
      this.applyUnitState(
        m.states,
        m.stateTimers,
        'monster',
        m.unitId,
        m.areaId,
        STATE_TERROR_113C,
        ward.fleeDurationFrames,
      )
      m.fleeTicks = Math.max(m.fleeTicks, ward.fleeDurationFrames)
      m.fleeOriginX = ward.x
      m.fleeOriginY = ward.y
      m.fleeTargetX = Number.NaN
      m.fleeTargetY = Number.NaN
    }
  }
}



function stepGrimWards113c(this: GameInstanceHost): void {
  for (const ward of [...this.activeGrimWards.values()]) {
    if (this.currentFrame >= ward.expireFrame) {
      this.activeGrimWards.delete(ward.objectUnitId)
      this.objects.delete(ward.objectUnitId)
      this.broadcastToArea(ward.areaId, {
        type: 'UnitRemove',
        unitType: 2,
        id: ward.objectUnitId,
        unitId: ward.objectUnitId,
        areaId: ward.areaId,
      })
      continue
    }
    if (this.currentFrame >= ward.nextPulseFrame) {
      ward.nextPulseFrame = this.currentFrame + 25
      this.pulseGrimWard113c(ward)
    }
  }
}



function getActiveGrimWards113c(this: GameInstanceHost): ReadonlyArray<{
  readonly objectUnitId: number
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly slvl: number
  readonly radiusSubtiles: number
  readonly fleeDurationFrames: number
  readonly expireFrame: number
}> {
  return [...this.activeGrimWards.values()]
}



function resolvePlayerBladeWeaponDamage113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly min: number
  readonly max: number
  readonly isTwoHanded: boolean
} {
  const { right, left } = this.activeHandItems113c(player)
  const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
  const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
  const weapon = rightBase ? right : leftBase ? left : undefined
  const base = rightBase ?? leftBase
  const otherHand = weapon === right ? left : right
  const isTwoHanded = Boolean(
    base?.twoHanded &&
      base.twoHandedMindam !== undefined &&
      base.twoHandedMaxdam !== undefined &&
      (!base.oneOrTwoHanded || otherHand === undefined),
  )
  const dmg = this.resolvePlayerWeaponDamage(player, 0)
  return {
    min: dmg.min,
    max: dmg.max,
    isTwoHanded,
  }
}



/**
 * `#1884` — 1.13c `#277 Blade Shield` (`SrvDo054`) consumes weapon durability on landed pulses,
 * whereas `#266 Blade Fury` and `#257 Blade Sentinel` never degrade weapon durability!
 */
function degradeEquippedWeaponDurabilityOnHit113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  const { right, left } = this.activeHandItems113c(player)
  const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
  const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
  const weapon = rightBase ? right : leftBase ? left : undefined
  if (weapon === undefined || weapon.maxDurability <= 0 || weapon.durability <= 0) return
  const itemStats = collectItemStats(weapon)
  if (itemStats.some((s) => s.statId === 152 && s.value > 0)) return
  const nextDur = Math.max(0, weapon.durability - 1)
  weapon.durability = nextDur
  weapon.stats.set(72, nextDur)
  if (weapon.rawItemData !== undefined) {
    ;(weapon.rawItemData as { durability?: number }).durability = nextDur
  }
}



function activateBladeShieldState113c(this: GameInstanceHost, player: InternalPlayerRecord, slvl: number): void {
  const bsh = calcBladeShield113c(slvl)
  this.applyUnitState(
    player.states,
    player.stateTimers,
    'player',
    player.unitId,
    player.areaId,
    STATE_BLADESHIELD_113C,
    bsh.durationFrames,
  )
  this.playerCombatContext(player).stateBus.applyState({
    stateNameOrId: STATE_BLADESHIELD_113C,
    sourceUnitId: `player_${player.unitId}`,
    sourceSkillId: 277,
    slvl,
    durationFrames: bsh.durationFrames,
    currentFrame: this.currentFrame,
  })
  this.activeBladeShields.set(player.unitId, {
    slvl,
    expireFrame: this.currentFrame + bsh.durationFrames,
    nextPulseFrame: this.currentFrame + bsh.perDelayFrames,
  })
}



function stepBladeShields113c(this: GameInstanceHost): void {
  for (const [playerId, bs] of [...this.activeBladeShields.entries()]) {
    const player = this.players.get(playerId)
    if (!player || player.dead) {
      this.activeBladeShields.delete(playerId)
      continue
    }
    if (this.currentFrame >= bs.expireFrame || !player.states.has(STATE_BLADESHIELD_113C)) {
      if (player.states.has(STATE_BLADESHIELD_113C)) {
        this.clearUnitState(
          player.states,
          player.stateTimers,
          'player',
          player.unitId,
          player.areaId,
          STATE_BLADESHIELD_113C,
        )
      }
      this.playerCombat.get(playerId)?.stateBus.removeState(STATE_BLADESHIELD_113C)
      this.activeBladeShields.delete(playerId)
      continue
    }
    if (this.currentFrame < bs.nextPulseFrame) continue
    bs.nextPulseFrame = this.currentFrame + 25
    const w = this.resolvePlayerBladeWeaponDamage113c(player)
    const calc = calcBladeShield113c(bs.slvl, w.min, w.max)
    for (const m of [...this.monsters.values()]) {
      if (
        m.dead ||
        m.isNpc ||
        m.submerged ||
        m.align !== 0 ||
        m.areaId !== player.areaId ||
        this.isMonsterConverted(m)
      ) {
        continue
      }
      if (Math.hypot(m.x - player.x, m.y - player.y) > calc.radiusSubtiles) continue
      const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
      this.applyDamageToMonster(player, m, dmg, 277, 'phys', 'player', {
        attackKind: 'melee',
        bladeShieldPulse: true,
      })
    }
    const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
    for (const p of pvp.players) {
      if (Math.hypot(p.x - player.x, p.y - player.y) > calc.radiusSubtiles) continue
      const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
      if (
        this.applyPvpHitToTarget113c(
          player,
          { kind: 'player', player: p },
          { skillId: 277, physDamage: dmg, attackKind: 'melee' },
        )
      ) {
        this.degradeEquippedWeaponDurabilityOnHit113c(player)
      }
    }
    for (const c of pvp.mercs) {
      if (Math.hypot(c.x - player.x, c.y - player.y) > calc.radiusSubtiles) continue
      const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
      if (
        this.applyPvpHitToTarget113c(
          player,
          { kind: 'merc', merc: c },
          { skillId: 277, physDamage: dmg, attackKind: 'melee' },
        )
      ) {
        this.degradeEquippedWeaponDurabilityOnHit113c(player)
      }
    }
    for (const entry of pvp.pets) {
      if (Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) > calc.radiusSubtiles) continue
      const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
      if (
        this.applyPvpHitToTarget113c(
          player,
          { kind: 'pet', ...entry },
          { skillId: 277, physDamage: dmg, attackKind: 'melee' },
        )
      ) {
        this.degradeEquippedWeaponDurabilityOnHit113c(player)
      }
    }
  }
}



function launchBladeFuryShot113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
): void {
  const missileRec = cast.missile ?? this.registry.getMissileByName('bladefury1')
  if (missileRec === undefined) return
  const w = this.resolvePlayerBladeWeaponDamage113c(player)
  const calc = calcBladeFury113c(cast.slvl, w.min, w.max, w.isTwoHanded)
  const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
  this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, dmg, {
    bladeWeaponHit: true,
  })
}



function stepBladeFuryChannels113c(this: GameInstanceHost): void {
  for (const [playerId, ch] of [...this.activeBladeFuryChannels.entries()]) {
    const player = this.players.get(playerId)
    if (
      !player ||
      player.dead ||
      !player.states.has(12) ||
      this.playerChannelSkillId.get(playerId) !== 266
    ) {
      this.activeBladeFuryChannels.delete(playerId)
      continue
    }
    if (this.currentFrame < ch.nextAutoShotFrame) continue
    const cast = this.resolvePlayerSkillCast(player, 266)
    if (
      cast === null ||
      (cast.chargeItem === undefined &&
        !cast.isNoCostInState &&
        player.manaFixed < cast.evalResult.manaCost256)
    ) {
      this.clearPlayerChannelState(player)
      continue
    }
    if (ch.hold) {
      this.updatePlayerChannelState(player, cast)
    }
    this.commitPlayerSkillCast(player, cast)
    this.broadcastPlayerSkillCast(player, cast, {
      x: Math.round(ch.tx),
      y: Math.round(ch.ty),
    })
    this.launchBladeFuryShot113c(player, cast, ch.tx, ch.ty)
    ch.lastShotFrame = this.currentFrame
    ch.nextAutoShotFrame = this.currentFrame + 5
  }
}



function executeBladeSentinel113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
): void {
  const outcome = this.summonPet(player.unitId, {
    skillId: 257,
    slvl: cast.slvl,
    x: tx,
    y: ty,
  })
  const w = this.resolvePlayerBladeWeaponDamage113c(player)
  const calc = calcBladeSentinel113c(cast.slvl, w.min, w.max, w.isTwoHanded)
  const dmg = Math.max(1, this.rollInclusive(calc.totalMin, calc.totalMax))
  const mRec = this.registry.getMissileById(392) ?? cast.missile
  const rawVel = mRec !== undefined ? mRec.vel + Math.trunc((mRec.velLev * cast.slvl) / 8) : 12
  const baseSpeed = rawVel > 0 ? missileSpeedSubtilesPerFrame113c(rawVel) : 0.75
  const speed = player.states.has(STATE_SLOWMISSILES_113C) ? baseSpeed * 0.33 : baseSpeed
  const sameSpot = Math.hypot(tx - player.x, ty - player.y) < 0.5
  const effTx = sameSpot ? player.x + 4 : tx
  const effTy = sameSpot ? player.y : ty
  const missileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const missile: InternalMissileRecord = {
    unitId: missileUnitId,
    missileId: mRec?.id ?? 392,
    skillId: 257,
    ownerType: 'player',
    ownerId: player.unitId,
    areaId: player.areaId,
    x: player.x,
    y: player.y,
    vx: 0,
    vy: 0,
    damage: dmg,
    physDamage: dmg,
    elemDamage: 0,
    elemDurationFrames: 0,
    element: 'phys',
    remainingFrames: calc.rangeFrames,
    collideType: mRec?.collideType ?? 3,
    size: Math.max(1, mRec?.size ?? 2),
    pierce: true,
    nextHit: true,
    nextDelay: calc.nextDelayFrames,
    hitCooldowns: new Map(),
    guaranteedHit: false,
    bladeWeaponHit: true,
    patrolState: {
      x: player.x,
      y: player.y,
      originX: player.x,
      originY: player.y,
      targetX: effTx,
      targetY: effTy,
      headingToTarget: true,
      speed,
    },
    trapOwnerPlayerId: player.unitId,
    ...(outcome.pet !== undefined ? { trapPetUid: outcome.pet.uid } : {}),
  }
  missile.createdFrame = this.currentFrame
  this.missiles.set(missileUnitId, missile)
  this.broadcastToArea(player.areaId, {
    type: 'CreateMissile',
    missileId: missileUnitId,
    missileClassId: missile.missileId,
    at: { x: Math.round(player.x), y: Math.round(player.y) },
    target: { x: Math.round(effTx), y: Math.round(effTy) },
    x: Math.round(player.x),
    y: Math.round(player.y),
    targetX: Math.round(effTx),
    targetY: Math.round(effTy),
    skillId: 257,
    level: cast.slvl,
    ownerType: 0,
    ownerUnitType: 'player',
    ownerId: player.unitId,
    areaId: player.areaId,
  } as ServerEvent)
}



function executeBoneWall113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
): void {
  const stats = calculateBoneWallStats(
    cast.slvl,
    {
      boneArmor: player.skills.get(68) ?? 0,
      bonePrison: player.skills.get(88) ?? 0,
    },
    this.difficulty,
  )
  const segHp = Math.max(1, stats.hp113c)
  const positions = computeBoneWallSegmentPositions113c(player.x, player.y, tx, ty)
  for (const seg of positions) {
    if (
      this.isClosedDoorAt(player.areaId, seg.x, seg.y) ||
      (this.terrainWalkableCheck !== undefined &&
        !this.terrainWalkableCheck(player.areaId, seg.x, seg.y, false))
    ) {
      continue
    }
    let duplicateCell = false
    for (const m of this.monsters.values()) {
      if (
        !m.dead &&
        m.areaId === player.areaId &&
        isBonePrisonMonsterHcIdx113c(m.hcIdx) &&
        Math.hypot(m.x - seg.x, m.y - seg.y) < 0.5
      ) {
        duplicateCell = true
        break
      }
    }
    if (duplicateCell) continue
    this.spawnMonster({
      classId: 344,
      hcIdx: 344,
      defId: 'bonewall',
      name: 'Bone Wall',
      ai: 'BoneWall',
      x: seg.x,
      y: seg.y,
      areaId: player.areaId,
      level: player.level,
      hp: segHp,
      maxHp: segHp,
      unscaledMaxHp: segHp,
      experience: 0,
      noRatio: true,
      velocity: 0,
      runSpeed: 0,
      isKillable: true,
      despawnAtFrame: this.currentFrame + stats.durationFrames,
      boneConstructOwnerPlayerId: player.unitId,
    })
  }
}



function executeBonePrison113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  targetX: number,
  targetY: number,
): void {
  const stats = calculateBonePrisonStats(
    cast.slvl,
    {
      boneArmor: player.skills.get(68) ?? 0,
      boneWall: player.skills.get(78) ?? 0,
    },
    this.difficulty,
  )
  const segHp = Math.max(1, stats.hp113c)
  const positions = computeBonePrisonRingPositions113c(targetX, targetY)
  for (const seg of positions) {
    if (
      this.isClosedDoorAt(player.areaId, seg.x, seg.y) ||
      (this.terrainWalkableCheck !== undefined &&
        !this.terrainWalkableCheck(player.areaId, seg.x, seg.y, false))
    ) {
      continue
    }
    let duplicateCell = false
    for (const m of this.monsters.values()) {
      if (
        !m.dead &&
        m.areaId === player.areaId &&
        isBonePrisonMonsterHcIdx113c(m.hcIdx) &&
        Math.hypot(m.x - seg.x, m.y - seg.y) < 0.5
      ) {
        duplicateCell = true
        break
      }
    }
    if (duplicateCell) continue
    this.spawnMonster({
      classId: 344,
      hcIdx: 344,
      defId: 'bonewall',
      name: 'Bone Prison',
      ai: 'BoneWall',
      x: seg.x,
      y: seg.y,
      areaId: player.areaId,
      level: player.level,
      hp: segHp,
      maxHp: segHp,
      unscaledMaxHp: segHp,
      experience: 0,
      noRatio: true,
      velocity: 0,
      runSpeed: 0,
      isKillable: true,
      despawnAtFrame: this.currentFrame + stats.durationFrames,
      boneConstructOwnerPlayerId: player.unitId,
    })
  }
}



function executeSlowMissiles113c(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast): void {
  const sm = computeSlowMissilesStats113c(cast.slvl)
  const stateStats = { lightradius: 5, skill_handofathena: -67 }
  for (const m of this.monsters.values()) {
    if (
      m.dead ||
      m.isNpc ||
      m.align !== 0 ||
      m.submerged ||
      m.areaId !== player.areaId ||
      this.isMonsterConverted(m)
    ) {
      continue
    }
    if (Math.hypot(m.x - player.x, m.y - player.y) > sm.radiusSubtiles) continue
    this.applyUnitState(
      m.states,
      m.stateTimers,
      'monster',
      m.unitId,
      m.areaId,
      sm.stateId,
      sm.durationFrames,
    )
    this.monsterCombatContext(m).stateBus.applyState({
      stateNameOrId: sm.stateId,
      sourceUnitId: `player_${player.unitId}`,
      sourceSkillId: 17,
      slvl: cast.slvl,
      durationFrames: sm.durationFrames,
      currentFrame: this.currentFrame,
      stats: stateStats,
    })
  }
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  for (const p of pvp.players) {
    if (Math.hypot(p.x - player.x, p.y - player.y) > sm.radiusSubtiles) continue
    this.applyPvpDebuffStateToTarget113c(
      { kind: 'player', player: p },
      sm.stateId,
      sm.durationFrames,
      `player_${player.unitId}`,
      17,
      cast.slvl,
      stateStats,
    )
  }
  for (const c of pvp.mercs) {
    if (Math.hypot(c.x - player.x, c.y - player.y) > sm.radiusSubtiles) continue
    this.applyPvpDebuffStateToTarget113c(
      { kind: 'merc', merc: c },
      sm.stateId,
      sm.durationFrames,
      `player_${player.unitId}`,
      17,
      cast.slvl,
      stateStats,
    )
  }
  for (const entry of pvp.pets) {
    if (Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) > sm.radiusSubtiles) continue
    this.applyPvpDebuffStateToTarget113c(
      { kind: 'pet', ...entry },
      sm.stateId,
      sm.durationFrames,
      `player_${player.unitId}`,
      17,
      cast.slvl,
      stateStats,
    )
  }
}



function computePlayerVengeanceWeaponBase113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly vMin: number
  readonly vMax: number
  readonly griefFlat: number
  readonly physDamagePct: number
} {
  const { right, left } = this.activeHandItems113c(player)
  const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
  const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
  const weapon = rightBase ? right : leftBase ? left : undefined
  const base = rightBase ?? leftBase
  const combat = this.playerCombat.get(player.unitId)
  const offWeaponItemEd =
    this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
    this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true })
  const offWeapFlatMinNoGrief = this.sumPlayerItemStat(player, STAT_MINDAMAGE, {
    excludeWeaponHands: true,
  })
  const offWeapFlatMaxNoGrief = this.sumPlayerItemStat(player, STAT_MAXDAMAGE, {
    excludeWeaponHands: true,
  })
  const griefFlat = this.sumPlayerItemStat(player, 111)
  const totalStr =
    player.strength +
    this.sumPlayerItemStat(player, 0) +
    (combat === undefined ? 0 : combat.statList.getModifierBonus('strength'))
  const totalDex =
    player.dexterity +
    this.sumPlayerItemStat(player, 2) +
    (combat === undefined ? 0 : combat.statList.getModifierBonus('dexterity'))
  if (weapon === undefined || base === undefined) {
    const unarmed = getAttackWeaponInfo(null)
    const vMin = Math.max(1, unarmed.damageMin + offWeapFlatMinNoGrief)
    const vMax = Math.max(vMin, unarmed.damageMax + offWeapFlatMaxNoGrief)
    return {
      vMin,
      vMax,
      griefFlat,
      physDamagePct: offWeaponItemEd + totalStr,
    }
  }
  const otherHand = weapon === right ? left : right
  const useTwoHand =
    base.twoHanded &&
    base.twoHandedMindam !== undefined &&
    base.twoHandedMaxdam !== undefined &&
    (!base.oneOrTwoHanded || otherHand === undefined)
  const rawMin = useTwoHand ? base.twoHandedMindam! : base.mindam
  const rawMax = useTwoHand ? base.twoHandedMaxdam! : base.maxdam
  const isEth = Boolean(
    weapon.ethereal || ((weapon.rawItemData?.flags ?? 0) & 0x00400000) !== 0,
  )
  const ethMin = isEth ? Math.floor((rawMin * 3) / 2) : rawMin
  const ethMax = isEth ? Math.floor((rawMax * 3) / 2) : rawMax
  let onWeaponEd = 0
  let flatMin = offWeapFlatMinNoGrief
  let flatMax = offWeapFlatMaxNoGrief
  for (const stat of collectItemStats(weapon)) {
    if (stat.statId === STAT_ITEM_MAXDAMAGE_PERCENT) onWeaponEd += stat.value
    else if (stat.statId === 219) onWeaponEd += (stat.value * player.level) >> 3
    else if (stat.statId === (useTwoHand ? STAT_SECONDARY_MINDAMAGE : STAT_MINDAMAGE)) {
      flatMin += stat.value
    } else if (stat.statId === (useTwoHand ? STAT_SECONDARY_MAXDAMAGE : STAT_MAXDAMAGE)) {
      flatMax += stat.value
    } else if (stat.statId === 218) {
      flatMax += (stat.value * player.level) >> 3
    }
  }
  const statBonusPercent =
    Math.trunc((totalStr * base.strBonus) / 100) +
    Math.trunc((totalDex * base.dexBonus) / 100)
  const vMin = Math.max(1, Math.trunc((ethMin * (100 + onWeaponEd)) / 100) + flatMin)
  const vMax = Math.max(vMin, Math.trunc((ethMax * (100 + onWeaponEd)) / 100) + flatMax)
  return {
    vMin,
    vMax,
    griefFlat,
    physDamagePct: offWeaponItemEd + statBonusPercent,
  }
}



function executePaladinVengeance113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  const wBase = this.computePlayerVengeanceWeaponBase113c(player)
  const weaponBaseRolled = this.rollInclusive(wBase.vMin, wBase.vMax)
  const vStats = calculateVengeanceStats(cast.slvl, {
    resistFire: player.skills.get(100) ?? 0,
    resistCold: player.skills.get(105) ?? 0,
    resistLightning: player.skills.get(110) ?? 0,
    salvation: player.skills.get(125) ?? 0,
  })
  this.applyDamageToMonster(player, monster, weaponBaseRolled, 111, 'phys', 'player', {
    attackKind: 'melee',
    toHitBonusPct: vStats.toHitBonusPct,
    elemDurationFrames: vStats.chillDurationFrames,
    vengeanceSpec: {
      weaponBaseRolled,
      physDamagePct: wBase.physDamagePct,
      griefFlat: wBase.griefFlat,
      multiElemPacket: {
        firePct: vStats.firePct,
        coldPct: vStats.coldPct,
        ltngPct: vStats.ltngPct,
        chillDurationFrames: vStats.chillDurationFrames,
      },
    },
  })
}



function isPlayerWhirlwinding113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  return this.playerWhirlwindStates.has(player.unitId)
}



function collectWhirlwindWeaponHandStats113c(this: GameInstanceHost, item: ServerItemEntry): ItemStat[] {
  const out: ItemStat[] = []
  if (
    item.rawItemData !== undefined &&
    item.rawItemData.stats.length + (item.rawItemData.runewordStats?.length ?? 0) > 0
  ) {
    out.push(...item.rawItemData.stats)
    if (item.rawItemData.runewordStats !== undefined) {
      out.push(...item.rawItemData.runewordStats)
    }
    if (item.stats && item.stats.size > 0) {
      const covered = new Set<number>(out.map((s) => s.statId))
      for (const [statId, value] of item.stats) {
        if (!covered.has(statId)) {
          out.push({ statId, param: 0, value })
        }
      }
    }
  } else if (item.stats && item.stats.size > 0) {
    for (const [statId, value] of item.stats) {
      out.push({ statId, param: 0, value })
    }
  }
  if (Array.isArray(item.socketedItems)) {
    for (const sock of item.socketedItems) {
      out.push(...this.collectWhirlwindWeaponHandStats113c(sock))
    }
  }
  return out
}



function resolveWhirlwindEquippedHandsForPlayer113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly primaryHand: WhirlwindHandWeaponSpec113c
  readonly secondaryHand: WhirlwindHandWeaponSpec113c | null
} | null {
  const equipped = player.items.filter(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  const right = equipped.find((i) => i.bodyLoc === BODYLOC_RIGHT_ARM)
  const left = equipped.find((i) => i.bodyLoc === BODYLOC_LEFT_ARM)
  const toInput = (entry: ServerItemEntry | undefined): WhirlwindEquippedHandInput113c | undefined =>
    entry === undefined
      ? undefined
      : {
          unitId: entry.unitId,
          code: entry.code,
          bodyLoc: entry.bodyLoc,
          stats: this.collectWhirlwindWeaponHandStats113c(entry),
        }
  return resolveWhirlwindWeaponHands113c(toInput(right), toInput(left))
}



/**
 * `#1811` — Initiate continuous multi-frame 1.13c Whirlwind (`#151`, `SrvSt38` / `SrvDo076`).
 */
function executeWhirlwind(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
): void {
  const hands = this.resolveWhirlwindEquippedHandsForPlayer113c(player)
  if (hands === null) return
  const areaId = player.areaId
  const spin = createWhirlwindSpinState113c({
    skillId: cast.skill.id,
    slvl: cast.slvl,
    areaId,
    startFrame: this.currentFrame,
    startX: player.x,
    startY: player.y,
    targetX: tx,
    targetY: ty,
    primaryHand: hands.primaryHand,
    secondaryHand: hands.secondaryHand,
    isSubTileBlocked: this.terrainWalkableCheck
      ? (sx, sy) => this.isPlayerSubTileBlocked(areaId, sx, sy)
      : null,
  })
  if (spin === null) return

  this.playerWhirlwindStates.set(player.unitId, spin)
  player.mode = 18
  player.targetX = spin.destX
  player.targetY = spin.destY
  const motion = this.playerMotion.get(player.unitId)
  if (motion !== undefined) {
    motion.mover.setPosition(player.x, player.y)
    motion.x = player.x
    motion.y = player.y
    motion.moving = false
    motion.plannedX = Number.NaN
    motion.plannedY = Number.NaN
  }
  this.applyPersistentUnitState(
    player.states,
    player.stateTimers,
    'player',
    player.unitId,
    player.areaId,
    18,
  )
  this.applyPersistentUnitState(
    player.states,
    player.stateTimers,
    'player',
    player.unitId,
    player.areaId,
    174,
  )
  this.broadcastToArea(player.areaId, {
    type: 'UnitMove',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    mode: 'run',
    from: { x: Math.round(player.x), y: Math.round(player.y) },
    to: { x: Math.round(spin.destX), y: Math.round(spin.destY) },
    x: Math.round(player.x),
    y: Math.round(player.y),
    currentX: Math.round(player.x),
    currentY: Math.round(player.y),
    targetX: Math.round(spin.destX),
    targetY: Math.round(spin.destY),
    areaId: player.areaId,
  })
}



function finishWhirlwindSpin113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.playerWhirlwindStates.delete(player.unitId)
  if (player.states.has(174)) {
    this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 174)
  }
  if (player.states.has(18)) {
    this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 18)
  }
  if (!player.dead && !this.isPlayerInHitRecovery(player)) {
    player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
  }
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
  this.maybeSwitchPlayerAreaSeamless(player)
  if (this.loadedAreas.has(player.areaId)) {
    this.activatePresetRoomsNearPlayer113c(player)
    this.streamWildernessRoomsForPlayer(player)
    this.revealAreaRoomsNearPlayer(player, true)
  }
}



function computeWhirlwindFrameStep113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly stepSubtiles: number
  readonly velocityPercent: number
} {
  const itemFrwPercent = this.sumPlayerItemStat(player, 96)
  const combat = this.playerCombatContext(player)
  const rawVelPct = Math.trunc(combat.statList.getAccruedStat('velocitypercent'))
  let skillVelocityPercent = Math.max(0, rawVelPct)
  const incSpeedSlvl = this.resolvePlayerSkillLevelById113c(player, 148)
  if (incSpeedSlvl > 0) {
    skillVelocityPercent += computeDiminishingReturns(13, 50, incSpeedSlvl)
  }
  let armorSpeedPenaltyPercent = 0
  for (const item of player.items) {
    if (item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12 && item.durability > 0) {
      armorSpeedPenaltyPercent += resolveArmorSpeed113c(item.code)
    }
  }
  const itemSlow = Math.max(0, Math.trunc(combat.statList.getAccruedStat('item_slow')))
  const holy = combat.stateBus.getState('holywindcold')
  const holySlow = holy ? calculateHolyFreezeStats(holy.slvl).slowPct : 0
  // In 1.13c, chilling or freezing a Whirlwinding player slows movement speed by 50% (never halts or slows weapon hit intervals!).
  const coldOrFreezeSlow = player.states.has(11) || player.states.has(1) ? 50 : 0
  const decrepifySlow = player.states.has(60) ? 50 : 0
  const slowPercent = Math.max(
    itemSlow,
    Math.max(0, -rawVelPct),
    holySlow,
    coldOrFreezeSlow,
    decrepifySlow,
  )
  return computeWhirlwindStepDistancePerFrame113c({
    itemFrwPercent,
    skillVelocityPercent,
    armorSpeedPenaltyPercent,
    slowPercent,
  })
}



function resolvePlayerSkillLevelById113c(this: GameInstanceHost, player: InternalPlayerRecord, skillId: number): number {
  const base = player.skills.get(skillId) ?? 0
  if (base <= 0) return 0
  const sk = this.registry.getSkillById(skillId)
  return sk !== undefined ? Math.max(1, this.resolvePlayerSkillLevel(player, sk)) : base
}



function resolveWeaponMasteryBonuses113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  weaponType: string | undefined,
): { readonly edPct: number; readonly arPct: number; readonly critPct: number } {
  if (!weaponType) return { edPct: 0, arPct: 0, critPct: 0 }
  const t = weaponType.trim().toLowerCase()
  let masterySkillId = 0
  if (t === 'swor') masterySkillId = 127
  else if (t === 'axe') masterySkillId = 128
  else if (t === 'mace' || t === 'club' || t === 'hamm' || t === 'scep' || t === 'staf' || t === 'wand') {
    masterySkillId = 129
  } else if (t === 'pole') masterySkillId = 134
  else if (t === 'spea') masterySkillId = 136
  else if (t === 'h2h' || t === 'h2h2') masterySkillId = 252
  if (masterySkillId === 0) return { edPct: 0, arPct: 0, critPct: 0 }
  const slvl = this.resolvePlayerSkillLevelById113c(player, masterySkillId)
  if (slvl <= 0) return { edPct: 0, arPct: 0, critPct: 0 }
  if (masterySkillId === 252) {
    // Claw Mastery (#252): +35 + 4*(slvl-1)% ED, +30 + 10*(slvl-1)% AR, dm(0, 25)% Crit
    return {
      edPct: 35 + 4 * (slvl - 1),
      arPct: 30 + 10 * (slvl - 1),
      critPct: computeDiminishingReturns(0, 25, slvl),
    }
  }
  // Barbarian Melee Masteries (#127..#130, #132): +28 + 5*(slvl-1)% ED, +28 + 8*(slvl-1)% AR, dm(0, 35)% Crit
  return {
    edPct: 28 + 5 * (slvl - 1),
    arPct: 28 + 8 * (slvl - 1),
    critPct: computeDiminishingReturns(0, 35, slvl),
  }
}



function sumWhirlwindHandStat113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  hand: WhirlwindHandWeaponSpec113c,
  statId: number,
): number {
  const offWeap = this.sumPlayerItemStat(player, statId, { excludeWeaponHands: true })
  const perLvlRule = PER_LEVEL_STAT_MAP_113C[statId]
  const perLevelStatId = perLvlRule?.perLevelStatId
  const perLevelShift = perLvlRule?.shift ?? 3
  let onHand = 0
  for (const st of hand.stats) {
    if (st.statId === statId) onHand += st.value
    else if (perLevelStatId !== undefined && st.statId === perLevelStatId) {
      onHand += (st.value * player.level) >> perLevelShift
    }
  }
  return offWeap + onHand
}



function resolveWhirlwindHandPhysDamage113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  hand: WhirlwindHandWeaponSpec113c,
  skillEdPct: number,
  masteryEdPct: number,
): { readonly min: number; readonly max: number } {
  const combat = this.playerCombat.get(player.unitId)
  const offWeaponItemEd =
    this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
    this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true })
  const offWeaponEdPercent =
    (combat === undefined ? 0 : combat.statList.getModifierBonus('damagepercent')) +
    offWeaponItemEd +
    skillEdPct +
    masteryEdPct
  const offWeapNormal = this.sumPlayerItemStat(player, 111, { excludeWeaponHands: true })
  const offWeapFlatMin =
    this.sumPlayerItemStat(player, STAT_MINDAMAGE, { excludeWeaponHands: true }) + offWeapNormal
  const offWeapFlatMax =
    this.sumPlayerItemStat(player, STAT_MAXDAMAGE, { excludeWeaponHands: true }) + offWeapNormal
  const totalStr =
    player.strength +
    this.sumPlayerItemStat(player, 0) +
    (combat === undefined ? 0 : combat.statList.getModifierBonus('strength'))
  const totalDex =
    player.dexterity +
    this.sumPlayerItemStat(player, 2) +
    (combat === undefined ? 0 : combat.statList.getModifierBonus('dexterity'))

  const base = hand.base
  if (base === undefined) {
    const unarmed = getAttackWeaponInfo(null)
    const baseMin = unarmed.damageMin + offWeapFlatMin
    const baseMax = Math.max(baseMin, unarmed.damageMax + offWeapFlatMax)
    const clampedEd = Math.max(-90, offWeaponEdPercent + totalStr)
    const min = Math.max(1, baseMin + Math.trunc((baseMin * clampedEd) / 100))
    const max = Math.max(min, baseMax + Math.trunc((baseMax * clampedEd) / 100))
    return { min, max }
  }

  const useTwoHand = hand.useTwoHandDamage
  const rawHandMin = useTwoHand ? (base.twoHandedMindam ?? base.mindam) : base.mindam
  const rawHandMax = useTwoHand ? (base.twoHandedMaxdam ?? base.maxdam) : base.maxdam
  const handItem =
    hand.itemUnitId !== undefined
      ? player.items.find((i) => i.unitId === hand.itemUnitId)
      : undefined
  const isLowQualHand = handItem?.quality === 1 || handItem?.rawItemData?.quality === 1
  const scaledHand = isLowQualHand
    ? scaleLowQualityWeaponBand113c(rawHandMin, rawHandMax)
    : { min: rawHandMin, max: rawHandMax }
  const isEthHand = Boolean(
    handItem?.ethereal || ((handItem?.rawItemData?.flags ?? 0) & 0x00400000) !== 0,
  )
  const weaponMin = isEthHand ? Math.floor((scaledHand.min * 3) / 2) : scaledHand.min
  const weaponMax = isEthHand ? Math.floor((scaledHand.max * 3) / 2) : scaledHand.max
  let onWeaponEd = 0
  let flatMin = offWeapFlatMin
  let flatMax = offWeapFlatMax
  for (const stat of hand.stats) {
    if (stat.statId === STAT_ITEM_MAXDAMAGE_PERCENT) onWeaponEd += stat.value
    else if (stat.statId === 219) onWeaponEd += (stat.value * player.level) >> 3
    else if (
      stat.statId === (useTwoHand ? STAT_SECONDARY_MINDAMAGE : STAT_MINDAMAGE) ||
      stat.statId === 111
    ) {
      flatMin += stat.value
    } else if (
      stat.statId === (useTwoHand ? STAT_SECONDARY_MAXDAMAGE : STAT_MAXDAMAGE) ||
      stat.statId === 111
    ) {
      flatMax += stat.value
    } else if (stat.statId === 218) {
      flatMax += (stat.value * player.level) >> 3
    }
  }
  const statBonusPercent =
    Math.trunc((totalStr * base.strBonus) / 100) +
    Math.trunc((totalDex * base.dexBonus) / 100)
  const afterOnWeapMin = Math.trunc((weaponMin * (100 + onWeaponEd)) / 100) + flatMin
  const afterOnWeapMax = Math.max(
    afterOnWeapMin,
    Math.trunc((weaponMax * (100 + onWeaponEd)) / 100) + flatMax,
  )
  const combinedEdPct = Math.max(-90, offWeaponEdPercent + statBonusPercent)
  const min = Math.max(1, afterOnWeapMin + Math.trunc((afterOnWeapMin * combinedEdPct) / 100))
  const max = Math.max(min, afterOnWeapMax + Math.trunc((afterOnWeapMax * combinedEdPct) / 100))
  return { min, max }
}



function stepActiveWhirlwinds113c(this: GameInstanceHost): void {
  for (const [playerId, spin] of [...this.playerWhirlwindStates.entries()]) {
    const player = this.players.get(playerId)
    if (player === undefined || player.dead || player.areaId !== spin.areaId) {
      if (player !== undefined) this.finishWhirlwindSpin113c(player)
      else this.playerWhirlwindStates.delete(playerId)
      continue
    }

    const prevX = player.x
    const prevY = player.y
    const stepInfo = this.computeWhirlwindFrameStep113c(player)
    const adv = advanceWhirlwindSpinFrame113c(spin, this.currentFrame, stepInfo.stepSubtiles)
    player.x = adv.x
    player.y = adv.y
    player.mode = 18
    const motion = this.playerMotion.get(player.unitId)
    if (motion !== undefined) {
      motion.mover.setPosition(player.x, player.y)
      motion.x = player.x
      motion.y = player.y
    }
    this.maybeSwitchPlayerAreaSeamless(player)
    if (player.areaId !== spin.areaId) {
      this.finishWhirlwindSpin113c(player)
      continue
    }
    this.broadcastToAreaExcept(player.areaId, player.unitId, {
      type: 'UnitMove',
      unitType: 0,
      id: player.unitId,
      unitId: player.unitId,
      mode: 'run',
      from: { x: Math.round(prevX), y: Math.round(prevY) },
      to: { x: Math.round(spin.destX), y: Math.round(spin.destY) },
      x: Math.round(player.x),
      y: Math.round(player.y),
      currentX: Math.round(player.x),
      currentY: Math.round(player.y),
      targetX: Math.round(spin.destX),
      targetY: Math.round(spin.destY),
      velocityPercent: stepInfo.velocityPercent,
      areaId: player.areaId,
    })

    if (adv.dueHands.length > 0) {
      for (const hand of adv.dueHands) {
        const reach = PLAYER_MELEE_REACH_SUBTILES + Math.min(4, Math.max(0, hand.rangeAdder))
        const inReachMonsters = [...this.monsters.values()].filter((m) => {
          if (
            m.dead ||
            m.isNpc ||
            !m.isKillable ||
            m.submerged ||
            m.align !== 0 ||
            this.isMonsterConverted(m) ||
            m.areaId !== player.areaId
          ) {
            return false
          }
          if (isTentacleHcIdx113c(m.hcIdx) || isTentacleHeadHcIdx113c(m.hcIdx)) {
            return isInMeleeRange113c(
              player.x,
              player.y,
              2,
              m.x,
              m.y,
              m.sizeX,
              hand.rangeAdder,
              false,
              null,
              m.hcIdx,
            )
          }
          return Math.hypot(m.x - player.x, m.y - player.y) <= reach
        })
        const pvpInArea = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
        type WwCandidate =
          | { readonly kind: 'monster'; readonly monster: InternalMonsterRecord }
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
            }
        const candidates: WwCandidate[] = inReachMonsters.map((monster) => ({
          kind: 'monster',
          monster,
        }))
        for (const p of pvpInArea.players) {
          if (Math.hypot(p.x - player.x, p.y - player.y) <= reach) {
            candidates.push({ kind: 'pvp', target: { kind: 'player', player: p } })
          }
        }
        for (const c of pvpInArea.mercs) {
          if (Math.hypot(c.x - player.x, c.y - player.y) <= reach) {
            candidates.push({ kind: 'pvp', target: { kind: 'merc', merc: c } })
          }
        }
        for (const entry of pvpInArea.pets) {
          if (Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) <= reach) {
            candidates.push({ kind: 'pvp', target: { kind: 'pet', ...entry } })
          }
        }
        if (candidates.length === 0) continue
        const chosen = candidates[this.rng.rand(candidates.length)]!
        if (chosen.kind === 'monster') {
          this.executeWhirlwindHandStrike113c(player, spin, hand, chosen.monster)
        } else {
          const wwMods = computeWhirlwindDamageAndAr113c(spin.slvl)
          const mastery = this.resolveWeaponMasteryBonuses113c(player, hand.base?.type)
          const physBand = this.resolveWhirlwindHandPhysDamage113c(
            player,
            hand,
            wwMods.damagePercent,
            mastery.edPct,
          )
          const rolledPhys = this.rollInclusive(physBand.min, physBand.max)
          this.applyPvpHitToTarget113c(player, chosen.target, {
            skillId: spin.skillId,
            physDamage: rolledPhys,
            attackKind: 'melee',
            toHitBonusPct: wwMods.attackRatingPercent + mastery.arPct,
          })
        }
      }
    }

    if (adv.finished) {
      this.finishWhirlwindSpin113c(player)
    }
  }
}



/**
 * Executes one weapon-hand strike during Whirlwind (`SrvDo076`):
 * - Applies weapon physical + elemental damage, Whirlwind `%ED` & `%AR`, Weapon Mastery `%ED`/`%AR`/`%Crit`,
 *   Deadly Strike (`141`), Crushing Blow (`136`), Open Wounds (`135`), and Life/Mana Steal (`60`/`62`).
 * - Strictly suppresses `item_skillonattack` (`195`) and `item_skillonhit` (`198`) CtC procs!
 */
function executeWhirlwindHandStrike113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  spin: WhirlwindSpinState113c,
  hand: WhirlwindHandWeaponSpec113c,
  monster: InternalMonsterRecord,
): void {
  if (monster.dead || monster.isNpc || !monster.isKillable || monster.submerged || monster.align !== 0) return
  const wwMods = computeWhirlwindDamageAndAr113c(spin.slvl)
  const mastery = this.resolveWeaponMasteryBonuses113c(player, hand.base?.type)
  const physBand = this.resolveWhirlwindHandPhysDamage113c(
    player,
    hand,
    wwMods.damagePercent,
    mastery.edPct,
  )
  const rolledPhys = this.rollInclusive(physBand.min, physBand.max)

  const attackerStats = new UnitStatList(this.registry, undefined, {
    ownerType: 'player',
    charClass: player.classCode,
  })
  attackerStats.setBaseStat('level', player.level)
  attackerStats.setBaseStat('strength', player.strength + this.sumPlayerItemStat(player, 0))
  attackerStats.setBaseStat('dexterity', player.dexterity + this.sumPlayerItemStat(player, 2))
  attackerStats.setBaseStat('vitality', player.vitality + this.sumPlayerItemStat(player, 3))
  attackerStats.setBaseStat('energy', player.energy + this.sumPlayerItemStat(player, 1))
  const baseAr =
    Math.max(1, (player.dexterity + this.sumPlayerItemStat(player, 2) - 7) * 5 + 15) +
    this.sumWhirlwindHandStat113c(player, hand, 19)
  const itemArPct = this.sumWhirlwindHandStat113c(player, hand, 119)
  attackerStats.setBaseStat('tohit', baseAr)
  attackerStats.setBaseStat('item_tohit_percent', itemArPct)
  attackerStats.setBaseStat('armorclass', this.computePlayerBaseDefense(player))
  attackerStats.setBaseStat('item_ignoretargetac', this.sumWhirlwindHandStat113c(player, hand, 115))
  attackerStats.setBaseStat('item_fractionaltargetac', this.sumWhirlwindHandStat113c(player, hand, 116))
  attackerStats.setBaseStat('item_demondamage_percent', this.sumWhirlwindHandStat113c(player, hand, 121))
  attackerStats.setBaseStat('item_undeaddamage_percent', this.sumWhirlwindHandStat113c(player, hand, 122))
  attackerStats.setBaseStat('item_demon_tohit', this.sumWhirlwindHandStat113c(player, hand, 123))
  attackerStats.setBaseStat('item_undead_tohit', this.sumWhirlwindHandStat113c(player, hand, 124))
  attackerStats.setBaseStat('item_deadlystrike', this.sumWhirlwindHandStat113c(player, hand, 141))
  attackerStats.setBaseStat('passive_critical_strike', mastery.critPct)
  attackerStats.setBaseStat('maxhp', this.getPlayerAccruedMaxHpFixed(player))
  attackerStats.setHp256(player.hpFixed)
  attackerStats.setBaseStat('maxmana', this.getPlayerAccruedMaxManaFixed(player))
  attackerStats.setMana256(player.manaFixed)
  attackerStats.setBaseStat('lifedrainmindam', Math.max(0, this.sumWhirlwindHandStat113c(player, hand, 60)))
  attackerStats.setBaseStat('manadrainmindam', Math.max(0, this.sumWhirlwindHandStat113c(player, hand, 62)))

  const attackerStateBus = new StateBus(attackerStats, this.registry)
  this.mirrorPersistentStates(this.playerCombat.get(player.unitId), attackerStateBus)
  const attackerCtx: CombatUnitContext = {
    id: `player_${player.unitId}`,
    name: player.name,
    unitType: 'player',
    statList: attackerStats,
    stateBus: attackerStateBus,
    x: player.x,
    y: player.y,
    armorClassIncludesDex: true,
    weaponMinPhys: 0,
    weaponMaxPhys: 0,
    lifeStealDivisor: difficultyLifeStealDivisor(this.difficulty),
    manaStealDivisor: difficultyManaStealDivisor(this.difficulty),
  }

  const defenderStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
  defenderStats.setBaseStat('level', monster.level)
  defenderStats.setBaseStat('armorclass', monster.ac)
  defenderStats.setBaseStat('toblock', monster.toBlock)
  defenderStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  defenderStats.setHp256(monster.hp * FIXED_ONE)
  defenderStats.setBaseStat('damageresist', monster.resistances.phys)
  defenderStats.setBaseStat('magicresist', monster.resistances.magic)
  defenderStats.setBaseStat('fireresist', monster.resistances.fire)
  defenderStats.setBaseStat('lightresist', monster.resistances.light)
  defenderStats.setBaseStat('coldresist', monster.resistances.cold)
  defenderStats.setBaseStat('poisonresist', monster.resistances.poison)
  const defenderStateBus = new StateBus(defenderStats, this.registry)
  this.mirrorPersistentStates(this.monsterCombat.get(monster.unitId), defenderStateBus)
  const defenderCtx: CombatUnitContext = {
    id: `monster_${monster.unitId}`,
    name: monster.name,
    unitType: 'monster',
    statList: defenderStats,
    stateBus: defenderStateBus,
    x: monster.x,
    y: monster.y,
    isUndead: monster.isUndead,
    isDemon: monster.isDemon,
    isBoss: monster.isBoss,
    isPrimeEvil: monster.isPrimeEvil,
    rank: monster.rank,
    isChampion: monster.rank === 'champion',
    isSuperUnique: monster.superUniqueId !== undefined,
    drain: monster.drain,
    monsterColdDivisor: difficultyMonsterColdDivisor(this.difficulty),
    monsterFreezeDivisor: difficultyMonsterFreezeDivisor(this.difficulty),
  }

  const toHitBonusPct = wwMods.attackRatingPercent + mastery.arPct
  const dmgOut = executeSUnitDmg(
    attackerCtx,
    defenderCtx,
    {
      skillId: spin.skillId,
      attackKind: 'melee',
      srcDam: 0,
      flatPhysMin256: rolledPhys * FIXED_ONE,
      flatPhysMax256: rolledPhys * FIXED_ONE,
      preScaledPhysEd: true,
      toHitBonusPct,
      autoHit: false,
      unblockable: false,
    },
    this.rng,
  )
  if (!dmgOut.hit) {
    if (dmgOut.avoidedReason === 'block') {
      this.enterMonsterBlockMode113c(monster)
    }
    return
  }
  this.applyPlayerStealOutcome(player, dmgOut)

  let totalDealt =
    !dmgOut.immuneToPhys && dmgOut.totalDamage256 > 0
      ? Math.max(1, Math.floor(dmgOut.totalDamage256 / FIXED_ONE))
      : 0

  // Crushing Blow (`stat 136`, only when not physical-immune or physical hit landed)
  if (!dmgOut.immuneToPhys) {
    const cbChance = this.sumWhirlwindHandStat113c(player, hand, 136)
    if (cbChance > 0 && (cbChance >= 100 || this.rng.rand(100) < cbChance)) {
      const cbOut = calculateCrushingBlow113c({
        defenderHp: monster.hp,
        unitType: 'monster',
        isBoss: monster.isBoss,
        isPrimeEvil: monster.isPrimeEvil,
        rank: monster.rank,
        playerCount: this.effectivePlayerCount113c(),
        isRanged: false,
        physResPct: defenderStats.getAccruedStat('damageresist'),
      })
      totalDealt += cbOut.damage
    }
  }

  // Weapon + off-weapon elemental flat damage channels (`fire` 48..49, `ltng` 50..51, `mag` 52..53, `cold` 54..55)
  let coldLengthFrames = 0
  for (const [elemType, minStat, maxStat] of [
    ['fire', 48, 49],
    ['ltng', 50, 51],
    ['mag', 52, 53],
    ['cold', 54, 55],
  ] as const) {
    const eMin = this.sumWhirlwindHandStat113c(player, hand, minStat)
    const eMax = Math.max(eMin, this.sumWhirlwindHandStat113c(player, hand, maxStat))
    if (eMax <= 0) continue
    const rolledElem = this.rollInclusive(eMin, eMax)
    const elemOut = executeSUnitDmg(
      attackerCtx,
      defenderCtx,
      {
        skillId: spin.skillId,
        attackKind: 'melee',
        srcDam: 0,
        elemType,
        elemMin256: rolledElem * FIXED_ONE,
        elemMax256: rolledElem * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      },
      this.rng,
    )
    if (!elemOut.immuneToElem && elemOut.totalDamage256 > 0) {
      totalDealt += Math.max(1, Math.floor(elemOut.totalDamage256 / FIXED_ONE))
      if (elemType === 'cold') {
        coldLengthFrames = Math.max(25, this.sumWhirlwindHandStat113c(player, hand, 56))
      }
    }
  }

  // Poison damage on weapon/charms (`57 poisonmindam`, `58 poisonmaxdam`, `59 poisonlength`)
  const poisMin = this.sumWhirlwindHandStat113c(player, hand, 57)
  const poisMax = Math.max(poisMin, this.sumWhirlwindHandStat113c(player, hand, 58))
  if (poisMax > 0) {
    const poisDur = Math.max(25, this.sumWhirlwindHandStat113c(player, hand, 59))
    const rolledPoisBitrate256 = this.rollInclusive(poisMin, poisMax)
    this.applyMonsterPoisonDot(player, monster, rolledPoisBitrate256, poisDur, spin.skillId)
  }

  // Note: `spin.suppressAttackHitProcs === true` — `item_skillonattack` (195) & `item_skillonhit` (198) NEVER fire during Whirlwind!
  if (totalDealt > 0) {
    const hitClass =
      hand.base !== undefined
        ? resolveHitClassCode113c(hand.base.hitClass) || 1
        : this.resolvePlayerWeaponHitClass113c(player, spin.skillId)
    this.finishMonsterDamage(
      player,
      monster,
      totalDealt,
      spin.skillId,
      coldLengthFrames > 0 ? 'cold' : 'phys',
      hitClass,
      coldLengthFrames > 0 ? coldLengthFrames : undefined,
    )
  }

  // Open Wounds (`stat 135` -> `STATE_OPENWOUNDS = 62` for 200 frames = 8.0s) & Prevent Monster Heal (`stat 117`)
  if (!monster.dead) {
    const owChance = this.sumWhirlwindHandStat113c(player, hand, 135)
    if (owChance > 0 && (owChance >= 100 || this.rng.rand(100) < owChance)) {
      this.applyMonsterOpenWounds113c(player, monster)
    }
    if (this.sumWhirlwindHandStat113c(player, hand, 117) > 0) {
      this.applyMonsterPreventHeal113c(monster)
    }
  }
}



function applyMonsterPreventHeal113c(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  if (monster.dead || monster.isNpc || !monster.isKillable || monster.submerged || monster.align !== 0) return
  // 1.13c `D2Game` `0x6FCCCF10`: Prevent Monster Heal (`stat 117`, player attacks ONLY) sets
  // `STATE_PREVENTHEAL` (`52`) for 120,000 frames (~80 min), EXCEPT Uber Pandemonium bosses (`hcIdx 704..709`).
  if (monster.hcIdx >= 704 && monster.hcIdx <= 709) return
  this.applyUnitState(
    monster.states,
    monster.stateTimers,
    'monster',
    monster.unitId,
    monster.areaId,
    52,
    120_000,
  )
}



function applyMonsterOpenWounds113c(this: GameInstanceHost, 
  attacker: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  opts?: {
    readonly attackerLevel?: number | undefined
    readonly isRanged?: boolean | undefined
  },
): void {
  if (monster.dead || monster.isNpc || !monster.isKillable || monster.submerged || monster.align !== 0) return
  const isBoss =
    monster.isBoss ||
    monster.isPrimeEvil ||
    this.isTrueBossForCorpse113c(monster)
  const clvl = Math.max(1, Math.min(99, Math.trunc(opts?.attackerLevel ?? attacker.level)))
  const bitrate256 = computeOpenWoundsBitrate256113c(clvl, isBoss)
  this.monsterOpenWounds.set(monster.unitId, {
    bitrate256,
    remainingFrames: 200,
    carry256: 0,
    attackerId: attacker.unitId,
  })
  this.applyUnitState(
    monster.states,
    monster.stateTimers,
    'monster',
    monster.unitId,
    monster.areaId,
    62,
    200,
  )
}



function stepMonsterOpenWounds113c(this: GameInstanceHost): void {
  for (const [monsterId, ow] of [...this.monsterOpenWounds.entries()]) {
    const monster = this.monsters.get(monsterId)
    if (
      monster === undefined ||
      monster.dead ||
      monster.isNpc ||
      !monster.isKillable ||
      ow.remainingFrames <= 0
    ) {
      this.monsterOpenWounds.delete(monsterId)
      continue
    }
    ow.remainingFrames -= 1
    ow.carry256 += ow.bitrate256
    const wholeDmg = Math.floor(ow.carry256 / FIXED_ONE)
    if (wholeDmg > 0) {
      ow.carry256 -= wholeDmg * FIXED_ONE
      monster.hp = Math.max(0, monster.hp - wholeDmg)
      this.broadcastToArea(monster.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: monster.unitId,
        statId: 6,
        value: monster.hp,
      })
      if (monster.hp <= 0) {
        this.monsterOpenWounds.delete(monsterId)
        const attacker =
          this.players.get(ow.attackerId) ?? this.players.values().next().value
        if (attacker !== undefined) {
          this.applyMonsterDeath(monster, attacker, 'phys')
        } else {
          monster.dead = true
          monster.mode = 12
        }
        continue
      }
    }
    if (ow.remainingFrames <= 0) {
      this.monsterOpenWounds.delete(monsterId)
      if (monster.states.has(62)) {
        this.clearUnitState(
          monster.states,
          monster.stateTimers,
          'monster',
          monster.unitId,
          monster.areaId,
          62,
        )
      }
    }
  }
}



/**
 * Direct-hit spells without a missile (Telekinesis `srvdofunc` 21, Psychic Hammer 33, Mind Blast
 * 51): the evaluated physical band is applied as physical damage and the `EMin..EMax` band in the
 * skill's `EType` channel.
 */
function applyDirectSkillDamage(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void {
  const ev = cast.evalResult
  const phys = this.rollInclusive(ev.minPhysDmg, ev.maxPhysDmg)
  const elem = cast.skill.eType !== '' ? this.rollInclusive(ev.minElemDmg, ev.maxElemDmg) : 0
  if (phys > 0) this.applyDamageToMonster(player, monster, phys, cast.skill.id, 'phys')
  if (elem > 0 && !monster.dead) this.applyDamageToMonster(player, monster, elem, cast.skill.id)
}



/**
 * `#1814` — Strict 1.13c monster conversion eligibility (`#273 Mind Blast` `SrvDo051` @ `0x6FCB57F0` &
 * `#116 Conversion` `SrvDo079` @ `0x6FCB29F0`):
 * Act/Quest Bosses, SuperUniques, Random Uniques, Champions, NPCs, Tentacles, and non-hostile /
 * `isAtt == 0` units have strictly `0%` conversion chance.
 */
function isMonsterEligibleForConversion113c(this: GameInstanceHost, monster: InternalMonsterRecord): boolean {
  if (
    monster.dead ||
    monster.isNpc ||
    monster.align !== 0 ||
    !monster.isKillable ||
    monster.submerged ||
    monster.isBoss ||
    monster.isPrimeEvil ||
    monster.rank === 'boss' ||
    monster.rank === 'unique' ||
    monster.rank === 'champion' ||
    monster.superUniqueId !== undefined ||
    isTentacleHcIdx113c(monster.hcIdx) ||
    isTentacleHeadHcIdx113c(monster.hcIdx)
  ) {
    return false
  }
  const flags = this.resolveMonsterTableFlags113c(monster)
  if (
    !flags.killable ||
    !flags.isAtt ||
    flags.align !== 0 ||
    this.isTrueBossForCorpse113c(monster, flags)
  ) {
    return false
  }
  return true
}



function applyMonsterConversion113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  skillId: number,
  slvl: number,
  durationOverrideFrames?: number,
): number {
  if (!this.isMonsterEligibleForConversion113c(monster)) return 0
  const convFrames =
    durationOverrideFrames !== undefined && durationOverrideFrames > 0
      ? durationOverrideFrames
      : 150 + this.rng.rand(100)
  monster.convertedUntilFrame = this.currentFrame + convFrames
  monster.convertedByPlayerId = player.unitId
  monster.threatPlayerId = 0
  monster.threatUntilFrame = 0
  monster.pendingAttack = undefined
  const conversionState = this.registry.getStateByName('conversion')
  const convStateId = conversionState?.id ?? 53
  this.applyUnitState(
    monster.states,
    monster.stateTimers,
    'monster',
    monster.unitId,
    monster.areaId,
    convStateId,
    convFrames,
  )
  this.monsterCombatContext(monster).stateBus.applyState({
    stateNameOrId: convStateId,
    sourceUnitId: `player_${player.unitId}`,
    sourceSkillId: skillId,
    slvl,
    durationFrames: convFrames,
    currentFrame: this.currentFrame,
  })
  if (skillId === 116 && player.level < monster.level && monster.conversionSavedStats === undefined) {
    const scaled = computeConversionLevelScaling113c(
      player.level,
      monster.level,
      monster.hp,
      monster.maxHp,
    )
    if (scaled.scaled && scaled.saved !== undefined) {
      monster.conversionSavedStats = scaled.saved
      monster.level = scaled.newLevel
      monster.maxHp = scaled.newMaxHp
      monster.hp = scaled.newHp
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        STATE_CONVERSION_SAVE_113C,
        convFrames,
      )
      this.broadcastToArea(monster.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: monster.unitId,
        statId: 7,
        value: monster.maxHp,
      })
      this.broadcastToArea(monster.areaId, {
        type: 'UnitStatUpdate',
        unitType: 'monster',
        unitId: monster.unitId,
        statId: 6,
        value: monster.hp,
      })
    }
  }
  return convFrames
}



/**
 * `#1814` — Assassin `Mind Blast (#273)` (`SrvDo051` @ `0x6FCB57F0`):
 * - Deals physical damage + knockback (`MONSTER_KNOCKBACK_SKILLS`) in `Param7 = 4` subtile radius.
 * - Applies `stunned` (`state 21`) for `min(250, 50 + 5 * (slvl - 1))` frames (`0%` on Act/Quest Bosses,
 *   `10%` stun chance on Champions/Uniques, `100%` on normal monsters).
 * - Independently rolls `dm56(15, 40)` (`15..39%`) conversion ONLY on eligible normal monsters for
 *   `150 + rand(100)` frames (`6.0..9.96s`), completely decoupled from `stunFrames`!
 */
function executeMindBlast(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void {
  const radius = cast.evalResult.radiusSubtiles
  const stunFrames = computeMindBlastStunDuration(cast.slvl)
  const convChancePct = computeMindBlastConversionChance(cast.slvl)
  const stunned = this.registry.getStateByName('stunned')
  if (stunned === undefined) {
    throw new Error('GameInstance: States.txt row stunned is missing')
  }
  const targets = [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      !m.isNpc &&
      !m.submerged &&
      m.align === 0 &&
      !this.isMonsterConverted(m) &&
      m.areaId === player.areaId &&
      Math.hypot(m.x - tx, m.y - ty) <= radius,
  )
  for (const m of targets) {
    this.applyDirectSkillDamage(player, cast, m)
    if (m.dead) continue
    const flags = this.resolveMonsterTableFlags113c(m)
    const isBoss = this.isTrueBossForCorpse113c(m, flags)
    if (!isBoss) {
      const isElite =
        m.rank === 'unique' || m.rank === 'champion' || m.superUniqueId !== undefined
      if (!isElite || this.rng.rand(100) < 10) {
        this.applyUnitState(
          m.states,
          m.stateTimers,
          'monster',
          m.unitId,
          m.areaId,
          stunned.id,
          stunFrames,
        )
      }
    }
    if (this.isMonsterEligibleForConversion113c(m) && this.rng.rand(100) < convChancePct) {
      this.applyMonsterConversion113c(player, m, cast.skill.id, cast.slvl)
    }
  }
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  for (const p of pvp.players) {
    if (Math.hypot(p.x - tx, p.y - ty) > radius) continue
    this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'player', player: p }, 'spell')
    if (!p.dead) {
      this.applyPvpDebuffStateToTarget113c(
        { kind: 'player', player: p },
        stunned.id,
        stunFrames,
        `player_${player.unitId}`,
        cast.skill.id,
        cast.slvl,
      )
    }
  }
  for (const c of pvp.mercs) {
    if (Math.hypot(c.x - tx, c.y - ty) > radius) continue
    this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'merc', merc: c }, 'spell')
    if (c.alive) {
      this.applyPvpDebuffStateToTarget113c(
        { kind: 'merc', merc: c },
        stunned.id,
        stunFrames,
        `player_${player.unitId}`,
        cast.skill.id,
        cast.slvl,
      )
    }
  }
  for (const entry of pvp.pets) {
    if (Math.hypot(entry.pet.x - tx, entry.pet.y - ty) > radius) continue
    this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'pet', ...entry }, 'spell')
    if (entry.pet.alive !== false && entry.pet.hp > 0) {
      this.applyPvpDebuffStateToTarget113c(
        { kind: 'pet', ...entry },
        stunned.id,
        stunFrames,
        `player_${player.unitId}`,
        cast.skill.id,
        cast.slvl,
      )
    }
  }
}



/**
 * `#1879` — Paladin `Conversion (#116)` (`SrvDo079` @ `0x6FCB9830`):
 * melee strike that rolls `dm34(0, 50)` conversion (`calculateConversionStats(slvl).chancePct`)
 * for `Param3 = 400` frames (`16s`) strictly on normal monsters (`0%` on Bosses, SuperUniques,
 * Uniques, and Champions), including when the normal monster is physical-immune (`landedHitRoll`).
 */
function executePaladinConversion(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  monster: InternalMonsterRecord,
): void {
  const physDamage = Math.max(1, this.rollPlayerSkillPhysDamage(player, cast))
  const outHitResult = { landedHitRoll: false }
  this.applyDamageToMonster(player, monster, physDamage, cast.skill.id, 'phys', 'player', {
    attackKind: 'melee',
    outHitResult,
  })
  if (!outHitResult.landedHitRoll || monster.dead) return
  if (!this.isMonsterEligibleForConversion113c(monster)) return
  const { chancePct, durationFrames } = calculateConversionStats(cast.slvl)
  if (this.rng.rand(100) < chancePct) {
    this.applyMonsterConversion113c(player, monster, cast.skill.id, cast.slvl, durationFrames)
  }
}



/**
 * `#1882` — Corpse Explosion (`srvdofunc` 55): consumes the corpse nearest to the target and deals
 * `computeCorpseExplosion113c` damage (`70..120%` of single-player `/players 1` normal base monster HP
 * `corpse.unscaledMaxHp`, never Champion/Unique/`/players N` scaled HP!), split `50%` physical + `50%` fire.
 */
function executeCorpseExplosion(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  tx: number,
  ty: number,
  targetCorpse?: InternalMonsterRecord,
): void {
  const corpse = this.findNearestSelectableCorpse113c(
    player.areaId,
    tx,
    ty,
    false,
    targetCorpse,
  )
  if (corpse === undefined) return
  this.consumeMonsterCorpse113c(corpse, 118)
  const rollPct = 70 + this.rng.rand(51)
  const corpseBaseHp = corpse.unscaledMaxHp || corpse.baseMaxHp || corpse.maxHp
  const ceSpellHitCtx = {
    attackKind: 'spell' as const,
    autoHit: true,
    unblockable: true,
  }
  for (const m of [...this.monsters.values()]) {
    if (m.dead || m.isNpc || m.submerged || m.areaId !== player.areaId) continue
    const d = Math.hypot(m.x - corpse.x, m.y - corpse.y)
    const out = computeCorpseExplosion113c({
      corpseBaseHp,
      rollPct,
      casterLevel: player.level,
      corpseLevel: corpse.level,
      slvl: cast.slvl,
      distanceSubtiles: d,
    })
    if (d > out.outerFireRadiusSubtiles) continue
    if (d <= out.innerPhysRadiusSubtiles && out.rawPhysDamage > 0) {
      this.applyDamageToMonster(
        player,
        m,
        out.rawPhysDamage,
        cast.skill.id,
        'phys',
        'player',
        ceSpellHitCtx,
      )
    }
    if (!m.dead && out.rawFireDamage > 0) {
      this.applyDamageToMonster(
        player,
        m,
        out.rawFireDamage,
        cast.skill.id,
        'fire',
        'player',
        ceSpellHitCtx,
      )
    }
  }
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  const applyCePvp = (
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
    ux: number,
    uy: number,
  ): void => {
    const d = Math.hypot(ux - corpse.x, uy - corpse.y)
    const out = computeCorpseExplosion113c({
      corpseBaseHp,
      rollPct,
      casterLevel: player.level,
      corpseLevel: corpse.level,
      slvl: cast.slvl,
      distanceSubtiles: d,
    })
    if (d > out.outerFireRadiusSubtiles) return
    const phys = d <= out.innerPhysRadiusSubtiles ? out.rawPhysDamage : 0
    if (phys > 0 || out.rawFireDamage > 0) {
      this.applyPvpHitToTarget113c(player, target, {
        skillId: cast.skill.id,
        physDamage: phys,
        elemDamage: out.rawFireDamage,
        elemType: out.rawFireDamage > 0 ? 'fire' : undefined,
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
      })
    }
  }
  for (const p of pvp.players) applyCePvp({ kind: 'player', player: p }, p.x, p.y)
  for (const c of pvp.mercs) applyCePvp({ kind: 'merc', merc: c }, c.x, c.y)
  for (const entry of pvp.pets) applyCePvp({ kind: 'pet', ...entry }, entry.pet.x, entry.pet.y)
}



/** `Skills.txt` `DmgSymPerCalc` of the cast: the physical synergy %ED (0 when the cell is empty). */
function playerSkillPhysSynergyPct(this: GameInstanceHost, cast: PlayerSkillCast): number {
  return this.evaluatePlayerSkillCalc(cast, cast.skill.dmgSymPerCalc)
}



/**
 * #1417: create the server missiles of a missile skill the way its `Skills.txt` `srvdofunc` does in
 * `D2Game.dll` (`gpSkillSrvDoFnTable` @ `0x6FD274A8`, `classifyPlayerSrvDoMissile113c`):
 * - SrvDo008 `0x6FC6D420` (Multiple Shot, Teeth, Shock Wave): `calc1` missiles fanned through the
 *   target (`srvdo008FanTargets113c`). `calc1` is the missile count, not %ED, so the weapon part only
 *   carries the `DmgSymPerCalc` synergy.
 * - SrvDo012 `0x6FC6DCD0` (Strafe): `executeStrafe`.
 * - SrvDo017 / 117 / 118 (Charged Bolt, Firestorm, Twister / Tornado): `calc1` missiles toward the target.
 * - single-missile srvdofuncs (and skills without one) launch one `srvmissile`; every other
 *   srvdofunc is reported through `reportUnmodeledPlayerSrvDoFunc` before the single launch.
 */
function launchPlayerSkillMissiles(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  missileRec: MissileRecord,
  tx: number,
  ty: number,
  primaryTarget?: InternalMonsterRecord,
  lockedTargetKey?: string,
): void {
  // 1.13c attack-sequence start (`0x6FCEE520`): `pierce_idx += 1` so one attack shares one pierce seed.
  advanceUnitPierceSeed(this.playerCombatContext(player))
  // `item_skillonattack` (195) fires once per weapon attack launch (bow/crossbow/throw), hit or miss (#1797).
  // `#1884` (`#266 Blade Fury` `SrvDo048` & `#257 Blade Sentinel`): never fire `onAttack` (195); `#266` fires `onHit` (198) only!
  if (
    cast.skill.srcDam > 0 &&
    cast.skill.id !== 266 &&
    cast.skill.id !== 257 &&
    this.playerCtcProcDepth === 0
  ) {
    this.triggerPlayerCtcProcs113c(player, 195, { target: primaryTarget, tx, ty })
  }
  if (cast.skill.id === 266) {
    this.launchBladeFuryShot113c(player, cast, tx, ty)
    return
  }
  const mode = classifyPlayerSrvDoMissile113c(cast.skill.srvDoFunc)
  if (mode === 'fan') {
    const count = this.evaluatePlayerSkillCalc(cast, cast.skill.calc1)
    const triggered = this.evaluatePlayerSkillCalc(cast, cast.skill.calc3)
    const edPct = this.playerSkillPhysSynergyPct(cast)
    for (const t of srvdo008FanTargets113c(player.x, player.y, tx, ty, count, triggered)) {
      this.launchPlayerSkillMissile(player, cast, missileRec, t.x, t.y, this.rollPlayerSkillDamage(player, cast, edPct))
    }
    return
  }
  if (mode === 'strafe') {
    this.executeStrafe(player, cast, missileRec, tx, ty, primaryTarget, lockedTargetKey)
    return
  }
  if (mode === 'volley') {
    const count = this.evaluatePlayerSkillCalc(cast, cast.skill.calc1)
    for (let i = 0; i < count; i++) {
      this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast))
    }
    return
  }
  if (mode === 'firewall') {
    this.launchFireWall113c(player, cast, missileRec, tx, ty)
    return
  }
  if (mode === 'ring64' || cast.skill.id === 130) {
    // 1.13c `sub_6FCC2800` (`0x6FCC2800`): 64 radial missiles for `SrvDo022` (`0x6FC63AA0`: `#44 Frost Nova`, `#48 Nova`,
    // `#92 Poison Nova`, `#130 Howl`, `velDelta = calc1`) and `SrvDo068` (`0x6FC49720`: `#138 Shout`, `#146 Battle Cry`,
    // `#149 Battle Orders`, `#154 War Cry`, `#155 Battle Command`).
    const velDelta =
      cast.skill.srvDoFunc === 22 && cast.skill.calc1.trim() !== ''
        ? this.evaluatePlayerSkillCalc(cast, cast.skill.calc1)
        : 0
    for (const pt of srvdoRing64Targets113c(player.x, player.y)) {
      const dmg =
        cast.skill.id === 154
          ? this.rollPlayerSkillPhysDamage(player, cast)
          : cast.skill.srvDoFunc === 22 && cast.skill.id !== 130
            ? Math.max(1, Math.floor(cast.evalResult.maxElemDmg256 / FIXED_ONE))
            : 0
      this.launchPlayerSkillMissile(player, cast, missileRec, pt.x, pt.y, dmg, {
        velDelta,
        forcePierce: !missileRec.collideKill,
      })
    }
    if (cast.skill.srvDoFunc === 68 && cast.skill.auraState.trim() !== '') {
      this.applyWarcryBuffToPlayer113c(player, player, cast.skill, cast.slvl, cast.statList)
    }
    return
  }
  if (mode === 'unmodeled') this.reportUnmodeledPlayerSrvDoFunc(cast.skill)
  // `SKILLS_SrvDo010` (Guided Arrow / Bone Spirit) cast on a unit locks the missile onto it (`TargetX = 1`).
  const lockOpts =
    cast.skill.srvDoFunc === 10 && (lockedTargetKey !== undefined || primaryTarget !== undefined)
      ? {
          ...(primaryTarget !== undefined ? { lockedMonsterId: primaryTarget.unitId } : {}),
          ...(lockedTargetKey !== undefined ? { lockedTargetKey } : {}),
        }
      : undefined
  this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast), lockOpts)
  if (cast.offHandMissile !== undefined) {
    this.launchPlayerSkillMissile(player, cast, cast.offHandMissile, tx, ty, this.rollPlayerSkillDamage(player, cast))
  }
}



/**
 * Strafe (SrvSt008 `0x6FC6C870` + SrvDo012 `0x6FC6DCD0`): the hostiles inside `aurarangecalc`
 * (`radiusSubtiles`) around the caster set the shot count `strafeShotCount113c(calc1, calc3, n)`;
 * each shot is one `srvmissilea` at the next target, carrying `calc2` (+ `DmgSymPerCalc`) as %ED.
 * The clicked monster is shot first, the rest nearest-first, cycling when there are fewer targets
 * than shots. With no target in range SrvDo012 fires its single shot at the cast location and then
 * finds no next target.
 */
function executeStrafe(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  missileRec: MissileRecord,
  tx: number,
  ty: number,
  primaryTarget?: InternalMonsterRecord,
  primaryTargetKey?: string,
): void {
  const radius = cast.evalResult.radiusSubtiles
  const inRange: Array<{ readonly key: string; readonly x: number; readonly y: number; readonly sortId: number }> = [
    ...this.monsters.values(),
  ]
    .filter(
      (m) =>
        !m.dead &&
        !m.isNpc &&
        m.align === 0 &&
        !this.isMonsterConverted(m) &&
        m.areaId === player.areaId &&
        Math.hypot(m.x - player.x, m.y - player.y) <= radius,
    )
    .map((m) => ({ key: this.onlineUnitKey113c('monster', m.unitId), x: m.x, y: m.y, sortId: m.unitId }))
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  for (const p of pvp.players) {
    if (Math.hypot(p.x - player.x, p.y - player.y) <= radius) {
      inRange.push({ key: this.onlineUnitKey113c('player', p.unitId), x: p.x, y: p.y, sortId: 1_000_000 + p.unitId })
    }
  }
  for (const c of pvp.mercs) {
    if (Math.hypot(c.x - player.x, c.y - player.y) <= radius) {
      inRange.push({ key: this.onlineUnitKey113c('merc', c.unitId), x: c.x, y: c.y, sortId: 2_000_000 + c.unitId })
    }
  }
  for (const entry of pvp.pets) {
    if (Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) <= radius) {
      inRange.push({
        key: this.onlineUnitKey113c('pet', entry.petUnitId),
        x: entry.pet.x,
        y: entry.pet.y,
        sortId: 3_000_000 + entry.petUnitId,
      })
    }
  }
  const primaryKey =
    primaryTargetKey ?? (primaryTarget !== undefined ? this.onlineUnitKey113c('monster', primaryTarget.unitId) : undefined)
  inRange.sort((a, b) => {
    if (primaryKey !== undefined) {
      if (a.key === primaryKey && b.key !== primaryKey) return -1
      if (b.key === primaryKey && a.key !== primaryKey) return 1
    }
    const d = Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
    return d !== 0 ? d : a.sortId - b.sortId
  })
  const edPct = this.evaluatePlayerSkillCalc(cast, cast.skill.calc2) + this.playerSkillPhysSynergyPct(cast)
  if (inRange.length === 0) {
    this.launchPlayerSkillMissile(player, cast, missileRec, tx, ty, this.rollPlayerSkillDamage(player, cast, edPct))
    return
  }
  const shots = strafeShotCount113c(
    this.evaluatePlayerSkillCalc(cast, cast.skill.calc1),
    this.evaluatePlayerSkillCalc(cast, cast.skill.calc3),
    inRange.length,
  )
  for (let i = 0; i < shots; i++) {
    const target = inRange[i % inRange.length]!
    this.launchPlayerSkillMissile(
      player,
      cast,
      missileRec,
      target.x,
      target.y,
      this.rollPlayerSkillDamage(player, cast, edPct),
    )
  }
}



/** Report (once per srvdofunc) a missile skill whose 1.13c srvdofunc volley is not implemented. */
function reportUnmodeledPlayerSrvDoFunc(this: GameInstanceHost, skill: SkillRecord): void {
  if (this.unmodeledPlayerSrvDoFuncs.has(skill.srvDoFunc)) return
  this.unmodeledPlayerSrvDoFuncs.add(skill.srvDoFunc)
  console.warn(
    `GameInstance: Skills.txt srvdofunc ${skill.srvDoFunc} (skill ${skill.id} ${skill.name}) has no 1.13c missile ` +
      'volley implementation; launching a single srvmissile',
  )
}



/** #1417 diagnostics: srvdofuncs reported by `reportUnmodeledPlayerSrvDoFunc`, ascending. */
function getUnmodeledPlayerSrvDoFuncs(this: GameInstanceHost): number[] {
  return [...this.unmodeledPlayerSrvDoFuncs].sort((a, b) => a - b)
}



/**
 * 1.13c `D2Game.dll` `SkillSrvStFunc[11]` (`0x6FC64550` -> `0x6FC643F0` for `Inferno` #41 / `Arctic Blast` #230)
 * & `SkillSrvStFunc[26]` (`0x6FCB5BC0` for `Blade Fury` #266):
 * Maintain `STATE_INFERNO` (state 12) while channeling a `startmana > 0` skill (20f + 6f/tick for #41/#230;
 * 21f + 7f/tick for #266), or clear `STATE_INFERNO` when casting a non-channeling skill or moving.
 */
function clearPlayerChannelState(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.playerChannelSkillId.delete(player.unitId)
  this.activeBladeFuryChannels.delete(player.unitId)
  if (player.states.has(12)) {
    this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 12)
  }
  const combat = this.playerCombat.get(player.unitId)
  if (combat !== undefined) {
    combat.stateBus.removeState('inferno')
    combat.stateBus.removeState(12)
  }
}



function updatePlayerChannelState(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast): void {
  if (cast.skill.startMana > 0) {
    const inChannel =
      player.states.has(12) &&
      (this.playerChannelSkillId.get(player.unitId) === undefined ||
        this.playerChannelSkillId.get(player.unitId) === cast.skill.id)
    const prevTimer = inChannel ? (player.stateTimers.get(12) ?? 0) : 0
    const channelFrames =
      cast.skill.id === 266
        ? inChannel
          ? Math.max(21, prevTimer + 5)
          : 21
        : inChannel
          ? Math.max(20, prevTimer + 6)
          : 20
    this.applyUnitState(
      player.states,
      player.stateTimers,
      'player',
      player.unitId,
      player.areaId,
      12,
      channelFrames,
    )
    this.playerChannelSkillId.set(player.unitId, cast.skill.id)
    this.playerCombatContext(player).stateBus.applyState({
      stateNameOrId: 12,
      sourceUnitId: `player_${player.unitId}`,
      sourceSkillId: cast.skill.id,
      slvl: cast.slvl,
      durationFrames: channelFrames,
      currentFrame: this.currentFrame,
    })
  } else if (player.states.has(12)) {
    this.clearPlayerChannelState(player)
  }
}

/**
 * 1.13c `D2Game.dll` `SKILLS_ApplyWarcryStats` (`0x6FC49240`) + `SKILLS_UpdateUnitStatsFromWarcry` (`0x6FC49330`):
 * Applies a friendly warcry buff (`#138 Shout` state 26, `#149 Battle Orders` state 32, `#155 Battle Command` state 51)
 * onto a player (`caster` via `SrvDo068`, or a partied player via `MISSMODE_SrvHit18` `0x6FC5EA60`).
 */
function applyWarcryBuffToPlayer113c(
  this: GameInstanceHost,
  caster: InternalPlayerRecord,
  target: InternalPlayerRecord,
  skill: SkillRecord,
  slvl: number,
  casterStatList: UnitStatList,
): void {
  if (target.dead) return
  const stateName = skill.auraState.trim()
  if (stateName === '') return
  const stateRec = this.registry.getStateByName(stateName)
  if (!stateRec) return

  const targetCtx = this.playerCombatContext(target)
  // Anti-downgrade (`0x6FC49240`): lower-level cast of the same warcry skill cannot overwrite a higher-level one.
  const existing = targetCtx.stateBus.getState(stateRec.id)
  if (existing !== undefined && existing.sourceSkillId === skill.id && existing.slvl > slvl) {
    return
  }

  const oldMaxHpFixed = this.getPlayerAccruedMaxHpFixed(target)
  const oldMaxManaFixed = this.getPlayerAccruedMaxManaFixed(target)
  const oldMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(target)

  const calcCtx = {
    registry: this.registry,
    activeSkill: skill,
    slvl,
    blvl: casterStatList.getBaseSkillLevel(skill.id),
    getBaseSkillLevel: (id: number) => casterStatList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => casterStatList.getEffectiveSkillLevel(id),
    getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) =>
      casterStatList.getAccruedStat(statNameOrId, baseOnly),
  }
  const durationFrames = Math.max(
    1,
    skill.auraLenCalc.trim() !== '' ? Math.trunc(evaluateCalc(skill.auraLenCalc, calcCtx)) : 125,
  )
  const rawStateStats = this.evaluateSkillStateStats(skill, slvl, casterStatList)

  targetCtx.stateBus.applyState({
    stateNameOrId: stateRec.id,
    sourceUnitId: `player_${caster.unitId}`,
    sourceSkillId: skill.id,
    slvl,
    durationFrames,
    currentFrame: this.currentFrame,
    stats: rawStateStats,
  })
  if (stateRec.id === 51) {
    // `SKILLS_RefreshPassiveSkills(pTarget)` (`0x6FC492F1`): update passive masteries & Natural Resistance immediately.
    this.syncPlayerSkillLevelsToStatList113c(target, targetCtx.statList, targetCtx.stateBus)
  }
  this.applyUnitState(
    target.states,
    target.stateTimers,
    'player',
    target.unitId,
    target.areaId,
    stateRec.id,
    durationFrames,
  )

  const newMaxHpFixed = this.getPlayerAccruedMaxHpFixed(target)
  const newMaxManaFixed = this.getPlayerAccruedMaxManaFixed(target)
  const newMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(target)

  let poolsChanged = false
  if (newMaxHpFixed !== oldMaxHpFixed && oldMaxHpFixed > 0) {
    target.hpFixed = Math.max(
      FIXED_ONE,
      Math.min(newMaxHpFixed, Math.trunc((target.hpFixed * newMaxHpFixed) / oldMaxHpFixed)),
    )
    poolsChanged = true
  }
  if (newMaxManaFixed !== oldMaxManaFixed) {
    target.manaFixed =
      oldMaxManaFixed > 0
        ? Math.max(0, Math.min(newMaxManaFixed, Math.trunc((target.manaFixed * newMaxManaFixed) / oldMaxManaFixed)))
        : 0
    poolsChanged = true
  }
  if (newMaxStaminaFixed !== oldMaxStaminaFixed && oldMaxStaminaFixed > 0) {
    target.staminaFixed = Math.max(
      0,
      Math.min(newMaxStaminaFixed, Math.trunc((target.staminaFixed * newMaxStaminaFixed) / oldMaxStaminaFixed)),
    )
    poolsChanged = true
  }

  target.maxHp = Math.max(1, Math.floor(newMaxHpFixed / FIXED_ONE))
  target.hp = target.dead ? 0 : Math.max(1, Math.min(target.maxHp, Math.floor(target.hpFixed / FIXED_ONE)))
  target.maxMana = Math.max(0, Math.floor(newMaxManaFixed / FIXED_ONE))
  target.mana = Math.max(0, Math.min(target.maxMana, Math.floor(target.manaFixed / FIXED_ONE)))
  target.maxStamina = Math.max(1, Math.floor(newMaxStaminaFixed / FIXED_ONE))
  target.stamina = target.staminaExhausted
    ? 0
    : Math.max(0, Math.min(target.maxStamina, Math.floor(target.staminaFixed / FIXED_ONE)))

  if (poolsChanged) {
    this.emitPlayerVitals(target)
  }
}

/**
 * 1.13c `SKILLS_ApplyWarcryStats` (`0x6FC49240`) on an allied mercenary or summoned pet via `MISSMODE_SrvHit18`.
 */
function applyWarcryBuffToAlly113c(
  this: GameInstanceHost,
  caster: InternalPlayerRecord,
  allyKind: 'merc' | 'pet',
  allyUnitId: number,
  skill: SkillRecord,
  slvl: number,
  casterStatList: UnitStatList,
  petRef?: SummonedPetUnit,
): void {
  const stateName = skill.auraState.trim()
  if (stateName === '') return
  const stateRec = this.registry.getStateByName(stateName)
  if (!stateRec) return

  const calcCtx = {
    registry: this.registry,
    activeSkill: skill,
    slvl,
    blvl: casterStatList.getBaseSkillLevel(skill.id),
    getBaseSkillLevel: (id: number) => casterStatList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => casterStatList.getEffectiveSkillLevel(id),
    getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) =>
      casterStatList.getAccruedStat(statNameOrId, baseOnly),
  }
  const durationFrames = Math.max(
    1,
    skill.auraLenCalc.trim() !== '' ? Math.trunc(evaluateCalc(skill.auraLenCalc, calcCtx)) : 125,
  )
  const rawStateStats = this.evaluateSkillStateStats(skill, slvl, casterStatList)

  if (allyKind === 'merc') {
    const merc = this.mercenaries.get(allyUnitId)
    if (!merc || !merc.alive || merc.hp <= 0) return
    const mercCtx = this.mercCombatContext(merc)
    const existing = mercCtx.stateBus.getState(stateRec.id)
    if (existing !== undefined && existing.sourceSkillId === skill.id && existing.slvl > slvl) return
    const oldMaxHp256 = Math.max(FIXED_ONE, Math.trunc(mercCtx.statList.getAccruedStat('maxhp')))
    mercCtx.stateBus.applyState({
      stateNameOrId: stateRec.id,
      sourceUnitId: `player_${caster.unitId}`,
      sourceSkillId: skill.id,
      slvl,
      durationFrames,
      currentFrame: this.currentFrame,
      stats: rawStateStats,
    })
    this.applyUnitState(
      merc.states,
      merc.stateTimers,
      'monster',
      merc.unitId,
      merc.areaId,
      stateRec.id,
      durationFrames,
    )
    const newMaxHp256 = Math.max(FIXED_ONE, Math.trunc(mercCtx.statList.getAccruedStat('maxhp')))
    if (newMaxHp256 !== oldMaxHp256) {
      const nextHp = Math.max(
        1,
        Math.min(
          Math.floor(newMaxHp256 / FIXED_ONE),
          Math.trunc((merc.hp * newMaxHp256) / oldMaxHp256),
        ),
      )
      if (nextHp !== merc.hp) {
        merc.hp = nextHp
        this.broadcastAllyHp(merc.areaId, merc.unitId, merc.hp)
      }
    }
    return
  }

  const pet = petRef ?? this.petVisualStates.get(allyUnitId)?.pet
  if (!pet || pet.alive === false || pet.hp <= 0) return
  if (pet.petType === 'assassintrap' || pet.petType === 'hydra' || pet.petType === 'raven') return
  const built = this.getOrCreatePetCombatContext113c(pet, allyUnitId, caster.areaId)
  const existing = built.ctx.stateBus.getState(stateRec.id)
  if (existing !== undefined && existing.sourceSkillId === skill.id && existing.slvl > slvl) return
  const oldMaxHp256 = Math.max(FIXED_ONE, Math.trunc(built.ctx.statList.getAccruedStat('maxhp')))
  built.ctx.stateBus.applyState({
    stateNameOrId: stateRec.id,
    sourceUnitId: `player_${caster.unitId}`,
    sourceSkillId: skill.id,
    slvl,
    durationFrames,
    currentFrame: this.currentFrame,
    stats: rawStateStats,
  })
  this.applyUnitState(
    built.states,
    built.timers,
    'monster',
    allyUnitId,
    caster.areaId,
    stateRec.id,
    durationFrames,
  )
  const newMaxHp256 = Math.max(FIXED_ONE, Math.trunc(built.ctx.statList.getAccruedStat('maxhp')))
  if (newMaxHp256 !== oldMaxHp256) {
    const nextHp = Math.max(
      1,
      Math.min(Math.floor(newMaxHp256 / FIXED_ONE), Math.trunc((pet.hp * newMaxHp256) / oldMaxHp256)),
    )
    if (nextHp !== pet.hp) {
      pet.hp = nextHp
      pet.statList.setHp256(pet.hp * FIXED_ONE)
      this.broadcastAllyHp(caster.areaId, allyUnitId, pet.hp)
    }
  }
}

export interface PlayerSkillsAoeAndCorpseMethods {
  applyPlayerSkillEffect(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number, targetMonster: InternalMonsterRecord | undefined): void
  relocatePlayerForSkill(player: InternalPlayerRecord, x: number, y: number, throughWalls: boolean, relocateFollowers?: boolean): boolean
  pointBefore(player: InternalPlayerRecord, tx: number, ty: number, standoff: number): { x: number; y: number }
  resolvePlayerWeaponRangeAdder(player: InternalPlayerRecord): number
  isPlayerMeleeInRangeOfMonster(player: InternalPlayerRecord, monster: InternalMonsterRecord, fromX?: number | undefined, fromY?: number | undefined): boolean
  resolveMonsterTableFlags113c(monster: InternalMonsterRecord): {
  readonly corpseSel: boolean
  readonly soft: boolean
  readonly isAtt: boolean
  readonly align: number
  readonly monStatsBoss: boolean
  readonly primeevil: boolean
  readonly killable: boolean
}
  isTrueBossForCorpse113c(monster: InternalMonsterRecord, flags?: { readonly corpseSel: boolean; readonly soft: boolean; readonly isAtt: boolean; readonly align: number; readonly monStatsBoss: boolean; readonly primeevil: boolean; readonly killable: boolean } | undefined): boolean
  canSelectMonsterCorpse113c(monster: InternalMonsterRecord, requireSoft: boolean): boolean
  findNearestSelectableCorpse113c(areaId: number, tx: number, ty: number, requireSoft: boolean, explicitTarget?: InternalMonsterRecord): InternalMonsterRecord | undefined
  consumeMonsterCorpse113c(corpse: InternalMonsterRecord, stateId?: 104 | 118 | undefined): void
  executeFindPotion(player: InternalPlayerRecord, cast: PlayerSkillCast, corpse: InternalMonsterRecord): void
  executeFindItem(player: InternalPlayerRecord, cast: PlayerSkillCast, corpse: InternalMonsterRecord): void
  executeGrimWard(player: InternalPlayerRecord, cast: PlayerSkillCast, corpse: InternalMonsterRecord): void
  pulseGrimWard113c(ward: {
  readonly objectUnitId: number
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly slvl: number
  readonly radiusSubtiles: number
  readonly fleeDurationFrames: number
}): void
  stepGrimWards113c(): void
  getActiveGrimWards113c(): ReadonlyArray<{
  readonly objectUnitId: number
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly x: number
  readonly y: number
  readonly slvl: number
  readonly radiusSubtiles: number
  readonly fleeDurationFrames: number
  readonly expireFrame: number
}>
  resolvePlayerBladeWeaponDamage113c(player: InternalPlayerRecord): {
  readonly min: number
  readonly max: number
  readonly isTwoHanded: boolean
}
  degradeEquippedWeaponDurabilityOnHit113c(player: InternalPlayerRecord): void
  activateBladeShieldState113c(player: InternalPlayerRecord, slvl: number): void
  stepBladeShields113c(): void
  launchBladeFuryShot113c(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void
  stepBladeFuryChannels113c(): void
  executeBladeSentinel113c(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void
  executeBoneWall113c(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void
  executeBonePrison113c(player: InternalPlayerRecord, cast: PlayerSkillCast, targetX: number, targetY: number): void
  executeSlowMissiles113c(player: InternalPlayerRecord, cast: PlayerSkillCast): void
  computePlayerVengeanceWeaponBase113c(player: InternalPlayerRecord): {
  readonly vMin: number
  readonly vMax: number
  readonly griefFlat: number
  readonly physDamagePct: number
}
  executePaladinVengeance113c(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  isPlayerWhirlwinding113c(player: InternalPlayerRecord): boolean
  collectWhirlwindWeaponHandStats113c(item: ServerItemEntry): ItemStat[]
  resolveWhirlwindEquippedHandsForPlayer113c(player: InternalPlayerRecord): {
  readonly primaryHand: WhirlwindHandWeaponSpec113c
  readonly secondaryHand: WhirlwindHandWeaponSpec113c | null
} | null
  executeWhirlwind(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void
  finishWhirlwindSpin113c(player: InternalPlayerRecord): void
  computeWhirlwindFrameStep113c(player: InternalPlayerRecord): {
  readonly stepSubtiles: number
  readonly velocityPercent: number
}
  resolvePlayerSkillLevelById113c(player: InternalPlayerRecord, skillId: number): number
  resolveWeaponMasteryBonuses113c(player: InternalPlayerRecord, weaponType: string | undefined): { readonly edPct: number; readonly arPct: number; readonly critPct: number }
  sumWhirlwindHandStat113c(player: InternalPlayerRecord, hand: WhirlwindHandWeaponSpec113c, statId: number): number
  resolveWhirlwindHandPhysDamage113c(player: InternalPlayerRecord, hand: WhirlwindHandWeaponSpec113c, skillEdPct: number, masteryEdPct: number): { readonly min: number; readonly max: number }
  stepActiveWhirlwinds113c(): void
  executeWhirlwindHandStrike113c(player: InternalPlayerRecord, spin: WhirlwindSpinState113c, hand: WhirlwindHandWeaponSpec113c, monster: InternalMonsterRecord): void
  applyMonsterPreventHeal113c(monster: InternalMonsterRecord): void
  applyMonsterOpenWounds113c(attacker: InternalPlayerRecord, monster: InternalMonsterRecord, opts?: {
    readonly attackerLevel?: number | undefined
    readonly isRanged?: boolean | undefined
  }): void
  stepMonsterOpenWounds113c(): void
  applyDirectSkillDamage(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  isMonsterEligibleForConversion113c(monster: InternalMonsterRecord): boolean
  applyMonsterConversion113c(player: InternalPlayerRecord, monster: InternalMonsterRecord, skillId: number, slvl: number, durationOverrideFrames?: number): number
  executeMindBlast(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number): void
  executePaladinConversion(player: InternalPlayerRecord, cast: PlayerSkillCast, monster: InternalMonsterRecord): void
  executeCorpseExplosion(player: InternalPlayerRecord, cast: PlayerSkillCast, tx: number, ty: number, targetCorpse?: InternalMonsterRecord): void
  playerSkillPhysSynergyPct(cast: PlayerSkillCast): number
  launchPlayerSkillMissiles(player: InternalPlayerRecord, cast: PlayerSkillCast, missileRec: MissileRecord, tx: number, ty: number, primaryTarget?: InternalMonsterRecord, lockedTargetKey?: string): void
  executeStrafe(player: InternalPlayerRecord, cast: PlayerSkillCast, missileRec: MissileRecord, tx: number, ty: number, primaryTarget?: InternalMonsterRecord, primaryTargetKey?: string): void
  reportUnmodeledPlayerSrvDoFunc(skill: SkillRecord): void
  getUnmodeledPlayerSrvDoFuncs(): number[]
  clearPlayerChannelState(player: InternalPlayerRecord): void
  updatePlayerChannelState(player: InternalPlayerRecord, cast: PlayerSkillCast): void
  applyWarcryBuffToPlayer113c(caster: InternalPlayerRecord, target: InternalPlayerRecord, skill: SkillRecord, slvl: number, casterStatList: UnitStatList): void
  applyWarcryBuffToAlly113c(caster: InternalPlayerRecord, allyKind: 'merc' | 'pet', allyUnitId: number, skill: SkillRecord, slvl: number, casterStatList: UnitStatList, petRef?: SummonedPetUnit): void
}

export const playerSkillsAoeAndCorpseMethods: Record<keyof PlayerSkillsAoeAndCorpseMethods, unknown> = {
  applyPlayerSkillEffect,
  relocatePlayerForSkill,
  pointBefore,
  resolvePlayerWeaponRangeAdder,
  isPlayerMeleeInRangeOfMonster,
  resolveMonsterTableFlags113c,
  isTrueBossForCorpse113c,
  canSelectMonsterCorpse113c,
  findNearestSelectableCorpse113c,
  consumeMonsterCorpse113c,
  executeFindPotion,
  executeFindItem,
  executeGrimWard,
  pulseGrimWard113c,
  stepGrimWards113c,
  getActiveGrimWards113c,
  resolvePlayerBladeWeaponDamage113c,
  degradeEquippedWeaponDurabilityOnHit113c,
  activateBladeShieldState113c,
  stepBladeShields113c,
  launchBladeFuryShot113c,
  stepBladeFuryChannels113c,
  executeBladeSentinel113c,
  executeBoneWall113c,
  executeBonePrison113c,
  executeSlowMissiles113c,
  computePlayerVengeanceWeaponBase113c,
  executePaladinVengeance113c,
  isPlayerWhirlwinding113c,
  collectWhirlwindWeaponHandStats113c,
  resolveWhirlwindEquippedHandsForPlayer113c,
  executeWhirlwind,
  finishWhirlwindSpin113c,
  computeWhirlwindFrameStep113c,
  resolvePlayerSkillLevelById113c,
  resolveWeaponMasteryBonuses113c,
  sumWhirlwindHandStat113c,
  resolveWhirlwindHandPhysDamage113c,
  stepActiveWhirlwinds113c,
  executeWhirlwindHandStrike113c,
  applyMonsterPreventHeal113c,
  applyMonsterOpenWounds113c,
  stepMonsterOpenWounds113c,
  applyDirectSkillDamage,
  isMonsterEligibleForConversion113c,
  applyMonsterConversion113c,
  executeMindBlast,
  executePaladinConversion,
  executeCorpseExplosion,
  playerSkillPhysSynergyPct,
  launchPlayerSkillMissiles,
  executeStrafe,
  reportUnmodeledPlayerSrvDoFunc,
  getUnmodeledPlayerSrvDoFuncs,
  clearPlayerChannelState,
  updatePlayerChannelState,
  applyWarcryBuffToPlayer113c,
  applyWarcryBuffToAlly113c,
}
