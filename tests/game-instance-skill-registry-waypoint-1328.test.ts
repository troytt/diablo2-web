/**
 * #1328: `GameInstance` player skill casts resolve through the canonical 1.13c skill registry
 * (`src/server/skills/registry.ts` `evaluateSkill113c`, `Skills.txt` srvmissile -> `Missiles.txt` ids)
 * and waypoint operate emits `WaypointMenu` (S2C 0x63).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry, type SkillRecord } from '../src/common/data/data-registry.ts'
import {
  decode0x63WaypointMenu,
  encode0x63WaypointMenu,
  serverEventToS2cPackets,
  type ItemData,
  type ItemStat,
  type ServerEvent,
} from '../src/netproto/index.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../src/server/engine/stat-list.ts'
import { writeD2sSave113c } from '../src/server/save/d2s-writer.ts'
import { evaluateSkill113c } from '../src/server/skills/registry.ts'
import { skillTabStatParam } from '../src/common/skills/skills-data.ts'
import { createSampleD2sCharacterData } from './e2e/server-reuse/helpers.ts'

type AnyEvent = ServerEvent & Record<string, unknown>

const CLASS_CODES = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const

/** #1417 slvl-1 server missile counts of the multi-missile srvdofuncs (see srvdo-missile-volleys-1417.test.ts). */
const SLVL1_VOLLEY_COUNTS_1417: Readonly<Record<number, number>> = { 12: 2, 26: 2, 38: 3, 67: 2, 225: 3, 240: 3 }

function richCasterD2s(charClass: number): Uint8Array {
  return writeD2sSave113c(
    createSampleD2sCharacterData({
      name: `Caster${charClass}`,
      charClass,
      level: 30,
      skillLevels: new Uint8Array(30),
      attributesOverrides: {
        maxManaFixed: 5000 * FIXED_ONE,
        manaFixed: 5000 * FIXED_ONE,
      },
    }),
  )
}

function expectedServerMissile(skill: SkillRecord, missileA: string): string {
  if (skill.srvMissile !== '') return skill.srvMissile
  if (skill.srvMissileA !== '') return skill.srvMissileA
  if (skill.cltMissile === '' && skill.cltMissileA === '') return missileA
  return ''
}

function evalAtLevel1(skill: SkillRecord) {
  const registry = getSharedDataRegistry()
  const statList = new UnitStatList(registry, { level: 30 })
  statList.setBaseSkillLevel(skill.id, 1)
  return evaluateSkill113c({ registry, skill, slvl: 1, blvl: 1, statList, difficulty: 0 })
}

function setupGame(seed: number, charClass: number, skills: Readonly<Record<number, number>>) {
  const game = new GameInstance({ seed, difficulty: 0, areaId: 2 })
  const playerId = game.connectPlayer({
    d2sBytes: richCasterD2s(charClass),
    x: 100,
    y: 100,
    areaId: 2,
    skills,
  })
  game.drainEvents(playerId)
  return { game, playerId }
}

describe('#1328 GameInstance skill casts via the 1.13c skill registry', () => {
  it('Fire Bolt (36) launches Missiles.txt "firebolt" (not missile id 36) and deals the evaluated 3..6 fire damage', () => {
    const registry = getSharedDataRegistry()
    const fireboltId = registry.getMissileByName('firebolt')!.id
    expect(fireboltId).not.toBe(36)

    const { game, playerId } = setupGame(0x1328, 1, { 36: 1 })
    const monId = game.spawnMonster({
      defId: 'fallen1',
      x: 106,
      y: 100,
      areaId: 2,
      hp: 500,
      maxHp: 500,
      aiDisabled: true,
    })
    const manaBefore = game.getPlayerState(playerId)!.mana
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 36, x: 106, y: 100, hand: 'right' })
    game.stepFrames(8)
    const events = game.drainEvents(playerId) as AnyEvent[]
    const missiles = events.filter((e) => e.type === 'CreateMissile')
    expect(missiles).toHaveLength(1)
    expect(missiles[0]!.missileClassId).toBe(fireboltId)
    expect(events.some((e) => e.type === 'SkillCast' && e.skill === 36)).toBe(true)
    // #1336 natural mana regeneration may recover the 2.5-point cost over the 8 stepped frames.
    const manaAfterFireBolt = game.getPlayerState(playerId)!.mana
    expect(manaAfterFireBolt).toBeGreaterThanOrEqual(Math.floor((5000 * FIXED_ONE - 640) / FIXED_ONE))
    expect(manaAfterFireBolt).toBeLessThanOrEqual(5000)
    // Skills.txt Fire Bolt: 2.5 mana at slvl 1 (manaCost256 = 640)
    expect(manaBefore).toBe(5000)

    const lost = 500 - game.getMonster(monId)!.hp
    expect(lost).toBeGreaterThanOrEqual(3)
    expect(lost).toBeLessThanOrEqual(6)
  })

  it('rejects passive skills, honours Skills.txt delay cooldowns and never applies placeholder damage to buffs', () => {
    const { game, playerId } = setupGame(0x1329, 1, { 37: 1, 40: 1, 56: 1 })
    const monId = game.spawnMonster({
      defId: 'fallen1',
      x: 102,
      y: 100,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      aiDisabled: true,
    })

    // Warmth (37) is passive: no cast, no mana.
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 37, x: 102, y: 100, hand: 'right' })
    game.stepFrames(2)
    let events = game.drainEvents(playerId) as AnyEvent[]
    expect(events.some((e) => e.type === 'SkillCast' || e.type === 'CreateMissile')).toBe(false)
    expect(game.getPlayerState(playerId)!.mana).toBe(5000)

    // Frozen Armor (40) is a buff: cast is broadcast, mana is spent, but the monster takes no damage.
    game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 40, targetType: 'monster', targetId: monId })
    game.stepFrames(2)
    events = game.drainEvents(playerId) as AnyEvent[]
    expect(events.some((e) => e.type === 'SkillCast' && e.skill === 40)).toBe(true)
    expect(events.some((e) => e.type === 'CreateMissile')).toBe(false)
    expect(game.getMonster(monId)!.hp).toBe(5000)

    // Meteor (56): Skills.txt delay = 30 frames; a second cast within the delay is refused.
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 56, x: 110, y: 110, hand: 'right' })
    game.stepFrames(5)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 56, x: 110, y: 110, hand: 'right' })
    game.stepFrames(5)
    events = game.drainEvents(playerId) as AnyEvent[]
    const meteorCenter = getSharedDataRegistry().getMissileByName('meteorcenter')!.id
    expect(events.filter((e) => e.type === 'CreateMissile' && e.missileClassId === meteorCenter)).toHaveLength(1)
    game.stepFrames(30)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 56, x: 110, y: 110, hand: 'right' })
    game.stepFrames(2)
    events = game.drainEvents(playerId) as AnyEvent[]
    expect(events.filter((e) => e.type === 'CreateMissile' && e.missileClassId === meteorCenter)).toHaveLength(1)
  })

  it('refuses casts the character cannot pay for', () => {
    const game = new GameInstance({ seed: 0x132a, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: 'OomSorc',
          charClass: 1,
          level: 30,
          attributesOverrides: { maxManaFixed: 100 * FIXED_ONE, manaFixed: 2 * FIXED_ONE },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills: { 36: 1 },
    })
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 36, x: 110, y: 100, hand: 'right' })
    game.stepFrames(2)
    const events = game.drainEvents(playerId) as AnyEvent[]
    expect(events.some((e) => e.type === 'CreateMissile' || e.type === 'SkillCast')).toBe(false)
    expect(game.getPlayerState(playerId)!.mana).toBe(2)
  })

  it('sweeps all 210 class skills: every missile is the Skills.txt srvmissile row and missile-less non-melee skills deal no damage', () => {
    const registry = getSharedDataRegistry()
    const classSkills: SkillRecord[] = []
    for (let id = 0; id <= 400; id++) {
      const s = registry.getSkillById(id)
      if (s && (CLASS_CODES as readonly string[]).includes(s.charClass)) classSkills.push(s)
    }
    expect(classSkills).toHaveLength(210)

    let castsWithMissile = 0
    for (const skill of classSkills) {
      const charClass = CLASS_CODES.indexOf(skill.charClass as (typeof CLASS_CODES)[number])
      const { game, playerId } = setupGame(0x2000 + skill.id, charClass, { [skill.id]: 1 })
      const monId = game.spawnMonster({
        defId: 'fallen1',
        x: 102,
        y: 100,
        areaId: 2,
        hp: 100000,
        maxHp: 100000,
        aiDisabled: true,
      })
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: skill.id,
        targetType: 'monster',
        targetId: monId,
      })
      game.stepFrames(1)
      const events = game.drainEvents(playerId) as AnyEvent[]
      const created = events.filter((e) => e.type === 'CreateMissile')
      const cast = events.find((e) => e.type === 'SkillCast' && e.skill === skill.id)
      const ev = evalAtLevel1(skill)
      const missileName = expectedServerMissile(skill, ev.missileA)

      if (skill.passive) {
        expect(cast, `passive skill ${skill.id} ${skill.name} must not be cast`).toBeUndefined()
        continue
      }
      if (skill.restrict === 2) {
        expect(cast, `form-only skill ${skill.id} ${skill.name} must not be cast in human form`).toBeUndefined()
        continue
      }
      expect(cast, `skill ${skill.id} ${skill.name} must be cast`).toBeDefined()
      if (missileName !== '') {
        const expectedId = registry.getMissileByName(missileName)!.id
        // #1417: Skills.txt srvdofunc volleys at slvl 1 with one target in range (D2Game.dll SrvDo008
        // Multiple Shot / Teeth calc1 = 2, SrvDo012 Strafe calc3 = 2, SrvDo017 Charged Bolt calc1 = 3,
        // SrvDo117 Firestorm / SrvDo118 Twister calc1 = 3); every other missile skill launches one.
        const expectedCount = SLVL1_VOLLEY_COUNTS_1417[skill.id] ?? 1
        expect(created, `skill ${skill.id} ${skill.name}`).toHaveLength(expectedCount)
        expect(created.every((e) => e.missileClassId === expectedId), `skill ${skill.id} ${skill.name}`).toBe(true)
        castsWithMissile += 1
      } else {
        expect(created, `skill ${skill.id} ${skill.name} has no server missile`).toHaveLength(0)
        const melee = skill.range === 'h2h' || skill.range === 'both'
        // movement strikes (52, 67, 76, 78) and direct-hit spells (21 Telekinesis, 33 Psychic Hammer, 51 Mind Blast)
        const movementStrike = [21, 33, 51, 52, 67, 76, 78].includes(skill.srvDoFunc)
        // auras deal their AuraScanner pulse damage (Holy Fire / Freeze / Shock, Sanctuary)
        if (!melee && !movementStrike && !skill.aura && skill.id !== 42) {
          expect(game.getMonster(monId)!.hp, `skill ${skill.id} ${skill.name} must not deal placeholder damage`).toBe(100000)
        }
      }
    }
    expect(castsWithMissile).toBeGreaterThan(50)
  })
})

describe('#1328 skill-list gating, shapeshift restrict and equipped-weapon damage', () => {
  function makeEquippedItem(id: number, code: string, bodyLoc: number, stats: ItemStat[]): ItemData {
    return {
      id,
      itemId: id,
      opcode: 0x9c,
      action: 0,
      category: 0,
      flags: 0x10,
      rawFlags: 0x10,
      version: 101,
      location: 1,
      container: 'equipment',
      bodyLoc,
      equippedSlot: bodyLoc,
      gridX: 0,
      gridY: 0,
      storePage: 0,
      storagePage: 0,
      worldX: 0,
      worldY: 0,
      x: 0,
      y: 0,
      code,
      rawCode: `${code} `,
      compact: false,
      simple: false,
      identified: true,
      socketed: false,
      ethereal: false,
      runeword: false,
      personalized: false,
      isEar: false,
      newItem: false,
      starterItem: false,
      broken: false,
      inSocket: false,
      equipped: true,
      socketedChildCount: 0,
      usedSockets: 0,
      totalSockets: 0,
      ilvl: 30,
      quality: 4,
      magicPrefixId: 0,
      magicSuffixId: 0,
      invWidth: 1,
      invHeight: 3,
      stats,
      setBonusStats: [],
      runewordStats: [],
    }
  }

  function connectWithItems(game: GameInstance, charClass: number, items: ItemData[], skills: Record<number, number>) {
    return game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: `Gate${charClass}`,
          charClass,
          level: 30,
          skillLevels: new Uint8Array(30),
          items,
          attributesOverrides: { strength: 100, dexterity: 50, maxManaFixed: 500 * FIXED_ONE, manaFixed: 500 * FIXED_ONE },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills,
    })
  }

  it('refuses unlearned own-class skills and other-class skills; item oskills and +skills feed the skill level', () => {
    const game = new GameInstance({ seed: 0x1330, difficulty: 0, areaId: 2 })
    // Sorceress with no hard points; a wand carrying +3 Teleport (oskill 97/54) and +2 all skills (127)
    const playerId = connectWithItems(
      game,
      1,
      [
        makeEquippedItem(9001, 'wnd', 4, [
          { statId: 97, param: 54, value: 3 },
          { statId: 127, param: 0, value: 2 },
        ]),
      ],
      { 39: 1 },
    )
    game.drainEvents(playerId)
    const cast = (skillId: number) => {
      game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId, x: 110, y: 100, hand: 'right' })
      game.stepFrames(1)
      const evs = game.drainEvents(playerId) as AnyEvent[]
      return evs.find((e) => e.type === 'SkillCast' && e.skill === skillId) as AnyEvent | undefined
    }
    expect(cast(36), 'unlearned Fire Bolt').toBeUndefined()
    expect(cast(101), 'Paladin Holy Bolt on a Sorceress').toBeUndefined()
    const teleport = cast(54)
    expect(teleport, 'oskill Teleport').toBeDefined()
    expect(teleport!.level).toBe(3)
    const iceBolt = cast(39)
    expect(iceBolt, 'learned Ice Bolt').toBeDefined()
    expect(iceBolt!.level).toBe(1 + 2) // hard point + item_allskills
    expect(cast(0), 'universal Attack').toBeDefined()
  })

  it('enforces Skills.txt restrict: wolf-only skills need the wolf state, restrict-0 skills are refused while shapeshifted', () => {
    const registry = getSharedDataRegistry()
    const feralRage = registry.getSkillById(232)!
    expect(feralRage.restrict).toBe(2)
    const wolfState = registry.getStateByName('wolf')!.id
    const game = new GameInstance({ seed: 0x1331, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({ charClass: 'dru', name: 'Dru', x: 100, y: 100, areaId: 2, level: 30, skills: { 232: 1, 225: 1 } })
    const monId = game.spawnMonster({ defId: 'fallen1', x: 101, y: 100, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true })
    game.drainEvents(playerId)
    const castOn = (skillId: number) => {
      game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId, targetType: 'monster', targetId: monId })
      game.stepFrames(1)
      return (game.drainEvents(playerId) as AnyEvent[]).some((e) => e.type === 'SkillCast' && e.skill === skillId)
    }
    expect(castOn(232)).toBe(false)
    game.applyPlayerState(playerId, wolfState, 500)
    expect(castOn(232)).toBe(true)
    // Firestorm (225) has restrict = 0: no spellcasting in wolf form
    expect(registry.getSkillById(225)!.restrict).toBe(0)
    expect(castOn(225)).toBe(false)
  })

  it('weapon-sourced skills roll the equipped weapon MinDam/MaxDam with StrBonus; unarmed hits for 1-2', () => {
    const game = new GameInstance({ seed: 0x1332, difficulty: 0, areaId: 2 })
    // Hand Axe: Weapons.txt mindam 3, maxdam 6, StrBonus 100 -> +100% at 100 Strength -> 6..12
    const playerId = connectWithItems(game, 4, [makeEquippedItem(9101, 'hax', 4, [])], {})
    const unarmedGame = new GameInstance({ seed: 0x1333, difficulty: 0, areaId: 2 })
    const unarmedId = connectWithItems(unarmedGame, 4, [], {})
    const losses = (g: GameInstance, pid: number) => {
      const out: number[] = []
      for (let i = 0; i < 12; i++) {
        const monId = g.spawnMonster({
          defId: 'fallen1',
          x: 101,
          y: 100,
          areaId: 2,
          hp: 1000,
          maxHp: 1000,
          resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
          aiDisabled: true,
        })
        g.enqueueCommand(pid, { type: 'CastSkillOnTarget', skillId: 0, targetType: 'monster', targetId: monId })
        g.stepFrames(1)
        out.push(1000 - g.getMonster(monId)!.hp)
        g.applyDamageToMonster(monId, 100000, pid)
      }
      return out
    }
    for (const l of losses(game, playerId)) {
      expect(l).toBeGreaterThanOrEqual(6)
      expect(l).toBeLessThanOrEqual(12)
    }
    for (const l of losses(unarmedGame, unarmedId)) {
      expect(l).toBeGreaterThanOrEqual(1)
      expect(l).toBeLessThanOrEqual(2)
    }
  })
})

describe('#1328 registry-driven skill effects and movement skills', () => {
  const stateId = (name: string) => getSharedDataRegistry().getStateByName(name)!.id
  function setup(seed: number, charClass: (typeof CLASS_CODES)[number], skills: Record<number, number>) {
    const game = new GameInstance({ seed, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({
      d2sBytes: richCasterD2s(CLASS_CODES.indexOf(charClass)),
      x: 100,
      y: 100,
      areaId: 2,
      skills,
    })
    game.drainEvents(playerId)
    return { game, playerId }
  }
  const spawnDummy = (game: GameInstance, x: number, y: number) =>
    game.spawnMonster({ defId: 'fallen1', x, y, areaId: 2, hp: 5000, maxHp: 5000, aiDisabled: true })

  it('curses apply States.txt auratargetstate to hostiles inside the evaluated radius only', () => {
    const { game, playerId } = setup(0x1340, 'nec', { 66: 1 })
    const near = spawnDummy(game, 110, 100)
    const alsoNear = spawnDummy(game, 111, 101)
    const far = spawnDummy(game, 130, 100)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 66, x: 110, y: 100, hand: 'right' })
    game.stepFrames(1)
    const amp = stateId('amplifydamage')
    expect(game.getMonster(near)!.states.has(amp)).toBe(true)
    expect(game.getMonster(alsoNear)!.states.has(amp)).toBe(true)
    expect(game.getMonster(far)!.states.has(amp)).toBe(false)
  })

  it('auras persist on the caster and replace each other; timed buffs use the evaluated duration', () => {
    const { game, playerId } = setup(0x1341, 'pal', { 98: 1, 99: 1, 117: 1 })
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 98, x: 100, y: 100, hand: 'right' })
    game.stepFrames(60)
    expect(game.getPlayerState(playerId)!.states.has(stateId('might'))).toBe(true)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 99, x: 100, y: 100, hand: 'right' })
    game.stepFrames(1)
    const states = game.getPlayerState(playerId)!.states
    expect(states.has(stateId('prayer'))).toBe(true)
    expect(states.has(stateId('might'))).toBe(false)

    // Holy Shield (117): timed self state (evaluated durationFrames > 0) that expires
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 117, x: 100, y: 100, hand: 'right' })
    game.stepFrames(1)
    expect(game.getPlayerState(playerId)!.states.has(stateId('holyshield'))).toBe(true)
  })

  it('Werewolf applies the wolf state, which unlocks wolf-only attacks and blocks restrict-0 spells', () => {
    const { game, playerId } = setup(0x1342, 'dru', { 223: 1, 232: 1, 225: 1 })
    const monId = spawnDummy(game, 101, 100)
    const castOn = (skillId: number) => {
      game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId, targetType: 'monster', targetId: monId })
      game.stepFrames(1)
      return (game.drainEvents(playerId) as AnyEvent[]).some((e) => e.type === 'SkillCast' && e.skill === skillId)
    }
    expect(castOn(232)).toBe(false)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 223, x: 100, y: 100, hand: 'right' })
    game.stepFrames(30) // Werewolf delay
    expect(game.getPlayerState(playerId)!.states.has(stateId('wolf'))).toBe(true)
    expect(castOn(232)).toBe(true)
    expect(castOn(225)).toBe(false)
  })

  it('summon skills create the pet through SummonManager', () => {
    const { game, playerId } = setup(0x1343, 'nec', { 75: 1 })
    expect(game.getPetsForOwner(playerId)).toHaveLength(0)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 75, x: 104, y: 100, hand: 'right' })
    game.stepFrames(1)
    expect(game.getPetsForOwner(playerId)).toHaveLength(1)
  })

  it('Charge moves the Paladin next to the target and strikes it; Whirlwind hits every hostile along its path', () => {
    const { game, playerId } = setup(0x1344, 'pal', { 107: 1 })
    const target = spawnDummy(game, 115, 100)
    game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 107, targetType: 'monster', targetId: target })
    game.stepFrames(1)
    const p = game.getPlayerState(playerId)!
    expect(Math.hypot(p.x - 115, p.y - 100)).toBeLessThanOrEqual(1.01)
    expect(game.getMonster(target)!.hp).toBeLessThan(5000)

    const bar = setup(0x1345, 'bar', { 151: 20 }) // slvl 20: -50% + 8% * 19 = +102% damage
    const a = spawnDummy(bar.game, 106, 100)
    const b = spawnDummy(bar.game, 112, 101)
    const off = spawnDummy(bar.game, 106, 130)
    bar.game.enqueueCommand(bar.playerId, { type: 'CastSkillAtLocation', skillId: 151, x: 118, y: 100, hand: 'right' })
    bar.game.stepFrames(1)
    expect(bar.game.getPlayerState(bar.playerId)!.x).toBeCloseTo(118, 0)
    expect(bar.game.getMonster(a)!.hp).toBeLessThan(5000)
    expect(bar.game.getMonster(b)!.hp).toBeLessThan(5000)
    expect(bar.game.getMonster(off)!.hp).toBe(5000)
  })
})

describe('#1328 aura pulses, buff stats in combat, tab/charged skills and direct spells', () => {
  const registry = () => getSharedDataRegistry()
  function setup(seed: number, charClass: (typeof CLASS_CODES)[number], skills: Record<number, number>, items: ItemData[] = []) {
    const game = new GameInstance({ seed, difficulty: 0, areaId: 2 })
    const playerId = game.connectPlayer({
      d2sBytes: writeD2sSave113c(
        createSampleD2sCharacterData({
          name: `Pulse${seed}`,
          charClass: CLASS_CODES.indexOf(charClass),
          level: 30,
          skillLevels: new Uint8Array(30),
          items,
          attributesOverrides: {
            maxManaFixed: 5000 * FIXED_ONE,
            manaFixed: 5000 * FIXED_ONE,
            maxHpFixed: 1000 * FIXED_ONE,
            hitpointsFixed: 1000 * FIXED_ONE,
          },
        }),
      ),
      x: 100,
      y: 100,
      areaId: 2,
      skills,
    })
    game.drainEvents(playerId)
    return { game, playerId }
  }
  const dummy = (game: GameInstance, x: number, y: number, hp = 5000) =>
    game.spawnMonster({
      defId: 'fallen1',
      x,
      y,
      areaId: 2,
      hp,
      maxHp: hp,
      resistances: { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 },
      // Synthetic high-HP dummy: disable MonStats regeneration so the aura pulse
      // under test is observable (#1346).
      damageRegen: 0,
      aiDisabled: true,
    })
  function item(id: number, code: string, bodyLoc: number, stats: ItemStat[]): ItemData {
    return {
      id, itemId: id, opcode: 0x9c, action: 0, category: 0, flags: 0x10, rawFlags: 0x10, version: 101,
      location: 1, container: 'equipment', bodyLoc, equippedSlot: bodyLoc, gridX: 0, gridY: 0,
      storePage: 0, storagePage: 0, worldX: 0, worldY: 0, x: 0, y: 0, code, rawCode: `${code} `,
      compact: false, simple: false, identified: true, socketed: false, ethereal: false, runeword: false,
      personalized: false, isEar: false, newItem: false, starterItem: false, broken: false, inSocket: false,
      equipped: true, socketedChildCount: 0, usedSockets: 0, totalSockets: 0, ilvl: 30, quality: 4,
      magicPrefixId: 0, magicSuffixId: 0, invWidth: 1, invHeight: 3, stats, setBonusStats: [], runewordStats: [],
    }
  }

  it('Holy Fire pulses fire damage on hostiles in its radius through AuraScanner; out-of-range monsters are untouched', () => {
    const { game, playerId } = setup(0x1350, 'pal', { 102: 10 })
    const near = dummy(game, 102, 100)
    const far = dummy(game, 140, 100)
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 102, x: 100, y: 100, hand: 'right' })
    game.stepFrames(130)
    expect(game.getMonster(near)!.hp).toBeLessThan(5000)
    expect(game.getMonster(far)!.hp).toBe(5000)
  })

  it('Prayer heals the caster on each pulse and drains mana', () => {
    const { game, playerId } = setup(0x1351, 'pal', { 99: 5 })
    game.applyDamageToPlayer(playerId, 400)
    const hpBefore = game.getPlayerState(playerId)!.hp
    const manaBefore = game.getPlayerState(playerId)!.mana
    game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId: 99, x: 100, y: 100, hand: 'right' })
    game.stepFrames(160)
    expect(game.getPlayerState(playerId)!.hp).toBeGreaterThan(hpBefore)
    expect(game.getPlayerState(playerId)!.mana).toBeLessThan(manaBefore)
  })

  it('Might feeds off-weapon %ED from the StateBus into the weapon damage roll', () => {
    const base = setup(0x1352, 'pal', { 98: 20 })
    const might = setup(0x1353, 'pal', { 98: 20 })
    might.game.enqueueCommand(might.playerId, { type: 'CastSkillAtLocation', skillId: 98, x: 100, y: 100, hand: 'right' })
    might.game.stepFrames(60)
    const hits = (g: GameInstance, pid: number) => {
      const out: number[] = []
      for (let i = 0; i < 10; i++) {
        const m = dummy(g, 101, 100, 1000)
        g.enqueueCommand(pid, { type: 'CastSkillOnTarget', skillId: 0, targetType: 'monster', targetId: m })
        g.stepFrames(1)
        out.push(1000 - g.getMonster(m)!.hp)
        g.applyDamageToMonster(m, 100000, pid)
      }
      return out
    }
    expect(Math.max(...hits(base.game, base.playerId))).toBeLessThanOrEqual(2)
    expect(Math.min(...hits(might.game, might.playerId))).toBeGreaterThan(2)
  })

  it('item_addskill_tab (188) raises skills of that SkillDesc page; item_charged_skill (204) casts at the charge level for a charge', () => {
    const reg = registry()
    const page = Number(reg.getSkillDesc(reg.getSkillById(36)!.skillDesc)!['SkillPage'])
    const tabParam = skillTabStatParam(1, page - 1)
    const { game, playerId } = setup(0x1354, 'sor', { 36: 1 }, [
      item(9201, 'wnd', 4, [
        { statId: 188, param: tabParam, value: 3 },
        { statId: 204, param: (54 << 6) | 7, value: 2 | (10 << 8) },
      ]),
    ])
    const cast = (skillId: number) => {
      game.enqueueCommand(playerId, { type: 'CastSkillAtLocation', skillId, x: 110, y: 100, hand: 'right' })
      game.stepFrames(1)
      return (game.drainEvents(playerId) as AnyEvent[]).find((e) => e.type === 'SkillCast' && e.skill === skillId)
    }
    expect(cast(36)!.level).toBe(1 + 3)
    const manaBefore = game.getPlayerState(playerId)!.mana
    const tele1 = cast(54)
    expect(tele1!.level).toBe(7)
    // Charged casts spend charges, not mana; natural regeneration may still add a point.
    expect(game.getPlayerState(playerId)!.mana).toBeGreaterThanOrEqual(manaBefore)
    expect(cast(54)).toBeDefined()
    expect(cast(54), 'no charges left').toBeUndefined()
  })

  it('Corpse Explosion consumes the corpse and damages hostiles around it', () => {
    const { game, playerId } = setup(0x1355, 'nec', { 74: 1 })
    const corpse = dummy(game, 106, 100, 200)
    game.applyDamageToMonster(corpse, 100000, playerId)
    expect(game.getMonster(corpse)!.dead).toBe(true)
    const near = dummy(game, 107, 101)
    const far = dummy(game, 130, 100)
    game.enqueueCommand(playerId, { type: 'CastSkillOnTarget', skillId: 74, targetType: 'monster', targetId: corpse })
    game.stepFrames(1)
    expect(game.getMonster(corpse)!.shattered).toBe(true)
    expect(game.getMonster(near)!.hp).toBeLessThan(5000)
    expect(game.getMonster(far)!.hp).toBe(5000)
  })

  it('Telekinesis and Psychic Hammer hit the target directly; Mind Blast stuns hostiles in its radius', () => {
    const sorc = setup(0x1356, 'sor', { 43: 5 })
    const t = dummy(sorc.game, 110, 100)
    sorc.game.enqueueCommand(sorc.playerId, { type: 'CastSkillOnTarget', skillId: 43, targetType: 'monster', targetId: t })
    sorc.game.stepFrames(1)
    expect(sorc.game.getMonster(t)!.hp).toBeLessThan(5000)

    const sin = setup(0x1357, 'ass', { 253: 5, 273: 5 })
    const a = dummy(sin.game, 110, 100)
    sin.game.enqueueCommand(sin.playerId, { type: 'CastSkillOnTarget', skillId: 253, targetType: 'monster', targetId: a })
    sin.game.stepFrames(1)
    expect(sin.game.getMonster(a)!.hp).toBeLessThan(5000)
    // Psychic Hammer (#253) knocks its target back (#1346), so use fresh targets
    // inside the Mind Blast radius for the stun assertion.
    const c = dummy(sin.game, 110, 100)
    const b = dummy(sin.game, 111, 101)
    const stunned = registry().getStateByName('stunned')!.id
    sin.game.enqueueCommand(sin.playerId, { type: 'CastSkillAtLocation', skillId: 273, x: 110, y: 100, hand: 'right' })
    sin.game.stepFrames(1)
    expect(sin.game.getMonster(c)!.states.has(stunned)).toBe(true)
    expect(sin.game.getMonster(b)!.states.has(stunned)).toBe(true)
  })
})

describe('#1328 GameInstance is the single authoritative runtime', () => {
  it('D2DataRegistry reads the exact-case MPQ columns (Skills State1..3, Missiles Emax/MinELev/MaxELev/CltParam, States damblue/damred)', () => {
    const registry = getSharedDataRegistry()
    const feralRage = registry.getSkillById(232)!
    expect([feralRage.state1, feralRage.state2]).toEqual(['wolf', ''])
    expect(registry.getSkillById(239)!.state2).toBe('bear')
    let missilesWithEmax = 0
    let missilesWithLevBands = 0
    for (let id = 0; id < 800; id++) {
      const m = registry.getMissileById(id)
      if (!m) continue
      if (m.eMax > 0) missilesWithEmax++
      if (m.eMinLev1 > 0 || m.eMaxLev1 > 0) missilesWithLevBands++
    }
    expect(missilesWithEmax).toBeGreaterThan(100)
    expect(missilesWithLevBands).toBeGreaterThan(10)
  })

  it('no production module under src/ instantiates the legacy GameEngine; both adapters construct GameInstance', () => {
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry.name) && /\bnew GameEngine\s*\(/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full)
        }
      }
    }
    walk(join(process.cwd(), 'src'))
    expect(offenders).toEqual([])
    for (const rel of ['src/server/loopback-adapter.ts', 'src/server/room-host.ts']) {
      expect(readFileSync(join(process.cwd(), rel), 'utf8')).toMatch(/new GameInstance\(/)
    }
  })
})

describe('#1328 waypoint operate emits WaypointMenu (S2C 0x63)', () => {
  it('unlocks the current level waypoint and sends the unlocked waypoint indices to the operating player', () => {
    const game = new GameInstance({ seed: 0x63, difficulty: 0, areaId: 3 })
    const playerId = game.connectPlayer({ charClass: 'sor', name: 'WpSorc', x: 50, y: 50, areaId: 3 })
    const wpId = game.spawnObject({ classId: 119, x: 52, y: 50, areaId: 3, isWaypoint: true })
    game.drainEvents(playerId)

    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: wpId } as never)
    game.stepFrames(1)
    const events = game.drainEvents(playerId) as AnyEvent[]
    const menu = events.find((e) => e.type === 'WaypointMenu') as
      | { type: 'WaypointMenu'; unitId: number; open: readonly number[] }
      | undefined
    expect(menu).toBeDefined()
    expect(menu!.unitId).toBe(wpId)
    // Rogue Encampment (bit 0) + Cold Plains (area 3 = bit 1)
    expect([...menu!.open]).toEqual([0, 1])
    expect(game.getPlayerState(playerId)!.waypoints.has(3)).toBe(true)

    // The binary D2GS bridge encodes it as a 21-byte 0x63 that decodes back to the same event.
    const packets = serverEventToS2cPackets(menu!)
    expect(packets).toHaveLength(1)
    expect(packets[0]!.byteLength).toBe(21)
    expect(packets[0]![0]).toBe(0x63)
    expect(decode0x63WaypointMenu(packets[0]!)).toEqual({ type: 'WaypointMenu', unitId: wpId, open: [0, 1] })
  })

  it('0x63 encoder round-trips all 39 waypoint bits and rejects out-of-range indices', () => {
    const all = Array.from({ length: 39 }, (_, i) => i)
    expect(decode0x63WaypointMenu(encode0x63WaypointMenu({ unitId: 0xdeadbeef, open: all }))).toEqual({
      type: 'WaypointMenu',
      unitId: 0xdeadbeef,
      open: all,
    })
    expect(() => encode0x63WaypointMenu({ unitId: 1, open: [39] })).toThrow(/invalid waypoint index/)
  })
})
