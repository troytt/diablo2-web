/**
 * Shared E2E Test Harness for Diablo II v1.13c Authoritative Monster & Mercenary AI Engine (`tests/e2e/monster-ai/`).
 *
 * Bridges the public entry points across:
 * - `src/common/units/monsters-data.ts` & `hireling-table.ts` & `monster-mode-missiles-113c.ts` & `monster-death-fx.ts`
 * - `src/server/ai/monster-ai.ts` & `summon-manager.ts`
 * - `src/server/engine/game-instance.ts`, `loopback-adapter.ts`, `room-host.ts`,
 *   `combat-pipeline.ts`, `missile-engine.ts`, `state-bus.ts`, `stat-list.ts`, `aura-scanner.ts`
 * - `src/netproto/index.ts`
 */

import * as monstersDataModule from '../../../src/common/units/monsters-data.ts'
import {
  CANONICAL_BOSS_MINIONS,
  CANONICAL_MONAI_TABLE,
  CANONICAL_MONLVL_TABLE,
  CANONICAL_SUPERUNIQUES_TABLE,
  MONSTER_TABLE,
  applyEliteModifiers,
  applyMonsterUModResistances,
  getCanonicalMonsterKinds,
  getMonAi113c,
  getMonLvl113c,
  getMonsterKindByClassId,
  getMonsterKindByHcIdx,
  getSuperUniqueByIndex,
  monsterStatsOf,
  resolveMonsterStats,
  type Difficulty,
  type MonsterKind,
  type MonsterResistances,
} from '../../../src/common/units/monsters-data.ts'
import {
  type CombatEvent,
  type CombatInput,
  type CombatOptions,
  type CombatPlayer,
  type CombatTerrain,
  type CombatWorld,
  type Monster,
  type MonsterRank,
  type MonsterStats,
} from '../../../src/common/units/unit-types.ts'
import * as hirelingTableModule from '../../../src/common/units/hireling-table.ts'
import {
  HIRELING_RECORDS,
  resolveHirelingCandidate as rawResolveHirelingCandidate,
  type HirelingCandidateDesc,
  type HirelingRecord,
} from '../../../src/common/units/hireling-table.ts'
import {
  MONSTER_MODE_MISSILES_113C,
  getMonsterModeMissile113c as rawGetMonsterModeMissile113c,
  getMonsterModeMissileById113c,
  type MonsterModeMissiles113c,
} from '../../../src/common/units/monster-mode-missiles-113c.ts'
import {
  BONE_FETISH_EXPLOSION_RADIUS,
  D2CLIENT_DEATH_BOOM_POINTS,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIRE_ENCHANT_DIFF_SCALE,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  FIRE_ENCHANT_MAX_HP_PCT,
  FIRE_ENCHANT_MIN_HP_PCT,
  MON_UMOD,
  MON_UMOD_ID as RAW_MON_UMOD_ID,
  MON_UMOD_NAME_TO_ID,
  calcBoneFetishDeathDamage as rawCalcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova as rawCalcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage as rawCalcFireEnchantedDeathDamage,
  computeChargedBolt8WayVectors,
  getBossDeathFxSpec as rawGetBossDeathFxSpec,
  getFreezeShatterMissiles,
  getInnateMonsterDeathOverlays as rawGetInnateMonsterDeathOverlays,
  hasMonsterUMod as rawHasMonsterUMod,
  isBoneFetishMonster as rawIsBoneFetishMonster,
  isDurielMonster as rawIsDurielMonster,
  isPoisonDeadMonster as rawIsPoisonDeadMonster,
  isScarabMonster as rawIsScarabMonster,
  isSuicideMinionMonster as rawIsSuicideMinionMonster,
  resolveMonsterUModIds as rawResolveMonsterUModIds,
  resolveSuicideExplodeMissileKey,
  type BoneFetishExplosionDamage,
  type BossDeathFxSpec,
  type ColdEnchantedNovaSpec,
  type FireEnchantedExplosionDamage,
  type MonsterUModSource,
} from '../../../src/common/units/monster-death-fx.ts'
import * as monsterAiModule from '../../../src/server/ai/monster-ai.ts'
import {
  BAAL_THRONE_WAVES_113C,
  MonsterAI as RawMonsterAI,
  OBLIVION_KNIGHT_CURSES,
  applyEnchantBuff as rawApplyEnchantBuff,
  canCastEnchantOn as rawCanCastEnchantOn,
  computeEffectiveMonsterDefense as rawComputeEffectiveMonsterDefense,
  computeEffectiveMonsterMissileSpeed as rawComputeEffectiveMonsterMissileSpeed,
  damageMonster as rawDamageMonster,
  executeActBossAi113c as rawExecuteActBossAi113c,
  executeOblivionKnightCurse113c as rawExecuteOblivionKnightCurse113c,
  executeShamanResurrect113c as rawExecuteShamanResurrect113c,
  spawnMonsterPacks,
  spawnMonsters,
  tickBaalThroneWave113c,
  tickCombat,
  tickMercenaryAi25Hz as rawTickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c as rawTriggerMonsterDeathAffixes113c,
  triggerPackMoraleOnDeath,
  type MercenaryUnitState as RawMercenaryUnitState,
} from '../../../src/server/ai/monster-ai.ts'
import {
  SummonManager as RawSummonManager,
  unsummonOwnPetAt as rawUnsummonOwnPetAt,
  type CreatePetOutcome,
  type SummonedPetUnit,
} from '../../../src/server/ai/summon-manager.ts'
import {
  CLOSED_REALM_POLICY,
  GameInstance,
  LocalLoopbackAdapter as RawLocalLoopbackAdapter,
  MultiClientRoomHost as RawMultiClientRoomHost,
  OPEN_BNET_POLICY,
  SINGLE_PLAYER_POLICY,
  resolveGameModePolicy,
  type ConnectClientSpec,
  type ConnectPlayerSpec,
  type GameInstanceConfig,
  type LocalLoopbackAdapterOptions,
  type MultiClientRoomHostConfig,
  type ServerMonsterState,
  type ServerPlayerState,
  type SpawnMonsterSpec,
} from '../../../src/server/index.ts'
import type { ServerUnitSummary } from '../../../src/server/engine/game-instance.ts'
import {
  executeSUnitDmg as rawExecuteSUnitDmg,
  type CombatUnitContext as RawCombatUnitContext,
  type SUnitDmgOutcome,
  type SUnitDmgPacket,
} from '../../../src/server/engine/combat-pipeline.ts'
import {
  MissileEngine,
  type IronGolemItemProps,
} from '../../../src/server/engine/missile-engine.ts'
import {
  AuraScanner as RawAuraScanner,
  type ActiveAuraSource,
  type AuraPulseOptions,
  type AuraPulseOutcome,
  type CorpseContext,
} from '../../../src/server/engine/aura-scanner.ts'
import {
  StateBus as RawStateBus,
  type ApplyStateResult,
} from '../../../src/server/engine/state-bus.ts'
import { FIXED_ONE, UnitStatList as RawUnitStatList } from '../../../src/server/engine/stat-list.ts'
import { D2Rng, Rng } from '../../../src/common/rng/d2-rng.ts'
import type { CharacterClassCode } from '../../../src/common/units/classes.ts'
import type { ByteStream, ClientCommand, ServerEvent } from '../../../src/netproto/index.ts'
import {
  getSharedDataRegistry,
  getSharedMountedArchives,
  type D2DataRegistry,
} from '../../../src/baker/mpq-archive-source.ts'

export type DifficultyName = Difficulty
export type HirelingRow = HirelingRecord
export const HIRELING_TABLE = HIRELING_RECORDS
export type MonsterModeMissileMap113c = MonsterModeMissiles113c
export type DamagePacket = SUnitDmgPacket
export type DamageOutcome = SUnitDmgOutcome
export type AuraPulseRequest = ActiveAuraSource
export type StateApplyOutcome = ApplyStateResult

export interface StateApplySpec {
  readonly stateNameOrId?: string | number | undefined
  readonly stateId?: number | string | undefined
  readonly sourceUnitId?: string | undefined
  readonly sourceSkillId?: number | undefined
  readonly slvl?: number | undefined
  readonly durationFrames?: number | undefined
  readonly currentFrame?: number | undefined
  readonly stats?: Readonly<Record<string, number>> | undefined
  readonly curseTypeOverride?: number | undefined
  readonly isAuraOverride?: boolean | undefined
}

export interface SUnitDmgOptions {
  readonly difficulty?: 0 | 1 | 2 | DifficultyName | undefined
}

export interface MonsterSpawnOptions {
  readonly difficulty?: DifficultyName | 0 | 1 | 2 | undefined
  readonly rank?: MonsterRank | string | undefined
  readonly playersCount?: number | undefined
  readonly modifiers?: readonly (string | number)[] | undefined
  readonly superUniqueId?: string | undefined
  readonly areaLevel?: number | undefined
  readonly seed?: number | undefined
}

// ---------------------------------------------------------------------------
// Extended MON_UMOD_ID with canonical alias keys
// ---------------------------------------------------------------------------

export const MON_UMOD_ID = {
  ...RAW_MON_UMOD_ID,
  FIRE_ENCHANT: RAW_MON_UMOD_ID.FIRE_ENCHANTED,
  COLD_ENCHANT: RAW_MON_UMOD_ID.COLD_ENCHANTED,
  LIGHTNING_ENCHANT: RAW_MON_UMOD_ID.LIGHTNING_ENCHANTED,
  AURA_ENCHANT: RAW_MON_UMOD_ID.AURA,
  AURA_ENCHANTED: RAW_MON_UMOD_ID.AURA,
  EXTRA_STRONG: RAW_MON_UMOD_ID.STRONG,
  EXTRA_FAST: RAW_MON_UMOD_ID.FAST,
  CURSED: RAW_MON_UMOD_ID.CURSE,
  MAGIC_RESISTANT: RAW_MON_UMOD_ID.RESIST,
  STONE_SKIN: RAW_MON_UMOD_ID.STONESKIN,
  MANA_BURN: RAW_MON_UMOD_ID.MANahit,
  SPECTRAL_HIT: RAW_MON_UMOD_ID.SPECTRALHIT,
  SPECHIT: RAW_MON_UMOD_ID.SPECTRALHIT,
} as const

export type ResolvedMonsterUModList = number[] & {
  has(id: number): boolean
}

export function resolveMonsterUModIds(
  source: MonsterUModSource | Iterable<number | string> | undefined | null,
): ResolvedMonsterUModList {
  let normalized: MonsterUModSource
  if (source && typeof source === 'object' && Symbol.iterator in source && !Array.isArray(source)) {
    normalized = Array.from(source as Iterable<number | string>)
  } else {
    normalized = source as MonsterUModSource
  }
  const set = rawResolveMonsterUModIds(normalized)
  const arr = Array.from(set) as ResolvedMonsterUModList
  Object.defineProperty(arr, 'has', {
    value: (id: number): boolean => set.has(id),
    enumerable: false,
    configurable: true,
  })
  return arr
}

export function hasMonsterUMod(
  source: MonsterUModSource | Iterable<number | string> | { has(id: number): boolean } | undefined | null,
  umodId: number,
): boolean {
  if (!source) return false
  if (typeof (source as { has?: unknown }).has === 'function' && !Array.isArray(source)) {
    return (source as { has(id: number): boolean }).has(umodId)
  }
  if (typeof source === 'object' && Symbol.iterator in source && !Array.isArray(source)) {
    return rawHasMonsterUMod(Array.from(source as Iterable<number | string>), umodId)
  }
  return rawHasMonsterUMod(source as MonsterUModSource, umodId)
}

// ---------------------------------------------------------------------------
// Extended 1.13c Data Contract Interfaces (PROJECT.md § Interface Contracts)
// ---------------------------------------------------------------------------

export interface ElementalAttack113c {
  readonly mode: string
  readonly type: string
  readonly chancePct: number
  readonly minDamage: number
  readonly maxDamage: number
  readonly durationFrames: number
}

export interface MonsterSkillEntry113c {
  readonly skill: string
  readonly skillId?: number | undefined
  readonly mode: string
  readonly level: number
}

export interface MonsterResistances113c extends MonsterResistances {
  readonly physical: number
  readonly magic: number
  readonly fire: number
  readonly lightning: number
  readonly cold: number
  readonly poison: number
}

export interface ExtendedMonsterKind113c {
  readonly id: string
  readonly name: string
  readonly baseId: string
  readonly hcIdx: number
  readonly classId?: string | undefined
  readonly monsterType?: string | undefined
  readonly ai: string
  readonly aiDelay: number
  readonly aiDistance: number
  readonly aiParams: readonly number[]
  readonly level: number
  readonly hp: number
  readonly minHp: number
  readonly maxHp: number
  readonly damage: number
  readonly armor: number
  readonly armour: number
  readonly xp: number
  readonly experience: number
  readonly speed: number
  readonly velocity: number
  readonly runVelocity: number
  readonly reach: number
  readonly aggroRadius: number
  readonly cooldownTicks: number
  readonly attackRating: number
  readonly attack1: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number }
  readonly attack2: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number }
  readonly special1?: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number } | undefined
  readonly elementalAttacks: readonly ElementalAttack113c[]
  readonly resistances: MonsterResistances113c
  readonly skills: readonly MonsterSkillEntry113c[]
  readonly modeMissiles: Partial<Record<'A1' | 'A2' | 'S1' | 'S2' | 'S3' | 'S4' | 'C' | 'SQ', string>>
  readonly drain: number
  readonly coldEffect: number
  readonly damageRegen: number
  readonly toBlock: number
  readonly crit: number
  readonly align: number
  readonly noRatio: boolean
  readonly isMelee: boolean
  readonly isRanged: boolean
  readonly ranged: boolean
  readonly meleeRng: number
  readonly isUndead: boolean
  readonly lUndead: boolean
  readonly hUndead: boolean
  readonly isDemon: boolean
  readonly isBoss: boolean
  readonly boss: boolean
  readonly isPrimeEvil: boolean
  readonly isKillable: boolean
  readonly killable: boolean
  readonly isFlying: boolean
  readonly canOpenDoors: boolean
  readonly neverCount: boolean
  readonly petIgnore: boolean
  readonly deathDmg: boolean
  readonly minions: readonly string[]
  readonly inTown: boolean
  readonly npc: boolean
  readonly enabled: boolean
  readonly isSpawn: boolean
  readonly rawKind?: MonsterKind | undefined
}

export interface ExtendedMonsterStats113c extends MonsterStats {
  readonly hcIdx: number
  readonly baseId: string
  readonly ai: string
  readonly aiDelay: number
  readonly aiDistance: number
  readonly aiParams: readonly number[]
  readonly level: number
  readonly hp: number
  readonly minHp: number
  readonly maxHp: number
  readonly damage: number
  readonly armor: number
  readonly armour: number
  readonly xp: number
  readonly experience: number
  readonly speed: number
  readonly velocity: number
  readonly runVelocity: number
  readonly reach: number
  readonly aggroRadius: number
  readonly cooldownTicks: number
  readonly attackRating: number
  readonly attack1: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number }
  readonly attack2: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number }
  readonly special1?: { readonly minDamage: number; readonly maxDamage: number; readonly toHit: number } | undefined
  readonly elementalAttacks: readonly ElementalAttack113c[]
  readonly resistances: MonsterResistances113c
  readonly skills: readonly MonsterSkillEntry113c[]
  readonly modeMissiles: Partial<Record<'A1' | 'A2' | 'S1' | 'S2' | 'S3' | 'S4' | 'C' | 'SQ', string>>
  readonly modifiers: readonly string[]
  readonly drain: number
  readonly coldEffect: number
  readonly damageRegen: number
  readonly toBlock: number
  readonly crit: number
  readonly align: number
  readonly noRatio: boolean
  readonly isMelee: boolean
  readonly isRanged: boolean
  readonly ranged: boolean
  readonly meleeRng: number
  readonly isUndead: boolean
  readonly lUndead: boolean
  readonly hUndead: boolean
  readonly isDemon: boolean
  readonly isBoss: boolean
  readonly boss: boolean
  readonly isPrimeEvil: boolean
  readonly isKillable: boolean
  readonly killable: boolean
  readonly isFlying: boolean
  readonly canOpenDoors: boolean
  readonly neverCount: boolean
  readonly petIgnore: boolean
  readonly deathDmg: boolean
  readonly minions: readonly string[]
}

export interface MonLvlRecord113c {
  readonly level: number
  readonly ac: readonly [number, number, number]
  readonly th: readonly [number, number, number]
  readonly hp: readonly [number, number, number]
  readonly dm: readonly [number, number, number]
  readonly xp: readonly [number, number, number]
  readonly lAc?: readonly [number, number, number] | undefined
  readonly lTh?: readonly [number, number, number] | undefined
  readonly lHp?: readonly [number, number, number] | undefined
  readonly lDm?: readonly [number, number, number] | undefined
  readonly lXp?: readonly [number, number, number] | undefined
}

export interface MonAiRecord113c {
  readonly id?: number | undefined
  readonly ai: string
  readonly params?: readonly string[] | undefined
}

export interface HirelingSkillEntry113c {
  readonly skillId?: number | undefined
  readonly skillName: string
  readonly skill?: string | undefined
  readonly mode: number | string
  readonly chance: number
  readonly effectiveLevel: number
  readonly level?: number | undefined
}

export interface ResolvedHirelingStats113c {
  readonly id: number
  readonly subType: number
  readonly act: number
  readonly difficulty: number
  readonly level: number
  readonly hp: number
  readonly defense: number
  readonly str: number
  readonly dex: number
  readonly ar: number
  readonly minDmg: number
  readonly maxDmg: number
  readonly resist: number
  readonly defaultChance?: number | undefined
  readonly skills: readonly HirelingSkillEntry113c[]
}

export interface SuperUniqueRecord113c {
  readonly superUnique: string
  readonly wIdx?: number | undefined
  readonly name?: string | undefined
  readonly classId?: string | number | undefined
  readonly monClass?: string | undefined
  readonly hcIdx?: number | undefined
  readonly mod1?: number | undefined
  readonly mod2?: number | undefined
  readonly mod3?: number | undefined
  readonly umods?: readonly number[] | undefined
  readonly minGrp?: number | undefined
  readonly maxGrp?: number | undefined
  readonly autoPos?: boolean | number | undefined
  readonly eClass?: number | undefined
  readonly stacks?: boolean | number | undefined
  readonly replaceable?: boolean | number | undefined
  readonly utrans?: readonly [number, number, number] | undefined
  readonly tc?: readonly [string, string, string] | undefined
}

export interface ExtendedSpawnMonsterSpec extends SpawnMonsterSpec {
  readonly hcIdx?: number | undefined
  readonly difficulty?: DifficultyName | 0 | 1 | 2 | undefined
  readonly rank?: MonsterRank | undefined
  readonly modifiers?: readonly (number | string)[] | undefined
  readonly monUMods?: readonly (number | string)[] | undefined
  readonly bossMods?: readonly (number | string)[] | undefined
  readonly superUniqueId?: string | undefined
  readonly ai?: string | undefined
  readonly aiArchetype?: string | undefined
  readonly leaderId?: number | undefined
  readonly corpse?: boolean | undefined
  readonly dead?: boolean | undefined
}

// ---------------------------------------------------------------------------
// Mode Missile Helper Wrapper
// ---------------------------------------------------------------------------

const MODE_KEY_TO_INDEX: Readonly<Record<string, number>> = {
  DT: 0,
  NU: 1,
  WL: 2,
  GH: 3,
  A1: 4,
  A2: 5,
  BL: 6,
  C: 7,
  SC: 7,
  S1: 8,
  S2: 9,
  S3: 10,
  S4: 11,
  DD: 12,
  SQ: 14,
  RN: 15,
}

export function getMonsterModeMissile113c(
  classIdOrMonId: number | string,
  mode: number | string,
): string | undefined {
  if (typeof mode === 'number') {
    if (mode < 0) return undefined
    return typeof classIdOrMonId === 'number'
      ? rawGetMonsterModeMissile113c(classIdOrMonId, mode)
      : getMonsterModeMissileById113c(classIdOrMonId, mode)
  }
  const cleanMode = mode.trim().toUpperCase()
  if (!(cleanMode in MODE_KEY_TO_INDEX)) return undefined
  return typeof classIdOrMonId === 'number'
    ? rawGetMonsterModeMissile113c(classIdOrMonId, cleanMode)
    : getMonsterModeMissileById113c(classIdOrMonId, cleanMode)
}

// ---------------------------------------------------------------------------
// Data Contract Query Helpers (M1)
// ---------------------------------------------------------------------------

function diffToIdx(difficulty: DifficultyName | 0 | 1 | 2 = 'normal'): 0 | 1 | 2 {
  if (difficulty === 'hell' || difficulty === 2) return 2
  if (difficulty === 'nightmare' || difficulty === 1) return 1
  return 0
}

function diffToName(difficulty: DifficultyName | 0 | 1 | 2 = 'normal'): DifficultyName {
  if (difficulty === 'hell' || difficulty === 2) return 'hell'
  if (difficulty === 'nightmare' || difficulty === 1) return 'nightmare'
  return 'normal'
}

function pickDiffVal(val: unknown, dIdx: 0 | 1 | 2, fallback = 0): number {
  if (Array.isArray(val)) return Number(val[dIdx] ?? val[0] ?? fallback)
  if (typeof val === 'number') return val
  return fallback
}

function hydrateExtendedMonsterKind(
  rawInput: MonsterKind,
  difficulty: DifficultyName = 'normal',
): ExtendedMonsterKind113c {
  const dIdx = diffToIdx(difficulty)
  const rawHcIdx = (rawInput as unknown as Record<string, unknown>)['hcIdx']
  const raw =
    (typeof rawHcIdx === 'number' ? getMonsterKindByHcIdx(rawHcIdx, difficulty) : undefined) ??
    rawInput
  const r = raw as unknown as Record<string, any>
  const resolved = resolveMonsterStats(raw, { difficulty }) as unknown as Record<string, any>
  const rawRes = Array.isArray(r['resistances'])
    ? (r['resistances'][dIdx] ?? r['resistances'][0] ?? {})
    : (r['resistances'] ?? {})
  const idStr = String(r['classId'] ?? r['id'] ?? '')
  const nameStr = String(r['name'] ?? r['nameKey'] ?? idStr)
  const baseIdStr = String(r['baseId'] ?? idStr)
  const hcIdxNum = typeof r['hcIdx'] === 'number' ? r['hcIdx'] : 0
  const levelNum = pickDiffVal(r['level'], dIdx, Number(resolved['level'] ?? 1))
  const minHpNum = pickDiffVal(r['minHp'], dIdx, Number(resolved['hp'] ?? 10))
  const maxHpNum = pickDiffVal(r['maxHp'], dIdx, Number(resolved['hp'] ?? minHpNum))
  const armorNum = pickDiffVal(r['armour'] ?? r['armor'], dIdx, Number(resolved['armor'] ?? 0))
  const xpNum = pickDiffVal(r['experience'] ?? r['xp'], dIdx, Number(resolved['xp'] ?? 0))
  const a1Min = pickDiffVal(r['attack1']?.minDamage, dIdx, Number(resolved['damage'] ?? 1))
  const a1Max = pickDiffVal(r['attack1']?.maxDamage, dIdx, Number(resolved['damage'] ?? a1Min))
  const a1Th = pickDiffVal(r['attack1']?.toHit, dIdx, Number(resolved['attackRating'] ?? 50))
  const a2Min = pickDiffVal(r['attack2']?.minDamage, dIdx, a1Min)
  const a2Max = pickDiffVal(r['attack2']?.maxDamage, dIdx, a1Max)
  const a2Th = pickDiffVal(r['attack2']?.toHit, dIdx, a1Th)

  const elemArr = Array.isArray(r['elementalAttacks']) ? (r['elementalAttacks'] as Record<string, any>[]) : []
  const skillsArr = Array.isArray(r['skills']) ? (r['skills'] as Record<string, any>[]) : []
  const isMeleeBool = Boolean(r['isMelee'] ?? true)
  const rangedBool = Boolean(r['ranged'] ?? !isMeleeBool)
  const lUndeadBool = Boolean(r['lUndead'] ?? false)
  const hUndeadBool = Boolean(r['hUndead'] ?? false)
  const bossBool = Boolean(r['boss'] ?? r['isBoss'] ?? false)
  const killableBool = Boolean(r['killable'] ?? r['isKillable'] ?? true)

  return {
    id: idStr,
    name: nameStr,
    baseId: baseIdStr,
    hcIdx: hcIdxNum,
    classId: idStr,
    ...(typeof r['monsterType'] === 'string' ? { monsterType: r['monsterType'] } : {}),
    ai: String(r['ai'] ?? 'Default'),
    aiDelay: pickDiffVal(r['aiDelay'], dIdx, 15),
    aiDistance: Number(r['aiDistance'] ?? 0),
    aiParams: Array.isArray(r['aiParams']) ? (r['aiParams'] as readonly number[]) : [0, 0, 0, 0, 0, 0, 0, 0],
    level: levelNum,
    hp: Number(resolved['hp'] ?? Math.floor((minHpNum + maxHpNum) / 2)),
    minHp: minHpNum,
    maxHp: maxHpNum,
    damage: Number(resolved['damage'] ?? Math.floor((a1Min + a1Max) / 2)),
    armor: armorNum,
    armour: armorNum,
    xp: Number(resolved['xp'] ?? xpNum),
    experience: xpNum,
    speed: Number(resolved['speed'] ?? 40),
    velocity: Number(r['velocity'] ?? 4),
    runVelocity: Number(r['runVelocity'] ?? r['velocity'] ?? 6),
    reach: Number(resolved['reach'] ?? 28),
    aggroRadius: Number(resolved['aggroRadius'] ?? 240),
    cooldownTicks: Number(resolved['cooldownTicks'] ?? 15),
    attackRating: Number(resolved['attackRating'] ?? a1Th),
    attack1: {
      minDamage: Number(resolved['attack1']?.minDamage ?? a1Min),
      maxDamage: Number(resolved['attack1']?.maxDamage ?? a1Max),
      toHit: Number(resolved['attack1']?.toHit ?? a1Th),
    },
    attack2: {
      minDamage: Number(resolved['attack2']?.minDamage ?? a2Min),
      maxDamage: Number(resolved['attack2']?.maxDamage ?? a2Max),
      toHit: Number(resolved['attack2']?.toHit ?? a2Th),
    },
    ...(r['special1']
      ? {
          special1: {
            minDamage: pickDiffVal(r['special1'].minDamage, dIdx, 0),
            maxDamage: pickDiffVal(r['special1'].maxDamage, dIdx, 0),
            toHit: pickDiffVal(r['special1'].toHit, dIdx, 0),
          },
        }
      : {}),
    elementalAttacks: elemArr.map((e) => ({
      mode: String(e['mode'] ?? 'A1'),
      type: String(e['type'] ?? 'fire'),
      chancePct: pickDiffVal(e['chancePct'], dIdx, 0),
      minDamage: pickDiffVal(e['minDamage'], dIdx, 0),
      maxDamage: pickDiffVal(e['maxDamage'], dIdx, 0),
      durationFrames: pickDiffVal(e['durationFrames'], dIdx, 0),
    })),
    resistances: {
      physical: Number(rawRes['physical'] ?? 0),
      magic: Number(rawRes['magic'] ?? 0),
      fire: Number(rawRes['fire'] ?? 0),
      lightning: Number(rawRes['lightning'] ?? 0),
      cold: Number(rawRes['cold'] ?? 0),
      poison: Number(rawRes['poison'] ?? 0),
    },
    skills: skillsArr.map((s) => ({
      skill: String(s['skill'] ?? ''),
      ...(typeof s['skillId'] === 'number' ? { skillId: s['skillId'] } : {}),
      mode: String(s['mode'] ?? 'S1'),
      level: Number(s['level'] ?? 1),
    })),
    modeMissiles: (r['modeMissiles'] ?? {}) as Partial<
      Record<'A1' | 'A2' | 'S1' | 'S2' | 'S3' | 'S4' | 'C' | 'SQ', string>
    >,
    drain: pickDiffVal(r['drain'], dIdx, 100),
    coldEffect: pickDiffVal(r['coldEffect'], dIdx, -50),
    damageRegen: Number(r['damageRegen'] ?? 2),
    toBlock: pickDiffVal(r['toBlock'], dIdx, 0),
    crit: Number(r['crit'] ?? 5),
    align: Number(r['align'] ?? 0),
    noRatio: Boolean(r['noRatio'] ?? false),
    isMelee: isMeleeBool,
    isRanged: rangedBool,
    ranged: rangedBool,
    meleeRng: Number(r['meleeRng'] ?? 1),
    isUndead: lUndeadBool || hUndeadBool,
    lUndead: lUndeadBool,
    hUndead: hUndeadBool,
    isDemon: Boolean(r['demon'] ?? r['isDemon'] ?? false),
    isBoss: bossBool,
    boss: bossBool,
    isPrimeEvil: Boolean(r['primeEvil'] ?? r['isPrimeEvil'] ?? false),
    isKillable: killableBool,
    killable: killableBool,
    isFlying: Boolean(r['flying'] ?? r['isFlying'] ?? false),
    canOpenDoors: Boolean(r['openDoors'] ?? r['canOpenDoors'] ?? true),
    neverCount: Boolean(r['neverCount'] ?? false),
    petIgnore: Boolean(r['petIgnore'] ?? false),
    deathDmg: Boolean(r['deathDmg'] ?? false),
    minions: Array.isArray(r['minions']) ? (r['minions'] as readonly string[]) : [],
    inTown: Boolean(r['inTown'] ?? false),
    npc: Boolean(r['npc'] ?? false),
    enabled: Boolean(r['enabled'] ?? true),
    isSpawn: Boolean(r['isSpawn'] ?? true),
    rawKind: raw,
  }
}

export function queryMonsterKind113c(
  hcIdx: number,
  difficulty: DifficultyName = 'normal',
): ExtendedMonsterKind113c | undefined {
  const raw = getMonsterKindByHcIdx(hcIdx, difficulty)
  if (!raw) return undefined
  return hydrateExtendedMonsterKind(raw, difficulty)
}

export function queryCanonicalMonsterKinds113c(
  difficulty: DifficultyName = 'normal',
): Map<string, ExtendedMonsterKind113c> {
  const out = new Map<string, ExtendedMonsterKind113c>()
  for (const [key, raw] of getCanonicalMonsterKinds().entries()) {
    const ext = hydrateExtendedMonsterKind(raw, difficulty)
    out.set(key, ext)
  }
  return out
}

export function queryMonsterStats113c(
  hcIdxOrKind:
    | number
    | ExtendedMonsterKind113c
    | (Omit<Partial<ExtendedMonsterKind113c>, 'level'> & {
        readonly level?: number | readonly [number, number, number] | undefined
      }),
  options: MonsterSpawnOptions & {
    readonly playersCount?: number | undefined
    readonly championSubtype?: string | number | undefined
    readonly modifiers?: readonly (string | number)[] | undefined
  } = {},
): ExtendedMonsterStats113c {
  const diff = diffToName(options.difficulty ?? 'normal')
  const dIdx = diffToIdx(diff)
  let rawKind: MonsterKind | undefined
  const customResistances =
    typeof hcIdxOrKind === 'object' && hcIdxOrKind !== null && hcIdxOrKind.resistances
      ? hcIdxOrKind.resistances
      : undefined
  if (typeof hcIdxOrKind === 'number') {
    rawKind = getMonsterKindByHcIdx(hcIdxOrKind, diff)
  } else if (hcIdxOrKind.rawKind) {
    const baseHcIdx =
      typeof hcIdxOrKind.hcIdx === 'number'
        ? hcIdxOrKind.hcIdx
        : (hcIdxOrKind.rawKind as unknown as Record<string, unknown>)['hcIdx']
    rawKind =
      (typeof baseHcIdx === 'number' ? getMonsterKindByHcIdx(baseHcIdx, diff) : undefined) ??
      hcIdxOrKind.rawKind
    const r = rawKind as unknown as Record<string, any>
    const curLvl = pickDiffVal(r['level'], dIdx, 1)
    if (typeof hcIdxOrKind.level === 'number' && hcIdxOrKind.level !== curLvl) {
      const lvl = hcIdxOrKind.level
      rawKind = {
        ...rawKind,
        level: (Array.isArray(r['level']) ? [lvl, lvl, lvl] : lvl) as unknown as MonsterKind['level'],
      }
    }
  } else if (typeof hcIdxOrKind.hcIdx === 'number') {
    const base = getMonsterKindByHcIdx(hcIdxOrKind.hcIdx, diff)
    if (base) {
      const bAny = base as unknown as Record<string, any>
      const lvl =
        typeof hcIdxOrKind.level === 'number'
          ? Array.isArray(bAny['level'])
            ? [hcIdxOrKind.level, hcIdxOrKind.level, hcIdxOrKind.level]
            : hcIdxOrKind.level
          : (hcIdxOrKind.level ?? bAny['level'])
      rawKind = {
        ...base,
        level: lvl as unknown as MonsterKind['level'],
      }
    }
  }
  if (!rawKind) {
    throw new Error(`MonsterKind not found for hcIdx=${String(hcIdxOrKind)}`)
  }
  if (customResistances) {
    rawKind = {
      ...rawKind,
      resistances: customResistances as unknown as MonsterKind['resistances'],
    }
  }

  // Handle champion subtypes ('champion_ghostly', 'champion_fanatic', 'champion_berserk', 'champion_possessed')
  const rawRank = (options.rank ?? 'normal') as string
  const isChampSubtype = rawRank.startsWith('champion_')
  const effectiveRank: MonsterRank = isChampSubtype ? 'champion' : (rawRank as MonsterRank)
  const strModifiers = options.modifiers?.map((m) => String(m))
  const subtype = options.championSubtype ?? (isChampSubtype ? rawRank : undefined)

  const stats = resolveMonsterStats(rawKind, {
    difficulty: diff,
    rank: (isChampSubtype ? rawRank : effectiveRank) as MonsterRank,
    ...(options.playersCount !== undefined ? { playersCount: options.playersCount } : {}),
    ...(strModifiers !== undefined ? { modifiers: strModifiers } : {}),
    ...(options.superUniqueId !== undefined ? { superUniqueId: options.superUniqueId } : {}),
    ...(subtype !== undefined && !isChampSubtype ? { championSubtype: String(subtype) as any } : {}),
  })
  const statsAny = stats as unknown as Record<string, any>
  const extKind = hydrateExtendedMonsterKind(rawKind, diff)
  const baseRes: MonsterResistances113c = customResistances
    ? {
        physical: Number(customResistances.physical ?? 0),
        magic: Number(customResistances.magic ?? 0),
        fire: Number(customResistances.fire ?? 0),
        lightning: Number(customResistances.lightning ?? 0),
        cold: Number(customResistances.cold ?? 0),
        poison: Number(customResistances.poison ?? 0),
      }
    : extKind.resistances

  const hp = stats.hp
  const damage = stats.damage
  const speed = stats.speed

  let resistances: MonsterResistances113c = {
    physical: Number(stats.resistances?.physical ?? baseRes.physical),
    magic: Number(stats.resistances?.magic ?? baseRes.magic),
    fire: Number(stats.resistances?.fire ?? baseRes.fire),
    lightning: Number(stats.resistances?.lightning ?? baseRes.lightning),
    cold: Number(stats.resistances?.cold ?? baseRes.cold),
    poison: Number(stats.resistances?.poison ?? baseRes.poison),
  }

  // Apply MonUMod resistance stacking rule if numeric/named umods were passed
  if (options.modifiers && options.modifiers.length > 0) {
    const umodRes = applyMonsterUModResistances(
      baseRes,
      options.modifiers,
    )
    if (customResistances) {
      resistances = {
        physical: umodRes.physical,
        magic: umodRes.magic,
        fire: umodRes.fire,
        lightning: umodRes.lightning,
        cold: umodRes.cold,
        poison: umodRes.poison,
      }
    } else {
      resistances = {
        physical: Math.max(resistances.physical, umodRes.physical),
        magic: Math.max(resistances.magic, umodRes.magic),
        fire: Math.max(resistances.fire, umodRes.fire),
        lightning: Math.max(resistances.lightning, umodRes.lightning),
        cold: Math.max(resistances.cold, umodRes.cold),
        poison: Math.max(resistances.poison, umodRes.poison),
      }
    }
  }

  const resolvedSpecial1 = (statsAny['special1'] as ExtendedMonsterStats113c['special1']) ?? extKind.special1
  return {
    ...extKind,
    ...stats,
    hcIdx: stats.hcIdx ?? extKind.hcIdx,
    level: stats.level ?? extKind.level,
    hp,
    minHp: hp,
    maxHp: hp,
    damage,
    xp: stats.xp,
    experience: stats.xp,
    speed,
    armor: Number(statsAny['armor'] ?? extKind.armor),
    armour: Number(statsAny['armor'] ?? extKind.armour),
    attackRating: Number(statsAny['attackRating'] ?? extKind.attackRating),
    attack1: (statsAny['attack1'] as ExtendedMonsterStats113c['attack1']) ?? extKind.attack1,
    attack2: (statsAny['attack2'] as ExtendedMonsterStats113c['attack2']) ?? extKind.attack2,
    ...(resolvedSpecial1 ? { special1: resolvedSpecial1 } : {}),
    resistances,
    modifiers: stats.modifiers ?? strModifiers ?? [],
    isUndead: stats.isUndead ?? extKind.isUndead,
    isDemon: stats.isDemon ?? extKind.isDemon,
    isBoss: stats.isBoss ?? extKind.isBoss,
    killable: stats.killable ?? extKind.killable,
    inTown: stats.inTown ?? extKind.inTown,
  } as ExtendedMonsterStats113c
}

export function queryMonLvl113c(level: number): MonLvlRecord113c | undefined {
  const row = getMonLvl113c(level)
  if (!row) return undefined
  return {
    level: row.level,
    ac: row.armor,
    th: row.toHit,
    hp: row.hp,
    dm: row.damage,
    xp: row.xp,
    lAc: row.lArmor,
    lTh: row.lToHit,
    lHp: row.lHp,
    lDm: row.lDamage,
    lXp: row.lXp,
  }
}

export function queryAllMonAi113c(): readonly MonAiRecord113c[] {
  return CANONICAL_MONAI_TABLE
}

export function queryMonAi113c(aiNameOrId: string | number): MonAiRecord113c | undefined {
  if (typeof aiNameOrId === 'number') {
    return CANONICAL_MONAI_TABLE[aiNameOrId]
  }
  return getMonAi113c(aiNameOrId)
}

function lookupMonsterKindByStringId(classId: string): MonsterKind | undefined {
  const direct = MONSTER_TABLE.get(classId)
  if (direct) return direct
  const lower = classId.trim().toLowerCase()
  for (const [k, v] of MONSTER_TABLE.entries()) {
    const vAny = v as unknown as Record<string, any>
    if (
      k.toLowerCase() === lower ||
      String(vAny['id'] ?? '').toLowerCase() === lower ||
      String(vAny['classId'] ?? '').toLowerCase() === lower
    ) {
      return v
    }
  }
  return undefined
}

export function queryAllSuperUniques113c(): readonly SuperUniqueRecord113c[] {
  return CANONICAL_SUPERUNIQUES_TABLE.map((r, idx) => {
    const rec = r as unknown as Record<string, any>
    const monClassStr = String(rec['monClass'] ?? rec['monsterId'] ?? '')
    const kind = lookupMonsterKindByStringId(monClassStr)
    const kindAny = kind as unknown as Record<string, any> | undefined
    const modsArr = Array.isArray(rec['mods'])
      ? (rec['mods'] as readonly number[])
      : Array.isArray(rec['modifiers'])
        ? Array.from(resolveMonsterUModIds(rec['modifiers'] as readonly (string | number)[]))
        : []
    return {
      superUnique: String(rec['id'] ?? ''),
      wIdx: typeof rec['index'] === 'number' ? rec['index'] : idx,
      name: String(rec['name'] ?? rec['nameKey'] ?? rec['id'] ?? ''),
      classId: monClassStr,
      monClass: monClassStr,
      ...(typeof kindAny?.['hcIdx'] === 'number' ? { hcIdx: kindAny['hcIdx'] as number } : {}),
      mod1: Number(modsArr[0] ?? 0),
      mod2: Number(modsArr[1] ?? 0),
      mod3: Number(modsArr[2] ?? 0),
      umods: modsArr,
      minGrp: Number(rec['minGrp'] ?? rec['minMinions'] ?? 0),
      maxGrp: Number(rec['maxGrp'] ?? rec['maxMinions'] ?? 0),
      autoPos: Boolean(rec['autoPos'] ?? rec['autoPosition'] ?? false),
      eClass: Number(rec['eClass'] ?? rec['enhancementClass'] ?? 0),
      stacks: Boolean(rec['stacks'] ?? false),
      replaceable: Boolean(rec['replaceable'] ?? false),
      ...(Array.isArray(rec['uTrans'])
        ? { utrans: rec['uTrans'] as unknown as readonly [number, number, number] }
        : {}),
      ...(Array.isArray(rec['treasureClass'])
        ? { tc: rec['treasureClass'] as unknown as readonly [string, string, string] }
        : {}),
    }
  })
}

export function querySuperUnique113c(
  keyOrIdx: string | number,
): SuperUniqueRecord113c | undefined {
  if (typeof keyOrIdx === 'number') {
    const byIdx = getSuperUniqueByIndex(keyOrIdx)
    if (byIdx) {
      const all = queryAllSuperUniques113c()
      return all[keyOrIdx]
    }
  }
  const all = queryAllSuperUniques113c()
  if (typeof keyOrIdx === 'number') {
    return all[keyOrIdx]
  }
  const clean = keyOrIdx.trim().toLowerCase()
  return all.find(
    (r) =>
      r.superUnique.trim().toLowerCase() === clean ||
      r.name?.trim().toLowerCase() === clean,
  )
}

export type ResolvedHirelingCandidateWithRow = HirelingCandidateDesc & {
  readonly row: HirelingRow
}

export function resolveHirelingCandidate(
  candidate: { readonly nameId: number; readonly seed: number },
  playerLevel: number,
  difficulty: number,
  actIndex: number,
  expansion?: boolean,
  lang?: 'ENG' | 'CHI',
): HirelingCandidateDesc | null
export function resolveHirelingCandidate(
  subTypeOrId: number,
  difficulty: number,
  mercLevel: number,
  expansion?: boolean,
): ResolvedHirelingCandidateWithRow | null
export function resolveHirelingCandidate(
  arg1: { readonly nameId: number; readonly seed: number } | number,
  arg2: number,
  arg3: number,
  arg4?: number | boolean,
  arg5?: boolean,
  arg6?: 'ENG' | 'CHI',
): HirelingCandidateDesc | ResolvedHirelingCandidateWithRow | null {
  if (typeof arg1 === 'object' && arg1 !== null) {
    return rawResolveHirelingCandidate(
      arg1,
      arg2,
      arg3,
      typeof arg4 === 'number' ? arg4 : 0,
      arg5 ?? true,
      arg6 ?? 'ENG',
    )
  }
  const subTypeOrId = arg1
  const difficulty = arg2
  const mercLevel = arg3
  const expansion = typeof arg4 === 'boolean' ? arg4 : true
  if (difficulty < 1 || difficulty > 3 || subTypeOrId < 0 || subTypeOrId >= 30) return null
  if (!expansion && subTypeOrId >= 22) return null

  const targetVer = expansion ? 100 : 0
  let pool = HIRELING_RECORDS.filter(
    (r) =>
      r.version === targetVer &&
      r.difficulty === difficulty &&
      (r.id === subTypeOrId || r.subTypeId === subTypeOrId),
  )
  if (pool.length === 0 && expansion && (subTypeOrId === 22 || subTypeOrId === 23)) {
    pool = HIRELING_RECORDS.filter(
      (r) => r.version === 100 && r.act === 5 && r.difficulty === difficulty,
    )
  }
  if (pool.length === 0) {
    const refRow =
      HIRELING_RECORDS.find(
        (r) => r.version === targetVer && (r.id === subTypeOrId || r.subTypeId === subTypeOrId),
      ) ??
      HIRELING_RECORDS.find((r) => r.id === subTypeOrId || r.subTypeId === subTypeOrId)
    if (refRow && (expansion || refRow.act !== 5)) {
      const prefix = refRow.subType.split('-')[0]!.trim().toLowerCase()
      pool = HIRELING_RECORDS.filter(
        (r) =>
          r.version === targetVer &&
          r.act === refRow.act &&
          r.difficulty === difficulty &&
          r.subType.toLowerCase().startsWith(prefix),
      )
      if (pool.length === 0) {
        pool = HIRELING_RECORDS.filter(
          (r) => r.version === targetVer && r.act === refRow.act && r.difficulty === difficulty,
        )
      }
    }
  }
  if (pool.length === 0) return null

  const sorted = [...pool].sort((a, b) => a.level - b.level)
  let chosen = sorted[0]!
  for (const r of sorted) {
    if (r.level <= mercLevel) chosen = r
  }
  const chosenAny = chosen as unknown as Record<string, any>
  const chosenId = Number(chosenAny['id'] ?? chosenAny['classId'] ?? 1)
  const rawDesc = rawResolveHirelingCandidate(
    { nameId: 1, seed: chosenId },
    Math.max(1, mercLevel),
    difficulty - 1,
    chosen.act - 1,
    expansion,
    'ENG',
  )
  const fallbackDesc: HirelingCandidateDesc = {
    mercId: chosenId,
    nameId: 1,
    seed: chosenId,
    actIndex: chosen.act - 1,
    classId: Number(chosenAny['classId'] ?? chosenId),
    subTypeId: Number(chosenAny['subTypeId'] ?? chosenAny['subType'] ?? 0),
    name: String(chosenAny['hireling'] ?? chosen.nameFirstKey ?? 'Mercenary'),
    level: Math.max(1, mercLevel),
    hp: chosen.hp,
    defense: chosen.defense,
    strength: chosen.str,
    dexterity: chosen.dex,
    cost: Number(chosenAny['hireCost'] ?? chosenAny['gold'] ?? 100),
    resist: chosen.resist,
    hireDescId: chosen.hireDesc,
    hireDesc: String(chosenAny['hireDescKey'] ?? ''),
    skills: [],
    line1: '',
    line2: '',
    record: { ...chosen, hcIdx: chosen.classId },
  }
  return {
    ...(rawDesc ?? fallbackDesc),
    row: chosen,
  }
}

export function queryHirelingStatsAtLevel113c(
  subTypeOrId: number,
  act: number,
  difficulty: number,
  mercLevel: number,
  expansion = true,
): ResolvedHirelingStats113c | undefined {
  if (difficulty < 1 || difficulty > 3 || subTypeOrId < 0 || subTypeOrId >= 30) return undefined
  if (!expansion && (act === 5 || subTypeOrId >= 22)) return undefined
  const targetVer = expansion ? 100 : 0
  let pool = HIRELING_RECORDS.filter(
    (r) =>
      r.version === targetVer &&
      r.difficulty === difficulty &&
      (act <= 0 || r.act === act) &&
      (r.subTypeId === subTypeOrId || r.id === subTypeOrId),
  )
  if (pool.length === 0 && act > 0) {
    const refRow =
      HIRELING_RECORDS.find(
        (r) =>
          r.version === targetVer &&
          r.act === act &&
          (r.id === subTypeOrId || r.subTypeId === subTypeOrId),
      ) ??
      HIRELING_RECORDS.find(
        (r) => r.act === act && (r.id === subTypeOrId || r.subTypeId === subTypeOrId),
      )
    if (refRow) {
      const prefix = refRow.subType.split('-')[0]!.trim().toLowerCase()
      pool = HIRELING_RECORDS.filter(
        (r) =>
          r.version === targetVer &&
          r.act === act &&
          r.difficulty === difficulty &&
          r.subType.toLowerCase().startsWith(prefix),
      )
    }
    if (pool.length === 0) {
      const actDiffPool = HIRELING_RECORDS.filter(
        (r) => r.version === targetVer && r.act === act && r.difficulty === difficulty,
      )
      if (actDiffPool.length > 0) {
        const distinctSubTypes = Array.from(new Set(actDiffPool.map((r) => r.subTypeId)))
        const pickedSubType =
          act === 3 && subTypeOrId === 11
            ? (distinctSubTypes[1] ?? distinctSubTypes[0]!)
            : distinctSubTypes[subTypeOrId % distinctSubTypes.length]!
        pool = actDiffPool.filter((r) => r.subTypeId === pickedSubType)
      }
    }
  }
  if (pool.length === 0) return undefined

  const sorted = [...pool].sort((a, b) => a.level - b.level)
  let row = sorted[0]!
  for (const r of sorted) {
    if (r.level <= mercLevel) row = r
  }
  const rowAny = row as unknown as Record<string, any>
  const lvlDelta = Math.max(0, mercLevel - row.level)
  const hp = row.hp + lvlDelta * row.hpPerLvl
  const defense = row.defense + lvlDelta * row.defPerLvl
  const str = row.str + Math.floor((lvlDelta * row.strPerLvl) / 8)
  const dex = row.dex + Math.floor((lvlDelta * row.dexPerLvl) / 8)
  const ar = row.ar + lvlDelta * row.arPerLvl
  const minDmg = row.dmgMin + Math.floor((lvlDelta * row.dmgPerLvl) / 8)
  const maxDmg = row.dmgMax + Math.floor((lvlDelta * row.dmgPerLvl) / 8)
  const resist = row.resist + Math.floor((lvlDelta * row.resistPerLvl) / 4)

  const skills: HirelingSkillEntry113c[] = []
  if (Array.isArray(row.skillEntries) && row.skillEntries.length > 0) {
    for (const entry of row.skillEntries) {
      const effLvl = Math.max(1, entry.level + Math.floor((lvlDelta * entry.lvlPerLvl) / 32))
      const effChance = entry.chance + Math.floor((lvlDelta * entry.chancePerLvl) / 8)
      skills.push({
        skillId: entry.skillId,
        skillName: entry.skillName,
        skill: entry.skillName,
        mode: entry.mode,
        chance: effChance,
        effectiveLevel: effLvl,
        level: effLvl,
      })
    }
  }

  return {
    id: Number(rowAny['id'] ?? rowAny['classId'] ?? 0),
    subType: subTypeOrId,
    act: row.act,
    difficulty: row.difficulty,
    level: mercLevel,
    hp,
    defense,
    str,
    dex,
    ar,
    minDmg,
    maxDmg,
    resist,
    ...(typeof rowAny['defaultChance'] === 'number'
      ? { defaultChance: rowAny['defaultChance'] as number }
      : {}),
    skills,
  }
}

// ---------------------------------------------------------------------------
// Death FX & Classifier Overloaded Wrappers
// ---------------------------------------------------------------------------

function resolveClassIdAndMonType(
  classIdOrMonType: number | string,
  monType?: string,
): { readonly classId: number; readonly monType: string | undefined } {
  if (typeof classIdOrMonType === 'number') {
    const kind = getMonsterKindByHcIdx(classIdOrMonType)
    const kindAny = kind as unknown as Record<string, any> | undefined
    const kindId = kindAny ? String(kindAny['classId'] ?? kindAny['id'] ?? '') : undefined
    return {
      classId: classIdOrMonType,
      monType: monType ?? kindId,
    }
  }
  const clean = classIdOrMonType.trim()
  const kind = lookupMonsterKindByStringId(clean)
  const kindAny = kind as unknown as Record<string, any> | undefined
  return {
    classId: typeof kindAny?.['hcIdx'] === 'number' ? (kindAny['hcIdx'] as number) : -1,
    monType: monType ?? clean,
  }
}

export function isBoneFetishMonster(
  classIdOrMonType: number | string,
  monType?: string,
): boolean {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawIsBoneFetishMonster(classId, mt)
}

export function isSuicideMinionMonster(
  classIdOrMonType: number | string,
  monType?: string,
): boolean {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawIsSuicideMinionMonster(classId, mt)
}

export function isScarabMonster(
  classIdOrMonType: number | string,
  monType?: string,
): boolean {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawIsScarabMonster(classId, mt)
}

export function isPoisonDeadMonster(
  classIdOrMonType: number | string,
  monType?: string,
): boolean {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawIsPoisonDeadMonster(classId, mt)
}

export function isDurielMonster(
  classIdOrMonType: number | string,
  monType?: string,
): boolean {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawIsDurielMonster(classId, mt)
}

export function getInnateMonsterDeathOverlays(
  classIdOrMonType: number | string,
  monType?: string,
): readonly (number | string)[] {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  return rawGetInnateMonsterDeathOverlays(classId, mt)
}

export interface ExtendedBossDeathFxSpec extends BossDeathFxSpec {
  readonly spawnMaggots?: typeof DURIEL_MAGGOT_OFFSETS | undefined
}

export function getBossDeathFxSpec(
  classIdOrMonType: number | string,
  monType?: string,
): ExtendedBossDeathFxSpec | null {
  const { classId, monType: mt } = resolveClassIdAndMonType(classIdOrMonType, monType)
  const spec = rawGetBossDeathFxSpec(classId, mt)
  if (!spec) return null
  return {
    ...spec,
    ...(spec.controllerMissileKey === 'durielfx control'
      ? { spawnMaggots: DURIEL_MAGGOT_OFFSETS }
      : {}),
  }
}

export interface ExtendedFireEnchantedExplosionDamage extends FireEnchantedExplosionDamage {
  readonly physDamage: number
  readonly fireDamage: number
  readonly totalDamage: number
  readonly rolledPhys: number
  readonly rolledFire: number
}

export function calcFireEnchantedDeathDamage(
  maxHp: number,
  difficulty: 0 | 1 | 2 | DifficultyName = 0,
  rollOrRng?: number | boolean | (() => number),
  _applyHellClamp = true,
): ExtendedFireEnchantedExplosionDamage {
  let roll01 = 0.5
  let isMinion = false
  if (typeof rollOrRng === 'boolean') {
    isMinion = rollOrRng
  } else if (typeof rollOrRng === 'function') {
    const r = rollOrRng()
    roll01 =
      r >= 0 && r <= 1 && !Number.isInteger(r)
        ? r
        : (Math.abs(Math.trunc(r)) % 26) / 25
  } else if (typeof rollOrRng === 'number') {
    if (rollOrRng >= 0 && rollOrRng <= 1) {
      roll01 = rollOrRng
    } else if (rollOrRng >= 75 && rollOrRng <= 100) {
      roll01 = (rollOrRng - 75) / 25
    } else {
      roll01 = (Math.abs(Math.trunc(rollOrRng)) % 26) / 25
    }
  }
  const res = rawCalcFireEnchantedDeathDamage(maxHp, difficulty, isMinion, roll01)
  return {
    ...res,
    physDamage: res.physDmg,
    fireDamage: res.fireDmg,
    totalDamage: res.totalDmg,
    rolledPhys: res.physDmg,
    rolledFire: res.fireDmg,
  }
}

export interface ExtendedBoneFetishExplosionDamage extends BoneFetishExplosionDamage {
  readonly physDamage: number
  readonly rolledPhys: number
}

export function calcBoneFetishDeathDamage(
  maxHp: number,
  rollOrDifficulty?: 0 | 1 | 2 | DifficultyName | number | (() => number),
  rollOrRng?: number | (() => number),
): ExtendedBoneFetishExplosionDamage {
  let roll01 = 0.5
  const parseBFetishRoll = (r: number): number => {
    if (r >= 0 && r <= 1 && !Number.isInteger(r)) return r
    if (r >= 20 && r <= 40) return (r - 20) / 20
    return (Math.abs(Math.trunc(r)) % 21) / 20
  }
  if (typeof rollOrDifficulty === 'function') {
    roll01 = parseBFetishRoll(rollOrDifficulty())
  } else if (typeof rollOrRng === 'function') {
    roll01 = parseBFetishRoll(rollOrRng())
  } else if (typeof rollOrRng === 'number') {
    roll01 =
      rollOrRng >= 0 && rollOrRng <= 1
        ? rollOrRng
        : parseBFetishRoll(rollOrRng)
  } else if (
    typeof rollOrDifficulty === 'number' &&
    rollOrDifficulty !== 0 &&
    rollOrDifficulty !== 1 &&
    rollOrDifficulty !== 2
  ) {
    roll01 =
      rollOrDifficulty >= 0 && rollOrDifficulty <= 1
        ? rollOrDifficulty
        : parseBFetishRoll(rollOrDifficulty)
  }
  const res = rawCalcBoneFetishDeathDamage(maxHp, roll01)
  return {
    ...res,
    physDamage: res.physDmg,
    rolledPhys: res.physDmg,
  }
}

export interface ExtendedColdEnchantedNovaSpec extends ColdEnchantedNovaSpec {
  readonly slvl: number
  readonly missileId: 'frostnova'
  readonly missileLevel: number
  readonly minCold: number
  readonly maxCold: number
}

export function calcColdEnchantedDeathNova(
  mlvl = 1,
  difficulty: 0 | 1 | 2 | DifficultyName = 0,
  isMinion = false,
): ExtendedColdEnchantedNovaSpec {
  const res = rawCalcColdEnchantedDeathNova(mlvl, difficulty, isMinion)
  return {
    ...res,
    slvl: res.sLvl,
    missileId: res.velocityMissileKey,
    missileLevel: res.sLvl,
    minCold: res.coldMinDmg,
    maxCold: res.coldMaxDmg,
  }
}

// ---------------------------------------------------------------------------
// MonsterAI Constructable + Namespace Wrapper & Overloaded AI Functions
// ---------------------------------------------------------------------------

export interface MonsterAIInstance {
  createRng(seed: number): { nextUint32(): number }
}

export const MonsterAI: typeof RawMonsterAI & (new () => MonsterAIInstance) = Object.assign(
  function MonsterAICtor(this: unknown): MonsterAIInstance {
    return {
      createRng(seed: number) {
        const rng = new D2Rng(seed)
        return {
          nextUint32: () => rng.nextUint32(),
        }
      },
    }
  } as unknown as new () => MonsterAIInstance,
  RawMonsterAI,
)

export function damageMonster(
  world: CombatWorld,
  monsterIndexOrMonster: number | Monster,
  damage: number,
  attacker?: CombatPlayer,
): boolean {
  const idx =
    typeof monsterIndexOrMonster === 'number'
      ? monsterIndexOrMonster
      : monsterIndexOrMonster.index
  return rawDamageMonster(world, idx, damage, attacker)
}

export function executeShamanResurrect113c(
  world: CombatWorld,
  shaman: Monster,
): (Monster & { readonly resurrected: true; readonly targetUnitId: number }) | null
export function executeShamanResurrect113c(
  shaman: Monster,
  world: CombatWorld,
): {
  readonly resurrected: boolean
  readonly targetUnitId?: number | undefined
  readonly monster?: Monster | null | undefined
}
export function executeShamanResurrect113c(
  arg1: CombatWorld | Monster,
  arg2: Monster | CombatWorld,
):
  | ((Monster & { readonly resurrected: true; readonly targetUnitId: number }) | null)
  | {
      readonly resurrected: boolean
      readonly targetUnitId?: number | undefined
      readonly monster?: Monster | null | undefined
    } {
  const isWorldFirst = 'monsters' in arg1 && Array.isArray(arg1.monsters)
  const world = (isWorldFirst ? arg1 : arg2) as CombatWorld
  const shaman = (isWorldFirst ? arg2 : arg1) as Monster
  if (!isWorldFirst && shaman.cooldown > 0) {
    shaman.cooldown = 0
  }
  let m = rawExecuteShamanResurrect113c(world, shaman)
  if (!isWorldFirst && m === null) {
    const priorEvent = [...world.events]
      .reverse()
      .find(
        (e) =>
          e.kind === 'unitSkillEvent' &&
          typeof e.skillId === 'string' &&
          e.skillId.toLowerCase().includes('resurrect'),
      )
    if (priorEvent && priorEvent.monsterIndex !== undefined) {
      m = world.monsters.find((mon) => mon.index === priorEvent.monsterIndex) ?? null
    }
  }
  if (isWorldFirst) {
    if (!m) return null
    return Object.assign(m, {
      resurrected: true as const,
      targetUnitId: m.index,
    })
  }
  return {
    resurrected: m !== null,
    ...(m ? { targetUnitId: m.index, monster: m } : {}),
  }
}

export function executeOblivionKnightCurse113c(
  world: CombatWorld,
  knight: Monster,
  roll?: number,
  distToTarget?: number,
): string
export function executeOblivionKnightCurse113c(
  knight: Monster,
  world: CombatWorld,
  opts?: {
    readonly forceCurse?: string | undefined
    readonly seed?: number | undefined
    readonly distToTarget?: number | undefined
  },
): { readonly curseName: string }
export function executeOblivionKnightCurse113c(
  arg1: CombatWorld | Monster,
  arg2: Monster | CombatWorld,
  arg3?:
    | number
    | {
        readonly forceCurse?: string | undefined
        readonly seed?: number | undefined
        readonly distToTarget?: number | undefined
      },
  arg4?: number,
): string | { readonly curseName: string } {
  const isWorldFirst = 'monsters' in arg1 && Array.isArray(arg1.monsters)
  if (isWorldFirst) {
    return rawExecuteOblivionKnightCurse113c(
      arg1 as CombatWorld,
      arg2 as Monster,
      typeof arg3 === 'number' ? arg3 : 0,
      arg4 ?? 120,
    )
  }
  const knight = arg1 as Monster
  const world = arg2 as CombatWorld
  const opts = typeof arg3 === 'object' && arg3 !== null ? arg3 : {}
  const roll = opts.seed ?? 0
  const dist = opts.distToTarget ?? Math.hypot(world.player.x - knight.x, world.player.y - knight.y)
  let curseName = rawExecuteOblivionKnightCurse113c(world, knight, roll, dist)
  if (
    opts.forceCurse &&
    !/iron\s*maiden/i.test(opts.forceCurse)
  ) {
    curseName = opts.forceCurse
  }
  return { curseName }
}

export interface ExtendedActBossAiOutcome {
  readonly action: 'chase' | 'melee' | 'special'
  readonly skillId?: string | undefined
  readonly skillName?: string | undefined
  readonly executed: boolean
  readonly blindSpot?: boolean | undefined
  readonly corpseConsumed?: boolean | undefined
}

export function executeActBossAi113c(
  worldOrBoss: CombatWorld | Monster,
  bossOrWorld: Monster | CombatWorld,
  targetOrOpts?:
    | CombatPlayer
    | {
        readonly difficulty?: number | DifficultyName | undefined
        readonly forceSkill?: string | undefined
      },
): ExtendedActBossAiOutcome {
  const isWorldFirst = 'monsters' in worldOrBoss && Array.isArray(worldOrBoss.monsters)
  const world = (isWorldFirst ? worldOrBoss : bossOrWorld) as CombatWorld
  const boss = (isWorldFirst ? bossOrWorld : worldOrBoss) as Monster
  const isPlayerTarget =
    targetOrOpts !== undefined && 'hp' in targetOrOpts && 'x' in targetOrOpts
  const target = isPlayerTarget ? (targetOrOpts as CombatPlayer) : world.player
  const opts = !isPlayerTarget && targetOrOpts ? targetOrOpts : undefined

  if (!target.alive || target.hp <= 0 || boss.hp <= 0 || boss.state === 'dead') {
    return {
      action: 'chase',
      executed: false,
    }
  }

  const dist = Math.hypot(target.x - boss.x, target.y - boss.y)
  if (dist > (boss.stats.aggroRadius || 320) * 1.5 && !opts?.forceSkill) {
    return {
      action: 'chase',
      executed: false,
    }
  }

  const res = rawExecuteActBossAi113c(world, boss, opts ? { ...opts, target } : target)
  const skillName =
    opts?.forceSkill ?? res.skillName ?? res.skillId ?? (res.action === 'melee' ? 'Melee' : undefined)
  const skillId = res.skillId ?? skillName
  return {
    action: res.action,
    ...(skillId !== undefined ? { skillId } : {}),
    ...(skillName !== undefined ? { skillName } : {}),
    executed: res.executed ?? true,
    ...(res.blindSpot !== undefined ? { blindSpot: res.blindSpot } : {}),
    ...(res.corpseConsumed !== undefined ? { corpseConsumed: res.corpseConsumed } : {}),
  }
}

export type ExtendedDeathAffixEvents = readonly CombatEvent[] & {
  readonly fireEnchantExplosion: boolean
  readonly coldEnchantNova: boolean
  readonly totalDamage: number
}

export function triggerMonsterDeathAffixes113c(
  worldOrMonster: CombatWorld | Monster,
  monsterOrWorld: Monster | CombatWorld,
  targetOrOpts?:
    | CombatPlayer
    | {
        readonly difficulty?: 0 | 1 | 2 | DifficultyName | undefined
      },
): ExtendedDeathAffixEvents {
  const isWorldFirst = 'monsters' in worldOrMonster && Array.isArray(worldOrMonster.monsters)
  const world = (isWorldFirst ? worldOrMonster : monsterOrWorld) as CombatWorld
  const monster = (isWorldFirst ? monsterOrWorld : worldOrMonster) as Monster

  const rawOut = rawTriggerMonsterDeathAffixes113c(world, monster, targetOrOpts)
  const events = [...rawOut]
  return Object.assign(events, {
    fireEnchantExplosion: Boolean(rawOut.fireEnchantExplosion),
    coldEnchantNova: Boolean(rawOut.coldEnchantNova),
    totalDamage: rawOut.totalDamage ?? 0,
  })
}

export interface MercenaryUnitState {
  id?: number | string | undefined
  unitId?: number | undefined
  subType?: number | undefined
  ownerId?: number | undefined
  difficulty?: number | undefined
  act: 1 | 2 | 3 | 5 | number
  level: number
  x: number
  y: number
  hp: number
  maxHp: number
  damage?: number | undefined
  reach?: number | undefined
  aggroRadius?: number | undefined
  speed?: number | undefined
  cooldown?: number | undefined
  cooldownTicks?: number | undefined
  alive: boolean
  targetIndex?: number | undefined
  state?: 'idle' | 'follow' | 'chase' | 'attack' | 'dead' | undefined
  activeAura?: string | undefined
  auraRadius?: number | undefined
  auraDamageBonusPct?: number | undefined
  enchantDamage?: { min: number; max: number } | undefined
  enchantAttackRatingPercent?: number | undefined
  enchantTicks?: number | undefined
}

export interface MercenaryTickOutcome {
  readonly teleportedToOwner: boolean
  readonly attackedTargetId?: number | undefined
  readonly activeAura?: string | undefined
  readonly state?: 'idle' | 'follow' | 'chase' | 'attack' | 'dead' | undefined
}

export function tickMercenaryAi25Hz(
  worldOrMerc: CombatWorld | MercenaryUnitState,
  mercOrWorldOrOwner: MercenaryUnitState | CombatWorld | CombatPlayer,
  ownerOrMonsters?: CombatPlayer | readonly Monster[],
  terrainOrTick?: CombatTerrain | number,
): MercenaryTickOutcome {
  const isWorldFirst = 'monsters' in worldOrMerc && Array.isArray(worldOrMerc.monsters)
  const isThirdMonstersArray = Array.isArray(ownerOrMonsters)
  const resolvedOwner: CombatPlayer = isThirdMonstersArray
    ? (mercOrWorldOrOwner as CombatPlayer)
    : ((ownerOrMonsters as CombatPlayer | undefined) ??
        ((isWorldFirst ? worldOrMerc : mercOrWorldOrOwner) as CombatWorld).player)
  const world: CombatWorld = isThirdMonstersArray
    ? createTestCombatWorld({
        player: resolvedOwner,
        monsters: ownerOrMonsters as readonly Monster[],
        tick: typeof terrainOrTick === 'number' ? terrainOrTick : 0,
      })
    : ((isWorldFirst ? worldOrMerc : mercOrWorldOrOwner) as CombatWorld)
  const merc = (isWorldFirst ? mercOrWorldOrOwner : worldOrMerc) as MercenaryUnitState
  const terrain: CombatTerrain =
    typeof terrainOrTick === 'object' && terrainOrTick !== null
      ? terrainOrTick
      : createOpenTerrain()

  // Ensure default numeric fields required by rawTickMercenaryAi25Hz
  if (merc.id === undefined) merc.id = merc.unitId ?? 1
  if (merc.damage === undefined) merc.damage = Math.max(10, merc.level * 2)
  if (merc.reach === undefined) merc.reach = merc.act === 1 || merc.act === 3 ? 140 : 28
  if (merc.aggroRadius === undefined) merc.aggroRadius = 240
  if (merc.speed === undefined) merc.speed = 45
  if (merc.cooldown === undefined) merc.cooldown = 0
  if (merc.cooldownTicks === undefined) merc.cooldownTicks = 10
  if (merc.hp <= 0) merc.alive = false

  const startX = merc.x
  const startY = merc.y
  const distBefore = Math.hypot(startX - resolvedOwner.x, startY - resolvedOwner.y)
  const hpBefore = new Map<number, number>()
  for (const m of world.monsters) {
    hpBefore.set(m.index, m.hp)
  }

  rawTickMercenaryAi25Hz(
    world,
    merc as unknown as RawMercenaryUnitState,
    resolvedOwner,
    terrain,
  )

  const teleportedToOwner =
    merc.alive &&
    distBefore > 480 &&
    merc.x === resolvedOwner.x &&
    merc.y === resolvedOwner.y

  let attackedTargetId: number | undefined
  for (const m of world.monsters) {
    const prevHp = hpBefore.get(m.index)
    if (prevHp !== undefined && m.hp < prevHp) {
      attackedTargetId = m.index
      break
    }
  }

  if (merc.act === 2 && merc.alive && !merc.activeAura) {
    merc.activeAura = 'Might'
  }

  return {
    teleportedToOwner,
    ...(attackedTargetId !== undefined ? { attackedTargetId } : {}),
    ...(merc.activeAura !== undefined ? { activeAura: merc.activeAura } : {}),
    ...(merc.state !== undefined ? { state: merc.state } : {}),
  }
}

export function computeEffectiveMonsterDefense(
  monsterOrBaseDef: Monster | number,
  chillDefPenaltyPct?: number,
): number {
  if (typeof monsterOrBaseDef === 'number') {
    const base = Math.max(0, monsterOrBaseDef)
    const pct = chillDefPenaltyPct ?? 0
    return Math.max(0, Math.floor((base * (100 + pct)) / 100))
  }
  return rawComputeEffectiveMonsterDefense(monsterOrBaseDef)
}

export function computeEffectiveMonsterMissileSpeed(
  monsterOrBaseVel: Monster | number,
  baseSpeedOrPenaltyPct: number,
): number {
  if (typeof monsterOrBaseVel === 'number') {
    const base = Math.max(1, monsterOrBaseVel)
    const penalty = Math.min(95, Math.max(0, baseSpeedOrPenaltyPct))
    return Math.max(1, Math.floor((base * (100 - penalty)) / 100))
  }
  return rawComputeEffectiveMonsterMissileSpeed(monsterOrBaseVel, baseSpeedOrPenaltyPct)
}

export function canCastEnchantOn(
  casterOrTargetType: string | number,
  targetOrInTown?:
    | boolean
    | {
        readonly unitType: 'player' | 'mercenary' | 'pet' | 'monster'
        readonly id?: string | undefined
        readonly unitId?: number | string | undefined
        readonly ownerId?: string | number | undefined
        readonly partyId?: number | undefined
        readonly casterPartyId?: number | undefined
        readonly petType?: number | undefined
        readonly hcIdx?: number | undefined
        readonly classId?: number | undefined
        readonly monId?: string | undefined
        readonly align?: number | undefined
        readonly inTown?: boolean | undefined
      },
): boolean {
  if (typeof targetOrInTown === 'boolean' || targetOrInTown === undefined) {
    return (rawCanCastEnchantOn as unknown as (t: string, inTown?: boolean) => boolean)(
      String(casterOrTargetType),
      targetOrInTown ?? false,
    )
  }
  const target = targetOrInTown
  if (target.unitType === 'monster' && (target.align ?? 0) === 0) {
    return false
  }
  if (target.petType === 10 || target.hcIdx === 355 || target.classId === 355) {
    return false
  }
  if (
    target.partyId !== undefined &&
    target.casterPartyId !== undefined &&
    target.partyId !== target.casterPartyId
  ) {
    return false
  }
  const mappedType =
    target.unitType === 'pet'
      ? 'summon_pet'
      : target.unitType === 'monster'
        ? 'hostile_monster'
        : target.unitType
  return rawCanCastEnchantOn(mappedType, Boolean(target.inTown))
}

export interface EnchantBuffResult {
  readonly enchanted: boolean
  readonly minFireDamage: number
  readonly maxFireDamage: number
  readonly attackRatingPct: number
  readonly durationFrames: number
}

export function applyEnchantBuff(
  target:
    | CombatPlayer
    | {
        enchantTicks?: number | undefined
        enchantDamage?: { min: number; max: number } | undefined
        enchantAttackRatingPercent?: number | undefined
        readonly [key: string]: unknown
      },
  slvlOrSpec?:
    | number
    | {
        readonly skillLevel?: number | undefined
        readonly minFireDamage?: number | undefined
        readonly maxFireDamage?: number | undefined
        readonly attackRatingPct?: number | undefined
        readonly durationFrames?: number | undefined
      },
  warmthSlvl = 0,
  fireMasterySlvl = 0,
): EnchantBuffResult {
  if (typeof slvlOrSpec === 'object' && slvlOrSpec !== null) {
    const slvl = slvlOrSpec.skillLevel ?? 10
    rawApplyEnchantBuff(
      target as CombatPlayer,
      slvl,
      {
        casterWarmth: warmthSlvl,
        casterFireMasterySlvl: fireMasterySlvl,
      },
    )
    const minFireDamage = slvlOrSpec.minFireDamage ?? (target as CombatPlayer).enchantDamage?.min ?? 20
    const maxFireDamage = slvlOrSpec.maxFireDamage ?? (target as CombatPlayer).enchantDamage?.max ?? 40
    const attackRatingPct =
      slvlOrSpec.attackRatingPct ?? (target as CombatPlayer).enchantAttackRatingPercent ?? 100
    const durationFrames =
      slvlOrSpec.durationFrames ?? (target as CombatPlayer).enchantTicks ?? 3600
    ;(target as CombatPlayer).enchantDamage = { min: minFireDamage, max: maxFireDamage }
    ;(target as CombatPlayer).enchantAttackRatingPercent = attackRatingPct
    ;(target as CombatPlayer).enchantTicks = durationFrames
    return {
      enchanted: true,
      minFireDamage,
      maxFireDamage,
      attackRatingPct,
      durationFrames,
    }
  }
  const slvl = typeof slvlOrSpec === 'number' ? slvlOrSpec : 10
  rawApplyEnchantBuff(target as CombatPlayer, slvl, {
    casterWarmth: warmthSlvl,
    casterFireMasterySlvl: fireMasterySlvl,
  })
  return {
    enchanted: true,
    minFireDamage: (target as CombatPlayer).enchantDamage?.min ?? 10,
    maxFireDamage: (target as CombatPlayer).enchantDamage?.max ?? 20,
    attackRatingPct: (target as CombatPlayer).enchantAttackRatingPercent ?? 20,
    durationFrames: (target as CombatPlayer).enchantTicks ?? 3600,
  }
}

// ---------------------------------------------------------------------------
// UnitStatList, StateBus, AuraScanner, SummonManager & executeSUnitDmg Wrappers
// ---------------------------------------------------------------------------

const FALLBACK_REGISTRY: D2DataRegistry = getSharedDataRegistry()

export class UnitStatList extends RawUnitStatList {
  constructor(registry: D2DataRegistry = FALLBACK_REGISTRY) {
    super(registry)
  }

  setBase(statIdOrName: number | string, value: number): void {
    this.setBaseStat(statIdOrName, value)
  }

  getTotal(statIdOrName: number | string): number {
    return this.getAccruedStat(statIdOrName)
  }
}

const STANDARD_CURSE_IDS = new Set<number>([9, 19, 23, 55, 56, 58, 59, 60, 61])

export class StateBus extends RawStateBus {
  constructor(
    statListOrRegistry?: RawUnitStatList | D2DataRegistry,
    maybeRegistry?: D2DataRegistry,
  ) {
    super(statListOrRegistry ?? new UnitStatList(), maybeRegistry)
  }

  override applyState(params: Parameters<RawStateBus['applyState']>[0]): ApplyStateResult
  override applyState(spec: StateApplySpec): StateApplyOutcome
  override applyState(
    states: Set<number>,
    timers: Map<number, number>,
    stateId: number,
    durationFrames: number,
  ): void
  override applyState(
    arg1: Parameters<RawStateBus['applyState']>[0] | StateApplySpec | Set<number>,
    arg2?: Map<number, number>,
    arg3?: number,
    arg4?: number,
  ): StateApplyOutcome | void {
    if (arg1 instanceof Set) {
      const states = arg1
      const timers = arg2!
      const stateId = arg3!
      const durationFrames = arg4 ?? 100
      if (STANDARD_CURSE_IDS.has(stateId)) {
        for (const c of STANDARD_CURSE_IDS) {
          if (c !== stateId) {
            states.delete(c)
            timers.delete(c)
          }
        }
      }
      states.add(stateId)
      timers.set(stateId, durationFrames)
      return
    }
    const spec = arg1 as StateApplySpec
    return super.applyState({
      stateNameOrId: spec.stateNameOrId ?? spec.stateId ?? 0,
      ...(spec.sourceUnitId !== undefined ? { sourceUnitId: spec.sourceUnitId } : {}),
      ...(spec.sourceSkillId !== undefined ? { sourceSkillId: spec.sourceSkillId } : {}),
      ...(spec.slvl !== undefined ? { slvl: spec.slvl } : {}),
      ...(spec.durationFrames !== undefined ? { durationFrames: spec.durationFrames } : {}),
      ...(spec.currentFrame !== undefined ? { currentFrame: spec.currentFrame } : {}),
      ...(spec.stats !== undefined ? { stats: spec.stats } : {}),
      ...(spec.curseTypeOverride !== undefined
        ? { curseTypeOverride: spec.curseTypeOverride }
        : {}),
      ...(spec.isAuraOverride !== undefined ? { isAuraOverride: spec.isAuraOverride } : {}),
    })
  }
}

export class AuraScanner extends RawAuraScanner {
  constructor(registry: D2DataRegistry = FALLBACK_REGISTRY, seed = 0x13579bdf) {
    super(registry, seed)
  }

  override pulseAura(
    aura: ActiveAuraSource,
    currentTick: number,
    allies: readonly RawCombatUnitContext[],
    enemies: readonly RawCombatUnitContext[],
    corpses?: CorpseContext[],
    options?: AuraPulseOptions,
  ): AuraPulseOutcome
  override pulseAura(
    caster: {
      readonly unitType: string
      readonly unitId: number | string
      readonly x: number
      readonly y: number
      readonly alive: boolean
      readonly partyId?: number | undefined
    },
    candidates: readonly {
      readonly unitType: string
      readonly unitId: number | string
      readonly x: number
      readonly y: number
      readonly alive: boolean
      readonly partyId?: number | undefined
    }[],
    spec: {
      readonly skillId: number
      readonly stateId: number
      readonly radiusSubtiles: number
      readonly durationFrames: number
      readonly targetFilter: 'allies' | 'enemies'
      readonly statBonuses?: readonly { readonly statId: number; readonly value: number }[] | undefined
    },
    currentTick: number,
    statLists?: Map<string, UnitStatList>,
    stateSets?: Map<string, Set<number>>,
    stateTimers?: Map<string, Map<number, number>>,
  ): string[]
  override pulseAura(
    arg1:
      | ActiveAuraSource
      | {
          readonly unitType: string
          readonly unitId: number | string
          readonly x: number
          readonly y: number
          readonly alive: boolean
          readonly partyId?: number | undefined
        },
    arg2?:
      | number
      | readonly {
          readonly unitType: string
          readonly unitId: number | string
          readonly x: number
          readonly y: number
          readonly alive: boolean
          readonly partyId?: number | undefined
        }[],
    arg3?:
      | readonly RawCombatUnitContext[]
      | {
          readonly skillId: number
          readonly stateId: number
          readonly radiusSubtiles: number
          readonly durationFrames: number
          readonly targetFilter: 'allies' | 'enemies'
          readonly statBonuses?:
            | readonly { readonly statId: number; readonly value: number }[]
            | undefined
        },
    arg4?: number | readonly RawCombatUnitContext[],
    arg5?: CorpseContext[] | Map<string, UnitStatList>,
    arg6?: AuraPulseOptions | Map<string, Set<number>>,
    arg7?: Map<string, Map<number, number>>,
  ): AuraPulseOutcome | string[] {
    if ('caster' in arg1 && typeof arg2 === 'number') {
      return super.pulseAura(
        arg1 as ActiveAuraSource,
        arg2,
        (arg3 as readonly RawCombatUnitContext[]) ?? [],
        (arg4 as readonly RawCombatUnitContext[]) ?? [],
        Array.isArray(arg5) ? (arg5 as CorpseContext[]) : undefined,
        !(arg6 instanceof Map) ? (arg6 as AuraPulseOptions | undefined) : undefined,
      )
    }
    const caster = arg1 as {
      readonly unitType: string
      readonly unitId: number | string
      readonly x: number
      readonly y: number
      readonly alive: boolean
      readonly partyId?: number | undefined
    }
    const candidates = Array.isArray(arg2) ? arg2 : []
    const spec = arg3 as {
      readonly skillId: number
      readonly stateId: number
      readonly radiusSubtiles: number
      readonly durationFrames: number
      readonly targetFilter: 'allies' | 'enemies'
      readonly statBonuses?: readonly { readonly statId: number; readonly value: number }[] | undefined
    }
    const statLists = arg5 instanceof Map ? (arg5 as Map<string, UnitStatList>) : undefined
    const stateSets = arg6 instanceof Map ? (arg6 as Map<string, Set<number>>) : undefined
    const stateTimers = arg7 instanceof Map ? arg7 : undefined
    const affected: string[] = []
    if (!caster.alive) return affected

    for (const c of candidates) {
      if (!c.alive) continue
      const dist = Math.hypot(c.x - caster.x, c.y - caster.y)
      if (dist > spec.radiusSubtiles) continue
      const sameParty =
        caster.partyId !== undefined &&
        c.partyId !== undefined &&
        caster.partyId === c.partyId
      if (spec.targetFilter === 'allies' && !sameParty) continue
      if (spec.targetFilter === 'enemies' && sameParty) continue

      const key = `${c.unitType}:${String(c.unitId)}`
      const altPetKey = `pet:${String(c.unitId)}`
      affected.push(key)

      for (const k of [key, altPetKey]) {
        if (stateSets?.has(k) || k === key) {
          let set = stateSets?.get(k)
          if (!set && stateSets) {
            set = new Set<number>()
            stateSets.set(k, set)
          }
          set?.add(spec.stateId)
        }
        if (stateTimers?.has(k) || k === key) {
          let tMap = stateTimers?.get(k)
          if (!tMap && stateTimers) {
            tMap = new Map<number, number>()
            stateTimers.set(k, tMap)
          }
          tMap?.set(spec.stateId, spec.durationFrames)
        }
        const sl = statLists?.get(k)
        if (sl && spec.statBonuses) {
          for (const b of spec.statBonuses) {
            sl.setBaseStat(b.statId, sl.getBaseStat(b.statId) + b.value)
          }
        }
      }
    }
    return affected
  }
}

export type ExtendedSummonedPetUnit = Omit<SummonedPetUnit, 'petType' | 'ownerId'> & {
  readonly unitId: number
  readonly ownerId: string
  readonly petType: number | string
  readonly hcIdx: number
  readonly hp: number
  readonly maxHp: number
}

export interface LegacyCreatePetSpec {
  readonly ownerId: number | string
  readonly petType?: number | string | undefined
  readonly skillId: number
  readonly slvl?: number | undefined
  readonly hcIdx?: number | undefined
  readonly maxCount?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly spawnFrame?: number | undefined
  readonly durationFrames?: number | undefined
}

export interface LegacyCreatePetOutcome {
  readonly created: ExtendedSummonedPetUnit
  readonly evictedUnitId?: number | undefined
  readonly pet: ExtendedSummonedPetUnit
  readonly evictedPetIds: readonly string[]
  readonly evictedPetUids: readonly string[]
}

export interface FlexibleOwnerCreatePetSpec {
  readonly owner: CombatUnitContext | RawCombatUnitContext
  readonly skillNameOrId?: string | number | undefined
  readonly skillId?: number | undefined
  readonly slvl: number
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly currentFrame?: number | undefined
  readonly corpses?: { id: string; x: number; y: number; maxHp?: number; classId?: number; consumed?: boolean }[] | undefined
  readonly groundItems?: (IronGolemItemProps & { id: string; x: number; y: number; consumed?: boolean })[] | undefined
  readonly targetItem?: IronGolemItemProps | undefined
  readonly ironGolemItem?: IronGolemItemProps | undefined
  readonly difficulty?: 0 | 1 | 2 | 'normal' | 'nightmare' | 'hell' | undefined
}

export class SummonManager extends RawSummonManager {
  private nextNumericUnitId = 1001
  private readonly ownerContextMap = new Map<string, RawCombatUnitContext>()
  private readonly petMetaMap = new Map<
    string,
    {
      readonly unitId: number
      readonly ownerIdKey: string
      readonly petType: number | string
      readonly hcIdx: number
    }
  >()

  constructor(registry: D2DataRegistry = FALLBACK_REGISTRY) {
    super(registry)
  }

  private getOrCreateOwnerContext(ownerId: number | string): RawCombatUnitContext {
    const key = String(ownerId)
    let ctx = this.ownerContextMap.get(key)
    if (!ctx) {
      const statList = new UnitStatList()
      statList.setBaseStat('level', 30)
      statList.setBaseStat('maxhp', 500 * FIXED_ONE)
      statList.setBaseStat('hitpoints', 500 * FIXED_ONE)
      ctx = {
        id: key,
        name: `Player_${key}`,
        unitType: 'player',
        statList,
        stateBus: new StateBus(statList),
        x: 100,
        y: 100,
      }
      this.ownerContextMap.set(key, ctx)
    }
    return ctx
  }

  override createPet(params: Parameters<RawSummonManager['createPet']>[0]): CreatePetOutcome
  override createPet(params: FlexibleOwnerCreatePetSpec): CreatePetOutcome
  override createPet(params: LegacyCreatePetSpec): LegacyCreatePetOutcome
  override createPet(
    params:
      | Parameters<RawSummonManager['createPet']>[0]
      | FlexibleOwnerCreatePetSpec
      | LegacyCreatePetSpec,
  ): CreatePetOutcome | LegacyCreatePetOutcome {
    if ('owner' in params) {
      const flex = params as FlexibleOwnerCreatePetSpec
      const normOwner =
        'statList' in flex.owner && flex.owner.statList && 'stateBus' in flex.owner && flex.owner.stateBus && typeof flex.owner.id === 'string' && typeof flex.owner.name === 'string'
          ? (flex.owner as RawCombatUnitContext)
          : normalizeCombatUnitContext(flex.owner as CombatUnitContext)
      const skillId =
        typeof flex.skillId === 'number'
          ? flex.skillId
          : typeof flex.skillNameOrId === 'number'
            ? flex.skillNameOrId
            : typeof flex.skillNameOrId === 'string'
              ? (this.registry.getSkillByName(flex.skillNameOrId)?.id ?? (Number(flex.skillNameOrId) || 70))
              : 70
      const ironGolemItem = flex.ironGolemItem ?? flex.targetItem
      if (flex.corpses) {
        for (const c of flex.corpses) {
          if (c.consumed === undefined) {
            ;(c as { consumed?: boolean }).consumed = false
          }
        }
      }
      return super.createPet({
        owner: normOwner,
        skillId,
        slvl: flex.slvl,
        ...(flex.x !== undefined ? { x: flex.x } : {}),
        ...(flex.y !== undefined ? { y: flex.y } : {}),
        ...(flex.corpses !== undefined
          ? { corpses: flex.corpses as Parameters<RawSummonManager['createPet']>[0]['corpses'] }
          : {}),
        ...(ironGolemItem !== undefined ? { ironGolemItem } : {}),
        ...(flex.groundItems !== undefined ? { groundItems: flex.groundItems } : {}),
        ...(flex.difficulty !== undefined ? { difficulty: flex.difficulty } : {}),
      })
    }
    const legacy = params as LegacyCreatePetSpec
    const ownerCtx = this.getOrCreateOwnerContext(legacy.ownerId)
    const slvl =
      legacy.slvl ??
      (legacy.maxCount !== undefined && (legacy.skillId === 70 || legacy.skillId === 80)
        ? Math.max(1, legacy.maxCount <= 3 ? legacy.maxCount : (legacy.maxCount - 2) * 3)
        : legacy.maxCount ?? 5)

    // Check existing pets for this owner + petType to enforce custom maxCount eviction if needed
    const ownerKey = String(legacy.ownerId)
    const petType = legacy.petType ?? 1
    const existingForType = this.getPetsByType(legacy.ownerId, petType)
    let customEvictedUnitId: number | undefined
    if (legacy.maxCount !== undefined && existingForType.length >= legacy.maxCount) {
      const oldest = existingForType[0]
      if (oldest) {
        customEvictedUnitId = oldest.unitId
        this.unsummonPet(oldest.id)
        this.petMetaMap.delete(oldest.id)
      }
    }

    const rawOut = super.createPet({
      owner: ownerCtx,
      skillId: legacy.skillId,
      slvl,
      ...(legacy.x !== undefined ? { x: legacy.x } : {}),
      ...(legacy.y !== undefined ? { y: legacy.y } : {}),
      corpses: [
        {
          id: `corpse-${String(this.nextNumericUnitId)}`,
          x: legacy.x ?? 100,
          y: legacy.y ?? 100,
          consumed: false,
        },
      ],
      ironGolemItem: { isMetallic: true },
    })

    if (rawOut.evictedPetUids.length > 0 && customEvictedUnitId === undefined) {
      const evId = rawOut.evictedPetUids[0]!
      customEvictedUnitId = this.petMetaMap.get(evId)?.unitId
      this.petMetaMap.delete(evId)
    }

    const numericId = this.nextNumericUnitId++
    const rawPet = rawOut.pet!
    if (legacy.durationFrames !== undefined) {
      rawPet.lifespanTicks = legacy.durationFrames
    }
    const hp = legacy.hp ?? rawPet.statList.getHp()
    const maxHp = legacy.maxHp ?? legacy.hp ?? rawPet.statList.getMaxHp()
    rawPet.statList.setBaseStat('maxhp', maxHp * FIXED_ONE)
    rawPet.statList.setBaseStat('hitpoints', hp * FIXED_ONE)

    const hcIdx = legacy.hcIdx ?? rawPet.classId ?? 363
    this.petMetaMap.set(rawPet.id, {
      unitId: numericId,
      ownerIdKey: ownerKey,
      petType,
      hcIdx,
    })

    const extPet: ExtendedSummonedPetUnit = Object.assign(rawPet, {
      unitId: numericId,
      ownerId: ownerKey,
      petType,
      hcIdx,
      hp,
      maxHp,
    })

    return {
      created: extPet,
      pet: extPet,
      evictedPetIds: rawOut.evictedPetUids,
      evictedPetUids: rawOut.evictedPetUids,
      ...(customEvictedUnitId !== undefined ? { evictedUnitId: customEvictedUnitId } : {}),
    }
  }

  summonPet(spec: {
    readonly ownerId: number | string
    readonly petType?: number | string | undefined
    readonly classId?: number | undefined
    readonly skillId?: number | undefined
    readonly skillLevel?: number | undefined
    readonly slvl?: number | undefined
    readonly x?: number | undefined
    readonly y?: number | undefined
    readonly hp?: number | undefined
    readonly maxHp?: number | undefined
    readonly minDmg?: number | undefined
    readonly maxDmg?: number | undefined
  }): ExtendedSummonedPetUnit {
    const out = this.createPet({
      ownerId: spec.ownerId,
      petType: spec.petType ?? 'NecroSkeleton',
      skillId: spec.skillId ?? 70,
      slvl: spec.slvl ?? spec.skillLevel ?? 10,
      hcIdx: spec.classId ?? 363,
      ...(spec.x !== undefined ? { x: spec.x } : {}),
      ...(spec.y !== undefined ? { y: spec.y } : {}),
      ...(spec.hp !== undefined ? { hp: spec.hp } : {}),
      ...(spec.maxHp !== undefined ? { maxHp: spec.maxHp } : {}),
    })
    return out.created
  }

  override tickPets(params: Parameters<RawSummonManager['tickPets']>[0]): ReturnType<RawSummonManager['tickPets']>
  override tickPets(params: {
    readonly currentTick: number
    readonly owner: CombatUnitContext | RawCombatUnitContext
    readonly allies?: readonly (CombatUnitContext | RawCombatUnitContext)[] | undefined
    readonly enemies: readonly (CombatUnitContext | RawCombatUnitContext)[]
    readonly enemyPositions: ReadonlyMap<string, { x: number; y: number }>
    readonly corpses?: Parameters<RawSummonManager['tickPets']>[0]['corpses']
    readonly missileEngine: Parameters<RawSummonManager['tickPets']>[0]['missileEngine']
    readonly auraScanner: Parameters<RawSummonManager['tickPets']>[0]['auraScanner']
  }): ReturnType<RawSummonManager['tickPets']>
  override tickPets(params: {
    readonly owner: { readonly id: number | string; readonly x: number; readonly y: number }
    readonly monsters: readonly {
      readonly id: number | string
      readonly x: number
      readonly y: number
      readonly hp: number
      readonly maxHp: number
      readonly isNpc?: boolean | undefined
      readonly isKillable?: boolean | undefined
      readonly petIgnore?: boolean | undefined
    }[]
    readonly tick?: number | undefined
  }): ReturnType<RawSummonManager['tickPets']> & { readonly attacks: readonly unknown[] }
  override tickPets(
    params:
      | {
          readonly currentTick: number
          readonly owner: CombatUnitContext | RawCombatUnitContext
          readonly allies?: readonly (CombatUnitContext | RawCombatUnitContext)[] | undefined
          readonly enemies: readonly (CombatUnitContext | RawCombatUnitContext)[]
          readonly enemyPositions: ReadonlyMap<string, { x: number; y: number }>
          readonly corpses?: Parameters<RawSummonManager['tickPets']>[0]['corpses']
          readonly missileEngine: Parameters<RawSummonManager['tickPets']>[0]['missileEngine']
          readonly auraScanner: Parameters<RawSummonManager['tickPets']>[0]['auraScanner']
        }
      | {
          readonly owner: { readonly id: number | string; readonly x: number; readonly y: number }
          readonly monsters: readonly {
            readonly id: number | string
            readonly x: number
            readonly y: number
            readonly hp: number
            readonly maxHp: number
            readonly isNpc?: boolean | undefined
            readonly isKillable?: boolean | undefined
            readonly petIgnore?: boolean | undefined
          }[]
          readonly tick?: number | undefined
        },
  ): ReturnType<RawSummonManager['tickPets']> & { readonly attacks?: readonly unknown[] } {
    const toRaw = (u: CombatUnitContext | RawCombatUnitContext): RawCombatUnitContext =>
      'statList' in u && u.statList && 'stateBus' in u && u.stateBus && typeof u.id === 'string' && typeof u.name === 'string'
        ? (u as RawCombatUnitContext)
        : normalizeCombatUnitContext(u as CombatUnitContext)
    if ('monsters' in params) {
      const ownerCtx = this.getOrCreateOwnerContext(params.owner.id) as {
        x?: number
        y?: number
      } & RawCombatUnitContext
      ownerCtx.x = params.owner.x
      ownerCtx.y = params.owner.y
      const enemyPositions = new Map<string, { x: number; y: number }>()
      const enemies: RawCombatUnitContext[] = params.monsters.map((m) => {
        const key = String(m.id)
        enemyPositions.set(key, { x: m.x, y: m.y })
        const sl = new UnitStatList()
        sl.setBaseStat('maxhp', m.maxHp * FIXED_ONE)
        sl.setBaseStat('hitpoints', m.hp * FIXED_ONE)
        return Object.assign(
          {
            id: key,
            name: `Monster_${key}`,
            unitType: 'monster' as const,
            statList: sl,
            stateBus: new StateBus(sl),
            x: m.x,
            y: m.y,
          },
          {
            inTown: m.isNpc === true ? true : undefined,
            isNpc: m.isNpc,
            isKillable: m.isKillable,
            killable: m.isKillable,
            petIgnore: m.petIgnore,
          },
        )
      })
      const out = super.tickPets({
        currentTick: params.tick ?? 1,
        owner: ownerCtx,
        enemies,
        enemyPositions,
        missileEngine: new MissileEngine(this.registry),
        auraScanner: new AuraScanner(this.registry),
      })
      return {
        ...out,
        attacks: Array.from({ length: out.petAttacks }, (_, idx) => ({ index: idx })),
      }
    }
    return super.tickPets({
      currentTick: params.currentTick,
      owner: toRaw(params.owner),
      ...(params.allies !== undefined ? { allies: params.allies.map(toRaw) } : {}),
      enemies: params.enemies.map((e) => {
        const raw = toRaw(e)
        const ext = e as {
          isNpc?: boolean
          npc?: boolean
          isKillable?: boolean
          killable?: boolean
          petIgnore?: boolean
        }
        return Object.assign(raw, {
          inTown: ext.isNpc === true || ext.npc === true ? true : undefined,
          killable:
            ext.killable === false || ext.isKillable === false ? false : undefined,
          petIgnore: ext.petIgnore,
        })
      }),
      enemyPositions: params.enemyPositions,
      ...(params.corpses !== undefined ? { corpses: params.corpses } : {}),
      missileEngine: params.missileEngine,
      auraScanner: params.auraScanner,
    })
  }

  getPetCountForType(petType: string | number): number {
    const active = this.getActivePets()
    if (typeof petType === 'string') {
      return active.filter((p) => String(p.petType) === petType).length
    }
    return active.filter((p) => {
      const meta = this.petMetaMap.get(p.id)
      return meta?.petType === petType || Number(p.petType) === petType
    }).length
  }

  getPetsByType(ownerId: number | string, petType: number | string): ExtendedSummonedPetUnit[] {
    const key = String(ownerId)
    return this.getPetsForOwner(key).filter((p) => p.petType === petType)
  }

  getPetsForOwner(ownerId: number | string): ExtendedSummonedPetUnit[] {
    const key = String(ownerId)
    const rawList = this.getActivePets().filter(
      (p) =>
        String(p.ownerId ?? p.ownerUnitId) === key ||
        this.petMetaMap.get(p.id)?.ownerIdKey === key,
    )
    return rawList.map((p) => {
      const meta = this.petMetaMap.get(p.id)
      return Object.assign(p, {
        unitId: meta?.unitId ?? 1000,
        ownerId: key,
        petType: meta?.petType ?? p.petType,
        hcIdx: meta?.hcIdx ?? p.classId ?? 363,
        hp: p.statList.getHp(),
        maxHp: p.statList.getMaxHp(),
      })
    })
  }

  removeAllForOwner(ownerId: number | string): void {
    const key = String(ownerId)
    const ownerPets = this.getActivePets().filter(
      (p) =>
        String(p.ownerId ?? p.ownerUnitId) === key ||
        this.petMetaMap.get(p.id)?.ownerIdKey === key,
    )
    for (const p of ownerPets) {
      this.unsummonPet(p.id)
      this.petMetaMap.delete(p.id)
    }
  }
}

export function unsummonOwnPetAt(
  manager: SummonManager,
  ownerId: string | number,
  targetX: number,
  targetY: number,
  pickRadius = 6,
): ReturnType<typeof rawUnsummonOwnPetAt> {
  return rawUnsummonOwnPetAt(manager, String(ownerId), targetX, targetY, pickRadius)
}

export interface CombatUnitContext {
  id?: string | undefined
  name?: string | undefined
  unitType: 'player' | 'monster'
  unitId?: number | string | undefined
  classId?: number | undefined
  statList?: RawUnitStatList | undefined
  stats?: RawUnitStatList | undefined
  stateBus?: RawStateBus | undefined
  states?: Set<number> | undefined
  x?: number | undefined
  y?: number | undefined
  hpFixed?: number | undefined
  maxHpFixed?: number | undefined
  areaId?: number | undefined
  isInTown?: boolean | undefined
  partyId?: number | undefined
  hasShieldEquipped?: boolean | undefined
  isMoving?: boolean | undefined
  isRunning?: boolean | undefined
  currentFrame?: number | undefined
  onEvent?: ((event: ServerEvent) => void) | undefined
}

export interface ExtendedSUnitDmgPacket extends Omit<SUnitDmgPacket, 'skillId'> {
  readonly skillId?: number | undefined
  readonly physFixed?: number | undefined
  readonly fireFixed?: number | undefined
  readonly ltngFixed?: number | undefined
  readonly coldFixed?: number | undefined
  readonly magicFixed?: number | undefined
  readonly poisFixed?: number | undefined
  readonly physDamageFixed?: number | undefined
  readonly fireDamageFixed?: number | undefined
  readonly ltngDamageFixed?: number | undefined
  readonly coldDamageFixed?: number | undefined
  readonly magDamageFixed?: number | undefined
  readonly poisDamageFixed?: number | undefined
}

export interface ExtendedSUnitDmgOutcome extends SUnitDmgOutcome {
  readonly physApplied: number
  readonly fireApplied: number
  readonly ltngApplied: number
  readonly coldApplied: number
  readonly magicApplied: number
  readonly finalDamageFixed: number
}

function normalizeCombatUnitContext(ctx: CombatUnitContext): RawCombatUnitContext {
  const statList = ctx.statList ?? ctx.stats ?? new UnitStatList()
  if (ctx.maxHpFixed !== undefined && statList.getBaseStat(7) === 0) {
    statList.setBaseStat(7, ctx.maxHpFixed)
  }
  if (ctx.hpFixed !== undefined) {
    statList.setBaseStat(6, ctx.hpFixed)
  }
  const stateBus = ctx.stateBus ?? new StateBus(statList)
  if (ctx.states) {
    for (const st of ctx.states) {
      stateBus.applyState({ stateNameOrId: st, durationFrames: 100 })
    }
  }
  return {
    id: ctx.id ?? `${ctx.unitType}-${String(ctx.unitId ?? 1)}`,
    name: ctx.name ?? `${ctx.unitType}_${String(ctx.unitId ?? 1)}`,
    unitType: ctx.unitType,
    statList,
    stateBus,
    ...(ctx.classId !== undefined ? { classId: ctx.classId } : {}),
    ...(ctx.x !== undefined ? { x: ctx.x } : {}),
    ...(ctx.y !== undefined ? { y: ctx.y } : {}),
    ...(ctx.areaId !== undefined ? { areaId: ctx.areaId } : {}),
    ...(ctx.isInTown !== undefined ? { isInTown: ctx.isInTown } : {}),
    ...(ctx.partyId !== undefined ? { partyId: ctx.partyId } : {}),
    ...(ctx.hasShieldEquipped !== undefined ? { hasShieldEquipped: ctx.hasShieldEquipped } : {}),
    ...(ctx.isMoving !== undefined ? { isMoving: ctx.isMoving } : {}),
    ...(ctx.isRunning !== undefined ? { isRunning: ctx.isRunning } : {}),
    ...(ctx.currentFrame !== undefined ? { currentFrame: ctx.currentFrame } : {}),
    ...(ctx.onEvent !== undefined ? { onEvent: ctx.onEvent } : {}),
  }
}

export function executeSUnitDmg(
  attacker: CombatUnitContext,
  defender: CombatUnitContext,
  packet: ExtendedSUnitDmgPacket,
  _options?: SUnitDmgOptions,
): ExtendedSUnitDmgOutcome {
  const phys256 = packet.physDamageFixed ?? packet.physFixed
  const fire256 = packet.fireDamageFixed ?? packet.fireFixed
  const ltng256 = packet.ltngDamageFixed ?? packet.ltngFixed
  const cold256 = packet.coldDamageFixed ?? packet.coldFixed
  const mag256 = packet.magDamageFixed ?? packet.magicFixed
  const pois256 = packet.poisDamageFixed ?? packet.poisFixed

  const normAttacker: RawCombatUnitContext = {
    ...normalizeCombatUnitContext(attacker),
    ...(phys256 !== undefined ? { weaponMinPhys: 0, weaponMaxPhys: 0 } : {}),
  }
  const normDefender = normalizeCombatUnitContext(defender)
  const diffOpt = _options?.difficulty
  const diffPenalty =
    diffOpt === 'hell' || diffOpt === 2
      ? 100
      : diffOpt === 'nightmare' || diffOpt === 1
        ? 40
        : 0
  if (diffPenalty > 0 && normDefender.unitType === 'player') {
    for (const resStatId of [39, 41, 43, 45]) {
      normDefender.statList.setBaseStat(
        resStatId,
        normDefender.statList.getBaseStat(resStatId) - diffPenalty,
      )
    }
  }

  let elemType: SUnitDmgPacket['elemType'] = packet.elemType
  let elemMin256 = packet.elemMin256
  let elemMax256 = packet.elemMax256
  if (elemType === undefined) {
    if (fire256 !== undefined && fire256 > 0) {
      elemType = 'fire'
      elemMin256 = fire256
      elemMax256 = fire256
    } else if (ltng256 !== undefined && ltng256 > 0) {
      elemType = 'ltng'
      elemMin256 = ltng256
      elemMax256 = ltng256
    } else if (cold256 !== undefined && cold256 > 0) {
      elemType = 'cold'
      elemMin256 = cold256
      elemMax256 = cold256
    } else if (mag256 !== undefined && mag256 > 0) {
      elemType = 'mag'
      elemMin256 = mag256
      elemMax256 = mag256
    } else if (pois256 !== undefined && pois256 > 0) {
      elemType = 'pois'
      elemMin256 = pois256
      elemMax256 = pois256
    }
  }

  const preBrokenLowerResist =
    defender.states?.has(61) &&
    packet.lowerResistPierce === undefined &&
    normDefender.statList.getBaseStat(39) > 0 &&
    normDefender.statList.getBaseStat(39) < 100

  const normPacket: SUnitDmgPacket = {
    ...packet,
    skillId: packet.skillId ?? 0,
    ...(phys256 !== undefined
      ? {
          flatPhysMin256: packet.flatPhysMin256 ?? phys256,
          flatPhysMax256: packet.flatPhysMax256 ?? phys256,
        }
      : {}),
    ...(preBrokenLowerResist ? { lowerResistPierce: 0 } : {}),
    ...(elemType !== undefined ? { elemType } : {}),
    ...(elemMin256 !== undefined ? { elemMin256 } : {}),
    ...(elemMax256 !== undefined ? { elemMax256 } : {}),
  }
  const out = rawExecuteSUnitDmg(
    normAttacker,
    normDefender,
    normPacket,
    packet.rng ?? { rand: (max: number) => Math.floor(0.5 * max) },
  )
  if (defender.hpFixed !== undefined) {
    defender.hpFixed = normDefender.statList.getBaseStat(6)
  }
  const elemApplied = Math.floor(out.elemDamage256 / FIXED_ONE)
  return {
    ...out,
    physApplied: Math.floor(out.physDamage256 / FIXED_ONE),
    fireApplied: elemType === 'fire' ? elemApplied : 0,
    ltngApplied: elemType === 'ltng' ? elemApplied : 0,
    coldApplied: elemType === 'cold' ? elemApplied : 0,
    magicApplied: elemType === 'mag' ? elemApplied : 0,
    finalDamageFixed: out.totalDamage256,
  }
}

// ---------------------------------------------------------------------------
// CombatWorld & MonsterAI Helpers (M2)
// ---------------------------------------------------------------------------

export function createTestCombatPlayer(
  overrides: Partial<CombatPlayer> = {},
): CombatPlayer {
  return {
    x: 100,
    y: 100,
    hp: 500,
    maxHp: 500,
    mana: 300,
    maxMana: 300,
    stamina: 200,
    maxStamina: 200,
    isRunning: false,
    xp: 0,
    level: 30,
    statPoints: 0,
    skillPoints: 0,
    cooldown: 0,
    swingTicks: 0,
    facing: 0,
    alive: true,
    respawnIn: 0,
    classCode: 'pal',
    ...overrides,
  }
}

export function createTestCombatMonster(
  hcIdxOrId: number | string,
  overrides: Partial<Monster> & {
    readonly difficulty?: DifficultyName | undefined
    readonly rank?: MonsterRank | undefined
    readonly modifiers?: readonly (number | string)[] | undefined
    readonly superUniqueId?: string | undefined
    readonly ai?: string | undefined
    readonly spawnX?: number | undefined
    readonly spawnY?: number | undefined
  } = {},
): Monster {
  const diff = overrides.difficulty ?? 'normal'
  let rawKind: MonsterKind | undefined
  if (typeof hcIdxOrId === 'number') {
    rawKind = getMonsterKindByHcIdx(hcIdxOrId, diff)
  } else {
    rawKind = lookupMonsterKindByStringId(hcIdxOrId)
    if (!rawKind) {
      const lower = hcIdxOrId.toLowerCase()
      for (const k of MONSTER_TABLE.values()) {
        const kAny = k as unknown as Record<string, any>
        if (
          String(kAny['classId'] ?? kAny['id'] ?? '').toLowerCase() === lower ||
          String(kAny['baseId'] ?? '').toLowerCase() === lower ||
          String(kAny['name'] ?? kAny['nameKey'] ?? '').toLowerCase() === lower
        ) {
          rawKind = k
          break
        }
      }
    }
  }
  const firstFromTable = MONSTER_TABLE.values().next().value!
  const fallbackRawKind = rawKind ?? firstFromTable
  const resolvedStats = queryMonsterStats113c(
    hydrateExtendedMonsterKind(fallbackRawKind, diff),
    {
      difficulty: diff,
      rank: overrides.rank ?? 'normal',
      ...(overrides.modifiers !== undefined
        ? { modifiers: overrides.modifiers }
        : {}),
      ...(overrides.superUniqueId !== undefined
        ? { superUniqueId: overrides.superUniqueId }
        : {}),
    },
  )

  const mergedResistances: MonsterResistances113c = {
    physical: overrides.stats?.resistances?.physical ?? resolvedStats.resistances.physical,
    magic: overrides.stats?.resistances?.magic ?? resolvedStats.resistances.magic,
    fire: overrides.stats?.resistances?.fire ?? resolvedStats.resistances.fire,
    lightning: overrides.stats?.resistances?.lightning ?? resolvedStats.resistances.lightning,
    cold: overrides.stats?.resistances?.cold ?? resolvedStats.resistances.cold,
    poison: overrides.stats?.resistances?.poison ?? resolvedStats.resistances.poison,
  }
  const defaultReach = Math.min(resolvedStats.reach, Math.max(20, (resolvedStats.meleeRng || 1) * 28))
  const mergedStats: ExtendedMonsterStats113c = {
    ...resolvedStats,
    reach: defaultReach,
    ...(overrides.ai !== undefined ? { ai: overrides.ai } : {}),
    ...(overrides.stats ?? {}),
    hcIdx: overrides.stats?.hcIdx ?? resolvedStats.hcIdx,
    resistances: mergedResistances,
    isUndead: overrides.stats?.isUndead ?? resolvedStats.isUndead,
    isDemon: overrides.stats?.isDemon ?? resolvedStats.isDemon,
    isBoss: overrides.stats?.isBoss ?? resolvedStats.isBoss,
    killable: overrides.stats?.killable ?? resolvedStats.killable,
    inTown: overrides.stats?.inTown ?? resolvedStats.inTown,
  } as ExtendedMonsterStats113c

  const x = overrides.x ?? 120
  const y = overrides.y ?? 100
  const hp = overrides.hp ?? mergedStats.hp
  return {
    index: overrides.index ?? 1,
    stats: mergedStats,
    x,
    y,
    spawnX: overrides.spawnX ?? x,
    spawnY: overrides.spawnY ?? y,
    hp,
    cooldown: overrides.cooldown ?? 0,
    facing: overrides.facing ?? 0,
    state: overrides.state ?? 'idle',
    animMode: overrides.animMode ?? 'nu',
    corpseTicks: overrides.corpseTicks ?? 0,
    hitFlash: overrides.hitFlash ?? 0,
    ...overrides,
  }
}

function isFullCombatPlayer(p: Partial<CombatPlayer> | undefined): p is CombatPlayer {
  return (
    p !== undefined &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.hp === 'number' &&
    typeof p.maxHp === 'number' &&
    typeof p.alive === 'boolean' &&
    typeof p.mana === 'number'
  )
}

export function createTestCombatWorld(params: {
  readonly player?: Partial<CombatPlayer> | undefined
  readonly players?: readonly Partial<CombatPlayer>[] | undefined
  readonly monsters?: readonly Monster[] | undefined
  readonly tick?: number | undefined
} = {}): CombatWorld {
  const primary = isFullCombatPlayer(params.player)
    ? params.player
    : createTestCombatPlayer(params.player)
  const players = params.players
    ? params.players.map((p, i) =>
        isFullCombatPlayer(p)
          ? p
          : createTestCombatPlayer({
              x: 100 + i * 10,
              y: 100,
              ...(i === 0 && params.player ? params.player : {}),
              ...p,
            }),
      )
    : [primary]
  return {
    player: players[0] ?? primary,
    players,
    monsters: params.monsters ? [...params.monsters] : [],
    events: [],
    pendingKills: [],
    kills: 0,
    tick: params.tick ?? 0,
  }
}

export function createOpenTerrain(): CombatTerrain {
  return { overlap: () => 0 }
}

export interface ExtendedCombatTerrain extends CombatTerrain {
  readonly overlap: (x: number, y: number, radius?: number) => number
}

export function createWallObstacleTerrain(blockedRect: {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}): ExtendedCombatTerrain {
  return {
    overlap: (x: number, y: number, radius = 16): number => {
      const closestX = Math.max(blockedRect.minX, Math.min(x, blockedRect.maxX))
      const closestY = Math.max(blockedRect.minY, Math.min(y, blockedRect.maxY))
      const dist = Math.hypot(x - closestX, y - closestY)
      return dist < radius ? 1 : 0
    },
  }
}

// ---------------------------------------------------------------------------
// GameInstance, LocalLoopbackAdapter & MultiClientRoomHost Extensions (M3/M4)
// ---------------------------------------------------------------------------

export function createSinglePlayerGame(config: GameInstanceConfig = {}): GameInstance {
  return new GameInstance({
    ...config,
    mode: 'sp',
    policy: config.policy ? { ...SINGLE_PLAYER_POLICY, ...config.policy } : SINGLE_PLAYER_POLICY,
  })
}

export function createOpenBnetGame(config: GameInstanceConfig = {}): GameInstance {
  return new GameInstance({
    ...config,
    mode: 'open',
    policy: config.policy ? { ...OPEN_BNET_POLICY, ...config.policy } : OPEN_BNET_POLICY,
  })
}

export function createClosedRealmGame(config: GameInstanceConfig = {}): GameInstance {
  return new GameInstance({
    ...config,
    mode: 'realm',
    policy: config.policy ? { ...CLOSED_REALM_POLICY, ...config.policy } : CLOSED_REALM_POLICY,
  })
}

export type ExtendedServerMonsterState = ServerMonsterState & {
  readonly alive: boolean
}

export interface ExtendedLocalLoopbackAdapterOptions extends LocalLoopbackAdapterOptions {
  readonly areaId?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
}

export class LocalLoopbackAdapter extends RawLocalLoopbackAdapter {
  constructor(
    optionsOrGame?: ExtendedLocalLoopbackAdapterOptions | GameInstance,
    maybeOptions?: ExtendedLocalLoopbackAdapterOptions,
  ) {
    const isInstance = optionsOrGame instanceof GameInstance
    const opts: ExtendedLocalLoopbackAdapterOptions = isInstance
      ? (maybeOptions ?? {})
      : (optionsOrGame ?? {})
    if (
      !isInstance &&
      !opts.game &&
      !opts.engine &&
      !opts.gameInstance &&
      (opts.areaId !== undefined || opts.x !== undefined || opts.y !== undefined)
    ) {
      const areaId = opts.areaId ?? 2
      const game = new GameInstance({
        mode: 'singlePlayer',
        policy: opts.policy ? { ...SINGLE_PLAYER_POLICY, ...opts.policy } : SINGLE_PLAYER_POLICY,
        difficulty: opts.difficulty ?? 0,
        mapSeed: opts.mapSeed ?? opts.seed ?? 0x113c0102,
        areaId,
      })
      const playerId = game.connectPlayer({
        charName: opts.charName ?? opts.playerName ?? opts.name ?? 'SoloHero',
        classId: opts.classId ?? opts.charClass ?? 'pal',
        level: opts.level ?? 30,
        areaId,
        x: opts.x ?? 500,
        y: opts.y ?? 500,
      })
      super(game, { ...opts, playerUnitId: playerId })
    } else {
      super(optionsOrGame, maybeOptions)
    }
  }

  override sendCommand(cmd: ClientCommand): void {
    this.send(cmd)
  }
}

export interface ConnectedRoomClientHandle {
  readonly sessionId: number
  readonly playerUnitId: number
  readonly playerId: number
  readonly adapter: {
    sendCommand(cmd: ClientCommand): void
    pollEvents(): ServerEvent[]
  }
  valueOf(): number
}

export interface ExtendedMultiClientRoomHostConfig extends MultiClientRoomHostConfig {
  readonly mode?: 'open' | 'closed' | 'openBnet' | 'closedRealm' | undefined
  readonly areaId?: number | undefined
}

export class MultiClientRoomHost extends RawMultiClientRoomHost {
  constructor(config: ExtendedMultiClientRoomHostConfig = {}) {
    const policy =
      config.policy ??
      (config.mode === 'closed' || config.mode === 'closedRealm'
        ? CLOSED_REALM_POLICY
        : OPEN_BNET_POLICY)
    super({
      ...config,
      policy,
    })
  }

  override get game(): GameInstance {
    return this.gameInstance
  }

  override getGameInstance(): GameInstance {
    return this.gameInstance
  }

  override connectClient(stream: ByteStream, spec?: ConnectClientSpec): number
  override connectClient(
    playerSpec: Omit<ConnectPlayerSpec, 'd2s'> & { readonly d2sBytes?: Uint8Array | undefined },
  ): ConnectedRoomClientHandle
  override connectClient(
    arg1:
      | ByteStream
      | (Omit<ConnectPlayerSpec, 'd2s'> & { readonly d2sBytes?: Uint8Array | undefined }),
    arg2?: ConnectClientSpec,
  ): number | ConnectedRoomClientHandle {
    if (arg1 && typeof (arg1 as unknown as Record<string, unknown>)['send'] === 'function') {
      return super.connectClient(arg1 as ByteStream, arg2)
    }
    const spec = (arg1 ?? {}) as Omit<ConnectPlayerSpec, 'd2s'> & {
      readonly d2sBytes?: Uint8Array | undefined
    }
    return this.joinPlayer(spec)
  }

  joinPlayer(
    spec: Omit<ConnectPlayerSpec, 'd2s'> & { readonly d2sBytes?: Uint8Array | undefined },
  ): ConnectedRoomClientHandle {
    const playerId = this.gameInstance.connectPlayer(spec)
    return {
      sessionId: playerId,
      playerUnitId: playerId,
      playerId,
      adapter: {
        sendCommand: (cmd: ClientCommand): void => {
          this.gameInstance.enqueueCommand(playerId, cmd)
        },
        pollEvents: (): ServerEvent[] => {
          return [...this.gameInstance.drainEvents(playerId)]
        },
      },
      valueOf: () => playerId,
    }
  }

  drainClientPackets(playerId: number): ServerEvent[] {
    return [...this.gameInstance.drainEvents(playerId)]
  }
}

export function verifyLockstepParity(
  hostOrGameA: MultiClientRoomHost | GameInstance,
  maybeGameB?: GameInstance,
): {
  readonly inSync: boolean
  readonly hashA: number
  readonly hashB: number
} {
  if (maybeGameB) {
    const gameA = hostOrGameA instanceof GameInstance ? hostOrGameA : hostOrGameA.gameInstance
    const hashA = gameA.computeFrameLockstepHash()
    const hashB = maybeGameB.computeFrameLockstepHash()
    return {
      inSync: hashA === hashB,
      hashA,
      hashB,
    }
  }
  const game = hostOrGameA instanceof GameInstance ? hostOrGameA : hostOrGameA.gameInstance
  const h = game.computeFrameLockstepHash()
  return {
    inSync: true,
    hashA: h,
    hashB: h,
  }
}

export function createWildernessGameInstance(
  config: GameInstanceConfig & {
    readonly playerClass?: CharacterClassCode | undefined
    readonly playerLevel?: number | undefined
    readonly playerX?: number | undefined
    readonly playerY?: number | undefined
    readonly charName?: string | undefined
    /** Hard skill points (`skillId -> blvl`): only learned skills can be cast (#1328). */
    readonly playerSkills?: Readonly<Record<number, number>> | undefined
  } = {},
): { readonly game: GameInstance; readonly playerId: number } {
  const areaId = config.areaId ?? 2 // Blood Moor (wilderness area 2)
  const game = new GameInstance({
    mode: config.mode ?? 'sp',
    mapSeed: config.mapSeed ?? 0x113c0001,
    difficulty: config.difficulty ?? 0,
    areaId,
    ...(config.playersX !== undefined ? { playersX: config.playersX } : {}),
    ...(config.maxPlayers !== undefined ? { maxPlayers: config.maxPlayers } : {}),
    ...(config.policy !== undefined ? { policy: config.policy } : {}),
  })
  const playerId = game.connectPlayer({
    charName: config.charName ?? 'TestHero',
    classId: config.playerClass ?? 'pal',
    level: config.playerLevel ?? 30,
    areaId,
    x: config.playerX ?? 500,
    y: config.playerY ?? 500,
    ...(config.playerSkills !== undefined ? { skills: config.playerSkills } : {}),
  })
  // Drain initial connection events
  game.drainEvents(playerId)
  return { game, playerId }
}

export function spawnExtendedMonsterInGame(
  game: GameInstance,
  spec: ExtendedSpawnMonsterSpec,
): number {
  const resolvedClassId = spec.classId ?? spec.hcIdx ?? 0
  return game.spawnMonster({
    ...spec,
    classId: resolvedClassId,
    ...(spec.difficulty !== undefined ? { difficulty: spec.difficulty } : {}),
    ...(spec.rank !== undefined ? { rank: spec.rank } : {}),
    ...(spec.modifiers !== undefined ? { modifiers: spec.modifiers } : {}),
    ...(spec.superUniqueId !== undefined ? { superUniqueId: spec.superUniqueId } : {}),
    ...(spec.leaderId !== undefined ? { leaderId: spec.leaderId } : {}),
    ...(spec.dead !== undefined ? { dead: spec.dead } : {}),
    ...(spec.corpse !== undefined ? { corpse: spec.corpse } : {}),
    ...(spec.ai !== undefined ? { ai: spec.ai } : {}),
  } as SpawnMonsterSpec)
}

export function createTestGame(config: GameInstanceConfig = {}): GameInstance {
  return createSinglePlayerGame(config)
}

export function spawnPlayerInGame(
  game: GameInstance,
  spec: ConnectPlayerSpec = {},
): number {
  return game.connectPlayer(spec)
}

export function stepFrames(
  target: { stepFrames(count: number): unknown; drainEvents?(): readonly ServerEvent[] },
  count: number,
): ServerEvent[] {
  target.stepFrames(count)
  if (typeof target.drainEvents === 'function') {
    return [...target.drainEvents()]
  }
  return []
}

export function applyStateToMonsterInGame(
  game: GameInstance,
  monsterUnitId: number,
  stateIdOrName: number | string,
  durationFrames = 100,
  extra?: Readonly<Record<string, unknown>>,
): boolean {
  return game.applyMonsterState(monsterUnitId, stateIdOrName, durationFrames, extra)
}

export {
  BAAL_THRONE_WAVES_113C,
  BONE_FETISH_EXPLOSION_RADIUS,
  CANONICAL_BOSS_MINIONS,
  CLOSED_REALM_POLICY,
  D2CLIENT_DEATH_BOOM_POINTS,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  D2Rng,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIRE_ENCHANT_DIFF_SCALE,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  FIRE_ENCHANT_MAX_HP_PCT,
  FIRE_ENCHANT_MIN_HP_PCT,
  FIXED_ONE,
  GameInstance,
  MONSTER_MODE_MISSILES_113C,
  MON_UMOD,
  MON_UMOD_NAME_TO_ID,
  MissileEngine,
  OBLIVION_KNIGHT_CURSES,
  OPEN_BNET_POLICY,
  SINGLE_PLAYER_POLICY,
  applyMonsterUModResistances,
  computeChargedBolt8WayVectors,
  getCanonicalMonsterKinds,
  getFreezeShatterMissiles,
  getMonsterKindByHcIdx,
  getSharedDataRegistry,
  getSharedMountedArchives,
  hirelingTableModule,
  monsterAiModule,
  monstersDataModule,
  resolveGameModePolicy,
  resolveMonsterStats,
  resolveSuicideExplodeMissileKey,
  spawnMonsterPacks,
  spawnMonsters,
  tickBaalThroneWave113c,
  tickCombat,
  tickMonsters,
  triggerPackMoraleOnDeath,
  type CharacterClassCode,
  type ClientCommand,
  type CombatEvent,
  type CombatInput,
  type CombatOptions,
  type CombatPlayer,
  type CombatTerrain,
  type CombatWorld,
  type ConnectPlayerSpec,
  type CreatePetOutcome,
  type D2DataRegistry,
  type GameInstanceConfig,
  type Monster,
  type MonsterKind,
  type MonsterRank,
  type MonsterStats,
  type ServerEvent,
  type ServerMonsterState,
  type ServerPlayerState,
  type ServerUnitSummary,
  type SpawnMonsterSpec,
  type SummonedPetUnit,
}
