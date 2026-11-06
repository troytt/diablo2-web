/**
 * Issue #1339 — Experience.txt ExpRatio high-level gain penalty.
 * Ratios: level 70 = 976, 80 = 496, 90 = 61, 98 = 6 (out of 1024).
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface MutablePlayer {
  level: number
  experience: number
}

function grantAtLevel(level: number, xpGain: number): number {
  const game = new GameInstance({ seed: 1339, areaId: 1 })
  const id = game.connectPlayer({ charClass: 'pal', name: `L${String(level)}`, x: 100, y: 100, areaId: 1 })
  const record = (game as unknown as { players: Map<number, MutablePlayer> }).players.get(id)!
  record.level = level
  record.experience = 0
  ;(game as unknown as { grantExperience(p: MutablePlayer, xp: number): void }).grantExperience(record, xpGain)
  return record.experience
}

describe('issue #1339: Experience.txt ExpRatio', () => {
  it('applies the 70/80/90/98 ExpRatio penalty to kill experience', () => {
    expect(grantAtLevel(70, 100_000)).toBe(Math.floor((100_000 * 976) / 1024))
    expect(grantAtLevel(80, 100_000)).toBe(Math.floor((100_000 * 496) / 1024))
    expect(grantAtLevel(90, 100_000)).toBe(Math.floor((100_000 * 61) / 1024))
    expect(grantAtLevel(98, 100_000)).toBe(Math.floor((100_000 * 6) / 1024))
  })

  it('does not penalize below level 70', () => {
    expect(grantAtLevel(69, 100_000)).toBe(100_000)
  })
})