/**
 * Diablo II: Lord of Destruction v1.13c Periodic Aura Pulse Engine (`AuraScanner`).
 *
 * Implements:
 * - Periodic radial aura scanning (`aurarangecalc`, `perdelay` / `auradelay`, `aurafilter`).
 * - Friendly stat aura pulses (`Might`, `Prayer`, `Resist Fire/Cold/Lightning`, `Thorns`,
 *   `Defiance`, `Blessed Aim`, `Cleansing`, `Concentration`, `Vigor`, `Meditation`,
 *   `Fanaticism`, `Salvation`, plus Druid Spirit totem auras `Oak Sage` 298,
 *   `Heart of Wolverine` 297, `Spirit of Barbs` 296).
 * - Enemy debuff & radial damage aura pulses (`Holy Fire` 102, `Holy Freeze` 114,
 *   `Holy Shock` 118, `Sanctuary` 119 vs Undead, `Conviction` 123 `-Defense` & `-Resist`).
 * - `Redemption` (`124`) corpse consumption pulse restoring player HP & Mana.
 */
import type { D2DataRegistry, SkillRecord } from '../../common/data/data-registry.ts'
import { evaluateCalc, compute5BandScaling, computeDiminishingReturns } from '../../common/data/calc-ast.ts'
import { FIXED_ONE } from './stat-list.ts'
import { executeSUnitDmg, type CombatUnitContext } from './combat-pipeline.ts'
import { calculateConvictionStats, calculatePrayerStats, calculateRedemptionStats } from '../skills/skills.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { isWithinAuraRange, passesAuraFilter, type AuraTargetRelation } from '../../common/skills/aura-filter.ts'

export interface ActiveAuraSource {
  readonly sourceUnit: CombatUnitContext
  readonly skill: SkillRecord
  readonly slvl: number
  readonly startTick: number
  readonly pulseIntervalTicks: number
}

export interface AuraPulseOutcome {
  readonly auraSkillId: number
  readonly auraName: string
  readonly alliesBuffed: number
  readonly enemiesAffected: number
  readonly pulseDamageDealt: number
  readonly corpsesRedeemed: number
  readonly healthRestored?: number
  readonly manaRestored?: number
  readonly unitOverlays?: ReadonlyArray<{
    readonly unitType: 0 | 1
    readonly unitId: number
    readonly overlayId: number
    readonly overlayToken: string
  }>
}

export interface CorpseContext {
  readonly id: string
  consumed: boolean
  readonly x?: number | undefined
  readonly y?: number | undefined
}

export interface AuraPulseOptions {
  /** Scanned units stand in a town room (aurafilter `0x2000` room skip / `0x100` target reject). */
  readonly isTown?: boolean | undefined
  /**
   * aurafilter `0x200` path test (D2Common ord 11076, collision mask 4) from the source to a target.
   * When omitted every path is treated as clear.
   */
  readonly hasLineOfSight?: ((source: CombatUnitContext, target: CombatUnitContext) => boolean) | undefined
  readonly rollChanceFn?: (chancePct: number) => boolean
  readonly rng?: D2Rng | undefined
}

export class AuraScanner {
  readonly registry: D2DataRegistry
  private readonly activeAuras = new Map<string, ActiveAuraSource>()
  private readonly rng: D2Rng

  constructor(registry: D2DataRegistry, seed = 0x13579bdf) {
    this.registry = registry
    this.rng = new D2Rng(seed)
  }

  setActiveAura(sourceUnit: CombatUnitContext, skillId: number, slvl: number, currentTick = 0): ActiveAuraSource | null {
    const skill = this.registry.getSkillById(skillId)
    if (!skill) return null

    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl: sourceUnit.statList.getBaseSkillLevel(skillId),
      getBaseSkillLevel: (id: number) => sourceUnit.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => sourceUnit.statList.getEffectiveSkillLevel(id),
    }

    const perDelay =
      skillId === 277
        ? 25
        : skill.perDelay
          ? Math.max(10, evaluateCalc(skill.perDelay, calcCtx))
          : 50
    const source: ActiveAuraSource = {
      sourceUnit,
      skill,
      slvl,
      startTick: currentTick,
      pulseIntervalTicks: perDelay,
    }
    this.activeAuras.set(`${sourceUnit.id}:${String(skillId)}`, source)
    return source
  }

  clearUnitAuras(sourceUnitId: string): void {
    for (const key of this.activeAuras.keys()) {
      if (key.startsWith(`${sourceUnitId}:`)) {
        this.activeAuras.delete(key)
      }
    }
  }

  /**
   * Execute an immediate or periodic aura pulse across `allies`, `enemies`, and `corpses`.
   * Targets are selected like the 1.13c radial scan 0x6FCC0C70: sub-tile `dx² + dy² <= r²` with
   * `r = aurarangecalc`, then the `Skills.txt` `aurafilter` bits (0x6FCC0370, incl. the `0x2000`
   * town-room skip and the `0x100` in-town reject). The caster's own `aurastate` is applied directly
   * (SrvDo065 0x6FCBAA52) and is not subject to the scan.
   */
  pulseAura(
    aura: ActiveAuraSource,
    currentTick: number,
    allies: readonly CombatUnitContext[],
    enemies: readonly CombatUnitContext[],
    corpses?: CorpseContext[],
    options?: AuraPulseOptions,
  ): AuraPulseOutcome {
    const { sourceUnit, skill, slvl } = aura
    const blvl = sourceUnit.statList.getBaseSkillLevel(skill.id)
    const calcCtx = {
      registry: this.registry,
      activeSkill: skill,
      slvl,
      blvl,
      getBaseSkillLevel: (id: number) => sourceUnit.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => sourceUnit.statList.getEffectiveSkillLevel(id),
    }

    // Evaluate `aurastat1..6` and `aurastatcalc1..6`
    const stats: Record<string, number> = {}
    const statPairs: [string, string][] = [
      [skill.auraStat1, skill.auraStatCalc1],
      [skill.auraStat2, skill.auraStatCalc2],
      [skill.auraStat3, skill.auraStatCalc3],
      [skill.auraStat4, skill.auraStatCalc4],
      [skill.auraStat5, skill.auraStatCalc5],
      [skill.auraStat6, skill.auraStatCalc6],
    ]
    for (const [statName, statCalc] of statPairs) {
      if (statName && statCalc) {
        stats[statName.toLowerCase()] = evaluateCalc(statCalc, calcCtx)
      }
    }

    // Concentration (`113`) also records `concentration_damage_pct` for Blessed Hammer (`50%` efficiency)
    if (skill.id === 113) {
      stats['concentration_damage_pct'] = evaluateCalc('ln12', calcCtx)
    }

    // Fanaticism (`122`): Caster receives full caster %ED (50 + (slvl - 1) * 17)
    if (skill.id === 122) {
      stats['damagepercent'] = 50 + (slvl - 1) * 17
    }

    const isTown = options?.isTown ?? false
    const stateDuration = aura.pulseIntervalTicks + 5
    const selfState = skill.auraState || skill.auraTgtState || skill.name.toLowerCase().replace(/\s+/g, '')

    // Caster self-state stats (1.13c `samples/d2/D2Game.dll`):
    // - `SKILLS_SrvDo065` (0x6FCBA8D0, friendly stat auras): `aurastat1..6` (+0x54/+0x68) are
    //   evaluated and applied to the caster under `aurastate` via 0x6FCBA1A0.
    // - `SKILLS_SrvDo066` (0x6FCBAF50: Holy Fire/Holy Shock/Sanctuary/Conviction) and
    //   `SKILLS_SrvDo081` (0x6FCBABC0: Holy Freeze): the caster's `aurastate` only carries
    //   `passivestat1..5` / `passivecalc1..5` (+0x98/+0xA4, `cmp edi,5`); `aurastat1..6` are
    //   handed to the radial scan 0x6FCC0C70 and land only on hit targets under
    //   `auratargetstate` (and are skipped entirely when `auratargetstate` is empty).
    // - `SKILLS_SrvDo082` (Redemption) follows the 066 layout (no passive/aura stats in 1.13c).
    const isFriendlyStatAura = skill.srvDoFunc === 65 || skill.id === 296 || skill.id === 297 || skill.id === 298
    let selfStats: Record<string, number> = stats
    if (!isFriendlyStatAura) {
      selfStats = {}
      const passivePairs: [string, string][] = [
        [skill.passiveStat1, skill.passiveCalc1],
        [skill.passiveStat2, skill.passiveCalc2],
        [skill.passiveStat3, skill.passiveCalc3],
        [skill.passiveStat4, skill.passiveCalc4],
        [skill.passiveStat5, skill.passiveCalc5],
      ]
      for (const [statName, statCalc] of passivePairs) {
        if (statName && statCalc) {
          selfStats[statName.toLowerCase()] = evaluateCalc(statCalc, calcCtx)
        }
      }
    }
    sourceUnit.stateBus.applyState({
      stateNameOrId: selfState,
      sourceUnitId: sourceUnit.id,
      sourceSkillId: skill.id,
      slvl,
      durationFrames: stateDuration,
      currentFrame: currentTick,
      stats: selfStats,
      isAuraOverride: true,
    })

    let alliesBuffed = 1
    let enemiesAffected = 0
    let pulseDamageDealt = 0
    let corpsesRedeemed = 0
    let healthRestored = 0
    let manaRestored = 0
    const unitOverlays: Array<{
      readonly unitType: 0 | 1
      readonly unitId: number
      readonly overlayId: number
      readonly overlayToken: string
    }> = []

    // 0x6FCC0C70: radius = evaluated `aurarangecalc` (Blade Shield 277 `par4` = 6 included; SrvDo054
    // 0x6FCB3508 reads `[skill+0x64]` the same way). Hit when sub-tile `dx² + dy² <= r²` (D2Common
    // ord 10769 + `6fcc0e07: cmp ebp,eax; jl skip`). A unit without a position is never scanned.
    const radiusSubtiles = skill.auraRangeCalc ? evaluateCalc(skill.auraRangeCalc, calcCtx) : 0
    const auraFilter = skill.auraFilter

    const isPointInRange = (x: number | undefined, y: number | undefined): boolean => {
      if (sourceUnit.x === undefined || sourceUnit.y === undefined || x === undefined || y === undefined) {
        return false
      }
      return isWithinAuraRange(x - sourceUnit.x, y - sourceUnit.y, radiusSubtiles)
    }

    const unitKind = (u: CombatUnitContext, fallback: 'player' | 'monster'): 'player' | 'monster' => {
      if (u.unitType === undefined) return fallback
      return u.unitType === 'player' || u.unitType === 'party' ? 'player' : 'monster'
    }

    const acceptsTarget = (
      target: CombatUnitContext,
      relation: AuraTargetRelation,
      fallbackKind: 'player' | 'monster',
    ): boolean => {
      if (!isPointInRange(target.x, target.y)) return false
      const lineOfSightClear = options?.hasLineOfSight ? options.hasLineOfSight(sourceUnit, target) : undefined
      return passesAuraFilter(auraFilter, {
        kind: unitKind(target, fallbackKind),
        relation,
        dead: target.statList.getHp256() <= 0,
        inTown: isTown,
        isUndead: target.isUndead,
        isBoss: target.isBoss,
        isPrimeEvil: target.isPrimeEvil,
        lineOfSightClear,
      })
    }

    // Friendly stat aura (`srvdofunc = 65` or Oak Sage / Wolverine / Barbs): allies are chosen purely by
    // `aurafilter`. Paladin auras `73731` (`0x12003`) carry `0x2000`, so the scan skips town rooms; the
    // spirit auras 296-298 `65795` (`0x10103`) carry `0x100` (in-town reject). Meditation `73729`
    // (`0x12001`) lacks `0x2`, so it never reaches mercenaries or minions.
    if (isFriendlyStatAura) {
      const tgtState = skill.auraTgtState || selfState
      for (const ally of allies) {
        if (ally.id === sourceUnit.id) continue
        if (!acceptsTarget(ally, 'ally', 'player')) continue

        const allyStats = { ...stats }
        // Fanaticism (122): allies receive strictly HALF of caster %ED and is_ally flag
        if (skill.id === 122) {
          const casterEd = stats['damagepercent'] ?? (50 + (slvl - 1) * 17)
          allyStats['damagepercent'] = Math.trunc(casterEd / 2)
          allyStats['is_ally'] = 1
        }

        ally.stateBus.applyState({
          stateNameOrId: tgtState,
          sourceUnitId: sourceUnit.id,
          sourceSkillId: skill.id,
          slvl,
          durationFrames: stateDuration,
          currentFrame: currentTick,
          stats: allyStats,
          isAuraOverride: true,
        })
        alliesBuffed += 1
      }
    }

    // Prayer (99), Cleansing (109), and Meditation (120) Heal Pulse & Synergy:
    // - Prayer (99): heals self and party allies within range by edns HP
    // - Cleansing (109) & Meditation (120): if caster has Prayer (blvl > 0),
    //   emits Prayer heal pulse at Prayer's effective slvl (`skill('Prayer'.edns)`) with 0 mana cost
    // - Cleansing (109): shortens active curse and poison durations proportionally on self and allies
    if (skill.id === 99 || skill.id === 109 || skill.id === 120) {
      let healPts = 0
      if (skill.id === 99) {
        healPts = calculatePrayerStats(slvl).healAmount
      } else {
        const prayerBlvl = sourceUnit.statList.getBaseSkillLevel(99)
        const prayerEffLvl = prayerBlvl > 0 ? sourceUnit.statList.getEffectiveSkillLevel(99) : 0
        if (prayerEffLvl > 0) {
          healPts = calculatePrayerStats(prayerEffLvl).healAmount
        }
      }

      if (healPts > 0) {
        const healPts256 = healPts * FIXED_ONE
        const targetsToHeal = [
          sourceUnit,
          ...allies.filter(a => a.id !== sourceUnit.id && acceptsTarget(a, 'ally', 'player')),
        ]
        for (const target of targetsToHeal) {
          const curHp = target.statList.getHp256()
          const maxHp = target.statList.getMaxHp256()
          const newHp = Math.min(maxHp, curHp + healPts256)
          if (newHp > curHp) {
            target.statList.setHp256(newHp)
            healthRestored += (newHp - curHp) / FIXED_ONE
          }
        }
      }

      if (skill.id === 109) {
        // Cleansing curse & poison length reduction (dm34: 30..90 -> 39%..80%)
        const reductionPct = computeDiminishingReturns(30, 90, slvl)
        const targetsToCleanse = [
          sourceUnit,
          ...allies.filter(a => a.id !== sourceUnit.id && acceptsTarget(a, 'ally', 'player')),
        ]
        for (const target of targetsToCleanse) {
          target.stateBus.reduceCurseAndPoisonDurations(currentTick, reductionPct)
        }
      }
    }

    // Offensive / debuff auras and Redemption: targets come from the same scan. Their aurafilter
    // values (Holy Fire/Shock `0xA783`, Conviction `0xA583`, Holy Freeze `0x4A283`, Sanctuary
    // `0xE786`) carry `0x2000`, so nothing in town is hit; Redemption `0x1102` carries `0x100`.
    // Conviction (`123`): applies `conviction` (`conviction_pierce` + `-defense`) to wilderness enemies
    if (skill.id === 123) {
      const convStats = calculateConvictionStats(slvl)
      const pierce = convStats.resistanceReductionPct
      const defPenalty = -convStats.defenseReductionPct
      for (const enemy of enemies) {
        if (!acceptsTarget(enemy, 'enemy', 'monster')) continue

        enemy.stateBus.applyState({
          stateNameOrId: skill.auraTgtState || 'conviction',
          sourceUnitId: sourceUnit.id,
          sourceSkillId: skill.id,
          slvl,
          durationFrames: stateDuration,
          currentFrame: currentTick,
          stats: {
            conviction_pierce: pierce,
            item_armor_percent: defPenalty,
          },
          isAuraOverride: true,
        })
        enemiesAffected += 1
      }
    }

    // Blade Shield (`277`): periodic radial physical slash every 25 frames over `aurarangecalc = par4`
    // (6) sub-tiles, `aurafilter = 33667` (`0x8383`: enemies, line of sight, not in town)
    // Deals 1/4 (`SrcDam = 32`, `Half2HSrc = 0`) weapon damage + flat skill physical damage (`descdam = 5`).
    if (skill.id === 277) {
      const baseMin = compute5BandScaling(
        slvl,
        skill.minDam,
        skill.minLevDam1,
        skill.minLevDam2,
        skill.minLevDam3,
        skill.minLevDam4,
        skill.minLevDam5,
      )
      const baseMax = compute5BandScaling(
        slvl,
        skill.maxDam,
        skill.maxLevDam1,
        skill.maxLevDam2,
        skill.maxLevDam3,
        skill.maxLevDam4,
        skill.maxLevDam5,
      )
      const flatMin256 = Math.trunc((baseMin * FIXED_ONE * 32) / 128)
      const flatMax256 = Math.trunc((baseMax * FIXED_ONE * 32) / 128)
      const bsRng = options?.rng ?? this.rng
      for (const enemy of enemies) {
        if (!acceptsTarget(enemy, 'enemy', 'monster')) continue
        const out = executeSUnitDmg(sourceUnit, enemy, {
          skillId: 277,
          slvl,
          attackKind: 'melee',
          srcDam: 32,
          flatPhysMin256: flatMin256,
          flatPhysMax256: flatMax256,
        }, bsRng)
        pulseDamageDealt += out.totalDamage
        enemiesAffected += 1
      }
    }

    // Radial damage auras (`Holy Fire` 102, `Holy Freeze` 114, `Holy Shock` 118, `Sanctuary` 119)
    if (skill.id === 102 || skill.id === 114 || skill.id === 118 || skill.id === 119) {
      const baseMin = compute5BandScaling(
        slvl,
        skill.eMin,
        skill.eMinLev1,
        skill.eMinLev2,
        skill.eMinLev3,
        skill.eMinLev4,
        skill.eMinLev5,
      )
      const baseMax = compute5BandScaling(
        slvl,
        skill.eMax,
        skill.eMaxLev1,
        skill.eMaxLev2,
        skill.eMaxLev3,
        skill.eMaxLev4,
        skill.eMaxLev5,
      )
      const synPct = skill.eDmgSymPerCalc ? evaluateCalc(skill.eDmgSymPerCalc, calcCtx) : 0
      const min256 = Math.trunc(((baseMin << skill.hitShift) * (100 + synPct)) / 100)
      const max256 = Math.trunc(((baseMax << skill.hitShift) * (100 + synPct)) / 100)

      const rng = options?.rng ?? this.rng
      const rollChance =
        options?.rollChanceFn ??
        ((chance: number) => {
          return rng.rand(100) < chance
        })

      for (const enemy of enemies) {
        // `aurafilter`: Sanctuary `59270` (`0xE786`) = undead (`0x4`) non-`boss` (`0x4000`) monsters only
        // (no `0x1`); Holy Freeze `303747` (`0x4A283`) rejects `primeevil` (`0x40000`); Holy Fire / Holy
        // Shock / Sanctuary / Holy Freeze all require a clear path (`0x200`).
        if (!acceptsTarget(enemy, 'enemy', 'monster')) continue
        // Holy Freeze (114): targets with `coldEffect === 0` are skipped (not an aurafilter bit).
        if (skill.id === 114 && enemy.coldEffect === 0) continue

        // Holy Freeze (114): enemies receive exactly the table `aurastat1..3`
        // (`velocitypercent` / `attackrate` / `other_animrate` = `-dm34`, Param3/4 = 25/60) on
        // `auratargetstate = holywindcold`. SrvDo081 (0x6FCBAED4 -> 0x6FCC0C70) adds no `item_slow`.
        // Holy Fire / Holy Shock / Sanctuary have an empty `auratargetstate`, so SrvDo066 skips the
        // aurastat loop (`cmp word [esi+0x82],0; jl`) and their targets receive no aura stats.
        const enemyTgtState = skill.auraTgtState
        if (enemyTgtState) {
          enemy.stateBus.applyState({
            stateNameOrId: enemyTgtState,
            sourceUnitId: sourceUnit.id,
            sourceSkillId: skill.id,
            slvl,
            durationFrames: stateDuration,
            currentFrame: currentTick,
            stats: { ...stats },
            isAuraOverride: true,
          })
          // 1.13c SkillPal.cpp:327 — 20% chance per pulse to toggle `STATE_SHATTER` (#107) on Holy Freeze targets
          if (skill.id === 114) {
            if (rollChance(20)) {
              enemy.stateBus.applyState({
                stateNameOrId: 'shatter',
                sourceUnitId: sourceUnit.id,
                sourceSkillId: 114,
                slvl,
                durationFrames: stateDuration,
                currentFrame: currentTick,
              })
            } else {
              enemy.stateBus.removeState('shatter')
            }
          }
        }

        if (skill.id === 119) {
          enemy.stateBus.applyState({
            stateNameOrId: 'knockback',
            sourceSkillId: 119,
            slvl,
            durationFrames: 10,
          })
          // 1.13c Skills.txt #119 Sanctuary tgtoverlay='cast_undead' (Overlay.txt row 79, Issue #1277)
          unitOverlays.push({
            unitType: enemy.unitType === 'monster' ? 1 : 0,
            unitId: Number(String(enemy.id).replace(/\D+/g, '') || 1) >>> 0,
            overlayId: 79,
            overlayToken: 'cast_undead',
          })
        }

        const out = executeSUnitDmg(sourceUnit, enemy, {
          skillId: skill.id,
          attackKind: 'spell',
          elemType: skill.eType || (skill.id === 119 ? 'mag' : 'fire'),
          elemMin256: min256,
          elemMax256: max256,
          autoHit: true,
          unblockable: true,
          ...(skill.id === 119 ? { knockback: true } : {}),
        }, rng)
        pulseDamageDealt += out.totalDamage
        enemiesAffected += 1
      }

      // Sanctuary (119): 1.13c SkillPal.cpp:415-417 consumes 1 mana (`mana = 1`, `manashift = 8` -> 256 fixed-point) when undead targets are pulsed
      if (skill.id === 119 && enemiesAffected > 0) {
        const curMana256 = sourceUnit.statList.getMana256()
        if (curMana256 >= FIXED_ONE) {
          sourceUnit.statList.setMana256(curMana256 - FIXED_ONE)
        }
      }
    }

    // Redemption (`124`): consumes corpses to recover HP & Mana
    // Radius `aurarangecalc = ln12` (Param1 16, Param2 0 -> 16 sub-tiles), `aurafilter = 4354`
    // (`0x1102`: dead (`0x1000`) monsters (`0x2`) not in town (`0x100`)).
    // d100 check against dm34 (24%..86%), restores ln56 (25..120) Life and Mana
    if (skill.id === 124 && corpses) {
      const redemptionStats = calculateRedemptionStats(slvl)
      const recoverPts = redemptionStats.lifeRecoverPts
      const chancePct = redemptionStats.redemptionChancePct

      const rng = options?.rng ?? this.rng
      const rollChance =
        options?.rollChanceFn ??
        ((chance: number) => {
          return rng.rand(100) < chance
        })

      for (const c of corpses) {
        if (c.consumed) continue

        if (!isPointInRange(c.x, c.y)) continue
        if (!passesAuraFilter(auraFilter, { kind: 'monster', relation: 'neutral', dead: true, inTown: isTown })) continue

        // Chance check
        if (!rollChance(chancePct)) continue

        c.consumed = true
        corpsesRedeemed += 1
        const curHp = sourceUnit.statList.getHp256()
        const maxHp = sourceUnit.statList.getMaxHp256()
        const newHp = Math.min(maxHp, curHp + recoverPts * FIXED_ONE)
        sourceUnit.statList.setHp256(newHp)
        healthRestored += (newHp - curHp) / FIXED_ONE

        const curMana = sourceUnit.statList.getMana256()
        const maxMana = sourceUnit.statList.getMaxMana256()
        const newMana = Math.min(maxMana, curMana + recoverPts * FIXED_ONE)
        sourceUnit.statList.setMana256(newMana)
        manaRestored += (newMana - curMana) / FIXED_ONE
      }
    }

    return {
      auraSkillId: skill.id,
      auraName: skill.name,
      alliesBuffed,
      enemiesAffected,
      pulseDamageDealt,
      corpsesRedeemed,
      healthRestored,
      manaRestored,
      ...(unitOverlays.length > 0 ? { unitOverlays } : {}),
    }
  }

  /**
   * Periodic tick step across all active auras.
   * Handles continuous per-frame mana drain for Prayer (99) and auto-deactivates at 0 mana.
   */
  tick(
    currentTick: number,
    allies: readonly CombatUnitContext[],
    enemies: readonly CombatUnitContext[],
    corpses?: CorpseContext[],
    options?: AuraPulseOptions,
  ): AuraPulseOutcome[] {
    const outcomes: AuraPulseOutcome[] = []
    const aurasToRemove: string[] = []

    for (const [key, aura] of this.activeAuras.entries()) {
      // Prayer (99): continuous mana drain (16 units of mana256 per frame = 1/16 mana/frame)
      if (aura.skill.id === 99) {
        const curMana256 = aura.sourceUnit.statList.getMana256()
        const manaCost256 = 16 // 16 / 256 per frame
        if (curMana256 < manaCost256) {
          // Depleted mana -> shut down Prayer
          aura.sourceUnit.statList.setMana256(0)
          aura.sourceUnit.stateBus.removeState('prayer')
          aurasToRemove.push(key)
          continue
        } else {
          aura.sourceUnit.statList.setMana256(curMana256 - manaCost256)
        }
      }

      if ((currentTick - aura.startTick) % aura.pulseIntervalTicks === 0) {
        outcomes.push(this.pulseAura(aura, currentTick, allies, enemies, corpses, options))
      }
    }

    for (const key of aurasToRemove) {
      this.activeAuras.delete(key)
    }

    return outcomes
  }
}

