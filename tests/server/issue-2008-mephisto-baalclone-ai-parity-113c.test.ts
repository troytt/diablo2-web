/**
 * Issue #2008 — 1.13c Mephisto (`#242`) & Baal Vile Effigy (`#570`) AI / Missile Parity
 *
 * Verifies against `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`) & 1.13c MPQ tables:
 * 1. `AITHINK_Fn050_Mephisto` (`0x6FCA5B60`, `0x6FCA5ED1`, `0x6FCA5F1C`) & `executeActBossAi113c`:
 *    Normal `#242 mephisto` (`difficulty === 0`) NEVER casts `#59 Blizzard` or `#346 MephFrostNova`
 *    across full `0..5` cursor cycles or standalone `executeActBossAi113c` ticks.
 * 2. Nightmare/Hell (`difficulty > 0`) & Uber (`#704`):
 *    - Unlocks `#346 MephFrostNova` (`dist < 15`; at `15 <= dist <= 30` with clear LoS, `slot 4` falls back
 *      to `#334 MephistoMissile`, NOT `#59 Blizzard`).
 *    - Forces `#59 Blizzard` whenever `terrainWalkableCheck` reports a missile barrier (`!hasMissileLos`,
 *      1.13c "Moat Trick") OR `dist > 30`.
 *    - `#59 Blizzard` spawns 1 `#158 blizzardcenter` (`MISSMODE_SrvDo10_BlizzardCenter` `0x6FC613D0`,
 *      `Range = 100`, `CollideType = 0`), which rains 1 `#159 blizzard1` shard (`Range = 9`, `Size = 2`)
 *      every 4 frames (never 5 simultaneous stacked shards on frame 1!).
 * 3. `#185 PrimeLightning` (`#170 monsterlight` on `#242`, `#680 mephlight` on `#704`):
 *    `CollideKill = 1` non-piercing bolt — terminates on a tanking Mercenary in front of the player (`0` player damage).
 * 4. `#186 PrimeBolt` (`Skills.txt #186` `calc1 = "lvl+2"`):
 *    Spawns `min(24, slvl + 2)` fanned bolts (`8` Normal, `11` NM, `15` Hell, `24` Uber cap).
 * 5. `AIBAAL_MainSkillHandler` (`0x6FCCE450` `nParam == 15`):
 *    `#570 baalclone` (Vile Effigy) spawns with `hp = Math.floor(baal.hp / 3)` and `maxHp = Math.floor(baal.maxHp / 3)`.
 */
import { describe, expect, it } from 'vitest'
import type { ServerEvent } from '../../src/netproto/index.ts'
import { executeActBossAi113c } from '../../src/server/ai/monster-ai.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getOrCreateEmbeddedFallbackRegistry } from '../../src/server/engine/game-instance/constants-and-helpers.ts'

interface MonsterView {
  unitId: number
  hcIdx: number
  x: number
  y: number
  hp: number
  maxHp: number
  cooldown: number
  skillCooldown: number
  nextAiFrame: number
  skillCursor: number
  activeBaalCloneUnitId: number
}

interface PlayerView {
  unitId: number
  x: number
  y: number
  hp: number
  maxHp: number
}

interface MercView {
  unitId: number
  ownerPlayerId: number
  areaId: number
  x: number
  y: number
  hp: number
  maxHp: number
  alive: boolean
}

interface MissileView {
  unitId: number
  missileId: number
  skillId: number
  pierce: boolean
  elemDamage: number
  elemDurationFrames: number
}

function viewGame(game: GameInstance): {
  monsters: Map<number, MonsterView>
  players: Map<number, PlayerView>
  mercenaries: Map<number, MercView>
  missiles: Map<number, MissileView>
  terrainWalkableCheck?: ((areaId: number, x: number, y: number, isMissile?: boolean) => boolean) | undefined
} {
  return game as unknown as {
    monsters: Map<number, MonsterView>
    players: Map<number, PlayerView>
    mercenaries: Map<number, MercView>
    missiles: Map<number, MissileView>
    terrainWalkableCheck?: ((areaId: number, x: number, y: number, isMissile?: boolean) => boolean) | undefined
  }
}

function readyBoss(m: MonsterView, slot: number): void {
  m.cooldown = 0
  m.skillCooldown = 0
  m.nextAiFrame = 0
  m.skillCursor = slot
}

describe('Issue #2008: 1.13c Mephisto (#242/#704) & Baal Vile Effigy (#570) AI & Missile Parity', () => {
  it('gates #59 Blizzard & #346 MephFrostNova out of Normal (#242) in both GameInstance and executeActBossAi113c', () => {
    const game = new GameInstance({ seed: 200801, areaId: 102, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'NormMephSorc',
      x: 56,
      y: 50,
      areaId: 102,
      hp: 2000,
      maxHp: 2000,
    })
    const mephId = game.spawnMonster({
      defId: 'mephisto',
      hcIdx: 242,
      classId: 242,
      x: 50,
      y: 50,
      areaId: 102,
      hp: 20000,
      maxHp: 20000,
    })
    const v = viewGame(game)
    const meph = v.monsters.get(mephId)!
    const player = v.players.get(pid)!
    game.drainEvents(pid)

    const castSkillIds: number[] = []
    for (const testDist of [6, 18, 33]) {
      player.x = 50 + testDist
      for (let slot = 0; slot < 6; slot++) {
        v.missiles.clear()
        readyBoss(meph, slot)
        game.stepFrames(1)
        for (const ev of game.drainEvents(pid)) {
          if (ev.type === 'SkillCast') {
            castSkillIds.push((ev as Extract<ServerEvent, { type: 'SkillCast' }>).skillId ?? 0)
          }
        }
        expect([...v.missiles.values()].some((m) => m.skillId === 59 || m.skillId === 346)).toBe(false)
      }
    }
    expect(castSkillIds).not.toContain(59)
    expect(castSkillIds).not.toContain(346)
    expect(new Set(castSkillIds)).toEqual(new Set([334, 185, 186, 192]))

    // Standalone `executeActBossAi113c` class-of-bug check
    const fakeMeph = { index: 1, hcIdx: 242, id: 'mephisto', x: 50, y: 50, hp: 9000, maxHp: 9000 }
    const normPicks = new Set<string>()
    const nmPicks = new Set<string>()
    for (let t = 0; t < 12; t++) {
      const n = executeActBossAi113c({ tick: t, difficulty: 'normal', monsters: [] } as never, fakeMeph as never, {
        x: 60,
        y: 50,
        hp: 500,
        alive: true,
      } as never)
      const nm = executeActBossAi113c({ tick: t, difficulty: 'nightmare', monsters: [] } as never, fakeMeph as never, {
        x: 60,
        y: 50,
        hp: 500,
        alive: true,
      } as never)
      if (n.skillId) normPicks.add(n.skillId)
      if (nm.skillId) nmPicks.add(nm.skillId)
    }
    expect(normPicks.has('blizzard')).toBe(false)
    expect(normPicks.has('frostnova')).toBe(false)
    expect(nmPicks.has('blizzard')).toBe(true)
    expect(nmPicks.has('frostnova')).toBe(true)
  })

  it('Nightmare Mephisto triggers #59 Blizzard on Moat-Trick missile barrier or dist > 30 and spawns 1 #159 shard every 4 frames via #158 blizzardcenter', () => {
    const game = new GameInstance({ seed: 200802, areaId: 102, difficulty: 1 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'MoatSorc',
      x: 70, // dist = 20 (15 <= dist <= 30)
      y: 50,
      areaId: 102,
      hp: 5000,
      maxHp: 5000,
    })
    const mephId = game.spawnMonster({
      defId: 'mephisto',
      hcIdx: 242,
      classId: 242,
      x: 50,
      y: 50,
      areaId: 102,
      hp: 30000,
      maxHp: 30000,
    })
    const v = viewGame(game)
    const meph = v.monsters.get(mephId)!
    const player = v.players.get(pid)!

    // 1) Clear LoS at dist = 20 (>= 15, <= 30): slot 4 falls back to #334 MephistoMissile (NOT #346 and NOT #59!)
    v.terrainWalkableCheck = () => true
    readyBoss(meph, 4)
    game.stepFrames(1)
    expect([...v.missiles.values()].map((m) => m.skillId)).toEqual([334])

    // 2) Moat-Trick missile barrier (`isMissile === true` blocked at x = 60): forces #59 Blizzard even on slot 0 at dist = 20!
    v.missiles.clear()
    v.terrainWalkableCheck = (_areaId, x, _y, isMissile) => !(Boolean(isMissile) && x === 60)
    readyBoss(meph, 0)
    game.stepFrames(1)
    const moatCenters = [...v.missiles.values()].filter((m) => m.missileId === 158)
    expect(moatCenters).toHaveLength(1)
    expect([...v.missiles.values()].filter((m) => m.missileId === 159)).toHaveLength(0)

    // Step 12 frames with Mephisto on cooldown: exactly 3 `#159 blizzard1` shards spawn (at +4, +8, +12 frames; first expires after 9f)
    meph.cooldown = 9999
    meph.skillCooldown = 9999
    let totalShardSpawns = 0
    game.drainEvents(pid)
    for (let f = 1; f <= 12; f++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(pid)) {
        if (ev.type === 'CreateMissile' && (ev as { missileClassId?: number }).missileClassId === 159) {
          totalShardSpawns += 1
        }
      }
    }
    expect(totalShardSpawns).toBe(3)

    // 3) Clear LoS at dist = 32 (> 30): also forces #59 Blizzard on slot 1!
    v.missiles.clear()
    v.terrainWalkableCheck = () => true
    ;(meph as unknown as { alwaysRunAi?: boolean }).alwaysRunAi = true
    player.x = Math.round(meph.x) + 32
    readyBoss(meph, 1)
    game.stepFrames(1)
    expect([...v.missiles.values()].some((m) => m.missileId === 158 && m.skillId === 59)).toBe(true)

    // 4) Embedded fallback registry (no #158 row): spawns 1 #159 shard (NOT 5 stacked shards)
    const fbGame = new GameInstance({
      seed: 200803,
      areaId: 102,
      difficulty: 1,
      registry: getOrCreateEmbeddedFallbackRegistry(),
    })
    fbGame.connectPlayer({ charClass: 'sor', name: 'FbMoat', x: 56, y: 50, areaId: 102, hp: 2000, maxHp: 2000 })
    const fbMephId = fbGame.spawnMonster({
      defId: 'mephisto',
      hcIdx: 242,
      classId: 242,
      x: 50,
      y: 50,
      areaId: 102,
      hp: 20000,
      maxHp: 20000,
    })
    const fbv = viewGame(fbGame)
    readyBoss(fbv.monsters.get(fbMephId)!, 5)
    fbGame.stepFrames(1)
    expect([...fbv.missiles.values()].filter((m) => m.skillId === 59)).toHaveLength(1)
  })

  it('#185 PrimeLightning is non-piercing (CollideKill=1) and terminates on a tanking Mercenary in front of the player', () => {
    const game = new GameInstance({ seed: 200804, areaId: 102, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'ProtectedSorc',
      x: 64,
      y: 50,
      areaId: 102,
      hp: 1000,
      maxHp: 1000,
    })
    game.hireMercenary(pid, {
      act: 2,
      subType: 2,
      name: 'Emilio',
      level: 25,
      hp: 1200,
      maxHp: 1200,
      x: 55,
      y: 50,
    })
    const mephId = game.spawnMonster({
      defId: 'mephisto',
      hcIdx: 242,
      classId: 242,
      x: 50,
      y: 50,
      areaId: 102,
      hp: 20000,
      maxHp: 20000,
    })
    const v = viewGame(game)
    const meph = v.monsters.get(mephId)!
    const player = v.players.get(pid)!
    const merc = [...v.mercenaries.values()].find((m) => m.ownerPlayerId === pid)!
    expect(merc).toBeDefined()
    merc.x = 55
    merc.y = 50
    merc.areaId = 102

    readyBoss(meph, 1) // #185 PrimeLightning
    game.stepFrames(1)
    const bolt = [...v.missiles.values()].find((m) => m.skillId === 185)!
    expect(bolt).toBeDefined()
    expect(bolt.missileId).toBe(170)
    expect(bolt.pierce).toBe(false)

    // Step 20 frames with Mephisto frozen: Mercenary absorbs the bolt and it terminates BEFORE reaching the player!
    meph.cooldown = 9999
    meph.skillCooldown = 9999
    meph.nextAiFrame = 99999
    for (let f = 0; f < 20; f++) {
      merc.x = 55
      merc.y = 50
      game.stepFrames(1)
    }
    expect(merc.hp).toBeLessThan(1200)
    expect(player.hp).toBe(1000)
    expect([...v.missiles.values()].filter((m) => m.skillId === 185)).toHaveLength(0)
  })

  it('#186 PrimeBolt spawns min(24, slvl + 2) bolts across Normal (8), Nightmare (11), Hell (15), and Uber Mephisto (24)', () => {
    const cases = [
      { diff: 0 as const, hcIdx: 242, defId: 'mephisto', expectedBolts: 8 },
      { diff: 1 as const, hcIdx: 242, defId: 'mephisto', expectedBolts: 11 },
      { diff: 2 as const, hcIdx: 242, defId: 'mephisto', expectedBolts: 15 },
      { diff: 2 as const, hcIdx: 704, defId: 'ubermephisto', expectedBolts: 24 },
    ]
    for (const c of cases) {
      const g = new GameInstance({ seed: 200810 + c.diff * 10 + c.hcIdx, areaId: 102, difficulty: c.diff })
      g.connectPlayer({ charClass: 'sor', name: 'BoltCheck', x: 60, y: 50, areaId: 102, hp: 5000, maxHp: 5000 })
      const mId = g.spawnMonster({
        defId: c.defId,
        hcIdx: c.hcIdx,
        classId: c.hcIdx,
        x: 50,
        y: 50,
        areaId: 102,
        hp: 50000,
        maxHp: 50000,
      })
      const gv = viewGame(g)
      // Prevent Uber Mephisto minion roll on this tick by pre-filling `uberSummonNextFrame`
      ;(gv.monsters.get(mId) as unknown as { uberSummonNextFrame?: number }).uberSummonNextFrame = 1000
      readyBoss(gv.monsters.get(mId)!, 2)
      g.stepFrames(1)
      const bolts = [...gv.missiles.values()].filter((m) => m.skillId === 186)
      expect(bolts).toHaveLength(c.expectedBolts)
    }
  })

  it('spawns #570 baalclone (Vile Effigy) with Math.floor(baal.hp / 3) and Math.floor(baal.maxHp / 3) per 0x6FCCE450', () => {
    const game = new GameInstance({ seed: 200805, areaId: 132, difficulty: 0 })
    game.connectPlayer({
      charClass: 'sor',
      name: 'SlayerToBe',
      x: 58,
      y: 50,
      areaId: 132,
      hp: 5000,
      maxHp: 5000,
    })
    const baalId = game.spawnMonster({
      defId: 'baalcrab',
      hcIdx: 544,
      classId: 544,
      x: 50,
      y: 50,
      areaId: 132,
      hp: 15002,
      maxHp: 30005,
    })
    const v = viewGame(game)
    const baal = v.monsters.get(baalId)!
    readyBoss(baal, 0)
    game.stepFrames(1)
    const clone = v.monsters.get(baal.activeBaalCloneUnitId)!
    expect(clone).toBeDefined()
    expect(clone.hcIdx).toBe(570)
    expect(clone.hp).toBe(Math.floor(15002 / 3)) // 5000
    expect(clone.maxHp).toBe(Math.floor(30005 / 3)) // 10001
  })
})
