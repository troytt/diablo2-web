import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { decode0x0CNpcGetHit } from '../../src/netproto/d2gs/s2c/units.ts'

/** Raw S2C 0x0C NPCGetHit (9B): `[0x0C, unitType=1, id u32, cmd=0x13, hitClass, life]`. */
function npcGetHitPacket(id: number, hitClass: number, life: number): Uint8Array {
  const pkt = new Uint8Array(9)
  pkt[0] = 0x0c
  pkt[1] = 1
  new DataView(pkt.buffer).setUint32(2, id >>> 0, true)
  pkt[6] = 0x13
  pkt[7] = hitClass
  pkt[8] = life
  return pkt
}

function setup(classId: number, id: number): { world: ClientWorld; boss: ClientUnit } {
  const world = new ClientWorld()
  const boss = new ClientUnit({ unitType: 'monster', id, classId, x: 100, y: 100, mode: 1, direction: 0 })
  ;(world as any)._units.set(boss.key, boss)
  ;(world as any)._monsters.set(boss.id, boss)
  const player = new ClientUnit({ unitType: 'player', id: 1, classId: 1, x: 106, y: 100, mode: 1, direction: 0 })
  ;(world as any)._units.set(player.key, player)
  ;(world as any).selfId = 1
  return { world, boss }
}

function countMissiles(world: ClientWorld, key: string): number {
  let n = 0
  for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
    if (u.unitType === 'missile' && u.missileKey === key) n++
  }
  return n
}

function hit(world: ClientWorld, boss: ClientUnit, nowMs: number): void {
  world.applyEvent(decode0x0CNpcGetHit(npcGetHitPacket(boss.id, 1, 90)), nowMs)
}

describe('S2C 0x0C NPCGetHit keeps channeled boss skills running (D2Client 0x6FB5F5F0 -> cmd 0x13 @ 0x6FAFE14D)', () => {
  it('Diablo #193 DiabLight keeps its castState, mode, anim start and bolt stream across repeated hits', () => {
    const { world, boss } = setup(243, 801)
    ;(world as any).applySkillCastToUnit(boss, 193, 112, 100, 3, true, 1000)
    const cast = boss.castState
    expect(cast?.skillId).toBe(193)
    const castMode = boss.mode
    const animStart = boss.animStartedAtMs

    for (let t = 0; t < 12; t++) (world as any).stepDiscreteSimulationTick()
    const before = countMissiles(world, 'diablight')
    expect(before).toBeGreaterThan(0)

    for (let t = 0; t < 10; t++) {
      hit(world, boss, 1500 + t * 40)
      expect(boss.castState).toBe(cast)
      expect(boss.mode).toBe(castMode)
      expect(boss.animStartedAtMs).toBe(animStart)
      ;(world as any).stepDiscreteSimulationTick()
    }
    // One diablight bolt per channel tick keeps flowing through the hits.
    expect(countMissiles(world, 'diablight')).toBe(before + 10)
    // cmd 0x13 (0x6FAFE14D): `life = pkt[8] & 0x7F; if (life > 1) life += 1` -> 90 becomes 91.
    expect(boss.lifePct).toBe(91)
  })

  it('Baal #317 Baal Inferno (Mana Rift) keeps its castState and anim start across hits', () => {
    const { world, boss } = setup(544, 802)
    ;(world as any).applySkillCastToUnit(boss, 317, 112, 100, 1, true, 1000)
    const cast = boss.castState
    expect(cast?.skillId).toBe(317)
    const castMode = boss.mode
    const animStart = boss.animStartedAtMs
    for (let t = 0; t < 5; t++) {
      hit(world, boss, 1100 + t * 40)
      ;(world as any).stepDiscreteSimulationTick()
      expect(boss.castState).toBe(cast)
      expect(boss.mode).toBe(castMode)
      expect(boss.animStartedAtMs).toBe(animStart)
    }
  })

  it('a damage-only hit on a monster in A2 does not respawn its MissA2 (quillrat1 #63 -> spike1)', () => {
    const { world, boss } = setup(63, 803)
    boss.mode = 5
    for (let t = 0; t < 3; t++) hit(world, boss, 1000 + t * 40)
    let missiles = 0
    for (const u of (world as any)._units.values() as Iterable<ClientUnit>) {
      if (u.unitType === 'missile') missiles++
    }
    expect(missiles).toBe(0)
  })
})
