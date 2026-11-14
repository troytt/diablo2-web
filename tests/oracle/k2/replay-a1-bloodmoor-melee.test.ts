/**
 * K2 longitudinal replay ratchet of `a1-bloodmoor-melee` (1,800 frames) from the F2 boot snapshot
 * (tests/fixtures/oracle/k1/replay/a1-bloodmoor-melee.snap-f002.ndjson.gz) against the oracle golden
 * (tests/fixtures/oracle/golden/a1-bloodmoor-melee.oracle.ndjson.gz). Ratchet horizons:
 * tests/fixtures/oracle/k1/replay/horizons.json; divergence report: docs/oracle/k1-replay/a1-bloodmoor-melee.divergence.md.
 */
import { defineReplayRatchet113c } from '../k1/replay-ratchet.ts'

defineReplayRatchet113c('a1-bloodmoor-melee')
