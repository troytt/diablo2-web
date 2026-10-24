import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { loadActTables } from '../../common/world/acts.ts'
import { SKILLS_CATALOG } from '../../common/data/skills-catalog.ts'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

async function run() {
  console.log('Mounting MPQs to extract 1.13c ToHit and auraLenCalc...')
  const archives = new MountedArchives()
  for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(m, await MpqArchive.open(await fileSource('samples/d2/' + m)))
  }
  const tables = await loadActTables(archives)
  const st = tables.skills!
  const toHitIdx = st.header.indexOf('ToHit')
  const levToHitIdx = st.header.indexOf('LevToHit')
  const toHitCalcIdx = st.header.indexOf('ToHitCalc')
  const auraLenCalcIdx = st.header.indexOf('auralencalc')
  const startmanaIdx = st.header.indexOf('startmana')

  const updatedCatalog = SKILLS_CATALOG.map(skill => {
    const row = st.rows.find(r => Number(r[1]) === skill.id)
    const th = row ? (Number(row[toHitIdx]) || 0) : 0
    const lth = row ? (Number(row[levToHitIdx]) || 0) : 0
    const rawThc = row ? row[toHitCalcIdx] : undefined
    const thc = rawThc && rawThc.trim() !== '' ? rawThc.trim() : undefined
    const rawAlc = row ? row[auraLenCalcIdx] : undefined
    const alc = rawAlc && rawAlc.trim() !== '' ? rawAlc.trim() : undefined
    const sm = row ? (Number(row[startmanaIdx]) || 0) : 0

    return {
      ...skill,
      toHit: th,
      toHitLev: lth,
      ...(thc ? { toHitCalc: thc } : {}),
      ...(alc ? { auraLenCalc: alc } : {}),
      startmana: sm,
    }
  })

  const tsContent = `// Auto-generated Diablo II 1.13c 210-Skill Catalog
// Ground truth parsed from Skills.txt, SkillDesc.txt, string.tbl, and MPQs.

import type { CharacterClassCode } from '../units/classes.ts'

export interface SynergyBonusInfo {
  readonly providerId: number
  readonly providerName: string
  readonly percentPerLevel: number
  readonly type: 'damage' | 'elemental' | 'duration'
}

export interface SynergyGivenInfo {
  readonly targetId: number
  readonly targetName: string
  readonly targetNameZh: string
  readonly percentPerLevel: number
}

export interface DescLineDefinition {
  readonly lineType: number
  readonly textaKey?: string | undefined
  readonly textbKey?: string | undefined
  readonly textaEn?: string | undefined
  readonly textaZh?: string | undefined
  readonly textbEn?: string | undefined
  readonly textbZh?: string | undefined
  readonly calca?: string | undefined
  readonly calcb?: string | undefined
}

export interface MinionBaseStats {
  readonly code: string
  readonly minHP: number
  readonly maxHP: number
  readonly minDam: number
  readonly maxDam: number
}

export interface SkillCatalogEntry {
  readonly id: number
  readonly name: string
  readonly nameZh: string
  readonly classCode: CharacterClassCode
  readonly classNameZh: string
  readonly tabIndex: number
  readonly tabName: string
  readonly tabNameZh: string
  readonly row: number
  readonly col: number
  readonly reqlevel: number
  readonly reqskills: readonly number[]
  readonly dependents: readonly number[]
  readonly mana: number
  readonly lvlmana: number
  readonly minmana: number
  readonly manashift: number
  readonly delay: number
  readonly descdam?: string | undefined
  readonly hitshift: number
  readonly srcDamage: number
  readonly minDam: number
  readonly maxDam: number
  readonly minLevDam: readonly number[]
  readonly maxLevDam: readonly number[]
  readonly eType: string
  readonly eMin: number
  readonly eMax: number
  readonly eMinLev: readonly number[]
  readonly eMaxLev: readonly number[]
  readonly eLen: number
  readonly eLevLen: readonly number[]
  readonly toHit: number
  readonly toHitLev: number
  readonly toHitCalc?: string | undefined
  readonly auraLenCalc?: string | undefined
  readonly startmana: number
  readonly params: Readonly<Record<string, number | undefined>>
  readonly synergyFormulas: {
    readonly physical?: string | undefined
    readonly elemental?: string | undefined
    readonly duration?: string | undefined
  }
  readonly synergiesReceived: readonly SynergyBonusInfo[]
  readonly synergiesGiven: readonly SynergyGivenInfo[]
  readonly masteries: readonly number[]
  readonly descLines?: readonly DescLineDefinition[] | undefined
  readonly dsc2Lines?: readonly DescLineDefinition[] | undefined
  readonly minionStats?: MinionBaseStats | undefined
  readonly shortDesc: string
  readonly shortDescZh: string
  readonly longDesc: string
  readonly longDescZh: string
  readonly icon: string
  readonly iconActive: string
}

export const SKILLS_CATALOG: readonly SkillCatalogEntry[] = Object.freeze(${JSON.stringify(updatedCatalog, null, 2)})

export const SKILLS_BY_ID: Readonly<Record<number, SkillCatalogEntry>> = Object.freeze(
  SKILLS_CATALOG.reduce<Record<number, SkillCatalogEntry>>((acc, cur) => {
    acc[cur.id] = cur
    return acc
  }, {})
)

export const SKILLS_BY_CLASS: Readonly<Record<CharacterClassCode, readonly SkillCatalogEntry[]>> = Object.freeze({
  ama: SKILLS_CATALOG.filter(s => s.classCode === 'ama'),
  sor: SKILLS_CATALOG.filter(s => s.classCode === 'sor'),
  nec: SKILLS_CATALOG.filter(s => s.classCode === 'nec'),
  pal: SKILLS_CATALOG.filter(s => s.classCode === 'pal'),
  bar: SKILLS_CATALOG.filter(s => s.classCode === 'bar'),
  dru: SKILLS_CATALOG.filter(s => s.classCode === 'dru'),
  ass: SKILLS_CATALOG.filter(s => s.classCode === 'ass'),
})
`

  const outPath = join(process.cwd(), 'src', 'common', 'data', 'skills-catalog.ts')
  writeFileSync(outPath, tsContent, 'utf-8')
  console.log(`Successfully updated ${outPath} with 1.13c ToHit and auraLenCalc!`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
