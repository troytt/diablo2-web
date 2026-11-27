/**
 * K1 kernel replay purity guard: the replay path (tools/oracle/kern-replay/replay-113c.ts and
 * everything it imports, type imports included) never reaches the legacy `src/server/` or
 * `src/common/` trees, and an unported kernel function throws instead of falling back.
 */
import { describe, expect, it } from 'vitest'
import { collectImportGraph, legacyReachable } from '../../../tools/oracle/kern-replay/import-graph.ts'
import {
  KERNEL_REGISTRY_113C,
  REPO_ROOT_113C,
  UnportedFunction113c,
  bootFromSnapshot113c,
  callKernel113c,
  loadManifest113c,
  loadSnapshotFile113c,
  snapshotPath113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'
import { mergeHorizons113c, type Horizon113c } from '../../../tools/oracle/kern-replay/report.ts'

const REPLAY_ENTRIES = ['tools/oracle/kern-replay/replay-113c.ts', 'tools/oracle/kern-replay/report.ts']

describe('K1 kernel replay purity', () => {
  const graph = collectImportGraph(REPO_ROOT_113C, REPLAY_ENTRIES)

  it('replay path imports nothing from src/server or src/common', () => {
    expect(legacyReachable(graph, REPLAY_ENTRIES)).toEqual([])
    for (const f of graph.files) {
      expect(f.startsWith('src/server/')).toBe(false)
      expect(f.startsWith('src/common/')).toBe(false)
    }
  })

  it('replay path really runs on kernel modules (guard is not vacuous)', () => {
    for (const f of [
      'src/d2kern-113c/mem/sparse-memory.ts',
      'src/d2kern-113c/common/statlist.ts',
      'src/d2kern-113c/common/unit.ts',
      'src/d2kern-113c/common/dungeon.ts',
    ]) {
      expect(graph.files.has(f)).toBe(true)
    }
    // The K0 Fallen slice driver imports legacy src/common code and must stay off the replay path.
    expect(graph.files.has('src/d2kern-113c/game/fallen-ai-113c.ts')).toBe(false)
  })

  it('K0 Fallen slice driver in src/d2kern-113c/game is now pure too', () => {
    const entry = 'src/d2kern-113c/game/fallen-ai-113c.ts'
    const slice = collectImportGraph(REPO_ROOT_113C, [entry])
    expect(legacyReachable(slice, [entry])).toEqual([])
  })

  it('walker detects a legacy import (negative control: server town NPC driver)', () => {
    const entry = 'src/server/ai/town-npc-ai-113c.ts'
    const slice = collectImportGraph(REPO_ROOT_113C, [entry])
    const legacy = legacyReachable(slice, [entry])
    expect(legacy.length).toBeGreaterThan(0)
    expect(legacy.some((chain) => chain.endsWith('src/common/path/index.ts'))).toBe(true)
  })

  it('every registry entry is a ported/diff-verified manifest function with a pure kernFile', () => {
    const manifest = loadManifest113c()
    for (const key of KERNEL_REGISTRY_113C.keys()) {
      const f = manifest.get(key)
      expect(f, key).toBeDefined()
      expect(['ported', 'diff-verified']).toContain(f!.status)
      expect(typeof f!.kernFile).toBe('string')
      const kf = f!.kernFile as string
      expect(legacyReachable(collectImportGraph(REPO_ROOT_113C, [kf]), [kf]), key).toEqual([])
    }
  })

  it('calling an unwired or unported function throws UnportedFunction113c', () => {
    const world = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c('a1-town-walk', 2)))
    const manifest = loadManifest113c()
    const unported = [...manifest.values()].find((f) => f.module === 'D2Game' && f.status === 'unported')
    if (unported !== undefined) {
      const va = parseInt(unported.va, 16)
      let err: unknown = null
      try {
        callKernel113c(world, 'D2Game', va, [world.pGame])
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(UnportedFunction113c)
      expect((err as UnportedFunction113c).status).toBe('unported')
      expect((err as UnportedFunction113c).va).toBe(va)
    } else {
      // At 4810/4810 100% manifest closure, every manifest VA is ported/diff-verified:
      // verify unwired manifest VAs and non-manifest VAs both throw UnportedFunction113c.
      const unwired = [...manifest.entries()].find(
        ([k, f]) => f.module === 'D2Game' && !KERNEL_REGISTRY_113C.has(k),
      )
      expect(unwired).toBeDefined()
      const unwiredVa = parseInt(unwired![1].va, 16)
      let unwiredErr: unknown = null
      try {
        callKernel113c(world, 'D2Game', unwiredVa, [world.pGame])
      } catch (e) {
        unwiredErr = e
      }
      expect(unwiredErr).toBeInstanceOf(UnportedFunction113c)
      expect((unwiredErr as UnportedFunction113c).va).toBe(unwiredVa)

      let unknownErr: unknown = null
      try {
        callKernel113c(world, 'D2Game', 0x6fc20000, [world.pGame])
      } catch (e) {
        unknownErr = e
      }
      expect(unknownErr).toBeInstanceOf(UnportedFunction113c)
      expect((unknownErr as UnportedFunction113c).status).toBe('not-in-manifest')
      expect((unknownErr as UnportedFunction113c).va).toBe(0x6fc20000)
    }
  })

  it('horizon updater only moves up and reports regressions', () => {
    const committed: Record<string, Horizon113c> = { s: { bootFrame: 2, strict: 10, pos: 20 } }
    const base = {
      scenario: 's',
      bootFrame: 2,
      lastGoldenFrame: 100,
      bootCheck: null,
      firstStrictDivergence: null,
      firstPosDivergence: null,
      unportedHit: null,
      framesStepped: 0,
      tsExecutedVas: [],
    }
    const up = mergeHorizons113c(committed, [{ ...base, strictHorizon: 12, posHorizon: 25 }])
    expect(up.regressions).toEqual([])
    expect(up.next.s).toEqual({ bootFrame: 2, strict: 12, pos: 25 })
    const down = mergeHorizons113c(committed, [{ ...base, strictHorizon: 9, posHorizon: 20 }])
    expect(down.regressions).toEqual(['s: strict F10 -> F9'])
    expect(down.next.s!.strict).toBe(10)
  })
})
