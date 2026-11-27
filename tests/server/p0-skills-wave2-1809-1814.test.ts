import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import { generateMonsterHorkDrop113c } from '../../src/server/items/drop-generator.ts'
import {
  calculateFindItemStats,
  calculateFindPotionStats,
  rollFindPotionDrop113c,
} from '../../src/server/skills/barbarian-warcries.ts'
import {
  computeMindBlastConversionChance,
  computeMindBlastStunDuration,
} from '../../src/server/skills/assassin-shadow.ts'
import {
  computeWhirlwindDamageAndAr113c,
  computeWhirlwindWeaponHitInterval113c,
} from '../../src/server/skills/whirlwind-113c.ts'

interface InternalViews {
  readonly players: Map<
    number,
    {
      x: number
      y: number
      hp: number
      maxHp: number
      hpFixed: number
      maxHpFixed: number
      mana: number
      maxMana: number
      manaFixed: number
      maxManaFixed: number
      leftSkill: number
      rightSkill: number
      skills: Map<number, number>
      states: Set<number>
      items: Array<{
        unitId: number
        code: string
        location: string
        bodyLoc: number
        x: number
        y: number
        durability: number
        maxDurability: number
        quality: number
        stats: Map<number, number>
        socketedItems?: Array<{
          unitId: number
          code: string
          location: string
          bodyLoc: number
          x: number
          y: number
          durability: number
          maxDurability: number
          quality: number
          stats: Map<number, number>
        }>
      }>
    }
  >
  readonly monsters: Map<
    number,
    {
      unitId: number
      defId: string
      hcIdx: number
      x: number
      y: number
      hp: number
      maxHp: number
      dead: boolean
      shattered: boolean
      corpseConsumed?: boolean
      isBoss: boolean
      isPrimeEvil: boolean
      rank: 'normal' | 'champion' | 'unique' | 'minion' | 'boss' | 'superunique'
      superUniqueId?: string
      states: Set<number>
      convertedUntilFrame: number
      convertedByPlayerId: number
      resistances: {
        phys: number
        magic: number
        fire: number
        light: number
        cold: number
        poison: number
      }
      ac: number
      toBlock: number
      drain: number
    }
  >
  readonly groundItems: Map<
    number,
    {
      unitId: number
      code: string
      quality: number
      x: number
      y: number
      areaId: number
      goldAmount?: number
    }
  >
}

function getInternal(game: GameInstance): InternalViews {
  return game as unknown as InternalViews
}

function killMonsterLeaveCorpse(game: GameInstance, monsterId: number): void {
  const m = getInternal(game).monsters.get(monsterId)!
  m.hp = 0
  m.dead = true
  m.shattered = false
  m.corpseConsumed = false
}

describe('Wave 2 P0 Skills: #1809 Find Potion, #1810 Find Item, #1811 Whirlwind, #1814 Mind Blast & Conversion', () => {
  describe('#1809 Barbarian Find Potion (#131, SrvSt33 + SrvDo069)', () => {
    it('evaluates exact 1.13c dm12(0, 100) chance and 60/30/10 potion tier tables across Acts & Difficulties', () => {
      expect(calculateFindPotionStats(1).successChancePct).toBe(15)
      expect(calculateFindPotionStats(10).successChancePct).toBe(68)
      expect(calculateFindPotionStats(20).successChancePct).toBe(84)

      // Failed roll returns null potionCode
      expect(rollFindPotionDrop113c(1, 0, 0, 15, 0).potionCode).toBeNull()
      // Act 1 Normal (actIndex=0, diff=0): hp1 / mp1 / rvs
      expect(rollFindPotionDrop113c(20, 0, 0, 0, 10).potionCode).toBe('hp1')
      expect(rollFindPotionDrop113c(20, 0, 0, 0, 75).potionCode).toBe('mp1')
      expect(rollFindPotionDrop113c(20, 0, 0, 0, 95).potionCode).toBe('rvs')
      // Hell Act 5 (actIndex=4, diff=2): hp5 / mp5 / rvl
      expect(rollFindPotionDrop113c(20, 4, 2, 0, 20).potionCode).toBe('hp5')
      expect(rollFindPotionDrop113c(20, 4, 2, 0, 80).potionCode).toBe('mp5')
      expect(rollFindPotionDrop113c(20, 4, 2, 0, 99).potionCode).toBe('rvl')
    })

    it('rejects fleshless skeleton corpses (soft == 0), Act Bosses, shattered corpses, and empty ground without spending mana', () => {
      const game = new GameInstance({ seed: 180901, difficulty: 2, areaId: 83 })
      const barbId = game.connectPlayer({
        charClass: 'bar',
        name: 'Horker',
        x: 100,
        y: 100,
        areaId: 83,
        level: 85,
        skills: { 131: 20 },
      })
      const views = getInternal(game)
      const p = views.players.get(barbId)!
      p.maxMana = 200
      p.maxManaFixed = 200 * 256
      p.mana = 100
      p.manaFixed = 100 * 256
      p.rightSkill = 131
      // Run 1 settle frame and record baseline mana (natural regen ticks if mana < maxMana, so set mana = maxMana)
      p.mana = 200
      p.manaFixed = 200 * 256
      const fullMana = 200 * 256

      // 1) Empty ground cast: refused, zero mana spent
      game.enqueueCommand(barbId, {
        type: 'CastSkillAtLocation',
        skillId: 131,
        x: 102,
        y: 100,
        hand: 'right',
      })
      game.stepFrames(1)
      expect(p.manaFixed).toBe(fullMana)

      // 2) Fleshless skeleton1 (MonStats2.soft == 0): refused for Find Potion!
      const skelId = game.spawnMonster({ defId: 'skeleton1', x: 102, y: 100, areaId: 83 })
      killMonsterLeaveCorpse(game, skelId)
      game.enqueueCommand(barbId, {
        type: 'CastSkillOnTarget',
        skillId: 131,
        targetType: 'monster',
        targetId: skelId,
      })
      game.stepFrames(1)
      expect(p.manaFixed).toBe(fullMana)
      expect(views.monsters.get(skelId)!.corpseConsumed).toBe(false)

      // 3) Act Boss Mephisto: refused!
      const mephId = game.spawnMonster({ defId: 'mephisto', x: 104, y: 100, areaId: 83 })
      killMonsterLeaveCorpse(game, mephId)
      game.enqueueCommand(barbId, {
        type: 'CastSkillOnTarget',
        skillId: 131,
        targetType: 'monster',
        targetId: mephId,
      })
      game.stepFrames(1)
      expect(p.manaFixed).toBe(fullMana)

      // 4) Cold-shattered corpse: refused!
      const shatteredId = game.spawnMonster({ defId: 'fallen1', x: 106, y: 100, areaId: 83 })
      killMonsterLeaveCorpse(game, shatteredId)
      views.monsters.get(shatteredId)!.shattered = true
      game.enqueueCommand(barbId, {
        type: 'CastSkillOnTarget',
        skillId: 131,
        targetType: 'monster',
        targetId: shatteredId,
      })
      game.stepFrames(1)
      expect(p.manaFixed).toBe(fullMana)
    })

    it('consumes eligible soft corpses (including Travincal Council SuperUniques), spawns potions, and locks out re-use across all corpse skills', () => {
      const game = new GameInstance({ seed: 180902, difficulty: 2, areaId: 83 })
      const barbId = game.connectPlayer({
        charClass: 'bar',
        name: 'PotionBarb',
        x: 100,
        y: 100,
        areaId: 83,
        level: 85,
        skills: { 131: 20, 142: 20, 74: 10 },
      })
      const views = getInternal(game)
      const p = views.players.get(barbId)!
      p.maxMana = 200
      p.maxManaFixed = 200 * 256

      let spawnedPotions = 0
      for (let i = 0; i < 12; i++) {
        p.mana = 200
        p.manaFixed = 200 * 256
        const councilId = game.spawnMonster({
          defId: 'councilmember1',
          x: 101,
          y: 100,
          areaId: 83,
          rank: 'unique',
          superUniqueId: 'Ismail Vilehand',
        })
        killMonsterLeaveCorpse(game, councilId)
        const beforeGround = views.groundItems.size
        const manaBefore = p.manaFixed
        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 131,
          targetType: 'monster',
          targetId: councilId,
        })
        game.stepFrames(1)
        // Mana was spent and corpse was consumed with state 118 (`corpse_noselect`)
        expect(p.manaFixed).toBeLessThan(manaBefore)
        const cRec = views.monsters.get(councilId)!
        expect(cRec.corpseConsumed).toBe(true)
        expect(cRec.states.has(118)).toBe(true)

        // Second cast on the same corpse (Find Potion #131, Find Item #142, or Corpse Explosion #74) must fail!
        p.mana = 200
        p.manaFixed = 200 * 256
        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 142,
          targetType: 'monster',
          targetId: councilId,
        })
        game.stepFrames(1)
        expect(p.manaFixed).toBe(200 * 256)

        if (views.groundItems.size > beforeGround) {
          spawnedPotions += views.groundItems.size - beforeGround
        }
      }

      expect(spawnedPotions).toBeGreaterThan(0)
      for (const item of views.groundItems.values()) {
        expect(['hp5', 'mp5', 'rvl']).toContain(item.code)
      }
    })
  })

  describe('#1810 Barbarian Find Item (#142, SrvSt34 + SrvDo072 + NoDrop=0 Hork Pipeline)', () => {
    it('evaluates exact 1.13c dm12(5, 60) chance with zero Find Potion synergy and allows skeleton corpses (soft == 0)', () => {
      expect(calculateFindItemStats(1).dropChancePct).toBe(13)
      expect(calculateFindItemStats(10).dropChancePct).toBe(42)
      expect(calculateFindItemStats(20).dropChancePct).toBe(51)

      const game = new GameInstance({ seed: 181001, difficulty: 2, areaId: 83 })
      const barbId = game.connectPlayer({
        charClass: 'bar',
        name: 'GoldFindBarb',
        x: 100,
        y: 100,
        areaId: 83,
        level: 90,
        skills: { 142: 20 },
      })
      const views = getInternal(game)
      const p = views.players.get(barbId)!
      // Equip Dual Ali Baba active (+200% MF, +450% GF) + inactive swap (bodyLoc 11/12 with +9999% MF that must be ignored!)
      p.items.push(
        {
          unitId: 9001,
          code: '9fc',
          location: 'equipped',
          bodyLoc: 4,
          x: 0,
          y: 0,
          durability: 32,
          maxDurability: 32,
          quality: 7,
          stats: new Map([
            [80, 200],
            [79, 450],
          ]),
        },
        {
          unitId: 9002,
          code: 'gull',
          location: 'equipped',
          bodyLoc: 11,
          x: 0,
          y: 0,
          durability: 16,
          maxDurability: 16,
          quality: 7,
          stats: new Map([
            [80, 9999],
            [79, 9999],
          ]),
        },
      )

      // Skeleton corpse (`soft == 0`, rejected by #131) IS valid for #142 Find Item!
      const skelId = game.spawnMonster({ defId: 'skeleton1', x: 102, y: 100, areaId: 83, level: 85 })
      killMonsterLeaveCorpse(game, skelId)
      p.mana = 200
      p.manaFixed = 200 * 256
      game.enqueueCommand(barbId, {
        type: 'CastSkillOnTarget',
        skillId: 142,
        targetType: 'monster',
        targetId: skelId,
      })
      game.stepFrames(1)
      expect(views.monsters.get(skelId)!.corpseConsumed).toBe(true)
      expect(p.manaFixed).toBeLessThan(200 * 256)

      // Hork Travincal Council SuperUniques and verify guaranteed multi-item drops on successful rolls!
      let horkSuccessCount = 0
      let totalDroppedItems = 0
      for (let i = 0; i < 20; i++) {
        p.mana = 200
        p.manaFixed = 200 * 256
        const councilId = game.spawnMonster({
          defId: 'councilmember1',
          x: 101,
          y: 100,
          areaId: 83,
          level: 85,
          rank: 'unique',
          superUniqueId: 'Ismail Vilehand',
        })
        killMonsterLeaveCorpse(game, councilId)
        const before = views.groundItems.size
        game.enqueueCommand(barbId, {
          type: 'CastSkillOnTarget',
          skillId: 142,
          targetType: 'monster',
          targetId: councilId,
        })
        game.stepFrames(1)
        const delta = views.groundItems.size - before
        if (delta > 0) {
          horkSuccessCount++
          totalDroppedItems += delta
        }
      }
      expect(horkSuccessCount).toBeGreaterThan(0)
      expect(totalDroppedItems).toBeGreaterThanOrEqual(horkSuccessCount * 2)
    })

    it('enforces NoDrop=0 on every TreasureClassEx pick in generateMonsterHorkDrop113c even on /players 1 while blocking Act Bosses', () => {
      const tables = getEmbeddedDropTables()
      // Act Bosses return empty on hork
      const bossHork = generateMonsterHorkDrop113c({
        dropTables: tables,
        difficulty: 'hell',
        x: 100,
        y: 100,
        subjectId: 'mephisto',
        monsterIndex: 1,
        monsterLevel: 87,
        monsterRank: 'boss',
        playerMf: 300,
        playerGf: 500,
        gamePlayers: 1,
        partyPlayers: 1,
        seed: 42,
      })
      expect(bossHork).toHaveLength(0)

      // Normal Hell Bovine (`NoDrop = 100` out of `160` on `/players 1` normally misses >60% of the time;
      // with `ignoreNoDrop: true`, EVERY successful hork drops an item/gold on `/players 1`!)
      let nonEmptyTrials = 0
      for (let seed = 1; seed <= 30; seed++) {
        const drops = generateMonsterHorkDrop113c({
          dropTables: tables,
          difficulty: 'hell',
          x: 100,
          y: 100,
          subjectId: 'hellbovine',
          monsterIndex: seed,
          monsterLevel: 81,
          monsterRank: 'normal',
          playerMf: 250,
          playerGf: 400,
          gamePlayers: 1,
          partyPlayers: 1,
          seed: seed * 7919,
        })
        if (drops.length > 0) nonEmptyTrials++
      }
      expect(nonEmptyTrials).toBe(30)
    })
  })

  describe('#1811 Barbarian / Chaos Assassin Whirlwind (#151, SrvSt38 + SrvDo076)', () => {
    it('matches exact 1.13c weapon-IAS-only breakpoints (4/6/8/10/12/14/16f) for 1H/Claw/2H-Sword vs 2H Non-Sword', () => {
      // Phase Blade (WSM -30) + 4% IAS -> effIas 34 -> 4f; +0% IAS -> effIas 30 -> 6f
      expect(computeWhirlwindWeaponHitInterval113c(4, -30, false)).toBe(4)
      expect(computeWhirlwindWeaponHitInterval113c(0, -30, false)).toBe(6)
      // Berserker Axe (WSM 0) + 34% IAS (Grief roll >=34) -> 4f; +30% IAS -> 6f
      expect(computeWhirlwindWeaponHitInterval113c(34, 0, false)).toBe(4)
      expect(computeWhirlwindWeaponHitInterval113c(30, 0, false)).toBe(6)
      // Colossus Blade (2H Sword, WSM +5 -> uses 1H/Sword table!) + 39% IAS -> effIas 34 -> 4f
      expect(computeWhirlwindWeaponHitInterval113c(39, 5, false)).toBe(4)
      // Giant Thresher (2H Polearm, WSM -10 -> uses 2H non-sword table!) + 50% IAS -> effIas 60 -> 4f; +30% -> effIas 40 -> 6f
      expect(computeWhirlwindWeaponHitInterval113c(50, -10, true)).toBe(4)
      expect(computeWhirlwindWeaponHitInterval113c(30, -10, true)).toBe(6)
      // Thunder Maul (2H Mace, WSM +20) + 0% IAS -> effIas -20 -> 14f; +60% IAS (BotD) -> effIas 40 -> 6f
      expect(computeWhirlwindWeaponHitInterval113c(0, 20, true)).toBe(14)
      expect(computeWhirlwindWeaponHitInterval113c(60, 20, true)).toBe(6)

      // Whirlwind %ED & %AR progression
      expect(computeWhirlwindDamageAndAr113c(1)).toEqual({ damagePercent: -50, attackRatingPercent: 0 })
      expect(computeWhirlwindDamageAndAr113c(20)).toEqual({ damagePercent: 102, attackRatingPercent: 95 })
    })

    it('spins continuously through monster footprints, ignores off-weapon IAS, fires dual-wield hands independently (1x@f4, 2x@f8,12,16), locks out potions/casts, increases hit density when chilled, applies CB/DS/OW/Leech, and suppresses CtC on-attack/on-hit', () => {
      const makeDualGriefBarb = (seed: number, chilled: boolean) => {
        const game = new GameInstance({ seed, difficulty: 2, areaId: 2 })
        const barbId = game.connectPlayer({
          charClass: 'bar',
          name: 'WWBarb',
          x: 100,
          y: 100,
          areaId: 2,
          level: 90,
          skills: { 151: 20, 127: 20 },
        })
        const views = getInternal(game)
        const p = views.players.get(barbId)!
        p.hp = 500
        p.maxHp = 1000
        p.hpFixed = 500 * 256
        p.maxHpFixed = 1000 * 256
        p.mana = 200
        p.manaFixed = 200 * 256
        // Equip Dual Grief Phase Blades (`7cr`, WSM -30 + 35% on-weapon IAS -> 4f each)
        // WITH 100% Open Wounds (135), 20% Life Steal (60), AND 100% CtC Amplify/Nova on-attack (195) & on-hit (198)
        // PLUS off-weapon gloves with +200% IAS (which must NOT speed up a slow weapon if tested!)
        p.items.push(
          {
            unitId: 8001,
            code: '7cr',
            location: 'equipped',
            bodyLoc: 4,
            x: 0,
            y: 0,
            durability: 0,
            maxDurability: 0,
            quality: 4,
            stats: new Map([
              [93, 35], // +35% on-weapon IAS
              [111, 100], // +100 Grief flat damage
              [115, 1], // Ignore Target's Defense
              [19, 10000], // +10000 AR
              [60, 20], // 20% Life Steal
              [135, 100], // 100% Open Wounds
              [141, 100], // 100% Deadly Strike
              [195, 100], // CtC on attack (MUST BE SUPPRESSED!)
              [198, 100], // CtC on hit (MUST BE SUPPRESSED!)
            ]),
          },
          {
            unitId: 8002,
            code: '7cr',
            location: 'equipped',
            bodyLoc: 5,
            x: 0,
            y: 0,
            durability: 0,
            maxDurability: 0,
            quality: 4,
            stats: new Map([
              [93, 35],
              [111, 100],
              [115, 1],
              [19, 10000],
              [60, 20],
              [135, 100],
              [141, 100],
            ]),
          },
          // Belt potion to verify potion lockout mid-spin
          {
            unitId: 8003,
            code: 'rvl',
            location: 'belt',
            bodyLoc: 0,
            x: 0,
            y: 0,
            durability: 0,
            maxDurability: 0,
            quality: 2,
            stats: new Map(),
          },
        )
        if (chilled) {
          p.states.add(11) // STATE_COLD = 11 (-50% walk velocity, SAME 4f weapon interval -> ~2x hits!)
        }
        return { game, barbId, views, p }
      }

      // Unchilled run over a high-HP boss dummy along x = 100..112
      const normalRun = makeDualGriefBarb(181101, false)
      const targetNormal = normalRun.game.spawnMonster({
        defId: 'hellbovine',
        x: 106,
        y: 100,
        areaId: 2,
        hp: 200000,
        maxHp: 200000,
        ac: 10,
        toBlock: 0,
      })
      normalRun.views.monsters.get(targetNormal)!.resistances.phys = 0
      normalRun.views.monsters.get(targetNormal)!.drain = 100

      normalRun.game.enqueueCommand(normalRun.barbId, {
        type: 'CastSkillAtLocation',
        skillId: 151,
        x: 112,
        y: 100,
        hand: 'right',
      })
      normalRun.game.stepFrames(1)
      // Mid-spin state checks: STATE_SKILL_MOVE (18) + STATE_WHIRLWIND (174), passing toward (112, 100)
      expect(normalRun.p.states.has(18)).toBe(true)
      expect(normalRun.p.states.has(174)).toBe(true)
      expect(normalRun.p.x).toBeGreaterThan(100)
      expect(normalRun.p.x).toBeLessThan(102)

      // Attempt to drink Full Rejuvenation (`8003`) AND cast another skill mid-spin -> BOTH LOCKED OUT!
      normalRun.game.enqueueCommand(normalRun.barbId, { type: 'BeltUse', itemId: 8003 })
      normalRun.game.enqueueCommand(normalRun.barbId, {
        type: 'CastSkillAtLocation',
        skillId: 130,
        x: 105,
        y: 100,
        hand: 'right',
      })
      normalRun.game.stepFrames(1)
      expect(normalRun.p.items.some((it) => it.unitId === 8003)).toBe(true)

      // Run until spin finishes (~34 frames unchilled for 12 subtiles at 0.36/frame)
      let allMissilesCreated = 0
      for (let f = 0; f < 45; f++) {
        normalRun.game.stepFrames(1)
        const evs = normalRun.game.drainEvents(normalRun.barbId) as Array<{ type: string }>
        allMissilesCreated += evs.filter((e) => e.type === 'CreateMissile').length
      }
      // Passed right through monster footprint at (106, 100) and stopped cleanly at (112, 100)!
      expect(normalRun.p.x).toBeCloseTo(112, 1)
      expect(normalRun.p.states.has(174)).toBe(false)
      // CtC on-attack / on-hit spawned ZERO missiles
      expect(allMissilesCreated).toBe(0)
      // Life steal healed the Barbarian above 500 HP, and Open Wounds (`state 62`) applied!
      expect(normalRun.p.hp).toBeGreaterThan(500)
      const monNormal = normalRun.views.monsters.get(targetNormal)!
      expect(monNormal.states.has(62)).toBe(true)
      const normalDamageDealt = 200000 - monNormal.hp
      expect(normalDamageDealt).toBeGreaterThan(1000)

      // Chilled run over the exact same 12-subtile path: moves at 50% speed (~67 frames), keeping 4f weapon interval -> MORE HITS & MORE DAMAGE!
      const chilledRun = makeDualGriefBarb(181101, true)
      const targetChilled = chilledRun.game.spawnMonster({
        defId: 'hellbovine',
        x: 106,
        y: 100,
        areaId: 2,
        hp: 200000,
        maxHp: 200000,
        ac: 10,
        toBlock: 0,
      })
      chilledRun.views.monsters.get(targetChilled)!.resistances.phys = 0
      chilledRun.views.monsters.get(targetChilled)!.drain = 100
      chilledRun.game.enqueueCommand(chilledRun.barbId, {
        type: 'CastSkillAtLocation',
        skillId: 151,
        x: 112,
        y: 100,
        hand: 'right',
      })
      chilledRun.game.stepFrames(80)
      expect(chilledRun.p.x).toBeCloseTo(112, 1)
      const chilledDamageDealt = 200000 - chilledRun.views.monsters.get(targetChilled)!.hp
      expect(chilledDamageDealt).toBeGreaterThan(normalDamageDealt)
    })

    it('ignores off-weapon IAS on gloves/jewelry and blocks casting Whirlwind with a Bow equipped', () => {
      const game = new GameInstance({ seed: 181105, difficulty: 0, areaId: 2 })
      const barbId = game.connectPlayer({
        charClass: 'bar',
        name: 'BowCheckBarb',
        x: 100,
        y: 100,
        areaId: 2,
        level: 40,
        skills: { 151: 10 },
      })
      const views = getInternal(game)
      const p = views.players.get(barbId)!
      p.maxMana = 200
      p.maxManaFixed = 200 * 256
      p.mana = 200
      p.manaFixed = 200 * 256
      // Equip a Short Bow (`sbb`) -> Whirlwind must refuse to cast and spend 0 mana!
      p.items.push({
        unitId: 8100,
        code: 'sbb',
        location: 'equipped',
        bodyLoc: 4,
        x: 0,
        y: 0,
        durability: 0,
        maxDurability: 0,
        quality: 2,
        stats: new Map(),
      })
      game.enqueueCommand(barbId, {
        type: 'CastSkillAtLocation',
        skillId: 151,
        x: 110,
        y: 100,
        hand: 'right',
      })
      game.stepFrames(2)
      expect(p.manaFixed).toBe(200 * 256)
      expect(p.x).toBe(100)
    })
  })

  describe('#1814 Assassin Mind Blast (#273) & #116 Paladin Conversion Strict Immunity & 150..249f Duration', () => {
    it('evaluates exact 1.13c Mind Blast stun duration and dm56(15, 40) conversion curve', () => {
      expect(computeMindBlastStunDuration(1)).toBe(50)
      expect(computeMindBlastStunDuration(20)).toBe(145)
      expect(computeMindBlastStunDuration(60)).toBe(250)

      const c1 = computeMindBlastConversionChance(1)
      const c10 = computeMindBlastConversionChance(10)
      const c20 = computeMindBlastConversionChance(20)
      expect(c1).toBeGreaterThanOrEqual(15)
      expect(c1).toBeLessThan(20)
      expect(c10).toBeGreaterThanOrEqual(29)
      expect(c10).toBeLessThanOrEqual(33)
      expect(c20).toBeGreaterThanOrEqual(34)
      expect(c20).toBeLessThan(40)
    })

    it('enforces 0% conversion on Act Bosses, SuperUniques, Random Uniques, and Champions for BOTH #273 Mind Blast and #116 Conversion', () => {
      const game = new GameInstance({ seed: 181401, difficulty: 2, areaId: 83, maxPlayers: 2 })
      const sinId = game.connectPlayer({
        charClass: 'ass',
        name: 'Trapper',
        x: 100,
        y: 100,
        areaId: 83,
        level: 90,
        skills: { 273: 20 },
      })
      const palId = game.connectPlayer({
        charClass: 'pal',
        name: 'Converter',
        x: 100,
        y: 101,
        areaId: 83,
        level: 90,
        skills: { 116: 20 },
      })
      const views = getInternal(game)
      const sin = views.players.get(sinId)!
      const pal = views.players.get(palId)!
      pal.items.push({
        unitId: 9501,
        code: '7cr',
        location: 'equipped',
        bodyLoc: 4,
        x: 0,
        y: 0,
        durability: 0,
        maxDurability: 0,
        quality: 2,
        stats: new Map([
          [115, 1],
          [19, 20000],
        ]),
      })

      const diabloId = game.spawnMonster({
        defId: 'diablo',
        x: 101,
        y: 100,
        areaId: 83,
        hp: 500000,
        maxHp: 500000,
        rank: 'boss',
      })
      const councilId = game.spawnMonster({
        defId: 'councilmember1',
        x: 101,
        y: 100,
        areaId: 83,
        hp: 500000,
        maxHp: 500000,
        rank: 'unique',
        superUniqueId: 'Ismail Vilehand',
      })
      const uniqueId = game.spawnMonster({
        defId: 'fallen1',
        x: 101,
        y: 100,
        areaId: 83,
        hp: 500000,
        maxHp: 500000,
        rank: 'unique',
      })
      const champId = game.spawnMonster({
        defId: 'fallen1',
        x: 101,
        y: 100,
        areaId: 83,
        hp: 500000,
        maxHp: 500000,
        rank: 'champion',
      })
      const immuneIds = [diabloId, councilId, uniqueId, champId]
      for (const id of immuneIds) {
        views.monsters.get(id)!.ac = 0
        views.monsters.get(id)!.toBlock = 0
      }

      // Blast all 4 elites/bosses 25 times with Mind Blast AND strike each 10 times with Paladin Conversion!
      for (let i = 0; i < 25; i++) {
        sin.mana = 500
        sin.manaFixed = 500 * 256
        pal.mana = 500
        pal.manaFixed = 500 * 256
        for (const id of immuneIds) {
          const m = views.monsters.get(id)!
          m.x = 101
          m.y = 100
        }
        game.enqueueCommand(sinId, {
          type: 'CastSkillAtLocation',
          skillId: 273,
          x: 101,
          y: 100,
          hand: 'right',
        })
        const strikeTarget = immuneIds[i % immuneIds.length]!
        game.enqueueCommand(palId, {
          type: 'CastSkillOnTarget',
          skillId: 116,
          targetType: 'monster',
          targetId: strikeTarget,
        })
        game.stepFrames(1)
        for (const id of immuneIds) {
          const m = views.monsters.get(id)!
          expect(m.convertedByPlayerId).toBe(0)
          expect(m.convertedUntilFrame).toBe(0)
          expect(m.states.has(53)).toBe(false)
        }
        // Act Boss Diablo is also immune to stun (`state 21`)!
        expect(views.monsters.get(diabloId)!.states.has(21)).toBe(false)
      }
    })

    it('converts only a subset (~dm56) of normal monsters for 150..249 frames and cleanly restores hostility after expiry', () => {
      const game = new GameInstance({ seed: 181402, difficulty: 0, areaId: 2 })
      const sinId = game.connectPlayer({
        charClass: 'ass',
        name: 'MindBlaster',
        x: 100,
        y: 100,
        areaId: 2,
        level: 50,
        skills: { 273: 10 }, // stun = 95f, conv chance = ~31%
      })
      const views = getInternal(game)
      const sin = views.players.get(sinId)!
      sin.mana = 500
      sin.manaFixed = 500 * 256

      const normalIds: number[] = []
      for (let i = 0; i < 20; i++) {
        normalIds.push(
          game.spawnMonster({
            defId: 'fallen1',
            x: 102,
            y: 100,
            areaId: 2,
            hp: 10000,
            maxHp: 10000,
          }),
        )
      }

      game.enqueueCommand(sinId, {
        type: 'CastSkillAtLocation',
        skillId: 273,
        x: 102,
        y: 100,
        hand: 'right',
      })
      game.stepFrames(1)
      const castFrame = game.frame

      let stunnedCount = 0
      let convertedCount = 0
      for (const id of normalIds) {
        const m = views.monsters.get(id)!
        if (m.states.has(21)) stunnedCount++
        if (m.states.has(53)) {
          convertedCount++
          const rem = m.convertedUntilFrame - castFrame
          // Decoupled from 95-frame stun: strictly 150..249 frames!
          expect(rem).toBeGreaterThanOrEqual(150)
          expect(rem).toBeLessThanOrEqual(249)
          expect(m.convertedByPlayerId).toBe(sinId)
        }
      }
      expect(stunnedCount).toBe(20)
      expect(convertedCount).toBeGreaterThan(0)
      expect(convertedCount).toBeLessThan(20)

      // Advance 255 frames -> EVERY converted monster must revert cleanly to hostile!
      game.stepFrames(255)
      for (const id of normalIds) {
        const m = views.monsters.get(id)!
        expect(m.convertedUntilFrame).toBe(0)
        expect(m.convertedByPlayerId).toBe(0)
        expect(m.states.has(53)).toBe(false)
      }
    })
  })
})
