/**
 * Diablo II v1.13c Spell VFX Parity — Mercenaries Work Unit B18 (#1222, #1223)
 *
 * Ground truth references:
 * - #1222 (B18-1, P1): `Skills.txt` `#126 Bash` & `#139 Stun` (`Hireling.txt` Act 5 Barbarian `classId=560/561`
 *   `Mode=5`, `srvdofunc=2`, empty `tgtoverlay`/`castoverlay`/`srvoverlay`). Target resolution must exclude the
 *   caster (`m.id !== caster.id`) and all friendly/allied units (`!isFriendlyOrNonHostileMonster(m)`), and never
 *   use `Math.min(distToTarget, distToCaster)` (which selected the mercenary caster itself at `d = 0`).
 * - #1223 (B18-2, P2): `MonStats.txt` `roguehire` (`hcIdx=271`, `Hireling.txt` `equiv1=bow`) has empty `MissA1`/`MissA2`;
 *   1.13c `SkillCltDoFunc[1]` (`0x6FB52230`, `D2MOO` `Skills.cpp:2252-2261`) + `D2Common.dll#10709` (`0x6FDA0D40`
 *   `ITEMS_GetMissileType`) spawns `'arrow'` (`Missiles.txt` #0) for bows (`bow`/`abow`) and `'bolt'` (`Missiles.txt` #31)
 *   for crossbows (`xbow`) on normal ranged attack (`skillId=0` and `roguehire` attack modes `4`/`5`).
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clearMissingArtEntries, getMissingArtEntries } from '../src/client/scene/missing-art.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientUnit } from '../src/client/world/client-unit.ts'
import {
  ClientWorld,
  findHostileMeleeTargetMonster113c,
  getMonsterModeMissile113c,
  resolveRangedAttackMissileKey113c,
} from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES } from '../src/common/skills/missiles-data.ts'

const EXCEL_DIR =
  join(homedir(), 'd2-data', 'excel')

function getActiveMissiles(world: ClientWorld): ClientUnit[] {
  return Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
}

describe('Diablo II v1.13c Mercenaries VFX Parity — Work Unit B18 (#1222, #1223)', () => {
  describe('#1222 (B18-1): Bash (#126) & Stun (#139) target search excludes caster & friendly units; A5 Barbarian Merc (560/561) never self-stuns', () => {
    it('matches 1.13c Hireling.txt & Skills.txt ground truth for Bash (#126) and Stun (#139)', () => {
      if (fs.existsSync(`${EXCEL_DIR}/Hireling.txt`)) {
        const lines = fs
          .readFileSync(`${EXCEL_DIR}/Hireling.txt`, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.length > 0)
        const hdr = lines[0]!.split('\t')
        const idxClass = hdr.indexOf('Class')
        const idxSkill1 = hdr.indexOf('Skill1')
        const idxMode1 = hdr.indexOf('Mode1')
        const barbRows = lines
          .slice(1)
          .map((l) => l.split('\t'))
          .filter((cols) => cols[idxClass] === '560' || cols[idxClass] === '561')
        expect(barbRows.length).toBeGreaterThan(0)
        for (const cols of barbRows) {
          expect(['Bash', 'Stun']).toContain(cols[idxSkill1])
          expect(cols[idxMode1]).toBe('5')
        }
      }

      if (fs.existsSync(`${EXCEL_DIR}/Skills.txt`)) {
        const lines = fs
          .readFileSync(`${EXCEL_DIR}/Skills.txt`, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.length > 0)
        const hdr = lines[0]!.split('\t')
        const idxId = hdr.indexOf('Id')
        const idxSrvDo = hdr.indexOf('srvdofunc')
        const idxTgtOv = hdr.indexOf('tgtoverlay')
        const idxCastOv = hdr.indexOf('castoverlay')
        const idxSrvOv = hdr.indexOf('srvoverlay')
        for (const targetId of ['126', '139']) {
          const row = lines
            .slice(1)
            .map((l) => l.split('\t'))
            .find((cols) => cols[idxId] === targetId)
          expect(row).toBeDefined()
          expect(row![idxSrvDo]).toBe('2')
          expect((row![idxTgtOv] ?? '').trim()).toBe('')
          expect((row![idxCastOv] ?? '').trim()).toBe('')
          expect((row![idxSrvOv] ?? '').trim()).toBe('')
        }
      }
    })

    it('A5 Barbarian mercenary (classId 560 & 561) casting Bash (#126) or Stun (#139) never applies state 21 or stun/bash overlay to himself or allies', () => {
      clearMissingArtEntries()
      for (const mercClassId of [560, 561] as const) {
        for (const skillId of [126, 139] as const) {
          const world = new ClientWorld()
          world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, name: 'BarbPlayer', x: 96, y: 100 })
          // A5 Barbarian mercenary at (100, 100)
          world.apply({
            type: 'UnitAssign',
            unit: {
              unitType: 1,
              id: 501,
              classId: mercClassId,
              x: 100,
              y: 100,
              lifePct: 128,
              mode: 1,
            },
          })
          // Allied pet / summon standing right next to mercenary at (101, 100)
          world.apply({
            type: 'UnitAssign',
            unit: {
              unitType: 1,
              id: 502,
              classId: 428, // Grizzly
              x: 101,
              y: 100,
              lifePct: 128,
              mode: 1,
              ownerType: 'player',
              ownerId: 1,
            } as any,
          })
          // Hostile monster at (102, 100)
          world.apply({
            type: 'UnitAssign',
            unit: {
              unitType: 1,
              id: 601,
              classId: 1, // Skeleton
              x: 102,
              y: 100,
              lifePct: 128,
              mode: 1,
            },
          })

          const merc = world.getUnit('monster', 501)!
          const ally = world.getUnit('monster', 502)!
          const hostile = world.getUnit('monster', 601)!

          // Mercenary casts #126 or #139 via SkillCast event
          world.apply({
            type: 'SkillCast',
            caster: { unitType: 1, id: 501 },
            skill: skillId,
            level: 5,
            target: { x: 102, y: 100 },
          })

          // Also invoke spawnMissilesForSkill directly
          ;(world as any).spawnMissilesForSkill(merc, skillId, 102, 100, 5)

          // Mercenary and ally must NOT have state 21 (stunned) or any 'stun'/'bash' overlays
          expect(merc.states.has(21), `merc ${mercClassId} state 21 on skill ${skillId}`).toBe(false)
          expect(merc.overlays, `merc ${mercClassId} overlays on skill ${skillId}`).toEqual([])
          expect(ally.states.has(21), `ally state 21 on skill ${skillId}`).toBe(false)
          expect(ally.overlays, `ally overlays on skill ${skillId}`).toEqual([])

          const mercDrawables = buildSceneDrawables([merc, ally])
          expect(mercDrawables.overlayDrawables).toHaveLength(0)

          // When server confirms Stun hit via StateSet (state 21 = stunned) on hostile monster,
          // hostile monster renders 'stun' overlay while mercenary remains clean
          if (skillId === 139) {
            world.apply({
              type: 'StateSet',
              unit: { unitType: 1, id: 601 },
              state: 21,
            })
            expect(hostile.states.has(21)).toBe(true)
            expect(merc.states.has(21)).toBe(false)
            const hostileDrawables = buildSceneDrawables([hostile])
            expect(hostileDrawables.overlayDrawables.map((d) => d.token)).toEqual(['stun'])
          }
        }
      }
      expect(getMissingArtEntries()).toEqual([])
    })

    it('melee target resolution (#139 Stun, #144 Concentrate, #137 Taunt, #14 Power Strike, #24 Charged Strike) excludes caster/allies and clears stale targetUnit on coordinate casts', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, name: 'Barb', x: 100, y: 100 })
      const player = world.getUnit('player', 1)!

      // Friendly mercenary at (101, 100) - closer to target (102, 100) than hostile monster at (103, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 510, classId: 560, x: 101, y: 100, lifePct: 128, mode: 1 },
      })
      // Friendly owned monster (hasOwner / ownerId) at (102, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 511, classId: 10, x: 102, y: 100, lifePct: 128, mode: 1 },
      })
      const ownedAlly = world.getUnit('monster', 511)!
      ownedAlly.ownerId = 1
      // Revived/converted monster (state 96) at (102, 101)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 512, classId: 15, x: 102, y: 101, lifePct: 128, mode: 1 },
      })
      const revivedAlly = world.getUnit('monster', 512)!
      revivedAlly.states.add(96)

      // Hostile monster at (103, 100)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 610, classId: 1, x: 103, y: 100, lifePct: 128, mode: 1 },
      })
      const merc = world.getUnit('monster', 510)!
      const hostile = world.getUnit('monster', 610)!

      // 1. findHostileMeleeTargetMonster113c skips merc, ownedAlly, revivedAlly and picks hostile
      const resolved = findHostileMeleeTargetMonster113c(world as any, player, 102, 100, 4)
      expect(resolved?.id).toBe(610)

      // 2. Player Stun (#139) at (102, 100) stuns hostile (610), never merc (510), ownedAlly (511), or revivedAlly (512)
      ;(world as any).spawnMissilesForSkill(player, 139, 102, 100, 5)
      expect(merc.states.has(21)).toBe(false)
      expect(ownedAlly.states.has(21)).toBe(false)
      expect(revivedAlly.states.has(21)).toBe(false)
      expect(hostile.states.has(21)).toBe(true)

      // 3. Player Concentrate (#144) attaches doubledamage1 only to hostile (610), never allies
      ;(world as any).spawnMissilesForSkill(player, 144, 102, 100, 5)
      expect(merc.overlays).toEqual([])
      expect(ownedAlly.overlays).toEqual([])
      expect(revivedAlly.overlays).toEqual([])
      expect(hostile.overlays.map((o) => o.token)).toEqual(['doubledamage1'])

      // 4. Swinging at empty coordinates (120, 100) far from hostile (103, 100) must NOT hit hostile via distToCaster
      hostile.states.remove(21)
      hostile.overlays = []
      ;(world as any).spawnMissilesForSkill(player, 139, 120, 100, 5)
      ;(world as any).spawnMissilesForSkill(player, 144, 120, 100, 5)
      expect(hostile.states.has(21)).toBe(false)
      expect(hostile.overlays).toEqual([])

      // 5. Coordinate SkillCast clears stale unit.targetUnit from a prior unit-targeted SkillCast
      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 139,
        level: 5,
        target: { unitType: 1, id: 610 },
      })
      expect(player.targetUnit).toEqual({ unitType: 1, id: 610 })

      world.apply({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 139,
        level: 5,
        target: { x: 120, y: 100 },
      })
      expect(player.targetUnit).toBeUndefined()
    })
  })

  describe('#1223 (B18-2): Act 1 Rogue Scout (roguehire hcIdx=271) & ranged weapon normal attack (#0) spawns arrow/bolt', () => {
    it('preserves MonStats.txt empty MissA1/MissA2 for roguehire (271) while resolving arrow/bolt via weapon missiletype', () => {
      // MonStats.txt has empty MissA1 and MissA2 for roguehire (hcIdx=271)
      expect(getMonsterModeMissile113c(271, 4)).toBeUndefined()
      expect(getMonsterModeMissile113c(271, 5)).toBeUndefined()
      expect(CANONICAL_113C_MISSILES.arrow?.id).toBe(0)
      expect(CANONICAL_113C_MISSILES.bolt?.id).toBe(31)

      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 271, classId: 271, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      const rogue = world.getUnit('monster', 271)!
      expect(resolveRangedAttackMissileKey113c(world as any, rogue, 4)).toBe('arrow')
      expect(resolveRangedAttackMissileKey113c(world as any, rogue, 5)).toBe('arrow')
    })

    it('spawns 1 arrow toward target when roguehire (classId=271) casts skillId=0 or enters attack modes 4 (A1) / 5 (A2)', () => {
      // 1. spawnMissilesForSkill(rogue, 0, targetX, targetY)
      const world1 = new ClientWorld()
      world1.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 301, classId: 271, x: 100, y: 100, lifePct: 128, mode: 4 },
      })
      const rogue1 = world1.getUnit('monster', 301)!
      ;(world1 as any).spawnMissilesForSkill(rogue1, 0, 118, 104, 1)
      const arrows1 = getActiveMissiles(world1).filter((m) => m.missileKey === 'arrow')
      expect(arrows1).toHaveLength(1)
      expect(arrows1[0]!.ownerType).toBe('monster')
      expect(arrows1[0]!.ownerId).toBe(301)
      expect(arrows1[0]!.targetX).toBe(118)
      expect(arrows1[0]!.targetY).toBe(104)
      expect(arrows1[0]!.vx).toBeGreaterThan(0)

      // 2. SkillCast event (skillId = 0) on roguehire
      const world2 = new ClientWorld()
      world2.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 302, classId: 271, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      world2.apply({
        type: 'SkillCast',
        caster: { unitType: 1, id: 302 },
        skill: 0,
        level: 1,
        target: { x: 120, y: 100 },
      })
      const arrows2 = getActiveMissiles(world2).filter((m) => m.missileKey === 'arrow')
      expect(arrows2).toHaveLength(1)
      expect(arrows2[0]!.targetX).toBe(120)
      expect(arrows2[0]!.targetY).toBe(100)

      // 3. UnitMode event (mode 4 A1 & mode 5 A2, both plain UnitMode and 0x6C NPCAttack cmd 0x0A/0x10)
      for (const atkMode of [4, 5] as const) {
        const world3 = new ClientWorld()
        world3.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 303, classId: 271, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        world3.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 701, classId: 1, x: 116, y: 106, lifePct: 128, mode: 1 },
        })
        world3.apply({
          type: 'UnitMode',
          unitType: 'monster',
          id: 303,
          mode: atkMode,
          npc: {
            opcode: 0x6c,
            cmd: atkMode === 4 ? 0x0a : 0x10,
            s: [1, 701, 0, 2, 0, 4, null],
            driftCheckAt: { x: 100, y: 100 },
          },
        } as any)
        const arrows3 = getActiveMissiles(world3).filter((m) => m.missileKey === 'arrow')
        expect(arrows3, `roguehire 0x6C UnitMode ${atkMode}`).toHaveLength(1)
        expect(arrows3[0]!.targetX).toBe(116)
        expect(arrows3[0]!.targetY).toBe(106)

        const worldPlain = new ClientWorld()
        worldPlain.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 304, classId: 271, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        worldPlain.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 702, classId: 1, x: 114, y: 102, lifePct: 128, mode: 1 },
        })
        worldPlain.apply({
          type: 'UnitMode',
          unitType: 'monster',
          id: 304,
          mode: atkMode,
          at: { x: 100, y: 100 },
        })
        const arrowsPlain = getActiveMissiles(worldPlain).filter((m) => m.missileKey === 'arrow')
        expect(arrowsPlain, `roguehire plain UnitMode ${atkMode}`).toHaveLength(1)
        expect(arrowsPlain[0]!.targetX).toBe(114)
        expect(arrowsPlain[0]!.targetY).toBe(102)
      }
    })

    it('spawns bolt when roguehire / mercenary has a crossbow in mercBySlot, and spawns 0 missiles for melee mercenaries (338/359/560/561)', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 304, classId: 271, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      ;(world as any)._merc = { mercId: 304, nameId: 1, classId: 271, level: 10, exp: 0 }
      ;(world as any)._containers.mercBySlot.set(4, { code: 'lxb' })
      const rogue = world.getUnit('monster', 304)!

      ;(world as any).spawnMissilesForSkill(rogue, 0, 120, 100, 1)
      const bolts = getActiveMissiles(world).filter((m) => m.missileKey === 'bolt')
      expect(bolts).toHaveLength(1)

      // Melee mercenaries (Act 2 Desert 338, Act 3 Iron Wolf 359, Act 5 Barbarian 560/561) spawn 0 missiles on normal attack (#0)
      for (const meleeMercClassId of [338, 359, 560, 561] as const) {
        const mWorld = new ClientWorld()
        mWorld.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 400, classId: meleeMercClassId, x: 100, y: 100, lifePct: 128, mode: 4 },
        })
        const merc = mWorld.getUnit('monster', 400)!
        ;(mWorld as any).spawnMissilesForSkill(merc, 0, 105, 100, 1)
        ;(mWorld as any).spawnMonsterModeMissile(merc, 4, 105, 100)
        expect(getActiveMissiles(mWorld), `melee merc ${meleeMercClassId}`).toHaveLength(0)
      }
    })

    it('player casting Normal Attack (#0) spawns arrow with bow, bolt with crossbow, and 0 missiles with melee weapon or unarmed', () => {
      // 1. Bow equipped ('lwb') -> 'arrow'
      const bowWorld = new ClientWorld()
      bowWorld.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      ;(bowWorld as any)._containers.equipmentBySlot.set(4, { code: 'lwb' })
      const bowPlayer = bowWorld.getUnit('player', 1)!
      ;(bowWorld as any).spawnMissilesForSkill(bowPlayer, 0, 120, 100, 1)
      const arrows = getActiveMissiles(bowWorld)
      expect(arrows).toHaveLength(1)
      expect(arrows[0]!.missileKey).toBe('arrow')
      expect(arrows[0]!.targetX).toBe(120)
      expect(arrows[0]!.targetY).toBe(100)

      // 2. Crossbow equipped ('hxb') -> 'bolt'
      const xbowWorld = new ClientWorld()
      xbowWorld.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      ;(xbowWorld as any)._containers.equipmentBySlot.set(4, { code: 'hxb' })
      const xbowPlayer = xbowWorld.getUnit('player', 1)!
      ;(xbowWorld as any).spawnMissilesForSkill(xbowPlayer, 0, 120, 105, 1)
      const bolts = getActiveMissiles(xbowWorld)
      expect(bolts).toHaveLength(1)
      expect(bolts[0]!.missileKey).toBe('bolt')
      expect(bolts[0]!.targetX).toBe(120)
      expect(bolts[0]!.targetY).toBe(105)

      // 3. Melee weapon ('bsd') or unarmed -> 0 missiles
      const meleeWorld = new ClientWorld()
      meleeWorld.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, name: 'Bar', x: 100, y: 100 })
      ;(meleeWorld as any)._containers.equipmentBySlot.set(4, { code: 'bsd' })
      const meleePlayer = meleeWorld.getUnit('player', 1)!
      ;(meleeWorld as any).spawnMissilesForSkill(meleePlayer, 0, 102, 100, 1)
      expect(getActiveMissiles(meleeWorld)).toHaveLength(0)
    })
  })
})
