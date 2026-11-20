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
import { evaluateCalc, compute5BandScaling, computeDiminishingReturns, type CalcEvalContext } from '../../common/data/calc-ast.ts'
import { FIXED_ONE } from './stat-list.ts'
import { executeSUnitDmg, type CombatUnitContext } from './combat-pipeline.ts'
import { calculateConvictionStats, calculatePrayerStats, calculateRedemptionStats } from '../skills/skills.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { isWithinAuraRange, passesAuraFilter, type AuraTargetRelation } from '../../common/skills/aura-filter.ts'

/**
 * 1.13c `D2Game.dll` (`SKILLS_SrvDo065` `0x6FCBA955..0x6FCBA96C`, `SKILLS_GetNextPerDelayFrame`
 * `0x6FCBE970..0x6FCBE994`, and `EVENTTYPE_PERIODICSKILL` schedulers `0x6FCBF3B0` / `0x6FCC3120`):
 * Evaluates `Skills.txt` `perdelay` (+0x128) and clamps the periodic pulse interval to `>= 5` frames.
 * Empty `perdelay` (e.g. Druid spirit auras `#296..#298`) evaluates to `0` and clamps to `5`.
 */
export function computeAuraPerDelayFrames(perDelayExpr: string, calcCtx: CalcEvalContext): number {
  const raw = perDelayExpr ? evaluateCalc(perDelayExpr, calcCtx) : 0
  return Math.max(5, Math.trunc(raw))
}

/**
 * 1.13c `D2Game.dll` (`SKILLS_SrvDo065` `0x6FCBA973..0x6FCBA988`, `SKILLS_SrvDo066` `0x6FCBAF50`,
 * `SKILLS_SrvDo081` `0x6FCBABC0`, `SKILLS_SrvDo082` `0x6FCBA400` via `0x6FCBE970`):
 * Aligns aura state duration to the global game frame `F` and pulse period `d = max(5, perdelay)`:
 *   `duration = d * trunc((F + d - 1) / d) - F + 2`  (`d * ceil(F / d) - F + 2` for `F >= 1`).
 */
export function computeAuraStateDurationFrames(currentTick: number, perDelay: number): number {
  const d = Math.max(5, Math.trunc(perDelay))
  const f = Math.max(0, Math.trunc(currentTick))
  return Math.max(1, Math.trunc((f + d - 1) / d)) * d - f + 2
}

/**
 * 1.13c `D2Common.dll` ordinal 10090 (`0x6FD9EA00`, imported via `0x6FC2AF58` in `D2Game.dll`):
 * Computes the per-pulse mana cost in 1/256 fixed-point units from `Skills.txt` columns
 * `mana` (`wMana` at `+0x18A`), `lvlmana` (`wLvlMana` at `+0x18C`), and `manashift` (`nManaShift` at `+0x188`):
 *   `manaCost256 = (mana + lvlmana * (slvl - 1)) << manashift`
 */
export function computeAuraPulseManaCost256(
  skill: Pick<SkillRecord, 'mana' | 'lvlMana' | 'manaShift'>,
  slvl: number,
): number {
  const lvl = Math.max(1, Math.trunc(slvl))
  const raw = skill.mana + skill.lvlMana * (lvl - 1)
  if (raw <= 0) return 0
  return raw << skill.manaShift
}

/**
 * 1.13c `D2Game.dll` (`SKILLS_SrvDo065` `0x6FCBA9A3`/`0x6FCBAB6E`, `SKILLS_SrvDo066` `0x6FCBB065`/`0x6FCBB27B`):
 * Only `UNIT_PLAYER` (`dwUnitType == 0`) units check mana, consume mana (`0x6FCBED20`), and toggle
 * `STATE_NOMANAREGEN` (`85`, `'nomanaregen'`). Monster/mercenary/pet casters (`dwUnitType != 0`) do not.
 */
function isPlayerUnit(unit: CombatUnitContext): boolean {
  if (unit.petType !== undefined) return false
  return unit.unitType === undefined || unit.unitType === 'player' || unit.unitType === 'party'
}

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
  readonly unitsHealed?: number
  readonly manaSpent256?: number
  readonly unitOverlays?: ReadonlyArray<{
    readonly unitType: 0 | 1
    readonly unitId: number
    readonly overlayId: number
    readonly overlayToken: string
  }>
  /**
   * Sanctuary (#119, `SrvDo066` `0x6FCBAF50`): ids of every pulsed Undead target. `ResultFlags |= 0x08`
   * requests `MONMODE_KNOCKBACK` (13) radially away from the aura source even when the magic pulse is
   * fully resisted (#1807).
   */
  readonly knockbackTargetIds?: readonly string[]
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
  private readonly lastTickPulseFrames = new Map<string, number>()
  private readonly lastPulseTargets = new Map<string, CombatUnitContext[]>()
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

    const perDelay = computeAuraPerDelayFrames(skill.perDelay, calcCtx)
    const source: ActiveAuraSource = {
      sourceUnit,
      skill,
      slvl,
      startTick: currentTick,
      pulseIntervalTicks: perDelay,
    }
    const key = `${sourceUnit.id}:${String(skillId)}`
    this.activeAuras.set(key, source)
    this.lastTickPulseFrames.delete(key)
    this.lastPulseTargets.delete(key)
    return source
  }

  clearUnitAuras(sourceUnitId: string): void {
    for (const [key, aura] of this.activeAuras.entries()) {
      if (key.startsWith(`${sourceUnitId}:`)) {
        if (isPlayerUnit(aura.sourceUnit)) {
          aura.sourceUnit.stateBus.removeState('nomanaregen')
        }
        this.activeAuras.delete(key)
        this.lastTickPulseFrames.delete(key)
        this.lastPulseTargets.delete(key)
      }
    }
  }

  /** Keep every active aura's `sourceUnit` coordinates aligned as the caster moves. */
  syncCasterPosition(x: number, y: number): void {
    for (const aura of this.activeAuras.values()) {
      aura.sourceUnit.x = x
      aura.sourceUnit.y = y
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

    // 1.13c `SKILLS_SrvDo065` (`0x6FCBA921..0x6FCBA9B0`) & `SKILLS_SrvDo066` (`0x6FCBAFC2..0x6FCBB072`):
    // Compute per-pulse mana cost `(mana + lvlmana * (slvl - 1)) << manashift` (`D2Common_10090` `0x6FD9EA00`).
    // If caster is a player (`dwUnitType == 0`) and `curMana256 < manaCost256`, `aurastat1..6` evaluation
    // (including Prayer `#99` `hitpoints` heal) is skipped (`0x6FCBA9AC: cmp [esp+0x20], edi; jl 0x6FCBAA03`).
    const manaCost256 = computeAuraPulseManaCost256(skill, slvl)
    const isPlayerCaster = isPlayerUnit(sourceUnit)
    const hasEnoughManaForPulse =
      !isPlayerCaster || manaCost256 <= 0 || sourceUnit.statList.getMana256() >= manaCost256

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
    if (hasEnoughManaForPulse) {
      for (const [statName, statCalc] of statPairs) {
        if (statName && statCalc) {
          stats[statName.toLowerCase()] = evaluateCalc(statCalc, calcCtx)
        }
      }
    }

    // Fanaticism (`122`, `samples/d2/excel/Skills.txt`): Caster receives `passivestat1 = damagepercent` (`passivecalc1 = ln56`)
    if (skill.id === 122 && hasEnoughManaForPulse) {
      stats['damagepercent'] = evaluateCalc(skill.passiveCalc1 || 'ln56', calcCtx)
    }

    const isTown = options?.isTown ?? false
    const stateDuration = computeAuraStateDurationFrames(currentTick, aura.pulseIntervalTicks)
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
      if (hasEnoughManaForPulse) {
        for (const [statName, statCalc] of passivePairs) {
          if (statName && statCalc) {
            selfStats[statName.toLowerCase()] = evaluateCalc(statCalc, calcCtx)
          }
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
    let unitsHealed = 0
    const pulsedTargets: CombatUnitContext[] = [sourceUnit]
    const unitOverlays: Array<{
      readonly unitType: 0 | 1
      readonly unitId: number
      readonly overlayId: number
      readonly overlayToken: string
    }> = []
    const knockbackTargetIds: string[] = []

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
        // Fanaticism (`122`, `samples/d2/excel/Skills.txt`): allies receive `aurastat3 = damagepercent` (`aurastatcalc3 = ln56/2`)
        if (skill.id === 122 && hasEnoughManaForPulse) {
          allyStats['damagepercent'] = evaluateCalc(skill.auraStatCalc3 || 'ln56/2', calcCtx)
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
        pulsedTargets.push(ally)
        alliesBuffed += 1
      }
    }

    // Prayer (99), Cleansing (109), and Meditation (120) Heal Pulse & Synergy:
    // - Prayer (99): heals self and party allies within range by edns HP (only when caster has enough mana
    //   `curMana256 >= manaCost256` per `SKILLS_SrvDo065` `0x6FCBA9AC`).
    // - Cleansing (109) & Meditation (120): if caster has Prayer (blvl > 0),
    //   emits Prayer heal pulse at Prayer's effective slvl (`skill('Prayer'.edns)`) with 0 mana cost.
    // - Cleansing (109): shortens active curse and poison durations proportionally on self and allies.
    if (skill.id === 99 || skill.id === 109 || skill.id === 120) {
      let healPts = 0
      if (skill.id === 99) {
        if (hasEnoughManaForPulse) {
          healPts = calculatePrayerStats(slvl).healAmount
        }
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
          // 1.13c `SKILLS_AuraCallback_BasicAura` (`0x6FCBA357..0x6FCBA36E`):
          // Only increments `args.field_40` (`[esp+0x74]`) when `newHp > curHp`.
          if (newHp > curHp) {
            target.statList.setHp256(newHp)
            healthRestored += (newHp - curHp) / FIXED_ONE
            unitsHealed += 1
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
            fireresist: -pierce,
            lightresist: -pierce,
            coldresist: -pierce,
            skill_armor_percent: defPenalty,
            item_armor_percent: defPenalty,
          },
          isAuraOverride: true,
        })
        pulsedTargets.push(enemy)
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
          pulsedTargets.push(enemy)
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
          // 1.13c Skills.txt #119 Sanctuary: ResultFlags = 8 triggers MONMODE_KNOCKBACK (13) via
          // SUNITDMG_ExecuteEvents (0x6FCFD00E..0x6FCFD120); there is no States.txt 'knockback' state.
          // tgtoverlay='cast_undead' (Overlay.txt row 79, Issue #1277).
          unitOverlays.push({
            unitType: enemy.unitType === 'monster' ? 1 : 0,
            unitId: Number(String(enemy.id).replace(/\D+/g, '') || 1) >>> 0,
            overlayId: 79,
            overlayToken: 'cast_undead',
          })
          knockbackTargetIds.push(String(enemy.id))
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

    // 1.13c `D2Game.dll` (`SKILLS_SrvDo065` `0x6FCBAB66..0x6FCBABA7`, `SKILLS_SrvDo066` `0x6FCBB26F..0x6FCBB2B7`):
    // For any `aura=1` skill with `manaCost256 > 0` (`#99` Prayer, `#119` Sanctuary) cast by a player unit
    // (`dwUnitType == UNIT_PLAYER (0)`):
    // - If `activeUnitsCount > 0` (`unitsHealed > 0` for Prayer `#99`; `enemiesAffected > 0` for Sanctuary `#119`)
    //   and `curMana256 >= manaCost256`: toggle `STATE_NOMANAREGEN` (`85`, `'nomanaregen'`) ON (`1`) on the caster
    //   (`0x6FCBAB80`) and deduct `manaCost256` from caster mana (`0x6FCBAB89` -> `0x6FCBED20`).
    // - Otherwise (`activeUnitsCount === 0` or `curMana256 < manaCost256`): toggle `STATE_NOMANAREGEN` (`85`)
    //   OFF (`0`) on the caster (`0x6FCBABA2`) and deduct 0 mana.
    // - Monster/mercenary/pet casters (`dwUnitType != UNIT_PLAYER`) skip mana consumption and `nomanaregen`.
    let manaSpent256 = 0
    if (manaCost256 > 0 && isPlayerCaster) {
      const activeUnitsCount = skill.id === 99 ? unitsHealed : enemiesAffected
      const curMana256 = sourceUnit.statList.getMana256()
      if (activeUnitsCount > 0 && curMana256 >= manaCost256) {
        sourceUnit.stateBus.applyState({
          stateNameOrId: 'nomanaregen',
          sourceUnitId: sourceUnit.id,
          sourceSkillId: skill.id,
          slvl,
          currentFrame: currentTick,
        })
        sourceUnit.statList.setMana256(curMana256 - manaCost256)
        manaSpent256 = manaCost256
      } else {
        sourceUnit.stateBus.removeState('nomanaregen')
      }
    }

    const key = `${sourceUnit.id}:${String(skill.id)}`
    if (this.activeAuras.get(key) === aura) {
      this.lastPulseTargets.set(key, pulsedTargets)
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
      unitsHealed,
      manaSpent256,
      ...(unitOverlays.length > 0 ? { unitOverlays } : {}),
      ...(knockbackTargetIds.length > 0 ? { knockbackTargetIds } : {}),
    }
  }

  /**
   * Periodic tick step across all active auras (`perdelay` cadence).
   */
  tick(
    currentTick: number,
    allies: readonly CombatUnitContext[],
    enemies: readonly CombatUnitContext[],
    corpses?: CorpseContext[],
    options?: AuraPulseOptions,
  ): AuraPulseOutcome[] {
    const outcomes: AuraPulseOutcome[] = []

    for (const [key, aura] of this.activeAuras.entries()) {
      if (currentTick % aura.pulseIntervalTicks === 0) {
        this.lastTickPulseFrames.set(key, currentTick)
        outcomes.push(this.pulseAura(aura, currentTick, allies, enemies, corpses, options))
      } else if (this.lastTickPulseFrames.get(key) === currentTick - 1) {
        // 1.13c `SKILLS_GetNextPerDelayFrame` (0x6FCBE970) schedules the new cycle on `k * d + 1`
        // where `computeAuraStateDurationFrames(k * d + 1, d) = d + 1` (`expireFrame = (k + 1) * d + 2`).
        // Refresh ONLY states that were actually pulsed by `tick(k * d)` (stored in `lastPulseTargets`),
        // so units that walked out of range or entered town (`aurafilter 0x2000` / `0x100`) expire cleanly!
        const cycleDuration = computeAuraStateDurationFrames(currentTick, aura.pulseIntervalTicks)
        const nextExpireFrame = currentTick + cycleDuration
        const prevTargets = this.lastPulseTargets.get(key) ?? []
        const seen = new Set<CombatUnitContext>()
        const units: CombatUnitContext[] = []
        for (const u of prevTargets) {
          if (!seen.has(u)) {
            seen.add(u)
            units.push(u)
          }
        }
        for (const u of units) {
          for (const entry of u.stateBus.getActiveEntries()) {
            if (
              entry.sourceUnitId === aura.sourceUnit.id &&
              entry.sourceSkillId === aura.skill.id &&
              entry.expireFrame === currentTick + 1
            ) {
              entry.expireFrame = nextExpireFrame
              ;(entry as { durationFrames?: number }).durationFrames = cycleDuration
            }
          }
          for (const mod of u.statList.getActiveModifiers()) {
            if (
              mod.sourceUnitId === aura.sourceUnit.id &&
              mod.sourceSkillId === aura.skill.id &&
              mod.expireFrame === currentTick + 1
            ) {
              mod.expireFrame = nextExpireFrame
            }
          }
        }
      }
    }

    return outcomes
  }
}

