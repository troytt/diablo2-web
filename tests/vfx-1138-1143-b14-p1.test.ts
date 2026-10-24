import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { arcticBlastRangeFrames113c } from '../src/client/world/state-ids-113c.ts'

function createBarbarianWorld(): { world: ClientWorld; caster: any } {
  const world = new ClientWorld()
  world.selfId = 1
  const caster = (world as any).ensureUnit('player', 1)
  caster.classId = 4 // Barbarian
  caster.charClass = 'bar'
  caster.x = 100
  caster.y = 100
  caster.dead = false
  world.self.charClass = 4
  world.self.x = 100
  world.self.y = 100
  return { world, caster }
}

function addCorpseMonster(world: ClientWorld, id: number, classId: number, x: number, y: number): any {
  const m = (world as any).ensureUnit('monster', id)
  m.classId = classId
  m.x = x
  m.y = y
  m.dead = true
  m.mode = 12
  ;(world as any)._monsters.set(id, m)
  return m
}

function createDruidWorld(): { world: ClientWorld; caster: any } {
  const world = new ClientWorld()
  world.selfId = 1
  const caster = (world as any).ensureUnit('player', 1)
  caster.classId = 5 // Druid
  caster.charClass = 'dru'
  caster.x = 100
  caster.y = 100
  caster.dead = false
  world.self.charClass = 5
  world.self.x = 100
  world.self.y = 100
  return { world, caster }
}

describe('B14-p1 Barbarian & Druid 1.13c Spell VFX Parity (#1138-#1143)', () => {
  describe('#1138 Grim Ward (#150): no fake monster 345, no corpseexplosion, staged start -> loop -> stop chain', () => {
    it('selects start missile by MonStats2 small/large flags and chains start -> loop -> stop without fake monster or corpseexplosion', () => {
      const { world: wSmall, caster: cSmall } = createBarbarianWorld()
      const fallenCorpse = addCorpseMonster(wSmall, 501, 19, 104, 100) // fallen1 (MonStats2 small=1)

      ;(wSmall as any).spawnMissilesForSkill(cSmall, 150, 104, 100, 1)

      // Must consume corpse with states 104 + 118
      expect(fallenCorpse.states.has(104)).toBe(true)
      expect(fallenCorpse.states.has(118)).toBe(true)

      // Must NOT spawn fake monster id 8600 / classId 345 (councilmember1)
      expect(wSmall.monsters.has(8600)).toBe(false)
      expect(Array.from(wSmall.monsters.values()).some((m) => m.classId === 345)).toBe(false)

      // At cast frame: ONLY grimwardsmallstart (Range=5), NO corpseexplosion, NO grimwardsmall yet
      const castMissiles = Array.from(wSmall.units.values()).filter((u) => u.unitType === 'missile')
      expect(castMissiles.map((m) => m.missileKey)).toEqual(['grimwardsmallstart'])
      expect(castMissiles[0]!.maxTicks).toBe(5)

      // Step 5 ticks: grimwardsmallstart expires and chains via pCltHitFunc=29 to grimwardsmall (Range=200)
      for (let i = 0; i < 5; i++) {
        ;(wSmall as any).stepDiscreteSimulationTick(40)
      }
      const loopMissiles = Array.from(wSmall.units.values()).filter((u) => u.unitType === 'missile')
      expect(loopMissiles.map((m) => m.missileKey)).toEqual(['grimwardsmall'])
      expect(loopMissiles[0]!.maxTicks).toBe(200)

      // Step 200 ticks: grimwardsmall expires and chains via pCltHitFunc=29 to grimwardsmallstop (Range=9)
      for (let i = 0; i < 200; i++) {
        ;(wSmall as any).stepDiscreteSimulationTick(40)
      }
      const stopMissiles = Array.from(wSmall.units.values()).filter((u) => u.unitType === 'missile')
      expect(stopMissiles.map((m) => m.missileKey)).toEqual(['grimwardsmallstop'])
      expect(stopMissiles[0]!.maxTicks).toBe(9)
    })

    it('spawns grimwardmediumstart (Range=8) -> grimwardmedium (Range=200) -> grimwardmediumstop (Range=9) and grimwardlargestart for large corpses', () => {
      const { world: wMed, caster: cMed } = createBarbarianWorld()
      addCorpseMonster(wMed, 502, 0, 104, 100) // skeleton1 (neither small nor large)
      ;(wMed as any).spawnMissilesForSkill(cMed, 150, 104, 100, 1)

      const mStart = Array.from(wMed.units.values()).filter((u) => u.unitType === 'missile')
      expect(mStart.map((m) => m.missileKey)).toEqual(['grimwardmediumstart'])
      expect(mStart[0]!.maxTicks).toBe(8)

      const { world: wLarge, caster: cLarge } = createBarbarianWorld()
      addCorpseMonster(wLarge, 503, 10, 104, 100) // bighead1 (MonStats2 large=1)
      ;(wLarge as any).spawnMissilesForSkill(cLarge, 150, 104, 100, 1)

      const lStart = Array.from(wLarge.units.values()).filter((u) => u.unitType === 'missile')
      expect(lStart.map((m) => m.missileKey)).toEqual(['grimwardlargestart'])
      expect(lStart[0]!.maxTicks).toBe(8)
    })
  })

  describe('#1139 Find Potion (#131) & Find Item (#142): consume corpse with state 118 without corpseexplosion', () => {
    it('adds state 118 (corpse_nodraw) to corpse and spawns zero missiles', () => {
      const { world, caster } = createBarbarianWorld()
      const corpse1 = addCorpseMonster(world, 601, 19, 102, 100)

      ;(world as any).spawnMissilesForSkill(caster, 131, 102, 100, 1)
      expect(corpse1.states.has(118)).toBe(true)
      expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile')).toHaveLength(0)

      const corpse2 = addCorpseMonster(world, 602, 0, 103, 100)

      ;(world as any).spawnMissilesForSkill(caster, 142, 103, 100, 1)
      expect(corpse2.states.has(118)).toBe(true)
      expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile')).toHaveLength(0)
    })
  })

  describe('#1140 Arctic Blast (#230): no 3-shot burst on cast, maxTicks = floor((35 + (slvl - 1) * 6) / 2)', () => {
    it('computes arcticBlastRangeFrames113c as floor((35 + (slvl - 1) * 6) / 2)', () => {
      expect(arcticBlastRangeFrames113c(1)).toBe(17)
      expect(arcticBlastRangeFrames113c(2)).toBe(20)
      expect(arcticBlastRangeFrames113c(5)).toBe(29)
      expect(arcticBlastRangeFrames113c(20)).toBe(74)
    })

    it('emits 1 missile per tick during channeling with maxTicks = arcticBlastRangeFrames113c(slvl) and no 3-shot burst', () => {
      const { world, caster } = createDruidWorld()
      ;(world.self.skills as Map<number, number>).set(230, 5)
      caster.skillLevel = 5

      ;(world as any).applySkillCastToUnit(caster, 230, 110, 100, 5, true)
      expect(caster.overlays.some((o: any) => o.token === 'arctic_blast_cast')).toBe(true)

      // Before discrete tick: 0 missiles spawned (no 3-shot burst on cast start)
      const initialMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(initialMissiles).toHaveLength(0)

      // After 1 discrete tick: exactly 1 arcticblast1/2 missile with maxTicks = 29 (slvl 5)
      ;(world as any).stepDiscreteSimulationTick(40)
      const tick1Missiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(tick1Missiles).toHaveLength(1)
      expect(['arcticblast1', 'arcticblast2']).toContain(tick1Missiles[0]!.missileKey)
      expect(tick1Missiles[0]!.maxTicks).toBe(29)
    })
  })

  describe('#1141 Firestorm (#225): firestormmaker maxTicks=40, CltParam1=4 sub-missile cadence (firestorm, firesmall, firemedium)', () => {
    it('spawns 3 firestormmaker missiles with maxTicks=40 and emits firestorm/firesmall/firemedium every 4 ticks', () => {
      const { world, caster } = createDruidWorld()
      ;(world as any).spawnMissilesForSkill(caster, 225, 110, 100, 1)

      const makers = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'firestormmaker',
      )
      expect(makers).toHaveLength(3)
      for (const m of makers) {
        expect(m.maxTicks).toBe(40)
      }

      // Tick 1 (prevAgeTicks = 0, 0 % 4 === 0): each maker spawns firestorm (Range=15), firesmall (Range=90+25*1=115), firemedium (Range=90+25*1=115)
      ;(world as any).stepDiscreteSimulationTick(40)
      const afterTick1 = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      const fsPatches = afterTick1.filter((u) => u.missileKey === 'firestorm')
      const fSmalls = afterTick1.filter((u) => u.missileKey === 'firesmall')
      const fMediums = afterTick1.filter((u) => u.missileKey === 'firemedium')
      expect(fsPatches).toHaveLength(3)
      expect(fSmalls).toHaveLength(3)
      expect(fMediums).toHaveLength(3)
      expect(fsPatches[0]!.maxTicks).toBe(15)
      expect(fSmalls[0]!.maxTicks).toBe(115)
      expect(fMediums[0]!.maxTicks).toBe(115)

      // Ticks 2, 3, 4 (prevAgeTicks = 1, 2, 3): no new sub-missiles spawned
      ;(world as any).stepDiscreteSimulationTick(40)
      ;(world as any).stepDiscreteSimulationTick(40)
      ;(world as any).stepDiscreteSimulationTick(40)
      const afterTick4 = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(afterTick4.filter((u) => u.missileKey === 'firestorm')).toHaveLength(3)
      expect(afterTick4.filter((u) => u.missileKey === 'firesmall')).toHaveLength(3)
      expect(afterTick4.filter((u) => u.missileKey === 'firemedium')).toHaveLength(3)

      // Tick 5 (prevAgeTicks = 4, 4 % 4 === 0): second batch spawned (total 6 each)
      ;(world as any).stepDiscreteSimulationTick(40)
      const afterTick5 = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(afterTick5.filter((u) => u.missileKey === 'firestorm')).toHaveLength(6)
      expect(afterTick5.filter((u) => u.missileKey === 'firesmall')).toHaveLength(6)
      expect(afterTick5.filter((u) => u.missileKey === 'firemedium')).toHaveLength(6)
    })
  })

  describe('#1142 Molten Boulder (#229): emerge (Range=5) -> boulder (Range=100, CltDo47 trail) -> explode/flyingrocks/firepath on impact', () => {
    it('spawns only moltenboulderemerge at cast, chains to moltenboulder at tick 5, trails firewall/firesmall/firemedium, and bursts into CltHitSubMissile1..3', () => {
      const { world, caster } = createDruidWorld()
      ;(world as any).spawnMissilesForSkill(caster, 229, 115, 100, 1)

      // At cast: ONLY moltenboulderemerge (Range=5), NO moltenboulder yet
      const castMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(castMissiles.map((m) => m.missileKey)).toEqual(['moltenboulderemerge'])
      expect(castMissiles[0]!.maxTicks).toBe(5)

      // Step 5 ticks: moltenboulderemerge expires and chains to moltenboulder (Range=100)
      for (let i = 0; i < 5; i++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }
      const afterEmerge = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(afterEmerge.map((m) => m.missileKey)).toEqual(['moltenboulder'])
      const boulder = afterEmerge[0]!
      expect(boulder.maxTicks).toBe(100)
      expect(boulder.explosionMissile ?? '').toBe('')

      // Step 1 tick of moltenboulder (prevAgeTicks = 0): spawns firewall (90), firesmall (115), firemedium (115)
      ;(world as any).stepDiscreteSimulationTick(40)
      const trailMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(trailMissiles.some((m) => m.missileKey === 'firewall' && m.maxTicks === 90)).toBe(true)
      expect(trailMissiles.some((m) => m.missileKey === 'firesmall' && m.maxTicks === 115)).toBe(true)
      expect(trailMissiles.some((m) => m.missileKey === 'firemedium' && m.maxTicks === 115)).toBe(true)

      // Step remaining 99 ticks until moltenboulder expires: pCltHitFunc=52 spawns moltenboulderexplode (13), moltenboulder-flyingrocks (16), moltenboulderfirepath (37)
      for (let i = 0; i < 99; i++) {
        ;(world as any).stepDiscreteSimulationTick(40)
      }
      const postImpact = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(postImpact.some((m) => m.missileKey === 'moltenboulderexplode' && m.maxTicks === 13)).toBe(true)
      expect(
        postImpact.filter((m) => m.missileKey === 'moltenboulder-flyingrocks' && m.maxTicks === 16),
      ).toHaveLength(10)
      expect(postImpact.some((m) => m.missileKey === 'moltenboulderfirepath' && m.maxTicks === 37)).toBe(true)
      expect(postImpact.some((m) => m.missileKey === 'fireexplosion')).toBe(false)
      expect(postImpact.some((m) => m.missileKey === 'moltenboulderemerge')).toBe(false)
    })
  })

  describe('#1143 Twister (#240) & Tornado (#245): use Missiles.txt Range=50 and Range=75', () => {
    it('spawns twister with maxTicks=50 and tornado with maxTicks=75', () => {
      const { world, caster } = createDruidWorld()
      ;(world as any).spawnMissilesForSkill(caster, 240, 110, 100, 1)
      const twisters = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'twister',
      )
      expect(twisters).toHaveLength(3)
      for (const tw of twisters) {
        expect(tw.maxTicks).toBe(50)
      }

      ;(world as any).spawnMissilesForSkill(caster, 245, 110, 100, 1)
      const tornados = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'tornado',
      )
      expect(tornados).toHaveLength(1)
      expect(tornados[0]!.maxTicks).toBe(75)
    })
  })
})
