/**
 * Issue #2002 — 1.13c Quest Item Parity:
 * - Separate upward-only `QUEST_ITEM_SUPERSEDING_CODES_113C` (`QUESTS_FindItemByCode`
 *   `D2Game.dll` `0x6FC2E660` + `ACT3Q5_CountFlailNeeds` `0x6FD036A0` + Meshif `0x6FD08E1E`)
 *   from symmetric `QUEST_ITEM_EQUIVALENT_CODES_113C` (`ITEMS_HasConflictingQuestItem` `0x6FCF2070`).
 * - Fixes A3Q3/A3Q5 Travincal Council softlock where holding `qey`, `qhr`, or `qbr` suppressed `qf1` drops.
 * - Spawns 1 `qf1` per needing eligible party recipient (`0x6FD07E60..0x6FD07E8B`).
 * - Fixes Meshif `j34 -> g34` turn-in when another `j34` lies on the ground in Kurast Docks.
 * - Gates Mephisto `mss` drops once `a4q2` Hellforge is completed or reward-pending.
 * - Enforces `ITEMS_CheckQuestItemPickup` (`0x6FCF2F00` + `0x6FD22CC0`) completed-quest & custom-bit
 *   ground pickup gates (with `'box'` and `'leg'` exemptions) plus symmetric player + mercenary conflict checks.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_CUSTOM_5_113C,
  QUEST_FLAG_CUSTOM_7_113C,
  QUEST_FLAG_CUSTOM_8_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'

function makeItemEntry(
  unitId: number,
  ownerId: number,
  code: string,
  location: 'inventory' | 'equipped' | 'ground' = 'inventory',
  areaId = 83,
  x = 10,
  y = 10,
) {
  return {
    unitId,
    code,
    name: code,
    quality: 7,
    level: 25,
    location,
    x: location === 'ground' ? x : 0,
    y: location === 'ground' ? y : 0,
    width: 1,
    height: 1,
    areaId,
    ownerId: location === 'ground' ? 0 : ownerId,
    bodyLoc: location === 'equipped' ? 4 : 0,
    storePage: location === 'inventory' ? 1 : 0,
    cost: 0,
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
  }
}

describe('Issue #2002: 1.13c quest item superseding possession vs. ground pickup validation', () => {
  it('drops Khalim Flail (qf1) from Travincal Council when player already holds Khalim Eye/Brain/Heart (qey, qbr, qhr) and scales qf1 count for party recipients', () => {
    const game = new GameInstance({ seed: 200201, difficulty: 0, areaId: 83, maxPlayers: 8 })

    const p1Id = game.connectPlayer({ charClass: 'sor', name: 'OrganSorc', x: 20, y: 20, areaId: 83 })
    const p2Id = game.connectPlayer({ charClass: 'pal', name: 'PartyPal', x: 21, y: 20, areaId: 83 })
    game.enqueueCommand(p1Id, { type: 'PartyAction', action: 'invite', targetPlayerId: p2Id } as never)
    game.stepFrames(1)
    game.enqueueCommand(p2Id, { type: 'PartyAction', action: 'accept', targetPlayerId: p1Id } as never)
    game.stepFrames(1)

    ;(game as unknown as { loadedAreas: Map<number, unknown> }).loadedAreas.set(83, {
      areaId: 83,
      rooms: [],
      adjacentAreaIds: [],
    })

    const internal = game as unknown as {
      players: Map<number, { unitId: number; act: number; areaId: number; questFlags: Uint16Array; items: any[] }>
      groundItems: Map<number, { unitId: number; areaId: number; code: string }>
    }
    const p1 = internal.players.get(p1Id)!
    const p2 = internal.players.get(p2Id)!
    p1.act = 2
    p2.act = 2

    // Normal Act 3 progression: p1 holds all 3 organs ('qey', 'qbr', 'qhr') + 'box'; p2 holds 'qey'.
    p1.items.push(
      makeItemEntry(8001, p1Id, 'qey', 'inventory', 83),
      makeItemEntry(8002, p1Id, 'qbr', 'inventory', 83),
      makeItemEntry(8003, p1Id, 'qhr', 'inventory', 83),
      makeItemEntry(8004, p1Id, 'box', 'inventory', 83),
    )
    p2.items.push(makeItemEntry(8005, p2Id, 'qey', 'inventory', 83))

    const ismail = game.spawnMonster({
      defId: 'councilmember1',
      x: 22,
      y: 20,
      areaId: 83,
      hp: 40,
      maxHp: 40,
      superUniqueId: 'Ismail Vilehand',
    })
    game.applyDamageToMonster(ismail, 5000, p1Id)

    const flailDrops = [...internal.groundItems.values()].filter(
      (g) => g.areaId === 83 && g.code.trim().toLowerCase() === 'qf1',
    )
    expect(flailDrops).toHaveLength(2)
    expect(hasQuestFlag113c(p1.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(true)
    expect(hasQuestFlag113c(p2.questFlags, 'a3q5', QUEST_FLAG_COMPLETED_113C)).toBe(true)
  })

  it('mints Golden Bird (g34) at Meshif even when another Jade Figurine (j34) lies on the ground, and suppresses Mephisto Soulstone (mss) once a4q2 is completed', () => {
    const game = new GameInstance({ seed: 200202, difficulty: 0, areaId: 75 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'KurastSorc', x: 10, y: 10, areaId: 75 })
    const internal = game as unknown as {
      players: Map<number, { unitId: number; areaId: number; questFlags: Uint16Array; items: any[] }>
      groundItems: Map<number, any>
    }
    const player = internal.players.get(pid)!

    // Player carries 'j34' while a second 'j34' lies on the ground in Kurast Docks (75).
    player.items.push(makeItemEntry(8101, pid, 'j34', 'inventory', 75))
    internal.groundItems.set(8102, makeItemEntry(8102, 0, 'j34', 'ground', 75, 12, 10))

    const meshif = game.spawnMonster({
      classId: 264,
      name: 'Meshif',
      x: 11,
      y: 10,
      areaId: 75,
      isNpc: true,
    })
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: meshif } } as never)
    game.stepFrames(1)

    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'j34')).toBe(false)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'g34')).toBe(true)

    // Mephisto drops 'mss' before a4q2 completion, then stops dropping 'mss' after a4q2 is completed.
    player.areaId = 102
    const meph1 = game.spawnMonster({ defId: 'mephisto', x: 12, y: 10, areaId: 102, hp: 50, maxHp: 50 })
    game.applyDamageToMonster(meph1, 5000, pid)
    const mssDropsBefore = [...internal.groundItems.values()].filter(
      (g) => g.areaId === 102 && g.code.trim().toLowerCase() === 'mss',
    )
    expect(mssDropsBefore).toHaveLength(1)
    internal.groundItems.delete(mssDropsBefore[0].unitId)

    setQuestFlag113c(player.questFlags, 'a4q2', QUEST_FLAG_COMPLETED_113C)
    const meph2 = game.spawnMonster({ defId: 'mephisto', x: 13, y: 10, areaId: 102, hp: 50, maxHp: 50 })
    game.applyDamageToMonster(meph2, 5000, pid)
    expect(
      [...internal.groundItems.values()].some(
        (g) => g.areaId === 102 && g.code.trim().toLowerCase() === 'mss',
      ),
    ).toBe(false)
  })

  it('enforces symmetric ground-pickup conflicts across player and hired mercenary (qf2 <-> qey/qf1, hst <-> msf/vip) while allowing compatible raw components (msf + vip, qey + qf1)', () => {
    const game = new GameInstance({ seed: 200203, difficulty: 0, areaId: 75 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'PickupSorc', x: 10, y: 10, areaId: 75 })
    game.hireMercenary(pid, { act: 3, level: 24 })
    const internal = game as unknown as {
      players: Map<number, { unitId: number; questFlags: Uint16Array; items: any[] }>
      mercenaries: Map<number, { ownerPlayerId: number; alive: boolean; equipment: any[] }>
      groundItems: Map<number, any>
    }
    const player = internal.players.get(pid)!
    const merc = [...internal.mercenaries.values()].find((m) => m.ownerPlayerId === pid)!

    // 1. Holding 'qey' blocks picking up assembled 'qf2' (0x6FCF227C -> 0x6FCF1A00),
    //    but allows picking up 'qf1'!
    player.items.push(makeItemEntry(8201, pid, 'qey', 'inventory', 75))
    internal.groundItems.set(8202, makeItemEntry(8202, 0, 'qf2', 'ground', 75, 10, 10))
    internal.groundItems.set(8203, makeItemEntry(8203, 0, 'qf1', 'ground', 75, 10, 10))

    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8202, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8202)).toBe(true)
    expect(game.drainEvents(pid).some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8203, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8203)).toBe(false)
    expect(player.items.some((i) => i.code === 'qf1')).toBe(true)

    // 2. Holding 'msf' allows picking up 'vip', while blocking assembled 'hst'.
    player.items = [makeItemEntry(8210, pid, 'msf', 'inventory', 75)]
    internal.groundItems.set(8211, makeItemEntry(8211, 0, 'hst', 'ground', 75, 10, 10))
    internal.groundItems.set(8212, makeItemEntry(8212, 0, 'vip', 'ground', 75, 10, 10))

    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8211, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8211)).toBe(true)

    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8212, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8212)).toBe(false)
    expect(player.items.some((i) => i.code === 'vip')).toBe(true)

    // 3. Hired mercenary holding a quest weapon ('d33') blocks player from picking up conflicting 'g33' (0x6FCF318B).
    player.items = []
    merc.equipment.push(makeItemEntry(8220, pid, 'd33', 'equipped', 75))
    internal.groundItems.set(8221, makeItemEntry(8221, 0, 'g33', 'ground', 75, 10, 10))
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8221, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8221)).toBe(true)
  })

  it('enforces 0x6FCF2F00 / 0x6FD22CC0 post-completion & custom-bit pickup gates while preserving box (after a2q2) and leg (after a1q3) exemptions', () => {
    const game = new GameInstance({ seed: 200204, difficulty: 0, areaId: 1 })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'GateSorc', x: 10, y: 10, areaId: 1 })
    const internal = game as unknown as {
      players: Map<number, { unitId: number; questFlags: Uint16Array; items: any[] }>
      groundItems: Map<number, any>
    }
    const player = internal.players.get(pid)!

    // Complete a1q3, a1q5, a2q2, a3q1, a3q2, a3q3, a4q2; leave a2q1/a3q1 custom bit 5 and a5q3 bit 8 unset.
    for (const q of ['a1q3', 'a1q5', 'a2q1', 'a2q2', 'a3q1', 'a3q2', 'a3q3', 'a4q2', 'a5q3']) {
      setQuestFlag113c(player.questFlags, q, QUEST_FLAG_COMPLETED_113C)
    }

    const blockedCodes = ['bks', 'bkd', 'hdm', 'msf', 'vip', 'hst', 'tr1', 'j34', 'xyz', 'g33', 'd33', 'qey', 'qf1', 'qf2', 'hfh', 'ass', 'tr2']
    let nextId = 8300
    for (const code of blockedCodes) {
      const id = nextId++
      internal.groundItems.set(id, makeItemEntry(id, 0, code, 'ground', 1, 10, 10))
      game.enqueueCommand(pid, { type: 'ItemPickup', itemId: id, toCursor: false } as never)
      game.stepFrames(1)
      expect(internal.groundItems.has(id), `expected ${code} pickup to be blocked`).toBe(true)
    }

    // Exemptions: Horadric Cube ('box', 0x6FCF3098) after a2q2 and Wirt's Leg ('leg', 0x6FCF30C7) after a1q3 MUST still be pickable!
    internal.groundItems.set(8401, makeItemEntry(8401, 0, 'box', 'ground', 1, 10, 10))
    internal.groundItems.set(8402, makeItemEntry(8402, 0, 'leg', 'ground', 1, 10, 10))
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8401, toCursor: false } as never)
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8402, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8401)).toBe(false)
    expect(internal.groundItems.has(8402)).toBe(false)
    expect(player.items.some((i) => i.code === 'box')).toBe(true)
    expect(player.items.some((i) => i.code === 'leg')).toBe(true)

    // Armed custom bits allow picking up 'ass', 'xyz', and unconsumed 'tr2' (until bit 7 is set).
    setQuestFlag113c(player.questFlags, 'a2q1', QUEST_FLAG_CUSTOM_5_113C)
    setQuestFlag113c(player.questFlags, 'a3q1', QUEST_FLAG_CUSTOM_5_113C)
    setQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_8_113C)
    for (const [id, code] of [[8410, 'ass'], [8411, 'xyz'], [8412, 'tr2']] as const) {
      internal.groundItems.set(id, makeItemEntry(id, 0, code, 'ground', 1, 10, 10))
      game.enqueueCommand(pid, { type: 'ItemPickup', itemId: id, toCursor: false } as never)
      game.stepFrames(1)
      expect(internal.groundItems.has(id), `expected armed ${code} pickup to succeed`).toBe(false)
    }

    // Once A5Q3 bit 7 (0x0080, consumed) is set, even with bit 8 set, a second 'tr2' on ground is blocked (0x6FCF3057..0x6FCF306B).
    player.items = player.items.filter((i) => i.code !== 'tr2')
    setQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_7_113C)
    internal.groundItems.set(8413, makeItemEntry(8413, 0, 'tr2', 'ground', 1, 10, 10))
    game.enqueueCommand(pid, { type: 'ItemPickup', itemId: 8413, toCursor: false } as never)
    game.stepFrames(1)
    expect(internal.groundItems.has(8413)).toBe(true)
  })
})
