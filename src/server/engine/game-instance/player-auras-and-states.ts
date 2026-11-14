/**
 * GameInstance Subsystem: Persistent Combat Contexts, Buff/Curse States & Friendly/Enemy/Item Auras (`src/server/engine/game-instance/player-auras-and-states.ts`).
 */

import type { SkillRecord } from '../../../common/data/data-registry.ts'
import { QUEST_FLAG_CUSTOM_7_113C, hasQuestFlag113c } from '../quests-113c.ts'
import { FRIENDLY_AURA_TARGET_STATE_IDS_113C, PALADIN_AURA_STATE_BY_SKILL_ID } from '../../../common/skills/paladin-auras.ts'
import { resolveHirelingStatsAtLevel } from '../../../common/units/hireling-table.ts'
import type { ServerEvent } from '../../../netproto/index.ts'
import type { SummonedPetUnit } from '../../ai/summon-manager.ts'
import type { CombatUnitContext } from '../combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../stat-list.ts'
import { StateBus } from '../state-bus.ts'
import { AuraScanner, type AuraPulseOutcome, type CorpseContext } from '../aura-scanner.ts'
import { isWithinAuraRange, passesAuraFilter } from '../../../common/skills/aura-filter.ts'
import { computeDiminishingReturns, evaluateCalc } from '../../../common/data/calc-ast.ts'
import { difficultyLifeStealDivisor, difficultyManaStealDivisor, difficultyResistPenalty } from '../difficulty-resist-penalty.ts'
import { STATE_CONVERSION_113C, STATE_CONVERSION_SAVE_113C, restoreConversionLevelScaling113c } from '../../skills/p1-wave4-skills-113c.ts'
import type { GameInstanceHost } from './host.ts'
import type { FriendlyAuraAlliesResult113c, InternalMercenaryRecord, InternalMonsterRecord, InternalPlayerRecord, MercAuraRuntime, MercAuraSourceEntry, PersistentCombatUnit } from './types.ts'
import { MERC_AURA_TO_SKILL_ID, STAT_ITEM_ALLSKILLS, TOWN_AREAS, collectEquippedItemStats, collectItemStats, monsterHp256_113c } from './constants-and-helpers.ts'
import { syncUnitStateTimerFromExpireFrame113c } from './player-death-and-shrines.ts'


/**
 * Non-damage effect of an accepted missile-less cast, driven by the `Skills.txt` row and the
 * registry evaluation (#1328):
 * - Unsummon (3) dismisses the owner's pet at the target; `summon` / `pettype` rows create the pet
 *   through `summonPet` (`SummonManager`);
 * - `aura = 1` rows keep `aurastate` on the caster until another aura replaces it;
 * - `auratargetstate` rows (curses, Inner Sight, Slow Missiles, Taunt, Cloak of Shadows) apply that
 *   state for `durationFrames` to every hostile within `radiusSubtiles` of the target (only the
 *   clicked monster when the radius is 0);
 * - other `aurastate` rows (armors, Energy Shield, Enchant, shapeshift, Fade, ...) apply the state
 *   to the caster for `durationFrames`; absorb-limited armors (`durationFrames = 0`) persist.
 */
/** Persistent combat context of a player, re-synced from the authoritative record. */
function playerCombatContext(this: GameInstanceHost, player: InternalPlayerRecord): CombatUnitContext {
  this.syncPlayerEquippedSetStates113c(player)
  let unit = this.playerCombat.get(player.unitId)
  if (unit === undefined) {
    const statList = new UnitStatList(this.registry, undefined, {
      ownerType: 'player',
      charClass: player.classCode,
    })
    const itemStatList = new UnitStatList(this.registry, undefined, {
      ownerType: 'item',
      charClass: player.classCode,
    })
    statList.attachStatList(itemStatList)
    unit = { statList, stateBus: new StateBus(statList, this.registry), itemStatList }
    this.playerCombat.set(player.unitId, unit)
  } else if (unit.itemStatList === undefined) {
    const itemStatList = new UnitStatList(this.registry, undefined, {
      ownerType: 'item',
      charClass: player.classCode,
    })
    unit.statList.attachStatList(itemStatList)
    unit = { ...unit, itemStatList }
    this.playerCombat.set(player.unitId, unit)
  }
  for (const shrineStateId of [128, 129, 130, 131, 132, 133, 134, 135, 136, 137] as const) {
    if (!player.states.has(shrineStateId) && unit.stateBus.hasState(shrineStateId)) {
      unit.stateBus.removeState(shrineStateId)
    }
  }
  const st = unit.statList
  st.setOwnerType('player')
  st.setCharClass(player.classCode)
  st.setBaseStat('level', player.level)
  st.setBaseStat('strength', player.strength)
  st.setBaseStat('dexterity', player.dexterity)
  st.setBaseStat('vitality', player.vitality)
  st.setBaseStat('energy', player.energy)
  const itemSt = unit.itemStatList!
  itemSt.setOwnerType('item')
  itemSt.setCharClass(player.classCode)
  itemSt.setBaseStat('strength', this.sumPlayerItemStat(player, 0))
  itemSt.setBaseStat('energy', this.sumPlayerItemStat(player, 1))
  itemSt.setBaseStat('dexterity', this.sumPlayerItemStat(player, 2))
  itemSt.setBaseStat('vitality', this.sumPlayerItemStat(player, 3))
  itemSt.setBaseStat('maxhp', this.sumPlayerItemPoolStat256(player, 7))
  itemSt.setBaseStat('maxmana', this.sumPlayerItemPoolStat256(player, 9))
  itemSt.setBaseStat('maxstamina', this.sumPlayerItemPoolStat256(player, 11))
  itemSt.setBaseStat('item_maxhp_percent', this.sumPlayerItemStat(player, 76))
  itemSt.setBaseStat('item_maxmana_percent', this.sumPlayerItemStat(player, 77))
  itemSt.setBaseStat('item_hp_perlevel', this.sumPlayerItemPoolStat256(player, 216))
  itemSt.setBaseStat('item_mana_perlevel', this.sumPlayerItemPoolStat256(player, 217))
  itemSt.setBaseStat('item_stamina_perlevel', this.sumPlayerItemPoolStat256(player, 242))
  st.setBaseStat('tohit', this.computePlayerBaseToHit113c(player))
  st.setBaseStat('item_tohit_percent', this.computePlayerToHitPctBonus113c(player))
  st.setBaseStat('armorclass', this.computePlayerBaseDefense(player))
  st.setBaseStat('armorclass_vs_missile', this.sumPlayerItemStat(player, 32))
  st.setBaseStat('armorclass_vs_hth', this.sumPlayerItemStat(player, 33))
  st.setBaseStat('item_ignoretargetac', this.sumPlayerItemStat(player, 115))
  st.setBaseStat('item_fractionaltargetac', this.sumPlayerItemStat(player, 116))
  st.setBaseStat('item_demondamage_percent', this.sumPlayerItemStat(player, 121))
  st.setBaseStat('item_undeaddamage_percent', this.sumPlayerItemStat(player, 122))
  st.setBaseStat('item_demon_tohit', this.sumPlayerItemStat(player, 123))
  st.setBaseStat('item_undead_tohit', this.sumPlayerItemStat(player, 124))
  st.setBaseStat('item_deadlystrike', this.sumPlayerItemStat(player, 141))
  st.setBaseStat('maxhp', player.maxHpFixed)
  st.setHp256(player.hpFixed)
  st.setBaseStat('maxmana', player.maxManaFixed)
  st.setMana256(player.manaFixed)
  st.setBaseStat('maxstamina', player.maxStaminaFixed)
  st.setBaseStat('stamina', player.staminaFixed)
  // D2Game.dll 0x6fc7b0b0: A5Q3 +10 all resistances requires bit 7 (0x0080) of word 37 ('a5q3'),
  // which is set only when the player consumes Scroll of Resistance ('tr2', 0x6fcf9f28).
  const anyaResist = hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_7_113C)
    ? 10
    : 0
  st.setBaseStat('fireresist', anyaResist)
  st.setBaseStat('lightresist', anyaResist)
  st.setBaseStat('coldresist', anyaResist)
  st.setBaseStat('poisonresist', anyaResist)
  const elemBonuses = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ])
  for (const stat of collectEquippedItemStats(player.items)) {
    if (stat.statId === 126) {
      const p = stat.param === undefined || stat.param === 0 ? 1 : stat.param
      elemBonuses.set(p, (elemBonuses.get(p) ?? 0) + stat.value)
    }
  }
  const seenElemSkillUniqueCharms = new Set<number>()
  for (const item of player.items) {
    if (!this.isActiveInventoryCharm113c(player, item, seenElemSkillUniqueCharms)) continue
    for (const stat of collectItemStats(item)) {
      if (stat.statId === 126) {
        const p = stat.param === undefined || stat.param === 0 ? 1 : stat.param
        elemBonuses.set(p, (elemBonuses.get(p) ?? 0) + stat.value)
      }
    }
  }
  for (const [param, bonus] of elemBonuses) st.setElemSkillsBonus(param, bonus)
  st.setBaseStat('item_pierce', this.sumPlayerItemStat(player, 156))
  st.setBaseStat('curse_resistance', this.sumPlayerItemStat(player, 109))
  st.setBaseStat('item_cannotbefrozen', this.sumPlayerItemStat(player, 153))
  st.setBaseStat('item_halffreezeduration', this.sumPlayerItemStat(player, 118))
  this.applyItemMasteryPierceStats113c(st, (statId) => this.sumPlayerItemStat(player, statId))
  this.syncPlayerSkillLevelsToStatList113c(player, st, unit.stateBus)
  return {
    id: `player_${player.unitId}`,
    name: player.name,
    charClass: player.classCode,
    unitType: 'player',
    statList: st,
    stateBus: unit.stateBus,
    x: player.x,
    y: player.y,
    armorClassIncludesDex: true,
    resistPenalty: difficultyResistPenalty(this.difficulty),
    lifeStealDivisor: difficultyLifeStealDivisor(this.difficulty),
    manaStealDivisor: difficultyManaStealDivisor(this.difficulty),
  }
}



function getPlayerAccruedMaxHpFixed(this: GameInstanceHost, player: InternalPlayerRecord): number {
  return Math.max(
    FIXED_ONE,
    Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('maxhp')),
  )
}



function getPlayerAccruedMaxManaFixed(this: GameInstanceHost, player: InternalPlayerRecord): number {
  return Math.max(
    0,
    Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('maxmana')),
  )
}



function getPlayerAccruedMaxStaminaFixed(this: GameInstanceHost, player: InternalPlayerRecord): number {
  return Math.max(
    FIXED_ONE,
    Math.trunc(this.playerCombatContext(player).statList.getAccruedStat('maxstamina')),
  )
}



function refreshPlayerAccruedMaxPools(this: GameInstanceHost, 
  player: InternalPlayerRecord,
  opts?: {
    readonly fillHpIfAtBaseMax?: boolean | undefined
    readonly fillManaIfAtBaseMax?: boolean | undefined
    readonly fillStaminaIfAtBaseMax?: boolean | undefined
  },
): void {
  const accruedMaxHpFixed = this.getPlayerAccruedMaxHpFixed(player)
  const accruedMaxManaFixed = this.getPlayerAccruedMaxManaFixed(player)
  const accruedMaxStaminaFixed = this.getPlayerAccruedMaxStaminaFixed(player)

  if (opts?.fillHpIfAtBaseMax) {
    player.hpFixed = accruedMaxHpFixed
  } else if (player.hpFixed > accruedMaxHpFixed) {
    player.hpFixed = accruedMaxHpFixed
  }
  if (opts?.fillManaIfAtBaseMax) {
    player.manaFixed = accruedMaxManaFixed
  } else if (player.manaFixed > accruedMaxManaFixed) {
    player.manaFixed = accruedMaxManaFixed
  }
  if (opts?.fillStaminaIfAtBaseMax) {
    player.staminaFixed = accruedMaxStaminaFixed
  } else if (player.staminaFixed > accruedMaxStaminaFixed) {
    player.staminaFixed = accruedMaxStaminaFixed
  }

  player.maxHp = Math.max(1, Math.floor(accruedMaxHpFixed / FIXED_ONE))
  player.hp = player.dead
    ? 0
    : Math.max(1, Math.min(player.maxHp, Math.floor(player.hpFixed / FIXED_ONE)))
  player.maxMana = Math.max(0, Math.floor(accruedMaxManaFixed / FIXED_ONE))
  player.mana = Math.max(0, Math.min(player.maxMana, Math.floor(player.manaFixed / FIXED_ONE)))
  player.maxStamina = Math.max(1, Math.floor(accruedMaxStaminaFixed / FIXED_ONE))
  player.stamina = player.staminaExhausted
    ? 0
    : Math.max(0, Math.min(player.maxStamina, Math.floor(player.staminaFixed / FIXED_ONE)))
}



/** Persistent combat context of a monster, re-synced from the authoritative record. */
function monsterCombatContext(this: GameInstanceHost, monster: InternalMonsterRecord): CombatUnitContext {
  let unit = this.monsterCombat.get(monster.unitId)
  if (unit === undefined) {
    const statList = new UnitStatList(this.registry, undefined, { ownerType: 'monster' })
    unit = { statList, stateBus: new StateBus(statList, this.registry) }
    this.monsterCombat.set(monster.unitId, unit)
  }
  const st = unit.statList
  st.setOwnerType('monster')
  st.setBaseStat('level', monster.level)
  st.setBaseStat('experience', monster.experience)
  st.setBaseStat('tohit', monster.ar)
  st.setBaseStat('armorclass', monster.ac)
  st.setBaseStat('toblock', monster.toBlock)
  st.setBaseStat('maxhp', monster.maxHp * FIXED_ONE)
  st.setHp256(monsterHp256_113c(monster))
  st.setBaseStat('damageresist', monster.resistances.phys)
  st.setBaseStat('magicresist', monster.resistances.magic)
  st.setBaseStat('fireresist', monster.resistances.fire)
  st.setBaseStat('lightresist', monster.resistances.light)
  st.setBaseStat('coldresist', monster.resistances.cold)
  st.setBaseStat('poisonresist', monster.resistances.poison)
  return {
    id: `monster_${monster.unitId}`,
    name: monster.name,
    unitType: 'monster',
    statList: st,
    stateBus: unit.stateBus,
    x: monster.x,
    y: monster.y,
    isUndead: monster.isUndead,
    isDemon: monster.isDemon,
    isBoss: monster.isBoss,
    isPrimeEvil: monster.isPrimeEvil,
    rank: monster.rank,
    isChampion: monster.rank === 'champion',
    isSuperUnique: monster.superUniqueId !== undefined,
    coldEffect: monster.coldEffect,
    drain: monster.drain,
  }
}



/** Persistent combat context of a mercenary, re-synced from the authoritative hireling record. */
function mercCombatContext(this: GameInstanceHost, merc: InternalMercenaryRecord): CombatUnitContext {
  let unit = this.mercCombat.get(merc.unitId)
  if (unit === undefined) {
    const statList = new UnitStatList(this.registry)
    unit = { statList, stateBus: new StateBus(statList, this.registry) }
    this.mercCombat.set(merc.unitId, unit)
  }
  const st = unit.statList
  st.setBaseStat('strength', (merc.strength ?? 0) + this.sumMercItemStat(merc, 0))
  st.setBaseStat('dexterity', (merc.dexterity ?? 0) + this.sumMercItemStat(merc, 2))
  st.setBaseStat('level', merc.level)
  st.setBaseStat('experience', merc.experience)
  st.setBaseStat('armorclass', merc.defense)
  st.setBaseStat('tohit', (merc.ar ?? 0) + this.sumMercItemStat(merc, 19))
  st.setBaseStat('secondary_mindamage', merc.minDmg ?? merc.damage)
  st.setBaseStat('secondary_maxdamage', merc.maxDmg ?? merc.damage)
  st.setBaseStat('maxhp', merc.maxHp256 ?? merc.maxHp * FIXED_ONE)
  st.setHp256(merc.hp256 ?? merc.hp * FIXED_ONE)
  st.setBaseStat('fireresist', merc.resist + this.sumMercItemStat(merc, 39))
  st.setBaseStat('lightresist', merc.resist + this.sumMercItemStat(merc, 41))
  st.setBaseStat('coldresist', merc.resist + this.sumMercItemStat(merc, 43))
  st.setBaseStat('poisonresist', merc.resist + this.sumMercItemStat(merc, 45))
  st.setBaseStat('damageresist', this.sumMercItemStat(merc, 36))
  st.setBaseStat('curse_resistance', this.sumMercItemStat(merc, 109))
  st.setBaseStat('item_cannotbefrozen', this.sumMercItemStat(merc, 153))
  st.setBaseStat('item_halffreezeduration', this.sumMercItemStat(merc, 118))

  // Sync `+allskills` (`stat 127`) and innate Act 2 hireling aura base skill level (`Hireling.txt`),
  // so item-granted `Meditation` (#120, `Insight`) / `Cleansing` (#109, `Cure`) on an Act 2 `Prayer` (#99)
  // mercenary evaluates `skill('Prayer'.edns)` (`blvl > 0`) for 1.13c "Double Prayer" heal synergy.
  let allSkillsBonus = 0
  for (const item of merc.equipment ?? []) {
    for (const stat of collectItemStats(item)) {
      if (stat.statId === STAT_ITEM_ALLSKILLS && stat.value > 0) {
        allSkillsBonus += stat.value
      }
    }
  }
  st.setBaseStat('item_allskills', allSkillsBonus)
  for (const innateId of [98, 99, 103, 104, 108, 114] as const) {
    st.setBaseSkillLevel(innateId, 0)
  }
  if (merc.activeAura) {
    const auraKey = merc.activeAura.trim().toLowerCase()
    const innateSkillId = MERC_AURA_TO_SKILL_ID[auraKey]
    if (innateSkillId !== undefined) {
      const hireStats = resolveHirelingStatsAtLevel(
        merc.subType,
        merc.act,
        merc.difficulty,
        merc.level,
        true,
      )
      const matchingSkill = hireStats?.skills.find(
        (s) =>
          s.skillId === innateSkillId ||
          MERC_AURA_TO_SKILL_ID[s.skillName.trim().toLowerCase()] === innateSkillId,
      )
      const baseSlvl = matchingSkill?.effectiveLevel ?? Math.max(1, Math.min(20, Math.floor(merc.level / 3)))
      st.setBaseSkillLevel(innateSkillId, Math.max(1, baseSlvl))
    }
  }

  return {
    id: `merc_${merc.unitId}`,
    name: merc.name,
    unitType: 'mercenary',
    statList: st,
    stateBus: unit.stateBus,
    x: merc.x,
    y: merc.y,
    resistPenalty: difficultyResistPenalty(this.difficulty),
  }
}



/**
 * Copy the persistent states (with their `aurastat` modifiers) of a unit onto a per-hit
 * `StateBus`, skipping states the hit already models, so buffs / curses / auras reach
 * `executeSUnitDmg`.
 */
function mirrorPersistentStates(this: GameInstanceHost, source: PersistentCombatUnit | undefined, target: StateBus): void {
  if (source === undefined) return
  for (const e of source.stateBus.getActiveEntries()) {
    if (target.hasState(e.stateId)) continue
    const remaining = e.expireFrame > 0 ? Math.max(1, e.expireFrame - this.currentFrame) : 0
    target.applyState({
      stateNameOrId: e.stateId,
      sourceUnitId: e.sourceUnitId,
      sourceSkillId: e.sourceSkillId,
      slvl: e.slvl,
      durationFrames: remaining,
      currentFrame: this.currentFrame,
      stats: e.stats,
      isAuraOverride: e.isAura,
    })
  }
}



/** `Skills.txt` `aurastat1..6` / `aurastatcalc1..6` evaluated at `slvl` (same rule as `AuraScanner`). */
function evaluateSkillStateStats(this: GameInstanceHost, skill: SkillRecord, slvl: number, statList: UnitStatList): Record<string, number> {
  const calcCtx = {
    registry: this.registry,
    activeSkill: skill,
    slvl,
    blvl: statList.getBaseSkillLevel(skill.id),
    getBaseSkillLevel: (id: number) => statList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => statList.getEffectiveSkillLevel(id),
    getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) =>
      statList.getAccruedStat(statNameOrId, baseOnly),
  }
  const stats: Record<string, number> = {}
  const pairs: [string, string][] = [
    [skill.auraStat1, skill.auraStatCalc1],
    [skill.auraStat2, skill.auraStatCalc2],
    [skill.auraStat3, skill.auraStatCalc3],
    [skill.auraStat4, skill.auraStatCalc4],
    [skill.auraStat5, skill.auraStatCalc5],
    [skill.auraStat6, skill.auraStatCalc6],
  ]
  for (const [name, calc] of pairs) {
    if (name && calc) stats[name.toLowerCase()] = evaluateCalc(calc, calcCtx)
  }
  // 1.13c `SKILLS_SrvSt36_HolyShield` (`0x6FCB6EC0`, #1800): `Skills.txt` #117 leaves `aurastat2` blank
  // and binds `STAT_MODIFIERLIST_SKILL (350) = 117` + `STAT_MODIFIERLIST_LEVEL (351) = slvl` in C++.
  if (skill.id === 117) {
    stats['modifierlist_skill'] = 117
    stats['modifierlist_level'] = slvl
  }
  // 1.13c `#267 Fade` (`Skills.txt` `aurastat5 = damageresist`, `aurastatcalc5 = lvl`, #1945):
  // Explicit `damageresist = slvl` (+1% physical DR per effective skill level at cast time).
  if (skill.id === 267) {
    stats['damageresist'] = slvl
  }
  return stats
}



/**
 * Server side effects of `AuraScanner` pulses: Sanctuary (#119, `SrvDo066` `0x6FCBAF50`) puts
 * `Overlay.txt` row 79 (`cast_undead`) on every pulsed Undead and knocks it back radially from the aura
 * source (`ResultFlags 0x08` -> `MONMODE_KNOCKBACK` 13, `0x6FCFD00E`), regardless of magic immunity;
 * monsters without `mKB` / `mGH` and bosses stay in place (#1807).
 */
function applyAuraPulseSideEffects113c(this: GameInstanceHost, 
  outcome: AuraPulseOutcome | readonly AuraPulseOutcome[],
  originX: number,
  originY: number,
  areaId: number,
): void {
  const list: readonly AuraPulseOutcome[] = Array.isArray(outcome)
    ? (outcome as readonly AuraPulseOutcome[])
    : [outcome as AuraPulseOutcome]
  for (const o of list) {
    for (const id of o.knockbackTargetIds ?? []) {
      const match = /^monster_(\d+)$/.exec(id)
      if (match === null) continue
      const m = this.monsters.get(Number(match[1]))
      if (m === undefined || m.dead || m.areaId !== areaId) continue
      this.broadcastToArea(m.areaId, {
        type: 'UnitOverlay',
        rawUnitType: 1,
        id: m.unitId,
        overlayIndex: 79,
      } as ServerEvent)
      if (!m.isBoss && !m.isPrimeEvil) this.knockbackMonster(m, originX, originY)
    }
  }
}



/** Collect active caster `aurastate` IDs owned by a player (selected skill aura + equipped `item_aura` gear). */
function getPlayerOwnCasterAuraStates113c(this: GameInstanceHost, playerUnitId: number): Set<number> {
  const out = new Set<number>()
  const selected = this.playerActiveAuraState.get(playerUnitId)
  if (selected !== undefined) out.add(selected)
  const itemRuntime = this.playerItemAuraScanners.get(playerUnitId)
  if (itemRuntime !== undefined) {
    for (const entry of itemRuntime.sources) {
      if (entry.casterStateId !== undefined) out.add(entry.casterStateId)
    }
  }
  return out
}



/** Collect active caster `aurastate` IDs owned by a mercenary (innate aura + equipped `item_aura` gear). */
function getMercOwnCasterAuraStates113c(this: GameInstanceHost, mercUnitId: number): Set<number> {
  const out = new Set<number>()
  const runtime = this.mercAuraScanners.get(mercUnitId)
  if (runtime !== undefined) {
    for (const entry of runtime.sources) {
      if (entry.casterStateId !== undefined) out.add(entry.casterStateId)
    }
  }
  return out
}



/** Expire persistent combat states and drop contexts of units that left / died. */
function stepPersistentCombatStates(this: GameInstanceHost): void {
  this.stepActiveWhirlwinds113c()
  for (const [id, unit] of this.playerCombat) {
    const p = this.players.get(id)
    if (p === undefined) {
      this.playerCombat.delete(id)
      continue
    }
    const had28 = unit.stateBus.hasState(28)
    const had44 = unit.stateBus.hasState(44)
    unit.stateBus.tick(this.currentFrame)
    const ownCasterStates = this.getPlayerOwnCasterAuraStates113c(id)
    for (const auraStateId of FRIENDLY_AURA_TARGET_STATE_IDS_113C) {
      if (ownCasterStates.has(auraStateId)) continue
      if (p.states.has(auraStateId) && !unit.stateBus.hasState(auraStateId)) {
        this.clearUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, auraStateId)
        if (auraStateId === 149) {
          this.refreshPlayerAccruedMaxPools(p)
        }
      }
    }
    for (const hostileAuraStateId of [28, 44] as const) {
      if (ownCasterStates.has(hostileAuraStateId)) continue
      const hadBeforeTick = hostileAuraStateId === 28 ? had28 : had44
      if (
        p.states.has(hostileAuraStateId) &&
        !unit.stateBus.hasState(hostileAuraStateId) &&
        (hadBeforeTick || !p.stateTimers.has(hostileAuraStateId))
      ) {
        this.clearUnitState(p.states, p.stateTimers, 'player', p.unitId, p.areaId, hostileAuraStateId)
      }
    }
  }
  for (const [id, unit] of this.mercCombat) {
    const merc = this.mercenaries.get(id)
    if (merc === undefined || !merc.alive || merc.hp <= 0) {
      this.mercCombat.delete(id)
      this.mercAuraScanners.delete(id)
      continue
    }
    const hadMerc28 = unit.stateBus.hasState(28)
    const hadMerc44 = unit.stateBus.hasState(44)
    unit.stateBus.tick(this.currentFrame)
    const ownMercCasterStates = this.getMercOwnCasterAuraStates113c(id)
    for (const auraStateId of FRIENDLY_AURA_TARGET_STATE_IDS_113C) {
      if (ownMercCasterStates.has(auraStateId)) continue
      if (merc.states.has(auraStateId) && !unit.stateBus.hasState(auraStateId)) {
        this.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, auraStateId)
      }
    }
    for (const hostileAuraStateId of [28, 44] as const) {
      if (ownMercCasterStates.has(hostileAuraStateId)) continue
      const hadBeforeTick = hostileAuraStateId === 28 ? hadMerc28 : hadMerc44
      if (
        merc.states.has(hostileAuraStateId) &&
        !unit.stateBus.hasState(hostileAuraStateId) &&
        (hadBeforeTick || !merc.stateTimers.has(hostileAuraStateId))
      ) {
        this.clearUnitState(merc.states, merc.stateTimers, 'monster', merc.unitId, merc.areaId, hostileAuraStateId)
      }
    }
  }
  for (const [petUnitId, vis] of this.petVisualStates) {
    if (vis.pet.alive === false || vis.pet.hp <= 0 || !this.petUnitIds.has(vis.pet.uid)) {
      this.petVisualStates.delete(petUnitId)
      this.petAuraScanners.delete(vis.pet.uid)
      continue
    }
    vis.pet.stateBus.tick(this.currentFrame)
    this.stepUnitStates(vis.states, vis.timers, 'monster', petUnitId, vis.areaId)
    const petRuntime = this.petAuraScanners.get(vis.pet.uid)
    const ownPetCasterStates = new Set<number>()
    if (petRuntime !== undefined) {
      for (const s of petRuntime.sources) {
        if (s.casterStateId !== undefined) ownPetCasterStates.add(s.casterStateId)
      }
    }
    for (const auraStateId of FRIENDLY_AURA_TARGET_STATE_IDS_113C) {
      if (ownPetCasterStates.has(auraStateId)) continue
      if (vis.states.has(auraStateId) && !vis.pet.stateBus.hasState(auraStateId)) {
        this.clearUnitState(vis.states, vis.timers, 'monster', petUnitId, vis.areaId, auraStateId)
      }
    }
  }
  for (const [id, unit] of this.monsterCombat) {
    const m = this.monsters.get(id)
    if (m === undefined || m.dead) {
      this.monsterCombat.delete(id)
      continue
    }
    unit.stateBus.tick(this.currentFrame)
    // #1334: Conversion is applied to the combat StateBus by Skills.txt
    // handlers. Mirror it onto the authoritative monster record so the AI can
    // switch alignment and the client sees state 53 (conversion aura).
    const conversion = unit.stateBus.getActiveEntries().find(e => e.stateId === 53)
    if (
      conversion !== undefined &&
      conversion.expireFrame > this.currentFrame &&
      this.isMonsterEligibleForConversion113c(m)
    ) {
      const expireFrame = conversion.expireFrame
      if (m.convertedUntilFrame <= this.currentFrame) {
        m.convertedUntilFrame = expireFrame
        const sourcePlayerId = Number.parseInt(conversion.sourceUnitId.replace(/^player_/, ''), 10)
        m.convertedByPlayerId = Number.isFinite(sourcePlayerId) ? sourcePlayerId : 0
        if (!m.states.has(53)) {
          this.applyUnitState(
            m.states,
            m.stateTimers,
            'monster',
            m.unitId,
            m.areaId,
            53,
            Math.max(1, expireFrame - this.currentFrame),
          )
        }
      } else {
        m.convertedUntilFrame = Math.max(m.convertedUntilFrame, expireFrame)
      }
    }
    const ownLeaderState =
      m.auraSkillId !== undefined ? PALADIN_AURA_STATE_BY_SKILL_ID[m.auraSkillId] : undefined
    // Mirror enemy & monster-leader aura stateBus states (#44 holywindcold, #107 shatter, #28 conviction,
    // #33 might, #40 blessedaim, #49 fanaticism) removal when expired
    for (const auraStateId of [44, 107, 28, 33, 40, 49] as const) {
      if (auraStateId === ownLeaderState) continue
      if (m.states.has(auraStateId) && !unit.stateBus.hasState(auraStateId)) {
        this.clearUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, auraStateId)
      }
    }
  }
  for (const m of this.monsters.values()) {
    if (m.convertedUntilFrame > 0 && (m.dead || this.currentFrame >= m.convertedUntilFrame)) {
      m.convertedUntilFrame = 0
      m.convertedByPlayerId = 0
      this.monsterCombat.get(m.unitId)?.stateBus.removeState(STATE_CONVERSION_113C)
      this.monsterCombat.get(m.unitId)?.stateBus.removeState(STATE_CONVERSION_SAVE_113C)
      if (m.states.has(STATE_CONVERSION_113C)) {
        this.clearUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, STATE_CONVERSION_113C)
      }
      if (m.states.has(STATE_CONVERSION_SAVE_113C)) {
        this.clearUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, STATE_CONVERSION_SAVE_113C)
      }
      if (!m.dead && m.conversionSavedStats !== undefined) {
        const restored = restoreConversionLevelScaling113c(m.conversionSavedStats, m.hp, m.maxHp)
        m.conversionSavedStats = undefined
        m.level = restored.restoredLevel
        m.maxHp = restored.restoredMaxHp
        m.hp = restored.restoredHp
        this.broadcastToArea(m.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: m.unitId,
          statId: 7,
          value: m.maxHp,
        })
        this.broadcastToArea(m.areaId, {
          type: 'UnitStatUpdate',
          unitType: 'monster',
          unitId: m.unitId,
          statId: 6,
          value: m.hp,
        })
      } else {
        m.conversionSavedStats = undefined
      }
    }
  }
  this.stepMonsterOpenWounds113c()
}



/** Whether a monster is currently converted (state 53) and fights for a player. */
function isMonsterConverted(this: GameInstanceHost, monster: InternalMonsterRecord): boolean {
  return monster.convertedUntilFrame > this.currentFrame
}



/**
 * Mirror enemy aura target states (#44 `holywindcold`, #107 `shatter`, #28 `conviction`) from
 * `enemyCtx.stateBus` onto the authoritative monster record (`m.states`, `m.stateTimers`, `m.chillTicks`),
 * broadcasting `UnitState` / `StateSet` only when newly applied or refreshed by a pulse.
 */
function syncAuraEnemyStates113c(this: GameInstanceHost, m: InternalMonsterRecord, enemyCtx: CombatUnitContext): void {
  for (const auraStateId of [44, 107, 28] as const) {
    const entry = enemyCtx.stateBus.getActiveEntries().find((e) => e.stateId === auraStateId)
    if (entry !== undefined) {
      const rem = entry.expireFrame > 0 ? Math.max(1, entry.expireFrame - this.currentFrame) : 25
      if (auraStateId === 44) {
        m.chillTicks = Math.max(m.chillTicks, rem)
      }
      const prevRem = m.stateTimers.get(auraStateId) ?? 0
      if (!m.states.has(auraStateId) || rem > prevRem) {
        this.applyUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, auraStateId, rem)
      } else if (entry.expireFrame > 0) {
        syncUnitStateTimerFromExpireFrame113c(m.stateTimers, auraStateId, rem, this.currentFrame)
      } else {
        m.stateTimers.set(auraStateId, rem)
      }
    } else if (m.states.has(auraStateId)) {
      this.clearUnitState(m.states, m.stateTimers, 'monster', m.unitId, m.areaId, auraStateId)
    }
  }
}



/**
 * Mirror canonical 1.13c friendly `auratargetstate` IDs (`FRIENDLY_AURA_TARGET_STATE_IDS_113C`:
 * Paladin friendly auras `3, 4, 5, 8, 33, 34, 36, 37, 40, 41, 42, 45, 48, 49` + Druid Spirit
 * Totem auras `147, 148, 149`) from `allyCtx.stateBus` onto a player, mercenary, or summon pet's
 * authoritative `states` / `stateTimers`, emitting `UnitState` / `StateSet` / `StateEnd` as needed.
 */
function syncAuraAllyStates113c(this: GameInstanceHost, 
  states: Set<number>,
  timers: Map<number, number>,
  unitType: 'player' | 'monster',
  unitId: number,
  areaId: number,
  allyCtx: CombatUnitContext,
  casterStateIdsToSkip?: ReadonlySet<number>,
  forceRefresh = false,
): void {
  for (const auraStateId of FRIENDLY_AURA_TARGET_STATE_IDS_113C) {
    if (casterStateIdsToSkip?.has(auraStateId)) continue
    const entry = allyCtx.stateBus
      .getActiveEntries()
      .find((e) => e.stateId === auraStateId && e.isAura && e.expireFrame > this.currentFrame)
    if (entry !== undefined) {
      const rem = Math.max(1, entry.expireFrame - this.currentFrame)
      const wasPresent = states.has(auraStateId)
      const prevRem = timers.get(auraStateId) ?? 0
      if (!wasPresent || rem > prevRem || forceRefresh) {
        this.applyUnitState(states, timers, unitType, unitId, areaId, auraStateId, rem)
        if ((!wasPresent || forceRefresh) && unitType === 'player' && auraStateId === 149) {
          const p = this.players.get(unitId)
          if (p !== undefined) this.refreshPlayerAccruedMaxPools(p)
        }
      } else {
        syncUnitStateTimerFromExpireFrame113c(timers, auraStateId, rem, this.currentFrame)
      }
    } else if (states.has(auraStateId)) {
      this.clearUnitState(states, timers, unitType, unitId, areaId, auraStateId)
      if (unitType === 'player' && auraStateId === 149) {
        const p = this.players.get(unitId)
        if (p !== undefined) this.refreshPlayerAccruedMaxPools(p)
      }
    }
  }
  // 1.13c `#109 Cleansing` (`state 45`, #1935): sync shortened `curable = 1` curse durations
  // and poison (`state 2`) duration from `allyCtx.stateBus` back onto `states` / `timers`.
  if (allyCtx.stateBus.hasState(45)) {
    const cleansingEntry = allyCtx.stateBus.getState(45)
    const cleansingSlvl = Math.max(1, cleansingEntry?.slvl ?? 1)
    const cleansingPct = Math.min(90, computeDiminishingReturns(30, 90, cleansingSlvl))
    for (const sid of [...states]) {
      const sRec = this.registry.getStateById(sid)
      if (sid === 2 || (sRec?.curse === true && sRec.curable === true)) {
        const sbEntry = allyCtx.stateBus.getActiveEntries().find((e) => e.stateId === sid)
        if (sbEntry !== undefined && sbEntry.expireFrame > this.currentFrame) {
          const rem = Math.max(1, sbEntry.expireFrame - this.currentFrame)
          if ((timers.get(sid) ?? 0) > rem) {
            syncUnitStateTimerFromExpireFrame113c(timers, sid, rem, this.currentFrame)
          }
        } else {
          const curRem = timers.get(sid) ?? 0
          const nextRem = Math.floor((curRem * (100 - cleansingPct)) / 100)
          if (nextRem <= 0) {
            this.clearUnitState(states, timers, unitType, unitId, areaId, sid)
          } else {
            timers.set(sid, nextRem)
          }
        }
      }
    }
  }
}



/** Ensure a summoned pet has an entry in `petVisualStates` and build its `CombatUnitContext`. */
function getOrCreatePetCombatContext113c(this: GameInstanceHost, 
  pet: SummonedPetUnit,
  petUnitId: number,
  areaId: number,
): {
  readonly ctx: CombatUnitContext
  readonly states: Set<number>
  readonly timers: Map<number, number>
} {
  let vis = this.petVisualStates.get(petUnitId)
  if (vis === undefined || vis.pet !== pet) {
    vis = {
      states: new Set<number>(),
      timers: new Map<number, number>(),
      areaId,
      pet,
    }
    this.petVisualStates.set(petUnitId, vis)
  } else {
    vis.areaId = areaId
  }
  pet.statList.setBaseStat('maxhp', Math.max(1, pet.maxHp) * FIXED_ONE)
  pet.statList.setHp256(Math.max(0, pet.hp) * FIXED_ONE)
  const ctx: CombatUnitContext = {
    id: `pet_${petUnitId}`,
    name: pet.name,
    unitType: 'minion',
    petType: pet.petType,
    statList: pet.statList,
    stateBus: pet.stateBus,
    x: pet.x,
    y: pet.y,
    resistPenalty: difficultyResistPenalty(this.difficulty),
  }
  return { ctx, states: vis.states, timers: vis.timers }
}



/**
 * Gather all 1.13c allied units (`0x6FD00570`: same owner or partied players, their alive mercenaries,
 * and their active summoned pets) in `areaId` within `maxRadius` of `(originX, originY)`.
 */
function collectFriendlyAuraAllies113c(this: GameInstanceHost, opts: {
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly originX: number
  readonly originY: number
  readonly maxRadius: number
  readonly selfPlayerCtx?: CombatUnitContext | undefined
  readonly selfMerc?: InternalMercenaryRecord | undefined
  readonly selfPet?: SummonedPetUnit | undefined
}): {
  readonly allyPlayers: { readonly record: InternalPlayerRecord; readonly ctx: CombatUnitContext }[]
  readonly allyMercs: { readonly record: InternalMercenaryRecord; readonly ctx: CombatUnitContext }[]
  readonly allyPets: {
    readonly pet: SummonedPetUnit
    readonly unitId: number
    readonly ctx: CombatUnitContext
    readonly states: Set<number>
    readonly timers: Map<number, number>
  }[]
  readonly allAllies: CombatUnitContext[]
} {
  const inRange = (x: number, y: number) =>
    isWithinAuraRange(x - opts.originX, y - opts.originY, opts.maxRadius)
  const allyPlayers: { readonly record: InternalPlayerRecord; readonly ctx: CombatUnitContext }[] = []
  for (const p of this.players.values()) {
    if (p.dead || p.areaId !== opts.areaId) continue
    if (!this.partyManager.areAllied(opts.ownerPlayerId, p.unitId)) continue
    const isSelfPlayer = opts.selfPlayerCtx !== undefined && p.unitId === opts.ownerPlayerId
    if (!isSelfPlayer && !inRange(p.x, p.y)) continue
    const ctx = isSelfPlayer ? opts.selfPlayerCtx! : this.playerCombatContext(p)
    allyPlayers.push({ record: p, ctx })
  }

  const allyMercs: { readonly record: InternalMercenaryRecord; readonly ctx: CombatUnitContext }[] = []
  for (const m of this.mercenaries.values()) {
    if (!m.alive || m.hp <= 0 || m.areaId !== opts.areaId) continue
    if (!this.partyManager.areAllied(opts.ownerPlayerId, m.ownerPlayerId)) continue
    const isSelfMerc = opts.selfMerc !== undefined && m === opts.selfMerc
    if (!isSelfMerc && !inRange(m.x, m.y)) continue
    allyMercs.push({ record: m, ctx: this.mercCombatContext(m) })
  }

  const allyPets: {
    readonly pet: SummonedPetUnit
    readonly unitId: number
    readonly ctx: CombatUnitContext
    readonly states: Set<number>
    readonly timers: Map<number, number>
  }[] = []
  for (const [petOwnerId, mgr] of this.summonManagers.entries()) {
    if (!this.partyManager.areAllied(opts.ownerPlayerId, petOwnerId)) continue
    const petOwner = this.players.get(petOwnerId)
    if (!petOwner || petOwner.dead || petOwner.areaId !== opts.areaId) continue
    for (const pet of mgr.getActivePets()) {
      if (pet.alive === false || pet.hp <= 0) continue
      // Stationary traps / hydras are excluded from friendly party buffs when not selectable minions,
      // except the caster spirit totem itself.
      if (pet.petType === 'assassintrap' || pet.petType === 'hydra') continue
      const petUnitId =
        this.petUnitIds.get(pet.uid) ??
        (pet as unknown as { unitId?: number }).unitId
      if (petUnitId === undefined) continue
      const isSelfPet = opts.selfPet !== undefined && pet === opts.selfPet
      if (!isSelfPet && !inRange(pet.x, pet.y)) continue
      const built = this.getOrCreatePetCombatContext113c(pet, petUnitId, opts.areaId)
      allyPets.push({ pet, unitId: petUnitId, ...built })
    }
  }

  return {
    allyPlayers,
    allyMercs,
    allyPets,
    allAllies: [
      ...allyPlayers.map((e) => e.ctx),
      ...allyMercs.map((e) => e.ctx),
      ...allyPets.map((e) => e.ctx),
    ],
  }
}



/** Sync vitals and `FRIENDLY_AURA_TARGET_STATE_IDS_113C` back to all gathered allied units after an aura pulse. */
function syncFriendlyAuraTargets113c(this: GameInstanceHost, 
  targets: FriendlyAuraAlliesResult113c,
  areaId: number,
  opts?: {
    readonly skipSelfPlayerId?: number | undefined
    readonly selfPlayerCasterStates?: ReadonlySet<number> | undefined
    readonly skipSelfMercId?: number | undefined
    readonly selfMercCasterStates?: ReadonlySet<number> | undefined
    readonly skipSelfPetUnitId?: number | undefined
    readonly selfPetCasterStates?: ReadonlySet<number> | undefined
    readonly forceRefresh?: boolean | undefined
  },
): void {
  for (const { record: p, ctx } of targets.allyPlayers) {
    this.syncPlayerVitalsFromCombat(p, ctx)
    const skip =
      opts?.skipSelfPlayerId === p.unitId
        ? opts.selfPlayerCasterStates
        : this.getPlayerOwnCasterAuraStates113c(p.unitId)
    this.syncAuraAllyStates113c(
      p.states,
      p.stateTimers,
      'player',
      p.unitId,
      p.areaId,
      ctx,
      skip,
      Boolean(opts?.forceRefresh),
    )
  }
  for (const { record: m, ctx } of targets.allyMercs) {
    const hpAfter = Math.min(m.maxHp, Math.max(0, Math.ceil(ctx.statList.getHp256() / FIXED_ONE)))
    if (hpAfter !== m.hp && m.alive) {
      m.hp = hpAfter
      this.broadcastAllyHp(m.areaId, m.unitId, m.hp)
    }
    const skip =
      opts?.skipSelfMercId === m.unitId
        ? opts.selfMercCasterStates
        : this.getMercOwnCasterAuraStates113c(m.unitId)
    this.syncAuraAllyStates113c(
      m.states,
      m.stateTimers,
      'monster',
      m.unitId,
      m.areaId,
      ctx,
      skip,
      Boolean(opts?.forceRefresh),
    )
  }
  for (const { pet, unitId, ctx, states, timers } of targets.allyPets) {
    const hpAfter = Math.min(pet.maxHp, Math.max(0, Math.ceil(ctx.statList.getHp256() / FIXED_ONE)))
    if (hpAfter !== pet.hp && pet.alive !== false) {
      pet.hp = hpAfter
      this.broadcastAllyHp(areaId, unitId, pet.hp)
    }
    const skip = opts?.skipSelfPetUnitId === unitId ? opts.selfPetCasterStates : undefined
    this.syncAuraAllyStates113c(
      states,
      timers,
      'monster',
      unitId,
      areaId,
      ctx,
      skip,
      Boolean(opts?.forceRefresh),
    )
  }
}



/** Resolve all `STAT_ITEM_AURA` (`statId === 151`) sources on a player's active equipped gear (`bodyLoc` 1..10). */
function resolvePlayerItemAuraSources113c(this: GameInstanceHost, player: InternalPlayerRecord): {
  readonly skillId: number
  readonly slvl: number
  readonly isItemAura: boolean
  readonly radiusSubtiles: number
  readonly casterStateId: number | undefined
  readonly targetStateId: number | undefined
}[] {
  const itemAurasBySkill = new Map<number, number>()
  for (const stat of collectEquippedItemStats(player.items)) {
    if (stat.statId === 151 && stat.param > 0 && stat.value > 0) {
      itemAurasBySkill.set(stat.param, (itemAurasBySkill.get(stat.param) ?? 0) + stat.value)
    }
  }
  if (itemAurasBySkill.size === 0) return []
  const out: {
    readonly skillId: number
    readonly slvl: number
    readonly isItemAura: boolean
    readonly radiusSubtiles: number
    readonly casterStateId: number | undefined
    readonly targetStateId: number | undefined
  }[] = []
  for (const [skillId, rawSlvl] of itemAurasBySkill) {
    const skill = this.registry.getSkillById(skillId)
    if (!skill || !skill.aura || !skill.auraState || skill.passive) continue
    const slvl = Math.max(1, rawSlvl)
    const casterStateId = skill.auraState ? this.registry.getStateByName(skill.auraState)?.id : undefined
    const targetStateId = skill.auraTgtState ? this.registry.getStateByName(skill.auraTgtState)?.id : undefined
    out.push({
      skillId,
      slvl,
      isItemAura: true,
      radiusSubtiles: this.auraRangeSubtiles(skillId, slvl),
      casterStateId,
      targetStateId,
    })
  }
  return out
}



/** Synchronize a player's `STAT_ITEM_AURA` (`151`) scanner on connect / equip / unequip / weapon swap. */
function syncPlayerItemAuras113c(this: GameInstanceHost, player: InternalPlayerRecord, forcePulse = false): void {
  if (player.dead) {
    const prev = this.playerItemAuraScanners.get(player.unitId)
    if (prev !== undefined) {
      this.playerItemAuraScanners.delete(player.unitId)
      const selectedState = this.playerActiveAuraState.get(player.unitId)
      for (const entry of prev.sources) {
        if (entry.casterStateId !== undefined && entry.casterStateId !== selectedState) {
          this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, entry.casterStateId)
          this.playerCombat.get(player.unitId)?.stateBus.removeState(entry.casterStateId)
        }
      }
    }
    return
  }
  const desiredSpecs = this.resolvePlayerItemAuraSources113c(player)
  if (desiredSpecs.length === 0) {
    const prev = this.playerItemAuraScanners.get(player.unitId)
    if (prev !== undefined) {
      this.playerItemAuraScanners.delete(player.unitId)
      const selectedState = this.playerActiveAuraState.get(player.unitId)
      for (const entry of prev.sources) {
        if (entry.casterStateId !== undefined && entry.casterStateId !== selectedState) {
          this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, entry.casterStateId)
          this.playerCombat.get(player.unitId)?.stateBus.removeState(entry.casterStateId)
        }
      }
    }
    return
  }

  const signature = desiredSpecs.map((s) => `${s.skillId}:${s.slvl}`).join(',')
  let runtime = this.playerItemAuraScanners.get(player.unitId)
  let signatureChanged = false
  if (runtime === undefined || runtime.signature !== signature) {
    signatureChanged = true
    const nextCasterIds = new Set<number>()
    const selectedState = this.playerActiveAuraState.get(player.unitId)
    if (selectedState !== undefined) nextCasterIds.add(selectedState)
    for (const spec of desiredSpecs) {
      if (spec.casterStateId !== undefined) nextCasterIds.add(spec.casterStateId)
    }
    if (runtime !== undefined) {
      for (const prev of runtime.sources) {
        if (prev.casterStateId !== undefined && !nextCasterIds.has(prev.casterStateId)) {
          this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, prev.casterStateId)
          this.playerCombat.get(player.unitId)?.stateBus.removeState(prev.casterStateId)
        }
      }
    }
    const scanner = new AuraScanner(this.registry, ((this.currentMapSeed ^ player.unitId ^ 0x9e3779b9) >>> 0))
    const ownerCtx = this.playerCombatContext(player)
    // Item-granted auras (`STAT_ITEM_AURA` 151) never consume player mana (`SKILLS_SrvDo065` item aura path):
    // mark the scanner source context as item-driven via `petType = 'item_aura'` while keeping `ownerCtx` statList/stateBus!
    const itemCasterCtx: CombatUnitContext = { ...ownerCtx, petType: 'item_aura' }
    const sources: MercAuraSourceEntry[] = []
    const pulseTick = Math.max(1, this.currentFrame)
    for (const spec of desiredSpecs) {
      const source = scanner.setActiveAura(itemCasterCtx, spec.skillId, spec.slvl, pulseTick)
      if (source === null) continue
      sources.push({ ...spec, source })
    }
    runtime = {
      scanner,
      signature,
      sources,
      needsInitialPulse: true,
    }
    this.playerItemAuraScanners.set(player.unitId, runtime)
  }

  if (forcePulse || signatureChanged) {
    runtime.needsInitialPulse = true
    this.pulsePlayerItemAuraRuntime113c(player, runtime, signatureChanged)
  }
}



/** Pulse a player's equipped `STAT_ITEM_AURA` (`151`) scanner across self, party allies, mercs, pets, and hostiles. */
function pulsePlayerItemAuraRuntime113c(this: GameInstanceHost, 
  owner: InternalPlayerRecord,
  runtime: MercAuraRuntime,
  forceRefresh = false,
): void {
  if (runtime.sources.length === 0 || owner.dead) return
  runtime.scanner.syncCasterPosition(owner.x, owner.y)
  const maxRadius = runtime.sources.reduce((acc, s) => Math.max(acc, s.radiusSubtiles), 0)
  const inRange = (x: number, y: number) => isWithinAuraRange(x - owner.x, y - owner.y, maxRadius)
  const ownerCtx = this.playerCombatContext(owner)
  const targets = this.collectFriendlyAuraAllies113c({
    ownerPlayerId: owner.unitId,
    areaId: owner.areaId,
    originX: owner.x,
    originY: owner.y,
    maxRadius,
    selfPlayerCtx: ownerCtx,
  })
  const enemyRecords = [...this.monsters.values()].filter(
    (m) =>
      !m.dead &&
      !m.isNpc &&
      m.isKillable &&
      m.align === 0 &&
      !this.isMonsterConverted(m) &&
      m.areaId === owner.areaId &&
      inRange(m.x, m.y),
  )
  const corpseRecords = [...this.monsters.values()].filter(
    (m) => this.canSelectMonsterCorpse113c(m, false) && m.areaId === owner.areaId && inRange(m.x, m.y),
  )
  const enemies = enemyRecords.map((m) => this.monsterCombatContext(m))
  const pvpAuraEnemies = this.buildHostileAuraPvpEnemies113c(owner.unitId, owner.areaId, inRange)
  const allAuraEnemies = [...enemies, ...pvpAuraEnemies.map((e) => e.ctx)]
  const corpses: CorpseContext[] = corpseRecords.map((m) => ({
    id: String(m.unitId),
    consumed: false,
    x: m.x,
    y: m.y,
  }))
  const auraEnv = {
    isTown: TOWN_AREAS.has(owner.areaId),
    hasLineOfSight: (src: CombatUnitContext, tgt: { x?: number; y?: number }) =>
      src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
        ? false
        : this.isMonsterStepWalkable(owner.areaId, src.x, src.y, tgt.x, tgt.y, true),
    rng: this.rng,
  }
  const pulseTick = Math.max(1, this.currentFrame)
  if (runtime.needsInitialPulse) {
    runtime.needsInitialPulse = false
    for (const entry of runtime.sources) {
      this.applyAuraPulseSideEffects113c(runtime.scanner.pulseAura(entry.source, pulseTick, targets.allAllies, allAuraEnemies, corpses, auraEnv), owner.x, owner.y, owner.areaId)
    }
    for (const entry of runtime.sources) {
      if (entry.casterStateId !== undefined) {
        this.applyPersistentUnitState(
          owner.states,
          owner.stateTimers,
          'player',
          owner.unitId,
          owner.areaId,
          entry.casterStateId,
        )
      }
    }
  } else {
    this.applyAuraPulseSideEffects113c(runtime.scanner.tick(this.currentFrame, targets.allAllies, allAuraEnemies, corpses, auraEnv), owner.x, owner.y, owner.areaId)
    for (const entry of runtime.sources) {
      if (entry.casterStateId !== undefined && !owner.states.has(entry.casterStateId)) {
        this.applyPersistentUnitState(
          owner.states,
          owner.stateTimers,
          'player',
          owner.unitId,
          owner.areaId,
          entry.casterStateId,
        )
      }
      if (entry.targetStateId === undefined) continue
      const tgtState = entry.targetStateId
      if (entry.skillId === 114 || entry.skillId === 123) {
        const unpulsedMonsters = enemies.filter((e, idx) => {
          const m = enemyRecords[idx]!
          if (!isWithinAuraRange(m.x - owner.x, m.y - owner.y, entry.radiusSubtiles)) return false
          if (m.isPrimeEvil || (entry.skillId === 114 && m.coldEffect === 0)) return false
          if (auraEnv.isTown) return false
          return !e.stateBus.hasState(tgtState)
        })
        const unpulsedPvp = pvpAuraEnemies
          .filter((item) => {
            if (auraEnv.isTown || item.ctx.x === undefined || item.ctx.y === undefined) return false
            if (!isWithinAuraRange(item.ctx.x - owner.x, item.ctx.y - owner.y, entry.radiusSubtiles)) return false
            return !item.ctx.stateBus.hasState(tgtState)
          })
          .map((item) => item.ctx)
        const unpulsedEnemies = [...unpulsedMonsters, ...unpulsedPvp]
        if (unpulsedEnemies.length > 0) {
          this.applyAuraPulseSideEffects113c(runtime.scanner.pulseAura(entry.source, pulseTick, [], unpulsedEnemies, [], auraEnv), owner.x, owner.y, owner.areaId)
        }
      } else {
        const unpulsedAllies = targets.allAllies.filter((a) => {
          if (a.id === ownerCtx.id || a.x === undefined || a.y === undefined) return false
          if (!isWithinAuraRange(a.x - owner.x, a.y - owner.y, entry.radiusSubtiles)) return false
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

  const ownCasterStates = this.getPlayerOwnCasterAuraStates113c(owner.unitId)
  this.syncFriendlyAuraTargets113c(targets, owner.areaId, {
    skipSelfPlayerId: owner.unitId,
    selfPlayerCasterStates: ownCasterStates,
    forceRefresh,
  })
  enemyRecords.forEach((m, i) => {
    this.syncAuraEnemyStates113c(m, enemies[i]!)
    const hpAfter = Math.max(0, Math.ceil(enemies[i]!.statList.getHp256() / FIXED_ONE))
    const dealt = m.hp - hpAfter
    if (dealt > 0) {
      const dmgSkillId =
        runtime.sources.find(
          (s) => s.skillId === 114 || s.skillId === 102 || s.skillId === 118 || s.skillId === 119,
        )?.skillId ??
        runtime.sources[0]?.skillId ??
        0
      this.finishMonsterDamage(owner, m, dealt, dmgSkillId, this.resolveSkillDamageChannel(dmgSkillId))
    }
  })
  this.syncHostileAuraPvpEnemies113c(pvpAuraEnemies, 'player', owner.unitId)
  corpseRecords.forEach((m, i) => {
    if (corpses[i]!.consumed) this.consumeMonsterCorpse113c(m, 104)
  })
}



/**
 * Run every player's selected aura (and any equipped `STAT_ITEM_AURA` `151` item auras) through
 * its `AuraScanner` (`perdelay` pulses): friendly stat auras on same-area allied players,
 * mercenaries, and summoned pets in range, Prayer / Meditation / Cleansing heals, Redemption
 * corpses, and Conviction / Holy Freeze / Holy Fire / Holy Shock / Sanctuary on hostiles in range.
 */
function stepPlayerAuras(this: GameInstanceHost): void {
  for (const [ownerId, aura] of this.playerAuraScanners) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead) continue
    aura.scanner.syncCasterPosition(owner.x, owner.y)
    const inRange = (x: number, y: number) => isWithinAuraRange(x - owner.x, y - owner.y, aura.radiusSubtiles)
    const ownerCtx = this.playerCombatContext(owner)
    const targets = this.collectFriendlyAuraAllies113c({
      ownerPlayerId: owner.unitId,
      areaId: owner.areaId,
      originX: owner.x,
      originY: owner.y,
      maxRadius: aura.radiusSubtiles,
      selfPlayerCtx: ownerCtx,
    })
    const enemyRecords = [...this.monsters.values()].filter(
      (m) => !m.dead && !m.isNpc && m.isKillable && m.align === 0 && !this.isMonsterConverted(m) && m.areaId === owner.areaId && inRange(m.x, m.y),
    )
    const corpseRecords = [...this.monsters.values()].filter(
      (m) => this.canSelectMonsterCorpse113c(m, false) && m.areaId === owner.areaId && inRange(m.x, m.y),
    )
    const enemies = enemyRecords.map((m) => this.monsterCombatContext(m))
    const pvpAuraEnemies = this.buildHostileAuraPvpEnemies113c(owner.unitId, owner.areaId, inRange)
    const allAuraEnemies = [...enemies, ...pvpAuraEnemies.map((e) => e.ctx)]
    const corpses: CorpseContext[] = corpseRecords.map((m) => ({ id: String(m.unitId), consumed: false, x: m.x, y: m.y }))
    const auraEnv = {
      isTown: TOWN_AREAS.has(owner.areaId),
      // aurafilter `0x200` (D2Common ord 11076, collision mask 4): wall/door ray like a flying walker.
      hasLineOfSight: (src: CombatUnitContext, tgt: { x?: number; y?: number }) =>
        src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined
          ? false
          : this.isMonsterStepWalkable(owner.areaId, src.x, src.y, tgt.x, tgt.y, true),
      rng: this.rng,
    }
    this.applyAuraPulseSideEffects113c(aura.scanner.tick(this.currentFrame, targets.allAllies, allAuraEnemies, corpses, auraEnv), owner.x, owner.y, owner.areaId)
    const pulseTick = Math.max(1, this.currentFrame)
    // If a hostile monster or allied unit newly entered range between `perdelay` ticks,
    // pulse that unpulsed target immediately so it does not wait up to 49 frames.
    if (aura.source !== undefined && aura.targetStateId !== undefined) {
      const tgtState = aura.targetStateId
      if (aura.skillId === 114 || aura.skillId === 123) {
        const unpulsedMonsters = enemies.filter((e, idx) => {
          const m = enemyRecords[idx]!
          if (m.isPrimeEvil || (aura.skillId === 114 && m.coldEffect === 0)) return false
          if (auraEnv.isTown) return false
          return !e.stateBus.hasState(tgtState)
        })
        const unpulsedPvp = pvpAuraEnemies
          .filter((item) => {
            if (auraEnv.isTown) return false
            return !item.ctx.stateBus.hasState(tgtState)
          })
          .map((item) => item.ctx)
        const unpulsedEnemies = [...unpulsedMonsters, ...unpulsedPvp]
        if (unpulsedEnemies.length > 0) {
          this.applyAuraPulseSideEffects113c(aura.scanner.pulseAura(aura.source, pulseTick, [], unpulsedEnemies, [], auraEnv), owner.x, owner.y, owner.areaId)
        }
      } else if (FRIENDLY_AURA_TARGET_STATE_IDS_113C.has(tgtState)) {
        const unpulsedAllies = targets.allAllies.filter((a) => {
          if (a.id === ownerCtx.id || a.x === undefined || a.y === undefined) return false
          if (!inRange(a.x, a.y) || a.stateBus.hasState(tgtState)) return false
          return passesAuraFilter(aura.source!.skill.auraFilter, {
            kind: a.unitType === 'player' ? 'player' : 'monster',
            relation: 'ally',
            dead: a.statList.getHp256() <= 0,
            inTown: auraEnv.isTown,
          })
        })
        if (unpulsedAllies.length > 0) {
          aura.scanner.pulseAura(aura.source, pulseTick, unpulsedAllies, [], [], auraEnv)
        }
      }
    }

    const ownCasterStates = this.getPlayerOwnCasterAuraStates113c(owner.unitId)
    this.syncFriendlyAuraTargets113c(targets, owner.areaId, {
      skipSelfPlayerId: owner.unitId,
      selfPlayerCasterStates: ownCasterStates,
    })
    enemyRecords.forEach((m, i) => {
      // Mirror Holy Freeze (#114) / Conviction (#123) stateBus states before radial damage
      // so that a monster killed on a 20% shatter pulse already carries state #107 on death.
      this.syncAuraEnemyStates113c(m, enemies[i]!)
      const hpAfter = Math.max(0, Math.ceil(enemies[i]!.statList.getHp256() / FIXED_ONE))
      const dealt = m.hp - hpAfter
      if (dealt > 0) {
        this.finishMonsterDamage(owner, m, dealt, aura.skillId, this.resolveSkillDamageChannel(aura.skillId))
      }
    })
    this.syncHostileAuraPvpEnemies113c(pvpAuraEnemies, 'player', owner.unitId)
    corpseRecords.forEach((m, i) => {
      if (corpses[i]!.consumed) this.consumeMonsterCorpse113c(m, 104)
    })
  }

  for (const [ownerId, itemRuntime] of this.playerItemAuraScanners) {
    const owner = this.players.get(ownerId)
    if (owner === undefined || owner.dead) continue
    this.pulsePlayerItemAuraRuntime113c(owner, itemRuntime, false)
  }
}



/** Write HP / mana / `nomanaregen` (state 85) changed by an aura pulse back to the player record (+ client stat updates). */
function syncPlayerVitalsFromCombat(this: GameInstanceHost, player: InternalPlayerRecord, ctx: CombatUnitContext): void {
  const rawHp256 = ctx.statList.getHp256()
  const rawMana256 = ctx.statList.getMana256()
  const accruedMaxHpFixed = Math.max(FIXED_ONE, Math.trunc(ctx.statList.getAccruedStat('maxhp')))
  const accruedMaxManaFixed = Math.max(0, Math.trunc(ctx.statList.getAccruedStat('maxmana')))
  const hp256 = Math.min(accruedMaxHpFixed, Math.max(0, rawHp256))
  const mana256 = Math.min(accruedMaxManaFixed, Math.max(0, rawMana256))
  if (hp256 !== player.hpFixed) {
    player.hpFixed = hp256
    player.hp = Math.max(0, Math.ceil(hp256 / FIXED_ONE))
    this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 6, value: player.hpFixed })
  }
  if (mana256 !== player.manaFixed) {
    player.manaFixed = mana256
    const mana = Math.floor(mana256 / FIXED_ONE)
    if (mana !== player.mana) {
      player.mana = mana
      this.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 8, value: player.manaFixed })
    }
  }
  if (ctx.stateBus.hasState('nomanaregen')) {
    player.states.add(85)
  } else {
    player.states.delete(85)
  }
}



/** Deselect the player's aura: stop its pulses and remove the caster aura state (unless granted by equipped `item_aura`). */
function stopPlayerAura(this: GameInstanceHost, player: InternalPlayerRecord): void {
  this.playerAuraScanners.delete(player.unitId)
  player.states.delete(85)
  this.playerCombat.get(player.unitId)?.stateBus.removeState('nomanaregen')
  const stateId = this.playerActiveAuraState.get(player.unitId)
  if (stateId !== undefined) {
    this.playerActiveAuraState.delete(player.unitId)
    const stillGrantedByItem = this.playerItemAuraScanners
      .get(player.unitId)
      ?.sources.some((s) => s.casterStateId === stateId)
    if (!stillGrantedByItem) {
      this.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, stateId)
      this.playerCombat.get(player.unitId)?.stateBus.removeState(stateId)
    }
  }
}

export interface PlayerAurasAndStatesMethods {
  playerCombatContext(player: InternalPlayerRecord): CombatUnitContext
  getPlayerAccruedMaxHpFixed(player: InternalPlayerRecord): number
  getPlayerAccruedMaxManaFixed(player: InternalPlayerRecord): number
  getPlayerAccruedMaxStaminaFixed(player: InternalPlayerRecord): number
  refreshPlayerAccruedMaxPools(player: InternalPlayerRecord, opts?: {
    readonly fillHpIfAtBaseMax?: boolean | undefined
    readonly fillManaIfAtBaseMax?: boolean | undefined
    readonly fillStaminaIfAtBaseMax?: boolean | undefined
  }): void
  monsterCombatContext(monster: InternalMonsterRecord): CombatUnitContext
  mercCombatContext(merc: InternalMercenaryRecord): CombatUnitContext
  mirrorPersistentStates(source: PersistentCombatUnit | undefined, target: StateBus): void
  evaluateSkillStateStats(skill: SkillRecord, slvl: number, statList: UnitStatList): Record<string, number>
  applyAuraPulseSideEffects113c(outcome: AuraPulseOutcome | readonly AuraPulseOutcome[], originX: number, originY: number, areaId: number): void
  getPlayerOwnCasterAuraStates113c(playerUnitId: number): Set<number>
  getMercOwnCasterAuraStates113c(mercUnitId: number): Set<number>
  stepPersistentCombatStates(): void
  isMonsterConverted(monster: InternalMonsterRecord): boolean
  syncAuraEnemyStates113c(m: InternalMonsterRecord, enemyCtx: CombatUnitContext): void
  syncAuraAllyStates113c(states: Set<number>, timers: Map<number, number>, unitType: 'player' | 'monster', unitId: number, areaId: number, allyCtx: CombatUnitContext, casterStateIdsToSkip?: ReadonlySet<number>, forceRefresh?: boolean | undefined): void
  getOrCreatePetCombatContext113c(pet: SummonedPetUnit, petUnitId: number, areaId: number): {
  readonly ctx: CombatUnitContext
  readonly states: Set<number>
  readonly timers: Map<number, number>
}
  collectFriendlyAuraAllies113c(opts: {
  readonly ownerPlayerId: number
  readonly areaId: number
  readonly originX: number
  readonly originY: number
  readonly maxRadius: number
  readonly selfPlayerCtx?: CombatUnitContext | undefined
  readonly selfMerc?: InternalMercenaryRecord | undefined
  readonly selfPet?: SummonedPetUnit | undefined
}): {
  readonly allyPlayers: { readonly record: InternalPlayerRecord; readonly ctx: CombatUnitContext }[]
  readonly allyMercs: { readonly record: InternalMercenaryRecord; readonly ctx: CombatUnitContext }[]
  readonly allyPets: {
    readonly pet: SummonedPetUnit
    readonly unitId: number
    readonly ctx: CombatUnitContext
    readonly states: Set<number>
    readonly timers: Map<number, number>
  }[]
  readonly allAllies: CombatUnitContext[]
}
  syncFriendlyAuraTargets113c(targets: FriendlyAuraAlliesResult113c, areaId: number, opts?: {
    readonly skipSelfPlayerId?: number | undefined
    readonly selfPlayerCasterStates?: ReadonlySet<number> | undefined
    readonly skipSelfMercId?: number | undefined
    readonly selfMercCasterStates?: ReadonlySet<number> | undefined
    readonly skipSelfPetUnitId?: number | undefined
    readonly selfPetCasterStates?: ReadonlySet<number> | undefined
    readonly forceRefresh?: boolean | undefined
  }): void
  resolvePlayerItemAuraSources113c(player: InternalPlayerRecord): {
  readonly skillId: number
  readonly slvl: number
  readonly isItemAura: boolean
  readonly radiusSubtiles: number
  readonly casterStateId: number | undefined
  readonly targetStateId: number | undefined
}[]
  syncPlayerItemAuras113c(player: InternalPlayerRecord, forcePulse?: boolean | undefined): void
  pulsePlayerItemAuraRuntime113c(owner: InternalPlayerRecord, runtime: MercAuraRuntime, forceRefresh?: boolean | undefined): void
  stepPlayerAuras(): void
  syncPlayerVitalsFromCombat(player: InternalPlayerRecord, ctx: CombatUnitContext): void
  stopPlayerAura(player: InternalPlayerRecord): void
}

export const playerAurasAndStatesMethods: Record<keyof PlayerAurasAndStatesMethods, unknown> = {
  playerCombatContext,
  getPlayerAccruedMaxHpFixed,
  getPlayerAccruedMaxManaFixed,
  getPlayerAccruedMaxStaminaFixed,
  refreshPlayerAccruedMaxPools,
  monsterCombatContext,
  mercCombatContext,
  mirrorPersistentStates,
  evaluateSkillStateStats,
  applyAuraPulseSideEffects113c,
  getPlayerOwnCasterAuraStates113c,
  getMercOwnCasterAuraStates113c,
  stepPersistentCombatStates,
  isMonsterConverted,
  syncAuraEnemyStates113c,
  syncAuraAllyStates113c,
  getOrCreatePetCombatContext113c,
  collectFriendlyAuraAllies113c,
  syncFriendlyAuraTargets113c,
  resolvePlayerItemAuraSources113c,
  syncPlayerItemAuras113c,
  pulsePlayerItemAuraRuntime113c,
  stepPlayerAuras,
  syncPlayerVitalsFromCombat,
  stopPlayerAura,
}
