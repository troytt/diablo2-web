/**
 * Wave 1 World Objects, Containers, Portals, ObjGrp & A5Q5 Quest P0 Suite
 * (#1832, #1833, #1834, #1835, #1836, #1837, #1838, #1839, #1840, #1843).
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { isMetalItemCode113c } from '../../src/common/items/metal-items-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { getExperienceForLevel } from '../../src/common/skills/formulas.ts'
import { getLevelMonsterLevel113c } from '../../src/common/world/levels-monlvl-113c.ts'
import {
  classifyObjectOperate113c,
  computeChestLockChancePct113c,
  getContainerOperateDropChance113c,
  INIT_FN_3_LOCKABLE_CLASS_IDS_113C,
  QUEST_CHEST_OPERATE_FNS_113C,
  rollChestLocked113c,
  SPARKLY_CHEST_INIT57_CLASS_IDS_113C,
} from '../../src/common/world/object-operate-113c.ts'
import { OBJECTS_LOCKABLE_113C, OBJECTS_TXT_113C } from '../../src/common/world/objects-txt-113c.ts'
import type { LocalAreaLevelGeometry } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  buildAreaBootstrap,
  resolvePresetObject113c,
  resolvePresetPortalDestArea113c,
} from '../../src/server/world/area-bootstrap.ts'
import {
  LEVEL_OBJGRP_113C,
  OBJECT_INIT_FN_113C,
  OBJECT_POPULATE_FN_113C,
  OBJGROUP_TXT_113C,
} from '../../src/server/world/objgroup-data-113c.ts'
import {
  populateAreaObjGroups113c,
  SHRINE_MIN_SPACING_SUBTILES_113C,
} from '../../src/server/world/objgroup-113c.ts'
import {
  planEvilUrnPack113c,
  rollArmorStandDrop113c,
  rollBookshelfDrop113c,
  rollQuestChestBonusDrops113c,
  rollWeaponRackDrop113c,
  rollWirtsBodyDrops113c,
} from '../../src/server/world/object-drops-113c.ts'

function makeTestMercenary(unitId: number, ownerPlayerId: number, areaId: number, x: number, y: number) {
  return {
    unitId,
    ownerPlayerId,
    act: 1 as const,
    subType: 0,
    classId: 271,
    level: 20,
    difficulty: 1 as const,
    name: 'KashyaScout',
    areaId,
    x,
    y,
    hp: 250,
    maxHp: 250,
    damage: 15,
    defense: 60,
    resist: 25,
    reach: 2,
    aggroRadius: 10,
    speed: 6,
    cooldown: 15,
    cooldownTicks: 0,
    activeAura: undefined,
    state: 'idle' as const,
    alive: true,
    experience: 0,
    expPerLvl: 100,
    equipment: [],
    states: new Set<number>(),
    stateTimers: new Map<number, number>(),
  }
}

function makeInventoryItem(unitId: number, code: string, ownerId: number, quantity = 1) {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 1,
    location: 'inventory',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId: 1,
    ownerId,
    bodyLoc: 0,
    storePage: 1,
    cost: 0,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 0,
    maxDurability: 0,
    quantity,
    stats: new Map(),
    socketedItems: [],
  }
}

function makeOpenRoomLevel(areaId: number, roomCount = 8, roomSize = 40): LocalAreaLevelGeometry {
  const cols = 4
  const rows = Math.ceil(roomCount / cols)
  const subWidth = cols * roomSize
  const subHeight = rows * roomSize
  const blocked = new Uint8Array(subWidth * subHeight)
  const roomRects = Array.from({ length: roomCount }, (_, idx) => {
    const cx = idx % cols
    const cy = Math.floor(idx / cols)
    return {
      index: idx,
      x: 1000 + cx * roomSize,
      y: 1000 + cy * roomSize,
      w: roomSize,
      h: roomSize,
      seed: 0x1000 + areaId * 97 + idx * 31,
    }
  })
  return {
    areaId,
    originX: 1000,
    originY: 1000,
    subWidth,
    subHeight,
    blocked,
    spawnTileX: 4,
    spawnTileY: 4,
    rooms: roomRects.map((r) => ({ areaId, tileX: Math.floor(r.x / 5), tileY: Math.floor(r.y / 5) })),
    roomRects,
    adjacentAreaIds: [],
    presetUnits: [],
    warps: [],
  }
}

describe('#1832 Objects.txt Lockable chests (InitFn 3 probability + OperateFn 4 key / Assassin bypass)', () => {
  it('computes exact D2Game OBJECTS_Init03_Chest lock chance (floor(areaLvl / 2) + 8, capped at 100)', () => {
    expect(computeChestLockChancePct113c(1)).toBe(8)
    expect(computeChestLockChancePct113c(2)).toBe(9)
    expect(computeChestLockChancePct113c(50)).toBe(33)
    expect(computeChestLockChancePct113c(85)).toBe(50)
    expect(computeChestLockChancePct113c(200)).toBe(100)

    // Verify exact 43 InitFn === 3 && Lockable === 1 rows against OBJECTS_LOCKABLE_113C + OBJECT_INIT_FN_113C
    const expectedSet = new Set<number>()
    for (const cid of OBJECTS_LOCKABLE_113C) {
      if (OBJECT_INIT_FN_113C[cid] === 3) expectedSet.add(cid)
    }
    expect(INIT_FN_3_LOCKABLE_CLASS_IDS_113C).toEqual(expectedSet)
    expect(INIT_FN_3_LOCKABLE_CLASS_IDS_113C.size).toBe(43)

    // Empirical roll distribution at areaLvl 1 (~8%) and areaLvl 85 (~50%)
    const rng = new D2Rng(0x1832)
    let lockedLvl1 = 0
    let lockedLvl85 = 0
    for (let i = 0; i < 1000; i++) {
      if (rollChestLocked113c(5, 1, rng)) lockedLvl1++
      if (rollChestLocked113c(5, 85, rng)) lockedLvl85++
    }
    expect(lockedLvl1).toBeGreaterThanOrEqual(50)
    expect(lockedLvl1).toBeLessThanOrEqual(120)
    expect(lockedLvl85).toBeGreaterThanOrEqual(440)
    expect(lockedLvl85).toBeLessThanOrEqual(560)
  })

  it('never locks quest chests, Sparkly/Special chests, or Hellgate, and enforces key / Assassin bypass + 2x Chest TC on OperateFn 4', () => {
    const rng = new D2Rng(99)
    for (const neverLockId of [342, 354, 355, 356, 397, 405, 406, 407, 455]) {
      for (let i = 0; i < 50; i++) {
        expect(rollChestLocked113c(neverLockId, 85, rng)).toBe(false)
      }
    }

    const game = new GameInstance({ seed: 18320, areaId: 2, maxPlayers: 8 })
    const sorId = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 20, y: 20, areaId: 2 })
    const assId = game.connectPlayer({ charClass: 'ass', name: 'Sin', x: 21, y: 20, areaId: 2 })
    const internal = game as unknown as {
      players: Map<number, { items: any[] }>
      objects: Map<number, { mode: number; isLocked: boolean }>
      groundItems: Map<number, { code: string }>
    }

    // Quest chest spawned even with isLocked: true must force isLocked = false and open without a key
    const questChestId = game.spawnObject({ classId: 354, x: 21, y: 19, areaId: 2, isLocked: true })
    expect(internal.objects.get(questChestId)!.isLocked).toBe(false)
    game.enqueueCommand(sorId, { type: 'OperateObject', objectId: questChestId })
    game.stepFrames(1)
    expect(internal.objects.get(questChestId)!.mode).toBe(2)

    // Locked OperateFn 4 chest blocks non-Assassin without key (sound 22 + 'Locked', stays mode 0)
    const locked1 = game.spawnObject({ classId: 5, x: 20, y: 21, areaId: 2, isLocked: true })
    game.drainEvents(sorId)
    game.enqueueCommand(sorId, { type: 'OperateObject', objectId: locked1 })
    game.stepFrames(1)
    expect(internal.objects.get(locked1)!.mode).toBe(0)
    expect(internal.objects.get(locked1)!.isLocked).toBe(true)
    const blockedEvents = game.drainEvents(sorId)
    expect(blockedEvents.some((e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 22)).toBe(true)
    expect(blockedEvents.some((e) => e.type === 'Chat' && (e as { text?: string }).text === 'Locked')).toBe(true)

    // Non-Assassin with a key stack (quantity 2) consumes 1 key, plays sound 11, clears isLocked, and opens
    const sor = internal.players.get(sorId)!
    sor.items.push(makeInventoryItem(9100, 'key', sorId, 2))
    const groundBeforeUnlock = internal.groundItems.size
    game.drainEvents(sorId)
    game.enqueueCommand(sorId, { type: 'OperateObject', objectId: locked1 })
    game.stepFrames(1)
    expect(internal.objects.get(locked1)!.mode).toBe(2)
    expect(internal.objects.get(locked1)!.isLocked).toBe(false)
    expect(sor.items.find((it) => it.unitId === 9100)?.quantity).toBe(1)
    expect(internal.groundItems.size).toBeGreaterThan(groundBeforeUnlock)
    const unlockEvents = game.drainEvents(sorId)
    expect(unlockEvents.some((e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 11)).toBe(true)

    // Assassin opens a locked chest WITHOUT any keys in inventory!
    const locked2 = game.spawnObject({ classId: 5, x: 21, y: 21, areaId: 2, isLocked: true })
    expect(internal.players.get(assId)!.items.some((it) => it.code.trim() === 'key')).toBe(false)
    game.enqueueCommand(assId, { type: 'OperateObject', objectId: locked2 })
    game.stepFrames(1)
    expect(internal.objects.get(locked2)!.mode).toBe(2)
    expect(internal.objects.get(locked2)!.isLocked).toBe(false)
  })
})

describe('#1833 Sparkly Chest (397 & SpecialChest 455) and Act 2/3 Quest Chest drops', () => {
  it('marks both 397 (SparklyChest) and 455 (SpecialChest) as sparkling and never marks 407 (KhalimChest3) as sparkling', () => {
    expect([...SPARKLY_CHEST_INIT57_CLASS_IDS_113C].sort((a, b) => a - b)).toEqual([397, 455])
    expect(resolvePresetObject113c(397, 2)?.isSparkling).toBe(true)
    expect(resolvePresetObject113c(455, 115)?.isSparkling).toBe(true)
    expect(Boolean(resolvePresetObject113c(407, 85)?.isSparkling)).toBe(false)

    const game = new GameInstance({ seed: 18330, areaId: 115, difficulty: 1 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Barb', x: 20, y: 20, areaId: 115, level: 50 })
    const internal = game as unknown as {
      objects: Map<number, { isSparkling: boolean; isLocked: boolean; mode: number }>
      groundItems: Map<number, { code: string; quality: number }>
    }

    const sp455 = game.spawnObject({ classId: 455, x: 22, y: 20, areaId: 115 })
    expect(internal.objects.get(sp455)!.isSparkling).toBe(true)
    expect(internal.objects.get(sp455)!.isLocked).toBe(false)

    game.enqueueCommand(pid, { type: 'OperateObject', objectId: sp455 })
    game.stepFrames(1)
    expect(internal.objects.get(sp455)!.mode).toBe(2)
    const sparklyDrops = [...internal.groundItems.values()]
    expect(sparklyDrops.length).toBeGreaterThanOrEqual(2)
    expect(sparklyDrops.some((d) => d.quality >= 4 || d.code.trim() === 'gld')).toBe(true)
  })

  it('erupts quest item + 5..9 gold piles + forced-Magic equipment on Act 2/3 quest chests (354..356, 405..407)', () => {
    expect([...QUEST_CHEST_OPERATE_FNS_113C].sort((a, b) => a - b)).toEqual([24, 39, 40, 41, 57, 58, 59])

    const rng = new D2Rng(0x1833)
    const bonus = rollQuestChestBonusDrops113c({
      areaId: 85,
      difficulty: 0,
      gamePlayers: 1,
      partyPlayers: 1,
      playerMf: 0,
      playerGf: 0,
      rng,
    })
    const goldPiles = bonus.filter((it) => it.base.id.trim() === 'gld')
    const magicItems = bonus.filter((it) => it.base.id.trim() !== 'gld')
    expect(goldPiles.length).toBeGreaterThanOrEqual(5)
    expect(goldPiles.length).toBeLessThanOrEqual(9)
    expect(magicItems.length).toBeGreaterThanOrEqual(1)
    expect(magicItems[0]!.quality).not.toBe('normal')

    // Full GameInstance verification on 407 Khalim's Chest 3 (OperateFn 58)
    const game = new GameInstance({ seed: 18331, areaId: 85 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Pal', x: 20, y: 20, areaId: 85 })
    const internal = game as unknown as {
      objects: Map<number, { isSparkling: boolean }>
      groundItems: Map<number, { code: string; quality: number }>
    }
    const khalimChest = game.spawnObject({ classId: 407, x: 22, y: 20, areaId: 85 })
    expect(internal.objects.get(khalimChest)!.isSparkling).toBe(false)
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: khalimChest })
    game.stepFrames(1)
    const allGround = [...internal.groundItems.values()]
    expect(allGround.some((it) => it.code.trim().toLowerCase() === 'qey')).toBe(true)
    expect(allGround.filter((it) => it.code.trim().toLowerCase() === 'gld').length).toBeGreaterThanOrEqual(5)
    expect(
      allGround.some(
        (it) => it.code.trim().toLowerCase() !== 'qey' && it.code.trim().toLowerCase() !== 'gld' && it.quality >= 4,
      ),
    ).toBe(true)
  })
})

describe('#1834 OperateFn 0..73 sweep & Act 3 Jungle Stash / Hollow Log (185..188, OperateFn 51)', () => {
  it('maps ONLY classId 267 (OperateFn 32) to stash UI across all 573 Objects.txt rows', () => {
    const stashRows: number[] = []
    for (let classId = 0; classId < OBJECTS_TXT_113C.length; classId++) {
      if (classifyObjectOperate113c(classId) === 'stash') {
        stashRows.push(classId)
      }
    }
    expect(stashRows).toEqual([267])

    for (const jungleId of [185, 186, 187, 188]) {
      expect(OBJECTS_TXT_113C[jungleId]!.operateFn).toBe(51)
      expect(classifyObjectOperate113c(jungleId)).toBe('container')
    }
    expect(getContainerOperateDropChance113c(51)).toBe(75)
  })

  it('operates 185..188 as one-shot 75% treasure containers and NEVER emits Trade action 0x10', () => {
    const game = new GameInstance({ seed: 18340, areaId: 78, playersX: 8 })
    const pid = game.connectPlayer({ charClass: 'ama', name: 'Zon', x: 30, y: 30, areaId: 78 })
    const internal = game as unknown as {
      objects: Map<number, { mode: number }>
      groundItems: Map<number, { code: string }>
    }

    let dropsTriggered = 0
    for (let i = 0; i < 40; i++) {
      const cid = 185 + (i % 4)
      const oid = game.spawnObject({ classId: cid, x: 31, y: 30, areaId: 78 })
      const beforeGround = internal.groundItems.size
      game.drainEvents(pid)
      game.enqueueCommand(pid, { type: 'OperateObject', objectId: oid })
      game.stepFrames(1)
      const events = game.drainEvents(pid)
      expect(events.some((e) => e.type === 'Trade')).toBe(false)
      expect(internal.objects.get(oid)!.mode).toBe(2)
      if (internal.groundItems.size > beforeGround) dropsTriggered++
    }
    expect(dropsTriggered).toBeGreaterThanOrEqual(18)
    expect(dropsTriggered).toBeLessThanOrEqual(38)
  })
})

describe('#1835 Act 2 progression objects: Arcane Portal (298), Telepads (192, 304..306), Horazon Journal (357)', () => {
  it('activates Arcane Sanctuary Portal 298 (54 -> 74) and relocates mercenary with player', () => {
    expect(resolvePresetPortalDestArea113c(298, 54)).toBe(74)
    expect(resolvePresetPortalDestArea113c(298, 74)).toBe(54)

    const game = new GameInstance({ seed: 18350, areaId: 54 })
    const pid = game.connectPlayer({ charClass: 'nec', name: 'Nec', x: 20, y: 20, areaId: 54 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number; questFlags: Uint16Array }>
      objects: Map<number, { mode: number; destAreaId?: number }>
      mercenaries: Map<number, { ownerId: number; areaId: number; x: number; y: number }>
      hireMercenary?: unknown
    }
    const player = internal.players.get(pid)!
    player.questFlags[questWordIndex113c('a2q3')!]! |= QUEST_FLAG_STARTED_113C

    // Attach active mercenary to verify follower relocation across 298
    internal.mercenaries.set(8801, makeTestMercenary(8801, pid, 54, 19, 20) as never)

    const portal298 = game.spawnObject({ classId: 298, x: 21, y: 20, areaId: 54 })
    expect(internal.objects.get(portal298)!.destAreaId).toBe(74)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: portal298 } })
    game.stepFrames(1)

    expect(internal.objects.get(portal298)!.mode).toBe(2)
    expect(player.areaId).toBe(74)
    expect(internal.mercenaries.get(8801)!.areaId).toBe(74)
  })

  it('teleports player + merc repeatedly between paired Arcane Telepads (192, 304..306, Op 27)', () => {
    const game = new GameInstance({ seed: 18351, areaId: 74 })
    const pid = game.connectPlayer({ charClass: 'dru', name: 'Dru', x: 10, y: 10, areaId: 74 })
    const internal = game as unknown as {
      players: Map<number, { x: number; y: number }>
      mercenaries: Map<number, { x: number; y: number; areaId: number }>
    }
    internal.mercenaries.set(8802, makeTestMercenary(8802, pid, 74, 10, 10) as never)

    const padA = game.spawnObject({ classId: 304, x: 11, y: 10, areaId: 74 })
    const padB = game.spawnObject({ classId: 304, x: 80, y: 90, areaId: 74 })

    game.enqueueCommand(pid, { type: 'OperateObject', objectId: padA })
    game.stepFrames(1)
    expect(Math.hypot(internal.players.get(pid)!.x - 80, internal.players.get(pid)!.y - 90)).toBeLessThanOrEqual(6)
    expect(Math.hypot(internal.mercenaries.get(8802)!.x - 80, internal.mercenaries.get(8802)!.y - 90)).toBeLessThanOrEqual(6)

    // Advance past 500ms warp click cooldown (13 frames) and verify padB teleports back to padA!
    game.stepFrames(15)
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: padB })
    game.stepFrames(1)
    expect(Math.hypot(internal.players.get(pid)!.x - 11, internal.players.get(pid)!.y - 10)).toBeLessThanOrEqual(6)
  })

  it("operates Horazon's Journal (357, Op 42) with 0 item drops, completes a2q4, spawns Red Portal 60 -> 46, and warps to Canyon of the Magi (46)", () => {
    expect(classifyObjectOperate113c(357)).toBe('mode')

    const game = new GameInstance({ seed: 18352, areaId: 74 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 40, y: 40, areaId: 74 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number; questFlags: Uint16Array }>
      objects: Map<number, { unitId: number; classId: number; destAreaId?: number; mode: number }>
      groundItems: Map<number, unknown>
    }
    const player = internal.players.get(pid)!

    const journal = game.spawnObject({ classId: 357, x: 41, y: 40, areaId: 74 })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: journal })
    game.stepFrames(1)

    expect(internal.groundItems.size).toBe(0)
    expect(player.questFlags[questWordIndex113c('a2q4')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(player.questFlags[questWordIndex113c('a2q6')!]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)

    const redPortal = [...internal.objects.values()].find((o) => o.classId === 60 && o.destAreaId === 46)
    expect(redPortal).toBeDefined()
    expect(redPortal!.mode).toBe(2)

    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: redPortal!.unitId } })
    game.stepFrames(25)
    expect(player.areaId).toBe(46)
  })
})

describe('#1836 Act 3 Durance of Hate L3 Mephisto Hellgate (342, OperateFn 46 -> Area 103)', () => {
  it('rejects Hellgate before Mephisto dies, opens Hellgate on Mephisto death, unlocks Act 4 + WP 103, and warps player + merc to 103', () => {
    expect(classifyObjectOperate113c(342)).toBe('portal')
    expect(resolvePresetPortalDestArea113c(342, 102)).toBe(103)

    const game = new GameInstance({ seed: 18360, areaId: 102 })
    const pid = game.connectPlayer({ charClass: 'pal', name: 'Zeal', x: 30, y: 30, areaId: 102 })
    const internal = game as unknown as {
      players: Map<number, { areaId: number; unlockedAct: number; waypoints: Set<number> }>
      objects: Map<number, { mode: number; isLocked: boolean; destAreaId?: number }>
      mercenaries: Map<number, { areaId: number }>
    }
    const player = internal.players.get(pid)!
    player.unlockedAct = 2
    internal.mercenaries.set(8803, makeTestMercenary(8803, pid, 102, 29, 30) as never)

    const hellgate = game.spawnObject({ classId: 342, x: 31, y: 30, areaId: 102 })
    expect(internal.objects.get(hellgate)!.isLocked).toBe(false)
    expect(internal.objects.get(hellgate)!.mode).toBe(0)
    expect(internal.objects.get(hellgate)!.destAreaId).toBe(103)

    // Before Mephisto dies: PlaySound 19, stays in 102
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: hellgate } })
    game.stepFrames(1)
    expect(player.areaId).toBe(102)
    expect(
      game.drainEvents(pid).some((e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 19),
    ).toBe(true)

    // Kill Mephisto -> opens 342 to mode 2 and completes a3q6
    const meph = game.spawnMonster({ defId: 'mephisto', x: 32, y: 30, areaId: 102, hp: 50, maxHp: 50 })
    game.applyDamageToMonster(meph, 10_000, pid)
    expect(internal.objects.get(hellgate)!.mode).toBe(2)

    // Step through Hellgate -> unlocks Act 4 (unlockedAct >= 3), WP 103, CanGoToAct(4), warps player + merc to 103
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 2, id: hellgate } })
    game.stepFrames(1)
    const warpEvents = game.drainEvents(pid)
    expect(warpEvents.some((e) => e.type === 'CanGoToAct' && (e as { act?: number }).act === 4)).toBe(true)
    expect(player.unlockedAct).toBeGreaterThanOrEqual(3)
    expect(player.waypoints.has(103)).toBe(true)
    expect(player.areaId).toBe(103)
    expect(internal.mercenaries.get(8803)!.areaId).toBe(103)
  })
})

describe('#1837 Armor Stand (Op 19), Weapon Rack (Op 20), and Monastery Bookshelf (Op 26)', () => {
  it('rolls 100% Armor.txt base items with qlvl <= max(1, areaLvl - 1) on Armor Stands', () => {
    const tables = getEmbeddedDropTables()
    const rng = new D2Rng(0x1837a)
    const maxQlvl = Math.max(1, getLevelMonsterLevel113c(25, 0, true) - 1)
    for (let i = 0; i < 60; i++) {
      const drops = rollArmorStandDrop113c({ areaId: 25, difficulty: 0, playerMf: 0, rng })
      expect(drops).toHaveLength(1)
      const item = drops[0]!
      expect(tables.armor.get(item.base.id.trim())).toBeDefined()
      expect(item.base.level).toBeLessThanOrEqual(maxQlvl)
    }
  })

  it('rolls 100% metal Weapons.txt base items (never bows, wands, staves, orbs, or gold) on Weapon Racks', () => {
    const tables = getEmbeddedDropTables()
    const rng = new D2Rng(0x1837b)
    const maxQlvl = Math.max(1, getLevelMonsterLevel113c(79, 1, true) - 1)
    for (let i = 0; i < 80; i++) {
      const drops = rollWeaponRackDrop113c({ areaId: 79, difficulty: 1, playerMf: 0, rng })
      expect(drops).toHaveLength(1)
      const code = drops[0]!.base.id.trim()
      expect(tables.weapons.get(code)).toBeDefined()
      expect(isMetalItemCode113c(code)).toBe(true)
      expect(drops[0]!.base.level).toBeLessThanOrEqual(maxQlvl)
    }
  })

  it('rolls ~10% Tomes (tbk/ibk) and ~90% Scrolls (tsc/isc) on Monastery Bookshelves (179/180)', () => {
    const rng = new D2Rng(0x1837c)
    let tomes = 0
    let scrolls = 0
    for (let i = 0; i < 400; i++) {
      const drops = rollBookshelfDrop113c(28, 0, rng)
      expect(drops).toHaveLength(1)
      const code = drops[0]!.base.id.trim()
      if (code === 'tbk' || code === 'ibk') {
        tomes++
        expect(drops[0]!.quantity).toBeGreaterThanOrEqual(1)
        expect(drops[0]!.quantity).toBeLessThanOrEqual(5)
      } else if (code === 'tsc' || code === 'isc') {
        scrolls++
      } else {
        throw new Error(`Unexpected bookshelf drop code: ${code}`)
      }
    }
    expect(tomes).toBeGreaterThanOrEqual(20)
    expect(tomes).toBeLessThanOrEqual(65)
    expect(scrolls).toBe(400 - tomes)
  })
})

describe('#1838 Act 5 Evil Urn (466, OperateFn 68) elite ambush spawning', () => {
  it('plans ~80% Unique + minions and ~20% Champion packs from the Act 5 level monster pool and spawns them on operate', () => {
    const rng = new D2Rng(0x1838)
    let uniquePacks = 0
    let champPacks = 0
    for (let i = 0; i < 100; i++) {
      const pack = planEvilUrnPack113c(118, 1, rng)
      expect(pack.length).toBeGreaterThanOrEqual(2)
      if (pack[0]!.rank === 'unique') {
        uniquePacks++
        expect(pack.slice(1).every((m) => m.rank === 'minion')).toBe(true)
      } else {
        champPacks++
        expect(pack.every((m) => m.rank === 'champion')).toBe(true)
      }
    }
    expect(uniquePacks).toBeGreaterThanOrEqual(65)
    expect(champPacks).toBeGreaterThanOrEqual(10)

    const game = new GameInstance({ seed: 18380, areaId: 118, difficulty: 0 })
    const pid = game.connectPlayer({ charClass: 'bar', name: 'Frenzy', x: 25, y: 25, areaId: 118 })
    const internal = game as unknown as {
      monsters: Map<number, { rank?: string; x: number; y: number; areaId: number }>
    }
    const urn = game.spawnObject({ classId: 466, x: 27, y: 25, areaId: 118 })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: urn })
    game.stepFrames(1)
    const spawned = [...internal.monsters.values()].filter((m) => m.areaId === 118)
    expect(spawned.length).toBeGreaterThanOrEqual(2)
    expect(spawned.some((m) => m.rank === 'unique' || m.rank === 'champion')).toBe(true)
    for (const m of spawned) {
      expect(Math.hypot(m.x - 27, m.y - 25)).toBeLessThanOrEqual(8)
    }
  })
})

describe("#1839 Tristram Wirt's Body (268, OperateFn 33) -> Wirt's Leg + 15 gold piles", () => {
  it("spawns Wirt's Leg ('leg') + 15 gold piles on first operate and cannot be farmed repeatedly on the same corpse", () => {
    const rng = new D2Rng(0x1839)
    const raw = rollWirtsBodyDrops113c(38, 0, 0, true, rng)
    expect(raw.filter((it) => it.base.id.trim() === 'leg')).toHaveLength(1)
    expect(raw.filter((it) => it.base.id.trim() === 'gld')).toHaveLength(15)

    const game = new GameInstance({ seed: 18390, areaId: 38 })
    const pid = game.connectPlayer({ charClass: 'ama', name: 'CowZon', x: 20, y: 20, areaId: 38 })
    const internal = game as unknown as {
      objects: Map<number, { mode: number }>
      groundItems: Map<number, { code: string }>
    }

    const wirt = game.spawnObject({ classId: 268, x: 21, y: 20, areaId: 38 })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: wirt })
    game.stepFrames(1)
    expect(internal.objects.get(wirt)!.mode).toBe(2)

    const firstDrops = [...internal.groundItems.values()]
    expect(firstDrops.filter((d) => d.code.trim().toLowerCase() === 'leg')).toHaveLength(1)
    expect(firstDrops.filter((d) => d.code.trim().toLowerCase() === 'gld')).toHaveLength(15)

    // Clicking the opened corpse again drops nothing further
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: wirt })
    game.stepFrames(1)
    expect(internal.groundItems.size).toBe(16)
  })
})

describe('#1840 All-136-level Levels.txt ObjGrp0..7 / ObjPrb0..7 + Objgroup.txt procedural spawning audit', () => {
  it('audits all 136 canonical levels: towns stay 0, active random levels spawn grounded shrines/wells/containers obeying spacing & caps', () => {
    expect(Object.keys(LEVEL_OBJGRP_113C)).toHaveLength(136)
    expect(Object.keys(OBJGROUP_TXT_113C).length).toBeGreaterThanOrEqual(100)
    expect(OBJECT_POPULATE_FN_113C).toHaveLength(573)

    const townIds = new Set([1, 40, 75, 103, 109])
    let levelsWithActiveGroups = 0
    let levelsSpawningProcedural = 0

    for (let areaId = 1; areaId <= 136; areaId++) {
      const spec = LEVEL_OBJGRP_113C[areaId]!
      expect(spec.objGrp).toHaveLength(8)
      expect(spec.objPrb).toHaveLength(8)

      const geom = makeOpenRoomLevel(areaId, 16, 40)
      const boot = buildAreaBootstrap(geom)

      if (townIds.has(areaId)) {
        expect(boot.objects).toHaveLength(0)
        continue
      }

      const hasNonZeroSlot = spec.objGrp.some((g, i) => {
        if (g <= 0 || spec.objPrb[i]! <= 0) return false
        const grp = OBJGROUP_TXT_113C[g]
        return Boolean(grp && grp.ids.some((cid, m) => cid > 0 && grp.probs[m]! > 0 && (OBJECT_POPULATE_FN_113C[cid] ?? 0) > 0))
      })
      if (!hasNonZeroSlot) {
        expect(boot.objects).toHaveLength(0)
        continue
      }
      levelsWithActiveGroups++
      if (boot.objects.length > 0) levelsSpawningProcedural++

      const shrines = boot.objects.filter((o) => o.isShrine)
      const wells = boot.objects.filter((o) => classifyObjectOperate113c(o.classId) === 'well')
      const maxWells = Math.min(4, Math.max(1, (geom.roomRects.length + 7) >> 3))
      expect(wells.length, `area ${areaId} well cap`).toBeLessThanOrEqual(maxWells)

      // Verify every spawned procedural object is on open walkable floor and >= 5 sub-tiles from spawn
      for (const obj of boot.objects) {
        const sx = obj.x - geom.originX
        const sy = obj.y - geom.originY
        expect(sx).toBeGreaterThanOrEqual(2)
        expect(sy).toBeGreaterThanOrEqual(2)
        expect(sx).toBeLessThan(geom.subWidth - 2)
        expect(sy).toBeLessThan(geom.subHeight - 2)
        expect(geom.blocked[sy * geom.subWidth + sx]).toBe(0)
        expect(Math.hypot(obj.x - boot.spawnX, obj.y - boot.spawnY)).toBeGreaterThanOrEqual(5)
      }

      // Verify >= 30 sub-tile minimum shrine spacing (D2Game 0x6FC52880)
      for (let i = 0; i < shrines.length; i++) {
        for (let j = i + 1; j < shrines.length; j++) {
          const dist = Math.hypot(shrines[i]!.x - shrines[j]!.x, shrines[i]!.y - shrines[j]!.y)
          expect(dist, `area ${areaId} shrine spacing`).toBeGreaterThanOrEqual(
            SHRINE_MIN_SPACING_SUBTILES_113C - 1e-6,
          )
        }
      }
    }

    expect(levelsWithActiveGroups).toBeGreaterThan(80)
    expect(levelsSpawningProcedural).toBe(levelsWithActiveGroups)

    // Verify PopulateFn = 0 rows are never spawned even if artificial room seed is swept
    const sampleOut = populateAreaObjGroups113c({
      level: makeOpenRoomLevel(2, 24, 44),
      existingObjects: [],
      warps: [{ lvlWarpId: 1, destAreaId: 3, x: 1030, y: 1030 }],
      spawn: { x: 1020, y: 1020 },
      seedOverride: 12345,
    })
    expect(sampleOut.length).toBeGreaterThan(0)
    for (const o of sampleOut) {
      expect(OBJECT_POPULATE_FN_113C[o.classId]).toBeGreaterThan(0)
      expect(Math.hypot(o.x - 1030, o.y - 1030)).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('#1843 Act 5 A5Q5 Rite of Passage (Ancients) level gate, TP reset, +1 level XP cap & 547 gate', () => {
  it('blocks direct statue clicks (474..476), gates 546 on clvl 20/40/60, locks 564 during fight, and resets Ancients on Town Portal', () => {
    const game = new GameInstance({ seed: 18430, areaId: 120, difficulty: 0, maxPlayers: 8 })
    const lowId = game.connectPlayer({ charClass: 'bar', name: 'Low', x: 20, y: 20, areaId: 120, level: 19 })
    const heroId = game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 21, y: 20, areaId: 120, level: 20 })
    const internal = game as unknown as {
      players: Map<number, { items: any[]; act: number }>
      objects: Map<number, { mode: number; useCount: number; classId: number }>
      monsters: Map<number, { superUniqueId?: string; dead: boolean }>
      openTownPortal: (player: unknown, consumeScroll?: boolean) => number
    }
    const hero = internal.players.get(heroId)!
    hero.act = 4

    const s474 = game.spawnObject({ classId: 474, x: 24, y: 20, areaId: 120 })
    const s475 = game.spawnObject({ classId: 475, x: 26, y: 20, areaId: 120 })
    const s476 = game.spawnObject({ classId: 476, x: 28, y: 20, areaId: 120 })
    const door564 = game.spawnObject({ classId: 564, x: 18, y: 20, areaId: 120, mode: 2 })
    const gate547 = game.spawnObject({ classId: 547, x: 30, y: 20, areaId: 120 })
    const altar546 = game.spawnObject({ classId: 546, x: 22, y: 20, areaId: 120 })

    // Direct click on statue 474 plays sound 19 and keeps mode 0
    game.drainEvents(heroId)
    game.enqueueCommand(heroId, { type: 'OperateObject', objectId: s474 })
    game.stepFrames(1)
    expect(internal.objects.get(s474)!.mode).toBe(0)
    expect(
      game.drainEvents(heroId).some((e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 19),
    ).toBe(true)

    // Level 19 rejected by Altar 546 on Normal (requires clvl 20)
    game.drainEvents(lowId)
    game.enqueueCommand(lowId, { type: 'OperateObject', objectId: altar546 })
    game.stepFrames(1)
    expect(internal.objects.get(altar546)!.mode).toBe(0)
    expect(
      game.drainEvents(lowId).some((e) => e.type === 'PlaySound' && (e as { sound?: number }).sound === 19),
    ).toBe(true)

    // Level 20 activates Altar 546 -> closes SummitDoor 564 to mode 0, sets statues 474..476 to mode 4, spawns 3 Ancients
    game.enqueueCommand(heroId, { type: 'OperateObject', objectId: altar546 })
    game.stepFrames(1)
    expect(internal.objects.get(altar546)!.mode).toBe(2)
    expect(internal.objects.get(door564)!.mode).toBe(0)
    expect(internal.objects.get(s474)!.mode).toBe(4)
    expect(internal.objects.get(s475)!.mode).toBe(4)
    expect(internal.objects.get(s476)!.mode).toBe(4)
    expect([...internal.monsters.values()].filter((m) => m.superUniqueId?.startsWith('Ancient Barbarian'))).toHaveLength(3)

    // SummitDoor 564 and Worldstone Gate 547 cannot be opened during active Ancients fight
    game.enqueueCommand(heroId, { type: 'OperateObject', objectId: door564 })
    game.enqueueCommand(heroId, { type: 'OperateObject', objectId: gate547 })
    game.stepFrames(1)
    expect(internal.objects.get(door564)!.mode).toBe(0)
    expect(internal.objects.get(gate547)!.mode).toBe(0)

    // Opening a Town Portal despawns all 3 Ancients and resets Statues 474..476 + Altar 546 to mode 0!
    const tpId = internal.openTownPortal(hero, false)
    expect(tpId).toBeGreaterThan(0)
    expect([...internal.monsters.values()].filter((m) => m.superUniqueId?.startsWith('Ancient Barbarian'))).toHaveLength(0)
    expect(internal.objects.get(altar546)!.mode).toBe(0)
    expect(internal.objects.get(altar546)!.useCount).toBe(0)
    expect(internal.objects.get(s474)!.mode).toBe(0)
    expect(internal.objects.get(s475)!.mode).toBe(0)
    expect(internal.objects.get(s476)!.mode).toBe(0)
  })

  it('awards 1.4M / 20M / 40M XP clamped to +1 level span, denies <20/40/60 bystanders, and opens 547 -> Worldstone Keep L1 (128)', () => {
    // 1. Normal: clvl 20 has single-level span < 1,400,000 -> clamped to exact MinExp(21) - MinExp(20) (+1 level -> 21);
    //    clvl 19 bystander in same area receives 0 XP and 0 quest completion!
    const normGame = new GameInstance({ seed: 18431, areaId: 120, difficulty: 0, maxPlayers: 8 })
    const p20Id = normGame.connectPlayer({ charClass: 'pal', name: 'P20', x: 20, y: 20, areaId: 120, level: 20 })
    const p19Id = normGame.connectPlayer({ charClass: 'pal', name: 'P19', x: 21, y: 20, areaId: 120, level: 19 })
    const normInternal = normGame as unknown as {
      players: Map<
        number,
        {
          level: number
          experience: number
          statPts: number
          newSkills: number
          areaId: number
          questFlags: Uint16Array
        }
      >
      objects: Map<number, { mode: number }>
      monsters: Map<number, { superUniqueId?: string }>
    }
    const p20 = normInternal.players.get(p20Id)!
    const p19 = normInternal.players.get(p19Id)!
    const startExp20 = getExperienceForLevel(20)
    const span20 = getExperienceForLevel(21) - startExp20
    expect(span20).toBeLessThan(1_400_000)
    p20.experience = startExp20
    const startExp19 = p19.experience
    const statPts0 = p20.statPts
    const skills0 = p20.newSkills

    const altar = normGame.spawnObject({ classId: 546, x: 22, y: 20, areaId: 120 })
    const gate547 = normGame.spawnObject({ classId: 547, x: 23, y: 20, areaId: 120 })
    normGame.enqueueCommand(p20Id, { type: 'OperateObject', objectId: altar })
    normGame.stepFrames(1)
    for (const [mid, m] of normInternal.monsters.entries()) {
      if (m.superUniqueId?.startsWith('Ancient Barbarian')) {
        normGame.applyDamageToMonster(mid, 500_000, p20Id, undefined, 'mag')
      }
    }
    normGame.stepFrames(1)

    expect(p20.questFlags[questWordIndex113c('a5q5')!]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(p20.experience).toBe(startExp20 + span20)
    expect(p20.level).toBe(21)
    expect(p20.statPts).toBe(statPts0 + 5)
    expect(p20.newSkills).toBe(skills0 + 1)

    expect(p19.questFlags[questWordIndex113c('a5q5')!]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(p19.experience).toBe(startExp19)
    expect(p19.level).toBe(19)

    // Gate 547: first click opens (0 -> 1 for 50 ticks -> 2), second click warps to Worldstone Keep L1 (128)
    normGame.enqueueCommand(p20Id, { type: 'Interact', target: { unitType: 2, id: gate547 } })
    normGame.stepFrames(1)
    expect(normInternal.objects.get(gate547)!.mode).toBe(1)
    normGame.stepFrames(55)
    expect(normInternal.objects.get(gate547)!.mode).toBe(2)
    normGame.enqueueCommand(p20Id, { type: 'Interact', target: { unitType: 2, id: gate547 } })
    normGame.stepFrames(1)
    expect(p20.areaId).toBe(128)

    // 2. Nightmare (20,000,000 raw pool) & Hell (40,000,000 raw pool) at clvl 75 (where single-level span > 40M):
    //    player receives exact full 20,000,000 / 40,000,000 XP!
    for (const [diff, expectedGain] of [
      [1, 20_000_000],
      [2, 40_000_000],
    ] as const) {
      const g = new GameInstance({ seed: 18432 + diff, areaId: 120, difficulty: diff })
      const pid = g.connectPlayer({ charClass: 'sor', name: 'High', x: 20, y: 20, areaId: 120, level: 75 })
      const gInt = g as unknown as {
        players: Map<number, { experience: number; level: number }>
        monsters: Map<number, { superUniqueId?: string }>
      }
      const pl = gInt.players.get(pid)!
      const floor75 = getExperienceForLevel(75)
      expect(getExperienceForLevel(76) - floor75).toBeGreaterThan(40_000_000)
      pl.experience = floor75

      const a = g.spawnObject({ classId: 546, x: 22, y: 20, areaId: 120 })
      g.enqueueCommand(pid, { type: 'OperateObject', objectId: a })
      g.stepFrames(1)
      for (const [mid, m] of gInt.monsters.entries()) {
        if (m.superUniqueId?.startsWith('Ancient Barbarian')) {
          g.applyDamageToMonster(mid, 500_000, pid, undefined, 'mag')
        }
      }
      g.stepFrames(1)
      expect(pl.experience).toBe(floor75 + expectedGain)
    }
  })
})
