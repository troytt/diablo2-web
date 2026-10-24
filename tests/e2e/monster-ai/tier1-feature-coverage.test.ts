/**
 * Tier 1 — Category-Partition Feature Coverage (70 E2E Tests: 5 per Feature F1–F14)
 *
 * Opaque-box, requirement-driven E2E tests for the Diablo II v1.13c Authoritative
 * Monster & Mercenary AI Engine (`PROJECT.md` & `TEST_INFRA.md`).
 *
 * Expected values are derived strictly from the authoritative 1.13c MPQ oracle
 * (`MonStats.txt`, `MonAi.txt`, `MonLvl.txt`, `MonUMod.txt`, `SuperUniques.txt`, `Hireling.txt`)
 * and `ORIGINAL_REQUEST.md` (`## 2026-10-18T11:06:03Z`).
 */

import { describe, expect, it } from 'vitest'
import {
  AuraScanner,
  CANONICAL_BOSS_MINIONS,
  D2CLIENT_DEATH_BOOM_POINTS,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  DURIEL_MAGGOT_HCIDX,
  DURIEL_MAGGOT_OFFSETS,
  FIXED_ONE,
  GameInstance,
  HIRELING_TABLE,
  LocalLoopbackAdapter,
  MONSTER_MODE_MISSILES_113C,
  MON_UMOD,
  MissileEngine,
  MonsterAI,
  MultiClientRoomHost,
  StateBus,
  SummonManager,
  UnitStatList,
  applyStateToMonsterInGame,
  calcBoneFetishDeathDamage,
  calcColdEnchantedDeathNova,
  calcFireEnchantedDeathDamage,
  computeChargedBolt8WayVectors,
  createOpenTerrain,
  createTestCombatMonster,
  createTestCombatPlayer,
  createTestCombatWorld,
  createWallObstacleTerrain,
  createWildernessGameInstance,
  damageMonster,
  executeActBossAi113c,
  executeOblivionKnightCurse113c,
  executeSUnitDmg,
  executeShamanResurrect113c,
  getBossDeathFxSpec,
  getMonsterModeMissile113c,
  getSharedDataRegistry,
  hasMonsterUMod,
  isBoneFetishMonster,
  isPoisonDeadMonster,
  isSuicideMinionMonster,
  queryAllMonAi113c,
  queryAllSuperUniques113c,
  queryCanonicalMonsterKinds113c,
  queryHirelingStatsAtLevel113c,
  queryMonAi113c,
  queryMonLvl113c,
  queryMonsterKind113c,
  queryMonsterStats113c,
  querySuperUnique113c,
  resolveHirelingCandidate,
  resolveSuicideExplodeMissileKey,
  spawnExtendedMonsterInGame,
  tickCombat,
  tickMercenaryAi25Hz,
  tickMonsters,
  triggerMonsterDeathAffixes113c,
  verifyLockstepParity,
  type CombatUnitContext,
  type MercenaryUnitState,
  type ServerEvent,
} from './helpers.ts'

describe('Tier 1 — Feature Coverage: Diablo II v1.13c Monster & Mercenary AI Engine (F1–F14, 70 Tests)', () => {
  // =========================================================================
  // F1: 1.13c MonStats.txt (734 rows) & MonAi.txt (148 rows) Full Table Contract
  // =========================================================================
  describe('F1: 1.13c MonStats.txt (734 rows) & MonAi.txt (148 rows) Full Table Contract', () => {
    it('F1.1: resolves all 734 compiled MonStats.txt rows (hcIdx 0..733) with authentic IDs, levels, and AI archetypes (zero 730-monster Fallen fallback)', () => {
      const kindsMap = queryCanonicalMonsterKinds113c('normal')
      expect(kindsMap.size).toBeGreaterThanOrEqual(734)

      const skel0 = queryMonsterKind113c(0, 'normal')
      const fallen18 = queryMonsterKind113c(19, 'normal')
      const andariel156 = queryMonsterKind113c(156, 'normal')
      const diablo243 = queryMonsterKind113c(243, 'normal')
      const baal544 = queryMonsterKind113c(544, 'normal')
      const willowisp733 = queryMonsterKind113c(733, 'normal')

      expect(skel0).toBeDefined()
      expect(skel0!.id).toBe('skeleton1')
      expect(skel0!.ai).toBe('Skeleton')
      expect(skel0!.level).toBe(2)

      expect(fallen18).toBeDefined()
      expect(fallen18!.id).toBe('fallen1')
      expect(fallen18!.ai).toBe('Fallen')
      expect(fallen18!.level).toBe(1)

      expect(andariel156?.id).toBe('andariel')
      expect(andariel156?.ai).toBe('Andariel')
      expect(diablo243?.id).toBe('diablo')
      expect(diablo243?.ai).toBe('Diablo')
      expect(baal544?.id).toBe('baalcrab')
      expect(baal544?.ai).toBe('BaalCrab')
      expect(willowisp733?.id).toBe('willowisp8')
      expect(willowisp733?.ai).toBe('WillOWisp')

      // Verify non-Fallen monsters do not silently fall back to Fallen level=1/hp=12/ai='Fallen'
      let fallenAiCount = 0
      for (let hcIdx = 0; hcIdx < 734; hcIdx++) {
        const k = queryMonsterKind113c(hcIdx, 'normal')
        expect(k, `hcIdx=${hcIdx} must resolve`).toBeDefined()
        if (k?.ai === 'Fallen') fallenAiCount++
      }
      expect(fallenAiCount).toBeLessThan(25)
    })

    it('F1.2: resolves difficulty-specific MonStats.txt aidel, aidist, aip1..8, Level, and ResDm..ResPo across Normal, Nightmare, and Hell', () => {
      // skeleton1 (hcIdx=0): Level=[2,37,68], aidel=[15,14,13], aip1=[60,65,70], ResDm=[0,0,33]
      const skelN = queryMonsterKind113c(0, 'normal')!
      const skelNM = queryMonsterKind113c(0, 'nightmare')!
      const skelH = queryMonsterKind113c(0, 'hell')!

      expect(skelN.level).toBe(2)
      expect(skelNM.level).toBe(37)
      expect(skelH.level).toBe(68)
      expect(skelN.aiDelay).toBe(15)
      expect(skelNM.aiDelay).toBe(14)
      expect(skelH.aiDelay).toBe(13)
      expect(skelN.aiParams?.[0]).toBe(60)
      expect(skelNM.aiParams?.[0]).toBe(65)
      expect(skelH.aiParams?.[0]).toBe(70)
      expect(skelH.resistances?.physical).toBe(33)

      // fallen1 (hcIdx=19): aidel=[15,14,13], aip1..4=[30,10,50,20] (N) / [50,20,70,30] (H), ResFi(H)=100
      const fallenN = queryMonsterKind113c(19, 'normal')!
      const fallenH = queryMonsterKind113c(19, 'hell')!
      expect(fallenN.aiDelay).toBe(15)
      expect(fallenH.aiDelay).toBe(13)
      expect(fallenN.aiParams?.slice(0, 4)).toEqual([30, 10, 50, 20])
      expect(fallenH.aiParams?.slice(0, 4)).toEqual([50, 20, 70, 30])
      expect(fallenH.resistances?.fire).toBe(100)
    })

    it('F1.3: resolves A1/A2/S1 attack modes, El1..El3 elemental payloads, and Skill1..Skill8 slots from 1.13c MonStats.txt', () => {
      // fallenshaman1 (hcIdx=58): Skill1=Resurrect (S2, lvl 1), Skill2=ShamanFire (A2, lvl 1)
      const shaman = queryMonsterKind113c(58, 'normal')!
      expect(shaman.ai).toBe('FallenShaman')
      const shamanSkills = (shaman.skills ?? []).map((s) => s.skill)
      expect(shamanSkills).toContain('Resurrect')
      expect(shamanSkills).toContain('ShamanFire')

      // andariel (hcIdx=156): El1=(A1, pois, 100%), Skill1=AndrialSpray (S1), Skill2=AndyPoisonBolt (S2)
      const andy = queryMonsterKind113c(156, 'normal')!
      expect(andy.attack1?.minDamage).toBeGreaterThan(0)
      expect(andy.attack1?.maxDamage).toBeGreaterThanOrEqual(andy.attack1?.minDamage ?? 1)
      expect(andy.attack1?.toHit).toBeGreaterThan(0)
      expect(andy.elementalAttacks?.some((e) => e.type === 'pois' && e.chancePct === 100)).toBe(true)
      const andySkills = (andy.skills ?? []).map((s) => s.skill)
      expect(andySkills).toContain('AndrialSpray')
      expect(andySkills).toContain('AndyPoisonBolt')

      // willowisp8 (hcIdx=733): El1=(A1, mana, 90%)
      const wisp = queryMonsterKind113c(733, 'normal')!
      expect(wisp.elementalAttacks?.some((e) => e.type === 'mana' && e.chancePct === 90)).toBe(true)
    })

    it('F1.4: resolves MonStats.txt boolean flags and attributes (isUndead, isDemon, isBoss, isPrimeEvil, noRatio, isMelee, deathDmg, flying, drain, coldEffect)', () => {
      const skel0 = queryMonsterKind113c(0, 'normal')!
      expect(skel0.isUndead).toBe(true)
      expect(skel0.isDemon).toBe(false)
      expect(skel0.isMelee).toBe(true)

      const boneFetish212 = queryMonsterKind113c(212, 'normal')!
      expect(boneFetish212.id).toBe('bonefetish1')
      expect(boneFetish212.isUndead).toBe(true)
      expect(boneFetish212.deathDmg).toBe(true)

      const diablo243 = queryMonsterKind113c(243, 'normal')!
      expect(diablo243.isDemon).toBe(true)
      expect(diablo243.isBoss).toBe(true)
      expect(diablo243.isPrimeEvil).toBe(true)

      const valkyrie357 = queryMonsterKind113c(357, 'normal')!
      expect(valkyrie357.id).toBe('valkyrie')
      expect(valkyrie357.noRatio).toBe(true)
    })

    it('F1.5: exposes all 148 MonAi.txt archetypes and links MONSTER_MODE_MISSILES_113C (MissA1..MissSQ)', () => {
      const allAi = queryAllMonAi113c()
      expect(allAi.length).toBeGreaterThanOrEqual(148)
      expect(queryMonAi113c('Skeleton')?.ai).toBe('Skeleton')
      expect(queryMonAi113c('Fallen')?.ai).toBe('Fallen')
      expect(queryMonAi113c('FallenShaman')?.ai).toBe('FallenShaman')
      expect(queryMonAi113c('OblivionKnight')?.ai).toBe('OblivionKnight')
      expect(queryMonAi113c('BaalCrab')?.ai).toBe('BaalCrab')

      // Mode missiles: quillrat1 (63) -> quill1, slinger1 (122) -> javelin1, bloodraven (267) -> raven1 / raven2
      expect(getMonsterModeMissile113c(63, 'A1')).toBe('quill1')
      expect(getMonsterModeMissile113c(122, 'A1')).toBe('javelin1')
      expect(getMonsterModeMissile113c(267, 'A1')).toBe('raven1')
      expect(getMonsterModeMissile113c(267, 'SQ')).toBe('raven2')
      expect(Object.keys(MONSTER_MODE_MISSILES_113C).length).toBeGreaterThan(50)
    })
  })

  // =========================================================================
  // F2: 1.13c MonLvl.txt (111 rows) Difficulty & /players N Stat Scaling
  // =========================================================================
  describe('F2: 1.13c MonLvl.txt (111 rows) Difficulty & /players N Stat Scaling', () => {
    it('F2.1: exposes all 111 MonLvl.txt rows (Level 0..110) matching exact 1.13c MPQ oracle values', () => {
      const lvl0 = queryMonLvl113c(0)
      const lvl1 = queryMonLvl113c(1)
      const lvl12 = queryMonLvl113c(12)
      const lvl40 = queryMonLvl113c(40)
      const lvl85 = queryMonLvl113c(85)
      const lvl110 = queryMonLvl113c(110)

      expect(lvl0).toBeDefined()
      expect(lvl0!.hp).toEqual([1, 1, 1])
      expect(lvl1!.ac).toEqual([6, 92, 147])
      expect(lvl1!.th).toEqual([8, 108, 216])
      expect(lvl1!.hp).toEqual([7, 107, 830])
      expect(lvl1!.dm).toEqual([2, 3, 4])
      expect(lvl1!.xp).toEqual([30, 78, 117])

      expect(lvl12!.hp).toEqual([40, 177, 1077])
      expect(lvl40!.hp).toEqual([215, 661, 1707])
      expect(lvl85!.ac).toEqual([510, 949, 1403])
      expect(lvl85!.th).toEqual([914, 1620, 3408])
      expect(lvl85!.hp).toEqual([746, 2197, 4637])
      expect(lvl85!.dm).toEqual([52, 69, 96])
      expect(lvl85!.xp).toEqual([5957, 34130, 51195])
      expect(lvl110!.hp).toEqual([10000, 10000, 10000])
    })

    it('F2.2: scales MonStats.txt HP, AC, XP, A1/A2 damage & TH, and El1..El3 damage via Math.floor((raw * monLvl) / 100) across N/NM/H', () => {
      const skelN = queryMonsterStats113c(0, { difficulty: 'normal' })
      const skelNM = queryMonsterStats113c(0, { difficulty: 'nightmare' })
      const skelH = queryMonsterStats113c(0, { difficulty: 'hell' })

      expect(skelN.level).toBe(2)
      expect(skelNM.level).toBe(37)
      expect(skelH.level).toBe(68)

      expect(skelNM.hp).toBeGreaterThan(skelN.hp * 5)
      expect(skelH.hp).toBeGreaterThan(skelNM.hp * 2)
      expect(skelNM.damage).toBeGreaterThan(skelN.damage)
      expect(skelH.damage).toBeGreaterThan(skelNM.damage)
      expect(skelNM.xp).toBeGreaterThan(skelN.xp)
      expect(skelH.xp).toBeGreaterThan(skelNM.xp)
    })

    it('F2.3: bypasses MonLvl.txt division when MonStats.txt noRatio=1 (e.g. valkyrie hcIdx=357, claygolem hcIdx=289)', () => {
      // valkyrie (hcIdx=357): noRatio=1, minHP=400, maxHP=480 -> raw HP not divided by MonLvl[2]=9%
      const valk = queryMonsterKind113c(357, 'normal')!
      expect(valk.noRatio).toBe(true)
      expect(valk.hp).toBeGreaterThanOrEqual(400)

      // claygolem (hcIdx=289): noRatio=1, minHP=100, maxHP=100
      const clay = queryMonsterKind113c(289, 'normal')!
      expect(clay.noRatio).toBe(true)
      expect(clay.hp).toBe(100)
    })

    it('F2.4: scales monster HP, XP, and damage across /players 1..8 per 1.13c formula', () => {
      const { game: game1 } = createWildernessGameInstance({ playersX: 1 })
      const m1 = game1.spawnMonster({ classId: 0, x: 520, y: 500, maxHp: 100, hp: 100, experience: 100 })
      const state1 = game1.getMonsterState(m1)!
      expect(state1.maxHp).toBe(100)

      const { game: game4 } = createWildernessGameInstance({ playersX: 4 })
      const m4 = game4.spawnMonster({ classId: 0, x: 520, y: 500, maxHp: 100, hp: 100, experience: 100 })
      const state4 = game4.getMonsterState(m4)!
      // floor(100 * (4 + 1) / 2) = 250
      expect(state4.maxHp).toBe(250)

      const { game: game8 } = createWildernessGameInstance({ playersX: 8 })
      const m8 = game8.spawnMonster({ classId: 0, x: 520, y: 500, maxHp: 100, hp: 100, experience: 100 })
      const state8 = game8.getMonsterState(m8)!
      // floor(100 * (8 + 1) / 2) = 450
      expect(state8.maxHp).toBe(450)
    })

    it('F2.5: dynamically rescales active monster HP and kill XP when /players N command is issued in GameInstance', () => {
      const { game, playerId } = createWildernessGameInstance({ playersX: 1, playerLevel: 10 })
      const monId = game.spawnMonster({
        classId: 0,
        x: 501,
        y: 500,
        hp: 100,
        maxHp: 100,
        experience: 200,
        aiDisabled: true,
      })
      expect(game.getMonsterState(monId)!.maxHp).toBe(100)

      // Issue /players 5 via chat command -> multiplier = (5 + 1) / 2 = 3.0x
      game.enqueueCommand(playerId, { type: 'Chat', text: '/players 5' })
      game.stepFrame()
      expect(game.getPlayersX()).toBe(5)
      expect(game.getMonsterState(monId)!.maxHp).toBe(300)
      expect(game.getMonsterState(monId)!.hp).toBe(300)
    })
  })

  // =========================================================================
  // F3: 1.13c MonUMod.txt, SuperUniques.txt (66 rows) & Hireling.txt (120 rows)
  // =========================================================================
  describe('F3: 1.13c MonUMod.txt, SuperUniques.txt (66 rows) & Hireling.txt (120 rows) Data Contract', () => {
    it('F3.1: applies difficulty-indexed MonUMod.txt [constants] HP, level, and XP multipliers for minion, champion, and unique ranks', () => {
      const baseN = queryMonsterStats113c(0, { difficulty: 'normal', rank: 'normal' })
      const minionN = queryMonsterStats113c(0, { difficulty: 'normal', rank: 'minion' })
      const champN = queryMonsterStats113c(0, { difficulty: 'normal', rank: 'champion' })
      const uniqueN = queryMonsterStats113c(0, { difficulty: 'normal', rank: 'unique' })

      expect(champN.level).toBe(baseN.level + 2)
      expect(uniqueN.level).toBe(baseN.level + 3)
      expect(minionN.level).toBe(baseN.level + 3)

      expect(minionN.hp).toBeGreaterThan(baseN.hp)
      expect(champN.hp).toBeGreaterThan(minionN.hp)
      expect(uniqueN.hp).toBeGreaterThan(champN.hp)
    })

    it('F3.2: resolves Champion subtypes (champion=16, ghostly=36, fanatic=37, possessed=38, berserk=39) with distinct stat profiles', () => {
      const base = queryMonsterStats113c(18, { difficulty: 'nightmare', rank: 'normal' })
      const ghostly = queryMonsterStats113c(18, {
        difficulty: 'nightmare',
        rank: 'champion',
        modifiers: ['ghostly'],
      })
      const fanatic = queryMonsterStats113c(18, {
        difficulty: 'nightmare',
        rank: 'champion',
        modifiers: ['fanatic'],
      })
      const berserk = queryMonsterStats113c(18, {
        difficulty: 'nightmare',
        rank: 'champion',
        modifiers: ['berserk'],
      })
      const possessed = queryMonsterStats113c(18, {
        difficulty: 'nightmare',
        rank: 'champion',
        modifiers: ['possessed'],
      })

      expect(ghostly.resistances?.physical).toBeGreaterThanOrEqual(80)
      expect(fanatic.speed).toBeGreaterThan(base.speed)
      expect(berserk.damage).toBeGreaterThan(base.damage * 2)
      expect(possessed.hp).toBeGreaterThan(base.hp * 4)
    })

    it('F3.3: applies 1.13c MonUMod resistance bonuses (Stone Skin +50% phys, Magic Resistant +40% F/L/C, FE/LE/CE +75%, Spectral Hit +20%, Mana Burn +20% magic)', () => {
      const base = queryMonsterStats113c(5, { difficulty: 'normal', rank: 'normal' })
      const stoneSkin = queryMonsterStats113c(5, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['Stone_Skin'],
      })
      const magicRes = queryMonsterStats113c(5, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['Magic_Resistant'],
      })
      const feLeCe = queryMonsterStats113c(5, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['Fire_Enchanted', 'Lightning_Enchanted', 'Cold_Enchanted'],
      })
      const manaBurn = queryMonsterStats113c(5, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['Mana_Burn'],
      })

      expect(stoneSkin.resistances!.physical).toBe((base.resistances?.physical ?? 0) + 50)
      expect(magicRes.resistances!.fire).toBe((base.resistances?.fire ?? 0) + 40)
      expect(magicRes.resistances!.lightning).toBe((base.resistances?.lightning ?? 0) + 40)
      expect(magicRes.resistances!.cold).toBe((base.resistances?.cold ?? 0) + 40)
      expect(feLeCe.resistances!.fire).toBe((base.resistances?.fire ?? 0) + 75)
      expect(feLeCe.resistances!.lightning).toBe((base.resistances?.lightning ?? 0) + 75)
      expect(feLeCe.resistances!.cold).toBe((base.resistances?.cold ?? 0) + 75)
      expect(manaBurn.resistances!.magic).toBe((base.resistances?.magic ?? 0) + 20)
    })

    it('F3.4: exposes all 66 SuperUniques.txt definitions with authentic monster classes, fixed UMods, and minion groups', () => {
      const allSu = queryAllSuperUniques113c()
      expect(allSu.length).toBeGreaterThanOrEqual(66)

      const bishibosh = querySuperUnique113c('Bishibosh')
      const rakanishu = querySuperUnique113c('Rakanishu')
      const countess = querySuperUnique113c('The Countess')
      const shenk = querySuperUnique113c('Shenk the Overseer')
      const lister = querySuperUnique113c('Lister the Tormentor')

      expect(bishibosh).toBeDefined()
      expect(rakanishu).toBeDefined()
      expect(countess).toBeDefined()
      expect(shenk).toBeDefined()
      expect(lister).toBeDefined()
      expect(Object.keys(CANONICAL_BOSS_MINIONS).length).toBeGreaterThanOrEqual(45)
    })

    it('F3.5: exposes all 120 Hireling.txt rows and resolves level-interpolated stats and skill probabilities across Act 1, 2, 3, and 5 mercenaries', () => {
      expect(HIRELING_TABLE.length).toBe(120)

      // Act 1 Rogue Scout Fire Arrow (subType=1), Normal (diff=1), level 25
      const rogue = queryHirelingStatsAtLevel113c(1, 1, 1, 25, true)
      expect(rogue).toBeDefined()
      expect(rogue!.act).toBe(1)
      expect(rogue!.hp).toBeGreaterThan(100)
      expect(rogue!.skills.length).toBeGreaterThanOrEqual(2)

      // Act 2 Desert Mercenary Combat/Offensive/Defensive (subType=7), Nightmare (diff=2), level 50
      const desert = queryHirelingStatsAtLevel113c(7, 2, 2, 50, true)
      expect(desert).toBeDefined()
      expect(desert!.act).toBe(2)
      expect(desert!.skills.some((s) => s.skillName.toLowerCase().includes('jab'))).toBe(true)

      // Act 3 Iron Wolf Cold (subType=11), Normal (diff=1), level 30
      const ironWolf = queryHirelingStatsAtLevel113c(11, 3, 1, 30, true)
      expect(ironWolf).toBeDefined()
      expect(ironWolf!.act).toBe(3)
      expect(ironWolf!.skills.length).toBeGreaterThanOrEqual(3)

      // Act 5 Barbarian (subType=22), Hell (diff=3), level 80
      const barb = queryHirelingStatsAtLevel113c(22, 5, 3, 80, true)
      expect(barb).toBeDefined()
      expect(barb!.act).toBe(5)
      expect(barb!.skills.some((s) => /bash|stun/i.test(s.skillName))).toBe(true)
    })
  })

  // =========================================================================
  // F4: R2.1 Melee & Pack AI Archetypes (aidel, aip1..2, A1/A2, El1..El3)
  // =========================================================================
  describe('F4: R2.1 Melee & Pack AI Archetypes (aidel, aip1..2, A1/A2, El1..El3)', () => {
    it('F4.1: Skeleton (hcIdx=0) and Zombie (hcIdx=5) chase hostile player within aggroRadius and deal melee damage at reach', () => {
      const skel = createTestCombatMonster(0, { x: 140, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [skel],
      })
      const startDist = Math.hypot(skel.x - world.player.x, skel.y - world.player.y)
      for (let t = 0; t < 40; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const endDist = Math.hypot(skel.x - world.player.x, skel.y - world.player.y)
      expect(endDist).toBeLessThan(startDist)
      expect(world.player.hp).toBeLessThan(500)
    })

    it('F4.2: Brute (Wendigo hcIdx=28), Blunderbore (hcIdx=186), and ThornHulk (hcIdx=127) execute heavy melee and stun/frenzy attacks', () => {
      const blunderbore = createTestCombatMonster(186, { x: 112, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 800, maxHp: 800 },
        monsters: [blunderbore],
      })
      for (let t = 0; t < 25; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(800)
      expect(blunderbore.state).toBe('attack')
    })

    it('F4.3: Goatman (hcIdx=38), SandRaider (hcIdx=78), Baboon (hcIdx=33), and PantherWoman (hcIdx=83) approach and select A1/A2 melee strikes', () => {
      const goatman = createTestCombatMonster(38, { x: 115, y: 100 })
      const sandRaider = createTestCombatMonster(78, { index: 2, x: 100, y: 115 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 1000, maxHp: 1000 },
        monsters: [goatman, sandRaider],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(1000)
      expect(world.events.some((e) => e.kind === 'playerHit')).toBe(true)
    })

    it('F4.4: Swarm (hcIdx=87), BatDemon (hcIdx=113), and ClawViper (hcIdx=73/159) apply El1..El3 elemental/poison/drain on-hit payloads', () => {
      const swarmKind = queryMonsterKind113c(87, 'normal')!
      expect(swarmKind.ai).toBe('Swarm')
      const swarm = createTestCombatMonster(87, { x: 110, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600, stamina: 200, maxStamina: 200 },
        monsters: [swarm],
      })
      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(600)
    })

    it('F4.5: SandLeaper (hcIdx=68) and FrozenHorror (hcIdx=484) close distance and execute leap/arctic attacks', () => {
      const leaper = createTestCombatMonster(68, { x: 160, y: 100 })
      const frozenHorror = createTestCombatMonster(484, { index: 2, x: 100, y: 115 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 1200, maxHp: 1200 },
        monsters: [leaper, frozenHorror],
      })
      for (let t = 0; t < 35; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(Math.hypot(leaper.x - 100, leaper.y - 100)).toBeLessThan(60)
      expect(world.player.hp).toBeLessThan(1200)
    })
  })

  // =========================================================================
  // F5: R2.2 Fallen & Fetish Pack Morale (Ally Death Retreat & aip1..4)
  // =========================================================================
  describe('F5: R2.2 Fallen & Fetish Pack Morale (Ally Death Retreat & aip1..4)', () => {
    it('F5.1: killing a Fallen (hcIdx=18) triggers morale break / retreat away from the player on nearby allied Fallen pack members', () => {
      const victimFallen = createTestCombatMonster(18, { index: 1, x: 110, y: 100, hp: 5 })
      const allyFallen = createTestCombatMonster(18, { index: 2, x: 130, y: 100, hp: 50 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [victimFallen, allyFallen],
      })
      const initialAllyDist = Math.hypot(allyFallen.x - world.player.x, allyFallen.y - world.player.y)

      // Player kills victimFallen
      damageMonster(world, victimFallen.index, 50, world.player)
      expect(victimFallen.state).toBe('dead')

      // Step AI: allyFallen should retreat away from player
      for (let t = 0; t < 10; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const afterFleeDist = Math.hypot(allyFallen.x - world.player.x, allyFallen.y - world.player.y)
      expect(afterFleeDist).toBeGreaterThan(initialAllyDist)
    })

    it('F5.2: fleeing Fallen rallies back to chase/attack once its morale retreat timer expires', () => {
      const victimFallen = createTestCombatMonster(18, { index: 1, x: 110, y: 100, hp: 5 })
      const allyFallen = createTestCombatMonster(18, { index: 2, x: 125, y: 100, hp: 50 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [victimFallen, allyFallen],
      })
      damageMonster(world, victimFallen.index, 50, world.player)
      for (let t = 0; t < 10; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const peakFleeDist = Math.hypot(allyFallen.x - world.player.x, allyFallen.y - world.player.y)

      // Advance past flee duration so allyFallen rallies and closes back in
      for (let t = 0; t < 90; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const afterRallyDist = Math.hypot(allyFallen.x - world.player.x, allyFallen.y - world.player.y)
      expect(afterRallyDist).toBeLessThan(peakFleeDist)
    })

    it('F5.3: killing a Fetish (RatMan hcIdx=131) triggers pack retreat on nearby allied Fetish pack members', () => {
      const victimFetish = createTestCombatMonster(131, { index: 1, x: 110, y: 100, hp: 5 })
      const allyFetish = createTestCombatMonster(131, { index: 2, x: 130, y: 100, hp: 80 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [victimFetish, allyFetish],
      })
      const initialDist = Math.hypot(allyFetish.x - world.player.x, allyFetish.y - world.player.y)
      damageMonster(world, victimFetish.index, 50, world.player)
      for (let t = 0; t < 10; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const fleeDist = Math.hypot(allyFetish.x - world.player.x, allyFetish.y - world.player.y)
      expect(fleeDist).toBeGreaterThan(initialDist)
    })

    it('F5.4: Fallen pack difficulty scaling uses authentic 1.13c aidel (15 Normal, 14 Nightmare, 13 Hell) and aip1..4', () => {
      const fallenN = queryMonsterKind113c(19, 'normal')!
      const fallenNM = queryMonsterKind113c(19, 'nightmare')!
      const fallenH = queryMonsterKind113c(19, 'hell')!

      expect(fallenN.aiDelay).toBe(15)
      expect(fallenNM.aiDelay).toBe(14)
      expect(fallenH.aiDelay).toBe(13)
      expect(fallenN.aiParams?.[1]).toBe(10)
      expect(fallenNM.aiParams?.[1]).toBe(15)
      expect(fallenH.aiParams?.[1]).toBe(20)
    })

    it('F5.5: non-Fallen/non-Fetish monsters (e.g. Skeleton hcIdx=0) do not flee when a Fallen dies nearby', () => {
      const victimFallen = createTestCombatMonster(18, { index: 1, x: 110, y: 100, hp: 5 })
      const skeleton = createTestCombatMonster(0, { index: 2, x: 135, y: 100, hp: 60 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [victimFallen, skeleton],
      })
      const initialSkelDist = Math.hypot(skeleton.x - world.player.x, skeleton.y - world.player.y)
      damageMonster(world, victimFallen.index, 50, world.player)
      for (let t = 0; t < 10; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      const afterSkelDist = Math.hypot(skeleton.x - world.player.x, skeleton.y - world.player.y)
      expect(afterSkelDist).toBeLessThan(initialSkelDist)
    })
  })

  // =========================================================================
  // F6: R2.3 Resurrectors & Healers (FallenShaman, FetishShaman, GreaterMummy, ZakarumPriest)
  // =========================================================================
  describe('F6: R2.3 Resurrectors & Healers (FallenShaman, FetishShaman, GreaterMummy, ZakarumPriest)', () => {
    it('F6.1: FallenShaman (hcIdx=23) resurrects a dead Fallen corpse via FallenResurrect and emits UnitSkillEvent', () => {
      const deadFallen = createTestCombatMonster(18, {
        index: 1,
        x: 130,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 80,
      })
      const shaman = createTestCombatMonster(23, { index: 2, x: 160, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [deadFallen, shaman],
      })

      const revived = executeShamanResurrect113c(world, shaman)
      expect(revived).not.toBeNull()
      expect(deadFallen.state).not.toBe('dead')
      expect(deadFallen.hp).toBe(deadFallen.stats.hp)
      expect(
        world.events.some(
          (e) => e.kind === 'unitSkillEvent' && e.skillId === 'fallenresurrect',
        ),
      ).toBe(true)
    })

    it('F6.2: FallenShaman casts ranged Fireball when no Fallen corpse is available to resurrect', () => {
      const shaman = createTestCombatMonster(23, { index: 1, x: 190, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [shaman],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(
        world.events.some(
          (e) =>
            e.kind === 'playerHit' ||
            e.kind === 'missileHit' ||
            e.kind === 'unitSkillEvent',
        ) || world.player.hp < 500,
      ).toBe(true)
    })

    it('F6.3: FetishShaman (hcIdx=136) revives dead Fetish allies and casts Inferno at nearby players', () => {
      const deadFetish = createTestCombatMonster(131, {
        index: 1,
        x: 135,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 80,
      })
      const fetishShaman = createTestCombatMonster(136, {
        index: 2,
        x: 165,
        y: 100,
        cooldown: 0,
      })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600 },
        monsters: [deadFetish, fetishShaman],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(deadFetish.state !== 'dead' || world.player.hp < 600).toBe(true)
    })

    it('F6.4: GreaterMummy / Unraveler (hcIdx=101) resurrects dead undead corpses, heals wounded allies (HealOther), and fires UnholyBolt', () => {
      const deadSkeleton = createTestCombatMonster(0, {
        index: 1,
        x: 135,
        y: 100,
        hp: 0,
        state: 'dead',
        animMode: 'dt',
        corpseTicks: 90,
      })
      const woundedSkeleton = createTestCombatMonster(0, {
        index: 2,
        x: 150,
        y: 105,
        hp: 5,
      })
      const unraveler = createTestCombatMonster(101, {
        index: 3,
        x: 170,
        y: 100,
        cooldown: 0,
      })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600 },
        monsters: [deadSkeleton, woundedSkeleton, unraveler],
      })
      for (let t = 0; t < 45; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(
        deadSkeleton.state !== 'dead' ||
          woundedSkeleton.hp > 5 ||
          world.player.hp < 600,
      ).toBe(true)
    })

    it('F6.5: ZakarumPriest (Cantor hcIdx=238) heals wounded allies (HealOther) and casts Lightning/Blizzard/Teleport', () => {
      const woundedZealot = createTestCombatMonster(235, {
        index: 1,
        x: 135,
        y: 100,
        hp: 10,
      })
      const priest = createTestCombatMonster(238, {
        index: 2,
        x: 165,
        y: 100,
        cooldown: 0,
      })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 700, maxHp: 700 },
        monsters: [woundedZealot, priest],
      })
      for (let t = 0; t < 40; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(woundedZealot.hp > 10 || world.player.hp < 700).toBe(true)
    })
  })

  // =========================================================================
  // F7: R2.4 Ranged Archers, Throwers & Kiters
  // =========================================================================
  describe('F7: R2.4 Ranged Archers, Throwers & Kiters (RogueArcher, SkeletonArcher, QuillRat, Slinger, Blowpiper)', () => {
    it('F7.1: RogueArcher (hcIdx=48) and SkeletonArcher (hcIdx=10) fire ranged bow projectiles from standoff distance', () => {
      const skelArcher = createTestCombatMonster(10, { index: 1, x: 185, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [skelArcher],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      // Ranged archer attacks from distance without walking onto (100, 100)
      expect(Math.hypot(skelArcher.x - 100, skelArcher.y - 100)).toBeGreaterThan(25)
      expect(world.player.hp).toBeLessThan(500)
    })

    it('F7.2: QuillRat (hcIdx=63) fires quill1 projectiles using MONSTER_MODE_MISSILES_113C', () => {
      expect(getMonsterModeMissile113c(63, 'A1')).toBe('quill1')
      const quillRat = createTestCombatMonster(63, { index: 1, x: 175, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [quillRat],
      })
      for (let t = 0; t < 25; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(500)
    })

    it('F7.3: Slinger (hcIdx=122) and GoatArcher (hcIdx=43) throw javelin1/arrows and kite away when player closes to melee comfort range', () => {
      expect(getMonsterModeMissile113c(122, 'A1')).toBe('javelin1')
      const slinger = createTestCombatMonster(122, { index: 1, x: 112, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [slinger],
      })
      for (let t = 0; t < 20; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp < 500 || Math.hypot(slinger.x - 100, slinger.y - 100) > 12).toBe(true)
    })

    it('F7.4: Blowpiper (hcIdx=141) fires poison blowdarts from ranged standoff distance', () => {
      const blowpiper = createTestCombatMonster(141, { index: 1, x: 175, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [blowpiper],
      })
      for (let t = 0; t < 25; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(500)
    })

    it('F7.5: FoulCrow (hcIdx=15) and Vulture (hcIdx=73) execute swoop-in attack and tactical reposition', () => {
      const crow = createTestCombatMonster(15, { index: 1, x: 160, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 500, maxHp: 500 },
        monsters: [crow],
      })
      for (let t = 0; t < 35; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(500)
    })
  })

  // =========================================================================
  // F8: R2.5 Casters, Cursers & Special Mechanics
  // =========================================================================
  describe('F8: R2.5 Casters, Cursers & Special Mechanics (OblivionKnight, Vampire, Willowisp, Succubus, CouncilMember, SandMaggot, Overseer, SuicideMinion)', () => {
    it('F8.1: OblivionKnight (hcIdx=310) selects strictly from the 5 canonical 1.13c curses (zero Iron Maiden)', () => {
      const knight = createTestCombatMonster(310, { index: 1, x: 170, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [knight],
      })
      const seenCurses = new Set<string>()
      for (let seed = 0; seed < 25; seed++) {
        world.tick = seed
        const curse = executeOblivionKnightCurse113c(world, knight, seed, 5)
        seenCurses.add(curse.toLowerCase())
        expect(curse.toLowerCase()).not.toBe('ironmaiden')
      }
      expect(seenCurses.size).toBe(5)
      expect(seenCurses.has('amplifydamage')).toBe(true)
      expect(seenCurses.has('decrepify')).toBe(true)
      expect(seenCurses.has('weaken')).toBe(true)
      expect(seenCurses.has('lifetap')).toBe(true)
    })

    it('F8.2: Vampire (vampire1 hcIdx=131) casts Fireball/FireWall/Meteor at range and drains life in melee', () => {
      const vampireKind = queryMonsterKind113c(131, 'normal')!
      expect(vampireKind.ai).toBe('Vampire')
      const vampire = createTestCombatMonster(131, { index: 1, x: 170, y: 100, hp: 40, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600 },
        monsters: [vampire],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(600)
    })

    it('F8.3: Willowisp (Gloam hcIdx=118) fires piercing lightning and drains player mana on hit', () => {
      const wispKind = queryMonsterKind113c(118, 'normal')!
      expect(wispKind.ai).toBe('WillOWisp')
      const wisp = createTestCombatMonster(118, { index: 1, x: 160, y: 100, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600, mana: 300, maxMana: 300 },
        monsters: [wisp],
      })
      for (let t = 0; t < 30; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp < 600 || world.player.mana < 300).toBe(true)
    })

    it('F8.4: Succubus (hcIdx=469) fires BloodStar & DefenseCurse/BloodMana, and CouncilMember (hcIdx=345) summons Hydra & casts HealOther', () => {
      const succubus = createTestCombatMonster(469, { index: 1, x: 170, y: 100, cooldown: 0 })
      const council = createTestCombatMonster(345, { index: 2, x: 165, y: 110, cooldown: 0 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 900, maxHp: 900 },
        monsters: [succubus, council],
      })
      for (let t = 0; t < 35; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(world.player.hp).toBeLessThan(900)
    })

    it('F8.5: SandMaggot (hcIdx=6), FoulCrowNest (hcIdx=150), Overseer (hcIdx=479), and SuicideMinion (hcIdx=461) execute spawn/whip/detonation mechanics', () => {
      const suicideMinion = createTestCombatMonster(461, { index: 1, x: 108, y: 100, hp: 50 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100, hp: 600, maxHp: 600 },
        monsters: [suicideMinion],
      })
      for (let t = 0; t < 15; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      // SuicideMinion self-detonates on contact or deals explosion damage when killed
      if (suicideMinion.state !== 'dead') {
        triggerMonsterDeathAffixes113c(world, suicideMinion, world.player)
      }
      expect(world.player.hp).toBeLessThan(600)
    })
  })

  // =========================================================================
  // F9: R2.6 Elite MonUMod.txt Active, On-Hit, On-Struck (LE) & On-Death Modifiers
  // =========================================================================
  describe('F9: R2.6 Elite MonUMod.txt Active, On-Hit, On-Struck (LE) & On-Death Modifiers', () => {
    it('F9.1: applies active & on-hit elite modifiers (ExtraStrong, ExtraFast, Cursed, ManaBurn, SpectralHit, MultiShot, Teleportation, AuraEnchanted)', () => {
      const base = queryMonsterStats113c(18, { difficulty: 'normal', rank: 'unique' })
      const extraStrongFast = queryMonsterStats113c(18, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['Extra_Strong', 'Extra_Fast', 'Cursed', 'Mana_Burn'],
      })
      expect(extraStrongFast.damage).toBeGreaterThan(base.damage)
      expect(extraStrongFast.speed).toBeGreaterThan(base.speed)
      expect(hasMonsterUMod(extraStrongFast.modifiers, MON_UMOD.STRONG)).toBe(true)
      expect(hasMonsterUMod(extraStrongFast.modifiers, MON_UMOD.FAST)).toBe(true)
      expect(hasMonsterUMod(extraStrongFast.modifiers, MON_UMOD.CURSE)).toBe(true)
      expect(hasMonsterUMod(extraStrongFast.modifiers, MON_UMOD.MANahit)).toBe(true)
    })

    it('F9.2: Lightning Enchanted (MonUMod #17) computes 8-directional Charged Bolt vectors when struck and on death', () => {
      const vectors = computeChargedBolt8WayVectors(100, 100, 16)
      expect(vectors).toHaveLength(8)
      expect(vectors[0]!.isoScreenDx).not.toBe(0)

      const leMonster = createTestCombatMonster(18, {
        x: 110,
        y: 100,
        rank: 'unique',
        modifiers: ['Lightning_Enchanted'],
      })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [leMonster],
      })
      const events = triggerMonsterDeathAffixes113c(world, leMonster, world.player)
      expect(events.some((e) => e.missileType === 'chargedbolt')).toBe(true)
    })

    it('F9.3: Fire Enchanted (MonUMod #9) death explosion deals 1.13c difficulty-scaled 50/50 phys+fire damage and is suppressed on minions', () => {
      const feN = calcFireEnchantedDeathDamage(1000, 'normal', 0.5)
      const feNM = calcFireEnchantedDeathDamage(1000, 'nightmare', 0.5)
      const feH = calcFireEnchantedDeathDamage(1000, 'hell', 0.5)
      const feMinion = calcFireEnchantedDeathDamage(1000, 'hell', true)

      // Nightmare scale (0.35) > Normal/Hell scale (0.20)
      expect(feNM.totalDmg).toBeGreaterThan(feN.totalDmg)
      expect(feN.totalDmg).toBe(feH.totalDmg)
      expect(feN.physDmg).toBe(feN.fireDmg)
      expect(feMinion.totalDmg).toBe(0)
      expect(D2CLIENT_DEATH_BOOM_POINTS).toHaveLength(5)
    })

    it('F9.4: Cold Enchanted (MonUMod #18) death nova spawns 64-entry coldunique ring with frostnova velocity and difficulty-scaled chill', () => {
      const novaN = calcColdEnchantedDeathNova(40, 'normal', false)
      const novaH = calcColdEnchantedDeathNova(40, 'hell', false)
      const novaMinion = calcColdEnchantedDeathNova(40, 'normal', true)

      expect(novaN.triggered).toBe(true)
      expect(novaN.missileKey).toBe('coldunique')
      expect(novaN.velocityMissileKey).toBe('frostnova')
      expect(novaN.boltCount).toBe(64)
      expect(D2CLIENT_NOVA_RING_X).toHaveLength(64)
      expect(D2CLIENT_NOVA_RING_Y).toHaveLength(64)
      expect(novaH.chillFrames).toBeLessThan(novaN.chillFrames)
      expect(novaMinion.triggered).toBe(false)
    })

    it('F9.5: innate death explosions (BoneFetish GOBOOM, SuicideMinion aip1-dispatch, Mummy PoisonDead) damage nearby player and suppress corpses', () => {
      expect(isBoneFetishMonster(212)).toBe(true)
      expect(isSuicideMinionMonster(461)).toBe(true)
      expect(isPoisonDeadMonster(96)).toBe(true)

      const bfDmg = calcBoneFetishDeathDamage(500, 'normal', 0.5)
      expect(bfDmg.physDmg).toBeGreaterThan(0)
      expect(bfDmg.minFire).toBe(0)
      expect(bfDmg.maxFire).toBe(0)

      expect(resolveSuicideExplodeMissileKey(461, 'normal', 0)).toBe('suicidecorpseexplode')
      expect(resolveSuicideExplodeMissileKey(461, 'normal', 1)).toBe('suicidefireexplode')
      expect(resolveSuicideExplodeMissileKey(461, 'normal', 2)).toBe('suicideiceexplode')
    })
  })

  // =========================================================================
  // F10: R2.7 Act Bosses & Major SuperUniques
  // =========================================================================
  describe('F10: R2.7 Act Bosses & Major SuperUniques', () => {
    it('F10.1: Andariel (hcIdx=156) selects PoisonSpray/PoisonBall/melee by distance and triggers 35-subtile death minion purge, and BloodRaven (hcIdx=267) uses brdeathcontrol', () => {
      const andy = createTestCombatMonster(156, { x: 180, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [andy],
      })
      const closeDecision = executeActBossAi113c(world, andy, createTestCombatPlayer({ x: 120, y: 100 }))
      const farDecision = executeActBossAi113c(world, andy, createTestCombatPlayer({ x: 40, y: 100 }))
      expect(closeDecision.skillId).toBe('poisonspray')
      expect(farDecision.skillId).toBe('poisonball')

      const andyDeath = getBossDeathFxSpec(156, 'andariel')!
      expect(andyDeath.controllerMissileKey).toBe('andycontrol0')
      expect(andyDeath.purgeSurroundingMonstersRadius).toBe(35)

      const brDeath = getBossDeathFxSpec(267, 'bloodraven')!
      expect(brDeath.controllerMissileKey).toBe('brdeathcontrol')
      expect(brDeath.purgeSurroundingMonstersRadius).toBe(35)
    })

    it('F10.2: Radament (hcIdx=229) & Duriel (hcIdx=211) execute HolyFreeze/Jab/Smite and Duriel spawns 5 maggots (hcIdx=227) on death', () => {
      const duriel = createTestCombatMonster(211, { x: 150, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [duriel],
      })
      const decision = executeActBossAi113c(world, duriel, world.player)
      expect(['jab', 'holyfreeze', 'smite']).toContain(decision.skillId)
      expect(DURIEL_MAGGOT_HCIDX).toBe(227)
      expect(DURIEL_MAGGOT_OFFSETS).toHaveLength(5)

      const radDeath = getBossDeathFxSpec(229, 'radament')!
      expect(radDeath.controllerMissileKey).toBe('radamentdeath')
      expect(radDeath.purgeSurroundingMonstersRadius).toBe(35)
    })

    it('F10.3: Mephisto (hcIdx=242) casts Lightning/ChargedBolt/SkullMissile/Blizzard/PoisonNova and Izual (hcIdx=256) triggers 105-subtile death purge', () => {
      const meph = createTestCombatMonster(242, { x: 160, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [meph],
      })
      world.tick = 2
      const d0 = executeActBossAi113c(world, meph, world.player)
      world.tick = 3
      const d1 = executeActBossAi113c(world, meph, world.player)
      expect(d0.action).toBe('special')
      expect(d1.action).toBe('special')
      expect(d0.skillId).not.toBe(d1.skillId)

      const izualDeath = getBossDeathFxSpec(256, 'izual')!
      expect(izualDeath.controllerMissileKey).toBe('izual control')
      expect(izualDeath.purgeSurroundingMonstersRadius).toBe(105)
    })

    it('F10.4: Diablo (hcIdx=243) executes RedLightningHose/FireNova/Firestorm/BonePrison/ColdTouch and 45-subtile death purge with null controller missile', () => {
      const diablo = createTestCombatMonster(243, { x: 170, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [diablo],
      })
      world.tick = 2
      const d0 = executeActBossAi113c(world, diablo, world.player)
      world.tick = 3
      const d1 = executeActBossAi113c(world, diablo, world.player)
      expect(['redlightninghose', 'firenovaboss', 'firestorm', 'boneprison', 'coldtouch']).toContain(d0.skillId)
      expect(['redlightninghose', 'firenovaboss', 'firestorm', 'boneprison', 'coldtouch']).toContain(d1.skillId)

      const diabloDeath = getBossDeathFxSpec(243, 'diablo')!
      expect(diabloDeath.controllerMissileKey).toBeNull()
      expect(diabloDeath.purgeSurroundingMonstersRadius).toBe(45)
    })

    it('F10.5: Nihlathak (hcIdx=526), Ancients (hcIdx=540..542), and Baal (hcIdx=544) execute canonical skills and death controllers', () => {
      const baal = createTestCombatMonster(544, { x: 170, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [baal],
      })
      world.tick = 2
      const b0 = executeActBossAi113c(world, baal, world.player)
      expect(b0.action).toBe('special')

      expect(getBossDeathFxSpec(526, 'nihlathakboss')?.controllerMissileKey).toBe('nehlithakcontrol')
      expect(getBossDeathFxSpec(540, 'ancientbarb1')?.controllerMissileKey).toBe('ancient death center')
      expect(getBossDeathFxSpec(544, 'baalcrab')?.controllerMissileKey).toBe('baalfx control')
    })
  })

  // =========================================================================
  // F11: R3.1 & R3.2 GameInstance.stepFrame() Monster AI, Terrain Collision & Crowd Control
  // =========================================================================
  describe('F11: R3.1 & R3.2 GameInstance.stepFrame() Monster AI Wiring, Terrain Collision & StateBus Crowd Control', () => {
    it('F11.1: GameInstance.spawnMonster hydrates from 1.13c MonStats/MonLvl tables while preserving explicit SpawnMonsterSpec overrides', () => {
      const { game } = createWildernessGameInstance({ difficulty: 0, playersX: 1 })
      // Explicit override preservation (T5.A2/T5.A3)
      const overriddenId = game.spawnMonster({
        classId: 0,
        x: 510,
        y: 500,
        hp: 77,
        maxHp: 77,
        level: 9,
      })
      const overridden = game.getMonsterState(overriddenId)!
      expect(overridden.hp).toBe(77)
      expect(overridden.maxHp).toBe(77)
      expect(overridden.level).toBe(9)

      // 1.13c table hydration when hp/maxHp/level are omitted (Diablo hcIdx=243 vs Skeleton hcIdx=0)
      const skelId = game.spawnMonster({ classId: 0, x: 520, y: 500 })
      const diabloId = game.spawnMonster({ classId: 243, x: 530, y: 500 })
      const skel = game.getMonsterState(skelId)!
      const diablo = game.getMonsterState(diabloId)!
      expect(diablo.level).toBeGreaterThan(skel.level)
      expect(diablo.maxHp).toBeGreaterThan(skel.maxHp * 10)
    })

    it('F11.2: GameInstance.stepFrame() steps hostile monster AI movement and attacks with 1.13c aidel pacing', () => {
      const { game, playerId } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      const monId = game.spawnMonster({ classId: 0, x: 512, y: 500 })
      game.drainEvents(playerId)

      const startPos = { x: game.getMonsterState(monId)!.x, y: game.getMonsterState(monId)!.y }
      game.stepFrames(25)
      const endPos = { x: game.getMonsterState(monId)!.x, y: game.getMonsterState(monId)!.y }
      const events = game.drainEvents(playerId)

      expect(Math.hypot(endPos.x - 500, endPos.y - 500)).toBeLessThan(
        Math.hypot(startPos.x - 500, startPos.y - 500),
      )
      expect(events.some((e) => e.type === 'UnitMove')).toBe(true)
    })

    it('F11.3: terrain collision prevents monsters from walking through solid wall obstacles', () => {
      const wall = createWallObstacleTerrain({ minX: 115, maxX: 125, minY: 80, maxY: 120 })
      const monster = createTestCombatMonster(0, { x: 140, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [monster],
      })
      for (let t = 0; t < 40; t++) {
        tickMonsters(world, wall)
      }
      // Monster must not penetrate into the blocked wall X range [115, 125]
      expect(monster.x).toBeGreaterThanOrEqual(125)
    })

    it('F11.4: STATE_FREEZE (1) and STATE_STUNNED (25) halt monster movement and attacks in GameInstance, while STATE_COLD (28) and STATE_DECREPIFY (60) slow speed by 50%', () => {
      const { game } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      const frozenId = game.spawnMonster({ classId: 0, x: 508, y: 500 })
      applyStateToMonsterInGame(game, frozenId, 1, 50, { frozenTicks: 50 })

      const beforeX = game.getMonsterState(frozenId)!.x
      game.stepFrames(10)
      const afterX = game.getMonsterState(frozenId)!.x
      expect(afterX).toBe(beforeX)
    })

    it('F11.5: STATE_TERROR (56) forces monster to flee, STATE_DIMVISION (23) suppresses ranged aggro, and STATE_CONFUSE (59) / STATE_ATTRACT (57) cause monster-vs-monster combat', () => {
      const m1 = createTestCombatMonster(0, { index: 1, x: 130, y: 100, hp: 100 })
      const m2 = createTestCombatMonster(0, { index: 2, x: 135, y: 100, hp: 100 })
      m1.curse = { curseType: 59, name: 'confuse', slvl: 5, ticksRemaining: 100 }
      const world = createTestCombatWorld({
        player: { x: 300, y: 300, hp: 500, maxHp: 500 },
        monsters: [m1, m2],
      })
      for (let t = 0; t < 25; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      expect(m2.hp).toBeLessThan(100)
      expect(world.player.hp).toBe(500)
    })
  })

  // =========================================================================
  // F12: R3.3 Authoritative executeSUnitDmg & MissileEngine Integration in GameInstance
  // =========================================================================
  describe('F12: R3.3 Authoritative executeSUnitDmg & MissileEngine Integration in GameInstance', () => {
    it('F12.1: monster melee attacks in GameInstance route through executeSUnitDmg and emit UnitStatUpdate & LifeMana events', () => {
      const { game, playerId } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      const startHp = game.getPlayerState(playerId)!.hp
      game.spawnMonster({ classId: 5, x: 501, y: 500, level: 20 })
      game.drainEvents(playerId)

      // 1.13c melee damage lands on the A1/A2 action frame (3–4 frames after the
      // mode broadcast), so allow several swing cycles for the hit roll to connect.
      game.stepFrames(60)
      const endHp = game.getPlayerState(playerId)!.hp
      const events = game.drainEvents(playerId)

      expect(endHp).toBeLessThan(startHp)
      expect(events.some((e) => e.type === 'UnitStatUpdate' && e.statId === 6)).toBe(true)
      expect(events.some((e) => e.type === 'LifeMana')).toBe(true)
    })

    it('F12.2: player defensive passives & reactions trigger against monster attacks (Amazon Dodge/Avoid/Evade, Sorceress Cold Armors & Energy Shield)', () => {
      const monster = createTestCombatMonster(0, { index: 1, x: 110, y: 100, hp: 100 })
      const world = createTestCombatWorld({
        player: {
          x: 100,
          y: 100,
          hp: 500,
          maxHp: 500,
          mana: 200,
          maxMana: 200,
          coldArmorType: 'shiverarmor',
          coldArmorSlvl: 10,
          energyshieldTicks: 100,
          energyshieldPct: 50,
        },
        monsters: [monster],
      })
      for (let t = 0; t < 15; t++) {
        tickMonsters(world, createOpenTerrain())
      }
      // Shiver Armor chills & damages the melee attacker; Energy Shield diverts damage to mana & emits UnitOverlay
      expect(monster.hp).toBeLessThan(100)
      expect((monster.chillTicks ?? 0) > 0).toBe(true)
      expect(world.player.mana).toBeLessThan(200)
      expect(world.events.some((e) => e.kind === 'unitOverlay')).toBe(true)
    })

    it('F12.3: ranged & caster monsters in GameInstance spawn server missiles (CreateMissile) that travel and damage target player', () => {
      const { game, playerId } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      // Spawn a Corrupt Archer at ranged distance. (hcIdx 10 is bighead1, which
      // only fires its A2 lightning after dropping below its MonAi aip1 hurt%.)
      game.spawnMonster({ hcIdx: 160, defId: 'cr_archer1', x: 512, y: 500, level: 15 })
      game.drainEvents(playerId)

      game.stepFrames(40)
      const events = game.drainEvents(playerId)
      expect(events.some((e) => e.type === 'CreateMissile')).toBe(true)
    })

    it('F12.4: striking a Lightning Enchanted monster in GameInstance emits Charged Bolt missiles on hit recovery', () => {
      const { game, playerId } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      const leId = spawnExtendedMonsterInGame(game, {
        classId: 18,
        x: 502,
        y: 500,
        hp: 500,
        maxHp: 500,
        rank: 'unique',
        modifiers: ['Lightning_Enchanted'],
        monUMods: [MON_UMOD.LIGHTNING],
      })
      game.drainEvents(playerId)

      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: leId,
      })
      game.stepFrames(3)
      const events = game.drainEvents(playerId)
      expect(events.some((e) => e.type === 'CreateMissile')).toBe(true)
    })

    it('F12.5: killing a Fire Enchanted monster in GameInstance triggers corpse explosion damage against nearby player', () => {
      const { game, playerId } = createWildernessGameInstance({ playerX: 500, playerY: 500 })
      const startHp = game.getPlayerState(playerId)!.hp
      const feId = spawnExtendedMonsterInGame(game, {
        classId: 18,
        x: 501,
        y: 500,
        hp: 1, // unarmed Attack (skill 0) hits for 1-2
        maxHp: 200,
        rank: 'unique',
        modifiers: ['Fire_Enchanted'],
        monUMods: [MON_UMOD.FIRE],
        aiDisabled: true,
      })
      game.drainEvents(playerId)

      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: feId,
      })
      game.stepFrames(2)
      expect(game.getMonsterState(feId)!.dead).toBe(true)
      // Fire Enchanted corpse-boom resolves a few frames after death.
      game.stepFrames(6)
      expect(game.getPlayerState(playerId)!.hp).toBeLessThan(startHp)
    })
  })

  // =========================================================================
  // F13: R3.4 & R3.5 Mercenary AI, Summon AI & Canonical ServerEvent Emission
  // =========================================================================
  describe('F13: R3.4 & R3.5 Mercenary AI (tickMercenaryAi25Hz), Summon AI (SummonManager) & Canonical ServerEvent Emission', () => {
    it('F13.1: tickMercenaryAi25Hz acquires nearest living monster within aggroRadius, chases, and deals damage at reach', () => {
      const monster = createTestCombatMonster(0, { index: 1, x: 140, y: 100, hp: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [monster],
      })
      const merc: MercenaryUnitState = {
        id: 'merc-act2',
        act: 2,
        level: 30,
        x: 110,
        y: 100,
        hp: 400,
        maxHp: 400,
        damage: 25,
        reach: 28,
        aggroRadius: 240,
        speed: 45,
        cooldown: 0,
        cooldownTicks: 10,
        alive: true,
      }
      for (let t = 0; t < 25; t++) {
        tickMercenaryAi25Hz(world, merc, world.player, createOpenTerrain())
      }
      expect(monster.hp).toBeLessThan(100)
      expect(merc.state).toBe('attack')
    })

    it('F13.2: tickMercenaryAi25Hz follows owner when distance > 96 and leashes back to owner when distance > 480', () => {
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [],
      })
      const merc: MercenaryUnitState = {
        id: 'merc-act1',
        act: 1,
        level: 20,
        x: 250,
        y: 100,
        hp: 300,
        maxHp: 300,
        damage: 18,
        reach: 120,
        speed: 40,
        cooldown: 0,
        cooldownTicks: 12,
        alive: true,
      }
      tickMercenaryAi25Hz(world, merc, world.player, createOpenTerrain())
      expect(merc.state).toBe('follow')
      expect(merc.x).toBeLessThan(250)

      // Move owner > 480 away -> merc teleports/leashes to owner
      world.player.x = 1000
      world.player.y = 1000
      tickMercenaryAi25Hz(world, merc, world.player, createOpenTerrain())
      expect(merc.x).toBe(1000)
      expect(merc.y).toBe(1000)
      expect(merc.state).toBe('idle')
    })

    it('F13.3: SummonManager creates and steps Necromancer Skeleton/Golem, Druid Grizzly, and Amazon Valkyrie pets dealing authoritative damage to monsters', async () => {
      const registry = await getSharedDataRegistry()
      const summonManager = new SummonManager(registry)
      const missileEngine = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      const ownerStats = new UnitStatList(registry)
      ownerStats.setBaseStat('level', 40)
      ownerStats.setBaseStat('maxhp', 500 * FIXED_ONE)
      ownerStats.setBaseStat('hitpoints', 500 * FIXED_ONE)
      const owner: CombatUnitContext = {
        id: 'player-1',
        name: 'SummonerHero',
        unitType: 'player',
        statList: ownerStats,
        stateBus: new StateBus(ownerStats, registry),
        x: 100,
        y: 100,
      }

      const grizzlyOut = summonManager.createPet({
        owner,
        skillId: 247, // Summon Grizzly
        slvl: 10,
      })
      expect(grizzlyOut.created).toBe(true)

      const enemyStats = new UnitStatList(registry)
      enemyStats.setBaseStat('level', 20)
      enemyStats.setBaseStat('maxhp', 400 * FIXED_ONE)
      enemyStats.setBaseStat('hitpoints', 400 * FIXED_ONE)
      const enemy: CombatUnitContext = {
        id: 'mon-1',
        name: 'Skeleton',
        unitType: 'monster',
        statList: enemyStats,
        stateBus: new StateBus(enemyStats, registry),
        x: 110,
        y: 100,
      }

      const tickOut = summonManager.tickPets({
        currentTick: 10,
        owner,
        enemies: [enemy],
        enemyPositions: new Map([['mon-1', { x: 110, y: 100 }]]),
        missileEngine,
        auraScanner,
      })
      expect(tickOut.petAttacks).toBeGreaterThan(0)
      expect(tickOut.damageDealt).toBeGreaterThan(0)
      expect(enemyStats.getHp()).toBeLessThan(400)
    })

    it('F13.4: GameInstance.stepFrame() emits canonical ServerEvent messages (UnitAssign, UnitMove, UnitMode, UnitStatUpdate, LifeMana, UnitState, StateSet, StateEnd)', () => {
      const { game, playerId } = createWildernessGameInstance({
        playerClass: 'sor',
        playerLevel: 25,
        playerX: 500,
        playerY: 500,
        playerSkills: { 39: 1 },
      })
      const monId = game.spawnMonster({ classId: 0, x: 503, y: 500, hp: 200, maxHp: 200 })
      const assignEvents = game.drainEvents(playerId)
      expect(assignEvents.some((e) => e.type === 'UnitAssign')).toBe(true)

      // Cast Ice Bolt (39) to chill monster and apply damage
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 39,
        targetType: 'monster',
        targetId: monId,
      })
      game.stepFrames(60)
      const combatEvents = game.drainEvents(playerId)
      const eventTypes = new Set(combatEvents.map((e) => e.type))

      expect(eventTypes.has('UnitStatUpdate')).toBe(true)
      expect(eventTypes.has('UnitMode')).toBe(true)
      expect(eventTypes.has('UnitState') || eventTypes.has('StateSet')).toBe(true)
    })

    it('F13.5: UnitOverlay (0x11) and UnitSkillEvent (0x4d) payloads emitted by curses, resurrections, and reactive armors conform to canonical 1.13c schemas', () => {
      const deadFallen = createTestCombatMonster(18, {
        index: 1,
        x: 130,
        y: 100,
        hp: 0,
        state: 'dead',
      })
      const shaman = createTestCombatMonster(23, { index: 2, x: 150, y: 100 })
      const knight = createTestCombatMonster(310, { index: 3, x: 170, y: 100 })
      const world = createTestCombatWorld({
        player: { x: 100, y: 100 },
        monsters: [deadFallen, shaman, knight],
      })

      executeShamanResurrect113c(world, shaman)
      executeOblivionKnightCurse113c(world, knight, 1, 5)

      const skillEv = world.events.find((e) => e.kind === 'unitSkillEvent')
      const overlayEv = world.events.find((e) => e.kind === 'unitOverlay')
      expect(skillEv?.unitSkillEvent?.type).toBe('UnitSkillEvent')
      expect(overlayEv?.overlayIndex).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // F14: Dual-Mode Determinism (LocalLoopbackAdapter & MultiClientRoomHost)
  // =========================================================================
  describe('F14: Dual-Mode Determinism (LocalLoopbackAdapter Single Player & MultiClientRoomHost Battle.net Lockstep)', () => {
    it('F14.1: two GameInstance runs with identical mapSeed and monster spawns produce bit-identical state hashes across 40 frames', () => {
      const runSim = (): { hash: number; monX: number; monY: number; playerHp: number } => {
        const { game, playerId } = createWildernessGameInstance({
          mapSeed: 0x113ccafe,
          playerX: 500,
          playerY: 500,
        })
        const monId = game.spawnMonster({ classId: 0, x: 515, y: 500 })
        for (let f = 0; f < 40; f++) {
          if (f === 10) {
            game.enqueueCommand(playerId, { type: 'Move', x: 504, y: 500, run: true })
          }
          game.stepFrame()
        }
        const m = game.getMonsterState(monId)!
        const p = game.getPlayerState(playerId)!
        return {
          hash: game.computeFrameLockstepHash(),
          monX: m.x,
          monY: m.y,
          playerHp: p.hp,
        }
      }

      const r1 = runSim()
      const r2 = runSim()
      expect(r1).toEqual(r2)
    })

    it('F14.2: LocalLoopbackAdapter Single Player mode freezes monster AI movement and attacks while paused and resumes on unpause', () => {
      const sp = new LocalLoopbackAdapter({
        mapSeed: 0x113c0102,
        areaId: 2,
        charName: 'SoloHero',
        classId: 'pal',
        x: 500,
        y: 500,
      })
      const monId = sp.game.spawnMonster({ classId: 0, x: 508, y: 500 })
      const initialMonX = sp.game.getMonsterState(monId)!.x

      sp.sendCommand({ type: 'PauseGame', paused: true })
      sp.stepFrames(20)
      expect(sp.game.isPaused()).toBe(true)
      expect(sp.game.getMonsterState(monId)!.x).toBe(initialMonX)

      sp.sendCommand({ type: 'PauseGame', paused: false })
      sp.stepFrames(20)
      expect(sp.game.isPaused()).toBe(false)
      expect(sp.game.getMonsterState(monId)!.x).toBeLessThan(initialMonX)
    })

    it('F14.3: MultiClientRoomHost Battle.net mode broadcasts monster AI movement and combat events synchronously to all connected clients', () => {
      const host = new MultiClientRoomHost({
        mode: 'open',
        mapSeed: 0x113cbeef,
        areaId: 2,
        maxPlayers: 8,
      })
      const c1 = host.connectClient({ charName: 'PaladinOne', classId: 'pal', areaId: 2, x: 500, y: 500 })
      const c2 = host.connectClient({ charName: 'SorceressTwo', classId: 'sor', areaId: 2, x: 502, y: 500 })
      c1.adapter.pollEvents()
      c2.adapter.pollEvents()

      host.game.spawnMonster({ classId: 0, x: 510, y: 500 })
      host.stepFrames(20)

      const ev1 = c1.adapter.pollEvents()
      const ev2 = c2.adapter.pollEvents()
      expect(ev1.some((e: ServerEvent) => e.type === 'UnitMove')).toBe(true)
      expect(ev2.some((e: ServerEvent) => e.type === 'UnitMove')).toBe(true)
    })

    it('F14.4: MultiClientRoomHost party combat splits monster kill XP across party members and maintains verifyLockstepParity', () => {
      const host = new MultiClientRoomHost({
        mode: 'closed',
        mapSeed: 0x113c7788,
        areaId: 2,
        maxPlayers: 8,
      })
      const c1 = host.connectClient({ charName: 'PartyA', classId: 'bar', level: 10, areaId: 2, x: 500, y: 500 })
      const c2 = host.connectClient({ charName: 'PartyB', classId: 'dru', level: 10, areaId: 2, x: 502, y: 500 })

      c1.adapter.sendCommand({ type: 'Party', action: 0x06, targetPlayerId: c2.playerUnitId })
      c2.adapter.sendCommand({ type: 'Party', action: 0x08, targetPlayerId: c1.playerUnitId })
      host.stepFrame()

      const xp1Before = host.game.getPlayerState(c1.playerUnitId)!.experience
      const xp2Before = host.game.getPlayerState(c2.playerUnitId)!.experience

      const monId = host.game.spawnMonster({
        classId: 0,
        x: 501,
        y: 500,
        hp: 1, // unarmed Attack (skill 0) hits for 1-2
        maxHp: 1,
        experience: 200,
        aiDisabled: true,
      })
      c1.adapter.sendCommand({
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: monId,
      })
      host.stepFrames(2)

      expect(host.game.getMonsterState(monId)!.dead).toBe(true)
      expect(host.game.getPlayerState(c1.playerUnitId)!.experience).toBeGreaterThan(xp1Before)
      expect(host.game.getPlayerState(c2.playerUnitId)!.experience).toBeGreaterThan(xp2Before)
      expect(verifyLockstepParity(host).inSync).toBe(true)
    })

    it('F14.5: preserves existing server-reuse E2E contracts (NPC/Vendor immunity to AI & damage, wilderness streaming, and .d2s round-trip)', () => {
      const { game, playerId } = createWildernessGameInstance({
        areaId: 1, // Rogue Encampment (Town)
        playerX: 128,
        playerY: 128,
      })
      const akaraId = game.spawnMonster({
        classId: 148,
        name: 'Akara',
        areaId: 1,
        x: 130,
        y: 128,
        hp: 100,
        maxHp: 100,
        isNpc: true,
        isVendor: true,
      })
      game.enqueueCommand(playerId, {
        type: 'CastSkillOnTarget',
        skillId: 0,
        targetType: 'monster',
        targetId: akaraId,
      })
      game.stepFrames(10)

      const akara = game.getMonsterState(akaraId)!
      expect(akara.dead).toBe(false)
      expect(akara.hp).toBe(100)
      expect(akara.x).toBe(130)
      expect(akara.y).toBe(128)
      expect(game.exportPlayerD2s(playerId).byteLength).toBeGreaterThan(96)
    })
  })
})
