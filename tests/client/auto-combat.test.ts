import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

const createSetup = (areaId = 2) => {
  const world = new ClientWorld()
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100 }, isSelf: true })
  const hudManager = new HudManager()
  hudManager.resize(800, 600)
  const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
  const camera = new ViewportCamera('800x600')
  camera.snapTo(100, 100)
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({ world, hudManager, predictor, onCommand: (cmd) => sent.push(cmd) })
  const mapper = new CommandMapper({ world, camera, hudManager, hudModel, predictor, sendCommand: (cmd) => sent.push(cmd) })
  mapper.autoCombatKey = 'E'
  const spawn = (id: number, classId: number, x: number, y: number) =>
    world.apply({ type: 'UnitAssign', unit: { unitType: 1, id, classId, name: 'Monster', x, y, lifePct: 128, mode: 1 } })
  const attacked = () => sent.flatMap((c) => (c.type === 'SkillOn' ? [c.target.id] : []))
  const barTarget = () => (hudModel as unknown as { hoveredMonsterId: number | null }).hoveredMonsterId
  const fightFor = (fromMs: number, toMs: number) => {
    for (let t = fromMs; t <= toMs; t += 40) mapper.tickAssists(t)
  }
  return { world, mapper, sent, spawn, attacked, barTarget, fightFor, camera, hud: hudManager }
}

describe('auto-fight toggle', () => {
  it('toggles on with one press, keeps fighting without holding, and toggles off with the next press', () => {
    const s = createSetup()
    s.spawn(901, 19, 103, 100)
    s.fightFor(1000, 1200)
    expect(s.attacked()).toEqual([])
    s.mapper.handleKeyDown({ key: 'e' })
    s.mapper.handleKeyUp({ key: 'e' })
    s.mapper.handleKeyDown({ key: 'e', repeat: true })
    s.fightFor(1240, 1400)
    const whileOn = s.attacked().length
    expect(s.hud.autoCombatBadge).toEqual({ on: true, key: 'E' })
    s.mapper.handleKeyDown({ key: 'e' })
    s.fightFor(1440, 1700)
    expect(whileOn).toBeGreaterThan(0)
    expect(s.attacked().length).toBe(whileOn)
    expect(s.hud.autoCombatBadge).toEqual({ on: false, key: 'E' })
  })

  it('removes the indicator and switches off when the plugin unbinds the key', () => {
    const s = createSetup()
    s.mapper.handleKeyDown({ key: 'e' })
    s.mapper.autoCombatKey = null
    s.spawn(901, 19, 103, 100)
    s.fightFor(1000, 1200)
    expect([s.attacked(), s.hud.autoCombatBadge]).toEqual([[], null])
  })

  it('attacks the nearest on-screen enemy, including ones out of melee range', () => {
    const s = createSetup()
    s.spawn(901, 19, 110, 100)
    s.spawn(902, 19, 106, 101)
    s.mapper.handleKeyDown({ key: 'E' })
    s.fightFor(1000, 1000)
    expect(s.attacked()).toEqual([902])
  })

  it('sticks with its target until it dies, then moves to the next', () => {
    const s = createSetup()
    s.spawn(901, 19, 104, 100)
    s.mapper.handleKeyDown({ key: 'E' })
    s.fightFor(1000, 1000)
    s.spawn(902, 19, 101, 100)
    s.fightFor(1040, 1200)
    expect(new Set(s.attacked())).toEqual(new Set([901]))
    s.world.getUnit('monster', 901)!.lifePct = 0
    s.fightFor(1240, 1300)
    expect(s.attacked().at(-1)).toBe(902)
  })

  it('ignores enemies off screen and town NPCs', () => {
    const s = createSetup(1)
    s.spawn(901, 19, 160, 160)
    s.spawn(148, 148, 102, 100)
    s.mapper.handleKeyDown({ key: 'E' })
    s.fightFor(1000, 1200)
    expect(s.attacked()).toEqual([])
  })

  it('shows the fought monster in the health bar even when the cursor rests elsewhere', () => {
    const s = createSetup()
    s.spawn(901, 19, 103, 100)
    s.mapper.handleKeyDown({ key: 'E' })
    s.fightFor(1000, 1000)
    const ground = s.camera.subtileToScreen(90, 110)
    s.mapper.handlePointerMove(ground.x, ground.y, 1020)
    expect(s.barTarget()).toBe(901)
  })
})

describe('monster health bar while holding the mouse', () => {
  it('follows the monster a drag-attack hits, not the press point', () => {
    const s = createSetup()
    s.mapper.dragInteractMode = true
    s.world.getUnit('player', 1)!.mode = 3
    s.spawn(901, 19, 103, 100)
    const ground = s.camera.subtileToScreen(100, 94)
    s.mapper.handlePointerDown(ground.x, ground.y, 0, 1000)
    const monster = s.camera.subtileToScreen(103, 100)
    s.mapper.handlePointerMove(monster.x, monster.y, 1050)
    s.mapper.tick(1100)
    expect(s.barTarget()).toBe(901)
  })
})

describe('clicking with a side panel open', () => {
  it('hits the monster where it is drawn after the camera shifts for the panel', async () => {
    const { subTileToScreen, computePanelCameraShift } = await import('../../src/client/view/viewport-profile.ts')
    const s = createSetup()
    s.spawn(901, 19, 96, 104)
    for (const [left, right] of [['char', 'none'], ['none', 'inv']] as const) {
      s.hud.leftPanel = left
      s.hud.rightPanel = right
      const drawn = subTileToScreen(96, 104, 100, 100, s.camera.viewportProfile, computePanelCameraShift(left !== 'none', right !== 'none'))
      expect(s.mapper.resolvePointerTarget(drawn.x, drawn.y).hoveredUnit?.id).toBe(901)
    }
  })
})

describe('auto-fight hit confirmation', () => {
  const attackTimes = (onAttack: (s: ReturnType<typeof createSetup>, count: number) => void) => {
    const s = createSetup()
    s.spawn(901, 19, 101, 100)
    s.mapper.handleKeyDown({ key: 'E' })
    const times: number[] = []
    for (let t = 1000; t <= 4000 && times.length < 3; t += 40) {
      const before = s.attacked().length
      s.mapper.tickAssists(t)
      if (s.attacked().length > before) {
        times.push(t)
        onAttack(s, times.length)
      }
    }
    return { times, s }
  }

  it('swings again as soon as the swing ends when the hit registered, and waits about a round trip when nothing came back', () => {
    const registered = attackTimes((s, n) => void (s.world.getUnit('monster', 901)!.lifePct = 120 - n * 10)).times
    const silent = attackTimes(() => {}).times
    const gap = (t: number[]) => t[1]! - t[0]!
    expect(registered.length).toBeGreaterThanOrEqual(2)
    expect(gap(silent) - gap(registered)).toBeGreaterThanOrEqual(280)
  })

  it('moves straight to the next enemy when the target dies during the swing', () => {
    const { s } = attackTimes((setup, n) => {
      if (n === 1) {
        setup.world.getUnit('monster', 901)!.lifePct = 0
        setup.spawn(902, 19, 103, 101)
      }
    })
    expect(s.attacked().slice(0, 2)).toEqual([901, 902])
  })
})

describe('dead monsters whose corpse cannot be selected', () => {
  type Corpse = { states: Set<number>; corpseSuppressed: boolean }
  const UNSELECTABLE: readonly [string, (unit: Corpse) => void][] = [
    ['shattered', (u) => void u.states.add(107)],
    ['corpse no-select', (u) => void u.states.add(118)],
    ['corpse no-draw', (u) => void u.states.add(104)],
    ['exploded', (u) => void u.states.add(173)],
    ['redeemed', (u) => void u.states.add(99)],
    ['suppressed', (u) => void (u.corpseSuppressed = true)],
  ]

  const killUnselectably = (s: ReturnType<typeof createSetup>, id: number, mark: (typeof UNSELECTABLE)[number][1]) => {
    const unit = s.world.getUnit('monster', id)!
    unit.mode = 12
    unit.lifePct = 0
    mark(unit as unknown as Corpse)
  }

  it.each(UNSELECTABLE)('auto-fight never swings at a %s corpse and moves on to the living', (_name, mark) => {
    const s = createSetup()
    s.spawn(901, 19, 101, 100)
    s.spawn(902, 19, 104, 100)
    s.mapper.handleKeyDown({ key: 'E' })
    s.fightFor(1000, 1000)
    expect(s.attacked()).toEqual([901])
    killUnselectably(s, 901, mark)
    s.sent.length = 0
    s.fightFor(1040, 1600)
    expect(s.attacked().length).toBeGreaterThan(0)
    expect(s.attacked().every((id) => id === 902)).toBe(true)
  })

  it.each(UNSELECTABLE)('holding the mouse on a %s corpse does not attack it', (_name, mark) => {
    const s = createSetup()
    s.spawn(901, 19, 103, 100)
    killUnselectably(s, 901, mark)
    const corpse = s.camera.subtileToScreen(103, 100)
    s.mapper.handlePointerDown(corpse.x, corpse.y, 0, 1000)
    for (let t = 1040; t <= 1600; t += 40) s.mapper.tick(t)
    expect(s.attacked()).toEqual([])
  })
})
