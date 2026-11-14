import { describe, expect, it } from 'vitest'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { readD2sSave113c } from '../src/server/save/d2s-reader.ts'

describe('Issue #1398: Player pool stats ValShift=8 and exportPlayerD2s progression/merc/experience', () => {
  it('emits 8.8 fixed-point ValShift=8 values for player pool stats 6..11 so ClientWorld displays full vitals', () => {
    const game = new GameInstance({ mode: 'sp', difficulty: 0, act: 0, areaId: 1 })
    const pId = game.connectPlayer({ charName: 'NecroVitals', classId: 2, level: 1 })
    const world = new ClientWorld()

    for (const ev of game.drainPlayerEvents(pId)) {
      world.applyEvent(ev)
    }

    const self = world.self
    // Necromancer level 1 base vitals: 45 HP, 25 Mana, 79 Stamina
    expect(self.life).toBe(45)
    expect(self.maxLife).toBe(45)
    expect(self.mana).toBe(25)
    expect(self.maxMana).toBe(25)
    expect(self.stamina).toBe(79)
    expect(self.maxStamina).toBe(79)

    // Kill a high-XP monster to level up to level 2 and verify level-up StatSet/UnitStatUpdate keeps 8.8 fixed-point scale
    const mId = game.spawnMonster({ hcIdx: 0, areaId: 1, x: 102, y: 100, hp: 5, maxHp: 5, experience: 600 })
    game.applyDamageToMonster(mId, 50, pId)
    for (const ev of game.drainPlayerEvents(pId)) {
      world.applyEvent(ev)
    }
    expect(self.level).toBe(2)
    expect(self.maxLife).toBeGreaterThan(45)
    expect(self.life).toBe(self.maxLife)
    expect(self.maxMana).toBeGreaterThan(25)
    expect(self.mana).toBe(self.maxMana)
    expect(self.maxStamina).toBeGreaterThanOrEqual(80)
    expect(self.stamina).toBe(self.maxStamina)

    // Allocate 2 points into Vitality (statId=3) and 1 into Energy (statId=1)
    game.enqueueCommand(pId, { type: 'AllocateStat', statId: 3, amount: 2 })
    game.enqueueCommand(pId, { type: 'AllocateStat', statId: 1, amount: 1 })
    game.stepFrame()
    for (const ev of game.drainPlayerEvents(pId)) {
      world.applyEvent(ev)
    }
    expect(self.maxLife).toBeGreaterThanOrEqual(50)
    expect(self.maxMana).toBeGreaterThanOrEqual(29)
  })

  it('persists Act boss progression (Slayer=5), active mercenary, and experience floor in exportPlayerD2s', () => {
    const game = new GameInstance({ mode: 'sp', difficulty: 0, act: 4, areaId: 132 })
    const pId = game.connectPlayer({ charName: 'SlayerNecro', classId: 2, level: 35, areaId: 132 })

    // Hire Act 2 Defiance mercenary (subType 8)
    game.hireMercenary(pId, { act: 2, subType: 8, level: 35, difficulty: 1 })

    // Spawn and kill Baal (hcIdx 544) in Worldstone Chamber (areaId 132)
    const baalId = game.spawnMonster({ hcIdx: 544, areaId: 132, x: 132, y: 132, hp: 50, maxHp: 50 })
    game.applyDamageToMonster(baalId, 1000, pId)

    const d2sBytes = game.exportPlayerD2s(pId)
    const parsed = readD2sSave113c(d2sBytes)
    // Expansion Normal Baal completed -> progression >= 5 (Slayer)
    expect(parsed.progression).toBeGreaterThanOrEqual(5)
    // Experience at least level 35 floor (9,558,926)
    expect(parsed.attributes.experience).toBeGreaterThanOrEqual(9_558_926)
    // Active mercenary persisted
    expect(parsed.merc?.seed).toBeGreaterThan(0)
    expect(parsed.merc?.typeId).toBe(8)
    expect(parsed.merc?.dead).toBe(false)

    // Reconnect from exported .d2s into a new GameInstance and verify mercenary is restored
    const game2 = new GameInstance({ mode: 'sp', difficulty: 0, act: 4, areaId: 109 })
    const pId2 = game2.connectPlayer({ d2s: d2sBytes, restoreMercenary: true })
    const restoredMerc = game2.getMercenaryForOwner(pId2)
    expect(restoredMerc).toBeDefined()
    expect(restoredMerc!.act).toBe(2)
    expect(restoredMerc!.subType).toBe(8)
    expect(restoredMerc!.level).toBe(35)
    expect(restoredMerc!.alive).toBe(true)
  })
})
