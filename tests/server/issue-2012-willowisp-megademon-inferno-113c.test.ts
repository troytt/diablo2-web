import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { monaiProfile113c } from '../../src/common/units/monai-113c.ts'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monstats-113c-data.ts'
import {
  computeMonsterInfernoChannelParams113c,
  computeMonsterInfernoMissileRange113c,
  evaluateMonsterMissileDamage113c,
} from '../../src/server/ai/monster-missile-damage-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface InternalMonsterView {
  readonly unitId: number
  readonly hcIdx: number
  x: number
  y: number
  skillCooldown: number
  states: Set<number>
  activeBossChannel: { readonly kind: string; remainingFrames: number } | undefined
}

interface InternalMissileView {
  readonly unitId: number
  readonly missileId: number
  readonly skillId: number
  readonly ownerId: number
  readonly physDamage: number
  readonly elemDamage: number
  readonly element: string
  readonly remainingFrames: number
}

describe('Issue #2012: 1.13c WillOWisp MissC/SC lightning & SrvDo095 / Megademon / FrozenHorror Inferno parity', () => {
  it('resolves WillOWisp (#118..121, #639..641, #733) MissC lightning bolts via El2Mode=SC with zero physical damage leak and never casts #53 Chain Lightning', () => {
    const profile = monaiProfile113c('WillOWisp')
    expect(profile.shootDistanceParam).toBe(2)
    expect(profile.fireGate).toEqual({
      hurtParam: 0,
      healthyChanceParam: 0,
      hurtChanceParam: 0,
    })

    const registry = getSharedDataRegistry()
    const rng = new D2Rng(201201)
    const willowispHcIds = [118, 119, 120, 121, 639, 640, 641, 733] as const
    for (const hcIdx of willowispHcIds) {
      const row = MONSTATS_113C_ROWS[hcIdx]!
      expect(row.ai).toBe('WillOWisp')
      const missileName = row.modeMissiles.C ?? row.modeMissiles.MissC
      expect(missileName).toBeDefined()
      const missile = registry.getMissileByName(missileName!)!
      const scRow = row.elementalAttacks.find((e) => e.mode === 'SC')!
      expect(scRow.type).toBe('ltng')

      const evalOut = evaluateMonsterMissileDamage113c({
        registry,
        missile,
        slvl: 1,
        difficulty: 0,
        monsterMinPhys: 0,
        monsterMaxPhys: 0,
        attackMode: 'C',
        elementalAttacks: [
          {
            type: 'mana',
            mode: 'A1',
            chancePct: 80,
            minDamage: 20,
            maxDamage: 70,
            durationFrames: 0,
          },
          {
            type: 'ltng',
            mode: 'SC',
            chancePct: 100,
            minDamage: 5,
            maxDamage: 120,
            durationFrames: 0,
          },
        ],
        rng,
      })
      expect(evalOut.physDamage).toBe(0)
      expect(evalOut.element).toBe('ltng')
      expect(evalOut.elemDamage).toBeGreaterThanOrEqual(5)
      expect(evalOut.elemDamage).toBeLessThanOrEqual(120)
    }

    // Live GameInstance combat verification: willowisp3 (#120) fires #320 willowisplightningbolt (0 phys, >0 ltng) and never #53 Chain Lightning
    const game = new GameInstance({ seed: 201202, areaId: 105, difficulty: 0 })
    game.connectPlayer({
      charClass: 'sor',
      name: 'PlainsSorc',
      x: 28,
      y: 10,
      areaId: 105,
      hp: 5000,
      maxHp: 5000,
    })
    const wispId = game.spawnMonster({
      hcIdx: 120,
      defId: 'willowisp3',
      x: 10,
      y: 10,
      areaId: 105,
      hp: 1000,
      maxHp: 1000,
      aggroRadius: 30,
      velocity: 2,
      runSpeed: 2,
    })
    const missiles = (game as unknown as { missiles: Map<number, InternalMissileView> }).missiles
    const seen = new Map<number, InternalMissileView>()
    for (let f = 0; f < 90; f += 1) {
      game.stepFrames(1)
      for (const m of missiles.values()) {
        if (m.ownerId === wispId && !seen.has(m.unitId)) {
          seen.set(m.unitId, { ...m })
        }
      }
    }
    expect(seen.size).toBeGreaterThan(0)
    for (const m of seen.values()) {
      expect(m.skillId).not.toBe(53)
      expect(m.missileId).toBe(320)
      expect(m.physDamage).toBe(0)
      expect(m.elemDamage).toBeGreaterThan(0)
      expect(m.element).toBe('ltng')
    }
  })

  it('evaluates SKILLS_SetInfernoMissileRange (0x6FCD32E0) and SrvSt53/SrvDo095 channel parameters across all 5 srvDoFunc === 95 skills', () => {
    const registry = getSharedDataRegistry()

    // #178 FetishInferno -> #144 fetishinferno1 (Param2=7, calc2=par1=15, calc3=3)
    const s178 = registry.getSkillById(178)!
    const m144 = registry.getMissileByName(s178.srvMissileA)!
    expect(computeMonsterInfernoMissileRange113c(registry, s178, m144, 4)).toBe(10)
    expect(computeMonsterInfernoMissileRange113c(registry, s178, m144, 11)).toBe(17)
    expect(computeMonsterInfernoChannelParams113c(registry, s178, 4)).toEqual({
      durationFrames: 15,
      stepFrames: 3,
    })

    // #311 mon inferno sentry -> #523 inferno sentry 1 (calc1 = ln34/2 + synergy = 20, calc2 = 15, calc3 = 3)
    const s311 = registry.getSkillById(311)!
    const m523 = registry.getMissileByName(s311.srvMissileA)!
    expect(computeMonsterInfernoMissileRange113c(registry, s311, m523, 5)).toBe(20)
    expect(computeMonsterInfernoChannelParams113c(registry, s311, 5)).toEqual({
      durationFrames: 15,
      stepFrames: 3,
    })

    // #317 Baal Inferno -> #554 baal inferno (raw Range=2048 overridden by Param2=12 + slvl - 1)
    const s317 = registry.getSkillById(317)!
    const m554 = registry.getMissileByName(s317.srvMissileA)!
    expect(m554.range).toBe(2048)
    expect(computeMonsterInfernoMissileRange113c(registry, s317, m554, 1)).toBe(12)
    expect(computeMonsterInfernoMissileRange113c(registry, s317, m554, 8)).toBe(19)
    expect(computeMonsterInfernoChannelParams113c(registry, s317, 1)).toEqual({
      durationFrames: 20,
      stepFrames: 2,
    })

    // #319 MegademonInferno -> #675 megademoninferno (Param2=7, calc2=15, calc3=2)
    const s319 = registry.getSkillById(319)!
    const m675 = registry.getMissileByName(s319.srvMissileA)!
    expect(computeMonsterInfernoMissileRange113c(registry, s319, m675, 5)).toBe(11)
    expect(computeMonsterInfernoMissileRange113c(registry, s319, m675, 9)).toBe(15)
    expect(computeMonsterInfernoChannelParams113c(registry, s319, 9)).toEqual({
      durationFrames: 15,
      stepFrames: 2,
    })

    // #323 Horror Arctic Blast -> #493 frozenhorror arcticblast1 (Param2=7, calc2=15, calc3=2)
    const s323 = registry.getSkillById(323)!
    const m493 = registry.getMissileByName(s323.srvMissileA)!
    expect(computeMonsterInfernoMissileRange113c(registry, s323, m493, 8)).toBe(14)
    expect(computeMonsterInfernoChannelParams113c(registry, s323, 8)).toEqual({
      durationFrames: 15,
      stepFrames: 2,
    })
  })

  it('channels Megademon #319 with exact Param2+slvl-1 range, STATE_INFERNO (12), 2-frame jet stream, and aip6 cooldown, and aborts FrozenHorror #323 on freeze', () => {
    const game = new GameInstance({ seed: 201203, areaId: 108, difficulty: 0 })
    game.connectPlayer({
      charClass: 'sor',
      name: 'SanctuarySorc',
      x: 17, // 7 sub-tiles away (inside slvl=9 reach 11.25)
      y: 10,
      areaId: 108,
      hp: 10000,
      maxHp: 10000,
    })
    const venomId = game.spawnMonster({
      hcIdx: 558,
      defId: 'venomlord',
      x: 10,
      y: 10,
      areaId: 108,
      hp: 2000,
      maxHp: 2000,
      aiParams: [100, 100, 80, 70, 70, 75, 0, 0],
    })
    const monsters = (game as unknown as { monsters: Map<number, InternalMonsterView> }).monsters
    const missiles = (game as unknown as { missiles: Map<number, InternalMissileView> }).missiles
    const venom = monsters.get(venomId)!

    const jetIds = new Set<number>()
    const initialTicks: number[] = []
    let sawInfernoState = false
    let peakCooldown = 0
    for (let f = 0; f < 30; f += 1) {
      game.stepFrames(1)
      if (venom.states.has(12)) sawInfernoState = true
      if (venom.skillCooldown > peakCooldown) peakCooldown = venom.skillCooldown
      for (const m of missiles.values()) {
        if (m.ownerId === venomId && m.missileId === 675 && !jetIds.has(m.unitId)) {
          jetIds.add(m.unitId)
          initialTicks.push(m.remainingFrames)
        }
      }
    }

    // 15-frame channel at stepFrames=2 spawns 8 jets (frames 0, 2, 4, 6, 8, 10, 12, 14), each with rangeFrames=15 (ticksRemaining 14 after first step, never raw Range=30)
    expect(sawInfernoState).toBe(true)
    expect(jetIds.size).toBe(8)
    for (const t of initialTicks) {
      expect(t).toBeLessThanOrEqual(15)
    }
    expect(peakCooldown).toBeGreaterThanOrEqual(74)
    expect(venom.states.has(12)).toBe(false)
    expect(venom.activeBossChannel).toBeUndefined()

    // FrozenHorror (#505) channels #323 Horror Arctic Blast (#493) and immediately aborts when frozen (state 1)
    const iceGame = new GameInstance({ seed: 201204, areaId: 118, difficulty: 0 })
    iceGame.connectPlayer({
      charClass: 'sor',
      name: 'TundraSorc',
      x: 16,
      y: 10,
      areaId: 118,
      hp: 10000,
      maxHp: 10000,
    })
    const horrorId = iceGame.spawnMonster({
      hcIdx: 505,
      defId: 'frozenhorror5',
      x: 10,
      y: 10,
      areaId: 118,
      hp: 2000,
      maxHp: 2000,
      aiParams: [60, 40, 100, 10, 0, 0, 0, 0],
    })
    const iceMonsters = (iceGame as unknown as { monsters: Map<number, InternalMonsterView> }).monsters
    const horror = iceMonsters.get(horrorId)!

    let startedChannel = false
    for (let f = 0; f < 20; f += 1) {
      iceGame.stepFrames(1)
      if (horror.activeBossChannel?.kind === 'monsterinferno') {
        startedChannel = true
        break
      }
    }
    expect(startedChannel).toBe(true)
    expect(horror.states.has(12)).toBe(true)

    iceGame.applyMonsterState(horrorId, 1, 50)
    iceGame.stepFrames(1)
    expect(horror.activeBossChannel).toBeUndefined()
    expect(horror.states.has(12)).toBe(false)
  })
})
