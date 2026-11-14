/**
 * Issue #1441 — 1.13c A4Q2 (The Hellforge, word 26 / questId 0x1b, Objects.txt 376 OperateFn 49 @ D2Game.dll 0x6fcdb8d0)
 * and quest object item-gate / mode-preservation class-of-bug sweep:
 * - Stage 1 (`wForgeMode == 0` / `obj.mode === 0`, `0x6fcdbaf8..0x6fcdbb78`): requires Mephisto's Soulstone (`'mss'`).
 *   Without `'mss'`, operating Hellforge is a no-op (even if `'hfh'` is equipped). With `'mss'`, removes `'mss'`
 *   (`0x6fcdbb71`), sets `obj.mode = 1` (`0x6fcdbb16`), and sets `wForgeMode = 2` (`0x6fcdbb4b`).
 * - Stage 2 (`wForgeMode == 2` / `obj.mode === 1 || obj.mode === 2`, `0x6fcdb988..0x6fcdbae7`): requires equipped
 *   Hellforge Hammer (`'hfh'`, `0x6fcdb9ce`). Increments game-level hit counter (`[edi+0x0c]`, `0x6fcdb9da`);
 *   hits 1..2 return (`<= 2` at `0x6fcdb9e6`). On hit 3 (`> 2`): sets `obj.mode = 3` (`0x6fcdb9ee`), removes equipped
 *   `'hfh'` (`0x6fcdba03`), sets `a4q2` to `QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C` (`0x2002`,
 *   bits 1 & 13, `0x6fcdba14..0x6fcdba25`), emits `0x89` `specialEventId = 14` (`0x6fcdbae7`), and drops 1 rune + 4 gems.
 * - Stage 3 (`0x6fcdaa50` @ `0x6fcdab14..0x6fcdabb7`): talking to Deckard Cain (`hcIdx` 246 / 146 / 244 / 245 / 265 / 520)
 *   while `a4q2` has `QUEST_FLAG_REWARD_PENDING_113C` (`0x0002`) clears bit 1 (`0x0002`) and sets bit 0 (`0x0001`).
 * - Class-of-bug sweep: operating Horadric Orifice (`152`, OperateFn 25 @ `0x6fce6240`) without `'hst'` or Frozen Anya
 *   (`558`, OperateFn 67 @ `0x6fc7cd50`) without `'ice'` must NOT advance `obj.mode` to `2` prematurely.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'

function makeQuestItem(
  unitId: number,
  ownerId: number,
  code: string,
  location: 'inventory' | 'equipped' = 'inventory',
  areaId = 107,
) {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 1,
    location,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId,
    ownerId,
    bodyLoc: location === 'equipped' ? 4 : 0,
    storePage: location === 'inventory' ? 1 : 0,
    cost: 0,
    gamble: false,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 10,
    maxDurability: 10,
    quantity: 1,
    stats: new Map(),
    socketedItems: [],
  }
}

function setupGame(seed: number, areaId = 107) {
  const game = new GameInstance({ seed, areaId, maxPlayers: 8 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId })
  const internal = game as unknown as {
    players: Map<
      number,
      {
        unitId: number
        areaId: number
        questFlags: Uint16Array
        items: any[]
      }
    >
    objects: Map<number, { unitId: number; classId: number; mode: number; useCount: number }>
    groundItems: Map<number, { unitId: number; code: string; areaId: number; x: number; y: number }>
    hellforgeState: 0 | 2 | 3
    hellforgeHits: number
  }
  const player = internal.players.get(playerId)!
  return { game, playerId, player, internal }
}

describe('issue #1441: 1.13c A4Q2 Hellforge (Objects.txt 376 OperateFn 49) & quest object item-gate sweep', () => {
  it('Stage 1 requires Mephisto Soulstone (mss) before Hellforge Hammer hits can begin (D2Game.dll 0x6fcdbaf8..0x6fcdbb78)', () => {
    const { game, playerId, player, internal } = setupGame(14411, 107)
    const a4q2Idx = questWordIndex113c('a4q2')!
    const forgeId = game.spawnObject({ classId: 376, x: 11, y: 10, areaId: 107 })
    const forgeObj = internal.objects.get(forgeId)!

    // Equip Hellforge Hammer ('hfh') WITHOUT carrying Mephisto's Soulstone ('mss').
    const hammer = makeQuestItem(9001, playerId, 'hfh', 'equipped', 107)
    player.items.push(hammer)

    // Operating 3 times without 'mss' must be a complete no-op: mode stays 0, useCount stays 0, hammer not consumed.
    for (let i = 0; i < 3; i++) {
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
      game.stepFrames(1)
    }
    expect(forgeObj.mode).toBe(0)
    expect(forgeObj.useCount).toBe(0)
    expect(internal.hellforgeState).toBe(0)
    expect(internal.hellforgeHits).toBe(0)
    expect(player.items.includes(hammer)).toBe(true)
    expect(player.questFlags[a4q2Idx]).toBe(0)
    expect(internal.groundItems.size).toBe(0)

    // Give player Mephisto's Soulstone ('mss') and operate -> consumes 'mss', sets forge mode = 1, hellforgeState = 2.
    const soulstone = makeQuestItem(9002, playerId, 'mss', 'inventory', 107)
    player.items.push(soulstone)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
    game.stepFrames(1)

    const stage1Events = game.drainEvents(playerId)
    expect(player.items.includes(soulstone)).toBe(false)
    expect(
      stage1Events.some(
        (e) =>
          e.type === 'ItemEvent' &&
          (e as { action?: string; itemId?: number }).action === 'remove' &&
          (e as { itemId?: number }).itemId === 9002,
      ),
    ).toBe(true)
    expect(forgeObj.mode).toBe(1)
    expect(internal.hellforgeState).toBe(2)
    expect(internal.hellforgeHits).toBe(0)
    expect(player.questFlags[a4q2Idx]).toBe(0)
  })

  it('Stage 2 & 3 require equipped hfh for 3 hits, consume hfh, set mode=3 and a4q2=0x2002, and Cain turn-in sets 0x0001 (D2Game.dll 0x6fcdb988..0x6fcdbae7, 0x6fcdaa50)', () => {
    const { game, playerId, player, internal } = setupGame(14412, 107)
    const a4q2Idx = questWordIndex113c('a4q2')!
    const allyId = game.connectPlayer({ charClass: 'sor', name: 'Ally', x: 12, y: 10, areaId: 107 })
    const ally = internal.players.get(allyId)!
    game.enqueueCommand(playerId, { type: 'PartyAction', action: 'invite', targetPlayerId: allyId } as never)
    game.stepFrames(1)
    game.enqueueCommand(allyId, { type: 'PartyAction', action: 'accept', targetPlayerId: playerId } as never)
    game.stepFrames(1)

    const forgeId = game.spawnObject({ classId: 376, x: 11, y: 10, areaId: 107 })
    const forgeObj = internal.objects.get(forgeId)!

    const soulstone = makeQuestItem(9011, playerId, 'mss', 'inventory', 107)
    const invHammer = makeQuestItem(9012, playerId, 'hfh', 'inventory', 107)
    player.items.push(soulstone, invHammer)

    // Stage 1: place 'mss' -> mode becomes 1
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
    game.stepFrames(1)
    expect(forgeObj.mode).toBe(1)
    expect(player.items.includes(soulstone)).toBe(false)

    // Operating while 'hfh' is only in inventory (not equipped) does not increment hits.
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
    game.stepFrames(1)
    expect(internal.hellforgeHits).toBe(0)
    expect(forgeObj.useCount).toBe(0)
    expect(forgeObj.mode).toBe(1)

    // Equip 'hfh' and hit twice (hits 1 and 2): increments counter, does not complete or consume 'hfh' yet.
    invHammer.location = 'equipped'
    invHammer.bodyLoc = 4
    for (let hit = 1; hit <= 2; hit++) {
      game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
      game.stepFrames(1)
      expect(internal.hellforgeHits).toBe(hit)
      expect(forgeObj.useCount).toBe(hit)
      expect(forgeObj.mode).toBe(1)
      expect(player.items.includes(invHammer)).toBe(true)
      expect(player.questFlags[a4q2Idx]).toBe(0)
    }

    // Hit 3 (> 2): smashes forge (mode = 3), removes equipped 'hfh', sets a4q2 = 0x2002 (bits 1 & 13) for player and same-area ally, emits 0x89 specialEventId 14, and drops 5 items (1 rune + 4 gems).
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
    game.stepFrames(1)

    const smashEvents = game.drainEvents(playerId)
    expect(forgeObj.mode).toBe(3)
    expect(internal.hellforgeState).toBe(3)
    expect(player.items.includes(invHammer)).toBe(false)
    expect(
      smashEvents.some(
        (e) =>
          e.type === 'ItemEvent' &&
          (e as { action?: string; itemId?: number }).action === 'remove' &&
          (e as { itemId?: number }).itemId === 9012,
      ),
    ).toBe(true)
    expect(
      smashEvents.some(
        (e) =>
          e.type === 'QuestState' &&
          (e as { source?: number; specialEventId?: number }).source === 0x89 &&
          (e as { specialEventId?: number }).specialEventId === 14,
      ),
    ).toBe(true)
    expect(player.questFlags[a4q2Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(ally.questFlags[a4q2Idx]).toBe(
      QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(internal.groundItems.size).toBe(0)
    game.stepFrames(80)
    expect(internal.groundItems.size).toBe(9)

    // Operating again after smashing (or when bit 1 / bit 0 is set) is a no-op.
    const dropCountAfterSmash = internal.groundItems.size
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: forgeId })
    game.stepFrames(1)
    expect(internal.groundItems.size).toBe(dropCountAfterSmash)

    // Stage 3: Talk to Deckard Cain (hcIdx 246) -> clears bit 1 (0x0002) and sets bit 0 (0x0001 COMPLETED).
    const cain = game.spawnMonster({
      classId: 246,
      name: 'Deckard Cain',
      x: 11,
      y: 10,
      areaId: 107,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a4q2Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a4q2Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
  })

  it('Act 4 Cain (hcIdx 246 in area 103) mints replacement mss if missing before placing on the forge, and Hephasto does not drop hfh once a4q2 is reward-pending', () => {
    const { game, playerId, player, internal } = setupGame(14413, 103)
    const a4q2Idx = questWordIndex113c('a4q2')!

    const cain = game.spawnMonster({
      classId: 246,
      name: 'Deckard Cain',
      x: 11,
      y: 10,
      areaId: 103,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'mss')).toBe(true)
    expect(player.questFlags[a4q2Idx]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)

    // Once a4q2 has QUEST_FLAG_REWARD_PENDING_113C (0x0002), killing Hephasto does not drop another 'hfh'.
    player.questFlags[a4q2Idx] = QUEST_FLAG_REWARD_PENDING_113C | QUEST_FLAG_COMPLETED_NOW_113C
    const hephasto = game.spawnMonster({
      defId: 'hephasto',
      superUniqueId: 'Hephasto the Armorer',
      x: 12,
      y: 10,
      areaId: 103,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(hephasto, 1000, playerId)
    expect([...internal.groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'hfh')).toBe(false)
  })

  it('Class-of-bug sweep: clicking Horadric Orifice (152) without hst or Frozen Anya (558) without ice does not lock obj.mode to 2', () => {
    const { game, playerId, player, internal } = setupGame(14414, 72)
    const a2q2Idx = questWordIndex113c('a2q2')!
    const a5q3Idx = questWordIndex113c('a5q3')!

    // 1. Horadric Orifice (Objects.txt 152, OperateFn 25 @ 0x6fce6240):
    // Clicking without 'hst'/'vip'/'msf' must keep mode 0 so the player can operate it after obtaining 'hst'.
    const orificeId = game.spawnObject({ classId: 152, x: 11, y: 10, areaId: 72 })
    const orificeObj = internal.objects.get(orificeId)!
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orificeId })
    game.stepFrames(1)
    expect(orificeObj.mode).toBe(0)
    expect(player.questFlags[a2q2Idx]).toBe(0)

    player.items.push(makeQuestItem(9021, playerId, 'hst', 'inventory', 72))
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: orificeId })
    game.stepFrames(1)
    expect(orificeObj.mode).toBe(2)
    expect(player.items.some((i) => i.code === 'hst')).toBe(false)
    expect(player.questFlags[a2q2Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)

    // 2. Frozen Anya (Objects.txt 558, OperateFn 67 @ 0x6fc7cd50):
    // Clicking without 'ice' starts a5q3 (bit 2 = 0x0004) and keeps mode 0 so she can be thawed after getting 'ice' from Malah.
    const anyaId = game.spawnObject({ classId: 558, x: 11, y: 11, areaId: 72 })
    const anyaObj = internal.objects.get(anyaId)!
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: anyaId })
    game.stepFrames(1)
    expect(anyaObj.mode).toBe(0)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)

    // Now give player Malah's Potion ('ice') and operate Frozen Anya again -> thaws her (mode = 2, consumes 'ice', sets REWARD_PENDING).
    player.items.push(makeQuestItem(9022, playerId, 'ice', 'inventory', 72))
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: anyaId })
    game.stepFrames(1)
    expect(anyaObj.mode).toBe(2)
    expect(player.items.some((i) => i.code === 'ice')).toBe(false)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
  })
})
