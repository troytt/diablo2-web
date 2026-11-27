/**
 * Issue #1472: 1.13c mercenary hire candidate level, scaled hire cost, and resurrection cost.
 *
 * Ground truth:
 * - `samples/d2/D2Common.dll` @ `0x6FD7CCC0` (Ordinal `#10458`, `MERCS_GenerateHirelingCandidate`):
 *   - Candidate level: `L = Math.max(2, clvl - 5 + rand(5))`
 *   - Candidate hire cost: `cost = Math.max(Gold, Math.trunc(Gold * (100 + 15 * (L - baseRow.level)) / 100))`
 *   - Stat lower bounds: `hp >= 40`, `str >= 10`, `dex >= 10`, `minDmg >= 0`, `maxDmg >= 1`, `ar >= 0`, `defense >= 0`, `resist >= 0`
 * - `samples/d2/D2Common.dll` @ `0x6FD7CC60` (Ordinal `#11097`, `MERCS_GetResurrectCost`):
 *   - Resurrect cost: `cost = Math.min(50000, Math.trunc(L * L / 2) * 15)`
 * - `samples/d2/D2Common.dll` @ `0x6FDA3050` / `0x6FDA30F0` & `samples/d2/D2Game.dll` @ `0x6FCDCED0` / `0x6FCE1510`:
 *   - Expansion games strictly filter `Hireling.txt` by `version === 100`.
 */
import { describe, expect, it } from 'vitest'
import {
  HIRELING_RECORDS,
  computeMercHireCost113c,
  computeMercResurrectCost113c,
  generateHireCandidates113c,
  resolveHirelingCandidate,
  resolveHirelingStatsAtLevel,
} from '../../src/common/units/hireling-table.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1472 — 1.13c mercenary hire candidate level, hire cost, and resurrect cost', () => {
  it('D2Common 0x6FD7CCC0: clvl=30 produces candidate levels in 25..29, and clvl=3 clamps to 2', () => {
    const cands30 = generateHireCandidates113c(0x13572468, 30, 1, 1, true)
    expect(cands30.length).toBe(10)
    for (const c of cands30) {
      expect(c.level).toBeGreaterThanOrEqual(25)
      expect(c.level).toBeLessThanOrEqual(29)
      expect(c.record?.version).toBe(100)
      expect(c.nameId).toBeGreaterThanOrEqual(3411)
      expect(c.nameId).toBeLessThanOrEqual(3451)
    }

    const cands3 = generateHireCandidates113c(0x13572468, 3, 1, 1, true)
    expect(cands3.length).toBe(10)
    for (const c of cands3) {
      expect(c.level).toBe(2)
    }
  })

  it('D2Common 0x6FD7CCC0: L=80 Rogue Fire-Hell (version=100, Level=67, Gold=12500) costs 36875', () => {
    const rogueFireHell = HIRELING_RECORDS.find(
      (r) =>
        r.version === 100 &&
        r.act === 1 &&
        r.difficulty === 3 &&
        r.subType === 'Fire - Hell' &&
        r.level === 67,
    )
    expect(rogueFireHell).toBeDefined()
    expect(rogueFireHell!.hireCost).toBe(12500)

    const cost80 = computeMercHireCost113c(
      rogueFireHell!.hireCost,
      80,
      rogueFireHell!.level,
    )
    expect(cost80).toBe(36875)

    // Verify candidate evaluation at clvl=85 across seeds when L=80 and row is Fire - Hell (id=4, version=100)
    let foundFireHell80 = false
    for (let seed = 1; seed < 200; seed++) {
      const cand = resolveHirelingCandidate({ nameId: 3411, seed }, 83, 2, 0, true, 'ENG')
      expect(cand.record?.version).toBe(100)
      if (cand.subTypeId === 4 && cand.level === 80) {
        expect(cand.cost).toBe(36875)
        foundFireHell80 = true
        break
      }
    }
    expect(foundFireHell80).toBe(true)
  })

  it('D2Common 0x6FD7CC60 (#11097): resurrect cost is 3000 at L=20 and capped at 50000 at L=90', () => {
    expect(computeMercResurrectCost113c(0)).toBe(0)
    expect(computeMercResurrectCost113c(1)).toBe(0)
    expect(computeMercResurrectCost113c(2)).toBe(30)
    expect(computeMercResurrectCost113c(10)).toBe(750)
    expect(computeMercResurrectCost113c(20)).toBe(3000)
    expect(computeMercResurrectCost113c(81)).toBe(49200)
    expect(computeMercResurrectCost113c(82)).toBe(50000)
    expect(computeMercResurrectCost113c(90)).toBe(50000)
  })

  it('resolveHirelingStatsAtLevel enforces 1.13c stat lower bounds (hp>=40, str>=10, dex>=10, minDmg>=0, maxDmg>=1)', () => {
    for (const act of [1, 2, 3, 5] as const) {
      const row = HIRELING_RECORDS.find((r) => r.version === 100 && r.act === act && r.difficulty === 1)!
      const stats = resolveHirelingStatsAtLevel(row.subTypeId, act, 1, 1, true)!
      expect(stats).toBeDefined()
      expect(stats.record.version).toBe(100)
      expect(stats.hp).toBeGreaterThanOrEqual(40)
      expect(stats.str).toBeGreaterThanOrEqual(10)
      expect(stats.dex).toBeGreaterThanOrEqual(10)
      expect(stats.minDmg).toBeGreaterThanOrEqual(0)
      expect(stats.maxDmg).toBeGreaterThanOrEqual(1)
      expect(stats.ar).toBeGreaterThanOrEqual(0)
      expect(stats.defense).toBeGreaterThanOrEqual(0)
      expect(stats.resist).toBeGreaterThanOrEqual(0)
    }
  })

  it('GameInstance handleNpcHireList, handleNpcHire, and handleMercResurrect apply 1.13c candidate level, hire cost, and revive cost', () => {
    const game = new GameInstance({ seed: 1472, areaId: 1, difficulty: 2 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'Tester',
      level: 83,
      x: 10,
      y: 10,
      areaId: 1,
    })
    const internal = game as unknown as {
      players: Map<number, { gold: number; level: number; activeNpcId: number | undefined }>
      mercenaries: Map<number, { level: number; alive: boolean; hp: number; subType: number }>
    }
    const player = internal.players.get(playerId)!
    player.level = 83
    player.gold = 200_000

    const kashya = game.spawnMonster({
      classId: 150,
      name: 'Kashya',
      x: 11,
      y: 10,
      areaId: 1,
      isNpc: true,
    })
    player.activeNpcId = kashya

    // 1. Request hire list (0x38 action=3 -> 0x4F + 0x4E)
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, {
      type: 'NpcEntityAction',
      npcId: kashya,
      action: 3,
      complement: 0,
    } as never)
    game.stepFrames(1)

    const hireEvents = game
      .drainEvents(playerId)
      .filter((e) => e.type === 'Merc' && (e as { kind?: string }).kind === 'hireList') as Array<{
      nameId?: number
      value?: number
    }>
    // 1 start marker + 10 candidates
    expect(hireEvents.length).toBe(11)
    expect(hireEvents[0]?.nameId).toBeUndefined()
    const firstCandPacket = hireEvents[1]!
    expect(firstCandPacket.nameId).toBeGreaterThanOrEqual(3411)
    expect(firstCandPacket.nameId).toBeLessThanOrEqual(3451)
    expect(typeof firstCandPacket.value).toBe('number')

    // Evaluate expected candidate via client/shared 0x6FD7CCC0 resolver
    const expectedCand = resolveHirelingCandidate(
      { nameId: firstCandPacket.nameId!, seed: firstCandPacket.value! },
      83,
      2,
      0,
      true,
      'ENG',
    )
    expect(expectedCand.level).toBeGreaterThanOrEqual(78)
    expect(expectedCand.level).toBeLessThanOrEqual(82)

    // 2. Hire the first candidate via MercHire (0x36)
    const goldBeforeHire = player.gold
    game.enqueueCommand(playerId, {
      type: 'MercHire',
      npcId: kashya,
      mercId: firstCandPacket.nameId!,
    } as never)
    game.stepFrames(1)

    const merc = [...internal.mercenaries.values()][0]!
    expect(merc).toBeDefined()
    expect(merc.level).toBe(expectedCand.level)
    expect(merc.subType).toBe(expectedCand.subTypeId)
    expect(goldBeforeHire - player.gold).toBe(expectedCand.cost)

    // 3. Test resurrection cost at L=20 (3000 gold) and L=90 (50000 gold cap)
    merc.level = 20
    merc.alive = false
    merc.hp = 0
    const goldBeforeRevive20 = player.gold
    game.enqueueCommand(playerId, { type: 'MercResurrect', npcId: kashya } as never)
    game.stepFrames(1)
    expect(merc.alive).toBe(true)
    expect(goldBeforeRevive20 - player.gold).toBe(3000)

    merc.level = 90
    merc.alive = false
    merc.hp = 0
    const goldBeforeRevive90 = player.gold
    game.enqueueCommand(playerId, { type: 'MercResurrect', npcId: kashya } as never)
    game.stepFrames(1)
    expect(merc.alive).toBe(true)
    expect(goldBeforeRevive90 - player.gold).toBe(50000)
  })
})
