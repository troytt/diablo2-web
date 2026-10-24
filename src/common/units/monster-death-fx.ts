/**
 * Diablo II v1.13c Monster Unique Modifiers (`MonUMod.txt`), Innate Monster Death Mechanics
 * (`MonStats.txt` `deathDmg` / `SplEndDeath`), and Act/Quest Boss Death Sequences
 * (`D2Game.dll` `MonsterUnique.cpp` / `QuestsFX.cpp` & `D2Client.dll` `Missiles.txt` `pCltDoFunc`).
 */

import { CLTDO25_RING_X_113C, CLTDO25_RING_Y_113C } from '../skills/cltdo25-ring-113c.ts'
import { MONSTATS2_FLAGINDEX, hasMonStats2Flag } from './monstats2-flags.ts'

/**
 * 2:1 isometric ground projection aspect ratio (`ORTHO_SUB_TILE_HEIGHT / ORTHO_SUB_TILE_WIDTH = 8 / 16 = 0.5`).
 * All radial ground-plane rings (Cold Enchanted Frost Nova, Andariel / Mephisto radial firewall makers)
 * expand on the sub-tile ground plane and project to a 2:1 ellipse in screen space.
 */
export const ISO_GROUND_ASPECT_RATIO = 0.5

/**
 * Canonical `MonUMod.txt` IDs (Diablo II v1.13c).
 */
export const MON_UMOD_ID = Object.freeze({
  NONE: 0,
  RNDNAME: 1,
  HPMULTIPLY: 2,
  LIGHT: 3,
  LEVELADD: 4,
  STRONG: 5,
  FAST: 6,
  CURSE: 7,
  RESIST: 8,
  FIRE: 9,
  POISONDEAD: 10,
  DURIELDEAD: 11,
  BLOODRAVEN: 12,
  RAGE: 13,
  SPCDAMAGE: 14,
   PARTYDEAD: 15,
  CHAMPION: 16,
  LIGHTNING: 17,
  COLD: 18,
  HIRESPCL: 19,
  SCARAB: 20,
  QUESTCOMPLETE: 22,
  POISONHIT: 23,
  THIEF: 24,
  MANahit: 25,
  TELEPORT: 26,
  SPECTRALHIT: 27,
  STONESKIN: 28,
  MULTISHOT: 29,
  AURA: 30,
  GOBOOM: 31,
  FIRESPIKE_EXPLODE: 32,
  SUICIDEMINION_EXPLODE: 33,
  AI_AFTER_DEATH: 34,
  SHATTER_ON_DEATH: 35,
  GHOSTLY: 36,
  FANATIC: 37,
  POSSESSED: 38,
  BERSERK: 39,
  WORMS_ON_DEATH: 40,
  ALWAYS_RUN_AI: 41,
  POISON: 10,
  /** MonUMod 15 `partydead` / `killminionsdeath` (`D2Game.dll`). */
  KILL_MINIONS: 15,
  KILLMINIONSDEATH: 15,
  /** MonUMod 21 `tempsummon`: set on timed summons (`D2Game.dll`). */
  TEMPSUMMON: 21,
  BONEFETISH: 31,
  /** MonUMod 31 `goboom` (`corpseboom`): `D2Client.dll` event-2 handler 0x6fad0e60. */
  CORPSEBOOMDEATH: 31,
  SUICIDEMINION: 33,
  SUICIDE: 33,
  /** MonUMod 40 `worms_on_death`: `D2Client.dll` handler 0x6fad0fa0 -> 0x6fad0a60. */
  PAINWORMDEATH: 40,
  /** MonUMod 42 `novadeath`: `D2Client.dll` 0x6fad0c40 `edi == 0x2a` branch. */
  NOVADEATH: 42,
  /** MonUMod 43 `freeze` (`MonUMod.txt`). */
  FREEZE: 43,
  FIRE_ENCHANTED: 9,
  LIGHTNING_ENCHANTED: 17,
  COLD_ENCHANTED: 18,
} as const)

export const MON_UMOD = MON_UMOD_ID

/**
 * Map from canonical string names/aliases to `MonUMod.txt` numeric IDs.
 */
export const MON_UMOD_NAME_TO_ID: Readonly<Record<string, number>> = Object.freeze({
  rndname: 1,
  hpmultiply: 2,
  light: 3,
  leveladd: 4,
  strong: 5,
  'extra strong': 5,
  extrastrong: 5,
  fast: 6,
  'extra fast': 6,
  extrafast: 6,
  curse: 7,
  cursed: 7,
  resist: 8,
  'magic resistant': 8,
  magicresistant: 8,
  fire: 9,
  fireenchant: 9,
  fireenchanted: 9,
  'fire enchanted': 9,
  poison: 10,
  poisondead: 10,
  durieldead: 11,
  bloodraven: 12,
  rage: 13,
  spcdamage: 14,
  partydead: 15,
  champion: 16,
  lightning: 17,
  lightenchant: 17,
  lightningenchant: 17,
  lightningenchanted: 17,
  'lightning enchanted': 17,
  cold: 18,
  coldenchant: 18,
  coldenchanted: 18,
  'cold enchanted': 18,
  hirespcl: 19,
  scarab: 20,
  tempsummon: 21,
  killminionsdeath: 15,
  kill_minions: 15,
  questcomplete: 22,
  poisonhit: 23,
  thief: 24,
  manahit: 25,
  manaburn: 25,
  'mana burn': 25,
  teleport: 26,
  teleportation: 26,
  spectralhit: 27,
  spechit: 27,
  'spectral hit': 27,
  stoneskin: 28,
  'stone skin': 28,
  multishot: 29,
  multipleshot: 29,
  multipleshots: 29,
  'multiple shot': 29,
  aura: 30,
  auraenchant: 30,
  auraenchanted: 30,
  'aura enchanted': 30,
  goboom: 31,
  bonefetish: 31,
  firespike_explode: 32,
  firespikeexplode: 32,
  suicideminion_explode: 33,
  suicideminionexplode: 33,
  suicideminion: 33,
  ai_after_death: 34,
  aiafterdeath: 34,
  shatter_on_death: 35,
  shatterondeath: 35,
  ghostly: 36,
  fanatic: 37,
  possessed: 38,
  berserk: 39,
  worms_on_death: 40,
  wormsondeath: 40,
  painwormdeath: 40,
  always_run_ai: 41,
  alwaysrunai: 41,
  novadeath: 42,
  freeze: 43,
  chargedbolts: 20,
  charged_bolts: 20,
})

export type MonsterUModSource =
  | readonly (number | string)[]
  | {
      readonly monUMods?: readonly (number | string)[] | undefined
      readonly bossMods?: readonly (number | string)[] | undefined
      readonly mods?: readonly (number | string)[] | undefined
      readonly modifiers?: readonly (number | string)[] | undefined
      readonly umods?: readonly (number | string)[] | undefined
      readonly stats?: unknown
    }
  | undefined
  | null

/**
 * Normalizes a monster modifier list (`bossMods` numbers, `mods` strings, or a unit object) into a deduplicated set of `MonUMod.txt` IDs.
 */
export function resolveMonsterUModIds(source: MonsterUModSource): Set<number> {
  const out = new Set<number>()
  if (!source) return out
  const srcObj = source as {
    readonly monUMods?: readonly (number | string)[]
    readonly bossMods?: readonly (number | string)[]
    readonly mods?: readonly (number | string)[]
    readonly modifiers?: readonly (number | string)[]
    readonly umods?: readonly (number | string)[]
    readonly stats?: {
      readonly monUMods?: readonly (number | string)[]
      readonly bossMods?: readonly (number | string)[]
      readonly mods?: readonly (number | string)[]
      readonly modifiers?: readonly (number | string)[]
      readonly umods?: readonly (number | string)[]
    }
  }
  const lists: (readonly (number | string)[] | undefined)[] = Array.isArray(source)
    ? [source as readonly (number | string)[]]
    : [
        srcObj.monUMods,
        srcObj.bossMods,
        srcObj.mods,
        srcObj.modifiers,
        srcObj.umods,
        srcObj.stats?.monUMods,
        srcObj.stats?.bossMods,
        srcObj.stats?.mods,
        srcObj.stats?.modifiers,
        srcObj.stats?.umods,
      ]
  for (const mods of lists) {
    if (!mods) continue
    for (const raw of mods) {
      if (typeof raw === 'number') {
        if (Number.isInteger(raw) && raw > 0) {
          out.add(raw)
        }
      } else if (typeof raw === 'string') {
        const clean = raw.trim().toLowerCase()
        if (!clean) continue
        const asNum = Number(clean)
        if (Number.isInteger(asNum) && asNum > 0) {
          out.add(asNum)
          continue
        }
        const compact = clean.replace(/[\s_-]+/g, '')
        const mapped = MON_UMOD_NAME_TO_ID[clean] ?? MON_UMOD_NAME_TO_ID[compact]
        if (mapped !== undefined) {
          out.add(mapped)
        }
      }
    }
  }
  return out
}

/**
 * Returns `true` if `source` contains the given `MonUMod.txt` ID or name.
 */
export function hasMonsterUMod(
  source: MonsterUModSource,
  targetMod: number | string,
): boolean {
  const set = resolveMonsterUModIds(source)
  if (typeof targetMod === 'number') {
    return set.has(targetMod)
  }
  const clean = targetMod.trim().toLowerCase()
  const compact = clean.replace(/[\s_-]+/g, '')
  const mapped = MON_UMOD_NAME_TO_ID[clean] ?? MON_UMOD_NAME_TO_ID[compact] ?? Number(clean)
  if (mapped === MON_UMOD_ID.FIRE) {
    return set.has(MON_UMOD_ID.FIRE)
  }
  return Number.isInteger(mapped) && mapped > 0 ? set.has(mapped) : false
}

function normalizeDifficultyIndex(difficulty: number | 'normal' | 'nightmare' | 'hell' = 0): 0 | 1 | 2 {
  if (typeof difficulty === 'string') {
    const clean = difficulty.trim().toLowerCase()
    if (clean === 'hell') return 2
    if (clean === 'nightmare') return 1
    return 0
  }
  return Math.max(0, Math.min(2, Math.trunc(difficulty))) as 0 | 1 | 2
}

/**
 * 1.13c `MonUMod.txt` `[constants]` for Fire Enchanted (`id=9`) corpse explosion:
 * - Row 10: `66` (`[unique]FireMinDam%` of monster base max HP)
 * - Row 11: `100` (`[unique]FireMaxDam%` of monster base max HP)
 * - 1.13c `MONSTERUNIQUE_UMod09_FireEnchantedDeath` difficulty scaling multipliers:
 *   Normal (`0`): `0.20` (1/5), Nightmare (`1`): `0.35`, Hell (`2`): `0.20` (1/5).
 *   Total damage is split 50% Physical + 50% Fire within a 4-subtile radius.
 */
export const FIRE_ENCHANT_MIN_HP_PCT = 75
export const FIRE_ENCHANT_MAX_HP_PCT = 100
export const FIRE_ENCHANT_DIFF_SCALE: readonly [number, number, number] = [0.2, 0.35, 0.2] as const
export const FIRE_ENCHANT_EXPLOSION_RADIUS = 4

export interface FireEnchantedExplosionDamage {
  readonly physDmg: number
  readonly fireDmg: number
  readonly totalDmg: number
  readonly minPhys: number
  readonly maxPhys: number
  readonly minFire: number
  readonly maxFire: number
  readonly radiusSubTiles: number
}

/**
 * Computes 1.13c Fire Enchanted (`MonUMod` #9) corpse explosion damage (50% physical + 50% fire).
 * Minions (`isMinion === true`) never trigger Fire Enchanted death explosions.
 */
export function calcFireEnchantedDeathDamage(
  baseMaxHp: number,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
  rollOrIsMinion: number | boolean = 0.5,
  roll01 = 0.5,
): FireEnchantedExplosionDamage {
  const isMinion = typeof rollOrIsMinion === 'boolean' ? rollOrIsMinion : false
  if (isMinion || !Number.isFinite(baseMaxHp) || baseMaxHp <= 0) {
    return {
      physDmg: 0,
      fireDmg: 0,
      totalDmg: 0,
      minPhys: 0,
      maxPhys: 0,
      minFire: 0,
      maxFire: 0,
      radiusSubTiles: FIRE_ENCHANT_EXPLOSION_RADIUS,
    }
  }
  const safeHp = Math.max(1, baseMaxHp)
  const diffIdx = normalizeDifficultyIndex(difficulty)
  const diffScale = FIRE_ENCHANT_DIFF_SCALE[diffIdx]
  const effRoll = typeof rollOrIsMinion === 'number' ? rollOrIsMinion : roll01
  const clampedRoll = Math.max(0, Math.min(1, effRoll))
  const pct =
    FIRE_ENCHANT_MIN_HP_PCT +
    (FIRE_ENCHANT_MAX_HP_PCT - FIRE_ENCHANT_MIN_HP_PCT) * clampedRoll
  const rawTotal = Math.max(2, Math.round((safeHp * (pct / 100)) * diffScale))
  const half = Math.max(1, Math.round(rawTotal * 0.5))
  const minHalf = Math.max(1, Math.round(Math.max(2, Math.round((safeHp * (FIRE_ENCHANT_MIN_HP_PCT / 100)) * diffScale)) * 0.5))
  const maxHalf = Math.max(minHalf, Math.round(Math.max(2, Math.round((safeHp * (FIRE_ENCHANT_MAX_HP_PCT / 100)) * diffScale)) * 0.5))
  return {
    physDmg: half,
    fireDmg: half,
    totalDmg: half * 2,
    minPhys: minHalf,
    maxPhys: maxHalf,
    minFire: minHalf,
    maxFire: maxHalf,
    radiusSubTiles: FIRE_ENCHANT_EXPLOSION_RADIUS,
  }
}

/**
 * Computes 1.13c Bone Fetish (`MonUMod` #31 `goboom` / `MonStats.txt` `deathDmg=1`) death explosion damage.
 * Pure physical splash damage (`100% physical`, `0 fire`) within a 4-subtile radius, subject to armor/physical resist and 5% crit.
 */
export const BONE_FETISH_EXPLOSION_RADIUS = 4

export interface BoneFetishExplosionDamage {
  readonly physDmg: number
  readonly minPhys: number
  readonly maxPhys: number
  readonly minFire: 0
  readonly maxFire: 0
  readonly isCrit: boolean
  readonly radiusSubTiles: number
}

export function calcBoneFetishDeathDamage(
  baseMaxHp: number,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
  rollOrIsMinion: number | boolean = 0.5,
  critRoll01 = 0.5,
): BoneFetishExplosionDamage {
  const isMinion = typeof rollOrIsMinion === 'boolean' ? rollOrIsMinion : false
  if (isMinion || !Number.isFinite(baseMaxHp) || baseMaxHp <= 0) {
    return {
      physDmg: 0,
      minPhys: 0,
      maxPhys: 0,
      minFire: 0,
      maxFire: 0,
      isCrit: false,
      radiusSubTiles: BONE_FETISH_EXPLOSION_RADIUS,
    }
  }
  const safeHp = Math.max(1, baseMaxHp)
  void difficulty
  const effRoll = typeof rollOrIsMinion === 'number' ? rollOrIsMinion : 0.5
  const clampedRoll = Math.max(0, Math.min(1, effRoll))
  const pct = 20 + 20 * clampedRoll
  const minPhys = Math.floor((safeHp * 20) / 100)
  const maxPhys = Math.max(minPhys, Math.floor((safeHp * 40) / 100))
  const basePhys = Math.max(1, Math.floor((safeHp * pct) / 100))
  const isCrit = critRoll01 < 0.05
  return {
    physDmg: isCrit ? basePhys * 2 : basePhys,
    minPhys,
    maxPhys,
    minFire: 0,
    maxFire: 0,
    isCrit,
    radiusSubTiles: BONE_FETISH_EXPLOSION_RADIUS,
  }
}

/**
 * Computes 1.13c Cold Enchanted (`MonUMod` #18 `cold`) death nova parameters.
 *
 * D2Client 0x6fad0c40 (`edi == 0x12`, mode 0, event param 4): velocity = `Vel` of missile 0x77
 * (`frostnova`, via 0x6fabcb5c), then 0x6fb51020(missile 0xc2 = 194 `coldunique`, -1, level = stat 12)
 * spawns one missile per entry of the 64-entry ring table (`D2CLIENT_NOVA_RING_X/Y`).
 * Server (`D2Game.dll` `0x6fd14170`): casts `coldunique` (#194) with `frostnova` (#119) velocity.
 * Chill length (`ELen`) = `(8 + sLvl) * 25` frames (`40ms` per frame).
 */
export interface ColdEnchantedNovaSpec {
  readonly triggered: boolean
  /** Missile level passed to 0x6fb51020 = monster `STAT_LEVEL` (12). */
  readonly skillLevel: number
  readonly sLvl: number
  readonly missileKey: 'coldunique'
  /** Missiles.txt row whose `Vel` overrides the ring velocity (0x6fabcb5c(0x77)). */
  readonly velocityMissileKey: 'frostnova'
  readonly boltCount: 64
  readonly directions: 64
  readonly rangeTicks: 14
  readonly coldMinDmg: number
  readonly coldMaxDmg: number
  readonly chillFrames: number
  readonly chillDurationMs: number
}

export function calcColdEnchantedDeathNova(
  mlvl = 1,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
  isMinion = false,
): ColdEnchantedNovaSpec {
  const diffIdx = normalizeDifficultyIndex(difficulty)
  const sLvl = Math.max(1, Math.floor(Math.max(1, mlvl) / 2))
  const diffPenalty = diffIdx === 2 ? 0.25 : diffIdx === 1 ? 0.5 : 1
  const coldMinDmg = isMinion ? 0 : Math.max(2, Math.floor((2 + (sLvl - 1) * 2) * (1 + diffIdx * 0.5)))
  const coldMaxDmg = isMinion ? 0 : Math.max(coldMinDmg + 2, Math.floor((4 + (sLvl - 1) * 3) * (1 + diffIdx * 0.5)))
  const baseChillFrames = (8 + sLvl) * 25
  const chillFrames = isMinion ? 0 : Math.max(25, Math.floor(baseChillFrames * diffPenalty))
  return {
    triggered: !isMinion,
    skillLevel: Math.max(1, mlvl),
    sLvl,
    missileKey: 'coldunique',
    velocityMissileKey: 'frostnova',
    boltCount: 64,
    directions: 64,
    rangeTicks: 14,
    coldMinDmg,
    coldMaxDmg,
    chillFrames,
    chillDurationMs: chillFrames * 40,
  }
}

/**
 * D2Client 1.13c 64-entry nova ring offset tables used by 0x6fb51020 -> 0x6fb50db0
 * (`for i in 0..63: params.targetX(+0x1c) = X[i]; params.targetY(+0x20) = Y[i]; 0x6fb630f0(params)`).
 * X @ .rdata 0x6fb84390, Y @ .rdata 0x6fb84290 (radius 30 sub-tiles, relative to the caster).
 */
export const D2CLIENT_NOVA_RING_X: readonly number[] = CLTDO25_RING_X_113C
export const D2CLIENT_NOVA_RING_Y: readonly number[] = CLTDO25_RING_Y_113C

/**
 * The five sub-tile points used by the D2Client corpse-boom style death handlers
 * (fire enchanted 0x6fad0d20, corpseboom 0x6fad0e60): `(x, y)` plus the four diagonal neighbours.
 */
export const D2CLIENT_DEATH_BOOM_POINTS: readonly { readonly dx: number; readonly dy: number }[] =
  Object.freeze([
    { dx: 0, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ])

export interface IsoRadialVector {
  readonly index: number
  readonly angleRad: number
  readonly dirX: number
  readonly dirY: number
  readonly dx: number
  readonly dy: number
  readonly targetX: number
  readonly targetY: number
  /** Projected isometric screen-space offset (`(dirX - dirY) * 16`, `(dirX + dirY) * 8`), aspect ratio = 0.5. */
  readonly isoScreenDx: number
  readonly isoScreenDy: number
}

/**
 * Generates radial ring vectors on the sub-tile ground plane and their 2:1 isometric screen projections
 * (`ISO_GROUND_ASPECT_RATIO = 0.5`, `isoScreenDy / isoScreenDx` semi-axis ratio = `0.5`).
 * Supports either `(count, radiusSubTiles)` (centered at `(0, 0)`) or `(originX, originY, count, radiusSubTiles)`.
 */
export function computeIsoRadialRingVectors(
  arg1 = 32,
  arg2 = 16,
  arg3?: number,
  arg4?: number,
): IsoRadialVector[] {
  const hasOrigin = arg3 !== undefined
  const originX = hasOrigin ? arg1 : 0
  const originY = hasOrigin ? arg2 : 0
  const count = hasOrigin ? arg3 : arg1
  const radiusSubTiles = hasOrigin ? (arg4 ?? 16) : arg2
  const safeCount = Math.max(1, Math.trunc(count))
  const vectors: IsoRadialVector[] = []
  for (let i = 0; i < safeCount; i++) {
    const angleRad = (2 * Math.PI * i) / safeCount
    const dirX = Math.cos(angleRad)
    const dirY = Math.sin(angleRad)
    const dx = dirX * radiusSubTiles
    const dy = dirY * radiusSubTiles
    vectors.push({
      index: i,
      angleRad,
      dirX,
      dirY,
      dx,
      dy,
      targetX: originX + dx,
      targetY: originY + dy,
      isoScreenDx: (dx - dy) * 16,
      isoScreenDy: (dx + dy) * 16 * ISO_GROUND_ASPECT_RATIO,
    })
  }
  return vectors
}

/**
 * 8-direction Charged Bolt vectors for `MonUMod` #17 (`lightning` -> `lightunique` #195)
 * and `MonUMod` #20 (`scarab` -> `buglightning` #225).
 * Supports either `(radiusSubTiles)` or `(originX, originY, radiusSubTiles)`.
 */
export function computeChargedBolt8WayVectors(
  arg1 = 16,
  arg2?: number,
  arg3?: number,
): IsoRadialVector[] {
  if (arg2 === undefined) {
    return computeIsoRadialRingVectors(0, 0, 8, arg1)
  }
  return computeIsoRadialRingVectors(arg1, arg2, 8, arg3 ?? 16)
}

/**
 * Innate monster `hcIdx` (`classId`) sets from 1.13c `MonStats.txt`.
 */
export function isScarabMonster(classId: number | string, monType?: string): boolean {
  const numId = typeof classId === 'number' ? classId : Number(classId)
  if (
    (numId >= 91 && numId <= 95) ||
    numId === 654 ||
    numId === 655 ||
    numId === 718
  ) {
    return true
  }
  const clean = (monType ?? (typeof classId === 'string' ? classId : '')).trim().toLowerCase()
  if (clean.startsWith('scarab')) return true
  return false
}

export function isPoisonDeadMonster(classId: number | string, monType?: string): boolean {
  const numId = typeof classId === 'number' ? classId : Number(classId)
  if (
    numId === 9 ||
    (numId >= 96 && numId <= 100) ||
    numId === 703
  ) {
    return true
  }
  const clean = (monType ?? (typeof classId === 'string' ? classId : '')).trim().toLowerCase()
  if (clean === 'zombie5' || clean.startsWith('mummy')) return true
  return false
}

export function isBoneFetishMonster(classId: number | string, monType?: string): boolean {
  const numId = typeof classId === 'number' ? classId : Number(classId)
  if ((numId >= 212 && numId <= 216) || numId === 690 || numId === 691) {
    return true
  }
  const clean = (monType ?? (typeof classId === 'string' ? classId : '')).trim().toLowerCase()
  if (clean.startsWith('bonefetish')) return true
  return false
}

export function isSuicideMinionMonster(classId: number | string, monType?: string): boolean {
  const numId = typeof classId === 'number' ? classId : Number(classId)
  if (numId >= 461 && numId <= 468) {
    return true
  }
  const clean = (monType ?? (typeof classId === 'string' ? classId : '')).trim().toLowerCase()
  if (clean.startsWith('suicideminion')) return true
  return false
}

/**
 * 1.13c `MonStats.txt` `aip1`, `aip1(N)`, `aip1(H)` flat lookup (`hcIdx * 3 + diffIdx`, `hcIdx` `0..733`).
 * Read by `D2Client.dll` `0x6facffc0` (`MonUMod` #33 `suicideminion` event-2 handler, `movsx edi, WORD PTR [eax + edx*2 + 0x56]`).
 */
const MONSTATS_AIP1_FLAT_113C: readonly number[] = Object.freeze([
  60,65,70,70,75,80,80,85,90,90,95,95,99,99,99,30,40,50,40,50,60,50,60,70,100,100,100,60,70,80,88,75,75,86,100,100,80,50,50,83,0,0,90,33,33,30,45,65,
  30,50,65,30,55,65,30,60,65,30,40,50,45,50,55,55,60,60,65,70,70,75,80,80,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,40,40,40,45,40,40,50,40,35,
  55,40,35,60,40,35,0,0,0,0,0,0,0,0,0,0,0,0,50,60,60,60,70,70,70,80,80,80,90,90,90,100,100,60,70,80,70,80,90,80,85,90,90,95,95,99,99,99,
  33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,75,75,80,75,75,80,75,80,85,75,80,85,75,85,90,45,50,55,55,60,65,65,70,75,70,80,85,75,85,90,10,15,20,
  15,17,20,20,20,22,23,23,23,25,25,27,35,35,35,40,40,40,45,45,45,50,50,50,55,55,55,40,45,45,45,50,50,50,55,55,55,60,60,60,65,65,20,21,23,20,21,23,
  20,21,24,20,22,24,20,22,25,70,70,70,80,80,80,90,90,90,90,90,90,60,60,60,60,60,60,60,60,60,60,60,60,75,80,84,80,85,88,85,88,92,88,91,94,90,94,96,
  5,9,15,10,12,18,15,16,21,20,22,23,25,25,25,70,70,70,75,75,75,80,80,80,85,85,85,85,85,85,0,0,0,0,0,0,0,0,0,0,0,0,70,75,80,80,80,85,
  85,85,90,90,90,95,0,0,0,0,0,0,0,0,0,0,0,0,40,50,60,50,60,65,60,70,70,70,70,75,45,55,60,55,65,70,65,75,75,75,75,75,75,75,75,80,80,80,
  85,85,85,90,90,90,100,100,100,55,55,55,65,65,65,76,76,76,85,85,85,85,85,85,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,100,100,100,100,100,100,100,100,100,
  100,100,100,100,100,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,50,60,70,0,0,0,0,0,0,30,35,35,0,0,0,0,0,0,0,0,0,
  60,65,70,70,75,80,80,85,90,90,90,95,99,99,99,60,60,60,70,70,70,80,80,80,90,90,90,99,99,99,75,80,85,75,80,85,80,85,90,80,85,90,90,90,95,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,75,78,80,80,83,85,85,88,90,88,91,93,90,93,95,0,0,0,75,80,85,80,85,90,85,90,95,90,95,97,250,200,200,240,200,200,
  210,200,200,180,200,200,150,200,200,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,100,80,70,100,80,70,
  100,80,70,100,80,70,0,0,0,5,5,6,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,125,110,90,85,85,85,20,20,20,20,20,20,20,20,20,20,20,20,90,90,90,65,75,85,76,85,90,85,90,95,25,25,25,30,30,30,
  35,35,35,40,40,40,15,20,25,0,0,0,0,0,0,0,0,0,0,0,0,65,70,85,70,75,90,75,80,95,85,93,98,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  45,50,50,0,0,0,70,75,80,80,85,90,90,95,95,70,75,80,80,85,90,90,90,95,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,24,26,28,35,65,85,35,65,85,35,65,85,35,65,85,40,45,45,40,45,45,40,45,45,40,45,45,40,45,45,0,0,0,7,8,9,8,9,10,9,10,11,10,11,12,
  11,12,13,85,85,85,90,90,90,90,90,90,90,90,90,90,90,90,0,0,0,33,33,33,0,0,0,0,0,0,16,17,20,16,18,21,16,19,22,80,85,90,80,85,90,80,85,90,
  40,40,40,60,60,60,80,60,60,70,75,75,80,80,80,90,90,90,90,95,100,40,75,100,6,7,8,60,70,80,70,75,85,80,80,90,90,90,95,95,95,95,0,0,0,0,0,0,
  0,0,0,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,25,30,32,5,5,5,5,5,5,20,20,20,25,30,32,0,0,0,4,4,4,0,0,0,16,17,21,16,18,22,
  16,19,23,16,20,24,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,75,75,75,60,60,60,65,65,65,10,7,3,10,7,3,10,7,3,0,0,0,
  0,0,0,0,0,0,70,70,70,0,0,0,0,0,0,85,85,85,0,0,0,0,0,0,50,65,80,55,70,85,60,75,90,60,60,60,80,80,80,0,0,0,0,0,0,0,0,0,
  0,0,0,20,20,20,0,0,0,1,1,1,10,7,3,70,70,70,70,70,70,70,70,70,70,70,70,0,0,0,0,0,0,35,65,85,35,65,85,35,65,85,35,65,85,35,65,85,
  35,65,85,35,65,85,35,65,85,35,65,85,35,65,85,35,65,85,35,65,85,99,99,99,0,0,0,0,0,0,70,70,70,70,70,70,20,20,20,20,20,20,20,20,20,20,20,20,
  20,20,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,100,100,100,100,100,100,100,100,100,0,0,0,16,16,16,100,100,100,
  30,30,30,40,40,40,20,10,10,10,10,10,22,22,22,22,22,22,20,20,20,20,20,20,20,20,20,100,100,100,50,50,50,50,50,50,15,15,15,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,40,40,40,30,45,55,40,55,65,50,65,70,60,70,80,70,80,85,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,70,75,80,70,75,80,70,75,80,70,75,80,70,75,80,70,75,80,70,75,80,70,75,80,15,15,15,15,15,15,15,15,15,
  15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,90,91,93,90,91,94,90,92,94,90,92,95,90,93,95,90,90,90,90,90,90,90,90,90,90,90,90,90,90,90,250,250,250,
  250,250,250,250,250,250,250,250,250,250,250,250,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,25,25,25,5,5,5,10,10,10,0,0,0,
  0,0,0,20,22,25,20,22,25,20,22,25,20,22,25,60,65,70,60,70,75,60,75,80,60,80,85,60,85,90,90,90,90,90,90,90,90,90,90,90,90,90,90,90,90,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,8,12,16,8,12,16,8,12,16,8,12,16,0,0,0,0,0,0,15,15,15,15,15,15,0,0,0,0,0,0,30,30,30,0,0,0,
  80,80,80,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,15,15,15,15,15,15,15,15,25,25,25,
  0,0,0,3,3,3,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,80,85,90,80,85,90,80,85,90,80,85,90,80,85,90,0,0,0,65,65,65,60,75,90,4,4,4,
  1,1,1,1,1,1,70,70,70,80,80,80,90,90,90,90,90,90,90,90,90,0,0,0,0,0,0,0,0,0,0,0,0,90,90,90,90,90,90,90,90,90,0,0,0,80,90,95,
  80,92,96,85,94,97,85,95,98,90,95,99,88,75,75,86,100,100,80,50,50,83,0,0,90,33,33,75,85,90,75,85,90,80,90,95,80,90,95,80,90,95,65,65,65,65,65,65,
  65,65,65,65,65,65,60,65,65,60,65,65,60,65,65,60,65,65,60,65,65,40,40,40,45,40,40,50,40,35,55,40,35,60,40,35,75,75,75,15,20,26,15,20,26,15,20,26,
  90,90,95,100,100,100,90,90,90,90,90,90,90,90,90,70,75,80,70,75,80,70,70,70,70,70,70,70,70,70,90,95,97,90,95,97,35,65,85,35,65,85,35,65,85,35,65,85,
  35,65,85,35,65,85,35,65,85,90,90,90,90,90,90,20,22,25,20,22,25,90,100,100,90,100,100,90,100,100,90,93,95,90,93,95,90,90,90,90,90,90,90,90,90,70,70,75,
  70,70,75,70,70,75,75,80,80,75,80,80,75,80,80,75,85,90,75,85,90,75,85,90,99,99,99,99,99,99,33,33,33,33,33,33,90,90,90,90,90,90,90,94,96,90,94,96,
  100,100,100,100,100,100,100,100,100,20,20,20,20,20,20,20,20,20,40,45,45,40,45,45,40,45,45,33,33,33,33,33,33,85,85,85,85,85,85,85,85,85,85,85,85,85,90,95,
  85,90,95,40,40,40,40,40,40,16,19,22,16,19,22,80,85,90,80,85,90,55,55,55,90,93,95,150,200,200,70,75,80,70,75,80,70,75,80,75,85,90,60,75,90,60,75,90,
  0,0,0,0,0,0,100,100,100,100,100,100,80,60,60,80,60,60,90,90,90,85,85,85,85,85,85,85,85,85,70,80,85,90,95,100,90,95,100,6,7,8,6,7,8,25,25,25,
  15,20,25,0,0,0,45,50,50,30,35,35,5,5,6,0,0,0,100,100,100,3,3,3,60,75,90,6,7,8,0,0,0,60,60,60,55,55,55,75,85,90,90,94,96,90,93,95,
  90,90,90,99,99,99,70,75,80,70,70,70,250,250,250,99,99,99,90,95,99,35,65,85,35,65,85,35,65,85,35,65,85,85,85,85,90,100,100,70,70,75,
])

/**
 * Returns 1.13c `MonStats.txt` `aip1` (`0`), `aip1(N)` (`1`), or `aip1(H)` (`2`) for `classId`.
 */
export function getMonStatsAip1_113c(
  classId: number,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
): number {
  const hcIdx = Math.trunc(classId)
  if (hcIdx < 0 || hcIdx * 3 >= MONSTATS_AIP1_FLAT_113C.length) return 0
  const diffIdx = normalizeDifficultyIndex(difficulty)
  return MONSTATS_AIP1_FLAT_113C[hcIdx * 3 + diffIdx] ?? 0
}

/**
 * 1.13c `D2Client.dll` `0x6facffc0` (`MonUMod` #33 `suicideminion` event-2 handler, Issue #1218):
 * Reads `edi = MonStats.bin[classId].wAiParam[0][difficulty]` (`aip1`, `aip1(N)`, `aip1(H)`):
 * - `edi === 1` -> `0x1ab` (`427` `'suicidefireexplode'`, `Range = 13`)
 * - `edi >= 2`  -> `0x1ac` (`428` `'suicideiceexplode'`, `Range = 13`)
 * - otherwise   -> `0x1aa` (`426` `'suicidecorpseexplode'`, `Range = 13`)
 */
export function resolveSuicideExplodeMissileKey(
  classId: number,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
  aip1Override?: number,
): 'suicidecorpseexplode' | 'suicidefireexplode' | 'suicideiceexplode' {
  const aip1 =
    aip1Override !== undefined
      ? Math.trunc(aip1Override)
      : getMonStatsAip1_113c(classId, difficulty)
  if (aip1 === 1) return 'suicidefireexplode'
  if (aip1 >= 2) return 'suicideiceexplode'
  return 'suicidecorpseexplode'
}

export function isFireTowerMonster(classId: number, monType?: string): boolean {
  if (classId === 372 || classId === 435) return true
  if (monType) {
    const clean = monType.trim().toLowerCase()
    if (clean === 'firetower' || clean === 'barricadetower') return true
  }
  return false
}

export function isBaalCloneMonster(classId: number, monType?: string): boolean {
  if (classId === 570) return true
  if (monType && monType.trim().toLowerCase() === 'baalclone') return true
  return false
}

export function isDurielMonster(classId: number, monType?: string): boolean {
  if (classId === 211 || classId === 708) return true
  if (monType) {
    const clean = monType.trim().toLowerCase()
    if (clean === 'duriel' || clean === 'uberduriel') return true
  }
  return false
}

export function isMaggotSmallMonster(classId: number, monType?: string): boolean {
  if (classId === 227) return true
  if (monType && monType.trim().toLowerCase() === 'maggot') return true
  return false
}

/**
 * 5-maggot (`hcIdx=227`, `Code=MA`) spawn offsets around Duriel's corpse (`MonUMod` #11 `durieldead`).
 */
export const DURIEL_MAGGOT_HCIDX = 227
export const DURIEL_MAGGOT_OFFSETS: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: -1.5, dy: -1.0 },
  { dx: 1.5, dy: -1.0 },
  { dx: -1.5, dy: 1.0 },
  { dx: 1.5, dy: 1.0 },
  { dx: 0.0, dy: 1.6 },
] as const

/**
 * Resolves innate `Overlay.txt` tokens attached to a monster upon entering `MONMODE_DEATH` (`DT`).
 */
export function getInnateMonsterDeathOverlays(
  classId: number,
  monType?: string,
): readonly string[] {
  const clean = monType?.trim().toLowerCase() ?? ''
  if (isDurielMonster(classId, clean)) {
    return ['durieldead_fwd', 'durieldead_rear']
  }
  if (isBoneFetishMonster(classId, clean)) {
    return ['fetishdeath1', 'fetishdeath2']
  }
  if (isSuicideMinionMonster(classId, clean)) {
    return ['suicide_death']
  }
  if ((classId >= 238 && classId <= 241) || classId === 673 || classId === 674 || clean.startsWith('cantor')) {
    return ['zakarumpriest_death']
  }
  if ((classId >= 127 && classId <= 130) || classId === 609 || clean.startsWith('thornhulk')) {
    return ['thornedhulk_death']
  }
  if ((classId >= 247 && classId <= 249) || clean.startsWith('frogdemon')) {
    return ['frogdemon_death']
  }
  if ((classId >= 304 && classId <= 306) || classId === 692 || classId === 693 || clean.startsWith('fingermage')) {
    return ['fingermagespiderexplode']
  }
  if (
    (classId >= 118 && classId <= 121) ||
    (classId >= 639 && classId <= 641) ||
    classId === 733 ||
    clean.startsWith('willowisp')
  ) {
    return ['willowispdeath']
  }
  if (
    (classId >= 360 && classId <= 362) ||
    classId === 558 ||
    classId === 686 ||
    classId === 687 ||
    classId === 712 ||
    clean.startsWith('megademon') ||
    clean === 'venomlord'
  ) {
    return ['megademondeath']
  }
  if ((classId >= 101 && classId <= 105) || (classId >= 667 && classId <= 670) || clean.startsWith('unraveler')) {
    return ['undeadhorrordeath']
  }
  if ((classId >= 441 && classId <= 445) || clean.startsWith('siegebeast')) {
    return ['siege_beast_dust']
  }
  if (classId === 497 || clean === 'catapult1') {
    return ['catapult_death_s']
  }
  if ((classId >= 498 && classId <= 500) || (clean.startsWith('catapult') && clean !== 'catapult1')) {
    return ['catapult_death_e']
  }
  if (
    (classId >= 469 && classId <= 478) ||
    (classId >= 634 && classId <= 638) ||
    classId === 719 ||
    classId === 720 ||
    clean.startsWith('succubus')
  ) {
    return ['succubae_death']
  }
  return []
}

/**
 * Resolves the 1.13c freeze-shatter missile keys (`icebreaksmall` #272 vs `icebreaklarge` #274 + `icebreaksmoke` #275)
 * based on `MonStats2.txt` `LARGE` flag (`MONSTATS2_FLAGINDEX.LARGE`).
 */
export function getFreezeShatterMissiles(
  classId: number,
  sizeX?: number,
): readonly [string, 'icebreaksmoke'] {
  const isLarge =
    hasMonStats2Flag(classId, MONSTATS2_FLAGINDEX.LARGE) || (sizeX !== undefined && sizeX >= 2)
  return [isLarge ? 'icebreaklarge' : 'icebreaksmall', 'icebreaksmoke']
}

/**
 * 1.13c `States.txt` rows with `shatter = 1`: `freeze` (#1), `shatter` (#107, Holy Freeze 20% roll) and
 * `uberminion` (#184). A monster that dies while carrying any of them shatters into ice (no corpse).
 */
export const SHATTER_STATES_113C: ReadonlySet<number> = new Set([1, 107, 184])

/** True when the unit carries a `States.txt` `shatter = 1` state (#1 / #107 / #184). */
export function hasShatterState113c(states: ReadonlySet<number> | Iterable<number> | undefined): boolean {
  if (!states) return false
  for (const s of states) {
    if (SHATTER_STATES_113C.has(s)) return true
  }
  return false
}

/**
 * 1.13c `D2Client.dll` `MissCltHitFunc[31]` (0x6FB605B0), the `pCltHitFunc = 31` rows `icebreaksmall` (#272),
 * `icebreakmedium` (#273), `icebreaklarge` (#274) and `catapult cold explosion` (#417).
 *
 * `classId - 0x110` indexes the byte table at 0x6FB606A0 into the jump table at 0x6FB60694:
 * `272 -> 0x158 icebreaksmallmelt` (#344), `273 / 274 / 417 -> 0x159 icebreaklargemelt` (#345), every other id
 * creates nothing. The handler returns 0 without a melt when it is called for a unit hit (`edx != 0`); otherwise the
 * melt is created at the missile's position with the missile's direction.
 */
export const ICEBREAK_MELT_BY_MISSILE_ID_113C: Readonly<Record<number, 'icebreaksmallmelt' | 'icebreaklargemelt'>> =
  Object.freeze({
    272: 'icebreaksmallmelt',
    273: 'icebreaklargemelt',
    274: 'icebreaklargemelt',
    417: 'icebreaklargemelt',
  })

/** Resolves the CltHit31 melt missile for a Missiles.txt id, or `undefined` when the switch creates none. */
export function getIcebreakMeltMissile113c(
  missileId: number,
): 'icebreaksmallmelt' | 'icebreaklargemelt' | undefined {
  return ICEBREAK_MELT_BY_MISSILE_ID_113C[missileId]
}

/**
 * Boss Death Sequence & Minion Purge specification (`QuestsFX.cpp` & `Missiles.txt`).
 *
 * The client show is the D2Client MonUMod 22 `questcomplete` event-1 handler 0x6fad0fb0, a class switch (byte table
 * 0x6fad1140 + jump table 0x6fad1124, mode 0 unless noted) that only knows: 45 -> 0x6fb02860, 156 Andariel ->
 * 0x6fb02230, 211 Duriel -> 0x6fb02620, 229 Radament -> 0x6fb027a0, 242 Mephisto -> 0x6fb02270, 243 Diablo ->
 * 0x6fb02600, 256 Izual -> 0x6fb03070, 267 Blood Raven -> 0x6fb02320, 284 (mode 14) -> 0x6fb026e0, 366 compelling
 * orb -> 0x6fb030d0, 479 overseer1 -> 0x6fb02bd0, 540..542 -> 0x6fb029f0, 544 -> 0x6fb02570. The Uber bosses
 * (704..709), the Diablo clone (333) and the Summoner (250) are not in it and have no client death show (#1204,
 * #1206). Nihlathak's `nehlithakcontrol` is created by 0x6fb02af0, not by this switch.
 *
 * The controller's lifetime is its Missiles.txt `Range` (+ LevRange): the handlers pass a zeroed 0x5c-byte create
 * record to 0x6fb630f0 with only flags / owner / source / missile / level, and #10637 / #10019 write the missile's
 * TargetX / TargetY, not its range (#1207).
 */
export interface BossDeathFxSpec {
  readonly bossKey:
    | 'countess'
    | 'andariel'
    | 'duriel'
    | 'bloodraven'
    | 'radament'
    | 'coldworm'
    | 'mephisto'
    | 'izual'
    | 'diablo'
    | 'shenk'
    | 'nihlathak'
    | 'ancient'
    | 'baal'
  /**
   * The Missiles.txt row the death handler creates, or `null` when the handler creates no missile (Diablo's
   * 0x6fb02600 only stores the unit id in 0x6fba2134 for the UI text timer read at 0x6fb02db4, #1205).
   */
  readonly controllerMissileKey: string | null
  readonly controllerMissile: string | null
  /** Missiles.txt `Id` of `controllerMissileKey` (`null` with it). */
  readonly controllerClassId: number | null
  /**
   * The show is the D2Client MonUMod 22 `questcomplete` event-1 handler 0x6fad0fb0 (class switch, mode 0 only): it
   * only runs for a monster carrying umod 22 (the SuperUnique spawner 0x6fc451f0 / 0x6fc45730 appends it).
   */
  readonly requiresQuestCompleteUMod?: boolean | undefined
  readonly shakeAmplitude: number
  readonly shakeDurationMs: number
  readonly purgeSurroundingMonstersRadius: number
  /** Screen shake parameters (`sustainMs`, `amplitude`, `rampUpMs`, `rampDownMs`). */
  readonly screenShake?: {
    readonly sustainMs: number
    readonly amplitude: number
    readonly rampUpMs?: number
    readonly rampDownMs?: number
  }
  /** `QUESTSFX_MainHandler` surrounding monster purge parameters (`radiusSubTiles`, `minDelayFrames`, `maxDelayFrames`). */
  readonly minionPurge?: {
    readonly radiusSubTiles: number
    readonly minDelayFrames: number
    readonly maxDelayFrames: number
  }
  /** Optional post-death maggot spawn offsets (e.g. Duriel `hcIdx=211` -> `DURIEL_MAGGOT_OFFSETS`). */
  readonly spawnMaggots?: typeof DURIEL_MAGGOT_OFFSETS | undefined
}

function buildBossDeathSpec(
  base: Omit<
    BossDeathFxSpec,
    'controllerMissile' | 'shakeAmplitude' | 'shakeDurationMs' | 'purgeSurroundingMonstersRadius'
  >,
): BossDeathFxSpec {
  return {
    ...base,
    controllerMissile: base.controllerMissileKey,
    shakeAmplitude: base.screenShake?.amplitude ?? 0,
    shakeDurationMs: base.screenShake?.sustainMs ?? 0,
    purgeSurroundingMonstersRadius: base.minionPurge?.radiusSubTiles ?? 0,
  }
}

export function getBossDeathFxSpec(
  classId: number | string,
  monType?: string,
): BossDeathFxSpec | null {
  const numId =
    typeof classId === 'number'
      ? classId
      : classId.trim() !== '' && Number.isFinite(Number(classId))
        ? Number(classId)
        : -1
  const clean = (monType ?? (typeof classId === 'string' ? classId : ''))
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (numId === 45 || clean === 'corruptrogue3' || clean === 'countess' || clean === 'thecountess') {
    // 0x6fad0fb0 (umod 22, mode 0) -> 0x6fb02860: towermist (#291, Range 400) + towerchestspawner (#332, Range 400).
    return buildBossDeathSpec({
      bossKey: 'countess',
      controllerMissileKey: 'towermist',
      controllerClassId: 291,
      requiresQuestCompleteUMod: true,
    })
  }
  if (numId === 156 || clean === 'andariel') {
    // 0x6fad0fb0 -> 0x6fb02230: andycontrol0 (#307, Range 350).
    return buildBossDeathSpec({
      bossKey: 'andariel',
      controllerMissileKey: 'andycontrol0',
      controllerClassId: 307,
      screenShake: {
        sustainMs: 350 * 40,
        amplitude: 8,
        rampUpMs: 200,
        rampDownMs: 800,
      },
      minionPurge: {
        radiusSubTiles: 35,
        minDelayFrames: 1,
        maxDelayFrames: 51,
      },
    })
  }
  if (numId === 211 || clean === 'duriel') {
    // 0x6fad0fb0 -> 0x6fb02620: durieldeathcontrol (#363, Range 400).
    return buildBossDeathSpec({
      bossKey: 'duriel',
      controllerMissileKey: 'durieldeathcontrol',
      controllerClassId: 363,
      screenShake: {
        sustainMs: 160 * 40,
        amplitude: 6,
        rampUpMs: 120,
        rampDownMs: 600,
      },
      spawnMaggots: DURIEL_MAGGOT_OFFSETS,
    })
  }
  if (numId === 267 || numId === 2 || clean === 'bloodraven') {
    // 0x6fad0fb0 (umod 22, mode 0) -> 0x6fb02320; Missiles.txt brdeathcontrol (#284) Range = 375.
    return buildBossDeathSpec({
      bossKey: 'bloodraven',
      controllerMissileKey: 'brdeathcontrol',
      controllerClassId: 284,
      requiresQuestCompleteUMod: true,
      minionPurge: {
        radiusSubTiles: 35,
        minDelayFrames: 25,
        maxDelayFrames: 125,
      },
    })
  }
  if (numId === 229 || clean === 'radament') {
    // 0x6fad0fb0 -> 0x6fb027a0: radamentdeath (#347, Range 400).
    return buildBossDeathSpec({
      bossKey: 'radament',
      controllerMissileKey: 'radamentdeath',
      controllerClassId: 347,
      minionPurge: {
        radiusSubTiles: 35,
        minDelayFrames: 1,
        maxDelayFrames: 35,
      },
    })
  }
  if (numId === 284 || clean === 'maggotqueen1' || clean === 'coldworm' || clean === 'coldwormtheburrower') {
    // 0x6fad0fb0 (mode 14) -> 0x6fb026e0: queendeathcenter (#353, Range 100).
    return buildBossDeathSpec({
      bossKey: 'coldworm',
      controllerMissileKey: 'queendeathcenter',
      controllerClassId: 353,
    })
  }
  if (numId === 242 || clean === 'mephisto') {
    // 0x6fad0fb0 -> 0x6fb02270: mephistodeathcontrol (#299, Range 275) + TargetX/Y 75, mephistoholedelay (#358),
    // mephistodonotdraw (#306); see boss-death-cltdo-113c.ts (#1208).
    return buildBossDeathSpec({
      bossKey: 'mephisto',
      controllerMissileKey: 'mephistodeathcontrol',
      controllerClassId: 299,
      screenShake: {
        sustainMs: 100 * 40,
        amplitude: 5,
        rampUpMs: 120,
        rampDownMs: 400,
      },
    })
  }
  if (numId === 256 || clean === 'izual') {
    // 0x6fad0fb0 -> 0x6fb03070: izual control (#379, Range 200).
    return buildBossDeathSpec({
      bossKey: 'izual',
      controllerMissileKey: 'izual control',
      controllerClassId: 379,
      minionPurge: {
        radiusSubTiles: 105,
        minDelayFrames: 1,
        maxDelayFrames: 2,
      },
    })
  }
  if (numId === 243 || clean === 'diablo') {
    // 0x6fad0fb0 -> 0x6fb02600 creates no missile (#1205): no diabwallmaker ring, no controller.
    return buildBossDeathSpec({
      bossKey: 'diablo',
      controllerMissileKey: null,
      controllerClassId: null,
      screenShake: {
        sustainMs: 120 * 40,
        amplitude: 8,
        rampUpMs: 160,
        rampDownMs: 600,
      },
      minionPurge: {
        radiusSubTiles: 45,
        minDelayFrames: 1,
        maxDelayFrames: 50,
      },
    })
  }
  if (numId === 479 || numId === 706 || clean === 'overseer1' || clean === 'shenk' || clean === 'shenktheoverseer') {
    // 0x6fad0fb0 (umod 22, mode 0) -> 0x6fb02bd0; Missiles.txt overseercontrol (#602) Range = 500. Only Shenk (a
    // SuperUnique, so umod 22) has the show; a plain overseer1 dies without it (Issue #1042).
    return buildBossDeathSpec({
      bossKey: 'shenk',
      controllerMissileKey: 'overseercontrol',
      controllerClassId: 602,
      requiresQuestCompleteUMod: true,
      screenShake: {
        sustainMs: 240 * 40,
        amplitude: 5,
        rampUpMs: 200,
        rampDownMs: 800,
      },
      minionPurge: {
        radiusSubTiles: 35,
        minDelayFrames: 25,
        maxDelayFrames: 125,
      },
    })
  }
  if (numId === 526 || clean === 'nihlathakboss' || clean === 'nihlathak') {
    // nehlithakcontrol (#606, Range 224).
    return buildBossDeathSpec({
      bossKey: 'nihlathak',
      controllerMissileKey: 'nehlithakcontrol',
      controllerClassId: 606,
      screenShake: {
        sustainMs: 120 * 40,
        amplitude: 6,
        rampUpMs: 120,
        rampDownMs: 400,
      },
    })
  }
  if (
    (numId >= 540 && numId <= 542) ||
    clean.startsWith('ancientbarb') ||
    clean === 'talic' ||
    clean === 'madawc' ||
    clean === 'korlic' ||
    clean === 'ancient'
  ) {
    // 0x6fad0fb0 -> 0x6fb029f0: ancient death center (#541, Range 400).
    return buildBossDeathSpec({
      bossKey: 'ancient',
      controllerMissileKey: 'ancient death center',
      controllerClassId: 541,
    })
  }
  if (numId === 544 || clean === 'baalcrab' || clean === 'baal') {
    // 0x6fad0fb0 -> 0x6fb02570: baalfx control (#625, Range 650).
    return buildBossDeathSpec({
      bossKey: 'baal',
      controllerMissileKey: 'baalfx control',
      controllerClassId: 625,
      screenShake: {
        sustainMs: 139 * 40,
        amplitude: 7,
        rampUpMs: 160,
        rampDownMs: 600,
      },
    })
  }
  return null
}
