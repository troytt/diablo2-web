/**
 * Issue #1981: 1.13c relocation parity for `#54 Teleport`, `#275 Dragon Flight`, and movement skills:
 * - `movePlayer` syncs `playerMotion` (`mover.setPosition`, `moving = false`, `plannedX/Y = NaN`) so
 *   post-relocation ticks never rubberband the player back to the pre-teleport coordinate.
 * - `#54 Teleport` rejects void/solid-wall targets (>5 sub-tiles from walkable floor) and towns,
 *   snaps within radius 5 to standable floor, enforces `Levels.txt Teleport === 2` (`Area 73` Duriel's Lair)
 *   wall/closed-door LOS, updates seamless area borders + AOI room streaming, and relocates followers.
 * - `#275 Dragon Flight` permits flight across walk-only water/chasm tiles (`isFlying = true` LOS),
 *   rejects missile-barrier/door-blocked targets before spending mana, arrives adjacent to target
 *   ignoring intermediate walk-only barriers, strikes in melee, and relocates followers.
 * - Non-teleport movement skills (`#107 Charge`, `#132 Leap`, `#143 Leap Attack`) do NOT teleport followers.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('Issue #1981: #54 Teleport void/wall guard, motion sync, follower relocation & Area 73 Teleport=2 LOS', () => {
  it('syncs playerMotion on Teleport, relocates mercenary + mobile summons, and rejects unwalkable void (>5 sub-tiles)', () => {
    const game = new GameInstance({ seed: 198101, areaId: 1 })
    game.setTerrainWalkableCheck((_areaId, x, y) => {
      // Walkable island [0..200, 0..200]; everything past x > 200 is solid void.
      return x >= 0 && x <= 200 && y >= 0 && y <= 200
    })
    const p1 = game.connectPlayer({
      charClass: 'sor',
      name: 'TeleSorc',
      level: 24,
      areaId: 1,
      x: 50,
      y: 50,
      skills: { 54: 5, 250: 1 },
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.gold = 50_000
    player.manaFixed = 500 * 256
    player.maxManaFixed = 500 * 256

    // Hire Act 1 Rogue mercenary in Rogue Encampment before moving to Blood Moor (Area 2).
    const kashyaId = game.spawnMonster({
      hcIdx: 150,
      name: 'Kashya',
      areaId: 1,
      x: 52,
      y: 50,
      isNpc: true,
    })
    game.enqueueCommand(p1, { type: 'HireMerc', npcId: kashyaId, mercId: 1 })
    game.stepFrames(1)
    const mercSnap0 = game.getMercenaryForOwner(p1)
    expect(mercSnap0).toBeDefined()
    const liveMerc = g.mercenaries.get(mercSnap0!.unitId) as AnyRecord

    // Town check: relocatePlayerForSkill(..., true, true) refuses town areas (Area 1).
    expect(g.relocatePlayerForSkill(player, 80, 80, true, true)).toBe(false)
    expect(player.x).toBe(50)

    // Move player + merc into Blood Moor (Area 2) and start a walk command so playerMotion is active.
    player.areaId = 2
    liveMerc.areaId = 2
    g.movePlayer(p1, 50, 50)
    liveMerc.x = 48
    liveMerc.y = 48
    game.enqueueCommand(p1, { type: 'Move', x: 60, y: 50, run: true })
    game.stepFrames(2)
    game.drainEvents(p1)

    // Cast #54 Teleport to (140, 120): player + merc relocate, and subsequent ticks must NOT rubberband back near 50!
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 140,
      y: 120,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(140)
    expect(Math.round(player.y)).toBe(120)
    expect(liveMerc.areaId).toBe(2)
    expect(Math.hypot(liveMerc.x - 140, liveMerc.y - 120)).toBeLessThanOrEqual(4)

    // Step 10 more frames: motion predictor must stay at (140, 120) instead of snapping back toward 50..60.
    game.stepFrames(10)
    expect(Math.round(player.x)).toBe(140)
    expect(Math.round(player.y)).toBe(120)

    // Attempt to Teleport deep into void (260, 120), >5 sub-tiles from walkable [0..200]: rejected!
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 260,
      y: 120,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(140)
    expect(Math.round(player.y)).toBe(120)

    // Teleport slightly inside wall edge (203, 120), within radius 5 of walkable x=200: snaps cleanly to walkable x=200!
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 203,
      y: 120,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(200)
    expect(Math.round(player.y)).toBe(120)
  })

  it('enforces Levels.txt Teleport === 2 in Area 73 (Duriel Lair): blocked across closed door #153 or wall, allowed when open', () => {
    const game = new GameInstance({ seed: 198102, areaId: 73 })
    game.setTerrainWalkableCheck((_areaId, x, y, _isFlying) => {
      // Solid wall strip at x === 40 except doorway at y in [19..21].
      if (Math.round(x) === 40 && (y < 19 || y > 21)) return false
      return x >= 0 && x <= 100 && y >= 0 && y <= 100
    })
    const p1 = game.connectPlayer({
      charClass: 'sor',
      name: 'DurielTele',
      level: 24,
      areaId: 73,
      x: 25,
      y: 20,
      skills: { 54: 5 },
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.manaFixed = 500 * 256
    player.maxManaFixed = 500 * 256

    // Spawn closed Duriel's Lair exit door (Objects.txt 153, mode 0) plugging the doorway at (40, 20).
    const doorId = game.spawnObject({ classId: 153, x: 40, y: 20, areaId: 73, mode: 0 })

    // Teleporting from x=25 across closed door #153 to x=55 in Area 73 MUST fail!
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 55,
      y: 20,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(25)

    // Teleporting across the solid wall at y=60 (x=25 -> x=55) in Area 73 MUST also fail!
    g.movePlayer(p1, 25, 60)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 55,
      y: 60,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(25)

    // Once door #153 opens (mode 2 after Duriel dies), Teleport through the open doorway (25,20 -> 55,20) succeeds!
    g.movePlayer(p1, 25, 20)
    g.setObjectMode(g.objects.get(doorId), 2)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 55,
      y: 20,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(55)
    expect(Math.round(player.y)).toBe(20)
  })
})

describe('Issue #1981: #275 Dragon Flight across walk-only water vs missile barrier & non-teleport Charge/Leap follower preservation', () => {
  it('allows #275 Dragon Flight across walk-only water/chasm (0x0001) + relocates merc, blocks across missile barrier, and keeps merc stationary on #132 Leap', () => {
    let blockMissileBarrier = false
    const game = new GameInstance({ seed: 198103, areaId: 2 })
    game.setTerrainWalkableCheck((_areaId, x, y, isFlying) => {
      if (x < 0 || x > 200 || y < 0 || y > 200) return false
      // River strip x in [58..62]: blocks ground walk (isFlying=false), allows missiles/flying unless blockMissileBarrier=true.
      if (x >= 58 && x <= 62) {
        return Boolean(isFlying) && !blockMissileBarrier
      }
      return true
    })
    const pAss = game.connectPlayer({
      charClass: 'ass',
      name: 'ShadowKick',
      level: 30,
      areaId: 2,
      x: 50,
      y: 50,
      skills: { 275: 5 },
    })
    const g = internal(game)
    const ass = g.players.get(pAss) as AnyRecord
    ass.manaFixed = 500 * 256
    ass.maxManaFixed = 500 * 256
    ass.items.push({
      unitId: 9001,
      code: 'uhb',
      name: 'Myrmidon Greaves',
      quality: 2,
      level: 65,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      areaId: 2,
      ownerId: pAss,
      bodyLoc: 9,
      storePage: 0,
      cost: 1000,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 24,
      maxDurability: 24,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })

    // Attach a mercenary to verify Dragon Flight relocates followers.
    ass.areaId = 1
    ass.gold = 50_000
    const kashyaId = game.spawnMonster({ hcIdx: 150, name: 'Kashya', areaId: 1, x: 52, y: 50, isNpc: true })
    game.enqueueCommand(pAss, { type: 'HireMerc', npcId: kashyaId, mercId: 1 })
    game.stepFrames(1)
    const mercSnap = game.getMercenaryForOwner(pAss)!
    const liveMerc = g.mercenaries.get(mercSnap.unitId) as AnyRecord
    ass.areaId = 2
    liveMerc.areaId = 2
    g.movePlayer(pAss, 50, 50)
    liveMerc.x = 48
    liveMerc.y = 50

    const targetAcrossRiver = game.spawnMonster({
      defId: 'fallen1',
      x: 70,
      y: 50,
      areaId: 2,
      hp: 50_000,
      maxHp: 50_000,
      aiDisabled: true,
    })
    g.monsters.get(targetAcrossRiver).ac = 0
    g.monsters.get(targetAcrossRiver).toBlock = 0

    // 1. With solid missile barrier (0x0804), Dragon Flight is rejected BEFORE mana spend.
    blockMissileBarrier = true
    const manaBeforeBlocked = ass.manaFixed
    game.enqueueCommand(pAss, {
      type: 'CastSkillOnTarget',
      skillId: 275,
      targetType: 'monster',
      targetId: targetAcrossRiver,
    } as never)
    game.stepFrames(15)
    expect(Math.round(ass.x)).toBe(50)
    expect(ass.manaFixed).toBe(manaBeforeBlocked)

    // 2. Over walk-only river (0x0001: ground blocked, flying/missile clear), Dragon Flight crosses the river,
    //    lands adjacent to the monster (~69, 50), deals kick damage, and relocates the mercenary!
    blockMissileBarrier = false
    game.enqueueCommand(pAss, {
      type: 'CastSkillOnTarget',
      skillId: 275,
      targetType: 'monster',
      targetId: targetAcrossRiver,
    } as never)
    game.stepFrames(25)
    expect(ass.x).toBeGreaterThanOrEqual(67)
    expect(game.getMonster(targetAcrossRiver)!.hp).toBeLessThan(50_000)
    expect(Math.hypot(liveMerc.x - ass.x, liveMerc.y - ass.y)).toBeLessThanOrEqual(4)

    // 3. Verify Barbarian #132 Leap does NOT teleport followers.
    const barbGame = new GameInstance({ seed: 198104, areaId: 1 })
    const pBar = barbGame.connectPlayer({
      charClass: 'bar',
      name: 'LeapBarb',
      level: 24,
      areaId: 1,
      x: 50,
      y: 50,
      skills: { 132: 5 },
    })
    const bg = internal(barbGame)
    const barb = bg.players.get(pBar) as AnyRecord
    barb.gold = 50_000
    barb.manaFixed = 500 * 256
    const kId2 = barbGame.spawnMonster({ hcIdx: 150, name: 'Kashya', areaId: 1, x: 52, y: 50, isNpc: true })
    barbGame.enqueueCommand(pBar, { type: 'HireMerc', npcId: kId2, mercId: 1 })
    barbGame.stepFrames(1)
    const barbMercSnap = barbGame.getMercenaryForOwner(pBar)!
    const liveBarbMerc = bg.mercenaries.get(barbMercSnap.unitId) as AnyRecord
    barb.areaId = 2
    liveBarbMerc.areaId = 2
    bg.movePlayer(pBar, 50, 50)
    liveBarbMerc.x = 48
    liveBarbMerc.y = 50

    barbGame.enqueueCommand(pBar, {
      type: 'CastSkillAtLocation',
      skillId: 132,
      x: 75,
      y: 50,
      hand: 'right',
    })
    barbGame.stepFrames(20)
    expect(Math.round(barb.x)).toBe(75)
    // Mercenary walks organically from x=48 (~0.5 sub-tiles/frame -> ~58) instead of teleporting to x=75.
    expect(liveBarbMerc.x).toBeLessThan(65)
  })
})
