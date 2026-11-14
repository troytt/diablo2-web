import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../../src/client/input/command-mapper.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'

describe('Issue #1281: Paladin Fist of the Heavens (#121) monster target resolution & handofgod (#158) overlay', () => {
  it('1. CommandMapper.fromMouseDown resolves nearest hostile monster within 4 sub-tiles for Fist of the Heavens (#121) into SkillOn', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 300, classId: 0, name: 'Skeleton', x: 5010, y: 5000 },
    })
    const skel = world.getUnit('monster', 300)!
    skel.mode = 1
    skel.lifePct = 100
    world.self.rightSkill = 121

    const mapper = new CommandMapper({ world })
    const cmd = mapper.fromMouseDown({
      button: 'right',
      worldX: 5012,
      worldY: 5001,
      hoveredUnit: null,
    })

    expect(cmd).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 300 },
      shift: false,
      hold: false,
    })
  })

  it('2. Fist of the Heavens (#121) attaches handofgod (#158) on target monster, spawns fistoftheheavensdelay -> fistoftheheavensbolt, and deduplicates S2C 0x11', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 100, y: 100 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 300, classId: 0, name: 'Skeleton1', x: 110, y: 100 },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 301, classId: 0, name: 'Skeleton2', x: 114, y: 102 },
    })

    const pal = world.getUnit('player', 1)!
    const m1 = world.getUnit('monster', 300)!
    const m2 = world.getUnit('monster', 301)!
    m1.mode = 1
    m1.lifePct = 128
    m2.mode = 1
    m2.lifePct = 128

    ;(world as any).spawnMissilesForSkill(pal, 121, 110, 100, 1)
    expect(m1.overlays.filter((o) => o.token === 'handofgod').length).toBe(1)

    // S2C 0x11 UnitOverlay (overlayIndex: 158) within 10 ticks must not duplicate handofgod
    world.apply({
      type: 'UnitOverlay',
      rawUnitType: 1,
      id: 300,
      overlayIndex: 158,
    } as any)
    expect(m1.overlays.filter((o) => o.token === 'handofgod').length).toBe(1)

    // Advance 10 ticks so fistoftheheavensdelay expires and emits fistoftheheavensbolt toward m2
    for (let t = 0; t < 10; t++) {
      world.tick(40, 1000 + t * 40)
    }
    const bolts = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.missileKey === 'fistoftheheavensbolt',
    )
    expect(bolts.length).toBeGreaterThanOrEqual(1)
  })
})
