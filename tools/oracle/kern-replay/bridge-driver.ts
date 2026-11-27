/**
 * @file tools/oracle/kern-replay/bridge-driver.ts
 * `[K5 / #2031]` Dual-drive S2C byte-equality harness:
 * Boots BOTH `ReplayKernel113c` (`stepFrame113c`) and `D2gsKernelBridge113c` (`adoptSnapshot: true`)
 * from the exact same 1.13c snapshot & save state in TWO independent `SparseMemory113c` worlds
 * (strictly sequentially to prevent cross-world module-global contamination), feeds the exact same
 * C2S script frame-by-frame, collects uncompressed raw S2C whole packets (`Uint8Array[][]`), and
 * compares every packet byte-for-byte with zero filtering, masking, sorting, deduping, or truncation.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isFrameS2CTraceActive113c } from '../../../src/d2kern-113c/net/packet-sink.ts'
import type { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { D2gsKernelBridge113c } from '../../../src/server/net/d2gs-kernel-bridge-113c.ts'
import {
  REPO_ROOT_113C,
  bootFromSnapshot113c,
  loadScenario113c,
  loadSnapshotFile113c,
  snapshotPath113c,
  stepFrame113c,
  type ReplayScenario113c,
} from './replay-113c.ts'

export interface DualDriveOptions113c {
  readonly scenarioName: string
  readonly bootFrame?: number
  readonly snapshotPath?: string
  readonly scenario?: ReplayScenario113c
  readonly maxFrame?: number
  readonly saveBytes?: Uint8Array
}

export interface S2CPacketByteMismatch113c {
  readonly frame: number
  readonly kind: 'frame-count' | 'packet-count' | 'packet-length' | 'packet-byte'
  readonly packetIndex: number
  readonly byteOffset: number
  readonly replayPacketCount: number
  readonly bridgePacketCount: number
  readonly replayHex: string | null
  readonly bridgeHex: string | null
  readonly detail: string
}

export interface S2CStreamComparison113c {
  readonly equal: boolean
  readonly framesCompared: number
  readonly nonEmptyFramesReplay: number
  readonly nonEmptyFramesBridge: number
  readonly replayPackets: number
  readonly bridgePackets: number
  readonly replayBytes: number
  readonly bridgeBytes: number
  readonly firstMismatch: S2CPacketByteMismatch113c | null
  readonly mismatchCount: number
}

export interface DualDriveResult113c {
  readonly scenario: string
  readonly bootFrame: number
  readonly endFrame: number
  readonly framesCompared: number
  readonly clientId: number
  readonly worldsIndependent: boolean
  readonly bridge: D2gsKernelBridge113c
  readonly replayMemory: SparseMemory113c
  readonly bridgeMemory: SparseMemory113c
  readonly replayPGame: number
  readonly bridgePGame: number
  readonly replayS2cByFrame: readonly (readonly Uint8Array[])[]
  readonly bridgeS2cByFrame: readonly (readonly Uint8Array[])[]
  readonly comparison: S2CStreamComparison113c
  readonly summary: string
}

export function bytesToHex113c(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

export function hexToBytes113c(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  if ((clean.length & 1) !== 0) {
    throw new Error(`Invalid odd-length hex packet string: "${hex}"`)
  }
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`Invalid non-hex characters in packet string: "${hex}"`)
  }
  const out = new Uint8Array(clean.length >>> 1)
  for (let i = 0; i < out.byteLength; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) & 0xff
  }
  return out
}

/**
 * Pure whole-packet, in-order, raw byte-for-byte S2C comparator.
 * Performs ZERO filtering, ZERO masking, ZERO sorting, ZERO deduping, and ZERO truncation.
 */
export function compareS2CStreamsByteExact113c(
  replayByFrame: readonly (readonly Uint8Array[])[],
  bridgeByFrame: readonly (readonly Uint8Array[])[],
  firstFrame = 3,
): S2CStreamComparison113c {
  let nonEmptyFramesReplay = 0
  let nonEmptyFramesBridge = 0
  let replayPackets = 0
  let bridgePackets = 0
  let replayBytes = 0
  let bridgeBytes = 0

  for (let f = 0; f < replayByFrame.length; f++) {
    const pkts = replayByFrame[f]!
    if (pkts.length > 0) nonEmptyFramesReplay++
    replayPackets += pkts.length
    for (let p = 0; p < pkts.length; p++) {
      replayBytes += pkts[p]!.byteLength
    }
  }
  for (let f = 0; f < bridgeByFrame.length; f++) {
    const pkts = bridgeByFrame[f]!
    if (pkts.length > 0) nonEmptyFramesBridge++
    bridgePackets += pkts.length
    for (let p = 0; p < pkts.length; p++) {
      bridgeBytes += pkts[p]!.byteLength
    }
  }

  let firstMismatch: S2CPacketByteMismatch113c | null = null
  let mismatchCount = 0
  const recordMismatch = (m: S2CPacketByteMismatch113c): void => {
    mismatchCount++
    if (firstMismatch === null) firstMismatch = m
  }

  if (replayByFrame.length !== bridgeByFrame.length) {
    recordMismatch({
      frame: firstFrame + Math.min(replayByFrame.length, bridgeByFrame.length),
      kind: 'frame-count',
      packetIndex: -1,
      byteOffset: -1,
      replayPacketCount: replayByFrame.length,
      bridgePacketCount: bridgeByFrame.length,
      replayHex: null,
      bridgeHex: null,
      detail: `frame count mismatch: replay=${replayByFrame.length} frames vs bridge=${bridgeByFrame.length} frames`,
    })
  }

  const sharedFrames = Math.min(replayByFrame.length, bridgeByFrame.length)
  for (let f = 0; f < sharedFrames; f++) {
    const frameNo = firstFrame + f
    const rPkts = replayByFrame[f]!
    const bPkts = bridgeByFrame[f]!
    if (rPkts.length !== bPkts.length) {
      recordMismatch({
        frame: frameNo,
        kind: 'packet-count',
        packetIndex: Math.min(rPkts.length, bPkts.length),
        byteOffset: -1,
        replayPacketCount: rPkts.length,
        bridgePacketCount: bPkts.length,
        replayHex: rPkts.map(bytesToHex113c).join(' | '),
        bridgeHex: bPkts.map(bytesToHex113c).join(' | '),
        detail: `F${frameNo} packet count mismatch: replay=${rPkts.length} vs bridge=${bPkts.length}`,
      })
      continue
    }

    for (let p = 0; p < rPkts.length; p++) {
      const rBytes = rPkts[p]!
      const bBytes = bPkts[p]!
      if (rBytes.byteLength !== bBytes.byteLength) {
        recordMismatch({
          frame: frameNo,
          kind: 'packet-length',
          packetIndex: p,
          byteOffset: Math.min(rBytes.byteLength, bBytes.byteLength),
          replayPacketCount: rPkts.length,
          bridgePacketCount: bPkts.length,
          replayHex: bytesToHex113c(rBytes),
          bridgeHex: bytesToHex113c(bBytes),
          detail: `F${frameNo} pkt[${p}] length mismatch: replay=${rBytes.byteLength}B vs bridge=${bBytes.byteLength}B`,
        })
        continue
      }

      for (let i = 0; i < rBytes.byteLength; i++) {
        if (rBytes[i] !== bBytes[i]) {
          recordMismatch({
            frame: frameNo,
            kind: 'packet-byte',
            packetIndex: p,
            byteOffset: i,
            replayPacketCount: rPkts.length,
            bridgePacketCount: bPkts.length,
            replayHex: bytesToHex113c(rBytes),
            bridgeHex: bytesToHex113c(bBytes),
            detail: `F${frameNo} pkt[${p}] byte[${i}] mismatch: replay=0x${rBytes[i]!.toString(16).padStart(2, '0')} vs bridge=0x${bBytes[i]!.toString(16).padStart(2, '0')}`,
          })
          break
        }
      }
    }
  }

  return {
    equal: mismatchCount === 0,
    framesCompared: sharedFrames,
    nonEmptyFramesReplay,
    nonEmptyFramesBridge,
    replayPackets,
    bridgePackets,
    replayBytes,
    bridgeBytes,
    firstMismatch,
    mismatchCount,
  }
}

export function formatDualDriveSummary113c(
  scenario: string,
  comparison: S2CStreamComparison113c,
): string {
  return `[dual-drive] ${scenario}: frames=${comparison.framesCompared}, packets=${comparison.bridgePackets}/${comparison.replayPackets}, bytes=${comparison.bridgeBytes}/${comparison.replayBytes}, equal=${comparison.equal}`
}

/**
 * Executes a strictly sequential two-world dual-drive run:
 * Pass 1 boots a fresh `SparseMemory113c` via `bootFromSnapshot113c` and runs `stepFrame113c`.
 * Pass 2 boots a SECOND independent `SparseMemory113c` via `bootFromSnapshot113c`, constructs
 * `D2gsKernelBridge113c({ memory, pGame, adoptSnapshot: true })` (zero bridge-only world-mutation
 * setup helpers), feeds the exact same C2S packets via `feedC2SPacket`, steps via `stepFrame`,
 * and collects raw uncompressed S2C packets via `drainUncompressedS2CPackets`.
 */
export function runDualDriveS2C113c(options: DualDriveOptions113c): DualDriveResult113c {
  const bootFrame = options.bootFrame ?? 2
  const scenario = options.scenario ?? loadScenario113c(options.scenarioName)
  const saveBytes =
    options.saveBytes !== undefined
      ? options.saveBytes
      : scenario.save !== undefined
        ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
        : undefined
  const snapPath = options.snapshotPath ?? snapshotPath113c(options.scenarioName, bootFrame)
  const snap = loadSnapshotFile113c(snapPath)
  const endFrame =
    options.maxFrame !== undefined ? Math.min(options.maxFrame, scenario.frames) : scenario.frames

  if (endFrame <= bootFrame) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): endFrame=${endFrame} must be > bootFrame=${bootFrame}`,
    )
  }

  const inputsByFrame = new Map<number, Uint8Array[]>()
  for (const inp of scenario.inputs) {
    if (inp.frame <= bootFrame || inp.frame > endFrame) continue
    let list = inputsByFrame.get(inp.frame)
    if (list === undefined) {
      list = []
      inputsByFrame.set(inp.frame, list)
    }
    list.push(hexToBytes113c(inp.c2s))
  }

  // Pass 1: ReplayKernel113c (strictly sequential)
  const replayWorld = bootFromSnapshot113c(snap, saveBytes)
  if (replayWorld.bootFrame !== bootFrame) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): replay booted at F${replayWorld.bootFrame}, expected F${bootFrame}`,
    )
  }
  const replayS2cByFrame: Uint8Array[][] = []
  for (let f = bootFrame + 1; f <= endFrame; f++) {
    const rawInputs = inputsByFrame.get(f) ?? []
    const frameInputs = rawInputs.map((pkt) => pkt.slice())
    stepFrame113c(replayWorld, frameInputs)
    replayS2cByFrame.push(replayWorld.lastFrameS2c.map(hexToBytes113c))
  }

  if (isFrameS2CTraceActive113c()) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): activeFrameS2CTrace113c leaked after Replay Pass 1`,
    )
  }

  // Pass 2: D2gsKernelBridge113c on a SECOND independent world
  const bridgeWorld = bootFromSnapshot113c(snap, saveBytes)
  if (bridgeWorld.bootFrame !== bootFrame) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): bridge booted at F${bridgeWorld.bootFrame}, expected F${bootFrame}`,
    )
  }
  const worldsIndependent = bridgeWorld.m !== replayWorld.m
  if (!worldsIndependent) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): bridge and replay must use independent SparseMemory113c worlds`,
    )
  }

  const bridge = new D2gsKernelBridge113c({
    memory: bridgeWorld.m,
    pGame: bridgeWorld.pGame,
    adoptSnapshot: true,
  })
  const adoptedIds = bridge.getAdoptedClientIds()
  if (adoptedIds.length === 0) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): bridge adopted 0 snapshot clients`,
    )
  }
  const clientId = adoptedIds[0]!
  const preStepPackets = bridge.drainUncompressedS2CPackets(clientId)
  if (preStepPackets.length !== 0) {
    throw new Error(
      `runDualDriveS2C113c(${options.scenarioName}): bridge emitted ${preStepPackets.length} unexpected pre-step S2C packets`,
    )
  }

  const bridgeS2cByFrame: Uint8Array[][] = []
  for (let f = bootFrame + 1; f <= endFrame; f++) {
    const rawInputs = inputsByFrame.get(f) ?? []
    for (let i = 0; i < rawInputs.length; i++) {
      const ok = bridge.feedC2SPacket(clientId, rawInputs[i]!.slice())
      if (!ok) {
        throw new Error(
          `runDualDriveS2C113c(${options.scenarioName}): bridge.feedC2SPacket returned false at F${f} input[${i}]`,
        )
      }
    }
    bridge.stepFrame()
    const drained = bridge.drainUncompressedS2CPackets(clientId)
    bridgeS2cByFrame.push(drained.map((rec) => rec.bytes.slice()))
    bridge.drainWirePackets(clientId)
  }

  const comparison = compareS2CStreamsByteExact113c(
    replayS2cByFrame,
    bridgeS2cByFrame,
    bootFrame + 1,
  )
  const summary = formatDualDriveSummary113c(options.scenarioName, comparison)

  return {
    scenario: options.scenarioName,
    bootFrame,
    endFrame,
    framesCompared: comparison.framesCompared,
    clientId,
    worldsIndependent,
    bridge,
    replayMemory: replayWorld.m,
    bridgeMemory: bridgeWorld.m,
    replayPGame: replayWorld.pGame,
    bridgePGame: bridgeWorld.pGame,
    replayS2cByFrame,
    bridgeS2cByFrame,
    comparison,
    summary,
  }
}
