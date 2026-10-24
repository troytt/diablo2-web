/**
 * 1.13c Quest FX Client Missiles (`Issue #873`, follow-up to `#826`):
 *
 * - Den of Evil light beams (`denofevillight`, missile 287):
 *   - `0x6fb03550`: max 3 per room in 25 attempts on walkable sub-tiles, spawn flags `0x2003`
 *   - `0x6fb036f0` / `0x6faf40c0`: `denDone` trigger + `[room+0x34] |= 1` dedup mark
 *   - `CltDoFunc` 23 (`0x6fb62980`): extends `remainingTicks` to `500` whenever `< 100`
 *   - `#830` missile light emitter: `Light = 10`, white `(255, 255, 255)`, `CelFile = 'LightBeams'`
 * - Cairn Stones lightning (`cairnstones`, missile 288):
 *   - `0x6fb02d00`: spawns 288 at `StoneAlpha` on SpecialQuestEvent 1 alongside global fade
 *   - `CltDoFunc` 24 (`0x6fb6b8f0`):
 *     - Phase A (`40 < rem < 260`, `elapsed % 2 === 0`): sky bolts 384 (`cairn stones bolt`, `altitude = 280`, `-70/tick`, `TravelSound = 2255`)
 *     - Phase B (`40 < rem < 165`): stone-top sky bolts 384 + `rem % 8 === 0` ground arcs 290 (`cairnstonesground`) -> 99 (`lightninghit`)
 * - Diablo entrance (`diablo appears`, missile 372):
 *   - `0x6fb033f0`: spawns 372 at local player only when in Chaos Sanctuary (`levelId === 108`)
 *   - `CltDoFunc` 37 (`0x6fb62500`): screen shake (`4000 ms`, amplitude `25`) at `rem === 150`, sound `4638` at `rem === 50`
 */

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MISSILE_METAS } from '../../src/client/render/missiles-meta.ts'
import { ClientWorldSceneSource } from '../../src/client/view/scene-source.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { QUEST_FX_MISSILES_113C } from '../../src/client/world/quest-fx-data-113c.ts'
import { DEN_OF_EVIL_LEVEL_ID, QuestFxLight } from '../../src/client/world/quest-fx-light.ts'

describe('1.13c Quest FX Missiles (Issue #873)', () => {
  describe('Missiles.txt / Sounds.txt / Baked Atlas Ground Truth', () => {
    it('exports canonical 1.13c Missiles.txt rows for 99, 287, 288, 290, 372, 384', () => {
      expect(QUEST_FX_MISSILES_113C[287]).toEqual({
        id: 287,
        name: 'denofevillight',
        pCltDoFunc: 23,
        range: 300,
        vel: 0,
        maxVel: 0,
        param1: 0,
        cltParam1: 0,
        cltParam2: 0,
        cltParam3: 0,
        cltSubMissile1: -1,
        cltSubMissile2: -1,
        travelSound: 0,
        light: 10,
        flicker: 0,
        red: 255,
        green: 255,
        blue: 255,
        animLen: 21,
      })

      expect(QUEST_FX_MISSILES_113C[288]).toMatchObject({
        id: 288,
        name: 'cairnstones',
        pCltDoFunc: 24,
        range: 300,
        cltParam1: 40,
        cltParam2: 2,
        cltSubMissile1: 384,
        cltSubMissile2: 290,
      })

      expect(QUEST_FX_MISSILES_113C[384]).toMatchObject({
        id: 384,
        name: 'cairn stones bolt',
        pCltDoFunc: 1,
        cltParam1: 280,
        cltParam2: 70,
        light: 10,
        red: 255,
        green: 255,
        blue: 255,
        travelSound: 2255,
      })

      expect(QUEST_FX_MISSILES_113C[290]).toMatchObject({
        id: 290,
        name: 'cairnstonesground',
        pCltDoFunc: 8,
        vel: 20,
        cltSubMissile1: 99,
      })

      expect(QUEST_FX_MISSILES_113C[372]).toMatchObject({
        id: 372,
        name: 'diablo appears',
        pCltDoFunc: 37,
        range: 300,
        vel: 0,
      })
    })

    it('registers LightBeams (denofevillight) and cairn stones bolt in MISSILE_METAS and public/missiles/', () => {
      expect(MISSILE_METAS['denofevillight']).toBeDefined()
      expect(MISSILE_METAS['denofevillight']?.directions).toBe(4)
      expect(MISSILE_METAS['denofevillight']?.framesPerDirection).toBe(21)
      expect(MISSILE_METAS['denofevillight']?.celFile).toBe('LightBeams')
      expect(MISSILE_METAS['cairn stones bolt']).toBeDefined()

      expect(existsSync('public/missiles/denofevillight.png')).toBe(true)
      expect(existsSync('public/missiles/denofevillight.json')).toBe(true)
      expect(existsSync('public/missiles/lightbeams.png')).toBe(true)
      expect(existsSync('public/missiles/cairn stones bolt.png')).toBe(true)

      const meta = JSON.parse(readFileSync('public/missiles/denofevillight.json', 'utf8'))
      expect(meta.directions).toBe(4)
      expect(meta.framesPerDirection).toBe(21)
      expect(meta.groups.length).toBe(4)
    })
  })

  describe('Event 0 — Den of Evil Light Beams (Missile 287 / CltDoFunc 23)', () => {
    it('0x6fb03550: spawns at most 3 denofevillight units on walkable sub-tiles within the room (<= 25 attempts)', () => {
      const world = new ClientWorld()
      world.setQuestFxSeed(0x12345678)
      // Block half the room: only even x sub-tiles are walkable
      world.setCollisionChecker((x, y) => x < 100 || x >= 140 || y < 200 || y >= 240 || x % 2 !== 0)

      const spawned = world.spawnDenOfEvilLightsInRoom(100, 200, 40, 40)
      expect(spawned.length).toBe(3)
      for (const u of spawned) {
        expect(u.missileKey).toBe('denofevillight')
        expect(u.classId).toBe(287)
        expect(u.x).toBeGreaterThanOrEqual(100)
        expect(u.x).toBeLessThan(140)
        expect(u.y).toBeGreaterThanOrEqual(200)
        expect(u.y).toBeLessThan(240)
        expect(u.x % 2).toBe(0)
        expect(u.maxTicks).toBe(300)
        expect(u.loopAnim).toBe(true)
        expect(u.direction).toBeGreaterThanOrEqual(0)
        expect(u.direction).toBeLessThan(64)
        expect(u.initialFrame).toBeGreaterThanOrEqual(0)
        expect(u.initialFrame).toBeLessThan(21)
      }
    })

    it('0x6fb03550: spawns 0 units when the entire room is blocked after 25 attempts', () => {
      const world = new ClientWorld()
      world.setCollisionChecker(() => true)
      const spawned = world.spawnDenOfEvilLightsInRoom(100, 200, 40, 40)
      expect(spawned.length).toBe(0)
    })

    it('CltDoFunc 23 (0x6fb62980): extends remaining lifetime to 500 whenever remainingTicks < 100', () => {
      const world = new ClientWorld()
      world.setCollisionChecker(() => false)
      const [beam] = world.spawnDenOfEvilLightsInRoom(100, 100, 20, 20)
      expect(beam).toBeDefined()

      // Step 200 ticks: ageTicks = 200, remaining = 300 - 200 = 100 (not < 100 yet)
      for (let i = 0; i < 200; i++) {
        world.tick(40)
      }
      expect(beam!.ageTicks).toBe(200)
      expect(beam!.maxTicks).toBe(300)

      // Step tick 201: ageTicks = 201, remaining = 99 < 100 -> maxTicks = 201 + 500 = 701
      world.tick(40)
      expect(beam!.ageTicks).toBe(201)
      expect(beam!.maxTicks).toBe(701)

      // Step another 800 ticks: beam never expires
      for (let i = 0; i < 800; i++) {
        world.tick(40)
      }
      expect(world.getUnit('missile', beam!.id)).toBeDefined()
      expect(beam!.maxTicks! - beam!.ageTicks!).toBeGreaterThanOrEqual(100)
    })

    it('#830 missile light path: denofevillight (287) emits Light = 10 white emitter and LightBeams lighten sprite', () => {
      const world = new ClientWorld()
      world.setCollisionChecker(() => false)
      const [beam] = world.spawnDenOfEvilLightsInRoom(50, 60, 10, 10)
      expect(beam).toBeDefined()

      const drawables = buildSceneDrawables({
        units: [
          {
            kind: 'missile',
            id: beam!.id,
            classId: beam!.classId,
            missileKey: beam!.missileKey,
            x: beam!.x,
            y: beam!.y,
            frame: beam!.frame,
            totalFrames: beam!.totalFrames,
            loopAnim: beam!.loopAnim,
            direction: beam!.direction,
          },
        ],
        originX: 0,
        originY: 0,
      })

      expect(drawables.missileDrawables.length).toBe(1)
      expect(drawables.missileDrawables[0]).toMatchObject({
        missileClassId: 287,
        missileKey: 'denofevillight',
        celFile: 'LightBeams',
        blendMode: 'additive',
        trans: 1,
        lightRadius: 10,
        lightColor: [255, 255, 255],
      })

      expect(drawables.lightEmitters.length).toBe(1)
      expect(drawables.lightEmitters[0]).toMatchObject({
        unitType: 3,
        unitId: beam!.id,
        lightType: 1,
        radius: 10,
        red: 255,
        green: 255,
        blue: 255,
      })
    })

    it('0x6fb036f0 + 0x6faf40c0: spawns Den lights on denDone and deduplicates per room via [room+0x34] |= 1', () => {
      const fx = new QuestFxLight()
      const avail = new Uint8Array(37)
      avail[1] = 1
      fx.onQuestAvailability(avail)

      const spawnedRooms: string[] = []
      // Before denDone: revealing room (10, 20) sets [room+0x34] |= 1 without spawning
      fx.onRoomRevealed(DEN_OF_EVIL_LEVEL_ID, 10, 20, () => spawnedRooms.push('10,20-early'))
      expect(spawnedRooms).toEqual([])
      expect(fx.isRoomDenMarked(10, 20)).toBe(true)

      // Trigger SpecialQuestEvent 0 and step 30 ticks
      fx.onSpecialQuestEvent(0, { findStoneAlpha: () => false })
      for (let t = 0; t < 29; t++) {
        fx.tick(null, () => spawnedRooms.push('denDone'))
      }
      expect(spawnedRooms).toEqual([])

      // Tick 30 -> denDone = true, invokes 0x6fb036f0 callback
      fx.tick(null, () => {
        fx.markDenRoom(10, 20)
        spawnedRooms.push('10,20-onDenDone')
      })
      expect(fx.snapshot().denDone).toBe(true)
      expect(spawnedRooms).toEqual(['10,20-onDenDone'])

      // Duplicate RoomReveal on already-marked room (10, 20) does NOT spawn again
      fx.onRoomRevealed(DEN_OF_EVIL_LEVEL_ID, 10, 20, () => spawnedRooms.push('10,20-dup'))
      expect(spawnedRooms).toEqual(['10,20-onDenDone'])

      // Revealing a NEW room (18, 20) while denDone == true spawns once and marks it
      fx.onRoomRevealed(DEN_OF_EVIL_LEVEL_ID, 18, 20, () => spawnedRooms.push('18,20-reveal'))
      expect(spawnedRooms).toEqual(['10,20-onDenDone', '18,20-reveal'])
      expect(fx.isRoomDenMarked(18, 20)).toBe(true)

      // RoomHide clears the mark; re-revealing (18, 20) spawns again
      fx.onRoomHidden(DEN_OF_EVIL_LEVEL_ID, 18, 20)
      expect(fx.isRoomDenMarked(18, 20)).toBe(false)
      fx.onRoomRevealed(DEN_OF_EVIL_LEVEL_ID, 18, 20, () => spawnedRooms.push('18,20-rereveal'))
      expect(spawnedRooms).toEqual(['10,20-onDenDone', '18,20-reveal', '18,20-rereveal'])
    })

    it('0x6faf40c0: joining a game where A1Q1 was completed in a prior session (questAvail[1] == 0) leaves denDone == false and spawns no beams', () => {
      const fx = new QuestFxLight()
      const avail = new Uint8Array(37)
      avail[1] = 0
      fx.onQuestAvailability(avail)

      let spawned = 0
      fx.onRoomRevealed(DEN_OF_EVIL_LEVEL_ID, 10, 20, () => {
        spawned += 1
      })
      expect(fx.snapshot().denDone).toBe(false)
      expect(spawned).toBe(0)
    })
  })

  describe('Event 1 — Cairn Stones Lightning (Missile 288 / CltDoFunc 24)', () => {
    it('0x6fb02d00: SpecialQuestEvent 1 spawns cairnstones (288) at StoneAlpha and starts Stony Field fade', () => {
      const fx = new QuestFxLight()
      const world = new ClientWorld()
      const spawnedCoords: Array<{ x: number; y: number }> = []

      fx.onSpecialQuestEvent(1, {
        findStoneAlpha: () => ({ x: 500, y: 600 }),
        spawnCairnStones: (x, y) => {
          spawnedCoords.push({ x, y })
          world.spawnCairnStonesController(x, y)
        },
      })

      expect(spawnedCoords).toEqual([{ x: 500, y: 600 }])
      expect(fx.snapshot().fade.active).toBe(true)
      expect(fx.snapshot().fade.levelId).toBe(4)

      const ctrl = world.getUnitsByType('missile').find(u => u.missileKey === 'cairnstones')
      expect(ctrl).toBeDefined()
      expect(ctrl!.classId).toBe(288)
      expect(ctrl!.x).toBe(500)
      expect(ctrl!.y).toBe(600)
      expect(ctrl!.maxTicks).toBe(300)
    })

    it('CltDoFunc 24 (0x6fb6b8f0): Phase A spawns descending sky bolts (384, altitude 280 -> 0) + sound 2255; Phase B spawns stone bolts + ground arcs (290 -> 99)', () => {
      const world = new ClientWorld()
      world.setCollisionChecker(() => false)
      world.setQuestFxSeed(0xCAFEBABE)

      // Spawn 5 Cairn Stones (objects.txt class 17..21) near (500, 600)
      const stonePositions = [
        { id: 101, classId: 17, x: 500, y: 600 },
        { id: 102, classId: 18, x: 506, y: 596 },
        { id: 103, classId: 19, x: 510, y: 604 },
        { id: 104, classId: 20, x: 494, y: 606 },
        { id: 105, classId: 21, x: 492, y: 595 },
      ]
      for (const s of stonePositions) {
        world.apply({
          type: 'UnitAssign',
          unit: {
            unitType: 'object',
            id: s.id,
            classId: s.classId,
            x: s.x,
            y: s.y,
            mode: 0,
          },
        } as any)
      }

      world.spawnCairnStonesController(500, 600)

      // Ticks 1..40 (remBeforeStep 300..261): Phase A has not started yet (rem >= 260)
      for (let t = 0; t < 40; t++) {
        world.tick(40)
      }
      expect(world.getUnitsByType('missile').filter(u => u.missileKey === 'cairn stones bolt').length).toBe(0)

      // Tick 41 (prevAgeTicks = 40, remBeforeStep = 260 -> not < 260), Tick 43 (prevAgeTicks = 42, remBeforeStep = 258 < 260, elapsed % 2 == 0):
      world.tick(40) // tick 41 (rem=260)
      world.tick(40) // tick 42 (rem=259, elapsed=41 odd)
      world.tick(40) // tick 43 (rem=258, elapsed=42 even -> Phase A sky bolt!)

      const skyBoltsPhaseA = world.getUnitsByType('missile').filter(u => u.missileKey === 'cairn stones bolt')
      expect(skyBoltsPhaseA.length).toBe(1)
      const firstBolt = skyBoltsPhaseA[0]!
      expect(firstBolt.classId).toBe(384)
      expect(firstBolt.altitude).toBe(280)
      expect(firstBolt.verticalDescentPerTick).toBe(70)
      expect(firstBolt.maxTicks).toBe(4)
      expect(Math.abs(firstBolt.x - 500)).toBeLessThanOrEqual(16)
      expect(Math.abs(firstBolt.y - 600)).toBeLessThanOrEqual(16)

      // Verify CltDoFunc 22 vertical descent on firstBolt: 280 -> 210 -> 140 -> 70 -> expires
      world.tick(40) // tick 44
      expect(firstBolt.altitude).toBe(210)
      world.tick(40) // tick 45
      expect(firstBolt.altitude).toBe(140)
      world.tick(40) // tick 46
      expect(firstBolt.altitude).toBe(70)

      // Advance into Phase B (rem < 165, i.e. prevAgeTicks >= 136) until a rem % 8 == 0 tick (e.g. rem = 160 at prevAgeTicks = 140)
      // Currently at ageTicks = 46; advance 95 more ticks -> ageTicks = 141 (tick 141 had prevAgeTicks = 140, rem = 160)
      let sawGroundBolt = false
      let sawLightningHit = false
      for (let t = 46; t < 155; t++) {
        world.tick(40)
        const missiles = world.getUnitsByType('missile')
        if (missiles.some(u => u.missileKey === 'cairnstonesground')) {
          sawGroundBolt = true
        }
        if (missiles.some(u => u.missileKey === 'lightninghit')) {
          sawLightningHit = true
        }
      }
      expect(sawGroundBolt).toBe(true)
      expect(sawLightningHit).toBe(true)

      const hitUnits = world.getUnitsByType('missile').filter(u => u.missileKey === 'lightninghit')
      expect(hitUnits.length).toBeGreaterThan(0)
      for (const h of hitUnits) {
        expect(h.classId).toBe(99)
        expect(h.altitude).toBeGreaterThanOrEqual(-8)
        expect(h.altitude).toBeLessThanOrEqual(7)
      }
    })
  })

  describe('Event 12 — Diablo Appears (Missile 372 / CltDoFunc 37)', () => {
    it('0x6fb033f0 + CltDoFunc 37 (0x6fb62500): triggers 4000ms amp-25 screen shake at rem=150 and sound 4638 at rem=50', () => {
      const world = new ClientWorld()
      world.setQuestFxSeed(0x13572468)

      const ctrl = world.spawnDiabloAppearsController(7770, 5280)
      expect(ctrl.classId).toBe(372)
      expect(ctrl.missileKey).toBe('diablo appears')
      expect(ctrl.maxTicks).toBe(300)
      expect(world.screenShake.active).toBe(false)

      // Step 150 ticks (prevAgeTicks = 0..149, remBeforeStep = 300..151): no shake yet
      for (let t = 0; t < 150; t++) {
        world.tick(40)
      }
      expect(world.screenShake.active).toBe(false)

      // Tick 151 (prevAgeTicks = 150, remBeforeStep = 150): StartScreenShake(4000, 25, 0, 0)
      world.tick(40)
      expect(world.screenShake.active).toBe(true)
      expect(world.screenShake.sustainMs).toBe(4000)
      expect(world.screenShake.amplitude).toBe(25)
      expect(world.screenShake.offsetX).toBeGreaterThanOrEqual(-25)
      expect(world.screenShake.offsetX).toBeLessThan(25)
      expect(world.screenShake.offsetY).toBeGreaterThanOrEqual(-25)
      expect(world.screenShake.offsetY).toBeLessThan(25)

      // Verify ClientWorldSceneSource applies shakeOffsetX / shakeOffsetY to camera top-left
      const sceneWithShake = new ClientWorldSceneSource(
        () => ({
          tick: world.frameCount,
          actId: 3,
          levelId: 108,
          playerSubX: 7770,
          playerSubY: 5280,
          units: [],
          levelView: null,
          ambient: null,
          shakeOffsetX: 14,
          shakeOffsetY: -9,
        }),
      )
      const sceneNoShake = new ClientWorldSceneSource(
        () => ({
          tick: world.frameCount,
          actId: 3,
          levelId: 108,
          playerSubX: 7770,
          playerSubY: 5280,
          units: [],
          levelView: null,
          ambient: null,
          shakeOffsetX: 0,
          shakeOffsetY: 0,
        }),
      )
      const camShaken = sceneWithShake.getCameraTopLeft()
      const camBase = sceneNoShake.getCameraTopLeft()
      expect(camShaken.x - camBase.x).toBe(14)
      expect(camShaken.y - camBase.y).toBe(-9)

      // Step 99 more ticks (ticks 152..250, remBeforeStep = 149..51): shake active
      for (let t = 151; t < 250; t++) {
        world.tick(40)
      }

      // Tick 251 (prevAgeTicks = 250, remBeforeStep = 50): 4000ms shake ends
      world.tick(40)
      // 100 ticks * 40ms = 4000ms elapsed since tick 151 -> screen shake has completed
      expect(world.screenShake.active).toBe(false)
      expect(world.screenShake.offsetX).toBe(0)
      expect(world.screenShake.offsetY).toBe(0)

      // Step remaining 49 ticks (252..300) -> controller expires cleanly
      for (let t = 251; t < 300; t++) {
        world.tick(40)
      }
      expect(world.getUnit('missile', ctrl.id)).toBeUndefined()
    })
  })
})
