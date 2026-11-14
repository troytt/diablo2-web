/**
 * Wave 2 P0 Save Hydration, Iron Golem & World Event Verification Suite (#1786, #1787, #1842):
 * - #1786: Town corpse hydration from `.d2s` (`0x6FD0DC60`), click-only town recovery, multi-corpse
 *   highest-gold-value save (`0x6FD0D750`), and default mercenary + `jf` equipment hydration in `MultiClientRoomHost`.
 * - #1787: Iron Golem (`Skills.txt` `#90`, `0x6FD01D20`) ground metallic item validation & consumption,
 *   stat/aura inheritance (`stat 151` Meditation, weapon damage + Fire Golem synergy, CB, resistances),
 *   `.d2s` `kf` auto-summon on room entry (`0x6FD0DF50`), and `kf` clear on death / replacement / owner death (`0x6FD0D880`).
 * - #1842: 1.13c Diablo Clone (`MonStats.txt` `#333` `diabloclone`) World Event triggered by selling
 *   Unique `#122` `The Stone of Jordan` in Hell, replacing the first unvisited eligible `SuperUnique`
 *   (including seam-preloaded rooms while excluding Ancients/Baal waves), and dropping guaranteed Unique `#381` `Annihilus`.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  createMemoryStreamPair,
  decodePacket,
  serverEventToS2cPackets,
  TsClientAdapter,
  type ClientCommand,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import {
  GameInstance,
  MultiClientRoomHost,
  readD2sSave113c,
  SINGLE_PLAYER_POLICY,
} from '../../src/server/index.ts'

interface SyntheticItemSpec {
  unitId: number
  code: string
  name?: string
  quality?: number
  level?: number
  location?: 'inventory' | 'equipped' | 'cursor' | 'ground'
  bodyLoc?: number
  x?: number
  y?: number
  width?: number
  height?: number
  ownerId?: number
  areaId?: number
  cost?: number
  identified?: boolean
  ethereal?: boolean
  durability?: number
  maxDurability?: number
  uniqueItemId?: number
  statsMap?: ReadonlyMap<number, number>
  rawStats?: readonly { statId: number; param: number; value: number }[]
}

function makeServerItem(spec: SyntheticItemSpec) {
  const loc = spec.location ?? 'inventory'
  const bodyLoc = spec.bodyLoc ?? (loc === 'equipped' ? 4 : 0)
  const stats = spec.statsMap ? new Map(spec.statsMap) : new Map<number, number>()
  const rawStats = spec.rawStats
    ? [...spec.rawStats]
    : Array.from(stats.entries()).map(([statId, value]) => ({ statId, param: 0, value }))
  return {
    unitId: spec.unitId,
    code: spec.code,
    name: spec.name ?? spec.code,
    quality: spec.quality ?? 2,
    level: spec.level ?? 80,
    location: loc,
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    width: spec.width ?? 1,
    height: spec.height ?? 1,
    areaId: spec.areaId ?? 1,
    ownerId: spec.ownerId ?? 1,
    bodyLoc,
    storePage: loc === 'inventory' ? 1 : 0,
    cost: spec.cost ?? 1000,
    gamble: false,
    identified: spec.identified ?? true,
    ethereal: spec.ethereal ?? false,
    socketed: false,
    totalSockets: 0,
    durability: spec.durability ?? 30,
    maxDurability: spec.maxDurability ?? 30,
    quantity: 1,
    stats,
    socketedItems: [] as never[],
    rawItemData: {
      id: spec.unitId,
      itemId: spec.unitId,
      code: spec.code,
      name: spec.name ?? spec.code,
      quality: spec.quality ?? 2,
      level: spec.level ?? 80,
      identified: spec.identified ?? true,
      ethereal: spec.ethereal ?? false,
      broken: false,
      socketed: false,
      sockets: 0,
      location: loc === 'cursor' ? 4 : loc === 'equipped' ? 1 : loc === 'ground' ? 3 : 0,
      bodyLoc,
      equippedSlot: bodyLoc,
      x: spec.x ?? 0,
      y: spec.y ?? 0,
      container: loc === 'inventory' ? 1 : 0,
      durability: spec.durability ?? 30,
      maxDurability: spec.maxDurability ?? 30,
      ...(spec.uniqueItemId !== undefined ? { uniqueItemId: spec.uniqueItemId } : {}),
      stats: rawStats,
      runewordStats: [],
    } as never,
  }
}

function getInternalPlayers(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { players: Map<number, Record<string, any>> }).players
}

function getInternalMonsters(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { monsters: Map<number, Record<string, any>> }).monsters
}

function getInternalMercenaries(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { mercenaries: Map<number, Record<string, any>> }).mercenaries
}

function getInternalGroundItems(game: GameInstance): Map<number, Record<string, any>> {
  return (game as unknown as { groundItems: Map<number, Record<string, any>> }).groundItems
}

describe('Wave 2 P0 Save Hydration, Iron Golem & World Event Slice (#1786, #1787, #1842)', () => {
  // ============================================================================
  // #1786: Town Corpse Hydration, Multi-Corpse Gold Selection & Merc Hydration
  // ============================================================================
  describe('#1786: Town Corpse Hydration, Click Recovery, Multi-Corpse Save & RoomHost Merc Hydration', () => {
    it('hydrates unrecovered outdoor death corpse in town on re-entry, preserves it across unlooted leaves, and re-equips gear on click (including binary D2GS -> ClientWorld)', () => {
      // 1. Room 1: Player with 4 equipped items + 1 inventory charm dies outdoors in Blood Moor (area 2)
      const room1 = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 178601,
        difficulty: 0,
        act: 0,
        areaId: 2,
      })
      const p1 = room1.connectPlayer({
        name: 'CorpsePal',
        charClass: 'pal',
        level: 45,
        strength: 120,
        dexterity: 90,
        areaId: 2,
        x: 80,
        y: 80,
      })
      const p1Rec = getInternalPlayers(room1).get(p1)!
      p1Rec.items = [
        makeServerItem({ unitId: 9001, code: 'cap', location: 'equipped', bodyLoc: 1, width: 2, height: 2, ownerId: p1 }),
        makeServerItem({ unitId: 9002, code: 'qui', location: 'equipped', bodyLoc: 3, width: 2, height: 3, ownerId: p1 }),
        makeServerItem({ unitId: 9003, code: 'bsd', location: 'equipped', bodyLoc: 4, width: 2, height: 3, ownerId: p1 }),
        makeServerItem({ unitId: 9004, code: 'buc', location: 'equipped', bodyLoc: 5, width: 2, height: 2, ownerId: p1 }),
        makeServerItem({ unitId: 9005, code: 'cm1', location: 'inventory', x: 0, y: 0, width: 1, height: 1, ownerId: p1 }),
      ]
      room1.drainEvents(p1)

      room1.applyDamageToPlayer(p1, 99999, { killerType: 'monster' })
      expect(room1.getPlayerState(p1)!.dead).toBe(true)

      // Save & exit Room 1 without recovering corpse
      const savedAfterDeath = room1.exportPlayerD2s(p1)
      const parsed1 = readD2sSave113c(savedAfterDeath)
      expect(parsed1.corpseItems.map((i) => i.code.trim()).sort()).toEqual(['bsd', 'buc', 'cap', 'qui'])
      expect(parsed1.items.map((i) => i.code.trim())).toEqual(['cm1'])

      // 2. Room 2: Join via MultiClientRoomHost -> town spawn must materialize clickable corpse entity
      const host2 = new MultiClientRoomHost({
        gameName: 'SaveCorpseRoom2',
        seed: 178602,
        difficulty: 0,
        act: 0,
        areaId: 1,
      })
      const [clientStream2, serverStream2] = createMemoryStreamPair()
      const clientAdapter2 = new TsClientAdapter(clientStream2)
      const room2Events: ServerEvent[] = []
      clientAdapter2.onEvent((ev) => room2Events.push(ev))

      const p2 = host2.connectClient(serverStream2, {
        protocol: 'ts',
        d2sBytes: savedAfterDeath,
      })
      host2.tick(40)

      const p2State = host2.game.getPlayerState(p2)!
      expect(p2State.dead).toBe(false)
      expect(p2State.areaId).toBe(1) // Rogue Encampment town
      expect(p2State.corpseId).toBeDefined()
      const townCorpseId = p2State.corpseId!

      // Verify binary D2GS S2C encoding -> decode -> ClientWorld produces a dead, hoverable, clickable corpse unit
      const world = new ClientWorld()
      for (const ev of room2Events) {
        if (ev.type === 'LoadAct') {
          world.apply(ev as never)
          continue
        }
        const pkts = serverEventToS2cPackets(ev)
        for (const pkt of pkts) {
          const decoded = decodePacket(pkt, 'S2C')
          if (decoded.ok && decoded.event) {
            world.apply(decoded.event)
          }
        }
      }
      const clientCorpse = world.getUnit('player', townCorpseId)
      expect(clientCorpse).toBeDefined()
      expect(clientCorpse!.dead).toBe(true)
      expect(clientCorpse!.mode).toBe(17)
      expect(world.corpses.get(townCorpseId)).toBe(p2)

      const camera = new ViewportCamera()
      camera.update(world.self.x, world.self.y)
      const hudModel = new HudModel({ world } as never)
      const sentCmds: ClientCommand[] = []
      const mapper = new CommandMapper({
        world,
        camera,
        hudModel,
        sendCommand: (c) => sentCmds.push(c),
      })
      const screenPt = camera.subtileToScreen(clientCorpse!.x, clientCorpse!.y)
      const hovered = mapper.findUnitAtScreenPoint(screenPt.x, screenPt.y - 8)
      expect(hovered?.unitType).toBe('player')
      expect(hovered?.id).toBe(townCorpseId)

      // Walking in town over the corpse WITHOUT clicking must NOT auto-loot the town-hydrated corpse
      host2.game.enqueueCommand(p2, { type: 'Move', x: p2State.x + 1, y: p2State.y, run: false })
      host2.tick(80)
      expect(host2.game.getPlayerState(p2)!.corpseId).toBe(townCorpseId)

      // Leaving Room 2 WITHOUT clicking the corpse MUST preserve all 4 corpseItems in `.d2s`!
      const savedUnlooted = host2.disconnectClient(p2)
      expect(savedUnlooted).not.toBeNull()
      const parsed2 = readD2sSave113c(savedUnlooted!)
      expect(parsed2.corpseItems.map((i) => i.code.trim()).sort()).toEqual(['bsd', 'buc', 'cap', 'qui'])
      host2.close()

      // 3. Room 3: Re-enter with savedUnlooted and click the town corpse -> full gear restored!
      const host3 = new MultiClientRoomHost({
        gameName: 'SaveCorpseRoom3',
        seed: 178603,
        difficulty: 0,
        act: 0,
        areaId: 1,
      })
      const [clientStream3, serverStream3] = createMemoryStreamPair()
      const clientAdapter3 = new TsClientAdapter(clientStream3)
      const room3Events: ServerEvent[] = []
      clientAdapter3.onEvent((ev) => room3Events.push(ev))

      const p3 = host3.connectClient(serverStream3, {
        protocol: 'ts',
        d2sBytes: savedUnlooted!,
      })
      host3.tick(40)
      const corpseId3 = host3.game.getPlayerState(p3)!.corpseId!
      expect(corpseId3).toBeGreaterThan(0)
      room3Events.length = 0

      clientAdapter3.send({
        type: 'Interact',
        target: { unitType: 0, id: corpseId3 },
      })
      host3.tick(40)

      const recoveredState = host3.game.getPlayerState(p3)!
      expect(recoveredState.corpseId).toBeUndefined()
      const equippedBySlot = new Map(
        recoveredState.items
          .filter((i) => i.location === 'equipped')
          .map((i) => [i.bodyLoc, i.code.trim()]),
      )
      expect(equippedBySlot.get(1)).toBe('cap')
      expect(equippedBySlot.get(3)).toBe('qui')
      expect(equippedBySlot.get(4)).toBe('bsd')
      expect(equippedBySlot.get(5)).toBe('buc')
      expect(
        room3Events.some(
          (ev) => ev.type === 'CorpseAssign' && ev.assign === 0 && ev.corpseId === corpseId3,
        ),
      ).toBe(true)
      expect(
        room3Events.some(
          (ev) => ev.type === 'UnitRemove' && (ev.id === corpseId3 || ev.unitId === corpseId3),
        ),
      ).toBe(true)

      const savedRecovered = host3.disconnectClient(p3)!
      const parsed3 = readD2sSave113c(savedRecovered)
      expect(parsed3.corpseItems.length).toBe(0)
      expect(parsed3.items.map((i) => i.code.trim()).sort()).toEqual(['bsd', 'buc', 'cap', 'cm1', 'qui'])
      host3.close()
    })

    it('saves the highest-gold-value corpse when multiple unrecovered corpses exist (0x6FD0D750) and places occupied-slot corpse items into inventory', () => {
      const game = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 178604,
        difficulty: 2,
        act: 0,
        areaId: 2,
      })
      const p1 = game.connectPlayer({
        name: 'MultiCorpseHero',
        charClass: 'bar',
        level: 75,
        strength: 180,
        dexterity: 120,
        areaId: 2,
        x: 60,
        y: 60,
      })
      const pRec = getInternalPlayers(game).get(p1)!
      // First death with expensive Unique armor + weapon
      pRec.items = [
        makeServerItem({
          unitId: 9101,
          code: 'uar',
          quality: 7,
          cost: 35000,
          location: 'equipped',
          bodyLoc: 3,
          width: 2,
          height: 3,
          ownerId: p1,
        }),
        makeServerItem({
          unitId: 9102,
          code: '7cr',
          quality: 7,
          cost: 35000,
          location: 'equipped',
          bodyLoc: 4,
          width: 2,
          height: 3,
          ownerId: p1,
        }),
      ]
      game.applyDamageToPlayer(p1, 99999, { killerType: 'monster' })
      expect(game.getPlayerState(p1)!.dead).toBe(true)

      // Respawn, equip a cheap normal cap on head, walk back out and die a second time
      game.enqueueCommand(p1, { type: 'Respawn' })
      game.stepFrame()
      game.movePlayer(p1, 70, 70)
      pRec.items.push(
        makeServerItem({
          unitId: 9103,
          code: 'cap',
          quality: 2,
          cost: 12,
          location: 'equipped',
          bodyLoc: 1,
          width: 2,
          height: 2,
          ownerId: p1,
        }),
      )
      game.applyDamageToPlayer(p1, 99999, { killerType: 'monster' })
      expect(game.getPlayerState(p1)!.dead).toBe(true)

      // `.d2s` export must choose the high-gold-value first corpse ('uar' + '7cr'), NOT the cheap 'cap' corpse!
      const exported = readD2sSave113c(game.exportPlayerD2s(p1))
      expect(exported.corpseItems.map((i) => i.code.trim()).sort()).toEqual(['7cr', 'uar'])

      // Also verify occupied-slot safety on recovery: respawn, put another helm on slot 1, and loot the 'cap' corpse
      game.enqueueCommand(p1, { type: 'Respawn' })
      game.stepFrame()
      const capCorpseId = game.getPlayerState(p1)!.corpseId!
      game.movePlayer(p1, 70, 70)
      pRec.items.push(
        makeServerItem({
          unitId: 9104,
          code: 'hlm',
          quality: 2,
          location: 'equipped',
          bodyLoc: 1,
          width: 2,
          height: 2,
          ownerId: p1,
        }),
      )
      game.enqueueCommand(p1, { type: 'InteractEntity', targetType: 'player', targetId: capCorpseId })
      game.stepFrame()

      const afterCapLoot = game.getPlayerState(p1)!
      expect(afterCapLoot.items.find((i) => i.code.trim() === 'hlm')?.location).toBe('equipped')
      expect(afterCapLoot.items.find((i) => i.code.trim() === 'cap')?.location).toBe('inventory')
    })

    it('hydrates live mercenary entity and `jf` equipment by default when joining MultiClientRoomHost with `.d2s`', () => {
      // Room 1: hire Act 2 merc and equip polearm ('vou') + helm ('hlm'), then save `.d2s`
      const room1 = new MultiClientRoomHost({
        gameName: 'MercSaveRoom1',
        seed: 178605,
        difficulty: 0,
        act: 1,
        areaId: 40,
      })
      const [c1, s1] = createMemoryStreamPair()
      void c1
      const p1 = room1.connectClient(s1, {
        protocol: 'ts',
        name: 'MercBoss',
        charClass: 'sor',
        level: 36,
        areaId: 40,
        x: 100,
        y: 100,
      })
      const mercId1 = room1.game.hireMercenary(p1, {
        act: 2,
        subType: 7,
        level: 35,
        difficulty: 1,
      })
      const merc1 = getInternalMercenaries(room1.game).get(mercId1)!
      merc1.equipment.push(
        makeServerItem({
          unitId: 9201,
          code: 'vou',
          location: 'equipped',
          bodyLoc: 4,
          width: 2,
          height: 4,
          ownerId: mercId1,
        }),
        makeServerItem({
          unitId: 9202,
          code: 'hlm',
          location: 'equipped',
          bodyLoc: 1,
          width: 2,
          height: 2,
          ownerId: mercId1,
        }),
      )
      const savedMercD2s = room1.disconnectClient(p1)!
      room1.close()

      const parsedMercSave = readD2sSave113c(savedMercD2s)
      expect(parsedMercSave.merc.dead).toBe(false)
      expect(parsedMercSave.merc.seed).not.toBe(0)
      expect(parsedMercSave.mercItems.map((i) => i.code.trim()).sort()).toEqual(['hlm', 'vou'])

      // Room 2: join MultiClientRoomHost WITHOUT passing `restoreMercenary` -> merc + 2 items must hydrate!
      const room2 = new MultiClientRoomHost({
        gameName: 'MercSaveRoom2',
        seed: 178606,
        difficulty: 0,
        act: 1,
        areaId: 40,
      })
      const [c2, s2] = createMemoryStreamPair()
      const client2 = new TsClientAdapter(c2)
      const room2Events: ServerEvent[] = []
      client2.onEvent((ev) => room2Events.push(ev))

      const p2 = room2.connectClient(s2, {
        protocol: 'ts',
        d2sBytes: savedMercD2s,
      })
      room2.tick(40)

      const mercs2 = [...getInternalMercenaries(room2.game).values()].filter(
        (m) => m.ownerPlayerId === p2,
      )
      expect(mercs2.length).toBe(1)
      expect(mercs2[0]!.alive).toBe(true)
      expect(mercs2[0]!.equipment.map((i: { code: string }) => i.code.trim()).sort()).toEqual([
        'hlm',
        'vou',
      ])
      expect(
        room2Events.some(
          (ev) =>
            ev.type === 'ItemEvent' &&
            ev.container === 'equipment' &&
            ev.item?.ownerType === 1 &&
            ev.item?.ownerId === mercs2[0]!.unitId,
        ),
      ).toBe(true)

      const reSaved = readD2sSave113c(room2.disconnectClient(p2)!)
      expect(reSaved.mercItems.map((i) => i.code.trim()).sort()).toEqual(['hlm', 'vou'])
      room2.close()
    })
  })

  // ============================================================================
  // #1787: Iron Golem (#90) Ground Metal Item Cast, `.d2s` `kf` Auto-Summon & Clear
  // ============================================================================
  describe('#1787: Iron Golem (#90) Ground Metal Item Cast, Stat/Aura Inheritance & `.d2s` `kf` Lifecycle', () => {
    it('rejects empty ground and non-metallic ground items (wood bow, wand, leather armor, ring) without spending mana or consuming items', () => {
      const game = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 178701,
        difficulty: 0,
        act: 0,
        areaId: 2,
      })
      const necId = game.connectPlayer({
        name: 'MetalNec',
        charClass: 'nec',
        level: 40,
        mana: 300,
        maxMana: 300,
        skills: { 90: 10 },
        areaId: 2,
        x: 50,
        y: 50,
      })
      const groundMap = getInternalGroundItems(game)
      const nonMetalCodes = ['sbw', 'wnd', 'qui', 'rin']
      nonMetalCodes.forEach((code, idx) => {
        groundMap.set(
          9300 + idx,
          makeServerItem({
            unitId: 9300 + idx,
            code,
            location: 'ground',
            areaId: 2,
            x: 52 + idx,
            y: 50,
          }),
        )
      })
      game.drainEvents(necId)
      const manaBefore = game.getPlayerState(necId)!.mana

      // Empty ground cast
      game.enqueueCommand(necId, {
        type: 'CastSkillAtLocation',
        skillId: 90,
        x: 40,
        y: 40,
      })
      // Non-metallic target casts
      for (let idx = 0; idx < nonMetalCodes.length; idx++) {
        game.enqueueCommand(necId, {
          type: 'CastSkillOnTarget',
          skillId: 90,
          targetType: 'item',
          targetId: 9300 + idx,
        })
      }
      game.stepFrames(2)

      expect(game.getPetsForOwner(necId).length).toBe(0)
      expect(game.getPlayerState(necId)!.mana).toBe(manaBefore)
      expect(groundMap.size).toBe(nonMetalCodes.length)
    })

    it('consumes ground metallic Insight polearm, inherits weapon damage/CB/resistances/Meditation aura, and auto-summons from `.d2s` `kf` on room re-entry', () => {
      const room1 = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 178702,
        difficulty: 2,
        act: 0,
        areaId: 2,
      })
      const nec1 = room1.connectPlayer({
        name: 'InsightGolemNec',
        charClass: 'nec',
        level: 75,
        mana: 400,
        maxMana: 400,
        skills: { 90: 12, 79: 5, 94: 5 }, // Iron Golem 12, Golem Mastery 5, Fire Golem 5 (+30% dmg synergy)
        areaId: 2,
        x: 60,
        y: 60,
      })
      const necRec1 = getInternalPlayers(room1).get(nec1)!
      necRec1.rightSkill = 90

      const insightStats = [
        { statId: 151, param: 120, value: 16 }, // Level 16 Meditation Aura when Equipped
        { statId: 17, param: 0, value: 220 },   // +220% Enhanced Damage
        { statId: 18, param: 0, value: 220 },
        { statId: 136, param: 0, value: 35 },   // 35% Crushing Blow
        { statId: 78, param: 0, value: 25 },    // Attacker Takes Damage of 25
        { statId: 39, param: 0, value: 85 },    // +85% Fire Resist
        { statId: 41, param: 0, value: 85 },    // +85% Light Resist (`50 + 85 >= 100` immune)
      ]
      const insightStatsMap = new Map<number, number>([
        [151, 16],
        [17, 220],
        [18, 220],
        [136, 35],
        [78, 25],
        [39, 85],
        [41, 85],
      ])
      const groundMap1 = getInternalGroundItems(room1)
      groundMap1.set(
        9401,
        makeServerItem({
          unitId: 9401,
          code: 'vou', // Voulge (metal polearm: base 6..21 -> with +220% ED = 19..67)
          name: 'Insight Voulge',
          quality: 2,
          location: 'ground',
          areaId: 2,
          x: 62,
          y: 61,
          width: 2,
          height: 4,
          statsMap: insightStatsMap,
          rawStats: insightStats,
        }),
      )
      room1.drainEvents(nec1)

      // Cast Iron Golem via D2GS-decoded `SkillOn` targeting ground item 9401
      room1.enqueueCommand(nec1, {
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 4, id: 9401 },
        shift: false,
        hold: false,
      })
      room1.stepFrames(2)

      // Ground item consumed & UnitRemove(unitType: 4) broadcast
      expect(groundMap1.has(9401)).toBe(false)
      const castEvents = room1.drainEvents(nec1)
      expect(
        castEvents.some(
          (ev) => ev.type === 'UnitRemove' && ev.unitType === 4 && ev.id === 9401,
        ),
      ).toBe(true)

      const pets1 = room1.getPetsForOwner(nec1)
      expect(pets1.length).toBe(1)
      const ig1 = pets1[0]!
      expect(ig1.sourceSkillId).toBe(90)
      expect(ig1.inheritedAuras).toEqual([120])
      expect(ig1.statList.getAccruedStat('maxdamage')).toBeGreaterThan(80)
      expect(ig1.statList.getAccruedStat('item_crushingblow')).toBe(35)
      expect(ig1.statList.getAccruedStat('lightresist')).toBeGreaterThanOrEqual(100)
      // Necromancer receives STATE_MEDITATION (state 48) from the Iron Golem's Insight aura!
      expect(necRec1.states.has(48)).toBe(true)

      // Save `.d2s` and verify `kf` section carries the Voulge with stat 151 (Meditation)
      const savedGolemD2s = room1.exportPlayerD2s(nec1)
      const parsedKf = readD2sSave113c(savedGolemD2s)
      expect(parsedKf.ironGolem).not.toBeNull()
      expect(parsedKf.ironGolem!.code.trim()).toBe('vou')
      expect(
        parsedKf.ironGolem!.stats.some((s) => s.statId === 151 && s.param === 120),
      ).toBe(true)

      // Re-enter a brand-new room with `savedGolemD2s`: Iron Golem auto-summons with full inherited stats & aura!
      const room2 = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 178703,
        difficulty: 2,
        act: 0,
        areaId: 2,
      })
      const nec2 = room2.connectPlayer({ d2sBytes: savedGolemD2s, areaId: 2, x: 60, y: 60 })
      room2.stepFrames(2)

      const pets2 = room2.getPetsForOwner(nec2)
      expect(pets2.length).toBe(1)
      const ig2 = pets2[0]!
      expect(ig2.sourceSkillId).toBe(90)
      expect(ig2.inheritedAuras).toEqual([120])
      expect(ig2.statList.getAccruedStat('maxdamage')).toBeGreaterThan(80)
      expect(ig2.statList.getAccruedStat('item_crushingblow')).toBe(35)
      expect(getInternalPlayers(room2).get(nec2)!.states.has(48)).toBe(true)
    })

    it('clears `.d2s` `kf` (`hasGolem = 0`) when Iron Golem dies in combat, is replaced by Clay Golem (#75), or when the Necromancer dies', () => {
      const createNecWithSavedIronGolem = (seed: number): Uint8Array => {
        const setup = new GameInstance({
          policy: SINGLE_PLAYER_POLICY,
          seed,
          difficulty: 0,
          act: 0,
          areaId: 2,
        })
        const pid = setup.connectPlayer({
          name: `KfClearNec${seed}`,
          charClass: 'nec',
          level: 35,
          mana: 300,
          maxMana: 300,
          skills: { 75: 5, 90: 5 },
          areaId: 2,
          x: 50,
          y: 50,
        })
        getInternalGroundItems(setup).set(
          9500,
          makeServerItem({
            unitId: 9500,
            code: 'bsd',
            location: 'ground',
            areaId: 2,
            x: 51,
            y: 50,
            width: 2,
            height: 3,
          }),
        )
        setup.summonPet(pid, { skillId: 90, slvl: 5, ironGolemItemId: 9500 })
        return setup.exportPlayerD2s(pid)
      }

      const baseD2s = createNecWithSavedIronGolem(178710)
      expect(readD2sSave113c(baseD2s).ironGolem).not.toBeNull()

      // (a) Combat death: lethal monster kills Iron Golem -> kf becomes null (`[0x6b, 0x66, 0x00]`)
      {
        const gA = new GameInstance({
          policy: SINGLE_PLAYER_POLICY,
          seed: 178711,
          difficulty: 0,
          act: 0,
          areaId: 2,
        })
        const necA = gA.connectPlayer({ d2sBytes: baseD2s, areaId: 2, x: 50, y: 50 })
        const igPet = gA.getPetsForOwner(necA)[0]!
        expect(igPet).toBeDefined()
        igPet.hp = 1
        igPet.statList.setHp256(FIXED_ONE)

        gA.spawnMonster({
          defId: 'zombie1',
          name: 'GolemSlayer',
          level: 60,
          areaId: 2,
          x: igPet.x + 1,
          y: igPet.y,
          hp: 5000,
          minDmg: 9999,
          maxDmg: 9999,
          ar: 99999,
          ac: 0,
        })
        // Move Necromancer out of melee reach so zombie strikes the adjacent Iron Golem
        gA.movePlayer(necA, 75, 75)
        for (let i = 0; i < 40 && gA.getPetsForOwner(necA).length > 0; i++) {
          gA.stepFrame()
        }
        expect(gA.getPetsForOwner(necA).length).toBe(0)
        const d2sAfterGolemDeath = gA.exportPlayerD2s(necA)
        expect(readD2sSave113c(d2sAfterGolemDeath).ironGolem).toBeNull()
        expect(Array.from(d2sAfterGolemDeath.slice(-3))).toEqual([0x6b, 0x66, 0x00])
      }

      // (b) Replacement by Clay Golem (#75) -> kf becomes null
      {
        const gB = new GameInstance({
          policy: SINGLE_PLAYER_POLICY,
          seed: 178712,
          difficulty: 0,
          act: 0,
          areaId: 2,
        })
        const necB = gB.connectPlayer({ d2sBytes: baseD2s, areaId: 2, x: 50, y: 50 })
        expect(gB.getPetsForOwner(necB)[0]?.sourceSkillId).toBe(90)

        gB.enqueueCommand(necB, {
          type: 'CastSkillAtLocation',
          skillId: 75,
          x: 52,
          y: 52,
        })
        gB.stepFrames(2)
        expect(gB.getPetsForOwner(necB)[0]?.sourceSkillId).toBe(75)
        expect(readD2sSave113c(gB.exportPlayerD2s(necB)).ironGolem).toBeNull()
      }

      // (c) Necromancer dies -> Iron Golem despawns and kf becomes null
      {
        const gC = new GameInstance({
          policy: SINGLE_PLAYER_POLICY,
          seed: 178713,
          difficulty: 0,
          act: 0,
          areaId: 2,
        })
        const necC = gC.connectPlayer({ d2sBytes: baseD2s, areaId: 2, x: 50, y: 50 })
        expect(gC.getPetsForOwner(necC).length).toBe(1)

        gC.applyDamageToPlayer(necC, 99999, { killerType: 'monster' })
        expect(gC.getPlayerState(necC)!.dead).toBe(true)
        expect(gC.getPetsForOwner(necC).length).toBe(0)
        expect(readD2sSave113c(gC.exportPlayerD2s(necC)).ironGolem).toBeNull()
      }
    })
  })

  // ============================================================================
  // #1842: Diablo Clone (#333) World Event & Guaranteed Annihilus (#381) Drop
  // ============================================================================
  describe('#1842: Diablo Clone (#333) World Event Trigger, SuperUnique Replacement & Annihilus (#381) Drop', () => {
    function makeStoneOfJordanEntry(unitId: number, ownerId: number) {
      return makeServerItem({
        unitId,
        code: 'rin',
        name: 'The Stone of Jordan',
        quality: 7,
        level: 50,
        location: 'inventory',
        ownerId,
        uniqueItemId: 122,
        cost: 5000,
      })
    }

    it('increments SoJ counter without triggering World Event in Normal/Nightmare and excludes SoJ from vendor buyback', () => {
      for (const difficulty of [0, 1] as const) {
        const game = new GameInstance({
          policy: SINGLE_PLAYER_POLICY,
          seed: 184201 + difficulty,
          difficulty,
          act: 0,
          areaId: 1,
        })
        const p1 = game.connectPlayer({
          name: `SojSeller${difficulty}`,
          charClass: 'sor',
          level: 60,
          areaId: 1,
          x: 50,
          y: 50,
        })
        const akaraId = game.spawnMonster({
          classId: 148,
          defId: 'akara',
          name: 'Akara',
          isNpc: true,
          areaId: 1,
          x: 52,
          y: 50,
        })
        const pRec = getInternalPlayers(game).get(p1)!
        pRec.activeNpcId = akaraId
        pRec.activeVendorMode = 'trade'
        pRec.items.push(makeStoneOfJordanEntry(9600 + difficulty, p1))
        game.drainEvents(p1)

        game.enqueueCommand(p1, {
          type: 'NpcSell',
          npcId: akaraId,
          itemId: 9600 + difficulty,
        })
        game.stepFrame()

        expect(game.getSojSoldCount()).toBe(1)
        expect(game.isWorldEventTriggered()).toBe(false)
        const events = game.drainEvents(p1)
        expect(
          events.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 0x11 && ev.arg === 1),
        ).toBe(true)
        expect(
          events.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 0x12),
        ).toBe(false)
        // SoJ must never enter vendor buyback stock
        expect(
          events.some((ev) => ev.type === 'ItemEvent' && ev.action === 'vendorPool' && ev.itemId === 9600 + difficulty),
        ).toBe(false)
      }
    })

    it('triggers "Diablo Walks the Earth" in Hell at threshold, replaces ONLY the first eligible SuperUnique with #333 diabloclone, skips Ancients/Baal waves, and drops Annihilus (#381)', () => {
      const game = new GameInstance({
        seed: 184210,
        difficulty: 2, // Hell
        act: 0,
        areaId: 1,
        maxPlayers: 4,
        worldEventSojThreshold: 2,
      })
      const p1 = game.connectPlayer({
        name: 'HellSeller',
        charClass: 'pal',
        level: 88,
        areaId: 1,
        x: 50,
        y: 50,
      })
      const p2 = game.connectPlayer({
        name: 'HellObserver',
        charClass: 'ama',
        level: 85,
        areaId: 4, // Stony Field
        x: 100,
        y: 100,
      })
      const akaraId = game.spawnMonster({
        classId: 148,
        defId: 'akara',
        name: 'Akara',
        isNpc: true,
        areaId: 1,
        x: 52,
        y: 50,
      })
      const p1Rec = getInternalPlayers(game).get(p1)!
      p1Rec.activeNpcId = akaraId
      p1Rec.activeVendorMode = 'trade'
      p1Rec.items.push(makeStoneOfJordanEntry(9701, p1), makeStoneOfJordanEntry(9702, p1))
      game.drainEvents(p1)
      game.drainEvents(p2)

      // 1st SoJ (below threshold 2): broadcasts 0x11 (arg=1), does NOT walk yet
      game.enqueueCommand(p1, { type: 'NpcSell', npcId: akaraId, itemId: 9701 })
      game.stepFrame()
      expect(game.getSojSoldCount()).toBe(1)
      expect(game.isWorldEventTriggered()).toBe(false)
      game.drainEvents(p1)
      game.drainEvents(p2)

      // 2nd SoJ (reaches threshold 2): broadcasts 0x11 (arg=2) AND 0x12 ("Diablo Walks the Earth") to ALL players!
      game.enqueueCommand(p1, { type: 'NpcSell', npcId: akaraId, itemId: 9702 })
      game.stepFrame()
      expect(game.getSojSoldCount()).toBe(2)
      expect(game.isWorldEventTriggered()).toBe(true)
      expect(game.isDiabloCloneSpawned()).toBe(false)

      for (const pid of [p1, p2]) {
        const evs = game.drainEvents(pid)
        expect(
          evs.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 0x11 && ev.arg === 2),
        ).toBe(true)
        expect(
          evs.some((ev) => ev.type === 'Chat' && ev.kind === 'event' && ev.eventType === 0x12),
        ).toBe(true)
      }

      // Scripted non-replaceable quest bosses (Ancients 43..45, Baal waves 61..65) must NOT consume DClone!
      const ancientIds = game.spawnSuperUnique({
        superUniqueIndex: 43, // Talic
        areaId: 120,
        x: 40,
        y: 40,
      })
      expect(game.isDiabloCloneSpawned()).toBe(false)
      expect(getInternalMonsters(game).get(ancientIds[0]!)!.hcIdx).not.toBe(333)

      // First eligible SuperUnique (Rakanishu, SuperUniques.txt #2 in Stony Field area 4) -> replaced by #333 diabloclone!
      const dclonePackIds = game.spawnSuperUnique({
        superUniqueIndex: 2,
        areaId: 4,
        x: 105,
        y: 100,
      })
      expect(dclonePackIds.length).toBe(1)
      expect(game.isDiabloCloneSpawned()).toBe(true)

      const dcloneId = dclonePackIds[0]!
      const dclone = getInternalMonsters(game).get(dcloneId)!
      expect(dclone.hcIdx).toBe(333)
      expect(dclone.defId).toBe('diabloclone')
      expect(dclone.level).toBe(110)
      expect(dclone.isBoss).toBe(true)
      expect(dclone.isPrimeEvil).toBe(true)
      expect(dclone.resistances).toEqual({
        phys: 50,
        magic: 50,
        fire: 95,
        light: 95,
        cold: 95,
        poison: 95,
      })

      const p2SpawnEvs = game.drainEvents(p2)
      expect(
        p2SpawnEvs.some((ev) => ev.type === 'MonsterSpecial' && ev.classId === 333),
      ).toBe(true)

      // Second eligible SuperUnique (Treehead WoodFist #3 in Dark Wood area 5) -> spawns normally (1 DClone max per game)
      const secondPackIds = game.spawnSuperUnique({
        superUniqueIndex: 3,
        areaId: 5,
        x: 80,
        y: 80,
      })
      expect(getInternalMonsters(game).get(secondPackIds[0]!)!.hcIdx).not.toBe(333)

      // Move p1 to Stony Field and slay #333 diabloclone -> guaranteed Unique #381 Annihilus ('cm1')!
      p1Rec.areaId = 4
      game.movePlayer(p1, 104, 100)
      dclone.hp = 10
      game.applyDamageToMonster(dcloneId, 50000, p1)
      expect(dclone.dead).toBe(true)

      // Advance past the 1.13c Diablo death-animation drop frame (`pendingDropFrame`)
      expect(dclone.pendingDropItems?.length).toBe(1)
      game.stepFrames(Math.max(1, dclone.pendingDropFrame - game.frame + 2))

      const groundItems = [...getInternalGroundItems(game).values()].filter(
        (g) => g.areaId === 4,
      )
      const anni = groundItems.find(
        (g) => g.code.trim() === 'cm1' && g.rawItemData?.uniqueItemId === 381,
      )
      expect(anni).toBeDefined()
      expect(anni!.quality).toBe(7)
      expect(anni!.level).toBe(110)

      const anniStats = new Map<number, number>(
        (anni!.rawItemData.stats as readonly { statId: number; value: number }[]).map((s) => [
          s.statId,
          s.value,
        ]),
      )
      expect(anniStats.get(127)).toBe(1) // +1 to All Skills
      for (const attrStat of [0, 1, 2, 3]) {
        const val = anniStats.get(attrStat) ?? 0
        expect(val).toBeGreaterThanOrEqual(10)
        expect(val).toBeLessThanOrEqual(20)
      }
      for (const resStat of [39, 41, 43, 45]) {
        const val = anniStats.get(resStat) ?? 0
        expect(val).toBeGreaterThanOrEqual(10)
        expect(val).toBeLessThanOrEqual(20)
      }
      const expGain = anniStats.get(85) ?? 0
      expect(expGain).toBeGreaterThanOrEqual(5)
      expect(expGain).toBeLessThanOrEqual(10)
    })

    it('upgrades a seam-preloaded unvisited SuperUnique pack (e.g. Bloody Foothills Shenk) to #333 diabloclone upon first room reveal', () => {
      const game = new GameInstance({
        policy: SINGLE_PLAYER_POLICY,
        seed: 184220,
        difficulty: 2,
        act: 4,
        areaId: 109, // Harrogath
      })
      // Install a room rect in Bloody Foothills (area 110) that was seam-preloaded before SoJ sale
      game.setAreaRoomProvider((areaId) =>
        areaId === 110
          ? [{ index: 0, x: 200, y: 200, w: 40, h: 40, seed: 0x1234 }]
          : null,
      )
      game.setTerrainWalkableCheck(() => true)

      const p1 = game.connectPlayer({
        name: 'HarrogathHero',
        charClass: 'bar',
        level: 85,
        areaId: 109,
        x: 50,
        y: 50,
      })
      // Simulate seam preload spawning Shenk the Overseer (SuperUniques.txt #36) in unvisited room 0 of area 110
      const shenkPackIds = game.spawnSuperUnique({
        superUniqueIndex: 36,
        areaId: 110,
        x: 215,
        y: 215,
      })
      expect(shenkPackIds.length).toBeGreaterThan(0)
      expect(getInternalMonsters(game).get(shenkPackIds[0]!)!.hcIdx).not.toBe(333)

      // Sell 1 SoJ to Malah in Harrogath (default threshold = 1)
      const malahId = game.spawnMonster({
        classId: 513,
        defId: 'malah',
        name: 'Malah',
        isNpc: true,
        areaId: 109,
        x: 52,
        y: 50,
      })
      const pRec = getInternalPlayers(game).get(p1)!
      pRec.activeNpcId = malahId
      pRec.activeVendorMode = 'trade'
      pRec.items.push(makeStoneOfJordanEntry(9801, p1))
      game.enqueueCommand(p1, { type: 'NpcSell', npcId: malahId, itemId: 9801 })
      game.stepFrame()
      expect(game.isWorldEventTriggered()).toBe(true)
      expect(game.isDiabloCloneSpawned()).toBe(false)

      // Walk out into Bloody Foothills (area 110): the seam-preloaded room is revealed for the first time
      // (`revealAreaRoomsNearPlayer`) -> preloaded untouched Shenk pack is upgraded to #333!
      const internal = game as unknown as {
        loadedAreas: Map<number, unknown>
        revealAreaRoomsNearPlayer(player: unknown, emitRoomUnits?: boolean): void
      }
      internal.loadedAreas.set(110, {
        areaId: 110,
        spawnX: 210,
        spawnY: 210,
        rooms: [{ areaId: 110, tileX: 40, tileY: 40 }],
        roomRects: [{ index: 0, x: 200, y: 200, w: 40, h: 40, seed: 0x1234 }],
        adjacentAreaIds: [109],
        isWalkable: () => true,
      })
      pRec.areaId = 110
      game.movePlayer(p1, 210, 210)
      internal.revealAreaRoomsNearPlayer(pRec, false)

      expect(game.isDiabloCloneSpawned()).toBe(true)
      for (const oldId of shenkPackIds) {
        expect(getInternalMonsters(game).has(oldId)).toBe(false)
      }
      const area110Monsters = [...getInternalMonsters(game).values()].filter(
        (m) => m.areaId === 110 && !m.dead,
      )
      expect(area110Monsters.some((m) => m.hcIdx === 333 && m.defId === 'diabloclone')).toBe(true)
    })
  })
})
