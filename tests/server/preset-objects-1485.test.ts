import { describe, expect, it } from 'vitest'
import {
  buildAreaBootstrap,
  resolvePresetObject113c,
} from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry } from '../../src/netproto/index.ts'

describe('Issue #1485: 1.13c Preset Objects, Maggot Lair Super Chests & MonStats', () => {
  it('drives preset chest 581 pool selection from RNG', () => {
    // Act 1 (e.g. area 2): pool size 13
    const act1Candidates = [5, 6, 139, 140, 141, 144, 176, 177, 198, 240, 241, 242, 243]
    for (let i = 0; i < act1Candidates.length; i++) {
      const res = resolvePresetObject113c(581, 2, () => i)
      expect(res?.classId).toBe(act1Candidates[i])
    }

    // Act 2 Arcane Sanctuary (area 74): pool size 4
    const arcaneCandidates = [387, 389, 390, 391]
    for (let i = 0; i < arcaneCandidates.length; i++) {
      const res = resolvePresetObject113c(581, 74, () => i)
      expect(res?.classId).toBe(arcaneCandidates[i])
    }

    // Act 2 Other (e.g. area 41): pool size 2
    expect(resolvePresetObject113c(581, 41, () => 0)?.classId).toBe(87)
    expect(resolvePresetObject113c(581, 41, () => 1)?.classId).toBe(88)

    // Act 3 Travincal (area 83): pool size 4
    const travCandidates = [329, 330, 331, 332]
    for (let i = 0; i < travCandidates.length; i++) {
      const res = resolvePresetObject113c(581, 83, () => i)
      expect(res?.classId).toBe(travCandidates[i])
    }

    // Act 3 Other (e.g. area 76): pool size 2
    expect(resolvePresetObject113c(581, 76, () => 0)?.classId).toBe(181)
    expect(resolvePresetObject113c(581, 76, () => 1)?.classId).toBe(183)
  })

  it('Maggot Lair (areas 62..64) has exactly 51% sparkling rate (0x6fc531b0: rand(100) <= 50)', () => {
    // 0..50 inclusive is 51 values out of 100 -> sparkling
    expect(resolvePresetObject113c(580, 62, (n) => (n === 100 ? 50 : 0))?.isSparkling).toBe(true)
    expect(resolvePresetObject113c(580, 62, (n) => (n === 100 ? 51 : 0))?.isSparkling).toBeUndefined()

    // Test across 100 values: exactly 51 are sparkling
    let sparklingCount = 0
    for (let v = 0; v < 100; v++) {
      const res = resolvePresetObject113c(580, 64, (n) => (n === 100 ? v : 0))
      if (res?.isSparkling) {
        sparklingCount++
      }
    }
    expect(sparklingCount).toBe(51)

    // Outside Maggot Lair, preset 580 is 100% sparkling
    expect(resolvePresetObject113c(580, 2, (n) => (n === 100 ? 99 : 0))?.isSparkling).toBe(true)
    expect(resolvePresetObject113c(580, 74, (n) => (n === 100 ? 99 : 0))?.isSparkling).toBe(true)
  })

  it('buildAreaBootstrap respects MonStats npc and killable flags', () => {
    const geo: LocalAreaLevelGeometry = {
      areaId: 2,
      originX: 100,
      originY: 100,
      subWidth: 20,
      subHeight: 20,
      blocked: new Uint8Array(400),
      spawnTileX: 2,
      spawnTileY: 2,
      rooms: [{ areaId: 2, tileX: 20, tileY: 20 }],
      roomRects: [],
      presetUnits: [
        // Fallen (hcIdx 3): wild monster, killable = true, npc = false
        { type: 1, index: 3, mode: 1, subX: 5, subY: 5 },
        // Akara (hcIdx 148): npc = true, killable = false
        { type: 1, index: 148, mode: 0, subX: 10, subY: 10 },
      ],
      warps: [],
    }

    const res = buildAreaBootstrap(geo)
    expect(res.monsters).toHaveLength(2)

    const fallen = res.monsters.find((m) => m.classId === 3)!
    expect(fallen.isNpc).toBe(false)
    expect(fallen.isKillable).toBe(true)

    const akara = res.monsters.find((m) => m.classId === 148)!
    expect(akara.isNpc).toBe(true)
    expect(akara.isKillable).toBe(false)
  })
})
