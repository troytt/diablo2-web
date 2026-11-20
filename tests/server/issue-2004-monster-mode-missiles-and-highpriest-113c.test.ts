import { describe, expect, it } from 'vitest'
import { monaiProfile113c } from '../../src/common/units/monai-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface TestMonsterView {
  readonly unitId: number
  readonly hcIdx: number
  readonly ai: string
  readonly isRanged: boolean
  x: number
  y: number
  hp: number
  maxHp: number
  skillCooldown: number
  corpseAmmo: number
}

interface TestMissileView {
  readonly id: number
  readonly classId: number
  readonly skillId: number
  readonly ownerId: number
}

function getMonsters(game: GameInstance): Map<number, TestMonsterView> {
  return (game as unknown as { monsters: Map<number, TestMonsterView> }).monsters
}

function getMissiles(game: GameInstance): Map<number, TestMissileView> {
  return (game as unknown as { missiles: Map<number, TestMissileView> }).missiles
}

describe('Issue #2004: 1.13c RangedType=0 modeMissiles sweep & HighPriest / VenomLord / Regurgitator / SandMaggotQueen AI parity', () => {
  it('does not promote RangedType=0 monsters with skill/special modeMissiles to isRanged, while preserving MonStats RangedType=1 and MonAI ranged=true rows', () => {
    expect(monaiProfile113c('HighPriest')).toMatchObject({ family: 'melee', ranged: false })
    expect(monaiProfile113c('Regurgitator')).toMatchObject({ family: 'melee', ranged: false })

    const game = new GameInstance({ seed: 200401, areaId: 83, difficulty: 0 })
    const c1 = game.spawnMonster({ hcIdx: 345, defId: 'councilmember1', x: 10, y: 10, areaId: 83 })
    const c2 = game.spawnMonster({ hcIdx: 346, defId: 'councilmember2', x: 12, y: 10, areaId: 83 })
    const c3 = game.spawnMonster({ hcIdx: 347, defId: 'councilmember3', x: 14, y: 10, areaId: 83 })
    const bartuc = game.spawnMonster({ hcIdx: 557, defId: 'baalhighpriest', x: 16, y: 10, areaId: 83 })
    const venom = game.spawnMonster({ hcIdx: 558, defId: 'venomlord', x: 18, y: 10, areaId: 83 })
    const regurg = game.spawnMonster({ hcIdx: 307, defId: 'regurgitator1', x: 20, y: 10, areaId: 83 })
    const queen = game.spawnMonster({ hcIdx: 284, defId: 'maggotqueen1', x: 22, y: 10, areaId: 83 })

    // Legitimate ranged rows (RangedType=1 or MonAI ranged=true) remain ranged:
    const skelBow = game.spawnMonster({ hcIdx: 53, defId: 'sk_archer1', x: 24, y: 10, areaId: 83 })
    const maggot = game.spawnMonster({ hcIdx: 68, defId: 'sandmaggot1', x: 26, y: 10, areaId: 83 })
    const bloodRaven = game.spawnMonster({ hcIdx: 267, defId: 'bloodraven', x: 28, y: 10, areaId: 83 })

    const monsters = getMonsters(game)
    for (const id of [c1, c2, c3, bartuc, venom, regurg, queen]) {
      expect(monsters.get(id)?.isRanged).toBe(false)
    }
    for (const id of [skelBow, maggot, bloodRaven]) {
      expect(monsters.get(id)?.isRanged).toBe(true)
    }
  })

  it('prevents Council HighPriests (#345..347, #557) from firing #343 highpriestlightning mode missiles and lets them summon #62 Hydra up to aip8=30 and approach into melee', () => {
    const game = new GameInstance({ seed: 200402, areaId: 83, difficulty: 0 })
    const pid = game.connectPlayer({
      charClass: 'sor',
      name: 'TravSorc',
      x: 28, // distance 18: > old wrong aip7=15, <= aidist=20, < 1.13c aip8=30 (0x6FC39255)
      y: 10,
      areaId: 83,
      hp: 5000,
      maxHp: 5000,
    })
    const councilId = game.spawnMonster({
      hcIdx: 345,
      defId: 'councilmember1',
      x: 10,
      y: 10,
      areaId: 83,
      hp: 2000,
      maxHp: 2000,
    })
    const monsters = getMonsters(game)
    const missiles = getMissiles(game)
    const council = monsters.get(councilId)!

    let sawHighPriestLightning343 = false
    for (let f = 0; f < 100; f += 1) {
      game.stepFrames(1)
      for (const m of missiles.values()) {
        if (m.ownerId === councilId && m.classId === 343) {
          sawHighPriestLightning343 = true
        }
      }
    }

    // 1) Never spawns #343 highpriestlightning (mS1=1 + HPS1HTH event=2 -> 0x6FC95DFE skips MONMODE_SpawnModeMissile)
    expect(sawHighPriestLightning343).toBe(false)
    // 2) Casts #62 Hydra at distance 18 (> 15, < aip8 = 30) and closes distance toward melee instead of standing still
    expect([...monsters.values()].some((m) => m.hcIdx === 351)).toBe(true)
    expect(council.x).toBeGreaterThan(10)

    // 3) Under attacker threat at distance 26 (< aip8 = 30), HighPriest also summons #62 Hydra
    const gameFar = new GameInstance({ seed: 200404, areaId: 83, difficulty: 0 })
    const farPid = gameFar.connectPlayer({
      charClass: 'sor',
      name: 'FarSorc',
      x: 36, // distance 26 (< aip8 = 30)
      y: 10,
      areaId: 83,
      hp: 5000,
      maxHp: 5000,
    })
    const farCouncilId = gameFar.spawnMonster({
      hcIdx: 345,
      defId: 'councilmember1',
      x: 10,
      y: 10,
      areaId: 83,
      hp: 2000,
      maxHp: 2000,
      velocity: 0,
      runSpeed: 0,
    })
    const farMonsters = getMonsters(gameFar) as unknown as Map<
      number,
      TestMonsterView & { threatPlayerId: number; threatUntilFrame: number }
    >
    const farCouncil = farMonsters.get(farCouncilId)!
    farCouncil.threatPlayerId = farPid
    farCouncil.threatUntilFrame = 200
    for (let f = 0; f < 100; f += 1) {
      farCouncil.x = 10
      farCouncil.y = 10
      gameFar.stepFrames(1)
    }
    expect(pid).toBeGreaterThan(0)
    expect([...farMonsters.values()].some((m) => m.hcIdx === 351)).toBe(true)
  })

  it('prevents Venom Lord (#558), Regurgitator (#307 with corpseAmmo=0), and SandMaggotQueen (#284) from firing free generic mode missiles at range', () => {
    const game = new GameInstance({ seed: 200403, areaId: 108, difficulty: 0 })
    game.connectPlayer({
      charClass: 'sor',
      name: 'ChaosSorc',
      x: 26, // 16 subtiles away (<= aidist=20, > #319 MegademonInferno reach, inside 2.5..35 generic shoot band)
      y: 14,
      areaId: 108,
      hp: 5000,
      maxHp: 5000,
    })
    const venomId = game.spawnMonster({
      hcIdx: 558,
      defId: 'venomlord',
      x: 10,
      y: 10,
      areaId: 108,
      hp: 2000,
      maxHp: 2000,
    })
    const regurgId = game.spawnMonster({
      hcIdx: 307,
      defId: 'regurgitator1',
      x: 10,
      y: 14,
      areaId: 108,
      hp: 2000,
      maxHp: 2000,
    })
    const queenId = game.spawnMonster({
      hcIdx: 284,
      defId: 'maggotqueen1',
      x: 10,
      y: 18,
      areaId: 108,
      hp: 2000,
      maxHp: 2000,
    })

    const monsters = getMonsters(game)
    const missiles = getMissiles(game)
    let freeModeMissileCount = 0
    for (let f = 0; f < 60; f += 1) {
      // Keep Venom Lord and Regurgitator at > 20 subtiles for the sniper check while recording movement
      game.stepFrames(1)
      for (const m of missiles.values()) {
        if ((m.ownerId === venomId || m.ownerId === regurgId || m.ownerId === queenId) && m.skillId === 0) {
          freeModeMissileCount += 1
        }
      }
    }

    expect(freeModeMissileCount).toBe(0)
    expect(monsters.get(venomId)!.x).toBeGreaterThan(10)
    expect(monsters.get(regurgId)!.x).toBeGreaterThan(10)
    expect(monsters.get(queenId)!.x).toBe(10)
  })
})
