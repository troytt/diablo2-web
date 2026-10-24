import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  decode0x73CreateMissile,
  decode0xA4MonsterSpecial,
  decodeD2gsS2cPacket,
  decodeRare113cS2cPacket,
} from '../../src/netproto/index.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  CORPSE_HIDE_STATES_113C,
  STATE_COLOR_SHIFTS,
  buildSceneDrawables,
  resolveStateOverlayTokens113c,
  resolveUnitToken,
} from '../../src/client/view/unit-drawables.ts'
import { SHRINE_SOUNDS_113C } from '../../src/common/audio/object-sounds-113c.ts'
import { updateObjectModeSound113c } from '../../src/client/world/object-sound-113c.ts'
import { getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'
import { SkillSoundController113c } from '../../src/common/audio/skill-sounds-113c.ts'
import { PLAYER_SOUND_TABLE_0x6FBA7694 } from '../../src/client/audio/d2gs-play-sound-113c.ts'
import { resolveWeaponClassSwingSoundId113c } from '../../src/client/world/world-skill-missiles.ts'

describe('Batch NET-1 / NET-2 / STATE-1 / STATE-2 / SFX-8 / SFX-9 / SFX-10 (#1239-#1244, #1247)', () => {
  describe('Issue #1239: [NET-1] decodeRare113cS2cPacket never fabricates 0x80xx/0x90xx StatSet', () => {
    it('contains zero 0x8000|op or 0x9000|op fake StatSet returns in misc.ts', () => {
      const miscSrc = readFileSync(resolve('src/netproto/d2gs/s2c/misc.ts'), 'utf8')
      expect(miscSrc).not.toContain('0x8000 | op')
      expect(miscSrc).not.toContain('0x9000 | op')
    })

    it('decodes 0x12 as UnloadAct, 0x17 as UnitRemove, and rare opcodes as ProtocolSync without polluting player stats', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 1 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 777, classId: 1, x: 5000, y: 5000, mode: 1, lifePct: 128 },
      })
      expect(world.getUnit('monster', 777)).toBeDefined()

      // 0x12 UnloadAct (1B)
      const ev12 = decodeRare113cS2cPacket(new Uint8Array([0x12]))
      expect(ev12).toEqual({ type: 'UnloadAct' })
      world.apply(ev12)

      // 0x17 RemoveUnit17 (6B: u8 0x17, u8 unitType=1, u32 id=777)
      const pkt17 = new Uint8Array(6)
      pkt17[0] = 0x17
      pkt17[1] = 1
      new DataView(pkt17.buffer).setUint32(2, 777, true)
      const ev17 = decodeRare113cS2cPacket(pkt17)
      expect(ev17).toEqual({ type: 'UnitRemove', unitType: 1, id: 777 })
      world.apply(ev17)
      expect(world.getUnit('monster', 777)).toBeUndefined()

      // Rare opcodes (0x13, 0x14, 0x16, 0x40, 0x45, 0x54, 0x57, 0x5f, 0x62, 0x6e..0x72, 0x7e, 0x80, 0x93, 0xa6)
      const rareOpcodes = [
        0x13, 0x14, 0x16, 0x40, 0x45, 0x54, 0x57, 0x5f, 0x62, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x7e,
        0x80, 0x93, 0xa6,
      ]
      for (const op of rareOpcodes) {
        const pkt = new Uint8Array(8)
        pkt[0] = op
        pkt[1] = 42
        const ev = decodeRare113cS2cPacket(pkt)
        expect(ev.type).toBe('ProtocolSync')
        world.apply(ev)
        expect(world.self.stats.get(0x8000 | op)).toBe(0)
        expect(world.self.stats.get(0x9000 | op)).toBe(0)
      }
    })
  })

  describe('Issue #1240: [NET-2] 0xA4 MonsterSpecial & 0x73 CreateMissile 32B', () => {
    it('decodes 0xA4 as MonsterSpecial (never PlaySound) and 0x73 as CreateMissile (32B)', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })

      const evA4 = decode0xA4MonsterSpecial(new Uint8Array([0xa4, 0x10, 0x01]))
      expect(evA4).toEqual({ type: 'MonsterSpecial', classId: 272 })
      world.apply(evA4)
      expect(world.drainWorldSoundRequests()).toHaveLength(0)

      const pkt73 = new Uint8Array(32)
      const dv = new DataView(pkt73.buffer)
      pkt73[0] = 0x73
      dv.setUint32(1, 0, true)
      dv.setUint16(5, 62, true) // fireball (#62)
      dv.setUint16(7, 5010, true)
      dv.setUint16(9, 5012, true)
      dv.setUint16(11, 5030, true)
      dv.setUint16(13, 5012, true)
      pkt73[15] = 7 // level
      pkt73[16] = 0 // ownerType = player
      dv.setUint32(17, 1, true) // ownerId = 1
      dv.setUint16(21, 16, true) // velocity
      dv.setUint16(23, 40, true) // range

      const ev73 = decode0x73CreateMissile(pkt73)
      expect(ev73).toMatchObject({
        type: 'CreateMissile',
        missileClassId: 62,
        at: { x: 5010, y: 5012 },
        target: { x: 5030, y: 5012 },
        level: 7,
        owner: { unitType: 0, id: 1 },
        ownerType: 0,
        ownerId: 1,
        velocity: 16,
        range: 40,
      })
      expect(decodeD2gsS2cPacket(pkt73).type).toBe('CreateMissile')

      world.apply(ev73)
      const missile = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'fireball',
      )
      expect(missile).toBeDefined()
      expect(missile?.x).toBe(5010)
      expect(missile?.y).toBe(5012)
    })
  })

  describe('Issue #1241: [STATE-1] nooverlays=1 (#117/#120/#151) & pgsv=1 (#122..#127) single-stage selection', () => {
    it('selects only the active charge stage for Assassin progressive states (#122..#127) and Druid #117/#120/#151', () => {
      for (const [stateId, prefix] of [
        [122, 'progressive_damage_'],
        [123, 'progressive_steal_'],
        [124, 'progressive_other_'],
        [125, 'progressive_fire_'],
        [126, 'progressive_cold_'],
        [127, 'progressive_lightning_'],
      ] as const) {
        for (const charge of [1, 2, 3]) {
          const tokens = resolveStateOverlayTokens113c(
            {
              id: 1,
              kind: 'player',
              classId: 6,
              x: 5000,
              y: 5000,
              mode: 1,
              direction: 0,
              hpRatio: 1,
              isCorpse: false,
              states: [stateId],
              chargeCounts: new Map([[stateId, charge]]),
            },
            stateId,
          )
          expect(tokens).toEqual([`${prefix}${charge}`])
        }
      }

      // Druid Maul (#117) & Feral Rage (#120) stages 1..5
      for (let stage = 1; stage <= 5; stage++) {
        expect(
          resolveStateOverlayTokens113c(
            {
              id: 1,
              kind: 'player',
              classId: 5,
              x: 5000,
              y: 5000,
              mode: 1,
              direction: 0,
              hpRatio: 1,
              isCorpse: false,
              states: [117],
              maulCharges: stage,
            },
            117,
          ),
        ).toEqual([`maul${stage}`, `maul${stage}back`])

        expect(
          resolveStateOverlayTokens113c(
            {
              id: 1,
              kind: 'player',
              classId: 5,
              x: 5000,
              y: 5000,
              mode: 1,
              direction: 0,
              hpRatio: 1,
              isCorpse: false,
              states: [120],
              feralRageCharges: stage,
            },
            120,
          ),
        ).toEqual([`feralrage${stage}`, `feralrage${stage}back`])
      }

      // Druid Cyclone Armor (#151) remaining absorb thirds (stat 132 / stat 133)
      const makeCycloneUnit = (cur: number, max: number) => ({
        id: 1,
        kind: 'player' as const,
        classId: 5,
        x: 5000,
        y: 5000,
        mode: 1,
        direction: 0,
        hpRatio: 1,
        isCorpse: false,
        states: [151],
        stats: new Map([
          [132, cur],
          [133, max],
        ]),
      })
      expect(resolveStateOverlayTokens113c(makeCycloneUnit(90, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
        'cyclonearmor3back',
        'cyclonearmor3front',
      ])
      expect(resolveStateOverlayTokens113c(makeCycloneUnit(50, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
        'cyclonearmor2back',
        'cyclonearmor2front',
      ])
      expect(resolveStateOverlayTokens113c(makeCycloneUnit(20, 90), 151)).toEqual([
        'cyclonearmor1back',
        'cyclonearmor1front',
      ])
    })
  })

  describe('Issue #1242: [STATE-2] morphs, colorpri, corpse hide=1, and removerlay', () => {
    it('morphs #177 delerium to FK, does not morph #65 dodge, and plays teleport on both StateSet and StateEnd of #177', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 0, x: 5000, y: 5000, mode: 1, lifePct: 128 },
      })

      world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 65 })
      const player = world.getUnit('player', 1)!
      expect(
        resolveUnitToken({
          id: 1,
          kind: 'player',
          classId: 0,
          x: 5000,
          y: 5000,
          mode: 1,
          direction: 0,
          hpRatio: 1,
          isCorpse: false,
          states: player.states,
        }),
      ).toBe('AM')

      world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: 177 })
      expect(
        resolveUnitToken({
          id: 1,
          kind: 'player',
          classId: 0,
          x: 5000,
          y: 5000,
          mode: 1,
          direction: 0,
          hpRatio: 1,
          isCorpse: false,
          states: player.states,
        }),
      ).toBe('FK')
      expect(player.overlays.some((o) => o.token === 'teleport')).toBe(true)

      player.overlays = []
      world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: 177 })
      expect(player.overlays.some((o) => o.token === 'teleport')).toBe(true)
    })

    it('enforces States.txt colorpri (#44 holywindcold=100 > #2 poison=95 > #96 revive=85 > #91 red=70; #90 blue=100)', () => {
      expect(STATE_COLOR_SHIFTS[44]?.priority).toBe(100)
      expect(STATE_COLOR_SHIFTS[90]?.priority).toBe(100)
      expect(STATE_COLOR_SHIFTS[91]?.priority).toBe(70)
      expect(STATE_COLOR_SHIFTS[96]?.priority).toBe(85)

      const res = buildSceneDrawables([
        {
          id: 10,
          kind: 'monster',
          classId: 0,
          x: 5000,
          y: 5000,
          mode: 1,
          direction: 0,
          hpRatio: 1,
          isCorpse: false,
          states: [2, 44], // Poison (95) + Holy Freeze (100)
        },
      ])
      expect(res.unitDrawables[0]?.tintColor).toEqual([150, 215, 255])
    })

    it('hides corpses carrying any States.txt hide=1 corpse state (#1, #99, #104, #107, #154, #173, #184)', () => {
      for (const stateId of [1, 99, 104, 107, 154, 173, 184]) {
        expect(CORPSE_HIDE_STATES_113C.has(stateId)).toBe(true)
        const res = buildSceneDrawables([
          {
            id: 20 + stateId,
            kind: 'monster',
            classId: 0,
            x: 5000,
            y: 5000,
            mode: 12,
            direction: 0,
            hpRatio: 0,
            isCorpse: true,
            states: [stateId],
          },
        ])
        expect(res.unitDrawables).toHaveLength(0)
      }
    })
  })

  describe('Issue #1243: [SFX-8] States.txt offsound on StateEnd (#139 wolf / #140 bear -> 2346)', () => {
    it('emits soundId 2346 once when active #139 wolf or #140 bear ends, and 0 on duplicate StateEnd', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 5, x: 5000, y: 5000, mode: 1, lifePct: 128 },
      })

      for (const stateId of [139, 140]) {
        world.apply({ type: 'StateSet', unit: { unitType: 0, id: 1 }, state: stateId })
        world.drainWorldSoundRequests()

        world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: stateId })
        const endReqs = world.drainWorldSoundRequests().filter((r) => r.soundId === 2346)
        expect(endReqs).toHaveLength(1)

        // Duplicate StateEnd when state is already inactive emits nothing
        world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: stateId })
        expect(world.drainWorldSoundRequests().filter((r) => r.soundId === 2346)).toHaveLength(0)
      }
    })
  })

  describe('Issue #1244: [SFX-9] Player normal attack (skillId=0), weaponsnd=1, and player GH/DT/WL mode sounds', () => {
    it('emits weapon swing/bow release sounds for skillId=0 and weaponsnd=1 skills, plus player GH/DT/WL sounds', () => {
      expect(resolveWeaponClassSwingSoundId113c('hth', 0)).toBe(251)
      expect(resolveWeaponClassSwingSoundId113c('1hs', 0)).toBe(262)
      expect(resolveWeaponClassSwingSoundId113c('bow', 0)).toBe(309)
      expect(resolveWeaponClassSwingSoundId113c('xbw', 0)).toBe(317)

      const played: number[] = []
      const ctrl = new SkillSoundController113c({
        playSoundById: (id) => {
          played.push(id)
          return played.length
        },
      })
      ctrl.onAnimKeyframe({ skillId: 0, flag: 1, weaponSoundId: 262 })
      expect(played).toEqual([262])

      const world = new ClientWorld()
      world.selfId = 1
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 4, x: 5000, y: 5000, mode: 1, lifePct: 128 }, // Barbarian (classId=4)
      })
      world.drainWorldSoundRequests()

      // Normal attack keyframe (skillId=0)
      world.emitSkillKeyframeSound({ skillId: 0, flag: 1, unitId: 1, x: 5000, y: 5000 })
      const atkReqs = world.drainWorldSoundRequests()
      expect(atkReqs).toHaveLength(1)
      expect(atkReqs[0]?.soundId).toBe(251)
      expect(atkReqs[0]?.weaponSoundId).toBe(251)

      // Player GetHit (mode 4) -> Barbarian getHit1 (2902)
      world.apply({ type: 'UnitMode', unitType: 0, id: 1, mode: 4 })
      expect(world.drainWorldSoundRequests().map((r) => r.soundId)).toContain(
        PLAYER_SOUND_TABLE_0x6FBA7694[4]!.getHit1,
      )

      // Player Walk (mode 2) -> Barbarian taunt1 footstep (2816)
      world.apply({ type: 'UnitMode', unitType: 0, id: 1, mode: 2 })
      expect(world.drainWorldSoundRequests().map((r) => r.soundId)).toContain(
        PLAYER_SOUND_TABLE_0x6FBA7694[4]!.taunt1,
      )

      // Player Death (mode 0) -> Barbarian death1 (2907)
      world.apply({ type: 'UnitMode', unitType: 0, id: 1, mode: 0 })
      expect(world.drainWorldSoundRequests().map((r) => r.soundId)).toContain(
        PLAYER_SOUND_TABLE_0x6FBA7694[4]!.death1,
      )
    })
  })

  describe('Issue #1247: [SFX-10] D2Client.dll 0x6fb82f60 shrine activation sounds (codes 1..22 -> 2664..2680)', () => {
    it('emits the exact 0x6fb82f60 +0x10 soundId for all 22 shrine codes on 0 -> 1/2 and stays silent on first sight in mode 1/2', () => {
      const expectedByCode: Readonly<Record<number, number>> = {
        1: 2673,
        2: 2673,
        3: 2672,
        4: 2666,
        5: 2666,
        6: 2664,
        7: 2665,
        8: 2675,
        9: 2674,
        10: 2676,
        11: 2677,
        12: 2679,
        13: 2672,
        14: 2672,
        15: 2667,
        16: 2678,
        17: 2671,
        18: 2669,
        19: 2680,
        20: 2671,
        21: 2668,
        22: 2670,
      }
      const record = getObjectsTxtRecord113c(83) // Horn Shrine (OperateFn=2, null in OBJECT_SOUNDS_113C)
      for (let code = 1; code <= 22; code++) {
        expect(SHRINE_SOUNDS_113C[code]).toBe(expectedByCode[code])

        const unit = { classId: 83, mode: 0, interactType: code }
        expect(updateObjectModeSound113c(unit, record)).toEqual([])

        unit.mode = 1
        expect(updateObjectModeSound113c(unit, record)).toEqual([{ soundId: expectedByCode[code]! }])

        // Subsequent 1 -> 2 transition does not double-emit
        unit.mode = 2
        expect(updateObjectModeSound113c(unit, record)).toEqual([])

        // First sight already in mode 1 or 2 (prevMode === undefined) does NOT emit
        const alreadyActive = { classId: 83, mode: 2, interactType: code }
        expect(updateObjectModeSound113c(alreadyActive, record)).toEqual([])
      }
    })
  })
})
