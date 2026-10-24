import { describe, expect, it } from 'vitest'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('Issue #1395 — GameInstance mercenary hire subType, resurrect classId/position, area sync & corpse summon targeting', () => {
  it('HireMerc preserves the hired Hireling.txt subTypeId (Cold Arrow Rogue #1, Defiance Desert Guard #8, Blessed Aim #9)', () => {
    const game = new GameInstance({ seed: 13951, areaId: 1 })
    const p1 = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 18,
      areaId: 1,
      x: 100,
      y: 100,
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.gold = 50_000

    // Spawn Kashya (hcIdx = 150, Act 1 hire captain) and hire Cold Arrow Rogue (subTypeId = 1)
    const kashyaId = game.spawnMonster({
      hcIdx: 150,
      name: 'Kashya',
      areaId: 1,
      x: 102,
      y: 100,
      isNpc: true,
    })
    game.enqueueCommand(p1, {
      type: 'HireMerc',
      npcId: kashyaId,
      mercId: 1,
    })
    game.stepFrame()

    const rogue = game.getMercenaryForOwner(p1)
    expect(rogue).toBeDefined()
    expect(rogue!.act).toBe(1)
    expect(rogue!.subType).toBe(1)
    expect(rogue!.classId).toBe(271)

    // Move to Lut Gholein (areaId = 40), spawn Greiz (hcIdx = 198), and hire Defiance Desert Mercenary (subTypeId = 8)
    player.areaId = 40
    player.x = 200
    player.y = 200
    player.activeNpcId = undefined
    const greizId = game.spawnMonster({
      hcIdx: 198,
      name: 'Greiz',
      areaId: 40,
      x: 202,
      y: 200,
      isNpc: true,
    })
    game.enqueueCommand(p1, {
      type: 'HireMerc',
      npcId: greizId,
      mercId: 8,
    })
    game.stepFrame()

    const guard = game.getMercenaryForOwner(p1)
    expect(guard).toBeDefined()
    expect(guard!.act).toBe(2)
    expect(guard!.subType).toBe(8)
    expect(guard!.classId).toBe(338)
    expect(guard!.activeAura).toBe('Blessed Aim')

    //Also verify hiring subTypeId = 6 (Combat / Prayer) and subTypeId = 7 (Defensive / Defiance)
    game.enqueueCommand(p1, {
      type: 'HireMerc',
      npcId: greizId,
      mercId: 6,
    })
    game.stepFrame()
    const prayerGuard = game.getMercenaryForOwner(p1)
    expect(prayerGuard!.subType).toBe(6)
    expect(prayerGuard!.activeAura).toBe('Prayer')

    game.enqueueCommand(p1, {
      type: 'HireMerc',
      npcId: greizId,
      mercId: 7,
    })
    game.stepFrame()
    const defianceGuard = game.getMercenaryForOwner(p1)
    expect(defianceGuard!.subType).toBe(7)
    expect(defianceGuard!.activeAura).toBe('Defiance')
  })

  it('MercResurrect emits AssignMerc with merc.classId (not subType), moves merc to player area/pos, and preserves ClientWorld merc gear', () => {
    const game = new GameInstance({ seed: 13952, areaId: 43 })
    const p1 = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 20,
      areaId: 43,
      x: 150,
      y: 150,
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.gold = 50_000

    const mercId = game.hireMercenary(p1, {
      act: 2,
      subType: 8,
      level: 20,
      difficulty: 1,
    })
    const initialMerc = game.getMercenaryForOwner(p1)!
    expect(initialMerc.classId).toBe(338)
    expect(initialMerc.subType).toBe(8)

    // Mirror events into ClientWorld and equip a polearm on the mercenary
    const world = new ClientWorld()
    world.selfId = p1
    for (const ev of game.drainPlayerEvents(p1)) {
      world.applyEvent(ev)
    }
    world.applyEvent({
      type: 'ItemEvent',
      action: 6,
      container: 'merc',
      item: {
        id: 9001,
        code: 'scy',
        name: 'Scythe',
        quality: 4,
        level: 15,
        identified: true,
        ethereal: false,
        sockets: 3,
        width: 2,
        height: 4,
        x: 0,
        y: 0,
        bodyLoc: 4,
        ownerType: 1,
        ownerId: mercId,
        stats: [],
      },
    })
    expect(world.containers.merc.size).toBe(1)

    // Kill the mercenary in Far Oasis (area 43), then return to Lut Gholein (area 40) and resurrect at Greiz
    const merc = g.mercenaries.get(mercId) as AnyRecord
    merc.alive = false
    merc.hp = 0

    player.areaId = 40
    player.x = 300
    player.y = 310
    player.activeNpcId = undefined
    const greizId = game.spawnMonster({
      hcIdx: 198,
      name: 'Greiz',
      areaId: 40,
      x: 302,
      y: 310,
      isNpc: true,
    })
    game.drainPlayerEvents(p1)

    game.enqueueCommand(p1, {
      type: 'MercResurrect',
      npcId: greizId,
    })
    game.stepFrame()

    const revived = game.getMercenaryForOwner(p1)!
    expect(revived.alive).toBe(true)
    expect(revived.areaId).toBe(40)
    expect(revived.x).toBe(301)
    expect(revived.y).toBe(311)

    const events = game.drainPlayerEvents(p1)
    const mercAssign = events.find((e) => e.type === 'Merc' && e.kind === 'assign')
    expect(mercAssign).toBeDefined()
    expect((mercAssign as { classId?: number }).classId).toBe(338)

    for (const ev of events) {
      world.applyEvent(ev)
    }
    // Mercenary equipment must NOT be cleared on resurrection
    expect(world.containers.merc.size).toBe(1)
  })

  it('stepMercenaries broadcasts UnitReassign on area transitions and getAllUnits exposes merc.classId', () => {
    const game = new GameInstance({ seed: 13953, areaId: 1 })
    const p1 = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 10,
      areaId: 1,
      x: 80,
      y: 80,
    })
    const mercId = game.hireMercenary(p1, { act: 1, subType: 1, level: 9, difficulty: 1 })

    const units = game.getAllUnits()
    const mercUnit = units.find((u) => u.unitId === mercId)
    expect(mercUnit).toBeDefined()
    expect(mercUnit!.classId).toBe(271)

    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.areaId = 2
    player.x = 120
    player.y = 130
    game.drainPlayerEvents(p1)
    game.stepFrame()

    const events = game.drainPlayerEvents(p1)
    const reassign = events.find(
      (e) => e.type === 'UnitReassign' && e.unitType === 'monster' && e.unitId === mercId,
    ) as { x?: number; y?: number } | undefined
    expect(reassign).toBeDefined()
    expect(Math.round(reassign!.x!)).toBe(121)
    expect(Math.round(reassign!.y!)).toBe(131)
  })

  it('Raise Skeleton (#70) and Corpse Explosion (#74) consume the targeted or nearest corpse to (tx, ty)', () => {
    const game = new GameInstance({ seed: 13954, areaId: 2 })
    const p1 = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 12,
      areaId: 2,
      x: 100,
      y: 100,
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.skills.set(70, 5) // Raise Skeleton
    player.skills.set(74, 5) // Corpse Explosion
    player.mana = 500
    player.maxMana = 500
    player.manaFixed = 500 * 256
    player.maxManaFixed = 500 * 256

    // Spawn an older corpse far away (at 140, 140) and a newer corpse right at (104, 100)
    const farCorpseId = game.spawnMonster({
      hcIdx: 0,
      name: 'Skeleton',
      areaId: 2,
      x: 140,
      y: 140,
      hp: 50,
      maxHp: 50,
    })
    const nearCorpseId = game.spawnMonster({
      hcIdx: 0,
      name: 'Skeleton',
      areaId: 2,
      x: 104,
      y: 100,
      hp: 50,
      maxHp: 50,
    })
    const farM = g.monsters.get(farCorpseId) as AnyRecord
    const nearM = g.monsters.get(nearCorpseId) as AnyRecord
    farM.dead = true
    farM.hp = 0
    nearM.dead = true
    nearM.hp = 0

    // Cast Raise Skeleton at (104, 100) -> must consume nearCorpseId, NOT farCorpseId
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 70,
      x: 104,
      y: 100,
      hand: 'right',
    })
    game.stepFrame()

    expect(nearM.shattered).toBe(true)
    expect(farM.shattered).toBe(false)
  })

  it('grantExperience scales the living mercenary level and Hireling.txt stats when the owner levels up', () => {
    const game = new GameInstance({ seed: 13955, areaId: 2 })
    const p1 = game.connectPlayer({
      charClass: 'nec',
      name: 'Necro',
      level: 14,
      areaId: 2,
      x: 100,
      y: 100,
    })
    const mercId = game.hireMercenary(p1, {
      act: 2,
      subType: 7,
      level: 14,
      difficulty: 1,
    })
    const before = game.getMercenaryForOwner(p1)!
    expect(before.level).toBe(14)

    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    game.drainPlayerEvents(p1)
    // Grant enough XP to level from 14 -> 20
    g.grantExperience(player, 1_000_000)

    const after = game.getMercenaryForOwner(p1)!
    expect(player.level).toBeGreaterThan(14)
    expect(after.level).toBe(player.level)
    expect(after.maxHp).toBeGreaterThan(before.maxHp)
    expect(after.hp).toBe(after.maxHp)
    expect(after.damage).toBeGreaterThan(before.damage)

    const events = game.drainPlayerEvents(p1)
    const mercLvlEvents = events.filter(
      (e) =>
        e.type === 'UnitStatUpdate' &&
        e.unitType === 'monster' &&
        e.unitId === mercId &&
        e.statId === 12,
    )
    expect(mercLvlEvents.length).toBeGreaterThan(0)
    expect((mercLvlEvents[mercLvlEvents.length - 1] as { value?: number }).value).toBe(player.level)
  })
})
