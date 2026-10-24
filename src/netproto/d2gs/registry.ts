/**
 * D2GS S->C Packet Decoder Registry & C->S Command Encoder Dispatch (1.13c).
 * Every S->C opcode entry cites its exact handler VA in D2Client.dll (0x6fb8de60 / 0x6fb5d450).
 */

import { ProtocolError } from '../core/errors.ts'
import type { TextEncoding } from '../core/text-codec.ts'
import type { ClientCommand } from '../domain/client-command.ts'
import type { ItemDataTables } from '../domain/ids.ts'
import type { ServerEvent } from '../domain/server-event.ts'
import { encodeC2sChat, encodeC2sOverheadChat, encodeC2sSay } from './c2s/chat.ts'
import {
  encodeC2sCancelController,
  encodeC2sClickButton,
  encodeC2sInteract,
  encodeC2sRequestQuestData,
  encodeC2sResurrect,
  encodeC2sStaffInOrifice,
  encodeC2sSwapWeapons,
  encodeC2sWaypointGo,
} from './c2s/interact.ts'
import {
  encodeC2sBeltPut,
  encodeC2sBeltRemove,
  encodeC2sBeltSwap,
  encodeC2sBeltUse,
  encodeC2sIdentifyItem,
  encodeC2sItemDrop,
  encodeC2sDropGold,
  encodeC2sItemEquip,
  encodeC2sItemPickup,
  encodeC2sItemPlace,
  encodeC2sItemSwap,
  encodeC2sItemToBelt,
  encodeC2sItemToCube,
  encodeC2sItemToCursor,
  encodeC2sItemUnequip,
  encodeC2sItemUse,
  encodeC2sMercItem,
  encodeC2sScrollToBook,
  encodeC2sSelectMainItem,
  encodeC2sSocketItem,
  encodeC2sSwap2HandedItem,
  encodeC2sSwapTwo1HandedWithOne2HandedItem,
  encodeC2sSwapContainerItem,
} from './c2s/items.ts'
import {
  encode0x59MakeEntityMove,
  encodeC2sMove,
  encodeC2sMoveToUnit,
  encodeC2sRunToggle,
  encodeC2sWarpTo,
} from './c2s/movement.ts'
import {
  encodeC2sHireMerc,
  encodeC2sNpcBuy,
  encodeC2sNpcCancel,
  encodeC2sNpcEntityAction,
  encodeC2sNpcIdentifyAll,
  encodeC2sNpcIdentifyGamble,
  encodeC2sNpcInit,
  encodeC2sNpcRepairAll,
  encodeC2sNpcRepairItem,
  NpcActionId,
  encodeC2sNpcResurrectMerc,
  encodeC2sNpcSell,
  encodeC2sPlayNpcMessage,
  encodeC2sQuestMessage,
} from './c2s/npc.ts'
import { encodeC2sHostile, encodeC2sParty } from './c2s/party.ts'
import { encodeC2sLeaveGame, encodeC2sPing } from './c2s/session.ts'
import {
  encodeC2sAddSkillPoint,
  encodeC2sAddStatPoint,
  encodeC2sAssignSkillHotkey,
  encodeC2sSelectSkill,
  encodeC2sSkillAt,
  encodeC2sSkillOnUnit,
} from './c2s/skills.ts'
import { encodeC2sTrade } from './c2s/trade.ts'
import { encodeC2sUpdatePlayerPos } from './c2s/position.ts'
import { D2GS_S2C_PACKET_SIZES, resolveS2cPacketSize } from './framing-s2c.ts'
import { decode0x26ChatMessage, decode0x5AEventMessage } from './s2c/chat.ts'
import {
  decode0x3FUseStackableItem,
  decode0x42ClearCursor,
  decode0x47Relator1,
  decode0x48Relator2,
  decode0x7CUseSpecialItem,
  decode0x7DSetItemState,
  decode0x9C0x9DItemAction,
} from './s2c/items.ts'
import {
  decode0x00GameLoading,
  decode0x01GameFlags,
  decode0x02GameLogonSuccess,
  decode0x03LoadAct,
  decode0x04LoadDone,
  decode0x05UnloadDone,
  decode0x06GameLogout,
  decode0x07RoomReveal,
  decode0x08RoomHide,
  decode0x0BGameHandshake,
  decode0xB0ConnectionTerminated,
  decode0xB3SaveChunk,
  decode0xB4TimeoutReason,
} from './s2c/load.ts'
import {
  decode0x4EMercForHire,
  decode0x4FMercForHireListStart,
  decode0x7ASummonAction,
  decode0x81AssignMerc,
  decode0x9BMercReviveCost,
  decode0x9EMercAttrByte,
  decode0x9FMercAttrWord,
  decode0xA0MercAttrDword,
  decode0xA1MercExpByte,
  decode0xA2MercExpWord,
} from './s2c/merc.ts'
import {
  decode0x2CPlaySound,
  decode0x53EnvironmentSync,
  decode0x73CreateMissile,
  decode0x8FPong,
  decode0xA3AuraSkill,
  decode0xA4MonsterSpecial,
  decode0xA5StateSkillEffect,
  decode0xAEWarden,
  decode0x58OpenUi,
  decode0x61CanGoToAct,
  decodeRare113cS2cPacket,
} from './s2c/misc.ts'
import {
  decode0x0DPlayerStop,
  decode0x0FPlayerMove,
  decode0x10PlayerMoveToTarget,
  decode0x15ReassignPlayer,
  decode0x67NpcMove,
  decode0x68NpcMoveToTarget,
  decode0x6DNpcStop,
  decode0x96WalkVerify,
} from './s2c/movement.ts'
import {
  decode0x27NpcInfo,
  decode0x2ANpcTransaction,
  decode0x8ANpcWantsInteract,
  decode0x91NpcMenu,
  decode0xABNpcHeal,
} from './s2c/npc.ts'
import {
  decode0x5BPlayerInGame,
  decode0x5CPlayerLeftGame,
  decode0x65PlayerKillCount,
  decode0x66PartyMemberUpdate,
  decode0x74PlayerCorpseAssign,
  decode0x75PlayerPartyInfo,
  decode0x7FPartyMemberState,
  decode0x8BPlayerPartyRelation,
  decode0x8CRelationshipUpdate,
  decode0x8DAssignPlayerToParty,
  decode0x8ECorpseAssign,
  decode0x90PartyMemberPos,
} from './s2c/party.ts'
import {
  decode0x28QuestInfo,
  decode0x29GameQuestLog,
  decode0x50QuestItemState,
  decode0x52QuestHistory,
  decode0x5DQuestStatus,
  decode0x5EGameQuestAvailability,
  decode0x89SpecialQuestEvent,
} from './s2c/quest.ts'
import {
  decode0x21UpdateSkill,
  decode0x22UpdateSkillStatus,
  decode0x23AssignSkill,
  decode0x4CSkillOnTarget,
  decode0x4DSkillOnLocation,
  decode0x6CNpcAttack,
  decode0x7BAssignSkillHotkey,
  decode0x94BaseSkillLevels,
  decode0x99SkillTriggeredOnTarget,
  decode0x9ASkillTriggeredOnLocation,
} from './s2c/skills.ts'
import {
  decode0xA7DelayedState,
  decode0xA8SetState,
  decode0xA9EndState,
  decode0xAAAddUnitState,
} from './s2c/states.ts'
import {
  decode0x18LifeManaRegen,
  decode0x19GoldByte,
  decode0x1AExpByte,
  decode0x1BExpWord,
  decode0x1CExpDword,
  decode0x1DAttrByte,
  decode0x1EAttrWord,
  decode0x1FAttrDword,
  decode0x20AttrNotification,
  decode0x3EUpdateItemStats,
  decode0x95LifeMana,
} from './s2c/stats.ts'
import {
  decode0x77ButtonActions,
  decode0x78TradeAccepted,
  decode0x79GoldInTrade,
  decode0x92RemoveObjectTrade,
} from './s2c/trade.ts'
import {
  decode0x09AssignWarp,
  decode0x0ARemoveUnit,
  decode0x0CNpcGetHit,
  decode0x0ESetObjectState,
  decode0x11UnitOverlay,
  decode0x51AssignObject,
  decode0x59AssignPlayer,
  decode0x69SetNpcMode,
  decode0x6ANpcAction,
  decode0x6BNpcAction2,
  decode0x76HoverTextClear,
  decode0xACAssignNpc,
} from './s2c/units.ts'
import {
  decode0x60TownPortalState,
  decode0x63WaypointMenu,
  decode0x82PortalOwnership,
} from './s2c/waypoint.ts'

export interface D2gsDecodeContext {
  readonly tables: ItemDataTables
  readonly encoding?: TextEncoding | undefined
  readonly rttMs?: number | undefined
}

export interface D2gsS2cRegistryEntry {
  readonly opcode: number
  readonly name: string
  readonly d2ClientHandlerVa: string
  readonly decode: (pkt: Uint8Array, ctx: D2gsDecodeContext) => ServerEvent
}

export const D2GS_S2C_REGISTRY: Readonly<Record<number, D2gsS2cRegistryEntry>> = {
  0x00: { opcode: 0x00, name: 'GameLoading', d2ClientHandlerVa: '0x6fb5c520', decode: decode0x00GameLoading },
  0x01: { opcode: 0x01, name: 'GameFlags', d2ClientHandlerVa: '0x6fb5fa90', decode: decode0x01GameFlags },
  0x02: { opcode: 0x02, name: 'GameLogonSuccess', d2ClientHandlerVa: '0x6fb5c4f0', decode: decode0x02GameLogonSuccess },
  0x03: { opcode: 0x03, name: 'LoadAct', d2ClientHandlerVa: '0x6fb5db50', decode: decode0x03LoadAct },
  0x04: { opcode: 0x04, name: 'LoadDone', d2ClientHandlerVa: '0x6fb5dfe0', decode: decode0x04LoadDone },
  0x05: { opcode: 0x05, name: 'UnloadDone', d2ClientHandlerVa: '0x6fb5cb70', decode: decode0x05UnloadDone },
  0x06: { opcode: 0x06, name: 'GameLogoutSuccess', d2ClientHandlerVa: '0x6fb5caa0', decode: decode0x06GameLogout },
  0x07: { opcode: 0x07, name: 'RoomReveal', d2ClientHandlerVa: '0x6fb5c440', decode: decode0x07RoomReveal },
  0x08: { opcode: 0x08, name: 'RoomHide', d2ClientHandlerVa: '0x6fb5c3d0', decode: decode0x08RoomHide },
  0x09: { opcode: 0x09, name: 'AssignWarp', d2ClientHandlerVa: '0x6fb5df70', decode: decode0x09AssignWarp },
  0x0a: { opcode: 0x0a, name: 'RemoveGroundUnit', d2ClientHandlerVa: '0x6fb5ca40', decode: decode0x0ARemoveUnit },
  0x0b: { opcode: 0x0b, name: 'GameHandshake', d2ClientHandlerVa: '0x6fb5d6e0', decode: decode0x0BGameHandshake },
  0x0c: { opcode: 0x0c, name: 'NPCGetHit', d2ClientHandlerVa: '0x6fb5f5f0', decode: decode0x0CNpcGetHit },
  0x0d: { opcode: 0x0d, name: 'PlayerStop', d2ClientHandlerVa: '0x6fb5f590', decode: decode0x0DPlayerStop },
  0x0e: { opcode: 0x0e, name: 'SetObjectState', d2ClientHandlerVa: '0x6fb5f560', decode: decode0x0ESetObjectState },
  0x0f: { opcode: 0x0f, name: 'PlayerMove', d2ClientHandlerVa: '0x6fb5f510', decode: decode0x0FPlayerMove },
  0x10: { opcode: 0x10, name: 'PlayerMoveToTarget', d2ClientHandlerVa: '0x6fb5f4c0', decode: decode0x10PlayerMoveToTarget },
  0x11: { opcode: 0x11, name: 'UnitOverlay', d2ClientHandlerVa: '0x6fb5daa0', decode: decode0x11UnitOverlay },
  0x12: { opcode: 0x12, name: 'UnloadAct', d2ClientHandlerVa: '0x6fb5c370', decode: decodeRare113cS2cPacket },
  0x13: { opcode: 0x13, name: 'UnitStateReset13', d2ClientHandlerVa: '0x6fb5c360', decode: decodeRare113cS2cPacket },
  0x14: { opcode: 0x14, name: 'UnitStateReset14', d2ClientHandlerVa: '0x6fb5c350', decode: decodeRare113cS2cPacket },
  0x15: { opcode: 0x15, name: 'ReassignPlayer', d2ClientHandlerVa: '0x6fb5f640', decode: decode0x15ReassignPlayer },
  0x16: { opcode: 0x16, name: 'MultipleUnitAssign', d2ClientHandlerVa: '0x6fb5d9d0', decode: decodeRare113cS2cPacket },
  0x17: { opcode: 0x17, name: 'RemoveUnit17', d2ClientHandlerVa: '0x6fb5f240', decode: decodeRare113cS2cPacket },
  0x18: { opcode: 0x18, name: 'HPMPUpdate', d2ClientHandlerVa: '0x6fb5eca0', decode: decode0x18LifeManaRegen },
  0x19: { opcode: 0x19, name: 'GoldToInvByte', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x19GoldByte },
  0x1a: { opcode: 0x1a, name: 'AddExpByte', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1AExpByte },
  0x1b: { opcode: 0x1b, name: 'AddExpWord', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1BExpWord },
  0x1c: { opcode: 0x1c, name: 'AddExpDword', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1CExpDword },
  0x1d: { opcode: 0x1d, name: 'BaseAttributeByte', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1DAttrByte },
  0x1e: { opcode: 0x1e, name: 'BaseAttributeWord', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1EAttrWord },
  0x1f: { opcode: 0x1f, name: 'BaseAttributeDword', d2ClientHandlerVa: '0x6fb5edf0', decode: decode0x1FAttrDword },
  0x20: { opcode: 0x20, name: 'AttributeNotification', d2ClientHandlerVa: '0x6fb5ed80', decode: decode0x20AttrNotification },
  0x21: { opcode: 0x21, name: 'UpdateSkill', d2ClientHandlerVa: '0x6fb5c910', decode: decode0x21UpdateSkill },
  0x22: { opcode: 0x22, name: 'UpdateSkillStatus', d2ClientHandlerVa: '0x6fb5c800', decode: decode0x22UpdateSkillStatus },
  0x23: { opcode: 0x23, name: 'AssignSkill', d2ClientHandlerVa: '0x6fb5c780', decode: decode0x23AssignSkill },
  0x24: { opcode: 0x24, name: 'UnusedQuest24', d2ClientHandlerVa: '0x6fb5c520', decode: decodeRare113cS2cPacket },
  0x25: { opcode: 0x25, name: 'UnusedQuest25', d2ClientHandlerVa: '0x6fb5c520', decode: decodeRare113cS2cPacket },
  0x26: { opcode: 0x26, name: 'ChatMessage', d2ClientHandlerVa: '0x6fb5f9f0', decode: (pkt, ctx) => decode0x26ChatMessage(pkt, ctx.encoding) },
  0x27: { opcode: 0x27, name: 'NPCInfo', d2ClientHandlerVa: '0x6fb5d680', decode: decode0x27NpcInfo },
  0x28: { opcode: 0x28, name: 'QuestInfo', d2ClientHandlerVa: '0x6fb5fa70', decode: decode0x28QuestInfo },
  0x29: { opcode: 0x29, name: 'GameQuestLog', d2ClientHandlerVa: '0x6fb5c330', decode: decode0x29GameQuestLog },
  0x2a: { opcode: 0x2a, name: 'NPCTransaction', d2ClientHandlerVa: '0x6fb5f9b0', decode: decode0x2ANpcTransaction },
  0x2c: { opcode: 0x2c, name: 'PlaySound', d2ClientHandlerVa: '0x6fb5d740', decode: decode0x2CPlaySound },
  0x3e: { opcode: 0x3e, name: 'UpdateItemStats', d2ClientHandlerVa: '0x6fb5e300', decode: decode0x3EUpdateItemStats },
  0x3f: { opcode: 0x3f, name: 'UseStackableItem', d2ClientHandlerVa: '0x6fb5f910', decode: decode0x3FUseStackableItem },
  0x40: { opcode: 0x40, name: 'QuestItemVerify', d2ClientHandlerVa: '0x6fb5d340', decode: decodeRare113cS2cPacket },
  0x42: { opcode: 0x42, name: 'ClearCursor', d2ClientHandlerVa: '0x6fb5db70', decode: decode0x42ClearCursor },
  0x45: { opcode: 0x45, name: 'Unknown0x45', d2ClientHandlerVa: '0x6fb5c130', decode: decodeRare113cS2cPacket },
  0x47: { opcode: 0x47, name: 'Relator1', d2ClientHandlerVa: '0x6fb5e2b0', decode: decode0x47Relator1 },
  0x48: { opcode: 0x48, name: 'Relator2', d2ClientHandlerVa: '0x6fb5e260', decode: decode0x48Relator2 },
  0x4c: { opcode: 0x4c, name: 'UnitUseSkillOnTarget', d2ClientHandlerVa: '0x6fb5f1d0', decode: decode0x4CSkillOnTarget },
  0x4d: { opcode: 0x4d, name: 'UnitUseSkill', d2ClientHandlerVa: '0x6fb5f160', decode: decode0x4DSkillOnLocation },
  0x4e: { opcode: 0x4e, name: 'MercForHire', d2ClientHandlerVa: '0x6fb5c0b0', decode: decode0x4EMercForHire },
  0x4f: { opcode: 0x4f, name: 'MercForHireListStart', d2ClientHandlerVa: '0x6fb5c0e0', decode: decode0x4FMercForHireListStart },
  0x50: { opcode: 0x50, name: 'QuestItemState', d2ClientHandlerVa: '0x6fb5d4b0', decode: decode0x50QuestItemState },
  0x51: { opcode: 0x51, name: 'AssignObject', d2ClientHandlerVa: '0x6fb5df40', decode: decode0x51AssignObject },
  0x52: { opcode: 0x52, name: 'QuestHistory', d2ClientHandlerVa: '0x6fb5d520', decode: decode0x52QuestHistory },
  0x53: { opcode: 0x53, name: 'EnvironmentSync', d2ClientHandlerVa: '0x6fb5e9c0', decode: decode0x53EnvironmentSync },
  0x54: { opcode: 0x54, name: 'Unknown0x54', d2ClientHandlerVa: '0x6fb5c120', decode: decodeRare113cS2cPacket },
  0x57: { opcode: 0x57, name: 'MonsterEnchant', d2ClientHandlerVa: '0x6fb5d560', decode: decodeRare113cS2cPacket },
  0x58: { opcode: 0x58, name: 'OpenUiBox', d2ClientHandlerVa: '0x6fb5f980', decode: decode0x58OpenUi },
  0x59: { opcode: 0x59, name: 'AssignPlayer', d2ClientHandlerVa: '0x6fb5df20', decode: decode0x59AssignPlayer },
  0x5a: { opcode: 0x5a, name: 'EventMessages', d2ClientHandlerVa: '0x6fb5d6b0', decode: (pkt, ctx) => decode0x5AEventMessage(pkt, ctx.encoding) },
  0x5b: { opcode: 0x5b, name: 'PlayerInGame', d2ClientHandlerVa: '0x6fb5d8f0', decode: decode0x5BPlayerInGame },
  0x5c: { opcode: 0x5c, name: 'PlayerLeftGame', d2ClientHandlerVa: '0x6fb5d8e0', decode: decode0x5CPlayerLeftGame },
  0x5d: { opcode: 0x5d, name: 'QuestStatus', d2ClientHandlerVa: '0x6fb5f8f0', decode: decode0x5DQuestStatus },
  0x5e: { opcode: 0x5e, name: 'GameQuestAvailability', d2ClientHandlerVa: '0x6fb5c090', decode: decode0x5EGameQuestAvailability },
  0x5f: { opcode: 0x5f, name: 'PlayerSlotSync', d2ClientHandlerVa: '0x6fb5c050', decode: decodeRare113cS2cPacket },
  0x60: { opcode: 0x60, name: 'TownPortalState', d2ClientHandlerVa: '0x6fb5d2f0', decode: decode0x60TownPortalState },
  0x61: { opcode: 0x61, name: 'CanGoToAct', d2ClientHandlerVa: '0x6fb5f940', decode: decode0x61CanGoToAct },
  0x62: { opcode: 0x62, name: 'CanUseTownPortal', d2ClientHandlerVa: '0x6fb5dfd0', decode: decodeRare113cS2cPacket },
  0x63: { opcode: 0x63, name: 'WaypointMenu', d2ClientHandlerVa: '0x6fb5f8b0', decode: decode0x63WaypointMenu },
  0x65: { opcode: 0x65, name: 'PlayerKillCount', d2ClientHandlerVa: '0x6fb5d890', decode: decode0x65PlayerKillCount },
  0x66: { opcode: 0x66, name: 'PartyMemberUpdate', d2ClientHandlerVa: '0x6fb5c040', decode: decode0x66PartyMemberUpdate },
  0x67: { opcode: 0x67, name: 'NPCMove', d2ClientHandlerVa: '0x6fb5f460', decode: decode0x67NpcMove },
  0x68: { opcode: 0x68, name: 'NPCMoveToTarget', d2ClientHandlerVa: '0x6fb5f3f0', decode: decode0x68NpcMoveToTarget },
  0x69: { opcode: 0x69, name: 'SetNPCMode', d2ClientHandlerVa: '0x6fb5f390', decode: decode0x69SetNpcMode },
  0x6a: { opcode: 0x6a, name: 'NPCAction', d2ClientHandlerVa: '0x6fb5f340', decode: decode0x6ANpcAction },
  0x6b: { opcode: 0x6b, name: 'NPCAction2', d2ClientHandlerVa: '0x6fb5f7c0', decode: decode0x6BNpcAction2 },
  0x6c: { opcode: 0x6c, name: 'NPCAttack', d2ClientHandlerVa: '0x6fb5f750', decode: decode0x6CNpcAttack },
  0x6d: { opcode: 0x6d, name: 'NPCStop', d2ClientHandlerVa: '0x6fb5f2b0', decode: decode0x6DNpcStop },
  0x6e: { opcode: 0x6e, name: 'ClearSync6E', d2ClientHandlerVa: '0x6fb5c3c0', decode: decodeRare113cS2cPacket },
  0x6f: { opcode: 0x6f, name: 'ClearSync6F', d2ClientHandlerVa: '0x6fb5c3b0', decode: decodeRare113cS2cPacket },
  0x70: { opcode: 0x70, name: 'ClearSync70', d2ClientHandlerVa: '0x6fb5c3a0', decode: decodeRare113cS2cPacket },
  0x71: { opcode: 0x71, name: 'ClearSync71', d2ClientHandlerVa: '0x6fb5c390', decode: decodeRare113cS2cPacket },
  0x72: { opcode: 0x72, name: 'ClearSync72', d2ClientHandlerVa: '0x6fb5c380', decode: decodeRare113cS2cPacket },
  0x73: { opcode: 0x73, name: 'CreateMissile', d2ClientHandlerVa: '0x6fb5eee0', decode: decode0x73CreateMissile },
  0x74: { opcode: 0x74, name: 'PlayerCorpseAssign', d2ClientHandlerVa: '0x6fb5def0', decode: decode0x74PlayerCorpseAssign },
  0x75: { opcode: 0x75, name: 'PlayerPartyInfo', d2ClientHandlerVa: '0x6fb5d870', decode: decode0x75PlayerPartyInfo },
  0x76: { opcode: 0x76, name: 'HoverTextClear', d2ClientHandlerVa: '0x6fb5d370', decode: decode0x76HoverTextClear },
  0x77: { opcode: 0x77, name: 'ButtonActions', d2ClientHandlerVa: '0x6fb5f930', decode: decode0x77ButtonActions },
  0x78: { opcode: 0x78, name: 'TradeAccepted', d2ClientHandlerVa: '0x6fb5bfd0', decode: decode0x78TradeAccepted },
  0x79: { opcode: 0x79, name: 'GoldInTrade', d2ClientHandlerVa: '0x6fb5bfb0', decode: decode0x79GoldInTrade },
  0x7a: { opcode: 0x7a, name: 'SummonAction', d2ClientHandlerVa: '0x6fb5c720', decode: decode0x7ASummonAction },
  0x7b: { opcode: 0x7b, name: 'AssignSkillHotkey', d2ClientHandlerVa: '0x6fb5c6d0', decode: decode0x7BAssignSkillHotkey },
  0x7c: { opcode: 0x7c, name: 'UseSpecialItem', d2ClientHandlerVa: '0x6fb5d2a0', decode: decode0x7CUseSpecialItem },
  0x7d: { opcode: 0x7d, name: 'SetItemState', d2ClientHandlerVa: '0x6fb5e1f0', decode: decode0x7DSetItemState },
  0x7e: { opcode: 0x7e, name: 'CMNCof', d2ClientHandlerVa: '0x6fb5d240', decode: decodeRare113cS2cPacket },
  0x7f: { opcode: 0x7f, name: 'PartyMemberState', d2ClientHandlerVa: '0x6fb5d820', decode: decode0x7FPartyMemberState },
  0x80: { opcode: 0x80, name: 'Noop80', d2ClientHandlerVa: '0x6fb5c520', decode: decodeRare113cS2cPacket },
  0x81: { opcode: 0x81, name: 'AssignMerc', d2ClientHandlerVa: '0x6fb5eba0', decode: decode0x81AssignMerc },
  0x82: { opcode: 0x82, name: 'PortalOwnership', d2ClientHandlerVa: '0x6fb5d160', decode: decode0x82PortalOwnership },
  0x89: { opcode: 0x89, name: 'SpecialQuestEvent', d2ClientHandlerVa: '0x6fb5bfa0', decode: decode0x89SpecialQuestEvent },
  0x8a: { opcode: 0x8a, name: 'NPCWantsInteract', d2ClientHandlerVa: '0x6fb5db30', decode: decode0x8ANpcWantsInteract },
  0x8b: { opcode: 0x8b, name: 'PlayerPartyRelation', d2ClientHandlerVa: '0x6fb5d800', decode: decode0x8BPlayerPartyRelation },
  0x8c: { opcode: 0x8c, name: 'RelationshipUpdate', d2ClientHandlerVa: '0x6fb5d7b0', decode: decode0x8CRelationshipUpdate },
  0x8d: { opcode: 0x8d, name: 'AssignPlayerToParty', d2ClientHandlerVa: '0x6fb5d780', decode: decode0x8DAssignPlayerToParty },
  0x8e: { opcode: 0x8e, name: 'CorpseAssign', d2ClientHandlerVa: '0x6fb5d130', decode: decode0x8ECorpseAssign },
  0x8f: { opcode: 0x8f, name: 'Pong', d2ClientHandlerVa: '0x6fb5bf40', decode: (pkt, ctx) => decode0x8FPong(pkt, ctx.rttMs) },
  0x90: { opcode: 0x90, name: 'PartyMemberMapPos', d2ClientHandlerVa: '0x6fb5d220', decode: decode0x90PartyMemberPos },
  0x91: { opcode: 0x91, name: 'SetNPCTalk', d2ClientHandlerVa: '0x6fb5c750', decode: decode0x91NpcMenu },
  0x92: { opcode: 0x92, name: 'RemoveObjectTrade', d2ClientHandlerVa: '0x6fb5e230', decode: decode0x92RemoveObjectTrade },
  0x93: { opcode: 0x93, name: 'Unknown0x93', d2ClientHandlerVa: '0x6fb5d3d0', decode: decodeRare113cS2cPacket },
  0x94: { opcode: 0x94, name: 'BaseSkillLevels', d2ClientHandlerVa: '0x6fb5c880', decode: decode0x94BaseSkillLevels },
  0x95: { opcode: 0x95, name: 'HPMPPotUpdate', d2ClientHandlerVa: '0x6fb5ebe0', decode: decode0x95LifeMana },
  0x96: { opcode: 0x96, name: 'WalkVerify', d2ClientHandlerVa: '0x6fb5d950', decode: decode0x96WalkVerify },
  0x97: { opcode: 0x97, name: 'WeaponSwitch', d2ClientHandlerVa: '0x6fb5bf50', decode: decodeRare113cS2cPacket },
  0x98: { opcode: 0x98, name: 'EvilHut', d2ClientHandlerVa: '0x6fb5d4f0', decode: decodeRare113cS2cPacket },
  0x99: { opcode: 0x99, name: 'SkillTriggeredOnTarget', d2ClientHandlerVa: '0x6fb5f0f0', decode: decode0x99SkillTriggeredOnTarget },
  0x9a: { opcode: 0x9a, name: 'SkillTriggeredOnLocation', d2ClientHandlerVa: '0x6fb5f090', decode: decode0x9ASkillTriggeredOnLocation },
  0x9b: { opcode: 0x9b, name: 'MercReviveCost', d2ClientHandlerVa: '0x6fb5e1e0', decode: decode0x9BMercReviveCost },
  0x9c: { opcode: 0x9c, name: 'ItemActionWorld', d2ClientHandlerVa: '0x6fb5e080', decode: (pkt, ctx) => decode0x9C0x9DItemAction(pkt, ctx.tables) },
  0x9d: { opcode: 0x9d, name: 'ItemActionOwned', d2ClientHandlerVa: '0x6fb5e870', decode: (pkt, ctx) => decode0x9C0x9DItemAction(pkt, ctx.tables) },
  0x9e: { opcode: 0x9e, name: 'MercAttributeByte', d2ClientHandlerVa: '0x6fb5ea40', decode: decode0x9EMercAttrByte },
  0x9f: { opcode: 0x9f, name: 'MercAttributeWord', d2ClientHandlerVa: '0x6fb5ea40', decode: decode0x9FMercAttrWord },
  0xa0: { opcode: 0xa0, name: 'MercAttributeDword', d2ClientHandlerVa: '0x6fb5ea40', decode: decode0xA0MercAttrDword },
  0xa1: { opcode: 0xa1, name: 'MercExpByte', d2ClientHandlerVa: '0x6fb5ea40', decode: decode0xA1MercExpByte },
  0xa2: { opcode: 0xa2, name: 'MercExpWord', d2ClientHandlerVa: '0x6fb5ea40', decode: decode0xA2MercExpWord },
  0xa3: { opcode: 0xa3, name: 'AuraStatSkill', d2ClientHandlerVa: '0x6fb5efb0', decode: decode0xA3AuraSkill },
  0xa4: { opcode: 0xa4, name: 'MonsterSpecialSkill', d2ClientHandlerVa: '0x6fb5d760', decode: decode0xA4MonsterSpecial },
  0xa5: { opcode: 0xa5, name: 'StateSkillEffect', d2ClientHandlerVa: '0x6fb5f7f0', decode: decode0xA5StateSkillEffect },
  0xa6: { opcode: 0xa6, name: 'SpecialMessageA6', d2ClientHandlerVa: '0x6fb5bf20', decode: decodeRare113cS2cPacket },
  0xa7: { opcode: 0xa7, name: 'DelayedState', d2ClientHandlerVa: '0x6fb5deb0', decode: decode0xA7DelayedState },
  0xa8: { opcode: 0xa8, name: 'SetState', d2ClientHandlerVa: '0x6fb5dd70', decode: (pkt, ctx) => decode0xA8SetState(pkt, ctx.tables) },
  0xa9: { opcode: 0xa9, name: 'EndState', d2ClientHandlerVa: '0x6fb5dd30', decode: decode0xA9EndState },
  0xaa: { opcode: 0xaa, name: 'AddUnitState', d2ClientHandlerVa: '0x6fb5db90', decode: (pkt, ctx) => decode0xAAAddUnitState(pkt, ctx.tables) },
  0xab: { opcode: 0xab, name: 'NPCHeal', d2ClientHandlerVa: '0x6fb5d0b0', decode: decode0xABNpcHeal },
  0xac: { opcode: 0xac, name: 'AssignNPC', d2ClientHandlerVa: '0x6fb5e420', decode: decode0xACAssignNpc },
  0xae: { opcode: 0xae, name: 'WardenRequest', d2ClientHandlerVa: '0x6fb5d630', decode: decode0xAEWarden },
  0xaf: { opcode: 0xaf, name: 'CompressionInfo', d2ClientHandlerVa: '0x6fb5d450', decode: decodeRare113cS2cPacket },
  0xb0: { opcode: 0xb0, name: 'ConnectionTerminated', d2ClientHandlerVa: '0x6fb5d450', decode: decode0xB0ConnectionTerminated },
  0xb2: { opcode: 0xb2, name: 'GameInfoB2', d2ClientHandlerVa: '0x6fb5d450', decode: decodeRare113cS2cPacket },
  0xb3: { opcode: 0xb3, name: 'SaveChunk', d2ClientHandlerVa: '0x6fb5cd70', decode: decode0xB3SaveChunk },
  0xb4: { opcode: 0xb4, name: 'TimeoutReason', d2ClientHandlerVa: '0x6fb5cbf0', decode: decode0xB4TimeoutReason },
}

const DEFAULT_EMPTY_TABLES: ItemDataTables = {
  itemStatCost: new Map(),
  armor: new Map(),
  weapons: new Map(),
  misc: new Map(),
  getStatMeta: () => undefined,
  getStatCost: () => undefined,
  getItemBaseMeta: () => undefined,
  getItemMeta: () => undefined,
}

/**
  * Decode a single framed D2GS S->C packet into a strongly-typed `ServerEvent`.
  * Fails fast with `ProtocolError` if opcode is unknown or length is mismatched.
  */
export function decodeD2gsS2cPacket(
  pkt: Uint8Array,
  ctx: D2gsDecodeContext = { tables: DEFAULT_EMPTY_TABLES },
): ServerEvent {
  if (pkt.byteLength === 0) {
    throw new ProtocolError('Empty D2GS S2C packet', { proto: 'd2gs', packetId: -1 })
  }
  const expectedLen = resolveS2cPacketSize(pkt, 0)
  if (expectedLen === null || expectedLen < 0 || expectedLen !== pkt.byteLength) {
    throw new ProtocolError(
      `D2GS S2C packet 0x${pkt[0]!.toString(16)} length mismatch: expected ${expectedLen ?? 'null'}, got ${pkt.byteLength}`,
      { proto: 'd2gs', packetId: pkt[0]!, raw: pkt },
    )
  }

  const op = pkt[0]!
  const entry = D2GS_S2C_REGISTRY[op]
  if (entry) {
    return entry.decode(pkt, ctx)
  }

  // Check if opcode is a valid 1.13c rare opcode in D2GS_S2C_PACKET_SIZES
  if (op < D2GS_S2C_PACKET_SIZES.length && D2GS_S2C_PACKET_SIZES[op] !== 0) {
    return decodeRare113cS2cPacket(pkt)
  }

  throw new ProtocolError(`Unknown D2GS S2C opcode 0x${op.toString(16)}`, {
    proto: 'd2gs',
    packetId: op,
    raw: pkt,
  })
}

/**
 * Encode a protocol-neutral `ClientCommand` into 1 or more validated 1.13c C->S packets.
 */
export function encodeD2gsClientCommand(
  cmd: ClientCommand,
  encoding: TextEncoding = 'gbk',
  tickCount = 0,
): readonly Uint8Array[] {
  switch (cmd.type) {
    case 'Move': {
      const to = cmd.to ?? { x: Number(cmd.x ?? 0), y: Number(cmd.y ?? 0) }
      return [encodeC2sMove(Boolean(cmd.run), to)]
    }
    case 'WalkToLocation':
      return [encodeC2sMove(false, { x: cmd.x, y: cmd.y })]
    case 'RunToLocation':
      return [encodeC2sMove(true, { x: cmd.x, y: cmd.y })]
    case 'MoveToUnit':
      return [encodeC2sMoveToUnit(cmd.run, cmd.target)]
    case 'MakeEntityMove': {
      const to = (cmd as any).to ?? { x: (cmd as any).x ?? 0, y: (cmd as any).y ?? 0 }
      return [encode0x59MakeEntityMove(cmd.target, to)]
    }
    case 'WalkToTarget':
      return [encodeC2sMoveToUnit(false, { unitType: cmd.unitKind, id: cmd.unitId })]
    case 'RunToTarget':
      return [encodeC2sMoveToUnit(true, { unitType: cmd.unitKind, id: cmd.unitId })]
    case 'UpdatePlayerPos':
      return [encodeC2sUpdatePlayerPos(cmd.x, cmd.y)]
    case 'SkillAt':
      // 1.13c D2Client 0x6faca060: location opcode = f(hand, hold) — 0x05/0x08/0x0C/0x0F, no shift variant.
      return [encodeC2sSkillAt(cmd.hand, cmd.at, cmd.hold)]
    case 'CastSkillAtLocation':
      return [encodeC2sSkillAt(cmd.hand ?? 'right', { x: cmd.x, y: cmd.y }, Boolean(cmd.hold))]
    case 'CastLeftSkillOnLocation':
      // Press, not hold: 0x05 (1.13c D2Client 0x6faca886).
      return [encodeC2sSkillAt('left', { x: cmd.x, y: cmd.y }, false)]
    case 'CastRightSkillOnLocation':
      // Press, not hold: 0x0C (1.13c D2Client 0x6facaa4a).
      return [encodeC2sSkillAt('right', { x: cmd.x, y: cmd.y }, false)]
    case 'SkillOn':
      // 1.13c D2Client 0x6faca060: unit opcode = f(hand, shift, hold) — 0x06/07/09/0A, 0x0D/0E/10/11.
      return [encodeC2sSkillOnUnit(cmd.hand, cmd.target, cmd.shift, cmd.hold)]
    case 'CastSkillOnTarget':
      return [
        encodeC2sSkillOnUnit(
          cmd.hand ?? 'right',
          { unitType: cmd.targetType as any, id: cmd.targetId },
          Boolean(cmd.shift),
          Boolean(cmd.hold),
        ),
      ]
    case 'CastLeftSkillOnTarget':
      return [encodeC2sSkillOnUnit('left', { unitType: cmd.unitKind, id: cmd.unitId }, false, false)]
    case 'CastRightSkillOnTarget':
      return [encodeC2sSkillOnUnit('right', { unitType: cmd.unitKind, id: cmd.unitId }, false, false)]
    case 'SelectSkill':
      return [encodeC2sSelectSkill(cmd.hand, Number(cmd.skill ?? cmd.skillId ?? 0), cmd.itemId)]
    case 'AssignSkillHotkey':
      return [encodeC2sAssignSkillHotkey(cmd.slot, cmd.hand, cmd.skill, cmd.itemId)]
    case 'RunToggle':
      return [encodeC2sRunToggle(cmd.run)]
    case 'Interact':
      return [encodeC2sInteract(cmd.target)]
    case 'InteractEntity': {
      const unitType = cmd.targetType === 'warp' ? 5 : (cmd.targetType as any)
      return [encodeC2sInteract({ unitType, id: cmd.targetId })]
    }
    case 'OperateObject':
      return [encodeC2sInteract({ unitType: 2, id: cmd.objectId })]
    case 'TakeWarp':
      return [encodeC2sWarpTo(cmd.warpId, 5)]
    case 'WarpTo':
      return [encodeC2sWarpTo(cmd.warpId, cmd.unitType ?? 5)]
    case 'ItemPickup':
    case 'PickUpItem':
      return [encodeC2sItemPickup(cmd.itemId, cmd.toCursor)]
    case 'ItemDrop':
      return [encodeC2sItemDrop(cmd.itemId)]
    case 'DropGold':
      return [encodeC2sDropGold(cmd.unitId, cmd.amount)]
    case 'ItemToCursor':
      return [encodeC2sItemToCursor(cmd.itemId)]
    case 'ItemPlace':
      return [encodeC2sItemPlace(cmd.itemId, cmd.x, cmd.y, cmd.buffer)]
    case 'ItemMove': {
      const buf = cmd.container === 'stash' ? 4 : cmd.container === 'cube' ? 3 : 0
      return [encodeC2sItemPlace(cmd.itemId, cmd.x, cmd.y, buf)]
    }
    case 'ItemEquip':
      return [encodeC2sItemEquip(cmd.itemId, Number(cmd.slot ?? cmd.bodyLoc ?? 0))]
    case 'ItemUnequip':
      return [encodeC2sItemUnequip(cmd.slot)]
    case 'ItemSwap':
      return [encodeC2sItemSwap(cmd.itemId, cmd.slot)]
    case 'ItemSwap2Handed':
      return [encodeC2sSwap2HandedItem(cmd.itemId, cmd.slot)]
    case 'ItemSwap2HandedDual':
      return [encodeC2sSwapTwo1HandedWithOne2HandedItem(cmd.itemId, cmd.slot)]
    case 'SwapContainerItem':
      return [encodeC2sSwapContainerItem(cmd.cursorItemId, cmd.targetItemId ?? cmd.replacedItemId ?? 0, cmd.x, cmd.y)]
    case 'BeltPut':
      return [encodeC2sBeltPut(cmd.itemId, cmd.slot)]
    case 'BeltRemove':
      return [encodeC2sBeltRemove(cmd.itemId)]
    case 'BeltSwap':
      return [encodeC2sBeltSwap(cmd.cursorItemId, cmd.beltItemId)]
    case 'BeltUse':
      return [encodeC2sBeltUse(cmd.itemId, Boolean(cmd.shift ?? cmd.useOnMerc))]
    case 'ItemUse':
      return [encodeC2sItemUse(cmd.itemId, cmd.at)]
    case 'SelectMainItem':
      return [encodeC2sSelectMainItem(cmd.itemId)]
    case 'SocketItem':
      return [encodeC2sSocketItem(cmd.itemId, cmd.targetItemId)]
    case 'IdentifyItem':
      return [encodeC2sIdentifyItem(cmd.itemId, cmd.scrollId)]
    case 'ScrollToBook':
      return [encodeC2sScrollToBook(cmd.scrollId, cmd.bookId)]
    case 'ItemToCube':
      return [encodeC2sItemToCube(cmd.itemId, cmd.cubeId)]
    case 'ItemToBelt':
      return [encodeC2sItemToBelt(cmd.itemId)]
    case 'MercItem':
      return [encodeC2sMercItem(cmd.slot)]
    case 'NpcInit':
      return [encodeC2sNpcInit(cmd.target)]
    case 'NpcCancel':
      return [encodeC2sNpcCancel(cmd.target ?? { unitType: 1, id: cmd.npcId ?? 0 })]
    case 'QuestMessage':
      return [encodeC2sQuestMessage(cmd.npcId, cmd.messageId)]
    case 'PlayNpcMessage':
      return [encodeC2sPlayNpcMessage(cmd)]
    case 'NpcOpenTrade':
      return [encodeC2sNpcEntityAction(NpcActionId.Trade, cmd.npcId, 0)]
    case 'NpcOpenGamble':
      return [encodeC2sNpcEntityAction(NpcActionId.Gamble, cmd.npcId, 0)]
    case 'NpcEntityAction':
      return [encodeC2sNpcEntityAction(cmd.action, cmd.npcId, cmd.complement ?? 0)]
    case 'NpcAction': {
      const actionNum =
        typeof cmd.action === 'number'
          ? cmd.action
          : cmd.action === 'gamble'
            ? NpcActionId.Gamble
            : cmd.action === 'hire'
              ? NpcActionId.Hire
              : NpcActionId.Trade
      return [encodeC2sNpcEntityAction(actionNum, cmd.npcId, cmd.complement ?? cmd.param ?? 0)]
    }
    case 'NpcBuy':
      return [
        encodeC2sNpcBuy({
          npcId: cmd.npcId,
          itemId: cmd.itemId,
          itemMode: cmd.itemMode ?? 0,
          gamble: Boolean(cmd.gamble ?? cmd.buyType === 2),
          shiftFill: Boolean(cmd.shiftFill),
          cost: cmd.cost ?? 0,
        }),
      ]
    case 'NpcGamble':
      return [
        encodeC2sNpcBuy({
          npcId: cmd.npcId,
          itemId: cmd.itemId,
          itemMode: 0,
          gamble: true,
          shiftFill: false,
          cost: cmd.cost ?? 0,
        }),
      ]
    case 'NpcSell':
      return [
        encodeC2sNpcSell({
          npcId: cmd.npcId,
          itemId: cmd.itemId,
          itemMode: cmd.itemMode ?? 0,
          cost: cmd.cost ?? 0,
        }),
      ]
    case 'NpcRepairItem':
      return [encodeC2sNpcRepairItem(cmd)]
    case 'NpcRepairAll':
      return [encodeC2sNpcRepairAll(cmd.npcId)]
    case 'NpcHeal':
      return [encodeC2sNpcInit({ unitType: 1, id: cmd.npcId })]
    case 'NpcIdentifyAll':
      return [encodeC2sNpcIdentifyAll(cmd.npcId)]
    case 'NpcIdentifyGamble':
      return [encodeC2sNpcIdentifyGamble(cmd.itemId)]
    case 'NpcResurrectMerc':
    case 'MercResurrect':
      return [encodeC2sNpcResurrectMerc(cmd.npcId)]
    case 'HireMerc':
    case 'MercHire':
      return [encodeC2sHireMerc(cmd.npcId, cmd.mercId)]
    case 'AddStatPoint':
      return [encodeC2sAddStatPoint(cmd.statId, cmd.count)]
    case 'AllocateStat':
      return [encodeC2sAddStatPoint(cmd.statId, cmd.amount ?? cmd.count ?? 1)]
    case 'AddSkillPoint':
    case 'AllocateSkill':
      return [encodeC2sAddSkillPoint(cmd.skillId)]
    case 'WaypointGo':
      return [encodeC2sWaypointGo(cmd.waypointId, cmd.destAreaId)]
    case 'TownPortal':
      // Right-skill location press 0x0C (1.13c D2Client 0x6facaa4a); never a hold repeat.
      return [encodeC2sSkillAt('right', { x: 0, y: 0 }, false)]
    case 'ClickButton': {
      const btn = cmd.button ?? cmd.buttonId ?? 0
      if (cmd.complement !== undefined && cmd.amount === undefined) {
        if (!Number.isInteger(cmd.complement) || cmd.complement < 0 || cmd.complement > 0xffffffff) {
          throw new RangeError(`ClickButton: invalid amount ${cmd.complement}`)
        }
        const comp = cmd.complement >>> 0
        const swapped = (((comp & 0xffff) << 16) | ((comp >>> 16) & 0xffff)) >>> 0
        return [encodeC2sClickButton(btn, swapped)]
      }
      return [encodeC2sClickButton(btn, cmd.amount ?? cmd.complement ?? 0)]
    }
    case 'Party':
    case 'PartyAction':
      return [encodeC2sParty(cmd.action, cmd.targetPlayerId)]
    case 'Hostile':
      return [encodeC2sHostile(cmd.targetPlayerId, cmd.hostile, cmd.button ?? 0x01)]
    case 'Trade':
      return [encodeC2sTrade(cmd.action, cmd.gold)]
    case 'Chat':
      return [encodeC2sChat(cmd.text, cmd.whisperTo, encoding)]
    case 'OverheadChat':
      return [encodeC2sOverheadChat(cmd.text, encoding)]
    case 'Say':
      return [encodeC2sSay(cmd.phraseId)]
    case 'RequestQuestData':
      return [encodeC2sRequestQuestData()]
    case 'StaffInOrifice':
      return [
        encodeC2sStaffInOrifice(
          cmd.orificeObjectId,
          cmd.staffItemId,
          cmd.state,
          cmd.playerUnitId ?? 0xffffffff,
        ),
      ]
    case 'Resurrect':
    case 'Respawn':
      return [encodeC2sResurrect()]
    case 'SwapWeapons':
      return [encodeC2sSwapWeapons()]
    case 'Ping':
      return [encodeC2sPing(tickCount)]
    case 'LeaveGame':
      return [encodeC2sLeaveGame()]
    case 'CancelController':
      return [encodeC2sCancelController()]
    case 'PauseGame':
    case undefined:
      return []
  }
}

export function encodeD2gsC2sCommand(
  cmd: ClientCommand,
  encoding: TextEncoding = 'gbk',
  tickCount = 0,
): Uint8Array {
  const packets = encodeD2gsClientCommand(cmd, encoding, tickCount)
  if (packets.length === 0) {
    throw new ProtocolError(`Failed to encode ClientCommand ${cmd.type}`)
  }
  return packets[0]!
}

export const encodeClientCommand = encodeD2gsClientCommand
export const decodeD2gsServerPacket = decodeD2gsS2cPacket

