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
    'Spirit',
    'TrappedSoul',
    'Buffy',
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
add(['FallenShaman'], { ranged: true, shootDistanceParam: 4, resurrectRangeParam: 3 })
add(['GreaterMummy'], { ranged: true, shootDistanceParam: 3, resurrectRangeParam: 4 })
add(['FetishShaman'], { healRangeParam: 4, resurrectRangeParam: 4 })

add(['OblivionKnight', 'DoomKnight', 'AbyssKnight', 'Summoner', 'Nihlathak'], {
  family: 'curse',
  curse: true,
})
add(['Succubus', 'SuccubusWitch', 'FingerMage'], { curse: true })

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
add(['WillOWisp'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 2,
  drain: 'mana',
})
add(['Arach'], {
  family: 'ranged',
  ranged: false,
  shootDistanceParam: 3,
  hurtRetreat: { hurtParam: 4, distanceParam: 3 },
})
add(['PinHead'], { family: 'ranged', ranged: true, shootDistanceParam: 3 })
add(['ZakarumPriest'], { family: 'ranged', ranged: true, shootDistanceParam: 3 })
add(['HighPriest'], {
  family: 'ranged',
  ranged: true,
  shootDistanceParam: 7,
  healRangeParam: 5,
})
add(['Mephisto'], { family: 'ranged', ranged: true, boss: true })
add(['Andariel'], { family: 'ranged', ranged: true, boss: true })
add(['FrogDemon'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['Izual'], { family: 'ranged', ranged: true, boss: true, shootDistanceParam: 7 })
add(['TentacleHead'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['SkeletonMage'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['Regurgitator'], { family: 'ranged', ranged: true, shootDistanceParam: 5 })
add(['HellMeteor'], { family: 'ranged', ranged: true, shootDistanceParam: 2 })
add(['FetishBlowgun'], {
  family: 'kiter',
  ranged: true,
})
add(['SiegeTower'], { family: 'ranged', ranged: true, shootDistanceParam: 0 })
add(['Imp'], { family: 'ranged', ranged: true })
add(['Catapult'], { family: 'stationary', ranged: true })
add(['CatapultSpotter'], { family: 'ranged', ranged: true, shootDistanceParam: 2 })
add(['BloodRaven'], { family: 'ranged', ranged: true, boss: true })

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
add(['Vampire'], {
  family: 'kiter',
  ranged: true,
  shootDistanceParam: 2,
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

// Spawners.
add(['VileMother'], {
  family: 'spawner',
  spawn: { child: 'viledog1', maxParam: 0, batchParam: 1, intervalParam: 2 },
})
add(['SandMaggotQueen'], {
  family: 'spawner',
  spawn: { child: 'maggotegg1', maxParam: 0, batchParam: 1, intervalParam: 1 },
})
add(['FoulCrowNest'], {
  family: 'stationary',
  spawn: { child: 'foulcrow1', maxParam: 2, batchParam: 1, intervalParam: 0 },
})
add(['MosquitoNest'], {
  family: 'stationary',
  spawn: { child: 'mosquito1', maxParam: 1, batchParam: 0, intervalParam: 2 },
})
add(['SandMaggot'], {
  family: 'spawner',
  spawn: { child: 'maggotegg1', maxParam: 2, batchParam: 2, intervalParam: 4 },
})
add(['Sarcophagus'], {
  spawn: { child: 'mummy1', maxParam: 1, batchParam: 0, intervalParam: 0 },
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
    'DarkWanderer',
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
    'BaalTaunt',
    'PutridDefiler',
    'BaalToStairs',
    'BaalTentacle',
    'BaalCrabClone',
    'BaalMinion',
    'ShadowMasterNoInit',
    'UberIzual',
    'UberBaal',
    'UberMephisto',
    'UberDiablo',
    'Overseer',
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