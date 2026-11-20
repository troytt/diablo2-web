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
  C2S_DispatchPacketMem113c,
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
  D2UnitStrc,
  D2UnitStrc_SIZE,
  DRLGPRESET_MovePointerAndClear113c,
  PLRMODE_ATTACK1,
  PLRMODE_CAST,
  PLRMODE_NEUTRAL,
  PLRMODE_RUN,
  PLRMODE_WALK,
  SGPT_DATA_TABLES_PTR_VA_6FDE9E1C,
  SparseMemory113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetOctileDistanceToCoordinates113c,
} from '../../../src/d2kern-113c/index.ts';
import { D2COMMON_GDWBITMASKS_IAT_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';

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

    it('contains all 103 entries (0x00..0x66) in C2S_PACKET_TABLE_6FD1A078_113C matching D2Game.dll', () => {
      expect(C2S_PACKET_TABLE_6FD1A078_113C).toHaveLength(103);
      expect(C2S_PACKET_TABLE_6FD1A078_113C[0x01]).toEqual({
        opcode: 0x01,
        handlerVa: 0x6fcee0d0,
        packetSize: 5,
        handler2Va: 0,
      });
      expect(C2S_PACKET_TABLE_6FD1A078_113C[0x03]).toEqual({
        opcode: 0x03,
        handlerVa: 0x6fcee040,
        packetSize: 5,
        handler2Va: 0,
      });
      expect(C2S_PACKET_TABLE_6FD1A078_113C[0x3c]).toEqual({
        opcode: 0x3c,
        handlerVa: 0x6fcef480,
        packetSize: 9,
        handler2Va: 0,
      });
      expect(C2S_PACKET_TABLE_6FD1A078_113C[0x5f]).toEqual({
        opcode: 0x5f,
        handlerVa: 0x6fcf0790,
        packetSize: 5,
        handler2Va: 0,
      });
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
  });
});
