/**
 * GameInstance Canonical 1.13c Policies, Constants & Stateless Helpers (`src/server/engine/game-instance/constants-and-helpers.ts`).
 */

import { RAW_ARMOR, RAW_MISC, RAW_WEAPONS } from '../../../common/data/canonical-drop-data.ts'
import { D2DataRegistry, type SkillRecord } from '../../../common/data/data-registry.ts'
import { decodeAnimDataFile } from '../../../common/formats/animdata.ts'
import { decodeStat204ChargedSkill113c } from '../../../common/items/charged-skill.ts'
import { D2_EXPERIENCE_TABLE_99, PARSED_EXPERIENCE_TABLE } from '../../../common/skills/formulas.ts'
import { MONUMOD_113C_ROWS } from '../../../common/units/monstats-113c-data.ts'
import { MONAI_PROFILES_113C, monaiParam113c, monaiProfile113c, type MonAiProfile113c } from '../../../common/units/monai-113c.ts'
import type { CharacterClassCode } from '../../../common/units/classes.ts'
import { parseTable } from '../../../common/world/acts.ts'
import { CANONICAL_113C_OBJECTS } from '../../../common/world/objects-meta.ts'
import type { CharClassId, ItemContainer, ItemStat } from '../../../netproto/index.ts'
import type { SkillEvalResult } from '../../skills/types.ts'
import { resolveGemSocketItemStats113c } from '../../items/cube-engine-113c.ts'
import { isStandableSubTile } from '../../world/area-bootstrap.ts'
import type { ArmorCombatMeta113c, GameMode, GameModePolicy, ItemBaseSizeInfo, MissileDamageChannel, MonsterAiBehavior, ServerItemEntry } from './types.ts'


/**
 * 1.13c unit types (`D2UnitStrc.dwType`). Each type owns its own unit id counter
 * (`pGame->dwLastUnitId[type]` at `D2GameStrc+0x90..+0xA4`, `SUNIT_GetNewUnitId` `D2Game 0x6FCFF9C0`),
 * so ids are only unique within one type.
 */
export const UNIT_TYPE_113C = {
  player: 0,
  monster: 1,
  object: 2,
  missile: 3,
  item: 4,
  tile: 5,
} as const
export type UnitType113c = (typeof UNIT_TYPE_113C)[keyof typeof UNIT_TYPE_113C]

export const SINGLE_PLAYER_POLICY: GameModePolicy = {
  mode: 'sp',
  maxPlayers: 1,
  allowPause: true,
  allowPlayersXCommand: true,
  persistMapSeedAndFog: true,
  allowPvpHostile: false,
  allowPlayerTrade: false,
}


export const OPEN_BNET_POLICY: GameModePolicy = {
  mode: 'open',
  maxPlayers: 8,
  allowPause: false,
  allowPlayersXCommand: true,
  persistMapSeedAndFog: false,
  allowPvpHostile: true,
  allowPlayerTrade: true,
}


export const CLOSED_REALM_POLICY: GameModePolicy = {
  mode: 'realm',
  maxPlayers: 8,
  allowPause: false,
  allowPlayersXCommand: false,
  persistMapSeedAndFog: false,
  allowPvpHostile: true,
  allowPlayerTrade: true,
}


export function resolveGameModePolicy(
  mode: GameMode = 'sp',
  overrides?: Partial<GameModePolicy>,
): GameModePolicy {
  const base: GameModePolicy =
    mode === 'sp' || mode === 'singlePlayer'
      ? SINGLE_PLAYER_POLICY
      : mode === 'open'
        ? OPEN_BNET_POLICY
        : CLOSED_REALM_POLICY

  if (!overrides) {
    return base
  }

  const allowPause =
    overrides.allowPause ??
    overrides.pauseOnSinglePlayerEscape ??
    base.allowPause
  const persistMapSeedAndFog =
    overrides.persistMapSeedAndFog ??
    overrides.persistMapSeedOnSave ??
    base.persistMapSeedAndFog
  const maxPlayers = Math.max(
    1,
    Math.min(8, Math.floor(overrides.maxPlayers ?? base.maxPlayers)),
  )
  const allowPlayersXCommand =
    overrides.allowPlayersXCommand ?? base.allowPlayersXCommand
  const allowPvpHostile = overrides.allowPvpHostile ?? base.allowPvpHostile
  const allowPlayerTrade = overrides.allowPlayerTrade ?? base.allowPlayerTrade
  const resolvedMode = overrides.mode ?? mode

  return {
    mode: resolvedMode,
    maxPlayers,
    allowPause,
    allowPlayersXCommand,
    persistMapSeedAndFog,
    allowPvpHostile,
    allowPlayerTrade,
    ...(overrides.defaultPlayersX !== undefined
      ? {
          defaultPlayersX: Math.max(
            1,
            Math.min(8, Math.floor(overrides.defaultPlayersX)),
          ),
        }
      : {}),
  }
}


export const MERC_AURA_TO_STATE_ID: Readonly<Record<string, number>> = {
  Might: 33,
  might: 33,
  Prayer: 34,
  prayer: 34,
  Thorns: 36,
  thorns: 36,
  Defiance: 37,
  defiance: 37,
  'Blessed Aim': 40,
  'blessed aim': 40,
  BlessedAim: 40,
  blessedaim: 40,
  'Holy Freeze': 43,
  'holy freeze': 43,
  HolyFreeze: 43,
  holyfreeze: 43,
}


/** 1.13c Hireling.txt Act 2 aura skill name -> `Skills.txt` skill ID. */
export const MERC_AURA_TO_SKILL_ID: Readonly<Record<string, number>> = {
  Might: 98,
  might: 98,
  Prayer: 99,
  prayer: 99,
  Thorns: 103,
  thorns: 103,
  Defiance: 104,
  defiance: 104,
  'Blessed Aim': 108,
  'blessed aim': 108,
  BlessedAim: 108,
  blessedaim: 108,
  'Holy Freeze': 114,
  'holy freeze': 114,
  HolyFreeze: 114,
  holyfreeze: 114,
}


export const CLASS_CODE_TO_ID: Record<string, CharClassId> = {
  ama: 0,
  amazon: 0,
  sor: 1,
  sorceress: 1,
  nec: 2,
  necromancer: 2,
  pal: 3,
  paladin: 3,
  bar: 4,
  barbarian: 4,
  dru: 5,
  druid: 5,
  ass: 6,
  asn: 6,
  assassin: 6,
}


export const CLASS_ID_TO_CODE: Record<number, CharacterClassCode> = {
  0: 'ama',
  1: 'sor',
  2: 'nec',
  3: 'pal',
  4: 'bar',
  5: 'dru',
  6: 'ass',
}


export const CLASS_SKILL_OFFSET: Record<number, number> = {
  0: 6, // Amazon: 6..35
  1: 36, // Sorceress: 36..65
  2: 66, // Necromancer: 66..95
  3: 96, // Paladin: 96..125
  4: 126, // Barbarian: 126..155
  5: 221, // Druid: 221..250
  6: 251, // Assassin: 251..280
}


export const ACT_TOWN_AREA: Record<number, number> = {
  0: 1,
  1: 40,
  2: 75,
  3: 103,
  4: 109,
}


export const TOWN_AREAS = new Set<number>([1, 40, 75, 103, 109])

/** Act town area per 0-based act index (Rogue Encampment, Lut Gholein, Kurast, Pandemonium, Harrogath). */
export const ACT_TOWN_AREAS: readonly number[] = [1, 40, 75, 103, 109]

/** 1.13c room AOI: reveal rooms within 8 tiles, hide them once 16 tiles away. */
export const ROOM_REVEAL_RADIUS_TILES = 8

export const ROOM_HIDE_RADIUS_TILES = 16

/** 1.13c rooms are 8×8 tiles (`[tileX, tileX + 8)` in the client room map). */
export const ROOM_TILE_SPAN_113C = 8

export const SUBTILES_PER_TILE = 5


/**
 * Canonical 1.13c 39 waypoint bit-index (0..38) to `Levels.txt` areaId mapping.
 */
export const WAYPOINT_AREA_IDS: readonly number[] = [
  // Act 1 (0..8)
  1, 3, 4, 5, 6, 27, 29, 32, 35,
  // Act 2 (9..17)
  40, 48, 42, 57, 43, 44, 52, 74, 46,
  // Act 3 (18..26)
  75, 76, 77, 78, 79, 80, 81, 83, 101,
  // Act 4 (27..29)
  103, 106, 107,
  // Act 5 (30..38)
  109, 111, 112, 113, 115, 123, 117, 118, 129,
]


/** 1.13c waypoint OperateFn interaction reach (sub-tiles). */
export const WAYPOINT_INTERACT_DISTANCE_SUBTILES = 4

/** D2Client/D2Game warp interaction reach (`D2Common #10407 <= 4`) and 500 ms click cooldown. */
export const WARP_INTERACT_DISTANCE_SUBTILES = 4

export const WARP_INTERACT_COOLDOWN_FRAMES = 10

/** D2Common #10407 NPC interaction threshold (deferred 0x13 arrival / click with MonStats `interact`). */
export const NPC_INTERACT_DISTANCE_SUBTILES = 2

/** 1.13c C2S `0x16` authoritative ground item pickup reach (sub-tiles, #1860). */
export const ITEM_PICKUP_MAX_DISTANCE_SUBTILES = 6

/** 1.13c `D2Game.dll` `0x6FCAE260` 15-frame (0.6s @ 25Hz) party roster pulse interval (#1859). */
export const PARTY_PULSE_INTERVAL_FRAMES = 15

/**
 * 1.13c `D2Game.dll` `0x6FD27E50` (`NPC_SetIntroFlag` @ `0x6FC55B60`):
 * Maps town NPC `MonStats.txt` `hcIdx` to `.d2s` `0x7701` (`0x2C9`) intro bit index `1..34` (#1861).
 */
export const NPC_INTRO_BIT_BY_HCIDX_113C = new Map<number, number>([
  [146, 6],
  [147, 1],
  [148, 2],
  [150, 3],
  [155, 4],
  [154, 5],
  [265, 6],
  [175, 7],
  [176, 8],
  [177, 9],
  [178, 10],
  [202, 11],
  [200, 12],
  [210, 13],
  [201, 14],
  [198, 15],
  [199, 16],
  [244, 17],
  [245, 18],
  [246, 19],
  [251, 20],
  [252, 21],
  [253, 22],
  [254, 23],
  [255, 24],
  [256, 25],
  [257, 26],
  [264, 27],
  [297, 28],
  [511, 29],
  [512, 30],
  [513, 31],
  [514, 32],
  [515, 33],
  [520, 34],
])

/** Player unit size used by `D2Common #10594` / `#10407` (constant 2 in both binaries). */
export const PLAYER_SIZE_X_113C = 2


/**
 * Canonical 1.13c continuous seam-adjacent level pairs (`Levels.txt` `Vis > 0 && Warp === -1`
 * preset/maze openings `'26:27'`, `'27:28'`, `'32:33'`, `'107:108'` union `D2Common.dll`
 * `DRLGOUTPLACE_CreateLevelConnections` outdoor stitched borders in `SEAMLESS_ADJACENCY`, #1697).
 */
export const CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C = new Set<string>([
  // Act 1 (Wilderness 1-2-3-{4,17}; Monastery 5-6-7-26-27-28; Cloister 32-33)
  '1:2', '2:3', '3:4', '3:17', '5:6', '6:7', '7:26', '26:27', '27:28', '32:33',
  // Act 2
  '40:41', '41:42', '42:43', '43:44', '44:45',
  // Act 3
  '75:76', '76:77', '76:78', '77:78', '78:79', '79:80', '80:81', '81:82', '82:83',
  // Act 4
  '103:104', '104:105', '105:106', '107:108',
  // Act 5
  '109:110', '110:111', '111:112',
])


export function areaToAct(areaId: number): 0 | 1 | 2 | 3 | 4 {
  if (areaId >= 109) return 4
  if (areaId >= 103) return 3
  if (areaId >= 75) return 2
  if (areaId >= 40) return 1
  return 0
}


/**
 * 1.13c `Experience.txt` (levels 1..`MaxLvl` = 99), shared with the client via
 * `src/common/skills/formulas.ts`. Index = character level; value = total
 * experience required to reach that level (`[1] = 0`, `[2] = 500`, ...,
 * `[99] = 3520485254`).
 */
export const EXP_TABLE_113C: readonly number[] = D2_EXPERIENCE_TABLE_99

export const MAX_PLAYER_LEVEL_113C: number = PARSED_EXPERIENCE_TABLE.maxLevel


/**
 * Row-to-family view of the shared MonAi profile table. The profile module
 * (`src/common/units/monai-113c.ts`) is the single source of truth; this export
 * remains for callers/tests that only need the behavior family.
 */
export const MONSTER_AI_BEHAVIOR_BY_AI: Readonly<Record<string, MonsterAiBehavior>> =
  Object.fromEntries(
    Object.entries(MONAI_PROFILES_113C).map(([key, profile]) => [key, profile.family]),
  )


export function monsterProfile113c(ai: string): MonAiProfile113c {
  // Synthetic units without a MonStats row use the MonAi `None` row.
  return monaiProfile113c(ai === '' ? 'None' : ai)
}


export function monsterAiBehavior(ai: string): MonsterAiBehavior {
  return monsterProfile113c(ai).family
}


/**
 * Apply the profile's `fireGate` (Bighead row 4: aip1 hurt %, aip3 fire while
 * healthy %, aip4 fire while hurt %). Rows without a gate always fire.
 */
export function monsterCanFireRanged113c(
  monster: {
    readonly ai: string
    readonly aiParams: readonly number[]
    readonly hp: number
    readonly maxHp: number
  },
  roll100: number,
): boolean {
  const profile = monsterProfile113c(monster.ai)
  const gate = profile.fireGate
  if (gate === undefined || monster.aiParams.length === 0) return true
  const hurtPct = Math.max(
    0,
    Math.min(100, monaiParam113c(profile, monster.aiParams, gate.hurtParam, 0)),
  )
  const hpPct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 100
  const chance = Math.max(
    0,
    Math.min(
      100,
      monaiParam113c(
        profile,
        monster.aiParams,
        hpPct > hurtPct ? gate.healthyChanceParam : gate.hurtChanceParam,
        0,
      ),
    ),
  )
  return chance >= 100 || (chance > 0 && roll100 < chance)
}


export function monsterShootRange(monster: {
  readonly ai: string
  readonly aiParams: readonly number[]
}): number {
  const profile = monsterProfile113c(monster.ai)
  const value = monaiParam113c(profile, monster.aiParams, profile.shootDistanceParam, 0)
  return value > 0 ? Math.min(40, Math.max(4, value)) : 35
}


/** Total experience required to reach `level` (1..99) per `Experience.txt`. */
export function experienceForLevel113c(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_LEVEL_113C, Math.floor(level)))
  const xp = EXP_TABLE_113C[clamped]
  if (xp === undefined) {
    throw new Error(`Experience.txt has no row for level ${String(clamped)}`)
  }
  return xp
}


export let cachedBaseSizes: Map<string, ItemBaseSizeInfo> | null = null


export function getBaseSizeTable(): Map<string, ItemBaseSizeInfo> {
  if (cachedBaseSizes) return cachedBaseSizes
  const map = new Map<string, ItemBaseSizeInfo>()
  const enc = new TextEncoder()
  for (const raw of [RAW_ARMOR, RAW_WEAPONS, RAW_MISC]) {
    const isWeapon = raw === RAW_WEAPONS
    const tbl = parseTable(enc.encode(raw))
    const codeIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'code')
    const nameIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'name')
    const wIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'invwidth')
    const hIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'invheight')
    const costIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'cost')
    const durIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'durability')
    const compactIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'compactsave')
    const questIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'quest')
    const typeIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'type')
    const twoHandIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === '2handed')
    const stackableIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'stackable')
    const maxStackIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'maxstack')
    const nameableIdx = tbl.header.findIndex((h) => h.trim().toLowerCase() === 'nameable')
    if (codeIdx === -1) continue
    if (compactIdx === -1) throw new Error('getBaseSizeTable: item table has no compactsave column')
    for (const row of tbl.rows) {
      const code = (row[codeIdx] ?? '').trim()
      if (!code || code.toLowerCase() === 'expansion') continue
      const name = (nameIdx !== -1 ? row[nameIdx] : code)?.trim() || code
      const width = Math.max(1, Number((wIdx !== -1 ? row[wIdx] : '1')?.trim()) || 1)
      const height = Math.max(1, Number((hIdx !== -1 ? row[hIdx] : '1')?.trim()) || 1)
      const cost = Math.max(1, Number((costIdx !== -1 ? row[costIdx] : '50')?.trim()) || 50)
      const maxDurability = Math.max(0, Number((durIdx !== -1 ? row[durIdx] : '20')?.trim()) || 0)
      const compactSave = (row[compactIdx] ?? '').trim() === '1'
      const quest = questIdx !== -1 && (Number((row[questIdx] ?? '0').trim()) || 0) !== 0
      const itemType = (typeIdx !== -1 ? (row[typeIdx] ?? '') : '').trim().toLowerCase()
      const twoHanded = twoHandIdx !== -1 && (row[twoHandIdx] ?? '').trim() === '1'
      const stackable = stackableIdx !== -1 && (row[stackableIdx] ?? '').trim() === '1'
      const maxStack =
        maxStackIdx !== -1
          ? Math.max(0, Number((row[maxStackIdx] ?? '0').trim()) || 0)
          : 0
      const nameable = nameableIdx !== -1 && (row[nameableIdx] ?? '').trim() === '1'
      map.set(code, {
        code,
        name,
        width,
        height,
        cost,
        maxDurability,
        compactSave,
        quest,
        itemType,
        isWeapon,
        twoHanded,
        stackable,
        maxStack,
        nameable,
      })
    }
  }
  cachedBaseSizes = map
  return map
}


export function lookupBaseInfo(code: string): ItemBaseSizeInfo {
  const clean = code.trim()
  return (
    getBaseSizeTable().get(clean) ?? {
      code: clean || 'hpot',
      name: clean || 'Minor Healing Potion',
      width: 1,
      height: 1,
      cost: 50,
      maxDurability: 20,
      compactSave: false,
      quest: false,
      itemType: '',
      isWeapon: false,
      twoHanded: false,
      stackable: false,
      maxStack: 0,
      nameable: false,
    }
  )
}


/** Armor/Weapons/Misc.txt record of a generated item's base; generated items always have one. */
export function requireBaseInfo(code: string): ItemBaseSizeInfo {
  const info = getBaseSizeTable().get(code.trim())
  if (!info) throw new Error(`GameInstance: item code '${code}' is not in Armor/Weapons/Misc.txt`)
  return info
}


/** True when `stats` is exactly the statId -> value fold of `list` (as `itemDataToServerEntry` builds it). */
export function statsMapMatchesItemStats(stats: ReadonlyMap<number, number>, list: readonly { statId: number; value: number }[]): boolean {
  const folded = new Map<number, number>()
  for (const st of list) folded.set(st.statId, st.value)
  if (folded.size !== stats.size) return false
  for (const [statId, value] of folded) {
    if (stats.get(statId) !== value) return false
  }
  return true
}


export function normalizeClassId(
  raw: CharClassId | CharacterClassCode | number | string | undefined,
): CharClassId {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) {
    return raw as CharClassId
  }
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase()
    const mapped = CLASS_CODE_TO_ID[lower]
    if (mapped !== undefined) return mapped
    const num = Number(lower)
    if (Number.isInteger(num) && num >= 0 && num <= 6) return num as CharClassId
  }
  return 0
}


/**
 * Margin (sub-tiles) of the collision window sampled around a player path query: the 18 sub-tile
 * local A* detour radius (`MAX_ASTAR_OBSTACLE_DISTANCE_SQ` = 18²) plus the size-2 `+` footprint.
 */
export const PLAYER_PATH_WINDOW_MARGIN = 20


/**
 * D2Game `D2GAME_PACKETCALLBACK_Rcv0x5F_UpdatePlayerPos` (0x6FC88530, D2MOO `PlrMsg.cpp`)
 * distance bands, measured with D2Common `UNITS_GetDistanceToCoordinates`
 * (`(min + 2 * max) / 2`): below 5 the report is ignored; below 15 or above 45 (or while
 * `STATE_SYNC_WARPED`) the server walks/runs the player toward the reported position; in between
 * it warps the player there when a path reaches it exactly, otherwise answers `0x15`.
 */
export const UPDATE_POS_IGNORE_DISTANCE = 5

/**
 * 1.13c D2Game `0x6FCEBF50` (C2S `0x01` WalkToLocation / `0x03` RunToLocation validator):
 * `mov ebx, 0x32 ; call 0x6FCEB690` rejects the packet when
 * `|unitX - targetX| > 50 || |unitY - targetY| > 50` (`cmp ecx, ebx ; jg` / `cmp eax, ebx ; jg`).
 */
export const WALK_PACKET_MAX_AXIS_DELTA_113C = 50
/**
 * 1.13c D2Game `0x6FCEBFBC..0x6FCEBFC5`: a rejected walk/run packet re-sends the player position
 * only when `gameFrame - [pPlayerData+0x168] > 0x19`; `+0x168` is the frame of the last accepted
 * walk/run packet (`0x6FCEC00D`).
 */
export const WALK_PACKET_REJECT_REASSIGN_FRAMES_113C = 25

export const UPDATE_POS_WARP_MIN_DISTANCE = 15

export const UPDATE_POS_WARP_MAX_DISTANCE = 45

/** `STATE_SYNC_WARPED` duration after an accepted `0x5F` warp (D2Game 0x6FC88530 `nDelay = 125`). */
export const SYNC_WARP_DELAY_FRAMES = 125

/**
 * `CLIENTS_ShouldDelayWarpAttempt` jitter (#1336): the warp-attempt lockout is not a fixed
 * 125 frames; add a small deterministic RNG delay (0..5 frames, one 200 ms band) so repeated
 * `0x5F` reports do not align to a fixed tick.
 */
export const SYNC_WARP_RANDOM_DELAY_FRAMES = 5


/** D2Common `UNITS_GetDistanceToCoordinates` (D2MOO `Units.cpp`): `(min + 2 * max) / 2`, integer. */
export function unitsDistanceToCoordinates113c(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  return dx <= dy ? Math.trunc((dx + 2 * dy) / 2) : Math.trunc((dy + 2 * dx) / 2)
}


/**
 * Player position as carried by S2C packets (`0x15` / `0x18` / `0x95` / `0x96`: u16 sub-tiles).
 * Server movement keeps a fractional position (the shared predictor steps 0.36 / 0.54 sub-tiles
 * per tick), but D2Client's tolerance gate (0x6FADA1B0) compares integer sub-tiles.
 */
export function playerWirePosition(player: { readonly x: number; readonly y: number }): {
  readonly x: number
  readonly y: number
} {
  return { x: Math.round(player.x), y: Math.round(player.y) }
}


/** An area brought online through the area bootstrap resolver. */
/**
 * Spawn of the synthetic legacy test grid used when the GameInstance has no area bootstrap resolver
 * (unit tests without DRLG geometry). Not a 1.13c position: real games always resolve areas.
 */
export const LEGACY_TEST_GRID_SPAWN = 128

/** `UNITS_GetUnitSizeX` (`#10589` `0x6FD80F80`) of a player. */
export const PLAYER_UNIT_SIZE = 2


export function toItemContainer(loc: ServerItemEntry['location']): ItemContainer {
  if (loc === 'equipped') return 'equipment'
  if (loc === 'vendor') return 'shop'
  if (loc === 'trade') return 'tradeSelf'
  return loc
}


export let cachedEmbeddedFallbackRegistry: D2DataRegistry | null = null


/**
 * 1.13c missile speed in sub-tiles per server frame for a raw `Vel + trunc(VelLev * slvl / 8)`:
 * `MISSILE_CreateMissileFromParams` builds `vel256 = rawVel << 8` (`0x6FC8FA34`) and then applies the
 * unconditional `* 75 / 100` (`0x6FC8FAA3..0x6FC8FAB8`, kb/missile-velocity-range-113c.md §2.3); the
 * path advances `vel256 / 4096` sub-tiles per frame (Fire Ball `Vel = 20` -> 3840 / 4096 = 15/16).
 * Oracle: p52-sorceress-elemental Fire Ball launched on frame 636 reaches zombie #9 on frame 683.
 */
export function missileSpeedSubtilesPerFrame113c(rawVel: number): number {
  if (rawVel <= 0) return 0
  return Math.trunc(((rawVel << 8) * 75) / 100) / 4096
}

/** Player missile flight speed in subtiles per 25 Hz frame (GameInstance linear missile model). */
export const PLAYER_MISSILE_SPEED_SUBTILES = 2.0

/** Melee reach in subtiles for `Skills.txt` `range = h2h | both` strikes. */
export const PLAYER_MELEE_REACH_SUBTILES = 4


export let cachedArmorCombatMeta113c: Map<string, ArmorCombatMeta113c> | null = null


/**
 * Parse 1.13c `Armor.txt` (`RAW_ARMOR`) using FIRST-occurrence `headers.indexOf('mindam')` /
 * `headers.indexOf('maxdam')` (cols 63..64 = Shield Smite damage, NOT cols 161..162 boot kick damage; #1800).
 */
export function resolveArmorCombatMeta113c(code: string | undefined | null): ArmorCombatMeta113c | undefined {
  if (typeof code !== 'string' || !code) return undefined
  if (cachedArmorCombatMeta113c === null) {
    cachedArmorCombatMeta113c = new Map()
    const lines = RAW_ARMOR.split(/\r?\n/)
    const headers = (lines[0] ?? '').split('\t')
    const codeIdx = headers.indexOf('code')
    const minAcIdx = headers.indexOf('minac')
    const maxAcIdx = headers.indexOf('maxac')
    const blockIdx = headers.indexOf('block')
    const minDamIdx = headers.indexOf('mindam')
    const maxDamIdx = headers.indexOf('maxdam')
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split('\t')
      const itemCode = (cols[codeIdx] ?? '').trim()
      if (!itemCode) continue
      cachedArmorCombatMeta113c.set(itemCode, {
        minAc: Number.parseInt(cols[minAcIdx] ?? '0', 10) || 0,
        maxAc: Number.parseInt(cols[maxAcIdx] ?? '0', 10) || 0,
        block: Number.parseInt(cols[blockIdx] ?? '0', 10) || 0,
        smiteMinDam: Number.parseInt(cols[minDamIdx] ?? '0', 10) || 0,
        smiteMaxDam: Number.parseInt(cols[maxDamIdx] ?? '0', 10) || 0,
      })
    }
  }
  return cachedArmorCombatMeta113c.get(code.trim())
}


/**
 * Server missile launched by a player skill: `Skills.txt` `srvmissile` / `srvmissilea`.
 * Client-only columns (`cltmissile*`) never spawn server missiles; weapon-dependent throws
 * (`Throw` 2, `Left Hand Throw` 4, `Double Throw` 140) and bow/crossbow attacks (`Attack` 0,
 * `Left Hand Swing` 5) resolve their missile from the equipped weapon's `Weapons.txt` `missiletype`
 * (`D2Common #10321` @ `0x6FD72F50`) / `D2Common #10709` (`0x6FDA0D40`) in `resolvePlayerSkillCast`.
 */
export function resolvePlayerServerMissileName(skill: SkillRecord, evalResult: SkillEvalResult): string {
  if (skill.srvMissile !== '') return skill.srvMissile
  if (skill.srvMissileA !== '') return skill.srvMissileA
  if (skill.cltMissile === '' && skill.cltMissileA === '') return evalResult.missileA
  return ''
}


/** Map `Missiles.txt` / `Skills.txt` `EType` tokens onto the combat damage channels. */
export function stableUnitKey(unitKey: string): number {
  let hash = 0
  for (let i = 0; i < unitKey.length; i++) {
    hash = (hash * 31 + unitKey.charCodeAt(i)) | 0
  }
  return hash >>> 0
}


export function missileClassElementFallback(id: number): MissileDamageChannel | undefined {
  if (id === 194) return 'cold'
  if (id === 195) return 'ltng'
  if (id === 82) return 'fire'
  return undefined
}


export function normalizeMissileElement(eType: string | undefined): MissileDamageChannel | undefined {
  switch ((eType ?? '').trim().toLowerCase()) {
    case 'fire':
    case 'burn':
      return 'fire'
    case 'ltng':
      return 'ltng'
    case 'cold':
    case 'frze':
      return 'cold'
    case 'pois':
      return 'pois'
    case 'mag':
      return 'mag'
    default:
      return undefined
  }
}


/**
 * Skills every player owns without hard points (`Skills.txt` rows with no `charclass` that D2Game
 * adds to each player: Attack, Kick, Throw, Unsummon, Left Hand Throw, Left Hand Swing, and the
 * scroll/book Identify / Town Portal item skills).
 */
export const UNIVERSAL_PLAYER_SKILL_IDS: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 217, 218, 219, 220])


/** `ItemStatCost.txt` rows used by the player skill / weapon damage resolution. */
export const STAT_ITEM_MAXDAMAGE_PERCENT = 17

export const STAT_MINDAMAGE = 21

export const STAT_MAXDAMAGE = 22

export const STAT_SECONDARY_MINDAMAGE = 23

export const STAT_SECONDARY_MAXDAMAGE = 24

export const STAT_QUANTITY = 70

export const STAT_ITEM_ADDCLASSSKILLS = 83

export const STAT_ITEM_NONCLASSSKILL = 97

export const STAT_ITEM_SINGLESKILL = 107

/** `States.txt` row 47 `sanctuary` (`aura = 1`), the Sanctuary (#119) caster state. */
export const STATE_SANCTUARY_113C = 47

/** `Skills.txt` row 151 `Whirlwind`: suppresses `item_skillonattack` / `item_skillonhit` procs. */
export const SKILL_WHIRLWIND_113C = 151

export const STAT_ITEM_ALLSKILLS = 127

export const STAT_ITEM_MAGICARROW = 157

export const STAT_ITEM_EXPLOSIVEARROW = 158

export const STAT_ITEM_ADDSKILL_TAB = 188

export const STAT_ITEM_CHARGED_SKILL = 204


/** Body locations of the weapon hands (`BodyLocs.txt`: 4 = right arm, 5 = left arm). */
export const BODYLOC_RIGHT_ARM = 4

export const BODYLOC_LEFT_ARM = 5


/** `Skills.txt` rows / `srvdofunc` ids with dedicated server handling (movement skills). */
export const SKILL_UNSUMMON = 3

export const SKILL_TELEPORT = 54

/** 1.13c monsters spawn their drop at the death animation's drop frame (~0.4 s at 25 Hz). */
export const MONSTER_DEATH_DROP_DELAY_FRAMES = 10

/** Room/AOI activation radius: monsters farther than this stop running AI (1.13c room sleep). */
export const MONSTER_ACTIVATION_RADIUS_SUBTILES = 80

/** Retaliation (last attacker) window; 1.13c monsters re-target their attacker for ~10 s. */
export const MONSTER_THREAT_FRAMES = 250

/** Fallback GetHit animation lock (AnimData `GH`) when a monster token has no `GH` record. */
export const MONSTER_HIT_RECOVERY_FRAMES = 6

/**
 * 1.13c server knockback step distance (`D2Game.dll` `0x6FC9520A` `nDist = 5` ->
 * `D2Common.dll` `0x6FDB7390` `stepDist = (nDist >> 1) + 1 = 3` sub-tiles; `6` for `sandmaggot1`).
 */
export const MONSTER_KNOCKBACK_DISTANCE = 3

/** `Skills.txt` rows whose hits apply 1.13c knockback (Smite, Bash, Charge, kicks, psi, boulder). */
export const MONSTER_KNOCKBACK_SKILLS: ReadonlySet<number> = new Set([
  43, // Telekinesis
  97, // Smite
  107, // Charge
  119, // Sanctuary aura pulse
  126, // Bash
  132, // Leap landing
  143, // Leap Attack
  229, // Molten Boulder
  253, // Psychic Hammer
  // Note (#1862): #255 Dragon Talon knocks back ONLY on its final kick (`strikeIndex === totalStrikes - 1` in `executeMartialFinisherSingleStrike113c`)
  270, // Dragon Tail
  273, // Mind Blast
  326, // BearSmite
  352, // SerpentCharge
])


/** `MonUMod.txt` row id -> the label surfaced on `ServerMonsterState.modifiers`. */
export const MON_UMOD_LABELS_113C: Readonly<Record<number, string>> = Object.freeze({
  5: 'Extra_Strong',
  6: 'Extra_Fast',
  7: 'Cursed',
  8: 'Magic_Resistant',
  9: 'Fire_Enchanted',
  17: 'Lightning_Enchanted',
  18: 'Cold_Enchanted',
  25: 'Mana_Burn',
  26: 'Teleportation',
  27: 'Spectral_Hit',
  28: 'Stone_Skin',
  29: 'Multiple_Shots',
  30: 'Aura_Enchanted',
  36: 'Ghostly',
  37: 'Fanatic',
  38: 'Possessed',
  39: 'Berserk',
})


export const MON_UMOD_ROW_BY_ID_113C: ReadonlyMap<number, (typeof MONUMOD_113C_ROWS)[number]> =
  new Map(MONUMOD_113C_ROWS.map((row) => [row.umodId, row]))


/** 1.13c `MonUMod.txt` `monsteruniqueprop*` aura pool (Might/Holy Fire/Holy Freeze/Holy Shock/Fanaticism/Conviction). */
export const MONSTER_AURA_SKILL_IDS_113C: readonly number[] = [98, 102, 114, 118, 122, 123]


/** `MonUMod.txt` constant column (0 when the id has no row). */
export function monUmodConstant113c(id: number): number {
  return MON_UMOD_ROW_BY_ID_113C.get(id)?.constants ?? 0
}

export const SRVDOFUNC_JAB = 7

export const SRVDOFUNC_ZEAL_FURY_FEND = 13

export const SRVDOFUNC_TELEKINESIS = 21

export const SRVDOFUNC_NOVA = 22

export const SRVDOFUNC_PSYCHIC_HAMMER = 33

export const SRVDOFUNC_MIND_BLAST = 51

export const SRVDOFUNC_CORPSE_EXPLOSION = 55

export const SRVDOFUNC_DRAGON_FLIGHT = 52

export const SRVDOFUNC_CHARGE = 67

export const SRVDOFUNC_FIND_POTION = 69

export const SRVDOFUNC_FIND_ITEM = 72

export const SRVDOFUNC_GRIM_WARD = 75

export const SRVDOFUNC_WHIRLWIND = 76

export const SRVDOFUNC_LEAP = 77

export const SRVDOFUNC_LEAP_ATTACK = 78

export const SRVDOFUNC_CONVERSION = 79


/**
 * Every stat (with its `param`) carried by one item: its own stat list, runeword stats and the
 * stats of socketed gems/runes/jewels. Items without decoded `ItemData` only carry param-less stats.
 */
export function collectItemStats(item: ServerItemEntry): ItemStat[] {
  const out: ItemStat[] = []
  if (item.rawItemData !== undefined) {
    out.push(...(item.rawItemData.stats ?? []), ...(item.rawItemData.runewordStats ?? []))
    if (item.socketedItems !== undefined && item.socketedItems.length > 0) {
      for (const child of item.socketedItems) {
        const childStats =
          child.rawItemData?.stats ??
          Array.from(child.stats.entries()).map(([statId, value]) => ({
            statId,
            param: 0,
            value,
          }))
        out.push(
          ...resolveGemSocketItemStats113c(
            { code: child.code, stats: childStats },
            item.code,
          ),
        )
      }
    } else if (item.rawItemData.socketedItems !== undefined && item.rawItemData.socketedItems.length > 0) {
      for (const child of item.rawItemData.socketedItems) {
        out.push(
          ...resolveGemSocketItemStats113c(
            { code: child.code, stats: child.stats ?? [] },
            item.code,
          ),
        )
      }
    }
    return out
  }
  if (item.stats !== undefined) {
    for (const [statId, value] of item.stats) out.push({ statId, param: 0, value })
  }
  if (item.socketedItems !== undefined) {
    for (const child of item.socketedItems) {
      const childStats =
        child.rawItemData?.stats ??
        Array.from(child.stats.entries()).map(([statId, value]) => ({
          statId,
          param: 0,
          value,
        }))
      out.push(
        ...resolveGemSocketItemStats113c(
          { code: child.code, stats: childStats },
          item.code,
        ),
      )
    }
  }
  return out
}


export function collectEquippedItemStats(items: readonly ServerItemEntry[]): ItemStat[] {
  const out: ItemStat[] = []
  for (const item of items) {
    // 1.13c: inactive weapon-swap slots (bodyLoc 11 = rarm2, 12 = larm2) never contribute stats (#1629).
    if (item.location === 'equipped' && item.bodyLoc !== 11 && item.bodyLoc !== 12) {
      out.push(...collectItemStats(item))
    }
  }
  return out
}


/**
 * Equipped item with `item_charged_skill` (204) charges left for `skillId`.
 *
 * 1.13c `D2Common.#10731` (`0x6FD98395..0x6FD983AC`) and `D2Game.dll` `0x6FCF9A21`:
 * - Only active equipped items (`location === 'equipped'` and not inactive weapon-swap slots `11`/`12`)
 *   grant charged skills.
 * - Unidentified (`ITEMFLAG_IDENTIFIED` `0x10` clear) and broken (`ITEMFLAG_BROKEN` `0x100` or
 *   `durability <= 0` on destructible items) items do not grant charged skills.
 */
export function findChargedSkill(
  items: readonly ServerItemEntry[],
  skillId: number,
  preferredItemId?: number,
): { readonly item: ServerItemEntry; readonly slvl: number; readonly param: number; readonly charges: number } | undefined {
  for (const item of items) {
    if (item.location !== 'equipped' || item.bodyLoc === 11 || item.bodyLoc === 12) continue
    if (preferredItemId !== undefined && preferredItemId !== 0xffffffff && item.unitId !== preferredItemId) {
      continue
    }
    if (!item.identified || item.rawItemData?.identified === false) continue
    if (
      item.rawItemData?.broken === true ||
      (item.maxDurability > 0 && item.durability <= 0 && (item.stats.get(152) ?? 0) <= 0)
    ) {
      continue
    }
    const ilvl = item.rawItemData?.ilvl ?? item.level ?? 99
    const allStats = [
      ...(item.rawItemData?.stats ?? []),
      ...(item.rawItemData?.runewordStats ?? []),
    ]
    for (const stat of allStats) {
      if (stat.statId !== STAT_ITEM_CHARGED_SKILL) continue
      const decoded = decodeStat204ChargedSkill113c(stat, ilvl)
      if (!decoded || decoded.skillId !== skillId || decoded.charges <= 0) continue
      const packedParam = ((decoded.skillId << 6) | (decoded.level & 0x3f)) >>> 0
      return { item, slvl: decoded.level, param: packedParam, charges: decoded.charges }
    }
  }
  return undefined
}


/**
 * Spend one charge of `skillId` on `item` (stat 204 current charges, low byte) and return the
 * packed param (`(skillId << 6) | slvl`) and remaining charges for `S2C 0x3E` (`StatSet`).
 */
export function consumeSkillCharge(
  item: ServerItemEntry,
  skillId: number,
): { readonly param: number; readonly remainingCharges: number; readonly maxCharges: number } {
  const raw = item.rawItemData
  if (raw === undefined) {
    throw new Error(`consumeSkillCharge: item ${item.unitId} has no decoded stat list`)
  }
  const ilvl = raw.ilvl ?? item.level ?? 99
  let spent = false
  let matchedParam = ((skillId << 6) | 1) >>> 0
  let remainingCharges = 0
  let matchedMaxCharges = 0
  const mapStatList = (list: readonly { statId: number; param: number; value: number }[]) =>
    list.map((stat) => {
      if (spent || stat.statId !== STAT_ITEM_CHARGED_SKILL) return stat
      const decoded = decodeStat204ChargedSkill113c(stat, ilvl)
      if (!decoded || decoded.skillId !== skillId || decoded.charges <= 0) return stat
      spent = true
      remainingCharges = decoded.charges - 1
      matchedMaxCharges = decoded.maxCharges
      matchedParam = ((decoded.skillId << 6) | (decoded.level & 0x3f)) >>> 0
      const nextValue = ((decoded.maxCharges & 0xff) << 8) | (remainingCharges & 0xff)
      return { ...stat, param: matchedParam, value: nextValue }
    })
  const stats = mapStatList(raw.stats)
  const runewordStats = raw.runewordStats ? mapStatList(raw.runewordStats) : undefined
  if (!spent) {
    throw new Error(`consumeSkillCharge: item ${item.unitId} has no charges of skill ${skillId}`)
  }
  item.rawItemData = {
    ...raw,
    stats,
    ...(runewordStats !== undefined ? { runewordStats } : {}),
  }
  const rawRec = item.rawItemData as unknown as Record<string, unknown>
  if (Array.isArray(rawRec.chargedSkills)) {
    for (const entry of rawRec.chargedSkills as { skillId?: number; charges?: number }[]) {
      if (entry.skillId === skillId && (entry.charges ?? 0) > 0) {
        entry.charges = remainingCharges
        break
      }
    }
  }
  item.stats.set(STAT_ITEM_CHARGED_SKILL, ((matchedMaxCharges & 0xff) << 8) | (remainingCharges & 0xff))
  return { param: matchedParam, remainingCharges, maxCharges: matchedMaxCharges }
}


export function getOrCreateEmbeddedFallbackRegistry(): D2DataRegistry {
  if (cachedEmbeddedFallbackRegistry !== null) {
    return cachedEmbeddedFallbackRegistry
  }
  const emptyTable = { columns: [] as const, rows: [] as const }
  const emptyAnimData = decodeAnimDataFile(new Uint8Array(256 * 4))
  cachedEmbeddedFallbackRegistry = new D2DataRegistry({
    skillsTable: emptyTable,
    skillDescTable: emptyTable,
    missilesTable: emptyTable,
    statesTable: emptyTable,
    itemStatCostTable: emptyTable,
    charStatsTable: emptyTable,
    monStatsTable: emptyTable,
    monStats2Table: emptyTable,
    overlayTable: emptyTable,
    petTypeTable: emptyTable,
    elemTypesTable: emptyTable,
    hitClassTable: emptyTable,
    eventsTable: emptyTable,
    skillCalcTable: emptyTable,
    missCalcTable: emptyTable,
    animData: emptyAnimData,
  })
  return cachedEmbeddedFallbackRegistry
}



/** Non-act-boss quest monsters whose death completes a 1.13c quest (`MonStats` id or `SuperUniques` id). */
export const QUEST_BOSS_KILL_113C: readonly (readonly [string, string])[] = [
  ['bloodraven', 'a1q2'],
  ['countess', 'a1q4'],
  ['the countess', 'a1q4'],
  ['radament', 'a2q1'],
  ['summoner', 'a2q5'],
  ['the summoner', 'a2q5'],
  ['izual', 'a4q1'],
  ['shenk', 'a5q1'],
  ['siege boss', 'a5q1'],
  ['nihlathak', 'a5q4'],
]


/**
 * 1.13c Quest Object -> Quest Item code (`gpObjectOperateFnTable` @ `D2Game.dll!0x6FD27BB8`):
 * - 30 (Inifuss Tree, OperateFn 12 @ 0x6FCDEF20) -> 'bks' (Scroll of Inifuss)
 * - 108 (Horadric Malus Stand, OperateFn 21 @ 0x6FC85D40) -> 'hdm' (Horadric Malus)
 * - 149 (Tainted Sun Altar, OperateFn 24 @ 0x6FCE76B0) -> 'vip' (Amulet of the Viper)
 * - 193 (Lam Esen's Tome Stand, OperateFn 28 @ 0x6FD094C0) -> 'bbb' (Lam Esen's Tome)
 * - 252 (The Gidbinn Decoy, OperateFn 31 @ 0x6FD09C80) -> 'g33' (The Gidbinn)
 * - 354 (Horadric Cube Chest, OperateFn 39 @ 0x6FCEA050) -> 'box' (Horadric Cube)
 * - 355 (Horadric Scroll Chest, OperateFn 40 @ 0x6FCEA290) -> 'tr1' (Horadric Scroll)
 * - 356 (Staff of Kings Chest, OperateFn 41 @ 0x6FCEA170) -> 'msf' (Staff of Kings)
 * - 405 (Khalim's Chest 1, OperateFn 57 @ 0x6FD0A5F0) -> 'qhr' (Khalim's Heart)
 * - 406 (Khalim's Chest 2, OperateFn 59 @ 0x6FD0A390) -> 'qbr' (Khalim's Brain)
 * - 407 (Khalim's Chest 3, OperateFn 58 @ 0x6FD0A4C0) -> 'qey' (Khalim's Eye)
 */
export const QUEST_OBJECT_DROP_ITEM_CODE_113C: Readonly<Record<number, string>> = Object.freeze({
  30: 'bks',
  108: 'hdm',
  149: 'vip',
  193: 'bbb',
  252: 'g33',
  354: 'box',
  355: 'tr1',
  356: 'msf',
  405: 'qhr',
  406: 'qbr',
  407: 'qey',
})


/**
 * Ancients' Altar (Objects.txt 546) -> Ancient Statues (475/476/474) -> SuperUniques 43/44/45
 * (`D2Game.dll` `0x6FC7E420`..`0x6FC7E560`: `475 -> 43 Talic/540`, `476 -> 44 Madawc/541`, `474 -> 45 Korlic/542`).
 */
export const ANCIENT_BARBARIANS_113C: readonly {
  readonly defId: string
  readonly superUniqueId: string
  readonly superUniqueIndex: number
  readonly statueClassId: number
}[] = Object.freeze([
  {
    defId: 'ancientbarb1',
    superUniqueId: 'Ancient Barbarian 1',
    superUniqueIndex: 43,
    statueClassId: 475,
  },
  {
    defId: 'ancientbarb2',
    superUniqueId: 'Ancient Barbarian 2',
    superUniqueIndex: 44,
    statueClassId: 476,
  },
  {
    defId: 'ancientbarb3',
    superUniqueId: 'Ancient Barbarian 3',
    superUniqueIndex: 45,
    statueClassId: 474,
  },
])


/** Chaos Sanctuary seal -> SuperUnique boss spawned by that seal (`D2Game.dll` `a4q3.cpp` `0x6FCDBC00..0x6FCDC5E2`). */
export const SEAL_BOSS_113C: Readonly<
  Record<
    number,
    {
      readonly defId: string
      readonly superUniqueId: string
      readonly superUniqueIndex: number
      readonly dx: number
      readonly dy: number
    }
  >
> = Object.freeze({
  392: {
    defId: 'fingermage3',
    superUniqueId: 'Grand Vizier of Chaos',
    superUniqueIndex: 38,
    dx: -12,
    dy: -52,
  },
  394: {
    defId: 'doomknight3',
    superUniqueId: 'Lord De Seis',
    superUniqueIndex: 37,
    dx: -39,
    dy: 33,
  },
  396: {
    defId: 'megademon3',
    superUniqueId: 'Infector of Souls',
    superUniqueIndex: 36,
    dx: 32,
    dy: 16,
  },
})



/**
 * 1.13c monster death drop: `resolveMonsterDropPending113c` (MonStats TreasureClass by rank, Act boss
 * first-kill quest TC) + `executePendingMonsterDrop113c` (TreasureClassEx incl. NoDrop with /players
 * scaling, MF/GF, quality, affixes, gold), killer MF/GF from equipped stats 80/79.
 */
export const ACT_BOSS_QUEST_113C: Readonly<Record<string, string>> = {
  andariel: 'a1q6',
  duriel: 'a2q6',
  mephisto: 'a3q6',
  diablo: 'a4q3',
  baal: 'a5q6',
  baalcrab: 'a5q6',
}



/**
 * 1.13c `ItemStatCost.txt` per-level stat mapping (`op 2/3/4/5/6/7`, `D2Common.dll` `0x6FD89530`):
 * - `opParam = 1` (`>> 1`, i.e. `/ 2`): `224 item_tohit_perlevel`, `225 item_tohitpercent_perlevel`,
 *   `245 item_tohit_demon_perlevel`, `246 item_tohit_undead_perlevel` (#1630).
 * - `opParam = 3` (`>> 3`, i.e. `/ 8`): all other per-level stats (`214..223`, `229..244`, `247..250`).
 */
export const PER_LEVEL_STAT_MAP_113C: Readonly<
  Record<number, { readonly perLevelStatId: number; readonly shift: number }>
> = {
  0: { perLevelStatId: 220, shift: 3 },
  1: { perLevelStatId: 222, shift: 3 },
  2: { perLevelStatId: 221, shift: 3 },
  3: { perLevelStatId: 223, shift: 3 },
  7: { perLevelStatId: 216, shift: 3 },
  9: { perLevelStatId: 217, shift: 3 },
  11: { perLevelStatId: 242, shift: 3 },
  16: { perLevelStatId: 215, shift: 3 },
  17: { perLevelStatId: 219, shift: 3 },
  19: { perLevelStatId: 224, shift: 1 },
  22: { perLevelStatId: 218, shift: 3 },
  24: { perLevelStatId: 218, shift: 3 },
  31: { perLevelStatId: 214, shift: 3 },
  39: { perLevelStatId: 230, shift: 3 },
  41: { perLevelStatId: 232, shift: 3 },
  43: { perLevelStatId: 231, shift: 3 },
  45: { perLevelStatId: 233, shift: 3 },
  49: { perLevelStatId: 227, shift: 3 },
  51: { perLevelStatId: 228, shift: 3 },
  55: { perLevelStatId: 226, shift: 3 },
  58: { perLevelStatId: 229, shift: 3 },
  78: { perLevelStatId: 238, shift: 3 },
  79: { perLevelStatId: 239, shift: 3 },
  80: { perLevelStatId: 240, shift: 3 },
  119: { perLevelStatId: 225, shift: 1 },
  121: { perLevelStatId: 243, shift: 3 },
  122: { perLevelStatId: 244, shift: 3 },
  123: { perLevelStatId: 245, shift: 1 },
  124: { perLevelStatId: 246, shift: 1 },
  135: { perLevelStatId: 248, shift: 3 },
  136: { perLevelStatId: 247, shift: 3 },
  141: { perLevelStatId: 250, shift: 3 },
  143: { perLevelStatId: 235, shift: 3 },
  145: { perLevelStatId: 236, shift: 3 },
  147: { perLevelStatId: 237, shift: 3 },
  149: { perLevelStatId: 234, shift: 3 },
}



export const CHAR_ANIM_TOKEN_BY_CLASS_113C: Readonly<Record<string, string>> = {
  ama: 'AM',
  sor: 'SO',
  nec: 'NE',
  pal: 'PA',
  bar: 'BA',
  dru: 'DZ',
  ass: 'AI',
}



/**
 * 1.13c ground-pickup quest item conflict table (`ITEMS_HasConflictingQuestItem`,
 * `D2Game.dll` @ `0x6FCF2070..0x6FCF22B8`, called by `ITEMS_CheckQuestItemPickup`
 * @ `0x6FCF2F00`): symmetric bidirectional conflict pairs (`j34 <-> g34`,
 * `bks <-> bkd`, `d33 <-> g33`, `hst <-> msf/vip`, `qf2 <-> qf1/qhr/qey/qbr`)
 * preventing a player (or hired mercenary) from picking up a raw quest item while
 * holding its assembled upgrade OR picking up an assembled upgrade while holding
 * any raw component (`#2002`).
 */
export const QUEST_ITEM_EQUIVALENT_CODES_113C: Readonly<
  Record<string, readonly string[]>
> = {
  bks: ['bks', 'bkd'],
  bkd: ['bkd', 'bks'],
  msf: ['msf', 'hst'],
  vip: ['vip', 'hst'],
  hst: ['hst', 'msf', 'vip'],
  j34: ['j34', 'g34'],
  g34: ['g34', 'j34'],
  xyz: ['xyz'],
  g33: ['g33', 'd33'],
  d33: ['d33', 'g33'],
  qey: ['qey', 'qf2'],
  qhr: ['qhr', 'qf2'],
  qbr: ['qbr', 'qf2'],
  qf1: ['qf1', 'qf2'],
  qf2: ['qf2', 'qf1', 'qey', 'qhr', 'qbr'],
  tr2: ['tr2'],
  ice: ['ice'],
  box: ['box'],
  tr1: ['tr1'],
  ass: ['ass'],
  hdm: ['hdm'],
  bbb: ['bbb'],
  hfh: ['hfh'],
  mss: ['mss'],
}

/**
 * 1.13c upward-only quest item superseding table (`QUESTS_FindItemByCode`,
 * `D2Game.dll` @ `0x6FC2E660..0x6FC2E73C` + quest drop/mint checks such as
 * `ACT3Q5_CountFlailNeeds` @ `0x6FD036A0` and Meshif `0x6FD08E1E`, `#2002`):
 * a quest drop or NPC mint is satisfied ONLY by the item itself or its upgraded /
 * transmuted evolution — NEVER by uncombined raw ingredients (e.g. holding `qey`,
 * `qhr`, or `qbr` must NOT count as already owning `qf2`, and a ground `j34` must
 * NOT suppress Meshif minting `g34`).
 */
export const QUEST_ITEM_SUPERSEDING_CODES_113C: Readonly<
  Record<string, readonly string[]>
> = {
  bks: ['bks', 'bkd'],
  bkd: ['bkd'],
  msf: ['msf', 'hst'],
  vip: ['vip', 'hst'],
  hst: ['hst'],
  j34: ['j34', 'g34', 'xyz'],
  g34: ['g34', 'xyz'],
  xyz: ['xyz'],
  g33: ['g33', 'd33'],
  d33: ['d33'],
  qey: ['qey', 'qf2'],
  qhr: ['qhr', 'qf2'],
  qbr: ['qbr', 'qf2'],
  qf1: ['qf1', 'qf2'],
  qf2: ['qf2'],
  tr2: ['tr2'],
  ice: ['ice'],
  box: ['box'],
  tr1: ['tr1'],
  ass: ['ass'],
  hdm: ['hdm'],
  bbb: ['bbb'],
  hfh: ['hfh'],
  mss: ['mss'],
}


/**
 * Search radius around a `UNIT_OBJECT` anchor for a standable perimeter sub-tile (`#1986`).
 * Around an `N x N` blocked footprint (`[-floor(N/2) .. +floor((N-1)/2)]`), `3x3`-standable
 * floor begins at `ceil(N / 2) + 1` (e.g. `4` for `5x5` `Tree of Inifuss`, `7` for `10x6` `386`).
 */
export function computeObjectApproachSearchRadius113c(classId: number): number {
  const meta = CANONICAL_113C_OBJECTS[classId]
  const maxDim = Math.max(0, meta?.sizeX ?? 0, meta?.sizeY ?? 0)
  return Math.max(4, Math.ceil(maxDim / 2) + 3)
}


/**
 * Select the nearest walkable approach sub-tile around `(anchorX, anchorY)` that satisfies
 * `canInteractFrom(x, y)` (range + `0x0804` LOS), preferring `3x3`-standable floor and
 * falling back to single-cell walkability in tight corridors (`#1986`).
 */
export function findBestInteractApproachSubTile113c(params: {
  readonly isWalkable: (x: number, y: number) => boolean
  readonly canInteractFrom: (x: number, y: number) => boolean
  readonly anchorX: number
  readonly anchorY: number
  readonly playerX: number
  readonly playerY: number
  readonly maxRadius: number
}): { readonly x: number; readonly y: number } | null {
  const { isWalkable, canInteractFrom, anchorX, anchorY, playerX, playerY, maxRadius } = params
  const cx = Math.round(anchorX)
  const cy = Math.round(anchorY)
  let bestStandable: { readonly x: number; readonly y: number } | null = null
  let bestStandableScore = Number.POSITIVE_INFINITY
  let bestWalkable: { readonly x: number; readonly y: number } | null = null
  let bestWalkableScore = Number.POSITIVE_INFINITY

  for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
    for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
      const x = cx + dx
      const y = cy + dy
      if (!isWalkable(x, y)) continue
      if (!canInteractFrom(x, y)) continue
      const score =
        Math.hypot(x - anchorX, y - anchorY) +
        Math.hypot(x - playerX, y - playerY) * 1e-3
      if (score < bestWalkableScore) {
        bestWalkableScore = score
        bestWalkable = { x, y }
      }
      if (score < bestStandableScore && isStandableSubTile(isWalkable, x, y)) {
        bestStandableScore = score
        bestStandable = { x, y }
      }
    }
  }
  return bestStandable ?? bestWalkable
}


/**
 * A monster's raw 1/256 hit points: the fractional `hp256` while it is in sync with the integer `hp`
 * (see `InternalMonsterRecord.hp256`), else `hp << 8`.
 */
export function monsterHp256_113c(monster: { readonly hp: number; readonly hp256?: number | undefined; readonly hp256Whole?: number | undefined }): number {
  return monster.hp256 !== undefined && monster.hp256Whole === monster.hp ? monster.hp256 : monster.hp * 256
}
