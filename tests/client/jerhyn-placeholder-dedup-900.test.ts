import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { getNpcPlaceholderHcIdx } from '../../src/common/world/objects-meta.ts'

describe('NPC static placeholder deduplication and reconciliation (Fixes #900)', () => {
  it('defines 1.13c canonical NPC placeholder mappings', () => {
    // Jerhyn in Act 2 Lut Gholein
    expect(getNpcPlaceholderHcIdx(121)).toBe(201)
    expect(getNpcPlaceholderHcIdx(122)).toBe(201)

    // Hratli in Act 3 Kurast Docks
    expect(getNpcPlaceholderHcIdx(378)).toBe(253)
    expect(getNpcPlaceholderHcIdx(379)).toBe(253)

    // Qual-Kehk in Act 5 Harrogath
    expect(getNpcPlaceholderHcIdx(461)).toBe(515)
    expect(getNpcPlaceholderHcIdx(462)).toBe(515)

    // Anya in Act 5 Harrogath
    expect(getNpcPlaceholderHcIdx(542)).toBe(512)
    expect(getNpcPlaceholderHcIdx(543)).toBe(512)

    // Regular objects do not have placeholder mappings
    expect(getNpcPlaceholderHcIdx(5)).toBeUndefined()
    expect(getNpcPlaceholderHcIdx(119)).toBeUndefined()
  })

  it('hides static Jerhyn placeholder objects when dynamic Jerhyn is assigned after objects', () => {
    const world = new ClientWorld()

    // Assign static objects (DS1 map load): Object 121 and Object 122
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2, // object
        id: 101,
        classId: 121, // Jerhyn outside palace
        x: 148,
        y: 191,
      },
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2, // object
        id: 102,
        classId: 122, // Jerhyn inside palace
        x: 71,
        y: 148,
      },
    })

    const obj121 = world.getUnit(2, 101)
    const obj122 = world.getUnit(2, 102)
    expect(obj121).toBeDefined()
    expect(obj122).toBeDefined()
    expect(obj121?.hidden).toBe(false)
    expect(obj122?.hidden).toBe(false)

    // Server sends 0xAC AssignNPC for dynamic Jerhyn (hcIdx 201)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1, // monster
        id: 501,
        classId: 201, // Jerhyn
        x: 148,
        y: 191,
        lifePct: 100,
        mode: 1, // neutral
      },
    })

    expect(world.hasActiveMonsterNpc(201)).toBe(true)
    expect(obj121?.hidden).toBe(true)
    expect(obj122?.hidden).toBe(true)
  })

  it('hides static Jerhyn placeholder objects when objects are assigned after dynamic Jerhyn', () => {
    const world = new ClientWorld()

    // Dynamic Jerhyn assigned first
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1, // monster
        id: 501,
        classId: 201,
        x: 148,
        y: 191,
        lifePct: 100,
        mode: 1,
      },
    })
    expect(world.hasActiveMonsterNpc(201)).toBe(true)

    // Then static placeholder object 121 is assigned
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2, // object
        id: 101,
        classId: 121,
        x: 148,
        y: 191,
      },
    })

    const obj121 = world.getUnit(2, 101)
    expect(obj121?.hidden).toBe(true)
  })

  it('un-hides static placeholder objects when dynamic Jerhyn is removed', () => {
    const world = new ClientWorld()

    // Assign static object 121
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 101,
        classId: 121,
        x: 148,
        y: 191,
      },
    })

    // Assign dynamic Jerhyn
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 501,
        classId: 201,
        x: 148,
        y: 191,
        lifePct: 100,
        mode: 1,
      },
    })

    const obj121 = world.getUnit(2, 101)
    expect(obj121?.hidden).toBe(true)

    // Remove dynamic Jerhyn
    world.apply({
      type: 'UnitRemove',
      unitType: 1,
      id: 501,
    })

    expect(world.hasActiveMonsterNpc(201)).toBe(false)
    expect(obj121?.hidden).toBe(false)
  })

  it('reconciles Hratli, Qual-Kehk, and Anya placeholders correctly', () => {
    const world = new ClientWorld()

    // Hratli placeholder objects
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 301, classId: 378, x: 10, y: 10 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 302, classId: 379, x: 20, y: 20 },
    })

    const hratli1 = world.getUnit(2, 301)
    const hratli2 = world.getUnit(2, 302)
    expect(hratli1?.hidden).toBe(false)
    expect(hratli2?.hidden).toBe(false)

    // Assign dynamic Hratli (253)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 601, classId: 253, x: 10, y: 10, lifePct: 100, mode: 1 },
    })
    expect(hratli1?.hidden).toBe(true)
    expect(hratli2?.hidden).toBe(true)

    // Remove dynamic Hratli
    world.apply({
      type: 'UnitRemove',
      unitType: 1,
      id: 601,
    })
    expect(hratli1?.hidden).toBe(false)
    expect(hratli2?.hidden).toBe(false)
  })

  it('suppresses hidden units from CommandMapper hit-testing and candidate selection', () => {
    const world = new ClientWorld()
    const camera = new ViewportCamera()
    const hudModel = new HudModel({ world } as any)
    const mapper = new CommandMapper({
      world,
      camera,
      hudModel,
    })

    // Assign dynamic Jerhyn and static Jerhyn placeholder
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 501, classId: 201, x: 148, y: 191, lifePct: 100, mode: 1 },
    })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 2, id: 101, classId: 121, x: 148, y: 191 },
    })

    const jerhynDynamic = world.getUnit(1, 501)
    const jerhynStatic = world.getUnit(2, 101)

    expect(jerhynDynamic?.hidden).toBe(false)
    expect(jerhynStatic?.hidden).toBe(true)

    // pickUnitAtSubtile should only return the dynamic Jerhyn, never the hidden static object
    const picked = mapper.pickUnitAtSubtile(148, 191, 5)
    expect(picked).toBeDefined()
    expect(picked?.unitType).toBe('monster')
    expect(picked?.id).toBe(501)
  })
})
