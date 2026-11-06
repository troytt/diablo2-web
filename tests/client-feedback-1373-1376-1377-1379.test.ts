import { describe, expect, it } from 'vitest'
import {
  buildSceneDrawables,
  sceneEntityCellDepth,
} from '../src/client/view/unit-drawables.ts'
import { findPathLocal } from '../src/common/path/pathfind.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  InventoryPanel,
  KEY_MAX_QUANTITY,
  getTomeQuantity,
  isKeyStackPair,
  type UiInventoryItem,
} from '../src/client/ui/inventory.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'

describe('Client feedback fixes (#1373, #1376, #1377, #1379)', () => {
  describe('#1376: wall flicker & entity/overlay cell depth parity with non-zero isoOriginY', () => {
    it('keeps overlay cell depth and sortY aligned with owner unit when isoOriginY > 0', () => {
      const { sortedDrawables } = buildSceneDrawables(
        [
          {
            id: 1,
            kind: 'player',
            classId: 1,
            name: 'Sorceress',
            x: 25,
            y: 30,
            isLocalPlayer: true,
            states: new Set([10]), // Frozen Armor overlay
            castState: {
              skillId: 44,
              mode: 10,
              targetX: 25,
              targetY: 30,
              startedAtMs: 1000,
              untilMs: 1400,
              elapsedMs: 80,
            },
          },
        ],
        {
          originX: 640,
          originY: 320,
          tick: 10,
        },
      )

      const unitDrawable = sortedDrawables.find((d) => d.drawableKind === 'unit')
      const overlays = sortedDrawables.filter((d) => d.drawableKind === 'overlay')
      expect(unitDrawable).toBeDefined()
      expect(overlays.length).toBeGreaterThan(0)

      const expectedCellDepth = Math.floor(25 / 5) + Math.floor(30 / 5)
      expect(sceneEntityCellDepth(unitDrawable!)).toBe(expectedCellDepth)
      for (const ov of overlays) {
        expect(ov.subX).toBe(25)
        expect(ov.subY).toBe(30)
        expect(sceneEntityCellDepth(ov)).toBe(expectedCellDepth)
        expect(ov.sortY - 320).toBe((25 + 30) * 8)
      }
    })
  })

  describe('#1373: near-wall pathfinding, staircase/item interaction LOS, and corpse summons', () => {
    it('finds a valid path along a wall when both start and goal hug the same wall', () => {
      const w = 24
      const h = 24
      const walkable = new Uint8Array(w * h).fill(1)
      // Solid wall along y = 5
      for (let x = 0; x < w; x++) {
        walkable[5 * w + x] = 0
      }
      // Player starts hugging the wall at (8, 6) and clicks a wall-embedded warp/item at (14, 5)
      const resWarp = findPathLocal(
        { subWidth: w, subHeight: h, walkable },
        8,
        6,
        14,
        5,
        { unitSize: 2 },
      )
      expect(resWarp.path.length).toBeGreaterThan(1)
      const endWarp = resWarp.path[resWarp.path.length - 1]!
      expect(Math.hypot(endWarp.x - 14, endWarp.y - 5)).toBeLessThanOrEqual(2.5)

      // Player at (8, 6) clicks a floor item hugging the wall at (14, 6)
      const resItem = findPathLocal(
        { subWidth: w, subHeight: h, walkable },
        8,
        6,
        14,
        6,
        { unitSize: 2 },
      )
      expect(resItem.path.length).toBeGreaterThan(1)
      const endItem = resItem.path[resItem.path.length - 1]!
      expect(Math.hypot(endItem.x - 14, endItem.y - 6)).toBeLessThanOrEqual(1.5)
    })

    it('consumes nearest corpse, broadcasts UnitRemove, and nudges wall-blocked summon spawns', () => {
      const game = new GameInstance({
        seed: 12345,
      })
      game.setTerrainWalkableCheck((_areaId, _x, y) => y >= 10) // y < 10 is solid wall
      const necId = game.addPlayer({
        name: 'Nec',
        classId: 2,
        level: 20,
        areaId: 2,
        x: 20,
        y: 10,
        skills: { 70: 5 }, // Raise Skeleton
      })

      const farCorpse = game.spawnMonster({
        classId: 0,
        name: 'Fallen1',
        areaId: 2,
        x: 28,
        y: 12,
        hp: 50,
        maxHp: 50,
      })
      const nearCorpse = game.spawnMonster({
        classId: 0,
        name: 'Fallen2',
        areaId: 2,
        x: 21,
        y: 10,
        hp: 50,
        maxHp: 50,
      })
      game.applyDamageToMonster(farCorpse, 500, necId)
      game.applyDamageToMonster(nearCorpse, 500, necId)
      game.stepFrame()

      // Summon while aiming at wall tile (21, 9) near nearCorpse (21, 10)
      const outcome = game.summonPet(necId, { skillId: 70, slvl: 5, x: 21, y: 9 })
      expect(outcome.created).toBe(true)
      expect(outcome.pet).toBeDefined()
      expect(outcome.pet!.y).toBeGreaterThanOrEqual(10)

      const frameEvents = game.stepFrame().get(necId) ?? []
      const removeEv = frameEvents.find(
        (e) => e.type === 'UnitRemove' && e.unitType === 1 && e.unitId === nearCorpse,
      )
      expect(removeEv).toBeDefined()
    })
  })

  describe('#1377: Frost Nova ground ring animation preservation and server AoE damage', () => {
    it('preserves active Frost Nova castState across early stop UnitMove until ring missiles fire', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 2
      world.apply(
        {
          type: 'UnitAssign',
          unitType: 'player',
          unitId: 1,
          classId: 1,
          name: 'Sor',
          x: 50,
          y: 50,
          areaId: 2,
        },
        1000,
      )
      world.apply(
        {
          type: 'SkillCast',
          caster: { unitType: 'player', id: 1 },
          skill: 44, // Frost Nova
          skillId: 44,
          level: 5,
          target: { x: 50, y: 50 },
          at: { x: 50, y: 50 },
        },
        1000,
      )
      // Server stop packet arrives 180ms after cast start (before ~240ms missileFireDelayMs)
      world.apply(
        {
          type: 'UnitMove',
          unitType: 'player',
          id: 1,
          unitId: 1,
          mode: 'stop',
          to: { x: 50, y: 50 },
          x: 50,
          y: 50,
          areaId: 2,
        },
        1180,
      )

      const player = world.getUnit('player', 1)
      expect(player?.castState).toBeDefined()

      // Advance past fire delay (~240ms): 64 frostnova missiles must spawn
      world.expireCastStates(1300, 120)
      const frostNovaMissiles = world
        .getUnitsByType('missile')
        .filter((m) => m.missileKey === 'frostnova')
      expect(frostNovaMissiles.length).toBe(64)
    })

    it('damages and chills surrounding monsters when casting Frost Nova (skill 44) on server', () => {
      const game = new GameInstance({ seed: 42 })
      const sorId = game.addPlayer({
        name: 'Sor',
        classId: 1,
        level: 20,
        areaId: 2,
        x: 40,
        y: 40,
        skills: { 44: 5 },
      })
      const m1 = game.spawnMonster({
        classId: 0,
        name: 'FallenA',
        areaId: 2,
        x: 43,
        y: 40,
        hp: 100,
        maxHp: 100,
      })
      const m2 = game.spawnMonster({
        classId: 0,
        name: 'FallenB',
        areaId: 2,
        x: 37,
        y: 42,
        hp: 100,
        maxHp: 100,
      })

      game.enqueueCommand(sorId, {
        type: 'CastSkillAtLocation',
        hand: 'right',
        skillId: 44,
        x: 40,
        y: 40,
      })
      const events = game.stepFrame().get(sorId) ?? []
      const hit1 = events.find(
        (e) => e.type === 'UnitStatUpdate' && e.unitType === 'monster' && e.unitId === m1 && e.statId === 6,
      )
      const hit2 = events.find(
        (e) => e.type === 'UnitStatUpdate' && e.unitType === 'monster' && e.unitId === m2 && e.statId === 6,
      )
      const chill1 = events.find(
        (e) => e.type === 'UnitState' && e.unitType === 'monster' && e.unitId === m1 && e.state === 11 && e.active === true,
      )
      const chill2 = events.find(
        (e) => e.type === 'UnitState' && e.unitType === 'monster' && e.unitId === m2 && e.state === 11 && e.active === true,
      )
      expect(hit1).toBeDefined()
      expect(hit2).toBeDefined()
      expect(chill1).toBeDefined()
      expect(chill2).toBeDefined()
    })
  })

  describe('#1379: Key stacking up to 12 in inventory grid and auto-pickup', () => {
    const makeKeyItem = (id: string, qty: number): UiInventoryItem => ({
      id,
      code: 'key',
      name: 'Key',
      nameZh: '钥匙',
      baseNameZh: '钥匙',
      quality: 'normal',
      invFile: 'invkey',
      invWidth: 1,
      invHeight: 1,
      allowedSlots: [],
      stats: [{ text: `数量: ${qty}` }],
      quantity: qty,
      maxQuantity: KEY_MAX_QUANTITY,
    })

    it('merges key stacks via clickGridCell and autoPlaceInGrid up to 12 and leaves overflow on cursor', () => {
      expect(isKeyStackPair('key', 'key')).toBe(true)
      const inv = new InventoryPanel()
      const k1 = makeKeyItem('k1', 5)
      const k2 = makeKeyItem('k2', 4)
      const k3 = makeKeyItem('k3', 6)

      expect(inv.autoPlaceInGrid(k1)).toBe(true)
      expect(inv.gridItems.length).toBe(1)
      expect(getTomeQuantity(inv.gridItems[0]!.item)).toBe(5)

      // Auto-placing a second stack of 4 keys merges into the first stack (5 + 4 = 9)
      expect(inv.autoPlaceInGrid(k2)).toBe(true)
      expect(inv.gridItems.length).toBe(1)
      expect(getTomeQuantity(inv.gridItems[0]!.item)).toBe(9)

      // Clicking cell (0, 0) with a stack of 6 keys on cursor fills stack to 12 and leaves 3 on cursor
      inv.cursorItem = k3
      expect(inv.clickGridCell(0, 0)).toBe(true)
      expect(getTomeQuantity(inv.gridItems[0]!.item)).toBe(12)
      expect(inv.cursorItem).not.toBeNull()
      expect(getTomeQuantity(inv.cursorItem!)).toBe(3)
    })
  })
})
