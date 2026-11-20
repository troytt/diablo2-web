/**
 * Shared ratchet suite for the K1 kernel-driven longitudinal replay (tools/oracle/kern-replay/).
 * Horizons in tests/fixtures/oracle/k1/replay/horizons.json only move up
 * (`npx tsx tools/oracle/kern-replay/report.ts --write --update-horizons`).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2UnitStrc, D2GameStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  bootFromSnapshot113c,
  diffFrame113c,
  goldenPath113c,
  loadGolden113c,
  loadSnapshotFile113c,
  runReplay113c,
  sampleFrame113c,
  snapshotPath113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'
import {
  DIVERGENCE_DIR_113C,
  loadHorizons113c,
  type DivergenceArtifact113c,
} from '../../../tools/oracle/kern-replay/report.ts'

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function defineReplayRatchet113c(name: string): void {
  const H = loadHorizons113c()[name]
  if (H === undefined) throw new Error(`horizons.json has no entry for ${name}`)
  const r = runReplay113c(name, H.bootFrame)
  const golden = loadGolden113c(name)

  describe(`K1 kernel replay ${name} (boot F${H.bootFrame}, strict F${H.strict}, pos F${H.pos})`, () => {
    it('hydrated boot snapshot equals the golden boot frame on every field (strict)', () => {
      expect(r.bootCheck).toBeNull()
    })

    it('boot comparison detects a single corrupted unit seed (negative control)', () => {
      const world = bootFromSnapshot113c(loadSnapshotFile113c(snapshotPath113c(name, H.bootFrame)))
      const pPlayer = world.m.get(world.pGame, D2GameStrc.pUnitHash, 1) // player id 1 -> list 0, bucket 1
      expect(pPlayer).not.toBe(0)
      expect(world.m.get(pPlayer, D2UnitStrc.dwUnitId)).toBe(1)
      world.m.set(pPlayer, D2UnitStrc.seedLo, (world.m.get(pPlayer, D2UnitStrc.seedLo) ^ 1) >>> 0)
      const bootGolden = golden.frames.get(H.bootFrame)
      expect(bootGolden).toBeDefined()
      const d = diffFrame113c(bootGolden!, sampleFrame113c(world, golden.header), golden.header, 'strict')
      expect(d).toMatchObject({ key: 't0', id: 1, field: 'seedLo' })
      expect(diffFrame113c(bootGolden!, sampleFrame113c(world, golden.header), golden.header, 'pos')).toBeNull()
    })

    it('matches the golden on every frame through the committed strict and position horizons', () => {
      expect(r.bootFrame).toBe(H.bootFrame)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(H.strict)
      expect(r.posHorizon).toBeGreaterThanOrEqual(H.pos)
      expect(r.posHorizon).toBeGreaterThanOrEqual(r.strictHorizon)
    })

    it('stops at an explicit first divergence (unported kernel function or field mismatch)', () => {
      if (r.strictHorizon === r.lastGoldenFrame) {
        expect(r.firstStrictDivergence).toBeNull()
        return
      }
      const d = r.firstStrictDivergence
      expect(d).not.toBeNull()
      expect(d!.frame).toBe(r.strictHorizon + 1)
      if (d!.key === 'step') {
        // A kernel step that cannot run is always an unported (or impure) function, never a silent no-op.
        expect(r.unportedHit).not.toBeNull()
        expect(d!.field).toBe(`<unported ${r.unportedHit!.key}>`)
      }
      if (r.unportedHit !== null) expect(r.unportedHit.frame).toBe(r.posHorizon + 1)
    })

    it('committed divergence artifact never claims more than the measured replay', () => {
      const art = JSON.parse(
        readFileSync(join(DIVERGENCE_DIR_113C, `${name}.divergence.json`), 'utf8'),
      ) as DivergenceArtifact113c
      expect(art.scenario).toBe(name)
      expect(art.strictHorizon).toBeLessThanOrEqual(r.strictHorizon)
      expect(art.posHorizon).toBeLessThanOrEqual(r.posHorizon)
      expect(art.goldenSha256).toBe(sha256(goldenPath113c(name)))
      expect(art.snapshotSha256).toBe(sha256(snapshotPath113c(name, H.bootFrame)))
      expect(H.strict).toBeLessThanOrEqual(r.strictHorizon)
    })

    if (H.strict >= r.lastGoldenFrame) {
      it(`gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame}`, () => {
        expect(r.firstStrictDivergence).toBeNull()
      })
    } else {
      it.todo(`gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame} (enabled once horizons.json strict reaches F${r.lastGoldenFrame})`)
    }
  })
}
