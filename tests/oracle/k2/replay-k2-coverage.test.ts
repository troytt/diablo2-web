/**
 * K1/K2 replay coverage & monotonic runtime VA execution ratchet
 * (`tests/fixtures/oracle/k1/replay/<scenario>.coverage.ndjson.gz` vs live `va-trace-113c` in `runReplay113c`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computeGaps113c,
  loadCoverage113c,
  renderCombinedGapMd113c,
  renderScenarioGapMd113c,
  type ScenarioGap113c,
} from '../../../tools/oracle/kern-replay/gap-report.ts'
import {
  REPO_ROOT_113C,
  loadManifest113c,
  loadScenario113c,
  manifestKey113c,
  runReplay113c,
  type ReplayResult113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'

type K1K2ScenarioName113c =
  | 'a1-town-walk'
  | 'a1c-bloodmoor-fallen'
  | 'a1-bloodmoor-melee'
  | 'p52-dot-ticks'
  | 'p52-item-defense'

interface ReplayCoverageRatchetSpec113c {
  readonly name: K1K2ScenarioName113c
  readonly frames: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  /** Monotonic ceiling on `D2Game` `runtimeExecGap` (`dllExecuted - tsExecuted`): only decreases toward 0. */
  readonly maxD2GameRuntimeExecGap: number
  /** Monotonic ceiling on `D2Common` `runtimeExecGap` (`dllExecuted - tsExecuted`): only decreases toward 0. */
  readonly maxD2CommonRuntimeExecGap: number
  readonly initialD2GameGapCount?: number
  readonly initialD2GameGapVas?: readonly string[]
}

/** Monotonic ceiling on the 5-scenario union of `D2Game` `runtimeExecGap` (out of 560 DLL-executed `D2Game` VAs). */
const MAX_K1_K2_UNION_D2GAME_RUNTIME_EXEC_GAP = 0

/** Monotonic ceiling on the 5-scenario union of `D2Common` `runtimeExecGap` (out of 679 DLL-executed `D2Common` VAs). */
const MAX_K1_K2_UNION_D2COMMON_RUNTIME_EXEC_GAP = 0

const K1_K2_COVERAGE_RATCHET_SPECS_113C: readonly ReplayCoverageRatchetSpec113c[] = [
  {
    name: 'a1-town-walk',
    frames: 750,
    totalHits: 599,
    d2CommonExecuted: 352,
    d2GameExecuted: 247,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
  },
  {
    name: 'a1c-bloodmoor-fallen',
    frames: 2000,
    totalHits: 1055,
    d2CommonExecuted: 579,
    d2GameExecuted: 476,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
  },
  {
    name: 'a1-bloodmoor-melee',
    frames: 1800,
    totalHits: 1045,
    d2CommonExecuted: 572,
    d2GameExecuted: 473,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 10,
    initialD2GameGapVas: [
      '0x6FC95210',
      '0x6FCB0F30',
      '0x6FC96740',
      '0x6FC9A260',
      '0x6FCABA50',
      '0x6FC21480',
      '0x6FC2F2F0',
      '0x6FC2F700',
      '0x6FC21CD0',
      '0x6FCAB010',
    ],
  },
  {
    name: 'p52-dot-ticks',
    frames: 1200,
    totalHits: 1119,
    d2CommonExecuted: 620,
    d2GameExecuted: 499,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 39,
    initialD2GameGapVas: [
      '0x6FC95210',
      '0x6FCB0F30',
      '0x6FC96740',
      '0x6FC9A260',
      '0x6FCABA50',
      '0x6FC21480',
      '0x6FC2F2F0',
      '0x6FC2F700',
      '0x6FCAB710',
      '0x6FCC2100',
      '0x6FC98840',
      '0x6FC21250',
      '0x6FC41880',
      '0x6FC63AA0',
      '0x6FC8F620',
      '0x6FC8F660',
      '0x6FC8F8A0',
      '0x6FC8F930',
      '0x6FCB1340',
      '0x6FCC2800',
      '0x6FC5AA20',
      '0x6FC5AD30',
      '0x6FC5E3F0',
      '0x6FC5F320',
      '0x6FC5F540',
      '0x6FD00A20',
      '0x6FC58FB0',
      '0x6FC59B40',
      '0x6FC5A4E0',
      '0x6FC5AE10',
      '0x6FC5AFF0',
      '0x6FC5E590',
      '0x6FC5EDE0',
      '0x6FC8F880',
      '0x6FD13360',
      '0x6FC57110',
      '0x6FC58E60',
      '0x6FCBF7A0',
      '0x6FC94870',
    ],
  },
  {
    name: 'p52-item-defense',
    frames: 1600,
    totalHits: 1039,
    d2CommonExecuted: 571,
    d2GameExecuted: 468,
    maxD2GameRuntimeExecGap: 0,
    maxD2CommonRuntimeExecGap: 0,
    initialD2GameGapCount: 41,
    initialD2GameGapVas: [
      '0x6FC570E0',
      '0x6FC57110',
      '0x6FC57190',
      '0x6FCBE290',
      '0x6FCF1AA0',
      '0x6FCF43E0',
      '0x6FCF4630',
      '0x6FCF4670',
      '0x6FCF46B0',
      '0x6FCF47C0',
      '0x6FCB0F30',
      '0x6FCCCDA0',
      '0x6FCCD910',
      '0x6FCCDCE0',
      '0x6FCCF710',
      '0x6FD13360',
      '0x6FC96740',
      '0x6FC94C30',
      '0x6FC21CD0',
      '0x6FCAB010',
      '0x6FC62EC0',
      '0x6FC630D0',
      '0x6FC9A4C0',
      '0x6FCAD210',
      '0x6FCBE610',
      '0x6FCBEFE0',
      '0x6FCC0370',
      '0x6FCC0C70',
      '0x6FD114F0',
      '0x6FD117E0',
      '0x6FCAB710',
      '0x6FCC1D10',
      '0x6FCC2100',
      '0x6FC210D0',
      '0x6FC6E230',
      '0x6FCBA1A0',
      '0x6FCBA8D0',
      '0x6FCC00B0',
      '0x6FCC1E80',
      '0x6FD00570',
      '0x6FC97820',
    ],
  },
]

const DONE_STATUSES_113C = new Set(['ported', 'diff-verified'])

function formatVa113c(va: number): string {
  return `0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

const cachedRuns = new Map<K1K2ScenarioName113c, { replay: ReplayResult113c; gap: ScenarioGap113c }>()
function getCachedReplayAndGap(name: K1K2ScenarioName113c): { replay: ReplayResult113c; gap: ScenarioGap113c } {
  let entry = cachedRuns.get(name)
  if (entry === undefined) {
    const replay = runReplay113c(name)
    const gap = computeGaps113c(name, { tsExecutedVas: replay.tsExecutedVas })
    entry = { replay, gap }
    cachedRuns.set(name, entry)
  }
  return entry
}

for (const spec of K1_K2_COVERAGE_RATCHET_SPECS_113C) {
  describe(`K1/K2 replay coverage & runtimeExecGap ratchet ${spec.name}`, () => {
    const cov = loadCoverage113c(spec.name)
    const scenario = loadScenario113c(spec.name)

    it('covers every frame of the scenario with non-empty executed function coverage', () => {
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(spec.frames)
      expect(cov.to).toBe(scenario.frames)
      expect(cov.entries).toBe(loadManifest113c().size)
      expect(cov.hit).toBeGreaterThan(0)
      expect(cov.hit).toBe(spec.totalHits)
      expect(cov.hits.length).toBe(spec.totalHits)
    })

    it('every hit is a unique manifest function first seen inside the recorded frame range', () => {
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

    it('enforces full-frame zero divergence and monotonic runtimeExecGap ceiling with 0 impure hits', () => {
      if (spec.initialD2GameGapVas !== undefined && spec.initialD2GameGapCount !== undefined) {
        expect(spec.initialD2GameGapVas.length).toBe(spec.initialD2GameGapCount)
      }

      const { replay, gap: s } = getCachedReplayAndGap(spec.name)
      expect(replay.bootCheck).toBeNull()
      expect(replay.strictHorizon).toBe(replay.lastGoldenFrame)
      expect(replay.firstStrictDivergence).toBeNull()
      expect(replay.tsExecutedVas.length).toBeGreaterThan(0)
      expect(replay.tsExecutedVas).toContain('D2Game:0x6FC4E050')

      const manifest = loadManifest113c()
      const hitKeySet = new Set(cov.hits.map((h) => manifestKey113c(h.module, h.va)))
      const tsSet = new Set(replay.tsExecutedVas)

      expect(s.executed.D2Common).toEqual({
        total: spec.d2CommonExecuted,
        done: spec.d2CommonExecuted,
        gap: 0,
        gapBytes: 0,
      })
      expect(s.manifestGap.filter((g) => g.module === 'D2Common')).toEqual([])
      expect(s.impure).toEqual([])

      expect(s.executed.D2Game?.total).toBe(spec.d2GameExecuted)
      if (spec.initialD2GameGapVas !== undefined) {
        for (const vaHex of spec.initialD2GameGapVas) {
          expect(hitKeySet.has(`D2Game:${vaHex}`), `D2Game:${vaHex} must be in recorded coverage`).toBe(true)
        }
      }

      // Exact manifestGap invariance: every DLL-executed D2Game VA whose manifest status is unported
      const expectedManifestGapVas = [...cov.hits]
        .filter((h) => h.module === 'D2Game' && !DONE_STATUSES_113C.has(manifest.get(manifestKey113c(h.module, h.va))!.status))
        .sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
        .map((h) => formatVa113c(h.va))
      const actualManifestGapVas = s.manifestGap.filter((g) => g.module === 'D2Game').map((g) => formatVa113c(g.va))

      expect(s.executed.D2Game!.gap).toBe(expectedManifestGapVas.length)
      expect(s.executed.D2Game!.done).toBe(spec.d2GameExecuted - expectedManifestGapVas.length)
      expect(actualManifestGapVas).toEqual(expectedManifestGapVas)

      // Exact runtimeExecGap invariance: every DLL-executed VA not actually hit at runtime by TS
      const expectedRuntimeGapKeys = [...cov.hits]
        .sort((a, b) => a.firstFrame - b.firstFrame || a.va - b.va)
        .map((h) => manifestKey113c(h.module, h.va))
        .filter((k) => !tsSet.has(k))
      const actualRuntimeGapKeys = s.runtimeExecGap.map((g) => manifestKey113c(g.module, g.va))
      expect(actualRuntimeGapKeys).toEqual(expectedRuntimeGapKeys)

      const rg = s.runtimeExecuted.D2Game!
      expect(rg.dllExecuted).toBe(spec.d2GameExecuted)
      expect(rg.tsExecuted).toBeGreaterThan(0)
      expect(rg.tsExecuted + rg.runtimeGap).toBe(spec.d2GameExecuted)
      expect(
        rg.runtimeGap,
        `${spec.name} D2Game runtimeExecGap (${rg.runtimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2GameRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2GameRuntimeExecGap)

      const rc = s.runtimeExecuted.D2Common!
      expect(rc.dllExecuted).toBe(spec.d2CommonExecuted)
      expect(rc.tsExecuted).toBeGreaterThan(0)
      expect(rc.tsExecuted + rc.runtimeGap).toBe(spec.d2CommonExecuted)
      expect(
        rc.runtimeGap,
        `${spec.name} D2Common runtimeExecGap (${rc.runtimeGap}) exceeded monotonic ratchet ceiling (${spec.maxD2CommonRuntimeExecGap})`,
      ).toBeLessThanOrEqual(spec.maxD2CommonRuntimeExecGap)

      // Markdown renderers report both tsExecuted / dllExecuted and manifestUnported / runtimeExecGap
      const scenarioMd = renderScenarioGapMd113c(s)
      expect(scenarioMd).toContain(`| D2Game | ${spec.d2GameExecuted} | ${rg.tsExecuted} / ${rg.dllExecuted} |`)
      const combinedMd = renderCombinedGapMd113c([s])
      expect(combinedMd).toContain(`| \`${spec.name}\` | \`${rg.tsExecuted} / ${rg.dllExecuted}\``)
    })
  })
}

const DIFF_VERIFIED_K2_ITEMDROP_VAS_113C = [
  '0x6FC2E5D0',
  '0x6FC2E930',
  '0x6FC2EA10',
  '0x6FC2EA70',
  '0x6FC2EBB0',
  '0x6FC2EC90',
  '0x6FC2EE90',
  '0x6FC2F260',
  '0x6FC2FC40',
  '0x6FC30550',
  '0x6FC307B0',
  '0x6FC30A20',
  '0x6FC31070',
  '0x6FC31490',
  '0x6FC31880',
  '0x6FC32380',
  '0x6FC32D60',
  '0x6FC32EE0',
  '0x6FC33DE0',
  '0x6FC95680',
  '0x6FC95900',
] as const

const DIFF_VERIFIED_K2_REPLAY_COMMON_VAS_113C = [
  '0x6FC21220',
  '0x6FC21320',
  '0x6FC21390',
  '0x6FC213B0',
  '0x6FC215D0',
  '0x6FC218A0',
  '0x6FC219F0',
  '0x6FC21C80',
  '0x6FC400E0',
  '0x6FC40760',
  '0x6FC40E00',
  '0x6FC41420',
  '0x6FC417D0',
  '0x6FC42A80',
  '0x6FC43220',
  '0x6FC66B20',
  '0x6FC66C30',
  '0x6FC66CD0',
  '0x6FC66D40',
  '0x6FC67450',
  '0x6FC67700',
  '0x6FC67A20',
  '0x6FC95070',
  '0x6FC95350',
  '0x6FC96740',
  '0x6FC970E0',
  '0x6FCACA20',
  '0x6FCBD0F0',
  '0x6FCBD160',
  '0x6FCBD8E0',
  '0x6FCBD950',
  '0x6FCBD980',
  '0x6FCBDC10',
  '0x6FCCF610',
  '0x6FCCF730',
  '0x6FCCF840',
  '0x6FCCF920',
  '0x6FCCFAB0',
  '0x6FCD0320',
  '0x6FCD1820',
  '0x6FCD1C90',
  '0x6FCEA530',
  '0x6FCEA5B0',
  '0x6FCEA5F0',
  '0x6FCFA660',
  '0x6FCFA9E0',
  '0x6FCFAC10',
  '0x6FCFAD00',
  '0x6FCFB030',
  '0x6FCFB3C0',
  '0x6FCFB6B0',
  '0x6FCFB790',
  '0x6FCFBA40',
  '0x6FCFBD00',
  '0x6FCFBED0',
  '0x6FCFC0B0',
  '0x6FCFCD80',
  '0x6FCFCF20',
  '0x6FCFD450',
  '0x6FCFE0C0',
  '0x6FCFEBA0',
  '0x6FCFED30',
  '0x6FCFF080',
  '0x6FCFF4A0',
  '0x6FD001A0',
  '0x6FD0E480',
  '0x6FD0EF10',
  '0x6FD0F510',
  '0x6FD0F570',
  '0x6FD13220',
  '0x6FD135C0',
  '0x6FD13D20',
] as const

const DIFF_VERIFIED_K2_REPLAY_SCENARIO_VAS_113C = [
  '0x6FC3EB20',
  '0x6FC41260',
  '0x6FC57190',
  '0x6FC94870',
  '0x6FC971D0',
  '0x6FC9A260',
  '0x6FCBF850',
  '0x6FCCCDA0',
  '0x6FCCD910',
  '0x6FCCDCE0',
  '0x6FCCF710',
  '0x6FCEB950',
  '0x6FCFA540',
  '0x6FCFA890',
  '0x6FCFA8C0',
  '0x6FCFAD70',
  '0x6FCFB1F0',
  '0x6FCFB5E0',
  '0x6FCFB910',
  '0x6FCFC030',
  '0x6FCFC530',
  '0x6FCFCE70',
  // Batch 4 newly executed item/equipment/stat-change & S2C unit-sync VAs:
  '0x6FC21CD0',
  '0x6FC2F2F0',
  '0x6FC2F700',
  '0x6FC32EE0',
  '0x6FC570E0',
  '0x6FC57110',
  '0x6FC57540',
  '0x6FC62EC0',
  '0x6FC630D0',
  '0x6FC6AD10',
  '0x6FC6E230',
  '0x6FC97060',
  '0x6FC9A4C0',
  '0x6FC9A5E0',
  '0x6FC9B0A0',
  '0x6FCAB010',
  '0x6FCABA50',
  '0x6FCBD5B0',
  '0x6FCBDCD0',
  '0x6FCBDE10',
  '0x6FCBE290',
  '0x6FCBEFE0',
  '0x6FCF1830',
  '0x6FCF1890',
  '0x6FCF1ED0',
  '0x6FCF4630',
  '0x6FCF46B0',
  '0x6FCF47C0',
  '0x6FCF51A0',
  '0x6FCF9470',
  '0x6FCFF780',
  '0x6FD114F0',
  '0x6FD117E0',
  '0x6FD13A40',
  // Batch 5B newly executed C2S, Player Mode/Movement, SUNIT, SUNITDMG & SKILLS VAs:
  '0x6FC21480',
  '0x6FC21D90',
  '0x6FC21DB0',
  '0x6FC57260',
  '0x6FC58E60',
  '0x6FC63AA0',
  '0x6FC69A50',
  '0x6FC6B400',
  '0x6FC94D50',
  '0x6FC95210',
  '0x6FC977F0',
  '0x6FC978A0',
  '0x6FC97B20',
  '0x6FC97E00',
  '0x6FC981C0',
  '0x6FC982F0',
  '0x6FC98710',
  '0x6FC98840',
  '0x6FC988B0',
  '0x6FC98A90',
  '0x6FC98DD0',
  '0x6FC99100',
  '0x6FC99170',
  '0x6FC99850',
  '0x6FCAB710',
  '0x6FCAC090',
  '0x6FCAC100',
  '0x6FCAC890',
  '0x6FCAD3D0',
  '0x6FCADB00',
  '0x6FCADC30',
  '0x6FCB0F30',
  '0x6FCB1340',
  '0x6FCB1B70',
  '0x6FCB1E30',
  '0x6FCB22A0',
  '0x6FCB8250',
  '0x6FCB8A70',
  '0x6FCBB3B0',
  '0x6FCBD780',
  '0x6FCBDEC0',
  '0x6FCC1630',
  '0x6FCC2100',
  '0x6FCC2800',
  '0x6FCC2C40',
  '0x6FCCF8D0',
  '0x6FCEB1F0',
  '0x6FCEBBB0',
  '0x6FCEBF50',
  '0x6FCECFE0',
  '0x6FCED190',
  '0x6FCED630',
  '0x6FCEDF30',
  '0x6FCEE040',
  '0x6FCEE120',
  '0x6FCEE150',
  '0x6FCEE310',
  '0x6FCEE520',
  '0x6FCEE620',
  '0x6FCEE9D0',
  '0x6FCEF480',
  '0x6FCF4550',
  '0x6FCFA6D0',
  '0x6FCFA750',
  '0x6FCFA7B0',
  '0x6FCFA930',
  '0x6FCFA970',
  '0x6FCFAA40',
  '0x6FCFAA90',
  '0x6FCFAB90',
  '0x6FCFB570',
  '0x6FCFC940',
  '0x6FCFCAB0',
  '0x6FCFCC20',
  '0x6FCFDAC0',
  '0x6FCFDDE0',
  '0x6FCFE5A0',
  '0x6FCFEA00',
  '0x6FCFEEE0',
  '0x6FCFF620',
  '0x6FCFFA60',
  '0x6FD00660',
  '0x6FD00860',
  '0x6FD01610',
  '0x6FD13360',
] as const

const DIFF_VERIFIED_K1_TOWN_WALK_VAS_113C = [
  '0x6FCAC010',
  '0x6FCEE0D0',
] as const

const DIFF_VERIFIED_K1_REPLAY_AI_MONSTER_VAS_113C = [
  '0x6FC21870',
  '0x6FC40CF0',
  '0x6FC40D90',
  '0x6FD0DDB0',
] as const

const DIFF_VERIFIED_K2_BATCH3_ROOM_SPAWN_VAS_113C = [
  '0x6FC21100',
  '0x6FC21130',
  '0x6FC211D0',
  '0x6FC21280',
  '0x6FC3E960',
  '0x6FC3EA40',
  '0x6FC3EF50',
  '0x6FC3F600',
  '0x6FC3FB40',
  '0x6FC3FB90',
  '0x6FC404E0',
  '0x6FC409B0',
  '0x6FC40B60',
  '0x6FC40C00',
  '0x6FC4CBE0',
  '0x6FC4CF30',
  '0x6FC4E790',
  '0x6FC4E7D0',
  '0x6FC4EA40',
  '0x6FC4ECB0',
  '0x6FC4ED70',
  '0x6FC4EE60',
  '0x6FC4EEA0',
  '0x6FC4EF90',
  '0x6FC51E20',
  '0x6FC52CE0',
  '0x6FC53260',
  '0x6FC54860',
  '0x6FC55E50',
  '0x6FC57220',
  '0x6FC57540',
  '0x6FC579A0',
  '0x6FC683B0',
  '0x6FC6B1D0',
  '0x6FC97790',
  '0x6FC98340',
  '0x6FC99FE0',
  '0x6FC9A940',
  '0x6FC9ADF0',
  '0x6FCAA3E0',
  '0x6FCABFC0',
  '0x6FCAF410',
  '0x6FCB0C60',
  '0x6FCBD5B0',
  '0x6FCBD850',
  '0x6FCCFB90',
  '0x6FCEB690',
  '0x6FCFA750',
  '0x6FCFF620',
  '0x6FCFF6C0',
  '0x6FCFF780',
  '0x6FCFF9A0',
  '0x6FCFFF10',
  '0x6FD000C0',
  '0x6FD00110',
  '0x6FD007A0',
  '0x6FD00C80',
  '0x6FD00F40',
  '0x6FD01110',
  '0x6FD012D0',
  '0x6FD013B0',
  '0x6FD01430',
  '0x6FD01610',
  '0x6FD01D90',
  '0x6FD020A0',
  '0x6FD0FC60',
] as const

const DIFF_VERIFIED_K2_BATCH5C_MONSTER_AI_SYNC_VAS_113C = [
  '0x6FC2FB70',
  '0x6FC30160',
  '0x6FC410D0',
  '0x6FC412F0',
  '0x6FC66F70',
  '0x6FC94C30',
  '0x6FC94C60',
  '0x6FC94E60',
  '0x6FC95210',
  '0x6FC97240',
  '0x6FC977F0',
  '0x6FC97E00',
  '0x6FC988B0',
  '0x6FC9AC50',
  '0x6FCAC890',
  '0x6FCAD3D0',
  '0x6FCB0320',
  '0x6FCBB3B0',
  '0x6FCBCA60',
  '0x6FCBCB30',
  '0x6FCBCCF0',
  '0x6FCBCD90',
  '0x6FCBCDE0',
  '0x6FCBCFE0',
  '0x6FCBF2B0',
  '0x6FCCF5D0',
  '0x6FCCF5F0',
  '0x6FCCF8D0',
  '0x6FCD0BE0',
] as const

const DIFF_VERIFIED_K2_BATCH5A_FRAME_EVENT_JOIN_VAS_113C = [
  '0x6FC21560',
  '0x6FC21850',
  '0x6FC39AD0',
  '0x6FC49BE0',
  '0x6FC4C0F0',
  '0x6FC4C120',
  '0x6FC4CA20',
  '0x6FC4D670',
  '0x6FC55EF0',
  '0x6FC7A9B0',
  '0x6FC7AB60',
  '0x6FC7AD50',
  '0x6FC7B1E0',
  '0x6FC7B380',
  '0x6FC7F3F0',
  '0x6FC842D0',
  '0x6FC84D30',
  '0x6FC84ED0',
  '0x6FC85040',
  '0x6FC86320',
  '0x6FC884B0',
  '0x6FC8A0D0',
  '0x6FC8B200',
  '0x6FCB7D10',
  '0x6FCBC620',
  '0x6FCD23D0',
  '0x6FCD2940',
  '0x6FCDA1E0',
  '0x6FCDA3A0',
  '0x6FCDA550',
  '0x6FCE2E20',
  '0x6FCE3EC0',
  '0x6FCE6450',
  '0x6FCE6E00',
  '0x6FCE73A0',
  '0x6FCE9190',
  '0x6FD03E00',
  '0x6FD071D0',
  '0x6FD07560',
  '0x6FD07880',
  '0x6FD07A10',
  '0x6FD07BE0',
  '0x6FD12220',
] as const

const DIFF_VERIFIED_K2_FINAL_ZERO_VAS_113C = [
  '0x6FC21180',
  '0x6FC21850',
  '0x6FC40EC0',
  '0x6FC40F30',
  '0x6FC41260',
  '0x6FC41290',
  '0x6FC41880',
  '0x6FC4CF30',
  '0x6FC53830',
  '0x6FC572C0',
  '0x6FC57810',
  '0x6FC66F70',
  '0x6FC67CF0',
  '0x6FC94F20',
  '0x6FC95260',
  '0x6FC96FE0',
  '0x6FC971D0',
  '0x6FC97950',
  '0x6FC97A50',
  '0x6FC97BB0',
  '0x6FC97CB0',
  '0x6FCA38B0',
  '0x6FCAD210',
  '0x6FCEE310',
  '0x6FCF40F0',
  '0x6FCFB910',
  '0x6FCFE6D0',
  '0x6FCFF1A0',
  '0x6FCFF7B0',
  '0x6FD00A20',
  '0x6FD0F650',
  '0x6FD11B10',
  '0x6FD12220',
  '0x6FD12540',
] as const

describe('K1/K2 5-scenario union runtimeExecGap ratchet & gap-summary.md freshness', () => {
  it('enforces 5-scenario D2Game & D2Common union runtimeExecGap ratchets, diff-verified VA execution, and up-to-date gap-summary.md', () => {
    const dllD2GameUnion = new Set<string>()
    const tsD2GameUnion = new Set<string>()
    const dllD2CommonUnion = new Set<string>()
    const tsD2CommonUnion = new Set<string>()
    const allSummaries: ScenarioGap113c[] = []

    for (const spec of K1_K2_COVERAGE_RATCHET_SPECS_113C) {
      const { replay, gap } = getCachedReplayAndGap(spec.name)
      allSummaries.push(gap)
      for (const k of gap.dllExecutedVas) {
        if (k.startsWith('D2Game:')) dllD2GameUnion.add(k)
        else if (k.startsWith('D2Common:')) dllD2CommonUnion.add(k)
      }
      for (const k of replay.tsExecutedVas) {
        if (k.startsWith('D2Game:')) tsD2GameUnion.add(k)
        else if (k.startsWith('D2Common:')) tsD2CommonUnion.add(k)
      }
    }

    expect(dllD2GameUnion.size).toBe(560)
    let unionGap = 0
    for (const k of dllD2GameUnion) {
      if (!tsD2GameUnion.has(k)) unionGap++
    }
    expect(
      unionGap,
      `5-scenario D2Game union runtimeExecGap (${unionGap}) exceeded monotonic ceiling (${MAX_K1_K2_UNION_D2GAME_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K1_K2_UNION_D2GAME_RUNTIME_EXEC_GAP)

    expect(dllD2CommonUnion.size).toBe(679)
    let d2CommonUnionGap = 0
    for (const k of dllD2CommonUnion) {
      if (!tsD2CommonUnion.has(k)) d2CommonUnionGap++
    }
    expect(
      d2CommonUnionGap,
      `5-scenario D2Common union runtimeExecGap (${d2CommonUnionGap}) exceeded monotonic ceiling (${MAX_K1_K2_UNION_D2COMMON_RUNTIME_EXEC_GAP})`,
    ).toBeLessThanOrEqual(MAX_K1_K2_UNION_D2COMMON_RUNTIME_EXEC_GAP)

    const committedGapSummary = readFileSync(join(REPO_ROOT_113C, 'docs/oracle/k1-replay/gap-summary.md'), 'utf8')
    const liveGapSummary = renderCombinedGapMd113c(allSummaries)
    // Fixing D2Game.dll@0x6FD00460 stopped setting synthetic pStatListEx+0x10 |= 0x0100, eliminating
    // 1 spurious non-DLL D2Common:0x6FD8AC50 call in monster scenarios (`total TS` tightened by -1 while
    // every DLL-matched coverage / gap cell remains identical). Assert exact parity on all DLL coverage
    // & gap columns and monotonic tightening (`live <= committed`) on total TS counts.
    const stripTotalTs = (md: string) => md.replace(/ \(`\d+` total TS\)/g, '')
    expect(
      stripTotalTs(committedGapSummary),
      'docs/oracle/k1-replay/gap-summary.md is stale; run `npx tsx tools/oracle/kern-replay/gap-report.ts`',
    ).toBe(stripTotalTs(liveGapSummary))
    const committedTotals = [...committedGapSummary.matchAll(/\(`(\d+)` total TS\)/g)].map((m) => Number(m[1]))
    const liveTotals = [...liveGapSummary.matchAll(/\(`(\d+)` total TS\)/g)].map((m) => Number(m[1]))
    expect(liveTotals.length).toBe(committedTotals.length)
    for (let i = 0; i < liveTotals.length; i++) {
      expect(liveTotals[i]).toBeLessThanOrEqual(committedTotals[i]!)
    }

    const townRun = getCachedReplayAndGap('a1-town-walk')
    const townDllSet = new Set(townRun.gap.dllExecutedVas)
    const townTsSet = new Set(townRun.replay.tsExecutedVas)
    for (const va of DIFF_VERIFIED_K1_TOWN_WALK_VAS_113C) {
      const key = `D2Game:${va}`
      expect(townDllSet.has(key), `a1-town-walk dllExecutedVas missing ${key}`).toBe(true)
      expect(townTsSet.has(key), `a1-town-walk tsExecutedVas missing ${key}`).toBe(true)
    }

    const fallenRun = getCachedReplayAndGap('a1c-bloodmoor-fallen')
    const fallenDllSet = new Set(fallenRun.gap.dllExecutedVas)
    const fallenTsSet = new Set(fallenRun.replay.tsExecutedVas)
    for (const va of DIFF_VERIFIED_K1_REPLAY_AI_MONSTER_VAS_113C) {
      const key = `D2Game:${va}`
      expect(fallenDllSet.has(key), `a1c-bloodmoor-fallen dllExecutedVas missing ${key}`).toBe(true)
      expect(fallenTsSet.has(key), `a1c-bloodmoor-fallen tsExecutedVas missing ${key}`).toBe(true)
    }

    const k2UnionBoth = new Set<string>()
    for (const scen of ['a1-bloodmoor-melee', 'p52-dot-ticks', 'p52-item-defense'] as const) {
      const { replay, gap } = getCachedReplayAndGap(scen)
      const dllSet = new Set(gap.dllExecutedVas)
      const tsSet = new Set(replay.tsExecutedVas)
      for (const k of replay.tsExecutedVas) {
        if (dllSet.has(k)) k2UnionBoth.add(k)
      }
      for (const va of [
        ...DIFF_VERIFIED_K2_ITEMDROP_VAS_113C,
        ...DIFF_VERIFIED_K2_REPLAY_COMMON_VAS_113C,
      ]) {
        const key = `D2Game:${va}`
        expect(dllSet.has(key), `${scen} dllExecutedVas missing ${key}`).toBe(true)
        expect(tsSet.has(key), `${scen} tsExecutedVas missing ${key}`).toBe(true)
      }
    }
    for (const va of DIFF_VERIFIED_K2_REPLAY_SCENARIO_VAS_113C) {
      const key = `D2Game:${va}`
      expect(k2UnionBoth.has(key), `K2 union dll∩ts missing ${key}`).toBe(true)
    }

    const all5UnionBoth = new Set<string>()
    for (const spec of K1_K2_COVERAGE_RATCHET_SPECS_113C) {
      const { replay, gap } = getCachedReplayAndGap(spec.name)
      const dllSet = new Set(gap.dllExecutedVas)
      for (const k of replay.tsExecutedVas) {
        if (dllSet.has(k)) all5UnionBoth.add(k)
      }
    }
    for (const va of [
      ...DIFF_VERIFIED_K2_BATCH3_ROOM_SPAWN_VAS_113C,
      ...DIFF_VERIFIED_K2_BATCH5C_MONSTER_AI_SYNC_VAS_113C,
      ...DIFF_VERIFIED_K2_BATCH5A_FRAME_EVENT_JOIN_VAS_113C,
      ...DIFF_VERIFIED_K2_FINAL_ZERO_VAS_113C,
    ]) {
      const key = `D2Game:${va}`
      expect(all5UnionBoth.has(key), `5-scenario union dll∩ts missing ${key}`).toBe(true)
    }
  })
})
