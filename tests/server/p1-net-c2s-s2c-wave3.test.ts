import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import * as Netproto from '../../src/netproto/index.ts'
import * as Server from '../../src/server/index.ts'

function createD2gsClientRig(
  host: Server.MultiClientRoomHost,
  opts: {
    readonly charName: string
    readonly classId: Netproto.CharClassId
    readonly level?: number
    readonly areaId?: number
    readonly x?: number
    readonly y?: number
    readonly d2s?: Uint8Array
    readonly tap?: Netproto.InMemoryPacketTap
  },
) {
  const [clientStream, serverStream] = Netproto.createMemoryStreamPair()
  const rawS2cPackets: Uint8Array[] = []
  const s2cFramer = new Netproto.D2gsS2cFramer()

  const tappedStream: Netproto.ByteStream = {
    label: clientStream.label,
    write(chunk: Uint8Array): void {
      opts.tap?.record({
        t: 0,
        conn: 'game',
        dir: 'c2s',
        raw: new Uint8Array(chunk),
        isRawStreamChunk: true,
      })
      clientStream.write(chunk)
    },
    onData(cb: (chunk: Uint8Array) => void): () => void {
      return clientStream.onData((chunk) => {
        opts.tap?.record({
          t: 0,
          conn: 'game',
          dir: 's2c',
          raw: new Uint8Array(chunk),
          isRawStreamChunk: true,
        })
        for (const frame of s2cFramer.push(chunk)) {
          rawS2cPackets.push(new Uint8Array(frame.bytes))
        }
        cb(chunk)
      })
    },
    onClose: (cb) => clientStream.onClose(cb),
    close: (reason) => clientStream.close(reason),
  }

  const roomSession = host.attachClient(serverStream, {
    charName: opts.charName,
    classId: opts.classId,
    level: opts.level ?? 30,
    areaId: opts.areaId ?? 1,
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    d2s: opts.d2s,
    protocol: 'd2gs',
  })

  const adapter = new Netproto.D2gsAdapter(tappedStream, {
    charName: opts.charName,
    classId: opts.classId,
  })
  const world = new ClientWorld()
  const events: Netproto.ServerEvent[] = []
  adapter.onEvent((ev) => {
    events.push(ev)
    world.apply(ev)
  })
  host.stepFrame()

  return {
    roomSession,
    playerUnitId: roomSession.playerUnitId,
    adapter,
    world,
    events,
    rawS2cPackets,
  }
}

describe('Wave 3 P1 Binary C2S/S2C Protocol Parity (#1844..#1855)', () => {
  describe('#1844: C2S 0x32 (BuyItemFromNpc) gamble low-word flag & Shift bulk-fill (0x80000000)', () => {
    it('decodes low-word gamble flag (0x02) and high-bit shiftFill (0x80000000) without shifting 16 bits', () => {
      const gamblePkt = Netproto.encodeC2sNpcBuy({
        npcId: 77,
        itemId: 501,
        itemMode: 4,
        gamble: true,
        shiftFill: false,
        cost: 1500,
      })
      const decodedGamble = Server.decodeD2gsC2sPacketToCommand(gamblePkt)
      expect(decodedGamble).toMatchObject({
        type: 'NpcBuy',
        npcId: 77,
        itemId: 501,
        gamble: true,
        shiftFill: false,
      })

      const shiftPkt = Netproto.encodeC2sNpcBuy({
        npcId: 77,
        itemId: 502,
        itemMode: 4,
        gamble: false,
        shiftFill: true,
        cost: 80,
      })
      const decodedShift = Server.decodeD2gsC2sPacketToCommand(shiftPkt)
      expect(decodedShift).toMatchObject({
        type: 'NpcBuy',
        npcId: 77,
        itemId: 502,
        gamble: false,
        shiftFill: true,
      })
    })

    it('Shift+NpcBuy bulk-fills Tome of Town Portal to 20, keys to 12, and belt columns up to beltRows/gold over D2GS', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18440001,
        areaId: 1,
      })
      const rig = createD2gsClientRig(host, {
        charName: 'BulkBuyer',
        classId: 1,
        level: 25,
        x: 100,
        y: 100,
      })
      const game = host.game
      const player = (game as any).players.get(rig.playerUnitId)!
      player.gold = 50_000
      player.items = [
        // Equipped Plated Belt (4 rows = 16 slots)
        {
          unitId: 9001,
          code: 'hbl',
          name: 'Plated Belt',
          quality: 2,
          level: 20,
          location: 'equipped',
          x: 0,
          y: 0,
          width: 2,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 8,
          storePage: 0,
          cost: 100,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 24,
          maxDurability: 24,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        // Unfilled Tome of Town Portal with 3 scrolls
        {
          unitId: 9002,
          code: 'tbk',
          name: 'Tome of Town Portal',
          quality: 2,
          level: 1,
          location: 'inventory',
          x: 0,
          y: 0,
          width: 1,
          height: 2,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 1,
          cost: 400,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 3,
          stats: new Map([[70, 3]]),
          socketedItems: [],
        },
      ]

      const akaraId = game.spawnMonster({
        hcIdx: 148,
        areaId: 1,
        x: 101,
        y: 100,
        isNpc: true,
        isVendor: true,
      })
      const akara = (game as any).monsters.get(akaraId)!
      akara.vendorPool = [
        {
          unitId: 9101,
          code: 'tsc',
          name: 'Scroll of Town Portal',
          quality: 2,
          level: 1,
          location: 'vendor',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: akaraId,
          bodyLoc: 0,
          storePage: 4,
          cost: 80,
          permStore: true,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        {
          unitId: 9102,
          code: 'key',
          name: 'Key',
          quality: 2,
          level: 1,
          location: 'vendor',
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: akaraId,
          bodyLoc: 0,
          storePage: 4,
          cost: 36,
          permStore: true,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        {
          unitId: 9103,
          code: 'hp1',
          name: 'Minor Healing Potion',
          quality: 2,
          level: 1,
          location: 'vendor',
          x: 2,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: akaraId,
          bodyLoc: 0,
          storePage: 4,
          cost: 30,
          permStore: true,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
      ]
      akara.vendorStoreGenerated = true
      player.activeNpcId = akaraId
      player.activeVendorMode = 'trade'
      player.vendorPools.set(akaraId, akara.vendorPool)

      // 1. Shift-buy TP scroll -> fills tbk from 3 to 20 (+17 scrolls)
      rig.adapter.send({
        type: 'NpcBuy',
        npcId: akaraId,
        itemId: 9101,
        buyType: 0,
        shiftFill: true,
        cost: 80,
      })
      host.stepFrame()
      const tbk = player.items.find((i: any) => i.unitId === 9002)!
      expect(tbk.quantity).toBe(20)

      // 2. Shift-buy keys -> creates 12-key stack in inventory
      rig.adapter.send({
        type: 'NpcBuy',
        npcId: akaraId,
        itemId: 9102,
        buyType: 0,
        shiftFill: true,
        cost: 36,
      })
      host.stepFrame()
      const keyStack = player.items.find((i: any) => i.code === 'key' && i.location === 'inventory')!
      expect(keyStack).toBeDefined()
      expect(keyStack.quantity).toBe(12)

      // 3. Shift-buy healing potions -> fills all 16 belt slots
      rig.adapter.send({
        type: 'NpcBuy',
        npcId: akaraId,
        itemId: 9103,
        buyType: 0,
        shiftFill: true,
        cost: 30,
      })
      host.stepFrame()
      const beltPotions = player.items.filter((i: any) => i.location === 'belt')
      expect(beltPotions).toHaveLength(16)

      // 4. Gamble purchase via binary C2S 0x32 with gamble=true on Gheed (hcIdx = 147)
      const gheedId = game.spawnMonster({
        hcIdx: 147,
        areaId: 1,
        x: 100,
        y: 101,
        isNpc: true,
        isVendor: true,
      })
      const invBeforeGamble = new Set(player.items.map((i: any) => i.unitId))
      rig.adapter.send({
        type: 'NpcEntityAction',
        action: 2,
        npcId: gheedId,
        complement: 0,
      })
      host.stepFrame()
      const gamblePool = player.vendorPools.get(gheedId)!
      expect(gamblePool.length).toBeGreaterThan(0)
      const gTarget = gamblePool[0]!
      rig.adapter.send({
        type: 'NpcBuy',
        npcId: gheedId,
        itemId: gTarget.unitId,
        gamble: true,
        cost: 1000,
      })
      host.stepFrame()
      const boughtGambled = player.items.find((i: any) => !invBeforeGamble.has(i.unitId))
      expect(boughtGambled).toBeDefined()
      expect(boughtGambled.quality).toBeGreaterThanOrEqual(4)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1845: C2S 0x3A (AddStatPoint) exact count-minus-one multi-point decoding', () => {
    it('decodes single-point (0 -> 1) and multi-point (4 -> 5, 99 -> 100) without off-by-one loss', () => {
      for (const expectedCount of [1, 5, 10, 100]) {
        const pkt = Netproto.encodeC2sAddStatPoint(0, expectedCount)
        expect(pkt[2]).toBe(expectedCount - 1)
        const cmd = Server.decodeD2gsC2sPacketToCommand(pkt)
        expect(cmd).toEqual({
          type: 'AllocateStat',
          statId: 0,
          amount: expectedCount,
        })
      }

      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18450001,
        areaId: 1,
      })
      const rig = createD2gsClientRig(host, { charName: 'StatHero', classId: 4, level: 20 })
      const player = (host.game as any).players.get(rig.playerUnitId)!
      const baseStr = player.strength
      player.statPts = 12

      rig.adapter.send({ type: 'AllocateStat', statId: 0, amount: 5 })
      host.stepFrame()
      expect(player.strength).toBe(baseStr + 5)
      expect(player.statPts).toBe(7)

      // Caps cleanly at remaining statPts (7) when requesting +10
      rig.adapter.send({ type: 'AllocateStat', statId: 0, amount: 10 })
      host.stepFrame()
      expect(player.strength).toBe(baseStr + 12)
      expect(player.statPts).toBe(0)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1846: Belt C2S 0x24 (RemoveBeltItem), 0x25 (SwapBeltItem), 0x26 (UseBeltItem Shift Merc), 0x63 (ItemToBelt)', () => {
    it('picks belt potion to cursor without drinking (0x24), shifts upper column down, swaps (0x25), auto-belts (0x63), and Shift-heals mercenary (0x26)', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18460001,
        areaId: 1,
      })
      const rig = createD2gsClientRig(host, { charName: 'BeltHero', classId: 3, level: 30 })
      const game = host.game
      const player = (game as any).players.get(rig.playerUnitId)!
      player.items = [
        // Equipped Sash (2 rows = 8 slots)
        {
          unitId: 7000,
          code: 'lbl',
          name: 'Sash',
          quality: 2,
          level: 5,
          location: 'equipped',
          x: 0,
          y: 0,
          width: 2,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 8,
          storePage: 0,
          cost: 50,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 12,
          maxDurability: 12,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        // Column 0 row 0 (slot 0)
        {
          unitId: 7001,
          code: 'rvs',
          name: 'Rejuvenation Potion',
          quality: 2,
          level: 1,
          location: 'belt',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 0,
          cost: 50,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        // Column 0 row 1 (slot 4)
        {
          unitId: 7002,
          code: 'rvl',
          name: 'Full Rejuvenation Potion',
          quality: 2,
          level: 1,
          location: 'belt',
          x: 0,
          y: 1,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 0,
          cost: 100,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        // Inventory potion for 0x63 ItemToBelt & mana potion to test merc rejection
        {
          unitId: 7003,
          code: 'hp4',
          name: 'Greater Healing Potion',
          quality: 2,
          level: 1,
          location: 'inventory',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 1,
          cost: 100,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
        {
          unitId: 7004,
          code: 'mp3',
          name: 'Mana Potion',
          quality: 2,
          level: 1,
          location: 'belt',
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 0,
          cost: 80,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
      ]

      // Spawn a damaged alive mercenary owned by player (hp = 100 / 400)
      const mercId = game.hireMercenary(rig.playerUnitId, {
        act: 1,
        level: 25,
        hp: 100,
        maxHp: 400,
        x: 101,
        y: 100,
      })

      // 1. C2S 0x24 BeltRemove(7001): moves 7001 to cursor WITHOUT consuming, and shifts 7002 down to row 0!
      player.hp = 50
      player.hpFixed = 50 * 256
      rig.adapter.send({ type: 'BeltRemove', itemId: 7001 })
      host.stepFrame()

      const p7001 = player.items.find((i: any) => i.unitId === 7001)!
      const p7002 = player.items.find((i: any) => i.unitId === 7002)!
      expect(p7001.location).toBe('cursor')
      expect(player.hp).toBe(50) // NOT consumed!
      expect(p7002.location).toBe('belt')
      expect(p7002.x).toBe(0)
      expect(p7002.y).toBe(0) // Shifted down from row 1 to row 0!
      expect(rig.world.containers.cursor?.id).toBe(7001)

      // 2. C2S 0x25 BeltSwap(7001 on cursor <-> 7002 in belt slot 0)
      rig.adapter.send({ type: 'BeltSwap', cursorItemId: 7001, beltItemId: 7002 })
      host.stepFrame()
      expect(p7001.location).toBe('belt')
      expect(p7001.x).toBe(0)
      expect(p7001.y).toBe(0)
      expect(p7002.location).toBe('cursor')
      expect(rig.world.containers.cursor?.id).toBe(7002)

      // Put 7002 back into belt slot 4 (col 0, row 1)
      rig.adapter.send({ type: 'BeltPut', itemId: 7002, slot: 4 })
      host.stepFrame()
      expect(p7002.location).toBe('belt')
      expect(p7002.y).toBe(1)

      // 3. C2S 0x63 ItemToBelt(7003): moves hp4 from inventory into belt col 2 row 0
      rig.adapter.send({ type: 'ItemToBelt', itemId: 7003 })
      host.stepFrame()
      const p7003 = player.items.find((i: any) => i.unitId === 7003)!
      expect(p7003.location).toBe('belt')
      expect(p7003.x).toBe(2)
      expect(p7003.y).toBe(0)

      // 4. C2S 0x26 BeltUse with shift=true on mana potion (7004): rejected for merc (sound 19, not consumed)
      rig.adapter.send({ type: 'BeltUse', itemId: 7004, shift: true })
      host.stepFrame()
      expect(player.items.some((i: any) => i.unitId === 7004)).toBe(true)

      // 5. C2S 0x26 BeltUse with shift=true on rvs (7001): heals merc by +35% of 400 = +140 (100 -> 240), shifts 7002 down!
      const merc = (game as any).mercenaries.get(mercId)!
      merc.hp = 100
      merc.regenCarry256 = 0
      rig.adapter.send({ type: 'BeltUse', itemId: 7001, shift: true })
      host.stepFrame()
      expect(merc.hp).toBe(240)
      expect(player.hp).toBe(50) // Player HP unchanged
      expect(player.items.some((i: any) => i.unitId === 7001)).toBe(false)
      expect(p7002.y).toBe(0) // 7002 shifted down to row 0!

      // 6. C2S 0x26 BeltUse with shift=true on rvl (7002): heals merc to 100% (400)
      rig.adapter.send({ type: 'BeltUse', itemId: 7002, shift: true })
      host.stepFrame()
      expect(merc.hp).toBe(400)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1847: C2S 0x3B (AddSkillPoint) class ownership, reqlevel+baseLvl, reqskill1..3 & maxlvl=20 gates', () => {
    it('blocks cross-class skills, insufficient clvl, missing hard prerequisites, and >20 cap without deducting newSkills', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18470001,
        areaId: 1,
      })
      // Level 6 Sorceress (classId = 1)
      const rig = createD2gsClientRig(host, { charName: 'SorcSkillGate', classId: 1, level: 6 })
      const player = (host.game as any).players.get(rig.playerUnitId)!
      player.newSkills = 30

      // 1. Cross-class skill (Barbarian Bash = 126): rejected
      rig.adapter.send({ type: 'AllocateSkill', skillId: 126 })
      host.stepFrame()
      expect(player.skills.get(126)).toBeUndefined()
      expect(player.newSkills).toBe(30)

      // 2. Sorceress Frozen Orb (64, reqlevel 30): rejected at level 6
      rig.adapter.send({ type: 'AllocateSkill', skillId: 64 })
      host.stepFrame()
      expect(player.skills.get(64)).toBeUndefined()
      expect(player.newSkills).toBe(30)

      // 3. Sorceress Fire Ball (47, reqlevel 12, reqskill1 = Fire Bolt 36): even at level 12, rejected without hard point in 36
      player.level = 12
      // Equip +1 Fire Bolt soft item to verify soft points do NOT satisfy hard prerequisites
      player.items.push({
        unitId: 8100,
        code: 'sst',
        name: 'Short Staff',
        quality: 4,
        level: 10,
        location: 'equipped',
        x: 0,
        y: 0,
        width: 1,
        height: 3,
        areaId: 1,
        ownerId: rig.playerUnitId,
        bodyLoc: 4,
        storePage: 0,
        cost: 100,
        gamble: false,
        identified: true,
        ethereal: false,
        socketed: false,
        totalSockets: 0,
        durability: 20,
        maxDurability: 20,
        quantity: 1,
        stats: new Map(),
        socketedItems: [],
        rawItemData: { stats: [{ statId: 107, param: 36, value: 3 }] } as any,
      })
      rig.adapter.send({ type: 'AllocateSkill', skillId: 47 })
      host.stepFrame()
      expect(player.skills.get(47)).toBeUndefined()
      expect(player.newSkills).toBe(30)

      // 4. Put 1 hard point in Fire Bolt (36), then Fire Ball (47, reqlevel 12) succeeds once at clvl 12, but 2nd point requires clvl 13!
      rig.adapter.send({ type: 'AllocateSkill', skillId: 36 })
      rig.adapter.send({ type: 'AllocateSkill', skillId: 47 })
      rig.adapter.send({ type: 'AllocateSkill', skillId: 47 }) // blocked: clvl 12 < 12 + 1
      host.stepFrame()
      expect(player.skills.get(36)).toBe(1)
      expect(player.skills.get(47)).toBe(1)
      expect(player.newSkills).toBe(28)

      // 5. Hard-point cap at maxlvl = 20 even at clvl 99
      player.level = 99
      for (let i = 0; i < 25; i++) {
        rig.adapter.send({ type: 'AllocateSkill', skillId: 36 })
      }
      host.stepFrame()
      expect(player.skills.get(36)).toBe(20)
      expect(player.newSkills).toBe(9) // 28 - 19 = 9

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1848: C2S 0x05..0x11 all 12 skill-use opcodes preserve hand/shift/hold & sustain channeling', () => {
    it('decodes all 12 location/unit opcodes accurately and executes stand-still Shift melee + Hold Inferno channeling', () => {
      const locCases: Array<[Netproto.Hand, boolean, number]> = [
        ['left', false, 0x05],
        ['left', true, 0x08],
        ['right', false, 0x0c],
        ['right', true, 0x0f],
      ]
      for (const [hand, hold, expectedOp] of locCases) {
        const pkt = Netproto.encodeC2sSkillAt(hand, { x: 120, y: 130 }, hold)
        expect(pkt[0]).toBe(expectedOp)
        expect(Server.decodeD2gsC2sPacketToCommand(pkt)).toEqual({
          type: 'SkillAt',
          hand,
          at: { x: 120, y: 130 },
          hold,
        })
      }

      const unitCases: Array<[Netproto.Hand, boolean, boolean, number]> = [
        ['left', false, false, 0x06],
        ['left', true, false, 0x07],
        ['left', false, true, 0x09],
        ['left', true, true, 0x0a],
        ['right', false, false, 0x0d],
        ['right', true, false, 0x0e],
        ['right', false, true, 0x10],
        ['right', true, true, 0x11],
      ]
      for (const [hand, shift, hold, expectedOp] of unitCases) {
        const pkt = Netproto.encodeC2sSkillOnUnit(hand, { unitType: 1, id: 42 }, shift, hold)
        expect(pkt[0]).toBe(expectedOp)
        expect(Server.decodeD2gsC2sPacketToCommand(pkt)).toEqual({
          type: 'SkillOn',
          hand,
          target: { unitType: 1, id: 42 },
          shift,
          hold,
        })
      }

      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18480001,
        areaId: 3, // Cold Plains (non-town)
      })
      const rig = createD2gsClientRig(host, {
        charName: 'ChannelSorc',
        classId: 1,
        level: 30,
        areaId: 3,
        x: 100,
        y: 100,
      })
      const game = host.game
      const player = (game as any).players.get(rig.playerUnitId)!
      player.mana = 500
      player.manaFixed = 500 * 256
      player.maxMana = 500
      player.maxManaFixed = 500 * 256
      player.skills.set(41, 5) // Inferno (#41)
      player.rightSkill = 41

      const farMonsterId = game.spawnMonster({
        hcIdx: 0,
        areaId: 3,
        x: 112,
        y: 100,
        hp: 200,
        maxHp: 200,
      })
      const farMonster = (game as any).monsters.get(farMonsterId)!

      // 1. Shift + Left Attack (0x07) on out-of-range monster: swings in place without moving or damaging far monster
      player.targetX = 110
      player.targetY = 100
      rig.events.length = 0
      rig.adapter.send({
        type: 'SkillOn',
        hand: 'left',
        target: { unitType: 1, id: farMonsterId },
        shift: true,
        hold: false,
      })
      host.stepFrame()
      expect(player.x).toBe(100)
      expect(player.targetX).toBe(100) // Movement halted!
      expect(farMonster.hp).toBe(200) // Out of melee reach -> not damaged
      expect(rig.events.some((e) => e.type === 'SkillCast')).toBe(true)
      while (game.getPlayerAnimDispatcher(player.unitId)?.isActionLocked()) {
        host.stepFrame()
      }

      // 2. Right-hand Hold channeling Inferno (0x0F / 0x10) sustains STATE_INFERNO (state 12)
      rig.adapter.send({
        type: 'SkillAt',
        hand: 'right',
        at: { x: 108, y: 100 },
        hold: true,
      })
      host.stepFrame()
      expect(player.states.has(12)).toBe(true)
      const timer1 = player.stateTimers.get(12) ?? 0
      expect(timer1).toBeGreaterThan(0)

      rig.adapter.send({
        type: 'SkillOn',
        hand: 'right',
        target: { unitType: 1, id: farMonsterId },
        shift: true,
        hold: true,
      })
      host.stepFrame()
      expect(player.states.has(12)).toBe(true)
      expect(player.stateTimers.get(12) ?? 0).toBeGreaterThanOrEqual(timer1)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1849: C2S 0x14 OverheadChat & S2C 0x26 chatType/whisper/unitId/locale preservation', () => {
    it('broadcasts overhead bubbles (chatType=0x05 + speaker unitId), clears with 0x76, and preserves whisper 0x02/0x06 over D2GS', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18490001,
        areaId: 1,
      })
      const speaker = createD2gsClientRig(host, {
        charName: 'SpeakerA',
        classId: 0,
        x: 100,
        y: 100,
      })
      const listener = createD2gsClientRig(host, {
        charName: 'ListenerB',
        classId: 2,
        x: 103,
        y: 100,
      })
      host.stepFrame()
      speaker.events.length = 0
      listener.events.length = 0
      listener.rawS2cPackets.length = 0

      // 1. Overhead message (!Hello) -> S2C 0x26 with chatType = 0x05 and speaker.playerUnitId
      speaker.adapter.send({ type: 'OverheadChat', text: 'Selling Shako!' })
      host.stepFrame()

      const overheadEv = listener.events.find(
        (e): e is Extract<Netproto.ServerEvent, { type: 'Chat' }> =>
          e.type === 'Chat' && e.kind === 'overhead',
      )
      expect(overheadEv).toBeDefined()
      expect(overheadEv!.eventType).toBe(0x05)
      expect(overheadEv!.unit?.id).toBe(speaker.playerUnitId)
      expect(overheadEv!.text).toBe('Selling Shako!')

      // 2. Empty overhead -> S2C 0x76 UnitHoverTextClear
      listener.events.length = 0
      speaker.adapter.send({ type: 'OverheadChat', text: '   ' })
      host.stepFrame()
      expect(
        listener.events.some(
          (e) => e.type === 'UnitHoverTextClear' && e.id === speaker.playerUnitId,
        ),
      ).toBe(true)

      // 3. Whisper (/w ListenerB) -> 0x02 to ListenerB and 0x06 receipt to SpeakerA
      speaker.events.length = 0
      listener.events.length = 0
      speaker.adapter.send({
        type: 'Chat',
        text: 'Secret rune trade',
        whisperTo: 'ListenerB',
      })
      host.stepFrame()

      const recvWhisper = listener.events.find(
        (e): e is Extract<Netproto.ServerEvent, { type: 'Chat' }> => e.type === 'Chat',
      )
      const sentReceipt = speaker.events.find(
        (e): e is Extract<Netproto.ServerEvent, { type: 'Chat' }> => e.type === 'Chat',
      )
      expect(recvWhisper?.eventType).toBe(0x02)
      expect(recvWhisper?.from).toBe('SpeakerA')
      expect(sentReceipt?.eventType).toBe(0x06)
      expect(sentReceipt?.from).toBe('ListenerB')

      // 4. Locale byte round-trip on S2C 0x26
      const chatPkts = Netproto.serverEventToS2cPackets({
        type: 'Chat',
        kind: 'say',
        eventType: 0x01,
        locale: 0x09,
        color: 0x04,
        from: 'Cain',
        text: 'Stay awhile',
      })
      expect(chatPkts[0]![0]).toBe(0x26)
      expect(chatPkts[0]![2]).toBe(0x09)
      const decodedChat = Netproto.decodeD2gsS2cPacket(chatPkts[0]!, {
        tables: Netproto.getDefault113cItemDataTables(),
      })
      expect(decodedChat).toMatchObject({
        type: 'Chat',
        eventType: 0x01,
        locale: 0x09,
        color: 0x04,
      })

      speaker.adapter.leave()
      listener.adapter.leave()
      host.close()
    })
  })

  describe('#1850: C2S 0x21 (StackItems) & C2S 0x22 (UnstackItems) stackable merging & splitting', () => {
    it('merges 6+6 keys -> 12 (cursor cleared), 8+8 keys -> 12+4, respects arrows=350/bolts=250, and splits stacks via 0x22', () => {
      expect(Netproto.encodeC2sStackItems(10, 20)).toHaveLength(9)
      expect(Netproto.encodeC2sUnstackItems(30)).toHaveLength(5)

      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18500001,
        areaId: 1,
      })
      const rig = createD2gsClientRig(host, { charName: 'StackHero', classId: 0, level: 20 })
      const player = (host.game as any).players.get(rig.playerUnitId)!

      const mkStack = (
        unitId: number,
        code: string,
        qty: number,
        location: 'cursor' | 'inventory',
        x = 0,
      ) => ({
        unitId,
        code,
        name: code,
        quality: 2,
        level: 1,
        location,
        x,
        y: 0,
        width: 1,
        height: code === 'key' ? 1 : 3,
        areaId: 1,
        ownerId: rig.playerUnitId,
        bodyLoc: 0,
        storePage: location === 'inventory' ? 1 : 0,
        cost: 10,
        gamble: false,
        identified: true,
        ethereal: false,
        socketed: false,
        totalSockets: 0,
        durability: 0,
        maxDurability: 0,
        quantity: qty,
        stats: new Map([[70, qty]]),
        socketedItems: [],
      })

      // 1. 6 + 6 keys -> 12, cursor cleared
      player.items = [mkStack(6001, 'key', 6, 'cursor'), mkStack(6002, 'key', 6, 'inventory', 0)]
      rig.adapter.send({ type: 'StackItems', cursorItemId: 6001, targetItemId: 6002 })
      host.stepFrame()
      expect(player.items.find((i: any) => i.unitId === 6002)!.quantity).toBe(12)
      expect(player.items.some((i: any) => i.unitId === 6001)).toBe(false)

      // 2. 8 + 8 keys -> target 12, cursor 4
      player.items = [mkStack(6003, 'key', 8, 'cursor'), mkStack(6004, 'key', 8, 'inventory', 1)]
      rig.adapter.send({ type: 'StackItems', cursorItemId: 6003, targetItemId: 6004 })
      host.stepFrame()
      expect(player.items.find((i: any) => i.unitId === 6004)!.quantity).toBe(12)
      expect(player.items.find((i: any) => i.unitId === 6003)!.quantity).toBe(4)

      // 3. Arrows (maxstack = 350) & Bolts (maxstack = 250)
      player.items = [
        mkStack(6005, 'aqv', 200, 'cursor'),
        mkStack(6006, 'aqv', 200, 'inventory', 2),
      ]
      rig.adapter.send({ type: 'StackItems', cursorItemId: 6005, targetItemId: 6006 })
      host.stepFrame()
      expect(player.items.find((i: any) => i.unitId === 6006)!.quantity).toBe(350)
      expect(player.items.find((i: any) => i.unitId === 6005)!.quantity).toBe(50)

      player.items = [
        mkStack(6007, 'cqv', 150, 'cursor'),
        mkStack(6008, 'cqv', 150, 'inventory', 3),
      ]
      rig.adapter.send({ type: 'StackItems', cursorItemId: 6007, targetItemId: 6008 })
      host.stepFrame()
      expect(player.items.find((i: any) => i.unitId === 6008)!.quantity).toBe(250)
      expect(player.items.find((i: any) => i.unitId === 6007)!.quantity).toBe(50)

      // 4. UnstackItems (0x22) splits 10 keys into 5 in inventory + 5 on cursor
      player.items = [mkStack(6009, 'key', 10, 'inventory', 0)]
      rig.adapter.send({ type: 'UnstackItems', itemId: 6009 })
      host.stepFrame()
      expect(player.items.find((i: any) => i.unitId === 6009)!.quantity).toBe(5)
      const splitCursor = player.items.find((i: any) => i.location === 'cursor')!
      expect(splitCursor).toBeDefined()
      expect(splitCursor.quantity).toBe(5)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1851: C2S 0x3E (ActivateQuestScroll / SelectMainItem) & C2S 0x40 (RequestQuestData)', () => {
    it('emits S2C 0x7C UseSpecialItem for deciphered Scroll of Inifuss (bkd) and 103B S2C 0x28 QuestInfo on 0x40', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18510001,
        areaId: 1,
      })
      const rig = createD2gsClientRig(host, { charName: 'QuestReader', classId: 1, level: 10 })
      const player = (host.game as any).players.get(rig.playerUnitId)!
      player.questFlags[1] = 0x0001 // Den of Evil completed
      player.questFlags[4] = 0x0004 // Cairn Stones active
      player.items = [
        {
          unitId: 5501,
          code: 'bkd',
          name: 'Scroll of Inifuss',
          quality: 2,
          level: 1,
          location: 'inventory',
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          areaId: 1,
          ownerId: rig.playerUnitId,
          bodyLoc: 0,
          storePage: 1,
          cost: 0,
          gamble: false,
          identified: true,
          ethereal: false,
          socketed: false,
          totalSockets: 0,
          durability: 0,
          maxDurability: 0,
          quantity: 1,
          stats: new Map(),
          socketedItems: [],
        },
      ]

      rig.events.length = 0
      rig.rawS2cPackets.length = 0

      // 1. Send C2S 0x3E ActivateQuestScroll(5501) -> receives 6B S2C 0x7C [0x7c, 0x04, u32 5501]
      rig.adapter.send({ type: 'ActivateQuestScroll', itemId: 5501 })
      host.stepFrame()

      const pkt7c = rig.rawS2cPackets.find((p) => p[0] === 0x7c)
      expect(pkt7c).toBeDefined()
      expect(pkt7c!.byteLength).toBe(6)
      expect(pkt7c![1]).toBe(0x04)
      expect(rig.events.some((e) => e.type === 'UseSpecialItem' && e.id === 5501)).toBe(true)

      // 2. Send C2S 0x40 RequestQuestData -> receives 103B S2C 0x28 QuestInfo with 48 u16 flags
      rig.events.length = 0
      rig.rawS2cPackets.length = 0
      rig.adapter.send({ type: 'RequestQuestData' })
      host.stepFrame()

      const pkt28 = rig.rawS2cPackets.find((p) => p[0] === 0x28)
      expect(pkt28).toBeDefined()
      expect(pkt28!.byteLength).toBe(103)
      const questEv = rig.events.find(
        (e): e is Extract<Netproto.ServerEvent, { type: 'QuestState' }> =>
          e.type === 'QuestState' && e.source === 0x28,
      )
      expect(questEv).toBeDefined()
      expect(questEv!.quests?.[1]).toBe(0x0001)
      expect(questEv!.quests?.[4]).toBe(0x0004)

      rig.adapter.leave()
      host.close()
    })
  })

  describe('#1852: C2S 0x50 (DropGold) inventory gold deduction, ground pile spawn & teammate pickup', () => {
    it('deducts valid gold on 0x50, spawns ground gld pile (0x9C) for self/teammate pickup, and rejects invalid amounts', () => {
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18520001,
        areaId: 1,
      })
      const dropper = createD2gsClientRig(host, {
        charName: 'GoldDropper',
        classId: 4,
        level: 20,
        x: 100,
        y: 100,
      })
      const picker = createD2gsClientRig(host, {
        charName: 'GoldPicker',
        classId: 3,
        level: 20,
        x: 101,
        y: 100,
      })
      const pDrop = (host.game as any).players.get(dropper.playerUnitId)!
      const pPick = (host.game as any).players.get(picker.playerUnitId)!
      pDrop.gold = 5000
      pPick.gold = 200

      // Reject 0 and > player.gold
      dropper.adapter.send({ type: 'DropGold', unitId: dropper.playerUnitId, amount: 0 })
      dropper.adapter.send({ type: 'DropGold', unitId: dropper.playerUnitId, amount: 9999 })
      host.stepFrame()
      expect(pDrop.gold).toBe(5000)

      // Valid DropGold(1750)
      picker.events.length = 0
      dropper.adapter.send({ type: 'DropGold', unitId: dropper.playerUnitId, amount: 1750 })
      host.stepFrame()
      expect(pDrop.gold).toBe(3250)

      const goldDropEv = picker.events.find(
        (e): e is Extract<Netproto.ServerEvent, { type: 'ItemEvent' }> =>
          e.type === 'ItemEvent' && e.item?.code === 'gld',
      )
      expect(goldDropEv).toBeDefined()
      expect(goldDropEv!.item?.goldAmount).toBe(1750)

      // Teammate picks up the dropped gold pile
      picker.adapter.send({
        type: 'ItemPickup',
        itemId: goldDropEv!.item!.id,
        toCursor: false,
      })
      host.stepFrame()
      expect(pPick.gold).toBe(1950)

      dropper.adapter.leave()
      picker.adapter.leave()
      host.close()
    })
  })

  describe('#1853: C2S 0x51 (AssignSkillHotkey) binary decode, S2C 0x7B join hydration & .d2s persistence', () => {
    it('hydrates saved .d2s hotkeys via S2C 0x7B on join and persists rebound C2S 0x51 hotkeys across rejoin', () => {
      // Seed a .d2s Sorceress with Fire Bolt (36) + Teleport (54) learned and F1 (right 54), F2 (left 36) bound
      const seedGame = new Server.GameInstance({
        policy: Server.SINGLE_PLAYER_POLICY,
        mapSeed: 0x18530001,
      })
      const seedPid = seedGame.connectPlayer({
        charName: 'HotkeySorc',
        classId: 1,
        level: 24,
      })
      const seedPlayer = (seedGame as any).players.get(seedPid)!
      seedPlayer.skills.set(36, 5)
      seedPlayer.skills.set(43, 1) // Telekinesis
      seedPlayer.skills.set(54, 1) // Teleport
      seedPlayer.hotkeys[0] = 54 // F1 right-hand Teleport
      seedPlayer.hotkeys[1] = 0x8000 | 36 // F2 left-hand Fire Bolt
      const initialD2s = seedGame.exportPlayerD2s(seedPid)

      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18530002,
        areaId: 1,
      })
      const rig1 = createD2gsClientRig(host, {
        charName: 'HotkeySorc',
        classId: 1,
        level: 24,
        d2s: initialD2s,
      })

      // Client must immediately receive S2C 0x7B packets for F1 and F2 on room join!
      const pkts7b = rig1.rawS2cPackets.filter((p) => p[0] === 0x7b)
      expect(pkts7b).toHaveLength(2)
      const hotkeyEvents = rig1.events.filter(
        (e): e is Extract<Netproto.ServerEvent, { type: 'ActiveSkill' }> =>
          e.type === 'ActiveSkill' && e.isHotkey === true,
      )
      expect(hotkeyEvents).toEqual([
        expect.objectContaining({ slot: 0, hand: 'right', skill: 54 }),
        expect.objectContaining({ slot: 1, hand: 'left', skill: 36 }),
      ])

      // Rebind F3 (slot 2) to right-hand Telekinesis (43) and unbind F1 (slot 0) via binary C2S 0x51
      rig1.adapter.send({
        type: 'AssignSkillHotkey',
        slot: 2,
        hand: 'right',
        skill: 43,
        itemId: 0xffffffff,
      })
      rig1.adapter.send({
        type: 'AssignSkillHotkey',
        slot: 0,
        hand: 'right',
        skill: 0xffff,
        itemId: 0xffffffff,
      })
      host.stepFrame()

      const savedAfterRebind = host.game.exportPlayerD2s(rig1.playerUnitId)
      rig1.adapter.leave()

      // Rejoin with exported .d2s and verify F2 + F3 are restored and F1 remains unbound
      const rig2 = createD2gsClientRig(host, {
        charName: 'HotkeySorc',
        classId: 1,
        level: 24,
        d2s: savedAfterRebind,
      })
      const rejoinHotkeys = rig2.events.filter(
        (e): e is Extract<Netproto.ServerEvent, { type: 'ActiveSkill' }> =>
          e.type === 'ActiveSkill' && e.isHotkey === true,
      )
      expect(rejoinHotkeys).toEqual([
        expect.objectContaining({ slot: 1, hand: 'left', skill: 36 }),
        expect.objectContaining({ slot: 2, hand: 'right', skill: 43 }),
      ])

      rig2.adapter.leave()
      host.close()
    })
  })

  describe('#1854: S2C 0x9C/0x9D full extended item bitstream round-trip vs compactSave=1 consumables', () => {
    it('encodes compactSave=1 potions/runes as compactItem=1 and magic/rare/set/unique/runeword/ethereal gear as compactItem=0 with 100% stat fidelity', () => {
      const tables = Netproto.getDefault113cItemDataTables()

      // 1. compactsave=1 potion ('hp4') & rune ('r08') -> compact=true
      for (const compactCode of ['hp4', 'r08']) {
        const pkts = Netproto.serverEventToS2cPackets(
          {
            type: 'ItemEvent',
            action: 'drop',
            itemId: 3001,
            code: compactCode,
            x: 120,
            y: 130,
            container: 'ground',
          },
          tables,
        )
        expect(pkts).toHaveLength(1)
        expect(pkts[0]![0]).toBe(0x9c)
        const decoded = Netproto.decode0x9C0x9DItemAction(pkts[0]!, tables)
        expect(decoded.type).toBe('ItemEvent')
        if (decoded.type === 'ItemEvent') {
          expect(decoded.item?.code).toBe(compactCode)
          expect(decoded.item?.compact).toBe(true)
        }
      }

      // 2. Non-compactSave normal items ('box' Horadric Cube, 'rin' Ring, 'cm1' Small Charm) MUST use compact=false
      for (const nonCompactCode of ['box', 'rin', 'cm1']) {
        const pkts = Netproto.serverEventToS2cPackets(
          {
            type: 'ItemEvent',
            action: 0x04,
            itemId: 3002,
            code: nonCompactCode,
            x: 1,
            y: 2,
            container: 'inventory',
            item: {
              id: 3002 as Netproto.UnitId,
              itemId: 3002 as Netproto.UnitId,
              code: nonCompactCode,
              quality: 2,
              ilvl: 55,
              guid: 0x01abcdef,
              identified: true,
              stats: [],
            } as any,
          },
          tables,
        )
        const decoded = Netproto.decode0x9C0x9DItemAction(pkts[0]!, tables)
        if (decoded.type === 'ItemEvent') {
          expect(decoded.item?.compact).toBe(false)
          expect(decoded.item?.ilvl).toBe(55)
          expect(decoded.item?.itemId).toBe(3002)
        }
      }

      // 3. Extended qualities round-trip: Magic (4), Set (5), Rare (6), Unique (7), Ethereal Socketed Runeword (0x9D equipped)
      const richItems: Array<{ label: string; container: Netproto.ItemContainer; action: any; item: Partial<Netproto.ItemData> }> = [
        {
          label: 'Magic Amulet',
          container: 'inventory',
          action: 0x04,
          item: {
            id: 4001 as Netproto.UnitId,
            itemId: 4001 as Netproto.UnitId,
            code: 'amu',
            quality: 4,
            ilvl: 85,
            guid: 0x02223333,
            identified: true,
            magicPrefixId: 112,
            magicSuffixId: 245,
            stats: [
              { statId: 127, param: 0, value: 2 }, // +2 All Skills
              { statId: 105, param: 0, value: 10 }, // +10% FCR
            ],
          },
        },
        {
          label: 'Rare Boots',
          container: 'inventory',
          action: 0x04,
          item: {
            id: 4002 as Netproto.UnitId,
            itemId: 4002 as Netproto.UnitId,
            code: 'xhb',
            quality: 6,
            ilvl: 78,
            guid: 0x01114444,
            identified: true,
            defense: 64,
            maxDurability: 16,
            curDurability: 14,
            rareName1: 12,
            rareName2: 45,
            rareAffixes: [101, 202, 0, 303, 0, 404],
            stats: [
              { statId: 96, param: 0, value: 30 }, // +30% FRW
              { statId: 39, param: 0, value: 35 }, // +35% Fire Res
              { statId: 41, param: 0, value: 38 }, // +38% Light Res
            ],
          },
        },
        {
          label: 'Unique Shako',
          container: 'ground',
          action: 'drop',
          item: {
            id: 4003 as Netproto.UnitId,
            itemId: 4003 as Netproto.UnitId,
            code: 'uap',
            quality: 7,
            ilvl: 87,
            guid: 0x03556677,
            identified: true,
            uniqueItemId: 252,
            defense: 141,
            maxDurability: 12,
            curDurability: 12,
            stats: [
              { statId: 127, param: 0, value: 2 },
              { statId: 36, param: 0, value: 10 },
            ],
          },
        },
        {
          label: 'Set Tal Rasha Armor',
          container: 'stash',
          action: 0x04,
          item: {
            id: 4004 as Netproto.UnitId,
            itemId: 4004 as Netproto.UnitId,
            code: 'uth',
            quality: 5,
            ilvl: 84,
            guid: 0x01998877,
            identified: true,
            setItemId: 88,
            defense: 887,
            maxDurability: 55,
            curDurability: 50,
            stats: [{ statId: 80, param: 0, value: 88 }],
          },
        },
        {
          label: 'Ethereal 4os Runeword Monarch (0x9D Equipped)',
          container: 'equipment',
          action: 'equip',
          item: {
            id: 4005 as Netproto.UnitId,
            itemId: 4005 as Netproto.UnitId,
            ownerType: 0,
            ownerId: 1 as Netproto.UnitId,
            bodyLoc: 5,
            equippedSlot: 5,
            code: 'uit',
            quality: 3,
            qualitySubtype: 2,
            ilvl: 85,
            guid: 0x02abcdef,
            identified: true,
            ethereal: true,
            socketed: true,
            runeword: true,
            runewordData: 0x503b,
            usedSockets: 4,
            totalSockets: 4,
            defense: 222,
            maxDurability: 44,
            curDurability: 44,
            stats: [{ statId: 194, param: 0, value: 4 }],
            runewordStats: [
              { statId: 127, param: 0, value: 2 },
              { statId: 105, param: 0, value: 35 },
            ],
          },
        },
      ]

      for (const tc of richItems) {
        const pkts = Netproto.serverEventToS2cPackets(
          {
            type: 'ItemEvent',
            action: tc.action,
            itemId: tc.item.id!,
            ownerId: tc.item.ownerId ?? 1,
            bodyLoc: tc.item.bodyLoc,
            code: tc.item.code!,
            x: 2,
            y: 1,
            container: tc.container,
            item: tc.item as Netproto.ItemData,
          },
          tables,
        )
        expect(pkts).toHaveLength(1)
        const pkt = pkts[0]!
        const expectedOp = tc.container === 'equipment' ? 0x9d : 0x9c
        expect(pkt[0]).toBe(expectedOp)

        const decoded = Netproto.decode0x9C0x9DItemAction(pkt, tables)
        expect(decoded.type).toBe('ItemEvent')
        if (decoded.type === 'ItemEvent') {
          const out = decoded.item!
          expect(out.compact).toBe(false)
          expect(out.code).toBe(tc.item.code)
          expect(out.quality).toBe(tc.item.quality)
          expect(out.ilvl).toBe(tc.item.ilvl)
          expect(out.itemId).toBe(tc.item.id)
          if (tc.item.magicPrefixId !== undefined) expect(out.magicPrefixId).toBe(tc.item.magicPrefixId)
          if (tc.item.magicSuffixId !== undefined) expect(out.magicSuffixId).toBe(tc.item.magicSuffixId)
          if (tc.item.uniqueItemId !== undefined) expect(out.uniqueItemId).toBe(tc.item.uniqueItemId)
          if (tc.item.setItemId !== undefined) expect(out.setItemId).toBe(tc.item.setItemId)
          if (tc.item.rareName1 !== undefined) {
            expect(out.rareName1).toBe(tc.item.rareName1)
            expect(out.rareName2).toBe(tc.item.rareName2)
            expect(out.rareAffixes).toEqual(tc.item.rareAffixes)
          }
          if (tc.item.defense !== undefined) expect(out.defense).toBe(tc.item.defense)
          if (tc.item.runeword) {
            expect(out.runeword).toBe(true)
            expect(out.ethereal).toBe(true)
            expect(out.socketed).toBe(true)
            expect(out.runewordStats).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ statId: 127, value: 2 }),
                expect.objectContaining({ statId: 105, value: 35 }),
              ]),
            )
          }
          for (const st of tc.item.stats ?? []) {
            expect(out.stats).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ statId: st.statId, value: st.value }),
              ]),
            )
          }
        }
      }
    })
  })

  describe('#1855: S2C 0xAC (AssignNpc) 16-component MonStats2 appearance & bossMods uMod bitstream + .d2cap replay', () => {
    it('round-trips composite skeleton compVariants, champion, 3-mod random unique, and Corpsefire superunique (skipping internal umod 22)', () => {
      const wireTap = new Netproto.InMemoryPacketTap()
      const host = new Server.MultiClientRoomHost({
        policy: Server.CLOSED_REALM_POLICY,
        mapSeed: 0x18550001,
        areaId: 8, // Den of Evil
      })
      const game = host.game

      // 1. Composite Skeleton (hcIdx = 1, bComposite = 1 in MonStats2)
      const skelId = game.spawnMonster({
        hcIdx: 1,
        areaId: 8,
        x: 102,
        y: 102,
        compVariants: [0, 1, 0, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      })
      // 2. Champion Zombie (hcIdx = 2) with Champion mod (16)
      const champId = game.spawnMonster({
        hcIdx: 2,
        areaId: 8,
        x: 104,
        y: 102,
        rank: 'champion',
        umodIds: [16],
      })
      // 3. Random Unique Fallen (hcIdx = 19) with Extra Strong (5), Extra Fast (6), Lightning Enchanted (17), plus internal 22 (questcomplete)
      const uniqueId = game.spawnMonster({
        hcIdx: 19,
        areaId: 8,
        x: 106,
        y: 102,
        rank: 'unique',
        umodIds: [5, 6, 17, 22],
      })
      // 4. SuperUnique Rakanishu (superUniqueId = 'Rakanishu' -> index 1, Spectral Hit = 27)
      const corpsefireId = game.spawnMonster({
        hcIdx: 2,
        areaId: 8,
        x: 108,
        y: 102,
        rank: 'superunique',
        superUniqueId: 'Rakanishu',
        umodIds: [27, 22],
      })

      const rig = createD2gsClientRig(host, {
        charName: 'MonsterScout',
        classId: 0,
        level: 20,
        areaId: 8,
        x: 100,
        y: 100,
        tap: wireTap,
      })

      const assignById = new Map<number, Netproto.UnitSnapshot>()
      for (const ev of rig.events) {
        if (ev.type === 'UnitAssign' && ev.unit?.unitType === 1) {
          assignById.set(ev.unit.id, ev.unit)
        }
      }

      // Composite Skeleton preserves 16-component appearance array
      const skelEv = assignById.get(skelId)!
      expect(skelEv).toBeDefined()
      expect(skelEv.compVariants).toEqual([0, 1, 0, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0])

      // Champion preserves champion flag & umod [16]
      const champEv = assignById.get(champId)!
      expect(champEv.isChampion).toBe(true)
      expect(champEv.bossMods).toEqual([16])

      // Random Unique preserves all anMonUMod bytes [5, 6, 17, 22] on 0xAC wire
      const uniqueEv = assignById.get(uniqueId)!
      expect(uniqueEv.isUnique).toBe(true)
      expect(uniqueEv.bossMods).toEqual([5, 6, 17, 22])

      // SuperUnique Rakanishu preserves superUniqueId=3 & umod [27, 22] on 0xAC wire
      const superEv = assignById.get(corpsefireId)!
      expect(superEv.isSuperUnique).toBe(true)
      expect(superEv.superUniqueId).toBe(3)
      expect(superEv.bossMods).toEqual([27, 22])

      // Deterministic .d2cap JSONL replay verifies wire-exact 0xAC framing & decoding
      const jsonl = wireTap.toD2CapJsonl({
        format: 'd2cap-v1',
        createdAt: '2026-01-01T00:00:00.000Z',
        server: 'local-room-host',
        scenario: 'wave3-0xac-replay',
      })
      const parsed = Netproto.parseD2CapJsonl(jsonl)
      const replayFramer = new Netproto.D2gsS2cFramer()
      const replayed0xAC: number[] = []
      for (const rec of parsed.records) {
        if (rec.conn === 'game' && rec.dir === 's2c') {
          for (const pkt of replayFramer.push(Netproto.hexToBytes(rec.hex))) {
            if (pkt.bytes[0] === 0xac) {
              const dec = Netproto.decode0xACAssignNpc(pkt.bytes)
              if (dec.type === 'UnitAssign' && dec.unit) {
                replayed0xAC.push(dec.unit.id)
              }
            }
          }
        }
      }
      expect(replayed0xAC).toEqual(
        expect.arrayContaining([skelId, champId, uniqueId, corpsefireId]),
      )

      rig.adapter.leave()
      host.close()
    })
  })
})
