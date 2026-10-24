/**
 * Diablo II: Lord of Destruction v1.13c — Sorceress Reactive Defense Hit Overlays (Unit B12-p2)
 * Refs #1130 (B12-7), #1131 (B12-8)
 *
 * Ground Truth References:
 * - `Skills.txt` (Patch_D2.mpq):
 *   - Skill #40 (`Frozen Armor`): `auraevent1=damagedinmelee`, `auraeventfunc1=2`, `cltoverlaya=frozenarmor_hit` (`Overlay.txt` row 42)
 *   - Skill #50 (`Shiver Armor`): `auraevent1=attackedinmelee`, `auraeventfunc1=3`, `cltoverlaya=shiverarmor_hit` (`Overlay.txt` row 43)
 *   - Skill #58 (`Energy Shield`): `auraevent1=absorbdamage`, `auraeventfunc1=24`, `prgoverlay=energyshieldhit0` (`Overlay.txt` row 87)
 * - `D2Game.dll` (`SkillSor.cpp`):
 *   - `SKILLS_EventFunc02_FrozenArmor` (`0x6FD180E0`, `SkillSor.cpp:1224-1244`):
 *     `if (pDamage->dwPhysDamage > 0) UNITS_SetOverlay(pUnit, pSkillsTxtRecord->wCltOverlayA, 0)` on the melee attacker (`pUnit`).
 *   - `SKILLS_EventFunc03_ShiverArmor` (`0x6FD18200`, `SkillSor.cpp:1247-1286`):
 *     `UNITS_SetOverlay(pUnit, pSkillsTxtRecord->wCltOverlayA, 0)` on the melee attacker (`pUnit`).
 *   - `SKILLS_EventFunc24_EnergyShield` (`0x6FD17820`, `SkillSor.cpp:1065-1069`):
 *     `if (pUnit && nAbsorbedDamage > 0 && pSkillsTxtRecord->wPrgOverlay >= 0)`
 *     `nOverlay = D2Common_11053(UNITS_GetDirectionToCoords(pAttacker, CLIENTS_GetUnitX(pUnit), CLIENTS_GetUnitY(pUnit))) + pSkillsTxtRecord->wPrgOverlay`
 *     `UNITS_SetOverlay(pAttacker, nOverlay, 0)` on the defending Sorceress (`pAttacker`).
 * - `D2Common.dll`:
 *   - `D2Common_11053` (`0x6FDA5600`, `Monsters.cpp:693`): maps 64-direction `0..63` to 8-direction `0..7` via `byte_6FDE4F68`.
 *   - `PATH_ComputeDirection` (`0x6FD5D180`, `PathMisc.cpp:990`).
 */

import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../src/baker/mpq-archive-source.ts'
import type { D2DataRegistry } from '../src/common/data/data-registry.ts'
import {
  D2Common_11053,
  DIR64_TO_DIR8_11053,
  OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE,
  OVERLAY_INDEX_FROZEN_ARMOR_HIT,
  OVERLAY_INDEX_SHIVER_ARMOR_HIT,
  PATH_ComputeDirection,
  UNITS_GetDirectionToCoords,
  computeEnergyShieldHitOverlay113c,
} from '../src/common/path/direction.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  decode0x11UnitOverlay,
  decodeD2gsS2cPacket,
  encode0x11UnitOverlay,
  serverEventToS2cPackets,
} from '../src/netproto/index.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../src/server/engine/combat-pipeline.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { StateBus } from '../src/server/engine/state-bus.ts'

const IDLE_INPUT = {
  movement: { x: 0, y: 0 },
  attacking: false,
  pickingUp: false,
  talking: false,
  saving: false,
  loading: false,
  digits: [] as readonly number[],
}

function makeCombatUnit(
  id: string,
  unitType: 'player' | 'monster',
  x: number,
  y: number,
  registry: D2DataRegistry,
): CombatUnitContext {
  const statList = new UnitStatList(registry, {
    strength: 50,
    dexterity: 50,
    vitality: 50,
    energy: 100,
    maxhp: 500 * FIXED_ONE,
    hitpoints: 500 * FIXED_ONE,
    maxmana: 500 * FIXED_ONE,
    mana: 500 * FIXED_ONE,
    level: 30,
  })
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    unitType,
    x,
    y,
    statList,
    stateBus,
  }
}

describe('Unit B12-p2: Sorceress Reactive Defense Hit Overlays (#1130, #1131)', () => {
  describe('#1130 (B12-7): Frozen Armor (#40) & Shiver Armor (#50) cltoverlaya on melee attackers', () => {
    it('matches 1.13c Skills.txt cltoverlaya and Overlay.txt rows 42 (frozenarmor_hit) & 43 (shiverarmor_hit)', async () => {
      const registry = await getSharedDataRegistry()
      const frozenArmor = registry.getSkillById(40)!
      expect(frozenArmor.name).toBe('Frozen Armor')
      expect(frozenArmor.auraEvent1).toBe('damagedinmelee')
      expect(frozenArmor.auraEventFunc1).toBe(2)
      expect(frozenArmor.cltOverlayA).toBe('frozenarmor_hit')

      const shiverArmor = registry.getSkillById(50)!
      expect(shiverArmor.name).toBe('Shiver Armor')
      expect(shiverArmor.auraEvent1).toBe('attackedinmelee')
      expect(shiverArmor.auraEventFunc1).toBe(3)
      expect(shiverArmor.cltOverlayA).toBe('shiverarmor_hit')

      const row42 = OVERLAY_TXT_ROWS[OVERLAY_INDEX_FROZEN_ARMOR_HIT]!
      expect(OVERLAY_INDEX_FROZEN_ARMOR_HIT).toBe(42)
      expect(row42.name).toBe('frozenarmor_hit')
      expect(row42.filename).toBe('AuraResistColdCast')
      expect(row42.frames).toBe(11)
      expect(row42.animRate).toBe(24)
      expect(row42.preDraw).toBe(1)

      const row43 = OVERLAY_TXT_ROWS[OVERLAY_INDEX_SHIVER_ARMOR_HIT]!
      expect(OVERLAY_INDEX_SHIVER_ARMOR_HIT).toBe(43)
      expect(row43.name).toBe('shiverarmor_hit')
      expect(row43.filename).toBe('AuraResistColdCast')
      expect(row43.frames).toBe(11)
      expect(row43.animRate).toBe(24)
      expect(row43.preDraw).toBe(1)
    })

    it('attaches one-shot frozenarmor_hit (row 42) to a melee-attacking monster via S2C 0x11 UnitOverlay', () => {
      const engine = new GameEngine('sor')
      engine.world.player.x = 200
      engine.world.player.y = 200
      engine.world.player.hp = 300
      engine.world.player.maxHp = 300
      engine.world.player.coldArmorType = 'frozenarmor'
      engine.world.player.coldArmorTicks = 3000
      engine.world.player.coldArmorSlvl = 5
      engine.world.monsters = [
        {
          index: 7,
          x: 210,
          y: 200,
          hp: 200,
          state: 'attack',
          cooldown: 0,
          facing: 0,
          hitFlash: 0,
          corpseTicks: 0,
          stats: {
            id: 'zombie1',
            name: 'Zombie',
            hp: 200,
            maxHp: 200,
            damage: 25,
            speed: 0,
            sightRadius: 200,
            reach: 40,
            cooldownTicks: 20,
            xp: 50,
          },
        } as any,
      ]

      engine.tick(IDLE_INPUT)

      const overlayEv = engine.world.events.find(
        ev => ev.kind === 'unitOverlay' && ev.overlayToken === 'frozenarmor_hit',
      )
      expect(overlayEv).toBeDefined()
      expect(overlayEv!.overlayIndex).toBe(42)
      expect(overlayEv!.targetUnitType).toBe(1)
      expect(overlayEv!.targetUnitId).toBe(7)
      expect(overlayEv!.packet0x11).toBeInstanceOf(Uint8Array)
      expect(overlayEv!.packet0x11!.byteLength).toBe(8)

      // Engine overlays also records the one-shot overlay on monster-7
      const engOverlay = engine.overlays.find(o => o.overlayName === 'frozenarmor_hit')
      expect(engOverlay).toBeDefined()
      expect(engOverlay!.casterId).toBe('monster-7')
      expect(engOverlay!.targetMonsterIndex).toBe(7)
      expect(engOverlay!.loop).toBe(false)

      // Round-trip through S2C 0x11 decoder and apply to ClientWorld
      const decoded = decodeD2gsS2cPacket(overlayEv!.packet0x11!)
      expect(decoded).toEqual({
        type: 'UnitOverlay',
        rawUnitType: 1,
        id: 7,
        overlayIndex: 42,
      })

      const clientWorld = new ClientWorld()
      clientWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 0 as any, id: 1 as any, classId: 1, name: 'Sorc', x: 200 as any, y: 200 as any },
        isSelf: true,
      })
      clientWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 1 as any, id: 7 as any, classId: 1, name: 'Zombie', x: 210 as any, y: 200 as any },
      })
      clientWorld.apply(decoded)

      const clientMonster = clientWorld.getUnit('monster', 7)!
      const clientPlayer = clientWorld.getUnit('player', 1)!
      expect(clientMonster.overlays).toHaveLength(1)
      expect(clientMonster.overlays[0]!.token).toBe('frozenarmor_hit')
      expect(clientMonster.overlays[0]!.totalFrames).toBe(11)
      expect(clientMonster.overlays[0]!.animRate).toBe(24)
      expect(clientMonster.overlays[0]!.preDraw).toBe(true)
      expect(clientMonster.overlays[0]!.loop).toBe(false)
      // Must NOT attach frozenarmor_hit onto the defending Sorceress
      expect(clientPlayer.overlays).toHaveLength(0)
    })

    it('attaches one-shot shiverarmor_hit (row 43) to a melee-attacking monster via S2C 0x11 UnitOverlay', async () => {
      const engine = new GameEngine('sor')
      engine.world.player.x = 200
      engine.world.player.y = 200
      engine.world.player.hp = 300
      engine.world.player.maxHp = 300
      engine.world.player.coldArmorType = 'shiverarmor'
      engine.world.player.coldArmorTicks = 3000
      engine.world.player.coldArmorSlvl = 5
      engine.world.monsters = [
        {
          index: 9,
          x: 210,
          y: 200,
          hp: 200,
          state: 'attack',
          cooldown: 0,
          facing: 0,
          hitFlash: 0,
          corpseTicks: 0,
          stats: {
            id: 'zombie1',
            name: 'Zombie',
            hp: 200,
            maxHp: 200,
            damage: 25,
            speed: 0,
            sightRadius: 200,
            reach: 40,
            cooldownTicks: 20,
            xp: 50,
          },
        } as any,
      ]

      engine.tick(IDLE_INPUT)

      const overlayEv = engine.world.events.find(
        ev => ev.kind === 'unitOverlay' && ev.overlayToken === 'shiverarmor_hit',
      )
      expect(overlayEv).toBeDefined()
      expect(overlayEv!.overlayIndex).toBe(43)
      expect(overlayEv!.targetUnitType).toBe(1)
      expect(overlayEv!.targetUnitId).toBe(9)
      expect(overlayEv!.packet0x11).toBeInstanceOf(Uint8Array)
      expect(overlayEv!.packet0x11!.byteLength).toBe(8)

      const decoded = decode0x11UnitOverlay(overlayEv!.packet0x11!)
      expect(decoded).toEqual({
        type: 'UnitOverlay',
        rawUnitType: 1,
        id: 9,
        overlayIndex: 43,
      })

      const clientWorld = new ClientWorld()
      clientWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 0 as any, id: 1 as any, classId: 1, name: 'Sorc', x: 200 as any, y: 200 as any },
        isSelf: true,
      })
      clientWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 1 as any, id: 9 as any, classId: 1, name: 'Zombie', x: 210 as any, y: 200 as any },
      })
      clientWorld.apply(decoded)

      const clientMonster = clientWorld.getUnit('monster', 9)!
      const clientPlayer = clientWorld.getUnit('player', 1)!
      expect(clientMonster.overlays).toHaveLength(1)
      expect(clientMonster.overlays[0]!.token).toBe('shiverarmor_hit')
      expect(clientMonster.overlays[0]!.totalFrames).toBe(11)
      expect(clientMonster.overlays[0]!.animRate).toBe(24)
      expect(clientMonster.overlays[0]!.preDraw).toBe(true)
      expect(clientMonster.overlays[0]!.loop).toBe(false)
      expect(clientPlayer.overlays).toHaveLength(0)

      // Also verify SUnitDmg + StateBus pipeline
      const registry = await getSharedDataRegistry()
      const attacker = makeCombatUnit('monster-9', 'monster', 210, 200, registry)
      const defender = makeCombatUnit('player-1', 'player', 200, 200, registry)
      defender.stateBus.applyState({ stateNameOrId: 'shiverarmor', slvl: 4, durationFrames: 3000 })
      const outcome = executeSUnitDmg(attacker, defender, {
        skillId: 0,
        attackKind: 'melee',
        flatPhysMin256: 30 * FIXED_ONE,
        flatPhysMax256: 30 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, { rand: () => 50 })
      expect(outcome.attackerOverlaysApplied).toContain('shiverarmor_hit')
      expect(outcome.unitOverlays?.[0]?.overlayIndex).toBe(43)
      expect(outcome.unitOverlays?.[0]?.unitOverlay.rawUnitType).toBe(1)
    })
  })

  describe('#1131 (B12-8): Energy Shield (#58) directional prgoverlay energyshieldhit0..7 on damage absorb', () => {
    it('matches 1.13c Skills.txt prgoverlay=energyshieldhit0 and Overlay.txt rows 87..94 + D2Common_11053 LUT', async () => {
      const registry = await getSharedDataRegistry()
      const energyShield = registry.getSkillById(58)!
      expect(energyShield.name).toBe('Energy Shield')
      expect(energyShield.auraEvent1).toBe('absorbdamage')
      expect(energyShield.auraEventFunc1).toBe(24)
      expect(energyShield.prgOverlay).toBe('energyshieldhit0')

      expect(OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE).toBe(87)
      const expectedFilenames = [
        'ManaShieldDir00',
        'ManaShieldDir02',
        'ManaShieldDir04',
        'ManaShieldDir06',
        'ManaShieldDir08',
        'ManaShieldDir10',
        'ManaShieldDir12',
        'ManaShieldDir14',
      ]
      for (let d = 0; d < 8; d++) {
        const row = OVERLAY_TXT_ROWS[87 + d]!
        expect(row.name).toBe(`energyshieldhit${d}`)
        expect(row.filename).toBe(expectedFilenames[d])
        expect(row.frames).toBe(9)
        expect(row.animRate).toBe(16)
      }

      // Verify D2Common_11053 (0x6FDA5600) 64-entry LUT boundaries
      expect(DIR64_TO_DIR8_11053).toHaveLength(64)
      expect(D2Common_11053(-1)).toBe(0)
      expect(D2Common_11053(64)).toBe(0)
      expect(D2Common_11053(0)).toBe(0)
      expect(D2Common_11053(3)).toBe(0)
      expect(D2Common_11053(4)).toBe(1)
      expect(D2Common_11053(11)).toBe(1)
      expect(D2Common_11053(12)).toBe(2)
      expect(D2Common_11053(19)).toBe(2)
      expect(D2Common_11053(20)).toBe(3)
      expect(D2Common_11053(27)).toBe(3)
      expect(D2Common_11053(28)).toBe(4)
      expect(D2Common_11053(35)).toBe(4)
      expect(D2Common_11053(36)).toBe(5)
      expect(D2Common_11053(43)).toBe(5)
      expect(D2Common_11053(44)).toBe(6)
      expect(D2Common_11053(51)).toBe(6)
      expect(D2Common_11053(52)).toBe(7)
      expect(D2Common_11053(59)).toBe(7)
      expect(D2Common_11053(60)).toBe(0)
      expect(D2Common_11053(63)).toBe(0)
    })

    it('attaches directional energyshieldhit3 (row 90) onto the Sorceress when an attacker due west is absorbed', () => {
      // Attacker due west of Sorceress: sorc at (200, 200), attacker at (185, 200)
      const dir64 = PATH_ComputeDirection(200, 200, 185, 200)
      expect(UNITS_GetDirectionToCoords(200, 200, 185, 200)).toBe(dir64)
      const expectedDir8 = D2Common_11053(dir64)
      expect(expectedDir8).toBe(3)

      const esCalc = computeEnergyShieldHitOverlay113c(200, 200, 185, 200)
      expect(esCalc.dir64).toBe(dir64)
      expect(esCalc.dir8).toBe(3)
      expect(esCalc.overlayIndex).toBe(87 + 3)
      expect(esCalc.overlayToken).toBe('energyshieldhit3')

      const engine = new GameEngine('sor')
      engine.world.player.x = 200
      engine.world.player.y = 200
      engine.world.player.hp = 300
      engine.world.player.maxHp = 300
      engine.world.player.mana = 300
      engine.world.player.maxMana = 300
      engine.world.player.energyshieldTicks = 3600
      engine.world.player.energyshieldPct = 50
      engine.world.player.energyshieldSlvl = 7
      engine.world.monsters = [
        {
          index: 4,
          x: 185,
          y: 200,
          hp: 200,
          state: 'attack',
          cooldown: 0,
          facing: 0,
          hitFlash: 0,
          corpseTicks: 0,
          stats: {
            id: 'zombie1',
            name: 'Zombie',
            hp: 200,
            maxHp: 200,
            damage: 40,
            speed: 0,
            sightRadius: 200,
            reach: 40,
            cooldownTicks: 20,
            xp: 50,
          },
        } as any,
      ]

      engine.tick(IDLE_INPUT)

      const esEvents = engine.world.events.filter(
        ev => ev.kind === 'unitOverlay' && ev.overlayToken?.startsWith('energyshieldhit'),
      )
      expect(esEvents).toHaveLength(1)
      const esEv = esEvents[0]!
      expect(esEv.overlayIndex).toBe(87 + expectedDir8)
      expect(esEv.overlayToken).toBe('energyshieldhit3')
      expect(esEv.targetUnitType).toBe(0)
      expect(esEv.targetUnitId).toBe(1)

      // Verify serverEventToS2cPackets & decodeD2gsS2cPacket round-trip
      const s2cPkts = serverEventToS2cPackets(esEv.unitOverlay!)
      expect(s2cPkts).toHaveLength(1)
      expect(s2cPkts[0]).toEqual(encode0x11UnitOverlay(esEv.unitOverlay!))
      const decoded = decodeD2gsS2cPacket(s2cPkts[0]!)
      expect(decoded).toEqual({
        type: 'UnitOverlay',
        rawUnitType: 0,
        id: 1,
        overlayIndex: 90,
      })

      const clientWorld = new ClientWorld()
      clientWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 0 as any, id: 1 as any, classId: 1, name: 'Sorc', x: 200 as any, y: 200 as any },
        isSelf: true,
      })
      clientWorld.apply(decoded)

      const clientPlayer = clientWorld.getUnit('player', 1)!
      expect(clientPlayer.overlays).toHaveLength(1)
      expect(clientPlayer.overlays[0]!.token).toBe('energyshieldhit3')
      expect(clientPlayer.overlays[0]!.totalFrames).toBe(9)
      expect(clientPlayer.overlays[0]!.animRate).toBe(16)
      expect(clientPlayer.overlays[0]!.preDraw).toBe(true)
      expect(clientPlayer.overlays[0]!.loop).toBe(false)
    })

    it('maps attackers across all 8 octants to energyshieldhit0..7 (rows 87..94) and skips overlay when 0 damage is absorbed', async () => {
      const seenIndices = new Set<number>()
      for (let i = 0; i < 64; i++) {
        const angle = (i * Math.PI * 2) / 64
        const ax = 100 + Math.round(Math.cos(angle) * 50)
        const ay = 100 + Math.round(Math.sin(angle) * 50)
        const res = computeEnergyShieldHitOverlay113c(100, 100, ax, ay)
        expect(res.overlayIndex).toBeGreaterThanOrEqual(87)
        expect(res.overlayIndex).toBeLessThanOrEqual(94)
        expect(res.overlayToken).toBe(`energyshieldhit${res.dir8}`)
        seenIndices.add(res.overlayIndex)
      }
      expect([...seenIndices].sort((a, b) => a - b)).toEqual([87, 88, 89, 90, 91, 92, 93, 94])

      // Verify executeSUnitDmg with west attacker -> energyshieldhit3, and poison (0 absorbed) -> no overlay
      const registry = await getSharedDataRegistry()
      const attackerWest = makeCombatUnit('monster-1', 'monster', 80, 100, registry)
      const defender = makeCombatUnit('player-1', 'player', 100, 100, registry)
      defender.stateBus.applyState({ stateNameOrId: 'energyshield', slvl: 5, durationFrames: 3600 })

      const hitOutcome = executeSUnitDmg(attackerWest, defender, {
        skillId: 0,
        attackKind: 'melee',
        flatPhysMin256: 40 * FIXED_ONE,
        flatPhysMax256: 40 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, { rand: () => 50 })
      expect(hitOutcome.defenderOverlaysApplied).toEqual(['energyshieldhit3'])
      expect(hitOutcome.unitOverlays).toHaveLength(1)
      expect(hitOutcome.unitOverlays![0]!.overlayIndex).toBe(90)

      // Poison damage is NOT absorbed by Energy Shield (nAbsorbedDamage === 0), so no overlay is emitted
      const poisonOutcome = executeSUnitDmg(attackerWest, defender, {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'pois',
        elemMin256: 40 * FIXED_ONE,
        elemMax256: 40 * FIXED_ONE,
        isPoison: true,
        autoHit: true,
        unblockable: true,
      }, { rand: () => 50 })
      expect(poisonOutcome.defenderOverlaysApplied).toBeUndefined()
      expect(poisonOutcome.unitOverlays).toBeUndefined()
    })
  })
})
