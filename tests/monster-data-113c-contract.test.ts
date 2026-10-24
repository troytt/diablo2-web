import { describe, expect, it } from 'vitest'
import {
  MONSTATS_113C_ROWS,
  MONAI_113C_ROWS,
  MONLVL_113C_ROWS,
  MONUMOD_113C_ROWS,
  MONUMOD_113C_CONSTANTS,
  SUPERUNIQUES_113C_ROWS,
  MONSTER_MODE_MISSILES_113C,
  getMonsterModeMissile113c,
  getMonsterModeMissiles113c,
  getCanonicalMonsterKinds,
  getMonsterKindByHcIdx,
  getMonsterKindByClassId,
  CANONICAL_MONAI_TABLE,
  getCanonicalMonAiTable,
  getMonAi113c,
  getMonAiRecord113c,
  CANONICAL_MONLVL_TABLE,
  getCanonicalMonLvlTable,
  getMonLvl113c,
  getMonLvlRecord113c,
  scaleMonsterKindForLevel113c,
  scaleMonsterStatsForDifficulty,
  resolveMonsterStats,
  monsterStatsOf,
  applyEliteModifiers,
  applyChampionSubtypeStats,
  applyMonsterUModResistances,
  getEliteHealthMultiplier113c,
  getCanonicalSuperUniques,
  getSuperUniqueByIndex,
  MON_UMOD_TABLE,
} from '../src/common/units/monsters-data.ts'
import {
  HIRELING_RECORDS,
  getHirelingRecordsById,
  resolveHirelingCandidate,
  resolveHirelingStatsAtLevel,
} from '../src/common/units/hireling-table.ts'

describe('1.13c Monster & Hireling Data Contract (Milestone M1)', () => {
  describe('F1: MonStats.txt (734 rows), MonStats2.txt, MonAi.txt (148 rows), and MonLvl.txt (111 rows)', () => {
    it('exports all 734 canonical 1.13c MonStats.txt + MonStats2.txt rows across all 3 difficulties', () => {
      expect(MONSTATS_113C_ROWS).toHaveLength(734)
      expect(MONSTATS_113C_ROWS[0]?.hcIdx).toBe(0)
      expect(MONSTATS_113C_ROWS[0]?.id).toBe('skeleton1')
      expect(MONSTATS_113C_ROWS[733]?.hcIdx).toBe(733)
      expect(MONSTATS_113C_ROWS[733]?.id).toBe('willowisp8')

      for (const difficulty of ['normal', 'nightmare', 'hell'] as const) {
        const kinds = getCanonicalMonsterKinds(difficulty)
        expect(kinds.size).toBe(734)
        for (let hcIdx = 0; hcIdx < 734; hcIdx++) {
          const byIdx = getMonsterKindByHcIdx(hcIdx, difficulty)
          expect(byIdx).toBeDefined()
          expect(byIdx?.hcIdx).toBe(hcIdx)
          expect(byIdx?.difficulty).toBe(difficulty)
          expect(getMonsterKindByClassId(hcIdx, difficulty)?.hcIdx).toBe(hcIdx)
        }
      }

      // Duplicate id 'cr_lancer8' (hcIdx 617 Act 5 Blood Tempter, hcIdx 723 Pandemonium Vile Lancer) resolves primary key to first row 617
      const normalKinds = getCanonicalMonsterKinds('normal')
      expect(normalKinds.get('cr_lancer8')?.hcIdx).toBe(617)
      expect(normalKinds.get('cr_lancer8')?.enabled).toBe(true)
      expect(normalKinds.get('cr_lancer8#723')?.hcIdx).toBe(723)
      expect(normalKinds.get('cr_lancer8#723')?.enabled).toBe(true)
      expect(getCanonicalMonsterKinds('hell').get('cr_lancer8')?.minHp).toBe(80)
      expect(getCanonicalMonsterKinds('hell').get('cr_lancer8#723')?.minHp).toBe(400)

      // MonStatsEx foreign-key join to MonStats2.txt (e.g. cr_lancer8 -> cr_lancer1)
      expect(MONSTATS_113C_ROWS[617]?.monStatsEx).toBe('cr_lancer1')
      expect(MONSTATS_113C_ROWS[617]?.sizeX).toBe(2)
      expect(MONSTATS_113C_ROWS[617]?.sizeY).toBe(2)
      expect(MONSTATS_113C_ROWS[617]?.meleeRng).toBe(2)
      expect(MONSTATS_113C_ROWS[617]?.baseW).toBe('2ht')
      expect(MONSTATS_113C_ROWS[723]?.sizeX).toBe(2)
      expect(MONSTATS_113C_ROWS[723]?.sizeY).toBe(2)
      expect(MONSTATS_113C_ROWS[723]?.meleeRng).toBe(2)
      expect(MONSTATS_113C_ROWS[723]?.baseW).toBe('2ht')
    })

    it('preserves strict monstats.bin 0-defaults for empty difficulty cells (drain, coldEffect, level, minHP) and NextInClass minion2 auto-chaining', () => {
      // skeleton1 (hcIdx 0), swarm1 (hcIdx 87), claygolem (hcIdx 289) have blank Drain -> [0, 0, 0]
      expect(MONSTATS_113C_ROWS[0]?.drain).toEqual([0, 0, 0])
      expect(MONSTATS_113C_ROWS[87]?.drain).toEqual([0, 0, 0])
      expect(MONSTATS_113C_ROWS[289]?.drain).toEqual([0, 0, 0])
      expect(getMonsterKindByHcIdx(0, 'normal')?.drain).toBe(0)
      expect(getMonsterKindByHcIdx(87, 'hell')?.drain).toBe(0)

      // mephisto (hcIdx 242): Drain = [100, 0, 0]; diablo (hcIdx 243): Drain = [100, 50, 0]
      expect(MONSTATS_113C_ROWS[242]?.drain).toEqual([100, 0, 0])
      expect(MONSTATS_113C_ROWS[243]?.drain).toEqual([100, 50, 0])
      expect(getMonsterKindByHcIdx(242, 'normal')?.drain).toBe(100)
      expect(getMonsterKindByHcIdx(242, 'nightmare')?.drain).toBe(0)
      expect(getMonsterKindByHcIdx(242, 'hell')?.drain).toBe(0)
      expect(getMonsterKindByHcIdx(243, 'nightmare')?.drain).toBe(50)
      expect(getMonsterKindByHcIdx(243, 'hell')?.drain).toBe(0)

      // flyingscimitar (hcIdx 234): coldeffect = [-50, -25, 0]; evilhole1 (hcIdx 321): [-50, 0, 0]
      expect(MONSTATS_113C_ROWS[234]?.coldEffect).toEqual([-50, -25, 0])
      expect(MONSTATS_113C_ROWS[234]?.coldeffect).toEqual([-50, -25, 0])
      expect(MONSTATS_113C_ROWS[321]?.coldEffect).toEqual([-50, 0, 0])
      expect(getMonsterKindByHcIdx(234, 'hell')?.coldEffect).toBe(0)

      // act2guard3 (hcIdx 358): AC = [84, 0, 125]; mephistospirit (hcIdx 401): Exp = [503, 0, 0]
      expect(MONSTATS_113C_ROWS[358]?.ac).toEqual([84, 0, 125])
      expect(MONSTATS_113C_ROWS[401]?.exp).toEqual([503, 0, 0])

      // NextInClass auto-chaining when minion1 is set and minion2 is blank
      expect(MONSTATS_113C_ROWS[479]?.id).toBe('overseer1')
      expect(MONSTATS_113C_ROWS[479]?.minions).toEqual(['minion1', 'minion2'])
      expect(getMonsterKindByHcIdx(479, 'normal')?.minions).toEqual(['minion1', 'minion2'])
      expect(MONSTATS_113C_ROWS[58]?.id).toBe('fallenshaman1')
      expect(MONSTATS_113C_ROWS[58]?.minions).toEqual(['fallen1', 'fallen2'])
    })

    it('hydrates difficulty-dependent combat, AI, resistance, skill, elemental, and MonStats2 geometry fields', () => {
      const fallenNorm = getMonsterKindByHcIdx(19, 'normal')!
      const fallenHell = getMonsterKindByHcIdx(19, 'hell')!
      expect(fallenNorm.id).toBe('fallen1')
      expect(fallenNorm.level).toEqual([1, 36, 67])
      expect(fallenNorm.velocity).toBe(5)
      expect(fallenNorm.runVelocity).toBe(5)
      expect(fallenNorm.ai).toBe('Fallen')
      expect(fallenNorm.aiDelay).toBe(15)
      expect(fallenHell.aiDelay).toBe(13)
      expect(fallenNorm.aiDist).toBe(fallenNorm.aiDistance)
      expect(fallenNorm.resistances.fire).toBe(0)
      expect(fallenHell.resistances.fire).toBe(100)
      expect(fallenNorm.sizeX).toBe(2)
      expect(fallenNorm.sizeY).toBe(2)
      expect(fallenNorm.baseW).toBe('hth')
      expect(fallenNorm.pixHeight).toBeGreaterThan(0)
      expect(fallenNorm.height).toBeGreaterThan(0)
      expect(fallenNorm.meleeRange).toBe(0)

      const zombieNorm = getMonsterKindByHcIdx(5, 'normal')!
      expect(zombieNorm.id).toBe('zombie1')
      expect(zombieNorm.velocity).toBe(1)
      expect(zombieNorm.runVelocity).toBe(3)
      expect(zombieNorm.isUndead).toBe(true)
      expect(zombieNorm.isLowUndead).toBe(true)
      expect(zombieNorm.isHighUndead).toBe(false)

      // Diablo (hcIdx 243): Prime Evil with 7 skills
      const diabloHell = getMonsterKindByHcIdx(243, 'hell')!
      expect(diabloHell.id).toBe('diablo')
      expect(diabloHell.boss).toBe(true)
      expect(diabloHell.primeevil).toBe(true)
      expect(diabloHell.isDemon).toBe(true)
      expect(diabloHell.skills?.length).toBeGreaterThanOrEqual(7)
      expect(diabloHell.skills?.map((s) => s.skill)).toContain('DiabFire')
      expect(diabloHell.skills?.map((s) => s.skill)).toContain('DiabLight')

      // Mode missiles parity (both short A1..SQ and MissA1..MissSQ keys)
      expect(Object.keys(MONSTER_MODE_MISSILES_113C).length).toBe(155)
      const skelMage = getMonsterKindByHcIdx(379, 'normal')!
      expect(getMonsterModeMissiles113c(skelMage.id)).toBeDefined()
      expect(skelMage.modeMissiles).toEqual(getMonsterModeMissiles113c(skelMage.id))
      expect(skelMage.modeMissiles?.A1).toBe('skmage2')
      expect(skelMage.modeMissiles?.MissA1).toBe(skelMage.modeMissiles?.A1)
      expect(getMonsterModeMissile113c(379, 4)).toBe(skelMage.modeMissiles?.A1)
      expect(getMonsterModeMissile113c('skmage_cold1', 'A1')).toBe(skelMage.modeMissiles?.A1)
      expect(getMonsterModeMissile113c(345, 8)).toBe('highpriestlightning')
      expect(getMonsterModeMissile113c('councilmember1', 'S1')).toBe('highpriestlightning')
    })

    it('exports all 148 canonical 1.13c MonAi.txt state machine rows', () => {
      expect(MONAI_113C_ROWS).toHaveLength(148)
      expect(MONAI_113C_ROWS[0]?.index).toBe(0)
      expect(MONAI_113C_ROWS[0]?.ai).toBe('None')
      expect(MONAI_113C_ROWS[1]?.index).toBe(1)
      expect(MONAI_113C_ROWS[1]?.ai).toBe('Idle')
      expect(MONAI_113C_ROWS[147]?.index).toBe(147)
      expect(MONAI_113C_ROWS[147]?.ai).toBe('UberDiablo')

      expect(Array.isArray(CANONICAL_MONAI_TABLE)).toBe(true)
      expect(CANONICAL_MONAI_TABLE).toHaveLength(148)
      expect(CANONICAL_MONAI_TABLE[0]?.id).toBe(0)
      expect(CANONICAL_MONAI_TABLE[0]?.ai).toBe('None')
      expect(CANONICAL_MONAI_TABLE[1]?.id).toBe(1)
      expect(CANONICAL_MONAI_TABLE[1]?.ai).toBe('Idle')
      expect(Array.isArray(CANONICAL_MONAI_TABLE[1]?.params)).toBe(true)
      expect(CANONICAL_MONAI_TABLE[1]?.params).toHaveLength(8)
      expect(CANONICAL_MONAI_TABLE[147]?.id).toBe(147)
      expect(CANONICAL_MONAI_TABLE[147]?.ai).toBe('UberDiablo')

      const aiMap = getCanonicalMonAiTable()
      expect(aiMap.get('Skeleton')?.index).toBe(2)
      expect(aiMap.get('Fallen')?.index).toBe(6)
      expect(getMonAi113c('Diablo')?.ai).toBe('Diablo')
      expect(getMonAiRecord113c(6)?.ai).toBe('Fallen')
    })

    it('exports all 111 canonical 1.13c MonLvl.txt rows (levels 0..110) and scales via Expansion L-* columns with noRatio bypass and elementalAttacks lDm scaling', () => {
      expect(MONLVL_113C_ROWS).toHaveLength(111)
      const monLvlTable = getCanonicalMonLvlTable()
      expect(CANONICAL_MONLVL_TABLE).toBe(monLvlTable)
      expect(monLvlTable).toHaveLength(111)
      expect(monLvlTable[0]?.level).toBe(0)
      expect(monLvlTable[110]?.level).toBe(110)

      const lvl85 = CANONICAL_MONLVL_TABLE[85]!
      expect(lvl85.level).toBe(85)
      expect(lvl85.armor).toEqual(lvl85.ac)
      expect(lvl85.toHit).toEqual(lvl85.th)
      expect(lvl85.damage).toEqual(lvl85.dm)
      expect(lvl85.lArmor).toEqual(lvl85.lAc)
      expect(lvl85.lToHit).toEqual(lvl85.lTh)
      expect(lvl85.lDamage).toEqual(lvl85.lDm)

      // Level 12 Normal L-HP = 40, Level 75 Hell L-HP = 5032
      expect(getMonLvl113c(12).lHp[0]).toBe(40)
      expect(getMonLvlRecord113c(75).lHp[2]).toBe(5032)

      // Andariel (hcIdx 156) has noRatio = false: Normal (mlvl 12) & Hell (mlvl 75) scale via L-HP and L-DM
      const andarielNorm = getMonsterKindByHcIdx(156, 'normal')!
      expect(andarielNorm.noRatio).toBe(false)
      const andarielScaledNorm = scaleMonsterKindForLevel113c(andarielNorm, 'normal')
      expect(andarielScaledNorm.level).toBe(12)
      expect(andarielScaledNorm.minHp).toBe(Math.trunc((andarielNorm.minHp * 40) / 100))
      expect(andarielScaledNorm.maxHp).toBe(Math.trunc((andarielNorm.maxHp * 40) / 100))
      // Andariel Normal El1 poison raw min=33, max=33, L-DM(12, Normal) = 8 -> floor(33 * 8 / 100) = 2
      expect(andarielScaledNorm.elementalAttacks[0]?.minDamage).toBe(2)
      expect(andarielScaledNorm.elementalAttacks[0]?.maxDamage).toBe(2)

      const andarielHell = getMonsterKindByHcIdx(156, 'hell')!
      const andarielScaledHell = scaleMonsterKindForLevel113c(andarielHell, 'hell')
      expect(andarielScaledHell.level).toBe(75)
      expect(andarielScaledHell.minHp).toBe(Math.trunc((andarielHell.minHp * 5032) / 100))
      // Andariel Hell El1 poison raw min=33, max=33, L-DM(75, Hell) = 85 -> floor(33 * 85 / 100) = 28
      expect(andarielScaledHell.elementalAttacks[0]?.minDamage).toBe(28)
      expect(andarielScaledHell.elementalAttacks[0]?.maxDamage).toBe(28)

      // monsterStatsOf(andarielHell) without options uses andarielHell.difficulty ('hell')
      const andarielStatsHellDefault = monsterStatsOf(andarielHell)
      expect(andarielStatsHellDefault.level).toBe(75)
      expect(andarielStatsHellDefault.elementalAttacks?.[0]?.minDamage).toBe(28)
      const andarielStatsHellP8 = monsterStatsOf(andarielHell, { playerCount: 8 })
      expect(andarielStatsHellP8.elementalAttacks?.[0]?.minDamage).toBe(28 + Math.floor((28 * 7) / 16))
      expect(resolveMonsterStats('andariel', 'hell').level).toBe(75)

      // Synthetic clone override { ...andarielHell, noRatio: true } is preserved by monsterStatsOf
      const andarielNoRatioStats = monsterStatsOf({ ...andarielHell, noRatio: true })
      expect(andarielNoRatioStats.hp).toBe(andarielHell.minHp)
      expect(andarielNoRatioStats.elementalAttacks?.[0]?.minDamage).toBe(33)

      // Bonewall (hcIdx 344) has noRatio = true: bypasses MonLvl.txt scaling (19 / 147 / 431)
      const bonewallNorm = getMonsterKindByHcIdx(344, 'normal')!
      expect(bonewallNorm.id).toBe('bonewall')
      expect(bonewallNorm.noRatio).toBe(true)
      expect(scaleMonsterKindForLevel113c(bonewallNorm, 'normal').minHp).toBe(19)
      expect(scaleMonsterKindForLevel113c(bonewallNorm, 'nightmare').minHp).toBe(147)
      expect(scaleMonsterKindForLevel113c(bonewallNorm, 'hell').minHp).toBe(431)

      const bwStatsHell = scaleMonsterStatsForDifficulty(bonewallNorm, 'hell')
      expect(bwStatsHell.maxHp).toBe(431)

      // /players N scaling in monsterStatsOf (1.13c overload)
      const p1Stats = monsterStatsOf(andarielNorm, 'normal', 96, 0.5, { playersCount: 1 })
      const p3Stats = monsterStatsOf(andarielNorm, 'normal', 96, 0.5, { playersCount: 3 })
      // playersCount = 3 -> HP & XP * (3 + 1) / 2 = 2.0x
      expect(p3Stats.maxHp).toBe(Math.trunc(((p1Stats.maxHp ?? p1Stats.hp) * 4) / 2))
      expect(p3Stats.xp).toBe(Math.trunc((p1Stats.xp * 4) / 2))
    })
  })

  describe('F2: MonUMod.txt (43 rows + 34 constants), Champion Subtypes, Resistances, and SuperUniques.txt (66 rows)', () => {
    it('exports all 43 MonUMod.txt rows, 34 constants, and difficulty-dependent elite HP/AR/Dmg multipliers', () => {
      expect(MONUMOD_113C_ROWS).toHaveLength(43)
      expect(MONUMOD_113C_CONSTANTS.raw).toHaveLength(34)
      expect(MONUMOD_113C_CONSTANTS.championChance).toBe(20)
      expect(MONUMOD_113C_CONSTANTS.championHpBonusPct).toEqual([200, 150, 100])
      expect(MONUMOD_113C_CONSTANTS.championDmgBonusPct).toEqual([100, 100, 100])
      expect(MONUMOD_113C_CONSTANTS.championArBonusPct).toEqual([75, 75, 75])
      expect(MONUMOD_113C_CONSTANTS.championToHitBonusPct).toBe(75)
      expect(MONUMOD_113C_CONSTANTS.uniqueHpBonusPct).toEqual([300, 200, 100])
      expect(MONUMOD_113C_CONSTANTS.uniqueDmgBonusPct).toEqual([150, 150, 150])
      expect(MONUMOD_113C_CONSTANTS.uniqueArBonusPct).toEqual([100, 100, 100])
      expect(MONUMOD_113C_CONSTANTS.uniqueToHitBonusPct).toBe(100)
      expect(MONUMOD_113C_CONSTANTS.uniqueStrongDmgBonusPct).toBe(150)
      expect(MONUMOD_113C_CONSTANTS.minionHpBonusPct).toEqual([100, 75, 50])
      expect(MONUMOD_113C_CONSTANTS.minionDmgBonusPct).toEqual([75, 75, 75])
      expect(MONUMOD_113C_CONSTANTS.minionArBonusPct).toEqual([50, 50, 50])
      expect(MONUMOD_113C_CONSTANTS.minionToHitBonusPct).toBe(50)
      expect(MONUMOD_113C_CONSTANTS.minionStrongDmgBonusPct).toBe(75)
      expect(MONUMOD_113C_CONSTANTS.minionElemMinDmgPct).toEqual([0, 33, 33])
      expect(MONUMOD_113C_CONSTANTS.minionElemMaxDmgPct).toEqual([0, 50, 50])
      expect(MONUMOD_113C_CONSTANTS.championElemMinDmgPct).toEqual([33, 33, 33])
      expect(MONUMOD_113C_CONSTANTS.championElemMaxDmgPct).toEqual([50, 50, 50])
      expect(MONUMOD_113C_CONSTANTS.uniqueElemMinDmgPct).toEqual([66, 66, 66])
      expect(MONUMOD_113C_CONSTANTS.uniqueElemMaxDmgPct).toEqual([100, 100, 100])

      // Total HP multiplier = (100 + bonusPct) / 100
      expect(getEliteHealthMultiplier113c('champion', 'normal')).toBe(3.0)
      expect(getEliteHealthMultiplier113c('champion', 'nightmare')).toBe(2.5)
      expect(getEliteHealthMultiplier113c('champion', 'hell')).toBe(2.0)
      expect(getEliteHealthMultiplier113c('unique', 'normal')).toBe(4.0)
      expect(getEliteHealthMultiplier113c('unique', 'nightmare')).toBe(3.0)
      expect(getEliteHealthMultiplier113c('unique', 'hell')).toBe(2.0)
      expect(getEliteHealthMultiplier113c('minion', 'normal')).toBe(2.0)
      expect(getEliteHealthMultiplier113c('minion', 'nightmare')).toBe(1.75)
      expect(getEliteHealthMultiplier113c('minion', 'hell')).toBe(1.5)

      expect(MON_UMOD_TABLE[8]?.id).toBe('resist')
      expect(MON_UMOD_TABLE['magicresistant']?.umodId).toBe(8)
      expect(MON_UMOD_TABLE[36]?.id).toBe('ghostly')
      expect(MON_UMOD_TABLE[38]?.id).toBe('possessed')
      expect(MON_UMOD_TABLE[39]?.id).toBe('berserk')
    })

    it('applies difficulty-aware elite modifiers, level 110 cap, and all 5 Champion subtypes (16, 36, 37, 38, 39)', () => {
      const fallen = getMonsterKindByHcIdx(19, 'normal')!
      const base = monsterStatsOf(fallen, 'normal', 96, 0.5, { level: 10 })

      // Unique in Normal (+3 mlvl, 4.0x HP) vs Hell (+3 mlvl, 2.0x HP)
      const uniqueNorm = applyEliteModifiers(base, 'unique', 'normal', [])
      const uniqueHell = applyEliteModifiers(base, 'unique', 'hell', [])
      expect(uniqueNorm.level).toBe(13)
      expect(uniqueNorm.maxHp).toBe(Math.round(base.hp * 4.0))
      expect(uniqueHell.maxHp).toBe(Math.round(base.hp * 2.0))

      // High-level Unique/Champion level cap is 110 (MonLvl.txt max row), not 99
      const lvl105Base = { ...base, level: 105 }
      expect(applyEliteModifiers(lvl105Base, 'unique', 'hell', []).level).toBe(108)
      expect(applyChampionSubtypeStats(lvl105Base, 16, 'hell').level).toBe(107)

      // Minion in Normal (+3 mlvl, 2.0x HP) vs Hell (+3 mlvl, 1.5x HP)
      const minionNorm = applyEliteModifiers(base, 'minion', 'normal', [])
      const minionHell = applyEliteModifiers(base, 'minion', 'hell', [])
      expect(minionNorm.level).toBe(13)
      expect(minionNorm.maxHp).toBe(Math.round(base.hp * 2.0))
      expect(minionHell.maxHp).toBe(Math.round(base.hp * 1.5))

      // Champion subtype 38 (Possessed): 3x champion HP
      const champBase = applyChampionSubtypeStats(base, 16, 'normal')
      const champPossessed = applyChampionSubtypeStats(base, 38, 'normal')
      expect(champPossessed.maxHp).toBe((champBase.maxHp ?? champBase.hp) * 3)

      // Champion subtype 39 (Berserk): 1.5x base HP, >= 3x base damage
      const champBerserk = applyChampionSubtypeStats(base, 39, 'normal')
      expect(champBerserk.maxHp).toBe(Math.max(1, Math.round(base.hp * 1.5)))
      expect(champBerserk.damage).toBeGreaterThanOrEqual(base.damage * 3)

      // Champion subtype 36 (Ghostly): 0.5x velocity, 80% physical resist
      const champGhostly = applyChampionSubtypeStats(base, 36, 'normal')
      expect(champGhostly.speed).toBe(Math.max(4, Math.round(base.speed * 0.5)))
      expect(champGhostly.resistances?.physical).toBe(80)

      // Champion subtype 37 (Fanatic): 2.0x velocity, 0.3x cooldownTicks
      const champFanatic = applyChampionSubtypeStats(base, 37, 'normal')
      expect(champFanatic.speed).toBe(Math.round(base.speed * 2.0))
      expect(champFanatic.cooldownTicks).toBe(Math.max(5, Math.round(base.cooldownTicks * 0.3)))
    })

    it('resolves elite rank levels, difficulty HP multipliers, Champion subtypes, and MonUMod modifiers via both 2-arg and 3-arg resolveMonsterStats', () => {
      // 3-arg resolveMonsterStats(hcIdx, difficulty, { rank }) across Normal, Nightmare, and Hell
      const skelNorm = resolveMonsterStats(0, 'normal', { rank: 'normal' })
      expect(skelNorm.level).toBe(2)
      expect(skelNorm.hp).toBe(7)

      const skelChampNorm = resolveMonsterStats(0, 'normal', { rank: 'champion' })
      const skelUniqueNorm = resolveMonsterStats(0, 'normal', { rank: 'unique' })
      const skelMinionNorm = resolveMonsterStats(0, 'normal', { rank: 'minion' })
      const skelSuperNorm = resolveMonsterStats(0, 'normal', { rank: 'superunique' })
      expect(skelChampNorm.level).toBe(4) // +2 Champion
      expect(skelChampNorm.hp).toBe(21) // 3.0x Normal Champion HP
      expect(skelUniqueNorm.level).toBe(5) // +3 Unique
      expect(skelUniqueNorm.hp).toBe(28) // 4.0x Normal Unique HP
      expect(skelMinionNorm.level).toBe(5) // +3 Minion
      expect(skelMinionNorm.hp).toBe(14) // 2.0x Normal Minion HP
      expect(skelSuperNorm.level).toBe(5) // +3 SuperUnique
      expect(skelSuperNorm.hp).toBe(28) // 4.0x Normal SuperUnique HP

      // Nightmare (2.5x Champion, 3.0x Unique, 1.75x Minion) & Hell (2.0x Champion, 2.0x Unique, 1.5x Minion)
      const skelNm = resolveMonsterStats(0, 'nightmare', { rank: 'normal' })
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'champion' }).level).toBe(skelNm.level! + 2)
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'champion' }).maxHp).toBe(Math.round(skelNm.hp * 2.5))
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'unique' }).level).toBe(skelNm.level! + 3)
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'unique' }).maxHp).toBe(Math.round(skelNm.hp * 3.0))
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'minion' }).level).toBe(skelNm.level! + 3)
      expect(resolveMonsterStats(0, 'nightmare', { rank: 'minion' }).maxHp).toBe(Math.round(skelNm.hp * 1.75))

      const skelHell = resolveMonsterStats(0, 'hell', { rank: 'normal' })
      expect(resolveMonsterStats(0, 'hell', { rank: 'champion' }).level).toBe(skelHell.level! + 2)
      expect(resolveMonsterStats(0, 'hell', { rank: 'champion' }).maxHp).toBe(Math.round(skelHell.hp * 2.0))
      expect(resolveMonsterStats(0, 'hell', { rank: 'unique' }).level).toBe(skelHell.level! + 3)
      expect(resolveMonsterStats(0, 'hell', { rank: 'unique' }).maxHp).toBe(Math.round(skelHell.hp * 2.0))
      expect(resolveMonsterStats(0, 'hell', { rank: 'minion' }).level).toBe(skelHell.level! + 3)
      expect(resolveMonsterStats(0, 'hell', { rank: 'minion' }).maxHp).toBe(Math.round(skelHell.hp * 1.5))

      // 2-arg resolveMonsterStats(kind, options) with Champion subtypes & MonUMod resistance modifiers
      const fallen = getMonsterKindByHcIdx(19, 'normal')!
      const fallenNmBase = resolveMonsterStats(fallen, { difficulty: 'nightmare', rank: 'normal' })
      const fallenNmGhostly = resolveMonsterStats(fallen, {
        difficulty: 'nightmare',
        rank: 'champion',
        championSubtype: 'ghostly',
      })
      expect(fallenNmGhostly.level).toBe(fallenNmBase.level! + 2)
      expect(fallenNmGhostly.maxHp).toBe(Math.round(fallenNmBase.hp * 2.5))
      expect(fallenNmGhostly.speed).toBe(Math.max(4, Math.round(fallenNmBase.speed * 0.5)))
      expect(fallenNmGhostly.resistances?.physical).toBe(80)

      const fallenNormBase = resolveMonsterStats(fallen, { difficulty: 'normal', rank: 'normal' })
      const fallenFanatic = resolveMonsterStats(fallen, {
        difficulty: 'normal',
        rank: 'champion',
        championSubtype: 'fanatic',
      })
      expect(fallenFanatic.speed).toBe(Math.round(fallenNormBase.speed * 2.0))
      expect(fallenFanatic.cooldownTicks).toBe(Math.max(5, Math.round(fallenNormBase.cooldownTicks * 0.3)))

      const fallenChamp = resolveMonsterStats(fallen, {
        difficulty: 'normal',
        rank: 'champion',
        championSubtype: 'champion',
      })
      const fallenPossessed = resolveMonsterStats(fallen, {
        difficulty: 'normal',
        rank: 'champion',
        championSubtype: 'possessed',
      })
      expect(fallenPossessed.maxHp).toBe((fallenChamp.maxHp ?? fallenChamp.hp) * 3)
      expect(fallenPossessed.modifiers).toEqual(['possessed'])

      const fallenBerserk = resolveMonsterStats(fallen, {
        difficulty: 'normal',
        rank: 'champion',
        championSubtype: 'berserk',
      })
      expect(fallenBerserk.maxHp).toBe(Math.max(1, Math.round(fallenNormBase.hp * 1.5)))
      expect(fallenBerserk.damage).toBeGreaterThanOrEqual(fallenNormBase.damage * 3)

      const skelUniqueMods = resolveMonsterStats(0, {
        difficulty: 'normal',
        rank: 'unique',
        modifiers: ['stoneskin', 'magicresistant'],
      })
      expect(skelUniqueMods.level).toBe(5)
      expect(skelUniqueMods.resistances?.physical).toBe((skelNorm.resistances?.physical ?? 0) + 50)
      expect(skelUniqueMods.resistances?.fire).toBe((skelNorm.resistances?.fire ?? 0) + 40)
      expect(skelUniqueMods.resistances?.lightning).toBe((skelNorm.resistances?.lightning ?? 0) + 40)
      expect(skelUniqueMods.resistances?.cold).toBe((skelNorm.resistances?.cold ?? 0) + 40)
    })

    it('enforces the 1.13c 2-immunity cap sequentially and ghostly physical resist floor in applyMonsterUModResistances (D2Game.dll 0x6fccf610)', () => {
      // Monster starts with 1 immunity (cold = 100) and fire = 80, lightning = 50.
      // Applying magicresistant (8) checks countImmunities() < 2 before EACH element:
      // 1) fire: 1 immunity < 2 -> fire becomes 80 + 40 = 120 (now 2 immunities!)
      // 2) lightning: 2 immunities < 2 is FALSE -> lightning stays 50!
      // 3) cold: 2 immunities < 2 is FALSE -> cold stays 100!
      const res = applyMonsterUModResistances(
        { physical: 0, magic: 0, fire: 80, lightning: 50, cold: 100, poison: 0 },
        [8],
      )
      expect(res.fire).toBe(120)
      expect(res.lightning).toBe(50)
      expect(res.cold).toBe(100)

      // Spectral Hit (27) only adds +20 if countImmunities() < 2 AND element < 75
      const spectralRes = applyMonsterUModResistances(
        { physical: 0, magic: 0, fire: 75, lightning: 60, cold: 40, poison: 0 },
        ['spectralhit'],
      )
      expect(spectralRes.fire).toBe(75)
      expect(spectralRes.lightning).toBe(80)
      expect(spectralRes.cold).toBe(60)

      // Mana Burn (25) and Stone Skin (28) bypass elemental 2-immunity cap
      const stoneMana = applyMonsterUModResistances(
        { physical: 50, magic: 0, fire: 100, lightning: 100, cold: 0, poison: 0 },
        [25, 28],
      )
      expect(stoneMana.magic).toBe(20)
      expect(stoneMana.physical).toBe(100)

      // Ghostly (36) sets physical resistance floor to max(80, physical)
      const ghostlyRes = applyMonsterUModResistances(
        { physical: 0, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
        ['ghostly'],
      )
      expect(ghostlyRes.physical).toBe(80)
      const ghostlyHighPhys = applyMonsterUModResistances(
        { physical: 90, magic: 0, fire: 0, lightning: 0, cold: 0, poison: 0 },
        [36],
      )
      expect(ghostlyHighPhys.physical).toBe(90)

      // Also accepts a MonsterKind directly
      const fallenHell = getMonsterKindByHcIdx(19, 'hell')!
      const fallenHellStone = applyMonsterUModResistances(fallenHell, [28])
      expect(fallenHellStone.physical).toBe(fallenHell.resistances.physical + 50)
    })

    it('exports all 66 canonical 1.13c SuperUniques.txt rows', () => {
      expect(SUPERUNIQUES_113C_ROWS).toHaveLength(66)
      const superUniques = getCanonicalSuperUniques()
      expect(superUniques).toHaveLength(66)

      const bishibosh = getSuperUniqueByIndex(0)!
      expect(bishibosh.id).toBe('Bishibosh')
      expect(bishibosh.classId).toBe('fallenshaman1')
      expect(bishibosh.mods).toEqual([8, 9])

      const rakanishu = getSuperUniqueByIndex(3)!
      expect(rakanishu.id).toBe('Rakanishu')
      expect(rakanishu.classId).toBe('fallen2')

      const lister = getSuperUniqueByIndex(65)!
      expect(lister.id).toBe('Baal Subject 5')
      expect(lister.classId).toBe('baalminion1')
    })
  })

  describe('F3: Hireling.txt (120 rows) and /8 Fixed-Point Multi-Bracket Stat Scaling', () => {
    it('exports all 120 canonical 1.13c Hireling.txt rows across Acts 1, 2, 3, and 5', () => {
      expect(HIRELING_RECORDS).toHaveLength(120)
      expect(HIRELING_RECORDS[0]?.id).toBe(0)
      expect(HIRELING_RECORDS[0]?.act).toBe(1)
      expect(HIRELING_RECORDS[119]?.id).toBe(29)
      expect(HIRELING_RECORDS[119]?.act).toBe(5)

      expect(getHirelingRecordsById(7).length).toBeGreaterThan(0)
      expect(resolveHirelingCandidate(1, 1, 0, 10)).toBeDefined()
      expect(resolveHirelingCandidate(2, 2, 0, 45)).toBeDefined()
      expect(resolveHirelingCandidate(3, 3, 0, 75)).toBeDefined()
      expect(resolveHirelingCandidate(5, 3, 0, 75)).toBeDefined()
    })

    it('computes 1.13c /8 fixed-point hireling stats and /4 resistPerLvl across level brackets via both 2-arg and 5-arg resolveHirelingStatsAtLevel', () => {
      const stats30 = resolveHirelingStatsAtLevel('Combat', 2, 2, 30)!
      const stats75 = resolveHirelingStatsAtLevel('Combat', 2, 2, 75)!
      expect(stats30).toBeDefined()
      expect(stats75).toBeDefined()
      expect(stats30.level).toBe(30)
      expect(stats75.level).toBe(75)
      expect(stats75.hp).toBeGreaterThan(stats30.hp)
      expect(stats75.str).toBeGreaterThan(stats30.str)
      expect(stats75.dex).toBeGreaterThan(stats30.dex)
      expect(stats75.defense).toBeGreaterThan(stats30.defense)
      expect(stats75.ar).toBeGreaterThan(stats30.ar)
      expect(stats75.maxDmg).toBeGreaterThanOrEqual(stats75.minDmg)
      expect(stats75.resist).toBeGreaterThan(stats30.resist)
      expect(stats75.skills.length).toBeGreaterThan(0)

      // 2-arg overload (hirelingId, targetLevel) matches 5-arg overload and uses / 4 for resistPerLvl
      const byId80 = resolveHirelingStatsAtLevel(stats75.id, 80)!
      expect(byId80).toBeDefined()
      expect(byId80.level).toBe(80)
      const delta80 = 80 - byId80.baseRowLevel
      expect(byId80.resist).toBe(
        byId80.record.resist + Math.trunc((delta80 * byId80.record.resistPerLvl) / 4),
      )

      // resolveHirelingCandidate also uses / 4 for resistPerLvl
      const cand = resolveHirelingCandidate({ nameId: 3411, seed: 0x1234 }, 15, 0, 0, true, 'ENG')
      const candRow = cand.record as { level: number; resist: number; resistPerLvl: number }
      expect(cand.resist).toBe(
        Math.max(0, candRow.resist + Math.trunc(((cand.level - candRow.level) * candRow.resistPerLvl) / 4)),
      )
    })
  })
})

