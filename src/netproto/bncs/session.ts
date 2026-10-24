/**
 * BNCS (Battle.net Chat Server) session state machine.
 * Handles greeting `0x01`, `0x50` AUTH_INFO, automatic `0x25` PING echo,
 * `0x51` AUTH_CHECK, `0x3D` CREATEACCOUNT2, `0x3A` LOGONRESPONSE2,
 * `0x40` QUERYREALMS2, `0x3E` LOGONREALMEX, and `0x0A..0x0F` chat.
 */

import { systemClock, type Clock } from '../core/clock.ts'
import { TypedEmitter } from '../core/emitter.ts'
import { ProtocolError, TimeoutError } from '../core/errors.ts'
import type { PacketTap } from '../core/packet-tap.ts'
import { defaultTextCodec, resolveTextCodec, type TextCodec } from '../core/text-codec.ts'
import { doubleHash, hashBnetPassword, hashRealmPassword } from '../crypto/bnet-hash.ts'
import {
  createSyntheticCdKeyPair,
  hashD2CdKey,
  type DecodedCdKey,
} from '../crypto/cdkey.ts'
import { getCheckRevision113c, type VersionCheckResult } from '../crypto/check-revision.ts'
import type { ChatEvent, RealmInfo } from '../domain/lobby.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import { BNCS_GREETING_BYTE, BncsFramer } from './framing.ts'
import {
  decodeBncsS2cPacket,
  encodeBncsAuthCheck,
  encodeBncsAuthInfo,
  encodeBncsChatCommand,
  encodeBncsCreateAccount2,
  encodeBncsEnterChat,
  encodeBncsGetChannelList,
  encodeBncsJoinChannel,
  encodeBncsLogonRealmEx,
  encodeBncsLogonResponse2,
  encodeBncsNull,
  encodeBncsPing,
  encodeBncsQueryRealms2,
  type BncsAuthCheckResponse,
  type BncsAuthInfoResponse,
  type BncsCreateAccountResponse,
  type BncsEnterChatResponse,
  type BncsLogonResponse2,
  type BncsRealmLogonToken,
  type DecodedBncsS2cPacket,
} from './packets.ts'

/**
 * 1.13c `Bnclient.dll` (`0x6ff2ed41`: `cmp ecx, 0x2bf20`) sends `SID_NULL (0x00)`
 * every 180,000 ms (3 minutes) while the BNCS socket is connected.
 */
export const BNCS_KEEPALIVE_INTERVAL_MS = 180_000

export type BncsSessionState =
  | 'connecting'
  | 'authInfo'
  | 'authCheck'
  | 'authenticated'
  | 'loggedIn'
  | 'chat'
  | 'closed'

export interface BncsSessionOptions {
  readonly clock?: Clock | undefined
  readonly textCodec?: TextCodec | undefined
  readonly packetTap?: PacketTap | undefined
  readonly versionCheck?: Partial<VersionCheckResult> | undefined
  readonly cdKeys?: {
    readonly classic: DecodedCdKey
    readonly expansion: DecodedCdKey
  } | undefined
  readonly clientToken?: number | undefined
  readonly ownerName?: string | undefined
  readonly timeoutMs?: number | undefined
  readonly requestTimeoutMs?: number | undefined
  readonly keepaliveIntervalMs?: number | undefined
}

export class BncsSession {
  private readonly stream: ByteStream
  private readonly clock: Clock
  private readonly codec: TextCodec
  private readonly tap?: PacketTap | undefined
  private readonly framer = new BncsFramer()
  private readonly packetEmitter = new TypedEmitter<DecodedBncsS2cPacket>()
  private readonly chatEmitter = new TypedEmitter<ChatEvent>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly timeoutMs: number
  private readonly keepaliveIntervalMs: number
  private readonly versionCheck: VersionCheckResult
  private readonly cdKeys: { readonly classic: DecodedCdKey; readonly expansion: DecodedCdKey }
  private readonly ownerName: string

  readonly clientToken: number
  private serverToken = 0
  private _state: BncsSessionState = 'connecting'
  private stopKeepaliveTimer: (() => void) | undefined

  constructor(stream: ByteStream, options: BncsSessionOptions = {}) {
    this.stream = stream
    this.clock = options.clock ?? systemClock
    this.codec = options.textCodec ?? defaultTextCodec
    this.tap = options.packetTap
    this.timeoutMs = options.requestTimeoutMs ?? options.timeoutMs ?? 10_000
    this.keepaliveIntervalMs = options.keepaliveIntervalMs ?? BNCS_KEEPALIVE_INTERVAL_MS
    this.versionCheck = getCheckRevision113c(options.versionCheck)
    this.cdKeys = options.cdKeys ?? createSyntheticCdKeyPair(1)
    this.ownerName = options.ownerName ?? 'WebPlayer'
    this.clientToken =
      options.clientToken ?? (((this.clock.now() & 0xffffffff) ^ 0x5a3c9e17) >>> 0 || 0x13572468)

    this.stream.onData(chunk => this.handleChunk(chunk))
    this.stream.onClose(reason => {
      this.stopKeepalive()
      this._state = 'closed'
      this.closeEmitter.emit(reason)
    })
  }

  get state(): BncsSessionState {
    return this._state
  }

  get currentServerToken(): number {
    return this.serverToken
  }

  private sendRaw(bytes: Uint8Array, packetId?: number, packetName?: string): void {
    this.tap?.record({
      t: this.clock.now(),
      conn: 'bnet',
      dir: 'c2s',
      raw: bytes,
      ...(packetId !== undefined ? { packetId } : {}),
      ...(packetName !== undefined ? { packetName } : {}),
    })
    this.stream.write(bytes)
  }

  private handleChunk(chunk: Uint8Array): void {
    const rawPackets = this.framer.push(chunk)
    for (const rawPkt of rawPackets) {
      const decoded = decodeBncsS2cPacket(rawPkt, this.codec)
      this.tap?.record({
        t: this.clock.now(),
        conn: 'bnet',
        dir: 's2c',
        raw: rawPkt.raw,
        packetId: rawPkt.id,
        packetName: decoded.type,
        decoded,
      })

      if (decoded.type === 'SID_PING') {
        const pong = encodeBncsPing(decoded.pingValue)
        this.sendRaw(pong, 0x25, 'SID_PING')
      } else if (decoded.type === 'SID_CHATEVENT') {
        this.chatEmitter.emit(decoded.event)
      }

      this.packetEmitter.emit(decoded)
    }
  }

  private waitForPacket<T extends DecodedBncsS2cPacket['type']>(
    type: T,
    opName = type,
  ): Promise<Extract<DecodedBncsS2cPacket, { readonly type: T }>> {
    return new Promise((resolve, reject) => {
      let settled = false
      const cancelTimeout = this.clock.setTimeout(() => {
        if (settled) return
        settled = true
        unsubPkt()
        unsubClose()
        reject(new TimeoutError('bnet', this.timeoutMs, opName))
      }, this.timeoutMs)

      const unsubPkt = this.packetEmitter.on(pkt => {
        if (pkt.type === type && !settled) {
          settled = true
          cancelTimeout()
          unsubPkt()
          unsubClose()
          resolve(pkt as Extract<DecodedBncsS2cPacket, { readonly type: T }>)
        }
      })

      const unsubClose = this.closeEmitter.on(reason => {
        if (settled) return
        settled = true
        cancelTimeout()
        unsubPkt()
        unsubClose()
        reject(
          reason.kind === 'error'
            ? reason.error
            : new ProtocolError('bnet', null, 0, `BNCS closed while waiting for ${opName} (${reason.kind})`),
        )
      })
    })
  }

  /**
   * Executes the BNCS initial handshake:
   * 1. Sends protocol greeting byte `0x01` + `SID_AUTH_INFO (0x50)` and starts 180s `SID_NULL (0x00)` keepalive
   * 2. Awaits `SID_AUTH_INFO (0x50)` (while automatically echoing `SID_PING 0x25`)
   * 3. Sends `SID_AUTH_CHECK (0x51)` with 1.13c CheckRevision constants and hashed D2DV+D2XP CD-Keys
   * 4. Awaits `SID_AUTH_CHECK (0x51)` and verifies `result === 0`
   */
  async handshake(): Promise<{
    readonly authInfo: BncsAuthInfoResponse
    readonly authCheck: BncsAuthCheckResponse
  }> {
    this._state = 'authInfo'
    const authInfoWait = this.waitForPacket('SID_AUTH_INFO', 'SID_AUTH_INFO')
    this.sendRaw(new Uint8Array([BNCS_GREETING_BYTE]), undefined, 'BNCS_GREETING')
    const authInfoPkt = encodeBncsAuthInfo(
      { versionByte: this.versionCheck.versionByte },
      this.codec,
    )
    this.sendRaw(authInfoPkt, 0x50, 'SID_AUTH_INFO')
    this.startKeepalive()

    const { data: authInfo } = await authInfoWait
    this.serverToken = authInfo.serverToken

    this._state = 'authCheck'
    const authCheckWait = this.waitForPacket('SID_AUTH_CHECK', 'SID_AUTH_CHECK')
    const key1 = hashD2CdKey(this.clientToken, this.serverToken, this.cdKeys.classic)
    const key2 = hashD2CdKey(this.clientToken, this.serverToken, this.cdKeys.expansion)
    const authCheckPkt = encodeBncsAuthCheck(
      {
        clientToken: this.clientToken,
        exeVersion: this.versionCheck.exeVersion,
        exeHash: this.versionCheck.exeHash,
        keys: [key1, key2],
        spawnCdKey: false,
        exeInfo: this.versionCheck.exeInfo,
        ownerName: this.ownerName,
      },
      this.codec,
    )
    this.sendRaw(authCheckPkt, 0x51, 'SID_AUTH_CHECK')

    const { data: authCheck } = await authCheckWait
    if (authCheck.result !== 0) {
      throw new ProtocolError(
        'bnet',
        0x51,
        0,
        `BNCS SID_AUTH_CHECK failed with status 0x${authCheck.result.toString(16)} (${authCheck.info})`,
      )
    }
    this._state = 'authenticated'
    return { authInfo, authCheck }
  }

  sendNull(): void {
    if (this._state === 'closed') return
    this.sendRaw(encodeBncsNull(), 0x00, 'SID_NULL')
  }

  private startKeepalive(): void {
    this.stopKeepalive()
    if (this.keepaliveIntervalMs <= 0) return
    this.stopKeepaliveTimer = this.clock.setInterval(() => {
      if (this._state !== 'closed') {
        this.sendNull()
      }
    }, this.keepaliveIntervalMs)
  }

  private stopKeepalive(): void {
    if (this.stopKeepaliveTimer) {
      this.stopKeepaliveTimer()
      this.stopKeepaliveTimer = undefined
    }
  }

  async createAccount(username: string, password: string): Promise<BncsCreateAccountResponse> {
    const wait = this.waitForPacket('SID_CREATEACCOUNT2', 'SID_CREATEACCOUNT2')
    const pwHash = hashBnetPassword(password)
    const pkt = encodeBncsCreateAccount2(username, pwHash, this.codec)
    this.sendRaw(pkt, 0x3d, 'SID_CREATEACCOUNT2')
    const { data } = await wait
    return data
  }

  async login(username: string, password: string): Promise<BncsLogonResponse2> {
    const wait = this.waitForPacket('SID_LOGONRESPONSE2', 'SID_LOGONRESPONSE2')
    const pwHash = hashBnetPassword(password)
    const proof = doubleHash(this.clientToken, this.serverToken, pwHash)
    const pkt = encodeBncsLogonResponse2(
      this.clientToken,
      this.serverToken,
      proof,
      username,
      this.codec,
    )
    this.sendRaw(pkt, 0x3a, 'SID_LOGONRESPONSE2')
    const { data } = await wait
    if (data.status === 0) {
      this._state = 'loggedIn'
    }
    return data
  }

  async listRealms(): Promise<readonly RealmInfo[]> {
    const wait = this.waitForPacket('SID_QUERYREALMS2', 'SID_QUERYREALMS2')
    const pkt = encodeBncsQueryRealms2()
    this.sendRaw(pkt, 0x40, 'SID_QUERYREALMS2')
    const { realms } = await wait
    return realms
  }

  async logonRealm(realmTitle: string): Promise<BncsRealmLogonToken> {
    const wait = this.waitForPacket('SID_LOGONREALMEX', 'SID_LOGONREALMEX')
    const realmProof = hashRealmPassword(this.clientToken, this.serverToken)
    const pkt = encodeBncsLogonRealmEx(this.clientToken, realmProof, realmTitle, this.codec)
    this.sendRaw(pkt, 0x3e, 'SID_LOGONREALMEX')
    const { data } = await wait
    if (data.mcpStatus !== 0) {
      throw new Error(
        `BNCS SID_LOGONREALMEX failed for "${realmTitle}" with mcpStatus=0x${data.mcpStatus.toString(16)}`,
      )
    }
    return data
  }

  async enterChat(charName = '', realm = ''): Promise<BncsEnterChatResponse> {
    const wait = this.waitForPacket('SID_ENTERCHAT', 'SID_ENTERCHAT')
    const pkt = encodeBncsEnterChat(charName, realm, this.codec)
    this.sendRaw(pkt, 0x0a, 'SID_ENTERCHAT')
    const { data } = await wait
    this._state = 'chat'
    return data
  }

  async getChannelList(): Promise<readonly string[]> {
    const wait = this.waitForPacket('SID_GETCHANNELLIST', 'SID_GETCHANNELLIST')
    const pkt = encodeBncsGetChannelList()
    this.sendRaw(pkt, 0x0b, 'SID_GETCHANNELLIST')
    const { channels } = await wait
    return channels
  }

  joinChannel(channel: string, flags = 0x02): void {
    const pkt = encodeBncsJoinChannel(channel, flags, this.codec)
    this.sendRaw(pkt, 0x0c, 'SID_JOINCHANNEL')
  }

  sendChat(text: string): void {
    const chatCodec = this.codec === defaultTextCodec ? resolveTextCodec('utf-8') : this.codec
    const pkt = encodeBncsChatCommand(text, chatCodec)
    this.sendRaw(pkt, 0x0e, 'SID_CHATCOMMAND')
  }

  onChatEvent(cb: (ev: ChatEvent) => void): () => void {
    return this.chatEmitter.on(cb)
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  close(): void {
    this.stopKeepalive()
    this._state = 'closed'
    this.stream.close()
  }
}
