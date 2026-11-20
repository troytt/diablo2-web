/**
 * Wave 2 Combat: item procs, +skills sync, passives & Sanctuary P0 parity suite
 * (`#1797`, `#1798`, `#1799`, `#1801`, `#1802`, `#1803`, `#1804`, `#1807`).
 *
 * Ground truth: Diablo II: LoD v1.13c `D2Game.dll` / `D2Common.dll` and MPQ `Skills.txt`,
 * `Missiles.txt`, `ItemStatCost.txt`.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { computeDiminishingReturns } from '../../src/common/data/calc-ast.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { executeSUnitDmg } from '../../src/server/engine/combat-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { resolveMissilePierceIdx } from '../../src/server/engine/missile-pierce.ts'
import { FIXED_ONE } from '../../src/server/engine/stat-list.ts'
import { executeCubeTransmute113c } from '../../src/server/items/cube-engine-113c.ts'
import {
  aggregateCtcProcs113c,
  decodeCtcParam113c,
  encodeCtcParam113c,
  resolveWeaponMasteryBonus113c,
  rollCtcProcs113c,
} from '../../src/server/skills/passives-procs-113c.ts'

type AnyRec = Record<string, any>

let nextItemId = 9000

function makeItem(
  code: string,
  bodyLoc: number,
  rawStats: { statId: number; param?: number; value: number }[] = [],
  extra: AnyRec = {},
): AnyRec {
  const statsMap = new Map<number, number>()
  for (const st of rawStats) statsMap.set(st.statId, (statsMap.get(st.statId) ?? 0) + st.value)
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
    durability: 0,
    maxDurability: 0,
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

function setupPlayer(
  seed: number,
  charClass: string,
  skills: Record<number, number> = {},
  difficulty: 0 | 1 | 2 = 0,
): { game: GameInstance; g: AnyRec; pid: number; player: AnyRec } {
  const game = new GameInstance({ seed, difficulty, areaId: 2 })
  const pid = game.connectPlayer({ charClass, name: `W2${charClass}`, x: 50, y: 50, areaId: 2, skills })
  const g = game as unknown as AnyRec
  const player = g.players.get(pid)
  player.maxHp = 2000
  player.hp = 2000
  player.maxHpFixed = 2000 * FIXED_ONE
  player.hpFixed = 2000 * FIXED_ONE
  player.strength = 0
  player.dexterity = 0
  return { game, g, pid, player }
}

function spawnTarget(game: GameInstance, g: AnyRec, defId: string, x = 52, y = 50, hp = 100_000): AnyRec {
  const monId = game.spawnMonster({ defId, x, y, areaId: 2, hp, maxHp: hp, aiDisabled: true })
  const mon = g.monsters.get(monId)
  mon.resistances = { phys: 0, magic: 0, fire: 0, light: 0, cold: 0, poison: 0 }
  mon.ac = 0
  mon.damageRegen = 0
  return mon
}

describe('Wave 2 Combat P0 Parity (#1797..#1807)', () => {
  describe('#1797: item chance-to-cast (stats 195..201) aggregation & dispatch', () => {
    it('decodes Encode=2 params and groups by (skillId, slvl) summing chance capped at 100', () => {
      expect(decodeCtcParam113c(encodeCtcParam113c(66, 5))).toEqual({ skillId: 66, slvl: 5 })
      expect(decodeCtcParam113c(53)).toEqual({ skillId: 53, slvl: 1 })
      const entries = aggregateCtcProcs113c(
        [
          { statId: 198, param: encodeCtcParam113c(87, 18), value: 33 },
          { statId: 198, param: encodeCtcParam113c(87, 18), value: 33 },
          { statId: 198, param: encodeCtcParam113c(87, 10), value: 80 },
          { statId: 198, param: encodeCtcParam113c(87, 10), value: 80 },
          { statId: 195, param: encodeCtcParam113c(64, 16), value: 16 },
        ],
        198,
      )
      expect(entries).toEqual([
        { statId: 198, skillId: 87, slvl: 18, chancePct: 66 },
        { statId: 198, skillId: 87, slvl: 10, chancePct: 100 },
      ])
      const rolls = [70, 10]
      const fired = rollCtcProcs113c(
        [...entries, { statId: 198, skillId: 66, slvl: 1, chancePct: 5 }],
        () => rolls.shift() ?? 99,
      )
      expect(fired.map((e) => e.slvl)).toEqual([10])
    })

    it('onHit (198) curse lands on the struck monster; onGetHit (201) Frost Nova hits around the player; procs cost 0 mana', () => {
      const { game, g, player } = setupPlayer(17971, 'bar')
      player.items = [
        makeItem('rin', 6, [{ statId: 198, param: encodeCtcParam113c(66, 5), value: 100 }]),
        makeItem('rin', 7, [{ statId: 201, param: encodeCtcParam113c(44, 10), value: 100 }]),
      ]
      player.manaFixed = 0
      player.mana = 0
      const mon = spawnTarget(game, g, 'fallen1')
      g.applyDamageToMonster(player, mon, 10, 0, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      expect(mon.states.has(9)).toBe(true) // amplifydamage
      expect(player.manaFixed).toBe(0)

      const near = spawnTarget(game, g, 'fallen1', 51, 51)
      const hpBefore = near.hp
      near.ar = 1_000_000
      g.resolveMonsterAttackOnPlayer(near, player, { minDmg: 5, maxDmg: 5, skillMode: 'A1', autoHit: true })
      expect(near.hp).toBeLessThan(hpBefore)
      expect(player.manaFixed).toBe(0)
    })

    it('onLevelUp (199) Nova, onSkill (200) Frost Nova, and Whirlwind (#151) suppression of 195/198', () => {
      const { game, g, pid, player } = setupPlayer(17972, 'sor', { 54: 1 })
      player.items = [
        makeItem('amu', 2, [{ statId: 199, param: encodeCtcParam113c(48, 20), value: 100 }]),
        makeItem('rin', 6, [{ statId: 200, param: encodeCtcParam113c(44, 10), value: 100 }]),
        makeItem('rin', 7, [
          { statId: 195, param: encodeCtcParam113c(66, 5), value: 100 },
          { statId: 198, param: encodeCtcParam113c(87, 5), value: 100 },
        ]),
      ]
      const mon = spawnTarget(game, g, 'fallen1', 51, 50)
      const hpBefore = mon.hp
      g.grantExperience(player, 10_000, player.level)
      expect(player.level).toBeGreaterThan(1)
      expect(mon.hp).toBeLessThan(hpBefore)

      // Whirlwind (#151) must suppress both 195 onAttack and 198 onHit
      g.applyDamageToMonster(player, mon, 10, 151, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      expect(mon.states.has(9)).toBe(false)
      expect(mon.states.has(60)).toBe(false)

      // Stat 200 (onSkill) fires when casting a skill (#54 Teleport, reqlevel 18)
      player.level = 30
      const hpBeforeSkill = mon.hp
      player.mana = 500
      player.manaFixed = 500 * FIXED_ONE
      game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 54, x: 50, y: 50, hand: 'right' })
      game.stepFrames(5)
      expect(mon.hp).toBeLessThan(hpBeforeSkill)
    })

    it('swap-slot, unidentified and broken items never proc; Mercenary onGetHit (201) buffs Chilling Armor', () => {
      const { game, g, pid, player } = setupPlayer(17973, 'bar')
      player.items = [
        makeItem('rin', 11, [{ statId: 198, param: encodeCtcParam113c(66, 5), value: 100 }]),
        makeItem('rin', 6, [{ statId: 198, param: encodeCtcParam113c(66, 5), value: 100 }], { identified: false }),
        makeItem('cap', 1, [{ statId: 198, param: encodeCtcParam113c(66, 5), value: 100 }], {
          durability: 0,
          maxDurability: 12,
        }),
      ]
      const mon = spawnTarget(game, g, 'fallen1')
      g.applyDamageToMonster(player, mon, 10, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true })
      expect(mon.states.has(9)).toBe(false)

      // Hireling wearing Fortitude (stat 201 Chilling Armor #60 slvl 15 -> state 20)
      const mercId = game.hireMercenary(pid, { act: 2, subType: 1, level: 80, difficulty: 2 })
      const merc = g.mercenaries.get(mercId)
      merc.equipment = [makeItem('uar', 3, [{ statId: 201, param: encodeCtcParam113c(60, 15), value: 100 }])]
      game.applyDamageToMerc(mercId, 10)
      expect(merc.states.has(20)).toBe(true)
    })

    it('player Fortitude Chilling Armor (201), CtC Enchant self-target, Poison Nova (196), Death Chain Lightning (197) & Merc Obedience onKill (196)', () => {
      const { game, g, pid, player } = setupPlayer(17974, 'bar')
      const mercId = game.hireMercenary(pid, { act: 2, subType: 1, level: 80, difficulty: 2 })
      const merc = g.mercenaries.get(mercId)
      merc.x = 52
      merc.y = 50

      // Player wearing Fortitude (#60 Chilling Armor on 201), Lava Gout (#52 Enchant on 198), BotD (#92 Poison Nova on 196), Death Facet (#53 Chain Lightning on 197)
      player.items = [
        makeItem('uar', 3, [{ statId: 201, param: encodeCtcParam113c(60, 15), value: 100 }]),
        makeItem('xtg', 8, [{ statId: 198, param: encodeCtcParam113c(52, 10), value: 100 }]),
        makeItem('7gd', 4, [{ statId: 196, param: encodeCtcParam113c(92, 20), value: 100 }]),
        makeItem('jew', 6, [{ statId: 197, param: encodeCtcParam113c(53, 31), value: 100 }]),
      ]
      const attacker = spawnTarget(game, g, 'fallen1', 52, 50, 100)
      attacker.ar = 1_000_000
      g.resolveMonsterAttackOnPlayer(attacker, player, { minDmg: 5, maxDmg: 5, skillMode: 'A1', autoHit: true })
      expect(player.states.has(20)).toBe(true) // Chilling Armor granted on player (not blocked by srvMissileA)

      // Hit attacker -> Lava Gout Enchant (#52 ItemTarget=1 self) buffs player, NOT the adjacent merc!
      const bystander = spawnTarget(game, g, 'fallen1', 54, 50, 50_000)
      g.applyDamageToMonster(player, attacker, 20, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true, unblockable: true })
      expect(player.states.has(16)).toBe(true)
      expect(merc.states.has(16)).toBe(false)

      // Kill attacker -> BotD Poison Nova (#92 onKill 196) poisons bystander
      g.applyDamageToMonster(player, attacker, 500, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true, unblockable: true })
      expect(attacker.dead).toBe(true)
      const hpBeforeTick = bystander.hp
      game.stepFrames(5)
      expect(bystander.hp).toBeLessThan(hpBeforeTick)

      // Mercenary wearing Obedience (30% -> 100% test CtC Lv21 Enchant onKill 196) kills a monster -> merc gets Enchant (state 16)
      merc.equipment = [makeItem('7pa', 4, [{ statId: 196, param: encodeCtcParam113c(52, 21), value: 100 }])]
      const mercVictim = spawnTarget(game, g, 'fallen1', 53, 50, 10)
      g.applyDamageToMonster(player, mercVictim, 50, 0, 'phys', merc, { attackKind: 'melee', autoHit: true, unblockable: true })
      expect(mercVictim.dead).toBe(true)
      expect(merc.states.has(16)).toBe(true)

      // Player death triggers 197 Chain Lightning toward bystander
      const missilesBefore = g.missiles.size
      g.triggerPlayerCtcProcs113c(player, 197, {})
      expect(g.missiles.size).toBeGreaterThan(missilesBefore)
    })
  })

  describe('#1798: oskill (stat 97) synced into combat statList with native +3 cap', () => {
    it('weapon swap invalidates selected oskill back to #0 Attack and rejects cast attempts', () => {
      const { game, g, pid, player } = setupPlayer(17983, 'pal')
      player.mana = 500
      player.manaFixed = 500 * FIXED_ONE
      player.items = [makeItem('crs', 4, [{ statId: 97, param: 149, value: 6 }])] // CTA +6 Battle Orders
      game.enqueueCommand(pid, { type: 'SelectSkill', hand: 'right', skill: 149 })
      game.stepFrames(1)
      expect(player.rightSkill).toBe(149)

      // Swap weapons (C2S 0x60) moves CTA from bodyLoc 4 -> 11 and resets rightSkill to 0
      game.enqueueCommand(pid, { type: 'SwapWeapons' })
      game.stepFrames(1)
      expect(player.rightSkill).toBe(0)
      expect(g.resolvePlayerSkillCast(player, 149)).toBeNull()
    })
    it('foreign oskill is uncapped (+allskills), native oskill caps at 3, and passives follow +skills', () => {
      const { g, player } = setupPlayer(17981, 'bar', { 9: 0 })
      player.manaFixed = 500 * FIXED_ONE
      player.mana = 500
      player.items = [
        makeItem('amu', 2, [
          { statId: 97, param: 54, value: 1 },
          { statId: 127, value: 2 },
          { statId: 97, param: 9, value: 3 },
        ]),
      ]
      const st = g.playerCombatContext(player).statList
      expect(st.getEffectiveSkillLevel(54)).toBe(3) // Teleport: 1 oskill + 2 all skills
      expect(st.getEffectiveSkillLevel(9)).toBe(5) // Critical Strike oskill (foreign) + 2
      expect(st.getAccruedStat('passive_critical_strike')).toBe(computeDiminishingReturns(5, 80, 5))
      expect(g.resolvePlayerSkillCast(player, 54)).not.toBeNull()

      const sorc = setupPlayer(17982, 'sor', { 54: 1 })
      sorc.player.items = [makeItem('amu', 2, [{ statId: 97, param: 54, value: 5 }])]
      expect(sorc.g.playerCombatContext(sorc.player).statList.getEffectiveSkillLevel(54)).toBe(4)
      sorc.player.items = []
      expect(sorc.g.playerCombatContext(sorc.player).statList.getEffectiveSkillLevel(54)).toBe(1)
    })
  })

  describe('#1799: charged skills (stat 204) 0-mana cast, 0x3E sync & ethereal recharge gate', () => {
    it('casts from charges with 0 mana, decrements one charge and emits the item StatSet', () => {
      const { game, g, pid, player } = setupPlayer(17991, 'bar')
      player.manaFixed = 0
      player.mana = 0
      const staff = makeItem('8cs', 4, [{ statId: 204, param: encodeCtcParam113c(54, 10), value: (10 << 8) | 5 }])
      player.items = [staff]
      const cast = g.resolvePlayerSkillCast(player, 54)
      expect(cast).not.toBeNull()
      expect(cast.chargeItem).toBe(staff)
      expect(cast.slvl).toBe(10)
      game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 54, x: 55, y: 50, hand: 'right' })
      game.stepFrames(30)
      const charged = staff.rawItemData.stats.find((s: AnyRec) => s.statId === 204)
      // Accepted with an empty mana pool: exactly one charge spent (mana is never consumed).
      expect(charged.value & 0xff).toBe(4)
    })

    it('repair & Horadric Cube recharge non-ethereal (incl. 0-durability jewelry & runewordStats) and block ethereal', () => {
      const { g } = setupPlayer(17992, 'sor')
      const tables = { items: new Map(), itemTypes: new Map() }
      const amu = makeItem('amu', 2, [{ statId: 204, param: encodeCtcParam113c(54, 5), value: (20 << 8) | 3 }])
      expect(g.doesEntryNeedRepair113c(amu, tables)).toBe(true)
      expect(g.repairSingleItemEntry(amu, tables)).toBe(true)
      expect(amu.rawItemData.stats.find((s: AnyRec) => s.statId === 204).value & 0xff).toBe(20)
      const eth = makeItem('8cs', 4, [{ statId: 204, param: encodeCtcParam113c(54, 5), value: (20 << 8) | 3 }], {
        ethereal: true,
      })
      expect(g.doesEntryNeedRepair113c(eth, tables)).toBe(false)
      expect(g.repairSingleItemEntry(eth, tables)).toBe(false)

      // Horadric Cube weapon repair + recharge (`1 Ort + 1 Chipped Gem + Weapon -> useitem,rep,rch`)
      const rwWeapon = {
        id: 7001,
        code: 'crs',
        quality: 4,
        ilvl: 80,
        durability: 10,
        curDurability: 10,
        maxDurability: 20,
        ethereal: false,
        identified: true,
        stats: [],
        runewordStats: [{ statId: 204, param: encodeCtcParam113c(236, 16), value: (15 << 8) | 2 }],
      }
      const cubeRes = executeCubeTransmute113c({
        cubeItems: [
          rwWeapon as any,
          { id: 7002, code: 'r09', quality: 2, ilvl: 25, identified: true } as any,
          { id: 7003, code: 'gcv', quality: 2, ilvl: 1, identified: true } as any,
        ],
        rng: new D2Rng(1),
        playerLevel: 80,
        playerClassCode: 'sor',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        isExpansion: true,
        allocateUnitId: () => 8000,
      })
      expect(cubeRes.matched).toBe(true)
      expect((cubeRes.createdItems[0]!.item as AnyRec).runewordStats[0].value & 0xff).toBe(15)

      const ethCube = executeCubeTransmute113c({
        cubeItems: [
          { ...rwWeapon, ethereal: true } as any,
          { id: 7002, code: 'r09', quality: 2, ilvl: 25, identified: true } as any,
          { id: 7003, code: 'gcv', quality: 2, ilvl: 1, identified: true } as any,
        ],
        rng: new D2Rng(1),
        playerLevel: 80,
        playerClassCode: 'sor',
        difficulty: 2,
        areaId: 1,
        isLadder: true,
        isExpansion: true,
        allocateUnitId: () => 8001,
      })
      expect(ethCube.matched).toBe(false)

      // Client StatSet (0x3E, stat 204) updates runewordStats in-place (Lawbringer Decrepify charges)
      const world = new ClientWorld()
      const rwParam = encodeCtcParam113c(87, 15)
      world.applyEvent({
        type: 'ItemEvent',
        action: 0x06,
        itemId: 9901,
        code: '7cr',
        x: 0,
        y: 0,
        container: 'equipment',
        bodyLoc: 4,
        item: {
          id: 9901,
          code: '7cr',
          quality: 4,
          identified: true,
          stats: [],
          runewordStats: [{ statId: 204, param: rwParam, value: (30 << 8) | 30 }],
        } as any,
      })
      world.applyEvent({
        type: 'StatSet',
        unit: { unitType: 4, id: 9901 },
        stat: 204,
        param: rwParam,
        value: 29,
      })
      const clientItem = world.containers.allById.get(9901) as AnyRec
      expect(clientItem.stats).toHaveLength(0)
      expect(clientItem.runewordStats[0].value).toBe((30 << 8) | 29)
      expect(world.self.skillCharges?.get(87)).toBe(29)
    })
  })

  describe('#1801: Sorceress masteries, #52 Enchant snapshot/double-mastery & gear stats 329..336', () => {
    it('Lightning Mastery slvl 20 multiplies lightning spell damage by +278%', () => {
      const { game, g, player } = setupPlayer(18011, 'sor', { 63: 20 })
      const mon = spawnTarget(game, g, 'fallen1')
      const before = mon.hp
      g.applyDamageToMonster(player, mon, 100, 49, 'ltng', 'player', { attackKind: 'spell', autoHit: true, unblockable: true })
      expect(before - mon.hp).toBe(378)
    })

    it('Cold Mastery slvl 17 (-100%) lowers 50% cold res to -50% but cannot break 100% immunity', () => {
      const { game, g, player } = setupPlayer(18012, 'sor', { 65: 17 })
      const mon = spawnTarget(game, g, 'fallen1')
      mon.resistances.cold = 50
      const before = mon.hp
      g.applyDamageToMonster(player, mon, 100, 39, 'cold', 'player', { attackKind: 'spell', autoHit: true, unblockable: true })
      expect(before - mon.hp).toBe(150)
      const immune = spawnTarget(game, g, 'fallen1', 53, 50)
      immune.resistances.cold = 100
      const immBefore = immune.hp
      g.applyDamageToMonster(player, immune, 100, 39, 'cold', 'player', { attackKind: 'spell', autoHit: true, unblockable: true })
      expect(immune.hp).toBe(immBefore)
    })

    it('Rainbow Facet (+5% ltng dmg / -5% enemy ltng res) applies to any class', () => {
      const { game, g, player } = setupPlayer(18013, 'pal')
      player.items = [makeItem('jew', 6, [{ statId: 330, value: 5 }, { statId: 334, value: 5 }])]
      const mon = spawnTarget(game, g, 'fallen1')
      mon.resistances.light = 20
      const before = mon.hp
      g.applyDamageToMonster(player, mon, 100, 118, 'ltng', 'player', { attackKind: 'spell', autoHit: true, unblockable: true })
      expect(before - mon.hp).toBe(89)
    })

    it('#52 Enchant snapshots 1st Fire Mastery at cast time, applies 2nd Fire Mastery on melee and 33% single on ranged', () => {
      const { game, g, pid, player } = setupPlayer(18014, 'sor', { 52: 20, 61: 1 })
      player.mana = 500
      player.manaFixed = 500 * FIXED_ONE
      game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId: 52, x: 50, y: 50, hand: 'right' })
      game.stepFrames(5)
      const ench = g.playerCombatContext(player).stateBus.getState('enchant')
      expect(ench).toBeDefined()
      // Fire Mastery slvl 1 = +30%; Enchant slvl 20 base 67..87 -> snapshotted 87..113
      expect(ench.stats['firemindam']).toBeGreaterThanOrEqual(87)
      // Force deterministic flat 100 snapshotted fire damage to test exact 2nd mastery vs 33% ranged
      ench.stats['firemindam'] = 100
      ench.stats['firemaxdam'] = 100

      // 100% phys-immune target so ONLY the Enchant fire rider deals damage!
      const meleeMon = spawnTarget(game, g, 'fallen1', 51, 50)
      meleeMon.resistances.phys = 100
      const mBefore = meleeMon.hp
      g.applyDamageToMonster(player, meleeMon, 10, 0, 'phys', 'player', {
        attackKind: 'melee',
        autoHit: true,
        unblockable: true,
      })
      // Melee: 100 * (100 + 30)% = 130
      expect(mBefore - meleeMon.hp).toBe(130)

      const rangedMon = spawnTarget(game, g, 'fallen1', 53, 50)
      rangedMon.resistances.phys = 100
      const rBefore = rangedMon.hp
      g.applyDamageToMonster(player, rangedMon, 10, 0, 'phys', 'player', {
        attackKind: 'missile',
        autoHit: true,
        unblockable: true,
      })
      // Ranged: 100 * 33% = 33 (no 2nd Fire Mastery multiplier)
      expect(rBefore - rangedMon.hp).toBe(33)

      // Active Enchant must NEVER reduce Fire Ball (#47, missile with explicit elemMin256/Max256) to 33%!
      const spellMon = spawnTarget(game, g, 'fallen1', 54, 50)
      const sBefore = spellMon.hp
      g.applyDamageToMonster(player, spellMon, 100, 47, 'fire', 'player', {
        attackKind: 'missile',
        autoHit: true,
        unblockable: true,
      })
      expect(sBefore - spellMon.hp).toBe(130)
    })
  })

  describe('#1802: Amazon Critical Strike / Penetrate / Dodge-Avoid-Evade / Pierce wiring', () => {
    it('passive CS, Penetrate AR% and D/A/E follow effective (+skills) levels', () => {
      const { g, player } = setupPlayer(18021, 'ama', { 9: 1, 13: 1, 18: 1, 23: 1, 29: 1 })
      player.items = [makeItem('amu', 2, [{ statId: 127, value: 5 }])]
      const st = g.playerCombatContext(player).statList
      expect(st.getAccruedStat('passive_critical_strike')).toBe(computeDiminishingReturns(5, 80, 6))
      expect(st.getAccruedStat('passive_dodge')).toBe(computeDiminishingReturns(10, 65, 6))
      expect(st.getAccruedStat('passive_avoid')).toBe(computeDiminishingReturns(15, 75, 6))
      expect(st.getAccruedStat('passive_evade')).toBe(computeDiminishingReturns(10, 65, 6))
      expect(st.getModifierBonus('item_tohit_percent')).toBe(35 + 10 * 5)
    })

    it('Pierce slvl 9 (69%) + Razortail item_pierce 33% -> Lightning Fury hits 5 lined-up targets (4 pierces) and stops before 6th', () => {
      const registry = getSharedDataRegistry()
      const furyMissile = registry.getMissileByName('lightningfury')!
      const { game, g, pid, player } = setupPlayer(18022, 'ama', { 33: 9, 35: 10 })
      player.level = 45
      player.x = 100
      player.y = 100
      player.ar = 500_000
      player.items = [
        makeItem('am5', 4, [], { quantity: 80 }),
        makeItem('ulc', 10, [{ statId: 156, value: 33 }]),
      ]
      const ctx = g.playerCombatContext(player)
      expect(resolveMissilePierceIdx(furyMissile, ctx, registry)).toBe(4)

      // Place 5 monsters at x = 104..120 and a 6th monster at x = 160 (>15 subtiles past x=120 so
      // furylightning bolts from hit #5 don't reach it, while a 5th pierce along y=100 would hit it!)
      const line = [104, 108, 112, 116, 120, 160].map((x) => spawnTarget(game, g, 'fallen1', x, 100))
      const cast = g.resolvePlayerSkillCast(player, 35)
      expect(cast).not.toBeNull()
      game.drainEvents(pid)
      g.launchPlayerSkillMissile(player, cast, furyMissile, 160, 100, 400)
      const events: AnyRec[] = []
      for (let i = 0; i < 40; i++) {
        game.stepFrames(1)
        events.push(...(game.drainEvents(pid) as unknown as AnyRec[]))
      }

      // First 5 monsters are struck (1 initial + 4 pierces), releasing bolt waves; the 6th monster at x=160 is untouched!
      for (let i = 0; i < 5; i++) {
        expect(line[i]!.hp).toBeLessThan(100_000)
      }
      expect(line[5]!.hp).toBe(100_000)

      const furyBoltId = registry.getMissileByName('furylightning')!.id

      expect(events.filter((e) => e.type === 'CreateMissile' && e.missileClassId === furyBoltId).length).toBeGreaterThanOrEqual(5)

      // Without Pierce (0%): stops on the 1st monster
      const plain = setupPlayer(18024, 'ama', { 35: 10 })
      plain.player.level = 45
      plain.player.x = 100
      plain.player.y = 100
      plain.player.ar = 500_000
      plain.player.items = [makeItem('am5', 4, [], { quantity: 80 })]
      const m1 = spawnTarget(plain.game, plain.g, 'fallen1', 104, 100)
      const m2 = spawnTarget(plain.game, plain.g, 'fallen1', 124, 100)
      const plainCast = plain.g.resolvePlayerSkillCast(plain.player, 35)
      plain.g.launchPlayerSkillMissile(plain.player, plainCast, furyMissile, 130, 100, 400)
      plain.game.stepFrames(40)
      expect(m1.hp).toBeLessThan(100_000)
      expect(m2.hp).toBe(100_000)
    })
  })

  describe('#1803: Barbarian masteries, Iron Skin, Increased Speed/Stamina & Natural Resistance', () => {
    it('Sword/Axe Mastery %ED joins single off-weapon pool and evaluates independently per swinging hand in dual-wield', () => {
      const { g, player } = setupPlayer(18031, 'bar')
      player.items = [makeItem('crs', 4), makeItem('axe', 5)]
      const rightBase = g.resolvePlayerWeaponDamage(player, 0, { weaponHand: 'right' })
      const leftBase = g.resolvePlayerWeaponDamage(player, 0, { weaponHand: 'left' })
      player.skills.set(127, 10) // Sword Mastery slvl 10 -> +73% ED on right hand ONLY
      const rightMastered = g.resolvePlayerWeaponDamage(player, 0, { weaponHand: 'right' })
      const leftUnmastered = g.resolvePlayerWeaponDamage(player, 0, { weaponHand: 'left' })
      expect(rightMastered.min).toBe(rightBase.min + Math.trunc((rightBase.min * 73) / 100))
      expect(leftUnmastered).toEqual(leftBase)
      expect(resolveWeaponMasteryBonus113c('staf', false, (id) => (id === 129 ? 1 : 0))?.skillId).toBe(129)
      // MPQ Skills.txt row 135: Param3 = 28 (ln34) -> +28% ED at slvl 1
      expect(resolveWeaponMasteryBonus113c('jave', true, (id) => (id === 135 ? 1 : 0))?.damagePct).toBe(28)
    })

    it('Natural Resistance adds all four resists once (fire hit 100 -> 60 at slvl 5); Iron Skin / Speed / Stamina follow +skills', () => {
      const { game, g, player } = setupPlayer(18032, 'bar', { 153: 5, 145: 1, 148: 1, 141: 1 })
      const st = g.playerCombatContext(player).statList
      expect(st.getAccruedStat('poisonresist')).toBe(computeDiminishingReturns(0, 80, 5))
      const mon = spawnTarget(game, g, 'fallen1', 51, 50)
      g.resolveMonsterAttackOnPlayer(mon, player, {
        minDmg: 0,
        maxDmg: 0,
        skillMode: 'A1',
        attackKind: 'missile',
        elementType: 'fire',
        elemMin: 100,
        elemMax: 100,
        fromMissile: true,
        autoHit: true,
      })
      expect(player.hp).toBe(2000 - 60)

      player.items = [makeItem('amu', 2, [{ statId: 127, value: 4 }])]
      const st2 = g.playerCombatContext(player).statList
      expect(st2.getModifierBonus('skill_armor_percent')).toBe(30 + 10 * 4)
      expect(st2.getAccruedStat('velocitypercent')).toBe(computeDiminishingReturns(7, 50, 5))
      expect(st2.getAccruedStat('skill_passive_staminapercent')).toBe(30 + 15 * 4)
    })
  })

  describe('#1804: Assassin Claw Mastery & dual-claw Weapon Block', () => {
    it('Claw Mastery +35% ED on claws; Weapon Block follows +skills, blocks stationary elemental missiles, and requires dual claws', () => {
      const { game, g, player } = setupPlayer(18041, 'ass', { 263: 20 })
      player.items = [makeItem('ktr', 4), makeItem('ktr', 5)]
      const base = g.resolvePlayerWeaponDamage(player, 0)
      player.skills.set(252, 1)
      const mastered = g.resolvePlayerWeaponDamage(player, 0)
      expect(mastered.min).toBe(base.min + Math.trunc((base.min * 35) / 100))
      player.items.push(makeItem('amu', 2, [{ statId: 127, value: 3 }]))
      expect(g.playerCombatContext(player).statList.getAccruedStat('passive_weaponblock')).toBe(
        computeDiminishingReturns(20, 65, 23),
      )

      // Stationary dual-claw Assassin can block incoming elemental missile hits, whereas moving cannot
      const casterMon = spawnTarget(game, g, 'fallen1', 52, 50)
      let blockedCount = 0
      player.mode = 1 // neutral/stationary
      for (let i = 0; i < 40; i++) {
        const hpBefore = player.hp
        g.resolveMonsterAttackOnPlayer(casterMon, player, {
          minDmg: 0,
          maxDmg: 0,
          skillMode: 'A1',
          attackKind: 'missile',
          elementType: 'fire',
          elemMin: 10,
          elemMax: 10,
          fromMissile: true,
          autoHit: true,
        })
        if (player.hp === hpBefore) blockedCount++
      }
      expect(blockedCount).toBeGreaterThan(5)

      // Running (mode 3): Weapon Block is gated to 0%
      player.mode = 3
      let movingBlocked = 0
      for (let i = 0; i < 20; i++) {
        const hpBefore = player.hp
        g.resolveMonsterAttackOnPlayer(casterMon, player, {
          minDmg: 0,
          maxDmg: 0,
          skillMode: 'A1',
          attackKind: 'missile',
          elementType: 'fire',
          elemMin: 10,
          elemMax: 10,
          fromMissile: true,
          autoHit: true,
        })
        if (player.hp === hpBefore) movingBlocked++
      }
      expect(movingBlocked).toBe(0)

      // #266 Blade Fury (attackKind: 'missile') receives Claw Mastery %AR and Crit, including staffmod (+Claw Mastery stat 107)
      const staffmodAss = setupPlayer(18042, 'ass', {})
      staffmodAss.player.items = [makeItem('ktr', 4, [{ statId: 107, param: 252, value: 10 }])]
      const attCtx = staffmodAss.g.playerCombatContext(staffmodAss.player)
      attCtx.weaponItemType = 'h2h'
      const dummyDef = staffmodAss.g.monsterCombatContext(spawnTarget(staffmodAss.game, staffmodAss.g, 'fallen1'))
      const bfOut = executeSUnitDmg(
        attCtx,
        dummyDef,
        {
          skillId: 266,
          attackKind: 'missile',
          srcDam: 96,
          flatPhysMin256: 100 * FIXED_ONE,
          flatPhysMax256: 100 * FIXED_ONE,
          masteryCritRoll100: 0,
          autoHit: true,
          unblockable: true,
        },
        new D2Rng(7),
      )
      expect(bfOut.isCritical).toBe(true)
      expect(bfOut.physDamage256).toBeGreaterThan(200 * FIXED_ONE)
    })
  })

  describe('#1807: Sanctuary ignores positive Undead physical resistance & knocks Undead back', () => {
    it('aura bearer hits a 100% phys-immune Undead for full damage without adding Sanctuary ED; negative resistance is preserved', () => {
      const { game, g, player } = setupPlayer(18071, 'pal')
      const wraith = spawnTarget(game, g, 'wraith1')
      wraith.isUndead = true
      wraith.resistances.phys = 100
      const before = wraith.hp
      expect(g.applyDamageToMonster(player, wraith, 50, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true, unblockable: true })).toBe(false)
      expect(wraith.hp).toBe(before)

      player.states.add(47)
      g.playerCombatContext(player).stateBus.applyState({
        stateNameOrId: 'sanctuary',
        sourceUnitId: `player_${player.unitId}`,
        sourceSkillId: 119,
        slvl: 10,
        currentFrame: 0,
        stats: { item_undeaddamage_percent: 420 },
        isAuraOverride: true,
      })
      g.applyDamageToMonster(player, wraith, 50, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true, unblockable: true })
      // Positive 100% Undead phys res -> 0%, AND Sanctuary's +420% item_undeaddamage_percent is NOT added!
      expect(before - wraith.hp).toBe(50)

      // Negative physical resistance (-50% Decrepify) is preserved!
      const cursedUndead = spawnTarget(game, g, 'wraith1', 53, 50)
      cursedUndead.isUndead = true
      cursedUndead.resistances.phys = -50
      const cBefore = cursedUndead.hp
      g.applyDamageToMonster(player, cursedUndead, 50, 0, 'phys', 'player', { attackKind: 'melee', autoHit: true, unblockable: true })
      expect(cBefore - cursedUndead.hp).toBe(75)
    })

    it('Sanctuary pulse knockback targets push Undead radially away and broadcast overlay 79', () => {
      const { game, g, player } = setupPlayer(18072, 'pal')
      const zombie = spawnTarget(game, g, 'zombie1', 52, 50)
      zombie.isUndead = true
      const events: AnyRec[] = []
      const origBroadcast = g.broadcastToArea.bind(g)
      g.broadcastToArea = (areaId: number, ev: AnyRec) => {
        events.push(ev)
        return origBroadcast(areaId, ev)
      }
      const x0 = zombie.x
      g.applyAuraPulseSideEffects113c(
        { auraSkillId: 119, knockbackTargetIds: [`monster_${zombie.unitId}`] },
        player.x,
        player.y,
        player.areaId,
      )
      expect(events.some((e) => e.type === 'UnitOverlay' && e.id === zombie.unitId && e.overlayIndex === 79)).toBe(true)
      expect(zombie.x > x0 || zombie.mode === 13 || g.monsterKnockback?.has?.(zombie.unitId)).toBeTruthy()
    })
  })
})
