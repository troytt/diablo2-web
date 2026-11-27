/**
 * @file tests/oracle/k5/bridge-explicit-errors.test.ts
 * `[K5 / #2031]` Explicit-error & miss-provoking unit tests for `D2gsKernelBridge113c` and
 * `LocalKernelD2gsAdapter113c`.
 *
 * Every test exercises strictly public APIs and typed inputs (no unsafe type assertions or
 * compiler suppression comments) to provoke each replaced silent fallback and assert an
 * explicit error, alongside positive controls proving authentic 1.13c gameplay remains intact.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STATLIST_GetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  encodeC2sGameLogon,
  type ItemData,
  type ItemQualityLevel,
} from '../../../src/netproto/index.ts'
import {
  D2gsKernelBridge113c,
  areaIdToActIdx113c,
  requireCharClassCode113c,
  requireCharClassName113c,
  requireClassSkillBase113c,
  requireTownAreaForAct113c,
  requireValidActIdx113c,
  requireValidCharClassId113c,
  requireValidDifficulty113c,
} from '../../../src/server/net/d2gs-kernel-bridge-113c.ts'
import { LocalKernelD2gsAdapter113c } from '../../../src/server/net/local-kernel-d2gs-adapter-113c.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

const STAT_HITPOINTS = 6
const STAT_MAXHP = 7
const STAT_EXPERIENCE = 13

function makeTestItem(opts: {
  readonly id: number
  readonly code: string
  readonly location: number
  readonly container: ItemData['container']
  readonly bodyLoc?: number
  readonly storePage?: number
  readonly gridX?: number
  readonly gridY?: number
  readonly durability?: number
  readonly maxDurability?: number
  readonly broken?: boolean
  readonly quality?: ItemQualityLevel
}): ItemData {
  const paddedCode = opts.code.padEnd(4, ' ')
  return {
    id: opts.id,
    itemId: opts.id,
    opcode: 0x9c,
    action: 0,
    category: 0,
    flags: 0x00000010,
    rawFlags: 0x00000010,
    version: 101,
    location: opts.location,
    container: opts.container,
    bodyLoc: opts.bodyLoc ?? 0,
    equippedSlot: opts.bodyLoc ?? 0,
    gridX: opts.gridX ?? 0,
    gridY: opts.gridY ?? 0,
    storePage: opts.storePage ?? 0,
    storagePage: opts.storePage ?? 0,
    worldX: 0,
    worldY: 0,
    x: opts.gridX ?? 0,
    y: opts.gridY ?? 0,
    code: opts.code,
    rawCode: paddedCode,
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: opts.broken ?? false,
    inSocket: false,
    equipped: opts.location === 1,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: opts.quality ?? 2,
    ...(opts.durability !== undefined ? { durability: opts.durability, curDurability: opts.durability } : {}),
    ...(opts.maxDurability !== undefined ? { maxDurability: opts.maxDurability } : {}),
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  }
}

function makeEquippedItem(id: number, code: string, bodyLoc: number, durability?: number, maxDurability?: number): ItemData {
  return makeTestItem({
    id,
    code,
    location: 1,
    container: 'equipment',
    bodyLoc,
    ...(durability !== undefined ? { durability } : {}),
    ...(maxDurability !== undefined ? { maxDurability } : {}),
  })
}

function makeInventoryItem(id: number, code: string, x = 0, y = 0): ItemData {
  return makeTestItem({
    id,
    code,
    location: 0,
    container: 'inventory',
    storePage: 1,
    gridX: x,
    gridY: y,
  })
}

function makeC2sSkillOnUnit(opcode: 0x06 | 0x0d, unitType: number, unitId: number): Uint8Array {
  const pkt = new Uint8Array(9)
  const dv = new DataView(pkt.buffer)
  pkt[0] = opcode
  dv.setUint32(1, unitType >>> 0, true)
  dv.setUint32(5, unitId >>> 0, true)
  return pkt
}

function makeC2sSkillOnLoc(opcode: 0x05 | 0x0c, x: number, y: number): Uint8Array {
  const pkt = new Uint8Array(5)
  const dv = new DataView(pkt.buffer)
  pkt[0] = opcode
  dv.setUint16(1, x & 0xffff, true)
  dv.setUint16(3, y & 0xffff, true)
  return pkt
}

function makeC2sRemoveFromBuffer(itemId: number): Uint8Array {
  const pkt = new Uint8Array(5)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x19
  dv.setUint32(1, itemId >>> 0, true)
  return pkt
}

function makeC2sEquipItem(itemId: number, bodyLoc: number): Uint8Array {
  const pkt = new Uint8Array(9)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x1a
  dv.setUint32(1, itemId >>> 0, true)
  dv.setUint16(5, bodyLoc & 0xffff, true)
  dv.setUint16(7, 0, true)
  return pkt
}

function makeC2sEntityAction(action: number, npcId: number): Uint8Array {
  const pkt = new Uint8Array(13)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x38
  dv.setUint32(1, action >>> 0, true)
  dv.setUint32(5, npcId >>> 0, true)
  dv.setUint32(9, 0, true)
  return pkt
}

function makeC2sNpcSell(npcId: number, itemId: number): Uint8Array {
  const pkt = new Uint8Array(17)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x33
  dv.setUint32(1, npcId >>> 0, true)
  dv.setUint32(5, itemId >>> 0, true)
  dv.setUint32(9, 0, true)
  dv.setUint32(13, 0, true)
  return pkt
}

function makeC2sNpcRepairSingle(npcId: number, itemId: number): Uint8Array {
  const pkt = new Uint8Array(17)
  const dv = new DataView(pkt.buffer)
  pkt[0] = 0x35
  dv.setUint32(1, npcId >>> 0, true)
  dv.setUint32(5, itemId >>> 0, true)
  dv.setUint32(9, 0, true)
  dv.setUint32(13, 0, true)
  return pkt
}

function bootHeadlessInGame(
  bridge: D2gsKernelBridge113c,
  charClass: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
  clientId = 1,
): number {
  bridge.registerHeadlessClient(clientId, { defaultCharClass: charClass })
  const logon = encodeC2sGameLogon({
    gameHash: 0x11223344,
    gameToken: 1,
    charClass,
    versionByte: 0x0d,
    charName: 'Tester',
  })
  bridge.feedC2SPacket(clientId, logon)
  bridge.feedC2SPacket(clientId, new Uint8Array([0x6b]))
  bridge.drainUncompressedS2CPackets(clientId)
  return clientId
}

describe('[K5 / #2031] Explicit Errors for Silent Fallbacks', () => {
  describe('Fallback 1: TreasureClass drops (no "Act 1 H2H A" fallback)', () => {
    function createFireBallFieldBridge(): { readonly bridge: D2gsKernelBridge113c; readonly clientId: number } {
      const bridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialRightSkill: 47, // Fire Ball
        initialSkillLevels: { 47: 5 },
        initialPlayerStats: { 8: 200 << 8, 9: 200 << 8, 12: 10 },
      })
      const clientId = bootHeadlessInGame(bridge, 1)
      return { bridge, clientId }
    }

    it('throws explicitly on unknown TreasureClass name ("BogusTC_113c") upon monster death', () => {
      const { bridge, clientId } = createFireBallFieldBridge()
      const mon = bridge.spawnMonsterInRoom({
        classId: 19,
        x: 5562,
        y: 5920,
        hp: 1,
        maxHp: 1,
        tcName: 'BogusTC_113c',
      })
      bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x0d, 1, mon.unitId))
      expect(() => bridge.stepFrame()).toThrow(/Unknown 1\.13c TreasureClass "BogusTC_113c"/)
    })

    it('throws explicitly on empty ("") and whitespace-only ("   ") TreasureClass names passed to spawnMonsterInRoom', () => {
      for (const badTc of ['', '   ']) {
        const { bridge, clientId } = createFireBallFieldBridge()
        const mon = bridge.spawnMonsterInRoom({
          classId: 19,
          x: 5562,
          y: 5920,
          hp: 1,
          maxHp: 1,
          tcName: badTc,
        })
        bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x0d, 1, mon.unitId))
        expect(() => bridge.stepFrame()).toThrow(/Missing\/empty 1\.13c TreasureClass name/)
      }
    })

    it('positive control: legitimate wTcId===0 monster (maggotbaby1, classId=180) drops 0 items without throwing', () => {
      const { bridge, clientId } = createFireBallFieldBridge()
      const mon = bridge.spawnMonsterInRoom({
        classId: 180, // maggotbaby1: MonStats.txt tc[0] === ''
        x: 5562,
        y: 5920,
        hp: 1,
        maxHp: 1,
      })
      bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x0d, 1, mon.unitId))
      expect(() => bridge.stepFrame()).not.toThrow()
      expect(bridge.m.get(mon.pMonster, D2UnitStrc.dwAnimMode) >>> 0).toBe(12)
      expect(bridge.getGroundItems().length).toBe(0)
    })

    it('positive control: Fallen (classId=19) with authentic TC dies, grants XP, and drops cleanly; exp=0 rat grants 0 XP', () => {
      const { bridge, clientId } = createFireBallFieldBridge()
      const handle = bridge.registerHeadlessClient(clientId)
      const pPlayer = handle.getPlayerPtr()
      const expBefore = STATLIST_GetUnitStat113c(bridge.m, pPlayer, STAT_EXPERIENCE, 0) >>> 0

      // Kill 0-exp critter/rat (hcIdx=151): must grant 0 XP (C14: no 0 -> 1 clamp)
      const rat = bridge.spawnMonsterInRoom({
        classId: 151,
        x: 5562,
        y: 5920,
        hp: 1,
        maxHp: 1,
      })
      bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x0d, 1, rat.unitId))
      expect(() => bridge.stepFrame()).not.toThrow()
      expect(bridge.m.get(rat.pMonster, D2UnitStrc.dwAnimMode) >>> 0).toBe(12)
      expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, STAT_EXPERIENCE, 0) >>> 0).toBe(expBefore)

      // Kill Fallen (hcIdx=19, authentic TC & exp=18): grants XP and drops cleanly
      const mon = bridge.spawnMonsterInRoom({
        classId: 19,
        x: 5563,
        y: 5920,
        hp: 1,
        maxHp: 1,
      })
      bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x0d, 1, mon.unitId))
      expect(() => bridge.stepFrame()).not.toThrow()
      expect(bridge.m.get(mon.pMonster, D2UnitStrc.dwAnimMode) >>> 0).toBe(12)
      expect(STATLIST_GetUnitStat113c(bridge.m, pPlayer, STAT_EXPERIENCE, 0) >>> 0).toBeGreaterThan(
        expBefore,
      )
      expect(bridge.getGroundItems().length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Fallback 2: Weapon damage range (no literal { min: 1, max: 2 } fallback)', () => {
    function attackUpTo5Frames(
      bridge: D2gsKernelBridge113c,
      clientId: number,
      monUnitId: number,
    ): void {
      for (let i = 0; i < 5; i++) {
        bridge.feedC2SPacket(clientId, makeC2sSkillOnUnit(0x06, 1, monUnitId))
        bridge.stepFrame()
      }
    }

    it('throws explicitly when an unknown item code ("zzz") is equipped in weapon hand slot 4', () => {
      const bridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9001, 'zzz', 4)],
      })
      const clientId = bootHeadlessInGame(bridge, 4)
      const mon = bridge.spawnMonsterInRoom({ classId: 19, x: 5561, y: 5920, hp: 50, maxHp: 50 })
      expect(() => attackUpTo5Frames(bridge, clientId, mon.unitId)).toThrow(
        /Unknown 1\.13c item code "zzz" equipped in weapon hand slot 4/,
      )
    })

    it('throws explicitly when a non-weapon misc item ("hp1") is equipped in weapon hand slot 4', () => {
      const bridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9002, 'hp1', 4)],
      })
      const clientId = bootHeadlessInGame(bridge, 4)
      const mon = bridge.spawnMonsterInRoom({ classId: 19, x: 5561, y: 5920, hp: 50, maxHp: 50 })
      expect(() => attackUpTo5Frames(bridge, clientId, mon.unitId)).toThrow(
        /Non-weapon item code "hp1" \(kind=misc, type=hpot\) cannot be equipped in weapon hand slot 4/,
      )
    })

    it('throws explicitly on non-hand armor ("cap") and validates off-hand slot 5 even when slot 4 holds a valid weapon', () => {
      // (a) Non-hand armor ('cap', type=helm) in hand slot 4 must throw
      const helmBridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9020, 'cap', 4)],
      })
      const cidHelm = bootHeadlessInGame(helmBridge, 4)
      const monHelm = helmBridge.spawnMonsterInRoom({ classId: 19, x: 5561, y: 5920, hp: 50, maxHp: 50 })
      expect(() => attackUpTo5Frames(helmBridge, cidHelm, monHelm.unitId)).toThrow(
        /Non-weapon item code "cap" \(kind=armor, type=helm\) cannot be equipped in weapon hand slot 4/,
      )

      // (b) Order-independent off-hand validation: valid slot 4 'ssd' BEFORE unknown slot 5 'zzz' must throw
      const offhandUnknown = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9021, 'ssd', 4), makeEquippedItem(9022, 'zzz', 5)],
      })
      const cidU = bootHeadlessInGame(offhandUnknown, 4)
      const monU = offhandUnknown.spawnMonsterInRoom({ classId: 19, x: 5561, y: 5920, hp: 50, maxHp: 50 })
      expect(() => attackUpTo5Frames(offhandUnknown, cidU, monU.unitId)).toThrow(
        /Unknown 1\.13c item code "zzz" equipped in weapon hand slot 5/,
      )

      // (c) Order-independent off-hand validation: valid slot 4 'ssd' BEFORE non-hand misc slot 5 'hp1' must throw
      const offhandMisc = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9023, 'ssd', 4), makeEquippedItem(9024, 'hp1', 5)],
      })
      const cidM = bootHeadlessInGame(offhandMisc, 4)
      const monM = offhandMisc.spawnMonsterInRoom({ classId: 19, x: 5561, y: 5920, hp: 50, maxHp: 50 })
      expect(() => attackUpTo5Frames(offhandMisc, cidM, monM.unitId)).toThrow(
        /Non-weapon item code "hp1" \(kind=misc, type=hpot\) cannot be equipped in weapon hand slot 5/,
      )
    })

    it('positive control: 1.13c hand-slot quivers (aqv Arrows & cqv Bolts) with bow/crossbow and unarmed succeed cleanly', () => {
      // (a) Public C2S 0x19/0x1A equip of Arrows ('aqv' -> slot 5) BEFORE Short Bow ('sbw' -> slot 4), then C2S 0x06 Attack
      const c2sQuiverBridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 0: 50, 2: 200, 12: 50 },
        initialItems: [makeInventoryItem(9030, 'aqv', 0, 0), makeInventoryItem(9031, 'sbw', 2, 0)],
      })
      const cidC2s = bootHeadlessInGame(c2sQuiverBridge, 0)
      c2sQuiverBridge.feedC2SPacket(cidC2s, makeC2sRemoveFromBuffer(9030))
      c2sQuiverBridge.feedC2SPacket(cidC2s, makeC2sEquipItem(9030, 5))
      c2sQuiverBridge.feedC2SPacket(cidC2s, makeC2sRemoveFromBuffer(9031))
      c2sQuiverBridge.feedC2SPacket(cidC2s, makeC2sEquipItem(9031, 4))
      c2sQuiverBridge.stepFrame()
      const zC2s = c2sQuiverBridge.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      expect(() => attackUpTo5Frames(c2sQuiverBridge, cidC2s, zC2s.unitId)).not.toThrow()
      expect(STATLIST_GetUnitStat113c(c2sQuiverBridge.m, zC2s.pMonster, STAT_HITPOINTS, 0) >> 8).toBeLessThan(200)

      // (b) initialItems: [aqv@5, sbw@4] (quiver ordered before bow)
      const bowQuiver = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 0: 50, 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9032, 'aqv', 5), makeEquippedItem(9033, 'sbw', 4)],
      })
      const cidBow = bootHeadlessInGame(bowQuiver, 0)
      const zBow = bowQuiver.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      expect(() => attackUpTo5Frames(bowQuiver, cidBow, zBow.unitId)).not.toThrow()
      expect(STATLIST_GetUnitStat113c(bowQuiver.m, zBow.pMonster, STAT_HITPOINTS, 0) >> 8).toBeLessThan(200)

      // (c) initialItems: [cqv@5, lxb@4] (Bolts ordered before Light Crossbow)
      const xbowQuiver = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 0: 50, 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9034, 'cqv', 5), makeEquippedItem(9035, 'lxb', 4)],
      })
      const cidXbow = bootHeadlessInGame(xbowQuiver, 0)
      const zXbow = xbowQuiver.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      expect(() => attackUpTo5Frames(xbowQuiver, cidXbow, zXbow.unitId)).not.toThrow()
      expect(STATLIST_GetUnitStat113c(xbowQuiver.m, zXbow.pMonster, STAT_HITPOINTS, 0) >> 8).toBeLessThan(200)

      // (d) Quiver-only [aqv@5] unarmed combat falls back to STAT_MINDAMAGE/STAT_MAXDAMAGE cleanly
      const quiverOnly = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9036, 'aqv', 5)],
      })
      const cidQ = bootHeadlessInGame(quiverOnly, 0)
      const zQ = quiverOnly.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      expect(() => attackUpTo5Frames(quiverOnly, cidQ, zQ.unitId)).not.toThrow()
      expect(STATLIST_GetUnitStat113c(quiverOnly.m, zQ.pMonster, STAT_HITPOINTS, 0) >> 8).toBeLessThan(200)
    })

    it('positive control: bare-handed combat reads STAT_MINDAMAGE/STAT_MAXDAMAGE (0x6FCFC5A2) and shield-only ("buc") succeeds', () => {
      // (a) Unarmed with STAT_MINDAMAGE(21)=10, STAT_MAXDAMAGE(22)=15
      const unarmed = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 0: 0, 2: 200, 12: 50, 21: 10, 22: 15 },
        initialItems: [],
      })
      const cidA = bootHeadlessInGame(unarmed, 4)
      const zA = unarmed.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      const startHpA = STATLIST_GetUnitStat113c(unarmed.m, zA.pMonster, STAT_HITPOINTS, 0) >> 8
      expect(() => attackUpTo5Frames(unarmed, cidA, zA.unitId)).not.toThrow()
      const endHpA = STATLIST_GetUnitStat113c(unarmed.m, zA.pMonster, STAT_HITPOINTS, 0) >> 8
      expect(startHpA - endHpA).toBeGreaterThanOrEqual(10)

      // (b) Shield-only ('buc' in hand slot 5) succeeds without throwing
      const shieldOnly = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialPlayerStats: { 2: 200, 12: 50 },
        initialItems: [makeEquippedItem(9003, 'buc', 5)],
      })
      const cidB = bootHeadlessInGame(shieldOnly, 3)
      const zB = shieldOnly.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
      expect(() => attackUpTo5Frames(shieldOnly, cidB, zB.unitId)).not.toThrow()
      const endHpB = STATLIST_GetUnitStat113c(shieldOnly.m, zB.pMonster, STAT_HITPOINTS, 0) >> 8
      expect(endHpB).toBeLessThan(200)
    })

    it('positive control: 1H ("ssd") and 2H-only ("sbw") weapons attack cleanly', () => {
      for (const code of ['ssd', 'sbw']) {
        const bridge = new D2gsKernelBridge113c({
          areaId: 2,
          spawnX: 5560,
          spawnY: 5920,
          initialLeftSkill: 0,
          initialPlayerStats: { 2: 200, 12: 50 },
          initialItems: [makeEquippedItem(9010, code, 4)],
        })
        const cid = bootHeadlessInGame(bridge, 0)
        const zombie = bridge.spawnMonsterInRoom({ classId: 5, x: 5561, y: 5920, hp: 200, maxHp: 200 })
        expect(() => attackUpTo5Frames(bridge, cid, zombie.unitId)).not.toThrow()
        const endHp = STATLIST_GetUnitStat113c(bridge.m, zombie.pMonster, STAT_HITPOINTS, 0) >> 8
        expect(endHp, `weapon ${code} should deal damage`).toBeLessThan(200)
      }
    })
  })

  describe('Fallback 3: Character class lookups (no silent "sor"/"Sorceress"/0/6 defaults)', () => {
    it('rejects invalid rawClass=99 in 0x68 GameLogon with RangeError (D2Game.dll:0x6FC4A7A6)', () => {
      const bridge = new D2gsKernelBridge113c({ areaId: 1 })
      bridge.registerHeadlessClient(1)
      const pkt = encodeC2sGameLogon({
        gameHash: 0x11223344,
        gameToken: 1,
        charClass: 1,
        versionByte: 0x0d,
        charName: 'BadClass',
      })
      pkt[7] = 99
      expect(() => bridge.feedC2SPacket(1, pkt)).toThrow(RangeError)
      expect(() => bridge.feedC2SPacket(1, pkt)).toThrow(/Invalid 1\.13c character class ID: 99/)
    })

    it('rejects invalid numeric, non-decimal, and unknown string classId/charClass in LocalKernelD2gsAdapter113c ctor', () => {
      expect(() => new LocalKernelD2gsAdapter113c({ classId: 99 })).toThrow(RangeError)
      expect(() => new LocalKernelD2gsAdapter113c({ classId: -1 })).toThrow(RangeError)
      expect(() => new LocalKernelD2gsAdapter113c({ classId: 1.5 })).toThrow(RangeError)
      expect(() => new LocalKernelD2gsAdapter113c({ charClass: 'monk' })).toThrow(RangeError)
      expect(() => new LocalKernelD2gsAdapter113c({ charClass: '' })).toThrow(RangeError)
      for (const nonDecimal of ['0x1', '0b1', '0o5', '1e0', '+1', '-0', '01']) {
        expect(() => new LocalKernelD2gsAdapter113c({ charClass: nonDecimal }), nonDecimal).toThrow(
          RangeError,
        )
      }
      // Valid decimal '0'..'6' and case-insensitive class codes still accepted
      expect(() => new LocalKernelD2gsAdapter113c({ charClass: '1' })).not.toThrow()
      expect(() => new LocalKernelD2gsAdapter113c({ charClass: 'SOR' })).not.toThrow()
    })

    it('exported strict class helpers reject out-of-range inputs and match canonical 1.13c values for 0..6', () => {
      for (const bad of [-1, 7, 99, Number.NaN, 1.5]) {
        expect(() => requireValidCharClassId113c(bad)).toThrow(RangeError)
        expect(() => requireCharClassCode113c(bad)).toThrow(RangeError)
        expect(() => requireCharClassName113c(bad)).toThrow(RangeError)
        expect(() => requireClassSkillBase113c(bad)).toThrow(RangeError)
      }

      const expectedCodes = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'] as const
      const expectedNames = [
        'Amazon',
        'Sorceress',
        'Necromancer',
        'Paladin',
        'Barbarian',
        'Druid',
        'Assassin',
      ] as const
      const expectedBases = [6, 36, 66, 96, 126, 221, 251] as const

      for (let id = 0; id <= 6; id++) {
        expect(requireValidCharClassId113c(id)).toBe(id)
        expect(requireCharClassCode113c(id)).toBe(expectedCodes[id])
        expect(requireCharClassName113c(id)).toBe(expectedNames[id])
        expect(requireClassSkillBase113c(id)).toBe(expectedBases[id])
      }
    })
  })

  describe('Fallback 4: Monster stats (no 128 / 0 / 18 fallback)', () => {
    it('throws explicitly on unknown, boundary, negative, and 32-bit wrap-around monster classId in spawnMonsterInRoom', () => {
      const bridge = new D2gsKernelBridge113c({ areaId: 2 })
      expect(() => bridge.spawnMonsterInRoom({ classId: 9999, x: 5560, y: 5920 })).toThrow(
        /Unknown 1\.13c MonStats classId=9999/,
      )
      expect(() => bridge.spawnMonsterInRoom({ classId: 734, x: 5560, y: 5920 })).toThrow(
        /Unknown 1\.13c MonStats classId=734/,
      )
      expect(() => bridge.spawnMonsterInRoom({ classId: -1, x: 5560, y: 5920 })).toThrow(
        RangeError,
      )
      expect(() => bridge.spawnMonsterInRoom({ classId: 0x100000000, x: 5560, y: 5920 })).toThrow(
        RangeError,
      )
      expect(() => bridge.spawnMonsterInRoom({ classId: 0x100000013, x: 5560, y: 5920 })).toThrow(
        RangeError,
      )
      expect(() => bridge.spawnMonsterInRoom({ classId: 0x20000009a, x: 5560, y: 5920 })).toThrow(
        RangeError,
      )
    })

    it('positive control: all 11 canonical town NPCs spawn with 0/0/0 stats and emit S2C 0xAC lifePct=128', () => {
      const bridge = new D2gsKernelBridge113c({ areaId: 1, spawnX: 5560, spawnY: 5920 })
      const cid = bootHeadlessInGame(bridge, 1)
      const npcIds = [146, 147, 148, 150, 154, 155, 176, 178, 255, 405, 513]

      for (let i = 0; i < npcIds.length; i++) {
        const classId = npcIds[i]!
        const spawned = bridge.spawnMonsterInRoom({ classId, x: 5562 + i, y: 5920 })
        expect(STATLIST_GetUnitStat113c(bridge.m, spawned.pMonster, STAT_MAXHP, 0)).toBe(0)
        expect(STATLIST_GetUnitStat113c(bridge.m, spawned.pMonster, STAT_EXPERIENCE, 0)).toBe(0)
        const pkts = bridge.drainUncompressedS2CPackets(cid)
        const acPkt = pkts.find((p) => p.opcode === 0xac)
        expect(acPkt, `NPC classId=${classId} must emit S2C 0xAC`).toBeDefined()
        // S2C 0xAC byte[11] is bLifePct (`0x80` = 128 per MONSTER_GetLifeByte113c)
        expect(acPkt!.bytes[11]).toBe(128)
      }
    })

    it('positive control: combat monsters compute exact MonStats x MonLvl stats (not 128/18 fallback) and exp=0 stays 0', () => {
      const bridge = new D2gsKernelBridge113c({ areaId: 2, spawnX: 5560, spawnY: 5920 })
      const fallen = bridge.spawnMonsterInRoom({ classId: 19, x: 5562, y: 5920 })
      const fallenMaxHp = STATLIST_GetUnitStat113c(bridge.m, fallen.pMonster, STAT_MAXHP, 0) >> 8
      const fallenExp = STATLIST_GetUnitStat113c(bridge.m, fallen.pMonster, STAT_EXPERIENCE, 0)
      expect(fallenMaxHp).toBeGreaterThanOrEqual(1)
      expect(fallenMaxHp).toBeLessThanOrEqual(4)
      expect(fallenMaxHp).not.toBe(128)
      expect(fallenExp).toBe(18)

      const skel = bridge.spawnMonsterInRoom({ classId: 0, x: 5563, y: 5920 })
      const skelMaxHp = STATLIST_GetUnitStat113c(bridge.m, skel.pMonster, STAT_MAXHP, 0) >> 8
      expect(skelMaxHp).toBeGreaterThanOrEqual(1)
      expect(skelMaxHp).not.toBe(128)

      const rat = bridge.spawnMonsterInRoom({ classId: 151, x: 5564, y: 5920 })
      expect(STATLIST_GetUnitStat113c(bridge.m, rat.pMonster, STAT_EXPERIENCE, 0)).toBe(0)
    })
  })

  describe('Swept silent fallbacks: bare catch{}, item grid size, vendor tx, area/act/difficulty, skills', () => {
    it('LocalKernelD2gsAdapter113c.leave() propagates onAutoSave errors AND completes cleanup in finally', () => {
      let closeEvents = 0
      const adapter = new LocalKernelD2gsAdapter113c({
        onAutoSave: () => {
          throw new Error('save write failed')
        },
      })
      adapter.onClose(() => {
        closeEvents++
      })
      expect(() => adapter.leave()).toThrow('save write failed')
      expect(adapter.state).toBe('closed')
      expect(closeEvents).toBe(1)
    })

    it('getItemGridSize throws on unknown item code via spawnGroundItemInRoom', () => {
      const bridge = new D2gsKernelBridge113c({ areaId: 1 })
      expect(() => bridge.spawnGroundItemInRoom({ code: 'zzz' }, 5560, 5920)).toThrow(
        /Unknown 1\.13c item code "zzz" in getItemGridSize/,
      )
    })

    it('vendor sell (0x33) propagates computeTransactionCost113c error on unknown item code', () => {
      const bridge = new D2gsKernelBridge113c({
        areaId: 1,
        spawnX: 5560,
        spawnY: 5920,
        initialItems: [makeInventoryItem(9101, 'zzz', 0, 0)],
      })
      const cid = bootHeadlessInGame(bridge, 1)
      const charsi = bridge.spawnMonsterInRoom({ classId: 154, x: 5561, y: 5920 })
      bridge.feedC2SPacket(cid, makeC2sEntityAction(1, charsi.unitId))
      bridge.stepFrame()
      bridge.feedC2SPacket(cid, makeC2sNpcSell(charsi.unitId, 9101))
      expect(() => bridge.stepFrame()).toThrow(/zzz|Unknown|missing/i)
    })

    it('vendor single repair (0x35) propagates computeTransactionCost113c error on damaged unknown item code', () => {
      const bridge = new D2gsKernelBridge113c({
        areaId: 1,
        spawnX: 5560,
        spawnY: 5920,
        initialPlayerStats: { 14: 10000 },
        initialItems: [makeEquippedItem(9102, 'zzz', 1, 1, 10)],
      })
      const cid = bootHeadlessInGame(bridge, 1)
      const charsi = bridge.spawnMonsterInRoom({ classId: 154, x: 5561, y: 5920 })
      bridge.feedC2SPacket(cid, makeC2sNpcRepairSingle(charsi.unitId, 9102))
      expect(() => bridge.stepFrame()).toThrow(/zzz|Unknown|missing/i)
    })

    it('area/act/difficulty validators and constructors reject out-of-range and contradictory (act, areaId) values with RangeError', () => {
      expect(() => areaIdToActIdx113c(0)).toThrow(RangeError)
      expect(() => areaIdToActIdx113c(137)).toThrow(RangeError)
      expect(() => areaIdToActIdx113c(-5)).toThrow(RangeError)
      expect(() => requireValidActIdx113c(-1)).toThrow(RangeError)
      expect(() => requireValidActIdx113c(5)).toThrow(RangeError)
      expect(() => requireTownAreaForAct113c(5)).toThrow(RangeError)
      expect(() => requireValidDifficulty113c(-1)).toThrow(RangeError)
      expect(() => requireValidDifficulty113c(3)).toThrow(RangeError)
      expect(() => new D2gsKernelBridge113c({ areaId: 999 })).toThrow(RangeError)
      expect(() => new D2gsKernelBridge113c({ areaId: 0 })).toThrow(RangeError)
      expect(() => new D2gsKernelBridge113c({ act: 4, areaId: 1 })).toThrow(RangeError)
      expect(() => new D2gsKernelBridge113c({ act: 0, areaId: 1 })).not.toThrow()
      expect(() => new LocalKernelD2gsAdapter113c({ areaId: 0 })).toThrow(RangeError)
    })

    it('skill ID validators reject out-of-range/non-decimal initial skills and monster-only skill casts while allowing Attack(0) & Fire Bolt(36)', () => {
      expect(() => new D2gsKernelBridge113c({ initialLeftSkill: 999 })).toThrow(RangeError)
      expect(() => new D2gsKernelBridge113c({ initialSkillLevels: { 999: 1 } })).toThrow(RangeError)
      for (const badKey of ['0x24', '36.0', ' 36 ', '0', '']) {
        const badMap: Readonly<Record<string, number>> = { [badKey]: 1 }
        expect(
          () => new D2gsKernelBridge113c({ initialSkillLevels: badMap }),
          `initialSkillLevels key "${badKey}" must throw RangeError`,
        ).toThrow(RangeError)
      }

      const badCastBridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialRightSkill: 200, // monster-only skill not in SKILLS_BY_ID
        initialSkillLevels: { 200: 1 },
      })
      const cidBad = bootHeadlessInGame(badCastBridge, 1)
      badCastBridge.feedC2SPacket(cidBad, makeC2sSkillOnLoc(0x0c, 5562, 5920))
      expect(() => badCastBridge.stepFrame()).toThrow(/Unknown 1\.13c player skillId=200/)

      // Positive control: Attack (0) and Fire Bolt (36) succeed
      const okBridge = new D2gsKernelBridge113c({
        areaId: 2,
        spawnX: 5560,
        spawnY: 5920,
        initialLeftSkill: 0,
        initialRightSkill: 36,
        initialSkillLevels: { 36: 1 },
        initialPlayerStats: { 8: 50 << 8, 9: 50 << 8 },
      })
      const cidOk = bootHeadlessInGame(okBridge, 1)
      okBridge.feedC2SPacket(cidOk, makeC2sSkillOnLoc(0x05, 5562, 5920))
      okBridge.feedC2SPacket(cidOk, makeC2sSkillOnLoc(0x0c, 5562, 5920))
      expect(() => okBridge.stepFrame()).not.toThrow()
    })

    it('adoptSnapshot validates required memory and pGame options explicitly', () => {
      expect(() => new D2gsKernelBridge113c({ adoptSnapshot: true })).toThrow(
        /adoptSnapshot requires pre-hydrated options\.memory/,
      )
      const tempBridge = new D2gsKernelBridge113c({ areaId: 1 })
      expect(
        () => new D2gsKernelBridge113c({ adoptSnapshot: true, memory: tempBridge.m, pGame: 0 }),
      ).toThrow(/adoptSnapshot requires non-zero options\.pGame/)
    })

    it('static regression guard: forbidden silent-fallback patterns and DEFAULT_* constants are absent from bridge & adapter', () => {
      const bridgeSrc = readFileSync(
        resolve(REPO_ROOT, 'src/server/net/d2gs-kernel-bridge-113c.ts'),
        'utf8',
      )
      const adapterSrc = readFileSync(
        resolve(REPO_ROOT, 'src/server/net/local-kernel-d2gs-adapter-113c.ts'),
        'utf8',
      )
      const combined = `${bridgeSrc}\n${adapterSrc}`

      const forbiddenPatterns: ReadonlyArray<readonly [string, RegExp]> = [
        ['Act 1 H2H A', /Act 1 H2H A/],
        ['return { min: 1, max: 2 }', /return\s*\{\s*min:\s*1,\s*max:\s*2\s*\}/],
        ["?? 'sor'", /\?\?\s*'sor'/],
        ["?? 'Sorceress'", /\?\?\s*'Sorceress'/],
        ['?? 6', /\?\?\s*6\b/],
        ['computedMaxHp = 128', /computedMaxHp\s*=\s*128\b/],
        ['computedBaseExp = 18', /computedBaseExp\s*=\s*18\b/],
        ['DEFAULT_ constant', /\bDEFAULT_[A-Z0-9_]+\b/],
      ]
      for (const [label, re] of forbiddenPatterns) {
        expect(re.test(combined), `Forbidden silent fallback resurfaced: ${label}`).toBe(false)
      }

      // Zero bare `catch {` in local-kernel-d2gs-adapter-113c.ts
      expect(/\bcatch\s*\{/.test(adapterSrc), 'Bare catch{} forbidden in adapter').toBe(false)

      // Zero bare `catch {` in bridge vendor buy/sell/repair handlers (between handleC2SBuyItem and handleC2SClickButton)
      const buyStart = bridgeSrc.indexOf('private handleC2SBuyItem(')
      const clickStart = bridgeSrc.indexOf('private handleC2SClickButton(')
      expect(buyStart).toBeGreaterThan(0)
      expect(clickStart).toBeGreaterThan(buyStart)
      const vendorRegion = bridgeSrc.slice(buyStart, clickStart)
      expect(/\bcatch\s*\{/.test(vendorRegion), 'Bare catch{} forbidden in bridge vendor handlers').toBe(false)
    })
  })
})
