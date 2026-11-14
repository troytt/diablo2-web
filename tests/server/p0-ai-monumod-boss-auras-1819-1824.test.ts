/**
 * Wave 1 Monster AI, MonUMod & Boss Auras P0 Regression Suite (#1819..#1824)
 *
 * Verifies 1.13c D2Game.dll & MPQ ground truth + class-of-bug sweeps for:
 * - #1819: MonUMod #30 (Aura Enchanted) 1.13c aura pool, mlvl gates, and slvl = max(1, floor(mlvl / divisor))
 * - #1820: Innate Boss & Monster Auras (Duriel #211, Uber Duriel #708, Uber Mephisto #704 + 734-row MonStats sweep)
 * - #1821: MonUMod #9 (Fire Enchanted) death explosion unmultiplied base HP, [3/4, 1/3, 1/8], 60..100%, shield block & DR/Amp
 * - #1822: CURSE_AI exact OblivionKnight scoping, cooldown gating, no Iron Maiden (#76), and Succubus #309/#310 curses
 * - #1823: MonPlace #5 Blood Raven (hcIdx 267, no Coldcrow superUniqueIndex=2), full MonPlace sweep, brdeathcontrol & zombie purge
 * - #1824: Act 5 SuicideMinion (#461..468) sprint charge, contact detonation, corpse shatter, and Overseer Whip (#295) conversion
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  AURA_ENCHANTED_TABLE_113C,
  MONAI_PROFILES_113C,
  monaiProfile113c,
  resolveInnateMonsterAura113c,
  resolveMonPlacePreset113c,
  rollAuraEnchanted113c,
} from '../../src/common/units/monai-113c.ts'
import {
  FIRE_ENCHANT_DIFF_SCALE,
  FIRE_ENCHANT_EXPLOSION_RADIUS,
  FIRE_ENCHANT_MAX_HP_PCT,
  FIRE_ENCHANT_MIN_HP_PCT,
  calcFireEnchantedDeathDamage,
  calcSuicideMinionExplosionDamage,
  getBossDeathFxSpec,
} from '../../src/common/units/monster-death-fx.ts'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import { getCanonicalMonsterKinds } from '../../src/common/units/monsters-data.ts'
import { questWordIndex113c } from '../../src/server/engine/quests-113c.ts'

describe('Wave 1 Monster AI, MonUMod & Boss Auras (#1819..#1824)', () => {
  describe('Issue #1819: MonUMod #30 (Aura Enchanted) 1.13c pool, mlvl gates, and slvl divisors', () => {
    it('excludes Holy Shock (<20), Fanaticism/Conviction (<30), and Thorns (999) while including Blessed Aim (#108)', () => {
      const seenLowMlvl = new Set<number>()
      for (let seed = 0; seed < 32; seed++) {
        const rolled = rollAuraEnchanted113c(12, seed)
        seenLowMlvl.add(rolled.auraSkillId)
        expect([98, 102, 108, 114]).toContain(rolled.auraSkillId)
        expect([103, 118, 122, 123]).not.toContain(rolled.auraSkillId)
      }
      expect(seenLowMlvl).toEqual(new Set([98, 102, 108, 114]))

      // mlvl = 24 unlocks Holy Shock (#118) at floor(24/8) = 3, still blocks Fanaticism/Conviction (<30)
      const seenMidMlvl = new Set<number>()
      for (let seed = 0; seed < 32; seed++) {
        const rolled = rollAuraEnchanted113c(24, seed)
        seenMidMlvl.add(rolled.auraSkillId)
        expect(rolled.auraSkillId).not.toBe(103)
        expect([122, 123]).not.toContain(rolled.auraSkillId)
      }
      expect(seenMidMlvl.has(118)).toBe(true)

      // Hell mlvl = 85: exact 1.13c divisors (5, 6, 7, 8) and Lord De Seis forced Fanaticism (#122)
      expect(AURA_ENCHANTED_TABLE_113C.find((e) => e.skillId === 103)?.minMlvl).toBe(999)
      const bySkill = new Map<number, number>()
      for (let seed = 0; seed < 64; seed++) {
        const rolled = rollAuraEnchanted113c(85, seed)
        bySkill.set(rolled.auraSkillId, rolled.auraLevel)
      }
      expect(bySkill.get(108)).toBe(17) // floor(85 / 5)
      expect(bySkill.get(98)).toBe(14) // floor(85 / 6)
      expect(bySkill.get(102)).toBe(14) // floor(85 / 6)
      expect(bySkill.get(114)).toBe(12) // floor(85 / 7)
      expect(bySkill.get(118)).toBe(10) // floor(85 / 8)
      expect(bySkill.get(122)).toBe(10) // floor(85 / 8)
      expect(bySkill.get(123)).toBe(10) // floor(85 / 8)
      expect(rollAuraEnchanted113c(85, 0, 'Lord De Seis')).toEqual({
        auraSkillId: 122,
        auraLevel: 10,
      })
    })

    it('evaluates runtime monster Conviction & Holy Shock at floor(mlvl / 8) = 10 instead of raw mlvl = 85', () => {
      const game = new GameInstance({ seed: 1819, areaId: 85, difficulty: 2 })
      const playerId = game.connectPlayer({
        charClass: 'pal',
        name: 'Hero',
        x: 30,
        y: 31,
        areaId: 85,
        hp: 3000,
        maxHp: 3000,
      })
      // (hcIdx 19 + areaId 85 + statSeed 1) = 105; 105 % 7 = 0 -> Might; 105 + 6 = 111; 111 % 7 = 6 -> Conviction (#123)
      const convElite = game.spawnMonster({
        defId: 'fallen1',
        x: 30,
        y: 30,
        areaId: 85,
        level: 85,
        rank: 'unique',
        umodIds: [30],
        statSeed: 7,
        maxHp: 5000,
        hp: 5000,
      })
      const internal = game as unknown as {
        monsters: Map<number, { auraSkillId?: number; auraLevel?: number }>
        playerCombat: Map<
          number,
          { stateBus: { getState: (id: string | number) => { slvl: number; stats: Record<string, number> } | undefined } }
        >
      }
      expect(internal.monsters.get(convElite)!.auraSkillId).toBe(123)
      expect(internal.monsters.get(convElite)!.auraLevel).toBe(10)

      game.stepFrames(25)
      const convEntry = internal.playerCombat.get(playerId)!.stateBus.getState('conviction')
      expect(convEntry).toBeDefined()
      expect(convEntry!.slvl).toBe(10)
      // Conviction slvl 10 reduces resists by 75% (never capped -150% from raw mlvl=85)
      expect(convEntry!.stats.fireresist).toBe(-75)
    })
  })

  describe('Issue #1820: Innate Boss & Monster Auras (Duriel #211, Uber Duriel #708, Uber Mephisto #704 + 734-row sweep)', () => {
    it('sweeps all 734 MonStats.txt rows and wires Duriel (#211), Uber Duriel (#708), and Uber Mephisto (#704)', () => {
      const kinds = getCanonicalMonsterKinds('normal')
      const innateAuraMonsters: { hcIdx: number; id: string; auraSkillId: number; auraLevel: number }[] = []
      for (const row of MONSTATS_113C_ROWS) {
        const kind = kinds.get(row.id)
        const resolved = resolveInnateMonsterAura113c(row.hcIdx, 'normal', kind?.skills)
        if (resolved !== undefined) {
          innateAuraMonsters.push({ hcIdx: row.hcIdx, id: row.id, ...resolved })
        }
      }
      expect(innateAuraMonsters).toEqual([
        { hcIdx: 211, id: 'duriel', auraSkillId: 114, auraLevel: 4 },
        { hcIdx: 704, id: 'ubermephisto', auraSkillId: 123, auraLevel: 20 },
        { hcIdx: 708, id: 'uberduriel', auraSkillId: 114, auraLevel: 14 },
      ])
      expect(resolveInnateMonsterAura113c(211, 'nightmare')?.auraLevel).toBe(7)
      expect(resolveInnateMonsterAura113c(211, 'hell')?.auraLevel).toBe(10)
    })

    it('mounts Holy Freeze (#114) on Duriel (#211) / Uber Duriel (#708) and Conviction lv20 (-125% res) on Uber Mephisto (#704) at spawn', () => {
      // 1. Duriel (#211) without MonUMod #30 chills player & merc and deals periodic cold pulse damage every 50 frames
      const durielGame = new GameInstance({ seed: 18201, areaId: 73, difficulty: 2 })
      const p1 = durielGame.connectPlayer({
        charClass: 'bar',
        name: 'Challenger',
        x: 20,
        y: 23,
        areaId: 73,
        hp: 4000,
        maxHp: 4000,
      })
      const durielId = durielGame.spawnMonster({
        hcIdx: 211,
        defId: 'duriel',
        x: 20,
        y: 20,
        areaId: 73,
        aiDisabled: true,
        hp: 10000,
        maxHp: 10000,
      })
      // Immediately carries Holy Freeze caster state 43 on spawn
      expect(durielGame.getMonsterState(durielId)!.states.has(43)).toBe(true)

      durielGame.stepFrames(50)
      const p1State = durielGame.getPlayerState(p1)!
      expect(p1State.states.has(11)).toBe(true)
      expect(p1State.states.has(44)).toBe(true)
      expect(p1State.hp).toBeLessThan(4000)

      // 2. Uber Mephisto (#704) pulses Conviction slvl 20 (-125% elemental resist, -90% defense)
      const uberGame = new GameInstance({ seed: 18202, areaId: 136, difficulty: 2 })
      const p2 = uberGame.connectPlayer({
        charClass: 'pal',
        name: 'Smiter',
        x: 20,
        y: 24,
        areaId: 136,
        hp: 4000,
        maxHp: 4000,
      })
      const uberMephId = uberGame.spawnMonster({
        hcIdx: 704,
        defId: 'ubermephisto',
        x: 20,
        y: 20,
        areaId: 136,
        aiDisabled: true,
        hp: 20000,
        maxHp: 20000,
      })
      expect(uberGame.getMonsterState(uberMephId)!.states.has(28)).toBe(true)

      uberGame.stepFrames(25)
      expect(uberGame.getPlayerState(p2)!.states.has(28)).toBe(true)
      const uberInternal = uberGame as unknown as {
        playerCombat: Map<
          number,
          { stateBus: { getState: (id: string | number) => { slvl: number; stats: Record<string, number> } | undefined } }
        >
      }
      const uberConv = uberInternal.playerCombat.get(p2)!.stateBus.getState('conviction')!
      expect(uberConv.slvl).toBe(20)
      expect(uberConv.stats.fireresist).toBe(-125)
      expect(uberConv.stats.lightresist).toBe(-125)
      expect(uberConv.stats.coldresist).toBe(-125)
      expect(uberConv.stats.skill_armor_percent).toBe(-90)
    })
  })

  describe('Issue #1821: MonUMod #9 (Fire Enchanted) 1.13c unmultiplied base HP, [3/4, 1/3, 1/8], & block/DR/Amp', () => {
    it('uses [0.75, 1/3, 0.125] difficulty ratios and 60%..100% roll on unmultiplied base HP', () => {
      expect(FIRE_ENCHANT_MIN_HP_PCT).toBe(60)
      expect(FIRE_ENCHANT_MAX_HP_PCT).toBe(100)
      expect(FIRE_ENCHANT_EXPLOSION_RADIUS).toBe(4)
      expect(FIRE_ENCHANT_DIFF_SCALE[0]).toBeCloseTo(0.75, 6)
      expect(FIRE_ENCHANT_DIFF_SCALE[1]).toBeCloseTo(1 / 3, 6)
      expect(FIRE_ENCHANT_DIFF_SCALE[2]).toBeCloseTo(0.125, 6)

      const hellMax = calcFireEnchantedDeathDamage(16000, 'hell', 1.0)
      // 16000 * 1.0 * (1/8) = 2000 total -> 1000 phys + 1000 fire
      expect(hellMax.physDmg).toBe(1000)
      expect(hellMax.fireDmg).toBe(1000)
      const hellMin = calcFireEnchantedDeathDamage(16000, 'hell', 0.0)
      // 16000 * 0.60 * (1/8) = 1200 total -> 600 phys + 600 fire
      expect(hellMin.physDmg).toBe(600)
      expect(hellMin.fireDmg).toBe(600)
    })

    it('keeps Hell Unique Council FE explosion survivable (unmultiplied base HP, independent of Unique 2x & players8 4.5x) and respects Amplify Damage & shield block', () => {
      // Players 8 Hell game: Unique Council Member has 2x Unique HP * 4.5x players8 = 9x inflated maxHp,
      // yet 1.13c FE death explosion uses unmultiplied single-player normal-rank base HP!
      const game = new GameInstance({ seed: 18211, areaId: 83, difficulty: 2, playersX: 8 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Barb',
        x: 20,
        y: 21,
        areaId: 83,
        level: 85,
        hp: 2500,
        maxHp: 2500,
      })
      const councilId = game.spawnMonster({
        hcIdx: 345,
        defId: 'councilmember1',
        x: 20,
        y: 20,
        areaId: 83,
        rank: 'unique',
        umodIds: [9, 28], // Fire Enchanted + Stone Skin
        aiDisabled: true,
      })
      const internal = game as unknown as {
        monsters: Map<number, { maxHp: number; unscaledMaxHp: number; hp: number }>
        players: Map<
          number,
          {
            hp: number
            dexterity: number
            states: Set<number>
            items: {
              unitId: number
              code: string
              location: string
              bodyLoc?: number
              stats: Map<number, number>
            }[]
          }
        >
        playerCombatContext: (p: unknown) => {
          stateBus: { applyState: (s: unknown) => void }
        }
      }
      const monRec = internal.monsters.get(councilId)!
      expect(monRec.maxHp).toBeGreaterThan(monRec.unscaledMaxHp * 5)

      // Kill the Council Member: Barbarian at 0% resists in Hell (-100% fire res!) still easily survives 2500 HP!
      monRec.hp = 1
      game.applyDamageToMonster(councilId, 50, playerId)
      game.stepFrames(6)
      const hpAfterNormal = game.getPlayerState(playerId)!.hp
      expect(hpAfterNormal).toBeGreaterThan(0)
      expect(2500 - hpAfterNormal).toBeLessThan(2200)

      // Verify Amplify Damage (-100% phys res) amplifies the physical half of FE explosion
      const ampGame = new GameInstance({ seed: 18212, areaId: 1, difficulty: 0 })
      const ampPlayerId = ampGame.connectPlayer({
        charClass: 'bar',
        name: 'CursedBarb',
        x: 10,
        y: 11,
        areaId: 1,
        hp: 2000,
        maxHp: 2000,
      })
      const ampInternal = ampGame as unknown as typeof internal
      const pRec = ampInternal.players.get(ampPlayerId)!
      ampInternal.playerCombatContext(pRec).stateBus.applyState({
        stateNameOrId: 9,
        sourceUnitId: 'monster_999',
        sourceSkillId: 66,
        slvl: 5,
        durationFrames: 500,
        currentFrame: 0,
        stats: { damageresist: -100 },
      })
      pRec.states.add(9)
      const fe1 = ampGame.spawnMonster({
        defId: 'fallen1',
        x: 10,
        y: 10,
        areaId: 1,
        rank: 'unique',
        umodIds: [9],
        maxHp: 400,
        hp: 1,
      })
      ampGame.applyDamageToMonster(fe1, 10, ampPlayerId)
      ampGame.stepFrames(6)
      const ampLoss = 2000 - ampGame.getPlayerState(ampPlayerId)!.hp
      // Normal: 400 * 0.75 * (0.60..1.00) = 180..300 total -> 90..150 phys (doubled by Amp to 180..300) + 90..150 fire = 270..450
      expect(ampLoss).toBeGreaterThanOrEqual(260)

      // Verify 75% max-block shield blocks the physical half across deterministic trials
      let minLossWithShield = Infinity
      for (let i = 0; i < 12; i++) {
        const blkGame = new GameInstance({ seed: 18220 + i, areaId: 1, difficulty: 0 })
        const blkPid = blkGame.connectPlayer({
          charClass: 'pal',
          name: 'Blocker',
          x: 10,
          y: 11,
          areaId: 1,
          level: 30,
          hp: 2000,
          maxHp: 2000,
        })
        const blkInt = blkGame as unknown as typeof internal
        const blkPlayer = blkInt.players.get(blkPid)!
        blkPlayer.dexterity = 200
        blkPlayer.items.push({
          unitId: 9001,
          code: 'uit', // Monarch
          location: 'equipped',
          bodyLoc: 5,
          stats: new Map([[20, 40]]),
        })
        const feBlk = blkGame.spawnMonster({
          defId: 'fallen1',
          x: 10,
          y: 10,
          areaId: 1,
          rank: 'unique',
          umodIds: [9],
          maxHp: 400,
          hp: 1,
        })
        blkGame.applyDamageToMonster(feBlk, 10, blkPid)
        blkGame.stepFrames(6)
        minLossWithShield = Math.min(minLossWithShield, 2000 - blkGame.getPlayerState(blkPid)!.hp)
      }
      // When blocked, phys = 0 so only the fire half (90..150) lands!
      expect(minLossWithShield).toBeLessThanOrEqual(150)
    })
  })

  describe('Issue #1822: CURSE_AI scoping, OblivionKnight 1.13c curse pool & cooldown, and Succubus curses', () => {
    it('restricts MonAi curse=true strictly to OblivionKnight across all 148 MonAi.txt rows', () => {
      const curseProfiles = Object.values(MONAI_PROFILES_113C)
        .filter((p) => p.curse)
        .map((p) => p.name)
      expect(curseProfiles).toEqual(['OblivionKnight'])
      expect(monaiProfile113c('DoomKnight').family).toBe('melee')
      expect(monaiProfile113c('AbyssKnight').family).toBe('ranged')
      expect(monaiProfile113c('Summoner').family).toBe('ranged')
      expect(monaiProfile113c('Nihlathak').family).toBe('ranged')
      expect(monaiProfile113c('FingerMage').family).toBe('kiter')
      expect(monaiProfile113c('Succubus').family).toBe('kiter')
      expect(monaiProfile113c('PutridDefiler').curse).toBe(false)
    })

    it('never casts Iron Maiden (#76 / state 55) from OblivionKnight, enforces cast cooldown, and applies Succubus #309 vs #310 by maxMana >= maxHp', () => {
      const okGame = new GameInstance({ seed: 18221, areaId: 108, difficulty: 2 })
      const okPid = okGame.connectPlayer({
        charClass: 'bar',
        name: 'Zealot',
        x: 20,
        y: 20,
        areaId: 108,
        hp: 4000,
        maxHp: 4000,
      })
      okGame.spawnMonster({
        hcIdx: 312,
        defId: 'doomknight3',
        x: 24,
        y: 20,
        areaId: 108,
        hp: 5000,
        maxHp: 5000,
      })
      okGame.drainEvents(okPid)
      let castModes = 0
      let sawMode8 = false
      for (let f = 0; f < 100; f++) {
        okGame.stepFrames(1)
        const evs = okGame.drainEvents(okPid)
        for (const ev of evs) {
          if (ev.type === 'UnitMode' && (ev as { mode?: number }).mode === 8) {
            sawMode8 = true
          }
          if (
            ev.type === 'SkillCast' &&
            [87, 66, 91, 72, 82].includes((ev as { skillId?: number }).skillId ?? -1)
          ) {
            castModes++
          }
        }
        // Iron Maiden (state 55) was removed from Oblivion Knights in 1.13c!
        expect(okGame.getPlayerState(okPid)!.states.has(55)).toBe(false)
      }
      expect(sawMode8).toBe(true)
      // Cooldown prevents 1-frame spam (100 frames yields at most 2-3 curse casts, never 100)
      expect(castModes).toBeGreaterThanOrEqual(1)
      expect(castModes).toBeLessThanOrEqual(4)
      // At distance 4 (<= aip1), OblivionKnight prefers Decrepify (state 60)
      expect(okGame.getPlayerState(okPid)!.states.has(60)).toBe(true)

      // Succubus (#469): maxMana >= maxHp -> Blood Mana (state 114); maxMana < maxHp -> Defense Curse (state 113)
      const bmGame = new GameInstance({ seed: 18222, areaId: 121 })
      const sorcId = bmGame.connectPlayer({
        charClass: 'sor',
        name: 'Caster',
        x: 10,
        y: 10,
        areaId: 121,
        hp: 400,
        maxHp: 400,
        mana: 600,
        maxMana: 600,
      })
      bmGame.spawnMonster({ hcIdx: 469, defId: 'succubus1', x: 20, y: 10, areaId: 121 })
      bmGame.stepFrames(90)
      expect(bmGame.getPlayerState(sorcId)!.states.has(114)).toBe(true)
      expect(bmGame.getPlayerState(sorcId)!.states.has(113)).toBe(false)
    })
  })

  describe('Issue #1823: Burial Grounds MonPlace #5 Blood Raven, MonPlace sweep, brdeathcontrol & cemetery purge', () => {
    it('resolves MonPlace #5 to hcIdx 267 (Blood Raven) with NO superUniqueIndex (never Coldcrow #2) and sweeps all MonPlace presets', () => {
      const brPreset = resolveMonPlacePreset113c(5, 17)
      expect(brPreset).toEqual({ classId: 267 })
      expect(brPreset?.superUniqueIndex).toBeUndefined()

      // Full MonPlace.txt preset sweep against D2Game.dll 0x6FC67E6D: none carry a bogus superUniqueIndex
      for (let mpId = 0; mpId <= 36; mpId++) {
        const res = resolveMonPlacePreset113c(mpId, 17)
        if (res !== null) {
          expect(res.superUniqueIndex).toBeUndefined()
        }
      }
      expect(resolveMonPlacePreset113c(24, 110)).toEqual({ classId: 492 })
      expect(resolveMonPlacePreset113c(24, 111)).toEqual({ classId: 529 })
      expect(resolveMonPlacePreset113c(26, 110)).toEqual({ classId: 453 })
      // Skeleton3 (hcIdx 2) must NEVER match Blood Raven's boss death FX
      expect(getBossDeathFxSpec(2, 'skeleton3')).toBeNull()
      expect(getBossDeathFxSpec(267, 'bloodraven')?.controllerClassId).toBe(284)
    })

    it('completes a1q2, emits brdeathcontrol (#284), and purges surrounding cemetery zombies on Blood Raven death', () => {
      const game = new GameInstance({ seed: 18231, areaId: 17 })
      const playerId = game.connectPlayer({
        charClass: 'ama',
        name: 'RogueAlly',
        x: 20,
        y: 20,
        areaId: 17,
      })
      const brId = game.spawnMonster({
        hcIdx: 267,
        defId: 'bloodraven',
        x: 24,
        y: 20,
        areaId: 17,
        hp: 50,
        maxHp: 50,
      })
      const nearZombie = game.spawnMonster({
        hcIdx: 6,
        defId: 'zombie2',
        x: 35,
        y: 20,
        areaId: 17,
        hp: 200,
        maxHp: 200,
      })
      const farZombie = game.spawnMonster({
        hcIdx: 6,
        defId: 'zombie2',
        x: 70,
        y: 20,
        areaId: 17,
        hp: 200,
        maxHp: 200,
      })
      game.drainEvents(playerId)
      game.applyDamageToMonster(brId, 500, playerId)

      const events = game.drainEvents(playerId)
      // Emits brdeathcontrol (#284) missile
      expect(
        events.some(
          (e) => e.type === 'CreateMissile' && (e as { missileClassId?: number }).missileClassId === 284,
        ),
      ).toBe(true)
      // Purges zombie within 35 sub-tiles; leaves distant zombie (>35 sub-tiles) alive
      expect(game.getMonsterState(nearZombie)!.dead).toBe(true)
      expect(game.getMonsterState(farZombie)!.dead).toBe(false)
      // Marks a1q2 completed
      const internal = game as unknown as { players: Map<number, { questFlags: Uint16Array }> }
      const qIdx = questWordIndex113c('a1q2')!
      expect(internal.players.get(playerId)!.questFlags[qIdx]! & 1).toBe(1)
    })
  })

  describe('Issue #1824: Act 5 SuicideMinion (#461..468) sprint detonation, corpse shatter & Overseer Whip conversion', () => {
    it('sprints rapidly into contact, shatters body (no revivable corpse), and deals 4-subtile physical + fire/cold explosion', () => {
      expect(monaiProfile113c('SuicideMinion').family).toBe('suicide')
      expect(monaiProfile113c('SuicideMinion').suicide).toBe(true)

      const fireCalc = calcSuicideMinionExplosionDamage(120, 180, 200, 461, 'normal', 1, 0.5)
      expect(fireCalc.missileClassId).toBe(427)
      expect(fireCalc.elemType).toBe('fire')
      expect(fireCalc.radiusSubTiles).toBe(4)

      const iceCalc = calcSuicideMinionExplosionDamage(120, 180, 200, 465, 'normal', 2, 0.5)
      expect(iceCalc.missileClassId).toBe(428)
      expect(iceCalc.elemType).toBe('cold')

      const game = new GameInstance({ seed: 18241, areaId: 110 })
      const playerId = game.connectPlayer({
        charClass: 'bar',
        name: 'Target',
        x: 20,
        y: 20,
        areaId: 110,
        hp: 1500,
        maxHp: 1500,
      })
      const smId = game.spawnMonster({
        hcIdx: 461,
        defId: 'suicideminion1',
        x: 32,
        y: 20,
        areaId: 110,
        hp: 200,
        maxHp: 200,
      })
      game.drainEvents(playerId)
      // Sprints 12 sub-tiles and self-detonates on contact
      game.stepFrames(25)
      const smState = game.getMonsterState(smId)!
      expect(smState.dead).toBe(true)
      expect(game.getPlayerState(playerId)!.hp).toBeLessThan(1500)

      // Shattered body cannot be targeted for corpse skills
      const internal = game as unknown as { monsters: Map<number, { shattered: boolean }> }
      expect(internal.monsters.get(smId)!.shattered).toBe(true)
    })

    it('converts whipped Act 5 minion1..8 (#453..460) into SuicideMinion (#461..468) on 35% Overseer Whip (#295) roll', () => {
      let converted = false
      for (let s = 0; s < 30 && !converted; s++) {
        const game = new GameInstance({ seed: 18250 + s, areaId: 110 })
        game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 28, y: 20, areaId: 110 })
        game.spawnMonster({
          hcIdx: 479,
          defId: 'overseer1',
          x: 20,
          y: 20,
          areaId: 110,
          aiDelay: 1,
          velocity: 0,
          runSpeed: 0,
        })
        const minionId = game.spawnMonster({
          hcIdx: 453,
          defId: 'minion1',
          x: 22,
          y: 20,
          areaId: 110,
          aiDisabled: true,
        })
        game.stepFrames(80)
        const internal = game as unknown as {
          monsters: Map<number, { hcIdx: number; ai: string; states: Set<number> }>
        }
        const m = internal.monsters.get(minionId)!
        if (m.hcIdx === 461 && m.ai === 'SuicideMinion') {
          expect(m.states.has(140)).toBe(true)
          expect(m.states.has(142)).toBe(true)
          converted = true
        }
      }
      expect(converted).toBe(true)
    })
  })
})
