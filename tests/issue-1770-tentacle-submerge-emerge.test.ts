/**
 * Issue #1770 — Act 3 Water Watcher / River Stalker / Stygian Watcher (`TE` / `TN`)
 * 1.13c Submerge (`#176`) & Emerge (`#180`) State Machine, DRLG `MonPlace` Water Pool Spawns,
 * Submerged Untargetability & Invulnerability, Shore-to-Water Melee Reach (`UNITS_IsInMeleeRange`),
 * Death Blood Ripple (`Overlay #157`), and 734-Monster Class-of-Bug Sweep (`FrogDemon` / `SandMaggot`).
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveMonsterSequenceFrame113c } from '../src/common/path/monster-anim-metrics-113c.ts'
import { isInMeleeRange113c } from '../src/common/skills/weapon-combat-meta.ts'
import {
  isMonsterSubmergedMode113c,
  resolveMonPlacePreset113c,
  shouldFreezeMonsterSequenceAtEnd113c,
} from '../src/common/units/monai-113c.ts'
import { getInnateMonsterDeathOverlays } from '../src/common/units/monster-death-fx.ts'
import { OnlineSession } from '../src/client/session/online-session.ts'
import { buildSceneDrawables } from '../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../src/client/world/client-world.ts'
import { STATIONARY_AI_SET } from '../src/server/ai/monster-ai.ts'
import { GameInstance } from '../src/server/engine/game-instance.ts'
import {
  buildAreaBootstrap,
  createAreaBootstrapResolver,
} from '../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry } from '../src/netproto/index.ts'

/**
 * Builds a synthetic shoreline + water-pool geometry matching Act 3 DS1 water pool masks:
 * - Shoreline `x < 24`: open walkable floor (`collision = 0x0000`, `blocked = 0`)
 * - Water pool `x >= 24`: `COLLIDE_WALL` (`collision = 0x0001`, `blocked = 1`), no `0x0804` missile/flying barrier.
 */
function buildShoreWaterPoolGeometry(areaId: number, monPlaceIndex = 810): LocalAreaLevelGeometry {
  const w = 48
  const h = 48
  const blocked = new Uint8Array(w * h)
  const collision = new Uint16Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 24; x < w; x++) {
      const idx = y * w + x
      blocked[idx] = 1
      collision[idx] = 0x0001 // COLLIDE_WALL water mask (passable by flying/aquatic & missiles)
    }
  }
  return {
    areaId,
    originX: 0,
    originY: 0,
    subWidth: w,
    subHeight: h,
    blocked,
    collision,
    spawnTileX: 2,
    spawnTileY: 4,
    rooms: [{ areaId, tileX: 0, tileY: 0 }],
    roomRects: [{ index: 0, x: 0, y: 0, w, h, seed: 0x1770 }],
    presetUnits: [
      // MonPlace #10 (`place_tentacle_ns` -> presetIndex 810) at water pool center (28, 24), 4 subtiles from shore x=23
      { type: 1, index: monPlaceIndex, mode: 0, subX: 28, subY: 24 },
    ],
    warps: [],
  }
}

function findPackedTilesDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public/act-packs/tiles'),
    path.resolve(process.cwd(), '../../public/act-packs/tiles'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'drlg-bundle.json'))) {
      return dir
    }
  }
  return null
}

/**
 * DRLG preset monsters spawn when their room is activated by a nearby player (D2Game 0x6FC4CBE0 ->
 * 0x6FD01430): walk the player through every room of the area so all pools are populated.
 */
function activateAllRooms(game: GameInstance, playerId: number, areaId: number): void {
  const g = game as unknown as {
    players: Map<number, { x: number; y: number }>
    loadedAreas: Map<number, { roomRects: readonly { x: number; y: number; w: number; h: number }[] }>
    activatePresetRoomsNearPlayer113c: (p: unknown) => void
  }
  const p = g.players.get(playerId)!
  const x0 = p.x
  const y0 = p.y
  for (const r of g.loadedAreas.get(areaId)?.roomRects ?? []) {
    p.x = r.x + Math.floor(r.w / 2)
    p.y = r.y + Math.floor(r.h / 2)
    g.activatePresetRoomsNearPlayer113c(p)
  }
  p.x = x0
  p.y = y0
}

describe('Issue #1770 — 1.13c Tentacle / TentacleHead Submerge-Emerge State Machine & Class Sweep', () => {
  it('resolves MonPlace water pool presets (D2Game 0x6FC67E6D) across Travincal (83), Jungle (76..78), and Sewers (92..93)', () => {
    expect(STATIONARY_AI_SET.has('Tentacle')).toBe(false)
    expect(STATIONARY_AI_SET.has('TentacleHead')).toBe(false)

    // Travincal (83) -> tentaclehead1 (261) + tentacle1 (258)
    expect(resolveMonPlacePreset113c(10, 83)).toEqual({
      classId: 261,
      companionClassId: 258,
      direction: 4,
    })
    expect(resolveMonPlacePreset113c(11, 83)).toEqual({
      classId: 261,
      companionClassId: 258,
      direction: 0,
    })

    // Spider Forest / Great Marsh / Flayer Jungle (76..78) -> tentaclehead2 (262) + tentacle2 (259)
    for (const areaId of [76, 77, 78]) {
      expect(resolveMonPlacePreset113c(10, areaId)).toEqual({
        classId: 262,
        companionClassId: 259,
        direction: 4,
      })
    }

    // Kurast Sewers Level 1 & 2 (92, 93) -> tentaclehead3 (263) + tentacle3 (260)
    for (const areaId of [92, 93]) {
      expect(resolveMonPlacePreset113c(11, areaId)).toEqual({
        classId: 263,
        companionClassId: 260,
        direction: 0,
      })
    }

    // Sweep of other deterministic MonPlace presets in 0x6FC67E6D
    expect(resolveMonPlacePreset113c(4, 2)?.classId).toBe(266) // Flavie (navi)
    expect(resolveMonPlacePreset113c(5, 17)?.classId).toBe(267) // Blood Raven
    expect(resolveMonPlacePreset113c(8, 64)?.classId).toBe(284) // Coldworm / Sand Maggot Queen
    expect(resolveMonPlacePreset113c(23, 78)?.classId).toBe(278) // Fetish Shaman
    expect(resolveMonPlacePreset113c(30, 110)?.classId).toBe(492) // Bloody Foothills Overlord
    expect(resolveMonPlacePreset113c(30, 111)?.classId).toBe(529) // Death Mauler
    expect(resolveMonPlacePreset113c(0, 1)).toBeNull()
  })

  it('spawns submerged TentacleHead + 4..6 Tentacle limbs on real DRLG Travincal (83) and Kurast Sewers Level 2 (93) water pools', async () => {
    const packedDir = findPackedTilesDir()
    if (!packedDir) return

    await import('../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import('../src/client/map/map-service-area-source.ts')
    const svc = await MapService.fromPackedDir(packedDir)
    const resolver = createAreaBootstrapResolver(createMapServiceAreaLevelSource(svc))

    // Verify Travincal (areaId 83 -> tentaclehead1 261 + tentacle1 258)
    const game83 = new GameInstance({
      seed: 0x177083,
      difficulty: 0,
      act: 2,
      areaId: 83,
      resolveAreaBootstrap: resolver,
    })
    const pal83 = game83.connectPlayer({ charClass: 'pal', name: 'ShorePal', areaId: 83 })
    activateAllRooms(game83, pal83, 83)
    const mons83 = game83.listMonsters(83)
    const heads83 = mons83.filter((m) => m.hcIdx === 261)
    const limbs83 = mons83.filter((m) => m.hcIdx === 258)
    expect(heads83.length).toBeGreaterThan(0)
    expect(limbs83.length).toBeGreaterThanOrEqual(heads83.length * 4)
    expect(limbs83.length).toBeLessThanOrEqual(heads83.length * 6)
    for (const m of [...heads83, ...limbs83]) {
      expect(m.mode).toBe(14)
      expect(m.submerged).toBe(true)
    }

    // Verify Kurast Sewers Level 2 (areaId 93 -> tentaclehead3 263 + tentacle3 260)
    const game93 = new GameInstance({
      seed: 0x177093,
      difficulty: 0,
      act: 2,
      areaId: 93,
      resolveAreaBootstrap: resolver,
    })
    const sor93 = game93.connectPlayer({ charClass: 'sor', name: 'SewerSor', areaId: 93 })
    activateAllRooms(game93, sor93, 93)
    const mons93 = game93.listMonsters(93)
    const heads93 = mons93.filter((m) => m.hcIdx === 263)
    const limbs93 = mons93.filter((m) => m.hcIdx === 260)
    expect(heads93.length).toBeGreaterThan(0)
    expect(limbs93.length).toBeGreaterThanOrEqual(heads93.length * 4)
    expect(limbs93.length).toBeLessThanOrEqual(heads93.length * 6)
    for (const m of [...heads93, ...limbs93]) {
      expect(m.mode).toBe(14)
      expect(m.submerged).toBe(true)
    }
  }, 60_000)

  it('enforces submerged untargetability/invulnerability, proximity #180 Emerge, shore melee reach, death blood ripple (#157), and disengage #176 Submerge', () => {
    const geo = buildShoreWaterPoolGeometry(83, 810)
    const boot = buildAreaBootstrap(geo)
    expect(boot.monsters.some((m) => m.classId === 261)).toBe(true)

    const sim = new GameInstance({
      seed: 0x1770,
      difficulty: 0,
      act: 2,
      areaId: 83,
      resolveAreaBootstrap: createAreaBootstrapResolver(() => geo),
    })
    const pid = sim.connectPlayer({
      charClass: 'sor',
      name: 'Tester',
      x: 10,
      y: 24,
      areaId: 83,
      level: 30,
      hp: 5000,
      maxHp: 5000,
      mana: 5000,
      maxMana: 5000,
      ar: 50000,
      strength: 250,
      dexterity: 200,
      skills: { 36: 20, 42: 20, 48: 20 },
    })
    const world = new ClientWorld()
    world.setCollisionChecker((x) => x >= 24)
    let clientNow = 1000
    const pumpEvents = (frames: number): void => {
      for (let f = 0; f < frames; f++) {
        sim.stepFrames(1)
        clientNow += 40
        const evs = sim.drainEvents(pid)
        for (const ev of evs) {
          world.applyEvent(ev, clientNow)
        }
        world.tick(40, clientNow)
      }
    }
    for (const ev of sim.drainEvents(pid)) {
      world.applyEvent(ev, clientNow)
    }

    const allMons = sim.listMonsters(83)
    const head = allMons.find((m) => m.hcIdx === 261)!
    const limbs = allMons.filter((m) => m.hcIdx === 258)
    expect(head).toBeDefined()
    expect(limbs.length).toBeGreaterThanOrEqual(4)
    expect(head.submerged).toBe(true)
    expect(head.mode).toBe(14)

    // 1. Pre-submerged client state: mode=14, calm underwater at s1 frame 0 (NOT frame 20), and noSel=true!
    const clientHead = world.getUnit('monster', head.unitId)!
    expect(clientHead.mode).toBe(14)
    const initialDrawables = buildSceneDrawables({ units: [clientHead], elapsedMs: clientNow })
    const headDrawable0 = initialDrawables.unitDrawables[0]!
    expect(headDrawable0.noSel).toBe(true)
    expect(headDrawable0.isSel).toBe(false)
    const initialSeqStep = resolveMonsterSequenceFrame113c(
      headDrawable0.classId,
      Math.max(0, clientNow - (headDrawable0.animStartedAtMs ?? clientNow)),
      headDrawable0.animStepSpeed256 ?? 256,
      headDrawable0.castState?.skillId ?? headDrawable0.lastSkillId,
    )
    expect(initialSeqStep).toMatchObject({ clipKey: 's1', frameIndex: 0 })

    // 2. While submerged (player at dist 18 > aip6=12), direct attack, missile (#36 Fire Bolt), and AoE (#48 Nova / #42 Static Field) deal 0 damage!
    const startHeadHp = head.hp
    sim.enqueueCommand(pid, {
      type: 'CastSkillOnTarget',
      hand: 'left',
      skillId: 0,
      targetType: 'monster',
      targetId: head.unitId,
    })
    sim.enqueueCommand(pid, {
      type: 'CastSkillAtLocation',
      hand: 'right',
      skillId: 36,
      x: head.x,
      y: head.y,
    })
    sim.enqueueCommand(pid, {
      type: 'CastSkillAtLocation',
      hand: 'right',
      skillId: 48,
      x: head.x,
      y: head.y,
    })
    pumpEvents(15)
    expect(sim.getMonster(head.unitId)!.hp).toBe(startHeadHp)
    expect(sim.getMonster(head.unitId)!.submerged).toBe(true)

    const movePlayerTo = (nx: number, ny: number): void => {
      const p = (sim as any).players.get(pid)
      p.x = nx
      p.y = ny
      p.targetX = nx
      p.targetY = ny
      p.path = []
      world.applyEvent({ type: 'ReassignPlayer', unitId: pid, x: nx, y: ny }, clientNow)
    }

    // 3. Approach shoreline (x=23, y=24 -> dist 5 < aip6=12 across water mask 0x0001): triggers #180 Emerge (mode 8 -> mode 1)!
    movePlayerTo(23, 24)

    let sawEmergeCast = false
    for (let i = 0; i < 20; i++) {
      sim.stepFrames(1)
      clientNow += 40
      for (const ev of sim.drainEvents(pid)) {
        if (ev.type === 'SkillCast' && ev.caster.id === head.unitId && (ev.skillId ?? ev.skill) === 180) {
          sawEmergeCast = true
        }
        world.applyEvent(ev, clientNow)
      }
      world.tick(40, clientNow)
      if (sawEmergeCast) break
    }
    expect(sawEmergeCast).toBe(true)
    expect(sim.getMonster(head.unitId)!.submerged).toBe(false)
    expect(clientHead.mode).toBe(8) // MONMODE_SKILL1 (Emerge S1 0 -> 20)
    // Client head stays anchored inside the water pool at (28, 24) (never drifted onto shore)!
    expect(Math.round(clientHead.x)).toBe(28)
    expect(Math.round(clientHead.y)).toBe(24)

    // Finish Emerge animation -> transitions to surfaced Neutral (mode 1) / Attack1 (mode 4 tentaclegoo #139)
    let sawTentacleGoo = false
    for (let i = 0; i < 45; i++) {
      sim.stepFrames(1)
      clientNow += 40
      for (const ev of sim.drainEvents(pid)) {
        if (ev.type === 'CreateMissile' && ev.missileClassId === 139) {
          sawTentacleGoo = true
        }
        world.applyEvent(ev, clientNow)
      }
      world.tick(40, clientNow)
    }
    expect(sawTentacleGoo).toBe(true)
    expect(Math.round(clientHead.x)).toBe(28)
    expect(Math.round(clientHead.y)).toBe(24)
    const surfacedDrawable = buildSceneDrawables({ units: [clientHead], elapsedMs: clientNow }).unitDrawables[0]!
    expect(surfacedDrawable.noSel).not.toBe(true)

    // 4. Shore-to-water melee reach (D2Common 0x6FD826FE: dist < weaponRangeAdder + 8 without wall block):
    // Player at shore (23, 24) vs head in water (28, 24): water tiles 24..28 are blocked in collisionChecker,
    // yet both `isInMeleeRange113c` and `world.isTargetInSelfMeleeRange` allow melee against 261 while rejecting normal fallen (19)!
    expect(
      isInMeleeRange113c(23, 24, 2, 28, 24, 2, 0, false, (x) => x >= 24, 261),
    ).toBe(true)
    expect(
      isInMeleeRange113c(23, 24, 2, 28, 24, 2, 0, false, (x) => x >= 24, 19),
    ).toBe(false)
    expect(world.isTargetInSelfMeleeRange(clientHead, 23, 24)).toBe(true)

    // Strike surfaced TentacleHead from shore -> deals real melee damage without needing to enter water!
    const hpBeforeShoreStrike = sim.getMonster(head.unitId)!.hp
    for (let attempt = 0; attempt < 5; attempt++) {
      sim.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        hand: 'left',
        skillId: 0,
        targetType: 'monster',
        targetId: head.unitId,
      })
      pumpEvents(2)
      if (sim.getMonster(head.unitId)!.hp < hpBeforeShoreStrike) break
      pumpEvents(8)
    }
    expect(sim.getMonster(head.unitId)!.hp).toBeLessThan(hpBeforeShoreStrike)
    expect(sim.getMonster(head.unitId)!.hp).toBeGreaterThan(0)

    // 5. Disengage back to x=5 (dist 23 > aip6=12) and advance past aip4*25 (300 frames): casts #176 Submerge -> freezes at s1 frame 0!
    movePlayerTo(5, 24)
    let sawSubmergeCast = false
    for (let i = 0; i < 340; i++) {
      sim.stepFrames(1)
      clientNow += 40
      for (const ev of sim.drainEvents(pid)) {
        if (ev.type === 'SkillCast' && ev.caster.id === head.unitId && (ev.skillId ?? ev.skill) === 176) {
          sawSubmergeCast = true
        }
        world.applyEvent(ev, clientNow)
      }
      world.tick(40, clientNow)
      if (sawSubmergeCast) break
    }
    expect(sawSubmergeCast).toBe(true)
    expect(sim.getMonster(head.unitId)!.submerged).toBe(true)
    expect(clientHead.mode).toBe(14)

    // At t+0ms of #176 Submerge, sequence starts at s1 frame 20 (surfaced head) and sinks smoothly to s1 frame 0!
    const sinkStartStep = resolveMonsterSequenceFrame113c(261, 0, 256, 176)
    expect(sinkStartStep).toMatchObject({ clipKey: 's1', frameIndex: 20 })

    // Advance 150 frames (6,000ms — well past castState expiry!) and verify client stays frozen in mode 14 at s1 frame 0 & noSel=true!
    pumpEvents(150)
    expect(clientHead.castState).toBeUndefined()
    expect(clientHead.mode).toBe(14)
    const reSubmergedDrawable = buildSceneDrawables({ units: [clientHead], elapsedMs: clientNow }).unitDrawables[0]!
    expect(reSubmergedDrawable.noSel).toBe(true)
    const frozenStep = resolveMonsterSequenceFrame113c(
      261,
      Math.max(0, clientNow - (reSubmergedDrawable.animStartedAtMs ?? clientNow)),
      reSubmergedDrawable.animStepSpeed256 ?? 256,
      reSubmergedDrawable.castState?.skillId ?? reSubmergedDrawable.lastSkillId,
    )
    expect(frozenStep).toMatchObject({ clipKey: 's1', frameIndex: 0 })

    // 6. Re-approach after submerge cooldown (aip3*25 = 400 frames), kill TentacleHead, verify Overlay #157 & 40% limb death cascade!
    pumpEvents(300)
    movePlayerTo(23, 24)
    pumpEvents(35)
    expect(sim.getMonster(head.unitId)!.submerged).toBe(false)

    // Innate death overlay #157 (`tentacleheadbloodripple`) is registered for all 258..263
    for (let cid = 258; cid <= 263; cid++) {
      expect(getInnateMonsterDeathOverlays(cid)).toContain('tentacleheadbloodripple')
    }

    // Kill the surfaced TentacleHead from shore and verify cascading limb deaths (`AiTentacle` 0x6FC9CB41)
    ;(sim as any).players.get(pid).strength = 20000
    for (let attempt = 0; attempt < 8; attempt++) {
      ;(sim as any).players.get(pid).hitRecoveryUntilFrame = 0
      sim.enqueueCommand(pid, {
        type: 'CastSkillOnTarget',
        hand: 'left',
        skillId: 0,
        targetType: 'monster',
        targetId: head.unitId,
      })
      pumpEvents(4)
      if (sim.getMonster(head.unitId)!.hp <= 0) break
    }
    expect(sim.getMonster(head.unitId)!.hp).toBeLessThanOrEqual(0)
    expect(clientHead.overlays.some((o) => o.token === 'tentacleheadbloodripple')).toBe(true)

    pumpEvents(120)
    const deadLimbs = limbs.filter((l) => (sim.getMonster(l.unitId)?.hp ?? 0) <= 0)
    expect(deadLimbs.length).toBe(limbs.length)
  })

  it('class-of-bug sweep: preserves mode 14 sequence freeze & untargetability for FrogDemon (#176) and SandMaggot (#162 MagottDown vs #161 MagottUp)', () => {
    expect(shouldFreezeMonsterSequenceAtEnd113c(247, 176)).toBe(true)
    expect(shouldFreezeMonsterSequenceAtEnd113c(258, 176)).toBe(true)
    expect(shouldFreezeMonsterSequenceAtEnd113c(261, 176)).toBe(true)
    expect(shouldFreezeMonsterSequenceAtEnd113c(68, 162)).toBe(true)
    expect(shouldFreezeMonsterSequenceAtEnd113c(284, 162)).toBe(true)
    expect(shouldFreezeMonsterSequenceAtEnd113c(68, 161)).toBe(false)
    expect(isMonsterSubmergedMode113c(68, 14, 162)).toBe(true)
    expect(isMonsterSubmergedMode113c(68, 14, 161)).toBe(false)

    const world = new ClientWorld()
    let now = 2000
    // Spawn Swamp Dweller (247) & Sand Maggot (68)
    world.applyEvent(
      {
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 501, classId: 247, x: 20, y: 20, mode: 1, lifePct: 128 },
      },
      now,
    )
    world.applyEvent(
      {
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 502, classId: 68, x: 24, y: 20, mode: 1, lifePct: 128 },
      },
      now,
    )

    // Cast #176 Submerge on FrogDemon & #162 MagottDown on SandMaggot
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 'monster', id: 501 },
        skill: 176,
        skillId: 176,
        level: 1,
        target: { x: 20, y: 20 },
      },
      now,
    )
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 'monster', id: 502 },
        skill: 162,
        skillId: 162,
        level: 1,
        target: { x: 24, y: 20 },
      },
      now,
    )

    // Step 60 ticks (2,400ms -> past castState expiry)
    for (let i = 0; i < 60; i++) {
      now += 40
      world.tick(40, now)
    }

    const frog = world.getUnit('monster', 501)!
    const maggot = world.getUnit('monster', 502)!
    expect(frog.castState).toBeUndefined()
    expect(maggot.castState).toBeUndefined()
    expect(frog.mode).toBe(14)
    expect(maggot.mode).toBe(14)
    expect(maggot.lastSkillId).toBe(162)

    const drawables = buildSceneDrawables({ units: [frog, maggot], elapsedMs: now }).unitDrawables
    expect(drawables[0]!.noSel).toBe(true)
    expect(drawables[1]!.noSel).toBe(true)
    const maggotStep = resolveMonsterSequenceFrame113c(
      68,
      Math.max(0, now - (drawables[1]!.animStartedAtMs ?? now)),
      drawables[1]!.animStepSpeed256 ?? 256,
      drawables[1]!.castState?.skillId ?? drawables[1]!.lastSkillId,
    )
    expect(maggotStep).toMatchObject({ clipKey: 's1', frameIndex: 0 })

    // Now cast #161 MagottUp on SandMaggot -> after sequence expires, reverts cleanly to surfaced mode 1!
    world.applyEvent(
      {
        type: 'SkillCast',
        caster: { unitType: 'monster', id: 502 },
        skill: 161,
        skillId: 161,
        level: 1,
        target: { x: 24, y: 20 },
      },
      now,
    )
    for (let i = 0; i < 60; i++) {
      now += 40
      world.tick(40, now)
    }
    expect(maggot.mode).toBe(1)
    const surfacedMaggotDrawable = buildSceneDrawables({ units: [maggot], elapsedMs: now }).unitDrawables[0]!
    expect(surfacedMaggotDrawable.noSel).not.toBe(true)
  })

  it('OnlineSession.buildRenderableUnits & CommandMapper reject submerged TentacleHead/SandMaggot hover & skill targeting until #180/#161 Emerge', () => {
    const session = new OnlineSession()
    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 3,
        name: 'ShorePal',
        x: 5000,
        y: 5000,
        mode: 1,
        lifePct: 128,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 2610,
        classId: 261,
        name: 'tentaclehead1',
        x: 5002,
        y: 5000,
        mode: 14,
        lifePct: 128,
      },
    })
    session.handleServerEvent({
      type: 'UnitAssign',
      unit: {
        unitType: 'monster',
        id: 680,
        classId: 68,
        name: 'sandmaggot1',
        x: 5002,
        y: 5002,
        mode: 1,
        lifePct: 128,
      },
    })
    // Burrow SandMaggot via #162 MagottDown
    session.handleServerEvent({
      type: 'SkillCast',
      caster: { unitType: 'monster', id: 680 },
      skill: 162,
      skillId: 162,
      level: 1,
      target: { x: 5002, y: 5002 },
    })
    for (let t = 1; t <= 40; t++) {
      session.tick(40, t * 40)
    }

    const headUnit = session.world.getUnit('monster', 2610)!
    const maggotUnit = session.world.getUnit('monster', 680)!
    expect(headUnit.mode).toBe(14)
    expect(maggotUnit.mode).toBe(14)
    expect(maggotUnit.lastSkillId).toBe(162)

    // Even if hoveredUnit was somehow pre-set, buildRenderableUnits forces isHovered: false, isSel: false, noSel: true
    session.commandMapper.setHoveredUnit(headUnit)
    const submergedUnits = session.buildRenderableUnits(1600)
    const headRenderable = submergedUnits.find((u) => u.id === 2610)!
    const maggotRenderable = submergedUnits.find((u) => u.id === 680)!
    expect(headRenderable.isHovered).toBe(false)
    expect(headRenderable.isSel).toBe(false)
    expect(headRenderable.noSel).toBe(true)
    expect(maggotRenderable.noSel).toBe(true)
    expect(maggotRenderable.lastSkillId).toBe(162)

    // CommandMapper rejects submerged monsters for direct attack (0), Zeal (106), and Fist of the Heavens (121)
    expect(session.commandMapper.isValidSkillTargetUnit(headUnit, 0)).toBe(false)
    expect(session.commandMapper.isValidSkillTargetUnit(headUnit, 106)).toBe(false)
    expect(session.commandMapper.isValidSkillTargetUnit(headUnit, 121)).toBe(false)
    expect(session.commandMapper.isValidSkillTargetUnit(maggotUnit, 0)).toBe(false)
    expect(session.commandMapper.findNearestValidMeleeTarget(5002, 5000, 0)).toBeNull()
    expect(session.commandMapper.findNearestMonsterForTargetableOnlySkill(5002, 5000, 121)).toBeNull()

    // Cast #180 Emerge on TentacleHead -> becomes selectable & targetable immediately
    session.handleServerEvent({
      type: 'SkillCast',
      caster: { unitType: 'monster', id: 2610 },
      skill: 180,
      skillId: 180,
      level: 1,
      target: { x: 5000, y: 5000 },
    })
    session.commandMapper.setHoveredUnit(headUnit)
    const emergingUnits = session.buildRenderableUnits(1640)
    const emergingHead = emergingUnits.find((u) => u.id === 2610)!
    expect(emergingHead.isHovered).toBe(true)
    expect(emergingHead.noSel).toBeUndefined()
    expect(session.commandMapper.isValidSkillTargetUnit(headUnit, 0)).toBe(true)
    expect(session.commandMapper.findNearestValidMeleeTarget(5002, 5000, 0)?.id).toBe(2610)
    expect(session.commandMapper.findNearestMonsterForTargetableOnlySkill(5002, 5000, 121)?.id).toBe(2610)

    session.destroy()
  })
})
