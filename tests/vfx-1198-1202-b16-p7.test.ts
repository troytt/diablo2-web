/**
 * Issues #1198..#1202 (VFX Parity Unit B16-p7): 1.13c Monster Skills VFX Parity.
 *
 * - #1198 (B16-37): #314 fenris rage (CltSt51 @ 0x6FB74990, CltDo79 @ 0x6FB742B0) & #301 Siege Beast Stomp (CltDo75 @ 0x6FB74830)
 * - #1199 (B16-38): Catapult skills #287/#288/#303/#304/#305 (CltSt47 @ 0x6FB752E0) + CltHitFunc 46/47/48/2/50
 * - #1200 (B16-39): Vine skills #294 Vine Attack / #307 CorpseCycler / #325 VineCycler (CltSt49 @ 0x6FB75C70, CltPrg93 @ 0x6FB75670)
 * - #1201 (B16-40): #161 MagottUp (CltSt32 @ 0x6FB07200: dirt pile #322 / sand pile #76) & #284 Baal Taunt (CltSt46 @ 0x6FB74FC0: baal taunt control #546)
 * - #1202 (B16-41): Movement/mode monster CltDoFunc (46/47/49/50/52/59/62/64/37) & CltSt38 (#159, #162, #166, #167/#320, #176, #180/#293, #198, #206, #216 QueenDeath, #352 SerpentCharge)
 */

import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { SELF_BUFF_SKILL_STATES } from '../src/client/world/world-skill-state-tables.ts'
import {
  CLT_ST47_CATAPULT_BALL_113C,
  CLT_ST49_VINE_OCTANT_OFFSETS_113C,
} from '../src/client/world/world-skill-missiles.ts'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
  getSkillCastOverlay,
} from '../src/common/skills/missiles-data.ts'
import { STATE_OVERLAYS } from '../src/client/render/overlays-meta.ts'

function makeWorld() {
  const world = new ClientWorld()
  world.setCollisionChecker(() => false)
  const spawned: string[] = []
  const orig = world.spawnMissileByKey.bind(world)
  vi.spyOn(world, 'spawnMissileByKey').mockImplementation((key, sx, sy, tx, ty, opts) => {
    spawned.push(key)
    return orig(key, sx, sy, tx, ty, opts)
  })
  return { world, spawned }
}

function assignMonster(world: ClientWorld, id: number, classId: number, x: number, y: number) {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id, classId, x, y, mode: 1, lifePct: 128 },
  } as any)
  return world.monsters.get(id)!
}

function assignDeadCorpse(world: ClientWorld, id: number, classId: number, x: number, y: number) {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 'monster', id, classId, x, y, mode: 12, dead: true, lifePct: 0 },
  } as any)
  const m = world.monsters.get(id)!
  m.dead = true
  m.mode = 12
  m.lifePct = 0
  return m
}

function castSkill(
  world: ClientWorld,
  caster: any,
  skillId: number,
  targetX: number,
  targetY: number,
  skillLevel = 1,
) {
  ;(world as any).applySkillCastToUnit(caster, skillId, targetX, targetY, skillLevel, true)
}

describe('Issue #1198 (B16-37): #314 fenris rage (CltDo79) & #301 Siege Beast Stomp (CltDo75)', () => {
  it('#314 fenris rage consumes target corpse (state 104), sets state 138 (fenris_rage -> direwolfcharged), and spawns corpseexplosion (#115)', () => {
    expect(SELF_BUFF_SKILL_STATES[314]).toBe(138)
    expect(STATE_OVERLAYS[138]).toContain('direwolfcharged')
    expect(CANONICAL_113C_MISSILES['corpseexplosion']?.id).toBe(115)

    const { world, spawned } = makeWorld()
    const wolf = assignMonster(world, 3140, 420, 100, 100)
    const corpse = assignDeadCorpse(world, 3141, 1, 102, 101)

    castSkill(world, wolf, 314, 102, 101, 1)

    expect(corpse.states.has(104)).toBe(true)
    expect(wolf.states.has(138)).toBe(true)
    expect(spawned).toEqual(['corpseexplosion'])
    const ce = world.getUnitsByType('missile').find((m) => m.missileKey === 'corpseexplosion')!
    expect(ce).toBeDefined()
    expect(ce.x).toBe(102)
    expect(ce.y).toBe(101)
    expect(ce.vx).toBe(0)
    expect(ce.vy).toBe(0)
  })

  it('#301 Siege Beast Stomp attaches castoverlay siege_beast_dust (#245), triggers 1.13c screen shake (amp=8, sustain=800ms, rampUp=200ms, rampDown=600ms), and spawns 0 missiles', () => {
    expect(getSkillCastOverlay(301)).toBe('siege_beast_dust')
    const { world, spawned } = makeWorld()
    const beast = assignMonster(world, 3010, 484, 100, 100)
    const shakeSpy = vi.spyOn(world, 'startScreenShake')

    castSkill(world, beast, 301, 104, 100, 1)

    expect(beast.overlays.some((o) => o.token === 'siege_beast_dust')).toBe(true)
    expect(shakeSpy).toHaveBeenCalledWith(800, 8, 200, 600)
    expect(spawned).toEqual([])
  })
})

describe('Issue #1199 (B16-38): Catapult skills #287/#288/#303/#304/#305 (CltSt47)', () => {
  it('all 5 catapult skills map to canonical 1.13c Missiles.txt rows with Range=25 and AlwaysExplode=1', () => {
    expect(CLT_ST47_CATAPULT_BALL_113C).toEqual({
      287: 'catapultchargedball',
      288: 'catapult spike ball',
      303: 'catapult cold ball',
      304: 'catapult plague ball',
      305: 'catapult meteor ball',
    })
    for (const ballKey of Object.values(CLT_ST47_CATAPULT_BALL_113C)) {
      const row = getMissileTxtData(ballKey)
      expect(row.name).toBe(ballKey)
      expect(row.range).toBe(25)
      expect(CANONICAL_113C_MISSILES[ballKey]?.alwaysExplode).toBe(true)
    }
  })

  it('#287 Catapult Charged Ball lobs catapultchargedball (#407) over 25 ticks and bursts into 4+(slvl-1)*2 catapultchargedballbolt (#408) with PATHTYPE_CHARGEDBOLT', () => {
    const { world, spawned } = makeWorld()
    const cat = assignMonster(world, 2870, 497, 100, 100)

    castSkill(world, cat, 287, 115, 110, 2)
    expect(spawned).toEqual(['catapultchargedball'])
    const ball = world.getUnitsByType('missile').find((m) => m.missileKey === 'catapultchargedball')!
    expect(ball.maxTicks).toBe(25)
    expect(ball.traj3d).toBeDefined()

    for (let i = 0; i < 25; i++) world.tick(40)

    const bolts = world
      .getUnitsByType('missile')
      .filter((m) => m.missileKey === 'catapultchargedballbolt')
    // slvl = 2 => cHitPar1 (4) + (2 - 1) * cHitPar2 (2) = 6 bolts
    expect(bolts).toHaveLength(6)
    for (const b of bolts) {
      expect(b.pathWaypoints?.length).toBeGreaterThan(0)
    }
  })

  it('#288 Catapult Spike Ball lobs catapult spike ball (#411) -> fireexplode (#103) + 8x catapult spike in air (#412) -> catapult spike on ground (#413) -> catapult spike explosion (#414)', () => {
    const { world, spawned } = makeWorld()
    const cat = assignMonster(world, 2880, 497, 100, 100)

    castSkill(world, cat, 288, 110, 105, 1)
    expect(spawned).toEqual(['catapult spike ball'])

    // Step 25 ticks for ball landing
    for (let i = 0; i < 25; i++) world.tick(40)
    expect(spawned).toContain('fireexplode')
    expect(spawned.filter((k) => k === 'catapult spike in air')).toHaveLength(8)

    // Step 50 ticks for catapult spike in air (Range=50) landing -> catapult spike on ground (#413)
    for (let i = 0; i < 50; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'catapult spike on ground')).toHaveLength(8)

    // Step 180 ticks for catapult spike on ground (Range=180) expiry -> catapult spike explosion (#414)
    for (let i = 0; i < 180; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'catapult spike explosion')).toHaveLength(8)
  })

  it('#303 CatapultBlizzard lobs catapult cold ball (#416) -> freezingarrowexp1 (#88) + 8x freezingarrowexp2 (#89) + 8x catapult cold explosion (#417)', () => {
    const { world, spawned } = makeWorld()
    const cat = assignMonster(world, 3030, 497, 100, 100)

    castSkill(world, cat, 303, 112, 108, 1)
    expect(spawned).toEqual(['catapult cold ball'])

    for (let i = 0; i < 25; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'freezingarrowexp1')).toHaveLength(1)
    expect(spawned.filter((k) => k === 'freezingarrowexp2')).toHaveLength(8)
    expect(spawned.filter((k) => k === 'catapult cold explosion')).toHaveLength(8)
  })

  it('#304 CatapultPlague lobs catapult plague ball (#419) -> 16x catapult plague cloud (#420, pCltHitFunc=2, cHitPar1=2, cHitPar2=2) -> poisonpuff (#42, pCltDoFunc=4)', () => {
    const { world, spawned } = makeWorld()
    const cat = assignMonster(world, 3040, 497, 100, 100)

    castSkill(world, cat, 304, 112, 108, 1)
    expect(spawned).toEqual(['catapult plague ball'])

    for (let i = 0; i < 25; i++) world.tick(40)
    const clouds = spawned.filter((k) => k === 'catapult plague cloud')
    expect(clouds).toHaveLength(16)

    for (let i = 0; i < 80; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'poisonpuff').length).toBeGreaterThan(0)
  })

  it('#305 CatapultMeteor lobs catapult meteor ball (#422) -> 10x moltenboulder-flyingrocks (#456) + 18x catapult meteor fire (#423)', () => {
    const { world, spawned } = makeWorld()
    const cat = assignMonster(world, 3050, 497, 100, 100)

    castSkill(world, cat, 305, 114, 106, 2)
    expect(spawned).toEqual(['catapult meteor ball'])

    for (let i = 0; i < 25; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'moltenboulder-flyingrocks')).toHaveLength(10)
    const fires = world
      .getUnitsByType('missile')
      .filter((m) => m.missileKey === 'catapult meteor fire')
    expect(fires).toHaveLength(18)
    // slvl = 2 => Range 90 + (2 - 1) * 25 = 115
    expect(fires[0]!.maxTicks).toBe(115)
  })
})

describe('Issue #1200 (B16-39): Vine skills #294 Vine Attack / #307 CorpseCycler / #325 VineCycler (CltSt49)', () => {
  it('#294 Vine Attack spawns stationary vine beast attack (#469) + min(12, 2+slvl) vines (#471) -> vines trail (#472) -> vines wither (#473)', () => {
    expect(CLT_ST49_VINE_OCTANT_OFFSETS_113C).toHaveLength(8)
    const { world, spawned } = makeWorld()
    const vine = assignMonster(world, 2940, 506, 100, 100)

    castSkill(world, vine, 294, 106, 100, 3)
    expect(spawned.filter((k) => k === 'vine beast attack')).toHaveLength(1)
    // slvl = 3 => min(12, 2 + 3) = 5 vines
    expect(spawned.filter((k) => k === 'vines')).toHaveLength(5)

    // Step 10 ticks so vines (CltParam1=9) emit vines trail (#472, Range=100+2*25=150) at tick 0 and tick 9
    for (let i = 0; i < 10; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'vines trail').length).toBeGreaterThanOrEqual(5)

    // Step 150 ticks so vines trail expires and spawns vines wither (#473) via pCltHitFunc=54
    for (let i = 0; i < 150; i++) world.tick(40)
    expect(spawned.filter((k) => k === 'vines wither').length).toBeGreaterThanOrEqual(5)
  })

  it('#307 CorpseCycler & #325 VineCycler consume corpse (state 104) and spawn vine beast attack (#469) + recycler delay (#498) -> recycler explosion (#501) + recycler vine (#499) -> recycler fade (#500) + steallife overlay', () => {
    for (const skillId of [307, 325] as const) {
      const { world, spawned } = makeWorld()
      const attachSpy = vi.spyOn(world, 'attachUnitOverlay')
      const vine = assignMonster(world, skillId * 10, 425, 100, 100)
      const corpse = assignDeadCorpse(world, skillId * 10 + 1, 1, 102, 101)

      castSkill(world, vine, skillId, 102, 101, 1)
      expect(corpse.states.has(104)).toBe(true)
      expect(spawned).toEqual(['vine beast attack', 'recycler delay'])

      // Step 10 ticks: tick 0 spawns recycler explosion (#501) + recycler vine (#499, Range=60);
      // tick 7 (47 - 7 = 40 = CltParam1) attaches ProgOverlay='steallife' to owner.
      for (let i = 0; i < 10; i++) world.tick(40)
      expect(spawned).toContain('recycler explosion')
      expect(spawned).toContain('recycler vine')
      expect(attachSpy).toHaveBeenCalledWith(vine, 'steallife', false)

      // Step 52 more ticks (total 62): tick 61 recycler vine expires -> spawns recycler fade (#500) via pCltHitFunc=56.
      for (let i = 0; i < 52; i++) world.tick(40)
      expect(spawned).toContain('recycler fade')
    }
  })
})

describe('Issue #1201 (B16-40): #161 MagottUp (CltSt32) & #284 Baal Taunt (CltSt46)', () => {
  it('#161 MagottUp spawns sand pile (#76) in Act 2 (areaId 40..74) and dirt pile (#322) in non-Act 2 areas', () => {
    const { world: worldA2, spawned: spawnedA2 } = makeWorld()
    worldA2.areaId = 45 // Act 2 Rocky Waste / Dry Hills
    const maggotA2 = assignMonster(worldA2, 1610, 195, 100, 100)
    castSkill(worldA2, maggotA2, 161, 100, 100, 1)
    expect(spawnedA2).toEqual(['sand pile'])

    const { world: worldA1, spawned: spawnedA1 } = makeWorld()
    worldA1.areaId = 2 // Act 1 Blood Moor
    const maggotA1 = assignMonster(worldA1, 1611, 195, 100, 100)
    castSkill(worldA1, maggotA1, 161, 100, 100, 1)
    expect(spawnedA1).toEqual(['dirt pile'])
  })

  it('#284 Baal Taunt spawns baal taunt control (#546) -> baal taunt poison control (#655) -> 16x baal taunt poison (#549) -> poisonpuff (#42) AND baal taunt lightning control (#654) -> baal taunt lightning (#547) -> lightninghit (#99) + baal taunt lightning trail (#548)', () => {
    const { world, spawned } = makeWorld()
    const baal = assignMonster(world, 2840, 544, 100, 100)

    castSkill(world, baal, 284, 110, 110, 1)
    expect(spawned).toEqual(['baal taunt control'])

    for (let i = 0; i < 65; i++) world.tick(40)
    expect(spawned).toContain('baal taunt poison control')
    expect(spawned.filter((k) => k === 'baal taunt poison')).toHaveLength(16)
    expect(spawned).toContain('poisonpuff')
    expect(spawned).toContain('baal taunt lightning control')
    expect(spawned).toContain('baal taunt lightning')
    expect(spawned).toContain('baal taunt lightning trail')
    expect(spawned).toContain('lightninghit')
  })
})

describe('Issue #1202 (B16-41): Movement/mode monster CltDoFunc (46/47/49/50/52/59/62/64/37) & CltSt38', () => {
  it('#216 QueenDeath (CltDo64) spawns queendeathcenter (#353) -> queendeathglob (#354) -> queendeathsplat1/2 (#355/#356)', () => {
    const { world, spawned } = makeWorld()
    const queen = assignMonster(world, 2160, 292, 100, 100)

    castSkill(world, queen, 216, 100, 100, 1)
    expect(spawned).toEqual(['queendeathcenter'])

    for (let i = 0; i < 25; i++) world.tick(40)
    expect(spawned).toContain('queendeathglob')
    expect(
      spawned.some((k) => k === 'queendeathsplat1' || k === 'queendeathsplat2'),
    ).toBe(true)
  })

  it('movement/mode/flag monster skills (#159, #162, #166, #167, #176, #180, #198, #206, #293, #320, #352) spawn 0 missiles and 0 bogus overlays', () => {
    const pureModeSkills = [159, 162, 166, 167, 176, 180, 198, 206, 293, 320, 352] as const
    for (const skillId of pureModeSkills) {
      const { world, spawned } = makeWorld()
      const mon = assignMonster(world, 5000 + skillId, 195, 100, 100)
      castSkill(world, mon, skillId, 105, 105, 1)
      expect(spawned, `skill #${skillId}`).toEqual([])
      expect(mon.overlays, `skill #${skillId}`).toEqual([])
    }
  })
})
