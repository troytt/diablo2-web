/**
 * Issue #1056 (VFX-B3-7): pack-overlays bake targets named after a real 1.13c Overlay.txt row must carry that row's
 * `Trans` (raw eDrawMode, D2Client 0x6FB1B11D / 0x6FB1B2B2 -> D2gfx #10041; kb/render/d2gfx-draw-mode-113c.md),
 * `AnimRate` and `PreDraw`. The 19 rows below are Trans=3 (additive, D3D ONE/ONE) in Overlay.txt but were
 * hand-written as 5 or 0.
 */
import { describe, expect, it } from 'vitest'
import { OVERLAY_TARGETS, overlayTargetRowFields } from '../src/baker/packers/pack-overlays.ts'
import { OVERLAY_METAS } from '../src/client/render/overlays-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'

const ROW_BY_NAME = new Map(OVERLAY_TXT_ROWS.map(row => [row.name.toLowerCase(), row] as const))

const TRANS3_ROWS = [
  'stun',
  'rabiesplague',
  'shrine_armor',
  'shrine_combat',
  'shrine_resist_fire',
  'shrine_resist_cold',
  'shrine_resist_lightning',
  'shrine_resist_poison',
  'shrine_skill',
  'shrine_mana_regen',
  'shrine_stamina',
  'shrine_experience',
  'fire_explode',
  'frogdemon_death',
  'fingermagespiderexplode',
  'fetishdeath2',
  'siege_beast_dust',
  'suicide_death',
  'succubae_death',
] as const

describe('#1056 pack-overlays targets take Overlay.txt Trans/AnimRate/PreDraw', () => {
  it('the 19 audited rows are Overlay.txt Trans 3 and their targets resolve to 3', () => {
    for (const name of TRANS3_ROWS) {
      const row = ROW_BY_NAME.get(name)
      expect(row?.trans, name).toBe(3)
      const target = OVERLAY_TARGETS.find(t => t.name === name)
      expect(target, name).toBeDefined()
      expect(overlayTargetRowFields(target!, row).trans, name).toBe(3)
    }
  })

  it('every target named after an Overlay.txt row agrees with the row (0 mismatches)', () => {
    const mismatches: string[] = []
    let checked = 0
    for (const target of OVERLAY_TARGETS) {
      const row = ROW_BY_NAME.get(target.name.toLowerCase())
      if (row === undefined) continue
      checked++
      try {
        const fields = overlayTargetRowFields(target, row)
        expect(fields).toEqual({
          trans: row.trans,
          animRate: row.animRate,
          preDraw: row.preDraw !== 0,
          lightRadius: row.radius,
          lightColor: [row.red, row.green, row.blue],
        })
      } catch (err) {
        mismatches.push(String(err))
      }
    }
    expect(checked).toBeGreaterThan(100)
    expect(mismatches).toEqual([])
  })

  it('baked meta of the 19 rows is trans 3 / additive with the row AnimRate', () => {
    for (const name of TRANS3_ROWS) {
      const meta = OVERLAY_METAS[name]
      expect(meta, name).toBeDefined()
      expect(meta!.trans, name).toBe(3)
      expect(meta!.blendMode, name).toBe('additive')
      expect(meta!.animRate, name).toBe(ROW_BY_NAME.get(name)!.animRate)
    }
  })

  it('fails fast on a hand-written drift instead of silently falling back', () => {
    const row = ROW_BY_NAME.get('stun')!
    expect(() => overlayTargetRowFields({ name: 'stun', trans: 5, animRate: row.animRate, preDraw: false }, row)).toThrow(
      /trans 5 != Overlay.txt Trans 3/,
    )
    expect(() => overlayTargetRowFields({ name: 'stun', trans: 3, animRate: row.animRate + 1, preDraw: false }, row)).toThrow(
      /animRate/,
    )
  })

  it('targets without an Overlay.txt row keep their declared fields', () => {
    expect(overlayTargetRowFields({ name: 'town_portal_op_tr', trans: 0, animRate: 16, preDraw: false }, undefined)).toEqual({
      trans: 0,
      animRate: 16,
      preDraw: false,
      lightRadius: 0,
      lightColor: [0, 0, 0],
    })
  })
})
