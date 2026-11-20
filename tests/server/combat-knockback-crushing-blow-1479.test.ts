/**
 * Issue #1479 — 1.13c Knockback (`0x6FCCCE60`, `0x6FCFD00E`, `0x6FC95160`, `0x6FC965E0`,
 * `D2Common.0x6FDB7390`), Crushing Blow (`0x6FCCCC30`), Slow Target (`0x6FCCD2C0`),
 * and Grizzly `BearSmite` (`#326`, `aip3 = 50%`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { MONMODE_KNOCKBACK } from '../../src/common/path/types.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { AuraScanner } from '../../src/server/engine/aura-scanner.ts'
import {
  calculateCrushingBlow113c,
  capTargetSlowPct113c,
  computeKnockbackStep113c,
  executeSUnitDmg,
  getItemKnockbackThreshold128_113c,
  rollItemKnockback113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'

describe('Issue #1479: 1.13c Knockback, Crushing Blow, Slow Target & BearSmite parity', () => {
  describe('1. Item Knockback (`D2Game.dll` 0x6FCCCE60, `itemeventfunc 7`, `STAT_ITEM_KNOCKBACK = 81`)', () => {
    it('uses 128-denominator thresholds: Small=128/128 (100%), Medium/Player=64/128 (50%), Large=32/128 (25%)', () => {
      expect(getItemKnockbackThreshold128_113c({ unitType: 'monster', sizeX: 1 })).toBe(128)
      expect(getItemKnockbackThreshold128_113c({ unitType: 'monster', sizeX: 2 })).toBe(64)
      expect(getItemKnockbackThreshold128_113c({ unitType: 'monster', sizeX: 3 })).toBe(32)
      expect(getItemKnockbackThreshold128_113c({ unitType: 'player', sizeX: 1 })).toBe(64)

      // Exact boundary rolls `(rand(128) & 0x7f) < threshold128`:
      expect(rollItemKnockback113c({ rand: () => 127 }, { unitType: 'monster', sizeX: 1 })).toBe(true)
      expect(rollItemKnockback113c({ rand: () => 63 }, { unitType: 'monster', sizeX: 2 })).toBe(true)
      expect(rollItemKnockback113c({ rand: () => 64 }, { unitType: 'monster', sizeX: 2 })).toBe(false)
      expect(rollItemKnockback113c({ rand: () => 31 }, { unitType: 'monster', sizeX: 3 })).toBe(true)
      expect(rollItemKnockback113c({ rand: () => 32 }, { unitType: 'monster', sizeX: 3 })).toBe(false)
    })

    it('skill knockback (Smite #97) bypasses 0x6FCCCE60 size resistance and knocks back Large monsters 100% of the time', () => {
      const game = new GameInstance({ seed: 1479, areaId: 1 })
      const playerId = game.connectPlayer({
        charClass: 'pal',
        name: 'Paladin',
        x: 20,
        y: 20,
        areaId: 1,
      })
      // blunderbore1 (hcIdx 381) has SizeX = 3 (Large) and mKB = 1, mGH = 1 in MonStats2.txt
      const largeId = game.spawnMonster({
        defId: 'blunderbore1',
        x: 22,
        y: 20,
        areaId: 1,
        maxHp: 5000,
        hp: 5000,
        damageRegen: 0,
      })

      // Even across 8 consecutive Smite (#97) hits on a Large monster, every single hit knocks back by 3 sub-tiles:
      for (let i = 0; i < 8; i++) {
        const prev = game.getMonsterState(largeId)!
        game.applyDamageToMonster(largeId, 10, playerId, 97)
        const next = game.getMonsterState(largeId)!
        expect(next.x - prev.x).toBe(3)
      }
    })
  })

  describe('2. Knockback Trajectory (`D2Game.dll` 0x6FC95160, `D2Common.dll` 0x6FDB7390) & Mode 13 (`0x6FC965E0`)', () => {
    it('computes deterministic stepDist = (nDist >> 1) + 1: 3 sub-tiles standard (nDist=5) and 6 sub-tiles for sandmaggot1 (BaseId=78, nDist=10)', () => {
      const std = computeKnockbackStep113c({
        targetX: 25,
        targetY: 20,
        sourceX: 20,
        sourceY: 20,
        hcIdx: 10, // fallen1
        baseId: 'fallen1',
      })
      expect(std.nDist).toBe(5)
      expect(std.stepDist).toBe(3)
      expect(std.destX).toBe(28)
      expect(std.destY).toBe(20)

      const maggot = computeKnockbackStep113c({
        targetX: 25,
        targetY: 20,
        sourceX: 20,
        sourceY: 20,
        hcIdx: 49, // sandmaggot1 (BaseId = 78)
        baseId: 'sandmaggot1',
      })
      expect(maggot.nDist).toBe(10)
      expect(maggot.stepDist).toBe(6)
      expect(maggot.destX).toBe(31)
      expect(maggot.destY).toBe(20)
    })

    it('pushes sandmaggot1 6 sub-tiles and resets MONMODE_KNOCKBACK (13) to MONMODE_NEUTRAL (1) after GH duration without applying a fake States.txt knockback state', async () => {
      const game = new GameInstance({ seed: 1479, areaId: 1 })
      const playerId = game.connectPlayer({
        charClass: 'pal',
        name: 'Paladin',
        x: 20,
        y: 20,
        areaId: 1,
      })
      const maggotId = game.spawnMonster({
        defId: 'sandmaggot1',
        x: 22,
        y: 20,
        areaId: 1,
        maxHp: 5000,
        hp: 5000,
        damageRegen: 0,
      })

      game.applyDamageToMonster(maggotId, 10, playerId, 97) // Smite (#97)
      const afterHit = game.getMonsterState(maggotId)!
      expect(afterHit.x).toBe(28) // 22 + 6 sub-tiles!
      expect(afterHit.mode).toBe(MONMODE_KNOCKBACK)

      // Advance past GH animation recovery frames -> mode resets from 13 (KB) to 1 (NU)
      game.stepFrames(20)
      const afterRecovery = game.getMonsterState(maggotId)!
      expect(afterRecovery.mode).not.toBe(MONMODE_KNOCKBACK)

      // Verify executeSUnitDmg and AuraScanner Sanctuary (#119) do NOT fabricate a 'knockback' state in StateBus
      const registry = await getSharedDataRegistry()
      const atkStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const defStats = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const atk: CombatUnitContext = {
        id: 'atk-1',
        name: 'Paladin',
        unitType: 'player',
        statList: atkStats,
        stateBus: new StateBus(atkStats, registry),
        weaponMinPhys: 20,
        weaponMaxPhys: 20,
        x: 100,
        y: 100,
      }
      const def: CombatUnitContext = {
        id: 'def-1',
        name: 'Skeleton',
        unitType: 'monster',
        isUndead: true,
        statList: defStats,
        stateBus: new StateBus(defStats, registry),
        x: 103,
        y: 100,
      }
      const dmgOut = executeSUnitDmg(atk, def, {
        skillId: 97,
        attackKind: 'melee',
        autoHit: true,
        knockback: true,
      }, { rand: () => 0 })
      expect(dmgOut.knockedBack).toBe(true)
      expect(def.stateBus.hasState('knockback')).toBe(false)

      const scanner = new AuraScanner(registry)
      const aura = scanner.setActiveAura(atk, 119, 5, 0)!
      scanner.pulseAura(aura, 0, [atk], [def])
      expect(def.stateBus.hasState('knockback')).toBe(false)
    })
  })

  describe('3. Crushing Blow (`D2Game.dll` 0x6FCCCC30, `itemeventfunc 16`, `STAT_ITEM_CRUSHINGBLOW = 136`)', () => {
    it('uses divisor 4 (1/4 melee, 1/8 ranged) for Normal, Minion, AND Champion (0x04), 8 for Boss/Unique (0x02), and 10 for Player/Hireling', () => {
      // Normal monster: 1/4 melee (250), 1/8 ranged (125)
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'normal' })).toEqual({
        divisor: 4,
        damage: 250,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'normal', isRanged: true })).toEqual({
        divisor: 8,
        damage: 125,
      })

      // Champion monster (fTypeFlags = 0x04): 0x6FCCCCBA only checks #10064 (boss) and 0x6FC42A80(pDefender, 2) (0x02),
      // so Champions use divisor 4 (1/4 melee, 1/8 ranged), NOT 8!
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'champion' })).toEqual({
        divisor: 4,
        damage: 250,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'champion', isRanged: true })).toEqual({
        divisor: 8,
        damage: 125,
      })

      // Unique / SuperUnique / Boss: divisor 8 melee (125), 16 ranged (62)
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'unique' })).toEqual({
        divisor: 8,
        damage: 125,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', rank: 'unique', isRanged: true })).toEqual({
        divisor: 16,
        damage: 62,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', isBoss: true })).toEqual({
        divisor: 8,
        damage: 125,
      })

      // Player & Hireling: divisor 10 melee (100), 20 ranged (50)
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'player' })).toEqual({
        divisor: 10,
        damage: 100,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'player', isRanged: true })).toEqual({
        divisor: 20,
        damage: 50,
      })
      expect(calculateCrushingBlow113c({ defenderHp: 1000, unitType: 'monster', isHireling: true })).toEqual({
        divisor: 10,
        damage: 100,
      })
    })

    it('scales divisor by /players N HP bonus (`0x6FCCF5F0` & `0x6FD1B614`) and mitigates only by positive physical resistance', () => {
      // /players 3 -> hpBonusPct = (3 - 1) * 50 = 100% -> divisor = 4 + trunc(4 * 100 / 100) = 8
      expect(
        calculateCrushingBlow113c({
          defenderHp: 1000,
          unitType: 'monster',
          rank: 'normal',
          playerCount: 3,
        }),
      ).toEqual({
        divisor: 8,
        damage: 125,
      })
      // /players 3 ranged -> divisor 8 * 2 = 16
      expect(
        calculateCrushingBlow113c({
          defenderHp: 1000,
          unitType: 'monster',
          rank: 'normal',
          playerCount: 3,
          isRanged: true,
        }),
      ).toEqual({
        divisor: 16,
        damage: 62,
      })

      // Positive damageresist (50%) reduces CB by half; negative damageresist (-100% Amplify Damage) does NOT amplify CB
      expect(
        calculateCrushingBlow113c({
          defenderHp: 1000,
          unitType: 'monster',
          rank: 'normal',
          physResPct: 50,
        }).damage,
      ).toBe(125)
      expect(
        calculateCrushingBlow113c({
          defenderHp: 1000,
          unitType: 'monster',
          rank: 'normal',
          physResPct: -100,
        }).damage,
      ).toBe(250)
    })

    it('applies 1/4 Crushing Blow to Champion monsters and 1/8 to Unique monsters in GameInstance.applyDamageToMonster', () => {
      const game = new GameInstance({ seed: 1479, areaId: 1 })
      const playerId = game.connectPlayer({
        charClass: 'pal',
        name: 'Smiter',
        x: 10,
        y: 10,
        areaId: 1,
      })
      const internalPlayers = (
        game as unknown as {
          players: Map<number, { items: Array<Record<string, unknown>> }>
        }
      ).players
      internalPlayers.get(playerId)!.items.push({
        id: 9100,
        code: 'rng',
        name: '100% CB Ring',
        location: 'equipped',
        bodyLoc: 6,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        quality: 'unique',
        identified: true,
        ethereal: false,
        sockets: 0,
        socketedItems: [],
        stats: new Map<number, number>([[136, 100]]),
        statLines: [],
      })

      const champId = game.spawnMonster({
        defId: 'fallen1',
        x: 12,
        y: 10,
        areaId: 1,
        rank: 'champion',
        maxHp: 4000,
        hp: 4000,
        damageRegen: 0,
      })
      const uniqueId = game.spawnMonster({
        defId: 'fallen1',
        x: 12,
        y: 12,
        areaId: 1,
        rank: 'unique',
        maxHp: 4000,
        hp: 4000,
        damageRegen: 0,
      })

      // Use Smite (#97, autoHit: true, unblockable: true) so neither target avoids the hit
      game.applyDamageToMonster(champId, 10, playerId, 97)
      game.applyDamageToMonster(uniqueId, 10, playerId, 97)

      const champHpLost = 4000 - game.getMonsterState(champId)!.hp
      const uniqueHpLost = 4000 - game.getMonsterState(uniqueId)!.hp
      // Champion loses 1/4 of 4000 (= 1000) + base hit; Unique loses 1/8 of 4000 (= 500) + base hit
      expect(champHpLost - uniqueHpLost).toBe(500)
    })
  })

  describe('4. Slow Target Cap (`D2Game.dll` 0x6FCCD2C0) & Grizzly BearSmite (`#326`, `aip3 = 50%`)', () => {
    it('caps item_slow at 50% vs Player/Boss/Unique/Champion, 75% vs SuperUnique, and 90% vs Normal', () => {
      expect(capTargetSlowPct113c(95, { unitType: 'monster', rank: 'normal' })).toBe(90)
      expect(capTargetSlowPct113c(95, { unitType: 'monster', isSuperUnique: true })).toBe(75)
      expect(capTargetSlowPct113c(95, { unitType: 'monster', rank: 'champion' })).toBe(50)
      expect(capTargetSlowPct113c(95, { unitType: 'monster', rank: 'unique' })).toBe(50)
      expect(capTargetSlowPct113c(95, { unitType: 'monster', isBoss: true })).toBe(50)
      expect(capTargetSlowPct113c(95, { unitType: 'player' })).toBe(50)
    })

    it('rolls MonStats.txt druidbear aip3 = 50% for Grizzly BearSmite (#326) instead of triggering on 100% of attacks', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const auraScanner = new AuraScanner(registry)
      const missileEngine = new MissileEngine(registry)

      const ownerStats = new UnitStatList(registry, { level: 30 })
      const owner: CombatUnitContext = {
        id: 'dru-1479',
        name: 'Druid',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
      }
      summonManager.createPet({
        owner,
        skillId: 247,
        slvl: 5,
        x: 100,
        y: 100,
        difficulty: 'normal',
      })

      const mobStats = new UnitStatList(registry, {
        maxhp: 50000 * FIXED_ONE,
        hitpoints: 50000 * FIXED_ONE,
      })
      const mob: CombatUnitContext = {
        id: 'mob-1479',
        name: 'Goatman',
        statList: mobStats,
        stateBus: new StateBus(mobStats, registry),
      }
      const enemyPos = new Map([['mob-1479', { x: 105, y: 100 }]])

      let bearSmiteCount = 0
      const totalSwings = 20
      for (let i = 1; i <= totalSwings; i++) {
        enemyPos.set('mob-1479', { x: 105, y: 100 })
        const res = summonManager.tickPets({
          currentTick: i * 20,
          owner,
          enemies: [mob],
          enemyPositions: enemyPos,
          corpses: [],
          missileEngine,
          auraScanner,
        })
        if (res.subSkillsExecuted.includes(326)) {
          bearSmiteCount++
        }
      }
      // With aip3 = 50%, BearSmite triggers on roughly half of swings (neither 0 nor all 20)
      expect(bearSmiteCount).toBeGreaterThan(0)
      expect(bearSmiteCount).toBeLessThan(totalSwings)
    })
  })
})
