import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import {
  MINDBLAST_CENTER_CLT_PARAM1_113C,
  MINDBLAST_CENTER_RANGE_113C,
  MINDBLAST_VISUAL_RADIUS_113C,
} from '../src/client/world/curse-center-113c.ts'
import { computeSrvDo039ScatterPoints113c } from '../src/client/world/world-skill-missiles.ts'
import { castSkill } from '../src/server/skills/skills.ts'

function createAssassinWorld() {
  const cw = new ClientWorld()
  cw.selfId = 1
  ;(cw.self as any).charClass = 6
  const selfUnit = (cw as any).ensureUnit('player', 1)
  selfUnit.classId = 6
  selfUnit.x = 50
  selfUnit.y = 50
  return { cw, selfUnit }
}

function addHostileMonster(cw: ClientWorld, id: number, x: number, y: number) {
  cw.apply({
    type: 'UnitAssign',
    isSelf: false,
    unit: {
      unitType: 'monster',
      id,
      classId: 1,
      name: `Fallen_${id}`,
      x,
      y,
      lifePct: 128,
      mode: 1,
    },
  } as any)
  return cw.getUnit('monster', id)!
}

function listMissiles(cw: ClientWorld): any[] {
  return Array.from((cw as any)._units.values()).filter((u: any) => u.unitType === 'missile')
}

describe('B15-p2 Assassin Spell VFX 1.13c Parity (#1154..#1159)', () => {
  describe('#1154 (B15-7): FoF (#259) / BoI (#274) Charge-3 SrvDo039 / CltDoFunc[9] disk scatter', () => {
    it('scatters fistsoffirefirewall (1 < k <= 16) within radius 4 sub-tiles on FoF charge-3 release', () => {
      const { cw, selfUnit } = createAssassinWorld()
      addHostileMonster(cw, 101, 52, 52)
      selfUnit.seed.lo = 12345
      selfUnit.seed.hi = 666

      // Charge #259 Fists of Fire 3 times
      ;(cw as any).applySkillCastToUnit(selfUnit, 259, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 259, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 259, 52, 52, 1)
      expect((selfUnit as any).chargeCounts.get(259)).toBe(3)

      // Release with Normal Attack (0)
      ;(cw as any).applySkillCastToUnit(selfUnit, 0, 52, 52, 1)
      const firewalls = listMissiles(cw).filter((m) => m.missileKey === 'fistsoffirefirewall')
      expect(firewalls.length).toBeGreaterThan(1)
      expect(firewalls.length).toBeLessThanOrEqual(16)
      for (const fw of firewalls) {
        const dx = fw.x - 52
        const dy = fw.y - 52
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(16)
      }
    })

    it('scatters bladesoficecubes (1 < k <= 9) within radius 3 sub-tiles on BoI charge-3 release', () => {
      const { cw, selfUnit } = createAssassinWorld()
      addHostileMonster(cw, 101, 52, 52)
      selfUnit.seed.lo = 54321
      selfUnit.seed.hi = 666

      // Charge #274 Blades of Ice 3 times
      ;(cw as any).applySkillCastToUnit(selfUnit, 274, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 274, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 274, 52, 52, 1)
      expect((selfUnit as any).chargeCounts.get(274)).toBe(3)

      // Release with Normal Attack (0)
      ;(cw as any).applySkillCastToUnit(selfUnit, 0, 52, 52, 1)
      const cubes = listMissiles(cw).filter((m) => m.missileKey === 'bladesoficecubes')
      expect(cubes.length).toBeGreaterThan(1)
      expect(cubes.length).toBeLessThanOrEqual(9)
      for (const c of cubes) {
        const dx = c.x - 52
        const dy = c.y - 52
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(9)
      }
      // computeSrvDo039ScatterPoints113c directly enforces r^2 attempts
      const pts = computeSrvDo039ScatterPoints113c(10, 20, 3, { lo: 1, hi: 666 })
      expect(pts.length).toBeGreaterThan(1)
      expect(pts.length).toBeLessThanOrEqual(9)
    })
  })

  describe('#1155 (B15-8): Phoenix Strike (#280) Charge-1 meteor center vs ground fire timing', () => {
    it('spawns only royalstrikemeteorcenter at release and spawns royalstrikemeteorfire only on meteor impact', () => {
      const { cw, selfUnit } = createAssassinWorld()
      addHostileMonster(cw, 101, 52, 52)

      // Charge #280 Phoenix Strike once (Charge 1 = meteor)
      ;(cw as any).applySkillCastToUnit(selfUnit, 280, 52, 52, 1)
      expect((selfUnit as any).chargeCounts.get(280)).toBe(1)

      // Release with Normal Attack (0)
      ;(cw as any).applySkillCastToUnit(selfUnit, 0, 52, 52, 1)

      // Immediately after release: royalstrikemeteorcenter exists, NO royalstrikemeteorfire yet
      expect(listMissiles(cw).filter((m) => m.missileKey === 'royalstrikemeteorcenter')).toHaveLength(1)
      expect(listMissiles(cw).filter((m) => m.missileKey === 'royalstrikemeteorfire')).toHaveLength(0)

      // Step world past the 60-tick meteor descent
      const center = listMissiles(cw).find((m) => m.missileKey === 'royalstrikemeteorcenter')!
      for (let t = 0; t < 65; t++) {
        ;(cw as any).stepMissileUnit(center)
      }
      const fires = listMissiles(cw).filter((m) => m.missileKey === 'royalstrikemeteorfire')
      expect(fires.length).toBeGreaterThan(0)
    })
  })

  describe('#1156 (B15-9): Dragon Tail (#270) spawns only dragontail missile and no caster overlay', () => {
    it('spawns dragontail missile without fireexplode and does not attach assassinfootimpact to caster', () => {
      const { cw, selfUnit } = createAssassinWorld()
      addHostileMonster(cw, 101, 52, 52)

      ;(cw as any).applySkillCastToUnit(selfUnit, 270, 52, 52, 1)

      const mKeys = listMissiles(cw).map((m) => m.missileKey)
      expect(mKeys).toEqual(['dragontail missile'])
      expect(mKeys).not.toContain('fireexplode')
      expect(selfUnit.overlays.some((o: any) => o.token === 'assassinfootimpact')).toBe(false)
    })
  })

  describe('#1157 (B15-10): Dragon Flight (#275) attaches tgtoverlay dragonflight to target, not caster', () => {
    it('attaches dragonflight overlay to the kicked target monster and keeps caster without dragonflight', () => {
      const { cw, selfUnit } = createAssassinWorld()
      const targetMon = addHostileMonster(cw, 101, 60, 60)

      ;(cw as any).applySkillCastToUnit(selfUnit, 275, 60, 60, 1)

      expect(targetMon.overlays.some((o: any) => o.token === 'dragonflight')).toBe(true)
      expect(selfUnit.overlays.some((o: any) => o.token === 'dragonflight')).toBe(false)
      // Caster position on client is server-authoritative (not teleported locally by applySkillCastToUnit)
      expect(selfUnit.x).toBe(50)
      expect(selfUnit.y).toBe(50)
    })
  })

  describe('#1158 (B15-11): Tiger Strike (#254) / Cobra Strike (#265) finisher release does not attach assassinfootimpact to caster', () => {
    it('leaves caster without assassinfootimpact overlay when releasing Tiger/Cobra charges', () => {
      const { cw, selfUnit } = createAssassinWorld()
      const targetMon = addHostileMonster(cw, 101, 52, 52)

      // Charge #254 Tiger Strike & #265 Cobra Strike
      ;(cw as any).applySkillCastToUnit(selfUnit, 254, 52, 52, 1)
      ;(cw as any).applySkillCastToUnit(selfUnit, 265, 52, 52, 1)
      // Target gets assassinfootimpact on Tiger Strike hit
      expect(targetMon.overlays.some((o: any) => o.token === 'assassinfootimpact')).toBe(true)
      expect(selfUnit.overlays.some((o: any) => o.token === 'assassinfootimpact')).toBe(false)

      // Release charges with Normal Attack (0)
      ;(cw as any).applySkillCastToUnit(selfUnit, 0, 52, 52, 1)
      expect(selfUnit.overlays.some((o: any) => o.token === 'assassinfootimpact')).toBe(false)
    })
  })

  describe('#1159 (B15-12): Mind Blast (#273) spawns mindblast center + mindblast hit, attaches fist_will_cast, removes mindblast_hit', () => {
    it('spawns mindblast center and mindblast hit children, attaches fist_will_cast to targets, and has zero mindblast_hit in src', () => {
      const { cw, selfUnit } = createAssassinWorld()
      const hitMon = addHostileMonster(cw, 101, 61, 61)
      const farMon = addHostileMonster(cw, 102, 80, 80)

      ;(cw as any).spawnMissilesForSkill(selfUnit, 273, 60, 60, 5)

      const centers = listMissiles(cw).filter((m) => m.missileKey === 'mindblast center')
      expect(centers).toHaveLength(1)
      const center = centers[0]!
      expect(center.curseSubMissileKey).toBe('mindblast hit')
      expect(center.curseVisualRadius).toBe(MINDBLAST_VISUAL_RADIUS_113C)
      expect(center.maxTicks).toBe(MINDBLAST_CENTER_RANGE_113C)
      expect(MINDBLAST_CENTER_CLT_PARAM1_113C).toBe(10)

      const hitsWave0 = listMissiles(cw).filter((m) => m.missileKey === 'mindblast hit')
      expect(hitsWave0.length).toBeGreaterThan(0)
      for (const h of hitsWave0) {
        expect(Math.hypot(h.x - 60, h.y - 60)).toBeLessThanOrEqual(4)
      }

      // Stepping mindblast center ticks 0..9 fires waves on elapsed 0 (already fired), 3, 6, 9
      for (let t = 0; t < 10; t++) {
        ;(cw as any).stepMissileUnit(center)
      }
      const hitsAfter = listMissiles(cw).filter((m) => m.missileKey === 'mindblast hit')
      expect(hitsAfter.length).toBeGreaterThan(hitsWave0.length)

      // Target overlays: fist_will_cast + stun on hitMon, none on farMon or caster, never mindblast_hit
      expect(hitMon.overlays.some((o: any) => o.token === 'fist_will_cast')).toBe(true)
      expect(hitMon.overlays.some((o: any) => o.token === 'stun')).toBe(true)
      expect(hitMon.overlays.some((o: any) => o.token === 'mindblast_hit')).toBe(false)
      expect(farMon.overlays.some((o: any) => o.token === 'fist_will_cast')).toBe(false)
      expect(selfUnit.overlays.some((o: any) => o.token === 'fist_will_cast')).toBe(false)

      // Server scene skill-caster also attaches fist_will_cast and never mindblast_hit
      const serverOverlays: { type: string; target?: string | undefined }[] = []
      const monster: any = { index: 0, x: 100, y: 100, hp: 200, maxHp: 200, state: 'idle', stats: { id: 'fallen' } }
      const engine: any = {
        world: { player: { x: 80, y: 80, mana: 100, maxMana: 100, cooldown: 0 }, monsters: [monster], events: [], tick: 1 },
        overlays: serverOverlays,
        projectiles: [],
        explosions: [],
        metrics: { casts: 0, playerHits: 0, castHits: 0 },
        spawnOverlay(type: string, _pos: { x: number; y: number }, target?: string) {
          serverOverlays.push({ type, target })
        },
      }
      const ok = castSkill(273, 100, 100, {
        engine,
        hudManager: { lang: 'ENG', getSkillLevel: () => 5, getBaseSkillLevel: () => 5 },
        status: { textContent: '' },
      } as any)
      expect(ok).toBe(true)
      expect(serverOverlays.some((o) => o.type === 'fist_will_cast')).toBe(true)
      expect(serverOverlays.some((o) => o.type === 'mindblast_hit')).toBe(false)

      // git grep mindblast_hit in src returns nothing
      let grepOut = ''
      try {
        grepOut = execFileSync('git', ['grep', 'mindblast_hit', 'src'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        })
      } catch {
        grepOut = ''
      }
      expect(grepOut.trim()).toBe('')
    })
  })
})
