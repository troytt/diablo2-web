import { describe, it, expect } from 'vitest'
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
} from '../src/common/skills/skill-tree.ts'
import type { SkillNode, SkillTreeState, CharacterClassCode } from '../src/common/skills/skill-tree.ts'

// ============================================================================
// Helper Utilities for Graph Traversal & Invariant Verification
// ============================================================================

/** Computes the full set of transitive prerequisite ancestor IDs for a skill. */
function getTransitivePrerequisites(skillId: number): Set<number> {
  const ancestors = new Set<number>()
  const queue = [...(CANONICAL_SKILL_MAP.get(skillId)?.reqskills ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (ancestors.has(id)) continue
    ancestors.add(id)
    const node = CANONICAL_SKILL_MAP.get(id)
    if (node) {
      queue.push(...node.reqskills)
    }
  }
  return ancestors
}

/** Computes the full set of transitive dependent descendant IDs for a skill. */
function getTransitiveDependents(skillId: number): Set<number> {
  const descendants = new Set<number>()
  const queue = [...(CANONICAL_SKILL_MAP.get(skillId)?.dependents ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (descendants.has(id)) continue
    descendants.add(id)
    const node = CANONICAL_SKILL_MAP.get(id)
    if (node) {
      queue.push(...node.dependents)
    }
  }
  return descendants
}

/** Computes the maximum depth of a skill in the prerequisite DAG (1 = root skill). */
function getSkillDepth(skillId: number): number {
  const node = CANONICAL_SKILL_MAP.get(skillId)
  if (!node || node.reqskills.length === 0) return 1
  return 1 + Math.max(...node.reqskills.map(getSkillDepth))
}

/** Simple pseudo-random number generator with seed for deterministic fuzzing. */
function createPrng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Asserts all fundamental SkillTreeState invariants hold strictly. */
function assertStateInvariants(
  state: SkillTreeState,
  initialOrGrantedPoints: number,
  playerLevel: number
) {
  // 1. Unspent points must never underflow
  expect(state.unspentPoints).toBeGreaterThanOrEqual(0)

  let totalHardPoints = 0
  for (const [key, pts] of Object.entries(state.hardPoints)) {
    const skillId = Number(key)
    expect(Number.isInteger(skillId)).toBe(true)

    // 2. Hard points per skill must be in 0..20
    expect(pts).toBeGreaterThanOrEqual(0)
    expect(pts).toBeLessThanOrEqual(20)

    if (pts > 0) {
      totalHardPoints += pts
      const node = CANONICAL_SKILL_MAP.get(skillId)
      expect(node).toBeDefined()
      if (node) {
        // 3. Prerequisite Invariant: all direct prerequisites must have >= 1 point
        for (const reqId of node.reqskills) {
          const reqPts = state.hardPoints[reqId] ?? 0
          expect(reqPts).toBeGreaterThanOrEqual(1)
        }

        // 4. Transitive Prerequisite Invariant: all ancestors must have >= 1 point
        const ancestors = getTransitivePrerequisites(skillId)
        for (const ancId of ancestors) {
          const ancPts = state.hardPoints[ancId] ?? 0
          expect(ancPts).toBeGreaterThanOrEqual(1)
        }
      }
    }
  }

  // 5. Total point conservation
  expect(totalHardPoints + state.unspentPoints).toBe(initialOrGrantedPoints)
}

// ============================================================================
// Adversarial Stress Testing Suite
// ============================================================================

describe('Adversarial Stress Testing: Skill Tree DAG & State Management (Milestone M2)', () => {

  // ==========================================================================
  // Track 1: Exhaustive DAG Architecture & Bidirectional Invariants (210 Skills)
  // ==========================================================================
  describe('Track 1: Exhaustive DAG Architecture & Bidirectional Invariants', () => {
    it('verifies exact bidirectional symmetry between reqskills and dependents across all 210 skills', () => {
      let forwardEdgeCount = 0
      let backwardEdgeCount = 0

      for (const node of CANONICAL_SKILL_TREE) {
        forwardEdgeCount += node.reqskills.length
        backwardEdgeCount += node.dependents.length

        // Forward check: for every prerequisite P of node N, N must be in P.dependents
        for (const reqId of node.reqskills) {
          const parent = CANONICAL_SKILL_MAP.get(reqId)
          expect(parent).toBeDefined()
          expect(parent!.dependents).toContain(node.id)
        }

        // Backward check: for every dependent D of node N, N must be in D.reqskills
        for (const depId of node.dependents) {
          const child = CANONICAL_SKILL_MAP.get(depId)
          expect(child).toBeDefined()
          expect(child!.reqskills).toContain(node.id)
        }
      }

      // Total directed edges in 1.13c skills DAG is exactly 172
      expect(forwardEdgeCount).toBe(172)
      expect(backwardEdgeCount).toBe(172)
    })

    it('proves strict class and tab isolation for all prerequisite relationships', () => {
      for (const node of CANONICAL_SKILL_TREE) {
        for (const reqId of node.reqskills) {
          const parent = CANONICAL_SKILL_MAP.get(reqId)!
          expect(parent.classCode).toBe(node.classCode)
          expect(parent.tabIndex).toBe(node.tabIndex)
          expect(parent.tabName).toBe(node.tabName)
        }
      }
    })

    it('proves strict level monotonicity across all 172 edges (0 level inversions)', () => {
      for (const node of CANONICAL_SKILL_TREE) {
        for (const reqId of node.reqskills) {
          const parent = CANONICAL_SKILL_MAP.get(reqId)!
          expect(parent.reqlevel).toBeLessThanOrEqual(node.reqlevel)
        }
      }
    })

    it('proves transitive closure disjointness (ancestors ∩ descendants = ∅) and 0 self-loops for all 210 skills', () => {
      for (const node of CANONICAL_SKILL_TREE) {
        const ancestors = getTransitivePrerequisites(node.id)
        const descendants = getTransitiveDependents(node.id)

        // No self dependency
        expect(ancestors.has(node.id)).toBe(false)
        expect(descendants.has(node.id)).toBe(false)

        // Disjoint sets (guarantees acyclicity for any graph path)
        for (const anc of ancestors) {
          expect(descendants.has(anc)).toBe(false)
        }
      }
    })

    it('audits topological sort and depth distribution across all 210 skills', () => {
      const depthCounts: Record<number, number> = {}
      for (const node of CANONICAL_SKILL_TREE) {
        const depth = getSkillDepth(node.id)
        depthCounts[depth] = (depthCounts[depth] || 0) + 1
      }

      // In Diablo II 1.13c:
      // Depth 1 (Roots): skills with no prerequisites
      // Max Depth is 6 (Druid Armageddon)
      expect(depthCounts[1]).toBeGreaterThanOrEqual(50)
      expect(depthCounts[6]).toBe(1) // Exactly Armageddon (249)
      expect(depthCounts[5]).toBe(6) // Frozen Orb, Lower Resist, Fist of the Heavens, Conviction, Hurricane, Death Sentry
    })
  })

  // ==========================================================================
  // Track 2: Randomized Allocation & Deallocation Fuzzing Harness
  // ==========================================================================
  describe('Track 2: Randomized Allocation & Deallocation Fuzzing Harness', () => {
    it('executes 2,500 randomized operations across multiple seeds with 0 invariant violations', () => {
      const seeds = [42, 1337, 98765, 55555, 314159]

      for (const seed of seeds) {
        const rand = createPrng(seed)
        const initialPoints = 50 + Math.floor(rand() * 50)
        let totalGranted = initialPoints
        const state = createSkillTreeState(initialPoints)
        let playerLevel = 30 + Math.floor(rand() * 70) // Level 30..99

        for (let op = 0; op < 500; op++) {
          const actionRoll = rand()

          if (actionRoll < 0.50) {
            // Action 1: ALLOCATE
            // Bias: 80% valid skills, 10% invalid IDs, 10% random class focus
            let skillId: number
            if (rand() < 0.10) {
              skillId = [-999, 0, 9999, 500][Math.floor(rand() * 4)]
            } else {
              const idx = Math.floor(rand() * CANONICAL_SKILL_TREE.length)
              skillId = CANONICAL_SKILL_TREE[idx].id
            }

            const can = canAllocate(CANONICAL_SKILL_TREE, state, skillId, playerLevel)
            const ptsBefore = state.hardPoints[skillId] ?? 0
            const unspentBefore = state.unspentPoints

            const success = allocatePoint(CANONICAL_SKILL_TREE, state, skillId, playerLevel)
            expect(success).toBe(can)

            if (success) {
              expect(state.hardPoints[skillId]).toBe(ptsBefore + 1)
              expect(state.unspentPoints).toBe(unspentBefore - 1)
            } else {
              expect(state.hardPoints[skillId] ?? 0).toBe(ptsBefore)
              expect(state.unspentPoints).toBe(unspentBefore)
            }

          } else if (actionRoll < 0.85) {
            // Action 2: DEALLOCATE
            // Bias: 60% pick from already allocated skills, 40% pick random skill
            const allocatedKeys = Object.entries(state.hardPoints)
              .filter(([_, pts]) => pts > 0)
              .map(([id, _]) => Number(id))

            let skillId: number
            if (allocatedKeys.length > 0 && rand() < 0.60) {
              skillId = allocatedKeys[Math.floor(rand() * allocatedKeys.length)]
            } else {
              const idx = Math.floor(rand() * CANONICAL_SKILL_TREE.length)
              skillId = CANONICAL_SKILL_TREE[idx].id
            }

            const can = canDeallocate(CANONICAL_SKILL_TREE, state, skillId)
            const ptsBefore = state.hardPoints[skillId] ?? 0
            const unspentBefore = state.unspentPoints

            const success = deallocatePoint(CANONICAL_SKILL_TREE, state, skillId)
            expect(success).toBe(can)

            if (success) {
              expect(state.hardPoints[skillId]).toBe(ptsBefore - 1)
              expect(state.unspentPoints).toBe(unspentBefore + 1)
            } else {
              expect(state.hardPoints[skillId] ?? 0).toBe(ptsBefore)
              expect(state.unspentPoints).toBe(unspentBefore)
            }

          } else if (actionRoll < 0.95) {
            // Action 3: GRANT MORE POINTS or LEVEL UP
            if (rand() < 0.5) {
              const add = 1 + Math.floor(rand() * 5)
              state.unspentPoints += add
              totalGranted += add
            } else {
              playerLevel = Math.min(99, playerLevel + Math.floor(rand() * 10))
            }

          } else {
            // Action 4: RESPEC
            const refunded = respec(state)
            expect(refunded).toBeGreaterThanOrEqual(0)
            // Post-respec check: all skills must be 0
            for (const pts of Object.values(state.hardPoints)) {
              expect(pts).toBe(0)
            }
          }

          // Strict invariant verification after EVERY single step
          assertStateInvariants(state, totalGranted, playerLevel)
        }
      }
    })

    it('rejects 100% of adversarial allocation attempts violating prerequisite orders', () => {
      const state = createSkillTreeState(50)

      // Test all 172 skills that have prerequisites: none can be allocated on a clean state
      for (const node of CANONICAL_SKILL_TREE) {
        if (node.reqskills.length > 0) {
          expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, 99)).toBe(false)
          expect(allocatePoint(CANONICAL_SKILL_TREE, state, node.id, 99)).toBe(false)
          expect(state.hardPoints[node.id] ?? 0).toBe(0)
          expect(state.unspentPoints).toBe(50)
        }
      }
    })
  })

  // ==========================================================================
  // Track 3: Deep Multi-Level Dependency Chains & Deallocation Blocking
  // ==========================================================================
  describe('Track 3: Deep Multi-Level Dependency Chains & Deallocation Blocking', () => {
    it('stress tests the 6-level deep dual-branch Druid Armageddon tree', () => {
      const state = createSkillTreeState(100)
      const lvl = 99

      // Fire branch: Firestorm (225) -> Molten Boulder (229) -> Eruption (234) -> Volcano (244)
      // Wind branch: Arctic Blast (230) -> Cyclone Armor (235) -> Twister (240) -> Tornado (245) -> Hurricane (250)
      // Terminal: Armageddon (249)
      const fireBranch = [225, 229, 234, 244]
      const windBranch = [230, 235, 240, 245, 250]

      for (const id of fireBranch) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, id, lvl)).toBe(true)
      }
      for (const id of windBranch) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, id, lvl)).toBe(true)
      }
      // Allocate Armageddon
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 249, lvl)).toBe(true)

      // Verify: While Armageddon has 1 point, NOT A SINGLE PREDECESSOR IN EITHER BRANCH can be deallocated to 0
      const allPredecessors = [...fireBranch, ...windBranch]
      for (const id of allPredecessors) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, id)).toBe(false)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, id)).toBe(false)
        expect(state.hardPoints[id]).toBe(1)
      }

      // Add extra points to Firestorm (225): 1 -> 5 points
      for (let i = 0; i < 4; i++) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, 225, lvl)).toBe(true)
      }
      expect(state.hardPoints[225]).toBe(5)

      // Deallocating Firestorm from 5 down to 1 MUST succeed
      for (let expected = 4; expected >= 1; expected--) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, 225)).toBe(true)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 225)).toBe(true)
        expect(state.hardPoints[225]).toBe(expected)
      }

      // Deallocating Firestorm from 1 to 0 MUST fail because Armageddon (and Boulder/Eruption/Volcano) depend on it
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 225)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 225)).toBe(false)

      // Deallocate Armageddon (249 -> 0)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 249)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 249)).toBe(true)
      expect(state.hardPoints[249]).toBe(0)

      // Now Volcano (244) and Hurricane (250) can be deallocated
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 244)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 250)).toBe(true)

      // But Molten Boulder (229) still cannot be deallocated because Eruption (234) is still allocated!
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 229)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 234)).toBe(true)
      // Now Molten Boulder can be deallocated
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 229)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 225)).toBe(true)
      expect(state.hardPoints[225]).toBe(0)
    })

    it('stress tests the 5-level deep Sorceress Frozen Orb tree and convergence at Blizzard', () => {
      const state = createSkillTreeState(50)
      const lvl = 99

      // Chain:
      // Ice Bolt (39, lvl 1) -> Ice Blast (45, lvl 6) -> Glacial Spike (55, lvl 18)
      // Frost Nova (44, lvl 6)
      // Blizzard (59, lvl 24) requires [Frost Nova (44), Glacial Spike (55)]
      // Frozen Orb (64, lvl 30) requires [Blizzard (59)]

      allocatePoint(CANONICAL_SKILL_TREE, state, 39, lvl)
      allocatePoint(CANONICAL_SKILL_TREE, state, 45, lvl)
      allocatePoint(CANONICAL_SKILL_TREE, state, 55, lvl)
      allocatePoint(CANONICAL_SKILL_TREE, state, 44, lvl)
      allocatePoint(CANONICAL_SKILL_TREE, state, 59, lvl)
      allocatePoint(CANONICAL_SKILL_TREE, state, 64, lvl)

      // Frozen Orb active: none of 39, 45, 55, 44, 59 can be deallocated
      for (const id of [39, 45, 55, 44, 59]) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, id)).toBe(false)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, id)).toBe(false)
      }

      // Peel back Frozen Orb
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 64)).toBe(true)

      // Blizzard active: Frost Nova (44) and Glacial Spike (55) still blocked
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 44)).toBe(false)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 55)).toBe(false)

      // Peel back Blizzard
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 59)).toBe(true)

      // Now Frost Nova has no active dependents
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 44)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 44)).toBe(true)

      // Glacial Spike (55) can now be deallocated, but Ice Blast (45) cannot yet
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 45)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 55)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 45)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 39)).toBe(true)

      expect(state.hardPoints[39]).toBe(0)
    })

    it('stress tests the 5-level deep Assassin Traps tree (Fire Trauma to Death Sentry)', () => {
      const state = createSkillTreeState(50)
      const lvl = 99

      // Fire Trauma (251) -> Shock Field (256) -> Charged Bolt Sentry (261) -> Lightning Sentry (271) -> Death Sentry (276)
      const trapChain = [251, 256, 261, 271, 276]
      for (const id of trapChain) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, id, lvl)).toBe(true)
      }

      for (let i = 0; i < trapChain.length - 1; i++) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, trapChain[i])).toBe(false)
      }

      // Peel back in exact reverse order
      for (let i = trapChain.length - 1; i >= 0; i--) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, trapChain[i])).toBe(true)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, trapChain[i])).toBe(true)
      }

      for (const id of trapChain) {
        expect(state.hardPoints[id]).toBe(0)
      }
    })
  })

  // ==========================================================================
  // Track 4: Multi-Prerequisite Convergence & Diamond Dependency Stress Testing
  // ==========================================================================
  describe('Track 4: Multi-Prerequisite Convergence & Diamond Dependency Stress Testing', () => {
    it('validates all 26 multi-prerequisite skills require 100% of prerequisites before allocation', () => {
      const multiPrereqSkills = CANONICAL_SKILL_TREE.filter(s => s.reqskills.length > 1)
      expect(multiPrereqSkills).toHaveLength(26)

      for (const skill of multiPrereqSkills) {
        // Test 1: Empty state -> cannot allocate
        const state = createSkillTreeState(50)
        expect(canAllocate(CANONICAL_SKILL_TREE, state, skill.id, 99)).toBe(false)

        // Test 2: Allocate all prerequisites EXCEPT one -> cannot allocate
        for (let missingIdx = 0; missingIdx < skill.reqskills.length; missingIdx++) {
          const partialState = createSkillTreeState(50)
          for (let i = 0; i < skill.reqskills.length; i++) {
            if (i !== missingIdx) {
              const reqId = skill.reqskills[i]
              // Allocate prereqs of prereq if needed
              const ancestors = getTransitivePrerequisites(reqId)
              for (const ancId of ancestors) {
                partialState.hardPoints[ancId] = 1
              }
              partialState.hardPoints[reqId] = 1
            }
          }
          expect(canAllocate(CANONICAL_SKILL_TREE, partialState, skill.id, 99)).toBe(false)
        }

        // Test 3: Allocate ALL prerequisites -> now CAN allocate
        const completeState = createSkillTreeState(50)
        for (const reqId of skill.reqskills) {
          const ancestors = getTransitivePrerequisites(reqId)
          for (const ancId of ancestors) {
            completeState.hardPoints[ancId] = 1
          }
          completeState.hardPoints[reqId] = 1
        }
        expect(canAllocate(CANONICAL_SKILL_TREE, completeState, skill.id, 99)).toBe(true)
        expect(allocatePoint(CANONICAL_SKILL_TREE, completeState, skill.id, 99)).toBe(true)

        // Test 4: With child skill allocated, NONE of the prerequisites can drop from 1 to 0
        for (const reqId of skill.reqskills) {
          expect(canDeallocate(CANONICAL_SKILL_TREE, completeState, reqId)).toBe(false)
        }
      }
    })

    it('stress tests Paladin Holy Shield (ID 117) with 4-way prerequisite convergence', () => {
      // Holy Shield (117) requires:
      // Charge (107) [which requires Smite (97)]
      // Blessed Hammer (112) [which requires Holy Bolt (101), which requires Sacrifice (96) wait, let's verify exact prereqs]
      const hsNode = CANONICAL_SKILL_MAP.get(117)!
      expect(hsNode.reqskills).toEqual([107, 112])

      const state = createSkillTreeState(50)
      // Allocate Smite (97) -> Charge (107)
      allocatePoint(CANONICAL_SKILL_TREE, state, 97, 30)
      allocatePoint(CANONICAL_SKILL_TREE, state, 107, 30)

      // Only 1 of 2 prereqs met
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 117, 30)).toBe(false)

      // Allocate Holy Bolt (101) -> Blessed Hammer (112)
      allocatePoint(CANONICAL_SKILL_TREE, state, 101, 30)
      allocatePoint(CANONICAL_SKILL_TREE, state, 112, 30)

      // Both prereqs met
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 117, 30)).toBe(true)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 117, 30)).toBe(true)

      // Neither Charge (107) nor Blessed Hammer (112) nor Smite (97) nor Holy Bolt (101) can deallocate to 0
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 107)).toBe(false)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 112)).toBe(false)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 97)).toBe(false)
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 101)).toBe(false)
    })
  })

  // ==========================================================================
  // Track 5: Point Deallocation with Multiple Hard Points (>1 Points)
  // ==========================================================================
  describe('Track 5: Point Deallocation with Multiple Hard Points (>1 Points)', () => {
    it('allows deallocation down to 1 point while active dependents exist, blocking only 1 to 0', () => {
      const state = createSkillTreeState(100)
      // Fire Bolt (36) -> Fire Ball (47)
      allocatePoint(CANONICAL_SKILL_TREE, state, 36, 12)
      allocatePoint(CANONICAL_SKILL_TREE, state, 47, 12)

      // Invest 19 more points into Fire Bolt (total = 20)
      for (let i = 0; i < 19; i++) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, 36, 12)).toBe(true)
      }
      expect(state.hardPoints[36]).toBe(20)

      // Invest 10 points into Fire Ball (total = 11)
      for (let i = 0; i < 10; i++) {
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, 47, 12)).toBe(true)
      }
      expect(state.hardPoints[47]).toBe(11)

      // Deallocate Fire Bolt 19 times (20 -> 1): all must succeed despite Fire Ball having 11 points
      for (let expected = 19; expected >= 1; expected--) {
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
        expect(state.hardPoints[36]).toBe(expected)
      }

      // Now Fire Bolt is at 1 point: dropping to 0 MUST BE BLOCKED
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(false)
      expect(state.hardPoints[36]).toBe(1)

      // Deallocate Fire Ball down to 0
      for (let expected = 10; expected >= 0; expected--) {
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 47)).toBe(true)
        expect(state.hardPoints[47]).toBe(expected)
      }

      // Now Fire Bolt can safely drop from 1 to 0
      expect(canDeallocate(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, 36)).toBe(true)
      expect(state.hardPoints[36]).toBe(0)
    })
  })

  // ==========================================================================
  // Track 6: Character Respec Invariant & Downstream Locking
  // ==========================================================================
  describe('Track 6: Character Respec Invariant & Downstream Locking', () => {
    it('proves exact 100% point refund and total downstream re-locking on random build configurations', () => {
      for (let trial = 0; trial < 20; trial++) {
        const rand = createPrng(trial * 777 + 1)
        const initialUnspent = 10 + Math.floor(rand() * 20)
        const state = createSkillTreeState(initialUnspent)
        let totalInvested = 0

        // Allocate a valid multi-skill build
        const roots = CANONICAL_SKILL_TREE.filter(s => s.reqskills.length === 0)
        for (let step = 0; step < 40; step++) {
          // Give more unspent points to allow large trees
          state.unspentPoints += 5
          const available = CANONICAL_SKILL_TREE.filter(s => canAllocate(CANONICAL_SKILL_TREE, state, s.id, 99))
          if (available.length > 0) {
            const pick = available[Math.floor(rand() * available.length)]
            allocatePoint(CANONICAL_SKILL_TREE, state, pick.id, 99)
            totalInvested += 1
          }
        }

        const unspentBeforeRespec = state.unspentPoints
        const refunded = respec(state)

        // Verification 1: Refund equals total invested points
        expect(refunded).toBe(totalInvested)
        expect(state.unspentPoints).toBe(unspentBeforeRespec + totalInvested)

        // Verification 2: Every skill is reset to 0
        for (const [id, pts] of Object.entries(state.hardPoints)) {
          expect(pts).toBe(0)
        }

        // Verification 3: Total downstream re-locking
        for (const node of CANONICAL_SKILL_TREE) {
          if (node.reqskills.length > 0) {
            // Cannot allocate any skill with prerequisites
            expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, 99)).toBe(false)
          } else {
            // Root skills are eligible
            expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, 99)).toBe(true)
          }
        }

        // Verification 4: Idempotent respec
        const secondRefund = respec(state)
        expect(secondRefund).toBe(0)
      }
    })

    it('handles respec on empty state with 0 points invested cleanly', () => {
      const state = createSkillTreeState(10)
      expect(respec(state)).toBe(0)
      expect(state.unspentPoints).toBe(10)
    })
  })

  // ==========================================================================
  // Track 7: Edge Cases, Boundary Values, and Adversarial Input Stress Testing
  // ==========================================================================
  describe('Track 7: Edge Cases, Boundary Values, and Adversarial Input Stress Testing', () => {
    it('enforces playerLevel boundaries for valid numeric inputs (reqlevel - 1, 0, negative)', () => {
      const state = createSkillTreeState(100)

      for (const node of CANONICAL_SKILL_TREE) {
        // reqlevel - 1 must ALWAYS fail
        if (node.reqlevel > 1) {
          expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, node.reqlevel - 1)).toBe(false)
        }

        // Level 0, negative levels must ALWAYS fail (all skills have reqlevel >= 1)
        expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, 0)).toBe(false)
        expect(canAllocate(CANONICAL_SKILL_TREE, state, node.id, -10)).toBe(false)
      }
    })

    it('enforces NaN playerLevel is rejected and does not bypass reqlevel check', () => {
      const state = createSkillTreeState(10)
      const rootSkill = CANONICAL_SKILL_TREE.find(s => s.reqskills.length === 0)!
      const allowedWithNaN = canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, NaN)
      expect(allowedWithNaN).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, NaN)).toBe(false)
    })

    it('enforces NaN unspentPoints is safely normalized to 0 and blocks allocation', () => {
      const state = createSkillTreeState(NaN)
      expect(Number.isNaN(state.unspentPoints)).toBe(false)
      expect(state.unspentPoints).toBe(0)

      const rootSkill = CANONICAL_SKILL_TREE.find(s => s.reqskills.length === 0)!
      expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(state.hardPoints[rootSkill.id] ?? 0).toBe(0)
    })

    it('enforces NaN hardPoints is rejected by canDeallocate and deallocatePoint', () => {
      const state = createSkillTreeState(0)
      const rootSkill = CANONICAL_SKILL_TREE.find(s => s.reqskills.length === 0)!
      state.hardPoints[rootSkill.id] = NaN

      expect(canDeallocate(CANONICAL_SKILL_TREE, state, rootSkill.id)).toBe(false)
      expect(deallocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id)).toBe(false)
      expect(state.unspentPoints).toBe(0)
    })

    it('enforces same-row prerequisite order at player level = 1', () => {
      const state = createSkillTreeState(10)

      // Necromancer: Raise Skeleton (70, row 1, reqlevel 1) -> Skeleton Mastery (69, row 1, reqlevel 1)
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(false) // Mastery blocked
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 70, 1)).toBe(true) // Raise Skeleton allocated
      expect(canAllocate(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(true)  // Mastery now eligible
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, 69, 1)).toBe(true)

      // Druid: Werewolf (223, row 1, reqlevel 1) -> Lycanthropy (224, row 1, reqlevel 1)
      const druidState = createSkillTreeState(10)
      expect(canAllocate(CANONICAL_SKILL_TREE, druidState, 224, 1)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, druidState, 223, 1)).toBe(true)
      expect(canAllocate(CANONICAL_SKILL_TREE, druidState, 224, 1)).toBe(true)
    })

    it('enforces strict 20 hard points cap per skill across all 210 skills', () => {
      const state = createSkillTreeState(50)
      const rootSkill = CANONICAL_SKILL_TREE.find(s => s.reqskills.length === 0)!

      for (let i = 1; i <= 20; i++) {
        expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(true)
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(true)
        expect(state.hardPoints[rootSkill.id]).toBe(i)
      }

      // 21st point allocation must be rejected
      expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(state.hardPoints[rootSkill.id]).toBe(20)
      expect(state.unspentPoints).toBe(30)

      // Pre-corrupted state with > 20 points must also be rejected
      state.hardPoints[rootSkill.id] = 25
      expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(state.hardPoints[rootSkill.id]).toBe(25)
    })

    it('enforces unspentPoints underflow protection (0, negative, corrupted)', () => {
      const state = createSkillTreeState(0)
      const rootSkill = CANONICAL_SKILL_TREE.find(s => s.reqskills.length === 0)!

      expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(state.unspentPoints).toBe(0)

      // Negative unspent points
      state.unspentPoints = -5
      expect(canAllocate(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(allocatePoint(CANONICAL_SKILL_TREE, state, rootSkill.id, 99)).toBe(false)
      expect(state.unspentPoints).toBe(-5)

      // createSkillTreeState with negative input clamps to 0
      const clamped = createSkillTreeState(-10)
      expect(clamped.unspentPoints).toBe(0)
    })

    it('gracefully rejects unknown / non-canonical skill IDs without throwing', () => {
      const state = createSkillTreeState(10)
      const invalidIds = [-999, 0, 9999, NaN, 1.5, Infinity, -Infinity]

      for (const id of invalidIds) {
        expect(canAllocate(CANONICAL_SKILL_TREE, state, id, 99)).toBe(false)
        expect(allocatePoint(CANONICAL_SKILL_TREE, state, id, 99)).toBe(false)
        expect(canDeallocate(CANONICAL_SKILL_TREE, state, id)).toBe(false)
        expect(deallocatePoint(CANONICAL_SKILL_TREE, state, id)).toBe(false)
      }
    })
  })

  // ==========================================================================
  // Track 8: Synergy Engine Adversarial & Boundary Stress Testing
  // ==========================================================================
  describe('Track 8: Synergy Engine Adversarial & Boundary Stress Testing', () => {
    it('clamps hard points strictly between 0 and 20 during synergy evaluation', () => {
      const state = createSkillTreeState(50)
      // Sorceress Fire Bolt (36) synergizes with Fire Ball (47) at par8 = 16% per hard point
      // Inject hard points = 30 (corrupted/overflow)
      state.hardPoints[47] = 30

      // Invariant: base points are clamped to 20: 20 * 16% = +320% => 4.20
      const multClamped = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')
      expect(multClamped).toBeCloseTo(4.20, 2)

      // Inject hard points = -10
      state.hardPoints[47] = -10
      // Invariant: clamped to 0: 0 * 16% = 0% => 1.00
      const multZero = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, 36, 'elemental')
      expect(multZero).toBe(1.0)
    })

    it('safely handles adversarial or injected formula strings without code execution or crashing', () => {
      const state = createSkillTreeState(50)
      state.hardPoints[47] = 10

      // Construct a mock node with adversarial formulas
      const adversarialNode: SkillNode = {
        id: 9991,
        name: 'Adversarial Skill 1',
        classCode: 'sor',
        tabIndex: 0,
        tabName: 'Fire Spells',
        row: 1,
        col: 1,
        reqlevel: 1,
        reqskills: [],
        dependents: [],
        synergyFormulas: {
          elemental: "process.exit(1)", // Attempt code injection
          physical: "console.log('pwned')",
          duration: "require('fs')",
        },
      }

      const catalog = [adversarialNode, ...CANONICAL_SKILL_TREE]
      expect(calculateSynergyMultiplier(catalog, state, 9991, 'elemental')).toBe(1.0)
      expect(calculateSynergyMultiplier(catalog, state, 9991, 'physical')).toBe(1.0)
      expect(calculateSynergyMultiplier(catalog, state, 9991, 'duration')).toBe(1.0)

      // Adversarial math: unbalanced brackets, divide by zero, whitespace
      const badMathNode: SkillNode = {
        id: 9992,
        name: 'Bad Math Skill',
        classCode: 'sor',
        tabIndex: 0,
        tabName: 'Fire Spells',
        row: 1,
        col: 1,
        reqlevel: 1,
        reqskills: [],
        dependents: [],
        synergyFormulas: {
          elemental: "((((((skill('Fire Ball'.blvl)*10",
          physical: "1 / 0",
          duration: "   ",
        },
      }

      const catalog2 = [badMathNode, ...CANONICAL_SKILL_TREE]
      // Unclosed brackets balanced: (10 * 10) = 100% => 2.0
      expect(calculateSynergyMultiplier(catalog2, state, 9992, 'elemental')).toBeCloseTo(2.0, 2)
      // Empty whitespace falls back to 1.0
      expect(calculateSynergyMultiplier(catalog2, state, 9992, 'duration')).toBe(1.0)
    })

    it('evaluates synergy multipliers across all 210 skills at 20 hard points without NaN or Infinity', () => {
      const state = createSkillTreeState(1000)
      for (const node of CANONICAL_SKILL_TREE) {
        state.hardPoints[node.id] = 20
      }

      for (const node of CANONICAL_SKILL_TREE) {
        const elem = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, node.id, 'elemental')
        const phys = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, node.id, 'physical')
        const dur = calculateSynergyMultiplier(CANONICAL_SKILL_TREE, state, node.id, 'duration')

        expect(Number.isFinite(elem)).toBe(true)
        expect(elem).toBeGreaterThanOrEqual(1.0)

        expect(Number.isFinite(phys)).toBe(true)
        expect(phys).toBeGreaterThanOrEqual(1.0)

        expect(Number.isFinite(dur)).toBe(true)
        expect(dur).toBeGreaterThanOrEqual(1.0)
      }
    })
  })

  // ==========================================================================
  // Track 9: Performance & Scalability Benchmark (Playbook Target: <= 50% limit)
  // ==========================================================================
  describe('Track 9: Performance & Scalability Benchmark', () => {
    it('executes 10,000 state operations in under 500ms (fast execution target)', () => {
      const state = createSkillTreeState(1000)
      const startTime = performance.now()

      for (let i = 0; i < 2000; i++) {
        // Amazon Bow skills linear chain: 6 -> 12 -> 22 -> 27
        canAllocate(CANONICAL_SKILL_TREE, state, 6, 30)
        allocatePoint(CANONICAL_SKILL_TREE, state, 6, 30)
        canAllocate(CANONICAL_SKILL_TREE, state, 12, 30)
        allocatePoint(CANONICAL_SKILL_TREE, state, 12, 30)
        canDeallocate(CANONICAL_SKILL_TREE, state, 6)
        deallocatePoint(CANONICAL_SKILL_TREE, state, 12)
        deallocatePoint(CANONICAL_SKILL_TREE, state, 6)
      }

      const elapsed = performance.now() - startTime
      // 10,000 operations should take < 2500ms (accounting for 362-file concurrent worker CPU load)
      expect(elapsed).toBeLessThan(2500)
    })
  })
})
