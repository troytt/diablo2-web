/**
 * VFX-B6-p3: Invented Overlay Token & Missile Alias Removal Parity Suite (Issues #1085, #1086).
 *
 * Verifies against 1.13c Ground Truth (`Skills.txt`, `States.txt`, `Overlay.txt`, `Missiles.txt`):
 * - #1085 (B6-13): Assassin Fade (#267) applies State 159 (`fade`), which draws `castoverlay='fade'`
 *   (`expansion/fade`, 20 frames, `preDraw: true`, `trans: 3`, `animRate: 16`) via `STATE_OVERLAYS[159]`,
 *   without attaching an invented `'ethereal'` overlay on client or server. Burst of Speed (#258) removes
 *   state 159 and `'fade'` overlay without referencing `'ethereal'`.
 * - #1086 (B6-14): `'bash'` (`BABash`, 9 frames) and `'firegolem'` (`FireGolemOverlay`, 16 frames) resolve
 *   strictly from `OVERLAY_METAS` / `overlayArtMap` without falling back to `missileArtMap`; `MISSILE_METAS`
 *   contains only genuine `Missiles.txt` row names (no `'bash'`, `'firegolem'`, `'Revive'`, `'SafeArrow'`,
 *   or CelFile/mixed-case alias keys).
 */

import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { celFileArtKey } from '../src/client/render/cel-file-key.ts'
import { MISSILE_METAS } from '../src/client/render/missiles-meta.ts'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import {
  AUTHENTIC_113C_OVERLAYS,
  OVERLAY_METAS,
  STATE_OVERLAYS,
} from '../src/client/render/overlays-meta.ts'
import type { AtlasHandle, SpriteRenderer } from '../src/client/render/renderer.ts'
import type { LoadedOverlayArt } from '../src/client/scene/missile-overlay-renderer.ts'
import { clearMissingArtEntries, getMissingArtEntries } from '../src/client/scene/missing-art.ts'
import { drawSceneOverlayDrawable } from '../src/client/scene/world-renderer.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import type { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { createActiveOverlay } from '../src/common/skills/missiles-data.ts'
import { castSkill } from '../src/server/skills/skills.ts'

const EXCEL_DIR =
  join(homedir(), 'd2-data', 'excel')

const OVERLAY_TXT_NAME_SET: ReadonlySet<string> = new Set(
  OVERLAY_TXT_ROWS.map((r) => r.name.trim().toLowerCase()),
)

function createPlayerWorld(charClass: number, name: string, x = 100, y = 100): {
  world: ClientWorld
  caster: ClientUnit
} {
  const world = new ClientWorld()
  world.apply({ type: 'PlayerAssign', unitId: 1, charClass, name, x, y })
  const caster = world.getUnit('player', 1)!
  return { world, caster }
}

function makeServerCasterEnv(charClass = 'ass') {
  const overlays: any[] = []
  const projectiles: any[] = []
  const explosions: any[] = []
  const events: any[] = []
  const monster: any = {
    index: 0,
    x: 120,
    y: 120,
    hp: 2000,
    maxHp: 2000,
    state: 'idle',
    stats: { id: 'skeleton1', name: 'Skeleton', exp: 50 },
    states: new Set<number>(),
  }
  const player: any = {
    x: 100,
    y: 100,
    hp: 400,
    maxHp: 500,
    mana: 200,
    maxMana: 250,
    stamina: 200,
    maxStamina: 200,
    cooldown: 0,
    charClass,
    strength: 80,
    dexterity: 80,
    isDualClaw: true,
    states: new Set<number>(),
  }
  const engine: any = {
    world: {
      tick: 100,
      player,
      monsters: [monster],
      events,
    },
    overlays,
    projectiles,
    explosions,
    metrics: { casts: 0, playerHits: 0 },
    spawnOverlay(name: string, pos: { x: number; y: number }, casterId?: string, opts?: any) {
      const ov = createActiveOverlay(name, pos, casterId ?? 'player', undefined, opts)
      overlays.push({ type: name, ...ov, pos, casterId, opts })
    },
  }
  const hudManager: any = {
    lang: 'ENG',
    getSkillLevel: () => 5,
    getBaseSkillLevel: () => 5,
  }
  const status = { textContent: '' }
  return { engine, player, monster, overlays, projectiles, explosions, status, hudManager }
}

function buildEmulatedOverlayArtMap(): Map<string, LoadedOverlayArt> {
  const map = new Map<string, LoadedOverlayArt>()
  const handleByCel = new Map<string, AtlasHandle>()
  let nextHandle = 1
  for (const [key, meta] of Object.entries(OVERLAY_METAS)) {
    const celKey =
      meta.celFile && meta.celFile.toLowerCase() !== 'null'
        ? celFileArtKey(meta.celFile)
        : `name:${meta.name.toLowerCase()}`
    let handle = handleByCel.get(celKey)
    if (handle === undefined) {
      handle = (nextHandle++) as unknown as AtlasHandle
      handleByCel.set(celKey, handle)
    }
    const frames = meta.groups.map((group) =>
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

describe('VFX-B6-p3: Invented Overlay Token & Missile Alias Removal (#1085, #1086)', () => {
  describe("#1085 (B6-13): Assassin Fade (#267) uses real 'fade' overlay via State 159 and never attaches invented 'ethereal'", () => {
    it("Overlay.txt has 'fade' (expansion/fade, 20 frames in Overlay.txt / 15 DCC frames, preDraw=true) and no 'ethereal' row", () => {
      expect(OVERLAY_TXT_NAME_SET.has('fade')).toBe(true)
      expect(OVERLAY_TXT_NAME_SET.has('ethereal')).toBe(false)
      expect(OVERLAY_METAS['ethereal']).toBeUndefined()

      const fadeMeta = OVERLAY_METAS['fade']
      expect(fadeMeta).toBeDefined()
      expect(fadeMeta!.celFile.replace(/\\/g, '/').toLowerCase()).toBe('expansion/fade')
      expect(fadeMeta!.frames).toBe(15)
      expect(fadeMeta!.framesPerDirection).toBe(15)
      expect(fadeMeta!.animRate).toBe(16)
      expect(fadeMeta!.trans).toBe(3)
      expect(fadeMeta!.preDraw).toBe(true)
      expect(AUTHENTIC_113C_OVERLAYS['fade']?.frames).toBe(20)
      expect(AUTHENTIC_113C_OVERLAYS['fade']?.preDraw).toBe(true)

      expect(STATE_OVERLAYS[159]).toContain('fade')
    })

    it("casting Fade (#267) applies state 159, produces a single 'fade' drawable, attaches no 'ethereal' on client or server, and raises no reportMissingArt", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(6, 'Assassin', 100, 100)

      // First cast Burst of Speed (#258) to verify mutual exclusion
      ;(world as any).applySkillCastToUnit(caster, 258, caster.x, caster.y, 5)
      expect(caster.states.has(157)).toBe(true)
      expect(caster.overlays.map((o) => o.token)).toEqual(['quickness'])

      // Cast Fade (#267): removes state 157 & 'quickness', adds state 159, attaches no 'ethereal'
      ;(world as any).applySkillCastToUnit(caster, 267, caster.x, caster.y, 5)
      expect(caster.states.has(157)).toBe(false)
      expect(caster.states.has(159)).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'ethereal')).toBe(false)
      expect(caster.overlays).toHaveLength(0)

      // buildSceneDrawables emits 'fade' from STATE_OVERLAYS[159]
      const drawables = buildSceneDrawables([caster])
      expect(drawables.overlayDrawables).toHaveLength(1)
      expect(drawables.overlayDrawables[0]!.token).toBe('fade')
      expect(drawables.overlayDrawables[0]!.preDraw).toBe(true)

      // Re-casting Burst of Speed (#258) removes state 159 and 'fade'
      ;(world as any).applySkillCastToUnit(caster, 258, caster.x, caster.y, 5)
      expect(caster.states.has(159)).toBe(false)
      expect(caster.states.has(157)).toBe(true)
      expect(caster.overlays.map((o) => o.token)).toEqual(['quickness'])

      // Server castSkill(267) spawns 'fade' and never 'ethereal'
      const srvAss = makeServerCasterEnv('ass')
      expect(
        castSkill(267, srvAss.player.x, srvAss.player.y, {
          engine: srvAss.engine,
          hudManager: srvAss.hudManager,
          status: srvAss.status,
        } as any),
      ).toBe(true)
      expect(srvAss.overlays.some((o) => o.type === 'ethereal')).toBe(false)
      expect(srvAss.overlays.map((o) => o.type)).toEqual(['fade'])
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe("#1086 (B6-14): 'bash' and 'firegolem' overlays resolve to BABash (9 frames) and FireGolemOverlay (16 frames) with zero missile alias pollution", () => {
    it("resolves 'bash' to BABash (9 frames) and 'firegolem' to FireGolemOverlay (16 frames) in OVERLAY_METAS, with neither present in MISSILE_METAS", () => {
      const bash = OVERLAY_METAS['bash']
      expect(bash).toBeDefined()
      expect(bash!.celFile).toBe('BABash')
      expect(bash!.frames).toBe(9)
      expect(bash!.framesPerDirection).toBe(9)
      expect(bash!.animRate).toBe(16)
      expect(bash!.trans).toBe(3)
      expect(AUTHENTIC_113C_OVERLAYS['bash']?.filename).toBe('BABash')

      const firegolem = OVERLAY_METAS['firegolem']
      expect(firegolem).toBeDefined()
      expect(firegolem!.celFile).toBe('FireGolemOverlay')
      expect(firegolem!.frames).toBe(16)
      expect(firegolem!.framesPerDirection).toBe(16)
      expect(firegolem!.animRate).toBe(10)
      expect(firegolem!.trans).toBe(3)
      expect(AUTHENTIC_113C_OVERLAYS['firegolem']?.filename).toBe('FireGolemOverlay')

      expect(MISSILE_METAS['bash']).toBeUndefined()
      expect(MISSILE_METAS['firegolem']).toBeUndefined()
      expect(MISSILE_METAS['Revive']).toBeUndefined()
      expect(MISSILE_METAS['revive']).toBeUndefined()
      expect(MISSILE_METAS['SafeArrow']).toBeUndefined()
      expect(MISSILE_METAS['safearrow']).toBeUndefined()
    })

    it("drawSceneOverlayDrawable draws 'bash', 'firegolem', and 'fade' from overlayArtMap and never touches missileArtMap", () => {
      clearMissingArtEntries()
      const overlayArtMap = buildEmulatedOverlayArtMap()
      const drawnAtlases: AtlasHandle[] = []
      const mockRenderer = {
        draw: (_frame: unknown, _x: number, _y: number, opts?: { atlas?: AtlasHandle }) => {
          if (opts?.atlas !== undefined) drawnAtlases.push(opts.atlas)
        },
      } as unknown as SpriteRenderer

      const poisonHandle = 999999 as unknown as AtlasHandle
      const poisonMissileMap = new Map([
        [
          'bash',
          {
            meta: MISSILE_METAS['arrow']!,
            handle: poisonHandle,
            frames: [[{ x: 0, y: 0, width: 10, height: 10 }]],
          },
        ],
        [
          'firegolem',
          {
            meta: MISSILE_METAS['monstercorpseexplode']!,
            handle: poisonHandle,
            frames: [[{ x: 0, y: 0, width: 10, height: 10 }]],
          },
        ],
      ])

      for (const token of ['bash', 'firegolem', 'fade'] as const) {
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
            preDraw: OVERLAY_METAS[token]!.preDraw,
            blendMode: 'additive',
            xOffset: 0,
            subX: 10,
            subY: 10,
            worldX: 100,
            worldY: 100,
            sortY: 100,
          } as any,
          {
            overlayArtMap,
            missileArtMap: poisonMissileMap as any,
          } as any,
          0,
        )
        expect(drawnAtlases).toEqual([expectedHandle])
        expect(drawnAtlases).not.toContain(poisonHandle)
      }
      expect(getMissingArtEntries()).toEqual([])
    })

    it('every key in MISSILE_METAS is an exact lowercase 1.13c Missiles.txt row name', () => {
      const lines = readFileSync(resolve(EXCEL_DIR, 'Missiles.txt'), 'utf-8').split(/\r?\n/)
      const headers = lines[0]!.split('\t').map((h) => h.trim().toLowerCase())
      const missileIdx = headers.indexOf('missile')
      expect(missileIdx).toBeGreaterThanOrEqual(0)

      const validMissileRows = new Set<string>()
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split('\t')
        const name = (cols[missileIdx] ?? '').trim().toLowerCase()
        if (name && name !== 'expansion') {
          validMissileRows.add(name)
        }
      }

      const bogusKeys: string[] = []
      for (const key of Object.keys(MISSILE_METAS)) {
        if (key !== key.toLowerCase() || !validMissileRows.has(key)) {
          bogusKeys.push(key)
        }
      }
      expect(bogusKeys).toEqual([])
    })
  })
})
