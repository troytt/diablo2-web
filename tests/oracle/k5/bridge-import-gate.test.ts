/**
 * @file tests/oracle/k5/bridge-import-gate.test.ts
 * `[K5 / #2031]` TypeScript AST transitive import-graph ratchet gate for
 * `src/server/net/d2gs-kernel-bridge-113c.ts` and `src/server/net/local-kernel-d2gs-adapter-113c.ts`.
 *
 * Ratchet discipline:
 * - Every entry in the allow-lists below must be exact (0 additions, 0 stale/padded entries).
 * - Phases 2B–2E may ONLY shrink these lists and ceilings until `d2gs-kernel-bridge-113c.ts`
 *   reaches ZERO legacy gameplay imports (both `value` and `type-only`).
 * - Any opaque construct (`import(x)`, `require(x)`, `import.meta.glob`, `new URL(..., import.meta.url)`,
 *   `eval`, `Function`, `file:` URL, out-of-repo escape) fails the gate unconditionally.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  collectAstImportGraph,
  createMemoryHost,
  createOverlayHost,
  evaluateLegacyImportGate,
  formatShortestImportChain,
  type AstImportGraph,
  type LegacyImportGatePolicy,
  type ParsedFileDependencies,
  type ReachabilityStatus,
} from '../../../tools/oracle/kern-replay/ast-import-graph.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

export const BRIDGE_ENTRY = 'src/server/net/d2gs-kernel-bridge-113c.ts'
export const ADAPTER_ENTRY = 'src/server/net/local-kernel-d2gs-adapter-113c.ts'

/** The 5 legacy gameplay files explicitly named in issue #2031. */
export const NAMED_2031_LEGACY_FILES: readonly string[] = [
  'src/common/items/drop-tables.ts',
  'src/common/items/transaction-cost.ts',
  'src/common/items/vendor-generator.ts',
  'src/common/skills/formulas.ts',
  'src/server/items/cube-engine-113c.ts',
]

/**
 * Ratchet status of each #2031-named file from `src/server/net/d2gs-kernel-bridge-113c.ts`.
 * Shrinks per phase (2B: formulas -> none; 2C: drop-tables direct -> none; 2D: vendor/tx/cube/drop-tables -> none).
 */
export const EXPECTED_NAMED_2031_STATUS: Readonly<
  Record<string, { readonly direct: ReachabilityStatus; readonly transitive: ReachabilityStatus }>
> = {
  'src/common/items/drop-tables.ts': { direct: 'value', transitive: 'value' },
  'src/common/items/transaction-cost.ts': { direct: 'value', transitive: 'value' },
  'src/common/items/vendor-generator.ts': { direct: 'value', transitive: 'value' },
  'src/common/skills/formulas.ts': { direct: 'value', transitive: 'value' },
  'src/server/items/cube-engine-113c.ts': { direct: 'value', transitive: 'value' },
}

// ============================================================================
// Bridge (`src/server/net/d2gs-kernel-bridge-113c.ts`) Shrink-Only Allow-Lists
// Phase 2A-2 baseline: 22 direct (21 value + 1 type-only), 91 transitive (74 value + 17 type-only).
// ============================================================================

export const MAX_BRIDGE_DIRECT_LEGACY = 22
export const MAX_BRIDGE_TRANSITIVE_VALUE_LEGACY = 74
export const MAX_BRIDGE_TRANSITIVE_TYPE_ONLY_LEGACY = 17
export const MAX_BRIDGE_TRANSITIVE_TOTAL_LEGACY = 91

export const ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES: readonly string[] = [
  'src/common/data/calc-ast.ts',
  'src/common/data/skills-catalog.ts',
  'src/common/items/belt-model.ts',
  'src/common/items/drop-tables.ts',
  'src/common/items/embedded-drop-tables.ts',
  'src/common/items/equip-req-113c.ts',
  'src/common/items/inventory-model.ts',
  'src/common/items/transaction-cost.ts',
  'src/common/items/vendor-generator.ts',
  'src/common/progression/experience-113c.ts',
  'src/common/rng/d2-rng.ts',
  'src/common/skills/formulas.ts',
  'src/common/skills/skills-meta.ts',
  'src/common/units/classes.ts',
  'src/common/units/monstats2-flags.ts',
  'src/common/units/monsters-data.ts',
  'src/common/units/npc-table.ts',
  'src/common/world/act-spawn-location.ts',
  'src/common/world/objects-meta.ts',
  'src/server/items/cube-engine-113c.ts',
  'src/server/items/server-item-data.ts',
]

export const ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES: readonly string[] = [
  'src/common/items/items.ts',
]

export const ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES: readonly string[] = [
  'src/common/data/calc-ast.ts',
  'src/common/data/canonical-drop-data.ts',
  'src/common/data/canonical-npc-dialog-table.ts',
  'src/common/data/canonical-tbl-strings.ts',
  'src/common/data/canonical-vendor-data.ts',
  'src/common/data/mul-div-113c.ts',
  'src/common/data/skills-catalog.ts',
  'src/common/formats/automap-table.ts',
  'src/common/formats/ds1.ts',
  'src/common/formats/dt1.ts',
  'src/common/formats/pl2.ts',
  'src/common/formats/reader.ts',
  'src/common/formats/sprite.ts',
  'src/common/formats/tbl.ts',
  'src/common/i18n/tooltip-i18n.ts',
  'src/common/items/affix-generator.ts',
  'src/common/items/affixes.ts',
  'src/common/items/armor.ts',
  'src/common/items/auto-tc.ts',
  'src/common/items/automagic.ts',
  'src/common/items/baked-ui-meta.ts',
  'src/common/items/belt-model.ts',
  'src/common/items/charged-skill.ts',
  'src/common/items/cursor-meta.ts',
  'src/common/items/damage-merge.ts',
  'src/common/items/dgrp-line.ts',
  'src/common/items/drop-tables.ts',
  'src/common/items/embedded-drop-tables.ts',
  'src/common/items/equip-req-113c.ts',
  'src/common/items/gems-data.ts',
  'src/common/items/gems.ts',
  'src/common/items/inventory-model.ts',
  'src/common/items/item-bridge.ts',
  'src/common/items/item-inv-trans-data.ts',
  'src/common/items/item-ratio.ts',
  'src/common/items/item-tooltip.ts',
  'src/common/items/item-types.ts',
  'src/common/items/item-upgrade.ts',
  'src/common/items/items.ts',
  'src/common/items/misc-items.ts',
  'src/common/items/properties.ts',
  'src/common/items/quest-item-difficulty.ts',
  'src/common/items/rare-names.ts',
  'src/common/items/runeword-socket.ts',
  'src/common/items/runeword.ts',
  'src/common/items/set-items.ts',
  'src/common/items/tables.ts',
  'src/common/items/transaction-cost.ts',
  'src/common/items/treasure-class.ts',
  'src/common/items/treasure-engine.ts',
  'src/common/items/unique-items.ts',
  'src/common/items/vendor-generator.ts',
  'src/common/items/weapons.ts',
  'src/common/path/monster-path-data.ts',
  'src/common/progression/experience-113c.ts',
  'src/common/rng/d2-rng.ts',
  'src/common/skills/formulas.ts',
  'src/common/skills/skills-data.ts',
  'src/common/skills/skills-meta.ts',
  'src/common/units/classes.ts',
  'src/common/units/cof-boxes-113c.ts',
  'src/common/units/monstats-113c-data.ts',
  'src/common/units/monstats2-flags-data.ts',
  'src/common/units/monstats2-flags.ts',
  'src/common/units/monster-mode-missiles-113c.ts',
  'src/common/units/monsters-data.ts',
  'src/common/units/npc-table.ts',
  'src/common/world/act-spawn-location.ts',
  'src/common/world/acts.ts',
  'src/common/world/levels-monlvl-113c.ts',
  'src/common/world/objects-meta.ts',
  'src/server/items/cube-engine-113c.ts',
  'src/server/items/cubemain-data-113c.ts',
  'src/server/items/server-item-data.ts',
]

export const ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES: readonly string[] = [
  'src/common/data/data-registry.ts',
  'src/common/formats/animdata.ts',
  'src/common/mpq/adpcm-tables.ts',
  'src/common/mpq/adpcm.ts',
  'src/common/mpq/archive.ts',
  'src/common/mpq/crypt.ts',
  'src/common/mpq/decompress.ts',
  'src/common/mpq/huffman-tables.ts',
  'src/common/mpq/huffman.ts',
  'src/common/mpq/implode-tables.ts',
  'src/common/mpq/implode.ts',
  'src/common/mpq/mount.ts',
  'src/common/mpq/source.ts',
  'src/common/units/unit-types.ts',
  'src/common/world/levels-meta.ts',
  'src/common/world/npc.ts',
  'src/common/world/quests.ts',
]

// ============================================================================
// Adapter (`src/server/net/local-kernel-d2gs-adapter-113c.ts`) Non-Bridge Ratchet
// Walked with `stopAt: [BRIDGE_ENTRY]` so bridge shrinkage does not churn adapter counts.
// ============================================================================

export const MAX_ADAPTER_DIRECT_LEGACY = 6
export const MAX_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE = 64
export const MAX_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY = 14

export const ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES: readonly string[] = [
  'src/common/units/classes.ts',
  'src/common/units/monstats2-flags.ts',
  'src/common/world/objects-meta.ts',
  'src/server/save/d2s-reader.ts',
  'src/server/save/d2s-writer.ts',
  'src/server/world/area-bootstrap.ts',
]

export const ALLOWED_ADAPTER_DIRECT_LEGACY_TYPE_ONLY_FILES: readonly string[] = []

export const ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES: readonly string[] = [
  'src/common/data/canonical-drop-data.ts',
  'src/common/data/canonical-npc-dialog-table.ts',
  'src/common/data/canonical-tbl-strings.ts',
  'src/common/data/canonical-vendor-data.ts',
  'src/common/data/skills-catalog.ts',
  'src/common/formats/automap-table.ts',
  'src/common/formats/d2s.ts',
  'src/common/formats/ds1.ts',
  'src/common/formats/dt1.ts',
  'src/common/formats/pl2.ts',
  'src/common/formats/reader.ts',
  'src/common/formats/sprite.ts',
  'src/common/formats/tbl.ts',
  'src/common/i18n/tooltip-i18n.ts',
  'src/common/items/affix-generator.ts',
  'src/common/items/affixes.ts',
  'src/common/items/armor.ts',
  'src/common/items/auto-tc.ts',
  'src/common/items/automagic.ts',
  'src/common/items/charged-skill.ts',
  'src/common/items/damage-merge.ts',
  'src/common/items/dgrp-line.ts',
  'src/common/items/drop-tables.ts',
  'src/common/items/embedded-drop-tables.ts',
  'src/common/items/gems-data.ts',
  'src/common/items/gems.ts',
  'src/common/items/item-ratio.ts',
  'src/common/items/item-tooltip.ts',
  'src/common/items/item-types.ts',
  'src/common/items/item-upgrade.ts',
  'src/common/items/items.ts',
  'src/common/items/misc-items.ts',
  'src/common/items/properties.ts',
  'src/common/items/rare-names.ts',
  'src/common/items/runeword.ts',
  'src/common/items/set-items.ts',
  'src/common/items/tables.ts',
  'src/common/items/treasure-class.ts',
  'src/common/items/treasure-engine.ts',
  'src/common/items/unique-items.ts',
  'src/common/items/weapons.ts',
  'src/common/path/monster-path-data.ts',
  'src/common/rng/d2-rng.ts',
  'src/common/skills/skills-data.ts',
  'src/common/units/classes.ts',
  'src/common/units/cof-boxes-113c.ts',
  'src/common/units/monai-113c.ts',
  'src/common/units/monstats-113c-data.ts',
  'src/common/units/monstats2-flags-data.ts',
  'src/common/units/monstats2-flags.ts',
  'src/common/units/monster-mode-missiles-113c.ts',
  'src/common/units/monsters-data.ts',
  'src/common/units/npc-table.ts',
  'src/common/world/act-spawn-location.ts',
  'src/common/world/acts.ts',
  'src/common/world/object-operate-113c.ts',
  'src/common/world/objects-meta.ts',
  'src/common/world/objects-txt-113c.ts',
  'src/server/save/d2s-reader.ts',
  'src/server/save/d2s-writer.ts',
  'src/server/world/area-bootstrap.ts',
  'src/server/world/objgroup-113c.ts',
  'src/server/world/objgroup-data-113c.ts',
  'src/server/world/pandemonium-113c.ts',
]

export const ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES: readonly string[] = [
  'src/common/mpq/adpcm-tables.ts',
  'src/common/mpq/adpcm.ts',
  'src/common/mpq/archive.ts',
  'src/common/mpq/crypt.ts',
  'src/common/mpq/decompress.ts',
  'src/common/mpq/huffman-tables.ts',
  'src/common/mpq/huffman.ts',
  'src/common/mpq/implode-tables.ts',
  'src/common/mpq/implode.ts',
  'src/common/mpq/mount.ts',
  'src/common/mpq/source.ts',
  'src/common/units/unit-types.ts',
  'src/common/world/npc.ts',
  'src/common/world/quests.ts',
]

const BRIDGE_GATE_POLICY: LegacyImportGatePolicy = {
  allowedDirectValue: ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES,
  allowedDirectTypeOnly: ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES,
  allowedTransitiveValue: ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES,
  allowedTransitiveTypeOnly: ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES,
  forbidNonItemsServer: true,
  namedFiles: NAMED_2031_LEGACY_FILES,
}

const ADAPTER_GATE_POLICY: LegacyImportGatePolicy = {
  allowedDirectValue: ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES,
  allowedDirectTypeOnly: ALLOWED_ADAPTER_DIRECT_LEGACY_TYPE_ONLY_FILES,
  allowedTransitiveValue: ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES,
  allowedTransitiveTypeOnly: ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES,
  exemptFiles: [BRIDGE_ENTRY],
  forbidNonItemsServer: false,
}

const sharedParseCache = new Map<string, ParsedFileDependencies>()

function assertSortedUnique(list: readonly string[], label: string): void {
  const sorted = [...list].sort()
  expect(list, `${label} must be strictly sorted`).toEqual(sorted)
  expect(new Set(list).size, `${label} must contain no duplicates`).toBe(list.length)
}

function assertDisjoint(a: readonly string[], b: readonly string[], label: string): void {
  const setB = new Set(b)
  const overlap = a.filter((item) => setB.has(item))
  expect(overlap, `${label} must be disjoint`).toEqual([])
}

describe('[K5 / #2031] Bridge AST import-graph ratchet gate (src/server/net/d2gs-kernel-bridge-113c.ts)', () => {
  let bridgeGraph: AstImportGraph

  beforeAll(() => {
    bridgeGraph = collectAstImportGraph(REPO_ROOT, BRIDGE_ENTRY, {
      parseCache: sharedParseCache,
    })
  }, 120_000)

  it('allow-list constants are strictly sorted, duplicate-free, disjoint, and within ratchet ceilings', () => {
    assertSortedUnique(NAMED_2031_LEGACY_FILES, 'NAMED_2031_LEGACY_FILES')
    assertSortedUnique(ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES, 'ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES')
    assertSortedUnique(
      ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES,
      'ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES',
    )
    assertSortedUnique(
      ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES,
      'ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES',
    )
    assertSortedUnique(
      ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES,
      'ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES',
    )
    assertDisjoint(
      ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES,
      ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES,
      'direct value vs direct type-only',
    )
    assertDisjoint(
      ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES,
      ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES,
      'transitive value vs transitive type-only',
    )

    expect(
      ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES.length +
        ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES.length,
    ).toBeLessThanOrEqual(MAX_BRIDGE_DIRECT_LEGACY)
    expect(ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES.length).toBeLessThanOrEqual(
      MAX_BRIDGE_TRANSITIVE_VALUE_LEGACY,
    )
    expect(ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES.length).toBeLessThanOrEqual(
      MAX_BRIDGE_TRANSITIVE_TYPE_ONLY_LEGACY,
    )
    expect(
      ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES.length +
        ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES.length,
    ).toBeLessThanOrEqual(MAX_BRIDGE_TRANSITIVE_TOTAL_LEGACY)
  })

  it('reaches real kernel and netproto modules (non-vacuous guard) with zero unresolved, zero packages, and zero opaque constructs', () => {
    expect(bridgeGraph.allFiles.size).toBeGreaterThan(200)
    expect(bridgeGraph.valueReachable.has('src/d2kern-113c/game/c2s-dispatch-113c.ts')).toBe(true)
    expect(bridgeGraph.valueReachable.has('src/netproto/index.ts')).toBe(true)
    expect(bridgeGraph.unresolved).toEqual([])
    expect(bridgeGraph.packages).toEqual([])
    expect(bridgeGraph.opaques).toEqual([])

    const report = evaluateLegacyImportGate(bridgeGraph, BRIDGE_GATE_POLICY)
    expect(report.outsideAllowedRoots).toEqual([])
    expect(report.nonItemsServerFiles).toEqual([])
  })

  it('enforces exact shrink-only direct legacy allow-list (21 value + 1 type-only, 0 padding, 0 additions)', () => {
    const report = evaluateLegacyImportGate(bridgeGraph, BRIDGE_GATE_POLICY)
    const fmt = (files: readonly string[], valOnly: boolean): string =>
      files.map((f) => `${f}: ${formatShortestImportChain(bridgeGraph, f, valOnly)}`).join('\n')

    expect(
      report.unexpectedDirectValue,
      `Unexpected direct value legacy imports:\n${fmt(report.unexpectedDirectValue, true)}`,
    ).toEqual([])
    expect(report.staleDirectValue, 'Stale direct value allow-list entries (shrink allow-list!)').toEqual([])
    expect(
      report.unexpectedDirectTypeOnly,
      `Unexpected direct type-only legacy imports:\n${fmt(report.unexpectedDirectTypeOnly, false)}`,
    ).toEqual([])
    expect(
      report.staleDirectTypeOnly,
      'Stale direct type-only allow-list entries (shrink allow-list!)',
    ).toEqual([])
    expect(report.directLegacyValue).toEqual(ALLOWED_BRIDGE_DIRECT_LEGACY_VALUE_FILES)
    expect(report.directLegacyTypeOnly).toEqual(ALLOWED_BRIDGE_DIRECT_LEGACY_TYPE_ONLY_FILES)
  })

  it('enforces exact shrink-only transitive legacy allow-list (74 value + 17 type-only, 0 padding, 0 additions)', () => {
    const report = evaluateLegacyImportGate(bridgeGraph, BRIDGE_GATE_POLICY)
    const fmt = (files: readonly string[], valOnly: boolean): string =>
      files.map((f) => `${f}: ${formatShortestImportChain(bridgeGraph, f, valOnly)}`).join('\n')

    expect(
      report.unexpectedTransitiveValue,
      `Unexpected transitive value legacy imports:\n${fmt(report.unexpectedTransitiveValue, true)}`,
    ).toEqual([])
    expect(
      report.staleTransitiveValue,
      'Stale transitive value allow-list entries (shrink allow-list!)',
    ).toEqual([])
    expect(
      report.unexpectedTransitiveTypeOnly,
      `Unexpected transitive type-only legacy imports:\n${fmt(report.unexpectedTransitiveTypeOnly, false)}`,
    ).toEqual([])
    expect(
      report.staleTransitiveTypeOnly,
      'Stale transitive type-only allow-list entries (shrink allow-list!)',
    ).toEqual([])
    expect(report.transitiveLegacyValue).toEqual(ALLOWED_BRIDGE_TRANSITIVE_LEGACY_VALUE_FILES)
    expect(report.transitiveLegacyTypeOnly).toEqual(ALLOWED_BRIDGE_TRANSITIVE_LEGACY_TYPE_ONLY_FILES)
    expect(report.violations, report.violations.join('\n')).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('tracks exact direct and transitive reachability of all 5 #2031-named legacy files', () => {
    const report = evaluateLegacyImportGate(bridgeGraph, BRIDGE_GATE_POLICY)
    for (const file of NAMED_2031_LEGACY_FILES) {
      const status = report.namedFileStatuses[file]
      const expected = EXPECTED_NAMED_2031_STATUS[file]!
      expect(status, `missing status for ${file}`).toBeDefined()
      expect(status!.direct, `${file} direct reachability`).toBe(expected.direct)
      expect(status!.transitive, `${file} transitive reachability`).toBe(expected.transitive)
      if (expected.transitive !== 'none') {
        expect(status!.chain, `${file} shortest chain`).toContain(BRIDGE_ENTRY)
        expect(status!.chain, `${file} shortest chain`).toContain(file)
      }
    }
  })

  it('reachable src/d2kern-113c/** and src/netproto/** modules have zero legacy edges', () => {
    const badEdges = bridgeGraph.edges.filter(
      (e) =>
        (e.from.startsWith('src/d2kern-113c/') || e.from.startsWith('src/netproto/')) &&
        (e.to.startsWith('src/common/') || e.to.startsWith('src/server/')),
    )
    expect(badEdges).toEqual([])
  })
})

describe('[K5 / #2031] Adapter AST import-graph ratchet gate (src/server/net/local-kernel-d2gs-adapter-113c.ts)', () => {
  let adapterGraph: AstImportGraph

  beforeAll(() => {
    adapterGraph = collectAstImportGraph(REPO_ROOT, ADAPTER_ENTRY, {
      stopAt: [BRIDGE_ENTRY],
      parseCache: sharedParseCache,
    })
  }, 120_000)

  it('enforces exact shrink-only non-bridge legacy allow-list with zero unresolved, packages, opaques, or direct server/items imports', () => {
    assertSortedUnique(ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES, 'ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES')
    assertSortedUnique(
      ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES,
      'ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES',
    )
    assertSortedUnique(
      ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES,
      'ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES',
    )
    assertDisjoint(
      ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES,
      ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES,
      'adapter transitive value vs type-only',
    )

    expect(ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES.length).toBeLessThanOrEqual(
      MAX_ADAPTER_DIRECT_LEGACY,
    )
    expect(ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES.length).toBeLessThanOrEqual(
      MAX_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE,
    )
    expect(ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES.length).toBeLessThanOrEqual(
      MAX_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY,
    )

    expect(adapterGraph.unresolved).toEqual([])
    expect(adapterGraph.packages).toEqual([])
    expect(adapterGraph.opaques).toEqual([])
    expect(adapterGraph.directValueFiles.filter((f) => f.startsWith('src/server/items/'))).toEqual([])
    expect(adapterGraph.directTypeOnlyFiles.filter((f) => f.startsWith('src/server/items/'))).toEqual([])

    const report = evaluateLegacyImportGate(adapterGraph, ADAPTER_GATE_POLICY)
    expect(report.directLegacyValue).toEqual(ALLOWED_ADAPTER_DIRECT_LEGACY_VALUE_FILES)
    expect(report.directLegacyTypeOnly).toEqual(ALLOWED_ADAPTER_DIRECT_LEGACY_TYPE_ONLY_FILES)
    expect(report.transitiveLegacyValue).toEqual(ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_VALUE_FILES)
    expect(report.transitiveLegacyTypeOnly).toEqual(
      ALLOWED_ADAPTER_TRANSITIVE_NON_BRIDGE_TYPE_ONLY_FILES,
    )
    expect(report.violations, report.violations.join('\n')).toEqual([])
    expect(report.ok).toBe(true)
  })
})

describe('[K5 / #2031] AST import-graph walker negative & positive controls', () => {
  const VIRTUAL_ROOT = resolve(REPO_ROOT, '__virtual_ast_gate_root__')
  const ZERO_POLICY: LegacyImportGatePolicy = {
    allowedDirectValue: [],
    allowedDirectTypeOnly: [],
    allowedTransitiveValue: [],
    allowedTransitiveTypeOnly: [],
    forbidNonItemsServer: true,
    namedFiles: NAMED_2031_LEGACY_FILES,
  }

  function makeVirtualLegacyTargets(): Record<string, string> {
    return {
      'src/common/items/drop-tables.ts': 'export const DROP = 1; export type DropType = number;',
      'src/common/items/transaction-cost.ts': 'export const TX = 1; export type TxType = number;',
      'src/common/items/vendor-generator.ts': 'export const VENDOR = 1; export type VendorType = number;',
      'src/common/skills/formulas.ts': 'export const FORM = 1; export type FormType = number;',
      'src/server/items/cube-engine-113c.ts': 'export const CUBE = 1; export type CubeType = number;',
      'src/d2kern-113c/game/pure-helper.ts': 'export const PURE = 1;',
    }
  }

  function runVirtual(files: Readonly<Record<string, string>>): {
    readonly graph: AstImportGraph
    readonly report: ReturnType<typeof evaluateLegacyImportGate>
  } {
    const host = createMemoryHost(VIRTUAL_ROOT, {
      ...makeVirtualLegacyTargets(),
      ...files,
    })
    const graph = collectAstImportGraph(VIRTUAL_ROOT, BRIDGE_ENTRY, { host })
    const report = evaluateLegacyImportGate(graph, ZERO_POLICY)
    return { graph, report }
  }

  const REL_FROM_BRIDGE: Readonly<Record<string, string>> = {
    'src/common/items/drop-tables.ts': '../../common/items/drop-tables.ts',
    'src/common/items/transaction-cost.ts': '../../common/items/transaction-cost.ts',
    'src/common/items/vendor-generator.ts': '../../common/items/vendor-generator.ts',
    'src/common/skills/formulas.ts': '../../common/skills/formulas.ts',
    'src/server/items/cube-engine-113c.ts': '../items/cube-engine-113c.ts',
  }

  it('L1: catches static value, mixed, side-effect, empty, and root-relative imports for all 5 #2031-named files', () => {
    for (const target of NAMED_2031_LEGACY_FILES) {
      const rel = REL_FROM_BRIDGE[target]!
      const variants = [
        `import { DROP } from '${rel}'; export const v = DROP;`,
        `import { type DropType, DROP } from '${rel}'; export const v: DropType = DROP;`,
        `import '${rel}';`,
        `import {} from '${rel}';`,
        `import { DROP } from '/${target}'; export const v = DROP;`,
      ]
      for (const src of variants) {
        const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: src })
        expect(graph.valueReachable.has(target), `L1 failed for ${target}: ${src}`).toBe(true)
        expect(report.ok, `L1 gate should fail for ${target}: ${src}`).toBe(false)
        expect(report.unexpectedTransitiveValue).toContain(target)
      }
    }
  })

  it('L2: catches re-export laundering through BOTH src/d2kern-113c/** and src/server/net/** siblings with full chain', () => {
    const launderForms = [
      (spec: string) => `export { DROP } from '${spec}';`,
      (spec: string) => `export * from '${spec}';`,
      (spec: string) => `export * as ns from '${spec}';`,
    ]
    for (const form of launderForms) {
      // Laundering via allowed-prefix kernel sibling
      const resKern = runVirtual({
        [BRIDGE_ENTRY]: `import { DROP } from '../../d2kern-113c/game/_launder.ts'; export const v = DROP;`,
        'src/d2kern-113c/game/_launder.ts': form('../../common/items/drop-tables.ts'),
      })
      expect(resKern.report.ok).toBe(false)
      expect(resKern.report.unexpectedTransitiveValue).toContain('src/common/items/drop-tables.ts')
      const chainK = formatShortestImportChain(resKern.graph, 'src/common/items/drop-tables.ts', true)
      expect(chainK).toContain('src/d2kern-113c/game/_launder.ts')
      expect(chainK).toContain('src/common/items/drop-tables.ts')

      // Laundering via server/net sibling
      const resNet = runVirtual({
        [BRIDGE_ENTRY]: `import { CUBE } from './_launder.ts'; export const v = CUBE;`,
        'src/server/net/_launder.ts': form('../items/cube-engine-113c.ts'),
      })
      expect(resNet.report.ok).toBe(false)
      expect(resNet.report.unexpectedTransitiveValue).toContain('src/server/items/cube-engine-113c.ts')
    }
  })

  it('L3 & L4: catches dynamic string literal, parenthesized literal, and no-substitution template literal imports', () => {
    for (const target of NAMED_2031_LEGACY_FILES) {
      const rel = REL_FROM_BRIDGE[target]!
      const cases = [
        `export async function f() { return await import('${rel}') }`,
        `export async function f() { return await import(('${rel}')) }`,
        `export async function f() { return await import(\`${rel}\`) }`,
      ]
      for (const src of cases) {
        const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: src })
        expect(graph.valueReachable.has(target), `L3/L4 failed for ${target}: ${src}`).toBe(true)
        expect(report.ok).toBe(false)
        expect(report.unexpectedTransitiveValue).toContain(target)
      }
    }
  })

  it('L5: catches all type-only import forms across ALL 5 #2031-named files (and detects value->type downgrade)', () => {
    for (const target of NAMED_2031_LEGACY_FILES) {
      const rel = REL_FROM_BRIDGE[target]!
      const typeForms = [
        `import type { DropType } from '${rel}'; export type T = DropType;`,
        `import { type DropType } from '${rel}'; export type T = DropType;`,
        `export type { DropType } from '${rel}';`,
        `export { type DropType } from '${rel}';`,
        `export type T = import('${rel}').DropType;`,
        `export type T = typeof import('${rel}');`,
        `/// <reference path="${rel}" />\nexport const ok = 1;`,
      ]
      for (const src of typeForms) {
        const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: src })
        expect(graph.valueReachable.has(target), `L5 should not be value-reachable: ${src}`).toBe(false)
        expect(graph.typeOnlyReachable.has(target), `L5 missed typeOnlyReachable: ${src}`).toBe(true)
        expect(report.ok, `L5 must fail zero-allow-list gate: ${src}`).toBe(false)
        expect(report.unexpectedTransitiveTypeOnly).toContain(target)
      }
    }

    // Downgrading a value import to type-only MUST fail a policy that only allowed it as value
    const downgraded = runVirtual({
      [BRIDGE_ENTRY]: `import type { DropType } from '../../common/items/drop-tables.ts'; export type T = DropType;`,
    })
    const valueOnlyPolicy: LegacyImportGatePolicy = {
      allowedDirectValue: ['src/common/items/drop-tables.ts'],
      allowedDirectTypeOnly: [],
      allowedTransitiveValue: ['src/common/items/drop-tables.ts'],
      allowedTransitiveTypeOnly: [],
    }
    const downReport = evaluateLegacyImportGate(downgraded.graph, valueOnlyPolicy)
    expect(downReport.ok).toBe(false)
    expect(downReport.unexpectedDirectTypeOnly).toContain('src/common/items/drop-tables.ts')
    expect(downReport.staleDirectValue).toContain('src/common/items/drop-tables.ts')
  })

  it('catches CJS import = require, require(), createRequire(), and multi-step aliased createRequire', () => {
    const cjsCases = [
      {
        src: `import dt = require('../../common/items/drop-tables.ts'); export const x = dt;`,
        target: 'src/common/items/drop-tables.ts',
        kind: 'value' as const,
      },
      {
        src: `import type dt = require('../../common/items/drop-tables.ts'); export type X = typeof dt;`,
        target: 'src/common/items/drop-tables.ts',
        kind: 'type-only' as const,
      },
      {
        src: `const dt = require('../../common/items/vendor-generator.ts'); export const x = dt;`,
        target: 'src/common/items/vendor-generator.ts',
        kind: 'value' as const,
      },
      {
        src: `const dt = createRequire(import.meta.url)('../../common/skills/formulas.ts'); export const x = dt;`,
        target: 'src/common/skills/formulas.ts',
        kind: 'value' as const,
      },
      {
        src: [
          `import { createRequire as cr } from 'node:module';`,
          `const r = cr(import.meta.url);`,
          `const r2 = r;`,
          `export const x = r2('../items/cube-engine-113c.ts');`,
        ].join('\n'),
        target: 'src/server/items/cube-engine-113c.ts',
        kind: 'value' as const,
      },
    ]

    for (const tc of cjsCases) {
      const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: tc.src })
      if (tc.kind === 'value') {
        expect(graph.valueReachable.has(tc.target), tc.src).toBe(true)
      } else {
        expect(graph.typeOnlyReachable.has(tc.target), tc.src).toBe(true)
      }
      expect(report.ok, tc.src).toBe(false)
    }
  })

  it('fails loudly on every opaque/dynamic construct', () => {
    const opaqueCases: ReadonlyArray<{ readonly label: string; readonly src: string; readonly kind: string }> = [
      { label: 'non-literal import(x)', src: `export const f = (x: string) => import(x);`, kind: 'dynamic-import-nonliteral' },
      { label: 'interpolated template import', src: `const dir = '../../common/items'; export const f = () => import(\`\${dir}/drop-tables.ts\`);`, kind: 'dynamic-import-nonliteral' },
      { label: 'concat import', src: `export const f = () => import('../../common/items/' + 'drop-tables.ts');`, kind: 'dynamic-import-nonliteral' },
      { label: 'non-literal require(x)', src: `export const f = (x: string) => require(x);`, kind: 'require-nonliteral' },
      { label: 'non-literal createRequire()(x)', src: `export const f = (x: string) => createRequire(import.meta.url)(x);`, kind: 'require-nonliteral' },
      { label: 'untracked createRequire', src: `export const arr = [createRequire(import.meta.url)];`, kind: 'create-require-untracked' },
      { label: 'import.meta.glob', src: `export const g = import.meta.glob('../../common/**/*.ts');`, kind: 'import-meta-loader' },
      { label: 'import.meta["glob"]', src: `export const g = import.meta['glob'];`, kind: 'import-meta-loader' },
      { label: 'destructured import.meta glob', src: `const { glob } = import.meta; export const g = glob;`, kind: 'import-meta-loader' },
      { label: 'new URL(..., import.meta.url)', src: `export const u = new URL('../../common/items/drop-tables.ts', import.meta.url);`, kind: 'new-url-import-meta' },
      { label: 'aliased import.meta.url in new URL', src: `const base = import.meta.url; export const u = new URL('../../common/items/drop-tables.ts', base);`, kind: 'new-url-import-meta' },
      { label: 'URL.parse(..., import.meta.url)', src: `export const u = URL.parse('../../common/items/drop-tables.ts', import.meta.url);`, kind: 'new-url-import-meta' },
      { label: 'new Function', src: `export const f = new Function('return import("../../common/items/drop-tables.ts")');`, kind: 'dynamic-eval-or-builtin' },
      { label: 'eval', src: `export const f = eval('1 + 1');`, kind: 'dynamic-eval-or-builtin' },
      { label: 'indirect (0, eval)', src: `export const f = (0, eval)('1 + 1');`, kind: 'dynamic-eval-or-builtin' },
      { label: 'file: URL import', src: `import 'file:///etc/passwd';`, kind: 'file-url-import' },
    ]

    for (const tc of opaqueCases) {
      const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: tc.src })
      expect(
        graph.opaques.some((o) => o.kind === tc.kind),
        `${tc.label} should emit opaque kind ${tc.kind}; got ${JSON.stringify(graph.opaques)}`,
      ).toBe(true)
      expect(report.ok, `${tc.label} must fail gate`).toBe(false)
    }
  })

  it('rejects stale/padded allow-lists and catches real-repo createOverlayHost mutations', () => {
    // 1. Stale allow-list anti-padding check
    const cleanVirtual = runVirtual({
      [BRIDGE_ENTRY]: `import { PURE } from '../../d2kern-113c/game/pure-helper.ts'; export const v = PURE;`,
    })
    expect(cleanVirtual.report.ok).toBe(true)
    const paddedReport = evaluateLegacyImportGate(cleanVirtual.graph, {
      allowedDirectValue: ['src/common/items/drop-tables.ts'],
      allowedDirectTypeOnly: [],
      allowedTransitiveValue: ['src/common/items/drop-tables.ts'],
      allowedTransitiveTypeOnly: [],
    })
    expect(paddedReport.ok).toBe(false)
    expect(paddedReport.staleDirectValue).toEqual(['src/common/items/drop-tables.ts'])
    expect(paddedReport.staleTransitiveValue).toEqual(['src/common/items/drop-tables.ts'])

    // 2. Real-repo createOverlayHost mutation #1: inject extra direct legacy import (`acts.ts`)
    const realBridgeSource = readFileSync(resolve(REPO_ROOT, BRIDGE_ENTRY), 'utf8')
    const injectedImportHost = createOverlayHost(REPO_ROOT, {
      [BRIDGE_ENTRY]: `import { parseTable } from '../../common/world/acts.ts'\nvoid parseTable\n${realBridgeSource}`,
    })
    const injectedImportGraph = collectAstImportGraph(REPO_ROOT, BRIDGE_ENTRY, {
      host: injectedImportHost,
      parseCache: sharedParseCache,
    })
    const injectedImportReport = evaluateLegacyImportGate(injectedImportGraph, BRIDGE_GATE_POLICY)
    expect(injectedImportReport.ok).toBe(false)
    expect(injectedImportReport.unexpectedDirectValue).toContain('src/common/world/acts.ts')

    // 3. Real-repo createOverlayHost mutation #2: inject opaque dynamic import into real bridge
    const injectedOpaqueHost = createOverlayHost(REPO_ROOT, {
      [BRIDGE_ENTRY]: `${realBridgeSource}\nexport const __opaqueTest = (p: string) => import(p)\n`,
    })
    const injectedOpaqueGraph = collectAstImportGraph(REPO_ROOT, BRIDGE_ENTRY, {
      host: injectedOpaqueHost,
      parseCache: sharedParseCache,
    })
    const injectedOpaqueReport = evaluateLegacyImportGate(injectedOpaqueGraph, BRIDGE_GATE_POLICY)
    expect(injectedOpaqueReport.ok).toBe(false)
    expect(
      injectedOpaqueGraph.opaques.some((o) => o.kind === 'dynamic-import-nonliteral'),
    ).toBe(true)

    // 4. Real-repo createOverlayHost mutation #3 (F1-1): inject erased TS type-wrapped require into real bridge
    const injectedWrappedReqHost = createOverlayHost(REPO_ROOT, {
      [BRIDGE_ENTRY]: `${realBridgeSource}\ntype _ReqFn = (id: string) => object\nexport const __sneaky = (require as _ReqFn)('../../common/world/acts.ts')\n`,
    })
    const injectedWrappedReqGraph = collectAstImportGraph(REPO_ROOT, BRIDGE_ENTRY, {
      host: injectedWrappedReqHost,
      parseCache: sharedParseCache,
    })
    const injectedWrappedReqReport = evaluateLegacyImportGate(
      injectedWrappedReqGraph,
      BRIDGE_GATE_POLICY,
    )
    expect(injectedWrappedReqReport.ok).toBe(false)
    expect(injectedWrappedReqReport.unexpectedDirectValue).toContain('src/common/world/acts.ts')
  }, 120_000)

  it('catches erased TS type-wrapper bypasses (as, !, satisfies, <T>) while keeping dynamic import specifiers strict (F1-1)', () => {
    const wrappedEdgeCases: ReadonlyArray<{ readonly label: string; readonly src: string }> = [
      {
        label: '(require as ReqFn)',
        src: `type ReqFn = (id: string) => object; export const x = (require as ReqFn)('../../common/items/drop-tables.ts');`,
      },
      {
        label: 'require!(...)',
        src: `export const x = require!('../../common/items/drop-tables.ts');`,
      },
      {
        label: '(require satisfies ReqFn)',
        src: `type ReqFn = (id: string) => object; export const x = (require satisfies ReqFn)('../../common/items/drop-tables.ts');`,
      },
      {
        label: '(<ReqFn>require)',
        src: `type ReqFn = (id: string) => object; export const x = (<ReqFn>require)('../../common/items/drop-tables.ts');`,
      },
      {
        label: 'const r = require as ReqFn; r(...)',
        src: `type ReqFn = (id: string) => object; const r = require as ReqFn; export const x = r('../../common/items/drop-tables.ts');`,
      },
    ]

    for (const tc of wrappedEdgeCases) {
      const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: tc.src })
      expect(
        graph.valueReachable.has('src/common/items/drop-tables.ts'),
        `${tc.label} must trace value edge`,
      ).toBe(true)
      expect(report.ok, `${tc.label} must fail gate`).toBe(false)
    }

    const wrappedOpaqueCases: ReadonlyArray<{
      readonly label: string
      readonly src: string
      readonly kind: string
    }> = [
      {
        label: '(import.meta as MetaLoader).glob',
        src: `type MetaLoader = { glob: (p: string) => object }; export const g = (import.meta as MetaLoader).glob('../../common/**/*.ts');`,
        kind: 'import-meta-loader',
      },
      {
        label: 'const { glob } = (import.meta as MetaLoader)',
        src: `type MetaLoader = { glob: (p: string) => object }; const { glob } = (import.meta as MetaLoader); export const g = glob;`,
        kind: 'import-meta-loader',
      },
      {
        label: '(eval as EvalFn)',
        src: `type EvalFn = (s: string) => object; export const x = (eval as EvalFn)('1+1');`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: '(0, (eval as EvalFn))',
        src: `type EvalFn = (s: string) => object; export const x = (0, (eval as EvalFn))('1+1');`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'new (Function as CtorFn)',
        src: `type CtorFn = new (s: string) => () => number; export const x = new (Function as CtorFn)('return 1')();`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'new (URL as UrlCtor)(..., import.meta.url)',
        src: `type UrlCtor = new (a: string, b: string) => object; export const u = new (URL as UrlCtor)('../../common/items/drop-tables.ts', import.meta.url);`,
        kind: 'new-url-import-meta',
      },
      {
        label: '(process.getBuiltinModule as BuiltinFn)',
        src: `type BuiltinFn = (id: string) => object; export const m = (process.getBuiltinModule as BuiltinFn)('node:module');`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'import("..." as const) stays fail-closed dynamic-import-nonliteral',
        src: `export const f = () => import('../../common/items/drop-tables.ts' as const);`,
        kind: 'dynamic-import-nonliteral',
      },
    ]

    for (const tc of wrappedOpaqueCases) {
      const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: tc.src })
      expect(
        graph.opaques.some((o) => o.kind === tc.kind),
        `${tc.label} should emit opaque ${tc.kind}; got ${JSON.stringify(graph.opaques)}`,
      ).toBe(true)
      expect(report.ok, `${tc.label} must fail gate`).toBe(false)
    }
  })

  it('catches zero-as alias/indirection bypasses, 18-hop reverse alias chains, and declare module (F1-2 & F1-3)', () => {
    const indirectionOpaqueCases: ReadonlyArray<{
      readonly label: string
      readonly src: string
      readonly kind: string
    }> = [
      {
        label: 'const meta = import.meta; meta.glob(...)',
        src: `const meta = import.meta; export const g = meta.glob('../../common/**/*.ts');`,
        kind: 'import-meta-loader',
      },
      {
        label: 'const meta = import.meta; meta.resolve(...)',
        src: `const meta = import.meta; export const g = meta.resolve('../../common/items/drop-tables.ts');`,
        kind: 'import-meta-loader',
      },
      {
        label: 'const meta = import.meta; meta["resolve"]',
        src: `const meta = import.meta; export const g = meta['resolve'];`,
        kind: 'import-meta-loader',
      },
      {
        label: 'const meta = import.meta; const { glob } = meta',
        src: `const meta = import.meta; const { glob } = meta; export const g = glob;`,
        kind: 'import-meta-loader',
      },
      {
        label: 'const { getBuiltinModule } = process; getBuiltinModule(...)',
        src: `const { getBuiltinModule } = process; export const m = getBuiltinModule('node:module');`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'require.call(null, ...)',
        src: `export const x = require.call(null, '../../common/items/drop-tables.ts');`,
        kind: 'require-nonliteral',
      },
      {
        label: 'require.apply(null, [...])',
        src: `export const x = require.apply(null, ['../../common/items/drop-tables.ts']);`,
        kind: 'require-nonliteral',
      },
      {
        label: 'require.bind(null)(...)',
        src: `export const x = require.bind(null)('../../common/items/drop-tables.ts');`,
        kind: 'require-nonliteral',
      },
      {
        label: 'const [r] = [require]; r(...)',
        src: `const [r] = [require]; export const x = r('../../common/items/drop-tables.ts');`,
        kind: 'require-nonliteral',
      },
      {
        label: 'const o = { r: require }; o.r(...)',
        src: `const o = { r: require }; export const x = o.r('../../common/items/drop-tables.ts');`,
        kind: 'require-nonliteral',
      },
      {
        label: 'invoke(require)',
        src: `function invoke(fn: (s: string) => object) { return fn('../../common/items/drop-tables.ts'); } export const x = invoke(require);`,
        kind: 'require-nonliteral',
      },
      {
        label: 'function f(r = require)',
        src: `export function f(r = require) { return r('../../common/items/drop-tables.ts'); }`,
        kind: 'require-nonliteral',
      },
      {
        label: 'const ev = eval; ev(...)',
        src: `const ev = eval; export const x = ev('1+1');`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'const Fn = Function; new Fn(...)',
        src: `const Fn = Function; export const x = new Fn('return 1')();`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'const U = URL; new U(..., import.meta.url)',
        src: `const U = URL; export const x = new U('../../common/items/drop-tables.ts', import.meta.url);`,
        kind: 'new-url-import-meta',
      },
      {
        label: '(() => {}).constructor(...)',
        src: `export const x = (() => {}).constructor('return 1')();`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'const fn = () => {}; fn.constructor(...)',
        src: `const fn = () => {}; export const x = fn.constructor('return 1')();`,
        kind: 'dynamic-eval-or-builtin',
      },
      {
        label: 'const [m] = [import.meta]',
        src: `const [m] = [import.meta]; export const x = m;`,
        kind: 'import-meta-loader',
      },
      {
        label: 'Reflect.construct(Function, ...)',
        src: `export const x = Reflect.construct(Function, ['return 1'])();`,
        kind: 'dynamic-eval-or-builtin',
      },
    ]

    for (const tc of indirectionOpaqueCases) {
      const { graph, report } = runVirtual({ [BRIDGE_ENTRY]: tc.src })
      expect(
        graph.opaques.some((o) => o.kind === tc.kind),
        `${tc.label} should emit opaque ${tc.kind}; got ${JSON.stringify(graph.opaques)}`,
      ).toBe(true)
      expect(report.ok, `${tc.label} must fail gate`).toBe(false)
    }

    // 18-hop reverse-order alias chain (>16 hops) must converge and catch the legacy import
    const reverseChainLines: string[] = [
      `type ReqFn = (id: string) => object;`,
      `declare const require: ReqFn;`,
      `let ${Array.from({ length: 18 }, (_, i) => `r${i}: ReqFn`).join(', ')};`,
    ]
    for (let i = 17; i >= 1; i--) {
      reverseChainLines.push(`r${i} = r${i - 1};`)
    }
    reverseChainLines.push(`r0 = require;`)
    reverseChainLines.push(`export const x = r17('../../common/items/drop-tables.ts');`)
    const reverseRes = runVirtual({ [BRIDGE_ENTRY]: reverseChainLines.join('\n') })
    expect(reverseRes.graph.valueReachable.has('src/common/items/drop-tables.ts')).toBe(true)
    expect(reverseRes.report.ok).toBe(false)
    expect(reverseRes.report.unexpectedDirectValue).toContain('src/common/items/drop-tables.ts')

    // F1-3: ambient `declare module '...'` augmentation tracked as type-only edge
    const declareModRes = runVirtual({
      [BRIDGE_ENTRY]: `declare module '../../common/items/drop-tables.ts' { export const HACK: number }`,
    })
    expect(declareModRes.graph.valueReachable.has('src/common/items/drop-tables.ts')).toBe(false)
    expect(declareModRes.graph.typeOnlyReachable.has('src/common/items/drop-tables.ts')).toBe(true)
    expect(
      declareModRes.graph.edges.some(
        (e) => e.syntax === 'declare-module' && e.to === 'src/common/items/drop-tables.ts',
      ),
    ).toBe(true)
    expect(declareModRes.report.ok).toBe(false)
    expect(declareModRes.report.unexpectedDirectTypeOnly).toContain(
      'src/common/items/drop-tables.ts',
    )
  })

  it('positive controls: comments/strings, TS type annotations (isA?: Function), non-global obj.eval, and .js->.ts twins produce zero false positives', () => {
    const { graph, report } = runVirtual({
      [BRIDGE_ENTRY]: [
        `// import { DROP } from '../../common/items/drop-tables.ts'`,
        `/* export * from '../../common/items/vendor-generator.ts' */`,
        `export const note = "import('../../common/items/drop-tables.ts'); eval('x'); import.meta.glob('*')";`,
        `export interface Predicates { readonly isA?: Function }`,
        `const localConfig = { eval: 42 };`,
        `export const cfgVal = localConfig.eval;`,
        `import { PURE } from '../../d2kern-113c/game/pure-helper.js';`,
        `import { TWIN } from '../../d2kern-113c/game/extensionless-helper';`,
        `export const sum = PURE + TWIN + cfgVal;`,
      ].join('\n'),
      'src/d2kern-113c/game/extensionless-helper.ts': 'export const TWIN = 2;',
    })
    expect(graph.unresolved).toEqual([])
    expect(graph.opaques).toEqual([])
    expect(graph.valueReachable.has('src/d2kern-113c/game/pure-helper.ts')).toBe(true)
    expect(graph.valueReachable.has('src/d2kern-113c/game/extensionless-helper.ts')).toBe(true)
    expect(report.ok).toBe(true)
  })
})
