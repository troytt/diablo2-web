import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  questWordIndex113c,
} from '../../src/server/engine/quests-113c.ts'

describe('Issue #2021 — A5Q2 Rescue on Mount Arreat prisondoor (#434) pen breach & Overseer Whip (#295) SuicideMinion stat morph', () => {
  it('breaches Objects.txt 473 pens when guarding prisondoor (#434) units die, spawns rescue portal (#189), rescues act5pow (#534), and grants Ral/Ort/Tal at Qual-Kehk (#515)', () => {
    const game = new GameInstance({ seed: 202101, areaId: 111, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ArreatSorc',
      x: 20,
      y: 20,
      areaId: 111,
      level: 26,
    })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          areaId: number
          questFlags: Uint16Array
          items: Array<{ unitId: number; code: string }>
        }
      >
      objects: Map<
        number,
        {
          unitId: number
          classId: number
          areaId: number
          x: number
          y: number
          mode: number
          useCount: number
        }
      >
      monsters: Map<
        number,
        {
          unitId: number
          hcIdx: number
          areaId: number
          dead: boolean
          align: number
        }
      >
    }
    const player = internal.players.get(pid)!
    const a5q2Idx = questWordIndex113c('a5q2')!

    const penCoords: readonly [number, number][] = [
      [40, 20],
      [90, 20],
      [140, 20],
    ]
    const penIds: number[] = []
    const doorIds: number[] = []
    for (const [px, py] of penCoords) {
      penIds.push(game.spawnObject({ classId: 473, x: px, y: py, areaId: 111 }))
      for (let k = 0; k < 5; k += 1) {
        game.spawnMonster({
          classId: 534,
          defId: 'act5pow',
          x: px + (k % 2),
          y: py + Math.floor(k / 2) - 1,
          areaId: 111,
          align: 1,
          hp: 200,
          maxHp: 200,
        })
      }
      doorIds.push(
        game.spawnMonster({
          classId: 434,
          defId: 'prisondoor',
          x: px + 4,
          y: py,
          areaId: 111,
          hp: 100,
          maxHp: 100,
        }),
      )
    }

    // Breach pen 1: S2C 0x5D extra = 10 remaining, 5 POWs rescued, portal 189 spawned, cage mode = 2.
    game.drainEvents(pid)
    game.applyDamageToMonster(doorIds[0]!, 5000, pid)
    const ev1 = game.drainEvents(pid)
    const qs1 = ev1.find(
      (e) =>
        e.type === 'QuestState' &&
        (e as { source?: number }).source === 0x5d,
    ) as { questStatus?: { questId: number; filterStatus: number; extra: number } } | undefined
    expect(qs1?.questStatus).toEqual({
      questId: 0x20,
      alertFlags: 0x20,
      filterStatus: 2,
      extra: 10,
    })
    expect(internal.objects.get(penIds[0]!)?.mode).toBe(2)
    expect(internal.objects.get(penIds[0]!)?.useCount).toBe(1)
    expect(
      [...internal.objects.values()].filter((o) => o.classId === 189 && o.mode === 2).length,
    ).toBe(1)
    expect(
      [...internal.monsters.values()].filter((m) => m.hcIdx === 534 && !m.dead).length,
    ).toBe(10)

    // Breach pen 2: S2C 0x5D extra = 5 remaining.
    game.drainEvents(pid)
    game.applyDamageToMonster(doorIds[1]!, 5000, pid)
    const ev2 = game.drainEvents(pid)
    const qs2 = ev2.find(
      (e) =>
        e.type === 'QuestState' &&
        (e as { source?: number }).source === 0x5d,
    ) as { questStatus?: { extra: number } } | undefined
    expect(qs2?.questStatus?.extra).toBe(5)
    expect(
      [...internal.monsters.values()].filter((m) => m.hcIdx === 534 && !m.dead).length,
    ).toBe(5)

    // Breach pen 3: all 15 rescued -> STARTED | REWARD_PENDING | 0x0020.
    game.applyDamageToMonster(doorIds[2]!, 5000, pid)
    const w36 = player.questFlags[a5q2Idx]!
    expect(w36 & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
    expect(w36 & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)
    expect(w36 & 0x0020).toBe(0x0020)
    expect(
      [...internal.monsters.values()].filter((m) => m.hcIdx === 534 && !m.dead).length,
    ).toBe(0)

    // Subsequent Objects.txt 473 spawns in Area 111 initialize already opened (mode = 2, useCount = 1).
    const postPen = game.spawnObject({ classId: 473, x: 180, y: 20, areaId: 111 })
    expect(internal.objects.get(postPen)?.mode).toBe(2)
    expect(internal.objects.get(postPen)?.useCount).toBe(1)

    // Talking to Qual-Kehk (#515) grants Ral (r08), Ort (r09), Tal (r07) and completes a5q2.
    const qualKehk = game.spawnMonster({
      classId: 515,
      name: 'Qual-Kehk',
      x: 21,
      y: 20,
      areaId: 111,
      isNpc: true,
    })
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: qualKehk } } as never)
    game.stepFrames(1)
    expect(player.questFlags[a5q2Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.items.map((i) => i.code)).toEqual(expect.arrayContaining(['r08', 'r09', 'r07']))
  })

  it('scales Qual-Kehk rune tiers by dead act5pow (#534) count (14 -> 2 runes, 12..13 -> 1 rune, <12 -> fails)', () => {
    const runScenario = (deadCount: number) => {
      const game = new GameInstance({ seed: 202110 + deadCount, areaId: 111, difficulty: 0 })
      const pid = game.connectPlayer({
        charClass: 'bar',
        name: 'Rescuer',
        x: 10,
        y: 10,
        areaId: 111,
        level: 28,
      })
      const internal = game as unknown as {
        players: Map<
          number,
          { questFlags: Uint16Array; items: Array<{ code: string }> }
        >
        monsters: Map<number, { hp: number; dead: boolean }>
        applyMonsterDeath: (
          monster: unknown,
          creditedPlayer: unknown,
          channel: 'phys',
        ) => void
      }
      const player = internal.players.get(pid)!
      const a5q2Idx = questWordIndex113c('a5q2')!

      for (let d = 0; d < deadCount; d += 1) {
        const powId = game.spawnMonster({
          classId: 534,
          defId: 'act5pow',
          x: 12 + d,
          y: 12,
          areaId: 111,
          align: 1,
          hp: 10,
          maxHp: 10,
        })
        // Friendly-fire immunity: player damage does not harm align=1 POWs; demon kills invoke applyMonsterDeath.
        expect(game.applyDamageToMonster(powId, 100, pid)).toBe(false)
        const powRec = internal.monsters.get(powId)!
        powRec.hp = 0
        internal.applyMonsterDeath(powRec, undefined, 'phys')
      }

      for (let i = 0; i < 3; i += 1) {
        const px = 40 + i * 40
        game.spawnObject({ classId: 473, x: px, y: 10, areaId: 111 })
        const doorId = game.spawnMonster({
          classId: 434,
          defId: 'prisondoor',
          x: px + 3,
          y: 10,
          areaId: 111,
          hp: 50,
          maxHp: 50,
        })
        game.applyDamageToMonster(doorId, 500, pid)
      }

      const preWord = player.questFlags[a5q2Idx]!
      const qualKehk = game.spawnMonster({
        classId: 515,
        name: 'Qual-Kehk',
        x: 11,
        y: 10,
        areaId: 111,
        isNpc: true,
      })
      game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: qualKehk } } as never)
      game.stepFrames(1)
      return {
        preWord,
        postWord: player.questFlags[a5q2Idx]!,
        runes: player.items
          .map((i) => i.code)
          .filter((c) => c === 'r08' || c === 'r09' || c === 'r07'),
      }
    }

    // 1 dead -> 14 rescued -> 0x0040 -> r08, r09
    const r14 = runScenario(1)
    expect(r14.preWord & 0x0040).toBe(0x0040)
    expect(r14.runes).toEqual(['r08', 'r09'])

    // 2 dead -> 13 rescued -> 0x0080 -> r08 only
    const r13 = runScenario(2)
    expect(r13.preWord & 0x0080).toBe(0x0080)
    expect(r13.runes).toEqual(['r08'])

    // 4 dead -> 11 rescued -> fails (< 12), no REWARD_PENDING and 0 runes
    const r11 = runScenario(4)
    expect(r11.preWord & QUEST_FLAG_REWARD_PENDING_113C).toBe(0)
    expect(r11.runes).toEqual([])
  })

  it('spares friendly align=1 Highland Barbarians (#522) and POWs (#534) during Shenk boss death minionPurge', () => {
    const game = new GameInstance({ seed: 202120, areaId: 110, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ShenkSlayer',
      x: 20,
      y: 20,
      areaId: 110,
      level: 26,
    })
    const monsters = (
      game as unknown as {
        monsters: Map<number, { dead: boolean; align: number; hcIdx: number }>
      }
    ).monsters

    const shenkId = game.spawnMonster({
      classId: 479,
      defId: 'overseer1',
      name: 'Shenk the Overseer',
      superUniqueId: 'Shenk the Overseer',
      umodIds: [22],
      x: 24,
      y: 20,
      areaId: 110,
      hp: 100,
      maxHp: 100,
    })
    const hostileMinionId = game.spawnMonster({
      classId: 453,
      defId: 'minion1',
      x: 25,
      y: 20,
      areaId: 110,
      align: 0,
      hp: 200,
      maxHp: 200,
    })
    const friendlyBarbId = game.spawnMonster({
      classId: 522,
      defId: 'act5barb1',
      x: 26,
      y: 20,
      areaId: 110,
      align: 1,
      hp: 200,
      maxHp: 200,
    })
    const friendlyPowId = game.spawnMonster({
      classId: 534,
      defId: 'act5pow',
      x: 26,
      y: 21,
      areaId: 110,
      align: 1,
      hp: 200,
      maxHp: 200,
    })

    game.applyDamageToMonster(shenkId, 5000, pid)
    expect(monsters.get(shenkId)?.dead).toBe(true)
    expect(monsters.get(hostileMinionId)?.dead).toBe(true)
    expect(monsters.get(friendlyBarbId)?.dead).toBe(false)
    expect(monsters.get(friendlyPowId)?.dead).toBe(false)
  })

  it('recomputes canonical MonStats + MonLvl stats when Overseer Whip (#295) morphs a boss-minion minion1 (#453) into suicideminion1 (#461)', () => {
    let morphedSample:
      | {
          rank: string
          hp: number
          maxHp: number
          minDmg: number
          maxDmg: number
          velocity: number
          runSpeed: number
          playerHpLost: number
        }
      | undefined

    for (let t = 0; t < 40 && morphedSample === undefined; t += 1) {
      const game = new GameInstance({ seed: 202130 + t * 997, areaId: 110, difficulty: 0 })
      const pid = game.connectPlayer({
        charClass: 'sor',
        name: 'WhipTest',
        x: 12,
        y: 11,
        areaId: 110,
        hp: 400,
        maxHp: 400,
      })
      const overseerId = game.spawnMonster({
        hcIdx: 479,
        defId: 'overseer1',
        x: 10,
        y: 10,
        areaId: 110,
      })
      const minionId = game.spawnMonster({
        hcIdx: 453,
        defId: 'minion1',
        rank: 'minion',
        x: 12,
        y: 10,
        areaId: 110,
        hp: 600,
        maxHp: 662,
      })
      const internal = game as unknown as {
        players: Map<number, { hp: number; maxHp: number }>
        monsters: Map<
          number,
          {
            unitId: number
            hcIdx: number
            rank: string
            hp: number
            maxHp: number
            minDmg: number
            maxDmg: number
            velocity: number
            runSpeed: number
            cooldown: number
            skillCooldown: number
          }
        >
        tryCastMonsterUtilitySkill: (
          m: unknown,
          tgt: { x: number; y: number },
          d: number,
          healOrWhipOnly?: boolean,
        ) => boolean
      }
      const overseer = internal.monsters.get(overseerId)!
      const minion = internal.monsters.get(minionId)!
      overseer.cooldown = 0
      overseer.skillCooldown = 0
      internal.tryCastMonsterUtilitySkill(overseer, { x: 25, y: 10 }, 15, true)

      if (minion.hcIdx === 461) {
        const player = internal.players.get(pid)!
        const hpBefore = player.hp
        game.applyDamageToMonster(minionId, 5000, pid)
        const hpAfter = player.hp
        morphedSample = {
          rank: minion.rank,
          hp: minion.maxHp, // hp was set to maxHp on morph before detonation
          maxHp: minion.maxHp,
          minDmg: minion.minDmg,
          maxDmg: minion.maxDmg,
          velocity: minion.velocity,
          runSpeed: minion.runSpeed,
          playerHpLost: hpBefore - hpAfter,
        }
      }
    }

    expect(morphedSample).toBeDefined()
    expect(morphedSample!.rank).toBe('normal')
    // Normal suicideminion1 (mlvl 31, L-HP = 142, minHP = 38, maxHP = 57) rolls 53..80 HP (never 662).
    expect(morphedSample!.maxHp).toBeGreaterThanOrEqual(50)
    expect(morphedSample!.maxHp).toBeLessThanOrEqual(85)
    // Normal suicideminion1 (mlvl 31, L-DM = 20, A1MinD = 100, A1MaxD = 150) scales to 20..30 (never 100..150).
    expect(morphedSample!.minDmg).toBeGreaterThanOrEqual(18)
    expect(morphedSample!.maxDmg).toBeLessThanOrEqual(35)
    expect(morphedSample!.velocity).toBe(10)
    expect(morphedSample!.runSpeed).toBe(10)
    expect(morphedSample!.playerHpLost).toBeGreaterThan(0)
    expect(morphedSample!.playerHpLost).toBeLessThanOrEqual(40)
  })
})
