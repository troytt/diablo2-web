import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSharedDataRegistry } from '../src/common/data/data-registry.ts'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
} from '../src/common/skills/missiles-data.ts'
import {
  celFileArtKey,
  isNullCelFile,
  normalizeCelFileKey,
  resolveArtByCelFile,
} from '../src/client/render/cel-file-key.ts'
import { MISSILE_METAS, type MissileMeta } from '../src/client/render/missiles-meta.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'

const PUBLIC_MISSILES_DIR = join(__dirname, '..', 'public', 'missiles')

function buildEmulatedMissileArtMap(): Map<string, { readonly meta: MissileMeta }> {
  const map = new Map<string, { readonly meta: MissileMeta }>()
  for (const [alias, meta] of Object.entries(MISSILE_METAS)) {
    const entry = { meta }
    map.set(alias, entry)
    map.set(alias.toLowerCase(), entry)
    map.set(meta.name, entry)
    map.set(meta.name.toLowerCase(), entry)
    if (meta.celFile) {
      map.set(celFileArtKey(meta.celFile), entry)
      map.set(meta.celFile, entry)
      map.set(meta.celFile.toLowerCase(), entry)
    }
  }
  return map
}

const SUB_MISSILE_COLS = [
  'ExplosionMissile',
  'SubMissile1',
  'SubMissile2',
  'SubMissile3',
  'HitSubMissile1',
  'HitSubMissile2',
  'HitSubMissile3',
  'HitSubMissile4',
  'CltSubMissile1',
  'CltSubMissile2',
  'CltSubMissile3',
  'CltHitSubMissile1',
  'CltHitSubMissile2',
  'CltHitSubMissile3',
  'CltHitSubMissile4',
] as const

const SKILL_MISSILE_COLS = [
  'srvmissile',
  'srvmissilea',
  'srvmissileb',
  'srvmissilec',
  'cltmissile',
  'cltmissilea',
  'cltmissileb',
  'cltmissilec',
  'cltmissiled',
] as const

const MONSTATS_MISSILE_COLS = [
  'MissA1',
  'MissA2',
  'MissS1',
  'MissS2',
  'MissS3',
  'MissS4',
  'MissC',
  'MissSQ',
] as const

function expandMissileChains(
  missilesByName: ReadonlyMap<string, Readonly<Record<string, string>>>,
  seeds: Iterable<string>,
): Set<string> {
  const visited = new Set<string>()
  const queue: string[] = []
  for (const seed of seeds) {
    const k = seed.trim().toLowerCase()
    if (k && missilesByName.has(k) && !visited.has(k)) {
      visited.add(k)
      queue.push(k)
    }
  }
  while (queue.length > 0) {
    const curr = queue.shift()!
    const row = missilesByName.get(curr)
    if (!row) continue
    for (const col of SUB_MISSILE_COLS) {
      const next = (row[col] ?? '').trim().toLowerCase()
      if (next && missilesByName.has(next) && !visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return visited
}

describe('B8: Missing 1.13c Missiles.txt DCC Atlas Baking (#1100, #1101, #1102, #1103)', () => {
  const registry = getSharedDataRegistry()
  const missilesByName = new Map<string, Readonly<Record<string, string>>>()
  const missilesById = new Map<number, Readonly<Record<string, string>>>()
  for (const row of registry.missilesTable.rows) {
    const name = (row['Missile'] ?? '').trim()
    const idStr = (row['Id'] ?? '').trim()
    if (!name || !idStr) continue
    missilesByName.set(name.toLowerCase(), row)
    missilesById.set(Number(idStr), row)
  }
  const artMap = buildEmulatedMissileArtMap()

  describe('#1100 (B8-1): Skills.txt missile chains (37 previously missing rows + sub-items)', () => {
    const b8_1_rows: readonly [string, string][] = [
      ['moltenboulder-flyingrocks', 'expansion\\MoltenFragmentD'],
      ['shafire1', 'ShamanFireball'],
      ['shafire3', 'ShamanFireball'],
      ['shamanexp', 'ShamanFireballExplodeFinal'],
      ['dirt pile', 'SandMaggotDirtPile'],
      ['sand pile', 'SandMaggotSandPile'],
      ['unholybolt1', 'UnholyBolt'],
      ['firehead', 'VampireMissile'],
      ['hellmeteordown', 'meteorlavadown'],
      ['andarielspray', 'AndarielSpell'],
      ['monbliz4', 'icestormfallvar04'],
      ['mephisto', 'MephistoMissile'],
      ['mephistoexplosion', 'MephistoMissileExplosion'],
      ['diablight', 'DiabloLightning'],
      ['fingermagespider', 'FingerMageSpider'],
      ['undeadmissile1', 'SkullPoison'],
      ['trap poison ball left', 'PoisonLeft'],
      ['trap cursed skull right', 'SkullRight'],
      ['trap cursed skull left', 'SkullLeft'],
      ['vine beast attack', 'expansion\\Pod_attack_1'],
      ['vine beast walk 1', 'expansion\\Pod_walk_1'],
      ['vine beast walk 1 fade', 'expansion\\Pod_Jump_FadeOut'],
      ['vine beast neutral', 'expansion\\Pod_neutral_1'],
      ['vine beast neutral fade', 'expansion\\Pod_Neutral_FadeOut'],
      ['succubusmiss', 'Expansion\\impmissile01'],
      ['imp teleport', 'expansion\\impteleport'],
      ['impfireball', 'expansion\\ImpFireball'],
      ['impmiss21', 'Expansion\\impmissile2'],
      ['catapultchargedball', 'BigheadLightningMissile'],
      ['catapult plague ball', 'expansion\\catapultpoisonbomb'],
      ['death mauler', 'expansion\\deathmaulerfingers'],
      ['death mauler trail', 'expansion\\deathmaulermissile'],
      ['death mauler trail fade', 'expansion\\deathmaulerfadeout'],
      ['baal nova', 'Expansion\\baalsummonmissile'],
      ['baal inferno', 'Expansion\\baalmissile'],
      ['baal cold maker', 'BlueNovaB'],
      ['baal cold trail', 'BlueNovaB'],
      // Sub-items 2..5
      ['monbliz3', 'icestormfallvar03'],
      ['hellmeteorlaunch1', 'meteorlavaburst'],
      ['hellmeteorlaunch2', 'meteorlavaburst2'],
      ['hellmeteorup', 'meteorlavaup'],
      ['hellmeteorball', 'meteorlavarock'],
      ['spidergoolay', 'Spider_Goo_Missile'],
      ['spidergoo', 'Spider_Goo_Disappear'],
      ['mephistoflyingrocksbig', 'ExplosionSpark'],
      ['mephistoexplosionbig', 'FireArrowExplode2'],
    ]

    it.each(b8_1_rows)(
      'resolves %s to its exact 1.13c CelFile %s with baked atlas on disk',
      (rowName, expectedCel) => {
        const canonical = getMissileTxtData(rowName)
        expect(normalizeCelFileKey(canonical.celFile)).toBe(normalizeCelFileKey(expectedCel))
        const resolved = resolveArtByCelFile(artMap, rowName, canonical.celFile)
        expect(resolved, `${rowName} (${expectedCel}) must resolve in MISSILE_METAS`).toBeDefined()
        expect(normalizeCelFileKey(resolved!.meta.celFile)).toBe(normalizeCelFileKey(expectedCel))

        if (existsSync(PUBLIC_MISSILES_DIR)) {
          const stem = resolved!.meta.name.toLowerCase()
          expect(existsSync(join(PUBLIC_MISSILES_DIR, `${stem}.png`)), `${stem}.png`).toBe(true)
          expect(existsSync(join(PUBLIC_MISSILES_DIR, `${stem}.json`)), `${stem}.json`).toBe(true)
        }
      },
    )

    it('verifies SpiderLay (spidergoolay/spidergoo) and Mephisto (mephisto/mephistoexplosion) DCC dimensions', () => {
      const spiderLay = resolveArtByCelFile(artMap, 'spidergoolay', 'Spider_Goo_Missile')!
      expect(spiderLay.meta.directions).toBe(8)
      expect(spiderLay.meta.framesPerDirection).toBe(17)

      const spiderGoo = resolveArtByCelFile(artMap, 'spidergoo', 'Spider_Goo_Disappear')!
      expect(spiderGoo.meta.directions).toBe(8)
      expect(spiderGoo.meta.framesPerDirection).toBe(9)

      const meph = resolveArtByCelFile(artMap, 'mephisto', 'MephistoMissile')!
      expect(meph.meta.directions).toBe(16)
      expect(meph.meta.framesPerDirection).toBe(10)

      const mephExp = resolveArtByCelFile(artMap, 'mephistoexplosion', 'MephistoMissileExplosion')!
      expect(mephExp.meta.framesPerDirection).toBe(12)
    })

    it('walks all Skills.txt srv/cltmissile* chains and resolves every non-null CelFile row', () => {
      const seeds: string[] = []
      for (const sRow of registry.skillsTable.rows) {
        for (const col of SKILL_MISSILE_COLS) {
          const v = (sRow[col] ?? '').trim()
          if (v) seeds.push(v)
        }
      }
      const reached = expandMissileChains(missilesByName, seeds)
      expect(reached.size).toBeGreaterThan(200)

      const missing: string[] = []
      for (const name of reached) {
        const row = missilesByName.get(name)!
        const cel = row['CelFile'] ?? ''
        if (isNullCelFile(cel)) continue
        const resolved = resolveArtByCelFile(artMap, name, cel)
        if (!resolved || normalizeCelFileKey(resolved.meta.celFile) !== normalizeCelFileKey(cel)) {
          missing.push(`${name}: ${cel}`)
        }
      }
      expect(missing).toEqual([])
    })
  })

  describe('#1101 (B8-2): MonStats MissA1..MissSQ normal attack projectiles (46 rows)', () => {
    const b8_2_rows: readonly [string, string][] = [
      ['bighead1', 'BigheadLightningMissile'],
      ['bighead2', 'BigheadLightningMissile'],
      ['bighead3', 'BigheadLightningMissile'],
      ['bighead4', 'BigheadLightningMissile'],
      ['bighead5', 'BigheadLightningMissile'],
      ['bighead6', 'BigheadLightningMissile'],
      ['bigheadexp', 'BigheadLightningExplosion'],
      ['spike1', 'SpikeFiendMissle'],
      ['spike2', 'SpikeFiendMissle'],
      ['spike3', 'SpikeFiendMissle'],
      ['spike4', 'SpikeFiendMissle'],
      ['spike5', 'SpikeFiendMissle'],
      ['spike6', 'SpikeFiendMissle'],
      ['goospit1', 'SandMaggotGooSpit'],
      ['goospit2', 'SandMaggotGooSpit'],
      ['goospit3', 'SandMaggotGooSpit'],
      ['goospit4', 'SandMaggotGooSpit'],
      ['goospit5', 'SandMaggotGooSpit'],
      ['goospitex', 'SandMaggotGooSpit'],
      ['goosplat', 'GooHit'],
      ['mummy1', 'GreaterMummyBreath'],
      ['mummy2', 'GreaterMummyBreath'],
      ['mummy3', 'GreaterMummyBreath'],
      ['mummy4', 'GreaterMummyBreath'],
      ['mummyex', 'GreaterMummyBreath'],
      ['shamanexp', 'ShamanFireballExplodeFinal'],
      ['frogpois', 'FrogPoisonMissile'],
      ['tentaclegoo', 'FrogPoisonMissile'],
      ['amphibianexplode', 'GooHit'],
      ['regurgitatorcorpse', 'SlugMissile'],
      ['regurgitatorcorpseexpl', 'Slug Missile Explode'],
      ['trap spike right', 'SpikeRight'],
      ['trap spike left', 'SpikeLeft'],
      ['trap poison ball right', 'PoisonRight'],
      ['trap poison ball left', 'PoisonLeft'],
      ['trap cursed skull right', 'SkullRight'],
      ['trap cursed skull left', 'SkullLeft'],
      ['highpriestlightning', 'HighPriestLightning'],
      ['blowgun', 'Blowdart'],
      ['impmiss21', 'Expansion\\impmissile2'],
      ['impmiss22', 'Expansion\\impmissile2'],
      ['impmiss23', 'Expansion\\impmissile2'],
      ['impmiss24', 'Expansion\\impmissile2'],
      ['impmiss25', 'Expansion\\impmissile2'],
      ['impmissex', 'Expansion\\impmissile2'],
      ['catapultchargedball on', 'BigheadLightningMissile'],
    ]

    it.each(b8_2_rows)('resolves monster attack missile %s -> %s', (rowName, expectedCel) => {
      const canonical = getMissileTxtData(rowName)
      expect(normalizeCelFileKey(canonical.celFile)).toBe(normalizeCelFileKey(expectedCel))
      const resolved = resolveArtByCelFile(artMap, rowName, canonical.celFile)
      expect(resolved, `${rowName} (${expectedCel})`).toBeDefined()
      expect(normalizeCelFileKey(resolved!.meta.celFile)).toBe(normalizeCelFileKey(expectedCel))
    })

    it('iterates MonStats enabled MissA1..MissSQ and expands chains with 0 missing CelFiles', () => {
      const seeds: string[] = []
      for (const mRow of registry.monStatsTable.rows) {
        if ((mRow['enabled'] ?? '').trim() !== '1') continue
        for (const col of MONSTATS_MISSILE_COLS) {
          const v = (mRow[col] ?? '').trim()
          if (v) seeds.push(v)
        }
      }
      const reached = expandMissileChains(missilesByName, seeds)
      expect(reached.size).toBeGreaterThanOrEqual(46)

      const missing: string[] = []
      for (const name of reached) {
        const row = missilesByName.get(name)!
        const cel = row['CelFile'] ?? ''
        if (isNullCelFile(cel)) continue
        const resolved = resolveArtByCelFile(artMap, name, cel)
        if (!resolved || normalizeCelFileKey(resolved.meta.celFile) !== normalizeCelFileKey(cel)) {
          missing.push(`${name}: ${cel}`)
        }
      }
      expect(missing).toEqual([])
    })
  })

  describe('#1102 (B8-3): Throwing weapons & potions missiletype chains (pilum, glaive, explosivepotion*)', () => {
    const b8_3_rows: readonly [string, number, string][] = [
      ['glaive', 37, 'Glaive'],
      ['pilum', 371, 'Pilum'],
      ['explosivepotionexp', 51, 'PotionExplode'],
      ['explosivepotiondebris1', 52, 'PotionExplodeDebris01'],
      ['explosivepotiondebris2', 53, 'PotionExplodeDebris02'],
      ['explosivepotiondebris3', 54, 'PotionExplodeDebris03'],
    ]

    it.each(b8_3_rows)(
      'resolves throwing missile %s (#%d) to CelFile %s',
      (rowName, expectedId, expectedCel) => {
        const canonical = getMissileTxtData(rowName)
        expect(canonical.id).toBe(expectedId)
        expect(normalizeCelFileKey(canonical.celFile)).toBe(normalizeCelFileKey(expectedCel))
        const resolved = resolveArtByCelFile(artMap, rowName, canonical.celFile)
        expect(resolved, `${rowName} (${expectedCel})`).toBeDefined()
        expect(normalizeCelFileKey(resolved!.meta.celFile)).toBe(normalizeCelFileKey(expectedCel))
      },
    )

    it('walks all Weapons.txt / Misc.txt missiletype > 0 rows and sub-chains with 0 missing CelFiles', () => {
      const seeds: string[] = []
      const weaponsTxt = readFileSync(
        join(homedir(), 'd2-data', 'excel', 'Weapons.txt'),
        'utf-8',
      )
      const miscTxt = readFileSync(
        join(homedir(), 'd2-data', 'excel', 'Misc.txt'),
        'utf-8',
      )
      for (const content of [weaponsTxt, miscTxt]) {
        const lines = content.split(/\r?\n/)
        const headers = lines[0]!.split('\t')
        const mtIdx = headers.indexOf('missiletype')
        if (mtIdx < 0) continue
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i]!.split('\t')
          const mt = Number((cols[mtIdx] ?? '').trim() || 0)
          if (mt > 0) {
            const mRow = missilesById.get(mt)
            if (mRow?.['Missile']) seeds.push(mRow['Missile'])
          }
        }
      }
      const reached = expandMissileChains(missilesByName, seeds)
      expect(reached.has('pilum')).toBe(true)
      expect(reached.has('glaive')).toBe(true)
      expect(reached.has('explosivepotionexp')).toBe(true)
      expect(reached.has('explosivepotiondebris1')).toBe(true)
      expect(reached.has('explosivepotiondebris3')).toBe(true)

      const missing: string[] = []
      for (const name of reached) {
        const row = missilesByName.get(name)!
        const cel = row['CelFile'] ?? ''
        if (isNullCelFile(cel)) continue
        const resolved = resolveArtByCelFile(artMap, name, cel)
        if (!resolved || normalizeCelFileKey(resolved.meta.celFile) !== normalizeCelFileKey(cel)) {
          missing.push(`${name}: ${cel}`)
        }
      }
      expect(missing).toEqual([])
    })
  })

  describe('#1103 (B8-4): Remaining 67 Missiles.txt rows with CelFile!=null and full-table 0-missing-art guarantee', () => {
    it('bakes sanctuarycenter (#81, sanctuary.dcc, 40 frames, 1 dir) without spawning it at runtime', () => {
      const meta = MISSILE_METAS['sanctuarycenter']
      expect(meta).toBeDefined()
      expect(meta!.celFile).toBe('sanctuary')
      expect(meta!.directions).toBe(1)
      expect(meta!.framesPerDirection).toBe(40)
    })

    it('bakes real DCCs for towermisttrail/fade (mist/Mist_fade) and taintedsunflash/ball (yellowBallGlowIntro/2)', () => {
      expect(MISSILE_METAS['towermisttrail']?.celFile).toBe('mist')
      expect(MISSILE_METAS['towermisttrail']?.framesPerDirection).toBe(14)
      expect(MISSILE_METAS['towermistfade']?.celFile).toBe('Mist_fade')
      expect(MISSILE_METAS['towermistfade']?.framesPerDirection).toBe(14)

      expect(MISSILE_METAS['taintedsunflash']?.celFile).toBe('yellowBallGlowIntro')
      expect(MISSILE_METAS['taintedsunflash']?.framesPerDirection).toBe(12)
      expect(MISSILE_METAS['taintedsunball']?.celFile).toBe('yellowBallGlow2')
      expect(MISSILE_METAS['taintedsunball']?.framesPerDirection).toBe(10)
    })

    it('every single one of the 684 1.13c Missiles.txt rows with CelFile!=null resolves to an atlas of that exact CelFile', () => {
      const missing: string[] = []
      let nonNullCount = 0
      for (const [name, row] of missilesByName) {
        const cel = row['CelFile'] ?? ''
        if (isNullCelFile(cel)) continue
        nonNullCount += 1
        const resolved = resolveArtByCelFile(artMap, name, cel)
        if (!resolved || normalizeCelFileKey(resolved.meta.celFile) !== normalizeCelFileKey(cel)) {
          missing.push(`${name}: ${cel}`)
        }
      }
      expect(nonNullCount).toBeGreaterThan(550)
      expect(missing).toEqual([])
    })

    it('buildSceneDrawables produces valid SceneMissileDrawable for newly baked rows', () => {
      const sampleRows = ['shafire1', 'unholybolt1', 'mephisto', 'pilum', 'glaive', 'spidergoolay']
      const units = sampleRows.map((key, idx) => {
        const data = getMissileTxtData(key)
        return {
          kind: 'missile' as const,
          id: idx + 1,
          classId: data.id,
          missileKey: key,
          x: 100 + idx * 5,
          y: 100,
          frame: 0,
        }
      })
      const scene = buildSceneDrawables(units, 0)
      expect(scene.missileDrawables).toHaveLength(sampleRows.length)
      for (const drawable of scene.missileDrawables) {
        const resolved = resolveArtByCelFile(artMap, drawable.missileKey, drawable.celFile)
        expect(resolved, drawable.missileKey).toBeDefined()
        expect(resolved!.meta.groups.length).toBeGreaterThan(0)
      }
    })
  })
})
