/**
 * 1.13c Monster Unique Modifier (`MonUMod`) & Champion Subtype Combat/AI Helpers
 * (`D2Game.dll` `0x6FC41C09..0x6FC469F0`, `0x6FC38A90`, `0x6FCBCDE0`).
 *
 * Covers P1 parity issues:
 * - `#1890`: `MonUMod #9` (Fire Enchanted) & `#17` (Lightning Enchanted) melee/attack bonus damage
 * - `#1899`: `MonUMod #26` (`Teleport` / `#184 MonTeleport`) low-HP blink, 25% heal roll & `STATE_PREVENTHEAL (52)` gate
 * - `#1900`: `MonUMod #29` (`Multishot`) `+2` angled fan projectiles (`ev5 = 0x6FC45AD0`)
 * - `#1901`: `MonUMod #34` (`ai_after_death` / `#293 Self-resurrect`) Act 5 Reanimated Horde self-resurrection
 * - `#1903`: Champion sub-types (`#36..#39`), `Possessed` curse immunity (`0x20`), and `WillOWisp` (`hcIdx 118`) halved bonus
 * - `#1904`: `MonUMod #7` (`Cursed`) `75%` chance `#66 Amplify Damage` at `slvl = floor(mlvl / 5) + 1`
 * - `#1905`: `MonUMod #25` (`Mana Burn`) damage-scaled mana drain (`<< 8` melee shift) + `+20%` magic res & `+75%` AR
 * - `#1906`: `MonUMod #41` (`always_run_ai`) vs `MonStats.txt` `killminions` (`Blood Raven`, `Shenk`, `SplEndDeath`)
 */

/** Cooldown frames between `MonUMod #26` (`Teleport`) casts (`~2.4s` at 25 fps, within `50..75` frames). */
export const TELEPORT_UMOD_COOLDOWN_FRAMES_113C = 60

/** First AI-think gate (`40%`) in `D2Game.dll` `0x6FCBCE54` (`cmp eax, 0x28`). */
export const TELEPORT_UMOD_GATE1_PCT_113C = 40

/** Second AI-think gate (`15%`) in `D2Game.dll` `0x6FCBCEE0` (`cmp eax, 0x0f`; net `6%` per AI think). */
export const TELEPORT_UMOD_GATE2_PCT_113C = 15

/** Max melee target distance (`< 10` sub-tiles) when `lifePct >= 30%` (`D2Game.dll` `0x6FCBCECA`: `cmp [edx+0x14], 0xa`). */
export const TELEPORT_UMOD_MELEE_MAX_DIST_113C = 10

/** Low-HP threshold (`30%`) in `D2Game.dll` `0x6FCBCEB5` (`cmp eax, 0x1e`). */
export const TELEPORT_UMOD_LOW_HP_PCT_113C = 30

/** Probability (`25%`) of healing on `MonTeleport` (`D2Game.dll` `0x6FCBCF61`: `cmp eax, 0x19`). */
export const TELEPORT_UMOD_HEAL_CHANCE_PCT_113C = 25

/** Side-fan deflection angle (`~8°` = `0.14 rad`) for `MonUMod #29` (`Multishot`, `0x6FC45AD0`). */
export const MULTISHOT_FAN_ANGLE_RAD_113C = 0.14

/** `MonUMod #7` (`Cursed`, `0x6FC44250`): `75%` proc probability on hit. */
export const CURSED_PROC_CHANCE_PCT_113C = 75

/**
 * All `States.txt` curse state IDs blocked by `MonUMod #38` (`Possessed`, `pMonsterData->nTypeFlags |= 0x20`
 * at `D2Game.dll` `0x6FC437E5`).
 */
export const ALL_CURSE_STATE_IDS_113C: ReadonlySet<number> = new Set([
  9, // Amplify Damage
  19, // Weaken
  23, // Dim Vision
  27, // Taunt
  55, // Iron Maiden
  56, // Terror
  57, // Attract
  58, // Life Tap
  59, // Confuse
  60, // Decrepify
  61, // Lower Resist
  113, // Defense Curse
  114, // Blood Mana
])

/**
 * Missiles excluded from `MonUMod #29` (`Multishot`) fan duplication in addition to `Missiles.txt`
 * `NoMultiShot = 1` (`0x6FC45B67..0x6FC45B72`, which already excludes `#195 lightunique` in 1.13c
 * so `#17 + #29` MSLE emits 8 bolts rather than 1.09's 24, as well as `#194 coldunique`, `#284`,
 * and `#426..#428`), covering `#225 buglightning` spawned directly via `MISSILES_CreateMissileFromParams`
 * (`0x6FC460D0` without `0x400` multishot flag at `0x6FC45AFB`).
 */
const MULTISHOT_EXCLUDED_MISSILE_IDS_113C: ReadonlySet<number> = new Set([
  82, // Fire Enchanted corpse explosion visual
  90, // NovaDeath (`MonUMod #42`) 64-way Nova ring (`0x6FC46520`)
  155, // PoisonDead (`MonUMod #10`) stationary corpsepoisoncloud (`0x6FC46230`)
  194, // Cold Enchanted death Frost Nova ring (already 64-way)
  225, // Scarab (`MonUMod #20`) radial `buglightning` (`0x6FC460D0`)
  284, // Blood Raven death controller (`brdeathcontrol`)
  426, // SuicideMinion explosion
  427, // SuicideMinion fire explosion
  428, // SuicideMinion ice explosion
])

export const SPECTRAL_HIT_ELEMENTS_113C = [
  'fire',
  'ltng',
  'mag',
  'cold',
  'pois',
] as const

export type SpectralHitElement113c = (typeof SPECTRAL_HIT_ELEMENTS_113C)[number]

/**
 * 1.13c physical/weapon hit eligibility for melee/weapon `MonUMod` riders (`#7 Cursed`, `#9 Fire`,
 * `#17 Lightning`, `#18 Cold`, `#23 Poison`, `#25 Mana Burn`, `#27 Spectral Hit`, `#36 Ghostly`):
 * - Melee swings (`fromMissile !== true` and `autoHit !== true`) are always eligible.
 * - Physical/weapon missiles (`fromMissile === true`, `autoHit !== true`, and `physMax > 0` or
 *   `elementType === undefined | 'phys'`) are eligible (`D2Game.dll` `0x6FC41FEB..0x6FC42032`).
 * - Pure elemental spell missiles (`fromMissile === true && physMax <= 0 && elemMax > 0`, e.g.
 *   Council Hydra bolts, Vampire Fire Balls, Fallen Shaman Firebolts) and `autoHit === true`
 *   death/nova effects are NEVER eligible (`#2003`).
 */
export function isPhysicalOrWeaponMonsterHit113c(params: {
  readonly autoHit?: boolean | undefined
  readonly fromMissile?: boolean | undefined
  readonly physMax?: number | undefined
  readonly elemMax?: number | undefined
  readonly elementType?: string | undefined
}): boolean {
  if (params.autoHit === true) return false
  if (params.fromMissile !== true) return true
  const physMax = params.physMax ?? 0
  const elemMax = params.elemMax ?? 0
  if (physMax <= 0 && elemMax > 0) return false
  return (
    physMax > 0 ||
    params.elementType === undefined ||
    params.elementType === 'phys'
  )
}

export interface EnchantedAttackBonusInput113c {
  readonly umodIds: readonly number[]
  readonly isMinion: boolean
  readonly mlvl?: number | undefined
  readonly baseMinDmg: number
  readonly baseMaxDmg: number
  /** Inclusive integer roll in `[min, max]`. */
  readonly rollInt: (min: number, max: number) => number
}

export interface EnchantedAttackBonusResult113c {
  readonly fireDmg: number
  readonly lightDmg: number
  readonly coldDmg: number
  readonly magicDmg: number
  readonly poisonDmg: number
  readonly poisonFrames: number
  readonly chillFrames: number
  readonly spectralElement?: SpectralHitElement113c | undefined
}

/**
 * 1.13c melee/physical-weapon attack elemental rider damage from `MonUMod` (`#1890`, `#1903`, `#2003`):
 * - `#9 Fire Enchanted` (`0x6FC42740`): `+66%..+100%` fire damage (`+33%..+50%` for minions).
 * - `#17 Lightning Enchanted` (`0x6FC42600`): `+66%..+100%` lightning damage (`+33%..+50%` for minions).
 * - `#18 Cold Enchanted` (`0x6FC42490`): `+66%..+100%` cold damage (`+33%..+50%` for minions)
 *   + `100 + 5 * clamp(mlvl, 1, 110)` raw chill frames (`0x6FC425CC: lea eax, [eax+eax*4+0x64]`).
 * - `#23 Poison Enchanted` (`poisonhit`, `0x6FC42320`): `+66%..+100%` (`+33%..+50%` minion) cumulative
 *   poison damage over `(150 + 5 * clamp(mlvl, 1, 110)) * 2 = 300 + 10 * mlvl` frames (`0x6FC4245C..0x6FC42463`).
 * - `#27 Spectral Hit` (`0x6FC42B60` + `.data` `0x6FD1CE00` + `0x6FC41FE0`, boss-only `!isMinion`):
 *   rolls `1` random element out of `5` (`fire`, `ltng`, `mag`, `cold +40f`, `pois +40f`) at `+66%..+100%`.
 * - `#36 Ghostly` (`0x6FC43850` / `0x6FC43917..0x6FC43975`): `+20%..+30%` cold damage + `150` frames chill.
 */
export function rollEnchantedAttackBonus113c(
  input: EnchantedAttackBonusInput113c,
): EnchantedAttackBonusResult113c {
  const loBase = Math.max(1, Math.trunc(input.baseMinDmg))
  const hiBase = Math.max(loBase, Math.trunc(input.baseMaxDmg))
  const clampedMlvl = Math.max(1, Math.min(110, Math.trunc(input.mlvl ?? 1)))
  const minPctEnchant = input.isMinion ? 33 : 66
  const maxPctEnchant = input.isMinion ? 50 : 100

  let fireDmg = 0
  if (input.umodIds.includes(9)) {
    const minFire = Math.max(1, Math.trunc((loBase * minPctEnchant) / 100))
    const maxFire = Math.max(minFire, Math.trunc((hiBase * maxPctEnchant) / 100))
    fireDmg += input.rollInt(minFire, maxFire)
  }

  let lightDmg = 0
  if (input.umodIds.includes(17)) {
    const minLight = Math.max(1, Math.trunc((loBase * minPctEnchant) / 100))
    const maxLight = Math.max(minLight, Math.trunc((hiBase * maxPctEnchant) / 100))
    lightDmg += input.rollInt(minLight, maxLight)
  }

  let coldDmg = 0
  let chillFrames = 0
  if (input.umodIds.includes(18)) {
    const minCold = Math.max(1, Math.trunc((loBase * minPctEnchant) / 100))
    const maxCold = Math.max(minCold, Math.trunc((hiBase * maxPctEnchant) / 100))
    coldDmg += input.rollInt(minCold, maxCold)
    chillFrames += 100 + 5 * clampedMlvl
  }

  let poisonDmg = 0
  let poisonFrames = 0
  if (input.umodIds.includes(23)) {
    const minPois = Math.max(1, Math.trunc((loBase * minPctEnchant) / 100))
    const maxPois = Math.max(minPois, Math.trunc((hiBase * maxPctEnchant) / 100))
    poisonDmg += input.rollInt(minPois, maxPois)
    poisonFrames += (150 + 5 * clampedMlvl) * 2
  }

  let magicDmg = 0
  let spectralElement: SpectralHitElement113c | undefined
  if (!input.isMinion && input.umodIds.includes(27)) {
    const elemIdx = Math.max(0, Math.min(4, input.rollInt(0, 4)))
    spectralElement = SPECTRAL_HIT_ELEMENTS_113C[elemIdx]!
    const minSpec = Math.max(1, Math.trunc((loBase * 66) / 100))
    const maxSpec = Math.max(minSpec, Math.trunc((hiBase * 100) / 100))
    const rolledSpec = input.rollInt(minSpec, maxSpec)
    if (spectralElement === 'fire') {
      fireDmg += rolledSpec
    } else if (spectralElement === 'ltng') {
      lightDmg += rolledSpec
    } else if (spectralElement === 'mag') {
      magicDmg += rolledSpec
    } else if (spectralElement === 'cold') {
      coldDmg += rolledSpec
      chillFrames += 40
    } else {
      poisonDmg += rolledSpec
      poisonFrames += 40
    }
  }

  if (input.umodIds.includes(36)) {
    const minCold = Math.max(1, Math.trunc((loBase * 20) / 100))
    const maxCold = Math.max(minCold, Math.trunc((hiBase * 30) / 100))
    coldDmg += input.rollInt(minCold, maxCold)
    chillFrames = Math.max(chillFrames, 150)
  }

  return {
    fireDmg,
    lightDmg,
    coldDmg,
    magicDmg,
    poisonDmg,
    poisonFrames,
    chillFrames,
    ...(spectralElement !== undefined ? { spectralElement } : {}),
  }
}

export interface TeleportUModEvalInput113c {
  readonly rank?: string | undefined
  readonly level?: number | undefined
  readonly hp: number
  readonly maxHp: number
  readonly distanceToTarget: number
  readonly isRanged?: boolean | undefined
  readonly meleeBlocked?: boolean | undefined
  readonly hasPreventHeal: boolean
  readonly hasActiveDamageOverTime: boolean
}

/**
 * 1.13c `AI_TryTeleportUMod` ranged-archetype check (`D2Game.dll` `0x6FCBCE63..0x6FCBCEAA`):
 * Returns `true` when `MonStats.RangedType != 0` (`isRanged === true`), or when the monster belongs
 * to Skeleton Archer (`hcIdx 10..14`), Council Member (`hcIdx 345..347`), or Baal Subject Mummy (`hcIdx 557..558`).
 */
export function isTeleportUModRangedMonster113c(params: {
  readonly isRanged?: boolean | undefined
  readonly hcIdx?: number | undefined
  readonly defId?: string | undefined
  readonly baseId?: string | undefined
}): boolean {
  if (params.isRanged === true) return true
  const hc = params.hcIdx
  if (
    hc !== undefined &&
    ((hc >= 10 && hc <= 14) || (hc >= 345 && hc <= 347) || hc === 557 || hc === 558)
  ) {
    return true
  }
  const base = params.baseId?.trim().toLowerCase() ?? ''
  if (base === 'skeleton2' || base === 'councilmember1' || base === 'baalsubjectmummy') {
    return true
  }
  const id = params.defId?.trim().toLowerCase() ?? ''
  return (
    id === 'skeleton2' ||
    id.startsWith('councilmember') ||
    id.startsWith('baalsubjectmummy')
  )
}

/**
 * 1.13c `MonUMod #26` (`Teleport`, `D2Game.dll` `0x6FC441B0` / `0x6FCBCDE0`, `#1993`):
 * - Boss-only (`rank !== 'minion'`, `0x6FC441C2: test edi, edi; je`).
 * - When `lifePct < 30%` (`0x6FCBCEB5`), both ranged and melee bosses are eligible to teleport,
 *   and if neither `STATE_PREVENTHEAL (52)` nor active DoT is present, may roll `25%` (`0x6FCBCF61`)
 *   to heal `STAT_LEVEL (12)` (`mlvl` HP, `0x6FCBCF74: shl eax, 8`).
 * - When `lifePct >= 30%`, ranged bosses never teleport (`0x6FCBCEBC`), and melee bosses only
 *   reposition when `distanceToTarget < 10` sub-tiles (`0x6FCBCECA: cmp [edx+0x14], 0xa; jae`).
 */
export function evaluateTeleportUMod113c(input: TeleportUModEvalInput113c): {
  readonly shouldTeleport: boolean
  readonly isLowHp: boolean
  readonly canRollHeal: boolean
  readonly healAmount: number
} {
  if (input.rank === 'minion' || input.hp <= 0 || input.maxHp <= 0) {
    return { shouldTeleport: false, isLowHp: false, canRollHeal: false, healAmount: 0 }
  }
  const lifePct = Math.floor((input.hp * 100) / input.maxHp)
  const isLowHp = lifePct < TELEPORT_UMOD_LOW_HP_PCT_113C
  const shouldTeleport = isLowHp
    ? true
    : input.isRanged !== true && input.distanceToTarget < TELEPORT_UMOD_MELEE_MAX_DIST_113C
  const canRollHeal =
    isLowHp && !input.hasPreventHeal && !input.hasActiveDamageOverTime
  const healAmount = canRollHeal ? Math.max(1, Math.trunc(input.level ?? 1)) : 0
  return { shouldTeleport, isLowHp, canRollHeal, healAmount }
}

/**
 * Whether a monster projectile should spawn `+2` side projectiles for `MonUMod #29` (`Multishot`, `0x6FC45AD0`).
 */
export function isMissileEligibleForMultishot113c(
  missileClassId: number,
  options?: {
    readonly guaranteed?: boolean | undefined
    readonly hitMonsters?: boolean | undefined
    readonly stationary?: boolean | undefined
  },
): boolean {
  if (options?.guaranteed === true || options?.hitMonsters === true || options?.stationary === true) {
    return false
  }
  return !MULTISHOT_EXCLUDED_MISSILE_IDS_113C.has(missileClassId)
}

/**
 * Computes the `+2` side fan target coordinates `(targetX, targetY)` rotated by `±angleRad` around `(originX, originY)`.
 */
export function computeMultishotFanTargets113c(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  angleRad: number = MULTISHOT_FAN_ANGLE_RAD_113C,
): readonly [readonly [number, number], readonly [number, number]] {
  const dx = targetX - originX
  const dy = targetY - originY
  const baseAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
  const dist = Math.max(6, Math.hypot(dx, dy))
  const leftX = originX + Math.cos(baseAngle - angleRad) * dist
  const leftY = originY + Math.sin(baseAngle - angleRad) * dist
  const rightX = originX + Math.cos(baseAngle + angleRad) * dist
  const rightY = originY + Math.sin(baseAngle + angleRad) * dist
  return [
    [leftX, leftY],
    [rightX, rightY],
  ]
}

/**
 * Canonical `MonStats.txt` `aip1` self-resurrect probabilities (`%`) for Act 5 `reanimatedhorde1..6`
 * (`hcIdx 436..440, 698`, plus alias range `511..515`).
 */
const REANIMATED_HORDE_SELF_RES_PCT_BY_HCIDX_113C: Readonly<Record<number, number>> = {
  436: 30, // reanimatedhorde1 (Rot Walker)
  437: 40, // reanimatedhorde2 (Reanimated Horde)
  438: 50, // reanimatedhorde3 (Prowling Dead — Pindleskin's pack)
  439: 60, // reanimatedhorde4 (Unholy Corpse)
  440: 70, // reanimatedhorde5 (Defiled Warrior)
  698: 70, // reanimatedhorde6
  511: 30,
  512: 40,
  513: 50,
  514: 60,
  515: 70,
}

/**
 * 1.13c `MonUMod #34` (`ai_after_death`, `0x6FC43570` / `0x6FC43E20`) & `#293 Self-resurrect` (`0x6FC38A90`):
 * Act 5 `reanimatedhorde` zombies inherently carry `umod 34`, EXCEPT unique/superunique boss leaders
 * (such as Pindleskin himself: `rank === 'unique'` or `superUniqueId !== undefined`).
 */
export function hasImplicitSelfResurrectUMod113c(params: {
  readonly hcIdx: number
  readonly defId: string
  readonly rank: string
  readonly superUniqueId?: string | undefined
  readonly isNpc?: boolean | undefined
  readonly skills?:
    | readonly { readonly skillId?: number | undefined; readonly skill?: string | undefined }[]
    | undefined
}): boolean {
  if (params.isNpc === true) return false
  if (params.rank === 'unique' || params.superUniqueId !== undefined) return false
  if (REANIMATED_HORDE_SELF_RES_PCT_BY_HCIDX_113C[params.hcIdx] !== undefined) return true
  const normDef = params.defId.trim().toLowerCase()
  if (normDef.startsWith('reanimatedhorde')) return true
  if (
    params.skills?.some(
      (s) => s.skillId === 293 || s.skill?.trim().toLowerCase() === 'self-resurrect',
    )
  ) {
    return true
  }
  return false
}

/**
 * Resolves the per-tick self-resurrect probability (`%`) for a `MonUMod #34` corpse.
 */
export function resolveSelfResurrectChancePct113c(hcIdx: number, aiParam0?: number): number {
  const byHcIdx = REANIMATED_HORDE_SELF_RES_PCT_BY_HCIDX_113C[hcIdx]
  if (byHcIdx !== undefined) return byHcIdx
  if (aiParam0 !== undefined && aiParam0 > 0 && aiParam0 <= 100) {
    return Math.trunc(aiParam0)
  }
  return 50
}

/**
 * 1.13c `D2Game.dll` `0x6FC42D70` & `0x6FC42EE4` (`cmp eax, 0x76` = `118` `willowisp1` `BaseId`):
 * All `WillOWisp` / Gloam / Burning Soul variants (`hcIdx 118..122, 639..641, 733`, `baseId = 'willowisp1'`)
 * halve their Champion `%Damage` bonus (`+50%` in Normal instead of `+100%`; `+150%` on Berserk instead of `+300%`).
 */
export function isWillOWispChampion113c(params: {
  readonly hcIdx?: number | undefined
  readonly id?: string | undefined
  readonly baseId?: string | undefined
}): boolean {
  const hc = params.hcIdx
  if (
    hc !== undefined &&
    ((hc >= 118 && hc <= 122) || (hc >= 639 && hc <= 641) || hc === 733)
  ) {
    return true
  }
  const base = params.baseId?.trim().toLowerCase() ?? ''
  if (base === 'willowisp1' || base.startsWith('willowisp')) return true
  const id = params.id?.trim().toLowerCase() ?? ''
  return id.startsWith('willowisp')
}

/**
 * 1.13c `MonUMod #38` (`Possessed`, `0x6FC437E5`: `pMonsterData->nTypeFlags |= 0x20`):
 * Possessed champions cannot be cursed by any player, mercenary, monster, or CtC skill.
 */
export function isMonsterUncursable113c(
  umodIds: readonly number[],
  uncursableFlag?: boolean,
): boolean {
  return uncursableFlag === true || umodIds.includes(38)
}

/**
 * 1.13c `MonUMod #7` (`Cursed`, `0x6FC44250`):
 * Computes `#66 Amplify Damage` `slvl = floor(mlvl / 5) + 1` and `Skills.txt` duration
 * `200 + 75 * (slvl - 1)` frames (`8s + 3s * (slvl - 1)`), scaled by target `curse_resistance`.
 */
export function computeCursedAmplifyDamage113c(
  mlvl: number,
  curseResistancePct = 0,
): {
  readonly slvl: number
  readonly rawDurationFrames: number
  readonly durationFrames: number
} {
  const slvl = Math.floor(Math.max(1, Math.trunc(mlvl)) / 5) + 1
  const rawDurationFrames = 200 + 75 * (slvl - 1)
  if (curseResistancePct >= 100) {
    return { slvl, rawDurationFrames, durationFrames: 0 }
  }
  const durationFrames = Math.max(
    1,
    Math.floor((rawDurationFrames * (100 - curseResistancePct)) / 100),
  )
  return { slvl, rawDurationFrames, durationFrames }
}

/**
 * 1.13c `MonUMod #25` (`Mana Burn`, `0x6FC421D0` / `0x6FC422DD: shl esi, 0x8`):
 * - Rolls `66%..100%` (`33%..50%` for minions) of monster physical base damage (`rawDrain`).
 * - Melee attacks suffer the classic 1.13c double `<< 8` Q8.8 fixed-point shift (`rawDrain * 256 * 256`
 *   in 256-fixed mana = `rawDrain * 256` whole mana points!), whereas ranged missiles drain `rawDrain * 256`
 *   in 256-fixed mana (`rawDrain` whole mana points).
 */
export function computeManaBurnDrainFixed113c(params: {
  readonly isMinion: boolean
  readonly isMelee: boolean
  readonly baseMinDmg: number
  readonly baseMaxDmg: number
  readonly rollInt: (min: number, max: number) => number
}): number {
  const loBase = Math.max(1, Math.trunc(params.baseMinDmg))
  const hiBase = Math.max(loBase, Math.trunc(params.baseMaxDmg))
  const minPct = params.isMinion ? 33 : 66
  const maxPct = params.isMinion ? 50 : 100
  const minDrain = Math.max(1, Math.trunc((loBase * minPct) / 100))
  const maxDrain = Math.max(minDrain, Math.trunc((hiBase * maxPct) / 100))
  const rolledDrain = params.rollInt(minDrain, maxDrain)
  // Q8.8 mana units (256 = 1 whole mana point): melee applies an extra << 8 (x256).
  return params.isMelee ? rolledDrain * 256 * 256 : rolledDrain * 256
}

/**
 * 1.13c `MonUMod #41` (`always_run_ai`, `0x6FC469F0`):
 * Keeps quest/event monsters active even outside normal room/radius AOI culling.
 * NEVER triggers minion death wave on death!
 */
export function isAlwaysRunAiMonster113c(
  umodIds: readonly number[],
  alwaysRunAiFlag?: boolean,
): boolean {
  return alwaysRunAiFlag === true || umodIds.includes(41)
}

/**
 * 1.13c minion-purge on boss death (`MonStats.txt` `killminions` / `SplEndDeath` / `partydead` `umod 15`,
 * Blood Raven `#267`, Shenk the Overseer `#479`):
 * Strictly driven by monster table flags (`killMinions`, `splEndDeath === 1`, `umod 15`, Blood Raven, Shenk),
 * NEVER by `MonUMod #41` (`always_run_ai`).
 */
export function shouldKillMinionsOnDeath113c(params: {
  readonly hcIdx: number
  readonly defId: string
  readonly superUniqueId?: string | undefined
  readonly killMinions?: boolean | undefined
  readonly splEndDeath?: number | undefined
  readonly umodIds: readonly number[]
}): { readonly purge: boolean; readonly radiusSubTiles: number } {
  const normDef = params.defId.trim().toLowerCase()
  const normSu = (params.superUniqueId ?? '').trim().toLowerCase()
  if (params.hcIdx === 267 || normDef === 'bloodraven') {
    return { purge: true, radiusSubTiles: 35 }
  }
  const isShenk =
    (params.hcIdx === 479 || normDef === 'overseer1' || normDef === 'shenk') &&
    (params.killMinions === true ||
      normSu.includes('shenk') ||
      normSu.includes('siege boss') ||
      params.umodIds.includes(22) ||
      params.umodIds.includes(15))
  if (isShenk) {
    return { purge: true, radiusSubTiles: 35 }
  }
  const isInnateSplEndDeath1 =
    (params.hcIdx >= 278 && params.hcIdx <= 282) ||
    (params.hcIdx >= 662 && params.hcIdx <= 664) ||
    normDef.startsWith('fetishshaman')
  if (
    params.killMinions === true ||
    params.splEndDeath === 1 ||
    isInnateSplEndDeath1 ||
    params.umodIds.includes(15)
  ) {
    return { purge: true, radiusSubTiles: 25 }
  }
  return { purge: false, radiusSubTiles: 0 }
}

/**
 * 1.13c `MonUMod #17` (`lightning` / Lightning Enchanted, `D2Game.dll` `0x6FC4634D..0x6FC4639E`, #1995):
 * Per-monster `pMonsterData->dwLastLeFrame` cooldown (`abs(dwGameFrame - dwLastLeFrame) >= 10`).
 */
export const LIGHTNING_UMOD_COOLDOWN_FRAMES_113C = 10

/**
 * 1.13c `MonUMod #17` (`lightning`, `D2Game.dll` `0x6FC463B1..0x6FC463C5`, #1995):
 * `slvl = max(1, floor(mlvl / 2))`.
 */
export function computeLightningEnchantedBoltSlvl113c(mlvl: number): number {
  return Math.max(1, Math.floor(Math.max(1, Math.trunc(mlvl)) / 2))
}

/**
 * 1.13c `Missiles.txt` ID `195` (`lightunique`, `D2Common.dll#10413`, #1995):
 * `HitShift = 8`, `EType = 'ltng'`, `EMin = Emax = 1`, `MinELev1..5 = MaxELev1..5 = 2`, `SrcDamage = 0`:
 * `elemDamage = 1 + 2 * (slvl - 1) = 2 * slvl - 1` (`physDamage = 0`).
 */
export function computeLightningUniqueBoltDamage113c(mlvl: number): number {
  const slvl = computeLightningEnchantedBoltSlvl113c(mlvl)
  return 2 * slvl - 1
}

/**
 * 1.13c `MonUMod #20` (`Scarab`, `D2Game.dll` `0x6FC460D0`, #1995):
 * Spawns `4 * 2 = 8` radial `buglightning` (`Missiles.txt` ID `0xE1 = 225`) bolts on `MONMODE_GETHIT` (`mode = 3`)
 * and `MONMODE_DEATH` (`mode = 0`) across all monster ranks (`col1 = 0x6FC41B00`, `col4 = 0`).
 */
export const SCARAB_CHARGED_BOLT_COUNT_113C = 8
export const SCARAB_BUGLIGHTNING_MISSILE_ID_113C = 225
/**
 * 1.13c `D2Game.dll` `0x6FC460D0` -> `0x6FC61F50` (`0x6FC61F64..0x6FC61F77`, #1997):
 * Caps `#225 buglightning` (`Missiles.txt` `Range = 98`) lifetime to `0x4D` (`77` frames) when `>= 78`.
 */
export const SCARAB_BUGLIGHTNING_MAX_FRAMES_113C = 77

/**
 * 1.13c `MonUMod #20` (`Scarab`, `D2Game.dll` `0x6FC46152..0x6FC46160`, #1995):
 * `slvl = max(1, STAT_LEVEL (12))` (`mlvl` directly, NOT `floor(mlvl / 2)` or `floor((mlvl + 4) / 5)`).
 */
export function computeScarabChargedBoltSlvl113c(mlvl: number): number {
  return Math.max(1, Math.trunc(mlvl))
}

/**
 * 1.13c `Missiles.txt` ID `225` (`buglightning`, `D2Common.dll#10413`, #1995):
 * `HitShift = 0`, `EType = 'ltng'`, `EMin = Emax = 256`, `MinELev1..5 = MaxELev1..5 = 128`, `SrcDamage = 0`:
 * Q8.8 fixed-point damage is `256 + 128 * (slvl - 1) = 128 * (slvl + 1)`, i.e. `1 + floor((slvl - 1) / 2)` HP.
 */
export function computeScarabBugLightningDamage113c(mlvl: number): number {
  const slvl = computeScarabChargedBoltSlvl113c(mlvl)
  return Math.max(1, Math.floor((256 + 128 * (slvl - 1)) / 256))
}

/**
 * Computes the 8 radial `buglightning` target coordinates around `(originX, originY)` matching
 * `D2Game.dll` `0x6FC461D8..0x6FC4620D` (`0x6FD1CE4C` / `0x6FD1CE3C` 4 cardinal axes x 2 jittered bolts, #1995).
 * Extra `_attackerX` / `_attackerY` parameters are accepted for call-site compatibility and ignored, because
 * 1.13c Scarab bolts radiate in all 4 cardinal directions rather than aiming a shotgun cone at the attacker.
 */
export function computeScarabChargedBoltFanTargets113c(
  originX: number,
  originY: number,
  _attackerX = originX,
  _attackerY = originY,
  dist = 1.5,
): readonly { readonly targetX: number; readonly targetY: number }[] {
  const effectiveDist = Math.max(0.5, dist)
  const out: { readonly targetX: number; readonly targetY: number }[] = []
  for (let i = 0; i < SCARAB_CHARGED_BOLT_COUNT_113C; i++) {
    const angle = (2 * Math.PI * i) / SCARAB_CHARGED_BOLT_COUNT_113C
    out.push({
      targetX: originX + Math.cos(angle) * effectiveDist,
      targetY: originY + Math.sin(angle) * effectiveDist,
    })
  }
  return out
}

/**
 * 1.13c `MonUMod #10` (`poisondead`, `D2Game.dll` `0x6FC46230`, `Missiles.txt` ID `155` `corpsepoisoncloud`, #1995):
 * `Range = 80`, `HitShift = 1`, `EType = 'pois'`, `EMin = Emax = 2`, `MinELev1..5 = MaxELev1..5 = 1`, `ELen = 175`.
 */
export const POISONDEAD_CLOUD_MISSILE_ID_113C = 155
export const POISONDEAD_CLOUD_DURATION_FRAMES_113C = 175

export function computePoisonDeadCloudDamage113c(mlvl: number): {
  readonly slvl: number
  readonly bitrate256: number
  readonly durationFrames: number
  readonly totalPoisonHp: number
} {
  const slvl = Math.max(1, Math.trunc(mlvl))
  const bitrate256 = (2 + (slvl - 1)) << 1
  const durationFrames = POISONDEAD_CLOUD_DURATION_FRAMES_113C
  const totalPoisonHp = Math.max(1, Math.floor((bitrate256 * durationFrames) / 256))
  return { slvl, bitrate256, durationFrames, totalPoisonHp }
}

/**
 * 1.13c `MonUMod #42` (`novadeath`, `D2Game.dll` `0x6FC46520` -> `0x6FCC2800`, #1995):
 * Boss-only (`bBoss != 0`) 64-bolt ring of `Missiles.txt` ID `90` (`nova`, `Range = 13`, `Vel = 24`, `Skill = 'Nova'` `#48`).
 * `Skills.txt` `#48 Nova`: `HitShift = 8`, `EType = 'ltng'`, `EMin = 1`, `EMinLev1..3 = 6, 7, 8`, `EMax = 20`, `EMaxLev1..3 = 8, 9, 10`.
 */
export const NOVADEATH_MISSILE_ID_113C = 90
export const NOVADEATH_RANGE_TICKS_113C = 13

export function computeNovaDeathDamageRange113c(slvl = 1): {
  readonly slvl: number
  readonly minLtng: number
  readonly maxLtng: number
} {
  const s = Math.max(1, Math.min(15, Math.trunc(slvl)))
  const tiered = (base: number, l1: number, l2: number, l3: number): number => {
    const t1 = Math.min(Math.max(0, s - 1), 7)
    const t2 = Math.min(Math.max(0, s - 8), 8)
    const t3 = Math.max(0, s - 16)
    return base + t1 * l1 + t2 * l2 + t3 * l3
  }
  const minLtng = tiered(1, 6, 7, 8)
  const maxLtng = Math.max(minLtng, tiered(20, 8, 9, 10))
  return { slvl: s, minLtng, maxLtng }
}

/**
 * 1.13c innate `MonUMod #20` (`Scarab`, #1947):
 * `MonStats.txt` `scarab1..8` (`hcIdx 91..95, 654, 655, 718`, `MonType = scarab`).
 */
export function hasImplicitScarabUMod113c(params: {
  readonly hcIdx: number
  readonly defId?: string | undefined
  readonly monType?: string | undefined
  readonly baseId?: string | undefined
  readonly isNpc?: boolean | undefined
}): boolean {
  if (params.isNpc === true) return false
  const hc = params.hcIdx
  if ((hc >= 91 && hc <= 95) || hc === 654 || hc === 655 || hc === 718) {
    return true
  }
  const monType = (params.monType ?? '').trim().toLowerCase()
  if (monType === 'scarab') return true
  const baseId = (params.baseId ?? '').trim().toLowerCase()
  if (baseId === 'scarab1' || baseId.startsWith('scarab')) return true
  const defId = (params.defId ?? '').trim().toLowerCase()
  return defId.startsWith('scarab')
}

/**
 * 1.13c innate `MonUMod #35` (`shatter_on_death`, `D2Game.dll` `0x6FC41A70`, #1948):
 * Act 5 `frozenhorror1..5` (`hcIdx 501..505`: Frozen Creeper, Frozen Terror, Frozen Scourge,
 * Frozen Horror, Frozen Abyss — including SuperUnique `Snapchip Shatter`).
 */
export function hasImplicitShatterOnDeathUMod113c(params: {
  readonly hcIdx: number
  readonly defId?: string | undefined
  readonly monType?: string | undefined
  readonly baseId?: string | undefined
  readonly isNpc?: boolean | undefined
}): boolean {
  if (params.isNpc === true) return false
  if (params.hcIdx >= 501 && params.hcIdx <= 505) return true
  const monType = (params.monType ?? '').trim().toLowerCase()
  if (monType === 'frozenhorror') return true
  const baseId = (params.baseId ?? '').trim().toLowerCase()
  if (baseId === 'frozenhorror1' || baseId.startsWith('frozenhorror')) return true
  const defId = (params.defId ?? '').trim().toLowerCase()
  return defId.startsWith('frozenhorror')
}
