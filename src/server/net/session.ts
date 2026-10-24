/**
 * Per-Client Transport Session (`src/server/net/session.ts`).
 *
 * Bridges a `ByteStream` speaking either `'ts'` (`TsFramer` / `encodeTsFrame`) or `'d2gs'`
 * (`D2gsC2sFramer` / `serverEventToS2cPackets`) to `MultiClientRoomHost`.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import {
  ByteReader,
  D2gsC2sFramer,
  TsFramer,
  TypedEmitter,
  encodeTsFrame,
  serverEventToS2cPackets,
  type ByteStream,
  type ClientCommand,
  type CloseReason,
  type ServerEvent,
} from '../../netproto/index.ts'

export type RoomWireProtocol = 'ts' | 'd2gs'

export interface RoomClientSessionOptions {
  readonly sessionId: number
  readonly playerUnitId: number
  readonly charName: string
  readonly classId: number
  readonly stream: ByteStream
  readonly protocol?: RoomWireProtocol | undefined
  readonly onCommand: (session: RoomClientSession, cmd: ClientCommand) => void
  readonly onDisconnect: (session: RoomClientSession, reason: CloseReason) => void
}

export function decodeD2gsC2sPacketToCommand(pkt: Uint8Array): ClientCommand | null {
  if (pkt.byteLength === 0) return null
  const r = new ByteReader(pkt)
  const op = r.u8()

  switch (op) {
    case 0x01: {
      const x = r.u16LE()
      const y = r.u16LE()
      return { type: 'Move', x, y, to: { x, y }, run: false }
    }
    case 0x02: {
      const unitType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const id = r.u32LE()
      return { type: 'MoveToUnit', run: false, target: { unitType, id } }
    }
    case 0x03: {
      const x = r.u16LE()
      const y = r.u16LE()
      return { type: 'Move', x, y, to: { x, y }, run: true }
    }
    case 0x04: {
      const unitType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const id = r.u32LE()
      return { type: 'MoveToUnit', run: true, target: { unitType, id } }
    }
    case 0x05:
    case 0x08:
    case 0x0c:
    case 0x0f: {
      const x = r.u16LE()
      const y = r.u16LE()
      const hand = op === 0x05 || op === 0x08 ? 'left' : 'right'
      return { type: 'CastSkillAtLocation', skillId: 0, hand, x, y }
    }
    case 0x06:
    case 0x07:
    case 0x09:
    case 0x0a:
    case 0x0d:
    case 0x0e:
    case 0x10:
    case 0x11: {
      const targetType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const targetId = r.u32LE()
      const hand = op <= 0x0a ? 'left' : 'right'
      return { type: 'CastSkillOnTarget', skillId: 0, hand, targetType, targetId }
    }
    case 0x13: {
      const targetType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const targetId = r.u32LE()
      return { type: 'InteractEntity', targetType, targetId }
    }
    case 0x14: {
      r.u16LE()
      const text = r.cString('gbk')
      return { type: 'OverheadChat', text }
    }
    case 0x15: {
      r.u8()
      r.u8()
      const text = r.cString('gbk')
      const whisperTo = r.remaining > 0 ? r.cString('gbk') : ''
      return {
        type: 'Chat',
        text,
        ...(whisperTo.length > 0 ? { whisperTo } : {}),
      }
    }
    case 0x16: {
      r.u32LE()
      const itemId = r.u32LE()
      const toCursor = r.u32LE() !== 0
      return { type: 'ItemPickup', itemId, toCursor }
    }
    case 0x17: {
      const itemId = r.u32LE()
      return { type: 'ItemDrop', itemId }
    }
    case 0x18: {
      const itemId = r.u32LE()
      const x = r.u32LE()
      const y = r.u32LE()
      const buffer = r.u32LE()
      return { type: 'ItemPlace', itemId, x, y, buffer }
    }
    case 0x19: {
      const itemId = r.u32LE()
      return { type: 'ItemToCursor', itemId }
    }
    case 0x1a: {
      const itemId = r.u32LE()
      const slot = r.u16LE()
      return { type: 'ItemEquip', itemId, slot }
    }
    case 0x1b: {
      const itemId = r.u32LE()
      const slot = r.u16LE()
      return { type: 'ItemSwap2Handed', itemId, slot }
    }
    case 0x1c: {
      const slot = r.u16LE()
      return { type: 'ItemUnequip', slot }
    }
    case 0x1d: {
      const itemId = r.u32LE()
      const slot = r.u16LE()
      return { type: 'ItemSwap', itemId, slot }
    }
    case 0x1e: {
      const itemId = r.u32LE()
      const slot = r.u16LE()
      return { type: 'ItemSwap2HandedDual', itemId, slot }
    }
    case 0x20: {
      const itemId = r.u32LE()
      const x = r.u32LE()
      const y = r.u32LE()
      return { type: 'ItemUse', itemId, at: { x, y } }
    }
    case 0x23: {
      const itemId = r.u32LE()
      const slot = r.u32LE()
      return { type: 'BeltPut', itemId, slot }
    }
    case 0x24: {
      const itemId = r.u32LE()
      return { type: 'BeltRemove', itemId }
    }
    case 0x26: {
      const itemId = r.u32LE()
      const shift = r.u32LE() !== 0
      return { type: 'BeltUse', itemId, shift }
    }
    case 0x2f: {
      const unitType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const id = r.u32LE()
      return { type: 'NpcInit', target: { unitType, id } }
    }
    case 0x30: {
      const unitType = r.u32LE() as 0 | 1 | 2 | 3 | 4 | 5
      const id = r.u32LE()
      return { type: 'NpcCancel', target: { unitType, id }, npcId: id }
    }
    case 0x32: {
      const npcId = r.u32LE()
      const itemId = r.u32LE()
      const buffer = r.u32LE()
      const cost = r.u32LE()
      const gamble = ((buffer >>> 16) & 0x02) !== 0
      return { type: 'NpcBuy', npcId, itemId, cost, gamble }
    }
    case 0x33: {
      const npcId = r.u32LE()
      const itemId = r.u32LE()
      const itemMode = r.u32LE()
      const cost = r.u32LE()
      return { type: 'NpcSell', npcId, itemId, itemMode, cost }
    }
    case 0x38: {
      const action = r.u32LE()
      const npcId = r.u32LE()
      const complement = r.u32LE()
      return { type: 'NpcAction', action, npcId, complement }
    }
    case 0x3a: {
      const word = r.u16LE()
      const statId = word & 0xff
      const amount = Math.max(1, (word >>> 8) & 0xff)
      return { type: 'AllocateStat', statId, amount }
    }
    case 0x3b: {
      const skillId = r.u16LE()
      return { type: 'AllocateSkill', skillId }
    }
    case 0x3c: {
      const skill = r.u16LE()
      r.u8()
      const handByte = r.u8()
      const itemId = r.u32LE()
      const hand = handByte === 0x80 ? 'left' : 'right'
      return { type: 'SelectSkill', hand, skill, skillId: skill, itemId }
    }
    case 0x41:
      return { type: 'Respawn' }
    case 0x49: {
      const waypointId = r.u32LE()
      const destAreaId = r.u32LE()
      return { type: 'WaypointGo', waypointId, destAreaId }
    }
    case 0x5e: {
      const action = r.u8()
      const targetPlayerId = r.u32LE()
      return { type: 'PartyAction', action, targetPlayerId }
    }
    case 0x5f: {
      const x = r.u16LE()
      const y = r.u16LE()
      return { type: 'UpdatePlayerPos', x, y }
    }
    case 0x60:
      return { type: 'SwapWeapons' }
    case 0x69:
      return { type: 'LeaveGame' }
    case 0x6d:
      return { type: 'Ping' }
    case 0x68:
    case 0x6b:
      return null
    default:
      return null
  }
}

export class RoomClientSession {
  readonly sessionId: number
  readonly playerUnitId: number
  readonly charName: string
  readonly classId: number
  readonly stream: ByteStream

  private resolvedProtocol: RoomWireProtocol
  private readonly explicitProtocol: boolean
  private readonly tsFramer = new TsFramer<ClientCommand>()
  private readonly d2gsFramer = new D2gsC2sFramer()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly onCommand: (session: RoomClientSession, cmd: ClientCommand) => void
  private readonly onDisconnect: (session: RoomClientSession, reason: CloseReason) => void

  private closed = false
  private protocolErrorCount = 0
  private bytesInCount = 0
  private bytesOutCount = 0

  constructor(options: RoomClientSessionOptions) {
    this.sessionId = options.sessionId
    this.playerUnitId = options.playerUnitId
    this.charName = options.charName
    this.classId = options.classId
    this.stream = options.stream
    this.explicitProtocol = options.protocol !== undefined
    this.resolvedProtocol = options.protocol ?? 'ts'
    this.onCommand = options.onCommand
    this.onDisconnect = options.onDisconnect

    this.stream.onData((chunk) => this.handleIncomingChunk(chunk))
    this.stream.onClose((reason) => this.handleStreamClose(reason))
  }

  get protocol(): RoomWireProtocol {
    return this.resolvedProtocol
  }

  get isClosed(): boolean {
    return this.closed
  }

  get protocolErrors(): number {
    return this.protocolErrorCount
  }

  get bytesIn(): number {
    return this.bytesInCount
  }

  get bytesOut(): number {
    return this.bytesOutCount
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    if (this.closed || chunk.byteLength === 0) return
    this.bytesInCount += chunk.byteLength

    if (!this.explicitProtocol) {
      // Auto-detect binary D2GS vs TsFramer JSON on first incoming chunk:
      // TsFramer frames start with 4-byte uint32LE length followed by '{' (0x7B).
      const looksLikeTsJson = chunk.byteLength >= 5 && chunk[4] === 0x7b
      if (!looksLikeTsJson && chunk[0] === 0x6b) {
        this.resolvedProtocol = 'd2gs'
      }
    }

    try {
      if (this.resolvedProtocol === 'd2gs') {
        const packets = this.d2gsFramer.push(chunk)
        for (const pkt of packets) {
          const cmd = decodeD2gsC2sPacketToCommand(pkt)
          if (cmd) {
            this.onCommand(this, cmd)
          }
        }
      } else {
        const commands = this.tsFramer.push(chunk)
        for (const cmd of commands) {
          if (!cmd || typeof cmd !== 'object' || typeof (cmd as ClientCommand).type !== 'string') {
            throw new Error('Invalid TS ClientCommand frame')
          }
          this.onCommand(this, cmd)
        }
      }
    } catch (err) {
      this.protocolErrorCount++
      const error = err instanceof Error ? err : new Error(String(err))
      this.disconnect({ kind: 'error', error })
    }
  }

  sendEvent(ev: ServerEvent): void {
    if (this.closed) return
    try {
      if (this.resolvedProtocol === 'd2gs') {
        const packets = serverEventToS2cPackets(ev)
        for (const pkt of packets) {
          this.bytesOutCount += pkt.byteLength
          this.stream.write(pkt)
        }
      } else {
        const frame = encodeTsFrame(ev)
        this.bytesOutCount += frame.byteLength
        this.stream.write(frame)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.disconnect({ kind: 'error', error })
    }
  }

  private handleStreamClose(reason: CloseReason): void {
    if (this.closed) return
    this.closed = true
    this.closeEmitter.emit(reason)
    this.onDisconnect(this, reason)
  }

  disconnect(reason: CloseReason = { kind: 'local' }): void {
    if (this.closed) return
    this.closed = true
    try {
      this.stream.close(reason)
    } catch {
      // Ignore stream close errors
    }
    this.closeEmitter.emit(reason)
    this.onDisconnect(this, reason)
  }
}
