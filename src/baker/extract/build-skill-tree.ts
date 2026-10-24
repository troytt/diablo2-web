import * as fs from 'fs'
import { MountedArchives } from '../../common/mpq/mount.ts'
import { MpqArchive } from '../../common/mpq/archive.ts'
import { fileSource } from '../io/file-source.ts'
import { parseTable, cell } from '../../common/world/acts.ts'

async function run() {
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    archives.add(name, await MpqArchive.open(await fileSource('samples/d2/' + name)))
  }
  const skills = parseTable(await archives.read('data\\global\\excel\\Skills.txt'))
  const desc = parseTable(await archives.read('data\\global\\excel\\SkillDesc.txt'))

  const descMap = new Map<string, { page: number; row: number; col: number }>()
  for (const r of desc.rows) {
    const key = cell(desc, r, 'skilldesc')
    if (key) {
      descMap.set(key, {
        page: Number(cell(desc, r, 'SkillPage')),
        row: Number(cell(desc, r, 'SkillRow')),
        col: Number(cell(desc, r, 'SkillColumn')),
      })
    }
  }

  const nameToId = new Map<string, number>()
  for (const r of skills.rows) {
    nameToId.set(cell(skills, r, 'skill').toLowerCase(), Number(cell(skills, r, 'Id')))
  }

  const tabNames: Record<string, string[]> = {
    ama: ['Bow and Crossbow Skills', 'Passive and Magic Skills', 'Javelin and Spear Skills'],
    sor: ['Fire Spells', 'Lightning Spells', 'Cold Spells'],
    nec: ['Curses', 'Poison and Bone Spells', 'Summoning Spells'],
    pal: ['Combat Skills', 'Offensive Auras', 'Defensive Auras'],
    bar: ['Combat Skills', 'Combat Masteries', 'Warcries'],
    dru: ['Summoning', 'Shape Shifting', 'Elemental'],
    ass: ['Traps', 'Shadow Disciplines', 'Martial Arts'],
  }

  const classes = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
  const nodes: any[] = []
  const paramsMap: Record<number, any> = {}

  for (const r of skills.rows) {
    const cls = cell(skills, r, 'charclass')
    if (!classes.includes(cls)) continue

    const id = Number(cell(skills, r, 'Id'))
    const name = cell(skills, r, 'skill')
    const descKey = cell(skills, r, 'skilldesc')
    const d = descMap.get(descKey) || { page: 1, row: 1, col: 1 }
    const tabIndex = d.page - 1
    const tabName = tabNames[cls][tabIndex]
    const reqlevel = Number(cell(skills, r, 'reqlevel') || 1)

    const reqskills: number[] = []
    for (const reqCol of ['reqskill1', 'reqskill2', 'reqskill3']) {
      const s = cell(skills, r, reqCol)
      if (s) {
        const reqId = nameToId.get(s.toLowerCase())
        if (reqId !== undefined) reqskills.push(reqId)
      }
    }

    const p = cell(skills, r, 'DmgSymPerCalc') || undefined
    const e = cell(skills, r, 'EDmgSymPerCalc') || undefined
    const len = cell(skills, r, 'ELenSymPerCalc') || undefined

    const par8 = cell(skills, r, 'Param8') ? Number(cell(skills, r, 'Param8')) : undefined
    const par7 = cell(skills, r, 'Param7') ? Number(cell(skills, r, 'Param7')) : undefined
    const par6 = cell(skills, r, 'Param6') ? Number(cell(skills, r, 'Param6')) : undefined
    const par5 = cell(skills, r, 'Param5') ? Number(cell(skills, r, 'Param5')) : undefined

    if (par8 !== undefined || par7 !== undefined || par6 !== undefined || par5 !== undefined) {
      paramsMap[id] = { par8, par7, par6, par5 }
    }

    nodes.push({
      id,
      name,
      classCode: cls,
      tabIndex,
      tabName,
      row: d.row,
      col: d.col,
      reqlevel,
      reqskills,
      dependents: [] as number[],
      synergyFormulas: {
        physical: p,
        elemental: e,
        duration: len,
      },
      params: (par8 !== undefined || par7 !== undefined || par6 !== undefined || par5 !== undefined)
        ? { par8, par7, par6, par5 }
        : undefined,
    })
  }

  // Populate dependents
  const nodeMap = new Map<number, any>(nodes.map(n => [n.id, n]))
  for (const node of nodes) {
    for (const reqId of node.reqskills) {
      const parent = nodeMap.get(reqId)
      if (parent) {
        parent.dependents.push(node.id)
      }
    }
  }

  console.log(`Successfully parsed ${nodes.length} skills, ${Object.keys(paramsMap).length} skills with params`)
  fs.writeFileSync('scratch/skills_tree_data.json', JSON.stringify({ nodes, paramsMap }, null, 2))
}
run()
