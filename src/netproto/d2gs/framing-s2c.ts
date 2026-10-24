import { ProtocolError } from '../core/errors.ts'
import {
  D2gsHuffmanCodec,
  defaultD2gsHuffmanCodec,
  parseD2gsBlockHeader,
  unpackCustomHuffmanLengths,
} from './compression.ts'
import { S2C_PACKET_SIZES, resolveS2cPacketSize as resolveS2cSizeStruct } from './tables/s2c-sizes.ts'

export { S2C_PACKET_SIZES }
export const D2GS_S2C_PACKET_SIZES = S2C_PACKET_SIZES

/**
 * Convenience helper returning the resolved S->C packet byte length, or `null` if incomplete,
 * or throwing `ProtocolError` if invalid.
 */
export function resolveS2cPacketSize(buf: Uint8Array, offset = 0): number | null {
  const res = resolveS2cSizeStruct(buf, offset)
  if (res.status === 'incomplete') return null
  if (res.status === 'invalid') {
    throw new ProtocolError(`Invalid D2GS S->C packet: ${res.reason}`, res.opcode, offset)
  }
  return res.size
}

export interface D2gsFramedS2cPacket {
  readonly packetId: number
  readonly bytes: Uint8Array
  readonly isSystemPacket: boolean
}

export interface D2gsFramePushResult {
  readonly packets: readonly D2gsFramedS2cPacket[]
  readonly compressedBlocksProcessed: number
}

/**
 * Stateful D2GS S->C stream framer matching `D2Net.dll` (`0x6fbf7290..0x6fbf7470`, `0x6fbf6d60..0x6fbf6ec0`):
 * 1. Starts in uncompressed mode (`compressedMode = false`) for the initial `[0xAF, ...]` server greeting.
 * 2. When packet `0xAF` is parsed with `bytes[1] !== 0`:
 *    - Transitions `compressedMode = true` for all subsequent stream reads.
 *    - If `bytes[1] === 0x81` (`130` bytes), rebuilds the Huffman table via `Fog.10219` (`unpackCustomHuffmanLengths`).
 *    - If `bytes[1] === 0x01` (`2` bytes `[0xAF, 0x01]`), keeps the static `Fog.dll` (`0x6ff7f210`) Huffman table.
 * 3. In compressed mode, parses 1- or 2-byte `totalFrameSize` block headers (`compressedPayloadLen = totalFrameSize - headerSize`),
 *    decompresses each block with `Fog.10224`, appends to the packet reassembly buffer, and splits complete packets via `resolveS2cPacketSize`.
 * 4. Fails fast with `ProtocolError` on unknown/unused opcodes (`S2C_PACKET_SIZES[opcode] === 0` or `opcode >= 0xB5`) or invalid sizes (`<= 0` or `> 0x204`).
 */
export class D2gsS2cFramer {
  private tcpBuf: Uint8Array = new Uint8Array(4096)
  private tcpHead = 0
  private tcpTail = 0
  private packetBuf: Uint8Array = new Uint8Array(4096)
  private packetHead = 0
  private packetTail = 0
  private compressedMode = false
  private huffmanCodec: D2gsHuffmanCodec

  constructor(initialCompressedMode = false, huffmanCodec: D2gsHuffmanCodec = defaultD2gsHuffmanCodec) {
    this.compressedMode = initialCompressedMode
    this.huffmanCodec = huffmanCodec
  }

  get isCompressedMode(): boolean {
    return this.compressedMode
  }

  get isCompressed(): boolean {
    return this.compressedMode
  }

  get bufferedTcpBytes(): number {
    return this.tcpTail - this.tcpHead
  }

  get bufferedPacketBytes(): number {
    return this.packetTail - this.packetHead
  }

  reset(initialCompressedMode = false): void {
    this.tcpHead = 0
    this.tcpTail = 0
    this.packetHead = 0
    this.packetTail = 0
    this.compressedMode = initialCompressedMode
    this.huffmanCodec = defaultD2gsHuffmanCodec
  }

  push(chunk: Uint8Array): D2gsFramedS2cPacket[] {
    if (chunk.byteLength > 0) {
      this.appendTcp(chunk)
    }

    const out: D2gsFramedS2cPacket[] = []

    // Phase 1: If still in uncompressed mode (waiting for 0xAF greeting), split directly from tcpBuf
    while (!this.compressedMode && this.tcpHead < this.tcpTail) {
      const tcpView = this.tcpBuf.subarray(this.tcpHead, this.tcpTail)
      const opcode = tcpView[0]!
      if (opcode >= S2C_PACKET_SIZES.length || S2C_PACKET_SIZES[opcode] === 0) {
        throw new ProtocolError(
          `Unknown or invalid D2GS S->C opcode 0x${opcode.toString(16).padStart(2, '0')} in uncompressed stream`,
          opcode,
          0,
        )
      }
      const pktSize = resolveS2cPacketSize(tcpView, 0)
      if (pktSize === null) {
        // Need more bytes to resolve variable-length header or complete fixed-size packet
        break
      }
      if (pktSize <= 0 || pktSize > 0x204) {
        throw new ProtocolError(
          `Invalid D2GS S->C packet size ${pktSize} for opcode 0x${opcode.toString(16).padStart(2, '0')}`,
          opcode,
          0,
        )
      }
      const pktBytes = this.tcpBuf.slice(this.tcpHead, this.tcpHead + pktSize)
      this.tcpHead += pktSize
      if (this.tcpHead === this.tcpTail) {
        this.tcpHead = 0
        this.tcpTail = 0
      }
      this.handleSpecialPacket(pktBytes)
      out.push({
        packetId: opcode,
        bytes: pktBytes,
        isSystemPacket: opcode >= 0xaf,
      })
    }

    // Phase 2: In compressed mode, parse 1/2-byte block headers, decompress blocks, and split packets
    if (this.compressedMode) {
      while (this.tcpHead < this.tcpTail) {
        const tcpView = this.tcpBuf.subarray(this.tcpHead, this.tcpTail)
        const header = parseD2gsBlockHeader(tcpView, 0)
        if (!header) {
          break
        }
        if (tcpView.byteLength < header.totalFrameSize) {
          break
        }
        const compressedPayload = tcpView.subarray(header.headerSize, header.totalFrameSize)
        this.tcpHead += header.totalFrameSize
        if (this.tcpHead === this.tcpTail) {
          this.tcpHead = 0
          this.tcpTail = 0
        }

        const decompressed = this.huffmanCodec.decompress(compressedPayload)
        if (decompressed.byteLength > 0) {
          this.appendPacket(decompressed)
        }
        this.drainPacketBuffer(out)
      }
    }

    return out
  }

  /**
   * Splits already-decompressed S->C packet bytes into individual packets, failing fast with `ProtocolError`
   * on unknown opcodes or invalid packet sizes.
   */
  splitDecompressedBlock(decompressed: Uint8Array): D2gsFramedS2cPacket[] {
    if (decompressed.byteLength > 0) {
      this.appendPacket(decompressed)
    }
    const out: D2gsFramedS2cPacket[] = []
    this.drainPacketBuffer(out)
    return out
  }

  private appendTcp(chunk: Uint8Array): void {
    const len = chunk.byteLength
    if (this.tcpHead === this.tcpTail) {
      this.tcpHead = 0
      this.tcpTail = 0
    }
    const unread = this.tcpTail - this.tcpHead
    if (this.tcpTail + len > this.tcpBuf.byteLength) {
      if (unread + len <= this.tcpBuf.byteLength) {
        this.tcpBuf.copyWithin(0, this.tcpHead, this.tcpTail)
        this.tcpHead = 0
        this.tcpTail = unread
      } else {
        let nextCap = Math.max(4096, this.tcpBuf.byteLength * 2)
        while (nextCap < unread + len) nextCap *= 2
        const next = new Uint8Array(nextCap)
        if (unread > 0) {
          next.set(this.tcpBuf.subarray(this.tcpHead, this.tcpTail), 0)
        }
        this.tcpBuf = next
        this.tcpHead = 0
        this.tcpTail = unread
      }
    }
    this.tcpBuf.set(chunk, this.tcpTail)
    this.tcpTail += len
  }

  private appendPacket(chunk: Uint8Array): void {
    const len = chunk.byteLength
    if (this.packetHead === this.packetTail) {
      this.packetHead = 0
      this.packetTail = 0
    }
    const unread = this.packetTail - this.packetHead
    if (this.packetTail + len > this.packetBuf.byteLength) {
      if (unread + len <= this.packetBuf.byteLength) {
        this.packetBuf.copyWithin(0, this.packetHead, this.packetTail)
        this.packetHead = 0
        this.packetTail = unread
      } else {
        let nextCap = Math.max(4096, this.packetBuf.byteLength * 2)
        while (nextCap < unread + len) nextCap *= 2
        const next = new Uint8Array(nextCap)
        if (unread > 0) {
          next.set(this.packetBuf.subarray(this.packetHead, this.packetTail), 0)
        }
        this.packetBuf = next
        this.packetHead = 0
        this.packetTail = unread
      }
    }
    this.packetBuf.set(chunk, this.packetTail)
    this.packetTail += len
  }

  private drainPacketBuffer(out: D2gsFramedS2cPacket[]): void {
    const pktView = this.packetBuf.subarray(this.packetHead, this.packetTail)
    let offset = 0
    while (offset < pktView.byteLength) {
      const opcode = pktView[offset]!
      if (opcode >= S2C_PACKET_SIZES.length || S2C_PACKET_SIZES[opcode] === 0) {
        const consumed = offset
        this.packetHead += offset
        if (this.packetHead === this.packetTail) {
          this.packetHead = 0
          this.packetTail = 0
        }
        throw new ProtocolError(
          `Unknown or invalid D2GS S->C opcode 0x${opcode.toString(16).padStart(2, '0')} at offset ${consumed}`,
          opcode,
          consumed,
        )
      }
      let pktSize: number | null
      try {
        pktSize = resolveS2cPacketSize(pktView, offset)
      } catch (err) {
        this.packetHead += offset
        if (this.packetHead === this.packetTail) {
          this.packetHead = 0
          this.packetTail = 0
        }
        throw err
      }
      if (pktSize === null) {
        break
      }
      if (pktSize <= 0 || pktSize > 0x204) {
        const consumed = offset
        this.packetHead += offset
        if (this.packetHead === this.packetTail) {
          this.packetHead = 0
          this.packetTail = 0
        }
        throw new ProtocolError(
          `Invalid D2GS S->C packet size ${pktSize} for opcode 0x${opcode.toString(16).padStart(2, '0')} at offset ${consumed}`,
          opcode,
          consumed,
        )
      }
      const pktBytes = pktView.slice(offset, offset + pktSize)
      offset += pktSize
      this.handleSpecialPacket(pktBytes)
      out.push({
        packetId: opcode,
        bytes: pktBytes,
        isSystemPacket: opcode >= 0xaf,
      })
    }
    if (offset > 0) {
      this.packetHead += offset
      if (this.packetHead === this.packetTail) {
        this.packetHead = 0
        this.packetTail = 0
      }
    }
  }

  private handleSpecialPacket(pktBytes: Uint8Array): void {
    const opcode = pktBytes[0]!
    if (opcode === 0xaf && pktBytes.length >= 2) {
      const flag = pktBytes[1]!
      if (flag !== 0) {
        this.compressedMode = true
        if (flag === 0x81) {
          const customLengths = unpackCustomHuffmanLengths(pktBytes)
          this.huffmanCodec = new D2gsHuffmanCodec(customLengths)
        }
      }
    }
  }
}
