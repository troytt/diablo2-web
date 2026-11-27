/**
 * Diablo II v1.13c Pure Kernel — Milestone 33 (`[K2]` Phase 2, Lane K2-E):
 * Dynamic-gap `D2Game.dll` ports for `a1-bloodmoor-melee` and `p52-dot-ticks` (39 VAs).
 *
 * Strictly 100% `Memory113c`-native with zero JS gameplay caches, zero array ordering helpers,
 * and zero permissive fallbacks.
 */
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import {
  D2DamageStrc,
  D2EventStrc,
  D2GameStrc,
  D2MissileDataStrc,
  D2StatListExStrc,
  D2StatListStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import { SEED_InitLowSeed113c, seedRoll, type D2SeedStrc } from '../prng.ts'
import { mulDiv113c, sar32, sdiv32 } from '../common/int-math.ts'
import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_FindAdjacentUnitWithCallback113c,
  COLLISION_ResetMaskWithPatternSimple113c,
} from '../common/collision.ts'
import {
  ANIMSEQ_GetEventAtFrame113c,
  UNITS_GetPlayerData113c,
} from '../common/composit.ts'
import { MONSTER_CheckMonTypeFlag0x20_113c } from '../common/drlg/drlg-ver.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_AllocMissileData113c,
  MISSILE_CalculateDamageData113c,
  MISSILE_FreeMissileData113c,
  MISSILE_GetActivateFrame113c,
  MISSILE_GetActivateFrameFromUnit113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetStreamFlags113c,
  MISSILE_IsOwnedByUnit113c,
  MISSILE_SetActivateFrame113c,
  MISSILE_SetLevel113c,
  MISSILE_SetOwner113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetStreamFlags113c,
  MISSILE_SetTotalFrames113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile.ts'
import {
  PATH_AddUnitCollisionFootprint113c,
  PATH_Compute113c,
  PATH_GetOrCheckLastCollisionMask113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetSavedSteps113c,
  PATH_GetVelocity113c,
  PATH_SetAcceleration113c,
  PATH_SetCollisionMask113c,
  PATH_SetMaxVelocity113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetVelocity113c,
  PATH_Step113c,
} from '../common/path.ts'
import { UNITS_GetRightSkill113c } from '../common/quest-record.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetItemSkillInfo113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetRightSkill113c,
  STATES_UpdateOrClearState98Transform113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills.ts'
import {
  MISSILE_ApplyDamageDataToStatList113c,
  STATES_CheckState113c,
  STATES_CheckStateMask32OnUnit113c,
  STATES_CheckStateMask6OnUnit113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_ExpireOrphanStateSubLists113c,
  STATLIST_ExpireTimedSubLists113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetExtendedUnitStatsById113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerId113c,
  STATLIST_GetOwnerType113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetSkillId113c,
  STATLIST_SetSkillLevel113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import {
  UNIT_GetAlignment113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetAnimStartFrame113c,
  UNITS_GetBlockChance113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetRoom113c,
  UNITS_GetStateFlagsPtr113c,
  UNITS_GetUnitSizeX113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_Alloc113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import { MONSTERS_IsDemonOrUndead113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_CalcMissileSubLoopFrames113c } from '../tables/missile-tbls-113c.ts'
import { NET_QueuePacketPtrToClient113c } from '../net/packet-sink.ts'
import {
  PLAYER_UpdateDualWieldWeaponStatLists113c,
  SKILLS_ExecuteSkillDoFunc113c,
  SKILLS_SetSkillDelayTimer113c,
  SKILLS_StartUsedSkill113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
  SUNIT_DispatchItemEventCallbacks113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  MONSTER_StartMode113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  SUNITDMG_SelectDeathOverlayFlag113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c.ts'
import { MISSILES_ConsumePierceStat_6FC58F40_113c } from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_ApplyCritDamage113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import { MONSTER_DispatchMinionComponentCallbacks113c } from './boot-init-gap-a-113c.ts'
import { D2GAME_SUNIT_GetGameFromUnit113c } from './boot-init-gap-b-113c.ts'
import { SUNITDMG_GetDefenderColdEffect113c } from './k2-combat-core-w1-113c.ts'
import { SKILLS_ActivateAuraSkillOnUnit113c } from './k2-gap-itemdef-113c.ts'
import { MONUMOD_DispatchOnKillEvent5_113c } from './k2-items-tc-w1-113c.ts'
import {
  SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c,
  SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c.ts'
import { STATES_OnStateRemovedResetMonsterAi_6FC70130_113c } from './k2-w3b5-113c.ts'
import { STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c } from './k2-w5b2-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  MONSTER_ClearModeEvents113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import {
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS2_CheckModeBit113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  EVENT_CreateNodeWithGrowth113c,
  EVENT_FreeNode113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

// ============================================================================
// Binary `.rdata` / `.data` Addresses & Static Tables (`D2Game.dll` v1.13c)
// ============================================================================

export const D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C = 0x6fd1829c
export const D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C = 0x6fd18be0

export const D2GAME_EVENT_PARTITION_MAP_VA_113C = 0x6fd1a3dc
export const D2GAME_NOVA_DX_TABLE_VA_113C = 0x6fd1b770
export const D2GAME_NOVA_DY_TABLE_VA_113C = 0x6fd1b870
export const D2GAME_MISSILE_COLLIDE_TABLE_VA_113C = 0x6fd2d928
export const D2GAME_SRVDO_MISSILE_TABLE_VA_113C = 0x6fd2d970
export const D2GAME_SRVDO_MISSILE_COUNT_VA_113C = 0x6fd2da44
export const D2GAME_SRVHIT_MISSILE_TABLE_VA_113C = 0x6fd2da48
export const D2GAME_SRVHIT_MISSILE_COUNT_VA_113C = 0x6fd2db64
export const D2GAME_SRVDMG_MISSILE_TABLE_VA_113C = 0x6fd2db68
export const D2GAME_SRVDMG_MISSILE_COUNT_VA_113C = 0x6fd2dbe4

export const D2GAME_FP_REMOVE_CLEAR_STATE_GFX_VA_113C = 0x6fc58e60
export const D2GAME_FP_REMOVE_TIMED_STATE_VA_113C = 0x6fcbf7a0
const D2GAME_DEATH_OVERLAY_ROTOR_VA_113C = 0x6fd31f98

/** `0x6FD1A3DC` (`6` dwords): unitType `0..5` -> timer persistent list partition index. */
export const D2GAME_EVENT_PARTITION_MAP_113C: readonly number[] = [
  0, 1, 3, 2, 4, 0xffffffff,
]

/** `0x6FD1B770` (`64` signed `int32`s): 64-ray nova ring `dx` offsets (radius `30`). */
export const D2GAME_NOVA_64_DX_113C: readonly number[] = [
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
]

/** `0x6FD1B870` (`64` signed `int32`s): 64-ray nova ring `dy` offsets (radius `30`). */
export const D2GAME_NOVA_64_DY_113C: readonly number[] = [
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
]

/** `0x6FD2D928` (`8` entries x `{ pfnFilter, wColMask }`): `nCollideType` `0..7` collision table. */
export const D2GAME_MISSILE_COLLIDE_MODES_113C: readonly { pfn: number; mask: number }[] = [
  { pfn: 0x00000000, mask: 0x000 },
  { pfn: 0x6fc5ad70, mask: 0x084 },
  { pfn: 0x6fc5add0, mask: 0x104 },
  { pfn: 0x6fc5ad30, mask: 0x184 },
  { pfn: 0x00000000, mask: 0x000 },
  { pfn: 0x6fc5add0, mask: 0x104 },
  { pfn: 0x00000000, mask: 0x004 },
  { pfn: 0x6fc59510, mask: 0x040 },
  { pfn: 0x6fc5ad30, mask: 0x185 },
]

/** Scratch buffer base inside deterministic scratch page space for stack-local structs (`D2DamageStrc`, extended stats, bitstreams). */
const K2E_STACK_SCRATCH_BASE_113C = 0x7ff64000
let k2eScratchDepth113c = 0

function allocStackScratch113c(m: Memory113c, nBytes: number): number {
  const aligned = ((nBytes + 15) & ~15) >>> 0
  const ptr = (K2E_STACK_SCRATCH_BASE_113C + k2eScratchDepth113c) >>> 0
  k2eScratchDepth113c = (k2eScratchDepth113c + aligned) | 0
  m.fill(ptr, aligned, 0)
  return ptr
}

function freeStackScratch113c(nBytes: number): void {
  const aligned = ((nBytes + 15) & ~15) >>> 0
  k2eScratchDepth113c = (k2eScratchDepth113c - aligned) | 0
}

/** Optional cross-lane / table function-pointer dispatch overrides for K2 integration. */
export interface K2GapMeleeDotHooks113c {
  queuePacket?: (m: Memory113c, pClient: number, pPacket: number, nSize: number) => void
  srvDoMissile?: (
    m: Memory113c,
    wSrvDoFunc: number,
    fnVa: number,
    pGame: number,
    pMissile: number,
  ) => number
  srvHitMissile?: (
    m: Memory113c,
    wSrvHitFunc: number,
    fnVa: number,
    pGame: number,
    pMissile: number,
    pTarget: number,
  ) => number
  srvDmgMissile?: (
    m: Memory113c,
    wSrvDmgFunc: number,
    fnVa: number,
    pGame: number,
    pMissile: number,
    pTarget: number,
    pDamage: number,
  ) => void
  missileInitCallback?: (
    m: Memory113c,
    fnVa: number,
    pMissile: number,
    dwParam: number,
  ) => void
  onStatRemoveProc?: (
    m: Memory113c,
    fnVa: number,
    pUnit: number,
    nState: number,
    pStatList: number,
  ) => void
  rollBlock?: (
    m: Memory113c,
    pAttacker: number,
    pDefender: number,
    bHasPhysDmg: number,
    pGame: number,
    bAllowShieldBlock: number,
  ) => number
  checkToHit?: (
    m: Memory113c,
    pAttacker: number,
    pDefender: number,
    nArBonus: number,
    bIsMissile: number,
  ) => number
  applyDamage?: (
    m: Memory113c,
    pGame: number,
    pAttacker: number,
    pDefender: number,
    bApplyResists: number,
    pDamage: number,
  ) => void
  executePostDamage?: (
    m: Memory113c,
    pGame: number,
    pAttacker: number,
    pDefender: number,
    pDamage: number,
  ) => void
  killUnit?: (
    m: Memory113c,
    pGame: number,
    pDefender: number,
    pAttacker: number,
    bAwardExp: number,
  ) => void
  stepMissilePath?: (m: Memory113c, pGame: number, pMissile: number) => number
  scheduleModeAnimEvents?: (m: Memory113c, pGame: number, pUnit: number) => void
  despawnExcessPet?: (m: Memory113c, pGame: number, pPlayer: number, nPetType: number, nCap: number) => void
}

let scopedMeleeDotHooks113c: K2GapMeleeDotHooks113c | undefined

export function withScopedMeleeDotHooks113c<T>(
  hooks: K2GapMeleeDotHooks113c | undefined,
  fn: () => T,
): T {
  const prev = scopedMeleeDotHooks113c
  scopedMeleeDotHooks113c = hooks !== undefined ? hooks : prev
  try {
    return fn()
  } finally {
    scopedMeleeDotHooks113c = prev
  }
}

function resolveMeleeDotHooks113c(
  hooks?: K2GapMeleeDotHooks113c,
): K2GapMeleeDotHooks113c | undefined {
  return hooks !== undefined ? hooks : scopedMeleeDotHooks113c
}

function isDeathOverlayRotorMapped113c(m: Memory113c): boolean {
  try {
    m.u8(D2GAME_DEATH_OVERLAY_ROTOR_VA_113C)
    return true
  } catch {
    return false
  }
}

function hasHydratedAnimDataTableK2E_113c(m: Memory113c): boolean {
  try {
    return m.u32(0x6fdf0b4c) !== 0
  } catch {
    return false
  }
}

// ============================================================================
// Internal Binary-Exact Helpers (Non-`@va` so ONLY the 39 Assigned VAs Have `@va`)
// ============================================================================

function readSgptDataTables113c(m: Memory113c): number {
  const iat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_K2E_113C)
  return m.u32(iat)
}

function readGdwBitMaskU32_113c(m: Memory113c, bitIndex: number): number {
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C)
  return m.u32((pMasks + ((bitIndex & 31) << 2)) >>> 0)
}

function readGdwBitMaskU8_113c(m: Memory113c, byteOff: number): number {
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_K2E_113C)
  return m.u8((pMasks + byteOff) >>> 0)
}

function s16SignExt113c(v: number): number {
  return (v << 16) >> 16
}

function s8SignExt113c(v: number): number {
  return (v << 24) >> 24
}

function divBy100Magic113c(x: number): number {
  // Matches `mov eax, 0x51eb851f; imul ecx; sar edx, 5; mov ecx, edx; shr ecx, 0x1f; add ecx, edx`
  const prod = BigInt(x | 0) * 0x51eb851fn
  const edx = Number((prod >> 32n) & 0xffffffffn) | 0
  const shifted = edx >> 5
  return (shifted + (shifted >>> 31)) | 0
}

function stepSeed64At113c(m: Memory113c, pSeed: number): number {
  const s = pSeed >>> 0
  const lo = BigInt(m.u32(s))
  const hi = BigInt(m.u32((s + 4) >>> 0))
  const next = lo * 0x6ac690c5n + hi
  const newLo = Number(next & 0xffffffffn) >>> 0
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32(s, newLo)
  m.setU32((s + 4) >>> 0, newHi)
  return newLo
}

/** `Fog.#10126`: initializes a 20-byte `D2BitBufferStrc` over `(pBuffer, nBytes)`. */
function fogInitBitBuffer113c(
  m: Memory113c,
  pBitStream: number,
  pBuffer: number,
  nBytes: number,
): void {
  const bs = pBitStream >>> 0
  m.setU32(bs, pBuffer >>> 0)
  m.setU32((bs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((bs + 0x08) >>> 0, 0)
  m.setU32((bs + 0x0c) >>> 0, 0)
  m.setU32((bs + 0x10) >>> 0, 0)
}

/** `Fog.#10127`: returns serialized byte count `nPos + (nPosBits !== 0 ? 1 : 0)`. */
function fogGetBitBufferSize113c(m: Memory113c, pBitStream: number): number {
  const bs = pBitStream >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/** `Fog.#10128`: appends `nBits` low bits of `nValue` into `D2BitBufferStrc`. */
function fogWriteBits113c(
  m: Memory113c,
  pBitStream: number,
  nValue: number,
  nBits: number,
): void {
  const esi = pBitStream >>> 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  const edx = m.u32((esi + 0x08) >>> 0) | 0
  const eax = m.u32((esi + 0x04) >>> 0) | 0
  let ebp = nBits | 0
  const newBitTotal = (ecx + (edx << 3) + ebp) | 0
  if (newBitTotal > eax) {
    m.setU32((esi + 0x10) >>> 0, 1)
    m.setU32((esi + 0x08) >>> 0, sar32((eax + ((eax >> 31) & 7)) | 0, 3) >>> 0)
    m.setU32((esi + 0x0c) >>> 0, 0)
    return
  }
  if (ecx === 0) {
    m.setU8(m.u32(esi), 0)
  }
  if (ebp <= 0) return
  let ebx = nValue | 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > ebp) chunk = ebp
    const mask = ((1 << chunk) - 1) & 0xff
    const edi = m.u32(esi)
    const dl = ((ebx & mask) << (curBit & 31)) & 0xff
    m.setU8(edi, (m.u8(edi) | dl) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const newBuf = (m.u32(esi) + 1) >>> 0
      const newPos = (m.u32((esi + 0x08) >>> 0) + 1) | 0
      const maxBits = m.u32((esi + 0x04) >>> 0) | 0
      m.setU32((esi + 0x08) >>> 0, newPos >>> 0)
      m.setU32(esi, newBuf)
      m.setU32((esi + 0x0c) >>> 0, 0)
      if ((newPos << 3) < maxBits) {
        m.setU8(newBuf, 0)
      }
    }
    ebp = (ebp - chunk) | 0
    ebx = sar32(ebx, chunk & 31)
  }
}

/** `Fog.#10252`: returns index `0..31` of lowest set bit in `mask`, or `-1` if `mask == 0`. */
function fogBitScanForward113c(mask: number): number {
  const v = mask >>> 0
  if (v === 0) return -1
  const lowest = (v & -v) >>> 0
  return (31 - Math.clz32(lowest)) | 0
}

/**
 * Exact internal port of `D2Game` `0x6FCAA3E0` (`eax = pClient`, `[esp+4] = pPacket`, `[esp+8] = nSize`):
 * Appends `nSize` bytes into `pClient`'s `0x208`-byte `D2PacketDataStrc` queue (`+0x1B8` head, `+0x1BC` tail, `+0x1C0` free list).
 */
function queuePacketToClient0x6FCAA3E0(
  m: Memory113c,
  pClient: number,
  pPacket: number,
  nSize: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  if (hooks !== undefined && hooks.queuePacket !== undefined) {
    hooks.queuePacket(m, pClient >>> 0, pPacket >>> 0, nSize | 0)
    return
  }
  NET_QueuePacketPtrToClient113c(m, pClient >>> 0, pPacket >>> 0, nSize | 0)
}

/** Internal `0x6FC21620` (`eax = nMonType`, `ecx = nTargetType`): checks compiled `MonType.txt` bit matrix (`+0xC40`, `+0xC44`, `+0xC48`). */
function checkMonTypeSubFlag0x6FC21620(
  m: Memory113c,
  nMonType: number,
  nTargetType: number,
): number {
  const ecx = nTargetType | 0
  const esi = nMonType | 0
  if (ecx <= 0) return 0
  const pTables = readSgptDataTables113c(m)
  const count = m.u32((pTables + 0xc40) >>> 0) | 0
  if (ecx >= count || esi <= 0 || esi >= count) return 0
  const strideDwords = m.u32((pTables + 0xc48) >>> 0) | 0
  const pMatrix = m.u32((pTables + 0xc44) >>> 0)
  const idx = (Math.imul(strideDwords, esi) + (ecx >> 5)) | 0
  const word = m.u32((pMatrix + idx * 4) >>> 0)
  return (word & readGdwBitMaskU32_113c(m, ecx & 0x1f)) >>> 0
}

/** Internal `0x6FC58F40` (`esi = pMissile` -> `2` if pierce charge consumed, else `3`). */
function consumeMissilePierce0x6FC58F40(m: Memory113c, pMissile: number): number {
  return MISSILES_ConsumePierceStat_6FC58F40_113c(m, pMissile) | 0
}

/** Internal `0x6FC5AD70`: collide filter for `nCollideType == 1` (players + alignment-2 monsters). */
function collideFilterMode1_0x6FC5AD70(m: Memory113c, pUnit: number, pCtx: number): number {
  const ctx = pCtx >>> 0
  const u = pUnit >>> 0
  if (ctx === 0) return 0
  const pMisTxt = m.u32((ctx + 0x0c) >>> 0)
  if (pMisTxt === 0) return 0
  const uType = u !== 0 ? m.u32(u) | 0 : 6
  if (uType !== 0) {
    if (uType !== 1) return 0
    if (UNIT_GetAlignment113c(m, u) !== 2) return 0
  }
  const pMissile = m.u32((ctx + 0x04) >>> 0)
  const pGame = m.u32(ctx)
  const pOwner = m.u32((ctx + 0x08) >>> 0)
  return MISSILE_CanCollideWithUnit113c(m, u, pOwner, pMisTxt, pGame, pMissile) !== 0 ? 1 : 0
}

/** Internal `0x6FC5ADD0`: collide filter for `nCollideType == 2` or `5` (monsters `uType == 1`). */
function collideFilterMode2_0x6FC5ADD0(m: Memory113c, pUnit: number, pCtx: number): number {
  const ctx = pCtx >>> 0
  const u = pUnit >>> 0
  if (ctx === 0 || u === 0) return 0
  const pMisTxt = m.u32((ctx + 0x0c) >>> 0)
  if (pMisTxt === 0 || (m.u32(u) | 0) !== 1) return 0
  const pMissile = m.u32((ctx + 0x04) >>> 0)
  const pGame = m.u32(ctx)
  const pOwner = m.u32((ctx + 0x08) >>> 0)
  return MISSILE_CanCollideWithUnit113c(m, u, pOwner, pMisTxt, pGame, pMissile) !== 0 ? 1 : 0
}

/** Internal `0x6FC59510`: collide filter for `nCollideType == 7` (missiles with `dwMissileFlags` bit 4). */
function collideFilterMode7_0x6FC59510(m: Memory113c, pUnit: number, _pCtx: number): number {
  const u = pUnit >>> 0
  if (u === 0 || (m.u32(u) | 0) !== 3) return 0
  const pMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((u + 4) >>> 0) | 0)
  if (pMisTxt === 0) return 0
  const dl = m.u8((pMisTxt + 4) >>> 0)
  return (readGdwBitMaskU8_113c(m, 0x10) & dl) !== 0 ? 1 : 0
}

/** Internal `0x6FD01930` (`edi = pGame`, `eax = pUnit` -> `1` if stepped, `2` if blocked/stopped). */
function stepMissilePath0x6FD01930(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  if (hooks !== undefined && hooks.stepMissilePath !== undefined) {
    return hooks.stepMissilePath(m, pGame, pUnit) | 0
  }
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x72f)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const stepped = PATH_Step113c(m, pUnit, 0x400)
  const res = stepped !== 0 ? 1 : 2
  if (UNITS_GetPathRoomRefreshFlag113c(m, pUnit) !== 0) {
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pUnit, pGame)
  }
  return res
}

/** Internal `0x6FCFF7B0` (`esi = pUnit`, `[esp+4] = pGame`): schedules mode step (`0`) and mode end (`1`) events. */
function scheduleModeAnimEvents0x6FCFF7B0(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  if (hooks !== undefined && hooks.scheduleModeAnimEvents !== undefined) {
    hooks.scheduleModeAnimEvents(m, pGame, pUnit)
    return
  }
  const u = pUnit >>> 0
  const g = pGame >>> 0
  let ebx = m.u32((g + 0xa8) >>> 0) | 0
  const startFrame = UNITS_GetAnimStartFrame113c(m, u) | 0
  let curFp8 = (startFrame << 8) | 0
  const pSeq = m.u32((u + 0x30) >>> 0)
  const stepFp8 = pSeq !== 0 ? m.u32((u + 0x3c) >>> 0) | 0 : s16SignExt113c(m.u16((u + 0x4c) >>> 0))
  const endFp8 = pSeq !== 0 ? m.u32((u + 0x34) >>> 0) | 0 : m.u32((u + 0x48) >>> 0) | 0
  if (stepFp8 === 0) {
    const nextFrame = ((m.u32((g + 0xa8) >>> 0) | 0) + 1) | 0
    EVENT_SetEventFull113c(m, g, u, 1, nextFrame, 0, 0, 0)
    return
  }
  const pAnimData = m.u32((u + 0x50) >>> 0)
  let edi = curFp8 >> 8
  curFp8 = (curFp8 + stepFp8) | 0
  let stepIdx = 0
  const pEventScratch = allocStackScratch113c(m, 16)
  try {
    while (curFp8 < endFp8) {
      const nextFrameIdx = curFp8 >> 8
      ebx = (ebx + 1) | 0
      while (edi <= nextFrameIdx && edi < 0x90) {
        let evCode = 0
        const curSeq = m.u32((u + 0x30) >>> 0)
        if (curSeq !== 0) {
          m.setU32(pEventScratch, 0)
          ANIMSEQ_GetEventAtFrame113c(m, curSeq, (edi << 8) >>> 0, pEventScratch)
          evCode = m.u32(pEventScratch) | 0
        } else if (pAnimData !== 0) {
          evCode = m.u8((pAnimData + edi + 0x10) >>> 0)
        }
        if (evCode === 1 || evCode === 2 || evCode === 4) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, evCode, stepIdx)
          stepIdx = (stepIdx + 1) | 0
        } else if (evCode === 3) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, 3, 0)
        }
        edi = (edi + 1) | 0
      }
      curFp8 = (curFp8 + stepFp8) | 0
    }
  } finally {
    freeStackScratch113c(16)
  }
  const gameFrame = m.u32((g + 0xa8) >>> 0) | 0
  if (ebx === gameFrame) {
    ebx = (ebx + 1) | 0
  }
  ebx = (ebx + 1) | 0
  EVENT_SetEventFull113c(m, g, u, 1, ebx, 0, 0, 0)
  m.setU32((u + 0x44) >>> 0, ((m.u32((g + 0xa8) >>> 0) << 8) >>> 0))
}

/** Internal `0x6FC21B60`: looks up `D2PetTypeTxt*` (`sgptDataTables + 0xBE8`, count `+0xBF0`, stride `0xE0`). */
function getPetTypeTxtRecord0x6FC21B60(m: Memory113c, nPetType: number): number {
  const id = nPetType | 0
  if (id < 0) return 0
  const pTables = readSgptDataTables113c(m)
  const count = m.u32((pTables + 0xbf0) >>> 0) | 0
  if (id >= count) return 0
  const pBase = m.u32((pTables + 0xbe8) >>> 0)
  return (pBase + Math.imul(id, 0xe0)) >>> 0
}

/** Internal `0x6FCB6EA0`: updates player pet type cap (`pPetTable[nPetType].nMax` at `+0x08`) and trims excess pets if hooked. */
function setPlayerPetTypeCap0x6FCB6EA0(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  nPetType: number,
  nCap: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('Pets.cpp', 0x200)
  }
  const petType = nPetType | 0
  const cap = nCap | 0
  if (petType === 1 && cap !== 1) return
  const pPetsContainer = m.u32((pPlayerData + 0x44) >>> 0)
  if (pPetsContainer === 0 || petType < 0) return
  const pTables = readSgptDataTables113c(m)
  if (petType >= (m.u32((pTables + 0xbf0) >>> 0) | 0)) return
  const pPetArray = m.u32(pPetsContainer)
  if (pPetArray === 0) return
  const pEntry = (pPetArray + petType * 12) >>> 0
  const curCount = m.u32((pEntry + 0x04) >>> 0) | 0
  m.setU32((pEntry + 0x08) >>> 0, cap >>> 0)
  if (curCount > cap && curCount > 0 && petType !== 7) {
    if (hooks !== undefined && hooks.despawnExcessPet !== undefined) {
      hooks.despawnExcessPet(m, pGame, pPlayer, petType, cap)
    }
  }
}

/** Internal `0x6FCB6FA0` (`[esp+4] = pGame`, `[esp+8] = pPlayer`): recalculates summon caps across player skill list. */
function syncPlayerPetCaps0x6FCB6FA0(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const u = pPlayer >>> 0
  if (u === 0 || m.u32(u) !== 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, u)
  if (pPlayerData === 0 || m.u32((pPlayerData + 0x44) >>> 0) === 0) return
  const pSkillList = m.u32((u + 0xa8) >>> 0)
  if (pSkillList === 0) return

  const pCapsScratch = allocStackScratch113c(m, 0x400)
  try {
    let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList)
    while (pSkill !== 0) {
      const pNext = SKILLS_GetNextSkill113c(m, pSkill)
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
      const nLvl = SKILLS_EvaluateSkillLevel113c(m, u, pSkill, 1) | 0
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
      if (pSkillsTxt !== 0) {
        const petType = s8SignExt113c(m.u8((pSkillsTxt + 0xbe) >>> 0))
        const pTables = readSgptDataTables113c(m)
        const nPetTypes = m.u32((pTables + 0xbf0) >>> 0) | 0
        if (petType > 0 && petType < nPetTypes && petType < 256) {
          const calcOff = m.u32((pSkillsTxt + 0xc0) >>> 0)
          let maxPets = SKILLS_EvalCalcByOffset113c(m, u, calcOff, nSkillId, nLvl) | 0
          if (maxPets < 1) maxPets = 1
          const prevBest = m.u32((pCapsScratch + petType * 4) >>> 0) | 0
          if (maxPets > prevBest) {
            m.setU32((pCapsScratch + petType * 4) >>> 0, maxPets >>> 0)
            setPlayerPetTypeCap0x6FCB6EA0(m, pGame, u, petType, maxPets, hooks)
          }
        }
      }
      pSkill = pNext
    }

    const pTables = readSgptDataTables113c(m)
    const nPetTypes = m.u32((pTables + 0xbf0) >>> 0) | 0
    for (let i = 0; i < nPetTypes && i < 256; i++) {
      if ((m.u32((pCapsScratch + i * 4) >>> 0) | 0) <= 0) {
        const pPetTxt = getPetTypeTxtRecord0x6FC21B60(m, i)
        if (pPetTxt !== 0) {
          const baseMax = s16SignExt113c(m.u16((pPetTxt + 0x0a) >>> 0))
          setPlayerPetTypeCap0x6FCB6EA0(m, pGame, u, i, baseMax, hooks)
        }
      }
    }
  } finally {
    freeStackScratch113c(0x400)
  }
}

/** Internal `0x6FCFB030` (`eax = pDefender`, `edi = pAttacker`, `[esp+4] = bRanged`): Amazon evade/dodge/avoid + weapon block. */
function rollPassiveAvoidOrWeaponBlock0x6FCFB030(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  bRanged: number,
): number {
  if (pAttacker === 0) return 0
  return SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, bRanged)
}

/** Internal `0x6FCFB790` (`eax = bHasPhysDmg`, `ecx = pAttacker`, `esi = pDefender`, `[esp+4] = pGame`, `[esp+8] = bAllowWeaponBlock`). */
function rollBlock0x6FCFB790(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  bHasPhysDmg: number,
  pGame: number,
  bAllowWeaponBlock: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  if (hooks !== undefined && hooks.rollBlock !== undefined) {
    return hooks.rollBlock(m, pAttacker, pDefender, bHasPhysDmg, pGame, bAllowWeaponBlock) | 0
  }
  if (bHasPhysDmg === 0) {
    return SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(
      m,
      pDefender,
      pGame,
      1,
      bAllowWeaponBlock,
      pAttacker,
      0,
    )
  }
  const blk = SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(
    m,
    pDefender,
    pGame,
    1,
    bAllowWeaponBlock,
    pAttacker,
    1,
  )
  if (blk !== 0) {
    return blk
  }
  return rollPassiveAvoidOrWeaponBlock0x6FCFB030(m, pAttacker, pDefender, bAllowWeaponBlock)
}

/** Internal `0x6FCFDE90` (`eax = pAttacker`, `[esp+4] = pDefender`, `[esp+8] = nArBonus`, `[esp+0xC] = bIsMissile`). */
function checkToHit0x6FCFDE90(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  nArBonus: number,
  bIsMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  if (hooks !== undefined && hooks.checkToHit !== undefined) {
    return hooks.checkToHit(m, pAttacker, pDefender, nArBonus, bIsMissile) | 0
  }
  return SUNITDMG_CheckToHit113c(m, pAttacker, pDefender, nArBonus, bIsMissile, true) | 0
}

/**
 * Exact internal port of `0x6FCFCAB0` (`[esp+4] = pAttacker`, `[esp+8] = pDefender`, `[esp+0xC] = dwPoisDamage`, `[esp+0x10] = dwPoisLen`):
 * Attaches or updates `STATE_POISON (2)` sub-statlist (`STAT_HPREGEN = -dwPoisDamage`, `fpRemove = 0x6FCBF7A0`) and schedules Events `3` & `0xC`.
 */
function applyPoison0x6FCFCAB0(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  dwPoisDamage: number,
  dwPoisLen: number,
): void {
  const poisLen = dwPoisLen | 0
  const poisDmg = dwPoisDamage | 0
  if (poisLen <= 0 || poisDmg <= 0) return
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  if (att === 0) {
    throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
  }
  const existingSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, 2)
  const pGame = m.u32((att + 0x80) >>> 0)
  if (def !== 0 && m.u32(def) === 1 && pGame !== 0) {
    let ev = m.u32((def + 0xdc) >>> 0)
    while (ev !== 0) {
      const nextEv = m.u32((ev + 0x24) >>> 0)
      if (m.u8(ev) === 3) {
        EVENT_FreeNode113c(m, pGame, ev)
      }
      ev = nextEv
    }
    const nextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) | 0
    EVENT_SetEventFull113c(m, pGame, def, 3, nextFrame, 0, 0, 0)
  }
  if (pGame === 0) return
  const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + poisLen) | 0
  if (existingSub === 0) {
    STATES_ToggleGfxStateFlag113c(m, def, 2, 1)
    const ownerId = m.u32((att + 0x0c) >>> 0)
    const ownerType = m.u32(att)
    const pPool = m.u32((pGame + 0x1c) >>> 0)
    const pSub = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame)
    if (pSub !== 0) {
      m.setU32(pSub, pPool)
      EVENT_SetEventFull113c(m, pGame, def, 0x0c, expireFrame, 0, 0, 0)
      STATLIST_SetStat113c(m, pSub, 0x4a, (-poisDmg) | 0, 0)
      STATLIST_SetState113c(m, pSub, 2)
      STATLIST_SetStatRemoveProc113c(m, pSub, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
      STATLIST_MergeStatLists113c(m, def, pSub, 1)
    }
    return
  }
  const curRate = -(STATLIST_GetStatValue113c(m, existingSub, 0x4a, 0) | 0)
  if (curRate <= poisDmg) {
    STATLIST_SetExpireFrameEx113c(m, existingSub, expireFrame)
    EVENT_SetEventFull113c(m, pGame, def, 0x0c, expireFrame, 0, 0, 0)
    STATLIST_SetStat113c(m, existingSub, 0x4a, (-poisDmg) | 0, 0)
  }
}

function buildMeleeDotCombatHooks(hooks?: K2GapMeleeDotHooks113c): SUnitDmgHooks113c {
  const effHooks = resolveMeleeDotHooks113c(hooks)
  return {
    suppressDirectS2c: true,
    onApplyPoison: (mem, _pg, att, def, poisDmg, poisLen) => {
      applyPoison0x6FCFCAB0(mem, att, def, poisDmg, poisLen)
    },
    onKillUnit: (mem, pg, def, att, bAwardExp) => {
      killUnit0x6FCFEEE0(mem, pg, def, att, bAwardExp, effHooks)
    },
    onMonsterStartMode: (mem, pg, def, mode, pTarget) => {
      if (hasHydratedAnimDataTableK2E_113c(mem)) {
        const isMon = def !== 0 && (mem.u32(def >>> 0) | 0) === 1
        if (isMon && SUNIT_IsDeadOrDying113c(mem, def) === 0) {
          const r0 = UNITS_GetRoom113c(mem, def) >>> 0
          if (r0 !== 0 && mem.u32((r0 + 0x20) >>> 0) !== 0) {
            PATH_AddUnitCollisionFootprint113c(mem, def)
          }
        }
        const md0 = isMon ? (mem.u32((def + 0x14) >>> 0) >>> 0) : 0
        const coord0 = md0 !== 0 ? (mem.u32((md0 + 0x50) >>> 0) >>> 0) : 0
        const rm0 = coord0 !== 0 ? (UNITS_GetRoom113c(mem, def) >>> 0) : 0
        MONSTER_StartMode113c(
          mem,
          pg,
          def,
          mode,
          mode === 6 || mode === 13 ? (pTarget !== undefined ? pTarget : 0) : 0,
          0,
          0,
        )
        if (coord0 !== 0 && rm0 !== 0 && (UNITS_GetRoom113c(mem, def) >>> 0) === rm0) {
          const md1 = mem.u32((def + 0x14) >>> 0) >>> 0
          if (md1 !== 0 && mem.u32((md1 + 0x50) >>> 0) === 0) {
            mem.setU32((md1 + 0x50) >>> 0, coord0)
          }
        }
        if (def !== 0 && (mem.u32((def + 0x10) >>> 0) | 0) === (mode | 0)) {
          SKILLS_SetUsedSkillMemPort113c(mem, def, 0)
        }
        return
      }
      if (mode === 3) {
        const pModeScratch = allocStackScratch113c(mem, 0x24)
        try {
          mem.setU32(pModeScratch, 3)
          mem.setU32((pModeScratch + 4) >>> 0, def)
          MONSTER_StartGetHitMode113c(mem, pg, pModeScratch)
        } finally {
          freeStackScratch113c(0x24)
        }
      }
    },
  }
}

function scaleDmgValue0x6FCFC1BA(val: number, scale: number): number {
  const ecx = val | 0
  const esi = scale | 0
  if (ecx > 0x100000) {
    if ((ecx & 0xfffffff0) < 0x640) {
      return Number((BigInt(ecx) * BigInt(esi)) / 100n) | 0
    }
    return Math.imul(divBy100Magic113c(ecx), esi)
  }
  if (esi > 0x10000) {
    if ((esi & 0xfffffff0) < 0x640) {
      return Number((BigInt(ecx) * BigInt(esi)) / 100n) | 0
    }
    return Math.imul(divBy100Magic113c(esi), ecx)
  }
  return divBy100Magic113c(Math.imul(ecx, esi))
}

const PVP_PET_SCALED_DMG_OFFSETS_6FD22AB0: readonly number[] = [
  0x08, 0x10, 0x1c, 0x24, 0x20, 0x28, 0x38, 0x3c, 0x40,
]

function applyMissingPetOrBossDamageMult0x6FCFAC10(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDamage: number,
): void {
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  const dmg = pDamage >>> 0
  if (att === 0 || def === 0 || dmg === 0 || att === def) return
  const attType = m.u32(att) >>> 0
  const defType = m.u32(def) >>> 0
  let mult = 100
  if (defType === 0 && attType === 1) {
    const pMonData = m.u32((att + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
    const legacyHandled =
      pAiGen !== 0 && m.u32((pAiGen + 0x10) >>> 0) === 0 && m.u32((pAiGen + 0x0c) >>> 0) !== 0
    if (
      !legacyHandled &&
      ((m.u32((att + 0xc4) >>> 0) >>> 31) !== 0 || MONSTERS_GetHirelingTypeId113c(m, att) !== 0)
    ) {
      mult = 0x11
    }
  } else if (
    attType === 1 &&
    defType === 1 &&
    MONSTERS_GetHirelingTypeId113c(m, def) !== 0 &&
    MONSTERS_GetHirelingTypeId113c(m, att) !== 0
  ) {
    mult = 0x19
  } else if (
    attType === 1 &&
    defType === 1 &&
    (m.u32((def + 0xc4) >>> 0) >>> 31) !== 0 &&
    MONSTERS_GetHirelingTypeId113c(m, def) === 0
  ) {
    const pAttStats = MONSTATS_GetRecordPtr113c(m, m.u32((att + 0x04) >>> 0) | 0) >>> 0
    if (pAttStats !== 0 && (m.u8((pAttStats + 0x0c) >>> 0) & 0x40) !== 0) {
      mult = 400
    }
  }
  if (mult === 100) return
  for (const off of PVP_PET_SCALED_DMG_OFFSETS_6FD22AB0) {
    const ptr = (dmg + off) >>> 0
    const cur = m.u32(ptr) | 0
    if (cur > 0) {
      m.setU32(ptr, scaleDmgValue0x6FCFC1BA(cur, mult) >>> 0)
    }
  }
}

/**
 * Exact internal port of `0x6FCFE0C0` (`eax = pDefender`, `[esp+4] = pGame`, `[esp+8] = pAttacker`, `[esp+0xC] = bApplyResists`, `[esp+0x10] = pDamage`),
 * delegating directly to canonical `SUNITDMG_ApplyDamage113c` in `./k2-real-s2c-combat-113c.ts`.
 */
function applyDamage0x6FCFE0C0(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bApplyResists: number,
  pDamage: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  if (bApplyResists !== 0) {
    applyMissingPetOrBossDamageMult0x6FCFAC10(m, pAttacker, pDefender, pDamage)
  }
  const effHooks = resolveMeleeDotHooks113c(hooks)
  if (effHooks !== undefined && effHooks.applyDamage !== undefined) {
    effHooks.applyDamage(m, pGame, pAttacker, pDefender, bApplyResists, pDamage)
    return
  }
  const dmg = pDamage >>> 0
  const savedHitClass = dmg !== 0 ? m.u32((dmg + 0x60) >>> 0) : 0
  const savedHitClassActiveSet = dmg !== 0 ? m.u8((dmg + 0x64) >>> 0) : 0
  SUNITDMG_ApplyDamage113c(
    m,
    pGame,
    pAttacker,
    pDefender,
    pDamage,
    bApplyResists,
    buildMeleeDotCombatHooks(effHooks),
    1,
  )
  if (dmg !== 0) {
    m.setU32((dmg + 0x60) >>> 0, savedHitClass)
    m.setU8((dmg + 0x64) >>> 0, savedHitClassActiveSet)
  }
}

/** Internal `0x6FCFEEE0` (`ecx = pGame`, `edx = pDefender`, `[esp+4] = pAttacker`, `[esp+8] = bAwardExp`): transitions dead unit to death mode. */
function killUnit0x6FCFEEE0(
  m: Memory113c,
  pGame: number,
  pDefender: number,
  pAttacker: number,
  bAwardExp: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const effHooks = resolveMeleeDotHooks113c(hooks)
  if (effHooks !== undefined && effHooks.killUnit !== undefined) {
    effHooks.killUnit(m, pGame, pDefender, pAttacker, bAwardExp)
    return
  }
  const def = pDefender >>> 0
  if (def === 0) return
  const defType = m.u32(def) | 0
  if (defType === 1) {
    const curMode = m.u32((def + 0x10) >>> 0) | 0
    if (curMode === 0 || curMode === 0x0c) return
    if (MONSTATS_CheckFlagBit113c(m, m.u32((def + 4) >>> 0) | 0, 0x0f) === 0) return
    SUNITDMG_FreeAttackerCombatList113c(m, def, pGame)
    MONSTER_ClearModeEvents113c(m, pGame, def)
    UNITS_ChangeAnimMode113c(m, def, 0)
    m.setU32((def + 0xc4) >>> 0, (m.u32((def + 0xc4) >>> 0) | 0x10000) >>> 0)
    if (pGame !== 0) {
      const nextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) | 0
      EVENT_SetEventFull113c(m, pGame, def, 1, nextFrame, 0, 0, 0)
    }
  } else if (defType === 0) {
    const curMode = m.u32((def + 0x10) >>> 0) | 0
    if (curMode === 0 || curMode === 0x11) return
    SUNITDMG_FreeAttackerCombatList113c(m, def, pGame)
    MONSTER_ClearModeEvents113c(m, pGame, def)
    UNITS_ChangeAnimMode113c(m, def, 0)
    m.setU32((def + 0xc4) >>> 0, (m.u32((def + 0xc4) >>> 0) | 0x10000) >>> 0)
  }
}

/** Internal `0x6FC97060`: computes monster life percentage `0..0x80` (`(hp>>8) * 128 / (maxHp>>8)`). */
function calcUnitLifePct128_113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0x80
  const hpShr8 = (STATLIST_GetUnitStat113c(m, u, 0x06, 0) | 0) >> 8
  const maxShr8 = (STATLIST_GetMaxLifeFromUnit113c(m, u) | 0) >> 8
  if (maxShr8 <= 0 || hpShr8 >= maxShr8) return 0x80
  return sdiv32(hpShr8 << 7, maxShr8) & 0xff
}

/**
 * Exact internal port of `0x6FCFCF20` (`eax = pDefender`, `[esp+4] = pGame`, `[esp+8] = pAttacker`, `[esp+0xC] = pDamage`),
 * delegating directly to canonical `SUNITDMG_ApplySideEffectsAndKill113c` in `./k2-real-s2c-combat-113c.ts`.
 */
function executePostDamage0x6FCFCF20(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDamage: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const effHooks = resolveMeleeDotHooks113c(hooks)
  if (effHooks !== undefined && effHooks.executePostDamage !== undefined) {
    effHooks.executePostDamage(m, pGame, pAttacker, pDefender, pDamage)
    return
  }
  const dmg = pDamage >>> 0
  let lockedOverlayRotor = false
  if (
    dmg !== 0 &&
    (m.u8((dmg + 0x04) >>> 0) & 0x01) !== 0 &&
    m.u8((dmg + 0x64) >>> 0) === 0 &&
    (m.u32((dmg + 0x60) >>> 0) & 0xf0) === 0 &&
    isDeathOverlayRotorMapped113c(m)
  ) {
    const resolvedHitClass = SUNITDMG_SelectDeathOverlayFlag113c(
      m,
      m.u32((dmg + 0x60) >>> 0) | 0,
      dmg,
      true,
    ) >>> 0
    m.setU32((dmg + 0x60) >>> 0, resolvedHitClass)
    m.setU8((dmg + 0x64) >>> 0, 1)
    lockedOverlayRotor = true
  }
  try {
    SUNITDMG_ApplySideEffectsAndKill113c(
      m,
      pGame,
      pAttacker,
      pDefender,
      pDamage,
      buildMeleeDotCombatHooks(effHooks),
    )
  } finally {
    if (lockedOverlayRotor) {
      m.setU8((dmg + 0x64) >>> 0, 0)
    }
  }
}

/**
 * Dispatches `fpRemove(pUnit, dwStateNo, pOldSubList)` for an unlinked statlist
 * matching `D2Common:0x6FD8A5A7` (`0x6FC58E60`, `0x6FCBF7A0`, `0x6FC70130`, `0x6FC6EB90`, `0x6FC6EBE0`, `0x6FCB8450`).
 */
export function dispatchUnlinkedCurseRemoveProc113c(
  m: Memory113c,
  pTargetUnit: number,
  dwStateNo: number,
  fpRemove: number,
  pOldSubList: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const unit = pTargetUnit >>> 0
  const fn = fpRemove >>> 0
  const sub = pOldSubList >>> 0
  const state = dwStateNo | 0
  if (unit === 0 || fn === 0) return
  if (fn === D2GAME_FP_REMOVE_CLEAR_STATE_GFX_VA_113C) {
    MISSILE_ClearStateGfxRemoveProc113c(m, unit, state, sub)
  } else if (fn === D2GAME_FP_REMOVE_TIMED_STATE_VA_113C) {
    STATES_OnTimedStateRemoved113c(m, unit, state, sub, hooks)
  } else if (fn === 0x6fc70130) {
    STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(m, unit, state, sub)
  } else if (fn === 0x6fc6eb90) {
    SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(m, unit, state, sub)
  } else if (fn === 0x6fc6ebe0) {
    SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(m, unit, state, sub)
  } else if (fn === 0x6fcb8450) {
    STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(
      m as SparseMemory113c,
      unit,
      state,
      sub,
    )
  } else if (hooks !== undefined && hooks.onStatRemoveProc !== undefined) {
    hooks.onStatRemoveProc(m, fn, unit, state, sub)
  }
}

/** Unlinks `pSub` via `STATLIST_UnlinkSubList113c` AND executes `D2Common:0x6FD8A5A7` `fpRemove(pUnit, dwStateNo, pSub)`. */
function unlinkSubListWithRemoveProc113c(
  m: Memory113c,
  pTargetUnit: number,
  pSub: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const s = pSub >>> 0
  if (s === 0) return
  const savedUnit = m.get(s, D2StatListStrc.pUnit) !== 0 ? m.get(s, D2StatListStrc.pUnit) : (pTargetUnit >>> 0)
  const fpRemove = m.get(s, D2StatListStrc.fpRemove)
  const dwStateNo = m.get(s, D2StatListStrc.dwStateNo) | 0
  STATLIST_UnlinkSubList113c(m, pTargetUnit, s)
  dispatchUnlinkedCurseRemoveProc113c(m, savedUnit, dwStateNo, fpRemove, s, hooks)
}

/**
 * `D2Common.#11004` (`0x6FD8AD60` `STATLIST_ExpireOrphanStateSubLists`) invoked by `D2Game:0x6FC95350`
 * (`0x6FC953FB`) on death, dispatching `fpRemove` callbacks (`0x6FC9A6B0` / `0x6FCC07C0`) when freeing
 * non-`exp` state sublists.
 */
export function MONSTER_ExpireDeathStateSubLists113c(
  m: Memory113c,
  pUnit: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pEx = m.u32((u + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return
  let sub = m.u32((pEx + 0x3c) >>> 0)
  while (sub !== 0) {
    let next = m.u32((sub + 0x2c) >>> 0)
    if (m.u32((sub + 0x08) >>> 0) !== 4) {
      const flags = m.u32((sub + 0x10) >>> 0)
      if ((flags & 0x181) === 0) {
        const stateNo = m.u32((sub + 0x14) >>> 0) | 0
        if (STATES_CheckStateMaskExpOnUnit113c(m, u, stateNo) === 0) {
          if ((flags | 0) >= 0) {
            unlinkSubListWithRemoveProc113c(m, u, sub, hooks)
            STATLIST_FreeStatListIfNonExtended113c(m, sub)
          }
          next = m.u32((pEx + 0x3c) >>> 0)
        }
      }
    }
    sub = next
  }
  if (m.u32(0x6fde9e1c) !== 0 && m.u32(0x6fdd90b0) !== 0) {
    STATLIST_ExpireOrphanStateSubLists113c(m, u)
  }
}

// ============================================================================
// 39 Assigned `D2Game.dll` v1.13c Functions (Lane K2-E)
// ============================================================================

/**
 * Looks up `D2MissilesTxt*` (`sgptDataTables->pMissilesTxt + nMissileId * 0x1A4`).
 *
 * @va D2Game:0x6FC21250
 */
export function MISSILES_GetTxtRecordFast113c(m: Memory113c, nMissileId: number): number {
  hitD2GameVa113c(0x6FC21250)
  const eax = nMissileId | 0
  if (eax < 0) return 0
  const ecx = readSgptDataTables113c(m)
  const count = m.u32((ecx + 0xb6c) >>> 0) | 0
  if (eax >= count) return 0
  const base = m.u32((ecx + 0xb64) >>> 0)
  return (base + Math.imul(eax, 0x1a4)) >>> 0
}

/**
 * Steps 64-bit `pSeed` (`0x6AC690C5`) and returns `[nMin .. nMin + nRange - 1]` (or `nMin` if `nRange <= 0`).
 *
 * @va D2Game:0x6FC21480
 */
export function SEED_RollRangeWithMinFast113c(
  m: Memory113c,
  pSeed: number,
  nMin: number,
  nRange: number,
): number {
  hitD2GameVa113c(0x6FC21480)
  const esi = nRange | 0
  const edi = nMin | 0
  if (esi <= 0) return edi
  const newLo = stepSeed64At113c(m, pSeed >>> 0)
  if ((esi & ((esi - 1) | 0)) === 0) {
    return (((newLo & ((esi - 1) >>> 0)) | 0) + edi) | 0
  }
  const rem = (newLo >>> 0) % (esi >>> 0)
  return ((rem | 0) + edi) | 0
}

/**
 * Encodes a variable-width unsigned integer into `pBitStream` (`< 0x100`: `0`+8b; `< 0x10000`: `10`+16b; else `11`+32b).
 *
 * @va D2Game:0x6FC21CD0
 */
export function BITSTREAM_WriteVarUint113c(
  m: Memory113c,
  pBitStream: number,
  dwVal: number,
): void {
  hitD2GameVa113c(0x6FC21CD0)
  const val = dwVal >>> 0
  if (val < 0x100) {
    fogWriteBits113c(m, pBitStream, 0, 1)
    fogWriteBits113c(m, pBitStream, val, 8)
    return
  }
  fogWriteBits113c(m, pBitStream, 1, 1)
  if (val < 0x10000) {
    fogWriteBits113c(m, pBitStream, 0, 1)
    fogWriteBits113c(m, pBitStream, val, 16)
    return
  }
  fogWriteBits113c(m, pBitStream, 1, 1)
  fogWriteBits113c(m, pBitStream, val, 32)
}

/**
 * Returns `STAT_ITEM_MAGICBONUS (0x50)` on `pUnit` (`dwUnitType` `0..1`) plus pack leader's `0x50`.
 *
 * @va D2Game:0x6FC2F2F0
 */
export function ITEMS_GetUnitAndLeaderMagicFind113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC2F2F0)
  const esi = pUnit >>> 0
  if (esi === 0) return 0
  const uType = m.u32(esi) | 0
  if (uType < 0 || uType > 1) return 0
  let mf = STATLIST_GetUnitStatWithLayer113c(m, esi, 0x50, 0) | 0
  const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, esi)
  if (pLeader !== 0) {
    mf = (mf + (STATLIST_GetUnitStatWithLayer113c(m, pLeader, 0x50, 0) | 0)) | 0
  }
  return mf
}

/**
 * Rolls initial `STAT_ARMORCLASS (0x1F)` on `pItem` in `[dwMinAc..dwMaxAc]` (`ItemsTxt` `+0xCC..+0xD0`) using `pItem + 0x20`.
 *
 * @va D2Game:0x6FC2F700
 */
export function ITEMS_RollInitialDurabilityStat113c(m: Memory113c, pItem: number): void {
  hitD2GameVa113c(0x6FC2F700)
  const ebp = pItem >>> 0
  const classId = ebp !== 0 ? m.u32((ebp + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId)
  if (pItemsTxt === 0) {
    throw new D2CommonAssertError('Items.cpp', 0x1c9)
  }
  const ebxMax = m.u32((pItemsTxt + 0xd0) >>> 0) | 0
  const ediMin = m.u32((pItemsTxt + 0xcc) >>> 0) | 0
  const range = (ebxMax - ediMin + 1) | 0
  const rolled = SEED_RollRangeWithMinFast113c(m, (ebp + 0x20) >>> 0, ediMin, range)
  if ((rolled >>> 0) > (ebxMax >>> 0)) {
    throw new D2CommonAssertError('Items.cpp', 0x1ce)
  }
  STATLIST_SetUnitStat113c(m, ebp, 0x1f, rolled, 0)
}

/**
 * Unlinks (or marks `wFlags |= 2` if `wFlags & 1` re-entrant) matching `(nType, nState)` item event nodes from `pUnit + 0x90`.
 *
 * @va D2Game:0x6FC57110
 */
export function ITEMEVENT_RemoveByTypeAndState113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nType: number,
  nState: number,
): void {
  hitD2GameVa113c(0x6FC57110)
  const edi = pUnit >>> 0
  if (edi === 0) return
  let edx = m.u32((edi + 0x90) >>> 0)
  if (edx === 0) return
  const targetType = nType | 0
  const targetState = nState | 0
  while (edx !== 0) {
    const pNext = m.u32((edx + 0x1c) >>> 0)
    if ((m.u32((edx + 0x04) >>> 0) | 0) === targetType && (m.u32((edx + 0x08) >>> 0) | 0) === targetState) {
      const wFlags = m.u16((edx + 0x02) >>> 0)
      if ((wFlags & 0x01) !== 0) {
        m.setU16((edx + 0x02) >>> 0, (wFlags | 0x02) & 0xffff)
      } else {
        const pPrev = m.u32((edx + 0x18) >>> 0)
        if (pPrev !== 0) {
          m.setU32((pPrev + 0x1c) >>> 0, pNext)
        } else {
          m.setU32((edi + 0x90) >>> 0, pNext)
        }
        const curNext = m.u32((edx + 0x1c) >>> 0)
        if (curNext !== 0) {
          m.setU32((curNext + 0x18) >>> 0, pPrev)
        }
        if (pGame !== 0) {
          m.u32((pGame + 0x1c) >>> 0)
        }
        ;(m as { free?: (p: number) => void }).free?.(edx)
      }
    }
    edx = pNext
  }
}

/**
 * `fpRemove` callback (`0x6FC58E60`) clearing graphics state flag `nState` on `pUnit`.
 *
 * @va D2Game:0x6FC58E60
 */
export function MISSILE_ClearStateGfxRemoveProc113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FC58E60)
  STATES_ToggleGfxStateFlag113c(m, pUnit, nState, 0)
}

/**
 * Tests whether `pTarget->dwUnitType` matches `nCollideKillMode` via jump table `0x6FC58FDC` (`0`->`0`, `1`->player, `2`->monster, `>=3`->`1`).
 *
 * @va D2Game:0x6FC58FB0
 */
export function MISSILE_MatchTargetCollideKillMode113c(
  m: Memory113c,
  pTarget: number,
  nCollideKillMode: number,
): number {
  hitD2GameVa113c(0x6FC58FB0)
  const uType = pTarget !== 0 ? m.u32(pTarget >>> 0) | 0 : 6
  const mode = nCollideKillMode >>> 0
  if (mode > 3) return 1
  if (mode === 0) return 0
  if (mode === 1) return uType === 0 ? 1 : 0
  if (mode === 2) return uType === 1 ? 1 : 0
  return 1
}

/**
 * Rolls `[min .. max)` on `(nMinStatId, nMaxStatId)` of `pUnit`, scaled by `nMasteryStatId` (`mulDiv113c(pct, v, 100)`).
 *
 * @va D2Game:0x6FC59B40
 */
export function MISSILE_RollMasteryStatRange113c(
  m: Memory113c,
  nMaxStatId: number,
  nMasteryStatId: number,
  pUnit: number,
  nMinStatId: number,
): number {
  hitD2GameVa113c(0x6FC59B40)
  const ebp = pUnit >>> 0
  let esiMax = STATLIST_GetUnitStat113c(m, ebp, nMaxStatId | 0, 0) | 0
  if (esiMax <= 0) return 0
  let ediMin = STATLIST_GetUnitStat113c(m, ebp, nMinStatId | 0, 0) | 0
  if (ediMin <= 0) return 0
  if (ediMin > esiMax) {
    const tmp = ediMin
    ediMin = esiMax
    esiMax = tmp
  }
  const masteryId = nMasteryStatId | 0
  if (masteryId !== -1) {
    const pct = STATLIST_GetUnitStat113c(m, ebp, masteryId, 0) | 0
    if (pct !== 0) {
      ediMin = (ediMin + mulDiv113c(pct, ediMin, 100)) | 0
      esiMax = (esiMax + mulDiv113c(pct, esiMax, 100)) | 0
    }
  }
  const rolled = SEED_RollLimitedFast113c(m, (ebp + 0x20) >>> 0, (esiMax - ediMin) | 0) | 0
  return (rolled + ediMin) | 0
}

/**
 * Populates a `0x70`-byte `D2DamageStrc` at `pDamageOut` from `pMissile`'s statlist against `pDefender`.
 *
 * @va D2Game:0x6FC5A4E0
 */
export function MISSILE_BuildDamageStrcFromStats113c(
  m: Memory113c,
  pMissile: number,
  pDefender: number,
  pDamageOut: number,
): void {
  hitD2GameVa113c(0x6FC5A4E0)
  const ebx = pMissile >>> 0
  const def = pDefender >>> 0
  const ebp = pDamageOut >>> 0

  for (let off = 0; off < 0x70; off += 4) {
    m.setU32((ebp + off) >>> 0, 0)
  }

  let phys = 0
  let maxPhys = STATLIST_GetUnitStat113c(m, ebx, 0x16, 0) | 0
  if (maxPhys > 0) {
    let minPhys = STATLIST_GetUnitStat113c(m, ebx, 0x15, 0) | 0
    if (minPhys > 0) {
      if (minPhys > maxPhys) {
        const tmp = minPhys
        minPhys = maxPhys
        maxPhys = tmp
      }
      phys = ((SEED_RollLimitedFast113c(m, (ebx + 0x20) >>> 0, (maxPhys - minPhys) | 0) | 0) + minPhys) | 0
    }
  }
  m.setU32((ebp + 0x08) >>> 0, phys >>> 0)

  m.setU32((ebp + 0x10) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x31, 0x149, ebx, 0x30) >>> 0)
  m.setU32((ebp + 0x20) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x35, 0x165, ebx, 0x34) >>> 0)
  m.setU32((ebp + 0x1c) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x33, 0x14a, ebx, 0x32) >>> 0)
  m.setU32((ebp + 0x24) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x37, 0x14b, ebx, 0x36) >>> 0)
  m.setU32((ebp + 0x30) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x38, 0) >>> 0)
  m.setU32((ebp + 0x28) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x3a, 0x14c, ebx, 0x39) >>> 0)

  let poisLen = STATLIST_GetUnitStat113c(m, ebx, 0x3b, 0) | 0
  m.setU32((ebp + 0x2c) >>> 0, poisLen >>> 0)
  const poisCount = STATLIST_GetUnitStat113c(m, ebx, 0x146, 0) | 0
  if (poisCount > 1) {
    poisLen = sdiv32(poisLen, poisCount)
    m.setU32((ebp + 0x2c) >>> 0, poisLen >>> 0)
  }

  m.setU32((ebp + 0x3c) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x3e, 0) >>> 0)
  m.setU32((ebp + 0x38) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x3c, 0) >>> 0)
  m.setU32((ebp + 0x40) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x40, 0) >>> 0)
  m.setU32((ebp + 0x14) >>> 0, MISSILE_RollMasteryStatRange113c(m, 0x13d, 0x149, ebx, 0x13c) >>> 0)
  m.setU32((ebp + 0x18) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x13b, 0) >>> 0)
  m.setU32((ebp + 0x44) >>> 0, STATLIST_GetUnitStat113c(m, ebx, 0x42, 0) >>> 0)

  if (def !== 0) {
    let pct = STATLIST_GetUnitStat113c(m, ebx, 0x19, 0) | 0
    if (MONSTER_CheckMonTypeFlag0x20_113c(m, def) !== 0) {
      pct = (pct + (STATLIST_GetUnitStat113c(m, ebx, 0x79, 0) | 0)) | 0
    }
    if (MONSTERS_IsDemonOrUndead113c(m, def) !== 0) {
      pct = (pct + (STATLIST_GetUnitStat113c(m, ebx, 0x7a, 0) | 0)) | 0
    }
    if (m.u32(def) === 1) {
      const classId = m.u32((def + 0x04) >>> 0) | 0
      if (classId >= 0) {
        const pTables = readSgptDataTables113c(m)
        const nMonCount = m.u32((pTables + 0xa80) >>> 0) | 0
        if (classId < nMonCount) {
          const pMonBase = m.u32((pTables + 0xa78) >>> 0)
          const pMonRec = (pMonBase + Math.imul(classId, 0x1a8)) >>> 0
          if (pMonRec !== 0) {
            const monType = s16SignExt113c(m.u16((pMonRec + 0x1c) >>> 0))
            if (monType > 0) {
              const pExtScratch = allocStackScratch113c(m, 0x400)
              try {
                const cnt = STATLIST_GetExtendedUnitStatsById113c(m, ebx, 0xb4, pExtScratch, 0x80) | 0
                for (let i = 0; i < cnt; i++) {
                  const param = m.u16((pExtScratch + i * 8) >>> 0)
                  if (checkMonTypeSubFlag0x6FC21620(m, monType, param) !== 0) {
                    pct = (pct + (m.u32((pExtScratch + i * 8 + 4) >>> 0) | 0)) | 0
                  }
                }
              } finally {
                freeStackScratch113c(0x400)
              }
            }
          }
        }
      }
    }
    if (pct <= -90) pct = -90
    const basePhys = m.u32((ebp + 0x08) >>> 0) | 0
    const bonusPhys = divBy100Magic113c(Math.imul(basePhys, pct))
    m.setU32((ebp + 0x08) >>> 0, ((basePhys + bonusPhys) | 0) >>> 0)
  }

  if ((STATLIST_GetUnitStat113c(m, ebx, 0x8d, 0) | 0) !== 0) {
    const curPhys = m.u32((ebp + 0x08) >>> 0)
    m.setU8((ebp + 0x05) >>> 0, (m.u8((ebp + 0x05) >>> 0) | 0x20) & 0xff)
    m.setU32((ebp + 0x08) >>> 0, (curPhys << 1) >>> 0)
  }
  if ((STATLIST_GetUnitStat113c(m, ebx, 0x67, 0) | 0) !== 0) {
    m.setU32(ebp, (m.u32(ebp) | 0x100) >>> 0)
  }
  if ((STATLIST_GetUnitStat113c(m, ebx, 0x68, 0) | 0) !== 0) {
    m.setU32(ebp, (m.u32(ebp) | 0x200) >>> 0)
  }
  if ((STATLIST_GetUnitStat113c(m, ebx, 0x6a, 0) | 0) !== 0) {
    m.setU32(ebp, (m.u32(ebp) | 0x400) >>> 0)
  }
}

/**
 * Checks whether `pMissile` can collide with `pTarget` (targetable flags, NextDelay `0x56`, self-owner, hostility / `bCanHitFriendly`).
 *
 * @va D2Game:0x6FC5AA20
 */
export function MISSILE_CanCollideWithUnit113c(
  m: Memory113c,
  pTarget: number,
  pOwner: number,
  pMissilesTxt: number,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC5AA20)
  const esi = pTarget >>> 0
  if (esi === 0) return 0
  const flags = m.u32((esi + 0xc4) >>> 0)
  if (((flags >>> 3) & 1) === 0) return 0
  if (((flags >>> 2) & 1) === 0) return 0
  const ebx = pMissilesTxt >>> 0
  if (m.u8((ebx + 0x188) >>> 0) !== 0) {
    if (STATES_CheckState113c(m, esi, 0x56) !== 0) return 0
  }
  if (MISSILE_IsOwnedByUnit113c(m, pMissile, esi) !== 0) return 0
  const edi = pOwner >>> 0
  if (edi === 0) return 1
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, edi, esi, pGame) !== 0) return 1
  return m.u8((ebx + 0x187) >>> 0) !== 0 ? 1 : 0
}

/**
 * `COLLISION_FindAdjacentUnitWithCallback` filter (`0x6FC5AD30`) for `nCollideType == 3` (players `0` and monsters `1`).
 *
 * @va D2Game:0x6FC5AD30
 */
export function MISSILE_CollideFilterPlayerOrMonster113c(
  m: Memory113c,
  pUnit: number,
  pCtx: number,
): number {
  hitD2GameVa113c(0x6FC5AD30)
  const edx = pCtx >>> 0
  const ecx = pUnit >>> 0
  if (edx === 0) return 0
  const ebxMisTxt = m.u32((edx + 0x0c) >>> 0)
  if (ebxMisTxt === 0 || ecx === 0) return 0
  const uType = m.u32(ecx) | 0
  if (uType < 0 || uType > 1) return 0
  const pMissile = m.u32((edx + 0x04) >>> 0)
  const ediOwner = m.u32((edx + 0x08) >>> 0)
  const pGame = m.u32(edx)
  return MISSILE_CanCollideWithUnit113c(m, ecx, ediOwner, ebxMisTxt, pGame, pMissile) !== 0 ? 1 : 0
}

/**
 * Applies `pDamage` from `pMissile` onto `pDefender` (block/dodge, hitClass, monster crit, stream flags, pierce resist, damage & post-damage).
 *
 * @va D2Game:0x6FC5AE10
 */
export function MISSILE_ApplyDamageStrcToTarget113c(
  m: Memory113c,
  pDamage: number,
  pGame: number,
  pMissile: number,
  pDefender: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC5AE10)
  const ebp = pMissile >>> 0
  if (ebp === 0 || m.u32(ebp) !== 3) return
  if (((m.u32((ebp + 0xc8) >>> 0) >>> 10) & 1) === 0) return

  const esiGame = pGame >>> 0
  const pOwner = SUNIT_GetServerUnit113c(
    m,
    esiGame,
    m.u32((ebp + 0x94) >>> 0),
    m.u32((ebp + 0x98) >>> 0),
  )
  if (pOwner === 0) return

  const ebxMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((ebp + 0x04) >>> 0) | 0)
  if (ebxMisTxt === 0) return

  const edi = pDamage >>> 0
  const def = pDefender >>> 0
  m.setU8((edi + 0x04) >>> 0, (m.u8((edi + 0x04) >>> 0) | 0x01) & 0xff)

  if (STATES_CheckState113c(m, def, 0x36) === 0) {
    const flags04 = m.u8((ebxMisTxt + 0x04) >>> 0)
    if ((readGdwBitMaskU32_113c(m, 6) & flags04) !== 0) {
      m.setU8((edi + 0x04) >>> 0, (m.u8((edi + 0x04) >>> 0) | 0x04) & 0xff)
    } else if ((readGdwBitMaskU32_113c(m, 7) & flags04) !== 0) {
      m.setU8((edi + 0x05) >>> 0, (m.u8((edi + 0x05) >>> 0) | 0x40) & 0xff)
    }
    const kbChance = m.u8((ebxMisTxt + 0xae) >>> 0)
    if (kbChance > 0) {
      const seedObj: D2SeedStrc = {
        lo: m.u32((ebp + 0x20) >>> 0),
        hi: m.u32((ebp + 0x24) >>> 0),
      }
      const roll = seedRoll(seedObj, 100)
      m.setU32((ebp + 0x20) >>> 0, seedObj.lo >>> 0)
      m.setU32((ebp + 0x24) >>> 0, seedObj.hi >>> 0)
      if ((roll | 0) < kbChance) {
        m.setU8((edi + 0x04) >>> 0, (m.u8((edi + 0x04) >>> 0) | 0x08) & 0xff)
      }
    }
  }

  const hasPhys = m.u32((edi + 0x08) >>> 0) !== 0 ? 1 : 0
  let blockMask = rollBlock0x6FCFB790(m, pOwner, def, hasPhys, esiGame, 1, hooks) | 0
  if ((blockMask & 0x1f) !== 0) {
    const dl = m.u8((ebxMisTxt + 0x04) >>> 0)
    if (
      (readGdwBitMaskU8_113c(m, 0x18) & dl) === 0 &&
      m.u8((ebxMisTxt + 0xae) >>> 0) === 0
    ) {
      const w = ((m.u16((edi + 0x04) >>> 0) & 0xfffe) | 0x4000) & 0xffff
      m.setU16((edi + 0x04) >>> 0, w)
      blockMask = (blockMask & ~0x1f) | 0
    }
  }
  if ((blockMask & 0x08) !== 0) {
    m.setU8((edi + 0x05) >>> 0, (m.u8((edi + 0x05) >>> 0) | 0x02) & 0xff)
  }
  if ((blockMask & 0x02) !== 0) {
    m.setU8((edi + 0x05) >>> 0, (m.u8((edi + 0x05) >>> 0) | 0x01) & 0xff)
  }
  if ((blockMask & 0x11) !== 0) {
    m.setU8((edi + 0x04) >>> 0, (m.u8((edi + 0x04) >>> 0) | 0x10) & 0xff)
  }
  if (blockMask !== 0) {
    m.setU8((edi + 0x04) >>> 0, m.u8((edi + 0x04) >>> 0) & 0xfe)
  }

  const misHitClass = MISSILE_GetActivateFrameFromUnit113c(m, ebp) >>> 0
  const mergedHitClass = (misHitClass | (m.u32((edi + 0x60) >>> 0) & 0xf0)) >>> 0
  m.setU32((edi + 0x60) >>> 0, mergedHitClass)
  if ((mergedHitClass & 0xf0) !== 0) {
    m.setU8((edi + 0x64) >>> 0, 1)
  }

  MONSTER_ApplyCritDamage113c(m, pOwner, edi, def)

  if ((MISSILE_GetStreamFlags113c(m, ebp) & 0x01) !== 0) {
    m.setU32(edi, (m.u32(edi) | 0x20) >>> 0)
  }
  if ((MISSILE_GetStreamFlags113c(m, ebp) & 0x02) !== 0) {
    m.setU32(edi, (m.u32(edi) | 0x80) >>> 0)
  }

  const piercePct = STATLIST_GetUnitStat113c(m, ebp, 0x147, 0) >>> 0
  m.setU32((edi + 0x54) >>> 0, piercePct)

  if ((m.u8((edi + 0x04) >>> 0) & 0x01) !== 0) {
    applyDamage0x6FCFE0C0(m, esiGame, pOwner, def, 1, edi, hooks)
  }
  executePostDamage0x6FCFCF20(m, esiGame, pOwner, def, edi, hooks)
}

/**
 * Applies `MISSILE_ApplyDamageStrcToTarget113c` and applies `STAT_ITEM_DAMAGETARGETAC (0x78)` flat AC shred on non-hireling monsters.
 *
 * @va D2Game:0x6FC5AFF0
 */
export function MISSILE_ApplyDamageAndArmorShred113c(
  m: Memory113c,
  pGame: number,
  pDamage: number,
  pMissile: number,
  pDefender: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC5AFF0)
  MISSILE_ApplyDamageStrcToTarget113c(m, pDamage, pGame, pMissile, pDefender, hooks)
  const esi = pDefender >>> 0
  if (esi === 0 || m.u32(esi) !== 1) return
  if (MONSTERS_GetHirelingTypeId113c(m, esi) !== 0) return
  const shred = STATLIST_GetUnitStat113c(m, pMissile, 0x78, 0) | 0
  if (shred === 0) return
  let nextAc = ((STATLIST_GetUnitStat113c(m, esi, 0x1f, 0) | 0) + shred) | 0
  if (nextAc < 0) nextAc = 0
  STATLIST_SetUnitStat113c(m, esi, 0x1f, nextAc, 0)
}

// Exact PE32 v1.13c missile dispatch tables in `D2Game.dll` `.data`:
// `0x6FD2D970` (count `[0x6FD2DA44] = 53`), `0x6FD2DA48` (count `[0x6FD2DB64] = 71`), `0x6FD2DB68` (count `[0x6FD2DBE4] = 31`).
const DEFAULT_MISSILE_SRVDO_TABLE_6FD2D970: readonly number[] = [
  0, 0x6fc5f540, 0x6fc61b80, 0x6fc61ae0, 0, 0x6fc61980, 0x6fc61850, 0x6fc61710,
  0x6fc61670, 0x6fc61520, 0x6fc613d0, 0x6fc61240, 0x6fc61110, 0x6fc60eb0, 0x6fc60e10, 0x6fc60ca0,
  0x6fc60bd0, 0x6fc60b20, 0x6fc608d0, 0x6fc5f6d0, 0x6fc60860, 0x6fc61eb0, 0x6fc606d0, 0x6fc605e0,
  0x6fc605e0, 0x6fc604d0, 0x6fc60420, 0x6fc60280, 0x6fc60070, 0x6fc5fed0, 0x6fc5fb40, 0x6fc5f9f0,
  0x6fc61de0, 0x6fc5fd30, 0x6fc61c30, 0x6fc5f890, 0x6fc5f670, 0x6fc5f550, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
]

const DEFAULT_MISSILE_SRVHIT_TABLE_6FD2DA48: readonly number[] = [
  0, 0x6fc5b990, 0x6fc5e330, 0x6fc5bb60, 0x6fc5f220, 0x6fc5c700, 0x6fc5bd10, 0x6fc59fd0,
  0x6fc59f70, 0x6fc5e0b0, 0x6fc5b140, 0x6fc5f120, 0x6fc5d020, 0x6fc5b3e0, 0x6fc5def0, 0x6fc5cdd0,
  0x6fc5ec10, 0x6fc5eae0, 0x6fc5ea60, 0x6fc5e8a0, 0x6fc5dd60, 0x6fc5abd0, 0x6fc5db30, 0x6fc59da0,
  0x6fc5b7c0, 0x6fc5da60, 0x6fc5c990, 0x6fc58ec0, 0x6fc5e740, 0x6fc5c850, 0, 0x6fc5a920,
  0x6fc5be70, 0x6fc58ea0, 0, 0x6fc5e670, 0x6fc5ab30, 0x6fc58e90, 0x6fc5c5b0, 0x6fc5bc00,
  0x6fc5c490, 0, 0, 0x6fc59e30, 0x6fc5b5f0, 0x6fc5c3b0, 0, 0x6fc5d8c0,
  0x6fc5c260, 0, 0x6fc591a0, 0x6fc5c160, 0x6fc5c030, 0x6fc5f7d0, 0x6fc5bc80, 0x6fc596e0,
  0x6fc5b210, 0x6fc5bbb0, 0x6fc5bed0, 0x6fc5d800, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
]

const DEFAULT_MISSILE_SRVDMG_TABLE_6FD2DB68: readonly number[] = [
  0, 0x6fc59ce0, 0x6fc59080, 0x6fc59670, 0x6fc58e70, 0x6fc5a790, 0x6fc59c80, 0x6fc59600,
  0x6fc58ff0, 0x6fc59560, 0x6fc59040, 0x6fc59bd0, 0x6fc5a850, 0x6fc5aaa0, 0x6fc59a40, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
]

function tryReadStaticU32_113c(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

function resolveMissileTableFnVa113c(
  m: Memory113c,
  tableBase: number,
  defaults: readonly number[],
  idx: number,
): number {
  const inMem = tryReadStaticU32_113c(m, (tableBase + idx * 4) >>> 0)
  if (inMem !== 0) return inMem
  return idx >= 0 && idx < defaults.length ? defaults[idx]! >>> 0 : 0
}

/**
 * Per-frame server missile tick (`0x6FC5E3F0`): enforces town-kill rules, dispatches `MissilesTxt.wSrvDoFunc`, and frees `pMissile` on result `2`.
 *
 * @va D2Game:0x6FC5E3F0
 */
export function MISSILE_DispatchFrameTick113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC5E3F0)
  const esi = pMissile >>> 0
  if (esi === 0) return
  const ebpMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((esi + 0x04) >>> 0) | 0)
  if (ebpMisTxt === 0) return

  const wSrvDoFunc = s16SignExt113c(m.u16((ebpMisTxt + 0x0c) >>> 0))
  const srvDoLimit = tryReadStaticU32_113c(m, 0x6fd2da44) | 0
  const maxSrvDo = srvDoLimit > 0 ? srvDoLimit : 53
  if (wSrvDoFunc <= 0 || wSrvDoFunc >= maxSrvDo) return

  let ebxRoom = UNITS_GetRoom113c(m, esi)
  if (ebxRoom === 0) {
    const posY = UNIT_GetPosY113c(m, esi)
    const posX = UNIT_GetPosX113c(m, esi)
    ebxRoom = ROOM_FindRoomContainingSubtile113c(m, 0, posX, posY)
  }

  const ediGame = pGame >>> 0
  const pOwner = SUNIT_GetOwnerUnit113c(m, esi, ediGame)
  const flags05 = m.u8((ebpMisTxt + 0x05) >>> 0)

  if ((flags05 & readGdwBitMaskU8_113c(m, 0x0c)) !== 0) {
    if (pOwner !== 0) {
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwner)
      if (pOwnerRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pOwnerRoom) !== 0) {
        SUNIT_FreeUnit113c(m, ediGame, esi)
        return
      }
    }
  }

  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    const pOwnerRoom = UNITS_GetRoom113c(m, pOwner)
    if (pOwnerRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pOwnerRoom) !== 0) {
      SUNIT_FreeUnit113c(m, ediGame, esi)
      return
    }
  }

  if ((flags05 & readGdwBitMaskU8_113c(m, 0x08)) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, ebxRoom) !== 0) {
      SUNIT_FreeUnit113c(m, ediGame, esi)
      return
    }
  }

  let doRes = 1
  const effHooks = resolveMeleeDotHooks113c(hooks)
  const fnVa = resolveMissileTableFnVa113c(m, 0x6fd2d970, DEFAULT_MISSILE_SRVDO_TABLE_6FD2D970, wSrvDoFunc)
  if (effHooks !== undefined && effHooks.srvDoMissile !== undefined) {
    doRes = withScopedMeleeDotHooks113c(effHooks, () =>
      effHooks.srvDoMissile!(m, wSrvDoFunc, fnVa, ediGame, esi),
    ) | 0
  } else if (fnVa === 0x6fc5f540) {
    doRes = MISSILE_SrvDo01_FastcallThunk113c(m, ediGame, esi, effHooks) | 0
  }

  if (doRes === 2) {
    SUNIT_FreeUnit113c(m, ediGame, esi)
  }
}

/**
 * Attaches `STATE_JUSTHIT (0x56)` NextDelay timed sub-statlist (`+0x189` frames, `fpRemove = 0x6FC58E60`) and schedules `Event 0x0C`.
 *
 * @va D2Game:0x6FC5E590
 */
export function MISSILE_ApplyNextHitDelayState113c(
  m: Memory113c,
  pMissile: number,
  pDefender: number,
): void {
  hitD2GameVa113c(0x6FC5E590)
  const ecx = pMissile >>> 0
  const ebp = pDefender >>> 0
  const pMisTxt = ecx !== 0 ? MISSILES_GetTxtRecordFast113c(m, m.u32((ecx + 0x04) >>> 0) | 0) : 0
  if (pMisTxt === 0) return
  if (m.u8((pMisTxt + 0x188) >>> 0) === 0 || ebp === 0) return
  if (ecx === 0) {
    throw new D2CommonAssertError('Missiles.cpp', 0xa2a)
  }

  const delayFrames = m.u8((pMisTxt + 0x189) >>> 0)
  const ebxGame = m.u32((ecx + 0x80) >>> 0)
  const expireFrame = ((m.u32((ebxGame + 0xa8) >>> 0) | 0) + delayFrames) | 0
  const ownerId = m.u32((ebp + 0x0c) >>> 0)
  const ownerType = m.u32(ebp)
  const pPool = m.u32((ebxGame + 0x1c) >>> 0)

  const ediList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame)
  if (ediList === 0) return
  m.setU32(ediList, pPool)

  EVENT_SetEventFull113c(m, ebxGame, ebp, 0x0c, expireFrame, 0, 0, 0)
  STATLIST_SetState113c(m, ediList, 0x56)
  STATLIST_SetStatRemoveProc113c(m, ediList, D2GAME_FP_REMOVE_CLEAR_STATE_GFX_VA_113C)
  STATLIST_MergeStatLists113c(m, ebp, ediList, 1)
  STATES_ToggleGfxStateFlag113c(m, ebp, 0x56, 1)
}

/**
 * Resolves missile collision / impact against `pTarget` (or wall/expiry when `pTarget == 0`); returns `1` (keep alive) or `2` (destroy).
 *
 * @va D2Game:0x6FC5EDE0
 */
export function MISSILE_ProcessTargetCollisionHit113c(
  m: Memory113c,
  pMissile: number,
  pGame: number,
  pTarget: number,
  bForceDestroy: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC5EDE0)
  const edi = pMissile >>> 0
  const g = pGame >>> 0
  const ebp = pTarget >>> 0
  const pMisTxt = edi !== 0 ? MISSILES_GetTxtRecordFast113c(m, m.u32((edi + 0x04) >>> 0) | 0) : 0
  if (pMisTxt === 0) return 2

  let pOwner = 0
  if (edi !== 0 && ((m.u32((edi + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner = SUNIT_GetServerUnit113c(m, g, m.u32((edi + 0x94) >>> 0), m.u32((edi + 0x98) >>> 0))
  }

  let hitFlags = (readGdwBitMaskU8_113c(m, 0x04) & m.u8((pMisTxt + 0x04) >>> 0)) !== 0 ? 0 : 2
  let pierceFlags = 3

  if (ebp !== 0) {
    if (m.u8((pMisTxt + 0x188) >>> 0) !== 0 && STATES_CheckState113c(m, ebp, 0x56) !== 0) {
      return 1
    }
    if (MISSILE_IsOwnedByUnit113c(m, edi, ebp) !== 0) {
      return 1
    }
    MISSILE_SetOwner113c(m, edi, ebp)
    const colMode = edi !== 0 ? m.u32((edi + 0x10) >>> 0) : 0
    if (MISSILE_MatchTargetCollideKillMode113c(m, ebp, colMode) === 0) {
      return 1
    }
    if (pOwner !== 0) {
      if (
        SUNIT_AreUnitsHostileOrUnaligned113c(m, pOwner, ebp, g) === 0 &&
        m.u8((pMisTxt + 0x187) >>> 0) === 0
      ) {
        return 1
      }
    }
  }

  if (pOwner !== 0 && ebp !== 0) {
    if ((readGdwBitMaskU8_113c(m, 0x08) & m.u8((pMisTxt + 0x04) >>> 0)) !== 0) {
      if (
        (STATLIST_GetUnitStat113c(m, pOwner, 0xa6, 0) | 0) !== 0 ||
        (STATLIST_GetUnitStatWithLayer113c(m, pOwner, 0x9c, 0) | 0) !== 0
      ) {
        pierceFlags = consumeMissilePierce0x6FC58F40(m, edi)
      }
    }
  }

  if (m.u8((pMisTxt + 0x186) >>> 0) !== 0) {
    hitFlags |= 1
  }

  let runHitAndDmg = true
  const effHooks = resolveMeleeDotHooks113c(hooks)
  if (ebp !== 0) {
    if (m.u8((pMisTxt + 0x18b) >>> 0) !== 0) {
      const arBonus = edi !== 0 ? STATLIST_GetUnitStat113c(m, edi, 0x13, 0) | 0 : 0
      if (checkToHit0x6FCFDE90(m, pOwner, ebp, arBonus, 1, effHooks) === 0) {
        MISSILE_ApplyNextHitDelayState113c(m, edi, ebp)
        SUNIT_DispatchItemEventCallbacks113c(m, ebp, g, 0, edi, 0)
        if (m.u8((pMisTxt + 0x18c) >>> 0) !== 0) {
          const wSrvHit = s16SignExt113c(m.u16((pMisTxt + 0x0e) >>> 0))
          const hitLimit = tryReadStaticU32_113c(m, 0x6fd2db64) | 0
          const maxSrvHit = hitLimit > 0 ? hitLimit : 71
          if (wSrvHit > 0 && wSrvHit < maxSrvHit && effHooks !== undefined && effHooks.srvHitMissile !== undefined) {
            const hitFnVa = resolveMissileTableFnVa113c(
              m,
              0x6fd2da48,
              DEFAULT_MISSILE_SRVHIT_TABLE_6FD2DA48,
              wSrvHit,
            )
            const hRes = effHooks.srvHitMissile(m, wSrvHit, hitFnVa, g, edi, ebp) | 0
            if ((hRes & 0x04) !== 0) return 1
          }
        }
        return 2
      }
    }
  } else if (bForceDestroy === 0 && m.u8((pMisTxt + 0x18c) >>> 0) === 0) {
    runHitAndDmg = false
  }

  if (runHitAndDmg) {
    if ((pierceFlags & 0x02) !== 0) {
      MISSILE_ApplyNextHitDelayState113c(m, edi, ebp)
      SUNIT_DispatchItemEventCallbacks113c(m, ebp, g, 0, edi, 0)
      const wSrvHit = s16SignExt113c(m.u16((pMisTxt + 0x0e) >>> 0))
      const hitLimit = tryReadStaticU32_113c(m, 0x6fd2db64) | 0
      const maxSrvHit = hitLimit > 0 ? hitLimit : 71
      if (wSrvHit > 0 && wSrvHit < maxSrvHit && effHooks !== undefined && effHooks.srvHitMissile !== undefined) {
        const hitFnVa = resolveMissileTableFnVa113c(
          m,
          0x6fd2da48,
          DEFAULT_MISSILE_SRVHIT_TABLE_6FD2DA48,
          wSrvHit,
        )
        hitFlags = effHooks.srvHitMissile(m, wSrvHit, hitFnVa, g, edi, ebp) | 0
        if ((hitFlags & 0x04) !== 0) return 1
      }
    }

    if (ebp !== 0 && (hitFlags & 0x02) !== 0) {
      const pDmgScratch = allocStackScratch113c(m, 0x70)
      try {
        MISSILE_BuildDamageStrcFromStats113c(m, edi, ebp, pDmgScratch)
        const wSrvDmg = s16SignExt113c(m.u16((pMisTxt + 0x10) >>> 0))
        const dmgLimit = tryReadStaticU32_113c(m, 0x6fd2dbe4) | 0
        const maxSrvDmg = dmgLimit > 0 ? dmgLimit : 31
        if (wSrvDmg > 0 && wSrvDmg < maxSrvDmg && effHooks !== undefined && effHooks.srvDmgMissile !== undefined) {
          const dmgFnVa = resolveMissileTableFnVa113c(
            m,
            0x6fd2db68,
            DEFAULT_MISSILE_SRVDMG_TABLE_6FD2DB68,
            wSrvDmg,
          )
          effHooks.srvDmgMissile(m, wSrvDmg, dmgFnVa, g, edi, ebp, pDmgScratch)
        }
        MISSILE_ApplyDamageAndArmorShred113c(m, g, pDmgScratch, edi, ebp, effHooks)
      } finally {
        freeStackScratch113c(0x70)
      }
    }
  }

  if ((hitFlags & 0x01) === 0 && bForceDestroy === 0) {
    return 1
  }
  if ((pierceFlags & 0x01) === 0) {
    return 1
  }

  const pRoom = UNITS_GetRoom113c(m, edi)
  if (pRoom !== 0) {
    const sizeX = UNITS_GetUnitSizeX113c(m, edi)
    const posY = UNIT_GetPosY113c(m, edi)
    const posX = UNIT_GetPosX113c(m, edi)
    COLLISION_ResetMaskWithPatternSimple113c(m, pRoom, posX, posY, sizeX, 0x40)
  }
  return 2
}

/**
 * `SrvDoFunc 1` (`0x6FC5F320`): advances linear missile path, decrements remaining frames, and scans saved path steps for unit/wall collision.
 *
 * @va D2Game:0x6FC5F320
 */
export function MISSILE_SrvDo01_LinearProjectile113c(
  m: Memory113c,
  pMissile: number,
  pGame: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC5F320)
  const effHooks = resolveMeleeDotHooks113c(hooks)
  const ebx = pMissile >>> 0
  const ediGame = pGame >>> 0
  const pMisTxt = ebx !== 0 ? MISSILES_GetTxtRecordFast113c(m, m.u32((ebx + 0x04) >>> 0) | 0) : 0
  if (pMisTxt === 0) {
    return MISSILE_ProcessTargetCollisionHit113c(m, ebx, ediGame, 0, 1, effHooks)
  }

  const pPath0 = m.u32((ebx + 0x2c) >>> 0)
  if (PATH_GetVelocity113c(m, pPath0) !== 0) {
    if (stepMissilePath0x6FD01930(m, ediGame, ebx, effHooks) === 2) {
      return MISSILE_ProcessTargetCollisionHit113c(m, ebx, ediGame, 0, 1, effHooks)
    }
  }

  const remFrames = (MISSILE_GetRemainingFrames113c(m, ebx) - 1) | 0
  MISSILE_SetRemainingFrames113c(m, ebx, remFrames)
  if (remFrames <= 0) {
    return MISSILE_ProcessTargetCollisionHit113c(m, ebx, ediGame, 0, 1, effHooks)
  }

  const colMode = m.u32((ebx + 0x10) >>> 0) | 0
  if (colMode === 0) return 1

  const pRoom = UNITS_GetRoom113c(m, ebx)
  const pPath = m.u32((ebx + 0x2c) >>> 0)
  if (pRoom === 0 || pPath === 0) return 2

  const lastColMask = PATH_GetOrCheckLastCollisionMask113c(m, pPath) >>> 0
  if ((lastColMask & 0x05) !== 0) return 2
  if (colMode === 6) return 1

  const actFrame = MISSILE_GetActivateFrame113c(m, ebx) | 0
  if ((MISSILE_GetRemainingFrames113c(m, ebx) | 0) > actFrame) return 1
  if ((lastColMask & 0xffff) === 0) return 1

  const modeEntry = colMode >= 0 && colMode < 9 ? D2GAME_MISSILE_COLLIDE_MODES_113C[colMode]! : { pfn: 0, mask: 0 }
  if (modeEntry.pfn === 0) return 2

  const pOwner = SUNIT_GetOwnerUnit113c(m, ebx, ediGame)
  const sizeX = UNITS_GetUnitSizeX113c(m, ebx)

  const pScratch = allocStackScratch113c(m, 0x20)
  try {
    const ppSavedSteps = pScratch
    const pCtx = (pScratch + 0x08) >>> 0
    m.setU32(pCtx, ediGame)
    m.setU32((pCtx + 0x04) >>> 0, ebx)
    m.setU32((pCtx + 0x08) >>> 0, pOwner >>> 0)
    m.setU32((pCtx + 0x0c) >>> 0, pMisTxt >>> 0)

    const nSteps = PATH_GetSavedSteps113c(m, pPath, ppSavedSteps) | 0
    if (nSteps <= 0) return 1
    const pStepsArr = m.u32(ppSavedSteps)

    const filterCb =
      modeEntry.pfn === 0x6fc5ad30
        ? MISSILE_CollideFilterPlayerOrMonster113c
        : modeEntry.pfn === 0x6fc5add0
          ? collideFilterMode2_0x6FC5ADD0
          : modeEntry.pfn === 0x6fc5ad70
            ? collideFilterMode1_0x6FC5AD70
            : collideFilterMode7_0x6FC59510

    for (let i = 0; i < nSteps; i++) {
      const stepX = m.u16((pStepsArr + i * 4) >>> 0)
      const stepY = m.u16((pStepsArr + i * 4 + 2) >>> 0)
      const hitMask = COLLISION_CheckMaskWithPattern1_113c(m, pRoom, stepX, stepY, sizeX, modeEntry.mask)
      if ((hitMask & 0xffff) !== 0) {
        const pHitUnit = COLLISION_FindAdjacentUnitWithCallback113c(
          m,
          pRoom,
          stepX,
          stepY,
          modeEntry.pfn,
          pCtx,
          sizeX,
          filterCb,
        )
        if (pHitUnit !== 0) {
          return MISSILE_ProcessTargetCollisionHit113c(m, ebx, ediGame, pHitUnit, 0, effHooks)
        }
        if ((hitMask & 0x04) !== 0) {
          MISSILE_ProcessTargetCollisionHit113c(m, ebx, ediGame, 0, 1, effHooks)
          return 2
        }
      }
    }
  } finally {
    freeStackScratch113c(0x20)
  }
  return 1
}

/**
 * `__fastcall(pGame, pMissile)` dispatch thunk (`0x6FC5F540`) in `0x6FD2D970[1]` forwarding to `0x6FC5F320`.
 *
 * @va D2Game:0x6FC5F540
 */
export function MISSILE_SrvDo01_FastcallThunk113c(
  m: Memory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC5F540)
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks)
}

/**
 * `SkillsTxt` server `SrvDoFunc` (`0x6FC63AA0`) for Nova / Frost Nova / Poison Nova 64-ray ring projectiles.
 *
 * @va D2Game:0x6FC63AA0
 */
export function SKILLS_SrvDo_NovaRing113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC63AA0)
  const ediUnit = pUnit >>> 0
  if (ediUnit !== 0) {
    m.setU32((ediUnit + 0xc4) >>> 0, (m.u32((ediUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const ebpSkillId = nSkillId | 0
  const esiSkillsTxt = SKILLS_GetRecordPtrFast113c(m, ebpSkillId)
  if (esiSkillsTxt === 0) return 0

  const ebxMisId = SKILLS_ResolveChargedSrvMissileId113c(m, ebpSkillId, ediUnit) | 0
  if (ebxMisId < 0) return 0
  const pTables = readSgptDataTables113c(m)
  if (ebxMisId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 0

  const lvl = nLevel | 0
  const subVel = DATATBLS_CalcMissileSubLoopFrames113c(m, ebxMisId, lvl) | 0
  const calcOff = m.u32((esiSkillsTxt + 0x138) >>> 0)
  const calcBonus = SKILLS_EvalCalcByOffset113c(m, ediUnit, calcOff, ebpSkillId, lvl) | 0
  const totalVel = (subVel + calcBonus) | 0

  MISSILE_SpawnNova64Directions113c(m, ediUnit, totalVel, pGame, ediUnit, ebxMisId, ebpSkillId, lvl, hooks)
  return 1
}

/**
 * Computes missile base + synergy damage data from `pOwner` and applies it to `pMissile`'s statlist (`0x6FC8F620`).
 *
 * @va D2Game:0x6FC8F620
 */
export function MISSILE_InitOwnerDamageStats113c(
  m: Memory113c,
  pOwner: number,
  pMissile: number,
  nLevel: number,
  pOriginUnit: number,
): void {
  hitD2GameVa113c(0x6FC8F620)
  const esiOwner = pOwner >>> 0
  const ebxMissile = pMissile >>> 0
  const ediLvl = nLevel | 0
  PLAYER_UpdateDualWieldWeaponStatLists113c(m, 0, esiOwner)
  const pDmgData = allocStackScratch113c(m, 0x80)
  try {
    MISSILE_CalculateDamageData113c(m, pDmgData, esiOwner, pOriginUnit >>> 0, ebxMissile, ediLvl)
    MISSILE_ApplyDamageDataToStatList113c(m, esiOwner, ebxMissile, pDmgData, ediLvl)
  } finally {
    freeStackScratch113c(0x80)
  }
}

/**
 * Rolls up to 4 initial pierce charges (`STAT_PIERCE_IDX = 0x148`) on `pMissile` from `pOwner`'s pierce stats (`0x9C` + `0xA6`).
 *
 * @va D2Game:0x6FC8F660
 */
export function MISSILE_RollInitialPierceCount113c(
  m: Memory113c,
  pOwner: number,
  pMissile: number,
): void {
  hitD2GameVa113c(0x6FC8F660)
  const esiOwner = pOwner >>> 0
  const ecxMissile = pMissile >>> 0
  if (esiOwner === 0 || ecxMissile === 0 || m.u32(ecxMissile) !== 3) return
  const ownerType = m.u32(esiOwner) | 0
  if (ownerType !== 0 && ownerType !== 1) return

  const pMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((ecxMissile + 0x04) >>> 0) | 0)
  if (pMisTxt === 0) return
  if ((readGdwBitMaskU8_113c(m, 0x08) & m.u8((pMisTxt + 0x04) >>> 0)) === 0) return

  const ediChance =
    ((STATLIST_GetUnitStatWithLayer113c(m, esiOwner, 0x9c, 0) | 0) +
      (STATLIST_GetUnitStat113c(m, esiOwner, 0xa6, 0) | 0)) |
    0
  if (ediChance === 0) return

  const baseSeed = STATLIST_GetUnitBaseStat113c(m, esiOwner, 0x148, 0)
  const pSeedScratch = allocStackScratch113c(m, 16)
  try {
    SEED_InitLowSeed113c(m, pSeedScratch, baseSeed)
    let seedLo = m.u32(pSeedScratch) >>> 0
    let seedHi = m.u32((pSeedScratch + 4) >>> 0) >>> 0
    let ebxCount = 0
    while (ebxCount < 4) {
      const next = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
      seedLo = Number(next & 0xffffffffn) >>> 0
      seedHi = Number((next >> 32n) & 0xffffffffn) >>> 0
      const rem = seedLo % 100
      if ((rem >>> 0) >= (ediChance >>> 0)) break
      ebxCount = (ebxCount + 1) | 0
    }
    STATLIST_SetUnitStat113c(m, ecxMissile, 0x148, ebxCount, 0)
  } finally {
    freeStackScratch113c(16)
  }
}

/**
 * Frees `pMissile->pMissileData` (`0x6FDBA350`) and removes all scheduled unit events (`0x6FCAE880`).
 *
 * @va D2Game:0x6FC8F880
 */
export function MISSILE_DestroyDataAndEvents113c(
  m: Memory113c,
  pMissile: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC8F880)
  const esi = pMissile >>> 0
  if (esi === 0) return
  MISSILE_FreeMissileData113c(m, esi)
  EVENT_RemoveUnitEvents113c(m, pGame >>> 0, esi)
}

/**
 * Allocates `pMissile->pMissileData`, sets `dwUnitId`, clears `dwFlags` bits `0x0A`, and links a persistent (`fFlags |= 4`, `dwFrame = -1`) timer node.
 *
 * @va D2Game:0x6FC8F8A0
 */
export function MISSILE_InitDataAndPersistentEvent113c(
  m: Memory113c,
  pMissile: number,
  pGame: number,
  dwUnitId: number,
): void {
  hitD2GameVa113c(0x6FC8F8A0)
  const esi = pMissile >>> 0
  if (esi === 0) return
  const ediGame = pGame >>> 0

  MISSILE_AllocMissileData113c(m, esi)
  m.setU32((esi + 0x0c) >>> 0, dwUnitId >>> 0)
  m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) & 0xfffffff5) >>> 0)

  if (m.u32((esi + 0xdc) >>> 0) !== 0) {
    EVENT_RemoveUnitEvents113c(m, ediGame, esi)
  }
  m.setU32((esi + 0xdc) >>> 0, 0)

  const pNode = EVENT_CreateNodeWithGrowth113c(m, ediGame, esi)
  m.setU8((pNode + 0x02) >>> 0, (m.u8((pNode + 0x02) >>> 0) | 0x04) & 0xff)
  m.setU8(pNode, 0)
  m.setU32((pNode + 0x04) >>> 0, 0xffffffff)
  m.setU32((pNode + 0x14) >>> 0, 0)
  m.setU32((pNode + 0x18) >>> 0, 0)
  m.setU32((pNode + 0x2c) >>> 0, 0)

  const uType = m.u32(esi) >>> 0
  const partition = uType < 6 ? D2GAME_EVENT_PARTITION_MAP_113C[uType]! : 0xffffffff
  const pTimer = m.u32((ediGame + 0xb8) >>> 0)
  const headAddr = (pTimer + 0xa04 + partition * 4) >>> 0
  const prevHead = m.u32(headAddr)
  m.setU32((pNode + 0x1c) >>> 0, prevHead)
  m.setU32((pNode + 0x20) >>> 0, 0)
  if (prevHead !== 0) {
    m.setU32((prevHead + 0x20) >>> 0, pNode)
  }
  m.setU32(headAddr, pNode)
}

/**
 * Server missile factory (`0x6FC8F930`, `ecx = pGame`, `edx = pParams` `0x5C`-byte `D2MissileStrc` -> `D2UnitStrc*`).
 *
 * @va D2Game:0x6FC8F930
 */
export function MISSILE_CreateServerProjectile113c(
  m: Memory113c,
  pGame: number,
  pParams: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC8F930)
  const ebp = pParams >>> 0
  const game = pGame >>> 0
  if (ebp === 0 || game === 0) return 0

  const pOwner = m.u32((ebp + 0x04) >>> 0)
  if (pOwner === 0) return 0

  const nMissileId = m.u32((ebp + 0x10) >>> 0) | 0
  if (nMissileId < 0) return 0
  const pTables = readSgptDataTables113c(m)
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 0

  const ownerType = m.u32(pOwner) | 0
  if (ownerType !== 0 && ownerType !== 1) return 0

  const pMisTxt = MISSILES_GetTxtRecordFast113c(m, nMissileId)
  if (pMisTxt === 0) return 0

  const dwParamFlags = m.u32(ebp)
  let startX = 0
  let startY = 0
  if ((dwParamFlags & 0x01) !== 0) {
    startX = m.u32((ebp + 0x14) >>> 0) | 0
    startY = m.u32((ebp + 0x18) >>> 0) | 0
  } else {
    const pOrigin = m.u32((ebp + 0x08) >>> 0)
    if (pOrigin === 0) return 0
    startX = UNIT_GetPosX113c(m, pOrigin) | 0
    startY = UNIT_GetPosY113c(m, pOrigin) | 0
  }

  const pOwnerRoom = UNITS_GetRoom113c(m, pOwner)
  const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, pOwnerRoom, startX, startY)
  if (pSpawnRoom === 0) return 0

  let targetX = startX
  let targetY = startY
  if ((dwParamFlags & 0x02) !== 0) {
    targetX = (startX + (m.u32((ebp + 0x1c) >>> 0) | 0)) | 0
    targetY = (startY + (m.u32((ebp + 0x20) >>> 0) | 0)) | 0
  } else if ((dwParamFlags & 0x20) !== 0) {
    targetX = m.u32((ebp + 0x1c) >>> 0) | 0
    targetY = m.u32((ebp + 0x20) >>> 0) | 0
  }

  let vel = 0
  if ((dwParamFlags & 0x04) !== 0) {
    vel = m.u32((ebp + 0x28) >>> 0) | 0
    if ((dwParamFlags & 0x10) === 0) {
      vel = (vel << 8) | 0
    }
  } else {
    const subStart = m.u8((pMisTxt + 0x9b) >>> 0)
    const prod = Math.imul(subStart, m.u32((ebp + 0x30) >>> 0) | 0)
    const baseVel = (sdiv32(prod, 8) + m.u8((pMisTxt + 0x9a) >>> 0)) | 0
    vel = (baseVel << 8) | 0
  }

  if ((readGdwBitMaskU8_113c(m, 0x0c) & m.u8((pMisTxt + 0x04) >>> 0)) !== 0) {
    if (STATES_CheckState113c(m, pOwner, 0x57) !== 0) {
      const pSlowList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pOwner, 0x57)
      if (pSlowList !== 0) {
        const slowPct = STATLIST_GetStatValue113c(m, pSlowList, 0xa1, 0) | 0
        vel = divBy100Magic113c(Math.imul(slowPct, vel))
      }
    }
  }

  if (vel !== 0) {
    vel = divBy100Magic113c(Math.imul(vel, 0x4b))
  }

  let pTargetUnit = m.u32((ebp + 0x0c) >>> 0)
  if (vel !== 0) {
    if (pTargetUnit === 0) {
      if (targetX === startX && targetY === startY) {
        targetX = (targetX + 1) | 0
        targetY = (targetY + 1) | 0
      }
    } else if (pTargetUnit !== pOwner) {
      const ownerX = UNIT_GetPosX113c(m, pOwner) | 0
      const tgtX = UNIT_GetPosX113c(m, pTargetUnit) | 0
      if (tgtX === ownerX) {
        const tgtY = UNIT_GetPosY113c(m, pTargetUnit) | 0
        const ownerY = UNIT_GetPosY113c(m, pOwner) | 0
        if (tgtY === ownerY) {
          targetX = (targetX + 1) | 0
          targetY = (targetY + 1) | 0
          pTargetUnit = 0
        }
      }
    }

    const checkX = pTargetUnit !== 0 ? UNIT_GetPosX113c(m, pTargetUnit) | 0 : targetX
    const checkY = pTargetUnit !== 0 ? UNIT_GetPosY113c(m, pTargetUnit) | 0 : targetY
    let absDx = (checkX - startX) | 0
    if (absDx < 0) absDx = (-absDx) | 0
    if (absDx >= 100) return 0
    let absDy = (checkY - startY) | 0
    if (absDy < 0) absDy = (-absDy) | 0
    if (absDy >= 100) return 0
  }

  const nCollideType = m.u8((pMisTxt + 0x183) >>> 0)
  const ebxMissile = UNIT_Alloc113c(m, 3)
  if (ebxMissile === 0) return 0

  m.setU32(ebxMissile, 3)
  m.setU32((ebxMissile + 0x04) >>> 0, nMissileId >>> 0)
  m.setU32((ebxMissile + 0x08) >>> 0, m.u32((game + 0x1c) >>> 0))
  m.setU32((ebxMissile + 0x80) >>> 0, game)

  let flags2 = m.u32((ebxMissile + 0xc8) >>> 0)
  if (m.u32((game + 0x70) >>> 0) !== 0) {
    flags2 = (flags2 | 0x02000000) >>> 0
  } else {
    flags2 = (flags2 & 0xfdffffff) >>> 0
  }
  flags2 = (flags2 | 0x04000000) >>> 0
  m.setU32((ebxMissile + 0xc8) >>> 0, flags2)

  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pSpawnRoom)
  const actNo = DRLG_GetActNoFromLevelId113c(m, levelId) & 0xff
  m.setU8((ebxMissile + 0x18) >>> 0, actNo)
  m.setU32((ebxMissile + 0x1c) >>> 0, m.u32((game + 0xbc + actNo * 4) >>> 0))
  m.setU32((ebxMissile + 0x74) >>> 0, 0)

  SUNIT_InitUnitSeed113c(m, ebxMissile, (game + 0xd0) >>> 0)
  m.setU32((ebxMissile + 0xc4) >>> 0, (m.u32((ebxMissile + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((ebxMissile + 0xd0) >>> 0, 0x0b)

  let nextGuid = (m.u32((game + 0x9c) >>> 0) + 1) >>> 0
  if (nextGuid === 0xffffffff) nextGuid = 1
  m.setU32((game + 0x9c) >>> 0, nextGuid)
  m.setU32((ebxMissile + 0x10) >>> 0, nCollideType >>> 0)

  MISSILE_InitDataAndPersistentEvent113c(m, ebxMissile, game, nextGuid)
  SUNIT_PlaceServerUnitInRoom113c(m, pSpawnRoom, startY, ebxMissile, startX, game, 1)

  let totalFrames = 0
  if ((dwParamFlags & 0x8000) !== 0) {
    totalFrames = m.u32((ebp + 0x4c) >>> 0) | 0
  } else {
    const levRange = s16SignExt113c(m.u16((pMisTxt + 0x98) >>> 0))
    const baseRange = s16SignExt113c(m.u16((pMisTxt + 0x96) >>> 0))
    totalFrames = (Math.imul(levRange, m.u32((ebp + 0x30) >>> 0) | 0) + baseRange) | 0
    if ((dwParamFlags & 0x08) !== 0 && m.u8((pMisTxt + 0x180) >>> 0) !== 0) {
      const diff = (m.u8((pMisTxt + 0x182) >>> 0) - m.u8((pMisTxt + 0x181) >>> 0)) | 0
      totalFrames = (totalFrames + Math.imul(diff, m.u32((ebp + 0x34) >>> 0) | 0)) | 0
    }
  }

  if ((dwParamFlags & 0x0200) !== 0) {
    const frameDelta = m.u32((ebp + 0x40) >>> 0) | 0
    totalFrames = (totalFrames - frameDelta) | 0
    m.setU32((ebxMissile + 0x44) >>> 0, (frameDelta << 8) >>> 0)
  }

  MISSILE_SetTotalFrames113c(m, ebxMissile, totalFrames)
  MISSILE_SetRemainingFrames113c(m, ebxMissile, totalFrames)

  const actOffset =
    (dwParamFlags & 0x0800) !== 0
      ? m.u32((ebp + 0x44) >>> 0) | 0
      : m.u8((pMisTxt + 0x136) >>> 0)
  MISSILE_SetActivateFrame113c(m, ebxMissile, (totalFrames - actOffset) | 0)

  const ediPath = m.u32((ebxMissile + 0x2c) >>> 0)
  if (ediPath === 0) return 0

  PATH_SetVelocity113c(m, ediPath, 0)
  if (pTargetUnit !== 0) {
    PATH_SetTargetUnit113c(m, ediPath, pTargetUnit)
  } else {
    PATH_SetTargetPos113c(m, ediPath, targetX, targetY)
  }

  const colMask = m.u8((pMisTxt + 0x184) >>> 0) !== 0 ? 0x40 : 0
  PATH_SetCollisionMask113c(m, ediPath, colMask)

  const moveTestMask =
    nCollideType < 9 ? D2GAME_MISSILE_COLLIDE_MODES_113C[nCollideType]!.mask : 0
  PATH_SetMoveTestCollisionMask113c(m, ediPath, moveTestMask)

  if ((readGdwBitMaskU8_113c(m, 0x10) & m.u8((pMisTxt + 0x04) >>> 0)) !== 0) {
    m.setU32((ebxMissile + 0xc4) >>> 0, (m.u32((ebxMissile + 0xc4) >>> 0) | 0x04) >>> 0)
  }

  if (vel !== 0) {
    PATH_SetVelocity113c(m, ediPath, vel)
    PATH_Compute113c(m, ediPath, ebxMissile, 0)
  }

  MISSILE_SetOwner113c(m, ebxMissile, pOwner)
  PATH_SetAcceleration113c(m, ediPath, s16SignExt113c(m.u16((pMisTxt + 0x9e) >>> 0)))
  PATH_SetMaxVelocity113c(m, ediPath, (m.u8((pMisTxt + 0x9c) >>> 0) << 8) >>> 0)

  if ((dwParamFlags & 0x0400) !== 0) {
    let dist = UNITS_GetUnitDistanceToCoordinates113c(m, ebxMissile, targetX, targetY) | 0
    if (dist === 0) dist = 1
    const velShl4 = (vel << 4) >>> 0
    const distShl16 = (dist << 16) >>> 0
    const remDistFrames = velShl4 !== 0 ? Math.trunc(distShl16 / velShl4) | 0 : 0
    MISSILE_SetRemainingFrames113c(m, ebxMissile, remDistFrames)
  }

  STATLIST_CreateEx113c(m, ebxMissile, 0, 0)

  const fnInit = m.u32((ebp + 0x54) >>> 0)
  const effHooks = resolveMeleeDotHooks113c(hooks)
  if (fnInit !== 0 && effHooks !== undefined && effHooks.missileInitCallback !== undefined) {
    effHooks.missileInitCallback(m, fnInit, ebxMissile, m.u32((ebp + 0x58) >>> 0))
  }

  const nSkillId = m.u32((ebp + 0x2c) >>> 0) | 0
  const nSkillLvl = m.u32((ebp + 0x30) >>> 0) | 0
  MISSILE_SetSkill113c(m, ebxMissile, nSkillId)
  MISSILE_SetLevel113c(m, ebxMissile, nSkillLvl)
  MISSILE_InitOwnerDamageStats113c(m, pOwner, ebxMissile, nSkillLvl, m.u32((ebp + 0x08) >>> 0))
  STATES_UpdateOrClearState98Transform113c(m, ebxMissile, pOwner)
  m.setU32((ebxMissile + 0xc4) >>> 0, (m.u32((ebxMissile + 0xc4) >>> 0) & 0xfffffff7) >>> 0)
  MISSILE_RollInitialPierceCount113c(m, pOwner, ebxMissile)

  if ((dwParamFlags & 0x1000) !== 0) {
    STATLIST_SetUnitStat113c(m, ebxMissile, 0x13, m.u32((ebp + 0x48) >>> 0) | 0, 0)
  }
  if ((dwParamFlags & 0x10000) !== 0) {
    MISSILE_SetStreamFlags113c(m, ebxMissile, (MISSILE_GetStreamFlags113c(m, ebxMissile) | 0x02) >>> 0)
  }

  MONUMOD_DispatchOnKillEvent5_113c(m, ebxMissile, pOwner, game)
  STATLIST_SetUnitStat113c(m, ebxMissile, 0x147, m.u32((pMisTxt + 0x19c) >>> 0) | 0, 0)
  return ebxMissile
}

/**
 * `Event 12` (`EVENT_TIMED_STATS`, `0x6FC94870`): expires timed sub-statlists (`<= dwGameFrame`) and runs `fpRemove`.
 *
 * @va D2Game:0x6FC94870
 */
export function MONSTER_Event12_ExpireTimedStats113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _arg1 = 0,
  _arg2 = 0,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC94870)
  const u = pUnit >>> 0
  if (u === 0 || pGame === 0) return
  const nFrame = m.u32(((pGame >>> 0) + 0xa8) >>> 0) | 0
  const pEx = m.u32((u + 0x5c) >>> 0)
  if (pEx === 0 || (m.u32((pEx + 0x10) >>> 0) | 0) >= 0) return

  let sub = m.u32((pEx + 0x3c) >>> 0)
  if (nFrame !== 0) {
    while (sub !== 0) {
      const flags = m.u32((sub + 0x10) >>> 0)
      let next = m.u32((sub + 0x2c) >>> 0)
      if ((flags & 0x02) !== 0 && (m.u32((sub + 0x18) >>> 0) | 0) <= nFrame) {
        if ((flags | 0) >= 0) {
          unlinkSubListWithRemoveProc113c(m, u, sub, hooks)
          STATLIST_FreeStatListIfNonExtended113c(m, sub)
        }
        next = m.u32((pEx + 0x3c) >>> 0)
      }
      sub = next
    }
    if (m.u32(0x6fde9e1c) !== 0) {
      STATLIST_ExpireTimedSubLists113c(m, u, nFrame)
    }
  } else {
    while (sub !== 0) {
      const flags = m.u32((sub + 0x10) >>> 0)
      let next = m.u32((sub + 0x2c) >>> 0)
      if ((flags & 0x02) !== 0) {
        const rem = ((m.u32((sub + 0x18) >>> 0) | 0) - 1) | 0
        m.setU32((sub + 0x18) >>> 0, rem >>> 0)
        if (rem <= 0) {
          if ((flags | 0) >= 0) {
            unlinkSubListWithRemoveProc113c(m, u, sub, hooks)
            STATLIST_FreeStatListIfNonExtended113c(m, sub)
          }
          next = m.u32((pEx + 0x3c) >>> 0)
        }
      }
      sub = next
    }
  }
}

/**
 * Transitions monster `[pModeChange + 4]` into `MONMODE_GETHIT (3)` if alive and `MONSTATS2_CheckModeBit(dwClassId, 3) != 0`.
 *
 * @va D2Game:0x6FC95210
 */
export function MONSTER_StartGetHitMode113c(
  m: Memory113c,
  pGame: number,
  pModeChange: number,
): number {
  hitD2GameVa113c(0x6FC95210)
  const edi = m.u32(((pModeChange >>> 0) + 0x04) >>> 0)
  if (edi === 0) return 1
  const mode = m.u32((edi + 0x10) >>> 0) | 0
  if (mode === 0 || mode === 0x0c) return 1
  if (MONSTATS2_CheckModeBit113c(m, m.u32((edi + 0x04) >>> 0) | 0, 3) === 0) {
    return 0
  }
  SUNITDMG_FreeAttackerCombatList113c(m, edi, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, edi, 3)
  return 1
}

/**
 * `Event 3` (`EVENT_STAT_REGEN`, `0x6FC96740`): applies monster HP regen / poison / open-wounds tick, `0xAB` life notify, and DoT kill.
 *
 * @va D2Game:0x6FC96740
 */
export function MONSTER_Event03_RegenAndPoisonTick113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _arg1 = 0,
  _arg2 = 0,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC96740)
  const ediGame = pGame >>> 0
  const esi = pMonster >>> 0
  if (ediGame === 0) return

  let ebxRegen = STATLIST_GetUnitStat113c(m, esi, 0x4a, 0) | 0
  if (STATES_CheckStateMask32OnUnit113c(m, esi) !== 0) {
    ebxRegen = (ebxRegen - (STATLIST_GetUnitBaseStat113c(m, esi, 0x4a, 0) | 0)) | 0
  }
  if (STATES_CheckState113c(m, esi, 0x34) !== 0 && ebxRegen >= 0) {
    return
  }

  const nextFrame = ((m.u32((ediGame + 0xa8) >>> 0) | 0) + 1) | 0
  EVENT_SetEventFull113c(m, ediGame, esi, 3, nextFrame, 0, 0, 0)

  if (ebxRegen === 0) {
    if (esi !== 0) {
      let ev = m.u32((esi + 0xdc) >>> 0)
      while (ev !== 0) {
        const nextEv = m.u32((ev + 0x24) >>> 0)
        if (m.u8(ev) === 3) {
          EVENT_FreeNode113c(m, ediGame, ev)
        }
        ev = nextEv
      }
    }
    return
  }

  let ediHp = STATLIST_GetUnitStat113c(m, esi, 0x06, 0) | 0
  const ebpMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, esi) | 0

  if (ebxRegen < 0 && ediHp < 0x100) {
    const pRoom = UNITS_GetRoom113c(m, esi)
    if (pRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
      return
    }
  }

  ediHp = (ediHp + ebxRegen) | 0
  if (ediHp > ebpMaxHp) {
    if (esi !== 0) {
      let ev = m.u32((esi + 0xdc) >>> 0)
      while (ev !== 0) {
        const nextEv = m.u32((ev + 0x24) >>> 0)
        if (m.u8(ev) === 3) {
          EVENT_FreeNode113c(m, ediGame, ev)
        }
        ev = nextEv
      }
    }
    ediHp = ebpMaxHp
  }
  if (ediHp < 1) {
    ediHp = 0
  }
  STATLIST_SetUnitStat113c(m, esi, 0x06, ediHp, 0)

  const oldPct = STATLIST_GetUnitStat113c(m, esi, 0x160, 0) & 0xff
  const newPct = calcUnitLifePct128_113c(m, esi) & 0xff
  const pctDiff = oldPct >= newPct ? oldPct - newPct : newPct - oldPct
  if (pctDiff > 4) {
    MONSTER_QueuePacket0xAB_LifeNotify113c(m, esi, newPct)
    STATLIST_SetUnitStat113c(m, esi, 0x160, newPct, 0)
  }

  if (ediHp !== 0 || esi === 0) return
  const curMode = m.u32((esi + 0x10) >>> 0) | 0
  if (curMode === 0 || curMode === 0x0c) return

  let pKillerList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 0x02)
  if (pKillerList === 0) {
    pKillerList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, 0x3e)
  }

  m.setU32((esi + 0xb0) >>> 0, 0)

  let pKiller = 0
  if (pKillerList !== 0) {
    const ownerId = STATLIST_GetOwnerId113c(m, pKillerList)
    const ownerType = STATLIST_GetOwnerType113c(m, pKillerList)
    pKiller = SUNIT_GetServerUnit113c(m, ediGame, ownerType, ownerId)
  }

  if (STATES_CheckState113c(m, esi, 0x36) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, esi, 0x5c, 1)
    return
  }

  killUnit0x6FCFEEE0(m, ediGame, esi, pKiller, 1, hooks)
  SUNIT_DispatchItemEventCallbacks113c(m, esi, ediGame, 0x0a, pKiller, 0)
  if (pKiller !== 0) {
    SUNIT_DispatchItemEventCallbacks113c(m, pKiller, ediGame, 0x09, esi, 0)
  }
}

/**
 * Starts player ground-targeted cast animation at `(nX, nY)` (`0x6FC98840`), schedules anim events, and runs `SKILLS_StartUsedSkill113c`.
 *
 * @va D2Game:0x6FC98840
 */
export function PLAYER_StartCastSkillAtCoords113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  nMode: number,
  nX: number,
  nY: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FC98840)
  const ebpGame = pGame >>> 0
  const esiPlayer = pPlayer >>> 0
  const pPath = m.u32((esiPlayer + 0x2c) >>> 0)

  PATH_SetTargetPos113c(m, pPath, nX | 0, nY | 0)
  SUNITDMG_FreeAttackerCombatList113c(m, esiPlayer, ebpGame)
  UNITS_ChangeAnimMode113c(m, esiPlayer, nMode | 0)
  UNITS_SetTargetUnitForDynamicUnit113c(m, esiPlayer, 0)
  SUNIT_InitUnitAnimData113c(m, esiPlayer)
  MONSTER_ClearModeEvents113c(m, ebpGame, esiPlayer)
  scheduleModeAnimEvents0x6FCFF7B0(m, ebpGame, esiPlayer, hooks)
  m.setU32((esiPlayer + 0xc4) >>> 0, (m.u32((esiPlayer + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
  SKILLS_StartUsedSkill113c(m, esiPlayer, ebpGame)
}

/**
 * Allocates a `0x14`-byte `0xAB` unit life-notify node on `pUnit`'s notify queue (`+0xEC` head, `+0xF0` tail) and refreshes room.
 *
 * @va D2Game:0x6FC9A260
 */
export function MONSTER_QueuePacket0xAB_LifeNotify113c(
  m: Memory113c,
  pUnit: number,
  bLifePct: number,
): void {
  hitD2GameVa113c(0x6FC9A260)
  const esi = pUnit >>> 0
  if (esi !== 0) {
    m.u32((esi + 0x08) >>> 0)
  }
  const pNode = m.alloc(0x14)
  m.setU32(pNode, 0)
  m.setU32((pNode + 0x04) >>> 0, 0)
  m.setU32((pNode + 0x08) >>> 0, 0)
  m.setU32((pNode + 0x0c) >>> 0, 0)
  m.setU32((pNode + 0x10) >>> 0, 0)

  m.setU8((pNode + 0x04) >>> 0, 0xab)
  m.setU8((pNode + 0x08) >>> 0, esi !== 0 ? m.u32(esi) & 0xff : 6)
  m.setU32((pNode + 0x0c) >>> 0, esi !== 0 ? m.u32((esi + 0x0c) >>> 0) : 0xffffffff)
  m.setU8((pNode + 0x10) >>> 0, bLifePct & 0xff)

  if (m.u32((esi + 0xec) >>> 0) === 0) {
    m.setU32((esi + 0xec) >>> 0, pNode)
  }
  const prevTail = m.u32((esi + 0xf0) >>> 0)
  if (prevTail !== 0) {
    m.setU32(prevTail, pNode)
  }
  m.setU32((esi + 0xf0) >>> 0, pNode)
  UNITROOM_RefreshUnit113c(m, esi)
}

/**
 * Serializes S2C `0x3E` (`0x22` bytes) item stat bitstream packet and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB010
 */
export function NET_SendPacket0x3E_ItemStatBitStream113c(
  m: Memory113c,
  pItem: number,
  wLayer: number,
  pClient: number,
  bFlag: number,
  nStatId: number,
  dwValue: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCAB010)
  const pScratch = allocStackScratch113c(m, 0x40)
  try {
    const pBs = pScratch
    const pPkt = (pScratch + 0x14) >>> 0
    m.fill(pPkt, 0x22, 0)
    m.setU8(pPkt, 0x3e)

    fogInitBitBuffer113c(m, pBs, (pPkt + 0x02) >>> 0, 0x20)
    const itemGuid = pItem !== 0 ? m.u32(((pItem >>> 0) + 0x0c) >>> 0) : 0xffffffff
    BITSTREAM_WriteVarUint113c(m, pBs, itemGuid)
    fogWriteBits113c(m, pBs, (bFlag & 0xff) !== 0 ? 1 : 0, 1)
    fogWriteBits113c(m, pBs, nStatId | 0, 9)
    BITSTREAM_WriteVarUint113c(m, pBs, dwValue >>> 0)

    const u16Layer = wLayer & 0xffff
    if (u16Layer < 0x100) {
      fogWriteBits113c(m, pBs, 0, 1)
      fogWriteBits113c(m, pBs, u16Layer, 8)
    } else {
      fogWriteBits113c(m, pBs, 1, 1)
      fogWriteBits113c(m, pBs, u16Layer, 16)
    }

    const payloadBytes = fogGetBitBufferSize113c(m, pBs)
    m.setU8((pPkt + 0x01) >>> 0, (payloadBytes + 2) & 0xff)
    queuePacketToClient0x6FCAA3E0(m, pClient >>> 0, pPkt, 0x22, hooks)
  } finally {
    freeStackScratch113c(0x40)
  }
}

/**
 * Serializes S2C `0x23` (`13` bytes) skill-assignment packet and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCAB710
 */
export function NET_SendPacket0x23_AssignSkill113c(
  m: Memory113c,
  nUnitType: number,
  dwUnitId: number,
  pClient: number,
  nHand: number,
  wSkillId: number,
  dwItemGuid: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCAB710)
  const pPkt = allocStackScratch113c(m, 0x10)
  try {
    m.setU8(pPkt, 0x23)
    m.setU8((pPkt + 0x01) >>> 0, nUnitType & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwUnitId >>> 0)
    m.setU8((pPkt + 0x06) >>> 0, nHand & 0xff)
    m.setU16((pPkt + 0x07) >>> 0, wSkillId & 0xffff)
    m.setU32((pPkt + 0x09) >>> 0, dwItemGuid >>> 0)
    queuePacketToClient0x6FCAA3E0(m, pClient >>> 0, pPkt, 0x0d, hooks)
  } finally {
    freeStackScratch113c(0x10)
  }
}

/**
 * Serializes S2C `0xAB` (`7` bytes) unit life/heal packet and queues it to `pClient` (`0x6FCAA3E0`).
 *
 * @va D2Game:0x6FCABA50
 */
export function NET_SendPacket0xAB_UnitHeal113c(
  m: Memory113c,
  nUnitType: number,
  dwUnitId: number,
  pClient: number,
  bLifePct: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCABA50)
  const pPkt = allocStackScratch113c(m, 0x10)
  try {
    m.setU8(pPkt, 0xab)
    m.setU8((pPkt + 0x01) >>> 0, nUnitType & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, dwUnitId >>> 0)
    m.setU8((pPkt + 0x06) >>> 0, bLifePct & 0xff)
    queuePacketToClient0x6FCAA3E0(m, pClient >>> 0, pPkt, 0x07, hooks)
  } finally {
    freeStackScratch113c(0x10)
  }
}

/**
 * Removes all active curse states (`sgptDataTables->fCurseStateMasks` at `+0xE4`) and their statlists from `pUnit`.
 *
 * @va D2Game:0x6FCB0F30
 */
export function STATES_ClearCurseStatesOnUnit113c(
  m: Memory113c,
  pUnit: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCB0F30)
  const ebp = pUnit >>> 0
  if (STATES_CheckStateMask6OnUnit113c(m, ebp) === 0) return

  const pStateFlags = UNITS_GetStateFlagsPtr113c(m, ebp)
  if (pStateFlags === 0) return

  const pTables = readSgptDataTables113c(m)
  const nStates = m.u32((pTables + 0xc4) >>> 0) | 0
  const adj = nStates + 0x1f
  const nDwords = sar32((adj + ((adj >> 31) & 0x1f)) | 0, 5)
  if (nDwords <= 0) return

  const pWordsScratch = allocStackScratch113c(m, nDwords * 4)
  try {
    for (let i = 0; i < nDwords; i++) {
      m.setU32((pWordsScratch + i * 4) >>> 0, m.u32((pStateFlags + i * 4) >>> 0))
    }

    for (let wIdx = 0; wIdx < nDwords; wIdx++) {
      let ebxMask = m.u32((pWordsScratch + wIdx * 4) >>> 0)
      const baseState = wIdx * 32
      let bit = fogBitScanForward113c(ebxMask)
      while (bit >= 0) {
        const clearMask = ~(1 << (bit & 31)) >>> 0
        ebxMask = (ebxMask & clearMask) >>> 0
        const stateId = (baseState + bit) | 0
        const pCurseMasks = m.u32((readSgptDataTables113c(m) + 0xe4) >>> 0)
        const curseWord = m.u32((pCurseMasks + (stateId >> 5) * 4) >>> 0)
        if ((curseWord & readGdwBitMaskU32_113c(m, stateId & 0x1f)) !== 0) {
          const pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, ebp, stateId)
          if (pSub !== 0) {
            unlinkSubListWithRemoveProc113c(m, ebp, pSub, hooks)
            STATLIST_FreeStatListIfNonExtended113c(m, pSub)
          }
          STATES_ToggleGfxStateFlag113c(m, ebp, stateId, 0)
        }
        bit = fogBitScanForward113c(ebxMask)
      }
      m.setU32((pWordsScratch + wIdx * 4) >>> 0, ebxMask)
    }
  } finally {
    freeStackScratch113c(nDwords * 4)
  }
}

/**
 * Resolves `SkillsTxt` server missile ID (`wSrvMissile` / `wSrvMissileA` / `wSrvMissileB` at `+0x48..+0x4C`) for progressive charge skills.
 *
 * @va D2Game:0x6FCB1340
 */
export function SKILLS_ResolveChargedSrvMissileId113c(
  m: Memory113c,
  nSkillId: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCB1340)
  const skillId = nSkillId | 0
  if (skillId < 0) return -1
  const pTables = readSgptDataTables113c(m)
  if (skillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return -1
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return -1

  if ((readGdwBitMaskU8_113c(m, 0x08) & m.u8((pSkillsTxt + 0x04) >>> 0)) !== 0) {
    const auraState = s16SignExt113c(m.u16((pSkillsTxt + 0x80) >>> 0))
    if (auraState >= 0 && auraState < (m.u32((pTables + 0xc4) >>> 0) | 0)) {
      const auraStat = s16SignExt113c(m.u16((pSkillsTxt + 0x54) >>> 0))
      if (auraStat >= 0 && auraStat < (m.u32((pTables + 0xbd4) >>> 0) | 0)) {
        const pStateList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, auraState)
        if (pStateList !== 0) {
          let tier = STATLIST_GetStatValue113c(m, pStateList, auraStat, 0) | 0
          if (tier <= 1) tier = 1
          else if (tier > 3) tier = 3
          return s16SignExt113c(m.u16((pSkillsTxt + tier * 2 + 0x46) >>> 0))
        }
      }
    }
  }
  return s16SignExt113c(m.u16((pSkillsTxt + 0x48) >>> 0))
}

/**
 * `fpRemove` callback (`0x6FCBF7A0`) when a timed state (`STATE_POISON`, shrines, buffs, curses) expires on `pUnit`.
 *
 * @va D2Game:0x6FCBF7A0
 */
export function STATES_OnTimedStateRemoved113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCBF7A0)
  const edi = pUnit >>> 0
  const esiState = nState | 0
  if (edi === 0) {
    throw new D2CommonAssertError('States.cpp', 0xa2a)
  }

  const pGame = m.u32((edi + 0x80) >>> 0)
  ITEMEVENT_RemoveByTypeAndState113c(m, edi, pGame, 1, esiState)

  let checkExpMask = (m.u8((edi + 0xc6) >>> 0) & 0x01) !== 0
  if (!checkExpMask) {
    const uType = m.u32(edi) | 0
    if (uType === 0) {
      const mode = m.u32((edi + 0x10) >>> 0) | 0
      if (mode === 0 || mode === 0x11) checkExpMask = true
    } else if (uType === 1) {
      const mode = m.u32((edi + 0x10) >>> 0) | 0
      if (mode === 0 || mode === 0x0c) checkExpMask = true
    } else {
      checkExpMask = true
    }
  }

  if (checkExpMask && STATES_CheckStateMaskExpOnUnit113c(m, edi, esiState) !== 0) {
    return
  }

  STATES_ToggleGfxStateFlag113c(m, edi, esiState, 0)
  UNITS_SetUnitAnimMode113c(m, edi, 0x6fd1b980, 0x485)
  SKILLS_RefreshPassiveAuraSkills113c(m, edi)

  if (m.u32(edi) === 0) {
    syncPlayerPetCaps0x6FCB6FA0(m, m.u32((edi + 0x80) >>> 0), edi, hooks)
  }
}

/**
 * Assigns left/right skill (`0x6FCC2100`), sends S2C `0x23` to player client, tears down old right-hand aura, and activates new aura.
 *
 * @va D2Game:0x6FCC2100
 */
export function SKILLS_AssignHandSkillAndSyncAura113c(
  m: Memory113c,
  pUnit: number,
  bLeft: number,
  nSkillId: number,
  dwOwnerGuid: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCC2100)
  const ebxSkillId = nSkillId | 0
  if (ebxSkillId === 5) return
  const esi = pUnit >>> 0
  const ebpLeft = bLeft | 0

  if (ebpLeft === 0 && STATES_CheckState113c(m, esi, 0x55) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, esi, 0x55, 0)
  }

  const ediSkill = SKILLS_GetSkillById113c(m, esi, ebxSkillId, dwOwnerGuid >>> 0)
  if (ediSkill === 0) return

  let prevRightSkill = 0
  if (ebpLeft !== 0) {
    SKILLS_SetLeftSkill113c(m, esi, ebxSkillId, dwOwnerGuid >>> 0)
  } else {
    prevRightSkill = UNITS_GetRightSkill113c(m, esi)
    SKILLS_SetRightSkill113c(m, esi, ebxSkillId, dwOwnerGuid >>> 0)
  }

  const pGuidScratch = allocStackScratch113c(m, 16)
  try {
    m.setU32(pGuidScratch, 0xffffffff)
    SKILLS_GetItemSkillInfo113c(m, ediSkill, pGuidScratch, 0, 0, 0)
    const itemGuid = m.u32(pGuidScratch)

    if (esi !== 0 && m.u32(esi) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, esi)
      const pClient = m.u32((pPlayerData + 0x9c) >>> 0)
      NET_SendPacket0x23_AssignSkill113c(
        m,
        0,
        m.u32((esi + 0x0c) >>> 0),
        pClient,
        ebpLeft,
        ebxSkillId & 0xffff,
        itemGuid,
        hooks,
      )
    }
  } finally {
    freeStackScratch113c(16)
  }

  if (ebpLeft !== 0) return

  if (prevRightSkill !== 0) {
    const prevSkillId = SKILLS_GetSkillIdFromSkill113c(m, prevRightSkill, 0x6fd1b980, 0xdb3) | 0
    const pPrevTxt = SKILLS_GetRecordPtrFast113c(m, prevSkillId)
    if (pPrevTxt !== 0 && (readGdwBitMaskU8_113c(m, 0x14) & m.u8((pPrevTxt + 0x04) >>> 0)) !== 0) {
      const prevAuraState = s16SignExt113c(m.u16((pPrevTxt + 0x80) >>> 0))
      const pTables = readSgptDataTables113c(m)
      if (prevAuraState >= 0 || prevAuraState < (m.u32((pTables + 0xc4) >>> 0) | 0)) {
        const pAuraList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, esi, prevAuraState)
        if (pAuraList !== 0) {
          unlinkSubListWithRemoveProc113c(m, esi, pAuraList, hooks)
          STATLIST_FreeStatListIfNonExtended113c(m, pAuraList)
        }
        STATES_ToggleGfxStateFlag113c(m, esi, prevAuraState, 0)
      }
      const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, esi)
      if (esi !== 0) {
        let ev = m.u32((esi + 0xdc) >>> 0)
        while (ev !== 0) {
          const nextEv = m.u32((ev + 0x24) >>> 0)
          if (m.u8(ev) === 8 && m.u32((ev + 0x14) >>> 0) === 0xffffffff) {
            EVENT_FreeNode113c(m, pGame, ev)
          }
          ev = nextEv
        }
      }
    }
  }

  const pNewTxt = SKILLS_GetRecordPtrFast113c(m, ebxSkillId)
  if (pNewTxt !== 0 && (readGdwBitMaskU8_113c(m, 0x14) & m.u8((pNewTxt + 0x04) >>> 0)) !== 0) {
    const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, esi)
    SKILLS_ActivateAuraSkillOnUnit113c(m, esi, pGame, ebxSkillId)
    let hasVelOrIasAuraStat = false
    for (let s = 0; s < 6; s++) {
      const aStat = s16SignExt113c(m.u16((pNewTxt + 0x54 + s * 2) >>> 0))
      if (aStat >= 0x43 && aStat <= 0x44) {
        hasVelOrIasAuraStat = true
        break
      }
    }
    if (!hasVelOrIasAuraStat) {
      for (let p = 0; p < 5; p++) {
        const pStat = s16SignExt113c(m.u16((pNewTxt + 0x98 + p * 2) >>> 0))
        if (pStat >= 0x43 && pStat <= 0x44) {
          hasVelOrIasAuraStat = true
          break
        }
      }
    }
    if (hasVelOrIasAuraStat) {
      SUNITDMG_GetDefenderColdEffect113c(m, esi, pGame)
    }
  }
}

/**
 * Spawns 64 nova ring projectiles (`0x6FCC2800`) around `pOriginUnit` using `0x6FD1B870` (`dx`) and `0x6FD1B770` (`dy`).
 *
 * @va D2Game:0x6FCC2800
 */
export function MISSILE_SpawnNova64Directions113c(
  m: Memory113c,
  pOriginUnit: number,
  nVelOverride: number,
  pGame: number,
  pOwner: number,
  nMissileId: number,
  nSkillId: number,
  nLevel: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FCC2800)
  const esiOrigin = pOriginUnit >>> 0
  const pParams = allocStackScratch113c(m, 0x60)
  try {
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 3)

    const uType = m.u32(esiOrigin) | 0
    const pPath = m.u32((esiOrigin + 0x2c) >>> 0)
    let originX = 0
    let originY = 0
    if (uType === 2 || (uType > 3 && uType <= 5)) {
      originX = m.u32((pPath + 0x0c) >>> 0) | 0
      originY = m.u32((pPath + 0x10) >>> 0) | 0
    } else if (pPath !== 0) {
      originX = PATH_GetPosX113c(m, pPath) | 0
      originY = PATH_GetPosY113c(m, pPath) | 0
    }

    m.setU32((pParams + 0x04) >>> 0, pOwner >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, originX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, originY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)

    if ((nVelOverride | 0) !== 0) {
      m.setU32(pParams, 7)
      m.setU32((pParams + 0x28) >>> 0, nVelOverride >>> 0)
    }

    for (let i = 0; i < 64; i++) {
      // 0x6fcc28b0..0x6fcc28c6: `[pParams + 0x1c] = [0x6fd1b870 + i*4]`, `[pParams + 0x20] = [0x6fd1b770 + i*4]`
      m.setU32((pParams + 0x1c) >>> 0, D2GAME_NOVA_64_DY_113C[i]! >>> 0)
      m.setU32((pParams + 0x20) >>> 0, D2GAME_NOVA_64_DX_113C[i]! >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, pParams, hooks)
    }
  } finally {
    freeStackScratch113c(0x60)
  }
}

/**
 * Computes monster `lifePct` (`0..0x80`), stores `STAT_MONSTER_LAST_SENT_HP_PCT (0x160)`, and queues 9-byte S2C `0x0C` packet.
 *
 * @va D2Game:0x6FD13360
 */
export function MONSTER_SendPacket0x0C_LifeSync113c(
  m: Memory113c,
  pMonster: number,
  pClient: number,
  hooks?: K2GapMeleeDotHooks113c,
): void {
  hitD2GameVa113c(0x6FD13360)
  const esi = pMonster >>> 0
  const hitClassByte = m.u8((esi + 0xb0) >>> 0)
  const hpShr8 = (STATLIST_GetUnitStat113c(m, esi, 0x06, 0) | 0) >> 8
  const maxShr8 = (STATLIST_GetMaxLifeFromUnit113c(m, esi) | 0) >> 8

  let bl = 0x80
  if (maxShr8 > 0 && hpShr8 < maxShr8) {
    bl = sdiv32(hpShr8 << 7, maxShr8) & 0xff
  }

  STATLIST_SetUnitStat113c(m, esi, 0x160, bl, 0)

  if (bl > 1) {
    bl = (bl - 1) & 0xff
  }
  if (m.u32(esi) === 1) {
    const pMonData = m.u32((esi + 0x14) >>> 0)
    if (pMonData !== 0 && (m.u8((pMonData + 0x17) >>> 0) & 0x01) !== 0) {
      bl = (bl | 0x80) & 0xff
    }
  }

  const unitId = m.u32((esi + 0x0c) >>> 0)
  const pPkt = allocStackScratch113c(m, 0x10)
  try {
    m.setU8(pPkt, 0x0c)
    m.setU8((pPkt + 0x01) >>> 0, 0x01)
    m.setU32((pPkt + 0x02) >>> 0, unitId)
    m.setU8((pPkt + 0x06) >>> 0, 0x13)
    m.setU8((pPkt + 0x07) >>> 0, hitClassByte)
    m.setU8((pPkt + 0x08) >>> 0, bl)
    queuePacketToClient0x6FCAA3E0(m, pClient >>> 0, pPkt, 9, hooks)
  } finally {
    freeStackScratch113c(0x10)
  }
}
