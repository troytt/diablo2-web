/**
 * VFX-B6-p2: Invented Overlay Token Removal & 1.13c Parity Suite (Issues #1079–#1084).
 *
 * Verifies against 1.13c Ground Truth (`Skills.txt`, `States.txt`, `Overlay.txt`, `D2Client.dll`, `D2Game.dll`):
 * - #1079 (B6-7): Bash (#126) attaches no 'bash' overlay to target ('bash' srvoverlay belongs exclusively to Leap Attack #143);
 *   Stun (#139) adds state 21 without duplicating 'stun' in unit.overlays so state 21 produces exactly one 'stun' drawable.
 * - #1080 (B6-8): Concentrate (#144) attaches Skills.txt srvoverlay='doubledamage1' (impacting01, 4 frames) to the hit target.
 * - #1081 (B6-9): Cyclone Armor (#235) attaches no cyclonearmor1back on client or server; drawn overlays come solely from state 151
 *   (staged cyclonearmor1front / cyclonearmor2front / cyclonearmor3front via StateSetFunc[8] 0x6FB23090).
 * - #1082 (B6-10): Hunger (#242) attaches no overlay ('stealskull' is not an Overlay.txt row) and emits no reportMissingArt.
 * - #1083 (B6-11): Assassin Martial Arts charge-up skills (#254, #265, #280, #259, #274, #269) attach only genuine Overlay.txt
 *   tokens (progressive_*_1..3, tigerstrike1..3, cobrastrike1..3) and never chargeup* / Stealup* / Royalup* / Fireup* / Coldup* / Lightup*.
 * - #1084 (B6-12): Cloak of Shadows (#264) adds state 153 (cloak_of_shadows, no overlay) on caster and state 156 (cloaked) on
 *   hostile monsters within 30 sub-tiles; caster has no 'cloaked' drawable, and affected monsters have exactly one 'cloaked' drawable
 *   and no 'blindaura'.
 */

import { describe, expect, it } from 'vitest'
import { OVERLAY_TXT_ROWS } from '../src/client/render/overlay-txt-rows.ts'
import { OVERLAY_METAS, STATE_OVERLAYS } from '../src/client/render/overlays-meta.ts'
import { clearMissingArtEntries, getMissingArtEntries } from '../src/client/scene/missing-art.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import type { ClientUnit } from '../src/client/world/client-unit.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { createActiveOverlay } from '../src/common/skills/missiles-data.ts'
import { castSkill } from '../src/server/skills/skills.ts'

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

function addHostileMonster(
  world: ClientWorld,
  id: number,
  x: number,
  y: number,
  classId = 1,
): ClientUnit {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 1, id, classId, x, y, lifePct: 128, mode: 1 },
  } as any)
  return world.getUnit('monster', id)!
}

function makeServerCasterEnv(charClass = 'bar') {
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

describe('VFX-B6-p2: Invented Overlay Token Removal & 1.13c Parity (#1079–#1084)', () => {
  describe("#1079 (B6-7): Bash (#126) attaches no 'bash' overlay; Leap Attack (#143) attaches 'bash'; Stun (#139) does not duplicate 'stun'", () => {
    it("Bash (#126) adds no overlay to the target while Leap Attack (#143) still adds 'bash' on client and server", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(4, 'Barbarian', 100, 100)
      const target = addHostileMonster(world, 201, 102, 100)

      // 1. Bash (#126): no overlay on target or caster
      ;(world as any).spawnMissilesForSkill(caster, 126, target.x, target.y, 5)
      expect(target.overlays).toHaveLength(0)
      expect(caster.overlays).toHaveLength(0)

      const srvBash = makeServerCasterEnv('bar')
      expect(
        castSkill(126, srvBash.monster.x, srvBash.monster.y, {
          engine: srvBash.engine,
          hudManager: srvBash.hudManager,
          status: srvBash.status,
        } as any),
      ).toBe(true)
      expect(srvBash.overlays.some((o) => o.type === 'bash')).toBe(false)

      // 2. Leap Attack (#143): srvoverlay='bash' is server-authoritative (Issue #1167) — the client never
      //    attaches 'bash' locally (it arrives via the server overlay packet); the server attaches it on hit.
      ;(world as any).spawnMissilesForSkill(caster, 143, target.x, target.y, 5)
      expect(target.overlays.map((o) => o.token)).not.toContain('bash')

      const srvLeapAttack = makeServerCasterEnv('bar')
      expect(
        castSkill(143, srvLeapAttack.monster.x, srvLeapAttack.monster.y, {
          engine: srvLeapAttack.engine,
          hudManager: srvLeapAttack.hudManager,
          status: srvLeapAttack.status,
        } as any),
      ).toBe(true)
      expect(srvLeapAttack.overlays.some((o) => o.type === 'bash')).toBe(true)
      expect(getMissingArtEntries()).toEqual([])
    })

    it("Stun (#139) sets state 21 without manual attachUnitOverlay('stun'), producing exactly one 'stun' drawable", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(4, 'Barbarian', 100, 100)
      const target = addHostileMonster(world, 202, 102, 100)

      ;(world as any).spawnMissilesForSkill(caster, 139, target.x, target.y, 5)
      expect(target.states.has(21)).toBe(true)
      expect(target.overlays).toHaveLength(0)

      const drawables = buildSceneDrawables([target])
      expect(drawables.overlayDrawables).toHaveLength(1)
      expect(drawables.overlayDrawables[0]!.token).toBe('stun')
      expect(drawables.overlayDrawables[0]!.totalFrames).toBe(12)
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe("#1080 (B6-8): Concentrate (#144) attaches srvoverlay 'doubledamage1' to the hit target", () => {
    it("attaches 'doubledamage1' (impacting01, 4 frames) to the target monster on a Concentrate hit on client and server", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(4, 'Barbarian', 100, 100)
      const target = addHostileMonster(world, 301, 102, 100)

      ;(world as any).spawnMissilesForSkill(caster, 144, target.x, target.y, 5)
      expect(caster.states.has(15)).toBe(true)
      expect(target.overlays.map((o) => o.token)).toEqual(['doubledamage1'])
      expect(target.overlays[0]!.totalFrames).toBe(4)
      expect(target.overlays[0]!.loop).toBe(false)
      expect(OVERLAY_METAS['doubledamage1']?.celFile).toBe('impacting01')

      const srvConc = makeServerCasterEnv('bar')
      expect(
        castSkill(144, srvConc.monster.x, srvConc.monster.y, {
          engine: srvConc.engine,
          hudManager: srvConc.hudManager,
          status: srvConc.status,
        } as any),
      ).toBe(true)
      expect(srvConc.overlays.some((o) => o.type === 'doubledamage1')).toBe(true)
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe('#1081 (B6-9): Cyclone Armor (#235) attaches no cyclonearmor1back on client or server; drawn overlays come solely from state 151', () => {
    it('casting Cyclone Armor attaches no cyclonearmor1back and draws staged front overlays from state 151 only', () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(5, 'Druid', 100, 100)

      // Client applySkillCastToUnit & spawnMissilesForSkill
      ;(world as any).applySkillCastToUnit(caster, 235, caster.x, caster.y, 5)
      ;(world as any).spawnMissilesForSkill(caster, 235, caster.x, caster.y, 5)

      expect(caster.states.has(151)).toBe(true)
      expect(caster.overlays.some((o) => o.token === 'cyclonearmor1back')).toBe(false)
      expect(caster.overlays).toHaveLength(0)

      // State 151 draws cumulative back+front overlays via StateSetFunc[8] (full -> 1..3 back+front, mid -> 1..2 back+front, low -> 1 back+front)
      ;(caster as any).cycloneArmorAbsorb = 100
      ;(caster as any).cycloneArmorMaxAbsorb = 100
      expect(buildSceneDrawables([caster]).overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
        'cyclonearmor3back',
        'cyclonearmor3front',
      ])

      ;(caster as any).cycloneArmorAbsorb = 50
      expect(buildSceneDrawables([caster]).overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
      ])

      ;(caster as any).cycloneArmorAbsorb = 20
      expect(buildSceneDrawables([caster]).overlayDrawables.map((d) => d.token)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
      ])

      // Server castSkill(235) spawns no cyclonearmor1back
      const srvDruid = makeServerCasterEnv('dru')
      expect(
        castSkill(235, 100, 100, {
          engine: srvDruid.engine,
          hudManager: srvDruid.hudManager,
          status: srvDruid.status,
        } as any),
      ).toBe(true)
      expect(srvDruid.overlays.some((o) => o.type === 'cyclonearmor1back')).toBe(false)
      expect(srvDruid.overlays).toHaveLength(0)
      expect(srvDruid.player.states.has(151)).toBe(true)
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe("#1082 (B6-10): Hunger (#242) attaches no invented 'stealskull' overlay", () => {
    it("attaches no overlay on client or server and raises no reportMissingArt for 'stealskull'", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(5, 'Druid', 100, 100)
      const target = addHostileMonster(world, 401, 102, 100)

      ;(world as any).spawnMissilesForSkill(caster, 242, target.x, target.y, 5)
      expect(caster.overlays).toHaveLength(0)
      expect(target.overlays).toHaveLength(0)
      expect(OVERLAY_TXT_NAME_SET.has('stealskull')).toBe(false)

      const srvDruid = makeServerCasterEnv('dru')
      srvDruid.player.druidForm = 'wolf'
      expect(
        castSkill(242, srvDruid.monster.x, srvDruid.monster.y, {
          engine: srvDruid.engine,
          hudManager: srvDruid.hudManager,
          status: srvDruid.status,
        } as any),
      ).toBe(true)
      expect(srvDruid.overlays.some((o) => o.type === 'stealskull')).toBe(false)
      expect(srvDruid.overlays).toHaveLength(0)
      expect(getMissingArtEntries()).toEqual([])
    })
  })

  describe('#1083 (B6-11): Assassin Martial Arts charge-up skills (#254, #265, #280, #259, #274, #269) attach only genuine Overlay.txt tokens', () => {
    it('charging any Martial Arts skill across charges 1..3 attaches only tokens present in Overlay.txt and raises no reportMissingArt', () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(6, 'Assassin', 100, 100)
      const target = addHostileMonster(world, 501, 102, 100)

      const chargeSkills = [254, 265, 280, 259, 274, 269] as const
      const bogusPrefixes = ['chargeup', 'stealup', 'royalup', 'fireup', 'coldup', 'lightup']

      for (const skillId of chargeSkills) {
        for (let hit = 1; hit <= 3; hit++) {
          ;(world as any).applySkillCastToUnit(caster, skillId, target.x, target.y, 5)
          for (const ov of caster.overlays) {
            const lower = ov.token.toLowerCase()
            expect(
              OVERLAY_TXT_NAME_SET.has(lower),
              `skill #${skillId} charge ${hit} attached non-Overlay.txt token '${ov.token}'`,
            ).toBe(true)
            for (const bad of bogusPrefixes) {
              expect(lower.startsWith(bad)).toBe(false)
            }
          }
          // Verify buildSceneDrawables raises no missing-art entries for caster or target
          buildSceneDrawables([caster, target])
          expect(getMissingArtEntries()).toEqual([])
        }

        // Server castSkill also spawns only genuine Overlay.txt tokens
        const srvAss = makeServerCasterEnv('ass')
        expect(
          castSkill(skillId, srvAss.monster.x, srvAss.monster.y, {
            engine: srvAss.engine,
            hudManager: srvAss.hudManager,
            status: srvAss.status,
          } as any),
        ).toBe(true)
        for (const ov of srvAss.overlays) {
          const lower = String(ov.type).toLowerCase()
          expect(OVERLAY_TXT_NAME_SET.has(lower)).toBe(true)
          for (const bad of bogusPrefixes) {
            expect(lower.startsWith(bad)).toBe(false)
          }
        }
      }
    })
  })

  describe("#1084 (B6-12): Cloak of Shadows (#264) attaches no 'cloaked' to caster and no invented 'blindaura' to monsters", () => {
    it("caster has no 'cloaked' drawable and affected monsters have exactly one 'cloaked' drawable from state 156 and no 'blindaura'", () => {
      clearMissingArtEntries()
      const { world, caster } = createPlayerWorld(6, 'Assassin', 100, 100)
      const nearMon = addHostileMonster(world, 601, 110, 100) // dist 10 <= 30
      const edgeMon = addHostileMonster(world, 602, 125, 100) // dist 25 <= 30
      const farMon = addHostileMonster(world, 603, 140, 100) // dist 40 > 30

      ;(world as any).applySkillCastToUnit(caster, 264, caster.x, caster.y, 5)

      // Caster has state 153 (cloak_of_shadows, no overlay) and no 'cloaked' overlay or drawable
      expect(caster.states.has(153)).toBe(true)
      expect(STATE_OVERLAYS[153]).toBeUndefined()
      expect(caster.overlays.some((o) => o.token === 'cloaked')).toBe(false)
      expect(buildSceneDrawables([caster]).overlayDrawables).toHaveLength(0)

      // Affected monsters within 30 sub-tiles have state 156 (cloaked), no 'blindaura' overlay, and exactly 1 'cloaked' drawable
      for (const m of [nearMon, edgeMon]) {
        expect(m.states.has(156)).toBe(true)
        expect(m.overlays.some((o) => o.token === 'blindaura')).toBe(false)
        expect(m.overlays).toHaveLength(0)
        const monDrawables = buildSceneDrawables([m]).overlayDrawables
        expect(monDrawables).toHaveLength(1)
        expect(monDrawables[0]!.token).toBe('cloaked')
        expect(monDrawables[0]!.totalFrames).toBe(16)
      }

      // Monster beyond 30 sub-tiles is unaffected
      expect(farMon.states.has(156)).toBe(false)
      expect(buildSceneDrawables([farMon]).overlayDrawables).toHaveLength(0)

      // Server castSkill(264) spawns neither 'cloaked' on caster nor 'blindaura' on monsters
      const srvAss = makeServerCasterEnv('ass')
      expect(
        castSkill(264, 100, 100, {
          engine: srvAss.engine,
          hudManager: srvAss.hudManager,
          status: srvAss.status,
        } as any),
      ).toBe(true)
      expect(srvAss.overlays.some((o) => o.type === 'cloaked' && o.casterId === 'player')).toBe(false)
      expect(srvAss.overlays.some((o) => o.type === 'blindaura')).toBe(false)
      expect(srvAss.monster.states.has(156)).toBe(true)
      expect(srvAss.monster.curse?.overlayName).toBe('cloaked')
      expect(OVERLAY_TXT_NAME_SET.has('blindaura')).toBe(false)
      expect(getMissingArtEntries()).toEqual([])
    })
  })
})
