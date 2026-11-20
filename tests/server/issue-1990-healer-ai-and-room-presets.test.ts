import { describe, expect, it } from 'vitest'
import { monaiProfile113c } from '../../src/common/units/monai-113c.ts'
import type { LocalAreaLevelRequest } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { QUEST_FLAG_COMPLETED_113C, setQuestFlag113c } from '../../src/server/engine/quests-113c.ts'

interface TestMonsterRecord {
  readonly unitId: number
  readonly hcIdx: number
  readonly areaId: number
  readonly isUndead: boolean
  hp: number
  maxHp: number
  cooldown: number
  skillCooldown: number
}

function getMonsters(game: GameInstance): Map<number, TestMonsterRecord> {
  return (game as unknown as { monsters: Map<number, TestMonsterRecord> }).monsters
}

describe('Issue #1990: 1.13c monster healer AI parity & deferred room-preset activation', () => {
  it('forbids self-healing across all #179 ZakarumHeal / #182 Bestow casters (D2Game.dll 0x6FCD37B9)', () => {
    for (const spec of [
      { hcIdx: 229, defId: 'radament' },
      { hcIdx: 101, defId: 'unraveler1' },
      { hcIdx: 238, defId: 'cantor1' },
      { hcIdx: 345, defId: 'councilmember1' },
      { hcIdx: 312, defId: 'doomknight3' },
    ]) {
      const game = new GameInstance({ seed: 199000 + spec.hcIdx, areaId: 49 })
      const playerId = game.connectPlayer({
        charClass: 'sor',
        name: 'Tester',
        x: 24,
        y: 10,
        areaId: 49,
        hp: 2000,
        maxHp: 2000,
      })
      const healerId = game.spawnMonster({
        hcIdx: spec.hcIdx,
        defId: spec.defId,
        x: 10,
        y: 10,
        areaId: 49,
        hp: 40,
        maxHp: 400,
      })
      const healer = getMonsters(game).get(healerId)!
      healer.cooldown = 0
      healer.skillCooldown = 0
      game.drainEvents(playerId)
      ;(
        game as unknown as {
          tryCastMonsterUtilitySkill: (
            m: TestMonsterRecord,
            t: { x: number; y: number },
            d: number,
            healOrWhipOnly?: boolean,
          ) => boolean
        }
      ).tryCastMonsterUtilitySkill(healer, { x: 24, y: 10 }, 14, true)
      expect(healer.hp).toBe(40)

      // Step 60 AI frames: without allies, zero #179/#182 SkillCast may fire (only small passive DamageRegen).
      game.stepFrames(60)
      const events = game.drainEvents(playerId)
      expect(
        events.some(
          (e) =>
            e.type === 'SkillCast' &&
            ((e as { skillId?: number }).skillId === 179 ||
              (e as { skillId?: number }).skillId === 182),
        ),
      ).toBe(false)
      expect(healer.hp).toBeLessThan(60)
    }
  })

  it('restricts GreaterMummy (#182 Bestow) to Undead allies and removes bogus healRangeParam from FetishShaman', () => {
    expect(monaiProfile113c('FetishShaman').healRangeParam).toBeUndefined()
    expect(monaiProfile113c('GreaterMummy').healRangeParam).toBe(4)

    const game = new GameInstance({ seed: 199010, areaId: 49 })
    game.connectPlayer({ charClass: 'sor', name: 'Tester', x: 30, y: 10, areaId: 49 })
    const mummyId = game.spawnMonster({
      hcIdx: 101,
      defId: 'unraveler1',
      x: 10,
      y: 10,
      areaId: 49,
    })
    const nonUndeadId = game.spawnMonster({
      hcIdx: 15,
      defId: 'fallen1',
      x: 12,
      y: 10,
      areaId: 49,
      hp: 10,
      maxHp: 200,
    })
    const monsters = getMonsters(game)
    const mummy = monsters.get(mummyId)!
    const fallen = monsters.get(nonUndeadId)!
    expect(fallen.isUndead).toBe(false)

    const castOnFallen = (
      game as unknown as {
        tryCastMonsterUtilitySkill: (
          m: TestMonsterRecord,
          t: { x: number; y: number },
          d: number,
          healOrWhipOnly?: boolean,
        ) => boolean
      }
    ).tryCastMonsterUtilitySkill(mummy, { x: 30, y: 10 }, 20, true)
    expect(castOnFallen).toBe(false)
    expect(fallen.hp).toBe(10)

    const skeletonId = game.spawnMonster({
      hcIdx: 11,
      defId: 'skeleton1',
      x: 12,
      y: 11,
      areaId: 49,
      hp: 20,
      maxHp: 200,
    })
    const skeleton = monsters.get(skeletonId)!
    expect(skeleton.isUndead).toBe(true)
    const castOnSkeleton = (
      game as unknown as {
        tryCastMonsterUtilitySkill: (
          m: TestMonsterRecord,
          t: { x: number; y: number },
          d: number,
          healOrWhipOnly?: boolean,
        ) => boolean
      }
    ).tryCastMonsterUtilitySkill(mummy, { x: 30, y: 10 }, 20, true)
    expect(castOnSkeleton).toBe(true)
    expect(skeleton.hp).toBeGreaterThan(20)
  })

  it('applies HighPriest #179 ZakarumHeal 15+5*slvl..50% formula and aip3 spell cooldown (125 frames Normal)', () => {
    const game = new GameInstance({ seed: 199020, areaId: 83 })
    game.connectPlayer({ charClass: 'sor', name: 'Tester', x: 35, y: 10, areaId: 83 })
    const priestId = game.spawnMonster({
      hcIdx: 345,
      defId: 'councilmember1',
      x: 10,
      y: 10,
      areaId: 83,
    })
    const allyId = game.spawnMonster({
      hcIdx: 346,
      defId: 'councilmember2',
      x: 40,
      y: 10, // 30 subtiles away (inside HighPriest 50-subtile heal scan radius)
      areaId: 83,
      hp: 100,
      maxHp: 1000,
    })
    const monsters = getMonsters(game)
    const priest = monsters.get(priestId)!
    const ally = monsters.get(allyId)!

    const casted = (
      game as unknown as {
        tryCastMonsterUtilitySkill: (
          m: TestMonsterRecord,
          t: { x: number; y: number },
          d: number,
          healOrWhipOnly?: boolean,
        ) => boolean
      }
    ).tryCastMonsterUtilitySkill(priest, { x: 35, y: 10 }, 25, true)
    expect(casted).toBe(true)
    // slvl >= 1 => 20%..50% of 1000 = +200..+500 HP
    expect(ally.hp).toBeGreaterThanOrEqual(300)
    expect(ally.hp).toBeLessThanOrEqual(600)
    expect(priest.skillCooldown).toBeGreaterThanOrEqual(75)
  })

  it('casts Overseer #291 Healing Vortex (Missile #425) on allies at <=50% HP within 20 subtiles', () => {
    const game = new GameInstance({ seed: 199030, areaId: 110 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'Tester',
      x: 35,
      y: 10,
      areaId: 110,
    })
    const overseerId = game.spawnMonster({
      hcIdx: 479,
      defId: 'overseer1',
      x: 10,
      y: 10,
      areaId: 110,
      hp: 50,
      maxHp: 500,
    })
    const injuredAllyId = game.spawnMonster({
      hcIdx: 436,
      defId: 'deathmauler1',
      x: 26, // 16 subtiles (> whip range 14, <= vortex range 20)
      y: 10,
      areaId: 110,
      hp: 40,
      maxHp: 100,
    })
    const monsters = getMonsters(game)
    const overseer = monsters.get(overseerId)!
    const injuredAlly = monsters.get(injuredAllyId)!
    game.drainEvents(playerId)

    const casted = (
      game as unknown as {
        tryCastMonsterUtilitySkill: (
          m: TestMonsterRecord,
          t: { x: number; y: number },
          d: number,
          healOrWhipOnly?: boolean,
        ) => boolean
      }
    ).tryCastMonsterUtilitySkill(overseer, { x: 35, y: 10 }, 25, false)
    expect(casted).toBe(true)
    expect(overseer.hp).toBe(50) // never self-heals
    expect(injuredAlly.hp).toBeGreaterThanOrEqual(50)
    const events = game.drainEvents(playerId)
    expect(
      events.some(
        (e) => e.type === 'SkillCast' && (e as { skillId?: number }).skillId === 291,
      ),
    ).toBe(true)
    expect(
      events.some(
        (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 425,
      ),
    ).toBe(true)
  })

  it('activates deferred room presets on Arcane teleporter pads (192) and purges Town Nihlathak (514) after a5q3', () => {
    // 1. Arcane Sanctuary Teleporter Pad (Objects.txt 192, OperateFn 27) activates destination room presets
    const arcaneGame = new GameInstance({
      seed: 199040,
      areaId: 74,
      resolveAreaBootstrap: ({ areaId }: LocalAreaLevelRequest) =>
        areaId === 74
          ? {
              areaId: 74,
              spawnX: 20,
              spawnY: 20,
              rooms: [
                { areaId: 74, tileX: 0, tileY: 0 },
                { areaId: 74, tileX: 40, tileY: 0 },
              ],
              roomRects: [
                { index: 0, x: 0, y: 0, w: 80, h: 80, seed: 101 },
                { index: 1, x: 200, y: 0, w: 80, h: 80, seed: 102 },
              ],
              adjacentAreaIds: [],
              isWalkable: () => true,
              objects: [
                { classId: 192, x: 22, y: 20, areaId: 74, mode: 0, isWaypoint: false },
                { classId: 192, x: 220, y: 20, areaId: 74, mode: 0, isWaypoint: false },
              ],
              monsters: [{ classId: 38, x: 224, y: 20, areaId: 74 }],
              warps: [],
            }
          : null,
    })
    const pid = arcaneGame.connectPlayer({
      charClass: 'sor',
      name: 'Warper',
      x: 20,
      y: 20,
      areaId: 74,
    })
    // Before operating pad 192, room 1 (x=200..280) is unactivated -> ghost (hcIdx 38) not spawned yet
    expect([...getMonsters(arcaneGame).values()].some((m) => m.hcIdx === 38)).toBe(false)
    const padNearStart = [
      ...(arcaneGame as unknown as { objects: Map<number, { unitId: number; x: number; classId: number }> }).objects.values(),
    ].find((o) => o.classId === 192 && o.x < 50)!
    arcaneGame.enqueueCommand(pid, {
      type: 'OperateObject',
      objectId: padNearStart.unitId,
    })
    arcaneGame.stepFrames(2)
    expect([...getMonsters(arcaneGame).values()].some((m) => m.hcIdx === 38)).toBe(true)

    // 2. Harrogath (Area 109) unactivated Town Nihlathak (514) preset is purged once a5q3 completes
    const harrogathGame = new GameInstance({
      seed: 199041,
      areaId: 109,
      resolveAreaBootstrap: ({ areaId }: LocalAreaLevelRequest) =>
        areaId === 109
          ? {
              areaId: 109,
              spawnX: 20,
              spawnY: 20,
              rooms: [
                { areaId: 109, tileX: 0, tileY: 0 },
                { areaId: 109, tileX: 40, tileY: 0 },
              ],
              roomRects: [
                { index: 0, x: 0, y: 0, w: 80, h: 80, seed: 201 },
                { index: 1, x: 200, y: 0, w: 80, h: 80, seed: 202 },
              ],
              adjacentAreaIds: [],
              isWalkable: () => true,
              objects: [],
              monsters: [{ classId: 514, x: 220, y: 20, areaId: 109, isNpc: true, isVendor: true }],
              warps: [],
            }
          : null,
    })
    const hPid = harrogathGame.connectPlayer({
      charClass: 'sor',
      name: 'Hero',
      x: 20,
      y: 20,
      areaId: 109,
    })
    const playerRec = (
      harrogathGame as unknown as { players: Map<number, { questFlags: Uint16Array }> }
    ).players.get(hPid)!
    setQuestFlag113c(playerRec.questFlags, 'a5q3', QUEST_FLAG_COMPLETED_113C)
    ;(
      harrogathGame as unknown as { syncHarrogathA5Q3State113c: (p?: unknown) => void }
    ).syncHarrogathA5Q3State113c(playerRec)

    // Move player into room 1 (x=220, y=20) where 514 was queued -> 514 must NOT spawn!
    harrogathGame.movePlayer(hPid, 220, 20)
    harrogathGame.stepFrames(2)
    expect([...getMonsters(harrogathGame).values()].some((m) => m.hcIdx === 514)).toBe(false)
    expect([...getMonsters(harrogathGame).values()].filter((m) => m.hcIdx === 512)).toHaveLength(1)
  })
})
