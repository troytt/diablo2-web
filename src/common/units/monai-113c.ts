/**
 * MonAi.txt profile table for Diablo II 1.13c.
 *
 * `MonStats.AI` points at a `MonAi.txt` row. D2Game dispatched those 148 rows
 * through the function table at `D2Game.dll` VA `0x6FD274A8` (documented in
 * `kb/monsters/d2game-monai-dispatch-table-113c.md`). This module is the single
 * source of truth for:
 *
 * - which behavior family a row belongs to;
 * - which `aip1..aip8` slot holds each semantic value (0-based indexes);
 * - per-row gates such as Bighead's healthy/hurt fire chances.
 *
 * Both `GameInstance.stepMonsterAi` and the legacy `GameEngine` harness read
 * these descriptors, so the row-to-behavior mapping and parameter layout are
 * defined exactly once.
 */
import { MONAI_113C_ROWS } from './monstats-113c-data.ts'

export type MonAiFamily =
  | 'melee'
  | 'ranged'
  | 'resurrector'
  | 'curse'
  | 'flee'
  | 'stationary'
  | 'suicide'
  | 'spawner'
  | 'charger'
  | 'kiter'
  | 'leaper'
  | 'boss'

/** 0-based `aip` indexes. `aip1` is index 0. */
export const MONAI_AIP_113C = {
  aip1: 0,
  aip2: 1,
  aip3: 2,
  aip4: 3,
  aip5: 4,
  aip6: 5,
  aip7: 6,
  aip8: 7,
} as const

export interface MonAiCharge113c {
  readonly minDistance: number
  readonly maxDistance: number
  /** 0-based `aip` slot holding the charge/stall delay. */
  readonly delayParam?: number | undefined
  readonly fixedDelayFrames?: number | undefined
  readonly speedMultiplier?: number | undefined
}

export interface MonAiFireGate113c {
  /** `aip` slot holding the hurt-percentage threshold. */
  readonly hurtParam: number
  /** `aip` slot holding the fire chance above the threshold (0 = never). */
  readonly healthyChanceParam: number
  /** `aip` slot holding the fire chance below the threshold. */
  readonly hurtChanceParam: number
}

export interface MonAiSpawn113c {
  readonly child: string
  /** 0-based `aip` slot with the maximum live children. */
  readonly maxParam: number
  /** 0-based `aip` slot with the batch size per spawn action. */
  readonly batchParam: number
  /** 0-based `aip` slot with the spawn interval in frames. */
  readonly intervalParam: number
  /** Optional fixed batch size when `MonStats.txt` does not store batch count in an `aip` slot. */
  readonly fixedBatch?: number | undefined
}

export interface MonAiProfile113c {
  readonly index: number
  readonly name: string
  readonly family: MonAiFamily
  /** Uses the MissA1/A2/S1/C missile columns for a ranged attack. */
  readonly ranged: boolean
  /** Casts the 1.13c curse pool. */
  readonly curse: boolean
  /** Resurrects corpses of its own race / undead. */
  readonly resurrect: boolean
  /** Detonates on contact. */
  readonly suicide: boolean
  /** 0-based `aip` slot with the shoot/cast distance. */
  readonly shootDistanceParam?: number | undefined
  readonly fireGate?: MonAiFireGate113c | undefined
  /** 0-based `aip` slot with the distance to keep from the target. */
  readonly kiteDistanceParam?: number | undefined
  readonly charge?: MonAiCharge113c | undefined
  readonly leap?: MonAiCharge113c | undefined
  readonly hurtRetreat?:
    | { readonly hurtParam: number; readonly distanceParam: number }
    | undefined
  readonly spawn?: MonAiSpawn113c | undefined
  readonly drain?: 'life' | 'mana' | 'stamina' | undefined
  /** 0-based `aip` slot describing the target hurt% that this AI prefers. */
  readonly woundedTargetParam?: number | undefined
  readonly frenzy?:
    | { readonly thresholdParam: number; readonly speedParam: number; readonly consecutiveParam: number }
    | undefined
  /** 0-based `aip` slot with the heal radius. */
  readonly healRangeParam?: number | undefined
  /** 0-based `aip` slot with the corpse resurrection percentage chance (`rand(100) < aip[slot]`). */
  readonly resurrectChanceParam?: number | undefined
  /** 0-based `aip` slot with the maximum cast distance before walking closer to the corpse (`FetishShaman` `aip3`). */
  readonly resurrectCastRangeParam?: number | undefined
  /** 0-based `aip` slot with the corpse resurrection search radius. */
  readonly resurrectRangeParam?: number | undefined
  /** Whip/rally aura used by Overseer. */
  readonly whip?: boolean | undefined
  readonly boss?: boolean | undefined
}

type ProfileOverride = Partial<Omit<MonAiProfile113c, 'index' | 'name' | 'family'>> & {
  readonly family?: MonAiFamily
}

const overrides = new Map<string, ProfileOverride>()
const add = (names: readonly string[], override: ProfileOverride): void => {
  for (const name of names) {
    const key = name.trim().toLowerCase().replace(/[\s_-]/g, '')
    overrides.set(key, { ...overrides.get(key), ...override })
  }
}

// ---------------------------------------------------------------------------
// Stationary rows: NPCs, eggs, nests, traps and turrets.
// ---------------------------------------------------------------------------
add(
  [
    'None',
    'Idle',
    'NpcOutOfTown',
    'Npc',
    'Towner',
    'Vendor',
    'NpcStationary',
    'Hireable',
    'TownRogue',
    'GoodNpcRanged',
    'NpcBarb',
    'Navi',
    'MaggotEgg',
    'Sarcophagus',
    'BoneWall',
    'EvilHole',
    'InvisoSpawner',
    'MinionSpawner',
    'GenericSpawner',
    'AncientStatue',
    'Totem',
    'Vines',
    'CycleOfLife',
    'InvisoPet',
    'GargoyleTrap',
    'Trap-Missile',
    'Trap-RightArrow',
    'Trap-LeftArrow',
    'Trap-Poison',
    'Trap-Nova',
    'Trap-Melee',
    'Hydra',
    'ArcaneTower',
    'DesertTurret',
    'AssassinSentry',
    'DeathSentry',
    'BladeCreeper',
    '7TIllusion',
    'JarJar',
    'DarkWanderer',
    'Spirit',
    'TrappedSoul',
    'Buffy',
    'BaalTaunt',
    'BaalTentacle',
  ],
  { family: 'stationary' },
)

// ---------------------------------------------------------------------------
// Movement / attack families.
// ---------------------------------------------------------------------------
add(['FallenShaman', 'GreaterMummy', 'FetishShaman'], {
  family: 'resurrector',
  resurrect: true,
})
add(['FallenShaman'], {
  ranged: true,
  shootDistanceParam: 4,
  resurrectChanceParam: 0,
  resurrectRangeParam: 3,
})
add(['GreaterMummy'], {
  ranged: true,
  shootDistanceParam: 3,
  resurrectChanceParam: 1,
  resurrectRangeParam: 4,
  healRangeParam: 4,
})
// 1.13c D2Game.dll 0x6FCA7BB0 (AITHINK_Fn053_FetishShaman): FetishShaman has no heal branch;
// aip1 (40..45) is resurrect %, aip3 (15..22) is max resurrect cast distance before approaching,
// and aip5 (50) is corpse resurrection scan radius (#1990, #1992).
add(['FetishShaman'], {
  resurrectChanceParam: 0,
  resurrectCastRangeParam: 2,
  resurrectRangeParam: 4,
})

// 1.13c D2Game.dll 0x6FCD5950: only OblivionKnight uses MonCurseCast AI (#1822),
// and casts #182 Bestow to heal wounded allies (#1896).
add(['OblivionKnight'], {
  family: 'curse',
  curse: true,
  healRangeParam: 7,
})

add(['Fallen', 'Fetish', 'Wussie'], { family: 'flee' })
add(['SuicideMinion'], { family: 'suicide', suicide: true })

add(['Bighead'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 0,
  fireGate: { hurtParam: 0, healthyChanceParam: 2, hurtChanceParam: 3 },
})
add(['QuillRat'], { family: 'ranged', ranged: true, shootDistanceParam: 0 })
add(['QuillMother'], { family: 'ranged', ranged: true, shootDistanceParam: 0 })
add(['SandMaggot'], { family: 'ranged', ranged: true, shootDistanceParam: 1 })
add(['Vulture'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 4,
  woundedTargetParam: 2,
})
add(['Mosquito'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 4,
  drain: 'life',
})
// 1.13c `AITHINK_Fn025_WillOWisp` (`D2Game.dll` `0x6FCA0F20..0x6FCA1C6F`, #2012):
// Never calls `CastSkill` (`Skill1 = #53 Chain Lightning` is unused by WillOWisp AI);
// rolls `rand(100) < aip1` (`40..75%`, unconditional on HP) up to `aip3` (`30..50` sub-tiles)
// to fire `MissC` (`#320 willowisplightningbolt` / `#666 willowisplightningbolt2`).
add(['WillOWisp'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 2,
  fireGate: { hurtParam: 0, healthyChanceParam: 0, hurtChanceParam: 0 },
  drain: 'mana',
})
add(['Arach'], {
  family: 'ranged',
  ranged: false,
  shootDistanceParam: 3,
  hurtRetreat: { hurtParam: 4, distanceParam: 3 },
})
add(['PinHead'], { family: 'ranged', ranged: true, shootDistanceParam: 3 })
add(['ZakarumPriest'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 3,
  healRangeParam: 3,
})
// 1.13c `AITHINK_Fn085_HighPriest` (`0x6FC39080..0x6FC39638`) + `MONMODE_IsMoveableMode` (`0x6FC94F20`) +
// `MONMODE_ExecuteEvent` (`0x6FC95DFE`, `#2004`): `councilmember1..3` (`#345..347`) and `baalhighpriest` (`#557`)
// have `RangedType = 0`, `mS1 = 1` (`mSm = true`), and `AnimData.d2` `HPS1HTH` `event = 2` (`!= 1`), so `MONMODE_SKILL1`
// never spawns `#343 highpriestlightning`; Council Members fight in melee and cast `#179 ZakarumHeal` / `#62 Hydra`.
add(['HighPriest'], {
  family: 'melee',
  ranged: false,
  healRangeParam: 5,
})
add(['Mephisto'], { family: 'ranged', ranged: true, boss: true })
add(['Andariel'], { family: 'ranged', ranged: true, boss: true })
add(['FrogDemon'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['Izual'], { family: 'ranged', ranged: true, boss: true, shootDistanceParam: 7 })
add(['TentacleHead'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['SkeletonMage'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
// 1.13c `AITHINK_Fn071_Regurgitator` (`#1895`, `#2004`): `regurgitator1..4` (`#307..309, #694`) have `RangedType = 0`
// and fight in melee unless `corpseAmmo > 0` after `#214 RegurgitatorEat` (spitting via `#213 CorpseSpit`).
add(['Regurgitator'], { family: 'melee', ranged: false })
add(['HellMeteor'], { family: 'stationary', ranged: true, shootDistanceParam: 2 })
add(['FetishBlowgun'], {
  family: 'kiter',
  ranged: true,
})
add(['SiegeTower'], { family: 'ranged', ranged: true, shootDistanceParam: 0 })
add(['Imp'], { family: 'ranged', ranged: true })
add(['Catapult'], { family: 'stationary', ranged: true })
add(['Hydra'], { family: 'stationary', ranged: true })
add(['ArcaneTower'], { family: 'stationary', ranged: true })
add(['DesertTurret'], { family: 'stationary', ranged: true })
add(['CatapultSpotter'], { family: 'stationary', ranged: true, shootDistanceParam: 2 })
add(['BloodRaven'], { family: 'ranged', ranged: true, resurrect: true, boss: true })
add(['AbyssKnight'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['Summoner'], { family: 'ranged', ranged: true, boss: true })
add(['Nihlathak'], { family: 'ranged', ranged: true, boss: true })

// Chargers.
add(['SandRaider'], {
  family: 'charger',
  charge: { minDistance: 4, maxDistance: 22, delayParam: 4, speedMultiplier: 2 },
})
add(['ClawViper', 'ClawViperEx'], {
  family: 'charger',
  ranged: true,
  shootDistanceParam: 1,
  charge: { minDistance: 4, maxDistance: 22, delayParam: 4, speedMultiplier: 2 },
})
add(['ClawViperEx'], { shootDistanceParam: 6 })
add(['BloodHawk'], {
  family: 'charger',
  charge: { minDistance: 3, maxDistance: 18, fixedDelayFrames: 60, speedMultiplier: 2 },
})
add(['ReanimatedHorde'], {
  family: 'charger',
  charge: { minDistance: 4, maxDistance: 20, fixedDelayFrames: 90, speedMultiplier: 2 },
})
add(['SiegeBeast'], {
  family: 'charger',
  charge: { minDistance: 4, maxDistance: 20, fixedDelayFrames: 120, speedMultiplier: 2 },
})
add(['Duriel'], {
  family: 'charger',
  charge: { minDistance: 4, maxDistance: 20, fixedDelayFrames: 150, speedMultiplier: 2 },
  boss: true,
})
add(['SandLeaper'], {
  family: 'leaper',
  leap: { minDistance: 3, maxDistance: 15, fixedDelayFrames: 45, speedMultiplier: 2 },
})

// Kiters.
add(['CorruptArcher'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 4,
})
add(['SkeletonBow'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 4,
  kiteDistanceParam: 4,
})
// 1.13c `AITHINK_Fn028_Vampire` (`D2Game.dll` `0x6FCA6900..0x6FCA7000`, `#2007`):
// `vampire1..9` (`#131..135, 695..697, 731`) use `aip1` melee fight-vs-retreat, `aip2` ranged cast gate,
// `aip3` max cast range, `aip4` upgrade chance + `11`-think-tick lockout, and `aip5` spell bitmask (`1|2|4`),
// with melee life drain (`0x6FC95E10`) and `#333 VampireMissile` `SrvHit31` life steal (`0x6FC5A920`).
add(['Vampire'], {
  family: 'ranged',
  ranged: false,
  shootDistanceParam: 3,
  drain: 'life',
})
add(['FingerMage'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 4,
})
add(['Succubus', 'SuccubusWitch'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 3,
})
add(['CorruptLancer'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 4,
})
add(['PantherJavelin'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 5,
})
add(['ZakarumZealot'], { family: 'kiter' })

// Spawners (`#1892`: exact 1.13c `MonStats.txt` `aip1..aip3` slot bindings).
add(['VileMother'], {
  family: 'spawner',
  spawn: { child: 'vilechild1', maxParam: 0, batchParam: 1, intervalParam: 2, fixedBatch: 1 },
})
add(['SandMaggotQueen'], {
  family: 'spawner',
  spawn: { child: 'maggotegg1', maxParam: 0, batchParam: 1, intervalParam: 1, fixedBatch: 1 },
})
add(['FoulCrowNest'], {
  family: 'stationary',
  spawn: { child: 'foulcrow1', maxParam: 2, batchParam: 1, intervalParam: 0, fixedBatch: 1 },
})
add(['MosquitoNest'], {
  family: 'stationary',
  spawn: { child: 'mosquito1', maxParam: 0, batchParam: 1, intervalParam: 2, fixedBatch: 1 },
})
add(['Sarcophagus'], {
  spawn: { child: 'mummy1', maxParam: 2, batchParam: 1, intervalParam: 0, fixedBatch: 1 },
})

// Remaining rows are melee. Listing them explicitly (instead of a fallback)
// keeps a newly added MonAi row from silently inheriting "melee".
add(
  [
    'Skeleton',
    'Zombie',
    'Brute',
    'Wraith',
    'CorruptRogue',
    'Baboon',
    'PantherWoman',
    'Goatman',
    'Scarab',
    'Mummy',
    'ThornHulk',
    'BatDemon',
    'MaggotLarva',
    'ElementalBeast',
    'FlyingScimitar',
    'Diablo',
    'Tentacle',
    'NecroPet',
    'VileDog',
    'Megademon',
    'Griswold',
    'Smith',
    'ShadowWarrior',
    'ShadowMaster',
    'Raven',
    'DruidWolf',
    'DruidBear',
    'Minion',
    'FrozenHorror',
    'BloodLord',
    'DeathMauler',
    'Ancient',
    'BaalThrone',
    'BaalCrab',
    'PutridDefiler',
    'BaalToStairs',
    'BaalCrabClone',
    'BaalMinion',
    'ShadowMasterNoInit',
    'UberIzual',
    'UberBaal',
    'UberMephisto',
    'UberDiablo',
    'Overseer',
    'DoomKnight',
  ],
  { family: 'melee' },
)

add(['ThornHulk'], {
  frenzy: { thresholdParam: 3, speedParam: 4, consecutiveParam: 5 },
})
add(['Overseer'], {
  whip: true,
  healRangeParam: 4,
})
add(['BatDemon'], { drain: 'life' })
add(['Swarm'], { drain: 'stamina' })
add(['BloodLord'], { drain: 'life' })

// Boss flags for rows whose family already implies movement.
add(['Diablo', 'BaalThrone', 'BaalCrab', 'BaalTaunt', 'BaalToStairs', 'BaalTentacle', 'BaalCrabClone', 'BaalMinion'], {
  boss: true,
})
add(['UberIzual', 'UberBaal', 'UberMephisto', 'UberDiablo', 'Ancient', 'Griswold', 'Smith', 'DarkWanderer'], {
  boss: true,
})

function buildProfiles(): Readonly<Record<string, MonAiProfile113c>> {
  const out: Record<string, MonAiProfile113c> = {}
  const missing: string[] = []
  for (const row of MONAI_113C_ROWS) {
    const key = row.ai.trim().toLowerCase().replace(/[\s_-]/g, '')
    const override = overrides.get(key)
    if (override === undefined) {
      missing.push(`${String(row.index)}:${row.ai}`)
      continue
    }
    out[key] = {
      index: row.index,
      name: row.ai,
      family: 'melee',
      ranged: false,
      curse: false,
      resurrect: false,
      suicide: false,
      ...override,
    }
  }
  if (missing.length > 0) {
    throw new Error(`MonAi rows without a profile: ${missing.join(', ')}`)
  }
  return out
}

/** All 148 MonAi rows keyed by the normalized AI name. */
export const MONAI_PROFILES_113C: Readonly<Record<string, MonAiProfile113c>> =
  buildProfiles()

export function normalizeMonAiName113c(ai: string): string {
  return ai.trim().toLowerCase().replace(/[\s_-]/g, '')
}

/**
 * Legacy `MonStats.AI` spellings used by the `GameEngine` harness and older
 * tests. They resolve to the canonical 1.13c `MonAi.txt` row without adding
 * entries to the 148-row table.
 */
const MONAI_ALIASES_113C: Readonly<Record<string, string>> = {
  default: 'none',
  skeletonarcher: 'skeletonbow',
  corruptroguearcher: 'corruptarcher',
  roguearcher: 'corruptarcher',
  goatmanarcher: 'corruptarcher',
  goatarcheer: 'corruptarcher',
  slinger: 'quillrat',
  blowpiper: 'fetishblowgun',
  fetishblow: 'fetishblowgun',
  councilmember: 'highpriest',
  frenzy: 'thornhulk',
  minotaur: 'thornhulk',
  deathlord: 'thornhulk',
  darklord: 'thornhulk',
  bloodhawknest: 'foulcrownest',
  suckernest: 'mosquitonest',
  maggotqueen: 'sandmaggotqueen',
  evilhut: 'evilhole',
  boneprison: 'bonewall',
  townnpc: 'npc',
  cagedwussie: 'wussie',
  nest: 'foulcrownest',
  painworm: 'sandmaggot',
  baal: 'baalcrab',
  baalclone: 'baalcrabclone',
  vileeffigy: 'baalcrabclone',
  diabloclone: 'uberdiablo',
  ancientswhirl: 'ancient',
  ancientwhirl: 'ancient',
  ancientbarb: 'ancient',
  ancientbarb1: 'ancient',
  ancientbarb2: 'ancient',
  ancientbarb3: 'ancient',
  talic: 'ancient',
  madawc: 'ancient',
  korlic: 'ancient',
  statictraps: 'trapnova',
}

function lookupProfile113c(ai: string): MonAiProfile113c | undefined {
  const key = normalizeMonAiName113c(ai)
  return MONAI_PROFILES_113C[key] ?? MONAI_PROFILES_113C[MONAI_ALIASES_113C[key] ?? '']
}

export function monaiProfile113c(ai: string): MonAiProfile113c {
  const profile = lookupProfile113c(ai)
  if (profile === undefined) {
    throw new Error(`MonStats.AI "${ai}" is not present in MonAi.txt`)
  }
  return profile
}

/** Optional lookup for legacy aliases (`Frenzy`, `Minotaur`, ...). */
export function findMonaiProfile113c(ai: string): MonAiProfile113c | undefined {
  return lookupProfile113c(ai)
}

/** Read a semantic `aip` value, returning `fallback` when the slot is unset. */
export function monaiParam113c(
  profile: MonAiProfile113c,
  aiParams: readonly number[],
  index: number | undefined,
  fallback: number,
): number {
  if (index === undefined) return fallback
  const value = aiParams[index]
  return value === undefined || !Number.isFinite(value) ? fallback : value
}

/** 1.13c `Tentacle` body limb (`hcIdx 258..260`, token `TN`). */
export function isTentacleHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return id >= 258 && id <= 260
}

/** 1.13c `BaalTentacle` Festering Appendage (`hcIdx 562..566`, `baaltentacle1..5`, #1826). */
export function isBaalTentacleHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return id >= 562 && id <= 566
}

/** 1.13c `BoneWall` (`hcIdx 344`, `bonewall`) & Diablo `BonePrison` segments (`hcIdx 340..343`, `boneprison1..4`, #1825, #1883). */
export function isBonePrisonMonsterHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return id >= 340 && id <= 344
}

/** 1.13c `TentacleHead` boss (`hcIdx 261..263`, token `TE`). */
export function isTentacleHeadHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return id >= 261 && id <= 263
}

/** 1.13c `FrogDemon` (`hcIdx 247..249`, token `FD`). */
export function isFrogDemonHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return id >= 247 && id <= 249
}

/** 1.13c `SandMaggot` (`68..72, 679, 716`) and `SandMaggotQueen` (`284..288`). */
export function isSandMaggotFamilyHcIdx113c(hcIdx: number): boolean {
  const id = hcIdx | 0
  return (id >= 68 && id <= 72) || id === 679 || id === 716 || (id >= 284 && id <= 288)
}

/**
 * 1.13c monsters using Skill `#176 Submerge` (`MONMODE_SEQUENCE = 14`) / `#180 Emerge` (`MONMODE_SKILL1 = 8`):
 * `FrogDemon` (`247..249`), `Tentacle` (`258..260`), and `TentacleHead` (`261..263`).
 */
export function isSubmergeCapableMonsterHcIdx113c(hcIdx: number): boolean {
  return isFrogDemonHcIdx113c(hcIdx) || isTentacleHcIdx113c(hcIdx) || isTentacleHeadHcIdx113c(hcIdx)
}

/**
 * 1.13c `D2Client.dll` `0x6FAFDA60` / `0x6FAFDBF4`:
 * Monsters whose `MONMODE_SEQUENCE (14)` clamps and freezes on its final sequence step (underwater / burrowed)
 * instead of reverting to `MONMODE_NEUTRAL (1)` when the sequence finishes.
 */
export function shouldFreezeMonsterSequenceAtEnd113c(
  hcIdx: number,
  lastSkillId?: number,
): boolean {
  if (isSubmergeCapableMonsterHcIdx113c(hcIdx)) {
    return true
  }
  if (isSandMaggotFamilyHcIdx113c(hcIdx) && lastSkillId === 162) {
    return true
  }
  return false
}

/**
 * 1.13c `D2Game.dll` `0x6FCD2FA0` & `D2Client.dll` `0x6FB069C0`:
 * Returns true when a monster is in its untargetable / invulnerable submerged or burrowed `MONMODE_SEQUENCE (14)` state
 * (`dwFlags & (UNITFLAG_TARGETABLE | UNITFLAG_CANBEATTACKED | UNITFLAG_ISVALIDTARGET) == 0`).
 */
export function isMonsterSubmergedMode113c(
  hcIdx: number,
  mode: number | undefined,
  lastSkillId?: number,
): boolean {
  if (mode !== 14) return false
  return shouldFreezeMonsterSequenceAtEnd113c(hcIdx, lastSkillId)
}

export interface ResolvedMonPlacePreset113c {
  readonly classId: number
  readonly superUniqueIndex?: number
  readonly companionClassId?: number
  readonly direction?: number
}

/**
 * 1.13c `D2Game.dll` `MONSTER_ResolveMonPlace` (`0x6FC67E6D`, jump tables `0x6FC6821C` / `0x6FC68260` / `0x6FC68284`):
 * Resolves deterministic `MonPlace.txt` preset placements (`presetIndex - (nMonStats + nSuperUniques)` = `0..36`).
 */
export function resolveMonPlacePreset113c(
  monPlaceId: number,
  areaId: number,
): ResolvedMonPlacePreset113c | null {
  switch (monPlaceId | 0) {
    case 4: // navi (Flavie, Cold Plains <-> Blood Moor bridge)
      return { classId: 266 }
    case 5: // bloodraven (Burial Grounds, D2Game.dll 0x6FC67F0E: hcIdx=267, superUnique=-1, #1823)
      return { classId: 267 }
    case 8: // place_maggotqueen (Maggot Lair Level 3)
      return { classId: 284, direction: 8 }
    case 10: // place_tentacle_ns (Act 3 water pools)
    case 11: { // place_tentacle_ew (Act 3 water pools)
      const classId =
        areaId === 76 || areaId === 77 || areaId === 78
          ? 262
          : areaId === 92 || areaId === 93
            ? 263
            : 261
      return {
        classId,
        companionClassId: classId - 3,
        direction: monPlaceId === 10 ? 4 : 0,
      }
    }
    case 17: // place_fallen
      return { classId: 19 }
    case 18: // place_vulture
      return { classId: 58 }
    case 22: // place_fetish
      return { classId: 141 }
    case 23: // place_fetishshaman
      return { classId: 278 }
    case 24: // place_impgroup (D2Game.dll 0x6FC681E0: Bloody Foothills 110 -> 492, else 529)
      return { classId: areaId === 110 ? 492 : 529 }
    case 26: // place_miniongroup (D2Game.dll 0x6FC681D9 -> 453 minion1)
      return { classId: 453 }
    case 29: // place_minion
      return { classId: 453 }
    case 30: // place_siegebeast (Bloody Foothills 110 -> 492 siegebeast1, else 529 imp3)
      return { classId: areaId === 110 ? 492 : 529 }
    case 31: // place_barricadedoor
      return { classId: 522 }
    case 32: // place_evilhut / putriddefiler1
      return { classId: 438 }
    default:
      return null
  }
}

export interface AuraEnchantedEntry113c {
  readonly skillId: number
  readonly name:
    | 'might'
    | 'holyfire'
    | 'blessedaim'
    | 'holyfreeze'
    | 'holyshock'
    | 'fanaticism'
    | 'conviction'
    | 'thorns'
  readonly minMlvl: number
  readonly divisor: number
}

/**
 * 1.13c `D2Game.dll` `MONSTERUNIQUE_UMod30_Aura` (`0x6FC44CD0`) & `gpAuraEnchantedTable` (`0x6FD2E4A0`):
 * Candidate Paladin auras, minimum `mlvl` gates, and `slvl = max(1, floor(mlvl / divisor))` divisors (#1819).
 * Note: Thorns (`#103`) carries `minMlvl = 999` in 1.13c (`0x6FD2E4EC`), disabling it from random rolls.
 */
export const AURA_ENCHANTED_TABLE_113C: readonly AuraEnchantedEntry113c[] = Object.freeze([
  { skillId: 98, name: 'might', minMlvl: 0, divisor: 6 },
  { skillId: 102, name: 'holyfire', minMlvl: 0, divisor: 6 },
  { skillId: 108, name: 'blessedaim', minMlvl: 0, divisor: 5 },
  { skillId: 114, name: 'holyfreeze', minMlvl: 0, divisor: 7 },
  { skillId: 118, name: 'holyshock', minMlvl: 20, divisor: 8 },
  { skillId: 122, name: 'fanaticism', minMlvl: 30, divisor: 8 },
  { skillId: 123, name: 'conviction', minMlvl: 30, divisor: 8 },
  { skillId: 103, name: 'thorns', minMlvl: 999, divisor: 6 },
])

export function resolveMonsterAuraDivisor113c(skillId: number): number {
  switch (skillId | 0) {
    case 108:
      return 5
    case 98:
    case 102:
    case 103:
      return 6
    case 114:
      return 7
    case 118:
    case 122:
    case 123:
      return 8
    default:
      return 6
  }
}

/**
 * Rolls a 1.13c `MonUMod #30` (`Aura Enchanted`) skill ID and `slvl = max(1, floor(mlvl / divisor))` (#1819).
 * `Lord De Seis` (`0x6FC44DA9`) deterministically receives `#122 Fanaticism` at `max(1, floor(mlvl / 8))`.
 */
export function rollAuraEnchanted113c(
  mlvl: number,
  rollSeed: number,
  superUniqueId?: string,
): { readonly auraSkillId: number; readonly auraLevel: number } {
  const safeMlvl = Math.max(1, Math.trunc(mlvl))
  if (superUniqueId !== undefined && superUniqueId.trim().toLowerCase() === 'lord de seis') {
    return {
      auraSkillId: 122,
      auraLevel: Math.max(1, Math.floor(safeMlvl / 8)),
    }
  }
  const eligible = AURA_ENCHANTED_TABLE_113C.filter((entry) => safeMlvl >= entry.minMlvl)
  const chosen = eligible[(rollSeed >>> 0) % eligible.length] ?? AURA_ENCHANTED_TABLE_113C[0]!
  return {
    auraSkillId: chosen.skillId,
    auraLevel: Math.max(1, Math.floor(safeMlvl / chosen.divisor)),
  }
}

/** All Paladin aura skill IDs (`Skills.txt` `#98..#125` with `aura = 1`). */
export const PALADIN_AURA_SKILL_IDS_113C: ReadonlySet<number> = new Set([
  98, 99, 100, 102, 103, 104, 105, 108, 109, 110, 113, 114, 115, 118, 119, 120, 122, 123, 124,
  125,
])

/**
 * 1.13c Innate Boss & Monster Aura Resolver (#1820):
 * - `Uber Mephisto` (`hcIdx = 704`, `D2Game.dll` `0x6FC44DB5`): `#123 Conviction` at `slvl = 20`.
 * - `Uber Duriel` (`hcIdx = 708`, `MonStats.txt` `Skill4 = Holy Freeze`): `#114 Holy Freeze` at `slvl = 14`.
 * - `Duriel` (`hcIdx = 211`, `MonStats.txt` `Skill4 = Holy Freeze`): `#114 Holy Freeze` scaled to `4 / 7 / 10` (Normal / NM / Hell).
 * - Any other `MonStats.txt` row declaring a Paladin aura in `Skill1..Skill8`: mounted automatically on spawn.
 */
export function resolveInnateMonsterAura113c(
  hcIdx: number,
  difficulty: number | 'normal' | 'nightmare' | 'hell' = 0,
  skills?: readonly { readonly skillId?: number | undefined; readonly level: number }[],
): { readonly auraSkillId: number; readonly auraLevel: number } | undefined {
  const id = hcIdx | 0
  const diffIdx =
    difficulty === 2 || difficulty === 'hell'
      ? 2
      : difficulty === 1 || difficulty === 'nightmare'
        ? 1
        : 0
  if (id === 704) {
    return { auraSkillId: 123, auraLevel: 20 }
  }
  if (skills !== undefined) {
    for (const sk of skills) {
      if (sk.skillId !== undefined && PALADIN_AURA_SKILL_IDS_113C.has(sk.skillId)) {
        if (id === 708 && sk.skillId === 114) {
          return { auraSkillId: 114, auraLevel: 14 }
        }
        if (id === 211 && sk.skillId === 114) {
          const base = Math.max(1, Math.trunc(sk.level))
          const auraLevel = base <= 1 ? 4 + diffIdx * 3 : base + diffIdx * 3
          return { auraSkillId: 114, auraLevel }
        }
        return {
          auraSkillId: sk.skillId,
          auraLevel: Math.max(1, Math.trunc(sk.level) + diffIdx * 3),
        }
      }
    }
  }
  if (id === 708) {
    return { auraSkillId: 114, auraLevel: 14 }
  }
  if (id === 211) {
    return { auraSkillId: 114, auraLevel: 4 + diffIdx * 3 }
  }
  return undefined
}

const PASSIVE_MONAI_KEYS_113C: ReadonlySet<string> = new Set([
  'none',
  'idle',
  'npcoutoftown',
  'npc',
  'towner',
  'vendor',
  'npcstationary',
  'townrogue',
  'goodnpcranged',
  'navi',
  'invisospawner',
  'bonewall',
  '7tillusion',
  'jarjar',
  'darkwanderer',
  'buffy',
  'invisopet',
  'ancientstatue',
])

const NON_MELEE_STATIONARY_MONAI_KEYS_113C: ReadonlySet<string> = new Set([
  ...PASSIVE_MONAI_KEYS_113C,
  'hellmeteor',
  'foulcrownest',
  'sarcophagus',
  'maggotegg',
  'gargoyletrap',
  'evilhole',
  'trapmissile',
  'traprightarrow',
  'trapleftarrow',
  'trappoison',
  'mosquitonest',
  'hydra',
  'trapnova',
  'arcanetower',
  'desertturret',
  'trappedsoul',
  'minionspawner',
  'catapult',
  'catapultspotter',
  'genericspawner',
  'baaltaunt',
])

function resolveCanonicalMonAiKey113c(ai: string): string {
  const key = normalizeMonAiName113c(ai)
  return MONAI_ALIASES_113C[key] ?? key
}

/**
 * 1.13c `gpMonsterAiFunctionTable` (`0x6FD2E788`, #2005) passive / controller AIs (`None` `0x6FCBC990`,
 * `Idle` `0x6FCBCB00`, `BoneWall` `0x6FC36410`, `7TIllusion` `0x6FCC4B90`, `DarkWanderer` `0x6FCC6E60`,
 * `AncientStatue` `0x6FCC4F40`, `InvisoSpawner` `0x6FC3BCA0`, `InvisoPet` `0x6FCC5350`, non-combat NPC AIs):
 * never cast hostile skills, never chase targets, and never initiate melee attacks.
 */
export function isPassiveMonsterAi113c(ai: string): boolean {
  return PASSIVE_MONAI_KEYS_113C.has(resolveCanonicalMonAiKey113c(ai))
}

/**
 * 1.13c `gpMonsterAiFunctionTable` (`0x6FD2E788`, #2005) stationary traps, turrets, spawners, spotters,
 * and proximity fidgets that never initiate melee attacks (`Trap-Melee` `0x6FC9BF50` `#354` is intentionally
 * excluded because it is the sole stationary trap AI that strikes adjacent targets in melee).
 */
export function isNonMeleeMonsterAi113c(ai: string): boolean {
  return NON_MELEE_STATIONARY_MONAI_KEYS_113C.has(resolveCanonicalMonAiKey113c(ai))
}
