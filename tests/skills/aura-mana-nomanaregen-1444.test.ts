/**
 * Issue #1444 — 1.13c Aura Pulse Mana Cost (`mana/lvlmana/manashift`) & `STATE_NOMANAREGEN` (`85`) Parity.
 *
 * Binary & MPQ ground truth (`samples/d2/D2Common.dll`, `samples/d2/D2Game.dll`, `samples/d2/excel/Skills.txt`):
 * - `D2Common.dll` ordinal 10090 (`0x6FD9EA00`, called via `0x6FC2AF58` in `D2Game.dll`):
 *     `manaCost256 = (mana + lvlmana * (slvl - 1)) << manashift`
 *   - `#99` Prayer (`mana=16, lvlmana=3, manashift=4`): `256` at `slvl=1`, `1168` at `slvl=20`.
 *   - `#119` Sanctuary (`mana=1, lvlmana=0, manashift=8`): `256` at all `slvl`.
 *   - All other `aura=1` skills have `mana=0, lvlmana=0` (`0` mana cost).
 * - `SKILLS_SrvDo065` (`0x6FCBA8D0`, `0x6FCBA99F..0x6FCBA9B0`, `0x6FCBAB66..0x6FCBABA7`) &
 *   `SKILLS_AuraCallback_BasicAura` (`0x6FCBA357..0x6FCBA36E`):
 *   - When a player caster has `curMana256 < manaCost256`, `aurastat1..6` evaluation is skipped (`0` units healed),
 *     `STATE_NOMANAREGEN` (`85`) is toggled OFF (`0`), `0` mana is deducted, and the aura remains active.
 *   - When `unitsHealed > 0` (`newHp > curHp`), `STATE_NOMANAREGEN` (`85`, `'nomanaregen'`) is toggled ON (`1`)
 *     and `manaCost256` is deducted via `0x6FCBED20`.
 *   - When `unitsHealed === 0` (e.g. caster and party allies at full HP), `STATE_NOMANAREGEN` (`85`) is toggled OFF
 *     (`0`) and `0` mana is deducted.
 *   - Non-player casters (`dwUnitType != UNIT_PLAYER`: monsters, mercenaries, pets) never consume mana and never
 *     toggle `STATE_NOMANAREGEN` (`85`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { AuraScanner, computeAuraPulseManaCost256 } from '../../src/server/engine/aura-scanner.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

describe('Issue #1444: 1.13c Aura Pulse Mana Cost & STATE_NOMANAREGEN (85) Parity', () => {
  it('class-of-bug sweep: verifies Skills.txt mana/lvlmana/manashift across all 23 aura=1 skills', async () => {
    const registry = await getSharedDataRegistry()
    const auraSkillIds = [
      98, 99, 100, 102, 103, 104, 105, 108, 109, 110, 113, 114, 115, 118, 119, 120, 122, 123, 124, 125,
      296, 297, 298,
    ]
    for (const id of auraSkillIds) {
      const skill = registry.getSkillById(id)!
      expect(skill).toBeDefined()
      expect(skill.aura).toBe(true)
      if (id === 99) {
        // Prayer: mana=16, lvlmana=3, manashift=4 -> (16 + 3*(slvl-1)) << 4
        expect(skill.mana).toBe(16)
        expect(skill.lvlMana).toBe(3)
        expect(skill.manaShift).toBe(4)
        expect(computeAuraPulseManaCost256(skill, 1)).toBe(256)
        expect(computeAuraPulseManaCost256(skill, 10)).toBe((16 + 3 * 9) << 4) // 688
        expect(computeAuraPulseManaCost256(skill, 20)).toBe(1168)
      } else if (id === 119) {
        // Sanctuary: mana=1, lvlmana=0, manashift=8 -> 256
        expect(skill.mana).toBe(1)
        expect(skill.lvlMana).toBe(0)
        expect(skill.manaShift).toBe(8)
        expect(computeAuraPulseManaCost256(skill, 1)).toBe(256)
        expect(computeAuraPulseManaCost256(skill, 20)).toBe(256)
      } else {
        expect(computeAuraPulseManaCost256(skill, 1)).toBe(0)
        expect(computeAuraPulseManaCost256(skill, 20)).toBe(0)
      }
    }
  })

  it('Prayer (#99) deducts 256 at slvl=1 and 1168 at slvl=20 per pulse when healing, and toggles nomanaregen ON', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)

    // slvl 1: heals 2 HP, costs 256 mana256
    const stats1 = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 400 * FIXED_ONE,
      maxmana: 100 * FIXED_ONE,
      mana: 2000,
    })
    const pal1: CombatUnitContext = {
      id: 'pal_1',
      name: 'Paladin slvl 1',
      unitType: 'player',
      statList: stats1,
      stateBus: new StateBus(stats1, registry),
      x: 0,
      y: 0,
    }
    const aura1 = scanner.setActiveAura(pal1, 99, 1, 0)!
    const out1 = scanner.pulseAura(aura1, 50, [pal1], [])
    expect(out1.unitsHealed).toBe(1)
    expect(out1.manaSpent256).toBe(256)
    expect(pal1.statList.getHp256()).toBe(402 * FIXED_ONE)
    expect(pal1.statList.getMana256()).toBe(2000 - 256)
    expect(pal1.stateBus.hasState('nomanaregen')).toBe(true)

    // slvl 20: heals 25 HP, costs 1168 mana256
    const stats20 = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 400 * FIXED_ONE,
      maxmana: 100 * FIXED_ONE,
      mana: 5000,
    })
    const pal20: CombatUnitContext = {
      id: 'pal_20',
      name: 'Paladin slvl 20',
      unitType: 'player',
      statList: stats20,
      stateBus: new StateBus(stats20, registry),
      x: 0,
      y: 0,
    }
    const aura20 = scanner.setActiveAura(pal20, 99, 20, 0)!
    const out20 = scanner.pulseAura(aura20, 50, [pal20], [])
    expect(out20.unitsHealed).toBe(1)
    expect(out20.manaSpent256).toBe(1168)
    expect(pal20.statList.getHp256()).toBe(425 * FIXED_ONE)
    expect(pal20.statList.getMana256()).toBe(5000 - 1168)
    expect(pal20.stateBus.hasState('nomanaregen')).toBe(true)
  })

  it('Prayer (#99) deducts 0 mana and turns nomanaregen OFF when caster and all allies in range are at full HP', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)

    const statsCaster = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 499 * FIXED_ONE,
      maxmana: 100 * FIXED_ONE,
      mana: 3000,
    })
    const caster: CombatUnitContext = {
      id: 'pal_caster',
      name: 'Paladin Caster',
      unitType: 'player',
      statList: statsCaster,
      stateBus: new StateBus(statsCaster, registry),
      x: 0,
      y: 0,
    }
    const statsAlly = new UnitStatList(registry, {
      maxhp: 400 * FIXED_ONE,
      hitpoints: 400 * FIXED_ONE,
    })
    const ally: CombatUnitContext = {
      id: 'ally_1',
      name: 'Full HP Ally',
      unitType: 'party',
      statList: statsAlly,
      stateBus: new StateBus(statsAlly, registry),
      x: 4,
      y: 4,
    }

    const aura = scanner.setActiveAura(caster, 99, 1, 0)!
    // Pulse 1: caster is at 499/500 -> heals 1 HP to 500/500, deducts 256, turns nomanaregen ON
    const p1 = scanner.pulseAura(aura, 50, [caster, ally], [])
    expect(p1.unitsHealed).toBe(1)
    expect(p1.manaSpent256).toBe(256)
    expect(caster.statList.getHp256()).toBe(500 * FIXED_ONE)
    expect(caster.statList.getMana256()).toBe(3000 - 256)
    expect(caster.stateBus.hasState('nomanaregen')).toBe(true)

    // Pulse 2: both caster (500/500) and ally (400/400) are at full HP -> 0 healed, 0 mana deducted, nomanaregen OFF
    const p2 = scanner.pulseAura(aura, 100, [caster, ally], [])
    expect(p2.unitsHealed).toBe(0)
    expect(p2.manaSpent256).toBe(0)
    expect(caster.statList.getMana256()).toBe(3000 - 256)
    expect(caster.stateBus.hasState('nomanaregen')).toBe(false)
  })

  it('Prayer (#99) skips healing, deducts 0 mana, turns nomanaregen OFF, and stays active when curMana256 < manaCost256', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)

    // slvl 20 requires 1168 mana256; give Paladin 1000 mana256 (< 1168)
    const stats = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 300 * FIXED_ONE,
      maxmana: 100 * FIXED_ONE,
      mana: 1000,
    })
    const pal: CombatUnitContext = {
      id: 'pal_lowmana',
      name: 'Paladin Low Mana',
      unitType: 'player',
      statList: stats,
      stateBus: new StateBus(stats, registry),
      x: 0,
      y: 0,
    }
    pal.stateBus.applyState({ stateNameOrId: 'nomanaregen', sourceUnitId: pal.id, sourceSkillId: 99, slvl: 20 })
    expect(pal.stateBus.hasState('nomanaregen')).toBe(true)

    const aura = scanner.setActiveAura(pal, 99, 20, 0)!
    const out = scanner.pulseAura(aura, 50, [pal], [])
    expect(out.unitsHealed).toBe(0)
    expect(out.manaSpent256).toBe(0)
    expect(pal.statList.getHp256()).toBe(300 * FIXED_ONE)
    expect(pal.statList.getMana256()).toBe(1000)
    expect(pal.stateBus.hasState('nomanaregen')).toBe(false)
    expect(pal.stateBus.hasState('prayer')).toBe(true)
  })

  it('Sanctuary (#119) deducts 256 mana256 and toggles nomanaregen ON when hitting undead, and turns nomanaregen OFF with 0 mana when no undead are hit', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)

    const palStats = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 500 * FIXED_ONE,
      maxmana: 100 * FIXED_ONE,
      mana: 2000,
    })
    const pal: CombatUnitContext = {
      id: 'pal_sanctuary',
      name: 'Paladin Sanctuary',
      unitType: 'player',
      statList: palStats,
      stateBus: new StateBus(palStats, registry),
      x: 100,
      y: 100,
    }
    const skelStats = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 500 * FIXED_ONE,
    })
    const skel: CombatUnitContext = {
      id: 'skel_1',
      name: 'Skeleton',
      unitType: 'monster',
      isUndead: true,
      statList: skelStats,
      stateBus: new StateBus(skelStats, registry),
      x: 102,
      y: 100,
    }

    const aura = scanner.setActiveAura(pal, 119, 5, 0)!
    // Pulse with undead in range -> enemiesAffected = 1, manaSpent256 = 256, nomanaregen ON
    const p1 = scanner.pulseAura(aura, 50, [pal], [skel])
    expect(p1.enemiesAffected).toBe(1)
    expect(p1.manaSpent256).toBe(256)
    expect(pal.statList.getMana256()).toBe(2000 - 256)
    expect(pal.stateBus.hasState('nomanaregen')).toBe(true)

    // Pulse with no undead in range -> enemiesAffected = 0, manaSpent256 = 0, nomanaregen OFF
    const p2 = scanner.pulseAura(aura, 100, [pal], [])
    expect(p2.enemiesAffected).toBe(0)
    expect(p2.manaSpent256).toBe(0)
    expect(pal.statList.getMana256()).toBe(2000 - 256)
    expect(pal.stateBus.hasState('nomanaregen')).toBe(false)
  })

  it('Act 2 Desert Mercenary / Monster Prayer (#99) heals allies with 0 mana cost and never sets nomanaregen', async () => {
    const registry = await getSharedDataRegistry()
    const scanner = new AuraScanner(registry)

    const mercStats = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 400 * FIXED_ONE,
      maxmana: 0,
      mana: 0,
    })
    const merc: CombatUnitContext = {
      id: 'merc_1',
      name: 'Desert Mercenary',
      unitType: 'mercenary',
      statList: mercStats,
      stateBus: new StateBus(mercStats, registry),
      x: 0,
      y: 0,
    }
    const playerStats = new UnitStatList(registry, {
      maxhp: 500 * FIXED_ONE,
      hitpoints: 350 * FIXED_ONE,
    })
    const player: CombatUnitContext = {
      id: 'player_1',
      name: 'Player',
      unitType: 'player',
      statList: playerStats,
      stateBus: new StateBus(playerStats, registry),
      x: 3,
      y: 4,
    }

    const aura = scanner.setActiveAura(merc, 99, 10, 0)!
    const out = scanner.pulseAura(aura, 50, [merc, player], [])
    expect(out.unitsHealed).toBe(2)
    expect(out.manaSpent256).toBe(0)
    expect(merc.statList.getHp256()).toBe(411 * FIXED_ONE)
    expect(player.statList.getHp256()).toBe(361 * FIXED_ONE)
    expect(merc.stateBus.hasState('nomanaregen')).toBe(false)
  })

  it('GameInstance integration: Prayer sets state 85 (nomanaregen) while healing and clears state 85 when full HP', () => {
    const game = new GameInstance({ seed: 0x1444, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'PrayerPal',
          charClass: 3, // Paladin
          level: 30,
          skillLevels: new Uint8Array(30),
          items: [],
          attributesOverrides: {
            maxManaFixed: 200 * FIXED_ONE,
            manaFixed: 200 * FIXED_ONE,
            maxHpFixed: 500 * FIXED_ONE,
            hitpointsFixed: 500 * FIXED_ONE,
          },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills: { 99: 10 }, // slvl 10 Prayer: heals 11 HP/pulse, costs (16 + 27) << 4 = 688 mana256/pulse
    })
    game.drainEvents(playerId)

    // Damage player by 10 HP (490 / 500)
    game.applyDamageToPlayer(playerId, 10)
    expect(game.getPlayerState(playerId)!.hp).toBe(490)

    // Activate Prayer (#99): immediate=1 pulse heals 10 HP back to 500, deducts 688 manaFixed, and sets state 85
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 99, x: 100, y: 100, hand: 'right' })
    game.stepFrames(1)
    const afterImmediate = game.getPlayerState(playerId)!
    expect(afterImmediate.hp).toBe(500)
    expect(afterImmediate.states.has(85)).toBe(true)

    // Advance to next periodic pulse (frame 50): player is now at full HP (500/500), so state 85 is cleared
    game.stepFrames(50)
    const afterSecondPulse = game.getPlayerState(playerId)!
    expect(afterSecondPulse.states.has(85)).toBe(false)
  })
})
