/**
 * Issue #1044: static 1.13c parity gate for missiles / overlays (ratcheting allow-list).
 *
 * Ground truth: the 1.13c Missiles.txt / Overlay.txt read from the mounted MPQs (data registry) and the generated
 * overlay.bin table OVERLAY_TXT_ROWS. Every check computes its violations; the test fails when
 *   - a violation is not in `vfx-parity-113c.allowlist.json` (a regression / new alias / new invented key), or
 *   - an allow-listed entry no longer violates (the fix must also shrink the allow-list).
 * Regenerate after a fix with `VFX_PARITY_WRITE=1 npx vitest run tests/vfx-parity-113c.test.ts`; the list may only
 * shrink until it is empty.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeCelFileKey, resolveArtByCelFile } from '../src/client/render/cel-file-key.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { LINEAR_SKILL_MISSILES } from '../src/client/world/world-skill-state-tables.ts'
import { CLTDO25_SKILLS_113C } from '../src/common/skills/cltdo25-ring-113c.ts'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import {
  CANONICAL_113C_MISSILES,
  CANONICAL_113C_OVERLAYS,
  getMissileTxtData,
} from '../src/common/skills/missiles-data.ts'

const ROOT = join(__dirname, '..')
const ALLOWLIST_PATH = join(__dirname, 'vfx-parity-113c.allowlist.json')

type Violations = Record<string, string[]>

function srcFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...srcFiles(p))
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out.sort()
}

function missilesTxtRows(): Map<string, Readonly<Record<string, string>>> | null {
  let table
  try {
    table = getSharedDataRegistry().missilesTable
  } catch {
    return null
  }
  const rows = new Map<string, Readonly<Record<string, string>>>()
  for (const row of table.rows) {
    const name = row['Missile'] ?? ''
    if (name === '' || (row['Id'] ?? '') === '') continue
    rows.set(name, row)
  }
  return rows
}

const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? 0 : Number(s))
const bool = (v: unknown) => v === true || v === 1 || v === '1'

/** A Missiles.txt row name usable as a spawn key: a canonical, non-alias row whose name is the key itself. */
function isRealMissileKey(key: string): boolean {
  const k = key.trim().toLowerCase()
  const row = CANONICAL_113C_MISSILES[k]
  if (!row) return false
  try {
    const data = getMissileTxtData(k)
    return data.name.toLowerCase() === k
  } catch {
    return false
  }
}

function computeViolations(txt: Map<string, Readonly<Record<string, string>>>): Violations {
  const v: Violations = {
    spawnLiterals: [],
    overlayLiterals: [],
    clientSkillTables: [],
    missileMetas: [],
    canonicalMissiles: [],
    canonicalOverlays: [],
    missingArt: [],
  }
  const overlayNames = new Set(OVERLAY_TXT_ROWS.map(r => r.name.toLowerCase()))

  // 1. String literals passed to spawnMissileByKey / attachUnitOverlay.
  for (const file of srcFiles(join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file)
    for (const m of text.matchAll(/spawnMissileByKey\(\s*(['"])([^'"\n]+)\1/g)) {
      if (!isRealMissileKey(m[2]!)) v.spawnLiterals!.push(`${rel}|${m[2]}`)
    }
    for (const m of text.matchAll(/attachUnitOverlay\(\s*[^,()]+,\s*(['"])([^'"\n]+)\1/g)) {
      if (!overlayNames.has(m[2]!.trim().toLowerCase())) v.overlayLiterals!.push(`${rel}|${m[2]}`)
    }
  }

  // 1b. Values of the client skill tables.
  for (const [skill, { key }] of Object.entries(LINEAR_SKILL_MISSILES)) {
    if (!isRealMissileKey(key)) v.clientSkillTables!.push(`LINEAR_SKILL_MISSILES[${skill}]=${key}`)
  }
  for (const [skill, { cltMissileA: key }] of Object.entries(CLTDO25_SKILLS_113C)) {
    if (!isRealMissileKey(key)) v.clientSkillTables!.push(`CLTDO25_SKILLS_113C[${skill}]=${key}`)
  }

  // 2. MISSILE_METAS keys: a real row with the same CelFile; CelFile-null rows have no key.
  for (const [key, meta] of Object.entries(MISSILE_METAS)) {
    const row = txt.get(key) ?? txt.get(key.toLowerCase())
    if (!row) v.missileMetas!.push(`${key}: not a Missiles.txt row`)
    else if ((row['CelFile'] ?? '').toLowerCase() === 'null' || (row['CelFile'] ?? '') === '')
      v.missileMetas!.push(`${key}: row CelFile is null`)
    else if (normalizeCelFileKey(row['CelFile']!) !== normalizeCelFileKey(meta.celFile))
      v.missileMetas!.push(`${key}: ${meta.celFile} != ${row['CelFile']}`)
  }

  // 3. CANONICAL_113C_MISSILES == Missiles.txt.
  const fields: [keyof (typeof CANONICAL_113C_MISSILES)[string], string, 'num' | 'str' | 'bool'][] = [
    ['id', 'Id', 'num'],
    ['celFile', 'CelFile', 'str'],
    ['animLen', 'AnimLen', 'num'],
    ['animSpeed', 'AnimSpeed', 'num'],
    ['loopAnim', 'LoopAnim', 'num'],
    ['numDirections', 'NumDirections', 'num'],
    ['range', 'Range', 'num'],
    ['levRange', 'LevRange', 'num'],
    ['vel', 'Vel', 'num'],
    ['maxVel', 'MaxVel', 'num'],
    ['light', 'Light', 'num'],
    ['red', 'Red', 'num'],
    ['green', 'Green', 'num'],
    ['blue', 'Blue', 'num'],
    ['trans', 'Trans', 'num'],
    ['explosionMissile', 'ExplosionMissile', 'str'],
    ['alwaysExplode', 'AlwaysExplode', 'bool'],
    ['pierce', 'Pierce', 'bool'],
    ['subLoop', 'SubLoop', 'num'],
    ['subStart', 'SubStart', 'num'],
    ['subStop', 'SubStop', 'num'],
  ]
  const canonicalNames = new Set<string>()
  for (const [key, row] of Object.entries(CANONICAL_113C_MISSILES)) {
    const t = txt.get(row.name)
    if (!t || row.name !== key) {
      v.canonicalMissiles!.push(`${key}: not a Missiles.txt row name`)
      continue
    }
    canonicalNames.add(row.name)
    for (const [field, col, kind] of fields) {
      const ours = row[field]
      // 10 rows leave NumDirections empty; the client tables carry them as 1 direction.
      const theirs = col === 'NumDirections' && (t[col] ?? '').trim() === '' ? '1' : t[col]
      const same =
        kind === 'num'
          ? num(ours === undefined ? undefined : String(ours === true ? 1 : ours === false ? 0 : ours)) === num(theirs)
          : kind === 'bool'
            ? bool(ours) === bool(theirs)
            : String(ours ?? '') === String(theirs ?? '')
      if (!same) v.canonicalMissiles!.push(`${key}.${String(field)}: ${String(ours)} != ${String(theirs)}`)
    }
  }
  for (const name of txt.keys()) {
    if (!canonicalNames.has(name)) v.canonicalMissiles!.push(`${name}: missing from CANONICAL_113C_MISSILES`)
  }

  // 4. CANONICAL_113C_OVERLAYS == OVERLAY_TXT_ROWS.
  const ovByName = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r]))
  const seenOverlays = new Set<string>()
  for (const [key, ov] of Object.entries(CANONICAL_113C_OVERLAYS)) {
    const r = ovByName.get(key.toLowerCase())
    if (!r || ov.overlay.toLowerCase() !== key.toLowerCase()) {
      v.canonicalOverlays!.push(`${key}: not an Overlay.txt row name`)
      continue
    }
    seenOverlays.add(key.toLowerCase())
    const pairs: [string, unknown, unknown][] = [
      ['filename', ov.filename, r.filename],
      ['frames', ov.frames, r.frames],
      ['animRate', ov.animRate, r.animRate],
      ['trans', ov.trans, r.trans],
      ['preDraw', ov.preDraw ? 1 : 0, r.preDraw],
      ['initRadius', ov.initRadius, r.initRadius],
      ['radius', ov.radius, r.radius],
      ['red', ov.red, r.red],
      ['green', ov.green, r.green],
      ['blue', ov.blue, r.blue],
      ['numDirections', ov.numDirections ?? r.numDirections, r.numDirections],
      ['xOffset', ov.xOffset ?? 0, r.xOffset],
      ['yOffset', ov.yOffset ?? 0, r.yOffset],
    ]
    for (const [field, ours, theirs] of pairs) {
      if (String(ours) !== String(theirs)) v.canonicalOverlays!.push(`${key}.${field}: ${String(ours)} != ${String(theirs)}`)
    }
  }
  for (const name of ovByName.keys()) {
    if (name !== 'null' && !seenOverlays.has(name)) v.canonicalOverlays!.push(`${name}: missing from CANONICAL_113C_OVERLAYS`)
  }

  // 5. Every Missiles.txt row with a CelFile resolves (emulated loader) to an atlas of that CelFile.
  const art = new Map<string, { meta: { celFile: string } }>()
  for (const meta of Object.values(MISSILE_METAS)) {
    art.set(meta.name.toLowerCase(), { meta })
    if (meta.celFile) art.set(`cel:${normalizeCelFileKey(meta.celFile)}`, { meta })
  }
  for (const [name, t] of txt) {
    const cel = t['CelFile'] ?? ''
    if (cel === '' || cel.toLowerCase() === 'null') continue
    const a = resolveArtByCelFile(art, name, cel)
    if (!a) v.missingArt!.push(`${name}: ${cel}`)
  }

  for (const k of Object.keys(v)) v[k] = Array.from(new Set(v[k])).sort()
  return v
}

const TXT = missilesTxtRows()

describe('Issue #1044: Missiles / Overlay 1.13c static parity gate', () => {
  it.skipIf(TXT === null)('violations match the ratcheting allow-list exactly', () => {
    const now = computeViolations(TXT!)
    if (process.env['VFX_PARITY_WRITE'] === '1') {
      writeFileSync(ALLOWLIST_PATH, JSON.stringify(now, null, 2) + '\n')
    }
    expect(existsSync(ALLOWLIST_PATH)).toBe(true)
    const allow = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as Violations
    for (const [check, list] of Object.entries(now)) {
      const allowed = new Set(allow[check] ?? [])
      const fresh = list.filter(x => !allowed.has(x))
      expect(fresh, `${check}: new 1.13c parity violations (use the real Missiles.txt / Overlay.txt row)`).toEqual([])
      const fixed = [...allowed].filter(x => !list.includes(x))
      expect(fixed, `${check}: fixed entries must be removed from vfx-parity-113c.allowlist.json`).toEqual([])
    }
  })

  it.skipIf(TXT === null)('Missiles.txt has the 1.13c row count', () => {
    expect(TXT!.size).toBe(684)
  })

  it('no spawnMissileByKey literal throws in getMissileTxtData', () => {
    const throwing: string[] = []
    for (const file of srcFiles(join(ROOT, 'src'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/spawnMissileByKey\(\s*(['"])([^'"\n]+)\1/g)) {
        try {
          getMissileTxtData(m[2]!)
        } catch {
          throwing.push(`${relative(ROOT, file)}|${m[2]}`)
        }
      }
    }
    expect(throwing).toEqual([])
  })
})
