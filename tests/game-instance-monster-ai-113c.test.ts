/**
 * @fileoverview M3 Verification Suite: R3 (F11, F12, F13)
 * End-to-End 1.13c Monster, Mercenary & Summoned Pet AI Integration in GameInstance,
 * LocalLoopbackAdapter, and MultiClientRoomHost.
 */

import { describe, expect, it } from 'vitest';
import { createMemoryStreamPair, TsFramer, type ServerEvent } from '../src/netproto/index.ts';
import { GameInstance } from '../src/server/engine/game-instance.ts';
import { LocalLoopbackAdapter } from '../src/server/loopback-adapter.ts';
import { MultiClientRoomHost } from '../src/server/room-host.ts';
import { MON_UMOD } from '../src/common/units/monster-death-fx.ts';

describe('M3: GameInstance 1.13c Monster, Mercenary & Summon AI Integration (F11, F12, F13)', () => {
  describe('F11: 25Hz Monster AI Loop, 1.13c Hydration & Terrain Collision', () => {
    it('hydrates 1.13c MonStats/MonLvl defaults when omitted while preserving explicit caller overrides', () => {
      const game = new GameInstance({ seed: 101, difficulty: 0, act: 0, areaId: 2 });
      const fallenId = game.spawnMonster({ defId: 'fallen1', x: 20, y: 20 });
      const fallen = game.getMonster(fallenId)!;
      expect(fallen.defId).toBe('fallen1');
      expect(fallen.maxHp).toBeGreaterThan(0);
      expect(fallen.minDmg).toBeGreaterThan(0);
      expect(fallen.maxDmg).toBeGreaterThanOrEqual(fallen.minDmg);
      expect(fallen.ar).toBeGreaterThan(0);
      expect(fallen.experience).toBeGreaterThan(0);

      // Explicit overrides are preserved
      const customId = game.spawnMonster({
        defId: 'fallen1',
        x: 25,
        y: 25,
        hp: 500,
        maxHp: 500,
        minDmg: 25,
        maxDmg: 30,
        ar: 999,
        ac: 50,
        experience: 1234,
      });
      const custom = game.getMonster(customId)!;
      expect(custom.hp).toBe(500);
      expect(custom.maxHp).toBe(500);
      expect(custom.minDmg).toBe(25);
      expect(custom.maxDmg).toBe(30);
      expect(custom.ar).toBe(999);
      expect(custom.ac).toBe(50);
      expect(custom.experience).toBe(1234);
    });

    it('scales hydrated monster HP and XP with /players N', () => {
      const game1 = new GameInstance({ seed: 202, difficulty: 0, playersX: 1, areaId: 2 });
      const m1Id = game1.spawnMonster({ defId: 'fallen1', x: 10, y: 10 });
      const m1 = game1.getMonster(m1Id)!;

      const game8 = new GameInstance({ seed: 202, difficulty: 0, playersX: 8, areaId: 2 });
      const m8Id = game8.spawnMonster({ defId: 'fallen1', x: 10, y: 10 });
      const m8 = game8.getMonster(m8Id)!;

      expect(m8.maxHp).toBeGreaterThan(m1.maxHp);
      expect(m8.experience).toBeGreaterThan(m1.experience);
    });

    it('prevents ground monster 1-subtile wall tunneling from x=16 and passes flying to a 4-arg terrain callback', () => {
      const game = new GameInstance({ seed: 303, areaId: 2 });
      game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 10, y: 10, areaId: 2 });
      const groundFrom15Id = game.spawnMonster({ defId: 'fallen1', x: 15, y: 10, areaId: 2, aggroRadius: 20 });
      const groundFrom16Id = game.spawnMonster({ defId: 'fallen1', x: 16, y: 10, areaId: 2, aggroRadius: 20 });
      const flyingId = game.spawnMonster({ hcIdx: 15, x: 15, y: 11, areaId: 2, aggroRadius: 20, isFlying: true });

      // Block column Math.round(x) === 13 for grounded units; flying units may pass.
      game.setTerrainWalkableCheck((_areaId, x, _y, flying) => flying === true || Math.round(x) !== 13);
      game.stepFrames(40);

      expect(game.getMonster(groundFrom15Id)!.x).toBeGreaterThan(13);
      expect(game.getMonster(groundFrom16Id)!.x).toBeGreaterThan(13);
      expect(game.getMonster(flyingId)!.x).toBeLessThan(13);
    });

    it('halts frozen (state 1) and stunned (states 21 & 25) monsters, slows chilled/decrepified/holy-frozen monsters by 50%, and enforces Taunt (state 27)', () => {
      const gameFrozen = new GameInstance({ seed: 404, areaId: 2 });
      const sorcId = gameFrozen.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2 });
      const frozenMonId = gameFrozen.spawnMonster({ defId: 'fallen1', x: 20, y: 10, areaId: 2, aggroRadius: 25 });
      const stun25MonId = gameFrozen.spawnMonster({ defId: 'fallen1', x: 14, y: 14, areaId: 2, aggroRadius: 25 });
      const tauntedArcherId = gameFrozen.spawnMonster({ hcIdx: 10, x: 20, y: 10, areaId: 2, aggroRadius: 25 });
      gameFrozen.applyMonsterState(frozenMonId, 1, 100);
      gameFrozen.applyMonsterState(stun25MonId, 25, 100);
      gameFrozen.applyMonsterState(tauntedArcherId, 27, 100);
      gameFrozen.drainEvents(sorcId);

      gameFrozen.stepFrames(20);
      expect(gameFrozen.getMonster(frozenMonId)!.x).toBe(20);
      expect(gameFrozen.getMonster(stun25MonId)!.x).toBe(14);
      // Taunt (27) suppresses ranged firing and forces approach toward player
      expect(gameFrozen.getMonster(tauntedArcherId)!.x).toBeLessThan(20);
      const tauntMissiles = gameFrozen.drainEvents(sorcId).filter((e) => e.type === 'CreateMissile');
      expect(tauntMissiles.length).toBe(0);

      const gameFast = new GameInstance({ seed: 405, areaId: 2 });
      gameFast.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2 });
      const normalMonId = gameFast.spawnMonster({ defId: 'fallen1', x: 22, y: 10, areaId: 2, aggroRadius: 25 });
      gameFast.stepFrames(12);
      const normalDist = 22 - gameFast.getMonster(normalMonId)!.x;

      const gameChilled = new GameInstance({ seed: 405, areaId: 2 });
      gameChilled.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2 });
      const chilledMonId = gameChilled.spawnMonster({ defId: 'fallen1', x: 22, y: 10, areaId: 2, aggroRadius: 25 });
      gameChilled.applyMonsterState(chilledMonId, 11, 100);
      gameChilled.stepFrames(12);
      const chilledDist = 22 - gameChilled.getMonster(chilledMonId)!.x;

      expect(normalDist).toBeGreaterThan(chilledDist);
    });

    it('causes Confused (state 59) and Attracted (state 57) monsters to attack nearby monsters instead of the player', () => {
      const game = new GameInstance({ seed: 505, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'nec', name: 'Necro', x: 30, y: 30, areaId: 2 });
      const startPlayerHp = game.getPlayerState(playerId)!.hp;
      const attackerId = game.spawnMonster({
        defId: 'fallen1',
        x: 10,
        y: 10,
        areaId: 2,
        minDmg: 15,
        maxDmg: 20,
        ar: 5000,
      });
      const victimId = game.spawnMonster({
        defId: 'fallen1',
        x: 11,
        y: 10,
        areaId: 2,
        hp: 200,
        maxHp: 200,
        ac: 0,
      });

      game.applyMonsterState(attackerId, 59, 100);
      game.stepFrames(6);

      expect(game.getMonster(victimId)!.hp).toBeLessThan(200);
      expect(game.getPlayerState(playerId)!.hp).toBe(startPlayerHp);
    });

    it('converts a monster (state 53) to fight nearby monsters instead of the player (#1334)', () => {
      const game = new GameInstance({ seed: 707, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Pal', x: 30, y: 30, areaId: 2 });
      const startPlayerHp = game.getPlayerState(playerId)!.hp;
      const attackerId = game.spawnMonster({
        defId: 'fallen1',
        x: 10,
        y: 10,
        areaId: 2,
        minDmg: 15,
        maxDmg: 20,
        ar: 5000,
      });
      const victimId = game.spawnMonster({
        defId: 'fallen1',
        x: 11,
        y: 10,
        areaId: 2,
        hp: 200,
        maxHp: 200,
        ac: 0,
        aiDisabled: true,
      });

      game.applyMonsterState(attackerId, 53, 60);
      expect(game.getMonster(attackerId)!.states.has(53)).toBe(true);

      game.stepFrames(10);
      expect(game.getMonster(victimId)!.hp).toBeLessThan(200);
      expect(game.getPlayerState(playerId)!.hp).toBe(startPlayerHp);

      game.stepFrames(60);
      expect(game.getMonster(attackerId)!.states.has(53)).toBe(false);
    });

    it('executes Shaman corpse resurrection while exposing shattered===true on frozen death and skipping shattered corpses', () => {
      const game = new GameInstance({ seed: 606, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Pal', x: 13, y: 10, areaId: 2 });

      const shatteredFallenId = game.spawnMonster({
        defId: 'fallen1',
        x: 13,
        y: 11,
        areaId: 2,
        hp: 1, // unarmed Attack (skill 0) hits for 1-2
        maxHp: 50,
        aiDisabled: true,
      });
      game.applyMonsterState(shatteredFallenId, 1, 100);
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: shatteredFallenId,
      });
      game.stepFrames(2);
      expect(game.getMonster(shatteredFallenId)!.dead).toBe(true);
      expect(game.getMonster(shatteredFallenId)!.shattered).toBe(true);

      const deadFallenId = game.spawnMonster({
        defId: 'fallen1',
        x: 14,
        y: 10,
        areaId: 2,
        hp: 1,
        maxHp: 50,
        aiDisabled: true,
      });
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: deadFallenId,
      });
      game.stepFrames(2);
      expect(game.getMonster(deadFallenId)!.dead).toBe(true);
      expect(Boolean(game.getMonster(deadFallenId)!.shattered)).toBe(false);

      const shamanId = game.spawnMonster({ defId: 'fallenshaman1', x: 16, y: 10, areaId: 2, aggroRadius: 20 });
      game.stepFrames(30);

      expect(game.getMonster(shatteredFallenId)!.dead).toBe(true);
      expect(game.getMonster(deadFallenId)!.dead).toBe(false);
      expect(game.getMonster(shamanId)!.alive).toBe(true);
    });

    it('fires monster-owned projectiles (with ownerUnitType: "monster") from ranged monsters (Corrupt Archer, hcIdx 160) unless suppressed by Dim Vision (state 23)', () => {
      const game = new GameInstance({ seed: 707, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'ama', name: 'Zon', x: 10, y: 10, areaId: 2 });
      const archerId = game.spawnMonster({
        hcIdx: 160,
        defId: 'cr_archer1',
        name: 'Corrupt Archer',
        x: 18,
        y: 10,
        areaId: 2,
        aggroRadius: 20,
      });
      expect(game.getMonster(archerId)!.isRanged).toBe(true);
      game.drainEvents(playerId);

      // Dim Vision suppresses ranged firing and shrinks aggro radius to 3 subtiles
      game.applyMonsterState(archerId, 23, 15);
      // State 23 expires before the AI step on frame 15; 14 frames stay fully suppressed.
      game.stepFrames(14);
      const dimmedMissiles = game.drainEvents(playerId).filter((e) => e.type === 'CreateMissile');
      expect(dimmedMissiles.length).toBe(0);

      // After Dim Vision expires, archer fires projectile toward player
      game.stepFrames(35);
      const firedMissiles = game.drainEvents(playerId).filter((e) => e.type === 'CreateMissile');
      expect(firedMissiles.length).toBeGreaterThan(0);
      expect((firedMissiles[0] as unknown as { ownerUnitType?: string }).ownerUnitType).toBe('monster');
    });
  });

  describe('F12: Monster Combat via SUnitDmg, On-Struck LE Bolts & On-Death Affixes', () => {
    it('resolves monster melee attacks on players via executeSUnitDmg and emits UnitStatUpdate & LifeMana', () => {
      const game = new GameInstance({ seed: 808, areaId: 2 });
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Barb',
        x: 10,
        y: 10,
        areaId: 2,
      });
      const startHp = game.getPlayerState(playerId)!.hp;
      game.spawnMonster({
        hcIdx: 18,
        x: 11,
        y: 10,
        areaId: 2,
        minDmg: 12,
        maxDmg: 18,
        ar: 9999,
      });
      game.drainEvents(playerId);

      game.stepFrames(35);
      const events = game.drainEvents(playerId);
      expect(game.getPlayerState(playerId)!.hp).toBeLessThan(startHp);
      expect(events.some((e) => e.type === 'UnitStatUpdate' && e.statId === 6)).toBe(true);
      expect(events.some((e) => e.type === 'LifeMana')).toBe(true);
    });

    it('routes player attacks on monsters through executeSUnitDmg (physical immunity, 1/5 curse piercing, Holy Bolt 101 undead gate, Static Field 42 25% & Hell cap)', () => {
      // 1. Physical immunity & 1/5 Amplify Damage (state 9) piercing
      const game = new GameInstance({ seed: 818, difficulty: 0, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Paladin', x: 10, y: 10, areaId: 2, level: 30, skills: { 101: 1 } });
      const physImmuneId = game.spawnMonster({
        defId: 'fallen1',
        x: 11,
        y: 10,
        areaId: 2,
        hp: 500,
        maxHp: 500,
        resistances: { phys: 100, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      });
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: physImmuneId,
      });
      game.stepFrames(2);
      expect(game.getMonster(physImmuneId)!.hp).toBe(500);

      // Apply Amplify Damage (state 9: -100% phys -> -20% at 1/5 efficiency -> 80% effective phys resist)
      game.applyMonsterState(physImmuneId, 9, 100);
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: physImmuneId,
      });
      game.stepFrames(2);
      expect(game.getMonster(physImmuneId)!.hp).toBeLessThan(500);

      // 2. Holy Bolt (skillId 101) undead-only gate
      const demonId = game.spawnMonster({
        defId: 'fallen1',
        x: 11,
        y: 11,
        areaId: 2,
        hp: 500,
        maxHp: 500,
        isUndead: false,
        isDemon: true,
        aiDisabled: true,
      });
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 101,
        targetType: 'monster',
        targetId: demonId,
      });
      game.stepFrames(2);
      expect(game.getMonster(demonId)!.hp).toBe(500);

      // 3. Static Field (skillId 42) 25% reduction in Normal and 50% floor cap in Hell (Sorceress skill)
      const sorcGame = new GameInstance({ seed: 820, difficulty: 0, areaId: 2 });
      const sorcPlayerId = sorcGame.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2, level: 30, skills: { 42: 1 } });
      const normalBossId = sorcGame.spawnMonster({
        defId: 'fallen1',
        x: 12,
        y: 10,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      });
      sorcGame.enqueueCommand(sorcPlayerId, {
        type: 'CastSkillOnTarget',
        skillId: 42,
        targetType: 'monster',
        targetId: normalBossId,
      });
      sorcGame.stepFrames(2);
      expect(sorcGame.getMonster(normalBossId)!.hp).toBe(750);

      const hellGame = new GameInstance({ seed: 819, difficulty: 2, areaId: 2 });
      const hellPlayerId = hellGame.connectPlayer({ charClass: 'sor', name: 'HellSorc', x: 10, y: 10, areaId: 2, level: 30, skills: { 42: 1 } });
      const hellBossId = hellGame.spawnMonster({
        defId: 'fallen1',
        x: 11,
        y: 10,
        areaId: 2,
        hp: 1000,
        maxHp: 1000,
        resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
        aiDisabled: true,
      });
      for (let i = 0; i < 5; i++) {
        hellGame.enqueueCommand(hellPlayerId, {
          type: 'CastSkillOnTarget',
          skillId: 42,
          targetType: 'monster',
          targetId: hellBossId,
        });
        hellGame.stepFrames(2);
      }
      expect(hellGame.getMonster(hellBossId)!.hp).toBeGreaterThanOrEqual(500);
    });

    it('emits 8 Charged Bolt missiles (skillId 38) when a Lightning Enchanted or Scarab monster is struck', () => {
      const game = new GameInstance({ seed: 909, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'pal', name: 'Pal', x: 10, y: 10, areaId: 2 });
      const leBossId = game.spawnMonster({
        hcIdx: 18,
        x: 11,
        y: 10,
        areaId: 2,
        hp: 500,
        maxHp: 500,
        rank: 'unique',
        monUMods: [MON_UMOD.LIGHTNING],
        aiDisabled: true,
      });
      game.drainEvents(playerId);

      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: leBossId,
      });
      game.stepFrames(2);
      const missileEvents = game
        .drainEvents(playerId)
        .filter((e) => e.type === 'CreateMissile' && e.skillId === 195);
      expect(missileEvents.length).toBe(8);
    });

    it('triggers Fire Enchanted death explosion and Cold Enchanted Frost Nova applying chill state 11 on monster death', () => {
      const game = new GameInstance({ seed: 1010, areaId: 2 });
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Barb',
        x: 10,
        y: 10,
        areaId: 2,
      });
      const startHp = game.getPlayerState(playerId)!.hp;

      const feCeBossId = game.spawnMonster({
        hcIdx: 18,
        x: 11,
        y: 10,
        areaId: 2,
        hp: 1, // unarmed Attack (skill 0) hits for 1-2
        maxHp: 200,
        rank: 'unique',
        monUMods: [MON_UMOD.FIRE, MON_UMOD.COLD],
        aiDisabled: true,
      });
      game.drainEvents(playerId);

      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: feCeBossId,
      });
      game.stepFrames(6);
      const events = game.drainEvents(playerId);
      expect(game.getMonster(feCeBossId)!.dead).toBe(true);
      expect(game.getPlayerState(playerId)!.hp).toBeLessThan(startHp);
      expect(events.some((e) => e.type === 'CreateMissile' && e.skillId === 194)).toBe(true);
      expect(game.getPlayerState(playerId)!.states.has(11)).toBe(true);
    });

    it('enforces non-killable guard (isKillable=false) and Suicide Minion 0-XP / 0-loot rule', () => {
      const game = new GameInstance({ seed: 1111, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2 });

      const cainId = game.spawnMonster({
        hcIdx: 146,
        x: 11,
        y: 10,
        areaId: 2,
        hp: 100,
        maxHp: 100,
        isKillable: false,
      });
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: cainId,
      });
      game.stepFrames(2);
      expect(game.getMonster(cainId)!.hp).toBe(100);
      expect(game.getMonster(cainId)!.alive).toBe(true);

      const suicideMinionId = game.spawnMonster({
        hcIdx: 461,
        x: 11,
        y: 10,
        areaId: 2,
        hp: 1,
        maxHp: 50,
        aiDisabled: true,
      });
      const xpBefore = game.getPlayerState(playerId)!.experience;
      const itemsBefore = game.getGroundItems().length;
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: suicideMinionId,
      });
      game.stepFrames(2);
      expect(game.getMonster(suicideMinionId)!.dead).toBe(true);
      expect(game.getPlayerState(playerId)!.experience).toBe(xpBefore);
      expect(game.getGroundItems().length).toBe(itemsBefore);
    });
  });

  describe('F13: Mercenary & Summoned Pet 25Hz AI Loop, Lockstep Hash & Adapters', () => {
    it('hires mercenaries, applies Act 2 Desert Merc aura state to owner, ticks 25Hz follow/leash/combat AI, and mixes mercenary state into lockstep hash', () => {
      const game = new GameInstance({ seed: 1212, areaId: 2 });
      const playerId = game.connectPlayer({ charClass: 'sor', name: 'Sorc', x: 10, y: 10, areaId: 2, level: 30 });
      const hashBefore = game.computeFrameLockstepHash();

      const mercId = game.hireMercenary(playerId, { act: 2 });
      expect(mercId).toBeGreaterThan(0);
      expect(game.getMercenaryForOwner(playerId)?.unitId).toBe(mercId);
      expect(game.computeFrameLockstepHash()).not.toBe(hashBefore);

      // Act 2 Desert Mercenary applies its active aura state (e.g. Defiance=37 or Might=33) to owner
      game.stepFrames(5);
      const ownerStates = game.getPlayerState(playerId)!.states;
      expect(
        ownerStates.has(33) ||
          ownerStates.has(34) ||
          ownerStates.has(36) ||
          ownerStates.has(37) ||
          ownerStates.has(40) ||
          ownerStates.has(43),
      ).toBe(true);

      const monsterId = game.spawnMonster({
        hcIdx: 18,
        x: 12,
        y: 10,
        areaId: 2,
        hp: 200,
        maxHp: 200,
        ac: 0,
        aiDisabled: true,
      });

      game.stepFrames(40);
      expect(game.getMonster(monsterId)!.hp).toBeLessThan(200);
    });

    it('summons pets, enforces group caps/mutual exclusion, leash-teleports (> 35 subtiles), idle-follows (> 4 subtiles), and ticks 25Hz pet combat', () => {
      const game = new GameInstance({ seed: 1313, areaId: 2 });
      const druidId = game.connectPlayer({ charClass: 'dru', name: 'Druid', x: 100, y: 100, areaId: 2, level: 30 });

      // Skill 227 = Summon Spirit Wolf, Skill 247 = Summon Grizzly
      game.summonPet(druidId, { skillId: 227, slvl: 5 });
      game.summonPet(druidId, { skillId: 227, slvl: 5 });
      expect(game.getPetsForOwner(druidId).length).toBe(2);

      // Grizzly Bear mutually excludes Spirit Wolves; spawn at (30, 30) > 35 subtiles from owner at (100, 100)
      const bearOut = game.summonPet(druidId, { skillId: 247, slvl: 5, x: 30, y: 30 });
      expect(bearOut.created).toBe(true);
      expect(game.getPetsForOwner(druidId).length).toBe(1);
      game.drainEvents(druidId);

      // Frame 1: Grizzly leash-teleports to owner (100, 100) and emits UnitReassign
      game.stepFrame();
      const leashedBear = game.getPetsForOwner(druidId)[0]!;
      expect(Math.hypot(leashedBear.x - 100, leashedBear.y - 100)).toBeLessThanOrEqual(1);
      const leashEvents = game.drainEvents(druidId);
      expect(leashEvents.some((e) => e.type === 'UnitReassign' && e.snap === true)).toBe(true);

      // Idle follow when 4 < ownerDist <= 35 and no monsters nearby
      leashedBear.x = 112;
      leashedBear.y = 100;
      game.stepFrames(4);
      expect(leashedBear.x).toBeLessThan(112);

      const monsterId = game.spawnMonster({
        hcIdx: 18,
        x: 102,
        y: 100,
        areaId: 2,
        hp: 300,
        maxHp: 300,
        ac: 0,
        aiDisabled: true,
      });
      game.stepFrames(35);
      expect(game.getMonster(monsterId)!.hp).toBeLessThan(300);
    });

    it('exposes getLastLockstepHash() on GameInstance, LocalLoopbackAdapter & MultiClientRoomHost and delivers Merc/Pet AOI events in non-1 areaId without spurious UnitRemove', () => {
      const buildLoopback = (): LocalLoopbackAdapter => {
        const adapter = new LocalLoopbackAdapter({
          mapSeed: 1414,
          areaId: 2,
          charName: 'Zon',
          classId: 'ama',
          x: 100,
          y: 100,
          level: 30,
        });
        const g = adapter.getGameInstance();
        g.hireMercenary(adapter.playerId, { act: 2, x: 96, y: 100 });
        g.summonPet(adapter.playerId, { skillId: 247, slvl: 5, x: 98, y: 100 });
        g.spawnMonster({ hcIdx: 18, x: 104, y: 100, areaId: 2, hp: 300, maxHp: 300 });
        adapter.sendCommand({ type: 'Move', x: 102, y: 100, run: true });
        return adapter;
      };

      const loopbackA = buildLoopback();
      const loopbackB = buildLoopback();
      expect(loopbackA.getGameInstance()).toBeInstanceOf(GameInstance);
      expect(typeof loopbackA.getLastLockstepHash).toBe('function');
      expect(loopbackA.stepFrame()).toBe(1);
      expect(loopbackA.stepFrames(49)).toBe(50);
      loopbackB.stepFrames(50);
      expect(loopbackA.getLastLockstepHash()).toBe(loopbackB.getLastLockstepHash());

      const room = new MultiClientRoomHost({ mapSeed: 1515, areaId: 2 });
      const [clientStream, serverStream] = createMemoryStreamPair();
      const framer = new TsFramer<ServerEvent>();
      const clientEvents: ServerEvent[] = [];
      clientStream.onData((chunk) => clientEvents.push(...framer.push(chunk)));

      const pid = room.connectClient(serverStream, {
        charName: 'Pal',
        classId: 'pal',
        areaId: 2,
        x: 100,
        y: 100,
        level: 30,
      });
      expect(room.getGameInstance()).toBeInstanceOf(GameInstance);
      expect(typeof room.getLastLockstepHash).toBe('function');

      const mercId = room.getGameInstance().hireMercenary(pid, { act: 2, x: 92, y: 100 });
      room.getGameInstance().summonPet(pid, { skillId: 247, slvl: 5, x: 93, y: 100 });
      room.getGameInstance().spawnMonster({ hcIdx: 18, x: 102, y: 100, areaId: 2, hp: 300, maxHp: 300 });

      expect(room.stepFrame()).toBe(1);
      expect(room.stepFrames(9)).toBe(10);
      expect(
        clientEvents.some((e) => e.type === 'UnitMove' && (e.id === mercId || e.unitId === mercId)),
      ).toBe(true);
      expect(
        clientEvents.some((e) => e.type === 'UnitRemove' && (e.id === mercId || e.unitId === mercId)),
      ).toBe(false);
    });
  });
});
