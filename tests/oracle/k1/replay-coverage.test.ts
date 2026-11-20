/**
 * K1 replay coverage fixtures (tests/fixtures/oracle/k1/replay/<scenario>.coverage.ndjson.gz): recorded
 * by the oracle hook's `cover` mode on the original DLLs; source of docs/oracle/k1-replay/gap-*.md.
 */
import { describe, expect, it } from 'vitest'
import { computeGaps113c, loadCoverage113c } from '../../../tools/oracle/kern-replay/gap-report.ts'
import { loadManifest113c, loadScenario113c, manifestKey113c } from '../../../tools/oracle/kern-replay/replay-113c.ts'

for (const name of ['a1-town-walk', 'a1c-bloodmoor-fallen']) {
  describe(`K1 replay coverage ${name}`, () => {
    const cov = loadCoverage113c(name)
    const scenario = loadScenario113c(name)

    it('covers every frame of the scenario over the whole manifest', () => {
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(scenario.frames)
      expect(cov.entries).toBe(loadManifest113c().size)
    })

    it('every hit is a manifest function first seen inside the recorded frame range', () => {
      const manifest = loadManifest113c()
      const seen = new Set<string>()
      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        expect(manifest.has(key), key).toBe(true)
        expect(seen.has(key), key).toBe(false)
        seen.add(key)
        expect(h.firstFrame).toBeGreaterThanOrEqual(cov.from)
        expect(h.firstFrame).toBeLessThanOrEqual(cov.to)
      }
    })

    it('frame root runs from F1 and the C2S dispatcher first runs on the first input frame', () => {
      const byKey = new Map(cov.hits.map((h) => [manifestKey113c(h.module, h.va), h.firstFrame]))
      expect(byKey.get('D2Game:0x6FC4E050')).toBe(1)
      const firstInput = Math.min(...scenario.inputs.map((i) => i.frame))
      expect(byKey.get('D2Game:0x6FCEC550')).toBe(firstInput)
    })

    it('gap list = executed functions that are neither ported nor diff-verified', () => {
      const s = computeGaps113c(name)
      const manifest = loadManifest113c()
      let gaps = 0
      for (const h of cov.hits) {
        const st = manifest.get(manifestKey113c(h.module, h.va))!.status
        if (st !== 'ported' && st !== 'diff-verified') gaps++
      }
      expect(s.gaps.length).toBe(gaps)
      for (const g of s.gaps) expect(['ported', 'diff-verified']).not.toContain(g.status)
    })
  })
}
