import { describe, expect, it } from 'vitest'
import { Rng } from '../../src/common/rng/d2-rng.ts'
import {
  doesMonsterMatchMonType113c,
  getCanonicalMonsterKinds,
  getSuperUniqueByIndex,
  isMonUModEligible113c,
  MONUMOD_113C_ROWS,
  rollEliteModifiers,
  rollSingleChampionUMod113c,
  rollSingleUniqueUMod113c,
  rollSuperUniqueModifiers113c,
  rollSuperUniqueUModIds113c,
} from '../../src/common/units/monsters-data.ts'
import { GameInstance, SINGLE_PLAYER_POLICY } from '../../src/server/engine/game-instance.ts'

describe('issue #1464: 1.13c MonUMod.txt unique/champion/superunique affix selection (D2Game.dll 0x6FC43CA0 / 0x6FC43980 / 0x6FC43100)', () => {
  it('rolls 1 + difficulty random Unique affixes across 10,000 Normal, Nightmare, and Hell rolls (0x6FC43DD9..0x6FC43E29)', () => {
    const rng = new Rng(0x14640001)
    const normalMonsters = getCanonicalMonsterKinds('normal')
    const skeletonArcher = normalMonsters.get('skeleton2')!

    let normalResistCount = 0
    let nmResistCount = 0
    let hellResistCount = 0

    const validUniqueIds = new Set(
      MONUMOD_113C_ROWS.filter((r) => r.enabled && !r.champion && (r.upick[0] > 0 || r.upick[1] > 0 || r.upick[2] > 0)).map(
        (r) => r.id,
      ),
    )

    for (let i = 0; i < 10_000; i += 1) {
      const normalMods = rollEliteModifiers('unique', rng, 'normal', skeletonArcher)
      expect(normalMods).toHaveLength(1)
      expect(validUniqueIds.has(normalMods[0]!)).toBe(true)
      if (normalMods.includes('resist')) normalResistCount += 1

      const nmMods = rollEliteModifiers('unique', rng, 'nightmare', skeletonArcher)
      expect(nmMods).toHaveLength(2)
      expect(new Set(nmMods).size).toBe(2)
      for (const m of nmMods) expect(validUniqueIds.has(m)).toBe(true)
      if (nmMods.includes('resist')) nmResistCount += 1

      const hellMods = rollEliteModifiers('unique', rng, 'hell', skeletonArcher)
      expect(hellMods).toHaveLength(3)
      expect(new Set(hellMods).size).toBe(3)
      for (const m of hellMods) expect(validUniqueIds.has(m)).toBe(true)
      if (hellMods.includes('resist')) hellResistCount += 1
    }

    // MonUMod.txt row 8 (resist): upick = 0 in Normal, 6 in Nightmare, 6 in Hell
    expect(normalResistCount).toBe(0)
    expect(nmResistCount).toBeGreaterThan(500)
    expect(hellResistCount).toBeGreaterThan(800)
  })

  it('enforces MonUMod.txt exclude1/exclude2 via MonType.txt (0x6FC43100 + 0x6FC22790): sandleaper never rolls lightning (id=17)', () => {
    const rng = new Rng(0x14640002)
    const kinds = getCanonicalMonsterKinds('hell')
    const sandLeaper = kinds.get('sandleaper1')!
    expect(sandLeaper.monType).toBe('sandleaper')

    const lightningRow = MONUMOD_113C_ROWS.find((r) => r.umodId === 17)!
    expect(lightningRow.id).toBe('lightning')
    expect(lightningRow.exclude1).toBe('sandleaper')
    expect(isMonUModEligible113c(lightningRow, sandLeaper)).toBe(false)
    expect(isMonUModEligible113c(lightningRow, 'sandleaper')).toBe(false)

    for (let i = 0; i < 10_000; i += 1) {
      const mods = rollEliteModifiers('unique', rng, 'hell', sandLeaper)
      expect(mods).toHaveLength(3)
      expect(mods).not.toContain('lightning')
    }

    // Verify MonType.txt transitive equivalence (0x6FC22790: skeleton -> lowundead -> undead)
    expect(doesMonsterMatchMonType113c('skeleton', 'lowundead')).toBe(true)
    expect(doesMonsterMatchMonType113c('skeleton', 'undead')).toBe(true)
    expect(doesMonsterMatchMonType113c('fallen', 'demon')).toBe(true)
    expect(doesMonsterMatchMonType113c('sandleaper', 'demon')).toBe(false)
  })

  it('enforces fPick 1 (teleport requires mA1), fPick 2 (multishot requires !isMelee && !noMultishot), and fPick 3 (fast requires mWL) (0x6FC4314F..0x6FC43210)', () => {
    const rng = new Rng(0x14640003)
    const fastRow = MONUMOD_113C_ROWS.find((r) => r.umodId === 6)!
    const teleportRow = MONUMOD_113C_ROWS.find((r) => r.umodId === 26)!
    const multishotRow = MONUMOD_113C_ROWS.find((r) => r.umodId === 29)!

    expect(fastRow.fPick).toBe(3)
    expect(teleportRow.fPick).toBe(1)
    expect(multishotRow.fPick).toBe(2)

    const kinds = getCanonicalMonsterKinds('hell')
    const fallenMelee = kinds.get('fallen1')!
    const skeletonArcher = kinds.get('sk_archer1')!
    const vampireNoMultishot = kinds.get('vampire1')!
    const boneWallNoWalkNoAttack = kinds.get('bonewall')!

    expect(fallenMelee.isMelee).toBe(true)
    expect(skeletonArcher.isMelee).toBe(false)
    expect(vampireNoMultishot.noMultishot).toBe(true)
    expect(boneWallNoWalkNoAttack.m1m).toBe(false)
    expect(boneWallNoWalkNoAttack.m2c).toBe(false)

    // fPick = 2: multishot is rejected for melee or noMultishot monsters, allowed for ranged monsters
    expect(isMonUModEligible113c(multishotRow, fallenMelee)).toBe(false)
    expect(isMonUModEligible113c(multishotRow, vampireNoMultishot)).toBe(false)
    expect(isMonUModEligible113c(multishotRow, skeletonArcher)).toBe(true)
    expect(
      isMonUModEligible113c(multishotRow, {
        isMelee: false,
        noMultishot: true,
      }),
    ).toBe(false)

    // fPick = 1 (teleport requires mA1 / m1m) & fPick = 3 (fast requires mWL / m2c)
    expect(isMonUModEligible113c(teleportRow, boneWallNoWalkNoAttack)).toBe(false)
    expect(isMonUModEligible113c(fastRow, boneWallNoWalkNoAttack)).toBe(false)
    expect(isMonUModEligible113c(teleportRow, fallenMelee)).toBe(true)
    expect(isMonUModEligible113c(fastRow, fallenMelee)).toBe(true)

    let archerMultishotCount = 0
    for (let i = 0; i < 2_000; i += 1) {
      const meleeMods = rollEliteModifiers('unique', rng, 'hell', fallenMelee)
      expect(meleeMods).not.toContain('multishot')

      const stationaryMods = rollEliteModifiers('unique', rng, 'hell', boneWallNoWalkNoAttack)
      expect(stationaryMods).not.toContain('teleport')
      expect(stationaryMods).not.toContain('fast')

      const archerMods = rollEliteModifiers('unique', rng, 'hell', skeletonArcher)
      if (archerMods.includes('multishot')) archerMultishotCount += 1
    }
    expect(archerMultishotCount).toBeGreaterThan(100)
  })

  it('caps total Unique monster modifier slots at 9 including the 4 fixed base slots (0x6FC448A0)', () => {
    const rng = new Rng(0x14640004)
    // 4 fixed base slots [1, 2, 3, 4] + 4 existing modifiers = 8 slots used -> only 1 more slot fits before hitting 9
    const mods = rollEliteModifiers('unique', rng, 'hell', 'skeleton2', [
      'strong',
      'fast',
      'curse',
      'fire',
    ])
    expect(mods).toHaveLength(1)
    expect(['strong', 'fast', 'curse', 'fire']).not.toContain(mods[0])

    // 4 fixed base slots + 5 existing modifiers = 9 slots full -> 0 more slots fit
    const fullMods = rollEliteModifiers('unique', rng, 'hell', 'skeleton2', [
      'strong',
      'fast',
      'curse',
      'fire',
      'cold',
    ])
    expect(fullMods).toHaveLength(0)
  })

  it('rolls Champion subtype from MonUMod.txt champion==true rows weighted by cpick (0x6FC43AE0)', () => {
    const rng = new Rng(0x14640005)
    const counts = new Map<string, number>()
    for (let i = 0; i < 2_500; i += 1) {
      const picked = rollSingleChampionUMod113c(rng, 'hell', 'fallen1')
      expect(picked).toBeDefined()
      expect(picked!.champion).toBe(true)
      counts.set(picked!.id, (counts.get(picked!.id) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual([
      'berserk',
      'champion',
      'fanatic',
      'ghostly',
      'possessed',
    ])
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(350)
    }
  })

  it('rolls SuperUnique fixed Mod1..Mod3 (stopping at 0, skipping 24 thief) + difficulty (0/1/2) random Unique affixes (0x6FC451F0)', () => {
    const rng = new Rng(0x14640006)
    // Bishibosh (index 0): fixed Mod1=8 (resist), Mod2=9 (fire), Mod3=0
    const bishibosh = getSuperUniqueByIndex(0)!
    expect(bishibosh.id).toBe('Bishibosh')
    expect(bishibosh.modifiers).toEqual([8, 9])

    const normalIds = rollSuperUniqueUModIds113c(bishibosh.modifiers, rng, 'normal', bishibosh.monsterId)
    expect(normalIds).toEqual([8, 9])

    const nmIds = rollSuperUniqueUModIds113c(bishibosh.modifiers, rng, 'nightmare', bishibosh.monsterId)
    expect(nmIds).toHaveLength(3)
    expect(nmIds.slice(0, 2)).toEqual([8, 9])
    expect(new Set(nmIds).size).toBe(3)

    const hellIds = rollSuperUniqueUModIds113c(bishibosh.modifiers, rng, 'hell', bishibosh.monsterId)
    expect(hellIds).toHaveLength(4)
    expect(hellIds.slice(0, 2)).toEqual([8, 9])
    expect(new Set(hellIds).size).toBe(4)

    // Verify skipping 24 (thief) and stopping at 0 (0x6FC45317..0x6FC4531B)
    expect(rollSuperUniqueUModIds113c([9, 24, 17], rng, 'normal', 'fallen1')).toEqual([9, 17])
    expect(rollSuperUniqueUModIds113c([0, 9, 17], rng, 'normal', 'fallen1')).toEqual([])
    expect(rollSuperUniqueModifiers113c([8, 9], rng, 'hell', bishibosh.monsterId)).toHaveLength(4)

    // Verify GameInstance.spawnSuperUnique in Normal (0 extra), Nightmare (+1 extra), and Hell (+2 extra)
    const gameNormal = new GameInstance({ mapSeed: 101, policy: SINGLE_PLAYER_POLICY, difficulty: 0, areaId: 3 })
    const [normBossId] = gameNormal.spawnSuperUnique({ superUniqueIndex: 0, x: 100, y: 100, areaId: 3 })
    expect(gameNormal.getMonster(normBossId!)?.umodIds).toEqual([8, 9])

    const gameNm = new GameInstance({ mapSeed: 101, policy: SINGLE_PLAYER_POLICY, difficulty: 1, areaId: 3 })
    const [nmBossId] = gameNm.spawnSuperUnique({ superUniqueIndex: 0, x: 100, y: 100, areaId: 3 })
    const nmBossUMods = gameNm.getMonster(nmBossId!)?.umodIds ?? []
    expect(nmBossUMods).toHaveLength(3)
    expect(nmBossUMods.slice(0, 2)).toEqual([8, 9])

    const gameHell = new GameInstance({ mapSeed: 101, policy: SINGLE_PLAYER_POLICY, difficulty: 2, areaId: 3 })
    const [hellBossId] = gameHell.spawnSuperUnique({ superUniqueIndex: 0, x: 100, y: 100, areaId: 3 })
    const hellBossUMods = gameHell.getMonster(hellBossId!)?.umodIds ?? []
    expect(hellBossUMods).toHaveLength(4)
    expect(hellBossUMods.slice(0, 2)).toEqual([8, 9])

    // Verify rollSingleUniqueUMod113c never picks already-used modifiers
    const single = rollSingleUniqueUMod113c(rng, 'hell', 'fallen1', new Set([5, 6, 7, 8, 9, 17, 18, 25, 26, 27, 28, 29]))
    expect(single?.umodId).toBe(30) // only 'aura' (30) left for melee monster
  })
})
