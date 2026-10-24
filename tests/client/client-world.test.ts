import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand, ItemData } from '../../src/netproto/index.ts'

function makeItem(overrides: Partial<ItemData> & { id: number; code: string }): ItemData {
  return {
    id: overrides.id,
    itemId: overrides.itemId ?? overrides.id,
    opcode: overrides.opcode ?? 0x9c,
    action: overrides.action ?? 0,
    category: overrides.category ?? 0,
    flags: overrides.flags ?? 0x00200010,
    rawFlags: overrides.rawFlags ?? 0x00200010,
    version: overrides.version ?? 101,
    location: overrides.location ?? 0,
    container: overrides.container ?? 'inventory',
    bodyLoc: overrides.bodyLoc ?? overrides.equippedSlot ?? 0,
    equippedSlot: overrides.equippedSlot ?? overrides.bodyLoc ?? 0,
    gridX: overrides.gridX ?? 0,
    gridY: overrides.gridY ?? 0,
    storePage: overrides.storePage ?? 1,
    storagePage: overrides.storagePage ?? 1,
    worldX: overrides.worldX ?? 0,
    worldY: overrides.worldY ?? 0,
    x: overrides.x ?? overrides.worldX ?? 0,
    y: overrides.y ?? overrides.worldY ?? 0,
    ownerType: overrides.ownerType,
    ownerId: overrides.ownerId,
    code: overrides.code,
    rawCode: overrides.rawCode ?? `${overrides.code} `,
    compact: overrides.compact ?? true,
    simple: overrides.simple ?? true,
    identified: overrides.identified ?? true,
    socketed: overrides.socketed ?? false,
    ethereal: overrides.ethereal ?? false,
    runeword: overrides.runeword ?? false,
    personalized: overrides.personalized ?? false,
    isEar: overrides.isEar ?? false,
    newItem: overrides.newItem ?? false,
    starterItem: overrides.starterItem ?? false,
    broken: overrides.broken ?? false,
    inSocket: overrides.inSocket ?? false,
    equipped: overrides.equipped ?? false,
    socketedChildCount: overrides.socketedChildCount ?? 0,
    usedSockets: overrides.usedSockets ?? 0,
    totalSockets: overrides.totalSockets ?? 0,
    invWidth: overrides.invWidth ?? 1,
    invHeight: overrides.invHeight ?? 1,
    quality: overrides.quality,
    ilvl: overrides.ilvl ?? 1,
    graphicIndex: overrides.graphicIndex,
    defense: overrides.defense,
    durability: overrides.durability,
    maxDurability: overrides.maxDurability,
    quantity: overrides.quantity,
    goldAmount: overrides.goldAmount,
    stats: overrides.stats ?? [],
    setBonusStats: overrides.setBonusStats ?? [],
    runewordStats: overrides.runewordStats ?? [],
  }
}

describe('ClientWorld authoritative state mirror', () => {
  it('applies lifecycle, act/mapSeed, room reveal/hide, and self player assignment events', () => {
    const world = new ClientWorld()
    expect(world.loading).toBe(true)

    world.apply({
      type: 'GameFlags',
      difficulty: 1,
      hardcore: true,
      expansion: true,
      ladder: true,
    })
    expect(world.difficulty).toBe(1)
    expect(world.hardcore).toBe(true)
    expect(world.expansion).toBe(true)
    expect(world.ladder).toBe(true)

    world.apply({
      type: 'LoadAct',
      act: 0,
      mapSeed: 0x12345678,
      areaId: 1,
      objectSeed: 0x9abcdef0,
    })
    expect(world.act).toBe(0)
    expect(world.mapSeed).toBe(0x12345678)
    expect(world.areaId).toBe(1)
    expect(world.objectSeed).toBe(0x9abcdef0)

    world.apply({ type: 'RoomReveal', areaId: 1, tileX: 100, tileY: 200 })
    expect(world.revealedRooms.has('1:100:200')).toBe(true)

    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 0,
        id: 1,
        classId: 1, // Sorceress
        name: 'SorcHero',
        x: 5100,
        y: 5200,
      },
      isSelf: true,
    })
    // 0x0B GameHandshake carries classId: -1 and must not overwrite classId=1
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 0,
        id: 1,
        classId: -1,
        x: 0,
        y: 0,
      },
      isSelf: true,
    })
    expect(world.selfId).toBe(1)
    expect(world.self.name).toBe('SorcHero')
    expect(world.self.charClass).toBe(1)
    expect(world.self.x).toBe(5100)
    expect(world.self.y).toBe(5200)
    expect(world.getUnit(0, 1)?.classId).toBe(1)

    world.apply({ type: 'LoadComplete' })
    expect(world.loading).toBe(false)

    world.apply({ type: 'RoomHide', areaId: 1, tileX: 100, tileY: 200 })
    expect(world.revealedRooms.has('1:100:200')).toBe(false)
  })

  it('decodes 8.8 fixed-point pool stats 6..11 (ValShift 8) and ignores negative sentinels from WalkVerify', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })

    // 1.13c wire values for stats 6..11 are 8.8 fixed point (ItemStatCost ValShift = 8):
    // capture bytes `1e 07 00 32` -> u16-LE 12800 = 50 max life for a fresh level-1 character.
    world.apply({ type: 'StatSet', stat: 6, value: 12800 })
    world.apply({ type: 'StatSet', stat: 7, value: 12800 })
    world.apply({ type: 'StatSet', stat: 8, value: 6400 })
    world.apply({ type: 'StatSet', stat: 9, value: 6400 })
    world.apply({ type: 'StatSet', stat: 10, value: 24320 })
    world.apply({ type: 'StatSet', stat: 11, value: 24320 })
    expect(world.self.life).toBe(50)
    expect(world.self.maxLife).toBe(50)
    expect(world.self.mana).toBe(25)
    expect(world.self.maxMana).toBe(25)
    expect(world.self.stamina).toBe(95)
    expect(world.self.maxStamina).toBe(95)

    // The StatList keeps the raw wire value; only the pool fields are shifted
    expect(world.self.stats.get(7)).toBe(12800)

    // The shift is unconditional (no magnitude heuristic): raw 128 = 0.5 -> 0, raw 420 << 8 -> 420
    world.apply({ type: 'StatSet', stat: 7, value: 128 })
    expect(world.self.maxLife).toBe(0)
    expect(world.self.stats.get(7)).toBe(128)
    world.apply({ type: 'StatSet', stat: 7, value: 420 << 8 })
    expect(world.self.maxLife).toBe(420)
    world.apply({ type: 'StatSet', stat: 7, value: 12800 })
    expect(world.self.maxLife).toBe(50)

    // WalkVerify (0x96) sends life: -1, mana: -1, stamina: 90, at: (5010, 5012)
    world.apply({
      type: 'LifeMana',
      life: -1,
      mana: -1,
      stamina: 90,
      at: { x: 5010, y: 5012 },
    })
    expect(world.self.life).toBe(50)
    expect(world.self.mana).toBe(25)
    expect(world.self.stamina).toBe(90)
    expect(world.self.x).toBe(5010)
    expect(world.self.y).toBe(5012)
  })

  it('tracks item container moves across ground, inventory, equipment, belt, and cursor', () => {
    const world = new ClientWorld()
    const sword = makeItem({
      id: 500,
      code: 'ssd',
      action: 0, // AddToGround
      container: 'ground',
      worldX: 5120,
      worldY: 5130,
    })
    world.apply({ type: 'ItemEvent', action: 0, item: sword, container: 'ground' })
    expect(world.containers.ground.has(500)).toBe(true)

    // Pick up to inventory (action 4 / PutInContainer)
    const inInv = makeItem({
      id: 500,
      code: 'ssd',
      action: 4,
      container: 'inventory',
      gridX: 2,
      gridY: 1,
    })
    world.apply({ type: 'ItemEvent', action: 4, item: inInv, container: 'inventory' })
    expect(world.containers.ground.has(500)).toBe(false)
    expect(world.containers.inventory.get(500)?.gridX).toBe(2)

    // Move to cursor (action 0x02 / ToCursor)
    const onCursor = makeItem({
      id: 500,
      code: 'ssd',
      action: 2,
      container: 'cursor',
    })
    world.apply({ type: 'ItemEvent', action: 2, item: onCursor, container: 'cursor' })
    expect(world.containers.inventory.has(500)).toBe(false)
    expect(world.containers.cursor?.id).toBe(500)

    // Equip to right arm (slot 4)
    const equipped = makeItem({
      id: 500,
      code: 'ssd',
      action: 6,
      container: 'equipment',
      equippedSlot: 4,
      bodyLoc: 4,
    })
    world.apply({ type: 'ItemEvent', action: 6, item: equipped, container: 'equipment' })
    expect(world.containers.cursor).toBeNull()
    expect(world.containers.equipment.get(500)?.id).toBe(500)
    expect(world.containers.equipmentBySlot.get(4)?.id).toBe(500)
  })

  it('tracks skills, states, quests, waypoints, portals, party, trade, chat, sound, and RTT', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })

    world.apply({
      type: 'SkillList',
      unitId: 1,
      skills: [
        { skillId: 36, level: 5, baseLevel: 5, bonus: 2 },
        { skillId: 37, level: 1, baseLevel: 1, bonus: 0 },
      ],
    })
    expect(world.self.skills.get(36)).toBe(7)
    expect(world.self.skillEntries.get(36)).toEqual({
      skillId: 36,
      skill: 36,
      level: 5,
      baseLevel: 5,
      bonus: 2,
    })

    world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 36 })
    expect(world.self.rightSkill).toBe(36)

    world.apply({
      type: 'StateSet',
      unit: { unitType: 0, id: 1 },
      state: 16,
      stats: [{ statId: 31, param: 0, value: 45 }],
    })
    expect(world.getUnit(0, 1)?.states.has(16)).toBe(true)
    expect(world.self.states.has(16)).toBe(true)
    world.apply({ type: 'StateEnd', unit: { unitType: 0, id: 1 }, state: 16 })
    expect(world.getUnit(0, 1)?.states.has(16)).toBe(false)
    expect(world.self.states.has(16)).toBe(false)

    world.apply({ type: 'QuestState', kind: 'log', quests: new Uint16Array([0x0001, 0x0004]) })
    expect(world.quests[0]).toBe(0x0001)
    expect(world.quests[1]).toBe(0x0004)

    world.apply({
      type: 'WaypointMenu',
      unitId: 10,
      open: [0, 1],
    })
    expect(world.waypoints.has(0)).toBe(true)
    expect(world.waypoints.has(1)).toBe(true)
    expect(world.waypoints.has(2)).toBe(false)

    world.apply({
      type: 'Portal',
      ownerId: 1,
      ownerName: 'SorcHero',
      localId: 99,
      remoteId: 100,
      areaId: 2,
      flags: 1,
    })
    expect(world.portals.get(99)?.areaId).toBe(2)

    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charName: 'PaladinBro',
      charClass: 3,
      charLevel: 12,
      partyId: 1,
      areaId: 1,
      lifePct: 100,
    })
    expect(world.party.get(2)?.charName).toBe('PaladinBro')

    world.apply({ type: 'Chat', kind: 'say', from: 'PaladinBro', text: 'tp up' })
    expect(world.chatLog).toHaveLength(1)

    world.apply({ type: 'Chat', kind: 'overhead', unit: { unitType: 0, id: 1 }, text: 'follow me' })
    expect(world.getUnit(0, 1)?.overheadText).toBe('follow me')

    world.apply({ type: 'PlaySound', unit: { unitType: 0, id: 1 }, sound: 19 })

    world.apply({ type: 'Pong', rttMs: 42, tickCount: 1000 })
    expect(world.lastRttMs).toBe(42)
  })

  it('encodes all 18 M1 C2S opcodes matching C2S_PACKET_SIZES and encodeClientCommand', async () => {
    const netproto = await import('../../src/netproto/index.ts')
    const {
      C2S_PACKET_SIZES,
      encodeClientCommand,
      encodeC2sWarpTo,
      encodeC2sSwapEquippedItem,
      encodeC2sSwapContainerItem,
      encodeC2sBeltPut,
      encodeC2sBeltRemove,
      encodeC2sBeltSwap,
      encodeC2sBeltUse,
      encodeC2sIdentifyItem,
      encodeC2sSocketItem,
      encodeC2sScrollToBook,
      encodeC2sQuestMessage,
      encodeC2sNpcMercHire,
      encodeC2sNpcEntityAction,
      encodeC2sResurrect,
      encodeC2sClickButton,
      encodeC2sHostile,
      encodeC2sPartyAction,
      encodeC2sMercItem,
      encodeC2sNpcMercResurrect,
    } = netproto

    const directPackets: Array<{ opcode: number; pkt: Uint8Array }> = [
      { opcode: 0x09, pkt: encodeC2sWarpTo(42, 5) },
      { opcode: 0x1d, pkt: encodeC2sSwapEquippedItem(100, 4) },
      { opcode: 0x1f, pkt: encodeC2sSwapContainerItem(101, 102, 3, 2) },
      { opcode: 0x23, pkt: encodeC2sBeltPut(103, 0) },
      { opcode: 0x24, pkt: encodeC2sBeltRemove(103) },
      { opcode: 0x25, pkt: encodeC2sBeltSwap(104, 103) },
      { opcode: 0x26, pkt: encodeC2sBeltUse(103, false) },
      { opcode: 0x27, pkt: encodeC2sIdentifyItem(105, 106) },
      { opcode: 0x28, pkt: encodeC2sSocketItem(107, 108) },
      { opcode: 0x29, pkt: encodeC2sScrollToBook(109, 110) },
      { opcode: 0x31, pkt: encodeC2sQuestMessage(15, 25) },
      { opcode: 0x36, pkt: encodeC2sNpcMercHire(15, 7) },
      { opcode: 0x38, pkt: encodeC2sNpcEntityAction(1, 15, 0) },
      { opcode: 0x41, pkt: encodeC2sResurrect() },
      { opcode: 0x4f, pkt: encodeC2sClickButton(0x12, 0) },
      { opcode: 0x5d, pkt: encodeC2sHostile(2, true, 0x04) },
      { opcode: 0x5e, pkt: encodeC2sPartyAction(6, 2) },
      { opcode: 0x61, pkt: encodeC2sMercItem(4) },
      { opcode: 0x62, pkt: encodeC2sNpcMercResurrect(15) },
    ]

    for (const { opcode, pkt } of directPackets) {
      expect(pkt[0]).toBe(opcode)
      expect(pkt.byteLength).toBe(C2S_PACKET_SIZES[opcode])
    }

    const cmds: ClientCommand[] = [
      { type: 'WarpTo', warpId: 42 },
      { type: 'TakeWarp', warpId: 42 },
      { type: 'ItemSwap', itemId: 100, slot: 4 },
      { type: 'SwapContainerItem', cursorItemId: 101, replacedItemId: 102, x: 3, y: 2 },
      { type: 'BeltPut', itemId: 103, slot: 0 },
      { type: 'BeltRemove', itemId: 103 },
      { type: 'BeltSwap', cursorItemId: 104, beltItemId: 103 },
      { type: 'BeltUse', itemId: 103, shift: true },
      { type: 'IdentifyItem', itemId: 105, scrollId: 106 },
      { type: 'SocketItem', itemId: 107, targetItemId: 108 },
      { type: 'ScrollToBook', scrollId: 109, bookId: 110 },
      { type: 'QuestMessage', npcId: 15, messageId: 25 },
      { type: 'MercHire', npcId: 15, mercId: 7 },
      { type: 'NpcEntityAction', action: 3, npcId: 15, complement: 0 },
      { type: 'Resurrect' },
      { type: 'ClickButton', buttonId: 0x12, amount: 0 },
      { type: 'Hostile', targetPlayerId: 2, hostile: true },
      { type: 'PartyAction', action: 6, targetPlayerId: 2 },
      { type: 'MercItem', slot: 4 },
      { type: 'MercResurrect', npcId: 15 },
    ]

    for (const cmd of cmds) {
      const pkts = encodeClientCommand(cmd)
      expect(pkts.length).toBe(1)
      const pkt = pkts[0]!
      expect(pkt.byteLength).toBe(C2S_PACKET_SIZES[pkt[0]!])
    }
  })

  it('resolves all Act 1–5 town & quest NPC descriptors by hcIdx', async () => {
    const {
      getTownNpcDescriptorByHcIdx,
      NPC_HCIDX_TO_DESCRIPTOR_ID,
      TOWN_NPC_SERVICES,
    } = await import('../../src/common/units/npc-table.ts')

    const expectedHcIdx = [
      146, 147, 148, 150, 154, 155, 265,
      175, 176, 177, 178, 198, 199, 200, 201, 202, 210, 244, 251,
      245, 252, 253, 254, 255, 257, 297,
      246, 367, 405,
      511, 512, 513, 514, 515, 520, 521,
    ]

    for (const hcIdx of expectedHcIdx) {
      const desc = getTownNpcDescriptorByHcIdx(hcIdx)
      expect(desc, `Missing NPC descriptor for hcIdx=${hcIdx}`).toBeDefined()
      expect(NPC_HCIDX_TO_DESCRIPTOR_ID[hcIdx]).toBe(desc!.id)
      expect(desc!.gossipLines?.length).toBeGreaterThan(0)
    }

    expect(TOWN_NPC_SERVICES.kashya?.canHire).toBe(true)
    expect(TOWN_NPC_SERVICES.greiz?.canHire).toBe(true)
    expect(TOWN_NPC_SERVICES.asheara?.canHire).toBe(true)
    expect(TOWN_NPC_SERVICES.qual_kehk?.canHire).toBe(true)
    expect(TOWN_NPC_SERVICES.warriv?.travelActions).toContain('travel_east')
    expect(TOWN_NPC_SERVICES.meshif_act2?.travelActions).toContain('travel_east')
    expect(TOWN_NPC_SERVICES.tyrael_act4?.travelActions).toContain('travel_harrogath')
    expect(TOWN_NPC_SERVICES.charsi?.questRewardActions).toContain('imbue')
    expect(TOWN_NPC_SERVICES.larzuk?.questRewardActions).toContain('add_sockets')
    expect(TOWN_NPC_SERVICES.anya?.questRewardActions).toContain('personalize')
  })

  it('bridges online ItemData into UiInventoryItem with canonical 1.13c names, stats, requirements, and sockets', async () => {
    const { onlineItemDataToUiInventoryItem } = await import('../../src/common/items/item-bridge.ts')
    const { resolveGroundItemMetadata } = await import('../../src/common/items/ground-items.ts')

    // 1. Unique item with stats and sockets
    const shako = makeItem({
      id: 700,
      code: 'uap',
      quality: 7,
      identified: true,
      defense: 141,
      durability: 12,
      maxDurability: 12,
      totalSockets: 1,
      usedSockets: 1,
      stats: [
        { statId: 127, param: 0, value: 2 }, // item_allskills: +2 to All Skill Levels
        { statId: 0, param: 0, value: 2 },   // strength: +2 to Strength
        { statId: 80, param: 0, value: 50 }, // item_magicbonus: 50% Better Chance of Getting Magic Items
      ],
    })
    const topaz = makeItem({
      id: 701,
      code: 'gpz',
      quality: 2,
      identified: true,
      inSocket: true,
      ownerId: 700,
      stats: [{ statId: 80, param: 0, value: 24 }],
    })

    const uiShako = onlineItemDataToUiInventoryItem(shako, [topaz])
    expect(uiShako.quality).toBe('unique')
    expect(uiShako.name).toContain('Harlequin Crest')
    expect(uiShako.reqLevel).toBeGreaterThanOrEqual(43)
    expect(uiShako.sockets).toBe(1)
    expect(uiShako.socketedItems).toHaveLength(1)
    expect(uiShako.stats.some(s => !s.text.startsWith('Stat #'))).toBe(true)
    expect((uiShako.statsEn ?? uiShako.stats).some(s => s.text.includes('Strength') || s.text.includes('Skill'))).toBe(true)

    // 2. Ground gold pile with goldAmount
    const goldItem = makeItem({
      id: 702,
      code: 'gld',
      goldAmount: 350,
    })
    const uiGold = onlineItemDataToUiInventoryItem(goldItem)
    expect(uiGold.name).toBe('350 Gold')
    const groundMeta = resolveGroundItemMetadata(goldItem)
    expect(groundMeta.labelText).toBe('350 Gold')
  })

  it('reduces Npc, Merc, SkillCast, player death/resurrect, Party, Trade, and Tile warpId in ClientWorld', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'StatSet', stat: 7, value: 100 << 8 }) // maxLife = 100
    world.apply({ type: 'StatSet', stat: 6, value: 100 << 8 }) // life = 100
    expect(world.isDead).toBe(false)

    // 1. Tile warpId
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 5, id: 300, classId: 18, warpId: 18, x: 5020, y: 5020 },
    })
    expect(world.getUnit(5, 300)?.warpId).toBe(18)

    // 2. Ground item goldAmount & name
    const groundGold = makeItem({
      id: 800,
      code: 'gld',
      action: 0,
      container: 'ground',
      worldX: 5005,
      worldY: 5005,
      goldAmount: 420,
    })
    world.apply({ type: 'ItemEvent', action: 0, item: groundGold, container: 'ground' })
    const itemUnit = world.getUnit('item', 800)
    expect(itemUnit?.goldAmount).toBe(420)
    expect(itemUnit?.name).toBe('420 Gold')

    // 3. NPC interaction & heal
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 50, classId: 148, name: 'Akara', x: 5010, y: 5010, lifePct: 80 },
    })
    world.noteOutgoingCommand({ type: 'NpcInit', target: { unitType: 1, id: 50 } })
    expect(world.npcInteraction.npcId).toBe(50)
    world.apply({ type: 'Npc', kind: 'info', npcId: 50, raw: new Uint8Array([0x27, 0x01]) })
    world.apply({ type: 'Npc', kind: 'menu', npcId: 50, raw: new Uint8Array([0x91, 0x01]) })
    expect(world.npcInteraction.npcInfoRaw?.[0]).toBe(0x27)
    expect(world.npcInteraction.npcTalkRaw?.[0]).toBe(0x91)
    world.noteOutgoingCommand({ type: 'NpcEntityAction', action: 3, npcId: 50 })
    expect(world.npcInteraction.activeWindow).toBe('hire')
    world.apply({ type: 'Npc', kind: 'heal', npcId: 50, result: 112 })
    expect(world.getUnit('monster', 50)?.lifePct).toBe(112)

    // 4. Mercenary hire list, assign, equipment, and revive cost
    world.apply({ type: 'Merc', kind: 'hireList' }) // 0x4F clear
    world.apply({ type: 'Merc', kind: 'hireList', nameId: 10, value: 0x11223344 })
    world.apply({ type: 'Merc', kind: 'hireList', nameId: 11, value: 0x55667788 })
    expect(world.mercHireList).toHaveLength(2)

    world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId: 90, classId: 271, nameId: 10 })
    expect(world.merc?.mercId).toBe(90)
    expect(world.merc?.isDead).toBe(false)

    const mercHelm = makeItem({
      id: 810,
      code: 'cap',
      action: 6,
      container: 'merc',
      ownerType: 1,
      ownerId: 90,
      equippedSlot: 1,
      bodyLoc: 1,
    })
    world.apply({ type: 'ItemEvent', action: 6, item: mercHelm, container: 'merc' })
    expect(world.containers.merc.has(810)).toBe(true)
    expect(world.containers.merc.get(1)?.id).toBe(810)

    // Unequip merc helm to cursor
    world.apply({ type: 'ItemEvent', action: 8, item: mercHelm, container: 'merc' })
    expect(world.containers.merc.has(810)).toBe(false)
    expect(world.containers.merc.get(1)).toBeUndefined()
    expect(world.containers.cursor?.id).toBe(810)

    // Merc death & revive cost (0x9B)
    world.apply({ type: 'Merc', kind: 'stat', nameId: 10, value: 15000 })
    expect(world.merc?.isDead).toBe(true)
    expect(world.merc?.reviveCost).toBe(15000)

    // 5. SkillCast animation state & direction
    world.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 36,
      skillId: 36, // Fire Bolt (spellcast mode 10)
      level: 1,
      target: { x: 5010, y: 5000 },
    })
    const selfUnit = world.getUnit(0, 1)!
    expect(selfUnit.mode).toBe(10)
    expect(selfUnit.castState?.skillId).toBe(36)
    expect(world.self.castState?.skillId).toBe(36)

    // 6. Player death and town resurrection (D2Client.dll 0x6fac9830 / 0x6fb5ebe0 / 0x6fb5eca0)
    // Sub-integer poison HP (life === 0 on 0x95/0x18) never kills a living player without 0x0D mode 0/17:
    world.apply({ type: 'LifeMana', life: 0, mana: 10, stamina: 50, at: { x: 5000, y: 5000 } })
    expect(world.isDead).toBe(false)
    expect(world.self.isDead).toBe(false)
    // Authoritative player death via S2C 0x0D PlayerStop (rawCode 0x08 -> mode 0 / rawCode 0x09 -> mode 17):
    world.apply({ type: 'UnitMode', unitType: 0, id: 1, mode: 17, at: { x: 5000, y: 5000 }, lifePct: 0 })
    expect(world.isDead).toBe(true)
    expect(world.self.isDead).toBe(true)
    world.noteOutgoingCommand({ type: 'Resurrect' })
    // Resurrect command does not optimistically revive until server LifeMana/Reassign arrives (Issue #578)
    expect(world.isDead).toBe(true)
    world.apply({ type: 'LifeMana', life: 100 << 8, mana: 10, stamina: 50, at: { x: 5000, y: 5000 } })
    expect(world.isDead).toBe(false)

    // 7. Party roster, relation, hostility, loot permit, position
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charName: 'BarbPeer',
      charClass: 4,
      charLevel: 20,
      partyId: 0xffff, // 0x5B unpartied player joining game
    })
    expect(world.party.has(2)).toBe(true)
    expect(world.party.get(2)?.partyState).toBe(0)

    world.apply({ type: 'Party', kind: 'relation', unitId: 2, relation: 2 }) // invited
    expect(world.party.get(2)?.partyState).toBe(2)

    world.apply({ type: 'Party', kind: 'roster', unitId: 2, partyId: 1 }) // joined party 1
    expect(world.party.get(2)?.partyState).toBe(1)

    world.apply({ type: 'Party', kind: 'relation', unitId: 2, otherId: 1, relation: 0x0c }) // hostile + loot (PvP disabled -> hostile remains false)
    expect(world.party.get(2)?.hostile).toBe(false)
    expect(world.party.get(2)?.lootPermit).toBe(true)

    world.apply({ type: 'Party', kind: 'memberPos', unitId: 2, at: { x: 5100, y: 5200 } })
    expect(world.party.get(2)?.x).toBe(5100)
    expect(world.party.get(2)?.y).toBe(5200)

    world.apply({ type: 'Party', kind: 'roster', unitId: 2, partyId: 0xffff }) // 0x5C left game
    expect(world.party.has(2)).toBe(false)

    // 8. Trade session state & trade grids (1.13c D2Client.dll 0x6fb0a520 / 0x6fb5bfd0)
    world.apply({ type: 'Trade', action: 0x01 }) // target trade invitation dialog
    expect(world.trade.pendingModal).toBe('request')
    expect(world.trade.active).toBe(false)

    world.apply({ type: 'Trade', action: 0x78, partnerId: 2, partnerName: 'BarbPeer' }) // open trade session
    expect(world.trade.active).toBe(true)
    expect(world.trade.pendingModal).toBeNull()
    expect(world.trade.partnerName).toBe('BarbPeer')

    const myTradeItem = makeItem({
      id: 820,
      code: 'rin',
      action: 4,
      container: 'trade',
      ownerId: 1,
      gridX: 0,
      gridY: 0,
    })
    const partnerTradeItem = makeItem({
      id: 821,
      code: 'amu',
      action: 4,
      container: 'trade',
      ownerId: 2,
      gridX: 1,
      gridY: 0,
    })
    world.apply({ type: 'ItemEvent', action: 4, item: myTradeItem, container: 'trade' })
    world.apply({ type: 'ItemEvent', action: 4, item: partnerTradeItem, container: 'trade' })
    expect(world.containers.tradeSelf.has(820)).toBe(true)
    expect(world.containers.tradePartner.has(821)).toBe(true)
    expect(world.containers.tradeGrid.some(i => i.id === 820)).toBe(true)
    expect(world.containers.partnerTradeGrid.some(i => i.id === 821)).toBe(true)

    world.apply({ type: 'Trade', action: 0x05 }) // PartnerAccepted (0x6fb0a3b9)
    expect(world.trade.partnerAccepted).toBe(true)

    world.apply({ type: 'Trade', action: 0x7901, gold: 5000 })
    world.apply({ type: 'Trade', action: 0x7900, gold: 8000 })
    expect(world.trade.selfGold).toBe(5000)
    expect(world.trade.partnerGold).toBe(8000)

    world.apply({ type: 'Trade', action: 0x0e }) // DisableAcceptButton (0x6fb0a4ff)
    expect(world.trade.acceptDisabled).toBe(true)
    expect(world.trade.partnerAccepted).toBe(false)

    world.apply({ type: 'Trade', action: 0x0f }) // EnableAcceptButton (0x6fb0a50e)
    expect(world.trade.acceptDisabled).toBe(false)

    world.apply({ type: 'Trade', action: 0x02 }) // cancel trade
    expect(world.trade.active).toBe(false)
    expect(world.containers.tradeGrid).toHaveLength(0)
    expect(world.containers.partnerTradeGrid).toHaveLength(0)
  })

  /**
   * Issue #905 action-frame timing: player casts schedule their missiles at the
   * cast animation's AnimData.d2 event frame. Advance the world clock straight
   * to that frame (expireCastStates only — no missile aging) so spawn-time
   * assertions observe the freshly released volley.
   */
  function fireActionFrame(world: ClientWorld, playerKey: string): void {
    const cs = world.units.get(playerKey)?.castState
    if (cs && cs.missileFireDelayMs !== undefined && cs.missileFireDelayMs > 0) {
      world.expireCastStates(cs.startedAtMs + cs.missileFireDelayMs, 0)
    }
  }

  it('R1: attaches canonical 1.13c cast overlays, deduplicates local cast echoes within 250ms, and expires castState to neutral mode 1', async () => {
    const { getSkillCastOverlay } = await import('../../src/common/skills/missiles-data.ts')
    expect(getSkillCastOverlay(36)).toBe('fire_cast_1')
    expect(getSkillCastOverlay(39)).toBe('ice_cast_1')
    expect(getSkillCastOverlay(44)).toBe('ice_cast_2')
    expect(getSkillCastOverlay(47)).toBe('fire_cast_2')
    expect(getSkillCastOverlay(49)).toBe('light_cast_1')
    expect(getSkillCastOverlay(54)).toBe('teleport')
    expect(getSkillCastOverlay(62)).toBe('fire_cast_2')
    expect(getSkillCastOverlay(64)).toBe('ice_cast_3')
    // Issue #955: necromancer skills have NO castOverlay in 1.13c Skills.txt (their cast
    // visuals are the cltmissilea projectiles); the old bonecast/cursecast entries were
    // invented tokens absent from Overlay.txt.
    expect(getSkillCastOverlay(66)).toBeUndefined()
    expect(getSkillCastOverlay(67)).toBeUndefined()
    expect(getSkillCastOverlay(68)).toBeUndefined()
    expect(getSkillCastOverlay(84)).toBeUndefined()
    expect(getSkillCastOverlay(101)).toBe('cast_undead')
    expect(getSkillCastOverlay(112)).toBeUndefined()
    expect(getSkillCastOverlay(119)).toBe('cast_undead')
    expect(getSkillCastOverlay(121)).toBeUndefined()
    expect(getSkillCastOverlay(8)).toBe('cast_innersight')
    expect(getSkillCastOverlay(32)).toBeUndefined()
    expect(getSkillCastOverlay(138)).toBeUndefined()
    expect(getSkillCastOverlay(149)).toBeUndefined()
    expect(getSkillCastOverlay(154)).toBe('warcry')
    expect(getSkillCastOverlay(155)).toBeUndefined()
    expect(getSkillCastOverlay(225)).toBe('druid_fire_cast_1')

    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 36 })

    // Local cast command attaches fire_cast_1 overlay and spawns 1 firebolt missile
    const castCmd: ClientCommand = {
      type: 'SkillAt',
      hand: 'right',
      at: { x: 5020, y: 5000 },
      hold: false,
    }
    world.noteOutgoingCommand(castCmd)
    // Calling noteOutgoingCommand again with the same command object is idempotent
    world.noteOutgoingCommand(castCmd)

    const selfUnit = world.getUnit(0, 1)!
    expect(selfUnit.mode).toBe(10)
    expect(selfUnit.castState?.skillId).toBe(36)
    expect(selfUnit.castState?.castOverlayToken).toBe('fire_cast_1')
    expect(selfUnit.overlays?.some(o => o.token === 'fire_cast_1' && o.loop === false)).toBe(true)

    // Action-frame timing (Issue #905): nothing is airborne at cast start — the
    // firebolt leaves at the cast animation's AnimData.d2 event frame.
    const missilesAtStart = Array.from(world.units.values()).filter(u => u.unitType === 'missile')
    expect(missilesAtStart).toHaveLength(0)

    // Server echo within 250ms must not duplicate the cast overlay or schedule a second firebolt
    world.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 36,
      skillId: 36,
      level: 1,
      target: { x: 5020, y: 5000 },
    })
    expect(selfUnit.overlays?.filter(o => o.token === 'fire_cast_1')).toHaveLength(1)

    // Stepping ticks fires the missile at the action frame, advances the
    // one-shot overlay, and expires castState back to mode 1 (Neutral)
    const startMs = selfUnit.castState!.startedAtMs
    let fireboltMissile: { missileKey?: string | undefined } | undefined
    for (let i = 1; i <= 15; i++) {
      world.tick(40, startMs + i * 40)
      if (!fireboltMissile) {
        fireboltMissile = Array.from(world.units.values()).find(
          u => u.unitType === 'missile' && u.missileKey === 'firebolt',
        )
      }
    }
    expect(fireboltMissile).toBeDefined()
    expect(fireboltMissile?.missileKey).toBe('firebolt')
    expect(selfUnit.castState).toBeUndefined()
    expect(world.self.castState).toBeUndefined()
    expect(selfUnit.mode).toBe(1)
    expect(selfUnit.overlays?.some(o => o.token === 'fire_cast_1')).toBe(false)
  })

  it('R2: decodes 0x73 CreateMissile and simulates 1.13c linear, fan, radial ring, spiral, emitter, and skyfall trajectories at 25Hz', async () => {
    const { decodeD2gsS2cPacket } = await import('../../src/netproto/index.ts')
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })

    // 1. 0x73 CreateMissile wire packet decoding & ClientWorld reduction (missileId=62 fireball at (5002,5004) -> (5022,5004))
    const raw0x73 = new Uint8Array(32)
    const dv = new DataView(raw0x73.buffer)
    raw0x73[0] = 0x73
    dv.setUint32(1, 0, true) // unk
    dv.setUint16(5, 62, true) // missileClassId = 62 (fireball)
    dv.setUint16(7, 5002, true) // x
    dv.setUint16(9, 5004, true) // y
    dv.setUint16(11, 5022, true) // targetX
    dv.setUint16(13, 5004, true) // targetY
    raw0x73[15] = 5 // level = 5
    raw0x73[16] = 0 // ownerType = player
    dv.setUint32(17, 2, true) // ownerId = 2 (remote player)
    const ev0x73 = decodeD2gsS2cPacket(raw0x73)
    expect(ev0x73.type).toBe('CreateMissile')
    if (ev0x73.type === 'CreateMissile') {
      expect(ev0x73.missileClassId).toBe(62)
      expect(ev0x73.at).toEqual({ x: 5002, y: 5004 })
      expect(ev0x73.target).toEqual({ x: 5022, y: 5004 })
      expect(ev0x73.level).toBe(5)
      expect(ev0x73.owner).toEqual({ unitType: 0, id: 2 })
    }
    world.apply(ev0x73)
    const spawnedFireball = Array.from(world.units.values()).find(
      u => u.unitType === 'missile' && u.missileKey === 'fireball',
    )
    expect(spawnedFireball).toBeDefined()
    expect(spawnedFireball?.x).toBe(5002)
    expect(spawnedFireball?.y).toBe(5004)
    world.tick(40, Date.now() + 40)
    expect(spawnedFireball!.x).toBeGreaterThan(5002)

    // 2. Charged Bolt (skill 38, level 3 -> 5 bolts aiming at target with PATHTYPE_CHARGEDBOLT 0x6FDB6AA0 waypoints)
    const cbWorld = new ClientWorld()
    cbWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 2, classId: 1, name: 'RemoteSorc', x: 5000, y: 5000 },
    })
    cbWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 99, classId: 1, name: 'Zombie', x: 5001, y: 5000, lifePct: 128 },
    })
    cbWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 2 },
      skill: 38,
      skillId: 38,
      level: 3,
      target: { x: 5015, y: 5000 },
    })
    fireActionFrame(cbWorld, 'player:2')
    const chargedBolts = Array.from(cbWorld.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'chargedbolt',
    )
    expect(chargedBolts).toHaveLength(5)
    for (const bolt of chargedBolts) {
      expect(bolt.targetX).toBe(5015)
      expect(bolt.targetY).toBe(5000)
      expect(bolt.maxTicks).toBe(77)
      expect(bolt.subLoop).toBe(1)
      expect(bolt.subStart).toBe(2)
      expect(bolt.subStop).toBe(8)
      expect(bolt.pathWaypoints).toHaveLength(38)
    }
    cbWorld.tick(80, Date.now() + 80)
    const zombie = cbWorld.units.get('monster:99')!
    expect(zombie.overlays.some(o => o.token === 'lightning')).toBe(true)
    expect(
      Array.from(cbWorld.units.values()).some(
        u => u.unitType === 'missile' && u.missileKey === 'lightninghit',
      ),
    ).toBe(false)

    // 3. Frost Nova (skill 44 -> 32 radial projectiles)
    const fnWorld = new ClientWorld()
    fnWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 2, classId: 1, name: 'RemoteSorc', x: 5000, y: 5000 },
    })
    fnWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 2 },
      skill: 44,
      skillId: 44,
      level: 1,
      target: { x: 5005, y: 5005 },
    })
    fireActionFrame(fnWorld, 'player:2')
    const frostNovas = Array.from(fnWorld.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'frostnova',
    )
    expect(frostNovas).toHaveLength(64) // CltDoFunc 25: 64-entry ring (Issue #1058)

    // 4. Blessed Hammer (skill 112 -> spiral trajectory)
    const bhWorld = new ClientWorld()
    bhWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 3, classId: 3, name: 'Hammerdin', x: 5000, y: 5000 },
    })
    bhWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 3 },
      skill: 112,
      skillId: 112,
      level: 1,
      target: { x: 5005, y: 5000 },
    })
    fireActionFrame(bhWorld, 'player:3')
    const hammer = Array.from(bhWorld.units.values()).find(
      u => u.unitType === 'missile' && u.missileKey === 'blessedhammer',
    )!
    expect(hammer).toBeDefined()
    const r0 = hammer.spiralRadius ?? 0
    bhWorld.tick(120, Date.now() + 120)
    expect(hammer.spiralRadius).toBeGreaterThan(r0)
    expect(Math.hypot(hammer.x - 5000, hammer.y - 5000)).toBeGreaterThan(0.25)

    // 5. Frozen Orb (skill 64 -> emits frozenorbbolt sub-missiles during flight)
    const foWorld = new ClientWorld()
    foWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 2, classId: 1, name: 'OrbSorc', x: 5000, y: 5000 },
    })
    foWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 2 },
      skill: 64,
      skillId: 64,
      level: 1,
      target: { x: 5030, y: 5000 },
    })
    fireActionFrame(foWorld, 'player:2')
    foWorld.tick(160, Date.now() + 160) // 4 ticks
    const subBolts = Array.from(foWorld.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'frozenorbbolt',
    )
    expect(subBolts.length).toBeGreaterThanOrEqual(4)

    // 6. Multiple Shot (skill 12, level 5 -> 6 multipleshotarrow missiles in a fan per 1.13c calc1 min(24, 1 + slvl), classId=213)
    const msWorld = new ClientWorld()
    msWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 0, name: 'AmaHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    msWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 12,
      skillId: 12,
      level: 5,
      target: { x: 5020, y: 5000 },
    })
    fireActionFrame(msWorld, 'player:1')
    const multiShotArrows = Array.from(msWorld.units.values()).filter(
      u => u.unitType === 'missile' && u.missileKey === 'multipleshotarrow',
    )
    expect(multiShotArrows).toHaveLength(6)
    expect(multiShotArrows.every(m => m.classId === 213)).toBe(true)

    // 6b. Amazon Bow Layer 4 (#962): Strafe (#26), Guided Arrow (#22), Exploding (#16), Immolation (#27), Freezing (#31)
    const amaWorld = new ClientWorld()
    amaWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 0, name: 'AmaBow', x: 5000, y: 5000 },
      isSelf: true,
    })
    amaWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 77, classId: 1, name: 'Fallen', x: 5008, y: 5006, lifePct: 128 },
    })
    // Strafe (#26) at slvl 1 with 1 nearby hostile monster: minArrows = 2 + floor(1/4) = 2 -> fires 2 strafearrows aimed at Fallen
    amaWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 26,
      skillId: 26,
      level: 1,
      target: { x: 5020, y: 5000 },
    })
    fireActionFrame(amaWorld, 'player:1')
    for (let i = 1; i <= 3; i++) {
      amaWorld.tick(40, 1000 + i * 40)
    }
    const strafeArrows = Array.from(amaWorld.units.values()).filter(
      u => u.unitType === 'missile' && (u.missileKey === 'strafearrow' || u.missileKey === 'multipleshotarrow'),
    )
    expect(strafeArrows).toHaveLength(2)
    expect(strafeArrows[0]!.targetX).toBe(5008)
    expect(strafeArrows[0]!.targetY).toBe(5006)

    // Guided Arrow (#22) homes toward nearest hostile monster every 5 frames (CltDoFunc=17)
    const gaUnit = amaWorld.spawnMissileByKey('guidedarrow', 5000, 5000, 5020, 5000, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 22,
      skillLevel: 1,
    })
    expect(gaUnit.vy).toBeCloseTo(0, 5)
    for (let i = 1; i <= 6; i++) {
      amaWorld.tick(40, 2000 + i * 40)
    }
    expect(gaUnit.vy).toBeGreaterThan(0)

    // Immolation Arrow (#27) CltHitFunc=12 spawns wCltMissileB=explodingarrowexp + radius-3 disc of 100-frame firewall/firesmall/firemedium ground patches (no fireexplosion, no immolationfire)
    const immArrow = amaWorld.spawnMissileByKey('immolationarrow', 5007, 5006, 5008, 5006, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 27,
      skillLevel: 1,
    })
    immArrow.alwaysExplode = true
    amaWorld.tick(40, 3000)
    const afterImm = Array.from(amaWorld.units.values()).filter(u => u.unitType === 'missile')
    expect(afterImm.some(u => u.missileKey === 'explodingarrowexp')).toBe(true)
    expect(afterImm.filter(u => u.missileKey === 'fireexplosion')).toHaveLength(0)
    expect(afterImm.filter(u => u.missileKey === 'immolationfire')).toHaveLength(0)
    const immPatches = afterImm.filter(
      u => u.missileKey === 'firewall' || u.missileKey === 'firesmall' || u.missileKey === 'firemedium',
    )
    expect(immPatches.length).toBeGreaterThanOrEqual(20)
    expect(immPatches[0]!.maxTicks).toBe(100)

    // Freezing Arrow (#31) spawns freezingarrowexp1 + 3..4 freezingarrowexp2 on impact via CltHit14
    const faArrow = amaWorld.spawnMissileByKey('freezingarrow', 5007, 5006, 5008, 5006, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 31,
      skillLevel: 1,
    })
    faArrow.explosionMissile = 'freezingarrowexp1'
    faArrow.alwaysExplode = true
    amaWorld.tick(40, 3040)
    const afterFa = Array.from(amaWorld.units.values()).filter(u => u.unitType === 'missile')
    expect(afterFa.some(u => u.missileKey === 'freezingarrowexp1')).toBe(true)
    expect([3, 4]).toContain(afterFa.filter(u => u.missileKey === 'freezingarrowexp2').length)

    // 7. Challenge 3: spawnMissileByKey('arrow') without opts.classId preserves classId === 0
    const arrowUnit = msWorld.spawnMissileByKey('arrow', 5000, 5000, 5020, 5000)
    expect(arrowUnit.classId).toBe(0)
    expect(arrowUnit.missileKey).toBe('arrow')

    // 8. Full R2 skill sweep: all 36 R2 skill IDs cast and step at 25Hz without throwing
    const allR2Skills = [
      6, 7, 11, 12, 16, 21, 22, 26, 27, 31, 36, 38, 39, 42, 43, 44, 45, 46,
      47, 48, 49, 51, 53, 54, 55, 56, 59, 64, 66, 67, 84, 92, 93, 101, 112, 121,
    ]
    for (const skillId of allR2Skills) {
      const sweepWorld = new ClientWorld()
      sweepWorld.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Caster', x: 5000, y: 5000 },
        isSelf: true,
      })
      expect(() => {
        sweepWorld.apply({
          type: 'SkillCast',
          caster: { unitType: 0, id: 1 },
          skill: skillId,
          skillId,
          level: 3,
          target: { x: 5020, y: 5005 },
        })
        sweepWorld.tick(40, 1000)
      }).not.toThrow()
    }
  })

  it('R3: detects wall and hostile monster collisions, respects pierce, and spawns one-shot 1.13c ExplosionMissile visuals', () => {
    // 1. Blocked sub-tile collision -> spawns fireexplode and removes firebolt
    const wallWorld = new ClientWorld()
    wallWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    wallWorld.setSubTileBlocked(5005, 5000, true)
    wallWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 36,
      skillId: 36, // Fire Bolt (vel=20 -> 0.9375 sub-tiles/tick)
      level: 1,
      target: { x: 5020, y: 5000 },
    })
    for (let i = 1; i <= 6; i++) {
      wallWorld.tick(40, Date.now() + i * 40) // 6 ticks -> 5.625 sub-tiles, reaches x=5005
    }
    const afterWallUnits = Array.from(wallWorld.units.values()).filter(u => u.unitType === 'missile')
    expect(afterWallUnits.some(u => u.missileKey === 'firebolt')).toBe(false)
    const wallExplosion = afterWallUnits.find(u => u.missileKey === 'fireexplode')
    expect(wallExplosion).toBeDefined()
    expect(wallExplosion?.loopAnim).toBe(false)

    // Step explosion past its lifetime -> clamps frame and removes upon completion
    for (let i = 1; i <= 15; i++) {
      wallWorld.tick(40, Date.now() + 240 + i * 40)
    }
    expect(
      Array.from(wallWorld.units.values()).some(u => u.missileKey === 'fireexplode'),
    ).toBe(false)

    // 2. Hostile monster collision: non-piercing Ice Blast vs piercing Bone Spear
    const monWorld = new ClientWorld()
    monWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })
    monWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 99, classId: 1, name: 'Fallen', x: 5003, y: 5000, lifePct: 100 },
    })
    // Ice Blast (skill 45) hits Fallen at (5003, 5000), spawns freezeexplode + glacialspikeejecta, and is removed
    monWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 45,
      skillId: 45,
      level: 1,
      target: { x: 5020, y: 5000 },
    })
    monWorld.tick(120, Date.now() + 120)
    const monMissiles = Array.from(monWorld.units.values()).filter(u => u.unitType === 'missile')
    expect(monMissiles.some(u => u.missileKey === 'iceblast')).toBe(false)
    expect(monMissiles.some(u => u.missileKey === 'freezingarrowexp1')).toBe(true)

    // Piercing Bone Spear (skill 84) passes through Fallen without being destroyed
    const pierceWorld = new ClientWorld()
    pierceWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 2, classId: 2, name: 'Necro', x: 5000, y: 5000 },
    })
    pierceWorld.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 100, classId: 1, name: 'Zombie', x: 5003, y: 5000, lifePct: 100 },
    })
    pierceWorld.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 2 },
      skill: 84,
      skillId: 84,
      level: 1,
      target: { x: 5030, y: 5000 },
    })
    pierceWorld.tick(200, Date.now() + 200)
    const boneSpear = Array.from(pierceWorld.units.values()).find(
      u => u.unitType === 'missile' && u.missileKey === 'bonespear',
    )
    expect(boneSpear).toBeDefined()
    expect(boneSpear?.hitUnitIds?.has(100)).toBe(true)
    expect(boneSpear!.x).toBeGreaterThan(5005)
  })

  it('Issue #551: initializes alive monsters/NPCs (e.g. Rogue Scout) in MONMODE_NEUTRAL (1) instead of MONMODE_DEATH (0) and transitions mode on UnitMove', () => {
    const world = new ClientWorld()

    // Assign an alive camp Rogue Scout without an explicit mode field
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 42,
        classId: 564, // act1hire (Rogue Scout)
        x: 5110,
        y: 5060,
        lifePct: 128,
      },
    })
    const rogue = world.getUnit(1, 42)!
    expect(rogue).toBeDefined()
    expect(rogue.mode).toBe(1) // MONMODE_NEUTRAL (1), never MONMODE_DEATH (0)

    // Patrol walk (0x67 NPCMove) transitions mode to MONMODE_WALK (2)
    world.apply({
      type: 'UnitMove',
      unitType: 1,
      id: 42,
      mode: 'walk',
      from: { x: 5110, y: 5060 },
      to: { x: 5116, y: 5064 },
    })
    expect(rogue.mode).toBe(2)

    // Patrol stop (0x6D NPCStop) transitions mode back to MONMODE_NEUTRAL (1)
    world.apply({
      type: 'UnitMove',
      unitType: 1,
      id: 42,
      mode: 'stop',
      to: { x: 5116, y: 5064 },
    })
    expect(rogue.mode).toBe(1)

    // Dead monster spawned with lifePct=0 defaults to MONMODE_DEAD (12)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 1,
        id: 99,
        classId: 1,
        x: 5200,
        y: 5200,
        lifePct: 0,
      },
    })
    expect(world.getUnit(1, 99)?.mode).toBe(12)
  })

  it('Issue #551: live .d2cap Rogue Encampment captures never render alive camp NPCs (Rogue Scout, Akara, Charsi, Kashya, Warriv, Gheed) as corpses or mode=0 (DT)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { OnlineSession } = await import('../../src/client/session/online-session.ts')
    const { createSettingsStore } = await import('../../src/client/settings/settings-store.ts')
    const { buildSceneDrawables } = await import('../../src/client/view/unit-drawables.ts')

    for (const fixture of [
      '02-d2gs-town-walk-chat.d2cap',
      '03-d2gs-items-npc-skills.d2cap',
      '05-d2gs-vendor-open.d2cap',
    ]) {
      const text = readFileSync(resolve('tests/fixtures/netproto', fixture), 'utf8')
      const session = new OnlineSession({ settingsStore: createSettingsStore() })
      session.loadD2CapReplay(text)
      session.replayAllD2Cap()
      for (let i = 0; i < 30; i++) session.tick(40, 1000 + i * 40)

      const renderUnits = session.buildRenderableUnits()
      const monsterUnits = renderUnits.filter(u => u.kind === 'monster')
      expect(monsterUnits.length, `${fixture} should have camp NPCs`).toBeGreaterThan(0)

      for (const npc of monsterUnits) {
        expect(npc.isCorpse, `${fixture} npc id=${npc.id} classId=${npc.classId}`).toBe(false)
        expect(npc.mode, `${fixture} npc id=${npc.id} classId=${npc.classId} mode`).not.toBe(0)
        expect(npc.mode, `${fixture} npc id=${npc.id} classId=${npc.classId} mode`).not.toBe(12)
      }

      const scene = buildSceneDrawables(renderUnits)
      const monsterDrawables = scene.unitDrawables.filter(u => u.unitKind === 'monster')
      expect(monsterDrawables.length).toBe(monsterUnits.length)
      for (const d of monsterDrawables) {
        expect(d.isCorpse, `${fixture} drawable id=${d.unitId} classId=${d.classId}`).toBe(false)
        expect(d.mode, `${fixture} drawable id=${d.unitId} classId=${d.classId}`).toBeGreaterThan(0)
        expect(d.mode, `${fixture} drawable id=${d.unitId} classId=${d.classId}`).not.toBe(12)
      }
    }
  })

  it('1.13c Meteor (#56) visual parity: CltDoFunc=09 59-tick 3D trajectory, lockstep meteortail+meteor, progressive light, and CltHitFunc=18 5x meteorexplode + whitelightmissile + 18x firemedium/firesmall (subStart=12..36)', async () => {
    const { buildSceneDrawables } = await import('../../src/client/view/unit-drawables.ts')
    const {
      METEOR_EXPLODE_SUBTILE_OFFSETS,
      METEOR_FIRE_SUBTILE_OFFSETS,
    } = await import('../../src/common/data/meteor-table.ts')

    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 0, id: 1, classId: 1, name: 'SorcHero', x: 5000, y: 5000 },
      isSelf: true,
    })

    const targetX = 5020
    const targetY = 5010
    const slvl = 5
    world.apply({
      type: 'SkillCast',
      caster: { unitType: 0, id: 1 },
      skill: 56,
      skillId: 56,
      level: slvl,
      target: { x: targetX, y: targetY },
    })
    fireActionFrame(world, 'player:1')

    // 1. At tick 0 (rem = 59): 1 meteorcenter + 1 meteortail + 1 meteor
    const getMissiles = () => Array.from(world.units.values()).filter(u => u.unitType === 'missile')
    const initial = getMissiles()
    expect(initial).toHaveLength(3)
    const center = initial.find(m => m.missileKey === 'meteorcenter')!
    const tail = initial.find(m => m.missileKey === 'meteortail')!
    const core = initial.find(m => m.missileKey === 'meteor')!
    expect(center).toBeDefined()
    expect(tail).toBeDefined()
    expect(core).toBeDefined()
    expect(center.maxTicks).toBe(60)
    expect(tail.maxTicks).toBe(60)
    expect(core.maxTicks).toBe(60)
    expect(core.x).toBeCloseTo(targetX - (15 * 59) / 32, 5)
    expect(core.y).toBe(targetY)
    expect(core.altitude).toBe(25 * 59)
    expect(tail.x).toBeCloseTo(core.x, 5)
    expect(tail.y).toBe(core.y)
    expect(tail.altitude).toBe(core.altitude)

    // 2. Scene drawables depth sort order & additive blendMode at tick 0
    const scene0 = buildSceneDrawables(
      initial.map(u => ({
        id: u.id,
        kind: 'missile' as const,
        classId: u.classId,
        missileKey: u.missileKey,
        x: u.x,
        y: u.y,
        altitude: u.altitude,
        ageTicks: u.ageTicks,
        maxTicks: u.maxTicks,
        frame: u.frame,
        totalFrames: u.totalFrames,
        loopAnim: u.loopAnim,
      })),
    )
    expect(scene0.missileDrawables).toHaveLength(3)
    const sortedKeys0 = scene0.sortedDrawables
      .filter(d => d.drawableKind === 'missile')
      .map(d => (d as any).missileKey)
    expect(sortedKeys0).toEqual(['meteorcenter', 'meteortail', 'meteor'])
    const coreDrawable0 = scene0.missileDrawables.find(d => d.missileKey === 'meteor')!
    const tailDrawable0 = scene0.missileDrawables.find(d => d.missileKey === 'meteortail')!
    const centerDrawable0 = scene0.missileDrawables.find(d => d.missileKey === 'meteorcenter')!
    // Missiles.txt meteor Trans empty -> eDrawMode 5 opaque; meteortail / meteorcenter Trans 1 -> additive (0x6FB1CF32).
    expect(coreDrawable0.blendMode).toBe('normal')
    expect(tailDrawable0.blendMode).toBe('additive')
    expect(centerDrawable0.blendMode).toBe('additive')
    expect(centerDrawable0.lightRadius).toBe(4) // Missiles.txt Light of meteorcenter (#830)

    // 3. Step 59 ticks (ticks 1..59): continuous lockstep descent, no extra meteortail puffs spawned
    for (let t = 1; t <= 59; t++) {
      world.tick(40)
      const active = getMissiles()
      expect(active).toHaveLength(3)
      const rem = 59 - t
      expect(core.x).toBeCloseTo(targetX - (15 * rem) / 32, 5)
      expect(core.y).toBe(targetY)
      expect(core.altitude).toBe(25 * rem)
      expect(tail.x).toBeCloseTo(core.x, 5)
      expect(tail.y).toBe(core.y)
      expect(tail.altitude).toBe(core.altitude)
    }

    // At tick 59 the meteorcenter light is still Missiles.txt Light 4: the age-based growth was invented and is gone
    // (#830); the 1.13c growth at 0x6fb6905b is not ported yet.
    const scene59 = buildSceneDrawables([
      {
        id: center.id,
        kind: 'missile',
        classId: center.classId,
        missileKey: center.missileKey,
        x: center.x,
        y: center.y,
        ageTicks: center.ageTicks,
        maxTicks: center.maxTicks,
      },
    ])
    expect(scene59.missileDrawables[0]?.lightRadius).toBe(4)

    // 4. Block 1 ground fire sub-tile before tick 60 impact to verify collision filtering
    const blockedOff = METEOR_FIRE_SUBTILE_OFFSETS[5]!
    world.setSubTileBlocked(targetX + blockedOff.x, targetY + blockedOff.y, true)

    // Tick 60: impact!
    world.tick(40)
    const afterImpact = getMissiles()
    expect(afterImpact.some(m => m.missileKey === 'meteorcenter')).toBe(false)
    expect(afterImpact.some(m => m.missileKey === 'meteor')).toBe(false)
    expect(afterImpact.some(m => m.missileKey === 'meteortail')).toBe(false)

    // 5 cross meteorexplode at METEOR_EXPLODE_SUBTILE_OFFSETS
    const explodes = afterImpact.filter(m => m.missileKey === 'meteorexplode')
    expect(explodes).toHaveLength(5)
    for (const off of METEOR_EXPLODE_SUBTILE_OFFSETS) {
      expect(
        explodes.some(e => e.x === targetX + off.x && e.y === targetY + off.y),
      ).toBe(true)
    }

    // 1 whitelightmissile at (targetX, targetY) with maxTicks = 10 + 5 * 10 = 60
    const whiteLights = afterImpact.filter(m => m.missileKey === 'whitelightmissile')
    expect(whiteLights).toHaveLength(1)
    expect(whiteLights[0]?.maxTicks).toBe(60)
    const impactScene = buildSceneDrawables(
      whiteLights.map(u => ({
        id: u.id,
        kind: 'missile' as const,
        classId: u.classId,
        missileKey: u.missileKey,
        x: u.x,
        y: u.y,
        ...(u.missileLightRadius !== undefined ? { missileLightRadius: u.missileLightRadius } : {}),
      })),
    )
    expect(impactScene.missileDrawables).toHaveLength(0)
    // No sprite, but a light record: Missiles.txt Light 5 replaced by SetRadius(12) at the spawn (0x6fb666f2, #830).
    expect(impactScene.pointLights).toHaveLength(0)
    expect(impactScene.lightEmitters).toHaveLength(1)
    expect(impactScene.lightEmitters[0]).toMatchObject({ unitType: 3, lightType: 1, radius: 12, fadeOnRemove: true })

    // 17 unblocked ground fires (3 firemedium + 14 firesmall), all with subStart=12, subStop=36
    const fireMediums = afterImpact.filter(m => m.missileKey === 'firemedium')
    const fireSmalls = afterImpact.filter(m => m.missileKey === 'firesmall')
    expect(fireMediums).toHaveLength(3)
    expect(fireSmalls).toHaveLength(14)
    for (const fm of [...fireMediums, ...fireSmalls]) {
      expect(fm.subLoop).toBe(1)
      expect(fm.subStart).toBe(12)
      expect(fm.subStop).toBe(36)
    }

    // Step 20 ticks into ground fire lifetime: active SubLoop frames must stay within [12, 36]
    for (let i = 0; i < 20; i++) world.tick(40)
    for (const fm of getMissiles().filter(
      m => m.missileKey === 'firemedium' || m.missileKey === 'firesmall',
    )) {
      expect(fm.frame).toBeGreaterThanOrEqual(12)
      expect(fm.frame).toBeLessThanOrEqual(36)
    }
  })

  describe('other player light radius & color stats (issue #879)', () => {
    it('resolves remote player light radius bonus and light color from equipped and socketed items', () => {
      const world = new ClientWorld()
      world.selfId = 1
      // Spawn remote player with unitId 42
      world.applyServerEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 0,
          id: 42,
          classId: 1, // sorceress
          x: 100,
          y: 100,
        },
      })

      // Initial stats: bonus 0, color 0 (white)
      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(0)
      expect(world.resolvePlayerLightColor(42)).toBe(0)

      // Remote player equips a helm (slot 1) with stat 89 (item_lightradius = 3)
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07, // Equip
        item: makeItem({
          id: 1001,
          code: 'hlm',
          container: 'equipment',
          bodyLoc: 1,
          equippedSlot: 1,
          ownerType: 0,
          ownerId: 42,
          stats: [{ statId: 89, param: 0, value: 3 }],
        }),
      })

      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(3)
      expect(world.resolvePlayerLightColor(42)).toBe(0)

      // Remote player equips a shield (slot 5) with stat 90 (item_lightcolor = 0x00FF80, cyan-green)
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07,
        item: makeItem({
          id: 1002,
          code: 'kit',
          container: 'equipment',
          bodyLoc: 5,
          equippedSlot: 5,
          ownerType: 0,
          ownerId: 42,
          stats: [{ statId: 90, param: 0, value: 0x00ff80 }],
        }),
      })

      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(3)
      expect(world.resolvePlayerLightColor(42)).toBe(0x00ff80)

      // Remote player equips armor (slot 3) containing a socketed jewel with +2 light radius
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07,
        item: makeItem({
          id: 1003,
          code: 'aar',
          container: 'equipment',
          bodyLoc: 3,
          equippedSlot: 3,
          ownerType: 0,
          ownerId: 42,
          socketed: true,
          stats: [],
        }),
      })
      // Socketed jewel child
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07,
        item: makeItem({
          id: 1004,
          code: 'jew',
          container: 'socket',
          ownerType: 4, // item owner
          ownerId: 1003, // inside armor 1003
          inSocket: true,
          stats: [{ statId: 89, param: 0, value: 2 }],
        }),
      })

      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(5) // 3 (helm) + 2 (jewel in armor)

      // Inactive swap weapon (slot 11) with +10 light radius should NOT be counted
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07,
        item: makeItem({
          id: 1005,
          code: 'wnd',
          container: 'equipment',
          bodyLoc: 11,
          equippedSlot: 11,
          ownerType: 0,
          ownerId: 42,
          stats: [{ statId: 89, param: 0, value: 10 }],
        }),
      })

      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(5) // Still 5, slot 11 ignored

      // Remote player unequips the helm
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x08, // Unequip
        item: makeItem({
          id: 1001,
          code: 'hlm',
          container: 'cursor',
          ownerType: 0,
          ownerId: 42,
        }),
      })

      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(2) // 5 - 3 = 2

      // Remote player equips an active weapon (slot 4) with +1 light radius and 0xFF8000 color
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x07,
        item: makeItem({
          id: 1006,
          code: 'crs',
          container: 'equipment',
          bodyLoc: 4,
          equippedSlot: 4,
          ownerType: 0,
          ownerId: 42,
          stats: [
            { statId: 89, param: 0, value: 1 },
            { statId: 90, param: 0, value: 0xff8000 },
          ],
        }),
      })
      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(3) // 2 (armor jewel) + 1 (slot 4)

      // Remote player performs Weapon Switch (0x17): swap weapon 1005 (+10 light radius) moves into slot 4,
      // displacing weapon 1006 (+1 light radius) into inactive slot 11
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x17, // WeaponSwitch
        item: makeItem({
          id: 1005,
          code: 'wnd',
          container: 'equipment',
          bodyLoc: 4,
          equippedSlot: 4,
          ownerType: 0,
          ownerId: 42,
          stats: [{ statId: 89, param: 0, value: 10 }],
        }),
      })
      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(12) // 2 (armor jewel) + 10 (slot 4)
      expect(world.resolvePlayerLightColor(42)).toBe(0x00ff80) // shield 1002 color remains active

      // Remote player swaps back (0x17): weapon 1006 returns to slot 4, displacing 1005 to slot 11
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x17,
        item: makeItem({
          id: 1006,
          code: 'crs',
          container: 'equipment',
          bodyLoc: 4,
          equippedSlot: 4,
          ownerType: 0,
          ownerId: 42,
          stats: [
            { statId: 89, param: 0, value: 1 },
            { statId: 90, param: 0, value: 0xff8000 },
          ],
        }),
      })
      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(3) // 2 (armor jewel) + 1 (slot 4)

      // Remote player unequips socketed armor 1003 -> socketed jewel 1004 (+2) is also cleaned up
      world.applyServerEvent({
        type: 'ItemEvent',
        action: 0x08,
        item: makeItem({
          id: 1003,
          code: 'aar',
          container: 'cursor',
          ownerType: 0,
          ownerId: 42,
        }),
      })
      expect(world.resolvePlayerLightRadiusBonus(42)).toBe(1) // only weapon 1006 (+1) remains
    })
  })

  describe('Mercenary classId preservation across teleports and level transitions (D2Client.dll 0x6fb5ca40 / 0x6fb5ea40)', () => {
    it('ignores 0x0A UnitRemove for the local player living mercenary and preserves classId across RoomHide, area-crossing prune, and 0x15 UnitReassign', () => {
      const world = new ClientWorld()
      world.apply({ type: 'RoomReveal', areaId: 2, tileX: 1000, tileY: 1000 })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        charClass: 1,
        name: 'SorcHero',
        x: 5010,
        y: 5010,
      })
      // 0x81 AssignMerc + 0xAC UnitAssign for Act 2 Desert Mercenary (hcIdx = 338)
      world.apply({
        type: 'Merc',
        kind: 'assign',
        ownerId: 1,
        mercId: 900,
        classId: 338,
        nameId: 5,
      })
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 900,
          classId: 338,
          x: 5012,
          y: 5012,
          lifePct: 128,
          mode: 1,
        },
      })
      // Also spawn a regular hostile monster in the same room (5014, 5014 -> tile 1002, 1002)
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 901,
          classId: 19, // Fallen
          x: 5014,
          y: 5014,
          lifePct: 128,
          mode: 1,
        },
      })

      // 1. D2Client.dll 0x6fb5ca40: 0x0A UnitRemove must NOT remove the local player's living mercenary
      world.apply({ type: 'UnitRemove', unitType: 1, id: 900 })
      expect(world.getUnit('monster', 900)?.classId).toBe(338)
      expect(world.monsters.get(900)?.classId).toBe(338)
      expect(world.npcMotion.getUnit(900)?.dwClassId).toBe(338)

      // 2. RoomHide (0x08) on the old room (tileX=1000, tileY=1000) prunes regular monster 901 but preserves merc 900
      world.apply({ type: 'RoomReveal', areaId: 3, tileX: 1080, tileY: 1080 })
      world.apply({ type: 'RoomHide', areaId: 2, tileX: 1000, tileY: 1000 })
      expect(world.getUnit('monster', 901)).toBeUndefined()
      expect(world.getUnit('monster', 900)?.classId).toBe(338)

      // 3. Level-boundary pruneStaleUnitsOutsideArea when player teleports far ahead (5410, 5410) preserves merc 900
      world.pruneStaleUnitsOutsideArea(5410, 5410)
      expect(world.getUnit('monster', 900)?.classId).toBe(338)

      // 4. Subsequent 0x15 UnitReassign (merc leash teleport) moves merc to player and keeps classId = 338 (never 0 / skeleton1)
      world.apply({
        type: 'UnitReassign',
        unitType: 1,
        id: 900,
        at: { x: 5412, y: 5412 },
      })
      const mercAfterLeash = world.getUnit('monster', 900)
      expect(mercAfterLeash?.classId).toBe(338)
      expect(mercAfterLeash?.x).toBe(5412)
      expect(mercAfterLeash?.y).toBe(5412)
      expect(world.npcMotion.getUnit(900)?.dwClassId).toBe(338)
    })

    it('does not spawn a classId=0 skeleton unit on 0x9E..0xA2 Merc stat/exp after LoadAct and resolves known merc classId if 0x15/UnitMove arrives before 0xAC', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        charClass: 1,
        name: 'SorcHero',
        x: 5000,
        y: 5000,
      })
      world.apply({
        type: 'Merc',
        kind: 'assign',
        ownerId: 1,
        mercId: 950,
        classId: 271, // Act 1 Rogue Scout
        nameId: 2,
      })
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 950,
          classId: 271,
          x: 5004,
          y: 5004,
          lifePct: 128,
          mode: 1,
        },
      })

      // Act / area transition via 0x03 LoadAct clears world units
      world.pruneNonSelfUnitsOnAreaTransition()
      expect(world.getUnit('monster', 950)).toBeUndefined()

      // 0x9E..0xA2 Merc stat & exp arriving before 0xAC must NOT create a phantom (0, 0) classId=0 monster unit
      world.apply({ type: 'Merc', kind: 'stat', mercId: 950, stat: 12, value: 24 })
      world.apply({ type: 'Merc', kind: 'exp', mercId: 950, stat: 13, value: 50000 })
      expect(world.getUnit('monster', 950)).toBeUndefined()
      expect(world.merc?.stats.get(12)).toBe(24)
      expect(world.merc?.exp).toBe(50000)

      // Even if 0x15 UnitReassign arrives before 0xAC UnitAssign, ensureUnit resolves classId=271 and copies merc stats
      world.apply({
        type: 'UnitReassign',
        unitType: 1,
        id: 950,
        at: { x: 5200, y: 5200 },
      })
      const reassignedMerc = world.getUnit('monster', 950)
      expect(reassignedMerc?.classId).toBe(271)
      expect(reassignedMerc?.stats.get(12)).toBe(24)
      expect(reassignedMerc?.stats.get(13)).toBe(50000)
      expect(world.npcMotion.getUnit(950)?.dwClassId).toBe(271)
    })
  })

  describe('Issue #951: mercenary intermittently invisible / not rendered', () => {
    function hireMerc(world: ClientWorld, mercId: number, x: number, y: number): void {
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Hero', x, y })
      world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId, classId: 271, nameId: 2 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: mercId, classId: 271, x: x + 2, y: y + 2, lifePct: 128, mode: 1 },
      })
    }

    it('RC1: merc keeps following across >80 sub-tiles (synthetic 5x5 room neighborhood keeps expanding)', () => {
      const world = new ClientWorld()
      hireMerc(world, 950, 5000, 5000)
      // Walk the merc in 30-sub-tile hops far beyond the initial ±80 sub-tile synthetic neighborhood.
      let tx = 5002
      for (let hop = 0; hop < 8; hop++) {
        tx += 30
        world.apply({ type: 'UnitMove', unitType: 1, id: 950, mode: 'run', to: { x: tx, y: 5002 } })
        for (let i = 0; i < 200; i++) world.npcMotion.tick()
        const merc = world.getUnit('monster', 950)!
        expect(Math.round(merc.x)).toBe(tx)
        expect(Math.round(merc.y)).toBe(5002)
        expect(world.npcMotion.getUnit(950)?.pDynamicPath?.pRoom).not.toBeNull()
      }
    })

    it('RC2: UnitMove on a never-assigned own merc does not leave a (0, 0) phantom unit', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 1, name: 'Hero', x: 5000, y: 5000 })
      world.apply({ type: 'Merc', kind: 'assign', ownerId: 1, mercId: 950, classId: 271, nameId: 2 })
      // 0x67 NPCMove arrives before 0xAC for the merc after an area transition.
      world.apply({ type: 'UnitMove', unitType: 1, id: 950, mode: 'walk', to: { x: 5010, y: 5010 } })
      const merc = world.getUnit('monster', 950)!
      expect(merc.classId).toBe(271)
      expect(merc.x !== 0 || merc.y !== 0).toBe(true)
      expect(Math.hypot(merc.x - 5000, merc.y - 5000)).toBeLessThanOrEqual(20)
      const npc = world.npcMotion.getUnit(950)!
      expect(npc).toBeDefined()
      expect(world.monsters.has(950)).toBe(true)
    })

    it('RC3: 0xAC UnitAssign of a living merc after death clears _merc.isDead / pet.isDead', () => {
      const world = new ClientWorld()
      hireMerc(world, 950, 5000, 5000)
      world.apply({ type: 'UnitMode', unitType: 1, id: 950, mode: 0, lifePct: 0 })
      expect(world.merc?.isDead).toBe(true)
      // Revive at town NPC: server re-sends 0xAC with the merc alive.
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 950, classId: 271, x: 5003, y: 5003, lifePct: 128, mode: 1 },
      })
      expect(world.merc?.isDead).toBe(false)
      expect(world.pets.get(950)?.isDead).toBe(false)
      // Living own merc must again be protected from 0x0A UnitRemove (0x6FB5CA40 pet-list walk).
      world.apply({ type: 'UnitRemove', unitType: 1, id: 950 })
      expect(world.getUnit('monster', 950)?.classId).toBe(271)
    })

    it('RC4: same-area LoadAct (prevAreaId === areaId) keeps npcMotion in sync with _monsters', () => {
      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 1 })
      hireMerc(world, 950, 5000, 5000)
      expect(world.npcMotion.getUnit(950)).toBeDefined()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 1 })
      expect(world.monsters.has(950)).toBe(true)
      expect(world.npcMotion.getUnit(950)).toBeDefined()
      // A real area transition still prunes both.
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
      expect(world.getUnit('monster', 950)).toBeUndefined()
      expect(world.npcMotion.getUnit(950)).toBeUndefined()
    })
  })

  describe('Issue #970: Amazon Passive & Magic ClientWorld 1.13c Parity (#8/#17/#28)', () => {
    it('enforces fixed 20-subtile radius for #8 Inner Sight and #17 Slow Missiles regardless of slvl', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      // Monster at dist 19 (inside fixed 20-subtile radius, would have been missed at slvl 1 under old 13.3 + 1.33 = 14.63)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 1, x: 119, y: 100, lifePct: 128, mode: 1 },
      })
      // Monster at dist 25 (outside fixed 20-subtile radius, would have been falsely hit at slvl 20 under old 13.3 + 26.6 = 39.9)
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 102, classId: 1, x: 125, y: 100, lifePct: 128, mode: 1 },
      })

      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 8, 100, 100, 1) // slvl 1 Inner Sight
      expect(world.getUnit('monster', 101)?.states.has(17)).toBe(true)

      ;(world as any).spawnMissilesForSkill(caster, 8, 100, 100, 20) // slvl 20 Inner Sight
      expect(world.getUnit('monster', 102)?.states.has(17)).toBe(false)

      ;(world as any).spawnMissilesForSkill(caster, 17, 100, 100, 1) // slvl 1 Slow Missiles
      expect(world.getUnit('monster', 101)?.states.has(87)).toBe(true)
      expect(world.getUnit('monster', 102)?.states.has(87)).toBe(false)
    })

    it('scales monster-owned missile velocity by 0.33 when monster has state 87 (slowmissiles)', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 201, classId: 5, x: 100, y: 100, lifePct: 128, mode: 1 },
      })
      const normalArrow = world.spawnMissileByKey('arrow', 100, 100, 120, 100, {
        ownerType: 'monster',
        ownerId: 201,
      })
      const normalSpeed = Math.hypot(normalArrow.vx ?? 0, normalArrow.vy ?? 0)
      expect(normalSpeed).toBeGreaterThan(0)

      const mon = world.getUnit('monster', 201)!
      mon.states.add(87) // slowmissiles
      const slowedArrow = world.spawnMissileByKey('arrow', 100, 100, 120, 100, {
        ownerType: 'monster',
        ownerId: 201,
      })
      const slowedSpeed = Math.hypot(slowedArrow.vx ?? 0, slowedArrow.vy ?? 0)
      expect(slowedSpeed).toBeCloseTo(normalSpeed * 0.33, 5)
    })

    it('treats #28 Decoy (dopplezon classId 356) as friendly/non-hostile alongside #32 Valkyrie (classId 357)', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 301, classId: 356, x: 105, y: 100, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 302, classId: 357, x: 106, y: 100, lifePct: 128, mode: 1 },
      })
      const decoy = world.getUnit('monster', 301)!
      const valkyrie = world.getUnit('monster', 302)!
      expect((world as any).isFriendlyOrNonHostileMonster(decoy)).toBe(true)
      expect((world as any).isFriendlyOrNonHostileMonster(valkyrie)).toBe(true)
    })
  })

  describe('Issue #975: Amazon Javelin & Spear ClientWorld 1.13c Parity (#10/#14/#15/#19/#20/#24/#25/#30/#34/#35)', () => {
    it('#10 Jab, #19 Impale, #30 Fend spawn no client missiles; #14 Power Strike attaches lightning overlay without chargedstrikebolt', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
      })
      const caster = world.getUnit('player', 1)!
      for (const skillId of [10, 19, 30]) {
        ;(world as any).spawnMissilesForSkill(caster, skillId, 102, 100, 10)
      }
      expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile').length).toBe(0)

      ;(world as any).spawnMissilesForSkill(caster, 14, 102, 100, 10)
      expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile').length).toBe(0)
      const mon = world.getUnit('monster', 101)!
      expect(mon.overlays.some((o) => o.token === 'lightning')).toBe(true)
    })

    it('#24 Charged Strike spawns 3 + floor(slvl / 5) chargedstrikebolt missiles and attaches lightning overlay', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
      })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 24, 102, 100, 20)
      const bolts = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'chargedstrikebolt',
      )
      expect(bolts.length).toBe(7) // 3 + floor(20/5) = 7
      const mon = world.getUnit('monster', 101)!
      expect(mon.overlays.some((o) => o.token === 'lightning')).toBe(true)
    })

    it('#15 Poison Javelin pierces and leaves poisonjavcloud trail; #25 Plague Javelin leaves poisonjavcloud trail and bursts 16 plaguejavcloud on impact', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 15, 115, 100, 10)
      const pjav = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'poisonjav',
      )!
      expect(pjav).toBeDefined()
      expect(pjav.pierce).toBe(false)

      ;(world as any).spawnMissilesForSkill(caster, 25, 115, 100, 10)
      const plg = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'plaguejavelin',
      )!
      expect(plg).toBeDefined()
      expect(plg.explosionMissile).toBe('')
      ;(world as any).stepMissileUnit(plg)
      expect(
        Array.from(world.units.values()).some(
          (u) => u.unitType === 'missile' && (u.missileKey === 'poisonjavcloud' || u.missileKey === 'plaguejavcloud'),
        ),
      ).toBe(true)
      ;(world as any).triggerMissileImpact(plg, plg.x, plg.y, false)
      const burstClouds = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'plaguejavcloud',
      )
      expect(burstClouds.length).toBe(24)
    })

    it('#20 Lightning Bolt, #34 Lightning Strike (20-subtile, 1+slvl hits), and #35 Lightning Fury (15-subtile, 1+slvl furylightning) match 1.13c', () => {
      const world = new ClientWorld()
      world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 101, classId: 1, x: 105, y: 100, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 102, classId: 1, x: 112, y: 100, lifePct: 128, mode: 1 },
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 103, classId: 1, x: 123, y: 100, lifePct: 128, mode: 1 },
      })
      const caster = world.getUnit('player', 1)!
      ;(world as any).spawnMissilesForSkill(caster, 35, 105, 100, 5)
      const lf = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'lightningfury',
      )!
      const hitMon = world.getUnit('monster', 101)!
      ;(world as any).triggerMissileImpact(lf, 105, 100, false, hitMon)
      // Monster 102 is at dist 7 (<= 15), monster 103 is at dist 18 (> 15) -> 1 furylightning bolt spawned
      const furyBolts = Array.from(world.units.values()).filter(
        (u) => u.unitType === 'missile' && u.missileKey === 'furylightning',
      )
      expect(furyBolts.length).toBe(1)
      expect(furyBolts[0]!.pierce).toBe(true)

      // #34 Lightning Strike at slvl 1: maxHits = 2, searchRadius = 20 (reaches monster 103 at dist 18 from 105)
      ;(world as any).spawnMissilesForSkill(caster, 34, 105, 100, 1)
      const ls = Array.from(world.units.values()).find(
        (u) => u.unitType === 'missile' && u.missileKey === 'lightningstrike',
      )!
      ls.hitUnitIds = new Set([101, 102])
      ;(world as any).triggerMissileImpact(ls, 112, 100, false, world.getUnit('monster', 102)!)
      expect(ls.pierce).toBe(false) // reached maxHits = 1 + 1 = 2
    })

    it('poison clamping at 1/256 HP (raw STAT_HITPOINTS=1..255, LifeMana life=0) never triggers false death on town return or new room entry (D2Client.dll 0x6fb55440 / 0x6fb5ebe0 / 0x6fb5eb10)', () => {
      const world = new ClientWorld()
      // 1. Poisoned player returns to Kurast Docks (areaId = 75) via Town Portal
      world.apply({ type: 'LoadAct', act: 2, mapSeed: 0x11223344, areaId: 75 })
      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorceress', x: 5128, y: 5052, mode: 5 },
      })
      world.apply({ type: 'StatSet', stat: 7, value: 420 << 8 })
      world.apply({ type: 'StatSet', stat: 6, value: 1 }) // 1/256 HP (poison clamp)
      world.apply({ type: 'LifeMana', life: 0, mana: 120, stamina: 100, at: { x: 5128, y: 5052 } })

      const selfUnit = world.getUnit('player', 1)!
      expect(world.isDead).toBe(false)
      expect(world.isSelfDead).toBe(false)
      expect(world.self.isDead).toBe(false)
      expect(world.self.life).toBe(0)
      expect(world.self.stats.get(6)).toBe(1)
      expect(selfUnit.dead).toBe(false)
      expect(selfUnit.mode).toBe(5)

      // 2. Player saves & exits and creates a new room where STAT_HITPOINTS (1..255) arrives before STAT_MAXHP
      const newRoomWorld = new ClientWorld()
      newRoomWorld.apply({ type: 'LoadAct', act: 2, mapSeed: 0x55667788, areaId: 75 })
      newRoomWorld.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorceress', x: 5128, y: 5052, mode: 5 },
      })
      newRoomWorld.apply({ type: 'StatSet', stat: 6, value: 1 })
      newRoomWorld.apply({ type: 'StatSet', stat: 7, value: 420 << 8 })
      newRoomWorld.apply({ type: 'LifeMana', life: 0, mana: 120, stamina: 100, at: { x: 5128, y: 5052 } })

      const newRoomSelf = newRoomWorld.getUnit('player', 1)!
      expect(newRoomWorld.isDead).toBe(false)
      expect(newRoomWorld.isSelfDead).toBe(false)
      expect(newRoomWorld.self.isDead).toBe(false)
      expect(newRoomSelf.dead).toBe(false)
      expect(newRoomSelf.mode).toBe(5)
    })
  })
})

