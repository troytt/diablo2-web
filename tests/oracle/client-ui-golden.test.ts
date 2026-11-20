/**
 * Oracle P5.4: TS client display values vs the original 1.13c client (goldens captured on the original game
 * with `tools/oracle/run-client-ui.sh`, see docs/oracle/P5-client-display.md and
 * kb/ui/oracle-client-display-113c.md). Runs without Wine: the goldens hold the original's displayed values.
 *
 * One test per compared field. Fields listed in client-ui-known-mismatches.json are known divergences and run
 * as expected failures (`it.fails`), so the suite stays green while they exist and turns red when one is fixed
 * (then regenerate the list with `npx tsx tools/oracle/client-ui-compare.ts <oracle-dir> --known`).
 *
 * Needs the user-supplied 1.13c MPQs (`D2_DATA_DIR` or `samples/d2`) and the packed DRLG bundle
 * (`D2_ACT_PACKS_DIR` or `public/act-packs/tiles`); skipped without them.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR } from '../../src/baker/mpq-archive-source.ts'
import {
  captureId,
  clientUiCases,
  compareClientUi,
  MISMATCH_CLASSES,
  runTsClientUiCase,
  type ClientUiValues,
  type FieldDiff,
  type NamedClientUiCase,
} from '../../tools/oracle/lib/client-ui.ts'
import { loadReplicaEnvironment, type ReplicaEnvironment } from '../../tools/oracle/lib/replica.ts'

const PACKS_DIR = process.env.D2_ACT_PACKS_DIR ?? 'public/act-packs/tiles'
const hasMpq = existsSync(join(DEFAULT_NODE_MPQ_DIR, 'd2data.mpq'))
const hasPacks = existsSync(join(PACKS_DIR, 'drlg-bundle.json'))
const GOLDEN_DIR = 'tests/fixtures/oracle/golden'
const CASES = clientUiCases()
const CAPTURES: readonly { readonly c: NamedClientUiCase; readonly label: string; readonly id: string }[] =
  CASES.flatMap((c) => c.captures.map(([, label]) => ({ c, label, id: captureId(c.name, label) })))

interface Golden {
  readonly save: string
  readonly fields: readonly string[]
  readonly original: ClientUiValues
}

const known = JSON.parse(readFileSync(join(GOLDEN_DIR, 'client-ui-known-mismatches.json'), 'utf8')) as Record<
  string,
  Record<string, string>
>

describe('client-ui golden fixtures', () => {
  it('every known mismatch names a documented mismatch class and a compared field', () => {
    expect(CAPTURES.map((x) => x.id)).toEqual([
      'barbarian',
      'paladin',
      'amazon',
      'sorceress',
      'necromancer',
      'p54-barbarian-buffs-field',
      'p54-barbarian-buffs-buffs',
      'p54-paladin-auras-concentration',
      'p54-paladin-auras-fanaticism',
    ])
    for (const { id: cls } of CAPTURES) {
      const g = JSON.parse(readFileSync(join(GOLDEN_DIR, `client-ui-${cls}.json`), 'utf8')) as Golden
      for (const [id, klass] of Object.entries(known[cls] ?? {})) {
        expect(MISMATCH_CLASSES[klass], `${cls} ${id}: class ${klass}`).toBeDefined()
        expect(klass).not.toBe('unclassified')
        expect(g.fields).toContain(id)
      }
    }
  })
})

describe.skipIf(!hasMpq || !hasPacks)(
  `oracle client display vs TS (needs MPQs in ${DEFAULT_NODE_MPQ_DIR} and packed tiles in ${PACKS_DIR})`,
  () => {
    let env: Promise<ReplicaEnvironment> | undefined
    const caseRuns = new Map<string, Promise<Record<string, ClientUiValues>>>()
    const diffs = new Map<string, Promise<Map<string, FieldDiff>>>()
    const runFor = (c: NamedClientUiCase): Promise<Record<string, ClientUiValues>> => {
      let p = caseRuns.get(c.name)
      if (!p) {
        env ??= loadReplicaEnvironment({ packsDir: PACKS_DIR })
        p = env.then((e) => runTsClientUiCase(c, e))
        caseRuns.set(c.name, p)
      }
      return p
    }
    const diffFor = (c: NamedClientUiCase, label: string, cls: string, g: Golden): Promise<Map<string, FieldDiff>> => {
      let p = diffs.get(cls)
      if (!p) {
        p = runFor(c).then((out) => new Map(compareClientUi(g.original, out[label]!).map((d) => [d.id, d])))
        diffs.set(cls, p)
      }
      return p
    }
    for (const { c, label, id: cls } of CAPTURES) {
      const g = JSON.parse(readFileSync(join(GOLDEN_DIR, `client-ui-${cls}.json`), 'utf8')) as Golden
      const expectedFail = known[cls] ?? {}
      describe(cls, () => {
        it('compares exactly the golden field set', { timeout: 120_000 }, async () => {
          const d = await diffFor(c, label, cls, g)
          expect([...d.keys()].sort()).toEqual([...g.fields].sort())
        })
        for (const id of g.fields) {
          const klass = expectedFail[id]
          const name = klass ? `${id} [known: ${klass}]` : id
          const body = async (): Promise<void> => {
            const d = (await diffFor(c, label, cls, g)).get(id)
            expect(d, `field ${id} not compared`).toBeDefined()
            expect(d!.match, `${cls} ${id}: original ${d!.original} / TS ${d!.ts}`).toBe(true)
          }
          if (klass) it.fails(name, { timeout: 120_000 }, body)
          else it(name, { timeout: 120_000 }, body)
        }
      })
    }
  },
)
