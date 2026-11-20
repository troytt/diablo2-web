/**
 * Per-Client Transport Session (`src/server/net/session.ts`).
 *
 * Bridges a `ByteStream` speaking either `'ts'` (`TsFramer` / `encodeTsFrame`) or `'d2gs'`
 * (`[0xAF, 0x01]` greeting -> `0x68 GameLogon` -> compressed `0x01 GameFlags + 0x02 GameLogonSuccess`
 * -> `0x6B EnterGame` -> Huffman-compressed `D2gsC2sFramer` / `serverEventToS2cPackets`) to
 * `MultiClientRoomHost`.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import {
  ByteReader,
  ByteWriter,
  D2gsC2sFramer,
  TsFramer,
  TypedEmitter,
  encodeD2gsCompressedPackets,
  encodeTsFrame,
  serverEventToS2cPackets,
  type ByteStream,
  type ClientCommand,
  type CloseReason,
  type Hand,
  type ServerEvent,
} from '../../netproto/index.ts'

export type RoomWireProtocol = 'ts' | 'd2gs'

export type D2gsServerHandshakeState = 'awaiting_logon' | 'awaiting_enter' | 'ingame'

export interface RoomClientSessionOptions {
  readonly sessionId: number
  readonly playerUnitId: number
  readonly charName: string
  readonly classId: number
  readonly stream: ByteStream
  readonly protocol?: RoomWireProtocol | undefined
  readonly difficulty?: number | undefined
  readonly expansion?: boolean | undefined
  readonly hardcore?: boolean | undefined
  readonly ladder?: boolean | undefined
  readonly onCommand: (session: RoomClientSession, cmd: ClientCommand) => void
  readonly onDisconnect: (session: RoomClientSession, reason: CloseReason) => void
}

function asRawUnitType(v: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const n = v >>> 0
  return (n <= 5 ? n : 1) as 0 | 1 | 2 | 3 | 4 | 5
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
      const unitType = asRawUnitType(r.u32LE())
      const id = r.u32LE()
      return { type: 'MoveToUnit', run: false, target: { unitType, id } }
    }
    case 0x03: {
      const x = r.u16LE()
      const y = r.u16LE()
      return { type: 'Move', x, y, to: { x, y }, run: true }
    }
    case 0x04: {
      const unitType = asRawUnitType(r.u32LE())
      const id = r.u32LE()
      return { type: 'MoveToUnit', run: true, target: { unitType, id } }
    }
    case 0x05:
    case 0x08:
    case 0x0c:
    case 0x0f: {
      const x = r.u16LE()
      const y = r.u16LE()
      const hand: Hand = op === 0x05 || op === 0x08 ? 'left' : 'right'
      const hold = op === 0x08 || op === 0x0f
      return { type: 'SkillAt', hand, at: { x, y }, hold }
    }
    case 0x06:
    case 0x07:
    case 0x09:
    case 0x0a:
    case 0x0d:
    case 0x0e:
    case 0x10:
    case 0x11: {
      const rawType = r.u32LE()
      const id = r.u32LE()
      if (op === 0x09 && rawType === 5) {
        return { type: 'WarpTo', warpId: id, unitType: 5 }
      }
      const hand: Hand = op <= 0x0a ? 'left' : 'right'
      const shift = op === 0x07 || op === 0x0a || op === 0x0e || op === 0x11
      const hold = op === 0x09 || op === 0x0a || op === 0x10 || op === 0x11
      return {
        type: 'SkillOn',
        hand,
        target: { unitType: asRawUnitType(rawType), id },
        shift,
        hold,
      }
    }
    case 0x13: {
      const targetType = asRawUnitType(r.u32LE())
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
    case 0x1f: {
      const cursorItemId = r.u32LE()
      const targetItemId = r.u32LE()
      const x = r.u32LE()
      const y = r.u32LE()
      return {
        type: 'SwapContainerItem',
        cursorItemId,
        targetItemId,
        replacedItemId: targetItemId,
        x,
        y,
      }
    }
    case 0x20: {
      const itemId = r.u32LE()
      const x = r.u32LE()
      const y = r.u32LE()
      return { type: 'ItemUse', itemId, at: { x, y } }
    }
    case 0x21: {
      const cursorItemId = r.u32LE()
      const targetItemId = r.u32LE()
      return { type: 'StackItems', cursorItemId, targetItemId }
    }
    case 0x22: {
      const itemId = r.u32LE()
      return { type: 'UnstackItems', itemId }
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
    case 0x25: {
      const cursorItemId = r.u32LE()
      const beltItemId = r.u32LE()
      return { type: 'BeltSwap', cursorItemId, beltItemId }
    }
    case 0x26: {
      const itemId = r.u32LE()
      const shift = r.u32LE() !== 0
      return { type: 'BeltUse', itemId, shift }
    }
    case 0x27: {
      const itemId = r.u32LE()
      const scrollId = r.u32LE()
      return { type: 'IdentifyItem', itemId, scrollId }
    }
    case 0x28: {
      const itemId = r.u32LE()
      const targetItemId = r.u32LE()
      return { type: 'SocketItem', itemId, targetItemId }
    }
    case 0x29: {
      const scrollId = r.u32LE()
      const bookId = r.u32LE()
      return { type: 'ScrollToBook', scrollId, bookId }
    }
    case 0x2a: {
      const itemId = r.u32LE()
      const cubeId = r.u32LE()
      return { type: 'ItemToCube', itemId, cubeId }
    }
    case 0x2f: {
      const unitType = asRawUnitType(r.u32LE())
      const id = r.u32LE()
      return { type: 'NpcInit', target: { unitType, id } }
    }
    case 0x30: {
      const unitType = asRawUnitType(r.u32LE())
      const id = r.u32LE()
      return { type: 'NpcCancel', target: { unitType, id }, npcId: id }
    }
    case 0x31: {
      const npcId = r.u32LE()
      const messageId = r.u32LE()
      return { type: 'QuestMessage', npcId, messageId }
    }
    case 0x32: {
      const npcId = r.u32LE()
      const itemId = r.u32LE()
      const field3 = r.u32LE()
      const cost = r.u32LE()
      const itemMode = (field3 >>> 16) & 0x7fff
      const gamble = (field3 & 0x00000002) !== 0
      const shiftFill = (field3 & 0x80000000) !== 0
      return {
        type: 'NpcBuy',
        npcId,
        itemId,
        itemMode,
        buyType: gamble ? 2 : 0,
        gamble,
        shiftFill,
        cost,
      }
    }
    case 0x33: {
      const npcId = r.u32LE()
      const itemId = r.u32LE()
      const itemMode = r.u32LE()
      const cost = r.u32LE()
      return { type: 'NpcSell', npcId, itemId, itemMode, cost }
    }
    case 0x34: {
      const npcId = r.u32LE()
      return { type: 'NpcIdentifyAll', npcId }
    }
    case 0x35: {
      const npcId = r.u32LE()
      const itemId = r.u32LE()
      const itemMode = r.u32LE()
      const durability = r.u32LE()
      if ((durability & 0x80000000) !== 0) {
        return { type: 'NpcRepairAll', npcId }
      }
      return { type: 'NpcRepairItem', npcId, itemId, itemMode, durability }
    }
    case 0x36: {
      const npcId = r.u32LE()
      const mercId = r.u32LE()
      return { type: 'HireMerc', npcId, mercId }
    }
    case 0x37: {
      const itemId = r.u32LE()
      return { type: 'NpcIdentifyGamble', itemId }
    }
    case 0x38: {
      const action = r.u32LE()
      const npcId = r.u32LE()
      const complement = r.u32LE()
      return { type: 'NpcEntityAction', action, npcId, complement }
    }
    case 0x3a: {
      const word = r.u16LE()
      const statId = word & 0xff
      const amount = ((word >>> 8) & 0xff) + 1
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
      const hand: Hand = handByte === 0x80 ? 'left' : 'right'
      return { type: 'SelectSkill', hand, skill, skillId: skill, itemId }
    }
    case 0x3e: {
      const itemId = r.u32LE()
      return { type: 'SelectMainItem', itemId }
    }
    case 0x3f: {
      const phraseId = r.u16LE()
      return { type: 'Say', phraseId }
    }
    case 0x40:
      return { type: 'RequestQuestData' }
    case 0x41:
      return { type: 'Respawn' }
    case 0x44: {
      const playerUnitId = r.u32LE()
      const orificeObjectId = r.u32LE()
      const staffItemId = r.u32LE()
      const state = r.u32LE()
      return {
        type: 'StaffInOrifice',
        orificeObjectId,
        staffItemId,
        state,
        playerUnitId,
      }
    }
    case 0x48:
      return { type: 'CancelController' }
    case 0x49: {
      const waypointId = r.u32LE()
      const destAreaId = r.u32LE()
      return { type: 'WaypointGo', waypointId, destAreaId }
    }
    case 0x4b: {
      const unitType = r.u32LE()
      const unitId = r.u32LE()
      return { type: 'RequestEntityUpdate', unitType, unitId }
    }
    case 0x4d: {
      const classId = r.u16LE()
      return { type: 'PlayNpcMessage', classId, npcClassId: classId, hcIdx: classId }
    }
    case 0x4f: {
      const buttonId = r.u16LE()
      const wordHi = r.u16LE()
      const wordLo = r.u16LE()
      const amount = (((wordHi & 0xffff) << 16) | (wordLo & 0xffff)) >>> 0
      const complement = (((wordLo & 0xffff) << 16) | (wordHi & 0xffff)) >>> 0
      return {
        type: 'ClickButton',
        buttonId,
        button: buttonId,
        amount,
        complement,
      }
    }
    case 0x50: {
      const unitId = r.u32LE()
      const amount = r.u32LE()
      return { type: 'DropGold', unitId, amount }
    }
    case 0x51: {
      const skillLo = r.u8()
      const skillHiAndHand = r.u8()
      const slot = r.u16LE() & 0x0f
      const itemId = r.u32LE()
      const isUnbind = skillLo === 0xff && skillHiAndHand === 0xff
      const skill = isUnbind ? 0xffff : ((skillHiAndHand & 0x7f) << 8) | skillLo
      const hand: Hand = (skillHiAndHand & 0x80) !== 0 ? 'left' : 'right'
      return { type: 'AssignSkillHotkey', slot, hand, skill, itemId }
    }
    case 0x53:
      return { type: 'RunToggle', run: true }
    case 0x54:
      return { type: 'RunToggle', run: false }
    case 0x59: {
      const unitType = asRawUnitType(r.u32LE())
      const id = r.u32LE()
      const x = r.u32LE()
      const y = r.u32LE()
      return {
        type: 'MakeEntityMove',
        target: { unitType, id },
        to: { x, y },
        x,
        y,
        unitType,
        unitId: id,
        npcId: id,
      }
    }
    case 0x58: {
      const questId = r.u16LE()
      return { type: 'QuestMessageSound', questId }
    }
    case 0x5d: {
      const button = r.u8()
      const state = r.u8()
      const targetPlayerId = r.u32LE()
      return { type: 'Hostile', targetPlayerId, hostile: state !== 0, button }
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
    case 0x61: {
      const slot = r.u16LE()
      return { type: 'MercItem', slot }
    }
    case 0x62: {
      const npcId = r.u32LE()
      return { type: 'NpcResurrectMerc', npcId }
    }
    case 0x63: {
      const itemId = r.u32LE()
      return { type: 'ItemToBelt', itemId }
    }
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
  private hasDetectedProtocol: boolean
  private readonly tsFramer = new TsFramer<ClientCommand>()
  private readonly d2gsFramer = new D2gsC2sFramer()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly onCommand: (session: RoomClientSession, cmd: ClientCommand) => void
  private readonly onDisconnect: (session: RoomClientSession, reason: CloseReason) => void

  private d2gsGreetingSent = false
  private d2gsLogonAckSent = false
  private d2gsHandshakeState: D2gsServerHandshakeState = 'awaiting_logon'
  private readonly pendingD2gsEvents: ServerEvent[] = []
  private difficulty: number
  private readonly expansion: boolean
  private readonly hardcore: boolean
  private readonly ladder: boolean

  private batchDepth = 0
  private readonly batchedD2gsPackets: Uint8Array[] = []
  private batchSawLoadAct = false
  private batchSawLoadComplete = false

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
    this.hasDetectedProtocol = this.explicitProtocol
    this.difficulty = (options.difficulty ?? 0) & 0xff
    this.expansion = options.expansion ?? true
    this.hardcore = options.hardcore ?? false
    this.ladder = options.ladder ?? false
    this.onCommand = options.onCommand
    this.onDisconnect = options.onDisconnect

    this.stream.onData((chunk) => this.handleIncomingChunk(chunk))
    this.stream.onClose((reason) => this.handleStreamClose(reason))

    if (this.resolvedProtocol === 'd2gs') {
      try {
        this.ensureD2gsGreetingSent()
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        this.disconnect({ kind: 'error', error })
      }
    }
  }

  get protocol(): RoomWireProtocol {
    return this.resolvedProtocol
  }

  get handshakeState(): D2gsServerHandshakeState {
    return this.d2gsHandshakeState
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

  /**
   * 1.13c D2GS initial server greeting (`D2Client.dll` `0x6FB5D450` / `D2gsS2cFramer`):
   * `[0xAF, 0x01]` is sent UNCOMPRESSED immediately on connection; all subsequent S2C packets
   * on this session are framed as D2Net Huffman-compressed blocks (`encodeD2gsCompressedPackets`).
   */
  private ensureD2gsGreetingSent(): void {
    if (this.d2gsGreetingSent || this.closed) return
    this.d2gsGreetingSent = true
    const greeting = new Uint8Array([0xaf, 0x01])
    this.bytesOutCount += greeting.byteLength
    this.stream.write(greeting)
  }

  private buildGameFlagsPacket(): Uint8Array {
    const w = new ByteWriter(8)
    w.u8(0x01)
    w.u8(this.difficulty & 0xff)
    w.u32LE(this.hardcore ? 0x0800 : 0)
    w.u8(this.expansion ? 1 : 0)
    w.u8(this.ladder ? 1 : 0)
    return w.toUint8Array()
  }

  private writeCompressedS2cPackets(packets: readonly Uint8Array[]): void {
    if (this.closed || packets.length === 0) return
    this.ensureD2gsGreetingSent()
    const frames = encodeD2gsCompressedPackets(packets)
    for (const frame of frames) {
      if (this.closed) return
      this.bytesOutCount += frame.byteLength
      this.stream.write(frame)
    }
  }

  private flushPendingD2gsEvents(): void {
    if (this.closed || this.pendingD2gsEvents.length === 0) return
    const queued = this.pendingD2gsEvents.splice(0, this.pendingD2gsEvents.length)
    this.beginEventBatch()
    try {
      for (const ev of queued) {
        this.sendEvent(ev)
      }
    } finally {
      this.endEventBatch()
    }
  }

  beginEventBatch(): void {
    this.batchDepth++
  }

  endEventBatch(): void {
    if (this.batchDepth <= 0) return
    this.batchDepth--
    if (this.batchDepth > 0) return
    if (this.resolvedProtocol !== 'd2gs' || this.closed) {
      this.batchedD2gsPackets.length = 0
      this.batchSawLoadAct = false
      this.batchSawLoadComplete = false
      return
    }
    if (this.batchSawLoadAct && !this.batchSawLoadComplete) {
      this.batchedD2gsPackets.push(new Uint8Array([0x04]))
    }
    const packets = this.batchedD2gsPackets.splice(0, this.batchedD2gsPackets.length)
    this.batchSawLoadAct = false
    this.batchSawLoadComplete = false
    if (packets.length === 0) return
    try {
      this.writeCompressedS2cPackets(packets)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.disconnect({ kind: 'error', error })
    }
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    if (this.closed || chunk.byteLength === 0) return
    this.bytesInCount += chunk.byteLength

    if (!this.hasDetectedProtocol) {
      this.hasDetectedProtocol = true
      // Auto-detect binary D2GS vs TsFramer JSON on first incoming chunk:
      // TsFramer frames start with 4-byte uint32LE length followed by '{' (0x7B).
      const looksLikeTsJson = chunk.byteLength >= 5 && chunk[4] === 0x7b
      if (!looksLikeTsJson && (chunk[0] === 0x6b || chunk[0] === 0x68)) {
        this.resolvedProtocol = 'd2gs'
      }
    }

    try {
      if (this.resolvedProtocol === 'd2gs') {
        const packets = this.d2gsFramer.push(chunk)
        const wasGreetingUnsent = !this.d2gsGreetingSent
        const isAutoDetectProbeOnly =
          wasGreetingUnsent && packets.length === 1 && packets[0]![0] === 0x6b
        if (wasGreetingUnsent) {
          this.ensureD2gsGreetingSent()
        }
        for (const pkt of packets) {
          if (this.closed || pkt.byteLength === 0) continue
          const op = pkt[0]!
          if (op === 0x68) {
            this.d2gsLogonAckSent = true
            if (this.d2gsHandshakeState === 'awaiting_logon') {
              this.d2gsHandshakeState = 'awaiting_enter'
            }
            this.writeCompressedS2cPackets([
              this.buildGameFlagsPacket(),
              new Uint8Array([0x02]),
            ])
            continue
          }
          if (op === 0x6b) {
            if (isAutoDetectProbeOnly && this.d2gsHandshakeState === 'awaiting_logon') {
              continue
            }
            if (this.d2gsHandshakeState !== 'ingame') {
              this.d2gsHandshakeState = 'ingame'
              this.flushPendingD2gsEvents()
            }
            continue
          }
          if (op === 0x6d) {
            const tickCount =
              pkt.byteLength >= 5
                ? (pkt[1]! | (pkt[2]! << 8) | (pkt[3]! << 16) | (pkt[4]! << 24)) >>> 0
                : 0
            if (this.d2gsHandshakeState !== 'ingame') {
              this.writeCompressedS2cPackets(
                serverEventToS2cPackets({ type: 'Pong', rttMs: 0, tickCount }),
              )
            } else {
              this.onCommand(this, { type: 'Ping' })
            }
            continue
          }

          const cmd = decodeD2gsC2sPacketToCommand(pkt)
          if (cmd) {
            if (this.d2gsHandshakeState !== 'ingame') {
              this.d2gsHandshakeState = 'ingame'
              this.flushPendingD2gsEvents()
            }
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
    const anyEv = ev as Record<string, unknown>
    if (
      (ev.type === 'GameLogonAck' || ev.type === 'GameFlags') &&
      typeof anyEv.difficulty === 'number'
    ) {
      this.difficulty = anyEv.difficulty & 0xff
    }

    try {
      if (this.resolvedProtocol === 'd2gs') {
        if (this.d2gsHandshakeState !== 'ingame') {
          this.pendingD2gsEvents.push(ev)
          return
        }
        if (this.d2gsLogonAckSent && ev.type === 'GameLogonAck') {
          return
        }
        const isLoadAct = ev.type === 'LoadAct' || anyEv.type === 'ActDataLoaded'
        const isLoadComplete = ev.type === 'LoadComplete'
        const packets = serverEventToS2cPackets(ev)
        if (this.batchDepth > 0) {
          if (isLoadAct) this.batchSawLoadAct = true
          if (isLoadComplete) this.batchSawLoadComplete = true
          for (const pkt of packets) {
            this.batchedD2gsPackets.push(pkt)
          }
        } else {
          const out = isLoadAct && !isLoadComplete ? [...packets, new Uint8Array([0x04])] : packets
          this.writeCompressedS2cPackets(out)
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
