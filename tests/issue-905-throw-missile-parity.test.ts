/**
 * Issue #905 — inherent throw skills must match the equipped throwing weapon,
 * and the actor must stay visible during the TH (PlrMode 11) animation.
 *
 * Ground truth:
 * - 1.13c Skills.txt: skills 2 (Throw) / 4 (Left Hand Throw) carry NO
 *   srv/cltmissilea (srvdofunc 3/5); D2Game derives the missile from the
 *   equipped weapon's Weapons.txt type:
 *     tkni (tkf/bkf/7tk/7bk)        → throwknife  (Missiles.txt id 36, MissileDagger)
 *     taxe (tax/bal/7ta/7b8)        → throwaxe    (Missiles.txt id 35, MissileHandAxe)
 *     jave/ajav (jav/.../am5/ama/amf) → javelin    (Missiles.txt id 1, Javelin)
 * - PlrMode.txt TH=11: without a composited 'th' clip the world renderer
 *   returns early and the actor disappears for the whole throw animation.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseMissilesTxt } from '../src/server/skills/skills.ts'
import {
  resolveThrowMissileForItemCode,
} from '../src/common/skills/weapon-combat-meta.ts'
import { LINEAR_SKILL_MISSILES, ClientWorld } from '../src/client/world/client-world.ts'
import { SORCERESS_PLAYER_MODES } from '../src/common/units/char-appearance.ts'
import { MISSILE_METAS, THROWKNIFE_META, THROWAXE_META } from '../src/client/render/missiles-meta.ts'

describe('[Issue #905] Throw weapon missile & TH animation parity', () => {
  const missilesTxtPath = path.resolve(__dirname, '../samples/fixtures/data/global/excel/Missiles.txt')
  const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')

  it('1. Missiles.txt ground truth: throwknife id 36 (MissileDagger) and throwaxe id 35 (MissileHandAxe) are physical (Trans 0)', () => {
    const map = parseMissilesTxt(missilesTxtContent)

    const knife = map.get('throwknife')
    expect(knife).toBeDefined()
    expect(knife!.id).toBe(36)
    expect(knife!.celFile.toLowerCase()).toBe('missiledagger')
    expect(knife!.trans).toBe(0)

    const axe = map.get('throwaxe')
    expect(axe).toBeDefined()
    expect(axe!.id).toBe(35)
    expect(axe!.celFile.toLowerCase()).toBe('missilehandaxe')
    expect(axe!.trans).toBe(0)
  })

  it('2. No nonexistent missile names: every resolved throw missile value exists in 1.13c Missiles.txt', () => {
    const map = parseMissilesTxt(missilesTxtContent)
    for (const code of ['tkf', 'tax', 'jav', 'pil', 'glv', 'ops', 'opm', 'opl', 'gps', 'gpm', 'gpl']) {
      const missileName = resolveThrowMissileForItemCode(code)
      expect(missileName).not.toBeNull()
      expect(map.get(missileName!), `missile "${missileName}" must exist in Missiles.txt`).toBeDefined()
    }
    // The pre-fix names were typos that silently fell back to a synthetic record.
    expect(map.has('throwingknife')).toBe(false)
    expect(map.has('throwingaxe')).toBe(false)
  })

  it('3. resolveThrowMissileForItemCode maps every 1.13c throwing weapon code by Weapons.txt missiletype', () => {
    const knives = ['tkf', 'bkf', '9tk', '9bk', '7tk', '7bk']
    const axes = ['tax', 'bal', '9ta', '9b8', '7ta', '7b8']
    const javelins = ['jav', 'ssp', '9ja', '7ja']
    const pilums = ['pil', 'tsp', 'am5', 'ama', 'amf']
    const glaives = ['glv', '9pi', '9s9', '9gl', '9ts', '7pi', '7s7', '7gl', '7ts']
    for (const code of knives) expect(resolveThrowMissileForItemCode(code), code).toBe('throwknife')
    for (const code of axes) expect(resolveThrowMissileForItemCode(code), code).toBe('throwaxe')
    for (const code of javelins) expect(resolveThrowMissileForItemCode(code), code).toBe('javelin')
    for (const code of pilums) expect(resolveThrowMissileForItemCode(code), code).toBe('pilum')
    for (const code of glaives) expect(resolveThrowMissileForItemCode(code), code).toBe('glaive')
    // Throwing potions (Weapons.txt tpot): missiletype column (44..49).
    expect(resolveThrowMissileForItemCode('ops'), 'ops').toBe('fulminatingpotion')
    expect(resolveThrowMissileForItemCode('opm'), 'opm').toBe('explosivepotion')
    expect(resolveThrowMissileForItemCode('opl'), 'opl').toBe('oilpotion')
    expect(resolveThrowMissileForItemCode('gps'), 'gps').toBe('stranglinggaspotion')
    expect(resolveThrowMissileForItemCode('gpm'), 'gpm').toBe('chokinggaspoition')
    expect(resolveThrowMissileForItemCode('gpl'), 'gpl').toBe('rancidgasepotion')
    // Non-throwing weapons (even hax/whm which have monster missiletype in Weapons.txt) and junk codes must yield null.
    for (const code of ['dgr', 'ax1', 'hax', 'whm', 'gis', 'hth', '', undefined]) {
      expect(resolveThrowMissileForItemCode(code), String(code)).toBeNull()
    }
  })

  it('4. Weapons.txt missiletype mapping: tkf→throwknife, tax→throwaxe, jav→javelin, pil→pilum, glv→glaive', () => {
    expect(resolveThrowMissileForItemCode('tkf')).toBe('throwknife')
    expect(resolveThrowMissileForItemCode('tax')).toBe('throwaxe')
    expect(resolveThrowMissileForItemCode('jav')).toBe('javelin')
    expect(resolveThrowMissileForItemCode('pil')).toBe('pilum')
    expect(resolveThrowMissileForItemCode('glv')).toBe('glaive')
  })

  it('5. Client: skills 2/4/140 are not hardcoded into LINEAR_SKILL_MISSILES (missile is weapon-dependent)', () => {
    expect(LINEAR_SKILL_MISSILES[2]).toBeUndefined()
    expect(LINEAR_SKILL_MISSILES[4]).toBeUndefined()
    expect(LINEAR_SKILL_MISSILES[140]).toBeUndefined()
  })

  it('6. TH animation clip exists in the composited player mode list (no vanishing actor)', () => {
    expect(SORCERESS_PLAYER_MODES).toContain('th')
  })

  it('7. Baked atlas metadata for the throw missiles exists and matches the DCC ground truth', () => {
    expect(THROWKNIFE_META.celFile).toBe('MissileDagger')
    expect(THROWKNIFE_META.trans).toBe(0)
    expect(THROWKNIFE_META.blendMode).toBe('opaque')
    expect(THROWKNIFE_META.groups.length).toBe(32)
    expect(THROWKNIFE_META.framesPerDirection).toBe(1)

    expect(THROWAXE_META.celFile).toBe('MissileHandAxe')
    expect(THROWAXE_META.trans).toBe(0)
    expect(THROWAXE_META.blendMode).toBe('opaque')
    expect(THROWAXE_META.groups.length).toBe(32)
    expect(THROWAXE_META.framesPerDirection).toBe(8)

    expect(MISSILE_METAS.throwknife).toBe(THROWKNIFE_META)
    expect(MISSILE_METAS.throwaxe).toBe(THROWAXE_META)

    // Throwing potion atlases (Missiles.txt ids 44..49, Trans 0)
    const potionExpect: ReadonlyArray<[string, string]> = [
      ['oilpotion', 'mslops'],
      ['explosivepotion', 'mslopm'],
      ['fulminatingpotion', 'mslopl'],
      ['rancidgasepotion', 'mslgps'],
      ['chokinggaspoition', 'mslgpm'],
      ['stranglinggaspotion', 'mslgpl'],
    ]
    for (const [name, cel] of potionExpect) {
      const meta = MISSILE_METAS[name]
      expect(meta, name).toBeDefined()
      expect(meta!.celFile, name).toBe(cel)
      expect(meta!.trans, name).toBe(0)
      expect(meta!.blendMode, name).toBe('opaque')
    }

    const publicDir = path.resolve(__dirname, '../public/missiles')
    for (const [name] of potionExpect) {
      expect(fs.existsSync(path.join(publicDir, `${name}.png`)), `${name}.png`).toBe(true)
      expect(fs.existsSync(path.join(publicDir, `${name}.json`)), `${name}.json`).toBe(true)
    }
    for (const file of ['throwknife.png', 'throwknife.json', 'throwaxe.png', 'throwaxe.json']) {
      expect(fs.existsSync(path.join(publicDir, file)), file).toBe(true)
    }
  })

  it('8. Action-frame timing: throw missiles spawn at the TH event frame (f=10 → 400ms), not at cast start', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 7, classId: 1, name: 'TT', x: 5000, y: 5000 },
    })
    ;(world as unknown as { _containers: { equipmentBySlot: Map<number, { code: string; quantity: number }> } })
      ._containers.equipmentBySlot.set(4, { code: 'tkf', quantity: 47 })
    const unit = world.getUnit('player', 7)!
    expect(unit).toBeDefined()
    const w = world as unknown as {
      applySkillCastToUnit: (u: unknown, skillId: number, tx: number, ty: number, lvl: number, visuals: boolean, nowMs?: number) => void
      _units: Map<string, { unitType: string; missileKey?: string }>
    }
    const missiles = () => [...w._units.values()].filter(u => u.unitType === 'missile')

    w.applySkillCastToUnit(unit, 2, 5040, 5000, 1, true, 100000)
    const cast = unit.castState!
    expect(cast).toBeTruthy()
    // Sorceress TH: 20 frames, AnimData event f=10, base speed 256 → ceil(10*256/256)*40 = 400ms
    expect(cast.missileFireDelayMs).toBe(400)
    expect(missiles()).toHaveLength(0)
    expect(cast.missileSpawned).not.toBe(true)

    // One tick BEFORE the action frame: still nothing in the air.
    world.expireCastStates(100000 + 320, 0)
    expect(missiles()).toHaveLength(0)

    // At the action frame: the knife leaves the hand.
    world.expireCastStates(100000 + 400, 0)
    const spawned = missiles()
    expect(spawned).toHaveLength(1)
    expect(spawned[0]!.missileKey).toBe('throwknife')
    expect(cast.missileSpawned).toBe(true)
  })

  it('9. Action-frame timing: cast skills (fireball SC event f=7 → 280ms) also defer their missile', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 7, classId: 1, name: 'TT', x: 5000, y: 5000 },
    })
    const unit = world.getUnit('player', 7)!
    const w = world as unknown as {
      applySkillCastToUnit: (u: unknown, skillId: number, tx: number, ty: number, lvl: number, visuals: boolean, nowMs?: number) => void
      _units: Map<string, { unitType: string; missileKey?: string }>
    }
    const missiles = () => [...w._units.values()].filter(u => u.unitType === 'missile')

    w.applySkillCastToUnit(unit, 47, 5040, 5000, 1, true, 200000)
    const cast = unit.castState!
    expect(cast).toBeTruthy()
    if (cast.missileFireDelayMs !== undefined) {
      // Plain SC clip: event f=7 at base speed 256 → 280ms (sequence casts resolve
      // their own first event frame and land somewhere in (0, durationMs]).
      expect(cast.missileFireDelayMs).toBeGreaterThan(0)
      expect(missiles()).toHaveLength(0)
      world.expireCastStates(200000 + cast.missileFireDelayMs, 0)
      const spawned = missiles()
      expect(spawned).toHaveLength(1)
      expect(spawned[0]!.missileKey).toBe('fireball')
    } else {
      // No event data on this path would mean an immediate spawn (old behavior).
      throw new Error('fireball cast should be action-frame delayed')
    }
  })
})
