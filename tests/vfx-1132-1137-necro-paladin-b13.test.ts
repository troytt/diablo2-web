import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  CANONICAL_113C_MISSILES,
  CANONICAL_113C_OVERLAYS,
  getAuraOverlayName,
  getAuraOverlayNames,
  getMissileTxtData,
  getOverlayTxtData,
  getSkillCastOverlay,
} from '../src/common/skills/missiles-data.ts'

describe('Diablo II v1.13c Necromancer & Paladin Spell VFX Parity (B13: #1132-#1137)', () => {
  it('#1132: Teeth (#67) & Bone Spear (#84) SkillCltStFunc[19] (0x6FB78F50 -> 0x6FB78980) spawns cltmissilec=bonecast (#218)', () => {
    const bonecastRow = getMissileTxtData('bonecast')
    expect(bonecastRow).toMatchObject({
      id: 218,
      celFile: 'BoneCast',
      animLen: 16,
      animSpeed: 16,
      range: 20,
      vel: 0,
      loopAnim: 0,
      trans: 1,
    })
    expect('bonecast' in CANONICAL_113C_OVERLAYS).toBe(false)

    for (const [skillId, mainMissileKey] of [
      [67, 'teeth'],
      [84, 'bonespear'],
    ] as const) {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 2
      ;(world.self as any).charClass = 2 // Necromancer
      const caster = (world as any).ensureUnit('player', 1)
      caster.classId = 2
      caster.x = 100
      caster.y = 100
      caster.direction = 0

      // 1. Cast start (applySkillCastToUnit) spawns bonecast at caster facing target
      ;(world as any).applySkillCastToUnit(caster, skillId, 110, 100, 1)
      const missilesAtStart = Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === 'bonecast',
      )
      expect(missilesAtStart.length).toBe(1)
      const bonecast = missilesAtStart[0]!
      expect(bonecast.x).toBe(100)
      expect(bonecast.y).toBe(100)
      expect(bonecast.maxTicks).toBe(20)
      expect(bonecast.totalFrames).toBe(16)

      // 2. Action frame (spawnMissilesForSkill) spawns main projectile without duplicating bonecast
      ;(world as any).spawnMissilesForSkill(caster, skillId, 110, 100, 1)
      const bonecastsAfterDo = Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === 'bonecast',
      )
      expect(bonecastsAfterDo.length).toBe(1)
      const mainMissiles = Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === mainMissileKey,
      )
      expect(mainMissiles.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('#1133: Corpse Explosion (#74) & NihlathakCorpseExplosion (#351) SkillCltDoFunc[32] (0x6FB78FB0 -> 0x6FB78CE0) spawns cltmissilec=redlightmissile (#151)', () => {
    const redLightRow = getMissileTxtData('redlightmissile')
    expect(redLightRow).toMatchObject({
      id: 151,
      celFile: 'null',
      animLen: 2,
      animSpeed: 16,
      range: 10,
      vel: 0,
      loopAnim: 0,
      light: 5,
      red: 255,
      green: 178,
      blue: 64,
    })

    for (const skillId of [74, 351] as const) {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 2
      const caster = (world as any).ensureUnit('player', 1)
      caster.x = 100
      caster.y = 100

      const corpse = (world as any).ensureUnit('monster', 201)
      corpse.classId = 1
      corpse.x = 105
      corpse.y = 103
      corpse.dead = true
      corpse.mode = 12
      corpse.lifePct = 0
      ;(world as any)._monsters.set(201, corpse)

      ;(world as any).spawnMissilesForSkill(caster, skillId, 106, 103, 5)
      expect(corpse.states.has(104)).toBe(true)

      const missiles = Array.from(world.units.values()).filter(u => u.unitType === 'missile')
      const ce = missiles.find(m => m.missileKey === 'corpseexplosion')
      const exp = missiles.find(m => m.missileKey === 'explodingarrowexp')
      const redLight = missiles.find(m => m.missileKey === 'redlightmissile')

      expect(ce).toBeDefined()
      expect(exp).toBeDefined()
      expect(redLight).toBeDefined()
      expect(redLight?.x).toBe(105)
      expect(redLight?.y).toBe(103)
      expect(redLight?.maxTicks).toBe(10)
    }
  })

  it('#1134 & #1135: Fist of the Heavens (#121) spawns fistoftheheavensdelay (#233, Range=10), does not locally attach handofgod overlay, and CltHitFunc 26 (0x6FB6AD40) obeys radius/count/filter', () => {
    const delayRow = getMissileTxtData('fistoftheheavensdelay')
    expect(delayRow).toMatchObject({
      id: 233,
      celFile: 'null',
      animLen: 2,
      animSpeed: 16,
      range: 10,
      vel: 0,
      loopAnim: 0,
    })
    // 1.13c Skills.txt Fist of the Heavens (#121) has an empty `castoverlay` column (B5-p1 generated rows): no cast
    // overlay is spawned for FoH; the Overlay.txt row cast_fistofares itself still exists with its 1.13c values.
    expect(getSkillCastOverlay(121)).toBeUndefined()
    expect(getOverlayTxtData('cast_fistofares')).toMatchObject({
      filename: 'FOACast',
      frames: 20,
      radius: 6,
    })
    expect(getOverlayTxtData('handofgod')).toMatchObject({
      filename: 'HolyShockHit',
      frames: 21,
      initRadius: 2,
      radius: 2,
    })

    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2 // Blood Moor (not town)
    const paladin = (world as any).ensureUnit('player', 1)
    paladin.classId = 3
    paladin.x = 100
    paladin.y = 100

    // Primary target monster at (110, 100)
    const primaryTarget = (world as any).ensureUnit('monster', 300)
    primaryTarget.classId = 1
    primaryTarget.x = 110
    primaryTarget.y = 100
    primaryTarget.mode = 1
    primaryTarget.lifePct = 128
    ;(world as any)._monsters.set(300, primaryTarget)

    // 9 additional living hostile monsters within radius 20 of (110, 100)
    for (let i = 1; i <= 9; i++) {
      const m = (world as any).ensureUnit('monster', 300 + i)
      m.classId = 1
      m.x = 110 + i
      m.y = 100
      m.mode = 1
      m.lifePct = 128
      ;(world as any)._monsters.set(300 + i, m)
    }

    // Friendly pet within radius 20 (should be filtered out)
    const pet = (world as any).ensureUnit('monster', 350)
    pet.classId = 363
    pet.x = 112
    pet.y = 100
    pet.mode = 1
    pet.lifePct = 128
    ;(pet as any).ownerId = 1
    ;(world as any)._monsters.set(350, pet)

    // Out-of-range monster at distance 25 > 20 (should be filtered out)
    const farMon = (world as any).ensureUnit('monster', 360)
    farMon.classId = 1
    farMon.x = 135
    farMon.y = 100
    farMon.mode = 1
    farMon.lifePct = 128
    ;(world as any)._monsters.set(360, farMon)

    // Cast FoH at slvl=1 (calc4 = ln12 = 6 + (1 - 1)*1 = 6 max bolts)
    ;(world as any).spawnMissilesForSkill(paladin, 121, 110, 100, 1)

    // #1135 / #1281: Client attaches handofgod on targetMon and deduplicates S2C 0x11 (overlayIndex 158)
    expect(primaryTarget.overlays.filter((o: any) => o.token === 'handofgod').length).toBe(1)

    // #1134: Client spawns fistoftheheavensdelay (#233, maxTicks=10), NOT fistofares
    const missiles = Array.from(world.units.values()).filter(u => u.unitType === 'missile')
    expect(missiles.some(m => m.missileKey === 'fistofares')).toBe(false)
    const fohDelay = missiles.find(m => m.missileKey === 'fistoftheheavensdelay')
    expect(fohDelay).toBeDefined()
    expect(fohDelay?.x).toBe(110)
    expect(fohDelay?.y).toBe(100)
    expect(fohDelay?.maxTicks).toBe(10)

    // #1135 / #1281: S2C 0x11 UnitOverlay refreshes handofgod without stacking a duplicate overlay
    world.applyEvent({
      type: 'UnitOverlay',
      rawUnitType: 1,
      id: 300,
      overlayIndex: 158,
    } as any)
    expect(primaryTarget.overlays.filter((o: any) => o.token === 'handofgod').length).toBe(1)

    // Step 10 ticks so fistoftheheavensdelay expires and triggers CltHitFunc 26 (0x6FB6AD40)
    for (let t = 0; t < 10; t++) {
      ;(world as any).stepDiscreteSimulationTick(40, 1000 + t * 40)
    }

    const bolts = Array.from(world.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'fistoftheheavensbolt',
    )
    // At slvl=1, calc4 caps bolts at 6 despite 10 living hostile monsters in range
    expect(bolts.length).toBe(6)
    for (const b of bolts) {
      expect(b.x).not.toBe(135)
    }
  })

  it('#1136: Redemption (#124) StateSet(99) spawns missile redemption (#173 RedemptionGhost) instead of attaching fake overlay redemption', () => {
    expect('redemption' in CANONICAL_113C_OVERLAYS).toBe(false)
    expect(getOverlayTxtData('redemptionfront')).toMatchObject({
      filename: 'null',
      frames: 2,
    })
    expect(getOverlayTxtData('redemptionback')).toMatchObject({
      filename: 'Redemption',
      frames: 12,
    })
    expect(getAuraOverlayName(124)).toBe('redemptionback')
    expect(getAuraOverlayNames(124)).toEqual(['redemptionback'])

    const redemptionMissileRow = CANONICAL_113C_MISSILES.redemption
    expect(redemptionMissileRow).toMatchObject({
      id: 173,
      celFile: 'RedemptionGhost',
      animLen: 16,
      animSpeed: 16,
      range: 18,
      vel: 0,
      loopAnim: 0,
      trans: 1,
      light: 6,
    })

    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    const corpse = (world as any).ensureUnit('monster', 401)
    corpse.classId = 1
    corpse.x = 120
    corpse.y = 115
    corpse.dead = true
    corpse.mode = 12
    corpse.lifePct = 0
    ;(world as any)._monsters.set(401, corpse)

    world.applyEvent({
      type: 'StateSet',
      unit: { unitType: 'monster', id: 401 },
      state: 99,
    } as any)

    expect((corpse as any).hidden).toBe(true)
    expect((corpse as any).redeemed).toBe(true)
    expect(corpse.overlays.length).toBe(0)

    const ghost = Array.from(world.units.values()).find(
      u => u.unitType === 'missile' && u.missileKey === 'redemption',
    )
    expect(ghost).toBeDefined()
    expect(ghost?.classId).toBe(173)
    expect(ghost?.x).toBe(120)
    expect(ghost?.y).toBe(115)
    expect(ghost?.maxTicks).toBe(18)
    expect(ghost?.totalFrames).toBe(16)
  })

  it('#1137: Sanctuary (#119, state 47) StateCltActiveFunc[86] (0x6FB07F60 -> 0x6FB06D00) spawns sanctuarybolt (#57, Range=14) every 50 frames on non-boss Undead within 5+(slvl-1)', () => {
    const boltRow = getMissileTxtData('sanctuarybolt')
    expect(boltRow).toMatchObject({
      id: 57,
      celFile: 'Gleam',
      animLen: 8,
      animSpeed: 16,
      range: 14,
      vel: 0,
      loopAnim: 1,
      trans: 1,
    })

    const world = new ClientWorld()
    world.selfId = 1
    world.areaId = 2
    const paladin = (world as any).ensureUnit('player', 1)
    paladin.classId = 3
    paladin.x = 100
    paladin.y = 100
    paladin.states.add(47)
    ;(world.self.states as Set<number>).add(47)
    ;(world.self.skills as Map<number, number>).set(119, 3) // slvl=3 -> radius = 5 + (3 - 1)*1 = 7

    // 1. Living Undead Zombie (classId=1, isUndead=true from MonStats.txt) at distance 6 <= 7 -> HIT
    const zombieInRange = (world as any).ensureUnit('monster', 501)
    zombieInRange.classId = 1 // Zombie (lUndead=1 in MonStats.txt, no explicit m.isUndead property needed)
    zombieInRange.x = 106
    zombieInRange.y = 100
    zombieInRange.mode = 1
    zombieInRange.lifePct = 128
    ;(world as any)._monsters.set(501, zombieInRange)

    // 2. Living Undead Zombie at distance 9 > 7 -> OUT OF RANGE
    const zombieOutOfRange = (world as any).ensureUnit('monster', 502)
    zombieOutOfRange.classId = 1
    zombieOutOfRange.x = 109
    zombieOutOfRange.y = 100
    zombieOutOfRange.mode = 1
    zombieOutOfRange.lifePct = 128
    ;(world as any)._monsters.set(502, zombieOutOfRange)

    // 3. Living Non-Undead Fallen (classId=19, Demon, not Undead in MonStats.txt) at distance 3 <= 7 -> FILTERED OUT
    const fallenInRange = (world as any).ensureUnit('monster', 503)
    fallenInRange.classId = 19 // Fallen
    fallenInRange.x = 103
    fallenInRange.y = 100
    fallenInRange.mode = 1
    fallenInRange.lifePct = 128
    ;(world as any)._monsters.set(503, fallenInRange)

    // Tick 25: does NOT trigger (perdelay=50, not 25)
    world.frameCount = 24
    ;(world as any).stepDiscreteSimulationTick(40, 1000)
    expect(
      Array.from(world.units.values()).filter(
        u => u.unitType === 'missile' && u.missileKey === 'sanctuarybolt',
      ).length,
    ).toBe(0)

    // Tick 50: triggers!
    world.frameCount = 49
    ;(world as any).stepDiscreteSimulationTick(40, 2000)
    const bolts = Array.from(world.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'sanctuarybolt',
    )
    expect(bolts.length).toBe(1)
    const bolt = bolts[0]!
    expect(bolt.x).toBe(106)
    expect(bolt.y).toBe(100)
    expect(bolt.maxTicks).toBe(14)
    expect(bolt.loopAnim).toBe(true)
  })
})
