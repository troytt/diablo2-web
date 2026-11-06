import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'
import type { LocalAreaBootstrap } from '../../src/netproto/index.ts'

describe('Issue #2016: 1.13c cross-Act and disjoint-dungeon RoomSpatialIndex scoping', () => {
  it('isolates Act 4 town/steppes (103/104) and Chaos Sanctuary (108) collision, pathing, missiles, door rays, and LOS from earlier Acts (8, 75, 94)', () => {
    const game = new GameInstance({
      gameName: 'CrossActSpatialScope',
      act: 2,
      areaId: 75,
      mapSeed: 0x12345678,
    })
    const host = game as unknown as GameInstanceHost

    // Configure overlapping areas matching 1.13c Levels.txt coordinates:
    // - Area 75 (Kurast Docks, Act 3): [5000..5320, 5000..5240], SOLID WALL everywhere except (5010, 5010)
    // - Area 8 (Den of Evil, Act 1): [7500..8500, 5000..6000], SOLID WALL everywhere + closed door at (7550, 5100)
    // - Area 94 (Ruined Temple, Act 3): [15000..15120, 5000..5120], SOLID WALL everywhere
    // - Area 103 (Pandemonium Fortress, Act 4): [5000..5160, 5000..5120], adjacent [104], OPEN FLOOR everywhere
    // - Area 104 (Outer Steppes, Act 4): [5160..5560, 5000..5320], adjacent [103], OPEN FLOOR everywhere
    // - Area 108 (Chaos Sanctuary, Act 4): [7500..8100, 5000..5600], OPEN FLOOR everywhere except wall-embedded seal at (7560, 5100)
    // - Area 131 (Throne of Destruction, Act 5): [15000..15200, 5000..5260], OPEN FLOOR everywhere
    game.setAreaBootstrapResolver((req): LocalAreaBootstrap => {
      if (req.areaId === 75) {
        return {
          areaId: 75,
          spawnX: 5010,
          spawnY: 5010,
          rooms: [{ areaId: 75, tileX: 1000, tileY: 1000 }],
          roomRects: [{ index: 0, x: 5000, y: 5000, w: 320, h: 240, seed: 1 }],
          adjacentAreaIds: [76],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (_aid, x, y) => Math.round(x) === 5010 && Math.round(y) === 5010,
        }
      }
      if (req.areaId === 8) {
        return {
          areaId: 8,
          spawnX: 7510,
          spawnY: 5010,
          rooms: [{ areaId: 8, tileX: 1500, tileY: 1000 }],
          roomRects: [{ index: 0, x: 7500, y: 5000, w: 1000, h: 1000, seed: 2 }],
          adjacentAreaIds: [],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (_aid, x, y) => Math.round(x) === 7510 && Math.round(y) === 5010,
        }
      }
      if (req.areaId === 94) {
        return {
          areaId: 94,
          spawnX: 15010,
          spawnY: 5010,
          rooms: [{ areaId: 94, tileX: 3000, tileY: 1000 }],
          roomRects: [{ index: 0, x: 15000, y: 5000, w: 120, h: 120, seed: 3 }],
          adjacentAreaIds: [],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: () => false,
        }
      }
      if (req.areaId === 103) {
        return {
          areaId: 103,
          spawnX: 5050,
          spawnY: 5050,
          rooms: [{ areaId: 103, tileX: 1000, tileY: 1000 }],
          roomRects: [{ index: 0, x: 5000, y: 5000, w: 160, h: 120, seed: 4 }],
          adjacentAreaIds: [104],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (_aid, x, y) => x >= 5000 && x < 5160 && y >= 5000 && y < 5120,
        }
      }
      if (req.areaId === 104) {
        return {
          areaId: 104,
          spawnX: 5200,
          spawnY: 5080,
          rooms: [{ areaId: 104, tileX: 1032, tileY: 1000 }],
          roomRects: [{ index: 0, x: 5160, y: 5000, w: 400, h: 320, seed: 5 }],
          adjacentAreaIds: [103],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (_aid, x, y) => x >= 5160 && x < 5560 && y >= 5000 && y < 5320,
        }
      }
      if (req.areaId === 108) {
        return {
          areaId: 108,
          spawnX: 7540,
          spawnY: 5100,
          rooms: [{ areaId: 108, tileX: 1500, tileY: 1000 }],
          roomRects: [{ index: 0, x: 7500, y: 5000, w: 600, h: 600, seed: 6 }],
          adjacentAreaIds: [107],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (_aid, x, y) => {
            if (Math.round(x) === 7560 && Math.round(y) === 5100) return false
            return x >= 7500 && x < 8100 && y >= 5000 && y < 5600
          },
        }
      }
      return {
        areaId: req.areaId,
        spawnX: 15050,
        spawnY: 5050,
        rooms: [{ areaId: req.areaId, tileX: 3000, tileY: 1000 }],
        roomRects: [{ index: 0, x: 15000, y: 5000, w: 200, h: 260, seed: 7 }],
        adjacentAreaIds: [],
        objects: [],
        monsters: [],
        warps: [],
        isWalkable: (_aid, x, y) => x >= 15000 && x < 15200 && y >= 5000 && y < 5260,
      }
    })

    // Load Act 1 / Act 3 areas FIRST so their roomRects sit first in the spatial buckets!
    game.ensureAreaLoaded(75)
    game.ensureAreaLoaded(8)
    game.ensureAreaLoaded(94)
    // Spawn a closed wooden door (classId 13, mode 0) in Area 8 at (7550, 5100)
    game.spawnObject({ classId: 13, areaId: 8, x: 7550, y: 5100, mode: 0 })

    // Now load Act 4 & Act 5 areas sharing identical world coordinates
    game.ensureAreaLoaded(103)
    game.ensureAreaLoaded(104)
    game.ensureAreaLoaded(108)
    game.ensureAreaLoaded(131)

    // 1. Scoped areaIdAtWorldPoint resolves self-room first and seam-adjacent second, never cross-Act
    expect(game.areaIdAtWorldPoint(5044, 5019, 103)).toBe(103)
    expect(game.areaIdAtWorldPoint(5200, 5080, 103)).toBe(104) // 103 <-> 104 stitched outdoor seam
    expect(game.areaIdAtWorldPoint(5200, 5080, 104)).toBe(104)
    expect(game.areaIdAtWorldPoint(5150, 5080, 104)).toBe(103) // 104 <-> 103 stitched outdoor seam
    expect(game.areaIdAtWorldPoint(5290, 5080, 108)).toBeUndefined() // outside 108 and 107 -> undefined (not 75!)
    expect(game.areaIdAtWorldPoint(7550, 5100, 108)).toBe(108) // self-room 108, NOT Area 8!
    expect(game.areaIdAtWorldPoint(15050, 5050, 131)).toBe(131) // self-room 131, NOT Area 94!

    // 2. Monster step walkability & pathfinding in Area 104 and Area 131 are NOT blocked by Area 75 / Area 94 walls
    expect(host.isMonsterStepWalkable(104, 5155, 5080, 5210, 5080, false)).toBe(true)
    const mon104Id = game.spawnMonster({ hcIdx: 306, areaId: 104, x: 5180, y: 5080, hp: 200, maxHp: 200 })
    const mon104 = host.monsters.get(mon104Id)!
    const path104 = host.findMonsterPath(mon104, 5210, 5080)
    expect(path104.length).toBeGreaterThan(0)
    expect(path104[path104.length - 1]).toEqual({ x: 5210, y: 5080 })

    const mon131Id = game.spawnMonster({ hcIdx: 544, areaId: 131, x: 15040, y: 5050, hp: 500, maxHp: 500 })
    const mon131 = host.monsters.get(mon131Id)!
    const path131 = host.findMonsterPath(mon131, 15070, 5050)
    expect(path131.length).toBeGreaterThan(0)
    expect(path131[path131.length - 1]).toEqual({ x: 15070, y: 5050 })

    // 3. Closed-door raycast & missileSegmentBlocked in Chaos Sanctuary (Area 108) ignore Area 8's closed door & walls
    expect(host.isRayBlockedByClosedDoor(108, 7540, 5100, 7558, 5100)).toBe(false)
    expect(host.isRayBlockedByClosedDoor(8, 7540, 5100, 7558, 5100)).toBe(true)

    const pId = game.connectPlayer({
      name: 'ChaosSorc',
      charClass: 'sor',
      areaId: 108,
      x: 7540,
      y: 5100,
      level: 26,
      hp: 200,
      maxHp: 200,
      mana: 200,
      maxMana: 200,
    })
    const targetMonId = game.spawnMonster({
      hcIdx: 312,
      areaId: 108,
      x: 7554,
      y: 5100,
      hp: 300,
      maxHp: 300,
    })
    // Grant Fire Ball (skill 47) and cast across (7550, 5100) where Area 8 has a solid wall + closed door
    const pRec = host.players.get(pId)!
    pRec.skills.set(47, 10)
    pRec.rightSkill = 47
    game.enqueueCommand(pId, {
      type: 'CastSkillAtLocation',
      skillId: 47,
      hand: 'right',
      x: 7554,
      y: 5100,
    })
    game.stepFrames(15)
    expect(game.getMonsterState(targetMonId)!.hp).toBeLessThan(300)

    // 4. Wall-embedded object interaction LOS in Chaos Sanctuary (Area 108) is not poisoned by Area 8
    const sealId = game.spawnObject({ classId: 396, areaId: 108, x: 7560, y: 5100, mode: 0 })
    expect(host.hasInteractionLineOfSight(108, 7556, 5100, 7560, 5100, sealId)).toBe(true)
  })
})
