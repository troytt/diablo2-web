/**
 * K2 longitudinal replay ratchet of `p52-item-defense` (1,600 frames, locked at `strict: 1600, pos: 1600`)
 * from the F2 boot snapshot (tests/fixtures/oracle/k1/replay/p52-item-defense.snap-f002.ndjson.gz) against the
 * oracle golden (tests/fixtures/oracle/golden/p52-item-defense.oracle.ndjson.gz). Ratchet horizons:
 * tests/fixtures/oracle/k1/replay/horizons.json; divergence report: docs/oracle/k1-replay/p52-item-defense.divergence.md.
 */
import { describe, expect, it } from 'vitest'
import { loadHorizons113c } from '../../../tools/oracle/kern-replay/report.ts'
import { defineReplayRatchet113c } from '../k1/replay-ratchet.ts'

defineReplayRatchet113c('p52-item-defense')

describe('K2 p52-item-defense full 1600-frame closure lock', () => {
  it('locks horizons.json at strict: 1600, pos: 1600', () => {
    const h = loadHorizons113c()['p52-item-defense']
    expect(h).toEqual({ bootFrame: 2, strict: 1600, pos: 1600 })
  })
})
