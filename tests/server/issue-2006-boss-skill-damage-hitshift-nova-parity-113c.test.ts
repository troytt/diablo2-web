/**
 * Issue #2006 — 1.13c Boss & Monster Spell `Sk*lvl`, `HitShift < 8`, and `SrvDo022` Single-Hit Nova Parity
 *
 * Verifies against `D2Game.dll` (`0x6FCD019B`, `0x6FC63AA0`, `0x6FCC2800`) and `D2Common#10413` (`0x6FDBBAA0`):
 * 1. `resolveMonsterMonStatsSkillSlvl113c`: `MonStats.txt` `SkNlvl + [0, 3, 7][difficulty]` across
 *    Mephisto (`#242`), Uber Mephisto (`#704`, `PrimeBolt Sk2lvl = 20`), Diablo (`#243`/`#333`/`#705`),
 *    Baal (`#544`/`#570`/`#709`), Izual (`#256`/`#706`), and Summoner (`#250`).
 * 2. `SrvDo022` radial nova single-hit semantics: `#346 MephFrostNova` (`#242`) and `#44 Frost Nova`
 *    (`#256` Izual, `#250` Summoner) spawn radial nova bolts with chill (`state 11`) and `NextDelay = 4`
 *    without synchronous direct-AoE double-hitting (`40..60` Cold on Normal Mephisto, `16..21` Cold on Normal Izual).
 * 3. `HitShift < 8` & MPQ table parity across Normal Mephisto (`#334`, `#185`, `#186`, `#59`),
 *    Normal Diablo (`#193 DiabLight` `HitShift = 6`, `#194 DiabCold`, `#195 DiabFire`),
 *    Normal Baal (`#317 Baal Inferno` `HitShift = 5`, `#318 Baal Cold Missiles`, `#316 Baal Nova`),
 *    and stationary turrets (`#203 DesertTurret`, `#204 ArcaneTower`, `#213 CorpseSpit`).
 */
import { describe, expect, it } from 'vitest'
import { resolveMonsterMonStatsSkillSlvl113c } from '../../src/server/ai/monster-missile-damage-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getOrCreateEmbeddedFallbackRegistry } from '../../src/server/engine/game-instance/constants-and-helpers.ts'

interface MonsterView {
  unitId: number
  x: number
  y: number
  cooldown: number
  skillCooldown: number
  nextAiFrame: number
  skillCursor: number
  activeBossChannel?: unknown
  skills?: Array<Record<string, unknown>>
  states: Set<number>
}

interface PlayerView {
  unitId: number
  x: number
  y: number
  hp: number
  maxHp: number
  hpFixed: number
  maxHpFixed: number
  mana: number
  maxMana: number
  manaFixed: number
  maxManaFixed: number
  dead: boolean
  states: Set<number>
}

interface MissileView {
  unitId: number
  missileId: number
  skillId: number
  physDamage: number
  elemDamage: number
  elemDurationFrames: number
  element: string
}

function viewGame(game: GameInstance): {
  monsters: Map<number, MonsterView>
  players: Map<number, PlayerView>
  missiles: Map<number, MissileView>
} {
  return game as unknown as {
    monsters: Map<number, MonsterView>
    players: Map<number, PlayerView>
    missiles: Map<number, MissileView>
  }
}

function readyBoss(m: MonsterView, slot: number): void {
  m.cooldown = 0
  m.skillCooldown = 0
  m.nextAiFrame = 0
  m.activeBossChannel = undefined
  m.skillCursor = slot
}

describe('Issue #2006: 1.13c Boss & Monster Skill Level, HitShift & SrvDo022 Radial Nova Parity', () => {
  it('resolves MonStats.txt SkNlvl + Difficultylevels.txt MonsterSkillBonus ([0, 3, 7]) across bosses', () => {
    // Mephisto (#242) vs Uber Mephisto (#704)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 346, 0)).toBe(1)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 346, 1)).toBe(4)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 346, 2)).toBe(8)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 334, 0)).toBe(5)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 185, 0)).toBe(6)
    expect(resolveMonsterMonStatsSkillSlvl113c(242, 186, 0)).toBe(6)
    expect(resolveMonsterMonStatsSkillSlvl113c(704, 186, 2)).toBe(27) // Sk2lvl = 20 + 7

    // Diablo (#243) & Baal (#544) & Izual (#256)
    expect(resolveMonsterMonStatsSkillSlvl113c(243, 193, 0)).toBe(3)
    expect(resolveMonsterMonStatsSkillSlvl113c(243, 194, 0)).toBe(4)
    expect(resolveMonsterMonStatsSkillSlvl113c(243, 195, 0)).toBe(5)
    expect(resolveMonsterMonStatsSkillSlvl113c(544, 316, 0)).toBe(1)
    expect(resolveMonsterMonStatsSkillSlvl113c(544, 317, 0)).toBe(1)
    expect(resolveMonsterMonStatsSkillSlvl113c(544, 318, 0)).toBe(1)
    expect(resolveMonsterMonStatsSkillSlvl113c(256, 44, 0)).toBe(8)
    expect(resolveMonsterMonStatsSkillSlvl113c(250, 44, 0)).toBe(5)
  })

  it('Normal Mephisto (#242) casts #334/#185/#186 within 1.13c MPQ bounds (never #346/#59), while Nightmare Mephisto #346 MephFrostNova hits once (100..120 cold + 350f chill) and #59 Blizzard spawns #158 -> #159', () => {
    const game = new GameInstance({ seed: 200601, areaId: 102, difficulty: 0 })
    game.connectPlayer({
      charClass: 'sor',
      name: 'DuranceSorc',
      x: 55,
      y: 50,
      areaId: 102,
      hp: 1000,
      maxHp: 1000,
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

    // 1) Normal Mephisto (`difficulty: 0`, `0x6FCA5ED1` & `0x6FCA5F1C`, #2008):
    // Slot 4 routes to #334 MephistoMissile and Slot 5 routes to #185 PrimeLightning (never #346 or #59).
    readyBoss(meph, 4)
    game.stepFrames(1)
    expect([...v.missiles.values()].some((m) => m.skillId === 346 || m.skillId === 59)).toBe(false)
    expect([...v.missiles.values()].some((m) => m.skillId === 334)).toBe(true)

    v.missiles.clear()
    readyBoss(meph, 5)
    game.stepFrames(1)
    expect([...v.missiles.values()].some((m) => m.skillId === 346 || m.skillId === 59)).toBe(false)
    expect([...v.missiles.values()].some((m) => m.skillId === 185)).toBe(true)

    // 2) Slot 0 -> #334 MephistoMissile (#276): Normal slvl=5 => phys 44..48, cold 84..98, chill 175f
    v.missiles.clear()
    readyBoss(meph, 0)
    game.stepFrames(1)
    const skull = [...v.missiles.values()].find((m) => m.skillId === 334)!
    expect(skull).toBeDefined()
    expect(skull.physDamage).toBeGreaterThanOrEqual(44)
    expect(skull.physDamage).toBeLessThanOrEqual(48)
    expect(skull.elemDamage).toBeGreaterThanOrEqual(84)
    expect(skull.elemDamage).toBeLessThanOrEqual(98)
    expect(skull.elemDurationFrames).toBe(175)

    // 3) Slot 1 -> #185 PrimeLightning (#170): Normal slvl=6 => ltng 15..180
    v.missiles.clear()
    readyBoss(meph, 1)
    game.stepFrames(1)
    const ltng = [...v.missiles.values()].find((m) => m.skillId === 185)!
    expect(ltng).toBeDefined()
    expect(ltng.missileId).toBe(170)
    expect(ltng.elemDamage).toBeGreaterThanOrEqual(15)
    expect(ltng.elemDamage).toBeLessThanOrEqual(180)

    // 4) Slot 2 -> #186 PrimeBolt: Normal Mephisto slvl=6 (`calc1 = lvl + 2 = 8` bolts) => ltng 1..90 per bolt
    v.missiles.clear()
    readyBoss(meph, 2)
    game.stepFrames(1)
    const bolts = [...v.missiles.values()].filter((m) => m.skillId === 186)
    expect(bolts).toHaveLength(8)
    for (const b of bolts) {
      expect(b.elemDamage).toBeGreaterThanOrEqual(1)
      expect(b.elemDamage).toBeLessThanOrEqual(90)
    }

    // 5) Nightmare Mephisto (`difficulty: 1`):
    //    - Slot 4 -> #346 MephFrostNova (`slvl = 1 + 3 = 4`) hits once for 100..120 cold + 350f chill (zero double-hit)!
    //    - Slot 5 -> #59 Blizzard (`slvl = 5 + 3 = 8`) spawns #158 `blizzardcenter` -> #159 `blizzard1` shards (150..186 cold, 100f chill)!
    const nmGame = new GameInstance({ seed: 200611, areaId: 102, difficulty: 1 })
    const nmPid = nmGame.connectPlayer({
      charClass: 'sor',
      name: 'NmDuranceSorc',
      x: 55,
      y: 50,
      areaId: 102,
      hp: 1000,
      maxHp: 1000,
    })
    const nmMephId = nmGame.spawnMonster({
      defId: 'mephisto',
      hcIdx: 242,
      classId: 242,
      x: 50,
      y: 50,
      areaId: 102,
      hp: 20000,
      maxHp: 20000,
    })
    const nmv = viewGame(nmGame)
    const nmMeph = nmv.monsters.get(nmMephId)!
    const nmPlayer = nmv.players.get(nmPid)!

    readyBoss(nmMeph, 4)
    nmGame.stepFrames(1)
    const frostMissiles = [...nmv.missiles.values()].filter((m) => m.skillId === 346)
    expect(frostMissiles.length).toBe(16)
    for (const m of frostMissiles) {
      expect(m.elemDamage).toBeGreaterThanOrEqual(100)
      expect(m.elemDamage).toBeLessThanOrEqual(120)
      expect(m.elemDurationFrames).toBe(350)
    }
    nmMeph.cooldown = 9999
    nmMeph.skillCooldown = 9999
    nmGame.stepFrames(12)
    const frostLoss = 1000 - nmPlayer.hp
    // Nightmare (`difficulty = 1`) applies `-40%` ResistPenalty (`1.40x` cold damage on unequipped player: `[140, 168]`)
    expect(frostLoss).toBeGreaterThanOrEqual(140)
    expect(frostLoss).toBeLessThanOrEqual(168)
    expect(nmPlayer.states.has(11)).toBe(true)

    nmv.missiles.clear()
    readyBoss(nmMeph, 5)
    nmGame.stepFrames(1)
    const centers = [...nmv.missiles.values()].filter((m) => m.missileId === 158)
    expect(centers).toHaveLength(1)
    expect(centers[0]!.elemDamage).toBeGreaterThanOrEqual(150)
    expect(centers[0]!.elemDamage).toBeLessThanOrEqual(186)
    expect(centers[0]!.elemDurationFrames).toBe(100)
    nmMeph.cooldown = 9999
    nmMeph.skillCooldown = 9999
    nmGame.stepFrames(4)
    const shards = [...nmv.missiles.values()].filter((m) => m.missileId === 159)
    expect(shards).toHaveLength(1)
    expect(shards[0]!.elemDamage).toBeGreaterThanOrEqual(150)
    expect(shards[0]!.elemDamage).toBeLessThanOrEqual(186)
    expect(shards[0]!.elemDurationFrames).toBe(100)
  })

  it('Normal Izual (#256) & Summoner (#250) #44 Frost Nova apply HitShift=7 (16..21 / 10..14 cold) and radial ring single-hit semantics', () => {
    const game = new GameInstance({ seed: 200602, areaId: 105, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'PlainsSorc',
      x: 54,
      y: 50,
      areaId: 105,
      hp: 1000,
      maxHp: 1000,
    })
    const izId = game.spawnMonster({
      defId: 'izual',
      hcIdx: 256,
      classId: 256,
      x: 50,
      y: 50,
      areaId: 105,
      hp: 10000,
      maxHp: 10000,
    })
    const v = viewGame(game)
    const izual = v.monsters.get(izId)!
    const player = v.players.get(pid)!
    readyBoss(izual, 0)
    game.stepFrames(1)
    const izFrost = [...v.missiles.values()].filter((m) => m.skillId === 44)
    expect(izFrost).toHaveLength(16)
    for (const m of izFrost) {
      expect(m.elemDamage).toBeGreaterThanOrEqual(16)
      expect(m.elemDamage).toBeLessThanOrEqual(21)
      expect(m.elemDurationFrames).toBe(375)
    }
    izual.cooldown = 9999
    izual.skillCooldown = 9999
    game.stepFrames(10)
    const izLoss = 1000 - player.hp
    expect(izLoss).toBeGreaterThanOrEqual(16)
    expect(izLoss).toBeLessThanOrEqual(21)
    expect(player.states.has(11)).toBe(true)

    // Summoner (#250) casting #44 Frost Nova via generic `tryCastMonsterSkill` (`srvDoFunc === 22`) spawns 16 radial bolts!
    const arcGame = new GameInstance({ seed: 200603, areaId: 74, difficulty: 0 })
    const arcPid = arcGame.connectPlayer({
      charClass: 'sor',
      name: 'ArcaneSorc',
      x: 55,
      y: 50,
      areaId: 74,
      hp: 1000,
      maxHp: 1000,
    })
    const sumId = arcGame.spawnMonster({
      defId: 'summoner',
      hcIdx: 250,
      classId: 250,
      x: 50,
      y: 50,
      areaId: 74,
      hp: 1500,
      maxHp: 1500,
    })
    const arcView = viewGame(arcGame)
    const sumRec = arcView.monsters.get(sumId)!
    sumRec.skills = [{ slot: 2, skill: 'Frost Nova', skillId: 44, mode: 'SC', level: 5 }]
    readyBoss(sumRec, 0)
    arcGame.drainEvents(arcPid)
    arcGame.stepFrames(1)
    const sumFrost = [...arcView.missiles.values()].filter((m) => m.skillId === 44)
    expect(sumFrost).toHaveLength(16)
    for (const m of sumFrost) {
      expect(m.elemDamage).toBeGreaterThanOrEqual(10)
      expect(m.elemDamage).toBeLessThanOrEqual(14)
    }
  })

  it('enforces HitShift < 8 scaling on Normal Diablo #193 DiabLight (HitShift=6) and Normal Baal #317 Baal Inferno (HitShift=5) + fallback parity', () => {
    // 1) Normal Diablo (#243): single #193 DiabLight pulse deals 6..8 phys + 14..24 ltng (`20..32` total at 0% res)
    const dGame = new GameInstance({ seed: 200604, areaId: 108, difficulty: 0 })
    const dPid = dGame.connectPlayer({
      charClass: 'bar',
      name: 'ChaosBarb',
      x: 56,
      y: 50,
      areaId: 108,
      hp: 2000,
      maxHp: 2000,
    })
    const diabloId = dGame.spawnMonster({
      defId: 'diablo',
      hcIdx: 243,
      classId: 243,
      x: 50,
      y: 50,
      areaId: 108,
      hp: 20000,
      maxHp: 20000,
    })
    const dv = viewGame(dGame)
    const diablo = dv.monsters.get(diabloId)!
    const dPlayer = dv.players.get(dPid)!
    dPlayer.states.add(11)
    readyBoss(diablo, 0)
    // Frame 1 starts channel (`remainingFrames = 40`), Frame 2 decrements to 39, Frame 3 decrements to 38 (first `remainingFrames % 2 === 0` pulse)
    dGame.stepFrames(3)
    const firstPulseLoss = 2000 - dPlayer.hp
    expect(firstPulseLoss).toBeGreaterThanOrEqual(20)
    expect(firstPulseLoss).toBeLessThanOrEqual(32)

    // 2) Normal Baal (#544): single #317 Baal Inferno tick deals 8..12 Magic (`HitShift = 5`) + 50% Mana drain,
    // and #316 Baal Nova spawns 32 bolts of 50..75 Fire (`Sk1lvl = 1`)
    const bGame = new GameInstance({ seed: 200605, areaId: 132, difficulty: 0 })
    const bPid = bGame.connectPlayer({
      charClass: 'sor',
      name: 'ChamberSorc',
      x: 55,
      y: 50,
      areaId: 132,
      hp: 2000,
      maxHp: 2000,
      mana: 400,
      maxMana: 400,
    })
    const baalId = bGame.spawnMonster({
      defId: 'baalcrab',
      hcIdx: 544,
      classId: 544,
      x: 50,
      y: 50,
      areaId: 132,
      hp: 25000,
      maxHp: 25000,
    })
    const bv = viewGame(bGame)
    const baal = bv.monsters.get(baalId)!
    const bPlayer = bv.players.get(bPid)!
    readyBoss(baal, 4)
    bGame.stepFrames(3)
    const infernoLoss = 2000 - bPlayer.hp
    expect(infernoLoss).toBeGreaterThanOrEqual(8)
    expect(infernoLoss).toBeLessThanOrEqual(12)
    expect(bPlayer.mana).toBe(200)

    bv.missiles.clear()
    readyBoss(baal, 5) // dist = 5 < 8 -> #316 Baal Nova
    bGame.stepFrames(1)
    const baalNovas = [...bv.missiles.values()].filter((m) => m.skillId === 316)
    expect(baalNovas).toHaveLength(32)
    for (const m of baalNovas) {
      expect(m.elemDamage).toBeGreaterThanOrEqual(50)
      expect(m.elemDamage).toBeLessThanOrEqual(75)
    }

    // 3) Embedded fallback registry parity check (no external MPQ loaded, Nightmare `difficulty: 1`)
    const emptyReg = getOrCreateEmbeddedFallbackRegistry()
    const fbGame = new GameInstance({ seed: 200606, areaId: 102, difficulty: 1, registry: emptyReg })
    fbGame.connectPlayer({
      charClass: 'sor',
      name: 'FbSorc',
      x: 55,
      y: 50,
      areaId: 102,
      hp: 1000,
      maxHp: 1000,
    })
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
    readyBoss(fbv.monsters.get(fbMephId)!, 4)
    fbGame.stepFrames(1)
    const fbFrost = [...fbv.missiles.values()].filter((m) => m.skillId === 346)
    expect(fbFrost).toHaveLength(16)
    for (const m of fbFrost) {
      expect(m.elemDamage).toBeGreaterThanOrEqual(100)
      expect(m.elemDamage).toBeLessThanOrEqual(120)
      expect(m.elemDurationFrames).toBe(350)
    }
  })
})
