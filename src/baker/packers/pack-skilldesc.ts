/**
 * src/baker/packers/pack-skilldesc.ts
 *
 * Bakes the canonical Diablo II v1.13c `SkillDesc.txt` rows (joined to `Skills.txt` by the `skilldesc`
 * column) into `src/common/data/skilldesc-table.ts`, keeping every column the client consumes:
 *
 *  - all 17 description line slots (`descline1..6` = slot 0..5, `dsc2line1..4` = 6..9, `dsc3line1..7` = 10..16)
 *    with their `texta/textb` tbl keys resolved to ENG/CHI text and raw `calca/calcb` formulas
 *    (D2Client.dll 0x6FAE16C0 reads `bDescLine[17]` at +0x42, `wTextA[17]` +0x54, `wTextB[17]` +0x76,
 *    `dwCalcA[17]` +0x98, `dwCalcB[17]` +0xDC),
 *  - `str name/short/long/alt/mana`, `descdam`, `ddam calc1/2`, `p1..p3dmelem/min/max`, `descatt`,
 *  - `descmissile1..3` resolved to the `Missiles.txt` fields the description functions read
 *    (`Range`/`LevRange` for descline 23/29, `Param1` for 28 (Missiles+0x38: field table D2Common 0x6FDCCBEF), `SubMissile1` Range/LevRange for 30),
 *  - `DifficultyLevels.txt` `AiCurseDivisor` (descline 31 → 0x6FADE330 divides by DifficultyLevels+0x1C).
 *
 * Usage: npx tsx src/baker/packers/pack-skilldesc.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { loadStringTableChain } from '../../common/items/item-names.ts'
import { parseTable, type DataTable } from '../../common/items/tables.ts'

interface TextRef {
  readonly key: string
  readonly en: string
  readonly zh: string
}

async function main(): Promise<void> {
  const archives = new MountedArchives()
  for (const m of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
  }
  const eng = await loadStringTableChain(archives, 'ENG')
  const chi = await loadStringTableChain(archives, 'CHI')
  const readTxt = async (name: string): Promise<DataTable> =>
    parseTable(new TextDecoder('windows-1252').decode(await archives.read(`data\\global\\excel\\${name}`)))

  const text = (key: string | undefined): TextRef | undefined => {
    if (!key) return undefined
    const en = eng.get(key)
    if (en === undefined) throw new Error(`SkillDesc tbl key '${key}' missing from ENG string tables`)
    const zh = chi.get(key) ?? en
    return { key, en, zh }
  }
  const num = (v: string | undefined): number => (v === undefined || v === '' ? 0 : Number(v))

  const skills = await readTxt('Skills.txt')
  const desc = await readTxt('SkillDesc.txt')
  const missiles = await readTxt('Missiles.txt')
  const diff = await readTxt('DifficultyLevels.txt')
  const monStats = await readTxt('MonStats.txt')

  const missileByName = new Map<string, Record<string, string>>()
  for (const r of missiles.rows) if (r.Missile) missileByName.set(r.Missile, r)
  const descByName = new Map<string, Record<string, string>>()
  for (const r of desc.rows) if (r.skilldesc) descByName.set(r.skilldesc, r)
  const monById = new Map<string, Record<string, string>>()
  for (const r of monStats.rows) if (r.Id) monById.set(r.Id.toLowerCase(), r)

  const resolveSummonBaseHp = (summon: string | undefined): readonly [number, number, number] | undefined => {
    if (!summon) return undefined
    const m = monById.get(summon.toLowerCase())
    if (!m) return undefined
    return [
      Math.trunc((num(m.minHP) + num(m.maxHP)) / 2),
      Math.trunc((num(m['MinHP(N)']) + num(m['MaxHP(N)'])) / 2),
      Math.trunc((num(m['MinHP(H)']) + num(m['MaxHP(H)'])) / 2),
    ]
  }

  const resolveMissile = (name: string | undefined) => {
    if (!name) return undefined
    const m = missileByName.get(name)
    if (!m) throw new Error(`SkillDesc descmissile '${name}' not found in Missiles.txt`)
    const sub = m.SubMissile1 ? missileByName.get(m.SubMissile1) : undefined
    if (m.SubMissile1 && !sub) throw new Error(`Missiles.txt SubMissile1 '${m.SubMissile1}' not found`)
    return {
      name,
      range: num(m.Range),
      levRange: num(m.LevRange),
      param1: num(m.Param1),
      subMissile: sub ? { name: m.SubMissile1!, range: num(sub.Range), levRange: num(sub.LevRange) } : undefined,
    }
  }

  const SLOT_COLUMNS: [string, string, string, string, string][] = []
  for (let i = 1; i <= 6; i++) SLOT_COLUMNS.push([`descline${i}`, `desctexta${i}`, `desctextb${i}`, `desccalca${i}`, `desccalcb${i}`])
  for (let i = 1; i <= 4; i++) SLOT_COLUMNS.push([`dsc2line${i}`, `dsc2texta${i}`, `dsc2textb${i}`, `dsc2calca${i}`, `dsc2calcb${i}`])
  for (let i = 1; i <= 7; i++) SLOT_COLUMNS.push([`dsc3line${i}`, `dsc3texta${i}`, `dsc3textb${i}`, `dsc3calca${i}`, `dsc3calcb${i}`])

  const out: Record<number, unknown> = {}
  for (const s of skills.rows) {
    if (s.Id === undefined || !s.skilldesc) continue
    const d = descByName.get(s.skilldesc)
    if (!d) continue
    const lines = []
    for (let slot = 0; slot < SLOT_COLUMNS.length; slot++) {
      const [fc, ta, tb, ca, cb] = SLOT_COLUMNS[slot]!
      const func = num(d[fc])
      if (!func) continue
      lines.push({
        slot,
        func,
        textA: text(d[ta]),
        textB: text(d[tb]),
        calcA: d[ca] || undefined,
        calcB: d[cb] || undefined,
      })
    }
    out[Number(s.Id)] = {
      skillId: Number(s.Id),
      skillDesc: s.skilldesc,
      page: num(d.SkillPage),
      row: num(d.SkillRow),
      column: num(d.SkillColumn),
      listRow: num(d.ListRow),
      listPool: num(d.ListPool),
      iconCel: num(d.IconCel),
      strName: text(d['str name']),
      strShort: text(d['str short']),
      strLong: text(d['str long']),
      strAlt: text(d['str alt']),
      strMana: text(d['str mana']),
      descdam: num(d.descdam),
      ddamCalc1: d['ddam calc1'] || undefined,
      ddamCalc2: d['ddam calc2'] || undefined,
      calc1: s.calc1 || undefined,
      calc2: s.calc2 || undefined,
      calc3: s.calc3 || undefined,
      calc4: s.calc4 || undefined,
      summonBaseHp: resolveSummonBaseHp(s.summon),
      pdm: [1, 2, 3].map(i => ({ elem: d[`p${i}dmelem`] || '', min: d[`p${i}dmmin`] || '', max: d[`p${i}dmmax`] || '' })),
      descatt: num(d.descatt),
      descMissiles: [1, 2, 3].map(i => resolveMissile(d[`descmissile${i}`]) ?? null),
      lines,
    }
  }

  // Fixed string-table entries the D2Client.dll SkillDesc helpers/tooltip builders reference by index.
  const FIXED_KEYS = [
    'StrSkill1', 'StrSkill2', 'StrSkill4', 'StrSkill5', 'StrSkill6', 'StrSkill7', 'StrSkill8', 'StrSkill10',
    'StrSkill13', 'StrSkill14', 'StrSkill15', 'StrSkill16', 'StrSkill17', 'StrSkill18', 'StrSkill20', 'StrSkill23',
    'StrSkill26', 'StrSkill28', 'StrSkill34', 'StrSkill36', 'StrSkill39', 'StrSkill42', 'StrSkill116', 'StrSkill117',
    'StrSkill118', 'StrSkill119', 'skilldesc3', 'scrollbooktext', 'colon', 'space', 'percent', 'slash', 'plus',
  ]
  const fixed: Record<string, { en: string; zh: string }> = {}
  for (const k of FIXED_KEYS) {
    const t = text(k)!
    fixed[k] = { en: t.en, zh: t.zh }
  }

  const aiCurseDivisor = diff.rows.filter(r => r.Name).map(r => num(r.AiCurseDivisor))
  if (aiCurseDivisor.length !== 3) throw new Error('DifficultyLevels.txt must have 3 rows')

  const ts = `// Auto-generated by src/baker/packers/pack-skilldesc.ts from 1.13c SkillDesc.txt / Skills.txt /
// Missiles.txt / DifficultyLevels.txt and the ENG/CHI string tables. Do not edit by hand.

export interface SkillDescText {
  readonly key: string
  readonly en: string
  readonly zh: string
}

/** One SkillDesc description line. \`slot\` 0..5 = descline1..6, 6..9 = dsc2line1..4, 10..16 = dsc3line1..7. */
export interface SkillDescLine {
  readonly slot: number
  readonly func: number
  readonly textA?: SkillDescText | undefined
  readonly textB?: SkillDescText | undefined
  readonly calcA?: string | undefined
  readonly calcB?: string | undefined
}

export interface SkillDescMissile {
  readonly name: string
  readonly range: number
  readonly levRange: number
  readonly param1: number
  readonly subMissile?: { readonly name: string; readonly range: number; readonly levRange: number } | undefined
}

export interface SkillDescRecord {
  readonly skillId: number
  readonly skillDesc: string
  readonly page: number
  readonly row: number
  readonly column: number
  readonly listRow: number
  readonly listPool: number
  readonly iconCel: number
  readonly strName?: SkillDescText | undefined
  readonly strShort?: SkillDescText | undefined
  readonly strLong?: SkillDescText | undefined
  readonly strAlt?: SkillDescText | undefined
  readonly strMana?: SkillDescText | undefined
  readonly descdam: number
  readonly ddamCalc1?: string | undefined
  readonly ddamCalc2?: string | undefined
  readonly calc1?: string | undefined
  readonly calc2?: string | undefined
  readonly calc3?: string | undefined
  readonly calc4?: string | undefined
  readonly summonBaseHp?: readonly [number, number, number] | undefined
  readonly pdm: readonly { readonly elem: string; readonly min: string; readonly max: string }[]
  readonly descatt: number
  readonly descMissiles: readonly (SkillDescMissile | null)[]
  readonly lines: readonly SkillDescLine[]
}

/** Fixed tbl entries used by the SkillDesc helpers (D2Client.dll loads them by string index). */
export const SKILL_DESC_FIXED_TBL: Readonly<Record<string, { readonly en: string; readonly zh: string }>> = ${JSON.stringify(fixed, null, 1)}

/** \`DifficultyLevels.txt\` \`AiCurseDivisor\` for Normal / Nightmare / Hell. */
export const AI_CURSE_DIVISOR: readonly number[] = ${JSON.stringify(aiCurseDivisor)}

export const SKILL_DESC_BY_SKILL_ID: Readonly<Record<number, SkillDescRecord>> = {
${Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}
}
`
  writeFileSync(join(process.cwd(), 'src', 'common', 'data', 'skilldesc-table.ts'), ts, 'utf-8')
  console.log(`Wrote skilldesc-table.ts (${Object.keys(out).length} skills)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
