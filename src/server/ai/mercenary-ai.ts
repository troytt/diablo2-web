/**
 * Authoritative Diablo II: Lord of Destruction v1.13c Mercenary Offensive AI,
 * Skill Dispatch & Weapon/Equipment Combat Profile (`src/server/ai/mercenary-ai.ts`).
 *
 * Ground Truth References:
 * - `D2Game.dll` `0x6FC3DD40` (`AITHINK_Fn057_Hireable`) & `0x6FC3C4E0` (`AIMERC_ChooseSkill_6FC3C4E0`)
 * - `D2Game.dll` `0x6FC68BA0` (`D2GAME_MERCS_SetStats_6FC68BA0`)
 * - `Hireling.txt` (120 rows: Act 1 Rogue Scout, Act 2 Desert Mercenary, Act 3 Iron Wolf, Act 5 Barbarian)
 * - `DifficultyLevels.txt` (`HireableBossDamagePercent`: Normal `50`, Nightmare `35`, Hell `25`)
 * - `Missiles.txt` & `Skills.txt` (Fire/Cold Arrow, Inner Sight, Jab, Act 3 Cold/Fire/Lightning spells, Bash, Stun)
 */

import type { D2DataRegistry } from '../../common/data/data-registry.ts'
import { getMissileTxtData } from '../../common/skills/missiles-data.ts'
import { resolveWeaponBase113c } from '../../common/units/char-anim-speed.ts'
import {
  resolveHirelingStatsAtLevel,
  type ResolvedHirelingStatsAtLevel,
} from '../../common/units/hireling-table.ts'
import type { ItemStat } from '../../netproto/index.ts'
import { UnitStatList } from '../engine/stat-list.ts'
import { evaluateSkill113c } from '../skills/registry.ts'
import type { SkillEvalResult } from '../skills/types.ts'
import {
  HIREABLE_AI_113C,
  tickMercenaryAi25Hz,
  type MercenaryUnitState,
} from './monster-ai.ts'

function evalMercSkill113c(
  skillId: number,
  slvl: number,
  registry?: D2DataRegistry,
): SkillEvalResult | undefined {
  if (!registry) return undefined
  const skill = registry.getSkillById(skillId)
  if (!skill) return undefined
  const statList = new UnitStatList(registry, undefined, { ownerType: 'monster' })
  statList.setBaseSkillLevel(skillId, slvl)
  return evaluateSkill113c({
    registry,
    skill,
    slvl,
    blvl: slvl,
    statList,
  })
}

/**
 * `DifficultyLevels.txt` `HireableBossDamagePercent`:
 * Direct mercenary damage against Act Bosses (`Andariel`, `Duriel`, `Mephisto`, `Diablo`, `Baal`)
 * is scaled to `50%` in Normal (`0`), `35%` in Nightmare (`1`), and `25%` in Hell (`2`).
 */
export const HIREABLE_BOSS_DAMAGE_PERCENT_113C: Readonly<Record<0 | 1 | 2, number>> =
  Object.freeze({
    0: 50,
    1: 35,
    2: 25,
  })

export function computeMercenaryBossDamagePercent113c(difficulty: number): number {
  if (difficulty === 2) return HIREABLE_BOSS_DAMAGE_PERCENT_113C[2]
  if (difficulty === 1) return HIREABLE_BOSS_DAMAGE_PERCENT_113C[1]
  return HIREABLE_BOSS_DAMAGE_PERCENT_113C[0]
}

export function scaleMercenaryBossDamage113c(rawDamage: number, difficulty: number): number {
  if (rawDamage <= 0) return 0
  const pct = computeMercenaryBossDamagePercent113c(difficulty)
  return Math.max(1, Math.trunc((rawDamage * pct) / 100))
}

export interface MercenaryEquippedItemLike113c {
  readonly unitId: number
  readonly code: string
  readonly bodyLoc: number
  readonly ethereal?: boolean | undefined
  readonly identified?: boolean | undefined
  readonly broken?: boolean | undefined
  readonly durability?: number | undefined
  readonly maxDurability?: number | undefined
  readonly rawItemData?:
    | {
        readonly ethereal?: boolean | undefined
        readonly identified?: boolean | undefined
        readonly broken?: boolean | undefined
      }
    | undefined
}

export interface MercenaryWeaponProfile113c {
  readonly baseMinDmg: number
  readonly baseMaxDmg: number
  readonly weaponMinDmg: number
  readonly weaponMaxDmg: number
  readonly totalStr: number
  readonly totalDex: number
  readonly statBonusPct: number
  readonly offWeaponItemEdPct: number
  readonly totalIas: number
  readonly allSkillsBonus: number
  readonly attackCooldownFrames: number
  readonly meleeReachSubtiles: number
  readonly hasRangedBow: boolean
}

/**
 * Computes the 1.13c mercenary physical weapon + hireling base damage profile,
 * IAS-adjusted attack cooldown frames, and effective melee reach.
 */
export function computeMercenaryWeaponProfile113c(
  merc: {
    readonly act: 1 | 2 | 3 | 5
    readonly level: number
    readonly equipment: readonly MercenaryEquippedItemLike113c[]
  },
  hirelingStats: ResolvedHirelingStatsAtLevel | undefined,
  sumMercStat: (statId: number, options?: { readonly excludeWeaponHands?: boolean }) => number,
  collectItemStatsFn: (item: MercenaryEquippedItemLike113c) => readonly ItemStat[],
): MercenaryWeaponProfile113c {
  const baseHireMin = hirelingStats?.minDmg ?? 4
  const baseHireMax = Math.max(baseHireMin, hirelingStats?.maxDmg ?? 8)
  const baseStr = hirelingStats?.str ?? 40
  const baseDex = hirelingStats?.dex ?? 40

  const totalStr = baseStr + sumMercStat(0)
  const totalDex = baseDex + sumMercStat(2)
  const totalIas = sumMercStat(93)
  const allSkillsBonus = Math.max(0, sumMercStat(127))

  const offWeaponItemEdPct =
    sumMercStat(17, { excludeWeaponHands: true }) +
    sumMercStat(25, { excludeWeaponHands: true })
  const offWeapFlatMin =
    sumMercStat(21, { excludeWeaponHands: true }) +
    sumMercStat(111, { excludeWeaponHands: true })
  const offWeapFlatMax =
    sumMercStat(22, { excludeWeaponHands: true }) +
    sumMercStat(111, { excludeWeaponHands: true })

  let weaponItem: MercenaryEquippedItemLike113c | undefined
  let weaponBase: ReturnType<typeof resolveWeaponBase113c> | undefined
  let otherHandOccupied = false
  for (const eq of merc.equipment) {
    if (eq.bodyLoc !== 4 && eq.bodyLoc !== 5) continue
    if (eq.identified === false || eq.rawItemData?.identified === false) continue
    if (eq.broken === true || eq.rawItemData?.broken === true) continue
    const wb = resolveWeaponBase113c(eq.code)
    if (wb !== undefined && weaponItem === undefined) {
      weaponItem = eq
      weaponBase = wb
    } else {
      otherHandOccupied = true
    }
  }

  let weaponMinDmg = 0
  let weaponMaxDmg = 0
  let weaponSpeed = 0
  let statBonusPct = merc.act === 1 ? totalDex : totalStr
  let meleeReachSubtiles: number =
    merc.act === 2
      ? HIREABLE_AI_113C.ACT2_MELEE_REACH_SUBTILES
      : HIREABLE_AI_113C.ACT5_MELEE_REACH_SUBTILES
  let hasRangedBow = merc.act === 1

  if (weaponItem !== undefined && weaponBase !== undefined) {
    weaponSpeed = weaponBase.speed
    const useTwoHand =
      weaponBase.twoHanded &&
      weaponBase.twoHandedMindam !== undefined &&
      weaponBase.twoHandedMaxdam !== undefined &&
      (!weaponBase.oneOrTwoHanded || !otherHandOccupied)

    const rawMin = useTwoHand ? weaponBase.twoHandedMindam! : weaponBase.mindam
    const rawMax = useTwoHand ? weaponBase.twoHandedMaxdam! : weaponBase.maxdam
    const isEth = weaponItem.ethereal === true || weaponItem.rawItemData?.ethereal === true
    // 1.13c D2Common ethereal weapon base bonus: floor(base * 1.5) prior to local %ED.
    const ethMin = isEth ? Math.floor(rawMin * 1.5) : rawMin
    const ethMax = isEth ? Math.floor(rawMax * 1.5) : rawMax

    let onWeapEd = 0
    let onWeapMinEd = 0
    let flatMin = 0
    let flatMax = 0
    for (const st of collectItemStatsFn(weaponItem)) {
      if (st.statId === 17) onWeapEd += st.value
      else if (st.statId === 18) onWeapMinEd += st.value
      else if (st.statId === 219) onWeapEd += (st.value * merc.level) >> 3
      else if (st.statId === (useTwoHand ? 23 : 21) || st.statId === 111) {
        flatMin += st.value
      } else if (st.statId === (useTwoHand ? 24 : 22) || st.statId === 111) {
        flatMax += st.value
      } else if (st.statId === 218) {
        flatMax += (st.value * merc.level) >> 3
      }
    }
    const effMinEd = onWeapEd > 0 ? onWeapEd : onWeapMinEd
    weaponMinDmg = Math.max(1, Math.trunc((ethMin * (100 + effMinEd)) / 100) + flatMin)
    weaponMaxDmg = Math.max(
      weaponMinDmg,
      Math.trunc((ethMax * (100 + onWeapEd)) / 100) + flatMax,
    )
    statBonusPct =
      Math.trunc((totalStr * weaponBase.strBonus) / 100) +
      Math.trunc((totalDex * weaponBase.dexBonus) / 100)
    if (merc.act === 2 || merc.act === 5) {
      meleeReachSubtiles = Math.max(meleeReachSubtiles, 2 + Math.max(0, weaponBase.rangeadder))
    }
    if (merc.act === 1) {
      hasRangedBow = true
    }
  }

  const baseMinDmg = Math.max(1, baseHireMin + weaponMinDmg + offWeapFlatMin)
  const baseMaxDmg = Math.max(baseMinDmg, baseHireMax + weaponMaxDmg + offWeapFlatMax)

  // 1.13c EIAS diminishing-returns attack frame scaling (`floor(120 * IAS / (120 + IAS)) - WSM`).
  const eias =
    totalIas > 0
      ? Math.min(75, Math.floor((120 * totalIas) / (120 + totalIas))) - weaponSpeed
      : -weaponSpeed
  const attackCooldownFrames = Math.max(
    7,
    Math.ceil((HIREABLE_AI_113C.AI_DELAY_FRAMES * 100) / Math.max(25, 100 + eias)),
  )

  return {
    baseMinDmg,
    baseMaxDmg,
    weaponMinDmg,
    weaponMaxDmg,
    totalStr,
    totalDex,
    statBonusPct,
    offWeaponItemEdPct,
    totalIas,
    allSkillsBonus,
    attackCooldownFrames,
    meleeReachSubtiles,
    hasRangedBow,
  }
}

export interface MercenaryMissileSpec113c {
  readonly missileId: number
  readonly missileKey: string
  readonly skillId: number
  readonly slvl: number
  readonly velSubtilesPerFrame: number
  readonly rangeFrames: number
  readonly pierce: boolean
  readonly guaranteedHit: boolean
  readonly element: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag'
  readonly physDamage: number
  readonly elemDamage: number
  readonly elemDurationFrames: number
  readonly splashRadiusSubtiles: number
  readonly boltCount: number
}

export type MercenaryResolvedAction113c =
  | {
      readonly kind: 'melee'
      readonly skillId: number
      readonly skillName: string
      readonly slvl: number
      readonly hitCount: number
      readonly skillEdPct: number
      readonly skillFlatDmg: number
      readonly skillArPct: number
      readonly knockback: boolean
      readonly stunFrames: number
    }
  | {
      readonly kind: 'missile'
      readonly skillId: number
      readonly skillName: string
      readonly slvl: number
      readonly missile: MercenaryMissileSpec113c
    }
  | {
      readonly kind: 'inner_sight'
      readonly skillId: 8
      readonly skillName: 'Inner Sight'
      readonly slvl: number
      readonly radiusSubtiles: number
      readonly durationFrames: number
      readonly enemyDefensePenalty: number
    }
  | {
      readonly kind: 'frozen_armor'
      readonly skillId: 40
      readonly skillName: 'Frozen Armor'
      readonly slvl: number
      readonly durationFrames: number
      readonly defenseBonusPct: number
    }

export interface MercenaryLiveVisionMonster113c {
  readonly unitId: number
  readonly x: number
  readonly y: number
  readonly hp: number
  readonly maxHp: number
  readonly hasInnerSightState: boolean
}

export interface MercenaryLiveVisionPlayer113c {
  readonly unitId: number
  readonly x: number
  readonly y: number
}

/**
 * Runs `tickMercenaryAi25Hz` against live nearby room monsters and players (converted to 16 px/subtile)
 * to update `activeAura` and select an authentic `AIMERC_ChooseSkill_6FC3C4E0` skill, then resolves
 * the exact 1.13c offensive/buff action for Act 1, Act 2, Act 3, or Act 5 mercenaries.
 */
export function stepMercenaryAiAndChooseAction113c(params: {
  readonly merc: {
    readonly unitId: number
    readonly act: 1 | 2 | 3 | 5
    readonly subType: number | string
    readonly level: number
    readonly difficulty: 1 | 2 | 3
    readonly x: number
    readonly y: number
    readonly hp: number
    readonly maxHp: number
    readonly alive: boolean
    readonly activeAura?: string | undefined
    readonly hasFrozenArmorState: boolean
  }
  readonly owner: MercenaryLiveVisionPlayer113c
  readonly nearbyPlayers: readonly MercenaryLiveVisionPlayer113c[]
  readonly nearbyMonsters: readonly MercenaryLiveVisionMonster113c[]
  readonly currentFrame: number
  readonly readyToAct: boolean
  readonly weaponProfile: MercenaryWeaponProfile113c
  readonly rollBasePhysDamage: () => number
  readonly registry?: D2DataRegistry | undefined
  readonly rng: {
    readonly rand: (bound: number) => number
    readonly range: (min: number, max: number) => number
  }
}): {
  readonly activeAura?: string | undefined
  readonly chosenAction?: MercenaryResolvedAction113c | undefined
} {
  const px = HIREABLE_AI_113C.SUBTILE_PIXELS
  const defaultSubType =
    params.merc.act === 1
      ? params.merc.difficulty === 1
        ? 0
        : params.merc.difficulty === 2
          ? 2
          : 4
      : params.merc.act === 2
        ? params.merc.difficulty === 1
          ? 7
          : params.merc.difficulty === 2
            ? 11
            : 13
        : params.merc.act === 3
          ? params.merc.difficulty === 1
            ? 16
            : params.merc.difficulty === 2
              ? 19
              : 22
          : params.merc.difficulty === 1
            ? 24
            : params.merc.difficulty === 2
              ? 26
              : 28
  const rawHirelingStats = resolveHirelingStatsAtLevel(
    params.merc.subType,
    params.merc.act,
    params.merc.difficulty,
    params.merc.level,
    true,
  )
  const hirelingStats =
    rawHirelingStats && rawHirelingStats.act === params.merc.act
      ? rawHirelingStats
      : resolveHirelingStatsAtLevel(
          defaultSubType,
          params.merc.act,
          params.merc.difficulty,
          params.merc.level,
          true,
        )
  const resolvedSubType = hirelingStats?.record.subTypeId ?? params.merc.subType

  const reachSubtiles =
    params.merc.act === 1
      ? HIREABLE_AI_113C.ACT1_RANGED_REACH_SUBTILES
      : params.merc.act === 3
        ? HIREABLE_AI_113C.ACT3_RANGED_REACH_SUBTILES
        : Math.max(
            params.merc.act === 2
              ? HIREABLE_AI_113C.ACT2_MELEE_REACH_SUBTILES
              : HIREABLE_AI_113C.ACT5_MELEE_REACH_SUBTILES,
            params.weaponProfile.meleeReachSubtiles,
          )
  const mercUnit: MercenaryUnitState = {
    unitId: params.merc.unitId,
    act: params.merc.act,
    subType: resolvedSubType,
    level: params.merc.level,
    difficulty: params.merc.difficulty,
    x: params.merc.x * px,
    y: params.merc.y * px,
    hp: params.merc.hp,
    maxHp: params.merc.maxHp,
    damage: params.weaponProfile.baseMinDmg,
    reach: reachSubtiles * px,
    aggroRadius: HIREABLE_AI_113C.AGGRO_SUBTILES * px,
    alive: params.merc.alive,
    cooldown: params.readyToAct ? 0 : 2,
    activeAura: params.merc.activeAura,
  }

  // Build isolated proxy monsters/players in 16px/subtile space so `tickMercenaryAi25Hz`
  // evaluates real live monster vision & `AIMERC_ChooseSkill_6FC3C4E0` without mutating GameInstance records.
  const proxyMonsters = params.nearbyMonsters.map((m, idx) => ({
    index: idx,
    id: m.unitId,
    x: m.x * px,
    y: m.y * px,
    hp: m.hp,
    maxHp: m.maxHp,
    state: 'idle' as const,
    sleeping: false,
    align: 0,
    stats: { inTown: false, killable: true, petIgnore: false, align: 0 },
  }))
  const proxyPlayers = params.nearbyPlayers.map((p) => ({
    id: p.unitId,
    x: p.x * px,
    y: p.y * px,
  }))

  const outcome = tickMercenaryAi25Hz(
    mercUnit,
    {
      player: { x: params.owner.x * px, y: params.owner.y * px } as never,
      players: proxyPlayers as never,
      monsters: proxyMonsters as never,
      tick: params.currentFrame,
      events: [],
      pendingKills: [],
    } as never,
    { rng: params.rng },
  )

  const activeAura = outcome.activeAura ?? params.merc.activeAura
  if (!params.readyToAct || params.nearbyMonsters.length === 0) {
    return { ...(activeAura !== undefined ? { activeAura } : {}) }
  }

  const findSkillLevel = (skillId: number): number => {
    const entry = hirelingStats?.skills.find((s) => s.skillId === skillId)
    return Math.max(1, (entry?.effectiveLevel ?? 1) + params.weaponProfile.allSkillsBonus)
  }

  let skillName = outcome.skillUsed ?? 'Attack'

  // Act 3 Iron Wolf: if Frozen Armor is already active, or if 'Attack' was rolled at range,
  // pick the Iron Wolf's primary offensive elemental spell instead of suicidal melee or redundant self-buff.
  if (params.merc.act === 3 && (skillName === 'Attack' || (skillName === 'Frozen Armor' && params.merc.hasFrozenArmorState))) {
    const offensiveEntries = (hirelingStats?.skills ?? []).filter(
      (s) => s.mode !== 1 && s.skillId !== 40 && s.effectiveLevel > 0,
    )
    if (offensiveEntries.length > 0) {
      const pick = offensiveEntries[params.rng.rand(offensiveEntries.length)]!
      skillName = pick.skillName
    }
  }

  // Act 1 Rogue: if Inner Sight was rolled when all nearby monsters already have Inner Sight, fire bow instead.
  if (
    params.merc.act === 1 &&
    skillName === 'Inner Sight' &&
    params.nearbyMonsters.every((m) => m.hasInnerSightState)
  ) {
    const bowSkill = (hirelingStats?.skills ?? []).find(
      (s) => (s.skillId === 7 || s.skillId === 11) && s.effectiveLevel > 0,
    )
    skillName = bowSkill ? bowSkill.skillName : 'Attack'
  }

  const buildMissile = (
    missileKey: string,
    fallbackId: number,
    skillId: number,
    slvl: number,
    element: 'phys' | 'fire' | 'ltng' | 'cold' | 'mag',
    guaranteedHit: boolean,
    physDamage: number,
    elemDamage: number,
    elemDurationFrames = 0,
    splashRadiusSubtiles = 0,
    boltCount = 1,
    forcePierce = false,
  ): MercenaryMissileSpec113c => {
    const mTxt = getMissileTxtData(missileKey)
    const missileId = mTxt?.id ?? fallbackId
    const velPx = Math.max(8, mTxt?.vel ?? 16)
    // Convert Missiles.txt velocity (px/frame where 1 subtile ~ 8..16 iso units; align with player missile vel/16..vel/8)
    const velSubtilesPerFrame = Math.max(0.6, velPx / 12)
    const rangeFrames = Math.max(15, (mTxt?.range ?? 35) + slvl * (mTxt?.levRange ?? 0))
    return {
      missileId,
      missileKey,
      skillId,
      slvl,
      velSubtilesPerFrame,
      rangeFrames,
      pierce: forcePierce || Boolean(mTxt?.pierce),
      guaranteedHit,
      element,
      physDamage,
      elemDamage,
      elemDurationFrames,
      splashRadiusSubtiles,
      boltCount,
    }
  }

  let chosenAction: MercenaryResolvedAction113c

  if (params.merc.act === 1) {
    if (skillName === 'Inner Sight') {
      const slvl = findSkillLevel(8)
      const ev = evalMercSkill113c(8, slvl, params.registry)
      const durationFrames = Math.max(
        200,
        (ev?.durationFrames ?? 0) > 0 ? ev!.durationFrames : (8 + 4 * slvl) * 25,
      )
      // 1.13c Skills.txt #8 Inner Sight flat enemy AC reduction (calc1 / aurastat1 `armorclass`).
      const enemyDefensePenalty = Math.max(40, 25 + slvl * 35)
      chosenAction = {
        kind: 'inner_sight',
        skillId: 8,
        skillName: 'Inner Sight',
        slvl,
        radiusSubtiles: 20,
        durationFrames,
        enemyDefensePenalty,
      }
    } else if (skillName === 'Fire Arrow') {
      const slvl = findSkillLevel(7)
      const ev = evalMercSkill113c(7, slvl, params.registry)
      const basePhys = params.rollBasePhysDamage()
      const convPct = Math.min(100, Math.max(0, 3 + (slvl - 1) * 2))
      const convertedFire = Math.trunc((basePhys * convPct) / 100)
      const remPhys = Math.max(0, basePhys - convertedFire)
      const eMin = Math.max(1, (ev?.minElemDmg256 ?? 256) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 1024) >> 8)
      const elemDmg = convertedFire + params.rng.range(eMin, eMax)
      chosenAction = {
        kind: 'missile',
        skillId: 7,
        skillName: 'Fire Arrow',
        slvl,
        missile: buildMissile('firearrow', 12, 7, slvl, 'fire', false, remPhys, elemDmg),
      }
    } else if (skillName === 'Cold Arrow') {
      const slvl = findSkillLevel(11)
      const ev = evalMercSkill113c(11, slvl, params.registry)
      const basePhys = params.rollBasePhysDamage()
      const convPct = Math.min(100, Math.max(0, 3 + (slvl - 1) * 2))
      const convertedCold = Math.trunc((basePhys * convPct) / 100)
      const remPhys = Math.max(0, basePhys - convertedCold)
      const eMin = Math.max(1, (ev?.minElemDmg256 ?? 768) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 1024) >> 8)
      const elemDmg = convertedCold + params.rng.range(eMin, eMax)
      const chillFrames = Math.max(
        75,
        (ev?.durationFrames ?? 0) > 0 ? ev!.durationFrames : (3 + slvl) * 25,
      )
      chosenAction = {
        kind: 'missile',
        skillId: 11,
        skillName: 'Cold Arrow',
        slvl,
        missile: buildMissile('coldarrow', 40, 11, slvl, 'cold', false, remPhys, elemDmg, chillFrames),
      }
    } else {
      const basePhys = params.rollBasePhysDamage()
      chosenAction = {
        kind: 'missile',
        skillId: 0,
        skillName: 'Attack',
        slvl: 1,
        missile: buildMissile('arrow', 0, 0, 1, 'phys', false, basePhys, 0),
      }
    }
  } else if (params.merc.act === 3) {
    if (skillName === 'Frozen Armor') {
      const slvl = findSkillLevel(40)
      const durationFrames = (108 + 12 * slvl) * 25
      const defenseBonusPct = 25 + 5 * slvl
      chosenAction = {
        kind: 'frozen_armor',
        skillId: 40,
        skillName: 'Frozen Armor',
        slvl,
        durationFrames,
        defenseBonusPct,
      }
    } else if (skillName === 'Glacial Spike') {
      const slvl = findSkillLevel(55)
      const ev = evalMercSkill113c(55, slvl, params.registry)
      const eMin = Math.max(16, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 0) >> 8)
      const freezeFrames = Math.max(
        50,
        (ev?.durationFrames ?? 0) > 0 ? ev!.durationFrames : 47 + 3 * slvl,
      )
      chosenAction = {
        kind: 'missile',
        skillId: 55,
        skillName: 'Glacial Spike',
        slvl,
        missile: buildMissile(
          'glacialspike',
          96,
          55,
          slvl,
          'cold',
          true,
          0,
          params.rng.range(eMin, eMax),
          freezeFrames,
          4,
        ),
      }
    } else if (skillName === 'Ice Blast') {
      const slvl = findSkillLevel(45)
      const ev = evalMercSkill113c(45, slvl, params.registry)
      const eMin = Math.max(8, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 0) >> 8)
      const freezeFrames = Math.max(
        75,
        (ev?.durationFrames ?? 0) > 0 ? ev!.durationFrames : 70 + 5 * slvl,
      )
      chosenAction = {
        kind: 'missile',
        skillId: 45,
        skillName: 'Ice Blast',
        slvl,
        missile: buildMissile(
          'iceblast',
          91,
          45,
          slvl,
          'cold',
          true,
          0,
          params.rng.range(eMin, eMax),
          freezeFrames,
        ),
      }
    } else if (skillName === 'Fire Ball') {
      const slvl = findSkillLevel(47)
      const ev = evalMercSkill113c(47, slvl, params.registry)
      const eMin = Math.max(6, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 0) >> 8)
      chosenAction = {
        kind: 'missile',
        skillId: 47,
        skillName: 'Fire Ball',
        slvl,
        missile: buildMissile(
          'fireball',
          62,
          47,
          slvl,
          'fire',
          true,
          0,
          params.rng.range(eMin, eMax),
          0,
          4,
        ),
      }
    } else if (skillName === 'Inferno') {
      const slvl = findSkillLevel(41)
      const ev = evalMercSkill113c(41, slvl, params.registry)
      const eMin = Math.max(4, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin, (ev?.maxElemDmg256 ?? 0) >> 8)
      chosenAction = {
        kind: 'missile',
        skillId: 41,
        skillName: 'Inferno',
        slvl,
        missile: buildMissile(
          'infernoflame1',
          60,
          41,
          slvl,
          'fire',
          true,
          0,
          params.rng.range(eMin, eMax),
        ),
      }
    } else if (skillName === 'Lightning') {
      const slvl = findSkillLevel(49)
      const ev = evalMercSkill113c(49, slvl, params.registry)
      const eMin = Math.max(1, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin + 10, (ev?.maxElemDmg256 ?? 0) >> 8)
      chosenAction = {
        kind: 'missile',
        skillId: 49,
        skillName: 'Lightning',
        slvl,
        missile: buildMissile(
          'lightningstrike',
          232,
          49,
          slvl,
          'ltng',
          true,
          0,
          params.rng.range(eMin, eMax),
          0,
          0,
          1,
          true,
        ),
      }
    } else if (skillName === 'Charged Bolt') {
      const slvl = findSkillLevel(38)
      const ev = evalMercSkill113c(38, slvl, params.registry)
      const eMin = Math.max(2, (ev?.minElemDmg256 ?? 0) >> 8)
      const eMax = Math.max(eMin + 2, (ev?.maxElemDmg256 ?? 0) >> 8)
      const boltCount = Math.min(24, 2 + slvl)
      chosenAction = {
        kind: 'missile',
        skillId: 38,
        skillName: 'Charged Bolt',
        slvl,
        missile: buildMissile(
          'chargedbolt',
          56,
          38,
          slvl,
          'ltng',
          true,
          0,
          params.rng.range(eMin, eMax),
          0,
          0,
          boltCount,
        ),
      }
    } else {
      chosenAction = {
        kind: 'melee',
        skillId: 0,
        skillName: 'Attack',
        slvl: 1,
        hitCount: 1,
        skillEdPct: 0,
        skillFlatDmg: 0,
        skillArPct: 0,
        knockback: false,
        stunFrames: 0,
      }
    }
  } else if (params.merc.act === 2 && skillName === 'Jab') {
    const slvl = findSkillLevel(10)
    // 1.13c Skills.txt #10 Jab: 2 hits on Act 2 merc (`A2` sequence), %ED = -15 + 3*(slvl-1), %AR = 10 + 9*(slvl-1).
    chosenAction = {
      kind: 'melee',
      skillId: 10,
      skillName: 'Jab',
      slvl,
      hitCount: 2,
      skillEdPct: -15 + 3 * (slvl - 1),
      skillFlatDmg: 0,
      skillArPct: 10 + 9 * (slvl - 1),
      knockback: false,
      stunFrames: 0,
    }
  } else if (params.merc.act === 5 && skillName === 'Bash') {
    const slvl = findSkillLevel(126)
    // 1.13c Skills.txt #126 Bash: %ED = 50 + 5*(slvl-1), flat +dmg = 1 + (slvl-1), %AR = 20 + 5*(slvl-1), Knockback.
    chosenAction = {
      kind: 'melee',
      skillId: 126,
      skillName: 'Bash',
      slvl,
      hitCount: 1,
      skillEdPct: 50 + 5 * (slvl - 1),
      skillFlatDmg: slvl,
      skillArPct: 20 + 5 * (slvl - 1),
      knockback: true,
      stunFrames: 0,
    }
  } else if (params.merc.act === 5 && skillName === 'Stun') {
    const slvl = findSkillLevel(139)
    // 1.13c Skills.txt #139 Stun: %AR = 15 + 5*(slvl-1), stun len = min(250, 30 + 5*(slvl-1)) frames.
    chosenAction = {
      kind: 'melee',
      skillId: 139,
      skillName: 'Stun',
      slvl,
      hitCount: 1,
      skillEdPct: 0,
      skillFlatDmg: 0,
      skillArPct: 15 + 5 * (slvl - 1),
      knockback: false,
      stunFrames: Math.min(250, 30 + 5 * (slvl - 1)),
    }
  } else {
    chosenAction = {
      kind: 'melee',
      skillId: 0,
      skillName: 'Attack',
      slvl: 1,
      hitCount: 1,
      skillEdPct: 0,
      skillFlatDmg: 0,
      skillArPct: 0,
      knockback: false,
      stunFrames: 0,
    }
  }

  return {
    ...(activeAura !== undefined ? { activeAura } : {}),
    chosenAction,
  }
}

export interface MercenaryCtcProcSpec113c {
  readonly statId: 195 | 198
  readonly skillId: number
  readonly slvl: number
  readonly chancePct: number
}

/**
 * Extracts `stat 195` (`item_skillonattack`) and `stat 198` (`item_skillonhit`) chance-to-cast
 * modifiers from a mercenary's equipped items (supporting both packed `(skillId << 6) | slvl`
 * and direct `param = skillId` stat entries).
 */
export function extractMercenaryStrikeProcs113c(
  equipmentStats: readonly ItemStat[],
): readonly MercenaryCtcProcSpec113c[] {
  const merged = new Map<string, MercenaryCtcProcSpec113c>()
  for (const st of equipmentStats) {
    if ((st.statId !== 195 && st.statId !== 198) || st.value <= 0) continue
    const rawParam = st.param >>> 0
    const skillId = rawParam >= 64 ? rawParam >>> 6 : rawParam
    const slvl = rawParam >= 64 ? Math.max(1, rawParam & 0x3f) : 1
    if (skillId <= 0) continue
    const key = `${st.statId}:${skillId}:${slvl}`
    const prev = merged.get(key)
    merged.set(key, {
      statId: st.statId,
      skillId,
      slvl,
      chancePct: Math.min(100, (prev?.chancePct ?? 0) + st.value),
    })
  }
  return [...merged.values()]
}
