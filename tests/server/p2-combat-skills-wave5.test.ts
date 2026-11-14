/**
 * Wave 5 P2 Combat, Stats, Missile & Player Skill Parity Suite
 * (`#1935`, `#1936`, `#1937`, `#1938`, `#1939`, `#1940`, `#1941`, `#1942`,
 *  `#1943`, `#1944`, `#1945`).
 *
 * Ground truth: Diablo II: Lord of Destruction v1.13c (`D2Game.dll`, `D2Common.dll`,
 * `D2Client.dll`, and MPQ `Skills.txt`, `Missiles.txt`, `States.txt`, `ItemStatCost.txt`).
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import {
  FIXED_ONE,
  UnitStatList,
} from '../../src/server/engine/stat-list.ts'

type AnyRec = Record<string, any>

const registry = getSharedDataRegistry()
let nextItemId = 50_000

function makeItem(
  code: string,
  bodyLoc: number,
  rawStats: { statId: number; param?: number; value: number }[] = [],
  extra: AnyRec = {},
): AnyRec {
  const statsMap = new Map<number, number>()
  for (const st of rawStats) {
    statsMap.set(st.statId, (statsMap.get(st.statId) ?? 0) + st.value)
  }
  return {
    unitId: nextItemId++,
    code,
    name: code,
    quality: 4,
    level: 85,
    location: 'equipped',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    bodyLoc,
    identified: true,
    ethereal: false,
    socketed: false,
    totalSockets: 0,
    durability: 20,
    maxDurability: 20,
    quantity: 1,
    stats: statsMap,
    socketedItems: [],
    rawItemData: {
      identified: true,
      ethereal: false,
      stats: rawStats.map((s) => ({ statId: s.statId, param: s.param ?? 0, value: s.value })),
      runewordStats: [],
    },
    ...extra,
  }
}

function makeUnitCtx(
  id: string,
  unitType: NonNullable<CombatUnitContext['unitType']>,
  charClass?: string,
  extra: Partial<CombatUnitContext> = {},
): CombatUnitContext {
  const statList = new UnitStatList(
    registry,
    undefined,
    unitType === 'player'
      ? { ownerType: 'player', ...(charClass !== undefined ? { charClass } : {}) }
      : { ownerType: 'monster' },
  )
  statList.setBaseStat('level', 80)
  statList.setBaseStat('maxhp', 4000 * FIXED_ONE)
  statList.setHp256(4000 * FIXED_ONE)
  const stateBus = new StateBus(statList, registry)
  return {
    id,
    name: id,
    ...(charClass !== undefined ? { charClass } : {}),
    statList,
    stateBus,
    x: 50,
    y: 50,
    ...extra,
    unitType,
  }
}

function setupRoom(
  seed: number,
  charClass: string,
  skills: Record<number, number> = {},
  difficulty: 0 | 1 | 2 = 0,
): { game: GameInstance; g: AnyRec; pid: number; player: AnyRec } {
  const game = new GameInstance({ seed, difficulty, areaId: 2, maxPlayers: 8 })
  const pid = game.connectPlayer({
    charClass,
    name: `W5${charClass}`,
    x: 50,
    y: 50,
    areaId: 2,
    skills,
  })
  const g = game as unknown as AnyRec
  const player = g.players.get(pid)
  player.level = 80
  player.maxHp = 3000
  player.hp = 3000
  player.maxHpFixed = 3000 * FIXED_ONE
  player.hpFixed = 3000 * FIXED_ONE
  player.maxMana = 1000
  player.mana = 1000
  player.maxManaFixed = 1000 * FIXED_ONE
  player.manaFixed = 1000 * FIXED_ONE
  player.strength = 100
  player.dexterity = 100
  player.ar = 50_000
  game.drainEvents(pid)
  return { game, g, pid, player }
}

function spawnDummy(
  game: GameInstance,
  g: AnyRec,
  defId = 'fallen1',
  x = 52,
  y = 50,
  hp = 50_000,
): AnyRec {
  const monId = game.spawnMonster({ defId, x, y, areaId: 2, hp, maxHp: hp, aiDisabled: true })
  const mon = g.monsters.get(monId)
  mon.ac = 0
  mon.toBlock = 0
  mon.resistances = { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }
  return mon
}

describe('Wave 5 P2 Combat, Stats, Missile & Player Skill Parity (#1935..#1945)', () => {
  describe('#1935: Curse Resistance (stat 109) & #109 Cleansing curable curse/poison shortening', () => {
    it('scales incoming curse duration by curse_resistance in applyUnitState and skips when >= 100%', () => {
      const { g, player } = setupRoom(193501, 'Ass', { 267: 11 })
      // Cast Fade (#267) at slvl 11 -> dm34(40, 90, 11) = 75% curse_resistance
      g.applyPlayerSkillEffect(
        player,
        g.resolvePlayerSkillCast(player, 267, player.x, player.y),
        player.x,
        player.y,
        undefined,
      )
      expect(player.states.has(159)).toBe(true)

      // Incoming Amplify Damage (state 9, curse=1, curable=1) for 1000 frames -> floor(1000 * 25 / 100) = 250 frames
      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 9, 1000)
      expect(player.states.has(9)).toBe(true)
      expect(player.stateTimers.get(9)).toBe(250)

      // 100% curse_resistance blocks incoming curses completely
      player.items.push(makeItem('rin', 6, [{ statId: 109, value: 100 }]))
      g.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 9)
      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 9, 1000)
      expect(player.states.has(9)).toBe(false)
    })

    it('Cleansing (#109) shortens curable curses and poison (state 2) without shortening shrines (128..137) or cloaked (156)', () => {
      const statList = new UnitStatList(registry, undefined, { ownerType: 'player', charClass: 'Pal' })
      const bus = new StateBus(statList, registry)

      // Apply Experience Shrine (state 137: curse=true, curable=false) for 1000 frames
      bus.applyState({ stateNameOrId: 137, durationFrames: 1000, currentFrame: 0 })
      expect(bus.getState(137)?.durationFrames).toBe(1000)

      // Cleansing pulse at 50% reduction must NOT shorten Shrine (137)
      bus.reduceCurseAndPoisonDurations(0, 50)
      expect(bus.getState(137)?.durationFrames).toBe(1000)

      // Apply Amplify Damage (state 9: curse=true, curable=true) for 200 frames & Poison (state 2) for 100 frames
      bus.applyState({ stateNameOrId: 9, durationFrames: 200, currentFrame: 0 })
      bus.applyState({ stateNameOrId: 2, durationFrames: 100, currentFrame: 0 })
      expect(bus.hasState(137)).toBe(false) // evicted by single curse slot

      bus.reduceCurseAndPoisonDurations(0, 50)
      expect(bus.getState(9)?.durationFrames).toBe(100)
      expect(bus.getState(2)?.durationFrames).toBe(50)

      // Cloaked (state 156: curse=true, curable=false) is not shortened by Cleansing
      const monStats = new UnitStatList(registry, undefined, { ownerType: 'monster' })
      const monBus = new StateBus(monStats, registry)
      monBus.applyState({ stateNameOrId: 156, durationFrames: 300, currentFrame: 0 })
      monBus.reduceCurseAndPoisonDurations(0, 50)
      expect(monBus.getState(156)?.durationFrames).toBe(300)
    })
  })

  describe('#1936: -Monster Defense Per Hit (item_damagetargetac, stat 120)', () => {
    it('subtracts full stat 120 from monster AC on landed physical hits and floor(stat120 / 2) in PvP', () => {
      const { game, g, player } = setupRoom(193601, 'Bar')
      player.items.push(
        makeItem('axe', 4, [{ statId: 120, value: -100 }]), // Malice runeword -100 monster defense per hit
      )
      const mon = spawnDummy(game, g, 'fallen1', 51, 50, 10_000)
      mon.ac = 350

      g.applyDamageToMonster(player, mon, 50, 0, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(mon.ac).toBe(250)

      // Pure elemental spells (without physical hit) do NOT apply stat 120
      g.applyDamageToMonster(player, mon, 50, 36, 'fire', 'player', {
        attackKind: 'spell',
        autoHit: true,
      })
      expect(mon.ac).toBe(250)

      // PvP target receives floor(100 / 2) = 50 defense reduction per hit
      const atkCtx = makeUnitCtx('atk', 'player', 'Bar')
      atkCtx.statList.setBaseStat('item_damagetargetac', -100)
      const defCtx = makeUnitCtx('def', 'player', 'Pal')
      defCtx.statList.setBaseStat('armorclass', 500)
      const res = executeSUnitDmg(
        atkCtx,
        defCtx,
        {
          skillId: 0,
          attackKind: 'melee',
          srcDam: 128,
          flatPhysMin256: 40 * FIXED_ONE,
          flatPhysMax256: 40 * FIXED_ONE,
          autoHit: true,
        },
        new D2Rng(42),
      )
      expect(res.hit).toBe(true)
      expect(res.targetDefenseReduction).toBe(50)
    })
  })

  describe('#1937: Hit Blinds Target (stat 113) & Hit Causes Monster to Flee (stat 112)', () => {
    it('applies Dim Vision (state 23) and Terror (state 56) on normal/minion monsters and blocks on Unique/Boss/Attract', () => {
      const { game, g, player } = setupRoom(193701, 'Ama')
      player.level = 85
      player.items.push(
        makeItem('bow', 4, [
          { statId: 113, value: 20 }, // Hit Blinds Target +20 -> 100% chance vs mlvl 10
        ]),
      )
      const normalMon = spawnDummy(game, g, 'fallen1', 51, 50, 10_000)
      normalMon.level = 10
      // Seed Amplify Damage (state 9) first to verify curse slot eviction
      g.applyMonsterState(normalMon.unitId, 9, 200)
      expect(normalMon.states.has(9)).toBe(true)

      g.applyDamageToMonster(player, normalMon, 50, 0, 'phys', 'player', {
        attackKind: 'missile',
        srcDam: 128,
        autoHit: true,
      })
      expect(normalMon.states.has(23)).toBe(true)
      expect(normalMon.states.has(9)).toBe(false) // evicted by Dim Vision

      // Hit Causes Monster to Flee (stat 112 = 128 -> 100%) applies state 56 & fleeTicks and evicts state 23
      player.items = [makeItem('bow', 4, [{ statId: 112, value: 128 }])]
      g.applyDamageToMonster(player, normalMon, 50, 0, 'phys', 'player', {
        attackKind: 'missile',
        srcDam: 128,
        autoHit: true,
      })
      expect(normalMon.states.has(56)).toBe(true)
      expect(normalMon.fleeTicks).toBeGreaterThan(0)
      expect(normalMon.states.has(23)).toBe(false)

      // Unique / Champion / Boss monsters are immune to both stat 113 and stat 112
      const uniqueMon = spawnDummy(game, g, 'fallen1', 53, 50, 10_000)
      uniqueMon.rank = 'unique'
      uniqueMon.level = 10
      player.items = [
        makeItem('bow', 4, [
          { statId: 113, value: 20 },
          { statId: 112, value: 128 },
        ]),
      ]
      g.applyDamageToMonster(player, uniqueMon, 50, 0, 'phys', 'player', {
        attackKind: 'missile',
        srcDam: 128,
        autoHit: true,
      })
      expect(uniqueMon.states.has(23)).toBe(false)
      expect(uniqueMon.states.has(56)).toBe(false)
    })
  })

  describe('#1938: Life/Mana After Each Kill (stat 86, 138, 139) kill-attribution', () => {
    it('grants player LAEK/MAEK/LADK on direct player kills and blocks them on merc/pet/trap kills', () => {
      const { game, g, player } = setupRoom(193801, 'Ass')
      player.hp = 1000
      player.hpFixed = 1000 * FIXED_ONE
      player.mana = 200
      player.manaFixed = 200 * FIXED_ONE
      player.items.push(
        makeItem('rin', 6, [
          { statId: 86, value: 15 }, // +15 Life After Each Kill
          { statId: 138, value: 10 }, // +10 Mana After Each Kill
          { statId: 139, value: 20 }, // +20 Life After Each Demon Kill
        ]),
      )

      // 1) Direct player kill on a demon ('fallen1' is demon) grants +15 + 20 = +35 life and +10 mana
      const demon1 = spawnDummy(game, g, 'fallen1', 51, 50, 50)
      demon1.isDemon = true
      g.applyDamageToMonster(player, demon1, 100, 0, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(demon1.dead).toBe(true)
      expect(player.hp).toBe(1035)
      expect(player.mana).toBe(210)

      // 2) Pet / Sentry Trap kill (`fromPet: true`) must NOT grant player LAEK/MAEK/LADK
      const demon2 = spawnDummy(game, g, 'fallen1', 52, 50, 50)
      demon2.isDemon = true
      g.applyDamageToMonster(player, demon2, 100, 271, 'ltng', 'player', {
        attackKind: 'spell',
        autoHit: true,
        fromPet: true,
      })
      expect(demon2.dead).toBe(true)
      expect(player.hp).toBe(1035)
      expect(player.mana).toBe(210)

      // 3) Mercenary kill (`source = merc`) must NOT grant player LAEK/MAEK, but heals merc by merc's own LAEK
      const mercId = 9001
      const merc: AnyRec = {
        unitId: mercId,
        ownerPlayerId: player.unitId,
        name: 'Emilio',
        act: 2,
        subType: 'combat',
        difficulty: 0,
        level: 80,
        experience: 0,
        hp: 500,
        maxHp: 1500,
        strength: 180,
        dexterity: 140,
        defense: 800,
        ar: 2000,
        minDmg: 80,
        maxDmg: 120,
        fireRes: 50,
        coldRes: 50,
        lightRes: 50,
        poisonRes: 50,
        x: 51,
        y: 50,
        areaId: 2,
        alive: true,
        equipment: [makeItem('hlm', 1, [{ statId: 86, value: 25 }])],
        items: [makeItem('hlm', 1, [{ statId: 86, value: 25 }])],
        states: new Set<number>(),
        stateTimers: new Map<number, number>(),
      }
      g.mercenaries.set(mercId, merc)
      const demon3 = spawnDummy(game, g, 'fallen1', 53, 50, 50)
      demon3.isDemon = true
      g.applyDamageToMonster(player, demon3, 100, 0, 'phys', merc, {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(demon3.dead).toBe(true)
      expect(player.hp).toBe(1035)
      expect(player.mana).toBe(210)
      expect(merc.hp).toBe(525)
    })
  })

  describe('#1939: Cannot Be Frozen (stat 153) & Half Freeze Duration (stat 118)', () => {
    it('blocks cold/freeze states (11 & 1) with stat 153 and halves duration once with stat 118 while preserving Holy Freeze (state 44)', () => {
      const { g, player } = setupRoom(193901, 'Pal')

      // Half Freeze Duration (stat 118) halves state 11 duration from 100 -> 50 frames
      player.items = [makeItem('rin', 6, [{ statId: 118, value: 1 }])]
      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 11, 100)
      expect(player.states.has(11)).toBe(true)
      expect(player.stateTimers.get(11)).toBe(50)
      g.clearUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 11)

      // Cannot Be Frozen (stat 153) blocks state 11 (cold) and state 1 (freeze), but NOT state 44 (Holy Freeze)
      player.items = [makeItem('rin', 6, [{ statId: 153, value: 1 }])]
      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 11, 100)
      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 1, 100)
      expect(player.states.has(11)).toBe(false)
      expect(player.states.has(1)).toBe(false)

      g.applyUnitState(player.states, player.stateTimers, 'player', player.unitId, player.areaId, 44, 100)
      expect(player.states.has(44)).toBe(true)
    })
  })

  describe('#1940: Monster hit-recovery (gethit) & 256ths minimum damage parity', () => {
    it('prevents pure poison and ground fire from triggering monster gethit, and avoids 1 HP floor on immune monsters', () => {
      const { game, g, player } = setupRoom(194001, 'Sor')
      const mon = spawnDummy(game, g, 'fallen1', 51, 50, 100)
      mon.mode = 1 // neutral

      // Ground fire tick (`isGroundFire: true`) deals damage but NEVER sets mode 4 (MONMODE_GETHIT)
      g.applyDamageToMonster(player, mon, 40, 51, 'fire', 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        isGroundFire: true,
      })
      expect(mon.hp).toBe(60)
      expect(mon.mode).not.toBe(4)

      // Pure poison (`channel === 'pois'`) applies poison DoT & ticks damage without EVER setting mode 4
      g.applyDamageToMonster(player, mon, 30, 73, 'pois', 'player', {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(mon.mode).not.toBe(4)
      for (let f = 0; f < 55; f++) {
        g.stepMonsterPoison(mon)
        expect(mon.mode).not.toBe(4)
      }
      expect(mon.hp).toBe(30)

      // Immune monster (fire resist 100) takes 0 damage (no artificial Math.max(1, ...) floor)
      const immuneMon = spawnDummy(game, g, 'fallen1', 53, 50, 500)
      immuneMon.resistances.fire = 100
      g.applyDamageToMonster(player, immuneMon, 200, 36, 'fire', 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
      })
      expect(immuneMon.hp).toBe(500)
    })
  })

  describe('#1941: Missiles.txt ReturnFire column aggro gating', () => {
    it('suppresses return-fire aggro wake when out-of-range missile has ReturnFire=0', () => {
      const { game, g, player } = setupRoom(194101, 'Sor')
      // Place monster far outside its aggroRadius (e.g. distance 35 > aggroRadius 12)
      const mon = spawnDummy(game, g, 'fallen1', 85, 50, 5000)
      mon.aggroRadius = 12
      mon.threatPlayerId = undefined

      // Hit with `suppressReturnFireThreat: true` (as set for ReturnFire=0 missiles outside aggroRadius)
      g.applyDamageToMonster(player, mon, 50, 51, 'fire', 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
        suppressReturnFireThreat: true,
      })
      expect(mon.hp).toBe(4950)
      expect(mon.threatPlayerId).toBeUndefined()

      // Hit with ReturnFire=1 (no suppression) wakes the monster
      g.applyDamageToMonster(player, mon, 50, 36, 'fire', 'player', {
        attackKind: 'spell',
        autoHit: true,
        unblockable: true,
      })
      expect(mon.threatPlayerId).toBe(player.unitId)
    })
  })

  describe('#1942: Paladin #96 Sacrifice self-damage recoil & physical DR mitigation', () => {
    it('mitigates 8% Sacrifice recoil by caster damageresist (capped at 50%), clamps to target HP before hit, and can kill caster', () => {
      // 1) Direct executeSUnitDmg test: 1000 physical damage dealt to 500 HP monster -> clamped to 500 -> 8% = 40 -> 50% DR = 20 recoil
      const atkCtx = makeUnitCtx('pal', 'player', 'Pal')
      atkCtx.statList.setBaseStat('damageresist', 75) // capped at 50% in 1.13c
      const defCtx = makeUnitCtx('mon', 'monster')
      defCtx.statList.setHp256(500 * FIXED_ONE)

      const res = executeSUnitDmg(
        atkCtx,
        defCtx,
        {
          skillId: 96,
          attackKind: 'melee',
          srcDam: 128,
          flatPhysMin256: 1000 * FIXED_ONE,
          flatPhysMax256: 1000 * FIXED_ONE,
          autoHit: true,
        },
        new D2Rng(96),
      )
      expect(res.hit).toBe(true)
      expect(Math.floor((res.selfDamageTaken256 ?? 0) / FIXED_ONE)).toBe(20)

      // 2) Room test: Sacrifice self-damage can kill the Paladin at low HP
      const { game, g, player } = setupRoom(194201, 'Pal', { 96: 5 })
      player.hp = 5
      player.hpFixed = 5 * FIXED_ONE
      const mon = spawnDummy(game, g, 'fallen1', 51, 50, 2000)
      g.applyDamageToMonster(player, mon, 500, 96, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
      })
      expect(player.hp).toBe(0)
      expect(player.dead).toBe(true)
    })
  })

  describe('#1943: Paladin #101 Holy Bolt ally healing, #99 Prayer synergy & Undead magic-resist bypass', () => {
    it('heals allied players/mercs with #99 Prayer synergy on missile collision, ignores Undead magic immunity, and deals 0 to non-undead', () => {
      // 1) Undead magic immunity (100% magicresist) is ignored by #101 Holy Bolt
      const atkCtx = makeUnitCtx('pal', 'player', 'Pal')
      const undeadCtx = makeUnitCtx('zombie', 'monster', undefined, { isUndead: true })
      undeadCtx.statList.setBaseStat('magicresist', 100)
      const hitUndead = executeSUnitDmg(
        atkCtx,
        undeadCtx,
        {
          skillId: 101,
          attackKind: 'missile',
          srcDam: 0,
          flatPhysMin256: 0,
          flatPhysMax256: 0,
          elemType: 'mag',
          elemMin256: 200 * FIXED_ONE,
          elemMax256: 200 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(101),
      )
      expect(hitUndead.hit).toBe(true)
      expect(Math.floor(hitUndead.totalDamage256 / FIXED_ONE)).toBe(200)

      // Non-undead takes 0 damage from #101 Holy Bolt
      const demonCtx = makeUnitCtx('demon', 'monster', undefined, { isUndead: false, isDemon: true })
      const hitDemon = executeSUnitDmg(
        atkCtx,
        demonCtx,
        {
          skillId: 101,
          attackKind: 'missile',
          srcDam: 0,
          flatPhysMin256: 0,
          flatPhysMax256: 0,
          elemType: 'mag',
          elemMin256: 200 * FIXED_ONE,
          elemMax256: 200 * FIXED_ONE,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(101),
      )
      expect(hitDemon.hit).toBe(false)
      expect(hitDemon.totalDamage256).toBe(0)

      // 2) Allied player collision in stepMissiles heals ally with #99 Prayer synergy (+15% per hard point)
      const { game, g, player } = setupRoom(194301, 'Pal', { 101: 10, 99: 10 })
      const allyPid = game.connectPlayer({
        charClass: 'Bar',
        name: 'AllyBar',
        x: 53,
        y: 50,
        areaId: 2,
      })
      const ally = g.players.get(allyPid)
      ally.maxHp = 2000
      ally.maxHpFixed = 2000 * FIXED_ONE
      ally.hp = 500
      ally.hpFixed = 500 * FIXED_ONE

      const cast = g.resolvePlayerSkillCast(player, 101, 55, 50)
      g.launchPlayerSkillMissiles(player, cast, cast.missile, 55, 50, undefined)
      for (let i = 0; i < 10; i++) {
        g.stepMissiles()
      }
      // slvl 10 Holy Bolt base heal: min = 1 + 2*7 + 3*2 = 21, max = 6 + 4*7 + 6*2 = 46;
      // Prayer blvl 10 (+150% -> 2.5x): heal in [52..115]
      expect(ally.hp).toBeGreaterThanOrEqual(552)
      expect(ally.hp).toBeLessThanOrEqual(615)
    })
  })

  describe('#1944: Assassin #264 Cloak of Shadows recast lock, 30-subtile radius & monster blind/defense debuff', () => {
    it('applies state 153 to caster, blocks recast while active, and applies state 156 (-defense% & blind) to non-boss monsters within 30 subtiles', () => {
      const { game, g, player } = setupRoom(194401, 'Ass', { 264: 5 })
      const nearMon = spawnDummy(game, g, 'fallen1', 60, 50, 5000) // dist 10 <= 30
      nearMon.ac = 200
      const farMon = spawnDummy(game, g, 'fallen1', 90, 50, 5000) // dist 40 > 30
      farMon.ac = 200

      const cast1 = g.resolvePlayerSkillCast(player, 264, player.x, player.y)
      expect(cast1).toBeDefined()
      g.applyPlayerSkillEffect(player, cast1, player.x, player.y, undefined)

      expect(player.states.has(153)).toBe(true)
      expect(nearMon.states.has(156)).toBe(true)
      expect(farMon.states.has(156)).toBe(false)

      // Verify nearMon defense is reduced by dm12(15, 95, 5) = 55% -> floor(200 * (100 - 55) / 100) = 90
      const nearMonCtx = g.monsterCombatContext(nearMon)
      expect(nearMonCtx.statList.getAccruedStat('armorclass')).toBe(90)

      // Recasting #264 while state 153 is active on caster is blocked
      const cast2 = g.resolvePlayerSkillCast(player, 264, player.x, player.y)
      expect(cast2).toBeNull()
    })
  })

  describe('#1945: Assassin #267 Fade physical DR (+1% per slvl) & #258 Burst of Speed mutual exclusion', () => {
    it('grants +slvl% damageresist without double-counting and mutually excludes #258 Burst of Speed', () => {
      const { g, player } = setupRoom(194501, 'Ass', { 258: 5, 267: 15 })

      // Cast Burst of Speed (#258) -> state 157 active
      g.applyPlayerSkillEffect(
        player,
        g.resolvePlayerSkillCast(player, 258, player.x, player.y),
        player.x,
        player.y,
        undefined,
      )
      expect(player.states.has(157)).toBe(true)

      // Cast Fade (#267) at slvl 15 -> removes state 157, activates state 159 with damageresist = 15
      g.applyPlayerSkillEffect(
        player,
        g.resolvePlayerSkillCast(player, 267, player.x, player.y),
        player.x,
        player.y,
        undefined,
      )
      expect(player.states.has(157)).toBe(false)
      expect(player.states.has(159)).toBe(true)

      const pCtx = g.playerCombatContext(player)
      expect(pCtx.statList.getAccruedStat('damageresist')).toBe(15)

      // Defender snapshot must also have exactly 15% damageresist (no double-counting from state_fade!)
      const snap = g.buildPlayerDefenderSnapshot113c(player)
      expect(snap.defenderStats.getAccruedStat('damageresist')).toBe(15)

      // Casting Burst of Speed (#258) removes Fade (state 159) and its damageresist
      g.applyPlayerSkillEffect(
        player,
        g.resolvePlayerSkillCast(player, 258, player.x, player.y),
        player.x,
        player.y,
        undefined,
      )
      expect(player.states.has(159)).toBe(false)
      expect(player.states.has(157)).toBe(true)
      expect(g.playerCombatContext(player).statList.getAccruedStat('damageresist')).toBe(0)
    })
  })
})
