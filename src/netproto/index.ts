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
  LocalAreaBootstrap,
  LocalAreaBootstrapResolver,
  LocalAreaLevelGeometry,
  LocalAreaLevelPresetUnit,
  LocalAreaLevelRequest,
  LocalAreaLevelSource,
  LocalAreaLevelWarp,
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
  encodeC2sSwap2HandedDual,
  encodeC2sSwap2HandedItem,
  encodeC2sSwapBodyItem,
  encodeC2sSwapContainerItem,
  encodeC2sSwapEquippedItem,
  encodeC2sSwapTwo1HandedWithOne2HandedItem,
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
  encode0x11UnitOverlay,
} from './d2gs/s2c/units.ts'
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
  resolveS2cPacketSize,
} from './d2gs/framing-s2c.ts'


export {
  DEFAULT_MONSTER_COMP_BIT_WIDTHS,
  MONSTATS2_COMP_BIT_WIDTHS_BY_HCIDX,
  MONSTATS_HCIDX_COUNT,
  getMonsterAnimCompBitWidths,
} from './d2gs/s2c/monstats2-comp-bits.ts'
export { decode0x3EUpdateItemStats } from './d2gs/s2c/stats.ts'
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
  ITEM_FLAG_ETHEREAL,
  ITEM_FLAG_IDENTIFIED,
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
export { D2gsSession, type D2gsSessionOptions, type D2gsSessionState } from './d2gs/session.ts'
export { TsClientAdapter, TsServerAdapter } from './ts/adapter.ts'
export { TsFramer, encodeTsFrame, tsJsonReplacer, tsJsonReviver } from './ts/framing.ts'

import { ByteWriter } from './core/byte-writer.ts'
import { resolveS2cPacketSize } from './d2gs/framing-s2c.ts'
import {
  D2GS_S2C_REGISTRY,
  decodeD2gsS2cPacket,
  encodeD2gsClientCommand,
} from './d2gs/registry.ts'
import { encode0xA3AuraSkill } from './d2gs/s2c/misc.ts'
import { encode0x11UnitOverlay } from './d2gs/s2c/units.ts'
import { encode0x63WaypointMenu } from './d2gs/s2c/waypoint.ts'
import type { ClientCommand } from './domain/client-command.ts'
import { unitTypeToId, type ItemDataTables, type UnitType } from './domain/ids.ts'
import type { ServerEvent } from './domain/server-event.ts'

const EMPTY_ITEM_DATA_TABLES: ItemDataTables = {
  itemStatCost: new Map(),
  armor: new Map(),
  weapons: new Map(),
  misc: new Map(),
  getStatMeta: () => undefined,
  getStatCost: () => undefined,
  getItemBaseMeta: () => undefined,
  getItemMeta: () => undefined,
}

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

export function serverEventToS2cPackets(ev: ServerEvent | Record<string, any>): readonly Uint8Array[] {
  if (!ev || typeof ev !== 'object') return []
  const e = ev as Record<string, any>
  switch (e.type) {
    case 'GameLogonAck':
      return [new Uint8Array([0x04])]

    case 'ActDataLoaded':
    case 'LoadAct': {
      const w = new ByteWriter(12)
      w.u8(0x03)
      w.u8(Number(e.act ?? 0) & 0xff)
      w.u32LE(Number(e.mapSeed ?? 0) >>> 0)
      w.u16LE(Number(e.townAreaId ?? e.areaId ?? 1) & 0xffff)
      w.u32LE(Number(e.unknown ?? e.objectSeed ?? 0) >>> 0)
      return [w.toUint8Array()]
    }

    case 'PlayerAssign':
    case 'EntitySpawn':
    case 'UnitAssign': {
      const rawType = e.unit?.unitType ?? e.unitType ?? (e.type === 'PlayerAssign' ? 0 : 0)
      const uType = typeof rawType === 'string' ? unitTypeToId(rawType as UnitType) : Number(rawType)
      const uId = Number(e.unit?.id ?? e.unitId ?? e.id ?? 1) >>> 0
      const classId = Number(e.unit?.classId ?? e.classId ?? 0)
      const x = Number(e.unit?.x ?? e.x ?? 0) & 0xffff
      const y = Number(e.unit?.y ?? e.y ?? 0) & 0xffff
      if (uType === 0) {
        const w = new ByteWriter(26)
        w.u8(0x59)
        w.u32LE(uId)
        w.u8(classId & 0xff)
        w.fixedString(String(e.unit?.name ?? e.name ?? 'Hero'), 16)
        w.u16LE(x)
        w.u16LE(y)
        return [w.toUint8Array()]
      }
      const w = new ByteWriter(14)
      w.u8(0x51)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u16LE(classId & 0xffff)
      w.u16LE(x)
      w.u16LE(y)
      w.u8(0)
      w.u8(0)
      return [w.toUint8Array()]
    }

    case 'UnitMove': {
      const uType = typeof e.unitType === 'string' ? unitTypeToId(e.unitType as UnitType) : Number(e.unitType ?? 0)
      const uId = Number(e.id ?? e.unitId ?? 1) >>> 0
      const tx = Number(e.to?.x ?? e.targetX ?? e.x ?? 0) & 0xffff
      const ty = Number(e.to?.y ?? e.targetY ?? e.y ?? 0) & 0xffff
      const cx = Number(e.from?.x ?? e.currentX ?? e.x ?? tx) & 0xffff
      const cy = Number(e.from?.y ?? e.currentY ?? e.y ?? ty) & 0xffff
      if (e.mode === 'stop') {
        if (uType === 1) {
          const w = new ByteWriter(10)
          w.u8(0x6d)
          w.u32LE(uId)
          w.u16LE(tx)
          w.u16LE(ty)
          w.u8(Number(e.lifePct ?? 128) & 0xff)
          return [w.toUint8Array()]
        }
        const w = new ByteWriter(13)
        w.u8(0x0d)
        w.u8(uType & 0xff)
        w.u32LE(uId)
        w.u8(0x07)
        w.u16LE(tx)
        w.u16LE(ty)
        w.u8(Number(e.hitClass ?? 0) & 0xff)
        w.u8(Number(e.lifePct ?? 128) & 0xff)
        return [w.toUint8Array()]
      }
      const defaultMoveType =
        e.mode === 'walk'
          ? 0x01
          : e.mode === 'knockback'
            ? 0x13
            : 0x17
      const w = new ByteWriter(16)
      w.u8(0x0f)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u8(Number(e.moveType ?? defaultMoveType) & 0xff)
      w.u16LE(tx)
      w.u16LE(ty)
      w.u8(0)
      w.u16LE(cx)
      w.u16LE(cy)
      return [w.toUint8Array()]
    }

    case 'UnitReassign': {
      const uType = typeof e.unitType === 'string' ? unitTypeToId(e.unitType as UnitType) : Number(e.unitType ?? 0)
      const uId = Number(e.id ?? e.unitId ?? 1) >>> 0
      const x = Number(e.at?.x ?? e.x ?? 0) & 0xffff
      const y = Number(e.at?.y ?? e.y ?? 0) & 0xffff
      const w = new ByteWriter(11)
      w.u8(0x15)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u16LE(x)
      w.u16LE(y)
      w.u8(e.snap || e.revalidate ? 1 : 0)
      return [w.toUint8Array()]
    }

    case 'EntityRemove':
    case 'UnitRemove': {
      const uType = typeof e.unitType === 'string' ? unitTypeToId(e.unitType as UnitType) : Number(e.unitType ?? 1)
      const uId = Number(e.id ?? e.unitId ?? 0) >>> 0
      const w = new ByteWriter(6)
      w.u8(0x0a)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      return [w.toUint8Array()]
    }

    case 'ChatMessage':
    case 'Chat': {
      const speaker = String(e.speaker ?? e.from ?? 'Server')
      const text = String(e.text ?? '')
      const w = new ByteWriter(10 + speaker.length + 1 + text.length + 1)
      w.u8(0x26)
      w.u8(0x01)
      w.u8(0x00)
      w.u8(0x02)
      w.u32LE(0)
      w.u8(0x01)
      w.u8(0x00)
      w.cstring(speaker)
      w.cstring(text)
      return [w.toUint8Array()]
    }

    case 'SoundEvent':
    case 'PlaySound': {
      const uType = e.unit ? unitTypeToId(e.unit.unitType) : Number(e.unitType ?? 0)
      const uId = Number(e.unit?.id ?? e.unitId ?? 1) >>> 0
      const sound = Number(e.sound ?? e.soundId ?? 1) & 0xffff
      const w = new ByteWriter(8)
      w.u8(0x2c)
      w.u8(uType & 0xff)
      w.u32LE(uId)
      w.u16LE(sound)
      return [w.toUint8Array()]
    }

    case 'UnitOverlay': {
      const rawUnitType =
        typeof e.rawUnitType === 'number'
          ? e.rawUnitType
          : typeof e.unitType === 'string'
            ? unitTypeToId(e.unitType as UnitType)
            : Number(e.unitType ?? 0)
      return [
        encode0x11UnitOverlay({
          rawUnitType,
          id: Number(e.id ?? e.unitId ?? 1) >>> 0,
          overlayIndex: Number(e.overlayIndex ?? 0) & 0xffff,
        }),
      ]
    }

    case 'UnitSkillEvent': {
      return [
        encode0xA3AuraSkill({
          flag: Number(e.flag ?? 0),
          skill: Number(e.skill ?? 0),
          level: Number(e.level ?? 1),
          caster: {
            rawUnitType: Number(e.caster?.rawUnitType ?? e.caster?.unitType ?? 0),
            id: Number(e.caster?.id ?? 1),
          },
          target: {
            rawUnitType: Number(e.target?.rawUnitType ?? e.target?.unitType ?? 1),
            id: Number(e.target?.id ?? 0),
          },
          x: Number(e.x ?? 0),
          y: Number(e.y ?? 0),
        }),
      ]
    }

    case 'WaypointMenu': {
      return [
        encode0x63WaypointMenu({
          unitId: Number(e.unitId) >>> 0,
          open: e.open as readonly number[],
        }),
      ]
    }

    default:
      return [new Uint8Array([0x04])]
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
      const expectedSize = resolveS2cPacketSize(raw, 0)
      if (expectedSize === null || raw.byteLength < expectedSize) {
        return { ok: false, error: `Truncated S2C packet 0x${opcode.toString(16).padStart(2, '0')}` }
      }
      const ev = decodeD2gsS2cPacket(raw.subarray(0, expectedSize), {
        tables: EMPTY_ITEM_DATA_TABLES,
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
