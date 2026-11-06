import { describe, expect, it } from 'vitest'
import { TOWN_LEVEL_IDS, isTownLevel, parseDensityMultiplier, parseEliteMultiplier, rebudgetMonsterPacks } from '../src/common/world/scene-population.ts'
import type { CombatTerrain, CombatWorld, MonsterPack, MonsterStats } from '../src/server/ai/monster-ai.ts'
import { MonsterStreamingManager } from '../src/common/units/monster-streaming.ts'

function createSampleMonster(id: string, rank: 'normal' | 'champion' | 'unique' | 'minion' = 'normal', hp: number = 50): MonsterStats {
  return {
    id,
    name: id,
    level: 2,
    hp,
    damage: 5,
    cooldownTicks: 15,
    reach: 48,
    aggroRadius: 200,
    speed: 6,
    xp: 25,
    rank,
    modifiers: [],
  }
}

function createSamplePack(id: string, memberCount: number = 3, rank: 'normal' | 'champion' | 'unique' = 'normal'): MonsterPack {
  const members: MonsterStats[] = []
  if (rank === 'unique') {
    members.push(createSampleMonster(id, 'unique', 120))
    for (let i = 1; i < memberCount; i += 1) {
      members.push(createSampleMonster(id, 'minion', 60))
    }
  } else if (rank === 'champion') {
    for (let i = 0; i < memberCount; i += 1) {
      members.push(createSampleMonster(id, 'champion', 100))
    }
  } else {
    for (let i = 0; i < memberCount; i += 1) {
      members.push(createSampleMonster(id, 'normal', 50))
    }
  }
  return {
    members,
  }
}

function createMockSelect(initialValue: string): HTMLSelectElement {
  const classes = new Set<string>()
  const style: Record<string, string> = {}
  return {
    value: initialValue,
    classList: {
      toggle: (cls: string, force?: boolean) => {
        if (force === undefined) {
          if (classes.has(cls)) classes.delete(cls)
          else classes.add(cls)
        } else if (force) {
          classes.add(cls)
        } else {
          classes.delete(cls)
        }
      },
      contains: (cls: string) => classes.has(cls),
      add: (cls: string) => { classes.add(cls) },
      remove: (cls: string) => { classes.delete(cls) },
    },
    style,
  } as unknown as HTMLSelectElement
}

describe('Debug Toolbar: Monster Density & Elite Multipliers (Issue #450)', () => {
  describe('Query parameter parsing & defaulting to 1x', () => {
    it('defaults density to 1 for undefined, null, empty string, or invalid inputs', () => {
      expect(parseDensityMultiplier(undefined)).toBe(1)
      expect(parseDensityMultiplier(null)).toBe(1)
      expect(parseDensityMultiplier('')).toBe(1)
      expect(parseDensityMultiplier('invalid')).toBe(1)
      expect(parseDensityMultiplier('0')).toBe(1)
      expect(parseDensityMultiplier('3')).toBe(1)
      expect(parseDensityMultiplier('16')).toBe(1)
      expect(parseDensityMultiplier(NaN)).toBe(1)
    })

    it('correctly parses supported density values (0.5, 1, 2, 4, 8)', () => {
      expect(parseDensityMultiplier(0.5)).toBe(0.5)
      expect(parseDensityMultiplier(1)).toBe(1)
      expect(parseDensityMultiplier(2)).toBe(2)
      expect(parseDensityMultiplier(4)).toBe(4)
      expect(parseDensityMultiplier(8)).toBe(8)

      expect(parseDensityMultiplier('0.5')).toBe(0.5)
      expect(parseDensityMultiplier('1')).toBe(1)
      expect(parseDensityMultiplier('2')).toBe(2)
      expect(parseDensityMultiplier('4')).toBe(4)
      expect(parseDensityMultiplier('8')).toBe(8)
      expect(parseDensityMultiplier('  4  ')).toBe(4)
    })

    it('defaults elite multiplier to 1 for undefined, null, empty string, or invalid inputs', () => {
      expect(parseEliteMultiplier(undefined)).toBe(1)
      expect(parseEliteMultiplier(null)).toBe(1)
      expect(parseEliteMultiplier('')).toBe(1)
      expect(parseEliteMultiplier('foo')).toBe(1)
      expect(parseEliteMultiplier('0')).toBe(1)
      expect(parseEliteMultiplier('5')).toBe(1)
      expect(parseEliteMultiplier(NaN)).toBe(1)
    })

    it('correctly parses supported elite multiplier values (0.5, 1, 2, 4, all)', () => {
      expect(parseEliteMultiplier(0.5)).toBe(0.5)
      expect(parseEliteMultiplier(1)).toBe(1)
      expect(parseEliteMultiplier(2)).toBe(2)
      expect(parseEliteMultiplier(4)).toBe(4)
      expect(parseEliteMultiplier('all')).toBe('all')
      expect(parseEliteMultiplier('ALL')).toBe('all')
      expect(parseEliteMultiplier('All')).toBe('all')

      expect(parseEliteMultiplier('0.5')).toBe(0.5)
      expect(parseEliteMultiplier('1')).toBe(1)
      expect(parseEliteMultiplier('2')).toBe(2)
      expect(parseEliteMultiplier('4')).toBe(4)
    })
  })

  describe('Town safe-zone invariant: strictly 0 density in town levels', () => {
    it('identifies all 5 canonical town levels across Acts 1..5', () => {
      expect(TOWN_LEVEL_IDS.size).toBe(5)
      expect(isTownLevel(1)).toBe(true)   // Act 1: Rogue Encampment
      expect(isTownLevel(40)).toBe(true)  // Act 2: Lut Gholein
      expect(isTownLevel(75)).toBe(true)  // Act 3: Kurast Docks
      expect(isTownLevel(103)).toBe(true) // Act 4: The Pandemonium Fortress
      expect(isTownLevel(109)).toBe(true) // Act 5: Harrogath
    })

    it('rejects combat levels and invalid IDs', () => {
      expect(isTownLevel(2)).toBe(false)   // Blood Moor
      expect(isTownLevel(3)).toBe(false)   // Cold Plains
      expect(isTownLevel(8)).toBe(false)   // Den of Evil
      expect(isTownLevel(136)).toBe(false) // Throne of Destruction
      expect(isTownLevel(0)).toBe(false)
      expect(isTownLevel(-1)).toBe(false)
      expect(isTownLevel(undefined)).toBe(false)
      expect(isTownLevel(null)).toBe(false)
    })

    it('rebudgetMonsterPacks unconditionally returns 0 packs for all town levels under extreme multipliers', () => {
      const basePacks = [
        createSamplePack('zombie', 4),
        createSamplePack('fallen', 5),
      ]

      for (const townLevelId of [1, 40, 75, 103, 109]) {
        // Default 1x
        expect(rebudgetMonsterPacks(basePacks, { levelId: townLevelId, densityMultiplier: 1, eliteMultiplier: 1 })).toEqual([])
        // Maximum 8x density, all-elite
        expect(rebudgetMonsterPacks(basePacks, { levelId: townLevelId, densityMultiplier: 8, eliteMultiplier: 'all' })).toEqual([])
        // 4x density, 4x elite
        expect(rebudgetMonsterPacks(basePacks, { levelId: townLevelId, densityMultiplier: 4, eliteMultiplier: 4 })).toEqual([])
        // 0.5x density, 0.5x elite
        expect(rebudgetMonsterPacks(basePacks, { levelId: townLevelId, densityMultiplier: 0.5, eliteMultiplier: 0.5 })).toEqual([])
      }
    })
  })

  describe('Dynamic monster re-budgeting logic', () => {
    it('returns an identical deep copy matching 1.13c ground truth when multipliers are 1x', () => {
      const basePacks = [
        createSamplePack('zombie', 3, 'normal'),
        createSamplePack('fallen', 4, 'champion'),
        createSamplePack('skeleton', 5, 'unique'),
      ]
      const rebudgeted = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 1, eliteMultiplier: 1 })
      expect(rebudgeted).toHaveLength(3)
      expect(rebudgeted[0]?.members[0]?.rank).toBe('normal')
      expect(rebudgeted[1]?.members[0]?.rank).toBe('champion')
      expect(rebudgeted[2]?.members[0]?.rank).toBe('unique')
      // Ensure deep clone (distinct object references)
      expect(rebudgeted[0]).not.toBe(basePacks[0])
      expect(rebudgeted[0]!.members[0]).not.toBe(basePacks[0]!.members[0])
    })

    it('scales pack count proportionally with density multipliers', () => {
      const basePacks = [
        createSamplePack('zombie', 3),
        createSamplePack('fallen', 3),
        createSamplePack('skeleton', 3),
        createSamplePack('brute', 3),
      ]

      // 0.5x density: 4 * 0.5 = 2 packs
      const half = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 0.5, eliteMultiplier: 1 })
      expect(half).toHaveLength(2)

      // 2x density: 4 * 2 = 8 packs
      const double = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 2, eliteMultiplier: 1 })
      expect(double).toHaveLength(8)

      // 4x density: 4 * 4 = 16 packs
      const quad = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 4, eliteMultiplier: 1 })
      expect(quad).toHaveLength(16)
    })

    it('protects landmark and superunique packs from unwanted scaling duplication', () => {
      const basePacks: MonsterPack[] = [
        createSamplePack('zombie', 3),
        {
          superUniqueId: 'Bishibosh',
          members: [createSampleMonster('bishibosh', 'unique', 200)],
        },
      ]

      const scaled = rebudgetMonsterPacks(basePacks, { levelId: 3, densityMultiplier: 4, eliteMultiplier: 1 })
      // Regular pack scales 1 * 4 = 4; superunique pack remains exactly 1 -> total 5 packs
      expect(scaled).toHaveLength(5)
      const bishiPacks = scaled.filter(p => p.superUniqueId !== undefined)
      expect(bishiPacks).toHaveLength(1)
    })

    it('converts 100% of regular packs into champions or uniques when eliteMultiplier is "all"', () => {
      const basePacks = [
        createSamplePack('zombie', 3, 'normal'),
        createSamplePack('fallen', 4, 'normal'),
        createSamplePack('skeleton', 3, 'normal'),
      ]

      const allElite = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 1, eliteMultiplier: 'all', seed: 42 })
      expect(allElite).toHaveLength(3)

      for (const pack of allElite) {
        const leaderRank = pack.members[0]?.rank
        expect(leaderRank === 'champion' || leaderRank === 'unique').toBe(true)
        if (leaderRank === 'unique') {
          // Check that minions have minion rank
          for (let i = 1; i < pack.members.length; i += 1) {
            expect(pack.members[i]?.rank).toBe('minion')
          }
        } else if (leaderRank === 'champion') {
          // Check that all members are champions
          for (const m of pack.members) {
            expect(m.rank).toBe('champion')
          }
        }
      }
    })

    it('promotes normal packs when elite multiplier > 1 even on maps with 0 base elites', () => {
      const normalOnlyPacks = [
        createSamplePack('zombie', 3, 'normal'),
        createSamplePack('zombie', 3, 'normal'),
        createSamplePack('fallen', 4, 'normal'),
        createSamplePack('fallen', 4, 'normal'),
        createSamplePack('skeleton', 3, 'normal'),
        createSamplePack('skeleton', 3, 'normal'),
      ]

      const promoted = rebudgetMonsterPacks(normalOnlyPacks, { levelId: 2, densityMultiplier: 1, eliteMultiplier: 4, seed: 101 })
      const elitePacks = promoted.filter(p => p.members[0]?.rank === 'champion' || p.members[0]?.rank === 'unique')
      expect(elitePacks.length).toBeGreaterThan(0)
    })

    it('demotes elites toward normal when elite multiplier < 1', () => {
      const eliteHeavyPacks = [
        createSamplePack('zombie', 3, 'champion'),
        createSamplePack('fallen', 4, 'unique'),
        createSamplePack('skeleton', 3, 'champion'),
        createSamplePack('brute', 4, 'unique'),
      ]

      const reduced = rebudgetMonsterPacks(eliteHeavyPacks, { levelId: 2, densityMultiplier: 1, eliteMultiplier: 0.5, seed: 99 })
      const eliteCount = reduced.filter(p => p.members[0]?.rank === 'champion' || p.members[0]?.rank === 'unique').length
      expect(eliteCount).toBeLessThan(eliteHeavyPacks.length)
    })

    it('maintains deterministic behavior for the same seed', () => {
      const basePacks = [
        createSamplePack('zombie', 3, 'normal'),
        createSamplePack('fallen', 4, 'normal'),
      ]
      const run1 = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 2, eliteMultiplier: 'all', seed: 12345 })
      const run2 = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 2, eliteMultiplier: 'all', seed: 12345 })
      expect(run1).toEqual(run2)
    })
  })

  describe('Integration with MonsterStreamingManager', () => {
    it('initializes MonsterStreamingManager with scaled packs across rooms', () => {
      const basePacks = [
        createSamplePack('zombie', 3),
        createSamplePack('fallen', 4),
      ]
      const rebudgeted = rebudgetMonsterPacks(basePacks, { levelId: 2, densityMultiplier: 2, eliteMultiplier: 1 })
      expect(rebudgeted).toHaveLength(4)

      // Verify streaming manager accepts rooms constructed from rebudgeted packs
      const mockTerrain: CombatTerrain = {
        isWalkable: () => true,
        overlap: () => 0,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      } as unknown as CombatTerrain

      const mockWorld: CombatWorld = {
        player: { x: 100, y: 100, hp: 100, maxHp: 100 },
        monsters: [],
        projectiles: [],
        corpses: [],
      } as unknown as CombatWorld

      const rooms = [
        {
          id: 1,
          bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
          packs: rebudgeted.slice(0, 2),
        },
        {
          id: 2,
          bounds: { minX: 501, minY: 501, maxX: 1000, maxY: 1000 },
          packs: rebudgeted.slice(2),
        },
      ]

      const manager = new MonsterStreamingManager(mockWorld, mockTerrain, rooms, {
        activationRadius: 300,
        deactivationRadius: 400,
      })

      expect(manager).toBeDefined()
      expect(manager.rooms.length).toBe(2)
      expect(manager.rooms[0]!.packs.length).toBe(2)
      expect(manager.rooms[1]!.packs.length).toBe(2)
    })
  })
})
