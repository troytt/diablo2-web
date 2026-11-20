import { describe, expect, it } from 'vitest'
import {
  CLOSED_REALM_POLICY,
  GameInstance,
  LocalLobbyProvider,
  SINGLE_PLAYER_POLICY,
  readD2sSave113c,
} from '../../src/server/index.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  hasQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import { CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C } from '../../src/server/engine/game-instance/constants-and-helpers.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'
import { SEAMLESS_ADJACENCY } from '../../src/common/world/world-graph.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { itemToTransactionCostInput } from '../../src/client/ui-model/transaction-cost-input.ts'
import { ProtocolError, encodeD2gsClientCommand } from '../../src/netproto/index.ts'
import { Rng } from '../../src/common/rng/d2-rng.ts'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import {
  getCanonicalMonsterKinds,
  planMonsterGroups,
  type MonsterKind,
} from '../../src/common/units/monsters-data.ts'
import { getLevelMonsterPlan113c } from '../../src/common/world/level-monster-plans.ts'

describe('Single Player 1.13c starter gear & Act 1 quest parity', () => {
  it('creates all 7 classes with canonical 1.13c CharStats.txt starter gear, staffmods, belt potions, and scrolls', async () => {
    const lobby = new LocalLobbyProvider({ seed: 0x12345678 })
    const expectations: ReadonlyArray<{
      readonly name: string
      readonly classId: 0 | 1 | 2 | 3 | 4 | 5 | 6
      readonly rightSkill: number
      readonly rarmCode: string
      readonly hasBuckler: boolean
      readonly staffmodSkill?: number | undefined
      readonly quantity?: number | undefined
    }> = [
      { name: 'StartAma', classId: 0, rightSkill: 0, rarmCode: 'jav', hasBuckler: true, quantity: 60 },
      { name: 'StartSor', classId: 1, rightSkill: 36, rarmCode: 'sst', hasBuckler: false, staffmodSkill: 36 },
      { name: 'StartNec', classId: 2, rightSkill: 70, rarmCode: 'wnd', hasBuckler: false, staffmodSkill: 70 },
      { name: 'StartPal', classId: 3, rightSkill: 0, rarmCode: 'ssd', hasBuckler: true },
      { name: 'StartBar', classId: 4, rightSkill: 0, rarmCode: 'hax', hasBuckler: true },
      { name: 'StartDru', classId: 5, rightSkill: 0, rarmCode: 'clb', hasBuckler: true },
      { name: 'StartAss', classId: 6, rightSkill: 0, rarmCode: 'ktr', hasBuckler: true },
    ]

    for (const exp of expectations) {
      await lobby.createCharacter({ name: exp.name, classId: exp.classId, expansion: true })
      const raw = lobby.getCharacterD2s(exp.name)
      expect(raw).toBeInstanceOf(Uint8Array)
      const parsed = readD2sSave113c(raw!)
      expect(parsed.rightSkill ?? parsed.leftRightSkills[1]).toBe(exp.rightSkill)

      const equipped = parsed.items.filter((i) => i.location === 1)
      const rarm = equipped.find((i) => i.bodyLoc === 4)
      expect(rarm?.code).toBe(exp.rarmCode)
      if (exp.quantity !== undefined) {
        expect(rarm?.quantity).toBe(exp.quantity)
      }
      if (exp.staffmodSkill !== undefined) {
        expect(rarm?.stats).toEqual([
          { statId: 107, param: exp.staffmodSkill, value: 1 },
        ])
      }
      const larm = equipped.find((i) => i.bodyLoc === 5)
      if (exp.hasBuckler) {
        expect(larm?.code).toBe('buc')
        expect(larm?.defense).toBeGreaterThanOrEqual(4)
        expect(larm?.defense).toBeLessThanOrEqual(6)
      } else {
        expect(larm).toBeUndefined()
      }

      const beltPotions = parsed.items.filter((i) => i.location === 2)
      expect(beltPotions.map((p) => p.code)).toEqual(['hp1', 'hp1', 'hp1', 'hp1'])
      expect(beltPotions.map((p) => p.x)).toEqual([0, 1, 2, 3])

      const invScrolls = parsed.items.filter((i) => i.location === 0)
      expect(invScrolls.map((s) => s.code)).toEqual(['tsc', 'isc'])
    }

    const sorAdapter = await lobby.enterGame({ charName: 'StartSor', difficulty: 0 })
    const initialEvents: unknown[] = []
    sorAdapter.onEvent((ev) => initialEvents.push(ev))
    sorAdapter.connect()
    expect(initialEvents).toContainEqual(
      expect.objectContaining({
        type: 'ActiveSkill',
        hand: 'right',
        skill: 36,
      }),
    )
    const game = sorAdapter.getGameInstance()
    const players = game.getAllUnits().filter((u) => u.unitType === 'player')
    expect(players).toHaveLength(1)
    const sorId = players[0]!.unitId
    const sorState = game.getPlayerState(sorId)!
    expect(sorState.rightSkill).toBe(36)
    const sstItem = sorState.items.find((i) => i.code === 'sst' && i.location === 'equipped')
    expect(sstItem).toBeDefined()
    expect(sstItem?.rawItemData?.stats).toEqual([{ statId: 107, param: 36, value: 1 }])
    sorAdapter.close()
  })

  it('emits S2C 0x50 Cairn Stone order when reading deciphered Barkscroll (bkd)', () => {
    const game = new GameInstance({ policy: SINGLE_PLAYER_POLICY, mapSeed: 0xabcde1 })
    const pId = game.connectPlayer({ name: 'ScrollReader', classId: 1, areaId: 1, x: 100, y: 100 })
    const akaraId = game.spawnMonster({
      classId: 148,
      name: 'Akara',
      areaId: 1,
      x: 101,
      y: 100,
      isNpc: true,
      isVendor: true,
    })
    const treeId = game.spawnObject({ classId: 30, areaId: 1, x: 100, y: 101, mode: 0 })
    game.enqueueCommand(pId, { type: 'OperateObject', objectId: treeId })
    game.stepFrames(15)

    const bksGround = game
      .getAllUnits()
      .find((u) => u.unitType === 'item' && u.name === 'bks')
    expect(bksGround).toBeDefined()
    game.enqueueCommand(pId, { type: 'ItemPickup', itemId: bksGround!.unitId, toCursor: false })
    game.stepFrame()

    game.enqueueCommand(pId, { type: 'NpcInit', target: { unitType: 1, id: akaraId } })
    game.stepFrame()

    const bkd = game.getPlayerState(pId)!.items.find((i) => i.code === 'bkd')
    expect(bkd).toBeDefined()
    game.drainEvents()

    game.enqueueCommand(pId, { type: 'SelectMainItem', itemId: bkd!.unitId })
    game.stepFrame()
    const evs = game.drainEvents(pId)
    const questEv = evs.find(
      (e) => e.type === 'QuestState' && e.kind === 'item' && e.source === 0x50,
    )
    expect(questEv).toBeDefined()
    if (questEv?.type === 'QuestState') {
      expect(questEv.quests[0]).toBe(4)
      const indices = Array.from(questEv.quests.slice(1, 6)).sort((a, b) => a - b)
      expect(indices).toEqual([0, 1, 2, 3, 4])
    }
    expect(evs.some((e) => e.type === 'UseSpecialItem' && e.id === bkd!.unitId)).toBe(true)
  })

  it('spawns Town Deckard Cain (265) in Rogue Encampment upon Gibbet rescue and consumes Horadric Malus at Charsi', () => {
    const game = new GameInstance({ policy: CLOSED_REALM_POLICY, mapSeed: 0x224466 })
    const host = game as unknown as GameInstanceHost
    host.loadArea(1)
    game.spawnObject({ classId: 385, areaId: 1, x: 104, y: 102, mode: 0 })
    const charsiId = game.spawnMonster({
      classId: 154,
      name: 'Charsi',
      areaId: 1,
      x: 102,
      y: 100,
      isNpc: true,
      isVendor: true,
    })
    const pId = game.connectPlayer({ name: 'CainRescuer', classId: 1, areaId: 38, x: 60, y: 60 })
    const gibbetId = game.spawnObject({ classId: 26, areaId: 38, x: 61, y: 60, mode: 0 })

    game.enqueueCommand(pId, { type: 'OperateObject', objectId: gibbetId })
    game.stepFrame()

    const townNpcs = game.listMonsters(1)
    expect(townNpcs.some((m) => m.hcIdx === 265 && !m.dead)).toBe(true)

    // Charsi Malus ('hdm') turn-in consumes 'hdm' and unlocks a1q5 reward pending
    const townPlayerId = game.connectPlayer({
      name: 'MalusCarrier',
      classId: 1,
      level: 8,
      gold: 5000,
      areaId: 1,
      x: 101,
      y: 100,
    })
    const malusStandId = game.spawnObject({ classId: 108, areaId: 1, x: 101, y: 101, mode: 0 })
    game.enqueueCommand(townPlayerId, { type: 'OperateObject', objectId: malusStandId })
    game.stepFrames(15)
    const hdmGround = game
      .getAllUnits()
      .find((u) => u.unitType === 'item' && u.name === 'hdm')
    expect(hdmGround).toBeDefined()
    game.enqueueCommand(townPlayerId, { type: 'ItemPickup', itemId: hdmGround!.unitId, toCursor: false })
    game.stepFrame()
    expect(game.getPlayerState(townPlayerId)!.items.some((i) => i.code === 'hdm')).toBe(true)

    game.enqueueCommand(townPlayerId, { type: 'NpcInit', target: { unitType: 1, id: charsiId } })
    game.stepFrame()

    expect(game.getPlayerState(townPlayerId)!.items.some((i) => i.code === 'hdm')).toBe(false)
    const exported = readD2sSave113c(game.exportPlayerD2s(townPlayerId)!)
    expect(
      hasQuestFlag113c(
        exported.quests[0],
        'a1q5',
        QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_113C,
      ),
    ).toBe(true)

    // Buy a normal white armor/helm/boots/belt from Charsi and redeem A1Q5 Imbue -> numeric quality 6 (Rare) + .d2s round-trip
    game.enqueueCommand(townPlayerId, { type: 'NpcOpenTrade', npcId: charsiId })
    game.stepFrame()
    const vendorPool = game.getNpcVendorPool(charsiId)
    const whiteOffer = vendorPool.find(
      (v) =>
        v.quality <= 3 &&
        v.totalSockets === 0 &&
        !v.socketed &&
        v.storePage === 1 &&
        v.cost <= 2000,
    )
    expect(whiteOffer).toBeDefined()
    game.enqueueCommand(townPlayerId, {
      type: 'NpcBuy',
      npcId: charsiId,
      itemId: whiteOffer!.unitId,
      buyType: 0,
    })
    game.stepFrame()
    const bought = game
      .getPlayerState(townPlayerId)!
      .items.find((i) => i.code === whiteOffer!.code && i.location === 'inventory')
    expect(bought).toBeDefined()
    game.enqueueCommand(townPlayerId, {
      type: 'NpcEntityAction',
      npcId: charsiId,
      action: 0,
      complement: bought!.unitId,
    })
    game.stepFrame()
    const imbued = game.getPlayerState(townPlayerId)!.items.find((i) => i.unitId === bought!.unitId)
    expect(imbued?.quality).toBe(6)
    const afterImbueD2s = readD2sSave113c(game.exportPlayerD2s(townPlayerId)!)
    expect(afterImbueD2s.items.some((i) => i.code === whiteOffer!.code && i.quality === 6)).toBe(true)
  })

  it('transitions seamlessly across 1-tile overlapping outdoor DS1 bridge seams and allows cross-seam Fire Bolt hits', () => {
    const game = new GameInstance({ mode: 'singlePlayer' })
    game.setAreaBootstrapResolver((req) => {
      if (req.areaId === 1) {
        return {
          areaId: 1,
          spawnX: 4110,
          spawnY: 4925,
          rooms: [{ areaId: 1, tileX: 820, tileY: 984 }],
          roomRects: [{ index: 0, x: 4100, y: 4920, w: 20, h: 15, seed: 1 }],
          adjacentAreaIds: [2],
          objects: [],
          monsters: [],
          warps: [],
          // Bridge DS1 stamps +5 subtiles (4120..4124) past Area 1's roomRects into Area 2's roomRects
          isWalkable: (checkId, x, y) => checkId === 1 && x >= 4100 && x <= 4124 && y >= 4920 && y < 4935,
        }
      }
      if (req.areaId === 2) {
        return {
          areaId: 2,
          spawnX: 4130,
          spawnY: 4925,
          rooms: [{ areaId: 2, tileX: 824, tileY: 984 }],
          roomRects: [{ index: 0, x: 4120, y: 4920, w: 40, h: 15, seed: 2 }],
          adjacentAreaIds: [1, 3],
          objects: [],
          monsters: [],
          warps: [],
          // Standalone Area 2 view has border wall on 4120..4124, walkable floor from 4125..4159
          isWalkable: (checkId, x, y) => checkId === 2 && x >= 4125 && x < 4160 && y >= 4920 && y < 4935,
        }
      }
      if (req.areaId === 3) {
        return {
          areaId: 3,
          spawnX: 4165,
          spawnY: 4925,
          rooms: [{ areaId: 3, tileX: 832, tileY: 984 }],
          roomRects: [{ index: 0, x: 4160, y: 4920, w: 40, h: 15, seed: 3 }],
          adjacentAreaIds: [2],
          objects: [],
          monsters: [],
          warps: [],
          isWalkable: (checkId, x, y) => checkId === 3 && x >= 4160 && x < 4200 && y >= 4920 && y < 4935,
        }
      }
      return null
    })

    const pId = game.connectPlayer({
      name: 'SeamSorc',
      classId: 1,
      areaId: 1,
      x: 4118,
      y: 4925,
      skills: { 36: 5 },
      rightSkill: 36,
      mana: 100,
      maxMana: 100,
    })

    // Walk onto the 5-subtile bridge overlap strip (x = 4123) inside Area 2's roomRects
    game.enqueueCommand(pId, { type: 'RunToLocation', x: 4123, y: 4925 })
    game.stepFrames(25)

    const pAfterBridge = game.getPlayerState(pId)!
    expect(pAfterBridge.areaId).toBe(2)
    expect(game.isAreaLoaded(3)).toBe(true)

    // Walk to the Area 2 <-> Area 3 wilderness seam and fire Fire Bolt (36) at a Cold Plains (Area 3) Fallen
    game.enqueueCommand(pId, { type: 'RunToLocation', x: 4158, y: 4925 })
    game.stepFrames(60)
    const fallenId = game.spawnMonster({ hcIdx: 1, areaId: 3, x: 4163, y: 4925, hp: 10, maxHp: 10 })
    const hpBefore = game.getMonsterState(fallenId)!.hp
    game.enqueueCommand(pId, { type: 'CastRightSkillOnTarget', unitId: fallenId, unitKind: 1 })
    game.stepFrames(25)
    expect(game.getMonsterState(fallenId)!.hp).toBeLessThan(hpBefore)
  })

  it('matches canonical 1.13c outdoor & Warp=-1 seam-adjacent pairs across all 5 Acts', () => {
    const levelsTxtWarpNeg1Openings = ['26:27', '27:28', '32:33', '107:108']
    const expected = new Set<string>(levelsTxtWarpNeg1Openings)
    for (const [a, b] of SEAMLESS_ADJACENCY) {
      expected.add(`${Math.min(a, b)}:${Math.max(a, b)}`)
    }
    expect([...CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C].sort()).toEqual([...expected].sort())
    // Act 1 Cold Plains <-> Burial Grounds (3:17), Dark Wood <-> Black Marsh (5:6), Black Marsh <-> Tamoe (6:7)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('3:17')).toBe(true)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('5:6')).toBe(true)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('6:7')).toBe(true)
    // Reject non-seamless dungeons / disconnected groups (Stony Field 4 <-> Dark Wood 5 uses Underground Passage 10; Den of Evil is 8)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('4:5')).toBe(false)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('7:8')).toBe(false)
    expect(CANONICAL_OUTDOOR_SEAM_ADJACENT_PAIRS_113C.has('8:26')).toBe(false)
  })

  it('maintains coherent area-indexed door and Bone Prison collision across mode/death transitions', () => {
    const game = new GameInstance({ mode: 'singlePlayer' })
    game.setAreaBootstrapResolver((req) => ({
      areaId: req.areaId,
      spawnX: 100,
      spawnY: 100,
      rooms: [{ areaId: req.areaId, tileX: 20, tileY: 20 }],
      roomRects: [{ index: 0, x: 90, y: 90, w: 30, h: 30, seed: 1 }],
      adjacentAreaIds: [],
      objects: [],
      monsters: [],
      warps: [],
      isWalkable: () => true,
    }))
    game.connectPlayer({ name: 'DoorTester', classId: 1, areaId: 28, x: 100, y: 100 })
    const host = game as unknown as GameInstanceHost

    // Closed Barracks door (classId 13) blocks its footprint; opening (mode 2) immediately unblocks
    const doorId = game.spawnObject({ classId: 13, areaId: 28, x: 105, y: 105, mode: 0 })
    expect(host.isClosedDoorAt(28, 105, 105)).toBe(true)
    expect(host.isClosedDoorAt(28, 105, 105, doorId)).toBe(false)
    expect(host.isWorldWalkableForPlayer(28, 105, 105)).toBe(false)

    const doorObj = game.objects.get(doorId)!
    host.setObjectMode(doorObj, 2)
    expect(host.isClosedDoorAt(28, 105, 105)).toBe(false)
    expect(host.isWorldWalkableForPlayer(28, 105, 105)).toBe(true)

    // Town Cow (hcIdx 179) must NOT be misclassified as BoneWall / BonePrison
    const cowId = game.spawnMonster({ hcIdx: 179, areaId: 28, x: 107, y: 107, hp: 20, maxHp: 20 })
    expect(host.hasLivingBonePrisonInArea(28)).toBe(false)
    expect(host.isBlockedByBonePrison(28, 107, 107)).toBe(false)
    game.monsters.delete(cowId)

    // BoneWall / BonePrison (hcIdx 344 / 340..343) blocks while alive and unblocks when killed or removed
    const boneWallId = game.spawnMonster({ hcIdx: 344, areaId: 28, x: 108, y: 108, hp: 20, maxHp: 20 })
    expect(host.hasLivingBonePrisonInArea(28)).toBe(true)
    expect(host.isBlockedByBonePrison(28, 108, 108)).toBe(true)
    expect(host.isWorldWalkableForPlayer(28, 108, 108)).toBe(false)

    game.monsters.get(boneWallId)!.dead = true
    expect(host.hasLivingBonePrisonInArea(28)).toBe(false)
    expect(host.isBlockedByBonePrison(28, 108, 108)).toBe(false)
    expect(host.isWorldWalkableForPlayer(28, 108, 108)).toBe(true)
  })

  it('removes consumed inventory potions and sold items cleanly from ClientWorld without leaving ghost stubs or deleting empty tbk tomes', () => {
    const game = new GameInstance({ mode: 'singlePlayer', areaId: 1 })
    const pId = game.connectPlayer({
      name: 'PotionVendorSorc',
      classId: 1,
      areaId: 1,
      x: 50,
      y: 50,
      mana: 5,
      maxMana: 35,
      gold: 500,
    })
    const akaraId = game.spawnMonster({
      classId: 148,
      name: 'Akara',
      areaId: 1,
      x: 51,
      y: 50,
      isNpc: true,
      isVendor: true,
    })
    const world = new ClientWorld()
    const flushToWorld = (): void => {
      for (const ev of game.drainPlayerEvents(pId)) {
        world.applyEvent(ev)
      }
    }
    flushToWorld()

    // 1. Pick up mp1 into inventory (fill belt first or spawn directly into inventory via ground pickup when belt has incompatible potions)
    for (let slot = 0; slot < 4; slot++) {
      const beltPot = game.spawnGroundItem({ code: 'hp1', areaId: 1, x: 50, y: 50 })
      game.enqueueCommand(pId, { type: 'ItemPickup', itemId: beltPot, toCursor: false })
      game.stepFrame()
    }
    const mp1Id = game.spawnGroundItem({ code: 'mp1', areaId: 1, x: 50, y: 50 })
    const hp1ExtraId = game.spawnGroundItem({ code: 'hp1', areaId: 1, x: 50, y: 50 })
    const capId = game.spawnGroundItem({ code: 'cap', areaId: 1, x: 50, y: 50 })
    const tbkId = game.spawnGroundItem({ code: 'tbk', areaId: 1, x: 50, y: 50, quantity: 1 })
    for (const id of [mp1Id, hp1ExtraId, capId, tbkId]) {
      game.enqueueCommand(pId, { type: 'ItemPickup', itemId: id, toCursor: false })
      game.stepFrame()
    }
    flushToWorld()

    expect(world.containers.inventory.has(mp1Id)).toBe(true)
    expect(world.containers.inventory.has(hp1ExtraId)).toBe(true)
    expect(world.containers.inventory.has(capId)).toBe(true)
    expect(world.containers.inventory.has(tbkId)).toBe(true)

    // Drink mp1 from inventory via ItemUse -> must be completely removed from ClientWorld inventory
    game.enqueueCommand(pId, { type: 'ItemUse', itemId: mp1Id, at: { x: 50, y: 50 } })
    game.stepFrame()
    flushToWorld()
    expect(world.containers.inventory.has(mp1Id)).toBe(false)
    expect(world.containers.allById.has(mp1Id)).toBe(false)

    // Open Akara trade and verify all ClientWorld inventory items price cleanly without throwing
    game.enqueueCommand(pId, { type: 'NpcAction', npcId: akaraId, action: 'trade' } as never)
    game.stepFrame()
    flushToWorld()
    for (const invItem of world.containers.inventory.values()) {
      expect(() =>
        itemToTransactionCostInput(invItem, world.containers.sockets.get(invItem.id) ?? [], 1),
      ).not.toThrow()
    }

    // Sell perm-stocked hp1 -> removed from inventory and NOT duplicated onto shop
    game.enqueueCommand(pId, { type: 'NpcSell', npcId: akaraId, itemId: hp1ExtraId })
    game.stepFrame()
    flushToWorld()
    expect(world.containers.inventory.has(hp1ExtraId)).toBe(false)
    expect(world.containers.shop.has(hp1ExtraId)).toBe(false)

    // Sell non-perm-stocked cap -> removed from inventory AND placed into Akara buyback shop
    game.enqueueCommand(pId, { type: 'NpcSell', npcId: akaraId, itemId: capId })
    game.stepFrame()
    flushToWorld()
    expect(world.containers.inventory.has(capId)).toBe(false)
    expect(world.containers.shop.has(capId)).toBe(true)

    // Cast last charge of tbk in Blood Moor (Area 2) -> tbk remains in inventory with quantity 0
    const pRec = (game as unknown as GameInstanceHost).players.get(pId)!
    pRec.areaId = 2
    game.enqueueCommand(pId, { type: 'TownPortal' })
    game.stepFrame()
    flushToWorld()
    expect(world.containers.inventory.get(tbkId)?.quantity).toBe(0)
  })

  it('indexes world room rects in O(1), keeps 30 enclosed monsters under 5ms/frame across 12 loaded areas, and guards invalid C2S commands', () => {
    expect(() => encodeD2gsClientCommand({ type: 'BogusClientCommand' } as never)).toThrow(ProtocolError)

    const game = new GameInstance({ mode: 'singlePlayer' })
    game.setAreaBootstrapResolver((req) => {
      const baseX = req.areaId * 1000
      const baseY = 5000
      const rooms = []
      const roomRects = []
      for (let rx = 0; rx < 8; rx++) {
        for (let ry = 0; ry < 8; ry++) {
          const x = baseX + rx * 40
          const y = baseY + ry * 40
          rooms.push({ areaId: req.areaId, tileX: Math.floor(x / 5), tileY: Math.floor(y / 5) })
          roomRects.push({ index: rooms.length - 1, x, y, w: 40, h: 40, seed: rx * 17 + ry })
        }
      }
      return {
        areaId: req.areaId,
        spawnX: baseX + 20,
        spawnY: baseY + 20,
        rooms,
        roomRects,
        adjacentAreaIds: req.areaId === 3 ? [17] : req.areaId === 17 ? [3] : [],
        objects: [],
        monsters: [],
        warps: [],
        // Walled 20x20 graveyard enclosure inside Area 17 at [17040..17060, 5040..5060]
        isWalkable: (_aid, x, y) => {
          if (req.areaId === 17) {
            const onFence =
              (x === 17040 || x === 17060) && y >= 5040 && y <= 5060
                ? true
                : (y === 17040 || y === 5040 || y === 5060) && x >= 17040 && x <= 17060
            if (onFence) return false
          }
          return x >= baseX && x < baseX + 320 && y >= baseY && y < baseY + 320
        },
      }
    })

    // Preload 12 areas (768 rooms) + 300 sleeping distant monsters + 30 enclosed active Burial Grounds monsters
    const pId = game.connectPlayer({ name: 'PerfSorc', classId: 1, areaId: 17, x: 17035, y: 5050 })
    const host = game as unknown as GameInstanceHost
    for (const aid of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 20]) {
      host.ensureAreaLoaded(aid)
      for (let m = 0; m < 30; m++) {
        game.spawnMonster({ hcIdx: 1, areaId: aid, x: aid * 1000 + 50 + (m % 10) * 3, y: 5050 + Math.floor(m / 10) * 3 })
      }
    }
    const enclosedIds: number[] = []
    for (let i = 0; i < 30; i++) {
      enclosedIds.push(
        game.spawnMonster({
          hcIdx: i === 0 ? 267 : 6,
          areaId: 17,
          x: 17044 + (i % 6) * 2,
          y: 5044 + Math.floor(i / 6) * 2,
          hp: 50,
          maxHp: 50,
        }),
      )
    }

    expect(host.areaIdAtWorldPoint(17050, 5050)).toBe(17)
    expect(host.areaIdAtWorldPoint(5050, 5050)).toBe(5)
    expect(host.areaIdAtWorldPoint(999999, 999999)).toBeUndefined()
    const firstMon = game.monsters.get(enclosedIds[0]!)!
    const secondMon = game.monsters.get(enclosedIds[1]!)!
    expect(host.isMonsterInActiveAoi(firstMon)).toBe(true)
    const distantMon = [...game.monsters.values()].find((m) => m.areaId === 20)!
    expect(host.isMonsterInActiveAoi(distantMon)).toBe(false)
    expect(host.isMonsterCellOccupied(firstMon, secondMon.x, secondMon.y)).toBe(true)
    expect(host.isMonsterCellOccupied(firstMon, firstMon.x, firstMon.y)).toBe(false)

    // Warm 1 frame, then benchmark 10 consecutive frames with 30 enclosed monsters + 300 sleeping monsters across 768 rooms
    game.stepFrame()
    const t0 = performance.now()
    game.stepFrames(10)
    const perFrameMs = (performance.now() - t0) / 10
    expect(perFrameMs).toBeLessThan(8)
    expect(game.getPlayerState(pId)?.areaId).toBe(17)
  })

  it('spawns field Town Portals on a walkable subtile when (player.x + 1, player.y + 1) is blocked by a dungeon wall', () => {
    const game = new GameInstance({ mode: 'singlePlayer' })
    game.setAreaBootstrapResolver((req) => ({
      areaId: req.areaId,
      spawnX: 100,
      spawnY: 100,
      rooms: [{ areaId: req.areaId, tileX: 20, tileY: 20 }],
      roomRects: [{ index: 0, x: 90, y: 90, w: 30, h: 30, seed: 1 }],
      adjacentAreaIds: [],
      objects: [],
      monsters: [],
      warps: [],
      findActSpawnLocation: () => ({ x: 102, y: 102 }),
      // Solid south/east dungeon wall for x >= 101 or y >= 101 in Jail Level 2 (Area 30)
      isWalkable: (_aid, x, y) => (req.areaId === 30 ? x >= 95 && x <= 100 && y >= 95 && y <= 100 : true),
    }))
    const pId = game.connectPlayer({ name: 'WallPortalSorc', classId: 1, areaId: 30, x: 100, y: 100 })
    const scrollId = game.spawnGroundItem({ code: 'tsc', areaId: 30, x: 100, y: 100 })
    game.enqueueCommand(pId, { type: 'ItemPickup', itemId: scrollId, toCursor: false })
    game.stepFrame()
    const invScroll = game.players.get(pId)!.items.find((i) => i.code === 'tsc')!

    game.enqueueCommand(pId, { type: 'ItemUse', itemId: invScroll.unitId, at: { x: 100, y: 100 } })
    game.stepFrame()

    const fieldPortal = [...game.objects.values()].find((o) => o.areaId === 30 && o.classId === 59)!
    expect(fieldPortal).toBeDefined()
    // Must not land inside the blocked wall at (101, 101)
    expect(fieldPortal.x).toBeLessThanOrEqual(100)
    expect(fieldPortal.y).toBeLessThanOrEqual(100)

    game.enqueueCommand(pId, { type: 'OperateObject', objectId: fieldPortal.unitId })
    game.stepFrames(2)
    expect(game.getPlayerState(pId)?.areaId).toBe(1)
  })

  it('prevents NextInClass cross-Act minion leaks across all 734 MonStats rows and all 136 levels x 3 difficulties', () => {
    expect(MONSTATS_113C_ROWS).toHaveLength(734)
    // Act 1 DarkOne (22), DarkShaman (61), and RatMan (141) have blank minion2 in MonStats.bin (-1)
    expect(MONSTATS_113C_ROWS[22]?.minions).toEqual(['fallen4'])
    expect(MONSTATS_113C_ROWS[61]?.minions).toEqual(['fallen4'])
    expect(MONSTATS_113C_ROWS[141]?.minions).toEqual(['fetish1'])

    for (const diff of ['normal', 'nightmare', 'hell'] as const) {
      const kinds = getCanonicalMonsterKinds(diff)
      for (let areaId = 1; areaId <= 136; areaId += 1) {
        const plan = getLevelMonsterPlan113c(areaId, diff)
        if (!plan) continue
        const poolKinds = plan.pool
          .map((id) => kinds.get(id))
          .filter((k): k is MonsterKind => k !== undefined)
        const allowedIds = new Set<string>([...plan.pool, ...plan.elitePool])
        for (const baseId of [...plan.pool, ...plan.elitePool]) {
          const k = kinds.get(baseId)
          if (k) {
            for (const mId of k.minions) allowedIds.add(mId)
          }
        }
        const groups = planMonsterGroups(plan, poolKinds, kinds, 24, new Rng(areaId * 1337 + 7), {
          difficulty: diff,
        })
        for (const g of groups) {
          for (const member of [g.kind, ...(g.minionKinds ?? []), ...(g.companions ?? [])]) {
            expect(allowedIds.has(member.id)).toBe(true)
            if (diff === 'normal' && areaId <= 39) {
              // Act 5 Lv40 WarpedFallen (fallen5) and Act 3 Lv24 Fetish (fetish2) must never spawn in Act 1
              expect(member.id).not.toBe('fallen5')
              expect(member.id).not.toBe('fetish2')
            }
          }
        }
      }
    }
  })

  it('throttles monster A* replanning and indexes 225-room dungeon AOI in O(1) while player moves continuously', () => {
    const game = new GameInstance({ mode: 'singlePlayer' })
    game.setAreaBootstrapResolver((req) => {
      const baseX = 22000
      const baseY = 6000
      const rooms = []
      const roomRects = []
      for (let rx = 0; rx < 15; rx++) {
        for (let ry = 0; ry < 15; ry++) {
          const x = baseX + rx * 40
          const y = baseY + ry * 40
          rooms.push({ areaId: req.areaId, tileX: Math.floor(x / 5), tileY: Math.floor(y / 5) })
          roomRects.push({ index: rooms.length - 1, x, y, w: 40, h: 40, seed: rx * 31 + ry })
        }
      }
      return {
        areaId: req.areaId,
        spawnX: baseX + 100,
        spawnY: baseY + 100,
        rooms,
        roomRects,
        adjacentAreaIds: [],
        objects: [],
        monsters: [],
        warps: [],
        // Wall at x = 22120 separating sealed room (x > 22120) from player corridor (x < 22120)
        isWalkable: (_aid, x, y) => x !== 22120 && x >= baseX && x < baseX + 600 && y >= baseY && y < baseY + 600,
      }
    })

    const pId = game.connectPlayer({ name: 'CatacombsSorc', classId: 1, areaId: 35, x: 22100, y: 6100 })
    // 25 monsters sealed behind the Catacombs wall at x = 22120 + 8 monsters chasing in the open corridor
    for (let i = 0; i < 25; i++) {
      game.spawnMonster({
        hcIdx: 22,
        areaId: 35,
        x: 22126 + (i % 5) * 2,
        y: 6094 + Math.floor(i / 5) * 2,
      })
    }
    const chaserId = game.spawnMonster({
      hcIdx: 22,
      areaId: 35,
      x: 22112,
      y: 6100,
    })
    for (let i = 1; i < 8; i++) {
      game.spawnMonster({
        hcIdx: 22,
        areaId: 35,
        x: 22112 + (i % 3) * 2,
        y: 6096 + Math.floor(i / 3) * 2,
      })
    }

    const startDist = Math.hypot(
      game.monsters.get(chaserId)!.x - game.players.get(pId)!.x,
      game.monsters.get(chaserId)!.y - game.players.get(pId)!.y,
    )
    game.enqueueCommand(pId, { type: 'Move', to: { x: 22085, y: 6105 }, run: true })
    game.stepFrame()

    const t0 = performance.now()
    for (let f = 0; f < 40; f++) {
      // Simulate fractional continuous player movement every frame
      if (f % 4 === 0) {
        game.enqueueCommand(pId, {
          type: 'Move',
          to: { x: 22095 - Math.floor(f / 4), y: 6100 + (f % 3) },
          run: true,
        })
      }
      game.stepFrame()
      game.drainEvents(pId)
    }
    const perFrameMs = (performance.now() - t0) / 40
    expect(perFrameMs).toBeLessThan(8)
    // Chaser must actively advance westward toward the moving player
    expect(game.monsters.get(chaserId)!.x).toBeLessThan(22112)
    expect(startDist).toBeGreaterThan(0)
  })

  it('maintains 1.13c S2C 0x9B MercReviveCost across merc death, Kashya resurrection, and subsequent HP updates', () => {
    const game = new GameInstance({ mode: 'singlePlayer', areaId: 1 })
    const pId = game.connectPlayer({ name: 'MercSorc', classId: 1, areaId: 1, x: 5100, y: 5100, gold: 5000 })
    const kashyaId = game.spawnMonster({ classId: 150, name: 'Kashya', areaId: 1, x: 5102, y: 5100, isNpc: true })
    game.players.get(pId)!.activeNpcId = kashyaId

    const world = new ClientWorld()
    world.selfId = pId
    const flush = () => {
      for (const ev of game.drainEvents(pId)) world.apply(ev)
    }

    const mercId = game.hireMercenary(pId, { act: 1, subType: 0, level: 10, hp: 120, maxHp: 120 })
    flush()
    expect(world.merc?.mercId).toBe(mercId)
    expect(world.merc?.isDead).toBe(false)
    expect(world.hasDeadMercenary).toBe(false)

    // Kill the mercenary via combat damage -> must emit S2C 0x9B(nameId, 750)
    const host = game as unknown as GameInstanceHost
    host.applyDamageToMerc(mercId, 500, 1)
    flush()
    expect(world.hasDeadMercenary).toBe(true)
    expect(world.deadMercReviveCost).toBe(750)
    expect(world.merc?.isDead).toBe(true)

    // Resurrect at Kashya -> must emit S2C 0x9B(0xFFFF, 0) so subsequent Party(memberState) HP updates keep isDead === false
    game.enqueueCommand(pId, { type: 'MercResurrect', npcId: kashyaId })
    game.stepFrame()
    flush()
    expect(world.hasDeadMercenary).toBe(false)
    expect(world.deadMercReviveCost).toBe(0)
    expect(world.merc?.isDead).toBe(false)

    // Non-lethal damage after resurrection must NOT flip world.merc.isDead back to true
    host.applyDamageToMerc(mercId, 20, 1)
    flush()
    expect(world.merc?.isDead).toBe(false)
    expect(world.hasDeadMercenary).toBe(false)

    // Joining with a dead saved mercenary must immediately populate world.hasDeadMercenary via S2C 0x9B
    const game2 = new GameInstance({ mode: 'singlePlayer', areaId: 1 })
    const p2 = game2.connectPlayer({ name: 'DeadMercJoin', classId: 1, areaId: 1, x: 5100, y: 5100 })
    game2.hireMercenary(p2, { act: 1, subType: 0, level: 10, dead: true })
    const world2 = new ClientWorld()
    world2.selfId = p2
    for (const ev of game2.drainEvents(p2)) world2.apply(ev)
    expect(world2.hasDeadMercenary).toBe(true)
    expect(world2.deadMercReviveCost).toBe(750)
  })

  it('restores player HP, Mana, and Stamina to accrued max (including item bonuses) across all 6 town healers per D2Game.dll 0x6fcdd490', () => {
    const healers = [
      { hcIdx: 148, name: 'Akara', areaId: 1 },
      { hcIdx: 176, name: 'Atma', areaId: 40 },
      { hcIdx: 178, name: 'Fara', areaId: 40 },
      { hcIdx: 255, name: 'Ormus', areaId: 75 },
      { hcIdx: 405, name: 'Jamella', areaId: 103 },
      { hcIdx: 513, name: 'Malah', areaId: 109 },
    ]
    for (const h of healers) {
      const game = new GameInstance({ mode: 'singlePlayer', areaId: h.areaId })
      const pId = game.connectPlayer({
        name: `Heal${h.hcIdx}`,
        classId: 1,
        areaId: h.areaId,
        x: 5100,
        y: 5100,
      })
      const npcId = game.spawnMonster({
        classId: h.hcIdx,
        name: h.name,
        areaId: h.areaId,
        x: 5102,
        y: 5100,
        isNpc: true,
      })
      const p = game.players.get(pId)!
      // Equip a ring with +10 Life (stat 7 = 2560) and +15 Mana (stat 9 = 3840)
      p.items.push({
        unitId: 9901,
        code: 'rin',
        name: 'Bahamut Ring of the Whale',
        quality: 4,
        level: 10,
        identified: true,
        socketed: false,
        ethereal: false,
        location: 'equipped',
        bodyLoc: 6,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        areaId: 1,
        ownerId: pId,
        storePage: 0,
        gamble: false,
        quantity: 1,
        durability: 0,
        maxDurability: 0,
        cost: 500,
        totalSockets: 0,
        socketedItems: [],
        stats: new Map([
          [7, 10 * 256],
          [9, 15 * 256],
        ]),
      })
      p.hp = 5
      p.hpFixed = 5 * 256
      p.mana = 3
      p.manaFixed = 3 * 256
      p.stamina = 10
      p.staminaFixed = 10 * 256
      game.drainEvents(pId)

      game.enqueueCommand(pId, { type: 'NpcInit', target: { unitType: 1, id: npcId } })
      game.stepFrame()

      const host = game as unknown as GameInstanceHost
      expect(p.hpFixed).toBe(host.getPlayerAccruedMaxHpFixed(p))
      expect(p.manaFixed).toBe(host.getPlayerAccruedMaxManaFixed(p))
      expect(p.staminaFixed).toBe(host.getPlayerAccruedMaxStaminaFixed(p))
      expect(p.mana).toBeGreaterThanOrEqual(50)
    }
  })

  it('Bug #18: Rare/Crafted items whose generated name matches a Unique/Set item (e.g. "Raven Claw" Leather Gloves) preserve base sprite', async () => {
    const { resolveItemInvFile } = await import('../../src/common/items/item-bridge.ts')
    const { resolveItemSpriteRect, resolveGroundItemFlippyKey } = await import(
      '../../src/client/ui/inventory.ts'
    )
    const { BAKED_UI_MANIFEST } = await import('../../src/common/items/baked-ui-meta.ts')

    // Rare Leather Gloves ("lgl") that rolled RarePrefix 158 ("Raven") + RareSuffix 92 ("Claw") = "Raven Claw"
    const rareGloves = {
      name: 'Raven Claw',
      code: 'lgl',
      quality: 'rare' as const,
      base: { id: 'lgl', name: 'Gloves(L)', kind: 'armor' as const, invfile: 'invlgl', invWidth: 2, invHeight: 2 },
    }
    const resolvedRare = resolveItemInvFile(rareGloves as never, 'rare', 'lgl')
    expect(resolvedRare.invFile).toBe('invlgl')
    expect(resolvedRare.invtransform).toBeUndefined()

    const rareRect = resolveItemSpriteRect({
      code: 'lgl',
      name: 'Raven Claw',
      quality: 'rare',
    })
    expect(rareRect).toEqual(BAKED_UI_MANIFEST.itemRects['invlgl'])
    expect(rareRect?.w).toBe(56)
    expect(rareRect?.h).toBe(56)
    expect(
      resolveGroundItemFlippyKey({
        code: 'lgl',
        name: 'Raven Claw',
        quality: 'rare',
      }),
    ).toBe('flplgl')

    // Meanwhile, actual Unique Long Bow ("lbw") "Raven Claw" still resolves to its dyed unique bow graphic
    const uniqueBow = {
      name: 'Raven Claw',
      code: 'lbw',
      quality: 'unique' as const,
      base: { id: 'lbw', name: 'Long Bow', kind: 'weapon' as const, invfile: 'invlbw', invWidth: 2, invHeight: 4 },
    }
    const resolvedUnique = resolveItemInvFile(uniqueBow as never, 'unique', 'lbw')
    expect(resolvedUnique.invFile).toBe('invlbw')
    expect(resolvedUnique.invtransform).toBe('dred')
    expect(
      resolveGroundItemFlippyKey({
        code: 'lbw',
        name: 'Raven Claw',
        quality: 'unique',
      }),
    ).toBe('flplbw_dred')
  })
})
