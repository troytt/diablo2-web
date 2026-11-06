/**
 * Client display-value differential (oracle phase P5.4): original 1.13c client vs TS client.
 *
 *   tools/oracle/run-client-ui.sh <dir>                       # original game (Wine), per class
 *   npx tsx tools/oracle/client-ui-compare.ts <dir> [--golden] [--report <file.md>]
 *
 * For each class with `<dir>/<class>/ui.ndjson`, loads the same level-40 save into the TS server +
 * headless TS client (`tools/oracle/lib/client-ui.ts`) and compares every displayed value.
 *   --golden   (re)writes tests/fixtures/oracle/golden/client-ui-<class>.json from the oracle capture
 *              (the vitest tests/oracle/client-ui-golden.test.ts then runs without Wine)
 *   --known    (re)writes tests/fixtures/oracle/golden/client-ui-known-mismatches.json (expected failures of the
 *              vitest, one id per mismatching field with its mismatch class)
 *   --report   writes the markdown comparison (docs/oracle/P5-client-display.md)
 * Without <dir>, compares against the checked-in goldens.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  captureId,
  classifyMismatch,
  clientUiCases,
  compareClientUi,
  MISMATCH_CLASSES,
  oracleCaptureLabels,
  parseOracleClientUi,
  runTsClientUiCase,
  tooltipLineRate,
  type ClientUiValues,
  type FieldDiff,
} from './lib/client-ui.ts'
import { loadReplicaEnvironment } from './lib/replica.ts'

const GOLDEN_DIR = 'tests/fixtures/oracle/golden'
const KNOWN_PATH = join(GOLDEN_DIR, 'client-ui-known-mismatches.json')

/** class -> field id -> mismatch class (key of MISMATCH_CLASSES). */
interface Known {
  readonly [cls: string]: { readonly [id: string]: string }
}

function loadKnown(): Known {
  return existsSync(KNOWN_PATH) ? (JSON.parse(readFileSync(KNOWN_PATH, 'utf8')) as Known) : {}
}

function esc(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function rate(diffs: readonly FieldDiff[], group?: FieldDiff['group']): string {
  const d = group ? diffs.filter((x) => x.group === group) : diffs
  const m = d.filter((x) => x.match).length
  return d.length ? `${m}/${d.length} (${((100 * m) / d.length).toFixed(1)}%)` : '—'
}

async function main(argv: readonly string[]): Promise<number> {
  const ri = argv.indexOf('--report')
  const reportPath = ri >= 0 ? argv[ri + 1] : undefined
  const dir = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--report')
  const golden = argv.includes('--golden')
  const env = await loadReplicaEnvironment()
  const known = loadKnown()
  const results: { cls: string; orig: ClientUiValues; ts: ClientUiValues; diffs: FieldDiff[] }[] = []
  for (const c of clientUiCases()) {
    const origs: Record<string, ClientUiValues> = {}
    for (const [, label] of c.captures) {
      const id = captureId(c.name, label)
      const p = dir ? join(dir, c.name, 'ui.ndjson') : undefined
      if (p && existsSync(p)) {
        const raw = readFileSync(p, 'utf8')
        origs[label] = parseOracleClientUi(raw, oracleCaptureLabels(raw).includes(label) ? label : undefined)
      } else {
        const g = join(GOLDEN_DIR, `client-ui-${id}.json`)
        if (existsSync(g)) origs[label] = (JSON.parse(readFileSync(g, 'utf8')) as { original: ClientUiValues }).original
      }
    }
    if (Object.keys(origs).length === 0) {
      process.stderr.write(`${c.name}: no oracle capture, skipped\n`)
      continue
    }
    const tsAll = runTsClientUiCase(c, env)
    for (const [, label] of c.captures) {
      const orig = origs[label]
      if (!orig) continue
      const id = captureId(c.name, label)
      const ts = tsAll[label]!
      const diffs = compareClientUi(orig, ts)
      results.push({ cls: id, orig, ts, diffs })
      if (golden) {
        writeFileSync(
          join(GOLDEN_DIR, `client-ui-${id}.json`),
          JSON.stringify({ case: c.name, label, save: c.save, fields: diffs.map((d) => d.id), original: orig }, null, 1) + '\n',
        )
      }
      process.stderr.write(
        `${id}: sheet ${rate(diffs, 'sheet')}  skill ${rate(diffs, 'skill')}  tooltip ${rate(diffs, 'tooltip')}  all ${rate(diffs)}\n`,
      )
    }
  }
  if (argv.includes('--known')) {
    const out: Record<string, Record<string, string>> = {}
    for (const r of results) {
      out[r.cls] = {}
      for (const d of r.diffs) if (!d.match) out[r.cls]![d.id] = classifyMismatch(d, r.orig)
    }
    writeFileSync(KNOWN_PATH, JSON.stringify(out, null, 1) + '\n')
  }
  if (reportPath) writeFileSync(reportPath, renderReport(results, known))
  return 0
}

function statNote(orig: ClientUiValues, ts: ClientUiValues, ids: readonly number[]): string {
  const parts: string[] = []
  for (const id of ids) {
    const o = orig.stats[String(id)] ?? 0
    const t = ts.stats[String(id)] ?? 0
    if (o !== t) parts.push(`stat ${id}: client ${o} vs TS ${t}`)
  }
  return parts.join('; ')
}

/** Client stat ids each sheet field is drawn from (UI_DrawCharSheet table 0x6FB8D6F0 + calc). */
const SHEET_STATS: Readonly<Record<string, readonly number[]>> = {
  level: [12],
  experience: [13],
  nextLevel: [12],
  strength: [0],
  dexterity: [2],
  defense: [31, 2],
  vitality: [3],
  maxStamina: [11],
  stamina: [10],
  maxLife: [7],
  life: [6],
  energy: [1],
  maxMana: [9],
  mana: [8],
  fireRes: [39, 40],
  coldRes: [43, 44],
  lightRes: [41, 42],
  poisonRes: [45, 46],
}

function renderReport(
  results: readonly { cls: string; orig: ClientUiValues; ts: ClientUiValues; diffs: FieldDiff[] }[],
  known: Known,
): string {
  const klassOf = (r: { orig: ClientUiValues }, d: FieldDiff): string => classifyMismatch(d, r.orig)
  const L: string[] = []
  L.push('# P5.4 — Client display-value differential (original 1.13c client vs TS client)')
  L.push('')
  L.push('Generated by `npx tsx tools/oracle/client-ui-compare.ts <oracle-dir> --report docs/oracle/P5-client-display.md`')
  L.push('from the original-game capture of `tools/oracle/run-client-ui.sh` (hook `tools/oracle/hook/clientui.dll.c`,')
  L.push('evidence `kb/ui/oracle-client-display-113c.md`). Saves: the five original-authored level-40 characters, in town,')
  L.push('normal difficulty, 75 frames after the client player appears; nothing selected or cast.')
  L.push('')
  L.push('**Original** = strings captured from the original D2Client draw functions (D2Win text-draw imports redirected,')
  L.push('no OCR). **TS** = the same save loaded into the TS server (`GameInstance`) with its events fed to a headless TS')
  L.push('client (`OnlineSession` → `ClientWorld` → `HudModel.syncFromWorld`), values read the way')
  L.push('`CharacterSheetPanel.draw` / `SkillTreePanel.formatSkillTooltipLines` render them.')
  L.push('')
  L.push('Scope of the per-skill rows: every skill in the original client skill list is placed in the hand it can be')
  L.push('selected on (Skills.txt `leftskill`) and the attack block (name, damage, attack rating) is compared. Passive')
  L.push('skills (Skills.txt `passive`) and the scroll/tome skills 217..220 cannot be put on a mouse button, so their')
  L.push('blocks are not compared (their tooltips are).')
  L.push('')
  L.push('Coverage limits: the saves wear only starting equipment and nothing is cast, so the character sheet exercises')
  L.push('base attributes, vitals, defense, block and attack rating but no item/buff modifiers (blue/red values,')
  L.push('resistances other than 0, Battle Orders max life). The AR / defense hover hit chances (0x6FB6CB90 /')
  L.push('0x6FB6C520) depend on the last hovered monster and are captured (`calc.hitLeft/hitRight/monHitPct`) but not')
  L.push('compared. A geared/buffed capture needs scenario input injection in clientui.dll (next step).')
  L.push('')
  L.push('## Server resolution vs client display')
  L.push('')
  L.push('Each mismatch carries a layer:')
  L.push('')
  L.push('* **server** — the TS client already holds different data than the original client (stat lists compared:')
  L.push('  original D2Common #10973 on the D2Client player 0x6FBCBBFC vs TS `ClientWorld.self.stats`; skill lists:')
  L.push('  original unit+0xA8 chain vs TS `self.skills`). The TS server resolved or transmitted it differently; the')
  L.push('  display code is not at fault.')
  L.push('* **client** — the underlying client data agrees, but the TS display computation/formatting differs from the')
  L.push('  original D2Client function named in the cause.')
  L.push('')
  L.push('## Match rates')
  L.push('')
  L.push('| Class | Character sheet | Skill blocks + skill list | Tooltips (identical) | Tooltip lines | All fields |')
  L.push('|---|---|---|---|---|---|')
  for (const r of results) {
    const [lm, ln] = tooltipLineRate(r.orig, r.ts)
    L.push(
      `| ${r.cls} | ${rate(r.diffs, 'sheet')} | ${rate(r.diffs, 'skill')} | ${rate(r.diffs, 'tooltip')} | ` +
        `${lm}/${ln} (${((100 * lm) / ln).toFixed(1)}%) | ${rate(r.diffs)} |`,
    )
  }
  L.push('')
  L.push('## Mismatch classes')
  L.push('')
  L.push('| Class | Layer | Fields | Classes affected | Suspected cause |')
  L.push('|---|---|---|---|---|')
  const counts = new Map<string, { n: number; cls: Set<string> }>()
  for (const r of results) {
    for (const d of r.diffs) {
      if (d.match) continue
      const k = klassOf(r, d)
      const c = counts.get(k) ?? { n: 0, cls: new Set<string>() }
      c.n++
      c.cls.add(r.cls)
      counts.set(k, c)
    }
  }
  for (const [k, c] of [...counts.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const mc = MISMATCH_CLASSES[k]!
    L.push(`| \`${k}\` | ${mc.layer} | ${c.n} | ${[...c.cls].join(', ')} | ${esc(mc.cause)} |`)
  }
  L.push('')
  for (const r of results) {
    const k = known[r.cls] ?? {}
    L.push(`## ${r.cls}`)
    L.push('')
    L.push(
      `Selected skills: original left ${r.orig.leftSkill} / right ${r.orig.rightSkill}; ` +
        `TS left ${r.ts.leftSkill} / right ${r.ts.rightSkill}.`,
    )
    L.push('')
    L.push('### Character sheet')
    L.push('')
    L.push('| Field | Original | TS | Match | Layer | Suspected cause |')
    L.push('|---|---|---|---|---|---|')
    for (const d of r.diffs.filter((x) => x.group === 'sheet')) {
      const f = d.id.slice('sheet.'.length)
      const sn = d.match ? '' : statNote(r.orig, r.ts, SHEET_STATS[f] ?? [])
      const layer = d.match ? '' : sn ? 'server' : 'client'
      const cause = d.match ? '' : sn || k[d.id] || klassOf(r, d)
      L.push(`| ${f} | ${esc(d.original)} | ${esc(d.ts)} | ${d.match ? '✅' : '❌'} | ${layer} | ${esc(cause)} |`)
    }
    L.push('')
    L.push('### Skill list and attack blocks')
    L.push('')
    L.push('| Field | Original | TS | Match | Class |')
    L.push('|---|---|---|---|---|')
    for (const d of r.diffs.filter((x) => x.group === 'skill')) {
      L.push(`| ${d.id} | ${esc(d.original)} | ${esc(d.ts)} | ${d.match ? '✅' : '❌'} | ${d.match ? '' : '`' + klassOf(r, d) + '`'} |`)
    }
    L.push('')
    L.push('### Skill tree tooltips (first differing line per skill)')
    L.push('')
    const tt = r.diffs.filter((x) => x.group === 'tooltip')
    const bad = tt.filter((x) => !x.match)
    const [lm, ln] = tooltipLineRate(r.orig, r.ts)
    L.push(`${tt.length - bad.length}/${tt.length} tooltips identical; ${lm}/${ln} lines match.`)
    L.push('')
    if (bad.length) {
      L.push('| Tooltip | Original | TS | Class |')
      L.push('|---|---|---|---|')
      for (const d of bad) L.push(`| ${d.id} | ${esc(d.original)} | ${esc(d.ts)} | \`${klassOf(r, d)}\` |`)
      L.push('')
    }
  }
  return L.join('\n') + '\n'
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`)
    process.exit(1)
  },
)
