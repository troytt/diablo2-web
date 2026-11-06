/**
 * Public exports of `src/netproto/index.ts` (PROJECT.md § Interface Contracts).
 * Exposes ONLY protocol-neutral domain types, flow orchestration, and transport resolvers.
 */

export type { ByteStream, CloseReason } from './transport/byte-stream.ts'
export type {
  EndpointKind,
  EndpointResolver,
  EndpointRole,
  MixedResolverOptions,
  NetChannel,
  TcpOpener,
  TcpResolverOptions,
  WsBridgeResolverOptions,
} from './transport/endpoint.ts'
export type {
  D2OnlineConfig,
  D2OnlineConfig as OnlineConfig,
  D2OnlineSessionKind,
  D2OnlineSessionLost,
  D2OnlineSessionLostCause,
  D2OnlineState,
} from './flow/config.ts'
export type { D2OnlineFlow } from './flow/online-flow.ts'
export type { GameServerAdapter, GameServerStats } from './domain/game-server-adapter.ts'
export type { NpcCommandPayload113c, ServerEvent, StateSetEntry } from './domain/server-event.ts'
export type { ClientCommand, PauseGameCommand } from './domain/client-command.ts'
export type {
  CharClassId,
  Hand,
  ItemActionId,
  ItemBaseMeta,
  ItemBaseStatEntry,
  ItemContainer,
  ItemData,
  ItemDataTables,
  ItemQuality,
  ItemQualityLevel,
  ItemStat,
  ItemStatCostField,
  ItemStatCostMeta,
  Pt,
  SetBonusStatList,
  SkillLevel,
  SubTile,
  UnitId,
  UnitKind,
  UnitRef,
  UnitSnapshot,
  UnitType,
  UnitTypeId,
  UnitTypeName,
} from './domain/ids.ts'
export type {
  CharCreateSpec,
  CharSummary,
  CharacterManageResult,
  CharacterSummary,
  ChatEvent,
  ChatEventKind,
  CreateCharacterForm,
  CreateCharacterInput,
  CreateGameForm,
  GameCreateSpec,
  GameDifficulty,
  GameInfoDetail,
  GameListEntry,
  GameSummary,
  JoinGameForm,
  ListGamesOptions,
  LobbyCharacterSummary,
  LobbyEnterGameTarget,
  LobbyGameListItem,
  LobbyGameMode,
  LobbyProvider,
  LocalAreaActSpawn,
  LocalAreaBootstrap,
  LocalAreaBootstrapResolver,
  LocalAreaLevelGeometry,
  LocalAreaLevelPresetUnit,
  LocalAreaLevelRequest,
  LocalAreaLevelSource,
  LocalAreaLevelWarp,
  LocalAreaMapAiNode,
  LocalAreaPresetMonster,
  LocalAreaPresetObject,
  LocalAreaRoomRect,
  LocalAreaRoomReveal,
  LocalAreaWarp,
  LocalServerFactory,
  LocalServerOptions,
  LocalServerSessionFactory,
  LocalServerSessionHandle,
  LocalServerSessionRequest,
  RealmInfo,
  RealmSummary,
} from './domain/lobby.ts'
export type {
  D2CapHeader,
  D2CapRecord,
  PacketConn,
  PacketDirection,
  PacketTap,
  PacketTapConn,
  PacketTapDir,
  PacketTapEntry,
} from './core/packet-tap.ts'
export type { Clock } from './core/clock.ts'
export type { SupportedTextEncoding, TextCodec, TextEncoding } from './core/text-codec.ts'

export {
  CHAR_CLASS_NAMES,
  UNIT_TYPE_FROM_ID,
  UNIT_TYPE_TO_ID,
  asSubTile,
  asUnitId,
  unitTypeFromId,
  unitTypeToId,
} from './domain/ids.ts'
export { createD2OnlineFlow } from './flow/online-flow.ts'
export {
  createMixedResolver,
  createTcpResolver,
  createWsBridgeResolver,
  directTcpResolver,
  getActiveWssBnetConnections,
  mixedResolver,
  registerDefaultTcpOpener,
  tcpResolver,
  wsBridgeResolver,
} from './transport/endpoint.ts'
export {
  MemoryStream,
  MemoryStream as InMemoryByteStream,
  MemoryStream as InMemoryDuplexStream,
  createMemoryStreamPair,
  createMemoryStreamPair as createInMemoryByteStreamPair,
  createMemoryStreamPair as createInMemoryDuplexPair,
} from './transport/memory-stream.ts'
export { BitReader } from './core/bit-reader.ts'
export { BitWriter } from './core/bit-writer.ts'
export { ByteReader } from './core/byte-reader.ts'
export { ByteWriter } from './core/byte-writer.ts'
export { TypedEmitter } from './core/emitter.ts'
export {
  BncsCreateAccountError,
  ClosedError,
  NetprotoError,
  ProtocolError,
  TimeoutError,
  type NetprotoErrorOptions,
} from './core/errors.ts'
export {
  InMemoryPacketTap,
  MemoryPacketTap,
  bytesToHex,
  formatD2CapEntry,
  formatD2CapHeader,
  hexToBytes,
  parseD2CapJsonl,
} from './core/packet-tap.ts'
export {
  createBrowserTextCodec,
  defaultTextCodec,
  resolveTextCodec,
  unwrapStormWin1252GbkString,
} from './core/text-codec.ts'
export { defaultClock, systemClock } from './core/clock.ts'
export { BncsFramer, encodeBncsFrame } from './bncs/framing.ts'
export {
  BncsCreateAccountStatus,
  BncsOpcode,
  decodeBncsS2cPacket,
  encodeBncsChatCommand,
  encodeBncsCreateAccount2,
  encodeBncsNull,
} from './bncs/packets.ts'
export { BNCS_KEEPALIVE_INTERVAL_MS } from './bncs/session.ts'
export { McpFramer } from './mcp/framing.ts'
export { decodeMcpS2cPacket } from './mcp/packets.ts'
export { resolveC2sPacketSize, validateC2sPacket } from './d2gs/framing-c2s.ts'
export {
  D2GS_CHAT_LOCALE_CHI,
  D2GS_CHAT_LOCALE_ENG,
  encodeC2sChat,
  encodeC2sOverheadChat,
  encodeC2sSay,
  resolveD2gsChatLocale,
} from './d2gs/c2s/chat.ts'
export {
  ClickButtonId,
  encodeC2sCancelController,
  encodeC2sClickButton,
  encodeC2sInteract,
  encodeC2sRequestQuestData,
  encodeC2sResurrect,
  encodeC2sSwapWeapons,
  encodeC2sWaypointGo,
} from './d2gs/c2s/interact.ts'
export {
  encodeC2sBeltPut,
  encodeC2sBeltRemove,
  encodeC2sBeltSwap,
  encodeC2sBeltUse,
  encodeC2sDropGold,
  encodeC2sIdentifyItem,
  encodeC2sItemDrop,
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
  encodeC2sStackItems,
  encodeC2sSwap2HandedDual,
  encodeC2sSwap2HandedItem,
  encodeC2sSwapBodyItem,
  encodeC2sSwapContainerItem,
  encodeC2sSwapEquippedItem,
  encodeC2sSwapTwo1HandedWithOne2HandedItem,
  encodeC2sUnstackItems,
} from './d2gs/c2s/items.ts'
export {
  encode0x59MakeEntityMove,
  encodeC2sMove,
  encodeC2sMoveToUnit,
  encodeC2sRunToggle,
  encodeC2sWarpTo,
} from './d2gs/c2s/movement.ts'

export {
  NPC_BUY_FLAG_GAMBLE,
  NPC_BUY_FLAG_SHIFT_FILL,
  NPC_REPAIR_ALL_FLAG,
  NpcActionId,
  encode0x4DPlayNpcMessage,
  encodeC2sHireMerc,
  encodeC2sNpcBuy,
  encodeC2sNpcCancel,
  encodeC2sNpcEntityAction,
  encodeC2sNpcIdentifyAll,
  encodeC2sNpcIdentifyGamble,
  encodeC2sNpcInit,
  encodeC2sNpcMercHire,
  encodeC2sNpcMercResurrect,
  encodeC2sNpcRepairAll,
  encodeC2sNpcRepairItem,
  encodeC2sNpcResurrectMerc,
  encodeC2sNpcSell,
  encodeC2sPlayNpcMessage,
  encodeC2sQuestMessage,
  type NpcBuyParams,
  type NpcRepairItemParams,
  type NpcSellParams,
} from './d2gs/c2s/npc.ts'
export {
  decode0x27NpcInfo,
  decode0x2ANpcTransaction,
  decode0x91NpcMenu,
  decode0x91SetNpcTalk,
  decode0xABNpcHeal,
} from './d2gs/s2c/npc.ts'
export {
  encodeC2sHostile,
  encodeC2sParty,
  encodeC2sPartyAction,
} from './d2gs/c2s/party.ts'
export {
  encodeC2sEnterGame,
  encodeC2sGameLogon,
  encodeC2sLeaveGame,
  encodeC2sPing,
  type D2gsGameLogonParams,
} from './d2gs/c2s/session.ts'
export {
  encodeC2sAddSkillPoint,
  encodeC2sAddStatPoint,
  encodeC2sAssignSkillHotkey,
  encodeC2sSelectSkill,
  encodeC2sSkillAt,
  encodeC2sSkillOnUnit,
} from './d2gs/c2s/skills.ts'
export { encodeC2sTrade } from './d2gs/c2s/trade.ts'
export { encodeC2sRequestEntityUpdate, encodeC2sUpdatePlayerPos } from './d2gs/c2s/position.ts'
export {
  decode0x58OpenUi,
  decode0x61CanGoToAct,
  decode0x73CreateMissile,
  decode0xA3AuraSkill,
  decode0xA4MonsterSpecial,
  decodeRare113cS2cPacket,
  encode0xA3AuraSkill,
} from './d2gs/s2c/misc.ts'
export {
  decode0x11UnitOverlay,
  decode0xACAssignNpc,
  encode0x11UnitOverlay,
  encode0xACAssignNpc,
} from './d2gs/s2c/units.ts'
export { decode0x9C0x9DItemAction } from './d2gs/s2c/items.ts'
export {
  decode0x63WaypointMenu,
  encode0x63WaypointMenu,
} from './d2gs/s2c/waypoint.ts'
export { C2S_PACKET_SIZES, S2C_PACKET_SIZES } from './d2gs/tables/s2c-sizes.ts'
export {
  D2GS_S2C_REGISTRY,
  decodeD2gsS2cPacket,
  decodeD2gsServerPacket,
  encodeClientCommand,
  encodeD2gsC2sCommand,
  encodeD2gsClientCommand,
  type D2gsDecodeContext,
  type D2gsS2cRegistryEntry,
} from './d2gs/registry.ts'
export {
  D2gsS2cFramer,
  resolveFramedS2cPacketSize,
  resolveS2cPacketSize,
} from './d2gs/framing-s2c.ts'


export {
  DEFAULT_MONSTER_COMP_BIT_WIDTHS,
  MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX,
  MONSTATS_HCIDX_COUNT,
  getMonsterAnimCompBitWidths,
} from './d2gs/s2c/monstats2-comp-bits.ts'
export {
  decode0x3EUpdateItemStats,
  encode0x18LifeManaRegen,
  encode0x1D_0x1E_0x1FStat,
  encode0x95LifeMana,
  encode0x95LifeManaPot,
} from './d2gs/s2c/stats.ts'
export {
  decode0x21UpdateSkill,
  decode0x22UpdateSkillStatus,
  decode0x7BAssignSkillHotkey,
} from './d2gs/s2c/skills.ts'
export { decode0x28QuestInfo } from './d2gs/s2c/quest.ts'
export { decode0x75PlayerPartyInfo } from './d2gs/s2c/party.ts'
export { decode0x81AssignMerc } from './d2gs/s2c/merc.ts'
export { encodeMcpGameList } from './mcp/packets.ts'
export {
  decodeD2gsItemPacket,
  decodeItemBitstream,
  decodeItemBitstreamWithLength,
  encodeD2gsItemPacket,
  encodeItemBitstream,
  type DecodeItemBitstreamOptions,
  type DecodedItemBitstreamResult,
  type ItemBitstreamEncodeOptions,
  type ItemPacketHeaderMeta,
} from './d2gs/items/item-bitstream.ts'
export {
  ITEM_FLAG_COMPACT,
  ITEM_FLAG_DELETED,
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
  ITEM_FLAG_INSOCKET,
  ITEM_FLAG_RUNEWORD,
  ITEM_FLAG_SIMPLE_EXTENDED,
  ITEM_FLAG_SOCKETED,
} from './d2gs/items/item-types.ts'
export {
  createLocalServerSession,
  getLocalLobbyProvider,
  getLocalServerFactory,
  registerLocalLobbyProvider,
  registerLocalServerFactory,
} from './domain/lobby.ts'
export {
  D2gsAdapter,
  D2gsAdapter as D2gsServerAdapter,
  type D2gsAdapterOptions,
  type D2gsStreamAdapterOptions,
} from './d2gs/adapter.ts'
export { D2gsC2sFramer } from './d2gs/framing-c2s.ts'
export {
  D2gsHuffmanCodec,
  defaultD2gsHuffmanCodec,
  encodeD2gsCompressedFrame,
  encodeD2gsCompressedPackets,
  parseD2gsBlockHeader,
  wrapD2gsCompressedBlock,
} from './d2gs/compression.ts'
export { D2gsSession, type D2gsSessionOptions, type D2gsSessionState } from './d2gs/session.ts'
export {
  encodeTypedServerEventToS2cPackets,
  serverEventToS2cPackets,
} from './d2gs/s2c-encoder.ts'
export { getDefault113cItemDataTables } from './d2gs/tables/item-tables-113c.ts'
export { TsClientAdapter, TsServerAdapter } from './ts/adapter.ts'
export { TsFramer, encodeTsFrame, tsJsonReplacer, tsJsonReviver } from './ts/framing.ts'

import { resolveFramedS2cPacketSize } from './d2gs/framing-s2c.ts'
import {
  D2GS_S2C_REGISTRY,
  decodeD2gsS2cPacket,
  encodeD2gsClientCommand,
} from './d2gs/registry.ts'
import { getDefault113cItemDataTables } from './d2gs/tables/item-tables-113c.ts'
import type { ClientCommand } from './domain/client-command.ts'
import type { ServerEvent } from './domain/server-event.ts'

export function clientCommandToC2sPackets(cmd: ClientCommand | Record<string, any>): readonly Uint8Array[] {
  if (!cmd || typeof cmd !== 'object') return []
  const c = cmd as Record<string, any>
  if (c.type === 'PlayerMove') {
    return encodeD2gsClientCommand({
      type: 'RunToLocation',
      x: Number(c.targetX ?? c.x ?? 0),
      y: Number(c.targetY ?? c.y ?? 0),
    })
  }
  try {
    return encodeD2gsClientCommand(cmd as ClientCommand) ?? []
  } catch {
    return []
  }
}

export function encodePacket(
  pkt: Uint8Array | { readonly opcode?: number; readonly payload?: Uint8Array; readonly bytes?: Uint8Array },
): Uint8Array {
  if (pkt instanceof Uint8Array) return pkt
  if (pkt.bytes instanceof Uint8Array) return pkt.bytes
  const payload = pkt.payload ?? new Uint8Array(0)
  const out = new Uint8Array(1 + payload.byteLength)
  out[0] = (pkt.opcode ?? 0) & 0xff
  out.set(payload, 1)
  return out
}

export function decodePacket(
  raw: Uint8Array,
  direction: 'S2C' | 'C2S' = 'S2C',
): { readonly ok: boolean; readonly opcode?: number; readonly event?: ServerEvent; readonly error?: string } {
  if (!(raw instanceof Uint8Array) || raw.byteLength === 0) {
    return { ok: false, error: 'Empty packet buffer' }
  }
  const opcode = raw[0]!
  if (direction === 'S2C') {
    const entry = D2GS_S2C_REGISTRY[opcode]
    if (!entry) {
      return { ok: false, error: `Unregistered S2C opcode 0x${opcode.toString(16).padStart(2, '0')}` }
    }
    try {
      const expectedSize = resolveFramedS2cPacketSize(raw)
      if (expectedSize === null || raw.byteLength < expectedSize) {
        return { ok: false, error: `Truncated S2C packet 0x${opcode.toString(16).padStart(2, '0')}` }
      }
      const ev = decodeD2gsS2cPacket(raw.subarray(0, expectedSize), {
        tables: getDefault113cItemDataTables(),
        encoding: 'gbk',
        rttMs: 0,
      })
      if (ev.type === 'Opaque') {
        return { ok: false, error: `Opaque S2C packet 0x${opcode.toString(16).padStart(2, '0')}` }
      }
      return { ok: true, opcode, event: ev }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
  if (opcode === 0x00 || opcode > 0x6d) {
    return { ok: false, error: `Unregistered C2S opcode 0x${opcode.toString(16).padStart(2, '0')}` }
  }
  return { ok: true, opcode }
}
