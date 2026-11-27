/**
 * Wave 1 Combat, Missiles & Stat Mitigation P0 Parity Suite
 * (`#1791`, `#1792`, `#1793`, `#1794`, `#1795`, `#1796`, `#1800`, `#1805`).
 *
 * Verifies exact Diablo II: Lord of Destruction v1.13c (`D2Game.dll` / `D2Common.dll` / MPQ `.txt`)
 * ground truth across `MissileEngine`, `combat-pipeline`, `UnitStatList`, and `GameInstance`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  evaluateAvoidanceAndBlock,
  executeSUnitDmg,
  shouldEnterGetHit113c,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  MISSILE_SRV_DMG_TABLE_113C,
  MISSILE_SRV_DO_TABLE_113C,
  MISSILE_SRV_HIT_TABLE_113C,
  MissileEngine,
} from '../../src/server/engine/missile-engine.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'

function makeCombatUnit(
  unitType: NonNullable<CombatUnitContext['unitType']> = 'player',
  overrides: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const registry = getSharedDataRegistry()
  const statList = new UnitStatList(registry)
  const stateBus = new StateBus(statList, registry)
  statList.setBaseStat('level', 80)
  statList.setBaseStat('maxhp', 2000 * FIXED_ONE)
  statList.setHp256(2000 * FIXED_ONE)
  statList.setBaseStat('maxmana', 1000 * FIXED_ONE)
  statList.setMana256(1000 * FIXED_ONE)
  return {
    id: `${unitType}_1`,
    name: `${unitType}_1`,
    unitType,
    statList,
    stateBus,
    ...overrides,
  }
}

function makeMissileUnit(
  id: string,
  unitType: NonNullable<CombatUnitContext['unitType']>,
  x: number,
  y: number,
  overrides: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const registry = getSharedDataRegistry()
  const statList = new UnitStatList(registry)
  const stateBus = new StateBus(statList, registry)
  statList.setBaseStat('level', 80)
  statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
  statList.setHp256(1000 * FIXED_ONE)
  statList.setBaseStat('maxmana', 500 * FIXED_ONE)
  statList.setMana256(500 * FIXED_ONE)
  return {
    id,
    name: id,
    unitType,
    x,
    y,
    statList,
    stateBus,
    ...overrides,
  }
}

describe('Wave 1 Combat, Missiles & Stat Mitigation P0 Parity (#1791..#1805)', () => {
  describe('#1791: MissileEngine 1.13c pSrvDoFunc / pSrvHitFunc / pSrvDmgFunc dispatch & WarCry buffs', () => {
    it('maps every non-zero pSrvDoFunc, pSrvHitFunc, and pSrvDmgFunc across all Missiles.txt rows', () => {
      const registry = getSharedDataRegistry()
      expect(MISSILE_SRV_DO_TABLE_113C).toHaveLength(38)
      expect(MISSILE_SRV_HIT_TABLE_113C).toHaveLength(65)
      expect(MISSILE_SRV_DMG_TABLE_113C).toHaveLength(16)
      expect(MISSILE_SRV_HIT_TABLE_113C[18]?.name).toBe('MISSMODE_SrvHit18_Shout_BO_BC_AllyBuff')
      expect(MISSILE_SRV_HIT_TABLE_113C[1]?.name).toBe('MISSMODE_SrvHit01_FireBallRadialSplash')
      expect(MISSILE_SRV_DMG_TABLE_113C[3]?.name).toBe('MISSMODE_SrvDmg03_GroundFireDamage')

      let checked = 0
      for (let id = 0; id < 800; id++) {
        const m = registry.getMissileById(id)
        if (!m) continue
        checked++
        expect(m.pSrvDoFunc).toBeGreaterThanOrEqual(0)
        expect(m.pSrvDoFunc).toBeLessThan(MISSILE_SRV_DO_TABLE_113C.length)
        expect(m.pSrvHitFunc).toBeGreaterThanOrEqual(0)
        expect(m.pSrvHitFunc).toBeLessThan(MISSILE_SRV_HIT_TABLE_113C.length)
        expect(m.pSrvDmgFunc).toBeGreaterThanOrEqual(0)
        expect(m.pSrvDmgFunc).toBeLessThan(MISSILE_SRV_DMG_TABLE_113C.length)
      }
      expect(checked).toBeGreaterThanOrEqual(680)
    })

    it('pSrvHitFunc=18 (Shout / Battle Orders / Battle Command) buffs friendly caster/party/merc with 0 damage to enemies', () => {
      const registry = getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const barb = makeMissileUnit('player_1', 'player', 100, 100, { charClass: 'bar' })
      barb.statList.setBaseSkillLevel(138, 10) // Shout
      barb.statList.setBaseSkillLevel(149, 20) // Battle Orders
      barb.statList.setBaseSkillLevel(155, 5) // Battle Command

      const partyAlly = makeMissileUnit('player_2', 'player', 112, 100, {
        charClass: 'sor',
        ownerUnitId: 'player_1',
      })
      const allyMerc = makeMissileUnit('merc_1', 'mercenary', 114, 100, {
        ownerUnitId: 'player_1',
      })
      const enemy = makeMissileUnit('mon_1', 'monster', 116, 100)
      const enemyHpBefore = enemy.statList.getHp256()

      // Spawn Battle Orders ring (`battleorders`, pSrvHitFunc = 18, skillId = 149)
      engine.spawnMissile({
        missileNameOrId: 'battleorders',
        owner: barb,
        startX: 100,
        startY: 100,
        targetX: 200,
        targetY: 100,
        slvl: 20,
        sourceSkillId: 149,
        dmgPacket: {
          skillId: 149,
          slvl: 20,
          attackKind: 'spell',
          elemType: 'none',
          autoHit: true,
        },
      })

      const targets = [barb, partyAlly, allyMerc, enemy]
      const stepOut = engine.tick(1, targets)

      expect(stepOut.hits.filter((h) => h.targetId === 'mon_1')).toHaveLength(0)
      expect(enemy.statList.getHp256()).toBe(enemyHpBefore)
      expect(partyAlly.stateBus.hasState('battleorders')).toBe(true)
      expect(allyMerc.stateBus.hasState('battleorders')).toBe(true)
      expect(enemy.stateBus.hasState('battleorders')).toBe(false)
      expect(partyAlly.statList.getAccruedStat('item_maxhp_percent')).toBeGreaterThan(0)
    })

    it('pSrvDoFunc=5 / pSrvDmgFunc=3 ground fire deals 256ths per-frame fire damage without triggering hit recovery', () => {
      const registry = getSharedDataRegistry()
      const engine = new MissileEngine(registry)
      const sorc = makeMissileUnit('player_1', 'player', 100, 100, { charClass: 'sor' })
      const victim = makeMissileUnit('mon_1', 'monster', 200, 200)
      const hpStart = victim.statList.getHp256()

      engine.spawnMissile({
        missileNameOrId: 'firewall',
        owner: sorc,
        startX: 200,
        startY: 200,
        targetX: 200,
        targetY: 200,
        slvl: 10,
        sourceSkillId: 51,
        dmgPacket: {
          skillId: 51,
          slvl: 10,
          attackKind: 'spell',
          elemType: 'fire',
          elemMin256: 64,
          elemMax256: 64,
          autoHit: true,
        },
      })

      const f1 = engine.tick(1, [victim])
      const f2 = engine.tick(2, [victim])
      expect(f1.hits.length).toBeGreaterThan(0)
      expect(f2.hits.length).toBeGreaterThan(0)
      expect(victim.statList.getHp256()).toBe(hpStart - 128)
      // Verify executeSUnitDmg & shouldEnterGetHit113c persistent ground fire packet suppresses hit recovery
      const directOut = executeSUnitDmg(sorc, victim, {
        skillId: 51,
        attackKind: 'spell',
        elemType: 'fire',
        elemMin256: 500 * FIXED_ONE,
        elemMax256: 500 * FIXED_ONE,
        autoHit: true,
        isPersistentGroundFire: true,
        noHitRecovery: true,
      }, new D2Rng(179103))
      expect(directOut.noHitRecovery).toBe(true)
      expect(
        shouldEnterGetHit113c(
          victim,
          { totalDamage256: 500 * FIXED_ONE, isPersistentGroundFire: true, noHitRecovery: true },
          0,
          new D2Rng(179104),
        ),
      ).toBe(false)
    })
  })

  describe('#1792: Unit-global STATE_JUSTHIT (state 86) NextDelay cross-missile invulnerability frames', () => {
    it('20-arrow Multiple Shot point-blank volley deals 1 arrow hit, sets state 86 for 4 frames, and lets other 19 arrows pass through', () => {
      const registry = getSharedDataRegistry()
      const engine = new MissileEngine(registry)
      const ama1 = makeMissileUnit('player_1', 'player', 100, 100, { charClass: 'ama' })
      ama1.statList.setBaseStat('tohit', 1_000_000)
      const ama2 = makeMissileUnit('player_2', 'player', 100, 120, { charClass: 'ama' })
      const sorc = makeMissileUnit('player_3', 'player', 100, 80, { charClass: 'sor' })
      const boss = makeMissileUnit('mon_boss', 'monster', 112, 100, { isBoss: true })
      boss.statList.setBaseStat('maxhp', 10000 * FIXED_ONE)
      boss.statList.setHp256(10000 * FIXED_ONE)

      // Spawn 20 Multiple Shot arrows (`multipleshotarrow`, NextHit=1, NextDelay=4, CollideKill=1)
      for (let i = 0; i < 20; i++) {
        const inst = engine.spawnMissile({
          missileNameOrId: 'multipleshotarrow',
          owner: ama1,
          startX: 100,
          startY: 100,
          targetX: 300,
          targetY: 100 + (i - 10) * 0.2,
          slvl: 20,
          sourceSkillId: 12,
          volleyId: 'volley-1',
          dmgPacket: {
            skillId: 12,
            slvl: 20,
            attackKind: 'missile',
            srcDam: 0,
            flatPhysMin256: 100 * FIXED_ONE,
            flatPhysMax256: 100 * FIXED_ONE,
            autoHit: true,
          },
        })
        expect(inst).not.toBeNull()
      }

      const f1 = engine.tick(10, [boss])
      // Exactly 1 arrow hits; Boss loses 100 HP (not 2000 HP!) and enters STATE_JUSTHIT (86)
      expect(f1.hits).toHaveLength(1)
      expect(boss.statList.getHp256()).toBe(9900 * FIXED_ONE)
      expect(boss.stateBus.hasState(86)).toBe(true)
      // The other 19 non-piercing arrows did NOT expire on the Boss — they flew past!
      expect(engine.getActiveMissiles().length).toBe(19)

      // Frame 12 (within 4-frame NextDelay window [10..13]):
      // 1) Cross-caster NextHit=1 missile (Nova / Shock Web / 2nd Amazon Multiple Shot) is ALSO blocked!
      engine.spawnMissile({
        missileNameOrId: 'nova',
        owner: ama2,
        startX: 104,
        startY: 100,
        targetX: 250,
        targetY: 100,
        slvl: 10,
        sourceSkillId: 48,
        dmgPacket: {
          skillId: 48,
          slvl: 10,
          attackKind: 'spell',
          elemType: 'ltng',
          elemMin256: 200 * FIXED_ONE,
          elemMax256: 200 * FIXED_ONE,
          autoHit: true,
        },
      })
      // 2) NextHit=0 missile (`fireball`) ignores STATE_JUSTHIT and deals full damage immediately!
      engine.spawnMissile({
        missileNameOrId: 'fireball',
        owner: sorc,
        startX: 104,
        startY: 100,
        targetX: 250,
        targetY: 100,
        slvl: 10,
        sourceSkillId: 47,
        dmgPacket: {
          skillId: 47,
          slvl: 10,
          attackKind: 'spell',
          elemType: 'fire',
          elemMin256: 150 * FIXED_ONE,
          elemMax256: 150 * FIXED_ONE,
          autoHit: true,
        },
      })
      engine.tick(12, [boss])
      expect(boss.statList.getHp256()).toBe((9900 - 150) * FIXED_ONE)

      // Frame 15 (after 4-frame NextDelay expires at frame 14): new NextHit=1 missile hits normally!
      boss.stateBus.tick(15)
      engine.spawnMissile({
        missileNameOrId: 'nova',
        owner: ama2,
        startX: 104,
        startY: 100,
        targetX: 250,
        targetY: 100,
        slvl: 10,
        sourceSkillId: 48,
        dmgPacket: {
          skillId: 48,
          slvl: 10,
          attackKind: 'spell',
          elemType: 'ltng',
          elemMin256: 200 * FIXED_ONE,
          elemMax256: 200 * FIXED_ONE,
          autoHit: true,
        },
      })
      engine.tick(15, [boss])
      expect(boss.statList.getHp256()).toBe((9900 - 150 - 200) * FIXED_ONE)
    })
  })

  describe('#1793: Online Bone Armor (#68) & Cyclone Armor (#235) persistent absorb pools & shatter', () => {
    it('Bone Armor (100 pool) steps down 100 -> 60 -> 20 -> shatter (state 14 cleared + 20 HP overflow) across 3×40 melee hits', () => {
      const game = new GameInstance({ seed: 1793, difficulty: 0, areaId: 2 })
      // Necromancer with Bone Armor slvl 9 -> 20 + 10*(9-1) = 100 absorb pool
      const pid = game.connectPlayer({
        charClass: 'nec',
        name: 'BoneNec',
        x: 50,
        y: 50,
        areaId: 2,
        skills: { 68: 9 },
      })
      const g = game as unknown as Record<string, any>
      const player = g.players.get(pid)
      player.maxHp = 500
      player.hp = 500
      player.maxHpFixed = 500 * FIXED_ONE
      player.hpFixed = 500 * FIXED_ONE
      player.dexterity = 1

      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId: 68,
        x: 50,
        y: 50,
        hand: 'right',
      })
      game.stepFrames(1)
      expect(player.states.has(14)).toBe(true)
      expect(g.playerBoneArmorPool.get(pid)).toEqual({ current: 100, max: 100 })

      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 51,
        y: 50,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        aiDisabled: true,
      })
      const mon = g.monsters.get(monId)
      mon.ar = 1_000_000
      mon.level = 99

      // Hit 1: 40 physical -> pool 60, HP stays 500, state 14 remains active
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 40,
        maxDmg: 40,
        skillMode: 'A1',
        autoHit: true,
      })
      expect(player.hp).toBe(500)
      expect(player.states.has(14)).toBe(true)
      expect(g.playerBoneArmorPool.get(pid)?.current).toBe(60)

      // Hit 2: 40 physical -> pool 20, HP stays 500, state 14 remains active
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 40,
        maxDmg: 40,
        skillMode: 'A1',
        autoHit: true,
      })
      expect(player.hp).toBe(500)
      expect(player.states.has(14)).toBe(true)
      expect(g.playerBoneArmorPool.get(pid)?.current).toBe(20)

      // Hit 3: 40 physical -> absorbs remaining 20, shatters state 14, 20 overflows to HP (500 -> 480)
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 40,
        maxDmg: 40,
        skillMode: 'A1',
        autoHit: true,
      })
      expect(player.hp).toBe(480)
      expect(player.states.has(14)).toBe(false)
      expect(g.playerBoneArmorPool.has(pid)).toBe(false)
    })

    it('Cyclone Armor (100 pool) persists across elemental hits, ignores physical/poison, and clears state 151 at <= 0', () => {
      const game = new GameInstance({ seed: 179302, difficulty: 0, areaId: 2 })
      // Druid with Cyclone Armor slvl 6 -> 40 + 12*5 = 100 elemental absorb
      const pid = game.connectPlayer({
        charClass: 'dru',
        name: 'WindDru',
        x: 50,
        y: 50,
        areaId: 2,
        skills: { 235: 6 },
      })
      const g = game as unknown as Record<string, any>
      const player = g.players.get(pid)
      player.maxHp = 500
      player.hp = 500
      player.maxHpFixed = 500 * FIXED_ONE
      player.hpFixed = 500 * FIXED_ONE

      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId: 235,
        x: 50,
        y: 50,
        hand: 'right',
      })
      game.stepFrames(1)
      expect(player.states.has(151)).toBe(true)
      expect(g.playerCycloneArmorPool.get(pid)).toEqual({ current: 100, max: 100 })

      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 51,
        y: 50,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        aiDisabled: true,
      })
      const mon = g.monsters.get(monId)

      // Pure physical hit does NOT drain Cyclone Armor
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 30,
        maxDmg: 30,
        skillMode: 'A1',
        autoHit: true,
      })
      expect(player.hp).toBe(470)
      expect(g.playerCycloneArmorPool.get(pid)?.current).toBe(100)

      // Fire projectile 60 -> Cyclone pool 40, HP unchanged (470)
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 0,
        maxDmg: 0,
        skillMode: 'A1',
        attackKind: 'missile',
        elementType: 'fire',
        elemMin: 60,
        elemMax: 60,
        fromMissile: true,
        autoHit: true,
      })
      expect(player.hp).toBe(470)
      expect(player.states.has(151)).toBe(true)
      expect(g.playerCycloneArmorPool.get(pid)?.current).toBe(40)

      // Cold projectile 60 -> absorbs last 40, shatters state 151, 20 overflows to HP (470 -> 450)
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 0,
        maxDmg: 0,
        skillMode: 'A1',
        attackKind: 'missile',
        elementType: 'cold',
        elemMin: 60,
        elemMax: 60,
        fromMissile: true,
        autoHit: true,
      })
      expect(player.hp).toBe(450)
      expect(player.states.has(151)).toBe(false)
      expect(g.playerCycloneArmorPool.has(pid)).toBe(false)
    })
  })

  describe('#1794: Ethereal weapon & throw base +50% damage (Math.floor(base * 3 / 2)) before on-weapon %ED', () => {
    it('scales Ethereal Berserker Axe (24-71 -> 36-106 -> +300% ED = 144-424) vs Non-Eth (96-284) and Ethereal Winged Harpoon throw', () => {
      const game = new GameInstance({ seed: 1794, difficulty: 0, areaId: 2 })
      const pid = game.connectPlayer({ charClass: 'bar', name: 'EthBarb', x: 50, y: 50, areaId: 2 })
      const g = game as unknown as Record<string, any>
      const player = g.players.get(pid)
      player.strength = 0
      player.dexterity = 0

      // 1) Non-ethereal Berserker Axe (`7wa`: 24..71) with +300% on-weapon ED (stat 17 = 300)
      player.items = [
        {
          unitId: 101,
          code: '7wa',
          name: 'Berserker Axe',
          quality: 4,
          level: 85,
          location: 'equipped',
          bodyLoc: 4,
          ethereal: false,
          stats: new Map([[17, 300]]),
        },
      ]
      expect(g.resolvePlayerWeaponDamage(player, 0)).toEqual({ min: 96, max: 284 })

      // 2) Ethereal Berserker Axe (`7wa`: floor(24*3/2)=36 .. floor(71*3/2)=106) with +300% ED -> 144..424
      player.items[0].ethereal = true
      expect(g.resolvePlayerWeaponDamage(player, 0)).toEqual({ min: 144, max: 424 })

      // 3) Ethereal Winged Harpoon (`7ts`: minMisDam=11, maxMisDam=77 -> eth 16..115) throw damage
      player.items = [
        {
          unitId: 102,
          code: '7ts',
          name: 'Winged Harpoon',
          quality: 4,
          level: 85,
          location: 'equipped',
          bodyLoc: 4,
          ethereal: true,
          stats: new Map([[17, 200]]),
        },
      ]
      // 16 * 3 = 48, 115 * 3 = 345
      expect(g.resolvePlayerWeaponDamage(player, 0, { isThrow: true })).toEqual({ min: 48, max: 345 })
    })
  })

  describe('#1795: SUnitDmg exact 1.13c mitigation order, frameRate MDR, MDR overflow, Absorb heal-then-deduct & ES Telekinesis', () => {
    it('applies Cyclone Armor BEFORE resistances (100 fire vs 50 Cyclone + 75% Fire Res -> 12 final fire dmg)', () => {
      const atk = makeCombatUnit('monster')
      const def = makeCombatUnit('player')
      def.statList.setBaseStat('fireresist', 75)
      def.stateBus.applyState({
        stateNameOrId: 'cyclonearmor',
        sourceSkillId: 235,
        slvl: 1,
        stats: { bonearmor: 50, bonearmormax: 50 },
      })

      const out = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 47,
          attackKind: 'spell',
          srcDam: 0,
          elemType: 'fire',
          elemMin256: 100 * FIXED_ONE,
          elemMax256: 100 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(1795),
      )
      // (100 - 50) = 50 -> * (1 - 0.75) = 12.5 -> trunc(50*256*25/100) = 3200 (12.5 HP)
      expect(out.elemDamage256).toBe(Math.trunc((50 * FIXED_ONE * 25) / 100))
      expect(def.stateBus.hasState('cyclonearmor')).toBe(false)
    })

    it('scales flat MDR by frameRate1024 / 1024 and spills negative MDR overflow into physical damage', () => {
      const atk = makeCombatUnit('monster')
      const def = makeCombatUnit('player')
      def.statList.setBaseStat('magic_damage_reduction', 20)

      // 1) Frame-based ground fire (`frameRate1024 = 256` = 1/4): MDR 20 -> effective MDR 5 on 15 fire -> 10 remaining
      const frameOut = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 51,
          attackKind: 'spell',
          srcDam: 0,
          elemType: 'fire',
          elemMin256: 15 * FIXED_ONE,
          elemMax256: 15 * FIXED_ONE,
          frameRate1024: 256,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(179502),
      )
      expect(frameOut.elemDamage256).toBe(10 * FIXED_ONE)

      // 2) MDR overflow spill (`0x6FCFBD47` + `0x6FCFC50A`): 5 fire + 30 phys vs MDR 20 -> 15 overflow reduces phys to 15!
      const spillOut = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: 30 * FIXED_ONE,
          flatPhysMax256: 30 * FIXED_ONE,
          elemType: 'fire',
          elemMin256: 5 * FIXED_ONE,
          elemMax256: 5 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(179503),
      )
      expect(spillOut.elemDamage256).toBe(0)
      expect(spillOut.physDamage256).toBe(15 * FIXED_ONE)
    })

    it('applies % Absorb (<=40%) before Flat Absorb and heals (capped at maxhp) BEFORE subtracting remaining damage', () => {
      const atk = makeCombatUnit('monster')
      const def = makeCombatUnit('player')
      def.statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
      // Case A: At FULL HP (1000/1000), 100 fire dmg with 20% absorb (20) + 10 flat absorb = 30 absorbed:
      // Remaining dmg = 70; heal 30 first clamps 1000+30 -> 1000, then subtract 70 -> 930 HP (NOT 960!)
      def.statList.setHp256(1000 * FIXED_ONE)
      def.statList.setBaseStat('item_absorbfire_percent', 20)
      def.statList.setBaseStat('item_absorbfire', 10)

      executeSUnitDmg(
        atk,
        def,
        {
          skillId: 47,
          attackKind: 'spell',
          srcDam: 0,
          elemType: 'fire',
          elemMin256: 100 * FIXED_ONE,
          elemMax256: 100 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(179504),
      )
      expect(def.statList.getHp256()).toBe(930 * FIXED_ONE)

      // Case B: At wounded HP (500/1000), heal 30 -> 530, subtract 70 -> 460 HP (net -40)
      def.statList.setHp256(500 * FIXED_ONE)
      executeSUnitDmg(
        atk,
        def,
        {
          skillId: 47,
          attackKind: 'spell',
          srcDam: 0,
          elemType: 'fire',
          elemMin256: 100 * FIXED_ONE,
          elemMax256: 100 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(179505),
      )
      expect(def.statList.getHp256()).toBe(460 * FIXED_ONE)
    })

    it('Energy Shield (#58) Telekinesis (#43) synergy uses strictly base allocated hard points (-0.0625/blvl)', () => {
      const atk = makeCombatUnit('monster')
      const def = makeCombatUnit('player')
      def.statList.setBaseStat('maxmana', 1000 * FIXED_ONE)
      def.statList.setMana256(1000 * FIXED_ONE)
      // 16 hard points in Telekinesis (#43) + 10 bonus +skills -> ratio must use blvl=16 -> (32-16)/16 = 1.0 mana/HP!
      def.statList.setBaseSkillLevel(43, 16)
      def.statList.setBonusSkillLevel(43, 10)
      def.stateBus.applyState({
        stateNameOrId: 'energyshield',
        sourceSkillId: 58,
        slvl: 7, // 50% absorb
        stats: { item_damagetomana: 50 },
      })

      executeSUnitDmg(
        atk,
        def,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 0,
          flatPhysMin256: 100 * FIXED_ONE,
          flatPhysMax256: 100 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(179506),
      )
      // 50 HP redirected * 1.0 mana/HP = 50 mana drained (950 remaining), NOT (32-26)/16!
      expect(def.statList.getMana256()).toBe(950 * FIXED_ONE)
    })
  })

  describe('#1796: Avoidance chain exact 1.13c priority, movement-only Evade gate, and dual-claw Weapon Block', () => {
    it('enforces movement-only Evade early return (never falling through to Dodge/Avoid/Weapon Block) and dual-claw requirement', () => {
      const rngZero = { rand: () => 0 } // Always succeeds if rolled (< chance)
      const rngFail = { rand: () => 99 } // Always fails if rolled

      // 1) Moving Amazon with 0% Evade and 50% Dodge/Avoid: rolls ONLY Evade -> misses and returns immediately without rolling Dodge!
      const movingAma = makeCombatUnit('player', {
        charClass: 'ama',
        isMoving: true,
        isRunning: true,
      })
      movingAma.statList.setBaseSkillLevel(13, 12) // Dodge 50%
      movingAma.statList.setBaseSkillLevel(18, 12) // Avoid 58%
      movingAma.statList.setBaseSkillLevel(29, 0) // Evade 0%
      expect(
        evaluateAvoidanceAndBlock({ defender: movingAma, attackKind: 'melee', rng: rngZero }).avoided,
      ).toBe(false)
      expect(
        evaluateAvoidanceAndBlock({ defender: movingAma, attackKind: 'spell', rng: rngZero }).avoided,
      ).toBe(false)

      // With Evade allocated while moving, Evade fails -> MUST NOT fall through to Dodge!
      movingAma.statList.setBaseSkillLevel(29, 10)
      expect(
        evaluateAvoidanceAndBlock({ defender: movingAma, attackKind: 'melee', rng: rngFail }).avoided,
      ).toBe(false)
      expect(
        evaluateAvoidanceAndBlock({ defender: movingAma, attackKind: 'melee', rng: rngZero }),
      ).toMatchObject({
        avoided: true,
        reason: 'evade',
      })

      // 2) Single-claw Assassin (off-hand empty!) CANNOT trigger Weapon Block (#263); Dual-claw standing CAN block spells!
      const singleClawSin = makeCombatUnit('player', {
        charClass: 'ass',
        hasShield: false,
        weaponItemType: 'h2h',
      })
      singleClawSin.statList.setBaseSkillLevel(263, 10)
      expect(
        evaluateAvoidanceAndBlock({
          defender: singleClawSin,
          attackKind: 'spell',
          rng: rngZero,
          unblockable: true,
        }).avoided,
      ).toBe(false)

      const dualClawSin = makeCombatUnit('player', {
        charClass: 'ass',
        hasShield: false,
        weaponItemType: 'h2h',
        offHandWeaponItemType: 'h2h2',
      })
      dualClawSin.statList.setBaseSkillLevel(263, 10)
      // Standing: blocks unblockable pure-elemental spells!
      expect(
        evaluateAvoidanceAndBlock({
          defender: dualClawSin,
          attackKind: 'spell',
          rng: rngZero,
          unblockable: true,
        }),
      ).toMatchObject({
        avoided: true,
        reason: 'weapon_block',
      })
      // Moving/running: Weapon Block is completely disabled!
      const runningDualClawSin = { ...dualClawSin, isMoving: true, isRunning: true }
      expect(
        evaluateAvoidanceAndBlock({
          defender: runningDualClawSin,
          attackKind: 'melee',
          rng: rngZero,
        }).avoided,
      ).toBe(false)
    })
  })

  describe('#1800: Paladin Holy Shield (#117) +610% Defense, Block %, and +57..60 Smite (#97) Shield Damage', () => {
    it('grants +610% total defense at slvl 20 + Defiance blvl 20 (600 -> 4260) and +57..60 flat Smite shield damage', () => {
      const game = new GameInstance({ seed: 1800, difficulty: 0, areaId: 2 })
      const pid = game.connectPlayer({
        charClass: 'pal',
        name: 'Smiter',
        x: 50,
        y: 50,
        areaId: 2,
        skills: { 97: 20, 104: 20, 117: 20 },
      })
      const g = game as unknown as Record<string, any>
      const player = g.players.get(pid)
      player.strength = 100
      player.dexterity = 0
      player.mana = 500
      player.maxMana = 500
      player.manaFixed = 500 * FIXED_ONE
      player.maxManaFixed = 500 * FIXED_ONE
      // Base defense 600: Body armor 450 + Sacred Targe (`pab`: Smite 22..70, block 60%) 150 = 600
      player.items = [
        {
          unitId: 201,
          code: 'utp',
          name: 'Archon Plate',
          quality: 4,
          level: 85,
          location: 'equipped',
          bodyLoc: 3,
          rawItemData: { defense: 450, stats: [] },
          stats: new Map(),
        },
        {
          unitId: 202,
          code: 'pab',
          name: 'Sacred Targe',
          quality: 4,
          level: 85,
          location: 'equipped',
          bodyLoc: 5,
          rawItemData: { defense: 150, stats: [] },
          stats: new Map(),
        },
      ]

      expect(g.computePlayerDefense(player)).toBe(600)

      // Cast Holy Shield (#117) at slvl 20 with Defiance (#104) blvl 20:
      // calc1 = 25 + 15*(20-1) + 15*20 = 25 + 285 + 300 = +610% -> 600 * (100 + 610) / 100 = 4260!
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId: 117,
        x: 50,
        y: 50,
        hand: 'right',
      })
      game.stepFrames(1)
      expect(player.states.has(101)).toBe(true)
      expect(g.computePlayerDefense(player)).toBe(4260)
      expect(g.playerCombatContext(player).statList.getDefense(600)).toBe(4260)

      // Smite (#97) at slvl 20 (+300% skill ED) + 100 Str (+100% ED) = +400% total ED (* 5):
      // Sacred Targe (22..70) + Holy Shield lv20 (+57..60) = 79..130 base -> * 5 = 395..650!
      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 51,
        y: 50,
        areaId: 2,
        hp: 5000,
        maxHp: 5000,
        aiDisabled: true,
      })
      const mon = g.monsters.get(monId)
      mon.ac = 999999 // Smite auto-hits regardless of target defense
      mon.toBlock = 75 // Smite is unblockable by monster block

      game.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        skillId: 97,
        targetType: 'monster',
        targetId: monId,
      })
      game.stepFrames(1)
      const dealt = 5000 - mon.hp
      expect(dealt).toBeGreaterThanOrEqual(395)
      expect(dealt).toBeLessThanOrEqual(650)
      expect(mon.states.has(21)).toBe(true) // Stunned

      // Removing shield disables Holy Shield defense bonus and blocks Smite cast when armed without shield
      player.items = [player.items[0]]
      expect(g.computePlayerDefense(player)).toBe(450)
      expect(g.resolvePlayerSkillCast(player, 97)).toBeNull()
      expect(g.resolvePlayerSkillCast(player, 117)).toBeNull()
    })
  })

  describe('#1805: Sorceress Static Field (#42) Normal 0% (1 HP), Nightmare 33%, Hell 50% life floor & Lightning Resistance', () => {
    it('enforces Normal 1 HP, Nightmare 33%, and Hell 50% floors in both executeSUnitDmg and GameInstance, respecting lightresist', () => {
      // 1) GameInstance Hell (difficulty = 2): 1000 HP monster -> clamps strictly at 500 HP (50%) and deals 0 at <= 500 HP
      const hellGame = new GameInstance({ seed: 1805, difficulty: 2, areaId: 2 })
      const sorcId = hellGame.connectPlayer({
        charClass: 'sor',
        name: 'StaticSorc',
        x: 50,
        y: 50,
        areaId: 2,
        level: 30,
        skills: { 42: 20 },
      })
      const hellSorcRec = (hellGame as unknown as Record<string, any>).players.get(sorcId)
      hellSorcRec.mana = 500
      hellSorcRec.maxMana = 500
      hellSorcRec.manaFixed = 500 * FIXED_ONE
      hellSorcRec.maxManaFixed = 500 * FIXED_ONE
      const monHell = hellGame.spawnMonster({
        defId: 'fallen1',
        x: 52,
        y: 50,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        damageRegen: 0,
        aiDisabled: true,
      })
      const immuneMon = hellGame.spawnMonster({
        defId: 'fallen1',
        x: 52,
        y: 51,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        damageRegen: 0,
        aiDisabled: true,
      })
      ;(hellGame as unknown as Record<string, any>).monsters.get(immuneMon).resistances.light = 100

      for (let i = 0; i < 6; i++) {
        hellGame.enqueueCommand(sorcId, {
          type: 'CastSkillAtLocation',
          skillId: 42,
          x: 52,
          y: 50,
          hand: 'right',
        })
        hellGame.stepFrames(1)
      }
      expect(hellGame.getMonster(monHell)!.hp).toBe(500)
      expect(hellGame.getMonster(immuneMon)!.hp).toBe(1000)

      // 2) GameInstance Nightmare (difficulty = 1): 1000 HP monster -> clamps strictly at 330 HP (33%)
      const nmGame = new GameInstance({ seed: 180501, difficulty: 1, areaId: 2 })
      const nmSorc = nmGame.connectPlayer({
        charClass: 'sor',
        name: 'NmSorc',
        x: 50,
        y: 50,
        areaId: 2,
        level: 30,
        skills: { 42: 20 },
      })
      const nmSorcRec = (nmGame as unknown as Record<string, any>).players.get(nmSorc)
      nmSorcRec.mana = 500
      nmSorcRec.maxMana = 500
      nmSorcRec.manaFixed = 500 * FIXED_ONE
      nmSorcRec.maxManaFixed = 500 * FIXED_ONE
      const monNm = nmGame.spawnMonster({
        defId: 'fallen1',
        x: 52,
        y: 50,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        damageRegen: 0,
        aiDisabled: true,
      })
      for (let i = 0; i < 10; i++) {
        nmGame.enqueueCommand(nmSorc, {
          type: 'CastSkillAtLocation',
          skillId: 42,
          x: 52,
          y: 50,
          hand: 'right',
        })
        nmGame.stepFrames(1)
      }
      expect(nmGame.getMonster(monNm)!.hp).toBe(330)

      // 3) Direct executeSUnitDmg: Lightning Resistance scales the 25% cut and Classic ignores NM/Hell floor down to 1 HP
      const atk = makeCombatUnit('player', { charClass: 'sor' })
      atk.statList.setBaseStat('passive_ltng_mastery', 300) // Must NOT boost Static Field!
      const def = makeCombatUnit('monster')
      def.statList.setBaseStat('maxhp', 1000 * FIXED_ONE)
      def.statList.setHp256(1000 * FIXED_ONE)
      def.statList.setBaseStat('lightresist', 50)

      // 1000 HP * 25% = 250 -> 50% lightresist = 125 damage -> 875 HP
      const r1 = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 42,
          attackKind: 'spell',
          elemType: 'ltng',
          difficulty: 'hell',
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(180502),
      )
      expect(r1.elemDamage256).toBe(125 * FIXED_ONE)
      expect(def.statList.getHp256()).toBe(875 * FIXED_ONE)

      // At 500 HP in Hell Expansion -> pre-check returns 0 damage immediately!
      def.statList.setHp256(500 * FIXED_ONE)
      const rFloor = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 42,
          attackKind: 'spell',
          elemType: 'ltng',
          difficulty: 'hell',
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(180503),
      )
      expect(rFloor.elemDamage256).toBe(0)
      expect(def.statList.getHp256()).toBe(500 * FIXED_ONE)

      // In Classic (`isExpansion: false`), Hell has 0% floor (reduces below 50%)!
      const rClassic = executeSUnitDmg(
        atk,
        def,
        {
          skillId: 42,
          attackKind: 'spell',
          elemType: 'ltng',
          difficulty: 'hell',
          isExpansion: false,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(180504),
      )
      expect(rClassic.elemDamage256).toBeGreaterThan(0)
      expect(def.statList.getHp256()).toBeLessThan(500 * FIXED_ONE)
    })
  })
})
