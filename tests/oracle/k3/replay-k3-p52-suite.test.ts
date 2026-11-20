/**
 * Milestone 34 ([K3]) Longitudinal Golden Replay Suite:
 * Replays all 9 [K3] `p52-*` scenarios from their F2 boot snapshots
 * (`tests/fixtures/oracle/k3/replay/<scenario>.snap-f002.ndjson.gz`) through the pure
 * `ReplayKernel113c` (`src/d2kern-113c/`) against the authoritative 1.13c oracle goldens
 * (`tests/fixtures/oracle/golden/<scenario>.oracle.ndjson.gz`), enforces upward-only
 * ratchet horizons (`tests/fixtures/oracle/k3/replay/horizons.json`), verifies committed
 * divergence artifacts (`docs/oracle/k3-replay/<scenario>.divergence.json`), and locks in
 * dynamic `D2Common.dll` / `D2Game.dll` coverage baselines (`<scenario>.coverage.ndjson.gz`).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2GameStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { collectImportGraph, legacyReachable } from '../../../tools/oracle/kern-replay/import-graph.ts'
import {
  K3_DIVERGENCE_DIR_113C,
  K3_REPLAY_SCENARIOS_113C,
  computeK3Gaps113c,
  k3SnapshotPath113c,
  loadK3Coverage113c,
  loadK3Horizons113c,
  runK3Replay113c,
  type K3ReplayScenarioName113c,
} from '../../../tools/oracle/kern-replay/k3-replay.ts'
import {
  REPO_ROOT_113C,
  bootFromSnapshot113c,
  diffFrame113c,
  goldenPath113c,
  loadGolden113c,
  loadManifest113c,
  loadScenario113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'
import type { DivergenceArtifact113c } from '../../../tools/oracle/kern-replay/report.ts'

interface K3CoverageBaseline113c {
  readonly name: K3ReplayScenarioName113c
  readonly frames: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  /** Monotonic ceiling on `D2Game` `runtimeExecGap` (`dllExecuted - tsExecuted`): only decreases toward 0. */
  readonly maxD2GameRuntimeExecGap: number
  /** Monotonic ceiling on `D2Common` `runtimeExecGap` (`dllExecuted - tsExecuted`): only decreases toward 0. */
  readonly maxD2CommonRuntimeExecGap: number
  readonly initialD2GameGapCount: number
  readonly initialD2GameGapBytes: number
  readonly initialD2GameGapVas: readonly string[]
}

/** Monotonic ceiling on the 9-scenario union of `D2Game` `runtimeExecGap` (out of 652 DLL-executed `D2Game` VAs). */
const MAX_K3_UNION_D2GAME_RUNTIME_EXEC_GAP = 0
/** Monotonic ceiling on the 9-scenario union of `D2Common` `runtimeExecGap` (out of 780 DLL-executed `D2Common` VAs). */
const MAX_K3_UNION_D2COMMON_RUNTIME_EXEC_GAP = 0

const K3_COVERAGE_BASELINES_113C: readonly K3CoverageBaseline113c[] = [
  {
    name: 'p52-amazon-defense',
    frames: 1800,
    totalHits: 958,
    d2CommonExecuted: 520,
    d2GameExecuted: 438,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 102,
    initialD2GameGapBytes: 33612,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FC57030',
      '0x6FCFA6D0',
      '0x6FCFAB90',
      '0x6FCFCF20',
      '0x6FCFDDE0',
      '0x6FCFE5A0',
      '0x6FCFED30',
      '0x6FC981C0',
      '0x6FCEB950',
      '0x6FCFB790',
      '0x6FCFCE70',
      '0x6FC98430',
      '0x6FCFA540',
      '0x6FCFB030',
      '0x6FCBF850',
      '0x6FCC1630',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE620',
      '0x6FCEE9D0',
      '0x6FC971D0',
      '0x6FC99170',
      '0x6FCC2C40',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFAA90',
      '0x6FCFAD70',
      '0x6FCFB1F0',
      '0x6FCFBED0',
      '0x6FCFC530',
      '0x6FCFCD80',
      '0x6FCFD450',
      '0x6FC978A0',
      '0x6FC97B20',
      '0x6FC98A90',
      '0x6FC98DD0',
      '0x6FC99100',
      '0x6FC95350',
      '0x6FC977F0',
      '0x6FCFA660',
      '0x6FCFA7B0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFC030',
      '0x6FCFC0B0',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFDAC0',
      '0x6FCFE0C0',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEBA0',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-amazon-valkyrie',
    frames: 1500,
    totalHits: 1132,
    d2CommonExecuted: 641,
    d2GameExecuted: 491,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 91,
    initialD2GameGapBytes: 31269,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FCEDF30',
      '0x6FCEE520',
      '0x6FC57190',
      '0x6FC6D710',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC57030',
      '0x6FC95350',
      '0x6FC971D0',
      '0x6FC977F0',
      '0x6FCFA540',
      '0x6FCFA660',
      '0x6FCFA6D0',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFAB90',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFB790',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC030',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFCF20',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFDDE0',
      '0x6FCFE0C0',
      '0x6FCFE5A0',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEBA0',
      '0x6FCFED30',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-barbarian-warcries',
    frames: 1600,
    totalHits: 1072,
    d2CommonExecuted: 587,
    d2GameExecuted: 485,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 108,
    initialD2GameGapBytes: 34558,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FCEB1F0',
      '0x6FCEDF30',
      '0x6FCEE520',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC57030',
      '0x6FC98430',
      '0x6FC98760',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE120',
      '0x6FCEE620',
      '0x6FCEE9D0',
      '0x6FCC1630',
      '0x6FC971D0',
      '0x6FCC2C40',
      '0x6FCFA660',
      '0x6FCFA6D0',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFAA90',
      '0x6FCFAB90',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB1F0',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB790',
      '0x6FCFB910',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFCF20',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFDDE0',
      '0x6FCFE0C0',
      '0x6FCFE5A0',
      '0x6FCFEBA0',
      '0x6FCFED30',
      '0x6FC95350',
      '0x6FC977F0',
      '0x6FCFA540',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFC030',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC978A0',
      '0x6FC97B20',
      '0x6FC98A90',
      '0x6FC98DD0',
      '0x6FC99100',
      '0x6FCEBBB0',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-necromancer-curses',
    frames: 2000,
    totalHits: 1141,
    d2CommonExecuted: 617,
    d2GameExecuted: 524,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 107,
    initialD2GameGapBytes: 34595,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FC98430',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE620',
      '0x6FCEE870',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC98760',
      '0x6FCEE120',
      '0x6FCEE9D0',
      '0x6FCC1630',
      '0x6FC57030',
      '0x6FCFA6D0',
      '0x6FCFAB90',
      '0x6FCFCF20',
      '0x6FCFDDE0',
      '0x6FCFE5A0',
      '0x6FCFED30',
      '0x6FC971D0',
      '0x6FCC2C40',
      '0x6FCFA540',
      '0x6FCFA660',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFAA90',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB1F0',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB790',
      '0x6FCFB910',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFE0C0',
      '0x6FCFEBA0',
      '0x6FC978A0',
      '0x6FC97B20',
      '0x6FC98A90',
      '0x6FC98DD0',
      '0x6FC99100',
      '0x6FC95350',
      '0x6FC977F0',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFC030',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FCEBBB0',
      '0x6FC3EB20',
      '0x6FC718B0',
    ],
  },
  {
    name: 'p52-necromancer-poison-golem',
    frames: 1800,
    totalHits: 1131,
    d2CommonExecuted: 615,
    d2GameExecuted: 516,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 92,
    initialD2GameGapBytes: 31434,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FCEDF30',
      '0x6FCEE520',
      '0x6FC57190',
      '0x6FC71750',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC57030',
      '0x6FC971D0',
      '0x6FCFA6D0',
      '0x6FCFAB90',
      '0x6FCFCF20',
      '0x6FCFDDE0',
      '0x6FCFE5A0',
      '0x6FCFED30',
      '0x6FCFA540',
      '0x6FCFA660',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB790',
      '0x6FCFB910',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFE0C0',
      '0x6FCFEBA0',
      '0x6FC95350',
      '0x6FC977F0',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFC030',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-paladin-auras',
    frames: 1700,
    totalHits: 1083,
    d2CommonExecuted: 601,
    d2GameExecuted: 482,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 105,
    initialD2GameGapBytes: 34001,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCBF850',
      '0x6FCEF480',
      '0x6FC98430',
      '0x6FC98760',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE120',
      '0x6FCEE620',
      '0x6FCEE9D0',
      '0x6FCC1630',
      '0x6FC57030',
      '0x6FC95350',
      '0x6FC971D0',
      '0x6FC977F0',
      '0x6FC99170',
      '0x6FCC2C40',
      '0x6FCFA660',
      '0x6FCFA6D0',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFAA90',
      '0x6FCFAB90',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB1F0',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFB790',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC030',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFCF20',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFDDE0',
      '0x6FCFE0C0',
      '0x6FCFE5A0',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEBA0',
      '0x6FCFED30',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC978A0',
      '0x6FC97B20',
      '0x6FC98A90',
      '0x6FC98DD0',
      '0x6FC99100',
      '0x6FCFA540',
      '0x6FCEBBB0',
      '0x6FCFB910',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-paladin-merc-aura',
    frames: 1700,
    totalHits: 1210,
    d2CommonExecuted: 666,
    d2GameExecuted: 544,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 104,
    initialD2GameGapBytes: 33583,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FCBD160',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FC39BA0',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCBF850',
      '0x6FCEF480',
      '0x6FC98430',
      '0x6FC98760',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE120',
      '0x6FCEE620',
      '0x6FCEE9D0',
      '0x6FCC1630',
      '0x6FC57030',
      '0x6FC95350',
      '0x6FC971D0',
      '0x6FC977F0',
      '0x6FC99170',
      '0x6FCC2C40',
      '0x6FCFA660',
      '0x6FCFA6D0',
      '0x6FCFA7B0',
      '0x6FCFA890',
      '0x6FCFA8C0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFAA90',
      '0x6FCFAB90',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFAD70',
      '0x6FCFB030',
      '0x6FCFB1F0',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFB790',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFBED0',
      '0x6FCFC030',
      '0x6FCFC0B0',
      '0x6FCFC530',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCD80',
      '0x6FCFCE70',
      '0x6FCFCF20',
      '0x6FCFD450',
      '0x6FCFDAC0',
      '0x6FCFDDE0',
      '0x6FCFE0C0',
      '0x6FCFE5A0',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEBA0',
      '0x6FCFED30',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FC978A0',
      '0x6FC97B20',
      '0x6FC98A90',
      '0x6FC98DD0',
      '0x6FC99100',
      '0x6FCFA540',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-sorceress-elemental',
    frames: 1800,
    totalHits: 986,
    d2CommonExecuted: 552,
    d2GameExecuted: 434,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 79,
    initialD2GameGapBytes: 26985,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FC98430',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE620',
      '0x6FCEE870',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC57030',
      '0x6FC95350',
      '0x6FC971D0',
      '0x6FC977F0',
      '0x6FCFA540',
      '0x6FCFA660',
      '0x6FCFA7B0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFAC10',
      '0x6FCFAD00',
      '0x6FCFB030',
      '0x6FCFB3C0',
      '0x6FCFB570',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFC030',
      '0x6FCFC0B0',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCF20',
      '0x6FCFDAC0',
      '0x6FCFE0C0',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FCEDF30',
      '0x6FCEE520',
      '0x6FC3EB20',
    ],
  },
  {
    name: 'p52-sorceress-fire-dot',
    frames: 1800,
    totalHits: 969,
    d2CommonExecuted: 543,
    d2GameExecuted: 426,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 77,
    initialD2GameGapBytes: 26453,
    initialD2GameGapVas: [
      '0x6FC4D9B0',
      '0x6FC400E0',
      '0x6FC468E0',
      '0x6FC67CF0',
      '0x6FC8B200',
      '0x6FCB2ED0',
      '0x6FCBD230',
      '0x6FCCFDB0',
      '0x6FD00460',
      '0x6FD00860',
      '0x6FD0E260',
      '0x6FD0E7B0',
      '0x6FC35D10',
      '0x6FC3DB40',
      '0x6FCBCB00',
      '0x6FCBD160',
      '0x6FC36610',
      '0x6FC36970',
      '0x6FC36A30',
      '0x6FC39BB0',
      '0x6FC39C20',
      '0x6FC3BBC0',
      '0x6FC40E00',
      '0x6FC417D0',
      '0x6FD11D90',
      '0x6FD130C0',
      '0x6FC98550',
      '0x6FCEBF50',
      '0x6FCEE040',
      '0x6FCBD980',
      '0x6FCBDC10',
      '0x6FCD1820',
      '0x6FCD1C90',
      '0x6FD13220',
      '0x6FC40760',
      '0x6FCEF480',
      '0x6FCEDF30',
      '0x6FCEE520',
      '0x6FC99170',
      '0x6FCBF850',
      '0x6FC57030',
      '0x6FC971D0',
      '0x6FCFA540',
      '0x6FCFA7B0',
      '0x6FCFA930',
      '0x6FCFA970',
      '0x6FCFAC10',
      '0x6FCFB030',
      '0x6FCFB570',
      '0x6FCFB790',
      '0x6FCFBA40',
      '0x6FCFBD00',
      '0x6FCFC0B0',
      '0x6FCFC780',
      '0x6FCFC940',
      '0x6FCFCAB0',
      '0x6FCFCC20',
      '0x6FCFCF20',
      '0x6FCFDAC0',
      '0x6FCFE0C0',
      '0x6FCFAD00',
      '0x6FCFB3C0',
      '0x6FC95350',
      '0x6FC977F0',
      '0x6FCFA9E0',
      '0x6FCFAA40',
      '0x6FCFB5E0',
      '0x6FCFB6B0',
      '0x6FCFC030',
      '0x6FCFE6D0',
      '0x6FCFEA00',
      '0x6FCFEEE0',
      '0x6FCFFA60',
      '0x6FCECFE0',
      '0x6FCED630',
      '0x6FCEE870',
      '0x6FC3EB20',
    ],
  },
]

const DONE_STATUSES_113C = new Set(['ported', 'diff-verified'])

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function formatVa113c(va: number): string {
  return `0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

describe('K3 replay purity & suite roster', () => {
  const entries = ['tools/oracle/kern-replay/k3-replay.ts']
  const graph = collectImportGraph(REPO_ROOT_113C, entries)

  it('k3-replay runner never imports legacy src/common or src/server modules', () => {
    expect(legacyReachable(graph, entries)).toEqual([])
    for (const f of graph.files) {
      expect(f.startsWith('src/server/')).toBe(false)
      expect(f.startsWith('src/common/')).toBe(false)
    }
  })

  it('covers all 9 [K3] p52-* scenarios in horizons.json and coverage baselines', () => {
    const horizons = loadK3Horizons113c()
    expect(Object.keys(horizons).sort()).toEqual([...K3_REPLAY_SCENARIOS_113C].sort())
    expect(K3_COVERAGE_BASELINES_113C.map((b) => b.name)).toEqual([...K3_REPLAY_SCENARIOS_113C])
  })

  it('locks full-horizon closure for p52-amazon-defense (F1800/F1800)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-amazon-defense']).toEqual({
      bootFrame: 2,
      strict: 1800,
      pos: 1800,
    })
  })

  it('locks full-horizon closure for p52-paladin-auras (F1700/F1700)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-paladin-auras']).toEqual({
      bootFrame: 2,
      strict: 1700,
      pos: 1700,
    })
  })

  it('locks full-horizon closure for p52-barbarian-warcries (F1600/F1600)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-barbarian-warcries']).toEqual({
      bootFrame: 2,
      strict: 1600,
      pos: 1600,
    })
  })

  it('locks full-horizon closure for p52-sorceress-elemental (F1800/F1800)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-sorceress-elemental']).toEqual({
      bootFrame: 2,
      strict: 1800,
      pos: 1800,
    })
  })

  it('locks full-horizon closure for p52-sorceress-fire-dot (F1800/F1800)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-sorceress-fire-dot']).toEqual({
      bootFrame: 2,
      strict: 1800,
      pos: 1800,
    })
  })

  it('locks full-horizon closure for p52-paladin-merc-aura (F1700/F1700)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-paladin-merc-aura']).toEqual({
      bootFrame: 2,
      strict: 1700,
      pos: 1700,
    })
  })

  it('locks full-horizon closure for p52-amazon-valkyrie (F1500/F1500)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-amazon-valkyrie']).toEqual({
      bootFrame: 2,
      strict: 1500,
      pos: 1500,
    })
  })

  it('locks full-horizon closure for p52-necromancer-poison-golem (F1800/F1800)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-necromancer-poison-golem']).toEqual({
      bootFrame: 2,
      strict: 1800,
      pos: 1800,
    })
  })

  it('locks full-horizon closure for p52-necromancer-curses (F2000/F2000)', () => {
    const horizons = loadK3Horizons113c()
    expect(horizons['p52-necromancer-curses']).toEqual({
      bootFrame: 2,
      strict: 2000,
      pos: 2000,
    })
  })
})

const DIFF_VERIFIED_K3_MERC_AURA_VAS_113C = [
  // Hireling AI, movement, breadcrumb & LoS target scan (17)
  '0x6FC3C4E0',
  '0x6FC3C8A0',
  '0x6FC3D3C0',
  '0x6FC3DD40',
  '0x6FC94CE0',
  '0x6FC970A0',
  '0x6FC99B90',
  '0x6FCB6570',
  '0x6FCD08A0',
  '0x6FCD0A20',
  '0x6FCD1400',
  '0x6FCD15E0',
  '0x6FCD17B0',
  '0x6FCD1AB0',
  '0x6FCD1BC0',
  '0x6FD12380',
  '0x6FD12870',
  // Mercenary & player shared kill XP (4)
  '0x6FCBC000',
  '0x6FCBC1F0',
  '0x6FCFDCB0',
  '0x6FCFE6D0',
  // Paladin party aura & Rogue Inner Sight radial aura (15)
  '0x6FC210D0',
  '0x6FC21420',
  '0x6FC6C220',
  '0x6FC6C2A0',
  '0x6FC97820',
  '0x6FCBA1A0',
  '0x6FCBA8D0',
  '0x6FCBE610',
  '0x6FCBF7A0',
  '0x6FCC00B0',
  '0x6FCC0370',
  '0x6FCC1D10',
  '0x6FCC1E80',
  '0x6FD00570',
  '0x6FD00A60',
  // Rogue skill cast, Cold Arrow projectile & Cold/Chill/Shatter settlement (32)
  '0x6FC21250',
  '0x6FC43670',
  '0x6FC58FB0',
  '0x6FC59260',
  '0x6FC59B40',
  '0x6FC59CE0',
  '0x6FC5A4E0',
  '0x6FC5AA20',
  '0x6FC5AD30',
  '0x6FC5AE10',
  '0x6FC5AFF0',
  '0x6FC5E590',
  '0x6FC5F320',
  '0x6FC5F540',
  '0x6FC8F620',
  '0x6FC8F660',
  '0x6FC8F8A0',
  '0x6FC95510',
  '0x6FC95C60',
  '0x6FC95CE0',
  '0x6FCBEC80',
  '0x6FCBF3B0',
  '0x6FCBFA30',
  '0x6FCBFC00',
  '0x6FCBFD00',
  '0x6FCC0830',
  '0x6FCC19A0',
  '0x6FCC2060',
  '0x6FCC28F0',
  '0x6FCFAE20',
  '0x6FCFB4C0',
  '0x6FCFC780',
] as const

const DIFF_VERIFIED_K3_SUMMON_CURSE_VAS_113C = [
  '0x6FC2E860',
  '0x6FC31980',
  '0x6FC331E0',
  '0x6FC34210',
  '0x6FC344D0',
  '0x6FC35240',
  '0x6FC354F0',
  '0x6FC3CAE0',
  '0x6FC3E140',
  '0x6FC3E640',
  '0x6FC3E900',
  '0x6FC6D710',
  '0x6FC6DF80',
  '0x6FC6E180',
  '0x6FC6E230',
  '0x6FC6E2A0',
  '0x6FC6E390',
  '0x6FC6E960',
  '0x6FC6EB50',
  '0x6FC6ECD0',
  '0x6FC6EF20',
  '0x6FC6F450',
  '0x6FC6F970',
  '0x6FC70070',
  '0x6FC70250',
  '0x6FC705D0',
  '0x6FC71750',
  '0x6FC718B0',
  '0x6FCAB290',
  '0x6FCB6540',
  '0x6FCB66E0',
  '0x6FCB6EA0',
  '0x6FCB7A20',
  '0x6FCB7C20',
  '0x6FCB7F50',
  '0x6FCBEE50',
  '0x6FCC3090',
  '0x6FCC3610',
  '0x6FCCD2A0',
  '0x6FCCFCE0',
  '0x6FCD08A0',
  '0x6FCD0E90',
  '0x6FCD1660',
  '0x6FCF28D0',
  '0x6FCF60D0',
  '0x6FD0FE40',
  '0x6FD12870',
  '0x6FD129B0',
  '0x6FD13000',
] as const

const horizonsByScenario = loadK3Horizons113c()
const cachedReplayByScenario = new Map<K3ReplayScenarioName113c, ReturnType<typeof runK3Replay113c>>()
const cachedCovByScenario = new Map<K3ReplayScenarioName113c, ReturnType<typeof loadK3Coverage113c>>()

for (const spec of K3_COVERAGE_BASELINES_113C) {
  const name = spec.name
  const H = horizonsByScenario[name]
  if (H === undefined) throw new Error(`k3/replay/horizons.json has no entry for ${name}`)

  describe(`K3 kernel replay ${name} (boot F${H.bootFrame}, strict F${H.strict}, pos F${H.pos})`, () => {
    const r = runK3Replay113c(name, H.bootFrame)
    const golden = loadGolden113c(name)
    const scenario = loadScenario113c(name)
    const cov = loadK3Coverage113c(name)
    cachedReplayByScenario.set(name, r)
    cachedCovByScenario.set(name, cov)

    it('hydrated F2 boot snapshot equals the golden boot frame on every field (strict)', () => {
      expect(r.bootCheck).toBeNull()
    })

    it('boot comparison detects a single corrupted player seed bit (negative control)', () => {
      const saveBytes =
        scenario.save !== undefined
          ? new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save)))
          : undefined
      const world = bootFromSnapshot113c(loadSnapshotFile113c(k3SnapshotPath113c(name, H.bootFrame)), saveBytes)
      const pPlayer = world.m.get(world.pGame, D2GameStrc.pUnitHash, 1)
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
      expect(r.lastGoldenFrame).toBe(spec.frames)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(H.strict)
      expect(r.posHorizon).toBeGreaterThanOrEqual(H.pos)
      expect(r.posHorizon).toBeGreaterThanOrEqual(r.strictHorizon)
    })

    it('stops at an explicit first divergence (or matches through the end of the golden)', () => {
      if (r.strictHorizon === r.lastGoldenFrame) {
        expect(r.firstStrictDivergence).toBeNull()
        return
      }
      const d = r.firstStrictDivergence
      expect(d).not.toBeNull()
      expect(d!.frame).toBe(r.strictHorizon + 1)
      if (d!.key === 'step') {
        expect(r.unportedHit).not.toBeNull()
        expect(d!.field).toBe(`<unported ${r.unportedHit!.key}>`)
      }
      if (r.unportedHit !== null) expect(r.unportedHit.frame).toBe(r.posHorizon + 1)
    })

    it('committed divergence artifact matches golden/snapshot digests and never over-claims horizons', () => {
      const art = JSON.parse(
        readFileSync(join(K3_DIVERGENCE_DIR_113C, `${name}.divergence.json`), 'utf8'),
      ) as DivergenceArtifact113c
      expect(art.scenario).toBe(name)
      expect(art.strictHorizon).toBeLessThanOrEqual(r.strictHorizon)
      expect(art.posHorizon).toBeLessThanOrEqual(r.posHorizon)
      expect(art.goldenSha256).toBe(sha256(goldenPath113c(name)))
      expect(art.snapshotSha256).toBe(sha256(k3SnapshotPath113c(name, H.bootFrame)))
      expect(H.strict).toBeLessThanOrEqual(r.strictHorizon)
    })

    it('has 0 D2Common unported hits, 0 impure kernFile hits, and verified D2Game dynamic gap bounds', () => {
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(spec.frames)
      expect(cov.to).toBe(scenario.frames)
      expect(cov.entries).toBe(loadManifest113c().size)
      expect(cov.hit).toBe(spec.totalHits)
      expect(cov.hits.length).toBe(spec.totalHits)

      const byKey = new Map(cov.hits.map((h) => [manifestKey113c(h.module, h.va), h.firstFrame]))
      expect(byKey.get('D2Game:0x6FC4E050')).toBe(1)
      const firstInput = Math.min(...scenario.inputs.map((i) => i.frame))
      expect(byKey.get('D2Game:0x6FCEC550')).toBe(firstInput)

      expect(spec.initialD2GameGapVas.length).toBe(spec.initialD2GameGapCount)
      const s = computeK3Gaps113c(name, { tsExecutedVas: r.tsExecutedVas })
      const manifest = loadManifest113c()
      const hitKeySet = new Set(cov.hits.map((h) => manifestKey113c(h.module, h.va)))

      expect(s.executed.D2Common).toEqual({
        total: spec.d2CommonExecuted,
        done: spec.d2CommonExecuted,
        gap: 0,
        gapBytes: 0,
      })
      expect(s.gaps.filter((g) => g.module === 'D2Common')).toEqual([])
      expect(s.impure).toEqual([])

      expect(s.executed.D2Game?.total).toBe(spec.d2GameExecuted)
      expect(s.executed.D2Game!.gap).toBeLessThanOrEqual(spec.initialD2GameGapCount)
      expect(s.executed.D2Game!.gapBytes).toBeLessThanOrEqual(spec.initialD2GameGapBytes)

      for (const vaHex of spec.initialD2GameGapVas) {
        expect(hitKeySet.has(`D2Game:${vaHex}`), `D2Game:${vaHex} must be in recorded coverage`).toBe(true)
      }

      const expectedRemainingD2GameVas = spec.initialD2GameGapVas.filter((vaHex) => {
        const fn = manifest.get(`D2Game:${vaHex}`)
        expect(fn, `D2Game:${vaHex}`).toBeDefined()
        return !DONE_STATUSES_113C.has(fn!.status)
      })
      const actualD2GameGapVas = s.gaps.filter((g) => g.module === 'D2Game').map((g) => formatVa113c(g.va))

      expect(s.executed.D2Game!.gap).toBe(expectedRemainingD2GameVas.length)
      expect(s.executed.D2Game!.done).toBe(spec.d2GameExecuted - expectedRemainingD2GameVas.length)
      expect(actualD2GameGapVas).toEqual(expectedRemainingD2GameVas)

      // Monotonic runtimeExecGap ratchet (`dllExecuted - tsExecuted` on D2Game and D2Common via computeK3Gaps113c)
      expect(r.tsExecutedVas.length).toBeGreaterThan(0)
      expect(r.tsExecutedVas).toContain('D2Game:0x6FC4E050')
      expect(s.dllExecutedVas.length).toBe(spec.totalHits)
      expect(s.tsExecutedVas).toEqual(r.tsExecutedVas)
      expect(s.runtimeExecGap).toEqual([])

      const rg = s.runtimeExecuted.D2Game!
      const rc = s.runtimeExecuted.D2Common!
      expect(rc).toEqual({
        dllExecuted: spec.d2CommonExecuted,
        tsExecuted: spec.d2CommonExecuted,
        tsTotalExecuted: s.tsExecutedVas.filter((k) => k.startsWith('D2Common:')).length,
        runtimeGap: 0,
        runtimeGapBytes: 0,
      })
      expect(rg).toEqual({
        dllExecuted: spec.d2GameExecuted,
        tsExecuted: spec.d2GameExecuted,
        tsTotalExecuted: s.tsExecutedVas.filter((k) => k.startsWith('D2Game:')).length,
        runtimeGap: 0,
        runtimeGapBytes: 0,
      })
      expect(
        rg.runtimeGap,
        `${name} D2Game runtimeExecGap (${rg.runtimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2GameRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2GameRuntimeExecGap)
      expect(
        rc.runtimeGap,
        `${name} D2Common runtimeExecGap (${rc.runtimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2CommonRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2CommonRuntimeExecGap)
    })

    if (name === 'p52-paladin-merc-aura') {
      it('executes all 68 diff-verified D2Game hireling, party aura, skill, missile & cold/chill VAs in dll∩ts across F2..F1700', () => {
        const dllSet = new Set(cov.hits.map((h) => manifestKey113c(h.module, h.va)))
        const tsSet = new Set(r.tsExecutedVas)
        for (const va of DIFF_VERIFIED_K3_MERC_AURA_VAS_113C) {
          const key = `D2Game:${va}`
          expect(dllSet.has(key), `p52-paladin-merc-aura dllExecutedVas missing ${key}`).toBe(true)
          expect(tsSet.has(key), `p52-paladin-merc-aura tsExecutedVas missing ${key}`).toBe(true)
        }
      })
    }

    if (H.strict >= r.lastGoldenFrame) {
      it(`gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame}`, () => {
        expect(r.firstStrictDivergence).toBeNull()
      })
    } else {
      it.todo(
        `gate: zero divergence F${H.bootFrame + 1}..F${r.lastGoldenFrame} (enabled once k3/replay/horizons.json strict reaches F${r.lastGoldenFrame})`,
      )
    }
  })
}

describe('K3 summon/pet/curse diff-verified dll∩ts execution gate', () => {
  it('executes all 49 promoted summon/pet/curse/MonEquip VAs in dll∩ts across full-horizon summon & curse scenarios', () => {
    const manifest = loadManifest113c()
    const summonCurseScenarios: readonly K3ReplayScenarioName113c[] = [
      'p52-amazon-valkyrie',
      'p52-necromancer-poison-golem',
      'p52-necromancer-curses',
    ]
    const dllUnion = new Set<string>()
    const tsUnion = new Set<string>()
    for (const scen of summonCurseScenarios) {
      const r = cachedReplayByScenario.get(scen) ?? runK3Replay113c(scen, horizonsByScenario[scen]!.bootFrame)
      const cov = cachedCovByScenario.get(scen) ?? loadK3Coverage113c(scen)
      for (const h of cov.hits) {
        dllUnion.add(manifestKey113c(h.module, h.va))
      }
      for (const k of r.tsExecutedVas) {
        tsUnion.add(k)
      }
    }
    for (const va of DIFF_VERIFIED_K3_SUMMON_CURSE_VAS_113C) {
      const key = `D2Game:${va}`
      const fn = manifest.get(key)
      expect(fn, `${key} missing from manifest-113c.json`).toBeDefined()
      expect(fn!.status, `${key} (${fn!.name}) expected diff-verified`).toBe('diff-verified')
      expect(dllUnion.has(key), `K3 summon/curse DLL coverage union missing ${key}`).toBe(true)
      expect(tsUnion.has(key), `K3 summon/curse TS trace union missing ${key}`).toBe(true)
    }
  })
})

const DIFF_VERIFIED_K3_RUNTIME_CLOSURE_VAS_113C = [
  '0x6FC21540',
  '0x6FC21B60',
  '0x6FC21DD0',
  '0x6FC41B30',
  '0x6FC49240',
  '0x6FC49720',
  '0x6FC57C90',
  '0x6FC59670',
  '0x6FC5A280',
  '0x6FC5B990',
  '0x6FC5C850',
  '0x6FC5D020',
  '0x6FC5EA60',
  '0x6FC60BD0',
  '0x6FC60CA0',
  '0x6FC61850',
  '0x6FC61980',
  '0x6FC63720',
  '0x6FC637D0',
  '0x6FC648E0',
  '0x6FC686D0',
  '0x6FC6C840',
  '0x6FCAA330',
  '0x6FCAB0F0',
  '0x6FCAB220',
  '0x6FCABB10',
  '0x6FCABC20',
  '0x6FCAD500',
  '0x6FCAE110',
  '0x6FCAE2A0',
  '0x6FCB6FA0',
  '0x6FCB8450',
  '0x6FCBB340',
  '0x6FCBBB10',
  '0x6FCBE370',
  '0x6FCBE6B0',
  '0x6FCBEB80',
  '0x6FCBFF70',
  '0x6FCC0630',
  '0x6FCC10B0',
  '0x6FCC1210',
  '0x6FCC1790',
  '0x6FCCCBA0',
  '0x6FCEBED0',
  '0x6FCEE870',
  '0x6FCFA350',
  '0x6FCFA480',
  '0x6FD134C0',
] as const

describe('K3 9-scenario union D2Game & D2Common runtimeExecGap ratchets & diff-verified dll∩ts gate', () => {
  it('enforces 9-scenario union D2Game (652/652) & D2Common (780/780) runtimeExecGap == 0 and executes all 48 promoted K3 VAs in dll∩ts', () => {
    const manifest = loadManifest113c()
    const dllD2GameUnion = new Set<string>()
    const tsD2GameUnion = new Set<string>()
    const dllD2CommonUnion = new Set<string>()
    const tsD2CommonUnion = new Set<string>()
    const k3UnionBoth = new Set<string>()

    for (const spec of K3_COVERAGE_BASELINES_113C) {
      const scen = spec.name
      const r = cachedReplayByScenario.get(scen) ?? runK3Replay113c(scen, horizonsByScenario[scen]!.bootFrame)
      const cov = cachedCovByScenario.get(scen) ?? loadK3Coverage113c(scen)
      expect(r.strictHorizon).toBe(r.lastGoldenFrame)
      expect(r.firstStrictDivergence).toBeNull()

      const dllSet = new Set<string>()
      for (const h of cov.hits) {
        const k = manifestKey113c(h.module, h.va)
        dllSet.add(k)
        if (h.module === 'D2Game') dllD2GameUnion.add(k)
        if (h.module === 'D2Common') dllD2CommonUnion.add(k)
      }
      for (const k of r.tsExecutedVas) {
        if (k.startsWith('D2Game:')) tsD2GameUnion.add(k)
        if (k.startsWith('D2Common:')) tsD2CommonUnion.add(k)
        if (dllSet.has(k)) k3UnionBoth.add(k)
      }
    }

    expect(dllD2GameUnion.size).toBe(652)
    let unionD2GameGap = 0
    for (const k of dllD2GameUnion) {
      if (!tsD2GameUnion.has(k)) unionD2GameGap++
    }
    expect(
      unionD2GameGap,
      `9-scenario K3 D2Game union runtimeExecGap (${unionD2GameGap}) exceeded monotonic ceiling (${MAX_K3_UNION_D2GAME_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K3_UNION_D2GAME_RUNTIME_EXEC_GAP)

    expect(dllD2CommonUnion.size).toBe(780)
    let unionD2CommonGap = 0
    for (const k of dllD2CommonUnion) {
      if (!tsD2CommonUnion.has(k)) unionD2CommonGap++
    }
    expect(
      unionD2CommonGap,
      `9-scenario K3 D2Common union runtimeExecGap (${unionD2CommonGap}) exceeded monotonic ceiling (${MAX_K3_UNION_D2COMMON_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K3_UNION_D2COMMON_RUNTIME_EXEC_GAP)

    for (const va of DIFF_VERIFIED_K3_RUNTIME_CLOSURE_VAS_113C) {
      const key = `D2Game:${va}`
      const fn = manifest.get(key)
      expect(fn, `${key} missing from manifest-113c.json`).toBeDefined()
      expect(fn!.status, `${key} (${fn!.name}) expected diff-verified`).toBe('diff-verified')
      expect(dllD2GameUnion.has(key), `K3 9-scenario DLL coverage union missing ${key}`).toBe(true)
      expect(tsD2GameUnion.has(key), `K3 9-scenario TS trace union missing ${key}`).toBe(true)
      expect(k3UnionBoth.has(key), `K3 9-scenario dll∩ts union missing ${key}`).toBe(true)
    }
  })
})

