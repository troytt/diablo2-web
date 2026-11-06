/**
 * Issue #926 — character-select avatars must show the saved equipment look.
 *
 * Ground truth: the char list reuses the in-game runtime paperdoll compositor
 * (`SorceressLayerCompositor` + `/chars/<class>` layer packs) driven by the MCP
 * statstring components + weapon class, replacing the never-implemented
 * `avatar-layers/*.png` baked-sprite convention.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMcpAvatarStatstring } from '../src/client/frontend/statstring-avatar.ts'
import type { ParsedMcpAvatarStatstring } from '../src/client/frontend/statstring-avatar.ts'
import {
  buildAvatarSpecFromStatstring,
  getSharedClassLayerCompositor,
  releaseUnselectedAvatarComposites,
} from '../src/client/frontend/avatar-compositor.ts'
import {
  SorceressLayerCompositor,
  type CharLayerAssetLoader,
  type SorceressAppearanceSpec,
} from '../src/common/units/char-appearance.ts'

describe('[Issue #926] Character-select avatar equipment compositing', () => {
  const charsRoot = path.resolve(__dirname, '../public/chars')
  const packsAvailable = fs.existsSync(path.join(charsRoot, 'so', 'manifest.json'))

  /**
   * Synthetic 33-byte MCP 0x19 statstring: 2-byte header (0x84 0x80), 11
   * component codes at [2..12], pad to 14, 11 color codes at [14..24].
   * Component codes come from D2WIN_COMPONENT_TABLE; we take real codes by
   * parsing with known tokens below via the exported table lookup instead.
   */
  function descWith(components: Partial<Record<string, string>>, weaponClass: string): ParsedMcpAvatarStatstring {
    return {
      classToken: 'so',
      mode: 'TN' as const,
      weaponClass,
      hasEquippedComponents: true,
      rawComponentCodes: new Uint8Array(11).fill(0xff),
      rawComponentColors: new Uint8Array(11).fill(0xff),
      components: {
        HD: 'nil', TR: 'nil', LG: 'nil', RA: 'nil', LA: 'nil',
        RH: 'nil', LH: 'nil', SH: 'nil', S1: 'nil', S2: 'nil', S3: 'nil',
        ...components,
      },
      componentTokens: {} as Record<string, string>,
      componentColors: {} as Record<string, number>,
      equippedLayers: [],
      cofSignature: `so:TN:${weaponClass}:${JSON.stringify(components)}`,
    } as unknown as ParsedMcpAvatarStatstring
  }

  it('1. buildAvatarSpecFromStatstring maps components → layer variants and weaponClass → wclass', () => {
    const desc = descWith(
      { HD: 'lit', TR: 'lit', LG: 'lit', RA: 'lit', LA: 'lit', RH: 'dgr' },
      '1ht',
    )
    const spec = buildAvatarSpecFromStatstring('so', desc)
    expect(spec.wclass).toBe('1ht')
    expect(spec.layers.rh?.variant).toBe('dgr')
    expect(spec.layers.hd?.variant).toBe('lit')
    expect(spec.layers.sh?.variant).toBeNull()
    expect(spec.layers.s1?.variant).toBeNull()
  })

  it('2. parseMcpAvatarStatstring rejects unknown classes (guard intact)', () => {
    expect(() => parseMcpAvatarStatstring(new Uint8Array(4), 'xx' as never)).toThrow()
  })

  it('2a. class-token torso components (lit/med/hvy statstring encoding) dye via the torso fallback', () => {
    // The BNCS statstring encodes TR/LG/RA/LA/S1/S2 as armor CLASS gfx tokens,
    // not specific base alternategfx (measured live: abSorceress TR='med',
    // LG..S2='hvy', all dpur). Class tokens are absent from Armor.txt, so they
    // must fall back to getLayerTint's torso table (7) instead of staying
    // undyed; the weapon token ('ob4', an orb alternategfx) resolves its real
    // base transtbl (5).
    const desc = {
      ...descWith({ HD: 'msk', TR: 'med', LG: 'hvy', RA: 'hvy', LA: 'hvy', RH: 'ob4', S1: 'hvy', S2: 'hvy' }, '1hs'),
      equippedLayers: [
        { component: 'HD', rawCode: 20, token: 'msk', colorIndex: 18, colorCode: 'dpur', rgb: null },
        { component: 'TR', rawCode: 3, token: 'med', colorIndex: 18, colorCode: 'dpur', rgb: null },
        { component: 'RH', rawCode: 53, token: 'ob4', colorIndex: 18, colorCode: 'dpur', rgb: null },
      ],
    } as unknown as ParsedMcpAvatarStatstring
    const spec = buildAvatarSpecFromStatstring('so', desc)
    expect(spec.armorTint).toEqual({ transform: 5, color: 'dpur' })
    expect(spec.helmTint).toEqual({ transform: 1, color: 'dpur' })
    expect(spec.weaponTint).toEqual({ transform: 5, color: 'dpur' })
    expect(spec.layers.tr).toEqual({ variant: 'med', transform: 5, color: 'dpur' })
    expect(spec.layers.rh).toEqual({ variant: 'ob4', transform: 5, color: 'dpur' })
  })

  it('2b. buildAvatarSpecFromStatstring wires statstring dye codes into layer tints (Tal Rasha dpur parity)', () => {
    // A set-armor sorceress wearing Tal Rasha's (Howling Wind, Lacquered Plate):
    // the statstring TR token is the base's alternategfx 'gth' with the dpur
    // dye byte; the helm ('msk', Death Mask) is dyed too. The char-select
    // paperdoll must resolve the dye's transform from the BASE item table
    // (Armor.txt Transform gth=8, msk=1) exactly like resolveCharacterAppearance
    // does in-game — not a guessed per-slot fallback.
    const desc = {
      ...descWith({ HD: 'msk', TR: 'gth', LG: 'gth', RA: 'gth', LA: 'gth' }, '1ht'),
      equippedLayers: [
        { component: 'TR', rawCode: 30, token: 'gth', colorIndex: 18, colorCode: 'dpur', rgb: [92, 35, 154] },
        { component: 'HD', rawCode: 20, token: 'msk', colorIndex: 18, colorCode: 'dpur', rgb: [92, 35, 154] },
        { component: 'LG', rawCode: 31, token: 'gth', colorIndex: 0, colorCode: null, rgb: null },
      ],
    } as unknown as ParsedMcpAvatarStatstring
    const spec = buildAvatarSpecFromStatstring('so', desc)
    expect(spec.armorTint).toEqual({ transform: 8, color: 'dpur' })
    expect(spec.helmTint).toEqual({ transform: 1, color: 'dpur' })
    expect(spec.shieldTint).toBeNull()
    expect(spec.weaponTint).toBeNull()
    // per-layer: torso carries the dye with the base Transform; an undyed
    // component (LG color byte 0) stays untinted even inside a dyed set look
    expect(spec.layers.tr).toEqual({ variant: 'gth', transform: 8, color: 'dpur' })
    expect(spec.layers.lg).toEqual({ variant: 'gth', transform: 0, color: null })
    expect(spec.layers.hd).toEqual({ variant: 'msk', transform: 1, color: 'dpur' })
  })

  it.skipIf(!packsAvailable)(
    '3. compositor renders a TN clip for an equipped sorceress (rh=dgr, wclass=1ht) from the real layer packs',
    async () => {
      const loader: CharLayerAssetLoader = {
        async loadJson(relPath) {
          return JSON.parse(fs.readFileSync(path.join(charsRoot, 'so', relPath), 'utf8'))
        },
        async loadBin(relPath) {
          return new Uint8Array(fs.readFileSync(path.join(charsRoot, 'so', relPath)))
        },
      }
      const spec = buildAvatarSpecFromStatstring(
        'so',
        descWith({ HD: 'lit', TR: 'lit', LG: 'lit', RA: 'lit', LA: 'lit', RH: 'dgr' }, '1ht'),
      ) as SorceressAppearanceSpec
      const compositor = new SorceressLayerCompositor(loader, 'so')
      const composited = await compositor.composite(spec, ['tn'])
      const tn = composited.clips.tn
      expect(tn).toBeDefined()
      expect(tn!.frames).toBeGreaterThan(0)
      // Menu subset must composite ONLY the requested mode (1/13th the decode
      // cost of the full in-game set — char select cannot wait ~36s).
      expect(Object.keys(composited.clips)).toEqual(['tn'])
      const group = composited.groups[tn!.group]!
      expect(group.length).toBe(tn!.frames)
      // The TN frame region must contain visible pixels (body + weapon layers).
      let opaque = 0
      const [fx, fy, fw, fh] = group[0]!
      for (let py = 0; py < fh; py++) {
        const row = (fy + py) * composited.width
        for (let px = 0; px < fw; px++) {
          if (composited.r8[row + fx + px] !== 0) opaque++
        }
      }
      expect(opaque).toBeGreaterThan(500)

      // #1317: char select only draws direction 0. The compact composite must
      // contain one direction group and a smaller R8 sheet than the full clip.
      const compact = await compositor.composite(spec, ['tn'], { directions: [0] })
      const compactTn = compact.clips.tn!
      expect(compactTn.directions).toBe(1)
      expect(compactTn.group).toBe(0)
      expect(compact.groups).toHaveLength(1)
      expect(compact.width * compact.height).toBeLessThan(composited.width * composited.height)
    },
  )

  it('4. releases non-selected class compositors when entering the game (#1317)', () => {
    const sorceress = getSharedClassLayerCompositor('so')
    const paladin = getSharedClassLayerCompositor('pa')
    expect(getSharedClassLayerCompositor('so')).toBe(sorceress)

    releaseUnselectedAvatarComposites('pa')

    expect(getSharedClassLayerCompositor('pa')).toBe(paladin)
    expect(getSharedClassLayerCompositor('so')).not.toBe(sorceress)
  })
})
