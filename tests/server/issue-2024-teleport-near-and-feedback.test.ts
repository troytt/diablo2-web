/**
 * Issue #2024: 1.13c Ground-Truth Sorceress `#54 Teleport` Near-Click Displacement,
 * Cursor Snap Fix, 136-Level `Levels.txt` `Teleport` Sweep & Zero-Mana-Burn Failure Feedback.
 *
 * Ground Truth (`D2Game.dll`, `D2Common.dll`, `D2Client.dll`, `Levels.txt` / `Levels.bin`, `Skills.txt`):
 * - `SKILLS_SrvDo027_Teleport` (`0x6FC63450`): reads `Levels.bin[+0x04]` (`Teleport`: `0` on `Id=0`,
 *   `2` exclusively on `Id=73` Duriel's Lair requiring `0x804` missile/door barrier LOS, `1` on the
 *   other 135 levels `1..72, 74..136`; Towns `1, 40, 75, 103, 109` forbid `#54 Teleport` via
 *   `Skills.txt` `InTown = 0` + `DUNGEON_IsRoomInTown`).
 * - `DUNGEON_TeleportUnitToRoomAndCoords` (`0x6FD019C0`) -> `COLLISION_FindFreePositionSimple`
 *   (`0x6FD9D840` -> `0x6FD9D140`, `wMask = 0x1C09`): `(curX, curY)` has `COLLIDE_PLAYER` stamped
 *   and living monsters have `COLLIDE_MONSTER` (`0x0800`) stamped, so Teleport never lands at
 *   `(curX, curY)` (`0` displacement) and breaks ring ties by Manhattan distance (`|dx| + |dy|`).
 * - Pre-cast validation rejects unwalkable void (>5 sub-tiles), `Teleport === 2` wall/closed-door
 *   barriers, forbidden levels, and completely boxed-in cells BEFORE spending mana or locking
 *   `AnimDispatcher` windup, emitting `PlaySound` (`sound: 19` `impossible1`, or `24` `notInTown1`).
 * - `CommandMapper`: plays `<class>_not_in_town_1` (`eventCode = 24`, 3000ms cooldown) on fresh
 *   non-`InTown` right-click / Quick Cast in town, preserves cursor `subtileX/Y` over `Alt` ground
 *   item label boxes, and never snaps non-`TargetItem` `SkillAt` casts onto hovered items/objects.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_NODE_MPQ_DIR, mountNodeArchives } from '../../src/baker/mpq-archive-source.ts'
import { PLAYER_SOUND_TABLE_0x6FBA7694 } from '../../src/client/audio/d2gs-play-sound-113c.ts'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { SkillHotkeysHud } from '../../src/client/ui/hotkeys.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { cell, parseTable } from '../../src/common/world/acts.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  LEVEL_TELEPORT_LOS_REQUIRED_IDS_113C,
  TOWN_AREAS,
  getLevelTeleportMode113c,
} from '../../src/server/engine/game-instance/constants-and-helpers.ts'

type AnyRecord = Record<string, any>

function internal(game: GameInstance): AnyRecord {
  return game as unknown as AnyRecord
}

describe('Issue #2024: 136-Level Levels.txt / Levels.bin Teleport Sweep', () => {
  it('matches authentic 1.13c Levels.txt and Levels.bin[+0x04] across all 137 rows (0..136)', async () => {
    const source = await mountNodeArchives(DEFAULT_NODE_MPQ_DIR)
    const rawTxt = await source.readBytes('data\\global\\excel\\levels.txt')
    const rawBin = await source.readBytes('data\\global\\excel\\levels.bin')
    const table = parseTable(rawTxt)
    const binView = new DataView(rawBin.buffer, rawBin.byteOffset, rawBin.byteLength)
    const binCount = binView.getInt32(0, true)
    const binStride = (rawBin.byteLength - 4) / binCount
    expect(binCount).toBe(137)

    const txtModeById = new Map<number, number>()
    for (const row of table.rows) {
      const idStr = cell(table, row, 'Id').trim()
      if (!/^\d+$/.test(idStr)) continue
      const id = Number(idStr)
      if (id < 0 || id > 136) continue
      const teleRaw = cell(table, row, 'Teleport').trim()
      txtModeById.set(id, teleRaw === '' ? 0 : Number(teleRaw))
    }
    expect(txtModeById.size).toBe(137)

    for (let id = 0; id <= 136; id++) {
      const txtVal = txtModeById.get(id)
      const binVal = rawBin[4 + id * binStride + 4]!
      expect(txtVal).toBe(binVal)
      expect(getLevelTeleportMode113c(id)).toBe(binVal)
    }

    expect(getLevelTeleportMode113c(-1)).toBe(0)
    expect(getLevelTeleportMode113c(0)).toBe(0)
    expect(getLevelTeleportMode113c(137)).toBe(0)
    expect([...LEVEL_TELEPORT_LOS_REQUIRED_IDS_113C]).toEqual([73])
    expect(getLevelTeleportMode113c(73)).toBe(2)
    // Arreat Summit (120), Throne/Worldstone (131..132), and Uber Tristram (136) all have Teleport=1 in 1.13c!
    for (const allowedSpecialArea of [120, 131, 132, 133, 134, 135, 136]) {
      expect(getLevelTeleportMode113c(allowedSpecialArea)).toBe(1)
    }
  })

  it('forbids #54 Teleport in all 5 towns (InTown=0) with PlaySound(24) & 0 mana spent, while allowing Teleport=1 across walls in Areas 120 & 136', () => {
    for (const townId of TOWN_AREAS) {
      const game = new GameInstance({ seed: 202400 + townId, areaId: townId, animActionWindup: true })
      const p1 = game.connectPlayer({
        charClass: 'sor',
        name: 'TownSorc',
        level: 24,
        areaId: townId,
        x: 60,
        y: 60,
        skills: { 54: 5 },
      })
      const g = internal(game)
      const player = g.players.get(p1) as AnyRecord
      player.manaFixed = 300 * 256
      player.maxManaFixed = 300 * 256
      game.drainEvents(p1)

      game.enqueueCommand(p1, {
        type: 'CastSkillAtLocation',
        skillId: 54,
        x: 70,
        y: 70,
        hand: 'right',
      })
      game.stepFrames(1)
      const events = game.drainEvents(p1)
      expect(player.x).toBe(60)
      expect(player.y).toBe(60)
      expect(player.manaFixed).toBe(300 * 256)
      expect(events.some((e) => e.type === 'WalkVerify')).toBe(true)
      expect(
        events.some(
          (e) =>
            e.type === 'PlaySound' &&
            e.sound === 24 &&
            e.unit?.unitType === 0 &&
            e.unit?.id === p1,
        ),
      ).toBe(true)
    }

    for (const areaId of [120, 136]) {
      const game = new GameInstance({ seed: 202450 + areaId, areaId })
      game.setTerrainWalkableCheck((_a, x, y) => {
        // Wall strip at x === 65; Teleport === 1 crosses walls freely.
        if (Math.round(x) === 65) return false
        return x >= 0 && x <= 120 && y >= 0 && y <= 120
      })
      const p1 = game.connectPlayer({
        charClass: 'sor',
        name: 'SummitUberSorc',
        level: 80,
        areaId,
        x: 50,
        y: 50,
        skills: { 54: 10 },
      })
      const player = internal(game).players.get(p1) as AnyRecord
      player.manaFixed = 300 * 256
      player.maxManaFixed = 300 * 256

      game.enqueueCommand(p1, {
        type: 'CastSkillAtLocation',
        skillId: 54,
        x: 80,
        y: 50,
        hand: 'right',
      })
      game.stepFrames(12)
      expect(Math.round(player.x)).toBe(80)
      expect(Math.round(player.y)).toBe(50)
    }
  })
})

describe('Issue #2024: Near-Click, Obstacle-Fallback & Monster-Occupied Minimum Displacement (>= 1 subtile)', () => {
  it('always displaces >= 1 subtile when clicking own subtile, fractional feet offset, adjacent obstacle, or adjacent monster', () => {
    const game = new GameInstance({ seed: 202402, areaId: 2 })
    game.setTerrainWalkableCheck((_areaId, x, y) => {
      const rx = Math.round(x)
      const ry = Math.round(y)
      if (rx < 0 || rx > 200 || ry < 0 || ry > 200) return false
      // Solid pillar cluster at x in [51..53], y === 50 right next to (50, 50)
      if (rx >= 51 && rx <= 53 && ry === 50) return false
      return true
    })
    const p1 = game.connectPlayer({
      charClass: 'sor',
      name: 'NearTeleSorc',
      level: 30,
      areaId: 2,
      x: 100,
      y: 100,
      skills: { 54: 10 },
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.manaFixed = 500 * 256
    player.maxManaFixed = 500 * 256

    // 1. Exact same-subtile click (100, 100) with no prior facing -> projects +1 along default (0, 1) to (100, 101)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 100,
      y: 100,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(100)
    expect(Math.round(player.y)).toBe(101)

    // 2. Fractional near-click rounding to current subtile (100.35, 100.65 -> rounds to 100, 101; delta (+0.35, -0.35))
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 100.35,
      y: 100.65,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(101)
    expect(Math.round(player.y)).toBe(100)

    // 3. Teleport west to (80, 100), then click exact own subtile (80, 100) -> steps 1 subtile further west to (79, 100)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 80,
      y: 100,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(80)
    expect(Math.round(player.y)).toBe(100)

    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 80,
      y: 100,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.round(player.x)).toBe(79)
    expect(Math.round(player.y)).toBe(100)

    // 4. Obstacle-fallback near player: player at (50, 50), clicks onto pillar at (52, 50).
    //    Must NEVER fall back to (50, 50) (0 displacement); lands on adjacent walkable cell (52, 49) or (52, 51)!
    g.movePlayer(p1, 50, 50)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 52,
      y: 50,
      hand: 'right',
    })
    game.stepFrames(12)
    expect(Math.hypot(Math.round(player.x) - 50, Math.round(player.y) - 50)).toBeGreaterThanOrEqual(1)
    expect(Math.round(player.x)).toBe(52)
    expect([49, 51]).toContain(Math.round(player.y))

    // 5. Monster-occupied subtile both via CastSkillAtLocation and CastSkillOnTarget:
    //    Player at (70, 70), Fallen standing at (71, 70) -> avoids both (70, 70) and (71, 70), landing on free neighbor!
    g.movePlayer(p1, 70, 70)
    const monId = game.spawnMonster({
      defId: 'fallen1',
      x: 71,
      y: 70,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      aiDisabled: true,
    })
    game.enqueueCommand(p1, {
      type: 'CastSkillOnTarget',
      skillId: 54,
      targetType: 'monster',
      targetId: monId,
      hand: 'right',
    })
    game.stepFrames(12)
    const landedX = Math.round(player.x)
    const landedY = Math.round(player.y)
    expect(landedX === 70 && landedY === 70).toBe(false)
    expect(landedX === 71 && landedY === 70).toBe(false)
    expect(Math.abs(landedX - 71) + Math.abs(landedY - 70)).toBe(1)
  })
})

describe('Issue #2024: Zero-Mana-Burn Pre-Validation, No Cast-Lock & PlaySound(19) Feedback + Oculus CtC Isolation', () => {
  it('spends 0 mana, does not lock AnimDispatcher windup, and emits PlaySound(19) on void, Area 73 barrier, and boxed-in failures', () => {
    // 1. Deep void & boxed-in 1x1 island with animActionWindup = true
    let boxedIn = false
    const game = new GameInstance({ seed: 202403, areaId: 2, animActionWindup: true })
    game.setTerrainWalkableCheck((_areaId, x, y) => {
      const rx = Math.round(x)
      const ry = Math.round(y)
      if (boxedIn) {
        return rx === 50 && ry === 50
      }
      return rx >= 0 && rx <= 100 && ry >= 0 && ry <= 100
    })
    const p1 = game.connectPlayer({
      charClass: 'sor',
      name: 'NoManaBurnSorc',
      level: 30,
      areaId: 2,
      x: 50,
      y: 50,
      skills: { 54: 5, 47: 5 },
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.manaFixed = 200 * 256
    player.maxManaFixed = 200 * 256
    const voidMonsterId = game.spawnMonster({
      defId: 'fallen1',
      x: 150,
      y: 50,
      areaId: 2,
      hp: 5000,
      maxHp: 5000,
      aiDisabled: true,
    })
    game.drainEvents(p1)

    // A) CastSkillAtLocation into deep void (150, 50) -> 0 mana spent, no SkillCast, no anim lock, PlaySound(19)
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 150,
      y: 50,
      hand: 'right',
    })
    game.stepFrames(1)
    const voidEvents = game.drainEvents(p1)
    expect(player.manaFixed).toBe(200 * 256)
    expect(Math.round(player.x)).toBe(50)
    expect(Math.round(player.y)).toBe(50)
    expect(voidEvents.some((e) => e.type === 'SkillCast')).toBe(false)
    expect(voidEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
    expect(game.getPlayerAnimDispatcher(p1)?.getCurrentAnimation()?.completed ?? true).toBe(true)

    // Verify PlaySound(19) resolves on ClientWorld to Sorceress `sor_impossible_1` (3265)
    const clientWorld = new ClientWorld()
    clientWorld.selfId = p1
    clientWorld.apply({
      type: 'PlayerAssign',
      unitId: p1,
      classId: 1,
      name: 'NoManaBurnSorc',
      x: 50,
      y: 50,
    })
    for (const ev of voidEvents) {
      if (ev.type === 'PlaySound') clientWorld.apply(ev)
    }
    expect(clientWorld.drainWorldSoundRequests()).toEqual([
      expect.objectContaining({
        speechSoundId: PLAYER_SOUND_TABLE_0x6FBA7694[1]!.impossible1,
        eventCode: 19,
      }),
    ])

    // B) CastSkillOnTarget on monster stranded in void (150, 50) -> 0 mana spent, no anim lock, PlaySound(19)
    game.enqueueCommand(p1, {
      type: 'CastSkillOnTarget',
      skillId: 54,
      targetType: 'monster',
      targetId: voidMonsterId,
      hand: 'right',
    })
    game.stepFrames(1)
    const targetVoidEvents = game.drainEvents(p1)
    expect(player.manaFixed).toBe(200 * 256)
    expect(targetVoidEvents.some((e) => e.type === 'SkillCast')).toBe(false)
    expect(targetVoidEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    // C) Completely boxed-in 1x1 cell (50, 50): clicking own subtile cannot find any walkable cell != (50, 50)
    boxedIn = true
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 50,
      y: 50,
      hand: 'right',
    })
    game.stepFrames(1)
    const boxedEvents = game.drainEvents(p1)
    expect(player.manaFixed).toBe(200 * 256)
    expect(Math.round(player.x)).toBe(50)
    expect(Math.round(player.y)).toBe(50)
    expect(boxedEvents.some((e) => e.type === 'SkillCast')).toBe(false)
    expect(boxedEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)

    // Player is NOT anim-locked on the very next frame: can immediately cast #47 Fire Ball!
    boxedIn = false
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 47,
      x: 70,
      y: 50,
      hand: 'right',
    })
    game.stepFrames(1)
    const fbEvents = game.drainEvents(p1)
    expect(fbEvents.some((e) => e.type === 'SkillCast' && e.skill === 47)).toBe(true)

    // 2. Area 73 (Duriel's Lair, Teleport === 2): wall/closed-door LOS failure spends 0 mana & emits PlaySound(19)
    const durielGame = new GameInstance({ seed: 202404, areaId: 73, animActionWindup: true })
    durielGame.setTerrainWalkableCheck((_areaId, x, y) => {
      if (Math.round(x) === 40 && (y < 19 || y > 21)) return false
      return x >= 0 && x <= 100 && y >= 0 && y <= 100
    })
    const pDur = durielGame.connectPlayer({
      charClass: 'sor',
      name: 'DurielNoBurn',
      level: 30,
      areaId: 73,
      x: 25,
      y: 20,
      skills: { 54: 5 },
    })
    const durPlayer = internal(durielGame).players.get(pDur) as AnyRecord
    durPlayer.manaFixed = 200 * 256
    durPlayer.maxManaFixed = 200 * 256
    durielGame.spawnObject({ classId: 153, x: 40, y: 20, areaId: 73, mode: 0 })
    durielGame.drainEvents(pDur)

    durielGame.enqueueCommand(pDur, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 55,
      y: 20,
      hand: 'right',
    })
    durielGame.stepFrames(12)
    const durEvents = durielGame.drainEvents(pDur)
    expect(Math.round(durPlayer.x)).toBe(25)
    expect(durPlayer.manaFixed).toBe(200 * 256)
    expect(durEvents.some((e) => e.type === 'SkillCast')).toBe(false)
    expect(durEvents.some((e) => e.type === 'PlaySound' && e.sound === 19)).toBe(true)
  })

  it('keeps Oculus ItemTarget=2 random Teleport strictly isolated to stat 201 item procs, never active player casts', () => {
    const game = new GameInstance({ seed: 202405, areaId: 2 })
    const p1 = game.connectPlayer({
      charClass: 'sor',
      name: 'OculusSorc',
      level: 50,
      areaId: 2,
      x: 100,
      y: 100,
      skills: { 54: 10 },
    })
    const g = internal(game)
    const player = g.players.get(p1) as AnyRecord
    player.manaFixed = 500 * 256
    player.maxManaFixed = 500 * 256
    // Equip an Oculus-like orb with 100% CtC slvl 1 Teleport (#54) when struck (stat 201, param = (54 << 6) | 1 = 3457)
    player.items.push({
      unitId: 9901,
      code: 'oba',
      name: 'The Oculus',
      quality: 7,
      level: 50,
      location: 'equipped',
      x: 0,
      y: 0,
      width: 1,
      height: 3,
      areaId: 2,
      ownerId: p1,
      bodyLoc: 4,
      storePage: 0,
      cost: 5000,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 50,
      maxDurability: 50,
      quantity: 1,
      stats: new Map(),
      rawItemData: {
        id: 9901,
        code: 'oba',
        quality: 7,
        identified: true,
        stats: [{ statId: 201, param: (54 << 6) | 1, value: 100 }],
      },
      socketedItems: [],
    })

    // Active player CastSkillAtLocation lands deterministically at exact target (128, 84) every time
    game.enqueueCommand(p1, {
      type: 'CastSkillAtLocation',
      skillId: 54,
      x: 128,
      y: 84,
      hand: 'right',
    })
    game.stepFrames(5)
    expect(Math.round(player.x)).toBe(128)
    expect(Math.round(player.y)).toBe(84)

    // Triggering stat 201 item proc relocates randomly within [-10..10] around (128, 84) with 0 mana cost
    const manaBeforeProc = player.manaFixed
    g.triggerPlayerCtcProcs113c(player, 201, {})
    expect(player.manaFixed).toBe(manaBeforeProc)
    expect(Math.hypot(Math.round(player.x) - 128, Math.round(player.y) - 84)).toBeGreaterThanOrEqual(1)
    expect(Math.abs(Math.round(player.x) - 128)).toBeLessThanOrEqual(10)
    expect(Math.abs(Math.round(player.y) - 84)).toBeLessThanOrEqual(10)
  })
})

describe('Issue #2024: Client CommandMapper Town Speech, Hovered Item/Object Target Snap & Alt Label Subtile Preservation', () => {
  it('plays <class>_not_in_town_1 (eventCode 24) on fresh right-click & Quick Cast in town with 3000ms cooldown and suppresses hold spam', () => {
    const world = new ClientWorld()
    world.areaId = 1 // Rogue Encampment
    world.selfId = 1
    world.self.unitId = 1
    world.self.charClass = 1 // Sorceress (`sor_not_in_town_1` = 3271)
    world.self.x = 5000
    world.self.y = 5000
    world.self.mana = 100
    world.self.maxMana = 100
    world.self.rightSkill = 54
    ;(world.self.skills as Map<number, number>).set(54, 5)
    ;(world.self.skills as Map<number, number>).set(47, 5)

    const hud = new SkillHotkeysHud()
    hud.rightSkillId = 54
    hud.currentMana = 100

    const sent: any[] = []
    const uiSounds: number[] = []
    const mapper = new CommandMapper({
      world,
      hudManager: {
        screenWidth: 800,
        screenHeight: 600,
        isRunning: true,
        mana: 100,
        maxMana: 100,
        hotkeys: hud,
        groundItemLabelBoxes: [],
        handleMouseMove: () => {},
        isPointInterceptedByHud: () => false,
        handleClick: () => false,
        syncPublishedState: () => {},
        onPlayUiSound: (id: number) => uiSounds.push(id),
      } as any,
      sendCommand: (cmd) => sent.push(cmd),
    })

    // 1. Fresh right-click Teleport in Town at t=1000ms -> blocked + plays 3271 (eventCode 24)
    expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 1000, false)).toBeNull()
    expect(sent).toHaveLength(0)
    expect(world.drainWorldSoundRequests()).toEqual([
      {
        soundId: 3271,
        speechSoundId: 3271,
        eventCode: 24,
        local: true,
      },
    ])
    expect(uiSounds).toEqual([3271])

    // 2. Duplicate fresh click within 3000ms (t=2500ms) -> suppressed by 75-tick cooldown
    expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 2500, false)).toBeNull()
    expect(world.drainWorldSoundRequests()).toHaveLength(0)

    // 3. Hold repeat (`isHold = true`) even after 3000ms (t=4500ms) -> does NOT spam town speech
    expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 4500, true)).toBeNull()
    expect(world.drainWorldSoundRequests()).toHaveLength(0)

    // 4. Quick Cast non-InTown skill (#47 Fire Ball) at t=4600ms -> blocked + plays 3271
    expect(mapper.quickCastSkillAtCursor(47, undefined, 4600)).toBe(false)
    expect(sent).toHaveLength(0)
    expect(world.drainWorldSoundRequests()).toEqual([
      {
        soundId: 3271,
        speechSoundId: 3271,
        eventCode: 24,
        local: true,
      },
    ])
  })

  it('does NOT snap Teleport SkillAt to hovered items/objects or Alt ground item label plaques, while preserving ItemPickup & Telekinesis SkillOn', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const camera = new ViewportCamera(800, 600)
    camera.snapTo(100, 100)
    const sent: any[] = []
    const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x2024, areaId: 2 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'CursorSorc',
      x: 100,
      y: 100,
    })
    ;(world.self.skills as Map<number, number>).set(54, 5)
    ;(world.self.skills as Map<number, number>).set(43, 5)
    world.self.mana = 200
    world.self.maxMana = 200
    world.self.rightSkill = 54
    hudManager.hotkeys.rightSkillId = 54
    hudManager.hotkeys.currentMana = 200

    // Spawn a ground item right at the player's feet (100, 100) and a chest object at (101, 100)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 4,
        id: 701,
        classId: 0,
        code: 'hp1',
        name: 'Minor Healing Potion',
        x: 100,
        y: 100,
        mode: 3,
      } as any,
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 2,
        id: 801,
        classId: 5,
        name: 'Chest',
        x: 101,
        y: 100,
        mode: 0,
      },
    })
    const footItem = world.getUnit('item', 701)!
    const nearChest = world.getUnit('object', 801)!

    const mapper = new CommandMapper({
      world,
      camera,
      hudManager,
      rateLimiter,
      sendCommand: (cmd) => sent.push(cmd),
    })

    // 1. Right-clicking Teleport (#54) at (114, 92) while `hoveredUnit` is `nearChest` (101, 100) or `footItem` (100, 100)
    //    must dispatch `SkillAt` at `{ x: 114, y: 92 }`, NEVER snapping back to (101, 100) or (100, 100)!
    const chestTele = mapper.triggerSecondaryWorldAction(114, 92, nearChest, 1000, false)
    expect(chestTele?.command).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 114, y: 92 },
      hold: false,
    })
    const mouseDownTele = mapper.fromMouseDown(
      { button: 'right', worldX: 115, worldY: 90, hoveredUnit: footItem },
      world,
      1100,
    )
    expect(mouseDownTele).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 115, y: 90 },
      hold: false,
    })

    // 2. Stack an `Alt` ground item label plaque high on screen (over world subtile ~ (90, 90)) for `footItem` at (100, 100)
    const distantScreen = camera.subtileToScreen(90, 90)
    hudManager.groundItemLabelBoxes = [
      {
        id: 701,
        text: 'Minor Healing Potion',
        label: 'Minor Healing Potion',
        color: '#ffffff',
        x: distantScreen.x - 40,
        y: distantScreen.y - 10,
        width: 80,
        height: 20,
      },
    ]

    const resolved = mapper.resolvePointerTarget(distantScreen.x, distantScreen.y)
    expect(resolved.hoveredUnit?.id).toBe(701)
    expect(resolved.subtileX).toBe(90)
    expect(resolved.subtileY).toBe(90)

    // Right-clicking Teleport (#54) on that `Alt` label box teleports to (90, 90), NOT (100, 100)!
    sent.length = 0
    const rightClickOnAltLabel = mapper.handlePointerDown(distantScreen.x, distantScreen.y, 2, 2000)
    expect(rightClickOnAltLabel?.command).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 90, y: 90 },
      hold: false,
    })
    mapper.handlePointerUp(2)

    // Left-clicking on that `Alt` label box (after Teleport cast windup completes) STILL picks up `footItem` (#701)!
    world.expireCastStates(3000)
    sent.length = 0
    const leftClickOnAltLabel = mapper.handlePointerDown(distantScreen.x, distantScreen.y, 0, 3000)
    expect(leftClickOnAltLabel?.command).toEqual({
      type: 'ItemPickup',
      itemId: 701,
      toCursor: false,
    })
    mapper.handlePointerUp(0)

    // Right-clicking Telekinesis (#43, TargetItem=1) on that `Alt` label box STILL dispatches `SkillOn` on item #701!
    world.self.rightSkill = 43
    hudManager.hotkeys.rightSkillId = 43
    sent.length = 0
    const tkOnAltLabel = mapper.handlePointerDown(distantScreen.x, distantScreen.y, 2, 4000)
    expect(tkOnAltLabel?.command).toEqual({
      type: 'SkillOn',
      hand: 'right',
      target: { unitType: 4, id: 701 },
      shift: false,
      hold: false,
    })
    mapper.handlePointerUp(2)
  })
})
