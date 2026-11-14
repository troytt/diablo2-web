import * as fs from 'fs'

function generate() {
  const rawData = JSON.parse(fs.readFileSync('scratch/skills_tree_data.json', 'utf8'))
  const nodes = rawData.nodes
  const paramsMap = rawData.paramsMap

  const content = `/**
 * Canonical 210-Skill Tree System, Prerequisite DAG, and Synergy Engine for Diablo II (v1.13c).
 *
 * Ground truth reference:
 * - D2Common.dll (0x6fd70000)
 * - data\\global\\excel\\Skills.txt (357 rows, IDs 6..35, 36..65, 66..95, 96..125, 126..155, 221..250, 251..280)
 * - data\\global\\excel\\SkillDesc.txt (221 rows, grid placement and tabs)
 * - docs\\d2kb\\kb_440_Skills.txt.txt (synergy math, DmgSymPerCalc, EDmgSymPerCalc, ELenSymPerCalc)
 * - docs\\d2kb\\kb_371_Formulae_Guide_by_Xeno_and_Kingpin.txt (blvl base points invariant)
 */

import type { CharacterClassCode } from '../units/classes.ts'
import type { D2Table } from '../world/acts.ts'
import { cell } from '../world/acts.ts'

export type { CharacterClassCode }

/** Canonical node representing a single skill in the skill tree. */
export interface SkillNode {
  readonly id: number
  readonly name: string
  readonly classCode: CharacterClassCode
  readonly tabIndex: number // 0..2
  readonly tabName: string
  readonly row: number // 1..6
  readonly col: number // 1..3
  readonly reqlevel: number
  readonly reqskills: readonly number[]
  readonly dependents: readonly number[]
  readonly synergyFormulas: {
    readonly physical?: string | undefined
    readonly elemental?: string | undefined
    readonly duration?: string | undefined
  }
  readonly params?: {
    readonly par8?: number | undefined
    readonly par7?: number | undefined
    readonly par6?: number | undefined
    readonly par5?: number | undefined
  } | undefined
}

/** State tracking invested hard points and unspent skill points for a character. */
export interface SkillTreeState {
  readonly hardPoints: Record<number, number> // skillId -> 0..20 hard points (blvl)
  unspentPoints: number
}

/** Skill tree catalog: array, record, or map of skill nodes. */
export type SkillTreeCatalog =
  | readonly SkillNode[]
  | Record<number, SkillNode>
  | Map<number, SkillNode>
  | ReadonlyMap<number, SkillNode>

/** Canonical Skill Tabs per class (3 tabs each). */
export const CANONICAL_SKILL_TABS: Readonly<Record<CharacterClassCode, readonly string[]>> = Object.freeze({
  ama: ['Bow and Crossbow Skills', 'Passive and Magic Skills', 'Javelin and Spear Skills'],
  sor: ['Fire Spells', 'Lightning Spells', 'Cold Spells'],
  nec: ['Curses', 'Poison and Bone Spells', 'Summoning Spells'],
  pal: ['Combat Skills', 'Offensive Auras', 'Defensive Auras'],
  bar: ['Combat Skills', 'Combat Masteries', 'Warcries'],
  dru: ['Summoning', 'Shape Shifting', 'Elemental'],
  ass: ['Traps', 'Shadow Disciplines', 'Martial Arts'],
})

/** Canonical synergy parameters (par8, par7, par6, par5) from 1.13c Skills.txt. */
export const CANONICAL_SKILL_PARAMS: Readonly<Record<number, {
  readonly par8?: number
  readonly par7?: number
  readonly par6?: number
  readonly par5?: number
}>> = Object.freeze(${JSON.stringify(paramsMap, null, 2)})

/** Canonical 210 skills tree catalog embedded for hermetic zero-IO execution. */
export const CANONICAL_SKILL_TREE: readonly SkillNode[] = Object.freeze([
${nodes
  .map(
    (n: any) =>
      `  Object.freeze({\n    id: ${n.id},\n    name: ${JSON.stringify(n.name)},\n    classCode: ${JSON.stringify(
        n.classCode
      )} as CharacterClassCode,\n    tabIndex: ${n.tabIndex},\n    tabName: ${JSON.stringify(
        n.tabName
      )},\n    row: ${n.row},\n    col: ${n.col},\n    reqlevel: ${n.reqlevel},\n    reqskills: Object.freeze(${JSON.stringify(
        n.reqskills
      )}),\n    dependents: Object.freeze(${JSON.stringify(
        n.dependents
      )}),\n    synergyFormulas: Object.freeze({\n      physical: ${
        n.synergyFormulas.physical ? JSON.stringify(n.synergyFormulas.physical) : 'undefined'
      },\n      elemental: ${
        n.synergyFormulas.elemental ? JSON.stringify(n.synergyFormulas.elemental) : 'undefined'
      },\n      duration: ${
        n.synergyFormulas.duration ? JSON.stringify(n.synergyFormulas.duration) : 'undefined'
      },\n    }),\n    params: ${
        n.params ? `Object.freeze(${JSON.stringify(n.params)})` : 'undefined'
      },\n  })`
  )
  .join(',\n')}
])

/** Canonical lookup map: skillId -> SkillNode */
export const CANONICAL_SKILL_MAP: ReadonlyMap<number, SkillNode> = new Map(
  CANONICAL_SKILL_TREE.map(node => [node.id, node])
)

/**
 * Normalizes any SkillTreeCatalog representation into a standard Map<number, SkillNode>.
 */
export function asCatalogMap(tree: SkillTreeCatalog): Map<number, SkillNode> {
  if (tree instanceof Map) {
    return tree as Map<number, SkillNode>
  }
  const map = new Map<number, SkillNode>()
  if (Array.isArray(tree)) {
    for (const node of tree) {
      map.set(node.id, node)
    }
  } else {
    for (const key of Object.keys(tree)) {
      const id = Number(key)
      if (!Number.isNaN(id)) {
        map.set(id, (tree as Record<number, SkillNode>)[id])
      }
    }
  }
  return map
}

/**
 * Retrieves a skill node by its numeric ID.
 */
export function getSkillNode(tree: SkillTreeCatalog, skillId: number): SkillNode | undefined {
  if (tree instanceof Map) return tree.get(skillId)
  if (Array.isArray(tree)) return tree.find(n => n.id === skillId)
  return (tree as Record<number, SkillNode>)[skillId]
}

/**
 * Returns all skills belonging to a given character class.
 */
export function getSkillsForClass(
  tree: SkillTreeCatalog,
  classCode: CharacterClassCode
): readonly SkillNode[] {
  const map = asCatalogMap(tree)
  const result: SkillNode[] = []
  for (const node of map.values()) {
    if (node.classCode === classCode) {
      result.push(node)
    }
  }
  return result
}

/**
 * Returns all skills belonging to a specific class tab (0..2).
 */
export function getSkillsForTab(
  tree: SkillTreeCatalog,
  classCode: CharacterClassCode,
  tabIndex: number
): readonly SkillNode[] {
  const map = asCatalogMap(tree)
  const result: SkillNode[] = []
  for (const node of map.values()) {
    if (node.classCode === classCode && node.tabIndex === tabIndex) {
      result.push(node)
    }
  }
  return result
}

/**
 * Creates a clean skill tree state with the specified number of unspent points.
 */
export function createSkillTreeState(unspentPoints: number = 0): SkillTreeState {
  return {
    hardPoints: {},
    unspentPoints: Math.max(0, unspentPoints),
  }
}

/**
 * Checks whether a character can allocate a hard point into a skill.
 *
 * Rules:
 * 1. Must have at least 1 unspent skill point.
 * 2. Player level must be >= skill.reqlevel.
 * 3. Hard points invested cannot exceed 20.
 * 4. All direct prerequisites (reqskills) must have at least 1 allocated hard point.
 */
export function canAllocate(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  playerLevel: number
): boolean {
  if (state.unspentPoints <= 0) return false
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return false
  if (playerLevel < node.reqlevel) return false
  const currentPoints = state.hardPoints[skillId] ?? 0
  if (currentPoints >= 20) return false
  for (const prereqId of node.reqskills) {
    if ((state.hardPoints[prereqId] ?? 0) < 1) return false
  }
  return true
}

/**
 * Allocates 1 hard point into the target skill if eligible, deducting from unspent points.
 * Returns true if successful, false otherwise.
 */
export function allocatePoint(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  playerLevel: number
): boolean {
  if (!canAllocate(tree, state, skillId, playerLevel)) return false
  state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) + 1
  state.unspentPoints -= 1
  return true
}

/**
 * Checks whether a skill point can be safely deallocated.
 *
 * Rules:
 * 1. Skill must currently have at least 1 hard point.
 * 2. If dropping from > 1 points, deallocation is always valid.
 * 3. If dropping from 1 to 0 points, no skill that depends on this skill
 *    (in its transitive prerequisite chain) can have any allocated hard points.
 */
export function canDeallocate(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number
): boolean {
  const currentPoints = state.hardPoints[skillId] ?? 0
  if (currentPoints <= 0) return false
  if (currentPoints > 1) return true

  // Dropping from 1 to 0: verify no transitive dependent has invested points
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return true

  const visited = new Set<number>()
  const queue = [...node.dependents]
  while (queue.length > 0) {
    const depId = queue.shift()!
    if (visited.has(depId)) continue
    visited.add(depId)
    if ((state.hardPoints[depId] ?? 0) > 0) return false
    const depNode = map.get(depId)
    if (depNode) {
      queue.push(...depNode.dependents)
    }
  }

  return true
}

/**
 * Deallocates 1 point from the target skill if valid, returning it to unspent points.
 * Returns true if successful, false otherwise.
 */
export function deallocatePoint(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number
): boolean {
  if (!canDeallocate(tree, state, skillId)) return false
  state.hardPoints[skillId] = (state.hardPoints[skillId] ?? 0) - 1
  state.unspentPoints += 1
  return true
}

/**
 * Resets all allocated skill points to 0 and refunds them to unspent points.
 * Returns the total number of refunded skill points.
 */
export function respec(state: SkillTreeState): number {
  let refunded = 0
  for (const skillIdStr of Object.keys(state.hardPoints)) {
    const id = Number(skillIdStr)
    const pts = state.hardPoints[id] ?? 0
    refunded += pts
    state.hardPoints[id] = 0
  }
  state.unspentPoints += refunded
  return refunded
}

/**
 * Evaluates 1.13c synergy formulas strictly against base allocated hard points (blvl).
 *
 * Invariants:
 * 1. Only physically allocated base points (blvl, 0..20) are counted. Soft points (+skills)
 *    from equipment, charms, or buffs MUST NOT alter synergy calculations.
 * 2. Formulas support expressions such as:
 *    (skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8
 * 3. Tolerates unclosed parentheses (e.g. Fire Wall '(skill(\\'Warmth\\'.blvl)*par8+skill(\\'Inferno\\'.blvl)*par7').
 * 4. Gracefully falls back to 1.0 (no bonus) on empty or malformed syntax without throwing exceptions.
 */
export function calculateSynergyMultiplier(
  tree: SkillTreeCatalog,
  state: SkillTreeState,
  skillId: number,
  damageType: 'physical' | 'elemental' | 'duration' = 'elemental'
): number {
  const map = asCatalogMap(tree)
  const node = map.get(skillId)
  if (!node) return 1.0

  const formula = damageType === 'physical'
    ? node.synergyFormulas.physical
    : damageType === 'duration'
      ? node.synergyFormulas.duration
      : node.synergyFormulas.elemental

  if (!formula || formula.trim() === '' || formula.trim() === '-') return 1.0

  // Build name lookup map
  const nameToId = new Map<string, number>()
  for (const [id, s] of map.entries()) {
    nameToId.set(s.name.trim().toLowerCase(), id)
  }

  try {
    let sanitized = formula

    // Substitute skill('<Name>'.blvl) with hard points
    const regex = /skill\\(\\s*['"]([^'"]+)['"]\\s*\\.blvl\\s*\\)/gi
    sanitized = sanitized.replace(regex, (_match, skillName: string) => {
      const targetId = nameToId.get(skillName.trim().toLowerCase())
      if (targetId === undefined) return '0'
      const basePoints = Math.max(0, Math.min(20, state.hardPoints[targetId] ?? 0))
      return String(basePoints)
    })

    // Resolve parameter multipliers
    const paramOverrides = (node as any).params
    const canonParams = CANONICAL_SKILL_PARAMS[node.id]

    const p8 = (node as any).param8 ?? paramOverrides?.par8 ?? canonParams?.par8 ?? 16
    const p7 = (node as any).param7 ?? paramOverrides?.par7 ?? canonParams?.par7 ?? 8
    const p6 = (node as any).param6 ?? paramOverrides?.par6 ?? canonParams?.par6 ?? 5
    const p5 = (node as any).param5 ?? paramOverrides?.par5 ?? canonParams?.par5 ?? 0

    sanitized = sanitized.replace(/\\bpar8\\b/gi, String(p8))
    sanitized = sanitized.replace(/\\bpar7\\b/gi, String(p7))
    sanitized = sanitized.replace(/\\bpar6\\b/gi, String(p6))
    sanitized = sanitized.replace(/\\bpar5\\b/gi, String(p5))

    // Resilience: balance unclosed parentheses
    const openCount = (sanitized.match(/\\(/g) || []).length
    const closeCount = (sanitized.match(/\\)/g) || []).length
    if (openCount > closeCount) {
      sanitized += ')'.repeat(openCount - closeCount)
    } else if (closeCount > openCount) {
      sanitized = '('.repeat(closeCount - openCount) + sanitized
    }

    // Strict validation: arithmetic characters only (- placed at start to avoid range)
    if (!/^[-+0-9*/().\\s]+$/.test(sanitized)) {
      return 1.0
    }

    const bonusPct = evalBasicArithmetic(sanitized)
    if (typeof bonusPct !== 'number' || !Number.isFinite(bonusPct) || bonusPct <= 0) {
      return 1.0
    }

    return 1.0 + bonusPct / 100.0
  } catch {
    return 1.0
  }
}

function evalBasicArithmetic(input: string): number {
  let pos = 0
  const len = input.length

  const skipWs = (): void => {
    while (pos < len && /\\s/.test(input[pos]!)) pos++
  }

  const parseExpr = (): number => {
    let val = parseTerm()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '+') {
        pos++
        val += parseTerm()
      } else if (ch === '-') {
        pos++
        val -= parseTerm()
      } else {
        break
      }
    }
    return val
  }

  const parseTerm = (): number => {
    let val = parseFactor()
    while (true) {
      skipWs()
      const ch = input[pos]
      if (ch === '*') {
        pos++
        val *= parseFactor()
      } else if (ch === '/') {
        pos++
        const denom = parseFactor()
        val = denom === 0 ? NaN : val / denom
      } else {
        break
      }
    }
    return val
  }

  const parseFactor = (): number => {
    skipWs()
    if (pos >= len) return NaN
    const ch = input[pos]!
    if (ch === '+') {
      pos++
      return +parseFactor()
    }
    if (ch === '-') {
      pos++
      return -parseFactor()
    }
    if (ch === '(') {
      pos++
      const val = parseExpr()
      skipWs()
      if (input[pos] !== ')') return NaN
      pos++
      return val
    }
    const numMatch = /^[0-9]+(?:\\.[0-9]+)?/.exec(input.slice(pos))
    if (numMatch) {
      pos += numMatch[0].length
      return Number(numMatch[0])
    }
    return NaN
  }

  const result = parseExpr()
  skipWs()
  if (pos !== len) return NaN
  return result
}

/**
 * Validates prerequisite DAG integrity:
 * - 0 cycles (strictly acyclic)
 * - 0 level inversions (parent reqlevel <= child reqlevel)
 * - 0 unresolved prerequisite dependencies
 */
export function validatePrerequisiteDAG(tree: SkillTreeCatalog): {
  valid: boolean
  cycles: number[]
  inversions: Array<{ parent: number; child: number; parentLevel: number; childLevel: number }>
  unresolved: Array<{ skillId: number; missingReq: number }>
} {
  const map = asCatalogMap(tree)
  const nodes = Array.from(map.values())

  const inDegree = new Map<number, number>()
  const adj = new Map<number, number[]>()
  const unresolved: Array<{ skillId: number; missingReq: number }> = []
  const inversions: Array<{ parent: number; child: number; parentLevel: number; childLevel: number }> = []

  for (const node of nodes) {
    inDegree.set(node.id, node.reqskills.length)
    if (!adj.has(node.id)) adj.set(node.id, [])
  }

  for (const node of nodes) {
    for (const reqId of node.reqskills) {
      const parent = map.get(reqId)
      if (!parent) {
        unresolved.push({ skillId: node.id, missingReq: reqId })
      } else {
        if (parent.reqlevel > node.reqlevel) {
          inversions.push({
            parent: parent.id,
            child: node.id,
            parentLevel: parent.reqlevel,
            childLevel: node.reqlevel,
          })
        }
        if (!adj.has(reqId)) adj.set(reqId, [])
        adj.get(reqId)!.push(node.id)
      }
    }
  }

  // Kahn's algorithm for topological sorting
  const queue: number[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  let processedCount = 0
  while (queue.length > 0) {
    const u = queue.shift()!
    processedCount++
    for (const v of adj.get(u) || []) {
      const cur = inDegree.get(v)! - 1
      inDegree.set(v, cur)
      if (cur === 0) queue.push(v)
    }
  }

  const cycleNodeIds: number[] = []
  if (processedCount < nodes.length) {
    for (const [id, deg] of inDegree.entries()) {
      if (deg > 0) cycleNodeIds.push(id)
    }
  }

  const valid = cycleNodeIds.length === 0 && inversions.length === 0 && unresolved.length === 0

  return {
    valid,
    cycles: cycleNodeIds,
    inversions,
    unresolved,
  }
}

/**
 * Parses skill tree nodes dynamically from 1.13c Skills.txt and SkillDesc.txt tables.
 */
export function parseSkillTreeTable(skillsTable: D2Table, skilldescTable: D2Table): SkillNode[] {
  const descMap = new Map<string, { page: number; row: number; col: number }>()
  for (const r of skilldescTable.rows) {
    const key = cell(skilldescTable, r, 'skilldesc')
    if (key) {
      descMap.set(key, {
        page: Number(cell(skilldescTable, r, 'SkillPage')),
        row: Number(cell(skilldescTable, r, 'SkillRow')),
        col: Number(cell(skilldescTable, r, 'SkillColumn')),
      })
    }
  }

  const nameToId = new Map<string, number>()
  for (const r of skillsTable.rows) {
    const id = Number(cell(skillsTable, r, 'Id'))
    const name = cell(skillsTable, r, 'skill')
    nameToId.set(name.toLowerCase(), id)
  }

  const classCodes: CharacterClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
  const nodes: SkillNode[] = []

  for (const r of skillsTable.rows) {
    const charclass = cell(skillsTable, r, 'charclass') as CharacterClassCode
    if (!classCodes.includes(charclass)) continue

    const id = Number(cell(skillsTable, r, 'Id'))
    const name = cell(skillsTable, r, 'skill')
    const descKey = cell(skillsTable, r, 'skilldesc')
    const desc = descMap.get(descKey) ?? { page: 1, row: 1, col: 1 }
    const tabIndex = desc.page - 1
    const tabName = CANONICAL_SKILL_TABS[charclass][tabIndex] ?? ''
    const reqlevel = Number(cell(skillsTable, r, 'reqlevel') || 1)

    const reqskills: number[] = []
    for (const reqCol of ['reqskill1', 'reqskill2', 'reqskill3']) {
      const reqName = cell(skillsTable, r, reqCol)
      if (reqName) {
        const reqId = nameToId.get(reqName.toLowerCase())
        if (reqId !== undefined && reqId > 0) {
          reqskills.push(reqId)
        }
      }
    }

    const physical = cell(skillsTable, r, 'DmgSymPerCalc') || undefined
    const elemental = cell(skillsTable, r, 'EDmgSymPerCalc') || undefined
    const duration = cell(skillsTable, r, 'ELenSymPerCalc') || undefined

    const par8 = cell(skillsTable, r, 'Param8') ? Number(cell(skillsTable, r, 'Param8')) : undefined
    const par7 = cell(skillsTable, r, 'Param7') ? Number(cell(skillsTable, r, 'Param7')) : undefined
    const par6 = cell(skillsTable, r, 'Param6') ? Number(cell(skillsTable, r, 'Param6')) : undefined
    const par5 = cell(skillsTable, r, 'Param5') ? Number(cell(skillsTable, r, 'Param5')) : undefined

    nodes.push({
      id,
      name,
      classCode: charclass,
      tabIndex,
      tabName,
      row: desc.row,
      col: desc.col,
      reqlevel,
      reqskills: Object.freeze(reqskills),
      dependents: [],
      synergyFormulas: Object.freeze({ physical, elemental, duration }),
      params: (par8 !== undefined || par7 !== undefined || par6 !== undefined || par5 !== undefined)
        ? Object.freeze({ par8, par7, par6, par5 })
        : undefined,
    })
  }

  // Populate dependents
  const nodeMap = new Map<number, SkillNode>(nodes.map(n => [n.id, n]))
  for (const node of nodes) {
    for (const reqId of node.reqskills) {
      const parent = nodeMap.get(reqId)
      if (parent) {
        ;(parent.dependents as number[]).push(node.id)
      }
    }
  }

  return nodes
}
`

  fs.writeFileSync('src/common/skills/skill-tree.ts', content, 'utf8')
  console.log('Successfully wrote src/common/skills/skill-tree.ts')
}

generate()
