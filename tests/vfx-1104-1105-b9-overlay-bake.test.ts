/**
 * VFX-B9: Missing Overlay Atlas Baking (Issues #1104, #1105).
 *
 * Verifies against 1.13c Ground Truth (`Overlay.txt` / `overlay.bin`, `Skills.txt`, `States.txt`, `Missiles.txt`):
 * 1. (#1104) Every `Overlay.txt` row referenced by `Skills.txt` overlay columns (`castoverlay`, `srvoverlay`,
 *    `tgtoverlay`, `cltoverlaya`, `cltoverlayb`, `prgoverlay`), `States.txt` overlay columns (`overlay1..4`,
 *    `pgsvoverlay`, `castoverlay`, `removerlay`), or `Missiles.txt` `ProgOverlay` (with non-null `Filename`)
 *    has a baked `OVERLAY_METAS` atlas with matching `celFile`, `frames`, `animRate`, `trans`, `preDraw`,
 *    `lightRadius`, and `lightColor`.
 * 2. (#1104) Specifically verifies `healing` (`OverlayH`, 17 frames, trans 3), `receiving` (`AmazonHealSpell`,
 *    20 frames, radius 8, RGB [255, 184, 199]), `vampiresteal` (`VampiricHitHealth`, 8 frames), `stealmana`
 *    (`VampiricHitMana`, 13 frames), `diablolightning` (`RedShockEffectSmall`, 20 frames), and `bash`
 *    (`BABash`, 9 frames, with `MISSILE_METAS['bash']` undefined).
 * 3. (#1104 / #1105) `drawSceneOverlayDrawable` resolves overlays exclusively from `overlayArtMap` (by
 *    normalized `celFile` / token) without falling back to `missileArtMap` and without calling `reportMissingArt`.
 * 4. (#1105) Every `Overlay.txt` row with an MPQ-present `Filename` (284 rows across 252 distinct DCCs; only
 *    `mephisto` -> `MephistoOverlay` is absent from the MPQ archives) is baked in `OVERLAY_METAS` and
 *    `public/overlays/` with normalized `/` path separators and 0 scalar drift.
 */

import { homedir } from 'node:os'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OVERLAY_TARGETS } from '../src/baker/packers/pack-overlays.ts'
import { celFileArtKey, normalizeCelFileKey, resolveArtByCelFile } from '../src/client/render/cel-file-key.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import {
  AUTHENTIC_113C_OVERLAYS,
  OVERLAY_METAS,
  type OverlayMeta,
} from '../src/client/render/overlays-meta.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import {
  clearMissingArtEntries,
  drawSceneOverlayDrawable,
  getMissingArtEntries,
} from '../src/client/scene/world-renderer.ts'
import { overlayTransToDrawBlend } from '../src/common/gfx/draw-mode.ts'

const EXCEL_DIR =
  join(homedir(), 'd2-data', 'excel')

/**
 * `mephisto` (row 122, `Filename = MephistoOverlay`) is the sole `Overlay.txt` row whose DCC
 * does not exist in `Patch_D2.mpq`, `d2exp.mpq`, or `d2data.mpq`.
 */
const MPQ_ABSENT_OVERLAY_ROWS: ReadonlySet<string> = new Set(['mephisto'])

function buildEmulatedOverlayArtMap(): Map<string, LoadedOverlayArt> {
  const map = new Map<string, LoadedOverlayArt>()
  const handleByCel = new Map<string, AtlasHandle>()
  let nextHandle = 1
  for (const [key, meta] of Object.entries(OVERLAY_METAS)) {
    const celKey = meta.celFile && meta.celFile.toLowerCase() !== 'null' ? celFileArtKey(meta.celFile) : `name:${meta.name.toLowerCase()}`
    let handle = handleByCel.get(celKey)
    if (handle === undefined) {
      handle = (nextHandle++) as unknown as AtlasHandle
      handleByCel.set(celKey, handle)
    }
    const frames = meta.groups.map(group =>
      group.map(([x, y, width, height, anchorX, anchorY]) => ({
        x,
        y,
        width,
        height,
        anchorX,
        anchorY,
      })),
    )
    const entry: LoadedOverlayArt = { meta, handle, frames }
    map.set(key, entry)
    map.set(key.toLowerCase(), entry)
    if (meta.celFile && meta.celFile.toLowerCase() !== 'null') {
      map.set(celFileArtKey(meta.celFile), entry)
    }
  }
  return map
}

describe('VFX-B9: Missing Overlay Atlas Baking (#1104, #1105)', () => {
  describe('#1104 (B9-1): Skills.txt / States.txt / Missiles.txt referenced overlays (healing, receiving, vampiresteal, diablolightning, stealmana, bash)', () => {
    it('bakes healing, receiving, vampiresteal, diablolightning, stealmana, and bash with exact 1.13c Overlay.txt parameters', () => {
      // 1. healing -> OverlayH (17 frames, animRate 16, trans 3, radius 0)
      const healing = OVERLAY_METAS['healing']
      expect(healing).toBeDefined()
      expect(healing!.celFile).toBe('OverlayH')
      expect(healing!.frames).toBe(17)
      expect(healing!.framesPerDirection).toBe(17)
      expect(healing!.animRate).toBe(16)
      expect(healing!.trans).toBe(3)
      expect(healing!.blendMode).toBe('additive')
      expect(healing!.preDraw).toBe(false)
      expect(healing!.lightRadius).toBe(0)
      expect(OVERLAY_METAS['OverlayH']).toBe(healing)
      expect(OVERLAY_METAS['overlayh']).toBe(healing)

      // 2. receiving -> AmazonHealSpell (20 frames, animRate 16, trans 3, radius 8, RGB [255, 184, 199])
      const receiving = OVERLAY_METAS['receiving']
      expect(receiving).toBeDefined()
      expect(receiving!.celFile).toBe('AmazonHealSpell')
      expect(receiving!.frames).toBe(20)
      expect(receiving!.framesPerDirection).toBe(20)
      expect(receiving!.animRate).toBe(16)
      expect(receiving!.trans).toBe(3)
      expect(receiving!.lightRadius).toBe(8)
      expect(receiving!.lightColor).toEqual([255, 184, 199])
      expect(OVERLAY_METAS['AmazonHealSpell']).toBe(receiving)

      // 3. vampiresteal -> VampiricHitHealth (8 frames, animRate 16, trans 3)
      const vampiresteal = OVERLAY_METAS['vampiresteal']
      expect(vampiresteal).toBeDefined()
      expect(vampiresteal!.celFile).toBe('VampiricHitHealth')
      expect(vampiresteal!.frames).toBe(8)
      expect(vampiresteal!.framesPerDirection).toBe(8)
      expect(vampiresteal!.animRate).toBe(16)
      expect(vampiresteal!.trans).toBe(3)

      // 4. diablolightning -> RedShockEffectSmall (20 frames, animRate 16, trans 3)
      const diablolightning = OVERLAY_METAS['diablolightning']
      expect(diablolightning).toBeDefined()
      expect(diablolightning!.celFile).toBe('RedShockEffectSmall')
      expect(diablolightning!.frames).toBe(20)
      expect(diablolightning!.framesPerDirection).toBe(20)
      expect(diablolightning!.animRate).toBe(16)
      expect(diablolightning!.trans).toBe(3)

      // 5. stealmana -> VampiricHitMana (13 frames, animRate 16, trans 3)
      const stealmana = OVERLAY_METAS['stealmana']
      expect(stealmana).toBeDefined()
      expect(stealmana!.celFile).toBe('VampiricHitMana')
      expect(stealmana!.frames).toBe(13)
      expect(stealmana!.framesPerDirection).toBe(13)
      expect(stealmana!.animRate).toBe(16)
      expect(stealmana!.trans).toBe(3)

      // 6. bash -> BABash (9 frames, animRate 16, trans 3) & MISSILE_METAS['bash'] is undefined
      const bash = OVERLAY_METAS['bash']
      expect(bash).toBeDefined()
      expect(bash!.celFile).toBe('BABash')
      expect(bash!.frames).toBe(9)
      expect(bash!.framesPerDirection).toBe(9)
      expect(bash!.animRate).toBe(16)
      expect(bash!.trans).toBe(3)
      expect(MISSILE_METAS['bash']).toBeUndefined()
      expect(AUTHENTIC_113C_OVERLAYS['bash']?.height1).toBe(14)
      expect(AUTHENTIC_113C_OVERLAYS['bash']?.height3).toBe(-14)
      expect(AUTHENTIC_113C_OVERLAYS['bash']?.height4).toBe(-60)
    })

    it('every Overlay.txt row referenced by Skills.txt overlay columns, States.txt overlay columns, or Missiles.txt ProgOverlay has a matching OVERLAY_METAS entry and resolves via resolveArtByCelFile', () => {
      const rowByName = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r] as const))
      const referencedTokens = new Set<string>()

      // 1. Skills.txt overlay columns
      const skillsLines = readFileSync(resolve(EXCEL_DIR, 'Skills.txt'), 'utf-8').split(/\r?\n/)
      const sHeaders = skillsLines[0]!.split('\t').map(h => h.trim().toLowerCase())
      const sCols = ['castoverlay', 'srvoverlay', 'tgtoverlay', 'cltoverlaya', 'cltoverlayb', 'prgoverlay']
        .map(c => sHeaders.indexOf(c))
        .filter(i => i >= 0)
      for (let i = 1; i < skillsLines.length; i++) {
        const cols = skillsLines[i]!.split('\t')
        for (const colIdx of sCols) {
          const tok = (cols[colIdx] ?? '').trim().toLowerCase()
          if (tok && tok !== 'none') referencedTokens.add(tok)
        }
      }

      // 2. States.txt overlay columns
      const statesLines = readFileSync(resolve(EXCEL_DIR, 'States.txt'), 'utf-8').split(/\r?\n/)
      const stHeaders = statesLines[0]!.split('\t').map(h => h.trim().toLowerCase())
      const stCols = ['overlay1', 'overlay2', 'overlay3', 'overlay4', 'pgsvoverlay', 'castoverlay', 'removerlay']
        .map(c => stHeaders.indexOf(c))
        .filter(i => i >= 0)
      for (let i = 1; i < statesLines.length; i++) {
        const cols = statesLines[i]!.split('\t')
        for (const colIdx of stCols) {
          const tok = (cols[colIdx] ?? '').trim().toLowerCase()
          if (tok && tok !== 'none') referencedTokens.add(tok)
        }
      }

      // 3. Missiles.txt ProgOverlay column
      const missilesLines = readFileSync(resolve(EXCEL_DIR, 'Missiles.txt'), 'utf-8').split(/\r?\n/)
      const mHeaders = missilesLines[0]!.split('\t').map(h => h.trim().toLowerCase())
      const progOvIdx = mHeaders.indexOf('progoverlay')
      expect(progOvIdx).toBeGreaterThanOrEqual(0)
      for (let i = 1; i < missilesLines.length; i++) {
        const cols = missilesLines[i]!.split('\t')
        const tok = (cols[progOvIdx] ?? '').trim().toLowerCase()
        if (tok && tok !== 'none') referencedTokens.add(tok)
      }

      const overlayArtMap = buildEmulatedOverlayArtMap()
      const missing: string[] = []

      for (const tok of referencedTokens) {
        const row = rowByName.get(tok)
        if (!row) continue
        const fn = row.filename.trim()
        if (!fn || fn.toLowerCase() === 'null') continue
        const meta = OVERLAY_METAS[tok]
        if (!meta) {
          missing.push(`${tok}: missing from OVERLAY_METAS (expected ${fn})`)
          continue
        }
        if (normalizeCelFileKey(meta.celFile) !== normalizeCelFileKey(fn)) {
          missing.push(`${tok}: celFile ${meta.celFile} != ${fn}`)
        }
        const resolved = resolveArtByCelFile(overlayArtMap, tok, fn)
        if (!resolved || normalizeCelFileKey(resolved.meta.celFile) !== normalizeCelFileKey(fn)) {
          missing.push(`${tok}: resolveArtByCelFile failed for ${fn}`)
        }
      }

      expect(missing).toEqual([])
      expect(resolveArtByCelFile(overlayArtMap, 'healing', 'OverlayH')?.meta.celFile).toBe('OverlayH')
      expect(resolveArtByCelFile(overlayArtMap, 'receiving', 'AmazonHealSpell')?.meta.celFile).toBe('AmazonHealSpell')
      expect(resolveArtByCelFile(overlayArtMap, 'vampiresteal', 'VampiricHitHealth')?.meta.celFile).toBe('VampiricHitHealth')
      expect(resolveArtByCelFile(overlayArtMap, 'diablolightning', 'RedShockEffectSmall')?.meta.celFile).toBe('RedShockEffectSmall')
      expect(resolveArtByCelFile(overlayArtMap, 'stealmana', 'VampiricHitMana')?.meta.celFile).toBe('VampiricHitMana')
      expect(resolveArtByCelFile(overlayArtMap, 'bash', 'BABash')?.meta.celFile).toBe('BABash')
    })

    it('drawSceneOverlayDrawable draws healing, receiving, vampiresteal, diablolightning, stealmana, and bash without reportMissingArt or missileArtMap fallback', () => {
      clearMissingArtEntries()
      const overlayArtMap = buildEmulatedOverlayArtMap()
      const drawnAtlases: AtlasHandle[] = []
      const mockRenderer = {
        draw: (_frame: unknown, _x: number, _y: number, opts?: { atlas?: AtlasHandle }) => {
          if (opts?.atlas !== undefined) drawnAtlases.push(opts.atlas)
        },
      } as unknown as SpriteRenderer

      // Populate a poison pill in missileArtMap['bash'] to prove drawSceneOverlayDrawable does not fall back to missileArtMap
      const poisonMissileMap = new Map([
        [
          'bash',
          {
            meta: MISSILE_METAS['arrow']!,
            handle: 999999 as unknown as AtlasHandle,
            frames: [[{ x: 0, y: 0, width: 10, height: 10 }]],
          },
        ],
      ])

      const tokens = ['healing', 'receiving', 'vampiresteal', 'diablolightning', 'stealmana', 'bash'] as const
      for (const token of tokens) {
        drawnAtlases.length = 0
        const expectedHandle = overlayArtMap.get(token)!.handle
        drawSceneOverlayDrawable(
          mockRenderer,
          {
            drawableKind: 'overlay',
            ownerUnitId: 1,
            overlayId: 1,
            token,
            frame: 0,
            totalFrames: OVERLAY_METAS[token]!.frames,
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
          { overlayArtMap, missileArtMap: poisonMissileMap } as any,
          0,
        )
        expect(drawnAtlases, `token=${token}`).toEqual([expectedHandle])
      }
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe('#1105 (B9-2): 0 Overlay.txt rows with MPQ-present Filename lack an OVERLAY_METAS atlas', () => {
    it('covers all 284 MPQ-present Overlay.txt rows in OVERLAY_METAS with exact scalar parity, and documents mephisto (MephistoOverlay) as the sole MPQ-absent row', () => {
      const missingFromMetas: string[] = []
      const scalarDiffs: string[] = []
      let mpqPresentCount = 0

      for (const row of OVERLAY_TXT_ROWS) {
        const fn = row.filename.trim()
        if (!fn || fn.toLowerCase() === 'null') continue
        const key = row.name.toLowerCase()
        if (MPQ_ABSENT_OVERLAY_ROWS.has(key)) {
          expect(fn).toBe('MephistoOverlay')
          continue
        }
        mpqPresentCount++
        const meta: OverlayMeta | undefined = OVERLAY_METAS[row.name] ?? OVERLAY_METAS[key]
        if (!meta) {
          missingFromMetas.push(`${row.name} (${fn})`)
          continue
        }
        if (meta.celFile.includes('\\')) {
          scalarDiffs.push(`${row.name}.celFile contains backslash: ${meta.celFile}`)
        }
        if (normalizeCelFileKey(meta.celFile) !== normalizeCelFileKey(fn)) {
          scalarDiffs.push(`${row.name}.celFile: ${meta.celFile} != ${fn}`)
        }
        if (meta.animRate !== row.animRate) {
          scalarDiffs.push(`${row.name}.animRate: ${meta.animRate} != ${row.animRate}`)
        }
        if (meta.trans !== row.trans) {
          scalarDiffs.push(`${row.name}.trans: ${meta.trans} != ${row.trans}`)
        }
        if (meta.blendMode !== overlayTransToDrawBlend(row.trans)) {
          scalarDiffs.push(`${row.name}.blendMode: ${meta.blendMode} != ${overlayTransToDrawBlend(row.trans)}`)
        }
        if (meta.preDraw !== (row.preDraw !== 0)) {
          scalarDiffs.push(`${row.name}.preDraw: ${meta.preDraw} != ${row.preDraw !== 0}`)
        }
        if (meta.lightRadius !== row.radius) {
          scalarDiffs.push(`${row.name}.lightRadius: ${meta.lightRadius} != ${row.radius}`)
        }
        if (
          meta.lightColor[0] !== row.red ||
          meta.lightColor[1] !== row.green ||
          meta.lightColor[2] !== row.blue
        ) {
          scalarDiffs.push(
            `${row.name}.lightColor: [${meta.lightColor.join(',')}] != [${row.red},${row.green},${row.blue}]`,
          )
        }
      }

      expect(mpqPresentCount).toBe(284)
      expect(missingFromMetas).toEqual([])
      expect(scalarDiffs).toEqual([])
    })

    it('specifically verifies energyshieldhit1..7, hydra_start/loop/end1..3, progressive_lightning_2/3_attack, volcano_flame, twisterfront/back, ice_cage/melt, and baal_on_throne', () => {
      const expectedPairs: readonly [string, string][] = [
        ['energyshieldhit1', 'ManaShieldDir02'],
        ['energyshieldhit2', 'ManaShieldDir04'],
        ['energyshieldhit3', 'ManaShieldDir06'],
        ['energyshieldhit4', 'ManaShieldDir08'],
        ['energyshieldhit5', 'ManaShieldDir10'],
        ['energyshieldhit6', 'ManaShieldDir12'],
        ['energyshieldhit7', 'ManaShieldDir14'],
        ['hydra_start1', 'HydraGroundFireStart'],
        ['hydra_start2', 'HydraGroundFireStart'],
        ['hydra_start3', 'HydraGroundFireStart'],
        ['hydra_loop1', 'HydraGroundFire'],
        ['hydra_loop2', 'HydraGroundFire'],
        ['hydra_loop3', 'HydraGroundFire'],
        ['hydra_end1', 'HydraGroundFireEnd'],
        ['hydra_end2', 'HydraGroundFireEnd'],
        ['hydra_end3', 'HydraGroundFireEnd'],
        ['progressive_fire_2_attack', 'FireCast_for_Sorceress'],
        ['progressive_fire_3_attack', 'FireCast2'],
        ['progressive_cold_2_attack', 'IceCastNew01'],
        ['progressive_cold_3_attack', 'IceCastNew02'],
        ['progressive_lightning_2_attack', 'expansion/skill_norotate'],
        ['progressive_lightning_3_attack', 'expansion/skill_norotate'],
        ['warmth', 'Warmth'],
        ['srfirehit', 'SRFireHit'],
        ['sricehit', 'SRIceHit'],
        ['cast_familiar', 'FamiliarCast'],
        ['itemgleam', 'Gleam'],
        ['gleamtest3', 'Gleam'],
        ['gleamtest4', 'Gleam'],
        ['multigleam', 'multigleam'],
        ['dust', 'BAJumpLandPuff01'],
        ['brraisefront', 'brraisedeadfront'],
        ['brraiseback', 'brraisedeadback'],
        ['chillblood', 'ChillBloodPuff_curse'],
        ['vulturedemonfeathers', 'vdfeathers'],
        ['tentacleheadbloodripple', 'BloodRipple'],
        ['firegolem', 'FireGolemOverlay'],
        ['fingermageflames', 'FingerMageFlames'],
        ['horadric_light', 'HoradricLightBeam'],
        ['frontkick', 'willodeathoverlay'],
        ['volcano_flame', 'Expansion/volcano_Fire'],
        ['twisterfront', 'Expansion/TwisterFront'],
        ['twisterback', 'Expansion/TwisterBack'],
        ['spawnedbirthflames', 'Expansion/SpawnedBirthFlames'],
        ['spawnedflames', 'Expansion/SpawnedFlames'],
        ['ice_cage', 'expansion/icecage_neutral'],
        ['ice_cage_melt', 'expansion/icecage_melt'],
        ['baal_on_throne', 'expansion/baalshield'],
      ]

      const overlayArtMap = buildEmulatedOverlayArtMap()
      for (const [rowName, expectedCel] of expectedPairs) {
        const meta = OVERLAY_METAS[rowName]
        expect(meta, `${rowName} in OVERLAY_METAS`).toBeDefined()
        expect(normalizeCelFileKey(meta!.celFile), `${rowName}.celFile`).toBe(normalizeCelFileKey(expectedCel))
        const art = resolveArtByCelFile(overlayArtMap, rowName, AUTHENTIC_113C_OVERLAYS[rowName]?.filename ?? expectedCel)
        expect(art, `${rowName} resolved in overlayArtMap`).toBeDefined()
      }

      // Verify baked JSON/PNG files exist in public/overlays if public/overlays is present
      const publicOverlaysDir = join(__dirname, '..', 'public', 'overlays')
      if (existsSync(publicOverlaysDir)) {
        for (const t of ['healing', 'receiving', 'vampiresteal', 'diablolightning', 'stealmana', 'bash', 'volcano_flame', 'energyshieldhit1', 'hydra_loop1', 'progressive_lightning_2_attack', 'tentacleheadbloodripple']) {
          const jsonPath = join(publicOverlaysDir, `${t}.json`)
          const pngPath = join(publicOverlaysDir, `${t}.png`)
          expect(existsSync(jsonPath), `${t}.json exists`).toBe(true)
          expect(existsSync(pngPath), `${t}.png exists`).toBe(true)
          const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'))
          expect(parsed.name).toBe(t)
          expect(parsed.lightRadius).toBe(OVERLAY_METAS[t]!.lightRadius)
          expect(parsed.trans).toBe(OVERLAY_METAS[t]!.trans)
        }
      }

      // Every distinct MPQ-present DCC in OVERLAY_TXT_ROWS is in OVERLAY_TARGETS
      const targetCels = new Set(OVERLAY_TARGETS.map(t => normalizeCelFileKey(t.celFile)))
      for (const row of OVERLAY_TXT_ROWS) {
        const fn = row.filename.trim()
        if (!fn || fn.toLowerCase() === 'null' || MPQ_ABSENT_OVERLAY_ROWS.has(row.name.toLowerCase())) continue
        expect(targetCels.has(normalizeCelFileKey(fn)), `OVERLAY_TARGETS has ${fn} (${row.name})`).toBe(true)
      }
    })
  })
})
