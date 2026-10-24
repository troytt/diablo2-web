import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/d2gs/registry.ts'
import {
  CANONICAL_113C_OBJECTS,
  getObjectHitBox113c,
  isObjectInInteractRange113c,
  isObjectSelectableInMode,
} from '../../src/common/world/objects-meta.ts'

function opcodeOf(cmd: ClientCommand | null | undefined): number {
  if (!cmd) throw new Error('Expected ClientCommand')
  return encodeD2gsClientCommand(cmd)[0]![0]!
}

function createDarkWoodHarness(selfX = 4997, selfY = 5000) {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sent: ClientCommand[] = []
  const hudModel = new HudModel({
    world,
    hudManager,
    onCommand: (cmd) => sent.push(cmd),
  })
  hudManager.commandSink = hudModel

  const mockCamera = {
    subtileToScreen(x: number, y: number) {
      return { x: (x - 5000) * 16 + 560, y: (y - 5000) * 8 + 300 }
    },
    screenToSubtile(x: number, y: number) {
      return { x: (x - 560) / 16 + 5000, y: (y - 300) / 8 + 5000 }
    },
    update() {},
  }

  const predictor = new LocalMovementPredictor({
    initialX: selfX,
    initialY: selfY,
  })

  const subWidth = 64
  const subHeight = 64
  const walkable = new Uint8Array(subWidth * subHeight)
  walkable.fill(1)
  const levelView = {
    levelId: 5,
    subOriginX: 4968,
    subOriginY: 4968,
    subWidth,
    subHeight,
    walkable,
  }
  const mockAutomapView = {
    getLevelView: () => levelView,
  }

  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    predictor,
    automapView: mockAutomapView as any,
    camera: mockCamera as any,
    sendCommand: (cmd) => sent.push(cmd),
  })

  // Dark Wood (areaId = 5)
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 5 })
  world.apply({
    type: 'UnitAssign',
    isSelf: true,
    unit: {
      unitType: 0,
      id: 1,
      classId: 1,
      name: 'Sorceress',
      x: selfX,
      y: selfY,
      mode: 1,
      lifePct: 128,
    },
  })

  // Tree of Inifuss (classId = 30, 5x5 collision box around (5000, 5000))
  world.apply({
    type: 'UnitAssign',
    unit: {
      unitType: 2,
      id: 300,
      classId: 30,
      name: 'Tree of Inifuss',
      x: 5000,
      y: 5000,
      mode: 0,
    },
  })

  return { world, hudManager, hudModel, predictor, mapper, sent, mockCamera, levelView }
}

describe('1.13c Object Interaction Range (D2Common #10594) & HitTest (0x6fb568e0) — Issue #846 & Quest Objects Audit', () => {
  it('1. Canonical 1.13c Objects.txt metadata populates SizeX/SizeY and CollisionSubst for Tree of Inifuss (Id=30) and quest objects', () => {
    expect(CANONICAL_113C_OBJECTS[30]?.sizeX).toBe(5)
    expect(CANONICAL_113C_OBJECTS[30]?.sizeY).toBe(5)
    expect(CANONICAL_113C_OBJECTS[30]?.collisionSubst).toBe(true)
    expect(CANONICAL_113C_OBJECTS[30]?.hasCollisionMask).toBe(255)
    expect(CANONICAL_113C_OBJECTS[17]?.sizeX).toBe(3) // Cairn Stone
    expect(CANONICAL_113C_OBJECTS[26]?.sizeX).toBe(3) // Cain's Gibbet
    expect(CANONICAL_113C_OBJECTS[50]?.sizeX).toBe(5) // Casket (5x3)
    expect(CANONICAL_113C_OBJECTS[50]?.sizeY).toBe(3)
    expect(CANONICAL_113C_OBJECTS[149]?.sizeX).toBe(4) // Act 2 Tainted Sun Altar (4x2)
    expect(CANONICAL_113C_OBJECTS[149]?.sizeY).toBe(2)
    expect(CANONICAL_113C_OBJECTS[149]?.hasCollisionMask).toBe(255)
    expect(CANONICAL_113C_OBJECTS[404]?.sizeX).toBe(3) // Act 3 Compelling Orb (3x3)
    expect(CANONICAL_113C_OBJECTS[404]?.sizeY).toBe(3)
    expect(CANONICAL_113C_OBJECTS[404]?.hasCollisionMask).toBe(1)
  })

  it('2. isObjectInInteractRange113c matches D2Common #10594 (0x6fd81000) for 5x5 Tree of Inifuss, 4x2 Tainted Sun Altar, 3x3 Compelling Orb, and 0x0 objects', () => {
    // Tree of Inifuss (Id=30, 5x5) at (5000, 5000): minX = 4998, minY = 4998 -> box [4996..5005] x [4996..5005] minus 4 extreme corners
    expect(isObjectInInteractRange113c(4997, 5000, 2, 5000, 5000, 30)).toBe(true) // dist = 3.0 (cardinal collision stand-off)
    expect(isObjectInInteractRange113c(4997, 4997, 2, 5000, 5000, 30)).toBe(true) // dist = 4.24 (diagonal collision stand-off)
    expect(isObjectInInteractRange113c(5003, 5003, 2, 5000, 5000, 30)).toBe(true) // dist = 4.24 (SE collision stand-off)

    // Non-corner edges at minX - 2 / minX + 5 + 2
    expect(isObjectInInteractRange113c(4996, 4997, 2, 5000, 5000, 30)).toBe(true)
    expect(isObjectInInteractRange113c(4997, 4996, 2, 5000, 5000, 30)).toBe(true)
    expect(isObjectInInteractRange113c(5005, 5004, 2, 5000, 5000, 30)).toBe(true)

    // 4 extreme corners of [-2, +Size+2] are excluded when unitSizeX <= 2 (0x6fd81130..0x6fd81174)
    expect(isObjectInInteractRange113c(4996, 4996, 2, 5000, 5000, 30)).toBe(false)
    expect(isObjectInInteractRange113c(5005, 4996, 2, 5000, 5000, 30)).toBe(false)
    expect(isObjectInInteractRange113c(4996, 5005, 2, 5000, 5000, 30)).toBe(false)
    expect(isObjectInInteractRange113c(5005, 5005, 2, 5000, 5000, 30)).toBe(false)
    expect(isObjectInInteractRange113c(4996, 4996, 3, 5000, 5000, 30)).toBe(true) // unitSizeX > 2 accepts corners

    // Out of range
    expect(isObjectInInteractRange113c(4995, 5000, 2, 5000, 5000, 30)).toBe(false)
    expect(isObjectInInteractRange113c(5006, 5000, 2, 5000, 5000, 30)).toBe(false)

    // Act 2 Tainted Sun Altar (Id=149, 4x2) at (5000, 5000): minX = 4998 -> -X staircase stand-off at ux = 4997 (dist = 3.0)
    expect(isObjectInInteractRange113c(4997, 5000, 2, 5000, 5000, 149)).toBe(true)
    expect(isObjectInInteractRange113c(4997, 4998, 2, 5000, 5000, 149)).toBe(true)

    // Act 3 Compelling Orb (Id=404, 3x3) at (5000, 5000): diagonal stand-off at (4998, 4998) (dist = 2.83)
    expect(isObjectInInteractRange113c(4998, 4998, 2, 5000, 5000, 404)).toBe(true)
    expect(isObjectInInteractRange113c(5002, 5002, 2, 5000, 5000, 404)).toBe(true)

    // 0x0 object (Id=160, SizeX=0, SizeY=0) uses +-1 subtile box (0x6fd810af..0x6fd810ee)
    expect(isObjectInInteractRange113c(5001, 5001, 2, 5000, 5000, 160)).toBe(true)
    expect(isObjectInInteractRange113c(5002, 5000, 2, 5000, 5000, 160)).toBe(false)
  })

  it('3. getObjectHitBox113c & ClientUnit.getHitBox match D2Client HitTest (0x6fb55720 HitTestFixedBox & 0x6fb56730 GetUnitFrameBounds)', () => {
    const inifuss = new ClientUnit({
      unitType: 'object',
      id: 300,
      classId: 30,
      name: 'Tree of Inifuss',
      x: 5000,
      y: 5000,
      mode: 0,
    })
    expect(inifuss.getHitBox()).toEqual({ left: -40, top: -40, width: 80, height: 80 })
    expect(getObjectHitBox113c(59, 2)).toEqual({ left: -40, top: -100, width: 80, height: 110 }) // Town Portal (CollisionSubst = 1)
    expect(getObjectHitBox113c(26, 0)).toEqual({ left: -78, top: -141, width: 118, height: 207 }) // Cain's Gibbet (GetUnitFrameBounds)
    expect(getObjectHitBox113c(13, 0)).toEqual({ left: -48, top: -91, width: 64, height: 135 }) // Closed Door (GetUnitFrameBounds)
    expect(getObjectHitBox113c(13, 2)).toEqual({ left: -20, top: -80, width: 40, height: 40 }) // Open Door (HitTestFixedBox)
    expect(getObjectHitBox113c(149, 0)).toEqual({ left: -87, top: -37, width: 109, height: 88 }) // Act 2 Tainted Sun Altar
    expect(getObjectHitBox113c(404, 0)).toEqual({ left: -62, top: -54, width: 94, height: 95 }) // Act 3 Compelling Orb
  })

  it('4. Mode-specific hitBoxes, placeholder token fallbacks (Id=194 Kurast stairs), and sequential Objects.txt row indexing (408..412)', () => {
    // Act 3 Kurast Temple Stairs (Id=194, placeholder Token="SL" -> lookup "9C")
    expect(getObjectHitBox113c(194, 0)).toEqual({ left: -120, top: -93, width: 208, height: 164 })

    // Act 5 Worldstone Chamber portal (Id=563, Selectable=[0,1,1,0...]) uses modes 1/2 212x247 bounds, not 8x8 nu dummy
    expect(getObjectHitBox113c(563, 1)).toEqual({ left: -129, top: -156, width: 212, height: 247 })
    expect(getObjectHitBox113c(563, 2)).toEqual({ left: -129, top: -156, width: 212, height: 247 })
    expect(getObjectHitBox113c(569, 2)).toEqual({ left: -129, top: -156, width: 212, height: 247 })

    // Act 5 strlastcinematic (Id=565) has different frame bounds in mode 1 (OP) vs mode 2 (ON)
    expect(getObjectHitBox113c(565, 1)).toEqual({ left: -129, top: -135, width: 228, height: 228 })
    expect(getObjectHitBox113c(565, 2)).toEqual({ left: -85, top: -111, width: 139, height: 178 })

    // Sequential D2Common DATATBLS_LoadObjectsTxt (0x6fd90b2a) rows 408..412
    expect(isObjectSelectableInMode(408, 0)).toBe(false) // Dummy (Token=98)
    expect(isObjectSelectableInMode(409, 0)).toBe(false) // Dummy (Token=99)
    expect(isObjectSelectableInMode(410, 0)).toBe(true) // Siege Control (Token=ZQ)
    expect(CANONICAL_113C_OBJECTS[410]?.nameEn).toBe('Siege Control')
    expect(getObjectHitBox113c(410, 0)).toEqual({ left: -57, top: -62, width: 73, height: 88 })
    expect(CANONICAL_113C_OBJECTS[411]?.token).toBe('PX')
    expect(CANONICAL_113C_OBJECTS[412]?.token).toBe('PY')
  })

  it('5. Clicking Tree of Inifuss (Id=30) while standing at its 5x5 collision boundary (with Quest Log open) immediately sends C2S 0x13 Interact without walking into the tree', () => {
    // Player at (4997, 4997) -> diagonal stand-off (dist = 4.24 > 2.5) next to 5x5 Tree of Inifuss at (5000, 5000)
    const { hudManager, predictor, mapper, sent, mockCamera } = createDarkWoodHarness(4997, 4997)
    hudManager.leftPanel = 'quest'

    const treeScreen = mockCamera.subtileToScreen(5000, 5000)
    // Click on lower roots (y + 24, previously missed by old {-24, -48, 48, 48} hitbox)
    mapper.handlePointerDown(treeScreen.x, treeScreen.y + 24, 0, 1000)
    mapper.handlePointerUp(0)

    expect(sent.at(-1)).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: 300 },
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x13)
    expect(mapper.getPendingObjectInteractId()).toBeNull()
    expect(predictor.getSnapshot().moving).toBe(false)
  })

  it('6. Clicking a solid quest object from far away stamps its HasCollision footprint into local A* pathfinding and stops predictor upon arrival', () => {
    const { world, predictor, mapper, sent, mockCamera } = createDarkWoodHarness(4990, 5000)
    // Replace Tree of Inifuss with Act 2 Tainted Sun Altar (classId = 149, 4x2 solid footprint [4998..5001] x [4999..5000])
    world.apply({ type: 'UnitRemove', unitType: 2, id: 300 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 1490,
        classId: 149,
        name: 'Tainted Sun Altar',
        x: 5000,
        y: 5000,
        mode: 0,
      },
    })

    const altarScreen = mockCamera.subtileToScreen(5000, 5000)
    const rec = mapper.handlePointerDown(altarScreen.x, altarScreen.y, 0, 1000)
    mapper.handlePointerUp(0)

    expect(sent.at(-1)).toEqual({
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 2, id: 1490 },
    })
    expect(mapper.getPendingObjectInteractId()).toBe(1490)
    // Path goal must stop outside the 4x2 solid footprint [4998..5001] x [4999..5000] (e.g. x = 4997, y = 5000)
    const goal = rec?.path?.at(-1)
    expect(goal).toBeDefined()
    expect(goal!.x <= 4997 || goal!.x >= 5002 || goal!.y <= 4998 || goal!.y >= 5001).toBe(true)
    expect(isObjectInInteractRange113c(goal!.x, goal!.y, 2, 5000, 5000, 149)).toBe(true)

    // Step predictor along the path until arrival
    predictor.update(2000)
    const arrivalCmd = mapper.tick(1300)
    expect(arrivalCmd).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: 1490 },
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x13)
    expect(mapper.getPendingObjectInteractId()).toBeNull()
    expect(predictor.getSnapshot().moving).toBe(false)
  })

  it('7. Multi-clicking Act 3 Compelling Orb (Id=404, 3x3, IsAttackable0=1) at diagonal stand-off (dist=2.83) repeatedly sends C2S 0x13 Interact without walking into the orb', () => {
    const { world, predictor, mapper, sent, mockCamera } = createDarkWoodHarness(4998, 4998)
    world.apply({ type: 'UnitRemove', unitType: 2, id: 300 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 4040,
        classId: 404,
        name: 'Compelling Orb',
        x: 5000,
        y: 5000,
        mode: 0,
      },
    })

    const orbScreen = mockCamera.subtileToScreen(5000, 5000)
    for (const t of [1000, 1400, 1800]) {
      mapper.handlePointerDown(orbScreen.x, orbScreen.y - 20, 0, t)
      mapper.handlePointerUp(0)
      expect(sent.at(-1)).toEqual({
        type: 'Interact',
        target: { unitType: 2, id: 4040 },
      })
      expect(opcodeOf(sent.at(-1))).toBe(0x13)
      expect(predictor.getSnapshot().moving).toBe(false)
    }
  })

  it('8. Waypoints obey pure #10594: a 1x1 waypoint at hypot 4.0 no longer opens from afar — the click walks in and only fires 0x13 inside the footprint ±2 box', () => {
    // Act 2-style waypoint (classId = 145, SizeX/SizeY = 1): the 1.13c box is
    // [objX-2 .. objX+3] x [objY-2 .. objY+3] with the 4 extreme corners trimmed to ±1.
    // Player 4 sub-tiles west (4996) is OUTSIDE that box but INSIDE the old hypot<=4.5 slack.
    const { world, predictor, mapper, sent, mockCamera } = createDarkWoodHarness(4996, 5000)
    world.apply({ type: 'UnitRemove', unitType: 2, id: 300 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 1450,
        classId: 145,
        name: 'Waypoint',
        x: 5000,
        y: 5000,
        mode: 2,
      },
    })

    const wpScreen = mockCamera.subtileToScreen(5000, 5000)
    mapper.handlePointerDown(wpScreen.x, wpScreen.y, 0, 1000)
    mapper.handlePointerUp(0)
    expect(sent.at(-1)).toEqual({
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 2, id: 1450 },
    })
    expect(mapper.getPendingObjectInteractId()).toBe(1450)

    predictor.update(2000)
    const arrivalCmd = mapper.tick(1300)
    expect(arrivalCmd).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: 1450 },
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x13)
    const snap = predictor.getSnapshot()
    expect(isObjectInInteractRange113c(Math.round(snap.x), Math.round(snap.y), 2, 5000, 5000, 145)).toBe(true)
    expect(Math.hypot(5000 - snap.x, 5000 - snap.y)).toBeLessThanOrEqual(3)
    expect(mapper.getPendingObjectInteractId()).toBeNull()
    expect(predictor.getSnapshot().moving).toBe(false)
  })

  it('9. Act 1 waypoint (Id=119, 5x5) still interacts immediately from its collision boundary (box edge = footprint ±2)', () => {
    // 5x5 footprint [4998..5002]: minX = 4998, box x in [4996..5005]. Standing at (4996, 5000)
    // is on the trimmed-edge row range (inside y band), so 0x13 fires at once like vanilla.
    const { world, predictor, mapper, sent, mockCamera } = createDarkWoodHarness(4996, 5000)
    world.apply({ type: 'UnitRemove', unitType: 2, id: 300 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 1190,
        classId: 119,
        name: 'Waypoint',
        x: 5000,
        y: 5000,
        mode: 2,
      },
    })

    const wpScreen = mockCamera.subtileToScreen(5000, 5000)
    mapper.handlePointerDown(wpScreen.x, wpScreen.y, 0, 1000)
    mapper.handlePointerUp(0)
    expect(sent.at(-1)).toEqual({
      type: 'Interact',
      target: { unitType: 2, id: 1190 },
    })
    expect(opcodeOf(sent.at(-1))).toBe(0x13)
    expect(mapper.getPendingObjectInteractId()).toBeNull()
    expect(predictor.getSnapshot().moving).toBe(false)
  })
})
