/**
 * Issue #955 regression tests: fabricated overlay mappings vs 1.13c ground truth.
 *
 * 1. The skill→castoverlay table must match Skills.txt `castoverlay` exactly (extracted
 *    from the MPQs; necromancer skills have NO cast overlay — their cast visuals are the
 *    cltmissilea projectiles).
 * 2. `pushOverlayLight` and the state-overlay loop must never throw on an unknown overlay
 *    token — an invented token used to abort the whole render loop every frame for the
 *    overlay's lifetime (TK-on-waypoint / Raise Skeleton "stutter").
 * 3. Client-side casts must not attach the invented `telekinesis` / `staticfield` target
 *    overlays, must not create predicted summon units, and corpse skills must not fire on
 *    empty ground.
 */

import { describe, expect, it } from 'vitest'
import { getSkillCastOverlay } from '../../src/common/skills/missiles-data.ts'
import {
  clearMissingArtEntries,
  getMissingArtEntries,
} from '../../src/client/scene/missing-art.ts'
import { pushOverlayLight } from '../../src/client/view/unit-drawables.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

/** Skills.txt `castoverlay` ground truth for every player skill with a non-empty value. */
const MPQ_CAST_OVERLAYS_113C: Readonly<Record<number, string>> = Object.freeze({
  8: 'cast_innersight', // Inner Sight
  17: 'cast_slowmissiles', // Slow Missiles
  36: 'fire_cast_1', // Fire Bolt
  38: 'light_cast_1', // Charged Bolt
  39: 'ice_cast_1', // Ice Bolt
  40: 'ice_cast_1', // Frozen Armor
  42: 'light_cast_1', // Static Field
  43: 'light_cast_2', // Telekinesis
  44: 'ice_cast_2', // Frost Nova
  45: 'ice_cast_1', // Ice Blast
  46: 'fire_cast_2', // Blaze
  47: 'fire_cast_2', // Fire Ball
  48: 'light_cast_1', // Nova
  49: 'light_cast_1', // Lightning
  50: 'ice_cast_2', // Shiver Armor
  51: 'fire_cast_2', // Fire Wall
  53: 'light_cast_1', // Chain Lightning
  54: 'teleport', // Teleport
  55: 'ice_cast_2', // Glacial Spike
  56: 'fire_cast_2', // Meteor
  57: 'light_cast_2', // Thunder Storm
  58: 'light_cast_2', // Energy Shield
  59: 'ice_cast_3', // Blizzard
  60: 'ice_cast_3', // Chilling Armor
  62: 'fire_cast_2', // Hydra
  64: 'ice_cast_3', // Frozen Orb
  101: 'cast_undead', // Holy Bolt
  119: 'cast_undead', // Sanctuary
  154: 'warcry', // War Cry
  225: 'druid_fire_cast_1', // Firestorm
  229: 'druid_fire_cast_1', // Molten Boulder
  234: 'druid_fire_cast_2', // Eruption
  244: 'druid_fire_cast_2', // Volcano
  249: 'druid_fire_cast_2', // Armageddon
  253: 'psychic_hammer_curse', // Psychic Hammer
})

/** Every id whose mapping was previously fabricated (must resolve to `undefined` now). */
const FABRICATED_IDS: readonly number[] = Object.freeze([
  32, 41, 52, // Valkyrie / Inferno / Enchant
  66, 67, 68, 70, 71, 72, 74, 76, 77, 78, 80, 81, 82, 83, 84, 86, 87, 88, 91, 92, 93, 95, // Necromancer
  100, 105, 110, 112, 116, 121, 125, // Paladin resist auras / Blessed Hammer / Conversion / FoH
  126, 138, 143, 149, 155, // Barbarian
  223, 228, // Druid morphs
])

describe('Issue #955 — cast overlay parity with 1.13c Skills.txt', () => {
  it('resolves exactly the MPQ castoverlay values', () => {
    for (const [id, overlay] of Object.entries(MPQ_CAST_OVERLAYS_113C)) {
      expect(getSkillCastOverlay(Number(id)), `skill ${id}`).toBe(overlay)
    }
  })

  it('resolves no fabricated overlays anymore', () => {
    for (const id of FABRICATED_IDS) {
      expect(getSkillCastOverlay(id), `skill ${id}`).toBeUndefined()
    }
  })
})

describe('Issue #955 — overlay light fault containment', () => {
  it('pushOverlayLight reports an unknown token once instead of throwing every frame', () => {
    clearMissingArtEntries()
    const unit = { kind: 'monster', id: 1, x: 5000, y: 5000 } as never
    const out: unknown[] = []
    expect(() => pushOverlayLight(out as never, unit, 'ov:1', 'telekinesis')).not.toThrow()
    expect(() => pushOverlayLight(out as never, unit, 'ov:2', 'telekinesis')).not.toThrow()
    expect(out).toHaveLength(0)
    const entries = getMissingArtEntries().filter(e => e.category === 'overlay-light')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.id).toBe('telekinesis')
    clearMissingArtEntries()
  })
})

describe('Issue #955 — client cast prediction hygiene', () => {
  function createWorldWithRightSkill(skillId: number): ClientWorld {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 2, name: 'NecroHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: skillId })
    return world
  }

  it('Telekinesis (43) attaches no invented target overlay; the caster keeps its real light_cast_2', () => {
    const world = createWorldWithRightSkill(43)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 50, classId: 140, name: 'Fallen', x: 5020, y: 5000 },
    })
    const cmd: ClientCommand = { type: 'SkillAt', hand: 'right', at: { x: 5020, y: 5000 }, hold: false }
    world.noteOutgoingCommand(cmd)

    const caster = world.getUnit('player', 1)!
    expect(caster.overlays?.some(o => o.token === 'light_cast_2')).toBe(true)
    const fallen = world.getUnit('monster', 50)!
    expect(fallen.overlays ?? []).toHaveLength(0)
  })

  it('Raise Skeleton (70) spawns only the corpseexplosion missile — no predicted summon unit, no bonecast', () => {
    const world = createWorldWithRightSkill(70)
    const cmd: ClientCommand = { type: 'SkillAt', hand: 'right', at: { x: 5010, y: 5000 }, hold: false }
    world.noteOutgoingCommand(cmd)

    // Issue #905: cltmissilea spawns at the cast animation's action frame.
    const caster = world.getUnit('player', 1)!
    const cs = caster.castState
    if (cs && cs.missileFireDelayMs !== undefined && cs.missileFireDelayMs > 0) {
      world.expireCastStates(cs.startedAtMs + cs.missileFireDelayMs, 0)
    }

    const monsters = Array.from(world.units.values()).filter(u => u.unitType === 'monster')
    expect(monsters.filter(m => m.classId === 363)).toHaveLength(0)
    const missiles = Array.from(world.units.values()).filter(u => u.unitType === 'missile')
    expect(missiles.filter(m => m.missileKey === 'corpseexplosion')).toHaveLength(1)
    expect(missiles.filter(m => m.missileKey === 'bonecast')).toHaveLength(0)
  })

  it('Static Field (42) attaches no invented staticfield overlay on nearby monsters', () => {
    const world = createWorldWithRightSkill(42)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 51, classId: 140, name: 'Fallen', x: 5008, y: 5000 },
    })
    const cmd: ClientCommand = { type: 'SkillAt', hand: 'right', at: { x: 5008, y: 5000 }, hold: false }
    world.noteOutgoingCommand(cmd)

    const fallen = world.getUnit('monster', 51)!
    expect(fallen.overlays ?? []).toHaveLength(0)
    const caster = world.getUnit('player', 1)!
    expect(caster.overlays?.some(o => o.token === 'light_cast_1')).toBe(true)
  })
})

describe('Issue #955 — corpse skills never cast on empty ground', () => {
  function createTestSetup() {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const sentCommands: ClientCommand[] = []
    const hudModel = new HudModel({ world, hudManager, onCommand: (cmd) => sentCommands.push(cmd) })
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(5000, 5000)
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 2,
      name: 'NecroHero',
      x: 5000,
      y: 5000,
    })

    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter,
      sendCommand: (cmd) => sentCommands.push(cmd),
    })
    return { world, hudManager, mapper, sentCommands }
  }

  it('Raise Skeleton on empty ground sends nothing; on a hovered corpse it sends SkillOn', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = 70

    // Empty ground: vanilla sends no packet for a corpse skill (Issue #955).
    expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 2000)).toBeNull()
    expect(sentCommands).toHaveLength(0)

    // Hovered corpse: the cast targets the corpse unit.
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 60, classId: 140, name: 'Fallen', x: 5010, y: 5010 },
    })
    const corpse = world.getUnit('monster', 60)!
    corpse.dead = true
    corpse.mode = 12

    const rec = mapper.triggerSecondaryWorldAction(5010, 5010, corpse, 2100)
    expect(rec).not.toBeNull()
    expect(sentCommands.map(c => c.type)).toEqual(['SkillOn'])
  })

  it('non-corpse skills are unaffected (ground SkillAt still dispatches)', () => {
    const { world, mapper, sentCommands } = createTestSetup()
    world.self.rightSkill = 47 // Fire Ball

    const rec = mapper.triggerSecondaryWorldAction(5010, 5010, null, 2000)
    expect(rec).not.toBeNull()
    expect(sentCommands.map(c => c.type)).toEqual(['SkillAt'])
  })
})
