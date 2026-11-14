/**
 * K1 exit gate: kernel-driven longitudinal replay of `a1c-bloodmoor-fallen` from the F2 boot snapshot
 * (tests/fixtures/oracle/k1/replay/a1c-bloodmoor-fallen.snap-f002.ndjson.gz) against the oracle golden
 * (tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz). Ratchet horizons:
 * tests/fixtures/oracle/k1/replay/horizons.json; divergence report: docs/oracle/k1-replay/a1c-bloodmoor-fallen.divergence.md.
 */
import { defineReplayRatchet113c } from './replay-ratchet.ts'

defineReplayRatchet113c('a1c-bloodmoor-fallen')
