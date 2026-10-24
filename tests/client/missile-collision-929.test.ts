import { describe, expect, it } from 'vitest'
import { ClientWorld, getMissileCollideType113c } from '../../src/client/world/client-world.js'
import { OnlineSession } from '../../src/client/session/online-session.js'
import {
  buildIsoMapScene,
  COLLIDE_BLANK,
  COLLIDE_DOOR,
  COLLIDE_MASK_INVALID,
  COLLIDE_MASK_MISSILE,
  COLLIDE_MASK_PLAYER_PATH,
  COLLIDE_MISSILE_BARRIER,
  COLLIDE_OBJECT,
  COLLIDE_WALL,
} from '../../src/common/world/d2map.js'
import { CANONICAL_113C_OBJECTS } from '../../src/common/world/objects-meta.js'

describe('Issue #929: 1.13c client spell / missile collision parity', () => {
  it('defines COLLIDE_MASK_MISSILE as COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR (0x0804), excluding COLLIDE_OBJECT and COLLIDE_WALL', () => {
    expect(COLLIDE_MASK_MISSILE).toBe(COLLIDE_MISSILE_BARRIER | COLLIDE_DOOR)
    expect(COLLIDE_MASK_MISSILE).toBe(0x0804)
    expect(COLLIDE_MASK_MISSILE & COLLIDE_OBJECT).toBe(0)
    expect(COLLIDE_MASK_MISSILE & COLLIDE_WALL).toBe(0)
  })

  it('allows flying spells (e.g. fireball) to pass over ground rocks, barrels, and chests while still blocking player walk', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)
    world.setMissileCollisionChecker(() => false)

    // Spawn a ground rock / barrel object (classId=6 Loose Rock / classId=7 Barrel: HasCollision0=1, BlockMissile=0)
    expect(CANONICAL_113C_OBJECTS[6]?.blockMissile).toBeFalsy()
    expect(CANONICAL_113C_OBJECTS[7]?.blockMissile).toBeFalsy()

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 501,
        classId: 6,
        name: 'Loose Rock',
        x: 110,
        y: 100,
        mode: 0,
      },
    })

    // Walk is blocked on the rock footprint, but missile collision is NOT blocked
    expect(world.isSubTileBlocked(110, 100)).toBe(true)
    expect(world.isSubTileMissileBlocked(110, 100)).toBe(false)

    // Cast Fire Ball (skillId=47) from (100, 100) across the rock at (110, 100) toward (125, 100)
    const missile = world.spawnMissileByKey('fireball', 100, 100, 125, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 47,
      skillLevel: 1,
      maxTicks: 40,
    })

    for (let tick = 0; tick < 18; tick++) {
      world.tick(40)
    }

    // Fire Ball should have flown past x=110 without exploding on the ground rock
    const active = world.getUnit('missile', missile.id)
    expect(active).toBeDefined()
    expect(active!.x).toBeGreaterThan(112)
  })

  it('blocks flying spells on objects that have Objects.txt BlockMissile=1 (e.g. classId=358)', () => {
    const world = new ClientWorld()
    world.setCollisionChecker(() => false)
    world.setMissileCollisionChecker(() => false)

    expect(CANONICAL_113C_OBJECTS[358]?.blockMissile).toBe(true)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 502,
        classId: 358,
        name: 'Barrier',
        x: 110,
        y: 100,
        mode: 0,
      },
    })

    expect(world.isSubTileBlocked(110, 100)).toBe(true)
    expect(world.isSubTileMissileBlocked(110, 100)).toBe(true)
  })

  it('stamps COLLIDE_WALL | COLLIDE_BLANK (0x0021) without COLLIDE_MISSILE_BARRIER on Arcane Sanctuary Blank.dt1 (style=30, seq=1)', () => {
    const scene = buildIsoMapScene(
      {
        version: 18,
        width: 2,
        height: 1,
        act: 2,
        substitutionType: 0,
        wallLayers: 0,
        floorLayers: 1,
        objects: [],
        npcPathOffset: null,
        cells: [
          [
            // Cell (0, 0): Arcane Sanctuary blank-fill floor (Blank.dt1 style=30, seq=1, hidden=true)
            {
              floors: [
                {
                  prop1: 194,
                  sequence: 1,
                  unknown1: 0,
                  style: 30,
                  unknown2: 0,
                  hidden: true,
                },
              ],
              walls: [],
              shadows: [],
              substitutions: [],
            },
            // Cell (1, 0): True empty void cell (prop1=0)
            {
              floors: [
                {
                  prop1: 0,
                  sequence: 0,
                  unknown1: 0,
                  style: 0,
                  unknown2: 0,
                  hidden: true,
                },
              ],
              walls: [],
              shadows: [],
              substitutions: [],
            },
          ],
        ] as any,
      },
      [],
    )

    // Cell (0, 0) sub-tile (2, 2): walk-blocked and blank-guarded, but NOT missile-barrier blocked!
    const gridWidth = 2 * 5
    const arcaneIdx = 2 * gridWidth + 2
    const arcaneMask = scene.collisionMasks![arcaneIdx]!
    expect(scene.blocked[arcaneIdx]).toBe(1)
    expect(arcaneMask & COLLIDE_WALL).toBe(COLLIDE_WALL)
    expect(arcaneMask & COLLIDE_BLANK).toBe(COLLIDE_BLANK)
    expect(arcaneMask & COLLIDE_MASK_PLAYER_PATH).not.toBe(0)
    expect(arcaneMask & COLLIDE_MASK_MISSILE).toBe(0)

    // Cell (1, 0) sub-tile (7, 2): true void has full COLLIDE_MASK_INVALID
    const voidIdx = 2 * gridWidth + 7
    const voidMask = scene.collisionMasks![voidIdx]!
    expect(voidMask & COLLIDE_MASK_INVALID).toBe(COLLIDE_MASK_INVALID)
  })

  it('allows flying spells to cross Arcane Sanctuary void in OnlineSession while blocking floor-hugging CollideType=8 missiles and walls', () => {
    const subWidth = 20
    const subHeight = 10
    const collision = new Uint16Array(subWidth * subHeight)
    const blocked = new Uint8Array(subWidth * subHeight)
    const walkable = new Uint8Array(subWidth * subHeight).fill(1)

    // Columns x=5..9: Arcane Sanctuary void (0x0021 = COLLIDE_WALL | COLLIDE_BLANK, blocked=1, walkable=0)
    for (let y = 0; y < subHeight; y++) {
      for (let x = 5; x <= 9; x++) {
        const idx = y * subWidth + x
        collision[idx] = COLLIDE_WALL | COLLIDE_BLANK
        blocked[idx] = 1
        walkable[idx] = 0
      }
      // Column x=15: actual wall with COLLIDE_MISSILE_BARRIER (0x0005 = COLLIDE_WALL | COLLIDE_MISSILE_BARRIER)
      const wallIdx = y * subWidth + 15
      collision[wallIdx] = COLLIDE_WALL | COLLIDE_MISSILE_BARRIER
      blocked[wallIdx] = 1
      walkable[wallIdx] = 0
    }

    const session = new OnlineSession()
    session.levelView = {
      areaId: 74,
      subOriginX: 0,
      subOriginY: 0,
      subWidth,
      subHeight,
      collision,
      blocked,
      walkable,
    } as any

    // Walk is blocked on Arcane Sanctuary void (x=7) and wall (x=15)
    expect(session.world.isSubTileBlocked(2, 5)).toBe(false)
    expect(session.world.isSubTileBlocked(7, 5)).toBe(true)
    expect(session.world.isSubTileBlocked(15, 5)).toBe(true)

    // Flying missiles (CollideType=3, e.g. fireball) are NOT blocked on Arcane Sanctuary void (x=7),
    // but ARE blocked on actual walls (x=15)
    expect(getMissileCollideType113c('fireball')).toBe(3)
    expect(session.world.isSubTileMissileBlocked(7, 5, 3)).toBe(false)
    expect(session.world.isSubTileMissileBlocked(15, 5, 3)).toBe(true)

    // Floor-hugging missiles (CollideType=8, e.g. firewallmaker, moltenboulder) ARE blocked on Arcane Sanctuary void (x=7)
    expect(getMissileCollideType113c('firewallmaker')).toBe(8)
    expect(getMissileCollideType113c('moltenboulder')).toBe(8)
    expect(session.world.isSubTileMissileBlocked(7, 5, 8)).toBe(true)

    // CollideType=0 missiles ignore walls completely
    expect(getMissileCollideType113c('cairnstonesground')).toBe(0)
    expect(session.world.isSubTileMissileBlocked(15, 5, 0)).toBe(false)

    session.destroy()
  })
})
