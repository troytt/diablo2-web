import { describe, expect, it, vi } from 'vitest'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'
import { CANONICAL_ENG_TBL_DICT, CANONICAL_CHI_TBL_DICT } from '../../src/common/data/canonical-tbl-strings.ts'
import { WorldPanelsHud, PARTY_SCREEN_LAYOUT } from '../../src/client/ui/world-panels.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { ByteWriter } from '../../src/netproto/core/byte-writer.ts'
import { decodeD2gsServerPacket, type ClientCommand } from '../../src/netproto/index.ts'

function createMockCtx() {
  const drawImageCalls: any[][] = []
  const fillRectCalls: any[][] = []
  const strokeRectCalls: any[][] = []
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn((...args: any[]) => fillRectCalls.push(args)),
    strokeRect: vi.fn((...args: any[]) => strokeRectCalls.push(args)),
    drawImage: vi.fn((...args: any[]) => drawImageCalls.push(args)),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
  return { ctx, drawImageCalls, fillRectCalls, strokeRectCalls }
}

function createMockFont() {
  const texts: Array<{ text: string; x: number; y: number; opts?: any }> = []
  const font = {
    loaded: true,
    drawText: vi.fn((_ctx: any, text: string, x: number, y: number, opts?: any) => {
      texts.push({ text, x, y, opts })
    }),
    measureText: vi.fn((text: string) => text.length * 7),
  }
  return { font: font as any, texts }
}

describe('Issue #909: 1.13c Party Screen, PvP/Hostile Lock, and Auto-Party', () => {
  it('R1: bakes party-bg.png, partybuttons.png, partyboxes.png, and partybar.png in BAKED_UI_MANIFEST with canonical .tbl keys', () => {
    const images = BAKED_UI_MANIFEST.images as Record<string, string>
    expect(images.partyBg).toBe('/ui/party-bg.png')
    expect(images.partyButtons).toBe('/ui/partybuttons.png')
    expect(images.partyBoxes).toBe('/ui/partyboxes.png')
    expect(images.partyBar).toBe('/ui/partybar.png')

    expect(CANONICAL_ENG_TBL_DICT.Leave).toBe('LEAVE')
    expect(CANONICAL_ENG_TBL_DICT.Invite).toBe('INVITE')
    expect(CANONICAL_ENG_TBL_DICT.strParty24).toBe('Remove yourself from party.')
    expect(CANONICAL_ENG_TBL_DICT.strParty1).toBe('Invite this player ')
    expect(CANONICAL_ENG_TBL_DICT.strParty2).toBe('to join your party.')
    expect(CANONICAL_ENG_TBL_DICT.partycharpal).toBe('Paladin')
    expect(CANONICAL_CHI_TBL_DICT.partycharpal).toBe('聖騎士')
  })

  it('R2: renders 1.13c Party Screen header, Leave Party button, grouped rows, partybar separator, and tooltips', () => {
    const wp = new WorldPanelsHud()
    wp.setLanguage('ENG')
    wp.activePanel = 'party'
    wp.localPlayerId = 1
    wp.localPlayerName = 'MyHero'
    wp.localPlayerClass = 'sor'
    wp.localPlayerLevel = 42
    wp.localPartyId = 1

    wp.partyMembers = [
      {
        unitId: 2,
        name: 'AlliedPaladin',
        charClass: 3,
        level: 45,
        partyId: 1,
        partyState: 'in_party',
        areaId: 1,
        lifePct: 85,
        hostile: false,
        lootAllowed: true,
        squelched: false,
        muted: false,
      },
      {
        unitId: 3,
        name: 'SoloBarb',
        charClass: 4,
        level: 30,
        partyId: 0xffff,
        partyState: 'none',
        areaId: 2,
        lifePct: 100,
        hostile: false,
      },
    ]

    const { ctx, drawImageCalls } = createMockCtx()
    const { font, texts } = createMockFont()

    const fakePartyBg = { width: 320, height: 432 } as HTMLImageElement
    const fakePartyButtons = { width: 106, height: 20 } as HTMLImageElement
    const fakePartyBoxes = { width: 342, height: 19 } as HTMLImageElement
    const fakePartyBar = { width: 301, height: 4 } as HTMLImageElement
    const fakeBuySellBtn = { width: 480, height: 32 } as HTMLImageElement

    wp.drawLeftDockPanel(
      ctx,
      'party',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        vendorTabsImg: null,
        buySellBtnImg: fakeBuySellBtn,
        miniConvertImg: null,
        questsAtlasImg: null,
        itemsAtlasImg: null,
        partyBgImg: fakePartyBg,
        partyButtonsImg: fakePartyButtons,
        partyBoxesImg: fakePartyBoxes,
        partyBarImg: fakePartyBar,
      },
      font,
    )

    // Background 320x432 drawn at (80, 60)
    expect(drawImageCalls.some((c) => c[0] === fakePartyBg && c[1] === 80 && c[2] === 60)).toBe(true)
    // Top Leave Party button (53x20) drawn at (80 + 227, 60 + 15) = (307, 75)
    expect(
      drawImageCalls.some((c) => c[0] === fakePartyButtons && c[5] === 80 + 227 && c[6] === 60 + 15),
    ).toBe(true)
    // Group separator bar (partyBar) drawn between allied party row 0 and unpartied row 1 at (80 + 12, 60 + 67 + 38 - 4) = (92, 161)
    expect(
      drawImageCalls.some(
        (c) =>
          c[0] === fakePartyBar &&
          c[5] === 80 + PARTY_SCREEN_LAYOUT.row.separatorLeftRelX &&
          c[6] ===
            60 +
              PARTY_SCREEN_LAYOUT.row.separatorBaseRelY +
              1 * PARTY_SCREEN_LAYOUT.row.strideY -
              PARTY_SCREEN_LAYOUT.row.separatorH,
      ),
    ).toBe(true)

    // Local player header text
    expect(texts.some((t) => t.text === 'MyHero' && t.x === 80 + 105 && t.y === 60 + 29)).toBe(true)
    expect(texts.some((t) => t.text.includes('Sorceress') && t.text.includes('42'))).toBe(true)
    expect(texts.some((t) => t.text === 'LEAVE')).toBe(true)

    // Hover over Loot button at row 0 -> shows loot permission tooltip
    const ox = 80
    const oy = 60
    const row0Y = oy + PARTY_SCREEN_LAYOUT.row.firstRelY
    wp.handleMouseMove(ox + PARTY_SCREEN_LAYOUT.row.lootRelX + 5, row0Y - 5)
    expect(wp.hoveredPartyControl?.kind).toBe('loot')

    texts.length = 0
    wp.drawLeftDockPanel(
      ctx,
      'party',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        vendorTabsImg: null,
        buySellBtnImg: fakeBuySellBtn,
        miniConvertImg: null,
        questsAtlasImg: null,
        itemsAtlasImg: null,
        partyBgImg: fakePartyBg,
        partyButtonsImg: fakePartyButtons,
        partyBoxesImg: fakePartyBoxes,
        partyBarImg: fakePartyBar,
      },
      font,
    )
    expect(texts.some((t) => t.text.includes('AlliedPaladin'))).toBe(true)
  })

  it('R2 & R3: handles Party Screen button clicks and strictly blocks Hostile toggle', () => {
    const wp = new WorldPanelsHud()
    wp.activePanel = 'party'
    wp.localPlayerId = 1
    wp.localPartyId = 1
    wp.partyMembers = [
      {
        unitId: 2,
        name: 'AlliedPaladin',
        charClass: 3,
        level: 45,
        partyId: 1,
        partyState: 'in_party',
        hostile: false,
        lootAllowed: false,
        squelched: false,
        muted: false,
      },
      {
        unitId: 3,
        name: 'InvitedDruid',
        charClass: 5,
        level: 20,
        partyId: 0xffff,
        partyState: 'invited_me',
        hostile: false,
      },
    ]

    const partyActions: Array<{ action: number; targetId: number }> = []
    const hostileCalls: Array<{ targetId: number; hostile: boolean; button: number }> = []
    const callbacks = {
      onPartyAction: (action: number, targetId: number) => partyActions.push({ action, targetId }),
      onSetHostile: (targetId: number, hostile: boolean, button = 1) =>
        hostileCalls.push({ targetId, hostile, button }),
    }

    const ox = 80
    const oy = 60
    const row0Y = oy + PARTY_SCREEN_LAYOUT.row.firstRelY
    const row1Y = oy + PARTY_SCREEN_LAYOUT.row.firstRelY + PARTY_SCREEN_LAYOUT.row.strideY

    // 1. Clicking Hostile icon at row 0 is consumed as a no-op (PvP disabled)
    wp.handleLeftDockClick(
      'party',
      ox + PARTY_SCREEN_LAYOUT.row.hostileRelX + 5,
      row0Y - 5,
      callbacks,
    )
    expect(hostileCalls).toEqual([])
    expect(partyActions).toEqual([])
    expect(wp.partyMembers[0]?.hostile).toBe(false)

    // 2. Clicking Loot icon at row 0 emits SetHostile with button=2
    wp.handleLeftDockClick(
      'party',
      ox + PARTY_SCREEN_LAYOUT.row.lootRelX + 5,
      row0Y - 5,
      callbacks,
    )
    expect(hostileCalls).toEqual([{ targetId: 2, hostile: true, button: 2 }])
    expect(wp.partyMembers[0]?.lootAllowed).toBe(true)

    // 3. Clicking Main Party Button at row 1 (invited_me) emits Accept (0x08)
    wp.handleLeftDockClick(
      'party',
      ox + PARTY_SCREEN_LAYOUT.row.partyBtnRelX + 10,
      row1Y - 5,
      callbacks,
    )
    expect(partyActions).toEqual([{ action: 0x08, targetId: 3 }])

    // 4. Clicking Top "Leave Party" button emits Leave (0x09) for localPlayerId
    partyActions.length = 0
    wp.handleLeftDockClick(
      'party',
      ox + PARTY_SCREEN_LAYOUT.leaveBtn.relX + 10,
      oy + PARTY_SCREEN_LAYOUT.leaveBtn.relY + 5,
      callbacks,
    )
    expect(partyActions).toEqual([{ action: 0x09, targetId: 1 }])
  })

  it('R3: blocks PvP attacking living players outside town in CommandMapper', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'LoadAct',
      act: 0,
      mapSeed: 123,
      areaId: 2, // Blood Moor (outside town)
      objectSeed: 456,
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1,
        name: 'SelfSor',
        x: 100,
        y: 100,
      },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 0,
        id: 2,
        classId: 3,
        name: 'OtherPal',
        x: 105,
        y: 105,
      },
    })

    const otherPlayer = world.getUnit('player', 2)!
    expect(otherPlayer).toBeDefined()

    const mapper = new CommandMapper({ world })
    expect(mapper.isPlayerHostile(otherPlayer, world)).toBe(false)
    expect(mapper.isValidSkillTargetUnit(otherPlayer, 0, world)).toBe(false)
    expect(mapper.isValidSkillTargetUnit(otherPlayer, 36 /* Fire Ball */, world)).toBe(false)

    // Left click on another living player outside town moves instead of attacking
    const leftCmd = mapper.fromMouseDown(
      {
        button: 'left',
        worldX: 105,
        worldY: 105,
        hoveredUnit: otherPlayer,
      },
      world,
    )
    expect(leftCmd).toEqual({
      type: 'Move',
      run: true,
      to: { x: 105, y: 105 },
    })

    // Right click offensive skill on another living player outside town casts at ground coords instead of SkillOn unit
    world.apply({
      type: 'SkillAssign',
      unitType: 0,
      unitId: 1,
      hand: 'right',
      skillId: 36, // Fire Ball
      itemId: 0xffffffff,
    })
    const rightCmd = mapper.fromMouseDown(
      {
        button: 'right',
        worldX: 105,
        worldY: 105,
        hoveredUnit: otherPlayer,
      },
      world,
    )
    expect(rightCmd).toEqual({
      type: 'SkillAt',
      hand: 'right',
      at: { x: 105, y: 105 },
      hold: false,
    })
  })

  it('R4: defaults room players to auto-party and auto-accepts/invites via HudModel', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1,
        name: 'SelfSor',
        x: 100,
        y: 100,
      },
    })

    const emitted: ClientCommand[] = []
    const hud = new HudManager()
    const model = new HudModel({
      world,
      hudManager: hud,
      onCommand: (cmd) => emitted.push(cmd),
    })

    // 1. Unspecified partyId/partyState on Party roster event defaults to partyId=1, partyState=1 (in_party), hostile=false
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charName: 'RoomPaladin',
      charClass: 3,
      charLevel: 25,
      areaId: 1,
    })
    expect(world.party.get(2)?.partyId).toBe(1)
    expect(world.party.get(2)?.partyState).toBe(1)
    expect(world.party.get(2)?.hostile).toBe(false)

    // 2. Even if server sends hostile relation bit (0x08), ClientWorld forces hostile=false
    world.apply({
      type: 'Party',
      kind: 'relation',
      unitId: 2,
      otherId: 1,
      relation: 0x08,
    })
    expect(world.party.get(2)?.hostile).toBe(false)

    // 3. Incoming invite (relation=2<<16) automatically emits PartyAction(0x08, 3) (Accept)
    emitted.length = 0
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 3,
      charName: 'InviterAma',
      charClass: 0,
      charLevel: 18,
      partyId: 2,
      relation: 2 << 16,
    })
    expect(emitted).toContainEqual({
      type: 'PartyAction',
      action: 0x08,
      targetPlayerId: 3,
    })

    // 4. Unpartied player joining room (partyId=0xffff) automatically emits PartyAction(0x06, 4) (Invite)
    emitted.length = 0
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 4,
      charName: 'UnpartiedBarb',
      charClass: 4,
      charLevel: 30,
      partyId: 0xffff,
    })
    expect(emitted).toContainEqual({
      type: 'PartyAction',
      action: 0x06,
      targetPlayerId: 4,
    })

    // 5. setHostile with button=1 (hostility) is blocked; button=2 (loot) is allowed
    emitted.length = 0
    model.setHostile(2, true, 1)
    expect(emitted).toEqual([])

    model.setHostile(2, true, 2)
    expect(emitted).toEqual([
      {
        type: 'Hostile',
        targetPlayerId: 2,
        hostile: true,
        button: 2,
      },
    ])
  })

  it('Issue #965: preserves 0x5B roster metadata across 0x65/0x8D(0xffff) and renders Level 80 Sorceress in local party with area & life bar', () => {
    const world = new ClientWorld()
    world.apply({
      type: 'LoadAct',
      act: 0,
      mapSeed: 123,
      areaId: 1, // Rogue Encampment (羅格營地)
      objectSeed: 456,
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 0,
        id: 2,
        classId: 3, // Paladin (聖騎士)
        name: 'test',
        x: 5100,
        y: 5100,
      },
    })
    world.apply({
      type: 'StatSet',
      stat: 12, // STAT_LEVEL
      value: 80,
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 0,
        id: 1,
        classId: 1, // Sorceress (法師)
        name: 'SorcMaster',
        x: 5105,
        y: 5105,
      },
    })

    const hud = new HudManager()
    hud.worldPanels.setLanguage('CHI')
    const model = new HudModel({
      world,
      hudManager: hud,
    })

    const build0x5B = (unitId: number, charClass: number, charName: string, charLevel: number, partyId: number) => {
      const w = new ByteWriter(36)
      w.u8(0x5b)
      w.u16LE(36)
      w.u32LE(unitId)
      w.u8(charClass)
      w.fixedCString(charName, 16)
      w.u16LE(charLevel)
      w.u16LE(partyId)
      w.bytes(new Uint8Array(8))
      return decodeD2gsServerPacket(w.toUint8Array())
    }
    const build0x65 = (unitId: number, count: number) => {
      const w = new ByteWriter(7)
      w.u8(0x65)
      w.u32LE(unitId)
      w.u16LE(count)
      return decodeD2gsServerPacket(w.toUint8Array())
    }
    const build0x8D = (unitId: number, partyId: number) => {
      const w = new ByteWriter(7)
      w.u8(0x8d)
      w.u32LE(unitId)
      w.u16LE(partyId)
      return decodeD2gsServerPacket(w.toUint8Array())
    }
    const build0x8B = (unitId: number, relation: number) => {
      const w = new ByteWriter(6)
      w.u8(0x8b)
      w.u32LE(unitId)
      w.u8(relation)
      return decodeD2gsServerPacket(w.toUint8Array())
    }
    const build0x7F = (isPlayer: number, lifePct: number, unitId: number, areaId: number) => {
      const w = new ByteWriter(10)
      w.u8(0x7f)
      w.u8(isPlayer)
      w.u16LE(lifePct)
      w.u32LE(unitId)
      w.u16LE(areaId)
      return decodeD2gsServerPacket(w.toUint8Array())
    }
    const build0x5C = (unitId: number) => {
      const w = new ByteWriter(5)
      w.u8(0x5c)
      w.u32LE(unitId)
      return decodeD2gsServerPacket(w.toUint8Array())
    }

    // 1. Initial D2GS 1.13c join burst: 0x5B -> 0x65 -> 0x8D(0xffff) -> 0x8B(0) for both players
    world.apply(build0x5B(2, 3, 'test', 80, 0xffff))
    world.apply(build0x65(2, 0))
    world.apply(build0x8D(2, 0xffff))
    world.apply(build0x8B(2, 0))

    world.apply(build0x5B(1, 1, 'SorcMaster', 80, 0xffff))
    world.apply(build0x65(1, 0))
    world.apply(build0x8D(1, 0xffff))
    world.apply(build0x8B(1, 0))

    // Neither player was deleted by 0x8D(0xffff), and SorcMaster retains class=1 (Sorceress) and level=80
    expect(world.party.get(2)?.charName).toBe('test')
    expect(world.party.get(1)?.charName).toBe('SorcMaster')
    expect(world.party.get(1)?.charClass).toBe(1)
    expect(world.party.get(1)?.charLevel).toBe(80)

    // 2. Party formed (partyId = 1): 0x8D(partyId=1) + 0x8B(relation=1)
    world.apply(build0x8D(2, 1))
    world.apply(build0x8D(1, 1))
    world.apply(build0x8B(1, 1))
    model.syncFromWorld()

    expect(hud.worldPanels.localPartyId).toBe(1)
    expect(hud.worldPanels.partyMembers).toHaveLength(1)
    const member = hud.worldPanels.partyMembers[0]!
    expect(member.name).toBe('SorcMaster')
    expect(member.charClass).toBe(1)
    expect(member.level).toBe(80)
    expect(member.partyId).toBe(1)
    expect(member.partyState).toBe('in_party')
    expect(member.relationship).toBe('in_party')
    // Area resolved immediately from active player unit in world (areaId = 1 Rogue Encampment)
    expect(member.areaId).toBe(1)
    expect(hud.worldPanels.isMemberInLocalParty(member)).toBe(true)

    // 3. Render Party Screen in CHI and verify all labels, area location, and life bar
    const { ctx, fillRectCalls } = createMockCtx()
    const { font, texts } = createMockFont()
    const fakePartyBg = { width: 320, height: 432 } as HTMLImageElement
    const fakePartyButtons = { width: 106, height: 20 } as HTMLImageElement
    const fakePartyBoxes = { width: 342, height: 19 } as HTMLImageElement
    const fakePartyBar = { width: 301, height: 4 } as HTMLImageElement
    const fakeBuySellBtn = { width: 480, height: 32 } as HTMLImageElement

    hud.worldPanels.drawLeftDockPanel(
      ctx,
      'party',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        vendorTabsImg: null,
        buySellBtnImg: fakeBuySellBtn,
        miniConvertImg: null,
        questsAtlasImg: null,
        itemsAtlasImg: null,
        partyBgImg: fakePartyBg,
        partyButtonsImg: fakePartyButtons,
        partyBoxesImg: fakePartyBoxes,
        partyBarImg: fakePartyBar,
      },
      font,
    )

    // Local player header & Leave Party button
    expect(texts.some((t) => t.text === 'test')).toBe(true)
    expect(texts.some((t) => t.text === '離開')).toBe(true)
    // Teammate row: real name in green (never "Player #1"), 法師 (never 亞馬遜), Lvl 80 (never Lvl 1)
    expect(texts.some((t) => t.text === 'SorcMaster' && t.opts?.color === 'green')).toBe(true)
    expect(texts.some((t) => t.text.includes('Player #1'))).toBe(false)
    expect(texts.some((t) => t.text === '法師')).toBe(true)
    expect(texts.some((t) => t.text === '亞馬遜')).toBe(false)
    expect(texts.some((t) => t.text.includes('80'))).toBe(true)
    // Same-party button text: 在你的隊伍 (Yourparty), NEVER 在一個隊伍 (Inparty)
    expect(texts.some((t) => t.text === '在你的隊伍')).toBe(true)
    expect(texts.some((t) => t.text === '在一個隊伍')).toBe(false)
    // Area name (蘿格營地) and life bar (46x4 at barX = 80 + 139, barY = 60 + 90 - 10)
    expect(texts.some((t) => t.text === '蘿格營地')).toBe(true)
    expect(
      fillRectCalls.some(
        (c) =>
          c[0] === 80 + PARTY_SCREEN_LAYOUT.row.lifeBarRelX &&
          c[1] === 60 + PARTY_SCREEN_LAYOUT.row.firstRelY + PARTY_SCREEN_LAYOUT.row.lifeBarOffsetY &&
          c[2] === PARTY_SCREEN_LAYOUT.row.lifeBarW &&
          c[3] === PARTY_SCREEN_LAYOUT.row.lifeBarH,
      ),
    ).toBe(true)

    // 4. 0x7F PartyMemberState updates areaId (e.g. areaId = 3 Cold Plains / 冰冷之原) and lifePct (80%)
    world.apply(build0x7F(1, 80, 1, 3))
    model.syncFromWorld()
    expect(hud.worldPanels.partyMembers[0]?.areaId).toBe(3)
    expect(hud.worldPanels.partyMembers[0]?.lifePct).toBe(80)

    texts.length = 0
    hud.worldPanels.drawLeftDockPanel(
      ctx,
      'party',
      {
        borderLeftImg: null,
        questBgImg: null,
        waypointBgImg: null,
        stashBgImg: null,
        cubeBgImg: null,
        vendorBgImg: null,
        vendorTabsImg: null,
        buySellBtnImg: fakeBuySellBtn,
        miniConvertImg: null,
        questsAtlasImg: null,
        itemsAtlasImg: null,
        partyBgImg: fakePartyBg,
        partyButtonsImg: fakePartyButtons,
        partyBoxesImg: fakePartyBoxes,
        partyBarImg: fakePartyBar,
      },
      font,
    )
    expect(texts.some((t) => t.text === '冰冷之原')).toBe(true)

    // 5. Genuine 0x5C PlayerLeftGame removes the teammate from the party roster
    world.apply(build0x5C(1))
    model.syncFromWorld()
    expect(world.party.has(1)).toBe(false)
    expect(hud.worldPanels.partyMembers).toHaveLength(0)
  })
})
