import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { AuraScanner } from '../../../src/server/engine/aura-scanner.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'

describe('Issue #1277: Paladin Sanctuary (#119) tgtoverlay=cast_undead (#79) & cltmissilea=sanctuarybolt (#57)', () => {
  it('1. Client periodic Sanctuary pulse (every 50 frames) attaches cast_undead overlay and spawns sanctuarybolt on undead monsters in range', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 0, id: 1, classId: 3, name: 'Paladin', x: 5000, y: 5000 },
    })
    // Class 0 = skeleton1 (undead)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 101, classId: 0, name: 'Skeleton', x: 5003, y: 5000 },
    })
    // Class 10 = fallen1 (demon, not undead)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: { unitType: 1, id: 102, classId: 10, name: 'Fallen', x: 5003, y: 5000 },
    })

    const pal = world.getUnit('player', 1)!
    pal.states.add(47)
    ;(world.self.states as Set<number>).add(47)
    ;(world.self.skills as Map<number, number>).set(119, 1)

    const skel = world.getUnit('monster', 101)!
    const fallen = world.getUnit('monster', 102)!
    skel.lifePct = 100
    skel.mode = 1
    fallen.lifePct = 100
    fallen.mode = 1

    // Advance 50 discrete ticks so frameCount % 50 === 0 triggers Sanctuary pulse
    for (let t = 1; t <= 50; t++) {
      world.tick(40, 1000 + t * 40)
    }

    expect(skel.overlays.some((o) => o.token === 'cast_undead')).toBe(true)
    expect(fallen.overlays.some((o) => o.token === 'cast_undead')).toBe(false)
  })

  it('2. Client UnitMove knockback on undead monster while Sanctuary is active attaches cast_undead and spawns sanctuarybolt', () => {
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
      unit: { unitType: 1, id: 101, classId: 0, name: 'Skeleton', x: 5003, y: 5000 },
    })

    const pal = world.getUnit('player', 1)!
    pal.states.add(47)
    ;(world.self.states as Set<number>).add(47)

    const skel = world.getUnit('monster', 101)!
    world.apply({
      type: 'UnitMove',
      unitType: 1,
      id: 101,
      from: { x: 5003, y: 5000 },
      to: { x: 5006, y: 5000 },
      mode: 'knockback',
    })

    expect(skel.overlays.some((o) => o.token === 'cast_undead')).toBe(true)
    const bolts = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.missileKey === 'sanctuarybolt',
    )
    expect(bolts.length).toBeGreaterThanOrEqual(1)
  })

  it('3. Server AuraScanner Sanctuary (#119) pulse emits cast_undead (overlayId 79) unitOverlays for undead targets', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)
    const palStats = new UnitStatList(registry, {
      maxhp: 200 * 256,
      hitpoints: 200 * 256,
      maxmana: 100 * 256,
      mana: 100 * 256,
    })
    palStats.setBaseSkillLevel(119, 5)
    const palStateBus = new StateBus(palStats, registry)
    const pal = {
      id: 'pal-1',
      name: 'Paladin',
      unitType: 'player' as const,
      statList: palStats,
      stateBus: palStateBus,
      x: 100,
      y: 100,
    }

    const skelStats = new UnitStatList(registry, {
      maxhp: 200 * 256,
      hitpoints: 200 * 256,
    })
    const skelStateBus = new StateBus(skelStats, registry)
    const skel = {
      id: 'mon-501',
      name: 'Skeleton',
      unitType: 'monster' as const,
      isUndead: true,
      statList: skelStats,
      stateBus: skelStateBus,
      // #1410: Sanctuary slvl 5 radius = ln12 (5 + 4*1) = 9 sub-tiles (dx²+dy² <= 81).
      x: 105,
      y: 100,
    }

    const aura = scanner.setActiveAura(pal, 119, 5, 0)!
    const out = scanner.pulseAura(aura, 0, [pal], [skel])
    expect(out).not.toBeNull()
    expect(out!.enemiesAffected).toBe(1)
    expect(out!.unitOverlays).toEqual([
      {
        unitType: 1,
        unitId: 501,
        overlayId: 79,
        overlayToken: 'cast_undead',
      },
    ])
  })
})
