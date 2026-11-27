import { describe, expect, test } from 'vitest'
import { pickVariant, type PoolTile } from '../src/common/world/d2map.ts'

describe('Variant Distribution & Valid DT1 Tile Styles (Issue #116)', () => {
  describe('pickVariant 2D spatial coordinate hash and diagonal decorrelation', () => {
    test('handles empty or single candidate groups', () => {
      expect(pickVariant(undefined, 0, 0, 1)).toBeUndefined()
      expect(pickVariant([], 0, 0, 1)).toBeUndefined()

      const single: PoolTile = { library: 0, tile: 42, weight: 10, animated: false, frameIndex: 0 }
      expect(pickVariant([single], 5, 10, 99)).toBe(single)
    })

    test('distributes variants uniformly across 64x64 grid without diagonal periodicity', () => {
      const candidates: PoolTile[] = [
        { library: 0, tile: 0, weight: 1, animated: false, frameIndex: 0 },
        { library: 0, tile: 1, weight: 1, animated: false, frameIndex: 0 },
        { library: 0, tile: 2, weight: 1, animated: false, frameIndex: 0 },
        { library: 0, tile: 3, weight: 1, animated: false, frameIndex: 0 },
      ]

      const N = 64
      const seed = 123456
      const grid: number[][] = []
      const counts = [0, 0, 0, 0]

      for (let y = 0; y < N; y += 1) {
        const row: number[] = []
        for (let x = 0; x < N; x += 1) {
          const picked = pickVariant(candidates, x, y, seed)
          expect(picked).toBeDefined()
          const tileIdx = picked!.tile
          counts[tileIdx] += 1
          row.push(tileIdx)
        }
        grid.push(row)
      }

      const totalCells = N * N // 4096 cells
      // 1. Uniformity: each of the 4 variants should receive ~25% of the total cells (between 20% and 30%)
      for (let i = 0; i < 4; i += 1) {
        const ratio = counts[i] / totalCells
        expect(ratio).toBeGreaterThan(0.20)
        expect(ratio).toBeLessThan(0.30)
      }

      // 2. Eliminate 45-degree diagonal periodicity:
      // In 2.5D isometric projection, diagonal step (dx=1, dy=1) or (dx=1, dy=-1) projects to screen lines.
      // With the old multiplicative formula (seed+x)*y, diagonal periodicity caused stripes.
      // With a decorrelated 2D coordinate hash, the diagonal match rate is close to 25% (random chance).
      let diagMatches1 = 0
      let totalDiag1 = 0
      for (let y = 0; y < N - 1; y += 1) {
        for (let x = 0; x < N - 1; x += 1) {
          if (grid[y][x] === grid[y + 1][x + 1]) diagMatches1 += 1
          totalDiag1 += 1
        }
      }

      let diagMatches2 = 0
      let totalDiag2 = 0
      for (let y = 1; y < N; y += 1) {
        for (let x = 0; x < N - 1; x += 1) {
          if (grid[y][x] === grid[y - 1][x + 1]) diagMatches2 += 1
          totalDiag2 += 1
        }
      }

      const diagRate1 = diagMatches1 / totalDiag1
      const diagRate2 = diagMatches2 / totalDiag2
      expect(diagRate1).toBeGreaterThan(0.20)
      expect(diagRate1).toBeLessThan(0.30)
      expect(diagRate2).toBeGreaterThan(0.20)
      expect(diagRate2).toBeLessThan(0.30)

      // 3. No degenerate rows or columns:
      // The old formula produced state=0 for all cells where y=0 (row 0 was all 0s).
      const row0Distinct = new Set(grid[0]).size
      expect(row0Distinct).toBe(4)

      const col0Distinct = new Set(grid.map(row => row[0])).size
      expect(col0Distinct).toBe(4)
    })

    test('respects candidate rarity weights', () => {
      const candidates: PoolTile[] = [
        { library: 0, tile: 0, weight: 1, animated: false, frameIndex: 0 },
        { library: 0, tile: 1, weight: 3, animated: false, frameIndex: 0 },
      ]

      const N = 64
      let count0 = 0
      let count1 = 0
      for (let y = 0; y < N; y += 1) {
        for (let x = 0; x < N; x += 1) {
          const picked = pickVariant(candidates, x, y, 777)
          if (picked?.tile === 0) count0 += 1
          else count1 += 1
        }
      }

      const ratio1 = count1 / (count0 + count1)
      // Theoretical ratio is 3/4 = 75%; allow +/- 5% margin
      expect(ratio1).toBeGreaterThan(0.70)
      expect(ratio1).toBeLessThan(0.80)
    })
  })
})
