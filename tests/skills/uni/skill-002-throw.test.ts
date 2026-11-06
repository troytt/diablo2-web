/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #002: Throw (UNI)
 * Gitea Tracking Issue: #156
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { resolveItemMissileName113c, resolveItemMissileTypeId113c } from '../../../src/common/skills/weapon-combat-meta.ts'
import { getCanonicalWeaponsTable } from '../../../src/common/units/char-anim-speed.ts'
import type { ItemData, ItemStat, ServerEvent } from '../../../src/netproto/index.ts'
import { GameInstance } from '../../../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { writeD2sSave113c } from '../../../src/server/save/d2s-writer.ts'
import { skillModule } from '../../../src/server/skills/impl/uni/skill-002-throw.ts'
import { evaluateSkill113c, executeSkill113c } from '../../../src/server/skills/registry.ts'
import { createSampleD2sCharacterData } from '../../e2e/server-reuse/helpers.ts'

describe('[Skill #002] Throw (UNI) — 1.13c Parity (Issue #156)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(2)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(2)
    expect(skillModule.name).toBe("Throw")
    expect(skillModule.charClass).toBe("uni")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(2, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(0)
    expect(r1.manaCost256).toBe(0)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(2, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(0)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(2, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(0)
    expect(r20.manaCost256).toBe(0)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(2)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(2, 20)
    if (synId !== null) {
      statsBase.setBaseSkillLevel(synId, 20)
    }
    const withHardPoints = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsBase,
    })
    expect(withHardPoints.synergyBonusPct).toBe(0)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(2, 20)
    statsSoftOnly.addStat('item_allskills', 20)
    if (synId !== null) {
      statsSoftOnly.setChargedSkillLevel(synId, 33)
    }
    const withSoftOnly = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsSoftOnly,
    })
    expect(withSoftOnly.synergyBonusPct).toBe(0)
  })

  it('executes runtime skill effect in WorldArena (castCount, action frame, and combat/state/missile/summon outcome)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: "uni",
      skillId: 2,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(2)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('#1452: D2Common.#10321 (0x6FD72F50) & D2Game SrvDo003_Throw (0x6FCC2B40) — resolves missile from Weapons.txt missiletype across all 42 throwable rows and refuses unarmed/non-throwable casts', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(2)!
    const statList = new UnitStatList(registry, { level: 30 })
    statList.setBaseSkillLevel(2, 1)

    // 1. evaluateSkill113c must NOT hardcode 'javelin' or leak cltMissile into server missileA
    const evalThrow = evaluateSkill113c({ registry, skill: skillRec, slvl: 1, blvl: 1, statList })
    expect(evalThrow.missileA).toBe('')
    for (const cltOnlySkillId of [50, 66, 70, 74]) {
      const s = registry.getSkillById(cltOnlySkillId)!
      statList.setBaseSkillLevel(cltOnlySkillId, 1)
      const ev = evaluateSkill113c({ registry, skill: s, slvl: 1, blvl: 1, statList })
      expect(ev.missileA, `skill #${cltOnlySkillId} (${s.skill}) has empty srvMissile`).toBe('')
    }

    // 2. Sweep all 42 Weapons.txt rows with missiletype > 0 (D2Common.#10321 ITEMS_GetMissileType @ 0x6FD72F50)
    const weaponsWithMissile = [...getCanonicalWeaponsTable().byCode.values()].filter((w) => (w.missiletype ?? 0) > 0)
    expect(weaponsWithMissile.length).toBe(42)
    for (const w of weaponsWithMissile) {
      const mId = resolveItemMissileTypeId113c(w.code)
      const mName = resolveItemMissileName113c(w.code)
      const expectedMissile = registry.getMissileById(w.missiletype!)!
      expect(mId, `Weapons.txt ${w.code} missiletype`).toBe(w.missiletype)
      expect(mName, `Weapons.txt ${w.code} Missiles.txt name`).toBe(expectedMissile.name.toLowerCase())
    }

    // 3. executeSkill113c resolves right-hand weapon missiletype and refuses unarmed/melee weapons
    const makeCaster = (weaponItemType: string, weaponCode?: string) => ({
      id: '1',
      name: 'ThrowCaster',
      unitType: 'player' as const,
      charClass: 'bar',
      statList,
      stateBus: new StateBus(statList, registry),
      x: 100,
      y: 100,
      weaponItemType,
      ...(weaponCode !== undefined ? { weaponCode } : {}),
      weaponMinPhys: 10,
      weaponMaxPhys: 20,
    })

    const cases: ReadonlyArray<{ code: string; wClass: string; expectedMissile: string; expectedId: number; expectedRange: number }> = [
      { code: 'tkf', wClass: 'tkni', expectedMissile: 'throwknife', expectedId: 36, expectedRange: 20 },
      { code: 'tax', wClass: 'taxe', expectedMissile: 'throwaxe', expectedId: 35, expectedRange: 20 },
      { code: 'jav', wClass: 'jave', expectedMissile: 'javelin', expectedId: 1, expectedRange: 40 },
      { code: 'pil', wClass: 'jave', expectedMissile: 'pilum', expectedId: 371, expectedRange: 40 },
      { code: 'am5', wClass: 'ajav', expectedMissile: 'pilum', expectedId: 371, expectedRange: 40 },
      { code: 'glv', wClass: 'jave', expectedMissile: 'glaive', expectedId: 37, expectedRange: 40 },
      { code: 'whm', wClass: 'hamm', expectedMissile: 'electric throwaxe', expectedId: 178, expectedRange: 20 },
      { code: 'opl', wClass: 'tpot', expectedMissile: 'oilpotion', expectedId: 44, expectedRange: 30 },
    ]
    for (const c of cases) {
      const out = executeSkill113c({
        registry,
        skill: skillRec,
        evalResult: evalThrow,
        caster: makeCaster(c.wClass, c.code),
        targets: [],
        corpses: [],
        targetX: 108,
        targetY: 100,
      } as any)
      expect(out.executed, `${c.code} executed`).toBe(true)
      expect(out.missilesSpawned, `${c.code} missileName`).toEqual([c.expectedMissile])
      const mRec = registry.getMissileByName(c.expectedMissile)!
      expect(mRec.id).toBe(c.expectedId)
      expect(mRec.range).toBe(c.expectedRange)
    }

    // Unarmed or non-throwable melee weapon (lsd = Long Sword, missiletype = 0) must be refused
    const unarmedOut = executeSkill113c({
      registry,
      skill: skillRec,
      evalResult: evalThrow,
      caster: makeCaster('hth', undefined),
      targets: [],
      corpses: [],
      targetX: 108,
      targetY: 100,
    } as any)
    expect(unarmedOut.executed).toBe(false)
    expect(unarmedOut.manaSpent256).toBe(0)
    expect(unarmedOut.missilesSpawned).toEqual([])

    const swordOut = executeSkill113c({
      registry,
      skill: skillRec,
      evalResult: evalThrow,
      caster: makeCaster('swor', 'lsd'),
      targets: [],
      corpses: [],
      targetX: 108,
      targetY: 100,
    } as any)
    expect(swordOut.executed).toBe(false)
    expect(swordOut.manaSpent256).toBe(0)
    expect(swordOut.missilesSpawned).toEqual([])

    // 4. GameInstance SrvDo003_Throw (0x6FCC2B40) & SrvDo001_Attack (0x6FCC2C40 / D2Common #10709 @ 0x6FDA0D40)
    const makeEquipped = (id: number, code: string, bodyLoc: number, stats: ItemStat[] = []): ItemData => ({
      itemId: id,
      id,
      opcode: 0x9c,
      ownerType: 0,
      ownerId: 1,
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
    })

    const castInGame = (items: ItemData[], skillId: number) => {
      const game = new GameInstance({ seed: 0x1452, difficulty: 0, areaId: 2 })
      const pid = game.connectPlayer({
        d2sBytes: writeD2sSave113c(
          createSampleD2sCharacterData({
            name: 'Thrower',
            charClass: 4,
            level: 30,
            skillLevels: new Uint8Array(30),
            items,
            attributesOverrides: { strength: 100, dexterity: 100, maxManaFixed: 200 * FIXED_ONE, manaFixed: 200 * FIXED_ONE },
          }),
        ),
        x: 100,
        y: 100,
        areaId: 2,
        skills: { 140: 1 },
      })
      game.drainEvents(pid)
      game.enqueueCommand(pid, { type: 'CastSkillAtLocation', skillId, x: 108, y: 100, hand: 'right' })
      game.stepFrames(1)
      return game.drainEvents(pid) as Array<ServerEvent & Record<string, unknown>>
    }

    // Throw (#2) with tkf -> missileId 36 (throwknife); with tax -> 35 (throwaxe); with pil -> 371 (pilum)
    const tkfEvs = castInGame([makeEquipped(101, 'tkf', 4)], 2)
    expect(tkfEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([36])

    const taxEvs = castInGame([makeEquipped(102, 'tax', 4)], 2)
    expect(taxEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([35])

    const pilEvs = castInGame([makeEquipped(103, 'pil', 4)], 2)
    expect(pilEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([371])

    // Unarmed or holding Long Sword (lsd): Throw (#2) emits no SkillCast and no CreateMissile
    const unarmedEvs = castInGame([], 2)
    expect(unarmedEvs.filter((e) => e.type === 'SkillCast' || e.type === 'CreateMissile')).toEqual([])

    const lsdEvs = castInGame([makeEquipped(104, 'lsd', 4)], 2)
    expect(lsdEvs.filter((e) => e.type === 'SkillCast' || e.type === 'CreateMissile')).toEqual([])

    // Ranged Basic Attack (#0) with Bow (sbw -> arrow #0), Crossbow (lxb -> bolt #31), magicarrow (#27), explodingarrow (#41)
    const bowEvs = castInGame([makeEquipped(105, 'sbw', 4)], 0)
    expect(bowEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([0])

    const xbowEvs = castInGame([makeEquipped(106, 'lxb', 4)], 0)
    expect(xbowEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([31])

    const magicArrowEvs = castInGame([makeEquipped(107, 'sbw', 4, [{ statId: 157, param: 0, value: 1 }])], 0)
    expect(magicArrowEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([27])

    const explArrowEvs = castInGame([makeEquipped(108, 'sbw', 4, [{ statId: 158, param: 0, value: 1 }])], 0)
    expect(explArrowEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([41])
  })
})
