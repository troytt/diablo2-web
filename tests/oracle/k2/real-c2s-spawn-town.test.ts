import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_AllocItemData113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  INVENTORY_GetItemFromBodyLocMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../../../src/d2kern-113c/common/k0-d2common-memports.ts'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_AllocSkillList113c,
  SKILLS_GetParam4113c,
  SKILLS_GetSkillById113c,
  SKILLS_SetParam4113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_SetSkillSlotIndex113c,
  SGPT_EXPERIENCE_TXT_PTR_VA_113C,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { UNIT_GetAlignment113c } from '../../../src/d2kern-113c/common/unit.ts'
import {
  SKILLS_ConsumeSkillManaOrCharge113c,
  SKILLS_StartPlayerSkillAnimOrCast113c,
  SUNIT_DispatchItemEventCallbacks113c,
  SrvDoFunc_001_Attack113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts'
import {
  D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C,
  GAME_StepClientJoinStatesAndTimeouts113c,
  MONSTER_DispatchMinionComponentCallbacks113c,
  OBJECT_SyncStateAndEventsToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c.ts'
import {
  C2S_CheckCoordDeltaExceeded113c,
  C2S_DispatchPacketMem113c,
  C2S_ExecuteSkillOnLocation113c,
  C2S_ExecuteSkillOnUnit113c,
  C2S_Packet01_WalkToLocation113c,
  C2S_Packet02_WalkToUnit113c,
  C2S_Packet03_RunToLocation113c,
  C2S_Packet04_RunToUnit113c,
  C2S_Packet05_LeftSkillOnLocation113c,
  C2S_Packet06_LeftSkillOnUnit113c,
  C2S_Packet07_ShiftLeftSkillOnUnit113c,
  C2S_Packet08_RepeatLeftSkillOnLocation113c,
  C2S_Packet09_RepeatLeftSkillOnUnit113c,
  C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c,
  C2S_Packet0B_Noop1Byte113c,
  C2S_Packet0C_RightSkillOnLocation113c,
  C2S_Packet0D_RightSkillOnUnit113c,
  C2S_Packet0E_ShiftRightSkillOnUnit113c,
  C2S_Packet0F_RepeatRightSkillOnLocation113c,
  C2S_Packet10_RepeatRightSkillOnUnit113c,
  C2S_Packet11_RepeatShiftRightSkillOnUnit113c,
  C2S_Packet3C_SelectSkill113c,
  C2S_Packet5F_UpdatePlayerPos113c,
  C2S_ResolveDualWieldThrowSkill113c,
  C2S_RunToTargetAndSetQueuedSkill113c,
  C2S_UnpackAndValidateLocationPacket113c,
  C2S_UnpackAndValidateUnitPacket113c,
  C2S_ValidateTargetUnitDistance113c,
  D2ClientStrcOffsets,
  PLAYER_StartModeAtCoords113c,
  PLAYER_StartModeOnUnit113c,
  PLRMODE_ATTACK1,
  PLRMODE_CAST,
  PLRMODE_DEATH,
  PLRMODE_NEUTRAL,
  PLRMODE_RUN,
  PLRMODE_WALK,
} from '../../../src/d2kern-113c/game/c2s-packet-113c.ts'
import {
  ITEMEVENT_AttackerTakesDamage113c,
  ITEMEVENT_ChanceToCastSkill113c,
  ITEMEVENT_ManaAfterKill113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c.ts'
import { OBJECTS_CheckLevelObjectHook113c } from '../../../src/d2kern-113c/game/objects-populate-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  MONSTER_AddSkillToUnit113c,
  MONSTER_EquipMonEquipItems113c,
  MONSTER_InitMonsterUnit113c,
  MONSTER_InitSpecialClassEvents113c,
  MONSTER_InitStats113c,
  MONSTER_PostSpawnQuestAndSpecialInit113c,
  SUNIT_DeactivateUnitStatesAndEvents113c,
  SUNIT_SetMonsterAlignmentState113c,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { ROOM_SpawnMonsterPreset113c } from '../../../src/d2kern-113c/game/room-presets-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  AIGENERAL_FindAiCommandByType113c,
  AIGENERAL_GetOrAllocAiCommandByType113c,
  AI_CheckReturnHomeToNode10_113c,
  AI_FindNearestPlayerTarget113c,
  AI_FollowDs1NpcPathMem113c,
  AI_InitHomeNode10_113c,
  AI_MapAiAction1_WalkToWaypoint113c,
  AI_MapAiAction2_WalkAndWait20_113c,
  AI_MapAiAction3_WalkToWaypoint113c,
  AI_MapAiAction4_WalkAndMode8_113c,
  AI_MapAiAction5_WalkAndMode9_113c,
  AI_RogueTownMem113c,
  AI_SimpleMapAiNpc113c,
  AI_StepRelativeToTargetUnit113c,
  AI_TickNodes4_5_7_113c,
  AI_TownNpcMem113c,
  AI_WarrivGreetMem113c,
  D2AiTickParamOffsets,
  D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90,
  D2MONSTERDATA_MAPAI_OFF_113C,
  D2MapAiActionOffsets,
  D2MapAiHeaderOffsets,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiCmdStrc,
  D2AiGeneralStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonLvlTxt_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillListStrc,
  D2SkillStrc,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_GEMS_TXT_COUNT_VA,
  SGPT_GEMS_TXT_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const G_MONLVL_TXT_VA = 0x6fdf0b54
const G_MONLVL_COUNT_VA = 0x6fdf0b58

function createFullKernelEnv() {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fdd6000, 0x20000, 0)

  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  // ItemStatCost.txt (400 rows * 0x144)
  const nIsc = 400
  const pItemStatCostTxt = m.alloc(nIsc * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, nIsc)
  m.setU8(pItemStatCostTxt + 6 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 6 * 0x144 + 0x32, 7)
  m.setU8(pItemStatCostTxt + 8 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 8 * 0x144 + 0x32, 9)
  m.setU8(pItemStatCostTxt + 10 * 0x144 + 0x04, 0x10)
  m.setU16(pItemStatCostTxt + 10 * 0x144 + 0x32, 11)

  // States.txt (200 rows * 0x3C) + state mask bitfields
  const nStates = 200
  const pStatesTxt = m.alloc(nStates * 0x3c)
  for (let i = 0; i < nStates; i++) {
    m.setU16(pStatesTxt + i * 0x3c, i)
  }
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, nStates)
  const pStateMasks = m.alloc(0x400)
  for (let off = 0xc8; off <= 0x168; off += 4) {
    m.setU32(pDataTables + off, pStateMasks + (off - 0xc8) * 8)
  }

  // Skills.txt (360 rows * 0x23C) + SkillsCode RPN buffer
  const nSkills = 360
  const pSkillsTxt = m.alloc(nSkills * 0x23c)
  for (let i = 0; i < nSkills; i++) {
    m.setU16(pSkillsTxt + i * 0x23c, i)
    m.setU8(pSkillsTxt + i * 0x23c + 0x05, 0x04)
    m.setU8(pSkillsTxt + i * 0x23c + 0x10, i === 0 || i === 5 ? PLRMODE_ATTACK1 : PLRMODE_CAST)
    m.setU32(pSkillsTxt + i * 0x23c + 0x170, 0xffffffff)
  }
  m.setU16(pSkillsTxt + 36 * 0x23c + 0x16a, 1) // wSrvDoFunc = 1 for triggered Fire Bolt cast
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, nSkills)

  const pSkillsCode = m.alloc(0x1000)
  m.setU32(pDataTables + 0x40, pSkillsCode)
  m.setU32(pDataTables + 0x44, 0x1000)
  m.setU8(pSkillsCode, 0)

  // Skill encode shift/mask (+0xC6C = 6, +0xC70 = 0x3F)
  m.setU32(pDataTables + 0xc6c, 6)
  m.setU32(pDataTables + 0xc70, 0x3f)

  // DifficultyLevels.txt (+0xBD8, stride 0x58, count +0xBDC = 3; +0x10 = MonsterSkillBonus [0, 3, 5])
  const pDiffTxt = m.alloc(3 * 0x58)
  m.setU32(pDiffTxt + 0 * 0x58 + 0x10, 0)
  m.setU32(pDiffTxt + 1 * 0x58 + 0x10, 3)
  m.setU32(pDiffTxt + 2 * 0x58 + 0x10, 5)
  m.setU32(pDataTables + 0xbd8, pDiffTxt)
  m.setU32(pDataTables + 0xbdc, 3)

  // MonStats.txt (750 rows * 0x1A8) & MonStats2.txt (750 rows * 0x134)
  const nMon = 750
  const pMonStatsTxt = m.alloc(nMon * 0x1a8)
  for (let i = 0; i < nMon; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x02, i) // wBaseId = self by default
    m.setU16(rec + 0x18, i) // wMonStatsEx = i
    m.setU16(rec + 0x1a, 0xffff) // wMonProp = -1
    m.setU16(rec + 0x2a, 0xffff) // wMonEquip = -1
    for (let s = 0; s < 8; s++) {
      m.setU16(rec + 0x170 + s * 2, 0xffff)
      m.setU8(rec + 0x180 + s, 0xff)
    }
  }
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, nMon)

  const pMonStats2Txt = m.alloc(nMon * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, nMon)

  // MonProp.txt (8 rows * 0x138) & Properties.txt (16 rows * 0x2E)
  const pMonPropTxt = m.alloc(8 * 0x138)
  for (let r = 0; r < 8; r++) {
    for (let d = 0; d < 3; d++) {
      for (let i = 0; i < 6; i++) {
        m.setU32(pMonPropTxt + r * 0x138 + d * 0x60 + i * 0x10 + 0x04, 0xffffffff)
      }
    }
  }
  m.setU32(pDataTables + 0xc30, pMonPropTxt)
  m.setU32(pDataTables + 0xc34, 8)

  // MonEquip.txt (16 rows * 0x1C)
  const pMonEquipTxt = m.alloc(16 * 0x1c)
  for (let r = 0; r < 16; r++) {
    m.setU16(pMonEquipTxt + r * 0x1c, 0xffff)
  }
  m.setU32(pDataTables + 0xbe0, pMonEquipTxt)
  m.setU32(pDataTables + 0xbe4, 16)

  // SuperUniques.txt (66 rows * 0x34)
  const pSuperUniquesTxt = m.alloc(66 * 0x34)
  m.setU32(pDataTables + 0xaa8, pSuperUniquesTxt)
  m.setU32(pDataTables + 0xab0, 66)
  m.setU32(0x6fdf1438, 66)

  // Missiles.txt (80 rows * 0x1A4) & MonLvl.txt (20 rows)
  const pMissilesTxt = m.alloc(80 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 80)

  const pMonLvlTxt = m.alloc(20 * D2MonLvlTxt_SIZE)
  for (let lvl = 0; lvl < 20; lvl++) {
    const row = pMonLvlTxt + lvl * D2MonLvlTxt_SIZE
    for (let off = 0; off < D2MonLvlTxt_SIZE; off += 4) {
      m.setU32(row + off, 100)
    }
  }
  m.setU32(G_MONLVL_TXT_VA, pMonLvlTxt)
  m.setU32(G_MONLVL_COUNT_VA, 20)

  // Items.txt (32 rows * 0x1A8) & ItemTypes bitvec
  const pItemsTxt = m.alloc(32 * 0x1a8)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 32)
  m.setU32(pDataTables + 0xbfc, 96)
  m.setU32(pDataTables + 0xc00, 3)
  const pItemTypeBitVec = m.alloc(96 * 3 * 4)
  m.setU32(pDataTables + 0xc04, pItemTypeBitVec)
  for (let t = 0; t < 96; t++) {
    const col = t >> 5
    const bit = (1 << (t & 31)) >>> 0
    m.setU32(pItemTypeBitVec + (t * 3 + col) * 4, bit)
  }

  // Inventory.txt (32 rows * 0xF0) for INVENTORY_AllocInventory / bodylocs
  const pInventoryTxt = m.alloc(32 * 0xf0)
  m.setU32(pDataTables + 0xbec, pInventoryTxt)
  m.setU32(pDataTables + 0xbf4, 32)

  const pQualityItemsTxt = m.alloc(16 * 0x20)
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pQualityItemsTxt)
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 16)
  const pGemsTxt = m.alloc(16 * 0xc0)
  m.setU32(SGPT_GEMS_TXT_PTR_VA, pGemsTxt)
  m.setU32(SGPT_GEMS_TXT_COUNT_VA, 16)

  // Experience.bin max level = 99
  const pExpBin = m.alloc(32)
  m.setU32(pExpBin, 99)
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // AnimData empty bucket table (`0x6FDF0B4C`)
  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  }
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  const pGame = m.alloc(D2GameStrc_SIZE)
  m.set(pGame, D2GameStrc.dwGameFrame, 100)
  m.setU32(pGame + 0x1d20, 1) // dwPlayers = 1
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, 2)
  m.setU32(pRoom + 0x4c, 4900)
  m.setU32(pRoom + 0x50, 4900)
  m.setU32(pRoom + 0x54, 400)
  m.setU32(pRoom + 0x58, 400)

  return {
    m,
    pDataTables,
    pGame,
    pRoom,
    pRoomEx,
    pLevel,
    pSkillsTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonPropTxt,
    pMonEquipTxt,
    pItemsTxt,
  }
}

describe('[K2] Real 1:1 D2Game.dll C2S, Town NPC AI, Monster Spawn & ItemEvent Verification', () => {
  describe('1. C2S Packet Handlers, Validators, Stat 0x148 & Dual-Wield Throw (c2s-packet-113c.ts)', () => {
    function createC2SPlayerRig() {
      const env = createFullKernelEnv()
      const { m, pGame, pRoom, pSkillsTxt, pItemsTxt } = env

      const pClient = m.alloc(0x500)
      m.setU32(pClient + D2ClientStrcOffsets.dwClientState, 4)
      m.setU32(pClient + 0x1a8, pGame)
      m.setU32(pClient + 0x1b8, 0)
      m.setU32(pClient + 0x1bc, 0)

      const pPlayer = m.alloc(D2UnitStrc_SIZE)
      const pPlayerData = m.alloc(0x180)
      const pPlayerPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
      m.set(pPlayer, D2UnitStrc.dwClassId, 4) // Barbarian (supports dual-wield throw)
      m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
      m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
      m.set(pPlayer, D2UnitStrc.pPath, pPlayerPath)
      m.setU32(pPlayer + 0x80, pGame)
      m.setU32(pPlayerData + 0x9c, pClient)
      m.setU32(pClient + D2ClientStrcOffsets.pPlayer, pPlayer)

      m.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom)

      STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
      STATLIST_SetUnitStat113c(m, pPlayer, 8, 50 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 9, 50 << 8, 0)

      const pSkillList = SKILLS_AllocSkillList113c(m, 0)
      m.set(pPlayer, D2UnitStrc.pSkills, pSkillList)
      const pAttackSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 0)
      const pThrowSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 2)
      const pLeftSwingSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 5)
      const pDoubleThrowSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 140)
      const pFireBoltSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 36)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 0, 1, 0, 0, 0)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 2, 1, 0, 0, 0)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 5, 1, 0, 0, 0)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 140, 1, 0, 0, 0)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 36, 1, 0, 0, 0)
      SKILLS_SetSkillSlotIndex113c(m, pAttackSkill, PLRMODE_ATTACK1)
      SKILLS_SetSkillSlotIndex113c(m, pThrowSkill, PLRMODE_ATTACK1)
      SKILLS_SetSkillSlotIndex113c(m, pLeftSwingSkill, PLRMODE_ATTACK1)
      SKILLS_SetSkillSlotIndex113c(m, pDoubleThrowSkill, PLRMODE_ATTACK1)
      SKILLS_SetSkillSlotIndex113c(m, pFireBoltSkill, PLRMODE_CAST)
      m.set(pSkillList, D2SkillListStrc.pLeftSkill, pAttackSkill)
      m.set(pSkillList, D2SkillListStrc.pRightSkill, pFireBoltSkill)

      // Configure target monster in room and hash table
      const pMonster = m.alloc(D2UnitStrc_SIZE)
      const pMonsterData = m.alloc(D2MonsterDataStrc_SIZE)
      const pMonsterPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pMonster, D2UnitStrc.dwUnitType, 1)
      m.set(pMonster, D2UnitStrc.dwClassId, 1)
      m.set(pMonster, D2UnitStrc.dwUnitId, 77)
      m.set(pMonster, D2UnitStrc.dwAnimMode, 1)
      m.set(pMonster, D2UnitStrc.pUnitData, pMonsterData)
      m.set(pMonster, D2UnitStrc.pPath, pMonsterPath)
      m.set(pMonsterPath, D2DynamicPathStrc.wPosX, 5010)
      m.set(pMonsterPath, D2DynamicPathStrc.wPosY, 5008)
      m.set(pMonsterPath, D2DynamicPathStrc.pRoom, pRoom)
      m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pMonster)
      m.set(pGame, D2GameStrc.pUnitHash, pMonster, (1 << 7) + (77 & 0x7f))
      m.set(pGame, D2GameStrc.pUnitHash, pPlayer, 1 & 0x7f)

      const pPacket = m.alloc(32)
      return {
        ...env,
        pClient,
        pPlayer,
        pPlayerData,
        pPlayerPath,
        pSkillList,
        pAttackSkill,
        pThrowSkill,
        pLeftSwingSkill,
        pDoubleThrowSkill,
        pFireBoltSkill,
        pMonster,
        pMonsterPath,
        pPacket,
        pSkillsTxt,
        pItemsTxt,
      }
    }

    it('enforces exact 0/1/2/3 return codes, S2C 0x15 rubberband rate-limit, and stat 0x148 increments in 0x6FCEBF50..0x6FCEE870', () => {
      const { m, pGame, pClient, pPlayer, pPlayerData, pPacket } = createC2SPlayerRig()
      const pOutX = m.alloc(4)
      const pOutY = m.alloc(4)
      const pOutType = m.alloc(4)
      const pOutId = m.alloc(4)

      // Truncated length -> returns 3 (ILLEGAL) per 0x6FCEBF50 / 0x6FCED630 / 0x6FCEB5B0
      expect(C2S_Packet01_WalkToLocation113c(m, pGame, pPlayer, pPacket, 3)).toBe(3)
      expect(C2S_Packet02_WalkToUnit113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
      expect(C2S_Packet03_RunToLocation113c(m, pGame, pPlayer, pPacket, 3)).toBe(3)
      expect(C2S_Packet04_RunToUnit113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
      expect(C2S_Packet0B_Noop1Byte113c(m, pGame, pPlayer, pPacket, 2)).toBe(3)
      expect(C2S_Packet0B_Noop1Byte113c(m, pGame, pPlayer, pPacket, 1)).toBe(0)

      // Missing PlayerData (`pUnitData == 0`) or invalid `dwUnitType >= 6` -> returns 2
      m.set(pPlayer, D2UnitStrc.pUnitData, 0)
      expect(
        C2S_UnpackAndValidateLocationPacket113c(m, pGame, pPlayer, pPacket, 5, pOutX, pOutY),
      ).toBe(2)
      m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
      m.setU32(pPacket + 1, 6) // invalid unit type >= 6
      m.setU32(pPacket + 5, 77)
      expect(
        C2S_UnpackAndValidateUnitPacket113c(m, pGame, pPlayer, pPacket, 9, pOutType, pOutId),
      ).toBe(2)

      // Dead player (mode 0) -> skill execution returns 2, walk handler drops and returns 0
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_DEATH)
      m.setU8(pPacket, 0x01)
      m.setU16(pPacket + 1, 5005)
      m.setU16(pPacket + 3, 5005)
      expect(C2S_Packet01_WalkToLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)

      // Out-of-range coordinates (>50 subtiles from (5000, 5000)) -> returns 1 & queues S2C 0x15 when frame delta > 25
      m.set(pGame, D2GameStrc.dwGameFrame, 100)
      m.setU32(pPlayerData + 0x168, 0)
      m.setU16(pPacket + 1, 5200)
      m.setU16(pPacket + 3, 5000)
      expect(C2S_CheckCoordDeltaExceeded113c(m, pPlayer, 5200, 5000, 50)).toBe(1)
      expect(C2S_Packet03_RunToLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(1)
      expect(m.u32(pClient + 0x1b8)).toBeGreaterThan(0) // S2C 0x15 queued into client outgoing buffer

      // Primary skill packets increment STAT_148 (`0x148`) by +1 on each valid skill packet
      m.setU16(pPacket + 1, 5008)
      m.setU16(pPacket + 3, 5008)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x148, 0)).toBe(0)
      expect(C2S_Packet05_LeftSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x148, 0)).toBe(1)
      expect(C2S_Packet0C_RightSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x148, 0)).toBe(2)
      STATLIST_SetUnitStat113c(m, pPlayer, 0x148, 0, 0)
    })

    it('resolves dual-wield hand alternation in 0x6FCEB1F0 and hits all 28 upgraded C2S VAs', () => {
      const {
        m,
        pGame,
        pPlayer,
        pPlayerData,
        pPlayerPath,
        pSkillList,
        pAttackSkill,
        pLeftSwingSkill,
        pFireBoltSkill,
        pMonster,
        pPacket,
        pItemsTxt,
      } = createC2SPlayerRig()

      // Equip two Hand-to-Hand claws (item index 1 -> ItemType 45 = 0x2d, durability OK) in bodyLoc 4 & 5
      m.setU8(0x6fded378, 13)
      m.setU8(0x6fded379, 1)
      INVENTORY_AllocInventory113c(m, 0, pPlayer)
      const equipClawWeapon = (guid: number, bodyLoc: number) => {
        const pItem = m.alloc(D2UnitStrc_SIZE)
        m.set(pItem, D2UnitStrc.dwUnitType, 4)
        m.set(pItem, D2UnitStrc.dwClassId, 1)
        m.set(pItem, D2UnitStrc.dwUnitId, guid)
        m.setU32(pItem + 0x80, pGame)
        ITEMS_AllocItemData113c(m, 0, pItem)
        STATLIST_CreateEx113c(m, pItem, 0, pGame)
        STATLIST_SetUnitStat113c(m, pItem, 72, 20, 0) // STAT_DURABILITY = 20
        STATLIST_SetUnitStat113c(m, pItem, 73, 20, 0) // STAT_MAXDURABILITY = 20
        ITEMS_SetBodyLocation113c(m, pItem, bodyLoc)
        const pInv = m.u32(pPlayer + 0x60)
        // Ensure grid 0 is initialized via INVENTORY_GetItemFromBodyLocMemPort113c, then write slot at pGrid0+0x0c
        INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, bodyLoc)
        const pGrid0 = m.u32(pInv + 0x14)
        if (pGrid0 !== 0) {
          const pSlotArr = m.u32(pGrid0 + 0x0c)
          if (pSlotArr !== 0) {
            m.setU32(pSlotArr + bodyLoc * 4, pItem)
          }
        }
        return pItem
      }
      m.setU16(pItemsTxt + 1 * 0x1a8 + 0x11e, 0x2d) // ItemType 45 (Hand-to-Hand / Claw)
      equipClawWeapon(201, 4)
      equipClawWeapon(202, 5)

      SKILLS_SetParam4113c(m, pAttackSkill, 0)
      const firstSwing = C2S_ResolveDualWieldThrowSkill113c(m, pPlayer, pAttackSkill)
      expect(firstSwing).toBe(pLeftSwingSkill)
      expect(SKILLS_GetParam4113c(m, pAttackSkill)).toBe(5)
      const secondSwing = C2S_ResolveDualWieldThrowSkill113c(m, pPlayer, pAttackSkill)
      expect(secondSwing).toBe(pAttackSkill)
      expect(SKILLS_GetParam4113c(m, pAttackSkill)).toBe(0)

      beginVaTrace113c()

      // Exercise all C2S movement, location-skill, unit-skill, skill-select, and pos-update VAs
      PLAYER_StartModeAtCoords113c(m, pGame, pPlayer, PLRMODE_WALK, 5006, 5006, 1)
      PLAYER_StartModeOnUnit113c(m, pGame, pPlayer, pMonster, PLRMODE_ATTACK1, 5010, 5008, 1)
      C2S_ResolveDualWieldThrowSkill113c(m, pPlayer, pFireBoltSkill)
      C2S_Packet0B_Noop1Byte113c(m, pGame, pPlayer, pPacket, 1)

      const pOutType = m.alloc(4)
      const pOutId = m.alloc(4)
      m.setU32(pPacket + 1, 1)
      m.setU32(pPacket + 5, 77)
      expect(C2S_ValidateTargetUnitDistance113c(m, 1, 77, pGame, pPlayer, 100)).toBe(0)
      expect(C2S_ValidateTargetUnitDistance113c(m, 1, 9999, pGame, pPlayer, 100)).toBe(1)
      expect(
        C2S_UnpackAndValidateUnitPacket113c(m, pGame, pPlayer, pPacket, 9, pOutType, pOutId),
      ).toBe(0)
      expect(m.u32(pOutType)).toBe(1)
      expect(m.u32(pOutId)).toBe(77)
      C2S_RunToTargetAndSetQueuedSkill113c(m, pGame, pPlayer, pMonster, 1, 77, pFireBoltSkill)

      m.setU8(pPacket, 0x01)
      m.setU16(pPacket + 1, 5008)
      m.setU16(pPacket + 3, 5008)
      expect(C2S_Packet01_WalkToLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(C2S_Packet03_RunToLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(C2S_ExecuteSkillOnLocation113c(m, pGame, pPlayer, pFireBoltSkill, 5010, 5008, 1)).toBe(0)
      expect(C2S_Packet05_LeftSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(C2S_Packet08_RepeatLeftSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(C2S_Packet0C_RightSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(C2S_Packet0F_RepeatRightSkillOnLocation113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)

      m.setU32(pPacket + 1, 1)
      m.setU32(pPacket + 5, 77)
      expect(C2S_Packet02_WalkToUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet04_RunToUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_ExecuteSkillOnUnit113c(m, pGame, pPlayer, pFireBoltSkill, pMonster, 1)).toBe(0)
      expect(C2S_Packet06_LeftSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet07_ShiftLeftSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet09_RepeatLeftSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet0D_RightSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet0E_ShiftRightSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet10_RepeatRightSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(C2S_Packet11_RepeatShiftRightSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)

      // Missing target unit on skill-on-unit returns 1
      m.setU32(pPacket + 5, 9999)
      expect(C2S_Packet06_LeftSkillOnUnit113c(m, pGame, pPlayer, pPacket, 9)).toBe(1)

      // 0x3C SelectSkill (truncated -> 3, invalid skill >= 360 -> 3, valid -> 0)
      expect(C2S_Packet3C_SelectSkill113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
      m.setU32(pPacket + 1, (0x80000000 | 500) >>> 0)
      m.setU32(pPacket + 5, 0xffffffff)
      expect(C2S_Packet3C_SelectSkill113c(m, pGame, pPlayer, pPacket, 9)).toBe(3)
      m.setU32(pPacket + 1, (0x80000000 | 36) >>> 0)
      expect(C2S_Packet3C_SelectSkill113c(m, pGame, pPlayer, pPacket, 9)).toBe(0)
      expect(m.get(pSkillList, D2SkillListStrc.pLeftSkill)).toBe(pFireBoltSkill)

      // 0x5F UpdatePlayerPos with dist >= 5 && < 15 starts PLRMODE_WALK (2) toward (wX, wY) when no path target
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000)
      m.set(pSkillList, D2SkillListStrc.pUsedSkill, 0)
      m.set(pPlayerPath, D2DynamicPathStrc.pTargetUnit, 0)
      m.setU8(pPacket, 0x5f)
      m.setU16(pPacket + 1, 5008)
      m.setU16(pPacket + 3, 5006)
      expect(C2S_Packet5F_UpdatePlayerPos113c(m, pGame, pPlayer, pPacket, 5)).toBe(0)
      expect(m.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_WALK)
      expect(m.get(pPlayerPath, D2DynamicPathStrc.wTargetX)).toBe(5008)
      expect(m.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(0)

      const hits = endVaTrace113c()
      const expectedC2SVas = [
        'D2Game:0x6FC98430',
        'D2Game:0x6FC98550',
        'D2Game:0x6FCEB1F0',
        'D2Game:0x6FCEB5B0',
        'D2Game:0x6FCEBF50',
        'D2Game:0x6FCECFE0',
        'D2Game:0x6FCED630',
        'D2Game:0x6FCEDF30',
        'D2Game:0x6FCEE000',
        'D2Game:0x6FCEE040',
        'D2Game:0x6FCEE090',
        'D2Game:0x6FCEE0D0',
        'D2Game:0x6FCEE120',
        'D2Game:0x6FCEE520',
        'D2Game:0x6FCEE5A0',
        'D2Game:0x6FCEE620',
        'D2Game:0x6FCEE790',
        'D2Game:0x6FCEE7F0',
        'D2Game:0x6FCEE870',
        'D2Game:0x6FCEE8F0',
        'D2Game:0x6FCEE950',
        'D2Game:0x6FCEE9D0',
        'D2Game:0x6FCEEA50',
        'D2Game:0x6FCEEAB0',
        'D2Game:0x6FCEEB10',
        'D2Game:0x6FCEEB70',
        'D2Game:0x6FCEF480',
        'D2Game:0x6FCF0790',
      ]
      for (const va of expectedC2SVas) {
        expect(hits.has(va), `Expected VA hit ${va}`).toBe(true)
      }
    })
  })

  describe('2. Memory-Native Town NPC AI, Rogue Town AI & D2MapAIStrc (town-npc-ai-113c.ts)', () => {
    it('contains zero JS Map state in town-npc-ai-113c.ts and executes all 17 Town NPC AI VAs on SparseMemory113c', () => {
      const src = readFileSync(
        resolve(__dirname, '../../../src/d2kern-113c/game/town-npc-ai-113c.ts'),
        'utf8',
      )
      expect(src).not.toContain('new Map')

      const { m, pGame, pRoom, pLevel, pMonStatsTxt, pMonStats2Txt } = createFullKernelEnv()
      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1) // Act 1 Rogue Encampment

      const pNpc = m.alloc(D2UnitStrc_SIZE)
      const pNpcPath = m.alloc(D2DynamicPathStrc_SIZE)
      const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
      const pAiGen = m.alloc(D2AiGeneralStrc_SIZE)
      const pAiCtrl = m.alloc(0x34)
      const pInteract = m.alloc(4)
      m.set(pNpc, D2UnitStrc.dwUnitType, 1)
      m.set(pNpc, D2UnitStrc.dwClassId, 148) // Akara
      m.set(pNpc, D2UnitStrc.dwUnitId, 50)
      m.set(pNpc, D2UnitStrc.dwAnimMode, 1)
      m.set(pNpc, D2UnitStrc.pUnitData, pMonData)
      m.set(pNpc, D2UnitStrc.pPath, pNpcPath)
      m.set(pNpc, D2UnitStrc.seedLo, 0x13572468)
      m.set(pNpc, D2UnitStrc.seedHi, 0x0000029a)
      m.setU32(pNpc + 0x80, pGame)
      m.set(pNpcPath, D2DynamicPathStrc.wPosX, 5000)
      m.set(pNpcPath, D2DynamicPathStrc.wPosY, 5000)
      m.set(pNpcPath, D2DynamicPathStrc.pRoom, pRoom)
      m.setU32(pMonData, pMonStatsTxt + 148 * 0x1a8)
      m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen)
      m.setU32(pMonData + 0x2c, pAiCtrl)
      m.setU32(pMonData + 0x30, pInteract)

      // Enable mode 8/9 bits in MonStats2Txt[148] so MapAiAction4/5 can trigger skill modes
      m.setU8(pMonStats2Txt + 148 * 0x134 + 0x08 + 1, 0x03)

      const pPlayer = m.alloc(D2UnitStrc_SIZE)
      const pPlayerPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
      m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
      m.set(pPlayer, D2UnitStrc.pPath, pPlayerPath)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5008)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom)
      m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pPlayer)
      m.set(pPlayer, D2UnitStrc.pRoomUnitNext, pNpc)

      const pTickParam = m.alloc(0x28)
      m.setU32(pTickParam + D2AiTickParamOffsets.pAiControl, pAiGen)
      m.setU32(pTickParam + D2AiTickParamOffsets.pTarget, pPlayer)
      m.setU32(pTickParam + D2AiTickParamOffsets.nTargetDistance, 8)
      m.setU32(pTickParam + D2AiTickParamOffsets.pMonStatsTxt, pMonStatsTxt + 148 * 0x1a8)
      m.setU32(pTickParam + D2AiTickParamOffsets.pMonStats2Txt, pMonStats2Txt + 148 * 0x134)

      beginVaTrace113c()

      // Circular doubly-linked D2AiCmdStrc ring allocation and rotation
      const pCmdA = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pNpc, 10, 1)
      const pCmdB = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pNpc, 4, 0)
      expect(pCmdA).toBeGreaterThan(0)
      expect(pCmdB).toBeGreaterThan(0)
      expect(m.u32(pCmdA + 0x00)).toBe(pCmdB) // pNext circular
      expect(m.u32(pCmdA + 0x04)).toBe(pCmdB) // pPrev circular
      expect(AIGENERAL_FindAiCommandByType113c(m, pNpc, 4, 1)).toBe(pCmdB)
      expect(m.u32(pAiGen + 0x20)).toBe(pCmdB)

      // Home node 10 + leash check + nearest player + step relative
      AI_InitHomeNode10_113c(m, pGame, pNpc)
      m.set(pNpcPath, D2DynamicPathStrc.wPosX, 5030)
      expect(AI_CheckReturnHomeToNode10_113c(m, pGame, pNpc, pTickParam, 15)).toBe(1)
      m.set(pNpcPath, D2DynamicPathStrc.wPosX, 5000)
      expect(AI_FindNearestPlayerTarget113c(m, pGame, pNpc)).toBe(pPlayer)
      expect(AI_StepRelativeToTargetUnit113c(m, pGame, pNpc, pPlayer, 4, 1)).toBe(1)

      // Build 3-waypoint D2MapAIStrc (actions 2, 4, 5) starting >=4 subtiles away so node 4 is ticked
      const pMapAi = m.alloc(8)
      const pPositions = m.alloc(3 * D2MapAiActionOffsets.SIZE)
      m.setU32(pMapAi + D2MapAiHeaderOffsets.nPositionCount, 3)
      m.setU32(pMapAi + D2MapAiHeaderOffsets.pPosition, pPositions)
      m.setU32(pPositions + 0 * 12 + 0, 2)
      m.setU32(pPositions + 0 * 12 + 4, 5015)
      m.setU32(pPositions + 0 * 12 + 8, 5000)
      m.setU32(pPositions + 1 * 12 + 0, 4)
      m.setU32(pPositions + 1 * 12 + 4, 5001)
      m.setU32(pPositions + 1 * 12 + 8, 5000)
      m.setU32(pPositions + 2 * 12 + 0, 5)
      m.setU32(pPositions + 2 * 12 + 4, 5001)
      m.setU32(pPositions + 2 * 12 + 8, 5000)
      m.setU32(pAiGen + D2MONSTERDATA_MAPAI_OFF_113C, pMapAi)
      m.set(pCmdB, D2AiCmdStrc.dwParam1, 0)
      m.setU32(D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90, 0)

      expect(AI_FollowDs1NpcPathMem113c(m, pGame, pNpc, pTickParam)).toBe(1)
      expect(AI_TickNodes4_5_7_113c(m, pGame, pNpc)).toBe(1)
      expect(m.u32(D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90)).toBeGreaterThan(0)
      AI_SimpleMapAiNpc113c(m, pGame, pNpc, pTickParam)
      AI_MapAiAction1_WalkToWaypoint113c(m, pGame, pNpc, 5010, 5000)
      AI_MapAiAction2_WalkAndWait20_113c(m, pGame, pNpc, 5001, 5000)
      AI_MapAiAction3_WalkToWaypoint113c(m, pGame, pNpc, 5010, 5000)
      AI_MapAiAction4_WalkAndMode8_113c(m, pGame, pNpc, 5001, 5000)
      AI_MapAiAction5_WalkAndMode9_113c(m, pGame, pNpc, 5001, 5000)

      // Warriv greet, TownNpc think, and RogueTown (both patrol and empty-path 200-frame stall)
      AI_WarrivGreetMem113c(m, pGame, pNpc, pTickParam)
      AI_TownNpcMem113c(m, pGame, pNpc, pTickParam)
      AI_RogueTownMem113c(m, pGame, pNpc, pTickParam)
      m.setU32(pAiGen + D2MONSTERDATA_MAPAI_OFF_113C, 0)
      AI_RogueTownMem113c(m, pGame, pNpc, pTickParam)

      const hits = endVaTrace113c()
      for (const va of [
        'D2Game:0x6FC35D10',
        'D2Game:0x6FC36610',
        'D2Game:0x6FC36970',
        'D2Game:0x6FC36A30',
        'D2Game:0x6FC39A00',
        'D2Game:0x6FC39AD0',
        'D2Game:0x6FC39BA0',
        'D2Game:0x6FC39BB0',
        'D2Game:0x6FC39C20',
        'D2Game:0x6FC3BBC0',
        'D2Game:0x6FC3BC60',
        'D2Game:0x6FC3DB40',
        'D2Game:0x6FC40E00',
        'D2Game:0x6FC417D0',
        'D2Game:0x6FCBCB00',
        'D2Game:0x6FD11D90',
        'D2Game:0x6FD130C0',
      ]) {
        expect(hits.has(va), `Expected Town NPC AI VA hit ${va}`).toBe(true)
      }
    })
  })

  describe('3. Monster Spawn, Stats, Equipment, Alignment, Presets & Object Hooks', () => {
    it('initializes monster stats, skills, Sand Maggot sub-variants, MonEquip, alignment state 0x69, and unit reset', () => {
      const { m, pGame, pRoom, pMonStatsTxt, pMonEquipTxt } = createFullKernelEnv()
      m.setU8(pGame + 0x6d, 1) // Nightmare (+3 monster skill bonus)
      m.setU32(pGame + 0x70, 1) // Expansion

      // Configure Sand Maggot Young (classId = 0x138 = 312) with skill 36 (base lvl 2, slot 0) and MonEquip row 0
      const cid = 0x138
      const rec = pMonStatsTxt + cid * 0x1a8
      m.setU8(rec + 0x0f, 0x01) // bInventory
      m.setU16(rec + 0x1e, 6) // wAi = 6 (Fallen)
      m.setU16(rec + 0x2a, 0) // wMonEquip = 0
      m.setU16(rec + 0xaa + 1 * 2, 12) // NM mlvl = 12
      m.setU16(rec + 0x170, 36) // Skill1 = 36
      m.setU8(rec + 0x180, 0) // Skill1 slot = 0
      m.setU8(rec + 0x198, 2) // Skill1 base level = 2 -> 2 + 3 = 5 in NM!
      m.setU32(rec + 0x1a0, 2) // regenFactor = 2

      // MonEquip row 0: wMonster = 0x138, wLevel = 1, bOnInit = 1, loc[0] = 4, code = 'hax '
      m.setU16(pMonEquipTxt + 0x00, cid)
      m.setU16(pMonEquipTxt + 0x02, 1)
      m.setU8(pMonEquipTxt + 0x04, 1)
      m.setU32(pMonEquipTxt + 0x08, 0x20786168) // 'hax '
      m.setU8(pMonEquipTxt + 0x14, 4)
      m.setU8(pMonEquipTxt + 0x17, 2)

      // Allocate MONREG for level 2 at pGame + 0xf0 + 2 * 4
      const pMonReg = m.alloc(0x310)
      m.setU32(pMonReg + 0x2cc, 5) // active evil monster count = 5
      m.setU32(pGame + 0xf0 + 2 * 4, pMonReg)

      const pMon = m.alloc(D2UnitStrc_SIZE)
      const pPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pMon, D2UnitStrc.dwUnitType, 1)
      m.set(pMon, D2UnitStrc.dwClassId, cid)
      m.set(pMon, D2UnitStrc.dwUnitId, 88)
      m.set(pMon, D2UnitStrc.pPath, pPath)
      m.set(pMon, D2UnitStrc.seedLo, 0xabcdef01)
      m.set(pMon, D2UnitStrc.seedHi, 0x0000029a)
      m.setU32(pMon + 0x80, pGame)
      m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)

      beginVaTrace113c()

      expect(MONSTER_InitMonsterUnit113c(m, pMon, pRoom, pGame, 1)).toBe(1)
      const pMonData = m.u32(pMon + 0x14)
      expect(pMonData).toBeGreaterThan(0)
      // Verify pMonData + 0x1c (nMonUMod[10]) is clean 0s (not clobbered by pAiCtrl!)
      expect(m.u32(pMonData + 0x1c)).toBe(0)
      // Verify Sand Maggot 0x138 sub-variant rolled identically into +0x0e and +0x0f (0..3)
      expect(m.u8(pMonData + 0x0e)).toBeLessThan(4)
      expect(m.u8(pMonData + 0x0f)).toBe(m.u8(pMonData + 0x0e))
      // Verify skill 36 granted at level 2 + 3 (NM bonus) = 5
      const pGrantedSkill = SKILLS_GetSkillById113c(m, pMon, 36, 0xffffffff)
      expect(pGrantedSkill).toBeGreaterThan(0)
      expect(m.u32(pGrantedSkill + 0x28)).toBe(5)
      // Verify AI think function initialized from MONSTER_AI_TABLE[6] = 0x6FCA3130
      const pAiGen = m.u32(pMonData + 0x28)
      expect(m.u32(pAiGen + 0x04)).toBe(0x6fca3130)
      expect(AI_InitMonsterAiThinkFn113c(m, pMon, pGame, pAiGen, 0)).toBe(1)
      MONSTER_AddSkillToUnit113c(m, 4, 37, pMon, 1)
      MONSTER_EquipMonEquipItems113c(m, pMon, pGame, 0, 12, 1)

      // Alignment transitions on STATE_ALIGNMENT (0x69) + UNIT_GetAlignment113c + MONREG/room counts
      SUNIT_SetMonsterAlignmentState113c(m, pMon, 0, 1)
      const pAlignList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pMon, 0x69)
      expect(pAlignList).toBeGreaterThan(0)
      expect(STATLIST_GetStatValue113c(m, pAlignList, 0xac, 0)).toBe(0)
      expect(UNIT_GetAlignment113c(m, pMon)).toBe(0)

      // Convert evil (0) -> good/revived (2): MONREG count decrements 5 -> 4, room player count increments 0 -> 1
      SUNIT_SetMonsterAlignmentState113c(m, pMon, 2, 1)
      expect(STATLIST_GetStatValue113c(m, pAlignList, 0xac, 0)).toBe(2)
      expect(UNIT_GetAlignment113c(m, pMon)).toBe(2)
      expect(m.u32(pMonReg + 0x2cc)).toBe(4)
      expect(m.u32(pRoom + 0x28)).toBe(1)

      // Convert good (2) -> evil (0): MONREG count increments 4 -> 5, room player count decrements 1 -> 0
      SUNIT_SetMonsterAlignmentState113c(m, pMon, 0, 1)
      expect(UNIT_GetAlignment113c(m, pMon)).toBe(0)
      expect(m.u32(pMonReg + 0x2cc)).toBe(5)
      expect(m.u32(pRoom + 0x28)).toBe(0)

      // Verify SUNIT_DeactivateUnitStatesAndEvents113c (0x6FD00860) on monster & item
      m.setU32(pMon + 0xc4, 0x00008913)
      m.setU32(pMon + 0xc8, 0x00211800)
      m.setU8(pMonData + 0x5c, 0x03)
      SUNIT_DeactivateUnitStatesAndEvents113c(m, pMon, pGame)
      expect(m.u32(pMon + 0xc4) & 0x0911).toBe(0)
      expect(m.u8(pMonData + 0x5c) & 0x01).toBe(0)

      const pItem = m.alloc(D2UnitStrc_SIZE)
      m.set(pItem, D2UnitStrc.dwUnitType, 4)
      ITEMS_AllocItemData113c(m, 0, pItem)
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x2020, 1)
      m.setU32(pItem + 0xc4, 0x1002)
      SUNIT_DeactivateUnitStatesAndEvents113c(m, pItem, pGame)
      expect(m.u32(pItem + 0xc4) & 0x1000).toBe(0)

      // Special class events (0x6FD0E260) & post-spawn quest init (0x6FD0E7B0)
      const pSpawnArgs = m.alloc(0x28)
      m.setU32(pSpawnArgs, pGame)
      m.setU32(pSpawnArgs + 0x0c, 0x5b) // Scarab -> MonUMod 0x14
      MONSTER_InitSpecialClassEvents113c(m, pGame, pMon, pRoom, pSpawnArgs)
      expect(m.u8(pMonData + 0x1c)).toBe(0x14)

      // Attach Blood Raven quest 0x02 via 0x6FD0E7B0
      const pQuestCtrl = m.alloc(8)
      const pQuest2 = m.alloc(0x100)
      m.setU32(pQuest2, 0x02)
      m.setU32(pQuestCtrl, pQuest2)
      m.setU32(pGame + 0x10f4, pQuestCtrl)
      m.setU32(pSpawnArgs + 0x0c, 0x10b) // Blood Raven
      MONSTER_PostSpawnQuestAndSpecialInit113c(m, pSpawnArgs, pMon)
      expect(m.u32(pMon + 0x74)).toBeGreaterThan(0)
      expect(STATES_CheckState113c(m, pMon, 0x76)).not.toBe(0)

      // Preset monster spawn (0x6FC67CF0) & object spawn gate hook (0x6FC4EAD0)
      ROOM_SpawnMonsterPreset113c(m, pRoom, -1, pGame, 5005, 5005, 1, () => 0, () => 0)
      const pObjCtrl = m.alloc(16)
      m.setU32(pObjCtrl + 0x00, 3) // rolls 59 % 100 -> 59; set visitedRooms > 3/4 totalRooms so threshold = 22, or seedLo = 7 (roll100 < 22)
      m.setU32(pObjCtrl + 0x00, 7)
      m.setU32(pGame + 0x1d10, pObjCtrl)
      const pObjInfo = m.alloc(0x18)
      m.setU32(pObjInfo + 0x00, 10)
      m.setU32(pObjInfo + 0x04, 18) // visitedRooms = 18
      m.setU32(pObjInfo + 0x08, 20) // totalRooms = 20 (>= count0C * 10)
      m.setU32(pObjInfo + 0x0c, 1) // spawnedCount = 1 -> rooms08 >= 10 -> checks roll
      OBJECTS_CheckLevelObjectHook113c(m, pObjInfo, pRoom, pGame, 0x20)
      m.setU32(pObjInfo + 0x0c, 3) // count0C * 10 = 30 > rooms08 (20) -> blocked (0)
      expect(OBJECTS_CheckLevelObjectHook113c(m, pObjInfo, pRoom, pGame, 0x20)).toBe(0)

      const hits = endVaTrace113c()
      for (const va of [
        'D2Game:0x6FCB2ED0',
        'D2Game:0x6FCBD230',
        'D2Game:0x6FCBF9A0',
        'D2Game:0x6FCCFDB0',
        'D2Game:0x6FD00460',
        'D2Game:0x6FD00860',
        'D2Game:0x6FD0E260',
        'D2Game:0x6FD0E7B0',
        'D2Game:0x6FC67CF0',
        'D2Game:0x6FC4EAD0',
      ]) {
        expect(hits.has(va), `Expected Spawn/Preset/Object VA hit ${va}`).toBe(true)
      }
    })
  })

  describe('4. Item-Event Registration & Dispatch (0x6FC57190, 0x6FC57030, ITEMEVENT_*) + Boot/Skill Helpers', () => {
    it('registers D2UnitEventStrc nodes via 0x6FC57190 and dispatches ITEMEVENT_ManaAfterKill / AttackerTakesDamage / ChanceToCast', () => {
      const { m, pDataTables, pGame, pRoom, pMonStatsTxt } = createFullKernelEnv()

      const pPlayer = m.alloc(D2UnitStrc_SIZE)
      const pPlayerPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
      m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
      m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL)
      m.set(pPlayer, D2UnitStrc.pPath, pPlayerPath)
      m.set(pPlayer, D2UnitStrc.seedLo, 1)
      m.set(pPlayer, D2UnitStrc.seedHi, 1)
      m.setU32(pPlayer + 0x80, pGame)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000)
      m.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom)
      STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
      STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0) // MaxMana = 100
      STATLIST_SetUnitStat113c(m, pPlayer, 8, 20 << 8, 0) // Mana = 20

      // Grant 20% Damage-To-Mana (`0x72`), Thorns (`0x4e` = +12), and 100% CtC Fire Bolt (`0xc6`, skill 36 slvl 3)
      const ctcLayer = (36 << 6) | 3
      STATLIST_SetUnitStat113c(m, pPlayer, 0x72, 20, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 0x4e, 12, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 0xc6, 100, ctcLayer)

      // Attackable monster (`dwFlags & 0x04`) with 50 HP
      const pVictim = m.alloc(D2UnitStrc_SIZE)
      const pVictimData = m.alloc(D2MonsterDataStrc_SIZE)
      const pVictimPath = m.alloc(D2DynamicPathStrc_SIZE)
      m.set(pVictim, D2UnitStrc.dwUnitType, 1)
      m.set(pVictim, D2UnitStrc.dwClassId, 2)
      m.set(pVictim, D2UnitStrc.dwUnitId, 90)
      m.set(pVictim, D2UnitStrc.dwAnimMode, 1)
      m.set(pVictim, D2UnitStrc.pUnitData, pVictimData)
      m.set(pVictim, D2UnitStrc.pPath, pVictimPath)
      m.setU32(pVictim + 0x80, pGame)
      m.setU32(pVictim + 0xc4, 0x04)
      m.set(pVictimPath, D2DynamicPathStrc.wPosX, 5002)
      m.set(pVictimPath, D2DynamicPathStrc.wPosY, 5002)
      m.set(pVictimPath, D2DynamicPathStrc.pRoom, pRoom)
      m.setU32(pVictimData, pMonStatsTxt + 2 * 0x1a8)
      m.setU8(pMonStatsTxt + 2 * 0x1a8 + 0x0d, 0x20)
      STATLIST_CreateEx113c(m, pVictim, 0, pGame)
      STATLIST_SetUnitStat113c(m, pVictim, 7, 50 << 8, 0)
      STATLIST_SetUnitStat113c(m, pVictim, 6, 50 << 8, 0)

      beginVaTrace113c()

      // Register item-event nodes via 9-arg 0x6FC57190 (`pUnit, pGame, eventType, (statId << 16) | layer, dwArg2, pfn, nFuncType, dwGuid`)
      const pNodeMak = UNITEVENT_RegisterTimerOrItemEventNode113c(
        m,
        pPlayer,
        pGame,
        9,
        (0x72 << 16) | 0,
        0,
        0x6fcccda0,
        4,
        300,
      )
      const pNodeThorns = UNITEVENT_RegisterTimerOrItemEventNode113c(
        m,
        pPlayer,
        pGame,
        2,
        (0x4e << 16) | 0,
        0,
        0x6fccd910,
        4,
        300,
      )
      const pNodeCtc = UNITEVENT_RegisterTimerOrItemEventNode113c(
        m,
        pPlayer,
        pGame,
        1,
        (0xc6 << 16) | ctcLayer,
        0,
        0x6fccdce0,
        4,
        300,
      )
      expect(pNodeMak).toBeGreaterThan(0)
      expect(pNodeThorns).toBeGreaterThan(0)
      expect(pNodeCtc).toBeGreaterThan(0)
      expect(m.u32(pPlayer + 0x90)).toBe(pNodeCtc)

      const pDmg = m.alloc(0x70)
      m.setU16(pDmg + 0x04, 0x0005) // hit landed (`0x01`) + proc-eligible (`0x04`)
      m.setU32(pDmg + 0x4c, 50 << 8) // 50 total damage taken -> 20% = +10 mana (20 -> 30)

      // Dispatch event 9 via 0x6FC57030 -> invokes 0x6FCCCDA0 (20 -> 30 mana)
      expect(SUNIT_DispatchItemEventCallbacks113c(m, pPlayer, pGame, 9, pVictim, pDmg)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(30 << 8)

      // Dispatch event 2 (Damaged in melee) via 0x6FC57030 -> invokes 0x6FCCD910 (AttackerTakesDamage: 50 -> 38 HP on attacker)
      expect(SUNIT_DispatchItemEventCallbacks113c(m, pPlayer, pGame, 2, pVictim, pDmg)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pVictim, 6, 0)).toBe(38 << 8)

      // Dispatch event 1 (Hit) / direct call to 0x6FCCDCE0 (ChanceToCastSkill)
      expect(
        ITEMEVENT_ChanceToCastSkill113c(m, pPlayer, pVictim, pDmg, (0xc6 << 16) | ctcLayer),
      ).toBe(1)
      // Also verify direct calls to 0x6FCCCDA0 and 0x6FCCD910 guard branches
      expect(ITEMEVENT_ManaAfterKill113c(m, pPlayer, 0, 0, 0x72 << 16)).toBe(0)
      expect(ITEMEVENT_AttackerTakesDamage113c(m, pGame, pPlayer, 0, pDmg, 0x4e << 16)).toBe(0)

      // Charged item consumption in 0x6FCBF850 + 0x6FCC1630 + 0x6FCC2C40 + boot-init-gap-a 3 VAs
      const pSkillList = SKILLS_AllocSkillList113c(m, 0)
      m.set(pPlayer, D2UnitStrc.pSkills, pSkillList)
      const pChargedSkill = SKILLS_AddSkillToUnit113c(m, pPlayer, 36)
      SKILLS_SetSkillLevelOnUnit113c(m, pPlayer, 36, 2, 0, 0, 0)
      m.set(pSkillList, D2SkillListStrc.pUsedSkill, pChargedSkill)
      m.set(pChargedSkill, D2SkillStrc.nOwnerItemGuid, 555)
      m.set(pChargedSkill, D2SkillStrc.nCharges, 3)

      const pWand = m.alloc(D2UnitStrc_SIZE)
      m.set(pWand, D2UnitStrc.dwUnitType, 4)
      m.set(pWand, D2UnitStrc.dwUnitId, 555)
      ITEMS_AllocItemData113c(m, 0, pWand)
      STATLIST_CreateEx113c(m, pWand, 0, pGame)
      const pChargeList = STATLIST_AllocList113c(m, 0x40, 4, 555, 0, 0)
      STATLIST_SetState113c(m, pChargeList, 0)
      STATLIST_MergeStatLists113c(m, pWand, pChargeList, 0)
      m.setU32(pDataTables + 0xc6c, 6)
      m.setU32(pDataTables + 0xc70, 0x3f)
      const chargeLayer = (36 << 6) | 2
      STATLIST_SetStat113c(m, pChargeList, 0xcc, (5 << 8) | 3, chargeLayer) // 3 / 5 charges
      m.setU32(pGame + 0x1720 + ((555 & 0x7f) << 2), pWand)

      expect(SKILLS_ConsumeSkillManaOrCharge113c(m, pPlayer, 36, pGame, 2)).toBe(1)
      expect(STATLIST_GetStatValue113c(m, pChargeList, 0xcc, chargeLayer) & 0xff).toBe(2)

      expect(SKILLS_StartPlayerSkillAnimOrCast113c(m, pGame, pPlayer, 36, 1)).toBe(1)
      m.set(pPlayerPath, D2DynamicPathStrc.pTargetUnit, pVictim)
      SrvDoFunc_001_Attack113c(m, pGame, pPlayer, 0, 1)

      // 0x6FC468E0, 0x6FC4D9B0, 0x6FC8B200
      m.setU8(pVictimData + 0x1c, 0x09)
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pVictim, 0)
      m.setU32(D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C, 1)
      expect(GAME_StepClientJoinStatesAndTimeouts113c(m, pGame, 5000)).toBe(1)
      const pClient = m.alloc(0x500)
      m.setU32(pClient + 0x1bc, m.alloc(0x410))
      const pObj = m.alloc(D2UnitStrc_SIZE)
      const pObjData = m.alloc(0x40)
      const pObjTxt = m.alloc(0x200)
      m.setU32(pObjData, pObjTxt)
      m.set(pObj, D2UnitStrc.dwUnitType, 2)
      m.set(pObj, D2UnitStrc.dwUnitId, 12)
      m.set(pObj, D2UnitStrc.dwAnimMode, 1)
      m.setU32(pObj + 0x14, pObjData)
      m.setU32(pObj + 0xc4, 1)
      expect(OBJECT_SyncStateAndEventsToClient113c(m, pObj, pClient)).toBe(1)

      const hits = endVaTrace113c()
      for (const va of [
        'D2Game:0x6FC57190',
        'D2Game:0x6FC57030',
        'D2Game:0x6FCCCDA0',
        'D2Game:0x6FCCD910',
        'D2Game:0x6FCCDCE0',
        'D2Game:0x6FCBF850',
        'D2Game:0x6FCC1630',
        'D2Game:0x6FCC2C40',
        'D2Game:0x6FC468E0',
        'D2Game:0x6FC4D9B0',
        'D2Game:0x6FC8B200',
      ]) {
        expect(hits.has(va), `Expected ItemEvent/Boot/Skill VA hit ${va}`).toBe(true)
      }
    })
  })
})
