import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
  type MissileTxtData,
  type Projectile,
} from '../src/common/skills/missiles-data.ts'
import { isNullCelFile } from '../src/client/render/cel-file-key.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { LINEAR_SKILL_MISSILES } from '../src/client/world/world-skill-state-tables.ts'
import { tickProjectiles } from '../src/server/skills/skills.ts'

describe('B7-p1: De-aliasing & Missiles.txt Row Alignment (#1087..#1092)', () => {
  describe('#1087 (B7-1): MISSILE_METAS real Missiles.txt rows match exact 1.13c CelFile', () => {
    const previouslyMismappedRows: readonly [string, string][] = [
      ['armageddonfire', 'groundFireSmall'],
      ['blood2', 'BloodSmall02'],
      ['corpsepoisoncloud', 'PoisonSparks'],
      ['firestorm', 'groundFireSmall'],
      ['fistsoffireexplode', 'ExpArrowExplode'],
      ['fistsoffirefirewall', 'groundFireSmall'],
      ['handofgod', 'LightningBolt'],
      ['healing vortex', 'expansion/overseer_missile'],
      ['mephistoexplosionbig', 'FireArrowExplode2'],
      ['mephistofirewall', 'groundFireSmall'],
      ['mephistoflyingrockssmall', 'ExplosionSparkSmall'],
      ['moltenboulder-flyingrocks', 'expansion/MoltenFragmentD'],
      ['moltenboulderfirepath', 'groundFireSmall'],
      ['queenpoisoncloud', 'poisonNova'],
      ['royalstrikemeteorfire', 'groundFireSmall'],
      ['taintedsunball', 'yellowBallGlow2'],
      ['taintedsunflash', 'yellowBallGlowIntro'],
      ['towermistfade', 'Mist_fade'],
      ['towermisttrail', 'mist'],
      ['volcano debris 2', 'expansion/volcano_rock'],
      ['volcano small fire', 'Expansion/rock_lava_pool'],
      ['andyfirewall', 'groundFireSmall'],
    ]

    it.each(previouslyMismappedRows)(
      'row %s in MISSILE_METAS resolves to 1.13c CelFile %s',
      (rowName, expectedCelFile) => {
        const meta = MISSILE_METAS[rowName] ?? MISSILE_METAS[rowName.toLowerCase()]
        expect(meta, `MISSILE_METAS[${rowName}] should exist`).toBeDefined()
        expect(meta!.celFile.replace(/\\/g, '/').toLowerCase()).toBe(
          expectedCelFile.replace(/\\/g, '/').toLowerCase(),
        )
        const row = CANONICAL_113C_MISSILES[rowName.toLowerCase()]
        expect(row, `CANONICAL_113C_MISSILES[${rowName}] should exist`).toBeDefined()
        expect(row!.celFile?.replace(/\\/g, '/').toLowerCase()).toBe(
          expectedCelFile.replace(/\\/g, '/').toLowerCase(),
        )
      },
    )

    it('resolves CelFile stem firespikes to expansion/FireSpikes while firestorm row uses groundFireSmall', () => {
      expect(MISSILE_METAS['catapult spike in air']?.celFile.toLowerCase()).toBe('expansion/firespikes')
      expect(MISSILE_METAS['catapult spike on ground']?.celFile.toLowerCase()).toBe('expansion/firespikesground')
      expect(MISSILE_METAS['firestorm']?.celFile.toLowerCase()).toBe('groundfiresmall')
    })

    it('every Missiles.txt row key in MISSILE_METAS has non-null CelFile matching CANONICAL_113C_MISSILES', () => {
      for (const [key, meta] of Object.entries(MISSILE_METAS)) {
        const row = CANONICAL_113C_MISSILES[key.toLowerCase()]
        if (!row) continue
        expect(isNullCelFile(row.celFile), `Null-CelFile row '${key}' must not be in MISSILE_METAS`).toBe(false)
        expect(meta.celFile.replace(/\\/g, '/').toLowerCase()).toBe(
          row.celFile!.replace(/\\/g, '/').toLowerCase(),
        )
      }
    })
  })

  describe('#1088 (B7-2): 27 CelFile=null controller missiles are removed from MISSILE_METAS', () => {
    // firewallmaker / andyfirewallmaker / mephistofirewallmaker are NOT listed: 1.13c Missiles.txt gives them real
    // CelFiles (groundFireBig / groundFireSmall) and they are baked as the FireWall family (B16-p2).
    const nullCelFileControllers = [
      'ancient death center',
      'andycontrol0',
      'andyfallingdebris',
      'andyspurt',
      ['baal', 'clone', 'death'].join(' '),
      'baalcontrol',
      'baalfx control',
      'baalfx spirit 3',
      'baalfx spirit 4',
      'baalfx spirit 5',
      'baalspawn',
      'blizzardcenter',
      'brdeathlightningbolt',
      'diablolight',
      'durieldeathcontrol',
      'eruption crack 2',
      'eruption smoke 2',
      'erruption crack 2',
      'erruption smoke 2',
      ['firetower', 'death'].join(' '),
      'fistoftheheavensdelay',
      'freezingarrowexp3',
      'grimwardscare',
      'hurricanemaker',
      'hydracenter',
      'izual control',
      'izual lightning trail',
      'izual mist fade',
      'izualice',
      'izualmist',
      'izualsparks',
      'lightningbolt',
      'moltenboulderexplode',
      'nehlithakcontrol',
      'nehlithakglow',
      'orbmist',
      'overseercontrol',
      'plaguevinemaker',
      'radamentdeath',
      'shenkdeath1',
      'solarscreechermaker',
      'towermist',
      'vines',
      'wakeofdestructionmaker',
    ]

    it.each(nullCelFileControllers)('does not register CelFile=null missile %s in MISSILE_METAS', name => {
      expect(MISSILE_METAS[name]).toBeUndefined()
      expect(MISSILE_METAS[name.toLowerCase()]).toBeUndefined()
    })
  })

  describe('#1089 (B7-3): CANONICAL_113C_MISSILES contains only real 1.13c Missiles.txt rows (0 clientAlias rows)', () => {
    const deletedAliases = [
      'avoid',
      'bash',
      'berserk',
      'blade_shield_attachment',
      'bladefury',
      'bladefuryb',
      'bladefuryc',
      'bladeshieldmissile',
      'bladesofice',
      'boneprison',
      'bonewall',
      'charge',
      'chargeboltsentry',
      'chargedboltsentry',
      'chargedstrike',
      'clawsofthunder',
      'claygolem',
      'cobrastrike',
      'concentrate',
      'conversion',
      'deathsentry',
      'decrepify',
      'dimvision',
      'dodge',
      'doubleswing',
      'doublethrow',
      'dragonclaw',
      'dragontail',
      'evade',
      'fend',
      'finditem',
      'findpotion',
      'firegolem',
      'firetrauma',
      'firetraumaexplode',
      'firetraumaground',
      'fist_of_the_heavens',
      'fistoftheheavens',
      'fistsoffire',
      'frenzy',
      'glacialspikeejecta',
      'grimward',
      'holyshield',
      'hurricane',
      'hydra_turret',
      'impale',
      'inferno',
      'ironmaiden',
      'irongolem',
      'leap',
      'leapattack',
      'lifetap',
      'lightning',
      'lightningsentry',
      'lowerresist',
      'penetrate',
      'phoenixstrike',
      'plaguevines',
      'poisonexplosion',
      'psychichammer',
      'rocklavaexplosion',
      'rocklavapool',
      'sacrifice',
      'shockfieldair',
      'shockfieldground',
      'shockweb',
      'skeleton',
      'skeletonmage',
      'smite',
      'solarscreecher',
      'staticfield',
      'stun',
      'terror',
      'thunderstorm',
      'tigerstrike',
      'vinesdeath',
      'volcanobase',
      'volcanofire',
      'volcanorock',
      'wakeofinferno',
      'weaken',
      'whirlwind',
      'zeal',
    ]

    it('has exactly 684 rows and zero clientAlias flags', () => {
      const entries = Object.entries(CANONICAL_113C_MISSILES)
      expect(entries.length).toBe(684)
      for (const [key, row] of entries) {
        expect(key).toBe(row.name.toLowerCase())
        expect('clientAlias' in (row as unknown as Record<string, unknown>)).toBe(false)
      }
      const checkType: keyof MissileTxtData = 'subStart'
      expect(checkType).toBe('subStart')
    })

    it.each(deletedAliases)('does not contain fabricated alias %s in CANONICAL_113C_MISSILES', alias => {
      expect(CANONICAL_113C_MISSILES[alias]).toBeUndefined()
    })

    it('each Missiles.txt numeric ID resolves uniquely to its authoritative row', () => {
      const byId = new Map<number, string[]>()
      for (const row of Object.values(CANONICAL_113C_MISSILES)) {
        const list = byId.get(row.id) ?? []
        list.push(row.name)
        byId.set(row.id, list)
      }
      expect(byId.size).toBe(684)
      for (const [id, names] of byId) {
        expect(names, `ID ${id} has duplicate rows: ${names.join(', ')}`).toHaveLength(1)
      }
      expect(byId.get(getMissileTxtData('freezingarrowexp1').id)).toEqual(['freezingarrowexp1'])
      expect(byId.get(getMissileTxtData('freezingarrowexp2').id)).toEqual(['freezingarrowexp2'])
      expect(byId.get(69)).toEqual(['firewall'])
      expect(byId.get(98)).toEqual(['lightningbolt'])
    })
  })

  describe('#1090 (B7-4): Cold hit explosions keep real freezingarrowexp1 / freezingarrowexp2 names', () => {
    it('server tickProjectiles spawns freezingarrowexp1 and freezingarrowexp2 on Glacial Spike (#55) and Freezing Arrow (#31) hit without alias rewrite', () => {
      const target = { index: 1, x: 100, y: 100, radius: 20, alive: true }
      const openTerrain = { overlap: () => 0 }

      const gsProj: Projectile = {
        skillId: '55',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 10,
        ttl: 10,
        missileType: 'glacialspike',
        fromPlayer: true,
      }
      const res55 = tickProjectiles([gsProj], [target], openTerrain)
      expect(res55.alive.some(s => s.missileType === 'freezingarrowexp1')).toBe(true)
      expect(res55.alive.some(s => s.missileType === 'freezingarrowexp2')).toBe(true)
      expect(res55.alive.some(s => s.missileType === 'freezeexplode')).toBe(false)
      expect(res55.alive.some(s => s.missileType === 'glacialspikeejecta')).toBe(false)

      const faProj: Projectile = {
        skillId: '31',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        damage: 10,
        ttl: 10,
        missileType: 'freezingarrow',
        fromPlayer: true,
      }
      const res31 = tickProjectiles([faProj], [target], openTerrain)
      expect(res31.alive.some(s => s.missileType === 'freezingarrowexp1')).toBe(true)
      expect(res31.alive.some(s => s.missileType === 'freezingarrowexp2')).toBe(true)
      expect(res31.alive.some(s => s.missileType === 'freezeexplode')).toBe(false)
      expect(res31.alive.some(s => s.missileType === 'glacialspikeejecta')).toBe(false)
    })

    it('client triggerMissileImpact spawns freezingarrowexp1 / freezingarrowexp2 without rewriting to aliases', () => {
      const world = new ClientWorld()
      const ib = (world as any).spawnMissileByKey('iceblast', 100, 100, 110, 100, {
        sourceSkillId: 45,
        skillLevel: 1,
      })
      expect(ib.explosionMissile).toBe('freezingarrowexp1')
      ;(world as any).triggerMissileImpact(ib, 105, 100, true)

      const gs = (world as any).spawnMissileByKey('glacialspike', 200, 200, 210, 200, {
        sourceSkillId: 55,
        skillLevel: 1,
      })
      expect(gs.explosionMissile).toBe('')
      ;(world as any).triggerMissileImpact(gs, 205, 200, true)

      const spawnedKeys = Array.from(world.units.values())
        .filter(u => u.unitType === 'missile')
        .map(u => u.missileKey)
      expect(spawnedKeys).toContain('freezingarrowexp1')
      expect(spawnedKeys).toContain('freezingarrowexp2')
      expect(spawnedKeys).not.toContain('freezeexplode')
      expect(spawnedKeys).not.toContain('glacialspikeejecta')
    })
  })

  describe('#1091 (B7-5): Sorceress Lightning (#49) uses real lightningbolt row (CelFile=null, Range=25, invisible head)', () => {
    it('maps Skill #49 to lightningbolt with Range=25 and CelFile=null', () => {
      expect(LINEAR_SKILL_MISSILES[49]).toEqual({ key: 'lightningbolt', pierce: true })
      const row = getMissileTxtData('lightningbolt')
      expect(row).toBeDefined()
      expect(row.id).toBe(98)
      expect(isNullCelFile(row.celFile)).toBe(true)
      expect(row.range).toBe(25)

      const world = new ClientWorld()
      const unit = (world as any).spawnMissileByKey('lightningbolt', 100, 100, 110, 100, {
        sourceSkillId: 49,
        skillLevel: 1,
      })
      expect(unit.maxTicks).toBe(25)
    })

    it('buildSceneDrawables does not emit a sprite drawable for lightningbolt (CelFile=null)', () => {
      const scene = buildSceneDrawables(
        [
          {
            kind: 'missile',
            id: 1,
            classId: 98,
            missileKey: 'lightningbolt',
            x: 100,
            y: 100,
            frame: 0,
          },
        ],
        0,
      )
      expect(scene.missileDrawables).toHaveLength(0)
      expect(scene.lightEmitters.length).toBeGreaterThan(0)
    })
  })

  describe('#1092 (B7-6): CANONICAL_113C_MISSILES populates SubStart for all 59 SubLoop=1 rows and loops from subStart', () => {
    it('matches Missiles.txt SubStart for all 59 SubLoop=1 rows', () => {
      const missilesTxtPath =
        join(homedir(), 'd2-data', 'excel', 'Missiles.txt')
      const lines = readFileSync(resolve(missilesTxtPath), 'utf-8').split(/\r?\n/)
      const headers = lines[0]!.split('\t')
      const nameIdx = headers.indexOf('Missile')
      const subLoopIdx = headers.indexOf('SubLoop')
      const subStartIdx = headers.indexOf('SubStart')
      const subStopIdx = headers.indexOf('SubStop')

      let subLoopCount = 0
      let subStartNonZeroCount = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split('\t')
        const name = (cols[nameIdx] ?? '').trim()
        if (!name || name.toLowerCase() === 'expansion') continue
        const subLoop = Number(cols[subLoopIdx] || 0)
        if (subLoop === 1) {
          subLoopCount += 1
          const expectedSubStart = Number(cols[subStartIdx] || 0)
          const expectedSubStop = Number(cols[subStopIdx] || 0)
          if (expectedSubStart > 0) subStartNonZeroCount += 1
          const row = getMissileTxtData(name)
          expect(row, `Missing row ${name}`).toBeDefined()
          expect(Boolean(row.subLoop)).toBe(true)
          expect(row.subStart ?? 0).toBe(expectedSubStart)
          expect(row.subStop).toBe(expectedSubStop)
        }
      }
      expect(subLoopCount).toBe(85)
      expect(subStartNonZeroCount).toBe(71)
    })

    it('ClientWorld steps poisonexplosioncloud (#217) looping between SubStart=10 and SubStop=19 instead of resetting to 0', () => {
      const row = getMissileTxtData('poisonexplosioncloud')
      expect(Boolean(row.subLoop)).toBe(true)
      expect(row.subStart).toBe(10)
      expect(row.subStop).toBe(19)

      const world = new ClientWorld()
      const cloud = (world as any).spawnMissileByKey('poisonexplosioncloud', 100, 100, 100, 100, {
        sourceSkillId: 73,
        skillLevel: 1,
      })
      expect(Boolean(cloud.subLoop)).toBe(true)
      expect(cloud.subStart).toBe(10)
      expect(cloud.subStop).toBe(19)

      const visitedFrames: number[] = []
      for (let t = 0; t < 60; t++) {
        ;(world as any).stepDiscreteSimulationTick(40)
        visitedFrames.push(cloud.frame)
      }
      const firstReachedSubStopIdx = visitedFrames.findIndex(f => f === 19)
      expect(firstReachedSubStopIdx).toBeGreaterThan(0)
      const afterWrapFrames = visitedFrames.slice(firstReachedSubStopIdx + 1, firstReachedSubStopIdx + 15)
      for (const f of afterWrapFrames) {
        expect(f).toBeGreaterThanOrEqual(10)
        expect(f).toBeLessThanOrEqual(19)
      }
    })
  })
})
