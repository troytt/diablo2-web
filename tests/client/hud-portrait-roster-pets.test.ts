import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { decode0x7ASummonAction } from '../../src/netproto/d2gs/s2c/merc.ts'
import { decode0x7FPartyMemberState } from '../../src/netproto/d2gs/s2c/party.ts'
import {
  CANONICAL_PORTRAIT_DC6_NAMES,
  resolveMercPortraitIcon,
  resolvePlayerClassPortraitIcon,
  resolvePetPortraitInfo,
} from '../../src/common/units/pet-type-table.ts'
import { BAKED_UI_MANIFEST } from '../../src/common/items/baked-ui-meta.ts'

function createMockContext() {
  const drawnTexts: Array<{ text: string; x: number; y: number }> = []
  const drawnRects: Array<{ x: number; y: number; w: number; h: number }> = []
  const drawnImages: Array<{ sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }> = []

  const ctx = {
    canvas: { width: 800, height: 600 },
    save: () => {},
    restore: () => {},
    scale: () => {},
    translate: () => {},
    clearRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => {
      drawnRects.push({ x, y, w, h })
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      drawnRects.push({ x, y, w, h })
    },
    fillText: (text: string, x: number, y: number) => {
      drawnTexts.push({ text: String(text), x, y })
    },
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    drawImage: (_img: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
      drawnImages.push({ sx, sy, sw, sh, dx, dy, dw, dh })
    },
    imageSmoothingEnabled: false,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    textBaseline: 'alphabetic',
    drawnTexts,
    drawnRects,
    drawnImages,
  } as unknown as CanvasRenderingContext2D & {
    drawnTexts: Array<{ text: string; x: number; y: number }>
    drawnRects: Array<{ x: number; y: number; w: number; h: number }>
    drawnImages: Array<{ sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }>
  }
  return ctx
}

describe('Top-Left HUD Portraits & 1.13c RosterPets Parity (Hireables.cpp)', () => {
  it('P1: BAKED_UI_MANIFEST bundles all 29 authentic 1.13c DC6 portrait frames with valid non-zero dimensions', () => {
    expect(BAKED_UI_MANIFEST.portraitRects).toBeDefined()
    const rects = BAKED_UI_MANIFEST.portraitRects!

    for (const name of CANONICAL_PORTRAIT_DC6_NAMES) {
      const rect = rects[name] ?? rects[name.toLowerCase()]
      expect(rect, `Expected portrait rect for ${name}`).toBeDefined()
      expect(rect.w).toBeGreaterThanOrEqual(44)
      expect(rect.h).toBeGreaterThanOrEqual(40)
    }
  })

  it('P2: solo unpartied player never renders a phantom "Player #1" portrait or box in top-left HUD', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    // Player joins solo: 0x5B PlayerInGame sends selfId with partyId 0xffff
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 1,
      playerId: 1,
      charClass: 0,
      charLevel: 20,
      partyId: 0xffff,
      charName: 'AmazonHero',
    })
    // 0x8B PlayerPartyRelation sends state 0 (unpartied)
    world.apply({
      type: 'Party',
      kind: 'relation',
      unitId: 1,
      relation: 0,
    })
    model.syncFromWorld()

    expect(hud.partyMembers).toHaveLength(0)

    hud.render()
    expect(mockCtx.drawnTexts.some((t) => t.text.includes('Player #1'))).toBe(false)
    expect(mockCtx.drawnTexts.some((t) => t.text.includes('AmazonHero'))).toBe(false)
    expect(mockCtx.drawnRects.filter((r) => r.y <= 64)).toHaveLength(0)
  })

  it('P3: 0x7F PartyMemberState with isPlayer === 0 updates pet/hireling life without creating phantom party member', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    // Assign hireling
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 88,
      classId: 338, // Act 2 Desert Mercenary
    })
    expect(world.merc).not.toBeNull()

    // 0x7F packet: [0x7f, isPlayer=0, lifePct=96 (u16), unitId=88 (u32), areaId=1 (u16)]
    const pkt7f = new Uint8Array([0x7f, 0, 96, 0, 88, 0, 0, 0, 1, 0])
    const ev7f = decode0x7FPartyMemberState(pkt7f)
    expect(ev7f.type).toBe('Party')
    expect((ev7f as any).isPlayer).toBe(false)

    world.apply(ev7f)
    expect(world.merc!.lifePct).toBe(96)
    expect(world.party.has(88)).toBe(false)

    model.syncFromWorld()
    expect(hud.partyMembers).toHaveLength(0)
    expect((hud as any).merc.lifePct).toBe(96)
  })

  it('P4: renders authentic mercenary portrait (act2hireableicon) without duplicate overlapping fillText', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 99,
      classId: 338, // Desert Mercenary
      nameId: 14,
    })
    model.syncFromWorld()

    expect((hud as any).merc.iconKey).toBe('act2hireableicon')

    hud.render()
    // The portrait frame and health bar are drawn
    expect(mockCtx.drawnRects.some((r) => r.x <= 24 && r.y <= 24 && r.w >= 32)).toBe(true)

    // In headless unit tests where DC6 font atlases are unloaded, D2FontRenderer.drawText
    // falls back to ctx.fillText with 3 drop shadow passes + 1 foreground pass (4 passes).
    // The previous buggy code called an extra manual ctx.fillText beforehand (5 passes with stacked browser text).
    const mercLabel = String((hud as any).merc.name || 'Merc')
    expect(mercLabel.length).toBeGreaterThan(0)
    const mercTexts = mockCtx.drawnTexts.filter((t) => t.text === mercLabel)
    expect(mercTexts).toHaveLength(4)
  })

  it('P5: 0x7A SummonAction maintains active pets in world.pets without clobbering world.merc', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    // Player has an active mercenary
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 55,
      classId: 271, // Rogue
      nameId: 3,
    })
    expect(world.merc).not.toBeNull()

    // 0x7A SummonAction: [0x7a, action=1, petType=4 (skeleton), classId=363 (necroskeleton), ownerId=1, mercId=101]
    const pkt7a = new Uint8Array([0x7a, 1, 4, 0x6b, 0x01, 1, 0, 0, 0, 101, 0, 0, 0])
    const ev7a = decode0x7ASummonAction(pkt7a)
    expect((ev7a as any).isSummonAction).toBe(true)
    expect((ev7a as any).petType).toBe(4)

    world.apply(ev7a)
    // Mercenary remains completely intact!
    expect(world.merc).not.toBeNull()
    expect(world.merc!.mercId).toBe(55)

    // Pet is tracked in world.pets
    expect(world.pets.has(101)).toBe(true)
    const pet = world.pets.get(101)!
    expect(pet.petType).toBe(4)
    expect(pet.classId).toBe(363)
    expect(pet.ownerId).toBe(1)

    // Add 2 more skeletons
    world.apply(decode0x7ASummonAction(new Uint8Array([0x7a, 1, 4, 0x6b, 0x01, 1, 0, 0, 0, 102, 0, 0, 0])))
    world.apply(decode0x7ASummonAction(new Uint8Array([0x7a, 1, 4, 0x6b, 0x01, 1, 0, 0, 0, 103, 0, 0, 0])))
    expect(world.pets.size).toBe(4) // 3 skeletons + 1 merc mirrored

    model.syncFromWorld()
    const summons = (hud as any).summonPortraits
    expect(summons).toHaveLength(1)
    expect(summons[0].iconKey).toBe('skeletonicon')
    expect(summons[0].count).toBe(3)
    expect(summons[0].iconType).toBe(2)

    // Render frame and verify count badge "3" is drawn in top-left
    hud.render()
    expect(mockCtx.drawnTexts.some((t) => t.text === '3')).toBe(true)

    // Unsummon skeleton 102 (action=0)
    world.apply(decode0x7ASummonAction(new Uint8Array([0x7a, 0, 4, 0x6b, 0x01, 1, 0, 0, 0, 102, 0, 0, 0])))
    expect(world.pets.has(102)).toBe(false)
    model.syncFromWorld()
    expect((hud as any).summonPortraits[0].count).toBe(2)
  })

  it('P6: icontype=3 sub-type summons (Golems, Spirits, Vines) resolve exact sub-icon via classId', () => {
    const clay = resolvePetPortraitInfo(3, 289)
    expect(clay?.iconKey).toBe('earthgolumicon')

    const blood = resolvePetPortraitInfo(3, 290)
    expect(blood?.iconKey).toBe('bloodgolumicon')

    const iron = resolvePetPortraitInfo(3, 291)
    expect(iron?.iconKey).toBe('metalgolumicon')

    const fire = resolvePetPortraitInfo(3, 292)
    expect(fire?.iconKey).toBe('firegolumicon')

    const oak = resolvePetPortraitInfo(13, 424)
    expect(oak?.iconKey).toBe('oaksage')

    const wolverine = resolvePetPortraitInfo(13, 423)
    expect(wolverine?.iconKey).toBe('heartofwolverine')

    const poison = resolvePetPortraitInfo(14, 425)
    expect(poison?.iconKey).toBe('plaguepoppy')
  })

  it('P7: allied party members render their authentic class portraits on the top-left HUD', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    // Local player
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 1,
      charClass: 0, // Amazon
      charName: 'SelfAmazon',
      partyId: 1,
    })
    // Allied Paladin in same party
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charClass: 3, // Paladin
      charName: 'PaladinBro',
      partyId: 1,
      lifePct: 90,
    })
    world.apply({
      type: 'Party',
      kind: 'relation',
      unitId: 2,
      relation: 1, // in party
    })
    // Unpartied Sorceress in different party / unpartied
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 3,
      charClass: 1, // Sorceress
      charName: 'SoloSorc',
      partyId: 0xffff,
    })
    world.apply({
      type: 'Party',
      kind: 'relation',
      unitId: 3,
      relation: 0, // none
    })

    model.syncFromWorld()
    // Party list in hud model excludes selfId
    expect(hud.partyMembers).toHaveLength(2)
    const paladinEntry = hud.partyMembers.find((m) => m.unitId === 2)
    expect(paladinEntry?.portraitIcon).toBe('PaladinIcon')

    hud.render()
    // Allied Paladin is drawn
    expect(mockCtx.drawnTexts.some((t) => t.text.includes('PaladinBro'))).toBe(true)
    // Unpartied Sorceress is NOT drawn on the top-left HUD
    expect(mockCtx.drawnTexts.some((t) => t.text.includes('SoloSorc'))).toBe(false)
    // Self is NOT drawn on the top-left HUD
    expect(mockCtx.drawnTexts.some((t) => t.text.includes('SelfAmazon'))).toBe(false)
  })

  it('P8: Issue #799 — mercenary and party names render above portrait box (nameY < portraitY) with zero vertical overlap', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 99,
      classId: 338, // Act 2 Desert Mercenary
      nameId: 14,
    })
    world.apply({
      type: 'Party',
      kind: 'roster',
      unitId: 2,
      charClass: 3,
      charName: 'PaladinAlly',
      partyId: 1,
      lifePct: 100,
    })
    world.apply({
      type: 'Party',
      kind: 'relation',
      unitId: 2,
      relation: 1,
    })
    model.syncFromWorld()
    hud.render()

    const mercLabel = String((hud as any).merc.name || 'Merc')
    const mercNamePasses = mockCtx.drawnTexts.filter((t) => t.text === mercLabel)
    expect(mercNamePasses.length).toBeGreaterThan(0)

    // Portrait frame rect for mercenary at slotX = 16 (w = 48, h = 48)
    const mercPortraitRect = mockCtx.drawnRects.find((r) => r.x === 16 && r.w === 48 && r.h === 48)
    expect(mercPortraitRect).toBeDefined()
    const portraitY = mercPortraitRect!.y
    expect(portraitY).toBe(16)

    // Foreground pass of mercenary name is centered at x = 40 (16 + 24), baseline nameY = 10 (drop shadows at y = 9..11)
    const fgMercPass = mercNamePasses[mercNamePasses.length - 1]!
    expect(fgMercPass.x).toBe(40)
    const nameY = fgMercPass.y
    expect(nameY).toBe(10)
    expect(nameY).toBeLessThan(portraitY)

    // font6 glyph bounding box around baseline nameY: [nameY - 8, maxPassY + 2] = [2, 13]
    const nameTop = nameY - 8
    const nameBottom = Math.max(...mercNamePasses.map((t) => t.y)) + 2
    const portraitBottom = portraitY + mercPortraitRect!.h
    // Strictly zero vertical overlap between name bounding box and portrait rect
    expect(nameBottom).toBeLessThan(portraitY)
    expect(nameTop).toBeGreaterThanOrEqual(0)
    expect(portraitBottom).toBe(64)

    // HP bar sits inside the bottom slot of the 48x48 portrait frame at (17, 58, 46, 5)
    const mercHpBarRect = mockCtx.drawnRects.find((r) => r.x === 17 && r.y === 58 && r.w === 46 && r.h === 5)
    expect(mercHpBarRect).toBeDefined()
    expect(mercHpBarRect!.y + mercHpBarRect!.h).toBeLessThanOrEqual(portraitBottom - 1)
    expect(mockCtx.drawnRects.some((r) => r.y === 66)).toBe(false)

    // Allied party member name also sits at nameY = 10 above its portrait at portraitY = 16 (slotX = 16 + 56 = 72)
    const partyNamePasses = mockCtx.drawnTexts.filter((t) => t.text === 'PaladinAlly')
    expect(partyNamePasses.length).toBeGreaterThan(0)
    expect(partyNamePasses[0]!.x).toBe(96)
    expect(partyNamePasses[partyNamePasses.length - 1]!.y).toBe(10)
    const partyPortraitRect = mockCtx.drawnRects.find((r) => r.x === 72 && r.w === 48 && r.h === 48)
    expect(partyPortraitRect).toBeDefined()
    expect(partyPortraitRect!.y).toBe(16)
    const partyHpBarRect = mockCtx.drawnRects.find((r) => r.x === 73 && r.y === 58 && r.w === 46 && r.h === 5)
    expect(partyHpBarRect).toBeDefined()

    // Issue #949: When the mercenary dies, its top-left portrait and name disappear immediately
    // and the allied party member shifts left from slotX = 72 to slotX = 16
    mockCtx.drawnTexts.length = 0
    mockCtx.drawnRects.length = 0
    hud.merc = { hp: 0, maxHp: 120, name: 'Alhizeer', isDead: true }
    hud.render()
    const deadMercPasses = mockCtx.drawnTexts.filter((t) => t.text === 'Alhizeer')
    expect(deadMercPasses).toHaveLength(0)
    const shiftedPartyPasses = mockCtx.drawnTexts.filter((t) => t.text === 'PaladinAlly')
    expect(shiftedPartyPasses.length).toBeGreaterThan(0)
    expect(shiftedPartyPasses[0]!.x).toBe(40)
  })

  it('P9: Issue #831 — mercenary, summon, and party HP bars render inside the 48x48 portrait frame bottom slot (slotX+1, 58, 46, 5) with zero floating bars below frame', () => {
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx

    // Mercenary at 50% HP (slotX = 16 -> frame [16, 16, 48, 48], HP bar inside at [17, 58, 46, 5], fillW = 23)
    hud.merc = { hp: 60, maxHp: 120, name: 'Annor', classId: 271, isDead: false }
    // Summon 0: Clay Golem (drawHp = true, 25% HP -> slotX = 72, frame [72, 16, 48, 48], HP bar at [73, 58, 46, 5], fillW = 12)
    // Summon 1: Raven (drawHp = false -> slotX = 128, compact frame [128, 16, 48, 43], no HP bar)
    hud.summonPortraits = [
      { iconKey: 'earthgolumicon', label: 'Clay Golem', drawHp: true, lifePct: 25, iconType: 3, count: 1 },
      { iconKey: 'raven', label: 'Raven', drawHp: false, lifePct: 100, iconType: 2, count: 2 },
    ]
    // Allied party member at 75% HP (slotX = 184 -> frame [184, 16, 48, 48], HP bar at [185, 58, 46, 5], fillW = 35)
    hud.partyMembers = [
      { unitId: 2, name: 'SorcAlly', charClass: 1, partyId: 1, partyState: 1, lifePct: 75, hostile: false },
    ]

    hud.render()

    // 1. Mercenary frame & interior HP bar
    const mercFrame = mockCtx.drawnRects.find((r) => r.x === 16 && r.y === 16 && r.w === 48 && r.h === 48)
    expect(mercFrame).toBeDefined()
    const mercHpTrack = mockCtx.drawnRects.find((r) => r.x === 17 && r.y === 58 && r.w === 46 && r.h === 5)
    const mercHpFill = mockCtx.drawnRects.find((r) => r.x === 17 && r.y === 58 && r.w === 23 && r.h === 5)
    expect(mercHpTrack).toBeDefined()
    expect(mercHpFill).toBeDefined()
    // Strictly enclosed inside frame borders [16+1..16+47] x [16+1..16+47]
    expect(mercHpTrack!.x).toBeGreaterThanOrEqual(mercFrame!.x + 1)
    expect(mercHpTrack!.x + mercHpTrack!.w).toBeLessThanOrEqual(mercFrame!.x + mercFrame!.w - 1)
    expect(mercHpTrack!.y + mercHpTrack!.h).toBeLessThanOrEqual(mercFrame!.y + mercFrame!.h - 1)

    // 2. Summon with drawHp=true (Clay Golem at slotX = 72)
    const golemFrame = mockCtx.drawnRects.find((r) => r.x === 72 && r.y === 16 && r.w === 48 && r.h === 48)
    expect(golemFrame).toBeDefined()
    const golemHpTrack = mockCtx.drawnRects.find((r) => r.x === 73 && r.y === 58 && r.w === 46 && r.h === 5)
    const golemHpFill = mockCtx.drawnRects.find((r) => r.x === 73 && r.y === 58 && r.w === 12 && r.h === 5)
    expect(golemHpTrack).toBeDefined()
    expect(golemHpFill).toBeDefined()

    // 3. Summon with drawHp=false (Raven at slotX = 128): compact 48x43 frame, zero HP bar at y=58
    const ravenFrame = mockCtx.drawnRects.find((r) => r.x === 128 && r.y === 16 && r.w === 48 && r.h === 43)
    expect(ravenFrame).toBeDefined()
    expect(mockCtx.drawnRects.some((r) => r.x === 129 && r.y === 58)).toBe(false)

    // 4. Allied party member (slotX = 184)
    const partyFrame = mockCtx.drawnRects.find((r) => r.x === 184 && r.y === 16 && r.w === 48 && r.h === 48)
    expect(partyFrame).toBeDefined()
    const partyHpTrack = mockCtx.drawnRects.find((r) => r.x === 185 && r.y === 58 && r.w === 46 && r.h === 5)
    const partyHpFill = mockCtx.drawnRects.find((r) => r.x === 185 && r.y === 58 && r.w === 35 && r.h === 5)
    expect(partyHpTrack).toBeDefined()
    expect(partyHpFill).toBeDefined()

    // 5. Zero floating HP bar rects below y = 64 in the top-left HUD region
    const floatingBarsBelowFrame = mockCtx.drawnRects.filter((r) => r.y >= 64 && r.y < 100)
    expect(floatingBarsBelowFrame).toHaveLength(0)
  })

  it('P10: Issue #949 — dead mercenary portrait disappears from top-left HUD, auto-closes merc panel, and reappears upon resurrection', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    // 1. Assign alive mercenary (mercId = 88, Act 2 Desert Mercenary)
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 88,
      classId: 338,
      nameId: 7, // Emilio
    })
    model.syncFromWorld()
    expect(hud.hasVisibleTopLeftPortraits()).toBe(true)
    expect(hud.isPointInMercPortrait(32, 32)).toBe(true)

    // Open merc panel via togglePanel
    expect(model.togglePanel('merc')).toBe(true)
    expect(hud.leftPanel).toBe('merc')

    // 2. Mercenary dies (0x9B MercReviveCost or lifePct=0)
    world.apply({
      type: 'Merc',
      kind: 'reviveCost',
      reviveNameId: 7,
      reviveCost: 15000,
    } as any)
    model.syncFromWorld()

    // Mercenary panel automatically closes upon death and cannot be reopened while dead
    expect(hud.leftPanel).toBe('none')
    expect(model.togglePanel('merc')).toBe(false)
    expect(hud.hasVisibleTopLeftPortraits()).toBe(false)
    expect(hud.isPointInMercPortrait(32, 32)).toBe(false)

    mockCtx.drawnTexts.length = 0
    mockCtx.drawnRects.length = 0
    hud.render()
    // Zero top-left portrait boxes or mercenary name drawn while dead
    expect(mockCtx.drawnRects.some((r) => r.x === 16 && r.y === 16 && r.w === 48 && r.h === 48)).toBe(false)
    expect(mockCtx.drawnTexts.some((t) => t.text === 'Emilio' || t.text === '艾米羅')).toBe(false)

    // 3. Resurrect mercenary in town (0x81 AssignMerc with non-zero mercId)
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 89,
      classId: 338,
      nameId: 7,
    })
    model.syncFromWorld()
    expect(hud.hasVisibleTopLeftPortraits()).toBe(true)
    expect(hud.isPointInMercPortrait(32, 32)).toBe(true)

    mockCtx.drawnTexts.length = 0
    mockCtx.drawnRects.length = 0
    hud.render()
    expect(mockCtx.drawnRects.some((r) => r.x === 16 && r.y === 16 && r.w === 48 && r.h === 48)).toBe(true)
  })

  it('P11: Issue #1012 — Skeleton and Golem top-left HUD portraits persist across Teleport (0x0A UnitRemove, RoomHide, LoadAct, and 0x15 UnitReassign)', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 2, // Necromancer
      name: 'NecroHero',
      x: 5000,
      y: 5000,
    })

    // Summon 3 Skeletons (petType=4, classId=363) and 1 Clay Golem (petType=3, classId=289)
    for (const skelId of [201, 202, 203]) {
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: skelId, classId: 363, x: 5002, y: 5002, lifePct: 128, mode: 1 },
      })
      world.apply(
        decode0x7ASummonAction(
          new Uint8Array([0x7a, 1, 4, 0x6b, 0x01, 1, 0, 0, 0, skelId, 0, 0, 0]),
        ),
      )
    }
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 204, classId: 289, x: 5004, y: 5004, lifePct: 128, mode: 1 },
    })
    world.apply(
      decode0x7ASummonAction(new Uint8Array([0x7a, 1, 3, 0x21, 0x01, 1, 0, 0, 0, 204, 0, 0, 0])),
    )

    model.syncFromWorld()
    expect((hud as any).summonPortraits).toHaveLength(2)
    expect((hud as any).summonPortraits.find((p: any) => p.petType === 4)?.count).toBe(3)
    expect((hud as any).summonPortraits.find((p: any) => p.petType === 3)?.iconKey).toBe(
      'earthgolumicon',
    )

    // 1. Player teleports far away: old room sends 0x0A RemoveGroundUnit (UnitRemove) for Skeletons & Golem
    for (const petId of [201, 202, 203, 204]) {
      world.apply({ type: 'UnitRemove', unitType: 1, id: petId })
    }
    world.apply({
      type: 'UnitReassign',
      unitType: 0,
      id: 1,
      at: { x: 5400, y: 5400 },
    })
    model.syncFromWorld()

    // Top-left Skeleton and Golem portraits MUST remain intact in world.pets and hud.summonPortraits!
    expect(world.pets.has(201)).toBe(true)
    expect(world.pets.has(202)).toBe(true)
    expect(world.pets.has(203)).toBe(true)
    expect(world.pets.has(204)).toBe(true)
    expect((hud as any).summonPortraits).toHaveLength(2)
    expect((hud as any).summonPortraits.find((p: any) => p.petType === 4)?.count).toBe(3)
    expect((hud as any).summonPortraits.find((p: any) => p.petType === 3)?.count).toBe(1)

    // 2. Server leashes Skeletons & Golem to new position via 0x15 ReassignPlayer (UnitReassign) without re-sending 0x7A
    for (const petId of [201, 202, 203, 204]) {
      world.apply({
        type: 'UnitReassign',
        unitType: 1,
        id: petId,
        at: { x: 5402, y: 5402 },
      })
    }
    model.syncFromWorld()

    expect((hud as any).summonPortraits).toHaveLength(2)
    const skelUnit = world.getUnit('monster', 201)!
    expect(skelUnit.classId).toBe(363)
    expect(skelUnit.x).toBe(5402)
    expect(skelUnit.y).toBe(5402)
    expect(skelUnit.ownerType).toBe('player')
    expect(skelUnit.ownerId).toBe(1)

    const golemUnit = world.getUnit('monster', 204)!
    expect(golemUnit.classId).toBe(289)
    expect(golemUnit.x).toBe(5402)
    expect(golemUnit.y).toBe(5402)
    expect(golemUnit.ownerType).toBe('player')
    expect(golemUnit.ownerId).toBe(1)

    // 3. Only 0x7A SummonAction (action=0) removes a pet from the roster
    world.apply(
      decode0x7ASummonAction(new Uint8Array([0x7a, 0, 3, 0x21, 0x01, 1, 0, 0, 0, 204, 0, 0, 0])),
    )
    model.syncFromWorld()
    expect(world.pets.has(204)).toBe(false)
    expect((hud as any).summonPortraits).toHaveLength(1)
    expect((hud as any).summonPortraits[0].petType).toBe(4)
    expect((hud as any).summonPortraits[0].count).toBe(3)
  })

  it('P12: hudRepaintUnchanged invalidates immediately on mercenary, summon, or party portrait HP change', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    hud.enableIdleThrottle = true
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 77,
      classId: 271,
      nameId: 1,
    })
    model.syncFromWorld()
    hud.render(1000)
    const countAfterFirst = mockCtx.drawnRects.length
    expect(countAfterFirst).toBeGreaterThan(0)

    // Same state 50ms later (> 40ms 25fps tick, < 250ms safety repaint) -> skipped by hudRepaintUnchanged
    hud.render(1050)
    expect(mockCtx.drawnRects.length).toBe(countAfterFirst)

    // Mercenary takes damage via 0x0C NPCGetHit -> next 25fps frame at 1100ms must repaint immediately
    world.apply({
      type: 'UnitMode',
      unitType: 'monster',
      id: 77,
      mode: 3,
      lifePct: 64,
    })
    model.syncFromWorld()
    hud.render(1100)
    expect(mockCtx.drawnRects.length).toBeGreaterThan(countAfterFirst)
  })

  it('P13: 0x6D NPCStop lifeByte and 0x7F PartyMemberState (0..100) vs 0..128 scale keep unit, merc, and summon portrait HP synchronized', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 88, classId: 271, x: 5100, y: 5100, mode: 1, lifePct: 128 },
    })
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 88,
      classId: 271,
      nameId: 2,
    })
    // Also summon a Clay Golem (id=89, petType=3, classId=289)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 89, classId: 289, x: 5102, y: 5102, mode: 1, lifePct: 128 },
    })
    world.apply(
      decode0x7ASummonAction(new Uint8Array([0x7a, 1, 3, 0x21, 0x01, 1, 0, 0, 0, 89, 0, 0, 0])),
    )
    model.syncFromWorld()
    const fullMaxHp = (hud as any).merc.maxHp
    expect(fullMaxHp).toBeGreaterThan(0)
    expect((hud as any).merc.hp).toBe(fullMaxHp)
    expect((hud as any).summonPortraits[0].lifePct).toBe(100)

    // 1. 0x6D NPCStop with lifeByte = 64 (50% of 128) on living merc and golem
    for (const uId of [88, 89]) {
      world.apply({
        type: 'UnitMove',
        unit: { unitType: 'monster', id: uId },
        to: { x: 5104, y: 5104 },
        lifePct: 64,
        npc: {
          opcode: 0x6d,
          cmd: 0x01,
          unitId: uId,
          s: [5104, 5104, 64],
          b: [],
          d: [],
        },
      } as any)
    }
    model.syncFromWorld()
    expect(world.getUnit('monster', 88)?.lifePct).toBe(64)
    expect(world.merc?.lifePct).toBe(64)
    expect((hud as any).merc.hp).toBe(Math.round(fullMaxHp * 0.5))
    expect(world.getUnit('monster', 89)?.lifePct).toBe(64)
    expect((hud as any).summonPortraits[0].lifePct).toBe(50)

    // 2. 0x7F PartyMemberState with lifePct = 100 (full HP on 0..100 scale) must restore 100% of maxHp (not 100/128 = 78%)
    world.apply({
      type: 'Party',
      kind: 'memberState',
      isPlayer: false,
      relation: 0,
      unitId: 88,
      lifePct: 100,
    })
    model.syncFromWorld()
    expect(world.merc?.lifePct).toBe(100)
    expect(world.merc?.lifePctScale).toBe(100)
    expect((hud as any).merc.hp).toBe(fullMaxHp)
    expect(world.getUnit('monster', 88)?.lifePct).toBe(128)
  })

  it('P14: StatSet (stat 6 / stat 7) synchronizes merc & pet lifePct and invalidates stale stat 6 on subsequent lifePct packets', () => {
    const world = new ClientWorld()
    world.selfId = 1
    const mockCtx = createMockContext()
    const hud = new HudManager()
    hud.ctx = mockCtx
    const model = new HudModel({ world, hudManager: hud })

    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 95, classId: 271, x: 5000, y: 5000, mode: 1, lifePct: 128 },
    })
    world.apply({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 95,
      classId: 271,
      nameId: 1,
    })

    // Server sends StatSet maxHp=200 (stat 7) and hp=50 (stat 6, i.e. 25%)
    world.apply({
      type: 'StatSet',
      unit: { unitType: 'monster', id: 95 },
      stat: 7,
      value: 200,
    })
    world.apply({
      type: 'StatSet',
      unit: { unitType: 'monster', id: 95 },
      stat: 6,
      value: 50,
    })
    model.syncFromWorld()
    expect(world.getUnit('monster', 95)?.lifePct).toBe(32)
    expect(world.merc?.lifePct).toBe(32)
    expect((hud as any).merc.maxHp).toBe(200)
    expect((hud as any).merc.hp).toBe(50)

    // Subsequent 0x3E Npc heal (lifePct=128) invalidates stale stat 6=50 and restores full 200/200 HP
    world.apply({
      type: 'Npc',
      kind: 'heal',
      unitId: 95,
      result: 128,
    })
    model.syncFromWorld()
    expect((hud as any).merc.hp).toBe(200)
  })
})
