/**
 * K1 exit gate: kernel-driven longitudinal replay of `a1-town-walk` from the F2 boot snapshot
 * (tests/fixtures/oracle/k1/replay/a1-town-walk.snap-f002.ndjson.gz) against the oracle golden
 * (tests/fixtures/oracle/golden/a1-town-walk.oracle.ndjson.gz). Ratchet horizons:
 * tests/fixtures/oracle/k1/replay/horizons.json; divergence report: docs/oracle/k1-replay/a1-town-walk.divergence.md.
 */
import { defineReplayRatchet113c } from './replay-ratchet.ts'

defineReplayRatchet113c('a1-town-walk')
