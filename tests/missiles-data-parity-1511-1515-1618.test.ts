import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { evaluateMissileUnitHit113c, NEXT_DELAY_STATE_ID_113C } from '../src/client/world/world-missile-stepper.ts'
import { MISSILE_CLT_COLS_113C, missileCltColsByName113c } from '../src/common/skills/missile-clt-cols-113c.ts'
import { CANONICAL_113C_MISSILES, getMissileTxtData } from '../src/common/skills/missiles-data.ts'

describe('Missiles 1.13c Data, Lifetime, Collision & Hit Dispatch Parity (#1511-#1515, #1618)', () => {
  it('#1618: all 684 rows of CANONICAL_113C_MISSILES match MISSILE_CLT_COLS_113C client columns', () => {
    const entries = Object.values(CANONICAL_113C_MISSILES)
    expect(entries.length).toBe(684)
    expect(MISSILE_CLT_COLS_113C.length).toBe(684)

    for (const c of MISSILE_CLT_COLS_113C) {
      const m = CANONICAL_113C_MISSILES[c.name]!
      expect(m).toBeDefined()
      expect(m.id).toBe(c.id)
      expect(m.name).toBe(c.name)
      expect(m.pCltDoFunc ?? 0).toBe(c.pCltDoFunc)
      expect(m.pCltHitFunc ?? 0).toBe(c.pCltHitFunc)
      expect(m.cltSubMissile1 ?? '').toBe(
        c.cltSubMissile[0] >= 0 ? MISSILE_CLT_COLS_113C[c.cltSubMissile[0]]?.name ?? '' : '',
      )
      expect(m.cltSubMissile2 ?? '').toBe(
        c.cltSubMissile[1] >= 0 ? MISSILE_CLT_COLS_113C[c.cltSubMissile[1]]?.name ?? '' : '',
      )
      expect(m.cltSubMissile3 ?? '').toBe(
        c.cltSubMissile[2] >= 0 ? MISSILE_CLT_COLS_113C[c.cltSubMissile[2]]?.name ?? '' : '',
      )
      expect(m.cltHitSubMissile1 ?? '').toBe(
        c.cltHitSubMissile[0] >= 0 ? MISSILE_CLT_COLS_113C[c.cltHitSubMissile[0]]?.name ?? '' : '',
      )
      expect(m.cltHitSubMissile2 ?? '').toBe(
        c.cltHitSubMissile[1] >= 0 ? MISSILE_CLT_COLS_113C[c.cltHitSubMissile[1]]?.name ?? '' : '',
      )
      expect(m.cltHitSubMissile3 ?? '').toBe(
        c.cltHitSubMissile[2] >= 0 ? MISSILE_CLT_COLS_113C[c.cltHitSubMissile[2]]?.name ?? '' : '',
      )
      expect(m.cltHitSubMissile4 ?? '').toBe(
        c.cltHitSubMissile[3] >= 0 ? MISSILE_CLT_COLS_113C[c.cltHitSubMissile[3]]?.name ?? '' : '',
      )
      expect([
        m.cltParam1 ?? 0,
        m.cltParam2 ?? 0,
        m.cltParam3 ?? 0,
        m.cltParam4 ?? 0,
        m.cltParam5 ?? 0,
      ]).toEqual(c.cltParam)
      expect([m.cHitPar1 ?? 0, m.cHitPar2 ?? 0, m.cHitPar3 ?? 0]).toEqual(c.cHitPar)
      expect(m.range).toBe(c.range)
      expect(m.levRange).toBe(c.levRange)
      expect(m.animLen).toBe(c.animLen)
      expect(m.subLoop ?? 0).toBe(c.subLoop)
      expect(m.subStart ?? 0).toBe(c.subStart)
      expect(m.subStop ?? 0).toBe(c.subStop)
      expect(m.randStart ?? 0).toBe(c.randStart)
      expect(m.explosionMissile).toBe(
        c.explosionMissile >= 0 ? MISSILE_CLT_COLS_113C[c.explosionMissile]?.name ?? '' : '',
      )
    }
  })

  it('#1511: exposes ClientSend, Town, SrcTown, CltSrcTown, InitSteps, Activate, LocalBlood on CANONICAL_113C_MISSILES', () => {
    const entries = Object.values(CANONICAL_113C_MISSILES)
    const cltSrcTownRows = entries.filter((m) => (m.cltSrcTown ?? 0) > 0)
    expect(cltSrcTownRows.length).toBe(14)

    const localBloodRows = entries.filter((m) => (m.localBlood ?? 0) > 0)
    expect(localBloodRows.length).toBe(24)

    const world = new ClientWorld()
    const m = world.spawnMissileByKey('glacialspike', 10, 10, 15, 10)
    expect(m.clientInitStepsFlag).toBe(true)
    expect(m.initSteps).toBe(getMissileTxtData('glacialspike')?.initSteps ?? 0)
  })

  it('#1512: exposes CollideType, Collision, ClientCol, CollideKill, LastCollide, NextHit, NextDelay & evaluates 0x6FB61420 unit hits', () => {
    const shockwave = getMissileTxtData('shockwave')!
    expect(shockwave.nextHit).toBe(1)
    expect(shockwave.nextDelay).toBeGreaterThan(0)

    const row = {
      ...missileCltColsByName113c('shockwave')!,
      activate: 3,
      lastCollide: true,
      collideKill: 1,
    }

    const resultPending = evaluateMissileUnitHit113c(row, {
      ageTicks: 1,
      isFriendlyTarget: false,
      targetHasNextDelayState: false,
      lastCollideUnitId: undefined,
      targetUnitId: 42,
    })
    expect(resultPending.canCollide).toBe(false)

    const resultHit = evaluateMissileUnitHit113c(row, {
      ageTicks: 3,
      isFriendlyTarget: false,
      targetHasNextDelayState: false,
      lastCollideUnitId: undefined,
      targetUnitId: 42,
    })
    expect(resultHit).toEqual({
      canCollide: true,
      applyNextDelayFrames: row.nextDelay,
      recordLastCollide: true,
      destroyOnUnitHit: true,
    })

    const resultBlockedByNextDelay = evaluateMissileUnitHit113c(row, {
      ageTicks: 4,
      isFriendlyTarget: false,
      targetHasNextDelayState: true,
      lastCollideUnitId: 42,
      targetUnitId: 42,
    })
    expect(resultBlockedByNextDelay.canCollide).toBe(false)
    expect(NEXT_DELAY_STATE_ID_113C).toBe(86)
  })

  it('#1513: exposes xoffset, yoffset, zoffset on Missiles.txt rows (#664, #665, #193, #329) and spawned ClientUnit', () => {
    const m664 = CANONICAL_113C_MISSILES[MISSILE_CLT_COLS_113C[664]!.name]!
    const m665 = CANONICAL_113C_MISSILES[MISSILE_CLT_COLS_113C[665]!.name]!
    const m193 = CANONICAL_113C_MISSILES[MISSILE_CLT_COLS_113C[193]!.name]!
    const m329 = CANONICAL_113C_MISSILES[MISSILE_CLT_COLS_113C[329]!.name]!
    expect(m664.yoffset).toBe(-10)
    expect(m665.yoffset).toBe(-15)
    expect(m193.zoffset).toBe(-30)
    expect(m329.zoffset).toBe(-30)

    const world = new ClientWorld()
    const u664 = world.spawnMissileByKey(m664.name, 10, 10, 12, 10)
    expect(u664.yoffset).toBe(-10)
    const u193 = world.spawnMissileByKey(m193.name, 10, 10, 12, 10)
    expect(u193.zoffset).toBe(-30)
  })

  it('#1514: implements D2Client 0x6FB63408..0x6FB63488 lifetime formula (subLoopCount, rangePct, startFrameOffset)', () => {
    const world = new ClientWorld()
    // sanctuarycenter: range=125, levRange=0, subLoop=1, subStart=10, subStop=30
    const baseBolt = world.spawnMissileByKey('sanctuarycenter', 10, 10, 15, 10, { skillLevel: 1 })
    const scaledBolt = world.spawnMissileByKey('sanctuarycenter', 10, 10, 15, 10, {
      skillLevel: 1,
      subLoopCount: 2,
      rangePct: -20,
      startFrameOffset: 5,
    })
    // Base range = 125; + 2 * (30 - 10) = 165; + Math.trunc(165 * -20 / 100) = 132; - 5 = 127
    expect(baseBolt.maxTicks).toBe(125)
    expect(scaledBolt.maxTicks).toBe(127)
  })

  it('#1515: desertfireball (#283, pCltHitFunc = 11 -> NULL in 1.13c) falls through to ExplosionMissile = explodingarrowexp', () => {
    const row = missileCltColsByName113c('desertfireball')!
    expect(row.id).toBe(283)
    expect(row.pCltHitFunc).toBe(11)

    const world = new ClientWorld()
    const dfb = world.spawnMissileByKey('desertfireball', 10, 10, 15, 10)
    ;(world as any).triggerMissileImpact(dfb, 12, 10, true)

    const units = Array.from((world as any)._units.values()) as any[]
    const explosion = units.find((u) => u.missileKey === 'explodingarrowexp')
    expect(explosion).toBeDefined()
  })
})
