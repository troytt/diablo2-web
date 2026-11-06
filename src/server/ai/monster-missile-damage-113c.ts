/**
 * Diablo II: Lord of Destruction v1.13c `D2Common#10413` (`0x6FDBBAA0`) Monster Missile Damage
 * & `D2Game` `MONSTER_ApplyElementalDamage` (`0x6FC97695`) Poison Rider Evaluator.
 *
 * Ground truth (`kb/combat/d2-poison-dot-and-monster-missile-damage-113c.md`):
 * 1. `D2Common#10413` (`0x6FDBBAA0`):
 *    - Evaluates `Missiles.txt` `Skill` (via `evaluateSkill113c` when linked) or `Missiles.txt`
 *      5-band scaling (`MinDamage + MinLevDam1..5`, `EMin + MinELev1..5`, `Emax + MaxELev1..5`)
 *      shifted left by `HitShift` (`1/256` HP units, or `1/256` HP/frame bitrate when `EType == 'pois'`).
 *    - Evaluates 3-band elemental length `ELen + ELevLen1..3` (`0x6FDB9DC0`).
 *    - Adds monster physical `minDmg..maxDmg` and `MonStats.txt` `El1..3` riders **only when
 *      `Missiles.txt` `SrcDamage > 0`**, scaled by `(monDmg256 * SrcDamage) / 128` (`0x6FDBBCD4`).
 * 2. `MONSTER_ApplyElementalDamage` (`0x6FC97695`):
 *    - `MonStats.txt` `El1..3` poison riders (`ElType == 'pois'`) use `bitrate256 = scaledEl * 10`
 *      and `durationFrames = ElDur * 2` (`cumul256 = scaledEl * 10 * (ElDur * 2)`).
 */

import { compute3BandDuration, compute5BandScaling, evaluateCalc } from '../../common/data/calc-ast.ts'
import type { D2DataRegistry, MissileRecord, SkillRecord } from '../../common/data/data-registry.ts'
import type { D2Rng } from '../../common/rng/d2-rng.ts'
import { MONSTATS_113C_ROWS } from '../../common/units/monstats-113c-data.ts'
import type { MonsterElementalAttack } from '../../common/units/unit-types.ts'
import { FIXED_ONE, UnitStatList } from '../engine/stat-list.ts'
import { evaluateSkill113c } from '../skills/registry.ts'

export type MonsterMissileChannel113c = 'phys' | 'fire' | 'ltng' | 'cold' | 'pois' | 'mag'

/**
 * `Patch_D2.mpq` `Difficultylevels.txt` `MonsterSkillBonus` (`D2Common#10237`
 * `DATATBLS_GetDifficultyLevelsTxtRecord` `+0x10`): `[0, 3, 7]` for Normal / Nightmare / Hell.
 */
export const MONSTER_SKILL_BONUS_BY_DIFFICULTY_113C = [0, 3, 7] as const

/**
 * `D2Game.dll` `MONMODE_SpawnModeMissile` (`0x6FC95C60..0x6FC95CD7`):
 * Non-hireling monster mode missiles (`MissA1/A2/S1..S4/C/SQ`, `nSkillId = 0`) use
 * `nSkillLevel = pDiff->dwMonsterSkillBonus + 1` (`1` in Normal, `4` in Nightmare, `8` in Hell),
 * never `monster.level` (`STAT_LEVEL` is used only when `dwFlags & 0x200` `UNITFLAG_ISMERC`).
 */
export function resolveMonsterModeMissileSlvl113c(difficulty: 0 | 1 | 2): number {
  return MONSTER_SKILL_BONUS_BY_DIFFICULTY_113C[difficulty] + 1
}

/**
 * `D2Game.dll` `MONSTER_InitSkills` (`0x6FCD019B..0x6FCD0215`):
 * Explicit `MonStats.txt` `Skill1..8` entries with `Sk1lvl..8lvl > 0` are registered at
 * `nSkillLevel = SkNlvl + pDiff->dwMonsterSkillBonus` (`+0` Normal, `+3` Nightmare, `+7` Hell).
 */
export function resolveMonsterRegisteredSkillSlvl113c(
  rawSkillLevel: number,
  difficulty: 0 | 1 | 2,
): number {
  const base = Math.trunc(rawSkillLevel)
  if (base <= 0) return 0
  return base + MONSTER_SKILL_BONUS_BY_DIFFICULTY_113C[difficulty]
}

/**
 * Resolve a monster's registered `slvl` for `skillId` from `MonStats.txt` `Sk1..Sk8` (`Sk1lvl..Sk8lvl`)
 * plus `Difficultylevels.txt` `MonsterSkillBonus` (`[0, 3, 7][difficulty]`, `D2Game.dll` `0x6FCD019B`),
 * falling back to `fallbackRawSkillLevel` when invoked on a custom/test unit without that slot.
 */
export function resolveMonsterMonStatsSkillSlvl113c(
  hcIdx: number,
  skillId: number,
  difficulty: 0 | 1 | 2,
  fallbackRawSkillLevel = 1,
): number {
  const row = MONSTATS_113C_ROWS[hcIdx]
  const entry = row?.skills.find((s) => s.skillId === skillId && s.level > 0)
  return resolveMonsterRegisteredSkillSlvl113c(entry?.level ?? fallbackRawSkillLevel, difficulty)
}

export interface MonsterMissileDamageInput113c {
  readonly registry: D2DataRegistry
  readonly missile: MissileRecord
  readonly slvl: number
  readonly difficulty: 0 | 1 | 2
  readonly monsterMinPhys: number
  readonly monsterMaxPhys: number
  readonly attackMode?: 'A1' | 'A2' | 'S1' | 'C' | 'SC' | undefined
  readonly elementalAttacks?: readonly MonsterElementalAttack[] | undefined
  readonly extraFirePct?: number | undefined
  readonly rng: Pick<D2Rng, 'rand'>
}

export interface MonsterMissileDamageResult113c {
  readonly physDamage: number
  readonly elemDamage: number
  readonly element: MonsterMissileChannel113c
  readonly elemDurationFrames: number
  readonly totalDamage: number
}

function normalizeMissileEType113c(raw: string | undefined): MonsterMissileChannel113c | undefined {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'fire':
      return 'fire'
    case 'ltng':
    case 'light':
      return 'ltng'
    case 'cold':
    case 'frze':
    case 'free':
      return 'cold'
    case 'pois':
      return 'pois'
    case 'mag':
    case 'magic':
      return 'mag'
    case 'phys':
    case 'norm':
      return 'phys'
    default:
      return undefined
  }
}

function rollFixedRange113c(min256: number, max256: number, rng: Pick<D2Rng, 'rand'>): number {
  const lo = Math.max(0, Math.trunc(min256))
  const hi = Math.max(lo, Math.trunc(max256))
  if (hi <= lo) return lo
  return lo + rng.rand(hi - lo + 1)
}

/**
 * `D2Common` `0x6FDB9DC0`: 3-band `Missiles.txt` elemental duration (`ELen`, `ELevLen1..3`) in 25fps frames.
 */
export function computeMissileElementalLength113c(missile: MissileRecord, slvl: number): number {
  const effSlvl = Math.max(1, Math.trunc(slvl))
  return Math.max(
    0,
    compute3BandDuration(effSlvl, missile.eLen, missile.eLevLen1, missile.eLevLen2, missile.eLevLen3),
  )
}

/**
 * `D2Game` `MONSTER_ApplyElementalDamage` (`0x6FC97695..0x6FC976CD`):
 * Converts `MonLvl.txt` `L-DM%`-scaled `MonStats.txt` `ElMinD..ElMaxD` and raw `ElDur`
 * for `ElType == 'pois'` into `1/256` cumulative poison damage and `ElDur * 2` frame duration.
 */
export function scaleMonStatsPoisonRider113c(
  scaledMin: number,
  scaledMax: number,
  rawDur: number,
): {
  readonly minBitrate256: number
  readonly maxBitrate256: number
  readonly durationFrames: number
  readonly minCumulHp: number
  readonly maxCumulHp: number
} {
  const durationFrames = Math.max(25, Math.trunc(Math.max(1, rawDur) * 2))
  const minBitrate256 = Math.max(0, Math.trunc(scaledMin)) * 10
  const maxBitrate256 = Math.max(minBitrate256, Math.trunc(scaledMax) * 10)
  const minCumul256 = minBitrate256 * durationFrames
  const maxCumul256 = maxBitrate256 * durationFrames
  return {
    minBitrate256,
    maxBitrate256,
    durationFrames,
    minCumulHp: minCumul256 > 0 ? Math.max(1, Math.round(minCumul256 / FIXED_ONE)) : 0,
    maxCumulHp: maxCumul256 > 0 ? Math.max(1, Math.round(maxCumul256 / FIXED_ONE)) : 0,
  }
}

/**
 * Evaluate a monster projectile's physical + elemental damage and elemental duration
 * per 1.13c `D2Common#10413` (`0x6FDBBAA0`).
 */
export function evaluateMonsterMissileDamage113c(
  input: MonsterMissileDamageInput113c,
): MonsterMissileDamageResult113c {
  const { registry, missile, difficulty, rng } = input
  const slvl = Math.max(1, Math.trunc(input.slvl))
  const shift = Math.max(0, Math.min(16, Math.trunc(missile.hitShift)))

  let minPhys256 = 0
  let maxPhys256 = 0
  let minElem256 = 0
  let maxElem256 = 0
  let element: MonsterMissileChannel113c | undefined = normalizeMissileEType113c(missile.eType)
  let elemDurationFrames = computeMissileElementalLength113c(missile, slvl)

  // 1. Linked `Missiles.txt` `Skill` (`0x6FDBA3E0` / `0x6FDBA510`)
  const linkedSkill = missile.skill !== '' ? registry.getSkillByName(missile.skill) : undefined
  if (linkedSkill !== undefined) {
    const statList = new UnitStatList(registry, undefined, { ownerType: 'monster' })
    statList.setBaseStat('level', slvl)
    const evalOut = evaluateSkill113c({
      registry,
      skill: linkedSkill,
      slvl,
      blvl: slvl,
      statList,
      difficulty,
    })
    if (evalOut.maxPhysDmg > 0 || evalOut.maxElemDmg256 > 0) {
      minPhys256 = Math.max(0, Math.round(evalOut.minPhysDmg * FIXED_ONE))
      maxPhys256 = Math.max(minPhys256, Math.round(evalOut.maxPhysDmg * FIXED_ONE))
      minElem256 = Math.max(0, evalOut.minElemDmg256)
      maxElem256 = Math.max(minElem256, evalOut.maxElemDmg256)
      const skillElem = normalizeMissileEType113c(linkedSkill.eType)
      if (element === undefined && skillElem !== undefined) {
        element = skillElem
      }
      if (evalOut.durationFrames > 0) {
        elemDurationFrames = evalOut.durationFrames
      }
    }
  }

  // 2. Direct `Missiles.txt` 5-band scaling (`0x6FDBB360`) when `Skill` link did not populate damage
  if (maxPhys256 <= 0 && maxElem256 <= 0) {
    let rawMinPhys =
      compute5BandScaling(
        slvl,
        missile.minDamage,
        missile.minLevDam1,
        missile.minLevDam2,
        missile.minLevDam3,
        missile.minLevDam4,
        missile.minLevDam5,
      ) << shift
    let rawMaxPhys =
      compute5BandScaling(
        slvl,
        missile.maxDamage,
        missile.maxLevDam1,
        missile.maxLevDam2,
        missile.maxLevDam3,
        missile.maxLevDam4,
        missile.maxLevDam5,
      ) << shift
    if (missile.dmgSymPerCalc !== '' && (rawMinPhys > 0 || rawMaxPhys > 0)) {
      const synPct = evaluateCalc(missile.dmgSymPerCalc, {
        registry,
        activeMissile: missile,
        slvl,
        blvl: slvl,
      })
      if (synPct !== 0) {
        rawMinPhys = Math.trunc((rawMinPhys * (100 + synPct)) / 100)
        rawMaxPhys = Math.trunc((rawMaxPhys * (100 + synPct)) / 100)
      }
    }
    minPhys256 = Math.max(0, rawMinPhys)
    maxPhys256 = Math.max(minPhys256, rawMaxPhys)

    let rawMinElem =
      compute5BandScaling(
        slvl,
        missile.eMin,
        missile.eMinLev1,
        missile.eMinLev2,
        missile.eMinLev3,
        missile.eMinLev4,
        missile.eMinLev5,
      ) << shift
    let rawMaxElem =
      compute5BandScaling(
        slvl,
        missile.eMax,
        missile.eMaxLev1,
        missile.eMaxLev2,
        missile.eMaxLev3,
        missile.eMaxLev4,
        missile.eMaxLev5,
      ) << shift
    if (missile.eDmgSymPerCalc !== '' && (rawMinElem > 0 || rawMaxElem > 0)) {
      const synPct = evaluateCalc(missile.eDmgSymPerCalc, {
        registry,
        activeMissile: missile,
        slvl,
        blvl: slvl,
      })
      if (synPct !== 0) {
        rawMinElem = Math.trunc((rawMinElem * (100 + synPct)) / 100)
        rawMaxElem = Math.trunc((rawMaxElem * (100 + synPct)) / 100)
      }
    }
    if (element === 'pois') {
      // `D2Common#11089` (`0x6FDA4D6C`): `Missiles.txt` poison `EMin..EMax << HitShift` is per-frame bitrate (`1/256` HP/frame).
      const poisDur = elemDurationFrames > 0 ? elemDurationFrames : 50
      elemDurationFrames = poisDur
      minElem256 = Math.max(0, rawMinElem) * poisDur
      maxElem256 = Math.max(minElem256, rawMaxElem * poisDur)
    } else {
      minElem256 = Math.max(0, rawMinElem)
      maxElem256 = Math.max(minElem256, rawMaxElem)
    }
  }

  // 3. `SrcDamage` (`0x6FDBBCD4..0x6FDBBF6B`): ONLY inherit monster physical & `El1..3` when `SrcDamage > 0`
  const srcDamage = Math.max(0, Math.trunc(missile.srcDamage))
  if (srcDamage > 0) {
    const monMin256 = Math.trunc((Math.max(0, input.monsterMinPhys) * FIXED_ONE * srcDamage) / 128)
    const monMax256 = Math.trunc(
      (Math.max(input.monsterMinPhys, input.monsterMaxPhys) * FIXED_ONE * srcDamage) / 128,
    )
    minPhys256 += Math.max(0, monMin256)
    maxPhys256 += Math.max(0, monMax256)

    const elemList = input.elementalAttacks ?? []
    if (elemList.length > 0) {
      const modeKey = input.attackMode ?? 'A1'
      // 1.13c `MonStats.txt` encodes `MONMODE_CAST` (`MissC`) elemental rows under `El*Mode = 'SC'`
      // (e.g., `WillOWisp` `hcIdx 118..121, 639..641, 733`: `El1Mode = 'A1' mana`, `El2Mode = 'SC' ltng`, #2012).
      // Never fall back to `elemList[0]` (`A1`) when evaluating `'C'` / `'SC'` / `'S1'` / `'A2'`.
      const candidate =
        elemList.find(
          (e) =>
            e.mode === modeKey ||
            (modeKey === 'C' && e.mode === 'SC') ||
            (modeKey === 'SC' && e.mode === 'C'),
        ) ?? (modeKey === 'A1' && input.monsterMaxPhys <= 1 ? elemList[0] : undefined)
      if (candidate !== undefined) {
        const chance = Math.max(0, Math.min(100, candidate.chancePct ?? 100))
        if (chance >= 100 || rng.rand(100) < chance) {
          const riderType =
            candidate.type === 'rand'
              ? (['fire', 'ltng', 'cold', 'pois'] as const)[rng.rand(4)]!
              : normalizeMissileEType113c(candidate.type)
          if (riderType !== undefined && riderType !== 'phys') {
            const rawRiderMin = Math.max(0, candidate.minDamage ?? candidate.min ?? 0)
            const rawRiderMax = Math.max(rawRiderMin, candidate.maxDamage ?? candidate.max ?? rawRiderMin)
            if (riderType === 'pois') {
              const poisScaled = scaleMonStatsPoisonRider113c(
                rawRiderMin,
                rawRiderMax,
                candidate.durationFrames ?? 25,
              )
              const riderMin256 = Math.trunc(
                (poisScaled.minBitrate256 * poisScaled.durationFrames * srcDamage) / 128,
              )
              const riderMax256 = Math.trunc(
                (poisScaled.maxBitrate256 * poisScaled.durationFrames * srcDamage) / 128,
              )
              if (element === undefined || element === 'phys' || element === 'pois') {
                element = 'pois'
                minElem256 += riderMin256
                maxElem256 += Math.max(riderMin256, riderMax256)
                elemDurationFrames = Math.max(elemDurationFrames, poisScaled.durationFrames)
              }
            } else {
              const riderMin256 = Math.trunc((rawRiderMin * FIXED_ONE * srcDamage) / 128)
              const riderMax256 = Math.trunc((rawRiderMax * FIXED_ONE * srcDamage) / 128)
              if (element === undefined || element === 'phys' || element === riderType) {
                element = riderType
                minElem256 += riderMin256
                maxElem256 += Math.max(riderMin256, riderMax256)
                if (riderType === 'cold' && (candidate.durationFrames ?? 0) > 0) {
                  elemDurationFrames = Math.max(elemDurationFrames, candidate.durationFrames ?? 0)
                }
              }
            }
          }
        }
      }
    }
  }

  if (element === 'fire' && (input.extraFirePct ?? 0) > 0) {
    const scale = 100 + Math.trunc(input.extraFirePct!)
    minElem256 = Math.trunc((minElem256 * scale) / 100)
    maxElem256 = Math.trunc((maxElem256 * scale) / 100)
  }

  const rolledPhys256 = rollFixedRange113c(minPhys256, maxPhys256, rng)
  const rolledElem256 = rollFixedRange113c(minElem256, maxElem256, rng)
  const resolvedElement: MonsterMissileChannel113c =
    rolledElem256 > 0 && element !== undefined && element !== 'phys' ? element : 'phys'
  const physDamage = rolledPhys256 > 0 ? Math.max(1, Math.floor(rolledPhys256 / FIXED_ONE)) : 0
  const elemDamage =
    rolledElem256 > 0
      ? resolvedElement === 'pois'
        ? Math.max(1, Math.round(rolledElem256 / FIXED_ONE))
        : Math.max(1, Math.floor(rolledElem256 / FIXED_ONE))
      : 0
  const finalElemDuration =
    resolvedElement === 'pois' && elemDamage > 0
      ? Math.max(25, elemDurationFrames > 0 ? elemDurationFrames : 50)
      : elemDurationFrames

  return {
    physDamage,
    elemDamage,
    element: resolvedElement,
    elemDurationFrames: finalElemDuration,
    totalDamage: physDamage + elemDamage,
  }
}

/**
 * 1.13c `D2Game.dll` `SKILLS_SetInfernoMissileRange` (`0x6FCD32E0..0x6FCD33A6`, #2012):
 * Evaluates `Skills.txt` `calc1`; when `<= 0` (empty on `#178 FetishInferno`, `#317 Baal Inferno`,
 * `#319 MegademonInferno`, `#323 Horror Arctic Blast`), computes `Missiles.txt.Param2 + slvl - 1`
 * and clamps the resulting lifetime in 25Hz frames to `[1, 255]`.
 */
export function computeMonsterInfernoMissileRange113c(
  registry: D2DataRegistry,
  skill: SkillRecord,
  missile: MissileRecord,
  slvl: number,
): number {
  const effSlvl = Math.max(1, Math.trunc(slvl))
  let raw = 0
  if (skill.calc1.trim() !== '') {
    raw = evaluateCalc(skill.calc1, {
      registry,
      activeSkill: skill,
      activeMissile: missile,
      slvl: effSlvl,
      blvl: effSlvl,
    })
  }
  if (raw <= 0) {
    raw = missile.param2 + effSlvl - 1
  }
  return Math.max(1, Math.min(255, Math.trunc(raw)))
}

/**
 * 1.13c `D2Game.dll` `SKILLS_SrvSt53_MonsterInferno` (`0x6FCD65E0`) &
 * `SKILLS_SrvDo095_MonsterInferno` (`0x6FCD6A60`, #2012):
 * Evaluates channel duration (`calc2` / `param1`, e.g. `15` or `20` frames) and per-jet spawn
 * interval (`calc3`, e.g. `2` or `3` frames) for all `srvDoFunc === 95` monster Inferno skills.
 */
export function computeMonsterInfernoChannelParams113c(
  registry: D2DataRegistry,
  skill: SkillRecord,
  slvl: number,
): { readonly durationFrames: number; readonly stepFrames: number } {
  const effSlvl = Math.max(1, Math.trunc(slvl))
  const rawDur =
    skill.calc2.trim() !== ''
      ? evaluateCalc(skill.calc2, {
          registry,
          activeSkill: skill,
          slvl: effSlvl,
          blvl: effSlvl,
        })
      : skill.param1
  const durationFrames = Math.max(
    1,
    Math.trunc(rawDur > 0 ? rawDur : skill.param1 > 0 ? skill.param1 : 15),
  )
  const rawStep =
    skill.calc3.trim() !== ''
      ? evaluateCalc(skill.calc3, {
          registry,
          activeSkill: skill,
          slvl: effSlvl,
          blvl: effSlvl,
        })
      : 2
  const stepFrames = Math.max(1, Math.trunc(rawStep > 0 ? rawStep : 2))
  return { durationFrames, stepFrames }
}
