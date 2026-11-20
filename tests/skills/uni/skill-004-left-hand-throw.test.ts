/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #004: Left Hand Throw (UNI)
 * Gitea Tracking Issue: #158
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import type { ItemData, ItemStat, ServerEvent } from '../../../src/netproto/index.ts'
import { GameInstance } from '../../../src/server/engine/game-instance.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { writeD2sSave113c } from '../../../src/server/save/d2s-writer.ts'
import { skillModule } from '../../../src/server/skills/impl/uni/skill-004-left-hand-throw.ts'
import { evaluateSkill113c, executeSkill113c } from '../../../src/server/skills/registry.ts'
import { createSampleD2sCharacterData } from '../../e2e/server-reuse/helpers.ts'

describe('[Skill #004] Left Hand Throw (UNI) — 1.13c Parity (Issue #158)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(4)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(4)
    expect(skillModule.name).toBe("Left Hand Throw")
    expect(skillModule.charClass).toBe("uni")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(4, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(0)
    expect(r1.manaCost256).toBe(0)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(4, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(0)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(4, 20)
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
    const skillRec = registry.getSkillById(4)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(4, 20)
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
    statsSoftOnly.setBaseSkillLevel(4, 20)
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
      skillId: 4,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(4)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('#1452: D2Game SrvDo005_LeftHandThrow (0x6FCC2A40) — resolves left-arm weapon missiletype (#10321) and refuses when left hand is not throwable', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(4)!
    const statList = new UnitStatList(registry, { level: 30 })
    statList.setBaseSkillLevel(4, 1)

    const evalLht = evaluateSkill113c({ registry, skill: skillRec, slvl: 1, blvl: 1, statList })
    expect(evalLht.missileA).toBe('')

    // Right hand has a Long Sword ('lsd'), Left hand has a Throwing Knife ('tkf') -> Left Hand Throw (#4) launches 'throwknife'
    const outTkf = executeSkill113c({
      registry,
      skill: skillRec,
      evalResult: evalLht,
      caster: {
        id: '1',
        name: 'LeftCaster',
        unitType: 'player' as const,
        charClass: 'bar',
        statList,
        stateBus: new StateBus(statList, registry),
        x: 100,
        y: 100,
        weaponItemType: 'swor',
        weaponCode: 'lsd',
        offHandWeaponCode: 'tkf',
        weaponMinPhys: 10,
        weaponMaxPhys: 20,
      },
      targets: [],
      corpses: [],
      targetX: 108,
      targetY: 100,
    } as any)
    expect(outTkf.executed).toBe(true)
    expect(outTkf.missilesSpawned).toEqual(['throwknife'])

    // Right hand has 'tkf', Left hand has 'lsd' (non-throwable) -> Left Hand Throw (#4) must be refused!
    const outSwordLeft = executeSkill113c({
      registry,
      skill: skillRec,
      evalResult: evalLht,
      caster: {
        id: '1',
        name: 'LeftCaster',
        unitType: 'player' as const,
        charClass: 'bar',
        statList,
        stateBus: new StateBus(statList, registry),
        x: 100,
        y: 100,
        weaponItemType: 'tkni',
        weaponCode: 'tkf',
        offHandWeaponCode: 'lsd',
        weaponMinPhys: 10,
        weaponMaxPhys: 20,
      },
      targets: [],
      corpses: [],
      targetX: 108,
      targetY: 100,
    } as any)
    expect(outSwordLeft.executed).toBe(false)
    expect(outSwordLeft.missilesSpawned).toEqual([])

    // GameInstance verification for Left Hand Throw (#4) and Double Throw (#140)
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
      const game = new GameInstance({ seed: 0x1454, difficulty: 0, areaId: 2 })
      const pid = game.connectPlayer({
        d2sBytes: writeD2sSave113c(
          createSampleD2sCharacterData({
            name: 'LeftThrower',
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

    // bodyLoc 4 = right arm (lsd), bodyLoc 5 = left arm (tax -> missileId 35)
    const lhtTaxEvs = castInGame(
      [makeEquipped(201, 'lsd', 4), makeEquipped(202, 'tax', 5)],
      4,
    )
    expect(lhtTaxEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([35])

    // bodyLoc 4 = right arm (tkf -> 36), bodyLoc 5 = left arm (lsd -> non-throwable): Left Hand Throw (#4) refused
    const lhtRefusedEvs = castInGame(
      [makeEquipped(203, 'tkf', 4), makeEquipped(204, 'lsd', 5)],
      4,
    )
    expect(lhtRefusedEvs.filter((e) => e.type === 'SkillCast' || e.type === 'CreateMissile')).toEqual([])

    // Double Throw (#140) with right arm tkf (36) + left arm glv (37) -> launches [36, 37]
    const dtMixedEvs = castInGame(
      [
        makeEquipped(205, 'tkf', 4),
        makeEquipped(206, 'glv', 5),
      ],
      140,
    )
    expect(dtMixedEvs.filter((e) => e.type === 'CreateMissile').map((e) => e.missileClassId)).toEqual([36, 37])
  })
})
