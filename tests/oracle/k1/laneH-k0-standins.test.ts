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
      mem.setU32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C, pDataTables);

      mem.set(pGame, D2GameStrc.dwGameFrame, 100);
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

      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, npcX);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, npcY);
      mem.set(pNpcPath, D2DynamicPathStrc.pRoom, pRoom);

      mem.set(pMonsterData, D2MonsterDataStrc.pAiGeneral, pAiGeneral);

      return { pGame, pRoom, pRoomEx, pLevel, pNpc, pNpcPath, pMonsterData, pAiGeneral };
    }

    it('allocates and queries D2AiCmdStrc nodes by type and initializes home node 10', () => {
      const mem = new SparseMemory113c();
      const { pGame, pNpc, pNpcPath } = setupNpcFixture(mem, 5100, 5200, 1);

      expect(AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10)).toBe(0);
      const pCmd10 = AI_InitHomeNode10_113c(mem, pGame, pNpc);
      expect(pCmd10).toBeGreaterThan(0);
      expect(AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10)).toBe(pCmd10);
      expect(AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pNpc, 10)).toBe(pCmd10);

      expect(mem.get(pCmd10, D2AiCmdStrc.dwCmdType) | 0).toBe(10);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam1) | 0).toBe(5100);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam2) | 0).toBe(5200);
      expect(mem.get(pCmd10, D2AiCmdStrc.dwParam3) | 0).toBe(1);

      // Move NPC within leash (<= 15 octile distance): should not walk back
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5106);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, 5204);
      expect(UNITS_GetOctileDistanceToCoordinates113c(mem, pNpc, 5100, 5200)).toBe(8);
      expect(AI_CheckReturnHomeToNode10_113c(mem, pGame, pNpc, 0, 15)).toBe(0);

      // Move NPC outside leash (> 15 octile distance): walks back toward (5100, 5200)
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5130);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, 5220);
      expect(AI_CheckReturnHomeToNode10_113c(mem, pGame, pNpc, 0, 15)).toBe(1);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBe(5100);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetY)).toBe(5200);
    });

    it('steps DS1 D2MapAIStrc waypoint paths through actions 1..5 and wraps index cleanly', () => {
      const mem = new SparseMemory113c();
      const { pGame, pNpc, pNpcPath, pAiGeneral } = setupNpcFixture(mem, 5000, 5000, 1);

      // Build a source D2MapAIStrc table and move it via DRLGPRESET_MovePointerAndClear113c (0x6FD67780)
      const pSrcMapAi = mem.alloc(8);
      const pSrcActions = mem.alloc(3 * D2MapAiActionOffsets.SIZE);
      mem.setU32(pSrcMapAi + D2MapAiHeaderOffsets.nCurrentIndex, 0);
      mem.setU32(pSrcMapAi + D2MapAiHeaderOffsets.pPosition, pSrcActions);

      // Entry 0: (5010, 5000), action = 1 (walk to waypoint)
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nX, 5010);
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nY, 5000);
      mem.setU32(pSrcActions + 0 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nAction, 1);

      // Entry 1: (5012, 5002), action = 4 (walk and trigger mode 8)
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nX, 5012);
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nY, 5002);
      mem.setU32(pSrcActions + 1 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nAction, 4);

      // Entry 2: zero sentinel marking end of path
      mem.setU32(pSrcActions + 2 * D2MapAiActionOffsets.SIZE + D2MapAiActionOffsets.nAction, 0);

      const ppPresetSaveChain = mem.alloc(4);
      mem.setU32(ppPresetSaveChain, pSrcMapAi);
      const ppAiControl = (pAiGeneral + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0;
      DRLGPRESET_MovePointerAndClear113c(mem, ppPresetSaveChain, ppAiControl);
      const pMapAi = mem.u32(ppAiControl);
      expect(pMapAi).toBe(pSrcMapAi);
      expect(mem.u32(ppPresetSaveChain)).toBe(0);

      // Tick 1: NPC at (5000, 5000) is >3 subtiles from (5010, 5000) -> walks toward (5010, 5000)
      expect(AI_FollowDs1NpcPathMem113c(mem, pGame, pNpc, 0)).toBe(1);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBe(5010);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetY)).toBe(5000);
      expect(mem.u32(pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) | 0).toBe(0);

      // Place NPC within 3 subtiles of waypoint 0 (5009, 5000): advances to index 1
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5009);
      mem.set(pNpcPath, D2DynamicPathStrc.wPosY, 5000);
      expect(AI_FollowDs1NpcPathMem113c(mem, pGame, pNpc, 0)).toBe(1);
      expect(mem.u32(pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) | 0).toBe(1);

      // Tick continuation node 7 (20-frame wait queued during transition)
      expect(AI_TickNodes4_5_7_113c(mem, pGame, pNpc)).toBe(1);

      // Now at index 1 ((5012, 5002), action 4) within 3 subtiles -> triggers mode 8 (MONMODE_SKILL1)
      expect(AI_FollowDs1NpcPathMem113c(mem, pGame, pNpc, 0)).toBe(1);
      expect(mem.get(pNpc, D2UnitStrc.dwAnimMode)).toBe(8);

      // Next tick completes action 4, wraps index from 2 (sentinel) back to 0, and queues node 7 wait!
      AI_SimpleMapAiNpc113c(mem, pGame, pNpc, 0);
      expect(mem.u32(pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) | 0).toBe(0);

      // Tick the queued node 7 wait from the wrap transition, then verify direct calls to actions 1..5
      expect(AI_TickNodes4_5_7_113c(mem, pGame, pNpc)).toBe(1);
      expect(AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pNpc, 5009, 5000)).toBe(0);
      expect(AI_MapAiAction3_WalkToWaypoint113c(mem, pGame, pNpc, 5009, 5000)).toBe(0);
      expect(AI_MapAiAction2_WalkAndWait20_113c(mem, pGame, pNpc, 5009, 5000)).toBe(1);
      expect(AI_MapAiAction5_WalkAndMode9_113c(mem, pGame, pNpc, 5009, 5000)).toBe(1);
      expect(mem.get(pNpc, D2UnitStrc.dwAnimMode)).toBe(9);
      expect(AI_MapAiAction4_WalkAndMode8_113c(mem, pGame, pNpc, 5009, 5000)).toBe(1);
    });

    it('runs AI_WarrivGreetMem113c and AI_TownNpcMem113c against an in-room player unit', () => {
      const mem = new SparseMemory113c();
      const { pGame, pRoom, pNpc, pNpcPath } = setupNpcFixture(mem, 5100, 5100, 1);

      // Add a living player in the same room at (5110, 5100)
      const pPlayer = mem.alloc(D2UnitStrc_SIZE);
      const pPlayerPath = mem.alloc(D2DynamicPathStrc_SIZE);
      mem.set(pPlayer, D2UnitStrc.dwUnitType, UNIT_PLAYER);
      mem.set(pPlayer, D2UnitStrc.dwUnitId, 1);
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.set(pPlayer, D2UnitStrc.pPath, pPlayerPath);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5110);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5100);
      mem.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom);

      // Link pPlayer -> pNpc in pRoom->pUnitFirst
      mem.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pPlayer);
      mem.set(pPlayer, D2UnitStrc.pRoomUnitNext, pNpc);

      expect(AI_FindNearestPlayerTarget113c(mem, pGame, pNpc)).toBe(pPlayer);

      // First Warriv tick: distance is >= 4 && < 25, so Warriv steps (dist - 2) toward player
      AI_WarrivGreetMem113c(mem, pGame, pNpc, 0);
      const pCmd8 = AIGENERAL_FindAiCommandByType113c(mem, pNpc, 8);
      expect(pCmd8).toBeGreaterThan(0);
      expect(mem.get(pCmd8, D2AiCmdStrc.dwParam1) | 0).toBe(0);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBeGreaterThan(5100);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetY)).toBe(5100);

      // Move Warriv to same subtile as player (dist < 4): sets node 8 greeted flag = 1 and idles 10 frames
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5110);
      AI_WarrivGreetMem113c(mem, pGame, pNpc, 0);
      expect(mem.get(pCmd8, D2AiCmdStrc.dwParam1) | 0).toBe(1);
      expect(mem.get(pNpc, D2UnitStrc.dwAnimMode)).toBe(1);

      // Subsequent tick delegates to AI_TownNpcMem113c and initializes home node 10
      AI_WarrivGreetMem113c(mem, pGame, pNpc, 0);
      expect(AIGENERAL_FindAiCommandByType113c(mem, pNpc, 10)).toBeGreaterThan(0);
      AI_TownNpcMem113c(mem, pGame, pNpc, 0);

      // Also verify AI_StepRelativeToTargetUnit113c away from player (bMoveToward = 0)
      mem.set(pNpcPath, D2DynamicPathStrc.wPosX, 5108);
      expect(AI_StepRelativeToTargetUnit113c(mem, pGame, pNpc, pPlayer, 4, 0)).toBe(1);
      expect(mem.get(pNpcPath, D2DynamicPathStrc.wTargetX)).toBe(5104);
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
      const pPlayerPath = mem.alloc(D2DynamicPathStrc_SIZE);
      const pSkillList = mem.alloc(D2SkillListStrc_SIZE);
      const pLeftSkill = mem.alloc(D2SkillStrc_SIZE);
      const pRightSkill = mem.alloc(D2SkillStrc_SIZE);
      const pLeftSkillsTxt = mem.alloc(D2SkillsTxt_SIZE);
      const pRightSkillsTxt = mem.alloc(D2SkillsTxt_SIZE);
      const pMonster = mem.alloc(D2UnitStrc_SIZE);
      const pMonsterPath = mem.alloc(D2DynamicPathStrc_SIZE);
      const pPacket = mem.alloc(32);

      mem.set(pGame, D2GameStrc.dwGameFrame, 50);
      mem.setU32(pClient + D2ClientStrcOffsets.dwClientState, 4); // CLIENTSTATE_INGAME = 4
      mem.setU32(pClient + D2ClientStrcOffsets.pPlayer, pPlayer);

      mem.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx);
      mem.set(pRoomEx, D2RoomExStrc.pLevel, pLevel);
      mem.set(pLevel, D2DrlgLevelStrc.nLevelId, 2); // Blood Moor (non-town)
      mem.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pMonster);

      mem.set(pPlayer, D2UnitStrc.dwUnitType, UNIT_PLAYER);
      mem.set(pPlayer, D2UnitStrc.dwUnitId, 1);
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.set(pPlayer, D2UnitStrc.pPath, pPlayerPath);
      mem.set(pPlayer, D2UnitStrc.pSkills, pSkillList);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosX, 5000);
      mem.set(pPlayerPath, D2DynamicPathStrc.wPosY, 5000);
      mem.set(pPlayerPath, D2DynamicPathStrc.pRoom, pRoom);

      // Left skill = 0 (Attack), Right skill = 36 (Fire Bolt)
      mem.set(pLeftSkill, D2SkillStrc.pSkillsTxt, pLeftSkillsTxt);
      mem.set(pLeftSkillsTxt, D2SkillsTxt.wSkillId, 0);
      mem.set(pLeftSkill, D2SkillStrc.nOwnerItemGuid, 0xffffffff);
      mem.set(pRightSkill, D2SkillStrc.pSkillsTxt, pRightSkillsTxt);
      mem.set(pRightSkillsTxt, D2SkillsTxt.wSkillId, 36);
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

      // 0x01 WalkToLocation (5020, 5025)
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

      // 0x0B Noop 1-byte
      mem.setU8(pPacket + 0, 0x0b);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 1)).toBe(1);
      expect(C2S_Packet0B_Noop1Byte113c()).toBe(1);

      // 0x5F UpdatePlayerPos
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_NEUTRAL);
      mem.setU8(pPacket + 0, 0x5f);
      mem.setU16(pPacket + 1, 5004);
      mem.setU16(pPacket + 3, 5006);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetX)).toBe(5004);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.wTargetY)).toBe(5006);

      // Direct calls to 0x01..0x04 and 0x5F
      expect(C2S_Packet01_WalkToLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      expect(C2S_Packet03_RunToLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      expect(C2S_Packet5F_UpdatePlayerPos113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_Packet02_WalkToUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet04_RunToUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
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
      mem.setU8(pPacket + 0, 0x0c);
      mem.setU16(pPacket + 1, 5015);
      mem.setU16(pPacket + 3, 5010);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 5)).toBe(5);
      expect(mem.get(pPlayer, D2UnitStrc.dwAnimMode)).toBe(PLRMODE_CAST);
      expect(mem.get(pSkillList, D2SkillListStrc.pUsedSkill)).toBe(pRightSkill);

      // 0x08 RepeatLeftSkillOnLocation & 0x0F RepeatRightSkillOnLocation
      expect(C2S_Packet08_RepeatLeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      expect(C2S_Packet0F_RepeatRightSkillOnLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      expect(C2S_Packet05_LeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);
      expect(C2S_Packet0C_RightSkillOnLocation113c(mem, pGame, pPlayer, pPacket)).toBe(5);

      // Unit-targeted skill opcodes 0x06, 0x07, 0x09, 0x0A, 0x0D, 0x0E, 0x10, 0x11
      mem.setU8(pPacket + 0, 0x06);
      mem.setU32(pPacket + 1, UNIT_MONSTER);
      mem.setU32(pPacket + 5, 42);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pPlayerPath, D2DynamicPathStrc.pTargetUnit)).toBe(pMonster);
      expect(mem.get(pSkillList, D2SkillListStrc.pUsedSkill)).toBe(pLeftSkill);

      expect(C2S_Packet06_LeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet07_ShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet09_RepeatLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet0D_RightSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet0E_ShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet10_RepeatRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);
      expect(C2S_Packet11_RepeatShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket)).toBe(9);

      // 0x11 via dispatcher
      mem.setU8(pPacket + 0, 0x11);
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);

      // 0x3C SelectSkill: switch left skill to skill 36 (Fire Bolt)
      mem.setU8(pPacket + 0, 0x3c);
      mem.setU16(pPacket + 1, 36);
      mem.setU8(pPacket + 4, 1); // bLeft = 1
      mem.setU32(pPacket + 5, 0xffffffff); // dwItemId = -1
      expect(C2S_DispatchPacketMem113c(mem, pGame, pClient, pPacket, 9)).toBe(9);
      expect(mem.get(pSkillList, D2SkillListStrc.pLeftSkill)).toBe(pRightSkill);
      expect(C2S_Packet3C_SelectSkill113c(mem, pGame, pPlayer, pPacket)).toBe(9);

      // Verify distance guard (> 100 subtiles rejected) and dual-wield helper
      expect(C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, 5050, 5050, 100)).toBe(0);
      expect(C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, 5150, 5050, 100)).toBe(1);
      expect(C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, pLeftSkill)).toBe(pLeftSkill);
    });
  });
});
