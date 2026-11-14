import { describe, expect, it } from 'vitest';
import { Heap113c } from '../../../src/d2kern-113c/mem/heap.ts';
import { D2DynamicPathStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts';
import {
  UNITROOM_IsClientInUnitRoom113c,
  S2C_SendPacket0F_UnitWalkToTarget113c,
  SKILLS_CheckSkillManaAndCharges113c,
  SKILLS_ConsumeSkillManaOrCharge113c,
  SKILLS_ValidateSkillTargetAlignment113c,
  SKILLS_ExecuteSkillStart113c,
  SKILLS_StartUsedSkill113c,
  SKILLS_StartPlayerSkillAnimOrCast113c,
  C2S_BroadcastPlayerSkillOrAttackAction113c,
  SUNIT_CanPlayerTargetUnitWithSkill113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
  MONSTER_GetSuperUniqueId113c,
  QUESTS_OnMonsterKill113c,
  SUNIT_DispatchItemEventCallbacks113c,
  PLAYER_SetActiveDualWeaponStatLists113c,
  PLAYER_UpdateDualWieldWeaponStatLists113c,
  S2C_SendPacket0E_UnitCorpseState113c,
  SKILLS_ConsumeProgressiveChargesOnHit113c,
  SKILLS_ApplyProgressiveChargesToDamage113c,
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c,
  SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c,
  PARTY_CountLivingPartyMemberCallback113c,
  PARTY_ForEachPartyMemberInSameLevel113c,
  PARTY_CountLivingPartyMembersInSameLevel113c,
  SKILLS_SetSkillDelayTimer113c,
  SKILLS_ExecuteSkillDoFunc113c,
  SKILLS_DoUsedSkillAction113c,
  SrvDoFunc_001_Attack113c,
  MONSTER_DeleteAiAndRegenEvents113c,
  ARENA_GetPlayerArenaFlags113c,
  ARENA_ProcessKillScoreUpdate113c,
  MONSTER_IsNextModeEndWithin5Frames113c,
  S2C_SendPacket0D_UnitStop113c,
  ITEMS_SyncSocketedSubItemsToClient113c,
  S2C_SendPacket9C_ItemActionWorld113c,
  UNITROOM_SendDroppedGroundItemToClient113c,
  UNITROOM_BroadcastGroundItemIfUpdated113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c.ts';

describe('K1R14-LaneI2: D2Game.dll Post-F150 F786..F1040 (37 VAs)', () => {
  it('F786: UNITROOM_IsClientInUnitRoom113c & S2C_SendPacket0F_UnitWalkToTarget113c', () => {
    const m = new Heap113c(0x800000);
    const pUnit = 0x10000;
    const pPath = 0x10200;
    const pRoom = 0x10400;
    const pClientList = 0x10600;
    const pClient = 0x11000;
    const pGame = 0x12000;

    m.setU32(pUnit + 0x00, 1); // monster
    m.setU32(pUnit + 0x0c, 7);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU16(pPath + 0x02, 5100);
    m.setU16(pPath + 0x06, 5200);
    m.setU32(pPath + 0x1c, pRoom);
    m.set(pPath, D2DynamicPathStrc.dwPathType, 5); // pathType 5 -> 2
    m.set(pPath, D2DynamicPathStrc.nDistMax, 14); // maxDist
    m.setU32(pRoom + 0x48, pClientList);
    m.setU32(pRoom + 0x78, 2);
    m.setU32(pClientList + 0x00, 0x9999);
    m.setU32(pClientList + 0x04, pClient);

    expect(UNITROOM_IsClientInUnitRoom113c(m, pUnit, pClient)).toBe(1);
    expect(UNITROOM_IsClientInUnitRoom113c(m, pUnit, 0x8888)).toBe(0);

    m.setU32(pClient + 0x1a8, pGame);
    m.setU32(pGame + 0x1320 + ((7 & 0x7f) << 2), pUnit);
    S2C_SendPacket0F_UnitWalkToTarget113c(m, pClient, 7, 0x0f, 1, 0x01, 0x14601400, 0);
    expect(m.u32(pClient + 0x1b8)).toBe(0x15);
    expect(m.u32(pClient + 0x1bc)).toBe(1);
    expect(m.u8(pClient + 0x1c0 + 0x00)).toBe(0x0f);
    expect(m.u32(pClient + 0x1c0 + 0x01)).toBe(7);
    expect(m.u16(pClient + 0x1c0 + 0x06)).toBe(5100);
    expect(m.u16(pClient + 0x1c0 + 0x08)).toBe(5200);
    expect(m.u8(pClient + 0x1c0 + 0x11)).toBe(2);
    expect(m.u8(pClient + 0x1c0 + 0x14)).toBe(14);
  });

  it('F795: skill mana/charges, target alignment, start, and broadcast', () => {
    const m = new Heap113c(0x800000);
    const pPlayer = 0x20000;
    const pInfo = 0x20200;
    const pSkill = 0x20400;
    const pSkillsTxt = 0x20600;
    const pPath = 0x20800;

    m.setU32(pPlayer + 0x00, 0); // UNIT_PLAYER
    m.setU32(pPlayer + 0x2c, pPath);
    m.setU32(pPlayer + 0xa8, pInfo);
    m.setU32(pInfo + 0x10, pSkill);
    m.setU32(pSkill + 0x00, pSkillsTxt);
    m.setU32(pSkill + 0x34, 42); // ownerItemGuid != -1
    m.setU32(pSkill + 0x38, 3); // 3 charges

    expect(SKILLS_CheckSkillManaAndCharges113c(m, pPlayer)).toBe(1);
    m.setU32(pSkill + 0x38, 0);
    expect(SKILLS_CheckSkillManaAndCharges113c(m, pPlayer)).toBe(0);

    m.setU32(pSkill + 0x38, 2);
    expect(SKILLS_ConsumeSkillManaOrCharge113c(m, pPlayer, 0, 0x21000, 1)).toBe(1);
    expect((m.u32(pSkill + 0x38) | 0)).toBe(1);

    expect(SKILLS_ValidateSkillTargetAlignment113c(m, pPlayer, 0x21000, 0)).toBe(1);
    expect(SKILLS_ExecuteSkillStart113c(m, 0, 0, pPlayer, 1, 0)).toBe(0);
    m.setU32(pInfo + 0x10, 0);
    expect(SKILLS_StartUsedSkill113c(m, pPlayer, 0)).toBe(0);
    expect(SKILLS_StartPlayerSkillAnimOrCast113c(m, 0x21000, 0, 0, 1)).toBe(1);
    C2S_BroadcastPlayerSkillOrAttackAction113c(m, 0x21000, 0, 0, 0);
    expect(SUNIT_CanPlayerTargetUnitWithSkill113c(m, 0, 0, pPlayer, 0)).toBe(0);
    expect(SUNIT_AreUnitsHostileOrUnaligned113c(m, pPlayer, pPlayer, 0)).toBe(0);
  });

  it('F801: monster superunique, quest kill, item events, dual-wield, corpse packet, party, skills, and arena', () => {
    const m = new Heap113c(0x800000);
    const pMonster = 0x30000;
    const pMonData = 0x30200;
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pMonster + 0x14, pMonData);
    m.setU8(pMonData + 0x16, 0x02);
    m.setU16(pMonData + 0x26, 5);
    expect(MONSTER_GetSuperUniqueId113c(m, pMonster)).toBe(5);

    QUESTS_OnMonsterKill113c(m, 0, 0, pMonster);
    expect(SUNIT_DispatchItemEventCallbacks113c(m, pMonster, 0, 1, 0, 0)).toBe(0);
    PLAYER_SetActiveDualWeaponStatLists113c(m, 0, 0);
    PLAYER_UpdateDualWieldWeaponStatLists113c(m, 0, 0);

    const pClient = 0x31000;
    S2C_SendPacket0E_UnitCorpseState113c(m, 0x0e, 0x1234, pClient, 1, 100, 200, 1, 0);
    expect(m.u32(pClient + 0x1b8)).toBe(0x0c);
    expect(m.u8(pClient + 0x1c0)).toBe(0x0e);
    expect(m.u32(pClient + 0x1c0 + 2)).toBe(0x1234);

    SKILLS_ConsumeProgressiveChargesOnHit113c(m, 0, 0, 0);
    SKILLS_ApplyProgressiveChargesToDamage113c(m, 0, 0);
    SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(m, 0, 0);
    SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c(m, 0, 0, 0, 0);

    const pPlayer = 0x32000;
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x10, 1); // alive mode
    const countPtr = 0x32500;
    m.setU32(countPtr, 0);
    PARTY_CountLivingPartyMemberCallback113c(m, 0, pPlayer, countPtr);
    expect(m.u32(countPtr)).toBe(1);
    expect(PARTY_CountLivingPartyMembersInSameLevel113c(m, 0, pPlayer)).toBe(1);

    let visited = 0;
    PARTY_ForEachPartyMemberInSameLevel113c(
      m,
      pPlayer,
      0,
      () => {
        visited += 1;
      },
      0,
    );
    expect(visited).toBe(1);

    expect(SKILLS_SetSkillDelayTimer113c(m, -1, 0, pPlayer, 1, 0)).toBe(0);
    expect(SKILLS_ExecuteSkillDoFunc113c(m, 0, 0, 0, 1, 0, 0, 0)).toBe(0);
    expect(SKILLS_DoUsedSkillAction113c(m, pPlayer, 0)).toBe(0);
    expect(SrvDoFunc_001_Attack113c(m, 0, 0, 0, 1)).toBe(0);
    MONSTER_DeleteAiAndRegenEvents113c(m, 0, 0);

    const pPlrData = 0x32200;
    const pArena = 0x32300;
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x34, pArena);
    m.setU32(pArena + 0x04, 0xabcd);
    expect(ARENA_GetPlayerArenaFlags113c(m, pPlayer)).toBe(0xabcd);
    ARENA_ProcessKillScoreUpdate113c(m, 0, pPlayer, pMonster);
  });

  it('F810, F1032, and F1040: mode frame check, 0x0D packet, and ground item sync', () => {
    const m = new Heap113c(0x800000);
    const pGame = 0x40000;
    const pUnit = 0x40200;
    m.setU32(pGame + 0xa8, 100);
    expect(MONSTER_IsNextModeEndWithin5Frames113c(m, pUnit, pGame)).toBe(0);

    const pClient = 0x41000;
    S2C_SendPacket0D_UnitStop113c(m, 0x0d, 99, pClient, 1, 2, 0x006400c8, 80, 0x100, 0);
    expect(m.u32(pClient + 0x1b8)).toBe(0x10);
    expect(m.u8(pClient + 0x1c0 + 0x00)).toBe(0x0d);
    expect(m.u32(pClient + 0x1c0 + 0x02)).toBe(99);
    expect(m.u8(pClient + 0x1c0 + 0x0b)).toBe(80);

    expect(ITEMS_SyncSocketedSubItemsToClient113c(m, pClient, 0, 0)).toBe(1);
    S2C_SendPacket9C_ItemActionWorld113c(m, pClient, 0, 2, 0, 0);
    UNITROOM_SendDroppedGroundItemToClient113c(m, 0, pClient);
    UNITROOM_BroadcastGroundItemIfUpdated113c(m, 0, pClient);
  });
});
