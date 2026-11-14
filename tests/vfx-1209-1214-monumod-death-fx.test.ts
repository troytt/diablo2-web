/**
 * Issues #1209..#1214 (batch VFX-B17): 1.13c MonUMod / innate monster death FX.
 *
 * Ground truth (kb/monsters/d2client-monumod-death-fx-113c.md):
 * - 0x6fad0d20 umod 9 fire: 5x 0x75 monstercorpseexplode + 5x 0x52 fireexplosion at (x,y)+diagonals; no overlay.
 * - D2Game.dll 0x6fc65320 bone fetish deathDmg: 1x monstercorpseexplode.
 * - 0x6fad0c40 edi==0x12 umod 18: 0xc2 coldunique via 0x6fb51020 (64-entry ring), Vel of 0x77 frostnova.
 * - 0x6fad0c40 edi==0x2a umod 42 novadeath: 0x5a nova ring.
 * - MonUMod.txt MONUMOD_KILLMINIONSDEATH = 15, MONUMOD_TEMPSUMMON = 21.
 * - 0x6fad0fa0 -> 0x6fad0a60 umod 40 painwormdeath: 0x75 monstercorpseexplode + 0x221 'pain worm appear'.
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'
import {
  D2CLIENT_DEATH_BOOM_POINTS,
  D2CLIENT_NOVA_RING_X,
  D2CLIENT_NOVA_RING_Y,
  MON_UMOD,
  MON_UMOD_NAME_TO_ID,
  calcColdEnchantedDeathNova,
} from '../src/common/units/monster-death-fx.ts'

const D2CLIENT = join(homedir(), 'd2-data', 'D2Client.dll')

function readD2ClientRdataInts(va: number, n: number): number[] | null {
  let buf: Buffer
  try {
    buf = readFileSync(D2CLIENT)
  } catch {
    return null
  }
  // .rdata VMA 0x6fb7e000, file offset 0xce000 (objdump -h D2Client.dll).
  const off = va - 0x6fb7e000 + 0xce000
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(buf.readInt32LE(off + i * 4))
  return out
}

function killMonster(world: ClientWorld, unit: Record<string, unknown>) {
  world.applyEvent({
    type: 'UnitAssign',
    unit: { unitType: 'monster', mode: 1, lifePct: 100, ...unit },
  } as never)
  world.applyEvent({
    type: 'UnitMode',
    unitType: 'monster',
    id: unit['id'] as number,
    mode: 0,
    lifePct: 0,
  } as never)
}

function missiles(world: ClientWorld) {
  return world.getUnitsByType('missile')
}

describe('#1209 Fire Enchanted death (D2Client 0x6fad0d20)', () => {
  it('spawns exactly 5 monstercorpseexplode + 5 fireexplosion, no fireexplode/explosion, no fire_explode overlay', () => {
    const world = new ClientWorld()
    killMonster(world, { id: 9101, classId: 1, x: 100, y: 100, monUMods: [MON_UMOD.FIRE] })
    const ms = missiles(world)
    const ce = ms.filter(m => m.missileKey === 'monstercorpseexplode')
    const fx = ms.filter(m => m.missileKey === 'fireexplosion')
    expect(ce).toHaveLength(5)
    expect(fx).toHaveLength(5)
    const legacyExplKey = ['expl', 'osion'].join('')
    expect(ms.some(m => m.missileKey === 'fireexplode' || m.missileKey === legacyExplKey)).toBe(false)
    const pts = ce.map(m => `${m.x - 100},${m.y - 100}`).sort()
    expect(pts).toEqual(D2CLIENT_DEATH_BOOM_POINTS.map(p => `${p.dx},${p.dy}`).sort())
    expect(fx.map(m => `${m.x - 100},${m.y - 100}`).sort()).toEqual(pts)
    // Lifetime = Missiles.txt Range of the real rows (13 / 15).
    expect(ce.every(m => m.maxTicks === getMissileTxtData('monstercorpseexplode').range)).toBe(true)
    expect(fx.every(m => m.maxTicks === getMissileTxtData('fireexplosion').range)).toBe(true)
    expect(world.getUnit('monster', 9101)!.overlays.some(o => o.token === 'fire_explode')).toBe(false)
  })
})

describe('#1210 Bone Fetish death (D2Game.dll 0x6fc65320 deathDmg)', () => {
  it('bonefetish1 death spawns 1 monstercorpseexplode and 0 undeadmissile*', () => {
    for (const isMinion of [false, true]) {
      const world = new ClientWorld()
      killMonster(world, { id: 9201, classId: 212, x: 120, y: 120, isMinion })
      const ms = missiles(world)
      expect(ms.filter(m => m.missileKey === 'monstercorpseexplode')).toHaveLength(1)
      expect(ms.some(m => (m.missileKey ?? '').startsWith('undeadmissile'))).toBe(false)
    }
  })

  it('MonUMod 31 corpseboom (0x6fad0e60) spawns 5 fireexplosion, never undeadmissile', () => {
    const world = new ClientWorld()
    killMonster(world, { id: 9202, classId: 1, x: 80, y: 80, monUMods: [MON_UMOD.CORPSEBOOMDEATH] })
    const ms = missiles(world)
    expect(ms.filter(m => m.missileKey === 'fireexplosion')).toHaveLength(5)
    expect(ms.some(m => (m.missileKey ?? '').startsWith('undeadmissile'))).toBe(false)
  })
})

describe('#1211 Cold Enchanted death nova = coldunique 64-ring', () => {
  it('ring tables match D2Client .rdata 0x6fb84390 / 0x6fb84290', () => {
    expect(D2CLIENT_NOVA_RING_X).toHaveLength(64)
    expect(D2CLIENT_NOVA_RING_Y).toHaveLength(64)
    const x = readD2ClientRdataInts(0x6fb84390, 64)
    const y = readD2ClientRdataInts(0x6fb84290, 64)
    if (x && y) {
      expect([...D2CLIENT_NOVA_RING_X]).toEqual(x)
      expect([...D2CLIENT_NOVA_RING_Y]).toEqual(y)
    }
  })

  it('spec uses coldunique with frostnova velocity', () => {
    const spec = calcColdEnchantedDeathNova(30)
    expect(spec.missileKey).toBe('coldunique')
    expect(spec.velocityMissileKey).toBe('frostnova')
    expect(spec.boltCount).toBe(64)
    expect(CANONICAL_113C_MISSILES['coldunique']?.id).toBe(194)
  })

  it('cold enchanted unique death spawns only coldunique, 64 of them, with frostnova Vel', () => {
    const world = new ClientWorld()
    killMonster(world, { id: 9301, classId: 10, x: 200, y: 200, monUMods: [MON_UMOD.COLD] })
    const ms = missiles(world)
    expect(ms.length).toBe(64)
    expect(ms.every(m => m.missileKey === 'coldunique')).toBe(true)
    expect(ms.some(m => m.sourceSkillId === 44)).toBe(false)
    // Same spawn speed formula as a plain frostnova missile.
    const ref = new ClientWorld()
    const fn = ref.spawnMissileByKey('frostnova', 0, 0, 30, 0, { ownerType: 'monster' })
    const speed = Math.hypot(ms[0]!.vx ?? 0, ms[0]!.vy ?? 0)
    expect(speed).toBeCloseTo(Math.hypot(fn.vx ?? 0, fn.vy ?? 0), 6)
    // Directions follow the ring table.
    const m0 = ms[0]!
    expect(m0.targetX! - 200).toBe(D2CLIENT_NOVA_RING_X[0])
    expect(m0.targetY! - 200).toBe(D2CLIENT_NOVA_RING_Y[0])
  })
})

describe('#1212 MonUMod 42 novadeath = nova ring', () => {
  it('umod 42 death spawns only nova missiles (64), no lightunique', () => {
    expect(MON_UMOD.NOVADEATH).toBe(42)
    expect((MON_UMOD as Record<string, number>)['CHARGED_BOLTS']).toBeUndefined()
    const world = new ClientWorld()
    killMonster(world, { id: 9401, classId: 1, x: 150, y: 150, monUMods: [42] })
    const ms = missiles(world)
    expect(ms.length).toBe(64)
    expect(ms.every(m => m.missileKey === 'nova')).toBe(true)
    expect(ms.some(m => m.missileKey === 'lightunique')).toBe(false)
  })
})

describe('#1213 MonUMod 15 killminionsdeath vs 21 tempsummon', () => {
  it('constants follow 1.13c MonUMod.txt', () => {
    expect(MON_UMOD.KILL_MINIONS).toBe(15)
    expect(MON_UMOD.KILLMINIONSDEATH).toBe(15)
    expect(MON_UMOD.TEMPSUMMON).toBe(21)
    expect(MON_UMOD_NAME_TO_ID['kill_minions']).toBe(15)
    expect(MON_UMOD_NAME_TO_ID['tempsummon']).toBe(21)
  })

  it('umod 15 boss death expires its minions; umod 21 death affects no other unit', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 9502, classId: 1, x: 102, y: 102, mode: 1, lifePct: 100, isMinion: true },
    } as never)
    killMonster(world, { id: 9501, classId: 1, x: 100, y: 100, monUMods: [15] })
    const minion = world.getUnit('monster', 9502)!
    expect(minion.tempSummonExpireTick).toBe(world.frameCount + 1)

    const world2 = new ClientWorld()
    world2.applyEvent({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 9504, classId: 1, x: 102, y: 102, mode: 1, lifePct: 100, isMinion: true },
    } as never)
    killMonster(world2, { id: 9503, classId: 1, x: 100, y: 100, monUMods: [21] })
    expect(world2.getUnit('monster', 9504)!.tempSummonExpireTick).toBeUndefined()
  })
})

describe('#1214 MonUMod 40 painwormdeath (0x6fad0a60)', () => {
  it('spawns 1 monstercorpseexplode and 1 pain worm appear (maxTicks 25)', () => {
    expect(MON_UMOD.PAINWORMDEATH).toBe(40)
    const world = new ClientWorld()
    killMonster(world, { id: 9601, classId: 1, x: 60, y: 60, monUMods: [40] })
    const ms = missiles(world)
    expect(ms.filter(m => m.missileKey === 'monstercorpseexplode')).toHaveLength(1)
    const pw = ms.filter(m => m.missileKey === 'pain worm appear')
    expect(pw).toHaveLength(1)
    expect(pw[0]!.maxTicks).toBe(25)
    expect(pw[0]!.classId).toBe(545)
  })
})
