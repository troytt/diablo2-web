/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 4 Batch 2 (`w4b2`) routines across
 * `0x6FC561E0..0x6FC82C00` (45 functions).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { MONSTER_CheckMonTypeFlag0x20_113c } from '../common/drlg/drlg-ver.ts'
import { DRLGPRESET_MovePointerAndClear113c } from '../common/drlg/preset.ts'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile.ts'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import { mulDiv113c } from '../common/int-math.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import { SKILLS_SetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetLevel113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
} from '../common/missile.ts'
import {
  PATH_GetPosX113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
} from '../common/path.ts'
import {
  MISSILE_ResolveSkillIdByCodeOrRef113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_IsSelectableCorpse11157_113c,
} from '../common/skills.ts'
import {
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c } from '../prng.ts'
import { MONSTERS_IsDemonOrUndead113c } from '../tables/datatbls-113c.ts'
import { MONSTER_StartMode113c } from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { AURA_ForEachUnitInRadius113c } from './k2-gap-itemdef-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILE_ApplyDamageAndArmorShred113c,
  MISSILE_BuildDamageStrcFromStats113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_ProcessTargetCollisionHit113c,
  MISSILE_SrvDo01_LinearProjectile113c,
} from './k2-gap-melee-dot-113c.ts'
import { AIGENERAL_GetQuestDataPtr38_113c } from './k2-items-tc-w1-113c.ts'
import { MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  MISSILES_AddElemDamageByEType_6FC59260_113c,
  MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c,
  PLAYER_FreePlayerDataList98_6FC57500_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c,
  MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import { ACT5Q0_StatusFilter_6FC76EA0_113c } from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  MONSTER_HasAnyInteractingPlayer113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c.ts'
import {
  MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c,
  MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c,
  MISSILES_PopulateDamageByEType_6FC5A280_113c,
  MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c,
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c,
  MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c,
  MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c,
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
} from './k2-w3b3-113c.ts'
import {
  MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c,
  MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c,
  SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c,
  SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c,
  SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c,
  SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c,
} from './k2-w3b4-113c.ts'
import {
  ACT5Intro_ActiveFilter_6FC79680_113c,
  ACT5Intro_Callback00_NpcActivate_6FC796B0_113c,
  ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c,
  ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c,
  ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c,
  ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c,
  ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c,
  PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c,
  PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c,
} from './k2-w3b5-113c.ts'
import { ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c } from './k2-w3b6-113c.ts'
import {
  QUESTS_AllocBitBufferPair_6FC89360_113c,
  QUESTS_FreeBitBufferPair_6FC892D0_113c,
} from './k2-w3b7-113c.ts'
import { UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c } from './k2-w3b8-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c.ts'
import { EVENT_SetEventFull113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

let k2W4B2StackPtr = 0x7ef78000

function sx16(v: number): number {
  return (v << 16) >> 16
}

/**
 * @va D2Game:0x6FC561E0
 */
export function QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  nX: number,
  nY: number,
  pRoom: number,
  bSetFlag0x03000000: number,
  nMonsterId: number,
): number {
  hitD2GameVa113c(0x6FC561E0)
  const sp = k2W4B2StackPtr
  k2W4B2StackPtr = (sp + 0x60) >>> 0
  try {
    const ppOutRoom = sp
    const pIoCoord = (sp + 0x08) >>> 0
    const pRoomCoords = (sp + 0x10) >>> 0
    const pSpawnArgs = (sp + 0x30) >>> 0
    DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
    let x = nX | 0
    let y = nY | 0
    m.setU32(pIoCoord, x >>> 0)
    m.setU32((pIoCoord + 4) >>> 0, y >>> 0)
    let step = 0
    let matchedInBounds = false
    while (step <= 0x14) {
      const rx = m.u32(pRoomCoords) | 0
      const ry = m.u32((pRoomCoords + 4) >>> 0) | 0
      const rw = m.u32((pRoomCoords + 8) >>> 0) | 0
      const rh = m.u32((pRoomCoords + 0x0c) >>> 0) | 0
      if (x >= rx && y >= ry && x < ((rw + rx - 1) | 0) && y < ((rh + ry - 1) | 0)) {
        matchedInBounds = true
        break
      }
      x = (x + 1) | 0
      y = (y + 1) | 0
      step = (step + 1) | 0
    }
    if (matchedInBounds) {
      m.setU32((pIoCoord + 4) >>> 0, y >>> 0)
      m.setU32(pIoCoord, x >>> 0)
    } else {
      m.setU32((pIoCoord + 4) >>> 0, y >>> 0)
      m.setU32(pIoCoord, (nY | 0) >>> 0)
    }
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom, pIoCoord, 2, 0x100, ppOutRoom, 0x64)
    let curRoom = m.u32(ppOutRoom)
    let curX = 0
    let curY = 0
    if (curRoom === 0) {
      curY = nY | 0
      curRoom = pRoom >>> 0
      curX = nX | 0
    } else {
      curY = m.u32((pIoCoord + 4) >>> 0) | 0
      curX = m.u32(pIoCoord) | 0
    }

    const writeSpawnArgs = (rm: number, sx: number, sy: number, maxRad: number): void => {
      m.setU32(pSpawnArgs, pGame >>> 0)
      m.setU32((pSpawnArgs + 0x04) >>> 0, rm >>> 0)
      m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
      m.setU32((pSpawnArgs + 0x0c) >>> 0, nMonsterId >>> 0)
      m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
      m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
      m.setU32((pSpawnArgs + 0x18) >>> 0, sx >>> 0)
      m.setU32((pSpawnArgs + 0x1c) >>> 0, sy >>> 0)
      m.setU32((pSpawnArgs + 0x20) >>> 0, maxRad >>> 0)
      m.setU16((pSpawnArgs + 0x24) >>> 0, 0)
    }

    writeSpawnArgs(curRoom, curX, curY, 0xffffffff)
    let pMonster = MONSTER_Create113c(m, pSpawnArgs)
    if (pMonster === 0) {
      writeSpawnArgs(curRoom, curX, curY, 5)
      pMonster = MONSTER_Create113c(m, pSpawnArgs)
    }
    if (pMonster === 0) {
      let retry = 0
      while (retry < 0x14) {
        curX = (curX + 1) | 0
        curY = (curY + 1) | 0
        m.setU32(pIoCoord, curX >>> 0)
        m.setU32((pIoCoord + 4) >>> 0, curY >>> 0)
        let pSubRoom = ROOM_FindRoomContainingSubtile113c(m, curRoom, curX, curY)
        m.setU32(ppOutRoom, pSubRoom >>> 0)
        if (pSubRoom === 0) {
          pSubRoom = pRoom >>> 0
          m.setU32(ppOutRoom, pRoom >>> 0)
          m.setU32(pIoCoord, (nX | 0) >>> 0)
          m.setU32((pIoCoord + 4) >>> 0, (nY | 0) >>> 0)
        }
        QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
          m,
          pSubRoom,
          pIoCoord,
          2,
          0x100,
          ppOutRoom,
          0x64,
        )
        curRoom = m.u32(ppOutRoom)
        if (curRoom === 0) {
          curRoom = pRoom >>> 0
          curX = nX | 0
          curY = nY | 0
        } else {
          curY = m.u32((pIoCoord + 4) >>> 0) | 0
          curX = m.u32(pIoCoord) | 0
        }
        retry = (retry + 1) | 0
        writeSpawnArgs(curRoom, curX, curY, 10)
        pMonster = MONSTER_Create113c(m, pSpawnArgs)
        if (pMonster !== 0) break
      }
      if (pMonster === 0) {
        writeSpawnArgs(pRoom, nX | 0, nY | 0, 15)
        pMonster = MONSTER_Create113c(m, pSpawnArgs)
      }
    }
    if (pMonster !== 0 && bSetFlag0x03000000 !== 0) {
      m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x03000000) >>> 0)
    }
    return pMonster >>> 0
  } finally {
    k2W4B2StackPtr = sp
  }
}

/**
 * @va D2Game:0x6FC576B0
 */
export function PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC576B0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) return
  PLAYER_FreePlayerDataList98_6FC57500_113c(m, pPlayerData, pGame)
  for (let i = 0; i < 3; i++) {
    const slotAddr = (pPlayerData + 0x60 + i * 4) >>> 0
    const pPair = m.u32(slotAddr)
    QUESTS_FreeBitBufferPair_6FC892D0_113c(m, pPair, pGame)
    m.setU32(slotAddr, 0)
  }
}

/**
 * @va D2Game:0x6FC576F0
 */
export function PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC576F0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) return
  for (let i = 0; i < 3; i++) {
    const pPair = QUESTS_AllocBitBufferPair_6FC89360_113c(m, pGame)
    m.setU32((pPlayerData + 0x60 + i * 4) >>> 0, pPair >>> 0)
  }
  m.setU32((pPlayerData + 0x6c) >>> 0, 0)
}

/**
 * @va D2Game:0x6FC5A790
 */
export function MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pMissile: number,
  pTargetUnit: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC5A790)
  if (pMissile === 0) return
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return

  const baseElem = MISSILES_PopulateDamageByEType_6FC5A280_113c(m, pMissile, pDamage, pTargetUnit)
  const dmnPct = m.u32((pMissilesTxt + 0x78) >>> 0) | 0
  if (dmnPct > 0 && MONSTERS_IsDemonOrUndead113c(m, pTargetUnit) !== 0) {
    const bonus = mulDiv113c(dmnPct, baseElem, 100)
    MISSILES_AddElemDamageByEType_6FC59260_113c(m, pMissile, pDamage, bonus)
  }
  const undPct = m.u32((pMissilesTxt + 0x7c) >>> 0) | 0
  if (undPct > 0 && MONSTER_CheckMonTypeFlag0x20_113c(m, pTargetUnit) !== 0) {
    const bonus = mulDiv113c(undPct, baseElem, 100)
    MISSILES_AddElemDamageByEType_6FC59260_113c(m, pMissile, pDamage, bonus)
  }
}

/**
 * @va D2Game:0x6FC5A850
 */
export function MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
  pDamage: number,
): void {
  hitD2GameVa113c(0x6FC5A850)
  if (pMissile === 0) return
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return

  let pOwner = 0
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
  }
  let pct = MISSILE_ResolveSkillIdByCodeOrRef113c(
    m,
    pMissile,
    pOwner,
    m.u32((pMissilesTxt + 0x90) >>> 0),
    -1,
    -1,
  )
  if (pct <= 0) return
  if (pct >= 100) pct = 100
  const physDmg = m.u32((pDamage + 0x08) >>> 0) | 0
  let converted = mulDiv113c(pct, physDmg, 100)
  if (converted >= physDmg) converted = physDmg
  const baseElem = MISSILES_PopulateDamageByEType_6FC5A280_113c(m, pMissile, pDamage, pTargetUnit)
  const totalElem = (converted + baseElem) | 0
  MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c(m, pMissile, pDamage)
  MISSILES_AddElemDamageByEType_6FC59260_113c(m, pMissile, pDamage, totalElem)
}

/**
 * @va D2Game:0x6FC5A920
 */
export function MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FC5A920)
  if (pMissile === 0) return 1
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 1
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    m.u32((pMissile + 0x94) >>> 0),
    m.u32((pMissile + 0x98) >>> 0),
  )
  if (pOwner === 0 || pTargetUnit === 0) return 1

  const sp = k2W4B2StackPtr
  k2W4B2StackPtr = (sp + 0x70) >>> 0
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((sp + i) >>> 0, 0)
    }
    let healAmount = MISSILES_PopulateDamageByEType_6FC5A280_113c(m, pMissile, sp, pTargetUnit)
    if (healAmount < 0) healAmount = 0
    const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pOwner)
    const curLife = STATLIST_GetUnitStat113c(m, pOwner, 6, 0)
    let newLife = (curLife + healAmount) | 0
    if (newLife >= maxLife) newLife = maxLife
    STATLIST_SetUnitStat113c(m, pOwner, 6, newLife, 0)
    const bPierce = m.u8((pMissilesTxt + 0x186) >>> 0)
    return ((bPierce !== 0 ? 1 : 0) + 2) | 0
  } finally {
    k2W4B2StackPtr = sp
  }
}

/**
 * @va D2Game:0x6FC5D800
 */
export function MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5D800)
  if (pMissile === 0) return 1
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 1
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1

  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
    if (pOwner !== 0) {
      let nStepInner = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
      if (nStepInner < 1) nStepInner = 1
      const nLevel = MISSILE_GetLevel113c(m, pMissile)
      const nSkillId = MISSILE_GetSkill113c(m, pMissile)
      const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
      MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(
        m,
        pMissile,
        nSubMissile,
        pGame,
        pOwner,
        nSkillId,
        nLevel,
        nStepInner,
        2,
        0,
      )
    }
  }
  return 1
}

/**
 * @va D2Game:0x6FC5DA60
 */
export function MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5DA60)
  if (pMissile === 0) return 1
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 1
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    m.u32((pMissile + 0x94) >>> 0),
    m.u32((pMissile + 0x98) >>> 0),
  )
  if (pOwner === 0) return 1

  const pOrigin = pTargetUnit !== 0 ? pTargetUnit : pMissile
  let nStep = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  if (nStep < 1) nStep = 1
  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c(
    m,
    pOrigin,
    nSubMissile,
    pGame,
    pOwner,
    nSkillId,
    nLevel,
    nStep,
  )
  return 3
}

/**
 * @va D2Game:0x6FC5DB30
 */
export function MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5DB30)
  if (pMissile === 0) return 1
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 1
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1

  const pOwner = SUNIT_GetServerUnit113c(
    m,
    pGame,
    m.u32((pMissile + 0x94) >>> 0),
    m.u32((pMissile + 0x98) >>> 0),
  )
  if (pOwner === 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  if (nSkillId < 0 || nSkillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 1
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 1

  const targetUnitId = MISSILE_GetTargetY113c(m, pMissile)
  const targetUnitType = MISSILE_GetTargetX113c(m, pMissile)
  const pHitTarget = SUNIT_GetServerUnit113c(m, pGame, targetUnitType, targetUnitId)
  if (pHitTarget === 0) return 0

  const posX = UNIT_GetPosX113c(m, pMissile)
  const posY = UNIT_GetPosY113c(m, pMissile)
  let nRadius = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  if (nRadius <= 0) {
    nRadius = SKILLS_EvalCalcByOffset113c(
      m,
      pOwner,
      m.u32((pSkillsTxt + 0x64) >>> 0),
      nSkillId,
      nLevel,
    )
    if (nRadius < 1) nRadius = 1
  }
  let nMaxCount = m.u32((pMissilesTxt + 0x50) >>> 0) | 0
  if (nMaxCount <= 0) {
    nMaxCount = SKILLS_EvalCalcByOffset113c(
      m,
      pOwner,
      m.u32((pSkillsTxt + 0x144) >>> 0),
      nSkillId,
      nLevel,
    )
    if (nMaxCount < 1) nMaxCount = 1
  }

  const sp = k2W4B2StackPtr
  k2W4B2StackPtr = (sp + 0x90) >>> 0
  try {
    const pAuraCtx = sp
    const pDmg = (sp + 0x18) >>> 0
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((pDmg + i) >>> 0, 0)
    }
    MISSILE_BuildDamageStrcFromStats113c(m, pMissile, pHitTarget, pDmg)
    MISSILE_ApplyDamageAndArmorShred113c(m, pGame, pDmg, pMissile, pHitTarget)

    let dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0)
    if (dwAuraFilter === 0) dwAuraFilter = 0xa683

    m.setU32(pAuraCtx, pOwner >>> 0)
    m.setU32((pAuraCtx + 0x04) >>> 0, pMissile >>> 0)
    m.setU32((pAuraCtx + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((pAuraCtx + 0x0c) >>> 0, nLevel >>> 0)
    m.setU32((pAuraCtx + 0x10) >>> 0, nMaxCount >>> 0)
    m.setU32((pAuraCtx + 0x14) >>> 0, sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0)

    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pOwner,
      posX,
      posY,
      nRadius,
      dwAuraFilter,
      0x6fc5cc30,
      pAuraCtx,
      0,
      MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c,
    )
    return 1
  } finally {
    k2W4B2StackPtr = sp
  }
}

/**
 * @va D2Game:0x6FC5DD60
 */
export function MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5DD60)
  if (pMissile === 0) return 1
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 1
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 1
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 1

  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  if (nSkillId < 0 || nSkillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 1
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 1

  const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame)
  if (pOwner === 0) return 1

  const posX = UNIT_GetPosX113c(m, pMissile)
  const posY = UNIT_GetPosY113c(m, pMissile)
  let nRadius = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  if (nRadius <= 0) {
    nRadius = SKILLS_EvalCalcByOffset113c(
      m,
      pOwner,
      m.u32((pSkillsTxt + 0x64) >>> 0),
      nSkillId,
      nLevel,
    )
    if (nRadius < 1) nRadius = 1
  }
  let nMaxCount = m.u32((pMissilesTxt + 0x50) >>> 0) | 0
  if (nMaxCount <= 0) {
    nMaxCount = SKILLS_EvalCalcByOffset113c(
      m,
      pOwner,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      nSkillId,
      nLevel,
    )
    if (nMaxCount < 1) nMaxCount = 1
  }

  let dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0)
  if (dwAuraFilter === 0) dwAuraFilter = 0xa783

  const sp = k2W4B2StackPtr
  k2W4B2StackPtr = (sp + 0x20) >>> 0
  try {
    m.setU32(sp, pOwner >>> 0)
    m.setU32((sp + 0x04) >>> 0, pMissile >>> 0)
    m.setU32((sp + 0x08) >>> 0, nSkillId >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nLevel >>> 0)
    m.setU32((sp + 0x10) >>> 0, nMaxCount >>> 0)
    m.setU32((sp + 0x14) >>> 0, sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) >>> 0)

    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pOwner,
      posX,
      posY,
      nRadius,
      dwAuraFilter,
      0x6fc5cd00,
      sp,
      1,
      MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c,
    )
    return 3
  } finally {
    k2W4B2StackPtr = sp
  }
}

/**
 * @va D2Game:0x6FC5E330
 */
export function MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pTargetUnit = 0,
): number {
  hitD2GameVa113c(0x6FC5E330)
  if (pMissile === 0) return 3
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 3
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 3
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 3
  if (sx16(m.u16((pMissilesTxt + 0x24) >>> 0)) < 0) return 3

  const pOrigin = pTargetUnit !== 0 ? pTargetUnit : pMissile
  let pOwner = 0
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
  }
  const nVelocityOverride = m.u32((pMissilesTxt + 0x54) >>> 0) | 0
  const nStepOuter = m.u32((pMissilesTxt + 0x50) >>> 0) | 0
  const nStepInner = m.u32((pMissilesTxt + 0x4c) >>> 0) | 0
  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(
    m,
    pOrigin,
    nSubMissile,
    pGame,
    pOwner,
    nSkillId,
    nLevel,
    nStepInner,
    nStepOuter,
    nVelocityOverride,
  )
  return 3
}

/**
 * @va D2Game:0x6FC604D0
 */
export function MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC604D0)
  if (pMissile === 0) return 2
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 2
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 2
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2
  if (m.u16((pMissilesTxt + 0x18) >>> 0) === 0) return 2

  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  if (nSkillId < 0 || nSkillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 2
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 2

  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  const pOwner1 = SUNIT_GetOwnerUnit113c(m, pMissile, pGame)
  const nRadius = SKILLS_EvalCalcByOffset113c(
    m,
    pOwner1,
    m.u32((pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nLevel,
  )
  const pOwner2 = SUNIT_GetOwnerUnit113c(m, pMissile, pGame)
  const nInterval = SKILLS_EvalCalcByOffset113c(
    m,
    pOwner2,
    m.u32((pSkillsTxt + 0x13c) >>> 0),
    nSkillId,
    nLevel,
  )
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(
    m,
    nInterval,
    pMissile,
    pGame,
    nRadius,
    nSubMissile,
    0x45,
  )
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
}

/**
 * @va D2Game:0x6FC613D0
 */
export function MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC613D0)
  let pMissilesTxt = 0
  if (pMissile !== 0) {
    const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
    if (nMissileId >= 0) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
      if (nMissileId < (m.u32((pTables + 0xb6c) >>> 0) | 0)) {
        pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
      }
    }
  }
  if (pMissilesTxt === 0) return 2

  const nSkillId = MISSILE_GetSkill113c(m, pMissile)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nSkillId < 0 || nSkillId >= (m.u32((pTables + 0xba0) >>> 0) | 0)) return 2
  const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 2

  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  let pOwner1 = 0
  if (pMissile !== 0 && ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner1 = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
  }
  const nRadius = SKILLS_EvalCalcByOffset113c(
    m,
    pOwner1,
    m.u32((pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nLevel,
  )
  let pOwner2 = 0
  if (pMissile !== 0 && ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pOwner2 = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pMissile + 0x94) >>> 0),
      m.u32((pMissile + 0x98) >>> 0),
    )
  }
  const nInterval = SKILLS_EvalCalcByOffset113c(
    m,
    pOwner2,
    m.u32((pSkillsTxt + 0x13c) >>> 0),
    nSkillId,
    nLevel,
  )
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(
    m,
    nInterval,
    pMissile,
    pGame,
    nRadius,
    nSubMissile,
    0x05,
  )
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks)
}

/**
 * @va D2Game:0x6FC61670
 */
export function MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  hooks?: K2GapMeleeDotHooks113c,
): number {
  hitD2GameVa113c(0x6FC61670)
  let pMissilesTxt = 0
  if (pMissile !== 0) {
    const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
    if (nMissileId >= 0) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
      if (nMissileId < (m.u32((pTables + 0xb6c) >>> 0) | 0)) {
        pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
      }
    }
  }
  if (pMissilesTxt === 0) return 2

  const nLevel = MISSILE_GetLevel113c(m, pMissile)
  let par3 = m.u32((pMissilesTxt + 0x40) >>> 0) | 0
  if (par3 < 1) par3 = 1
  const q = (nLevel / par3) | 0
  const bonusRad = q < 2 ? 2 : q
  const nRadius = ((m.u32((pMissilesTxt + 0x38) >>> 0) | 0) + bonusRad) | 0
  const rawInterval = ((m.u32((pMissilesTxt + 0x3c) >>> 0) | 0) - q) | 0
  const nInterval = rawInterval < 3 ? 3 : rawInterval
  const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(
    m,
    nInterval,
    pMissile,
    pGame,
    nRadius,
    nSubMissile,
    0x05,
  )
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks)
}

/**
 * @va D2Game:0x6FC61B80
 */
export function MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61B80)
  if (pMissile !== 0) {
    const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
    if (nMissileId >= 0) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
      if (nMissileId < (m.u32((pTables + 0xb6c) >>> 0) | 0)) {
        const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
        if (pMissilesTxt !== 0 && sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >= 0) {
          let pOwner = 0
          if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
            pOwner = SUNIT_GetServerUnit113c(
              m,
              pGame,
              m.u32((pMissile + 0x94) >>> 0),
              m.u32((pMissile + 0x98) >>> 0),
            )
          }
          const nLevel = MISSILE_GetLevel113c(m, pMissile)
          const nRangeOverride = MISSILE_ResolveSkillIdByCodeOrRef113c(
            m,
            pMissile,
            pOwner,
            m.u32((pMissilesTxt + 0x80) >>> 0),
            nMissileId,
            nLevel,
          )
          const nSubMissile = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
          MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(
            m,
            pMissile,
            nRangeOverride,
            pGame,
            nSubMissile,
            0,
          )
        }
      }
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
}

/**
 * @va D2Game:0x6FC61C30
 */
export function MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61C30)
  if (pMissile === 0) return 2
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 2
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 2
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  const elapsed = MISSILE_GetElapsedFrames113c(m, pMissile)
  let nValidSlots = 0
  for (let i = 0; i < 3; i++) {
    const subId = sx16(m.u16((pMissilesTxt + 0x18 + i * 2) >>> 0))
    const paramVal = m.u32((pMissilesTxt + 0x3c + i * 4) >>> 0) | 0
    if (subId < 0 || paramVal <= 0) break
    nValidSlots++
  }
  if (nValidSlots <= 0) return 2

  if (elapsed >= (m.u32((pMissilesTxt + 0x38) >>> 0) | 0)) {
    const dwType = m.u32(pMissile) | 0
    let lowSeed = 0
    if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
      const pPath = m.u32((pMissile + 0x2c) >>> 0)
      lowSeed = m.u32((pPath + 0x0c) >>> 0)
    } else {
      const pPath = m.u32((pMissile + 0x2c) >>> 0)
      lowSeed = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
    }
    const pSeed = (pMissile + 0x20) >>> 0
    SEED_InitLowSeed113c(m, pSeed, lowSeed)
    const prod = BigInt(m.u32(pSeed)) * 0x6ac690c5n + BigInt(m.u32((pSeed + 4) >>> 0))
    const nextLow = Number(prod & 0xffffffffn) >>> 0
    const nextHigh = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32(pSeed, nextLow)
    m.setU32((pSeed + 4) >>> 0, nextHigh)
    const slotIdx =
      (nValidSlots & (nValidSlots - 1)) === 0
        ? (nextLow & (nValidSlots - 1)) >>> 0
        : (nextLow >>> 0) % (nValidSlots >>> 0)
    const interval = m.u32((pMissilesTxt + 0x3c + slotIdx * 4) >>> 0) | 0
    if (interval !== 0 && (elapsed % interval | 0) === 0) {
      const sp = k2W4B2StackPtr
      k2W4B2StackPtr = (sp + 0x60) >>> 0
      try {
        for (let i = 0; i < 0x5c; i += 4) {
          m.setU32((sp + i) >>> 0, 0)
        }
        let pOwner = 0
        if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
          pOwner = SUNIT_GetServerUnit113c(
            m,
            pGame,
            m.u32((pMissile + 0x94) >>> 0),
            m.u32((pMissile + 0x98) >>> 0),
          )
        }
        m.setU32((sp + 0x04) >>> 0, pOwner >>> 0)
        m.setU32((sp + 0x08) >>> 0, pMissile >>> 0)
        m.setU32((sp + 0x2c) >>> 0, MISSILE_GetSkill113c(m, pMissile) >>> 0)
        m.setU32((sp + 0x30) >>> 0, MISSILE_GetLevel113c(m, pMissile) >>> 0)
        m.setU32((sp + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18 + slotIdx * 2) >>> 0)) >>> 0)
        const pSubUnit = MISSILE_CreateServerProjectile113c(m, pGame, sp)
        if (pSubUnit !== 0) {
          MISSILE_ProcessTargetCollisionHit113c(m, pSubUnit, pGame, 0, 1)
        }
      } finally {
        k2W4B2StackPtr = sp
      }
    }
  }
  return MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(m, pGame, pMissile)
}

/**
 * @va D2Game:0x6FC61DE0
 */
export function MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61DE0)
  if (pMissile === 0) return 2
  const nMissileId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return 2
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if (nMissileId >= (m.u32((pTables + 0xb6c) >>> 0) | 0)) return 2
  const pMissilesTxt = (m.u32((pTables + 0xb64) >>> 0) + Math.imul(nMissileId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2
  if (sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) < 0) return 2

  const pPath = m.u32((pMissile + 0x2c) >>> 0)
  if (PATH_CheckFlag08_113c(m, pPath) !== 0) {
    const sp = k2W4B2StackPtr
    k2W4B2StackPtr = (sp + 0x60) >>> 0
    try {
      for (let i = 0; i < 0x5c; i += 4) {
        m.setU32((sp + i) >>> 0, 0)
      }
      m.setU32(sp, 1)
      const pOwner = SUNIT_GetOwnerUnit113c(m, pMissile, pGame)
      m.setU32((sp + 0x04) >>> 0, pOwner >>> 0)
      m.setU32((sp + 0x08) >>> 0, pMissile >>> 0)
      m.setU32((sp + 0x2c) >>> 0, MISSILE_GetSkill113c(m, pMissile) >>> 0)
      m.setU32((sp + 0x30) >>> 0, MISSILE_GetLevel113c(m, pMissile) >>> 0)
      m.setU32((sp + 0x10) >>> 0, sx16(m.u16((pMissilesTxt + 0x18) >>> 0)) >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame, sp)
    } finally {
      k2W4B2StackPtr = sp
    }
  }
  return MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(m, pGame, pMissile)
}

/**
 * @va D2Game:0x6FC663A0
 *
 * `D2Game.dll@0x6FC663A0..0x6FC663E6` (`eax = pTarget`, `edi = nSkillId`, `esi = nChargeLevel`,
 * stack `[pGame, pUnit, nDuration]`, `ret 0xC`): applies `wAuraState2` StatList (`0x6FC65EE0`)
 * onto `pTarget` with `pCaster = pUnit`, then spawns charged missile (`0x6FC65410`) with
 * `pOwner/pOrigin = pTarget` (`ebx`) and `(TargetX, TargetY)` pointing to `pUnit`.
 */
export function SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDuration: number,
  nSkillId: number,
  nSkillLevel: number,
  nChargeLevel: number,
  pTarget = pUnit,
): number {
  hitD2GameVa113c(0x6FC663A0)
  if ((nChargeLevel | 0) <= 0) return 0
  if (
    SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(
      m,
      pGame,
      pTarget,
      nDuration,
      nSkillId,
      nSkillLevel,
      nChargeLevel,
      pUnit,
    ) !== 0
  ) {
    SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c(
      m,
      nSkillId,
      pTarget,
      pUnit,
      pGame,
      nDuration,
      nChargeLevel,
    )
  }
  return 1
}

/**
 * @va D2Game:0x6FC68950
 */
export function MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC68950)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) return
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  if ((m.u32((pTables + 0xbf0) >>> 0) | 0) <= 7) return
  const pClientSlot = m.u32((pPlayerData + 0x44) >>> 0)
  if (pClientSlot === 0) return
  const pArena = m.u32(pClientSlot)
  if (((pArena + 0x54) >>> 0) === 0) return
  let pNode = m.u32((pArena + 0x54) >>> 0)
  if (pNode === 0) return
  while ((m.u8(pNode) & 1) !== 0) {
    pNode = m.u32((pNode + 0x14) >>> 0)
    if (pNode === 0) return
  }
  const dwMercUnitId = m.u32((pNode + 0x04) >>> 0)
  if (pGame === 0) {
    throw new Error('D2Game_6FC68950: pGame is null')
  }
  let pMerc = m.u32((pGame + 0x1320 + ((dwMercUnitId & 0x7f) << 2)) >>> 0)
  while (pMerc !== 0) {
    if (m.u32((pMerc + 0x0c) >>> 0) === dwMercUnitId) break
    pMerc = m.u32((pMerc + 0xe4) >>> 0)
  }
  if (pMerc === 0) return

  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x0c, STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x00, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x00, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x02, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x02, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x07, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x07, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x06, STATLIST_GetUnitStat113c(m, pMerc, 0x06, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x1f, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x1f, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x0d, STATLIST_GetUnitStat113c(m, pMerc, 0x0d, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x1e, STATLIST_GetUnitStat113c(m, pMerc, 0x1e, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(
    m,
    pMerc,
    0x15,
    (STATLIST_GetUnitBaseStat113c(m, pMerc, 0x17, 0) + STATLIST_GetUnitBaseStat113c(m, pMerc, 0x15, 0)) | 0,
  )
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(
    m,
    pMerc,
    0x16,
    (STATLIST_GetUnitBaseStat113c(m, pMerc, 0x18, 0) + STATLIST_GetUnitBaseStat113c(m, pMerc, 0x16, 0)) | 0,
  )
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x27, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x27, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x29, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x29, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x2b, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x2b, 0))
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pMerc, 0x2d, STATLIST_GetUnitBaseStat113c(m, pMerc, 0x2d, 0))
}

/**
 * @va D2Game:0x6FC6A190
 */
export function CLIENTS_AppendSaveDataChunk_6FC6A190_113c(
  m: D2KernMemory113c,
  dwClientId: number,
  pChunkData: number,
  nChunkSize: number,
  nTotalSize: number,
  dwSaveArg178: number,
): number {
  hitD2GameVa113c(0x6FC6A190)
  if (m.u32(0x6fd31c18) === 0) return 0
  let bCompleted = 0
  let pClient = m.u32((0x6fd307b8 + ((dwClientId & 0xff) << 2)) >>> 0)
  while (pClient !== 0) {
    if (m.u32(pClient) === (dwClientId >>> 0)) {
      const curLen = m.u32((pClient + 0x180) >>> 0)
      let pDst = 0
      if (curLen === 0) {
        pDst = m.alloc(nTotalSize >>> 0) >>> 0
        m.setU32((pClient + 0x17c) >>> 0, pDst >>> 0)
      } else {
        pDst = (m.u32((pClient + 0x17c) >>> 0) + curLen) >>> 0
      }
      const newLen = (curLen + nChunkSize) >>> 0
      if ((newLen | 0) > (nTotalSize | 0)) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xb1b)
      }
      for (let i = 0; i < (nChunkSize >>> 0); i++) {
        m.setU8((pDst + i) >>> 0, m.u8((pChunkData + i) >>> 0))
      }
      m.setU32((pClient + 0x180) >>> 0, newLen)
      m.setU32((pClient + 0x178) >>> 0, dwSaveArg178 >>> 0)
      if ((newLen | 0) === (nTotalSize | 0)) {
        m.setU32((pClient + 0x3d4) >>> 0, (m.u32((pClient + 0x3d4) >>> 0) | 0x08) >>> 0)
        const checksum = PLAYERSAVE_ComputeHeaderChecksum_6FC73170_113c(
          m,
          m.u32((pClient + 0x17c) >>> 0),
          newLen,
        )
        m.setU32((pClient + 0x18c) >>> 0, checksum >>> 0)
        bCompleted = 1
      }
      break
    }
    pClient = m.u32((pClient + 0x4ac) >>> 0)
  }
  return bCompleted
}
/**
 * Collects nearby player units in adjacent rooms into a bounded distance-ordered
 * list and records their positions onto the client tracker.
 *
 * @va D2Game:0x6FC6AD80
 */
export function CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(
  m: D2KernMemory113c,
  pClient: number,
  nMaxCount: number,
): void {
  hitD2GameVa113c(0x6FC6AD80)
  const pRoom = m.u32((pClient + 0x1b4) >>> 0);
  if (pRoom === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x6f7);
  }
  const sp = k2W4B2StackPtr;
  k2W4B2StackPtr = (sp + 0x2b0) >>> 0;
  try {
    const pCount = sp;
    const pppRooms = (sp + 0x08) >>> 0;
    const pMaxDist = (sp + 0x10) >>> 0;
    const pList = (sp + 0x18) >>> 0;
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pppRooms, pCount);
    const ppRooms = m.u32(pppRooms);
    if (ppRooms === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x6f9);
    }
    const pPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0);
    if (pPlayer === 0) {
      return;
    }
    const posX = UNIT_GetPosX113c(m, pPlayer);
    const posY = UNIT_GetPosY113c(m, pPlayer);
    const nRooms = m.u32(pCount) >>> 0;
    m.setU32(pMaxDist, 0);
    m.setU32((pClient + 0x3bc) >>> 0, 0);
    m.setU32((pList + 0x04) >>> 0, 0);
    m.setU32((pList + 0x08) >>> 0, 0);
    for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
      const pAdjRoom = m.u32((ppRooms + i * 4) >>> 0);
      let pUnit = m.u32((pAdjRoom + 0x74) >>> 0);
      while (pUnit !== 0) {
        SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(
          m,
          posX,
          pList,
          pUnit,
          posY,
          pMaxDist,
          pClient,
          nMaxCount,
        );
        pUnit = m.u32((pUnit + 0xe8) >>> 0);
      }
    }
    CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c(m, pClient, pList);
  } finally {
    k2W4B2StackPtr = sp;
  }
}

/**
 * Evaluates aura radius, duration, and stat values from `skills.txt` (`+0x60`, `+0x64`, `+0x68`)
 * and applies the aura statlist to all matching units in radius via `0x6FC6C220`.
 *
 * @va D2Game:0x6FC6C2A0
 */
export function SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C2A0)
  if ((nSkillId | 0) < 0) {
    return 0;
  }
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  if ((nSkillId | 0) >= (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    return 0;
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) {
    return 0;
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0));
  if (wAuraState < 0 || wAuraState >= (m.u32((pTables + 0xc4) >>> 0) | 0)) {
    return 0;
  }
  const wAuraTargetStat = sx16(m.u16((pSkillsTxt + 0x54) >>> 0));
  if (wAuraTargetStat < 0 || wAuraTargetStat >= (m.u32((pTables + 0xbd4) >>> 0) | 0)) {
    return 0;
  }
  const val60 = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x60) >>> 0),
    nSkillId,
    nSkillLevel,
  );
  const val68 = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x68) >>> 0),
    nSkillId,
    nSkillLevel,
  );
  const nRadius = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    m.u32((pSkillsTxt + 0x64) >>> 0),
    nSkillId,
    nSkillLevel,
  );
  const dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0);
  const pAuraCtx = k2W4B2StackPtr;
  k2W4B2StackPtr = (pAuraCtx + 0x18) >>> 0;
  try {
    m.setU32((pAuraCtx + 0x00) >>> 0, nSkillId >>> 0);
    m.setU32((pAuraCtx + 0x04) >>> 0, nSkillLevel >>> 0);
    m.setU32((pAuraCtx + 0x08) >>> 0, val60 >>> 0);
    m.setU32((pAuraCtx + 0x0c) >>> 0, wAuraState >>> 0);
    m.setU32((pAuraCtx + 0x10) >>> 0, wAuraTargetStat >>> 0);
    m.setU32((pAuraCtx + 0x14) >>> 0, val68 >>> 0);
    AURA_ForEachUnitInRadius113c(
      m,
      pGame,
      pUnit,
      0,
      0,
      nRadius,
      dwAuraFilter,
      0x6fc6c220,
      pAuraCtx,
      1,
      SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c,
    );
  } finally {
    k2W4B2StackPtr = pAuraCtx;
  }
  return 1;
}

/**
 * Consumes a selectable corpse target (`state 0x76`) and spawns a 16-ray ring
 * of `wSrvMissileA` (`+0x48`) sub-missiles from the corpse.
 *
 * @va D2Game:0x6FC70190
 */
export function SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC70190)
  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C));
  let pSkillsTxt = 0;
  if ((nSkillId | 0) >= 0 && (nSkillId | 0) < (m.u32((pTables + 0xba0) >>> 0) | 0)) {
    const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
    pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  }
  if (nSkillId === 0 || pSkillsTxt === 0) {
    return 0;
  }
  const wSrvMissileA = sx16(m.u16((pSkillsTxt + 0x48) >>> 0));
  if (wSrvMissileA >= 0 && wSrvMissileA < (m.u32((pTables + 0xb6c) >>> 0) | 0)) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
    const pPath = m.u32((pUnit + 0x2c) >>> 0);
    const pCorpse = PATH_GetTargetUnit113c(m, pPath);
    if (
      pCorpse === pUnit ||
      pCorpse === 0 ||
      SKILLS_IsSelectableCorpse11157_113c(m, pCorpse) === 0
    ) {
      return 0;
    }
    STATES_ToggleGfxStateFlag113c(m, pCorpse, 0x76, 1);
    UNITROOM_RefreshUnit113c(m, pCorpse);
    const nMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0));
    MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(
      m,
      pCorpse,
      nMissileId,
      pGame,
      pUnit,
      nSkillId,
      nSkillLevel,
      0,
      2,
      0,
    );
  }
  return 1;
}

/**
 * Copies cached player inventory save data (`pPlayerData+0x5C`) when `bUseCached5C != 0`
 * and buffer capacity suffices, or falls back to `PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c`.
 *
 * @va D2Game:0x6FC73B40
 */
export function PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  pBuffer: number,
  nMaxBytes: number,
  bUseCached5C: number,
  arg4: number,
  arg5: number,
): number {
  hitD2GameVa113c(0x6FC73B40)
  if (bUseCached5C !== 0 && pPlayerUnit !== 0 && m.u32(pPlayerUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
    const pCached = m.u32((pPlayerData + 0x5c) >>> 0);
    if (pCached !== 0) {
      const nCachedLen = m.u32(pCached) | 0;
      if ((nMaxBytes | 0) >= nCachedLen) {
        const pSrc = m.u32((pCached + 4) >>> 0);
        const pDst = pBuffer >>> 0;
        const len = nCachedLen >>> 0;
        for (let i = 0; i < len; i = (i + 1) >>> 0) {
          m.setU8((pDst + i) >>> 0, m.u8((pSrc + i) >>> 0));
        }
        const res = m.u32(pCached) | 0;
        if (res !== 0) {
          return res;
        }
      }
    }
  }
  return PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c(
    m,
    pBuffer,
    m.u32((pPlayerUnit + 0x60) >>> 0),
    pGame,
    pPlayerUnit,
    nMaxBytes,
    bUseCached5C,
    arg4,
    arg5,
  );
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x24`) if quest record `0x28`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC78D40
 */
export function ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC78D40)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x24, pPlayerUnit, pGame);
  }
  return 0;
}
/**
 * Sends quest alert packet `0x5D` (`questId = 0x23`) if quest record `0x27`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC78F90
 */
export function ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC78F90)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x27, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x27, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x27, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x27, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x23, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x22`) if quest record `0x26`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC790C0
 */
export function ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC790C0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x26, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x26, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x26, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x26, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x22, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x21`) if quest record `0x25`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC791D0
 */
export function ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC791D0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x25, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x25, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x25, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x25, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x21, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x20`) if quest record `0x24`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC793F0
 */
export function ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC793F0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x24, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x24, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x24, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x24, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x20, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x1F`) if quest record `0x23`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC79620
 */
export function ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC79620)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x23, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x23, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x23, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x23, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x1f, pPlayerUnit, pGame);
  }
  return 0;
}
/**
 * Forwards Act 5 Quest 6 completion packet `0x50` (`questId = 0x24`) via `0x6FC78A40`
 * and returns `0`.
 *
 * @va D2Game:0x6FC799D0
 */
export function ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC799D0)
  ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(m, pPlayerUnit, pGame);
  return 0;
}

/**
 * Checks whether the player is in Worldstone Chamber (`levelId = 0x84`) with quest `0x28`
 * bits `0` and `1` clear, and completes quest `0x28` via `0x6FC78BE0`.
 *
 * @va D2Game:0x6FC799E0
 */
export function ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC799E0)
  const pPlayerData0 = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff0 = m.u8((pGame + 0x6d) >>> 0);
  const pFlags0 = m.u32((pPlayerData0 + 0x10 + nDiff0 * 4) >>> 0);
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags0, 0x28, 0) === 1) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayerUnit);
  if (pRoom === 0) {
    return 0;
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) !== 0x84) {
    return 0;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 0) !== 0) {
    return 0;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x28, 1) !== 0) {
    return 0;
  }
  ACT5Q6_CompleteQuest28AndUpdateProgression_6FC78BE0_113c(m, pFlags, pPlayerUnit, pGame);
  return 0;
}

/**
 * Initializes the Act 5 prologue quest descriptor (`questId = 0x2A`) callback
 * table and status filter pointers on `pQuest`.
 *
 * @va D2Game:0x6FC7A7C0
 */
export function ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC7A7C0)
  const pCallbacks = (pQuest + 0xa0) >>> 0;
  for (let i = 0; i < 0x0f; i = (i + 1) >>> 0) {
    m.setU32((pCallbacks + i * 4) >>> 0, 0);
  }
  m.setU32(pCallbacks, 0x6fc796b0);
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fc797b0);
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd2a9a8);
  m.setU8((pQuest + 0x0a) >>> 0, 1);
  m.setU8((pQuest + 0x0c) >>> 0, 0);
  m.setU8((pQuest + 0x0b) >>> 0, 0);
  m.setU32((pQuest + 0x18) >>> 0, 0);
  m.setU32((pQuest + 0xe0) >>> 0, 0x2a);
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fc76ea0);
  m.setU32((pQuest + 0xec) >>> 0, 0x6fc79680);
}

/**
 * Totals Scroll of Resistance (`questId = 0x25`, bit `7`) bonuses (`+10` per difficulty)
 * across Normal, Nightmare, and Hell and applies the resistance stats via `0x6FC7A000`.
 *
 * @va D2Game:0x6FC7B0B0
 */
export function ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7B0B0)
  let nTotalBonus = 0;
  const pData0 = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (DRLGWARP_TestRoomTileBit113c(m, m.u32((pData0 + 0x10) >>> 0), 0x25, 7) !== 0) {
    nTotalBonus = 0x0a;
  }
  const pData1 = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (DRLGWARP_TestRoomTileBit113c(m, m.u32((pData1 + 0x14) >>> 0), 0x25, 7) !== 0) {
    nTotalBonus = (nTotalBonus + 0x0a) | 0;
  }
  const pData2 = UNITS_GetPlayerData113c(m, pPlayerUnit);
  if (DRLGWARP_TestRoomTileBit113c(m, m.u32((pData2 + 0x18) >>> 0), 0x25, 7) !== 0) {
    nTotalBonus = (nTotalBonus + 0x0a) | 0;
  }
  if (nTotalBonus !== 0) {
    ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c(m, pPlayerUnit, nTotalBonus, pGame);
  }
}

/**
 * Finds a free subtile near `pUnit`'s target position (`(x - 5, y - 5)`) and spawns
 * monster class `0x209` (`mode = 1`, `flags = 0x42`) via `MONSTER_Create113c`.
 *
 * @va D2Game:0x6FC7C1F0
 */
export function ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FC7C1F0)
  const sp = k2W4B2StackPtr;
  k2W4B2StackPtr = (sp + 0x34) >>> 0;
  try {
    const ppOutRoom = sp;
    const pIoCoord = (sp + 0x04) >>> 0;
    const pSpawnArgs = (sp + 0x0c) >>> 0;
    m.setU32(ppOutRoom, 0);
    PATH_GetTargetTypeAndPosition113c(m, pUnit, pIoCoord);
    const x = (m.u32(pIoCoord) - 5) >>> 0;
    const y = (m.u32((pIoCoord + 4) >>> 0) - 5) >>> 0;
    m.setU32(pIoCoord, x);
    m.setU32((pIoCoord + 4) >>> 0, y);
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
      m,
      pRoom,
      pIoCoord,
      5,
      0x400,
      ppOutRoom,
      0x64,
    );
    const pOutRoom = m.u32(ppOutRoom);
    if (pOutRoom !== 0) {
      const outX = m.u32(pIoCoord);
      const outY = m.u32((pIoCoord + 4) >>> 0);
      m.setU32((pSpawnArgs + 0x00) >>> 0, pGame >>> 0);
      m.setU32((pSpawnArgs + 0x04) >>> 0, pOutRoom >>> 0);
      m.setU32((pSpawnArgs + 0x08) >>> 0, 0);
      m.setU32((pSpawnArgs + 0x0c) >>> 0, 0x209);
      m.setU32((pSpawnArgs + 0x10) >>> 0, 1);
      m.setU32((pSpawnArgs + 0x14) >>> 0, 0);
      m.setU32((pSpawnArgs + 0x18) >>> 0, outX >>> 0);
      m.setU32((pSpawnArgs + 0x1c) >>> 0, outY >>> 0);
      m.setU32((pSpawnArgs + 0x20) >>> 0, 4);
      m.setU16((pSpawnArgs + 0x24) >>> 0, 0x42);
      MONSTER_Create113c(m, pSpawnArgs);
    }
  } finally {
    k2W4B2StackPtr = sp;
  }
}
/**
 * Spawns Act 5 Quest 1 monster `0x1FF` (`Shenk`) near `(pOp+0x14, pOp+0x18)` if quest `0x1F`
 * has not yet spawned it (`u8(pQuestData+0x15) == 0`), and transfers its quest data pointer.
 *
 * @va D2Game:0x6FC7C3A0
 */
export function ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c(
  m: D2KernMemory113c,
  pOp: number,
): void {
  hitD2GameVa113c(0x6FC7C3A0)
  const pGame = m.u32(pOp);
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  if (pQuestControl === 0) {
    return;
  }
  let pQuest = m.u32(pQuestControl);
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x1f) {
      break;
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) {
    return;
  }
  const pQuestData = m.u32((pQuest + 0x18) >>> 0);
  if (m.u8((pQuestData + 0x15) >>> 0) !== 0) {
    return;
  }
  const sp = k2W4B2StackPtr;
  k2W4B2StackPtr = (sp + 0x10) >>> 0;
  try {
    const ppOutRoom = sp;
    const pIoCoord = (sp + 0x04) >>> 0;
    m.setU32(pIoCoord, m.u32((pOp + 0x14) >>> 0));
    m.setU32((pIoCoord + 4) >>> 0, m.u32((pOp + 0x18) >>> 0));
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
      m,
      m.u32((pOp + 0x08) >>> 0),
      pIoCoord,
      2,
      0x100,
      ppOutRoom,
      0x64,
    );
    const pOutRoom = m.u32(ppOutRoom);
    if (pOutRoom === 0) {
      return;
    }
    const outX = m.u32(pIoCoord);
    const outY = m.u32((pIoCoord + 4) >>> 0);
    const pMonster = MONSTER_SpawnAtCoords113c(
      m,
      0x1ff,
      1,
      m.u32(pOp),
      pOutRoom,
      outX,
      outY,
      5,
      0,
    );
    if (pMonster === 0) {
      return;
    }
    m.setU8((pQuestData + 0x15) >>> 0, 1);
    m.setU32((pQuestData + 0x10) >>> 0, m.u32((pMonster + 0x0c) >>> 0));
    m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x03000000) >>> 0);
    const pSub0 = m.u32(pQuestData);
    if (
      pSub0 !== 0 &&
      m.u32((pSub0 + 4) >>> 0) !== 0 &&
      m.u8((pQuestData + 0x17) >>> 0) === 0
    ) {
      const pDstPtr = AIGENERAL_GetQuestDataPtr38_113c(m, pMonster);
      DRLGPRESET_MovePointerAndClear113c(m, pQuestData, pDstPtr);
      m.setU8((pQuestData + 0x17) >>> 0, 1);
    }
  } finally {
    k2W4B2StackPtr = sp;
  }
}

/**
 * Spawns object `0x235` (`Destruction's End` portal) near `(x + 5, y)` when `pUnit`
 * is inside Worldstone Chamber (`levelId = 0x84`).
 *
 * @va D2Game:0x6FC7D760
 */
export function ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7D760)
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0 || DUNGEON_GetLevelIdFromRoom113c(m, pRoom) !== 0x84) {
    return 0;
  }
  const sp = k2W4B2StackPtr;
  k2W4B2StackPtr = (sp + 0x18) >>> 0;
  try {
    const ppOutRoom = sp;
    const pIoCoord = (sp + 0x08) >>> 0;
    PATH_GetTargetTypeAndPosition113c(m, pUnit, pIoCoord);
    m.setU32(pIoCoord, (m.u32(pIoCoord) + 5) >>> 0);
    m.setU32(ppOutRoom, UNITS_GetRoom113c(m, pUnit));
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
      m,
      pRoom,
      pIoCoord,
      5,
      0x400,
      ppOutRoom,
      0x64,
    );
    const pOutRoom = m.u32(ppOutRoom);
    if (pOutRoom !== 0) {
      const outX = m.u32(pIoCoord);
      const outY = m.u32((pIoCoord + 4) >>> 0);
      const pObj = UNIT_Alloc113c(m, 2);
      if (pObj !== 0) {
        m.setU32((pObj + 0x00) >>> 0, 2);
        m.setU32((pObj + 0x04) >>> 0, 0x235);
        m.setU32((pObj + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0));
        m.setU32((pObj + 0x80) >>> 0, pGame >>> 0);
        let flagsC8 = m.u32((pObj + 0xc8) >>> 0);
        if (m.u32((pGame + 0x70) >>> 0) !== 0) {
          flagsC8 = (flagsC8 | 0x02000000) >>> 0;
        } else {
          flagsC8 = (flagsC8 & 0xfdffffff) >>> 0;
        }
        flagsC8 = (flagsC8 | 0x04000000) >>> 0;
        m.setU32((pObj + 0xc8) >>> 0, flagsC8);
        const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pOutRoom);
        const actNo = DRLG_GetActNoFromLevelId113c(m, levelId) & 0xff;
        m.setU8((pObj + 0x18) >>> 0, actNo);
        m.setU32((pObj + 0x1c) >>> 0, m.u32((pGame + 0xbc + actNo * 4) >>> 0));
        m.setU32((pObj + 0x74) >>> 0, 0);
        SUNIT_InitUnitSeed113c(m, pObj, (pGame + 0xd0) >>> 0);
        m.setU32((pObj + 0xc4) >>> 0, (m.u32((pObj + 0xc4) >>> 0) | 0x10) >>> 0);
        m.setU32((pObj + 0xd0) >>> 0, 0x0b);
        let nextObjId = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0;
        if (nextObjId === 0xffffffff) {
          nextObjId = 1;
        }
        m.setU32((pGame + 0x98) >>> 0, nextObjId);
        const pObjData = m.alloc(0x38);
        m.setU32((pObj + 0x14) >>> 0, pObjData);
        for (let i = 0; i < 0x0e; i = (i + 1) >>> 0) {
          m.setU32((pObjData + i * 4) >>> 0, 0);
        }
        m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, 0x235));
        m.setU32((pObj + 0x10) >>> 0, 1);
        UNITS_AllocStaticPath113c(m, pObj);
        OBJECTS_InitObjectUnit113c(m, pObj, pGame, nextObjId, pOutRoom, outX, outY);
        SUNIT_PlaceServerUnitInRoom113c(m, pOutRoom, outY, pObj, outX, pGame, 1);
      }
    }
  } finally {
    k2W4B2StackPtr = sp;
  }
  return 1;
}

/**
 * Finds Act 5 Quest 3 (`questId = 0x21`) and thaws the frozen Anya monster (`+0x9C`)
 * via `0x6FC7DD00`.
 *
 * @va D2Game:0x6FC7DEF0
 */
export function ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC7DEF0)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0);
  if (pQuestControl === 0) {
    return;
  }
  let pQuest = m.u32(pQuestControl);
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x21) {
      break;
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) {
    return;
  }
  const pQuestData = m.u32((pQuest + 0x18) >>> 0);
  const dwMonsterId = m.u32((pQuestData + 0x9c) >>> 0);
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0);
  if (pQuestGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d3);
  }
  let pMonster = m.u32((pQuestGame + 0x1320 + (dwMonsterId & 0x7f) * 4) >>> 0);
  while (pMonster !== 0) {
    if (m.u32((pMonster + 0x0c) >>> 0) === dwMonsterId) {
      ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, pMonster, pQuest);
      return;
    }
    pMonster = m.u32((pMonster + 0xe4) >>> 0);
  }
}

/**
 * Resets all three Ancients (`0x21C..0x21E`) back to their altar statue objects
 * and resets the Ancients Altar (`+0x50`) animation mode to `0`.
 *
 * @va D2Game:0x6FC7E0E0
 */
export function ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC7E0E0)
  for (let i = 0; i < 3; i = (i + 1) >>> 0) {
    if (m.u8((pQuestData + 0x2c + i) >>> 0) !== 0) {
      const dwMonId = m.u32((pQuestData + 0x20 + i * 4) >>> 0);
      if (ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(m, pGame, dwMonId) !== 0) {
        m.setU32((pQuestData + 0x40) >>> 0, (m.u32((pQuestData + 0x40) >>> 0) - 1) >>> 0);
        m.setU32((pQuestData + 0x44) >>> 0, (m.u32((pQuestData + 0x44) >>> 0) - 1) >>> 0);
      } else {
        MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, pGame, 4, (0x21c + i) >>> 0);
      }
      m.setU8((pQuestData + 0x2c + i) >>> 0, 0);
    }
  }
  m.setU8((pQuestData + 0x48) >>> 0, 0);
  for (let i = 0; i < 3; i = (i + 1) >>> 0) {
    m.setU8((pQuestData + 0x3c + i) >>> 0, 0);
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0);
    const dwStatueObjId = m.u32((pQuestData + 0x14 + i * 4) >>> 0);
    if (pQuestGame === 0) {
      throw new Error('D2Game_6FC7E0E0: pQuestGame is null');
    }
    let pObj = m.u32((pQuestGame + 0x1520 + (dwStatueObjId & 0x7f) * 4) >>> 0);
    while (pObj !== 0) {
      if (m.u32((pObj + 0x0c) >>> 0) === dwStatueObjId) {
        UNITS_ChangeAnimMode113c(m, pObj, 0);
        break;
      }
      pObj = m.u32((pObj + 0xe4) >>> 0);
    }
    m.setU32((pQuestData + 0x30 + i * 4) >>> 0, 0);
  }
  m.setU32((pQuestData + 0x4c) >>> 0, 0);
  const dwAltarObjId = m.u32((pQuestData + 0x50) >>> 0);
  if (pGame === 0) {
    throw new Error('D2Game_6FC7E0E0: pGame is null');
  }
  let pAltar = m.u32((pGame + 0x1520 + (dwAltarObjId & 0x7f) * 4) >>> 0);
  while (pAltar !== 0) {
    if (m.u32((pAltar + 0x0c) >>> 0) === dwAltarObjId) {
      UNITS_ChangeAnimMode113c(m, pAltar, 0);
      return;
    }
    pAltar = m.u32((pAltar + 0xe4) >>> 0);
  }
}

/**
 * Transitions Act 5 Quest 3 town Malah/Anya NPCs and schedules event `7` on the
 * frozen Anya object (`+0x110`) when Anya is rescued.
 *
 * @va D2Game:0x6FC7EC30
 */
export function ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(
  m: D2KernMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FC7EC30)
  const pQuestData = m.u32((pQuest + 0x18) >>> 0);
  if (
    m.u8((pQuestData + 0x91) >>> 0) !== 0 &&
    m.u32((pQuestData + 0x84) >>> 0) !== 2
  ) {
    const pGame = m.u32((pQuest + 0x04) >>> 0);
    const dwMon94 = m.u32((pQuestData + 0x94) >>> 0);
    if (pGame === 0) {
      throw new Error('D2Game_6FC7EC30: pGame is null');
    }
    let pMon94 = m.u32((pGame + 0x1320 + (dwMon94 & 0x7f) * 4) >>> 0);
    while (pMon94 !== 0) {
      if (m.u32((pMon94 + 0x0c) >>> 0) === dwMon94) {
        break;
      }
      pMon94 = m.u32((pMon94 + 0xe4) >>> 0);
    }
    if (pMon94 !== 0) {
      let pInteract = 0;
      if (m.u32(pMon94) === 1) {
        const pMonData = m.u32((pMon94 + 0x14) >>> 0);
        if (pMonData !== 0) {
          pInteract = m.u32((pMonData + 0x30) >>> 0);
        }
      }
      if (MONSTER_HasAnyInteractingPlayer113c(m, pInteract) !== 0) {
        MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(m, pGame, pMon94, 0);
      }
      SKILLS_SetUsedSkillMemPort113c(m, pMon94, 0);
      MONSTER_StartMode113c(m, m.u32((pQuest + 0x04) >>> 0), pMon94, 0x0c, 0, 0, 0);
      const pMonRoom = UNITS_GetRoom113c(m, pMon94);
      DUNGEON_AddRoomPortalNode113c(
        m,
        pMonRoom,
        m.u32(pMon94),
        m.u32((pQuestData + 0x94) >>> 0),
      );
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, pMon94);
      UNITROOM_RemoveUnitFromRoom113c(m, pMon94);
    } else {
      MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, pGame, 4, 0x200);
    }
    m.setU8((pQuestData + 0x91) >>> 0, 0);
  }
  if (m.u8((pQuestData + 0x93) >>> 0) !== 0) {
    const pGame = m.u32((pQuest + 0x04) >>> 0);
    const dwMon9C = m.u32((pQuestData + 0x9c) >>> 0);
    if (pGame === 0) {
      throw new Error('D2Game_6FC7EC30: pGame is null');
    }
    let pMon9C = m.u32((pGame + 0x1320 + (dwMon9C & 0x7f) * 4) >>> 0);
    while (pMon9C !== 0) {
      if (m.u32((pMon9C + 0x0c) >>> 0) === dwMon9C) {
        break;
      }
      pMon9C = m.u32((pMon9C + 0xe4) >>> 0);
    }
    if (pMon9C !== 0) {
      ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c(m, pMon9C, pQuest);
      const pGame2 = m.u32((pQuest + 0x04) >>> 0);
      const dwObj110 = m.u32((pQuestData + 0x110) >>> 0);
      if (pGame2 === 0) {
        throw new Error('D2Game_6FC7EC30: pGame2 is null');
      }
      let pObj110 = m.u32((pGame2 + 0x1520 + (dwObj110 & 0x7f) * 4) >>> 0);
      while (pObj110 !== 0) {
        if (m.u32((pObj110 + 0x0c) >>> 0) === dwObj110) {
          const pGame3 = m.u32((pQuest + 0x04) >>> 0);
          const nextFrame = (m.u32((pGame3 + 0xa8) >>> 0) + 1) >>> 0;
          EVENT_SetEventFull113c(m, pGame3, pObj110, 7, nextFrame, 0, 0, 0);
          break;
        }
        pObj110 = m.u32((pObj110 + 0xe4) >>> 0);
      }
    } else {
      MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(m, pGame, 4, 0x202);
    }
    m.setU8((pQuestData + 0x93) >>> 0, 0);
  }
  if (m.u32((pQuestData + 0x88) >>> 0) === 0) {
    m.setU32((pQuestData + 0x88) >>> 0, 1);
  }
}
/**
 * Sends quest alert packet `0x5D` (`questId = 0x06`) if quest record `0x06`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC82700
 */
export function ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82700)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x06, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x06, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x06, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x06, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x06, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x05`) if quest record `0x05`
 * has `bit 0 == 0 || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC82870
 */
export function ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82870)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x05, 0) === 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x05, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x05, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x05, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x04`) if quest record `0x04`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC82A80
 */
export function ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82A80)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x04, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x04, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x04, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x04, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x04, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x03`) if quest record `0x03`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC82AE0
 */
export function ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82AE0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x03, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x03, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x03, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x03, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x03, pPlayerUnit, pGame);
  }
  return 0;
}

/**
 * Sends quest alert packet `0x5D` (`questId = 0x02`) if quest record `0x02`
 * has `(bit 0 == 0 && bit 0x0F == 0) || bit 0x0D != 0 || bit 0x0E != 0`.
 *
 * @va D2Game:0x6FC82C00
 */
export function ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82C00)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit);
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pFlags = m.u32((pPlayerData + 0x10 + nDiff * 4) >>> 0);
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x02, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x02, 0x0f) === 0) ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x02, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x02, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x02, pPlayerUnit, pGame);
  }
  return 0;
}
