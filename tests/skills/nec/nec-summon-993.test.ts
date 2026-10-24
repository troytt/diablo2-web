/**
 * Issue #993 items 1-4 (Necromancer summoning) — 1.13c parity regression suite.
 *
 * 1. Revive (#95): client cast never hides the corpse; a unit revived in place drops corpse marks.
 * 2. Golems: own pets come from the 0x7A roster; TargetPet=0 golem casts go to the ground; Iron Golem targets
 *    metal ground items by ITEMS_IsMetalItem (Weapons/Armor/Misc.txt bitfield1 & 2).
 * 3. Unsummon (#3): only own roster pets with PetType.txt unsummon=1; the client never deletes units itself.
 * 4. Skeletal Mage (#80): necromage1..4 CelFile per Missiles.txt; S4/S5 elemental-hand variant packs;
 *    NecromageMissile (#338) picks the element from the 0xAC S4 component.
 */
import { describe, expect, it } from 'vitest'
import { getSharedMountedArchives } from '../../../src/baker/mpq-archive-source.ts'
import { buildMonsterComponentVariantJobs113c } from '../../../src/baker/packers/pack-entity-assets.ts'
import { CommandMapper } from '../../../src/client/input/command-mapper.ts'
import { MISSILE_METAS } from '../../../src/client/render/missiles-meta.ts'
import { OutboundRateLimiter } from '../../../src/client/session/rate-limiter.ts'
import { HudManager } from '../../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import {
  getItemBitfield1For113c,
  isMetalItemCode113c,
} from '../../../src/common/items/metal-items-113c.ts'
import { CANONICAL_113C_MISSILES as MISSILES_BY_NAME } from '../../../src/common/skills/missiles-data.ts'
import {
  MONSTER_COMPONENT_VARIANT_BAKES_113C,
  resolveMonsterComponentVariantKey113c,
} from '../../../src/common/units/monster-component-variants-113c.ts'
import {
  PET_TYPE_IDX_BY_NAME_113C,
  PET_TYPE_UNSUMMON_IDX_113C,
  isPetTypeUnsummonable113c,
} from '../../../src/common/units/pet-type-table.ts'
import { cell, parseTable } from '../../../src/common/world/acts.ts'
import type { ClientCommand } from '../../../src/netproto/index.ts'
import { unsummonOwnPetAt } from '../../../src/server/ai/summon-manager.ts'

const SELF_ID = 1

function setup() {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sent: ClientCommand[] = []
  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
  world.apply({ type: 'PlayerAssign', unitId: SELF_ID, classId: 2, name: 'Necro', x: 5000, y: 5000 })
  const mapper = new CommandMapper({
    world,
    hudManager,
    rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 }),
    sendCommand: cmd => sent.push(cmd),
  })
  return { world, hudManager, mapper, sent }
}

function assignMonster(world: ClientWorld, id: number, classId: number, x: number, y: number, mode = 1, extra: Record<string, unknown> = {}) {
  world.apply({
    type: 'UnitAssign',
    unit: { unitType: 1, id, classId, x, y, lifePct: mode === 12 ? 0 : 128, mode, ...extra },
  } as any)
  return world.getUnit('monster', id)!
}

function summonAction(world: ClientWorld, petId: number, classId: number, petType: number, ownerId = SELF_ID) {
  world.apply({
    type: 'Merc',
    kind: 'assign',
    ownerId,
    mercId: petId,
    classId,
    petType,
    isSummonAction: true,
    summonAction: 1,
  } as any)
}

async function readExcel(member: string) {
  const archives = await getSharedMountedArchives()
  return parseTable(await archives.read(`data\\global\\excel\\${member}`))
}

describe('#993-1 Revive (#95) keeps the revived unit visible', () => {
  it('client cast spawns only the revive missile and never stamps STATE_CORPSE_NODRAW / STATE_REVIVE', () => {
    const { world } = setup()
    // Fallen (hcIdx 19) corpse.
    const corpse = assignMonster(world, 500, 19, 5004, 5000, 12)
    expect(corpse.dead || corpse.mode === 12).toBe(true)
    const caster = world.getUnit('player', SELF_ID)!
    ;(world as any).spawnMissilesForSkill(caster, 95, corpse.x, corpse.y, 1)
    expect(corpse.states.has(104)).toBe(false)
    expect(corpse.states.has(96)).toBe(false)
    const missiles = Array.from(world.units.values()).filter(u => u.unitType === 'missile')
    expect(missiles.map(m => m.missileKey).every(k => k === 'revivesmall' || k === 'revivemedium' || k === 'revivelarge')).toBe(true)
    expect(missiles.length).toBe(1)
  })

  it('Raise Skeleton (#70) still consumes the corpse (104)', () => {
    const { world } = setup()
    const corpse = assignMonster(world, 501, 19, 5004, 5000, 12)
    const caster = world.getUnit('player', SELF_ID)!
    ;(world as any).spawnMissilesForSkill(caster, 70, corpse.x, corpse.y, 1)
    expect(corpse.states.has(104)).toBe(true)
  })

  it('a corpse unit that comes back alive (mode 12 -> 1) drops 104/118/corpseSuppressed', () => {
    const { world } = setup()
    const corpse = assignMonster(world, 502, 19, 5004, 5000, 12)
    corpse.states.add(104)
    corpse.states.add(118)
    corpse.corpseSuppressed = true
    world.apply({ type: 'UnitMode', unitType: 1, id: 502, mode: 1, lifePct: 128 } as any)
    expect(corpse.dead).toBe(false)
    expect(corpse.states.has(104)).toBe(false)
    expect(corpse.states.has(118)).toBe(false)
    expect(corpse.corpseSuppressed).toBe(false)
  })

  it('STATE_REVIVE (96) on a monster clears stale corpse marks', () => {
    const { world } = setup()
    const unit = assignMonster(world, 503, 19, 5004, 5000, 12)
    unit.states.add(104)
    world.apply({ type: 'StateSet', unit: { unitType: 1, id: 503 }, state: 96 } as any)
    expect(unit.states.has(96)).toBe(true)
    expect(unit.states.has(104)).toBe(false)
  })
})

describe('#993-2 Golems', () => {
  it('0x7A SummonAction stamps owner on the ClientUnit and the pet roster', () => {
    const { world } = setup()
    const golem = assignMonster(world, 600, 289, 5002, 5000)
    summonAction(world, 600, 289, 3)
    expect(golem.ownerType).toBe('player')
    expect(golem.ownerId).toBe(SELF_ID)
    expect(world.pets.get(600)?.ownerId).toBe(SELF_ID)
  })

  it('Blood/Fire Golem (TargetPet=0) over an own Clay Golem casts SkillAt on the ground', () => {
    const { world, mapper } = setup()
    const golem = assignMonster(world, 601, 289, 5002, 5000)
    summonAction(world, 601, 289, 3)
    for (const skillId of [85, 94]) {
      world.self.rightSkill = skillId
      expect(mapper.isValidSkillTargetUnit(golem, skillId)).toBe(false)
      const cmd = mapper.fromMouseDown({ button: 'right', worldX: 5002, worldY: 5000, hoveredUnit: golem })
      expect(cmd?.type).toBe('SkillAt')
    }
  })

  it('Iron Golem targets metal ground items via ItemTypes/bitfield1, not item names', () => {
    const { mapper } = setup()
    const mk = (code: string, mode = 3): any => ({ unitType: 'item', id: 1, classId: 0, mode, x: 0, y: 0, itemCode: code, name: 'whatever' })
    expect(mapper.isValidSkillTargetUnit(mk('rng'), 90)).toBe(true) // Ring Mail (metal, name contains "ring")
    expect(mapper.isValidSkillTargetUnit(mk('ssd'), 90)).toBe(true) // Short Sword
    expect(mapper.isValidSkillTargetUnit(mk('lea'), 90)).toBe(false) // Leather Armor
    expect(mapper.isValidSkillTargetUnit(mk('sbw'), 90)).toBe(false) // Short Bow
    expect(mapper.isValidSkillTargetUnit(mk('rin'), 90)).toBe(false) // Ring
    expect(mapper.isValidSkillTargetUnit(mk('hpo'), 90)).toBe(false) // potion
    expect(mapper.isValidSkillTargetUnit(mk('ssd', 5), 90)).toBe(false) // still dropping
    expect(mapper.isValidSkillTargetUnit({ unitType: 'item', id: 2, mode: 3 } as any, 90)).toBe(false)
  })

  it('metal table equals Weapons/Armor/Misc.txt bitfield1 & 2 from the 1.13c MPQs', async () => {
    for (const member of ['Weapons.txt', 'Armor.txt', 'Misc.txt']) {
      const table = await readExcel(member)
      for (const row of table.rows) {
        const code = cell(table, row, 'code').trim()
        if (!code) continue
        const raw = cell(table, row, 'bitfield1').trim()
        const bf = raw === '' ? 0 : Number(raw)
        expect(getItemBitfield1For113c(code), `${member} ${code}`).toBe(bf)
        expect(isMetalItemCode113c(code)).toBe((bf & 2) !== 0)
      }
    }
    expect(() => isMetalItemCode113c('zz?')).toThrow(RangeError)
  }, 60_000)
})

describe('#993-3 Unsummon (#3)', () => {
  it('PetType unsummon table matches PetType.txt', async () => {
    const table = await readExcel('PetType.txt')
    const fromMpq = new Set<number>()
    for (const row of table.rows) {
      const name = cell(table, row, 'pet type').trim()
      if (!name) continue
      const idx = Number(cell(table, row, 'idx'))
      expect(PET_TYPE_IDX_BY_NAME_113C[name]).toBe(idx)
      if (cell(table, row, 'unsummon').trim() === '1') fromMpq.add(idx)
    }
    expect([...PET_TYPE_UNSUMMON_IDX_113C].sort((a, b) => a - b)).toEqual([...fromMpq].sort((a, b) => a - b))
    expect(isPetTypeUnsummonable113c('golem')).toBe(true)
    expect(isPetTypeUnsummonable113c('raven')).toBe(false)
    expect(() => isPetTypeUnsummonable113c('nope')).toThrow(RangeError)
  }, 60_000)

  it('targets only own roster pets with unsummon=1', () => {
    const { world, mapper } = setup()
    const own = assignMonster(world, 700, 363, 5002, 5000)
    summonAction(world, 700, 363, 4)
    const foreign = assignMonster(world, 701, 363, 5003, 5000)
    summonAction(world, 701, 363, 4, 99)
    const raven = assignMonster(world, 702, 419, 5001, 5001)
    summonAction(world, 702, 419, 10)
    const enemy = assignMonster(world, 703, 19, 5004, 5004)
    expect(mapper.isValidSkillTargetUnit(own, 3)).toBe(true)
    expect(mapper.isValidSkillTargetUnit(foreign, 3)).toBe(false)
    expect(mapper.isValidSkillTargetUnit(raven, 3)).toBe(false)
    expect(mapper.isValidSkillTargetUnit(enemy, 3)).toBe(false)
    world.self.rightSkill = 3
    expect(mapper.fromMouseDown({ button: 'right', worldX: 5002, worldY: 5000, hoveredUnit: own })).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 1, id: 700 },
      shift: false,
      hold: false,
    })
  })

  it('client Unsummon cast never deletes units itself (server despawns the pet)', () => {
    const { world } = setup()
    const pet = assignMonster(world, 710, 363, 5002, 5000)
    summonAction(world, 710, 363, 4)
    const enemy = assignMonster(world, 711, 19, 5002, 5001)
    const caster = world.getUnit('player', SELF_ID)!
    ;(world as any).spawnMissilesForSkill(caster, 3, pet.x, pet.y, 1)
    expect(world.getUnit('monster', 710)).toBe(pet)
    expect(world.getUnit('monster', 711)).toBe(enemy)
    expect(enemy.dead).toBe(false)
  })

  it('scene engine unsummon removes only an own unsummonable pet under the cursor', () => {
    const player: any = {
      summons: [
        { uid: 'a', petType: 'golem', x: 100, y: 100, alive: true },
        { uid: 'b', petType: 'skeleton', x: 400, y: 400, alive: true },
      ],
    }
    expect(unsummonOwnPetAt(player, 405, 400)).toEqual({ petType: 'skeleton', uid: 'b' })
    expect(player.summons.map((s: any) => s.uid)).toEqual(['a'])
    expect(unsummonOwnPetAt(player, 900, 900)).toBeNull()
  })
})

describe('#993-4 Skeletal Mage (#80)', () => {
  it('necromage1..4 CelFile / directions follow Missiles.txt', async () => {
    const table = await readExcel('Missiles.txt')
    for (const name of ['necromage1', 'necromage2', 'necromage3', 'necromage4']) {
      const row = table.rows.find(r => cell(table, r, 'Missile').trim() === name)!
      const celFile = cell(table, row, 'CelFile').trim()
      expect(MISSILE_METAS[name]!.celFile, name).toBe(celFile)
      expect(MISSILE_METAS[name]!.directions, name).toBe(Number(cell(table, row, 'NumDirections')))
      expect(MISSILES_BY_NAME[name]!.celFile, name).toBe(celFile)
    }
    expect(MISSILE_METAS.necromage1!.celFile).toBe('poisonNova')
    expect(MISSILE_METAS.necromage2!.celFile).toBe('Icebolt')
    expect(MISSILE_METAS.necromage3!.celFile).toBe('Firebolt')
    expect(MISSILE_METAS.necromage4!.celFile).toBe('ChargedBolt')
    // Same DCC + Trans as the shared pack -> identical baked frame layout.
    expect(MISSILE_METAS.necromage1!.groups).toEqual(MISSILE_METAS.poisonnova!.groups)
    expect(MISSILE_METAS.necromage2!.groups).toEqual(MISSILE_METAS.icebolt!.groups)
    expect(MISSILE_METAS.necromage3!.groups).toEqual(MISSILE_METAS.firebolt!.groups)
    expect(MISSILE_METAS.necromage4!.groups).toEqual(MISSILE_METAS.chargedbolt!.groups)
  }, 60_000)

  it('component-variant bake table matches MonStats2.txt necromage S4v/S5v', async () => {
    const table = await readExcel('MonStats2.txt')
    const bake = MONSTER_COMPONENT_VARIANT_BAKES_113C.find(b => b.hcIdx === 364)!
    const row = table.rows.find(r => cell(table, r, 'Id').trim() === bake.monStats2Id)!
    for (const comp of bake.components) {
      const col = `${comp.toUpperCase()}v`
      expect(cell(table, row, col).trim().replace(/^"|"$/g, '').split(','), col).toEqual(bake.variants)
    }
    expect(resolveMonsterComponentVariantKey113c(364, undefined)).toBeNull()
    expect(resolveMonsterComponentVariantKey113c(363, new Array(16).fill(0))).toBeNull()
    const comps = new Array(16).fill(0)
    comps[11] = 2
    comps[12] = 2
    expect(resolveMonsterComponentVariantKey113c(364, comps)).toBe('sk-hth-s4s5fir')
    expect(buildMonsterComponentVariantJobs113c('a', 'b').map(j => [j.key, j.componentVariants])).toEqual([
      ['sk-hth-s4s5pos', { s4: 'pos', s5: 'pos' }],
      ['sk-hth-s4s5cld', { s4: 'cld', s5: 'cld' }],
      ['sk-hth-s4s5fir', { s4: 'fir', s5: 'fir' }],
      ['sk-hth-s4s5lht', { s4: 'lht', s5: 'lht' }],
    ])
  }, 60_000)

  it('NecromageMissile (#338) fires necromage<element+1> from the S4 component and needs it', () => {
    const { world } = setup()
    for (let element = 0; element < 4; element += 1) {
      const comps = new Array(16).fill(0)
      comps[11] = element
      comps[12] = element
      const mage = assignMonster(world, 800 + element, 364, 5002, 5000, 1, { compVariants: comps })
      expect(mage.compVariants?.[11]).toBe(element)
      ;(world as any).spawnMissilesForSkill(mage, 338, 5010, 5000, 1)
      const shot = Array.from(world.units.values()).filter(u => u.unitType === 'missile' && u.ownerId === mage.id)
      expect(shot.map(s => s.missileKey)).toEqual([`necromage${String(element + 1)}`])
    }
    const bare = assignMonster(world, 900, 364, 5002, 5000)
    expect(() => (world as any).spawnMissilesForSkill(bare, 338, 5010, 5000, 1)).toThrow(RangeError)
  })

  it('mages no longer auto-fire client-side without a server skill event', () => {
    const { world } = setup()
    const comps = new Array(16).fill(0)
    assignMonster(world, 950, 364, 5002, 5000, 1, { compVariants: comps })
    assignMonster(world, 951, 19, 5006, 5000)
    for (let i = 0; i < 60; i += 1) world.tick?.(40)
    const missiles = Array.from(world.units.values()).filter(u => u.unitType === 'missile' && String(u.missileKey).startsWith('necromage'))
    expect(missiles).toHaveLength(0)
  })
})
