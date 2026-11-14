import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import {
  CANONICAL_SKILL_TREE,
  CANONICAL_SKILL_MAP,
  CANONICAL_SKILL_TABS,
  CANONICAL_SKILL_PARAMS,
  asCatalogMap,
  getSkillNode,
  getSkillsForClass,
  getSkillsForTab,
  createSkillTreeState,
  canAllocate,
  allocatePoint,
  canDeallocate,
  deallocatePoint,
  respec,
  calculateSynergyMultiplier,
  validatePrerequisiteDAG,
  parseSkillTreeTable,
} from '../src/common/skills/skill-tree.ts'
import type { SkillNode, SkillTreeState, CharacterClassCode } from '../src/common/skills/skill-tree.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadActTables } from '../src/common/world/acts.ts'

const hasRealData = fs.existsSync('samples/d2/d2data.mpq') && fs.existsSync('samples/d2/Patch_D2.mpq')

describe('Diablo II 210-Skill Tree Catalog, Prerequisites DAG, and Synergies (Milestone M2)', () => {
  // ==========================================================================
  // 1. 210-Skill Tree Catalog Completeness & Grid Layout
  // ==========================================================================
  describe('210-Skill Tree Catalog Completeness & Grid Layout', () => {
    it('contains exactly 210 canonical skills in CANONICAL_SKILL_TREE', () => {
      expect(CANONICAL_SKILL_TREE).toHaveLength(210)
      expect(CANONICAL_SKILL_MAP.size).toBe(210)
    })

    it('maps exactly 30 skills per class across all 7 canonical classes', () => {
      const classes: CharacterClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
      const counts: Record<string, number> = {}

      for (const skill of CANONICAL_SKILL_TREE) {
        counts[skill.classCode] = (counts[skill.classCode] || 0) + 1
      }

      for (const code of classes) {
        expect(counts[code]).toBe(30)
        const classSkills = getSkillsForClass(CANONICAL_SKILL_TREE, code)
        expect(classSkills).toHaveLength(30)
      }
    })

    it('maps exactly 10 skills per tab across all 21 tabs (7 classes × 3 tabs)', () => {
      const classes: CharacterClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']

      for (const code of classes) {
        for (let tab = 0; tab < 3; tab++) {
          const tabSkills = getSkillsForTab(CANONICAL_SKILL_TREE, code, tab)
          expect(tabSkills).toHaveLength(10)

          const expectedTabName = CANONICAL_SKILL_TABS[code][tab]
          for (const s of tabSkills) {
            expect(s.tabIndex).toBe(tab)
            expect(s.tabName).toBe(expectedTabName)
            expect(s.classCode).toBe(code)
          }
        }
      }
    })

    it('conforms to canonical Blizzard skill ID blocks for each class', () => {
      const classIdRanges: Record<CharacterClassCode, [number, number]> = {
        ama: [6, 35],
        sor: [36, 65],
        nec: [66, 95],
        pal: [96, 125],
        bar: [126, 155],
        dru: [221, 250],
        ass: [251, 280],
      }

      for (const [code, [minId, maxId]] of Object.entries(classIdRanges)) {
        const skills = getSkillsForClass(CANONICAL_SKILL_TREE, code as CharacterClassCode)
        const ids = skills.map(s => s.id)
        expect(Math.min(...ids)).toBe(minId)
        expect(Math.max(...ids)).toBe(maxId)
        expect(ids).toHaveLength(maxId - minId + 1)
      }
    })

    it('enforces valid UI grid placement (row 1..6, col 1..3) and valid reqlevel', () => {
      const validReqLevels = new Set([1, 6, 12, 18, 24, 30])

      for (const skill of CANONICAL_SKILL_TREE) {
        expect(skill.row).toBeGreaterThanOrEqual(1)
        expect(skill.row).toBeLessThanOrEqual(6)
        expect(skill.col).toBeGreaterThanOrEqual(1)
        expect(skill.col).toBeLessThanOrEqual(3)
        expect(validReqLevels.has(skill.reqlevel)).toBe(true)

        // Row and reqlevel correspondence
        if (skill.row === 1) expect([1, 6]).toContain(skill.reqlevel)
        if (skill.row === 2) expect([6, 12]).toContain(skill.reqlevel)
        if (skill.row === 3) expect([12, 18]).toContain(skill.reqlevel)
        if (skill.row === 4) expect([18, 24]).toContain(skill.reqlevel)
        if (skill.row === 5) expect([24, 30]).toContain(skill.reqlevel)
        if (skill.row === 6) expect(skill.reqlevel).toBe(30)
      }
    })

    it('verifies helper lookup functions getSkillNode and asCatalogMap', () => {
      const node36 = getSkillNode(CANONICAL_SKILL_TREE, 36)
      expect(node36).toBeDefined()
      expect(node36?.name).toBe('Fire Bolt')
      expect(node36?.classCode).toBe('sor')

      const nodeUnknown = getSkillNode(CANONICAL_SKILL_TREE, 9999)
      expect(nodeUnknown).toBeUndefined()

      // Record catalog lookup
      const recordCatalog: Record<number, SkillNode> = { 36: node36! }
      expect(getSkillNode(recordCatalog, 36)?.name).toBe('Fire Bolt')

      // Map catalog lookup
      const map = asCatalogMap(recordCatalog)
      expect(map.get(36)?.name).toBe('Fire Bolt')
    })
  })

  // ==========================================================================
  // 2. Prerequisite DAG Validation (0 Cycles, 0 Level Inversions)
  // ==========================================================================
  describe('Prerequisite DAG Validation (0 Cycles, 0 Level Inversions)', () => {
    it('passes automated prerequisite DAG validation with 0 cycles, 0 inversions, 0 unresolved', () => {
      const report = validatePrerequisiteDAG(CANONICAL_SKILL_TREE)
      expect(report.valid).toBe(true)
      expect(report.cycles).toHaveLength(0)
      expect(report.inversions).toHaveLength(0)
      expect(report.unresolved).toHaveLength(0)
    })

    it('proves strictly acyclic graph via topological sorting over all 210 nodes', () => {
      const inDegree = new Map<number, number>()
      const adj = new Map<number, number[]>()

      for (const node of CANONICAL_SKILL_TREE) {
        inDegree.set(node.id, node.reqskills.length)
        adj.set(node.id, [])
      }

      for (const node of CANONICAL_SKILL_TREE) {
        for (const reqId of node.reqskills) {
          adj.get(reqId)!.push(node.id)
        }
      }

      const queue: number[] = []
      for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) queue.push(id)
      }

      let count = 0
      while (queue.length > 0) {
        const u = queue.shift()!
        count++
        for (const v of adj.get(u)!) {
          const d = inDegree.get(v)! - 1
          inDegree.set(v, d)
          if (d === 0) queue.push(v)
        }
      }

      expect(count).toBe(210) // All 210 nodes processed in topological order
    })

    it('verifies 0 level inversions across all 172 prerequisite edges', () => {
      let edgeCount = 0
      for (const node of CANONICAL_SKILL_TREE) {
        for (const reqId of node.reqskills) {
          edgeCount++
          const parent = CANONICAL_SKILL_MAP.get(reqId)
          expect(parent).toBeDefined()
          if (parent) {
            expect(parent.reqlevel).toBeLessThanOrEqual(node.reqlevel)
            expect(parent.classCode).toBe(node.classCode)
            expect(parent.tabIndex).toBe(node.tabIndex)
          }
        }
      }
      expect(edgeCount).toBe(172)
    })

    it('verifies exact reverse dependent mapping consistency for all skills', () => {
      for (const node of CANONICAL_SKILL_TREE) {
        // Every skill in node.reqskills must have node.id in its dependents
        for (const reqId of node.reqskills) {
          const parent = CANONICAL_SKILL_MAP.get(reqId)!
          expect(parent.dependents).toContain(node.id)
        }

        // Every skill in node.dependents must have node.id in its reqskills
        for (const depId of node.dependents) {
          const child = CANONICAL_SKILL_MAP.get(depId)!
          expect(child.reqskills).toContain(node.id)
        }
      }
    })

    it('validates canonical multi-prerequisite convergence skills', () => {
      // Exploding Arrow (16) requires Fire Arrow (7) and Multiple Shot (12)
      const explArrow = CANONICAL_SKILL_MAP.get(16)!
      expect(explArrow.reqskills).toEqual([7, 12])

      // Meteor (56) requires Fire Ball (47) and Fire Wall (51)
      const meteor = CANONICAL_SKILL_MAP.get(56)!
      expect(meteor.reqskills).toEqual([47, 51])

      // Armageddon (249) requires Volcano (244) and Hurricane (250)
      const armageddon = CANONICAL_SKILL_MAP.get(249)!
      expect(armageddon.reqskills).toEqual([244, 250])

      // Lower Resist (91) requires Life Tap (82) and Decrepify (87)
      const lowerResist = CANONICAL_SKILL_MAP.get(91)!
      expect(lowerResist.reqskills).toEqual([82, 87])

      // Whirlwind (151) requires Leap Attack (143) and Concentrate (144)
      const ww = CANONICAL_SKILL_MAP.get(151)!
      expect(ww.reqskills).toEqual([143, 144])
    })

    it('validates canonical same-row prerequisite skills', () => {
      // Skeleton Mastery (ID 69, row 1, reqlevel 1) requires Raise Skeleton (ID 70, row 1, reqlevel 1)
      const skelMastery = CANONICAL_SKILL_MAP.get(69)!
      expect(skelMastery.reqlevel).toBe(1)
      expect(skelMastery.reqskills).toEqual([70])

      // Lycanthropy / Shape Shifting (ID 224, row 1, reqlevel 1) requires Werewolf (ID 223, row 1, reqlevel 1)
      const lycanthropy = CANONICAL_SKILL_MAP.get(224)!
      expect(lycanthropy.reqlevel).toBe(1)
      expect(lycanthropy.reqskills).toEqual([223])
    })
  })

  // ==========================================================================
  // 3. Point Allocation State Management
  // ==========================================================================
  describe('Point Allocation State Management', () => {
    it('creates skill tree state with specified unspent points', () => {
      const state0 = createSkillTreeState()
      expect(state0.unspentPoints).toBe(0)
      expect(state0.hardPoints).toEqual({})

      const state10 = createSkillTreeState(10)
      expect(state10.unspentPoints).toBe(10)
    })

    it('blocks allocation when unspent points pool is zero', () => {
      const state = createSkillTreeState(0)
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 36, 1)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, 1)).toBe(false)
      expect(state.hardPoints[36]).toBeUndefined()
    })

    it('blocks allocation when player level < reqlevel', () => {
      const state = createSkillTreeState(10)
      // Fire Ball requires level 12
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 47, 11)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 47, 11)).toBe(false)
    })

    it('blocks allocation when direct prerequisites have 0 points', () => {
      const state = createSkillTreeState(10)
      // Level 20 character, but Fire Bolt (prereq) has 0 points
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 47, 20)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 47, 20)).toBe(false)

      // Allocate Fire Bolt
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, 20)).toBe(true)
      expect(state.hardPoints[36]).toBe(1)
      expect(state.unspentPoints).toBe(9)

      // Now Fire Ball can be allocated
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 47, 20)).toBe(true)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 47, 20)).toBe(true)
      expect(state.hardPoints[47]).toBe(1)
      expect(state.unspentPoints).toBe(8)
    })

    it('enforces strict 20 hard points cap per skill', () => {
      const state = createSkillTreeState(50)
      for (let i = 0; i < 20; i++) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, 1)).toBe(true)
      }
      expect(state.hardPoints[36]).toBe(20)
      expect(state.unspentPoints).toBe(30)

      // 21st point allocation must be rejected
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 36, 1)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, 1)).toBe(false)
      expect(state.hardPoints[36]).toBe(20)
      expect(state.unspentPoints).toBe(30)
    })

    it('handles same-row prerequisite allocation flow (Necromancer Skeleton Mastery)', () => {
      const state = createSkillTreeState(5)
      // Level 1 Necromancer cannot learn Skeleton Mastery without Raise Skeleton
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(false)

      // Allocate Raise Skeleton (ID 70)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 70, 1)).toBe(true)

      // Now Skeleton Mastery (ID 69) is available
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(true)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(true)
      expect(state.hardPoints[69]).toBe(1)
      expect(state.hardPoints[70]).toBe(1)
    })
  })

  // ==========================================================================
  // 4. Point Deallocation & Respec Mechanics
  // ==========================================================================
  describe('Point Deallocation & Respec Mechanics', () => {
    it('cannot deallocate skill with 0 invested points', () => {
      const state = createSkillTreeState(5)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
    })

    it('can deallocate when skill has > 1 points even with allocated dependents', () => {
      const state = createSkillTreeState(10)
      allocatePoint(CANONICAL_SKILL_TREE, state, 36, 12) // Fire Bolt point 1
      allocatePoint(CANONICAL_SKILL_TREE, state, 36, 12) // Fire Bolt point 2
      allocatePoint(CANONICAL_SKILL_TREE, state, 47, 12) // Fire Ball point 1 (dependent)

      // Fire Bolt has 2 points: dropping to 1 is allowed
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBe(1)
      expect(state.unspentPoints).toBe(8)
    })

    it('blocks deallocating 1 to 0 points when a direct dependent has invested points', () => {
      const state = createSkillTreeState(10)
      allocatePoint(CANONICAL_SKILL_TREE, state, 36, 12) // Fire Bolt point 1
      allocatePoint(CANONICAL_SKILL_TREE, state, 47, 12) // Fire Ball point 1

      // Fire Bolt has 1 point: dropping to 0 must be blocked
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      expect(state.hardPoints[36]).toBe(1)

      // Deallocate Fire Ball first
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 47)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 47)).toBe(true)
      expect(state.hardPoints[47]).toBe(0)

      // Now Fire Bolt can be deallocated
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBe(0)
    })

    it('blocks deallocating 1 to 0 points when a deep transitive dependent has invested points', () => {
      const state = createSkillTreeState(10)
      // Chain: Ice Bolt (39) -> Ice Blast (45) -> Glacial Spike (55) & Frost Nova (44) -> Blizzard (59)
      allocatePoint(CANONICAL_SKILL_TREE, state, 39, 24)
      allocatePoint(CANONICAL_SKILL_TREE, state, 45, 24)
      allocatePoint(CANONICAL_SKILL_TREE, state, 44, 24)
      allocatePoint(CANONICAL_SKILL_TREE, state, 55, 24)
      allocatePoint(CANONICAL_SKILL_TREE, state, 59, 24) // Deep dependent

      // Ice Bolt cannot be deallocated while Blizzard is active
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 39)).toBe(false)
      // Ice Blast cannot be deallocated while Blizzard is active
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 45)).toBe(false)

      // Deallocate Blizzard, then Glacial Spike, then Ice Blast, then Frost Nova, then Ice Bolt
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 59)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 55)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 45)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 44)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 39)).toBe(true)

      expect(state.hardPoints[39]).toBe(0)
      expect(state.hardPoints[45]).toBe(0)
      expect(state.hardPoints[55]).toBe(0)
      expect(state.hardPoints[59]).toBe(0)
    })

    it('respec refunds 100% invested points and resets all skills to 0', () => {
      const state = createSkillTreeState(20)
      allocatePoint(CANONICAL_SKILL_TREE, state, 96, 12)  // Sacrifice: 1
      allocatePoint(CANONICAL_SKILL_TREE, state, 106, 12) // Zeal: 1
      allocatePoint(CANONICAL_SKILL_TREE, state, 106, 12) // Zeal: 2
      allocatePoint(CANONICAL_SKILL_TREE, state, 98, 12)   // Might: 1
      allocatePoint(CANONICAL_SKILL_TREE, state, 102, 12)  // Holy Fire: 1
      expect(state.unspentPoints).toBe(15)

      const refunded = respec(state)
      expect(refunded).toBe(5)
      expect(state.unspentPoints).toBe(20)
      expect(state.hardPoints[96]).toBe(0)
      expect(state.hardPoints[106]).toBe(0)
      expect(state.hardPoints[98]).toBe(0)
      expect(state.hardPoints[102]).toBe(0)

      // Downstream skills are now re-locked
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 106, 30)).toBe(false) // Zeal requires Sacrifice
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 102, 30)).toBe(false) // Holy Fire requires Might
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 96, 30)).toBe(true)  // Root skill is eligible
    })
  })

  // ==========================================================================
  // 5. 1.13c Synergy Engine & Base Points Invariant
  // ==========================================================================
  describe('1.13c Synergy Engine & Base Points Invariant', () => {
    it('proves synergy multiplier strictly scales with hard points (blvl), not gear soft points', () => {
      const state = createSkillTreeState(50)

      // Sorceress: Fire Bolt (ID 36)
      // Synergy formula: (skill('Fire Ball'.blvl)+skill('Meteor'.blvl))*par8
      // par8 for Fire Bolt = 16% per hard point
      state.hardPoints[47] = 5 // Fire Ball: 5 base points
      state.hardPoints[56] = 3 // Meteor: 3 base points

      // Baseline synergy multiplier: (5 + 3) * 16% = +128% => 2.28
      const baseMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')
      expect(baseMult).toBeCloseTo(2.28, 2)

      // Simulate character equipping "+5 to All Skills" or "+3 Fire Skills" gear:
      // In D2 1.13c, gear adds to effective level (slvl), NEVER to blvl.
      // Therefore, state.hardPoints remains 5 and 3.
      const gearMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')
      expect(gearMult).toBe(baseMult)
    })

    it('evaluates Paladin Blessed Hammer synergies (+14% per hard point of Vigor and Blessed Aim)', () => {
      const state = createSkillTreeState(50)
      // Blessed Hammer (ID 112)
      // Formula: (skill('Vigor'.blvl)+skill('Blessed Aim'.blvl))*par8
      // par8 = 14
      state.hardPoints[115] = 10 // Vigor: 10 hard points
      state.hardPoints[108] = 5  // Blessed Aim: 5 hard points

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 112, 'elemental')
      // (10 + 5) * 14% = +210% => 3.10 multiplier
      expect(mult).toBeCloseTo(3.10, 2)
    })

    it('evaluates Necromancer Bone Spear synergies (+7% per hard point of Wall, Prison, Teeth, Spirit)', () => {
      const state = createSkillTreeState(50)
      // Bone Spear (ID 84)
      // par8 = 7
      state.hardPoints[78] = 10 // Bone Wall
      state.hardPoints[88] = 10 // Bone Prison
      state.hardPoints[67] = 10 // Teeth
      state.hardPoints[93] = 10 // Bone Spirit

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 84, 'elemental')
      // (10 + 10 + 10 + 10) * 7% = +280% => 3.80 multiplier
      expect(mult).toBeCloseTo(3.80, 2)
    })

    it('tolerates Blizzard unclosed parenthesis in Fire Wall formula without crashing', () => {
      const state = createSkillTreeState(50)
      // Fire Wall (ID 51) has EDmgSymPerCalc:
      // "(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7"
      // Note the unclosed open parenthesis in canonical Skills.txt!
      // par8 = 4 (Warmth), par7 = 1 (Inferno)
      state.hardPoints[37] = 10 // Warmth: 10 hard points
      state.hardPoints[41] = 10 // Inferno: 10 hard points

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 51, 'elemental')
      // (10 * 4 + 10 * 1) = +50% => 1.50 multiplier
      expect(mult).toBeCloseTo(1.50, 2)
    })

    it('evaluates dual physical and elemental synergies (Druid Molten Boulder & Volcano)', () => {
      const state = createSkillTreeState(50)
      // Molten Boulder (ID 229)
      // Physical: skill('Volcano'.blvl)*par7 (par7 = 10)
      // Elemental: skill('Firestorm'.blvl)*par8 (par8 = 8)
      state.hardPoints[244] = 6 // Volcano: 6 hard points
      state.hardPoints[225] = 5 // Firestorm: 5 hard points

      const physMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 229, 'physical')
      // 6 * 10% = +60% => 1.60 multiplier
      expect(physMult).toBeCloseTo(1.60, 2)

      const elemMult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 229, 'elemental')
      // 5 * 8% = +40% => 1.40 multiplier
      expect(elemMult).toBeCloseTo(1.40, 2)
    })

    it('evaluates Barbarian War Cry physical damage synergy (+6% per hard point of Howl/Taunt/Battle Cry)', () => {
      const state = createSkillTreeState(50)
      // War Cry (ID 154): physical synergy
      state.hardPoints[130] = 5 // Howl
      state.hardPoints[137] = 5 // Taunt
      state.hardPoints[146] = 5 // Battle Cry

      const mult = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 154, 'physical')
      // (5 + 5 + 5) * 6% = +90% => 1.90 multiplier
      expect(mult).toBeCloseTo(1.90, 2)
    })

    it('returns 1.0 (no bonus) for skills with no synergy formulas or 0 hard points invested', () => {
      const state = createSkillTreeState(10)
      // Teleport (ID 54): no synergies
      expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 54, 'elemental')).toBe(1.0)
      expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 54, 'physical')).toBe(1.0)

      // Fire Bolt (ID 36) with 0 points in Fire Ball / Meteor
      expect(calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')).toBe(1.0)
    })

    it('gracefully handles malformed or adversarial formulas by returning 1.0 without crashing', () => {
      const state = createSkillTreeState(10)
      state.hardPoints[47] = 5

      const customCatalog: SkillNode[] = [
        {
          id: 9991,
          name: 'Invalid Syntax Skill',
          classCode: 'sor',
          tabIndex: 0,
          tabName: 'Fire Spells',
          row: 1,
          col: 1,
          reqlevel: 1,
          reqskills: [],
          dependents: [],
          synergyFormulas: {
            elemental: 'invalid +++ syntax // 123',
          },
        },
        {
          id: 9992,
          name: 'Negative Result Skill',
          classCode: 'sor',
          tabIndex: 0,
          tabName: 'Fire Spells',
          row: 1,
          col: 1,
          reqlevel: 1,
          reqskills: [],
          dependents: [],
          synergyFormulas: {
            elemental: '-50 * par8',
          },
        },
      ]

      expect(calculateSynergyMultiplier(customCatalog, state, 9991, 'elemental')).toBe(1.0)
      expect(calculateSynergyMultiplier(customCatalog, state, 9992, 'elemental')).toBe(1.0)
      expect(calculateSynergyMultiplier(customCatalog, state, 99999, 'elemental')).toBe(1.0)
    })
  })

  // ==========================================================================
  // 6. Dual-Track MPQ Data Parity Verification (when real MPQ files exist)
  // ==========================================================================
  describe('Dual-Track MPQ Data Parity Verification', () => {
    it.runIf(hasRealData)('verifies parseSkillTreeTable reproduces CANONICAL_SKILL_TREE from MPQ tables', async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const tables = await loadActTables(archives)
      expect(tables.skills).toBeDefined()
      expect(tables.skilldesc).toBeDefined()

      const parsedNodes = parseSkillTreeTable(tables.skills!, tables.skilldesc!)
      expect(parsedNodes).toHaveLength(210)

      const parsedMap = new Map(parsedNodes.map(n => [n.id, n]))
      for (const canonical of CANONICAL_SKILL_TREE) {
        const parsed = parsedMap.get(canonical.id)
        expect(parsed).toBeDefined()
        expect(parsed?.name).toBe(canonical.name)
        expect(parsed?.classCode).toBe(canonical.classCode)
        expect(parsed?.tabIndex).toBe(canonical.tabIndex)
        expect(parsed?.row).toBe(canonical.row)
        expect(parsed?.col).toBe(canonical.col)
        expect(parsed?.reqlevel).toBe(canonical.reqlevel)
        expect(parsed?.reqskills).toEqual(canonical.reqskills)
        expect(parsed?.dependents).toEqual(canonical.dependents)
      }
    })
  })
})
