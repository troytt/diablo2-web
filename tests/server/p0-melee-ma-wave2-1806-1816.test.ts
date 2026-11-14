/**
 * Wave 2 melee / Telekinesis runtime (#1806, #1808, #1812, #1813, #1815, #1816).
 */
import { describe, expect, it } from 'vitest'
import type { ItemData, ItemStat, ServerEvent } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../../src/server/save/d2s-writer.ts'
import { evaluateDragonTalonStats } from '../../src/server/skills/assassin-martial-arts.ts'
import {
  addMartialCharge113c,
  classifyHandItem113c,
  computeDragonTailExplosionDamage113c,
  computeFistsOfFireConversionPct113c,
  computeKickDamageRange113c,
  computeSmiteStunFrames113c,
  isTelekinesisObjectEligible113c,
  isTelekinesisPickupEligible113c,
  isWithinTelekinesisRange113c,
  liveMartialCharges113c,
  normalizeSkillTargetUnitType113c,
  stepFrenzyStack113c,
  validateWave2SkillHands113c,
} from '../../src/server/skills/martial-dualwield-113c.ts'
import { createSampleD2sCharacterData } from '../e2e/server-reuse/helpers.ts'

type AnyEvent = ServerEvent & Record<string, unknown>
const CLASS = { sor: 1, pal: 3, bar: 4, ass: 6 } as const

function equipped(id: number, code: string, bodyLoc: number, stats: ItemStat[] = []): ItemData {
  return {
    id, itemId: id, opcode: 0x9c, action: 0, category: 0, flags: 0x10, rawFlags: 0x10, version: 101,
    location: 1, container: 'equipment', bodyLoc, equippedSlot: bodyLoc, gridX: 0, gridY: 0,
    storePage: 0, storagePage: 0, worldX: 0, worldY: 0, x: 0, y: 0, code, rawCode: `${code} `,
    compact: false, simple: false, identified: true, socketed: false, ethereal: false, runeword: false,
    personalized: false, isEar: false, newItem: false, starterItem: false, broken: false, inSocket: false,
    equipped: true, socketedChildCount: 0, usedSockets: 0, totalSockets: 0, ilvl: 30, quality: 2,
    magicPrefixId: 0, magicSuffixId: 0, invWidth: 1, invHeight: 3, stats, setBonusStats: [], runewordStats: [],
  }
}

function setup(
  seed: number,
  charClass: keyof typeof CLASS,
  skills: Record<number, number>,
  items: ItemData[] = [],
  areaId = 2,
) {
  const game = new GameInstance({ seed, difficulty: 0, areaId })
  const playerId = game.connectPlayer({
    d2sBytes: writeD2sSave113c(
      createSampleD2sCharacterData({
        name: `Wave${seed}`,
        charClass: CLASS[charClass],
        level: 60,
        skillLevels: new Uint8Array(30),
        items,
        attributesOverrides: {
          strength: 150,
          dexterity: 150,
          maxManaFixed: 5000 * FIXED_ONE,
          manaFixed: 5000 * FIXED_ONE,
          maxHpFixed: 2000 * FIXED_ONE,
          hitpointsFixed: 2000 * FIXED_ONE,
        },
      }),
    ),
    x: 100,
    y: 100,
    areaId,
    skills,
  })
  game.drainEvents(playerId)
  const g = game as unknown as Record<string, any>
  return { game, playerId, g, player: g.players.get(playerId) }
}

function dummy(game: GameInstance, x: number, y: number, areaId = 2, hp = 100000): number {
  const id = game.spawnMonster({
    defId: 'fallen1', x, y, areaId, hp, maxHp: hp, aiDisabled: true, damageRegen: 0,
    resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
  })
  const mon = (game as unknown as Record<string, any>).monsters.get(id)
  mon.ac = 0
  mon.toBlock = 0
  return id
}

function castOn(game: GameInstance, pid: number, skillId: number, targetId: number, targetType: string): AnyEvent[] {
  game.enqueueCommand(pid, { type: 'CastSkillOnTarget', skillId, targetType, targetId } as never)
  game.stepFrames(1)
  return game.drainEvents(pid) as AnyEvent[]
}

const casted = (evs: AnyEvent[], skillId: number) => evs.some((e) => e.type === 'SkillCast' && e.skill === skillId)

describe('martial-dualwield-113c pure rules', () => {
  it('normalizes unit-target types and Telekinesis range / whitelist (#1806)', () => {
    expect(normalizeSkillTargetUnitType113c('item')).toBe(4)
    expect(normalizeSkillTargetUnitType113c('object')).toBe(2)
    expect(normalizeSkillTargetUnitType113c('monster')).toBe(1)
    expect(normalizeSkillTargetUnitType113c(4)).toBe(4)
    expect(normalizeSkillTargetUnitType113c('bogus')).toBeUndefined()
    expect(isWithinTelekinesisRange113c(0, 0, 15, 20)).toBe(true)
    expect(isWithinTelekinesisRange113c(0, 0, 16, 20)).toBe(false)
    for (const code of ['gld', 'hp1', 'mp5', 'rvl', 'tsc', 'isc', 'key', 'aqv', 'cqv', 'vps', 'yps', 'opl']) {
      expect(isTelekinesisPickupEligible113c(code), code).toBe(true)
    }
    for (const code of ['rin', 'amu', 'r01', 'gpw', 'lsd', 'buc', 'lbt', 'cm1', 'jew']) {
      expect(isTelekinesisPickupEligible113c(code), code).toBe(false)
    }
    const obj = { operateFn: 1, isWaypoint: false, isShrine: false, destAreaId: undefined }
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 5 })).toBe(true)
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 267 })).toBe(false) // stash
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 900, operateFn: 32 })).toBe(false)
    for (const blocked of [22, 121, 122, 152, 376, 404, 546]) {
      expect(isTelekinesisObjectEligible113c({ ...obj, classId: blocked }), String(blocked)).toBe(false)
    }
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 119, operateFn: 0, isWaypoint: true })).toBe(true)
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 59, operateFn: 0, destAreaId: 1 })).toBe(true)
    expect(isTelekinesisObjectEligible113c({ ...obj, classId: 9, operateFn: 0 })).toBe(false)
  })

  it('classifies hands and validates Smite / Barbarian / Martial requirements (#1808, #1812, #1813, #1815)', () => {
    expect(classifyHandItem113c({ code: 'ktr' })).toBe('claw')
    expect(classifyHandItem113c({ code: 'buc' })).toBe('shield')
    expect(classifyHandItem113c({ code: 'tkf' })).toBe('throw')
    expect(classifyHandItem113c({ code: 'sbw' })).toBe('ranged')
    const lsd = { code: 'lsd' }
    const buc = { code: 'buc' }
    const ktr = { code: 'ktr' }
    const tkf = { code: 'tkf' }
    expect(validateWave2SkillHands113c(97, lsd, buc).valid).toBe(true)
    expect(validateWave2SkillHands113c(97, lsd, undefined).reason).toBe('requires_shield')
    expect(validateWave2SkillHands113c(133, lsd, lsd).valid).toBe(true)
    expect(validateWave2SkillHands113c(133, lsd, buc).reason).toBe('requires_dual_melee')
    expect(validateWave2SkillHands113c(147, lsd, undefined).reason).toBe('requires_dual_melee')
    expect(validateWave2SkillHands113c(140, tkf, tkf, { right: 5, left: 5 }).valid).toBe(true)
    expect(validateWave2SkillHands113c(140, tkf, tkf, { right: 5, left: 0 }).reason).toBe('requires_dual_throw')
    expect(validateWave2SkillHands113c(140, tkf, buc).reason).toBe('requires_dual_throw')
    expect(validateWave2SkillHands113c(269, ktr, undefined).valid).toBe(true)
    expect(validateWave2SkillHands113c(274, lsd, undefined).reason).toBe('requires_claw')
    expect(validateWave2SkillHands113c(259, undefined, buc).valid).toBe(true)
    expect(validateWave2SkillHands113c(259, lsd, undefined).reason).toBe('requires_claw_or_unarmed')
    expect(validateWave2SkillHands113c(260, ktr, ktr).valid).toBe(true)
    expect(validateWave2SkillHands113c(260, ktr, buc).reason).toBe('requires_dual_claw')
    expect(validateWave2SkillHands113c(254, { code: 'sbw' }, undefined).reason).toBe('requires_melee')
    expect(validateWave2SkillHands113c(255, { code: 'sbw' }, undefined).valid).toBe(true)
    // Synthetic rigs without hand items keep the registry-sweep convention.
    expect(validateWave2SkillHands113c(260, undefined, undefined).valid).toBe(true)
    expect(computeSmiteStunFrames113c(1)).toBe(15)
    expect(computeSmiteStunFrames113c(20)).toBe(110)
    expect(computeSmiteStunFrames113c(60)).toBe(250)
  })

  it('steps Frenzy stacks only on landed strikes, caps at slvl and expires after 150 frames (#1813)', () => {
    let s = stepFrenzyStack113c(undefined, 100, 3, true)
    expect([s.stacks, s.expireFrame, s.velocityPct, s.attackRatePct]).toEqual([1, 250, 47, 7])
    s = stepFrenzyStack113c(s, 110, 3, false)
    expect([s.stacks, s.expireFrame]).toEqual([1, 250])
    s = stepFrenzyStack113c(s, 120, 3, true)
    s = stepFrenzyStack113c(s, 130, 3, true)
    s = stepFrenzyStack113c(s, 140, 3, true)
    expect([s.stacks, s.expireFrame]).toEqual([3, 290])
    expect(stepFrenzyStack113c(s, 290, 3, false).stacks).toBe(0)
    expect(stepFrenzyStack113c(s, 290, 3, true).stacks).toBe(1)
  })

  it('tracks progressive charges (max 3, shared 375-frame refresh) and kick / Dragon Tail math (#1815, #1816)', () => {
    let c = addMartialCharge113c(undefined, 254, 5, 0)
    c = addMartialCharge113c(c, 254, 5, 10)
    c = addMartialCharge113c(c, 259, 5, 20)
    c = addMartialCharge113c(c, 254, 5, 30)
    c = addMartialCharge113c(c, 254, 5, 40)
    expect(liveMartialCharges113c(c, 41).map((x) => [x.stateId, x.count])).toEqual([
      [125, 1],
      [122, 3],
    ])
    expect(c.expireFrame).toBe(415)
    expect(liveMartialCharges113c(c, 415)).toEqual([])
    expect(computeFistsOfFireConversionPct113c(10)).toBe(30)
    expect(computeFistsOfFireConversionPct113c(40)).toBe(100)
    // Myrmidon Greaves 83..149, Str 150 / Dex 150, no ED: attr (280/4=70, 280/3=93) + boot * (100+180)/100.
    expect(computeKickDamageRange113c({ strength: 150, dexterity: 150, boot: { min: 83, max: 149 }, skillEdPct: 0, offWeaponEdPct: 0 }))
      .toEqual({ min: 70 + 232, max: 93 + 417 })
    expect(computeKickDamageRange113c({ strength: 0, dexterity: 0, boot: { min: 0, max: 0 }, skillEdPct: 0, offWeaponEdPct: 0 }))
      .toEqual({ min: 1, max: 2 })
    expect(computeDragonTailExplosionDamage113c(0, 20)).toBe(0)
    expect(computeDragonTailExplosionDamage113c(1000, 1)).toBe(500)
    expect(computeDragonTailExplosionDamage113c(1000, 11)).toBe(1500)
    // Dragon Talon kick count is MPQ-driven (`Skills.txt` #255 Calc1): never less than 1, non-decreasing.
    const kicks = [1, 5, 6, 12, 20].map((slvl) => evaluateDragonTalonStats(slvl).kickCount)
    expect(kicks[0]).toBe(1)
    expect(kicks.every((k, i) => i === 0 || k >= kicks[i - 1]!)).toBe(true)
  })
})

describe('#1806 Telekinesis dispatches by target unit type', () => {
  it('picks up whitelisted ground items from range, refuses equipment, and ignores far items', () => {
    const { game, playerId, g, player } = setup(0x1806, 'sor', { 43: 5 })
    const pot = game.spawnGroundItem({ code: 'hp1', x: 112, y: 100, areaId: 2 })
    const ring = game.spawnGroundItem({ code: 'rin', x: 110, y: 104, areaId: 2 })
    const far = game.spawnGroundItem({ code: 'hp1', x: 140, y: 100, areaId: 2 })
    game.drainEvents(playerId)

    let evs = castOn(game, playerId, 43, pot, 'item')
    expect(casted(evs, 43)).toBe(true)
    expect(g.groundItems.has(pot)).toBe(false)
    expect(player.items.some((i: { unitId: number }) => i.unitId === pot)).toBe(true)

    evs = castOn(game, playerId, 43, ring, 'item')
    expect(g.groundItems.has(ring)).toBe(true)
    expect(evs.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    const manaBefore = player.manaFixed
    evs = castOn(game, playerId, 43, far, 'item')
    expect(casted(evs, 43)).toBe(false)
    expect(g.groundItems.has(far)).toBe(true)
    expect(player.manaFixed).toBeGreaterThanOrEqual(manaBefore)
  })

  it('operates waypoints remotely but never the stash; monsters are hit outside town only', () => {
    const { game, playerId, g } = setup(0x1807, 'sor', { 43: 5 }, [], 3)
    const wp = game.spawnObject({ classId: 119, x: 112, y: 100, areaId: 3, isWaypoint: true })
    game.drainEvents(playerId)
    let evs = castOn(game, playerId, 43, wp, 'object')
    expect(evs.some((e) => e.type === 'WaypointMenu')).toBe(true)

    const stash = game.spawnObject({ classId: 267, x: 110, y: 102, areaId: 3 })
    game.drainEvents(playerId)
    evs = castOn(game, playerId, 43, stash, 'object')
    expect(evs.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(g.objects.get(stash).mode).toBe(0)

    const mon = dummy(game, 110, 100, 3)
    castOn(game, playerId, 43, mon, 'monster')
    expect(game.getMonster(mon)!.hp).toBeLessThan(100000)

    const town = setup(0x1808, 'sor', { 43: 5 }, [], 1)
    const townMon = dummy(town.game, 105, 100, 1)
    const townEvs = castOn(town.game, town.playerId, 43, townMon, 'monster')
    expect(casted(townEvs, 43)).toBe(false)
    expect(town.game.getMonster(townMon)!.hp).toBe(100000)
  })
})

describe('#1808 Smite', () => {
  it('requires a shield once armed, auto-hits from shield damage and stuns non-bosses', () => {
    const { game, playerId, g, player } = setup(0x1809, 'pal', { 97: 20 }, [equipped(1, 'lsd', 4), equipped(2, 'pa9', 5)])
    const mon = dummy(game, 102, 100)
    g.monsters.get(mon).ac = 999999
    g.monsters.get(mon).toBlock = 75
    const evs = castOn(game, playerId, 97, mon, 'monster')
    expect(casted(evs, 97)).toBe(true)
    expect(game.getMonster(mon)!.hp).toBeLessThan(100000)
    expect(game.getMonster(mon)!.states.has(21)).toBe(true)

    player.items = player.items.filter((i: { bodyLoc: number }) => i.bodyLoc !== 5)
    const mon2 = dummy(game, 102, 101)
    const evs2 = castOn(game, playerId, 97, mon2, 'monster')
    expect(casted(evs2, 97)).toBe(false)
    expect(game.getMonster(mon2)!.hp).toBe(100000)
  })
})

describe('#1812 Double Swing / Double Throw dual-wield', () => {
  it('Double Swing swings both hands with dual melee weapons and is refused with weapon + shield', () => {
    const dual = setup(0x1812, 'bar', { 133: 10 }, [equipped(1, 'lsd', 4), equipped(2, 'lsd', 5)])
    const mon = dummy(dual.game, 102, 100)
    const evs = castOn(dual.game, dual.playerId, 133, mon, 'monster')
    expect(casted(evs, 133)).toBe(true)
    expect(evs.filter((e) => e.type === 'UnitStatUpdate' && e.unitType === 'monster' && e.unitId === mon).length).toBeGreaterThanOrEqual(1)

    const shield = setup(0x1813, 'bar', { 133: 10 }, [equipped(1, 'lsd', 4), equipped(2, 'buc', 5)])
    const mon2 = dummy(shield.game, 102, 100)
    const manaBefore = shield.player.manaFixed
    const evs2 = castOn(shield.game, shield.playerId, 133, mon2, 'monster')
    expect(casted(evs2, 133)).toBe(false)
    expect(shield.game.getMonster(mon2)!.hp).toBe(100000)
    expect(shield.player.manaFixed).toBeGreaterThanOrEqual(manaBefore)
  })

  it('Double Throw launches one missile per hand and spends one throw from each stack', () => {
    const qty = (v: number): ItemStat[] => [{ statId: 70, param: 0, value: v }]
    const dual = setup(0x1814, 'bar', { 140: 5 }, [equipped(1, 'tkf', 4, qty(10)), equipped(2, 'tkf', 5, qty(10))])
    for (const i of dual.player.items) if (i.bodyLoc === 4 || i.bodyLoc === 5) i.quantity = 10
    dual.game.enqueueCommand(dual.playerId, { type: 'CastSkillAtLocation', skillId: 140, x: 108, y: 100, hand: 'right' })
    dual.game.stepFrames(1)
    const evs = dual.game.drainEvents(dual.playerId) as AnyEvent[]
    expect(evs.filter((e) => e.type === 'CreateMissile')).toHaveLength(2)
    const hands = dual.player.items.filter((i: { bodyLoc: number }) => i.bodyLoc === 4 || i.bodyLoc === 5)
    expect(hands.map((i: { quantity: number }) => i.quantity)).toEqual([9, 9])

    const single = setup(0x1815, 'bar', { 140: 5 }, [equipped(1, 'tkf', 4, qty(10)), equipped(2, 'buc', 5)])
    single.game.enqueueCommand(single.playerId, { type: 'CastSkillAtLocation', skillId: 140, x: 108, y: 100, hand: 'right' })
    single.game.stepFrames(1)
    const evs2 = single.game.drainEvents(single.playerId) as AnyEvent[]
    expect(evs2.filter((e) => e.type === 'SkillCast' || e.type === 'CreateMissile')).toEqual([])
  })
})

describe('#1813 Frenzy stacking', () => {
  it('raises the frenzy state (94) on hits with FRW/IAS stats and drops it 150 frames after the last hit', () => {
    const { game, playerId, g, player } = setup(0x1816, 'bar', { 147: 10 }, [equipped(1, 'lsd', 4), equipped(2, 'lsd', 5)])
    const mon = dummy(game, 102, 100, 2, 10_000_000)
    for (let i = 0; i < 6; i++) castOn(game, playerId, 147, mon, 'monster')
    const stack = g.playerFrenzyStack113c.get(playerId)
    expect(stack.stacks).toBeGreaterThanOrEqual(2)
    expect(player.states.has(94)).toBe(true)
    const entry = g.playerCombat.get(playerId).stateBus.getState(94)
    expect(entry.stats.skill_frenzy).toBe(stack.stacks)
    expect(entry.stats.velocitypercent).toBeGreaterThan(0)
    expect(entry.stats.attackrate).toBeGreaterThan(0)
    game.stepFrames(151)
    expect(player.states.has(94)).toBe(false)

    const single = setup(0x1817, 'bar', { 147: 10 }, [equipped(1, 'lsd', 4), equipped(2, 'buc', 5)])
    const mon2 = dummy(single.game, 102, 100)
    expect(casted(castOn(single.game, single.playerId, 147, mon2, 'monster'), 147)).toBe(false)
  })
})

describe('#1815 / #1816 Assassin Martial Arts charges and finishers', () => {
  it('charge-ups stack progressive states 122..127 (claw-gated) and a finisher releases them all', () => {
    const { game, playerId, g, player } = setup(
      0x1818,
      'ass',
      { 254: 10, 259: 10, 274: 10, 255: 5, 270: 5 },
      [equipped(1, 'ktr', 4), equipped(2, 'ktr', 5), equipped(3, 'uhb', 9)],
    )
    const mon = dummy(game, 102, 100, 2, 10_000_000)
    for (let i = 0; i < 8; i++) castOn(game, playerId, 254, mon, 'monster')
    for (let i = 0; i < 3; i++) castOn(game, playerId, 274, mon, 'monster')
    const charges = g.playerMartialCharges113c.get(playerId).charges
    const tiger = charges.find((c: { skillId: number }) => c.skillId === 254)
    expect(tiger.count).toBe(3)
    expect(player.states.has(122)).toBe(true)
    expect(g.playerCombat.get(playerId).stateBus.getState(122).stats.progressive_damage).toBe(3)

    // Dragon Talon kick (boots `uhb`) releases every charge on the first landed kick.
    let released = false
    for (let i = 0; i < 10 && !released; i++) {
      const evs = castOn(game, playerId, 255, mon, 'monster')
      released = evs.some((e) => e.type === 'StateEnd' && (e as { state?: number }).state === 122)
    }
    expect(released).toBe(true)
    expect(player.states.has(122)).toBe(false)
    expect(player.states.has(126)).toBe(false)
    expect(g.playerMartialCharges113c.has(playerId)).toBe(false)
  })

  it('Claws of Thunder / Blades of Ice need a claw, Fists of Fire refuses swords, Dragon Claw needs two claws', () => {
    const sword = setup(0x1819, 'ass', { 269: 5, 274: 5, 259: 5, 260: 5 }, [equipped(1, 'lsd', 4)])
    const mon = dummy(sword.game, 102, 100)
    for (const skillId of [269, 274, 259, 260]) {
      expect(casted(castOn(sword.game, sword.playerId, skillId, mon, 'monster'), skillId), String(skillId)).toBe(false)
    }
    const claws = setup(0x181a, 'ass', { 269: 5, 260: 5 }, [equipped(1, 'ktr', 4), equipped(2, 'ktr', 5)])
    const mon2 = dummy(claws.game, 102, 100)
    expect(casted(castOn(claws.game, claws.playerId, 269, mon2, 'monster'), 269)).toBe(true)
    expect(casted(castOn(claws.game, claws.playerId, 260, mon2, 'monster'), 260)).toBe(true)
  })

  it('maps Fists of Fire to fire and Claws of Thunder to lightning damage channels', () => {
    const { g } = setup(0x181b, 'ass', {})
    expect(g.resolveSkillDamageChannel(259)).toBe('fire')
    expect(g.resolveSkillDamageChannel(269)).toBe('ltng')
    expect(g.resolveSkillDamageChannel(274)).toBe('cold')
  })
})
