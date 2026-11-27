/**
 * @file tests/oracle/k5/bridge-vs-replay-s2c.test.ts
 * `[K5 / #2031]` Dual-drive S2C raw byte-equality gate:
 * Drives BOTH `D2gsKernelBridge113c` (`src/server/net/d2gs-kernel-bridge-113c.ts`) and
 * `ReplayKernel113c` (`bootFromSnapshot113c` / `stepFrame113c`) independently from the exact same
 * 1.13c snapshot & C2S script and asserts whole-packet, in-order, raw byte-for-byte S2C equality
 * with zero filtering, masking, sorting, deduping, or truncation.
 */

import { describe, expect, it } from 'vitest'
import { D2gsKernelBridge113c } from '../../../src/server/net/d2gs-kernel-bridge-113c.ts'
import {
  compareS2CStreamsByteExact113c,
  hexToBytes113c,
  runDualDriveS2C113c,
  type DualDriveResult113c,
} from '../../../tools/oracle/kern-replay/bridge-driver.ts'
import { loadGolden113c } from '../../../tools/oracle/kern-replay/replay-113c.ts'

export interface ExpectedBridgeReplayDivergence113c {
  readonly id: string
  readonly targetPhase: '2B' | '2C' | '2D' | '2E'
  readonly bridgeIntercept: string
  readonly targetKernelSymbol: string
  readonly parityScenario: string
  readonly notes: string
}

/**
 * Shrink-only ledger of gameplay paths in `D2gsKernelBridge113c` not yet rewired to pure
 * `src/d2kern-113c/` handlers. Each phase removes its entries until Phase 2E empties this array.
 */
export const EXPECTED_BRIDGE_REPLAY_DIVERGENCES_113C: readonly ExpectedBridgeReplayDivergence113c[] = [
  {
    id: 'monster-spawn-stats',
    targetPhase: '2B',
    bridgeIntercept: 'D2gsKernelBridge113c.spawnMonsterInRoom',
    targetKernelSymbol: 'MONSTER_Create113c / MONSTER_InitStats113c',
    parityScenario: 'a1-bloodmoor-melee',
    notes: 'Monster creation, unit seeds, and stats still initialized via legacy MonStats/MonLvl bridge path.',
  },
  {
    id: 'combat-skills-and-exp',
    targetPhase: '2B',
    bridgeIntercept: 'D2gsKernelBridge113c.handleGameplayQueue1Packet (0x05..0x11 -> handleC2SSkillUse)',
    targetKernelSymbol: 'C2S_Packet05..11_* / SUNITDMG_* / PLAYER_LevelUp_6FD0B090_113c',
    parityScenario: 'a1-bloodmoor-melee',
    notes: 'Skill cast & melee C2S opcodes 0x05..0x11 are intercepted by legacy handleC2SSkillUse before 0x6FCEC550.',
  },
  {
    id: 'kernel-item-units',
    targetPhase: '2C',
    bridgeIntercept: 'D2gsKernelBridge113c.ownedItems / groundItems',
    targetKernelSymbol: 'ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c',
    parityScenario: 'k2-item-pickup-drop',
    notes: 'Owned & ground items are tracked in legacy TS ItemData arrays instead of kernel D2UnitStrc item units.',
  },
  {
    id: 'monster-drops',
    targetPhase: '2C',
    bridgeIntercept: 'D2gsKernelBridge113c.rollAndSpawnMonsterDrops113c',
    targetKernelSymbol: 'ITEMS_DropMonsterTreasure_6FC32D60_113c',
    parityScenario: 'k2-monster-drops',
    notes: 'Monster death drops still roll through legacy executeDropPipeline and legacy gold-on-NoDrop fallback.',
  },
  {
    id: 'inventory-equip-belt-potions',
    targetPhase: '2D',
    bridgeIntercept: 'D2gsKernelBridge113c.onUnhandledOpcode (0x16..0x26, 0x29, 0x2A, 0x60, 0x63)',
    targetKernelSymbol: 'C2S_Packet16..26_* / POTION_UsePotion_6FCCEDC0_113c',
    parityScenario: 'k4-inventory-potion-belt',
    notes: 'Inventory, equipment, belt, and potion C2S opcodes still route through legacy bridge handlers.',
  },
  {
    id: 'npc-trade-vendor-gamble',
    targetPhase: '2D',
    bridgeIntercept: 'D2gsKernelBridge113c.onUnhandledOpcode (0x13, 0x2F..0x35, 0x38)',
    targetKernelSymbol: 'NPCTRADE_* / NPCS_* / ITEMS_GetTransactionCost113c',
    parityScenario: 'k4-vendor-gamble',
    notes: 'NPC interact, trade, vendor stock, gamble, repair, and Cain identify still use legacy bridge handlers.',
  },
  {
    id: 'cube-socket-gold',
    targetPhase: '2D',
    bridgeIntercept: 'D2gsKernelBridge113c.onUnhandledOpcode (0x28, 0x4F, 0x50)',
    targetKernelSymbol: 'CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c / C2S_Packet28 / C2S_Packet50',
    parityScenario: 'k4-cube-transmute',
    notes: 'Horadric Cube transmute, socketing, stash gold, and gold drop still route through legacy bridge handlers.',
  },
  {
    id: 'drlg-world-and-slice-standins',
    targetPhase: '2E',
    bridgeIntercept: 'D2gsKernelBridge113c.initFreshKernelWorld / warpClientToArea / 0x49 / standalone synthetic 0x0F,0x0D,0x95,0x96 / SLICE_*',
    targetKernelSymbol: 'DRLG full world + GAME_UpdateActRooms113c + full 0x6FC4E050',
    parityScenario: 'k4-waypoint-travel',
    notes: 'Standalone single-room bootstrap, synthetic local-sync shims (0x0F/0x0D/0x95/0x96), and SLICE_* stand-ins remain until Phase 2E.',
  },
]

const BASELINE_PARITY_SCENARIOS = new Set(['a1-town-walk', 'p52-item-defense'])

describe('[K5 / #2031] Dual-Drive S2C Byte-Equality Harness (D2gsKernelBridge113c vs ReplayKernel113c)', () => {
  let townWalkResult: DualDriveResult113c | null = null

  it('achieves 0-mismatch raw whole-packet byte-for-byte S2C equality on a1-town-walk (748F, 103 pkts, 1,060 B)', () => {
    const res = runDualDriveS2C113c({ scenarioName: 'a1-town-walk' })
    townWalkResult = res
    console.log(res.summary)

    expect(res.bridge).toBeInstanceOf(D2gsKernelBridge113c)
    expect(res.worldsIndependent).toBe(true)
    expect(res.bridgeMemory).not.toBe(res.replayMemory)

    // Dynamic disjoint-memory proof: mutating an unused scratch address in bridgeMemory
    // leaves replayMemory completely untouched (still throws on unloaded byte read).
    const probeVa = 0x7f010ff0
    res.bridgeMemory.setU32(probeVa, 0x13572468)
    expect(res.bridgeMemory.u32(probeVa) >>> 0).toBe(0x13572468)
    expect(() => res.replayMemory.u32(probeVa)).toThrow(/unloaded/)

    expect(res.framesCompared).toBe(748)
    expect(res.replayS2cByFrame.length).toBe(748)
    expect(res.bridgeS2cByFrame.length).toBe(748)
    expect(res.comparison.replayPackets).toBe(103)
    expect(res.comparison.bridgePackets).toBe(103)
    expect(res.comparison.replayBytes).toBe(1060)
    expect(res.comparison.bridgeBytes).toBe(1060)
    expect(res.comparison.firstMismatch).toBeNull()
    expect(res.comparison.mismatchCount).toBe(0)
    expect(res.comparison.equal).toBe(true)
  }, 120_000)

  it('achieves 0-mismatch raw byte-for-byte S2C equality on p52-item-defense (1,598F, 134 pkts, 1,470 B) + 3-way real-DLL golden match', () => {
    const res = runDualDriveS2C113c({ scenarioName: 'p52-item-defense' })
    console.log(res.summary)

    expect(res.bridge).toBeInstanceOf(D2gsKernelBridge113c)
    expect(res.worldsIndependent).toBe(true)
    expect(res.bridgeMemory).not.toBe(res.replayMemory)
    expect(res.framesCompared).toBe(1598)
    expect(res.replayS2cByFrame.length).toBe(1598)
    expect(res.bridgeS2cByFrame.length).toBe(1598)
    expect(res.comparison.replayPackets).toBe(134)
    expect(res.comparison.bridgePackets).toBe(134)
    expect(res.comparison.replayBytes).toBe(1470)
    expect(res.comparison.bridgeBytes).toBe(1470)
    expect(res.comparison.firstMismatch).toBeNull()
    expect(res.comparison.mismatchCount).toBe(0)
    expect(res.comparison.equal).toBe(true)

    // 3-way raw byte-exact verification against the real D2Game.dll golden trace
    // (including 34-byte 0x3E at F837 and 0x23 AssignSkill at F1099).
    const golden = loadGolden113c('p52-item-defense')
    const goldenS2cByFrame: Uint8Array[][] = []
    for (let f = res.bootFrame + 1; f <= res.endFrame; f++) {
      const gf = golden.frames.get(f)
      expect(gf, `golden missing F${f}`).toBeDefined()
      goldenS2cByFrame.push((gf!.s2c ?? []).map(hexToBytes113c))
    }
    const vsGolden = compareS2CStreamsByteExact113c(
      goldenS2cByFrame,
      res.bridgeS2cByFrame,
      res.bootFrame + 1,
    )
    expect(vsGolden.firstMismatch).toBeNull()
    expect(vsGolden.mismatchCount).toBe(0)
    expect(vsGolden.equal).toBe(true)
  }, 120_000)

  it('negative comparator self-checks fail loudly on every class of S2C stream diff (byte, order, length, count, frame)', () => {
    const res = townWalkResult ?? runDualDriveS2C113c({ scenarioName: 'a1-town-walk' })
    const cloneStream = (src: readonly (readonly Uint8Array[])[]): Uint8Array[][] =>
      src.map((framePkts) => framePkts.map((p) => p.slice()))

    const firstNonEmptyIdx = res.replayS2cByFrame.findIndex((pkts) => pkts.length > 0)
    expect(firstNonEmptyIdx).toBeGreaterThanOrEqual(0)
    const multiPktIdx = res.replayS2cByFrame.findIndex((pkts) => {
      if (pkts.length < 2) return false
      const a = pkts[0]!
      const b = pkts[1]!
      if (a.byteLength !== b.byteLength) return true
      for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) return true
      }
      return false
    })
    expect(multiPktIdx).toBeGreaterThanOrEqual(0)

    // 1. 1-byte mutation in bridge stream
    const modBridgeByte = cloneStream(res.bridgeS2cByFrame)
    modBridgeByte[firstNonEmptyIdx]![0]![0] ^= 0x01
    const cmp1 = compareS2CStreamsByteExact113c(res.replayS2cByFrame, modBridgeByte, 3)
    expect(cmp1.equal).toBe(false)
    expect(cmp1.firstMismatch?.kind).toBe('packet-byte')
    expect(cmp1.firstMismatch?.frame).toBe(3 + firstNonEmptyIdx)
    expect(cmp1.firstMismatch?.packetIndex).toBe(0)
    expect(cmp1.firstMismatch?.byteOffset).toBe(0)

    // 2. 1-byte mutation in replay stream
    const modReplayByte = cloneStream(res.replayS2cByFrame)
    const lastByteIdx = modReplayByte[firstNonEmptyIdx]![0]!.byteLength - 1
    modReplayByte[firstNonEmptyIdx]![0]![lastByteIdx] ^= 0xff
    const cmp2 = compareS2CStreamsByteExact113c(modReplayByte, res.bridgeS2cByFrame, 3)
    expect(cmp2.equal).toBe(false)
    expect(cmp2.firstMismatch?.kind).toBe('packet-byte')
    expect(cmp2.firstMismatch?.byteOffset).toBe(lastByteIdx)

    // 3. Packet-order swap within a multi-packet frame (no sorting)
    const swappedBridge = cloneStream(res.bridgeS2cByFrame)
    const framePkts = swappedBridge[multiPktIdx]!
    const tmp = framePkts[0]!
    framePkts[0] = framePkts[1]!
    framePkts[1] = tmp
    const cmp3 = compareS2CStreamsByteExact113c(res.replayS2cByFrame, swappedBridge, 3)
    expect(cmp3.equal).toBe(false)
    expect(cmp3.firstMismatch?.frame).toBe(3 + multiPktIdx)

    // 4. Packet-length diffs (+1 trailing zero byte and -1 truncated byte; no masking/truncation)
    const paddedBridge = cloneStream(res.bridgeS2cByFrame)
    const origPkt = paddedBridge[firstNonEmptyIdx]![0]!
    const extended = new Uint8Array(origPkt.byteLength + 1)
    extended.set(origPkt, 0)
    paddedBridge[firstNonEmptyIdx]![0] = extended
    const cmp4a = compareS2CStreamsByteExact113c(res.replayS2cByFrame, paddedBridge, 3)
    expect(cmp4a.equal).toBe(false)
    expect(cmp4a.firstMismatch?.kind).toBe('packet-length')

    const truncBridge = cloneStream(res.bridgeS2cByFrame)
    truncBridge[firstNonEmptyIdx]![0] = origPkt.slice(0, origPkt.byteLength - 1)
    const cmp4b = compareS2CStreamsByteExact113c(res.replayS2cByFrame, truncBridge, 3)
    expect(cmp4b.equal).toBe(false)
    expect(cmp4b.firstMismatch?.kind).toBe('packet-length')

    // 5. Packet-count diffs (drop 1 packet and duplicate 1 packet; no filtering/deduping)
    const droppedBridge = cloneStream(res.bridgeS2cByFrame)
    droppedBridge[firstNonEmptyIdx]!.pop()
    const cmp5a = compareS2CStreamsByteExact113c(res.replayS2cByFrame, droppedBridge, 3)
    expect(cmp5a.equal).toBe(false)
    expect(cmp5a.firstMismatch?.kind).toBe('packet-count')

    const dupBridge = cloneStream(res.bridgeS2cByFrame)
    dupBridge[firstNonEmptyIdx]!.push(dupBridge[firstNonEmptyIdx]![0]!.slice())
    const cmp5b = compareS2CStreamsByteExact113c(res.replayS2cByFrame, dupBridge, 3)
    expect(cmp5b.equal).toBe(false)
    expect(cmp5b.firstMismatch?.kind).toBe('packet-count')

    // 6. Frame-count diff
    const shorterBridge = cloneStream(res.bridgeS2cByFrame).slice(0, -1)
    const cmp6 = compareS2CStreamsByteExact113c(res.replayS2cByFrame, shorterBridge, 3)
    expect(cmp6.equal).toBe(false)
    expect(cmp6.firstMismatch?.kind).toBe('frame-count')

    // 7. Strict hexToBytes113c validation (rejects trailing non-hex, signs, and odd length)
    expect(() => hexToBytes113c('0z')).toThrow(/Invalid non-hex/)
    expect(() => hexToBytes113c('+1')).toThrow(/Invalid non-hex/)
    expect(() => hexToBytes113c('1g')).toThrow(/Invalid non-hex/)
    expect(() => hexToBytes113c('zz')).toThrow(/Invalid non-hex/)
    expect(() => hexToBytes113c('abc')).toThrow(/Invalid odd-length/)
    expect(Array.from(hexToBytes113c('0a 1b FF'))).toEqual([0x0a, 0x1b, 0xff])
  }, 120_000)

  it('validates EXPECTED_BRIDGE_REPLAY_DIVERGENCES_113C invariants and live Phase 2B divergence canary on a1-bloodmoor-melee F1000', () => {
    const ids = new Set<string>()
    for (const d of EXPECTED_BRIDGE_REPLAY_DIVERGENCES_113C) {
      expect(d.id.trim().length).toBeGreaterThan(0)
      expect(ids.has(d.id), `duplicate divergence id ${d.id}`).toBe(false)
      ids.add(d.id)
      expect(['2B', '2C', '2D', '2E']).toContain(d.targetPhase)
      expect(d.bridgeIntercept.trim().length).toBeGreaterThan(0)
      expect(d.targetKernelSymbol.trim().length).toBeGreaterThan(0)
      expect(d.parityScenario.trim().length).toBeGreaterThan(0)
      expect(BASELINE_PARITY_SCENARIOS.has(d.parityScenario)).toBe(false)
    }

    // Live Phase 2B canary: movement F3..F999 matches 100%, while F1000 C2S 0x06 is intercepted
    // by legacy handleC2SSkillUse, proving the harness genuinely exercises bridge gameplay dispatch.
    const canary = runDualDriveS2C113c({
      scenarioName: 'a1-bloodmoor-melee',
      maxFrame: 1100,
    })
    console.log(canary.summary)
    expect(canary.worldsIndependent).toBe(true)
    expect(canary.comparison.equal).toBe(false)
    expect(canary.comparison.firstMismatch).not.toBeNull()
    expect(canary.comparison.firstMismatch!.frame).toBeGreaterThanOrEqual(1000)
  }, 120_000)
})
