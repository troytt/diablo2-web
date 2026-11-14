import { describe, expect, it } from 'vitest';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';
import {
  D2GAME_PACKET_SendStatByteWordDword113c,
  D2GAME_PACKET_SendUnitStop113c,
  D2GAME_PACKET_SendPlayerPartyRelationship113c,
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PACKET_Send0x73MissileSync113c,
  D2GAME_PACKET_Send0x5BPlayerInGame113c,
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_SUMMON_BroadcastPlayerPetsToClient113c,
  D2GAME_INVENTORY_DestroyUnitInventoryItems113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_SyncUnitStateToClient113c,
  D2GAME_SUNIT_SyncRoomUnitsToClient113c,
  D2GAME_MONSTER_ApplyMercStatsOnOwner113c,
  D2GAME_MONSTER_HasComponentChoices113c,
  D2GAME_PACKET_Send0x65PlayerKillCount113c,
  D2GAME_ARENA_ClearPlayerArenaFlags113c,
  D2GAME_ARENA_BroadcastKillCountsToClients113c,
  D2GAME_ARENA_SyncClientKillCountsOnJoin113c,
  D2GAME_ARENA_SyncArenaJoinState113c,
  D2GAME_PLRMODES_SendClientWhisperAdapter113c,
  D2GAME_PLRMODES_DispatchModeSyncToClient113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_PLRMODES_Send0x0DPlayerStop113c,
  D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c,
  D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c,
  D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_ITEMSTAT_OnStatChangedCallback113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
  D2GAME_PARTY_Send0x8BPartyRelationStatus113c,
  D2GAME_PARTY_SetPlayerRelationState113c,
  D2GAME_PARTY_EnsurePlayerRelationNode113c,
  D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
  D2GAME_MONSTER_SendMonsterMovementSync113c,
  D2GAME_MONSTER_SyncMonsterUnitToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-b-113c.ts';

describe('K1R14-LaneJ3: D2Game.dll Boot/Init Coverage Gap Closure Part B (37 VAs)', () => {
  it('verifies packet builders 0x6FCABD00..0x6FCAE170', () => {
    const mem = new SparseMemory113c();
    const sent: Array<{ pClient: number; pkt: Uint8Array }> = [];
    const callees = {
      sendPacketToClient: (_m: unknown, pClient: number, packet: Uint8Array) => {
        sent.push({ pClient, pkt: new Uint8Array(packet) });
      },
    };

    // 1. 0x6FCABD00: D2GAME_PACKET_SendStatByteWordDword113c
    D2GAME_PACKET_SendStatByteWordDword113c(mem, 0x1000, 0x07, 42, callees);
    expect(sent[0]?.pkt).toEqual(new Uint8Array([0x1d, 0x07, 42]));

    D2GAME_PACKET_SendStatByteWordDword113c(mem, 0x1000, 0x0c, 0x1234, callees);
    expect(sent[1]?.pkt).toEqual(new Uint8Array([0x1e, 0x0c, 0x34, 0x12]));

    D2GAME_PACKET_SendStatByteWordDword113c(mem, 0x1000, 0x0d, 0x12345678, callees);
    expect(sent[2]?.pkt).toEqual(new Uint8Array([0x1f, 0x0d, 0x78, 0x56, 0x34, 0x12]));

    // 2. 0x6FCABFC0: D2GAME_PACKET_SendUnitStop113c (0x6D, 10 bytes)
    sent.length = 0;
    D2GAME_PACKET_SendUnitStop113c(mem, 0x1000, 0xdeadbeef, 100, 200, 0x33, callees);
    expect(sent[0]?.pkt.length).toBe(10);
    expect(sent[0]?.pkt[0]).toBe(0x6d);
    expect(sent[0]?.pkt[9]).toBe(0x33);

    // 3. 0x6FCAC570: D2GAME_PACKET_SendPlayerPartyRelationship113c (0x8D, 7 bytes)
    sent.length = 0;
    const pTarget = mem.alloc(0x100);
    const pDest = mem.alloc(0x100);
    const pDestData = mem.alloc(0x100);
    mem.setU32(pTarget + 0x00, 0);
    mem.setU32(pTarget + 0x0c, 99);
    mem.setU32(pDest + 0x00, 0);
    mem.setU32(pDest + 0x14, pDestData);
    mem.setU32(pDestData + 0x9c, 0x1000);
    D2GAME_PACKET_SendPlayerPartyRelationship113c(mem, pTarget, pDest, callees);
    expect(sent[0]?.pkt.length).toBe(7);
    expect(sent[0]?.pkt[0]).toBe(0x8d);
    expect(sent[0]?.pkt[1]).toBe(99);

    // 4. 0x6FCACA20: D2GAME_PACKET_SendMonsterAssign113c (0xAC)
    sent.length = 0;
    const pMonster = mem.alloc(0x100);
    const pMonsterData = mem.alloc(0x100);
    mem.setU32(pMonster + 0x00, 1); // UNIT_MONSTER
    mem.setU32(pMonster + 0x04, 5); // wClassId = 5
    mem.setU32(pMonster + 0x0c, 0x11223344); // dwUnitId
    mem.setU32(pMonster + 0x10, 1); // eAnimMode = 1
    mem.setU32(pMonster + 0x14, pMonsterData);
    D2GAME_PACKET_SendMonsterAssign113c(mem, pMonster, 0x1000, 0, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.pkt[0]).toBe(0xac);

    // 5. 0x6FCAD670: D2GAME_PACKET_Send0x73MissileSync113c (14 bytes)
    sent.length = 0;
    const pClient = mem.alloc(0x500);
    const pGame = mem.alloc(0x2000);
    mem.setU32(pClient + 0x1a8, pGame);
    mem.setU32(pGame + 0x1320 + (0x44 & 0x7f) * 4, pMonster);
    D2GAME_PACKET_Send0x73MissileSync113c(
      mem,
      pClient,
      1,
      0x11223344,
      0x73,
      5000,
      5100,
      0x0200,
      10,
      20,
      callees,
    );
    expect(sent[0]?.pkt.length).toBe(14);
    expect(sent[0]?.pkt[0]).toBe(0x73);

    // 6. 0x6FCAE170: D2GAME_PACKET_Send0x5BPlayerInGame113c
    sent.length = 0;
    const pPlayer = mem.alloc(0x100);
    const pPlayerData = mem.alloc(0x100);
    mem.setU32(pPlayer + 0x00, 0); // UNIT_PLAYER
    mem.setU32(pPlayer + 0x04, 3); // Paladin
    mem.setU32(pPlayer + 0x0c, 77); // dwUnitId
    mem.setU32(pPlayer + 0x14, pPlayerData);
    mem.setU8(pPlayerData + 0, 0x48); // 'H'
    mem.setU8(pPlayerData + 1, 0x00);
    D2GAME_PACKET_Send0x5BPlayerInGame113c(mem, pPlayer, 0, pClient, 0, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.pkt[0]).toBe(0x5b);
    expect(sent[0]?.pkt[8]).toBe(0x48);
  });

  it('verifies arena, summon, inventory, party, and unit sync functions 0x6FCAF5C0..0x6FCD2D90', () => {
    const mem = new SparseMemory113c();
    const sent: Uint8Array[] = [];
    const callees = {
      sendPacketToClient: (_m: unknown, _pClient: number, packet: Uint8Array) => {
        sent.push(new Uint8Array(packet));
      },
    };

    // 7. 0x6FCAF5C0: D2GAME_ARENA_FindPlayerSlotByUnit113c
    const pGame = mem.alloc(0x2000);
    const pArena = mem.alloc(0x100);
    const pTable = mem.alloc(0x40 * 0x44);
    const pOutIndex = mem.alloc(4);
    const pMatchUnit = mem.alloc(0x100);
    mem.setU32(pGame + 0x1d24, pArena);
    mem.setU32(pArena + 4, pTable);
    mem.setU32(pTable + 3 * 0x44, pMatchUnit);
    expect(D2GAME_ARENA_FindPlayerSlotByUnit113c(mem, pOutIndex, pGame, pMatchUnit)).toBe(
      pTable + 3 * 0x44,
    );
    expect(mem.u32(pOutIndex)).toBe(3);

    // 8. 0x6FCB6920: D2GAME_SUMMON_BroadcastPlayerPetsToClient113c
    const pPlayer = mem.alloc(0x100);
    const pPlayerData = mem.alloc(0x100);
    const pPlayerPets = mem.alloc(0x20);
    const pPetArray = mem.alloc(0x40);
    const pPetNode = mem.alloc(0x20);
    const pMonUnit = mem.alloc(0x100);
    const sgptPtr = mem.alloc(4);
    const pDataTables = mem.alloc(0xd00);
    mem.setU32(sgptPtr, pDataTables);
    mem.setU32(pDataTables + 0xbf0, 2); // 2 pet types
    mem.setU32(pPlayer + 0x00, 0);
    mem.setU32(pPlayer + 0x0c, 10);
    mem.setU32(pPlayer + 0x14, pPlayerData);
    mem.setU32(pPlayer + 0x80, pGame);
    mem.setU32(pPlayerData + 0x44, pPlayerPets);
    mem.setU32(pPlayerPets, pPetArray);
    mem.setU32(pPetArray + 1 * 12, pPetNode);
    mem.setU8(pPetNode, 0);
    mem.setU32(pPetNode + 4, 42); // dwPetGuid = 42
    mem.setU32(pGame + 0x1320 + (42 & 0x7f) * 4, pMonUnit);
    mem.setU32(pMonUnit + 0x04, 338);
    mem.setU32(pMonUnit + 0x0c, 42);
    const pDestClient = mem.alloc(0x500);
    D2GAME_SUMMON_BroadcastPlayerPetsToClient113c(mem, pPlayer, pDestClient, sgptPtr, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x7a);

    // 9. 0x6FCBB3B0: D2GAME_INVENTORY_DestroyUnitInventoryItems113c
    const pInv = mem.alloc(0x40);
    mem.setU32(pInv + 0x00, 0x10203040); // signature
    mem.setU32(pPlayer + 0x60, pInv);
    D2GAME_INVENTORY_DestroyUnitInventoryItems113c(mem, pPlayer, pGame, callees);
    expect((mem.u32(pPlayer + 0xc4) >>> 6) & 1).toBe(0);

    // 10. 0x6FCBBEB0: D2GAME_PARTY_GetPartyIdForUnit113c
    const pPartyCtrl = mem.alloc(0x20);
    const pParty = mem.alloc(0x20);
    const pMember = mem.alloc(0x10);
    mem.setU32(pGame + 0x1d2c, pPartyCtrl);
    mem.setU32(pPartyCtrl + 4, pParty);
    mem.setU16(pParty, 5);
    mem.setU32(pParty + 4, pMember);
    mem.setU32(pMember, 10); // matches pPlayer guid 10
    expect(D2GAME_PARTY_GetPartyIdForUnit113c(mem, pPlayer, pGame)).toBe(5);

    // 11. 0x6FCBDCD0: D2GAME_SUNIT_SyncUnitStateToClient113c
    let syncedPlayer = 0;
    D2GAME_SUNIT_SyncUnitStateToClient113c(mem, pDestClient, pGame, pPlayer, {
      syncPlayerUnitToClient: (_m, pU) => {
        syncedPlayer = pU;
      },
    });
    expect(syncedPlayer).toBe(pPlayer);

    // 12. 0x6FCBDE10: D2GAME_SUNIT_SyncRoomUnitsToClient113c
    const pRoom = mem.alloc(0x100);
    mem.setU32(pRoom + 0x1c, pPlayer);
    mem.setU32(pPlayer + 0xe0, 0);
    let roomSynced = 0;
    D2GAME_SUNIT_SyncRoomUnitsToClient113c(mem, pRoom, pDestClient, pGame, {
      syncPlayerUnitToClient: (_m, pU) => {
        roomSynced = pU;
      },
    });
    expect(roomSynced).toBe(pPlayer);

    // 13. 0x6FCBF2B0: D2GAME_MONSTER_ApplyMercStatsOnOwner113c
    const pMerc = mem.alloc(0x100);
    const pMercMonData = mem.alloc(0x100);
    const pAiGen = mem.alloc(0x50);
    const pMonStatsTxt = mem.alloc(0x200);
    mem.setU32(pMerc + 0x00, 1);
    mem.setU32(pMerc + 0x04, 0);
    mem.setU32(pMerc + 0x14, pMercMonData);
    mem.setU32(pMercMonData + 0x28, pAiGen);
    mem.setU32(pAiGen + 0x28, pGame);
    mem.setU32(pAiGen + 0x2c, 10);
    mem.setU32(pAiGen + 0x30, 0);
    mem.setU32(pGame + 0x1120 + (10 & 0x7f) * 4, pPlayer);
    mem.setU32(pDataTables + 0xa80, 10);
    mem.setU32(pDataTables + 0xa78, pMonStatsTxt);
    mem.setU16(pMonStatsTxt + 0xa8, 7);
    mem.setU32(pDataTables + 0xba0, 20);
    let mercBonusStat = 0;
    D2GAME_MONSTER_ApplyMercStatsOnOwner113c(mem, pMerc, 1, sgptPtr, {
      onApplyMercStatBonus: (_m, _owner, statIdx) => {
        mercBonusStat = statIdx;
      },
    });
    expect(mercBonusStat).toBe(7);

    // 14. 0x6FCCF610: D2GAME_MONSTER_HasComponentChoices113c
    mem.setU8(pMercMonData + 4, 1);
    expect(D2GAME_MONSTER_HasComponentChoices113c(mem, pMerc)).toBe(1);

    // 15. 0x6FCD2760: D2GAME_PACKET_Send0x65PlayerKillCount113c
    const pArenaUnit = mem.alloc(0x10);
    mem.setU32(pPlayerData + 0x34, pArenaUnit);
    mem.setU16(pArenaUnit, 0x1234);
    mem.setU32(pArenaUnit + 4, 1);
    sent.length = 0;
    D2GAME_PACKET_Send0x65PlayerKillCount113c(mem, pPlayer, pDestClient, callees);
    expect(sent[0]).toEqual(new Uint8Array([0x65, 10, 0, 0, 0, 0x34, 0x12]));

    // 16. 0x6FCD27D0: D2GAME_ARENA_ClearPlayerArenaFlags113c
    D2GAME_ARENA_ClearPlayerArenaFlags113c(mem, pPlayer);
    expect(mem.u32(pArenaUnit + 4)).toBe(0);

    // 17. 0x6FCD2C20: D2GAME_ARENA_BroadcastKillCountsToClients113c
    // 18. 0x6FCD2D40: D2GAME_ARENA_SyncClientKillCountsOnJoin113c
    // 19. 0x6FCD2D90: D2GAME_ARENA_SyncArenaJoinState113c
    mem.setU32(pGame + 0x88, pDestClient);
    mem.setU32(pDestClient + 4, 4);
    mem.setU8(pDestClient + 0x3d4, 5);
    mem.setU32(pDestClient + 0x174, pPlayer);
    const pArenaCtrl = mem.alloc(0x20);
    mem.setU32(pGame + 0x1d28, pArenaCtrl);
    mem.setU32(pArenaCtrl + 8, 0x400);
    mem.setU32(pArenaUnit + 4, 1);
    sent.length = 0;
    D2GAME_ARENA_BroadcastKillCountsToClients113c(mem, pGame, pDestClient, 1, callees);
    D2GAME_ARENA_SyncClientKillCountsOnJoin113c(mem, pGame, pDestClient, callees);
    D2GAME_ARENA_SyncArenaJoinState113c(mem, pGame, pDestClient, {
      ...callees,
      getSpecialUnit: () => pPlayer,
    });
    expect(sent.length).toBeGreaterThanOrEqual(2);
    expect(sent[0]?.[0]).toBe(0x65);
  });

  it('verifies plrmodes, items, itemstat, sunit, party, and monster sync 0x6FCEB570..0x6FD13A40', () => {
    const mem = new SparseMemory113c();
    const sent: Uint8Array[] = [];
    const callees = {
      sendPacketToClient: (_m: unknown, _pClient: number, packet: Uint8Array) => {
        sent.push(new Uint8Array(packet));
      },
    };

    // 20. 0x6FCEB570: D2GAME_PLRMODES_SendClientWhisperAdapter113c
    const pClient = mem.alloc(0x500);
    const pTargetClient = mem.alloc(0x500);
    mem.setU8(pTargetClient + 8, 0x41); // 'A'
    mem.setU8(pTargetClient + 9, 0);
    D2GAME_PLRMODES_SendClientWhisperAdapter113c(mem, pClient, pTargetClient, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x5a);

    // 21. 0x6FCEB8F0: D2GAME_PLRMODES_DispatchModeSyncToClient113c
    const pGame = mem.alloc(0x2000);
    const pUnit1 = mem.alloc(0x100);
    const pUnit2 = mem.alloc(0x100);
    mem.setU32(pUnit1 + 0x00, 0);
    mem.setU32(pUnit1 + 0x0c, 101);
    mem.setU32(pUnit1 + 0x10, 1); // mode 1 -> handlerKind 2 -> Send0x0DPlayerStop
    mem.setU8(pClient + 0x3d4, 1);
    mem.setU32(pClient + 0x174, pUnit2);
    sent.length = 0;
    D2GAME_PLRMODES_DispatchModeSyncToClient113c(mem, pUnit1, pGame, pClient, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x0d);

    // 22. 0x6FCEBDB0: D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c
    mem.setU32(pGame + 0x88, pClient);
    mem.setU32(pClient + 4, 4);
    mem.setU32(pClient + 0x4a8, 0);
    sent.length = 0;
    D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(mem, pTargetClient, pGame, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x5a);

    // 23. 0x6FCEC2F0: D2GAME_PLRMODES_SendStatToClientOrParty113c
    const pPlayerData1 = mem.alloc(0x100);
    mem.setU32(pUnit1 + 0x14, pPlayerData1);
    mem.setU32(pPlayerData1 + 0x9c, pClient);
    sent.length = 0;
    D2GAME_PLRMODES_SendStatToClientOrParty113c(mem, pUnit1, 7, pUnit1, 100, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x1d);

    // 24. 0x6FCED190: D2GAME_PLRMODES_Send0x0DPlayerStop113c
    sent.length = 0;
    D2GAME_PLRMODES_Send0x0DPlayerStop113c(mem, pUnit1, pClient, 1, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x0d);

    // 25. 0x6FCF1830: D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c
    expect(D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c(mem, pUnit1, 0)).toBe(0);

    // 26. 0x6FCF1890: D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c
    // 27. 0x6FCF1ED0: D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c
    const pSkills = mem.alloc(0x20);
    mem.setU32(pUnit1 + 0xa8, pSkills);
    const pSnapshot = mem.alloc(0x20);
    D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(mem, pUnit1, pSnapshot);
    expect(mem.u32(pSnapshot + 0x18)).toBe(0xffffffff);
    expect(mem.u32(pSnapshot + 0x14)).toBe(0xffffffff);
    D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(mem, pUnit1, pSnapshot, callees);

    // 28. 0x6FCF51A0: D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c
    const pInv = mem.alloc(0x40);
    mem.setU32(pInv + 0x00, 0x10203040);
    mem.setU32(pUnit1 + 0x60, pInv);
    sent.length = 0;
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(mem, pGame, pUnit1, 1, callees);
    expect(sent.length).toBe(1);
    expect(sent[0]?.[0]).toBe(0x48);

    // 29. 0x6FCF9470: D2GAME_ITEMSTAT_OnStatChangedCallback113c
    const sgptPtr = mem.alloc(4);
    const pDataTables = mem.alloc(0xd00);
    const pItemStatCostTxt = mem.alloc(200 * 0x144);
    mem.setU32(sgptPtr, pDataTables);
    mem.setU32(pDataTables + 0xbd4, 200);
    mem.setU32(pDataTables + 0xbcc, pItemStatCostTxt);
    let refreshedSkills = 0;
    D2GAME_ITEMSTAT_OnStatChangedCallback113c(
      mem,
      pGame,
      pUnit1,
      0,
      (126 << 16) >>> 0,
      0,
      1,
      sgptPtr,
      {
        refreshAllUnitSkills: () => {
          refreshedSkills = 1;
        },
      },
    );
    expect(refreshedSkills).toBe(1);

    // 30. 0x6FCFF780: D2GAME_SUNIT_GetGameFromUnit113c
    mem.setU32(pUnit1 + 0x80, pGame);
    expect(D2GAME_SUNIT_GetGameFromUnit113c(mem, pUnit1)).toBe(pGame);

    // 31. 0x6FCFFC10: D2GAME_SUNIT_IterateAllLivingPlayers113c
    mem.setU32(pGame + 0x1120, pUnit1);
    const visited: number[] = [];
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      mem,
      pGame,
      (_m, _g, pPlr) => {
        visited.push(pPlr);
      },
      0,
    );
    expect(visited).toEqual([pUnit1]);

    // 32. 0x6FD10130: D2GAME_PARTY_Send0x8BPartyRelationStatus113c
    // 33. 0x6FD10220: D2GAME_PARTY_SetPlayerRelationState113c
    // 34. 0x6FD102F0: D2GAME_PARTY_EnsurePlayerRelationNode113c
    // 35. 0x6FD10480: D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c
    const pPlayerData2 = mem.alloc(0x100);
    mem.setU32(pUnit2 + 0x00, 0);
    mem.setU32(pUnit2 + 0x0c, 202);
    mem.setU32(pUnit2 + 0x14, pPlayerData2);
    mem.setU32(pPlayerData2 + 0x9c, pClient);
    D2GAME_PARTY_EnsurePlayerRelationNode113c(mem, pUnit1, pUnit2, pGame);
    D2GAME_PARTY_SetPlayerRelationState113c(mem, pUnit2, pUnit1, 2);
    sent.length = 0;
    D2GAME_PARTY_Send0x8BPartyRelationStatus113c(mem, pUnit1, pUnit2, callees);
    expect(sent[0]?.[0]).toBe(0x8b);
    expect(sent[0]?.[5]).toBe(2);

    D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c(mem, pGame, pUnit1, pUnit2, callees);

    // 36. 0x6FD135C0: D2GAME_MONSTER_SendMonsterMovementSync113c
    // 37. 0x6FD13A40: D2GAME_MONSTER_SyncMonsterUnitToClient113c
    const pMonster = mem.alloc(0x100);
    const pMonData = mem.alloc(0x100);
    const pMonPath = mem.alloc(0x100);
    mem.setU32(pMonster + 0x00, 1);
    mem.setU32(pMonster + 0x04, 10);
    mem.setU32(pMonster + 0x0c, 555);
    mem.setU32(pMonster + 0x10, 1);
    mem.setU32(pMonster + 0x14, pMonData);
    mem.setU32(pMonster + 0x2c, pMonPath);
    mem.setU32(pMonster + 0x80, pGame);
    mem.setU32(pMonster + 0xc4, 1);
    mem.setU8(pMonster + 0xca, 1);
    sent.length = 0;
    D2GAME_MONSTER_SyncMonsterUnitToClient113c(mem, pGame, pMonster, pClient, 0, callees);
    expect(sent.length).toBeGreaterThanOrEqual(2);
    expect(sent[0]?.[0]).toBe(0x15);
    expect(sent[1]?.[0]).toBe(0x6d);
  });
});
