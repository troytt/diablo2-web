import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  CANONICAL_113C_MISSILES,
  getMissileTxtData,
} from '../src/common/skills/missiles-data.ts'
import {
  resolveThrowMissileForItemCode,
  type ThrowMissileKey,
} from '../src/common/skills/weapon-combat-meta.ts'
import { getCanonicalWeaponsTable } from '../src/common/units/char-anim-speed.ts'
import { OVERLAY_TARGETS, overlayTargetRowFields, resolveOverlayTargetRow } from '../src/baker/packers/pack-overlays.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { overlayTransToDrawBlend } from '../src/common/gfx/draw-mode.ts'
import { celFileArtKey } from '../src/client/render/cel-file-key.ts'
import * as missileOverlayRenderer from '../src/client/scene/missile-overlay-renderer.ts'
import { drawSceneOverlayDrawable } from '../src/client/scene/world-renderer.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'

describe('B7-p2: De-aliasing & 1.13c Row Alignment (#1093..#1098)', () => {
  describe('#1093 (B7-7): CANONICAL_113C_MISSILES removes injected ExplosionMissile/AlwaysExplode (9 rows)', () => {
    it('leaves explosionMissile empty on immolationarrow, freezingarrow, glacialspike, blizzard1..4', () => {
      for (const name of [
        'immolationarrow',
        'freezingarrow',
        'glacialspike',
        'blizzard1',
        'blizzard2',
        'blizzard3',
        'blizzard4',
      ]) {
        const row = getMissileTxtData(name)
        expect(row.explosionMissile ?? '', `${name}.explosionMissile`).toBe('')
      }
    })

    it('matches Missiles.txt AlwaysExplode on glacialspike, rabiesplague, freezingarrow, immolationarrow, blizzard1..4', () => {
      expect(getMissileTxtData('glacialspike').alwaysExplode).toBeUndefined()
      expect(getMissileTxtData('rabiesplague').alwaysExplode).toBeUndefined()
      expect(getMissileTxtData('freezingarrow').alwaysExplode).toBe(true)
      expect(getMissileTxtData('immolationarrow').alwaysExplode).toBe(true)
      for (const name of ['blizzard1', 'blizzard2', 'blizzard3', 'blizzard4']) {
        expect(getMissileTxtData(name).alwaysExplode, name).toBe(true)
      }
    })

    it('spawns freezingarrowexp1 when glacialspike impacts a monster, but spawns 0 sub-missiles on range expiry (AlwaysExplode empty)', () => {
      // 1) Monster impact -> CltHitSubMissile1 = freezingarrowexp1
      const worldHit = new ClientWorld()
      ;(worldHit as any)._monsters.set(500, {
        id: 500,
        unitType: 'monster',
        classId: 1,
        x: 102,
        y: 100,
        dead: false,
        states: new Set<number>(),
      })
      const gsHit = (worldHit as any).spawnMissileByKey('glacialspike', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 55,
        skillLevel: 1,
      })
      for (let i = 0; i < 10; i++) {
        if (!(worldHit as any)._units.has(gsHit.key)) break
        ;(worldHit as any).stepMissileUnit(gsHit)
      }
      const hitSpawns = Array.from((worldHit as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== gsHit.key,
      )
      expect(hitSpawns.some((u: any) => u.missileKey === 'freezingarrowexp1')).toBe(true)

      // 2) Range expiry with no hit -> 0 sub-missiles
      const worldMiss = new ClientWorld()
      const gsMiss = (worldMiss as any).spawnMissileByKey('glacialspike', 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 55,
        skillLevel: 1,
      })
      const maxTicks = gsMiss.maxTicks ?? 24
      for (let i = 0; i < maxTicks + 2; i++) {
        if (!(worldMiss as any)._units.has(gsMiss.key)) break
        ;(worldMiss as any).stepMissileUnit(gsMiss)
      }
      const missSpawns = Array.from((worldMiss as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== gsMiss.key,
      )
      expect(missSpawns).toHaveLength(0)
    })

    it('spawns CltHitSubMissiles on range expiry for freezingarrow, immolationarrow, and blizzard1 (AlwaysExplode=1), and 0 for rabiesplague', () => {
      // freezingarrow range expiry -> freezingarrowexp1 + freezingarrowexp2
      const worldFa = new ClientWorld()
      const fa = (worldFa as any).spawnMissileByKey('freezingarrow', 100, 100, 140, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 31,
        skillLevel: 1,
      })
      for (let i = 0; i <= (fa.maxTicks ?? 40); i++) {
        if (!(worldFa as any)._units.has(fa.key)) break
        ;(worldFa as any).stepMissileUnit(fa)
      }
      const faSpawns = Array.from((worldFa as any)._units.values()).map((u: any) => u.missileKey)
      expect(faSpawns).toContain('freezingarrowexp1')
      expect(faSpawns).toContain('freezingarrowexp2')

      // immolationarrow range expiry -> CltHitFunc 12 wCltMissileB = explodingarrowexp + radius-3 disc of firewall/firesmall/firemedium (no immolationfire)
      const worldIa = new ClientWorld()
      const ia = (worldIa as any).spawnMissileByKey('immolationarrow', 100, 100, 140, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 27,
        skillLevel: 1,
      })
      for (let i = 0; i <= (ia.maxTicks ?? 40); i++) {
        if (!(worldIa as any)._units.has(ia.key)) break
        ;(worldIa as any).stepMissileUnit(ia)
      }
      const iaSpawns = Array.from((worldIa as any)._units.values()).map((u: any) => u.missileKey)
      expect(iaSpawns).toContain('explodingarrowexp')
      expect(iaSpawns).not.toContain('immolationfire')
      expect(
        iaSpawns.some(
          (k: string) => k === 'firewall' || k === 'firesmall' || k === 'firemedium',
        ),
      ).toBe(true)

      // blizzard1 range expiry -> blizzardexplode1..3
      const worldBliz = new ClientWorld()
      const b1 = (worldBliz as any).spawnMissileByKey('blizzard1', 100, 100, 100, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 59,
        skillLevel: 1,
      })
      for (let i = 0; i <= (b1.maxTicks ?? 9); i++) {
        if (!(worldBliz as any)._units.has(b1.key)) break
        ;(worldBliz as any).stepMissileUnit(b1)
      }
      const blizSpawns = Array.from((worldBliz as any)._units.values()).map((u: any) => u.missileKey)
      expect(blizSpawns.some((k: string) => k.startsWith('blizzardexplode'))).toBe(true)

      // rabiesplague range expiry -> 0 explosion missiles
      const worldRabies = new ClientWorld()
      const rp = (worldRabies as any).spawnMissileByKey('rabiesplague', 100, 100, 100, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: 238,
        skillLevel: 1,
        maxTicks: 5,
      })
      for (let i = 0; i <= 6; i++) {
        if (!(worldRabies as any)._units.has(rp.key)) break
        ;(worldRabies as any).stepMissileUnit(rp)
      }
      const rpSpawns = Array.from((worldRabies as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== rp.key,
      )
      expect(rpSpawns).toHaveLength(0)
    })
  })

  describe('#1094 (B7-8): Remaining scalar drift in CANONICAL_113C_MISSILES', () => {
    it('aligns sentrychargedbolt, shockwave, sentrylightningbolt, skmagefire with 1.13c Missiles.txt', () => {
      const scb = getMissileTxtData('sentrychargedbolt')
      expect(scb.vel).toBe(12)
      expect(scb.maxVel).toBe(12)
      expect(scb.range).toBe(98)
      expect(scb.speedPxPerSec).toBe(300)
      expect(scb.distancePx).toBe(1176)

      const sw = getMissileTxtData('shockwave')
      expect(sw.pierce).toBeUndefined()

      const slb = getMissileTxtData('sentrylightningbolt')
      expect(slb.pierce).toBeUndefined()

      const smf = getMissileTxtData('skmagefire')
      expect(smf.red).toBe(255)
      expect(smf.green).toBe(255)
      expect(smf.blue).toBe(255)
    })

    it('has zero scalar drift between CANONICAL_113C_MISSILES and 1.13c Missiles.txt across all 684 rows', () => {
      const missilesTxtPath =
        join(homedir(), 'd2-data', 'excel', 'Missiles.txt')
      const lines = readFileSync(resolve(missilesTxtPath), 'utf-8').split(/\r?\n/)
      const headers = lines[0]!.split('\t')
      const idx = (col: string) => headers.indexOf(col)
      const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? 0 : Number(s))
      const bool = (v: unknown) => v === true || v === 1 || v === '1'

      const diffs: string[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split('\t')
        const name = (cols[idx('Missile')] ?? '').trim()
        const idStr = (cols[idx('Id')] ?? '').trim()
        if (!name || !idStr) continue
        const row = CANONICAL_113C_MISSILES[name.toLowerCase()]
        if (!row) {
          diffs.push(`Missing row: ${name}`)
          continue
        }
        const checks: [string, unknown, unknown][] = [
          ['id', row.id, num(idStr)],
          ['celFile', row.celFile ?? '', cols[idx('CelFile')] ?? ''],
          ['animLen', row.animLen ?? 0, num(cols[idx('AnimLen')])],
          ['animSpeed', row.animSpeed ?? 0, num(cols[idx('AnimSpeed')])],
          ['loopAnim', row.loopAnim ?? 0, num(cols[idx('LoopAnim')])],
          [
            'numDirections',
            row.numDirections ?? 0,
            (cols[idx('NumDirections')] ?? '').trim() === '' ? 1 : num(cols[idx('NumDirections')]),
          ],
          ['range', row.range ?? 0, num(cols[idx('Range')])],
          ['levRange', row.levRange ?? 0, num(cols[idx('LevRange')])],
          ['vel', row.vel ?? 0, num(cols[idx('Vel')])],
          ['maxVel', row.maxVel ?? 0, num(cols[idx('MaxVel')])],
          ['light', row.light ?? 0, num(cols[idx('Light')])],
          ['red', row.red ?? 0, num(cols[idx('Red')])],
          ['green', row.green ?? 0, num(cols[idx('Green')])],
          ['blue', row.blue ?? 0, num(cols[idx('Blue')])],
          ['trans', row.trans ?? 0, num(cols[idx('Trans')])],
          ['explosionMissile', row.explosionMissile ?? '', cols[idx('ExplosionMissile')] ?? ''],
          ['alwaysExplode', bool(row.alwaysExplode), bool(cols[idx('AlwaysExplode')])],
          ['pierce', bool(row.pierce), bool(cols[idx('Pierce')])],
          ['subLoop', row.subLoop ?? 0, num(cols[idx('SubLoop')])],
          ['subStart', row.subStart ?? 0, num(cols[idx('SubStart')])],
          ['subStop', row.subStop ?? 0, num(cols[idx('SubStop')])],
        ]
        for (const [f, a, b] of checks) {
          if (a !== b) diffs.push(`${name}.${f}: ${String(a)} != ${String(b)}`)
        }
      }
      expect(diffs).toEqual([])
    })
  })

  describe('#1095 (B7-9): Throwable weapons and potions resolve missile from Weapons.txt / Misc.txt missiletype', () => {
    it('maps pilum, glaive, javelin, throwknife, throwaxe, and all 6 throwing potions to exact 1.13c Missiles.txt rows', () => {
      const expected: readonly [string, ThrowMissileKey][] = [
        // Pilums (missiletype=371 -> pilum)
        ['pil', 'pilum'],
        ['tsp', 'pilum'],
        ['am5', 'pilum'],
        ['ama', 'pilum'],
        ['amf', 'pilum'],
        // Glaives (missiletype=37 -> glaive)
        ['glv', 'glaive'],
        ['9pi', 'glaive'],
        ['9s9', 'glaive'],
        ['9gl', 'glaive'],
        ['9ts', 'glaive'],
        ['7pi', 'glaive'],
        ['7s7', 'glaive'],
        ['7gl', 'glaive'],
        ['7ts', 'glaive'],
        // Javelins (missiletype=1 -> javelin)
        ['jav', 'javelin'],
        ['ssp', 'javelin'],
        ['9ja', 'javelin'],
        ['7ja', 'javelin'],
        // Throwing knives (missiletype=36 -> throwknife)
        ['tkf', 'throwknife'],
        ['bkf', 'throwknife'],
        ['9tk', 'throwknife'],
        ['9bk', 'throwknife'],
        ['7tk', 'throwknife'],
        ['7bk', 'throwknife'],
        // Throwing axes (missiletype=35 -> throwaxe)
        ['tax', 'throwaxe'],
        ['bal', 'throwaxe'],
        ['9ta', 'throwaxe'],
        ['9b8', 'throwaxe'],
        ['7ta', 'throwaxe'],
        ['7b8', 'throwaxe'],
        // Throwing potions (Weapons.txt missiletype 44..49)
        ['opl', 'oilpotion'], // Fulminating Potion: missiletype=44 -> oilpotion
        ['opm', 'explosivepotion'], // Exploding Potion: missiletype=45 -> explosivepotion
        ['ops', 'fulminatingpotion'], // Oil Potion: missiletype=46 -> fulminatingpotion
        ['gpl', 'rancidgasepotion'], // Strangling Gas Potion: missiletype=47 -> rancidgasepotion
        ['gpm', 'chokinggaspoition'], // Choking Gas Potion: missiletype=48 -> chokinggaspoition
        ['gps', 'stranglinggaspotion'], // Rancid Gas Potion: missiletype=49 -> stranglinggaspotion
      ]
      for (const [code, missileKey] of expected) {
        expect(resolveThrowMissileForItemCode(code), `code=${code}`).toBe(missileKey)
      }
    })

    it('every throwable item in Weapons.txt resolves to the exact Missiles.txt row for its missiletype Id', () => {
      const missileById = new Map<number, string>()
      for (const row of Object.values(CANONICAL_113C_MISSILES)) {
        missileById.set(row.id, row.name)
      }
      const throwTypes = new Set(['tkni', 'taxe', 'jave', 'ajav', 'tpot'])
      for (const w of getCanonicalWeaponsTable().all) {
        if (!w.stackable || !throwTypes.has(w.type)) continue
        expect(w.missiletype, `${w.code}.missiletype`).toBeGreaterThan(0)
        expect(resolveThrowMissileForItemCode(w.code), w.code).toBe(missileById.get(w.missiletype!))
      }
    })
  })

  describe('#1096 (B7-10): Dead drawMissileProjectile removed from missile-overlay-renderer.ts', () => {
    it('does not export drawMissileProjectile', () => {
      expect('drawMissileProjectile' in missileOverlayRenderer).toBe(false)
    })
  })

  describe('#1097 (B7-11): OVERLAY_TARGETS & OVERLAY_METAS derive scalar fields strictly from Overlay.txt', () => {
    it('OVERLAY_TARGETS does not hand-write animRate/trans/preDraw/lightRadius/lightColor on any Overlay.txt target', () => {
      const rowByName = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r] as const))
      const rowByCel = new Map(
        OVERLAY_TXT_ROWS.map(r => [r.filename.replace(/\\/g, '/').toLowerCase(), r] as const),
      )
      for (const t of OVERLAY_TARGETS) {
        const row = resolveOverlayTargetRow(t, rowByName, rowByCel)
        if (row) {
          expect(t.animRate, `${t.name}.animRate`).toBeUndefined()
          expect(t.trans, `${t.name}.trans`).toBeUndefined()
          expect(t.preDraw, `${t.name}.preDraw`).toBeUndefined()
          expect(t.lightRadius, `${t.name}.lightRadius`).toBeUndefined()
          expect(t.lightColor, `${t.name}.lightColor`).toBeUndefined()
          const derived = overlayTargetRowFields(t, row)
          expect(derived).toEqual({
            trans: row.trans,
            animRate: row.animRate,
            preDraw: row.preDraw !== 0,
            lightRadius: row.radius,
            lightColor: [row.red, row.green, row.blue],
          })
        } else {
          expect(t.name.startsWith('town_portal_')).toBe(true)
        }
      }
    })

    it('every OVERLAY_METAS key matching an OVERLAY_TXT_ROWS row has 0 scalar diffs', () => {
      const rowByName = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r] as const))
      const diffs: string[] = []
      for (const [key, meta] of Object.entries(OVERLAY_METAS)) {
        const row = rowByName.get(key.toLowerCase())
        if (!row) continue
        if (meta.animRate !== row.animRate) diffs.push(`${key}.animRate: ${meta.animRate} != ${row.animRate}`)
        if (meta.trans !== row.trans) diffs.push(`${key}.trans: ${meta.trans} != ${row.trans}`)
        const expectedBlend = overlayTransToDrawBlend(row.trans)
        if (meta.blendMode !== expectedBlend) diffs.push(`${key}.blendMode: ${meta.blendMode} != ${expectedBlend}`)
        if (meta.preDraw !== (row.preDraw !== 0)) diffs.push(`${key}.preDraw: ${meta.preDraw} != ${row.preDraw !== 0}`)
        if (meta.lightRadius !== row.radius) diffs.push(`${key}.lightRadius: ${meta.lightRadius} != ${row.radius}`)
        if (
          meta.lightColor[0] !== row.red ||
          meta.lightColor[1] !== row.green ||
          meta.lightColor[2] !== row.blue
        ) {
          diffs.push(`${key}.lightColor: [${meta.lightColor.join(',')}] != [${row.red},${row.green},${row.blue}]`)
        }
        if (meta.celFile.replace(/\\/g, '/').toLowerCase() !== row.filename.replace(/\\/g, '/').toLowerCase()) {
          diffs.push(`${key}.celFile: ${meta.celFile} != ${row.filename}`)
        }
      }
      expect(diffs).toEqual([])
    })
  })

  describe('#1098 (B7-12): holyshockhit token resolves to ShockHitSm (20 frames) and is not clobbered by handofgod (HolyShockHit, 21 frames)', () => {
    it('separates holyshockhit (ShockHitSm, 20 frames) and handofgod (HolyShockHit, 21 frames) in OVERLAY_METAS', () => {
      const hs = OVERLAY_METAS['holyshockhit']!
      const hog = OVERLAY_METAS['handofgod']!
      expect(hs).toBeDefined()
      expect(hog).toBeDefined()
      expect(hs.celFile).toBe('ShockHitSm')
      expect(hs.frames).toBe(20)
      expect(hs.lightRadius).toBe(11)
      expect(hog.celFile).toBe('HolyShockHit')
      expect(hog.frames).toBe(21)
      expect(hog.lightRadius).toBe(2)
    })

    it('drawSceneOverlayDrawable resolves holyshockhit to ShockHitSm and handofgod to HolyShockHit via normalised celFile key', () => {
      const drawnHandles: AtlasHandle[] = []
      const mockRenderer = {
        draw: (_frame: any, _x: number, _y: number, opts?: { atlas?: AtlasHandle }) => {
          if (opts?.atlas !== undefined) drawnHandles.push(opts.atlas)
        },
      } as unknown as SpriteRenderer

      const shockHitSmHandle = 101 as unknown as AtlasHandle
      const holyShockHitHandle = 202 as unknown as AtlasHandle

      const shockHitSmArt = {
        meta: OVERLAY_METAS['holyshockhit']!,
        handle: shockHitSmHandle,
        frames: [[{ x: 0, y: 0, width: 32, height: 32, anchorX: -16, anchorY: -16 }]],
      }
      const handOfGodArt = {
        meta: OVERLAY_METAS['handofgod']!,
        handle: holyShockHitHandle,
        frames: [[{ x: 0, y: 0, width: 64, height: 64, anchorX: -32, anchorY: -32 }]],
      }

      const overlayArtMap = new Map([
        [celFileArtKey('ShockHitSm'), shockHitSmArt],
        ['holyshockhit', shockHitSmArt],
        [celFileArtKey('HolyShockHit'), handOfGodArt],
        ['handofgod', handOfGodArt],
      ])

      drawSceneOverlayDrawable(
        mockRenderer,
        {
          drawableKind: 'overlay',
          ownerUnitId: 1,
          overlayId: 141,
          token: 'holyshockhit',
          frame: 0,
          totalFrames: 20,
          loop: false,
          preDraw: false,
          blendMode: 'additive',
          xOffset: 0,
          subX: 10,
          subY: 10,
          worldX: 100,
          worldY: 100,
          sortY: 100,
        } as any,
        { overlayArtMap } as any,
        0,
      )
      expect(drawnHandles).toEqual([shockHitSmHandle])

      drawnHandles.length = 0
      drawSceneOverlayDrawable(
        mockRenderer,
        {
          drawableKind: 'overlay',
          ownerUnitId: 1,
          overlayId: 50,
          token: 'handofgod',
          frame: 0,
          totalFrames: 21,
          loop: false,
          preDraw: false,
          blendMode: 'additive',
          xOffset: 0,
          subX: 10,
          subY: 10,
          worldX: 100,
          worldY: 100,
          sortY: 100,
        } as any,
        { overlayArtMap } as any,
        0,
      )
      expect(drawnHandles).toEqual([holyShockHitHandle])
    })
  })
})
