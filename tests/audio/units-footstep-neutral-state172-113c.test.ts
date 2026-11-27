import { describe, expect, it } from 'vitest'
import {
  FOOTSTEP_MATERIAL_OFFSET_113C,
  computeFootstepVolume113c,
  footstepCircularDistance113c,
  isFootstepStepFrame113c,
  isMonsterFootstepMode113c,
  isMonsterNeutralSoundMode113c,
  resolveFootstepMaterial113c,
  resolveFootstepSoundId113c,
  resolvePlayerFootstepSoundId113c,
} from '../../src/client/audio/footstep-113c.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

describe('Issues #1530, #1532, #1534, #1536: 1.13c footstep scheduler, terrain material & run variants, monster Neutral sound, and state 172 restinpeace', () => {
  it('#1532: resolves footstep material from SoundEnviron.txt Material1 (0x6FAD26A0) and applies 0x6FAD3050 material + run (+24) offsets (0x6FAD2FB0)', () => {
    // 1. Material table offsets: 1->0, 2->+4, 3->+8, 4->+12, 5->+20, 6->+16
    expect(FOOTSTEP_MATERIAL_OFFSET_113C).toEqual({
      1: 0,
      2: 4,
      3: 8,
      4: 12,
      5: 20,
      6: 16,
    })

    // 2. Level SoundEnviron Material1 resolution
    expect(resolveFootstepMaterial113c(1)).toBe(1) // Rogue Encampment -> Dirt (1)
    expect(resolveFootstepMaterial113c(5)).toBe(1) // Dark Wood -> Dirt (1)
    expect(resolveFootstepMaterial113c(33)).toBe(2) // Cathedral -> Indoor Stone (2)
    expect(resolveFootstepMaterial113c(40)).toBe(3) // Lut Gholein -> Outdoor Stone (3)
    expect(resolveFootstepMaterial113c(41)).toBe(4) // Rocky Waste (Desert) -> Sand (4)
    expect(resolveFootstepMaterial113c(120)).toBe(3) // Arreat Summit -> Outdoor Stone (3)
    expect(resolveFootstepMaterial113c(1, 5)).toBe(5) // explicit tile material Wood (5)
    expect(resolveFootstepMaterial113c(1, 6)).toBe(6) // explicit tile material Snow (6)

    // 3. Light (2720), Medium (2768), Heavy (2816) walk & run across materials
    expect(resolveFootstepSoundId113c(2720, 1, false)).toBe(2720) // light_walk_dirt_1
    expect(resolveFootstepSoundId113c(2720, 33, false)).toBe(2724) // light_walk_istone_1 (+4)
    expect(resolveFootstepSoundId113c(2720, 40, false)).toBe(2728) // light_walk_ostone_1 (+8)
    expect(resolveFootstepSoundId113c(2720, 41, false)).toBe(2732) // light_walk_sand_1 (+12)
    expect(resolveFootstepSoundId113c(2720, 109, false, 6)).toBe(2736) // light_walk_snow_1 (+16)
    expect(resolveFootstepSoundId113c(2720, 75, false, 5)).toBe(2740) // light_walk_wood_1 (+20)
    expect(resolveFootstepSoundId113c(2720, 1, true)).toBe(2744) // light_run_dirt_1 (+24)
    expect(resolveFootstepSoundId113c(2720, 75, true, 5)).toBe(2764) // light_run_wood_1 (+20 + 24)

    // 4. Player class footstep resolution (Barbarian classId=4 -> heavy 2816)
    expect(resolvePlayerFootstepSoundId113c(4, 2, 1)).toBe(2816) // heavy_walk_dirt_1
    expect(resolvePlayerFootstepSoundId113c(4, 3, 41)).toBe(2816 + 12 + 24) // heavy_run_sand_1 (2852)
    expect(resolvePlayerFootstepSoundId113c(4, 3, 109, 6)).toBe(2816 + 16 + 24) // heavy_run_snow_1 (2856)
  })

  it('#1530: 0x6FAD3C00 step-frame circular distance (0x6FB395D0), pause attenuation, FsPrb gating FootstepLayer only, and special monster modes', () => {
    // 1. Circular distance & local minimum step detection
    expect(footstepCircularDistance113c(0, 0, 1024)).toBe(0)
    expect(footstepCircularDistance113c(1000, 0, 1024)).toBe(24)
    expect(isFootstepStepFrame113c(0, 256, 0, 1024)).toBe(true)
    expect(isFootstepStepFrame113c(512, 256, 0, 1024)).toBe(false)

    // 2. Volume 255 (local player) vs 200 (other units) and pause attenuation (> 1.5 * stepTicks -> * 160 / 255)
    expect(computeFootstepVolume113c(true, 4, 4)).toBe(255)
    expect(computeFootstepVolume113c(true, 10, 4)).toBe(160)
    expect(computeFootstepVolume113c(false, 4, 4)).toBe(200)
    expect(computeFootstepVolume113c(false, 10, 4)).toBe(125)

    // 3. Special monster footstep modes: classId 15 (foulcrow1) in mode 1 (NU) and classId 110 (vulture1) in mode 8 (S1)
    expect(isMonsterFootstepMode113c(15, 1)).toBe(true)
    expect(isMonsterFootstepMode113c(19, 1)).toBe(false)
    expect(isMonsterFootstepMode113c(110, 8)).toBe(true)
    expect(isMonsterFootstepMode113c(19, 8)).toBe(false)

    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 2, mapSeed: 1, areaId: 41 }) // Rocky Waste (material1 = 4 Sand -> +12)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 201, classId: 19, x: 5100, y: 5100, mode: 1, lifePct: 128 },
    })
    world.drainWorldSoundRequests()

    // Monster RN (mode 15) in Rocky Waste -> 2720 + 12 (sand) + 24 (run) = 2756
    world.apply({ type: 'UnitMode', unitType: 1, id: 201, mode: 15, at: { x: 5100, y: 5100 } })
    const rnReqs = world.drainWorldSoundRequests()
    expect(rnReqs.map((r) => r.soundId)).toContain(2756)
    expect(rnReqs[0]?.volume).toBe(125) // First step after pause -> 200 * 160 / 255 = 125
  })

  it('#1534: 0x6FAD3905..0x6FAD3A20 monster Neutral sound modes (NU/WL/RN + vulture1 S1 + batdemon1 S4), pet exclusion, and randomized cooldown', () => {
    expect(isMonsterNeutralSoundMode113c(19, 1)).toBe(true)
    expect(isMonsterNeutralSoundMode113c(19, 2)).toBe(true)
    expect(isMonsterNeutralSoundMode113c(19, 15)).toBe(true)
    expect(isMonsterNeutralSoundMode113c(110, 8)).toBe(true)
    expect(isMonsterNeutralSoundMode113c(136, 11)).toBe(true)
    expect(isMonsterNeutralSoundMode113c(19, 8)).toBe(false)

    // Owned minion / pet must not emit neutral sound
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 301, classId: 19, x: 5100, y: 5100, mode: 1, lifePct: 128 },
    })
    ;(world.getUnit('monster', 301) as any).ownerId = 1
    world.drainWorldSoundRequests()
    for (let i = 0; i < 400; i++) {
      world.tick(40)
    }
    expect(world.drainWorldSoundRequests().some((r) => r.soundId === 907)).toBe(false)
  })

  it('#1536: StateSetFunc[17] (0x6FB23930) spawns redemption client missile on state 172 (restinpeace) and blocks corpse selection', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 401, classId: 19, x: 5120, y: 5120, mode: 12, lifePct: 0 },
    })
    const mapper = new CommandMapper()
    const corpse = world.getUnit('monster', 401)!
    expect(mapper.isMonsterCorpse(corpse, world)).toBe(true)

    world.apply({
      type: 'StateSet',
      unit: { unitType: 1, id: 401 },
      states: [{ state: 172, complete: true }],
    })

    // 1. Spawns client missile 'redemption' at the corpse position
    const missiles = Array.from(world.units.values()).filter(
      (u) => u.unitType === 'missile' && u.name === 'redemption',
    )
    expect(missiles).toHaveLength(1)
    expect(missiles[0]?.x).toBe(5120)
    expect(missiles[0]?.y).toBe(5120)

    // 2. Corpse with state 172 (udead=1) cannot be selected by corpse skills
    expect(mapper.isMonsterCorpse(corpse, world)).toBe(false)
  })
})
