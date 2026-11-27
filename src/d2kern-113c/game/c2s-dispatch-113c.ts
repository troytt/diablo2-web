/**
 * @file src/d2kern-113c/game/c2s-dispatch-113c.ts
 * Clean-room 1:1 binary port of `D2Game.dll:0x6FCEC550` (`C2S_Dispatch`), wiring all 91
 * non-null C2S packet handlers from `D2Game.dll:0x6FD1A078` (`C2S_PACKET_TABLE_6FD1A078_113C`)
 * strictly by exact DLL `handlerVa`.
 *
 * Acyclic leaf aggregator over the 21 handler modules in `src/d2kern-113c/game/`.
 * Pure `Memory113c` / `SparseMemory113c` runtime: zero legacy imports, zero wall-clock time,
 * strictly deterministic and strongly typed.
 */

import { C2S_PACKET_SIZES } from '../../netproto/index.ts';
import { UNITS_GetLeftSkill113c } from '../common/quest-record.ts';
import { SKILLS_AddSkillToUnit113c, SKILLS_GetSkillById113c } from '../common/skills.ts';
import { STATES_CheckState113c } from '../common/statlist.ts';
import { D2UnitStrc } from '../mem/layout.generated.ts';
import { SparseMemory113c, type Memory113c } from '../mem/sparse-memory.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';
import {
  C2S_PACKET_TABLE_6FD1A078_113C,
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
  D2ClientStrcOffsets,
  type C2SPacketCallees113c,
} from './c2s-packet-113c.ts';
import {
  PACKET_C2S2C_Reject3_113c,
  PACKET_C2S2D_Reject3_113c,
  PACKET_C2S2E_PlaySoundNoop113c,
  PACKET_C2S39_Reject3_113c,
  PACKET_C2S42_ClearCursorNoop113c,
  PACKET_C2S43_QuestInitNoop113c,
  PACKET_C2S45_Reject3_113c,
  PACKET_C2S4B_RequestUnitRefresh113c,
  PACKET_C2S52_Reject3_113c,
  PACKET_C2S58_MarkQuestIntroSeen113c,
  PACKET_C2S66_WardenResponseNoop113c,
} from './k2-combat-core-w1-113c.ts';
import { SKILLS_AssignHandSkillAndSyncAura113c } from './k2-gap-melee-dot-113c.ts';
import { isSgptDataTablesLoaded113c } from './k2-real-itemdrop-113c.ts';
import { PACKETS_SrvMercItemAction_6FCF0BC0_113c } from './k2-w10b1-113c.ts';
import {
  C2S_Packet35_NpcRepair_6FCEF0A0_113c,
  C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c,
} from './k2-w11b1-113c.ts';
import { C2S_Packet23_MercReviveHandler_6FCEFB90_113c } from './k2-w12b1-113c.ts';
import {
  D2Game_6FCEF0E0_113c,
  D2Game_6FCF08B0_113c,
  D2Game_6FCF0910_113c,
  D2Game_6FCF12E0_113c,
} from './k2-w13b1-113c.ts';
import {
  C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c,
  C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c,
  C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c,
  C2S_Packet32_NpcBuyItem_6FCEF570_113c,
  C2S_Packet49_WaypointInteract_6FCF0D30_113c,
  C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c,
} from './k2-w14b1-113c.ts';
import {
  C2S_Packet_DropCursorItem_6FCEF380_113c,
  C2S_Packet_HireMercenary_6FCF0060_113c,
  C2S_Packet_NpcBuyItem_6FCEF220_113c,
} from './k2-w15b1-113c.ts';
import {
  C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c,
  C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c,
  C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c,
  C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c,
  C2S_HandlePacket4F_TradeButton_6FCF1470_113c,
} from './k2-w16b1-113c.ts';
import {
  PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c,
  PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c,
  PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c,
} from './k2-w2b7-113c.ts';
import {
  PACKET_Recv12_ClearGfxState0C_6FCEB590_113c,
  PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c,
} from './k2-w2b8-113c.ts';
import {
  PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c,
  PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c,
  PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c,
  PACKET_Srv40_RequestQuestLog_6FCEBD30_113c,
} from './k2-w5b5-113c.ts';
import {
  C2S_Packet50_DropPlayerGold_6FCEEF40_113c,
  C2S_SyncObjectCollisionByGuid_6FCED440_113c,
} from './k2-w5b6-113c.ts';
import {
  PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c,
  PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c,
} from './k2-w5b7-113c.ts';
import {
  PACKET_SrvMercMoveToCoord_6FCED360_113c,
  PACKET_SrvMercMoveToUnit_6FCED3D0_113c,
} from './k2-w6b3-113c.ts';
import {
  C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c,
  C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c,
  C2S_ValidatePacket5ByteItem_6FCED4F0_113c,
} from './k2-w6b5-113c.ts';
import {
  C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c,
  C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c,
  C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c,
} from './k2-w6b6-113c.ts';
import { PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c } from './k2-w6b7-113c.ts';
import {
  C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c,
  C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c,
  C2S_Packet28_SocketItem_6FCEEBD0_113c,
  C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c,
  C2S_Packet30_CancelNpcInteract_6FCED480_113c,
  C2S_Packet34_CainIdentifyItems_6FCEF070_113c,
  C2S_Packet3A_AddStatPoint_6FCEC960_113c,
} from './k2-w7b4-113c.ts';
import {
  C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c,
  C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c,
  C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c,
  C2S_Packet20_UseInventoryItem_6FCEF730_113c,
  C2S_Packet21_MergeStackableItems_6FCEE4B0_113c,
  C2S_Packet26_UseBeltItem_6FCEF5B0_113c,
  C2S_Packet27_IdentifyItem_6FCEF6B0_113c,
  C2S_Packet60_SwapWeapons_6FCEF510_113c,
} from './k2-w8b3-113c.ts';
import {
  C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c,
  C2S_PacketUseQuestScrollItem_6FCED8D0_113c,
} from './k2-w9b2-113c.ts';
import { PLAYER_StartCastSkillOnUnitK3_113c } from './k3-p52-sorc-handlers-113c.ts';
import {
  applyNonHydratedSliceC2SFallbackK0_113c,
  buildSliceC2SCallees113c,
  ensureSliceWorldPathMemory113c,
  getK4ReplayKernelBridge113c,
  getOrHydrateSliceWorld113c,
  syncAndPruneSliceWorld113c,
} from './replay-kernel-113c.ts';

/** Dedicated virtual scratch buffer (`0x7F001000..`) for staging `Uint8Array` C2S packets. */
const C2S_DISPATCH_PKT_SCRATCH_VA_113C = 0x7f001000;

/**
 * Uniform adapter signature for all 91 non-null C2S handlers in `D2Game.dll:0x6FD1A078`.
 * Returns the handler's exact `D2Game.dll` status code (`0`, `1`, `2`, or `3`).
 */
export type C2SHandlerAdapter113c = (
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  callees?: C2SPacketCallees113c,
) => number;

function requireSparseMem113c(mem: Memory113c, opcode: number): SparseMemory113c {
  if (mem instanceof SparseMemory113c) {
    return mem;
  }
  throw new Error(
    `C2S opcode 0x${(opcode & 0xff).toString(16).padStart(2, '0')} requires SparseMemory113c`,
  );
}

/**
 * Complete 91-entry dispatch map keyed strictly by exact `D2Game.dll:0x6FD1A078` `handlerVa`.
 * Covers all 7 ported signature families (`F1A`, `F1B`, `F2`, `F3` 4-arg no-`pGame`, `F4` callees,
 * `F5` default hooks, `F6` sparse + default callbacks) with strict type narrowing.
 *
 * Legacy misnamed TS identifiers are bound strictly by their verified DLL VA (real opcode slot
 * noted in inline comments).
 */
export const C2S_HANDLER_BY_VA_113C: ReadonlyMap<number, C2SHandlerAdapter113c> = new Map<
  number,
  C2SHandlerAdapter113c
>([
  // 0x01..0x11: Movement, basic/shift/repeat left & right skill handlers + 0x0B 1-byte noop
  [
    0x6fcee0d0,
    (m, g, p, pkt, len, callees) => C2S_Packet01_WalkToLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee090,
    (m, g, p, pkt, len, callees) => C2S_Packet02_WalkToUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee040,
    (m, g, p, pkt, len, callees) => C2S_Packet03_RunToLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee000,
    (m, g, p, pkt, len, callees) => C2S_Packet04_RunToUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee5a0,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet05_LeftSkillOnLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee9d0,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet06_LeftSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee950,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet07_ShiftLeftSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee8f0,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet08_RepeatLeftSkillOnLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fceeb70,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet09_RepeatLeftSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fceeb10,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [0x6fceb5b0, (m, g, p, pkt, len) => C2S_Packet0B_Noop1Byte113c(m, g, p, pkt, len) | 0],
  [
    0x6fcee520,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet0C_RightSkillOnLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee870,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet0D_RightSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee7f0,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet0E_ShiftRightSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fcee790,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet0F_RepeatRightSkillOnLocation113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fceeab0,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet10_RepeatRightSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  [
    0x6fceea50,
    (m, g, p, pkt, len, callees) =>
      C2S_Packet11_RepeatShiftRightSkillOnUnit113c(m, g, p, pkt, len, callees) | 0,
  ],
  // 0x12: 4-arg no-pGame handler
  [0x6fceb590, (m, _g, p, pkt, len) => PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(m, p, pkt, len) | 0],
  // 0x13..0x2A: Interact, chat, inventory, equip, belt, identify, socket, container
  [0x6fcf0910, (m, g, p, pkt, len) => D2Game_6FCF0910_113c(requireSparseMem113c(m, 0x13), g, p, pkt, len) | 0],
  [0x6fcf00a0, (m, g, p, pkt, len) => PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c(m, g, p, pkt, len) | 0],
  [0x6fcedbb0, (m, g, p, pkt, len) => PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c(m, g, p, pkt, len) | 0],
  [0x6fcf08b0, (m, g, p, pkt, len) => D2Game_6FCF08B0_113c(requireSparseMem113c(m, 0x16), g, p, pkt, len) | 0],
  [0x6fcef380, (m, g, p, pkt, len) => C2S_Packet_DropCursorItem_6FCEF380_113c(m, g, p, pkt, len) | 0],
  [0x6fcef0e0, (m, g, p, pkt, len) => D2Game_6FCEF0E0_113c(requireSparseMem113c(m, 0x18), g, p, pkt, len) | 0],
  [
    0x6fcf1370,
    (m, g, p, pkt, len) =>
      C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fceee60,
    (m, g, p, pkt, len) => C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c(m, g, p, pkt, len) | 0,
  ],
  // DLL slot 0x1B (legacy TS name mentions Packet1A)
  [
    0x6fcef2f0,
    (m, g, p, pkt, len) =>
      C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c(requireSparseMem113c(m, 0x1b), g, p, pkt, len) | 0,
  ],
  [0x6fcf12e0, (m, g, p, pkt, len) => D2Game_6FCF12E0_113c(requireSparseMem113c(m, 0x1c), g, p, pkt, len) | 0],
  [
    0x6fcf1200,
    (m, g, p, pkt, len) =>
      C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c(
        requireSparseMem113c(m, 0x1d),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  // DLL slot 0x1E (legacy TS name mentions Packet1B)
  [
    0x6fcf1140,
    (m, g, p, pkt, len) =>
      C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fcf1010,
    (m, g, p, pkt, len) =>
      C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c(
        requireSparseMem113c(m, 0x1f),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fcef730, (m, g, p, pkt, len) => C2S_Packet20_UseInventoryItem_6FCEF730_113c(m, g, p, pkt, len) | 0],
  [0x6fcee4b0, (m, g, p, pkt, len) => C2S_Packet21_MergeStackableItems_6FCEE4B0_113c(m, g, p, pkt, len) | 0],
  [0x6fced4f0, (m, g, p, pkt, len) => C2S_ValidatePacket5ByteItem_6FCED4F0_113c(m, g, p, pkt, len) | 0],
  [
    0x6fceec70,
    (m, g, p, pkt, len) => C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fcf0f80,
    (m, g, p, pkt, len) => C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fceede0,
    (m, g, p, pkt, len) =>
      C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c(m, g, p, pkt, len) | 0,
  ],
  [0x6fcef5b0, (m, g, p, pkt, len) => C2S_Packet26_UseBeltItem_6FCEF5B0_113c(m, g, p, pkt, len) | 0],
  [0x6fcef6b0, (m, g, p, pkt, len) => C2S_Packet27_IdentifyItem_6FCEF6B0_113c(m, g, p, pkt, len) | 0],
  [0x6fceebd0, (m, g, p, pkt, len) => C2S_Packet28_SocketItem_6FCEEBD0_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcedb30,
    (m, g, p, pkt, len) => C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fcef270,
    (m, g, p, pkt, len) =>
      C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c(
        requireSparseMem113c(m, 0x2a),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  // 0x2C..0x3E: Reject/noop stubs, NPC trade/menu/repair/hire/identify, stats, skills, scroll
  [0x6fceb1e0, (m, g, p, pkt, len) => PACKET_C2S2C_Reject3_113c(m, g, p, pkt, len) | 0],
  [0x6fcebda0, (m, g, p, pkt, len) => PACKET_C2S2D_Reject3_113c(m, g, p, pkt, len) | 0],
  [0x6fceb1d0, (m, g, p, pkt, len) => PACKET_C2S2E_PlaySoundNoop113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x2F (NPC interact init; legacy TS name mentions TriggerMonsterSpawnNode)
  [
    0x6fcee440,
    (m, g, p, pkt, len) =>
      C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c(
        requireSparseMem113c(m, 0x2f),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fced480, (m, g, p, pkt, len) => C2S_Packet30_CancelNpcInteract_6FCED480_113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x31 (NPC quest message; legacy TS name mentions Srv2F)
  [0x6fcec9d0, (m, g, p, pkt, len) => PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(m, g, p, pkt, len) | 0],
  [0x6fcef220, (m, g, p, pkt, len) => C2S_Packet_NpcBuyItem_6FCEF220_113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x33 (NPC sell item; legacy TS name mentions Packet32_NpcBuyItem)
  [
    0x6fcef570,
    (m, g, p, pkt, len) =>
      C2S_Packet32_NpcBuyItem_6FCEF570_113c(requireSparseMem113c(m, 0x33), g, p, pkt, len) | 0,
  ],
  [0x6fcef070, (m, g, p, pkt, len) => C2S_Packet34_CainIdentifyItems_6FCEF070_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcef0a0,
    (m, g, p, pkt, len) =>
      C2S_Packet35_NpcRepair_6FCEF0A0_113c(requireSparseMem113c(m, 0x35), g, p, pkt, len) | 0,
  ],
  [0x6fcf0060, (m, g, p, pkt, len) => C2S_Packet_HireMercenary_6FCF0060_113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x37 (identify gamble/pending item; legacy TS name mentions Packet27)
  [
    0x6fceefe0,
    (m, g, p, pkt, len) => C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fcefb30,
    (m, g, p, pkt, len) =>
      C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(
        requireSparseMem113c(m, 0x38),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fceb560, (m, g, p, pkt, len) => PACKET_C2S39_Reject3_113c(m, g, p, pkt, len) | 0],
  [0x6fcec960, (m, g, p, pkt, len) => C2S_Packet3A_AddStatPoint_6FCEC960_113c(m, g, p, pkt, len) | 0],
  [
    0x6fceda20,
    (m, g, p, pkt, len) =>
      C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(requireSparseMem113c(m, 0x3b), g, p, pkt, len) | 0,
  ],
  [0x6fcef480, (m, g, p, pkt, len) => C2S_Packet3C_SelectSkill113c(m, g, p, pkt, len) | 0],
  [0x6fced440, (m, g, p, pkt, len) => C2S_SyncObjectCollisionByGuid_6FCED440_113c(m, g, p, pkt, len) | 0],
  [
    0x6fced8d0,
    (m, g, p, pkt, len) =>
      C2S_PacketUseQuestScrollItem_6FCED8D0_113c(requireSparseMem113c(m, 0x3e), g, p, pkt, len) | 0,
  ],
  // 0x3F: 4-arg no-pGame handler
  [0x6fcebd50, (m, _g, p, pkt, len) => PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, p, pkt, len) | 0],
  // 0x40..0x66: Quest log, resurrect, orifice, merc, waypoint, trade, gold, hotkeys, party, pos, swap, warden
  [0x6fcebd30, (m, g, p, pkt, len) => PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcf14b0,
    (m, g, p, pkt, len) =>
      C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(
        requireSparseMem113c(m, 0x41),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fceb1c0, (m, g, p, pkt, len) => PACKET_C2S42_ClearCursorNoop113c(m, g, p, pkt, len) | 0],
  [0x6fceb1b0, (m, g, p, pkt, len) => PACKET_C2S43_QuestInitNoop113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x44 (StaffInOrifice / shrine item; legacy TS name mentions Packet1C)
  [
    0x6fcf0e90,
    (m, g, p, pkt, len) =>
      C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c(
        requireSparseMem113c(m, 0x44),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fceb550, (m, g, p, pkt, len) => PACKET_C2S45_Reject3_113c(m, g, p, pkt, len) | 0],
  [0x6fced3d0, (m, g, p, pkt, len) => PACKET_SrvMercMoveToUnit_6FCED3D0_113c(m, g, p, pkt, len) | 0],
  [0x6fced360, (m, g, p, pkt, len) => PACKET_SrvMercMoveToCoord_6FCED360_113c(m, g, p, pkt, len) | 0],
  [0x6fceb4e0, (m, g, p, pkt, len) => PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcf0d30,
    (m, g, p, pkt, len) =>
      C2S_Packet49_WaypointInteract_6FCF0D30_113c(
        requireSparseMem113c(m, 0x49),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fcec6e0, (m, g, p, pkt, len) => PACKET_C2S4B_RequestUnitRefresh113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x4C (transmogrify/cursor identify; legacy TS name mentions Packet27)
  [
    0x6fcef400,
    (m, g, p, pkt, len) =>
      C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c(
        requireSparseMem113c(m, 0x4c),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  // DLL slot 0x4D (clear NPC intro flag; legacy TS name mentions Srv3B)
  [0x6fceb4a0, (m, g, p, pkt, len) => PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcf1470,
    (m, g, p, pkt, len) =>
      C2S_HandlePacket4F_TradeButton_6FCF1470_113c(
        requireSparseMem113c(m, 0x4f),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [0x6fceef40, (m, g, p, pkt, len) => C2S_Packet50_DropPlayerGold_6FCEEF40_113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x51 (set skill hotkey; legacy TS name mentions Srv3C)
  [0x6fcebc70, (m, g, p, pkt, len) => PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(m, g, p, pkt, len) | 0],
  [0x6fceb490, (m, g, p, pkt, len) => PACKET_C2S52_Reject3_113c(m, g, p, pkt, len) | 0],
  [0x6fceb450, (m, g, p, pkt, len) => PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, g, p, pkt, len) | 0],
  [0x6fceb420, (m, g, p, pkt, len) => PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(m, g, p, pkt, len) | 0],
  [0x6fceb3d0, (m, g, p, pkt, len) => PACKET_C2S58_MarkQuestIntroSeen113c(m, g, p, pkt, len) | 0],
  [0x6fceff30, (m, g, p, pkt, len) => PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(m, g, p, pkt, len) | 0],
  // DLL slot 0x5D (7-byte party relation toggle; legacy TS name mentions Packet5E)
  [
    0x6fcec8e0,
    (m, g, p, pkt, len) => C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(m, g, p, pkt, len) | 0,
  ],
  // DLL slot 0x5E (6-byte party relation action; legacy TS name mentions Packet5D)
  [
    0x6fcec860,
    (m, g, p, pkt, len) => C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(m, g, p, pkt, len) | 0,
  ],
  [
    0x6fcf0790,
    (m, g, p, pkt, len, callees) => C2S_Packet5F_UpdatePlayerPos113c(m, g, p, pkt, len, callees) | 0,
  ],
  [0x6fcef510, (m, g, p, pkt, len) => C2S_Packet60_SwapWeapons_6FCEF510_113c(m, g, p, pkt, len) | 0],
  [
    0x6fcf0bc0,
    (m, g, p, pkt, len) =>
      PACKETS_SrvMercItemAction_6FCF0BC0_113c(requireSparseMem113c(m, 0x61), g, p, pkt, len) | 0,
  ],
  // DLL slot 0x62 (merc revive; legacy TS name mentions Packet23)
  [
    0x6fcefb90,
    (m, g, p, pkt, len) =>
      C2S_Packet23_MercReviveHandler_6FCEFB90_113c(
        requireSparseMem113c(m, 0x62),
        g,
        p,
        pkt,
        len,
      ) | 0,
  ],
  [
    0x6fcf0950,
    (m, g, p, pkt, len) =>
      C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c(m, g, p, pkt, len) | 0,
  ],
  [0x6fceb190, (m, g, p, pkt, len) => PACKET_C2S66_WardenResponseNoop113c(m, g, p, pkt, len) | 0],
]);

/**
 * Invokes the ported C2S handler registered for `handlerVa` in `C2S_HANDLER_BY_VA_113C`.
 * Throws an explicit error if `handlerVa` is unregistered (never silently falls back).
 */
export function dispatchC2SHandlerByVa113c(
  handlerVa: number,
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  callees?: C2SPacketCallees113c,
): number {
  const va = handlerVa >>> 0;
  const adapter = C2S_HANDLER_BY_VA_113C.get(va);
  if (adapter === undefined) {
    throw new Error(
      `Unregistered C2S handler VA 0x${va.toString(16).toUpperCase().padStart(8, '0')}`,
    );
  }
  return adapter(mem, pGame, pPlayer, pPacket, nPacketLen | 0, callees) | 0;
}

/**
 * Evaluates the exact `D2Game.dll:0x6FCEC580..0x6FCEC60F` 4-case jump-table gate
 * (`0x6FCEC67C` jump table + `0x6FCEC68C` 83-byte index table):
 * - `case 0` (`0x14, 0x15, 0x3C, 0x43, 0x66`): unrestricted bypass.
 * - `case 2` (`0x41`): requires `pPlayer !== 0 && dwAnimMode === 0x11` (`PLRMODE_DEAD`).
 * - `case 1` (`0x20, 0x26`) & `case 3` (all other opcodes): requires `pPlayer !== 0`,
 *   `STATES_CheckState113c(mem, pPlayer, 0x36) === 0`, and `dwAnimMode !== 0 && dwAnimMode !== 0x11`.
 *
 * Table column `+0x04` (`flag`) has 0 xrefs in `D2Game.dll` 1.13c and is NOT gated here.
 */
export function passesC2SDispatchGate113c(
  mem: Memory113c,
  pPlayer: number,
  opcode: number,
): boolean {
  const op = opcode & 0xff;
  if (op === 0x14 || op === 0x15 || op === 0x3c || op === 0x43 || op === 0x66) {
    return true;
  }
  if (op === 0x41) {
    return pPlayer !== 0 && (mem.u32((pPlayer + 0x10) >>> 0) >>> 0) === 0x11;
  }
  if (STATES_CheckState113c(mem, pPlayer, 0x36) !== 0) {
    return false;
  }
  if (pPlayer === 0) {
    return false;
  }
  const mode = mem.u32((pPlayer + 0x10) >>> 0) >>> 0;
  return mode !== 0 && mode !== 0x11;
}

/**
 * Memory-pointer entry to `D2Game.dll:0x6FCEC550` (unbound helper — no leading VA hit).
 * Reads `op = mem.u8(pPacket)`, enforces bounds, NULL-slot check, and `0x6FCEC67C` gates,
 * then dispatches by `entry.handlerVa` and returns the handler's exact status code (`0`/`1`/`2`/`3`).
 */
export function C2S_DispatchRawMem113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
  callees?: C2SPacketCallees113c,
): number {
  const len = nPacketLen | 0;
  if (pPacket === 0 || len <= 0) {
    return 3;
  }
  const op = mem.u8(pPacket >>> 0);
  if (op === 0 || op >= 0x67) {
    return 3;
  }
  const entry = C2S_PACKET_TABLE_6FD1A078_113C[op];
  if (entry === undefined || entry.handlerVa === 0) {
    return 3;
  }
  if (!passesC2SDispatchGate113c(mem, pPlayer, op)) {
    return 0;
  }
  let dispatchPkt = pPacket >>> 0;
  if (op === 0x14 || op === 0x15) {
    // Stage variable-length string packets (`0x14`/`0x15`) into zero-padded scratch so `SStrCopy`/`SStrLen`
    // in `0x6FCF00A0` / `0x6FCEDBB0` never read unloaded bytes past `pPacket + len` in `SparseMemory113c`.
    // Copy caller bytes FIRST so aliasing `pPacket` inside `C2S_DISPATCH_PKT_SCRATCH_VA_113C` is safe.
    const copy = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      copy[i] = mem.u8((dispatchPkt + i) >>> 0);
    }
    const scratch = C2S_DISPATCH_PKT_SCRATCH_VA_113C;
    mem.fill(scratch, Math.max(64, len + 16), 0);
    for (let i = 0; i < len; i++) {
      mem.setU8((scratch + i) >>> 0, copy[i]!);
    }
    dispatchPkt = scratch;
  }
  // 0x6FCEC60F idle-timeout wall clock (pGame+0x1DC4 / Fog.#10055) omitted for Rule 4 determinism.
  return dispatchC2SHandlerByVa113c(
    entry.handlerVa,
    mem,
    pGame,
    pPlayer,
    dispatchPkt,
    len,
    callees,
  );
}

/**
 * Clean-room 1:1 binary port of `D2Game.dll:0x6FCEC550` (`C2S_Dispatch`).
 * Enforces bounds, `C2S_PACKET_TABLE_6FD1A078_113C` NULL-slot check, and the exact 4-case
 * `0x6FCEC67C`/`0x6FCEC68C` gate BEFORE staging `packet` bytes into scratch memory, then
 * dispatches by `entry.handlerVa` via `C2S_HANDLER_BY_VA_113C` and returns the handler's
 * exact status code (`0`/`1`/`2`/`3`).
 *
 * @va D2Game:0x6FCEC550
 */
export function C2S_Dispatch113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packet: Uint8Array,
  callees?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEC550);
  const len = packet.length | 0;
  if (len <= 0) {
    return 3;
  }
  const op = packet[0]! & 0xff;
  if (op === 0 || op >= 0x67) {
    return 3;
  }
  const entry = C2S_PACKET_TABLE_6FD1A078_113C[op];
  if (entry === undefined || entry.handlerVa === 0) {
    return 3;
  }
  if (!passesC2SDispatchGate113c(m, pPlayer, op)) {
    return 0;
  }
  const pPkt = C2S_DISPATCH_PKT_SCRATCH_VA_113C;
  m.fill(pPkt, Math.max(64, len + 16), 0);
  for (let i = 0; i < len; i++) {
    m.setU8((pPkt + i) >>> 0, packet[i]!);
  }
  return dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, len, callees);
}

/**
 * Longitudinal replay adapter for `KERNEL_REGISTRY_113C['D2Game:0x6FCEC550']`.
 * Resolves the active snapshot player, enforces the exact `0x6FCEC550` bounds/table/jump-table
 * gates, and dispatches every opcode through `C2S_PACKET_TABLE_6FD1A078_113C` +
 * `C2S_HANDLER_BY_VA_113C` while supplying slice-world callees, K3 right-skill `onStartAttackOnUnit`,
 * K4/K6 snapshot pre/post hooks, and K0 non-hydrated fallbacks.
 */
export function C2S_DispatchFromMem113c(
  m: Memory113c,
  pGame: number,
  pPacket: number,
  nSize: number,
): number {
  const len = nSize | 0;
  if (pPacket === 0 || len <= 0) {
    return 3;
  }
  const op = m.u8(pPacket >>> 0);
  if (op === 0 || op >= 0x67) {
    return 3;
  }
  const entry = C2S_PACKET_TABLE_6FD1A078_113C[op];
  if (entry === undefined || entry.handlerVa === 0) {
    return 3;
  }

  // Match `D2Game.dll:0x6FCEAE80` (`0x6FCEAE96` pGame!=NULL, `0x6FCEAF04..0x6FCEAF0B` pPlayer!=NULL):
  // return 0 without hydrating or dispatching when no game or active player unit exists.
  if (pGame === 0) {
    return 0;
  }
  const world = getOrHydrateSliceWorld113c(m, pGame);
  let pPlayer = 0;
  for (const p of world.playerById.values()) {
    pPlayer = p;
    break;
  }
  if (pPlayer === 0) {
    return 0;
  }
  if (!passesC2SDispatchGate113c(m, pPlayer, op)) {
    return 0;
  }

  // Copy input bytes FIRST so aliasing `pPacket` inside `C2S_DISPATCH_PKT_SCRATCH_VA_113C` is safe.
  const pktBytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    pktBytes[i] = m.u8((pPacket + i) >>> 0);
  }
  // Stage packet into a zero-padded scratch buffer for variable-length string handlers (`0x14`/`0x15`).
  const pPkt = C2S_DISPATCH_PKT_SCRATCH_VA_113C;
  m.fill(pPkt, Math.max(64, len + 16), 0);
  for (let i = 0; i < len; i++) {
    m.setU8((pPkt + i) >>> 0, pktBytes[i]!);
  }

  // Opcodes 0x12..0x66 (excluding 0x3C and 0x5F): route via K4/K6 replay hooks (wrapping real table
  // dispatch) when installed, or directly via `dispatchC2SHandlerByVa113c`.
  if (op >= 0x12 && op !== 0x3c && op !== 0x5f) {
    const k4Bridge = getK4ReplayKernelBridge113c();
    if (k4Bridge !== null) {
      const k4Rc = k4Bridge.tryApplyQuestAndNpcC2SPacket(m, pGame, pPlayer, pktBytes, () => {
        syncAndPruneSliceWorld113c(world);
      });
      if (k4Rc !== null) {
        return k4Rc | 0;
      }
    }
    return dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, len);
  }

  if (op === 0x0b) {
    return dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, len);
  }

  if (op === 0x3c) {
    if (pPlayer !== 0 && pGame !== 0) {
      m.set(pPlayer, D2UnitStrc.pGame, pGame);
    }
    const hydrated = isSgptDataTablesLoaded113c(m);
    if (!hydrated && pPlayer !== 0 && len >= 9) {
      const wSkillId = m.u16((pPkt + 1) >>> 0);
      const bLeft = m.u8((pPkt + 4) >>> 0) !== 0 ? 1 : 0;
      const dwItemGuid = m.u32((pPkt + 5) >>> 0) | 0;
      if (dwItemGuid === -1 && SKILLS_GetSkillById113c(m, pPlayer, wSkillId, -1) === 0) {
        SKILLS_AddSkillToUnit113c(m, pPlayer, wSkillId);
      }
      const rc = dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, len);
      if (rc !== 0) {
        SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, bLeft, wSkillId, dwItemGuid);
      }
      return rc;
    }
    return dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, len);
  }

  if (op === 0x5f) {
    ensureSliceWorldPathMemory113c(world);
    return dispatchC2SHandlerByVa113c(
      entry.handlerVa,
      m,
      pGame,
      pPlayer,
      pPkt,
      len,
      buildSliceC2SCallees113c(world),
    );
  }

  if (op >= 0x01 && op <= 0x04) {
    ensureSliceWorldPathMemory113c(world);
    if (m.get(pPlayer, D2UnitStrc.pUnitData) !== 0) {
      return dispatchC2SHandlerByVa113c(
        entry.handlerVa,
        m,
        pGame,
        pPlayer,
        pPkt,
        len,
        buildSliceC2SCallees113c(world),
      );
    }
    return applyNonHydratedSliceC2SFallbackK0_113c(world, pPlayer, pktBytes) ? 0 : 3;
  }

  if (op >= 0x0c && op <= 0x11) {
    ensureSliceWorldPathMemory113c(world);
    if (
      m.get(pPlayer, D2UnitStrc.pStatListEx) !== 0 &&
      STATES_CheckState113c(m, pPlayer, 1) !== 0
    ) {
      return 0;
    }
    if ((op === 0x0c || op === 0x0f) && len >= 5) {
      const x = m.u16((pPkt + 1) >>> 0);
      const y = m.u16((pPkt + 3) >>> 0);
      if (x === 0 || y === 0) {
        return 0;
      }
    }
    const baseCallees = buildSliceC2SCallees113c(world);
    const rightSkillCallees: C2SPacketCallees113c = {
      ...(baseCallees.findServerUnit !== undefined
        ? { findServerUnit: baseCallees.findServerUnit }
        : {}),
      onStartAttackOnUnit(mem, pg, plr, tgt, mode) {
        PLAYER_StartCastSkillOnUnitK3_113c(mem, pg, plr, mode, tgt);
      },
      ...(baseCallees.onAfterModeStarted !== undefined
        ? { onAfterModeStarted: baseCallees.onAfterModeStarted }
        : {}),
    };
    return dispatchC2SHandlerByVa113c(
      entry.handlerVa,
      m,
      pGame,
      pPlayer,
      pPkt,
      len,
      rightSkillCallees,
    );
  }

  // Opcodes 0x05..0x0A (left skill on location/unit)
  ensureSliceWorldPathMemory113c(world);
  if (isSgptDataTablesLoaded113c(m) && UNITS_GetLeftSkill113c(m, pPlayer) !== 0) {
    return dispatchC2SHandlerByVa113c(
      entry.handlerVa,
      m,
      pGame,
      pPlayer,
      pPkt,
      len,
      buildSliceC2SCallees113c(world),
    );
  }
  if (op === 0x06 && len >= 9) {
    return applyNonHydratedSliceC2SFallbackK0_113c(world, pPlayer, pktBytes) ? 0 : 3;
  }
  return dispatchC2SHandlerByVa113c(
    entry.handlerVa,
    m,
    pGame,
    pPlayer,
    pPkt,
    len,
    buildSliceC2SCallees113c(world),
  );
}

function isCoreMovementOrSkillOpcode113c(opcode: number): boolean {
  return (opcode >= 0x01 && opcode <= 0x11) || opcode === 0x3c || opcode === 0x5f;
}

/**
 * Client-framed byte-count adapter around `D2Game.dll:0x6FCEC550` (`C2S_DispatchRawMem113c`).
 * Sources C2S wire lengths from `D2Net.dll:0x6FBFABD8` (`C2S_PACKET_SIZES`), enforces D2Net
 * fixed-size / invalid-size (`<= 0`) rejection upfront, validates `pClient->dwClientState === 4`
 * and `pPlayer !== 0`, enforces the exact `0x6FCEC67C` dead / `STATE_UNINTERRUPTABLE` / `0x41`
 * gate BEFORE `pUnitData` auto-allocation or `callees.onUnhandledOpcode`, honors
 * `callees.onUnhandledOpcode` ONLY when explicitly provided for opcodes outside
 * `{0x01..0x11, 0x3C, 0x5F}`, and otherwise dispatches all non-null opcodes through the real
 * table-driven `0x6FCEC550`.
 *
 * Returns `expectedSize > 0 ? expectedSize : len` when the handler returns `0` (success / gated drop),
 * or the non-zero handler/validation status code (`1`, `2`, `3`).
 */
export function C2S_DispatchPacketMem113c(
  mem: Memory113c,
  pGame: number,
  pClient: number,
  pPacket: number,
  nPacketLen: number,
  callees?: C2SPacketCallees113c,
): number {
  const len = nPacketLen | 0;
  if (pPacket === 0 || len <= 0) {
    return 3;
  }
  const opcode = mem.u8(pPacket >>> 0);
  if (opcode === 0 || opcode >= 0x67) {
    return 3;
  }

  const entry = C2S_PACKET_TABLE_6FD1A078_113C[opcode];
  if (entry === undefined || entry.handlerVa === 0) {
    return 3;
  }

  const expectedSize = C2S_PACKET_SIZES[opcode] ?? 0;
  if (expectedSize !== -1 && (expectedSize <= 0 || len < expectedSize)) {
    return 3;
  }

  let pPlayer = 0;
  if (pClient !== 0) {
    const dwClientState = mem.u32((pClient + D2ClientStrcOffsets.dwClientState) >>> 0);
    if (dwClientState !== 4) {
      return 2;
    }
    pPlayer = mem.u32((pClient + D2ClientStrcOffsets.pPlayer) >>> 0);
  }
  if (pPlayer === 0) {
    return 2;
  }

  const handlerLen = expectedSize > 0 ? expectedSize : len;

  // Enforce exact `D2Game.dll:0x6FCEC67C` dead / `STATE_UNINTERRUPTABLE` / `0x41` gate
  // BEFORE `pUnitData` auto-allocation or `callees.onUnhandledOpcode`.
  if (!passesC2SDispatchGate113c(mem, pPlayer, opcode)) {
    return handlerLen;
  }

  // Ensure minimal loopback fixtures supplying `callees` without pre-allocated `D2PlayerDataStrc` link `pClient`
  if (
    callees !== undefined &&
    mem.get(pPlayer, D2UnitStrc.dwUnitType) === 0 &&
    mem.get(pPlayer, D2UnitStrc.pUnitData) === 0
  ) {
    const pPlrData = mem.alloc(0x170);
    mem.setU32((pPlrData + 0x9c) >>> 0, pClient >>> 0);
    mem.set(pPlayer, D2UnitStrc.pUnitData, pPlrData);
  }

  // Honor caller-supplied `onUnhandledOpcode` for non-core opcodes before table fallback
  if (
    !isCoreMovementOrSkillOpcode113c(opcode) &&
    callees !== undefined &&
    callees.onUnhandledOpcode !== undefined
  ) {
    return callees.onUnhandledOpcode(mem, pGame, pPlayer, opcode, pPacket, nPacketLen);
  }

  const rc = C2S_DispatchRawMem113c(mem, pGame, pPlayer, pPacket, handlerLen, callees);
  return rc === 0 ? handlerLen : rc;
}
