/**
 * Issue #1359 — drop context: SuperUniques TC, per-player act-boss quest kill,
 * and full MF/GF aggregation (charms / sockets).
 */
import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface Entry {
  unitId: number
  code: string
  location: string
  stats: Map<number, number>
  socketedItems: Entry[]
}
interface PlayerRecord {
  questFlags: Uint16Array
  items: Entry[]
}

function connect(game: GameInstance, name = 'Farmer'): number {
  return game.connectPlayer({ charClass: 'pal', name, x: 10, y: 10, areaId: 1 })
}

function record(game: GameInstance, id: number): PlayerRecord {
  return (game as unknown as { players: Map<number, PlayerRecord> }).players.get(id)!
}

function statEntry(unitId: number, location: string, mf: number, children: Entry[] = []): Entry {
  return {
    unitId,
    code: location === 'inventory' ? 'cm1' : 'cap',
    location,
    stats: new Map([[80, mf]]),
    socketedItems: children,
  }
}

describe('issue #1359 drop context', () => {
  it('stores the SuperUniques id on the boss record', () => {
    const game = new GameInstance({ seed: 1359, areaId: 1 })
    connect(game)
    const [bossId] = game.spawnSuperUnique({ superUniqueIndex: 6, x: 30, y: 30, areaId: 1 })
    const boss = (game as unknown as {
      monsters: Map<number, { superUniqueId?: string }>
    }).monsters.get(bossId)!
    expect(boss.superUniqueId?.toLowerCase()).toContain('countess')
  })

  it('marks the act-boss quest flag on the killer for the first kill', () => {
    const game = new GameInstance({ seed: 1360, areaId: 1 })
    const playerId = connect(game, 'BossKiller')
    const bossId = game.spawnMonster({
      defId: 'andariel',
      x: 12,
      y: 10,
      areaId: 1,
      hp: 10,
      maxHp: 10,
      experience: 1,
    })
    game.applyDamageToMonster(bossId, 1000, playerId)
    // a1q6 title qstsa1q6 -> word 6, bit 0 completed.
    expect(record(game, playerId).questFlags[6]! & 1).toBe(1)
  })

  it('counts equipped, charm and socketed MF in the drop context', () => {
    const game = new GameInstance({ seed: 1361, areaId: 1 })
    const playerId = connect(game, 'MfFarmer')
    const r = record(game, playerId)
    r.items.push(statEntry(9001, 'equipped', 25))
    r.items.push(statEntry(9002, 'inventory', 10, [statEntry(9003, 'socket', 15)]))
    const total = (game as unknown as {
      sumPlayerItemStat: (p: PlayerRecord, statId: number) => number
    }).sumPlayerItemStat(r, 80)
    expect(total).toBe(50)
  })

  it('deduplicates wornSetPieceCounts for duplicate set rings while applying aprops per worn ring and ignoring inactive swap slots 11/12', () => {
    const game = new GameInstance({ seed: 1362, areaId: 1 })
    const playerId = connect(game, 'AngelicDualRing')
    const r = record(game, playerId)

    const makeSetPiece = (unitId: number, code: string, setItemId: number, bodyLoc: number): Entry =>
      ({
        unitId,
        code,
        location: 'equipped',
        bodyLoc,
        stats: new Map<number, number>(),
        socketedItems: [],
        rawItemData: { setItemId },
      }) as unknown as Entry

    const tables = getEmbeddedDropTables()
    const findSetId = (name: string): number =>
      tables.sets.items.entries.find((e) => e.index === name)!.id

    // Angelic Halo: aprop2a = mag% 50 (requires 3 distinct Angelic Raiment pieces)
    const haloId = findSetId('Angelic Halo')
    const wingsId = findSetId('Angelic Wings')
    const mantleId = findSetId('Angelic Mantle')
    const sickleId = findSetId('Angelic Sickle')

    const ringLeft = makeSetPiece(9101, 'rin', haloId, 6)
    const ringRight = makeSetPiece(9102, 'rin', haloId, 7)
    const amulet = makeSetPiece(9103, 'amu', wingsId, 2)
    const offhandSickle = makeSetPiece(9104, 'sbr', sickleId, 11) // inactive weapon swap slot 11

    // 2x Angelic Halo + Angelic Wings + inactive offhand Angelic Sickle = only 2 active distinct pieces!
    // Duplicate rings must NOT unlock the 3-piece aprop2a, and slot 11 must be ignored even with empty hands 4/5.
    r.items.push(ringLeft, ringRight, amulet, offhandSickle)
    const sumStat = (p: PlayerRecord, statId: number): number =>
      (game as unknown as { sumPlayerItemStat: (pl: PlayerRecord, s: number) => number }).sumPlayerItemStat(
        p,
        statId,
      )
    expect(sumStat(r, 80)).toBe(0)

    // Equipping Angelic Mantle (bodyLoc 3) brings distinct worn Angelic pieces to 3:
    // Both Angelic Halo rings now activate their green aprop2a (+50% MF each = +100% MF total).
    r.items.push(makeSetPiece(9105, 'rng', mantleId, 3))
    expect(sumStat(r, 80)).toBe(100)
  })

  it('scales Champion/Unique monster level from Levels.txt MonLvl*Ex when spawned in Nightmare/Hell and attributes merc kills via merc unitId', () => {
    const game = new GameInstance({ seed: 1363, areaId: 108, difficulty: 2 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'HellSorc', x: 50, y: 50, areaId: 108 })
    const r = record(game, playerId)
    r.items.push(statEntry(9201, 'equipped', 120))

    // Spawn Champion and Unique in Area 108 (Chaos Sanctuary, Hell MonLvl3Ex = 85) without explicit spec.areaLevel
    const champId = game.spawnMonster({
      defId: 'doomknight1',
      classId: 310,
      areaId: 108,
      x: 52,
      y: 50,
      rank: 'champion',
      hp: 10,
      maxHp: 10,
    })
    const uniqueId = game.spawnMonster({
      defId: 'doomknight1',
      classId: 310,
      areaId: 108,
      x: 54,
      y: 50,
      rank: 'unique',
      hp: 10,
      maxHp: 10,
    })
    const monsters = (game as unknown as {
      monsters: Map<number, { level: number; lastHitByMerc?: boolean }>
    }).monsters
    expect(monsters.get(champId)!.level).toBe(87) // 85 + 2
    expect(monsters.get(uniqueId)!.level).toBe(88) // 85 + 3

    // Hire mercenary and equip MF gear (including per-level MF stat 240 and socketed Topaz)
    const mercId = game.hireMercenary(playerId, { act: 2, subType: 1, level: 80, difficulty: 3 })!
    const merc = (game as unknown as {
      mercenaries: Map<number, { level: number; equipment: Entry[] }>
    }).mercenaries.get(mercId)!
    merc.equipment.push({
      unitId: 9202,
      code: 'usk',
      location: 'equipped',
      stats: new Map([
        [80, 30],
        [240, 8], // +1% MF per level -> +80% MF at level 80
      ]),
      socketedItems: [statEntry(9203, 'socket', 24)],
    })

    // Kill Champion via mercId as attacker -> lastHitByMerc = true, total MF = 120 (player) + 134 (merc) = 254
    game.applyDamageToMonster(champId, 500, mercId)
    expect(monsters.get(champId)!.lastHitByMerc).toBe(true)
    const sumMerc = (game as unknown as {
      sumMercItemStat: (m: typeof merc, s: number) => number
    }).sumMercItemStat(merc, 80)
    expect(sumMerc).toBe(134)
  })
})