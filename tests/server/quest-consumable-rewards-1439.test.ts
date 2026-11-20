/**
 * Issue #1439 — 1.13c consumable quest reward items (`ass`, `xyz`, `tr2`):
 * - Killing Radament (`a2q1`) / turning in to Alkor (`a3q1`) / turning in to Malah (`a5q3`)
 *   arms the 1.13c custom quest bit and drops/mints the consumable item WITHOUT directly
 *   adding skill points, max HP, or resistances.
 * - Using `ass` (`0x6fcf9e73..0x6fcf9ea9`), `xyz` (`0x6fcf9ec5..0x6fcf9efb`), or
 *   `tr2` (`0x6fcf9efc..0x6fcf9f52`) validates the custom quest bit, consumes the item,
 *   updates the quest bit, and grants the reward exactly once.
 * - Attempting to use a duplicate/unarmed `ass`, `xyz`, or `tr2` plays sound `19`
 *   (`impossible1`, `0x6fcf9eab`) WITHOUT removing the item or granting duplicate rewards.
 * - `.d2s` save/load preserves the custom quest bits (`0x0020`, `0x0080`, `0x0100`) and
 *   A5Q3 `+10` all-resistance bonus (`0x6fc7b0b0`).
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_5_113C,
  QUEST_FLAG_CUSTOM_7_113C,
  QUEST_FLAG_CUSTOM_8_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'

function makeQuestItem(unitId: number, code: string) {
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
    ownerId: 1,
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
    quantity: 1,
    stats: new Map(),
    socketedItems: [],
  }
}

function setupGame(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
  const internal = game as unknown as {
    players: Map<
      number,
      {
        unitId: number
        level: number
        questFlags: Uint16Array
        items: any[]
        newSkills: number
        statPts: number
        hp: number
        maxHp: number
        hpFixed: number
        maxHpFixed: number
      }
    >
    groundItems: Map<number, { unitId: number; code: string; areaId: number; x: number; y: number }>
    playerResistPct: (player: unknown, kind: 'fire' | 'cold' | 'light' | 'poison') => number
  }
  const player = internal.players.get(playerId)!
  return { game, playerId, player, groundItems: internal.groundItems, internal }
}

describe('issue #1439: 1.13c consumable quest item rewards (ass, xyz, tr2)', () => {
  it('A2Q1 Book of Skill (ass): Radament kill arms bit 5 (0x0020) without adding skill points; using ass consumes it once and rejects a second ass with sound 19', () => {
    const { game, playerId, player, groundItems } = setupGame(14391)
    const a2q1Idx = questWordIndex113c('a2q1')!
    const skills0 = player.newSkills
    const level0 = player.level

    // 1. Killing Radament (`0x6fce6163..0x6fce6185`) drops 'ass' and sets bit 0 | bit 5 | bit 13,
    //    but does NOT directly add +1 skill point.
    const radament = game.spawnMonster({
      defId: 'radament',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(radament, 1000, playerId)

    const skillsAfterKill = player.newSkills - (player.level - level0)
    expect(skillsAfterKill).toBe(skills0)
    expect(player.questFlags[a2q1Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a2q1Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(
      QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(player.questFlags[a2q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(QUEST_FLAG_CUSTOM_5_113C)

    const droppedBook = [...groundItems.values()].find((g) => g.code.trim().toLowerCase() === 'ass')
    expect(droppedBook).toBeDefined()

    // 2. Pick up and use 'ass' (`0x6fcf9e73..0x6fcf9ea9`) -> clears bit 5, removes 'ass', grants +1 newSkills.
    game.enqueueCommand(playerId, {
      type: 'ItemPickup',
      itemId: droppedBook!.unitId,
      toCursor: false,
    } as never)
    game.stepFrames(1)
    const bookInInv = player.items.find((i) => i.code.trim().toLowerCase() === 'ass')
    expect(bookInInv).toBeDefined()

    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: bookInInv!.unitId } as never)
    game.stepFrames(1)

    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'ass')).toBe(false)
    expect(player.questFlags[a2q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(0)
    expect(player.newSkills - (player.level - level0)).toBe(skills0 + 1)

    // 3. Injecting a second 'ass' while bit 5 is 0 must reject with sound 19 ('impossible1'),
    //    leave the item in inventory, and NOT grant another skill point.
    player.items.push(makeQuestItem(99101, 'ass'))
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: 99101 } as never)
    game.stepFrames(1)

    const rejectEvents = game.drainEvents(playerId)
    expect(rejectEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.some((i) => i.unitId === 99101)).toBe(true)
    expect(player.newSkills - (player.level - level0)).toBe(skills0 + 1)
  })

  it('A3Q1 Potion of Life (xyz): Alkor turn-in mints xyz and arms bit 5 (0x0020) without adding HP; using xyz grants +20 Max HP once and rejects duplicates', () => {
    const { game, playerId, player } = setupGame(14392)
    const a3q1Idx = questWordIndex113c('a3q1')!
    const maxHp0 = player.maxHp
    const maxHpFixed0 = player.maxHpFixed

    // 1. Give player Golden Bird ('g34', traded from Meshif for 'j34') and talk to Alkor (`hcIdx === 254`, `0x6fd08c5a..0x6fd08d9a`).
    player.items.push(makeQuestItem(99201, 'g34'))
    const alkor = game.spawnMonster({
      classId: 254,
      name: 'Alkor',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)

    // 'g34' is removed, 'xyz' is minted into inventory, bit 5 (0x0020) is set, and Max HP is unchanged.
    expect(player.items.some((i) => i.code === 'g34')).toBe(false)
    const xyzItem = player.items.find((i) => i.code.trim().toLowerCase() === 'xyz')
    expect(xyzItem).toBeDefined()
    expect(player.maxHp).toBe(maxHp0)
    expect(player.maxHpFixed).toBe(maxHpFixed0)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(QUEST_FLAG_CUSTOM_5_113C)

    // 2. Use 'xyz' (`0x6fcf9ec5..0x6fcf9efb`) -> clears bit 5, removes 'xyz', adds +20 Max HP (+0x1400 fixed).
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: xyzItem!.unitId } as never)
    game.stepFrames(1)

    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'xyz')).toBe(false)
    expect(player.questFlags[a3q1Idx]! & QUEST_FLAG_CUSTOM_5_113C).toBe(0)
    expect(player.maxHp).toBe(maxHp0 + 20)
    expect(player.maxHpFixed).toBe(maxHpFixed0 + (20 << 8))

    // 3. Using another 'xyz' when bit 5 is 0 plays sound 19, keeps the item, and does not add HP.
    player.items.push(makeQuestItem(99202, 'xyz'))
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: 99202 } as never)
    game.stepFrames(1)

    const rejectEvents = game.drainEvents(playerId)
    expect(rejectEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.some((i) => i.unitId === 99202)).toBe(true)
    expect(player.maxHp).toBe(maxHp0 + 20)
  })

  it('A5Q3 Scroll of Resistance (tr2): Malah turn-in sets bit 8 (0x0100) without adding resist; using tr2 sets bit 7 (0x0080), grants +10 all resist once, and persists across .d2s save/load', () => {
    const { game, playerId, player, internal } = setupGame(14393)
    const a5q3Idx = questWordIndex113c('a5q3')!
    const fire0 = internal.playerResistPct(player, 'fire')
    const cold0 = internal.playerResistPct(player, 'cold')
    const light0 = internal.playerResistPct(player, 'light')
    const poison0 = internal.playerResistPct(player, 'poison')

    // 1. Complete Anya thaw and talk to Malah (`hcIdx === 513`, `0x6fc7f73e..0x6fc7f78b`).
    player.questFlags[a5q3Idx] = QUEST_FLAG_REWARD_PENDING_113C
    const malah = game.spawnMonster({
      classId: 513,
      name: 'Malah',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)

    // Malah grants 'tr2' and sets bit 8 (0x0100), bit 7 (0x0080) is still 0, REWARD_PENDING remains set until Town Anya (#2019), and resistances are unchanged!
    const tr2Item = player.items.find((i) => i.code.trim().toLowerCase() === 'tr2')
    expect(tr2Item).toBeDefined()
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_8_113C).toBe(QUEST_FLAG_CUSTOM_8_113C)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_7_113C).toBe(0)
    expect(internal.playerResistPct(player, 'fire')).toBe(fire0)
    expect(internal.playerResistPct(player, 'cold')).toBe(cold0)
    expect(internal.playerResistPct(player, 'light')).toBe(light0)
    expect(internal.playerResistPct(player, 'poison')).toBe(poison0)

    // 2. Use 'tr2' (`0x6fcf9efc..0x6fcf9f52`) -> sets bit 7 (0x0080), removes 'tr2', grants +10 all resistances.
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: tr2Item!.unitId } as never)
    game.stepFrames(1)

    const useEvents = game.drainEvents(playerId)
    expect(player.items.some((i) => i.code.trim().toLowerCase() === 'tr2')).toBe(false)
    expect(player.questFlags[a5q3Idx]! & QUEST_FLAG_CUSTOM_7_113C).toBe(QUEST_FLAG_CUSTOM_7_113C)
    expect(internal.playerResistPct(player, 'fire')).toBe(fire0 + 10)
    expect(internal.playerResistPct(player, 'cold')).toBe(cold0 + 10)
    expect(internal.playerResistPct(player, 'light')).toBe(light0 + 10)
    expect(internal.playerResistPct(player, 'poison')).toBe(poison0 + 10)
    for (const statId of [39, 41, 43, 45]) {
      expect(
        useEvents.some((e) => e.type === 'UnitStatUpdate' && e.statId === statId && e.value === 10),
      ).toBe(true)
    }

    // 3. Using a second 'tr2' while bit 7 is already 1 plays sound 19, keeps the item, and does not stack resistances.
    player.items.push(makeQuestItem(99302, 'tr2'))
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'BeltUse', itemId: 99302 } as never)
    game.stepFrames(1)

    const rejectEvents = game.drainEvents(playerId)
    expect(rejectEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(player.items.some((i) => i.unitId === 99302)).toBe(true)
    expect(internal.playerResistPct(player, 'fire')).toBe(fire0 + 10)

    // 4. Verify .d2s round-trip preserves bit 7 & bit 8 on word 37 ('a5q3').
    const d2sBytes = game.exportPlayerD2s(playerId)
    expect(d2sBytes).not.toBeNull()
    const parsed = readD2sSave113c(d2sBytes!)
    expect(parsed.quests[game.difficulty][a5q3Idx]! & QUEST_FLAG_CUSTOM_7_113C).toBe(
      QUEST_FLAG_CUSTOM_7_113C,
    )
    expect(parsed.quests[game.difficulty][a5q3Idx]! & QUEST_FLAG_CUSTOM_8_113C).toBe(
      QUEST_FLAG_CUSTOM_8_113C,
    )
  })
})
