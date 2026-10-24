#!/usr/bin/env npx tsx
/**
 * Offline `.d2cap` Capture Replay & Strict Protocol Coverage Verifier
 * (`scripts/netproto-replay.ts`, Feature F10).
 *
 * Usage:
 *   npx tsx scripts/netproto-replay.ts tests/fixtures/netproto/*.d2cap --strict
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { getCanonicalItemDataTables } from '../src/client/world/item-tables-provider.ts'
import {
  BncsFramer,
  C2S_PACKET_SIZES,
  D2GS_S2C_REGISTRY,
  D2gsS2cFramer,
  McpFramer,
  ProtocolError,
  decodeBncsS2cPacket,
  decodeD2gsS2cPacket,
  decodeMcpS2cPacket,
  defaultTextCodec,
  hexToBytes,
  parseD2CapJsonl,
  resolveS2cPacketSize,
  validateC2sPacket,
  type D2CapHeader,
  type ServerEvent,
} from '../src/netproto/index.ts'

export interface DecodedReplayEntry {
  readonly index: number
  readonly t: number
  readonly conn: string
  readonly dir: 'c2s' | 's2c'
  readonly packetId: number
  readonly packetName: string
  readonly byteLength: number
  readonly event?: ServerEvent | undefined
}

export interface ReplayResult {
  readonly header: D2CapHeader | null
  readonly totalRecords: number
  readonly bnetPackets: number
  readonly realmPackets: number
  readonly gameS2cPackets: number
  readonly gameC2sPackets: number
  readonly unknownPackets: number
  readonly opaquePackets: number
  readonly protocolErrors: number
  readonly errorMessages: readonly string[]
  readonly s2cOpcodesSeen: readonly number[]
  readonly c2sOpcodesSeen: readonly number[]
  readonly events: readonly ServerEvent[]
  readonly entries: readonly DecodedReplayEntry[]
  readonly world: ClientWorld
}

export function replayD2CapText(
  jsonlText: string,
  options: { readonly strict?: boolean | undefined } = {},
): ReplayResult {
  const { header, records } = parseD2CapJsonl(jsonlText)
  const tables = getCanonicalItemDataTables()
  const world = new ClientWorld()
  const bncsFramer = new BncsFramer()
  const mcpFramer = new McpFramer()
  const d2gsFramer = new D2gsS2cFramer()

  let bnetPackets = 0
  let realmPackets = 0
  let gameS2cPackets = 0
  let gameC2sPackets = 0
  let unknownPackets = 0
  let opaquePackets = 0
  let protocolErrors = 0
  const errorMessages: string[] = []
  const s2cOpcodes = new Set<number>()
  const c2sOpcodes = new Set<number>()
  const events: ServerEvent[] = []
  const entries: DecodedReplayEntry[] = []

  const handleGameS2cPacket = (pkt: Uint8Array, recIdx: number, t: number): void => {
    gameS2cPackets++
    if (pkt.length === 0) {
      protocolErrors++
      errorMessages.push(`Record #${recIdx}: empty D2GS S->C packet`)
      return
    }
    const op = pkt[0]!
    s2cOpcodes.add(op)

    try {
      // Greeting packet [0xAF, 0x01] is 2 bytes
      if (op !== 0xaf) {
        const expectedLen = resolveS2cPacketSize(pkt, 0)
        if (expectedLen !== pkt.length) {
          throw new ProtocolError(
            `D2GS S->C 0x${op.toString(16).padStart(2, '0')} size mismatch: expected ${expectedLen ?? 'null'}, got ${pkt.length}`,
            { proto: 'd2gs', packetId: op },
          )
        }
      }
      const meta = D2GS_S2C_REGISTRY[op]
      if (!meta) {
        unknownPackets++
        throw new ProtocolError(
          `Unknown D2GS S->C opcode 0x${op.toString(16).padStart(2, '0')}`,
          { proto: 'd2gs', packetId: op },
        )
      }
      const ev = decodeD2gsS2cPacket(pkt, { tables, encoding: 'gbk', rttMs: world.lastRttMs ?? 0 })
      if (ev.type === 'Opaque') {
        opaquePackets++
      }
      world.apply(ev)
      events.push(ev)
      entries.push({
        index: recIdx,
        t,
        conn: 'game',
        dir: 's2c',
        packetId: op,
        packetName: meta.name,
        byteLength: pkt.length,
        event: ev,
      })
    } catch (err) {
      protocolErrors++
      const msg = err instanceof Error ? err.message : String(err)
      errorMessages.push(`Record #${recIdx} (D2GS S->C 0x${op.toString(16).padStart(2, '0')}): ${msg}`)
      if (options.strict) {
        throw err
      }
    }
  }

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!
    const raw = hexToBytes(rec.hex)

    if (rec.conn === 'bnet') {
      bnetPackets++
      if (rec.dir === 's2c') {
        try {
          const pkts = rec.stream
            ? bncsFramer.push(raw)
            : raw.length >= 4 && raw[0] === 0xff
              ? [{ id: raw[1]!, payload: raw.subarray(4), raw }]
              : bncsFramer.push(raw)
          for (const p of pkts) {
            const decoded = decodeBncsS2cPacket(p, defaultTextCodec)
            entries.push({
              index: i,
              t: rec.t,
              conn: 'bnet',
              dir: 's2c',
              packetId: p.id,
              packetName: decoded.type,
              byteLength: p.raw.length,
            })
          }
        } catch (err) {
          protocolErrors++
          const msg = err instanceof Error ? err.message : String(err)
          errorMessages.push(`Record #${i} (BNCS S->C): ${msg}`)
          if (options.strict) throw err
        }
      } else {
        const pktId = raw.length === 1 && raw[0] === 0x01 ? 0x01 : raw.length >= 4 && raw[0] === 0xff ? raw[1]! : -1
        if (pktId < 0) {
          unknownPackets++
          protocolErrors++
          const msg = `Record #${i}: invalid BNCS C->S frame (${raw.length}B)`
          errorMessages.push(msg)
          if (options.strict) throw new ProtocolError(msg, { proto: 'bncs' })
        }
        entries.push({
          index: i,
          t: rec.t,
          conn: 'bnet',
          dir: 'c2s',
          packetId: pktId,
          packetName: pktId === 0x01 ? 'BNCS_GREETING' : `BNCS_C2S_0x${pktId.toString(16).padStart(2, '0')}`,
          byteLength: raw.length,
        })
      }
    } else if (rec.conn === 'realm') {
      realmPackets++
      if (rec.dir === 's2c') {
        try {
          const pkts = rec.stream
            ? mcpFramer.push(raw)
            : raw.length >= 3
              ? [{ id: raw[2]!, payload: raw.subarray(3), raw }]
              : mcpFramer.push(raw)
          for (const p of pkts) {
            const decoded = decodeMcpS2cPacket(p, defaultTextCodec)
            entries.push({
              index: i,
              t: rec.t,
              conn: 'realm',
              dir: 's2c',
              packetId: p.id,
              packetName: decoded.type,
              byteLength: p.raw.length,
            })
          }
        } catch (err) {
          protocolErrors++
          const msg = err instanceof Error ? err.message : String(err)
          errorMessages.push(`Record #${i} (MCP S->C): ${msg}`)
          if (options.strict) throw err
        }
      } else {
        const pktId = raw.length === 1 && raw[0] === 0x01 ? 0x01 : raw.length >= 3 ? raw[2]! : -1
        if (pktId < 0) {
          unknownPackets++
          protocolErrors++
          const msg = `Record #${i}: invalid MCP C->S frame (${raw.length}B)`
          errorMessages.push(msg)
          if (options.strict) throw new ProtocolError(msg, { proto: 'mcp' })
        }
        entries.push({
          index: i,
          t: rec.t,
          conn: 'realm',
          dir: 'c2s',
          packetId: pktId,
          packetName: pktId === 0x01 ? 'MCP_GREETING' : `MCP_C2S_0x${pktId.toString(16).padStart(2, '0')}`,
          byteLength: raw.length,
        })
      }
    } else if (rec.conn === 'game') {
      if (rec.dir === 's2c') {
        if (rec.stream) {
          try {
            const split = d2gsFramer.push(raw)
            for (const p of split) {
              handleGameS2cPacket(p.bytes, i, rec.t)
            }
          } catch (err) {
            protocolErrors++
            const msg = err instanceof Error ? err.message : String(err)
            errorMessages.push(`Record #${i} (D2GS S->C stream): ${msg}`)
            if (options.strict) throw err
          }
        } else {
          handleGameS2cPacket(raw, i, rec.t)
        }
      } else {
        gameC2sPackets++
        if (raw.length === 0) {
          protocolErrors++
          errorMessages.push(`Record #${i}: empty D2GS C->S packet`)
          if (options.strict) throw new ProtocolError(`Record #${i}: empty D2GS C->S packet`, { proto: 'd2gs' })
          continue
        }
        const op = raw[0]!
        c2sOpcodes.add(op)
        if (op >= C2S_PACKET_SIZES.length || C2S_PACKET_SIZES[op] === 0) {
          unknownPackets++
          protocolErrors++
          const msg = `Record #${i}: unknown D2GS C->S opcode 0x${op.toString(16)}`
          errorMessages.push(msg)
          if (options.strict) throw new ProtocolError(msg, { proto: 'd2gs', packetId: op })
        } else {
          try {
            validateC2sPacket(raw)
          } catch (err) {
            protocolErrors++
            const msg = `Record #${i}: ${err instanceof Error ? err.message : String(err)}`
            errorMessages.push(msg)
            if (options.strict) throw err
          }
        }
        entries.push({
          index: i,
          t: rec.t,
          conn: 'game',
          dir: 'c2s',
          packetId: op,
          packetName: `D2GS_C2S_0x${op.toString(16).padStart(2, '0')}`,
          byteLength: raw.length,
        })
      }
    }
  }

  return {
    header,
    totalRecords: records.length,
    bnetPackets,
    realmPackets,
    gameS2cPackets,
    gameC2sPackets,
    unknownPackets,
    opaquePackets,
    protocolErrors,
    errorMessages,
    s2cOpcodesSeen: Array.from(s2cOpcodes).sort((a, b) => a - b),
    c2sOpcodesSeen: Array.from(c2sOpcodes).sort((a, b) => a - b),
    events,
    entries,
    world,
  }
}

export function replayD2CapFile(
  filePath: string,
  options: { readonly strict?: boolean | undefined } = {},
): ReplayResult {
  const fullPath = resolve(filePath)
  const text = readFileSync(fullPath, 'utf8')
  return replayD2CapText(text, options)
}

function main(): void {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const jsonOutput = args.includes('--json')
  const files = args.filter(a => !a.startsWith('--'))

  if (files.length === 0) {
    console.error('Usage: npx tsx scripts/netproto-replay.ts <file.d2cap ...> [--strict] [--json]')
    process.exit(1)
  }

  let totalRecordsAll = 0
  let totalUnknownAll = 0
  let totalOpaqueAll = 0
  let totalErrorsAll = 0
  const allS2cOpcodes = new Set<number>()
  const allC2sOpcodes = new Set<number>()
  const fileSummaries: Record<string, unknown>[] = []

  for (const file of files) {
    const res = replayD2CapFile(file, { strict: false })
    totalRecordsAll += res.totalRecords
    totalUnknownAll += res.unknownPackets
    totalOpaqueAll += res.opaquePackets
    totalErrorsAll += res.protocolErrors
    for (const op of res.s2cOpcodesSeen) allS2cOpcodes.add(op)
    for (const op of res.c2sOpcodesSeen) allC2sOpcodes.add(op)

    const summary = {
      file,
      scenario: res.header?.scenario ?? 'unknown',
      totalRecords: res.totalRecords,
      bnetPackets: res.bnetPackets,
      realmPackets: res.realmPackets,
      gameS2cPackets: res.gameS2cPackets,
      gameC2sPackets: res.gameC2sPackets,
      unknownPackets: res.unknownPackets,
      opaquePackets: res.opaquePackets,
      protocolErrors: res.protocolErrors,
      s2cOpcodesCount: res.s2cOpcodesSeen.length,
      c2sOpcodesCount: res.c2sOpcodesSeen.length,
      world: {
        act: res.world.act,
        mapSeed: res.world.mapSeed,
        areaId: res.world.areaId,
        selfId: res.world.selfId,
        selfName: res.world.self.name,
        selfPos: { x: res.world.self.x, y: res.world.self.y },
        life: res.world.self.life,
        mana: res.world.self.mana,
        units: res.world.units.size,
        inventoryItems: res.world.containers.inventory.size,
        equippedItems: res.world.containers.equipment.size,
        beltItems: res.world.containers.belt.size,
      },
      ...(res.errorMessages.length > 0 ? { errors: res.errorMessages } : {}),
    }
    fileSummaries.push(summary)

    if (!jsonOutput) {
      console.log(
        `[replay] ${file}: records=${res.totalRecords} (bnet=${res.bnetPackets}, realm=${res.realmPackets}, d2gs_s2c=${res.gameS2cPackets}, d2gs_c2s=${res.gameC2sPackets}) | unknown=${res.unknownPackets} opaque=${res.opaquePackets} errors=${res.protocolErrors} | world(act=${res.world.act}, seed=0x${res.world.mapSeed.toString(16)}, area=${res.world.areaId}, self=${res.world.self.name}@${res.world.self.x},${res.world.self.y}, units=${res.world.units.size}, inv=${res.world.containers.inventory.size}, eq=${res.world.containers.equipment.size})`,
      )
      for (const errMsg of res.errorMessages) {
        console.error(`  ! ${errMsg}`)
      }
    }
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          files: fileSummaries,
          totals: {
            filesCount: files.length,
            totalRecords: totalRecordsAll,
            unknownPackets: totalUnknownAll,
            opaquePackets: totalOpaqueAll,
            protocolErrors: totalErrorsAll,
            uniqueS2cOpcodes: Array.from(allS2cOpcodes).map(op => `0x${op.toString(16).padStart(2, '0')}`),
            uniqueC2sOpcodes: Array.from(allC2sOpcodes).map(op => `0x${op.toString(16).padStart(2, '0')}`),
          },
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[replay:summary] files=${files.length} totalRecords=${totalRecordsAll} uniqueS2cOpcodes=${allS2cOpcodes.size} uniqueC2sOpcodes=${allC2sOpcodes.size} unknownPackets=${totalUnknownAll} opaquePackets=${totalOpaqueAll} protocolErrors=${totalErrorsAll}`,
    )
  }

  if (strict && (totalUnknownAll > 0 || totalOpaqueAll > 0 || totalErrorsAll > 0 || totalRecordsAll === 0)) {
    console.error(
      `[replay:strict] FAILED: unknownPackets=${totalUnknownAll}, opaquePackets=${totalOpaqueAll}, protocolErrors=${totalErrorsAll}, totalRecords=${totalRecordsAll}`,
    )
    process.exit(1)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isMain) {
  main()
}
