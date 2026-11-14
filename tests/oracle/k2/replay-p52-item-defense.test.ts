/**
 * K2 longitudinal replay ratchet of `p52-item-defense` (1,600 frames) from the F2 boot snapshot
 * (tests/fixtures/oracle/k1/replay/p52-item-defense.snap-f002.ndjson.gz) against the oracle golden
 * (tests/fixtures/oracle/golden/p52-item-defense.oracle.ndjson.gz). Ratchet horizons:
 * tests/fixtures/oracle/k1/replay/horizons.json; divergence report: docs/oracle/k1-replay/p52-item-defense.divergence.md.
 */
import { defineReplayRatchet113c } from '../k1/replay-ratchet.ts'

defineReplayRatchet113c('p52-item-defense')
