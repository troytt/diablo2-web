/**
 * #829 — S2C 0xA3 (24 B; D2Client handler 0x6fb5efb0, D2Game builder 0x6fc9a190 / serializer
 * 0x6fcaba90): `u8 flag, i16 skill, i16 level, u8 casterType, u32 casterId, u8 targetType,
 * u32 targetId, u32 x, u32 y`. It runs the skill's Skills.txt `cltprgfunc1`; Thunder Storm's
 * fn #84 is the only caller of ForceLightning.
 */

import { describe, expect, it } from 'vitest'
import { decodeD2gsS2cPacket } from '../../src/netproto/d2gs/registry.ts'
import { encode0xA3AuraSkill, serverEventToS2cPackets } from '../../src/netproto/index.ts'
import { GameEngine } from '../../src/server/engine/game-engine.ts'

/** Thunder Storm (57) level 20 by player 1 on monster 42. */
const STRIKE = Uint8Array.from([
  0xa3, 0x00, 0x39, 0x00, 0x14, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x2a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
])

describe('S2C 0xA3 UnitSkillEvent', () => {
  it('decodes the 1.13c layout', () => {
    expect(decodeD2gsS2cPacket(STRIKE)).toEqual({
      type: 'UnitSkillEvent',
      flag: 0,
      skill: 57,
      level: 20,
      caster: { rawUnitType: 0, id: 1 },
      target: { rawUnitType: 1, id: 42 },
      x: 0,
      y: 0,
    })
  })

  it('encodes the 24-byte 1.13c layout (D2Game 0x6fc9a190 + 0x6fcaba90) and round-trips via serverEventToS2cPackets', () => {
    const ev = {
      type: 'UnitSkillEvent' as const,
      flag: 0,
      skill: 57,
      level: 20,
      caster: { rawUnitType: 0, id: 1 },
      target: { rawUnitType: 1, id: 42 },
      x: 0,
      y: 0,
    }
    const encoded = encode0xA3AuraSkill(ev)
    expect(encoded).toEqual(STRIKE)
    expect(serverEventToS2cPackets(ev)).toEqual([STRIKE])
    expect(decodeD2gsS2cPacket(encoded)).toEqual(ev)
  })

  it('is no longer a SkillCast (the old layout read casterId 1310777, skill 256, level 0, x 256)', () => {
    const ev = decodeD2gsS2cPacket(STRIKE)
    expect(ev.type).not.toBe('SkillCast')
    expect(ev).not.toHaveProperty('caster.id', 1310777)
  })

  it('sign-extends skill and level (movsx 0x6fb5f008 / 0x6fb5f069), keeps raw unit types and full u32 x / y', () => {
    const p = new Uint8Array(24)
    const dv = new DataView(p.buffer)
    p[0] = 0xa3
    p[1] = 0x7f
    dv.setInt16(2, -1, true)
    dv.setInt16(4, -2, true)
    p[6] = 9
    dv.setUint32(7, 0xfffffffe, true)
    p[11] = 200
    dv.setUint32(12, 7, true)
    dv.setUint32(16, 0x12345678, true)
    dv.setUint32(20, 0x9abcdef0, true)
    expect(decodeD2gsS2cPacket(p)).toEqual({
      type: 'UnitSkillEvent',
      flag: 0x7f,
      skill: -1,
      level: -2,
      caster: { rawUnitType: 9, id: 0xfffffffe },
      target: { rawUnitType: 200, id: 7 },
      x: 0x12345678,
      y: 0x9abcdef0,
    })
  })

  it('offline GameEngine emits S2C 0xA3 UnitSkillEvent on Thunder Storm strike in wilderness and suppresses strike in town (0x6fc62510)', () => {
    const idleInput = {
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    }

    const engine = new GameEngine('sor')
    engine.world.monsters.push({
      index: 42,
      x: engine.world.player.x + 100,
      y: engine.world.player.y,
      hp: 500,
      maxHp: 500,
      state: 'idle',
      cooldown: 0,
      stats: {
        id: 'fallen1',
        name: 'Fallen',
        maxHp: 500,
        speed: 0,
        damage: 1,
        reach: 32,
        aggroRadius: 0,
        attackCooldownTicks: 25,
        xp: 10,
      },
    } as any)

    engine.world.player.thunderstormTicks = 100
    engine.world.player.thunderstormInterval = 41
    engine.world.player.thunderstormNextStrike = 1
    engine.world.player.thunderstormDamage = 75
    engine.world.player.thunderstormSlvl = 20

    // In town (0x6fc62510): no strike and no S2C 0xA3
    engine.isTown = true
    engine.tick(idleInput)
    expect(engine.world.monsters[0]!.hp).toBe(500)
    expect(engine.world.events.find((e) => e.kind === 'unitSkillEvent')).toBeUndefined()

    // In wilderness: strikes monster 42 and emits 24-byte S2C 0xA3 packet
    engine.isTown = false
    engine.world.player.thunderstormNextStrike = 1
    engine.tick(idleInput)
    expect(engine.world.monsters[0]!.hp).toBe(425)
    const skillEv = engine.world.events.find((e) => e.kind === 'unitSkillEvent')
    expect(skillEv).toBeDefined()
    expect(skillEv!.packet0xA3).toEqual(STRIKE)
    expect(decodeD2gsS2cPacket(skillEv!.packet0xA3!)).toEqual({
      type: 'UnitSkillEvent',
      flag: 0,
      skill: 57,
      level: 20,
      caster: { rawUnitType: 0, id: 1 },
      target: { rawUnitType: 1, id: 42 },
      x: 0,
      y: 0,
    })
  })
})
