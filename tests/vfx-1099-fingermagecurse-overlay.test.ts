/**
 * Issue #1099 (VFX-B7-13): `fingermagecurse` must bake `data/global/overlays/FingerMageCurse.dcc`
 * as its own 1.13c Overlay.txt row (Filename=FingerMageCurse, Frames=15, AnimRate=16, Trans=3,
 * PreDraw=0, Radius=0, RGB=255/255/255) instead of aliasing `curseamplifydamage`
 * (CurseAmplifyDamageEffect, 24 frames, lightRadius=6).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OVERLAY_TARGETS, resolveOverlayTargetRow } from '../src/baker/packers/pack-overlays.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import {
  ALL_OVERLAY_NAMES,
  AUTHENTIC_113C_OVERLAYS,
  OVERLAY_METAS,
  STATE_OVERLAYS,
} from '../src/client/render/overlays-meta.ts'
import { CANONICAL_113C_OVERLAYS, getOverlayTxtData } from '../src/common/skills/missiles-data.ts'

describe('#1099 (B7-13): fingermagecurse overlay 1.13c parity (FingerMageCurse.dcc)', () => {
  it('curseamplifydamage target does not alias fingermagecurse, and fingermagecurse has its own target', () => {
    const ampTarget = OVERLAY_TARGETS.find(t => t.name === 'curseamplifydamage')
    expect(ampTarget).toBeDefined()
    expect(ampTarget!.aliases ?? []).not.toContain('fingermagecurse')

    const fmTarget = OVERLAY_TARGETS.find(t => t.name === 'fingermagecurse')
    expect(fmTarget).toBeDefined()
    expect(fmTarget!.celFile).toBe('FingerMageCurse')

    const rowByName = new Map(OVERLAY_TXT_ROWS.map(r => [r.name.toLowerCase(), r] as const))
    const resolvedRow = resolveOverlayTargetRow(fmTarget!, rowByName)
    expect(resolvedRow).toBeDefined()
    expect(resolvedRow!.name).toBe('fingermagecurse')
    expect(resolvedRow!.filename).toBe('FingerMageCurse')
    expect(resolvedRow!.frames).toBe(15)
    expect(resolvedRow!.radius).toBe(0)
  })

  it('OVERLAY_METAS.fingermagecurse resolves to FingerMageCurse (15 frames, lightRadius 0)', () => {
    expect(ALL_OVERLAY_NAMES).toContain('fingermagecurse')

    const meta = OVERLAY_METAS.fingermagecurse
    expect(meta).toBeDefined()
    expect(meta!.name).toBe('fingermagecurse')
    expect(meta!.celFile).toBe('FingerMageCurse')
    expect(meta!.frames).toBe(15)
    expect(meta!.framesPerDirection).toBe(15)
    expect(meta!.directions).toBe(1)
    expect(meta!.animRate).toBe(16)
    expect(meta!.trans).toBe(3)
    expect(meta!.blendMode).toBe('additive')
    expect(meta!.preDraw).toBe(false)
    expect(meta!.lightRadius).toBe(0)
    expect(meta!.lightColor).toEqual([255, 255, 255])
    expect(meta!.groups[0]).toHaveLength(15)

    expect(OVERLAY_METAS.FingerMageCurse).toBe(meta)
    expect(meta).not.toBe(OVERLAY_METAS.curseamplifydamage)
  })

  it('STATE_OVERLAYS[84] (fingermagecurse from FingerMageSpider #196) & canonical/authentic tables match Overlay.txt', () => {
    expect(STATE_OVERLAYS[84]).toEqual(['fingermagecurse'])

    const auth = AUTHENTIC_113C_OVERLAYS.fingermagecurse
    expect(auth).toBeDefined()
    expect(auth!.filename).toBe('FingerMageCurse')
    expect(auth!.frames).toBe(15)
    expect(auth!.radius).toBe(0)

    const canon = CANONICAL_113C_OVERLAYS.fingermagecurse
    expect(canon).toBeDefined()
    expect(canon!.filename).toBe('FingerMageCurse')
    expect(canon!.frames).toBe(15)
    expect(canon!.radius).toBe(0)

    const resolved = getOverlayTxtData('fingermagecurse')
    expect(resolved.filename).toBe('FingerMageCurse')
    expect(resolved.frames).toBe(15)
    expect(resolved.radius).toBe(0)
  })

  it('baked public/overlays/fingermagecurse.json matches FingerMageCurse (15 frames, lightRadius 0)', () => {
    const jsonPath = join(__dirname, '..', 'public', 'overlays', 'fingermagecurse.json')
    if (!existsSync(jsonPath)) return
    const baked = JSON.parse(readFileSync(jsonPath, 'utf8'))
    expect(baked.name).toBe('fingermagecurse')
    expect(baked.celFile).toBe('FingerMageCurse')
    expect(baked.frames).toBe(15)
    expect(baked.framesPerDirection).toBe(15)
    expect(baked.lightRadius).toBe(0)
    expect(baked.lightColor).toEqual([255, 255, 255])
  })
})
