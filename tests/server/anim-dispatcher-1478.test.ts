import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { AnimDispatcher } from '../../src/server/engine/anim-dispatcher.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { UnitStatList } from '../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../src/server/engine/world-arena.ts'

describe('Issue #1478: AnimDispatcher and WorldArena 1.13c Parity', () => {
  it('resolves Assassin claw animations to AIA1HT1/HT2 (speed 208) and AIS4HT1/HT2 without falling back to AISCHTH or AIA1HTH', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      level: 80,
      strength: 100,
      dexterity: 100,
      maxmana: 500 * 256,
      mana: 500 * 256,
    })
    const stateBus = new StateBus(stats, registry)

    // Assassin with dual claws ('ht2')
    const dispatcher = new AnimDispatcher({
      registry,
      statList: stats,
      stateBus,
      charToken: 'ai',
      weaponClass: 'ht2',
    })

    const dragonClaw = registry.getSkillById(260)! // Dragon Claw: seqTrans = 'A1'
    const resA1 = dispatcher.startSkillAnimation({
      skill: dragonClaw,
      slvl: 20,
      currentTick: 0,
    })

    expect(resA1.allowed).toBe(true)
    expect(resA1.animState?.cofName).toBe('AIA1HT2')
    expect(resA1.animState?.framesPerDirection).toBe(16) // sequence frames
    // 1.13c parity: AIA1HT2 speed is 208 (not AIA1HTH 256)
    expect(resA1.animState?.animRecord.animationSpeed).toBe(208)
    expect(resA1.animState?.actionFrame).toBe(6)

    // Mode S4 claw attack (e.g. Left Hand Throw or custom S4 finisher)
    const s4Skill = {
      ...dragonClaw,
      anim: 'S4',
      seqTrans: 'S4',
    }
    const resS4 = dispatcher.startSkillAnimation({
      skill: s4Skill,
      slvl: 20,
      currentTick: 0,
    })
    expect(resS4.allowed).toBe(true)
    expect(resS4.animState?.cofName).toBe('AIS4HT2')
    expect(resS4.animState?.framesPerDirection).toBe(12)
    expect(resS4.animState?.animRecord.animationSpeed).toBe(208)
    expect(resS4.animState?.actionFrame).toBe(6)

    // Single claw ('ht1')
    dispatcher.setWeaponClass('ht1')
    const resS4Single = dispatcher.startSkillAnimation({
      skill: s4Skill,
      slvl: 20,
      currentTick: 0,
    })
    expect(resS4Single.allowed).toBe(true)
    expect(resS4Single.animState?.cofName).toBe('AIS4HT1')
    expect(resS4Single.animState?.framesPerDirection).toBe(12)
    expect(resS4Single.animState?.animRecord.animationSpeed).toBe(208)
    expect(resS4Single.animState?.actionFrame).toBe(6)
  })

  it('rejects casting when AnimData record does not exist, eliminating fabricated 14-frame records', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      level: 80,
      maxmana: 500 * 256,
      mana: 500 * 256,
    })
    const stateBus = new StateBus(stats, registry)

    // Assassin with bow trying to cast an S4 attack (AIS4BOW does not exist in AnimData.d2)
    const dispatcher = new AnimDispatcher({
      registry,
      statList: stats,
      stateBus,
      charToken: 'ai',
      weaponClass: 'bow',
    })

    const s4Skill = {
      ...registry.getSkillById(260)!,
      anim: 'S4',
      seqTrans: 'S4',
    }
    const res = dispatcher.startSkillAnimation({
      skill: s4Skill,
      slvl: 20,
      currentTick: 0,
    })

    expect(res.allowed).toBe(false)
  })

  it('triggers action on completion (framesPerDirection - 1) for records with no 0x01/0x02 events', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      level: 80,
      maxmana: 500 * 256,
      mana: 500 * 256,
    })
    const stateBus = new StateBus(stats, registry)

    // Werewolf (token 40) using a skill with anim S1 (40S1HTH has 16 frames, no events)
    stateBus.applyState({ stateNameOrId: 'wolf', slvl: 20, durationFrames: 5000 })
    const dispatcher = new AnimDispatcher({
      registry,
      statList: stats,
      stateBus,
      charToken: 'dz',
      weaponClass: 'hth',
    })

    const dummyS1Skill = {
      ...registry.getSkillById(232)!, // Feral Rage
      anim: 'S1',
      seqTrans: 'S1',
    }

    const res = dispatcher.startSkillAnimation({
      skill: dummyS1Skill,
      slvl: 20,
      currentTick: 0,
    })

    expect(res.allowed).toBe(true)
    expect(res.animState?.cofName).toBe('40S1HTH')
    expect(res.animState?.framesPerDirection).toBe(16)
    expect(res.animState?.animRecord.events).toHaveLength(0)
    // In 1.13c, action triggers at completion (framesPerDirection - 1 = 15), not halfway (8)
    expect(res.animState?.actionFrame).toBe(15)
  })

  it('synchronizes ammo quantity with UnitStatList quantity (stat 70)', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      level: 80,
      maxmana: 500 * 256,
      mana: 500 * 256,
    })
    stats.setBaseStat('quantity', 150)
    const stateBus = new StateBus(stats, registry)

    const dispatcher = new AnimDispatcher({
      registry,
      statList: stats,
      stateBus,
      charToken: 'am',
      weaponClass: 'bow',
    })

    expect(dispatcher.getAmmoQuantity()).toBe(150)

    const strafe = registry.getSkillById(26)! // Strafe: deducts 1 arrow
    const res = dispatcher.startSkillAnimation({
      skill: strafe,
      slvl: 20,
      currentTick: 0,
    })
    expect(res.allowed).toBe(true)

    // Step until action frame fires
    for (let t = 1; t <= 10; t++) {
      dispatcher.tick(t, () => {})
    }

    expect(dispatcher.getAmmoQuantity()).toBe(149)
    expect(stats.getAccruedStat('quantity')).toBe(149)
  })

  it('configures WorldArena Assassin with dual claws (ht2) and throw skills with 1ht', async () => {
    const registry = await getSharedDataRegistry()

    // Assassin WorldArena
    const assArena = new WorldArena({
      registry,
      classCode: 'ass',
      skillId: 260, // Dragon Claw
      slvl: 20,
    })
    expect(assArena.animDispatcher.getWeaponClass()).toBe('HT2')

    // Amazon Poison Javelin (Skill 15, anim = TH)
    const pjArena = new WorldArena({
      registry,
      classCode: 'ama',
      skillId: 15,
      slvl: 20,
    })
    expect(pjArena.animDispatcher.getWeaponClass()).toBe('1HT')
  })
})
