import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  ANYA_CLASS_REWARD_POOLS_113C,
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C,
  PRE_OPERATE_CLASS_IDS_113C,
  computeChestTrapChancePct113c,
  rollChestTrapType113c,
  rollPreOperateOpen113c,
} from '../../src/common/world/object-operate-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

function qIdx(questId: string): number {
  return questWordIndex113c(questId)!
}

function makeItem(
  unitId: number,
  code: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 25,
    location: 'inventory',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId: 1,
    ownerId: 1,
    bodyLoc: 0,
    storePage: 0,
    cost: 100,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 20,
    maxDurability: 20,
    quantity: 1,
    stats: new Map<number, number>(),
    socketedItems: [],
    rawItemData: { setItemId: 0xfff, ilvl: 25 },
    ...overrides,
  }
}

describe('P1 Wave 4 — Quests, Objects, Corpse, Ground Expiry & Room AOI (#1857, #1915, #1917, #1918, #1924..#1931)', () => {
  describe('#1857 GameInstance room-level AOI, outdoor seam visibility & UnitRemove (0x0A)', () => {
    function buildStitchedSource(): LocalAreaLevelSource {
      const makeStripLevel = (
        areaId: number,
        originTileX: number,
        roomCount: number,
        adjacentAreaIds: readonly number[],
      ): LocalAreaLevelGeometry => {
        const subWidth = roomCount * 8 * 5
        const subHeight = 8 * 5
        const rooms = []
        const roomRects = []
        for (let i = 0; i < roomCount; i++) {
          const tileX = originTileX + i * 8
          rooms.push({ areaId, tileX, tileY: 0 })
          roomRects.push({
            x: tileX * 5,
            y: 0,
            w: 40,
            h: 40,
            seed: 1000 + areaId * 100 + i,
          })
        }
        return {
          areaId,
          originX: originTileX * 5,
          originY: 0,
          subWidth,
          subHeight,
          blocked: new Uint8Array(subWidth * subHeight),
          spawnTileX: 2,
          spawnTileY: 2,
          rooms,
          roomRects: roomRects.map((r, index) => ({ index, ...r })),
          presetUnits: [],
          warps: [],
          adjacentAreaIds: [...adjacentAreaIds],
        }
      }
      const levels = new Map<number, LocalAreaLevelGeometry>([
        [1, makeStripLevel(1, 0, 10, [2])],
        [2, makeStripLevel(2, 80, 6, [1])],
      ])
      return (request) => levels.get(request.areaId) ?? null
    }

    it('streams cross-seam units/mercs across Rogue Encampment <-> Blood Moor and suppresses far same-area broadcasts', () => {
      const game = new GameInstance({
        seed: 185701,
        areaId: 1,
        mode: 'open',
        maxPlayers: 8,
        resolveAreaBootstrap: createAreaBootstrapResolver(buildStitchedSource()),
      })
      const pFar = game.connectPlayer({ charClass: 'sor', name: 'FarTown', x: 10, y: 15, areaId: 1 })
      const pBridge = game.connectPlayer({ charClass: 'pal', name: 'BridgeWatch', x: 390, y: 15, areaId: 1 })
      // Step 1 frame so ensureAdjacentAreasLoaded brings Blood Moor (2) online & reveals seam rooms.
      game.stepFrames(1)
      game.drainEvents(pFar)
      game.drainEvents(pBridge)

      // Spawn a Blood Moor monster just across the seam at x=405 (area 2) and connect an outdoor ally with a merc.
      const moorMonsterId = game.spawnMonster({
        classId: 19,
        x: 405,
        y: 15,
        areaId: 2,
        hp: 100,
        maxHp: 100,
      })
      const pMoor = game.connectPlayer({ charClass: 'ama', name: 'MoorScout', x: 408, y: 15, areaId: 2 })
      // Trigger free Rogue Scout reward via Kashya flow or spawn merc directly on pMoor:
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array }>
        grantFreeQuestMercenary113c: (player: unknown, act: 1 | 3) => boolean
      }
      const moorRec = internal.players.get(pMoor)!
      expect(internal.grantFreeQuestMercenary113c(moorRec, 1)).toBe(true)

      const bridgeEvents = game.drainEvents(pBridge)
      const farEvents = game.drainEvents(pFar)

      // Bridge player in Area 1 sees the Area 2 monster, Area 2 player, and Area 2 mercenary!
      expect(
        bridgeEvents.some((e) => e.type === 'UnitAssign' && e.unitId === moorMonsterId),
      ).toBe(true)
      expect(
        bridgeEvents.some((e) => e.type === 'UnitAssign' && e.unitId === pMoor),
      ).toBe(true)
      expect(bridgeEvents.some((e) => e.type === 'Merc' && e.kind === 'assign')).toBe(true)

      // Far player at x=10 in Area 1 did NOT receive UnitAssign for pBridge (x=390) or moorMonsterId (x=405).
      expect(
        farEvents.some((e) => e.type === 'UnitAssign' && e.unitId === moorMonsterId),
      ).toBe(false)
    })

    it('emits UnitRemove (0x0A) BEFORE RoomHide (0x08) when walking away and cleanly re-assigns on return', () => {
      const game = new GameInstance({
        seed: 185702,
        areaId: 1,
        resolveAreaBootstrap: createAreaBootstrapResolver(buildStitchedSource()),
      })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'Runner', x: 10, y: 15, areaId: 1 })
      const monId = game.spawnMonster({
        classId: 19,
        x: 12,
        y: 15,
        areaId: 1,
        hp: 100,
        maxHp: 100,
        aiDisabled: true,
      })
      const chestId = game.spawnObject({ classId: 5, x: 14, y: 15, areaId: 1 })
      game.stepFrames(1)
      game.drainEvents(pid)

      // Teleport/move player far east in Area 1 (x=260, tileX=52) so room tileX=0 exceeds ROOM_HIDE_RADIUS_TILES (13).
      const internal = game as unknown as {
        players: Map<number, { x: number; y: number }>
        revealAreaRoomsNearPlayer: (p: unknown, emitUnits: boolean) => void
      }
      const pRec = internal.players.get(pid)!
      pRec.x = 260
      internal.revealAreaRoomsNearPlayer(pRec, true)

      const leaveEvents = game.drainEvents(pid)
      // Unit ids are per unit type in 1.13c (monster #1 and object #1 coexist): match (type, id).
      const ofType = (e: { unitType?: unknown }, id: 0 | 1 | 2 | 3 | 4 | 5, name: string): boolean =>
        e.unitType === id || e.unitType === name
      const monRemoveIdx = leaveEvents.findIndex(
        (e) => e.type === 'UnitRemove' && e.unitId === monId && ofType(e, 1, 'monster'),
      )
      const chestRemoveIdx = leaveEvents.findIndex(
        (e) => e.type === 'UnitRemove' && e.unitId === chestId && ofType(e, 2, 'object'),
      )
      const room0HideIdx = leaveEvents.findIndex(
        (e) => e.type === 'RoomHide' && e.areaId === 1 && e.tileX === 0,
      )
      expect(monRemoveIdx).toBeGreaterThanOrEqual(0)
      expect(chestRemoveIdx).toBeGreaterThanOrEqual(0)
      expect(room0HideIdx).toBeGreaterThan(monRemoveIdx)
      expect(room0HideIdx).toBeGreaterThan(chestRemoveIdx)

      // Walk back to x=10: RoomReveal + single UnitAssign for monId and chestId.
      pRec.x = 10
      internal.revealAreaRoomsNearPlayer(pRec, true)
      const returnEvents = game.drainEvents(pid)
      const monAssigns = returnEvents.filter(
        (e) => e.type === 'UnitAssign' && e.unitId === monId && ofType(e, 1, 'monster'),
      )
      expect(monAssigns).toHaveLength(1)
    })
  })

  describe('#1915 1.13c quality-tiered ground item & gold expiration', () => {
    it('expires regular/consumable/<10k gold at 15,000f, magic/>=10k gold at 30,000f, rare/set/unique at 45,000f, and resets TTL on re-drop', () => {
      const game = new GameInstance({ seed: 1915, areaId: 1 })
      const pid = game.connectPlayer({ charClass: 'pal', name: 'Dropper', x: 10, y: 10, areaId: 1 })
      const internal = game as unknown as {
        currentFrame: number
        players: Map<number, { items: any[]; gold: number }>
        groundItems: Map<number, { code: string; expireFrame?: number }>
      }
      const player = internal.players.get(pid)!
      player.gold = 25_000
      player.items.push(
        makeItem(9101, 'cap', { quality: 2 }), // regular white -> 15,000
        makeItem(9102, 'cap', { quality: 4, x: 1 }), // magic -> 30,000
        makeItem(9103, 'cap', { quality: 6, x: 2 }), // rare -> 45,000
        makeItem(9104, 'cap', { quality: 7, x: 3 }), // unique -> 45,000
        makeItem(9105, 'hp1', { quality: 2, x: 4 }), // potion -> 15,000
      )

      for (const id of [9101, 9102, 9103, 9104, 9105]) {
        game.enqueueCommand(pid, { type: 'ItemDrop', itemId: id } as never)
      }
      game.enqueueCommand(pid, { type: 'DropGold', amount: 5_000 } as never)
      game.enqueueCommand(pid, { type: 'DropGold', amount: 12_000 } as never)
      game.stepFrames(1)

      expect(internal.groundItems.get(9101)?.expireFrame).toBe(15_000)
      expect(internal.groundItems.get(9105)?.expireFrame).toBe(15_000)
      expect(internal.groundItems.get(9102)?.expireFrame).toBe(30_000)
      expect(internal.groundItems.get(9103)?.expireFrame).toBe(45_000)
      expect(internal.groundItems.get(9104)?.expireFrame).toBe(45_000)
      const goldEntries = [...internal.groundItems.values()].filter((g) => g.code === 'gld')
      expect(goldEntries.map((g) => g.expireFrame).sort((a, b) => a! - b!)).toEqual([15_000, 30_000])

      // Pick up white cap (9101) at frame 10,000 and re-drop it -> TTL resets to 10,000 + 15,000 = 25,000!
      internal.currentFrame = 9_999
      game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 9101, toCursor: false } as never)
      game.stepFrames(1) // currentFrame becomes 10,000
      const pickedCap = player.items.find((i) => i.unitId === 9101)!
      expect(pickedCap.expireFrame).toBeUndefined()
      game.enqueueCommand(pid, { type: 'ItemDrop', itemId: 9101 } as never)
      game.stepFrames(1) // dropped at frame 10,000 -> expireFrame = 25,000
      expect(internal.groundItems.get(9101)?.expireFrame).toBe(25_000)

      // Advance to frame 15,000: potion (9105) & 5k gold expire, while re-dropped 9101, magic, rare, unique, and 12k gold survive!
      internal.currentFrame = 14_999
      game.stepFrames(1)
      expect(internal.groundItems.has(9105)).toBe(false)
      expect(internal.groundItems.has(9101)).toBe(true)
      expect(internal.groundItems.has(9102)).toBe(true)
      expect(internal.groundItems.has(9103)).toBe(true)

      // Advance to frame 30,000: re-dropped 9101, magic (9102), and 12k gold expire; rare (9103) & unique (9104) survive!
      internal.currentFrame = 29_999
      game.stepFrames(1)
      expect(internal.groundItems.has(9101)).toBe(false)
      expect(internal.groundItems.has(9102)).toBe(false)
      expect(internal.groundItems.has(9103)).toBe(true)
      expect(internal.groundItems.has(9104)).toBe(true)

      // Advance to frame 45,000: rare & unique expire.
      internal.currentFrame = 44_999
      game.stepFrames(1)
      expect(internal.groundItems.has(9103)).toBe(false)
      expect(internal.groundItems.has(9104)).toBe(false)
    })
  })

  describe('#1917 A5Q1 Larzuk socketing validation', () => {
    it('rejects quest weapons, Low Quality, stackables, broken, already-socketed, and ears without consuming a5q1, while allowing Wirt Leg and normal Crystal Sword', () => {
      const game = new GameInstance({ seed: 1917, areaId: 109 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'SmithTest', x: 10, y: 10, areaId: 109 })
      const larzuk = game.spawnMonster({ classId: 511, name: 'Larzuk', x: 11, y: 10, areaId: 109, isNpc: true })
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array; items: any[]; activeNpcId: number | undefined }>
      }
      const player = internal.players.get(pid)!
      player.questFlags[qIdx('a5q1')] = QUEST_FLAG_REWARD_PENDING_113C
      player.activeNpcId = larzuk

      const rejectedSpecs = [
        makeItem(9201, 'hfh', { quality: 7 }), // Hellforge Hammer (quest=21)
        makeItem(9202, 'qf1', { quality: 7 }), // Khalim's Flail (quest=19)
        makeItem(9203, 'msf', { quality: 7 }), // Staff of Kings (quest=9)
        makeItem(9204, 'hst', { quality: 7 }), // Horadric Staff (quest=10)
        makeItem(9205, 'g33', { quality: 7 }), // Gidbinn (quest=18)
        makeItem(9206, 'crs', { quality: 1 }), // Low Quality Crystal Sword
        makeItem(9207, 'jav', { quality: 2 }), // Stackable Javelin (nosockets)
        makeItem(9208, 'crs', { quality: 2, durability: 0 }), // Broken
        makeItem(9209, 'crs', { quality: 2, socketed: true, totalSockets: 2 }), // Already socketed
        makeItem(9210, 'ear', { quality: 2, isEar: true }), // Player Ear
      ]
      player.items.push(...rejectedSpecs)

      for (const bad of rejectedSpecs) {
        game.enqueueCommand(pid, {
          type: 'NpcEntityAction',
          npcId: larzuk,
          action: 0,
          complement: bad.unitId as number,
        } as never)
        game.stepFrames(1)
        expect((bad as { totalSockets: number }).totalSockets).toBe(
          bad.unitId === 9209 ? 2 : 0,
        )
        expect(player.questFlags[qIdx('a5q1')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
          QUEST_FLAG_REWARD_PENDING_113C,
        )
        expect(player.questFlags[qIdx('a5q1')]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
      }

      // Wirt's Leg ('leg', maxSockets=3 at ilvl 25) IS socketable in 1.13c!
      const wirtsLeg = makeItem(9220, 'leg', { quality: 2, level: 25 })
      player.items.push(wirtsLeg)
      game.enqueueCommand(pid, {
        type: 'NpcEntityAction',
        npcId: larzuk,
        action: 0,
        complement: 9220,
      } as never)
      game.stepFrames(1)
      expect((wirtsLeg as { totalSockets: number }).totalSockets).toBeGreaterThan(0)
      expect(player.questFlags[qIdx('a5q1')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
      expect(player.questFlags[qIdx('a5q1')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    })
  })

  describe('#1918 Chest traps (gpTrapFnTable 1..9), Sarcophagus/Barrel 18.08% ambush & PreOperate 1/14', () => {
    it('computes 1.13c TrapProb + mlvl/2, rolls trap types 1..9, and pre-opens PreOperate objects at ~1/14', () => {
      expect(INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C.has(10)).toBe(false)
      expect(INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C.has(5)).toBe(true)
      expect(INIT_FN_2_OR_3_TRAP_CLASS_IDS_113C.has(6)).toBe(true)
      expect(PRE_OPERATE_CLASS_IDS_113C.has(4)).toBe(true)
      // At areaLevel 32 -> (32 >> 3) + 5 = 9%
      expect(computeChestTrapChancePct113c(32)).toBe(9)

      const rng = new D2Rng(191801)
      let openCount = 0
      const trials = 1400
      for (let i = 0; i < trials; i++) {
        if (rollPreOperateOpen113c(4, false, rng)) openCount++
      }
      expect(openCount).toBeGreaterThan(60)
      expect(openCount).toBeLessThan(150)

      const seenTrapTypes = new Set<number>()
      for (let i = 0; i < 500; i++) {
        const t = rollChestTrapType113c(6, 80, false, rng)
        if (t > 0) seenTrapTypes.add(t)
      }
      expect([...seenTrapTypes].every((t) => t >= 1 && t <= 9)).toBe(true)
      expect(seenTrapTypes.size).toBeGreaterThanOrEqual(7)
    })

    it('fires damaging trap missiles on non-Assassins, auto-disarms for Assassins, and spawns Sarcophagus/Barrel monster ambushes', () => {
      const game = new GameInstance({ seed: 191802, areaId: 2, mode: 'open', maxPlayers: 8 })
      const barbId = game.connectPlayer({ charClass: 'bar', name: 'Barb', x: 10, y: 10, areaId: 2, hp: 200 })
      const assId = game.connectPlayer({ charClass: 'ass', name: 'Sin', x: 30, y: 30, areaId: 2, hp: 200 })
      const internal = game as unknown as {
        missiles: Map<number, unknown>
        monsters: Map<number, unknown>
        groundItems: Map<number, unknown>
      }

      // Trapped chest #1 (Poison Gas Nova = trapType 2) opened by Barbarian -> spawns 16 radial trap missiles!
      const trapChest1 = game.spawnObject({ classId: 6, x: 11, y: 10, areaId: 2, isLocked: false, trapType: 2 })
      game.enqueueCommand(barbId, { type: 'OperateObject', objectId: trapChest1 })
      game.stepFrames(1)
      expect(internal.missiles.size).toBeGreaterThanOrEqual(16)

      // Clear missiles, then Assassin opens trapped chest #2 (Frost Nova = trapType 6) -> auto-disarmed (0 missiles)!
      internal.missiles.clear()
      const trapChest2 = game.spawnObject({ classId: 6, x: 31, y: 30, areaId: 2, isLocked: false, trapType: 6 })
      game.enqueueCommand(assId, { type: 'OperateObject', objectId: trapChest2 })
      game.stepFrames(1)
      expect(internal.missiles.size).toBe(0)

      // Operate 40 Caskets (classId 1, OperateFn 1) + 40 Barrels (classId 7, OperateFn 5): ~18.08% spawn ambush monster!
      const monBefore = internal.monsters.size
      for (let i = 0; i < 80; i++) {
        const containerCls = i < 40 ? 1 : 7
        const sarc = game.spawnObject({ classId: containerCls, x: 11, y: 10, areaId: 2, mode: 0, rollPreOperate: false })
        game.enqueueCommand(barbId, { type: 'OperateObject', objectId: sarc })
        game.stepFrames(1)
      }
      const spawnedAmbushCount = internal.monsters.size - monBefore
      expect(spawnedAmbushCount).toBeGreaterThanOrEqual(5)
      expect(spawnedAmbushCount).toBeLessThanOrEqual(30)
    })
  })

  describe('#1924 Same-game corpse recovery: 75% XP refund, 16 corpses & inventory/leftover routing', () => {
    it('refunds 75% of Nightmare/Hell death XP loss, preserves up to 16 concurrent corpses, and routes conflicting slots to inventory or keeps them on corpse', () => {
      const game = new GameInstance({ seed: 1924, areaId: 2, difficulty: 2 }) // Hell (10% XP loss)
      // Level 10 XP threshold is 57,715..72,144 (span = 14,429; 10% = 1,442)
      const pid = game.connectPlayer({
        charClass: 'pal',
        name: 'CorpseHero',
        x: 20,
        y: 20,
        areaId: 2,
        level: 10,
        experience: 65_000,
        hp: 100,
      })
      const internal = game as unknown as {
        players: Map<
          number,
          {
            x: number
            y: number
            areaId: number
            dead: boolean
            hp: number
            experience: number
            items: any[]
            corpseId: number | undefined
            corpseItems: any[]
            extraCorpses: Array<{ corpseId: number; items: any[]; lostExp?: number }> | undefined
          }
        >
        killPlayer: (p: unknown, killer: unknown) => void
      }
      const player = internal.players.get(pid)!
      const sword1 = makeItem(9301, 'crs', {
        location: 'equipped',
        bodyLoc: 4,
        width: 2,
        height: 3,
      })
      player.items.push(sword1)

      const expBeforeDeath = player.experience
      internal.killPlayer(player, { kind: 'trap' })
      const expAfterDeath = player.experience
      const lostExp = expBeforeDeath - expAfterDeath
      expect(lostExp).toBeGreaterThan(0)
      const firstCorpseId = player.corpseId!
      expect(firstCorpseId).toBeDefined()

      // Respawn player, equip a NEW sword in bodyLoc=4, then loot corpse -> sword1 routes to inventory (does NOT overwrite sword2) & refunds 75% XP!
      game.enqueueCommand(pid, { type: 'Respawn' } as never)
      game.stepFrames(1)
      player.areaId = 2
      player.x = 20
      player.y = 20
      const sword2 = makeItem(9302, 'bsd', {
        location: 'equipped',
        bodyLoc: 4,
        width: 2,
        height: 3,
      })
      player.items.push(sword2)

      game.enqueueCommand(pid, {
        type: 'Interact',
        target: { unitType: 0, id: firstCorpseId },
      } as never)
      game.stepFrames(1)

      expect(player.items.find((i) => i.unitId === 9302)?.location).toBe('equipped')
      expect(player.items.find((i) => i.unitId === 9301)?.location).toBe('inventory')
      expect(player.experience).toBe(expAfterDeath + Math.floor((lostExp * 3) / 4))
      expect(player.corpseId).toBeUndefined()

      // Fill inventory completely (10x4 = 40 1x1 charms), equip helm1, die, respawn, equip helm2, loot corpse -> helm1 MUST stay on corpse!
      player.items = []
      for (let gx = 0; gx < 10; gx++) {
        for (let gy = 0; gy < 4; gy++) {
          player.items.push(makeItem(9400 + gx * 4 + gy, 'cm1', { location: 'inventory', x: gx, y: gy }))
        }
      }
      const helm1 = makeItem(9501, 'cap', { location: 'equipped', bodyLoc: 1, width: 2, height: 2 })
      player.items.push(helm1)
      internal.killPlayer(player, { kind: 'trap' })
      const fullInvCorpseId = player.corpseId!
      game.enqueueCommand(pid, { type: 'Respawn' } as never)
      game.stepFrames(1)
      player.areaId = 2
      player.x = 20
      player.y = 20
      player.items.push(makeItem(9502, 'skp', { location: 'equipped', bodyLoc: 1, width: 2, height: 2 }))

      game.enqueueCommand(pid, {
        type: 'Interact',
        target: { unitType: 0, id: fullInvCorpseId },
      } as never)
      game.stepFrames(1)
      // helm2 remains equipped AND helm1 stays safely on the corpse!
      expect(player.items.find((i) => i.unitId === 9502)?.location).toBe('equipped')
      expect(player.corpseId).toBe(fullInvCorpseId)
      expect(player.corpseItems.some((i) => i.unitId === 9501)).toBe(true)

      // Verify up to 16 concurrent corpses are retained without overwriting!
      for (let extraIdx = 1; extraIdx < 16; extraIdx++) {
        player.items = [makeItem(9600 + extraIdx, 'cap', { location: 'equipped', bodyLoc: 1 })]
        internal.killPlayer(player, { kind: 'trap' })
        game.enqueueCommand(pid, { type: 'Respawn' } as never)
        game.stepFrames(1)
        player.areaId = 2
        player.x = 20
        player.y = 20
      }
      expect(player.corpseId).toBeDefined()
      expect(player.extraCorpses).toHaveLength(15)
      expect(player.extraCorpses![0]!.corpseId).toBe(fullInvCorpseId)
    })
  })

  describe('#1925 Stony Field Moldy Tome (Object 8)', () => {
    it('starts Forgotten Tower quest a1q4 without touching Search for Cain a1q3', () => {
      const game = new GameInstance({ seed: 1925, areaId: 4 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'Reader', x: 10, y: 10, areaId: 4 })
      const player = (game as unknown as { players: Map<number, { questFlags: Uint16Array }> }).players.get(pid)!
      const tomeId = game.spawnObject({ classId: 8, x: 11, y: 10, areaId: 4 })
      game.drainEvents(pid)

      game.enqueueCommand(pid, { type: 'OperateObject', objectId: tomeId })
      game.stepFrames(1)
      const events = game.drainEvents(pid)

      expect(player.questFlags[qIdx('a1q4')]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
      expect(player.questFlags[qIdx('a1q3')]).toBe(0)
      expect(
        events.some(
          (e) =>
            e.type === 'Npc' &&
            e.kind === 'info' &&
            e.messages?.some((m) => m.stringId === 127) === true,
        ),
      ).toBe(true)
    })
  })

  describe('#1926 A1Q3 Search for Cain: Cairn Stones bkd + order, Gibbet 0 loot, and Cain 100g vs free identify', () => {
    it('enforces bkd + exact 5-stone sequence, drops 0 loot from Gibbet, and charges 100g before rescue vs free after rescue', () => {
      const game = new GameInstance({ seed: 1926, areaId: 4 })
      const pid = game.connectPlayer({ charClass: 'nec', name: 'Rescuer', x: 10, y: 10, areaId: 4 })
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array; items: any[]; gold: number }>
        objects: Map<number, { classId: number; mode: number; destAreaId?: number }>
        groundItems: Map<number, unknown>
      }
      const player = internal.players.get(pid)!
      const stonesByClass = new Map<number, number>()
      for (let cls = 17; cls <= 21; cls++) {
        stonesByClass.set(cls, game.spawnObject({ classId: cls, x: 11, y: 10, areaId: 4 }))
      }
      const order = game.getCairnStoneOrder()
      expect(order).toHaveLength(5)

      // Without 'bkd', clicking all 5 stones in order does NOT open Tristram portal!
      for (const cls of order) {
        game.enqueueCommand(pid, { type: 'OperateObject', objectId: stonesByClass.get(cls)! })
        game.stepFrames(1)
      }
      expect([...internal.objects.values()].some((o) => o.classId === 60 && o.destAreaId === 38)).toBe(false)

      // Give player 'bkd', click first stone then WRONG second stone -> resets stones!
      player.items.push(makeItem(9701, 'bkd'))
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: stonesByClass.get(order[0]!)! })
      game.stepFrames(1)
      expect(internal.objects.get(stonesByClass.get(order[0]!)!)?.mode).toBe(2)
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: stonesByClass.get(order[2]!)! })
      game.stepFrames(1)
      expect(internal.objects.get(stonesByClass.get(order[0]!)!)?.mode).toBe(0)

      // Now click all 5 stones in exact order -> consumes 'bkd' and opens Tristram red portal (60 -> 38)!
      for (const cls of order) {
        game.enqueueCommand(pid, { type: 'OperateObject', objectId: stonesByClass.get(cls)! })
        game.stepFrames(1)
      }
      expect(player.items.some((i) => i.code === 'bkd')).toBe(false)
      expect([...internal.objects.values()].some((o) => o.classId === 60 && o.destAreaId === 38)).toBe(true)

      // Before Cain rescue: Cain (244 in Act 2+) charges 100 gold per unidentified item!
      const cain = game.spawnMonster({ classId: 244, name: 'Cain', x: 11, y: 10, areaId: 4, isNpc: true })
      player.gold = 500
      const unid1 = makeItem(9702, 'rin', { quality: 4, identified: false })
      player.items.push(unid1)
      game.enqueueCommand(pid, { type: 'NpcIdentifyAll', npcId: cain } as never)
      game.stepFrames(1)
      expect((unid1 as { identified: boolean }).identified).toBe(true)
      expect(player.gold).toBe(400)

      // Operate Gibbet (classId 26): drops ZERO chest items and completes a1q3 rescue!
      const groundBefore = internal.groundItems.size
      const gibbetId = game.spawnObject({ classId: 26, x: 11, y: 10, areaId: 4 })
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: gibbetId })
      game.stepFrames(1)
      expect(internal.groundItems.size).toBe(groundBefore)
      expect(player.questFlags[qIdx('a1q3')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

      // After a1q3 rescue: Cain identifies for FREE (0 gold)!
      const unid2 = makeItem(9703, 'amu', { quality: 6, identified: false })
      player.items.push(unid2)
      game.enqueueCommand(pid, { type: 'NpcIdentifyAll', npcId: cain } as never)
      game.stepFrames(1)
      expect((unid2 as { identified: boolean }).identified).toBe(true)
      expect(player.gold).toBe(400)
    })
  })

  describe('#1927 A3Q4 Lam Esen Tome (bbb) inventory verification & consumption', () => {
    it('rejects empty-handed Alkor turn-in after touching stand 193, then consumes bbb for +5 statPts', () => {
      const game = new GameInstance({ seed: 1927, areaId: 75 })
      const pid = game.connectPlayer({ charClass: 'dru', name: 'Seeker', x: 10, y: 10, areaId: 75 })
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array; items: any[]; statPts: number }>
        groundItems: Map<number, { code: string }>
      }
      const player = internal.players.get(pid)!
      const stats0 = player.statPts
      const standId = game.spawnObject({ classId: 193, x: 11, y: 10, areaId: 75 })
      const alkor = game.spawnMonster({ classId: 254, name: 'Alkor', x: 11, y: 10, areaId: 75, isNpc: true })

      // Operate stand 193 WITHOUT picking up 'bbb' -> talk to Alkor empty-handed -> +0 statPts!
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: standId })
      game.stepFrames(1)
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
      game.stepFrames(1)
      expect(player.statPts).toBe(stats0)
      expect(player.questFlags[qIdx('a3q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(0)

      // Now pick up 'bbb' and talk to Alkor -> 'bbb' consumed, +5 statPts granted, a3q4 completed!
      const bbbEntry = [...internal.groundItems.entries()].find(
        ([, g]) => g.code.trim().toLowerCase() === 'bbb',
      )
      expect(bbbEntry).toBeDefined()
      game.enqueueCommand(pid, { type: 'ItemPickup', itemId: bbbEntry![0], toCursor: false } as never)
      game.stepFrames(1)
      expect(player.items.some((i) => i.code === 'bbb')).toBe(true)

      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
      game.stepFrames(1)
      expect(player.items.some((i) => i.code === 'bbb')).toBe(false)
      expect(player.statPts).toBe(stats0 + 5)
      expect(player.questFlags[qIdx('a3q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    })
  })

  describe('#1928 A4Q3 Chaos Sanctuary 5 seals + 3 seal bosses with minions & non-boss final seal', () => {
    it('spawns minion packs with all 3 seal bosses, triggers Diablo when non-boss seal 395 is opened last, purges CS stragglers, and spawns no Object 566 in 108', () => {
      const game = new GameInstance({ seed: 1928, areaId: 108 })
      const pid = game.connectPlayer({
        charClass: 'pal',
        name: 'Hammerdin',
        x: 7792,
        y: 5292,
        areaId: 108,
        hp: 100_000,
        maxHp: 100_000,
      })
      const internal = game as unknown as {
        monsters: Map<number, { defId: string; superUniqueId?: string; rank?: string; dead: boolean; areaId: number }>
        objects: Map<number, { classId: number; areaId: number }>
      }
      // Spawn a regular Chaos Sanctuary straggler monster to verify purge on 5th seal + 3 bosses dead.
      const stragglerId = game.spawnMonster({
        classId: 312,
        x: 7800,
        y: 5295,
        areaId: 108,
        hp: 500,
        maxHp: 500,
      })

      // Open ONLY the 3 boss seals first (392, 394, 396) while 393 & 395 stay closed!
      for (const cls of [392, 394, 396]) {
        const sealId = game.spawnObject({ classId: cls, x: 7794, y: 5292, areaId: 108 })
        game.enqueueCommand(pid, { type: 'OperateObject', objectId: sealId })
        game.stepFrames(1)
      }
      const sealBosses = [...internal.monsters.entries()].filter(
        ([, m]) => m.superUniqueId !== undefined && /Vizier|Seis|Infector/.test(m.superUniqueId),
      )
      const sealMinions = [...internal.monsters.values()].filter((m) => m.rank === 'minion')
      expect(sealBosses).toHaveLength(3)
      expect(sealMinions.length).toBeGreaterThanOrEqual(9)

      // Kill all 3 seal bosses BEFORE opening 393 & 395 -> Diablo must NOT spawn yet!
      for (const [bossId] of sealBosses) {
        game.applyDamageToMonster(bossId, 1_000_000, pid)
      }
      game.stepFrames(130)
      expect([...internal.monsters.values()].some((m) => m.defId === 'diablo')).toBe(false)

      // Now open non-boss seals 393 and 395 LAST -> purges straggler & spawns Diablo after 125 frames!
      const seal393 = game.spawnObject({ classId: 393, x: 7793, y: 5292, areaId: 108 })
      const seal395 = game.spawnObject({ classId: 395, x: 7793, y: 5292, areaId: 108 })
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: seal393 })
      game.stepFrames(1)
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: seal395 })
      game.stepFrames(1)

      expect(internal.monsters.get(stragglerId)?.dead ?? true).toBe(true)
      game.stepFrames(125)
      const diabloEntry = [...internal.monsters.entries()].find(
        ([, m]) => m.defId === 'diablo' && !m.dead,
      )
      expect(diabloEntry).toBeDefined()

      // Kill Diablo -> never spawns Object 566 inside area 108!
      game.applyDamageToMonster(diabloEntry![0], 1_000_000, pid)
      game.stepFrames(5)
      expect(
        [...internal.objects.values()].some((o) => o.areaId === 108 && o.classId === 566),
      ).toBe(false)
    })
  })

  describe('#1929 A5Q3 Prison of Ice: Anya class-specific rare, Pindleskin red portal (109->121) & Nihlathak town removal', () => {
    it('removes town Nihlathak (514), opens red portal 60->121, and grants Sorceress Rare orb from ANYA_CLASS_REWARD_POOLS_113C', () => {
      const game = new GameInstance({ seed: 1929, areaId: 109, difficulty: 0 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'BlizzSorc', x: 5110, y: 5115, areaId: 109 })
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array; items: any[] }>
        monsters: Map<number, { classId: number; areaId: number; isNpc?: boolean }>
        objects: Map<number, { classId: number; areaId: number; destAreaId?: number }>
      }
      const player = internal.players.get(pid)!
      const townNihl = game.spawnMonster({
        classId: 514,
        name: 'Nihlathak',
        x: 5120,
        y: 5115,
        areaId: 109,
        isNpc: true,
      })
      const malah = game.spawnMonster({
        classId: 513,
        name: 'Malah',
        x: 5112,
        y: 5115,
        areaId: 109,
        isNpc: true,
      })

      // Discover Frozen Anya (558) -> Malah gives 'ice' -> thaw Frozen Anya (558) -> Malah ('tr2') -> Town Anya completes a5q3 (#2019)!
      const frozenAnya = game.spawnObject({ classId: 558, x: 5111, y: 5115, areaId: 109 })
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozenAnya })
      game.stepFrames(1)

      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
      game.stepFrames(1)
      expect(player.items.some((i) => i.code === 'ice')).toBe(true)

      game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozenAnya })
      game.stepFrames(1)

      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
      game.stepFrames(1)
      expect(player.items.some((i) => i.code === 'tr2')).toBe(true)
      expect(player.questFlags[qIdx('a5q3')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
        QUEST_FLAG_REWARD_PENDING_113C,
      )

      // Town Nihlathak (514) is removed from 109, Town Anya (512) & Red Portal (60 -> 121) exist in 109!
      expect(internal.monsters.has(townNihl)).toBe(false)
      const townAnyaEntry = [...internal.monsters.entries()].find(
        ([, m]) => m.areaId === 109 && m.classId === 512,
      )
      expect(townAnyaEntry).toBeDefined()
      expect(
        [...internal.objects.values()].some(
          (o) => o.areaId === 109 && o.classId === 60 && o.destAreaId === 121,
        ),
      ).toBe(true)

      // Talk to Town Anya (512) -> grants Sorceress (classId 1) Normal tier Rare item ('ob1'..'ob5') & completes a5q3!
      game.enqueueCommand(pid, {
        type: 'NpcInit',
        target: { unitType: 1, id: townAnyaEntry![0] },
      } as never)
      game.stepFrames(1)
      expect(player.questFlags[qIdx('a5q3')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
      const sorcNormalPool = ANYA_CLASS_REWARD_POOLS_113C[0][1]
      const rareReward = player.items.find(
        (i) => i.quality === 6 && sorcNormalPool.includes(i.code.trim()),
      )
      expect(rareReward).toBeDefined()
    })
  })

  describe('#1930 Quest NPC rare rings & free mercenaries (Kashya, Akara, Ormus, Asheara)', () => {
    it('grants Kashya free Rogue Scout, Akara a1q3 rare ring, Ormus a3q2 rare ring, and Asheara free Iron Wolf', () => {
      const game = new GameInstance({ seed: 1930, areaId: 1, difficulty: 0 })
      const pid = game.connectPlayer({ charClass: 'pal', name: 'MercLord', x: 10, y: 10, areaId: 1 })
      const internal = game as unknown as {
        players: Map<number, { questFlags: Uint16Array; items: any[] }>
        mercenaries: Map<number, { ownerPlayerId: number; classId: number; alive: boolean }>
      }
      const player = internal.players.get(pid)!

      // 1. A1Q2 Blood Raven -> Kashya (150) grants free Act 1 Rogue Scout (classId 271)
      const bloodRaven = game.spawnMonster({ defId: 'bloodraven', x: 12, y: 10, areaId: 1, hp: 10, maxHp: 10 })
      game.applyDamageToMonster(bloodRaven, 1000, pid)
      const kashya = game.spawnMonster({ classId: 150, name: 'Kashya', x: 11, y: 10, areaId: 1, isNpc: true })
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: kashya } } as never)
      game.stepFrames(1)
      const rogueMerc = [...internal.mercenaries.values()].find((m) => m.ownerPlayerId === pid)
      expect(rogueMerc?.classId).toBe(271)

      // 2. A1Q3 Cain rescue -> Akara (148) grants Rare ring
      const gibbet = game.spawnObject({ classId: 26, x: 11, y: 10, areaId: 1 })
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: gibbet })
      game.stepFrames(1)
      const akara = game.spawnMonster({ classId: 148, name: 'Akara', x: 11, y: 10, areaId: 1, isNpc: true })
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: akara } } as never)
      game.stepFrames(1)
      expect(player.items.filter((i) => i.code === 'rin' && i.quality === 6)).toHaveLength(1)

      // 3. A3Q2 Gidbinn -> Ormus (255) grants Rare ring AND Asheara (252) grants free Act 3 Iron Wolf (when player has no merc)
      internal.mercenaries.clear()
      player.items.push(makeItem(9901, 'g33'))
      const ormus = game.spawnMonster({ classId: 255, name: 'Ormus', x: 11, y: 10, areaId: 1, isNpc: true })
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: ormus } } as never)
      game.stepFrames(1)
      expect(player.items.filter((i) => i.code === 'rin' && i.quality === 6)).toHaveLength(2)

      const asheara = game.spawnMonster({ classId: 252, name: 'Asheara', x: 11, y: 10, areaId: 1, isNpc: true })
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: asheara } } as never)
      game.stepFrames(1)
      const ironWolf = [...internal.mercenaries.values()].find((m) => m.ownerPlayerId === pid)
      expect(ironWolf?.classId).toBe(359)
    })
  })

  describe('#1931 5-Act boss kill party quest sharing vs unpartied bystanders', () => {
    it('shares non-Act-boss & Act-end boss quest credit with eligible allied party members while excluding unpartied bystanders', () => {
      const game = new GameInstance({ seed: 1931, areaId: 37, mode: 'open', maxPlayers: 8 })
      const killerId = game.connectPlayer({ charClass: 'sor', name: 'Killer', x: 10, y: 10, areaId: 37 })
      const partySameAreaId = game.connectPlayer({ charClass: 'pal', name: 'AllyBossRoom', x: 14, y: 10, areaId: 37 })
      const partyTownId = game.connectPlayer({ charClass: 'dru', name: 'AllyTown', x: 10, y: 10, areaId: 1 })
      const unpartiedId = game.connectPlayer({ charClass: 'nec', name: 'Bystander', x: 12, y: 10, areaId: 37 })

      // Form party among killerId, partySameAreaId, and partyTownId (leave unpartiedId solo!)
      game.enqueueCommand(killerId, { type: 'PartyAction', action: 'invite', targetPlayerId: partySameAreaId } as never)
      game.enqueueCommand(killerId, { type: 'PartyAction', action: 'invite', targetPlayerId: partyTownId } as never)
      game.stepFrames(1)
      game.enqueueCommand(partySameAreaId, { type: 'PartyAction', action: 'accept', targetPlayerId: killerId } as never)
      game.enqueueCommand(partyTownId, { type: 'PartyAction', action: 'accept', targetPlayerId: killerId } as never)
      game.stepFrames(1)

      const players = (game as unknown as { players: Map<number, { questFlags: Uint16Array; newSkills: number }> }).players

      // 1. Non-Act-boss quest kill (Izual -> a4q1 0x2002 reward pending -> Tyrael #367 +2 skills, #2011):
      // credits killer & same-area party ally ONLY (not town ally, not unpartied bystander)!
      const izualSkills0 = players.get(partySameAreaId)!.newSkills
      const izual = game.spawnMonster({ defId: 'izual', x: 15, y: 10, areaId: 37, hp: 10, maxHp: 10, experience: 0 })
      game.applyDamageToMonster(izual, 1000, killerId)

      expect(players.get(killerId)!.questFlags[qIdx('a4q1')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
        QUEST_FLAG_REWARD_PENDING_113C,
      )
      expect(players.get(partySameAreaId)!.questFlags[qIdx('a4q1')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
        QUEST_FLAG_REWARD_PENDING_113C,
      )
      expect(players.get(partySameAreaId)!.newSkills).toBe(izualSkills0)
      expect(players.get(partyTownId)!.questFlags[qIdx('a4q1')]).toBe(0)
      expect(players.get(unpartiedId)!.questFlags[qIdx('a4q1')]).toBe(0)

      const tyrael2 = game.spawnMonster({ classId: 367, name: 'Tyrael', x: 12, y: 10, areaId: 37, isNpc: true })
      game.enqueueCommand(partySameAreaId, { type: 'NpcInit', target: { unitType: 1, id: tyrael2 } } as never)
      game.stepFrames(1)
      expect(players.get(partySameAreaId)!.questFlags[qIdx('a4q1')]! & QUEST_FLAG_COMPLETED_113C).toBe(
        QUEST_FLAG_COMPLETED_113C,
      )
      expect(players.get(partySameAreaId)!.newSkills).toBe(izualSkills0 + 2)

      // 2. Act-end boss kill (Andariel -> a1q6): credits killer + same-area party ally + Act 1 town party ally with 0x3000 (before Warriv talk), NEVER unpartied bystander!
      const andariel = game.spawnMonster({ defId: 'andariel', x: 16, y: 10, areaId: 37, hp: 10, maxHp: 10 })
      game.applyDamageToMonster(andariel, 1000, killerId)

      const a1q6KillBits = 0x1000 | 0x2000
      expect(players.get(killerId)!.questFlags[qIdx('a1q6')]! & a1q6KillBits).toBe(a1q6KillBits)
      expect(players.get(partySameAreaId)!.questFlags[qIdx('a1q6')]! & a1q6KillBits).toBe(a1q6KillBits)
      expect(players.get(partyTownId)!.questFlags[qIdx('a1q6')]! & a1q6KillBits).toBe(a1q6KillBits)
      expect(players.get(unpartiedId)!.questFlags[qIdx('a1q6')]).toBe(0)
    })
  })
})
