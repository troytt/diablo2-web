import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_CheckReturnHomeToNode10_113c,
  AI_FindNearestPlayerTarget113c,
  AI_FollowDs1NpcPathMem113c,
  AI_InitHomeNode10_113c,
  AI_MapAiAction1_WalkToWaypoint113c,
  AI_MapAiAction2_WalkAndWait20_113c,
  AI_MapAiAction3_WalkToWaypoint113c,
  AI_MapAiAction4_WalkAndMode8_113c,
  AI_MapAiAction5_WalkAndMode9_113c,
  AI_SimpleMapAiNpc113c,
  AI_StepRelativeToTargetUnit113c,
  AI_TickNodes4_5_7_113c,
  AI_TownNpcMem113c,
  AI_WarrivGreetMem113c,
  AIGENERAL_FindAiCommandByType113c,
  AIGENERAL_GetOrAllocAiCommandByType113c,
  C2S_CheckCoordDeltaExceeded113c,
  C2S_Dispatch113c,
  C2S_DispatchFromMem113c,
  C2S_DispatchPacketMem113c,
  C2S_DispatchRawMem113c,
  C2S_HANDLER_BY_VA_113C,
  C2S_PACKET_TABLE_6FD1A078_113C,
  C2S_Packet0B_Noop1Byte113c,
  C2S_Packet0C_RightSkillOnLocation113c,
  C2S_Packet0D_RightSkillOnUnit113c,
  C2S_Packet0E_ShiftRightSkillOnUnit113c,
  C2S_Packet0F_RepeatRightSkillOnLocation113c,
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
  C2S_Packet10_RepeatRightSkillOnUnit113c,
  C2S_Packet11_RepeatShiftRightSkillOnUnit113c,
  C2S_Packet3C_SelectSkill113c,
  C2S_Packet5F_UpdatePlayerPos113c,
  C2S_ResolveDualWieldThrowSkill113c,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiCmdStrc,
  D2AiGeneralStrc_SIZE,
  D2ClientStrcOffsets,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MapAiActionOffsets,
  D2MapAiHeaderOffsets,
  D2MONSTERDATA_MAPAI_OFF_113C,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillListStrc,
  D2SkillListStrc_SIZE,
  D2SkillStrc,
  D2SkillStrc_SIZE,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
  DRLGPRESET_MovePointerAndClear113c,
  Heap113c,
  PLAYER_StartModeOnUnit113c,
  PLRMODE_ATTACK1,
  PLRMODE_CAST,
  PLRMODE_DEAD,
  PLRMODE_DEATH,
  PLRMODE_NEUTRAL,
  PLRMODE_RUN,
  PLRMODE_WALK,
  SGPT_DATA_TABLES_PTR_VA_6FDE9E1C,
  SparseMemory113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetOctileDistanceToCoordinates113c,
  dispatchC2SHandlerByVa113c,
  type FieldLayout113c,
  type Memory113c,
} from '../../../src/d2kern-113c/index.ts';
import { C2S_PACKET_SIZES } from '../../../src/netproto/index.ts';
import { D2COMMON_GDWBITMASKS_IAT_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts';
import { PLAYER_StartCastSkillOnUnitK3_113c } from '../../../src/d2kern-113c/game/k3-p52-sorc-handlers-113c.ts';
import {
  installK4QuestReplay113c,
  tryApplyQuestAndNpcC2SPacketK4_113c,
} from '../../../src/d2kern-113c/game/k4-quest-replay-113c.ts';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts';
import {
  buildSliceC2SCallees113c,
  getOrHydrateSliceWorld113c,
} from '../../../src/d2kern-113c/game/replay-kernel-113c.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts';
import {
  bootFromSnapshot113c,
  loadSnapshotFile113c,
  snapshotPath113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts';

describe('Lane H (K1R14-LaneH): OUTJUNG_STACK_BASE De-Aliasing & 1:1 K0 Stand-In Ports', () => {
  describe('Task 1: OUTJUNG_STACK_BASE virtual scratch address de-aliasing', () => {
    it('assigns disjoint scratch stack bases across out-jung.ts, skills.ts, room-tile.ts, and preset.ts', () => {
      const rootDir = resolve(__dirname, '../../..');
      const outJungSrc = readFileSync(
        resolve(rootDir, 'src/d2kern-113c/common/drlg/out-jung.ts'),
        'utf8',
      );
      const skillsSrc = readFileSync(
        resolve(rootDir, 'src/d2kern-113c/common/skills.ts'),
        'utf8',
      );
      const roomTileSrc = readFileSync(
        resolve(rootDir, 'src/d2kern-113c/common/drlg/room-tile.ts'),
        'utf8',
      );
      const presetSrc = readFileSync(
        resolve(rootDir, 'src/d2kern-113c/common/drlg/preset.ts'),
        'utf8',
      );

      const parseHexConst = (src: string, name: string): number => {
        const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*(0x[0-9a-fA-F]+)`));
        expect(m, `Expected ${name} constant definition`).not.toBeNull();
        return Number.parseInt(m![1]!, 16);
      };

      const outJungBase = parseHexConst(outJungSrc, 'OUTJUNG_STACK_BASE');
      const outJungSize = parseHexConst(outJungSrc, 'OUTJUNG_STACK_SIZE');
      const skillsBase = parseHexConst(skillsSrc, 'SKILLS_STACK_BASE');
      const roomTileBase = parseHexConst(roomTileSrc, 'ROOMTILE_STACK_BASE');
      const presetBase = parseHexConst(presetSrc, 'PRESET_STACK_BASE');

      expect(outJungBase).toBe(0x7ff68000);
      expect(outJungSize).toBe(0x100);
      expect(outJungBase).not.toBe(skillsBase);
      expect(outJungBase + outJungSize).toBeLessThanOrEqual(skillsBase);
      expect(outJungBase + outJungSize).toBeLessThanOrEqual(roomTileBase);
      expect(outJungBase + outJungSize).toBeLessThanOrEqual(presetBase);
    });
  });

  describe('Task 2: Town NPC AI & DS1 MapAI Path Following (town-npc-ai-113c.ts)', () => {
    function setupNpcFixture(
      mem: SparseMemory113c,
      npcX: number,
      npcY: number,
      levelId = 1,
    ) {
      const pGame = mem.alloc(D2GameStrc_SIZE);
      const pRoom = mem.alloc(D2ActiveRoomStrc_SIZE);
      const pRoomEx = mem.alloc(D2RoomExStrc_SIZE);
      const pLevel = mem.alloc(D2DrlgLevelStrc_SIZE);
      const pNpc = mem.alloc(D2UnitStrc_SIZE);
      const pNpcPath = mem.alloc(D2DynamicPathStrc_SIZE);
      const pMonsterData = mem.alloc(D2MonsterDataStrc_SIZE);
      const pAiGeneral = mem.alloc(D2AiGeneralStrc_SIZE);
      const pDataTables = mem.alloc(0x1000);
      initD2GameGlobalsInMem113c(mem, pDataTables);
      mem.setU32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C, pDataTables);

      const nMon = 200;
      const pMonStatsTxt = mem.alloc(nMon * 0x1a8);
      const pMonStats2Txt = mem.alloc(nMon * 0x134);
      for (let i = 0; i < nMon; i++) {
        mem.setU16(pMonStatsTxt + i * 0x1a8 + 0x00, i);
        mem.setU16(pMonStatsTxt + i * 0x1a8 + 0x18, i);
        mem.setU8(pMonStats2Txt + i * 0x134 + 0x09, 0x03); // enable mode 8 & 9 bits
      }
      mem.setU32(pDataTables + 0xa78, pMonStatsTxt);
      mem.setU32(pDataTables + 0xa80, nMon);
      mem.setU32(pDataTables + 0xa90, pMonStats2Txt);
      mem.setU32(pDataTables + 0xa98, nMon);

      mem.set(pGame, D2GameStrc.dwGameFrame, 100);
      EVENT_InitTimerQueue113c(mem, pGame);
      mem.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx);
      mem.set(pRoomEx, D2RoomExStrc.pLevel, pLevel);
      mem.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId);

      mem.set(pNpc, D2UnitStrc.dwUnitType, UNIT_MONSTER);
      mem.set(pNpc, D2UnitStrc.dwClassId, 147); // Gheed / Town NPC
      mem.set(pNpc, D2UnitStrc.dwUnitId, 10);
      mem.set(pNpc, D2UnitStrc.dwAnimMode, 1);
      mem.set(pNpc, D2UnitStrc.pUnitData, pMonsterData);
      mem.set(pNpc, D2UnitStrc.pPath, pNpcPath);
      mem.set(pNpc, D2UnitStrc.seedLo, 0x12345678);
      mem.set(pNpc, D2UnitStrc.seedHi, 0x0000029a);
      mem.setU32(pNpc + 0x80, pGame);

      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, npcX);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, npcY);
      mem.set(pNpcPath, D2DynamicPathStrc.pRoom, pRoom);

      mem.setU32(pMonsterData, pMonStatsTxt + 147 * 0x1a8);
      mem.set(pMonsterData, D2MonsterDataStrc.pAiGeneral, pAiGeneral);

      return { pGame, pRoom, pRoomEx, pLevel, pNpc, pNpcPath, pMonsterData, pAiGeneral };
    }

    it('allocates and queries D2AiCmdStrc nodes by type and initializes home node 10', () => {
      const mem = new SparseMemory113c();
      const { pGame, pNpc, pNpcPath } = setupNpcFixture(mem, 5100, 5200, 1);

      expect(AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10)).toBe(0);
      expect(AI_InitHomeNode10_113c(mem, pGame, pNpc)).toBe(1);
      const pCmd10 = AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10);
      expect(pCmd10).toBeGreaterThan(0);
      expect(AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pNpc, 10)).toBe(pCmd10);

      expect(mem.get(pCmd10, D2AiCmdStrc.dwCmdType) | 0).toBe(10);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam1) | 0).toBe(5100);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam2) | 0).toBe(5200);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam3) | 0).toBe(0);

      // Move NPC within leash (<= 15 octile distance): should not walk back
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5106);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, 5204);
      expect(UNITS_GetOctileDistanceToCoordinates113c(mem, pNpc, 5100, 5200)).toBe(8);
      expect(AI_CheckReturnHomeToNode10_113c(mem, pGame, pNpc, 0, 15)).toBe(0);

      // Move NPC outside leash (> 15 octile distance): writes home coords to node 4 and stalls 10 frames
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5130);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, 5220);
      expect(AI_CheckReturnHomeToNode10_113c(mem, pGame, pNpc, 0, 15)).toBe(1);
      const pLeashNode4 = AIGENERAL_FindAiCommandByType113c(mem, pNpc, 4);
      expect(pLeashNode4).toBeGreaterThan(0);
      expect(mem.get(pLeashNode4, D2AiCmdStrc.dwParam1) | 0).toBe(5100);
      expect(mem.get(pLeashNode4, D2AiCmdStrc.dwParam2) | 0).toBe(5200);
    });

    it('steps DS1 D2MapAIStrc waypoint paths through actions 1..5 and wraps index cleanly', () => {
      const mem = new SparseMemory113c();
      const { pGame, pNpc, pNpcPath, pAiGeneral } = setupNpcFixture(mem, 5000, 5000, 1);

      // Build a source D2MapAIStrc table (nPositionCount = 2) and move it via DRLGPRESET_MovePointerAndClear113c (0x6FD67780)
      const pSrcMapAi = mem.alloc(8);
      const pSrcActions = mem.alloc(2 * D2MapAiActionOffsets.SIZE);
      mem.setU32(pSrcMapAi + D2MapAiHeaderOffsets.nPositionCount, 2);
      mem.setU32(pSrcMapAi + D2MapAiHeaderOffsets.pPosition, pSrcActions);

      // Entry 0: (5010, 5000), action = 1 (walk to waypoint)
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nAction, 1);
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nX, 5010);
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nY, 5000);

      // Entry 1: (5012, 5002), action = 4 (walk and trigger mode 8)
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nAction, 4);
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nX, 5012);
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nY, 5002);

      const ppPresetSaveChain = mem.alloc(4);
      mem.setU32(ppPresetSaveChain, pSrcMapAi);
      const ppAiControl = (pAiGeneral + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0;
      DRLGPRESET_MovePointerAndClear113c(mem, ppPresetSaveChain, ppAiControl);
      const pMapAi = mem.u32(ppAiControl);
      expect(pMapAi).toBe(pSrcMapAi);
      expect(mem.u32(ppPresetSaveChain)).toBe(0);

      // Tick 1: NPC at (5000, 5000) rolls <66% (seedLo = 3 -> 59 < 66) and picks a waypoint from D2MapAIStrc, allocating node 4 with [wp.x, wp.y, count, delay]
      mem.set(pNpc, D2UnitStrc.seedLo, 3);
      mem.set(pNpc, D2UnitStrc.seedHi, 0);
      expect(AI_FollowDs1NpcPathMem113c(mem, pGame, pNpc, 0)).toBe(1);
      const pNode4 = AIGENERAL_FindAiCommandByType113c(mem, pNpc, 4);
      expect(pNode4).toBeGreaterThan(0);
      const wpX = mem.get(pNode4, D2AiCmdStrc.dwParam1) | 0;
      expect([5010, 5012]).toContain(wpX);
      expect(mem.get(pNode4, D2AiCmdStrc.dwParam4) | 0).toBe(10);

      // Next tick through AI_SimpleMapAiNpc113c steps active node 4/5/7 continuation
      AI_SimpleMapAiNpc113c(mem, pGame, pNpc, 0);

      // Verify direct calls to actions 1..5
      expect(AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pNpc, 5000, 5000)).toBe(0);
      expect(AI_MapAiAction3_WalkToWaypoint113c(mem, pGame, pNpc, 5000, 5000)).toBe(0);
      expect(AI_MapAiAction2_WalkAndWait20_113c(mem, pGame, pNpc, 5020, 5000)).toBe(1);
      expect(AI_TickNodes4_5_7_113c(mem, pGame, pNpc)).toBe(1);
      expect(AI_MapAiAction5_WalkAndMode9_113c(mem, pGame, pNpc, 5020, 5000)).toBe(1);
      expect(AI_MapAiAction4_WalkAndMode8_113c(mem, pGame, pNpc, 5020, 5000)).toBe(1);
    });

    it('runs AI_WarrivGreetMem113c and AI_TownNpcMem113c against an in-room player unit', () => {
      const mem = new SparseMemory113c();
      const { pGame, pRoom, pNpc, pNpcPath, pMonsterData, pAiGeneral } = setupNpcFixture(mem, 5100, 5100, 1);
      mem.set(pNpc, D2UnitStrc.dwClassId, 155); // Warriv (0x9B)
      const pInteract = mem.alloc(4);
      mem.setU32(pMonsterData + 0x30, pInteract);
      const pQuestCtrl = mem.alloc(12);
      const pQuest0 = mem.alloc(0x100);
      mem.setU32(pQuestCtrl + 0x00, pQuest0);
      mem.setU32(pQuestCtrl + 0x08, 1);
      mem.setU32(pQuest0 + 0x04, pGame);
      mem.setU8(pQuest0 + 0x08, 0);
      mem.setU32(pQuest0 + 0xec, 0x6fc807d0);
      mem.setU32(pGame + 0x10f4, pQuestCtrl);

      // Add a living player in the same room at (5110, 5100)
      const pPlayer = mem.alloc(D2UnitStrc_SIZE);
      const pPlayerData = mem.alloc(0x180);
      const pClient = mem.alloc(0x500);
      const pQuestFlags = mem.alloc(0x60);
      const pPlayerPath = mem.alloc(D2DynamicPathStrc_SIZE);
      mem.set(pPlayer, D2UnitStrc.dwUnitType, UNIT_PLAYER);
      mem.set(pPlayer, D2UnitStrc.dwUnitId, 1);
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData);
      mem.set(pPlayer, D2UnitStrc.pPath, pPlayerPath);
      mem.setU32(pPlayerData + 0x10, pQuestFlags);
      mem.setU32(pPlayerData + 0x9c, pClient);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5110);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5100);
      mem.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom);

      // Link pPlayer -> pNpc in pRoom->pUnitFirst
      mem.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pPlayer);
      mem.set(pPlayer, D2UnitStrc.pRoomUnitNext, pNpc);

      expect(AI_FindNearestPlayerTarget113c(mem, pGame, pNpc)).toBe(pPlayer);

      const pTickParam = mem.alloc(0x28);
      mem.setU32(pTickParam + 0x00, pAiGeneral);
      mem.setU32(pTickParam + 0x04, pPlayer);
      mem.setU32(pTickParam + 0x0c, 10);

      // First Warriv tick initializes home node 10
      AI_WarrivGreetMem113c(mem, pGame, pNpc, pTickParam);
      expect(AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10)).toBeGreaterThan(0);

      // Second Warriv tick approaches player (dist = 10 in (2, 24) -> sets dwState = 7 & walks toward player)
      expect(AI_WarrivGreetMem113c(mem, pGame, pNpc, pTickParam)).toBe(1);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBeGreaterThan(5100);
      AI_TownNpcMem113c(mem, pGame, pNpc, pTickParam);

      // Also verify AI_StepRelativeToTargetUnit113c away from player (bMoveToward = 0)
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5108);
      expect(AI_StepRelativeToTargetUnit113c(mem, pGame, pNpc, pPlayer, 4, 0)).toBe(1);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBe(5105);
    });
  });

  describe('Task 3: C2S Packet Table Dispatch & Opcode Handlers (c2s-packet-113c.ts)', () => {
    function setupClientPlayerFixture(mem: SparseMemory113c) {
      const pGame = mem.alloc(D2GameStrc_SIZE);
      const pClient = mem.alloc(0x200);
      const pRoom = mem.alloc(D2ActiveRoomStrc_SIZE);
      const pRoomEx = mem.alloc(D2RoomExStrc_SIZE);
      const pLevel = mem.alloc(D2DrlgLevelStrc_SIZE);
      const pPlayer = mem.alloc(D2UnitStrc_SIZE);
      const pPlayerData = mem.alloc(0x180);
      const pPlayerPath = mem.alloc(D2DynamicPathStrc_SIZE);
      const pSkillList = mem.alloc(D2SkillListStrc_SIZE);
      const pLeftSkill = mem.alloc(D2SkillStrc_SIZE);
      const pRightSkill = mem.alloc(D2SkillStrc_SIZE);
      const pDataTables = mem.alloc(0x1000);
      initD2GameGlobalsInMem113c(mem, pDataTables);
      mem.setU32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C, pDataTables);
      mem.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, mem.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C));
      const pExpBin = mem.alloc(32);
      mem.setU32(pExpBin, 99);
      mem.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin);
      const pSkillsTxtArr = mem.alloc(360 * D2SkillsTxt_SIZE);
      mem.setU32(pDataTables + 0xb98, pSkillsTxtArr);
      mem.setU32(pDataTables + 0xba0, 360);
      for (let i = 0; i < 360; i++) {
        mem.setU16(pSkillsTxtArr + i * D2SkillsTxt_SIZE, i);
        mem.setU8(pSkillsTxtArr + i * D2SkillsTxt_SIZE + 0x05, 0x04);
        mem.setU8(pSkillsTxtArr + i * D2SkillsTxt_SIZE + 0x0c, 0xff);
        mem.setU8(
          pSkillsTxtArr + i * D2SkillsTxt_SIZE + 0x10,
          i === 0 || i === 5 ? PLRMODE_ATTACK1 : PLRMODE_CAST,
        );
        mem.setU32(pSkillsTxtArr + i * D2SkillsTxt_SIZE + 0x170, 0xffffffff);
      }
      const pCharStats = mem.alloc(7 * 0xc4);
      mem.setU32(0x6fde9be0, pCharStats);
      mem.setU32(0x6fde9be4, 7);
      mem.setU32(pDataTables + 0xc28, pCharStats);
      mem.setU32(pDataTables + 0xc2c, 7);
      const pAnimDataTable = mem.alloc(0x420);
      const pEmptyBucket = mem.alloc(16);
      for (let i = 0; i < 256; i++) {
        mem.setU32(pAnimDataTable + i * 4, pEmptyBucket);
      }
      mem.setU32(pAnimDataTable + 0x40c, 8);
      mem.setU32(pAnimDataTable + 0x410, 256);
      mem.setU32(0x6fdf0b4c, pAnimDataTable);
      const pLeftSkillsTxt = pSkillsTxtArr;
      const pRightSkillsTxt = pSkillsTxtArr + 36 * D2SkillsTxt_SIZE;
      const pMonster = mem.alloc(D2UnitStrc_SIZE);
      const pMonsterPath = mem.alloc(D2DynamicPathStrc_SIZE);
      const pPacket = mem.alloc(32);

      mem.set(pGame, D2GameStrc.dwGameFrame, 50);
      mem.setU32(pClient + D2ClientStrcOffsets.dwClientState, 4); // CLIENTSTATE_INGAME = 4
      mem.setU32(pClient + D2ClientStrcOffsets.pPlayer, pPlayer);
      mem.setU32(pPlayerData + 0x9c, pClient);

      mem.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx);
      mem.set(pRoomEx, D2RoomExStrc.pLevel, pLevel);
      mem.set(pLevel, D2DrlgLevelStrc.nLevelId, 2); // Blood Moor (non-town)
      mem.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pMonster);

      mem.set(pPlayer, D2UnitStrc.dwUnitType, UNIT_PLAYER);
      mem.set(pPlayer, D2UnitStrc.dwUnitId, 1);
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData);
      mem.set(pPlayer, D2UnitStrc.pPath, pPlayerPath);
      mem.set(pPlayer, D2UnitStrc.pSkills, pSkillList);
      mem.setU32(pPlayer + 0x80, pGame);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5000);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000);
      mem.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom);

      // Left skill = 0 (Attack), Right skill = 36 (Fire Bolt)
      mem.set(pLeftSkill, D2SkillStrc.pSkillsTxt, pLeftSkillsTxt);
      mem.set(pLeftSkillsTxt, D2SkillsTxt.wSkillId, 0);
      mem.set(pLeftSkill, D2SkillStrc.nSlotIndex, PLRMODE_ATTACK1);
      mem.set(pLeftSkill, D2SkillStrc.nSkillLevel, 1);
      mem.set(pLeftSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff);
      mem.set(pRightSkill, D2SkillStrc.pSkillsTxt, pRightSkillsTxt);
      mem.set(pRightSkillsTxt, D2SkillsTxt.wSkillId, 36);
      mem.set(pRightSkill, D2SkillStrc.nSlotIndex, PLRMODE_CAST);
      mem.set(pRightSkill, D2SkillStrc.nSkillLevel, 1);
      mem.set(pRightSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff);
      mem.set(pLeftSkill, D2SkillStrc.pNextSkill, pRightSkill);

      mem.set(pSkillList, D2SkillListStrc.pFirstSkill, pLeftSkill);
      mem.set(pSkillList, D2SkillListStrc.pLeftSkill, pLeftSkill);
      mem.set(pSkillList, D2SkillListStrc.pRightSkill, pRightSkill);

      // Target monster (Fallen, id = 42) at (5015, 5010)
      mem.set(pMonster, D2UnitStrc.dwUnitType, UNIT_MONSTER);
      mem.set(pMonster, D2UnitStrc.dwUnitId, 42);
      mem.set(pMonster, D2UnitStrc.pPath, pMonsterPath);
      mem.set(pMonsterPath, D2DynamicPathStrc.wPosX, 5015);
      mem.set(pMonsterPath, D2DynamicPathStrc.wPosY, 5010);
      mem.set(pMonsterPath, D2DynamicPathStrc.pRoom, pRoom);

      // Register monster in pGame->pUnitHash[UNIT_MONSTER * 128 + (42 & 0x7F)]
      const bucketIdx = ((UNIT_MONSTER << 7) + (42 & 0x7f)) | 0;
      mem.set(pGame, D2GameStrc.pUnitHash, pMonster, bucketIdx);

      return {
        pGame,
        pClient,
        pRoom,
        pPlayer,
        pPlayerPath,
        pSkillList,
        pLeftSkill,
        pRightSkill,
        pMonster,
        pPacket,
      };
    }

    function peVaToFileOffset(buf: Buffer, expectedBase: number, va: number): number {
      const e_lfanew = buf.readUInt32LE(0x3c);
      const numSec = buf.readUInt16LE(e_lfanew + 6);
      const optSize = buf.readUInt16LE(e_lfanew + 20);
      const imageBase = buf.readUInt32LE(e_lfanew + 24 + 28);
      expect(imageBase).toBe(expectedBase);
      const rva = (va - imageBase) >>> 0;
      const secTable = e_lfanew + 24 + optSize;
      for (let i = 0; i < numSec; i++) {
        const sh = secTable + i * 40;
        const vsize = buf.readUInt32LE(sh + 8);
        const vaddr = buf.readUInt32LE(sh + 12);
        const rawSize = buf.readUInt32LE(sh + 16);
        const rawPtr = buf.readUInt32LE(sh + 20);
        if (rva >= vaddr && rva < vaddr + Math.max(vsize, rawSize)) {
          return rawPtr + (rva - vaddr);
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE sections`);
    }

    function hasD2GameVaHit(hits: ReadonlySet<string>, va: number): boolean {
      return hits.has(`D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`);
    }

    function formatD2GameVa(va: number): string {
      return `D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
    }

    function attachExtendedStatList(mem: SparseMemory113c, pUnit: number): void {
      const pStatListEx = mem.alloc(D2StatListExStrc_SIZE);
      const pStateFlags = mem.alloc(0x30);
      mem.set(pStatListEx, D2StatListExStrc.dwFlags, 0x80000000); // STATLIST_FLAG_EXTENDED
      mem.set(pStatListEx, D2StatListExStrc.pStateFlags, pStateFlags);
      mem.set(pUnit, D2UnitStrc.pStatListEx, pStatListEx);
    }

    function createMapMemory113c(): Memory113c {
      const bytes = new Map<number, number>();
      let top = 0x1000;
      const u8 = (p: number): number => bytes.get(p >>> 0) ?? 0;
      const setU8 = (p: number, v: number): void => {
        bytes.set(p >>> 0, v & 0xff);
      };
      const u16 = (p: number): number => u8(p) | (u8((p + 1) >>> 0) << 8);
      const u32 = (p: number): number => (u16(p) | (u16((p + 2) >>> 0) << 16)) >>> 0;
      const setU16 = (p: number, v: number): void => {
        setU8(p, v & 0xff);
        setU8((p + 1) >>> 0, (v >>> 8) & 0xff);
      };
      const setU32 = (p: number, v: number): void => {
        setU16(p, v & 0xffff);
        setU16((p + 2) >>> 0, (v >>> 16) & 0xffff);
      };
      const fill = (p: number, len: number, v: number): void => {
        for (let i = 0; i < len; i++) {
          setU8((p + i) >>> 0, v);
        }
      };
      const resolveField = (
        base: number,
        f: FieldLayout113c,
        index = 0,
      ): { p: number; width: number } => {
        const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
        return { p: (base + f.off + index * width) >>> 0, width };
      };
      return {
        alloc(size: number): number {
          const p = ((top + 3) & ~3) >>> 0;
          fill(p, size, 0);
          top = (p + size) >>> 0;
          return p;
        },
        u8,
        u16,
        u32,
        setU8,
        setU16,
        setU32,
        fill,
        get(base: number, f: FieldLayout113c, index = 0): number {
          const { p, width } = resolveField(base, f, index);
          return width === 1 ? u8(p) : width === 2 ? u16(p) : u32(p);
        },
        set(base: number, f: FieldLayout113c, v: number, index = 0): void {
          const { p, width } = resolveField(base, f, index);
          if (width === 1) setU8(p, v);
          else if (width === 2) setU16(p, v);
          else setU32(p, v);
        },
      };
    }

    it('matches all 103 entries (0x00..0x66) of C2S_PACKET_TABLE_6FD1A078_113C directly against D2Game.dll, manifest, and C2S_HANDLER_BY_VA_113C', () => {
      const rootDir = resolve(__dirname, '../../..');
      const d2GameBuf = readFileSync(resolve(rootDir, 'samples/d2/D2Game.dll'));
      const d2NetBuf = readFileSync(resolve(rootDir, 'samples/d2/D2Net.dll'));
      const manifest = JSON.parse(
        readFileSync(resolve(rootDir, 'tools/oracle/callgraph/manifest-113c.json'), 'utf8'),
      ) as {
        functions: ReadonlyArray<{ module: string; va: string; status: string }>;
      };

      const d2GameByVa = new Map<number, string>();
      for (const fn of manifest.functions) {
        if (fn.module === 'D2Game') {
          d2GameByVa.set(Number.parseInt(fn.va, 16) >>> 0, fn.status);
        }
      }

      const tableOff = peVaToFileOffset(d2GameBuf, 0x6fc20000, 0x6fd1a078);
      const sizesOff = peVaToFileOffset(d2NetBuf, 0x6fbf0000, 0x6fbfabd8);
      expect(tableOff).toBe(0x0fa078);
      expect(C2S_PACKET_TABLE_6FD1A078_113C).toHaveLength(103);

      const nonNullVas = new Set<number>();
      const nullOpcodes: number[] = [];
      let flagZeroCount = 0;
      let flagOneCount = 0;

      for (let op = 0; op < 103; op++) {
        const dllHandlerVa = d2GameBuf.readUInt32LE(tableOff + op * 8) >>> 0;
        const dllFlag = d2GameBuf.readUInt32LE(tableOff + op * 8 + 4) >>> 0;
        const dllNetSize = d2NetBuf.readInt32LE(sizesOff + op * 4);

        expect(dllFlag === 0 || dllFlag === 1, `flag at 0x${op.toString(16)}`).toBe(true);
        if (dllFlag === 0) flagZeroCount++;
        else flagOneCount++;

        expect(
          C2S_PACKET_TABLE_6FD1A078_113C[op],
          `C2S_PACKET_TABLE_6FD1A078_113C[0x${op.toString(16).padStart(2, '0')}]`,
        ).toEqual({
          opcode: op,
          handlerVa: dllHandlerVa,
          flag: dllFlag,
        });

        expect(
          C2S_PACKET_SIZES[op],
          `D2Net C2S_PACKET_SIZES[0x${op.toString(16).padStart(2, '0')}]`,
        ).toBe(dllNetSize);

        if (dllHandlerVa === 0) {
          nullOpcodes.push(op);
        } else {
          nonNullVas.add(dllHandlerVa);
          expect(
            d2GameByVa.get(dllHandlerVa),
            `manifest status for 0x${dllHandlerVa.toString(16)} (op 0x${op.toString(16)})`,
          ).toBe('diff-verified');
          expect(
            C2S_HANDLER_BY_VA_113C.has(dllHandlerVa),
            `C2S_HANDLER_BY_VA_113C missing 0x${dllHandlerVa.toString(16)} (op 0x${op.toString(16)})`,
          ).toBe(true);
        }
      }

      expect(nonNullVas.size).toBe(91);
      expect(C2S_HANDLER_BY_VA_113C.size).toBe(91);
      expect(nullOpcodes).toEqual([
        0x00, 0x2b, 0x4a, 0x4e, 0x55, 0x56, 0x57, 0x5a, 0x5b, 0x5c, 0x64, 0x65,
      ]);
      expect(flagZeroCount).toBe(49);
      expect(flagOneCount).toBe(54);
      expect(C2S_PACKET_SIZES[0x2c]).toBe(0);
      expect(C2S_PACKET_SIZES[0x64]).toBe(0);
    });

    it('dispatches movement opcodes 0x01..0x04, 0x0B, and 0x5F through C2S_DispatchPacketMem113c', () => {
      const mem = new SparseMemory113c();
      const { pGame, pClient, pPlayer, pPlayerPath, pMonster, pPacket } =
        setupClientPlayerFixture(mem);

      // Invalid opcode (0x00 has null handler) -> returns 3
      mem.setU8(pPacket, 0x00);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(3);

      // Truncated packet (0x01 requires 5 bytes, pass 3) -> returns 3
      mem.setU8(pPacket, 0x01);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 3)).toBe(3);

      // 0x01 WalkToLocation (5020, 5025) -> C2S_DispatchPacketMem113c returns byte count 5 on handler rc == 0
      mem.setU8(pPacket + 0, 0x01);
      mem.setU16(pPacket + 1, 5020);
      mem.setU16(pPacket + 3, 5025);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_WALK);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetX)).toBe(5020);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetY)).toBe(5025);

      // 0x03 RunToLocation (5030, 5035)
      mem.setU8(pPacket + 0, 0x03);
      mem.setU16(pPacket + 1, 5030);
      mem.setU16(pPacket + 3, 5035);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_RUN);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetX)).toBe(5030);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetY)).toBe(5035);

      // 0x02 WalkToUnit (UNIT_MONSTER = 1, id = 42)
      mem.setU8(pPacket + 0, 0x02);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_WALK);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(pMonster);

      // 0x04 RunToUnit (UNIT_MONSTER = 1, id = 42)
      mem.setU8(pPacket + 0, 0x04);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_RUN);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(pMonster);

      // 0x0B Noop 1-byte (dispatcher returns 1 byte consumed; direct 0x6FCEB5B0 returns 0 when len == 1, 3 otherwise)
      mem.setU8(pPacket + 0, 0x0b);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1)).toBe(1);
      expect(C2S_Packet0B_Noop1Byte113c(1)).toBe(0);
      expect(C2S_Packet0B_Noop1Byte113c(2)).toBe(3);

      // 0x5F UpdatePlayerPos (0x6FCF0790 moves toward >=5-subtile pos and clears pPlayerData+0x40 & target unit)
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.setU8(pPacket + 0, 0x5f);
      mem.setU16(pPacket + 1, 5008);
      mem.setU16(pPacket + 3, 5006);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(0);

      // Direct calls to 0x01..0x04 and 0x5F (exact 0 return code on valid length)
      mem.setU16(pPacket + 1, 5004);
      mem.setU16(pPacket + 3, 5006);
      expect(C2S_Packet01_WalkToLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      expect(C2S_Packet03_RunToLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      expect(C2S_Packet5F_UpdatePlayerPos113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_Packet02_WalkToUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet04_RunToUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
    });

    it('dispatches skill opcodes 0x05..0x11 and 0x3C SelectSkill through C2S_DispatchPacketMem113c', () => {
      const mem = new SparseMemory113c();
      const {
        pGame,
        pClient,
        pPlayer,
        pPlayerPath,
        pSkillList,
        pLeftSkill,
        pRightSkill,
        pMonster,
        pPacket,
      } = setupClientPlayerFixture(mem);

      // 0x05 LeftSkillOnLocation (basic attack -> PLRMODE_ATTACK1)
      mem.setU8(pPacket + 0, 0x05);
      mem.setU16(pPacket + 1, 5012);
      mem.setU16(pPacket + 3, 5008);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_ATTACK1);
      expect(mem.get(pSkillList, D2SkillListStrc.pUsedSkill)).toBe(pLeftSkill);

      // 0x0C RightSkillOnLocation (Fire Bolt -> PLRMODE_CAST)
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.setU8(pPacket + 0, 0x0c);
      mem.setU16(pPacket + 1, 5015);
      mem.setU16(pPacket + 3, 5010);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_CAST);
      expect(mem.get(pSkillList, D2SkillListStrc.pUsedSkill)).toBe(pRightSkill);

      // 0x08 RepeatLeftSkillOnLocation & 0x0F RepeatRightSkillOnLocation
      expect(C2S_Packet08_RepeatLeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      expect(C2S_Packet0F_RepeatRightSkillOnLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      expect(C2S_Packet05_LeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);
      expect(C2S_Packet0C_RightSkillOnLocation113c(mem, pGame, pPlayer, pPacket, 5)).toBe(0);

      // Unit-targeted skill opcodes 0x06, 0x07, 0x09, 0x0A, 0x0D, 0x0E, 0x10, 0x11
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.setU8(pPacket + 0, 0x06);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(pMonster);
      expect(mem.get(pSkillList, D2SkillListStrc.pUsedSkill)).toBe(pLeftSkill);

      expect(C2S_Packet06_LeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet07_ShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet09_RepeatLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet0D_RightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet0E_ShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet10_RepeatRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);
      expect(C2S_Packet11_RepeatShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);

      // 0x11 via dispatcher
      mem.setU8(pPacket + 0, 0x11);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);

      // 0x3C SelectSkill: switch left skill to skill 36 (Fire Bolt, bit 31 = bLeft)
      mem.setU8(pPacket + 0, 0x3c);
      mem.setU32(pPacket + 1, (0x80000000 | 36) >>> 0);
      mem.setU32(pPacket + 5, 0xffffffff); // dwItemId = -1
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pSkillList, D2SkillListStrc.pLeftSkill)).toBe(pRightSkill);
      expect(C2S_Packet3C_SelectSkill113c(mem, pGame, pPlayer, pPacket, 9)).toBe(0);

      // Verify distance guard (> 100 subtiles rejected) and dual-wield helper
      expect(C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, 5050, 5050, 100)).toBe(0);
      expect(C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, 5150, 5050, 100)).toBe(1);
      expect(C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, pLeftSkill)).toBe(pLeftSkill);
    });

    it('enforces exact 0x6FCEC550 bounds, NULL slots, 0x6FCEC67C gates, flag independence, and dispatches real handlers across all signature families', () => {
      const mem = new SparseMemory113c();
      const { pGame, pClient, pPlayer, pSkillList, pRightSkill, pPacket } =
        setupClientPlayerFixture(mem);

      // Attach an extended statlist so STATE_UNINTERRUPTABLE (0x36) gating can be verified
      const pStatListEx = mem.alloc(D2StatListExStrc_SIZE);
      const pStateFlags = mem.alloc(0x30);
      mem.set(pStatListEx, D2StatListExStrc.dwFlags, 0x80000000); // STATLIST_FLAG_EXTENDED
      mem.set(pStatListEx, D2StatListExStrc.pStateFlags, pStateFlags);
      mem.set(pPlayer, D2UnitStrc.pStatListEx, pStatListEx);

      // 1) Empty, 0x00, >= 0x67, and all 12 NULL slots return 3
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([]))).toBe(3);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x67]))).toBe(3);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0xff]))).toBe(3);
      for (const nullOp of [0x00, 0x2b, 0x4a, 0x4e, 0x55, 0x56, 0x57, 0x5a, 0x5b, 0x5c, 0x64, 0x65]) {
        expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([nullOp]))).toBe(3);
      }

      // 2) Real non-movement handlers across signature families (alive player) with VA hit verification:
      // F1A always-reject(3) stubs (covers both flag=0: 0x2C/0x2D/0x39 and flag=1: 0x45/0x52)
      const rejectCases: ReadonlyArray<readonly [number, number, Uint8Array]> = [
        [0x2c, 0x6fceb1e0, new Uint8Array([0x2c])],
        [0x2d, 0x6fcebda0, new Uint8Array([0x2d])],
        [0x39, 0x6fceb560, new Uint8Array([0x39, 0, 0, 0, 0])],
        [0x45, 0x6fceb550, new Uint8Array([0x45, 0, 0, 0, 0, 0, 0, 0, 0])],
        [0x52, 0x6fceb490, new Uint8Array([0x52, 0, 0, 0, 0])],
      ];
      for (const [op, va, pkt] of rejectCases) {
        beginVaTrace113c();
        const rc = C2S_Dispatch113c(mem, pGame, pPlayer, pkt);
        const hits = endVaTrace113c();
        expect(rc, `reject stub 0x${op.toString(16)}`).toBe(3);
        expect(hasD2GameVaHit(hits, 0x6fcec550)).toBe(true);
        expect(hasD2GameVaHit(hits, va), `hit 0x${va.toString(16)}`).toBe(true);
      }

      // F1A always-noop(0) stubs (covers flag=1: 0x2E/0x42/0x43 and flag=0: 0x66)
      const noopCases: ReadonlyArray<readonly [number, number, Uint8Array]> = [
        [0x2e, 0x6fceb1d0, new Uint8Array([0x2e, 0, 0])],
        [0x42, 0x6fceb1c0, new Uint8Array([0x42])],
        [0x43, 0x6fceb1b0, new Uint8Array([0x43])],
        [0x66, 0x6fceb190, new Uint8Array([0x66, 0, 0])],
      ];
      for (const [op, va, pkt] of noopCases) {
        beginVaTrace113c();
        const rc = C2S_Dispatch113c(mem, pGame, pPlayer, pkt);
        const hits = endVaTrace113c();
        expect(rc, `noop stub 0x${op.toString(16)}`).toBe(0);
        expect(hasD2GameVaHit(hits, va), `hit 0x${va.toString(16)}`).toBe(true);
      }

      // F3 4-arg no-pGame handlers: 0x12 (0x6FCEB590) and 0x3F (0x6FCEBD50)
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x12]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x12, 0]))).toBe(3);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x3f, 0]))).toBe(3);
      const f3Hits = endVaTrace113c();
      expect(hasD2GameVaHit(f3Hits, 0x6fceb590)).toBe(true);
      expect(hasD2GameVaHit(f3Hits, 0x6fcebd50)).toBe(true);

      // F1A size-checked handler: 0x48 (0x6FCEB4E0)
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x48, 0]))).toBe(3);
      const h48Hits = endVaTrace113c();
      expect(hasD2GameVaHit(h48Hits, 0x6fceb4e0)).toBe(true);

      // F1B (SparseMemory113c), F5 (hooks default), F6 (SparseMemory113c + callback default)
      const familySizeCheckCases: ReadonlyArray<readonly [number, number, Uint8Array]> = [
        [0x35, 0x6fcef0a0, new Uint8Array([0x35, 0])], // F1B (k2-w11b1)
        [0x4f, 0x6fcf1470, new Uint8Array([0x4f, 0])], // F1B (k2-w16b1)
        [0x17, 0x6fcef380, new Uint8Array([0x17, 0])], // F5 (k2-w15b1)
        [0x32, 0x6fcef220, new Uint8Array([0x32, 0])], // F5 (k2-w15b1)
        [0x36, 0x6fcf0060, new Uint8Array([0x36, 0])], // F5 (k2-w15b1)
        [0x1b, 0x6fcef2f0, new Uint8Array([0x1b, 0])], // F6 (k2-w14b1, misnamed TS symbol)
        [0x33, 0x6fcef570, new Uint8Array([0x33, 0])], // F6 (k2-w14b1, misnamed TS symbol)
        [0x49, 0x6fcf0d30, new Uint8Array([0x49, 0])], // F6 (k2-w14b1)
      ];
      for (const [op, va, pkt] of familySizeCheckCases) {
        beginVaTrace113c();
        const rc = C2S_Dispatch113c(mem, pGame, pPlayer, pkt);
        const hits = endVaTrace113c();
        expect(rc, `size-reject op 0x${op.toString(16)}`).toBe(3);
        expect(hasD2GameVaHit(hits, va), `hit 0x${va.toString(16)}`).toBe(true);
      }

      // 3) case 2 (0x41 Resurrect): alive -> returns 0 WITHOUT hitting 0x6FCF14B0
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x41]))).toBe(0);
      const alive41Hits = endVaTrace113c();
      expect(hasD2GameVaHit(alive41Hits, 0x6fcf14b0)).toBe(false);

      // 4) Dead player (mode 0x11):
      // - case 2 (0x41) dispatches 0x6FCF14B0 (2-byte truncated proves handler ran -> returns 3)
      // - case 0 bypass (0x14, 0x15, 0x3C, 0x43 [flag=1], 0x66 [flag=0]) all dispatch
      // - case 1 (0x20, 0x26) and case 3 (0x01 [flag=0], 0x2E [flag=1]) return 0 WITHOUT hitting handlers
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, 0x11);

      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x41, 0]))).toBe(3);
      const dead41Hits = endVaTrace113c();
      expect(hasD2GameVaHit(dead41Hits, 0x6fcf14b0)).toBe(true);

      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x14, 0, 0]))).toBe(3);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x15, 0, 0]))).toBe(2);
      const pkt3c = new Uint8Array(9);
      pkt3c[0] = 0x3c;
      new DataView(pkt3c.buffer).setUint32(1, (0x80000000 | 36) >>> 0, true);
      new DataView(pkt3c.buffer).setUint32(5, 0xffffffff, true);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, pkt3c)).toBe(0);
      expect(mem.get(pSkillList, D2SkillListStrc.pLeftSkill)).toBe(pRightSkill);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x43]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x66, 0]))).toBe(0);
      const bypassHits = endVaTrace113c();
      expect(hasD2GameVaHit(bypassHits, 0x6fcf00a0)).toBe(true);
      expect(hasD2GameVaHit(bypassHits, 0x6fcedbb0)).toBe(true);
      expect(hasD2GameVaHit(bypassHits, 0x6fcef480)).toBe(true);
      expect(hasD2GameVaHit(bypassHits, 0x6fceb1b0)).toBe(true);
      expect(hasD2GameVaHit(bypassHits, 0x6fceb190)).toBe(true);

      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x20, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x26, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x01, 0, 0, 0, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x2e, 0, 0]))).toBe(0);
      const deadBlockedHits = endVaTrace113c();
      expect(hasD2GameVaHit(deadBlockedHits, 0x6fcef730)).toBe(false);
      expect(hasD2GameVaHit(deadBlockedHits, 0x6fcef5b0)).toBe(false);
      expect(hasD2GameVaHit(deadBlockedHits, 0x6fcee0d0)).toBe(false);
      expect(hasD2GameVaHit(deadBlockedHits, 0x6fceb1d0)).toBe(false);

      // 5) Alive with STATE_UNINTERRUPTABLE (0x36): blocks case 1 & case 3 without hitting handlers,
      // while case 0 bypass (0x43, 0x66) still dispatches
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      STATES_ToggleState113c(mem, pPlayer, 0x36, 1);

      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x20, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x2c]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x2e, 0, 0]))).toBe(0);
      const st36BlockedHits = endVaTrace113c();
      expect(hasD2GameVaHit(st36BlockedHits, 0x6fcef730)).toBe(false);
      expect(hasD2GameVaHit(st36BlockedHits, 0x6fceb1e0)).toBe(false);
      expect(hasD2GameVaHit(st36BlockedHits, 0x6fceb1d0)).toBe(false);

      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x43]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x66, 0]))).toBe(0);
      const st36BypassHits = endVaTrace113c();
      expect(hasD2GameVaHit(st36BypassHits, 0x6fceb1b0)).toBe(true);
      expect(hasD2GameVaHit(st36BypassHits, 0x6fceb190)).toBe(true);

      // Clear state 0x36 and verify C2S_DispatchPacketMem113c + C2S_DispatchRawMem113c on non-movement ops
      STATES_ToggleState113c(mem, pPlayer, 0x36, 0);
      beginVaTrace113c();
      mem.setU8(pPacket, 0x2c);
      // D2Net size=0 -> C2S_DispatchPacketMem113c rejects upfront with 3; raw dispatch hits 0x6FCEB1E0 -> 3
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1)).toBe(3);
      expect(C2S_DispatchRawMem113c(mem, pGame, pPlayer, pPacket, 1)).toBe(3);
      mem.setU8(pPacket, 0x2e);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 3)).toBe(3);
      mem.setU8(pPacket, 0x12);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1)).toBe(1);
      mem.setU8(pPacket, 0x66);
      // Variable-length (-1) packet returns consumed byte length (len = 3), not 1
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 3)).toBe(3);
      expect(C2S_DispatchRawMem113c(mem, pGame, pPlayer, pPacket, 3)).toBe(0);
      const memDispatchHits = endVaTrace113c();
      expect(hasD2GameVaHit(memDispatchHits, 0x6fceb1e0)).toBe(true);
      expect(hasD2GameVaHit(memDispatchHits, 0x6fceb1d0)).toBe(true);
      expect(hasD2GameVaHit(memDispatchHits, 0x6fceb590)).toBe(true);
      expect(hasD2GameVaHit(memDispatchHits, 0x6fceb190)).toBe(true);
    });

    it('dispatches all 91/91 non-null C2S opcodes through C2S_Dispatch113c with exact single-VA isolation and 4-arg no-pGame alignment', () => {
      const mem = new SparseMemory113c();
      const { pGame, pClient, pPlayer, pPacket } = setupClientPlayerFixture(mem);

      const allHandlerTags = new Set<string>();
      for (const entry of C2S_PACKET_TABLE_6FD1A078_113C) {
        if (entry.handlerVa !== 0) {
          allHandlerTags.add(formatD2GameVa(entry.handlerVa));
        }
      }
      expect(allHandlerTags.size).toBe(91);

      const oneByteOps = new Set([0x0b, 0x2c, 0x2d, 0x2e, 0x42, 0x43, 0x48, 0x66]);
      const threeByteOps = new Set([0x14, 0x15]);
      const expectedRc0Ops = new Set([0x0b, 0x2e, 0x42, 0x43, 0x66]);
      const expectedRc2Ops = new Set([0x15, 0x48]);

      let dispatchedCount = 0;
      for (const entry of C2S_PACKET_TABLE_6FD1A078_113C) {
        if (entry.handlerVa === 0) continue;
        const op = entry.opcode;
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, op === 0x41 ? PLRMODE_DEAD : PLRMODE_NEUTRAL);

        const pkt = oneByteOps.has(op)
          ? new Uint8Array([op])
          : threeByteOps.has(op)
            ? new Uint8Array([op, 0, 0])
            : new Uint8Array([op, 0]);
        const expectedRc = expectedRc0Ops.has(op) ? 0 : expectedRc2Ops.has(op) ? 2 : 3;

        beginVaTrace113c();
        const rc = C2S_Dispatch113c(mem, pGame, pPlayer, pkt);
        const hits = endVaTrace113c();

        const ownTag = formatD2GameVa(entry.handlerVa);
        const otherC2SHits: string[] = [];
        for (const tag of hits) {
          if (allHandlerTags.has(tag) && tag !== ownTag) {
            otherC2SHits.push(tag);
          }
        }

        const label = `op 0x${op.toString(16).padStart(2, '0')} -> ${ownTag}`;
        expect(rc, `rc for ${label}`).toBe(expectedRc);
        expect(hasD2GameVaHit(hits, 0x6fcec550), `dispatcher hit for ${label}`).toBe(true);
        expect(hasD2GameVaHit(hits, entry.handlerVa), `handler hit for ${label}`).toBe(true);
        expect(otherC2SHits, `single-VA isolation for ${label}`).toEqual([]);
        dispatchedCount++;
      }
      expect(dispatchedCount).toBe(91);

      // 4-arg no-pGame alignment for 0x12 (0x6FCEB590) and 0x3F (0x6FCEBD50) using a unit-shaped decoy pGame
      const decoyGame = mem.alloc(Math.max(D2GameStrc_SIZE, D2UnitStrc_SIZE));
      attachExtendedStatList(mem, decoyGame);
      attachExtendedStatList(mem, pPlayer);
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);

      // 0x12 must clear state 0x0C on pPlayer and leave decoyGame untouched across all 3 dispatchers
      const run12Check = (invoke: () => number, expectedRc: number, label: string): void => {
        STATES_ToggleState113c(mem, decoyGame, 0x0c, 1);
        STATES_ToggleState113c(mem, pPlayer, 0x0c, 1);
        beginVaTrace113c();
        const rc = invoke();
        const hits = endVaTrace113c();
        expect(rc, label).toBe(expectedRc);
        expect(hasD2GameVaHit(hits, 0x6fceb590), label).toBe(true);
        expect(STATES_CheckState113c(mem, pPlayer, 0x0c), `${label}: pPlayer cleared`).toBe(0);
        expect(STATES_CheckState113c(mem, decoyGame, 0x0c), `${label}: decoyGame intact`).not.toBe(
          0,
        );
      };
      mem.setU8(pPacket, 0x12);
      run12Check(
        () => C2S_Dispatch113c(mem, decoyGame, pPlayer, new Uint8Array([0x12])),
        0,
        '0x12 Dispatch113c',
      );
      run12Check(
        () => C2S_DispatchRawMem113c(mem, decoyGame, pPlayer, pPacket, 1),
        0,
        '0x12 DispatchRawMem113c',
      );
      run12Check(
        () => C2S_DispatchPacketMem113c(mem, decoyGame, pClient, pPacket, 1),
        1,
        '0x12 DispatchPacketMem113c',
      );

      // 0x3F must inspect & mutate pPlayer (+0x6E/+0xC4 bit 10), never decoyGame (both polarities)
      mem.setU8(pPacket + 0, 0x3f);
      mem.setU16(pPacket + 1, 0x19);
      const run3fAllowCheck = (invoke: () => number, expectedRc: number, label: string): void => {
        mem.setU32((decoyGame + 0xc4) >>> 0, 0x400);
        mem.setU16((decoyGame + 0x6e) >>> 0, 0);
        mem.setU32((pPlayer + 0xc4) >>> 0, 0);
        mem.setU16((pPlayer + 0x6e) >>> 0, 0);
        beginVaTrace113c();
        const rc = invoke();
        const hits = endVaTrace113c();
        expect(rc, label).toBe(expectedRc);
        expect(hasD2GameVaHit(hits, 0x6fcebd50), label).toBe(true);
        expect(mem.u16((pPlayer + 0x6e) >>> 0), `${label}: pPlayer phrase`).toBe(0x19);
        expect(mem.u32((pPlayer + 0xc4) >>> 0) & 0x400, `${label}: pPlayer flag bit 10`).toBe(
          0x400,
        );
        expect(mem.u16((decoyGame + 0x6e) >>> 0), `${label}: decoyGame phrase intact`).toBe(0);
      };
      run3fAllowCheck(
        () => C2S_Dispatch113c(mem, decoyGame, pPlayer, new Uint8Array([0x3f, 0x19, 0x00])),
        0,
        '0x3F allow Dispatch113c',
      );
      run3fAllowCheck(
        () => C2S_DispatchRawMem113c(mem, decoyGame, pPlayer, pPacket, 3),
        0,
        '0x3F allow DispatchRawMem113c',
      );
      run3fAllowCheck(
        () => C2S_DispatchPacketMem113c(mem, decoyGame, pClient, pPacket, 3),
        3,
        '0x3F allow DispatchPacketMem113c',
      );

      // Polarity flip: decoyGame bit 10 = 0, pPlayer bit 10 = 1 -> all 3 dispatchers return 1 without overwriting phrase
      mem.setU32((decoyGame + 0xc4) >>> 0, 0);
      mem.setU32((pPlayer + 0xc4) >>> 0, 0x400);
      mem.setU16((pPlayer + 0x6e) >>> 0, 0x19);
      mem.setU16(pPacket + 1, 0x1a);
      expect(C2S_Dispatch113c(mem, decoyGame, pPlayer, new Uint8Array([0x3f, 0x1a, 0x00]))).toBe(1);
      expect(C2S_DispatchRawMem113c(mem, decoyGame, pPlayer, pPacket, 3)).toBe(1);
      expect(C2S_DispatchPacketMem113c(mem, decoyGame, pClient, pPacket, 3)).toBe(1);
      expect(mem.u16((pPlayer + 0x6e) >>> 0)).toBe(0x19);
    });

    it('does not fabricate a D2Game:0x6FC987C0 trace hit when PLAYER_StartModeOnUnit113c runs a no-op onStartAttackOnUnit callback', () => {
      const mem = new SparseMemory113c();
      const { pGame, pPlayer, pMonster } = setupClientPlayerFixture(mem);

      let noopCalled = 0;
      beginVaTrace113c();
      const rc = PLAYER_StartModeOnUnit113c(
        mem,
        pGame,
        pPlayer,
        pMonster,
        PLRMODE_ATTACK1,
        0,
        0,
        1,
        0,
        {
          onStartAttackOnUnit: () => {
            noopCalled++;
          },
        },
      );
      const hits = endVaTrace113c();

      expect(rc).toBe(1);
      expect(noopCalled).toBe(1);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_NEUTRAL);
      expect(hasD2GameVaHit(hits, 0x6fc98430)).toBe(true);
      expect(hasD2GameVaHit(hits, 0x6fc987c0)).toBe(false);
    });

    it('blocks non-bypass opcodes on PLRMODE_DEATH (0) while allowing case 0 bypass and case 2 (0x41) on PLRMODE_DEAD + STATE_UNINTERRUPTABLE', () => {
      const mem = new SparseMemory113c();
      const { pGame, pPlayer } = setupClientPlayerFixture(mem);
      attachExtendedStatList(mem, pPlayer);

      // PLRMODE_DEATH (0): blocks case 3 (0x01, 0x2E), case 1 (0x20), and case 2 (0x41) with 0 handler hits
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_DEATH);
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x01, 0, 0, 0, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x20, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x41, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x2e, 0, 0]))).toBe(0);
      const deathBlockedHits = endVaTrace113c();
      expect(hasD2GameVaHit(deathBlockedHits, 0x6fcec550)).toBe(true);
      expect(hasD2GameVaHit(deathBlockedHits, 0x6fcee0d0)).toBe(false);
      expect(hasD2GameVaHit(deathBlockedHits, 0x6fcef730)).toBe(false);
      expect(hasD2GameVaHit(deathBlockedHits, 0x6fcf14b0)).toBe(false);
      expect(hasD2GameVaHit(deathBlockedHits, 0x6fceb1d0)).toBe(false);

      // PLRMODE_DEATH (0): allows all case 0 bypass opcodes (0x14, 0x15, 0x3C, 0x43, 0x66)
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x43]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x66, 0]))).toBe(0);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x15, 0, 0]))).toBe(2);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x14, 0, 0]))).toBe(3);
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x3c, 0]))).toBe(3);
      const deathBypassHits = endVaTrace113c();
      expect(hasD2GameVaHit(deathBypassHits, 0x6fceb1b0)).toBe(true);
      expect(hasD2GameVaHit(deathBypassHits, 0x6fceb190)).toBe(true);
      expect(hasD2GameVaHit(deathBypassHits, 0x6fcedbb0)).toBe(true);
      expect(hasD2GameVaHit(deathBypassHits, 0x6fcf00a0)).toBe(true);
      expect(hasD2GameVaHit(deathBypassHits, 0x6fcef480)).toBe(true);

      // PLRMODE_DEAD (0x11) + STATE_UNINTERRUPTABLE (0x36): case 2 (0x41) skips state 0x36 check per D2Game:0x6FCEC596
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_DEAD);
      STATES_ToggleState113c(mem, pPlayer, 0x36, 1);
      beginVaTrace113c();
      expect(C2S_Dispatch113c(mem, pGame, pPlayer, new Uint8Array([0x41, 0]))).toBe(3);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcf14b0)).toBe(true);
    });

    it('enforces C2S_DispatchPacketMem113c & C2S_DispatchRawMem113c client guards, framing sizes, sparse 0x14/0x15 staging, onUnhandledOpcode gating, and explicit error paths', () => {
      const mem = new SparseMemory113c();
      const { pGame, pClient, pPlayer, pPacket } = setupClientPlayerFixture(mem);
      attachExtendedStatList(mem, pPlayer);

      // 1) Client/player validation guards -> 2 on valid 5-byte 0x01
      mem.setU8(pPacket + 0, 0x01);
      mem.setU16(pPacket + 1, 5000);
      mem.setU16(pPacket + 3, 5000);
      expect(C2S_DispatchPacketMem113c(mem, pGame, 0, pPacket, 5)).toBe(2);
      mem.setU32(pClient + D2ClientStrcOffsets.dwClientState, 3);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(2);
      mem.setU32(pClient + D2ClientStrcOffsets.dwClientState, 4);
      mem.setU32(pClient + D2ClientStrcOffsets.pPlayer, 0);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(2);
      mem.setU32(pClient + D2ClientStrcOffsets.pPlayer, pPlayer);

      // 2) 0x64 (D2Net size=0, NULL) -> 3 with and without onUnhandledOpcode
      mem.setU8(pPacket, 0x64);
      let cbCalled = 0;
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1)).toBe(3);
      expect(
        C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1, {
          onUnhandledOpcode: () => {
            cbCalled++;
            return 1;
          },
        }),
      ).toBe(3);
      expect(cbCalled).toBe(0);

      // 3) 0x2C (D2Net size=0, non-null 0x6FCEB1E0) -> 3 across alive, dead (0x11), and STATE_UNINTERRUPTABLE (0x36)
      const states2c: ReadonlyArray<readonly [string, number, number]> = [
        ['alive', PLRMODE_NEUTRAL, 0],
        ['dead', PLRMODE_DEAD, 0],
        ['st36', PLRMODE_NEUTRAL, 1],
      ];
      mem.setU8(pPacket, 0x2c);
      for (const [label, mode, st36] of states2c) {
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode);
        STATES_ToggleState113c(mem, pPlayer, 0x36, st36);
        cbCalled = 0;
        expect(
          C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1),
          `0x2C no-cb ${label}`,
        ).toBe(3);
        expect(
          C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1, {
            onUnhandledOpcode: () => {
              cbCalled++;
              return 1;
            },
          }),
          `0x2C with-cb ${label}`,
        ).toBe(3);
        expect(cbCalled, `0x2C cbCalled ${label}`).toBe(0);
      }
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      STATES_ToggleState113c(mem, pPlayer, 0x36, 0);

      // 4) Truncated 0x01 (len 2) with callees={} on pPlayer->pUnitData===0 -> 3 with ZERO premature allocation
      const pBarePlayer = mem.alloc(D2UnitStrc_SIZE);
      const pBareClient = mem.alloc(0x200);
      mem.set(pBarePlayer, D2UnitStrc.dwUnitType, UNIT_PLAYER);
      mem.set(pBarePlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.setU32(pBareClient + D2ClientStrcOffsets.dwClientState, 4);
      mem.setU32(pBareClient + D2ClientStrcOffsets.pPlayer, pBarePlayer);
      mem.setU8(pPacket + 0, 0x01);
      mem.setU8(pPacket + 1, 0x00);
      expect(mem.get(pBarePlayer, D2UnitStrc.pUnitData)).toBe(0);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pBareClient, pPacket, 2, {})).toBe(3);
      expect(mem.get(pBarePlayer, D2UnitStrc.pUnitData)).toBe(0);

      // 5) Exact 3-byte [0x15, 0, 0] in SparseMemory113c (byte +3 unloaded) via RawMem & PacketMem -> 2 + 0x6FCEDBB0 hit
      const pExactChat3 = 0x7e800000;
      mem.loadBlock(pExactChat3, new Uint8Array([0x15, 0, 0]));
      expect(() => mem.u8((pExactChat3 + 3) >>> 0)).toThrow(/read of unloaded byte/);

      beginVaTrace113c();
      expect(C2S_DispatchRawMem113c(mem, pGame, pPlayer, pExactChat3, 3)).toBe(2);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcedbb0)).toBe(true);

      beginVaTrace113c();
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pExactChat3, 3)).toBe(2);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcedbb0)).toBe(true);

      // Exact 4-byte [0x14, 0, 0, 0xff] in SparseMemory113c (byte +4 unloaded) via RawMem & PacketMem -> 0 / 4 + 0x6FCF00A0 hit
      const pExactOverhead4 = 0x7e800100;
      mem.loadBlock(pExactOverhead4, new Uint8Array([0x14, 0, 0, 0xff]));
      expect(() => mem.u8((pExactOverhead4 + 4) >>> 0)).toThrow(/read of unloaded byte/);

      beginVaTrace113c();
      expect(C2S_DispatchRawMem113c(mem, pGame, pPlayer, pExactOverhead4, 4)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcf00a0)).toBe(true);

      beginVaTrace113c();
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pExactOverhead4, 4)).toBe(4);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcf00a0)).toBe(true);

      // Aliasing pPacket === 0x7f001000 in C2S_DispatchRawMem113c preserves bytes for 0x15
      const pRawAlias = 0x7f001000;
      mem.loadBlock(pRawAlias, new Uint8Array([0x15, 0x01, 0x00, 0x68, 0x69, 0x00, 0x00, 0x00]));
      beginVaTrace113c();
      expect(C2S_DispatchRawMem113c(mem, pGame, pPlayer, pRawAlias, 8)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcedbb0)).toBe(true);
      expect(mem.u8(pRawAlias)).toBe(0x15);
      expect(mem.u8((pRawAlias + 3) >>> 0)).toBe(0x68);

      // 6) Valid variable-length (-1) packets via C2S_DispatchPacketMem113c without onUnhandledOpcode return len (8 / 10), not 1
      const pChat8 = 0x7e810000;
      mem.loadBlock(pChat8, new Uint8Array([0x15, 0x01, 0x00, 0x68, 0x69, 0x00, 0x00, 0x00]));
      beginVaTrace113c();
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pChat8, 8)).toBe(8);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcedbb0)).toBe(true);

      const pWarden10 = 0x7e810100;
      mem.loadBlock(pWarden10, new Uint8Array([0x66, 0, 1, 2, 3, 4, 5, 6, 7, 8]));
      beginVaTrace113c();
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pWarden10, 10)).toBe(10);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fceb190)).toBe(true);

      // 7) callees.onUnhandledOpcode on 0x13: invoked when alive (cbCalled===1), gated when DEAD / DEATH / st36 (cbCalled===0)
      mem.fill(pPacket, 9, 0);
      mem.setU8(pPacket, 0x13);
      cbCalled = 0;
      expect(
        C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9, {
          onUnhandledOpcode: (_m, _g, _p, op, _pkt, len) => {
            cbCalled++;
            expect(op).toBe(0x13);
            return len;
          },
        }),
      ).toBe(9);
      expect(cbCalled).toBe(1);

      // Alive 0x41 with onUnhandledOpcode: gated (cbCalled===0, returns 1)
      mem.setU8(pPacket, 0x41);
      cbCalled = 0;
      expect(
        C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1, {
          onUnhandledOpcode: () => {
            cbCalled++;
            return 1;
          },
        }),
      ).toBe(1);
      expect(cbCalled).toBe(0);

      mem.fill(pPacket, 9, 0);
      mem.setU8(pPacket, 0x13);
      const gated13Cases: ReadonlyArray<readonly [string, number, number]> = [
        ['dead', PLRMODE_DEAD, 0],
        ['death', PLRMODE_DEATH, 0],
        ['st36', PLRMODE_NEUTRAL, 1],
      ];
      for (const [label, mode, st36] of gated13Cases) {
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode);
        STATES_ToggleState113c(mem, pPlayer, 0x36, st36);
        cbCalled = 0;
        beginVaTrace113c();
        const rcGated = C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9, {
          onUnhandledOpcode: () => {
            cbCalled++;
            return 9;
          },
        });
        const gatedHits = endVaTrace113c();
        expect(cbCalled, `0x13 onUnhandledOpcode gated (${label})`).toBe(0);
        expect(rcGated, `0x13 gated wire-byte return (${label})`).toBe(9);
        expect(hasD2GameVaHit(gatedHits, 0x6fcf0910), `0x13 handler not hit (${label})`).toBe(false);
      }

      // Positive control: dead (0x11) with & without st36 allows 0x41 onUnhandledOpcode; dead/st36 allows 0x43 & 0x15
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_DEAD);
      for (const st36 of [0, 1] as const) {
        STATES_ToggleState113c(mem, pPlayer, 0x36, st36);
        mem.setU8(pPacket, 0x41);
        cbCalled = 0;
        expect(
          C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1, {
            onUnhandledOpcode: () => {
              cbCalled++;
              return 1;
            },
          }),
        ).toBe(1);
        expect(cbCalled).toBe(1);
      }

      mem.setU8(pPacket, 0x43);
      cbCalled = 0;
      expect(
        C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1, {
          onUnhandledOpcode: () => {
            cbCalled++;
            return 1;
          },
        }),
      ).toBe(1);
      expect(cbCalled).toBe(1);

      cbCalled = 0;
      expect(
        C2S_DispatchPacketMem113c(mem, pGame, pClient, pChat8, 8, {
          onUnhandledOpcode: () => {
            cbCalled++;
            return 8;
          },
        }),
      ).toBe(8);
      expect(cbCalled).toBe(1);

      // 8) Explicit error paths: unregistered VA throw & non-SparseMemory113c throw on 0x13
      expect(() => dispatchC2SHandlerByVa113c(0x6fc20000, mem, pGame, pPlayer, pPacket, 1)).toThrow(
        /Unregistered C2S handler VA 0x6FC20000/,
      );
      expect(() => dispatchC2SHandlerByVa113c(0x00000000, mem, pGame, pPlayer, pPacket, 1)).toThrow(
        /Unregistered C2S handler VA 0x00000000/,
      );

      const mapMem = createMapMemory113c();
      const pMapGame = mapMem.alloc(D2GameStrc_SIZE);
      const pMapPlayer = mapMem.alloc(D2UnitStrc_SIZE);
      mapMem.set(pMapPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      expect(() =>
        C2S_Dispatch113c(mapMem, pMapGame, pMapPlayer, new Uint8Array([0x13, 0])),
      ).toThrow(/C2S opcode 0x13 requires SparseMemory113c/);

      const heap = new Heap113c(65536);
      const pHeapGame = heap.alloc(D2GameStrc_SIZE);
      const pHeapPlayer = heap.alloc(D2UnitStrc_SIZE);
      const pHeapPkt = heap.alloc(16);
      heap.set(pHeapPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      heap.setU8(pHeapPkt, 0x13);
      expect(() => C2S_DispatchRawMem113c(heap, pHeapGame, pHeapPlayer, pHeapPkt, 2)).toThrow(
        /C2S opcode 0x13 requires SparseMemory113c/,
      );
    });

    it('dispatches real table-driven opcodes and gates through C2S_DispatchFromMem113c on a hydrated snapshot', () => {
      const world = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c('a1-town-walk', 2)));
      const { m, pGame } = world;
      const pBuf = 0x7f000000;

      // NULL slot 0x2B and OOB 0x67 -> 3
      m.loadBlock(pBuf, new Uint8Array([0x2b]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 1)).toBe(3);
      expect(C2S_DispatchFromMem113c(m, 0, pBuf, 1)).toBe(3);
      m.loadBlock(pBuf, new Uint8Array([0x67]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 1)).toBe(3);

      // Alive 0x41 -> 0 without hitting 0x6FCF14B0
      beginVaTrace113c();
      m.loadBlock(pBuf, new Uint8Array([0x41]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 1)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcf14b0)).toBe(false);

      // Real non-movement opcodes dispatched by table VA: 0x66 -> 0, 0x2C -> 3, 0x12 -> 0
      beginVaTrace113c();
      m.loadBlock(pBuf, new Uint8Array([0x66, 0, 0]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 3)).toBe(0);
      m.loadBlock(pBuf, new Uint8Array([0x2c]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 1)).toBe(3);
      m.loadBlock(pBuf, new Uint8Array([0x12]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 1)).toBe(0);
      const snapHits = endVaTrace113c();
      expect(hasD2GameVaHit(snapHits, 0x6fceb190)).toBe(true);
      expect(hasD2GameVaHit(snapHits, 0x6fceb1e0)).toBe(true);
      expect(hasD2GameVaHit(snapHits, 0x6fceb590)).toBe(true);

      // Input validation & pGame === 0 guard (no crash)
      m.loadBlock(pBuf, new Uint8Array([0x01, 0, 0, 0, 0]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 0)).toBe(3);
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, -5)).toBe(3);
      expect(C2S_DispatchFromMem113c(m, pGame, 0, 5)).toBe(3);
      m.loadBlock(pBuf, new Uint8Array([0x66, 0, 0]));
      expect(C2S_DispatchFromMem113c(m, 0, pBuf, 3)).toBe(0);
      const freshMem = new SparseMemory113c();
      freshMem.loadBlock(pBuf, new Uint8Array([0x66, 0, 0]));
      expect(C2S_DispatchFromMem113c(freshMem, 0, pBuf, 3)).toBe(0);

      // Resolve active player for K4, scratch-aliasing, positive-control 0x6FC987C0, dead-player, and empty-player checks
      const sliceWorld = getOrHydrateSliceWorld113c(m, pGame);
      const pSnapPlayer = [...sliceWorld.playerById.values()][0]!;
      expect(pSnapPlayer).toBeGreaterThan(0);

      // K4 hooks (0x30/0x32/0x38/0x49 truncated -> 3; 0x2E -> 0) propagate real handler rc and invoke syncWorld
      installK4QuestReplay113c();
      const k4Cases: ReadonlyArray<readonly [number, number, Uint8Array, number]> = [
        [0x30, 0x6fced480, new Uint8Array([0x30, 0]), 3],
        [0x32, 0x6fcef220, new Uint8Array([0x32, 0]), 3],
        [0x38, 0x6fcefb30, new Uint8Array([0x38, 0]), 3],
        [0x49, 0x6fcf0d30, new Uint8Array([0x49, 0]), 3],
        [0x2e, 0x6fceb1d0, new Uint8Array([0x2e, 0, 0]), 0],
      ];
      for (const [op, va, pkt, expectedRc] of k4Cases) {
        let syncCount = 0;
        beginVaTrace113c();
        const k4Rc = tryApplyQuestAndNpcC2SPacketK4_113c(m, pGame, pSnapPlayer, pkt, () => {
          syncCount++;
        });
        const k4Hits = endVaTrace113c();
        expect(k4Rc, `K4 direct rc op 0x${op.toString(16)}`).toBe(expectedRc);
        expect(syncCount, `K4 syncWorld op 0x${op.toString(16)}`).toBe(1);
        expect(hasD2GameVaHit(k4Hits, va), `K4 direct hit op 0x${op.toString(16)}`).toBe(true);

        m.loadBlock(pBuf, pkt);
        beginVaTrace113c();
        const fromMemRc = C2S_DispatchFromMem113c(m, pGame, pBuf, pkt.length);
        const fromMemHits = endVaTrace113c();
        expect(fromMemRc, `DispatchFromMem K4 rc op 0x${op.toString(16)}`).toBe(expectedRc);
        expect(
          hasD2GameVaHit(fromMemHits, va),
          `DispatchFromMem K4 hit op 0x${op.toString(16)}`,
        ).toBe(true);
      }

      // K4_QUEST_ARG_SCRATCH_VA (0x7f000c00) remains disjoint from K4_PACKET_SCRATCH_VA (0x7f000800) on 100B 0x66
      const k4ArgScratchSentinelVa = 0x7f000c00;
      m.setU32(k4ArgScratchSentinelVa, 0x12345678);
      const pkt100 = new Uint8Array(100);
      pkt100[0] = 0x66;
      m.loadBlock(pBuf, pkt100);
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, pkt100.length)).toBe(0);
      expect(m.u32(k4ArgScratchSentinelVa)).toBe(0x12345678);

      // pPacket === 0x7f001000 (aliasing C2S_DISPATCH_PKT_SCRATCH_VA_113C) reads bytes cleanly without zeroing input
      const pScratchAlias = 0x7f001000;
      m.loadBlock(pScratchAlias, new Uint8Array([0x3f, 0x19, 0x00]));
      beginVaTrace113c();
      expect(C2S_DispatchFromMem113c(m, pGame, pScratchAlias, 3)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcebd50)).toBe(true);
      expect(m.u8(pScratchAlias)).toBe(0x3f);
      expect(m.u8((pScratchAlias + 1) >>> 0)).toBe(0x19);
      expect(m.u16((pSnapPlayer + 0x6e) >>> 0)).toBe(0x19);

      m.loadBlock(
        pScratchAlias,
        new Uint8Array([0x3c, 0x00, 0x00, 0x00, 0x80, 0xff, 0xff, 0xff, 0xff]),
      );
      beginVaTrace113c();
      expect(C2S_DispatchFromMem113c(m, pGame, pScratchAlias, 9)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcef480)).toBe(true);
      expect(m.u8(pScratchAlias)).toBe(0x3c);
      expect(m.u32((pScratchAlias + 5) >>> 0)).toBe(0xffffffff);

      // Positive control for Forensic Check 2: real hydrated onStartAttackOnUnit callees genuinely execute applyPlayerPacket113c (0x6FC987C0) & its real callees
      const pSnapTarget = [...sliceWorld.monsterById.values()][0]!;
      expect(pSnapTarget).toBeGreaterThan(0);
      const origMode = m.get(pSnapPlayer, D2UnitStrc.dwAnimMode);
      beginVaTrace113c();
      expect(
        PLAYER_StartModeOnUnit113c(
          m,
          pGame,
          pSnapPlayer,
          pSnapTarget,
          PLRMODE_ATTACK1,
          0,
          0,
          1,
          0,
          buildSliceC2SCallees113c(sliceWorld),
        ),
      ).toBe(1);
      const sliceAttackHits = endVaTrace113c();
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fc98430)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fc987c0)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fcfa750)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fcfff10)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fd00750)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fcff7b0)).toBe(true);
      expect(hasD2GameVaHit(sliceAttackHits, 0x6fcc0830)).toBe(true);

      m.set(pSnapPlayer, D2UnitStrc.dwAnimMode, origMode);
      beginVaTrace113c();
      expect(
        PLAYER_StartModeOnUnit113c(
          m,
          pGame,
          pSnapPlayer,
          pSnapTarget,
          PLRMODE_CAST,
          0,
          0,
          1,
          0,
          {
            onStartAttackOnUnit(mem, pg, plr, tgt, mode) {
              PLAYER_StartCastSkillOnUnitK3_113c(mem, pg, plr, mode, tgt);
            },
          },
        ),
      ).toBe(1);
      const k3CastHits = endVaTrace113c();
      expect(hasD2GameVaHit(k3CastHits, 0x6fc98430)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fc987c0)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fcfa750)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fcfff10)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fd00750)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fcff7b0)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fd007a0)).toBe(true);
      expect(hasD2GameVaHit(k3CastHits, 0x6fcc0830)).toBe(true);

      // Dead player on 0x30/0x32/0x38/0x49 -> returns 0 with zero handler hits
      m.set(pSnapPlayer, D2UnitStrc.dwAnimMode, PLRMODE_DEAD);
      for (const [op, va, pkt] of k4Cases.slice(0, 4)) {
        m.loadBlock(pBuf, pkt);
        beginVaTrace113c();
        expect(
          C2S_DispatchFromMem113c(m, pGame, pBuf, pkt.length),
          `dead op 0x${op.toString(16)}`,
        ).toBe(0);
        expect(hasD2GameVaHit(endVaTrace113c(), va), `dead no-hit op 0x${op.toString(16)}`).toBe(
          false,
        );
      }
      m.set(pSnapPlayer, D2UnitStrc.dwAnimMode, origMode);

      // Non-hydrated K0 fallback (pUnitData === 0): truncated 0x01 (len=2) returns 3
      const origUnitData = m.get(pSnapPlayer, D2UnitStrc.pUnitData);
      m.set(pSnapPlayer, D2UnitStrc.pUnitData, 0);
      m.loadBlock(pBuf, new Uint8Array([0x01, 0x00]));
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 2)).toBe(3);
      m.set(pSnapPlayer, D2UnitStrc.pUnitData, origUnitData);

      // Empty playerById (pPlayer === 0) + case 0 bypass 0x3C/0x14/0x15 -> returns 0, zero write to VA 0x00000080, zero crash
      expect(() => m.u32(0x00000080)).toThrow(/read of unloaded byte/);
      sliceWorld.playerById.clear();

      m.loadBlock(pBuf, new Uint8Array([0x3c, 0x00, 0x00, 0x00, 0x80, 0xff, 0xff, 0xff, 0xff]));
      beginVaTrace113c();
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 9)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcef480)).toBe(false);
      expect(() => m.u32(0x00000080)).toThrow(/read of unloaded byte/);

      m.loadBlock(pBuf, new Uint8Array([0x14, 0x00, 0x00, 0x68, 0x69, 0x00, 0x00, 0x00]));
      beginVaTrace113c();
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 8)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcf00a0)).toBe(false);

      m.loadBlock(pBuf, new Uint8Array([0x15, 0x01, 0x00, 0x68, 0x69, 0x00, 0x00, 0x00]));
      beginVaTrace113c();
      expect(C2S_DispatchFromMem113c(m, pGame, pBuf, 8)).toBe(0);
      expect(hasD2GameVaHit(endVaTrace113c(), 0x6fcedbb0)).toBe(false);
      expect(() => m.u32(0x00000080)).toThrow(/read of unloaded byte/);
    });
  });
});
