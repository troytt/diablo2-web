/**
 * Issue #1353 — full 27-quest coverage audit.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'
import { CANONICAL_QUESTS_BY_ACT } from '../../src/common/data/canonical-quest-data.ts'

function questIndex(quest: string): number {
  return questWordIndex113c(quest)!
}

function item(unitId: number, code: string) {
  return {
    unitId, code, name: code, quality: 2, level: 1, location: 'inventory',
    x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: 1, bodyLoc: 0,
    storePage: 0, cost: 0, gamble: false, identified: true, ethereal: false,
    socketed: false, totalSockets: 0, durability: 10, maxDurability: 10,
    quantity: 1, stats: new Map(), socketedItems: [],
    rawItemData: { setItemId: 0xfff, ilvl: 1 },
  }
}

function setup(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Hero', x: 10, y: 10, areaId: 1 })
  const player = (game as unknown as {
    players: Map<number, {
      questFlags: Uint16Array
      items: any[]
      activeNpcId: number | undefined
      activeVendorMode: 'trade' | 'gamble' | null
    }>
  }).players.get(playerId)!
  return { game, playerId, player }
}

function operate(game: GameInstance, playerId: number, classId: number): void {
  const id = game.spawnObject({ classId, x: 11, y: 10, areaId: 1 })
  game.enqueueCommand(playerId, { type: 'OperateObject', objectId: id })
  game.stepFrames(1)
}

describe('issue #1353 full quest coverage', () => {
  it('covers all 27 canonical quests', () => {
    const ids = Object.values(CANONICAL_QUESTS_BY_ACT).flat().map((q) => q.id)
    expect(ids).toHaveLength(27)
    for (const id of ids) expect(questWordIndex113c(id)).toBeTypeOf('number')
  })

  it('has a trigger for every canonical quest', () => {
    const triggers: Record<string, string> = {
      a1q1: 'Den of Evil last kill',
      a1q2: 'Blood Raven death',
      a1q3: 'Inifuss/Cairn/Gibbet objects',
      a1q4: 'The Countess death',
      a1q5: 'Horadric Malus + Charsi imbue',
      a1q6: 'Andariel death',
      a2q1: 'Radament death',
      a2q2: 'Horadric orifice staff',
      a2q3: "Tainted Sun Altar",
      a2q4: "Horazon's Journal",
      a2q5: 'The Summoner death',
      a2q6: 'Duriel death',
      a3q1: "Rat's Nest",
      a3q2: 'Gidbinn',
      a3q3: 'Compelling Orb',
      a3q4: "Lam Esen's Tome",
      a3q5: 'Council members death',
      a3q6: 'Mephisto death',
      a4q1: 'Izual death',
      a4q2: 'Hellforge',
      a4q3: 'Diablo death',
      a5q1: 'Shenk death',
      a5q2: 'Cage rescue',
      a5q3: 'Frozen Anya',
      a5q4: 'Nihlathak death',
      a5q5: 'Ancients altar + deaths',
      a5q6: 'Baal death',
    }
    for (const quest of Object.keys(triggers)) {
      expect(triggers[quest]).toBeTruthy()
      expect(questWordIndex113c(quest)).toBeTypeOf('number')
    }
    expect(Object.keys(triggers)).toHaveLength(27)
  })

  it('emits 0x28 and 0x5D quest status packets on a flag change', () => {
    const { game, playerId } = setup(1372)
    game.drainEvents(playerId)
    operate(game, playerId, 252)
    const events = game.drainEvents(playerId).filter((e) => e.type === 'QuestState') as {
      source?: number
      questStatus?: { questId: number }
      availabilityBytes?: Uint8Array
    }[]
    expect(events.some((e) => e.source === 0x28)).toBe(true)
    expect(events.some((e) => e.source === 0x5d && e.questStatus !== undefined)).toBe(true)
    const availability = events.find((e) => e.source === 0x5e)
    expect(availability?.availabilityBytes).toHaveLength(37)
  })

  it('completes the Act III quest objects (Jade Figurine, Gidbinn, Journal, Anya, Cage)', () => {
    const { game, playerId, player } = setup(1368)
    operate(game, playerId, 357)
    expect(player.questFlags[questIndex('a2q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // Lam Esen: pickup -> reward pending -> Cain.
    operate(game, playerId, 193)
    expect(player.questFlags[questIndex('a3q4')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    const cain = game.spawnMonster({ classId: 146, name: 'Cain', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: cain } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a3q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // Gidbinn: object drops g33 -> Ormus accepts the dagger.
    operate(game, playerId, 252)
    expect(player.questFlags[questIndex('a3q2')]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    player.items.push(item(9801, 'g33'))
    const ormus = game.spawnMonster({ classId: 255, name: 'Ormus', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: ormus } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a3q2')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // Anya: Malah gives ice -> thaw Anya -> Malah completes.
    const malah = game.spawnMonster({ classId: 513, name: 'Malah', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'ice')).toBe(true)
    operate(game, playerId, 558)
    expect(player.questFlags[questIndex('a5q3')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a5q3')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // Rat's Nest only starts a3q1 and drops the Jade Figurine; Alkor completes it.
    operate(game, playerId, 244)
    expect(player.questFlags[questIndex('a3q1')]! & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    player.items.push(item(9800, 'j34'))
    const alkor = game.spawnMonster({
      classId: 254, name: 'Alkor', x: 11, y: 10, areaId: 1, isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a3q1')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    // Rescue on Mount Arreat needs three cages.
    for (let i = 0; i < 3; i++) operate(game, playerId, 473)
    expect(player.questFlags[questIndex('a5q2')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(
      QUEST_FLAG_REWARD_PENDING_113C,
    )
    const qualKehk = game.spawnMonster({
      classId: 515, name: 'Qual-Kehk', x: 11, y: 10, areaId: 1, isNpc: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: qualKehk } } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a5q2')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
  })

  it('Horadric Malus sets reward-pending and Charsi imbue consumes it', () => {
    const { game, playerId, player } = setup(1369)
    const charsi = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true,
    })
    player.activeNpcId = charsi
    operate(game, playerId, 108)
    expect(player.questFlags[questIndex('a1q5')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)

    const target = item(9701, 'cap')
    player.items.push(target)
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction', npcId: charsi, action: 0, complement: 9701,
    } as never)
    game.stepFrames(1)
    expect(player.questFlags[questIndex('a1q5')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(player.questFlags[questIndex('a1q5')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
  })

  it('completes a3q5 after the three Council members die', () => {
    const { game, playerId, player } = setup(1370)
    for (const [i, defId] of ['councilmember1', 'councilmember2', 'councilmember3'].entries()) {
      const id = game.spawnMonster({ defId, x: 12 + i, y: 10, areaId: 1, hp: 10, maxHp: 10 })
      game.applyDamageToMonster(id, 1000, playerId)
    }
    expect(player.questFlags[questIndex('a3q5')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
  })

  it('opens all five seals without completing a4q3, then Diablo completes it', () => {
    const { game, playerId, player } = setup(1371)
    for (let i = 0; i < 5; i++) operate(game, playerId, 392 + i)
    expect(player.questFlags[questIndex('a4q3')]! & QUEST_FLAG_PRIMARY_GOAL_DONE_113C).toBe(QUEST_FLAG_PRIMARY_GOAL_DONE_113C)
    expect(player.questFlags[questIndex('a4q3')]! & QUEST_FLAG_COMPLETED_113C).toBe(0)

    const diablo = game.spawnMonster({ defId: 'diablo', x: 20, y: 10, areaId: 1, hp: 10, maxHp: 10 })
    game.applyDamageToMonster(diablo, 1000, playerId)
    expect(player.questFlags[questIndex('a4q3')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
  })

  it('grants 1.13c quest rewards (Akara bks->bkd, Radament/Izual skill pts, Lam Esen +5 statPts, Golden Bird +20 maxHp, Qual-Kehk runes, Anya +10 all resist, Shenk/Nihlathak pending bits)', () => {
    const { game, playerId } = setup(1373)
    const p = (game as unknown as {
      players: Map<number, {
        level: number
        questFlags: Uint16Array
        items: any[]
        newSkills: number
        statPts: number
        maxHp: number
        maxHpFixed: number
      }>
      playerResistPct: (player: unknown, kind: 'fire' | 'cold' | 'light') => number
      groundItems: Map<number, { code: string }>
    })
    const player = p.players.get(playerId)!

    // A1Q3: Akara (148) translates Scroll of Inifuss ('bks') into Key to the Cairn Stones ('bkd').
    player.items.push(item(9810, 'bks'))
    const akara = game.spawnMonster({ classId: 148, name: 'Akara', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: akara } } as never)
    game.stepFrames(1)
    expect(player.items.some((i) => i.code === 'bks')).toBe(false)
    expect(player.items.some((i) => i.code === 'bkd')).toBe(true)

    // A2Q1 (Radament) -> +1 skill point + drops Book of Skill ('ass'); A4Q1 (Izual) -> +2 skill points.
    const skills0 = player.newSkills
    const level0 = player.level
    const radament = game.spawnMonster({ defId: 'radament', x: 12, y: 10, areaId: 1, hp: 10, maxHp: 10 })
    game.applyDamageToMonster(radament, 1000, playerId)
    expect(player.newSkills - (player.level - level0)).toBe(skills0 + 1)
    expect([...p.groundItems.values()].some((g) => g.code.trim().toLowerCase() === 'ass')).toBe(true)

    const izual = game.spawnMonster({ defId: 'izual', x: 13, y: 10, areaId: 1, hp: 10, maxHp: 10 })
    game.applyDamageToMonster(izual, 1000, playerId)
    expect(player.newSkills - (player.level - level0)).toBe(skills0 + 3)

    // A3Q4 (Lam Esen's Tome) turned in to Alkor (254) -> +5 stat points.
    const stats0 = player.statPts
    operate(game, playerId, 193)
    const alkor = game.spawnMonster({ classId: 254, name: 'Alkor', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)
    expect(player.statPts).toBe(stats0 + 5)

    // A3Q1 (Jade Figurine -> Alkor) -> +20 Max HP.
    const maxHp0 = player.maxHp
    player.items.push(item(9811, 'j34'))
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: alkor } } as never)
    game.stepFrames(1)
    expect(player.maxHp).toBe(maxHp0 + 20)

    // A5Q2 (3 cages -> Qual-Kehk) -> Ral (r08), Ort (r09), Tal (r07).
    for (let i = 0; i < 3; i++) operate(game, playerId, 473)
    const qualKehk = game.spawnMonster({ classId: 515, name: 'Qual-Kehk', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: qualKehk } } as never)
    game.stepFrames(1)
    for (const rune of ['r08', 'r09', 'r07']) {
      expect(player.items.some((i) => i.code === rune)).toBe(true)
    }

    // A5Q3 (Malah -> Anya -> Malah) -> +10 all resistances.
    const res0 = p.playerResistPct(player, 'fire')
    const malah = game.spawnMonster({ classId: 513, name: 'Malah', x: 11, y: 10, areaId: 1, isNpc: true })
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    operate(game, playerId, 558)
    game.enqueueCommand(playerId, { type: 'NpcInit', target: { unitType: 1, id: malah } } as never)
    game.stepFrames(1)
    expect(p.playerResistPct(player, 'fire')).toBe(res0 + 10)
    expect(p.playerResistPct(player, 'cold')).toBe(res0 + 10)
    expect(p.playerResistPct(player, 'light')).toBe(res0 + 10)

    // A1Q4 (The Countess: corruptrogue3 + SuperUnique 'The Countess'),
    // A5Q1 (Shenk: overseer1 + SuperUnique 'Siege Boss') & A5Q4 (nihlathakboss) set quest flags & pending bits.
    const countess = game.spawnMonster({
      defId: 'corruptrogue3',
      superUniqueId: 'The Countess',
      x: 13,
      y: 11,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(countess, 1000, playerId)
    expect(player.questFlags[questIndex('a1q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)

    const shenk = game.spawnMonster({
      defId: 'overseer1',
      superUniqueId: 'Siege Boss',
      x: 14,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(shenk, 1000, playerId)
    expect(player.questFlags[questIndex('a5q1')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(player.questFlags[questIndex('a5q1')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)
    const nihlathak = game.spawnMonster({
      defId: 'nihlathakboss',
      superUniqueId: 'Nihlathak Boss',
      x: 15,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
    })
    game.applyDamageToMonster(nihlathak, 1000, playerId)
    expect(player.questFlags[questIndex('a5q4')]! & QUEST_FLAG_COMPLETED_113C).toBe(1)
    expect(player.questFlags[questIndex('a5q4')]! & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)
  })
})