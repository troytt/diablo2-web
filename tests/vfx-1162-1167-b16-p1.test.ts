/**
 * Diablo II v1.13c Spell VFX Parity — Monster Skills Work Unit B16-p1 (#1162..#1167)
 *
 * Ground truth references:
 * - #1162 (B16-1): `MonStats.txt` `MissA1/A2/S1-S4/C/SQ` monster mode projectiles (`D2Common_11050` at `0x6FDA54E0`).
 * - #1163 (B16-2): `Skills.txt` monster skills with `cltdofunc=0` and non-empty `cltmissile` (default client single-bolt missile).
 * - #1164 (B16-3): `CltDoFunc 23` (`0x6FB24AC0`) Charged Bolt family (`#186 PrimeBolt`, `#306 BoltSentry`, `#322 ImpBolt`).
 * - #1165 (B16-4): Monster-cast curses (`#66 Amplify Damage`, `#72 Weaken`, `#87 Decrepify`) must not curse hostile monster allies.
 * - #1166 (B16-5): `CltDo30` / `CltSt18` monster curses (`#212 MonCurseCast`, `#309 Defense Curse`, `#310 Blood Mana`) spawn `cursecast` + `cursecenter` (`curseeffectred`).
 * - #1167 (B16-6): Monster-cast `#97 Smite`, `#107 Charge`, `#132 Leap`, `#143 Leap Attack` must not apply overlays/states/knockback to monster allies.
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ClientWorld,
  CURSE_CLT_MISSILE_A,
  CURSE_SKILL_STATES,
  CURSE_TARGET_OVERLAYS,
  LINEAR_SKILL_MISSILES,
  MONSTER_MODE_MISSILES_113C,
  SKILL_DEFAULT_CLT_MISSILE_113C,
  getMonsterModeMissile113c,
  getMonsterModeMissileById113c,
} from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'

const EXCEL_DIR =
  join(homedir(), 'd2-data', 'excel')

describe('Diablo II v1.13c Monster Skills VFX Parity — Work Unit B16-p1 (#1162..#1167)', () => {
  describe('#1162 (B16-1): MonStats.txt MissA1/A2/S1-S4/C/SQ monster mode projectiles', () => {
    it('matches all enabled 1.13c MonStats.txt rows across all 8 mode missile columns and resolves valid Missiles.txt rows', () => {
      if (fs.existsSync(`${EXCEL_DIR}/MonStats.txt`)) {
        const lines = fs
          .readFileSync(`${EXCEL_DIR}/MonStats.txt`, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.length > 0)
        const hdr = lines[0]!.split('\t')
        const idxHcIdx = hdr.indexOf('hcIdx') >= 0 ? hdr.indexOf('hcIdx') : hdr.indexOf('*hcIdx')
        const idxId = hdr.indexOf('Id')
        const idxEnabled = hdr.indexOf('enabled')
        const modeCols: ReadonlyArray<readonly [string, number]> = [
          ['MissA1', 4],
          ['MissA2', 5],
          ['MissC', 7],
          ['MissS1', 8],
          ['MissS2', 9],
          ['MissS3', 10],
          ['MissS4', 11],
          ['MissSQ', 14],
        ]

        let enabledWithMissilesCount = 0
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i]!.split('\t')
          const hcIdx = Number(cols[idxHcIdx])
          const id = (cols[idxId] ?? '').trim().toLowerCase()
          const enabled = (cols[idxEnabled] ?? '').trim() === '1'
          if (!Number.isInteger(hcIdx) || !id) continue
          if (!enabled) {
            expect(MONSTER_MODE_MISSILES_113C[hcIdx]).toBeUndefined()
            continue
          }
          let anyCol = false
          for (const [colName, mode] of modeCols) {
            const colIdx = hdr.indexOf(colName)
            const expected = (cols[colIdx] ?? '').trim().toLowerCase() || undefined
            if (expected) anyCol = true
            expect(
              getMonsterModeMissile113c(hcIdx, mode),
              `MonStats hcIdx=${hcIdx} (${id}) ${colName} (mode ${mode})`,
            ).toBe(expected)
            expect(
              getMonsterModeMissileById113c(id, mode),
              `MonStats id=${id} ${colName} (mode ${mode})`,
            ).toBe(expected)
            if (expected) {
              const missileData = getMissileTxtData(expected)
              expect(missileData, `Missiles.txt row for '${expected}'`).toBeDefined()
              expect((missileData as any)?.clientAlias).not.toBe(true)
            }
          }
          if (anyCol) enabledWithMissilesCount++
        }
        expect(enabledWithMissilesCount).toBe(155)
      }

      // Spot-check key monster classes across all modes
      expect(getMonsterModeMissileById113c('quillrat1', 5)).toBe('spike1')
      expect(getMonsterModeMissileById113c('bighead1', 5)).toBe('bighead1')
      expect(getMonsterModeMissileById113c('sandmaggot1', 5)).toBe('goospit1')
      expect(getMonsterModeMissileById113c('unraveler1', 5)).toBe('mummy1')
      expect(getMonsterModeMissileById113c('fetishblow1', 4)).toBe('blowgun')
      expect(getMonsterModeMissileById113c('cr_archer1', 4)).toBe('cr_arrow1')
      expect(getMonsterModeMissileById113c('catapult1', 4)).toBe('catapultchargedball on')

      for (const entry of Object.values(MONSTER_MODE_MISSILES_113C)) {
        for (const key of Object.values(entry)) {
          if (typeof key === 'string') {
            expect(CANONICAL_113C_MISSILES[key], `canonical missile '${key}'`).toBeDefined()
          }
        }
      }
    })

    it('spawns spike1 for quillrat1 (A2), bighead1 for bighead1 (A2), goospit1 for sandmaggot1 (A2), and blowgun for fetishblow1 (A1) on monster mode attack', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 120, y: 100 })

      // 1. quillrat1 (hcIdx=63) enters A2 (mode 5) -> spawns 'spike1'
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 63, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitMode',
        unitType: 'monster',
        id: 101,
        mode: 5,
        at: { x: 100, y: 100 },
      })
      const spikeMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.ownerId === 101 && u.missileKey === 'spike1',
      )
      expect(spikeMissiles.length).toBe(1)

      // 2. bighead1 (hcIdx=10) enters A2 (mode 5) -> spawns 'bighead1'
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 102, classId: 10, x: 100, y: 105, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitMode',
        unitType: 'monster',
        id: 102,
        mode: 5,
        at: { x: 100, y: 105 },
      })
      const bigheadMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.ownerId === 102 && u.missileKey === 'bighead1',
      )
      expect(bigheadMissiles.length).toBe(1)

      // 3. sandmaggot1 (hcIdx=68) enters A2 (mode 5) -> spawns 'goospit1'
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 103, classId: 68, x: 100, y: 110, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitMode',
        unitType: 'monster',
        id: 103,
        mode: 5,
        at: { x: 100, y: 110 },
      })
      const goospitMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.ownerId === 103 && u.missileKey === 'goospit1',
      )
      expect(goospitMissiles.length).toBe(1)

      // 4. fetishblow1 (hcIdx=396) enters A1 (mode 4) -> spawns 'blowgun'
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 104, classId: 396, x: 100, y: 115, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitMode',
        unitType: 'monster',
        id: 104,
        mode: 4,
        at: { x: 100, y: 115 },
      })
      const blowgunMissiles = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.ownerId === 104 && u.missileKey === 'blowgun',
      )
      expect(blowgunMissiles.length).toBe(1)
    })
  })

  describe('#1163 (B16-2): Monster skills with cltdofunc=0 and non-empty cltmissile spawn their exact Skills.txt cltmissile', () => {
    const MONSTER_DEFAULT_CLT_MISSILES: ReadonlyArray<readonly [number, string]> = [
      [157, 'unholybolt1'], // UnHolyBolt
      [160, 'shafire1'], // ShamanFire
      [169, 'vampirefireball'], // VampireFireball
      [185, 'monsterlight'], // PrimeLightning
      [187, 'blaze'], // PrimeBlaze
      [189, 'monglacialspike'], // PrimeSpike
      [200, 'trap poison ball left'], // PoisonBallTrap
      [201, 'andypoisonbolt'], // AndyPoisonBolt
      [207, 'trap cursed skull right'], // CursedBallTrapRight
      [208, 'trap cursed skull left'], // CursedBallTrapLeft
      [286, 'baal spawn monsters'], // Baal Monster Spawn
      [291, 'healing vortex'], // Healing Vortex
      [299, 'impmiss21'], // Imp Fire Missile
      [313, 'sentrylightningbolt'], // sentry lightning
      [324, 'sentrylightningbolt2'], // death sentry ltng
      [332, 'monsterlight'], // ZakarumLightning
      [333, 'firehead'], // VampireMissile
      [334, 'mephisto'], // MephistoMissile
      [337, 'hydra'], // HydraMissile
      [339, 'cr_arrow6'], // MonBow
      [340, 'firearrow'], // MonFireArrow
      [341, 'coldarrow'], // MonColdArrow
      [342, 'explodingarrow'], // MonExplodingArrow
      [343, 'freezingarrow'], // MonFreezingArrow
      [345, 'succubusmiss'], // SuccubusBolt
      [348, 'glacialspike'], // ShamanIce
      [354, 'unholybolt1'], // UnHolyBoltEx
      [355, 'shafire1'], // ShamanFireEx
      [356, 'impmiss21'], // Imp Fire Missile Ex
    ]

    it('spawns 1 missile with key === Skills.txt cltmissile for every cltdofunc=0 monster skill and preserves player linear skills (#36, #47)', () => {
      if (fs.existsSync(`${EXCEL_DIR}/Skills.txt`)) {
        const lines = fs
          .readFileSync(`${EXCEL_DIR}/Skills.txt`, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.length > 0)
        const hdr = lines[0]!.split('\t')
        const idxId = hdr.indexOf('Id')
        const idxCltDo = hdr.indexOf('cltdofunc')
        const idxCltMiss = hdr.indexOf('cltmissile')
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i]!.split('\t')
          const skillId = Number(cols[idxId])
          const cltDo = (cols[idxCltDo] ?? '').trim()
          const cltMiss = (cols[idxCltMiss] ?? '').trim().toLowerCase()
          if (Number.isInteger(skillId) && (!cltDo || cltDo === '0') && cltMiss) {
            expect(SKILL_DEFAULT_CLT_MISSILE_113C[skillId], `skill #${skillId} default cltmissile`).toBe(
              cltMiss,
            )
            if (skillId !== 46 && skillId !== 229 && skillId !== 251) {
              expect(LINEAR_SKILL_MISSILES[skillId]?.key, `skill #${skillId} LINEAR_SKILL_MISSILES`).toBe(
                cltMiss,
              )
            }
          }
        }
      }

      for (const [skillId, expectedKey] of MONSTER_DEFAULT_CLT_MISSILES) {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 200, classId: 242, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        const mon = world.getUnit('monster', 200)!
        ;(world as any).spawnMissilesForSkill(mon, skillId, 115, 100, 5)
        const spawned = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 200,
        )
        expect(spawned.length, `skill #${skillId} missile count`).toBe(1)
        expect(spawned[0]!.missileKey, `skill #${skillId} missileKey`).toBe(expectedKey)
      }

      // Player linear skills (#36 Fire Bolt, #47 Fire Ball) remain intact
      for (const [skillId, expectedKey] of [
        [36, 'firebolt'],
        [47, 'fireball'],
      ] as const) {
        const world = new ClientWorld()
        world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
        const player = world.getUnit('player', 1)!
        ;(world as any).spawnMissilesForSkill(player, skillId, 115, 100, 5)
        const spawned = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 1,
        )
        expect(spawned.length).toBe(1)
        expect(spawned[0]!.missileKey).toBe(expectedKey)
      }
    })
  })

  describe('#1164 (B16-3): CltDoFunc 23 Charged Bolt family (#186 PrimeBolt, #306 BoltSentry, #322 ImpBolt)', () => {
    it('spawns lvl+2 chargedbolt for #186 PrimeBolt, 5+floor(SF/3) sentrychargedbolt for #306 BoltSentry, and lvl+2 imp charged bolt for #322 ImpBolt', () => {
      // 1. #186 PrimeBolt (lvl 5 -> 7 chargedbolt)
      {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 301, classId: 242, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        const meph = world.getUnit('monster', 301)!
        ;(world as any).spawnMissilesForSkill(meph, 186, 120, 100, 5)
        const bolts = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 301,
        )
        expect(bolts.length).toBe(7)
        for (const b of bolts) {
          expect(b.missileKey).toBe('chargedbolt')
          expect(b.x).toBe(100)
          expect(b.y).toBe(100)
          expect(b.pathWaypoints?.length).toBeGreaterThan(0)
        }
      }

      // 2. #306 BoltSentry (Shock Field #256 blvl 6 -> 5 + floor(6/3) = 7 sentrychargedbolt)
      {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 302, classId: 411, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        const sentry = world.getUnit('monster', 302)!
        sentry.stats.set(256, 6)
        ;(world as any).spawnMissilesForSkill(sentry, 306, 120, 100, 5)
        const bolts = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 302,
        )
        expect(bolts.length).toBe(7)
        for (const b of bolts) {
          expect(b.missileKey).toBe('sentrychargedbolt')
          expect(b.x).toBe(100)
          expect(b.y).toBe(100)
          expect(b.pathWaypoints?.length).toBeGreaterThan(0)
        }
      }

      // 3. #322 ImpBolt (lvl 5 -> 7 'imp charged bolt')
      {
        const world = new ClientWorld()
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 303, classId: 441, x: 100, y: 100, lifePct: 128, mode: 1 },
        })
        const imp = world.getUnit('monster', 303)!
        ;(world as any).spawnMissilesForSkill(imp, 322, 120, 100, 5)
        const bolts = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 303,
        )
        expect(bolts.length).toBe(7)
        for (const b of bolts) {
          expect(b.missileKey).toBe('imp charged bolt')
          expect(b.x).toBe(100)
          expect(b.y).toBe(100)
          expect(b.pathWaypoints?.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('#1165 (B16-4): Monster-cast curses (#66 Amplify Damage, #72 Weaken, #87 Decrepify) do not curse monster allies', () => {
    it('does not add curse states or overlays to nearby hostile monsters when a monster casts #66, #72, or #87, while preserving player curse prediction', () => {
      for (const skillId of [66, 72, 87] as const) {
        const world = new ClientWorld()
        world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 100, y: 100 })
        // Monster caster: succubuswitch1 (hcIdx=471)
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 401, classId: 471, x: 115, y: 100, lifePct: 128, mode: 1 },
        })
        // Monster ally standing next to player at (101, 100)
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 402, classId: 0, x: 101, y: 100, lifePct: 128, mode: 1 },
        })

        const witch = world.getUnit('monster', 401)!
        const allySkel = world.getUnit('monster', 402)!
        const stateId = CURSE_SKILL_STATES[skillId]!
        const overlayToken = CURSE_TARGET_OVERLAYS[skillId]!

        ;(world as any).applySkillCastToUnit(witch, skillId, 100, 100, 5)
        ;(world as any).spawnMissilesForSkill(witch, skillId, 100, 100, 5)

        // Nearby monster ally must NOT receive the curse state or overlay
        expect(allySkel.states.has(stateId), `monster ally state ${stateId} for skill #${skillId}`).toBe(
          false,
        )
        expect(allySkel.overlays.length, `monster ally overlays for skill #${skillId}`).toBe(0)

        // Player receives curse overlay via authoritative StateSet
        world.apply({
          type: 'StateSet',
          unit: { unitType: 0, id: 1 },
          state: stateId,
        })
        const selfUnit = world.getUnit('player', 1)!
        expect(selfUnit.states.has(stateId)).toBe(true)

        // Player casting #66 still predicts state & overlay on hostile monsters
        const playerWorld = new ClientWorld()
        playerWorld.apply({ type: 'PlayerAssign', unitId: 1, charClass: 2, name: 'Nec', x: 90, y: 100 })
        playerWorld.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 403, classId: 0, x: 101, y: 100, lifePct: 128, mode: 1 },
        })
        const player = playerWorld.getUnit('player', 1)!
        const enemySkel = playerWorld.getUnit('monster', 403)!
        ;(playerWorld as any).spawnMissilesForSkill(player, skillId, 100, 100, 5)
        expect(enemySkel.states.has(stateId)).toBe(true)
        expect(enemySkel.overlays.some((o) => o.token === overlayToken)).toBe(true)
      }
    })
  })

  describe('#1166 (B16-5): CltDo30 / CltSt18 monster curses (#212 MonCurseCast, #309 Defense Curse, #310 Blood Mana)', () => {
    it('spawns cursecast at caster and cursecenter with curseSubMissileKey="curseeffectred" at target for #212, #309, #310', () => {
      for (const skillId of [212, 309, 310] as const) {
        expect(CURSE_CLT_MISSILE_A[skillId]).toBe('curseeffectred')

        const world = new ClientWorld()
        world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Sor', x: 100, y: 100 })
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 501, classId: 471, x: 115, y: 105, lifePct: 128, mode: 1 },
        })
        const caster = world.getUnit('monster', 501)!

        ;(world as any).applySkillCastToUnit(caster, skillId, 100, 100, 5)
        ;(world as any).spawnMissilesForSkill(caster, skillId, 100, 100, 5)

        const missiles = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.ownerId === 501,
        )
        const curseCast = missiles.find((m) => m.missileKey === 'cursecast')
        const curseCenter = missiles.find((m) => m.missileKey === 'cursecenter')

        expect(curseCast, `skill #${skillId} cursecast`).toBeDefined()
        expect(curseCast!.x).toBe(115)
        expect(curseCast!.y).toBe(105)

        expect(curseCenter, `skill #${skillId} cursecenter`).toBeDefined()
        expect(curseCenter!.x).toBe(100)
        expect(curseCenter!.y).toBe(100)
        expect(curseCenter!.curseSubMissileKey).toBe('curseeffectred')

        // Stepping 1 tick scatters curseeffectred particles from cursecenter
        ;(world as any).stepDiscreteSimulationTick(40)
        const redParticles = Array.from(world.units.values()).filter(
          (u) => u.unitType === 'missile' && u.missileKey === 'curseeffectred',
        )
        expect(redParticles.length, `skill #${skillId} curseeffectred particles`).toBeGreaterThan(0)
      }
    })
  })

  describe('#1167 (B16-6): Monster-cast #97 Smite, #107 Charge, #132 Leap, #143 Leap Attack leave monster allies untouched', () => {
    it('keeps other monsters states, overlays, x, and y unchanged when a monster casts #97, #107, #132, or #143', () => {
      for (const skillId of [97, 107, 132, 143] as const) {
        const world = new ClientWorld()
        world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 4, name: 'Bar', x: 100, y: 100 })
        // Monster caster at (110, 100)
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 601, classId: 541, x: 110, y: 100, lifePct: 128, mode: 1 },
        })
        // Monster ally at (101, 100) near target (100, 100)
        world.apply({
          type: 'UnitAssign',
          unit: { unitType: 1, id: 602, classId: 0, x: 101, y: 100, lifePct: 128, mode: 1 },
        })

        const caster = world.getUnit('monster', 601)!
        const ally = world.getUnit('monster', 602)!

        ;(world as any).applySkillCastToUnit(caster, skillId, 100, 100, 5)
        ;(world as any).spawnMissilesForSkill(caster, skillId, 100, 100, 5)

        expect(Array.from(ally.states.values()), `skill #${skillId} ally states`).toEqual([])
        expect(ally.overlays, `skill #${skillId} ally overlays`).toEqual([])
        expect(ally.x, `skill #${skillId} ally x`).toBe(101)
        expect(ally.y, `skill #${skillId} ally y`).toBe(100)
        expect(caster.overlays, `skill #${skillId} monster caster overlays`).toEqual([])
      }
    })
  })
})
