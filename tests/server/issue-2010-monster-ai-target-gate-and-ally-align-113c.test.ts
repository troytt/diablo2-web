/**
 * Issue #2010 — 1.13c `AIGENERAL_Think` `nTargetMode = 1` Hostile Target Gate
 * (`D2Game.dll` `0x6FCBD494 -> 0x6FCBD160 -> 0x6FD13220`) & `D2Common.#10666`/`#10830`
 * Ally Alignment / Conversion Filter across Monster Healer, Resurrector & Support Skills.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface InternalMonsterView {
  unitId: number
  hcIdx: number
  defId: string
  x: number
  y: number
  hp: number
  maxHp: number
  ac: number
  align: number
  dead: boolean
  cooldown: number
  skillCooldown: number
  threatUntilFrame: number
  threatPlayerId: number
  wormsOnDeath: boolean
  umodIds: number[]
  states: Set<number>
  pendingResurrection?: { corpseUnitId: number; frame: number } | undefined
}

function getMonsters(game: GameInstance): Map<number, InternalMonsterView> {
  return (game as unknown as { monsters: Map<number, InternalMonsterView> }).monsters
}

describe('issue #2010: 1.13c AIGENERAL_Think nTargetMode=1 gate & ally alignment filter', () => {
  it('prevents unawakened HighPriest (councilmember2) in Durance L3 from healing Mephisto across rooms until a hostile enters aidist or triggers threat', () => {
    const game = new GameInstance({ seed: 201001, areaId: 102 })
    // Player fights Mephisto at (100, 100); Wyand Voidfinger / councilmember2 is 48 subtiles away at (148, 100),
    // outside councilmember2 aidist (18) but within HighPriest 50-subtile heal scan radius of Mephisto at (100, 101) (dist ~48.01).
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'Sorc',
      x: 92,
      y: 100,
      areaId: 102,
      hp: 2000,
      maxHp: 2000,
    })
    const mephId = game.spawnMonster({
      hcIdx: 242,
      defId: 'mephisto',
      x: 100,
      y: 101,
      areaId: 102,
      hp: 600,
      maxHp: 1000,
      damageRegen: 0,
    })
    const priestId = game.spawnMonster({
      hcIdx: 346,
      defId: 'councilmember2',
      x: 148,
      y: 100,
      areaId: 102,
      aiParams: [35, 100, 75, 40, 50, 0, 13, 30], // 100% heal roll if pfnAiThink ran
      damageRegen: 0,
    })
    game.drainEvents(playerId)

    // Over 120 frames, unawakened councilmember2 (dist 56 from Sorc > aidist 18) must NEVER heal Mephisto!
    for (let f = 0; f < 120; f++) {
      const m = getMonsters(game)
      m.get(mephId)!.hp = 600
      m.get(priestId)!.cooldown = 0
      m.get(priestId)!.skillCooldown = 0
      game.stepFrames(1)
      expect(m.get(mephId)!.hp).toBe(600)
    }

    // Once a hostile enters councilmember2's aidist (or damages it to set threatUntilFrame), pfnAiThink runs and heals!
    game.applyDamageToMonster(priestId, 5, playerId)
    let healed = false
    for (let f = 0; f < 30; f++) {
      const priest = getMonsters(game).get(priestId)!
      priest.cooldown = 0
      priest.skillCooldown = 0
      game.stepFrames(1)
      if (getMonsters(game).get(mephId)!.hp > 600) {
        healed = true
        break
      }
    }
    expect(healed).toBe(true)
  })

  it('prevents unawakened ZakarumPriest, GreaterMummy, OblivionKnight, FallenShaman, FetishShaman, and BloodRaven from healing or resurrecting until a hostile is acquired', () => {
    // 1. Unawakened healers with wounded ally (30% HP) and player 60 subtiles away (outside aidist)
    const healCases = [
      { hcIdx: 238, defId: 'zealot4', aiParams: [50, 50, 50, 50, 50, 20] }, // ZakarumPriest
      { hcIdx: 101, defId: 'unraveler1', aiParams: [70, 100, 100, 60, 24] }, // GreaterMummy
      { hcIdx: 312, defId: 'doomknight3', aiParams: [50, 50, 50, 50, 100, 100, 20, 25] }, // OblivionKnight
    ]
    for (const c of healCases) {
      const game = new GameInstance({ seed: 201010 + c.hcIdx, areaId: 56 })
      game.connectPlayer({ charClass: 'sor', name: 'FarHero', x: 90, y: 20, areaId: 56 })
      const healerId = game.spawnMonster({
        hcIdx: c.hcIdx,
        defId: c.defId,
        x: 20,
        y: 20,
        areaId: 56,
        aiParams: c.aiParams,
      })
      const allyId = game.spawnMonster({
        hcIdx: 11,
        defId: 'skeleton1',
        x: 24,
        y: 20,
        areaId: 56,
        hp: 30,
        maxHp: 100,
        damageRegen: 0,
      })
      for (let f = 0; f < 40; f++) {
        const m = getMonsters(game)
        m.get(healerId)!.cooldown = 0
        m.get(healerId)!.skillCooldown = 0
        game.stepFrames(1)
      }
      expect(getMonsters(game).get(allyId)!.hp).toBe(30)
    }

    // 2. Unawakened resurrectors with valid corpse and player 65 subtiles away (outside aidist)
    const rezCases = [
      { hcIdx: 58, defId: 'fallenshaman1', corpseHcIdx: 18, corpseDef: 'fallen1', aiParams: [100, 60, 100, 24, 15] },
      { hcIdx: 278, defId: 'fetishshaman1', corpseHcIdx: 273, corpseDef: 'fetish1', aiParams: [100, 0, 20, 66, 50] },
      { hcIdx: 267, defId: 'bloodraven', corpseHcIdx: 5, corpseDef: 'zombie1', aiParams: [50, 50, 50, 20, 20] },
      { hcIdx: 101, defId: 'unraveler1', corpseHcIdx: 11, corpseDef: 'skeleton1', aiParams: [70, 100, 0, 60, 24] },
    ]
    for (const c of rezCases) {
      const game = new GameInstance({ seed: 201050 + c.hcIdx, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'sor', name: 'FarHero', x: 85, y: 20, areaId: 2 })
      const casterId = game.spawnMonster({
        hcIdx: c.hcIdx,
        defId: c.defId,
        x: 20,
        y: 20,
        areaId: 2,
        aiParams: c.aiParams,
      })
      const corpseId = game.spawnMonster({
        hcIdx: c.corpseHcIdx,
        defId: c.corpseDef,
        x: 23,
        y: 20,
        areaId: 2,
      })
      const corpse = getMonsters(game).get(corpseId)!
      corpse.dead = true
      corpse.hp = 0

      // Far player -> 0 resurrections
      for (let f = 0; f < 40; f++) {
        getMonsters(game).get(casterId)!.cooldown = 0
        game.stepFrames(1)
      }
      expect(corpse.dead).toBe(true)
      expect(getMonsters(game).get(casterId)!.pendingResurrection).toBeUndefined()

      // Move player within aidist (x = 8, y = 20 -> dist 12) -> resurrects!
      const pRec = (game as unknown as { players: Map<number, { x: number; y: number }> }).players.get(pid)!
      pRec.x = 8
      pRec.y = 20
      for (let f = 0; f < 30 && corpse.dead; f++) {
        getMonsters(game).get(casterId)!.cooldown = 0
        game.stepFrames(1)
      }
      expect(corpse.dead).toBe(false)
    }
  })

  it('rejects friendly align=1 NpcBarb soldiers and Mind-Blasted/Converted (state 53) monsters from evil heal, whip, rally, shout, and impregnate scans', () => {
    const game = new GameInstance({ seed: 201099, areaId: 111 })
    const playerId = game.connectPlayer({
      charClass: 'ass',
      name: 'Shadow',
      x: 10,
      y: 20,
      areaId: 111,
      hp: 5000,
      maxHp: 5000,
    })

    // Friendly Act 5 NpcBarb (`hcIdx 522`, `Align = 1`) and Converted evil minion (`state 53`)
    const barbId = game.spawnMonster({
      hcIdx: 522,
      defId: 'act5barb1',
      x: 22,
      y: 20,
      areaId: 111,
      hp: 25,
      maxHp: 100,
      damageRegen: 0,
    })
    const convertedId = game.spawnMonster({
      hcIdx: 453,
      defId: 'minion1',
      x: 22,
      y: 22,
      areaId: 111,
      hp: 25,
      maxHp: 100,
      damageRegen: 0,
    })
    game.applyMonsterState(convertedId, 53, 1000, { sourcePlayerId: playerId })

    // Spawn HighPriest (#346), Overseer (#479), Putrid Defiler (#546), and Madawc (#541) near them
    const priestId = game.spawnMonster({
      hcIdx: 346,
      defId: 'councilmember2',
      x: 20,
      y: 20,
      areaId: 111,
      aiParams: [35, 100, 75, 0, 50, 0, 13, 30],
    })
    const overseerId = game.spawnMonster({
      hcIdx: 479,
      defId: 'overseer1',
      x: 20,
      y: 22,
      areaId: 111,
      aiParams: [100, 100, 100, 100, 20],
    })
    const defilerId = game.spawnMonster({
      hcIdx: 546,
      defId: 'putriddefiler1',
      x: 20,
      y: 24,
      areaId: 111,
    })
    const madawcId = game.spawnMonster({
      hcIdx: 541,
      defId: 'ancientbarb2',
      x: 24,
      y: 24,
      areaId: 111,
    })

    const m = getMonsters(game)
    // Freeze positions and damage zeroing so neither friendly barb nor converted minion dies from combat while testing buffs/heals
    const barb = m.get(barbId)!
    const conv = m.get(convertedId)!
    expect(barb.align).toBe(1)

    for (let f = 0; f < 30; f++) {
      barb.hp = 25
      conv.hp = 25
      m.get(priestId)!.cooldown = 0
      m.get(priestId)!.skillCooldown = 0
      m.get(overseerId)!.cooldown = 0
      m.get(overseerId)!.skillCooldown = 0
      m.get(defilerId)!.cooldown = 0
      m.get(defilerId)!.skillCooldown = 0
      m.get(madawcId)!.cooldown = 0
      m.get(madawcId)!.skillCooldown = 0
      game.stepFrames(1)
      // Neither friendly NpcBarb nor converted minion may be healed (>25 HP), bloodlusted (140), impregnated (143 / wormsOnDeath), or rallied!
      expect(barb.hp).toBeLessThanOrEqual(25)
      expect(conv.hp).toBeLessThanOrEqual(25)
      expect(barb.states.has(140)).toBe(false)
      expect(conv.states.has(140)).toBe(false)
      expect(barb.wormsOnDeath).toBe(false)
      expect(conv.wormsOnDeath).toBe(false)
      expect(barb.states.has(143)).toBe(false)
      expect(conv.states.has(143)).toBe(false)
    }
    // Note: Madawc (#541) has evil allies nearby (councilmember2 / overseer1 / putriddefiler1) so Madawc CAN cast Shout on them,
    // yet barb & converted minion MUST NOT receive Shout (state 26)!
    expect(barb.states.has(26)).toBe(false)
    expect(conv.states.has(26)).toBe(false)
  })
})
