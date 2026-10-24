import { describe, expect, it, vi } from 'vitest'
import { Autopilot, type AutopilotHost } from '../../src/client/guide/autopilot.ts'
import type { GuidePlan } from '../../src/client/guide/path-guide.ts'
import type { ClientUnit } from '../../src/client/world/client-unit.ts'

const BLOOD_MOOR = 2
const ROGUE_ENCAMPMENT = 1

function setup(plan: Partial<GuidePlan> | null, area = BLOOD_MOOR) {
  const units: ClientUnit[] = []
  const self = { x: 100, y: 100, life: 100, maxLife: 100, mana: 50, maxMana: 50, gold: 5000, stashGold: 0, level: 10, charClass: 1, stats: { get: () => 0 }, skillEntries: new Map() }
  const world = {
    isDead: false,
    difficulty: 0,
    waypoints: new Set<number>(),
    areaId: area,
    self,
    merc: null,
    containers: { belt: new Map(), inventory: new Map(), equipment: new Map(), shop: new Map(), stash: new Map(), cube: new Map() },
    getUnit: (_: string, id: number) => units.find((unit) => unit.id === id),
    getUnitsByType: (type: number) => units.filter((unit) => ({ 0: 'player', 1: 'monster', 2: 'object', 5: 'tile' })[type] === unit.unitType),
  }
  const hudManager = { leftPanel: 'none', worldPanels: { npcMenu: null as unknown, npcSpeech: null, clickNpcMenuOption: vi.fn() }, toasts: { push: vi.fn() }, maxHp: 0, maxMana: 0, belt: { maxRows: 4 } }
  const hudModel = { teleportToLevel: vi.fn(), closeWaypoint: vi.fn(), handleNpcMenuAction: vi.fn(), closeActiveNpcPanel: vi.fn(), requestQuestData: vi.fn() }
  const assists = {
    autoCombatKey: 'E' as string | null,
    pilotKey: 'Y',
    pilotCombat: false,
    questPickup: false,
    smartSkills: false,
    playerSteering: false,
    moving: false,
    fighting: false,
    isFighting() {
      return this.fighting
    },
    hasLootNearby: () => false,
    dodging: () => false,
    inventoryCare: { busy: false, config: null, junk: [], clutter: [], upgrades: [] as unknown[], stashable: [], wearUpgrades: vi.fn() },
    keepUp: () => false,
    walkTo: vi.fn(),
    use: vi.fn(),
    canCast: () => false,
    canReach: () => true,
    castAt: vi.fn(),
    isHostile: (unit: ClientUnit) => unit.name === 'Fallen',
    castTownPortal: vi.fn(),
    hasTownPortal: () => true,
    standDown: false,
    holdLoot: false,
    stepTo: vi.fn(),
    walkableWithDoorsOpen: (view: { walkable: Uint8Array }) => view.walkable,
  }
  const route = [{ x: 100, y: 100 }, { x: 130, y: 100 }]
  const guide = { enabled: false, pilotStatus: null as string | null, detour: null as unknown, focus: vi.fn(), update: () => (plan ? ({ goal: { level: 2, title: 'Den of Evil' }, step: null, hint: 'Head to Blood Moor', target: null, path: [], route, doors: [], highlights: [], ...plan }) : null), routeFrom: () => route, reaches: () => true, knowsWaypointIn: () => true }
  const view = { id: area, originX: 0, originY: 0, subWidth: 400, subHeight: 400, walkable: new Uint8Array(400 * 400).fill(1), rooms: [] as { index: number; worldSubX: number; worldSubY: number; subW: number; subH: number }[], presetUnits: [] as { type: number; index: number; subX: number; subY: number }[], entrances: [] }
  const host = { world, hudManager, hudModel, assists, guide, levelView: () => view } as unknown as AutopilotHost
  const pilot = new Autopilot(host)
  pilot.start()
  let now = 1000
  const tick = (ms = 200) => pilot.tick((now += ms))
  return { pilot, world, units, hudManager, hudModel, assists, guide, view, tick }
}

const unit = (fields: Partial<ClientUnit>) => ({ unitType: 'monster', classId: 0, mode: 0, hidden: false, dead: false, lifePct: 128, ...fields }) as ClientUnit

describe('autopilot', () => {
  it('walks ahead along the guide route and shows what it is doing', () => {
    const { assists, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' }, step: { kind: 'exit', level: 3 } })
    tick()
    expect(assists.walkTo).toHaveBeenCalledWith(115, 100, expect.any(Number))
    expect([guide.enabled, guide.pilotStatus, assists.pilotCombat, assists.questPickup]).toEqual([true, 'Head to Blood Moor', true, true])
  })

  it('lets Auto-Fight and looting finish first, and backs off while you steer', () => {
    const { assists, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.fighting = true
    tick()
    expect([assists.walkTo.mock.calls.length, guide.pilotStatus]).toEqual([0, 'Fighting'])
    assists.fighting = false
    assists.playerSteering = true
    tick()
    assists.playerSteering = false
    tick(1000)
    expect([assists.walkTo.mock.calls.length, guide.pilotStatus]).toEqual([0, 'Paused while you play'])
    tick(4000)
    expect(assists.walkTo).toHaveBeenCalled()
  })

  it('touches the waypoint and picks the level the guide wants', () => {
    const { assists, hudManager, hudModel, units, tick } = setup({ step: { kind: 'waypoint', level: 5 }, target: { x: 102, y: 101, label: 'Waypoint', unit: { id: 41, kind: 'object' } } })
    units.push(unit({ id: 41, unitType: 'object', classId: 119, x: 102, y: 101 }))
    tick()
    expect(assists.use).toHaveBeenCalledWith(units[0], expect.any(Number))
    hudManager.leftPanel = 'waypoint'
    tick()
    expect(hudModel.teleportToLevel).toHaveBeenCalledWith(5)
  })

  it('talks to the quest NPC and picks the quest topic', () => {
    const { world, assists, hudManager, hudModel, units, tick } = setup({ goal: { level: 1, title: 'Den of Evil', inTown: true }, hint: 'Talk to Akara', target: { x: 101, y: 100, label: 'Akara', unit: { id: 7, kind: 'npc' } } }, ROGUE_ENCAMPMENT)
    units.push(unit({ id: 7, classId: 148, x: 101, y: 100, name: 'Akara' }))
    world.self.gold = 0
    tick()
    expect(assists.use).toHaveBeenCalledWith(units[0], expect.any(Number))
    hudManager.worldPanels.npcMenu = { npcId: 7, submenu: 'main', options: [{ id: 'talk' }, { id: 'trade' }, { id: 'cancel' }] }
    tick()
    expect(hudManager.worldPanels.clickNpcMenuOption).toHaveBeenLastCalledWith('talk', undefined)
    hudManager.worldPanels.npcMenu = { npcId: 7, submenu: 'talk', options: [{ id: 'talk_intro' }, { id: 'talk_quest:12' }, { id: 'cancel' }] }
    tick()
    expect(hudManager.worldPanels.clickNpcMenuOption).toHaveBeenLastCalledWith('talk_quest:12', undefined)
    tick()
    expect([hudModel.closeActiveNpcPanel.mock.calls.length > 0, hudModel.requestQuestData.mock.calls.length > 0]).toEqual([true, true])
  })

  it('asks the server for fresh quest state when the step has not moved for a while', () => {
    const { hudModel, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    tick()
    tick(31_000)
    expect(hudModel.requestQuestData).toHaveBeenCalledTimes(1)
    tick(1000)
    expect(hudModel.requestQuestData).toHaveBeenCalledTimes(1)
  })

  it('walks up to a boss instead of trying to talk to it', () => {
    const { assists, units, tick } = setup({ hint: 'Kill Blood Raven', target: { x: 101, y: 100, label: 'Blood Raven', unit: { id: 9, kind: 'npc' } } })
    units.push(unit({ id: 9, x: 101, y: 100, name: 'Fallen' }))
    tick()
    expect(assists.use).not.toHaveBeenCalled()
  })

  it('heads home through a town portal when it is nearly dead with no potions left', () => {
    const { world, assists, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 20
    tick(2000)
    expect(assists.castTownPortal).toHaveBeenCalled()
    units.push(unit({ id: 50, unitType: 'object', classId: 59, x: 103, y: 100 }))
    tick(2000)
    expect(assists.use).toHaveBeenCalledWith(units[0], expect.any(Number))
  })

  it('stops fighting and heads home once the potions are gone and life is half down', () => {
    const { world, assists, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 55
    tick(2000)
    expect([assists.standDown, assists.pilotCombat, guide.pilotStatus]).toEqual([true, false, 'Out of healing potions, heading to town'])
    expect(assists.castTownPortal).toHaveBeenCalled()
  })

  it('heads home when life drops fast, even with potions left', () => {
    const { world, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.containers.belt.set(1, { id: 1, code: 'hp1' })
    world.containers.belt.set(2, { id: 2, code: 'hp1' })
    tick()
    world.self.life = 55
    tick(1000)
    expect(guide.pilotStatus).toBe('Taking a beating, heading to town')
  })

  it('steps away from monsters at its feet before opening a portal', () => {
    const { world, assists, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 20
    units.push(unit({ id: 60, x: 103, y: 100, name: 'Fallen' }), unit({ id: 61, x: 102, y: 102, name: 'Fallen' }))
    tick(2000)
    const [x, y] = assists.walkTo.mock.calls[0] as [number, number]
    expect([assists.castTownPortal.mock.calls.length, x < 100]).toEqual([0, true])
    expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(9)
    tick(3000)
    expect(assists.castTownPortal).toHaveBeenCalled()
  })

  it('keeps retreating once life comes back up, until it reaches town', () => {
    const { world, assists, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 15
    tick(2000)
    world.self.life = 90
    tick(2000)
    expect([assists.standDown, guide.pilotStatus]).toEqual([true, 'Low on life, heading to town'])
    world.areaId = ROGUE_ENCAMPMENT
    tick(2000)
    expect(assists.standDown).toBe(false)
  })

  it('walks back the way it came when it has no town portal', () => {
    const { world, assists, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.hasTownPortal = () => false
    world.self.gold = 0
    world.areaId = ROGUE_ENCAMPMENT
    tick()
    world.areaId = BLOOD_MOOR
    world.self.x = 101
    tick()
    world.self.life = 20
    world.self.x = 104
    tick(2000)
    world.self.x = 101
    tick(2000)
    expect(assists.stepTo).toHaveBeenLastCalledWith(81, 100, expect.any(Number))
  })

  it('remembers the way back to town across a portal trip', () => {
    const { world, assists, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.gold = 0
    const enter = (area: number, x: number) => {
      world.areaId = area
      world.self.x = x
      tick()
    }
    enter(ROGUE_ENCAMPMENT, 100)
    enter(BLOOD_MOOR, 101)
    enter(ROGUE_ENCAMPMENT, 300)
    enter(BLOOD_MOOR, 160)
    assists.hasTownPortal = () => false
    world.self.life = 20
    tick(2000)
    expect(assists.walkTo).toHaveBeenLastCalledWith(145, 100, expect.any(Number))
  })

  it('hands control back when it is in trouble with no portal and no way back', () => {
    const { pilot, world, assists, hudManager, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.hasTownPortal = () => false
    world.self.life = 20
    tick(2000)
    expect(pilot.active).toBe(false)
    expect(hudManager.toasts.push).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Autopilot needs you', color: 'red' }), expect.any(Number))
  })

  it('feels along a fence for the gap when it is stuck on the edge of a level', () => {
    const { assists, view, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' }, step: { kind: 'exit', level: 3 } })
    view.walkable.fill(0, 100 * 400, 101 * 400)
    for (let y = 0; y < 400; y++) view.walkable[y * 400 + 100] = 0
    const steps = [0, 2500, 2500].map((ms) => {
      tick(ms || 200)
      return assists.stepTo.mock.lastCall?.slice(0, 2)
    })
    expect(steps).toEqual([[112, 100], [112, 112], [112, 88]])
  })

  it('searches the rest of the level once it reaches a spot that does not finish the quest', () => {
    const { assists, view, tick } = setup({ hint: 'Clear the Den of Evil', target: { x: 101, y: 100, label: 'Den of Evil' } })
    view.rooms.push({ index: 0, worldSubX: 90, worldSubY: 90, subW: 20, subH: 20 }, { index: 1, worldSubX: 200, worldSubY: 90, subW: 20, subH: 20 })
    tick()
    expect(assists.walkTo).toHaveBeenLastCalledWith(115, 100, expect.any(Number))
  })

  it('holds its nerve with a full belt in an easy area, and hunts the monsters nearby', () => {
    const { world, assists, guide, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.pilotCombat = true
    assists.autoCombatKey = 'E'
    ;[1, 2, 3, 4, 5].forEach((id) => world.containers.belt.set(id, { id, code: 'hp2' }))
    world.self.life = 30
    tick()
    expect(assists.standDown).toBe(false)
    world.self.life = 100
    units.push(unit({ id: 70, x: 120, y: 100, name: 'Fallen' }))
    tick(1000)
    expect(guide.pilotStatus).toBe('Hunting Fallen')
  })

  it('stays in town until it is healed instead of bouncing back through the portal', () => {
    const { world, assists, units, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } }, ROGUE_ENCAMPMENT)
    world.self.gold = 0
    world.self.life = 30
    units.push(unit({ id: 50, unitType: 'object', classId: 59, x: 103, y: 100 }))
    tick(9000)
    tick(200)
    expect(assists.use).not.toHaveBeenCalledWith(units[0], expect.any(Number))
    expect(guide.pilotStatus).not.toBe('Back through the portal')
  })

  it('calls off a retreat once life is back and the belt has potions', () => {
    const { world, assists, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 15
    tick(2000)
    expect(assists.standDown).toBe(true)
    ;[1, 2].forEach((id) => world.containers.belt.set(id, { id, code: 'hp3' }))
    world.self.life = 95
    tick(2000)
    expect(assists.standDown).toBe(false)
  })

  it('does not hunt a monster it cannot walk to', () => {
    const { world, assists, guide, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.pilotCombat = true
    assists.canReach = () => false
    ;[1, 2, 3].forEach((id) => world.containers.belt.set(id, { id, code: 'hp2' }))
    units.push(unit({ id: 70, x: 120, y: 100, name: 'Fallen' }))
    tick()
    tick(500)
    expect(guide.pilotStatus).toBe('Head to Blood Moor')
  })

  it('puts on better gear it is carrying while in town', () => {
    const { world, assists, guide, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } }, ROGUE_ENCAMPMENT)
    world.self.gold = 0
    assists.inventoryCare.upgrades = [{ id: 9 }]
    tick()
    expect([assists.inventoryCare.wearUpgrades.mock.calls.length, guide.pilotStatus]).toEqual([1, 'Putting on better gear'])
  })

  it('opens the quest chest before going back to the loot around it', () => {
    const { assists, units, guide, tick } = setup({ hint: 'Open the chest', target: { x: 110, y: 100, label: 'Chest', unit: { id: 80, kind: 'object' } } })
    Object.assign(guide, { currentPlan: { goal: { level: 2, title: 'Chest' }, target: { x: 110, y: 100, unit: { id: 80, kind: 'object' } } } })
    units.push(unit({ id: 80, unitType: 'object', classId: 355, x: 110, y: 100 }))
    assists.hasLootNearby = () => true
    tick()
    expect([assists.holdLoot, assists.use.mock.calls[0]?.[0]]).toEqual([true, units[0]])
  })

  it('opens a closed door on its route instead of walking into it, and gives up on one that will not open', () => {
    const { assists, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' }, step: { kind: 'exit', level: 3 } })
    units.push(unit({ id: 90, unitType: 'object', classId: 13, x: 104, y: 100, mode: 0 }))
    const door = units[0]!
    Object.defineProperty(door, 'mode', { value: 0 })
    for (let i = 0; i < 12; i++) tick(700)
    const knocks = assists.use.mock.calls.filter(([used]) => used === door).length
    expect(knocks).toBeGreaterThan(0)
    expect(knocks).toBeLessThanOrEqual(8)
    expect(assists.walkTo).toHaveBeenCalled()
  })

  it('fights back when monsters pin it in place on the way to town', () => {
    const { pilot, world, assists, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    world.self.life = 15
    units.push(unit({ id: 60, x: 102, y: 100, name: 'Fallen' }))
    tick(200)
    expect(assists.standDown).toBe(true)
    tick(2000)
    expect([pilot.active, assists.standDown]).toEqual([true, false])
  })

  it('activates a waypoint it walks past that you do not have yet', () => {
    const { assists, guide, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    Object.assign(guide, { knowsWaypointIn: () => false })
    units.push(unit({ id: 41, unitType: 'object', classId: 119, x: 110, y: 100 }))
    tick()
    expect([guide.pilotStatus, assists.use.mock.calls[0]?.[0]]).toEqual(['Activating the waypoint', units[0]])
  })

  it('takes a teleport pad when the target cannot be walked to', () => {
    const { assists, guide, units, tick } = setup({ target: { x: 300, y: 100, label: 'The Summoner' } })
    Object.assign(guide, { reaches: () => false })
    units.push(unit({ id: 77, unitType: 'object', classId: 192, x: 106, y: 100 }))
    tick()
    expect([guide.pilotStatus, assists.use.mock.calls[0]?.[0]]).toEqual(['Taking the teleport pad', units[0]])
  })

  it('heads for a pad it has not seen yet when the level layout has one', () => {
    const { assists, guide, view, tick } = setup({ target: { x: 300, y: 100, label: 'The Summoner' } })
    Object.assign(guide, { reaches: () => false })
    view.presetUnits.push({ type: 2, index: 192, subX: 160, subY: 100 }, { type: 2, index: 192, subX: 40, subY: 100 })
    tick()
    expect(guide.pilotStatus).toBe('Taking the teleport pad')
    expect(assists.stepTo.mock.calls[0]?.[0] ?? assists.walkTo.mock.calls[0]?.[0]).toBeGreaterThan(100)
  })

  it('picks town on the waypoint it opened while heading home', () => {
    const { world, assists, hudManager, hudModel, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    assists.hasTownPortal = () => false
    world.self.life = 20
    units.push(unit({ id: 41, unitType: 'object', classId: 119, x: 102, y: 100 }))
    tick(2000)
    expect(assists.use).toHaveBeenCalledWith(units[0], expect.any(Number))
    hudManager.leftPanel = 'waypoint'
    tick()
    expect(hudModel.teleportToLevel).toHaveBeenCalledWith(ROGUE_ENCAMPMENT)
  })

  it('puts the Horadric Staff into the orifice when it opens', async () => {
    const { world, hudManager, hudModel, tick } = setup({ target: { x: 130, y: 100, label: 'Orifice' } })
    const staff = { id: 5, code: 'hst' }
    world.containers.inventory.set(5, staff)
    Object.assign(hudModel, { pickupItemToCursor: vi.fn(() => Object.assign(world.containers, { cursor: staff })), confirmQuestReward: vi.fn(), closeHoradricOrifice: vi.fn() })
    hudManager.leftPanel = 'orifice'
    tick()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect((hudModel as unknown as { confirmQuestReward: ReturnType<typeof vi.fn> }).confirmQuestReward).toHaveBeenCalledWith(5)
  })

  it('hunts a pack or an elite before a lone monster a little closer', () => {
    const { world, assists, units, tick } = setup({ target: { x: 130, y: 100, label: 'Cold Plains' } })
    Object.assign(assists, { pilotCombat: true, autoCombatKey: 'E' })
    ;[1, 2, 3, 4, 5].forEach((id) => world.containers.belt.set(id, { id, code: 'hp2' }))
    units.push(unit({ id: 70, x: 110, y: 100, name: 'Fallen' }), ...[71, 72, 73, 74].map((id, i) => unit({ id, x: 100 + (i % 2), y: 116 + i, name: 'Fallen' })))
    tick(1000)
    expect(assists.walkTo.mock.calls.at(-1)?.[1] ?? assists.stepTo.mock.calls.at(-1)?.[1]).toBeGreaterThan(105)
  })

  it('goes to town to stock up before walking into a boss', () => {
    const { world, assists, guide, tick } = setup({ step: { kind: 'portal', level: 46, hint: "Take the Summoner's portal", find: [60, 357] }, target: { x: 130, y: 100, label: 'Objective' } })
    world.areaId = 74
    Object.assign(guide, { currentPlan: guide.update() })
    tick()
    expect(guide.pilotStatus).toBe('Stocking up before the Summoner, heading to town')
    expect(assists.castTownPortal).toHaveBeenCalled()
  })

  it('goes training first when the next goal is too dangerous for its level', () => {
    const { world, guide, tick } = setup({ goal: { level: 37, title: 'Sisters to the Slaughter' }, target: { x: 130, y: 100, label: 'Catacombs' } })
    Object.assign(guide, { currentPlan: guide.update() })
    world.self.level = 3
    tick()
    expect(guide.detour).toMatchObject({ title: 'Training' })
    expect((guide.detour as { hint: string }).hint).toContain('Training to level')
  })

  it('respawns after dying and goes back for its body', () => {
    const { pilot, world, guide, hudModel, units, tick } = setup({})
    Object.assign(hudModel, { resurrect: vi.fn() })
    Object.assign(world, { selfId: 1 })
    Object.assign(world.self, { name: 'Hero' })
    world.isDead = true
    tick()
    expect([pilot.active, guide.pilotStatus]).toEqual([true, 'Died, going back for your body'])
    expect((hudModel as unknown as { resurrect: ReturnType<typeof vi.fn> }).resurrect).toHaveBeenCalled()
    expect(guide.detour).toBeNull()
    world.isDead = false
    world.self.x = 140
    tick()
    expect((guide as unknown as { detour: { level: number; spot: { x: number } } }).detour).toMatchObject({ level: BLOOD_MOOR, spot: { x: 100 } })
    world.self.x = 100
    units.push(unit({ id: 2, unitType: 'player', name: 'Hero', x: 101, y: 100, mode: 17 }))
    tick()
    expect(guide.pilotStatus).toBe('Picking up your body')
  })
})
