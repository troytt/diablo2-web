/**
 * Milestone 33 [K2] Wave 4 Batch 5 (`w4b5`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FCAD040..0x6FCBC270`.
 *
 * Clean-room 1:1 binary-accurate translations from `D2Game.dll` v1.13c.
 */

import { UNITS_GetField7C_113c, UNITS_GetPlayerData113c } from '../common/composit.js'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.js'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze.js'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.js'
import { D2CommonAssertError } from '../common/inline-helpers.js'
import { mulDiv113c } from '../common/int-math.js'
import {
  INVENTORY_GetEquippedWeaponHandClass113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetFirstNode113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetNextNode113c,
  INVENTORY_GetNodeItemGuid113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.js'
import {
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetNodePage113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_SetInvPage113c,
} from '../common/items.js'
import {
  STATLIST_AddStatMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.js'
import {
  MISSILE_GetTotalFrames113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../common/missile.js'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_SetCollisionMask113c,
  PATH_SetNewDistance113c,
  PATH_SetNumberOfPathPoints113c,
  PATH_SetType113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.js'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetUnitSkillBonusBySkillId113c,
  SKILLS_IsSelectableCorpse10501_113c,
} from '../common/skills.js'
import {
  STATES_CheckState113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.js'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_CheckStateMaskExp113c,
  UNITS_GetRoom113c,
  UNITS_SetPathRoomRefreshFlag113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit.js'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.js'
import { SEED_InitLowSeed113c, seedRoll } from '../prng.js'
import { DATATBLS_NormalizeDirection113c, MONSTERS_IsDead113c } from '../tables/datatbls-113c.js'
import { DATATBLS_CalcMissileSubLoopFrames113c } from '../tables/missile-tbls-113c.js'
import {
  ARENA_CountPlayersInLevelCallback113c,
  NPCS_UpdateMercenaryOrVendorSlots113c,
  SUNIT_UnlinkFromRoomUpdateList113c,
} from './a1c-post150-f150-f276-113c.js'
import {
  PARTY_CountLivingPartyMemberCallback113c,
  PARTY_ForEachPartyMemberInSameLevel113c,
  S2C_SendPacket9C_ItemActionWorld113c,
} from './a1c-post150-f786-f1040-113c.js'
import { AIGENERAL_GetPackLeaderUnit113c } from './ai-fallen-113c.js'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.js'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c.js'
import {
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
} from './combat-a1c-113c.js'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c.js'
import { PLAYER_GetEquippedWeapon113c } from './replay-kernel-113c.js'
import { SUNIT_GetServerUnit113c } from './game-strc.js'
import {
  AURAS_ApplyRadialStatBuffCallback113c,
  AURA_ForEachUnitInRadius113c,
} from './k2-gap-itemdef-113c.js'
import {
  MISSILE_CreateServerProjectile113c,
  MISSILE_SpawnNova64Directions113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c.js'
import {
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
} from './k2-items-tc-w1-113c.js'
import {
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
} from './k2-laneH-0x6fc2-w1-113c.js'
import { PARTY_GetPlayerRelationState113c } from './k2-sunit-spawn-w1-113c.js'
import { ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c } from './k2-w2b1-113c.js'
import {
  NET_SendPacket7A_SummonChange_6FCAB290_113c,
  NET_SendPacket81_AssignMerc_6FCAB220_113c,
  NET_ShouldSyncTrackedStatDelta_6FCAA330_113c,
} from './k2-w2b3-113c.js'
import {
  PARTY_AllocNextPartyId_6FCBBD40_113c,
  PARTY_FindSubPartyById_6FCBBD00_113c,
  PARTY_SplitGoldPickupByCap_6FCBBC70_113c,
  STATES_ClearGfxStateFlagCallback_6FCB0F00_113c,
} from './k2-w2b4-113c.js'
import { SKILLS_TargetRingScanCallback_6FCBED70_113c } from './k2-w2b5-113c.js'
import { SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c } from './k2-w2b8-113c.js'
import {
  MONSTER_ScheduleInitialAiEvent113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.js'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.js'
import { EVENT_SetEventFull113c } from './timer-wheel.js'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c.js'
import { hitD2GameVa113c } from '../va-trace-113c.js'

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

/**
 * [1/45] Resolves portal object `dwPortalGuid` (`edi`) in `pGame` (`eax`), finds its owner player
 * via `UNITS_GetField7C_113c(pObject)->dwOwnerGuid` (`+0x04`), builds 29-byte (`0x1D`) packet `0x82`
 * with owner GUID, 16-byte owner name, `dwPortalGuid`, and `dwTargetGuid`, and queues it to `pClient`.
 *
 * @va D2Game:0x6FCAD040
 */
export function NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwPortalGuid: number,
  pClient: number,
  dwTargetGuid: number,
): void {
  hitD2GameVa113c(0x6FCAD040)
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x2d3)
  }
  const nObjBucket = dwPortalGuid & 0x7f
  let pObject = m.u32((pGame + nObjBucket * 4 + 0x1520) >>> 0) >>> 0
  while (pObject !== 0 && m.u32((pObject + 0x0c) >>> 0) !== (dwPortalGuid >>> 0)) {
    pObject = m.u32((pObject + 0xe4) >>> 0) >>> 0
  }
  if (pObject === 0) return

  const pField7C = UNITS_GetField7C_113c(m, pObject) >>> 0
  const dwOwnerGuid = pField7C !== 0 ? m.u32((pField7C + 0x04) >>> 0) >>> 0 : 0xffffffff
  const nPlayerBucket = dwOwnerGuid & 0x7f
  let pPlayer = m.u32((pGame + nPlayerBucket * 4 + 0x1120) >>> 0) >>> 0
  while (pPlayer !== 0 && m.u32((pPlayer + 0x0c) >>> 0) !== dwOwnerGuid) {
    pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
  }
  if (pPlayer === 0) return

  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const pPkt = m.alloc(0x20) >>> 0
  m.setU8(pPkt, 0x82)
  m.setU32((pPkt + 0x01) >>> 0, m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
  for (let i = 0; i < 0x10; i = (i + 1) | 0) {
    const ch = i < 0x0f && pPlayerData !== 0 ? m.u8((pPlayerData + i) >>> 0) : 0
    m.setU8((pPkt + 0x05 + i) >>> 0, ch)
    if (ch === 0) break
  }
  m.setU32((pPkt + 0x15) >>> 0, dwPortalGuid >>> 0)
  m.setU32((pPkt + 0x19) >>> 0, dwTargetGuid >>> 0)
  NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x1d)
}

/**
 * [2/45] Builds and sends 13-byte (`0x0D`) packet `0x75` describing `pTargetPlayer` (`eax`)
 * to `pRecipientPlayer` (`ebx`): target GUID, party ID, level (`STAT_LEVEL=12`), relation flags,
 * and party relation state.
 *
 * @va D2Game:0x6FCAD120
 */
export function NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(
  m: D2KernMemory113c,
  pTargetPlayer: number,
  pRecipientPlayer: number,
): number {
  hitD2GameVa113c(0x6FCAD120)
  let pClient = 0
  if (pRecipientPlayer !== 0 && m.u32(pRecipientPlayer >>> 0) === 0) {
    const pRecipData0 = UNITS_GetPlayerData113c(m, pRecipientPlayer >>> 0) >>> 0
    pClient = m.u32((pRecipData0 + 0x9c) >>> 0) >>> 0
  }

  const pPkt = m.alloc(0x10) >>> 0
  m.setU8(pPkt, 0x75)
  const dwTargetGuid =
    pTargetPlayer !== 0 ? m.u32((pTargetPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((pPkt + 0x01) >>> 0, dwTargetGuid)

  const wLevel = STATLIST_GetUnitStat113c(m, pTargetPlayer >>> 0, 0x0c, 0) & 0xffff
  m.setU16((pPkt + 0x07) >>> 0, wLevel)

  let wPartyId = 0xffff
  if (pTargetPlayer !== 0) {
    const pGame = m.u32((pTargetPlayer + 0x80) >>> 0) >>> 0
    if (pGame !== 0 && m.u32(pTargetPlayer >>> 0) === 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pTargetPlayer >>> 0, pGame) & 0xffff
    }
  }
  m.setU16((pPkt + 0x05) >>> 0, wPartyId)

  const pRecipData = UNITS_GetPlayerData113c(m, pRecipientPlayer >>> 0) >>> 0
  let pRelNode = 0
  if ((pRecipientPlayer >>> 0) !== (pTargetPlayer >>> 0) && pRecipData !== 0) {
    let pCur = m.u32((pRecipData + 0x38) >>> 0) >>> 0
    while (pCur !== 0) {
      if (m.u32(pCur) === dwTargetGuid) {
        pRelNode = pCur
        break
      }
      pCur = m.u32((pCur + 0x10) >>> 0) >>> 0
    }
  }
  const wRelFlags =
    (pRecipientPlayer >>> 0) !== (pTargetPlayer >>> 0) && pRelNode !== 0
      ? m.u16((pRelNode + 0x04) >>> 0)
      : 0
  m.setU16((pPkt + 0x09) >>> 0, wRelFlags)

  const wRelState =
    PARTY_GetPlayerRelationState113c(m, pRecipientPlayer >>> 0, pTargetPlayer >>> 0) & 0xffff
  m.setU16((pPkt + 0x0b) >>> 0, wRelState)

  return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0d) | 0
}

/**
 * [3/45] Checks whether monster `pMonster` (`eax`) is currently targeting `pPlayer` (`[esp+4]`)
 * via its AI general target fields (`+0x28..+0x30`), and if its tracked stat value (`pMonData+0x40`)
 * differs from `nNewVal` (`edi`), delegates to `NET_ShouldSyncTrackedStatDelta_6FCAA330_113c`.
 *
 * @va D2Game:0x6FCAD500
 */
export function MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c(
  m: D2KernMemory113c,
  pMonster: number,
  nNewVal: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCAD500)
  let pTargetUnit = 0
  if (pMonster !== 0 && m.u32(pMonster >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0) {
        const pGame = m.u32((pAiGeneral + 0x28) >>> 0) >>> 0
        if (pGame !== 0) {
          const dwTargetId = m.u32((pAiGeneral + 0x2c) >>> 0) >>> 0
          const dwTargetType = m.u32((pAiGeneral + 0x30) >>> 0) >>> 0
          pTargetUnit = SUNIT_GetServerUnit113c(m, pGame, dwTargetType, dwTargetId) >>> 0
        }
      }
    }
  }
  if (pTargetUnit !== (pPlayer >>> 0)) return 0
  if (pMonster === 0 || m.u32(pMonster >>> 0) !== 1) return 0
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return 0
  const pSyncTrack = (pMonData + 0x3c) >>> 0
  if (i32(m, (pSyncTrack + 0x04) >>> 0) === (nNewVal | 0)) return 0
  return NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, pSyncTrack, nNewVal | 0) | 0
}

/**
 * [4/45] Builds and queues 12-byte (`0x0C`) packet `0x22` (unit skill/ammo count update)
 * to `pClient` (`esi`), setting byte `+0x0B` to `1` if the resolved unit has `STATE_MORPH` (`7`).
 *
 * @va D2Game:0x6FCAD570
 */
export function NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
  m: D2KernMemory113c,
  pClient: number,
  bUnitType: number,
  dwUnitGuid: number,
  wSkillId: number,
  bCount: number,
): number {
  hitD2GameVa113c(0x6FCAD570)
  if (pClient === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x996)
  }
  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, 0x22)
  m.setU8((pPkt + 0x01) >>> 0, bUnitType & 0xff)
  m.setU32((pPkt + 0x03) >>> 0, dwUnitGuid >>> 0)
  m.setU16((pPkt + 0x07) >>> 0, wSkillId & 0xffff)
  m.setU8((pPkt + 0x09) >>> 0, bCount & 0xff)

  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  const pUnit = SUNIT_GetServerUnit113c(m, pGame, bUnitType & 0xff, dwUnitGuid >>> 0) >>> 0
  const bHasState7 = pUnit !== 0 && (STATES_CheckState113c(m, pUnit, 7) | 0) !== 0 ? 1 : 0
  m.setU8((pPkt + 0x0b) >>> 0, bHasState7)

  return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x0c) | 0
}

/**
 * [5/45] Builds and queues 12-byte (`0x0C`) packet `0x21` (skill level + bonus update) for `pUnit` (`esi`)
 * to `pClient` (`eax`), resolving a monster's player owner client via `AIGENERAL_GetPackLeaderUnit113c`
 * when `pClient == 0`.
 *
 * @va D2Game:0x6FCAD5F0
 */
export function NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(
  m: D2KernMemory113c,
  pClient: number,
  pUnit: number,
  wSkillId: number,
  bBaseLevel: number,
  bArg2: number,
): void {
  hitD2GameVa113c(0x6FCAD5F0)
  if (pUnit === 0) return
  let pTargetClient = pClient >>> 0
  if (pTargetClient === 0) {
    if (m.u32(pUnit >>> 0) !== 1) return
    const pOwner = AIGENERAL_GetPackLeaderUnit113c(m, pUnit >>> 0) >>> 0
    if (pOwner === 0 || m.u32(pOwner) !== 0) return
    const pPlayerData = UNITS_GetPlayerData113c(m, pOwner) >>> 0
    pTargetClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    if (pTargetClient === 0) return
  }

  const pPkt = m.alloc(0x0c) >>> 0
  m.setU8(pPkt, 0x21)
  m.setU8((pPkt + 0x01) >>> 0, m.u32(pUnit >>> 0) & 0xff)
  m.setU8((pPkt + 0x02) >>> 0, bArg2 & 0xff)
  m.setU32((pPkt + 0x03) >>> 0, m.u32((pUnit + 0x0c) >>> 0) >>> 0)
  m.setU16((pPkt + 0x07) >>> 0, wSkillId & 0xffff)
  m.setU8((pPkt + 0x09) >>> 0, bBaseLevel & 0xff)
  const bBonus = SKILLS_GetUnitSkillBonusBySkillId113c(m, pUnit >>> 0, wSkillId & 0xffff) & 0xff
  m.setU8((pPkt + 0x0a) >>> 0, bBonus)

  NET_QueuePacketToClientBuffer113c(m, pTargetClient, 1, pPkt, 0x0c)
}

/**
 * [6/45] Builds and queues 16-byte (`0x10`) monster coordinate movement packet (`bPacketHeader` in `dl`,
 * e.g. `0x67`/`0x6D`) to `pClient` (`ebx`), overriding `(wTargetX, wTargetY)` with `PATH_GetLastPointX/Y`
 * when `PATH_GetType` is `5` or `6`, mapping path type `8` to `0x0B`, and clamping `STAT_VELOCITYPERCENT` (`0x43`) to `int16`.
 *
 * @va D2Game:0x6FCAD860
 */
export function NET_SendPacketMonsterMoveCoord_6FCAD860_113c(
  m: D2KernMemory113c,
  pClient: number,
  bPacketHeader: number,
  dwMonsterGuid: number,
  bMoveType: number,
  wTargetX: number,
  wTargetY: number,
  bByteA: number,
  bByteF: number,
  bByteB: number,
): void {
  hitD2GameVa113c(0x6FCAD860)
  if (pClient === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x996)
  }
  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x2d3)
  }

  const nBucket = dwMonsterGuid & 0x7f
  let pMonster = m.u32((pGame + nBucket * 4 + 0x1320) >>> 0) >>> 0
  while (pMonster !== 0 && m.u32((pMonster + 0x0c) >>> 0) !== (dwMonsterGuid >>> 0)) {
    pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
  }
  if (pMonster === 0) return

  const pPkt = m.alloc(0x10) >>> 0
  m.setU8(pPkt, bPacketHeader & 0xff)
  m.setU32((pPkt + 0x01) >>> 0, dwMonsterGuid >>> 0)
  m.setU8((pPkt + 0x05) >>> 0, bMoveType & 0xff)
  m.setU16((pPkt + 0x06) >>> 0, wTargetX & 0xffff)
  m.setU16((pPkt + 0x08) >>> 0, wTargetY & 0xffff)
  m.setU8((pPkt + 0x0a) >>> 0, bByteA & 0xff)
  m.setU8((pPkt + 0x0b) >>> 0, bByteB & 0xff)

  const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  const bPathType = PATH_GetType113c(m, pPath) & 0xff
  m.setU8((pPkt + 0x0c) >>> 0, bPathType)
  if (bPathType >= 5) {
    if (bPathType <= 6) {
      m.setU8((pPkt + 0x0c) >>> 0, 1)
      const wLastX = PATH_GetLastPointX113c(m, pPath) & 0xffff
      m.setU16((pPkt + 0x06) >>> 0, wLastX)
      const wLastY = PATH_GetLastPointY113c(m, pPath) & 0xffff
      m.setU16((pPkt + 0x08) >>> 0, wLastY)
    } else if (bPathType === 8) {
      m.setU8((pPkt + 0x0c) >>> 0, 0x0b)
    }
  }

  let nVelPct = STATLIST_GetUnitStat113c(m, pMonster, 0x43, 0) | 0
  if (nVelPct <= -0x8000) {
    nVelPct = -0x8000
  } else if (nVelPct >= 0x7fff) {
    nVelPct = 0x7fff
  }
  m.setU16((pPkt + 0x0d) >>> 0, nVelPct & 0xffff)
  m.setU8((pPkt + 0x0f) >>> 0, bByteF & 0xff)

  NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x10)
}

/**
 * [7/45] Builds and queues 21-byte (`0x15`) monster unit-target movement packet (`bPacketHeader` in `dl`,
 * e.g. `0x68`/`0x69`) to `pClient` (`ebx`), reading monster `(x, y)`, `PATH_GetType`, and clamped `STAT_VELOCITYPERCENT` (`0x43`).
 *
 * @va D2Game:0x6FCAD990
 */
export function NET_SendPacketMonsterTargetUnit_6FCAD990_113c(
  m: D2KernMemory113c,
  pClient: number,
  bPacketHeader: number,
  dwMonsterGuid: number,
  bMoveType: number,
  bTargetUnitType: number,
  dwTargetUnitGuid: number,
  bByteF: number,
  bByte14: number,
  bByte10: number,
): void {
  hitD2GameVa113c(0x6FCAD990)
  if (pClient === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x996)
  }
  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnitMsg.cpp', 0x2d3)
  }

  const nBucket = dwMonsterGuid & 0x7f
  let pMonster = m.u32((pGame + nBucket * 4 + 0x1320) >>> 0) >>> 0
  while (pMonster !== 0 && m.u32((pMonster + 0x0c) >>> 0) !== (dwMonsterGuid >>> 0)) {
    pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
  }
  if (pMonster === 0) return

  const pPkt = m.alloc(0x18) >>> 0
  m.setU8(pPkt, bPacketHeader & 0xff)
  m.setU32((pPkt + 0x01) >>> 0, dwMonsterGuid >>> 0)
  m.setU8((pPkt + 0x05) >>> 0, bMoveType & 0xff)
  m.setU8((pPkt + 0x0a) >>> 0, bTargetUnitType & 0xff)
  m.setU32((pPkt + 0x0b) >>> 0, dwTargetUnitGuid >>> 0)

  const uTypeX = m.u32(pMonster) | 0
  const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  let wPosX: number
  if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
    wPosX = m.u32((pPath + 0x0c) >>> 0) & 0xffff
  } else {
    wPosX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) & 0xffff : 0
  }
  m.setU16((pPkt + 0x06) >>> 0, wPosX)

  const uTypeY = m.u32(pMonster) | 0
  const pPathY = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  let wPosY: number
  if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
    wPosY = m.u32((pPathY + 0x10) >>> 0) & 0xffff
  } else {
    wPosY = pPathY !== 0 ? PATH_GetPosY113c(m, pPathY) & 0xffff : 0
  }
  m.setU16((pPkt + 0x08) >>> 0, wPosY)
  m.setU8((pPkt + 0x0f) >>> 0, bByteF & 0xff)
  m.setU8((pPkt + 0x10) >>> 0, bByte10 & 0xff)

  const bPathType = PATH_GetType113c(m, pPath) & 0xff
  m.setU8((pPkt + 0x11) >>> 0, bPathType === 8 ? 0x0b : bPathType)

  let nVelPct = STATLIST_GetUnitStat113c(m, pMonster, 0x43, 0) | 0
  if (nVelPct <= -0x8000) {
    nVelPct = -0x8000
  } else if (nVelPct >= 0x7fff) {
    nVelPct = 0x7fff
  }
  m.setU16((pPkt + 0x12) >>> 0, nVelPct & 0xffff)
  m.setU8((pPkt + 0x14) >>> 0, bByte14 & 0xff)

  NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt, 0x15)
}

/**
 * [8/45] Dispatches world item packet `0x9C` for command `0x38` (action `0x0B`, setting `bFlag=1` when
 * `ITEMS_IsHighQualityItem113c` is true and command flag `0x10` is clear) or `0x39` (temporarily swapping
 * `InvPage` to `ITEMS_GetNodePage113c` around action `0x0C`).
 *
 * @va D2Game:0x6FCADDA0
 */
export function ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(
  m: D2KernMemory113c,
  bCmdCode: number,
  pItem: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCADDA0)
  const nCode = bCmdCode & 0xff
  if (nCode === 0x38) {
    let bFlag = 0
    if ((ITEMS_IsHighQualityItem113c(m, pItem >>> 0) | 0) !== 0) {
      if ((ITEMS_CheckCommandFlags113c(m, pItem >>> 0, 0x10, 0x9c2, 0x6fd1bae8) | 0) === 0) {
        bFlag = 1
      }
    }
    S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x0b, 0, bFlag)
    return
  }
  if (nCode === 0x39) {
    const nSavedInvPage = ITEMS_GetInvPage113c(m, pItem >>> 0) & 0xff
    const nNodePage = ITEMS_GetNodePage113c(m, pItem >>> 0)
    ITEMS_SetInvPage113c(m, pItem >>> 0, nNodePage)
    S2C_SendPacket9C_ItemActionWorld113c(m, pClient >>> 0, pItem >>> 0, 0x0c, 0, 0)
    ITEMS_SetInvPage113c(m, pItem >>> 0, nSavedInvPage)
  }
}

/**
 * [9/45] Iterates all items in `pInventory` (`eax`) using `INVENTORY_GetFirstItem113c` / `INVENTORY_GetNextItem113c`,
 * asserting each node is a valid item via `INVENTORY_UnitIsItem113c`, calling `INVENTORY_GetItemNodePositionOther113c`,
 * and freeing the item unit via `SUNIT_FreeUnit113c`.
 *
 * @va D2Game:0x6FCAF470
 */
export function INVENTORY_FreeAllItems_6FCAF470_113c(
  m: D2KernMemory113c,
  pInventory: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCAF470)
  if (pInventory === 0) return
  let pItem = INVENTORY_GetFirstItem113c(m, pInventory >>> 0) >>> 0
  while (pItem !== 0) {
    const pValidItem = INVENTORY_UnitIsItem113c(m, pItem) >>> 0
    const pNextItem = INVENTORY_GetNextItem113c(m, pItem) >>> 0
    if (pValidItem === 0) {
      throw new D2CommonAssertError('SUnitNpc.cpp', 0x1c6)
    }
    INVENTORY_GetItemNodePositionOther113c(m, pItem)
    SUNIT_FreeUnit113c(m, pGame >>> 0, pValidItem)
    pItem = pNextItem
  }
}

/**
 * [10/45] Clones static NPC/mercenary tables for record `nNpcIdx` (`eax < 0x11`) from `0x6FD30200 + nNpcIdx * 16`
 * (`count1 * 12` bytes at `+0x08/+0x0C` and `count2 * 4` bytes at `+0x10/+0x14`) into `pOutEntry` (`[esp+8]`).
 *
 * @va D2Game:0x6FCAF4E0
 */
export function NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c(
  m: D2KernMemory113c,
  nNpcIdx: number,
  pGame: number,
  pOutEntry: number,
): void {
  hitD2GameVa113c(0x6FCAF4E0)
  const idx = nNpcIdx | 0
  if (idx >= 0x11) {
    throw new D2CommonAssertError('SUnitNpc.cpp', 0xa4)
  }
  const pStaticRec = (0x6fd30200 + ((idx << 4) >>> 0)) >>> 0
  const nCount1 = m.u32((pStaticRec + 0x0c) >>> 0) >>> 0
  m.setU32((pOutEntry + 0x04) >>> 0, nCount1)
  void m.u32((pGame + 0x1c) >>> 0)
  const nBytes1 = (nCount1 * 12) >>> 0
  const pBuf1 = m.alloc(nBytes1 > 0 ? nBytes1 : 4) >>> 0
  m.setU32(pOutEntry >>> 0, pBuf1)
  const pSrc1 = m.u32((pStaticRec + 0x08) >>> 0) >>> 0
  for (let i = 0; i < nBytes1; i = (i + 1) | 0) {
    m.setU8((pBuf1 + i) >>> 0, m.u8((pSrc1 + i) >>> 0))
  }

  const nCount2 = m.u32((pStaticRec + 0x14) >>> 0) >>> 0
  m.setU32((pOutEntry + 0x0c) >>> 0, nCount2)
  void m.u32((pGame + 0x1c) >>> 0)
  const nBytes2 = (nCount2 << 2) >>> 0
  const pBuf2 = m.alloc(nBytes2 > 0 ? nBytes2 : 4) >>> 0
  m.setU32((pOutEntry + 0x08) >>> 0, pBuf2)
  const pSrc2 = m.u32((pStaticRec + 0x10) >>> 0) >>> 0
  for (let i = 0; i < nBytes2; i = (i + 1) | 0) {
    m.setU8((pBuf2 + i) >>> 0, m.u8((pSrc2 + i) >>> 0))
  }
}

/**
 * [11/45] Walks `pGame->pNpcControl` (`+0x1D24`) entries (`0x44` bytes each) and prepends a 20-byte
 * (`0x14`) event node (`[0]=dwUnitGuid`, `[4]=4`, `[8]=1`, `[0xC]=0`, `[0x10]=pPrev`) at entry `+0x14`
 * (`esi-0x0C`) for every entry where `u32(+0x1C)==1 && u8(+0x20)==1 && u8(+0x23)==1`.
 *
 * @va D2Game:0x6FCAF720
 */
export function NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwUnitGuid: number,
): void {
  hitD2GameVa113c(0x6FCAF720)
  const pNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
  const pEntries = m.u32((pNpcCtrl + 0x04) >>> 0) >>> 0
  if (i32(m, pNpcCtrl) <= 0) return

  let pCursor = (pEntries + 0x20) >>> 0
  let idx = 0
  while (idx < i32(m, pNpcCtrl)) {
    if (
      m.u8((pCursor + 0x03) >>> 0) === 1 &&
      m.u8(pCursor) === 1 &&
      m.u32((pCursor - 0x04) >>> 0) === 1
    ) {
      void m.u32((pGame + 0x1c) >>> 0)
      const pNode = m.alloc(0x14) >>> 0
      m.setU32((pNode + 0x10) >>> 0, m.u32((pCursor - 0x0c) >>> 0) >>> 0)
      m.setU32((pNode + 0x0c) >>> 0, 0)
      m.setU32(pNode, dwUnitGuid >>> 0)
      m.setU32((pNode + 0x08) >>> 0, 1)
      m.setU32((pNode + 0x04) >>> 0, 4)
      m.setU32((pCursor - 0x0c) >>> 0, pNode)
    }
    idx = (idx + 1) | 0
    pCursor = (pCursor + 0x44) >>> 0
  }
}

/**
 * [12/45] Allocates a 20-byte (`0x14`) NPC item queue node (`[0]=pItem`, `[8]=dwArg2`, `[0xC]=1`)
 * and links it onto `pSlot+0x14` when `D2GAME_ARENA_FindPlayerSlotByUnit113c` finds the slot for
 * `pNpcUnit->dwClassId`; otherwise removes `pItem` from all living players and frees `pItem`.
 *
 * @va D2Game:0x6FCB0260
 */
export function NPCS_QueueOrFreeVendorItem_6FCB0260_113c(
  m: D2KernMemory113c,
  pGame: number,
  pNpcUnit: number,
  pItem: number,
  dwArg2: number,
): void {
  hitD2GameVa113c(0x6FCB0260)
  void m.u32((pGame + 0x1c) >>> 0)
  const pNode = m.alloc(0x14) >>> 0
  const dwNpcClassId = pNpcUnit !== 0 ? m.u32((pNpcUnit + 0x04) >>> 0) >>> 0 : 0xffffffff
  const pOutIdx = m.alloc(4) >>> 0
  const pSlot = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutIdx, pGame >>> 0, dwNpcClassId) >>> 0
  if (pSlot !== 0) {
    m.setU32((pNode + 0x10) >>> 0, m.u32((pSlot + 0x14) >>> 0) >>> 0)
    m.setU32((pSlot + 0x14) >>> 0, pNode)
    m.setU32(pNode, pItem >>> 0)
    m.setU32((pNode + 0x0c) >>> 0, 1)
    m.setU32((pNode + 0x08) >>> 0, dwArg2 >>> 0)
    return
  }

  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame >>> 0,
    (mem, _g, pPlayer, pTargetItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlayer, pTargetItem)
    },
    pItem >>> 0,
  )
  SUNIT_FreeUnit113c(m, pGame >>> 0, pItem >>> 0)
}

/**
 * [13/45] Checks whether `pPlayer` (`[esp+4]`) is leaving a town level (`1`, `40`, `75`, `103`) in
 * a non-type-3 game (`u8(pGame+0x6A) != 3`), counts players in that town via `ARENA_CountPlayersInLevelCallback113c`,
 * and calls `NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, nAct, nCount - 1 == 0 ? 1 : 0)`.
 *
 * @va D2Game:0x6FCB0560
 */
export function NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCB0560)
  if (m.u8((pGame + 0x6a) >>> 0) === 3) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) return

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  let nAct = -1
  if (nLevelId === 1) {
    nAct = 0
  } else if (nLevelId === 40) {
    nAct = 1
  } else if (nLevelId === 75) {
    nAct = 2
  } else if (nLevelId === 103) {
    nAct = 3
  } else {
    return
  }

  const pCtx = m.alloc(8) >>> 0
  m.setU32(pCtx, nLevelId >>> 0)
  m.setU32((pCtx + 0x04) >>> 0, 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame >>> 0,
    ARENA_CountPlayersInLevelCallback113c,
    pCtx,
  )
  const nRemaining = (i32(m, (pCtx + 0x04) >>> 0) - 1) | 0
  m.setU32((pCtx + 0x04) >>> 0, nRemaining >>> 0)
  const bTownEmpty = nRemaining === 0 ? 1 : 0
  NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame >>> 0, nAct, bTownEmpty)
}

const MISSILE_ZIGZAG_DX_6FD1BA80 = [2, 2, 0, -2, -2, -2, 0, 2] as const
const MISSILE_ZIGZAG_DY_6FD1BA60 = [0, 2, 2, 2, 0, -2, -2, -2] as const

/**
 * [14/45] Builds a randomized oscillating missile path of up to `0x4D` (`77`) points for `pMissile` (`ecx`)
 * using `SEED_InitLowSeed113c(pMissile + 0x20, nLowSeed)`, `PATH_SetType(pPath, 10)`, and periodic direction
 * reversals every `*(int32*)0x6FD2F148` (`15`) frames.
 *
 * @va D2Game:0x6FCB1040
 */
export function MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c(
  m: D2KernMemory113c,
  pMissile: number,
  nLowSeed: number,
): void {
  hitD2GameVa113c(0x6FCB1040)
  if (pMissile === 0) return

  let nFrames = MISSILE_GetTotalFrames113c(m, pMissile >>> 0) | 0
  if (nFrames >= 0x4e) {
    nFrames = 0x4d
    MISSILE_SetTotalFrames113c(m, pMissile >>> 0, 0x4d)
    MISSILE_SetRemainingFrames113c(m, pMissile >>> 0, 0x4d)
  }

  const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  const pSeed = (pMissile + 0x20) >>> 0
  SEED_InitLowSeed113c(m, pSeed, nLowSeed >>> 0)
  PATH_SetType113c(m, pPath, 0x0a)
  PATH_SetNewDistance113c(m, pPath, nFrames)

  const ppPathPoints = m.alloc(4) >>> 0
  PATH_GetPathPoints113c(m, pPath, ppPathPoints)
  const pPathPoints = m.u32(ppPathPoints) >>> 0

  const uType0 = m.u32(pMissile >>> 0) | 0
  let nCurX: number
  if (uType0 === 2 || (uType0 > 3 && uType0 <= 5)) {
    nCurX = i32(m, (m.u32((pMissile + 0x2c) >>> 0) + 0x0c) >>> 0)
  } else {
    const pPathX = m.u32((pMissile + 0x2c) >>> 0) >>> 0
    nCurX = pPathX !== 0 ? PATH_GetPosX113c(m, pPathX) | 0 : 0
  }

  const uType1 = m.u32(pMissile >>> 0) | 0
  let nCurY: number
  if (uType1 === 2 || (uType1 > 3 && uType1 <= 5)) {
    nCurY = i32(m, (m.u32((pMissile + 0x2c) >>> 0) + 0x10) >>> 0)
  } else {
    const pPathY = m.u32((pMissile + 0x2c) >>> 0) >>> 0
    nCurY = pPathY !== 0 ? PATH_GetPosY113c(m, pPathY) | 0 : 0
  }

  const pPathCur = m.u32((pMissile + 0x2c) >>> 0) >>> 0
  const nFirstY = PATH_GetFirstPointY113c(m, pPathCur)
  const nFirstX = PATH_GetFirstPointX113c(m, pPathCur)
  let nDir = UNITS_GetDirectionToCoords113c(m, pMissile >>> 0, nFirstX, nFirstY) & 0xff

  const prod1 =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo1 = Number(prod1 & 0xffffffffn) >>> 0
  const hi1 = Number((prod1 >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed, lo1)
  let nSign = (lo1 & 1) !== 0 ? 1 : -1

  const prod2 = BigInt(lo1) * 0x6ac690c5n + BigInt(hi1)
  const lo2 = Number(prod2 & 0xffffffffn) >>> 0
  const hi2 = Number((prod2 >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, hi2)
  m.setU32(pSeed, lo2)

  const nBaseStep = 2
  const nPeriod = 15
  let nStepMag = ((lo2 % 3) + nBaseStep) | 0

  for (let i = 0; i < nFrames; i = (i + 1) | 0) {
    nDir = (nDir + Math.imul(nStepMag, nSign)) | 0
    const nNormDir = DATATBLS_NormalizeDirection113c(m, (nDir & 0xffffff3f) | 0) & 0xff
    const dx = MISSILE_ZIGZAG_DX_6FD1BA80[nNormDir & 7] as number
    const dy = MISSILE_ZIGZAG_DY_6FD1BA60[nNormDir & 7] as number
    nCurX = (nCurX + dx) | 0
    nCurY = (nCurY + dy) | 0
    m.setU16((pPathPoints + i * 4) >>> 0, nCurX & 0xffff)
    m.setU16((pPathPoints + i * 4 + 2) >>> 0, nCurY & 0xffff)

    if (i % nPeriod === 0) {
      const prod =
        BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
      const lo = Number(prod & 0xffffffffn) >>> 0
      const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      m.setU32((pSeed + 0x04) >>> 0, hi)
      m.setU32(pSeed, lo)
      nSign = -nSign | 0
      nStepMag = ((lo % 3) + nBaseStep) | 0
    }
  }

  PATH_SetNumberOfPathPoints113c(m, pPath, nFrames)
}

/**
 * [15/45] Evaluates skill calc expression for `nSkillId` (`edi`) at `nLevel` (`[esp+4]`) on `pUnit` (`ebx`),
 * selecting stage-specific calc (`pSkillsTxt + clamp(nStage, 1, 3)*4 + 0x34`) when bit 2 of `pSkillsTxt->dwFlags[0]`
 * (`+0x04`) is set and the unit has an active aura statlist for `wAuraState` (`+0x80`) with `wPassiveStat` (`+0x54`).
 *
 * @va D2Game:0x6FCB1240
 */
export function SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCB1240)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & 0x04) !== 0) {
    const nAuraState = (m.u16((pSkillsTxt + 0x80) >>> 0) << 16) >> 16
    if (nAuraState >= 0 && nAuraState < i32(m, (pDataTables + 0xc4) >>> 0)) {
      const nPassiveStat = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
      if (nPassiveStat >= 0 && nPassiveStat < i32(m, (pDataTables + 0xbd4) >>> 0)) {
        const pStatList =
          STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, nAuraState) >>> 0
        if (pStatList === 0) {
          return (
            SKILLS_EvalCalcByOffset113c(
              m,
              pUnit >>> 0,
              m.u32((pSkillsTxt + 0x38) >>> 0),
              skillId,
              nLevel | 0,
            ) | 0
          )
        }
        let nStage = STATLIST_GetStatValue113c(m, pStatList, nPassiveStat, 0) | 0
        if (nStage <= 1) {
          nStage = 1
        } else if (nStage >= 3) {
          nStage = 3
        }
        const dwStageCalc = m.u32((pSkillsTxt + nStage * 4 + 0x34) >>> 0) >>> 0
        return SKILLS_EvalCalcByOffset113c(m, pUnit >>> 0, dwStageCalc, skillId, nLevel | 0) | 0
      }
    }
  }

  return (
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x38) >>> 0),
      skillId,
      nLevel | 0,
    ) | 0
  )
}


/**
 * [16/45] Adds delayed charge attack rating bonus (`SKILLS_EvalLinearParam12_6FC21B10_113c`) to
 * `pDmg->dwHitRate` (`+0x38`) and (for stages 2..3) `pDmg->dwToHitFactor` (`+0x3C`) based on
 * `STAT_SKILL_DELAYED_CHARGE_ID` (`0x15E`), `STAT_SKILL_DELAYED_CHARGE_LVL` (`0x15F`), and `wPassiveStat` (`+0x54`).
 *
 * @va D2Game:0x6FCB1400
 */
export function SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pStatList: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB1400)
  const nSkillId = STATLIST_GetStatValue113c(m, pStatList >>> 0, 0x15e, 0) | 0
  if (nSkillId < 0) return
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  let nSkillLvl = STATLIST_GetStatValue113c(m, pStatList >>> 0, 0x15f, 0) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit >>> 0, nSkillId) >>> 0
  const nUnitLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, pSkill, 1) | 0
  if (nUnitLvl > nSkillLvl) {
    nSkillLvl = nUnitLvl
  }
  if (nSkillLvl <= 0) return

  const nPassiveStat = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
  if (nPassiveStat < 0 || nPassiveStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) return

  const nStage = STATLIST_GetStatValue113c(m, pStatList >>> 0, nPassiveStat, 0) | 0
  if (nStage <= 0) return

  let nBonus = SKILLS_EvalLinearParam12_6FC21B10_113c(m, nSkillId, nSkillLvl) | 0
  if (nStage === 1) {
    m.setU32((pDmg + 0x38) >>> 0, (i32(m, (pDmg + 0x38) >>> 0) + nBonus) >>> 0)
    return
  }
  if (nStage === 2) {
    m.setU32((pDmg + 0x38) >>> 0, (i32(m, (pDmg + 0x38) >>> 0) + nBonus) >>> 0)
    m.setU32((pDmg + 0x3c) >>> 0, (i32(m, (pDmg + 0x3c) >>> 0) + nBonus) >>> 0)
    return
  }
  if (nStage === 3) {
    nBonus = (nBonus + nBonus) | 0
    m.setU32((pDmg + 0x38) >>> 0, (i32(m, (pDmg + 0x38) >>> 0) + nBonus) >>> 0)
    m.setU32((pDmg + 0x3c) >>> 0, (i32(m, (pDmg + 0x3c) >>> 0) + nBonus) >>> 0)
  }
}

/**
 * [17/45] Restores a converted monster (`pUnit` in `ecx`) when its conversion state (`nState` in `edx`) expires:
 * resets alignment to `0`, clears `nState`, unlinks from room update list, restores original `STAT_LEVEL` (`0x0C`),
 * `STAT_MAXHP` (`0x07`), and scaled `STAT_HITPOINTS` (`0x06`) from state `0x6D` (`STATE_CONVERSION_SAVE`) statlist,
 * and unlinks/frees all flag `0x08` sublists.
 *
 * @va D2Game:0x6FCB14F0
 */
export function SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB14F0)
  SUNIT_SetMonsterAlignmentState113c(m, pUnit >>> 0, 0, 1)
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState | 0, 0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0xa2a)
  }

  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit >>> 0)

  const pSaveList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 0x6d) >>> 0
  if (pSaveList !== 0) {
    const nSavedLevel = STATLIST_GetStatValue113c(m, pSaveList, 0xb0, 0) | 0
    const nSavedMaxHp = STATLIST_GetStatValue113c(m, pSaveList, 0xb1, 0) | 0
    const nCurMaxHpShifted = STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0
    let nNewHp = nCurMaxHpShifted >> 8
    const nCurHp = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) >> 8
    let nScaledHp = mulDiv113c(nCurHp, nSavedMaxHp, nNewHp) | 0
    if (nScaledHp <= 1) {
      nScaledHp = 1
    }
    if (nScaledHp < nNewHp) {
      nNewHp = nScaledHp
    }
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0c, nSavedLevel, 0)
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x06, (nNewHp << 8) | 0, 0)
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x07, (nSavedMaxHp << 8) | 0, 0)
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pSaveList)
    STATLIST_FreeStatListIfNonExtended113c(m, pSaveList)
  }

  let pFlag8List = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit >>> 0, 0x08) >>> 0
  while (pFlag8List !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pFlag8List)
    STATLIST_FreeStatListIfNonExtended113c(m, pFlag8List)
    pFlag8List = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit >>> 0, 0x08) >>> 0
  }
}

/**
 * [18/45] Scales a summoned/buffed monster's max/current life by `(nLevel - 1) * dwParam8 / 100`,
 * merges an aura/passive statlist (`pSkillsTxt + 0x54..0x5E` via `+0x6C`, and `+0x98..0xA0` via `+0xA8`),
 * and optionally assigns `wMonUMod` (`pSkillsTxt + 0xE4` in `1..0x2A`) to `pMonData->abMonUMod[0..8]`.
 *
 * @va D2Game:0x6FCB1660
 */
const DEFAULT_MONUMOD_TABLE_W4B5_6FD2E550: readonly number[] = [
  0, 0x6fc43020, 0x6fc42fa0, 0, 0x6fc41e80, 0x6fc42bc0, 0x6fc42880, 0,
  0x6fc41be0, 0x6fc42740, 0, 0, 0, 0, 0, 0,
  0x6fc42da0, 0x6fc42600, 0x6fc42490, 0, 0, 0, 0, 0x6fc42320,
  0, 0x6fc421d0, 0x6fc441b0, 0x6fc41be0, 0x6fc41be0, 0, 0x6fc44cd0, 0,
  0, 0, 0, 0, 0x6fc43850, 0x6fc43810, 0x6fc437c0, 0x6fc42d00,
  0, 0x6fc469f0, 0,
]

export function SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c(
  m: D2KernMemory113c,
  pSkillsTxt: number,
  pGame: number,
  pMonster: number,
  nSkillId: number,
  nLevel: number,
  onMonUMod?: (
    m: D2KernMemory113c,
    pfn: number,
    pMonster: number,
    nMonUMod: number,
    bBoss: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FCB1660)
  const lvl = nLevel | 0
  if (lvl <= 1) return

  let dwParam8 = 0
  const skillId = nSkillId | 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (skillId >= 0 && pDataTables !== 0 && skillId < i32(m, (pDataTables + 0xba0) >>> 0)) {
    const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
    const pLookupTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
    if (pLookupTxt !== 0) {
      dwParam8 = i32(m, (pLookupTxt + 0x148) >>> 0)
    }
  }

  const nPct = Math.imul((lvl - 1) | 0, dwParam8) | 0
  let nMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, pMonster >>> 0) | 0
  let nHpBonus: number
  if (nMaxHp > 0x100000) {
    nHpBonus = Math.imul((nMaxHp / 100) | 0, nPct) | 0
  } else if (nPct > 0x10000) {
    nHpBonus = Math.imul((nPct / 100) | 0, nMaxHp) | 0
  } else {
    nHpBonus = (Math.imul(nMaxHp, nPct) / 100) | 0
  }
  nMaxHp = (nMaxHp + nHpBonus) | 0
  STATLIST_SetUnitStat113c(m, pMonster >>> 0, 7, nMaxHp, 0)
  STATLIST_SetUnitStat113c(m, pMonster >>> 0, 6, nMaxHp, 0)

  const dwOwnerType = pMonster !== 0 ? m.u32(pMonster >>> 0) | 0 : 6
  const dwOwnerId = pMonster !== 0 ? m.u32((pMonster + 0x0c) >>> 0) >>> 0 : 0xffffffff
  void m.u32((pGame + 0x1c) >>> 0)
  const pList = STATLIST_AllocList113c(m, 0, dwOwnerType, dwOwnerId, 0, 0) >>> 0
  if (pList === 0) return

  STATLIST_MergeStatLists113c(m, pMonster >>> 0, pList, 1)

  const nStatCount = pDataTables !== 0 ? i32(m, (pDataTables + 0xbd4) >>> 0) : 0
  for (let i = 0; i < 6; i = (i + 1) | 0) {
    const nStatId = (m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0) << 16) >> 16
    if (nStatId >= 0 && nStatId < nStatCount) {
      const nVal =
        SKILLS_EvalCalcByOffset113c(
          m,
          pMonster >>> 0,
          m.u32((pSkillsTxt + 0x6c) >>> 0),
          skillId,
          lvl,
        ) | 0
      STATLIST_SetStat113c(m, pList, nStatId, nVal, 0)
    }
  }

  for (let i = 0; i < 5; i = (i + 1) | 0) {
    const nStatId = (m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0) << 16) >> 16
    if (nStatId >= 0 && nStatId < nStatCount) {
      const nVal =
        SKILLS_EvalCalcByOffset113c(
          m,
          pMonster >>> 0,
          m.u32((pSkillsTxt + 0xa8) >>> 0),
          skillId,
          lvl,
        ) | 0
      STATLIST_SetStat113c(m, pList, nStatId, nVal, 0)
    }
  }

  const nMonUMod = (m.u16((pSkillsTxt + 0xe4) >>> 0) << 16) >> 16
  if (nMonUMod > 0 && nMonUMod < 0x2b && pMonster !== 0 && m.u32(pMonster >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pUModArr = (pMonData + 0x1c) >>> 0
      if (pUModArr !== 0) {
        MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pMonster >>> 0, pGame >>> 0)
        for (let slot = 0; slot < 9; slot = (slot + 1) | 0) {
          if (m.u8((pUModArr + slot) >>> 0) === 0) {
            m.setU8((pUModArr + slot) >>> 0, nMonUMod & 0xff)
            let pfnUMod = 0
            try {
              pfnUMod = m.u32((0x6fd2e550 + nMonUMod * 4) >>> 0) >>> 0
            } catch {
              pfnUMod = 0
            }
            if (pfnUMod === 0 && nMonUMod < DEFAULT_MONUMOD_TABLE_W4B5_6FD2E550.length) {
              pfnUMod = DEFAULT_MONUMOD_TABLE_W4B5_6FD2E550[nMonUMod]! >>> 0
            }
            if (pfnUMod !== 0) {
              if (onMonUMod !== undefined) {
                onMonUMod(m, pfnUMod, pMonster >>> 0, nMonUMod, 1)
              } else if (pfnUMod === 0x6fc43020) {
                MONUMOD_RollBossOrMinionNameSeed113c(m, pMonster >>> 0, nMonUMod, 1)
              }
            }
            break
          }
        }
      }
    }
  }
}

/**
 * [19/45] Multiplies skill calc `pSkillsTxt->dwCalc1` (`+0x138`) by charge count (`wPassiveStat` at `+0x54`),
 * adds it to `pDmg->dwPhysDamagePct` (`+0x0C`), and sets `wOverlay` (`+0x108`) on the validated target unit.
 *
 * @va D2Game:0x6FCB1F10
 */
export function SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pStatList: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCB1F10)
  const nSkillId = STATLIST_GetStatValue113c(m, pStatList >>> 0, 0x15e, 0) | 0
  if (nSkillId < 0) return
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return

  let nSkillLvl = STATLIST_GetStatValue113c(m, pStatList >>> 0, 0x15f, 0) | 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit >>> 0, nSkillId) >>> 0
  const nUnitLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, pSkill, 1) | 0
  if (nUnitLvl > nSkillLvl) {
    nSkillLvl = nUnitLvl
  }
  if (nSkillLvl <= 0) return

  const nPassiveStat = (m.u16((pSkillsTxt + 0x54) >>> 0) << 16) >> 16
  if (nPassiveStat < 0 || nPassiveStat >= i32(m, (pDataTables + 0xbd4) >>> 0)) return

  const nStage = STATLIST_GetStatValue113c(m, pStatList >>> 0, nPassiveStat, 0) | 0
  if (nStage <= 0) return

  const nCalcVal =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLvl,
    ) | 0
  const nTotalPct = Math.imul(nCalcVal, nStage) | 0
  m.setU32((pDmg + 0x0c) >>> 0, (i32(m, (pDmg + 0x0c) >>> 0) + nTotalPct) >>> 0)

  const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pUnit >>> 0) >>> 0
  const pTarget = SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pUnit >>> 0, pGame) >>> 0
  if (pTarget !== 0) {
    const nOverlay = (m.u16((pSkillsTxt + 0x108) >>> 0) << 16) >> 16
    if (nOverlay > 0 && nOverlay < i32(m, (pDataTables + 0xbc0) >>> 0)) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, nOverlay, 0)
    }
  }
}

/**
 * [20/45] Radial damage callback (`pAuraCtx` in `ecx`, `pTargetUnit` in `edx`) that copies the 112-byte
 * (`0x70`) template `D2DamageStrc` from `**(pAuraCtx+0x0C)`, evaluates hit flags (`0x6FCFE5A0`), optionally
 * fills weapon damage values (`SUNITDMG_FillDamageValues113c`), and dispatches `SUNITDMG_AllocCombat113c` + `SUNITDMG_ExecuteEvents113c`.
 *
 * @va D2Game:0x6FCB3040
 */
export function SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCB3040)
  const pSub = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  const pSrcDmg = m.u32(pSub) >>> 0
  const pDmg = m.alloc(0x70) >>> 0
  for (let i = 0; i < 0x70; i += 4) {
    m.setU32((pDmg + i) >>> 0, m.u32((pSrcDmg + i) >>> 0) >>> 0)
  }

  const pGame = m.u32(pAuraCtx >>> 0) >>> 0
  const pAttacker = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const nToHitBonus = i32(m, (pSub + 0x04) >>> 0)
  const wPresetResult = m.u16((pSub + 0x08) >>> 0)

  if ((wPresetResult & 1) === 0) {
    const wRolled =
      SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
        m,
        pAttacker,
        pTargetUnit >>> 0,
        pGame,
        nToHitBonus,
        1,
        0,
      ) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wRolled)
    if ((wRolled & 1) === 0) {
      return 1
    }
    m.setU16((pDmg + 0x04) >>> 0, (wRolled | wPresetResult) & 0xffff)
  } else {
    m.setU16((pDmg + 0x04) >>> 0, wPresetResult)
  }

  if ((m.u8((pDmg + 0x04) >>> 0) & 1) !== 0) {
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pSub + 0x0c) >>> 0)) >>> 0)
    const bSrcDam = m.u8((pSub + 0x10) >>> 0)
    if (bSrcDam !== 0) {
      SUNITDMG_FillDamageValues113c(
        m,
        pGame,
        pAttacker,
        pTargetUnit >>> 0,
        pDmg,
        0,
        bSrcDam,
      )
    }
    SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pTargetUnit >>> 0, pDmg, 0x80)
    SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pTargetUnit >>> 0, 1, 0)
  }
  return 1
}


/**
 * [21/45] Validates `pUnit`'s path target unit, resolves charged server missile ID (`SKILLS_ResolveChargedSrvMissileId113c`),
 * adds `DATATBLS_CalcMissileSubLoopFrames113c` + `SKILLS_EvalCalcByOffset113c(pSkillsTxt->dwCalc1)` velocity override,
 * and spawns a 64-direction nova (`MISSILE_SpawnNova64Directions113c`) centered on the target unit.
 *
 * @va D2Game:0x6FCB5040
 */
export function SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCB5040)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) return 0

  const lvl = nLevel | 0
  if (lvl <= 0) return 0

  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, pUnit >>> 0) | 0
  if (nMissileId <= 0) return 0

  const nSubLoopFrames = DATATBLS_CalcMissileSubLoopFrames113c(m, nMissileId, lvl) | 0
  const nCalcBonus =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      skillId,
      lvl,
    ) | 0
  const nVelOverride = (nSubLoopFrames + nCalcBonus) | 0

  MISSILE_SpawnNova64Directions113c(
    m,
    pTarget,
    nVelOverride,
    pGame >>> 0,
    pUnit >>> 0,
    nMissileId,
    skillId,
    lvl,
  )
  return 1
}

/**
 * [22/45] Applies or increments a progressive charge-up skill stat (`nStatId`, capped at 3) on `pUnit` (`ebx`)
 * for state `nState`, refreshing expiration (`pGame->dwGameFrame + auralencalc`) and timer event `0x0C`,
 * and adding `pSkillsTxt->wAuraStat2` (`+0x56`) via `pSkillsTxt->dwAuraStatCalc1` (`+0x6C`) when a new stage is gained.
 *
 * @va D2Game:0x6FCB5370
 */
export function SKILLS_AddProgressiveChargeStage_6FCB5370_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  nLevel: number,
  nState: number,
  nStatId: number,
): number {
  hitD2GameVa113c(0x6FCB5370)
  void STATES_ClearGfxStateFlagCallback_6FCB0F00_113c
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const lvl = nLevel | 0
  const stateId = nState | 0
  const statId = nStatId | 0
  const nAuraLen =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x60) >>> 0),
      skillId,
      lvl,
    ) | 0
  const nExpireFrame = (i32(m, (pGame + 0xa8) >>> 0) + nAuraLen) | 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, stateId) >>> 0
  if (pStatList === 0) {
    const dwOwnerType = pUnit !== 0 ? m.u32(pUnit >>> 0) | 0 : 6
    const dwOwnerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
    void m.u32((pGame + 0x1c) >>> 0)
    pStatList = STATLIST_AllocList113c(m, 2, dwOwnerType, dwOwnerId, 0, nExpireFrame) >>> 0
    if (pStatList === 0) return 0

    STATLIST_SetState113c(m, pStatList, stateId)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcb0f00)
    STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
    STATLIST_SetStat113c(m, pStatList, 0x15e, skillId, 0)
    STATLIST_SetStat113c(m, pStatList, 0x15f, lvl, 0)
  }

  STATLIST_SetExpireFrameEx113c(m, pStatList, nExpireFrame)
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nExpireFrame, 0, 0, 0)

  const nCurCharges = STATLIST_GetStatValue113c(m, pStatList, statId, 0) | 0
  let nNextCharges = (nCurCharges + 1) | 0
  if (nNextCharges > 3) {
    nNextCharges = 3
  }
  if (nCurCharges !== nNextCharges) {
    STATLIST_SetStat113c(m, pStatList, statId, nNextCharges, 0)
    const nAuraStat2 = (m.u16((pSkillsTxt + 0x56) >>> 0) << 16) >> 16
    if (nAuraStat2 >= 0 && nAuraStat2 < i32(m, (pDataTables + 0xbd4) >>> 0)) {
      const nAddVal =
        SKILLS_EvalCalcByOffset113c(
          m,
          pUnit >>> 0,
          m.u32((pSkillsTxt + 0x6c) >>> 0),
          skillId,
          lvl,
        ) | 0
      STATLIST_AddStatMemPort113c(m, pStatList, nAuraStat2, nAddVal, 0)
    }
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, stateId, 1)
    STATES_ClearGfxStateFlag113c(m, pUnit >>> 0, stateId, 1)
  }
  return 1
}

/**
 * [23/45] Searches all pet type buckets (`1..nPetTypesTxtRecordCount-1`) in `pPlayerData->pPlayerPets` (`+0x44`)
 * for a pet node with `dwPetGuid == ebx` (`+0x04`), returning `pPetNode + 0x08` (`D2PetArgStrc*`) or `0`.
 *
 * @va D2Game:0x6FCB6570
 */
export function PETS_FindPetArgByGuid_6FCB6570_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  dwPetGuid: number,
): number {
  hitD2GameVa113c(0x6FCB6570)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) return 0
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) return 0

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  const nPetTypes = i32(m, (pDataTables + 0xbf0) >>> 0)
  if (nPetTypes <= 1) return 0

  const targetGuid = dwPetGuid >>> 0
  for (let nType = 1, nOff = 0x0c; nType < nPetTypes; nType = (nType + 1) | 0, nOff = (nOff + 0x0c) | 0) {
    if (nOff >= 0) {
      const pListBase = m.u32(pPlayerPets) >>> 0
      const pSlot = (pListBase + nOff) >>> 0
      if (pSlot !== 0) {
        let pNode = m.u32(pSlot) >>> 0
        while (pNode !== 0) {
          if (m.u32((pNode + 0x04) >>> 0) === targetGuid) {
            return (pNode + 0x08) >>> 0
          }
          pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
        }
      }
    }
  }
  return 0
}

/**
 * [24/45] Searches all pet type buckets (`1..nPetTypesTxtRecordCount-1`) in `pPlayerData->pPlayerPets` (`+0x44`)
 * for a pet node with `dwPetGuid == ebx` (`+0x04`), returning the matching `nPetType` index or `0`.
 *
 * @va D2Game:0x6FCB6600
 */
export function PETS_FindPetTypeByGuid_6FCB6600_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  dwPetGuid: number,
): number {
  hitD2GameVa113c(0x6FCB6600)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('SUnitProxy.cpp', 0x3dc)
  }
  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) return 0

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  const nPetTypes = i32(m, (pDataTables + 0xbf0) >>> 0)
  if (nPetTypes <= 1) return 0

  const targetGuid = dwPetGuid >>> 0
  for (let nType = 1, nOff = 0x0c; nType < nPetTypes; nType = (nType + 1) | 0, nOff = (nOff + 0x0c) | 0) {
    if (nOff >= 0) {
      const pListBase = m.u32(pPlayerPets) >>> 0
      const pSlot = (pListBase + nOff) >>> 0
      if (pSlot !== 0) {
        let pNode = m.u32(pSlot) >>> 0
        while (pNode !== 0) {
          if (m.u32((pNode + 0x04) >>> 0) === targetGuid) {
            return nType
          }
          pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
        }
      }
    }
  }
  return 0
}

/**
 * [25/45] Sends either `S2C 0x7A` (`NET_SendPacket7A_SummonChange_6FCAB290_113c` with `bAction=1`) when
 * `pPetNode->dwSeed == 0 && pPetNode->dwWParam == 0` (`+0x10`/`+0x14`), or `S2C 0x81` (`NET_SendPacket81_AssignMerc_6FCAB220_113c`)
 * when either field is non-zero, to `pPlayer`'s client.
 *
 * @va D2Game:0x6FCB66E0
 */
export function PETS_SendPetOrMercAssignPacket_6FCB66E0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pPetNode: number,
): number {
  hitD2GameVa113c(0x6FCB66E0)
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const dwSeed = m.u32((pPetNode + 0x10) >>> 0) >>> 0
  const dwWParam = m.u32((pPetNode + 0x14) >>> 0) >>> 0
  if (dwSeed === 0 && dwWParam === 0) {
    return NET_SendPacket7A_SummonChange_6FCAB290_113c(
      m,
      1,
      pClient,
      m.u32((pPetNode + 0x0c) >>> 0) & 0xff,
      m.u32(pPetNode >>> 0) >>> 0,
      m.u32((pPetNode + 0x04) >>> 0) >>> 0,
      m.u16((pPetNode + 0x08) >>> 0),
    )
  }

  return NET_SendPacket81_AssignMerc_6FCAB220_113c(
    m,
    m.u32((pPetNode + 0x04) >>> 0) >>> 0,
    pClient,
    m.u32((pPetNode + 0x0c) >>> 0) & 0xff,
    m.u32(pPetNode >>> 0) >>> 0,
    m.u16((pPetNode + 0x08) >>> 0),
    dwSeed,
    dwWParam,
  )
}


/**
 * [26/45] Builds and queues a 13-byte (`0x0D`) `S2C 0x7A` (`bAction = 0` unsummon) packet
 * for `pPetNode` (`[esp+4]`) to `pPlayer`'s (`edx`) client buffer via `NET_QueuePacketToClientBuffer113c`.
 *
 * @va D2Game:0x6FCB6810
 */
export function PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pPetNode: number,
): number {
  hitD2GameVa113c(0x6FCB6810)
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const pPkt = m.alloc(0x10) >>> 0
  m.setU32(pPkt, 0)
  m.setU32((pPkt + 0x04) >>> 0, 0)
  m.setU32((pPkt + 0x08) >>> 0, 0)
  m.setU8((pPkt + 0x0c) >>> 0, 0)
  m.setU8(pPkt, 0x7a)
  m.setU8((pPkt + 0x01) >>> 0, 0)
  m.setU8((pPkt + 0x02) >>> 0, m.u8((pPetNode + 0x0c) >>> 0))
  m.setU16((pPkt + 0x03) >>> 0, m.u16((pPetNode + 0x08) >>> 0))
  m.setU32((pPkt + 0x05) >>> 0, m.u32((pPetNode + 0x04) >>> 0) >>> 0)
  m.setU32((pPkt + 0x09) >>> 0, m.u32(pPetNode >>> 0) >>> 0)
  return NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x0d) | 0
}

/**
 * [27/45] Finds the first active monster `D2UnitStrc*` in `pGame` (`edi`) for `pPlayer` (`eax`)
 * in pet type bucket `nPetType` (`esi`), skipping nodes with `(*(u8*)pNode & 1) != 0` when `bIncludeFlag0 == 0` (`ebx`).
 *
 * @va D2Game:0x6FCB6A40
 */
export function PETS_GetFirstPetUnitByType_6FCB6A40_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  nPetType: number,
  bIncludeFlag0: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCB6A40)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) return 0
  const petType = nPetType | 0
  if (petType < 0) return 0

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (petType >= i32(m, (pDataTables + 0xbf0) >>> 0)) return 0

  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) return 0
  const pListBase = m.u32(pPlayerPets) >>> 0
  const pSlot = (pListBase + petType * 12) >>> 0
  if (pSlot === 0) return 0

  let pNode = m.u32(pSlot) >>> 0
  if (pNode === 0) return 0

  while (bIncludeFlag0 === 0 && (m.u8(pNode) & 1) !== 0) {
    pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
    if (pNode === 0) return 0
  }

  if (pNode === 0) return 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }
  const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
  let pUnit = m.u32((pGame + (dwPetGuid & 0x7f) * 4 + 0x1320) >>> 0) >>> 0
  while (pUnit !== 0) {
    if (m.u32((pUnit + 0x0c) >>> 0) === dwPetGuid) {
      return pUnit
    }
    pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * [28/45] Iterates all pet nodes across pet types `1..nPetTypesTxtRecordCount-1` for `pPlayer` (`[esp+4]`)
 * with `(*(u8*)pNode & 1) == 0`, resolves each pet's monster `D2UnitStrc*` in `pGame` (`edi`), and invokes `pfnCallback`.
 *
 * @va D2Game:0x6FCB6AF0
 */
export function PETS_ForEachPlayerPetUnit_6FCB6AF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pfnCallback:
    | number
    | ((
        m: D2KernMemory113c,
        pGame: number,
        pOwnerPlayer: number,
        pPetUnit: number,
        pArg: number,
      ) => void),
  pArg: number,
): void {
  hitD2GameVa113c(0x6FCB6AF0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) return
  if (pfnCallback === 0) return

  const pPlayerPets = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPlayerPets === 0) return

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  const nPetTypes = i32(m, (pDataTables + 0xbf0) >>> 0)
  if (nPetTypes <= 1) return

  for (let nType = 1, nOff = 0x0c; nType < nPetTypes; nType = (nType + 1) | 0, nOff = (nOff + 0x0c) | 0) {
    if (nOff >= 0) {
      const pListBase = m.u32(pPlayerPets) >>> 0
      const pSlot = (pListBase + nOff) >>> 0
      if (pSlot !== 0) {
        let pNode = m.u32(pSlot) >>> 0
        while (pNode !== 0) {
          if ((m.u8(pNode) & 1) === 0 && pGame !== 0) {
            const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
            let pPetUnit = m.u32((pGame + (dwPetGuid & 0x7f) * 4 + 0x1320) >>> 0) >>> 0
            while (pPetUnit !== 0) {
              if (m.u32((pPetUnit + 0x0c) >>> 0) === dwPetGuid) {
                if (typeof pfnCallback === 'function') {
                  pfnCallback(m, pGame >>> 0, pPlayer >>> 0, pPetUnit, pArg >>> 0)
                }
                break
              }
              pPetUnit = m.u32((pPetUnit + 0xe4) >>> 0) >>> 0
            }
          }
          pNode = m.u32((pNode + 0x14) >>> 0) >>> 0
        }
      }
    }
  }
}

/**
 * [29/45] Warps `pPetUnit` (`eax`) to `(pTargetRoom, nX, nY)` in `pGame` (`[esp+4]`), updating its
 * act index (`+0x18`), `pDrlgAct` (`+0x1C`), room registration (`SUNIT_UpdateUnitPositionAndRoom113c`),
 * unit flags (`+0xC8 |= 0x10000`), initial AI event (`MONSTER_ScheduleInitialAiEvent113c`), and living path collision mask (`0x100`).
 *
 * @va D2Game:0x6FCB71F0
 */
export function PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c(
  m: D2KernMemory113c,
  pPetUnit: number,
  pTargetRoom: number,
  pGame: number,
  nX: number,
  nY: number,
): void {
  hitD2GameVa113c(0x6FCB71F0)
  const pOldRoom = UNITS_GetRoom113c(m, pPetUnit >>> 0) >>> 0
  if (pTargetRoom !== 0) {
    const nTargetLevel = DUNGEON_GetLevelIdFromRoom113c(m, pTargetRoom >>> 0) | 0
    const bTargetAct = DRLG_GetActNoFromLevelId113c(m, nTargetLevel) & 0xff
    if (m.u8((pPetUnit + 0x18) >>> 0) !== bTargetAct) {
      PATH_WarpUnitToRoomAndCoord113c(
        m,
        m.u32((pPetUnit + 0x2c) >>> 0),
        pPetUnit >>> 0,
        0,
        0,
        0,
      )
    }
  }

  PATH_WarpUnitToRoomAndCoord113c(
    m,
    m.u32((pPetUnit + 0x2c) >>> 0),
    pPetUnit >>> 0,
    pTargetRoom >>> 0,
    nX | 0,
    nY | 0,
  )

  if ((pTargetRoom >>> 0) !== pOldRoom) {
    UNITS_SetPathRoomRefreshFlag113c(m, pPetUnit >>> 0, 1)
    SUNIT_UpdateUnitPositionAndRoom113c(m, pOldRoom, pPetUnit >>> 0, pGame >>> 0)
  }

  const pNewRoom = UNITS_GetRoom113c(m, pPetUnit >>> 0) >>> 0
  const nNewLevel = DUNGEON_GetLevelIdFromRoom113c(m, pNewRoom) | 0
  const bNewAct = DRLG_GetActNoFromLevelId113c(m, nNewLevel) & 0xff
  m.setU8((pPetUnit + 0x18) >>> 0, bNewAct)
  m.setU32((pPetUnit + 0x1c) >>> 0, m.u32((pGame + bNewAct * 4 + 0xbc) >>> 0) >>> 0)
  UNITROOM_RefreshUnit113c(m, pPetUnit >>> 0)
  m.setU32((pPetUnit + 0xc8) >>> 0, (m.u32((pPetUnit + 0xc8) >>> 0) | 0x10000) >>> 0)
  UNITROOM_RefreshUnit113c(m, pPetUnit >>> 0)
  MONSTER_ScheduleInitialAiEvent113c(m, pGame >>> 0, pPetUnit >>> 0)

  if (MONSTERS_IsDead113c(m, pPetUnit >>> 0) === 0) {
    const pPath = m.u32((pPetUnit + 0x2c) >>> 0) >>> 0
    if (pPath !== 0) {
      PATH_SetCollisionMask113c(m, pPath, 0x100)
    }
  }
}

/**
 * [30/45] Consumes a selectable corpse (`pCorpseUnit`) for Redemption/corpse-consume skill `nSkillId` at `nLevel`,
 * optionally rolling `dwCalc1` (`+0x138`) percent chance on `pCasterUnit + 0x20` when `bSkipRoll == 0`, restoring
 * `dwCalc2` (`+0x13C`) life and `dwCalc3` (`+0x140`) mana (clamped to max), and setting state `0x63` (`STATE_REDEEMED`).
 *
 * @va D2Game:0x6FCB8490
 */
export function SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c(
  m: D2KernMemory113c,
  pCasterUnit: number,
  nSkillId: number,
  pCorpseUnit: number,
  nLevel: number,
  bSkipRoll: number,
): number {
  hitD2GameVa113c(0x6FCB8490)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if (pCorpseUnit === 0 || SKILLS_IsSelectableCorpse10501_113c(m, pCorpseUnit >>> 0) === 0) {
    return 0
  }

  const lvl = nLevel | 0
  if (bSkipRoll === 0) {
    const nChance =
      SKILLS_EvalCalcByOffset113c(
        m,
        pCasterUnit >>> 0,
        m.u32((pSkillsTxt + 0x138) >>> 0),
        skillId,
        lvl,
      ) | 0
    const pSeed = (pCasterUnit + 0x20) >>> 0
    const seed = { lo: m.u32(pSeed) >>> 0, hi: m.u32((pSeed + 0x04) >>> 0) >>> 0 }
    const nRoll = seedRoll(seed, 0x64) | 0
    m.setU32(pSeed, seed.lo >>> 0)
    m.setU32((pSeed + 0x04) >>> 0, seed.hi >>> 0)
    if (nRoll >= nChance) return 0
  }

  const nLifeGain =
    (SKILLS_EvalCalcByOffset113c(
      m,
      pCasterUnit >>> 0,
      m.u32((pSkillsTxt + 0x13c) >>> 0),
      skillId,
      lvl,
    ) <<
      8) |
    0
  const nMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, pCasterUnit >>> 0) | 0
  const nCurHp = STATLIST_GetUnitStat113c(m, pCasterUnit >>> 0, 6, 0) | 0
  let nNewHp = (nCurHp + nLifeGain) | 0
  if (nMaxHp < nNewHp) {
    nNewHp = nMaxHp
  }
  STATLIST_SetUnitStat113c(m, pCasterUnit >>> 0, 6, nNewHp, 0)

  const nManaGain =
    (SKILLS_EvalCalcByOffset113c(
      m,
      pCasterUnit >>> 0,
      m.u32((pSkillsTxt + 0x140) >>> 0),
      skillId,
      lvl,
    ) <<
      8) |
    0
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pCasterUnit >>> 0) | 0
  const nCurMana = STATLIST_GetUnitStat113c(m, pCasterUnit >>> 0, 8, 0) | 0
  let nNewMana = (nCurMana + nManaGain) | 0
  if (nMaxMana < nNewMana) {
    nNewMana = nMaxMana
  }
  STATLIST_SetUnitStat113c(m, pCasterUnit >>> 0, 8, nNewMana, 0)

  STATES_ToggleGfxStateFlag113c(m, pCorpseUnit >>> 0, 0x63, 1)
  m.setU32((pCorpseUnit + 0xc4) >>> 0, (m.u32((pCorpseUnit + 0xc4) >>> 0) & 0xfffffff9) >>> 0)
  return 1
}


/**
 * [31/45] State removal callback (`pUnit` in `ecx`, `nState` in `edx`): if `pUnit` is dead/dying and
 * `STATES_CheckStateMaskExpOnUnit113c(pUnit, nState) != 0`, keeps the state; otherwise clears `nState`,
 * clears state `0x6B` (`STATE_SHATTER`) if `pUnit` is alive, and calls `UNITS_SetUnitAnimMode113c`.
 *
 * @va D2Game:0x6FCB85D0
 */
export function STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB85D0)
  const stateId = nState | 0
  let bIsAlive0 = false
  if (pUnit !== 0 && (m.u8((pUnit + 0xc6) >>> 0) & 1) === 0) {
    const dwType = m.u32(pUnit >>> 0)
    const dwMode = m.u32((pUnit + 0x10) >>> 0)
    if (dwType === 0) {
      bIsAlive0 = dwMode !== 0 && dwMode !== 0x11
    } else if (dwType === 1) {
      bIsAlive0 = dwMode !== 0 && dwMode !== 0x0c
    }
  }

  if (!bIsAlive0) {
    if (STATES_CheckStateMaskExpOnUnit113c(m, pUnit >>> 0, stateId) !== 0) {
      return
    }
  }

  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, stateId, 0)

  if (pUnit !== 0 && (m.u8((pUnit + 0xc6) >>> 0) & 1) === 0) {
    const dwType = m.u32(pUnit >>> 0)
    const dwMode = m.u32((pUnit + 0x10) >>> 0)
    if (
      (dwType === 0 && dwMode !== 0 && dwMode !== 0x11) ||
      (dwType === 1 && dwMode !== 0 && dwMode !== 0x0c)
    ) {
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x6b, 0)
    }
  }

  UNITS_SetUnitAnimMode113c(m, pUnit >>> 0, 0x6fd1ba14, 0x616)
}

/**
 * [32/45] Radial Redemption aura callback (`pAuraCtx` in `ecx`, `pCorpseUnit` in `edx`) that rolls
 * `dwCalc1` (`+0x138`) percent chance on `pCaster + 0x20`, heals `dwCalc2` (`+0x13C`) life and `dwCalc3` (`+0x140`)
 * mana on `pCaster`, sets state `0x63` (`STATE_REDEEMED`) on `pCorpseUnit`, and increments `(pSub+0x08)`.
 *
 * @va D2Game:0x6FCB8680
 */
export function AURAS_RedemptionCorpseCallback_6FCB8680_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pCorpseUnit: number,
): number {
  hitD2GameVa113c(0x6FCB8680)
  const pSub = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  const nSkillId = i32(m, pSub)
  const nLevel = i32(m, (pSub + 0x04) >>> 0)
  const pCasterUnit = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0

  if (nSkillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (nSkillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  if (pCorpseUnit === 0 || SKILLS_IsSelectableCorpse10501_113c(m, pCorpseUnit >>> 0) === 0) {
    return 0
  }

  const nChance =
    SKILLS_EvalCalcByOffset113c(
      m,
      pCasterUnit,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      nSkillId,
      nLevel,
    ) | 0
  const pSeed = (pCasterUnit + 0x20) >>> 0
  const seed = { lo: m.u32(pSeed) >>> 0, hi: m.u32((pSeed + 0x04) >>> 0) >>> 0 }
  const nRoll = seedRoll(seed, 0x64) | 0
  m.setU32(pSeed, seed.lo >>> 0)
  m.setU32((pSeed + 0x04) >>> 0, seed.hi >>> 0)
  if (nRoll >= nChance) return 0

  const nLifeGain =
    (SKILLS_EvalCalcByOffset113c(
      m,
      pCasterUnit,
      m.u32((pSkillsTxt + 0x13c) >>> 0),
      nSkillId,
      nLevel,
    ) <<
      8) |
    0
  const nMaxHp = STATLIST_GetMaxLifeFromUnit113c(m, pCasterUnit) | 0
  const nCurHp = STATLIST_GetUnitStat113c(m, pCasterUnit, 6, 0) | 0
  let nNewHp = (nCurHp + nLifeGain) | 0
  if (nMaxHp < nNewHp) {
    nNewHp = nMaxHp
  }
  STATLIST_SetUnitStat113c(m, pCasterUnit, 6, nNewHp, 0)

  const nManaGain =
    (SKILLS_EvalCalcByOffset113c(
      m,
      pCasterUnit,
      m.u32((pSkillsTxt + 0x140) >>> 0),
      nSkillId,
      nLevel,
    ) <<
      8) |
    0
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pCasterUnit) | 0
  const nCurMana = STATLIST_GetUnitStat113c(m, pCasterUnit, 8, 0) | 0
  let nNewMana = (nCurMana + nManaGain) | 0
  if (nMaxMana < nNewMana) {
    nNewMana = nMaxMana
  }
  STATLIST_SetUnitStat113c(m, pCasterUnit, 8, nNewMana, 0)

  STATES_ToggleGfxStateFlag113c(m, pCorpseUnit >>> 0, 0x63, 1)
  m.setU32((pCorpseUnit + 0xc4) >>> 0, (m.u32((pCorpseUnit + 0xc4) >>> 0) & 0xfffffff9) >>> 0)
  m.setU32((pSub + 0x08) >>> 0, (m.u32((pSub + 0x08) >>> 0) + 1) >>> 0)
  return 1
}

/**
 * [33/45] Rolls a 256ths-scaled base weapon physical damage value for `pUnit` (`esi`) using
 * `STAT_SECONDARY_MINDAMAGE`/`STAT_SECONDARY_MAXDAMAGE` (`0x17`/`0x18`) for 2H weapons or
 * `STAT_MINDAMAGE`/`STAT_MAXDAMAGE` (`0x15`/`0x16`) otherwise, advancing `pUnit->pSeed` (`+0x20`).
 *
 * @va D2Game:0x6FCB87D0
 */
export function SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCB87D0)
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit >>> 0) >>> 0
  let nMinDmg: number
  let nMaxDmg: number
  if (pWeapon !== 0) {
    const nHandClass =
      INVENTORY_GetEquippedWeaponHandClass113c(m, pUnit >>> 0, m.u32((pUnit + 0x60) >>> 0)) | 0
    if (nHandClass === 2) {
      nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x17, 0) | 0
      nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x18, 0) | 0
    } else {
      nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x15, 0) | 0
      nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x16, 0) | 0
    }
  } else {
    nMinDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x15, 0) | 0
    if (nMinDmg <= 0) {
      nMinDmg = 1
    }
    nMaxDmg = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x16, 0) | 0
    if (nMaxDmg <= 1) {
      nMaxDmg = 2
    }
  }

  nMinDmg = (nMinDmg << 8) | 0
  nMaxDmg = (nMaxDmg << 8) | 0
  if (nMinDmg < 1) {
    nMinDmg = 0x100
  }
  if (nMaxDmg <= nMinDmg) {
    nMaxDmg = (nMinDmg + 0x100) | 0
  }

  const nRange = (nMaxDmg - nMinDmg) | 0
  if (nRange <= 0) {
    return nMinDmg
  }

  const pSeed = (pUnit + 0x20) >>> 0
  const prod =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo = Number(prod & 0xffffffffn) >>> 0
  const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed, lo)
  m.setU32((pSeed + 0x04) >>> 0, hi)

  const uRange = nRange >>> 0
  const nOffset =
    (uRange & ((uRange - 1) >>> 0)) === 0 ? (lo & (uRange - 1)) | 0 : (lo % uRange) | 0
  return (nMinDmg + nOffset) | 0
}

/**
 * [34/45] Restores a Mind-Blast-converted monster (`pUnit` in `ecx`, `nState` in `edx`) on state expiration:
 * clears `nState`, resets alignment to `0`, unlinks from room update list, restores `STAT_LEVEL` (`0x0C`),
 * scaled `STAT_HITPOINTS` (`0x06`), and `STAT_MAXHP` (`0x07`) from state `0x6D`, and frees flag `0x08` sublists.
 *
 * @va D2Game:0x6FCB8950
 */
export function SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCB8950)
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState | 0, 0)
  SUNIT_SetMonsterAlignmentState113c(m, pUnit >>> 0, 0, 1)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0xa2a)
  }

  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit >>> 0)

  const pSaveList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 0x6d) >>> 0
  if (pSaveList !== 0) {
    const nSavedLevel = STATLIST_GetStatValue113c(m, pSaveList, 0xb0, 0) | 0
    const nSavedMaxHp = STATLIST_GetStatValue113c(m, pSaveList, 0xb1, 0) | 0
    const nCurMaxHp = (STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0) >> 8
    const nCurHp = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) >> 8
    let nNewHp = 1
    if (nCurMaxHp !== 0) {
      nNewHp = mulDiv113c(nCurHp, nSavedMaxHp, nCurMaxHp) | 0
    }
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0c, nSavedLevel, 0)
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x06, (nNewHp << 8) | 0, 0)
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x07, nSavedMaxHp, 0)
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pSaveList)
    STATLIST_FreeStatListIfNonExtended113c(m, pSaveList)

    let pFlag8List = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit >>> 0, 0x08) >>> 0
    while (pFlag8List !== 0) {
      STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pFlag8List)
      STATLIST_FreeStatListIfNonExtended113c(m, pFlag8List)
      pFlag8List = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit >>> 0, 0x08) >>> 0
    }
  }
}

/**
 * [35/45] Scans a radius of `3` around `pCenterUnit` (`ecx`) in `pGame` (`[esp+4]`) with filter `0xA783`
 * and `SKILLS_TargetRingScanCallback_6FCBED70_113c`, returning the closest primary target (`+0x00`) or fallback (`+0x08`).
 *
 * @va D2Game:0x6FCB8E30
 */
export function SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(
  m: D2KernMemory113c,
  pGame: number,
  nFilterUnitId: number,
  pCenterUnit: number,
): number {
  hitD2GameVa113c(0x6FCB8E30)
  const pCtx = m.alloc(0x18) >>> 0
  m.setU32(pCtx, 0)
  m.setU32((pCtx + 0x04) >>> 0, 0xffffffff)
  m.setU32((pCtx + 0x08) >>> 0, 0)
  m.setU32((pCtx + 0x0c) >>> 0, nFilterUnitId >>> 0)
  m.setU32((pCtx + 0x10) >>> 0, nFilterUnitId >>> 0)
  m.setU32((pCtx + 0x14) >>> 0, 0)

  AURA_ForEachUnitInRadius113c(
    m,
    pGame >>> 0,
    pCenterUnit >>> 0,
    0,
    0,
    3,
    0xa783,
    0x6fcbed70,
    pCtx,
    0,
    SKILLS_TargetRingScanCallback_6FCBED70_113c,
  )

  const pPrimary = m.u32(pCtx) >>> 0
  if (pPrimary !== 0) return pPrimary
  return m.u32((pCtx + 0x08) >>> 0) >>> 0
}


/**
 * [36/45] Sacrifice self-damage handler (`pGame` in `ecx`, `pUnit` in `edx`, `nSkillId` at `[esp+4]`, `nLevel` at `[esp+8]`):
 * finds combat damage record against target (`SUNITDMG_FindCombatDamageData113c`), clamps `dwPhysDamage` (`+0x08`) to target's
 * current HP, scales by `dwCalc2` (`+0x13C`) percent via `mulDiv113c`, and applies self-damage (`0x1000` flag) + combat events.
 *
 * @va D2Game:0x6FCB9290
 */
export function SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCB9290)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) return 0

  const pCombatDmg = SUNITDMG_FindCombatDamageData113c(m, pUnit >>> 0, pTarget) >>> 0
  if (pCombatDmg !== 0) {
    const pSelfDmg = m.alloc(0x70) >>> 0
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pSelfDmg + i) >>> 0, 0)
    }
    m.setU32(pSelfDmg, (m.u32(pSelfDmg) | 0x1000) >>> 0)

    let nBaseDmg = i32(m, (pCombatDmg + 0x08) >>> 0)
    const nTargetHp = STATLIST_GetUnitStat113c(m, pTarget, 6, 0) | 0
    if (nTargetHp < nBaseDmg) {
      nBaseDmg = nTargetHp
    }

    const nSelfPct =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit >>> 0,
        m.u32((pSkillsTxt + 0x13c) >>> 0),
        skillId,
        nLevel | 0,
      ) | 0
    const nSelfAmount = mulDiv113c(nSelfPct, nBaseDmg, 100) | 0
    m.setU32((pSelfDmg + 0x08) >>> 0, nSelfAmount >>> 0)
    m.setU32((pSelfDmg + 0x4c) >>> 0, nSelfAmount >>> 0)

    SUNITDMG_ApplyDamage113c(m, pGame >>> 0, pUnit >>> 0, pUnit >>> 0, pSelfDmg, 0, undefined, 1)
    if (m.u16((pSelfDmg + 0x04) >>> 0) === 0) {
      // SUNITDMG_ApplyDamage113c already subtracted nSelfAmount and did not set RESULTFLAG_DEATH (0x02);
      // clear dwDmgTotal so SUNITDMG_ApplySideEffectsAndKill113c's legacy (flags==0 && dmgTotal>0) shim
      // does not subtract HP a second time (real D2Game:0x6FCFCF20 never subtracts HP).
      m.setU32((pSelfDmg + 0x4c) >>> 0, 0)
    }
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame >>> 0, pUnit >>> 0, pUnit >>> 0, pSelfDmg)
    SUNITDMG_ExecuteEvents113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 1, 0)
  }
  return 1
}

/**
 * [37/45] Spawns a charged server projectile at the validated path target unit's coordinates,
 * stores `pTarget->dwUnitType` (`MISSILE_SetTargetX113c`) and `pTarget->dwUnitId` (`MISSILE_SetTargetY113c`) on the
 * missile, and applies `pSkillsTxt->wCastOverlay` (`+0x4E`) to `pTarget`.
 *
 * @va D2Game:0x6FCB93A0
 */
export function SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCB93A0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, pUnit >>> 0) | 0
  if (nMissileId <= 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) return 0

  const pParams = m.alloc(0x5c) >>> 0
  for (let i = 0; i < 0x5c; i += 4) {
    m.setU32((pParams + i) >>> 0, 0)
  }
  m.setU32(pParams, 1)
  m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
  m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
  m.setU32((pParams + 0x14) >>> 0, UNIT_GetPosX113c(m, pTarget) >>> 0)
  m.setU32((pParams + 0x18) >>> 0, UNIT_GetPosY113c(m, pTarget) >>> 0)
  m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
  m.setU32((pParams + 0x30) >>> 0, nLevel >>> 0)

  const pMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams) >>> 0
  if (pMissile === 0) return 0

  MISSILE_SetTargetX113c(m, pMissile, m.u32(pTarget) | 0)
  MISSILE_SetTargetY113c(m, pMissile, m.u32((pTarget + 0x0c) >>> 0) | 0)

  const nCastOverlay = (m.u16((pSkillsTxt + 0x4e) >>> 0) << 16) >> 16
  if (nCastOverlay >= 0 && nCastOverlay < i32(m, (pDataTables + 0xbc0) >>> 0)) {
    STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, nCastOverlay, 0)
  }
  return 1
}

/**
 * [38/45] Scales remaining duration of `STATE_POISON` (`2`) and all active expirable curse states
 * (`pDataTables->pCurseStateIndex[0..wCurseStates-1]` at `+0x174`/`+0x178`) on `pUnit` (`[esp+8]`)
 * by `nDurationPct` (`edi`) percent and reschedules timer event `0x0C`.
 *
 * @va D2Game:0x6FCB9B60
 */
export function SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c(
  m: D2KernMemory113c,
  nDurationPct: number,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCB9B60)
  const nPct = nDurationPct | 0
  let bModified = 0

  if (STATES_CheckState113c(m, pUnit >>> 0, 2) !== 0) {
    const pPoisonList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 2) >>> 0
    if (pPoisonList !== 0) {
      const nCurFrame = i32(m, (pGame + 0xa8) >>> 0)
      const nExpire = STATLIST_GetExpireFrameEx113c(m, pPoisonList) | 0
      const nRem = (nExpire - nCurFrame) | 0
      const nNewExpire = (nCurFrame + (mulDiv113c(nPct, nRem, 100) | 0)) | 0
      STATLIST_SetExpireFrameEx113c(m, pPoisonList, nNewExpire)
      EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nNewExpire, 0, 0, 0)
      bModified = 1
    }
  }

  const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return bModified

  const nCurseCount = (m.u16((pDataTables + 0x178) >>> 0) << 16) >> 16
  for (let i = 0; i < nCurseCount; i = (i + 1) | 0) {
    const pCurseArr = m.u32((pDataTables + 0x174) >>> 0) >>> 0
    const nState = (m.u16((pCurseArr + i * 2) >>> 0) << 16) >> 16
    if (STATES_CheckState113c(m, pUnit >>> 0, nState) !== 0) {
      const pStateList =
        STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, nState) >>> 0
      if (pStateList !== 0) {
        if (UNITS_CheckStateMaskExp113c(m, nState) !== 0) {
          const nCurFrame = i32(m, (pGame + 0xa8) >>> 0)
          const nExpire = STATLIST_GetExpireFrameEx113c(m, pStateList) | 0
          const nRem = (nExpire - nCurFrame) | 0
          let nScaledRem: number
          if (nRem > 0x100000) {
            nScaledRem = Math.imul((nRem / 100) | 0, nPct) | 0
          } else if (nPct > 0x10000) {
            nScaledRem = Math.imul((nPct / 100) | 0, nRem) | 0
          } else {
            nScaledRem = (Math.imul(nRem, nPct) / 100) | 0
          }
          const nNewExpire = (nCurFrame + nScaledRem) | 0
          STATLIST_SetExpireFrameEx113c(m, pStateList, nNewExpire)
          EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nNewExpire, 0, 0, 0)
        }
        bModified = 1
      }
    }
  }

  return bModified
}

/**
 * [39/45] Radial Sanctuary/undead pulse callback (`pAuraCtx` in `ecx`, `pTargetUnit` in `edx`):
 * filters monsters by `pMonStatsTxt->nAlign/Drain[pGame->nDifficulty] < 0` (`+0x168`), applies optional
 * radial stat buff (`AURAS_ApplyRadialStatBuffCallback113c`) and damage (`SUNITDMG_ApplyDamage113c` +
 * `SUNITDMG_ApplySideEffectsAndKill113c`), and toggles state `0x6B` with 20% probability.
 *
 * @va D2Game:0x6FCBA630
 */
export function AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCBA630)
  const pGame = m.u32(pAuraCtx >>> 0) >>> 0
  const pAttacker = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const pSub = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0

  if (pTargetUnit !== 0 && m.u32(pTargetUnit >>> 0) === 1) {
    const nClassId = i32(m, (pTargetUnit + 0x04) >>> 0)
    const pDataTablesPtr = m.u32(0x6fd1829c) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (nClassId < 0 || pDataTables === 0 || nClassId >= i32(m, (pDataTables + 0xa80) >>> 0)) {
      return 0
    }
    const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
    const pMonStatsTxt = (pMonStatsBase + Math.imul(nClassId, 0x1a8)) >>> 0
    if (pMonStatsTxt === 0) return 0
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    const nSignedVal = (m.u8((pMonStatsTxt + bDiff + 0x168) >>> 0) << 24) >> 24
    if (nSignedVal >= 0) return 0
  }

  if (m.u32((pSub + 0x48) >>> 0) !== 0) {
    const pBuffCtx = m.alloc(0x10) >>> 0
    const pBuffSub = m.alloc(0x50) >>> 0
    for (let i = 0; i < 0x40; i += 4) {
      m.setU32((pBuffSub + i) >>> 0, m.u32((pSub + i) >>> 0) >>> 0)
    }
    for (let i = 0x40; i < 0x50; i += 4) {
      m.setU32((pBuffSub + i) >>> 0, 0)
    }
    m.setU32(pBuffCtx, pGame)
    m.setU32((pBuffCtx + 0x04) >>> 0, pAttacker)
    m.setU32((pBuffCtx + 0x08) >>> 0, 0)
    m.setU32((pBuffCtx + 0x0c) >>> 0, pBuffSub)
    AURAS_ApplyRadialStatBuffCallback113c(m, pBuffCtx, pTargetUnit >>> 0)
  }

  const pSrcDmg = m.u32((pSub + 0x4c) >>> 0) >>> 0
  if (pSrcDmg !== 0) {
    const pDmg = m.alloc(0x70) >>> 0
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, m.u32((pSrcDmg + i) >>> 0) >>> 0)
    }
    SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pTargetUnit >>> 0, pDmg, 1, undefined, 1)
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pAttacker, pTargetUnit >>> 0, pDmg)
  }

  const pSeed = (pTargetUnit + 0x20) >>> 0
  const prod =
    BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 0x04) >>> 0) >>> 0)
  const lo = Number(prod & 0xffffffffn) >>> 0
  const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 0x04) >>> 0, hi)
  m.setU32(pSeed, lo)
  const nRoll = (lo % 100) >>> 0
  STATES_ToggleGfxStateFlag113c(m, pTargetUnit >>> 0, 0x6b, nRoll < 0x14 ? 1 : 0)
  return 1
}

/**
 * [40/45] Radial pulse callback (`pAuraCtx` in `ecx`, `pTargetUnit` in `edx`) that applies optional
 * radial stat buff (`AURAS_ApplyRadialStatBuffCallback113c` when `pSub->bHasBuff` at `+0x48` != 0)
 * and radial pulse damage (`SUNITDMG_ApplyDamage113c` + `SUNITDMG_ApplySideEffectsAndKill113c` when `pSub->pDmg` at `+0x4C` != 0).
 *
 * @va D2Game:0x6FCBA7C0
 */
export function AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c(
  m: D2KernMemory113c,
  pAuraCtx: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCBA7C0)
  const pGame = m.u32(pAuraCtx >>> 0) >>> 0
  const pAttacker = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
  const pSub = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0

  if (m.u32((pSub + 0x48) >>> 0) !== 0) {
    const pBuffCtx = m.alloc(0x10) >>> 0
    const pBuffSub = m.alloc(0x50) >>> 0
    for (let i = 0; i < 0x40; i += 4) {
      m.setU32((pBuffSub + i) >>> 0, m.u32((pSub + i) >>> 0) >>> 0)
    }
    for (let i = 0x40; i < 0x50; i += 4) {
      m.setU32((pBuffSub + i) >>> 0, 0)
    }
    m.setU32(pBuffCtx, pGame)
    m.setU32((pBuffCtx + 0x04) >>> 0, pAttacker)
    m.setU32((pBuffCtx + 0x08) >>> 0, 0)
    m.setU32((pBuffCtx + 0x0c) >>> 0, pBuffSub)
    AURAS_ApplyRadialStatBuffCallback113c(m, pBuffCtx, pTargetUnit >>> 0)
  }

  const pSrcDmg = m.u32((pSub + 0x4c) >>> 0) >>> 0
  if (pSrcDmg !== 0) {
    const pDmg = m.alloc(0x70) >>> 0
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, m.u32((pSrcDmg + i) >>> 0) >>> 0)
    }
    SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pTargetUnit >>> 0, pDmg, 1, undefined, 1)
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pAttacker, pTargetUnit >>> 0, pDmg)
  }
  return 1
}


/**
 * [41/45] Returns `1` if `pUnit` (`ecx`) has unit flag bit `0x16` (`0x400000`) or `0x17` (`0x800000`)
 * set on `pUnit->dwFlags` (`+0xC8`), or if any inventory node in `pUnit->pInventory` (`+0x60`) resolves
 * to a live item unit in `pGame`'s (`ebx`) item hash table (`+0x1720`).
 *
 * @va D2Game:0x6FCBB570
 */
export function ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCBB570)
  if (pUnit !== 0) {
    const dwFlags = m.u32((pUnit + 0xc8) >>> 0) >>> 0
    if (((dwFlags >>> 0x16) & 1) !== 0) return 1
    if (((dwFlags >>> 0x17) & 1) !== 0) return 1
  }

  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  let pNode = INVENTORY_GetFirstNode113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    const dwItemGuid = INVENTORY_GetNodeItemGuid113c(m, pNode) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
    }
    let pFoundItem = 0
    let pItem = m.u32((pGame + (dwItemGuid & 0x7f) * 4 + 0x1720) >>> 0) >>> 0
    while (pItem !== 0) {
      if (m.u32((pItem + 0x0c) >>> 0) === dwItemGuid) {
        pFoundItem = pItem
        break
      }
      pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
    }
    const pNext = INVENTORY_GetNextNode113c(m, pNode) >>> 0
    if (pFoundItem !== 0) return 1
    pNode = pNext
  }
  return 0
}

/**
 * [42/45] Finds the sub-party for `(pGame, wPartyId)` via `PARTY_FindSubPartyById_6FCBBD00_113c`
 * and returns the number of member nodes in `pSubParty->pMembers` (`+0x04`), or `-1` if no sub-party exists.
 *
 * @va D2Game:0x6FCBBF40
 */
export function PARTY_CountSubPartyMembers_6FCBBF40_113c(
  m: D2KernMemory113c,
  pGame: number,
  wPartyId: number,
): number {
  hitD2GameVa113c(0x6FCBBF40)
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame >>> 0, wPartyId) >>> 0
  if (pSubParty === 0) return -1

  let nCount = 0
  let pMember = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  while (pMember !== 0) {
    pMember = m.u32((pMember + 0x04) >>> 0) >>> 0
    nCount = (nCount + 1) | 0
  }
  return nCount
}

/**
 * [43/45] Allocates a 12-byte (`0x0C`) `D2SubPartyStrc` node for `pGame` (`ebx`), assigns a new
 * `wPartyId` via `PARTY_AllocNextPartyId_6FCBBD40_113c`, links it onto `pGame->pPartyControl->pSubPartyHead` (`+0x04`),
 * and returns the allocated `wPartyId`.
 *
 * @va D2Game:0x6FCBBF70
 */
export function PARTY_CreateAndLinkSubParty_6FCBBF70_113c(
  m: D2KernMemory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCBBF70)
  const pPartyControl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
  if (pPartyControl === 0) {
    throw new D2CommonAssertError('Party.cpp', 0x7f)
  }

  void m.u32((pGame + 0x1c) >>> 0)
  const pSubParty = m.alloc(0x0c) >>> 0
  m.setU32(pSubParty, 0)
  m.setU32((pSubParty + 0x04) >>> 0, 0)
  m.setU32((pSubParty + 0x08) >>> 0, 0)

  const wPartyId = PARTY_AllocNextPartyId_6FCBBD40_113c(m, pGame >>> 0) & 0xffff
  m.setU16(pSubParty, wPartyId)
  m.setU32((pSubParty + 0x08) >>> 0, m.u32((pPartyControl + 0x04) >>> 0) >>> 0)
  m.setU32((pPartyControl + 0x04) >>> 0, pSubParty)
  return m.u16(pSubParty)
}

/**
 * [44/45] Iterates all member nodes in sub-party `wPartyId` (`eax`) of `pGame` (`esi`), resolves
 * each member's player `D2UnitStrc*` from `pGame->pUnitList[0]` (`+0x1120`), and invokes `pfnCallback(m, pGame, pMemberUnit, pArg)`.
 *
 * @va D2Game:0x6FCBC160
 */
export function PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
  m: D2KernMemory113c,
  pGame: number,
  wPartyId: number,
  pfnCallback:
    | number
    | ((m: D2KernMemory113c, pGame: number, pMemberUnit: number, pArg: number) => void),
  pArg: number,
): void {
  hitD2GameVa113c(0x6FCBC160)
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame >>> 0, wPartyId) >>> 0
  if (pSubParty === 0 || (wPartyId & 0xffff) === 0xffff) return

  let pNode = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  while (pNode !== 0) {
    if (pGame !== 0) {
      const dwGuid = m.u32(pNode) >>> 0
      let pPlayer = m.u32((pGame + (dwGuid & 0x7f) * 4 + 0x1120) >>> 0) >>> 0
      while (pPlayer !== 0) {
        if (m.u32((pPlayer + 0x0c) >>> 0) === dwGuid) {
          if (typeof pfnCallback === 'function') {
            pfnCallback(m, pGame >>> 0, pPlayer, pArg >>> 0)
          }
          break
        }
        pPlayer = m.u32((pPlayer + 0xe4) >>> 0) >>> 0
      }
    }
    pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
  }
}

/**
 * [45/45] Distributes `nGoldAmount` (`[esp+0x0C]`) picked up by `pPlayer` (`[esp+8]`) in `pGame` (`[esp+4]`)
 * across all living party members in the same level (`PARTY_SplitGoldPickupByCap_6FCBBC70_113c` +
 * `STATLIST_AddUnitStatGoldGuarded_6FC21670_113c`), awards the remaining share to `pPlayer`, and returns any uncollected remainder.
 *
 * @va D2Game:0x6FCBC270
 */
export function PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  nGoldAmount: number,
): number {
  hitD2GameVa113c(0x6FCBC270)
  const pCountOut = m.alloc(4) >>> 0
  m.setU32(pCountOut, 0)
  PARTY_ForEachPartyMemberInSameLevel113c(
    m,
    pPlayer >>> 0,
    pGame >>> 0,
    PARTY_CountLivingPartyMemberCallback113c,
    pCountOut,
  )

  const nPartyCount = i32(m, pCountOut)
  let nPool = nGoldAmount | 0

  if (nPartyCount > 1) {
    let wPartyId = 0xffff
    if (pPlayer !== 0 && m.u32((pPlayer + 0x80) >>> 0) !== 0 && m.u32(pPlayer >>> 0) === 0) {
      wPartyId =
        D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer >>> 0, m.u32((pPlayer + 0x80) >>> 0)) & 0xffff
    }
    const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, pGame >>> 0, wPartyId) >>> 0
    if (pSubParty !== 0) {
      const nShare = (nPool / nPartyCount) | 0
      const pPickerRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
      const nPickerLevel = DUNGEON_GetLevelIdFromRoom113c(m, pPickerRoom) | 0

      let pNode = m.u32((pSubParty + 0x04) >>> 0) >>> 0
      if (pNode !== 0) {
        const pOutToAdd = m.alloc(4) >>> 0
        const pOutRem = m.alloc(4) >>> 0
        while (pNode !== 0) {
          if (pGame === 0) {
            throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
          }
          const dwGuid = m.u32(pNode) >>> 0
          let pMember = m.u32((pGame + (dwGuid & 0x7f) * 4 + 0x1120) >>> 0) >>> 0
          while (pMember !== 0) {
            if (m.u32((pMember + 0x0c) >>> 0) === dwGuid) {
              if (pMember !== (pPlayer >>> 0)) {
                const pMemberRoom = UNITS_GetRoom113c(m, pMember) >>> 0
                if (
                  pMemberRoom !== 0 &&
                  (DUNGEON_GetLevelIdFromRoom113c(m, pMemberRoom) | 0) === nPickerLevel &&
                  pPlayer !== 0
                ) {
                  const dwPickerMode = m.u32((pPlayer + 0x10) >>> 0)
                  if (dwPickerMode !== 0 && dwPickerMode !== 0x11) {
                    m.setU32(pOutToAdd, 0)
                    m.setU32(pOutRem, 0)
                    PARTY_SplitGoldPickupByCap_6FCBBC70_113c(
                      m,
                      nShare,
                      pMember,
                      pOutToAdd,
                      pOutRem,
                    )
                    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(
                      m,
                      pMember,
                      0x0e,
                      i32(m, pOutToAdd),
                    )
                    nPool = (nPool + ((i32(m, pOutRem) - nShare) | 0)) | 0
                  }
                }
              }
              break
            }
            pMember = m.u32((pMember + 0xe4) >>> 0) >>> 0
          }
          pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
        }
      }
    }
  }

  const nLimit = STATLIST_GetUnitGoldBankLimit113c(m, pPlayer >>> 0) | 0
  const nCurGold = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0) | 0
  let nRemainder = 0
  let nToAdd = nPool
  if (((nCurGold + nPool) | 0) > nLimit) {
    nToAdd = (nLimit - nCurGold) | 0
    nRemainder = (nPool - nToAdd) | 0
  }

  if (pPlayer !== 0) {
    const nCurGoldAfter = STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0) | 0
    const nNewTotal = (nCurGoldAfter + nToAdd) | 0
    if (
      nNewTotal < 0 ||
      (m.u32(pPlayer >>> 0) === 0 &&
        nNewTotal > (STATLIST_GetUnitGoldBankLimit113c(m, pPlayer >>> 0) | 0))
    ) {
      STATLIST_SetUnitStat113c(m, pPlayer >>> 0, 0x0e, 0, 0)
      return nRemainder
    }
    STATLIST_AddUnitStatMemPort113c(m, pPlayer >>> 0, 0x0e, nToAdd, 0)
  }
  return nRemainder
}
