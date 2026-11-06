/**
 * GameInstance Subsystem: Weapon Damage Rolls, Cast Commit, Player Pathfinding, Velocity & Vitals (`src/server/engine/game-instance/player-combat-and-vitals.ts`).
 */

import { createLinearMissilePath113c, linearMissileStep16_113c } from '../missile-path-113c.ts'
import type { MissileRecord, SkillRecord } from '../../../common/data/data-registry.ts'
import { LocalMovementPredictor } from '../../../common/path/movement-predictor.ts'
import { resolveArmorBlock113c, resolveArmorSpeed113c, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { findPathWorld, type SubTilePoint } from '../../../common/path/pathfind.ts'
import { CANONICAL_113C_OBJECTS } from '../../../common/world/objects-meta.ts'
import { doesDoorOrGateBlockMode113c, isDoorOrGateObject113c } from '../../../common/world/object-operate-113c.ts'
import { scaleLowQualityWeaponBand113c } from '../../../common/items/drop-tables.ts'
import { calculateHolyFreezeStats } from '../../../common/skills/paladin-auras.ts'
import { isBonePrisonMonsterHcIdx113c } from '../../../common/units/monai-113c.ts'
import { CANONICAL_CHARSTATS } from '../../../common/units/classes.ts'
import type { ServerEvent, UnitType } from '../../../netproto/index.ts'
import { FIXED_ONE } from '../stat-list.ts'
import { emitDotTraceEvent113c, stepPlayerUpdateHpRegen113c } from '../statregen-dot-113c.ts'
import { evaluateMonsterMissileDamage113c } from '../../ai/monster-missile-damage-113c.ts'
import { resolveMissilePierceIdx } from '../missile-pierce.ts'
import { resolveWeaponMasteryBonus113c } from '../../skills/passives-procs-113c.ts'
import { getAttackWeaponInfo } from '../../../common/skills/weapon-combat-meta.ts'
import { compute5BandScaling } from '../../../common/data/calc-ast.ts'
import { STATE_SLOWMISSILES_113C, snapshotBlessedHammerDamage256_113c } from '../../skills/p1-wave4-skills-113c.ts'
import { skillTabStatParam } from '../../../common/skills/skills-data.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMissileRecord, InternalPlayerRecord, PlayerMotionState, PlayerSkillCast, PlayerSkillMissileLaunchOptions113c } from './types.ts'
import { BODYLOC_LEFT_ARM, BODYLOC_RIGHT_ARM, CLASS_CODE_TO_ID, PLAYER_MISSILE_SPEED_SUBTILES, PLAYER_PATH_WINDOW_MARGIN, STAT_ITEM_CHARGED_SKILL, STAT_ITEM_MAXDAMAGE_PERCENT, STAT_MAXDAMAGE, STAT_MINDAMAGE, STAT_SECONDARY_MAXDAMAGE, STAT_SECONDARY_MINDAMAGE, SYNC_WARP_DELAY_FRAMES, SYNC_WARP_RANDOM_DELAY_FRAMES, TOWN_AREAS, UPDATE_POS_IGNORE_DISTANCE, UPDATE_POS_WARP_MAX_DISTANCE, UPDATE_POS_WARP_MIN_DISTANCE, collectItemStats, consumeSkillCharge, normalizeMissileElement, playerWirePosition, resolveArmorCombatMeta113c, unitsDistanceToCoordinates113c, UNIT_TYPE_113C, missileSpeedSubtilesPerFrame113c } from './constants-and-helpers.ts'


/**
 * Stat 188 param of the skill's tab: `SkillDesc.txt` `SkillPage` (1..3) of the row named by
 * `Skills.txt` `skilldesc`, on the class from `CharStats` order. `undefined` for skills without a
 * class tab (universal / monster rows).
 */
function resolveSkillTabParam(this: GameInstanceHost, skill: SkillRecord): number | undefined {
  const classId = CLASS_CODE_TO_ID[skill.charClass]
  if (classId === undefined || skill.skillDesc === '') return undefined
  const desc = this.registry.getSkillDesc(skill.skillDesc)
  if (desc === undefined) {
    throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown SkillDesc.txt row "${skill.skillDesc}"`)
  }
  const page = Number(desc['SkillPage'] ?? '')
  if (!Number.isInteger(page) || page < 1 || page > 3) return undefined
  return skillTabStatParam(classId, page - 1)
}



/**
 * `Skills.txt` `restrict` against the morph states (`States.txt` `restrict = 1`: `wolf` 139, `bear` 140, `delerium` 177):
 * 0 = refused while morphed, 1 = allowed in human & morph forms (unless `State1..3` narrows morph states), 2 = requires `State1..3`.
 */
function playerMeetsSkillRestrict(this: GameInstanceHost, player: InternalPlayerRecord, skill: SkillRecord): boolean {
  const hasStateNamed = (name: string): boolean => {
    if (name === '') return false
    const rec = this.registry.getStateByName(name)
    if (rec === undefined) {
      throw new Error(`GameInstance: Skills.txt row ${skill.id} references unknown States.txt row "${name}"`)
    }
    return player.states.has(rec.id)
  }
  const isMorphed = hasStateNamed('wolf') || hasStateNamed('bear') || hasStateNamed('delerium')
  const hasExplicitStates = skill.state1 !== '' || skill.state2 !== '' || skill.state3 !== ''
  if (skill.restrict === 2) {
    if (!hasExplicitStates) return isMorphed
    return hasStateNamed(skill.state1) || hasStateNamed(skill.state2) || hasStateNamed(skill.state3)
  }
  if (skill.restrict === 0) {
    return !isMorphed
  }
  if (isMorphed && hasExplicitStates) {
    return hasStateNamed(skill.state1) || hasStateNamed(skill.state2) || hasStateNamed(skill.state3)
  }
  return true
}



/**
 * Physical damage range of the equipped weapon (`Weapons.txt` via `resolveWeaponBase113c`,
 * `D2Game.dll` `0x6FCFC530..0x6FCFC71F`, #1628, #1629):
 * - Excludes inactive swap slots (`bodyLoc 11/12`).
 * - Includes on-weapon `item_maxdamage_percent` (17) + per-level (219), weapon flat `+min`/`+max`/`+normaldamage` (21/22/23/24/111/218),
 *   AND off-weapon flat `+min`/`+max`/`+normaldamage` (21/22/111/218) from armor, jewelry, sockets, charms, and set bonuses.
 * - Combines `skillEdPct + offWeaponEdPercent + statBonusPercent` into a SINGLE additive `%ED` pool clamped at `>= -90%`.
 */
function hasPlayerEquippedShield(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  for (const item of player.items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    if (item.bodyLoc !== BODYLOC_RIGHT_ARM && item.bodyLoc !== BODYLOC_LEFT_ARM) continue
    if (resolveArmorBlock113c(item.code) > 0 || (resolveArmorCombatMeta113c(item.code)?.smiteMaxDam ?? 0) > 0) {
      return true
    }
  }
  return false
}



function resolvePlayerSkillLevelById(this: GameInstanceHost, player: InternalPlayerRecord, skillId: number): number {
  const skill = this.registry.getSkillById(skillId)
  if (skill !== undefined) {
    return this.resolvePlayerSkillLevel(player, skill)
  }
  return player.skills.get(skillId) ?? 0
}



function resolveEquippedShieldSmiteDamage113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
): { min: number; max: number } | undefined {
  for (const item of player.items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    if (item.bodyLoc !== BODYLOC_RIGHT_ARM && item.bodyLoc !== BODYLOC_LEFT_ARM) continue
    const meta = resolveArmorCombatMeta113c(item.code)
    if (meta !== undefined && (meta.block > 0 || meta.smiteMaxDam > 0)) {
      return {
        min: Math.max(0, meta.smiteMinDam),
        max: Math.max(meta.smiteMinDam, meta.smiteMaxDam),
      }
    }
  }
  return undefined
}



function resolvePlayerWeaponDamage(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillEdPct = 0,
  options?: {
    readonly isThrow?: boolean | undefined
    readonly weaponHand?: 'left' | 'right' | undefined
    readonly excludeNormalDamage?: boolean | undefined
    readonly baseOnlyWithoutOffWeaponEd?: boolean | undefined
  },
): { min: number; max: number } {
  const equipped = player.items.filter(
    (i) => i.location === 'equipped' && i.bodyLoc !== 11 && i.bodyLoc !== 12,
  )
  const handItem = (loc: number) => equipped.find((i) => i.bodyLoc === loc)
  const right = handItem(BODYLOC_RIGHT_ARM)
  const left = handItem(BODYLOC_LEFT_ARM)
  const rightBase = right ? resolveWeaponBase113c(right.code) : undefined
  const leftBase = left ? resolveWeaponBase113c(left.code) : undefined
  const weapon =
    options?.weaponHand === 'left' && leftBase
      ? left
      : options?.weaponHand === 'right' && rightBase
        ? right
        : rightBase
          ? right
          : leftBase
            ? left
            : undefined
  const base =
    weapon === left && leftBase ? leftBase : weapon === right && rightBase ? rightBase : (rightBase ?? leftBase)
  const combat = this.playerCombat.get(player.unitId)
  const offWeaponItemEd =
    this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
    this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true })
  const offWeaponEdPercent =
    (combat === undefined ? 0 : combat.statList.getModifierBonus('damagepercent')) +
    offWeaponItemEd +
    skillEdPct
  const offWeapNormal = options?.excludeNormalDamage
    ? 0
    : this.sumPlayerItemStat(player, 111, { excludeWeaponHands: true })
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
  if (weapon === undefined || base === undefined) {
    const unarmed = getAttackWeaponInfo(null)
    const baseMin = unarmed.damageMin + offWeapFlatMin
    const baseMax = Math.max(baseMin, unarmed.damageMax + offWeapFlatMax)
    if (options?.baseOnlyWithoutOffWeaponEd) {
      return { min: Math.max(1, baseMin), max: Math.max(1, baseMax) }
    }
    const clampedEd = Math.max(-90, offWeaponEdPercent + totalStr)
    const min = Math.max(1, baseMin + Math.trunc((baseMin * clampedEd) / 100))
    const max = Math.max(min, baseMax + Math.trunc((baseMax * clampedEd) / 100))
    return { min, max }
  }
  const otherHand = weapon === right ? left : right
  const isThrowAttack =
    options?.isThrow === true &&
    base.minMisDam !== undefined &&
    base.maxMisDam !== undefined &&
    base.maxMisDam > 0
  // 1.13c `SUNITDMG_ApplyDamageBonuses` (`SUnitDmg.cpp:200`): weapon mastery `%ED` of the swinging weapon
  // (`#127..#129/#134/#136` melee, `#135` throws, `#252` claws) joins the single off-weapon `%ED` pool.
  const masteryEdPct =
    resolveWeaponMasteryBonus113c(base.type, isThrowAttack, (id) =>
      player.skills.has(id) || combat?.statList.getEffectiveSkillLevel(id) !== undefined
        ? this.resolvePlayerSkillLevelById(player, id)
        : 0,
    )?.damagePct ?? 0
  const useTwoHand =
    !isThrowAttack &&
    base.twoHanded &&
    base.twoHandedMindam !== undefined &&
    base.twoHandedMaxdam !== undefined &&
    (!base.oneOrTwoHanded || otherHand === undefined)
  const rawWeaponMin = isThrowAttack
    ? base.minMisDam!
    : useTwoHand
      ? base.twoHandedMindam!
      : base.mindam
  const rawWeaponMax = isThrowAttack
    ? base.maxMisDam!
    : useTwoHand
      ? base.twoHandedMaxdam!
      : base.maxdam
  // 1.13c `D2Common` ethereal weapon `+50%` base damage (`Math.floor(base * 3 / 2)`, #1794):
  // Applied to raw `Weapons.txt` `mindam`/`maxdam`/`2handmindam`/`2handmaxdam`/`minmisdam`/`maxmisdam`
  // BEFORE on-weapon `%ED` (`stat 17/219`) and flat `+min`/`+max` (`stat 21/22/23/24/111/159/160`).
  const isEthWeapon = Boolean(
    weapon.ethereal || ((weapon.rawItemData?.flags ?? 0) & 0x00400000) !== 0,
  )
  const isLowQualityWeapon =
    weapon.quality === 1 || weapon.rawItemData?.quality === 1
  const scaledRawWeapon = isLowQualityWeapon
    ? scaleLowQualityWeaponBand113c(rawWeaponMin, rawWeaponMax)
    : { min: rawWeaponMin, max: rawWeaponMax }
  const weaponMin = isEthWeapon ? Math.floor((scaledRawWeapon.min * 3) / 2) : scaledRawWeapon.min
  const weaponMax = isEthWeapon ? Math.floor((scaledRawWeapon.max * 3) / 2) : scaledRawWeapon.max
  let onWeaponEd = 0
  let flatMin = offWeapFlatMin
  let flatMax = offWeapFlatMax
  for (const stat of collectItemStats(weapon)) {
    if (stat.statId === STAT_ITEM_MAXDAMAGE_PERCENT) {
      onWeaponEd += stat.value
    } else if (stat.statId === 219) {
      onWeaponEd += (stat.value * player.level) >> 3
    } else if (!options?.excludeNormalDamage && stat.statId === 111) {
      flatMin += stat.value
      flatMax += stat.value
    } else if (
      stat.statId ===
        (isThrowAttack ? 159 : useTwoHand ? STAT_SECONDARY_MINDAMAGE : STAT_MINDAMAGE) ||
      (isThrowAttack && stat.statId === STAT_MINDAMAGE)
    ) {
      flatMin += stat.value
    } else if (
      stat.statId ===
        (isThrowAttack ? 160 : useTwoHand ? STAT_SECONDARY_MAXDAMAGE : STAT_MAXDAMAGE) ||
      (isThrowAttack && stat.statId === STAT_MAXDAMAGE)
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
  if (options?.baseOnlyWithoutOffWeaponEd) {
    return { min: Math.max(1, afterOnWeapMin), max: Math.max(1, afterOnWeapMax) }
  }
  const combinedEdPct = Math.max(-90, offWeaponEdPercent + masteryEdPct + statBonusPercent)
  const min = Math.max(1, afterOnWeapMin + Math.trunc((afterOnWeapMin * combinedEdPct) / 100))
  const max = Math.max(min, afterOnWeapMax + Math.trunc((afterOnWeapMax * combinedEdPct) / 100))
  return { min, max }
}



/** Spend the `Skills.txt` mana cost (256-fixed) and arm the `delay` cooldown of an accepted cast. */
function commitPlayerSkillCast(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast): void {
  if (cast.skill.id > 5 && this.playerCtcProcDepth === 0) {
    this.triggerPlayerCtcProcs113c(player, 200, {})
  }
  if (cast.chargeItem !== undefined) {
    // Charged casts cost a charge instead of mana (1.13c D2Game.dll 0x6FCBF4F8).
    const consumed = consumeSkillCharge(cast.chargeItem, cast.skill.id)
    this.emitToPlayer(player.unitId, {
      type: 'StatSet',
      unit: { unitType: 4, id: cast.chargeItem.unitId },
      stat: STAT_ITEM_CHARGED_SKILL,
      param: consumed.param,
      value: consumed.remainingCharges,
    })
    if (consumed.remainingCharges <= 0) {
      this.validatePlayerActiveSkills(player)
    }
  }
  const cost256 =
    cast.chargeItem !== undefined || cast.isNoCostInState ? 0 : cast.evalResult.manaCost256
  if (cost256 > 0) {
    if (player.states.has(114)) {
      // 1.13c D2Game.dll SKILLS_ConsumeMana (0x6FCBF92B..0x6FCBF93E, #1687, #1822):
      // When state 114 (blood_mana) is active on the caster, mana cost is paid from life (stat 6).
      player.hpFixed = Math.max(256, player.hpFixed - cost256)
      player.hp = Math.floor(player.hpFixed / FIXED_ONE)
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
    } else {
      player.manaFixed = Math.max(0, player.manaFixed - cost256)
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
  if (cast.evalResult.cooldownFrames > 0) {
    this.applyPlayerGlobalSkillDelay113c(player, cast.skill.id, cast.slvl, cast.evalResult.cooldownFrames)
  }
}



/**
 * Roll the damage of one cast from the registry evaluation: weapon-sourced part (`SrcDam`/128 of the
 * base hit, scaled by the skill's `%ED`), plus the `MinDam..MaxDam` physical band and the
 * `EMin..EMax` elemental band (only when `Skills.txt` / `Missiles.txt` define an `EType`, so buff
 * parameters stored in `EMin` such as Inner Sight or Energy Shield never turn into damage).
 */
function rollPlayerSkillPhysDamage(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  physDamagePctOverride?: number,
): number {
  // 1.13c `SKILLS_SrvDo150_Smite` (`0x6FD13220`, #1800):
  // Smite (`Skills.txt` #97, `SrcDam = 0`) uses equipped Shield `mindam..maxdam` (`RAW_ARMOR` cols 63..64)
  // + active Holy Shield (`state 101`) flat bonus (`Skills.txt` #117 `MinDam=3..MaxDam=6`, `+57..60` at slvl 20)
  // + `item_normaldamage` (`stat 111`, e.g. Grief), scaled by `(100 + totalStr + 15*slvl + offWeaponEdPercent) / 100`.
  if (cast.skill.id === 97) {
    const shieldDmg = this.resolveEquippedShieldSmiteDamage113c(player) ?? { min: 1, max: 3 }
    const combat = this.playerCombat.get(player.unitId)
    const hsEntry = combat?.stateBus.getState(101) ?? combat?.stateBus.getState('holyshield')
    const hasHs = hsEntry !== undefined || player.states.has(101)
    let hsMin = 0
    let hsMax = 0
    if (hasHs) {
      const hsLvl = Math.max(
        1,
        hsEntry?.stats['modifierlist_level'] ??
          hsEntry?.slvl ??
          this.resolvePlayerSkillLevelById(player, 117),
      )
      hsMin = compute5BandScaling(hsLvl, 3, 2, 3, 4, 4, 4)
      hsMax = compute5BandScaling(hsLvl, 6, 2, 3, 4, 4, 4)
    }
    const normalDmg = this.sumPlayerItemStat(player, 111)
    const baseMin = Math.max(1, shieldDmg.min + hsMin + normalDmg)
    const baseMax = Math.max(baseMin, shieldDmg.max + hsMax + normalDmg)
    const totalStr =
      player.strength +
      this.sumPlayerItemStat(player, 0) +
      (combat === undefined ? 0 : combat.statList.getModifierBonus('strength'))
    const offWeaponItemEd =
      this.sumPlayerItemStat(player, 17, { excludeWeaponHands: true }) +
      this.sumPlayerItemStat(player, 25, { excludeWeaponHands: true })
    const auraEd = combat === undefined ? 0 : combat.statList.getModifierBonus('damagepercent')
    const smiteEdPct = physDamagePctOverride ?? 15 * cast.slvl
    const combinedEdPct = Math.max(-90, totalStr + smiteEdPct + offWeaponItemEd + auraEd)
    const finalMin = Math.max(1, baseMin + Math.trunc((baseMin * combinedEdPct) / 100))
    const finalMax = Math.max(finalMin, baseMax + Math.trunc((baseMax * combinedEdPct) / 100))
    return this.rollInclusive(finalMin, finalMax)
  }

  const ev = cast.evalResult
  let total = 0
  if (ev.srcDam > 0) {
    const edPct = physDamagePctOverride ?? ev.physDamagePct
    const isThrowSkill =
      cast.skill.id === 2 ||
      cast.skill.id === 4 ||
      cast.skill.id === 140 ||
      (cast.missile !== undefined &&
        (cast.skill.srvStFunc === 4 ||
          cast.skill.id === 15 ||
          cast.skill.id === 25 ||
          cast.skill.id === 35))
    // 1.13c `D2Game.dll` `0x6FCFC530..0x6FCFC71F`: fold skill `%ED` into the single additive `%ED` pool
    // alongside attribute `%ED` and off-weapon `%ED` (#1628).
    const weapon = this.resolvePlayerWeaponDamage(player, edPct, {
      isThrow: isThrowSkill,
      ...(cast.skill.id === 4 ? { weaponHand: 'left' as const } : {}),
    })
    const weaponHit = Math.trunc((this.rollInclusive(weapon.min, weapon.max) * ev.srcDam) / 128)
    total += weaponHit
  }
  total += this.rollInclusive(ev.minPhysDmg, ev.maxPhysDmg)
  return total
}



function rollPlayerSkillDamage(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  physDamagePctOverride?: number,
): number {
  const ev = cast.evalResult
  let total = this.rollPlayerSkillPhysDamage(player, cast, physDamagePctOverride)
  const hasElemType = cast.skill.eType !== '' || (cast.missile?.eType ?? '') !== ''
  if (hasElemType) {
    total += this.rollInclusive(ev.minElemDmg, ev.maxElemDmg)
  }
  return total
}



function rollInclusive(this: GameInstanceHost, min: number, max: number): number {
  const lo = Math.max(0, Math.trunc(min))
  const hi = Math.max(lo, Math.trunc(max))
  return hi > lo ? lo + this.rng.rand(hi - lo + 1) : lo
}



/** Broadcast the 0x4D (location) / 0x4C (unit) cast so every client plays the caster's cast sequence. */
function broadcastPlayerSkillCast(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  target: { readonly x: number; readonly y: number } | { readonly unitType: UnitType; readonly id: number },
): void {
  this.broadcastToArea(player.areaId, {
    type: 'SkillCast',
    caster: { unitType: 0, id: player.unitId },
    skill: cast.skill.id,
    skillId: cast.skill.id,
    level: cast.slvl,
    target,
  })
}



/**
 * Resolve the caster's active Concentration (`#113`, `state 29`) `%ED` at the moment of casting
 * Blessed Hammer (`#112`, `D2Game.dll` `0x6FCB95B2`, #1878).
 */
function resolveActiveConcentrationEdPct113c(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const combat = this.playerCombat.get(player.unitId)
  const entry = combat?.stateBus.getState(42) ?? combat?.stateBus.getState('concentration')
  if (entry !== undefined) {
    const statEd = entry.stats['damagepercent'] ?? 0
    if (statEd > 0) return statEd
    if (entry.slvl > 0) return 60 + 15 * (entry.slvl - 1)
  }
  if (player.states.has(42) || this.playerActiveAuraState.get(player.unitId) === 42) {
    const concSlvl = Math.max(1, this.resolvePlayerSkillLevelById(player, 113))
    return 60 + 15 * (concSlvl - 1)
  }
  return 0
}



/**
 * Launch the skill's server missile (`Missiles.txt` row id, `Range` + `LevRange` lifetime). Missiles
 * with `Vel = 0` (Meteor / Blizzard / Fist of the Heavens centres, Blaze, ...) are created at the
 * target location, all others fly from the caster toward it.
 */
function launchPlayerSkillMissile(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  cast: PlayerSkillCast,
  missileRec: MissileRecord,
  tx: number,
  ty: number,
  damage: number,
  opts?: PlayerSkillMissileLaunchOptions113c,
): void {
  const stationary = missileRec.vel <= 0
  const fromX = opts?.fromX ?? player.x
  const fromY = opts?.fromY ?? player.y
  const startX = stationary ? tx : fromX
  const startY = stationary ? ty : fromY
  const rawDx = tx - fromX
  const rawDy = ty - fromY
  if (this.drlgRoomPopulator !== null && !stationary && Math.hypot(rawDx, rawDy) >= 100) {
    return
  }
  const isInPlaceHammer = cast.skill.id === 112 && Math.hypot(rawDx, rawDy) < 1e-6
  const effTx = isInPlaceHammer ? fromX - 1 : tx
  const effTy = isInPlaceHammer ? fromY - 1 : ty
  const dx = effTx - fromX
  const dy = effTy - fromY
  const dist = Math.max(1, Math.hypot(dx, dy))
  const rawVel =
    missileRec.vel +
    Math.trunc((missileRec.velLev * cast.slvl) / 8) +
    Math.trunc(opts?.velDelta ?? 0)
  const baseSpeed = stationary ? 0 : rawVel > 0 ? missileSpeedSubtilesPerFrame113c(rawVel) : PLAYER_MISSILE_SPEED_SUBTILES
  const speed = player.states.has(STATE_SLOWMISSILES_113C) ? baseSpeed * 0.33 : baseSpeed
  // 1.13c `SKILLS_SrvDo003_Throw` (`0x6FCC2BDC`) -> `SKILLS_SpawnLobbedMissile` (`0x6FCC1880`):
  // Throwing potions (`type = tpot`, `Missiles.txt` `#44..#49`, `CollideType = 6`, `AlwaysExplode = 1`)
  // spawn with `flags = 0x420` (lobbed arc to `(tx, ty)`) and evaluate their own `Missiles.txt`
  // `MinDamage..MaxDamage` + `EMin..Emax` (`D2Common#10413`, `SrcDamage = 0`, `Skill = ''`).
  const isLobbedThrowPotion =
    (cast.skill.id === 2 || cast.skill.id === 4 || cast.skill.id === 140) &&
    missileRec.collideType === 6 &&
    missileRec.alwaysExplode
  const baseLifetime = Math.max(1, missileRec.range + missileRec.levRange * cast.slvl)
  const lifetime =
    isLobbedThrowPotion && speed > 0
      ? Math.min(baseLifetime, Math.max(1, Math.ceil(Math.hypot(dx, dy) / speed)))
      : baseLifetime
  let lobbedPhysDamage: number | undefined
  let lobbedElemDamage: number | undefined
  if (isLobbedThrowPotion && missileRec.srcDamage <= 0 && missileRec.skill === '') {
    if (missileRec.pSrvHitFunc === 2) {
      damage = 0
      lobbedPhysDamage = 0
      lobbedElemDamage = 0
    } else if (missileRec.minDamage > 0 || missileRec.eMin > 0) {
      const diffIdx: 0 | 1 | 2 = this.difficulty === 2 ? 2 : this.difficulty === 1 ? 1 : 0
      const ownEval = evaluateMonsterMissileDamage113c({
        registry: this.registry,
        missile: missileRec,
        slvl: 1,
        difficulty: diffIdx,
        monsterMinPhys: 0,
        monsterMaxPhys: 0,
        rng: this.rng,
      })
      lobbedPhysDamage = ownEval.physDamage
      lobbedElemDamage = ownEval.elemDamage
      damage = Math.max(1, ownEval.totalDamage)
    }
  }
  const missileUnitId = this.allocateUnitId(UNIT_TYPE_113C.missile)
  const missileElem = normalizeMissileElement(missileRec.eType || cast.skill.eType)
  const isBlessedHammer = cast.skill.id === 112 && missileElem === 'mag'
  let hammerSnap256: number | undefined
  if (isBlessedHammer) {
    const rolledHammer256 = this.rollInclusive(cast.evalResult.minElemDmg256, cast.evalResult.maxElemDmg256)
    const concEdPct = this.resolveActiveConcentrationEdPct113c(player)
    hammerSnap256 = snapshotBlessedHammerDamage256_113c(rolledHammer256, concEdPct)
    damage = Math.max(1, Math.floor(hammerSnap256 / FIXED_ONE))
  }
  const isPoisonSkillMissile =
    damage > 0 &&
    (missileElem === 'pois' || cast.evalResult.elemType === 'pois') &&
    cast.evalResult.durationFrames > 0
  const poisonBitrate256 = isPoisonSkillMissile
    ? this.drlgRoomPopulator !== null
      ? cast.evalResult.minElemDmg256
      : this.rollInclusive(cast.evalResult.minElemDmg256, cast.evalResult.maxElemDmg256)
    : 0
  const physDamage =
    lobbedPhysDamage !== undefined
      ? lobbedPhysDamage
      : isPoisonSkillMissile
        ? this.rollPlayerSkillPhysDamage(player, cast)
        : damage
  const elemDurationFrames = isPoisonSkillMissile
    ? cast.evalResult.durationFrames
    : missileElem === 'cold'
      ? this.resolveSkillColdOrFreezeDuration113c(
          player,
          cast.skill.id,
          'cold',
          undefined,
          missileRec,
        ).rawFrames
      : 0
  const elemDamage =
    lobbedElemDamage !== undefined
      ? lobbedElemDamage
      : isPoisonSkillMissile
        ? Math.floor((poisonBitrate256 * elemDurationFrames) / FIXED_ONE)
        : 0
  // 1.13c `0x6FC8F660`:
  // - `CollideKill = 0` missiles unconditionally pass through units (`pierce: true`, no 4-pierce cap).
  // - `CollideKill = 1` rows with `Pierce = 1` (arrows, bolts, javelins, Lightning Fury, Exploding/Freezing Arrow)
  //   roll `pierce_idx` from `item_pierce (156) + skill_pierce (#33)` at creation, up to max 4 pierces (5 hits);
  //   without pierce stats they stop on the first unit (#1802, #1876).
  const pierceRemaining =
    opts?.forcePierce === true
      ? undefined
      : missileRec.pierce && missileRec.collideKill
        ? resolveMissilePierceIdx(missileRec, this.playerCombatContext(player), this.registry)
        : undefined
  const resolvedSrcDamage =
    missileRec.srcDamage > 0
      ? missileRec.srcDamage
      : missileRec.srcDamage === 0 && cast.evalResult.srcDam > 0
        ? cast.evalResult.srcDam
        : 0
  const linearPath113c =
    this.drlgRoomPopulator !== null && !stationary
      ? createLinearMissilePath113c(startX, startY, effTx, effTy, speed, missileRec.accel, missileRec.maxVel)
      : undefined
  const missile: InternalMissileRecord = {
    unitId: missileUnitId,
    missileId: missileRec.id,
    skillId: cast.skill.id,
    ownerType: 'player',
    ownerId: player.unitId,
    areaId: player.areaId,
    x: startX,
    y: startY,
    // DRLG oracle path: the 1.13c 16.16 linear path direction (`0x6FD5CF40`, kb/missile-velocity-range-113c.md).
    ...(this.drlgRoomPopulator !== null
      ? linearMissileStep16_113c(startX, startY, effTx, effTy, speed)
      : { vx: (dx / dist) * speed, vy: (dy / dist) * speed }),
    ...(linearPath113c !== undefined ? { linearPath113c } : {}),
    damage,
    ...(resolvedSrcDamage > 0 ? { srcDamage: resolvedSrcDamage } : {}),
    remainingFrames: lifetime,
    collideType: missileRec.collideType,
    size: Math.max(1, missileRec.size),
    pierce:
      opts?.forcePierce === true || !missileRec.collideKill
        ? true
        : pierceRemaining !== undefined
          ? pierceRemaining > 0
          : false,
    ...(pierceRemaining !== undefined ? { pierceRemaining } : {}),
    nextHit: missileRec.nextHit,
    nextDelay: Math.max(0, missileRec.nextDelay),
    element:
      normalizeMissileElement(missileRec.eType || cast.skill.eType) ?? 'phys',
    physDamage,
    elemDamage,
    ...(hammerSnap256 !== undefined
      ? { elemDamage256: hammerSnap256, concentrationSnapshotted: true }
      : {}),
    ...(opts?.bladeWeaponHit === true ? { bladeWeaponHit: true } : {}),
    elemDurationFrames,
    ...(isPoisonSkillMissile ? { poisonBitrate256 } : {}),
    srvHitElem256: { min: cast.evalResult.minElemDmg256, max: cast.evalResult.maxElemDmg256 },
    hitCooldowns: new Map(),
    guaranteedHit: !missileRec.toHit,
  }
  // #1790: every damage or functional missile is registered with its `MissileEngine` srvdo/srvhit
  // state; zero-damage carriers without a 1.13c server function (warcry / curse) stay visual only.
  this.registerPlayerSkillMissile113c(cast, missileRec, missile, damage, effTx, effTy, speed, opts)

  this.broadcastToArea(player.areaId, {
    type: 'CreateMissile',
    missileId: missileUnitId,
    missileClassId: missileRec.id,
    at: { x: Math.round(startX), y: Math.round(startY) },
    target: { x: Math.round(effTx), y: Math.round(effTy) },
    x: Math.round(startX),
    y: Math.round(startY),
    targetX: Math.round(effTx),
    targetY: Math.round(effTy),
    skillId: cast.skill.id,
    level: cast.slvl,
    ownerType: 0,
    ownerUnitType: 'player',
    ownerId: player.unitId,
    areaId: player.areaId,
  } as ServerEvent)
}



/** Static Field (`srvdofunc` 20): hits every hostile within the evaluated radius around the caster. */
function applyStaticField(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast): void {
  const radius = cast.evalResult.radiusSubtiles
  for (const m of this.monsters.values()) {
    if (m.dead || m.isNpc || m.submerged || m.areaId !== player.areaId) continue
    if (Math.hypot(m.x - player.x, m.y - player.y) <= radius) {
      this.applyDamageToMonster(player, m, 0, cast.skill.id)
    }
  }
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  for (const p of pvp.players) {
    if (p.hp <= 1 || Math.hypot(p.x - player.x, p.y - player.y) > radius) continue
    this.applyPvpHitToTarget113c(player, { kind: 'player', player: p }, {
      skillId: cast.skill.id,
      elemDamage: Math.max(1, Math.floor(p.hp * 0.25)),
      elemType: 'ltng',
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
      nonLethal: true,
    })
  }
  for (const c of pvp.mercs) {
    if (c.hp <= 1 || Math.hypot(c.x - player.x, c.y - player.y) > radius) continue
    this.applyPvpHitToTarget113c(player, { kind: 'merc', merc: c }, {
      skillId: cast.skill.id,
      elemDamage: Math.max(1, Math.floor(c.hp * 0.25)),
      elemType: 'ltng',
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
      nonLethal: true,
    })
  }
  for (const entry of pvp.pets) {
    if (entry.pet.hp <= 1 || Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) > radius) continue
    this.applyPvpHitToTarget113c(player, { kind: 'pet', ...entry }, {
      skillId: cast.skill.id,
      elemDamage: Math.max(1, Math.floor(entry.pet.hp * 0.25)),
      elemType: 'ltng',
      attackKind: 'spell',
      autoHit: true,
      unblockable: true,
      nonLethal: true,
    })
  }
}



/**
 * Nova ring (`srvdofunc` 22: Frost Nova 44, Nova 48, Poison Nova 92): radial ring of bolts
 * expanding 360° from the caster's position (`D2Game.dll` `srvdofunc` 22). Hits every hostile
 * within the missile ring expansion radius around `(player.x, player.y)`.
 */
function executeNovaSkill(this: GameInstanceHost, player: InternalPlayerRecord, cast: PlayerSkillCast): void {
  const msl = cast.missile
  const ringRadius =
    msl !== undefined
      ? Math.max(9, Math.round(((msl.vel || 16) * (msl.range || 14)) / 20))
      : 9
  for (const m of [...this.monsters.values()]) {
    if (m.dead || m.isNpc || m.submerged || m.areaId !== player.areaId) continue
    if (Math.hypot(m.x - player.x, m.y - player.y) <= ringRadius) {
      if (cast.evalResult.elemType === 'pois' && cast.evalResult.durationFrames > 0) {
        const bitrate256 = this.rollInclusive(
          cast.evalResult.minElemDmg256,
          cast.evalResult.maxElemDmg256,
        )
        if (bitrate256 > 0) {
          this.applyMonsterPoisonDot(
            player,
            m,
            bitrate256,
            cast.evalResult.durationFrames,
            cast.skill.id,
          )
        }
      } else {
        const damage = this.rollPlayerSkillDamage(player, cast)
        if (damage > 0) {
          this.applyDamageToMonster(player, m, damage, cast.skill.id)
        }
      }
    }
  }
  const pvp = this.collectHostilePvpTargetsInArea113c(player.unitId, player.areaId)
  for (const p of pvp.players) {
    if (Math.hypot(p.x - player.x, p.y - player.y) <= ringRadius) {
      this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'player', player: p }, 'spell')
    }
  }
  for (const c of pvp.mercs) {
    if (Math.hypot(c.x - player.x, c.y - player.y) <= ringRadius) {
      this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'merc', merc: c }, 'spell')
    }
  }
  for (const entry of pvp.pets) {
    if (Math.hypot(entry.pet.x - player.x, entry.pet.y - player.y) <= ringRadius) {
      this.applyPvpSkillHitToTarget113c(player, cast, { kind: 'pet', ...entry }, 'spell')
    }
  }
}



function getPlayerMotion(this: GameInstanceHost, player: InternalPlayerRecord): PlayerMotionState {
  let motion = this.playerMotion.get(player.unitId)
  if (!motion) {
    motion = {
      mover: new LocalMovementPredictor({ initialX: player.x, initialY: player.y }),
      x: player.x,
      y: player.y,
      plannedX: player.x,
      plannedY: player.y,
      moving: false,
      syncWarpUntilFrame: 0,
    }
    this.playerMotion.set(player.unitId, motion)
  }
  return motion
}



function syncBonePrisonMonstersIndex113c(host: GameInstanceHost): void {
  const wm = host.monsters.size * 134217728 + host.nextUnitIdByType[UNIT_TYPE_113C.monster]!
  if (host.bonePrisonsWatermark === wm) return
  host.bonePrisonsWatermark = wm
  host.bonePrisonMonsters.length = 0
  for (const m of host.monsters.values()) {
    if (isBonePrisonMonsterHcIdx113c(m.hcIdx)) {
      host.bonePrisonMonsters.push(m)
    }
  }
}

function syncDoorFootprintsIndex113c(host: GameInstanceHost): void {
  const wm = host.objects.size * 134217728 + host.nextUnitIdByType[UNIT_TYPE_113C.object]!
  if (host.doorFootprintsWatermark === wm) return
  host.doorFootprintsWatermark = wm
  host.doorFootprintsByArea.clear()
  for (const obj of host.objects.values()) {
    if (!isDoorOrGateObject113c(obj.classId)) continue
    const meta = CANONICAL_113C_OBJECTS[obj.classId]
    const sizeX = meta?.sizeX ?? 1
    const sizeY = meta?.sizeY ?? 1
    const minX = Math.round(obj.x) - Math.trunc(sizeX / 2)
    const minY = Math.round(obj.y) - Math.trunc(sizeY / 2)
    let list = host.doorFootprintsByArea.get(obj.areaId)
    if (list === undefined) {
      list = []
      host.doorFootprintsByArea.set(obj.areaId, list)
    }
    list.push({
      obj,
      minX,
      maxX: minX + sizeX,
      minY,
      maxY: minY + sizeY,
    })
  }
}

/**
 * Walkability of a world sub-tile for a player standing in `areaId`: the active area plus
 * every loaded seam neighbour (#1335), matching the client's cross-LevelView composite.
 */
/** True when at least one living BoneWall / Diablo BonePrison (`hcIdx 340..344`) exists in `areaId`. */
function hasLivingBonePrisonInArea(this: GameInstanceHost, areaId: number): boolean {
  syncBonePrisonMonstersIndex113c(this)
  for (let i = 0; i < this.bonePrisonMonsters.length; i++) {
    const m = this.bonePrisonMonsters[i]!
    if (!m.dead && m.areaId === areaId && this.monsters.get(m.unitId) === m) {
      return true
    }
  }
  return false
}



/** True when `(x, y)` is blocked by a living BoneWall / Diablo BonePrison segment (`#1825`). */
function isBlockedByBonePrison(this: GameInstanceHost, areaId: number, x: number, y: number): boolean {
  syncBonePrisonMonstersIndex113c(this)
  if (this.bonePrisonMonsters.length === 0) return false
  for (let i = 0; i < this.bonePrisonMonsters.length; i++) {
    const m = this.bonePrisonMonsters[i]!
    if (m.dead || m.areaId !== areaId || this.monsters.get(m.unitId) !== m) continue
    if (Math.hypot(m.x - x, m.y - y) < 1.3) return true
  }
  return false
}



function isWorldWalkableForPlayer(this: GameInstanceHost, areaId: number, x: number, y: number): boolean {
  if (this.isBlockedByBonePrison(areaId, x, y)) return false
  if (this.isClosedDoorAt(areaId, x, y)) return false
  const check = this.terrainWalkableCheck
  if (!check) return true
  const current = this.loadedAreas.get(areaId)
  if (!current) return check(areaId, x, y)
  if (current.isWalkable(areaId, x, y)) {
    return true
  }
  for (const id of current.adjacentAreaIds) {
    const area = this.loadedAreas.get(id)
    if (area && area.isWalkable(id, x, y)) {
      return !this.isClosedDoorAt(id, x, y)
    }
  }
  return false
}



/** Closed Objects.txt doors and non-isDoor gates (#1982) block their footprint until opened (mode 2). */
function isClosedDoorAt(this: GameInstanceHost, areaId: number, x: number, y: number, ignoreObjectUnitId?: number): boolean {
  syncDoorFootprintsIndex113c(this)
  const doors = this.doorFootprintsByArea.get(areaId)
  if (doors === undefined) return false
  for (let i = 0; i < doors.length; i++) {
    const entry = doors[i]!
    const obj = entry.obj
    if (obj.unitId === ignoreObjectUnitId) continue
    if (!doesDoorOrGateBlockMode113c(obj.classId, obj.mode) || obj.areaId !== areaId || this.objects.get(obj.unitId) !== obj) continue
    if (x >= entry.minX && x < entry.maxX && y >= entry.minY && y < entry.maxY) {
      return true
    }
  }
  return false
}



/** Sub-tile walk collision for a player (`true` = blocked) from the area collision callback or active Bone Prison / closed door. */
function isPlayerSubTileBlocked(this: GameInstanceHost, areaId: number, subX: number, subY: number): boolean {
  if (!this.terrainWalkableCheck) {
    return this.isBlockedByBonePrison(areaId, subX, subY) || this.isClosedDoorAt(areaId, subX, subY)
  }
  return !this.isWorldWalkableForPlayer(areaId, subX, subY)
}



/**
 * Player path from `(fromX, fromY)` to `(toX, toY)` with the client's `findPathWorld`
 * (`unitSize: 2`), over a collision window sampled from the area collision callback. Without a
 * collision callback (no level loaded) the path is the straight segment, unless a Bone Prison or closed door is active.
 */
function findPlayerPath(this: GameInstanceHost, 
  areaId: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): readonly SubTilePoint[] {
  const check = this.terrainWalkableCheck
  if (!check && !this.hasLivingBonePrisonInArea(areaId)) {
    syncDoorFootprintsIndex113c(this)
    const doors = this.doorFootprintsByArea.get(areaId)
    const hasBlockingDoor =
      doors !== undefined &&
      doors.some(
        (entry) =>
          entry.obj.areaId === areaId &&
          this.objects.get(entry.obj.unitId) === entry.obj &&
          doesDoorOrGateBlockMode113c(entry.obj.classId, entry.obj.mode),
      )
    if (!hasBlockingDoor) return [{ x: toX, y: toY }]
  }
  const margin = PLAYER_PATH_WINDOW_MARGIN
  const minX = Math.max(0, Math.floor(Math.min(fromX, toX)) - margin)
  const minY = Math.max(0, Math.floor(Math.min(fromY, toY)) - margin)
  const maxX = Math.floor(Math.max(fromX, toX)) + margin
  const maxY = Math.floor(Math.max(fromY, toY)) + margin
  const subWidth = maxX - minX + 1
  const subHeight = maxY - minY + 1
  const walkable = new Uint8Array(subWidth * subHeight)
  for (let ly = 0; ly < subHeight; ly++) {
    for (let lx = 0; lx < subWidth; lx++) {
      walkable[ly * subWidth + lx] = this.isWorldWalkableForPlayer(areaId, minX + lx, minY + ly) ? 1 : 0
    }
  }
  return findPathWorld(
    { subWidth, subHeight, walkable, subOriginX: minX, subOriginY: minY },
    fromX,
    fromY,
    toX,
    toY,
    { unitSize: 2 },
  ).path
}



/**
 * 1.13c move-velocity modifiers for the shared predictor: item FRW (stat 96), skill/aura
 * `velocitypercent` (stat 67), equipped armor `speed` penalty, chill/decrepify/holy-freeze
 * slow, and stamina exhaustion. Keeps server ticks aligned with the client predictor.
 */
function applyPlayerVelocityModifiers(this: GameInstanceHost, player: InternalPlayerRecord, mover: LocalMovementPredictor): void {
  const itemFrw = this.sumEquippedItemStat(player, 96)
  const combat = this.playerCombatContext(player)
  const velocityPercent = Math.trunc(combat.statList.getAccruedStat('velocitypercent'))
  const skillVelocityPercent = Math.max(0, velocityPercent)
  let armorSpeedPenaltyPercent = 0
  for (const item of player.items) {
    if (item.location === 'equipped' && item.durability > 0) {
      armorSpeedPenaltyPercent += resolveArmorSpeed113c(item.code)
    }
  }
  // 1.13c slow is the real state/stat total, not a fixed 50%: item_slow
  // (clay golem / chill), negative STAT_VELOCITYPERCENT, cold/decrepify 50%,
  // and Holy Freeze's diminishing-returns slowPct for an enemy-applied `holywindcold` (44).
  // The caster's own `holywind` (43) never slows: SrvDo081 (D2Game 0x6FCBABC0) puts only
  // `passivestat1..5` (cold damage) on the caster; `aurastat1..3` go to scanned targets.
  const itemSlow = Math.max(0, Math.trunc(combat.statList.getAccruedStat('item_slow')))
  const holy = combat.stateBus.getState('holywindcold')
  const holySlow = holy ? calculateHolyFreezeStats(holy.slvl).slowPct : 0
  const coldSlow = player.states.has(11) ? 50 : 0
  const decrepifySlow = player.states.has(60) ? 50 : 0
  const slowPercent = Math.max(
    itemSlow,
    Math.max(0, -velocityPercent),
    holySlow,
    coldSlow,
    decrepifySlow,
  )
  mover.setVelocityModifiers({
    fasterRunWalkPercent: itemFrw,
    skillVelocityPercent,
    armorSpeedPenaltyPercent,
    slowPercent,
    staminaExhausted: player.staminaExhausted || player.staminaFixed <= 0,
  })
}



/**
 * 1.13c per-tick stamina drain/recovery and life/mana regeneration (#1336).
 *
 * - Running drains `CharStats.RunDrain` (20 for most classes, 15 for Assassin) in
 *   1/256-point units per frame, scaled by the `stamdrain` item stat.
 * - Walking/idle recovers `maxstamina/256` per frame, scaled by `staminarecoverybonus`.
 * - Mana regenerates over `CharStats.ManaRegen` seconds (120 s full pool), scaled by
 *   `manaregen`; the `nomanaregen` state (85) suppresses it.
 * - Life regenerates `maxhp/65536` per frame plus `hpregen` (1/256 HP per frame);
 *   `item_replenish_life` is the equipped stat 74.
 */
/**
 * 1.13c `D2Game.dll` `0x6FC97BB0` (`PLAYER_DrainRunStamina`), invoked from `0x6FC99B90`
 * (`PLRMODE_WalkRunStep`) BEFORE `0x6FD01930` (`D2Common_10226`) advances the unit's position/room.
 */
function drainPlayerRunStamina113c(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (player.dead || !player.run || TOWN_AREAS.has(player.areaId)) return
  const charStats = CANONICAL_CHARSTATS[player.classCode]
  let drain = charStats.runDrain * 2
  for (const item of player.items) {
    if (
      item.location === 'equipped' &&
      item.bodyLoc === 3 &&
      (item.durability > 0 || item.maxDurability === 0)
    ) {
      const torsoSpeed = resolveArmorSpeed113c(item.code)
      // 1.13c `0x6FC97C27..0x6FC97C36`: `mov eax, 0x66666667; imul ecx; sar edx, 2` -> `trunc(dwSpeed / 10) + 1`.
      drain = Math.imul(drain, Math.trunc(torsoSpeed / 10) + 1)
      break
    }
  }
  const combat = this.playerCombatContext(player)
  const stat154 =
    this.sumPlayerItemStat(player, 154) +
    Math.trunc(combat.statList.getAccruedStat('item_staminadrainpct'))
  if (stat154 !== 0) {
    drain += Math.trunc((drain * stat154) / 100)
  }
  drain = Math.max(1, drain)
  player.staminaFixed = Math.max(0, player.staminaFixed - drain)
  if (player.staminaFixed <= 0) {
    player.staminaExhausted = true
    player.run = false
    player.mode = TOWN_AREAS.has(player.areaId) ? 6 : 2
  }
}

function stepPlayerVitals(this: GameInstanceHost, player: InternalPlayerRecord): void {
  if (player.dead) return
  const motion = this.getPlayerMotion(player)
  const running = player.run && motion.moving
  const charStats = CANONICAL_CHARSTATS[player.classCode]
  const beforeHp = player.hp
  const beforeMana = player.mana
  const beforeStamina = player.stamina
  const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
  const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
  const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)
  player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
  player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
  player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))

  // 1.13c `D2Game.dll` `0x6FC97A50` (jump table `0x6FC97B04`, `mode - 1`) handles `PLRMODE_RUN` (3)
  // only through its default case: recover at `maxstamina >> 8` when `staminarecoverybonus` (stat 28) >= 1000
  // (e.g. Stamina Shrine state 136), else nothing. Per-tick run drain (`0x6FC97BB0`) runs inside
  // `stepPlayerMovement` before stepping the unit (`0x6FC99B90`).
  if (running) {
    const recoveryPct =
      this.sumPlayerItemStat(player, 28) +
      Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('staminarecoverybonus'))
    if (recoveryPct >= 1000) {
      const base = accruedMaxStaminaFixed >> 8
      const recover = Math.max(0, base + Math.trunc((base * recoveryPct) / 100))
      player.staminaFixed = Math.min(accruedMaxStaminaFixed, player.staminaFixed + recover)
    }
  } else {
    // 1.13c `D2Game.dll` `0x6FC97A50` (`PLAYER_UpdateStamina`, #1632):
    // - Standing (`PLRMODE_NEUTRAL` / `PLRMODE_TOWNNEUTRAL`): shift `S = 8` (`maxStaminaFixed >> 8`), in town or outdoors.
    // - Walking (`PLRMODE_WALK` / `PLRMODE_TOWNWALK`):
    //   - Town walking (`inTown`) OR outdoor walking while `staminaFixed >= 256 && !staminaExhausted`: shift `S = 9` (`maxStaminaFixed >> 9`, half rate).
    //   - Outdoor walking while exhausted (`staminaFixed < 256 || staminaExhausted`): `0` recovery.
    const inTown = TOWN_AREAS.has(player.areaId)
    let baseStamRate = 0
    if (this.drlgRoomPopulator !== null) {
      if (player.mode === 1 || player.mode === 5) {
        baseStamRate = accruedMaxStaminaFixed >> 8
      } else if (
        (player.mode === 2 || player.mode === 6) &&
        (inTown || (player.staminaFixed >= 256 && !player.staminaExhausted))
      ) {
        baseStamRate = accruedMaxStaminaFixed >> 9
      }
    } else {
      const standing = !motion.moving
      if (standing) {
        baseStamRate = accruedMaxStaminaFixed >> 8
      } else if (inTown || (player.staminaFixed >= 256 && !player.staminaExhausted)) {
        baseStamRate = accruedMaxStaminaFixed >> 9
      }
    }
    if (baseStamRate > 0) {
      const recoveryPct =
        this.sumPlayerItemStat(player, 28) +
        Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('staminarecoverybonus'))
      const recover = Math.max(
        0,
        baseStamRate + (recoveryPct !== 0 ? Math.trunc((baseStamRate * recoveryPct) / 100) : 0),
      )
      player.staminaFixed = Math.min(accruedMaxStaminaFixed, player.staminaFixed + recover)
    }
  }

  // 25% hysteresis: exhausted players cannot run again until stamina is back
  // above a quarter of the maximum (or a potion/shrine refills it).
  if (
    player.staminaExhausted &&
    player.staminaFixed >= Math.floor(accruedMaxStaminaFixed / 4)
  ) {
    player.staminaExhausted = false
  }
  if (player.staminaExhausted) player.run = false

  // 1.13c `D2Game.dll` `0x6FC97950` (`PLAYER_UpdateManaRegen`, #1633):
  // `baseRate = max(1, trunc(maxManaFixed / 3000))`, scaled by `100 + stat27` (`manarecoverybonus`), plus flat `stat26` (`manarecovery`).
  if (!player.states.has(85)) {
    const combat = this.playerCombatContext(player)
    const manaRegenPct =
      this.sumPlayerItemStat(player, 27) +
      Math.trunc(combat.statList.getAccruedStat('manarecoverybonus')) +
      (player.states.has(135) && !combat.stateBus.hasState(135) ? 400 : 0)
    const flatManaRegen =
      this.sumPlayerItemStat(player, 26) +
      Math.trunc(combat.statList.getAccruedStat('manarecovery'))
    const baseManaRate = Math.max(
      1,
      Math.trunc(accruedMaxManaFixed / (25 * (charStats.manaRegenSeconds || 120))),
    )
    const manaPerFrame = Math.max(
      0,
      baseManaRate + Math.trunc((baseManaRate * manaRegenPct) / 100) + flatManaRegen,
    )
    player.manaFixed = Math.min(accruedMaxManaFixed, player.manaFixed + manaPerFrame)
  }

  // 1.13c `D2Game.dll` `0x6FC97CB0` (`PLAYER_UpdateHpRegen`, #1633, #1989):
  // Players have NO natural `maxhp / 65536` life regen (`MONSTER_Regen` is monsters only);
  // only `stat 74 hpregen` (`item_replenish_life` / Prayer / negative Poison DoT) modifies HP per frame,
  // and negative `hpregen` clamps at `256` (`1 HP`).
  const hpCombat = this.playerCombatContext(player)
  if (!player.states.has(2) && (hpCombat.stateBus.hasState(2) || hpCombat.stateBus.hasState('poison'))) {
    hpCombat.stateBus.removeState(2)
    hpCombat.stateBus.removeState('poison')
  }
  const hpRegen =
    this.sumPlayerItemStat(player, 74) +
    Math.trunc(hpCombat.statList.getAccruedStat('hpregen'))
  const hp0Fixed = player.hpFixed
  const playerRegenStep = stepPlayerUpdateHpRegen113c({
    hp0: hp0Fixed,
    maxHp256: accruedMaxHpFixed,
    hpRegen256: hpRegen,
  })
  if (playerRegenStep.clearHealthPot && player.states.has(100)) {
    this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 100)
  }
  if (playerRegenStep.changed) {
    player.hpFixed = playerRegenStep.hp1
    emitDotTraceEvent113c({
      unitType: 0,
      unitId: player.unitId,
      hp0: hp0Fixed,
      hp1: playerRegenStep.hp1,
    })
  }

  player.hp = Math.floor(player.hpFixed / FIXED_ONE)
  player.mana = Math.floor(player.manaFixed / FIXED_ONE)
  player.stamina = player.staminaExhausted
    ? 0
    : Math.floor(player.staminaFixed / FIXED_ONE)
  if (player.hp !== beforeHp) {
    this.emitToPlayer(player.unitId, {
      type: 'UnitStatUpdate',
      unitType: 'player',
      unitId: player.unitId,
      statId: 6,
      value: player.hpFixed,
    })
  }
  if (
    player.hp !== beforeHp ||
    player.mana !== beforeMana ||
    player.stamina !== beforeStamina
  ) {
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



/**
 * End of a path (arrival or blocked segment): the player stands, the other clients get the
 * stand `UnitMove`, and the owner gets an authoritative `LifeMana` position for its tolerance
 * gate (D2Client 0x6FADA1B0, flag 0, zero motion vector).
 */
function finishPlayerMove(this: GameInstanceHost, player: InternalPlayerRecord, motion: PlayerMotionState): void {
  motion.mover.stop()
  motion.moving = false
  player.targetX = player.x
  player.targetY = player.y
  motion.plannedX = player.x
  motion.plannedY = player.y
  player.mode = TOWN_AREAS.has(player.areaId) ? 5 : 1
  this.areaPathWorld.stopPlayer(player.unitId, player.mode)
  const at = { x: Math.round(player.x), y: Math.round(player.y) }
  this.broadcastToAreaExcept(player.areaId, player.unitId, {
    type: 'UnitMove',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    mode: 'stop',
    from: at,
    to: at,
    x: at.x,
    y: at.y,
    currentX: at.x,
    currentY: at.y,
    targetX: at.x,
    targetY: at.y,
  })
  this.emitToPlayer(player.unitId, {
    type: 'LifeMana',
    life: player.hp,
    mana: player.mana,
    stamina: player.stamina,
    at,
    vx: 0,
    vy: 0,
  })
  if (player.queuedSkillOnTarget !== undefined) {
    const queued = player.queuedSkillOnTarget
    player.queuedSkillOnTarget = undefined
    player.moveTargetUnitId = undefined
    this.executeSkillOnTarget(player, queued.skillId, queued.targetId, queued.targetType)
  }
}



/**
 * C2S `0x4B RequestEntityUpdate` (D2Game `Rcv0x4B_RequestEntityUpdate`, `0x6FCEC6E0` ->
 * `0x6FCEBB10` `D2GAME_SendPacket0x15_ReassignPlayer(pUnit, pClient, bRefresh=1)`).
 * Sends S2C `0x15 UnitReassign` with `revalidate: true` (`snap: false`) for the requested unit.
 */
function handleRequestEntityUpdate(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  unitType: number,
  unitId: number,
): void {
  if (player.dead) return
  if (unitType === 0) {
    const targetPlayer =
      unitId === player.unitId ? player : this.players.get(unitId)
    if (!targetPlayer || targetPlayer.areaId !== player.areaId) return
    const sx = Math.round(targetPlayer.x)
    const sy = Math.round(targetPlayer.y)
    this.emitToPlayer(player.unitId, {
      type: 'UnitReassign',
      unitType: 0,
      id: targetPlayer.unitId,
      unitId: targetPlayer.unitId,
      at: { x: sx, y: sy },
      x: sx,
      y: sy,
      snap: false,
    })
    return
  }
  if (unitType === 1) {
    const mon = this.monsters.get(unitId)
    if (!mon || mon.dead || mon.areaId !== player.areaId) return
    const sx = Math.round(mon.x)
    const sy = Math.round(mon.y)
    this.emitToPlayer(player.unitId, {
      type: 'UnitReassign',
      unitType: 1,
      id: mon.unitId,
      unitId: mon.unitId,
      at: { x: sx, y: sy },
      x: sx,
      y: sy,
      snap: false,
    })
  }
}



/**
 * C2S `0x5F UpdatePlayerPos` (D2Game `D2GAME_PACKETCALLBACK_Rcv0x5F_UpdatePlayerPos`,
 * 0x6FC88530, D2MOO `PlrMsg.cpp`). The client sends its own sub-tile when its tolerance gate
 * finds the server position out of range:
 *  - dead player → ignored;
 *  - distance < 5 → ignored;
 *  - `STATE_SYNC_WARPED`, distance < 15 or > 45 → walk (run if in RN) toward the reported
 *    position (`sub_6FC817D0`);
 *  - otherwise warp to the reported position when a path reaches it exactly, setting
 *    `STATE_SYNC_WARPED` for 125 frames; if not, answer S2C `0x15` with the server position.
 */
function handleUpdatePlayerPos(this: GameInstanceHost, player: InternalPlayerRecord, clientX: number, clientY: number): void {
  if (player.dead) return
  if (
    !Number.isInteger(clientX) ||
    !Number.isInteger(clientY) ||
    clientX < 0 ||
    clientY < 0 ||
    clientX > 0xffff ||
    clientY > 0xffff
  ) {
    return
  }
  const serverX = Math.round(player.x)
  const serverY = Math.round(player.y)
  const distance = unitsDistanceToCoordinates113c(serverX, serverY, clientX, clientY)
  if (distance < UPDATE_POS_IGNORE_DISTANCE) return

  const motion = this.getPlayerMotion(player)
  const syncWarped = this.currentFrame < motion.syncWarpUntilFrame
  if (
    syncWarped ||
    distance < UPDATE_POS_WARP_MIN_DISTANCE ||
    distance > UPDATE_POS_WARP_MAX_DISTANCE
  ) {
    player.run = player.mode === 3
    player.mode = player.run ? 3 : (TOWN_AREAS.has(player.areaId) ? 6 : 2)
    player.targetX = clientX
    player.targetY = clientY
    return
  }

  const path = this.findPlayerPath(player.areaId, serverX, serverY, clientX, clientY)
  const last = path[path.length - 1]
  const reachesClient =
    last !== undefined && Math.round(last.x) === clientX && Math.round(last.y) === clientY
  if (!reachesClient) {
    this.rubberbandPlayer113c(player)
    return
  }

  player.x = clientX
  player.y = clientY
  this.areaPathWorld.spawnOrSyncPlayer(
    player.areaId,
    player.unitId,
    player.classId,
    clientX,
    clientY,
    player.mode,
  )
  if (!motion.moving) {
    // An idle player stays put; a moving one keeps heading for its target from the new spot.
    player.targetX = clientX
    player.targetY = clientY
  }
  motion.syncWarpUntilFrame =
    this.currentFrame +
    SYNC_WARP_DELAY_FRAMES +
    this.rng.rand(SYNC_WARP_RANDOM_DELAY_FRAMES + 1)
  // The owner is already at the reported position; only the other clients are re-placed.
  this.broadcastToAreaExcept(player.areaId, player.unitId, {
    type: 'UnitReassign',
    unitType: 0,
    id: player.unitId,
    unitId: player.unitId,
    at: { x: clientX, y: clientY },
    x: clientX,
    y: clientY,
    snap: false,
  })
}

export interface PlayerCombatAndVitalsMethods {
  resolveSkillTabParam(skill: SkillRecord): number | undefined
  playerMeetsSkillRestrict(player: InternalPlayerRecord, skill: SkillRecord): boolean
  hasPlayerEquippedShield(player: InternalPlayerRecord): boolean
  resolvePlayerSkillLevelById(player: InternalPlayerRecord, skillId: number): number
  resolveEquippedShieldSmiteDamage113c(player: InternalPlayerRecord): { min: number; max: number } | undefined
  resolvePlayerWeaponDamage(player: InternalPlayerRecord, skillEdPct?: number | undefined, options?: {
    readonly isThrow?: boolean | undefined
    readonly weaponHand?: 'left' | 'right' | undefined
    readonly excludeNormalDamage?: boolean | undefined
    readonly baseOnlyWithoutOffWeaponEd?: boolean | undefined
  }): { min: number; max: number }
  commitPlayerSkillCast(player: InternalPlayerRecord, cast: PlayerSkillCast): void
  rollPlayerSkillPhysDamage(player: InternalPlayerRecord, cast: PlayerSkillCast, physDamagePctOverride?: number): number
  rollPlayerSkillDamage(player: InternalPlayerRecord, cast: PlayerSkillCast, physDamagePctOverride?: number): number
  rollInclusive(min: number, max: number): number
  broadcastPlayerSkillCast(player: InternalPlayerRecord, cast: PlayerSkillCast, target: { readonly x: number; readonly y: number } | { readonly unitType: UnitType; readonly id: number }): void
  resolveActiveConcentrationEdPct113c(player: InternalPlayerRecord): number
  launchPlayerSkillMissile(player: InternalPlayerRecord, cast: PlayerSkillCast, missileRec: MissileRecord, tx: number, ty: number, damage: number, opts?: PlayerSkillMissileLaunchOptions113c): void
  applyStaticField(player: InternalPlayerRecord, cast: PlayerSkillCast): void
  executeNovaSkill(player: InternalPlayerRecord, cast: PlayerSkillCast): void
  getPlayerMotion(player: InternalPlayerRecord): PlayerMotionState
  hasLivingBonePrisonInArea(areaId: number): boolean
  isBlockedByBonePrison(areaId: number, x: number, y: number): boolean
  isWorldWalkableForPlayer(areaId: number, x: number, y: number): boolean
  isClosedDoorAt(areaId: number, x: number, y: number, ignoreObjectUnitId?: number): boolean
  isPlayerSubTileBlocked(areaId: number, subX: number, subY: number): boolean
  findPlayerPath(areaId: number, fromX: number, fromY: number, toX: number, toY: number): readonly SubTilePoint[]
  applyPlayerVelocityModifiers(player: InternalPlayerRecord, mover: LocalMovementPredictor): void
  drainPlayerRunStamina113c(player: InternalPlayerRecord): void
  stepPlayerVitals(player: InternalPlayerRecord): void
  finishPlayerMove(player: InternalPlayerRecord, motion: PlayerMotionState): void
  handleRequestEntityUpdate(player: InternalPlayerRecord, unitType: number, unitId: number): void
  handleUpdatePlayerPos(player: InternalPlayerRecord, clientX: number, clientY: number): void
}

export const playerCombatAndVitalsMethods: Record<keyof PlayerCombatAndVitalsMethods, unknown> = {
  resolveSkillTabParam,
  playerMeetsSkillRestrict,
  hasPlayerEquippedShield,
  resolvePlayerSkillLevelById,
  resolveEquippedShieldSmiteDamage113c,
  resolvePlayerWeaponDamage,
  commitPlayerSkillCast,
  rollPlayerSkillPhysDamage,
  rollPlayerSkillDamage,
  rollInclusive,
  broadcastPlayerSkillCast,
  resolveActiveConcentrationEdPct113c,
  launchPlayerSkillMissile,
  applyStaticField,
  executeNovaSkill,
  getPlayerMotion,
  hasLivingBonePrisonInArea,
  isBlockedByBonePrison,
  isWorldWalkableForPlayer,
  isClosedDoorAt,
  isPlayerSubTileBlocked,
  findPlayerPath,
  applyPlayerVelocityModifiers,
  drainPlayerRunStamina113c,
  stepPlayerVitals,
  finishPlayerMove,
  handleRequestEntityUpdate,
  handleUpdatePlayerPos,
}
