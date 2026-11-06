/**
 * GameInstance Subsystem: Monster Damage Application, Poison/Cold/Freeze, Death Explosions & Hit Recovery (`src/server/engine/game-instance/monster-damage.ts`).
 */

import type { MissileRecord } from '../../../common/data/data-registry.ts'
import { MONSTER_PATH_DATA, MONSTER_PATH_DATA_STRIDE } from '../../../common/path/monster-path-data.ts'
import { MONMODE_BLOCK, MONMODE_KNOCKBACK } from '../../../common/path/types.ts'
import { computeGetHitEffRate113c, computeOneShotTicks, computeStepSpeed256, resolveArmorBlock113c, resolveCharacterAnimSpeedParams, resolveEquippedWeaponClass, resolveWeaponBase113c } from '../../../common/units/char-anim-speed.ts'
import { D2Rng } from '../../../common/rng/d2-rng.ts'
import { PALADIN_AURA_STATE_BY_SKILL_ID } from '../../../common/skills/paladin-auras.ts'
import { MONSTATS_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { isBonePrisonMonsterHcIdx113c } from '../../../common/units/monai-113c.ts'
import { resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import { MON_UMOD, computeChargedBolt8WayVectors, isScarabMonster } from '../../../common/units/monster-death-fx.ts'
import { LIGHTNING_UMOD_COOLDOWN_FRAMES_113C, SCARAB_BUGLIGHTNING_MISSILE_ID_113C, TELEPORT_UMOD_COOLDOWN_FRAMES_113C, TELEPORT_UMOD_GATE1_PCT_113C, TELEPORT_UMOD_GATE2_PCT_113C, TELEPORT_UMOD_HEAL_CHANCE_PCT_113C, computeLightningEnchantedBoltSlvl113c, computeLightningUniqueBoltDamage113c, computeScarabBugLightningDamage113c, computeScarabChargedBoltFanTargets113c, computeScarabChargedBoltSlvl113c, evaluateTeleportUMod113c, hasImplicitShatterOnDeathUMod113c, isTeleportUModRangedMonster113c } from '../../ai/monumod-113c.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import { computeEquippedArmorPieceDefense113c } from '../../items/server-item-data.ts'
import { scaleMercenaryBossDamage113c } from '../../ai/mercenary-ai.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import { calculateCrushingBlow113c, computeKnockbackStep113c, executeSUnitDmg, resolveHitClassCode113c, rollItemKnockback113c, shouldEnterGetHit113c, type SUnitDmgPacket, type CombatUnitContext } from '../combat-pipeline.ts'
import { createDefaultNpcIntroData } from '../../save/d2s-writer.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { allocateEvent3Seq113c, computeMonsterBaseDamageRegen113c } from '../statregen-dot-113c.ts'
import { StateBus } from '../state-bus.ts'
import { compute3BandDuration, computeDiminishingReturns, evaluateCalc } from '../../../common/data/calc-ast.ts'
import { difficultyLifeStealDivisor, difficultyManaStealDivisor, difficultyMonsterColdDivisor, difficultyMonsterFreezeDivisor } from '../difficulty-resist-penalty.ts'
import { scaleMonStatsPoisonRider113c } from '../../ai/monster-missile-damage-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord } from './types.ts'
import { monsterHp256_113c, MONSTER_HIT_RECOVERY_FRAMES, MONSTER_KNOCKBACK_DISTANCE, MONSTER_KNOCKBACK_SKILLS, MONSTER_THREAT_FRAMES, SKILL_WHIRLWIND_113C, STATE_SANCTUARY_113C, areaToAct, playerWirePosition, UNIT_TYPE_113C } from './constants-and-helpers.ts'
import { rollLimitedSeed113c } from './unit-seeds-113c.ts'


function applyDamageToMonster(this: GameInstanceHost, 
  attackerOrMonsterId: InternalPlayerRecord | number,
  monsterOrDamage: InternalMonsterRecord | number,
  damageOrAttackerId?: number,
  skillIdArg?: number,
  channelOverride?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  source: 'player' | 'merc' | InternalMercenaryRecord | SummonedPetUnit = 'player',
  hitContext?: {
    readonly attackKind?: 'melee' | 'missile' | 'spell' | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly elemDurationFrames?: number | undefined
    readonly toHitBonusPct?: number | undefined
    readonly weaponHand?: 'left' | 'right' | undefined
    readonly elemDamage256?: number | undefined
    readonly concentrationAlreadyApplied?: boolean | undefined
    readonly bladeWeaponHit?: boolean | undefined
    readonly bladeShieldPulse?: boolean | undefined
    readonly outHitResult?: { landedHitRoll: boolean } | undefined
    readonly srcDam?: number | undefined
    readonly skipHitRiders?: boolean | undefined
    readonly skipElemMastery?: boolean | undefined
    readonly missileHitFlags113c?: number | undefined
    readonly missileResultFlags113c?: number | undefined
    readonly suppressReturnFireThreat?: boolean | undefined
    readonly isGroundFire?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly noHitRecovery?: boolean | undefined
    readonly suppressBlockAnim?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly fromPet?: boolean | undefined
    readonly allowDeadTarget113c?: boolean | undefined
    readonly d2AttackerSeed113c?: { lo: number; hi: number } | undefined
    readonly unrolledWeaponBase113c?:
      | {
          readonly min256: number
          readonly max256: number
          readonly edPct: number
          readonly srcDam: number
          readonly enDmgPct113c?: number | undefined
        }
      | undefined
    readonly vengeanceSpec?:
      | {
          readonly weaponBaseRolled: number
          readonly physDamagePct: number
          readonly griefFlat: number
          readonly multiElemPacket: NonNullable<SUnitDmgPacket["multiElemPacket"]>
        }
      | undefined
  },
): boolean {
  let attacker: InternalPlayerRecord | undefined
  let monster: InternalMonsterRecord | undefined
  let damage: number
  const hasExplicitSkillId = skillIdArg !== undefined
  const resolvedSkillId = skillIdArg ?? 0
  let skillId: number
  let mercAttacker: InternalMercenaryRecord | undefined =
    typeof source === 'object' && source !== null && 'subType' in source ? source : undefined
  const petAttacker: SummonedPetUnit | undefined =
    typeof source === 'object' && source !== null && 'petType' in source ? source : undefined
  let effectiveSource: 'player' | 'merc' =
    source === 'merc' || mercAttacker !== undefined || (channelOverride as string | undefined) === 'merc'
      ? 'merc'
      : 'player'
  if (typeof attackerOrMonsterId === 'number') {
    monster = this.monsters.get(attackerOrMonsterId)
    damage = Number(monsterOrDamage)
    // A bare numeric attacker id names a player first: player and mercenary (monster) ids come from
    // different per-type counters (`SUNIT_GetNewUnitId` 0x6FCFF9C0) and may be equal. It is read as a
    // mercenary id only when the caller flagged a merc source or no player owns that id.
    if (
      mercAttacker === undefined &&
      typeof damageOrAttackerId === 'number' &&
      (effectiveSource === 'merc' || !this.players.has(damageOrAttackerId))
    ) {
      mercAttacker = this.mercenaries.get(damageOrAttackerId)
    }
    if (mercAttacker !== undefined) {
      effectiveSource = 'merc'
    }
    attacker =
      (typeof damageOrAttackerId === 'number'
        ? (this.players.get(damageOrAttackerId) ??
          (mercAttacker !== undefined
            ? this.players.get(mercAttacker.ownerPlayerId)
            : undefined))
        : undefined) ?? this.players.values().next().value
    skillId = resolvedSkillId
  } else {
    attacker = attackerOrMonsterId
    monster = monsterOrDamage as InternalMonsterRecord
    damage = Number(damageOrAttackerId ?? 0)
    skillId = resolvedSkillId
  }
  const wasAlreadyDead113c = Boolean(monster?.dead && hitContext?.allowDeadTarget113c)
  if (!monster || (monster.dead && !wasAlreadyDead113c) || monster.isNpc || !monster.isKillable || monster.submerged) return false
  if (monster.align !== 0) {
    const canBreakHostileBoneWall =
      monster.boneConstructOwnerPlayerId !== undefined &&
      attacker !== undefined &&
      attacker.unitId > 0 &&
      attacker.unitId !== monster.boneConstructOwnerPlayerId &&
      this.isHostilePvpPair113c(
        attacker.unitId,
        attacker.areaId,
        monster.boneConstructOwnerPlayerId,
        monster.areaId,
        true,
      )
    if (!canBreakHostileBoneWall) return false
  }
  if (effectiveSource === 'merc' && mercAttacker === undefined && attacker !== undefined) {
    for (const m of this.mercenaries.values()) {
      if (m.ownerPlayerId === attacker.unitId && m.alive) {
        mercAttacker = m
        break
      }
    }
  }
  monster.lastHitByMerc = effectiveSource === 'merc'
  if (!attacker) {
    attacker = {
      unitId: 0,
      name: 'DefaultAttacker',
      classId: 0,
      classCode: 'ama',
      level: 30,
      act: 0,
      areaId: monster.areaId,
      x: monster.x,
      y: monster.y,
      targetX: monster.x,
      targetY: monster.y,
      run: true,
      mode: 1,
      hp: 500,
      maxHp: 500,
      hpFixed: 500 * FIXED_ONE,
      maxHpFixed: 500 * FIXED_ONE,
      mana: 200,
      maxMana: 200,
      manaFixed: 200 * FIXED_ONE,
      maxManaFixed: 200 * FIXED_ONE,
      stamina: 200,
      maxStamina: 200,
      staminaFixed: 200 * FIXED_ONE,
      maxStaminaFixed: 200 * FIXED_ONE,
      staminaExhausted: false,
      experience: 0,
      gold: 0,
      goldBank: 0,
      strength: 50,
      dexterity: 50,
      vitality: 50,
      energy: 50,
      ar: 10000,
      statPts: 0,
      newSkills: 0,
      leftSkill: 0,
      rightSkill: 0,
      altLeftSkill: 0,
      altRightSkill: 0,
      npcIntro: createDefaultNpcIntroData(),
      createdTimestampSec: 1_700_000_000,
      lastPlayedTimestampSec: 1_700_000_000,
      connectedFrame: 0,
      skills: new Map(),
      states: new Set(),
      stateTimers: new Map(),
      items: [],
      corpseItems: [],
      ironGolemItem: null,
      waypoints: new Set([1]),
      hasExplicitWaypoints: false,
      activeWaypointUnitId: 0,
      unlockedAct: 0,
      lastWarpInteractFrame: -1000,
      revealedRoomKeys: new Set(),
      questFlags: new Uint16Array(48),
      vendorPools: new Map(),
      vendorPoolModes: new Map(),
      vendorPoolsByMode: new Map(),
      activeVendorMode: null,
      dead: false,
      corpseId: undefined,
      corpseX: 0,
      corpseY: 0,
      activeNpcId: undefined,
      partyId: 0xffff,
      hotkeys: new Array<number>(16).fill(0xffff),
      hotkeyItemIds: new Array<number>(16).fill(0xffffffff),
      d2sTemplate: undefined,
    }
  }
  if (attacker === undefined) return false

  // 1.13c Holy Bolt (skillId 101): undead-only gate (deals 0 damage to non-undead targets)
  if (skillId === 101 && !monster.isUndead) {
    return false
  }

  const attackerStats = new UnitStatList(this.registry, undefined, {
    ownerType: petAttacker !== undefined || effectiveSource === 'merc' ? 'monster' : 'player',
    charClass: attacker.classCode,
  })
  if (petAttacker !== undefined) {
    attackerStats.setBaseStat('level', petAttacker.statList.getAccruedStat('level') || attacker.level)
    attackerStats.setBaseStat('strength', petAttacker.statList.getAccruedStat('strength'))
    attackerStats.setBaseStat('dexterity', petAttacker.statList.getAccruedStat('dexterity'))
    attackerStats.setBaseStat('tohit', petAttacker.statList.getAccruedStat('tohit'))
    attackerStats.setBaseStat('item_tohit_percent', petAttacker.statList.getAccruedStat('item_tohit_percent'))
    attackerStats.setBaseStat('armorclass', petAttacker.statList.getAccruedStat('armorclass'))
    attackerStats.setBaseStat('damagepercent', petAttacker.statList.getAccruedStat('damagepercent'))
    attackerStats.setBaseStat('mindamage', petAttacker.statList.getAccruedStat('mindamage'))
    attackerStats.setBaseStat('maxdamage', petAttacker.statList.getAccruedStat('maxdamage'))
    attackerStats.setBaseStat('item_normaldamage', petAttacker.statList.getAccruedStat('item_normaldamage'))
    attackerStats.setBaseStat('passive_critical_strike', petAttacker.statList.getAccruedStat('passive_critical_strike'))
    attackerStats.setBaseStat('maxhp', petAttacker.statList.getAccruedStat('maxhp'))
    attackerStats.setHp256(petAttacker.statList.getHp256())
  } else if (effectiveSource === 'merc' && mercAttacker !== undefined) {
    const mercHireStats = resolveHirelingStatsAtLevel(
      mercAttacker.subType,
      mercAttacker.act,
      mercAttacker.difficulty,
      mercAttacker.level,
      true,
    )
    const mercStr =
      (mercHireStats?.str ?? 50 + mercAttacker.level * 2) +
      this.sumMercItemStat(mercAttacker, 0)
    const mercDex =
      (mercHireStats?.dex ?? 40 + mercAttacker.level * 2) +
      this.sumMercItemStat(mercAttacker, 2)
    const mercAr =
      (mercAttacker.ar ?? mercHireStats?.ar ?? 100 + mercAttacker.level * 20) +
      this.sumMercItemStat(mercAttacker, 19)
    attackerStats.setBaseStat('level', mercAttacker.level)
    attackerStats.setBaseStat('strength', mercStr)
    attackerStats.setBaseStat('dexterity', mercDex)
    attackerStats.setBaseStat('tohit', mercAr)
    attackerStats.setBaseStat('item_tohit_percent', this.sumMercItemStat(mercAttacker, 119))
    let mercArmorPieceDef = 0
    for (const eq of mercAttacker.equipment ?? []) {
      if (eq.identified === false || eq.rawItemData?.identified === false) continue
      if ((eq as { readonly broken?: boolean }).broken === true || eq.rawItemData?.broken === true) continue
      if (eq.rawItemData?.defense !== undefined) {
        mercArmorPieceDef += computeEquippedArmorPieceDefense113c(eq, undefined)
      }
    }
    attackerStats.setBaseStat(
      'armorclass',
      (mercAttacker.defense ?? 0) + mercArmorPieceDef + this.sumMercItemStat(mercAttacker, 31),
    )
    attackerStats.setBaseStat('item_ignoretargetac', this.sumMercItemStat(mercAttacker, 115))
    attackerStats.setBaseStat('item_fractionaltargetac', this.sumMercItemStat(mercAttacker, 116))
    attackerStats.setBaseStat('item_damagetargetac', this.sumMercItemStat(mercAttacker, 120))
    attackerStats.setBaseStat('item_stupidity', this.sumMercItemStat(mercAttacker, 113))
    attackerStats.setBaseStat('item_howl', this.sumMercItemStat(mercAttacker, 112))
    attackerStats.setBaseStat('damageresist', this.sumMercItemStat(mercAttacker, 36))
    attackerStats.setBaseStat('item_demondamage_percent', this.sumMercItemStat(mercAttacker, 121))
    attackerStats.setBaseStat('item_undeaddamage_percent', this.sumMercItemStat(mercAttacker, 122))
    attackerStats.setBaseStat('item_demon_tohit', this.sumMercItemStat(mercAttacker, 123))
    attackerStats.setBaseStat('item_undead_tohit', this.sumMercItemStat(mercAttacker, 124))
    attackerStats.setBaseStat('item_deadlystrike', this.sumMercItemStat(mercAttacker, 141))
    attackerStats.setBaseStat('lifedrainmindam', Math.max(0, this.sumMercItemStat(mercAttacker, 60)))
    attackerStats.setBaseStat('maxhp', mercAttacker.maxHp * FIXED_ONE)
    attackerStats.setHp256(mercAttacker.hp * FIXED_ONE)
    this.applyItemMasteryPierceStats113c(attackerStats, (statId) => this.sumMercItemStat(mercAttacker!, statId))
  } else {
    attackerStats.setBaseStat('level', attacker.level)
    attackerStats.setBaseStat('strength', attacker.strength + this.sumPlayerItemStat(attacker, 0))
    attackerStats.setBaseStat('dexterity', attacker.dexterity + this.sumPlayerItemStat(attacker, 2))
    attackerStats.setBaseStat('vitality', attacker.vitality + this.sumPlayerItemStat(attacker, 3))
    attackerStats.setBaseStat('energy', attacker.energy + this.sumPlayerItemStat(attacker, 1))
    attackerStats.setBaseStat('tohit', this.computePlayerBaseToHit113c(attacker))
    attackerStats.setBaseStat('item_tohit_percent', this.computePlayerToHitPctBonus113c(attacker))
    attackerStats.setBaseStat('armorclass', this.computePlayerBaseDefense(attacker))
    const atkHandOpts =
      hitContext?.weaponHand !== undefined ? { weaponHand: hitContext.weaponHand } : undefined
    attackerStats.setBaseStat('item_ignoretargetac', this.sumPlayerItemStat(attacker, 115, atkHandOpts))
    attackerStats.setBaseStat('item_fractionaltargetac', this.sumPlayerItemStat(attacker, 116, atkHandOpts))
    attackerStats.setBaseStat('item_damagetargetac', this.sumPlayerItemStat(attacker, 120, atkHandOpts))
    attackerStats.setBaseStat('item_stupidity', this.sumPlayerItemStat(attacker, 113, atkHandOpts))
    attackerStats.setBaseStat('item_howl', this.sumPlayerItemStat(attacker, 112, atkHandOpts))
    attackerStats.setBaseStat('damageresist', this.playerResistPct(attacker, 'phys'))
    attackerStats.setBaseStat('item_demondamage_percent', this.sumPlayerItemStat(attacker, 121, atkHandOpts))
    attackerStats.setBaseStat('item_undeaddamage_percent', this.sumPlayerItemStat(attacker, 122))
    attackerStats.setBaseStat('item_demon_tohit', this.sumPlayerItemStat(attacker, 123))
    attackerStats.setBaseStat('item_undead_tohit', this.sumPlayerItemStat(attacker, 124))
    attackerStats.setBaseStat('item_deadlystrike', this.sumPlayerItemStat(attacker, 141))
    attackerStats.setBaseStat('maxhp', this.getPlayerAccruedMaxHpFixed(attacker))
    attackerStats.setHp256(attacker.hpFixed)
    attackerStats.setBaseStat('maxmana', this.getPlayerAccruedMaxManaFixed(attacker))
    attackerStats.setMana256(attacker.manaFixed)
    attackerStats.setBaseStat('maxstamina', this.getPlayerAccruedMaxStaminaFixed(attacker))
    attackerStats.setBaseStat('stamina', attacker.staminaFixed)
    // 1.13c passive statlists of the attacker (`#9` CS, `#23` Penetrate, `#61/#63/#65` Sorceress masteries,
    // weapon masteries) + gear elemental mastery / pierce `329..336` (#1801, #1802, #1803, #1804).
    if (petAttacker === undefined && this.players.get(attacker.unitId) === attacker) {
      this.applyItemMasteryPierceStats113c(attackerStats, (statId) => this.sumPlayerItemStat(attacker!, statId))
      this.syncPlayerSkillLevelsToStatList113c(
        attacker,
        attackerStats,
        this.playerCombat.get(attacker.unitId)?.stateBus,
      )
    }
  }
  // Life / mana steal (D2Game 0x6FCFBA40) belongs to the real player that landed the hit; a
  // hireling hit routed through its owner (`source === 'merc'`) never steals for the owner.
  const stealer =
    effectiveSource === 'player' &&
    petAttacker === undefined &&
    this.players.get(attacker.unitId) === attacker
      ? attacker
      : undefined
  if (stealer !== undefined) {
    attackerStats.setBaseStat('lifedrainmindam', this.playerStealPct(stealer, 60))
    attackerStats.setBaseStat('manadrainmindam', this.playerStealPct(stealer, 62))
  }
  const attackerStateBus = new StateBus(attackerStats, this.registry)
  if (petAttacker === undefined && effectiveSource === 'player') {
    this.mirrorPersistentStates(this.playerCombat.get(attacker.unitId), attackerStateBus)
  } else if (petAttacker === undefined && effectiveSource === 'merc' && mercAttacker !== undefined) {
    this.mirrorPersistentStates(this.mercCombat.get(mercAttacker.unitId), attackerStateBus)
  }
  // 1.13c `STATE_SANCTUARY` (47) lives only on the aura bearer (selected #119 aura or `stat 151`
  // Lawbringer / Azurewrath item aura); `SUnitDmg` reads it to ignore positive Undead `damageresist` (#1807).
  if (petAttacker === undefined && !attackerStateBus.hasState('sanctuary')) {
    const bearerHasSanctuary =
      effectiveSource === 'merc' && mercAttacker !== undefined
        ? mercAttacker.states.has(STATE_SANCTUARY_113C) ||
          this.getMercOwnCasterAuraStates113c(mercAttacker.unitId).has(STATE_SANCTUARY_113C)
        : effectiveSource === 'player' &&
          (attacker.states.has(STATE_SANCTUARY_113C) ||
            this.getPlayerOwnCasterAuraStates113c(attacker.unitId).has(STATE_SANCTUARY_113C))
    if (bearerHasSanctuary) {
      attackerStateBus.applyState({
        stateNameOrId: 'sanctuary',
        sourceUnitId: effectiveSource === 'merc' ? `merc_${mercAttacker!.unitId}` : `player_${attacker.unitId}`,
        sourceSkillId: 119,
        slvl: 1,
        currentFrame: this.currentFrame,
        stats: { skill_bypass_undead: 1 },
        isAuraOverride: true,
      })
    }
  }
  // 1.13c: Sanctuary's `aurastat1 = item_undeaddamage_percent` sits on a statlist that `SUnitDmg` never reads
  // for the bearer's weapon damage (only the Undead `damageresist` bypass applies, #1807).
  const sanctuaryEntry = petAttacker === undefined ? attackerStateBus.getState('sanctuary') : undefined
  if (sanctuaryEntry !== undefined && (sanctuaryEntry.stats['item_undeaddamage_percent'] ?? 0) !== 0) {
    const { item_undeaddamage_percent: _ignoredUndeadEd, ...keptStats } = sanctuaryEntry.stats
    attackerStateBus.removeState('sanctuary')
    attackerStateBus.applyState({
      stateNameOrId: 'sanctuary',
      sourceUnitId: sanctuaryEntry.sourceUnitId,
      sourceSkillId: 119,
      slvl: sanctuaryEntry.slvl,
      currentFrame: this.currentFrame,
      stats: keptStats,
      isAuraOverride: true,
    })
  }
  const playerHandWeaponTypes =
    petAttacker === undefined && effectiveSource === 'player'
      ? this.resolvePlayerHandWeaponTypes113c(attacker)
      : undefined
  const swingingWeaponType =
    hitContext?.weaponHand === 'left' && playerHandWeaponTypes?.left !== undefined
      ? playerHandWeaponTypes.left
      : (playerHandWeaponTypes?.right ?? playerHandWeaponTypes?.left)
  const attackerCtx: CombatUnitContext = {
    id:
      petAttacker !== undefined
        ? petAttacker.id
        : effectiveSource === 'merc' && mercAttacker !== undefined
          ? `merc_${mercAttacker.unitId}`
          : `player_${attacker.unitId}`,
    name:
      petAttacker !== undefined
        ? petAttacker.petType
        : effectiveSource === 'merc' && mercAttacker !== undefined
          ? mercAttacker.name
          : attacker.name,
    unitType: petAttacker !== undefined || effectiveSource === 'merc' ? 'monster' : 'player',
    statList: attackerStats,
    stateBus: attackerStateBus,
    x:
      petAttacker !== undefined
        ? petAttacker.x
        : effectiveSource === 'merc' && mercAttacker !== undefined
          ? mercAttacker.x
          : attacker.x,
    y:
      petAttacker !== undefined
        ? petAttacker.y
        : effectiveSource === 'merc' && mercAttacker !== undefined
          ? mercAttacker.y
          : attacker.y,
    weaponMinPhys: hitContext?.vengeanceSpec?.weaponBaseRolled ?? 0,
    weaponMaxPhys: hitContext?.vengeanceSpec?.weaponBaseRolled ?? 0,
    ...(petAttacker === undefined && effectiveSource === 'player'
      ? { armorClassIncludesDex: true }
      : {}),
    ...(swingingWeaponType !== undefined
      ? {
          weaponItemType: swingingWeaponType,
          ...(playerHandWeaponTypes?.left !== undefined
            ? { offHandWeaponItemType: playerHandWeaponTypes.left }
            : {}),
        }
      : {}),
    lifeStealDivisor: difficultyLifeStealDivisor(this.difficulty),
    manaStealDivisor: difficultyManaStealDivisor(this.difficulty),
  }

  const defenderStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
  defenderStats.setBaseStat('level', monster.level)
  defenderStats.setBaseStat('armorclass', monster.ac)
  defenderStats.setBaseStat('toblock', monster.toBlock)
  defenderStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  defenderStats.setHp256(wasAlreadyDead113c ? 0 : monsterHp256_113c(monster))
  defenderStats.setBaseStat('damageresist', monster.resistances.phys)
  defenderStats.setBaseStat('magicresist', monster.resistances.magic)
  defenderStats.setBaseStat('fireresist', monster.resistances.fire)
  defenderStats.setBaseStat('lightresist', monster.resistances.light)
  defenderStats.setBaseStat('coldresist', monster.resistances.cold)
  defenderStats.setBaseStat('poisonresist', monster.resistances.poison)

  const defenderStateBus = new StateBus(defenderStats, this.registry)

  // Curses / aura debuffs (Conviction, Holy Freeze, ...) carried by the monster's persistent bus.
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
    isChampion: monster.rank === 'champion',
    isSuperUnique: monster.superUniqueId !== undefined,
    rank: monster.rank,
    drain: monster.drain,
    monsterColdDivisor: difficultyMonsterColdDivisor(this.difficulty),
    monsterFreezeDivisor: difficultyMonsterFreezeDivisor(this.difficulty),
  }

  const isDirectTestDamage =
    typeof attackerOrMonsterId === 'number' &&
    !hasExplicitSkillId &&
    effectiveSource === 'player' &&
    petAttacker === undefined &&
    hitContext === undefined
  const defaultHitClass =
    isDirectTestDamage
      ? { attackKind: 'spell' as const, autoHit: true, unblockable: true }
      : petAttacker !== undefined
        ? petAttacker.isStationary ||
          petAttacker.kind === 'skeleton_mage' ||
          petAttacker.petType === 'assassintrap' ||
          petAttacker.petType === 'hydra' ||
          petAttacker.petType === 'totem' ||
          petAttacker.petType === 'vine'
          ? { attackKind: 'spell' as const, autoHit: true, unblockable: true }
          : { attackKind: 'melee' as const, autoHit: false, unblockable: false }
        : effectiveSource === 'merc'
          ? { attackKind: 'melee' as const, autoHit: false, unblockable: false }
          : this.classifyPlayerHitRoll113c(skillId)
  const hitAttackKind = hitContext?.attackKind ?? defaultHitClass.attackKind
  const hitAutoHit = hitContext?.autoHit ?? defaultHitClass.autoHit
  const hitUnblockable = hitContext?.unblockable ?? defaultHitClass.unblockable
  const skillToHitBonusPct =
    hitContext?.toHitBonusPct ??
    (petAttacker === undefined && effectiveSource === 'player'
      ? this.computePlayerSkillToHitBonusPct113c(attacker, skillId)
      : 0)

  const channel = channelOverride ?? this.resolveSkillDamageChannel(skillId)
  const handItemOpts =
    hitContext?.weaponHand !== undefined ? { weaponHand: hitContext.weaponHand } : undefined
  const weaponSrcDam =
    stealer !== undefined
      ? channel === 'phys'
        ? (hitContext?.srcDam ??
          (!isDirectTestDamage &&
          (hitAttackKind === 'melee' || hitAttackKind === 'missile') &&
          skillId !== 97
            ? skillId === 0
              ? 128
              : (this.registry?.getSkillById(skillId)?.srcDam ?? 0)
            : 0))
        : (hitContext?.srcDam ?? 0)
      : 0
  if (stealer !== undefined && weaponSrcDam > 0) {
    attackerStats.setBaseStat('firemindam', this.sumPlayerItemStat(attacker, 48, handItemOpts))
    attackerStats.setBaseStat('firemaxdam', this.sumPlayerItemStat(attacker, 49, handItemOpts))
    attackerStats.setBaseStat('lightmindam', this.sumPlayerItemStat(attacker, 50, handItemOpts))
    attackerStats.setBaseStat('lightmaxdam', this.sumPlayerItemStat(attacker, 51, handItemOpts))
    attackerStats.setBaseStat('magicmindam', this.sumPlayerItemStat(attacker, 52, handItemOpts))
    attackerStats.setBaseStat('magicmaxdam', this.sumPlayerItemStat(attacker, 53, handItemOpts))
    const wColdMin = this.sumPlayerItemStat(attacker, 54, handItemOpts)
    const wColdMax = this.sumPlayerItemStat(attacker, 55, handItemOpts)
    attackerStats.setBaseStat('coldmindam', wColdMin)
    attackerStats.setBaseStat('coldmaxdam', wColdMax)
    const wColdLen = this.sumPlayerItemStat(attacker, 56, handItemOpts)
    attackerStats.setBaseStat('coldlength', wColdLen)
    if (skillId !== 73) {
      ;(attackerCtx as { weaponPoisonSources?: CombatUnitContext['weaponPoisonSources'] }).weaponPoisonSources =
        this.collectPlayerWeaponPoisonSources113c(
          attacker,
          hitContext?.weaponHand ? { weaponHand: hitContext.weaponHand } : undefined,
        )
    }
  }
  const rawDmg = Math.max(0, Math.floor(damage))
  let dealtDamage = 0
  let resolvedDmg256: number | undefined
  let ctcOnHitPending = false

  if (skillId === 42) {
    // 1.13c Static Field (skillId 42): 25% current HP reduction with difficulty floor caps
    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId: 42,
      attackKind: 'spell',
      srcDam: 0,
      elemType: 'ltng',
      elemMin256: 0,
      elemMax256: 0,
      autoHit: true,
      unblockable: true,
    }, this.rng)
    if (dmgOut.immuneToElem || dmgOut.elemDamage256 <= 0) {
      return false
    }
    const floorPct =
      this.difficulty === 2 ? 50 : this.difficulty === 1 ? 33 : 0
    const minHp =
      floorPct > 0
        ? Math.max(1, Math.floor((monster.maxHp * floorPct) / 100))
        : 1
    if (monster.hp <= minHp) {
      return false
    }
    const staticLoss = Math.max(1, Math.floor(dmgOut.elemDamage256 / FIXED_ONE))
    const nextHp = Math.max(minHp, monster.hp - staticLoss)
    dealtDamage = monster.hp - nextHp
    if (dealtDamage <= 0) {
      return false
    }
  } else if (channel === 'phys') {
    // 1.13c item event `item_skillonattack` (195): every player melee swing attempt (hit or miss),
    // never during Whirlwind (#151), Blade Shield (#277), or from a proc cast (#1797, #1884).
    const isSpellPhys = hitAttackKind === 'spell'
    const isBladeShieldPulse = hitContext?.bladeShieldPulse === true
    const isBladeWeaponHit = hitContext?.bladeWeaponHit === true
    const vSpec = hitContext?.vengeanceSpec
    const isPlayerWeaponSwing =
      stealer !== undefined &&
      hitAttackKind === 'melee' &&
      !isBladeShieldPulse &&
      skillId !== SKILL_WHIRLWIND_113C &&
      this.playerCtcProcDepth === 0
    if (isPlayerWeaponSwing) {
      this.triggerPlayerCtcProcs113c(attacker, 195, { target: monster })
      if (monster.dead && !wasAlreadyDead113c) return false
    }
    const uwb113c = hitContext?.unrolledWeaponBase113c
    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId,
      attackKind: hitAttackKind,
      srcDam: vSpec !== undefined ? 128 : uwb113c !== undefined ? uwb113c.srcDam : 0,
      ...(vSpec === undefined && weaponSrcDam > 0 ? { riderSrcDam: weaponSrcDam } : {}),
      flatPhysMin256: vSpec !== undefined || uwb113c !== undefined ? 0 : rawDmg * FIXED_ONE,
      flatPhysMax256: vSpec !== undefined || uwb113c !== undefined ? 0 : rawDmg * FIXED_ONE,
      ...(hitContext?.d2AttackerSeed113c !== undefined
        ? {
            d2AttackerSeed113c: hitContext.d2AttackerSeed113c,
            d2DefenderSeed113c: this.unitSeeds.get(`${UNIT_TYPE_113C.monster}:${monster.unitId}`),
          }
        : {}),
      ...(uwb113c !== undefined ? { unrolledWeaponBase113c: uwb113c } : {}),
      ...(vSpec !== undefined
        ? {
            physDamagePct: vSpec.physDamagePct,
            multiElemPacket: vSpec.multiElemPacket,
          }
        : {}),
      ...(isSpellPhys || isBladeWeaponHit || isBladeShieldPulse
        ? { preScaledPhysEd: true, skipMasteryEd: true }
        : playerHandWeaponTypes !== undefined && vSpec === undefined
          ? { skipMasteryEd: true }
          : {}),
      ...(isSpellPhys
        ? {}
        : { weaponHand: hitContext?.weaponHand }),
      ...(hitContext?.damageRate !== undefined && hitContext.damageRate > 0
        ? { damageRate: hitContext.damageRate }
        : {}),
      toHitBonusPct: skillToHitBonusPct,
      autoHit: hitAutoHit,
      unblockable: hitUnblockable,
    }, this.rng)
    if (hitContext?.outHitResult !== undefined) {
      hitContext.outHitResult.landedHitRoll = dmgOut.hit
    }
    if (!dmgOut.hit) {
      if (dmgOut.avoidedReason === 'block' && !hitContext?.suppressBlockAnim) {
        monster.mode = MONMODE_BLOCK
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: MONMODE_BLOCK,
          lifePct:
            monster.maxHp > 0
              ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
              : 0,
        })
      }
      return false
    }
    if (hitContext?.outHitResult !== undefined) {
      hitContext.outHitResult.landedHitRoll = true
    }
    const updatedMonBaseAc = Math.max(0, Math.trunc(defenderStats.getBaseStat('armorclass')))
    if (updatedMonBaseAc !== monster.ac) {
      monster.ac = updatedMonBaseAc
      this.monsterCombat.get(monster.unitId)?.statList.setBaseStat('armorclass', monster.ac)
    }
    if (!monster.states.has(23) && defenderStateBus.hasState('dimvision')) {
      const dvDur = defenderStateBus.getState('dimvision')?.durationFrames ?? 125
      this.applyMonsterState(monster.unitId, 23, dvDur)
    }
    if (!monster.states.has(56) && defenderStateBus.hasState('terror')) {
      const terrorDur = defenderStateBus.getState('terror')?.durationFrames ?? 150
      this.applyMonsterState(monster.unitId, 56, terrorDur)
      monster.fleeTicks = Math.max(monster.fleeTicks, terrorDur)
    }
    if (isBladeShieldPulse && stealer !== undefined) {
      this.degradeEquippedWeaponDurabilityOnHit113c(stealer)
    }
    if (stealer !== undefined && !isSpellPhys) {
      this.applyPlayerStealOutcome(stealer, dmgOut)
      const selfAndReflectDmg = Math.floor(
        ((dmgOut.reflectedPhys256 ?? 0) + (dmgOut.selfDamageTaken256 ?? 0)) / FIXED_ONE,
      )
      if (selfAndReflectDmg > 0 && !stealer.dead) {
        this.applyDamageToPlayer(stealer, selfAndReflectDmg, {
          skipGetHit: skillId === 96,
          killerType: 'monster',
          killerUnitId: monster.unitId,
        })
      }
    }
    // 1.13c `item_skillonhit` (198): landed melee / missile weapon hits only (no Whirlwind, no spells, no #277/#257).
    ctcOnHitPending =
      stealer !== undefined &&
      (hitAttackKind === 'melee' || hitAttackKind === 'missile') &&
      !isBladeShieldPulse &&
      skillId !== 257 &&
      skillId !== SKILL_WHIRLWIND_113C &&
      this.playerCtcProcDepth === 0
    let totalDmg256 = dmgOut.totalDamage256
    if (vSpec !== undefined && vSpec.griefFlat > 0 && !dmgOut.immuneToPhys) {
      const physResPct =
        attackerStateBus.hasState('sanctuary') && monster.isUndead
          ? Math.min(0, defenderStats.getAccruedStat('damageresist'))
          : Math.min(100, Math.max(-100, defenderStats.getAccruedStat('damageresist')))
      const edPct = Math.max(
        -90,
        vSpec.physDamagePct + attackerStats.getModifierBonus('damagepercent'),
      )
      const bonusDmg = Math.floor((vSpec.griefFlat * Math.max(0, edPct + 100)) / 100)
      totalDmg256 += Math.floor((bonusDmg * Math.max(0, 100 - physResPct)) / 100) * 256
    }
    resolvedDmg256 = totalDmg256
    dealtDamage = totalDmg256 > 0 ? Math.max(1, Math.floor(totalDmg256 / FIXED_ONE)) : 0
    const isActBossTarget =
      monster.isPrimeEvil ||
      this.actBossQuestId(monster.defId, monster.hcIdx) !== undefined
    if (effectiveSource === 'merc' && mercAttacker !== undefined) {
      if (isActBossTarget && dealtDamage > 0) {
        dealtDamage = scaleMercenaryBossDamage113c(dealtDamage, this.difficulty)
      }
      const rawMercHeal256 = dmgOut.attackerHealed256 ?? 0
      const mercHeal256 = isActBossTarget
        ? scaleMercenaryBossDamage113c(rawMercHeal256, this.difficulty)
        : rawMercHeal256
      if (mercHeal256 > 0 && mercAttacker.alive && mercAttacker.hp > 0 && mercAttacker.hp < mercAttacker.maxHp) {
        mercAttacker.regenCarry256 = (mercAttacker.regenCarry256 ?? 0) + mercHeal256
        if (mercAttacker.regenCarry256 >= FIXED_ONE) {
          const healWhole = Math.floor(mercAttacker.regenCarry256 / FIXED_ONE)
          mercAttacker.regenCarry256 -= healWhole * FIXED_ONE
          const nextHp = Math.min(mercAttacker.maxHp, mercAttacker.hp + healWhole)
          if (nextHp !== mercAttacker.hp) {
            mercAttacker.hp = nextHp
            this.broadcastAllyHp(mercAttacker.areaId, mercAttacker.unitId, mercAttacker.hp)
          }
        }
      }
    }

    // 1.13c Crushing Blow (statId 136 + per-level 247, D2Game.dll 0x6FCF6C10, #1869, #1873):
    const allowCrushingBlow = !isSpellPhys && !isBladeShieldPulse && skillId !== 257
    const cbChance = !allowCrushingBlow
      ? 0
      : petAttacker !== undefined
        ? petAttacker.statList.getAccruedStat('item_crushingblow')
        : effectiveSource === 'merc' && mercAttacker !== undefined
          ? this.sumMercItemStat(mercAttacker, 136)
          : this.sumPlayerItemStat(attacker, 136, handItemOpts)
    if (!dmgOut.immuneToPhys && cbChance > 0 && (cbChance >= 100 || this.rng.rand(100) < cbChance)) {
      const cbOut = calculateCrushingBlow113c({
        defenderHp: monster.hp,
        unitType: 'monster',
        isBoss: monster.isBoss,
        isPrimeEvil: monster.isPrimeEvil,
        rank: monster.rank,
        playerCount: this.effectivePlayerCount113c(),
        isRanged: hitAttackKind === 'missile',
        // Sanctuary bearer vs Undead: positive `damageresist` counts as 0% (negative curses kept, #1807).
        physResPct:
          attackerStateBus.hasState('sanctuary') && monster.isUndead
            ? Math.min(0, defenderStats.getAccruedStat('damageresist'))
            : defenderStats.getAccruedStat('damageresist'),
      })
      dealtDamage += cbOut.damage
    }
    if (
      effectiveSource === 'merc' &&
      mercAttacker !== undefined &&
      (hitAttackKind === 'melee' || hitAttackKind === 'missile')
    ) {
      const owChance = this.sumMercItemStat(mercAttacker, 135)
      if (owChance > 0 && (owChance >= 100 || this.rng.rand(100) < owChance)) {
        this.applyMonsterOpenWounds113c(attacker, monster, {
          attackerLevel: mercAttacker.level,
          isRanged: hitAttackKind === 'missile',
        })
      }
    } else if (
      stealer !== undefined &&
      !isSpellPhys &&
      !isBladeShieldPulse &&
      skillId !== 257 &&
      !hitContext?.skipHitRiders &&
      (hitAttackKind === 'melee' || hitAttackKind === 'missile')
    ) {
      const owChance = this.sumPlayerItemStat(attacker, 135, handItemOpts)
      if (owChance > 0 && (owChance >= 100 || this.rng.rand(100) < owChance)) {
        this.applyMonsterOpenWounds113c(attacker, monster, {
          isRanged: hitAttackKind === 'missile',
        })
      }
      if (this.sumPlayerItemStat(attacker, 117, handItemOpts) > 0) {
        this.applyMonsterPreventHeal113c(monster)
      }
    }
    const elemPoisRate256 = dmgOut.poisonBitrate256 ?? 0
    const elemPoisLen = dmgOut.poisonDurationFrames ?? 0
    if (elemPoisRate256 > 0 && elemPoisLen > 0 && !monster.dead) {
      this.applyMonsterPoisonDot(
        attacker,
        monster,
        elemPoisRate256,
        elemPoisLen,
        skillId,
        petAttacker !== undefined ? 'pet' : effectiveSource,
      )
    }
    if ((dmgOut.immuneToPhys && dmgOut.elemDamage256 <= 0) || dealtDamage <= 0) {
      if (ctcOnHitPending) this.triggerPlayerCtcProcs113c(attacker, 198, { target: monster })
      return elemPoisRate256 > 0 && elemPoisLen > 0
    }
  } else if (channel === 'pois') {
    if (!hitAutoHit) {
      const hitOut = executeSUnitDmg(attackerCtx, defenderCtx, {
        skillId,
        attackKind: hitAttackKind,
        srcDam: 0,
        flatPhysMin256: 0,
        flatPhysMax256: 0,
        elemType: 'pois',
        elemMin256: rawDmg * FIXED_ONE,
        elemMax256: rawDmg * FIXED_ONE,
        ...(hitContext?.damageRate !== undefined && hitContext.damageRate > 0
          ? { damageRate: hitContext.damageRate }
          : {}),
        toHitBonusPct: skillToHitBonusPct,
        autoHit: false,
        unblockable: hitUnblockable,
      }, this.rng)
      if (!hitOut.hit) {
        if (hitOut.avoidedReason === 'block' && !hitContext?.suppressBlockAnim) {
          monster.mode = MONMODE_BLOCK
          this.broadcastToArea(monster.areaId, {
            type: 'UnitMode',
            unitType: 1,
            id: monster.unitId,
            mode: MONMODE_BLOCK,
            lifePct:
              monster.maxHp > 0
                ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
                : 0,
          })
        }
        return false
      }
    }
    const sk = this.registry?.getSkillById(skillId)
    const dur = sk && sk.eLen > 0 ? sk.eLen : 50
    const effectivePoisDmg =
      effectiveSource === 'merc' &&
      (monster.isPrimeEvil || this.actBossQuestId(monster.defId, monster.hcIdx) !== undefined)
        ? scaleMercenaryBossDamage113c(rawDmg, this.difficulty)
        : rawDmg
    const rawBitrate256 = Math.max(1, Math.round((effectivePoisDmg * FIXED_ONE) / dur))
    this.applyMonsterPoisonDot(
      attacker,
      monster,
      rawBitrate256,
      dur,
      skillId,
      petAttacker !== undefined ? 'pet' : effectiveSource,
    )
    return true
  } else {
    const elem256 =
      hitContext?.elemDamage256 !== undefined && hitContext.elemDamage256 > 0
        ? hitContext.elemDamage256
        : rawDmg * FIXED_ONE
    const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
      skillId,
      attackKind: hitAttackKind,
      srcDam: 0,
      ...(weaponSrcDam > 0 ? { riderSrcDam: weaponSrcDam } : {}),
      ...(hitContext?.skipElemMastery ? { skipElemMastery: true } : {}),
      elemType: channel,
      elemMin256: elem256,
      elemMax256: elem256,
      ...(hitContext?.missileHitFlags113c !== undefined
        ? { missileHitFlags113c: hitContext.missileHitFlags113c }
        : {}),
      ...(hitContext?.missileResultFlags113c !== undefined
        ? { missileResultFlags113c: hitContext.missileResultFlags113c }
        : {}),
      ...(hitContext?.concentrationAlreadyApplied === true
        ? { concentrationAlreadyApplied: true }
        : {}),
      ...(hitContext?.damageRate !== undefined && hitContext.damageRate > 0
        ? { damageRate: hitContext.damageRate }
        : {}),
      toHitBonusPct: skillToHitBonusPct,
      autoHit: hitAutoHit,
      unblockable: hitUnblockable,
    }, this.rng)
    if (hitContext?.outHitResult !== undefined) {
      hitContext.outHitResult.landedHitRoll = dmgOut.hit
    }
    if (!dmgOut.hit) {
      if (dmgOut.avoidedReason === 'block' && !hitContext?.suppressBlockAnim) {
        monster.mode = MONMODE_BLOCK
        this.broadcastToArea(monster.areaId, {
          type: 'UnitMode',
          unitType: 1,
          id: monster.unitId,
          mode: MONMODE_BLOCK,
          lifePct:
            monster.maxHp > 0
              ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
              : 0,
        })
      }
      return false
    }
    const elemPoisRate256 = dmgOut.poisonBitrate256 ?? 0
    const elemPoisLen = dmgOut.poisonDurationFrames ?? 0
    if (elemPoisRate256 > 0 && elemPoisLen > 0 && !monster.dead) {
      monster.lastHitByMerc = effectiveSource === 'merc'
      if (!hitContext?.suppressReturnFireThreat) {
        monster.threatPlayerId = attacker.unitId
        monster.threatUntilFrame = this.currentFrame + MONSTER_THREAT_FRAMES
      }
      if (monster.poisonRemainingFrames <= 0 || elemPoisRate256 >= monster.poisonBitrate256) {
        monster.poisonBitrate256 = elemPoisRate256
        monster.poisonRemainingFrames = elemPoisLen
        monster.poisonCarry256 = 0
        monster.poisonAttackerId = attacker.unitId
        monster.poisonSkillId = skillId
        monster.poisonKillSource =
          petAttacker !== undefined || hitContext?.fromPet ? 'pet' : effectiveSource
      }
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        2,
        monster.poisonRemainingFrames,
      )
    }
    if (dmgOut.immuneToElem || dmgOut.totalDamage256 <= 0) {
      return elemPoisRate256 > 0 && elemPoisLen > 0
    }
    resolvedDmg256 = dmgOut.totalDamage256
    dealtDamage = Math.max(1, Math.floor(dmgOut.totalDamage256 / FIXED_ONE))
    if (
      effectiveSource === 'merc' &&
      (monster.isPrimeEvil || this.actBossQuestId(monster.defId, monster.hcIdx) !== undefined)
    ) {
      dealtDamage = scaleMercenaryBossDamage113c(dealtDamage, this.difficulty)
    }
    if (
      stealer !== undefined &&
      weaponSrcDam > 0 &&
      !hitContext?.skipHitRiders &&
      (hitAttackKind === 'melee' || hitAttackKind === 'missile')
    ) {
      const cbChance = this.sumPlayerItemStat(attacker, 136, handItemOpts)
      if (!dmgOut.immuneToPhys && cbChance > 0 && (cbChance >= 100 || this.rng.rand(100) < cbChance)) {
        const cbOut = calculateCrushingBlow113c({
          defenderHp: monster.hp,
          unitType: 'monster',
          isBoss: monster.isBoss,
          isPrimeEvil: monster.isPrimeEvil,
          rank: monster.rank,
          playerCount: this.effectivePlayerCount113c(),
          isRanged: hitAttackKind === 'missile',
          physResPct:
            attackerStateBus.hasState('sanctuary') && monster.isUndead
              ? Math.min(0, defenderStats.getAccruedStat('damageresist'))
              : defenderStats.getAccruedStat('damageresist'),
        })
        dealtDamage += cbOut.damage
      }
      const owChance = this.sumPlayerItemStat(attacker, 135, handItemOpts)
      if (owChance > 0 && (owChance >= 100 || this.rng.rand(100) < owChance)) {
        this.applyMonsterOpenWounds113c(attacker, monster, {
          isRanged: hitAttackKind === 'missile',
        })
      }
      if (this.sumPlayerItemStat(attacker, 117, handItemOpts) > 0) {
        this.applyMonsterPreventHeal113c(monster)
      }
    }
  }

  const hitClass =
    petAttacker !== undefined
      ? this.resolveMonsterHitClass113c(
          { hcIdx: -1 },
          petAttacker.sourceSkillId || skillId,
        )
      : effectiveSource === 'merc' && mercAttacker !== undefined
        ? this.resolveMonsterHitClass113c(
            { hcIdx: mercAttacker.classId },
            skillId,
          )
        : this.resolvePlayerWeaponHitClass113c(attacker, skillId)
  if (wasAlreadyDead113c) {
    if (ctcOnHitPending) this.triggerPlayerCtcProcs113c(attacker, 198, { target: monster })
    return true
  }
  const effectiveElemFrames = hitContext?.elemDurationFrames
  this.finishMonsterDamage(
    attacker,
    monster,
    dealtDamage,
    skillId,
    channel,
    hitClass,
    effectiveElemFrames,
    effectiveSource === 'merc',
    {
      fromPet: petAttacker !== undefined || hitContext?.fromPet === true,
      isGroundFire: hitContext?.isGroundFire === true,
      noHitRecovery: hitContext?.noHitRecovery === true,
      ...(hitContext?.missileKnockbackChancePct !== undefined && hitContext.missileKnockbackChancePct > 0
        ? { missileKnockbackChancePct: hitContext.missileKnockbackChancePct }
        : {}),
      suppressReturnFireThreat: hitContext?.suppressReturnFireThreat === true,
      dmg256: resolvedDmg256,
      ...(hitContext?.weaponHand !== undefined ? { weaponHand: hitContext.weaponHand } : {}),
    },
  )
  if (ctcOnHitPending) this.triggerPlayerCtcProcs113c(attacker, 198, { target: monster })
  return true
}



/**
 * 1.13c poison application (`D2Game.dll` `0x6FCF6C60`): mitigates the rolled per-frame poison
 * bitrate (`1/256` HP/frame) against the monster's `poisonresist`, applies `STATE_POISON` (`2`)
 * for `durationFrames` (`ELen`), and arms per-frame ticking in `stepMonsterPoison`.
 */
function applyMonsterPoisonDot(this: GameInstanceHost, 
  attacker: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  rawBitrate256: number,
  durationFrames: number,
  skillId: number,
  effectiveSource: 'player' | 'merc' | 'pet' = 'player',
  opts?: { readonly preMasteryApplied?: boolean | undefined },
): boolean {
  if (monster.dead || monster.isNpc || !monster.isKillable || monster.submerged || monster.align !== 0) return false
  if (rawBitrate256 <= 0 || durationFrames <= 0) return false

  const attackerStats = new UnitStatList(this.registry, undefined, {
    ownerType: effectiveSource === 'pet' ? 'monster' : 'player',
    charClass: attacker.classCode,
  })
  attackerStats.setBaseStat('level', attacker.level)
  attackerStats.setBaseStat(
    'maxhp',
    this.players.get(attacker.unitId) === attacker
      ? this.getPlayerAccruedMaxHpFixed(attacker)
      : attacker.maxHpFixed,
  )
  attackerStats.setHp256(attacker.hpFixed)
  // `passive_pois_mastery` (332) / `passive_pois_pierce` (336) of the poison source (#1801, #1874):
  // Pet-origin poison (`effectiveSource === 'pet'`) NEVER inherits player `332` / `336`.
  const poisonMerc =
    effectiveSource === 'merc'
      ? [...this.mercenaries.values()].find((m) => m.ownerPlayerId === attacker.unitId)
      : undefined
  if (poisonMerc !== undefined) {
    this.applyItemMasteryPierceStats113c(attackerStats, (statId) => this.sumMercItemStat(poisonMerc, statId))
  } else if (effectiveSource === 'player' && this.players.get(attacker.unitId) === attacker) {
    this.applyItemMasteryPierceStats113c(attackerStats, (statId) => this.sumPlayerItemStat(attacker, statId))
    this.syncPlayerSkillLevelsToStatList113c(attacker, attackerStats, this.playerCombat.get(attacker.unitId)?.stateBus)
  }
  if (opts?.preMasteryApplied === true) {
    attackerStats.setBaseStat(332, 0)
  }
  const attackerStateBus = new StateBus(attackerStats, this.registry)
  const attackerCtx: CombatUnitContext = {
    id: `player_${attacker.unitId}`,
    name: attacker.name,
    unitType: effectiveSource === 'pet' ? 'monster' : 'player',
    statList: attackerStats,
    stateBus: attackerStateBus,
    x: attacker.x,
    y: attacker.y,
  }

  const defenderStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
  defenderStats.setBaseStat('level', monster.level)
  defenderStats.setBaseStat('armorclass', monster.ac)
  defenderStats.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  defenderStats.setHp256(this.drlgRoomPopulator !== null ? monsterHp256_113c(monster) : monster.hp * FIXED_ONE)
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
    isChampion: monster.rank === 'champion',
    isSuperUnique: monster.superUniqueId !== undefined,
    rank: monster.rank,
    drain: monster.drain,
    monsterColdDivisor: difficultyMonsterColdDivisor(this.difficulty),
    monsterFreezeDivisor: difficultyMonsterFreezeDivisor(this.difficulty),
  }

  const totalDmg256 = Math.max(1, Math.floor(rawBitrate256 * durationFrames))
  const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
    skillId,
    attackKind: 'spell',
    srcDam: 0,
    elemType: 'pois',
    elemMin256: totalDmg256,
    elemMax256: totalDmg256,
    elemDurationFrames: durationFrames,
    autoHit: true,
    unblockable: true,
  }, new D2Rng(0))
  if (dmgOut.immuneToElem || (dmgOut.poisonBitrate256 ?? 0) <= 0) {
    return false
  }
  const bitrate256 = dmgOut.poisonBitrate256!
  monster.lastHitByMerc = effectiveSource === 'merc'
  monster.threatPlayerId = attacker.unitId
  monster.threatUntilFrame = this.currentFrame + MONSTER_THREAT_FRAMES

  if (this.drlgRoomPopulator !== null) {
    if (monster.aiAwake === false) {
      monster.nextAiFrame = Math.max(monster.nextAiFrame, this.currentFrame + 1)
    }
    monster.aiAwake = true
    monster.lastDamagedFrame113c = this.currentFrame
    // 1.13c `SUNITDMG_ApplyDamage` (`0x6FCFE242..0x6FCFE264`): immediate 1-frame subtraction (`life < 0x100 -> 0`).
    let next256 = monsterHp256_113c(monster) - bitrate256
    if (next256 < FIXED_ONE) next256 = 0
    monster.hp = Math.ceil(next256 / FIXED_ONE)
    monster.hp256 = next256
    monster.hp256Whole = monster.hp
    if (next256 <= 0) {
      monster.poisonRemainingFrames = 0
      monster.poisonBitrate256 = 0
      monster.poisonCarry256 = 0
      monster.poisonKillSource = undefined
      monster.nextEvent3Frame113c = undefined
      this.applyMonsterDeath(monster, attacker, 'pois', effectiveSource)
      return true
    }
    // 1.13c `SUNITDMG_ApplyPoison` (`0x6FCFCAB0..0x6FCFCC0C`): overwrite `state 2` iff not active or `new >= cur`.
    if (!monster.states.has(2) || monster.poisonRemainingFrames <= 0 || bitrate256 >= monster.poisonBitrate256) {
      monster.poisonBitrate256 = bitrate256
      monster.poisonRemainingFrames = durationFrames
      monster.poisonCarry256 = 0
      monster.poisonAttackerId = attacker.unitId
      monster.poisonSkillId = skillId
      monster.poisonKillSource = effectiveSource
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        2,
        durationFrames,
      )
    }
    monster.nextEvent3Frame113c = this.currentFrame + 1
    monster.event3Seq113c = allocateEvent3Seq113c(this)
    return true
  }

  // In 1.13c (`0x6FCF6C60`), a new poison overrides when no poison is active or the new bitrate >= current
  if (monster.poisonRemainingFrames <= 0 || bitrate256 >= monster.poisonBitrate256) {
    monster.poisonBitrate256 = bitrate256
    monster.poisonRemainingFrames = durationFrames
    monster.poisonCarry256 = 0
    monster.poisonAttackerId = attacker.unitId
    monster.poisonSkillId = skillId
    monster.poisonKillSource = effectiveSource
  }
  this.applyUnitState(
    monster.states,
    monster.stateTimers,
    'monster',
    monster.unitId,
    monster.areaId,
    2,
    monster.poisonRemainingFrames,
  )
  return true
}



/**
 * 1.13c cold (`STATE_COLD` 11, `SUNITDMG_ApplyCold` `0x6FCFC780`) and freeze (`STATE_FREEZE` 1,
 * `SUNITDMG_ApplyFreeze` `0x6FCFDAC0`) raw frame duration resolver:
 * - Evaluates `Skills.txt` `ELen + ELevLen1..3` scaled by `ELenSymPerCalc` (`D2Common_11035`),
 *   or `auraLenCalc` on Glacial Spike (#55), or `calc1` on Frozen Armor (#40), or `Missiles.txt`
 *   `ELen + ELevLen1..3` (e.g. Phoenix Strike #280 charge 3 `royalstrikechaosice`), or `calc4`
 *   on Vengeance (#111).
 * - Adds equipped item `STAT_COLDLENGTH` (`56`, `D2Game.dll` `0x6FCFD8A6`) when the attack
 *   carries weapon damage (`skillId === 0 || skill.srcDam > 0`).
 * - Enforces the 50-frame minimum floor (`0x6FCFDA16..0x6FCFDA63`) on cold/freeze conversion or
 *   aura pulse skills without explicit `ELen`.
 */
function resolveSkillColdOrFreezeDuration113c(this: GameInstanceHost, 
  attacker: InternalPlayerRecord,
  skillId: number,
  channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  explicitDurationFrames?: number | undefined,
  missileRec?: MissileRecord | undefined,
  handItemOpts?: {
    readonly weaponHand?: 'right' | 'left'
    readonly excludePlayerItems?: boolean | undefined
  } | undefined,
): { readonly kind: 'freeze' | 'chill' | null; readonly rawFrames: number } {
  const skill = skillId > 0 ? this.registry?.getSkillById(skillId) : undefined
  const slvl = skill !== undefined ? Math.max(1, this.resolvePlayerSkillLevel(attacker, skill)) : 0
  const primaryMissileName =
    skill !== undefined
      ? skillId === 280 && channel === 'cold'
        ? skill.srvMissileC
        : skill.srvMissile || skill.srvMissileA || skill.srvMissileB || skill.srvMissileC
      : ''
  const resolvedMissile =
    missileRec ??
    (primaryMissileName ? this.registry?.getMissileByName(primaryMissileName) : undefined)
  const hitSubMissile =
    resolvedMissile?.hitSubMissile1
      ? this.registry?.getMissileByName(resolvedMissile.hitSubMissile1)
      : undefined
  const skillEType = (skill?.eType || resolvedMissile?.eType || '').toLowerCase()
  const missileEType = (resolvedMissile?.eType || hitSubMissile?.eType || '').toLowerCase()
  const isFreezeSkill =
    skillEType === 'frze' ||
    skillEType === 'free' ||
    missileEType === 'frze' ||
    missileEType === 'free' ||
    resolvedMissile?.pSrvDmgFunc === 2 ||
    resolvedMissile?.pSrvDmgFunc === 4 ||
    resolvedMissile?.pSrvDmgFunc === 10 ||
    skillId === 40 ||
    skillId === 274 ||
    (skillId === 280 && channel === 'cold')
  const isColdSkill = skillEType === 'cold' || channel === 'cold'
  const hasItemFreeze =
    (skillId === 0 || !skill?.aura) && this.sumPlayerItemStat(attacker, 134, handItemOpts) > 0

  let skillElemFrames =
    explicitDurationFrames !== undefined && explicitDurationFrames > 0
      ? explicitDurationFrames
      : 0
  if (skillElemFrames <= 0 && skill !== undefined && (isFreezeSkill || isColdSkill || skillId === 111)) {
    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl: attacker.skills.get(skillId) ?? 0,
      ulvl: attacker.level,
      getBaseSkillLevel: (id: number) => attacker.skills.get(id) ?? 0,
      getEffectiveSkillLevel: (id: number) => {
        const s = this.registry?.getSkillById(id)
        if (!s) return 0
        return (attacker.skills.get(id) ?? 0) > 0 ? this.resolvePlayerSkillLevel(attacker, s) : 0
      },
      getUnitStat: (statNameOrId: string | number) => {
        if (statNameOrId === 'level' || statNameOrId === 12) return attacker.level
        if (statNameOrId === 'strength' || statNameOrId === 0) return attacker.strength
        if (statNameOrId === 'dexterity' || statNameOrId === 2) return attacker.dexterity
        if (statNameOrId === 'vitality' || statNameOrId === 3) return attacker.vitality
        if (statNameOrId === 'energy' || statNameOrId === 1) return attacker.energy
        return 0
      },
    }
    if (skill.eLen > 0 || skill.eLevLen1 > 0 || skill.eLevLen2 > 0 || skill.eLevLen3 > 0) {
      let dur = compute3BandDuration(
        slvl,
        skill.eLen,
        skill.eLevLen1,
        skill.eLevLen2,
        skill.eLevLen3,
      )
      if (skill.eLenSymPerCalc) {
        const synPct = evaluateCalc(skill.eLenSymPerCalc, calcCtx)
        dur = Math.floor((dur * (100 + synPct)) / 100)
      }
      skillElemFrames = dur
    } else if (skill.id === 55 && skill.auraLenCalc) {
      skillElemFrames = Math.max(0, evaluateCalc(skill.auraLenCalc, calcCtx))
    } else if (skill.id === 40 && skill.calc1) {
      skillElemFrames = Math.max(0, evaluateCalc(skill.calc1, calcCtx))
    } else if (skill.id === 111 && skill.calc4) {
      skillElemFrames = Math.max(0, evaluateCalc(skill.calc4, calcCtx))
    } else {
      const mRec =
        missileRec ??
        this.registry.getMissileByName(
          skill.srvMissileC || skill.srvMissileB || skill.srvMissileA || skill.srvMissile,
        )
      if (
        mRec !== undefined &&
        (mRec.eLen > 0 || mRec.eLevLen1 > 0 || mRec.eLevLen2 > 0 || mRec.eLevLen3 > 0)
      ) {
        skillElemFrames = compute3BandDuration(
          slvl,
          mRec.eLen,
          mRec.eLevLen1,
          mRec.eLevLen2,
          mRec.eLevLen3,
        )
      }
    }
  }

  const includeItemCold =
    !handItemOpts?.excludePlayerItems &&
    (skillId === 0 || (skill !== undefined && skill.srcDam > 0))
  const itemColdFrames = includeItemCold ? Math.max(0, this.sumPlayerItemStat(attacker, 56, handItemOpts)) : 0

  if (isFreezeSkill || (!handItemOpts?.excludePlayerItems && hasItemFreeze)) {
    let rawFrames = skillElemFrames + itemColdFrames
    if (rawFrames <= 0) rawFrames = 50
    return { kind: 'freeze', rawFrames }
  }
  if (isColdSkill || itemColdFrames > 0 || skillId === 111) {
    let rawFrames = skillElemFrames + itemColdFrames
    if (rawFrames <= 0 && isColdSkill) {
      rawFrames = Number(skill?.perDelay) || 50
    }
    return rawFrames > 0 ? { kind: 'chill', rawFrames } : { kind: null, rawFrames: 0 }
  }
  return { kind: null, rawFrames: 0 }
}



/**
 * Apply resolved damage to a monster: HP loss, chill from cold skills, the HP update, Lightning
 * Enchanted on-struck bolts, and the death / get-hit mode (shared by hits and aura pulses).
 */
/**
 * 1.13c `SUNITDMG_ApplyDamage` (`0x6FCFE2E2..0x6FCFE335`) tail for a surviving monster defender with
 * `dwDmgTotal > 0`: when the accrued `stat 74` is non-zero, the pending `Event 3` timers are deleted and
 * `Event 3` is scheduled at `dwGameFrame + 1` (kb/combat/d2game-statregen-dot-113c.md). Shared by every
 * DRLG damage path (player hits, merc missiles, 1:1 pet melee).
 */
export function armMonsterEvent3AfterDamage113c(host: GameInstanceHost, monster: InternalMonsterRecord): void {
  const baseRegen256 = computeMonsterBaseDamageRegen113c(
    monster.maxHp * FIXED_ONE,
    monster.damageRegen,
    monster.boneConstructOwnerPlayerId !== undefined,
  )
  const poisonMod256 = monster.states.has(2) && monster.poisonBitrate256 > 0 ? -monster.poisonBitrate256 : 0
  const statListMod256 = Math.trunc(host.monsterCombat.get(monster.unitId)?.statList.getModifierBonus('hpregen') ?? 0)
  if (baseRegen256 + poisonMod256 + statListMod256 !== 0) {
    monster.nextEvent3Frame113c = host.currentFrame + 1
    monster.event3Seq113c = allocateEvent3Seq113c(host)
  }
}

function finishMonsterDamage(this: GameInstanceHost, 
  attacker: InternalPlayerRecord,
  monster: InternalMonsterRecord,
  dealtDamage: number,
  skillId: number,
  channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  hitClass?: number | string | undefined,
  elemDurationFrames?: number | undefined,
  fromMerc = false,
  finishOpts?: {
    readonly fromPet?: boolean | undefined
    readonly isGroundFire?: boolean | undefined
    readonly noHitRecovery?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly suppressReturnFireThreat?: boolean | undefined
    readonly dmg256?: number | undefined
    readonly weaponHand?: 'right' | 'left' | undefined
  },
): void {
  if (this.drlgRoomPopulator !== null && monster.aiAwake === false) {
    // A hit wakes a dormant DRLG monster, but its first AI think is not run in the frame of the hit
    // (oracle p52-sorceress-fire-dot F639: Fire Wall hit, zombie seed draws 0). Unverified against
    // the original wake path; see kb/skills/missiles/d2game-srvhit01-fireball-113c.md §6.
    monster.nextAiFrame = Math.max(monster.nextAiFrame, this.currentFrame + 1)
  }
  monster.aiAwake = true
  monster.lastDamagedFrame113c = this.currentFrame
  if (finishOpts?.isGroundFire === true && finishOpts.dmg256 !== undefined && this.drlgRoomPopulator !== null) {
    // `SUNITDMG` subtracts the 1/256 damage from the raw `STAT_HITPOINTS`; ground fire (`SrvDmg03`)
    // deals fractional hits, so keep the remainder (`InternalMonsterRecord.hp256`).
    const next256 = Math.max(0, monsterHp256_113c(monster) - finishOpts.dmg256)
    monster.hp = Math.ceil(next256 / FIXED_ONE)
    monster.hp256 = next256
    monster.hp256Whole = monster.hp
  } else if (
    this.drlgRoomPopulator !== null &&
    finishOpts?.dmg256 !== undefined &&
    Math.floor(finishOpts.dmg256 / FIXED_ONE) === dealtDamage
  ) {
    // `SUNITDMG_ExecuteMissileDamage` (`0x6FCFE242..0x6FCFE264`): `life = STAT_HITPOINTS - dwDmgTotal` in
    // 256ths, `life < 0x100 -> 0` (oracle `a1-bloodmoor-melee` F=1086: 2304 - 1022 = 1282).
    let next256 = monsterHp256_113c(monster) - Math.max(0, Math.trunc(finishOpts.dmg256))
    if (next256 < FIXED_ONE) next256 = 0
    monster.hp = Math.ceil(next256 / FIXED_ONE)
    monster.hp256 = next256
    monster.hp256Whole = monster.hp
  } else {
    monster.hp = Math.max(0, monster.hp - dealtDamage)
  }
  if (
    this.drlgRoomPopulator !== null &&
    monster.hp > 0 &&
    (dealtDamage > 0 || (finishOpts?.dmg256 ?? 0) > 0)
  ) {
    // 1.13c `SUNITDMG_ApplyDamage` (`0x6FCFE2E2..0x6FCFE335`): when `dwDmgTotal > 0` and accrued `stat 74 != 0`,
    // deletes existing `Event 3` timers and schedules `Event 3` at `dwGameFrame + 1`.
    armMonsterEvent3AfterDamage113c(this, monster)
  }
  if (fromMerc) {
    monster.lastHitByMerc = true
  }
  // 1.13c `STAT_ITEM_PREVENTHEAL (117)` -> `STATE_PREVENTHEAL (52)` (`D2Game.dll` `0x6FCBCF20`, #1899):
  // Applies to normal, champion, and unique/superunique bosses (only Prime Evils & Uber bosses ignore PMH),
  // and MUST be applied BEFORE evaluating `MonUMod #26` (`Teleport`) heal eligibility on this hit.
  if (
    monster.hp > 0 &&
    !monster.isPrimeEvil &&
    !(monster.hcIdx >= 704 && monster.hcIdx <= 709) &&
    !fromMerc &&
    !finishOpts?.fromPet &&
    this.sumPlayerItemStat(attacker, 117) > 0
  ) {
    this.applyMonsterState(monster.unitId, 52, 120_000)
  }
  if (!finishOpts?.suppressReturnFireThreat) {
    monster.threatPlayerId = attacker.unitId
    monster.threatUntilFrame = this.currentFrame + MONSTER_THREAT_FRAMES
  }

  if (skillId !== 114 && monster.resistances.cold < 100 && monster.coldEffect !== 0) {
    const coldOrFreeze = this.resolveSkillColdOrFreezeDuration113c(
      attacker,
      skillId,
      channel,
      elemDurationFrames,
      undefined,
      {
        ...(finishOpts?.weaponHand !== undefined ? { weaponHand: finishOpts.weaponHand } : {}),
        ...(fromMerc || finishOpts?.fromPet ? { excludePlayerItems: true } : {}),
      },
    )
    if (coldOrFreeze.kind === 'freeze' && coldOrFreeze.rawFrames > 0) {
      const divisor = Math.max(1, difficultyMonsterFreezeDivisor(this.difficulty))
      const freezeTicks = Math.trunc(coldOrFreeze.rawFrames / divisor)
      if (freezeTicks > 0) {
        this.applyMonsterState(monster.unitId, 1, freezeTicks)
      }
    } else if (coldOrFreeze.kind === 'chill' && coldOrFreeze.rawFrames > 0) {
      const divisor = Math.max(1, difficultyMonsterColdDivisor(this.difficulty))
      const chillTicks = Math.trunc(coldOrFreeze.rawFrames / divisor)
      if (chillTicks > 0) {
        this.applyMonsterState(monster.unitId, 11, chillTicks)
      }
    }
  }

  this.broadcastToArea(monster.areaId, {
    type: 'UnitStatUpdate',
    unitType: 'monster',
    unitId: monster.unitId,
    statId: 6,
    value: monster.hp,
  })

  // 1.13c `SUNITDMG_ExecuteEvents` (`0x6FCFD139` / `0x6FCFD178` -> `MONUMOD_DispatchEvent` `col4` = `0x6FC468C0` -> `0x6FC46320`, #1995):
  // `MonUMod #17` (`lightning`) fires on any non-ground-fire hit (subject to its 10-frame `dwLastLeFrame` cooldown),
  // whereas `MonUMod #20` (`scarab`, `col4 = 0`, `col1 = 0x6FC41B00`) fires strictly on `MONMODE_GETHIT` (`maybeEnterMonsterHitRecovery`)
  // and `MONMODE_DEATH` (`onMonsterKilled`).
  if (!finishOpts?.isGroundFire) {
    this.emitLightningEnchantedBoltsOnStruck113c(monster)
  }

  if (monster.hp <= 0) {
    const killSource: 'player' | 'merc' | 'pet' =
      finishOpts?.fromPet ? 'pet' : fromMerc ? 'merc' : 'player'
    this.applyMonsterDeath(monster, attacker, channel, killSource)
    // 1.13c `item_skillonkill` (196): the killing player's gear (hireling kills use hireling gear, #1797).
    if (
      !fromMerc &&
      !finishOpts?.fromPet &&
      this.players.get(attacker.unitId) === attacker &&
      !attacker.dead
    ) {
      this.triggerPlayerCtcProcs113c(attacker, 196, { target: monster })
    } else if (fromMerc && !finishOpts?.fromPet && this.playerCtcProcDepth === 0) {
      const killingMerc = [...this.mercenaries.values()].find(
        (m) => m.ownerPlayerId === attacker.unitId && m.alive && m.areaId === monster.areaId,
      )
      if (killingMerc !== undefined) {
        this.playerCtcProcDepth += 1
        try {
          this.triggerMercCtcProcs113c(attacker, killingMerc, monster, 196)
        } finally {
          this.playerCtcProcDepth -= 1
        }
      }
    }
  } else {
    const canBeInterrupted = !monster.isBoss && !monster.isPrimeEvil
    if (canBeInterrupted && !fromMerc && !finishOpts?.fromPet && this.sumPlayerItemStat(attacker, 117) > 0) {
      this.applyMonsterState(monster.unitId, 52, 120_000)
    }
    const isRadialAuraPulse = skillId > 0 && Boolean(this.registry.getSkillById(skillId)?.aura)
    const hasItemKnockback =
      !isRadialAuraPulse && !fromMerc && !finishOpts?.fromPet && this.sumPlayerItemStat(attacker, 81) > 0
    // 1.13c D2Game.dll 0x6FCCCE60 (itemeventfunc 7, STAT_ITEM_KNOCKBACK = 81):
    // Size-based 128-point roll (Small=128/128, Medium=64/128, Large=32/128) applies ONLY to
    // item_knockback (stat 81). Skills in MONSTER_KNOCKBACK_SKILLS set ResultFlags |= 0x08 directly
    // (with Telekinesis #43 rolling Param2 = 35% at 0x6FC631C0, and Molten Boulder #229 gating sizeX < 3).
    const missileKnockbackTriggered =
      (finishOpts?.missileKnockbackChancePct ?? 0) > 0 &&
      this.rng.rand(100) < finishOpts!.missileKnockbackChancePct!
    const skillKnockback =
      MONSTER_KNOCKBACK_SKILLS.has(skillId) &&
      (skillId !== 43 || this.rng.rand(100) < 35) &&
      (skillId !== 229 || monster.sizeX < 3)
    const itemKnockbackTriggered =
      !missileKnockbackTriggered &&
      !skillKnockback &&
      hasItemKnockback &&
      rollItemKnockback113c(this.rng, { unitType: 'monster', sizeX: monster.sizeX })
    // 1.13c SUNITDMG_ExecuteEvents (D2Game.dll 0x6FCFD00E..0x6FCFD117): knockback (`HitFlags & 0x08`)
    // is evaluated first; if knockback is blocked (`mKB == 0`) or does not trigger, `0x04` GetHit runs.
    const knockedBack =
      attacker.areaId === monster.areaId &&
      (missileKnockbackTriggered || skillKnockback || itemKnockbackTriggered)
        ? this.knockbackMonster(monster, attacker.x, attacker.y)
        : false
    // 1.13c `SrvDmg03` ground fire (`Fire Wall` / `Meteor` patch / `Blaze`, `0x6FC59670`, #1940) and
    // `Missiles.txt` `GetHit == 0` streams (`0x6FC5AEAB..0x6FC5AEEB`, #2017) never set `HITFLAG_GETHIT (0x04)`.
    if (!knockedBack && !finishOpts?.isGroundFire && !finishOpts?.noHitRecovery) {
      this.maybeEnterMonsterHitRecovery(monster, dealtDamage, {
        hitClass,
        isPurePoison: channel === 'pois',
        dmg256: finishOpts?.dmg256,
      })
    }
  }
  // 1.13c `MonProp.txt` `thorns` (`quillrat6..8`, `#1897`): flat physical damage reflected to melee attackers.
  if (
    monster.monProps.thornsFlat > 0 &&
    skillId === 0 &&
    !attacker.dead &&
    attacker.areaId === monster.areaId &&
    Math.hypot(attacker.x - monster.x, attacker.y - monster.y) <= 4.5
  ) {
    this.applyPlayerElementalDamage(
      attacker,
      { phys: monster.monProps.thornsFlat },
      { skipGetHit: true, killerType: 'monster', killerUnitId: monster.unitId },
    )
  }
}



/** Unified 1.13c monster death: shatter flag, death mode broadcast, drops / XP / death FX. */
function applyMonsterDeath(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  creditedPlayer: InternalPlayerRecord | undefined,
  channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois',
  killSource: 'player' | 'merc' | 'pet' | 'other' = monster.lastHitByMerc ? 'merc' : 'player',
): void {
  if (monster.dead) return
  // `#1883` Bone Wall / Bone Prison (`hcIdx 344` & Diablo `340..343`) shatter & despawn immediately
  // on destruction with zero corpse, zero XP, and zero drops, clearing all blocked collision cells!
  if (isBonePrisonMonsterHcIdx113c(monster.hcIdx)) {
    this.despawnTemporaryMonsterUnit113c(monster)
    return
  }
  monster.submerged = false
  monster.pendingAttack = undefined
  monster.pendingAllyAttack = undefined
  monster.pendingResurrection = undefined
  const hasShatterOnDeath =
    monster.umodIds.includes(MON_UMOD.SHATTER_ON_DEATH) ||
    hasImplicitShatterOnDeathUMod113c({
      hcIdx: monster.hcIdx,
      defId: monster.defId,
      monType: monster.monType,
      isNpc: monster.isNpc,
    })
  if (
    monster.states.has(1) ||
    monster.states.has(29) ||
    monster.states.has(107) ||
    monster.states.has(184) ||
    hasShatterOnDeath ||
    monster.states.has(11) ||
    monster.frozenTicks > 0 ||
    monster.chillTicks > 0 ||
    channel === 'cold'
  ) {
    monster.shattered = true
    monster.corpseConsumed = true
    if (
      !monster.states.has(1) &&
      !monster.states.has(107) &&
      !monster.states.has(184)
    ) {
      const shatterStateId =
        monster.states.has(29) || monster.frozenTicks > 0 ? 1 : 107
      this.applyUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        shatterStateId,
        50,
      )
    }
  }
  // 1.13c MonUMod #35 `shatter_on_death` (D2Game.dll 0x6FC41A70, #1948):
  // Unconditionally emits a close-range frost burst on death regardless of killing element.
  if (hasShatterOnDeath) {
    const frostDmg = Math.max(1, Math.floor(monster.level / 2))
    for (const nearbyPlayer of this.players.values()) {
      if (nearbyPlayer.dead || nearbyPlayer.areaId !== monster.areaId) continue
      if (Math.hypot(nearbyPlayer.x - monster.x, nearbyPlayer.y - monster.y) > 4) continue
      this.applyUnitState(
        nearbyPlayer.states,
        nearbyPlayer.stateTimers,
        'player',
        nearbyPlayer.unitId,
        nearbyPlayer.areaId,
        11,
        75,
      )
      this.applyPlayerElementalDamage(
        nearbyPlayer,
        { cold: frostDmg },
        { skipGetHit: true, killerType: 'monster', killerUnitId: monster.unitId },
      )
    }
  }
  monster.dead = true
  monster.nextEvent3Frame113c = undefined
  monster.event3Seq113c = undefined
  if (this.drlgRoomPopulator !== null) {
    // Oracle `p52-necromancer-curses` F=968: zombie #10 dies with Weaken (state 19, timed) -> the timed states
    // are gone in the death frame, the untimed state 105 stays. Original removal routine not yet disassembled
    // (kb/combat/d2game-sunitdmg-player-defender-113c.md §10).
    for (const timedStateId of [...monster.stateTimers.keys()]) {
      if (monster.states.has(timedStateId) && monster.stateTimers.get(timedStateId)! > 0) {
        this.clearUnitState(monster.states, monster.stateTimers, 'monster', monster.unitId, monster.areaId, timedStateId)
      }
    }
  }
  if (this.drlgRoomPopulator !== null) {
    const code = MONSTATS_113C_ROWS[monster.hcIdx]?.code?.trim().toUpperCase()
    const dtRec = code ? this.registry.getAnimDataRecord(`${code}DTHTH`) : undefined
    const dtFrames =
      dtRec !== undefined && dtRec.framesPerDirection > 0 && dtRec.animationSpeed > 0
        ? Math.max(
            2,
            Math.floor(((dtRec.framesPerDirection << 8) + dtRec.animationSpeed - 1) / dtRec.animationSpeed),
          )
        : 24
    monster.mode = 0
    monster.deathAnimEndFrame = this.currentFrame + dtFrames
    // Death mode start (`0x6FC962FC..0x6FC96302`): `#10873(GetRoom(pMonster), unitId)` death ring, read by
    // `AiFallen` (kb/monsters/d2game-fallen-ai-113c.md).
    this.drlgRoomPopulator.recordMonsterDeath113c(
      areaToAct(monster.areaId),
      Math.floor(monster.x + 0.5),
      Math.floor(monster.y + 0.5),
      monster.unitId,
    )
    this.areaPathWorld.setMonsterDead(monster.unitId)
  } else {
    monster.mode = 12
  }
  if (monster.auraSkillId !== undefined) {
    const leaderStateId = PALADIN_AURA_STATE_BY_SKILL_ID[monster.auraSkillId]
    if (leaderStateId !== undefined && monster.states.has(leaderStateId)) {
      this.clearUnitState(
        monster.states,
        monster.stateTimers,
        'monster',
        monster.unitId,
        monster.areaId,
        leaderStateId,
      )
    }
  }
  monster.path = []
  monster.pathIndex = 0
  monster.pathTargetX = Number.NaN
  monster.pathTargetY = Number.NaN
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: monster.unitId,
    mode: 12,
    lifePct: 0,
  })
  // 1.13c `STAT_ITEM_RESTINPEACE (108)`: slain monster's corpse cannot be resurrected or consumed.
  if (creditedPlayer && this.sumPlayerItemStat(creditedPlayer, 108) > 0) {
    monster.corpseConsumed = true
  }
  this.onMonsterKilled(creditedPlayer, monster, killSource)
  // `#1894` Demon Imp carrier dismount on death (or carrier free-up if mounted Imp dies).
  if (monster.mountedImpUnitId !== undefined) {
    const mountedImp = this.monsters.get(monster.mountedImpUnitId)
    if (mountedImp !== undefined && mountedImp.mountedOnUnitId === monster.unitId) {
      mountedImp.mountedOnUnitId = undefined
    }
    monster.mountedImpUnitId = undefined
  }
  if (monster.mountedOnUnitId !== undefined) {
    const carrier = this.monsters.get(monster.mountedOnUnitId)
    if (carrier !== undefined && carrier.mountedImpUnitId === monster.unitId) {
      carrier.mountedImpUnitId = undefined
    }
    monster.mountedOnUnitId = undefined
  }
  // `#1894` Putrid Defiler `#300 Impregnate` (`MON_UMOD #40` / `wormsOnDeath`):
  // Host death spawns `1..2` Pain Worms (`painworm1..5` `hcIdx 551..555`) with `0` XP & `0` drops.
  if ((monster.wormsOnDeath || monster.umodIds.includes(40)) && !monster.shattered) {
    const wormTier =
      monster.hcIdx >= 546 && monster.hcIdx <= 550
        ? monster.hcIdx - 546
        : Math.min(4, Math.max(0, this.difficulty * 2))
    const wormHcIdx = 551 + wormTier
    const wormDefId = `painworm${String(wormTier + 1)}`
    const wormCount = 1 + this.rng.rand(2)
    for (let w = 0; w < wormCount; w++) {
      const ang = ((w * 180 + this.rng.rand(90)) * Math.PI) / 180
      const wx = monster.x + Math.cos(ang) * 1.2
      const wy = monster.y + Math.sin(ang) * 1.2
      this.spawnMonster({
        classId: wormHcIdx,
        hcIdx: wormHcIdx,
        defId: wormDefId,
        x: wx,
        y: wy,
        areaId: monster.areaId,
        level: monster.level,
        experience: 0,
        alreadyGrantedKillRewards: true,
      })
    }
  }
  // 1.13c `MonUMod #34` (`ai_after_death`, `0x6FC43570` / `0x6FC43E20`, #1901):
  // Arm post-death self-resurrection timer (`100..224` frames) when corpse is intact.
  if (
    monster.umodIds.includes(MON_UMOD.AI_AFTER_DEATH) &&
    !monster.shattered &&
    !monster.corpseConsumed &&
    monster.selfResurrectCount < 5
  ) {
    monster.selfResurrectCheckFrame = this.currentFrame + 100 + this.rng.rand(125)
  } else {
    monster.selfResurrectCheckFrame = 0
  }
}



/**
 * 1.13c shield block check against physical death explosions (`MonUMod #9` Fire Enchanted & `#33` SuicideMinion, #1821):
 * `ctb = clamp(floor(totalBlock * (dex - 15) / (clvl * 2)), 0, 75)`, divided by 3 while running.
 */
function rollPlayerExplosionShieldBlock113c(this: GameInstanceHost, player: InternalPlayerRecord): boolean {
  let blockChance = this.sumPlayerItemStat(player, 20)
  let hasEquippedShield = false
  for (const item of player.items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    const armorBlock = resolveArmorBlock113c(item.code)
    if (item.bodyLoc === 5 || (item.bodyLoc === 4 && armorBlock > 0)) {
      hasEquippedShield = true
    }
    blockChance += armorBlock
  }
  if (!hasEquippedShield) return false
  const playerCtx = this.playerCombatContext(player)
  blockChance += Math.trunc(playerCtx.statList.getAccruedStat('toblock', true))
  if (player.states.has(101) && !playerCtx.stateBus.hasState(101)) {
    const hsLvl = Math.max(1, player.skills.get(117) ?? 1)
    blockChance += computeDiminishingReturns(10, 40, hsLvl)
  }
  if (blockChance <= 0) return false
  const dex = Math.max(0, player.dexterity + this.sumPlayerItemStat(player, 2))
  const clvl = Math.max(1, player.level)
  let ctb = Math.min(
    75,
    Math.max(0, Math.floor((blockChance * Math.max(0, dex - 15)) / (clvl * 2))),
  )
  const motionMoving = this.playerMotion.get(player.unitId)?.moving === true
  const isRunning =
    player.mode === 3 ||
    (motionMoving && player.run && player.mode !== 2 && player.mode !== 6)
  if (isRunning) {
    ctb = Math.floor(ctb / 3)
  }
  return ctb > 0 && this.rng.rand(100) < ctb
}



function resolvePendingDeathExplosion(this: GameInstanceHost, monster: InternalMonsterRecord): void {
  const pending = monster.pendingDeathExplosion
  if (pending === undefined || this.currentFrame < pending.frame) return
  monster.pendingDeathExplosion = undefined
  this.damageMercsAndPetsInRadius(
    monster.areaId,
    monster.x,
    monster.y,
    pending.radius,
    pending.phys,
    'phys',
  )
  this.damageMercsAndPetsInRadius(
    monster.areaId,
    monster.x,
    monster.y,
    pending.radius,
    pending.fire,
    'fire',
  )
  for (const p of this.players.values()) {
    if (p.dead || p.areaId !== monster.areaId) continue
    if (Math.hypot(p.x - monster.x, p.y - monster.y) > pending.radius) continue
    const phys =
      pending.phys > 0 && this.rollPlayerExplosionShieldBlock113c(p) ? 0 : pending.phys
    this.applyPlayerElementalDamage(
      p,
      { phys, fire: pending.fire },
      { killerType: 'monster', killerUnitId: monster.unitId },
    )
  }
}



/**
 * 1.13c `MonUMod #26` (`Teleport`, `D2Game.dll` `0x6FC441B0` / `AI_TryTeleportUMod` `0x6FCBCDE0`, #1899 / #1993):
 * - Boss-only (`monster.rank !== 'minion'`), evaluated on `AIGENERAL_Think` (`0x6FCBD4A2`).
 * - Gate 1 (`0x6FCBCE54`): `rand(100) < 40`.
 * - Condition (`0x6FCBCEB5..0x6FCBCED0`): `lifePct < 30%`, or (`!isRanged && dist < 10`).
 * - Gate 2 (`0x6FCBCEE0`): `rand(100) < 15` (net `6%` per AI think).
 * - Picks a random walkable coordinate in `[-10..10]` around `(monster.x, monster.y)` (`sub_6FC67450`),
 *   enforces `60`-frame cooldown, and when `lifePct < 30%` without `STATE_PREVENTHEAL (52)` or active DoT,
 *   rolls `25%` (`0x6FCBCF61`) to heal `STAT_LEVEL (12)` (`monster.level` HP, `0x6FCBCF74`).
 */
function teleportEliteAwayFrom(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  targetPos: { readonly x: number; readonly y: number },
  options?: { readonly meleeBlocked?: boolean | undefined },
): boolean {
  if (
    monster.rank === 'minion' ||
    monster.hp <= 0 ||
    monster.maxHp <= 0 ||
    this.currentFrame < monster.teleportCooldownUntilFrame
  ) {
    return false
  }
  if (this.rng.rand(100) >= TELEPORT_UMOD_GATE1_PCT_113C) return false

  const dist = Math.hypot(targetPos.x - monster.x, targetPos.y - monster.y)
  const isRanged = isTeleportUModRangedMonster113c({
    isRanged: monster.isRanged,
    hcIdx: monster.hcIdx,
    defId: monster.defId,
  })
  const evalResult = evaluateTeleportUMod113c({
    rank: monster.rank,
    level: monster.level,
    hp: monster.hp,
    maxHp: monster.maxHp,
    distanceToTarget: dist,
    isRanged,
    meleeBlocked: options?.meleeBlocked,
    hasPreventHeal: monster.states.has(52),
    hasActiveDamageOverTime:
      monster.states.has(2) ||
      monster.poisonRemainingFrames > 0 ||
      monster.states.has(62) ||
      (this.monsterOpenWounds.get(monster.unitId)?.remainingFrames ?? 0) > 0,
  })
  if (!evalResult.shouldTeleport) return false
  if (this.rng.rand(100) >= TELEPORT_UMOD_GATE2_PCT_113C) return false

  const fromX = monster.x
  const fromY = monster.y
  for (let attempt = 0; attempt < 20; attempt++) {
    const dx = this.rng.rand(21) - 10
    const dy = this.rng.rand(21) - 10
    if (Math.hypot(dx, dy) < 4) continue
    const tx = fromX + dx
    const ty = fromY + dy
    if (
      this.isClosedDoorAt(monster.areaId, Math.round(tx), Math.round(ty)) ||
      (this.terrainWalkableCheck &&
        !this.terrainWalkableCheck(monster.areaId, Math.round(tx), Math.round(ty), monster.isFlying))
    ) {
      continue
    }
    if (this.isMonsterCellOccupied(monster, tx, ty)) continue
    monster.x = tx
    monster.y = ty
    monster.path = []
    monster.pathIndex = 0
    monster.pathTargetX = Number.NaN
    monster.pathTargetY = Number.NaN
    monster.mode = 1
    monster.teleportCooldownUntilFrame =
      this.currentFrame + TELEPORT_UMOD_COOLDOWN_FRAMES_113C
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMode',
      unitType: 1,
      id: monster.unitId,
      mode: 8,
      at: { x: Math.round(tx), y: Math.round(ty) },
      lifePct: monster.maxHp > 0 ? Math.round((monster.hp / monster.maxHp) * 128) : 0,
    })
    this.broadcastToArea(monster.areaId, {
      type: 'UnitMove',
      unitType: 'monster',
      id: monster.unitId,
      unitId: monster.unitId,
      mode: 'run',
      from: { x: Math.round(fromX), y: Math.round(fromY) },
      to: { x: Math.round(tx), y: Math.round(ty) },
      x: Math.round(tx),
      y: Math.round(ty),
      currentX: Math.round(tx),
      currentY: Math.round(ty),
      targetX: Math.round(tx),
      targetY: Math.round(ty),
      areaId: monster.areaId,
    })
    if (
      evalResult.canRollHeal &&
      evalResult.healAmount > 0 &&
      this.rng.rand(100) < TELEPORT_UMOD_HEAL_CHANCE_PCT_113C
    ) {
      const nextHp = Math.min(monster.maxHp, monster.hp + evalResult.healAmount)
      if (nextHp > monster.hp) {
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
    return true
  }
  return false
}



/**
 * AnimData `{code}GH{baseW}` / `{code}GHHTH` animation duration in 25 Hz frames. Monster GH
 * (`MONMODE_GETHIT` 3) plays at `AnimData.speed × (50 + EFHR) / 100`
 * (`D2Common.dll` `UNITS_UpdateAnimRateAndVelocity` `0x6FD83298..0x6FD832C7`; monsters carry
 * no FHR stat, so the rate is 50) and ends on `UNITS_IsAtEndOfFrameCycle` (`0x6FD7EF6D`).
 */
function monsterHitRecoveryFrames(this: GameInstanceHost, monster: InternalMonsterRecord): number {
  const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
  const code = monRow?.code?.trim().toUpperCase()
  if (code !== undefined && code !== '') {
    const baseW = monRow?.baseW?.trim().toUpperCase() || 'HTH'
    const record =
      this.registry.getAnimDataRecord(`${code}GH${baseW}`) ??
      (baseW !== 'HTH' ? this.registry.getAnimDataRecord(`${code}GHHTH`) : undefined)
    if (record !== undefined && record.framesPerDirection > 0 && record.hasSpeed) {
      const stepSpeed256 = computeStepSpeed256(record.animationSpeed, computeGetHitEffRate113c(0))
      return computeOneShotTicks(record.framesPerDirection, stepSpeed256)
    }
  }
  return MONSTER_HIT_RECOVERY_FRAMES
}



/**
 * Resolve the 1.13c `HitClass` ID (`0..13`) for a player's attack (`Skills.txt` `HitClass`
 * override, else active equipped weapon's `Weapons.txt` `hit class` column, else `1` = `hth`).
 */
function resolvePlayerWeaponHitClass113c(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  skillId = 0,
): number {
  if (skillId > 0) {
    const skHitClass = this.registry?.getSkillById(skillId)?.hitClass ?? 0
    if (skHitClass > 0) return skHitClass
  }
  const equipped = player.items.filter(
    (item) => item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12,
  )
  const preferredSlots = skillId === 4 || skillId === 5 ? [5, 4] : [4, 5]
  for (const slot of preferredSlots) {
    const weapon = equipped.find((item) => item.bodyLoc === slot)
    if (!weapon) continue
    const wBase = resolveWeaponBase113c(weapon.code)
    if (!wBase) continue
    const hc = resolveHitClassCode113c(wBase.hitClass)
    if (hc > 0) return hc
  }
  return 1 // `hth` (divisor 16)
}



/**
 * Resolve the 1.13c `HitClass` ID (`0..13`) for a monster's melee/skill/missile hit
 * (`Missiles.txt` `HitClass`, then `Skills.txt` `HitClass`, then `MonStats2.txt` `HitClass`).
 */
function resolveMonsterHitClass113c(this: GameInstanceHost, 
  monster: { readonly hcIdx: number },
  skillId = 0,
  missileId = 0,
): number {
  if (missileId > 0) {
    const mHitClass = this.registry?.getMissileById(missileId)?.hitClass ?? 0
    if (mHitClass > 0) return mHitClass
  }
  if (skillId > 0) {
    const skHitClass = this.registry?.getSkillById(skillId)?.hitClass ?? 0
    if (skHitClass > 0) return skHitClass
  }
  const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
  return resolveHitClassCode113c(monRow?.hitClass ?? 0)
}



/**
 * 1.13c player GetHit (`PLRMODE_GETHIT = 4`) animation duration in 25 Hz frames:
 * `CharStats.txt` / `AnimData.d2` `{Class}GH{WeaponClass}` frames + `item_fastergethitrate` (stat 99)
 * at rate `50 + EFHR`, `EFHR = trunc(120 * FHR / (120 + FHR))` (`D2Common.dll`
 * `UNITS_UpdateAnimRateAndVelocity` `0x6FD83298..0x6FD832C7`, diminishing `0x6FD823E0`).
 */
/**
 * 1.13c player Block (`PLRMODE_BLOCK = 9`) animation duration in 25 Hz frames:
 * `{Class}BL{WeaponClass}` frames + `item_fasterblockrate` (`stat 102`) + `Holy Shield` (`state 101`,
 * base rate `100` vs `50`, `D2Common.dll` `UNITS_UpdateAnimRateAndVelocity` @ `0x6FD832D0`).
 */
function playerBlockRecoveryFrames(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const equipped = player.items.filter(
    (item) => item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12,
  )
  const combat = this.playerCombat.get(player.unitId)
  const statListFbr = combat?.statList ? Math.trunc(combat.statList.getAccruedStat('item_fasterblockrate')) : 0
  // Avoid double-counting itemStatList if already synced onto combat.statList:
  const itemFbr = this.sumPlayerItemStat(player, 102)
  const modFbr = combat?.statList ? Math.trunc(combat.statList.getModifierBonus('item_fasterblockrate')) : 0
  const totalFbr = combat?.itemStatList ? itemFbr + modFbr : itemFbr + statListFbr
  const hasHolyShield =
    player.states.has(101) ||
    Boolean(combat?.stateBus.hasState(101) || combat?.stateBus.hasState('holyshield'))
  const weaponClass = resolveEquippedWeaponClass(
    equipped.map((item) => ({ code: item.code, bodyLoc: item.bodyLoc })),
  )
  const params = resolveCharacterAnimSpeedParams(player.classCode, 'bl', {
    unitStats: {
      get: (statId: number) => (statId === 102 ? totalFbr : 0),
    },
    holyShield: hasHolyShield,
    weaponClass,
  })
  return computeOneShotTicks(params.frames, params.stepSpeed256)
}



function playerHitRecoveryFrames(this: GameInstanceHost, player: InternalPlayerRecord): number {
  const equipped = player.items.filter(
    (item) => item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12,
  )
  const combat = this.playerCombat.get(player.unitId)
  const itemFhr = this.sumPlayerItemStat(player, 99)
  const modFhr = combat?.statList ? Math.trunc(combat.statList.getModifierBonus('item_fastergethitrate')) : 0
  const statListFhr = combat?.statList ? Math.trunc(combat.statList.getAccruedStat('item_fastergethitrate')) : 0
  const totalFhr = combat?.itemStatList ? itemFhr + modFhr : itemFhr + statListFhr
  const weaponClass = resolveEquippedWeaponClass(
    equipped.map((item) => ({ code: item.code, bodyLoc: item.bodyLoc })),
  )
  const params = resolveCharacterAnimSpeedParams(player.classCode, 'gh', {
    unitStats: {
      get: (statId: number) => (statId === 99 ? totalFhr : 0),
    },
    weaponClass,
  })
  return computeOneShotTicks(params.frames, params.stepSpeed256)
}



/**
 * 1.13c player GetHit (`D2Game.dll` `SUNITDMG_CheckSkipGetHit` @ `0x6FCFB910` + `SUNITDMG_ExecuteEvents`
 * @ `0x6FCFD0FC`): rolls `1/d`, `2/d`, `4/d` max-HP thresholds (`d = 8/16/32/64` by `HitClass`) and,
 * when triggered, enters `PLRMODE_GETHIT = 4` (`GH`), halts active movement/casts, and broadcasts `UnitMode`.
 */
function maybeEnterPlayerHitRecovery(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  dealtDamage: number,
  options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
  },
): void {
  if (player.dead) return
  const dmg256 = options?.dmg256 ?? dealtDamage * FIXED_ONE
  // `SUNITDMG_CheckSkipGetHit` rolls `SEED_RollRandom(&pDefender->pSeed, 2 / 4)` (`0x6FCFB9A1`, `0x6FCFB9CC`).
  const playerSeed113c =
    this.drlgRoomPopulator !== null
      ? this.unitSeeds.get(`${UNIT_TYPE_113C.player}:${player.unitId}`)
      : undefined
  // 1.13c `D2Game.dll` `0x6FCFB945..0x6FCFB948` (`SUNITDMG_CheckHitRecovery`):
  // Divides accrued `D2Common.#10913` (`GetMaxLifeFromUnit`) by `16` / `8` / `4`, not base `maxHpFixed` (#1996).
  const shouldEnter = shouldEnterGetHit113c(
    {
      maxHp256: this.getPlayerAccruedMaxHpFixed(player),
      states: player.states,
      stateBus: this.playerCombat.get(player.unitId)?.stateBus,
      isPurePoison: options?.isPurePoison,
      unitType: 'player',
      hasModeGH: true,
    },
    dmg256,
    options?.hitClass,
    playerSeed113c !== undefined
      ? { rand: (n: number) => rollLimitedSeed113c(playerSeed113c, n) }
      : this.rng,
  )
  if (!shouldEnter) return
  if (this.isPlayerSkillUninterruptible113c(player)) return

  this.interruptPendingPlayerAnimAction113c(player, 'GH')
  const recoveryFrames = this.playerHitRecoveryFrames(player)
  player.mode = 4
  player.hitRecoveryUntilFrame = this.currentFrame + recoveryFrames
  player.targetX = player.x
  player.targetY = player.y
  player.pendingInteraction = undefined
  player.pendingInteractionSteps = 0
  player.pendingNpcGamble = undefined
      player.moveTargetUnitId = undefined
  const motion = this.playerMotion.get(player.unitId)
  if (motion !== undefined) {
    motion.mover.setPosition(player.x, player.y)
    motion.x = player.x
    motion.y = player.y
    motion.moving = false
    motion.plannedX = Number.NaN
    motion.plannedY = Number.NaN
  }
  const resolvedHitClass = resolveHitClassCode113c(options?.hitClass)
  this.broadcastToArea(player.areaId, {
    type: 'UnitMode',
    unitType: 0,
    id: player.unitId,
    mode: 4,
    at: playerWirePosition(player),
    lifePct:
      player.maxHp > 0
        ? Math.max(0, Math.round((player.hp / player.maxHp) * 128))
        : 0,
    ...(resolvedHitClass > 0 ? { hitClass: resolvedHitClass } : {}),
  })
}



/**
 * 1.13c monster GetHit (`D2Game.dll` `SUNITDMG_CheckSkipGetHit` @ `0x6FCFB910` + `0x6FC21560` `mGH`):
 * `1/d`, `2/d`, `4/d` max-HP tiers (`d = 8/16/32/64` by `HitClass`), `neverCount` / `MonStats2.mGH` gates,
 * `STATE_STUNNED (21)` unconditional GetHit (`0x6FCFD0FC`), and `AnimData.d2` `GH` lock.
 */
function maybeEnterMonsterHitRecovery(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  dealtDamage: number,
  options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
  },
): void {
  if (monster.dead || monster.states.has(25)) return
  const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
  const hasModeGH =
    monster.hcIdx >= 0 &&
    monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12 < MONSTER_PATH_DATA.length
      ? (MONSTER_PATH_DATA[monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12]! & 0x08) !== 0
      : true
  const dmg256 = options?.dmg256 ?? dealtDamage * FIXED_ONE
  const shouldEnter = shouldEnterGetHit113c(
    {
      maxHp256: monster.maxHp * FIXED_ONE,
      frozenTicks: monster.frozenTicks,
      states: monster.states,
      stateBus: this.monsterCombat.get(monster.unitId)?.stateBus,
      isPurePoison: options?.isPurePoison,
      unitType: 'monster',
      hasModeGH,
      neverCount: Boolean(monRow?.neverCount),
    },
    dmg256,
    options?.hitClass,
    this.rng,
  )
  if (!shouldEnter) return
  const wasIdleWithPendingAi = monster.mode === 1 && monster.nextAiFrame > this.currentFrame
  monster.pendingAttack = undefined
  monster.pendingAllyAttack = undefined
  monster.pendingResurrection = undefined
  monster.actionAnimEndFrame = 0
  monster.hitRecoveryUntilFrame = this.currentFrame + this.monsterHitRecoveryFrames(monster)
  if (this.drlgRoomPopulator !== null) {
    // A GH started by another unit's update is visible for `ceil(frames * 256 / speed)` frames
    // (`computeOneShotTicks + 1`; oracle `a1-bloodmoor-melee` zombie #10 GH F=1086..1102, NU F=1103;
    // kb/engine/d2game-plrmode-gethit-113c.md §2).
    monster.hitRecoveryUntilFrame += 1
    this.areaPathWorld.stopMonsterMove113c(monster.areaId, monster.unitId, 3)
    // An idle monster keeps its pending type-2 AI event through the GetHit and that event interrupts the GH
    // (oracle `p52-necromancer-poison-golem` zombie #9: A2 ends F818 -> event F833 = 818 + aidel 15, GH from
    // F823, A2 on F833); a walking monster has none pending and re-arms `aidel` after the full GH (oracle
    // `a1-bloodmoor-melee` zombie #10: GH F1086..F1102, no think through F1105).
    monster.nextAiFrame = wasIdleWithPendingAi
      ? monster.nextAiFrame
      : monster.hitRecoveryUntilFrame + Math.max(1, Math.round(monster.aiDelay || 15))
  }
  monster.path = []
  monster.pathIndex = 0
  monster.pathTargetX = Number.NaN
  monster.pathTargetY = Number.NaN
  monster.mode = 3
  const resolvedHitClass = resolveHitClassCode113c(options?.hitClass)
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: monster.unitId,
    mode: 3,
    lifePct:
      monster.maxHp > 0
        ? Math.max(0, Math.round((monster.hp / monster.maxHp) * 128))
        : 0,
    ...(resolvedHitClass > 0 ? { hitClass: resolvedHitClass } : {}),
  })
  // 1.13c `MONMODE_ChangeAnimMode(3)` -> `MONUMOD_DispatchEvent(col1 = 0x6FC41B00 -> 0x6FC460D0, #1995):
  // `MonUMod #20` (`scarab`) emits 8 radial `#225 buglightning` bolts strictly on entering `MONMODE_GETHIT` (`mode = 3`).
  this.emitScarabBugLightningBurst113c(monster)
}



/**
 * Confusion (59) / Attract (57) / Conversion (53) monster-vs-monster attack. Runs the
 * shared `executeSUnitDmg` physical pipeline (to-hit, block, resistances) and then the
 * unified death flow so clients, drops, XP and death effects all observe the kill.
 */
function attackMonsterTarget(this: GameInstanceHost, 
  attacker: InternalMonsterRecord,
  target: InternalMonsterRecord,
): void {
  if (target.dead || attacker.dead) return
  const attackerStats = new UnitStatList(this.registry)
  attackerStats.setBaseStat('level', attacker.level)
  attackerStats.setBaseStat('tohit', attacker.ar)
  attackerStats.setBaseStat('armorclass', attacker.ac)
  attackerStats.setBaseStat('maxhp', attacker.maxHp * FIXED_ONE)
  attackerStats.setHp256(attacker.hp * FIXED_ONE)
  const attackerCtx: CombatUnitContext = {
    id: `monster_${attacker.unitId}`,
    name: attacker.name,
    unitType: 'monster',
    statList: attackerStats,
    stateBus: new StateBus(attackerStats, this.registry),
    x: attacker.x,
    y: attacker.y,
    isUndead: attacker.isUndead,
    isDemon: attacker.isDemon,
    isBoss: attacker.isBoss,
    isPrimeEvil: attacker.isPrimeEvil,
    coldEffect: attacker.coldEffect,
  }

  const defenderStats = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
  defenderStats.setBaseStat('level', target.level)
  defenderStats.setBaseStat('tohit', target.ar)
  defenderStats.setBaseStat('armorclass', target.ac)
  defenderStats.setBaseStat('toblock', target.toBlock)
  defenderStats.setBaseStat('maxhp', target.maxHp * FIXED_ONE)
  defenderStats.setHp256(target.hp * FIXED_ONE)
  defenderStats.setBaseStat('damageresist', target.resistances.phys)
  defenderStats.setBaseStat('magicresist', target.resistances.magic)
  defenderStats.setBaseStat('fireresist', target.resistances.fire)
  defenderStats.setBaseStat('lightresist', target.resistances.light)
  defenderStats.setBaseStat('coldresist', target.resistances.cold)
  defenderStats.setBaseStat('poisonresist', target.resistances.poison)
  const defenderStateBus = new StateBus(defenderStats, this.registry)
  this.mirrorPersistentStates(this.monsterCombat.get(target.unitId), defenderStateBus)
  const defenderCtx: CombatUnitContext = {
    id: `monster_${target.unitId}`,
    name: target.name,
    unitType: 'monster',
    statList: defenderStats,
    stateBus: defenderStateBus,
    x: target.x,
    y: target.y,
    isUndead: target.isUndead,
    isDemon: target.isDemon,
    isBoss: target.isBoss,
    isPrimeEvil: target.isPrimeEvil,
    coldEffect: target.coldEffect,
    drain: target.drain,
  }

  this.broadcastToArea(attacker.areaId, {
    type: 'UnitMode',
    unitType: 1,
    id: attacker.unitId,
    mode: 4,
    at: { x: Math.round(attacker.x), y: Math.round(attacker.y) },
    lifePct:
      attacker.maxHp > 0
        ? Math.round((attacker.hp / attacker.maxHp) * 128)
        : 0,
  })
  const auraDmgPct = this.monsterAuraDamageBonusPct(attacker)
  // Confused/attracted monsters use their real A1/A2 damage riders too, not
  // just the pure physical band.
  const rider = attacker.elementalAttacks.find(
    (entry) =>
      (entry.mode === 'A1' || entry.mode === 'A2') &&
      (entry.chancePct >= 100 || this.rng.rand(100) < entry.chancePct),
  )
  const riderType =
    rider?.type === 'ltng'
      ? 'ltng'
      : rider?.type === 'cold' || rider?.type === 'frze'
        ? 'cold'
        : rider?.type === 'pois'
          ? 'pois'
          : rider?.type === 'mag'
            ? 'mag'
            : rider?.type === 'fire'
              ? 'fire'
              : undefined
  const riderPois =
    riderType === 'pois' && rider !== undefined
      ? scaleMonStatsPoisonRider113c(
          rider.minDamage ?? rider.min ?? 0,
          rider.maxDamage ?? rider.max ?? 0,
          rider.durationFrames ?? rider.duration ?? 25,
        )
      : undefined
  const dmgOut = executeSUnitDmg(attackerCtx, defenderCtx, {
    skillId: 0,
    attackKind: 'melee',
    srcDam: 0,
    flatPhysMin256: Math.floor(attacker.minDmg * FIXED_ONE * (1 + auraDmgPct / 100)),
    flatPhysMax256: Math.floor(attacker.maxDmg * FIXED_ONE * (1 + auraDmgPct / 100)),
    ...(riderType !== undefined
      ? {
          elemType: riderType,
          elemMin256:
            Math.max(
              0,
              riderPois !== undefined
                ? riderPois.minCumulHp
                : (rider?.minDamage ?? rider?.min ?? 0),
            ) * FIXED_ONE,
          elemMax256:
            Math.max(
              0,
              riderPois !== undefined
                ? riderPois.maxCumulHp
                : (rider?.maxDamage ?? rider?.max ?? 0),
            ) * FIXED_ONE,
          elemDurationFrames:
            riderPois !== undefined
              ? riderPois.durationFrames
              : (rider?.durationFrames ?? rider?.duration ?? 0),
        }
      : {}),
  }, this.rng)
  if (!dmgOut.hit) {
    if (dmgOut.avoidedReason === 'block') {
      target.mode = MONMODE_BLOCK
      this.broadcastToArea(target.areaId, {
        type: 'UnitMode',
        unitType: 1,
        id: target.unitId,
        mode: MONMODE_BLOCK,
        lifePct:
          target.maxHp > 0
            ? Math.max(0, Math.round((target.hp / target.maxHp) * 128))
            : 0,
      })
    }
    return
  }
  const poisonBitrate256 = dmgOut.poisonBitrate256 ?? 0
  const poisonDurationFrames = dmgOut.poisonDurationFrames ?? 0
  const poisonTotal256 =
    poisonBitrate256 > 0 && poisonDurationFrames > 0 ? poisonBitrate256 * poisonDurationFrames : 0
  const dealtDamage = Math.floor(Math.max(0, dmgOut.totalDamage256 - poisonTotal256) / FIXED_ONE)
  if (dealtDamage > 0) {
    target.hp = Math.max(0, target.hp - dealtDamage)
    this.broadcastToArea(target.areaId, {
      type: 'UnitStatUpdate',
      unitType: 'monster',
      unitId: target.unitId,
      statId: 6,
      value: target.hp,
    })
    if (target.hp <= 0) {
      const credited = this.creditedPlayerForMonsterKill(attacker, target)
      this.applyMonsterDeath(target, credited, 'phys')
      return
    }
    this.emitLightningEnchantedBoltsOnStruck113c(target)
    this.maybeEnterMonsterHitRecovery(target, dealtDamage, {
      hitClass: this.resolveMonsterHitClass113c(attacker),
    })
  }
  if (!target.dead && poisonBitrate256 > 0 && poisonDurationFrames > 0) {
    if (target.poisonRemainingFrames <= 0 || poisonBitrate256 >= target.poisonBitrate256) {
      const credited = this.creditedPlayerForMonsterKill(attacker, target)
      target.poisonBitrate256 = poisonBitrate256
      target.poisonRemainingFrames = poisonDurationFrames
      target.poisonCarry256 = 0
      target.poisonAttackerId = credited?.unitId ?? 0
      target.poisonSkillId = 0
      target.poisonKillSource = credited !== undefined ? 'pet' : undefined
    }
    this.applyUnitState(
      target.states,
      target.stateTimers,
      'monster',
      target.unitId,
      target.areaId,
      2,
      target.poisonRemainingFrames,
    )
  }
}



/** Direct conversion (53) or curse (Attract 57 / Confuse 59) caster on a single monster without fallback. */
function directCreditedPlayerForMonster(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
): InternalPlayerRecord | undefined {
  const converted = this.players.get(monster.convertedByPlayerId)
  if (converted && !converted.dead && converted.areaId === monster.areaId) {
    return converted
  }
  for (const entry of this.monsterCombat.get(monster.unitId)?.stateBus.getActiveEntries() ?? []) {
    if (entry.stateId !== 53 && entry.stateId !== 57 && entry.stateId !== 59) continue
    const sourceId = Number.parseInt(entry.sourceUnitId.replace(/^player_/, ''), 10)
    const source = Number.isFinite(sourceId) ? this.players.get(sourceId) : undefined
    if (source && !source.dead && source.areaId === monster.areaId) return source
  }
  return undefined
}



/**
 * Curse / conversion caster credited for a monster-vs-monster kill (`D2Game.dll`
 * `SUNITDMG_GetMasterUnit`): checks `attacker` first, then `target` (e.g. a normal monster
 * killing an Attracted/Converted target), and only falls back to the nearest living player
 * in the area when neither monster carries an explicit caster unit.
 */
function creditedPlayerForMonsterKill(this: GameInstanceHost, 
  attacker: InternalMonsterRecord,
  target?: InternalMonsterRecord,
): InternalPlayerRecord | undefined {
  const directAttacker = this.directCreditedPlayerForMonster(attacker)
  if (directAttacker !== undefined) return directAttacker
  if (target !== undefined) {
    const directTarget = this.directCreditedPlayerForMonster(target)
    if (directTarget !== undefined) return directTarget
  }
  let nearest: InternalPlayerRecord | undefined
  let nearestDist = Infinity
  for (const p of this.players.values()) {
    if (p.dead || p.areaId !== attacker.areaId) continue
    const d = Math.hypot(p.x - attacker.x, p.y - attacker.y)
    if (d < nearestDist) {
      nearestDist = d
      nearest = p
    }
  }
  return nearest
}



/**
 * 1.13c knockback (`D2Game.dll` `0x6FCFD00E`, `0x6FC95160..0x6FC9526F`, `0x6FC96A10`, `0x6FC965E0`;
 * `D2Common.dll` `0x6FDB7390` `PATHTYPE_KNOCKBACK = 8`, `0x6FDB6C20` raycast):
 * - Requires `MonStats2.mGH` (`0x0008`) and `MonStats2.mKB` (`0x2000`).
 * - Distance `nDist = (BaseId == 78 'sandmaggot1') ? 10 : 5` -> `stepDist = (nDist >> 1) + 1`
 *   (`3` sub-tiles standard, `6` sub-tiles `sandmaggot1`), scaled along the Chebyshev vector.
 * - Transitions monster into `MONMODE_KNOCKBACK` (`13`) using its `GH` animation duration.
 */
function knockbackMonster(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  fromX: number,
  fromY: number,
): boolean {
  // 1.13c D2Game.dll 0x6FCFD00E & 0x6FC95160 -> 0x6FC21560(pDefender, 3 / 13):
  // require both MonStats2.mGH (bit 3 = 0x0008) and MonStats2.mKB (bit 13 = 0x2000).
  if (
    monster.hcIdx >= 0 &&
    monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12 < MONSTER_PATH_DATA.length
  ) {
    const modeMask = MONSTER_PATH_DATA[monster.hcIdx * MONSTER_PATH_DATA_STRIDE + 12]!
    if ((modeMask & 0x2000) === 0 || (modeMask & 0x0008) === 0) {
      return false
    }
  }
  if (monster.velocity <= 0) return false
  if (monster.isBoss && monster.isPrimeEvil) return false
  const dx = monster.x - fromX
  const dy = monster.y - fromY
  const maxDelta = Math.max(Math.abs(dx), Math.abs(dy))
  if (!Number.isFinite(maxDelta) || maxDelta <= 0) return false
  const monRow = MONSTATS_113C_ROWS[monster.hcIdx]
  const kbStep = computeKnockbackStep113c({
    targetX: monster.x,
    targetY: monster.y,
    sourceX: fromX,
    sourceY: fromY,
    hcIdx: monster.hcIdx,
    baseId: monRow?.baseId,
  })
  const knockDistance = kbStep.stepDist || MONSTER_KNOCKBACK_DISTANCE
  const startX = monster.x
  const startY = monster.y
  let endX = startX
  let endY = startY
  for (let travelled = 1; travelled <= knockDistance; travelled++) {
    const tx = startX + Math.trunc((travelled * dx) / maxDelta)
    const ty = startY + Math.trunc((travelled * dy) / maxDelta)
    if (!this.isMonsterStepWalkable(monster.areaId, endX, endY, tx, ty, monster.isFlying)) {
      break
    }
    if (this.isMonsterCellOccupied(monster, tx, ty)) break
    endX = tx
    endY = ty
  }
  if (endX === startX && endY === startY) return false
  monster.x = endX
  monster.y = endY
  monster.mode = MONMODE_KNOCKBACK
  monster.hitRecoveryUntilFrame = this.currentFrame + this.monsterHitRecoveryFrames(monster)
  monster.pendingAttack = undefined
  monster.pendingAllyAttack = undefined
  monster.pendingResurrection = undefined
  monster.path = []
  monster.pathIndex = 0
  monster.pathTargetX = Number.NaN
  monster.pathTargetY = Number.NaN
  const from = { x: Math.round(startX), y: Math.round(startY) }
  const at = { x: Math.round(endX), y: Math.round(endY) }
  this.broadcastToArea(monster.areaId, {
    type: 'UnitMove',
    unitType: 'monster',
    id: monster.unitId,
    unitId: monster.unitId,
    mode: 'knockback',
    from,
    to: at,
    x: at.x,
    y: at.y,
  })
  return true
}



/**
 * Broadcast a static Missiles.txt explosion (the death effect itself is resolved
 * server-side so it can use the full physical/fire split and player resistances).
 */
function broadcastExplosionMissile(this: GameInstanceHost, 
  monster: InternalMonsterRecord,
  missileClassId: number,
): void {
  const at = { x: Math.round(monster.x), y: Math.round(monster.y) }
  this.broadcastToArea(monster.areaId, {
    type: 'CreateMissile',
    missileId: this.allocateUnitId(UNIT_TYPE_113C.missile),
    missileClassId,
    at,
    target: at,
    x: at.x,
    y: at.y,
    targetX: at.x,
    targetY: at.y,
    skillId: missileClassId,
    level: Math.max(1, monster.level),
    ownerType: 1,
    ownerUnitType: 'monster',
    ownerId: monster.unitId,
    sourceUnitId: monster.unitId,
    areaId: monster.areaId,
  } as ServerEvent)
}

/**
 * 1.13c `MonUMod #17` (`lightning` / Lightning Enchanted, `D2Game.dll` `0x6FC41AD0` / `0x6FC468C0` -> `0x6FC46320`, #1995):
 * Boss-only (`rank !== 'minion'`) 8-bolt radial `Missiles.txt` ID `195` (`lightunique`) burst on struck,
 * gated by per-monster `dwLastLeFrame` 10-frame cooldown (`abs(dwGameFrame - dwLastLeFrame) >= 10`) and
 * using exact `Missiles.txt` `lightunique` damage (`2 * slvl - 1` at `slvl = max(1, floor(mlvl / 2))`, `physDamage = 0`).
 * In 1.13c `Missiles.txt`, `#195 lightunique` has `NoMultiShot = 1`, so `MONUMOD_Ev5_Multishot`
 * (`0x6FC45B67..0x6FC45B72`) suppresses fan duplication (`8` bolts even with `MonUMod #29`).
 */
function emitLightningEnchantedBoltsOnStruck113c(
  this: GameInstanceHost,
  monster: InternalMonsterRecord,
): void {
  if (
    monster.hp <= 0 ||
    monster.rank === 'minion' ||
    !monster.umodIds.includes(MON_UMOD.LIGHTNING)
  ) {
    return
  }
  if (
    monster.lastLightningBoltFrame !== undefined &&
    Math.abs(this.currentFrame - monster.lastLightningBoltFrame) < LIGHTNING_UMOD_COOLDOWN_FRAMES_113C
  ) {
    return
  }
  monster.lastLightningBoltFrame = this.currentFrame
  const leSlvl = computeLightningEnchantedBoltSlvl113c(monster.level)
  const boltDmg = computeLightningUniqueBoltDamage113c(monster.level)
  const vectors = computeChargedBolt8WayVectors(monster.x, monster.y, 1.5)
  for (const vec of vectors) {
    this.spawnMonsterMissile(monster, vec.targetX, vec.targetY, boltDmg, 195, 0, {
      skillLevel: leSlvl,
      physDamage: 0,
      elemDamage: boltDmg,
      element: 'ltng',
    })
  }
}

/**
 * 1.13c `MonUMod #20` (`scarab`, `D2Game.dll` `0x6FC41B00` -> `0x6FC460D0`, #1995):
 * Fires `4 * 2 = 8` radial `Missiles.txt` ID `225` (`buglightning`, `0xE1`) bolts across all monster ranks
 * (including minions) on `MONMODE_GETHIT` (`mode = 3`) and `MONMODE_DEATH` (`mode = 0`), at `slvl = max(1, mlvl)`
 * with exact `Missiles.txt` `#225` damage (`HitShift = 0`, `EMin = 256`, `MinELev = 128` -> `1 + floor((slvl - 1) / 2)` HP).
 */
function emitScarabBugLightningBurst113c(
  this: GameInstanceHost,
  monster: InternalMonsterRecord,
): void {
  if (
    !monster.umodIds.includes(MON_UMOD.SCARAB) &&
    !isScarabMonster(monster.hcIdx, monster.defId)
  ) {
    return
  }
  const scarabSlvl = computeScarabChargedBoltSlvl113c(monster.level)
  const boltDmg = computeScarabBugLightningDamage113c(monster.level)
  const radialTargets = computeScarabChargedBoltFanTargets113c(
    monster.x,
    monster.y,
    monster.x,
    monster.y,
    1.5,
  )
  for (const vec of radialTargets) {
    this.spawnMonsterMissile(
      monster,
      vec.targetX,
      vec.targetY,
      boltDmg,
      SCARAB_BUGLIGHTNING_MISSILE_ID_113C,
      0,
      {
        skillLevel: scarabSlvl,
        physDamage: 0,
        elemDamage: boltDmg,
        element: 'ltng',
        skipMultishot: true,
      },
    )
  }
}

export interface MonsterDamageMethods {
  applyDamageToMonster(attackerOrMonsterId: InternalPlayerRecord | number, monsterOrDamage: InternalMonsterRecord | number, damageOrAttackerId?: number, skillIdArg?: number, channelOverride?: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois', source?: 'player' | 'merc' | InternalMercenaryRecord | SummonedPetUnit | undefined, hitContext?: {
    readonly attackKind?: 'melee' | 'missile' | 'spell' | undefined
    readonly autoHit?: boolean | undefined
    readonly unblockable?: boolean | undefined
    readonly elemDurationFrames?: number | undefined
    readonly toHitBonusPct?: number | undefined
    readonly weaponHand?: 'left' | 'right' | undefined
    readonly elemDamage256?: number | undefined
    readonly concentrationAlreadyApplied?: boolean | undefined
    readonly bladeWeaponHit?: boolean | undefined
    readonly bladeShieldPulse?: boolean | undefined
    readonly outHitResult?: { landedHitRoll: boolean } | undefined
    readonly srcDam?: number | undefined
    readonly skipHitRiders?: boolean | undefined
    readonly skipElemMastery?: boolean | undefined
    readonly missileHitFlags113c?: number | undefined
    readonly missileResultFlags113c?: number | undefined
    readonly suppressReturnFireThreat?: boolean | undefined
    readonly isGroundFire?: boolean | undefined
    readonly damageRate?: number | undefined
    readonly noHitRecovery?: boolean | undefined
    readonly suppressBlockAnim?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly fromPet?: boolean | undefined
    readonly allowDeadTarget113c?: boolean | undefined
    readonly d2AttackerSeed113c?: { lo: number; hi: number } | undefined
    readonly unrolledWeaponBase113c?:
      | {
          readonly min256: number
          readonly max256: number
          readonly edPct: number
          readonly srcDam: number
          readonly enDmgPct113c?: number | undefined
        }
      | undefined
    readonly vengeanceSpec?:
      | {
          readonly weaponBaseRolled: number
          readonly physDamagePct: number
          readonly griefFlat: number
          readonly multiElemPacket: NonNullable<SUnitDmgPacket["multiElemPacket"]>
        }
      | undefined
  }): boolean
  applyMonsterPoisonDot(attacker: InternalPlayerRecord, monster: InternalMonsterRecord, rawBitrate256: number, durationFrames: number, skillId: number, effectiveSource?: 'player' | 'merc' | 'pet' | undefined, opts?: { readonly preMasteryApplied?: boolean | undefined } | undefined): boolean
  resolveSkillColdOrFreezeDuration113c(attacker: InternalPlayerRecord, skillId: number, channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois', explicitDurationFrames?: number | undefined, missileRec?: MissileRecord | undefined, handItemOpts?: {
    readonly weaponHand?: 'right' | 'left'
    readonly excludePlayerItems?: boolean | undefined
  } | undefined): { readonly kind: 'freeze' | 'chill' | null; readonly rawFrames: number }
  finishMonsterDamage(attacker: InternalPlayerRecord, monster: InternalMonsterRecord, dealtDamage: number, skillId: number, channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois', hitClass?: number | string | undefined, elemDurationFrames?: number | undefined, fromMerc?: boolean | undefined, finishOpts?: {
    readonly fromPet?: boolean | undefined
    readonly isGroundFire?: boolean | undefined
    readonly noHitRecovery?: boolean | undefined
    readonly missileKnockbackChancePct?: number | undefined
    readonly suppressReturnFireThreat?: boolean | undefined
    readonly dmg256?: number | undefined
    readonly weaponHand?: 'right' | 'left' | undefined
  }): void
  applyMonsterDeath(monster: InternalMonsterRecord, creditedPlayer: InternalPlayerRecord | undefined, channel: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag' | 'pois', killSource?: 'player' | 'merc' | 'pet' | 'other' | undefined): void
  rollPlayerExplosionShieldBlock113c(player: InternalPlayerRecord): boolean
  resolvePendingDeathExplosion(monster: InternalMonsterRecord): void
  teleportEliteAwayFrom(monster: InternalMonsterRecord, targetPos: { readonly x: number; readonly y: number }, options?: { readonly meleeBlocked?: boolean | undefined }): boolean
  monsterHitRecoveryFrames(monster: InternalMonsterRecord): number
  resolvePlayerWeaponHitClass113c(player: InternalPlayerRecord, skillId?: number | undefined): number
  resolveMonsterHitClass113c(monster: { readonly hcIdx: number }, skillId?: number | undefined, missileId?: number | undefined): number
  playerBlockRecoveryFrames(player: InternalPlayerRecord): number
  playerHitRecoveryFrames(player: InternalPlayerRecord): number
  maybeEnterPlayerHitRecovery(player: InternalPlayerRecord, dealtDamage: number, options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
  }): void
  maybeEnterMonsterHitRecovery(monster: InternalMonsterRecord, dealtDamage: number, options?: {
    readonly dmg256?: number | undefined
    readonly hitClass?: number | string | undefined
    readonly isPurePoison?: boolean | undefined
  }): void
  attackMonsterTarget(attacker: InternalMonsterRecord, target: InternalMonsterRecord): void
  directCreditedPlayerForMonster(monster: InternalMonsterRecord): InternalPlayerRecord | undefined
  creditedPlayerForMonsterKill(attacker: InternalMonsterRecord, target?: InternalMonsterRecord): InternalPlayerRecord | undefined
  knockbackMonster(monster: InternalMonsterRecord, fromX: number, fromY: number): boolean
  broadcastExplosionMissile(monster: InternalMonsterRecord, missileClassId: number): void
  emitLightningEnchantedBoltsOnStruck113c(monster: InternalMonsterRecord): void
  emitScarabBugLightningBurst113c(monster: InternalMonsterRecord): void
}

export const monsterDamageMethods: Record<keyof MonsterDamageMethods, unknown> = {
  applyDamageToMonster,
  applyMonsterPoisonDot,
  resolveSkillColdOrFreezeDuration113c,
  finishMonsterDamage,
  applyMonsterDeath,
  rollPlayerExplosionShieldBlock113c,
  resolvePendingDeathExplosion,
  teleportEliteAwayFrom,
  monsterHitRecoveryFrames,
  resolvePlayerWeaponHitClass113c,
  resolveMonsterHitClass113c,
  playerBlockRecoveryFrames,
  playerHitRecoveryFrames,
  maybeEnterPlayerHitRecovery,
  maybeEnterMonsterHitRecovery,
  attackMonsterTarget,
  directCreditedPlayerForMonster,
  creditedPlayerForMonsterKill,
  knockbackMonster,
  broadcastExplosionMissile,
  emitLightningEnchantedBoltsOnStruck113c,
  emitScarabBugLightningBurst113c,
}
