/**
 * #944 F10: Unit tests for 1.13c D2GS 0x2C PlaySound event-code resolution
 * (`D2Client.dll` 0x6fb5d740 -> 0x6fad3f20 -> 0x6fad3200) and 0xA4 MonsterSpecialSkill guard.
 */
import { describe, expect, it } from 'vitest'
import {
  FALLEN_CLASS_IDS_113C,
  MONSTER_TAUNT_BY_CLASS_ID_113C,
  NPC_GREETING_BY_CLASS_ID_113C,
  PLAYER_SOUND_TABLE_0x6FBA7694,
  QUEST_STINGER_BY_0x2C_CODE_113C,
  QUEST_VOICE_DELAY12_CODES,
  resolve0x2CPlaySound113c,
} from '../../src/client/audio/d2gs-play-sound-113c.ts'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import { SfxChunkLoader } from '../../src/client/audio/sfx-chunk-loader.ts'
import { SFX_PACKS_113C, SFX_PACK_INDEX_113C } from '../../src/common/audio/sfx-pack-index-113c.ts'
import { SOUNDS_113C } from '../../src/common/audio/sounds-113c.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decode0x2CPlaySound, decode0xA4MonsterSpecial } from '../../src/netproto/d2gs/s2c/misc.ts'
import { FakeAudioContext, FakePackServer, flushAsync, installFakeAudioContext } from './e2e/webaudio-fake.ts'

describe('D2GS 0x2C PlaySound 1.13c event code resolver (0x6fad3f20 / 0x6fad3200)', () => {
  it('resolves all 7 player classes across event codes 1..11 and 19..83 against .rdata:0x6fba7694 and Sounds.txt', () => {
    expect(PLAYER_SOUND_TABLE_0x6FBA7694).toEqual([
      {
        getHit1: 2878,
        death1: 2883,
        impossible1: 2953,
        needMana1: 2957,
        needKey1: 2955,
        cantCarry1: 2934,
        cantUseYet: 2936,
        notInTown1: 2959,
        chatBase: 2937,
        questBase: 2961,
        taunt1: 2768,
      },
      {
        getHit1: 2910,
        death1: 2915,
        impossible1: 3265,
        needMana1: 3269,
        needKey1: 3267,
        cantCarry1: 3246,
        cantUseYet: 3248,
        notInTown1: 3271,
        chatBase: 3249,
        questBase: 3273,
        taunt1: 2720,
      },
      {
        getHit1: 2894,
        death1: 2899,
        impossible1: 3109,
        needMana1: 3113,
        needKey1: 3111,
        cantCarry1: 3090,
        cantUseYet: 3092,
        notInTown1: 3115,
        chatBase: 3093,
        questBase: 3117,
        taunt1: 2720,
      },
      {
        getHit1: 2886,
        death1: 2891,
        impossible1: 3187,
        needMana1: 3191,
        needKey1: 3189,
        cantCarry1: 3168,
        cantUseYet: 3170,
        notInTown1: 3193,
        chatBase: 3171,
        questBase: 3195,
        taunt1: 2768,
      },
      {
        getHit1: 2902,
        death1: 2907,
        impossible1: 3031,
        needMana1: 3035,
        needKey1: 3033,
        cantCarry1: 3012,
        cantUseYet: 3014,
        notInTown1: 3037,
        chatBase: 3015,
        questBase: 3039,
        taunt1: 2816,
      },
      {
        getHit1: 2926,
        death1: 2931,
        impossible1: 3421,
        needMana1: 3425,
        needKey1: 3423,
        cantCarry1: 3402,
        cantUseYet: 3404,
        notInTown1: 3427,
        chatBase: 3405,
        questBase: 3429,
        taunt1: 2720,
      },
      {
        getHit1: 2918,
        death1: 2923,
        impossible1: 3343,
        needMana1: 3347,
        needKey1: 3345,
        cantCarry1: 3324,
        cantUseYet: 3326,
        notInTown1: 3349,
        chatBase: 3327,
        questBase: 3351,
        taunt1: 2720,
      },
    ])

    const worldCtx = { localPlayerId: 1, localPlayerX: 5000, localPlayerY: 5000 }
    for (let classId = 0; classId < 7; classId++) {
      const unitCtx = {
        unitType: 'player' as const,
        id: 1,
        classId,
        x: 5000,
        y: 5000,
        mode: 1,
        isLocalPlayer: true,
      }
      for (const code of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]) {
        const res = resolve0x2CPlaySound113c(code, unitCtx, worldCtx)
        expect(res).not.toBeNull()
        expect(res!.soundId).toBeGreaterThan(0)
        expect(SOUNDS_113C[res!.soundId!]).toBeDefined()
      }
      for (let code = 19; code <= 83; code++) {
        const res = resolve0x2CPlaySound113c(code, unitCtx, worldCtx)
        expect(res).not.toBeNull()
        expect(res!.speechSoundId).toBeGreaterThan(0)
        expect(SOUNDS_113C[res!.speechSoundId!]).toBeDefined()
        if (QUEST_STINGER_BY_0x2C_CODE_113C[code] !== undefined) {
          expect(res!.stingerSoundId).toBe(QUEST_STINGER_BY_0x2C_CODE_113C[code])
        }
        if (QUEST_VOICE_DELAY12_CODES.has(code)) {
          expect(res!.delayTicks).toBe(12)
        } else {
          expect(res!.delayTicks).toBeUndefined()
        }
      }
      // Code 36 schedules a 12-tick voice delay per unsigned (36 - 38) >>> 0 > 18 at 0x6fad3474
      expect(QUEST_VOICE_DELAY12_CODES.has(36)).toBe(true)
      expect(resolve0x2CPlaySound113c(36, unitCtx, worldCtx)?.delayTicks).toBe(12)
      // Dead local player (mode 17) plays no player speech/sound in 0x6fad3200
      expect(resolve0x2CPlaySound113c(19, { ...unitCtx, mode: 17 }, worldCtx)).toBeNull()
    }
  })

  it('resolves outer switch codes 10, 13, 14, 15, 16, 17, 18, 84..87, 90, 91, 92, 93 against 1.13c tables', () => {
    const worldCtx = { localPlayerId: 1, localPlayerX: 5000, localPlayerY: 5000 }
    const objUnit = { unitType: 'object' as const, id: 100, classId: 10, x: 5100, y: 5200 }
    expect(resolve0x2CPlaySound113c(10, objUnit, worldCtx)).toMatchObject({
      soundId: 2673,
      volume: 120,
      volumeOverride: 120,
      x: 5100,
      y: 5200,
    })
    expect(resolve0x2CPlaySound113c(13, objUnit, worldCtx)).toMatchObject({ soundId: 2634, x: 5100, y: 5200 })
    expect(resolve0x2CPlaySound113c(14, objUnit, worldCtx)).toMatchObject({ soundId: 2635, x: 5100, y: 5200 })
    expect(resolve0x2CPlaySound113c(93, objUnit, worldCtx)).toMatchObject({ soundId: 2553, x: 5100, y: 5200 })
    expect(resolve0x2CPlaySound113c(91, objUnit, worldCtx)).toMatchObject({ soundId: 8, x: 5000, y: 5000 })
    expect(resolve0x2CPlaySound113c(92, objUnit, worldCtx)).toBeNull()

    // Monster taunt (16): all 19 MonStats -> MonSounds Taunt rows resolve; non-taunt rows return null
    expect(Object.keys(MONSTER_TAUNT_BY_CLASS_ID_113C)).toHaveLength(19)
    for (const [cidStr, expectedId] of Object.entries(MONSTER_TAUNT_BY_CLASS_ID_113C)) {
      const cid = Number(cidStr)
      expect(
        resolve0x2CPlaySound113c(16, { unitType: 'monster', id: 50, classId: cid, x: 10, y: 20 }, worldCtx),
      ).toMatchObject({ speechSoundId: expectedId })
    }
    for (const nonTauntCid of [0, 45, 243, 365, 574, 705]) {
      expect(
        resolve0x2CPlaySound113c(16, { unitType: 'monster', id: 50, classId: nonTauntCid, x: 10, y: 20 }, worldCtx),
      ).toBeNull()
    }
    // Issue #1235: SuperUniques.txt UMonSound override on Code 16 via 0x6fad2a70 (e.g. Hephasto superUniqueId=39 -> smithdemon taunt 4649)
    expect(
      resolve0x2CPlaySound113c(
        16,
        {
          unitType: 'monster',
          id: 50,
          classId: 402,
          x: 10,
          y: 20,
          isSuperUnique: true,
          superUniqueId: 39,
          name: 'Hephasto The Armorer',
        },
        worldCtx,
      ),
    ).toMatchObject({ speechSoundId: 4649 })

    // Fallen flee (17): only classIds {19..23, 642..644} resolve to 917; skeletons (0..4) and hephasto (409) return null
    expect([...FALLEN_CLASS_IDS_113C]).toEqual([19, 20, 21, 22, 23, 642, 643, 644])
    for (const fallenCid of [19, 20, 21, 22, 23, 642, 643, 644]) {
      expect(
        resolve0x2CPlaySound113c(17, { unitType: 'monster', id: 51, classId: fallenCid, x: 10, y: 20 }, worldCtx),
      ).toMatchObject({ soundId: 917, delayTicks: 6 })
    }
    for (const nonFallenCid of [0, 1, 2, 3, 4, 409]) {
      expect(
        resolve0x2CPlaySound113c(17, { unitType: 'monster', id: 51, classId: nonFallenCid, x: 10, y: 20 }, worldCtx),
      ).toBeNull()
    }

    // Town NPC greeting (18): all 38 D2Client.dll 0x6fb4cad0 entries resolve to Stream=1 NPC greetings (#1234)
    expect(Object.keys(NPC_GREETING_BY_CLASS_ID_113C)).toHaveLength(38)
    expect(NPC_GREETING_BY_CLASS_ID_113C[148]).toBe(3480) // akara
    expect(NPC_GREETING_BY_CLASS_ID_113C[146]).toBe(3644) // cain
    expect(NPC_GREETING_BY_CLASS_ID_113C[147]).toBe(3910) // gheed
    expect(NPC_GREETING_BY_CLASS_ID_113C[264]).toBe(4150) // meshif2 (Act 3)
    expect(NPC_GREETING_BY_CLASS_ID_113C[367]).toBe(4303) // tyrael2 (Act 4)
    expect(NPC_GREETING_BY_CLASS_ID_113C[511]).toBe(4449) // larzuk
    expect(NPC_GREETING_BY_CLASS_ID_113C[512]).toBe(4382) // drehya
    expect(NPC_GREETING_BY_CLASS_ID_113C[527]).toBe(4382) // drehyaiced (Act 5)
    expect(
      resolve0x2CPlaySound113c(18, { unitType: 'monster', id: 52, classId: 148, x: 10, y: 20 }, worldCtx),
    ).toMatchObject({ speechSoundId: 3480 })
    expect(
      resolve0x2CPlaySound113c(18, { unitType: 'monster', id: 52, classId: 264, x: 10, y: 20 }, worldCtx),
    ).toMatchObject({ speechSoundId: 4150 })
    expect(
      resolve0x2CPlaySound113c(18, { unitType: 'monster', id: 52, classId: 367, x: 10, y: 20 }, worldCtx),
    ).toMatchObject({ speechSoundId: 4303 })
    expect(
      resolve0x2CPlaySound113c(18, { unitType: 'monster', id: 52, classId: 527, x: 10, y: 20 }, worldCtx),
    ).toMatchObject({ speechSoundId: 4382 })
    // 4-column greeting selector via worldCtx.greetingOptions (0x6fb4cce0)
    expect(
      resolve0x2CPlaySound113c(
        18,
        { unitType: 'monster', id: 52, classId: 148, x: 10, y: 20 },
        { ...worldCtx, greetingOptions: { mode: 2 } },
      ),
    ).toMatchObject({ speechSoundId: 3484 })
    expect(
      resolve0x2CPlaySound113c(
        18,
        { unitType: 'monster', id: 52, classId: 148, x: 10, y: 20 },
        { ...worldCtx, greetingOptions: { mode: 0, timeOfDay: 1, rng: () => 0.1 } },
      ),
    ).toMatchObject({ speechSoundId: 3486 })
  })

  it('queues resolved 0x2C PlaySound requests on ClientWorld and guards 0xA4 MonsterSpecialSkill with no sound', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
    world.apply({
      type: 'AssignPlayer',
      unitId: 1,
      charClass: 1, // Sorceress
      name: 'Sorc',
      x: 5100,
      y: 5050,
    })

    // 0x2C PlaySound: unitType=0, unitId=1, sound=1 (235 item_pickup)
    const pkt2c = new Uint8Array(8)
    pkt2c[0] = 0x2c
    pkt2c[1] = 0
    new DataView(pkt2c.buffer).setUint32(2, 1, true)
    new DataView(pkt2c.buffer).setUint16(6, 1, true)
    const ev2c = decode0x2CPlaySound(pkt2c)
    expect(ev2c.type).toBe('PlaySound')
    world.apply(ev2c)

    const drained = world.drainWorldSoundRequests()
    expect(drained).toHaveLength(1)
    expect(drained[0]).toMatchObject({
      soundId: 235,
      x: 5100,
      y: 5050,
      unit: {
        unitType: 'player',
        id: 1,
        x: 5100,
        y: 5050,
        isLocalPlayer: true,
      },
    })
    expect(JSON.parse(JSON.stringify(drained))).toEqual(drained)

    // 0xA4 MonsterSpecialSkill: decodes to MonsterSpecial (never PlaySound), must NOT queue any sound per 0x6fb5d760
    const pktA4 = new Uint8Array([0xa4, 0x05, 0x00])
    const evA4 = decode0xA4MonsterSpecial(pktA4)
    expect(evA4).toEqual({ type: 'MonsterSpecial', classId: 5 })
    world.apply(evA4)
    expect(world.drainWorldSoundRequests()).toHaveLength(0)
  })

  it('bridges ClientWorld sound requests into AudioRuntime113c preserving unit position, local-player priority boost, volume, and delayTicks', () => {
    const uninstall = installFakeAudioContext()
    try {
      const server = new FakePackServer(SFX_PACKS_113C)
      const loader = new SfxChunkLoader({
        fetchPack: server.fetchPack,
        getContext: () => (FakeAudioContext.instances.at(-1) as unknown as BaseAudioContext | undefined) ?? null,
      })
      const rt = new AudioRuntime113c({
        rng: new D2Rng(0x6fb0e8e1, 0x113c9442),
        listenerPos: () => ({ x: 5000, y: 5000 }),
        loader,
      })
      rt.unlock()
      rt.gameInit()

      // 1. Direct playSound with { unitType, unitId, x, y, delayTicks, volume }
      const hDirect = rt.playSound(4, {
        unitType: 1,
        unitId: 101,
        x: 5010,
        y: 5000,
        delayTicks: 8,
        volume: 140,
      })
      const recDirect = rt.records.record(hDirect)
      expect(recDirect).toBeDefined()
      expect(recDirect!.units).toHaveLength(1)
      expect(recDirect!.dist2).toBe(51200)
      expect(recDirect!.start).toBe(8)
      expect(recDirect!.vol).toBe(140)

      // 2. ClientWorld -> drainWorldSoundRequests() -> AudioRuntime113c.drainWorldRequests()
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
      world.apply({
        type: 'AssignPlayer',
        unitId: 1,
        charClass: 0,
        name: 'Ama',
        x: 5000,
        y: 5000,
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 50, classId: 19, x: 5012, y: 5005, mode: 1 },
      })
      const pktFlee = new Uint8Array(8)
      pktFlee[0] = 0x2c
      pktFlee[1] = 1
      new DataView(pktFlee.buffer).setUint32(2, 50, true)
      new DataView(pktFlee.buffer).setUint16(6, 17, true)
      world.apply(decode0x2CPlaySound(pktFlee))

      const drained = world.drainWorldSoundRequests()
      expect(drained).toHaveLength(1)
      const handles = rt.drainWorldRequests(drained)
      expect(handles).toHaveLength(1)
      const recFlee = rt.records.record(handles[0]!)
      expect(recFlee).toBeDefined()
      expect(recFlee!.id).toBe(917)
      expect(recFlee!.units).toHaveLength(1)
      expect(recFlee!.dist2).toBeGreaterThan(0)
      expect(recFlee!.start).toBe(6)

      // 3. Bare UnitRef without x/y never throws in playSound or drainWorldRequests
      const hBare = rt.playSound(4, { unit: { unitType: 'monster', id: 99 }, x: 5005, y: 5005 })
      expect(hBare).toBeGreaterThan(0)
      expect(rt.records.record(hBare)?.units).toHaveLength(1)
    } finally {
      uninstall()
    }
  })

  it('guards in-flight async decodes across gameExit() + gameInit() with sessionEpoch so stale decodes never corrupt new session handles', async () => {
    const uninstall = installFakeAudioContext()
    try {
      const server = new FakePackServer(SFX_PACKS_113C)
      let releaseCore3: (() => void) | null = null
      const loader = new SfxChunkLoader({
        fetchPack: async (packId: string, url: string) => {
          if (packId === 'sfx-core-3') {
            await new Promise<void>((r) => {
              releaseCore3 = r
            })
          }
          return server.fetchPack(packId, url)
        },
        getContext: () => (FakeAudioContext.instances.at(-1) as unknown as BaseAudioContext | undefined) ?? null,
      })
      const rt = new AudioRuntime113c({
        rng: new D2Rng(1, 1),
        listenerPos: () => ({ x: 0, y: 0 }),
        loader,
      })
      rt.unlock()
      rt.gameInit()

      const shippedIds = Object.keys(SFX_PACK_INDEX_113C).map(Number)
      const core2Id = shippedIds.find(
        (id) => SFX_PACK_INDEX_113C[id]![0] === 'sfx-core-2' && SOUNDS_113C[id]!.groupSize === 1,
      )!
      const core3Id = shippedIds.find(
        (id) => SFX_PACK_INDEX_113C[id]![0] === 'sfx-core-3' && SOUNDS_113C[id]!.groupSize === 1,
      )!

      const h1 = rt.playUi(core2Id) // Session 1: handle = 1
      expect(h1).toBe(1)

      rt.gameExit()
      rt.gameInit() // Session 2: handleCounter reset, sessionEpoch incremented

      const h2 = rt.playUi(core3Id) // Session 2: handle = 1 (in-flight on holdCore3)
      expect(h2).toBe(1)

      await flushAsync(4) // Session 1 decode finishes while Session 2 decode is still pending
      rt.soundTick(1)

      // Session 2's handle=1 record must still be alive and pending (state 0), not dropped!
      const rec2 = rt.records.record(h2)
      expect(rec2).toBeDefined()
      expect(rec2!.handle).toBe(1)
      expect(rec2!.state).toBe(0)

      if (releaseCore3 !== null) (releaseCore3 as () => void)()
      await flushAsync(4)
      rt.soundTick(2)
      expect(rt.records.record(h2)?.state).toBe(1)
    } finally {
      uninstall()
    }
  })
})
