/**
 * @file src/server/net/d2gs-kernel-bridge-113c.ts
 * [K5] Direct `ByteStream` <-> `d2kern-113c` (`D2Game.dll` / `D2Net.dll` / `Fog.dll` v1.13c)
 * host bridge (`D2gsKernelBridge113c`).
 *
 * Strictly isomorphic & deterministic:
 * - Lives outside `src/d2kern-113c/`, importing `src/d2kern-113c/**` one-way.
 * - Imports `src/netproto/index.ts` for `ByteStream`, `D2gsC2sFramer`, `D2gsSession`, and `D2gsAdapter`.
 * - Zero DOM globals, zero Node built-ins, zero ambient RNG or wall-clock calls.
 */

import { compute5BandScaling } from '../../common/data/calc-ast.ts'
import { SKILLS_BY_ID, SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import { BELT_CODE_TO_ROWS, BELT_POTION_CATALOG, NO_BELT_ROWS } from '../../common/items/belt-model.ts'
import { executeDropPipeline } from '../../common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../common/items/embedded-drop-tables.ts'
import { canUnitEquipItem113c, type EquipCandidateItem113c } from '../../common/items/equip-req-113c.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from '../../common/items/inventory-model.ts'
import type { Item } from '../../common/items/items.ts'
import {
  computeRepairAllCost113c,
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
  type ItemQuality113c,
  type TransactionCostContext,
  type TransactionCostInput,
  type TransactionCostStat,
} from '../../common/items/transaction-cost.ts'
import {
  VENDOR_TAB_KEYS,
  generateGambleInventory,
  generateVendorStoreInventory,
  resolveGambledItem,
} from '../../common/items/vendor-generator.ts'
import { calculateKillExperienceGain113c } from '../../common/progression/experience-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { calculateHitChance, getExperienceForLevel } from '../../common/skills/formulas.ts'
import { isSkillAllowedInTown } from '../../common/skills/skills-meta.ts'
import {
  CANONICAL_CHARSTATS,
  CHARACTER_CLASS_CODES,
  CHARACTER_CLASS_NAMES,
  type CharacterClassCode,
} from '../../common/units/classes.ts'
import { MONLVL_113C_ROWS, MONSTATS_113C_ROWS } from '../../common/units/monsters-data.ts'
import { hasMonStats2Flag, MONSTATS2_FLAGINDEX } from '../../common/units/monstats2-flags.ts'
import { getTownNpcDescriptorByHcIdx } from '../../common/units/npc-table.ts'
import {
  collisionGetFreeCoordinates,
  isBlockedWithUnitSize,
} from '../../common/world/act-spawn-location.ts'
import { WAYPOINT_CLASS_IDS_113C } from '../../common/world/objects-meta.ts'
import { executeCubeTransmute113c, executeSocketItem113c } from '../items/cube-engine-113c.ts'
import { domainItemToItemData113c, finalizeDroppedItem113c } from '../items/server-item-data.ts'
import {
  DUNGEON_AddClientToRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_RemoveClientFromRoom113c,
} from '../../d2kern-113c/common/dungeon.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../../d2kern-113c/common/inline-helpers.ts'
import {
  PLAYER_StoreLeftSkill113c,
  PLAYER_StoreRightSkill113c,
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_CopyRecordToBuffer113c,
} from '../../d2kern-113c/common/quest-record.ts'
import {
  DATATABLES_LEVELS_TXT_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_PTR_OFF_113C,
  GDW_WAYPOINT_TABLE_COUNT_VA_113C,
  GW_WAYPOINT_TABLE_BASE_VA_113C,
  WAYPOINT_ActivateWaypoint113c,
  WAYPOINT_CopyAndValidateWaypointData113c,
  WAYPOINT_GetWaypointNoFromLevelId113c,
  WAYPOINT_GetWaypointState113c,
} from '../../d2kern-113c/common/waypoint.ts'
import {
  SKILLS_AllocSkillList113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillLevel113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../../d2kern-113c/common/skills.ts'
import {
  ITEMMODS_GetOrCreateStatList113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../d2kern-113c/common/statlist.ts'
import {
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_Create113c,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
} from '../../d2kern-113c/common/unit.ts'
import {
  NET_QueuePacketToClientBuffer113c,
  UNIT_SendAllStatesBitstreamToClient113c,
} from '../../d2kern-113c/game/boot-init-gap-a-113c.ts'
import {
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PACKET_SendStatByteWordDword113c,
  D2GAME_PACKET_SendUnitStop113c,
  type BootInitGapBCallees113c,
} from '../../d2kern-113c/game/boot-init-gap-b-113c.ts'
import { C2S_DispatchPacketMem113c } from '../../d2kern-113c/game/c2s-dispatch-113c.ts'
import {
  D2ClientStrcOffsets,
  PLRMODE_NEUTRAL,
  type C2SPacketCallees113c,
} from '../../d2kern-113c/game/c2s-packet-113c.ts'
import {
  NET_SendReassignUnitPacket15_113c,
  NET_SendUnitMovePacket0F113c,
} from '../../d2kern-113c/game/k2-combat-core-w1-113c.ts'
import { NET_SendPacket0x23_AssignSkill113c } from '../../d2kern-113c/game/k2-gap-melee-dot-113c.ts'
import {
  PLAYER_SetClientSkillHotkeySlot113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from '../../d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
} from '../../d2kern-113c/game/k2-laneH-0x6fc2-w1-113c.ts'
import { C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c } from '../../d2kern-113c/game/k2-w11b1-113c.ts'
import {
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket103B_QuestRecord_6FCAAD40_113c,
  NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c,
} from '../../d2kern-113c/game/k2-w2b3-113c.ts'
import {
  NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c,
  NET_SendPacket96_WalkVerify_6FCAB750_113c,
} from '../../d2kern-113c/game/k2-w4b4-113c.ts'
import { CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c } from '../../d2kern-113c/game/k2-w4b6-113c.ts'
import { CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c } from '../../d2kern-113c/game/k2-w5b1-113c.ts'
import { NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c } from '../../d2kern-113c/game/k2-w5b2-113c.ts'
import { PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c } from '../../d2kern-113c/game/k2-w5b5-113c.ts'
import {
  DUNGEON_CheckRoomIsTown113c,
  applyPlayerPacket113c,
  buildSliceC2SCallees113c,
  ensureSliceWorldPathMemory113c,
  getOrHydrateSliceWorld113c,
  stepFallenSliceFrame113c,
  type FallenSliceWorld113c,
  type MutablePathRoom113c,
  type MutablePathUnit113c,
  type SlicePathCollisionGrid113c,
} from '../../d2kern-113c/game/replay-kernel-113c.ts'
import {
  bindRoomCollisionGrid113c,
  ensureD2CommonPathGlobals113c,
  ensureObjectsTxtTable113c,
  getCharStatsPure113c,
  getMonStatsTxtPtrPure113c,
} from '../../d2kern-113c/game/tables-bootstrap-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../d2kern-113c/game/timer-wheel.ts'
import {
  D2ActStrc,
  D2ActStrc_SIZE,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2InventoryStrc,
  D2InventoryStrc_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2PlayerDataStrc_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomExStrc_SIZE,
  D2SkillListStrc,
  D2SkillsTxt_SIZE,
  D2UnitStrc,
} from '../../d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c, type Memory113c } from '../../d2kern-113c/mem/sparse-memory.ts'
import {
  D2NET_MODE_SERVER_113C,
  D2NetPacketSink113c,
  type CapturedS2CPacket113c,
} from '../../d2kern-113c/net/packet-sink.ts'
import {
  BitWriter,
  D2gsAdapter,
  D2gsC2sFramer,
  D2gsSession,
  createMemoryStreamPair,
  getDefault113cItemDataTables,
  resolveS2cPacketSize,
  serverEventToS2cPackets,
  validateC2sPacket,
  type ByteStream,
  type CharClassId,
  type Clock,
  type D2gsGameLogonParams,
  type ItemData,
  type ItemDataTables,
  type ItemStat,
  type LocalAreaBootstrap,
  type LocalAreaBootstrapResolver,
  type MemoryStream,
  type ServerEvent,
} from '../../netproto/index.ts'

/** Canonical 25fps (`40ms`) server tick interval of `D2Game.dll` v1.13c. */
export const D2GS_KERNEL_FRAME_MS_113C = 40

/** `D2Game.dll` -> `D2Net.dll` PE Import Address Table slots (`0x6FD18B48..0x6FD18B70`). */
export const D2GAME_NET_IAT_VA_113C = {
  getLastError_10003: 0x6fd18b48,
  getClientIp_10017: 0x6fd18b4c,
  disconnectClient_10000: 0x6fd18b50,
  dequeueQ1_10016: 0x6fd18b54,
  dequeueQ0_10035: 0x6fd18b58,
  dequeueQ2_10014: 0x6fd18b5c,
  getClientGameTag_10015: 0x6fd18b60,
  sendPacket_10002: 0x6fd18b64,
  dropClientSource_10001: 0x6fd18b68,
  setCloseCallback_10009: 0x6fd18b6c,
  setClientGameTag_10021: 0x6fd18b70,
} as const

const D2GAME_IAT_SGPT_DATATABLES_VA = 0x6fd1829c
const D2GAME_IAT_GDW_BITMASKS_VA = 0x6fd18be0
const D2GAME_GDW_DIFFICULTY_PLAYERS_VA_113C = 0x6fd31c1c
const D2COMMON_SGPT_EXPERIENCE_TXT_VA_113C = 0x6fdf0b50
const D2CLIENT_STRC_SIZE_113C = 0x510
// Disjoint scratch region above replay/K4/C2S staging (`0x7F000000..0x7F00FFFF`) used when
// adopting a pre-hydrated snapshot so `SparseMemory113c.allocTop` stays bit-identical to replay.
const BRIDGE_SNAPSHOT_RECV_SCRATCH_VA_113C = 0x7f010000
const BRIDGE_SNAPSHOT_SEND_SCRATCH_VA_113C = 0x7f010600
const BRIDGE_SNAPSHOT_SMALL_SCRATCH_VA_113C = 0x7f010820
const D2PACKET_DATA_MAX_BATCH_113C = 0x200
const SKILLS_TXT_COUNT_113C = 357
const SKILLDESC_TXT_STRIDE_113C = 0x120

/** Non-class 0-mana basic player skills in `Skills.txt` (`Attack..Left Hand Swing`, scrolls/books). */
const ZERO_MANA_BASIC_PLAYER_SKILLS_113C: ReadonlySet<number> = new Set([
  0, 1, 2, 3, 4, 5, 217, 218, 219, 220,
])

const CLASS_CODE_TO_INDEX_113C: Readonly<Record<CharacterClassCode, number>> = {
  ama: 0,
  sor: 1,
  nec: 2,
  pal: 3,
  bar: 4,
  dru: 5,
  ass: 6,
}

export const CLASS_SKILL_BASE_113C: Readonly<Record<number, number>> = {
  0: 6,
  1: 36,
  2: 66,
  3: 96,
  4: 126,
  5: 221,
  6: 251,
}

export function requireValidCharClassId113c(rawClass: number): CharClassId {
  if (!Number.isInteger(rawClass) || rawClass < 0 || rawClass > 6) {
    throw new RangeError(`Invalid 1.13c character class ID: ${rawClass} (expected integer 0..6)`)
  }
  return rawClass as CharClassId
}

export function requireCharClassCode113c(charClass: number): CharacterClassCode {
  const validId = requireValidCharClassId113c(charClass)
  const code = CHARACTER_CLASS_CODES[validId]
  if (code === undefined) {
    throw new RangeError(`Missing 1.13c character class code for class ID: ${validId}`)
  }
  return code
}

export function requireCharClassName113c(charClass: number): (typeof CHARACTER_CLASS_NAMES)[number] {
  const validId = requireValidCharClassId113c(charClass)
  const name = CHARACTER_CLASS_NAMES[validId]
  if (name === undefined) {
    throw new RangeError(`Missing 1.13c character class name for class ID: ${validId}`)
  }
  return name
}

export function requireClassSkillBase113c(charClass: number): number {
  const validId = requireValidCharClassId113c(charClass)
  const base = CLASS_SKILL_BASE_113C[validId]
  if (base === undefined) {
    throw new RangeError(`Missing 1.13c skill base for class ID: ${validId}`)
  }
  return base
}

export function requireValidActIdx113c(actIdx: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isInteger(actIdx) || actIdx < 0 || actIdx > 4) {
    throw new RangeError(`Invalid 1.13c Act index: ${actIdx} (expected integer 0..4)`)
  }
  return actIdx as 0 | 1 | 2 | 3 | 4
}

export function requireTownAreaForAct113c(actIdx: number): number {
  const valid = requireValidActIdx113c(actIdx)
  return ACT_TOWN_AREA_BY_INDEX_113C[valid]
}

export function requireValidDifficulty113c(difficulty: number): 0 | 1 | 2 {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2) {
    throw new RangeError(`Invalid 1.13c difficulty: ${difficulty} (expected integer 0..2)`)
  }
  return difficulty as 0 | 1 | 2
}

function requireValidSkillId113c(skillId: number, label: string): number {
  if (!Number.isInteger(skillId) || skillId < 0 || skillId >= SKILLS_TXT_COUNT_113C) {
    throw new RangeError(
      `Invalid 1.13c ${label}=${skillId} (expected integer 0..${SKILLS_TXT_COUNT_113C - 1})`,
    )
  }
  return skillId
}

const STAT_STRENGTH = 0
const STAT_ENERGY = 1
const STAT_DEXTERITY = 2
const STAT_VITALITY = 3
const STAT_STATPTS = 4
const STAT_NEWSKILLS = 5
const STAT_HITPOINTS = 6
const STAT_MAXHP = 7
const STAT_MANA = 8
const STAT_MAXMANA = 9
const STAT_STAMINA = 10
const STAT_MAXSTAMINA = 11
const STAT_LEVEL = 12
const STAT_EXPERIENCE = 13
const STAT_GOLD = 14
const STAT_GOLDBANK = 15
const STAT_MINDAMAGE = 21
const STAT_MAXDAMAGE = 22
const STAT_VELOCITYPERCENT = 67
const STAT_ATTACKRATE = 68
const STAT_ARMORCLASS = 31
const STAT_ITEM_ADDCLASSSKILLS = 83
const STAT_ITEM_REDUCEDPRICES = 87
const STAT_ITEM_NONCLASSSKILL = 97
const STAT_ITEM_SINGLESKILL = 107
const STAT_ITEM_ALLSKILLS = 127
const STAT_ITEM_ADDSKILL_TAB = 188

const ITEM_FLAG_IDENTIFIED_113C = 0x00000010
const ITEM_FLAG_DELETED_113C = 0x00000020
const ITEM_FLAG_BROKEN_113C = 0x00000100
const ITEM_FLAG_EAR_113C = 0x00001000
const ITEM_FLAG_ETHEREAL_113C = 0x00400000
const ITEM_FLAG_COMPACT_113C = 0x00200000

const SOUND_IMPOSSIBLE_113C = 19
const SOUND_CANT_CARRY_113C = 23
const SOUND_NOT_IN_TOWN_113C = 24
const SOUND_NEED_MANA_113C = 25

const BUTTON_OPEN_STASH_113C = 0x10
const BUTTON_CLOSE_STASH_113C = 0x11
const BUTTON_OPEN_CUBE_113C = 0x15

const OBJECT_CLASS_PORTAL_113C = 59
const OBJECT_CLASS_STASH_113C = 267
const ACT_TOWN_AREA_BY_INDEX_113C: readonly [number, number, number, number, number] = [
  1, 40, 75, 103, 109,
]

const PLRMODE_WALK = 2
const PLRMODE_RUN = 3
const PLRMODE_TOWN_NEUTRAL = 5
const PLRMODE_TOWN_WALK = 6

const UNIT_OBJECT_113C = 2
const UNIT_ITEM_113C = 4
const INTERACT_IMMEDIATE_RANGE_SUBTILES_113C = 8
const INTERACT_ARRIVAL_RANGE_SUBTILES_113C = 5
const NPC_TETHER_RANGE_SUBTILES_113C = 10
const ITEM_PICKUP_RANGE_SUBTILES_113C = 12

/** Canonical 1.13c town healers (`NPC.txt` / `D2Game.dll` `0x6FCDD810` -> `0x6FCDD490`). */
export const TOWN_HEALER_CLASS_IDS_113C: ReadonlySet<number> = new Set([
  148, // Akara (Act 1)
  176, // Atma (Act 2)
  178, // Fara (Act 2)
  255, // Ormus (Act 3)
  405, // Jamella (Act 4)
  513, // Malah (Act 5)
])

/** Canonical 39 waypoint `Levels.txt` area IDs (`waypointIndex 0..38`, `D2Common.dll` `0x6FDB7E50`). */
export const WAYPOINT_AREA_IDS_113C: readonly number[] = [
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

/** Canonical 5 town area IDs in 1.13c (`Levels.txt`). */
export const TOWN_AREA_IDS_113C: ReadonlySet<number> = new Set([1, 40, 75, 103, 109])

/** Server-only invisible NPC spawner marker objects in 1.13c DS1 presets (`Objects.txt`). */
export const SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C: ReadonlySet<number> = new Set([
  382, 385, 459, 460, 461, 462, 542, 543, 567,
])

export function areaIdToActIdx113c(areaId: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isInteger(areaId) || areaId < 1 || areaId > 136) {
    throw new RangeError(`Invalid 1.13c areaId=${areaId} (expected integer 1..136)`)
  }
  if (areaId >= 109) return 4
  if (areaId >= 103) return 3
  if (areaId >= 75) return 2
  if (areaId >= 40) return 1
  return 0
}

function isInteractiveNpcClassId113c(classId: number): boolean {
  if (getTownNpcDescriptorByHcIdx(classId) !== undefined) return true
  const row = MONSTATS_113C_ROWS[classId]
  return Boolean(row !== undefined && (row.npc || row.interact))
}

function normalizeInitialQuestBuffers113c(
  raw: Uint8Array | readonly Uint8Array[] | undefined,
  activeDiff: 0 | 1 | 2,
): readonly [Uint8Array, Uint8Array, Uint8Array] {
  const b0 = new Uint8Array(96)
  const b1 = new Uint8Array(96)
  const b2 = new Uint8Array(96)
  const slots: readonly [Uint8Array, Uint8Array, Uint8Array] = [b0, b1, b2]
  if (raw instanceof Uint8Array) {
    if (
      raw.byteLength >= 298 &&
      raw[0] === 0x57 &&
      raw[1] === 0x6f &&
      raw[2] === 0x6f &&
      raw[3] === 0x21
    ) {
      b0.set(raw.subarray(10, 106))
      b1.set(raw.subarray(106, 202))
      b2.set(raw.subarray(202, 298))
    } else {
      slots[activeDiff].set(raw.subarray(0, Math.min(96, raw.byteLength)))
    }
  } else if (Array.isArray(raw)) {
    for (let d = 0; d < 3; d++) {
      const item = raw[d]
      if (item instanceof Uint8Array) {
        slots[d as 0 | 1 | 2].set(item.subarray(0, Math.min(96, item.byteLength)))
      }
    }
  }
  return slots
}

function makeDefaultWaypointSlice16(): Uint8Array {
  const out = new Uint8Array(16)
  out[0] = 0x02
  out[1] = 0x01
  out[2] = 0x01 // Bit 0 = Rogue Encampment (Area 1) unlocked by default in 1.13c
  return out
}

function copyWaypointSliceInto16(dst: Uint8Array, src: Uint8Array): void {
  dst.fill(0)
  if (src.byteLength === 14) {
    dst[0] = 0x02
    dst[1] = 0x01
    dst.set(src, 2)
    return
  }
  dst.set(src.subarray(0, Math.min(16, src.byteLength)))
  const wMagic = ((dst[1]! << 8) | dst[0]!) & 0xffff
  if (wMagic !== 0x0102 && wMagic !== 0x0101 && wMagic !== 0x0000) {
    dst[0] = 0x02
    dst[1] = 0x01
  }
}

function normalizeInitialWaypointBuffers113c(
  raw: Uint8Array | readonly Uint8Array[] | undefined,
  activeDiff: 0 | 1 | 2,
): readonly [Uint8Array, Uint8Array, Uint8Array] {
  const slots: readonly [Uint8Array, Uint8Array, Uint8Array] = [
    makeDefaultWaypointSlice16(),
    makeDefaultWaypointSlice16(),
    makeDefaultWaypointSlice16(),
  ]
  if (raw instanceof Uint8Array) {
    if (raw.byteLength >= 80 && raw[0] === 0x57 && raw[1] === 0x53) {
      copyWaypointSliceInto16(slots[0], raw.subarray(8, 24))
      copyWaypointSliceInto16(slots[1], raw.subarray(32, 48))
      copyWaypointSliceInto16(slots[2], raw.subarray(56, 72))
    } else {
      copyWaypointSliceInto16(slots[activeDiff], raw)
    }
  } else if (Array.isArray(raw)) {
    for (let d = 0; d < 3; d++) {
      const item = raw[d]
      if (item instanceof Uint8Array) {
        copyWaypointSliceInto16(slots[d as 0 | 1 | 2], item)
      }
    }
  }
  return slots
}

export interface D2gsKernelBridgeOptions113c {
  /** Pre-initialized `SparseMemory113c` instance (allocates a fresh arena if omitted). */
  readonly memory?: SparseMemory113c
  /** Pre-allocated `D2GameStrc*` in `memory` (initializes a fresh 1.13c game world if omitted). */
  readonly pGame?: number
  /**
   * Adopt a pre-hydrated 1.13c kernel snapshot (`memory` + `pGame` booted via `bootFromSnapshot113c`):
   * preserves snapshot memory & `SLICE_WORLD_BY_MEM` `FallenSliceWorld113c` untouched, registers
   * existing in-game `D2ClientStrc`/`D2UnitStrc` player entries without allocating new units, and
   * omits standalone synthetic local-sync shims (`0x0F`/`0x0D`/`0x95`/`0x96`) while keeping all
   * gameplay C2S dispatch paths active.
   */
  readonly adoptSnapshot?: boolean
  /** Deterministic `dwInitSeed` (`pGame + 0x7C`, default `0x12345678`). */
  readonly initSeed?: number
  /** Deterministic `dwObjectSeed` (`pGame + 0x80`, default `0x9ABCDEF0`). */
  readonly objectSeed?: number
  /** Game difficulty `0..2` (`pGame + 0x6D`, default `0`). */
  readonly difficulty?: 0 | 1 | 2
  /** Expansion flag (`pGame + 0x70`, default `true`). */
  readonly expansion?: boolean
  /** Hardcore arena flag (`0x0800` on `pArena + 0x08`, default `false`). */
  readonly hardcore?: boolean
  /** Ladder flag (`pGame + 0x74`, default `false`). */
  readonly ladder?: boolean
  /** Act index `0..4` (`default 0`). */
  readonly act?: 0 | 1 | 2 | 3 | 4
  /** Starting area ID `1..136` (`default 1`, Rogue Encampment). */
  readonly areaId?: number
  /** Room subtile origin X (`default 5520`). */
  readonly roomSubtileX?: number
  /** Room subtile origin Y (`default 5880`). */
  readonly roomSubtileY?: number
  /** Room subtile width (`default 80`). */
  readonly roomSubtileWidth?: number
  /** Room subtile height (`default 80`). */
  readonly roomSubtileHeight?: number
  /** Default player spawn subtile X (`default roomSubtileX + 40`). */
  readonly spawnX?: number
  /** Default player spawn subtile Y (`default roomSubtileY + 40`). */
  readonly spawnY?: number
  /** Optional custom collision mask callback `(subX, subY) => u16Mask` (`0` = walkable floor). */
  readonly collisionMaskAt?: ((subX: number, subY: number) => number) | undefined
  /** Additional DRLG rooms (`0x07 RoomReveal`) revealed to clients upon room entry. */
  readonly extraRevealedRooms?:
    | readonly { readonly areaId: number; readonly tileX: number; readonly tileY: number }[]
    | undefined
  /** Optional initial player base stats (`statId -> rawValue`) hydrated before room-entry bootstrap. */
  readonly initialPlayerStats?: Readonly<Record<number, number>> | undefined
  /** Optional initial player base skill levels (`skillId -> baseLevel`, `.d2s` `if` 30-byte section). */
  readonly initialSkillLevels?: Readonly<Record<number, number>> | undefined
  /** Optional initial 16 skill hotkey words (`.d2s` `0x38..0x77`). */
  readonly initialHotkeys?: readonly number[] | undefined
  /** Optional initial `/players 1..8` count stored in `D2GameStrc` (`+0x1D20` & `0x6FD31C1C`). */
  readonly initialPlayersX?: number | undefined
  /** Optional callback fired when `/players 1..8` changes via `setPlayersX` or C2S `0x15` chat. */
  readonly onPlayersXChange?: ((playersX: number) => void) | undefined
  /** Optional initial player items (`.d2s` `JM` item list) streamed as `0x9C`/`0x9D` on game entry. */
  readonly initialItems?: readonly ItemData[] | undefined
  /**
   * Optional `.d2s` quest buffers (`298`-byte `"Woo!"` section, `[norm96, nm96, hell96]`, or active-difficulty `96`-byte buffer)
   * hydrated into `pPlayerData->pQuestData[0..2]` (`+0x10..+0x18`) via `D2BitBufferStrc`.
   */
  readonly initialQuestData?: Uint8Array | readonly Uint8Array[] | undefined
  /**
   * Optional `.d2s` waypoint buffers (`80`-byte `"WS"` section, `[norm, nm, hell]`, or active-difficulty `16`/`24`-byte buffer)
   * hydrated into `pPlayerData->pWaypointData[0..2]` (`+0x1C..+0x24`).
   */
  readonly initialWaypointData?: Uint8Array | readonly Uint8Array[] | undefined
  /** Optional area bootstrap resolver used by `C2S 0x49` multi-area waypoint travel. */
  readonly resolveAreaBootstrap?: LocalAreaBootstrapResolver | undefined
  /** Optional callback fired whenever the active area / Act changes (e.g. via `C2S 0x49` waypoint travel). */
  readonly onAreaChange?: ((areaId: number, act: 0 | 1 | 2 | 3 | 4) => void) | undefined
  /** Optional initial left-hand skill ID (`default 0`). */
  readonly initialLeftSkill?: number | undefined
  /** Optional initial right-hand skill ID (`default 0`). */
  readonly initialRightSkill?: number | undefined
  /** Optional initial active weapon swap set (`0` = I, `1` = II, `.d2s` `activeWeapon`). */
  readonly initialWeaponSet?: 0 | 1 | undefined
  /** Optional initial alternate weapon-swap left-hand skill ID (`.d2s` `altLeftSkill`). */
  readonly initialAltLeftSkill?: number | undefined
  /** Optional initial alternate weapon-swap right-hand skill ID (`.d2s` `altRightSkill`). */
  readonly initialAltRightSkill?: number | undefined
  /** 1.13c item/stat tables for `0xA8` bitstream encoding & `D2gsAdapter` decoding. */
  readonly tables?: ItemDataTables | undefined
  /**
   * When `true` (default), inbound Queue 0 system/handshake packets (`0x68`, `0x6B`, `0x6D`, `0x69`)
   * arriving over an attached `ByteStream` are processed immediately (matching `D2Game`'s dedicated
   * system packet thread) so `D2gsSession` / `D2gsAdapter` handshakes complete without blocking.
   */
  readonly autoProcessSystemPackets?: boolean
}

export interface D2gsAttachClientStreamOptions113c {
  /** Explicit `dwClientId` (`>= 1`, auto-incremented if omitted). */
  readonly clientId?: number
  /** Simulated peer IPv4 string stored in `D2Net.#10017` (`default "127.0.0.1"`). */
  readonly address?: string
  /** Default character name if client enters via `0x6B` fast-path without `0x68` (`default "Hero"`). */
  readonly defaultCharName?: string
  /** Default character class `0..6` if client enters via `0x6B` fast-path (`default 1` Sorceress). */
  readonly defaultCharClass?: CharClassId
  /** Stream framing mode: `'compressed'` (`[0xAF, 0x01]` + `Fog.#10223` wire blocks, default) or `'uncompressed'`. */
  readonly wireFormat?: 'compressed' | 'uncompressed'
  /** Emit `[0xAF, 0x01]` greeting upon attach when `wireFormat === 'compressed'` (`default true`). */
  readonly sendCompressionGreeting?: boolean
}

export interface D2gsConnectAdapterOptions113c extends D2gsAttachClientStreamOptions113c {
  /** Optional `0x68 GameLogon` parameters for full `D2gsSession` handshake. */
  readonly logon?: D2gsGameLogonParams
  /** Optional `ItemDataTables` override for `D2gsAdapter`. */
  readonly tables?: ItemDataTables
  /** Optional `Clock` override for `D2gsSession` & `D2gsAdapter` (defaults to virtual kernel clock). */
  readonly clock?: Clock
  /** Optional listener registered on `D2gsAdapter` prior to `[0xAF, 0x01]` stream greeting. */
  readonly onEvent?: (ev: ServerEvent) => void
}

export interface UncompressedS2CPacketRecord113c {
  readonly queue: number
  readonly clientId: number
  readonly opcode: number
  readonly frame: number
  readonly bytes: Uint8Array
}

export interface WireS2CPacketRecord113c {
  readonly queue: number
  readonly clientId: number
  readonly firstOpcode: number
  readonly frame: number
  readonly uncompressedBytes: Uint8Array
  readonly wireBytes: Uint8Array
}

export interface D2gsBridgeClientHandle113c {
  readonly clientId: number
  readonly pClient: number
  readonly stream: ByteStream | null
  readonly wireFormat: 'compressed' | 'uncompressed'
  getPlayerPtr(): number
  getPlayerUnitId(): number
  getClientState(): number
  close(): void
}

export interface ConnectedD2gsAdapter113c {
  readonly clientId: number
  readonly adapter: D2gsAdapter
  readonly session: D2gsSession
  readonly clientStream: MemoryStream
  readonly serverStream: MemoryStream
  readonly handle: D2gsBridgeClientHandle113c
}

export interface SpawnBridgeMonsterOptions113c {
  readonly classId: number
  readonly x: number
  readonly y: number
  readonly unitId?: number | undefined
  readonly animMode?: number | undefined
  readonly hp?: number | undefined
  readonly maxHp?: number | undefined
  readonly tcName?: string | undefined
}

export interface SpawnBridgeObjectOptions113c {
  readonly classId: number
  readonly x: number
  readonly y: number
  readonly unitId?: number | undefined
  readonly mode?: number | undefined
  readonly flags?: number | undefined
}

interface PendingBridgeInteraction113c {
  readonly kind: 'npc' | 'waypoint' | 'stash' | 'portal'
  readonly unitId: number
}

interface AppliedSkillBonusDelta113c {
  readonly statId: number
  readonly param: number
  readonly value: number
}

interface GroundItemRecord113c {
  readonly item: ItemData
  readonly x: number
  readonly y: number
  readonly areaId: number
}

interface VendorPoolEntry113c {
  readonly item: ItemData
  readonly permStore: boolean
  readonly gamble: boolean
  readonly sourceItem?: Item | undefined
}

interface MonsterCombatMeta113c {
  readonly classId: number
  readonly level: number
  readonly baseExp: number
  readonly ac: number
  readonly maxHp: number
  readonly isNpc: boolean
  readonly tcName: string | null
}

interface PortalTargetRecord113c {
  readonly destAreaId: number
  readonly destX?: number | undefined
  readonly destY?: number | undefined
}

interface InternalClientEntry113c {
  readonly clientId: number
  pClient: number
  pPlayer: number
  playerUnitId: number
  charName: string
  charClass: CharClassId
  readonly stream: ByteStream | null
  readonly framer: D2gsC2sFramer
  readonly wireFormat: 'compressed' | 'uncompressed'
  readonly unsubs: Array<() => void>
  activeNpcUnitId: number
  lastNpcHandshakeUnitId: number
  activeWaypointUnitId: number
  activeVendorNpcId: number
  activeVendorMode: 'trade' | 'gamble' | null
  stashOpen: boolean
  cubeOpen: boolean
  pendingIdentifyScrollId: number
  weaponSet: 0 | 1
  altLeftSkill: number
  altRightSkill: number
  readonly ownedItems: ItemData[]
  readonly appliedEquipSkillBonuses: AppliedSkillBonusDelta113c[]
  pendingInteraction: PendingBridgeInteraction113c | null
  closed: boolean
}

const INITIAL_SYNC_STAT_IDS_113C: readonly number[] = [
  STAT_STRENGTH,
  STAT_ENERGY,
  STAT_DEXTERITY,
  STAT_VITALITY,
  STAT_STATPTS,
  STAT_NEWSKILLS,
  STAT_HITPOINTS,
  STAT_MAXHP,
  STAT_MANA,
  STAT_MAXMANA,
  STAT_STAMINA,
  STAT_MAXSTAMINA,
  STAT_LEVEL,
  STAT_EXPERIENCE,
  STAT_GOLD,
  STAT_GOLDBANK,
]

function isSystemQueue0C2sOpcode113c(opcode: number): boolean {
  return opcode >= 0x67 && opcode <= 0x70
}

function writeFixedAscii16(m: Memory113c, dstPtr: number, text: string): void {
  const base = dstPtr >>> 0
  const maxChars = Math.min(15, text.length)
  for (let i = 0; i < 16; i++) {
    m.setU8((base + i) >>> 0, i < maxChars ? text.charCodeAt(i) & 0x7f : 0)
  }
}

function readFixedAscii16(m: Memory113c, srcPtr: number): string {
  const base = srcPtr >>> 0
  let out = ''
  for (let i = 0; i < 16; i++) {
    const ch = m.u8((base + i) >>> 0)
    if (ch === 0) break
    out += String.fromCharCode(ch)
  }
  return out
}

/**
 * `[K5]` Direct `ByteStream` <-> `d2kern-113c` (`D2Game` + `D2Net` + `Fog` v1.13c) host bridge.
 */
export class D2gsKernelBridge113c {
  readonly m: SparseMemory113c
  readonly pGame: number
  readonly packetSink: D2NetPacketSink113c
  readonly tables: ItemDataTables

  private actIdx: 0 | 1 | 2 | 3 | 4
  private areaId: number
  private defaultRoomPtr: number
  private readonly difficultyValue: 0 | 1 | 2
  private readonly initSeedValue: number
  private readonly spawnX: number
  private readonly spawnY: number
  private readonly wGameId: number
  private readonly autoProcessSystemPackets: boolean
  private extraRevealedRooms: readonly {
    readonly areaId: number
    readonly tileX: number
    readonly tileY: number
  }[]
  private activeRevealedRooms: Array<{
    readonly areaId: number
    readonly tileX: number
    readonly tileY: number
  }>
  private readonly initialPlayerStats: Readonly<Record<number, number>> | undefined
  private readonly initialSkillLevels: Readonly<Record<number, number>> | undefined
  private readonly initialHotkeys: readonly number[] | undefined
  private readonly initialItems: readonly ItemData[] | undefined
  private readonly initialQuestBuffers: readonly [Uint8Array, Uint8Array, Uint8Array]
  private readonly initialWaypointBuffers: readonly [Uint8Array, Uint8Array, Uint8Array]
  private readonly resolveAreaBootstrap: LocalAreaBootstrapResolver | undefined
  private readonly onAreaChange: ((areaId: number, act: 0 | 1 | 2 | 3 | 4) => void) | undefined
  private readonly onPlayersXChange: ((playersX: number) => void) | undefined
  private readonly initialLeftSkill: number
  private readonly initialRightSkill: number
  private readonly initialWeaponSet: 0 | 1
  private readonly initialAltLeftSkill: number
  private readonly initialAltRightSkill: number
  private playersXValue: number
  private readonly rng: D2Rng

  private readonly pRecvScratch: number
  private readonly pSendScratch: number
  private readonly pSmallScratch: number
  private readonly adoptedSnapshot: boolean

  private nextClientId = 1
  private nextUnitId = 1
  private accumTimeMs = 0
  private virtualTickMs = 0

  private readonly clients = new Map<number, InternalClientEntry113c>()
  private readonly sliceClientById = new Map<number, number>()
  private readonly sliceWorld: FallenSliceWorld113c
  private readonly groundItems = new Map<number, GroundItemRecord113c>()
  private readonly vendorStockByKey = new Map<string, VendorPoolEntry113c[]>()
  private readonly spawnedUniqueIds = new Set<number>()
  private readonly monsterMetaByUnitId = new Map<number, MonsterCombatMeta113c>()
  private readonly portalsByObjectId = new Map<number, PortalTargetRecord113c>()
  private readonly uncompressedOutbox: UncompressedS2CPacketRecord113c[] = []
  private readonly wireOutbox: WireS2CPacketRecord113c[] = []
  private readonly uncompressedListeners = new Set<(pkt: UncompressedS2CPacketRecord113c) => void>()
  private readonly wireListeners = new Set<(pkt: WireS2CPacketRecord113c) => void>()

  private readonly gapBCallees: BootInitGapBCallees113c

  constructor(options: D2gsKernelBridgeOptions113c = {}) {
    this.adoptedSnapshot = options.adoptSnapshot === true
    if (this.adoptedSnapshot) {
      if (options.memory === undefined) {
        throw new Error('D2gsKernelBridge113c adoptSnapshot requires pre-hydrated options.memory')
      }
      if (options.pGame === undefined || (options.pGame >>> 0) === 0) {
        throw new Error('D2gsKernelBridge113c adoptSnapshot requires non-zero options.pGame')
      }
    }

    this.m = options.memory !== undefined ? options.memory : new SparseMemory113c()
    this.tables = options.tables !== undefined ? options.tables : getDefault113cItemDataTables()
    this.autoProcessSystemPackets = options.autoProcessSystemPackets !== false
    this.extraRevealedRooms =
      options.extraRevealedRooms !== undefined ? options.extraRevealedRooms : []
    this.activeRevealedRooms = []
    this.initialPlayerStats = options.initialPlayerStats
    if (options.initialSkillLevels !== undefined) {
      for (const rawKey of Object.keys(options.initialSkillLevels)) {
        if (!/^[1-9]\d*$/.test(rawKey)) {
          throw new RangeError(
            `Invalid 1.13c initialSkillLevels skillId=${rawKey} (expected decimal integer 1..${SKILLS_TXT_COUNT_113C - 1})`,
          )
        }
        const skillId = Number(rawKey)
        if (!Number.isInteger(skillId) || skillId <= 0 || skillId >= SKILLS_TXT_COUNT_113C) {
          throw new RangeError(
            `Invalid 1.13c initialSkillLevels skillId=${rawKey} (expected decimal integer 1..${SKILLS_TXT_COUNT_113C - 1})`,
          )
        }
      }
    }
    this.initialSkillLevels = options.initialSkillLevels
    this.initialHotkeys = options.initialHotkeys
    this.initialItems = options.initialItems
    this.resolveAreaBootstrap = options.resolveAreaBootstrap
    this.onAreaChange = options.onAreaChange
    this.onPlayersXChange = options.onPlayersXChange
    this.initialLeftSkill =
      options.initialLeftSkill !== undefined
        ? requireValidSkillId113c(options.initialLeftSkill, 'initialLeftSkill')
        : 0
    this.initialRightSkill =
      options.initialRightSkill !== undefined
        ? requireValidSkillId113c(options.initialRightSkill, 'initialRightSkill')
        : 0
    this.initialWeaponSet = options.initialWeaponSet === 1 ? 1 : 0
    this.initialAltLeftSkill =
      options.initialAltLeftSkill !== undefined
        ? requireValidSkillId113c(options.initialAltLeftSkill, 'initialAltLeftSkill')
        : 0
    this.initialAltRightSkill =
      options.initialAltRightSkill !== undefined
        ? requireValidSkillId113c(options.initialAltRightSkill, 'initialAltRightSkill')
        : 0
    this.playersXValue =
      options.initialPlayersX !== undefined
        ? Math.max(1, Math.min(8, Math.floor(Number(options.initialPlayersX) || 1)))
        : 1

    this.packetSink = new D2NetPacketSink113c({ netMode: D2NET_MODE_SERVER_113C })
    this.gapBCallees = {
      sendPacketToClient: (mem, pClient, packet) => {
        this.queueBytesToClientBuffer(mem, pClient, packet)
      },
    }

    if (this.adoptedSnapshot) {
      this.pGame = options.pGame! >>> 0
      this.wGameId = this.m.u16((this.pGame + 0x28) >>> 0) || 1
      this.difficultyValue = requireValidDifficulty113c(this.m.u8((this.pGame + 0x6d) >>> 0))
      this.initSeedValue = this.m.u32((this.pGame + 0x7c) >>> 0) >>> 0
      this.rng = new D2Rng(((this.initSeedValue ^ 0xa5a5a5a5) >>> 0) || 1)
      this.initialQuestBuffers = normalizeInitialQuestBuffers113c(
        options.initialQuestData,
        this.difficultyValue,
      )
      this.initialWaypointBuffers = normalizeInitialWaypointBuffers113c(
        options.initialWaypointData,
        this.difficultyValue,
      )

      let foundAct: number = 0
      let foundDefaultRoom = 0
      for (let act = 0; act < 5; act++) {
        const pAct = this.m.u32((this.pGame + 0xbc + act * 4) >>> 0) >>> 0
        if (pAct !== 0) {
          foundAct = act
          foundDefaultRoom = this.m.u32((pAct + 0x10) >>> 0) >>> 0
          break
        }
      }
      this.actIdx = requireValidActIdx113c(foundAct)
      this.defaultRoomPtr = foundDefaultRoom >>> 0
      if (options.areaId !== undefined) {
        areaIdToActIdx113c(options.areaId)
        this.areaId = options.areaId
      } else {
        this.areaId = requireTownAreaForAct113c(this.actIdx)
      }
      this.spawnX = options.spawnX !== undefined ? options.spawnX : 5560
      this.spawnY = options.spawnY !== undefined ? options.spawnY : 5920

      this.sliceWorld = getOrHydrateSliceWorld113c(this.m, this.pGame)
      this.activeRevealedRooms = []
      this.pRecvScratch = BRIDGE_SNAPSHOT_RECV_SCRATCH_VA_113C
      this.pSendScratch = BRIDGE_SNAPSHOT_SEND_SCRATCH_VA_113C
      this.pSmallScratch = BRIDGE_SNAPSHOT_SMALL_SCRATCH_VA_113C
      this.virtualTickMs = (this.frame * D2GS_KERNEL_FRAME_MS_113C) >>> 0

      this.adoptSnapshotClients()
      for (const entry of this.clients.values()) {
        if (entry.pPlayer !== 0) {
          const pPlrRoom = UNITS_GetRoom113c(this.m, entry.pPlayer) >>> 0
          if (pPlrRoom !== 0) {
            this.defaultRoomPtr = pPlrRoom
            const lvlId = DUNGEON_GetLevelIdFromRoom113c(this.m, pPlrRoom) | 0
            if (lvlId > 0) {
              this.areaId = lvlId
              this.actIdx = areaIdToActIdx113c(lvlId)
            }
          }
          break
        }
      }
      return
    }

    this.difficultyValue = requireValidDifficulty113c(
      options.difficulty !== undefined ? options.difficulty : 0,
    )
    this.initSeedValue = options.initSeed !== undefined ? options.initSeed >>> 0 : 0x12345678
    const resolvedAreaId = options.areaId !== undefined ? options.areaId : 1
    const areaActIdx = areaIdToActIdx113c(resolvedAreaId)
    if (options.act !== undefined) {
      const validAct = requireValidActIdx113c(options.act)
      if (options.areaId !== undefined && areaActIdx !== validAct) {
        throw new RangeError(
          `Inconsistent 1.13c bridge options: act=${validAct} does not match areaId=${resolvedAreaId} (act=${areaActIdx})`,
        )
      }
      this.actIdx = validAct
    } else {
      this.actIdx = areaActIdx
    }
    this.areaId = resolvedAreaId
    this.initialQuestBuffers = normalizeInitialQuestBuffers113c(
      options.initialQuestData,
      this.difficultyValue,
    )
    this.initialWaypointBuffers = normalizeInitialWaypointBuffers113c(
      options.initialWaypointData,
      this.difficultyValue,
    )
    this.rng = new D2Rng(((this.initSeedValue ^ 0xa5a5a5a5) >>> 0) || 1)

    ensureD2CommonPathGlobals113c(this.m)
    ensureObjectsTxtTable113c(this.m)
    this.ensureD2GameBitMasksGlobal()

    const roomSubX = options.roomSubtileX !== undefined ? options.roomSubtileX : 5520
    const roomSubY = options.roomSubtileY !== undefined ? options.roomSubtileY : 5880
    const roomSubW = options.roomSubtileWidth !== undefined ? options.roomSubtileWidth : 80
    const roomSubH = options.roomSubtileHeight !== undefined ? options.roomSubtileHeight : 80
    this.spawnX = options.spawnX !== undefined ? options.spawnX : roomSubX + (roomSubW >> 1)
    this.spawnY = options.spawnY !== undefined ? options.spawnY : roomSubY + (roomSubW > 0 ? roomSubH >> 1 : 40)

    if (options.pGame !== undefined && options.pGame !== 0) {
      this.pGame = options.pGame >>> 0
      this.wGameId = this.m.u16((this.pGame + 0x28) >>> 0) || 1
      const pAct = this.m.u32((this.pGame + 0xbc + this.actIdx * 4) >>> 0) >>> 0
      this.defaultRoomPtr = pAct !== 0 ? this.m.u32((pAct + 0x10) >>> 0) >>> 0 : 0
    } else {
      const booted = this.initFreshKernelWorld({
        initSeed: options.initSeed !== undefined ? options.initSeed : 0x12345678,
        objectSeed: options.objectSeed !== undefined ? options.objectSeed : 0x9abcdef0,
        difficulty: this.difficultyValue,
        expansion: options.expansion !== false,
        hardcore: options.hardcore === true,
        ladder: options.ladder === true,
        act: this.actIdx,
        areaId: this.areaId,
        roomSubX,
        roomSubY,
        roomSubW,
        roomSubH,
        collisionMaskAt: options.collisionMaskAt,
      })
      this.pGame = booted.pGame
      this.defaultRoomPtr = booted.pRoom
      this.wGameId = booted.wGameId
    }

    this.applyPlayersXToKernelMemory(this.playersXValue)

    this.sliceWorld = this.buildSliceWorld()
    this.activeRevealedRooms = this.collectActiveRevealedRooms(this.defaultRoomPtr)

    this.pRecvScratch = this.m.alloc(0x600) >>> 0
    this.pSendScratch = this.m.alloc(0x210) >>> 0
    this.pSmallScratch = this.m.alloc(0x140) >>> 0
    this.virtualTickMs = (this.frame * D2GS_KERNEL_FRAME_MS_113C) >>> 0
  }

  /** Client IDs currently registered on this bridge (e.g. adopted snapshot clients). */
  getAdoptedClientIds(): readonly number[] {
    return [...this.clients.keys()]
  }

  /** Current deterministic 25fps `pGame->dwGameFrame` (`+0xA8`). */
  get frame(): number {
    return this.m.get(this.pGame, D2GameStrc.dwGameFrame) >>> 0
  }

  /** Current deterministic virtual server clock in milliseconds (`frame * 40`). */
  get tickMs(): number {
    return this.virtualTickMs >>> 0
  }

  /** Default active `D2ActiveRoomStrc*` in `SparseMemory113c`. */
  get pDefaultRoom(): number {
    return this.defaultRoomPtr >>> 0
  }

  /** Active Act index (`0..4`). */
  get currentAct(): 0 | 1 | 2 | 3 | 4 {
    return this.actIdx
  }

  /** Active `Levels.txt` area ID (`1..136`). */
  get currentAreaId(): number {
    return this.areaId
  }

  /** Game difficulty (`0` Normal, `1` Nightmare, `2` Hell). */
  get difficulty(): 0 | 1 | 2 {
    return this.difficultyValue
  }

  /**
   * Resolve `pPlayerData->pQuestData[difficulty]` (`D2BitBufferStrc*`) in `SparseMemory113c`
   * via `PLAYER_GetQuestRecordForDifficulty_6FC21020_113c`.
   */
  getPlayerQuestRecordPtr(clientId: number, difficulty: 0 | 1 | 2 = this.difficultyValue): number {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined || entry.pPlayer === 0) return 0
    if (difficulty === this.difficultyValue && this.pGame !== 0) {
      return PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(this.m, entry.pPlayer, this.pGame) >>> 0
    }
    const pPlayerData = this.m.get(entry.pPlayer, D2UnitStrc.pUnitData) >>> 0
    if (pPlayerData === 0) return 0
    return this.m.u32((pPlayerData + (difficulty << 2) + 0x10) >>> 0) >>> 0
  }

  /**
   * Copy the live `96`-byte (`0x60`) `D2QuestRecordStrc` buffer for `difficulty` out of
   * `SparseMemory113c` via `QUESTRECORD_CopyRecordToBuffer113c`.
   */
  getPlayerQuestDataBytes(
    clientId: number,
    difficulty: 0 | 1 | 2 = this.difficultyValue,
  ): Uint8Array {
    const out = new Uint8Array(96)
    const pQuestRec = this.getPlayerQuestRecordPtr(clientId, difficulty)
    if (pQuestRec === 0) {
      out.set(this.initialQuestBuffers[difficulty])
      return out
    }
    QUESTRECORD_CopyRecordToBuffer113c(this.m, pQuestRec, this.pSmallScratch, 0x60, 0)
    for (let i = 0; i < 96; i++) {
      out[i] = this.m.u8((this.pSmallScratch + i) >>> 0)
    }
    return out
  }

  /**
   * Resolve `pPlayerData->pWaypointData[difficulty]` (`D2WaypointDataStrc*`, `16` bytes) in
   * `SparseMemory113c` via `PLAYER_GetWaypointDataForDifficulty_6FC21720_113c`.
   */
  getPlayerWaypointDataPtr(
    clientId: number,
    difficulty: 0 | 1 | 2 = this.difficultyValue,
  ): number {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined || entry.pPlayer === 0) return 0
    if (difficulty === this.difficultyValue && this.pGame !== 0) {
      return (
        PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(this.m, entry.pPlayer, this.pGame) >>> 0
      )
    }
    const pPlayerData = this.m.get(entry.pPlayer, D2UnitStrc.pUnitData) >>> 0
    if (pPlayerData === 0) return 0
    return this.m.u32((pPlayerData + (difficulty << 2) + 0x1c) >>> 0) >>> 0
  }

  /**
   * Read the live `16`-byte (`0x10`) `D2WaypointDataStrc` (`[0x02, 0x01, ...14B bitfield]`)
   * for `difficulty` out of `SparseMemory113c`.
   */
  getPlayerWaypointDataBytes(
    clientId: number,
    difficulty: 0 | 1 | 2 = this.difficultyValue,
  ): Uint8Array {
    const out = new Uint8Array(16)
    const pWpData = this.getPlayerWaypointDataPtr(clientId, difficulty)
    if (pWpData === 0) {
      out.set(this.initialWaypointBuffers[difficulty])
      return out
    }
    WAYPOINT_CopyAndValidateWaypointData113c(this.m, pWpData, this.pSmallScratch)
    for (let i = 0; i < 16; i++) {
      out[i] = this.m.u8((this.pSmallScratch + i) >>> 0)
    }
    return out
  }

  /**
   * Check whether `areaId` has an unlocked 1.13c waypoint bit for `difficulty`.
   */
  isAreaWaypointUnlocked(
    clientId: number,
    areaId: number,
    difficulty: 0 | 1 | 2 = this.difficultyValue,
  ): boolean {
    if (WAYPOINT_GetWaypointNoFromLevelId113c(this.m, areaId, this.pSmallScratch) === 0) {
      return false
    }
    const wpIdx = this.m.u16(this.pSmallScratch) & 0xffff
    const pWpData = this.getPlayerWaypointDataPtr(clientId, difficulty)
    if (pWpData !== 0) {
      return WAYPOINT_GetWaypointState113c(this.m, pWpData, wpIdx) !== 0
    }
    const initSlice = this.initialWaypointBuffers[difficulty]
    const byteIdx = 2 + (wpIdx >> 3)
    const bitMask = 1 << (wpIdx & 7)
    return byteIdx < initSlice.byteLength && (initSlice[byteIdx]! & bitMask) !== 0
  }

  /** Current `/players 1..8` override stored in `D2GameStrc` (`+0x1D20` & `0x6FD31C1C`). */
  getPlayersX(): number {
    return this.playersXValue
  }

  /**
   * Snapshot the live owned items (`equipment`, `inventory`, `stash`, `cube`, `belt`, `cursor`,
   * and `socket` children) for `clientId` in canonical `.d2s` serialization order.
   */
  getPlayerOwnedItems(clientId: number): ItemData[] {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined) {
      return this.initialItems !== undefined ? this.initialItems.map((item) => ({ ...item })) : []
    }
    return entry.ownedItems.map((item) => ({ ...item }))
  }

  /** Read live weapon-swap set (`0` = I, `1` = II) and alternate left/right skills for `clientId`. */
  getPlayerWeaponSwapState(clientId: number): {
    readonly activeWeapon: 0 | 1
    readonly altLeftSkill: number
    readonly altRightSkill: number
  } {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined) {
      return {
        activeWeapon: this.initialWeaponSet,
        altLeftSkill: this.initialAltLeftSkill,
        altRightSkill: this.initialAltRightSkill,
      }
    }
    return {
      activeWeapon: entry.weaponSet,
      altLeftSkill: entry.altLeftSkill,
      altRightSkill: entry.altRightSkill,
    }
  }

  /** List all ground items currently spawned in the active room. */
  getGroundItems(): readonly GroundItemRecord113c[] {
    return [...this.groundItems.values()]
  }

  /**
   * Spawn a ground item (or gold pile) in the active room and broadcast S2C `0x9C` (`action = 0x00`
   * or `0x02`) to all in-game clients.
   */
  spawnGroundItemInRoom(
    rawItem: Partial<ItemData> & { readonly code: string },
    x: number,
    y: number,
    dropAction: 'groundSpawn' | 'drop' = 'groundSpawn',
  ): ItemData {
    const assignedId =
      rawItem.id !== undefined && rawItem.id > 0
        ? rawItem.id >>> 0
        : rawItem.itemId !== undefined && rawItem.itemId > 0
          ? rawItem.itemId >>> 0
          : this.allocUnitId()
    if (assignedId >= this.nextUnitId) {
      this.nextUnitId = (assignedId + 1) >>> 0
    }
    const code = rawItem.code.trim()
    const isGold = code.toLowerCase() === 'gld'
    const sz = this.getItemGridSize({ code, invWidth: rawItem.invWidth, invHeight: rawItem.invHeight })
    const baseFlags = Number(rawItem.rawFlags ?? rawItem.flags ?? ITEM_FLAG_IDENTIFIED_113C)
    const cleanFlags = ((baseFlags & ~ITEM_FLAG_DELETED_113C) | (isGold ? ITEM_FLAG_COMPACT_113C : 0)) >>> 0
    const groundItem: ItemData = {
      opcode: 0x9c,
      action: dropAction === 'drop' ? 0x02 : 0x00,
      category: 0,
      ownerType: 0,
      ownerId: 0,
      version: 101,
      bodyLoc: 0,
      equippedSlot: 0,
      gridX: 0,
      gridY: 0,
      storePage: 0,
      storagePage: 0,
      compact: isGold,
      simple: isGold,
      identified: rawItem.identified ?? true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: false,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      quality: 2,
      stats: [],
      setBonusStats: [],
      runewordStats: [],
      ...rawItem,
      invWidth: sz.width,
      invHeight: sz.height,
      id: assignedId,
      itemId: assignedId,
      code,
      rawCode: code.padEnd(4, ' ').slice(0, 4),
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 3,
      container: 'ground',
      worldX: x & 0xffff,
      worldY: y & 0xffff,
      x: x & 0xffff,
      y: y & 0xffff,
    }
    this.groundItems.set(assignedId, {
      item: groundItem,
      x: x & 0xffff,
      y: y & 0xffff,
      areaId: this.areaId,
    })
    for (const entry of this.clients.values()) {
      if (entry.closed || entry.pClient === 0) continue
      if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: dropAction,
        itemId: assignedId,
        code: groundItem.code,
        x: x & 0xffff,
        y: y & 0xffff,
        container: 'ground',
        item: groundItem,
      })
    }
    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return groundItem
  }

  /**
   * Update `/players 1..8` in `SparseMemory113c` (`pGame + 0x1D20` and `0x6FD31C1C`
   * `gdwDifficultyPlayers`, read by `GAME_GetEffectivePlayerCount113c` at `0x6FC579A0`).
   */
  setPlayersX(value: number): number {
    const clamped = Math.max(1, Math.min(8, Math.floor(Number(value) || 1)))
    this.playersXValue = clamped
    this.applyPlayersXToKernelMemory(clamped)
    if (this.onPlayersXChange !== undefined) {
      this.onPlayersXChange(clamped)
    }
    return clamped
  }

  private applyPlayersXToKernelMemory(playersX: number): void {
    const next = Math.max(1, Math.min(8, playersX | 0))
    if (this.pGame !== 0) {
      const gameType = this.m.u8((this.pGame + 0x6a) >>> 0)
      if (gameType < 1 || gameType > 3) {
        this.m.setU8((this.pGame + 0x6a) >>> 0, 3)
      }
      this.m.setU32((this.pGame + 0x1d20) >>> 0, next >>> 0)
    }
    this.m.setU32(D2GAME_GDW_DIFFICULTY_PLAYERS_VA_113C, next >>> 0)
  }

  private ensureD2GameBitMasksGlobal(): void {
    let existing = 0
    try {
      existing = this.m.u32(D2GAME_IAT_GDW_BITMASKS_VA) >>> 0
    } catch {
      existing = 0
    }
    if (existing === 0) {
      const pMasks = this.m.alloc(32 * 4) >>> 0
      for (let i = 0; i < 32; i++) {
        this.m.setU32((pMasks + i * 4) >>> 0, (1 << i) >>> 0)
      }
      this.m.setU32(D2GAME_IAT_GDW_BITMASKS_VA, pMasks)
    }

    let pExpTxt = 0
    try {
      pExpTxt = this.m.u32(D2COMMON_SGPT_EXPERIENCE_TXT_VA_113C) >>> 0
    } catch {
      pExpTxt = 0
    }
    if (pExpTxt === 0) {
      pExpTxt = this.m.alloc(0x40) >>> 0
      for (let c = 0; c < 8; c++) {
        this.m.setU32((pExpTxt + c * 4) >>> 0, 99)
      }
      this.m.setU32(D2COMMON_SGPT_EXPERIENCE_TXT_VA_113C, pExpTxt)
    }

    let wpTableCount = 0
    try {
      wpTableCount = this.m.u32(GDW_WAYPOINT_TABLE_COUNT_VA_113C) >>> 0
    } catch {
      wpTableCount = 0
    }
    if (wpTableCount !== 0x70) {
      for (let i = 0; i < 0x70; i++) {
        this.m.setU16((GW_WAYPOINT_TABLE_BASE_VA_113C + i * 4) >>> 0, (1 + (i >> 4)) & 0xffff)
        this.m.setU16((GW_WAYPOINT_TABLE_BASE_VA_113C + 2 + i * 4) >>> 0, (1 << (i & 15)) & 0xffff)
      }
      this.m.setU32(GDW_WAYPOINT_TABLE_COUNT_VA_113C, 0x70)
    }

    let sgptIat = 0
    try {
      sgptIat = this.m.u32(D2GAME_IAT_SGPT_DATATABLES_VA) >>> 0
    } catch {
      sgptIat = 0
    }
    if (sgptIat === 0) {
      this.m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA, D2COMMON_SGPT_DATATABLES_VA_113C)
    }

    let sgpt = 0
    try {
      sgpt = this.m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    } catch {
      sgpt = 0
    }
    if (sgpt !== 0) {
      let statesCount = 0
      try {
        statesCount = this.m.u32((sgpt + 0xc4) >>> 0) >>> 0
      } catch {
        statesCount = 0
      }
      if (statesCount === 0) {
        // `ensureD2CommonPathGlobals113c` allocates a `0xC40`-byte `sgptDataTables` block;
        // expand to `0xD00` bytes so `pLevelsTxt` (`+0xC58`) & `nLevelsTxtRecordCount` (`+0xC5C`)
        // read by `WAYPOINT_GetWaypointNoFromLevelId113c` (`0x6FDB7E50`) never overlap adjacent tables.
        const expandedSgpt = this.m.alloc(0xd00) >>> 0
        for (let off = 0; off < 0xc40; off += 4) {
          this.m.setU32((expandedSgpt + off) >>> 0, this.m.u32((sgpt + off) >>> 0))
        }
        this.m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, expandedSgpt)
        sgpt = expandedSgpt

        const nStates = 184
        const pStatesTxt = this.m.alloc(nStates * 0x3c) >>> 0
        this.m.setU32((sgpt + 0xbc) >>> 0, pStatesTxt)
        this.m.setU32((sgpt + 0xc4) >>> 0, nStates)

        const nLevels = 137
        const pLevelsBase = this.m.alloc(nLevels * D2LevelsTxt_SIZE) >>> 0
        for (let lvl = 0; lvl < nLevels; lvl++) {
          const pRec = (pLevelsBase + lvl * D2LevelsTxt_SIZE) >>> 0
          this.m.setU16(pRec, lvl & 0xffff)
          this.m.set(pRec, D2LevelsTxt.nAct, lvl > 0 ? areaIdToActIdx113c(lvl) : 0)
          const wpIdx = WAYPOINT_AREA_IDS_113C.indexOf(lvl)
          this.m.set(pRec, D2LevelsTxt.nWaypoint, wpIdx >= 0 ? wpIdx : 0xff)
        }
        this.m.setU32((sgpt + DATATABLES_LEVELS_TXT_PTR_OFF_113C) >>> 0, pLevelsBase)
        this.m.setU32((sgpt + DATATABLES_LEVELS_TXT_COUNT_OFF_113C) >>> 0, nLevels)
      }

      let iscCount = 0
      try {
        iscCount = this.m.u32((sgpt + 0xbd4) >>> 0) >>> 0
      } catch {
        iscCount = 0
      }
      if (iscCount === 0) {
        const nIsc = 359
        const pIscBase = this.m.alloc(nIsc * 0x144) >>> 0
        for (let id = 0; id < nIsc; id++) {
          const meta = this.tables.getStatCost(id)
          if (meta === undefined) continue
          const rec = (pIscBase + id * 0x144) >>> 0
          if (meta.signed) {
            this.m.setU8((rec + 0x04) >>> 0, 0x02)
          }
          this.m.setU8((rec + 0x08) >>> 0, meta.sendBits & 0xff)
          this.m.setU8((rec + 0x09) >>> 0, meta.sendParamBits & 0xff)
        }
        this.m.setU32((sgpt + 0xbcc) >>> 0, pIscBase)
        this.m.setU32((sgpt + 0xbd4) >>> 0, nIsc)
      }

      let skillsCount = 0
      try {
        skillsCount = this.m.u32((sgpt + 0xba0) >>> 0) >>> 0
      } catch {
        skillsCount = 0
      }
      if (skillsCount === 0) {
        const nSkillDesc = SKILLS_CATALOG.length + 1
        const pSkillDescBase = this.m.alloc(nSkillDesc * SKILLDESC_TXT_STRIDE_113C) >>> 0
        const catalogById = new Map<number, (typeof SKILLS_CATALOG)[number]>()
        const descIdxById = new Map<number, number>()
        for (let idx = 0; idx < SKILLS_CATALOG.length; idx++) {
          const entry = SKILLS_CATALOG[idx]!
          const descIdx = idx + 1
          catalogById.set(entry.id, entry)
          descIdxById.set(entry.id, descIdx)
          const pDesc = (pSkillDescBase + descIdx * SKILLDESC_TXT_STRIDE_113C) >>> 0
          this.m.setU16(pDesc, descIdx & 0xffff)
          this.m.setU8((pDesc + 0x02) >>> 0, (entry.tabIndex + 1) & 0xff)
        }
        this.m.setU32((sgpt + 0xb8c) >>> 0, pSkillDescBase)
        this.m.setU32((sgpt + 0xb94) >>> 0, nSkillDesc)

        const pSkillsBase = this.m.alloc(SKILLS_TXT_COUNT_113C * D2SkillsTxt_SIZE) >>> 0
        for (let id = 0; id < SKILLS_TXT_COUNT_113C; id++) {
          const rec = (pSkillsBase + id * D2SkillsTxt_SIZE) >>> 0
          const cat = catalogById.get(id)
          this.m.setU16(rec, id & 0xffff)
          this.m.setU8((rec + 0x05) >>> 0, 0x04) // bFlags1 bit 2 (`inGame = 1`)
          this.m.setU8(
            (rec + 0x0c) >>> 0,
            cat !== undefined ? CLASS_CODE_TO_INDEX_113C[cat.classCode]! & 0xff : 0xff,
          )
          this.m.setU16((rec + 0x80) >>> 0, 0xffff) // wAuraStatState = -1
          this.m.setU16((rec + 0x94) >>> 0, 0xffff) // wPassiveState = -1
          this.m.setU8((rec + 0xbe) >>> 0, 0xff) // nPetType = -1
          this.m.setU16((rec + 0x12c) >>> 0, 20) // wMaxLvl = 20
          this.m.setU32((rec + 0x170) >>> 0, 0xffffffff) // dwSkPoints = -1 (1 point per rank)
          this.m.setU16((rec + 0x174) >>> 0, cat !== undefined ? cat.reqlevel & 0xffff : 0)
          const req0 = cat?.reqskills[0]
          const req1 = cat?.reqskills[1]
          const req2 = cat?.reqskills[2]
          this.m.setU16((rec + 0x17e) >>> 0, req0 !== undefined ? req0 & 0xffff : 0xffff)
          this.m.setU16((rec + 0x180) >>> 0, req1 !== undefined ? req1 & 0xffff : 0xffff)
          this.m.setU16((rec + 0x182) >>> 0, req2 !== undefined ? req2 & 0xffff : 0xffff)
          this.m.setU16((rec + 0x186) >>> 0, cat !== undefined ? cat.minmana & 0xffff : 0)
          this.m.setU8((rec + 0x188) >>> 0, cat !== undefined ? cat.manashift & 0xff : 8)
          this.m.setU16((rec + 0x18a) >>> 0, cat !== undefined ? cat.mana & 0xffff : 0)
          this.m.setU16((rec + 0x18c) >>> 0, cat !== undefined ? cat.lvlmana & 0xffff : 0)
          const descIdx = descIdxById.get(id)
          this.m.setU16((rec + 0x194) >>> 0, descIdx !== undefined ? descIdx & 0xffff : 0)
        }
        this.m.setU32((sgpt + 0xb98) >>> 0, pSkillsBase)
        this.m.setU32((sgpt + 0xba0) >>> 0, SKILLS_TXT_COUNT_113C)

        const pClassSkillCounts = this.m.alloc(7 * 4) >>> 0
        const pClassSkillList = this.m.alloc(7 * 30 * 2) >>> 0
        for (let cls = 0; cls < 7; cls++) {
          this.m.setU32((pClassSkillCounts + cls * 4) >>> 0, 30)
          const baseSk = CLASS_SKILL_BASE_113C[cls]!
          for (let idx = 0; idx < 30; idx++) {
            this.m.setU16((pClassSkillList + (cls * 30 + idx) * 2) >>> 0, (baseSk + idx) & 0xffff)
          }
        }
        this.m.setU32((sgpt + 0xba4) >>> 0, pClassSkillCounts)
        this.m.setU32((sgpt + 0xba8) >>> 0, 30)
        this.m.setU32((sgpt + 0xbac) >>> 0, pClassSkillList)
      }

      let charStatsCount = 0
      try {
        charStatsCount = this.m.u32((sgpt + 0xbc8) >>> 0) >>> 0
      } catch {
        charStatsCount = 0
      }
      if (charStatsCount === 0) {
        const pCharStatsTxt = this.m.alloc(7 * 0xc4) >>> 0
        this.m.setU32((sgpt + 0xbc4) >>> 0, pCharStatsTxt)
        this.m.setU32((sgpt + 0xbc8) >>> 0, 7)
      }
    }
  }

  private registerRoomInSliceMap(
    rPtr: number,
    roomByPtr: Map<number, MutablePathRoom113c> = this.sliceWorld.roomByPtr,
  ): void {
    if (rPtr === 0 || roomByPtr.has(rPtr)) return
    const m = this.m
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
    const pColl = m.get(rPtr, D2ActiveRoomStrc.pCollisionGrid) >>> 0
    const pMap = pColl !== 0 ? (m.get(pColl, D2RoomCollisionGridStrc.pMapStart) >>> 0) : 0
    const grid: SlicePathCollisionGrid113c = {
      get: (x: number, y: number): number => {
        const rx = (x | 0) - subX
        const ry = (y | 0) - subY
        if (rx < 0 || ry < 0 || rx >= subW || ry >= subH || pMap === 0) return 0xffff
        return m.u16((pMap + (ry * subW + rx) * 2) >>> 0)
      },
      set: (x: number, y: number, val: number): void => {
        const rx = (x | 0) - subX
        const ry = (y | 0) - subY
        if (rx < 0 || ry < 0 || rx >= subW || ry >= subH || pMap === 0) return
        m.setU16((pMap + (ry * subW + rx) * 2) >>> 0, val & 0xffff)
      },
    }
    roomByPtr.set(rPtr, {
      ptr: rPtr,
      subX,
      subY,
      subW,
      subH,
      isTown: DUNGEON_CheckRoomIsTown113c(m, rPtr) !== 0,
      adjacentRooms: [],
      grid,
    })
  }

  private collectActiveRevealedRooms(pRoom: number): Array<{
    readonly areaId: number
    readonly tileX: number
    readonly tileY: number
  }> {
    const out: Array<{ readonly areaId: number; readonly tileX: number; readonly tileY: number }> = []
    const seen = new Set<string>()
    if (pRoom !== 0) {
      const tileX = this.m.get(pRoom, D2ActiveRoomStrc.nTileX) & 0xffff
      const tileY = this.m.get(pRoom, D2ActiveRoomStrc.nTileY) & 0xffff
      const levelId = DUNGEON_GetLevelIdFromRoom113c(this.m, pRoom) || this.areaId
      seen.add(`${levelId}:${tileX}:${tileY}`)
      out.push({ areaId: levelId, tileX, tileY })
    }
    for (let i = 0; i < this.extraRevealedRooms.length; i++) {
      const rm = this.extraRevealedRooms[i]!
      const tileX = rm.tileX & 0xffff
      const tileY = rm.tileY & 0xffff
      const key = `${rm.areaId}:${tileX}:${tileY}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ areaId: rm.areaId, tileX, tileY })
    }
    return out
  }

  private buildSliceWorld(): FallenSliceWorld113c {
    const m = this.m
    let pTimer = m.get(this.pGame, D2GameStrc.pTimer) >>> 0
    if (pTimer === 0) {
      pTimer = EVENT_InitTimerQueue113c(m, this.pGame) >>> 0
    }
    const unitsByKey = new Map<string, number>()
    const monsterById = new Map<number, number>()
    const playerById = new Map<number, number>()
    const pathUnitByPtr = new Map<number, MutablePathUnit113c>()
    const roomByPtr = new Map<number, MutablePathRoom113c>()
    const minionIdsByLeaderId = new Map<number, number[]>()

    for (let act = 0; act < 5; act++) {
      const pAct = m.u32((this.pGame + 0xbc + act * 4) >>> 0) >>> 0
      if (pAct === 0) continue
      let rPtr = m.u32((pAct + 0x10) >>> 0) >>> 0
      let guard = 0
      while (rPtr !== 0 && guard++ < 256) {
        this.registerRoomInSliceMap(rPtr, roomByPtr)
        rPtr = m.get(rPtr, D2ActiveRoomStrc.pRoomNext) >>> 0
      }
    }

    const world: FallenSliceWorld113c = {
      m,
      pGame: this.pGame,
      pTimer,
      unitsByKey,
      monsterById,
      playerById,
      clientById: this.sliceClientById,
      pathUnitByPtr,
      roomByPtr,
      minionIdsByLeaderId,
      lastFrameOrd: [],
      lastFrameDmg: [],
    }
    this.syncUnitIntoSliceWorld(world)
    return world
  }

  private syncUnitIntoSliceWorld(world: FallenSliceWorld113c = this.sliceWorld): void {
    const m = this.m
    for (let typeIdx = 0; typeIdx < 5; typeIdx++) {
      for (let b = 0; b < 128; b++) {
        const bucketIdx = ((typeIdx << 7) + b) | 0
        let pUnit = m.get(this.pGame, D2GameStrc.pUnitHash, bucketIdx) >>> 0
        let guard = 0
        while (pUnit !== 0 && guard++ < 256) {
          const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
          const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
          const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
          world.unitsByKey.set(`${uType}:${uId}`, pUnit)
          if (uType === UNIT_PLAYER) {
            world.playerById.set(uId, pUnit)
          } else if (uType === UNIT_MONSTER) {
            world.monsterById.set(uId, pUnit)
          }
          if (uType !== 4 && !world.pathUnitByPtr.has(pUnit)) {
            world.pathUnitByPtr.set(pUnit, {
              pUnit,
              pPath: m.get(pUnit, D2UnitStrc.pPath),
              dwUnitType: uType,
              dwClassId: classId,
              dwUnitId: uId,
              dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
              dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
              dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
            })
          }
          pUnit = m.get(pUnit, D2UnitStrc.pGameHashNext) >>> 0
        }
      }
    }
  }

  private initFreshKernelWorld(cfg: {
    readonly initSeed: number
    readonly objectSeed: number
    readonly difficulty: 0 | 1 | 2
    readonly expansion: boolean
    readonly hardcore: boolean
    readonly ladder: boolean
    readonly act: number
    readonly areaId: number
    readonly roomSubX: number
    readonly roomSubY: number
    readonly roomSubW: number
    readonly roomSubH: number
    readonly collisionMaskAt?: ((subX: number, subY: number) => number) | undefined
  }): { readonly pGame: number; readonly pRoom: number; readonly wGameId: number } {
    const m = this.m
    const pGame = m.alloc(D2GameStrc_SIZE) >>> 0
    const wGameId = 1
    m.setU16((pGame + 0x28) >>> 0, wGameId)
    m.setU8((pGame + 0x6d) >>> 0, cfg.difficulty & 0xff)
    m.setU32((pGame + 0x70) >>> 0, cfg.expansion ? 1 : 0)
    m.setU32((pGame + 0x74) >>> 0, cfg.ladder ? 1 : 0)
    m.setU32((pGame + 0x7c) >>> 0, cfg.initSeed >>> 0)
    m.setU32((pGame + 0x80) >>> 0, cfg.objectSeed >>> 0)
    m.set(pGame, D2GameStrc.dwGameFrame, 0)

    const pArena = m.alloc(0x20) >>> 0
    const arenaFlags = ((cfg.hardcore ? 0x0804 : 0x0004) | (cfg.expansion ? 0x00100000 : 0)) >>> 0
    m.setU32(pArena, cfg.areaId >>> 0)
    m.setU32((pArena + 0x08) >>> 0, arenaFlags)
    m.setU32((pGame + 0x1d28) >>> 0, pArena)

    EVENT_InitTimerQueue113c(m, pGame)

    const pAct = m.alloc(D2ActStrc_SIZE) >>> 0
    const pActMisc = m.alloc(0x4c0) >>> 0
    const pEnv = m.alloc(0x40) >>> 0
    const pLevel = m.alloc(0x240) >>> 0
    m.setU32((pLevel + 0x1d0) >>> 0, cfg.areaId >>> 0)

    const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
    const tileX = Math.trunc(cfg.roomSubX / 5)
    const tileY = Math.trunc(cfg.roomSubY / 5)
    const tileW = Math.trunc(cfg.roomSubW / 5)
    const tileH = Math.trunc(cfg.roomSubH / 5)
    m.setU32((pRoomEx + 0x08) >>> 0, pAct)
    m.setU32((pRoomEx + 0x24) >>> 0, TOWN_AREA_IDS_113C.has(cfg.areaId) ? 2 : 0)
    m.setU32((pRoomEx + 0x34) >>> 0, tileX >>> 0)
    m.setU32((pRoomEx + 0x38) >>> 0, tileY >>> 0)
    m.setU32((pRoomEx + 0x3c) >>> 0, tileW >>> 0)
    m.setU32((pRoomEx + 0x40) >>> 0, tileH >>> 0)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)

    const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pRoom, D2ActiveRoomStrc.pAct, pAct)
    m.set(pRoom, D2ActiveRoomStrc.nSubtileX, cfg.roomSubX >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nSubtileY, cfg.roomSubY >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, cfg.roomSubW >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, cfg.roomSubH >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nTileX, tileX >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nTileY, tileY >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nTileWidth, tileW >>> 0)
    m.set(pRoom, D2ActiveRoomStrc.nTileHeight, tileH >>> 0)
    m.setU32((pRoomEx + 0x28) >>> 0, pRoom)

    const ppRoomsNear = m.alloc(16) >>> 0
    m.setU32(ppRoomsNear, pRoom)
    m.set(pRoom, D2ActiveRoomStrc.ppRoomsNear, ppRoomsNear)
    m.set(pRoom, D2ActiveRoomStrc.nRoomsNear, 1)

    const maskFn =
      cfg.collisionMaskAt !== undefined
        ? cfg.collisionMaskAt
        : (sx: number, sy: number): number => {
            if (
              sx <= cfg.roomSubX ||
              sy <= cfg.roomSubY ||
              sx >= cfg.roomSubX + cfg.roomSubW - 1 ||
              sy >= cfg.roomSubY + cfg.roomSubH - 1
            ) {
              return 0x0001
            }
            return 0x0000
          }
    bindRoomCollisionGrid113c(m, pRoom, cfg.roomSubX, cfg.roomSubY, cfg.roomSubW, cfg.roomSubH, maskFn)

    m.set(pAct, D2ActStrc.dwMapSeed, cfg.initSeed >>> 0)
    m.set(pAct, D2ActStrc.nAct, cfg.act >>> 0)
    m.set(pAct, D2ActStrc.dwTownId, cfg.areaId >>> 0)
    m.set(pAct, D2ActStrc.pRoom1, pRoom)
    m.set(pAct, D2ActStrc.pEnvironment, pEnv)
    m.set(pAct, D2ActStrc.pActMisc, pActMisc)
    m.setU32((pGame + 0xbc + cfg.act * 4) >>> 0, pAct)

    return { pGame, pRoom, wGameId }
  }

  /** Subscribe to discrete uncompressed S2C game-stream packets emitted by `d2kern-113c`. */
  onUncompressedS2CPacket(cb: (pkt: UncompressedS2CPacketRecord113c) => void): () => void {
    this.uncompressedListeners.add(cb)
    return () => {
      this.uncompressedListeners.delete(cb)
    }
  }

  /** Subscribe to `Fog.#10223`-framed D2GS wire chunks emitted by `D2Net.#10002`. */
  onWirePacket(cb: (pkt: WireS2CPacketRecord113c) => void): () => void {
    this.wireListeners.add(cb)
    return () => {
      this.wireListeners.delete(cb)
    }
  }

  /** Drain captured discrete uncompressed S2C packets (optionally filtered by `clientId`). */
  drainUncompressedS2CPackets(clientId?: number): UncompressedS2CPacketRecord113c[] {
    if (clientId === undefined) {
      return this.uncompressedOutbox.splice(0, this.uncompressedOutbox.length)
    }
    const cid = clientId >>> 0
    const matched: UncompressedS2CPacketRecord113c[] = []
    const kept: UncompressedS2CPacketRecord113c[] = []
    for (let i = 0; i < this.uncompressedOutbox.length; i++) {
      const item = this.uncompressedOutbox[i]!
      if (item.clientId === cid) matched.push(item)
      else kept.push(item)
    }
    this.uncompressedOutbox.length = 0
    this.uncompressedOutbox.push(...kept)
    return matched
  }

  /** Drain captured `Fog.#10223` D2GS wire blocks (optionally filtered by `clientId`). */
  drainWirePackets(clientId?: number): WireS2CPacketRecord113c[] {
    if (clientId === undefined) {
      return this.wireOutbox.splice(0, this.wireOutbox.length)
    }
    const cid = clientId >>> 0
    const matched: WireS2CPacketRecord113c[] = []
    const kept: WireS2CPacketRecord113c[] = []
    for (let i = 0; i < this.wireOutbox.length; i++) {
      const item = this.wireOutbox[i]!
      if (item.clientId === cid) matched.push(item)
      else kept.push(item)
    }
    this.wireOutbox.length = 0
    this.wireOutbox.push(...kept)
    return matched
  }

  /**
   * Attach a server-side `ByteStream` endpoint (`client <-> D2gsKernelBridge113c`).
   * Automatically frames incoming C2S bytes (`0x01..0x6D`) and drains outgoing `D2Net.#10002`
   * packets onto `stream`.
   */
  attachClientStream(
    stream: ByteStream,
    options: D2gsAttachClientStreamOptions113c = {},
  ): D2gsBridgeClientHandle113c {
    const clientId =
      options.clientId !== undefined ? options.clientId >>> 0 : this.nextClientId++
    if (clientId >= this.nextClientId) {
      this.nextClientId = (clientId + 1) >>> 0
    }
    const wireFormat = options.wireFormat !== undefined ? options.wireFormat : 'compressed'
    const address = options.address !== undefined ? options.address : '127.0.0.1'
    const defaultCharName = options.defaultCharName !== undefined ? options.defaultCharName : 'Hero'
    const defaultCharClass: CharClassId =
      options.defaultCharClass !== undefined ? options.defaultCharClass : 1

    const entry = this.ensureClientEntry(clientId, {
      stream,
      address,
      defaultCharName,
      defaultCharClass,
      wireFormat,
    })

    const unsubData = stream.onData((chunk) => {
      if (entry.closed) return
      this.feedC2SStreamChunk(clientId, chunk)
    })
    const unsubClose = stream.onClose(() => {
      if (entry.closed) return
      entry.closed = true
      this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.disconnectClient_10000, this.m, [clientId])
    })
    entry.unsubs.push(unsubData, unsubClose)

    if (wireFormat === 'compressed' && options.sendCompressionGreeting !== false) {
      // `D2Net` initial server greeting `[0xAF, 0x01]` on Queue `0`:
      // `frameServerPacket113c(0, [0xAF, 0x01])` passes `[0xAF, 0x01]` raw uncompressed!
      this.m.setU8(this.pSendScratch, 0xaf)
      this.m.setU8((this.pSendScratch + 1) >>> 0, 0x01)
      this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.sendPacket_10002, this.m, [
        0,
        clientId,
        this.pSendScratch,
        2,
      ])
      this.drainSinkToConsumers()
    }

    return this.createClientHandle(entry)
  }

  /**
   * Create an in-memory `MemoryStream` pair, attach the server end to `D2gsKernelBridge113c`,
   * and connect a `D2gsSession` + `D2gsAdapter` on the client end through the full 1.13c
   * `[0xAF, 0x01] -> 0x68 -> 0x01/0x02 -> 0x6B -> 0x03..0x04` wire handshake.
   */
  connectD2gsAdapter(options: D2gsConnectAdapterOptions113c = {}): ConnectedD2gsAdapter113c {
    const [clientStream, serverStream] = createMemoryStreamPair()
    const defaultCharName = options.defaultCharName !== undefined ? options.defaultCharName : 'Hero'
    const defaultCharClass: CharClassId =
      options.defaultCharClass !== undefined ? options.defaultCharClass : 1
    const logon: D2gsGameLogonParams =
      options.logon !== undefined
        ? options.logon
        : {
            gameHash: 0xdeadbeef,
            gameToken: this.wGameId,
            charClass: defaultCharClass,
            versionByte: 0x0d,
            charName: defaultCharName,
          }

    const virtualClock: Clock =
      options.clock !== undefined
        ? options.clock
        : {
            now: () => (1000 + this.virtualTickMs) >>> 0,
            setTimeout: () => () => {},
            setInterval: () => () => {},
          }

    const session = new D2gsSession({
      stream: clientStream,
      logon,
      clock: virtualClock,
    })
    const adapter = new D2gsAdapter({
      session,
      tables: options.tables !== undefined ? options.tables : this.tables,
      clock: virtualClock,
    })
    if (options.onEvent !== undefined) {
      adapter.onEvent(options.onEvent)
    }

    const handle = this.attachClientStream(serverStream, {
      ...options,
      defaultCharName: logon.charName,
      defaultCharClass: logon.charClass as CharClassId,
      wireFormat: 'compressed',
    })

    return {
      clientId: handle.clientId,
      adapter,
      session,
      clientStream,
      serverStream,
      handle,
    }
  }

  /** Register a headless client (without a `ByteStream`) for direct packet-level testing. */
  registerHeadlessClient(
    clientId = this.nextClientId++,
    options: Omit<D2gsAttachClientStreamOptions113c, 'clientId'> = {},
  ): D2gsBridgeClientHandle113c {
    if (clientId >= this.nextClientId) {
      this.nextClientId = (clientId + 1) >>> 0
    }
    const entry = this.ensureClientEntry(clientId >>> 0, {
      stream: null,
      address: options.address !== undefined ? options.address : '127.0.0.1',
      defaultCharName: options.defaultCharName !== undefined ? options.defaultCharName : 'Hero',
      defaultCharClass: options.defaultCharClass !== undefined ? options.defaultCharClass : 1,
      wireFormat: options.wireFormat !== undefined ? options.wireFormat : 'compressed',
    })
    return this.createClientHandle(entry)
  }

  /**
   * Feed an arbitrary raw C2S stream chunk (potentially fragmented or coalesced multiple packets)
   * through `D2gsC2sFramer` (`D2Net.#10006` `0x6FBF65D0`) into `D2NetPacketSink113c`.
   */
  feedC2SStreamChunk(clientId: number, chunk: Uint8Array): number {
    const cid = clientId >>> 0
    const entry = this.ensureClientEntry(cid, {
      stream: null,
      address: '127.0.0.1',
      defaultCharName: 'Hero',
      defaultCharClass: 1,
      wireFormat: 'compressed',
    })
    const packets = entry.framer.push(chunk)
    for (let i = 0; i < packets.length; i++) {
      this.feedC2SPacket(cid, packets[i]!)
    }
    return packets.length
  }

  /**
   * Enqueue a discrete C2S packet (`0x01..0x6D`) onto `D2NetPacketSink113c` Queue `0` (`#10035`,
   * system/handshake `0x67..0x70`) or Queue `1` (`#10016`, gameplay `0x01..0x66`).
   */
  feedC2SPacket(clientId: number, packetBytes: Uint8Array): boolean {
    if (packetBytes.byteLength === 0) return false
    const cid = clientId >>> 0
    this.ensureClientEntry(cid, {
      stream: null,
      address: '127.0.0.1',
      defaultCharName: 'Hero',
      defaultCharClass: 1,
      wireFormat: 'compressed',
    })
    const opcode = packetBytes[0]!
    const queue: 0 | 1 = isSystemQueue0C2sOpcode113c(opcode) ? 0 : 1
    const ok = this.packetSink.enqueueC2SPacket(cid, packetBytes, queue)
    if (ok && queue === 0 && this.autoProcessSystemPackets) {
      this.pumpSystemQueue0()
      this.flushAllClientQueuesToSink()
      this.drainSinkToConsumers()
    }
    return ok
  }

  /**
   * Pump all pending `D2Net` Queue `0` (`#10035`) and Queue `1` (`#10016`) C2S packets into
   * `SparseMemory113c` (`D2Game.#10040` `0x6FC4E460`) without advancing `dwGameFrame`.
   */
  pumpInboundQueues(): number {
    let processed = 0
    processed += this.pumpSystemQueue0()
    processed += this.pumpGameplayQueue1()
    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return processed
  }

  /**
   * Step exactly one deterministic 25fps (`40ms`) 1.13c server frame:
   * 1. Dequeue & dispatch all inbound C2S packets (`Queue 0` `#10035` + `Queue 1` `#10016`)
   *    while `dwGameFrame` is at `N` (`D2Game.#10040` `0x6FC4E460`).
   * 2. Advance `GAME_UpdateGameFrame113c` (`0x6FC4E050`) to `N + 1` (`+40ms` virtual clock).
   * 3. Emit post-step movement/vital sync packets (`0x0D`, `0x96`, `0x95`) and drain `D2Net.#10002`
   *    outbox to uncompressed and `ByteStream` (`Fog.#10223`) consumers.
   */
  stepFrame(): number {
    this.pumpSystemQueue0()
    this.pumpGameplayQueue1()

    const preStateByClient = new Map<
      number,
      { mode: number; x: number; y: number; hp: number; mana: number; stamina: number }
    >()
    if (!this.adoptedSnapshot) {
      for (const entry of this.clients.values()) {
        if (entry.closed || entry.pPlayer === 0 || entry.pClient === 0) continue
        if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
        const pPlr = entry.pPlayer
        preStateByClient.set(entry.clientId, {
          mode: this.m.get(pPlr, D2UnitStrc.dwAnimMode) >>> 0,
          x: UNITS_GetX113c(this.m, pPlr) & 0xffff,
          y: UNITS_GetY113c(this.m, pPlr) & 0xffff,
          hp: (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_HITPOINTS, 0) >> 8) & 0x7fff,
          mana: (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_MANA, 0) >> 8) & 0x7fff,
          stamina: (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_STAMINA, 0) >> 8) & 0x7fff,
        })
      }
    }

    stepFallenSliceFrame113c(this.sliceWorld, [])
    this.virtualTickMs = (this.virtualTickMs + D2GS_KERNEL_FRAME_MS_113C) >>> 0

    if (!this.adoptedSnapshot) {
      for (const entry of this.clients.values()) {
        const pre = preStateByClient.get(entry.clientId)
        if (pre === undefined || entry.pPlayer === 0 || entry.pClient === 0) continue
        const pPlr = entry.pPlayer
        const curMode = this.m.get(pPlr, D2UnitStrc.dwAnimMode) >>> 0
        const curX = UNITS_GetX113c(this.m, pPlr) & 0xffff
        const curY = UNITS_GetY113c(this.m, pPlr) & 0xffff
        const curHp = (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_HITPOINTS, 0) >> 8) & 0x7fff
        const maxHp = Math.max(1, STATLIST_GetUnitStat113c(this.m, pPlr, STAT_MAXHP, 0) >> 8)
        const curMana = (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_MANA, 0) >> 8) & 0x7fff
        const curStamina = (STATLIST_GetUnitStat113c(this.m, pPlr, STAT_STAMINA, 0) >> 8) & 0x7fff

        const wasMoving =
          pre.mode === PLRMODE_WALK || pre.mode === PLRMODE_RUN || pre.mode === PLRMODE_TOWN_WALK
        const isNeutral = curMode === PLRMODE_NEUTRAL || curMode === PLRMODE_TOWN_NEUTRAL
        if (wasMoving && isNeutral) {
          const lifePct = Math.min(100, Math.max(0, Math.trunc((curHp * 100) / maxHp)))
          for (const recipient of this.clients.values()) {
            if (recipient.closed || recipient.pClient === 0) continue
            if (this.m.u32((recipient.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) {
              continue
            }
            D2GAME_PACKET_SendUnitStop113c(
              this.m,
              recipient.pClient,
              entry.playerUnitId,
              curX,
              curY,
              lifePct,
              this.gapBCallees,
            )
          }
          NET_SendPacket96_WalkVerify_6FCAB750_113c(
            this.m,
            entry.pClient,
            curStamina,
            curX,
            curY,
            (curX - pre.x) & 0xff,
            (curY - pre.y) & 0xff,
          )
        } else if (curHp !== pre.hp || curMana !== pre.mana || curStamina !== pre.stamina) {
          NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
            this.m,
            entry.pClient,
            curHp,
            curMana,
            curStamina,
            curX,
            curY,
            (curX - pre.x) & 0xff,
            (curY - pre.y) & 0xff,
          )
        }

        if (entry.pendingInteraction !== null) {
          this.checkPendingInteractionArrival(entry, curX, curY, isNeutral)
        }
      }
    }

    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return this.frame
  }

  /**
   * Advance deterministic simulation time by `deltaMs` milliseconds, stepping `floor(accum / 40)`
   * 25fps frames (`D2GS_KERNEL_FRAME_MS_113C = 40`). Returns the number of frames stepped.
   */
  advanceTimeMs(deltaMs: number): number {
    if (deltaMs <= 0) return 0
    this.accumTimeMs += deltaMs
    let stepped = 0
    while (this.accumTimeMs >= D2GS_KERNEL_FRAME_MS_113C) {
      this.accumTimeMs -= D2GS_KERNEL_FRAME_MS_113C
      this.stepFrame()
      stepped++
    }
    return stepped
  }

  /**
   * Spawn a 1.13c monster unit in the active room (`SparseMemory113c`) and broadcast `0xAC AssignNpc`
   * via `D2GAME_PACKET_SendMonsterAssign113c` (`0x6FCACA20`) to all in-game clients.
   */
  spawnMonsterInRoom(opts: SpawnBridgeMonsterOptions113c): {
    readonly pMonster: number
    readonly unitId: number
  } {
    if (!Number.isInteger(opts.classId) || opts.classId < 0 || opts.classId > 0xffffffff) {
      throw new RangeError(`Invalid 1.13c monster classId=${opts.classId} in spawnMonsterInRoom`)
    }
    const classId = opts.classId
    const monRow = MONSTATS_113C_ROWS[classId]
    if (monRow === undefined) {
      throw new Error(`Unknown 1.13c MonStats classId=${classId} in spawnMonsterInRoom`)
    }
    const pMonTxt = getMonStatsTxtPtrPure113c(this.m, classId)
    if (pMonTxt === 0) {
      throw new Error(
        `Missing 1.13c MonStats.txt memory record for classId=${classId} in spawnMonsterInRoom`,
      )
    }

    const unitId = opts.unitId !== undefined ? opts.unitId >>> 0 : this.allocUnitId()
    const animMode = opts.animMode !== undefined ? opts.animMode >>> 0 : 1
    const diff = this.difficultyValue
    const isNpc = isInteractiveNpcClassId113c(classId)
    const rawLevel = monRow.level[diff]
    if (rawLevel === undefined) {
      throw new Error(`Missing 1.13c MonStats level for classId=${classId}, difficulty=${diff}`)
    }
    const mlvl = rawLevel
    const monLvlRow = MONLVL_113C_ROWS[mlvl]
    if (monLvlRow === undefined) {
      throw new Error(
        `Missing 1.13c MonLvl.txt row for mlvl=${mlvl} (classId=${classId}, difficulty=${diff})`,
      )
    }
    let computedMaxHp: number
    let computedAc: number
    let computedBaseExp: number
    if (isNpc) {
      computedMaxHp = 0
      computedAc = 0
      computedBaseExp = 0
    } else {
      const minHpPct = monRow.minHP[diff]
      const maxHpPct = monRow.maxHP[diff]
      const acPct = monRow.ac[diff]
      const expPct = monRow.exp[diff]
      if (
        minHpPct === undefined ||
        maxHpPct === undefined ||
        acPct === undefined ||
        expPct === undefined
      ) {
        throw new Error(`Incomplete 1.13c MonStats stats for classId=${classId}, difficulty=${diff}`)
      }
      if (minHpPct === 0 && maxHpPct === 0) {
        computedMaxHp = 0
      } else {
        const scaledMinHp = Math.max(1, Math.floor((minHpPct * monLvlRow.hp[diff]) / 100))
        const scaledMaxHp = Math.max(
          scaledMinHp,
          Math.floor((maxHpPct * monLvlRow.hp[diff]) / 100),
        )
        const baseRolled =
          scaledMinHp < scaledMaxHp ? this.rng.randRange(scaledMinHp, scaledMaxHp) : scaledMaxHp
        computedMaxHp = Math.max(1, Math.floor((baseRolled * (this.playersXValue + 1)) / 2))
      }
      computedAc = Math.max(0, Math.floor((acPct * monLvlRow.ac[diff]) / 100))
      computedBaseExp =
        expPct > 0 ? Math.max(1, Math.floor((expPct * monLvlRow.xp[diff]) / 100)) : 0
    }
    const maxHp = opts.maxHp !== undefined ? Math.max(1, opts.maxHp | 0) : computedMaxHp
    const hp = opts.hp !== undefined ? Math.max(0, opts.hp | 0) : maxHp
    const tcIdx = diff * 4
    let tcName: string | null
    if (opts.tcName !== undefined) {
      tcName = opts.tcName
    } else {
      const rawTc = monRow.tc[tcIdx]
      if (rawTc === undefined) {
        throw new Error(
          `Missing 1.13c MonStats tc[${tcIdx}] for classId=${classId}, difficulty=${diff}`,
        )
      }
      const trimmedTc = rawTc.trim()
      tcName = trimmedTc === '' ? null : trimmedTc
    }

    const pMonster = UNITS_Create113c(this.m, UNIT_MONSTER, classId, unitId, this.pGame)
    this.m.set(pMonster, D2UnitStrc.dwAnimMode, animMode)
    this.m.setU32((pMonster + 0x80) >>> 0, this.pGame)

    const pMonData = this.m.alloc(D2MonsterDataStrc_SIZE) >>> 0
    this.m.set(pMonData, D2MonsterDataStrc.pMonStatsTxt, pMonTxt >>> 0)
    this.m.set(pMonster, D2UnitStrc.pUnitData, pMonData)

    this.initDynamicPathOnUnit(pMonster, opts.x, opts.y, this.defaultRoomPtr, false)
    UNITROOM_AddUnitToRoom113c(this.m, pMonster, this.defaultRoomPtr)
    this.insertUnitIntoGameHash(pMonster, UNIT_MONSTER, unitId)

    STATLIST_CreateEx113c(this.m, pMonster, 0x80000000, this.pGame)
    STATLIST_SetUnitStat113c(this.m, pMonster, STAT_LEVEL, mlvl, 0)
    STATLIST_SetUnitStat113c(this.m, pMonster, STAT_MAXHP, (maxHp << 8) | 0, 0)
    STATLIST_SetUnitStat113c(this.m, pMonster, STAT_HITPOINTS, (hp << 8) | 0, 0)
    STATLIST_SetUnitStat113c(this.m, pMonster, STAT_ARMORCLASS, computedAc, 0)
    STATLIST_SetUnitStat113c(this.m, pMonster, STAT_EXPERIENCE, computedBaseExp, 0)

    this.monsterMetaByUnitId.set(unitId, {
      classId,
      level: mlvl,
      baseExp: computedBaseExp,
      ac: computedAc,
      maxHp,
      isNpc,
      tcName,
    })

    this.syncUnitIntoSliceWorld()

    for (const entry of this.clients.values()) {
      if (entry.closed || entry.pClient === 0) continue
      if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
      D2GAME_PACKET_SendMonsterAssign113c(
        this.m,
        pMonster,
        entry.pClient,
        D2COMMON_SGPT_DATATABLES_VA_113C,
        this.gapBCallees,
      )
    }

    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return { pMonster, unitId }
  }

  /**
   * Spawn a 1.13c object unit (`UNIT_OBJECT = 2`) in the active room (`SparseMemory113c`) and
   * broadcast 14-byte S2C `0x51 AssignObject` to all in-game clients.
   */
  spawnObjectInRoom(opts: SpawnBridgeObjectOptions113c): {
    readonly pObject: number
    readonly unitId: number
  } {
    const UNIT_OBJECT_113C = 2
    const unitId = opts.unitId !== undefined ? opts.unitId >>> 0 : this.allocUnitId()
    const mode = opts.mode !== undefined ? opts.mode & 0xff : 0
    const flags = opts.flags !== undefined ? opts.flags & 0xff : 0

    const pObject = UNITS_Create113c(
      this.m,
      UNIT_OBJECT_113C,
      opts.classId >>> 0,
      unitId,
      this.pGame,
    )
    this.m.set(pObject, D2UnitStrc.dwAnimMode, mode)
    this.m.setU32((pObject + 0x80) >>> 0, this.pGame)

    const pStaticPath = this.m.alloc(0x20) >>> 0
    this.m.setU32(pStaticPath, this.defaultRoomPtr >>> 0)
    this.m.setU32((pStaticPath + 0x0c) >>> 0, opts.x >>> 0)
    this.m.setU32((pStaticPath + 0x10) >>> 0, opts.y >>> 0)
    this.m.set(pObject, D2UnitStrc.pPath, pStaticPath)

    const pObjData = this.m.alloc(0x38) >>> 0
    this.m.setU8((pObjData + 0x04) >>> 0, flags)
    this.m.set(pObject, D2UnitStrc.pUnitData, pObjData)

    if (this.defaultRoomPtr !== 0) {
      UNITROOM_AddUnitToRoom113c(this.m, pObject, this.defaultRoomPtr)
    }
    this.insertUnitIntoGameHash(pObject, UNIT_OBJECT_113C, unitId)
    this.syncUnitIntoSliceWorld()

    const pkt = this.encodePacket0x51AssignObject(unitId, opts.classId, opts.x, opts.y, mode, flags)
    for (const entry of this.clients.values()) {
      if (entry.closed || entry.pClient === 0) continue
      if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
      this.queueBytesToClientBuffer(this.m, entry.pClient, pkt)
      if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
        this.flushClientQueueToSink(entry)
      }
    }

    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return { pObject, unitId }
  }

  private encodePacket0x51AssignObject(
    unitId: number,
    classId: number,
    x: number,
    y: number,
    mode: number,
    flags: number,
  ): Uint8Array {
    const pkt = new Uint8Array(14)
    pkt[0] = 0x51
    pkt[1] = 0x02
    pkt[2] = unitId & 0xff
    pkt[3] = (unitId >>> 8) & 0xff
    pkt[4] = (unitId >>> 16) & 0xff
    pkt[5] = (unitId >>> 24) & 0xff
    pkt[6] = classId & 0xff
    pkt[7] = (classId >>> 8) & 0xff
    pkt[8] = x & 0xff
    pkt[9] = (x >>> 8) & 0xff
    pkt[10] = y & 0xff
    pkt[11] = (y >>> 8) & 0xff
    pkt[12] = mode & 0xff
    pkt[13] = flags & 0xff
    return pkt
  }

  /**
   * Mutate a player's stat in `SparseMemory113c` via `STATLIST_SetUnitStat113c` and emit the
   * exact 1.13c `0x1D` / `0x1E` / `0x1F` attribute packet via `D2GAME_PACKET_SendStatByteWordDword113c` (`0x6FCABD00`).
   */
  setPlayerStatAndSync(clientId: number, statId: number, value: number, layer = 0): boolean {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined || entry.closed || entry.pPlayer === 0 || entry.pClient === 0) {
      return false
    }
    STATLIST_SetUnitStat113c(this.m, entry.pPlayer, statId, value, layer)
    D2GAME_PACKET_SendStatByteWordDword113c(
      this.m,
      entry.pClient,
      statId,
      value,
      this.gapBCallees,
    )
    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return true
  }

  /**
   * Toggle a state on `pUnit` in `SparseMemory113c` (`STATES_ToggleState113c`) and broadcast
   * S2C `0xA7` (`DelayedState`), `0xA8` (`SetState` with `ItemStatCost` bit widths), or `0xA9` (`EndState`).
   */
  setUnitStateAndSync(
    pUnit: number,
    stateId: number,
    active: boolean,
    stateStats?: readonly ItemStat[],
  ): void {
    const u = pUnit >>> 0
    if (u === 0) return
    const unitType = this.m.get(u, D2UnitStrc.dwUnitType) & 0xff
    const unitId = this.m.get(u, D2UnitStrc.dwUnitId) >>> 0
    const st = stateId & 0xff

    STATES_ToggleState113c(this.m, u, st, active ? 1 : 0)

    if (active && stateStats !== undefined && stateStats.length > 0) {
      const pSubList = ITEMMODS_GetOrCreateStatList113c(this.m, 0, u, st, 0x40)
      if (pSubList !== 0) {
        for (let i = 0; i < stateStats.length; i++) {
          const s = stateStats[i]!
          STATLIST_SetUnitStat113c(
            this.m,
            u,
            s.statId,
            s.value,
            s.param !== undefined ? s.param : 0,
          )
        }
      }
      const pkt = this.encodePacket0xA8SetState(unitType, unitId, st, stateStats)
      for (const entry of this.clients.values()) {
        if (entry.closed || entry.pClient === 0) continue
        if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
        this.queueBytesToClientBuffer(this.m, entry.pClient, pkt)
      }
    } else if (active) {
      for (const entry of this.clients.values()) {
        if (entry.closed || entry.pClient === 0) continue
        if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
        const pkt = new Uint8Array(7)
        pkt[0] = 0xa7
        pkt[1] = unitType
        pkt[2] = unitId & 0xff
        pkt[3] = (unitId >>> 8) & 0xff
        pkt[4] = (unitId >>> 16) & 0xff
        pkt[5] = (unitId >>> 24) & 0xff
        pkt[6] = st
        this.queueBytesToClientBuffer(this.m, entry.pClient, pkt)
      }
    } else {
      for (const entry of this.clients.values()) {
        if (entry.closed || entry.pClient === 0) continue
        if (this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
        const pkt = new Uint8Array(7)
        pkt[0] = 0xa9
        pkt[1] = unitType
        pkt[2] = unitId & 0xff
        pkt[3] = (unitId >>> 8) & 0xff
        pkt[4] = (unitId >>> 16) & 0xff
        pkt[5] = (unitId >>> 24) & 0xff
        pkt[6] = st
        this.queueBytesToClientBuffer(this.m, entry.pClient, pkt)
      }
    }

    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
  }

  /** Emit 6-byte S2C `0x07 RoomReveal` (`MapAdd`) via `NET_SendPacket07_RoomTileCoords_6FCABF50_113c`. */
  revealRoomToClient(clientId: number, tileX: number, tileY: number, areaId = this.areaId): boolean {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined || entry.closed || entry.pClient === 0) return false
    NET_SendPacket07_RoomTileCoords_6FCABF50_113c(this.m, tileX, tileY, entry.pClient, areaId)
    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return true
  }

  /** Emit 6-byte S2C `0x08 RoomHide` (`MapRemove`) to `clientId`. */
  hideRoomFromClient(clientId: number, tileX: number, tileY: number, areaId = this.areaId): boolean {
    const entry = this.clients.get(clientId >>> 0)
    if (entry === undefined || entry.closed || entry.pClient === 0) return false
    const pkt = new Uint8Array(6)
    pkt[0] = 0x08
    pkt[1] = tileX & 0xff
    pkt[2] = (tileX >>> 8) & 0xff
    pkt[3] = tileY & 0xff
    pkt[4] = (tileY >>> 8) & 0xff
    pkt[5] = areaId & 0xff
    this.queueBytesToClientBuffer(this.m, entry.pClient, pkt)
    this.flushAllClientQueuesToSink()
    this.drainSinkToConsumers()
    return true
  }

  private encodePacket0xA8SetState(
    unitType: number,
    unitId: number,
    stateId: number,
    stats: readonly ItemStat[],
  ): Uint8Array {
    const bw = new BitWriter()
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i]!
      const meta = this.tables.getStatCost(s.statId)
      if (!meta || meta.sendBits <= 0) continue
      bw.writeBits(s.statId & 0x1ff, 9)
      if (meta.sendParamBits > 0) {
        bw.writeBits((s.param !== undefined ? s.param : 0) >>> 0, meta.sendParamBits)
      }
      bw.writeBits(s.value >>> 0, meta.sendBits)
    }
    bw.writeBits(0x1ff, 9)
    const statPayload = bw.toUint8Array()
    const totalLen = 8 + statPayload.byteLength
    const pkt = new Uint8Array(totalLen)
    pkt[0] = 0xa8
    pkt[1] = unitType & 0xff
    pkt[2] = unitId & 0xff
    pkt[3] = (unitId >>> 8) & 0xff
    pkt[4] = (unitId >>> 16) & 0xff
    pkt[5] = (unitId >>> 24) & 0xff
    pkt[6] = totalLen & 0xff
    pkt[7] = stateId & 0xff
    pkt.set(statPayload, 8)
    return pkt
  }

  private adoptSnapshotClients(): void {
    const m = this.m
    const clientPtrs = new Set<number>()

    let walk = m.u32((this.pGame + 0x88) >>> 0) >>> 0
    let guard = 0
    while (walk !== 0 && guard++ < 64 && !clientPtrs.has(walk)) {
      clientPtrs.add(walk)
      walk = m.u32((walk + 0x4a8) >>> 0) >>> 0
    }

    for (const pPlr of this.sliceWorld.playerById.values()) {
      const pPlrData = m.get(pPlr, D2UnitStrc.pUnitData) >>> 0
      if (pPlrData !== 0) {
        const pPlrClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        if (pPlrClient !== 0) {
          clientPtrs.add(pPlrClient)
        }
      }
    }

    for (const pClient of clientPtrs) {
      const clientId = m.u32((pClient + D2ClientStrcOffsets.dwClientId) >>> 0) >>> 0
      let pPlayer = m.u32((pClient + D2ClientStrcOffsets.pPlayer) >>> 0) >>> 0
      if (pPlayer === 0) {
        for (const candPlr of this.sliceWorld.playerById.values()) {
          const candData = m.get(candPlr, D2UnitStrc.pUnitData) >>> 0
          if (candData !== 0 && (m.u32((candData + 0x9c) >>> 0) >>> 0) === pClient) {
            pPlayer = candPlr >>> 0
            break
          }
        }
      }
      if (pPlayer === 0) {
        throw new Error(
          `adoptSnapshotClients: snapshot client (pClient=0x${pClient.toString(16)}, clientId=${clientId}) has null pPlayer`,
        )
      }
      const playerUnitId = m.get(pPlayer, D2UnitStrc.dwUnitId) >>> 0
      const rawClass = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
      const charClass = requireValidCharClassId113c(rawClass)
      const pPlrData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
      const charName = readFixedAscii16(m, pPlrData !== 0 ? pPlrData : ((pClient + 0x0d) >>> 0))

      this.packetSink.registerClient(clientId, '127.0.0.1', this.wGameId, 1)
      const entry: InternalClientEntry113c = {
        clientId,
        pClient,
        pPlayer,
        playerUnitId,
        charName,
        charClass,
        stream: null,
        framer: new D2gsC2sFramer(),
        wireFormat: 'uncompressed',
        unsubs: [],
        activeNpcUnitId: 0,
        lastNpcHandshakeUnitId: 0,
        activeWaypointUnitId: 0,
        activeVendorNpcId: 0,
        activeVendorMode: null,
        stashOpen: false,
        cubeOpen: false,
        pendingIdentifyScrollId: 0,
        weaponSet: this.initialWeaponSet,
        altLeftSkill: this.initialAltLeftSkill,
        altRightSkill: this.initialAltRightSkill,
        ownedItems: [],
        appliedEquipSkillBonuses: [],
        pendingInteraction: null,
        closed: false,
      }
      this.clients.set(clientId, entry)
      if ((clientId + 1) >>> 0 > this.nextClientId) {
        this.nextClientId = (clientId + 1) >>> 0
      }
      if ((playerUnitId + 1) >>> 0 > this.nextUnitId) {
        this.nextUnitId = (playerUnitId + 1) >>> 0
      }
    }

    if (this.clients.size === 0) {
      throw new Error('adoptSnapshotClients: no client/player units found in snapshot')
    }
  }

  private ensureClientEntry(
    clientId: number,
    cfg: {
      readonly stream: ByteStream | null
      readonly address: string
      readonly defaultCharName: string
      readonly defaultCharClass: CharClassId
      readonly wireFormat: 'compressed' | 'uncompressed'
    },
  ): InternalClientEntry113c {
    const existing = this.clients.get(clientId)
    if (existing !== undefined) return existing

    const validCharClass = requireValidCharClassId113c(cfg.defaultCharClass)
    this.packetSink.registerClient(clientId, cfg.address, this.wGameId, 1)
    const pClient = this.allocD2ClientStrc(clientId, cfg.defaultCharName, validCharClass)
    const entry: InternalClientEntry113c = {
      clientId,
      pClient,
      pPlayer: 0,
      playerUnitId: 0,
      charName: cfg.defaultCharName,
      charClass: validCharClass,
      stream: cfg.stream,
      framer: new D2gsC2sFramer(),
      wireFormat: cfg.wireFormat,
      unsubs: [],
      activeNpcUnitId: 0,
      lastNpcHandshakeUnitId: 0,
      activeWaypointUnitId: 0,
      activeVendorNpcId: 0,
      activeVendorMode: null,
      stashOpen: false,
      cubeOpen: false,
      pendingIdentifyScrollId: 0,
      weaponSet: this.initialWeaponSet,
      altLeftSkill: this.initialAltLeftSkill,
      altRightSkill: this.initialAltRightSkill,
      ownedItems: [],
      appliedEquipSkillBonuses: [],
      pendingInteraction: null,
      closed: false,
    }
    this.clients.set(clientId, entry)
    return entry
  }

  private createClientHandle(entry: InternalClientEntry113c): D2gsBridgeClientHandle113c {
    return {
      clientId: entry.clientId,
      pClient: entry.pClient,
      stream: entry.stream,
      wireFormat: entry.wireFormat,
      getPlayerPtr: () => entry.pPlayer >>> 0,
      getPlayerUnitId: () => entry.playerUnitId >>> 0,
      getClientState: () =>
        entry.pClient !== 0
          ? this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) >>> 0
          : 0,
      close: () => {
        if (entry.closed) return
        entry.closed = true
        for (let i = 0; i < entry.unsubs.length; i++) {
          entry.unsubs[i]!()
        }
        entry.unsubs.length = 0
        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.disconnectClient_10000, this.m, [
          entry.clientId,
        ])
        if (entry.stream !== null) {
          entry.stream.close({ kind: 'local' })
        }
      },
    }
  }

  private allocD2ClientStrc(
    clientId: number,
    charName: string,
    charClass: CharClassId,
  ): number {
    const m = this.m
    const pClient = m.alloc(D2CLIENT_STRC_SIZE_113C) >>> 0
    m.setU32((pClient + D2ClientStrcOffsets.dwClientId) >>> 0, clientId >>> 0)
    m.setU32((pClient + D2ClientStrcOffsets.dwClientState) >>> 0, 0)
    m.setU8((pClient + 0x0c) >>> 0, charClass & 0xff)
    writeFixedAscii16(m, (pClient + 0x0d) >>> 0, charName)
    m.setU32((pClient + 0x19c) >>> 0, this.virtualTickMs >>> 0)
    m.setU32((pClient + 0x1a8) >>> 0, this.pGame)
    m.setU8((pClient + 0x1ac) >>> 0, this.actIdx & 0xff)

    m.setU32((pClient + 0x1b8) >>> 0, 0)
    m.setU32((pClient + 0x1bc) >>> 0, 0)
    m.setU32((pClient + 0x1c0) >>> 0, 0)

    m.setU32((pClient + 0x3d4) >>> 0, 0x01)
    m.setU32((pClient + 0x3d8) >>> 0, this.virtualTickMs >>> 0)
    for (let slot = 0; slot < 16; slot++) {
      const slotAddr = (pClient + slot * 8) >>> 0
      m.setU16((slotAddr + 0x3dc) >>> 0, 0xffff)
      m.setU8((slotAddr + 0x3de) >>> 0, 0)
      m.setU32((slotAddr + 0x3e0) >>> 0, 0xffffffff)
    }

    const prevHead = m.u32((this.pGame + 0x88) >>> 0) >>> 0
    m.setU32((pClient + 0x4a8) >>> 0, prevHead)
    m.setU32((this.pGame + 0x88) >>> 0, pClient)
    return pClient
  }

  private allocUnitId(): number {
    return this.nextUnitId++ >>> 0
  }

  private insertUnitIntoGameHash(pUnit: number, unitType: number, unitId: number): void {
    const bucketIdx = (((unitType & 7) << 7) + (unitId & 0x7f)) | 0
    const prev = this.m.get(this.pGame, D2GameStrc.pUnitHash, bucketIdx) >>> 0
    this.m.set(pUnit, D2UnitStrc.pGameHashNext, prev)
    this.m.set(this.pGame, D2GameStrc.pUnitHash, pUnit >>> 0, bucketIdx)
  }

  private removeUnitFromGameHash(pUnit: number, unitType: number, unitId: number): void {
    const target = pUnit >>> 0
    if (target === 0) return
    const bucketIdx = (((unitType & 7) << 7) + (unitId & 0x7f)) | 0
    let cur = this.m.get(this.pGame, D2GameStrc.pUnitHash, bucketIdx) >>> 0
    let prev = 0
    let guard = 0
    while (cur !== 0 && guard++ < 256) {
      const next = this.m.get(cur, D2UnitStrc.pGameHashNext) >>> 0
      if (cur === target) {
        if (prev === 0) {
          this.m.set(this.pGame, D2GameStrc.pUnitHash, next, bucketIdx)
        } else {
          this.m.set(prev, D2UnitStrc.pGameHashNext, next)
        }
        this.m.set(cur, D2UnitStrc.pGameHashNext, 0)
        break
      }
      prev = cur
      cur = next
    }
    this.sliceWorld.unitsByKey.delete(`${unitType}:${unitId}`)
    if (unitType === UNIT_MONSTER) {
      this.sliceWorld.monsterById.delete(unitId)
    } else if (unitType === UNIT_PLAYER) {
      this.sliceWorld.playerById.delete(unitId)
    }
    this.sliceWorld.pathUnitByPtr.delete(target)
  }

  private queueBytesToClientBuffer(m: Memory113c, pClient: number, bytes: Uint8Array): void {
    if (pClient === 0 || bytes.byteLength === 0) return
    const pBuf =
      bytes.byteLength <= 0x140
        ? this.pSmallScratch
        : (m.alloc(bytes.byteLength) >>> 0)
    for (let i = 0; i < bytes.byteLength; i++) {
      m.setU8((pBuf + i) >>> 0, bytes[i]!)
    }
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pBuf, bytes.byteLength)
  }

  /**
   * `D2Game.#10040` (`0x6FC4E460..0x6FC4E483`) -> `0x6FCEAF30`:
   * Dequeues Queue `0` (`#10035`) system/handshake C2S packets (`0x67..0x70`) via
   * `IAT 0x6FD18B58` (`Fog.#10156`) into `SparseMemory113c`.
   */
  private pumpSystemQueue0(): number {
    let count = 0
    while (true) {
      const pktLen =
        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.dequeueQ0_10035, this.m, [
          this.pRecvScratch,
          0x200,
        ]) | 0
      if (pktLen < 0) break
      const clientId = this.m.u32(this.pRecvScratch) >>> 0
      const pPacket = (this.pRecvScratch + 4) >>> 0
      this.handleSystemQueue0Packet(clientId, pPacket, pktLen)
      count++
    }
    return count
  }

  /**
   * `D2Game.#10040` (`0x6FC4E485..0x6FC4E4A3`) -> `0x6FCEAE80` -> `0x6FCEC550`:
   * Dequeues Queue `1` (`#10016`) gameplay C2S packets (`0x01..0x66`) via
   * `IAT 0x6FD18B54` (`Fog.#10156`) into `SparseMemory113c` and dispatches via `C2S_DispatchPacketMem113c`.
   */
  private pumpGameplayQueue1(): number {
    let count = 0
    while (true) {
      const pktLen =
        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.dequeueQ1_10016, this.m, [
          this.pRecvScratch,
          0x200,
        ]) | 0
      if (pktLen < 0) break
      const clientId = this.m.u32(this.pRecvScratch) >>> 0
      const pPacket = (this.pRecvScratch + 4) >>> 0
      this.handleGameplayQueue1Packet(clientId, pPacket, pktLen)
      count++
    }
    return count
  }

  private handleSystemQueue0Packet(clientId: number, pPacket: number, pktLen: number): void {
    if (pktLen <= 0) return
    const entry = this.clients.get(clientId)
    if (entry === undefined || entry.closed) return
    const opcode = this.m.u8(pPacket)

    switch (opcode) {
      case 0x68: {
        // `0x68 GameLogon` (37B, `0x6FCEAFC2` -> `0x6FC4A740` -> `0x6FC4AC60`)
        if (pktLen < 37) return
        const rawClass = this.m.u8((pPacket + 7) >>> 0)
        const charClass = requireValidCharClassId113c(rawClass)
        const charName = readFixedAscii16(this.m, (pPacket + 21) >>> 0) || entry.charName
        entry.charClass = charClass
        entry.charName = charName
        this.m.setU8((entry.pClient + 0x0c) >>> 0, charClass)
        writeFixedAscii16(this.m, (entry.pClient + 0x0d) >>> 0, charName)
        this.m.setU32((entry.pClient + 0x19c) >>> 0, this.virtualTickMs >>> 0)

        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.setClientGameTag_10021, this.m, [
          clientId,
          this.wGameId,
        ])

        // `0x6FC4AC60`: emits 8B `0x01 GameFlags` + 1B `0x00 GameLoading` and sets `dwClientState = 1`
        CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(this.m, entry.pClient, this.pGame)

        // Transition `dwClientState` `1 -> 2` and emit 1B `0x02 GameLogonSuccess`
        this.queueBytesToClientBuffer(this.m, entry.pClient, new Uint8Array([0x02]))
        this.m.setU32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0, 2)
        break
      }

      case 0x6b: {
        // `0x6B EnterGame` (1B, `0x6FCEB0BA` -> `0x6FC4E360` + `0x6FC4D9B0` join state 3 -> 4)
        const curState = this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0)
        if (curState === 0) {
          CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(this.m, entry.pClient, this.pGame)
          this.queueBytesToClientBuffer(this.m, entry.pClient, new Uint8Array([0x02]))
        }
        this.m.setU32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0, 3)
        this.enterGameAndSyncWorld(entry)
        break
      }

      case 0x6d: {
        // `0x6D Ping` (9B: `[0x6D, u32 tickCount, u32 delay]`, `0x6FCEAFAA` -> `0x6FC6A780`)
        if (pktLen < 9) return
        const clientTick = this.m.u32((pPacket + 1) >>> 0) >>> 0
        const delay = this.m.u32((pPacket + 5) >>> 0) >>> 0
        const sample = (this.virtualTickMs - clientTick - delay) | 0
        const pingIdx = this.m.u32((entry.pClient + 0x500) >>> 0) >>> 0
        this.m.setU32((entry.pClient + 0x4b4 + (pingIdx & 0x0f) * 4) >>> 0, sample >>> 0)
        this.m.setU32((entry.pClient + 0x500) >>> 0, (pingIdx + 1) >>> 0)
        this.m.setU32((entry.pClient + 0x3d8) >>> 0, this.virtualTickMs >>> 0)

        const pong = new Uint8Array(33)
        pong[0] = 0x8f
        this.queueBytesToClientBuffer(this.m, entry.pClient, pong)
        break
      }

      case 0x69: {
        // `0x69 LeaveGame` (1B, `0x6FCEB08A` -> `0x6FC4DC70` -> `0x6FCAA4A0` `0x06 GameLogoutSuccess` + `#10000`)
        this.flushClientQueueToSink(entry)
        this.m.setU8(this.pSendScratch, 0x06)
        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.sendPacket_10002, this.m, [
          1,
          clientId,
          this.pSendScratch,
          1,
        ])
        this.drainSinkToConsumers()

        if (entry.pPlayer !== 0) {
          const pRoom = UNITS_GetRoom113c(this.m, entry.pPlayer) >>> 0
          if (pRoom !== 0) {
            UNITROOM_RemoveUnitFromRoom113c(this.m, entry.pPlayer)
            DUNGEON_RemoveClientFromRoom113c(this.m, pRoom, entry.pClient)
          }
        }
        this.m.setU32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0, 5)
        this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.disconnectClient_10000, this.m, [
          clientId,
        ])
        break
      }

      default:
        break
    }
  }

  private enterGameAndSyncWorld(entry: InternalClientEntry113c): void {
    const m = this.m
    if (entry.pPlayer === 0) {
      let existingPlayer = 0
      const base = (this.pGame + 0x1120) >>> 0
      for (let b = 0; b < 128 && existingPlayer === 0; b++) {
        const candidate = m.u32((base + b * 4) >>> 0) >>> 0
        if (candidate !== 0 && this.clients.size === 1) {
          const pPlrData = m.get(candidate, D2UnitStrc.pUnitData) >>> 0
          const boundCli = pPlrData !== 0 ? (m.u32((pPlrData + 0x9c) >>> 0) >>> 0) : 0
          if (boundCli === 0 || boundCli === entry.pClient) {
            existingPlayer = candidate
          }
        }
      }

      if (existingPlayer !== 0) {
        entry.pPlayer = existingPlayer
        entry.playerUnitId = m.get(existingPlayer, D2UnitStrc.dwUnitId) >>> 0
        const pPlrData = m.get(existingPlayer, D2UnitStrc.pUnitData) >>> 0
        if (pPlrData !== 0) {
          m.setU32((pPlrData + 0x9c) >>> 0, entry.pClient)
        }
      } else {
        entry.pPlayer = this.spawnPlayerUnitForClient(entry)
      }
    }

    const pPlayer = entry.pPlayer >>> 0
    const pRoom = (UNITS_GetRoom113c(m, pPlayer) || this.defaultRoomPtr) >>> 0

    m.setU32((entry.pClient + 0x16c) >>> 0, UNIT_PLAYER)
    m.setU32((entry.pClient + 0x170) >>> 0, entry.playerUnitId >>> 0)
    m.setU32((entry.pClient + D2ClientStrcOffsets.pPlayer) >>> 0, pPlayer)
    m.setU32((entry.pClient + 0x1b4) >>> 0, pRoom)

    if (pRoom !== 0) {
      DUNGEON_AddClientToRoom113c(m, pRoom, entry.pClient)
    }

    this.sliceClientById.set(entry.clientId, pPlayer)
    this.syncUnitIntoSliceWorld()

    const flushIfNearCapacity = (): void => {
      if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
        this.flushClientQueueToSink(entry)
      }
    }

    // 1. `0x0B GameHandshake` (6B, `0x6FCAC060` -> `D2Client.dll 0x6FB5D6E0` assigns local `selfId`)
    const pkt0b = new Uint8Array(6)
    pkt0b[0] = 0x0b
    pkt0b[1] = UNIT_PLAYER
    new DataView(pkt0b.buffer).setUint32(2, entry.playerUnitId >>> 0, true)
    this.queueBytesToClientBuffer(m, entry.pClient, pkt0b)

    // 2. `0x59 AssignPlayer` (26B) + `0x75 PlayerPartyInfo` (13B) (`0x6FCAD710`)
    // Must precede `0x53 EnvironmentSync` because `D2Client.dll 0x6FB5E9C0` dereferences `player->pAct`.
    const posX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const posY = UNITS_GetY113c(m, pPlayer) & 0xffff
    NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(
      m,
      entry.pClient,
      entry.charClass,
      entry.playerUnitId,
      (entry.pClient + 0x0d) >>> 0,
      posX,
      posY,
    )

    // 2. `0x03 LoadAct` (12B) + `0x53 EnvironmentSync` (10B) (`0x6FCBD610`)
    CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, entry.pClient, this.pGame)

    // 3. `0x07 RoomReveal` (`MapAdd`, 6B) (`0x6FCABF50`)
    this.activeRevealedRooms = this.collectActiveRevealedRooms(pRoom)
    for (let i = 0; i < this.activeRevealedRooms.length; i++) {
      const rm = this.activeRevealedRooms[i]!
      NET_SendPacket07_RoomTileCoords_6FCABF50_113c(
        m,
        rm.tileX & 0xffff,
        rm.tileY & 0xffff,
        entry.pClient,
        rm.areaId & 0xff,
      )
      flushIfNearCapacity()
    }

    // 4. `0x15 ReassignPlayer` (11B, `bFlash = 1`) (`0x6FCEBB10`)
    NET_SendReassignUnitPacket15_113c(m, pPlayer, entry.pClient, 1)

    // 5a. Owned items (`0x9D` equipped/socket + `0x9C` inventory/belt/stash/cube)
    this.emitInitialItemsToClient(entry, flushIfNearCapacity)

    // 5b. Base skill levels (`0x94 BaseSkillLevels`, emitted when >= 1 learned skill has baseLevel > 0)
    const pSkillsList = m.get(pPlayer, D2UnitStrc.pSkills) >>> 0
    if (pSkillsList !== 0) {
      const learnedBaseSkills: Array<{ readonly skillId: number; readonly baseLevel: number }> = []
      let pSk = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillsList) >>> 0
      let skGuard = 0
      while (pSk !== 0 && skGuard++ < 512) {
        if ((SKILLS_GetOwnerItemGuid113c(m, pSk) >>> 0) === 0xffffffff) {
          const skId = SKILLS_GetSkillIdFromSkill113c(m, pSk, 0, 0) | 0
          const baseLvl = SKILLS_GetSkillLevel113c(m, pPlayer, pSk, 0) | 0
          if (skId > 0 && baseLvl > 0) {
            learnedBaseSkills.push({ skillId: skId, baseLevel: Math.min(255, baseLvl) })
          }
        }
        pSk = SKILLS_GetNextSkill113c(m, pSk) >>> 0
      }
      if (learnedBaseSkills.length > 0) {
        learnedBaseSkills.sort((a, b) => a.skillId - b.skillId)
        for (let start = 0; start < learnedBaseSkills.length; start += 160) {
          const chunk = learnedBaseSkills.slice(start, start + 160)
          const pkt94 = new Uint8Array(6 + chunk.length * 3)
          const dv94 = new DataView(pkt94.buffer)
          pkt94[0] = 0x94
          pkt94[1] = chunk.length & 0xff
          dv94.setUint32(2, entry.playerUnitId >>> 0, true)
          for (let k = 0; k < chunk.length; k++) {
            const item = chunk[k]!
            dv94.setUint16(6 + k * 3, item.skillId & 0xffff, true)
            pkt94[6 + k * 3 + 2] = item.baseLevel & 0xff
          }
          this.queueBytesToClientBuffer(m, entry.pClient, pkt94)
          flushIfNearCapacity()
        }
      }
    }

    // 5c. Bound skill hotkeys (`0x7B AssignSkillHotkey`, 8B per bound slot `0..15`)
    for (let slot = 0; slot < 16; slot++) {
      const slotAddr = (entry.pClient + slot * 8) >>> 0
      const wSkillId = m.u16((slotAddr + 0x3dc) >>> 0) & 0xffff
      if (wSkillId === 0xffff) continue
      const bLeft = m.u8((slotAddr + 0x3de) >>> 0) & 0x01
      const dwItemGuid = m.u32((slotAddr + 0x3e0) >>> 0) >>> 0
      const word = ((wSkillId & 0x0fff) | (bLeft !== 0 ? 0x8000 : 0)) & 0xffff
      const pkt7b = new Uint8Array(8)
      const dv7b = new DataView(pkt7b.buffer)
      pkt7b[0] = 0x7b
      pkt7b[1] = slot & 0xff
      dv7b.setUint16(2, word, true)
      dv7b.setUint32(4, dwItemGuid, true)
      this.queueBytesToClientBuffer(m, entry.pClient, pkt7b)
      flushIfNearCapacity()
    }

    // 5d. Initial left & right hand skill assignment (`0x23 AssignSkill`)
    let liveLeftSkill = this.initialLeftSkill
    let liveRightSkill = this.initialRightSkill
    if (pSkillsList !== 0) {
      const pLeft = SKILLS_GetLeftSkillFromSkillList113c(m, pSkillsList) >>> 0
      if (pLeft !== 0) {
        const leftId = SKILLS_GetSkillIdFromSkill113c(m, pLeft, 0, 0) | 0
        if (leftId >= 0) liveLeftSkill = leftId
      }
      const pRight = m.get(pSkillsList, D2SkillListStrc.pRightSkill) >>> 0
      if (pRight !== 0) {
        const rightId = SKILLS_GetSkillIdFromSkill113c(m, pRight, 0, 0) | 0
        if (rightId >= 0) liveRightSkill = rightId
      }
    }
    NET_SendPacket0x23_AssignSkill113c(
      m,
      UNIT_PLAYER,
      entry.playerUnitId,
      entry.pClient,
      1,
      liveLeftSkill,
      -1,
      {
        queuePacket: (mem, cli, pktPtr, pktSize) => {
          NET_QueuePacketToClientBuffer113c(mem, cli, 1, pktPtr, pktSize)
        },
      },
    )
    NET_SendPacket0x23_AssignSkill113c(
      m,
      UNIT_PLAYER,
      entry.playerUnitId,
      entry.pClient,
      0,
      liveRightSkill,
      -1,
      {
        queuePacket: (mem, cli, pktPtr, pktSize) => {
          NET_QueuePacketToClientBuffer113c(mem, cli, 1, pktPtr, pktSize)
        },
      },
    )

    // 6. Base attribute bootstrap (`0x1D` / `0x1E` / `0x1F`) (`0x6FCABD00`)
    for (let i = 0; i < INITIAL_SYNC_STAT_IDS_113C.length; i++) {
      const statId = INITIAL_SYNC_STAT_IDS_113C[i]!
      const val = STATLIST_GetUnitStat113c(m, pPlayer, statId, 0) | 0
      D2GAME_PACKET_SendStatByteWordDword113c(m, entry.pClient, statId, val, this.gapBCallees)
    }

    // 7. Active unit states (`0xA7` / `0xA8` / `0xAA`) on player (`0x6FC9A940`)
    UNIT_SendAllStatesBitstreamToClient113c(m, pPlayer, entry.pClient)
    flushIfNearCapacity()

    // 8. Active room monsters (`0xAC AssignNpc`, `0x6FCACA20`) & objects (`0x51 AssignObject`)
    if (pRoom !== 0) {
      let pUnit = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst) >>> 0
      let guard = 0
      while (pUnit !== 0 && guard++ < 2048) {
        const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
        if (uType === UNIT_MONSTER) {
          D2GAME_PACKET_SendMonsterAssign113c(
            m,
            pUnit,
            entry.pClient,
            D2COMMON_SGPT_DATATABLES_VA_113C,
            this.gapBCallees,
          )
          flushIfNearCapacity()
        } else if (uType === 2) {
          const objId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
          const objClass = m.get(pUnit, D2UnitStrc.dwClassId) & 0xffff
          const objX = UNITS_GetX113c(m, pUnit) & 0xffff
          const objY = UNITS_GetY113c(m, pUnit) & 0xffff
          const objMode = m.get(pUnit, D2UnitStrc.dwAnimMode) & 0xff
          const pObjData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
          const objFlags = pObjData !== 0 ? m.u8((pObjData + 0x04) >>> 0) : 0
          this.queueBytesToClientBuffer(
            m,
            entry.pClient,
            this.encodePacket0x51AssignObject(objId, objClass, objX, objY, objMode, objFlags),
          )
          flushIfNearCapacity()
        }
        pUnit = m.get(pUnit, D2UnitStrc.pRoomUnitNext) >>> 0
      }
      for (const rec of this.groundItems.values()) {
        if (rec.areaId !== this.areaId) continue
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'groundSpawn',
          itemId: rec.item.id,
          code: rec.item.code,
          x: rec.x,
          y: rec.y,
          container: 'ground',
          item: rec.item,
        })
      }
    }

    // 9. `0x04 LoadDone` (1B) + `dwClientState = 4` (`0x6FC4DA98..0x6FC4DAAC`)
    this.queueBytesToClientBuffer(m, entry.pClient, new Uint8Array([0x04]))
    m.setU32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0, 4)
  }

  private hydrateInitialItemsForClient(entry: InternalClientEntry113c): void {
    if (entry.ownedItems.length > 0) return
    const items = this.initialItems
    if (items === undefined || items.length === 0) return

    let currentHostItemId = 0
    const normalizeOwned = (
      rawItem: ItemData,
      ownerId: number,
      isSocketChild: boolean,
    ): ItemData => {
      const assignedId =
        rawItem.id !== undefined && rawItem.id > 0
          ? rawItem.id >>> 0
          : rawItem.itemId !== undefined && rawItem.itemId > 0
            ? rawItem.itemId >>> 0
            : this.allocUnitId()
      if (assignedId >= this.nextUnitId) {
        this.nextUnitId = (assignedId + 1) >>> 0
      }
      const loc = isSocketChild ? 6 : (rawItem.location ?? 0)
      const storePage =
        loc === 0
          ? (rawItem.storePage ?? rawItem.storagePage ?? 1) || 1
          : 0
      const container =
        loc === 6
          ? 'socket'
          : loc === 1
            ? 'equipment'
            : loc === 2
              ? 'belt'
              : loc === 4
                ? 'cursor'
                : storePage === 5
                  ? 'stash'
                  : storePage === 4
                    ? 'cube'
                    : 'inventory'
      const bodyLoc = loc === 1 ? (rawItem.bodyLoc ?? rawItem.equippedSlot ?? 0) : 0
      return {
        ...rawItem,
        id: assignedId,
        itemId: assignedId,
        location: loc,
        container,
        bodyLoc,
        equippedSlot: bodyLoc,
        equipped: loc === 1,
        inSocket: isSocketChild,
        storePage,
        storagePage: storePage,
        ownerType: isSocketChild ? 4 : 0,
        ownerId,
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const isFlatChild = item.location === 6 || Boolean(item.inSocket)
      if (isFlatChild) {
        if (currentHostItemId !== 0) {
          entry.ownedItems.push(normalizeOwned(item, currentHostItemId, true))
        }
        continue
      }
      const host = normalizeOwned(item, entry.playerUnitId, false)
      currentHostItemId = host.id
      entry.ownedItems.push(host)
      const nested = item.socketedItems
      if (nested !== undefined && nested.length > 0) {
        const nextIsFlat =
          i + 1 < items.length &&
          (items[i + 1]!.location === 6 || Boolean(items[i + 1]!.inSocket))
        if (!nextIsFlat) {
          for (let c = 0; c < nested.length; c++) {
            entry.ownedItems.push(
              normalizeOwned(nested[c]! as ItemData, currentHostItemId, true),
            )
          }
        }
      }
    }
  }

  private emitInitialItemsToClient(
    entry: InternalClientEntry113c,
    flushIfNearCapacity: () => void,
  ): void {
    this.hydrateInitialItemsForClient(entry)
    const items = entry.ownedItems
    if (items.length === 0) return

    const m = this.m
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const loc = item.location ?? 0
      const container =
        loc === 6
          ? 'socket'
          : loc === 1
            ? 'equipment'
            : loc === 2
              ? 'belt'
              : loc === 4
                ? 'cursor'
                : (item.storePage ?? item.storagePage) === 5
                  ? 'stash'
                  : (item.storePage ?? item.storagePage) === 4
                    ? 'cube'
                    : 'inventory'
      const pkts = serverEventToS2cPackets(
        {
          type: 'ItemEvent',
          action: loc === 1 ? 'equip' : 'add',
          container,
          ownerId: item.ownerId ?? entry.playerUnitId,
          itemId: item.id,
          item,
        },
        this.tables,
      )
      for (let p = 0; p < pkts.length; p++) {
        this.queueBytesToClientBuffer(m, entry.pClient, pkts[p]!)
        flushIfNearCapacity()
      }
    }
  }

  private recomputeEquippedItemSkillBonuses(entry: InternalClientEntry113c): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const m = this.m

    // 1. Revert previously applied item-granted skill bonuses cleanly in `SparseMemory113c`.
    for (let i = 0; i < entry.appliedEquipSkillBonuses.length; i++) {
      const prev = entry.appliedEquipSkillBonuses[i]!
      const cur = STATLIST_GetUnitStat113c(m, pPlayer, prev.statId, prev.param) | 0
      STATLIST_SetUnitStat113c(m, pPlayer, prev.statId, (cur - prev.value) | 0, prev.param)
    }
    entry.appliedEquipSkillBonuses.length = 0

    // 2. Accumulate skill bonuses across actively equipped items (`bodyLoc 1..10`) + their socket children.
    const items = entry.ownedItems
    if (items.length === 0) return

    const applyStats = (stats: readonly ItemStat[] | undefined): void => {
      if (stats === undefined) return
      for (let s = 0; s < stats.length; s++) {
        const st = stats[s]!
        const val = st.value | 0
        if (val === 0) continue
        const param = (st.param ?? 0) | 0
        switch (st.statId) {
          case STAT_ITEM_SINGLESKILL:
          case STAT_ITEM_NONCLASSSKILL: {
            if (param > 0 && param < SKILLS_TXT_COUNT_113C) {
              const prev = STATLIST_GetUnitStat113c(m, pPlayer, st.statId, param) | 0
              STATLIST_SetUnitStat113c(m, pPlayer, st.statId, (prev + val) | 0, param)
              entry.appliedEquipSkillBonuses.push({ statId: st.statId, param, value: val })
              if (SKILLS_GetSkillById113c(m, pPlayer, param, -1) === 0) {
                SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, param, 0, 0, 0, 0)
              }
            }
            break
          }
          case STAT_ITEM_ADDCLASSSKILLS:
          case STAT_ITEM_ADDSKILL_TAB: {
            const prev = STATLIST_GetUnitStat113c(m, pPlayer, st.statId, param) | 0
            STATLIST_SetUnitStat113c(m, pPlayer, st.statId, (prev + val) | 0, param)
            entry.appliedEquipSkillBonuses.push({ statId: st.statId, param, value: val })
            break
          }
          case STAT_ITEM_ALLSKILLS: {
            const prev = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ITEM_ALLSKILLS, 0) | 0
            STATLIST_SetUnitStat113c(m, pPlayer, STAT_ITEM_ALLSKILLS, (prev + val) | 0, 0)
            entry.appliedEquipSkillBonuses.push({
              statId: STAT_ITEM_ALLSKILLS,
              param: 0,
              value: val,
            })
            break
          }
          default:
            break
        }
      }
    }

    const activeHostIds = new Set<number>()
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const isFlatChild = item.location === 6 || Boolean(item.inSocket)
      if (isFlatChild) continue
      const bodyLoc = item.bodyLoc ?? item.equippedSlot ?? 0
      const isActiveEquipped =
        (item.location === 1 || Boolean(item.equipped)) && bodyLoc >= 1 && bodyLoc <= 10
      if (!isActiveEquipped) continue
      activeHostIds.add(item.id)
      applyStats(item.stats)
      applyStats(item.runewordStats)
      if (item.setBonusStats !== undefined) {
        for (let sb = 0; sb < item.setBonusStats.length; sb++) {
          applyStats(item.setBonusStats[sb]!.stats)
        }
      }
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const isFlatChild = item.location === 6 || Boolean(item.inSocket)
      if (!isFlatChild) continue
      if (item.ownerId !== undefined && activeHostIds.has(item.ownerId)) {
        applyStats(item.stats)
      }
    }
  }

  private initDynamicPathOnUnit(
    pUnit: number,
    x: number,
    y: number,
    pRoom: number,
    isPlayer: boolean,
  ): number {
    const m = this.m
    const pPath = m.alloc(D2DynamicPathStrc_SIZE) >>> 0
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.set(pPath, D2DynamicPathStrc.wOffsetX, 0x8000)
    m.set(pPath, D2DynamicPathStrc.wPosX, x & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wOffsetY, 0x8000)
    m.set(pPath, D2DynamicPathStrc.wPosY, y & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wTargetX, x & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wTargetY, y & 0xffff)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom >>> 0)
    m.set(pPath, D2DynamicPathStrc.pUnit, pUnit >>> 0)
    m.set(pPath, D2DynamicPathStrc.dwPathType, 2)
    m.set(pPath, D2DynamicPathStrc.dwUnitSize, 2)
    m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, 1)
    m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, isPlayer ? 0x80 : 0x100)
    m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, isPlayer ? 0x1c09 : 0x3c01)
    return pPath
  }

  private spawnPlayerUnitForClient(entry: InternalClientEntry113c): number {
    const m = this.m
    const unitId = this.allocUnitId()
    entry.playerUnitId = unitId

    const pPlayer = UNITS_Create113c(m, UNIT_PLAYER, entry.charClass, unitId, this.pGame)
    m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
    m.setU32((pPlayer + 0x80) >>> 0, this.pGame)

    const pPlayerData = m.alloc(D2PlayerDataStrc_SIZE) >>> 0
    writeFixedAscii16(m, pPlayerData, entry.charName)
    m.setU32((pPlayerData + 0x9c) >>> 0, entry.pClient)
    for (let d = 0; d < 3; d++) {
      const pQuestRec = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
      const pQuestBuf = m.u32(pQuestRec) >>> 0
      const initQuest = this.initialQuestBuffers[d as 0 | 1 | 2]
      for (let b = 0; b < 96; b++) {
        m.setU8((pQuestBuf + b) >>> 0, initQuest[b]!)
      }
      m.setU32((pPlayerData + 0x10 + d * 4) >>> 0, pQuestRec)

      const initWp = this.initialWaypointBuffers[d as 0 | 1 | 2]
      for (let b = 0; b < 16; b++) {
        m.setU8((this.pSmallScratch + b) >>> 0, initWp[b]!)
      }
      const pWpData = m.alloc(0x10) >>> 0
      WAYPOINT_CopyAndValidateWaypointData113c(m, this.pSmallScratch, pWpData)
      m.setU32((pPlayerData + 0x1c + d * 4) >>> 0, pWpData)
    }
    m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)

    const pInventory = m.alloc(D2InventoryStrc_SIZE) >>> 0
    m.set(pInventory, D2InventoryStrc.dwSignature, 0x01020304)
    m.set(pInventory, D2InventoryStrc.pOwner, pPlayer)
    m.set(pInventory, D2InventoryStrc.dwWeaponId, 0xffffffff)
    m.set(pPlayer, D2UnitStrc.pInventory, pInventory)

    this.initDynamicPathOnUnit(pPlayer, this.spawnX, this.spawnY, this.defaultRoomPtr, true)
    if (this.defaultRoomPtr !== 0) {
      UNITROOM_AddUnitToRoom113c(m, pPlayer, this.defaultRoomPtr)
    }
    this.insertUnitIntoGameHash(pPlayer, UNIT_PLAYER, unitId)

    STATLIST_CreateEx113c(m, pPlayer, 0x80000000, this.pGame)
    const charStats = getCharStatsPure113c(entry.charClass)
    if (
      charStats.str === undefined ||
      charStats.dex === undefined ||
      charStats.vit === undefined ||
      charStats.int === undefined ||
      charStats.hpAdd === undefined ||
      charStats.stamina === undefined
    ) {
      throw new Error(`Incomplete 1.13c CharStats record for classId=${entry.charClass}`)
    }
    const str = charStats.str
    const dex = charStats.dex
    const vit = charStats.vit
    const ene = charStats.int
    const hpAdd = charStats.hpAdd
    const stamBase = charStats.stamina
    const baseHp = (vit + hpAdd) << 8
    const baseMana = ene << 8
    const baseStam = stamBase << 8

    STATLIST_SetUnitStat113c(m, pPlayer, STAT_STRENGTH, str, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_ENERGY, ene, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_DEXTERITY, dex, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_VITALITY, vit, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_STATPTS, 5, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_NEWSKILLS, 1, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, baseHp, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXHP, baseHp, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, baseMana, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXMANA, baseMana, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, baseStam, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, baseStam, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_LEVEL, 1, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_EXPERIENCE, 0, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, 0, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_VELOCITYPERCENT, 100, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_ATTACKRATE, 100, 0)
    if (this.initialPlayerStats !== undefined) {
      for (const [rawKey, val] of Object.entries(this.initialPlayerStats)) {
        const statId = Number(rawKey)
        if (Number.isInteger(statId) && statId >= 0) {
          STATLIST_SetUnitStat113c(m, pPlayer, statId, val | 0, 0)
        }
      }
    }

    const pSkills = SKILLS_AllocSkillList113c(m, 0) >>> 0
    m.set(pPlayer, D2UnitStrc.pSkills, pSkills)
    SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 0, 1, 1, 0, 0)
    entry.pPlayer = pPlayer
    this.hydrateInitialItemsForClient(entry)
    this.recomputeEquippedItemSkillBonuses(entry)

    if (this.initialSkillLevels !== undefined) {
      for (const [rawKey, rawLvl] of Object.entries(this.initialSkillLevels)) {
        const skillId = Number(rawKey)
        const baseLvl = Math.max(0, Math.min(255, Math.floor(Number(rawLvl) || 0)))
        if (
          Number.isInteger(skillId) &&
          skillId > 0 &&
          skillId < SKILLS_TXT_COUNT_113C &&
          baseLvl > 0
        ) {
          SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, skillId, baseLvl, 1, 0, 0)
        }
      }
      if (
        this.initialLeftSkill > 0 &&
        this.initialLeftSkill < SKILLS_TXT_COUNT_113C &&
        SKILLS_GetSkillById113c(m, pPlayer, this.initialLeftSkill, -1) === 0
      ) {
        SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, this.initialLeftSkill, 0, 0, 0, 0)
      }
      if (
        this.initialRightSkill > 0 &&
        this.initialRightSkill < SKILLS_TXT_COUNT_113C &&
        SKILLS_GetSkillById113c(m, pPlayer, this.initialRightSkill, -1) === 0
      ) {
        SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, this.initialRightSkill, 0, 0, 0, 0)
      }
    } else {
      if (this.initialLeftSkill > 0 && this.initialLeftSkill < SKILLS_TXT_COUNT_113C) {
        SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, this.initialLeftSkill, 1, 1, 0, 0)
      }
      if (
        this.initialRightSkill > 0 &&
        this.initialRightSkill < SKILLS_TXT_COUNT_113C &&
        this.initialRightSkill !== this.initialLeftSkill
      ) {
        SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, this.initialRightSkill, 1, 1, 0, 0)
      }
    }

    const leftId =
      this.initialLeftSkill >= 0 &&
      this.initialLeftSkill < SKILLS_TXT_COUNT_113C &&
      SKILLS_GetSkillById113c(m, pPlayer, this.initialLeftSkill, -1) !== 0
        ? this.initialLeftSkill
        : 0
    const rightId =
      this.initialRightSkill >= 0 &&
      this.initialRightSkill < SKILLS_TXT_COUNT_113C &&
      SKILLS_GetSkillById113c(m, pPlayer, this.initialRightSkill, -1) !== 0
        ? this.initialRightSkill
        : 0
    SKILLS_SetLeftSkill113c(m, pPlayer, leftId, -1)
    SKILLS_SetRightSkill113c(m, pPlayer, rightId, -1)
    PLAYER_StoreLeftSkill113c(m, pPlayer)
    PLAYER_StoreRightSkill113c(m, pPlayer)

    if (this.initialHotkeys !== undefined) {
      const count = Math.min(16, this.initialHotkeys.length)
      for (let slot = 0; slot < count; slot++) {
        const raw = this.initialHotkeys[slot]! >>> 0
        const word = raw & 0xffff
        if (word === 0xffff || (word & 0x7fff) === 0x7fff) continue
        const skId = word & 0x7fff
        const bLeft = (word & 0x8000) !== 0 ? 1 : 0
        if (skId >= 0 && skId < SKILLS_TXT_COUNT_113C) {
          if (SKILLS_GetSkillById113c(m, pPlayer, skId, -1) === 0) {
            SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, skId, 0, 0, 0, 0)
          }
          PLAYER_SetClientSkillHotkeySlot113c(m, pPlayer, slot, skId, bLeft, 0xffffffff)
        }
      }
    }

    return pPlayer
  }

  private handleGameplayQueue1Packet(clientId: number, pPacket: number, pktLen: number): number {
    if (pktLen <= 0) return 3
    const entry = this.clients.get(clientId)
    if (entry === undefined || entry.closed || entry.pClient === 0) return 2
    if (!this.adoptedSnapshot) {
      this.m.setU32((entry.pClient + 0x3d8) >>> 0, this.virtualTickMs >>> 0)
    }

    const rawBytes = new Uint8Array(pktLen)
    for (let i = 0; i < pktLen; i++) {
      rawBytes[i] = this.m.u8((pPacket + i) >>> 0)
    }

    const firstOp = rawBytes[0]!
    if (
      firstOp >= 0x05 &&
      firstOp <= 0x11 &&
      firstOp !== 0x0b &&
      entry.pPlayer !== 0 &&
      this.m.u32((entry.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) === 4
    ) {
      const isLocOp = firstOp === 0x05 || firstOp === 0x08 || firstOp === 0x0c || firstOp === 0x0f
      const expectedLen = isLocOp ? 5 : 9
      if (pktLen < expectedLen) return 3
      this.handleC2SSkillUse(entry, firstOp, rawBytes)
      return expectedLen
    }

    if ((firstOp >= 0x01 && firstOp <= 0x04) || firstOp === 0x5f) {
      ensureSliceWorldPathMemory113c(this.sliceWorld)
    }

    const sliceCallees = buildSliceC2SCallees113c(this.sliceWorld)
    const callees: C2SPacketCallees113c = {
      ...(sliceCallees.findServerUnit !== undefined
        ? { findServerUnit: sliceCallees.findServerUnit }
        : {}),
      ...(sliceCallees.onStartAttackOnUnit !== undefined
        ? { onStartAttackOnUnit: sliceCallees.onStartAttackOnUnit }
        : {}),
      ...(sliceCallees.onAfterModeStarted !== undefined
        ? { onAfterModeStarted: sliceCallees.onAfterModeStarted }
        : {}),
      onStartWalkOrRun: (mem, pg, plr, nPlrMode, nX, nY, pTargetUnit) => {
        entry.pendingInteraction = null
        entry.activeWaypointUnitId = 0
        sliceCallees.onStartWalkOrRun?.(mem, pg, plr, nPlrMode, nX, nY, pTargetUnit)
        if (!this.adoptedSnapshot) {
          const activeMode = mem.get(plr, D2UnitStrc.dwAnimMode) >>> 0
          if (
            activeMode === PLRMODE_WALK ||
            activeMode === PLRMODE_RUN ||
            activeMode === PLRMODE_TOWN_WALK
          ) {
            this.broadcastPlayerMove0F(plr, activeMode)
          }
        }
      },
      onUnhandledOpcode: (mem, _pGame, pPlayer, opcode, pktPtr, len) => {
        if (opcode === 0x13 && len >= 9) {
          const targetType = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const targetId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SUnitInteract(entry, targetType, targetId)
          return 9
        }
        if (opcode === 0x2f && len >= 9) {
          const targetType = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const npcUnitId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          if (targetType === UNIT_MONSTER) {
            const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcUnitId)
            if (pNpc !== 0) {
              const npcClassId = mem.get(pNpc, D2UnitStrc.dwClassId) >>> 0
              if (isInteractiveNpcClassId113c(npcClassId)) {
                const plrX = UNITS_GetX113c(mem, pPlayer) & 0xffff
                const plrY = UNITS_GetY113c(mem, pPlayer) & 0xffff
                const npcX = UNITS_GetX113c(mem, pNpc) & 0xffff
                const npcY = UNITS_GetY113c(mem, pNpc) & 0xffff
                if (Math.hypot(plrX - npcX, plrY - npcY) <= NPC_TETHER_RANGE_SUBTILES_113C) {
                  this.executeNpcInteractHandshake(entry, pNpc, false)
                }
              }
            }
          }
          return 9
        }
        if (opcode === 0x30 && len >= 9) {
          const npcUnitId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          if (entry.activeNpcUnitId === 0 || entry.activeNpcUnitId === npcUnitId) {
            entry.activeNpcUnitId = 0
          }
          if (entry.activeVendorNpcId === 0 || entry.activeVendorNpcId === npcUnitId) {
            entry.activeVendorNpcId = 0
            entry.activeVendorMode = null
          }
          if (entry.lastNpcHandshakeUnitId === npcUnitId) {
            entry.lastNpcHandshakeUnitId = 0
          }
          if (
            entry.pendingInteraction !== null &&
            entry.pendingInteraction.kind === 'npc' &&
            entry.pendingInteraction.unitId === npcUnitId
          ) {
            entry.pendingInteraction = null
          }
          return 9
        }
        if (opcode === 0x16 && len >= 13) {
          const itemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const toCursor = (mem.u32((pktPtr + 9) >>> 0) >>> 0) !== 0
          this.handleC2SPickItem(entry, itemId, toCursor)
          return 13
        }
        if (opcode === 0x17 && len >= 5) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SDropItem(entry, itemId)
          return 5
        }
        if (opcode === 0x18 && len >= 17) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const x = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const y = mem.u32((pktPtr + 9) >>> 0) >>> 0
          const buffer = mem.u32((pktPtr + 13) >>> 0) >>> 0
          this.handleC2SItemToBuffer(entry, itemId, x, y, buffer)
          return 17
        }
        if (opcode === 0x19 && len >= 5) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SRemoveFromBuffer(entry, itemId)
          return 5
        }
        if ((opcode === 0x1a || opcode === 0x1b) && len >= 9) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const bodyLoc = mem.u16((pktPtr + 5) >>> 0) & 0xffff
          this.handleC2SEquipItem(entry, itemId, bodyLoc, opcode === 0x1b)
          return 9
        }
        if (opcode === 0x1c && len >= 3) {
          const bodyLoc = mem.u16((pktPtr + 1) >>> 0) & 0xffff
          this.handleC2SUnequipItem(entry, bodyLoc)
          return 3
        }
        if ((opcode === 0x1d || opcode === 0x1e) && len >= 9) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const bodyLoc = mem.u16((pktPtr + 5) >>> 0) & 0xffff
          this.handleC2SSwapEquippedItem(entry, itemId, bodyLoc)
          return 9
        }
        if (opcode === 0x1f && len >= 17) {
          const cursorItemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const targetItemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const x = mem.u32((pktPtr + 9) >>> 0) >>> 0
          const y = mem.u32((pktPtr + 13) >>> 0) >>> 0
          this.handleC2SSwapContainerItem(entry, cursorItemId, targetItemId, x, y)
          return 17
        }
        if (opcode === 0x20 && len >= 13) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const x = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const y = mem.u32((pktPtr + 9) >>> 0) >>> 0
          this.handleC2SUseInventoryItem(entry, itemId, x, y)
          return 13
        }
        if (opcode === 0x21 && len >= 9) {
          const cursorItemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const targetItemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SStackItems(entry, cursorItemId, targetItemId)
          return 9
        }
        if (opcode === 0x22 && len >= 5) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SUnstackItems(entry, itemId)
          return 5
        }
        if (opcode === 0x23 && len >= 9) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const slot = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SItemToBelt(entry, itemId, slot)
          return 9
        }
        if (opcode === 0x24 && len >= 5) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SRemoveFromBelt(entry, itemId)
          return 5
        }
        if (opcode === 0x25 && len >= 9) {
          const cursorItemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const beltItemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SSwapBeltItem(entry, cursorItemId, beltItemId)
          return 9
        }
        if (opcode === 0x26 && len >= 13) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const shift = (mem.u32((pktPtr + 5) >>> 0) >>> 0) !== 0
          this.handleC2SUseBeltItem(entry, itemId, shift)
          return 13
        }
        if (opcode === 0x27 && len >= 9) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const scrollId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SIdentifyItem(entry, itemId, scrollId)
          return 9
        }
        if (opcode === 0x28 && len >= 9) {
          const fillerId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const hostId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SSocketItem(entry, fillerId, hostId)
          return 9
        }
        if (opcode === 0x29 && len >= 9) {
          const scrollId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const bookId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SScrollToBook(entry, scrollId, bookId)
          return 9
        }
        if (opcode === 0x2a && len >= 9) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SItemToCube(entry, itemId)
          return 9
        }
        if (opcode === 0x31 && len >= 9) {
          const npcId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const messageId = mem.u16((pktPtr + 5) >>> 0) & 0xffff
          this.handleC2SQuestMessage(entry, npcId, messageId)
          return 9
        }
        if (opcode === 0x32 && len >= 17) {
          const npcId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const itemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const field3 = mem.u32((pktPtr + 9) >>> 0) >>> 0
          const isGamble = (field3 & 0x00000002) !== 0
          const shiftFill = (field3 & 0x80000000) !== 0
          this.handleC2SBuyItem(entry, npcId, itemId, isGamble, shiftFill)
          return 17
        }
        if (opcode === 0x33 && len >= 17) {
          const npcId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const itemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SSellItem(entry, npcId, itemId)
          return 17
        }
        if (opcode === 0x34 && len >= 5) {
          const npcId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SCainIdentifyAll(entry, npcId)
          return 5
        }
        if (opcode === 0x35 && len >= 17) {
          const npcId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const itemId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          const durabilityField = mem.u32((pktPtr + 13) >>> 0) >>> 0
          const isRepairAll = (durabilityField & 0x80000000) !== 0
          this.handleC2SRepairItem(entry, npcId, isRepairAll ? undefined : itemId)
          return 17
        }
        if (opcode === 0x38 && len >= 13) {
          const action = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const npcId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SEntityAction(entry, action, npcId)
          return 13
        }
        if (opcode === 0x4f && len >= 7) {
          const buttonId = mem.u16((pktPtr + 1) >>> 0) & 0xffff
          const amountHi = mem.u16((pktPtr + 3) >>> 0) & 0xffff
          const amountLo = mem.u16((pktPtr + 5) >>> 0) & 0xffff
          const amount = (((amountHi << 16) | amountLo) >>> 0)
          this.handleC2SClickButton(entry, buttonId, amount)
          return 7
        }
        if (opcode === 0x50 && len >= 9) {
          const amount = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SDropGold(entry, amount)
          return 9
        }
        if (opcode === 0x60 && len >= 1) {
          this.handleC2SSwapWeapons(entry)
          return 1
        }
        if (opcode === 0x63 && len >= 5) {
          const itemId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          this.handleC2SQuickItemToBelt(entry, itemId)
          return 5
        }
        if (opcode === 0x40 && len >= 1) {
          QUESTS_SendPlayerQuestLogPacket28_113c(this.m, pPlayer, this.pGame)
          return 1
        }
        if (opcode === 0x49 && len >= 9) {
          const waypointUnitId = mem.u32((pktPtr + 1) >>> 0) >>> 0
          const destAreaId = mem.u32((pktPtr + 5) >>> 0) >>> 0
          this.handleC2SWaypointTravel(entry, waypointUnitId, destAreaId)
          return 9
        }
        if (opcode === 0x5f && len >= 5) {
          const clientX = mem.u16((pktPtr + 1) >>> 0) & 0xffff
          const clientY = mem.u16((pktPtr + 3) >>> 0) & 0xffff
          const srvX = UNITS_GetX113c(mem, pPlayer) & 0xffff
          const srvY = UNITS_GetY113c(mem, pPlayer) & 0xffff
          if (Math.hypot(clientX - srvX, clientY - srvY) > 5 && entry.pClient !== 0) {
            NET_SendReassignUnitPacket15_113c(mem, pPlayer, entry.pClient, 1)
          }
          return 5
        }
        if (opcode === 0x3a && len >= 3) {
          const statId = mem.u8((pktPtr + 1) >>> 0) & 0xff
          const spendCount = (mem.u8((pktPtr + 2) >>> 0) + 1) | 0
          const availPts = STATLIST_GetUnitStat113c(mem, pPlayer, STAT_STATPTS, 0) | 0
          if (statId <= 3 && availPts >= spendCount && spendCount >= 1) {
            const nextPts = (availPts - spendCount) | 0
            const nextVal = (STATLIST_GetUnitStat113c(mem, pPlayer, statId, 0) + spendCount) | 0
            STATLIST_SetUnitStat113c(mem, pPlayer, STAT_STATPTS, nextPts, 0)
            STATLIST_SetUnitStat113c(mem, pPlayer, statId, nextVal, 0)
            D2GAME_PACKET_SendStatByteWordDword113c(
              mem,
              entry.pClient,
              STAT_STATPTS,
              nextPts,
              this.gapBCallees,
            )
            D2GAME_PACKET_SendStatByteWordDword113c(
              mem,
              entry.pClient,
              statId,
              nextVal,
              this.gapBCallees,
            )
          }
          return 3
        }
        if (opcode === 0x3b && len >= 3) {
          const prevSkillPts = STATLIST_GetUnitStat113c(mem, pPlayer, STAT_NEWSKILLS, 0) | 0
          C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(this.m, this.pGame, pPlayer, pktPtr, 3)
          const nextSkillPts = STATLIST_GetUnitStat113c(mem, pPlayer, STAT_NEWSKILLS, 0) | 0
          if (nextSkillPts !== prevSkillPts) {
            D2GAME_PACKET_SendStatByteWordDword113c(
              mem,
              entry.pClient,
              STAT_NEWSKILLS,
              nextSkillPts,
              this.gapBCallees,
            )
          }
          return 3
        }
        if (opcode === 0x51 && len >= 9) {
          const rc = PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(mem, this.pGame, pPlayer, pktPtr, 9)
          if (rc === 0) {
            const dwRaw = mem.u32((pktPtr + 1) >>> 0) >>> 0
            const slot = (dwRaw >>> 16) & 0x0f
            const slotAddr = (entry.pClient + slot * 8) >>> 0
            const wSkillId = mem.u16((slotAddr + 0x3dc) >>> 0) & 0xffff
            const bLeft = mem.u8((slotAddr + 0x3de) >>> 0) & 0x01
            const dwItemGuid = mem.u32((slotAddr + 0x3e0) >>> 0) >>> 0
            const word =
              wSkillId === 0xffff
                ? 0xffff
                : (((wSkillId & 0x0fff) | (bLeft !== 0 ? 0x8000 : 0)) & 0xffff)
            const pkt7b = new Uint8Array(8)
            const dv7b = new DataView(pkt7b.buffer)
            pkt7b[0] = 0x7b
            pkt7b[1] = slot & 0xff
            dv7b.setUint16(2, word, true)
            dv7b.setUint32(4, dwItemGuid, true)
            this.queueBytesToClientBuffer(mem, entry.pClient, pkt7b)
          }
          return 9
        }
        if (opcode === 0x15 && len >= 4) {
          let s1End = 3
          while (s1End < len && rawBytes[s1End] !== 0) s1End++
          const msgBytes = rawBytes.subarray(3, s1End)
          let msgText = ''
          for (let i = 0; i < msgBytes.byteLength; i++) {
            msgText += String.fromCharCode(msgBytes[i]!)
          }
          const trimmed = msgText.trim()
          const playersSetMatch = /^players set to (-?\d+)$/i.exec(trimmed)
          const slashPlayersMatch = /^\/players(.*)$/i.exec(trimmed)
          const barePlayersMatch = /^players(?:\s+(?:set\s+)?|\s*:\s*)(-?\d+)$/i.exec(trimmed)
          if (playersSetMatch || slashPlayersMatch || barePlayersMatch) {
            let parsedVal: number
            if (playersSetMatch) {
              parsedVal = Number(playersSetMatch[1])
            } else if (slashPlayersMatch) {
              const atoiMatch = /^[\t\n\v\f\r :]*([+-]?\d+)/.exec(slashPlayersMatch[1] ?? '')
              parsedVal = atoiMatch ? Number.parseInt(atoiMatch[1]!, 10) : 1
            } else {
              parsedVal = Number(barePlayersMatch![1])
            }
            const applied = this.setPlayersX(parsedVal)
            const sysReply = `players set to ${applied}`
            const srvName = 'Server'
            const s2cSys = new Uint8Array(10 + srvName.length + 1 + sysReply.length + 1)
            s2cSys[0] = 0x26
            s2cSys[1] = 0x04
            for (let i = 0; i < srvName.length; i++) {
              s2cSys[10 + i] = srvName.charCodeAt(i) & 0x7f
            }
            s2cSys[10 + srvName.length] = 0
            for (let i = 0; i < sysReply.length; i++) {
              s2cSys[10 + srvName.length + 1 + i] = sysReply.charCodeAt(i) & 0x7f
            }
            s2cSys[s2cSys.byteLength - 1] = 0
            this.queueBytesToClientBuffer(mem, entry.pClient, s2cSys)
            return len
          }

          // Standard `0x15 ChatMessage`: echo `0x26 ChatMessage` (`chatType=1`)
          const nameLen = entry.charName.length
          const s2c26 = new Uint8Array(10 + nameLen + 1 + msgBytes.byteLength + 1)
          s2c26[0] = 0x26
          s2c26[1] = 0x01
          for (let i = 0; i < nameLen; i++) {
            s2c26[10 + i] = entry.charName.charCodeAt(i) & 0x7f
          }
          s2c26[10 + nameLen] = 0
          s2c26.set(msgBytes, 10 + nameLen + 1)
          s2c26[s2c26.byteLength - 1] = 0
          for (const recipient of this.clients.values()) {
            if (recipient.closed || recipient.pClient === 0) continue
            if (this.m.u32((recipient.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) {
              continue
            }
            this.queueBytesToClientBuffer(mem, recipient.pClient, s2c26)
          }
          return len
        }
        return len
      },
    }

    return C2S_DispatchPacketMem113c(
      this.m,
      this.pGame,
      entry.pClient,
      pPacket,
      pktLen,
      callees,
    )
  }

  private findUnitInActiveRoom(unitType: number, unitId: number): number {
    const pRoom = this.defaultRoomPtr >>> 0
    if (pRoom === 0) return 0
    let pUnit = this.m.get(pRoom, D2ActiveRoomStrc.pUnitFirst) >>> 0
    let guard = 0
    while (pUnit !== 0 && guard++ < 2048) {
      if (
        (this.m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0) === (unitType >>> 0) &&
        (this.m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0) === (unitId >>> 0)
      ) {
        return pUnit
      }
      pUnit = this.m.get(pUnit, D2UnitStrc.pRoomUnitNext) >>> 0
    }
    return 0
  }

  private stopPlayerMovementInPlace(entry: InternalClientEntry113c): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const isTown = DUNGEON_CheckRoomIsTown113c(this.m, this.defaultRoomPtr) !== 0
    const neutralMode = isTown ? PLRMODE_TOWN_NEUTRAL : PLRMODE_NEUTRAL
    this.m.set(pPlayer, D2UnitStrc.dwAnimMode, neutralMode)
    const pPath = this.m.get(pPlayer, D2UnitStrc.pPath) >>> 0
    if (pPath !== 0) {
      const curX = this.m.get(pPath, D2DynamicPathStrc.wPosX) & 0xffff
      const curY = this.m.get(pPath, D2DynamicPathStrc.wPosY) & 0xffff
      this.m.set(pPath, D2DynamicPathStrc.wTargetX, curX)
      this.m.set(pPath, D2DynamicPathStrc.wTargetY, curY)
      this.m.set(pPath, D2DynamicPathStrc.pTargetUnit, 0)
      this.m.set(pPath, D2DynamicPathStrc.nDist, 0)
      this.m.set(pPath, D2DynamicPathStrc.nStepNum, 0)
      this.m.set(pPath, D2DynamicPathStrc.nDistance, 0)
    }
    const pu = this.sliceWorld.pathUnitByPtr.get(pPlayer)
    if (pu !== undefined) {
      pu.dwAnimMode = neutralMode
    }
  }

  private walkPlayerTowardTarget(
    entry: InternalClientEntry113c,
    targetX: number,
    targetY: number,
  ): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    let goalX = targetX & 0xffff
    let goalY = targetY & 0xffff
    const room = this.sliceWorld.roomByPtr.get(this.defaultRoomPtr)
    if (room !== undefined) {
      const free = collisionGetFreeCoordinates(
        (x, y) =>
          (x !== targetX || y !== targetY) &&
          !isBlockedWithUnitSize((cx, cy) => (room.grid.get(cx, cy) & 0x1c09) !== 0, x, y, 2),
        targetX,
        targetY,
        16,
        1,
      )
      if (free !== null) {
        goalX = free.x & 0xffff
        goalY = free.y & 0xffff
      }
    }
    const movePkt = new Uint8Array(5)
    movePkt[0] = 0x03 // RunToLocation (downgraded to town walk automatically if needed)
    movePkt[1] = goalX & 0xff
    movePkt[2] = (goalX >>> 8) & 0xff
    movePkt[3] = goalY & 0xff
    movePkt[4] = (goalY >>> 8) & 0xff
    applyPlayerPacket113c(this.sliceWorld, pPlayer, movePkt)
    const activeMode = this.m.get(pPlayer, D2UnitStrc.dwAnimMode) >>> 0
    if (
      activeMode === PLRMODE_WALK ||
      activeMode === PLRMODE_RUN ||
      activeMode === PLRMODE_TOWN_WALK
    ) {
      this.broadcastPlayerMove0F(pPlayer, activeMode)
    }
  }

  private checkPendingInteractionArrival(
    entry: InternalClientEntry113c,
    curX: number,
    curY: number,
    isNeutral: boolean,
  ): void {
    const pending = entry.pendingInteraction
    if (pending === null) return
    if (pending.kind === 'npc') {
      const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, pending.unitId)
      if (pNpc === 0) {
        entry.pendingInteraction = null
        return
      }
      const npcX = UNITS_GetX113c(this.m, pNpc) & 0xffff
      const npcY = UNITS_GetY113c(this.m, pNpc) & 0xffff
      const dist = Math.hypot(curX - npcX, curY - npcY)
      if (
        dist <= INTERACT_ARRIVAL_RANGE_SUBTILES_113C ||
        (isNeutral && dist <= INTERACT_IMMEDIATE_RANGE_SUBTILES_113C)
      ) {
        entry.pendingInteraction = null
        if (entry.pPlayer !== 0 && entry.pClient !== 0) {
          NET_SendReassignUnitPacket15_113c(this.m, entry.pPlayer, entry.pClient, 1)
        }
        this.executeNpcInteractHandshake(entry, pNpc, true)
      } else if (isNeutral) {
        entry.pendingInteraction = null
      }
      return
    }
    const pObj = this.findUnitInActiveRoom(UNIT_OBJECT_113C, pending.unitId)
    if (pObj === 0) {
      entry.pendingInteraction = null
      return
    }
    const objX = UNITS_GetX113c(this.m, pObj) & 0xffff
    const objY = UNITS_GetY113c(this.m, pObj) & 0xffff
    const dist = Math.hypot(curX - objX, curY - objY)
    if (
      dist <= INTERACT_ARRIVAL_RANGE_SUBTILES_113C ||
      (isNeutral && dist <= INTERACT_IMMEDIATE_RANGE_SUBTILES_113C)
    ) {
      entry.pendingInteraction = null
      if (entry.pPlayer !== 0 && entry.pClient !== 0) {
        NET_SendReassignUnitPacket15_113c(this.m, entry.pPlayer, entry.pClient, 1)
      }
      if (pending.kind === 'stash') {
        this.executeStashOpen(entry)
      } else if (pending.kind === 'portal') {
        this.executePortalInteract(entry, pending.unitId)
      } else {
        this.executeWaypointOpen(entry, pObj)
      }
    } else if (isNeutral) {
      entry.pendingInteraction = null
    }
  }

  private handleC2SUnitInteract(
    entry: InternalClientEntry113c,
    targetType: number,
    targetId: number,
  ): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const plrX = UNITS_GetX113c(this.m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(this.m, pPlayer) & 0xffff

    if (targetType === UNIT_MONSTER) {
      const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, targetId)
      if (pNpc === 0) return
      const npcClassId = this.m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
      if (!isInteractiveNpcClassId113c(npcClassId)) return
      const npcX = UNITS_GetX113c(this.m, pNpc) & 0xffff
      const npcY = UNITS_GetY113c(this.m, pNpc) & 0xffff
      if (Math.hypot(plrX - npcX, plrY - npcY) <= INTERACT_IMMEDIATE_RANGE_SUBTILES_113C) {
        entry.pendingInteraction = null
        this.executeNpcInteractHandshake(entry, pNpc, true)
      } else {
        entry.pendingInteraction = { kind: 'npc', unitId: targetId }
        this.walkPlayerTowardTarget(entry, npcX, npcY)
      }
      return
    }

    if (targetType === UNIT_OBJECT_113C) {
      const pObj = this.findUnitInActiveRoom(UNIT_OBJECT_113C, targetId)
      if (pObj === 0) return
      const objClassId = this.m.get(pObj, D2UnitStrc.dwClassId) >>> 0
      const isWp = WAYPOINT_CLASS_IDS_113C.has(objClassId)
      const isStash = objClassId === OBJECT_CLASS_STASH_113C
      const isPortal = objClassId === OBJECT_CLASS_PORTAL_113C
      if (!isWp && !isStash && !isPortal) return
      const objX = UNITS_GetX113c(this.m, pObj) & 0xffff
      const objY = UNITS_GetY113c(this.m, pObj) & 0xffff
      if (Math.hypot(plrX - objX, plrY - objY) <= INTERACT_IMMEDIATE_RANGE_SUBTILES_113C) {
        entry.pendingInteraction = null
        if (isStash) {
          this.executeStashOpen(entry)
        } else if (isPortal) {
          this.executePortalInteract(entry, targetId)
        } else {
          this.executeWaypointOpen(entry, pObj)
        }
      } else {
        entry.pendingInteraction = {
          kind: isStash ? 'stash' : isPortal ? 'portal' : 'waypoint',
          unitId: targetId,
        }
        this.walkPlayerTowardTarget(entry, objX, objY)
      }
    }
  }

  private healPlayerAtTownHealer(entry: InternalClientEntry113c): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return
    const m = this.m
    const maxHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXHP, 0) | 0
    const maxMana = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXMANA, 0) | 0
    const maxStamina = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, 0) | 0

    if (maxHp > 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, maxHp, 0)
      D2GAME_PACKET_SendStatByteWordDword113c(
        m,
        entry.pClient,
        STAT_HITPOINTS,
        maxHp,
        this.gapBCallees,
      )
    }
    if (maxMana >= 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, maxMana, 0)
      D2GAME_PACKET_SendStatByteWordDword113c(
        m,
        entry.pClient,
        STAT_MANA,
        maxMana,
        this.gapBCallees,
      )
    }
    if (maxStamina >= 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, maxStamina, 0)
      D2GAME_PACKET_SendStatByteWordDword113c(
        m,
        entry.pClient,
        STAT_STAMINA,
        maxStamina,
        this.gapBCallees,
      )
    }

    const curX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const curY = UNITS_GetY113c(m, pPlayer) & 0xffff
    NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
      m,
      entry.pClient,
      (maxHp >> 8) & 0x7fff,
      (maxMana >> 8) & 0x7fff,
      (maxStamina >> 8) & 0x7fff,
      curX,
      curY,
      0,
      0,
    )
  }

  private executeNpcInteractHandshake(
    entry: InternalClientEntry113c,
    pNpc: number,
    fromInteractPacket: boolean,
  ): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0 || pNpc === 0) return
    const npcUnitId = this.m.get(pNpc, D2UnitStrc.dwUnitId) >>> 0
    const npcClassId = this.m.get(pNpc, D2UnitStrc.dwClassId) >>> 0

    this.stopPlayerMovementInPlace(entry)
    entry.activeNpcUnitId = npcUnitId
    entry.activeWaypointUnitId = 0

    if (TOWN_HEALER_CLASS_IDS_113C.has(npcClassId)) {
      this.healPlayerAtTownHealer(entry)
    }

    const pQuestRec =
      PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(this.m, pPlayer, this.pGame) >>> 0
    if (pQuestRec === 0) return

    if (fromInteractPacket) {
      entry.lastNpcHandshakeUnitId = npcUnitId
      NET_SendPacket103B_QuestRecord_6FCAAD40_113c(
        this.m,
        0x28,
        UNIT_MONSTER,
        npcUnitId,
        entry.pClient,
        pQuestRec,
        0,
      )
    } else if (entry.lastNpcHandshakeUnitId === npcUnitId) {
      entry.lastNpcHandshakeUnitId = 0
    } else {
      entry.lastNpcHandshakeUnitId = npcUnitId
      NET_SendPacket103B_QuestRecord_6FCAAD40_113c(
        this.m,
        0x28,
        UNIT_MONSTER,
        npcUnitId,
        entry.pClient,
        pQuestRec,
        0,
      )
    }
  }

  private executeWaypointOpen(entry: InternalClientEntry113c, pObject: number): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0 || pObject === 0) return
    const objUnitId = this.m.get(pObject, D2UnitStrc.dwUnitId) >>> 0

    this.stopPlayerMovementInPlace(entry)
    entry.activeWaypointUnitId = objUnitId
    entry.activeNpcUnitId = 0
    entry.lastNpcHandshakeUnitId = 0

    const pWpData =
      PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(this.m, pPlayer, this.pGame) >>> 0
    if (pWpData === 0) return

    if (WAYPOINT_GetWaypointNoFromLevelId113c(this.m, this.areaId, this.pSmallScratch) !== 0) {
      const wpIdx = this.m.u16(this.pSmallScratch) & 0xffff
      WAYPOINT_ActivateWaypoint113c(this.m, pWpData, wpIdx)
    }

    if ((this.m.get(pObject, D2UnitStrc.dwAnimMode) >>> 0) === 0) {
      this.m.set(pObject, D2UnitStrc.dwAnimMode, 2)
      const pkt0e = new Uint8Array(12)
      const dv0e = new DataView(pkt0e.buffer)
      pkt0e[0] = 0x0e
      pkt0e[1] = UNIT_OBJECT_113C
      dv0e.setUint32(2, objUnitId >>> 0, true)
      pkt0e[6] = 0x03 // ObjectEvent 3 = set mode (`D2Client.dll` `0x6FAD59F0`)
      pkt0e[7] = 0x00
      dv0e.setUint32(8, 2, true)
      for (const recipient of this.clients.values()) {
        if (recipient.closed || recipient.pClient === 0) continue
        if (this.m.u32((recipient.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) {
          continue
        }
        this.queueBytesToClientBuffer(this.m, recipient.pClient, pkt0e)
      }
    }

    this.m.setU8(this.pSmallScratch, 0x63)
    this.m.setU32((this.pSmallScratch + 1) >>> 0, objUnitId >>> 0)
    WAYPOINT_CopyAndValidateWaypointData113c(
      this.m,
      pWpData,
      (this.pSmallScratch + 5) >>> 0,
    )
    NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(this.m, this.pSmallScratch, entry.pClient)
  }

  private handleC2SWaypointTravel(
    entry: InternalClientEntry113c,
    waypointUnitId: number,
    destAreaId: number,
  ): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return

    if (destAreaId === 0 || destAreaId === this.areaId) {
      entry.activeWaypointUnitId = 0
      entry.pendingInteraction = null
      return
    }

    if (destAreaId < 1 || destAreaId > 136) {
      entry.activeWaypointUnitId = 0
      return
    }

    if (WAYPOINT_GetWaypointNoFromLevelId113c(this.m, destAreaId, this.pSmallScratch) === 0) {
      entry.activeWaypointUnitId = 0
      return
    }
    const destWpIdx = this.m.u16(this.pSmallScratch) & 0xffff

    const pWpData =
      PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(this.m, pPlayer, this.pGame) >>> 0
    if (pWpData === 0 || WAYPOINT_GetWaypointState113c(this.m, pWpData, destWpIdx) === 0) {
      entry.activeWaypointUnitId = 0
      return
    }

    const candidateWpId =
      entry.activeWaypointUnitId !== 0 ? entry.activeWaypointUnitId : waypointUnitId
    if (candidateWpId === 0) return
    const pWpObj = this.findUnitInActiveRoom(UNIT_OBJECT_113C, candidateWpId)
    if (pWpObj === 0) {
      entry.activeWaypointUnitId = 0
      return
    }
    const wpObjClass = this.m.get(pWpObj, D2UnitStrc.dwClassId) >>> 0
    if (!WAYPOINT_CLASS_IDS_113C.has(wpObjClass)) {
      entry.activeWaypointUnitId = 0
      return
    }
    const plrX = UNITS_GetX113c(this.m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(this.m, pPlayer) & 0xffff
    const wpX = UNITS_GetX113c(this.m, pWpObj) & 0xffff
    const wpY = UNITS_GetY113c(this.m, pWpObj) & 0xffff
    if (Math.hypot(plrX - wpX, plrY - wpY) > NPC_TETHER_RANGE_SUBTILES_113C) {
      entry.activeWaypointUnitId = 0
      return
    }

    this.warpClientToArea(entry, destAreaId)
  }

  /**
   * Bootstrap `destAreaId` in `SparseMemory113c` via `resolveAreaBootstrap`, warp `entry`'s player
   * to the destination waypoint/entry coordinates, update Act/room/collision state, and stream the
   * 1.13c S2C area transition sequence (`0x0A`, `0x08`, `0x03`/`0x53`, `0x07`, `0x15`, `0xAC`, `0x51`).
   */
  private warpClientToArea(entry: InternalClientEntry113c, destAreaId: number): boolean {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return false

    const prevActIdx = this.actIdx
    const destActIdx = areaIdToActIdx113c(destAreaId)
    const rawBootstrap: LocalAreaBootstrap | null | undefined =
      this.resolveAreaBootstrap !== undefined
        ? this.resolveAreaBootstrap({
            act: destActIdx + 1,
            areaId: destAreaId,
            mapSeed: this.initSeedValue,
            difficulty: this.difficultyValue,
          })
        : null
    const bootstrap: LocalAreaBootstrap | null =
      rawBootstrap !== undefined && rawBootstrap !== null ? rawBootstrap : null

    const roomSubW =
      bootstrap !== null && bootstrap.subWidth !== undefined && bootstrap.subWidth > 0
        ? bootstrap.subWidth
        : 80
    const roomSubH =
      bootstrap !== null && bootstrap.subHeight !== undefined && bootstrap.subHeight > 0
        ? bootstrap.subHeight
        : 80
    const roomSubX =
      bootstrap !== null
        ? bootstrap.originX !== undefined
          ? bootstrap.originX
          : Math.max(0, bootstrap.spawnX - 20)
        : 5520 + destAreaId * 160
    const roomSubY =
      bootstrap !== null
        ? bootstrap.originY !== undefined
          ? bootstrap.originY
          : Math.max(0, bootstrap.spawnY - 20)
        : 5880

    let destX = bootstrap !== null ? bootstrap.spawnX : roomSubX + 20
    let destY = bootstrap !== null ? bootstrap.spawnY : roomSubY + 20
    if (bootstrap !== null) {
      const wpPreset = bootstrap.objects.find(
        (o) => o.isWaypoint === true || WAYPOINT_CLASS_IDS_113C.has(o.classId),
      )
      if (wpPreset !== undefined) {
        const free2 = collisionGetFreeCoordinates(
          (x, y) =>
            !isBlockedWithUnitSize(
              (cx, cy) => !bootstrap.isWalkable(destAreaId, cx, cy),
              x,
              y,
              2,
            ),
          wpPreset.x,
          wpPreset.y,
          50,
          1,
        )
        const free1 =
          free2 !== null
            ? free2
            : collisionGetFreeCoordinates(
                (x, y) => bootstrap.isWalkable(destAreaId, x, y),
                wpPreset.x,
                wpPreset.y,
                50,
                1,
              )
        destX = free1 !== null ? free1.x : wpPreset.x
        destY = free1 !== null ? free1.y : wpPreset.y
      }
    }

    entry.activeWaypointUnitId = 0
    entry.activeNpcUnitId = 0
    entry.lastNpcHandshakeUnitId = 0
    entry.activeVendorNpcId = 0
    entry.activeVendorMode = null
    entry.stashOpen = false
    entry.cubeOpen = false
    entry.pendingInteraction = null

    const flushIfNearCapacity = (): void => {
      if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
        this.flushClientQueueToSink(entry)
      }
    }

    // 0. Remove old room ground items (`0x0A RemoveGroundUnit` unitType=4) and reset area caches
    for (const [gId] of this.groundItems) {
      const pkt0a = new Uint8Array(6)
      const dv0a = new DataView(pkt0a.buffer)
      pkt0a[0] = 0x0a
      pkt0a[1] = UNIT_ITEM_113C
      dv0a.setUint32(2, gId >>> 0, true)
      this.queueBytesToClientBuffer(m, entry.pClient, pkt0a)
      flushIfNearCapacity()
    }
    this.groundItems.clear()
    this.monsterMetaByUnitId.clear()
    this.portalsByObjectId.clear()

    // 1. Remove old room non-player units (`0x0A RemoveGroundUnit`) and unlink from `SparseMemory113c`
    const pOldRoom = this.defaultRoomPtr >>> 0
    if (pOldRoom !== 0) {
      const oldUnits: Array<{ readonly pUnit: number; readonly uType: number; readonly uId: number }> = []
      let pWalk = m.get(pOldRoom, D2ActiveRoomStrc.pUnitFirst) >>> 0
      let guard = 0
      while (pWalk !== 0 && guard++ < 2048) {
        const uType = m.get(pWalk, D2UnitStrc.dwUnitType) >>> 0
        const uId = m.get(pWalk, D2UnitStrc.dwUnitId) >>> 0
        if (uType !== UNIT_PLAYER) {
          oldUnits.push({ pUnit: pWalk, uType, uId })
        }
        pWalk = m.get(pWalk, D2UnitStrc.pRoomUnitNext) >>> 0
      }
      for (let i = 0; i < oldUnits.length; i++) {
        const item = oldUnits[i]!
        UNITROOM_RemoveUnitFromRoom113c(m, item.pUnit)
        this.removeUnitFromGameHash(item.pUnit, item.uType, item.uId)
        if (item.uType === UNIT_MONSTER || item.uType === UNIT_OBJECT_113C) {
          const pkt0a = new Uint8Array(6)
          const dv0a = new DataView(pkt0a.buffer)
          pkt0a[0] = 0x0a
          pkt0a[1] = item.uType & 0xff
          dv0a.setUint32(2, item.uId >>> 0, true)
          this.queueBytesToClientBuffer(m, entry.pClient, pkt0a)
          flushIfNearCapacity()
        }
      }

      UNITROOM_RemoveUnitFromRoom113c(m, pPlayer)
      DUNGEON_RemoveClientFromRoom113c(m, pOldRoom, entry.pClient)
      this.sliceWorld.roomByPtr.delete(pOldRoom)
    }

    // 2. Emit `0x08 RoomHide` (`MapRemove`) for all previously revealed rooms
    for (let i = 0; i < this.activeRevealedRooms.length; i++) {
      const rm = this.activeRevealedRooms[i]!
      const pkt08 = new Uint8Array(6)
      pkt08[0] = 0x08
      pkt08[1] = rm.tileX & 0xff
      pkt08[2] = (rm.tileX >>> 8) & 0xff
      pkt08[3] = rm.tileY & 0xff
      pkt08[4] = (rm.tileY >>> 8) & 0xff
      pkt08[5] = rm.areaId & 0xff
      this.queueBytesToClientBuffer(m, entry.pClient, pkt08)
      flushIfNearCapacity()
    }

    // 3. Allocate/bind destination `D2ActStrc` + `D2ActiveRoomStrc` + collision grid in `SparseMemory113c`
    this.actIdx = destActIdx
    this.areaId = destAreaId
    this.extraRevealedRooms = bootstrap !== null ? bootstrap.rooms : []

    const pArena = m.u32((this.pGame + 0x1d28) >>> 0) >>> 0
    if (pArena !== 0) {
      m.setU32(pArena, destAreaId >>> 0)
    }

    let pAct = m.u32((this.pGame + 0xbc + destActIdx * 4) >>> 0) >>> 0
    if (pAct === 0) {
      pAct = m.alloc(D2ActStrc_SIZE) >>> 0
      const pActMisc = m.alloc(0x4c0) >>> 0
      const pEnv = m.alloc(0x40) >>> 0
      m.set(pAct, D2ActStrc.dwMapSeed, this.initSeedValue >>> 0)
      m.set(pAct, D2ActStrc.nAct, destActIdx >>> 0)
      m.set(pAct, D2ActStrc.pEnvironment, pEnv)
      m.set(pAct, D2ActStrc.pActMisc, pActMisc)
      m.setU32((this.pGame + 0xbc + destActIdx * 4) >>> 0, pAct)
    }
    m.set(pAct, D2ActStrc.dwTownId, destAreaId >>> 0)

    const pLevel = m.alloc(0x240) >>> 0
    m.setU32((pLevel + 0x1d0) >>> 0, destAreaId >>> 0)

    const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
    const tileX = Math.trunc(roomSubX / 5)
    const tileY = Math.trunc(roomSubY / 5)
    const tileW = Math.trunc(roomSubW / 5)
    const tileH = Math.trunc(roomSubH / 5)
    const isDestTown = TOWN_AREA_IDS_113C.has(destAreaId)
    m.setU32((pRoomEx + 0x08) >>> 0, pAct)
    m.setU32((pRoomEx + 0x24) >>> 0, isDestTown ? 2 : 0)
    m.setU32((pRoomEx + 0x34) >>> 0, tileX >>> 0)
    m.setU32((pRoomEx + 0x38) >>> 0, tileY >>> 0)
    m.setU32((pRoomEx + 0x3c) >>> 0, tileW >>> 0)
    m.setU32((pRoomEx + 0x40) >>> 0, tileH >>> 0)
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)

    const pNewRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
    m.set(pNewRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pNewRoom, D2ActiveRoomStrc.pAct, pAct)
    m.set(pNewRoom, D2ActiveRoomStrc.nSubtileX, roomSubX >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nSubtileY, roomSubY >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nSubtileWidth, roomSubW >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nSubtileHeight, roomSubH >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nTileX, tileX >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nTileY, tileY >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nTileWidth, tileW >>> 0)
    m.set(pNewRoom, D2ActiveRoomStrc.nTileHeight, tileH >>> 0)
    m.setU32((pRoomEx + 0x28) >>> 0, pNewRoom)

    const ppRoomsNear = m.alloc(16) >>> 0
    m.setU32(ppRoomsNear, pNewRoom)
    m.set(pNewRoom, D2ActiveRoomStrc.ppRoomsNear, ppRoomsNear)
    m.set(pNewRoom, D2ActiveRoomStrc.nRoomsNear, 1)

    const maskFn =
      bootstrap !== null
        ? (sx: number, sy: number): number => {
            const lx = (sx | 0) - roomSubX
            const ly = (sy | 0) - roomSubY
            if (lx < 0 || ly < 0 || lx >= roomSubW || ly >= roomSubH) {
              return 0x0001
            }
            if (
              bootstrap.collision !== undefined &&
              bootstrap.originX !== undefined &&
              bootstrap.originY !== undefined
            ) {
              return bootstrap.collision[ly * roomSubW + lx]! & 0xffff
            }
            return bootstrap.isWalkable(destAreaId, sx, sy) ? 0x0000 : 0x0001
          }
        : (sx: number, sy: number): number => {
            if (
              sx <= roomSubX ||
              sy <= roomSubY ||
              sx >= roomSubX + roomSubW - 1 ||
              sy >= roomSubY + roomSubH - 1
            ) {
              return 0x0001
            }
            return 0x0000
          }
    bindRoomCollisionGrid113c(m, pNewRoom, roomSubX, roomSubY, roomSubW, roomSubH, maskFn)

    m.set(pAct, D2ActStrc.pRoom1, pNewRoom)
    this.defaultRoomPtr = pNewRoom
    this.registerRoomInSliceMap(pNewRoom, this.sliceWorld.roomByPtr)

    // 4. Reposition `pPlayer` and bind `entry.pClient` to `pNewRoom`
    m.setU8((entry.pClient + 0x1ac) >>> 0, destActIdx & 0xff)
    m.setU32((entry.pClient + 0x1b4) >>> 0, pNewRoom)

    const nextMode = isDestTown ? PLRMODE_TOWN_NEUTRAL : PLRMODE_NEUTRAL
    m.set(pPlayer, D2UnitStrc.dwAnimMode, nextMode)
    const pPath = m.get(pPlayer, D2UnitStrc.pPath) >>> 0
    if (pPath !== 0) {
      m.set(pPath, D2DynamicPathStrc.wOffsetX, 0x8000)
      m.set(pPath, D2DynamicPathStrc.wPosX, destX & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wOffsetY, 0x8000)
      m.set(pPath, D2DynamicPathStrc.wPosY, destY & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wTargetX, destX & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wTargetY, destY & 0xffff)
      m.set(pPath, D2DynamicPathStrc.pTargetUnit, 0)
      m.set(pPath, D2DynamicPathStrc.nDist, 0)
      m.set(pPath, D2DynamicPathStrc.nStepNum, 0)
      m.set(pPath, D2DynamicPathStrc.nDistance, 0)
      m.set(pPath, D2DynamicPathStrc.pRoom, pNewRoom)
    }
    const pu = this.sliceWorld.pathUnitByPtr.get(pPlayer)
    if (pu !== undefined) {
      pu.dwAnimMode = nextMode
    }
    UNITROOM_AddUnitToRoom113c(m, pPlayer, pNewRoom)
    DUNGEON_AddClientToRoom113c(m, pNewRoom, entry.pClient)

    // 5. Stream S2C transition sequence (`0x03` + `0x53` on Act change, else `0x53`; `0x07`; `0x15`)
    if (destActIdx !== prevActIdx) {
      CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, entry.pClient, this.pGame)
    } else {
      const pkt53 = new Uint8Array(10)
      pkt53[0] = 0x53
      this.queueBytesToClientBuffer(m, entry.pClient, pkt53)
    }

    this.activeRevealedRooms = this.collectActiveRevealedRooms(pNewRoom)
    for (let i = 0; i < this.activeRevealedRooms.length; i++) {
      const rm = this.activeRevealedRooms[i]!
      NET_SendPacket07_RoomTileCoords_6FCABF50_113c(
        m,
        rm.tileX & 0xffff,
        rm.tileY & 0xffff,
        entry.pClient,
        rm.areaId & 0xff,
      )
      flushIfNearCapacity()
    }

    NET_SendReassignUnitPacket15_113c(m, pPlayer, entry.pClient, 1)
    flushIfNearCapacity()

    // 6. Populate destination area preset NPCs/monsters (`0xAC`) and objects/waypoint (`0x51`)
    if (bootstrap !== null) {
      for (let i = 0; i < bootstrap.monsters.length; i++) {
        const mon = bootstrap.monsters[i]!
        if (hasMonStats2Flag(mon.classId, MONSTATS2_FLAGINDEX.CRITTER)) continue
        this.spawnMonsterInRoom({
          classId: mon.classId,
          x: mon.x,
          y: mon.y,
          animMode: 1,
        })
      }
      const isDestWpUnlocked = this.isAreaWaypointUnlocked(entry.clientId, destAreaId)
      for (let i = 0; i < bootstrap.objects.length; i++) {
        const obj = bootstrap.objects[i]!
        if (SERVER_ONLY_NPC_SPAWNER_OBJECT_IDS_113C.has(obj.classId)) continue
        const isWp = obj.isWaypoint === true || WAYPOINT_CLASS_IDS_113C.has(obj.classId)
        const mode = isWp
          ? isDestWpUnlocked
            ? 2
            : 0
          : obj.mode !== undefined
            ? obj.mode
            : 0
        this.spawnObjectInRoom({
          classId: obj.classId,
          x: obj.x,
          y: obj.y,
          mode,
        })
      }
    }

    if (this.onAreaChange !== undefined) {
      this.onAreaChange(destAreaId, destActIdx)
    }
    return true
  }

  // ============================================================================
  // Wave 3 Wire, Stat, Inventory-Grid & Pricing Helpers
  // ============================================================================

  private queueServerEventToClient(entry: InternalClientEntry113c, ev: ServerEvent): void {
    if (entry.closed || entry.pClient === 0) return
    const pkts = serverEventToS2cPackets(ev, this.tables)
    for (let i = 0; i < pkts.length; i++) {
      this.queueBytesToClientBuffer(this.m, entry.pClient, pkts[i]!)
      if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
        this.flushClientQueueToSink(entry)
      }
    }
  }

  private broadcastServerEventToInGameClients(ev: ServerEvent): void {
    const pkts = serverEventToS2cPackets(ev, this.tables)
    if (pkts.length === 0) return
    for (const recipient of this.clients.values()) {
      if (recipient.closed || recipient.pClient === 0) continue
      if (this.m.u32((recipient.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
      for (let i = 0; i < pkts.length; i++) {
        this.queueBytesToClientBuffer(this.m, recipient.pClient, pkts[i]!)
        if (this.getQueuedByteCount(recipient.pClient) >= 0x280) {
          this.flushClientQueueToSink(recipient)
        }
      }
    }
  }

  private sendPlaySound(entry: InternalClientEntry113c, soundId: number): void {
    this.queueServerEventToClient(entry, {
      type: 'PlaySound',
      unit: { unitType: 0, id: entry.playerUnitId },
      sound: soundId & 0xffff,
    })
  }

  private sendPlayerStatUpdate(
    entry: InternalClientEntry113c,
    statId: number,
    value: number,
  ): void {
    if (entry.closed || entry.pClient === 0) return
    D2GAME_PACKET_SendStatByteWordDword113c(
      this.m,
      entry.pClient,
      statId,
      value,
      this.gapBCallees,
    )
    if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
      this.flushClientQueueToSink(entry)
    }
  }

  private sendPlayerVitals95(entry: InternalClientEntry113c): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return
    const hp = (STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_HITPOINTS, 0) >> 8) & 0x7fff
    const mana = (STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_MANA, 0) >> 8) & 0x7fff
    const stamina = (STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_STAMINA, 0) >> 8) & 0x7fff
    const curX = UNITS_GetX113c(this.m, pPlayer) & 0xffff
    const curY = UNITS_GetY113c(this.m, pPlayer) & 0xffff
    NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
      this.m,
      entry.pClient,
      hp,
      mana,
      stamina,
      curX,
      curY,
      0,
      0,
    )
    if (this.getQueuedByteCount(entry.pClient) >= 0x280) {
      this.flushClientQueueToSink(entry)
    }
  }

  private getItemGridSize(item: {
    readonly code: string
    readonly invWidth?: number | undefined
    readonly invHeight?: number | undefined
  }): { readonly width: number; readonly height: number } {
    const code = item.code.trim()
    const base = getEmbeddedDropTables().getBase(code)
    if (base === undefined) {
      throw new Error(`Unknown 1.13c item code "${code}" in getItemGridSize`)
    }
    return { width: base.invWidth, height: base.invHeight }
  }

  private getContainerGridDims(storePage: number): {
    readonly width: number
    readonly height: number
    readonly container: 'inventory' | 'cube' | 'stash'
  } | null {
    if (storePage === 1) return { width: 10, height: 4, container: 'inventory' }
    if (storePage === 4) return { width: 3, height: 4, container: 'cube' }
    if (storePage === 5) return { width: 6, height: 8, container: 'stash' }
    return null
  }

  private canFitInContainerGrid(
    entry: InternalClientEntry113c,
    storePage: number,
    x: number,
    y: number,
    width: number,
    height: number,
    ignoreItemId = 0,
  ): boolean {
    const dims = this.getContainerGridDims(storePage)
    if (dims === null) return false
    if (x < 0 || y < 0 || x + width > dims.width || y + height > dims.height) return false
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const other = entry.ownedItems[i]!
      if (other.id === ignoreItemId) continue
      if (other.location !== 0) continue
      const otherPage = (other.storePage ?? other.storagePage ?? 1) || 1
      if (otherPage !== storePage) continue
      const ox = other.gridX ?? other.x ?? 0
      const oy = other.gridY ?? other.y ?? 0
      const oSize = this.getItemGridSize(other)
      const overlaps =
        x < ox + oSize.width &&
        x + width > ox &&
        y < oy + oSize.height &&
        y + height > oy
      if (overlaps) return false
    }
    return true
  }

  private findFreeContainerSlot(
    entry: InternalClientEntry113c,
    storePage: number,
    width: number,
    height: number,
  ): { readonly x: number; readonly y: number } | null {
    const dims = this.getContainerGridDims(storePage)
    if (dims === null) return null
    for (let x = 0; x <= dims.width - width; x++) {
      for (let y = 0; y <= dims.height - height; y++) {
        if (this.canFitInContainerGrid(entry, storePage, x, y, width, height)) {
          return { x, y }
        }
      }
    }
    return null
  }

  private getPlayerBeltMaxRows(entry: InternalClientEntry113c): number {
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location === 1 && (item.bodyLoc ?? item.equippedSlot ?? 0) === 8) {
        const rows = BELT_CODE_TO_ROWS[item.code.trim().toLowerCase()]
        if (rows !== undefined) return rows
      }
    }
    return NO_BELT_ROWS
  }

  private findAvailableBeltSlot(
    entry: InternalClientEntry113c,
    itemCode: string,
  ): number | null {
    const catalog = BELT_POTION_CATALOG[itemCode.trim().toLowerCase()]
    if (catalog === undefined) return null
    const maxRows = this.getPlayerBeltMaxRows(entry)
    const occupied = new Map<number, ItemData>()
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location !== 2) continue
      const linear = (item.gridX ?? item.x ?? 0) & 0x0f
      occupied.set(linear, item)
    }
    // Prefer matching column family first (row 0 defines column family)
    for (let col = 0; col < 4; col++) {
      const base = occupied.get(col)
      if (base === undefined) continue
      const baseCat = BELT_POTION_CATALOG[base.code.trim().toLowerCase()]
      const sameFamily =
        baseCat !== undefined &&
        (catalog.kind === 'scroll' || baseCat.kind === 'scroll'
          ? catalog.code === baseCat.code
          : catalog.kind === baseCat.kind)
      if (!sameFamily) continue
      for (let row = 1; row < maxRows; row++) {
        const slot = row * 4 + col
        if (!occupied.has(slot)) return slot
      }
    }
    // Otherwise pick first empty bottom slot
    for (let col = 0; col < 4; col++) {
      if (!occupied.has(col)) return col
    }
    return null
  }

  private shiftBeltColumnDown(
    entry: InternalClientEntry113c,
    col: number,
    removedRow: number,
  ): void {
    const upper: Array<{ readonly index: number; readonly row: number }> = []
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location !== 2) continue
      const linear = (item.gridX ?? item.x ?? 0) & 0x0f
      const itemCol = linear & 3
      const itemRow = linear >> 2
      if (itemCol === col && itemRow > removedRow) {
        upper.push({ index: i, row: itemRow })
      }
    }
    upper.sort((a, b) => a.row - b.row)
    for (let k = 0; k < upper.length; k++) {
      const idx = upper[k]!.index
      const prev = entry.ownedItems[idx]!
      const nextSlot = (upper[k]!.row - 1) * 4 + col
      const shifted: ItemData = {
        ...prev,
        location: 2,
        container: 'belt',
        gridX: nextSlot,
        gridY: 0,
        x: nextSlot,
        y: 0,
      }
      entry.ownedItems[idx] = shifted
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'beltPut',
        itemId: shifted.id,
        code: shifted.code,
        x: nextSlot,
        y: 0,
        container: 'belt',
        item: shifted,
      })
    }
  }

  private getOwnedSocketChildren(entry: InternalClientEntry113c, hostId: number): ItemData[] {
    const out: ItemData[] = []
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if ((item.location === 6 || Boolean(item.inSocket)) && item.ownerId === hostId) {
        out.push(item)
      }
    }
    return out
  }

  private removeOwnedItemAndChildren(
    entry: InternalClientEntry113c,
    itemId: number,
  ): { readonly item: ItemData; readonly children: ItemData[] } | null {
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId)
    if (idx === -1) return null
    const [item] = entry.ownedItems.splice(idx, 1)
    if (item === undefined) return null
    const children: ItemData[] = []
    for (let i = entry.ownedItems.length - 1; i >= 0; i--) {
      const cand = entry.ownedItems[i]!
      if ((cand.location === 6 || Boolean(cand.inSocket)) && cand.ownerId === itemId) {
        children.unshift(cand)
        entry.ownedItems.splice(i, 1)
      }
    }
    return { item, children }
  }

  private getEffectiveEquippedStatSum(entry: InternalClientEntry113c, statId: number): number {
    let sum = 0
    const activeHosts = new Set<number>()
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location !== 1) continue
      const bodyLoc = item.bodyLoc ?? item.equippedSlot ?? 0
      if (bodyLoc < 1 || bodyLoc > 10) continue
      activeHosts.add(item.id)
      for (const st of item.stats ?? []) {
        if (st.statId === statId) sum += st.value | 0
      }
      for (const st of item.runewordStats ?? []) {
        if (st.statId === statId) sum += st.value | 0
      }
    }
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location === 6 && item.ownerId !== undefined && activeHosts.has(item.ownerId)) {
        for (const st of item.stats ?? []) {
          if (st.statId === statId) sum += st.value | 0
        }
      }
    }
    return sum
  }

  private findWalkableDropCoord(originX: number, originY: number): { readonly x: number; readonly y: number } {
    const room = this.sliceWorld.roomByPtr.get(this.defaultRoomPtr)
    if (room === undefined) {
      return { x: originX & 0xffff, y: originY & 0xffff }
    }
    const free = collisionGetFreeCoordinates(
      (x, y) => (room.grid.get(x, y) & 0x1c09) === 0,
      originX,
      originY,
      8,
      1,
    )
    if (free !== null) {
      return { x: free.x & 0xffff, y: free.y & 0xffff }
    }
    return { x: originX & 0xffff, y: originY & 0xffff }
  }

  // ============================================================================
  // Wave 3 Part 1: Combat, Skill Casting (0x05..0x11), XP/Level-Up & Drops
  // ============================================================================

  private computeSkillManaCost256(skillId: number, slvl: number): number {
    const entry = SKILLS_BY_ID[skillId]
    if (entry === undefined) {
      if (ZERO_MANA_BASIC_PLAYER_SKILLS_113C.has(skillId)) return 0
      throw new Error(`Unknown 1.13c player skillId=${skillId} in computeSkillManaCost256`)
    }
    const raw = (entry.mana + entry.lvlmana * Math.max(0, slvl - 1)) << entry.manashift
    const min256 = entry.minmana << 8
    return Math.max(0, Math.max(min256, raw))
  }

  private handleC2SSkillUse(
    entry: InternalClientEntry113c,
    opcode: number,
    rawBytes: Uint8Array,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return

    const isLeft = opcode <= 0x0a
    const isLocation =
      opcode === 0x05 || opcode === 0x08 || opcode === 0x0c || opcode === 0x0f
    const dv = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength)

    // 1. Resolve active hand skill from `D2SkillListStrc` in `SparseMemory113c`
    const pSkills = m.get(pPlayer, D2UnitStrc.pSkills) >>> 0
    let pSk = 0
    if (pSkills !== 0) {
      pSk = isLeft
        ? (SKILLS_GetLeftSkillFromSkillList113c(m, pSkills) >>> 0)
        : (m.get(pSkills, D2SkillListStrc.pRightSkill) >>> 0)
    }
    const skillId = pSk !== 0 ? (SKILLS_GetSkillIdFromSkill113c(m, pSk, 0, 0) | 0) : 0
    const effectiveLevel =
      pSk !== 0 ? (SKILLS_GetSkillLevel113c(m, pPlayer, pSk, 1) | 0) : skillId === 0 ? 1 : 0
    if (skillId > 0 && effectiveLevel <= 0) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    // 2. Validate `Skills.txt` `InTown` (`#54 Teleport` & combat skills forbidden in towns 1,40,75,103,109)
    const inTown =
      TOWN_AREA_IDS_113C.has(this.areaId) ||
      DUNGEON_CheckRoomIsTown113c(m, this.defaultRoomPtr) !== 0
    if (inTown && !isSkillAllowedInTown(skillId)) {
      this.sendPlaySound(entry, SOUND_NOT_IN_TOWN_113C)
      return
    }

    // 3. Check 1.13c mana requirement before mutating state
    const slvl = Math.max(1, effectiveLevel)
    const manaCost256 = this.computeSkillManaCost256(skillId, slvl)
    const curMana256 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANA, 0) | 0
    if (manaCost256 > 0 && curMana256 < manaCost256) {
      this.sendPlaySound(entry, SOUND_NEED_MANA_113C)
      return
    }

    entry.pendingInteraction = null
    entry.activeWaypointUnitId = 0

    let targetUnitType = 0
    let targetUnitId = 0
    let targetX = UNITS_GetX113c(m, pPlayer) & 0xffff
    let targetY = UNITS_GetY113c(m, pPlayer) & 0xffff
    if (isLocation) {
      targetX = dv.getUint16(1, true) & 0xffff
      targetY = dv.getUint16(3, true) & 0xffff
    } else {
      targetUnitType = dv.getUint32(1, true) >>> 0
      targetUnitId = dv.getUint32(5, true) >>> 0
      const pTarget = this.findUnitInActiveRoom(targetUnitType, targetUnitId)
      if (pTarget !== 0) {
        targetX = UNITS_GetX113c(m, pTarget) & 0xffff
        targetY = UNITS_GetY113c(m, pTarget) & 0xffff
      }
    }

    // 4. Special-case `#54 Teleport`: validate walkable non-town destination, spend mana, reassign (`0x15`) + vitals (`0x95`)
    if (skillId === 54) {
      const room = this.sliceWorld.roomByPtr.get(this.defaultRoomPtr)
      if (room === undefined || this.defaultRoomPtr === 0) {
        this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
        return
      }
      const minX = m.get(this.defaultRoomPtr, D2ActiveRoomStrc.nSubtileX) | 0
      const minY = m.get(this.defaultRoomPtr, D2ActiveRoomStrc.nSubtileY) | 0
      const subW = m.get(this.defaultRoomPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
      const subH = m.get(this.defaultRoomPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
      const maxX = minX + subW - 1
      const maxY = minY + subH - 1
      if (targetX < minX || targetY < minY || targetX > maxX || targetY > maxY) {
        this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
        return
      }
      let destX = targetX
      let destY = targetY
      if ((room.grid.get(destX, destY) & 0x1c09) !== 0) {
        const free = collisionGetFreeCoordinates(
          (x, y) =>
            x >= minX &&
            y >= minY &&
            x <= maxX &&
            y <= maxY &&
            (room.grid.get(x, y) & 0x1c09) === 0,
          destX,
          destY,
          5,
          1,
        )
        if (free === null) {
          this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
          return
        }
        destX = free.x & 0xffff
        destY = free.y & 0xffff
      }

      if (manaCost256 > 0) {
        STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, Math.max(0, curMana256 - manaCost256), 0)
      }

      this.broadcastServerEventToInGameClients({
        type: 'SkillCast',
        caster: { unitType: 0, id: entry.playerUnitId },
        skill: skillId,
        level: slvl,
        target: { x: destX, y: destY },
      })

      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
      const pPath = m.get(pPlayer, D2UnitStrc.pPath) >>> 0
      if (pPath !== 0) {
        m.set(pPath, D2DynamicPathStrc.wOffsetX, 0x8000)
        m.set(pPath, D2DynamicPathStrc.wPosX, destX & 0xffff)
        m.set(pPath, D2DynamicPathStrc.wOffsetY, 0x8000)
        m.set(pPath, D2DynamicPathStrc.wPosY, destY & 0xffff)
        m.set(pPath, D2DynamicPathStrc.wTargetX, destX & 0xffff)
        m.set(pPath, D2DynamicPathStrc.wTargetY, destY & 0xffff)
        m.set(pPath, D2DynamicPathStrc.pTargetUnit, 0)
        m.set(pPath, D2DynamicPathStrc.nDist, 0)
        m.set(pPath, D2DynamicPathStrc.nStepNum, 0)
        m.set(pPath, D2DynamicPathStrc.nDistance, 0)
      }
      const pu = this.sliceWorld.pathUnitByPtr.get(pPlayer)
      if (pu !== undefined) {
        pu.dwAnimMode = PLRMODE_NEUTRAL
      }
      NET_SendReassignUnitPacket15_113c(m, pPlayer, entry.pClient, 1)
      this.sendPlayerVitals95(entry)
      return
    }

    // 5. General combat / offensive / utility skill cast
    this.stopPlayerMovementInPlace(entry)
    if (manaCost256 > 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, Math.max(0, curMana256 - manaCost256), 0)
    }

    if (!isLocation && targetUnitId !== 0) {
      this.broadcastServerEventToInGameClients({
        type: 'SkillCast',
        caster: { unitType: 0, id: entry.playerUnitId },
        skill: skillId,
        level: slvl,
        target: { unitType: targetUnitType as 0 | 1 | 2 | 3 | 4 | 5, id: targetUnitId },
      })
    } else {
      this.broadcastServerEventToInGameClients({
        type: 'SkillCast',
        caster: { unitType: 0, id: entry.playerUnitId },
        skill: skillId,
        level: slvl,
        target: { x: targetX, y: targetY },
      })
    }
    this.sendPlayerVitals95(entry)

    // 6. Resolve hit hostile monster(s) in active room
    const hitMonsters: number[] = []
    if (!isLocation && targetUnitType === UNIT_MONSTER && targetUnitId !== 0) {
      const pMon = this.findUnitInActiveRoom(UNIT_MONSTER, targetUnitId)
      if (pMon !== 0 && this.isAliveHostileMonster(pMon)) {
        hitMonsters.push(pMon)
      }
    } else {
      const pRoom = this.defaultRoomPtr >>> 0
      if (pRoom !== 0) {
        const isAoeSkill = this.isAreaEffectSkill113c(skillId)
        const radius = isAoeSkill ? 8 : 5
        let bestSingle = 0
        let bestDist = radius + 1
        let pWalk = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst) >>> 0
        let guard = 0
        while (pWalk !== 0 && guard++ < 2048) {
          if (
            (m.get(pWalk, D2UnitStrc.dwUnitType) >>> 0) === UNIT_MONSTER &&
            this.isAliveHostileMonster(pWalk)
          ) {
            const mx = UNITS_GetX113c(m, pWalk) & 0xffff
            const my = UNITS_GetY113c(m, pWalk) & 0xffff
            const d = Math.hypot(mx - targetX, my - targetY)
            if (d <= radius) {
              if (isAoeSkill) {
                hitMonsters.push(pWalk)
              } else if (d < bestDist) {
                bestDist = d
                bestSingle = pWalk
              }
            }
          }
          pWalk = m.get(pWalk, D2UnitStrc.pRoomUnitNext) >>> 0
        }
        if (!isAoeSkill && bestSingle !== 0) {
          hitMonsters.push(bestSingle)
        }
      }
    }

    for (let i = 0; i < hitMonsters.length; i++) {
      this.applyPlayerSkillDamageToMonster(entry, skillId, slvl, hitMonsters[i]!)
    }
  }

  private isAliveHostileMonster(pMon: number): boolean {
    const m = this.m
    const classId = m.get(pMon, D2UnitStrc.dwClassId) >>> 0
    if (isInteractiveNpcClassId113c(classId)) return false
    const mode = m.get(pMon, D2UnitStrc.dwAnimMode) >>> 0
    if (mode === 0 || mode === 12) return false
    const hp256 = STATLIST_GetUnitStat113c(m, pMon, STAT_HITPOINTS, 0) | 0
    return hp256 > 0
  }

  private isAreaEffectSkill113c(skillId: number): boolean {
    return (
      skillId === 44 || // Frost Nova
      skillId === 47 || // Fire Ball
      skillId === 48 || // Nova
      skillId === 51 || // Fire Wall
      skillId === 55 || // Glacial Spike
      skillId === 56 || // Meteor
      skillId === 59 || // Blizzard
      skillId === 64 || // Frozen Orb
      skillId === 74 || // Corpse Explosion
      skillId === 92 || // Poison Nova
      skillId === 112 || // Blessed Hammer
      skillId === 132 || // Leap
      skillId === 151 || // Whirlwind
      skillId === 154 || // War Cry
      skillId === 225 || // Firestorm
      skillId === 234 || // Fissure
      skillId === 245 // Tornado
    )
  }

  private computeWeaponDamageRange113c(entry: InternalClientEntry113c): {
    readonly min: number
    readonly max: number
  } {
    const tables = getEmbeddedDropTables()
    let selectedWeaponDamage: { readonly min: number; readonly max: number } | null = null
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location !== 1) continue
      const slot = item.bodyLoc ?? item.equippedSlot ?? 0
      if (slot !== 4 && slot !== 5) continue
      const code = item.code.trim()
      const base = tables.getBase(code)
      if (base === undefined) {
        throw new Error(`Unknown 1.13c item code "${code}" equipped in weapon hand slot ${slot}`)
      }
      if (base.kind !== 'weapon') {
        const itemType =
          base.type !== undefined ? tables.itemTypes.byCode.get(base.type) : undefined
        const isValidHandNonWeapon =
          itemType !== undefined &&
          itemType.body &&
          (itemType.bodyLoc1 === 'rarm' ||
            itemType.bodyLoc1 === 'larm' ||
            itemType.bodyLoc2 === 'rarm' ||
            itemType.bodyLoc2 === 'larm')
        if (isValidHandNonWeapon) continue
        throw new Error(
          `Non-weapon item code "${code}" (kind=${base.kind}, type=${base.type ?? 'unknown'}) cannot be equipped in weapon hand slot ${slot}`,
        )
      }
      const wBase = tables.weapons.get(code)
      if (wBase === undefined) {
        throw new Error(
          `Missing 1.13c Weapons.txt row for weapon code "${code}" in hand slot ${slot}`,
        )
      }
      const twoHMin = wBase.twoHandedMindam ?? 0
      const twoHMax = wBase.twoHandedMaxdam ?? 0
      const has1H = wBase.mindam > 0 || wBase.maxdam > 0
      const has2H = twoHMin > 0 || twoHMax > 0
      if (!has1H && !has2H) {
        throw new Error(
          `Weapon "${code}" in hand slot ${slot} has zero 1H and 2H base damage in Weapons.txt`,
        )
      }
      if (selectedWeaponDamage === null) {
        const rawMin = Math.max(1, has1H ? wBase.mindam : twoHMin)
        const rawMax = Math.max(rawMin, has1H ? wBase.maxdam : twoHMax)
        let edPct = 0
        let addMin = 0
        let addMax = 0
        for (const st of item.stats ?? []) {
          if (st.statId === 17 || st.statId === 18) edPct += st.value | 0
          else if (st.statId === 21 || st.statId === 23) addMin += st.value | 0
          else if (st.statId === 22 || st.statId === 24) addMax += st.value | 0
        }
        const scaledMin = Math.max(1, Math.floor((rawMin * (100 + edPct)) / 100) + addMin)
        const scaledMax = Math.max(scaledMin, Math.floor((rawMax * (100 + edPct)) / 100) + addMax)
        selectedWeaponDamage = { min: scaledMin, max: scaledMax }
      }
    }
    if (selectedWeaponDamage !== null) {
      return selectedWeaponDamage
    }
    // Unarmed / shield-or-quiver-only floor per `D2Game.dll:0x6FCFC5A2..0x6FCFC5C8` (`STAT_MINDAMAGE` / `STAT_MAXDAMAGE`).
    const pPlayer = entry.pPlayer >>> 0
    const statMin =
      (pPlayer !== 0 ? STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_MINDAMAGE, 0) | 0 : 0) +
      this.getEffectiveEquippedStatSum(entry, STAT_MINDAMAGE)
    const statMax =
      (pPlayer !== 0 ? STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_MAXDAMAGE, 0) | 0 : 0) +
      this.getEffectiveEquippedStatSum(entry, STAT_MAXDAMAGE)
    const unarmedMin = statMin > 0 ? statMin : 1
    const unarmedMax = Math.max(unarmedMin, statMax > 1 ? statMax : 2)
    return { min: unarmedMin, max: unarmedMax }
  }

  private applyPlayerSkillDamageToMonster(
    entry: InternalClientEntry113c,
    skillId: number,
    slvl: number,
    pMon: number,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    const monId = m.get(pMon, D2UnitStrc.dwUnitId) >>> 0
    const monClassId = m.get(pMon, D2UnitStrc.dwClassId) >>> 0
    const monRow = MONSTATS_113C_ROWS[monClassId]
    if (monRow === undefined) {
      throw new Error(
        `Unknown 1.13c MonStats classId=${monClassId} for monster unitId=${monId} in applyPlayerSkillDamageToMonster`,
      )
    }
    const meta = this.monsterMetaByUnitId.get(monId)
    if (meta === undefined) {
      throw new Error(
        `Missing 1.13c MonsterCombatMeta for monster unitId=${monId} (classId=${monClassId}) in applyPlayerSkillDamageToMonster`,
      )
    }
    const diff = this.difficultyValue

    const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
    const mlvl = Math.max(1, meta.level)
    const monAc = meta.ac

    const catalog = SKILLS_BY_ID[skillId]
    if (catalog === undefined && !ZERO_MANA_BASIC_PLAYER_SKILLS_113C.has(skillId)) {
      throw new Error(`Unknown 1.13c player skillId=${skillId} in applyPlayerSkillDamageToMonster`)
    }
    const isSpell =
      catalog !== undefined &&
      catalog.srcDamage === 0 &&
      (catalog.eMin > 0 || catalog.eMax > 0 || catalog.minDam > 0 || catalog.maxDam > 0)

    // 1. 1.13c To-Hit check for physical attacks (spells auto-hit)
    if (!isSpell) {
      const classCode = requireCharClassCode113c(entry.charClass)
      const charStats = CANONICAL_CHARSTATS[classCode]
      const dex =
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_DEXTERITY, 0) | 0) +
        this.getEffectiveEquippedStatSum(entry, STAT_DEXTERITY)
      const itemAr = this.getEffectiveEquippedStatSum(entry, 19)
      const skillToHitPct =
        catalog !== undefined && (catalog.toHit > 0 || catalog.toHitLev > 0)
          ? catalog.toHit + catalog.toHitLev * Math.max(0, slvl - 1)
          : 0
      const baseAr = Math.max(5, dex * 5 - 35 + charStats.toHitFactor + itemAr)
      const effectiveAr = Math.max(5, Math.floor((baseAr * (100 + skillToHitPct)) / 100))
      const hitChance = calculateHitChance(effectiveAr, monAc, clvl, mlvl)
      if (this.rng.rand(100) >= hitChance) {
        return
      }
    }

    // 2. 1.13c Damage calculation (5-band skill scaling + weapon/str physical + MonStats resistances)
    const str =
      (STATLIST_GetUnitStat113c(m, pPlayer, STAT_STRENGTH, 0) | 0) +
      this.getEffectiveEquippedStatSum(entry, STAT_STRENGTH)
    let physMin = 0
    let physMax = 0
    let elemMin = 0
    let elemMax = 0
    let eType = ''

    if (catalog !== undefined) {
      const shift = catalog.hitshift
      if (catalog.minDam > 0 || catalog.maxDam > 0) {
        const rawMin = compute5BandScaling(
          slvl,
          catalog.minDam,
          catalog.minLevDam[0] ?? 0,
          catalog.minLevDam[1] ?? 0,
          catalog.minLevDam[2] ?? 0,
          catalog.minLevDam[3] ?? 0,
          catalog.minLevDam[4] ?? 0,
        )
        const rawMax = compute5BandScaling(
          slvl,
          catalog.maxDam,
          catalog.maxLevDam[0] ?? 0,
          catalog.maxLevDam[1] ?? 0,
          catalog.maxLevDam[2] ?? 0,
          catalog.maxLevDam[3] ?? 0,
          catalog.maxLevDam[4] ?? 0,
        )
        physMin += Math.max(0, (rawMin << shift) >> 8)
        physMax += Math.max(physMin, (rawMax << shift) >> 8)
      }
      if (catalog.eMin > 0 || catalog.eMax > 0) {
        eType = catalog.eType.trim().toLowerCase()
        const rawEMin = compute5BandScaling(
          slvl,
          catalog.eMin,
          catalog.eMinLev[0] ?? 0,
          catalog.eMinLev[1] ?? 0,
          catalog.eMinLev[2] ?? 0,
          catalog.eMinLev[3] ?? 0,
          catalog.eMinLev[4] ?? 0,
        )
        const rawEMax = compute5BandScaling(
          slvl,
          catalog.eMax,
          catalog.eMaxLev[0] ?? 0,
          catalog.eMaxLev[1] ?? 0,
          catalog.eMaxLev[2] ?? 0,
          catalog.eMaxLev[3] ?? 0,
          catalog.eMaxLev[4] ?? 0,
        )
        elemMin = Math.max(1, (rawEMin << shift) >> 8)
        elemMax = Math.max(elemMin, (rawEMax << shift) >> 8)
      }
      if (catalog.srcDamage > 0) {
        const w = this.computeWeaponDamageRange113c(entry)
        const strScaledMin = Math.max(1, Math.floor((w.min * (100 + str)) / 100))
        const strScaledMax = Math.max(strScaledMin, Math.floor((w.max * (100 + str)) / 100))
        physMin += Math.max(1, Math.floor((strScaledMin * catalog.srcDamage) / 128))
        physMax += Math.max(physMin, Math.floor((strScaledMax * catalog.srcDamage) / 128))
      }
    } else {
      const w = this.computeWeaponDamageRange113c(entry)
      physMin = Math.max(1, Math.floor((w.min * (100 + str)) / 100))
      physMax = Math.max(physMin, Math.floor((w.max * (100 + str)) / 100))
    }

    const rollPhys =
      physMax > 0
        ? physMin < physMax
          ? this.rng.randRange(physMin, physMax)
          : physMax
        : 0
    const rollElem =
      elemMax > 0
        ? elemMin < elemMax
          ? this.rng.randRange(elemMin, elemMax)
          : elemMax
        : 0

    const resPhys = monRow.resDm[diff]
    const resElem =
      eType === 'fire'
        ? monRow.resFi[diff]
        : eType === 'ltng'
          ? monRow.resLi[diff]
          : eType === 'cold'
            ? monRow.resCo[diff]
            : eType === 'pois'
              ? monRow.resPo[diff]
              : eType === 'mag'
                ? monRow.resMa[diff]
                : 0

    const netPhys =
      rollPhys > 0 && resPhys < 100
        ? Math.max(1, Math.floor((rollPhys * (100 - resPhys)) / 100))
        : 0
    const netElem =
      rollElem > 0 && resElem < 100
        ? Math.max(1, Math.floor((rollElem * (100 - resElem)) / 100))
        : 0
    const totalDamage = netPhys + netElem
    if (totalDamage <= 0) return

    const curHp256 = STATLIST_GetUnitStat113c(m, pMon, STAT_HITPOINTS, 0) | 0
    const maxHp256 = Math.max(256, STATLIST_GetUnitStat113c(m, pMon, STAT_MAXHP, 0) | 0)
    const nextHp256 = Math.max(0, curHp256 - (totalDamage << 8))
    STATLIST_SetUnitStat113c(m, pMon, STAT_HITPOINTS, nextHp256, 0)

    if (nextHp256 > 0) {
      const lifePct = Math.max(1, Math.min(128, Math.ceil((nextHp256 * 128) / maxHp256)))
      this.broadcastServerEventToInGameClients({
        type: 'UnitMode',
        unitType: 1,
        id: monId,
        hitClass: 0x01,
        lifePct,
      })
      return
    }

    // 3. Monster death: `mode = 12` (`MONMODE_DEAD`), S2C `0x69`, 1.13c kill XP + level-up + drops!
    m.set(pMon, D2UnitStrc.dwAnimMode, 12)
    const puMon = this.sliceWorld.pathUnitByPtr.get(pMon)
    if (puMon !== undefined) {
      puMon.dwAnimMode = 12
    }
    const monX = UNITS_GetX113c(m, pMon) & 0xffff
    const monY = UNITS_GetY113c(m, pMon) & 0xffff
    this.broadcastServerEventToInGameClients({
      type: 'UnitMode',
      unitType: 1,
      id: monId,
      mode: 12,
      at: { x: monX, y: monY },
      lifePct: 0,
    })

    // 4. Grant 1.13c kill XP (`STAT_EXPERIENCE` + S2C `0x1A`/`0x1B`/`0x1C` + level-up)
    const rawBaseExp = meta.baseExp
    const scaledBaseExp =
      rawBaseExp > 0 ? Math.max(1, Math.floor((rawBaseExp * (this.playersXValue + 1)) / 2)) : 0
    const addExpPct = this.getEffectiveEquippedStatSum(entry, 85)
    const expGain =
      scaledBaseExp > 0
        ? calculateKillExperienceGain113c({
            rawExp: scaledBaseExp,
            clvl,
            mlvl,
            addExpPct,
          })
        : 0
    if (expGain > 0) {
      this.grantPlayerExperience113c(entry, expGain)
    }

    // 5. Roll 1.13c monster TreasureClass drop and spawn ground gold/items (`S2C 0x9C` action `0x00`)
    if (meta.tcName !== null) {
      this.rollAndSpawnMonsterDrops113c(monX, monY, mlvl, meta.tcName)
    }
  }

  private grantPlayerExperience113c(entry: InternalClientEntry113c, expGain: number): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || expGain <= 0) return

    const curLevel = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
    if (curLevel >= 99) return
    const curExp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_EXPERIENCE, 0) >>> 0
    const nextExp = (curExp + (expGain >>> 0)) >>> 0
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_EXPERIENCE, nextExp | 0, 0)

    if (expGain <= 0xffff) {
      this.queueServerEventToClient(entry, {
        type: 'Experience',
        value: expGain,
        isDelta: true,
      })
    } else {
      this.queueServerEventToClient(entry, {
        type: 'Experience',
        value: nextExp,
        isDelta: false,
      })
    }

    const className = requireCharClassName113c(entry.charClass)
    const classCode = requireCharClassCode113c(entry.charClass)
    const charStats = CANONICAL_CHARSTATS[classCode]

    let level = curLevel
    let leveledUp = false
    while (level < 99) {
      const nextThreshold = getExperienceForLevel(level + 1, className)
      if (nextThreshold <= 0 || nextExp < nextThreshold) break
      level++
      leveledUp = true

      const nextStatPts =
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_STATPTS, 0) | 0) + charStats.perLevel.statPoints
      const nextSkillPts = (STATLIST_GetUnitStat113c(m, pPlayer, STAT_NEWSKILLS, 0) | 0) + 1
      const nextMaxHp =
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXHP, 0) | 0) +
        Math.round(charStats.perLevel.life * 256)
      const nextMaxMana =
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXMANA, 0) | 0) +
        Math.round(charStats.perLevel.mana * 256)
      const nextMaxStam =
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, 0) | 0) +
        Math.round(charStats.perLevel.stamina * 256)

      STATLIST_SetUnitStat113c(m, pPlayer, STAT_LEVEL, level, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_STATPTS, nextStatPts, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_NEWSKILLS, nextSkillPts, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXHP, nextMaxHp, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, nextMaxHp, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXMANA, nextMaxMana, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, nextMaxMana, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, nextMaxStam, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, nextMaxStam, 0)
    }

    if (leveledUp) {
      for (const statId of [
        STAT_LEVEL,
        STAT_STATPTS,
        STAT_NEWSKILLS,
        STAT_MAXHP,
        STAT_HITPOINTS,
        STAT_MAXMANA,
        STAT_MANA,
        STAT_MAXSTAMINA,
        STAT_STAMINA,
      ]) {
        const val = STATLIST_GetUnitStat113c(m, pPlayer, statId, 0) | 0
        this.sendPlayerStatUpdate(entry, statId, val)
      }
      this.sendPlayerVitals95(entry)
    }
  }

  private rollAndSpawnMonsterDrops113c(
    monX: number,
    monY: number,
    mlvl: number,
    tcName: string,
  ): void {
    const tables = getEmbeddedDropTables()
    const diffName =
      this.difficultyValue === 2 ? 'hell' : this.difficultyValue === 1 ? 'nightmare' : 'normal'
    const trimmedTc = tcName.trim()
    if (trimmedTc === '') {
      throw new Error(
        `Missing/empty 1.13c TreasureClass name in rollAndSpawnMonsterDrops113c (mlvl=${mlvl}, difficulty=${diffName})`,
      )
    }
    if (
      tables.tcTable.get(trimmedTc) === undefined &&
      !tables.autoTcTable.has(trimmedTc) &&
      tables.getBase(trimmedTc) === undefined
    ) {
      throw new Error(
        `Unknown 1.13c TreasureClass "${trimmedTc}" in rollAndSpawnMonsterDrops113c (mlvl=${mlvl}, difficulty=${diffName})`,
      )
    }
    const dropped = executeDropPipeline(tables, {
      tcName: trimmedTc,
      nLevel: mlvl,
      difficulty: diffName,
      gamePlayers: this.playersXValue,
      partyPlayers: 1,
      monsterRng: this.rng,
    })

    let spawnedCount = 0
    for (let i = 0; i < dropped.length; i++) {
      const raw = finalizeDroppedItem113c(dropped[i]!)
      const code = (raw.code ?? raw.base.id).trim()
      const baseMeta = this.tables.getItemBaseMeta(code)
      const unitId = this.allocUnitId()
      const itemData = domainItemToItemData113c(raw, tables, {
        unitId,
        compactSave: Boolean(baseMeta?.compactSave) && raw.base.kind === 'misc' && code !== 'tbk' && code !== 'ibk',
      })
      const pos = this.findWalkableDropCoord(monX, monY)
      this.spawnGroundItemInRoom(itemData, pos.x, pos.y, 'groundSpawn')
      spawnedCount++
    }

    // Legacy gold-on-NoDrop fallback for valid non-empty TCs; scheduled for deletion in Phase 2C
    // when kernel `ITEMS_DropMonsterTreasure_6FC32D60_113c` replaces `rollAndSpawnMonsterDrops113c`.
    if (spawnedCount === 0) {
      const goldAmount = Math.max(1, mlvl * 5 + this.rng.rand(Math.max(5, mlvl * 10)))
      const pos = this.findWalkableDropCoord(monX, monY)
      this.spawnGroundItemInRoom(
        {
          code: 'gld',
          goldAmount,
          quantity: goldAmount,
          compact: true,
          simple: true,
          identified: true,
          quality: 2,
        },
        pos.x,
        pos.y,
        'groundSpawn',
      )
    }
  }

  // ============================================================================
  // Wave 3 Part 2: Ground, Inventory, Equipment, Belt, Consumables, Gold & Swap
  // ============================================================================

  private handleC2SPickItem(
    entry: InternalClientEntry113c,
    itemId: number,
    toCursor: boolean,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return

    const gRec = this.groundItems.get(itemId)
    if (gRec === undefined || gRec.areaId !== this.areaId) return

    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    if (Math.hypot(plrX - gRec.x, plrY - gRec.y) > ITEM_PICKUP_RANGE_SUBTILES_113C) {
      return
    }

    const codeLower = gRec.item.code.trim().toLowerCase()
    if (codeLower === 'gld') {
      const goldAmt = Math.max(1, Math.trunc(gRec.item.goldAmount ?? gRec.item.quantity ?? 1))
      const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
      const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
      const cap = getInventoryGoldLimit(clvl)
      const added = Math.min(goldAmt, Math.max(0, cap - curGold))
      const overflow = goldAmt - added

      this.groundItems.delete(itemId)
      this.broadcastServerEventToInGameClients({
        type: 'UnitRemove',
        unitType: UNIT_ITEM_113C,
        id: itemId,
        unitId: itemId,
      })

      if (added > 0) {
        const nextGold = (curGold + added) >>> 0
        STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
        this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)
      }
      if (overflow > 0) {
        this.spawnGroundItemInRoom(
          {
            code: 'gld',
            goldAmount: overflow,
            quantity: overflow,
            compact: true,
            simple: true,
            identified: true,
            quality: 2,
          },
          plrX,
          plrY,
          'drop',
        )
      }
      return
    }

    if (toCursor && entry.ownedItems.some((i) => i.location === 4)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    const size = this.getItemGridSize(gRec.item)
    const freeSlot = !toCursor
      ? this.findFreeContainerSlot(entry, 1, size.width, size.height)
      : null
    if (!toCursor && freeSlot === null) {
      this.sendPlaySound(entry, SOUND_CANT_CARRY_113C)
      return
    }

    this.groundItems.delete(itemId)
    this.broadcastServerEventToInGameClients({
      type: 'UnitRemove',
      unitType: UNIT_ITEM_113C,
      id: itemId,
      unitId: itemId,
    })

    const cleanFlags =
      (Number(gRec.item.rawFlags ?? gRec.item.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const pickedItem: ItemData = toCursor
      ? {
          ...gRec.item,
          flags: cleanFlags,
          rawFlags: cleanFlags,
          location: 4,
          container: 'cursor',
          bodyLoc: 0,
          equippedSlot: 0,
          equipped: false,
          storePage: 0,
          storagePage: 0,
          gridX: 0,
          gridY: 0,
          x: 0,
          y: 0,
          worldX: 0,
          worldY: 0,
          ownerType: 0,
          ownerId: entry.playerUnitId,
        }
      : {
          ...gRec.item,
          flags: cleanFlags,
          rawFlags: cleanFlags,
          location: 0,
          container: 'inventory',
          bodyLoc: 0,
          equippedSlot: 0,
          equipped: false,
          storePage: 1,
          storagePage: 1,
          gridX: freeSlot!.x,
          gridY: freeSlot!.y,
          x: freeSlot!.x,
          y: freeSlot!.y,
          worldX: 0,
          worldY: 0,
          ownerType: 0,
          ownerId: entry.playerUnitId,
        }
    entry.ownedItems.push(pickedItem)
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'pickup',
      itemId: pickedItem.id,
      code: pickedItem.code,
      x: pickedItem.gridX ?? 0,
      y: pickedItem.gridY ?? 0,
      container: toCursor ? 'cursor' : 'inventory',
      ownerId: entry.playerUnitId,
      item: pickedItem,
    })
  }

  private handleC2SDropItem(entry: InternalClientEntry113c, itemId: number): void {
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return

    const cursorIdx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 4)
    if (cursorIdx === -1) return

    const removed = this.removeOwnedItemAndChildren(entry, itemId)
    if (removed === null) return

    const plrX = UNITS_GetX113c(this.m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(this.m, pPlayer) & 0xffff
    const dropPos = this.findWalkableDropCoord(plrX, plrY)

    this.spawnGroundItemInRoom(
      {
        ...removed.item,
        ...(removed.children.length > 0 ? { socketedItems: removed.children } : {}),
      },
      dropPos.x,
      dropPos.y,
      'drop',
    )
  }

  private handleC2SItemToBuffer(
    entry: InternalClientEntry113c,
    itemId: number,
    x: number,
    y: number,
    buffer: number,
  ): void {
    const storePage = buffer === 4 ? 5 : buffer === 3 ? 4 : buffer === 0 ? 1 : 0
    const dims = this.getContainerGridDims(storePage)
    if (dims === null) return

    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 4)
    if (idx === -1) return
    const cur = entry.ownedItems[idx]!
    // Prevent placing Horadric Cube (`box`) inside itself (`storePage === 4`)
    if (storePage === 4 && cur.code.trim().toLowerCase() === 'box') {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const size = this.getItemGridSize(cur)
    if (!this.canFitInContainerGrid(entry, storePage, x, y, size.width, size.height, itemId)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    const cleanFlags =
      (Number(cur.rawFlags ?? cur.flags ?? ITEM_FLAG_IDENTIFIED_113C) & ~ITEM_FLAG_DELETED_113C) >>>
      0
    const placed: ItemData = {
      ...cur,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 0,
      container: dims.container,
      storePage,
      storagePage: storePage,
      gridX: x,
      gridY: y,
      x,
      y,
      bodyLoc: 0,
      equippedSlot: 0,
      equipped: false,
      ownerType: 0,
      ownerId: entry.playerUnitId,
    }
    entry.ownedItems[idx] = placed
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'add',
      itemId: placed.id,
      code: placed.code,
      x,
      y,
      container: dims.container,
      ownerId: entry.playerUnitId,
      item: placed,
    })
  }

  private handleC2SRemoveFromBuffer(entry: InternalClientEntry113c, itemId: number): void {
    if (entry.ownedItems.some((i) => i.location === 4)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 0)
    if (idx === -1) return
    const cur = entry.ownedItems[idx]!
    const cleanFlags =
      (Number(cur.rawFlags ?? cur.flags ?? ITEM_FLAG_IDENTIFIED_113C) & ~ITEM_FLAG_DELETED_113C) >>>
      0
    const onCursor: ItemData = {
      ...cur,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 4,
      container: 'cursor',
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      bodyLoc: 0,
      equippedSlot: 0,
      equipped: false,
    }
    entry.ownedItems[idx] = onCursor
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x05,
      itemId: onCursor.id,
      code: onCursor.code,
      x: 0,
      y: 0,
      container: 'cursor',
      ownerId: entry.playerUnitId,
      item: onCursor,
    })
  }

  private toEquipCandidate113c(
    entry: InternalClientEntry113c,
    item: ItemData,
  ): EquipCandidateItem113c {
    const children = this.getOwnedSocketChildren(entry, item.id)
    return {
      unitId: item.id,
      id: item.id,
      code: item.code.trim(),
      bodyLoc: item.bodyLoc ?? item.equippedSlot ?? 0,
      quality: item.quality,
      ilvl: item.ilvl,
      identified: item.identified,
      ethereal: item.ethereal,
      broken: item.broken,
      durability: item.curDurability ?? item.durability,
      maxDurability: item.maxDurability,
      stats: item.stats,
      runewordStats: item.runewordStats,
      socketedItems: children.map((c) => ({
        unitId: c.id,
        id: c.id,
        code: c.code.trim(),
        stats: c.stats,
      })),
      rawItemData: item,
    }
  }

  private validatePlayerEquip113c(
    entry: InternalClientEntry113c,
    candidateItem: ItemData,
    targetBodyLoc: number,
  ): ReturnType<typeof canUnitEquipItem113c> {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
    const baseStr = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STRENGTH, 0) | 0
    const baseDex = STATLIST_GetUnitStat113c(m, pPlayer, STAT_DEXTERITY, 0) | 0
    const bonusStr = this.getEffectiveEquippedStatSum(entry, STAT_STRENGTH)
    const bonusDex = this.getEffectiveEquippedStatSum(entry, STAT_DEXTERITY)
    const classCode = requireCharClassCode113c(entry.charClass)
    const equippedCandidates: EquipCandidateItem113c[] = []
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const it = entry.ownedItems[i]!
      if (it.location !== 1) continue
      const bLoc = it.bodyLoc ?? it.equippedSlot ?? 0
      if (bLoc < 1 || bLoc > 10) continue
      equippedCandidates.push(this.toEquipCandidate113c(entry, it))
    }
    return canUnitEquipItem113c(
      {
        kind: 'player',
        level: clvl,
        baseStrength: baseStr,
        baseDexterity: baseDex,
        bonusStrength: bonusStr,
        bonusDexterity: bonusDex,
        classCode,
      },
      this.toEquipCandidate113c(entry, candidateItem),
      targetBodyLoc,
      equippedCandidates,
      { dropTables: getEmbeddedDropTables() },
    )
  }

  private handleC2SEquipItem(
    entry: InternalClientEntry113c,
    itemId: number,
    bodyLoc: number,
    allowOppositeDisplace = false,
  ): void {
    if (bodyLoc < 1 || bodyLoc > 10) return
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 4)
    if (idx === -1) return
    const candidate = entry.ownedItems[idx]!

    const check = this.validatePlayerEquip113c(entry, candidate, bodyLoc)
    if (!check.allowed) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    if (check.displacedTargetItem !== undefined) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    if (check.displacedOppositeItem !== undefined && !allowOppositeDisplace) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    if (check.displacedOppositeItem !== undefined) {
      const oppId = check.displacedOppositeItem.id ?? check.displacedOppositeItem.unitId ?? 0
      const oppIdx = entry.ownedItems.findIndex((i) => i.id === oppId && i.location === 1)
      if (oppIdx !== -1) {
        const oppPrev = entry.ownedItems[oppIdx]!
        const oppCleanFlags =
          (Number(oppPrev.rawFlags ?? oppPrev.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
            ~ITEM_FLAG_DELETED_113C) >>>
          0
        const oppCursor: ItemData = {
          ...oppPrev,
          flags: oppCleanFlags,
          rawFlags: oppCleanFlags,
          location: 4,
          container: 'cursor',
          bodyLoc: 0,
          equippedSlot: 0,
          equipped: false,
        }
        entry.ownedItems[oppIdx] = oppCursor
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'unequip',
          itemId: oppCursor.id,
          code: oppCursor.code,
          container: 'cursor',
          ownerId: entry.playerUnitId,
          item: oppCursor,
        })
      }
    }

    const cleanFlags =
      (Number(candidate.rawFlags ?? candidate.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const equippedItem: ItemData = {
      ...candidate,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 1,
      container: 'equipment',
      bodyLoc,
      equippedSlot: bodyLoc,
      equipped: true,
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      ownerType: 0,
      ownerId: entry.playerUnitId,
    }
    entry.ownedItems[idx] = equippedItem
    this.recomputeEquippedItemSkillBonuses(entry)

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'equip',
      itemId: equippedItem.id,
      code: equippedItem.code,
      bodyLoc,
      container: 'equipment',
      ownerId: entry.playerUnitId,
      item: equippedItem,
    })
    this.sendPlayerVitals95(entry)
  }

  private handleC2SUnequipItem(entry: InternalClientEntry113c, bodyLoc: number): void {
    if (bodyLoc < 1 || bodyLoc > 10) return
    if (entry.ownedItems.some((i) => i.location === 4)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const idx = entry.ownedItems.findIndex(
      (i) => i.location === 1 && (i.bodyLoc ?? i.equippedSlot ?? 0) === bodyLoc,
    )
    if (idx === -1) return
    const prev = entry.ownedItems[idx]!
    const cleanFlags =
      (Number(prev.rawFlags ?? prev.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const onCursor: ItemData = {
      ...prev,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 4,
      container: 'cursor',
      bodyLoc: 0,
      equippedSlot: 0,
      equipped: false,
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
    }
    entry.ownedItems[idx] = onCursor
    this.recomputeEquippedItemSkillBonuses(entry)

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'unequip',
      itemId: onCursor.id,
      code: onCursor.code,
      container: 'cursor',
      ownerId: entry.playerUnitId,
      item: onCursor,
    })
    this.sendPlayerVitals95(entry)
  }

  private handleC2SSwapEquippedItem(
    entry: InternalClientEntry113c,
    itemId: number,
    bodyLoc: number,
  ): void {
    if (bodyLoc < 1 || bodyLoc > 10) return
    const curIdx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 4)
    if (curIdx === -1) return
    const candidate = entry.ownedItems[curIdx]!

    const check = this.validatePlayerEquip113c(entry, candidate, bodyLoc)
    if (!check.allowed) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    const displaced = check.displacedItems
    if (displaced.length > 2) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    // If 2 items are displaced (dual 1H replaced by 2H), second displaced item must fit in inventory
    let secondDisplacedSlot: { readonly x: number; readonly y: number } | null = null
    if (displaced.length === 2) {
      const secondId = displaced[1]!.id ?? displaced[1]!.unitId ?? 0
      const secondItem = entry.ownedItems.find((i) => i.id === secondId)
      if (secondItem !== undefined) {
        const sz = this.getItemGridSize(secondItem)
        secondDisplacedSlot = this.findFreeContainerSlot(entry, 1, sz.width, sz.height)
        if (secondDisplacedSlot === null) {
          this.sendPlaySound(entry, SOUND_CANT_CARRY_113C)
          return
        }
      }
    }

    for (let d = 0; d < displaced.length; d++) {
      const dispId = displaced[d]!.id ?? displaced[d]!.unitId ?? 0
      const dispIdx = entry.ownedItems.findIndex((i) => i.id === dispId && i.location === 1)
      if (dispIdx === -1) continue
      const dispPrev = entry.ownedItems[dispIdx]!
      const cleanFlags =
        (Number(dispPrev.rawFlags ?? dispPrev.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
          ~ITEM_FLAG_DELETED_113C) >>>
        0
      if (d === 0) {
        const toCursor: ItemData = {
          ...dispPrev,
          flags: cleanFlags,
          rawFlags: cleanFlags,
          location: 4,
          container: 'cursor',
          bodyLoc: 0,
          equippedSlot: 0,
          equipped: false,
        }
        entry.ownedItems[dispIdx] = toCursor
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'unequip',
          itemId: toCursor.id,
          code: toCursor.code,
          container: 'cursor',
          ownerId: entry.playerUnitId,
          item: toCursor,
        })
      } else if (secondDisplacedSlot !== null) {
        const toInv: ItemData = {
          ...dispPrev,
          flags: cleanFlags,
          rawFlags: cleanFlags,
          location: 0,
          container: 'inventory',
          storePage: 1,
          storagePage: 1,
          gridX: secondDisplacedSlot.x,
          gridY: secondDisplacedSlot.y,
          x: secondDisplacedSlot.x,
          y: secondDisplacedSlot.y,
          bodyLoc: 0,
          equippedSlot: 0,
          equipped: false,
        }
        entry.ownedItems[dispIdx] = toInv
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'add',
          itemId: toInv.id,
          code: toInv.code,
          x: secondDisplacedSlot.x,
          y: secondDisplacedSlot.y,
          container: 'inventory',
          ownerId: entry.playerUnitId,
          item: toInv,
        })
      }
    }

    const candFlags =
      (Number(candidate.rawFlags ?? candidate.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const nextEquipped: ItemData = {
      ...candidate,
      flags: candFlags,
      rawFlags: candFlags,
      location: 1,
      container: 'equipment',
      bodyLoc,
      equippedSlot: bodyLoc,
      equipped: true,
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      ownerType: 0,
      ownerId: entry.playerUnitId,
    }
    entry.ownedItems[curIdx] = nextEquipped
    this.recomputeEquippedItemSkillBonuses(entry)

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'equip',
      itemId: nextEquipped.id,
      code: nextEquipped.code,
      bodyLoc,
      container: 'equipment',
      ownerId: entry.playerUnitId,
      item: nextEquipped,
    })
    this.sendPlayerVitals95(entry)
  }

  private handleC2SSwapContainerItem(
    entry: InternalClientEntry113c,
    cursorItemId: number,
    targetItemId: number,
    x: number,
    y: number,
  ): void {
    const curIdx = entry.ownedItems.findIndex((i) => i.id === cursorItemId && i.location === 4)
    const tgtIdx = entry.ownedItems.findIndex((i) => i.id === targetItemId && i.location === 0)
    if (curIdx === -1 || tgtIdx === -1) return

    const curItem = entry.ownedItems[curIdx]!
    const tgtItem = entry.ownedItems[tgtIdx]!
    const storePage = (tgtItem.storePage ?? tgtItem.storagePage ?? 1) || 1
    const dims = this.getContainerGridDims(storePage)
    if (dims === null) return

    if (storePage === 4 && curItem.code.trim().toLowerCase() === 'box') {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const sz = this.getItemGridSize(curItem)
    if (!this.canFitInContainerGrid(entry, storePage, x, y, sz.width, sz.height, targetItemId)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    const tgtFlags =
      (Number(tgtItem.rawFlags ?? tgtItem.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const nextCursor: ItemData = {
      ...tgtItem,
      flags: tgtFlags,
      rawFlags: tgtFlags,
      location: 4,
      container: 'cursor',
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
    }
    const curFlags =
      (Number(curItem.rawFlags ?? curItem.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const nextPlaced: ItemData = {
      ...curItem,
      flags: curFlags,
      rawFlags: curFlags,
      location: 0,
      container: dims.container,
      storePage,
      storagePage: storePage,
      gridX: x,
      gridY: y,
      x,
      y,
      ownerType: 0,
      ownerId: entry.playerUnitId,
    }

    entry.ownedItems[tgtIdx] = nextCursor
    entry.ownedItems[curIdx] = nextPlaced

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x05,
      itemId: nextCursor.id,
      code: nextCursor.code,
      x: 0,
      y: 0,
      container: 'cursor',
      ownerId: entry.playerUnitId,
      item: nextCursor,
    })
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'add',
      itemId: nextPlaced.id,
      code: nextPlaced.code,
      x,
      y,
      container: dims.container,
      ownerId: entry.playerUnitId,
      item: nextPlaced,
    })
  }

  private applyPotionEffect113c(entry: InternalClientEntry113c, codeLower: string): boolean {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return false
    const catalog = BELT_POTION_CATALOG[codeLower]
    if (catalog === undefined) return false

    const curHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_HITPOINTS, 0) | 0
    const maxHp = Math.max(256, STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXHP, 0) | 0)
    const curMana = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANA, 0) | 0
    const maxMana = Math.max(0, STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXMANA, 0) | 0)
    const maxStam = Math.max(0, STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, 0) | 0)

    if (catalog.kind === 'hp') {
      const nextHp = Math.min(maxHp, curHp + (catalog.healHp << 8))
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, nextHp, 0)
      this.sendPlayerStatUpdate(entry, STAT_HITPOINTS, nextHp)
      this.sendPlayerVitals95(entry)
      return true
    }
    if (catalog.kind === 'mana') {
      const nextMana = Math.min(maxMana, curMana + (catalog.healMana << 8))
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, nextMana, 0)
      this.sendPlayerStatUpdate(entry, STAT_MANA, nextMana)
      this.sendPlayerVitals95(entry)
      return true
    }
    if (catalog.kind === 'rejuv') {
      const pct = codeLower === 'rvl' ? 100 : 35
      const nextHp = Math.min(maxHp, curHp + Math.floor((maxHp * pct) / 100))
      const nextMana = Math.min(maxMana, curMana + Math.floor((maxMana * pct) / 100))
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, nextHp, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, nextMana, 0)
      this.sendPlayerStatUpdate(entry, STAT_HITPOINTS, nextHp)
      this.sendPlayerStatUpdate(entry, STAT_MANA, nextMana)
      this.sendPlayerVitals95(entry)
      return true
    }
    if (catalog.kind === 'stamina') {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, maxStam, 0)
      this.sendPlayerStatUpdate(entry, STAT_STAMINA, maxStam)
      this.setUnitStateAndSync(pPlayer, 15, true)
      this.sendPlayerVitals95(entry)
      return true
    }
    if (catalog.kind === 'antidote') {
      if (STATES_CheckState113c(m, pPlayer, 2) !== 0) {
        this.setUnitStateAndSync(pPlayer, 2, false)
      }
      this.setUnitStateAndSync(pPlayer, 178, true)
      this.sendPlayerVitals95(entry)
      return true
    }
    if (catalog.kind === 'thawing') {
      if (STATES_CheckState113c(m, pPlayer, 1) !== 0) {
        this.setUnitStateAndSync(pPlayer, 1, false)
      }
      if (STATES_CheckState113c(m, pPlayer, 11) !== 0) {
        this.setUnitStateAndSync(pPlayer, 11, false)
      }
      this.setUnitStateAndSync(pPlayer, 179, true)
      this.sendPlayerVitals95(entry)
      return true
    }
    return false
  }

  private openTownPortalForPlayer(entry: InternalClientEntry113c): boolean {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return false
    const inTown =
      TOWN_AREA_IDS_113C.has(this.areaId) ||
      DUNGEON_CheckRoomIsTown113c(m, this.defaultRoomPtr) !== 0
    if (inTown) {
      this.sendPlaySound(entry, SOUND_NOT_IN_TOWN_113C)
      return false
    }
    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const pos = this.findWalkableDropCoord(plrX + 2, plrY)
    const spawned = this.spawnObjectInRoom({
      classId: OBJECT_CLASS_PORTAL_113C,
      x: pos.x,
      y: pos.y,
      mode: 2,
    })
    const townAreaId = requireTownAreaForAct113c(this.actIdx)
    this.portalsByObjectId.set(spawned.unitId, { destAreaId: townAreaId })
    return true
  }

  private handleC2SUseInventoryItem(
    entry: InternalClientEntry113c,
    itemId: number,
    _x: number,
    _y: number,
  ): void {
    const idx = entry.ownedItems.findIndex(
      (i) => i.id === itemId && i.location === 0 && ((i.storePage ?? i.storagePage ?? 1) || 1) === 1,
    )
    if (idx === -1) return
    const item = entry.ownedItems[idx]!
    const codeLower = item.code.trim().toLowerCase()

    // Horadric Cube (`box`) -> emit `S2C 0x77` `UPDATEUI_OPENCUBE (0x15)`
    if (codeLower === 'box') {
      entry.cubeOpen = true
      entry.stashOpen = false
      this.queueServerEventToClient(entry, {
        type: 'Trade',
        action: BUTTON_OPEN_CUBE_113C,
      })
      return
    }

    // Identify Scroll (`isc`) or Tome of Identify (`ibk`) -> emit `S2C 0x3F` cursor identify mode
    if (codeLower === 'isc' || codeLower === 'ibk') {
      if (codeLower === 'ibk' && Math.max(0, Math.trunc(item.quantity ?? 0)) <= 0) {
        this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
        return
      }
      entry.pendingIdentifyScrollId = item.id
      this.queueServerEventToClient(entry, {
        type: 'ActiveSkill',
        unitId: 1,
        hand: 'right',
        skill: codeLower === 'ibk' ? 218 : 217,
        itemId: item.id,
        isUseStackableItem: true,
      } as ServerEvent)
      return
    }

    // Town Portal Scroll (`tsc`) or Tome of Town Portal (`tbk`)
    if (codeLower === 'tsc' || codeLower === 'tbk') {
      if (codeLower === 'tbk' && Math.max(0, Math.trunc(item.quantity ?? 0)) <= 0) {
        this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
        return
      }
      if (!this.openTownPortalForPlayer(entry)) return
      if (codeLower === 'tsc') {
        const delFlags =
          (Number(item.rawFlags ?? item.flags ?? ITEM_FLAG_IDENTIFIED_113C) |
            ITEM_FLAG_DELETED_113C) >>>
          0
        entry.ownedItems.splice(idx, 1)
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'remove',
          itemId: item.id,
          code: item.code,
          x: item.gridX ?? 0,
          y: item.gridY ?? 0,
          container: 'inventory',
          item: { ...item, flags: delFlags, rawFlags: delFlags },
        })
      } else {
        const nextQty = Math.max(0, Math.trunc(item.quantity ?? 1) - 1)
        const updated: ItemData = { ...item, quantity: nextQty }
        entry.ownedItems[idx] = updated
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'update',
          itemId: updated.id,
          code: updated.code,
          x: updated.gridX ?? 0,
          y: updated.gridY ?? 0,
          container: 'inventory',
          item: updated,
        })
      }
      return
    }

    // Potions (`hp1..5`, `mp1..5`, `rvs`, `rvl`, `vps`, `yps`, `wms`, classic potions)
    const catalog = BELT_POTION_CATALOG[codeLower]
    if (catalog !== undefined && catalog.kind !== 'scroll') {
      const delFlags =
        (Number(item.rawFlags ?? item.flags ?? ITEM_FLAG_IDENTIFIED_113C) |
          ITEM_FLAG_DELETED_113C) >>>
        0
      entry.ownedItems.splice(idx, 1)
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: item.id,
        code: item.code,
        x: item.gridX ?? 0,
        y: item.gridY ?? 0,
        container: 'inventory',
        item: { ...item, flags: delFlags, rawFlags: delFlags },
      })
      this.applyPotionEffect113c(entry, codeLower)
    }
  }

  private handleC2SStackItems(
    entry: InternalClientEntry113c,
    cursorItemId: number,
    targetItemId: number,
  ): void {
    const curIdx = entry.ownedItems.findIndex((i) => i.id === cursorItemId && i.location === 4)
    const tgtIdx = entry.ownedItems.findIndex((i) => i.id === targetItemId && i.location === 0)
    if (curIdx === -1 || tgtIdx === -1) return
    const cur = entry.ownedItems[curIdx]!
    const tgt = entry.ownedItems[tgtIdx]!
    const code = cur.code.trim().toLowerCase()
    if (code !== tgt.code.trim().toLowerCase()) return
    const maxStack =
      code === 'key'
        ? 12
        : code === 'aqv'
          ? 350
          : code === 'cqv'
            ? 250
            : code === 'tbk' || code === 'ibk'
              ? 20
              : 0
    if (maxStack <= 0) return
    const curQty = Math.max(1, Math.trunc(cur.quantity ?? 1))
    const tgtQty = Math.max(1, Math.trunc(tgt.quantity ?? 1))
    const add = Math.min(curQty, Math.max(0, maxStack - tgtQty))
    if (add <= 0) return

    const updatedTgt: ItemData = { ...tgt, quantity: tgtQty + add }
    entry.ownedItems[tgtIdx] = updatedTgt
    const tgtContainer =
      (updatedTgt.storePage ?? updatedTgt.storagePage) === 5
        ? 'stash'
        : (updatedTgt.storePage ?? updatedTgt.storagePage) === 4
          ? 'cube'
          : 'inventory'
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'update',
      itemId: updatedTgt.id,
      code: updatedTgt.code,
      x: updatedTgt.gridX ?? 0,
      y: updatedTgt.gridY ?? 0,
      container: tgtContainer,
      item: updatedTgt,
    })

    const rem = curQty - add
    if (rem <= 0) {
      const delFlags =
        (Number(cur.rawFlags ?? cur.flags ?? ITEM_FLAG_IDENTIFIED_113C) | ITEM_FLAG_DELETED_113C) >>>
        0
      entry.ownedItems.splice(curIdx, 1)
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'remove',
        itemId: cur.id,
        code: cur.code,
        container: 'cursor',
        item: { ...cur, flags: delFlags, rawFlags: delFlags },
      })
      this.queueServerEventToClient(entry, {
        type: 'CursorClear',
        unitType: 0,
        id: entry.playerUnitId,
      })
    } else {
      const updatedCur: ItemData = { ...cur, quantity: rem }
      entry.ownedItems[curIdx] = updatedCur
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'update',
        itemId: updatedCur.id,
        code: updatedCur.code,
        container: 'cursor',
        item: updatedCur,
      })
    }
  }

  private handleC2SUnstackItems(entry: InternalClientEntry113c, itemId: number): void {
    if (entry.ownedItems.some((i) => i.location === 4)) return
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 0)
    if (idx === -1) return
    const cur = entry.ownedItems[idx]!
    const qty = Math.max(1, Math.trunc(cur.quantity ?? 1))
    if (qty <= 1) return

    const updated: ItemData = { ...cur, quantity: qty - 1 }
    entry.ownedItems[idx] = updated
    const newId = this.allocUnitId()
    const splitItem: ItemData = {
      ...cur,
      id: newId,
      itemId: newId,
      quantity: 1,
      location: 4,
      container: 'cursor',
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
    }
    entry.ownedItems.push(splitItem)
    const container =
      (updated.storePage ?? updated.storagePage) === 5
        ? 'stash'
        : (updated.storePage ?? updated.storagePage) === 4
          ? 'cube'
          : 'inventory'
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'update',
      itemId: updated.id,
      code: updated.code,
      x: updated.gridX ?? 0,
      y: updated.gridY ?? 0,
      container,
      item: updated,
    })
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'pickup',
      itemId: splitItem.id,
      code: splitItem.code,
      container: 'cursor',
      item: splitItem,
    })
  }

  private handleC2SItemToBelt(
    entry: InternalClientEntry113c,
    itemId: number,
    rawSlot: number,
  ): void {
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId)
    if (idx === -1) return
    const item = entry.ownedItems[idx]!
    const codeLower = item.code.trim().toLowerCase()
    if (BELT_POTION_CATALOG[codeLower] === undefined) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const slot = Math.max(0, Math.min(15, Math.trunc(rawSlot)))
    const row = slot >> 2
    if (row >= this.getPlayerBeltMaxRows(entry)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const occupied = entry.ownedItems.some(
      (other) =>
        other.id !== item.id &&
        other.location === 2 &&
        ((other.gridX ?? other.x ?? 0) & 0x0f) === slot,
    )
    if (occupied) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    const cleanFlags =
      (Number(item.rawFlags ?? item.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const placed: ItemData = {
      ...item,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 2,
      container: 'belt',
      storePage: 0,
      storagePage: 0,
      gridX: slot,
      gridY: 0,
      x: slot,
      y: 0,
      bodyLoc: 0,
      equippedSlot: 0,
      equipped: false,
      ownerType: 0,
      ownerId: entry.playerUnitId,
    }
    entry.ownedItems[idx] = placed
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'beltPut',
      itemId: placed.id,
      code: placed.code,
      x: slot,
      y: 0,
      container: 'belt',
      ownerId: entry.playerUnitId,
      item: placed,
    })
  }

  private handleC2SQuickItemToBelt(entry: InternalClientEntry113c, itemId: number): void {
    const item = entry.ownedItems.find((i) => i.id === itemId && i.location === 0)
    if (item === undefined) return
    const slot = this.findAvailableBeltSlot(entry, item.code)
    if (slot === null) {
      this.sendPlaySound(entry, SOUND_CANT_CARRY_113C)
      return
    }
    this.handleC2SItemToBelt(entry, itemId, slot)
  }

  private handleC2SRemoveFromBelt(entry: InternalClientEntry113c, itemId: number): void {
    if (entry.ownedItems.some((i) => i.location === 4)) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 2)
    if (idx === -1) return
    const prev = entry.ownedItems[idx]!
    const linear = (prev.gridX ?? prev.x ?? 0) & 0x0f
    const col = linear & 3
    const row = linear >> 2
    const cleanFlags =
      (Number(prev.rawFlags ?? prev.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const onCursor: ItemData = {
      ...prev,
      flags: cleanFlags,
      rawFlags: cleanFlags,
      location: 4,
      container: 'cursor',
      storePage: 0,
      storagePage: 0,
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
    }
    entry.ownedItems[idx] = onCursor
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x0f,
      itemId: onCursor.id,
      code: onCursor.code,
      x: 0,
      y: 0,
      container: 'cursor',
      ownerId: entry.playerUnitId,
      item: onCursor,
    })
    this.shiftBeltColumnDown(entry, col, row)
  }

  private handleC2SSwapBeltItem(
    entry: InternalClientEntry113c,
    cursorItemId: number,
    beltItemId: number,
  ): void {
    const curIdx = entry.ownedItems.findIndex((i) => i.id === cursorItemId && i.location === 4)
    const beltIdx = entry.ownedItems.findIndex((i) => i.id === beltItemId && i.location === 2)
    if (curIdx === -1 || beltIdx === -1) return
    const cur = entry.ownedItems[curIdx]!
    const belt = entry.ownedItems[beltIdx]!
    if (BELT_POTION_CATALOG[cur.code.trim().toLowerCase()] === undefined) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const slot = (belt.gridX ?? belt.x ?? 0) & 0x0f
    const beltCleanFlags =
      (Number(belt.rawFlags ?? belt.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const curCleanFlags =
      (Number(cur.rawFlags ?? cur.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const nextCursor: ItemData = {
      ...belt,
      flags: beltCleanFlags,
      rawFlags: beltCleanFlags,
      location: 4,
      container: 'cursor',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
    }
    const nextBelt: ItemData = {
      ...cur,
      flags: curCleanFlags,
      rawFlags: curCleanFlags,
      location: 2,
      container: 'belt',
      gridX: slot,
      gridY: 0,
      x: slot,
      y: 0,
    }
    entry.ownedItems[beltIdx] = nextCursor
    entry.ownedItems[curIdx] = nextBelt

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x0f,
      itemId: nextCursor.id,
      code: nextCursor.code,
      container: 'cursor',
      item: nextCursor,
    })
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'beltPut',
      itemId: nextBelt.id,
      code: nextBelt.code,
      x: slot,
      y: 0,
      container: 'belt',
      item: nextBelt,
    })
  }

  private handleC2SUseBeltItem(
    entry: InternalClientEntry113c,
    itemId: number,
    _shiftUseOnMerc: boolean,
  ): void {
    const idx = entry.ownedItems.findIndex((i) => i.id === itemId && i.location === 2)
    if (idx === -1) return
    const item = entry.ownedItems[idx]!
    const codeLower = item.code.trim().toLowerCase()
    const linear = (item.gridX ?? item.x ?? 0) & 0x0f
    const col = linear & 3
    const row = linear >> 2

    if (codeLower === 'isc') {
      entry.pendingIdentifyScrollId = item.id
      this.queueServerEventToClient(entry, {
        type: 'ActiveSkill',
        unitId: 1,
        hand: 'right',
        skill: 217,
        itemId: item.id,
        isUseStackableItem: true,
      } as ServerEvent)
      return
    }
    if (codeLower === 'tsc') {
      if (!this.openTownPortalForPlayer(entry)) return
    }

    const delFlags =
      (Number(item.rawFlags ?? item.flags ?? ITEM_FLAG_IDENTIFIED_113C) | ITEM_FLAG_DELETED_113C) >>>
      0
    entry.ownedItems.splice(idx, 1)
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x0f,
      itemId: item.id,
      code: item.code,
      x: linear,
      y: 0,
      container: 'belt',
      ownerId: entry.playerUnitId,
      item: { ...item, location: 2, container: 'belt', flags: delFlags, rawFlags: delFlags },
    })
    this.shiftBeltColumnDown(entry, col, row)

    if (codeLower !== 'tsc') {
      this.applyPotionEffect113c(entry, codeLower)
    }
  }

  private handleC2SIdentifyItem(
    entry: InternalClientEntry113c,
    targetItemId: number,
    scrollItemId: number,
  ): void {
    const scrollIdx = entry.ownedItems.findIndex((i) => i.id === scrollItemId)
    const targetIdx = entry.ownedItems.findIndex((i) => i.id === targetItemId)
    if (scrollIdx === -1 || targetIdx === -1) return
    const scroll = entry.ownedItems[scrollIdx]!
    const target = entry.ownedItems[targetIdx]!
    const sCode = scroll.code.trim().toLowerCase()
    if (sCode !== 'isc' && sCode !== 'ibk') return
    if (target.identified) return

    if (sCode === 'ibk') {
      const qty = Math.max(0, Math.trunc(scroll.quantity ?? 0))
      if (qty <= 0) return
      const updatedBook: ItemData = { ...scroll, quantity: qty - 1 }
      entry.ownedItems[scrollIdx] = updatedBook
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'update',
        itemId: updatedBook.id,
        code: updatedBook.code,
        x: updatedBook.gridX ?? 0,
        y: updatedBook.gridY ?? 0,
        container: 'inventory',
        item: updatedBook,
      })
    } else {
      const wasBelt = scroll.location === 2
      const linear = (scroll.gridX ?? scroll.x ?? 0) & 0x0f
      const delFlags =
        (Number(scroll.rawFlags ?? scroll.flags ?? ITEM_FLAG_IDENTIFIED_113C) |
          ITEM_FLAG_DELETED_113C) >>>
        0
      entry.ownedItems.splice(scrollIdx, 1)
      if (wasBelt) {
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 0x0f,
          itemId: scroll.id,
          code: scroll.code,
          x: linear,
          y: 0,
          container: 'belt',
          item: { ...scroll, flags: delFlags, rawFlags: delFlags },
        })
        this.shiftBeltColumnDown(entry, linear & 3, linear >> 2)
      } else {
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'remove',
          itemId: scroll.id,
          code: scroll.code,
          x: scroll.gridX ?? 0,
          y: scroll.gridY ?? 0,
          container: 'inventory',
          item: { ...scroll, flags: delFlags, rawFlags: delFlags },
        })
      }
    }

    const realTargetIdx = entry.ownedItems.findIndex((i) => i.id === targetItemId)
    if (realTargetIdx === -1) return
    const curTarget = entry.ownedItems[realTargetIdx]!
    const idFlags =
      (Number(curTarget.rawFlags ?? curTarget.flags ?? 0) | ITEM_FLAG_IDENTIFIED_113C) >>> 0
    const identified: ItemData = {
      ...curTarget,
      identified: true,
      flags: idFlags,
      rawFlags: idFlags,
    }
    entry.ownedItems[realTargetIdx] = identified
    entry.pendingIdentifyScrollId = 0
    const container =
      identified.location === 1
        ? 'equipment'
        : (identified.storePage ?? identified.storagePage) === 5
          ? 'stash'
          : (identified.storePage ?? identified.storagePage) === 4
            ? 'cube'
            : 'inventory'
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'identify',
      itemId: identified.id,
      code: identified.code,
      x: identified.gridX ?? 0,
      y: identified.gridY ?? 0,
      container,
      ownerId: entry.playerUnitId,
      item: identified,
    })
  }

  private handleC2SSocketItem(
    entry: InternalClientEntry113c,
    fillerId: number,
    hostId: number,
  ): void {
    const fillerIdx = entry.ownedItems.findIndex((i) => i.id === fillerId && i.location === 4)
    const hostIdx = entry.ownedItems.findIndex(
      (i) => i.id === hostId && (i.location === 0 || i.location === 1),
    )
    if (fillerIdx === -1 || hostIdx === -1) return
    const filler = entry.ownedItems[fillerIdx]!
    const host = entry.ownedItems[hostIdx]!
    const existingChildren = this.getOwnedSocketChildren(entry, host.id)
    const pPlayer = entry.pPlayer >>> 0
    const clvl = Math.max(1, STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_LEVEL, 0) | 0)

    const result = executeSocketItem113c({
      host: { ...host, socketedItems: existingChildren },
      filler,
      rng: this.rng,
      playerLevel: clvl,
      isHostEquipped: host.location === 1,
      isLadder: true,
      tables: getEmbeddedDropTables(),
    })
    if (!result.ok) {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }

    entry.ownedItems.splice(fillerIdx, 1)
    const newHostIdx = entry.ownedItems.findIndex((i) => i.id === hostId)
    if (newHostIdx === -1) return
    entry.ownedItems[newHostIdx] = result.hostItem
    entry.ownedItems.splice(newHostIdx + 1, 0, result.socketChild)
    if (result.hostItem.location === 1) {
      this.recomputeEquippedItemSkillBonuses(entry)
    }

    const hostContainer =
      result.hostItem.location === 1
        ? 'equipment'
        : (result.hostItem.storePage ?? result.hostItem.storagePage) === 5
          ? 'stash'
          : (result.hostItem.storePage ?? result.hostItem.storagePage) === 4
            ? 'cube'
            : 'inventory'
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 0x0a,
      itemId: result.socketChild.id,
      code: result.socketChild.code,
      container: 'socket',
      ownerId: result.hostItem.id,
      item: result.socketChild,
    })
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'update',
      itemId: result.hostItem.id,
      code: result.hostItem.code,
      x: result.hostItem.gridX ?? 0,
      y: result.hostItem.gridY ?? 0,
      container: hostContainer,
      ownerId: entry.playerUnitId,
      item: result.hostItem,
    })
  }

  private handleC2SScrollToBook(
    entry: InternalClientEntry113c,
    scrollId: number,
    bookId: number,
  ): void {
    const scrollIdx = entry.ownedItems.findIndex((i) => i.id === scrollId)
    const bookIdx = entry.ownedItems.findIndex((i) => i.id === bookId)
    if (scrollIdx === -1 || bookIdx === -1) return
    const scroll = entry.ownedItems[scrollIdx]!
    const book = entry.ownedItems[bookIdx]!
    const sCode = scroll.code.trim().toLowerCase()
    const bCode = book.code.trim().toLowerCase()
    const compatible = (sCode === 'tsc' && bCode === 'tbk') || (sCode === 'isc' && bCode === 'ibk')
    if (!compatible) return
    const curQty = Math.max(0, Math.trunc(book.quantity ?? 0))
    if (curQty >= 20) return

    const updatedBook: ItemData = { ...book, quantity: curQty + 1 }
    entry.ownedItems[bookIdx] = updatedBook
    const delFlags =
      (Number(scroll.rawFlags ?? scroll.flags ?? ITEM_FLAG_IDENTIFIED_113C) |
        ITEM_FLAG_DELETED_113C) >>>
      0
    entry.ownedItems.splice(scrollIdx, 1)

    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'remove',
      itemId: scroll.id,
      code: scroll.code,
      container: scroll.location === 4 ? 'cursor' : 'inventory',
      item: { ...scroll, flags: delFlags, rawFlags: delFlags },
    })
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'update',
      itemId: updatedBook.id,
      code: updatedBook.code,
      x: updatedBook.gridX ?? 0,
      y: updatedBook.gridY ?? 0,
      container: 'inventory',
      item: updatedBook,
    })
  }

  private handleC2SItemToCube(entry: InternalClientEntry113c, itemId: number): void {
    const cur = entry.ownedItems.find((i) => i.id === itemId && i.location === 4)
    if (cur === undefined) return
    if (cur.code.trim().toLowerCase() === 'box') {
      this.sendPlaySound(entry, SOUND_IMPOSSIBLE_113C)
      return
    }
    const sz = this.getItemGridSize(cur)
    const slot = this.findFreeContainerSlot(entry, 4, sz.width, sz.height)
    if (slot === null) {
      this.sendPlaySound(entry, SOUND_CANT_CARRY_113C)
      return
    }
    this.handleC2SItemToBuffer(entry, itemId, slot.x, slot.y, 3)
  }

  private handleC2SDropGold(entry: InternalClientEntry113c, rawAmount: number): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const amount = Math.floor(rawAmount) >>> 0
    const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    if (amount === 0 || amount > curGold) return

    const nextGold = (curGold - amount) >>> 0
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
    this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)

    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const dropPos = this.findWalkableDropCoord(plrX, plrY)
    this.spawnGroundItemInRoom(
      {
        code: 'gld',
        goldAmount: amount,
        quantity: amount,
        compact: true,
        simple: true,
        identified: true,
        quality: 2,
      },
      dropPos.x,
      dropPos.y,
      'drop',
    )
  }

  private handleC2SSwapWeapons(entry: InternalClientEntry113c): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || entry.pClient === 0) return

    const movedItems: ItemData[] = []
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const item = entry.ownedItems[i]!
      if (item.location !== 1) continue
      const slot = item.bodyLoc ?? item.equippedSlot ?? 0
      let nextSlot = 0
      if (slot === 4) nextSlot = 11
      else if (slot === 11) nextSlot = 4
      else if (slot === 5) nextSlot = 12
      else if (slot === 12) nextSlot = 5
      if (nextSlot === 0) continue

      const moved: ItemData = {
        ...item,
        bodyLoc: nextSlot,
        equippedSlot: nextSlot,
      }
      entry.ownedItems[i] = moved
      movedItems.push(moved)
    }

    entry.weaponSet = entry.weaponSet === 1 ? 0 : 1

    // Swap live active left/right hand skills with alternate set
    const pSkills = m.get(pPlayer, D2UnitStrc.pSkills) >>> 0
    let prevLeft = 0
    let prevRight = 0
    if (pSkills !== 0) {
      const pLeft = SKILLS_GetLeftSkillFromSkillList113c(m, pSkills) >>> 0
      if (pLeft !== 0) prevLeft = SKILLS_GetSkillIdFromSkill113c(m, pLeft, 0, 0) | 0
      const pRight = m.get(pSkills, D2SkillListStrc.pRightSkill) >>> 0
      if (pRight !== 0) prevRight = SKILLS_GetSkillIdFromSkill113c(m, pRight, 0, 0) | 0
    }
    const nextLeft = entry.altLeftSkill
    const nextRight = entry.altRightSkill
    entry.altLeftSkill = prevLeft
    entry.altRightSkill = prevRight

    this.recomputeEquippedItemSkillBonuses(entry)

    const resolveHandSkill = (skId: number): number => {
      if (skId <= 0 || skId >= SKILLS_TXT_COUNT_113C) return 0
      const pSk = SKILLS_GetSkillById113c(m, pPlayer, skId, -1) >>> 0
      if (pSk === 0) return 0
      return SKILLS_GetSkillLevel113c(m, pPlayer, pSk, 1) > 0 ? skId : 0
    }
    const finalLeft = resolveHandSkill(nextLeft)
    const finalRight = resolveHandSkill(nextRight)
    SKILLS_SetLeftSkill113c(m, pPlayer, finalLeft, -1)
    SKILLS_SetRightSkill113c(m, pPlayer, finalRight, -1)
    PLAYER_StoreLeftSkill113c(m, pPlayer)
    PLAYER_StoreRightSkill113c(m, pPlayer)

    for (let i = 0; i < movedItems.length; i++) {
      const moved = movedItems[i]!
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 0x17,
        itemId: moved.id,
        code: moved.code,
        bodyLoc: moved.bodyLoc,
        container: 'equipment',
        ownerId: entry.playerUnitId,
        item: moved,
      })
    }

    this.queueServerEventToClient(entry, { type: 'WeaponSwitch' })

    if (finalLeft !== prevLeft) {
      NET_SendPacket0x23_AssignSkill113c(
        m,
        UNIT_PLAYER,
        entry.playerUnitId,
        entry.pClient,
        1,
        finalLeft,
        -1,
        {
          queuePacket: (mem, cli, pktPtr, pktSize) => {
            NET_QueuePacketToClientBuffer113c(mem, cli, 1, pktPtr, pktSize)
          },
        },
      )
    }
    if (finalRight !== prevRight) {
      NET_SendPacket0x23_AssignSkill113c(
        m,
        UNIT_PLAYER,
        entry.playerUnitId,
        entry.pClient,
        0,
        finalRight,
        -1,
        {
          queuePacket: (mem, cli, pktPtr, pktSize) => {
            NET_QueuePacketToClientBuffer113c(mem, cli, 1, pktPtr, pktSize)
          },
        },
      )
    }
    this.sendPlayerVitals95(entry)
  }

  // ============================================================================
  // Wave 3 Part 3: Vendor, Repair, IdentifyAll, QuestMessage, Stash & ClickButton
  // ============================================================================

  private executeStashOpen(entry: InternalClientEntry113c): void {
    this.stopPlayerMovementInPlace(entry)
    entry.stashOpen = true
    entry.cubeOpen = false
    entry.activeNpcUnitId = 0
    entry.activeVendorNpcId = 0
    entry.activeVendorMode = null
    this.queueServerEventToClient(entry, {
      type: 'Trade',
      action: BUTTON_OPEN_STASH_113C,
    })
  }

  private executePortalInteract(entry: InternalClientEntry113c, portalObjId: number): void {
    const rec = this.portalsByObjectId.get(portalObjId)
    if (rec === undefined) return
    this.stopPlayerMovementInPlace(entry)
    this.warpClientToArea(entry, rec.destAreaId)
  }

  private buildTransactionCostContext(
    entry: InternalClientEntry113c,
    npcClassId: number,
  ): TransactionCostContext {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
    const reducedPricesPct = Math.min(
      99,
      Math.max(
        0,
        (STATLIST_GetUnitStat113c(m, pPlayer, STAT_ITEM_REDUCEDPRICES, 0) | 0) +
          this.getEffectiveEquippedStatSum(entry, STAT_ITEM_REDUCEDPRICES),
      ),
    )
    const pQuestRec = this.getPlayerQuestRecordPtr(entry.clientId, this.difficultyValue)
    return {
      playerLevel: clvl,
      playerReducedPricesPct: reducedPricesPct,
      difficulty: this.difficultyValue,
      npcClass: npcClassId,
      isQuestFlagSet: (questId: number, state: 0 | 1): boolean => {
        if (pQuestRec === 0) return false
        const pBuf = m.u32(pQuestRec) >>> 0
        if (pBuf === 0) return false
        const bitIdx = ((questId << 4) + state) | 0
        if (bitIdx < 0 || (bitIdx >> 3) >= 96) return false
        return ((m.u8((pBuf + (bitIdx >> 3)) >>> 0) >>> (bitIdx & 7)) & 1) !== 0
      },
      tables: getCanonicalTransactionCostTables(),
    }
  }

  private itemDataToTransactionCostInput(
    entry: InternalClientEntry113c,
    item: ItemData,
  ): TransactionCostInput {
    const acc = new Map<string, { statId: number; param: number; value: number; base: number }>()
    const add = (statId: number, param: number, value: number, isBase: boolean): void => {
      const k = `${statId}:${param}`
      const cur = acc.get(k) ?? { statId, param, value: 0, base: 0 }
      cur.value += value
      if (isBase) cur.base += value
      acc.set(k, cur)
    }
    const maxDur = item.maxDurability
    const curDur = item.curDurability ?? item.durability
    const qty = item.quantity
    if (item.defense !== undefined) add(31, 0, item.defense, true)
    if (maxDur !== undefined) add(73, 0, maxDur, true)
    if (curDur !== undefined) add(72, 0, curDur, true)
    if (qty !== undefined) add(70, 0, qty, true)
    for (const s of item.stats ?? []) {
      if (s.statId === 72 && curDur !== undefined) continue
      if (s.statId === 73 && maxDur !== undefined) continue
      if (s.statId === 70 && qty !== undefined) continue
      add(s.statId, s.param ?? 0, s.value, false)
    }
    for (const s of item.runewordStats ?? []) {
      add(s.statId, s.param ?? 0, s.value, false)
    }

    const code = item.code.trim()
    const codeLower = code.toLowerCase()
    let bookId = item.tomeData
    if (bookId === undefined && codeLower === 'tbk') bookId = 0
    if (bookId === undefined && codeLower === 'ibk') bookId = 1

    const rawQuality = typeof item.quality === 'number' ? item.quality : 2
    const quality = Math.max(1, Math.min(9, Math.trunc(rawQuality))) as ItemQuality113c
    const ra = item.rareAffixes
    const rarePrefixIds: readonly [number, number, number] =
      ra !== undefined && ra.length >= 6 ? [ra[0] ?? 0, ra[2] ?? 0, ra[4] ?? 0] : [0, 0, 0]
    const rareSuffixIds: readonly [number, number, number] =
      ra !== undefined && ra.length >= 6 ? [ra[1] ?? 0, ra[3] ?? 0, ra[5] ?? 0] : [0, 0, 0]
    const children = this.getOwnedSocketChildren(entry, item.id)

    const stats: TransactionCostStat[] = [...acc.values()]
    return {
      code,
      itemFormat: item.version ?? 101,
      quality,
      identified: item.identified !== false || quality < 4,
      ethereal: Boolean(item.ethereal),
      starterItem: Boolean(item.starterItem),
      isEar: Boolean(item.isEar),
      earLevel: item.earLevel ?? 0,
      bodyPartMonsterClass: item.bodyPartMonsterClass ?? 0,
      ...(bookId !== undefined ? { bookId } : {}),
      magicPrefixId: item.magicPrefixId ?? 0,
      magicSuffixId: item.magicSuffixId ?? 0,
      ...(item.autoAffixId !== undefined ? { autoAffixId: item.autoAffixId } : {}),
      uniqueItemId: item.uniqueItemId ?? -1,
      setItemId: item.setItemId ?? -1,
      rarePrefixIds,
      rareSuffixIds,
      stats,
      socketedChildCodes: children.map((c) => c.code.trim()).filter((c) => c.length > 0),
    }
  }

  private spendPlayerGold(entry: InternalClientEntry113c, cost: number): boolean {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || cost < 0) return false
    const amt = Math.trunc(cost)
    if (amt === 0) return true
    const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    const curBank = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0) >>> 0
    if (curGold + curBank < amt) return false

    const fromInv = Math.min(curGold, amt)
    const fromBank = amt - fromInv
    const nextGold = (curGold - fromInv) >>> 0
    const nextBank = (curBank - fromBank) >>> 0

    if (fromInv > 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)
    }
    if (fromBank > 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLDBANK, nextBank | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLDBANK, nextBank)
    }
    return true
  }

  private addPlayerGold(entry: InternalClientEntry113c, amount: number): boolean {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0 || amount < 0) return false
    const amt = Math.trunc(amount)
    if (amt === 0) return true
    const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
    const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    const curBank = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0) >>> 0
    const invRoom = Math.max(0, getInventoryGoldLimit(clvl) - curGold)
    const bankRoom = Math.max(0, getStashGoldLimit(clvl) - curBank)
    if (amt > invRoom + bankRoom) return false

    const toInv = Math.min(amt, invRoom)
    const toBank = amt - toInv
    if (toInv > 0) {
      const nextGold = (curGold + toInv) >>> 0
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)
    }
    if (toBank > 0) {
      const nextBank = (curBank + toBank) >>> 0
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLDBANK, nextBank | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLDBANK, nextBank)
    }
    return true
  }

  private getOrCreateVendorPool(
    entry: InternalClientEntry113c,
    npcUnitId: number,
    npcClassId: number,
    gamble: boolean,
  ): VendorPoolEntry113c[] {
    const desc = getTownNpcDescriptorByHcIdx(npcClassId)
    if (desc === undefined || desc.vendorId === null) return []
    if (gamble ? !desc.canGamble : !desc.canTrade) return []

    const poolKey = `${this.areaId}:${npcUnitId}:${gamble ? 'gamble' : 'trade'}`
    if (!gamble) {
      const existing = this.vendorStockByKey.get(poolKey)
      if (existing !== undefined && existing.length > 0) return existing
    }

    const tables = getEmbeddedDropTables()
    const pPlayer = entry.pPlayer >>> 0
    const clvl = Math.max(1, STATLIST_GetUnitStat113c(this.m, pPlayer, STAT_LEVEL, 0) | 0)
    const poolRng = new D2Rng(this.rng.rand(0x7fffffff) || 1)
    const pool: VendorPoolEntry113c[] = []

    if (gamble) {
      const grid = generateGambleInventory({
        vendorId: desc.vendorId,
        cLvl: clvl,
        isExpansion: true,
        tables,
        rng: poolRng,
      })
      for (const placed of grid.items) {
        const unitId = this.allocUnitId()
        const itemData = domainItemToItemData113c(placed.item, tables, {
          unitId,
          compactSave: false,
        })
        const shopItem: ItemData = {
          ...itemData,
          location: 0,
          container: 'shop',
          storePage: 1,
          storagePage: 1,
          gridX: placed.x,
          gridY: placed.y,
          x: placed.x,
          y: placed.y,
          ownerType: 1,
          ownerId: npcUnitId,
        }
        pool.push({ item: shopItem, permStore: false, gamble: true, sourceItem: placed.item })
      }
      this.vendorStockByKey.set(poolKey, pool)
      return pool
    }

    const store = generateVendorStoreInventory({
      vendorId: desc.vendorId,
      difficulty: this.difficultyValue,
      cLvl: clvl,
      actIndex: desc.actIndex,
      isExpansion: true,
      tables,
      rng: poolRng,
    })
    for (let tabIdx = 0; tabIdx < VENDOR_TAB_KEYS.length; tabIdx++) {
      const tabKey = VENDOR_TAB_KEYS[tabIdx]!
      const storePage = tabIdx + 1
      for (const placed of store.tabs[tabKey].items) {
        const finalized = finalizeDroppedItem113c(placed.item)
        const code = (finalized.code ?? finalized.base.id).trim()
        const baseMeta = this.tables.getItemBaseMeta(code)
        const unitId = this.allocUnitId()
        const itemData = domainItemToItemData113c(finalized, tables, {
          unitId,
          compactSave:
            Boolean(baseMeta?.compactSave) &&
            finalized.base.kind === 'misc' &&
            code !== 'tbk' &&
            code !== 'ibk',
        })
        const shopItem: ItemData = {
          ...itemData,
          identified: true,
          flags: ((itemData.rawFlags ?? itemData.flags ?? 0) | ITEM_FLAG_IDENTIFIED_113C) >>> 0,
          rawFlags: ((itemData.rawFlags ?? itemData.flags ?? 0) | ITEM_FLAG_IDENTIFIED_113C) >>> 0,
          location: 0,
          container: 'shop',
          storePage,
          storagePage: storePage,
          gridX: placed.x,
          gridY: placed.y,
          x: placed.x,
          y: placed.y,
          ownerType: 1,
          ownerId: npcUnitId,
        }
        pool.push({
          item: shopItem,
          permStore: Boolean(finalized.base.permStoreItem),
          gamble: false,
          sourceItem: finalized,
        })
      }
    }
    this.vendorStockByKey.set(poolKey, pool)
    return pool
  }

  private handleC2SQuestMessage(
    entry: InternalClientEntry113c,
    npcId: number,
    messageId: number,
  ): void {
    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    this.queueServerEventToClient(entry, {
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId,
      count: 1,
      messages: [{ menu: 0, stringId: messageId & 0xffff }],
    })
  }

  private handleC2SEntityAction(
    entry: InternalClientEntry113c,
    action: number,
    npcId: number,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    const npcClassId = m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const npcX = UNITS_GetX113c(m, pNpc) & 0xffff
    const npcY = UNITS_GetY113c(m, pNpc) & 0xffff
    if (Math.hypot(plrX - npcX, plrY - npcY) > NPC_TETHER_RANGE_SUBTILES_113C) return

    if (action !== 1 && action !== 2) return
    const gamble = action === 2
    const desc = getTownNpcDescriptorByHcIdx(npcClassId)
    if (desc === undefined || desc.vendorId === null) return
    if (gamble ? !desc.canGamble : !desc.canTrade) return

    this.stopPlayerMovementInPlace(entry)
    entry.activeNpcUnitId = npcId
    entry.activeVendorNpcId = npcId
    entry.activeVendorMode = gamble ? 'gamble' : 'trade'

    const pool = this.getOrCreateVendorPool(entry, npcId, npcClassId, gamble)
    for (let i = 0; i < pool.length; i++) {
      const vEntry = pool[i]!
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'vendorPool',
        itemId: vEntry.item.id,
        code: vEntry.item.code,
        x: vEntry.item.gridX ?? 0,
        y: vEntry.item.gridY ?? 0,
        container: 'shop',
        ownerId: npcId,
        item: vEntry.item,
      })
    }

    this.queueServerEventToClient(entry, {
      type: 'Npc',
      kind: 'info',
      unitType: 1,
      npcId,
      count: 0,
      messages: [],
    })
  }

  private handleC2SBuyItem(
    entry: InternalClientEntry113c,
    npcId: number,
    itemId: number,
    isGamble: boolean,
    _shiftFill: boolean,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    if (entry.activeVendorNpcId !== npcId || entry.activeVendorMode === null) return
    if ((entry.activeVendorMode === 'gamble') !== isGamble) return

    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    const npcClassId = m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const npcX = UNITS_GetX113c(m, pNpc) & 0xffff
    const npcY = UNITS_GetY113c(m, pNpc) & 0xffff
    if (Math.hypot(plrX - npcX, plrY - npcY) > NPC_TETHER_RANGE_SUBTILES_113C) return

    const poolKey = `${this.areaId}:${npcId}:${isGamble ? 'gamble' : 'trade'}`
    const pool = this.vendorStockByKey.get(poolKey)
    if (pool === undefined) return
    const poolIdx = pool.findIndex((e) => e.item.id === itemId)
    if (poolIdx === -1) return
    const vEntry = pool[poolIdx]!

    const txCtx = this.buildTransactionCostContext(entry, npcClassId)
    const cost = computeTransactionCost113c(
      this.itemDataToTransactionCostInput(entry, vEntry.item),
      txCtx,
      isGamble ? 2 : 0,
    )

    const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    const curBank = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0) >>> 0
    if (curGold + curBank < cost) {
      this.queueServerEventToClient(entry, {
        type: 'NpcTransaction',
        flag: 0,
        result: 0x0c,
        itemId,
        gold: curGold,
      })
      return
    }

    const tables = getEmbeddedDropTables()
    let deliveredBaseItem: ItemData
    if (isGamble && vEntry.sourceItem !== undefined) {
      const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
      const revealed = finalizeDroppedItem113c(
        resolveGambledItem({
          mysteryItem: vEntry.sourceItem,
          cLvl: clvl,
          isExpansion: true,
          tables,
          rng: this.rng,
          spawnedUniqueIds: this.spawnedUniqueIds,
        }),
      )
      const rCode = (revealed.code ?? revealed.base.id).trim()
      const baseMeta = this.tables.getItemBaseMeta(rCode)
      deliveredBaseItem = domainItemToItemData113c(revealed, tables, {
        unitId: this.allocUnitId(),
        compactSave: Boolean(baseMeta?.compactSave) && revealed.base.kind === 'misc',
      })
    } else {
      const newUnitId = vEntry.permStore ? this.allocUnitId() : vEntry.item.id
      deliveredBaseItem = {
        ...vEntry.item,
        id: newUnitId,
        itemId: newUnitId,
      }
    }

    const codeLower = deliveredBaseItem.code.trim().toLowerCase()
    const beltSlot =
      BELT_POTION_CATALOG[codeLower] !== undefined
        ? this.findAvailableBeltSlot(entry, codeLower)
        : null
    const sz = this.getItemGridSize(deliveredBaseItem)
    const invSlot =
      beltSlot === null ? this.findFreeContainerSlot(entry, 1, sz.width, sz.height) : null

    if (beltSlot === null && invSlot === null) {
      this.queueServerEventToClient(entry, {
        type: 'NpcTransaction',
        flag: 0,
        result: 0x01,
        itemId,
        gold: curGold,
      })
      return
    }

    if (!this.spendPlayerGold(entry, cost)) return

    if (!vEntry.permStore || isGamble) {
      pool.splice(poolIdx, 1)
      this.queueServerEventToClient(entry, {
        type: 'UnitRemove',
        unitType: UNIT_ITEM_113C,
        id: itemId,
        unitId: itemId,
      })
    }

    const cleanFlags =
      ((Number(deliveredBaseItem.rawFlags ?? deliveredBaseItem.flags ?? 0) |
        ITEM_FLAG_IDENTIFIED_113C) &
        ~ITEM_FLAG_DELETED_113C) >>>
      0
    const purchased: ItemData =
      beltSlot !== null
        ? {
            ...deliveredBaseItem,
            identified: true,
            flags: cleanFlags,
            rawFlags: cleanFlags,
            location: 2,
            container: 'belt',
            storePage: 0,
            storagePage: 0,
            gridX: beltSlot,
            gridY: 0,
            x: beltSlot,
            y: 0,
            bodyLoc: 0,
            equippedSlot: 0,
            equipped: false,
            ownerType: 0,
            ownerId: entry.playerUnitId,
          }
        : {
            ...deliveredBaseItem,
            identified: true,
            flags: cleanFlags,
            rawFlags: cleanFlags,
            location: 0,
            container: 'inventory',
            storePage: 1,
            storagePage: 1,
            gridX: invSlot!.x,
            gridY: invSlot!.y,
            x: invSlot!.x,
            y: invSlot!.y,
            bodyLoc: 0,
            equippedSlot: 0,
            equipped: false,
            ownerType: 0,
            ownerId: entry.playerUnitId,
          }

    entry.ownedItems.push(purchased)
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: beltSlot !== null ? 'beltPut' : 'add',
      itemId: purchased.id,
      code: purchased.code,
      x: purchased.gridX ?? 0,
      y: purchased.gridY ?? 0,
      container: beltSlot !== null ? 'belt' : 'inventory',
      ownerId: entry.playerUnitId,
      item: purchased,
    })

    const nextGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    this.queueServerEventToClient(entry, {
      type: 'NpcTransaction',
      flag: 0,
      result: 0,
      itemId: purchased.id,
      gold: nextGold,
    })
  }

  private handleC2SSellItem(
    entry: InternalClientEntry113c,
    npcId: number,
    itemId: number,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    if (entry.activeVendorNpcId !== npcId || entry.activeVendorMode !== 'trade') return

    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    const npcClassId = m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const npcX = UNITS_GetX113c(m, pNpc) & 0xffff
    const npcY = UNITS_GetY113c(m, pNpc) & 0xffff
    if (Math.hypot(plrX - npcX, plrY - npcY) > NPC_TETHER_RANGE_SUBTILES_113C) return

    const sold = entry.ownedItems.find(
      (i) =>
        i.id === itemId &&
        (i.location === 4 ||
          (i.location === 0 && ((i.storePage ?? i.storagePage ?? 1) || 1) === 1)),
    )
    if (sold === undefined) return

    const tables = getEmbeddedDropTables()
    const base = tables.getBase(sold.code.trim())
    const codeLower = sold.code.trim().toLowerCase()
    const rawFlags = Number(sold.rawFlags ?? sold.flags ?? 0)
    const isUnsellable =
      (base?.quest ?? 0) > 0 ||
      base?.type?.trim().toLowerCase() === 'ques' ||
      codeLower === 'box' ||
      codeLower === 'play' ||
      Boolean(sold.isEar) ||
      (rawFlags & ITEM_FLAG_EAR_113C) !== 0
    const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    if (isUnsellable) {
      this.queueServerEventToClient(entry, {
        type: 'NpcTransaction',
        flag: 0,
        result: 0x09,
        itemId,
        gold: curGold,
      })
      return
    }

    const txCtx = this.buildTransactionCostContext(entry, npcClassId)
    const sellValue = computeTransactionCost113c(
      this.itemDataToTransactionCostInput(entry, sold),
      txCtx,
      1,
    )

    if (!this.addPlayerGold(entry, sellValue)) {
      this.queueServerEventToClient(entry, {
        type: 'NpcTransaction',
        flag: 0,
        result: 0x0c,
        itemId,
        gold: curGold,
      })
      return
    }

    this.removeOwnedItemAndChildren(entry, itemId)
    const delFlags = (rawFlags | ITEM_FLAG_DELETED_113C) >>> 0
    this.queueServerEventToClient(entry, {
      type: 'ItemEvent',
      action: 'sell',
      itemId: sold.id,
      code: sold.code,
      x: sold.gridX ?? 0,
      y: sold.gridY ?? 0,
      container: sold.location === 4 ? 'cursor' : 'inventory',
      item: { ...sold, flags: delFlags, rawFlags: delFlags },
    })

    const nextGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
    this.queueServerEventToClient(entry, {
      type: 'NpcTransaction',
      flag: 3,
      result: 1,
      itemId: sold.id,
      gold: nextGold,
    })
  }

  private handleC2SCainIdentifyAll(entry: InternalClientEntry113c, npcId: number): void {
    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    const npcClassId = this.m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
    const desc = getTownNpcDescriptorByHcIdx(npcClassId)
    if (desc === undefined || !desc.canIdentify) return

    const targets: number[] = []
    for (let i = 0; i < entry.ownedItems.length; i++) {
      const it = entry.ownedItems[i]!
      if (
        !it.identified &&
        (it.location === 1 ||
          (it.location === 0 && ((it.storePage ?? it.storagePage ?? 1) || 1) === 1))
      ) {
        targets.push(i)
      }
    }
    if (targets.length === 0) return

    const freeIdentify = npcClassId === 146
    if (!freeIdentify) {
      if (!this.spendPlayerGold(entry, targets.length * 100)) return
    }

    for (let k = 0; k < targets.length; k++) {
      const idx = targets[k]!
      const prev = entry.ownedItems[idx]!
      const idFlags =
        (Number(prev.rawFlags ?? prev.flags ?? 0) | ITEM_FLAG_IDENTIFIED_113C) >>> 0
      const updated: ItemData = {
        ...prev,
        identified: true,
        flags: idFlags,
        rawFlags: idFlags,
      }
      entry.ownedItems[idx] = updated
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'identify',
        itemId: updated.id,
        code: updated.code,
        x: updated.gridX ?? 0,
        y: updated.gridY ?? 0,
        container: updated.location === 1 ? 'equipment' : 'inventory',
        ownerId: entry.playerUnitId,
        item: updated,
      })
    }
  }

  private doesItemNeedRepair113c(item: ItemData): boolean {
    if (item.ethereal || ((Number(item.rawFlags ?? item.flags ?? 0) & ITEM_FLAG_ETHEREAL_113C) !== 0)) {
      return false
    }
    const maxDur = item.maxDurability ?? 0
    if (maxDur <= 0) return false
    const curDur = item.curDurability ?? item.durability ?? maxDur
    return curDur < maxDur || Boolean(item.broken)
  }

  private handleC2SRepairItem(
    entry: InternalClientEntry113c,
    npcId: number,
    singleItemId?: number,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const pNpc = this.findUnitInActiveRoom(UNIT_MONSTER, npcId)
    if (pNpc === 0) return
    const npcClassId = m.get(pNpc, D2UnitStrc.dwClassId) >>> 0
    const desc = getTownNpcDescriptorByHcIdx(npcClassId)
    if (desc === undefined || !desc.canRepair) return

    const plrX = UNITS_GetX113c(m, pPlayer) & 0xffff
    const plrY = UNITS_GetY113c(m, pPlayer) & 0xffff
    const npcX = UNITS_GetX113c(m, pNpc) & 0xffff
    const npcY = UNITS_GetY113c(m, pNpc) & 0xffff
    if (Math.hypot(plrX - npcX, plrY - npcY) > NPC_TETHER_RANGE_SUBTILES_113C) return

    const txCtx = this.buildTransactionCostContext(entry, npcClassId)
    const targetIndices: number[] = []
    let totalCost = 0

    if (singleItemId === undefined) {
      const slots: (TransactionCostInput | null)[] = new Array(13).fill(null)
      for (let i = 0; i < entry.ownedItems.length; i++) {
        const it = entry.ownedItems[i]!
        if (it.location !== 1) continue
        targetIndices.push(i)
        const bLoc = it.bodyLoc ?? it.equippedSlot ?? 0
        const txIn = this.itemDataToTransactionCostInput(entry, it)
        if (bLoc > 0 && bLoc < 13) slots[bLoc] = txIn
        else slots.push(txIn)
      }
      totalCost = computeRepairAllCost113c(slots, txCtx)
    } else {
      const idx = entry.ownedItems.findIndex((i) => i.id === singleItemId)
      if (idx === -1) return
      const it = entry.ownedItems[idx]!
      if (!this.doesItemNeedRepair113c(it)) return
      targetIndices.push(idx)
      totalCost = computeTransactionCost113c(
        this.itemDataToTransactionCostInput(entry, it),
        txCtx,
        3,
      )
    }

    if (totalCost <= 0) return
    if (!this.spendPlayerGold(entry, totalCost)) return

    for (let k = 0; k < targetIndices.length; k++) {
      const idx = targetIndices[k]!
      const prev = entry.ownedItems[idx]!
      if (!this.doesItemNeedRepair113c(prev)) continue
      const maxDur = prev.maxDurability ?? 0
      const cleanFlags =
        (Number(prev.rawFlags ?? prev.flags ?? ITEM_FLAG_IDENTIFIED_113C) &
          ~ITEM_FLAG_BROKEN_113C) >>>
        0
      const repaired: ItemData = {
        ...prev,
        durability: maxDur,
        curDurability: maxDur,
        broken: false,
        flags: cleanFlags,
        rawFlags: cleanFlags,
      }
      entry.ownedItems[idx] = repaired
      const container =
        repaired.location === 1
          ? 'equipment'
          : repaired.location === 4
            ? 'cursor'
            : (repaired.storePage ?? repaired.storagePage) === 5
              ? 'stash'
              : (repaired.storePage ?? repaired.storagePage) === 4
                ? 'cube'
                : 'inventory'
      this.queueServerEventToClient(entry, {
        type: 'ItemEvent',
        action: 'repair',
        itemId: repaired.id,
        code: repaired.code,
        x: repaired.gridX ?? 0,
        y: repaired.gridY ?? 0,
        container,
        ownerId: entry.playerUnitId,
        item: repaired,
      })
    }
  }

  private handleC2SClickButton(
    entry: InternalClientEntry113c,
    buttonId: number,
    rawAmount: number,
  ): void {
    const m = this.m
    const pPlayer = entry.pPlayer >>> 0
    if (pPlayer === 0) return
    const amount = Math.max(0, Math.floor(rawAmount))

    if (buttonId === 0x12) {
      entry.stashOpen = false
      this.queueServerEventToClient(entry, {
        type: 'Trade',
        action: BUTTON_CLOSE_STASH_113C,
      })
      return
    }
    if (buttonId === 0x17) {
      entry.cubeOpen = false
      return
    }
    if (buttonId === 0x13) {
      // WithdrawGold: stash -> inventory (`STAT_GOLDBANK` -> `STAT_GOLD`)
      const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
      const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
      const curBank = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0) >>> 0
      if (amount <= 0 || amount > curBank) return
      if (curGold + amount > getInventoryGoldLimit(clvl)) return
      const nextGold = (curGold + amount) >>> 0
      const nextBank = (curBank - amount) >>> 0
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLDBANK, nextBank | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)
      this.sendPlayerStatUpdate(entry, STAT_GOLDBANK, nextBank)
      return
    }
    if (buttonId === 0x14) {
      // DepositGold: inventory -> stash (`STAT_GOLD` -> `STAT_GOLDBANK`)
      const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
      const curGold = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLD, 0) >>> 0
      const curBank = STATLIST_GetUnitStat113c(m, pPlayer, STAT_GOLDBANK, 0) >>> 0
      if (amount <= 0 || amount > curGold) return
      const deposit = Math.min(amount, Math.max(0, getStashGoldLimit(clvl) - curBank))
      if (deposit <= 0) return
      const nextGold = (curGold - deposit) >>> 0
      const nextBank = (curBank + deposit) >>> 0
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLD, nextGold | 0, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_GOLDBANK, nextBank | 0, 0)
      this.sendPlayerStatUpdate(entry, STAT_GOLD, nextGold)
      this.sendPlayerStatUpdate(entry, STAT_GOLDBANK, nextBank)
      return
    }
    if (buttonId === 0x18) {
      // Horadric Cube Transmute (`Cubemain.txt` via `executeCubeTransmute113c`)
      const cubeItems = entry.ownedItems.filter(
        (i) => i.location === 0 && (i.storePage ?? i.storagePage ?? 0) === 4,
      )
      if (cubeItems.length === 0) return
      const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pPlayer, STAT_LEVEL, 0) | 0)
      const classCode = requireCharClassCode113c(entry.charClass)
      const result = executeCubeTransmute113c({
        cubeItems,
        playerLevel: clvl,
        playerClassCode: classCode,
        difficulty: this.difficultyValue,
        areaId: this.areaId,
        isExpansion: true,
        isLadder: true,
        rng: this.rng,
        allocateUnitId: () => this.allocUnitId(),
        tables: getEmbeddedDropTables(),
      })
      if (!result.matched) return

      for (let i = 0; i < result.consumedItemIds.length; i++) {
        const cid = result.consumedItemIds[i]!
        const removed = this.removeOwnedItemAndChildren(entry, cid)
        if (removed !== null) {
          const delFlags =
            (Number(removed.item.rawFlags ?? removed.item.flags ?? ITEM_FLAG_IDENTIFIED_113C) |
              ITEM_FLAG_DELETED_113C) >>>
            0
          this.queueServerEventToClient(entry, {
            type: 'ItemEvent',
            action: 'remove',
            itemId: removed.item.id,
            code: removed.item.code,
            x: removed.item.gridX ?? 0,
            y: removed.item.gridY ?? 0,
            container: 'cube',
            item: { ...removed.item, flags: delFlags, rawFlags: delFlags },
          })
        }
      }
      for (let i = 0; i < result.createdItems.length; i++) {
        const createdEntry = result.createdItems[i]!
        const createdItem = createdEntry.item
        const sz = this.getItemGridSize(createdItem)
        const slot = this.findFreeContainerSlot(entry, 4, sz.width, sz.height)
        if (slot === null) {
          throw new Error(
            `Horadric Cube has no free slot for transmute output "${createdItem.code}" (${sz.width}x${sz.height})`,
          )
        }
        const placed: ItemData = {
          ...createdItem,
          location: 0,
          container: 'cube',
          storePage: 4,
          storagePage: 4,
          gridX: slot.x,
          gridY: slot.y,
          x: slot.x,
          y: slot.y,
          ownerType: 0,
          ownerId: entry.playerUnitId,
        }
        entry.ownedItems.push(placed)
        this.queueServerEventToClient(entry, {
          type: 'ItemEvent',
          action: 'add',
          itemId: placed.id,
          code: placed.code,
          x: slot.x,
          y: slot.y,
          container: 'cube',
          ownerId: entry.playerUnitId,
          item: placed,
        })
      }
    }
  }

  private broadcastPlayerMove0F(pPlayer: number, animMode: number): void {
    for (const recipient of this.clients.values()) {
      if (recipient.closed || recipient.pClient === 0) continue
      if (this.m.u32((recipient.pClient + D2ClientStrcOffsets.dwClientState) >>> 0) !== 4) continue
      NET_SendUnitMovePacket0F113c(this.m, this.pGame, pPlayer, recipient.pClient, animMode)
    }
  }

  private flushAllClientQueuesToSink(): void {
    for (const entry of this.clients.values()) {
      if (entry.closed || entry.pClient === 0) continue
      this.flushClientQueueToSink(entry)
    }
  }

  private getQueuedByteCount(pClient: number): number {
    if (pClient === 0) return 0
    let total = 0
    let walk = this.m.u32((pClient + 0x1b8) >>> 0) >>> 0
    let guard = 0
    while (walk !== 0 && guard++ < 64) {
      total += this.m.u32(walk) >>> 0
      walk = this.m.u32((walk + 0x204) >>> 0) >>> 0
    }
    return total
  }

  /**
   * Drains `pClient->pPacketDataHead` (`+0x1B8`, `0x208`-byte `D2PacketDataStrc` nodes per `0x6FC4D500`)
   * into discrete validated S2C packets, records each uncompressed packet, and dispatches
   * `<= 0x200`-byte `D2PacketDataStrc` batches through `D2NetPacketSink113c` via `IAT 0x6FD18B64`.
   */
  private flushClientQueueToSink(entry: InternalClientEntry113c): void {
    const m = this.m
    const pHeadQueue = m.u32((entry.pClient + 0x1b8) >>> 0) >>> 0
    if (pHeadQueue === 0) return

    let totalQueued = 0
    let walk = pHeadQueue
    let guard = 0
    while (walk !== 0 && guard++ < 64) {
      const used = m.u32(walk) >>> 0
      totalQueued += used <= 0x200 ? used : 0x200
      walk = m.u32((walk + 0x204) >>> 0) >>> 0
    }
    if (totalQueued === 0) {
      m.setU32((entry.pClient + 0x1b8) >>> 0, 0)
      m.setU32((entry.pClient + 0x1bc) >>> 0, 0)
      return
    }

    const joined = new Uint8Array(totalQueued)
    let writeCursor = 0
    walk = pHeadQueue
    m.setU32((entry.pClient + 0x1b8) >>> 0, 0)
    m.setU32((entry.pClient + 0x1bc) >>> 0, 0)
    guard = 0
    while (walk !== 0 && guard++ < 64) {
      const rawUsed = m.u32(walk) >>> 0
      const used = rawUsed <= 0x200 ? rawUsed : 0x200
      for (let i = 0; i < used; i++) {
        joined[writeCursor++] = m.u8((walk + 0x04 + i) >>> 0)
      }
      const nextNode = m.u32((walk + 0x204) >>> 0) >>> 0
      m.setU32(walk, 0)
      m.setU32((walk + 0x204) >>> 0, m.u32((entry.pClient + 0x1c0) >>> 0) >>> 0)
      m.setU32((entry.pClient + 0x1c0) >>> 0, walk)
      walk = nextNode
    }

    const discretePackets: Uint8Array[] = []
    let offset = 0
    while (offset < joined.byteLength) {
      let pktSize = resolveS2cPacketSize(joined, offset)
      // D2Game.dll@0x6FCAB010 queues 0x22-byte zero-padded S2C 0x3E packets with valid byte count at +1
      // (matches drainClientS2CPackets113c in src/d2kern-113c/net/packet-sink.ts).
      if (
        pktSize !== null &&
        joined[offset] === 0x3e &&
        pktSize > 0 &&
        pktSize < 0x22 &&
        offset + 0x22 <= joined.byteLength
      ) {
        let trailingZero = true
        for (let z = pktSize; z < 0x22; z++) {
          if (joined[offset + z] !== 0) {
            trailingZero = false
            break
          }
        }
        if (trailingZero) {
          pktSize = 0x22
        }
      }
      if (pktSize === null || pktSize <= 0 || offset + pktSize > joined.byteLength) {
        discretePackets.push(joined.slice(offset))
        break
      }
      discretePackets.push(joined.slice(offset, offset + pktSize))
      offset += pktSize
    }

    const curFrame = this.frame
    for (let i = 0; i < discretePackets.length; i++) {
      const pktBytes = discretePackets[i]!
      const rec: UncompressedS2CPacketRecord113c = {
        queue: 1,
        clientId: entry.clientId,
        opcode: pktBytes[0]!,
        frame: curFrame,
        bytes: pktBytes,
      }
      this.uncompressedOutbox.push(rec)
      for (const cb of this.uncompressedListeners) {
        cb(rec)
      }
    }

    // Batch discrete packets into `<= 0x200` (`512B`) `D2PacketDataStrc` blocks (`0x6FC4D500` -> `D2Net.#10002`)
    let batchStart = 0
    while (batchStart < discretePackets.length) {
      let batchLen = 0
      let batchEnd = batchStart
      while (batchEnd < discretePackets.length) {
        const nextLen = discretePackets[batchEnd]!.byteLength
        if (batchLen > 0 && batchLen + nextLen > D2PACKET_DATA_MAX_BATCH_113C) {
          break
        }
        batchLen += nextLen
        batchEnd++
      }
      let dstOff = 0
      for (let k = batchStart; k < batchEnd; k++) {
        const part = discretePackets[k]!
        for (let b = 0; b < part.byteLength; b++) {
          m.setU8((this.pSendScratch + dstOff + b) >>> 0, part[b]!)
        }
        dstOff += part.byteLength
      }
      this.packetSink.dispatchIat(D2GAME_NET_IAT_VA_113C.sendPacket_10002, m, [
        1,
        entry.clientId,
        this.pSendScratch,
        dstOff,
      ])
      batchStart = batchEnd
    }
  }

  private drainSinkToConsumers(): void {
    const drained: CapturedS2CPacket113c[] = this.packetSink.drain()
    if (drained.length === 0) return
    const curFrame = this.frame

    for (let i = 0; i < drained.length; i++) {
      const pkt = drained[i]!
      const entry = this.clients.get(pkt.clientId)

      // Direct Queue `0` / immediate `sendPacket_10002` packets (e.g. `[0xAF, 0x01]`, `0x06 GameLogoutSuccess`)
      // that bypassed `pClient->pPacketQueue` are also recorded on the uncompressed stream.
      if (pkt.queue === 0 || (pkt.bytes.byteLength === 1 && pkt.opcode === 0x06)) {
        const uncomp: UncompressedS2CPacketRecord113c = {
          queue: pkt.queue,
          clientId: pkt.clientId,
          opcode: pkt.opcode,
          frame: curFrame,
          bytes: pkt.bytes.slice(),
        }
        this.uncompressedOutbox.push(uncomp)
        for (const cb of this.uncompressedListeners) {
          cb(uncomp)
        }
      }

      const wireBytes = pkt.wireBytes !== undefined ? pkt.wireBytes : pkt.bytes
      const wireRec: WireS2CPacketRecord113c = {
        queue: pkt.queue,
        clientId: pkt.clientId,
        firstOpcode: pkt.opcode,
        frame: curFrame,
        uncompressedBytes: pkt.bytes,
        wireBytes,
      }
      this.wireOutbox.push(wireRec)
      for (const cb of this.wireListeners) {
        cb(wireRec)
      }

      if (entry !== undefined && !entry.closed && entry.stream !== null) {
        if (entry.wireFormat === 'compressed') {
          entry.stream.write(wireBytes)
        } else if (!(pkt.queue === 0 && pkt.opcode === 0xaf)) {
          entry.stream.write(pkt.bytes)
        }
      }
    }
  }
}

export { validateC2sPacket }
