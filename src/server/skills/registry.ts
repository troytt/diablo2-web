/**
 * Diablo II: Lord of Destruction v1.13c Zero-Conflict Skill Registry (`src/game/skills/registry.ts`).
 *
 * 1. Auto-discovers per-skill implementation modules in `src/game/skills/impl/<class>/skill-<id3>-<slug>.ts`
 *    via `import.meta.glob('./impl/**\/*.ts', { eager: true })` so isolated `git worktree` skill branches
 *    add only their own file and never touch any shared registry file.
 * 2. Provides complete 1.13c data-driven evaluation (`evaluateSkill113c`) and runtime execution
 *    (`executeSkill113c`) across all 221 player skills (`210` class skills + `11` universal skills)
 *    and `17` summoned pet/trap AI sub-skills (`IDs 281..338`), directly from `Patch_D2.mpq`.
 */
import type {
  SkillEvalContext,
  SkillEvalResult,
  SkillExecContext,
  SkillExecOutcome,
  SkillModule,
} from './types.ts'
import type { SkillRecord } from '../../common/data/data-registry.ts'
import {
  compute3BandDuration,
  compute5BandScaling,
  computeDiminishingReturns,
  computeSkillManaCost256,
  evaluateCalc,
} from '../../common/data/calc-ast.ts'
import { FIXED_ONE } from '../engine/stat-list.ts'
import { canMonsterTargetBeCursed113c } from '../../common/units/monstats2-flags.ts'
import {
  computeCorpseExplosion113c,
  executeSUnitDmg,
  type CombatRng,
  type CombatUnitContext,
} from '../engine/combat-pipeline.ts'
import {
  MissileEngine,
  calculateBoneArmorCapacity,
  calculateStaticFieldDamage,
  calculateStaticFieldRadiusPx,
  hasLineOfSight,
  calculateCurseEffect,
} from '../engine/missile-engine.ts'
import {
  DRUID_TRANSFORM_CLT_OVERLAYS_113C,
  canCastDruidSkill,
  calculateFeralRageStats,
  calculateMaulStats,
  calculateRabiesStats,
  advanceChargeOrb,
} from './druid-shapeshift.ts'
export { DRUID_TRANSFORM_CLT_OVERLAYS_113C }
import {
  computeBurstOfSpeedFRW,
  computeBurstOfSpeedIAS,
  computeFadeResistances,
  computeFadeCurseReduction,
  computePsychicHammerDamage,
  computePsychicHammerKnockbackChance,
  computeMindBlastDamage,
  computeMindBlastStunDuration,
  computeMindBlastConversionChance,
} from './assassin-shadow.ts'
import {
  resolveFinisherDischarge,
  type ActiveChargeOrb,
} from './assassin-martial-arts.ts'
import { calculateThrowingMasteryStats } from './barbarian-masteries.ts'
import { calculateStunStats, calculateWhirlwindHitFrames } from './barbarian-combat.ts'
import {
  rollFindPotionDrop113c,
  resolveAiCurseDivisor,
  validateBarbarianCorpseTarget,
} from './barbarian-warcries.ts'
import { townLevelForAct } from '../../common/world/portal.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { advanceUnitPierceSeed } from '../engine/missile-pierce.ts'
import { resolveThrowMissileForItemCode } from '../../common/skills/weapon-combat-meta.ts'

function resolveThrowMissileForCasterWeapon(code?: string, itemType?: string): string | null {
  if (code) {
    const byCode = resolveThrowMissileForItemCode(code)
    if (byCode) return byCode
  }
  const t = (itemType ?? '').toLowerCase()
  const fallbackCode = t === 'tkni' ? 'tkf' : t === 'taxe' ? 'tax' : t === 'jave' || t === 'ajav' ? 'jav' : undefined
  return fallbackCode ? resolveThrowMissileForItemCode(fallbackCode) : null
}

declare global {
  interface ImportMeta {
    glob?: <T>(pattern: string, opts: { eager: boolean }) => Record<string, T>
  }
}

const fallbackSkillRngByCtx = new WeakMap<object, D2Rng>()

function rollSkill100(ctx: SkillExecContext): number {
  return resolveSkillRng(ctx).rand(100)
}

function resolveSkillRng(ctx: SkillExecContext): CombatRng {
  const ctxRng = (ctx as { rng?: ({ rand?(n: number): number; roll?(n: number): number }) | (() => number) }).rng
  if (typeof ctxRng === 'function') {
    return {
      rand(max: number): number {
        const m = Math.trunc(max)
        return m <= 0 ? 0 : Math.floor(ctxRng() * m)
      },
    }
  }
  if (ctxRng) {
    if (typeof ctxRng.rand === 'function') return { rand: (max: number) => ctxRng.rand!(max) }
    if (typeof ctxRng.roll === 'function') return { rand: (max: number) => ctxRng.roll!(max) }
  }
  const casterRng = (ctx.caster as { rng?: { rand?(n: number): number; roll?(n: number): number } }).rng
  if (casterRng) {
    if (typeof casterRng.rand === 'function') return { rand: (max: number) => casterRng.rand!(max) }
    if (typeof casterRng.roll === 'function') return { rand: (max: number) => casterRng.roll!(max) }
  }
  let cached = fallbackSkillRngByCtx.get(ctx)
  if (!cached) {
    cached = new D2Rng(0x00000001)
    fallbackSkillRngByCtx.set(ctx, cached)
  }
  return cached
}

function resolveDefaultWeaponMinPhys(unit: CombatUnitContext): number {
  if (unit.weaponMinPhys !== undefined) return unit.weaponMinPhys
  const baseMin = Math.trunc(unit.statList.getAccruedStat('mindamage'))
  return baseMin <= 0 ? 1 : baseMin
}

function resolveDefaultWeaponMaxPhys(unit: CombatUnitContext): number {
  if (unit.weaponMaxPhys !== undefined) return unit.weaponMaxPhys
  const baseMax = Math.trunc(unit.statList.getAccruedStat('maxdamage'))
  return baseMax <= 1 ? 2 : baseMax
}

const REGISTERED_SKILL_MODULES = new Map<number, SkillModule>()

export type SkillGlobLoader = <T>(pattern: string, opts: { eager: boolean }) => Record<string, T>

import { SKILL_MODULES as AMA_SKILLS } from './impl/ama/index.ts'
import { SKILL_MODULES as ASS_SKILLS } from './impl/ass/index.ts'
import { SKILL_MODULES as BAR_SKILLS } from './impl/bar/index.ts'
import { SKILL_MODULES as DRU_SKILLS } from './impl/dru/index.ts'
import { SKILL_MODULES as NEC_SKILLS } from './impl/nec/index.ts'
import { SKILL_MODULES as PAL_SKILLS } from './impl/pal/index.ts'
import { SKILL_MODULES as SOR_SKILLS } from './impl/sor/index.ts'
import { SKILL_MODULES as UNI_SKILLS } from './impl/uni/index.ts'

const STATIC_SKILL_MODULES: Record<string, { readonly default?: SkillModule; readonly skillModule?: SkillModule }> = {
  ...AMA_SKILLS,
  ...ASS_SKILLS,
  ...BAR_SKILLS,
  ...DRU_SKILLS,
  ...NEC_SKILLS,
  ...PAL_SKILLS,
  ...SOR_SKILLS,
  ...UNI_SKILLS,
}

export function discoverSkillModules(
  loaderOrDiscovered?:
    | SkillGlobLoader
    | Record<string, { readonly default?: SkillModule; readonly skillModule?: SkillModule }>,
  targetMap: Map<number, SkillModule> = REGISTERED_SKILL_MODULES,
): number {
  let discovered: Record<string, { readonly default?: SkillModule; readonly skillModule?: SkillModule }>
  if (typeof loaderOrDiscovered === 'function') {
    discovered = loaderOrDiscovered<{ readonly default?: SkillModule; readonly skillModule?: SkillModule }>(
      './impl/**/*.ts',
      { eager: true },
    )
  } else if (loaderOrDiscovered !== undefined && typeof loaderOrDiscovered === 'object') {
    discovered = loaderOrDiscovered
  } else {
    discovered = STATIC_SKILL_MODULES
  }

  for (const mod of Object.values(discovered)) {
    const handler = mod.skillModule ?? mod.default
    if (handler !== undefined && typeof handler.skillId === 'number') {
      targetMap.set(handler.skillId, handler)
    }
  }
  if (targetMap.size === 0) {
    throw new Error('Skill registry initialization failed: zero skill modules discovered from ./impl/**/*.ts')
  }
  return targetMap.size
}

discoverSkillModules(STATIC_SKILL_MODULES, REGISTERED_SKILL_MODULES)

export const SKILL_REGISTRY: ReadonlyMap<number, SkillModule> = REGISTERED_SKILL_MODULES

export function registerSkillModule(mod: SkillModule): void {
  REGISTERED_SKILL_MODULES.set(mod.skillId, mod)
}

export function getRegisteredSkillModule(skillId: number): SkillModule | undefined {
  return REGISTERED_SKILL_MODULES.get(skillId)
}

export function listRegisteredSkillModules(): SkillModule[] {
  return Array.from(REGISTERED_SKILL_MODULES.values()).sort((a, b) => a.skillId - b.skillId)
}

/**
 * Evaluate exact 1.13c numbers (`MinDmg`, `MaxDmg`, `ManaCost`, `ToHit`, `Radius`, `Duration`,
 * `SynergyBonusPct`, `PetMax`, `CooldownFrames`) for any skill from `Skills.txt` + `Missiles.txt`.
 */
/**
 * Which `Skills.txt` calc column a `SrcDam` attack skill feeds into the weapon-damage percent
 * (`D2DamageStrc+0x0C` `dwEnDmgPct`, or `damagepercent` stat #25 on a thrown missile).
 *
 * 1.13c `D2Game.dll` reads the calc column inside each srvstfunc/srvdofunc (skill record
 * `+0x138/+0x13C/+0x140/+0x144` = `calc1..calc4`, evaluated through `0x6FC2AC9A`), so the
 * column is NOT always `calc1`. See `kb/skills/skill-damage-pct-calc-113c.md`.
 *
 * - `calc2`: SrvDo012 Strafe `0x6FC6DCD0` (`[ebp+0x13C]` @ `0x6FC6DE0B`),
 *   SrvDo013 Fend/Zeal/Fury `0x6FC6DAC0` (`[ebp+0x13C]` @ `0x6FC6DBC7` -> `dwEnDmgPct`).
 * - `calc1`: SrvDo007 Jab, SrvDo009 Frenzy (`0x6FC47A10`), SrvDo010 Guided Arrow, SrvDo046 Dragon Claw
 *   (`0x6FCB2A60`), SrvDo067 Charge, SrvDo070 Double Swing (-> `0x6FC473C0`), SrvDo074 Double Throw
 *   (stat #25 on the missile), SrvDo076 Whirlwind, SrvDo078 Leap Attack (`0x6FC47820`);
 *   SrvSt006/007/016/029/032/039/056/058 melee strikes (`[skill+0x138]` -> `dwEnDmgPct`,
 *   St007/St029 via `0x6FCFC530`).
 * - `none`: SrvDo008 Multiple Shot (calc1 = missile count, calc2 = activation frame),
 *   SrvDo034/035 charge-up strikes (no calc read on the hit), SrvSt035 Vengeance (calc1..3 are the
 *   fire/cold/lightning % of weapon damage; `0x6FCFC530` gets skill% = 0), and plain arrow/bolt
 *   skills (SrvSt004 without a damage srvdofunc: Immolation/Freezing Arrow calc1 is a radius).
 * - `unknown`: not reverse-engineered — contributes 0 rather than guessing `calc1`.
 */
export type SkillDamagePctCalc = 'calc1' | 'calc2' | 'none' | 'unknown'

const DMG_PCT_CALC2_SRVDO: ReadonlySet<number> = new Set([12, 13])
const DMG_PCT_CALC1_SRVDO: ReadonlySet<number> = new Set([7, 9, 10, 46, 67, 70, 74, 76, 78, 122])
const DMG_PCT_NONE_SRVDO: ReadonlySet<number> = new Set([8, 34, 35, 44, 48, 54, 116])
const DMG_PCT_CALC1_SRVST: ReadonlySet<number> = new Set([6, 7, 16, 29, 32, 39, 56, 58])
const DMG_PCT_NONE_SRVST: ReadonlySet<number> = new Set([4, 35])

export function resolveSkillDamagePctCalc(
  skill: Pick<SkillRecord, 'srvStFunc' | 'srvDoFunc'>,
): SkillDamagePctCalc {
  if (DMG_PCT_CALC2_SRVDO.has(skill.srvDoFunc)) return 'calc2'
  if (DMG_PCT_CALC1_SRVDO.has(skill.srvDoFunc)) return 'calc1'
  if (DMG_PCT_NONE_SRVDO.has(skill.srvDoFunc)) return 'none'
  if (DMG_PCT_CALC1_SRVST.has(skill.srvStFunc)) return 'calc1'
  if (DMG_PCT_NONE_SRVST.has(skill.srvStFunc)) return 'none'
  // Unmapped SrcDam srvstfunc/srvdofunc (e.g. basic Attack/Throw with empty calc columns):
  // return 'unknown' -> 0 rather than guessing calc1.
  return 'unknown'
}

export function evaluateSkill113c(ctx: SkillEvalContext): SkillEvalResult {
  const customMod = REGISTERED_SKILL_MODULES.get(ctx.skill.id)
  if (customMod?.evaluate) {
    return customMod.evaluate(ctx)
  }
  return evaluateSkillCore113c(ctx)
}

export function evaluateSkillCore113c(ctx: SkillEvalContext): SkillEvalResult {
  const { registry, skill, slvl, blvl, statList } = ctx
  const effLvl = Math.max(1, slvl)
  const calcCtx = {
    registry,
    activeSkill: skill,
    slvl: effLvl,
    blvl,
    ulvl: statList.getAccruedStat('level'),
    getBaseSkillLevel: (id: number) => statList.getBaseSkillLevel(id),
    getEffectiveSkillLevel: (id: number) => statList.getEffectiveSkillLevel(id),
    getUnitStat: (statNameOrId: string | number, baseOnly?: boolean) =>
      statList.getAccruedStat(statNameOrId, baseOnly),
  }

  // 1. Mana cost (`usmc` in 256-fixed-point and integer `manaCost`)
  const { manaCost256, manaCost } = computeSkillManaCost256(skill, effLvl)

  // 2. Attack Rating bonus (`toht`)
  const toHitBonusPct = skill.toHitCalc
    ? evaluateCalc(skill.toHitCalc, calcCtx)
    : skill.toHit + (effLvl - 1) * skill.toHitLev

  // 3. Synergy percentage (`EDmgSymPerCalc` or `DmgSymPerCalc`)
  const eSynPct = skill.eDmgSymPerCalc ? evaluateCalc(skill.eDmgSymPerCalc, calcCtx) : 0
  const physSynPct = skill.dmgSymPerCalc ? evaluateCalc(skill.dmgSymPerCalc, calcCtx) : 0
  // Dragon Claw (`260`) 1.13c synergy: +4% damage per `blvl` in Claw Mastery (`252`) (`Param8=4`)
  const dragonClawSyn =
    skill.id === 260 ? statList.getBaseSkillLevel(252) * (skill.param8 || 4) : 0
  // Cyclone Armor (`235`) 1.13c synergy: +7% absorb per `blvl` in Twister (`240`), Tornado (`245`), Hurricane (`250`) (`Param8=7`)
  const cycloneArmorSyn =
    skill.id === 235
      ? (statList.getBaseSkillLevel(240) +
          statList.getBaseSkillLevel(245) +
          statList.getBaseSkillLevel(250)) *
        (skill.param8 || 7)
      : 0
  const synergyBonusPct = eSynPct !== 0 ? eSynPct : physSynPct + dragonClawSyn + cycloneArmorSyn

  // 4. Physical flat & %ED damage (`MinDam`..`MinLevDam5`, `MaxDam`..`MaxLevDam5`, `calc1`)
  const rawPhysMin = compute5BandScaling(
    effLvl,
    skill.minDam,
    skill.minLevDam1,
    skill.minLevDam2,
    skill.minLevDam3,
    skill.minLevDam4,
    skill.minLevDam5,
  )
  const rawPhysMax = compute5BandScaling(
    effLvl,
    skill.maxDam,
    skill.maxLevDam1,
    skill.maxLevDam2,
    skill.maxLevDam3,
    skill.maxLevDam4,
    skill.maxLevDam5,
  )
  const basePhysMin =
    skill.id === 253 && skill.hitShift > 0 && skill.hitShift < 8
      ? (rawPhysMin << skill.hitShift) >> 8
      : rawPhysMin
  const basePhysMax =
    skill.id === 253 && skill.hitShift > 0 && skill.hitShift < 8
      ? (rawPhysMax << skill.hitShift) >> 8
      : rawPhysMax
  const bashFlatPhys =
    skill.id === 126 ? (skill.calc2 ? evaluateCalc(skill.calc2, calcCtx) : effLvl) : 0
  const physMinScaled = Math.trunc((basePhysMin * (100 + physSynPct)) / 100) + bashFlatPhys
  const physMaxScaled = Math.trunc((basePhysMax * (100 + physSynPct)) / 100) + bashFlatPhys
  // Weapon-damage % column is chosen per srvstfunc/srvdofunc (see `resolveSkillDamagePctCalc`).
  const dmgPctCalc = skill.srcDam > 0 ? resolveSkillDamagePctCalc(skill) : 'none'
  const dmgPctCalcVal =
    dmgPctCalc === 'calc1'
      ? (skill.calc1 ? evaluateCalc(skill.calc1, calcCtx) : 0)
      : dmgPctCalc === 'calc2'
        ? (skill.calc2 ? evaluateCalc(skill.calc2, calcCtx) : 0)
        : 0
  const physDamagePct =
    skill.id === 275 || skill.id === 255
      ? evaluateCalc('ln12', calcCtx) + physSynPct
      : [24, 34, 35].includes(skill.id)
        ? physSynPct
        : dmgPctCalcVal + physSynPct

  // 5. Elemental / Magic / Poison damage (`EMin`..`EMinLev5`, `EMax`..`EMaxLev5`, or primary missile fallback)
  let baseEMin = compute5BandScaling(
    effLvl,
    skill.eMin,
    skill.eMinLev1,
    skill.eMinLev2,
    skill.eMinLev3,
    skill.eMinLev4,
    skill.eMinLev5,
  )
  let baseEMax = compute5BandScaling(
    effLvl,
    skill.eMax,
    skill.eMaxLev1,
    skill.eMaxLev2,
    skill.eMaxLev3,
    skill.eMaxLev4,
    skill.eMaxLev5,
  )
  let elemHitShift = skill.hitShift
  let elemType = skill.eType

  const primaryMissileName =
    skill.srvMissile ||
    skill.srvMissileA ||
    skill.cltMissile ||
    skill.cltMissileA ||
    (skill.id === 22
      ? 'guidedarrow'
      : skill.id === 12 || skill.id === 26
        ? 'arrow'
        : skill.id === 2 || skill.id === 4
          ? 'javelin'
          : '')
  if (baseEMin === 0 && baseEMax === 0 && primaryMissileName) {
    const msl = registry.getMissileByName(primaryMissileName)
    if (msl && (msl.eMin > 0 || msl.eMax > 0)) {
      baseEMin = compute5BandScaling(
        effLvl,
        msl.eMin,
        msl.eMinLev1,
        msl.eMinLev2,
        msl.eMinLev3,
        msl.eMinLev4,
        msl.eMinLev5,
      )
      baseEMax = compute5BandScaling(
        effLvl,
        msl.eMax,
        msl.eMaxLev1,
        msl.eMaxLev2,
        msl.eMaxLev3,
        msl.eMaxLev4,
        msl.eMaxLev5,
      )
      elemHitShift = msl.hitShift
      if (!elemType) elemType = msl.eType
    }
  }

  const rawMin256 = baseEMin << elemHitShift
  const rawMax256 = baseEMax << elemHitShift
  const minElemDmg256 = Math.trunc((rawMin256 * (100 + eSynPct)) / 100)
  const maxElemDmg256 = Math.trunc((rawMax256 * (100 + eSynPct)) / 100)

  // 6. Duration (`auralencalc` or `ELen`..`ELevLen3` or 1.13c Assassin combo charge 375 frames)
  let elemDurationFrames = 0
  if (skill.eLen > 0 || skill.eLevLen1 > 0) {
    const baseLen = compute3BandDuration(effLvl, skill.eLen, skill.eLevLen1, skill.eLevLen2, skill.eLevLen3)
    const lenSyn = skill.eLenSymPerCalc ? evaluateCalc(skill.eLenSymPerCalc, calcCtx) : 0
    const rawDur = Math.trunc((baseLen * (100 + lenSyn)) / 100)
    elemDurationFrames = skill.id === 139 ? Math.min(250, rawDur) : rawDur
  } else if (primaryMissileName) {
    const msl = registry.getMissileByName(primaryMissileName)
    if (msl && (msl.eLen > 0 || msl.eLevLen1 > 0)) {
      elemDurationFrames = compute3BandDuration(effLvl, msl.eLen, msl.eLevLen1, msl.eLevLen2, msl.eLevLen3)
    }
  }
  let durationFrames = 0
  const aiCurseDiv = resolveAiCurseDivisor(ctx.difficulty)
  if (skill.id === 147) {
    // 1.13c Frenzy (#147): base 150 frames (Param5=150, 6.0s) + 10 frames (0.4s) per hard point in Increased Stamina (#141)
    durationFrames = (skill.param5 || 150) + statList.getBaseSkillLevel(141) * 10
  } else if (skill.id === 130) {
    // 1.13c Howl (#130): calc2 = ln56 (75 + 25*(slvl-1)), AICurse divisor 1/2/4
    durationFrames = Math.floor(evaluateCalc('ln56', calcCtx) / aiCurseDiv)
  } else if (skill.id === 154) {
    // 1.13c War Cry (#154): calc1 = min(250, ln12) (min(250, 25 + 5*(slvl-1)))
    durationFrames = Math.min(250, evaluateCalc('ln12', calcCtx))
  } else if (skill.auraLenCalc) {
    durationFrames = evaluateCalc(skill.auraLenCalc, calcCtx)
    if (ctx.difficulty !== undefined && [71, 77, 81, 86, 130, 146, 150].includes(skill.id)) {
      durationFrames = Math.floor(durationFrames / aiCurseDiv)
    }
  } else if (elemDurationFrames > 0) {
    durationFrames = elemDurationFrames
  } else if (skill.progressive) {
    // 1.13c Assassin Martial Arts charge duration (`Param3 = 375` frames = 15s)
    durationFrames = skill.param3 || 375
  }

  // 7. Radius (`aurarangecalc` or `calc2`/`Param1`)
  // Warcries #138 (Shout), #149 (Battle Orders), #155 (Battle Command): Missiles.txt Vel=16, Range=16 -> 256/24 = 10.67 subtiles.
  // Warcries #146 (Battle Cry), #154 (War Cry): Missiles.txt Vel=16, Range=8 -> 128/24 = 5.33 subtiles.
  // Single-target melee / corpse skills (#131, #137, #142, #254, #255, #260, #265) have 0 radius.
  const isSingleTargetMelee = [131, 137, 142, 254, 255, 260, 265].includes(skill.id)
  const radiusSubtiles = skill.auraRangeCalc
    ? evaluateCalc(skill.auraRangeCalc, calcCtx)
    : isSingleTargetMelee
      ? 0
      : [138, 149, 155].includes(skill.id)
        ? 10.67
        : [146, 154].includes(skill.id)
          ? 5.33
          : skill.id === 249 || skill.id === 250 || skill.id === 244
            ? skill.param3
            : skill.id === 229
              ? skill.param1
              : skill.id === 245
                ? skill.param2
                : skill.param1 > 0 && skill.param2 > 0
                  ? evaluateCalc('ln12', calcCtx)
                  : 0

  // 8. State & Curse type
  const stateName = skill.auraTgtState || skill.auraState || skill.passiveState || skill.state1
  const stateRec = stateName ? registry.getStateByName(stateName) : undefined
  const curseType = stateRec
    ? stateRec.curse
      ? stateRec.id === 57
        ? 2
        : 1
      : 0
    : skill.id === 86
      ? 2
      : skill.srvDoFunc === 30 || skill.id === 150
        ? 1
        : 0

  // 9. Pet max
  const petMax = skill.petMax
    ? Math.max(1, evaluateCalc(skill.petMax, calcCtx))
    : skill.petType.toLowerCase() === 'assassintrap'
      ? 5
      : skill.summon
        ? 1
        : 0

  // 10. Cooldown (`delay` in frames, e.g. Hydra 40 frames in 1.13c)
  const cooldownFrames = skill.delay ? evaluateCalc(skill.delay, calcCtx) : 0

  // 1.13c `EType = pois`: `minElemDmg256` / `maxElemDmg256` are per-frame 1/256 poison bitrates
  // (`D2Common.dll` `SKILLS_GetElementalMinDamage` `0x6FDA0360`), while total poison damage over `ELen`
  // (`SKILLS_GetElementalLength` `0x6FDA0460`) is `(bitrate256 * ELen) >> 8`.
  const poisonFrames = elemType === 'pois' ? (elemDurationFrames || durationFrames) : 0
  const minElemDmg =
    poisonFrames > 0 ? Math.floor((minElemDmg256 * poisonFrames) / FIXED_ONE) : minElemDmg256 >> 8
  const maxElemDmg =
    poisonFrames > 0 ? Math.floor((maxElemDmg256 * poisonFrames) / FIXED_ONE) : maxElemDmg256 >> 8

  return {
    skillId: skill.id,
    name: skill.name,
    charClass: skill.charClass || 'uni',
    slvl: effLvl,
    blvl,
    manaCost,
    manaCost256,
    toHitBonusPct,
    physDamagePct,
    srcDam: skill.srcDam,
    minPhysDmg: physMinScaled,
    maxPhysDmg: physMaxScaled,
    elemType: elemType || (skill.srcDam > 0 ? 'phys' : 'mag'),
    minElemDmg,
    maxElemDmg,
    minElemDmg256,
    maxElemDmg256,
    durationFrames,
    radiusSubtiles,
    missileA: primaryMissileName,
    auraState: stateName,
    curseType,
    summonMon: skill.summon,
    petMax,
    synergyBonusPct,
    cooldownFrames,
  }
}

/**
 * Execute any of the 221 player skills (`210` class skills + `11` universal skills) or `17` pet sub-skills
 * in the 1.13c runtime (`srvdofunc` + `srvmissile` + `States.txt` + `PetType.txt` + `SUnitDmg`).
 */
export function executeSkill113c(ctx: SkillExecContext): SkillExecOutcome {
  const customMod = REGISTERED_SKILL_MODULES.get(ctx.skill.id)
  if (customMod?.executeDo) {
    return customMod.executeDo(ctx)
  }
  return executeSkillCore113c(ctx)
}

export function executeSkillCore113c(ctx: SkillExecContext): SkillExecOutcome {
  const { skill, caster, targetPositions, auraScanner, summonManager } = ctx
  const skillRng = resolveSkillRng(ctx)
  const targets = ctx.targets ?? []
  const corpses = ctx.corpses ?? []
  const missileEngine = ctx.missileEngine ?? new MissileEngine(ctx.registry)
  const currentTick = ctx.currentTick ?? 0
  const targetX = ctx.targetX ?? caster.x ?? 0
  const targetY = ctx.targetY ?? caster.y ?? 0
  const evalResult =
    ctx.evalResult ??
    evaluateSkill113c({
      registry: ctx.registry,
      skill,
      slvl: Math.max(1, caster.statList.getEffectiveSkillLevel(skill.id)),
      blvl: caster.statList.getBaseSkillLevel(skill.id),
      statList: caster.statList,
    })
  const missilesSpawned: string[] = []
  const statesApplied: string[] = []
  const petsSummoned: string[] = []
  let corpsesConsumed = 0
  let totalDamageDealt = 0
  const notes: string[] = []

  // Edge Case #5: When `srvDoFunc === 0` and `srvMissile` is set (`Fire Ball` 47, `Fire Bolt` 36,
  // `Magic Arrow` 6, `Bone Spear` 84, `Frozen Orb` 64, `Lightning Fury` 35, `Holy Bolt` 101, etc.),
  // `D2Game` executes `SKILLS_SrvDoDefaultMissile` (mapped to `srvDoFunc = 68` missile launch).
  const effectiveDoFunc =
    skill.srvDoFunc === 0 && (skill.srvMissile !== '' || skill.srvMissileA !== '')
      ? 68
      : skill.srvDoFunc

  // Pre-Cast Town Restriction Check (1.13c Ground Truth: Skills.txt InTown column)
  if (ctx.isTown === true && !skill.inTown) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      error: 'cannot_cast_in_town',
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['cannot_cast_in_town'],
    }
  }

  // Pre-Cast Delirium Morph Restriction (1.13c Ground Truth: States.txt id=177 restrict=2, Skills.txt restrict column)
  const hasDeleriumMorph =
    Boolean(caster.stateBus?.hasState('delerium')) ||
    Boolean(caster.stateBus?.hasState('delirium')) ||
    Boolean(caster.stateBus?.hasState(177))
  if (hasDeleriumMorph && skill.id !== 0 && skill.id !== 350 && skill.restrict !== 1) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      error: 'invalid_form',
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['blocked_by_delerium_form_restriction'],
    }
  }

  // Left Hand Swing (#5): requires an equipped off-hand weapon (1.13c Ground Truth: SKILLS_SrvSt01_Attack_LeftHandSwing)
  if (skill.id === 5 && caster.hasOffHandWeapon === false) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      error: 'no_offhand_weapon',
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['no_offhand_weapon'],
    }
  }

  // SrvSt Pre-Cast Equipment Guards with Tri-State Semantics (1.13c Ground Truth: D2Game SkillPal.cpp:1099, 170, 71)
  if ((skill.id === 97 || skill.id === 117) && caster.hasShield === false) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['fail: requires equipped shield'],
    }
  }

  if (
    (skill.id === 96 ||
      skill.id === 106 ||
      skill.id === 107 ||
      skill.id === 111 ||
      skill.id === 116) &&
    (caster.weaponItemType === 'bow' ||
      (caster as any).weaponItemType === 'crossbow' ||
      (caster as any).weaponItemType === 'abow' ||
      (caster as any).weaponItemType === 'xbow' ||
      caster.isRanged === true)
  ) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['fail: requires melee weapon'],
    }
  }

  // 1.13c Poison Dagger (#73): Skills.txt row 73 itypea1 = 'knif' (weapsel = 0)
  // Requires an equipped dagger/knife melee weapon; rejects bows/swords/wands/ranged weapons.
  const pdWeaponType = (caster.weaponItemType ?? (caster as any).weaponType) as string | undefined
  if (
    skill.id === 73 &&
    ((pdWeaponType !== undefined &&
      pdWeaponType !== 'knif' &&
      pdWeaponType !== 'dagger' &&
      pdWeaponType !== 'dagg' &&
      pdWeaponType !== 'tkni') ||
      caster.isRanged === true)
  ) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned: [],
      statesApplied: [],
      petsSummoned: [],
      corpsesConsumed: 0,
      totalDamageDealt: 0,
      notes: ['fail: requires equipped dagger'],
      error: 'requires_dagger',
    }
  }

  // Druid Shapeshifting Form Pre-Cast Guards (1.13c Ground Truth: D2Game SkillDruid.cpp)
  if (skill.charClass === 'dru' || (skill.id >= 221 && skill.id <= 250)) {
    const currentForm: 'human' | 'wolf' | 'bear' =
      caster.stateBus?.hasState('wolf')
        ? 'wolf'
        : caster.stateBus?.hasState('bear')
          ? 'bear'
          : 'human'
    if (!canCastDruidSkill(currentForm, skill.id)) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [`fail: cannot cast ${skill.name} in ${currentForm} form`],
        error: 'invalid_form',
      }
    }
  }

  // 1. Passive skills (`passive === true`)
  if (skill.passive) {
    const pState = skill.passiveState || `passive_${skill.name.toLowerCase().replace(/\s+/g, '_')}`
    const stats: Record<string, number> = {}
    const calcCtx = {
      registry: ctx.registry,
      activeSkill: skill,
      slvl: evalResult.slvl,
      blvl: evalResult.blvl,
      getBaseSkillLevel: (id: number) => caster.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => caster.statList.getEffectiveSkillLevel(id),
    }
    for (const [st, clc] of [
      [skill.passiveStat1, skill.passiveCalc1],
      [skill.passiveStat2, skill.passiveCalc2],
      [skill.passiveStat3, skill.passiveCalc3],
      [skill.passiveStat4, skill.passiveCalc4],
      [skill.passiveStat5, skill.passiveCalc5],
    ] as const) {
      if (st && clc) stats[st.toLowerCase()] = evaluateCalc(clc, calcCtx)
    }
    // Barbarian Weapon Masteries (`127..129`, `134..136`) & Assassin Claw Mastery (`252`): 1.13c critical strike `dm56`
    if ([127, 128, 129, 134, 135, 136, 252].includes(skill.id)) {
      const critVal = evaluateCalc('dm56', calcCtx)
      stats['passive_mastery_crit'] = critVal
      if (skill.id === 252) {
        stats['passive_mastery_melee_crit'] = critVal
      }
    }
    // Skill #263 Weapon Block: unify `passive_weaponblock` and `weaponblock`
    if (skill.id === 263) {
      const wbVal = evaluateCalc('dm12', calcCtx)
      stats['passive_weaponblock'] = wbVal
      stats['weaponblock'] = wbVal
    }
    // Skill #141 Increased Stamina: 1.13c passivestat1=item_maxstamina_percent & passivestat2=staminarecoverybonus (both ln12)
    if (skill.id === 141) {
      stats['staminarecoverybonus'] = evaluateCalc('ln12', calcCtx)
    }
    caster.stateBus.applyState({
      stateNameOrId: pState,
      sourceUnitId: caster.id,
      sourceSkillId: skill.id,
      slvl: evalResult.slvl,
      stats,
    })
    statesApplied.push(pState)
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: 0,
      manaSpent256: 0,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes: ['passive_attached'],
    }
  }

  // 2. Unsummon (`skillId = 3`, `srvDoFunc = 4`)
  if (skill.id === 3 || effectiveDoFunc === 4) {
    const rawTarget = targets[0]
    const isDefaultArenaDummy =
      rawTarget !== undefined &&
      String(rawTarget.id).startsWith('dummy-') &&
      rawTarget.petType === undefined &&
      rawTarget.petOwnerId === undefined &&
      rawTarget.unsummonable === undefined
    const target = isDefaultArenaDummy ? undefined : rawTarget

    if (target) {
      if (target.petOwnerId !== undefined && String(target.petOwnerId) !== String(caster.id)) {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'invalid_pet_owner',
          srvDoFuncUsed: 4,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'invalid_pet_owner'],
        }
      }
      if (target.unsummonable === false || target.petType === 'raven') {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'pet_not_unsummonable',
          srvDoFuncUsed: 4,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'pet_not_unsummonable'],
        }
      }
    }

    const dismissed = summonManager.unsummonPet(caster.id, target?.petType, target?.id)
    if (!dismissed) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'no_pet_to_unsummon',
        srvDoFuncUsed: 4,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'no_pet_to_unsummon'],
      }
    }
    notes.push(`unsummoned:${dismissed.monId}`, `unsummoned_${dismissed.petType}`)
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: 4,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 3. Summons, Golems, Traps, Hydras, Vines, Spirits, Shadows, Decoy, Valkyrie, Bone Wall/Prison
  // (#257 Blade Sentinel is handled as a patrolling missile skill via SrvDoFunc 44, not a ground sentry pet)
  const isSummonSkill =
    (skill.summon !== '' && skill.id !== 257) ||
    [15, 16, 31, 45, 49, 56, 57, 58, 60, 62, 114, 115, 119, 144].includes(effectiveDoFunc)
  if (isSummonSkill) {
    const countToCreate = skill.id === 62 ? 3 : skill.id === 78 || skill.id === 88 ? 3 : 1
    for (let i = 0; i < countToCreate; i += 1) {
      const res = summonManager.createPet({
        owner: caster,
        skillId: skill.id,
        slvl: evalResult.slvl,
        x: targetX + i * 16,
        y: targetY,
        ...(ctx.difficulty !== undefined ? { difficulty: ctx.difficulty } : {}),
        ...(i === 0 ? { corpses } : {}),
      })
      if (res.created && res.pet) {
        petsSummoned.push(res.pet.monId)
        if (skill.id === 70 || skill.id === 80 || skill.id === 95) {
          corpsesConsumed += 1
        }
      }
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: petsSummoned.length > 0,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 4. Paladin / Druid Auras (`aura === true` or `srvDoFunc === 65, 66, 81, 82`)
  if (skill.aura || [65, 66, 81, 82].includes(effectiveDoFunc)) {
    const src = auraScanner.setActiveAura(caster, skill.id, evalResult.slvl, currentTick)
    if (src) {
      const pulseAllies = ctx.allies ?? [caster]
      const pulse = auraScanner.pulseAura(
        src,
        currentTick,
        pulseAllies,
        targets,
        corpses,
        ctx.isTown !== undefined ? { isTown: ctx.isTown } : undefined,
      )
      totalDamageDealt += pulse.pulseDamageDealt
      corpsesConsumed += pulse.corpsesRedeemed
      statesApplied.push(skill.auraState || skill.auraTgtState || skill.name.toLowerCase())
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 5. Corpse Explosion (`74` / `312` `srvDoFunc = 55`), Poison Explosion (`83` `srvDoFunc = 63`),
  //    Find Potion (`131` `69`), Find Item (`142` `72`), Grim Ward (`150` `75`)
  if ([55, 63, 69, 72, 75].includes(effectiveDoFunc)) {
    const isBarbCorpseSkill = [69, 72, 75].includes(effectiveDoFunc)
    const availCorpse = corpses.find(c =>
      isBarbCorpseSkill ? validateBarbarianCorpseTarget(skill.id, c as any).valid : !c.consumed
    )
    if (availCorpse) {
      availCorpse.consumed = true
      corpsesConsumed += 1
      if (effectiveDoFunc === 55) {
        // 1.13c Corpse Explosion (SKILLS_SrvDo055_CorpseExplosion 0x6FD10DC0):
        // Marks STATE_CORPSE_NODRAW (104), scales corpseBaseHp when casterLevel < corpseLevel,
        // and deals 70%–120% of base monster HP (50% Phys in inner ring + 50% Fire in outer ring).
        availCorpse.stateId = 104
        notes.push('corpse_state:104_corpse_nodraw')
        const casterLevel = caster.statList.getAccruedStat('level') || undefined
        const corpseLevel = availCorpse.monsterLevel
        for (const t of targets) {
          if (t.statList.getHp256() <= 0) continue
          const ampPierceStat = t.statList.getModifierBonus('amplify_phys_pierce')
          const amplifyDamagePierce =
            ampPierceStat > 0
              ? ampPierceStat
              : t.stateBus?.hasState('amplifydamage')
                ? 100
                : t.stateBus?.hasState('decrepify')
                  ? 50
                  : 0
          const distSubtiles = (t as { distanceSubtiles?: number }).distanceSubtiles
          const ce = computeCorpseExplosion113c({
            corpseBaseHp: availCorpse.baseMaxHp ?? 1000,
            targetPhysRes: t.statList.getAccruedStat('damageresist'),
            targetFireRes: t.statList.getAccruedStat('fireresist'),
            convictionPierce: t.statList.getModifierBonus('conviction_pierce'),
            lowerResistPierce: t.statList.getModifierBonus('lowerresist_pierce'),
            amplifyDamagePierce,
            casterLevel,
            corpseLevel,
            slvl: evalResult.slvl,
            distanceSubtiles: distSubtiles,
            rng: skillRng,
          })
          const dmg256 = ce.finalTotalDamage * FIXED_ONE
          t.statList.setHp256(t.statList.getHp256() - dmg256)
          totalDamageDealt += ce.finalTotalDamage
        }
      } else if (effectiveDoFunc === 63) {
        // 1.13c Poison Explosion (SKILLS_SrvDo063_PoisonExplosion 0x6FD12600):
        // Marks STATE_CORPSE_NOSELECT (118) (corpse sprite stays visible with poisoncorpse overlay)
        // and spawns poisonexplosioncloud (srvDoFunc=8 spawns 8 radial clouds).
        availCorpse.stateId = 118
        notes.push('corpse_state:118_corpse_noselect')
        const peDurationFrames = evalResult.durationFrames || (50 + (evalResult.slvl - 1) * 10)
        const msl = missileEngine.spawnMissile({
          missileNameOrId: skill.srvMissile || 'poisonexplosioncloud',
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          owner: caster,
          startX: targetX,
          startY: targetY,
          targetX,
          targetY,
          dmgPacket: {
            skillId: skill.id,
            attackKind: 'spell',
            elemType: 'pois',
            elemMin256: evalResult.minElemDmg256 * peDurationFrames,
            elemMax256: evalResult.maxElemDmg256 * peDurationFrames,
            elemDurationFrames: peDurationFrames,
            autoHit: true,
          },
        })
        if (msl) missilesSpawned.push(msl.name)
        for (const t of targets) {
          if (t.statList.getHp256() <= 0) continue
          const poisOut = executeSUnitDmg(caster, t, {
            skillId: skill.id,
            attackKind: 'spell',
            srcDam: 0,
            elemType: 'pois',
            elemMin256: evalResult.minElemDmg256 * peDurationFrames,
            elemMax256: evalResult.maxElemDmg256 * peDurationFrames,
            elemDurationFrames: peDurationFrames,
            autoHit: true,
          }, skillRng)
          totalDamageDealt += poisOut.totalDamage
          if (t.stateBus) {
            t.stateBus.applyState({
              stateNameOrId: 'poison',
              sourceUnitId: String(caster.id),
              sourceSkillId: skill.id,
              slvl: evalResult.slvl,
              durationFrames: peDurationFrames,
            })
            if (!statesApplied.includes('poison')) statesApplied.push('poison')
          }
        }
      } else if (effectiveDoFunc === 75) {
        // 1.13c Grim Ward (#150, SKILLS_SrvDo075_GrimWard 0x6FC4CF30):
        // Marks STATE_CORPSE_NODRAW (104) + STATE_CORPSE_NOSELECT (118), spawns size-matched totem (1000 frames),
        // and pulses fear (terror) within 3 + (slvl - 1) subtiles for 60 / aiCurseDiv frames.
        availCorpse.stateId = 104
        ;(availCorpse as { noSelect?: boolean }).noSelect = true
        notes.push('corpse_state:104_118_grim_ward')
        notes.push('totem_life:1000')
        const corpseSize = (availCorpse as { sizeX?: number }).sizeX ?? 2
        const totemMissileName =
          corpseSize === 1 ? 'grimwardsmall' : corpseSize === 3 ? 'grimwardlarge' : 'grimwardmedium'
        const msl = missileEngine.spawnMissile({
          missileNameOrId: totemMissileName,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          owner: caster,
          startX: availCorpse.x ?? targetX,
          startY: availCorpse.y ?? targetY,
          targetX: availCorpse.x ?? targetX,
          targetY: availCorpse.y ?? targetY,
          maxRangeTicks: 1000,
        })
        if (msl) missilesSpawned.push(msl.name)
        const gwFleeDuration = evalResult.durationFrames || Math.floor(60 / resolveAiCurseDivisor(ctx.difficulty))
        const gwRadius = evalResult.radiusSubtiles || (3 + (evalResult.slvl - 1))
        const wardX = availCorpse.x ?? targetX
        const wardY = availCorpse.y ?? targetY
        for (const t of targets) {
          if (t.statList.getHp256() <= 0) continue
          if (t.unitType !== 'player' && !canMonsterTargetBeCursed113c(t as never)) continue
          if (t.isBoss || t.isChampion || t.rank === 'boss' || t.rank === 'champion' || t.rank === 'unique' || (t.statList.getAccruedStat('is_boss') > 0)) {
            continue
          }
          const tPos = targetPositions?.get(t.id) ?? ((t as { x?: number; y?: number }).x !== undefined ? { x: (t as { x: number }).x, y: (t as { y: number }).y } : undefined)
          if (tPos && Math.hypot(tPos.x - wardX, tPos.y - wardY) > gwRadius) {
            continue
          }
          t.stateBus.applyState({
            stateNameOrId: 'terror',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: gwFleeDuration,
          })
          statesApplied.push('terror')
        }
      } else if (effectiveDoFunc === 69) {
        // 1.13c Find Potion (#131, SKILLS_SrvDo069_FindPotion 0x6FC4CC20):
        // Marks STATE_CORPSE_NOSELECT (118) and rolls dm(0, 100, slvl) against gdwPotionsTable[act + 5 * difficulty].
        availCorpse.stateId = 118
        ;(availCorpse as { noSelect?: boolean }).noSelect = true
        notes.push('corpse_state:118_corpse_noselect')
        const roll = rollSkill100(ctx)
        const typeRoll = rollSkill100(ctx)
        const actNum = (ctx as { act?: number }).act ?? 0
        const diffNum =
          ctx.difficulty === 2 || ctx.difficulty === 'hell'
            ? 2
            : ctx.difficulty === 1 || ctx.difficulty === 'nightmare'
              ? 1
              : 0
        const dropRes = rollFindPotionDrop113c(evalResult.slvl, actNum, diffNum, roll, typeRoll)
        if (dropRes.dropped && dropRes.potionCode) {
          notes.push('potion_found')
          notes.push(`potion_drop:${dropRes.potionCode}`)
        } else {
          notes.push('hork_failed')
        }
      } else if (effectiveDoFunc === 72) {
        // 1.13c Find Item (#142, SKILLS_SrvDo072_FindItem 0x6FC4CE10):
        // Marks STATE_CORPSE_NOSELECT (118) and rolls dm(5, 60, slvl) for a NoDrop=0 TC drop.
        availCorpse.stateId = 118
        ;(availCorpse as { noSelect?: boolean }).noSelect = true
        notes.push('corpse_state:118_corpse_noselect')
        const dropChancePct = computeDiminishingReturns(5, 60, evalResult.slvl)
        const roll = rollSkill100(ctx)
        if (roll < dropChancePct) {
          notes.push('item_found')
          notes.push('nodrop_zero_tc_drop')
        } else {
          notes.push('hork_failed')
        }
      }
    } else if (isBarbCorpseSkill && corpses.length > 0) {
      const check = validateBarbarianCorpseTarget(skill.id, corpses[0] as any)
      if (check.reason) notes.push(`corpse_invalid:${check.reason}`)
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: corpsesConsumed > 0,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 6. Curses & AoE Debuffs (`srvDoFunc = 6, 30, 47, 59, 61, 71`)
  if ([6, 30, 47, 59, 61, 71].includes(effectiveDoFunc)) {
    // Cloak of Shadows (Skill 264, srvDoFunc = 47) recast lockout & self-buff
    if (skill.id === 264) {
      if (
        caster.stateBus.hasState('cloak_of_shadows') ||
        caster.stateBus.hasState(153)
      ) {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'already_active',
          srvDoFuncUsed: effectiveDoFunc,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'cloak_of_shadows_already_active'],
        }
      }
      const cosDuration = evalResult.durationFrames || (200 + 25 * (evalResult.slvl - 1))
      caster.stateBus.applyState({
        stateNameOrId: skill.auraState || 'cloak_of_shadows',
        sourceUnitId: caster.id,
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        durationFrames: cosDuration,
        currentFrame: currentTick,
        stats: {
          item_armor_percent: 10 + 3 * (evalResult.slvl - 1),
          skill_armor_percent: 10 + 3 * (evalResult.slvl - 1),
        },
      })
      statesApplied.push('cloak_of_shadows')
    }

    const difficulty: 'normal' | 'nightmare' | 'hell' =
      ctx.difficulty === 2 || ctx.difficulty === 'hell'
        ? 'hell'
        : ctx.difficulty === 1 || ctx.difficulty === 'nightmare'
          ? 'nightmare'
          : 'normal'
    const curseEffect = [66, 71, 72, 76, 77, 81, 82, 86, 87, 91].includes(skill.id)
      ? calculateCurseEffect(skill.id, evalResult.slvl, { difficulty })
      : undefined

    const curseState =
      skill.id === 264
        ? (skill.auraTgtState || 'cloaked')
        : (curseEffect?.stateName ||
          skill.auraTgtState ||
          skill.auraState ||
          (skill.id === 86 ? 'attract' : skill.id === 81 ? 'confuse' : skill.name.toLowerCase().replace(/\s+/g, '')))

    const calcCtx = {
      registry: ctx.registry,
      activeSkill: skill,
      slvl: evalResult.slvl,
      blvl: evalResult.blvl,
      getBaseSkillLevel: (id: number) => caster.statList.getBaseSkillLevel(id),
      getEffectiveSkillLevel: (id: number) => caster.statList.getEffectiveSkillLevel(id),
    }
    const debuffStats: Record<string, number> = curseEffect ? { ...curseEffect.debuffStats } : {}
    if (skill.id === 66 && !debuffStats['amplify_phys_pierce']) debuffStats['amplify_phys_pierce'] = 100
    if (skill.id === 87 && !debuffStats['amplify_phys_pierce']) {
      debuffStats['amplify_phys_pierce'] = 50
      debuffStats['item_slow'] = 50
    }
    if (skill.id === 91 && !debuffStats['lowerresist_pierce']) {
      debuffStats['lowerresist_pierce'] = evaluateCalc('dm56', calcCtx)
    }
    if (skill.id === 137) {
      const tauntDebuff = -(5 + (evalResult.slvl - 1) * 2)
      debuffStats['tohit_percent'] = tauntDebuff
      debuffStats['item_tohit_percent'] = tauntDebuff
      debuffStats['damagepercent'] = tauntDebuff
      debuffStats['item_mindamage_percent'] = tauntDebuff
      debuffStats['item_maxdamage_percent'] = tauntDebuff
    }
    if (skill.id === 8) {
      debuffStats['armorclass'] = -evaluateCalc('edmn', calcCtx)
      debuffStats['item_light'] = 3
    }
    if (skill.id === 17) {
      debuffStats['skill_handofathena'] = skill.param1 || 33
      debuffStats['item_light'] = 3
    }
    if (skill.id === 264) {
      const cosDebuff = -Math.min(15 + 3 * (evalResult.slvl - 1), 95)
      debuffStats['skill_armor_percent'] = cosDebuff
      debuffStats['item_armor_percent'] = cosDebuff
    }

    for (const t of targets) {
      if (t.statList.getHp256() <= 0) continue
      // 1.13c 0x6FC6ECD0 / D2Common_11085 (0x6FD81200): buildings, structures, traps, and non-walking monsters (mWL == 0) cannot be cursed
      if (t.unitType !== 'player' && !canMonsterTargetBeCursed113c(t as never)) continue

      // Cloak of Shadows (#264): 30 sub-tiles (20 yards) radius check if target coordinates are explicitly set beyond 30 subtiles
      if (skill.id === 264) {
        const tPos =
          targetPositions?.get(t.id) ??
          ((t as { x?: number; y?: number }).x !== undefined && (t as { x?: number; y?: number }).y !== undefined
            ? { x: (t as { x: number }).x, y: (t as { y: number }).y }
            : undefined)
        const cPos =
          targetPositions?.get(caster.id) ??
          (caster.x !== undefined && caster.y !== undefined ? { x: caster.x, y: caster.y } : { x: targetX, y: targetY })
        if (tPos && cPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > 30) {
          continue
        }
      }

      // 1.13c Rule: Bosses & Champions are IMMUNE to mental curses (Dim Vision 71, Terror 77, Confuse 81, Attract 86, Taunt 137)
      const isBossOrChamp = Boolean(
        t.isBoss ||
        t.isChampion ||
        (t as { isUnique?: boolean }).isUnique ||
        (t as { isSuperUnique?: boolean }).isSuperUnique ||
        t.rank === 'boss' ||
        t.rank === 'champion' ||
        t.rank === 'unique' ||
        (t.statList.getAccruedStat('is_boss') > 0)
      )
      if ([71, 77, 81, 86, 137].includes(skill.id) && isBossOrChamp) {
        continue
      }

      const targetDebuffStats: Record<string, number> =
        skill.id === 264 && !isBossOrChamp
          ? { ...debuffStats, ai_blind: 1 }
          : { ...debuffStats }
      if (skill.id === 264) {
        ;(t as { aiBlind?: boolean }).aiBlind = !isBossOrChamp
      }

      const res = t.stateBus.applyState({
        stateNameOrId: curseState,
        sourceUnitId: caster.id,
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        durationFrames:
          skill.id === 137
            ? 0 // 1.13c Taunt (#137): permanent until overwritten by another curse or death
            : curseEffect
              ? curseEffect.durationFrames
              : (evalResult.durationFrames || (skill.id === 264 ? 200 + 25 * (evalResult.slvl - 1) : 250)),
        currentFrame: currentTick,
        stats: targetDebuffStats,
      })
      if (res.applied) {
        statesApplied.push(res.stateName)
      }
      if (skill.id === 137 && res.applied) {
        ;(t as { aiMode?: string; forcedTargetId?: string }).aiMode = 'walk_melee'
        ;(t as { aiMode?: string; forcedTargetId?: string }).forcedTargetId = caster.id
        notes.push('ai_override:walk_melee')
        break // 1.13c Taunt (#137, SKILLS_SrvDo070_Taunt): single-target curse
      }
      if (skill.id === 86 && res.applied) {
        // 1.13c SKILLS_SrvDo059_Attract (0x6FC71C60) + sub_6FD0BC60:
        // Redirect nearby hostile monsters within 9 subtiles (6.0 yards) to target the Attracted victim
        const tCoord = t as { x?: number; y?: number }
        const attractVictimPos =
          targetPositions?.get(t.id) ??
          (tCoord.x !== undefined && tCoord.y !== undefined ? { x: tCoord.x, y: tCoord.y } : { x: targetX, y: targetY })
        for (const other of targets) {
          if (other.id === t.id || other.statList.getHp256() <= 0 || other.unitType === 'player') continue
          if (!canMonsterTargetBeCursed113c(other as never)) continue
          const oCoord = other as { x?: number; y?: number }
          const otherPos =
            targetPositions?.get(other.id) ??
            (oCoord.x !== undefined && oCoord.y !== undefined ? { x: oCoord.x, y: oCoord.y } : undefined)
          if (otherPos && Math.hypot(otherPos.x - attractVictimPos.x, otherPos.y - attractVictimPos.y) > 9) {
            continue
          }
          ;(other as { attractTargetId?: string }).attractTargetId = t.id
          notes.push(`attract_aggro_redirect:${other.id}->${t.id}`)
        }
        break // Attract targets a single monster
      }
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 7. Self/Ally Buffs & Shapeshift Toggles (`srvDoFunc = 18, 23, 25, 29, 54, 116`)
  if ([18, 23, 25, 29, 54, 116].includes(effectiveDoFunc)) {
    // Skill 350: Delerium Change (`srvDoFunc = 116`, `aurastate = delerium`, States.txt id=177)
    if (skill.id === 350) {
      if (
        caster.stateBus.hasState('delerium') ||
        caster.stateBus.hasState('delirium') ||
        caster.stateBus.hasState(177)
      ) {
        caster.stateBus.removeState('delerium')
        caster.stateBus.removeState('delirium')
        caster.stateBus.removeState(177)
        notes.push('state_toggled_off:delerium')
        return {
          skillId: skill.id,
          name: skill.name,
          executed: true,
          srvDoFuncUsed: effectiveDoFunc,
          manaSpent256: evalResult.manaCost256,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes,
        }
      }
    }

    // Skill 223 (Werewolf) & Skill 228 (Werebear): 1.13c SKILLS_SrvDo116_Transform_Wearwolf_Wearbear (0x6FC665C0)
    // Toggling off when already in the matching form costs 0 mana (nocostinstate = 1), clears feralrage/maul,
    // and clamps current HP to [256, maxHp256] (1-HP survival floor on unshift).
    if (
      skill.id === 223 &&
      (caster.stateBus.hasState('wolf') || caster.stateBus.hasState('wearwolf') || caster.stateBus.hasState(139))
    ) {
      caster.stateBus.removeState('wolf')
      caster.stateBus.removeState('wearwolf')
      caster.stateBus.removeState(139)
      caster.stateBus.removeState('feralrage')
      caster.stateBus.removeState(120)
      caster.stateBus.removeState('maul')
      caster.stateBus.removeState(117)
      if (caster.statList.getHp256() > 0) {
        caster.statList.setHp256(
          Math.max(FIXED_ONE, Math.min(caster.statList.getHp256(), caster.statList.getMaxHp256())),
        )
      }
      notes.push('state_toggled_off:wolf', 'druid_unshift_to_human', `cltoverlay:${DRUID_TRANSFORM_CLT_OVERLAYS_113C[223].undo}`)
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes,
      }
    }
    if (
      skill.id === 228 &&
      (caster.stateBus.hasState('bear') || caster.stateBus.hasState('wearbear') || caster.stateBus.hasState(140))
    ) {
      caster.stateBus.removeState('bear')
      caster.stateBus.removeState('wearbear')
      caster.stateBus.removeState(140)
      caster.stateBus.removeState('feralrage')
      caster.stateBus.removeState(120)
      caster.stateBus.removeState('maul')
      caster.stateBus.removeState(117)
      if (caster.statList.getHp256() > 0) {
        caster.statList.setHp256(
          Math.max(FIXED_ONE, Math.min(caster.statList.getHp256(), caster.statList.getMaxHp256())),
        )
      }
      notes.push('state_toggled_off:bear', 'druid_unshift_to_human', `cltoverlay:${DRUID_TRANSFORM_CLT_OVERLAYS_113C[228].undo}`)
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes,
      }
    }

    const buffState =
      skill.auraState ||
      skill.auraTgtState ||
      (skill.id === 223 ? 'wolf' : skill.id === 228 ? 'bear' : skill.name.toLowerCase().replace(/\s+/g, ''))
    const stats: Record<string, number> = {}
    const lycSlvl = caster.statList.getEffectiveSkillLevel(224)
    const lycHpBonus = lycSlvl > 0 ? 20 + (lycSlvl - 1) * 5 : 0
    const lycDurationBonus = lycSlvl > 0 ? 1000 + (lycSlvl - 1) * 500 : 0
    // 1.13c Werebear (`228`): +50% HP (+Lycanthropy.ln34), +50%+(lvl-1)*8% ED, +25%+(lvl-1)*6% Defense
    if (skill.id === 228) {
      stats['item_maxhp_percent'] = 50 + lycHpBonus
      stats['damagepercent'] = 50 + (evalResult.slvl - 1) * 8
      stats['item_armor_percent'] = 25 + (evalResult.slvl - 1) * 6
      caster.stateBus.removeState('wolf')
      caster.stateBus.removeState('feralrage')
      caster.stateBus.removeState('maul')
      notes.push(`cltoverlay:${DRUID_TRANSFORM_CLT_OVERLAYS_113C[228].into}`)
    } else if (skill.id === 223) {
      // 1.13c Werewolf (`223`): +25% HP (+Lycanthropy.ln34), +25% Stamina, dm(10,80,lvl) Attack Rate, +50%+(lvl-1)*15% ToHit
      const wwIas = computeDiminishingReturns(10, 80, evalResult.slvl)
      stats['item_maxhp_percent'] = 25 + lycHpBonus
      stats['skill_staminapercent'] = 25
      stats['attackrate'] = wwIas
      stats['skill_ias'] = wwIas
      stats['item_tohit_percent'] = 50 + (evalResult.slvl - 1) * 15
      caster.stateBus.removeState('bear')
      caster.stateBus.removeState('feralrage')
      caster.stateBus.removeState('maul')
      notes.push(`cltoverlay:${DRUID_TRANSFORM_CLT_OVERLAYS_113C[223].into}`)
    } else if (skill.id === 350) {
      // Delerium Change (`350`): +33 velocitypercent, +33 attackrate, +33 other_animrate (Skills.txt aurastat1..3 = par1 = 33)
      stats['velocitypercent'] = 33
      stats['attackrate'] = 33
      stats['other_animrate'] = 33
    } else if (skill.id === 258) {
      // Burst of Speed (Quickness 258): FRW and IAS
      stats['velocitypercent'] = computeBurstOfSpeedFRW(evalResult.slvl)
      stats['attackrate'] = computeBurstOfSpeedIAS(evalResult.slvl)
    } else if (skill.id === 267) {
      // Fade (267): All Resists, Curse Length Reduction, 1% PDR/lvl
      const res = computeFadeResistances(evalResult.slvl)
      stats['fireresist'] = res
      stats['coldresist'] = res
      stats['lightresist'] = res
      stats['poisonresist'] = res
      stats['curse_resistance'] = computeFadeCurseReduction(evalResult.slvl)
      stats['damageresist'] = evalResult.slvl
    } else if (skill.id === 278) {
      // Venom (`278`): 10-frame poison clamp + exact 1.13c bitrate (`minElemDmg256` / `maxElemDmg256` without 250 cap)
      stats['venom_bitrate_256'] = evalResult.minElemDmg256
      stats['venom_max_bitrate_256'] = evalResult.maxElemDmg256
      stats['skill_pois_min'] = evalResult.minElemDmg256
      stats['skill_pois_max'] = evalResult.maxElemDmg256
      stats['skill_pois_len'] = 10
      stats['skill_poison_override_length'] = 10
    } else if (skill.id === 40) {
      stats['skill_armor_percent'] = evalResult.radiusSubtiles || (30 + (evalResult.slvl - 1) * 5)
    } else if (skill.id === 50) {
      stats['skill_armor_percent'] = evalResult.radiusSubtiles || (45 + (evalResult.slvl - 1) * 6)
    } else if (skill.id === 60) {
      stats['skill_armor_percent'] = evalResult.radiusSubtiles || (45 + (evalResult.slvl - 1) * 5)
    } else if (skill.id === 68) {
      // 1.13c Bone Armor (#68): aurastat1=damagearmor, aurastat2=maxdamagearmor
      // calc = 20 + (slvl - 1) * 10 + (skill('Bone Wall'.blvl) + skill('Bone Prison'.blvl)) * 15
      const cap = calculateBoneArmorCapacity(evalResult.slvl, {
        boneWall: caster.statList.getBaseSkillLevel(78),
        bonePrison: caster.statList.getBaseSkillLevel(88),
      })
      stats['damagearmor'] = cap
      stats['maxdamagearmor'] = cap
    } else if (skill.id === 235) {
      // 1.13c Cyclone Armor (#235, SKILLS_SrvDo018_CycloneArmor 0x6FD00060):
      // aurastat1 = bonearmor, aurastat2 = bonearmormax
      // calc = (ln12 * (100 + (skill('Twister'.blvl) + skill('Tornado'.blvl) + skill('Hurricane'.blvl)) * par8) / 100) * 256
      const baseAbsorb = 40 + (evalResult.slvl - 1) * 12
      const synPct =
        (caster.statList.getBaseSkillLevel(240) +
          caster.statList.getBaseSkillLevel(245) +
          caster.statList.getBaseSkillLevel(250)) *
        (skill.param8 || 7)
      const absorbCap = Math.trunc((baseAbsorb * (100 + synPct)) / 100)
      stats['cyclone_armor_absorb'] = absorbCap
      stats['cyclone_armor_max_absorb'] = absorbCap
      stats['magicarmor'] = absorbCap
      stats['maxmagicarmor'] = absorbCap
    }

    // Holy Shield (`117`): requires shield, applies holyshield state (+block, +def, +smiteDmg)
    if (skill.id === 117) {
      const defBlvl = caster.statList.getBaseSkillLevel(104)
      const hsStats = {
        skill_armor_percent: 25 + (evalResult.slvl - 1) * 15 + defBlvl * 15,
        toblock: computeDiminishingReturns(10, 40, evalResult.slvl),
        smite_flat_min: evalResult.minPhysDmg,
        smite_flat_max: evalResult.maxPhysDmg,
      }
      Object.assign(stats, hsStats)
    }

    const buffDuration =
      skill.id === 350
        ? 1500
        : skill.id === 258
          ? (evalResult.durationFrames || (3000 + 300 * (evalResult.slvl - 1)))
          : skill.id === 223 || skill.id === 228
            ? 1000 + lycDurationBonus
            : (evalResult.durationFrames || 3000)

    caster.stateBus.applyState({
      stateNameOrId: buffState,
      sourceUnitId: caster.id,
      sourceSkillId: skill.id,
      slvl: evalResult.slvl,
      durationFrames: buffDuration,
      currentFrame: currentTick,
      stats,
    })
    statesApplied.push(buffState)

    // Blaze (`46`) / Thunder Storm (`57`) / Blade Shield (`277`) also deal immediate or trail damage
    if (skill.id === 277) {
      auraScanner.setActiveAura(caster, 277, evalResult.slvl, currentTick)
    }
    if (skill.id === 46 || skill.id === 57 || skill.id === 277) {
      const alive = targets.find(t => t.statList.getHp256() > 0)
      if (alive) {
        if (skill.id === 277) {
          // Blade Shield deals physical damage with srcDam = 32 (1/4 weapon + flat skill damage, Half2HSrc = 0)
          // and drains 1 durability from the equipped weapon per hit
          const out = executeSUnitDmg(caster, alive, {
            skillId: skill.id,
            attackKind: 'melee',
            srcDam: 32,
            flatPhysMin256: Math.trunc((evalResult.minPhysDmg * FIXED_ONE * 32) / 128),
            flatPhysMax256: Math.trunc((evalResult.maxPhysDmg * FIXED_ONE * 32) / 128),
            autoHit: true,
          }, skillRng)
          totalDamageDealt += out.totalDamage
          caster.statList.drainEquippedWeaponDurability?.(1)
        } else {
          const out = executeSUnitDmg(caster, alive, {
            skillId: skill.id,
            attackKind: 'spell',
            srcDam: skill.srcDam,
            elemType: evalResult.elemType,
            elemMin256: Math.max(FIXED_ONE * 15, evalResult.minElemDmg256),
            elemMax256: Math.max(FIXED_ONE * 25, evalResult.maxElemDmg256),
            autoHit: true,
          }, skillRng)
          totalDamageDealt += out.totalDamage
        }
      }
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 7b. Scrolls & Books (`srvDoFunc = 113`: Scroll/Book of Identify 217..218, Scroll/Book of Townportal 219..220)
  if (effectiveDoFunc === 113 || [217, 218, 219, 220].includes(skill.id)) {
    const isScroll = skill.id === 217 || skill.id === 219
    const isBook = skill.id === 218 || skill.id === 220
    const isIdentify = skill.id === 217 || skill.id === 218
    const scrollQty = caster.scrollCount ?? ctx.scrollCount
    const tomeQty = caster.tomeQuantity ?? ctx.tomeQuantity

    if (isScroll && scrollQty !== undefined && scrollQty <= 0) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'no_scroll',
        srvDoFuncUsed: 113,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'no_scroll'],
      }
    }

    if (isBook && tomeQty !== undefined && tomeQty <= 0) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'empty_tome',
        srvDoFuncUsed: 113,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'empty_tome'],
      }
    }

    const targetItem = ctx.targetItem ?? caster.targetItem
    if (isIdentify && targetItem && targetItem.identified === true) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'already_identified',
        srvDoFuncUsed: 113,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'already_identified'],
      }
    }

    if (isScroll && scrollQty !== undefined && scrollQty > 0) {
      const nextScroll = scrollQty - 1
      if (caster.scrollCount !== undefined) caster.scrollCount = nextScroll
      if (ctx.scrollCount !== undefined) ctx.scrollCount = nextScroll
    }
    if (isBook && tomeQty !== undefined && tomeQty > 0) {
      const nextTome = tomeQty - 1
      if (caster.tomeQuantity !== undefined) caster.tomeQuantity = nextTome
      if (ctx.tomeQuantity !== undefined) ctx.tomeQuantity = nextTome
    }
    const baseQty = caster.statList.getBaseStat('quantity')
    if (baseQty > 0) {
      caster.statList.setBaseStat('quantity', baseQty - 1)
    }

    if (isIdentify) {
      if (targetItem) {
        targetItem.identified = true
      }
      notes.push('item_identified')
    } else {
      const fromLevelId = ctx.levelId ?? 2
      const actNo =
        ctx.actNo ??
        (fromLevelId >= 109
          ? 5
          : fromLevelId >= 103
            ? 4
            : fromLevelId >= 75
              ? 3
              : fromLevelId >= 40
                ? 2
                : 1)
      const townLevelId =
        actNo === 2 ? 40 : actNo === 3 ? 75 : actNo === 4 ? 103 : actNo === 5 ? 109 : 1
      const fromPos = ctx.casterPos ?? { x: targetX, y: targetY }
      const tpSlot = ctx.townPortalSlot ?? caster.townPortalSlot
      tpSlot?.cast({
        id: Number.isFinite(Number(caster.id)) ? Number(caster.id) * 1000 + fromLevelId : `tp_${String(caster.id)}_${String(currentTick)}`,
        ownerId: caster.id,
        fromLevelId,
        fromPos,
        fromX: fromPos.x,
        fromY: fromPos.y,
        townLevelId,
        townPos: { x: 0, y: 0 },
        townX: 0,
        townY: 0,
        open: true,
      } as any)
      notes.push('town_portal_opened')
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: 113,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 8. Conversion (`116` `srvDoFunc = 79`)
  // 1.13c SKILLS_SrvDo079_Conversion (0x6FD13DC0):
  // 1. Execute weapon strike damage FIRST; if attack misses/blocks, conversion roll does not occur.
  // 2. Roll dm34 (`computeDiminishingReturns(0, 50, slvl)`) against non-boss/non-champion targets.
  // 3. Apply STATE_CONVERSION_SAVE (#109) clvl < mlvl anti-exploit level/HP scaling when converting.
  if (skill.id === 116 || effectiveDoFunc === 79) {
    const primaryTarget = targets.find(t => t.statList.getHp256() > 0)
    if (primaryTarget) {
      const out = executeSUnitDmg(caster, primaryTarget, {
        skillId: skill.id,
        attackKind: 'melee',
        srcDam: skill.srcDam || 128,
        physDamagePct: evalResult.physDamagePct,
        ...(evalResult.toHitBonusPct !== 0 ? { toHitBonusPct: evalResult.toHitBonusPct } : {}),
      }, skillRng)
      totalDamageDealt += out.totalDamage

      const isBossOrChamp = Boolean(
        primaryTarget.isBoss ||
        primaryTarget.isChampion ||
        primaryTarget.rank === 'boss' ||
        primaryTarget.rank === 'champion' ||
        primaryTarget.rank === 'unique' ||
        (primaryTarget.statList.getAccruedStat('is_boss') > 0)
      )
      if (out.hit && primaryTarget.statList.getHp256() > 0 && !isBossOrChamp) {
        const convChancePct = computeDiminishingReturns(0, 50, evalResult.slvl)
        const roll = rollSkill100(ctx)
        if (roll < convChancePct) {
          const clvl = caster.statList.getAccruedStat('level') || 0
          const mlvl = primaryTarget.statList.getAccruedStat('level') || 0
          const convStats: Record<string, number> = {}
          if (clvl > 0 && mlvl > clvl) {
            convStats['saved_level'] = mlvl
            convStats['scaled_level'] = clvl
            const curHp256 = primaryTarget.statList.getHp256()
            const maxHp256 = primaryTarget.statList.getMaxHp256()
            primaryTarget.statList.setHp256(Math.max(FIXED_ONE, Math.floor((curHp256 * clvl) / mlvl)))
            if (maxHp256 > 0) {
              primaryTarget.statList.setBaseStat('maxhp', Math.max(FIXED_ONE, Math.floor((maxHp256 * clvl) / mlvl)))
            }
            notes.push(`conversion_save:clvl=${clvl},mlvl=${mlvl}`)
          }
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'conversion',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: evalResult.durationFrames || 400,
            currentFrame: currentTick,
            stats: convStats,
          })
          statesApplied.push('conversion')
        }
      }
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 8. Teleport (`54`, `srvDoFunc = 27`)
  if (skill.id === 54 || effectiveDoFunc === 27) {
    notes.push(`teleported:${String(Math.round(targetX))},${String(Math.round(targetY))}`)
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: 27,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 9. Warcries (`Shout` 138, `Battle Cry` 146, `Battle Orders` 149, `War Cry` 154, `Battle Command` 155)
  //    and Radial Novas (`Frost Nova` 44, `Nova` 48, `Poison Nova` 92, `Howl` 130, `Static Field` 42)
  if ([20, 22, 68].includes(effectiveDoFunc) && (skill.charClass === 'bar' || [42, 44, 48, 92, 130].includes(skill.id))) {
    if (skill.id === 138 || skill.id === 149 || skill.id === 155) {
      const stateName = skill.auraState || skill.name.toLowerCase().replace(/\s+/g, '')
      const stats: Record<string, number> = {}
      if (skill.id === 138) {
        const defPct = 100 + (evalResult.slvl - 1) * 10
        stats['item_armor_percent'] = defPct
        stats['skill_armor_percent'] = defPct
      }
      if (skill.id === 149) {
        const pct = 35 + (evalResult.slvl - 1) * 3
        stats['item_maxhp_percent'] = pct
        stats['item_maxmana_percent'] = pct
        stats['item_maxstamina_percent'] = pct
      }
      if (skill.id === 155) stats['item_allskills'] = 1

      const scaleBattleOrdersVitals = (
        unit: CombatUnitContext,
        oldMaxHp: number,
        oldMaxMana: number,
        oldMaxStam: number
      ) => {
        if (skill.id !== 149) return
        const newMaxHp = unit.statList.getMaxHp256()
        if (oldMaxHp > 0 && newMaxHp > oldMaxHp) {
          unit.statList.setHp256(Math.min(newMaxHp, Math.floor((unit.statList.getHp256() * newMaxHp) / oldMaxHp)))
        }
        const newMaxMana = unit.statList.getMaxMana256()
        if (oldMaxMana > 0 && newMaxMana > oldMaxMana) {
          unit.statList.setMana256(Math.min(newMaxMana, Math.floor((unit.statList.getMana256() * newMaxMana) / oldMaxMana)))
        }
        const newMaxStam = unit.statList.getAccruedStat('maxstamina')
        const curStam = unit.statList.getBaseStat('stamina')
        if (oldMaxStam > 0 && newMaxStam > oldMaxStam && curStam > 0) {
          unit.statList.setBaseStat('stamina', Math.min(newMaxStam, Math.floor((curStam * newMaxStam) / oldMaxStam)))
        }
      }

      const oldCasterMaxHp = caster.statList.getMaxHp256()
      const oldCasterMaxMana = caster.statList.getMaxMana256()
      const oldCasterMaxStam = caster.statList.getAccruedStat('maxstamina')
      const selfRes = caster.stateBus.applyState({
        stateNameOrId: stateName,
        sourceUnitId: caster.id,
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        durationFrames: evalResult.durationFrames || 3000,
        currentFrame: currentTick,
        stats,
      })
      if (selfRes.applied) {
        statesApplied.push(stateName)
        scaleBattleOrdersVitals(caster, oldCasterMaxHp, oldCasterMaxMana, oldCasterMaxStam)
      }
      if (skill.id === 149 && selfRes.applied) {
        notes.push('bo_current_vitals_scaled')
      }
      if (skill.id === 155 && selfRes.applied) {
        notes.push('passive_skills_refreshed')
      }

      // 1.13c Ground Truth: Disseminate warcry buffs to friendly units (party, mercs, summons) within radius
      if (ctx.allies && ctx.allies.length > 0) {
        const cPos = targetPositions?.get(caster.id) ?? { x: targetX, y: targetY }
        const warcryRadius = 10.67 // 1.13c Missiles.txt Vel=16, Range=16 -> 256/24 = 10.67 subtiles
        for (const ally of ctx.allies) {
          if (ally.id === caster.id) continue
          if (targetPositions && targetPositions.has(ally.id) && targetPositions.has(caster.id)) {
            const aPos = targetPositions.get(ally.id)!
            const dist = Math.hypot(aPos.x - cPos.x, aPos.y - cPos.y)
            if (dist > warcryRadius) continue
          }
          const oldAllyMaxHp = ally.statList.getMaxHp256()
          const oldAllyMaxMana = ally.statList.getMaxMana256()
          const oldAllyMaxStam = ally.statList.getAccruedStat('maxstamina')
          const allyRes = ally.stateBus.applyState({
            stateNameOrId: stateName,
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: evalResult.durationFrames || 3000,
            currentFrame: currentTick,
            stats,
          })
          if (allyRes.applied) {
            statesApplied.push(stateName)
            scaleBattleOrdersVitals(ally, oldAllyMaxHp, oldAllyMaxMana, oldAllyMaxStam)
          }
        }
      }

      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: evalResult.manaCost256,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes,
      }
    }

    if (skill.id === 146) {
      const bcDuration =
        evalResult.durationFrames ||
        Math.floor((300 + (evalResult.slvl - 1) * 60) / resolveAiCurseDivisor(ctx.difficulty))
      const defReduction = -(50 + (evalResult.slvl - 1) * 2)
      const dmgReduction = -(25 + (evalResult.slvl - 1))
      for (const t of targets) {
        if (t.statList.getHp256() <= 0) continue
        if (t.unitType !== 'player' && !canMonsterTargetBeCursed113c(t as never)) continue
        const res = t.stateBus.applyState({
          stateNameOrId: 'battlecry',
          sourceUnitId: caster.id,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          durationFrames: bcDuration,
          currentFrame: currentTick,
          stats: {
            skill_armor_percent: defReduction,
            item_armor_percent: defReduction,
            damagepercent: dmgReduction,
            item_mindamage_percent: dmgReduction,
            item_maxdamage_percent: dmgReduction,
          },
        })
        if (res.applied) {
          statesApplied.push('battlecry')
        }
      }
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: evalResult.manaCost256,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes,
      }
    }

    // Frost Nova (Skill 44): 1.13c expanding ring of 64 cold bolts with 2:1 isometric aspect ratio 0.5 and NextDelay 4
    if (skill.id === 44) {
      const casterPos = targetPositions?.get(caster.id) ?? { x: targetX, y: targetY }
      const bolts = missileEngine.spawnNovaRing({
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        owner: caster,
        startX: casterPos.x,
        startY: casterPos.y,
        missileName: 'frostnova',
        dmgPacket: {
          skillId: skill.id,
          attackKind: 'spell',
          elemType: evalResult.elemType,
          elemMin256: evalResult.minElemDmg256,
          elemMax256: evalResult.maxElemDmg256,
          elemDurationFrames: evalResult.durationFrames,
          autoHit: true,
        },
      })
      missilesSpawned.push(...bolts.map(b => b.name))
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: evalResult.manaCost256,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt: 0,
        notes,
      }
    }

    // Nova (Skill 48): 1.13c expanding ring of 64 bolts with 2:1 isometric aspect ratio 0.5 and NextDelay 4
    if (skill.id === 48) {
      const casterPos = targetPositions?.get(caster.id) ?? { x: targetX, y: targetY }
      const bolts = missileEngine.spawnNovaRing({
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        owner: caster,
        startX: casterPos.x,
        startY: casterPos.y,
        dmgPacket: {
          skillId: skill.id,
          attackKind: 'spell',
          elemType: evalResult.elemType,
          elemMin256: evalResult.minElemDmg256,
          elemMax256: evalResult.maxElemDmg256,
          autoHit: true,
        },
      })
      missilesSpawned.push(...bolts.map(b => b.name))
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: evalResult.manaCost256,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt: 0,
        notes,
      }
    }

    // Static Field (Skill 42): 1.13c Instantaneous 360° area discharge
    // Radius = (4 + slvl) yards = (4 + slvl) * 40 px in 2D ground plane
    // Cuts 25% current HP of non-lightning-immune targets, obeys LOS & difficulty floors
    if (skill.id === 42) {
      const radiusPx = calculateStaticFieldRadiusPx(evalResult.slvl)
      const cPos = targetPositions?.get(caster.id) ?? { x: 0, y: 0 }
      const diff = 'normal'
      for (const t of targets) {
        if (t.statList.getHp256() <= 0) continue
        const tPos = targetPositions?.get(t.id)
        if (tPos) {
          const dist = Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y)
          if (dist > radiusPx) continue
          if (missileEngine.terrain && !hasLineOfSight(cPos.x, cPos.y, tPos.x, tPos.y, missileEngine.terrain)) {
            continue
          }
        }
        const currentHp = t.statList.getHp()
        const maxHp = t.statList.getMaxHp()
        const ltngRes = t.statList.getAccruedStat('lightresist')
        const res = calculateStaticFieldDamage(currentHp, maxHp, diff, ltngRes)
        if (res.damage > 0) {
          t.statList.setHp256((currentHp - res.damage) * FIXED_ONE)
          totalDamageDealt += res.damage
        }
      }
      return {
        skillId: skill.id,
        name: skill.name,
        executed: true,
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: evalResult.manaCost256,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes,
      }
    }

    // Poison Nova (`92`), War Cry (`154`), Howl (`130`)
    for (const t of targets) {
      if (t.statList.getHp256() <= 0) continue
      const isBossOrChamp = Boolean(
        t.isBoss ||
        t.isChampion ||
        t.rank === 'boss' ||
        t.rank === 'champion' ||
        t.rank === 'unique' ||
        t.statList.getAccruedStat('is_boss') > 0
      )
      if (skill.id === 130) {
        if (isBossOrChamp || (t.unitType !== 'player' && !canMonsterTargetBeCursed113c(t as never))) {
          continue
        }
        // 1.13c Howl (#130, SKILLS_CltHitFunc_Howl): clvl + slvl + 1 > mlvl check
        const casterClvl = caster.statList.getAccruedStat('level') || (caster as { level?: number }).level || 99
        const targetMlvl =
          t.statList.getAccruedStat('level') ||
          t.statList.getAccruedStat('mlvl') ||
          (t as { level?: number; mlvl?: number }).level ||
          (t as { level?: number; mlvl?: number }).mlvl ||
          1
        if (casterClvl + evalResult.slvl + 1 <= targetMlvl) {
          notes.push(`howl_mlvl_immune:${t.id}`)
          continue
        }
        const howlDuration =
          evalResult.durationFrames > 0
            ? evalResult.durationFrames
            : Math.floor((75 + 25 * (evalResult.slvl - 1)) / resolveAiCurseDivisor(ctx.difficulty))
        const howlRange = 24 + 5 * (evalResult.slvl - 1)
        ;(t as { fleeRangeSubtiles?: number }).fleeRangeSubtiles = howlRange
        t.stateBus.applyState({
          stateNameOrId: 'terror',
          sourceUnitId: caster.id,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          durationFrames: howlDuration,
          currentFrame: currentTick,
        })
        statesApplied.push('terror')
        continue
      }
      const rawStunDuration =
        skill.id === 154
          ? evalResult.durationFrames > 0
            ? Math.min(250, evalResult.durationFrames)
            : Math.min(250, 25 + 5 * (evalResult.slvl - 1))
          : undefined
      // 1.13c War Cry (#154): bosses/champions take full physical damage (autoHit: true) but are immune to stun
      const stunDuration = skill.id === 154 && isBossOrChamp ? undefined : rawStunDuration
      const novaElemMin256 =
        evalResult.elemType === 'pois' && evalResult.durationFrames > 0
          ? evalResult.minElemDmg256 * evalResult.durationFrames
          : evalResult.minElemDmg256
      const novaElemMax256 =
        evalResult.elemType === 'pois' && evalResult.durationFrames > 0
          ? evalResult.maxElemDmg256 * evalResult.durationFrames
          : evalResult.maxElemDmg256
      const out = executeSUnitDmg(caster, t, {
        skillId: skill.id,
        attackKind: 'spell',
        flatPhysMin256: evalResult.minPhysDmg * FIXED_ONE,
        flatPhysMax256: evalResult.maxPhysDmg * FIXED_ONE,
        elemType: evalResult.elemType,
        elemMin256: novaElemMin256,
        elemMax256: novaElemMax256,
        ...(evalResult.durationFrames > 0 ? { elemDurationFrames: evalResult.durationFrames } : {}),
        stunDurationFrames: stunDuration,
        autoHit: true,
      }, skillRng)
      totalDamageDealt += out.totalDamage
      if (evalResult.elemType === 'pois' && evalResult.durationFrames > 0 && t.stateBus) {
        t.stateBus.applyState({
          stateNameOrId: 'poison',
          sourceUnitId: String(caster.id),
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          durationFrames: evalResult.durationFrames,
        })
        if (!statesApplied.includes('poison')) statesApplied.push('poison')
      }
      if (skill.id === 154 && stunDuration && stunDuration > 0) {
        t.stateBus.applyState({
          stateNameOrId: 'stunned',
          sourceUnitId: caster.id,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          durationFrames: stunDuration,
          currentFrame: currentTick,
        })
        if (!statesApplied.includes('stun')) {
          statesApplied.push('stun')
        }
        if (!statesApplied.includes('stunned')) {
          statesApplied.push('stunned')
        }
      }
    }
    if (evalResult.missileA) {
      const m = missileEngine.spawnMissile({
        missileNameOrId: evalResult.missileA,
        sourceSkillId: skill.id,
        slvl: evalResult.slvl,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX,
        targetY,
        dmgPacket: {
          skillId: skill.id,
          attackKind: 'spell',
          elemType: evalResult.elemType,
          elemMin256:
            evalResult.elemType === 'pois' && evalResult.durationFrames > 0
              ? evalResult.minElemDmg256 * evalResult.durationFrames
              : evalResult.minElemDmg256,
          elemMax256:
            evalResult.elemType === 'pois' && evalResult.durationFrames > 0
              ? evalResult.maxElemDmg256 * evalResult.durationFrames
              : evalResult.maxElemDmg256,
          ...(evalResult.durationFrames > 0 ? { elemDurationFrames: evalResult.durationFrames } : {}),
          autoHit: true,
        },
      })
      if (m) missilesSpawned.push(m.name)
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 9b. Psychic Hammer (253, srvDoFunc = 33) & Mind Blast (273, srvDoFunc = 51)
  if (skill.id === 253 || effectiveDoFunc === 33) {
    const primaryTarget = targets.find(t => t.statList.getHp256() > 0)
    if (primaryTarget) {
      const dmg = computePsychicHammerDamage(evalResult.slvl)
      const isBossOrPlayer = Boolean(
        primaryTarget.isBoss ||
        primaryTarget.rank === 'boss' ||
        primaryTarget.unitType === 'player' ||
        (primaryTarget.statList.getAccruedStat('is_boss') > 0)
      )
      const isChampOrUnique = Boolean(
        primaryTarget.isChampion ||
        (primaryTarget as { isUnique?: boolean }).isUnique ||
        (primaryTarget as { isSuperUnique?: boolean }).isSuperUnique ||
        primaryTarget.rank === 'champion' ||
        primaryTarget.rank === 'unique'
      )
      const tier: 'normal' | 'exceptional' | 'boss' = isBossOrPlayer
        ? 'boss'
        : isChampOrUnique
          ? 'exceptional'
          : 'normal'
      const kbChance = computePsychicHammerKnockbackChance(evalResult.slvl, tier)
      const kbRoll = tier === 'normal' ? 0 : rollSkill100(ctx)
      const kbTriggered = kbRoll < kbChance
      if (kbTriggered) {
        ;(primaryTarget as { knockedBack?: boolean }).knockedBack = true
      }
      const out = executeSUnitDmg(caster, primaryTarget, {
        skillId: skill.id,
        attackKind: 'spell',
        flatPhysMin256: dmg.minPhys * FIXED_ONE,
        flatPhysMax256: dmg.maxPhys * FIXED_ONE,
        elemType: 'mag',
        elemMin256: dmg.minMagic * FIXED_ONE,
        elemMax256: dmg.maxMagic * FIXED_ONE,
        knockback: kbTriggered,
        autoHit: true,
      }, skillRng)
      totalDamageDealt += out.totalDamage
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  if (skill.id === 273 || effectiveDoFunc === 51) {
    const stunFrames = computeMindBlastStunDuration(evalResult.slvl)
    const dmg = computeMindBlastDamage(evalResult.slvl)
    const convChance = computeMindBlastConversionChance(evalResult.slvl)

    for (const t of targets) {
      if (t.statList.getHp256() <= 0) continue

      // Stun + Physical damage
      const out = executeSUnitDmg(caster, t, {
        skillId: skill.id,
        attackKind: 'spell',
        flatPhysMin256: dmg.minPhys * FIXED_ONE,
        flatPhysMax256: dmg.maxPhys * FIXED_ONE,
        stunDurationFrames: stunFrames,
        autoHit: true,
      }, skillRng)
      totalDamageDealt += out.totalDamage
      if (!statesApplied.includes('stun')) {
        statesApplied.push('stun')
      }

      // Conversion chance on non-boss targets
      const isBossOrChamp = Boolean(
        t.isBoss ||
        t.isChampion ||
        t.rank === 'boss' ||
        t.rank === 'champion' ||
        t.rank === 'unique' ||
        (t.statList.getAccruedStat('is_boss') > 0)
      )
      if (!isBossOrChamp) {
        const roll = rollSkill100(ctx)
        if (roll < convChance) {
          t.stateBus.applyState({
            stateNameOrId: 'conversion',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: 150 + rollSkill100(ctx),
            currentFrame: currentTick,
          })
          if (!statesApplied.includes('conversion')) {
            statesApplied.push('conversion')
          }
        }
      }
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 10. Missile / Ground Spawner / Ranged Skills (`srvDoFunc = 2, 3, 5, 8, 10, 12, 17, 19, 24, 26, 28, 43, 44, 48, 68, 73, 74, 80, 117, 118, 123, 124`)
  const isRangedBasicAttack =
    skill.id === 0 &&
    (caster.weaponItemType === 'bow' ||
      caster.weaponItemType === 'crossbow' ||
      caster.isRanged === true)
  const isAmaBowSkill = [6, 7, 11, 12, 16, 21, 22, 26, 27, 31].includes(skill.id)
  const isAmaJavelinThrowSkill = [15, 20, 25, 35].includes(skill.id)
  const isAmaJavelinMeleeSkill = [10, 14, 19, 24, 30, 34].includes(skill.id)
  const isThrowSkill = skill.id === 2 || skill.id === 4 || skill.id === 140

  let resolvedRangedMissile = evalResult.missileA
  let throwMasteryEdPct = 0
  let throwMasteryArPct = 0
  let throwMasteryCritPct = 0

  if (isAmaBowSkill) {
    const wType = (caster.weaponItemType ?? '').toLowerCase()
    const invalidBowWeapon =
      caster.isRanged === false ||
      (wType !== '' && wType !== 'bow' && wType !== 'crossbow' && wType !== 'abow')
    if (invalidBowWeapon) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'invalid_weapon',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'invalid_weapon'],
      }
    }
    const requiresAmmo = skill.id !== 6 && skill.raw?.noammo !== '1'
    const firesMagic =
      Boolean(caster.firesMagicArrows) || caster.statList.getAccruedStat('item_magicarrow') > 0
    if (requiresAmmo) {
      if (caster.ammoQuantity !== undefined && caster.ammoQuantity <= 0 && !firesMagic) {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'no_ammo',
          srvDoFuncUsed: effectiveDoFunc,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'no_ammo'],
        }
      }
      if (caster.ammoQuantity !== undefined && caster.ammoQuantity > 0 && !firesMagic) {
        caster.ammoQuantity -= 1
      }
      const baseQty = caster.statList.getBaseStat('quantity')
      if (baseQty > 0 && !firesMagic) {
        caster.statList.setBaseStat('quantity', baseQty - 1)
      }
    }
    if (skill.id === 12) {
      resolvedRangedMissile =
        wType === 'crossbow' ? 'multipleshotbolt' : (evalResult.missileA || 'multipleshotarrow')
    } else if (skill.id === 26) {
      resolvedRangedMissile =
        wType === 'crossbow' ? 'strafebolt' : (evalResult.missileA || 'strafearrow')
    }
  } else if (isAmaJavelinThrowSkill) {
    // 1.13c SKILLS_SrvSt04_Arrow_Bolt (0x6FC6C840): Throwing javelin & quantity check (`itypea1 = jave`, `decquant = 1`)
    const wType = (caster.weaponItemType ?? '').toLowerCase()
    const invalidJavThrowWeapon =
      caster.isThrowing === false ||
      (wType !== '' && wType !== 'jave' && wType !== 'ajav' && wType !== 'javelin')
    if (invalidJavThrowWeapon) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'invalid_weapon',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'invalid_weapon'],
      }
    }
    if (caster.weaponQuantity !== undefined && caster.weaponQuantity <= 0) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'no_ammo',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'no_ammo'],
      }
    }
    if (caster.weaponQuantity !== undefined && caster.weaponQuantity > 0) {
      caster.weaponQuantity -= 1
    }
    const baseQty = caster.statList.getBaseStat('quantity')
    if (baseQty > 0) {
      caster.statList.setBaseStat('quantity', baseQty - 1)
    }
  } else if (isRangedBasicAttack) {
    const firesMagic =
      Boolean(caster.firesMagicArrows) || caster.statList.getAccruedStat('item_magicarrow') > 0
    const firesExplosive =
      Boolean(caster.firesExplosiveArrows) || caster.statList.getAccruedStat('item_explosivearrow') > 0
    if (
      caster.ammoQuantity !== undefined &&
      caster.ammoQuantity <= 0 &&
      !firesMagic &&
      !firesExplosive
    ) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'no_ammo',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'no_ammo'],
      }
    }
    if (caster.ammoQuantity !== undefined && caster.ammoQuantity > 0 && !firesMagic) {
      caster.ammoQuantity -= 1
    }
    const baseQty = caster.statList.getBaseStat('quantity')
    if (baseQty > 0 && !firesMagic) {
      caster.statList.setBaseStat('quantity', baseQty - 1)
    }
    resolvedRangedMissile = firesMagic
      ? 'magicarrow'
      : firesExplosive
        ? 'explosivearrow'
        : caster.weaponItemType === 'crossbow'
          ? 'bolt'
          : 'arrow'
  } else if (isThrowSkill) {
    if (skill.id === 2) {
      if (
        caster.isThrowing === false ||
        (caster.weaponQuantity !== undefined && caster.weaponQuantity <= 0)
      ) {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'invalid_throw_or_no_quantity',
          srvDoFuncUsed: effectiveDoFunc,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'invalid_throw_or_no_quantity'],
        }
      }
      if (caster.weaponQuantity !== undefined && caster.weaponQuantity > 0) {
        caster.weaponQuantity -= 1
      }
      const baseQty = caster.statList.getBaseStat('quantity')
      if (baseQty > 0) {
        caster.statList.setBaseStat('quantity', baseQty - 1)
      }
      const wType = (caster.weaponItemType ?? '').toLowerCase()
      const wCode = (caster as { weaponCode?: string }).weaponCode
      // 1.13c throw missiles (Missiles.txt): resolved from the equipped weapon's Weapons.txt missiletype column.
      resolvedRangedMissile =
        caster.thrownMissile ||
        resolveThrowMissileForCasterWeapon(wCode, wType) ||
        evalResult.missileA ||
        'javelin'
    } else if (skill.id === 4) {
      const offHandQty = caster.offHandWeaponQuantity ?? caster.offHandQuantity
      if (
        caster.offHandIsThrowing === false ||
        (caster.offHandIsThrowing === undefined && caster.isThrowing === false) ||
        (offHandQty !== undefined && offHandQty <= 0) ||
        (offHandQty === undefined && caster.weaponQuantity !== undefined && caster.weaponQuantity <= 0)
      ) {
        return {
          skillId: skill.id,
          name: skill.name,
          executed: false,
          error: 'invalid_left_throw_or_no_quantity',
          srvDoFuncUsed: effectiveDoFunc,
          manaSpent256: 0,
          missilesSpawned,
          statesApplied,
          petsSummoned,
          corpsesConsumed,
          totalDamageDealt,
          notes: [...notes, 'invalid_left_throw_or_no_quantity'],
        }
      }
      if (caster.offHandWeaponQuantity !== undefined && caster.offHandWeaponQuantity > 0) {
        caster.offHandWeaponQuantity -= 1
      } else if (caster.offHandQuantity !== undefined && caster.offHandQuantity > 0) {
        caster.offHandQuantity -= 1
      } else if (caster.weaponQuantity !== undefined && caster.weaponQuantity > 0) {
        caster.weaponQuantity -= 1
      }
      const baseQty = caster.statList.getBaseStat('quantity')
      if (baseQty > 0) {
        caster.statList.setBaseStat('quantity', baseQty - 1)
      }
      const offType = (caster.offHandWeaponItemType ?? caster.offHandWeaponType ?? caster.weaponItemType ?? '').toLowerCase()
      const offCode = (caster as { offHandWeaponCode?: string; weaponCode?: string }).offHandWeaponCode ?? (caster as { weaponCode?: string }).weaponCode
      resolvedRangedMissile =
        caster.offHandThrownMissile ||
        caster.thrownMissile ||
        resolveThrowMissileForCasterWeapon(offCode, offType) ||
        evalResult.missileA ||
        'javelin'
    } else if (skill.id === 140) {
      if (caster.weaponQuantity !== undefined && caster.weaponQuantity > 0) {
        caster.weaponQuantity -= 1
      }
      if (caster.offHandWeaponQuantity !== undefined && caster.offHandWeaponQuantity > 0) {
        caster.offHandWeaponQuantity -= 1
      } else if (caster.offHandQuantity !== undefined && caster.offHandQuantity > 0) {
        caster.offHandQuantity -= 1
      }
      const baseQty = caster.statList.getBaseStat('quantity')
      if (baseQty > 0) {
        caster.statList.setBaseStat('quantity', Math.max(0, baseQty - 2))
      }
      const wType = (caster.weaponItemType ?? '').toLowerCase()
      const wCode = (caster as { weaponCode?: string }).weaponCode
      resolvedRangedMissile =
        caster.thrownMissile ||
        resolveThrowMissileForCasterWeapon(wCode, wType) ||
        evalResult.missileA ||
        'javelin'
    }

    const tmSlvl =
      caster.passiveSkills?.get(135) ??
      (caster.statList.getBaseSkillLevel(135) > 0
        ? caster.statList.getEffectiveSkillLevel(135)
        : 0)
    if (tmSlvl > 0) {
      const tmStats = calculateThrowingMasteryStats(tmSlvl)
      throwMasteryEdPct = tmStats.damageBonusPct
      throwMasteryArPct = tmStats.attackRatingBonusPct
      throwMasteryCritPct = tmStats.criticalStrikeChancePct
      notes.push(`throwing_mastery:slvl=${tmSlvl},ed=${throwMasteryEdPct},ar=${throwMasteryArPct},crit=${throwMasteryCritPct}`)
    }
  }

  const isMissileSkill =
    isRangedBasicAttack ||
    isThrowSkill ||
    skill.id === 257 ||
    effectiveDoFunc === 124 ||
    (evalResult.missileA !== '' &&
      (skill.range === 'none' ||
        skill.range === 'rng' ||
        skill.range === 'both' ||
        [3, 5, 8, 10, 12, 17, 19, 24, 26, 28, 43, 44, 48, 68, 73, 74, 80, 117, 118, 123, 124].includes(effectiveDoFunc)))

  if (isMissileSkill) {
    const projectileCount =
      skill.id === 243
        ? 5
        : skill.id === 256
          ? 6 + Math.floor(evalResult.slvl / 4) + Math.floor(caster.statList.getBaseSkillLevel(251) / 3)
          : effectiveDoFunc === 8 || effectiveDoFunc === 17
            ? Math.min(24, 1 + evalResult.slvl)
            : effectiveDoFunc === 117 || skill.id === 240
              ? 3
              : skill.id === 140
                ? 2
                : 1

    const isTwoHandedWeapon = Boolean(
      (caster as any).isTwoHanded ||
      (caster as any).twoHandedWeapon ||
      (caster as any).isTwoHandedWeapon,
    )
    const bladeTrapSrcDam =
      skill.id === 257
        ? (isTwoHandedWeapon ? 24 : 48)
        : skill.id === 266
          ? (isTwoHandedWeapon ? 48 : 96)
          : undefined

    const isOffHandThrow = skill.id === 4
    const throwWeapMin = isOffHandThrow
      ? (caster.offHandMinPhys ?? caster.weaponMinPhys ?? 0)
      : isThrowSkill || isRangedBasicAttack || isAmaBowSkill || isAmaJavelinThrowSkill || skill.id === 257 || skill.id === 266
        ? (caster.weaponMinPhys ?? 0)
        : 0
    const throwWeapMax = isOffHandThrow
      ? (caster.offHandMaxPhys ?? caster.weaponMaxPhys ?? 0)
      : isThrowSkill || isRangedBasicAttack || isAmaBowSkill || isAmaJavelinThrowSkill || skill.id === 257 || skill.id === 266
        ? (caster.weaponMaxPhys ?? 0)
        : 0

    const bowOrJavPhysToElemPct =
      skill.id === 6
        ? Math.min(100, evalResult.slvl)
        : skill.id === 7 || skill.id === 11
          ? Math.min(100, 3 + 2 * (evalResult.slvl - 1))
          : skill.id === 20
            ? 100 // 1.13c MISSMODE_SrvDmg12_LightningJavelin: 100% of 75% weapon damage converted to Lightning
            : undefined

    const effectiveMissileSrcDam =
      bladeTrapSrcDam !== undefined
        ? bladeTrapSrcDam
        : isRangedBasicAttack || isThrowSkill
          ? (skill.srcDam || 128)
          : skill.srcDam

    const dmgPacket = {
      skillId: skill.id,
      slvl: evalResult.slvl,
      attackKind: (effectiveMissileSrcDam > 0 || isRangedBasicAttack || isThrowSkill ? 'missile' : 'spell') as 'missile' | 'spell',
      srcDam: effectiveMissileSrcDam,
      physDamagePct: evalResult.physDamagePct + throwMasteryEdPct,
      ...(evalResult.toHitBonusPct + throwMasteryArPct !== 0
        ? { toHitBonusPct: evalResult.toHitBonusPct + throwMasteryArPct }
        : {}),
      ...(throwMasteryCritPct > 0 ? { criticalStrikePct: throwMasteryCritPct } : {}),
      flatPhysMin256:
        isOffHandThrow && caster.offHandMinPhys !== undefined
          ? (evalResult.minPhysDmg + Math.max(0, caster.offHandMinPhys - resolveDefaultWeaponMinPhys(caster))) * FIXED_ONE
          : skill.id === 257
            ? Math.trunc((evalResult.minPhysDmg * FIXED_ONE * effectiveMissileSrcDam) / 128)
            : (evalResult.minPhysDmg * FIXED_ONE),
      flatPhysMax256:
        isOffHandThrow && caster.offHandMaxPhys !== undefined
          ? (evalResult.maxPhysDmg + Math.max(0, caster.offHandMaxPhys - resolveDefaultWeaponMaxPhys(caster))) * FIXED_ONE
          : skill.id === 257
            ? Math.trunc((evalResult.maxPhysDmg * FIXED_ONE * effectiveMissileSrcDam) / 128)
            : (evalResult.maxPhysDmg * FIXED_ONE),
      elemType: skill.id === 6 ? 'mag' : evalResult.elemType,
      elemMin256:
        evalResult.elemType === 'pois' && evalResult.durationFrames > 0
          ? evalResult.minElemDmg256 * evalResult.durationFrames
          : evalResult.minElemDmg256,
      elemMax256:
        evalResult.elemType === 'pois' && evalResult.durationFrames > 0
          ? evalResult.maxElemDmg256 * evalResult.durationFrames
          : evalResult.maxElemDmg256,
      ...(bowOrJavPhysToElemPct !== undefined ? { physToElemPct: bowOrJavPhysToElemPct } : {}),
      ...(evalResult.durationFrames > 0 ? { elemDurationFrames: evalResult.durationFrames } : {}),
      // 1.13c Missiles.txt: Guided Arrow (#22), Lightning Bolt (#20 lightningjavelin), and Lightning Fury (#35 lightningfury) have ToHit = 0 (auto-hit)
      autoHit:
        (!isRangedBasicAttack && !isThrowSkill && skill.srcDam === 0) ||
        skill.id === 22 ||
        skill.id === 20 ||
        skill.id === 35,
      ...(throwWeapMin > 0 ? { weaponMinPhys: throwWeapMin } : {}),
      ...(throwWeapMax > 0 ? { weaponMaxPhys: throwWeapMax } : {}),
    }

    // 1.13c attack-sequence start (`0x6FCEE520` & siblings): the caster's base `pierce_idx` (#328) advances once per
    // attack and seeds the creation-time pierce roll of every missile of this attack (`0x6FC8F660`, Issue #1420).
    // The roll itself (owner `item_pierce + skill_pierce`, Missiles.txt `Pierce` flag) happens in `spawnMissile`.
    advanceUnitPierceSeed(caster)

    if (skill.id === 12) {
      const vol = missileEngine.spawnMultipleShotVolley({
        sourceSkillId: 12,
        slvl: evalResult.slvl,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX,
        targetY,
        dmgPacket,
        missileName: resolvedRangedMissile || 'multipleshotarrow',
      })
      missilesSpawned.push(...vol.map(m => m.name))
    } else if (skill.id === 26) {
      const st = missileEngine.spawnStrafeVolley({
        sourceSkillId: 26,
        slvl: evalResult.slvl,
        owner: caster,
        startX: 0,
        startY: 0,
        targets,
        targetPositions: targetPositions ?? new Map(),
        targetX,
        targetY,
        dmgPacket,
        missileName: resolvedRangedMissile || 'strafearrow',
      })
      missilesSpawned.push(...st.map(m => m.name))
    } else {
      const primaryTargetForMsl = targets.find(t => t.statList.getHp256() > 0)
      const isFohDelay =
        skill.id === 121 ||
        effectiveDoFunc === 80 ||
        resolvedRangedMissile === 'fistoftheheavensdelay'
      const fohTargetPos =
        isFohDelay && primaryTargetForMsl
          ? (targetPositions?.get(primaryTargetForMsl.id) ?? { x: targetX || 0, y: targetY || 120 })
          : undefined
      const offThrowType = (caster.offHandWeaponItemType ?? caster.offHandWeaponType ?? '').toLowerCase()
      const offThrowCode = (caster as { offHandWeaponCode?: string }).offHandWeaponCode
      const offHandMissileFor140 =
        caster.offHandThrownMissile ||
        resolveThrowMissileForCasterWeapon(offThrowCode, offThrowType) ||
        resolvedRangedMissile ||
        'javelin'
      for (let i = 0; i < projectileCount; i += 1) {
        const spreadOffset = (i - (projectileCount - 1) / 2) * 14
        const mStartX = fohTargetPos ? fohTargetPos.x : 0
        const mStartY = fohTargetPos ? fohTargetPos.y : 0
        const mTargetX = fohTargetPos ? fohTargetPos.x : targetX + spreadOffset
        const mTargetY = fohTargetPos ? fohTargetPos.y : targetY
        const mslName =
          skill.id === 140 && i === 1
            ? offHandMissileFor140
            : (resolvedRangedMissile || (skill.id === 250 ? 'hurricaneswoosh' : skill.id === 257 ? 'blade creeper' : 'javelin'))
        const mslRangeOverride =
          skill.id === 230
            ? Math.max(8, Math.trunc((35 + (evalResult.slvl - 1) * 2) / 2))
            : skill.id === 249 || skill.id === 250
              ? (evalResult.durationFrames > 0 ? evalResult.durationFrames : 250)
              : skill.id === 257
                ? 100
                : undefined
        const m = missileEngine.spawnMissile({
          missileNameOrId: mslName,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          owner: caster,
          startX: mStartX,
          startY: mStartY,
          targetX: mTargetX,
          targetY: mTargetY,
          dmgPacket:
            skill.id === 250
              ? { ...dmgPacket, elemDurationFrames: skill.eLen || 50 }
              : dmgPacket,
          ...(mslRangeOverride !== undefined ? { maxRangeTicks: mslRangeOverride } : {}),
          ...(skill.id === 257 ? { nextDelayFrames: 25 } : {}),
        })
        if (m) missilesSpawned.push(m.name)
        if (skill.id === 257) {
          // 1.13c SrvDo044 (Blade Sentinel): spawns srvmissilea = 'blade creeper' (#392) AND summon = 'bladecreeper' (hcIdx = 413).
          const petRes = summonManager.createPet({
            owner: caster,
            skillId: 257,
            slvl: evalResult.slvl,
            x: mTargetX,
            y: mTargetY,
          })
          if (petRes.created && petRes.pet) {
            petsSummoned.push(petRes.pet.monId)
          }
        }
        if (skill.id === 256) {
          const groundSpike = missileEngine.spawnMissile({
            missileNameOrId: 'shock field on ground',
            sourceSkillId: 256,
            slvl: evalResult.slvl,
            owner: caster,
            startX: mTargetX,
            startY: mTargetY,
            targetX: mTargetX,
            targetY: mTargetY,
            dmgPacket,
            maxRangeTicks: 90,
            nextDelayFrames: 25,
            vx: 0,
            vy: 0,
          })
          if (groundSpike) {
            missilesSpawned.push(groundSpike.name)
          }
        }
      }
    }

    // Advance missile engine so immediate or close-range missiles land and record damage
    const stepRes = missileEngine.tick(currentTick, targets, targetPositions)
    for (const h of stepRes.hits) {
      totalDamageDealt += h.damage
    }
    for (const sub of stepRes.subMissilesSpawned) {
      missilesSpawned.push(sub)
    }

    // Skill 243: Shock Wave (MISSMODE_SrvDmg07_Warcry_ShockWave @ 0x6FC59600)
    // Stun duration = min(250, 40 + (slvl - 1) * 15) frames on non-boss targets
    if (skill.id === 243) {
      const swStunFrames = Math.min(250, 40 + (evalResult.slvl - 1) * 15)
      const canStunTarget = (t: CombatUnitContext) =>
        !t.isBoss &&
        !t.isChampion &&
        t.rank !== 'boss' &&
        t.rank !== 'champion' &&
        t.rank !== 'unique' &&
        t.statList.getAccruedStat('is_boss') <= 0
      for (const h of stepRes.hits) {
        const hitTarget = targets.find(t => t.id === h.targetId)
        if (hitTarget && canStunTarget(hitTarget)) {
          hitTarget.stateBus.applyState({
            stateNameOrId: 'stun',
            sourceUnitId: caster.id,
            sourceSkillId: 243,
            slvl: evalResult.slvl,
            durationFrames: swStunFrames,
            currentFrame: currentTick,
          })
          if (!statesApplied.includes('stun')) {
            statesApplied.push('stun')
          }
        }
      }
      if (stepRes.hits.length === 0) {
        const primaryTarget = targets.find(t => t.statList.getHp256() > 0 && canStunTarget(t))
        if (primaryTarget) {
          primaryTarget.stateBus.applyState({
            stateNameOrId: 'stun',
            sourceUnitId: caster.id,
            sourceSkillId: 243,
            slvl: evalResult.slvl,
            durationFrames: swStunFrames,
            currentFrame: currentTick,
          })
          if (!statesApplied.includes('stun')) {
            statesApplied.push('stun')
          }
        }
      }
    }

    // For stationary ground controllers (`Fire Wall` 51, `Meteor` 56, `Blizzard` 59, `Fissure` 234, `Volcano` 244, `Armageddon` 249, `Hurricane` 250),
    // or close-range ranged/thrown attacks when targets are provided without position map,
    // apply the damage packet to primary target
    if (
      totalDamageDealt === 0 &&
      ([24, 28, 123, 124].includes(effectiveDoFunc) ||
        skill.id === 243 ||
        isRangedBasicAttack ||
        isThrowSkill ||
        isAmaJavelinThrowSkill)
    ) {
      const primaryTarget = targets.find(t => t.statList.getHp256() > 0)
      if (primaryTarget) {
        const fallbackHitCount = skill.id === 140 ? 2 : 1
        for (let tIdx = 0; tIdx < fallbackHitCount; tIdx += 1) {
          const useOffHand =
            (isOffHandThrow || (skill.id === 140 && tIdx === 1)) &&
            (caster.offHandMinPhys !== undefined || caster.offHandMaxPhys !== undefined)
          const effectiveCaster = useOffHand
            ? {
                ...caster,
                weaponMinPhys: caster.offHandMinPhys ?? resolveDefaultWeaponMinPhys(caster),
                weaponMaxPhys: caster.offHandMaxPhys ?? resolveDefaultWeaponMaxPhys(caster),
              }
            : caster
          const out = executeSUnitDmg(effectiveCaster, primaryTarget, {
            ...dmgPacket,
            flatPhysMin256: evalResult.minPhysDmg * FIXED_ONE,
            flatPhysMax256: evalResult.maxPhysDmg * FIXED_ONE,
          }, skillRng)
          totalDamageDealt += out.totalDamage
        }
      }
    }

    // 1.13c Ground Truth: D2Game SkillDruid.cpp:957 (SKILLS_SrvDo124_Armageddon_Hurricane)
    // Armageddon (#249) & Hurricane (#250) attach a persistent aura state to the caster with scaling duration
    if (skill.id === 249 || skill.id === 250 || effectiveDoFunc === 124) {
      const auraStateName = evalResult.auraState || (skill.id === 249 ? 'armageddon' : 'hurricane')
      if (auraStateName && caster.stateBus) {
        const auraDuration = evalResult.durationFrames > 0 ? evalResult.durationFrames : 250
        caster.stateBus.applyState({
          stateNameOrId: auraStateName,
          sourceUnitId: caster.id,
          sourceSkillId: skill.id,
          slvl: evalResult.slvl,
          durationFrames: auraDuration,
          currentFrame: currentTick,
          stats: {},
        })
        statesApplied.push(auraStateName)
      }
    }

    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes,
    }
  }

  // 11. Melee, Martial Arts Charge-up / Finisher, Multi-Hit (`Zeal`, `Fend`, `Fury`, `Jab`, `Frenzy`, `Whirlwind`, `Smite`, `Sacrifice`, `Berserk`, `Kick`, `Left Hand Swing`)
  if (isAmaJavelinMeleeSkill) {
    const wType = (caster.weaponItemType ?? '').toLowerCase()
    const invalidJavMeleeWeapon =
      caster.isRanged === true ||
      (wType !== '' &&
        !['spea', 'aspe', 'jave', 'ajav', 'spear', 'javelin', 'mele', 'melee'].includes(wType))
    if (invalidJavMeleeWeapon) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'invalid_weapon',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'invalid_weapon'],
      }
    }
  }

  if (skill.id === 5 && caster.hasOffHandWeapon === false) {
    return {
      skillId: skill.id,
      name: skill.name,
      executed: false,
      error: 'no_offhand_weapon',
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: 0,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt,
      notes: [...notes, 'no_offhand_weapon'],
    }
  }

  // 1.13c Skill #132 Leap (`srvDoFunc = 77`, SKILLS_SrvDo077_Leap @ 0x6FC484B0):
  // Pure parabolic movement (0 damage, srcDam = 0) with radial knockback (`4 + (slvl - 1)` subtiles) on landing.
  if (skill.id === 132 || effectiveDoFunc === 77) {
    const leapDistSubtiles = computeDiminishingReturns(4, 30, evalResult.slvl)
    const kbRadiusSubtiles = 4 + (evalResult.slvl - 1)
    notes.push(
      `leaped:${String(Math.round(targetX))},${String(Math.round(targetY))}`,
      `leap_distance_subtiles:${leapDistSubtiles}`,
      `leap_knockback_radius:${kbRadiusSubtiles}`,
    )
    for (const t of targets) {
      if (t.statList.getHp256() <= 0) continue
      const isBoss = Boolean(
        t.isBoss || t.rank === 'boss' || t.statList.getAccruedStat('is_boss') > 0,
      )
      if (isBoss) continue
      const tPos = targetPositions?.get(t.id)
      if (tPos) {
        const distPx = Math.hypot(tPos.x - targetX, tPos.y - targetY)
        // Accept either pixel coordinates (1 subtile = 16 px) or subtile coordinates
        if (distPx > kbRadiusSubtiles * 16) continue
      }
      ;(t as { knockedBack?: boolean }).knockedBack = true
      notes.push(`knockback:${t.id}`)
      if (!statesApplied.includes('knockback')) {
        statesApplied.push('knockback')
      }
    }
    return {
      skillId: skill.id,
      name: skill.name,
      executed: true,
      srvDoFuncUsed: effectiveDoFunc,
      manaSpent256: evalResult.manaCost256,
      missilesSpawned,
      statesApplied,
      petsSummoned,
      corpsesConsumed,
      totalDamageDealt: 0,
      notes,
    }
  }

  // 1.13c Skill #151 Whirlwind (`srvDoFunc = 76`, SKILLS_SrvDo076_Whirlwind @ 0x6FC48B50):
  // Applies `whirlwind` state (#94 / #174) and `skill_move` state (#18) while spinning.
  let whirlwindHitCount = 0
  if (skill.id === 151 || effectiveDoFunc === 76) {
    const wwTotalFrames = (ctx as { whirlwindFrames?: number }).whirlwindFrames ?? 16
    const wwWeaponIas =
      (caster as { weaponIas?: number }).weaponIas ??
      caster.statList.getAccruedStat('item_fasterattackrate') ??
      0
    const wwWeaponBaseSpeed = (caster as { weaponBaseSpeed?: number }).weaponBaseSpeed ?? 0
    const wwDualWield = Boolean(
      caster.hasDualWield || caster.isDualWielding || caster.hasOffHandWeapon,
    )
    const wwTwoHandedNonSword = Boolean(
      (caster as { isTwoHandedNonSword?: boolean }).isTwoHandedNonSword,
    )
    const wwFrames = calculateWhirlwindHitFrames(
      wwTotalFrames,
      wwWeaponIas,
      wwWeaponBaseSpeed,
      wwDualWield,
      wwTwoHandedNonSword,
    )
    whirlwindHitCount = Math.max(1, wwFrames.hitFrames.length * (wwDualWield ? 2 : 1))
    notes.push(
      `whirlwind_hit_frames:${wwFrames.hitFrames.join(',')}`,
      `whirlwind_interval:${wwFrames.hitInterval}`,
      'suppress_ctc',
    )
    caster.stateBus.applyState({
      stateNameOrId: 'whirlwind',
      sourceUnitId: caster.id,
      sourceSkillId: 151,
      slvl: evalResult.slvl,
      durationFrames: Math.max(4, wwTotalFrames),
      currentFrame: currentTick,
      stats: {},
    })
    if (!statesApplied.includes('whirlwind')) {
      statesApplied.push('whirlwind')
    }
  }

  // 1.13c Skill #152 Berserk (`srvDoFunc = 2`, SKILLS_SrvSt39_Berserk @ 0x6FC48C80):
  // Applies `berserk` state (#95) to caster with `armor_override_percent = -100` (0 Defense) for `75 - dm(25, 75, slvl)` frames.
  if (skill.id === 152) {
    const berserkDur =
      evalResult.durationFrames > 0
        ? evalResult.durationFrames
        : 75 - computeDiminishingReturns(25, 75, evalResult.slvl)
    caster.stateBus.applyState({
      stateNameOrId: 'berserk',
      sourceUnitId: caster.id,
      sourceSkillId: 152,
      slvl: evalResult.slvl,
      durationFrames: berserkDur,
      currentFrame: currentTick,
      stats: {
        damagepercent: evalResult.physDamagePct,
        armor_override_percent: -100,
      },
    })
    if (!statesApplied.includes('berserk')) {
      statesApplied.push('berserk')
    }
    notes.push(`berserk_zero_defense:${berserkDur}f`)
  }

  const primaryTarget = targets.find(t => t.statList.getHp256() > 0)
  if (primaryTarget) {
    // Dragon Claw requirement: dual claws
    if (skill.id === 260 && caster.isDualClaw === false) {
      return {
        skillId: skill.id,
        name: skill.name,
        executed: false,
        error: 'requires_dual_claws',
        srvDoFuncUsed: effectiveDoFunc,
        manaSpent256: 0,
        missilesSpawned,
        statesApplied,
        petsSummoned,
        corpsesConsumed,
        totalDamageDealt,
        notes: [...notes, 'requires_dual_claws'],
      }
    }

    // Dragon Flight teleport to target
    if (skill.id === 275) {
      notes.push(`teleported:${String(Math.round(targetX))},${String(Math.round(targetY))}`)
    }

    // Leap Attack (#143, srvDoFunc = 78): jump to target (or in-place ground strike) + landing knockback radius
    if (skill.id === 143 || effectiveDoFunc === 78) {
      const kbRadius = 4 + 2 * (evalResult.slvl - 1)
      notes.push(
        `leap_attack:${String(Math.round(targetX))},${String(Math.round(targetY))}`,
        `leap_attack_knockback_radius:${kbRadius}`,
      )
    }

    // Charge (#107, srvDoFunc = 67): 1.13c SKILLS_SrvSt12_Charge (0x6FD13440) & SKILLS_SrvDo067_Charge (0x6FD13610)
    // Applies STATE_SKILL_MOVE (#97, velocitypercent = +150%) during sprint and closes gap to target
    if (skill.id === 107 || effectiveDoFunc === 67) {
      notes.push(`charged:${String(Math.round(targetX))},${String(Math.round(targetY))}`, 'skill_move:velocitypercent=150')
    }

    // 1.13c Fend (#30): SKILLS_SrvSt09_Fend (0x6FC6C600) & SKILLS_SrvDo013_Fend_Zeal_Fury (0x6FC6DAC0)
    // Counts distinct living melee enemies up to calc1 = 12, striking each target at most once!
    const fendTargets =
      skill.id === 30 ? targets.filter(t => t.statList.getHp256() > 0).slice(0, 12) : undefined

    // Multi-hit combo hits
    // Jab (10 / 7): strictly 3 rapid melee thrusts per sequence (seqnum = 1)
    // Fend (30): 1 strike per distinct living enemy in range (capped at 12)
    // Dragon Talon (255 / 42): 1 + floor(slvl / 6) kicks (uncapped)
    // Dragon Claw (260 / 46), Double Swing (133 / 70), Frenzy (147 / 9): strictly 2 strikes
    // Whirlwind (151 / 76): frame-breakpoint driven (`whirlwindHitCount`)
    // Zeal (106): min(slvl + 1, 5) per par5=2, par6=5
    // Others: min 5, max 2
    const isDualClawCaster = Boolean(
      caster.isDualClaw ||
        caster.hasDualWield ||
        caster.isDualWielding ||
        caster.hasOffHandWeapon ||
        (caster.offHandWeaponItemType &&
          ['h2h', 'h2h2', 'claw'].includes(caster.offHandWeaponItemType.toLowerCase())) ||
        (caster.offHandWeaponType &&
          ['h2h', 'h2h2', 'claw'].includes(caster.offHandWeaponType.toLowerCase())) ||
        caster.offHandMinPhys !== undefined ||
        caster.offHandMaxPhys !== undefined,
    )

    if (skill.id === 275 || effectiveDoFunc === 52) {
      missilesSpawned.push('dragonflight')
      notes.push(`dragon_flight_teleport:${String(Math.round(targetX))},${String(Math.round(targetY))}`)
    }

    const hitCount =
      skill.id === 10 || effectiveDoFunc === 7
        ? 3
        : fendTargets !== undefined
          ? fendTargets.length
          : skill.id === 151 || effectiveDoFunc === 76
            ? whirlwindHitCount
            : skill.id === 255 || effectiveDoFunc === 42
              ? 1 + Math.floor(evalResult.slvl / 6)
              : (skill.id === 259 || skill.id === 269 || skill.id === 274 || effectiveDoFunc === 35)
                ? (isDualClawCaster ? 2 : 1)
                : skill.id === 260 ||
                    effectiveDoFunc === 46 ||
                    skill.id === 133 ||
                    skill.id === 147 ||
                    effectiveDoFunc === 6 ||
                    effectiveDoFunc === 9 ||
                    effectiveDoFunc === 70
                  ? 2
                  : skill.id === 106 || skill.id === 248
                    ? Math.min(5, Math.max(2, 1 + evalResult.slvl))
                    : effectiveDoFunc === 13
                      ? Math.min(5, Math.max(2, 1 + Math.trunc(evalResult.slvl / 4)))
                      : 1

    if (skill.id === 248) {
      notes.push('uninterruptible')
    }

    const isFinisher = [255, 260, 270, 275].includes(skill.id) || skill.id === 0 || effectiveDoFunc === 42 || effectiveDoFunc === 46
    let chargesDischarged = false

    // Skill #144 Concentrate: apply `concentrate` state (`stateId = 15`) with +10% Def/blvl from #145 Iron Skin and uninterruptible flag
    if (skill.id === 144) {
      const ironSkinBlvl = caster.statList.getBaseSkillLevel(145)
      const concDefPct = 100 + (evalResult.slvl - 1) * 10 + ironSkinBlvl * 10
      caster.stateBus.applyState({
        stateNameOrId: 'concentrate',
        sourceUnitId: caster.id,
        sourceSkillId: 144,
        slvl: evalResult.slvl,
        durationFrames: 25,
        currentFrame: currentTick,
        stats: {
          skill_armor_percent: concDefPct,
          item_armor_percent: concDefPct,
        },
      })
      if (!statesApplied.includes('concentrate')) {
        statesApplied.push('concentrate')
      }
      notes.push('uninterruptible')
    }

    // Smite (97): Shield base damage + Holy Shield flat damage
    const isSmite = skill.id === 97
    let smiteMin256 = 0
    let smiteMax256 = 0
    if (isSmite) {
      const shieldMin = caster.statList.getAccruedStat('shield_min_damage') || 2
      const shieldMax = caster.statList.getAccruedStat('shield_max_damage') || 5
      const hsMin = caster.statList.getAccruedStat('smite_flat_min') || 0
      const hsMax = caster.statList.getAccruedStat('smite_flat_max') || 0
      smiteMin256 = (shieldMin + hsMin) * FIXED_ONE
      smiteMax256 = (shieldMax + hsMax) * FIXED_ONE
    }

    // Kick (#1, #255 Dragon Talon, #270 Dragon Tail, #275 Dragon Flight):
    // 1.13c SKILLS_CalculateKickDamage (0x6FC9AE10):
    // base = floor((dex + str - 20) / 4) * (100 + skillED) / 100 + floor(bootDmg * (100 + floor(str * 120 / 100) + offWeaponED + skillED) / 100)
    const isKick = skill.id === 1 || skill.id === 255 || skill.id === 270 || skill.id === 275
    let kickMin256 = 0
    let kickMax256 = 0
    if (isKick) {
      const str = caster.statList.getAccruedStat('strength') || 20
      const dex = caster.statList.getAccruedStat('dexterity') || 20
      const bootMin = caster.bootMinDam ?? caster.kickMinDam ?? 0
      const bootMax = caster.bootMaxDam ?? caster.kickMaxDam ?? 0
      const skillED = skill.id === 255 || skill.id === 275 ? evalResult.physDamagePct : 0
      const offWeaponED = caster.statList.getModifierBonus('damagepercent')
      const attrMin = Math.max(1, Math.floor(Math.max(0, dex + str - 20) / 4))
      const attrMax = Math.max(2, Math.floor(Math.max(0, dex + str - 20) / 3))
      const strBootBonus = Math.floor((str * 120) / 100)
      const kickMin =
        Math.floor((attrMin * (100 + skillED)) / 100) +
        Math.floor((bootMin * (100 + strBootBonus + offWeaponED + skillED)) / 100)
      const kickMax =
        Math.floor((attrMax * (100 + skillED)) / 100) +
        Math.floor((bootMax * (100 + strBootBonus + offWeaponED + skillED)) / 100)
      kickMin256 = kickMin * FIXED_ONE
      kickMax256 = kickMax * FIXED_ONE
      notes.push(`kick_damage:${kickMin}-${kickMax}`)
      if (skill.id === 1 || skill.id === 270) {
        notes.push('knockback')
      }
    }

    // Left Hand Swing (5): uses offHandMinPhys / offHandMaxPhys when provided
    const isLeftHandSwing = skill.id === 5
    const effectiveMeleeCaster: CombatUnitContext =
      isLeftHandSwing && (caster.offHandMinPhys !== undefined || caster.offHandMaxPhys !== undefined)
        ? {
            ...caster,
            weaponMinPhys: caster.offHandMinPhys ?? resolveDefaultWeaponMinPhys(caster),
            weaponMaxPhys: caster.offHandMaxPhys ?? resolveDefaultWeaponMaxPhys(caster),
          }
        : isKick
          ? {
              ...caster,
              weaponMinPhys: 0,
              weaponMaxPhys: 0,
            }
          : caster

    // Vengeance (111): Multi-elemental packet (Fire, Cold, Lightning)
    const isVengeance = skill.id === 111
    const vengeanceMultiPacket = isVengeance
      ? {
          firePct: 70 + (evalResult.slvl - 1) * 6 + caster.statList.getBaseSkillLevel(100) * 10 + caster.statList.getBaseSkillLevel(125) * 2,
          coldPct: 70 + (evalResult.slvl - 1) * 6 + caster.statList.getBaseSkillLevel(105) * 10 + caster.statList.getBaseSkillLevel(125) * 2,
          ltngPct: 70 + (evalResult.slvl - 1) * 6 + caster.statList.getBaseSkillLevel(110) * 10 + caster.statList.getBaseSkillLevel(125) * 2,
          chillDurationFrames: 30 + (evalResult.slvl - 1) * 15,
        }
      : undefined

    // For Charged Strike (#24) and Lightning Strike (#34), skill lightning damage is carried by the spawned missiles
    // (`chargedstrikebolt` #215 and `lightningstrike` #232), whereas Power Strike (#14) applies it directly on the melee hit.
    // For Assassin Charge-up skills (#259 Fists of Fire, #269 Claws of Thunder, #274 Blades of Ice, #280 Phoenix Strike),
    // 1.13c SKILLS_SrvDo034 / SKILLS_SrvDo035 only deals normal weapon physical damage and adds 1 charge;
    // elemental payloads trigger ONLY when discharged by a Finisher!
    const meleeAppliesSkillElem =
      skill.id !== 24 &&
      skill.id !== 34 &&
      skill.id !== 259 &&
      skill.id !== 269 &&
      skill.id !== 274 &&
      skill.id !== 280

    notes.push(`melee_hits:${hitCount}`)
    let curTarget: CombatUnitContext | undefined = primaryTarget
    for (let h = 0; h < hitCount; h += 1) {
      if (fendTargets !== undefined) {
        curTarget = fendTargets[h]
        if (!curTarget || curTarget.statList.getHp256() <= 0) continue
      } else {
        // Sequential retargeting if current target died
        if (!curTarget || curTarget.statList.getHp256() <= 0) {
          curTarget = targets.find(t => t.statList.getHp256() > 0)
          if (!curTarget) break
        }
      }

      // Dragon Talon knockback on final kick only
      const isFinalKick = (skill.id === 255 || effectiveDoFunc === 42) && h === hitCount - 1

      const isPoisonMelee = (skill.id === 73 || skill.id === 238) && evalResult.durationFrames > 0
      const meleeElemMin256 = meleeAppliesSkillElem
        ? isPoisonMelee
          ? evalResult.minElemDmg256 * evalResult.durationFrames
          : evalResult.minElemDmg256
        : 0
      const meleeElemMax256 = meleeAppliesSkillElem
        ? isPoisonMelee
          ? evalResult.maxElemDmg256 * evalResult.durationFrames
          : evalResult.maxElemDmg256
        : 0
      const berserkBlvlForConversion = caster.statList.getBaseSkillLevel(152)
      const physToElemPct =
        skill.id === 152
          ? 100
          : skill.id === 144 || skill.id === 147
            ? Math.min(100, berserkBlvlForConversion)
            : 0
      const isDualWieldSecondSwing =
        (skill.id === 133 ||
          skill.id === 147 ||
          skill.id === 260 ||
          skill.id === 259 ||
          skill.id === 269 ||
          skill.id === 274 ||
          (skill.id === 151 && h % 2 === 1)) &&
        h % 2 === 1 &&
        (caster.offHandMinPhys !== undefined || caster.offHandMaxPhys !== undefined)
      const swingCaster: CombatUnitContext = isDualWieldSecondSwing
        ? {
            ...effectiveMeleeCaster,
            weaponMinPhys: caster.offHandMinPhys ?? resolveDefaultWeaponMinPhys(effectiveMeleeCaster),
            weaponMaxPhys: caster.offHandMaxPhys ?? resolveDefaultWeaponMaxPhys(effectiveMeleeCaster),
          }
        : effectiveMeleeCaster
      const maulExistingForHit = skill.id === 233 ? caster.stateBus.getState('maul') : undefined
      const maulPrevChargeForHit =
        maulExistingForHit?.stats?.charge ?? maulExistingForHit?.stats?.progressive_charges ?? 0
      const maulMaxChargesForHit = Math.floor(evalResult.slvl / 2) + 3
      const maulChargeForHit = advanceChargeOrb(maulPrevChargeForHit, maulMaxChargesForHit)
      const maulStatsForHit =
        skill.id === 233 ? calculateMaulStats(evalResult.slvl, maulChargeForHit) : undefined
      const stunFramesForHit = isSmite
        ? Math.min(250, 15 + (evalResult.slvl - 1) * 5)
        : skill.id === 139
          ? evalResult.durationFrames > 0
            ? Math.min(250, evalResult.durationFrames)
            : calculateStunStats(
                evalResult.slvl,
                caster.statList.getBaseSkillLevel(126),
                caster.statList.getBaseSkillLevel(154),
                caster.statList.getBaseSkillLevel(144),
              ).stunDurationFrames
          : skill.id === 233
            ? maulStatsForHit!.stunDurationFrames
            : undefined
      // 1.13c SKILLS_SrvDo122_Hunger (0x6FC65000): temporary stat list injection of lifedrainmindam & manadrainmindam
      const isHunger = skill.id === 242
      const hungerLeechPct = isHunger ? computeDiminishingReturns(50, 200, evalResult.slvl) : 0
      if (isHunger) {
        caster.statList.addOrUpdateModifier({
          id: 'temp:hunger_leech',
          stateName: 'hunger_temp',
          stateId: 0,
          sourceUnitId: caster.id,
          sourceSkillId: 242,
          slvl: evalResult.slvl,
          expireFrame: 0,
          isAura: false,
          isCurse: false,
          curseType: 0,
          stats: {
            lifedrainmindam: hungerLeechPct,
            manadrainmindam: hungerLeechPct,
          },
        })
      }
      const out = executeSUnitDmg(swingCaster, curTarget, {
        skillId: skill.id,
        attackKind: 'melee',
        srcDam: isSmite || isKick || skill.id === 238 ? 0 : (skill.srcDam || 128),
        physDamagePct:
          isKick
            ? 0
            : skill.id === 242
              ? -75
              : skill.id === 233
                ? maulStatsForHit!.damageBonusPct
                : evalResult.physDamagePct,
        ...(evalResult.toHitBonusPct !== 0 ? { toHitBonusPct: evalResult.toHitBonusPct } : {}),
        flatPhysMin256: isSmite ? smiteMin256 : isKick ? kickMin256 : (evalResult.minPhysDmg * FIXED_ONE),
        flatPhysMax256: isSmite ? smiteMax256 : isKick ? kickMax256 : (evalResult.maxPhysDmg * FIXED_ONE),
        elemType: physToElemPct > 0 && skill.id !== 152 ? 'mag' : (meleeAppliesSkillElem ? evalResult.elemType : 'phys'),
        elemMin256: meleeElemMin256,
        elemMax256: meleeElemMax256,
        ...(isPoisonMelee ? { elemDurationFrames: evalResult.durationFrames } : {}),
        physToElemPct, // Berserk converts 100% physical to Magic; Concentrate/Frenzy convert 1%/blvl in Berserk (#152)
        autoHit: isSmite, // Smite (`97`) always hits
        unblockable: isSmite,
        stunDurationFrames: stunFramesForHit,
        knockback:
          isSmite ||
          skill.id === 1 ||
          skill.id === 270 ||
          skill.id === 107 ||
          skill.id === 126 ||
          skill.id === 143 ||
          isFinalKick,
        suppressGearLeech: isSmite,
        canTriggerProcs: skill.id !== 151 && effectiveDoFunc !== 76,
        multiElemPacket: vengeanceMultiPacket,
        selfDamagePct: skill.id === 96 ? 8 : undefined,
      }, skillRng)
      if (isHunger) {
        // The injected lifedrainmindam / manadrainmindam are stolen inside executeSUnitDmg by the
        // shared 0x6FCFBA40 steal path (difficulty divisor + MonStats Drain), no extra heal here.
        caster.statList.removeModifiersByState('hunger_temp')
        notes.push(`hunger_leech:${hungerLeechPct}%`)
      }
      totalDamageDealt += out.totalDamage

      const isSuccessfulHit = out.hit || out.totalDamage > 0
      if (isSuccessfulHit) {
        if (skill.id === 0 || skill.id === 5 || skill.id === 10) {
          caster.statList.drainEquippedWeaponDurability?.(1)
        }
        // Skill #139 Stun: apply `stunned` state (`stateId = 28`) on target if not a boss
        if (skill.id === 139 && stunFramesForHit && stunFramesForHit > 0) {
          const isTargetBoss = Boolean(
            curTarget.isBoss ||
              curTarget.rank === 'boss' ||
              curTarget.statList.getAccruedStat('is_boss') > 0,
          )
          if (!isTargetBoss) {
            curTarget.stateBus.applyState({
              stateNameOrId: 'stunned',
              sourceUnitId: caster.id,
              sourceSkillId: 139,
              slvl: evalResult.slvl,
              durationFrames: stunFramesForHit,
              currentFrame: currentTick,
            })
            if (!statesApplied.includes('stunned')) {
              statesApplied.push('stunned')
            }
          }
        }
        // Skill #147 Frenzy: increment Frenzy stack `nValue = min(slvl, prev + 1)` on each connecting hit
        // and apply `dm(20, 200, nValue)` run/walk speed (`stat 67`) and `dm(0, 50, nValue)` attack rate (`stat 68`)
        if (skill.id === 147) {
          const incStaminaBlvl = caster.statList.getBaseSkillLevel(141)
          const frenzyDur = evalResult.durationFrames > 0 ? evalResult.durationFrames : 150 + incStaminaBlvl * 10
          const existingFrenzy = caster.stateBus.getState('frenzy')
          const prevStacks = existingFrenzy?.stats?.frenzy_stacks ?? 0
          const nValue = Math.min(evalResult.slvl, prevStacks + 1)
          const curIas = computeDiminishingReturns(0, 50, nValue)
          const curFrw = computeDiminishingReturns(20, 200, nValue)
          caster.stateBus.applyState({
            stateNameOrId: 'frenzy',
            sourceUnitId: caster.id,
            sourceSkillId: 147,
            slvl: evalResult.slvl,
            durationFrames: frenzyDur,
            currentFrame: currentTick,
            stats: {
              frenzy_stacks: nValue,
              attackrate: curIas,
              velocitypercent: curFrw,
            },
          })
          if (!statesApplied.includes('frenzy')) {
            statesApplied.push('frenzy')
          }
        }
        // 1.13c Impale (#19): SKILLS_SrvDo002 (0x6FCC3220) extra durability loss roll: calc2 = 50 - dm(0, 30, slvl)%
        if (skill.id === 19) {
          const durLossChancePct = 50 - computeDiminishingReturns(0, 30, evalResult.slvl)
          notes.push(`impale_durability_loss:chance=${durLossChancePct}`)
          if (rollSkill100(ctx) < durLossChancePct) {
            caster.statList.drainEquippedWeaponDurability?.(1)
          }
        }
        // Progressive charge accumulation on hit (1.13c: 375 frames / 15s)
        if (skill.progressive) {
          const chargeState = skill.auraState || skill.name.toLowerCase().replace(/\s+/g, '')
          const existing = caster.stateBus.getState(chargeState)
          const prevCharge = existing?.stats?.charge ?? existing?.stats?.progressive_charges ?? 0
          const nextCharge = Math.min(3, prevCharge + 1)
          caster.stateBus.applyState({
            stateNameOrId: chargeState,
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: 375,
            currentFrame: currentTick,
            stats: {
              charge: nextCharge,
              progressive_charges: nextCharge,
            },
          })
          if (!statesApplied.includes(chargeState)) {
            statesApplied.push(chargeState)
          }
          notes.push(`${chargeState}: charged to ${nextCharge}`)
        }

        // Finisher discharge on first connecting hit
        let activeFofConvPct = 0
        if (isFinisher && !chargesDischarged) {
          const PROGRESSIVE_MAPPINGS = [
            { skillId: 254, stateNames: ['progressive_damage', 'tigerstrike'] },
            { skillId: 259, stateNames: ['progressive_fire', 'fistsoffire'] },
            { skillId: 265, stateNames: ['progressive_steal', 'cobrastrike'] },
            { skillId: 269, stateNames: ['progressive_lightning', 'clawsofthunder'] },
            { skillId: 274, stateNames: ['progressive_cold', 'bladesofice'] },
            { skillId: 280, stateNames: ['progressive_other', 'royalstrike', 'phoenixstrike'] },
          ]
          const activeCharges: ActiveChargeOrb[] = []
          for (const mapping of PROGRESSIVE_MAPPINGS) {
            for (const stName of mapping.stateNames) {
              const st = caster.stateBus.getState(stName)
              if (st) {
                const count = st.stats?.charge ?? st.stats?.progressive_charges ?? 1
                activeCharges.push({
                  skillId: mapping.skillId,
                  count,
                  slvl: st.slvl,
                  expiresAtFrame: st.expireFrame,
                })
                break
              }
            }
          }

          if (activeCharges.length > 0) {
            const fofOrb = activeCharges.find(c => c.skillId === 259)
            if (fofOrb) {
              activeFofConvPct = Math.min(100, fofOrb.slvl * 3)
            }
            const cPos = curTarget
              ? (targetPositions?.get(curTarget.id) ?? { x: targetX, y: targetY })
              : { x: targetX, y: targetY }

            const payloads = resolveFinisherDischarge(activeCharges, {
              clawMasteryBlvl: caster.statList.getBaseSkillLevel(252),
              fistsOfFireBlvl: caster.statList.getBaseSkillLevel(259),
              clawsOfThunderBlvl: caster.statList.getBaseSkillLevel(269),
              bladesOfIceBlvl: caster.statList.getBaseSkillLevel(274),
              royalStrikeBlvl: caster.statList.getBaseSkillLevel(280),
            })

            let finisherPhysBase = out.totalDamage
            for (const payload of payloads) {
              // Tiger Strike
              if (payload.enhancedDamagePct && curTarget) {
                const bonusPhys = Math.floor((out.totalDamage * payload.enhancedDamagePct) / 100)
                if (bonusPhys > 0) {
                  const bOut = executeSUnitDmg(caster, curTarget, {
                    skillId: payload.skillId,
                    attackKind: 'melee',
                    flatPhysMin256: bonusPhys * FIXED_ONE,
                    flatPhysMax256: bonusPhys * FIXED_ONE,
                    autoHit: true,
                  }, skillRng)
                  totalDamageDealt += bOut.totalDamage
                  finisherPhysBase += bOut.totalDamage
                }
              }
            }

            // 1.13c Fists of Fire (#259) physical-to-fire conversion (`min(100, 3 * slvl)%`)
            // happens BEFORE Cobra Strike leech and Dragon Tail explosion calculation!
            const postFofPhysDamage = Math.floor((finisherPhysBase * (100 - activeFofConvPct)) / 100)
            if (activeFofConvPct > 0 && curTarget) {
              const convertedFireDmg = finisherPhysBase - postFofPhysDamage
              notes.push(`fists_of_fire_phys_to_fire_pct:${activeFofConvPct}`, `fists_of_fire_converted_fire:${convertedFireDmg}`)
            }

            for (const payload of payloads) {
              // Cobra Strike (leeches from post-conversion physical damage)
              if (payload.lifeStealPct) {
                const lifeHeal = Math.floor((postFofPhysDamage * payload.lifeStealPct) / 100)
                caster.statList.setHp256(caster.statList.getHp256() + lifeHeal * FIXED_ONE)
              }
              if (payload.manaStealPct) {
                const manaGain = Math.floor((postFofPhysDamage * payload.manaStealPct) / 100)
                caster.statList.setMana256(caster.statList.getMana256() + manaGain * FIXED_ONE)
              }
              // Fists of Fire (#259): C1 direct fire, C2 radial fire explosion (4 subtiles), C3 firewall (64 frames)
              if (payload.fireDamage && curTarget) {
                const fOut = executeSUnitDmg(caster, curTarget, {
                  skillId: payload.skillId,
                  attackKind: 'spell',
                  elemType: 'fire',
                  elemMin256: payload.fireDamage.min * FIXED_ONE,
                  elemMax256: payload.fireDamage.max * FIXED_ONE,
                  autoHit: true,
                }, skillRng)
                totalDamageDealt += fOut.totalDamage
                if (payload.chargeLevel >= 2) {
                  missilesSpawned.push('fistsoffireexplode')
                  const expRadPx = payload.fireDamage.explosionRadiusPx ?? 64
                  for (const t of targets) {
                    if (t.id === curTarget.id || t.statList.getHp256() <= 0) continue
                    const tPos = targetPositions?.get(t.id)
                    if (tPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > expRadPx) continue
                    const expOut = executeSUnitDmg(caster, t, {
                      skillId: payload.skillId,
                      attackKind: 'spell',
                      elemType: 'fire',
                      elemMin256: payload.fireDamage.min * FIXED_ONE,
                      elemMax256: payload.fireDamage.max * FIXED_ONE,
                      autoHit: true,
                    }, skillRng)
                    totalDamageDealt += expOut.totalDamage
                  }
                }
                if (payload.chargeLevel >= 3) {
                  missilesSpawned.push('fistsoffirefirewall')
                }
              }
              // Claws of Thunder (#269): C1 direct lightning, C2 64-dir nova, C3 16 charged bolts
              if (payload.ltngDamage && curTarget) {
                const lOut = executeSUnitDmg(caster, curTarget, {
                  skillId: payload.skillId,
                  attackKind: 'spell',
                  elemType: 'ltng',
                  elemMin256: payload.ltngDamage.min * FIXED_ONE,
                  elemMax256: payload.ltngDamage.max * FIXED_ONE,
                  autoHit: true,
                }, skillRng)
                totalDamageDealt += lOut.totalDamage
                if (payload.ltngDamage.hasNova) {
                  missilesSpawned.push('clawsofthundernova')
                  for (const t of targets) {
                    if (t.id === curTarget.id || t.statList.getHp256() <= 0) continue
                    const tPos = targetPositions?.get(t.id)
                    if (tPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > 128) continue
                    const novaOut = executeSUnitDmg(caster, t, {
                      skillId: payload.skillId,
                      attackKind: 'spell',
                      elemType: 'ltng',
                      elemMin256: payload.ltngDamage.min * FIXED_ONE,
                      elemMax256: payload.ltngDamage.max * FIXED_ONE,
                      autoHit: true,
                    }, skillRng)
                    totalDamageDealt += novaOut.totalDamage
                  }
                }
                if (payload.ltngDamage.chargedBoltsCount) {
                  const boltCount = payload.ltngDamage.chargedBoltsCount
                  for (let b = 0; b < boltCount; b += 1) {
                    missilesSpawned.push('clawsofthunderbolt')
                  }
                }
              }
              // Blades of Ice (#274): C1 direct cold, C2 radial cold AoE (6 subtiles), C3 freeze AoE (3 subtiles)
              if (payload.coldDamage && curTarget) {
                const chillFrames = 100 + 10 * (payload.slvl - 1)
                const cOut = executeSUnitDmg(caster, curTarget, {
                  skillId: payload.skillId,
                  attackKind: 'spell',
                  elemType: 'cold',
                  elemMin256: payload.coldDamage.min * FIXED_ONE,
                  elemMax256: payload.coldDamage.max * FIXED_ONE,
                  elemDurationFrames: payload.coldDamage.freezeDurationFrames ?? chillFrames,
                  autoHit: true,
                }, skillRng)
                totalDamageDealt += cOut.totalDamage
                if (payload.chargeLevel >= 2) {
                  missilesSpawned.push('bladesoficeexplode')
                  const coldRadPx = 6 * 16 // 6 subtiles = 96 px
                  for (const t of targets) {
                    if (t.id === curTarget.id || t.statList.getHp256() <= 0) continue
                    const tPos = targetPositions?.get(t.id)
                    if (tPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > coldRadPx) continue
                    const aoeOut = executeSUnitDmg(caster, t, {
                      skillId: payload.skillId,
                      attackKind: 'spell',
                      elemType: 'cold',
                      elemMin256: payload.coldDamage.min * FIXED_ONE,
                      elemMax256: payload.coldDamage.max * FIXED_ONE,
                      elemDurationFrames: chillFrames,
                      autoHit: true,
                    }, skillRng)
                    totalDamageDealt += aoeOut.totalDamage
                  }
                }
                if (payload.chargeLevel >= 3 && payload.coldDamage.freezeDurationFrames) {
                  missilesSpawned.push('bladesoficecubes')
                  const frzFrames = payload.coldDamage.freezeDurationFrames
                  const frzRadPx = 3 * 16 // 3 subtiles = 48 px
                  for (const t of targets) {
                    if (t.statList.getHp256() <= 0) continue
                    const tPos = targetPositions?.get(t.id)
                    if (t.id !== curTarget.id && tPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > frzRadPx) continue
                    if (!t.isBoss && t.rank !== 'boss') {
                      t.stateBus.applyState({
                        stateNameOrId: 'freeze',
                        sourceUnitId: caster.id,
                        sourceSkillId: payload.skillId,
                        slvl: payload.slvl,
                        durationFrames: frzFrames,
                        currentFrame: currentTick,
                      })
                      if (!statesApplied.includes('freeze')) {
                        statesApplied.push('freeze')
                      }
                    }
                  }
                }
              }
              // Phoenix Strike (#280): non-stacking (C1 meteor + ground fire, C2 7 chain lightnings, C3 16 chaos ice bolts)
              if (payload.phoenixPayload && curTarget) {
                if (payload.phoenixPayload.type === 'meteor') {
                  missilesSpawned.push('royalstrikemeteorcenter', 'royalstrikemeteorfire')
                  const mMin = payload.phoenixPayload.meteorDamage?.min ?? 20
                  const mMax = payload.phoenixPayload.meteorDamage?.max ?? 40
                  const meteorRadPx = 6 * 16 // 6 subtiles = 96 px
                  for (const t of targets) {
                    if (t.statList.getHp256() <= 0) continue
                    const tPos = targetPositions?.get(t.id)
                    if (t.id !== curTarget.id && tPos && Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y) > meteorRadPx) continue
                    const pOut = executeSUnitDmg(caster, t, {
                      skillId: payload.skillId,
                      attackKind: 'spell',
                      elemType: 'fire',
                      elemMin256: mMin * FIXED_ONE,
                      elemMax256: mMax * FIXED_ONE,
                      autoHit: true,
                    }, skillRng)
                    totalDamageDealt += pOut.totalDamage
                  }
                } else if (payload.phoenixPayload.type === 'chain_lightning') {
                  const boltCount = payload.phoenixPayload.chainLightningDamage?.boltsCount ?? 7
                  for (let b = 0; b < boltCount; b += 1) {
                    missilesSpawned.push('royalstrikechainlightning')
                  }
                  const clMax = payload.phoenixPayload.chainLightningDamage?.max ?? 100
                  const maxBounces = payload.phoenixPayload.chainLightningDamage?.maxTargets ?? (5 + payload.slvl)
                  const livingTargets = targets.filter(t => t.statList.getHp256() > 0)
                  const hitCountForCL = Math.min(maxBounces, Math.max(1, livingTargets.length))
                  for (let bIdx = 0; bIdx < hitCountForCL; bIdx += 1) {
                    const clTarget = livingTargets[bIdx % livingTargets.length] ?? curTarget
                    const pOut = executeSUnitDmg(caster, clTarget, {
                      skillId: payload.skillId,
                      attackKind: 'spell',
                      elemType: 'ltng',
                      elemMin256: 1 * FIXED_ONE,
                      elemMax256: clMax * FIXED_ONE,
                      autoHit: true,
                    }, skillRng)
                    totalDamageDealt += pOut.totalDamage
                  }
                } else if (payload.phoenixPayload.type === 'chaos_ice') {
                  const boltCount = payload.phoenixPayload.chaosIceDamage?.boltsCount ?? 16
                  for (let b = 0; b < boltCount; b += 1) {
                    missilesSpawned.push('royalstrikechaosice')
                  }
                  const ciMin = payload.phoenixPayload.chaosIceDamage?.min ?? 16
                  const ciMax = payload.phoenixPayload.chaosIceDamage?.max ?? 32
                  const frzFrames = payload.phoenixPayload.chaosIceDamage?.freezeFrames ?? 100
                  const pOut = executeSUnitDmg(caster, curTarget, {
                    skillId: payload.skillId,
                    attackKind: 'spell',
                    elemType: 'cold',
                    elemMin256: ciMin * FIXED_ONE,
                    elemMax256: ciMax * FIXED_ONE,
                    elemDurationFrames: frzFrames,
                    autoHit: true,
                  }, skillRng)
                  totalDamageDealt += pOut.totalDamage
                  if (!curTarget.isBoss && curTarget.rank !== 'boss') {
                    curTarget.stateBus.applyState({
                      stateNameOrId: 'freeze',
                      sourceUnitId: caster.id,
                      sourceSkillId: payload.skillId,
                      slvl: payload.slvl,
                      durationFrames: frzFrames,
                      currentFrame: currentTick,
                    })
                    if (!statesApplied.includes('freeze')) {
                      statesApplied.push('freeze')
                    }
                  }
                }
              }
            }

            for (const mapping of PROGRESSIVE_MAPPINGS) {
              for (const stName of mapping.stateNames) {
                caster.stateBus.removeState(stName)
              }
            }
            chargesDischarged = true
            notes.push('finisher_discharged')
          }
        }

        // Dragon Tail (270): 1.13c SKILLS_SrvDo050_DragonTail (0x6FCB3110)
        // Scales off remaining post-resistance, post-Fists-of-Fire-conversion physical damage on primary target,
        // and includes the primary kicked target (`curTarget`) in the 4-yard (6 subtiles = 96 px) Fire AoE!
        if (skill.id === 270 && curTarget) {
          const basePhysDealt =
            out.physDamage256 !== undefined
              ? Math.floor(out.physDamage256 / FIXED_ONE)
              : (out.immuneToPhys ? 0 : out.totalDamage)
          const remainingPhysDmg = Math.floor((basePhysDealt * (100 - activeFofConvPct)) / 100)
          if (remainingPhysDmg > 0) {
            missilesSpawned.push('dragontail missile')
            const fireExplosionPct = 50 + 10 * (evalResult.slvl - 1)
            const fireDmg = Math.floor((remainingPhysDmg * fireExplosionPct) / 100)
            const cPos = targetPositions?.get(curTarget.id) ?? { x: targetX, y: targetY }
            const radiusPx = 6 * 16 // 6 subtiles = 4 yards = 96 px
            for (const t of targets) {
              if (t.statList.getHp256() <= 0) continue
              const tPos = targetPositions?.get(t.id)
              if (t.id !== curTarget.id && tPos) {
                const dist = Math.hypot(tPos.x - cPos.x, tPos.y - cPos.y)
                if (dist > radiusPx) continue
              }
              const dtOut = executeSUnitDmg(caster, t, {
                skillId: skill.id,
                attackKind: 'spell',
                elemType: 'fire',
                elemMin256: fireDmg * FIXED_ONE,
                elemMax256: fireDmg * FIXED_ONE,
                knockback: true,
                autoHit: true,
              }, skillRng)
              totalDamageDealt += dtOut.totalDamage
            }
          }
        }
        // Skill 232: Feral Rage (progressive charge orb on caster, maxCharges = floor(slvl/2) + 3, 20.0s / 500 frames decay timer)
        if (skill.id === 232) {
          const existing = caster.stateBus.getState('feralrage')
          const prevCharge = existing?.stats?.charge ?? existing?.stats?.progressive_charges ?? 0
          const maxCharges = Math.floor(evalResult.slvl / 2) + 3
          const nextCharge = advanceChargeOrb(prevCharge, maxCharges)
          const frStats = calculateFeralRageStats(evalResult.slvl, nextCharge)
          const lifeLeech = frStats.lifeLeechPct
          const velocity = frStats.velocityBonusPct

          caster.stateBus.applyState({
            stateNameOrId: 'feralrage',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: frStats.durationFrames,
            currentFrame: currentTick,
            stats: {
              charge: nextCharge,
              progressive_charges: nextCharge,
              max_charges: maxCharges,
              lifedrainmindam: lifeLeech,
              lifedrainmaxdam: lifeLeech,
              velocitypercent: velocity,
            },
          })
          if (!statesApplied.includes('feralrage')) {
            statesApplied.push('feralrage')
          }
          notes.push(`feralrage: charged to stage ${nextCharge} (+${lifeLeech}% leech, +${velocity}% frw)`)
        }

        // Skill 233: Maul (progressive charge orb on caster, maxCharges = floor(slvl/2) + 3, 20.0s / 500 frames decay timer)
        if (skill.id === 233) {
          const existing = caster.stateBus.getState('maul')
          const prevCharge = existing?.stats?.charge ?? existing?.stats?.progressive_charges ?? 0
          const maxCharges = Math.floor(evalResult.slvl / 2) + 3
          const nextCharge = advanceChargeOrb(prevCharge, maxCharges)
          const maulStats = calculateMaulStats(evalResult.slvl, nextCharge)
          const dmgBonus = maulStats.damageBonusPct

          caster.stateBus.applyState({
            stateNameOrId: 'maul',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: maulStats.durationFrames,
            currentFrame: currentTick,
            stats: {
              charge: nextCharge,
              progressive_charges: nextCharge,
              max_charges: maxCharges,
              damagepercent: dmgBonus,
              stunDurationFrames: maulStats.stunDurationFrames,
              stunlength: maulStats.stunDurationFrames,
            },
          })
          if (!statesApplied.includes('maul')) {
            statesApplied.push('maul')
          }
          if (curTarget && !curTarget.isBoss && maulStats.stunDurationFrames > 0) {
            curTarget.stateBus.applyState({
              stateNameOrId: 'stun',
              sourceUnitId: caster.id,
              sourceSkillId: skill.id,
              slvl: evalResult.slvl,
              durationFrames: maulStats.stunDurationFrames,
              currentFrame: currentTick,
            })
            if (!statesApplied.includes('stun')) {
              statesApplied.push('stun')
            }
          }
          notes.push(`maul: charged to stage ${nextCharge} (+${dmgBonus}% dmg, ${maulStats.stunDurationFrames}f stun)`)
        }

        // Skill 238: Rabies (infectious contagion state on target + rabiesplague #515 / rabiescontagion #516 spread)
        if (skill.id === 238) {
          const ppBlvl = caster.statList.getBaseSkillLevel(222)
          const rabiesStats = calculateRabiesStats(evalResult.slvl, ppBlvl)
          const avgPoisonDmg = (rabiesStats.minPoisonDamage + rabiesStats.maxPoisonDamage) / 2
          const poisonDps = Number((avgPoisonDmg / rabiesStats.poisonDurationSeconds).toFixed(2))
          const rabiesStateStats = {
            poison_dps: poisonDps,
            poison_damage_per_sec: poisonDps,
            min_poison_damage: rabiesStats.minPoisonDamage,
            max_poison_damage: rabiesStats.maxPoisonDamage,
            poison_duration_frames: rabiesStats.poisonDurationFrames,
            poison_duration_seconds: rabiesStats.poisonDurationSeconds,
            contagion_radius_subtiles: rabiesStats.contagionRadiusSubtiles,
            contagion_spread_interval: rabiesStats.contagionSpreadIntervalFrames,
          }

          curTarget.stateBus.applyState({
            stateNameOrId: 'rabies',
            sourceUnitId: caster.id,
            sourceSkillId: skill.id,
            slvl: evalResult.slvl,
            durationFrames: rabiesStats.poisonDurationFrames,
            currentFrame: currentTick,
            stats: rabiesStateStats,
          })
          if (!statesApplied.includes('rabies')) {
            statesApplied.push('rabies')
          }
          if (!missilesSpawned.includes('rabiesplague')) {
            missilesSpawned.push('rabiesplague')
          }
          // 1.13c MISSMODE_SrvDo30_RabiesPlague -> rabiescontagion (#516) within Param2 = 7 subtiles (140px)
          const hostPos = targetPositions?.get(curTarget.id) ?? { x: targetX, y: targetY }
          const contagionRadiusPx = rabiesStats.contagionRadiusSubtiles * 20
          for (const other of targets) {
            if (other.id === curTarget.id || other.statList.getHp256() <= 0 || other.stateBus.hasState('rabies')) {
              continue
            }
            const oPos = targetPositions?.get(other.id)
            if (oPos) {
              const dx = oPos.x - hostPos.x
              const dy = (oPos.y - hostPos.y) * 2
              if (dx * dx + dy * dy > contagionRadiusPx * contagionRadiusPx) {
                continue
              }
            }
            other.stateBus.applyState({
              stateNameOrId: 'rabies',
              sourceUnitId: caster.id,
              sourceSkillId: skill.id,
              slvl: evalResult.slvl,
              durationFrames: rabiesStats.poisonDurationFrames,
              currentFrame: currentTick,
              stats: rabiesStateStats,
            })
            if (!missilesSpawned.includes('rabiescontagion')) {
              missilesSpawned.push('rabiescontagion')
            }
          }
          notes.push(`rabies: infected target ${curTarget.id} with ${poisonDps} poison dps for ${rabiesStats.poisonDurationFrames}f`)
        }
      }
    }

    // 1.13c Charged Strike (#24): SKILLS_SrvDo011_ChargedStrike (0x6FC6D040)
    // Unconditionally on swing, spawns calc1 = 3 + floor(slvl / 5) chargedstrikebolt (#215) missiles
    // originating at the target position along the away-vector with NextDelay = 0 and ToHit = 0.
    if (skill.id === 24) {
      const boltName = evalResult.missileA || 'chargedstrikebolt'
      const boltCount = 3 + Math.floor(evalResult.slvl / 5)
      const pPos = targetPositions?.get(primaryTarget.id) ?? { x: 0, y: 120 }
      for (let b = 0; b < boltCount; b += 1) {
        const spreadX = (b - (boltCount - 1) / 2) * 8
        const m = missileEngine.spawnMissile({
          missileNameOrId: boltName,
          sourceSkillId: 24,
          slvl: evalResult.slvl,
          owner: caster,
          startX: pPos.x,
          startY: pPos.y,
          targetX: pPos.x + spreadX,
          targetY: pPos.y + 80,
          dmgPacket: {
            skillId: 24,
            slvl: evalResult.slvl,
            attackKind: 'spell',
            srcDam: 0,
            elemType: 'ltng',
            elemMin256: evalResult.minElemDmg256,
            elemMax256: evalResult.maxElemDmg256,
            autoHit: true,
            canTriggerProcs: false,
          },
        })
        if (m) missilesSpawned.push(m.name)
      }
      const csStep = missileEngine.tick(currentTick, targets, targetPositions)
      for (const h of csStep.hits) {
        totalDamageDealt += h.damage
      }
      for (const sub of csStep.subMissilesSpawned) {
        missilesSpawned.push(sub)
      }
    }

    // 1.13c Lightning Strike (#34): SKILLS_SrvDo014_LightningStrike (0x6FC6CE10) & MISSMODE_SrvHit12 (0x6FC5D020)
    // Spawns lightningstrike (#232) with calc2 = 2 + (slvl - 1) = 1 + slvl total chain hits within 20 subtiles.
    if (skill.id === 34) {
      const chainName = evalResult.missileA || 'lightningstrike'
      const pPos = targetPositions?.get(primaryTarget.id) ?? { x: 0, y: 120 }
      const m = missileEngine.spawnMissile({
        missileNameOrId: chainName,
        sourceSkillId: 34,
        slvl: evalResult.slvl,
        owner: caster,
        startX: pPos.x,
        startY: pPos.y,
        targetX: pPos.x,
        targetY: pPos.y,
        chainRemaining: evalResult.slvl, // 1 hit on primaryTarget + slvl bounces = 1 + slvl total hits
        dmgPacket: {
          skillId: 34,
          slvl: evalResult.slvl,
          attackKind: 'spell',
          srcDam: 0,
          elemType: 'ltng',
          elemMin256: evalResult.minElemDmg256,
          elemMax256: evalResult.maxElemDmg256,
          autoHit: true,
          canTriggerProcs: false,
        },
      })
      if (m) missilesSpawned.push(m.name)
      const lsStep = missileEngine.tick(currentTick, targets, targetPositions)
      for (const h of lsStep.hits) {
        totalDamageDealt += h.damage
      }
      for (const sub of lsStep.subMissilesSpawned) {
        missilesSpawned.push(sub)
      }
    }
  }

  return {
    skillId: skill.id,
    name: skill.name,
    executed: true,
    srvDoFuncUsed: effectiveDoFunc,
    manaSpent256: evalResult.manaCost256,
    missilesSpawned,
    statesApplied,
    petsSummoned,
    corpsesConsumed,
    totalDamageDealt,
    notes,
  }
}
