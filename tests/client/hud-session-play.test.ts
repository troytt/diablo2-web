import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { CommandMapper, ViewportCamera } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import {
  OnlineSession,
  decodeCapturedGameS2cPacket,
} from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { D2StatId } from '../../src/client/world/stat-list.ts'
import {
  formatD2CapEntry,
  formatD2CapHeader,
  type ClientCommand,
  type CloseReason,
  type D2OnlineFlow,
  type D2OnlineState,
  type GameServerAdapter,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { worldToScreen } from '../../src/client/view/viewport-profile.ts'
import { layoutGroundItemLabels } from '../../src/client/scene/world-renderer.ts'

type ItemEventItem = Extract<ServerEvent, { type: 'ItemEvent' }>['item']

/** Minimal Healing Potion (hp4) in the given belt slot, as decoded from a 0x9C ItemEvent. */
function makeBeltPotionItem(id: number, slot: number): ItemEventItem {
  return {
    id,
    itemId: id,
    opcode: 0x9c,
    action: 0x0e,
    category: 0,
    flags: 0,
    rawFlags: 0,
    version: 101,
    location: 2,
    container: 'belt',
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: slot,
    gridY: 0,
    storePage: 0,
    storagePage: 0,
    worldX: 0,
    worldY: 0,
    x: slot,
    y: 0,
    code: 'hp4',
    rawCode: 'hp4 ',
    compact: true,
    simple: true,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 2,
    invWidth: 1,
    invHeight: 1,
    stats: [],
    setBonusStats: [],
    runewordStats: [],
  } as ItemEventItem
}

describe('Milestone M5 — HudModel, CommandMapper, and OnlineSession', () => {
  describe('HudModel (F16)', () => {
    it('synchronizes ClientWorld vitals, stats, skills, containers, quests, waypoints, and monster target into HudManager', () => {
      const world = new ClientWorld()
      const hudManager = new HudManager()
      const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
      const automapView = new AutomapView()
      const commands: ClientCommand[] = []

      const hudModel = new HudModel({
        world,
        hudManager,
        predictor,
        automap: automapView,
        onCommand: (cmd) => commands.push(cmd),
      })

      // Apply authoritative player assignment & stats
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 0,
          id: 1,
          classId: 1, // Sorceress
          name: 'Jaina',
          x: 120,
          y: 140,
        },
        isSelf: true,
      })
      world.apply({ type: 'StatSet', stat: D2StatId.Level, value: 30 })
      world.apply({ type: 'StatSet', stat: D2StatId.Experience, value: 4_500_000 })
      world.apply({ type: 'StatSet', stat: D2StatId.Strength, value: 60 })
      world.apply({ type: 'StatSet', stat: D2StatId.Dexterity, value: 40 })
      world.apply({ type: 'StatSet', stat: D2StatId.Vitality, value: 120 })
      world.apply({ type: 'StatSet', stat: D2StatId.Energy, value: 150 })
      world.apply({ type: 'StatSet', stat: D2StatId.StatPts, value: 15 })
      world.apply({ type: 'StatSet', stat: D2StatId.NewSkills, value: 3 })
      world.apply({ type: 'StatSet', stat: D2StatId.Gold, value: 25_000 })
      world.apply({ type: 'StatSet', stat: D2StatId.GoldBank, value: 150_000 })
      world.apply({ type: 'StatSet', stat: D2StatId.FireResist, value: 75 })
      world.apply({ type: 'StatSet', stat: D2StatId.ColdResist, value: 60 })
      // Pool stats 6..11 are 8.8 fixed point on the 1.13c wire (ItemStatCost ValShift = 8)
      world.apply({ type: 'StatSet', stat: D2StatId.MaxHp, value: 420 << 8 })
      world.apply({ type: 'StatSet', stat: D2StatId.MaxMana, value: 500 << 8 })
      world.apply({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 220 << 8 })
      world.apply({
        type: 'LifeMana',
        life: 380,
        mana: 450,
        stamina: 200,
        at: { x: 120, y: 140 },
      })
      world.apply({
        type: 'SkillList',
        unitId: 1,
        skills: [
          { skillId: 36, level: 10, bonus: 2 }, // Fire Bolt
          { skillId: 54, level: 1, bonus: 2 }, // Teleport
        ],
      })
      world.apply({
        type: 'ActiveSkill',
        unitId: 1,
        hand: 'left',
        skill: 36,
        itemId: 0xffffffff,
      })
      world.apply({
        type: 'ActiveSkill',
        unitId: 1,
        hand: 'right',
        skill: 54,
        itemId: 0xffffffff,
      })
      world.apply({
        type: 'WaypointMenu',
        unitId: 77,
        open: [1, 3, 4, 5, 6, 40],
      })

      // Add a belt potion and an inventory item
      world.apply({
        type: 'ItemEvent',
        action: 0x0e, // put in belt
        container: 'belt',
        item: {
          id: 501,
          itemId: 501,
          opcode: 0x9c,
          action: 0x0e,
          category: 0,
          flags: 0,
          rawFlags: 0,
          version: 101,
          location: 2,
          container: 'belt',
          bodyLoc: 0,
          equippedSlot: 0,
          gridX: 0,
          gridY: 0,
          storePage: 0,
          storagePage: 0,
          worldX: 0,
          worldY: 0,
          x: 0,
          y: 0,
          code: 'hp4',
          rawCode: 'hp4 ',
          compact: true,
          simple: true,
          identified: true,
          socketed: false,
          ethereal: false,
          runeword: false,
          personalized: false,
          isEar: false,
          newItem: false,
          starterItem: false,
          broken: false,
          inSocket: false,
          equipped: false,
          socketedChildCount: 0,
          usedSockets: 0,
          totalSockets: 0,
          quality: 2,
          invWidth: 1,
          invHeight: 1,
          stats: [],
          setBonusStats: [],
          runewordStats: [],
        },
      })
      world.apply({
        type: 'ItemEvent',
        action: 0x04, // put in inventory
        container: 'inventory',
        item: {
          id: 601,
          itemId: 601,
          opcode: 0x9c,
          action: 0x04,
          category: 0,
          flags: 0,
          rawFlags: 0,
          version: 101,
          location: 0,
          container: 'inventory',
          bodyLoc: 0,
          equippedSlot: 0,
          gridX: 2,
          gridY: 1,
          storePage: 0,
          storagePage: 0,
          worldX: 0,
          worldY: 0,
          x: 2,
          y: 1,
          code: 'cap',
          rawCode: 'cap ',
          compact: false,
          simple: false,
          identified: true,
          socketed: true,
          ethereal: false,
          runeword: false,
          personalized: false,
          isEar: false,
          newItem: false,
          starterItem: false,
          broken: false,
          inSocket: false,
          equipped: false,
          socketedChildCount: 0,
          usedSockets: 0,
          totalSockets: 1,
          quality: 7,
          invWidth: 2,
          invHeight: 2,
          stats: [],
          setBonusStats: [],
          runewordStats: [],
        },
      })

      // Spawn a unique monster and hover it
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 1,
          id: 900,
          classId: 1,
          name: 'Bishibosh',
          x: 125,
          y: 142,
          lifePct: 96,
          isSuperUnique: true,
          bossMods: [5, 8],
        },
      })

      hudModel.setHoveredMonster(900)
      const snap = hudModel.getSnapshot()

      expect(snap.charName).toBe('Jaina')
      expect(snap.classCode).toBe('sor')
      expect(snap.level).toBe(30)
      expect(snap.hp).toBe(380)
      expect(snap.maxHp).toBe(420)
      expect(snap.mana).toBe(450)
      expect(snap.maxMana).toBe(500)
      expect(snap.str).toBe(60)
      expect(snap.dex).toBe(40)
      expect(snap.vit).toBe(120)
      expect(snap.ene).toBe(150)
      expect(snap.statPoints).toBe(15)
      expect(snap.skillPoints).toBe(3)
      expect(snap.gold).toBe(25_000)
      expect(snap.stashGold).toBe(150_000)
      expect(snap.leftSkillId).toBe(36)
      expect(snap.rightSkillId).toBe(54)
      expect(snap.beltCount).toBe(1)
      expect(snap.inventoryCount).toBe(1)
      expect(snap.unlockedWaypoints).toEqual([1, 3, 4, 5, 6, 40])

      // Verify HudManager mirror
      expect(hudManager.hp).toBe(380)
      expect(hudManager.maxHp).toBe(420)
      expect(hudManager.mana).toBe(450)
      expect(hudManager.maxMana).toBe(500)
      expect(hudManager.charSheet.attrs.name).toBe('Jaina')
      expect(hudManager.charSheet.attrs.str).toBe(60)
      expect(hudManager.charSheet.attrs.fireRes).toBe(75)
      expect(hudManager.inventory.gold).toBe(25_000)
      expect(hudManager.worldPanels.stashGold).toBe(150_000)
      expect(hudManager.inventory.gridItems.length).toBe(1)
      expect(hudManager.belt.grid[0]?.[0]?.code).toBe('hp4')
      expect(hudManager.targetMonster?.name).toBe('Bishibosh')
      expect(hudManager.targetMonster?.rank).toBe('superunique')

      // Test outbound command helpers
      expect(hudModel.allocateStat('str')).toBe(true)
      expect(hudModel.allocateSkill(36)).toBe(true)
      hudModel.selectSkill('right', 36)
      hudModel.useBeltSlot(0, false)
      hudModel.swapWeapons()
      hudModel.teleportWaypoint(77, 40)
      hudModel.pickupItemToCursor(601)
      hudModel.placeCursorItem(601, 0, 0, 0)
      hudModel.equipItem(601, 'helm')
      hudModel.unequipItem('helm')
      hudModel.dropItem(601)
      hudModel.transmuteCube()

      expect(commands.map((c) => c.type)).toEqual([
        'AddStatPoint',
        'AddSkillPoint',
        'SelectSkill',
        'BeltUse',
        'SwapWeapons',
        'WaypointGo',
        'ItemToCursor',
        'ItemPlace',
        'ItemEquip',
        'ItemUnequip',
        'ItemDrop',
        'ClickButton',
      ])
      // BeltUse carries the real server item id of the bottom potion in column 0
      expect(commands.find((c) => c.type === 'BeltUse')).toEqual({ type: 'BeltUse', itemId: 501, shift: false })

      // Server authority: command helpers never mutate HUD / world state locally
      expect(hudManager.charSheet.attrs.statPoints).toBe(15)
      expect(hudManager.charSheet.attrs.str).toBe(60)
      expect(hudManager.skillTree.unspentSkillPoints).toBe(3)
      expect(hudManager.skillTree.getHardPoints(36)).toBe(10)
      expect(world.self.rightSkill).toBe(54)
      expect(hudManager.hotkeys.rightSkillId).toBe(54)
      expect(world.self.weaponSet).toBe(0)
      expect(hudManager.inventory.weaponSwapSet).toBe(0)
      expect(hudManager.belt.grid[0]?.[0]?.code).toBe('hp4')
      expect(hudManager.hp).toBe(380)

      // No belt item in column 3 -> no BeltUse command
      const before = commands.length
      expect(hudModel.useBeltSlot(3, false)).toBe(false)
      expect(commands.length).toBe(before)
      hudModel.dispose()
    })
  })

  describe('CommandMapper (F17)', () => {
    it('translates viewport clicks into Move / SkillAt / SkillOn / ItemPickup / Interact and gates HUD clicks across 800x600 and 1024x768', () => {
      const world = new ClientWorld()
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 100, y: 100 },
        isSelf: true,
      })

      const hudManager = new HudManager()
      hudManager.resize(800, 600)
      const predictor = new LocalMovementPredictor({ initialX: 100, initialY: 100 })
      const automapView = new AutomapView()
      automapView.setContext(0x11223344, 0, 1)
      const camera = new ViewportCamera('800x600')
      camera.snapTo(100, 100)

      const dispatched: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        hudManager,
        predictor,
        automap: automapView,
        onCommand: (cmd) => dispatched.push(cmd),
      })

      const mapper = new CommandMapper({
        world,
        camera,
        hudManager,
        hudModel,
        predictor,
        automapView,
        sendCommand: (cmd) => dispatched.push(cmd),
      })

      // 1. Click on bottom HUD control bar (y = 580 in 800x600) -> intercepted by HUD, 0 world commands
      const hudClick = mapper.handlePointerDown(400, 580, 0, 1000)
      expect(hudClick).toBeNull()
      expect(dispatched.length).toBe(0)

      // 2. Left-click in world space (center-right of screen: x=560, y=300) -> Move command + predictor path
      const moveRec = mapper.handlePointerDown(560, 300, 0, 2000)
      expect(moveRec).not.toBeNull()
      expect(moveRec?.rateLimit.allowed).toBe(true)
      expect(moveRec?.command.type).toBe('Move')
      expect(predictor.getSnapshot().moving).toBe(true)
      mapper.handlePointerUp(0)

      const secondRec = mapper.handlePointerDown(592, 316, 0, 2040)
      expect(secondRec?.rateLimit.allowed).toBe(true)
      expect(secondRec?.command.type).toBe('Move')
      mapper.handlePointerUp(0)

      expect(mapper.tick(2170)).toBeNull()

      // 4a. Right-click on empty ground with the default right-hand Attack (#0, a melee skill) and no Shift:
      //     1.13c D2Client walks/runs to the clicked spot instead of swinging in place (Issue #1298).
      const rightMeleeRec = mapper.handlePointerDown(464, 268, 2, 3000)
      expect(rightMeleeRec?.command.type).toBe('Move')
      mapper.handlePointerUp(2)

      // 4b. With a ranged spell on the right hand (Fire Bolt #36, server-acked via 0x23), right-click in
      //     world space -> SkillAt (hand: 'right')
      world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 36, itemId: 0xffffffff })
      const rightRec = mapper.handlePointerDown(464, 268, 2, 3400)
      expect(rightRec?.command.type).toBe('SkillAt')
      if (rightRec?.command.type === 'SkillAt') {
        expect(rightRec.command.hand).toBe('right')
      }
      mapper.handlePointerUp(2)
      world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 0, itemId: 0xffffffff })

      // 5. Spawn ground item at subtile (104, 100) and click its screen projection
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 4, id: 701, classId: 10, name: 'Gold', x: 104, y: 100 },
      })
      camera.snapTo(100, 100)
      predictor.setPosition(100, 100)
      const itemScreen = camera.subtileToScreen(104, 100)
      const pickupRec = mapper.handlePointerDown(itemScreen.x, itemScreen.y, 0, 4000)
      expect(pickupRec?.command).toEqual({
        type: 'ItemPickup',
        itemId: 701,
        toCursor: false,
      })
      mapper.handlePointerUp(0)

      // 5b. Spawn town NPC in Rogue Encampment (areaId = 1) with default mode 0 and click its screen projection
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 1 })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 1, id: 801, classId: 148, name: 'Akara', x: 95, y: 100, lifePct: 128 },
      })
      camera.snapTo(100, 100)
      predictor.setPosition(100, 100)
      const npcBeforeCount = dispatched.length
      const npcScreen = camera.subtileToScreen(95, 100)
      const npcRec = mapper.handlePointerDown(npcScreen.x, npcScreen.y, 0, 4500)
      expect(npcRec?.command.type).toBe('MoveToUnit')
      // At dx = 5 (#10407 = 4 > 2 1.13c click interact range), clicking dispatches MoveToUnit + MakeEntityMove and defers Interact/NpcInit until arrival
      expect(dispatched.slice(npcBeforeCount).map((c) => c.type)).toEqual([
        'MoveToUnit',
        'MakeEntityMove',
      ])
      mapper.handlePointerUp(0)
      predictor.setPosition(97, 100)
      mapper.tick(4700)
      expect(dispatched.slice(npcBeforeCount).map((c) => c.type)).toEqual([
        'MoveToUnit',
        'MakeEntityMove',
        'Interact',
        'NpcInit',
      ])

      // 6. Resize to 1024x768 and verify HUD interception & keyboard hotkeys
      hudManager.resize(1024, 768)
      camera.resize('1024x768')
      expect(mapper.isPointIntercepted(512, 740)).toBe(true) // bottom bar in 1024x768
      expect(mapper.isPointIntercepted(512, 384)).toBe(false) // center play area

      mapper.bindSkillHotkey('F1', { hand: 'right', skillId: 54 })
      expect(mapper.handleKeyDown({ key: 'F1' }, 5000)).toBe(true)
      // Server authority: F1 only requests SelectSkill; the slot changes when the server answers (0x23)
      expect(dispatched[dispatched.length - 1]).toMatchObject({ type: 'SelectSkill', hand: 'right', skill: 54 })
      expect(hudModel.rightSkillId).toBe(0)
      world.apply({ type: 'ActiveSkill', unitId: 1, hand: 'right', skill: 54, itemId: 0xffffffff })
      expect(hudModel.rightSkillId).toBe(54)
      expect(hudManager.hotkeys.rightSkillId).toBe(54)

      // Belt key '1' with an empty server belt emits nothing; once the server puts a potion there, BeltUse
      // carries its real item id
      expect(mapper.handleKeyDown({ key: '1' }, 6000)).toBe(true)
      expect(dispatched.some((c) => c.type === 'BeltUse')).toBe(false)
      world.apply({ type: 'ItemEvent', action: 0x0e, container: 'belt', item: makeBeltPotionItem(555, 0) })
      expect(mapper.handleKeyDown({ key: '1' }, 6050)).toBe(true)
      expect(dispatched.filter((c) => c.type === 'BeltUse')).toEqual([{ type: 'BeltUse', itemId: 555, shift: false }])

      expect(mapper.handleKeyDown({ key: 'Tab' }, 6100)).toBe(true)
      expect(automapView.consumeVisibilityToggleRequest()).toBe(true)
      expect(automapView.getMode()).toBe('off')
      expect(mapper.handleKeyDown({ key: 'Tab' }, 6200)).toBe(true)
      expect(automapView.consumeVisibilityToggleRequest()).toBe(true)
      expect(automapView.getMode()).toBe('off')

      expect(mapper.handleKeyDown({ key: 'c' }, 6300)).toBe(true)
      expect(hudManager.leftPanel).toBe('char')
      expect(mapper.handleKeyDown({ key: 'Escape' }, 6400)).toBe(true)
      expect(hudManager.leftPanel).toBe('none')

      hudModel.dispose()
    })

    it('projects warps, town portals, ground item labels, SkillCast visuals, death Resurrect, and party/merc/trade interactions (M2)', () => {
      const session = new OnlineSession({
        settingsStore: createSettingsStore(),
      })
      const dispatched: ClientCommand[] = []
      const origForward = (session as any).forwardCommandToAdapter.bind(session)
      ;(session as any).forwardCommandToAdapter = (cmd: ClientCommand) => {
        dispatched.push(cmd)
        origForward(cmd)
      }

      // Attach a stub LevelView for Blood Moor (areaId=2) with warp 4 -> Den of Evil (areaId=8)
      session.levelView = {
        act: 0,
        areaId: 2,
        subOriginX: 5000,
        subOriginY: 5000,
        subWidth: 400,
        subHeight: 400,
        isoOriginX: 0,
        isoOriginY: 0,
        cellsX: 80,
        cellsY: 80,
        gridWidth: 400,
        blocked: new Uint8Array(400 * 400),
        walkable: new Uint8Array(400 * 400).fill(1),
        collisionMasks: new Uint16Array(400 * 400),
        rooms: [],
        floors: [],
        shadows: [],
        walls: [],
        roofs: [],
        warps: [{ lvlWarpId: 4, toLevelId: 8, subX: 112, subY: 102 }],
        presets: [],
      } as any

      session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorceress', x: 5100, y: 5100 },
        isSelf: true,
      })

      // R4.1: Warp tile (unitType 5) projection, pickUnitAtScreen, and 1.13c out-of-range walk-then-interact
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 5, id: 401, classId: 4, warpId: 4, x: 5112, y: 5102 } as any,
      })
      const snapWithWarp = session.sceneSource.buildFrameSnapshot()
      const warpDrawable = snapWithWarp.entities.unitDrawables.find(
        (u) => u.id === 401 && u.unitKind === 'warp',
      )
      expect(warpDrawable).toBeDefined()
      expect(warpDrawable?.warpId).toBe(4)
      expect(warpDrawable?.toLevelId).toBe(8)
      expect(warpDrawable?.name).toContain('Den of Evil')

      const warpScreen = worldToScreen(
        warpDrawable!.worldX,
        warpDrawable!.worldY,
        snapWithWarp.playerWorld.x,
        snapWithWarp.playerWorld.y,
        snapWithWarp.viewportProfile,
      )
      const pickedWarp = session.sceneSource.pickUnitAtScreen(warpScreen.x, warpScreen.y)
      expect(pickedWarp?.id).toBe(401)
      expect(pickedWarp?.unitKind).toBe('warp')

      const warpClickScreen = session.camera.subtileToScreen(5112, 5102)
      session.commandMapper.handlePointerDown(warpClickScreen.x, warpClickScreen.y, 0, 1000)
      session.commandMapper.handlePointerUp(0)
      expect(
        dispatched.some(
          (c) => c.type === 'MoveToUnit' && c.target.unitType === 5 && c.target.id === 401,
        ),
      ).toBe(true)
      expect(
        dispatched.some(
          (c) => c.type === 'Interact' && c.target.unitType === 5 && c.target.id === 401,
        ),
      ).toBe(false)
      expect(dispatched.some((c) => c.type === 'TakeWarp')).toBe(false)
      session.predictor.setPosition(5110, 5102)
      session.commandMapper.tick(1200)
      session.predictor.setPosition(5100, 5100)
      session.camera.snapTo(5100, 5100)
      expect(
        dispatched.some(
          (c) => c.type === 'Interact' && c.target.unitType === 5 && c.target.id === 401,
        ),
      ).toBe(true)

      // R4.2: Town Portal ownership hover + out-of-range walk-then-interact
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 2, id: 601, classId: 59, name: 'Town Portal', x: 5110, y: 5094 },
      })
      session.handleServerEvent({
        type: 'Portal',
        ownerId: 1,
        ownerName: 'Sorceress',
        localId: 601,
        remoteId: 602,
        areaId: 1,
      })
      const portalUnits = session.buildRenderableUnits()
      const portalRenderable = portalUnits.find((u) => u.id === 601)
      expect(portalRenderable?.name).toContain("Sorceress's Town Portal")
      expect(portalRenderable?.portalOwnerName).toBe('Sorceress')

      const beforePortalCmds = dispatched.length
      const portalScreen = session.camera.subtileToScreen(5110, 5094)
      session.commandMapper.handlePointerDown(portalScreen.x, portalScreen.y, 0, 2000)
      session.commandMapper.handlePointerUp(0)
      expect(dispatched.slice(beforePortalCmds).some((c) => c.type === 'MoveToUnit' && c.target.id === 601)).toBe(true)
      expect(dispatched.slice(beforePortalCmds).some((c) => c.type === 'Interact' && c.target.id === 601)).toBe(false)
      session.predictor.setPosition(5109, 5094)
      session.commandMapper.tick(2200)
      session.predictor.setPosition(5100, 5100)
      session.camera.snapTo(5100, 5100)
      const portalCmds = dispatched.slice(beforePortalCmds)
      expect(portalCmds.some((c) => c.type === 'MoveToUnit' && c.target.id === 601)).toBe(true)
      expect(portalCmds.some((c) => c.type === 'Interact' && c.target.id === 601)).toBe(true)

      // R4.2: Ground item gold amount, quality, Alt non-overlapping labels, and walk-then-pickup
      session.handleServerEvent({
        type: 'ItemEvent',
        action: 0x00,
        container: 'ground',
        item: {
          ...makeBeltPotionItem(710, 0),
          id: 710,
          itemId: 710,
          action: 0x00,
          location: 3,
          container: 'ground',
          code: 'gld',
          rawCode: 'gld ',
          name: 'Gold',
          goldAmount: 72,
          worldX: 5108,
          worldY: 5104,
          x: 5108,
          y: 5104,
        } as any,
      })
      session.handleServerEvent({
        type: 'ItemEvent',
        action: 0x00,
        container: 'ground',
        item: {
          ...makeBeltPotionItem(711, 0),
          id: 711,
          itemId: 711,
          action: 0x00,
          location: 3,
          container: 'ground',
          code: 'cap',
          rawCode: 'cap ',
          name: 'Cap',
          quality: 4,
          worldX: 5108,
          worldY: 5104,
          x: 5108,
          y: 5104,
        } as any,
      })
      const itemDrawables = session.sceneSource
        .buildFrameSnapshot()
        .entities.unitDrawables.filter((u) => u.unitKind === 'item')
      const goldDrawable = itemDrawables.find((u) => u.id === 710)
      expect(goldDrawable?.goldAmount).toBe(72)
      expect(goldDrawable?.name).toBe('72 Gold')

      session.commandMapper.handleKeyDown({ key: 'Alt', altKey: true }, 2500)
      expect(session.commandMapper.isAltHeld).toBe(true)
      const labelBoxes = layoutGroundItemLabels([
        { id: 710, text: '72 Gold', color: '#c4a060', screenX: 400, screenY: 300 },
        { id: 711, text: 'Cap', color: '#5050dc', screenX: 400, screenY: 300 },
      ])
      expect(labelBoxes).toHaveLength(2)
      expect(labelBoxes[0]!.y).not.toBe(labelBoxes[1]!.y)
      session.commandMapper.handleKeyUp({ key: 'Alt', altKey: false })

      const beforeItemCmds = dispatched.length
      const itemClickScreen = session.camera.subtileToScreen(5108, 5104)
      session.commandMapper.handlePointerDown(itemClickScreen.x, itemClickScreen.y, 0, 3000)
      session.commandMapper.handlePointerUp(0)
      const itemCmds = dispatched.slice(beforeItemCmds)
      expect(itemCmds.some((c) => c.type === 'MoveToUnit' && c.target.id === 710)).toBe(true)
      expect(itemCmds.some((c) => c.type === 'ItemPickup' && c.itemId === 710)).toBe(true)

      // R4.3: SkillCast (0x4D) updates castState, mode (10 -> SC), and facing direction toward target
      session.handleServerEvent({
        type: 'SkillCast',
        caster: { unitType: 0, id: 1 },
        skill: 36,
        skillId: 36,
        level: 1,
        target: { x: 5120, y: 5100 },
      })
      const castDrawables = buildSceneDrawables(session.buildRenderableUnits(), {
        originX: 0,
        originY: 0,
        tick: 1,
      })
      const selfDrawable = castDrawables.unitDrawables.find((u) => u.id === 1 && u.unitKind === 'player')
      expect(selfDrawable?.mode).toBe(10)
      expect(selfDrawable?.animMode).toBe('SC')

      // R4.4: Player death + Escape -> Resurrect (0x41)
      session.handleServerEvent({
        type: 'UnitMode',
        unitType: 0,
        id: 1,
        mode: 0,
        lifePct: 0,
      })
      expect(session.world.isSelfDead).toBe(true)
      session.commandMapper.handleKeyDown({ key: 'Escape' }, 4000)
      expect(dispatched.some((c) => c.type === 'Resurrect')).toBe(true)

      // R5.1/R5.2: Party ('P') and Mercenary ('O') hotkeys + player click trade interaction
      session.handleServerEvent({
        type: 'LifeMana',
        life: 100,
        mana: 100,
        stamina: 100,
        at: { x: 5100, y: 5100 },
        vx: 0,
        vy: 0,
      })
      session.handleServerEvent({
        type: 'Merc',
        kind: 'assign',
        ownerId: 1,
        mercId: 901,
        classId: 271,
        nameId: 1,
      })
      session.commandMapper.handleKeyDown({ key: 'p' }, 5000)
      expect(
        Boolean(session.hudModel.getSnapshot().panels.party) ||
          (session.hudManager.leftPanel as string) === 'party',
      ).toBe(true)
      session.commandMapper.handleKeyDown({ key: 'o' }, 5100)
      expect(
        Boolean(session.hudModel.getSnapshot().panels.merc) ||
          (session.hudManager.leftPanel as string) === 'merc',
      ).toBe(true)
      session.commandMapper.handleKeyDown({ key: 'Escape' }, 5150)

      // Player click for trade interaction (MoveToUnit + Interact on player unit)
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 2, classId: 3, name: 'Paladin', x: 5108, y: 5096 },
      })
      const beforePlayerClick = dispatched.length
      const playerClickScreen = session.camera.subtileToScreen(5108, 5096)
      session.commandMapper.handlePointerDown(playerClickScreen.x, playerClickScreen.y, 0, 5200)
      session.commandMapper.handlePointerUp(0)
      const playerClickCmds = dispatched.slice(beforePlayerClick)
      expect(
        playerClickCmds.some(
          (c) => c.type === 'MoveToUnit' && c.target.unitType === 0 && c.target.id === 2,
        ),
      ).toBe(true)
      expect(
        playerClickCmds.some(
          (c) => c.type === 'Interact' && c.target.unitType === 0 && c.target.id === 2,
        ),
      ).toBe(true)

      session.destroy()
    })
  })

  describe('OnlineSession (F16, F18, F20)', () => {
    it('orchestrates D2OnlineFlow login -> character select -> game entry, server reconciliation, .d2cap replay, and graceful disconnect', async () => {
      const eventCallbacks: ((ev: ServerEvent) => void)[] = []
      const closeCallbacks: ((reason: CloseReason) => void)[] = []
      const sentAdapterCommands: ClientCommand[] = []

      const mockAdapter: GameServerAdapter = {
        state: 'ingame',
        stats: {
          rttMs: 18,
          bytesIn: 1024,
          bytesOut: 256,
          packetsIn: 20,
          packetsOut: 5,
          unknownPackets: 0,
          opaquePackets: 0,
          protocolErrors: 0,
        },
        onEvent(cb) {
          eventCallbacks.push(cb)
          return () => {}
        },
        onClose(cb) {
          closeCallbacks.push(cb)
          return () => {}
        },
        send(cmd) {
          sentAdapterCommands.push(cmd)
        },
        leave: vi.fn(),
      }

      let flowState: D2OnlineState = 'idle'
      const mockChars = [
        {
          name: 'webbottwo',
          charClass: 1 as const,
          classId: 1 as const,
          level: 85,
          hardcore: false,
          expansion: true,
          ladder: true,
          dead: false,
          act: 1,
          difficulty: 0 as const,
          expiresAt: 0,
          equipmentGraphics: new Uint8Array(9),
          rawStatString: new Uint8Array(33),
        },
      ]
      const mockFlow: D2OnlineFlow = {
        get state() {
          return flowState
        },
        sessionLost: null,
        onState: vi.fn(() => () => {}),
        onSessionLost: vi.fn(() => () => {}),
        connectBnet: vi.fn(async () => {}),
        connect: vi.fn(async () => {}),
        login: vi.fn(async () => {
          flowState = 'authenticated'
        }),
        loginOrRegister: vi.fn(async () => {
          flowState = 'authenticated'
        }),
        createAccount: vi.fn(async () => {}),
        listRealms: vi.fn(async () => [{ id: 1, title: 'D2Realm', description: 'PvPGN Realm' }]),
        enterRealm: vi.fn(async () => {
          flowState = 'realm_ready'
          return mockChars
        }),
        realmLogon: vi.fn(async () => mockChars),
        listCharacters: vi.fn(async () => mockChars),
        listChars: vi.fn(async () => mockChars),
        createCharacter: vi.fn(async () => {}),
        createChar: vi.fn(async () => {}),
        deleteCharacter: vi.fn(async () => {}),
        deleteChar: vi.fn(async () => {}),
        upgradeCharacter: vi.fn(async () => {}),
        upgradeChar: vi.fn(async () => {}),
        selectCharacter: vi.fn(async () => {
          flowState = 'realm_ready'
        }),
        charLogon: vi.fn(async () => {}),
        enterChat: vi.fn(async () => {}),
        joinChannel: vi.fn(async () => {}),
        sendChannelChat: vi.fn(async () => {}),
        sendChat: vi.fn(async () => {}),
        onChannelEvent: vi.fn(() => () => {}),
        onChatEvent: vi.fn(() => () => {}),
        listGames: vi.fn(async () => [
          {
            index: 1,
            name: 'baal-01',
            description: 'walk test',
            playerCount: 1,
            status: 0,
          },
        ]),
        getGameInfo: vi.fn(async () => ({
          name: 'baal-01',
          status: 0,
          uptimeSec: 10,
          maxPlayers: 8,
          players: [],
        })),
        createGame: vi.fn(async () => {}),
        joinGame: vi.fn(async () => {
          flowState = 'ingame'
          return mockAdapter
        }),
        leaveToLobby: vi.fn(async () => {
          flowState = 'realm_ready'
        }),
        close: vi.fn(async () => {
          flowState = 'closed'
        }),
      }

      const settingsStore = createSettingsStore()
      const session = new OnlineSession({
        settingsStore,
        flowFactory: () => mockFlow,
      })

      // 1. Login & enter game
      const loginRes = await session.login({
        username: 'webbottwo',
        password: 'password123',
      })
      expect(loginRes.characters.length).toBe(1)
      expect(session.phase).toBe('lobby')

      await session.selectCharacter('webbottwo')
      const games = await session.listGames()
      expect(games.length).toBe(1)

      await session.enterGame({
        mode: 'create',
        spec: { name: 'testgame1', difficulty: 0, maxPlayers: 8 },
      })
      expect(session.phase).toBe('ingame')

      // 2. Emit authoritative events from GameServerAdapter
      for (const cb of eventCallbacks) {
        cb({ type: 'LoadAct', act: 0, mapSeed: 0xdeadbeef, areaId: 1 })
        cb({ type: 'RoomReveal', areaId: 1, tileX: 100, tileY: 100 })
        cb({
          type: 'UnitAssign',
          unit: { unitType: 0, id: 1, classId: 1, name: 'webbottwo', x: 500, y: 500 },
          isSelf: true,
        })
        // Max pools arrive as 8.8 fixed-point base attributes (0x1E) before life/mana updates (0x95, plain)
        cb({ type: 'StatSet', stat: D2StatId.MaxHp, value: 400 << 8 })
        cb({ type: 'StatSet', stat: D2StatId.MaxMana, value: 450 << 8 })
        cb({ type: 'StatSet', stat: D2StatId.MaxStamina, value: 200 << 8 })
        cb({
          type: 'LifeMana',
          life: 320,
          mana: 410,
          stamina: 190,
          at: { x: 502, y: 501 },
          vx: 0,
          vy: 0,
        })
      }

      expect(session.world.areaId).toBe(1)
      expect(session.hudManager.hp).toBe(320)
      expect(session.hudManager.mana).toBe(410)
      // 1.13c never moves the local player toward a 0x95 position (D2Client gate 0x6FADA1B0); a
      // 2-sub-tile drift needs no resync either.
      expect(session.predictor.getSnapshot().logicalX).toBe(500)
      expect(session.predictor.getSnapshot().logicalY).toBe(500)
      expect(sentAdapterCommands.some(cmd => cmd.type === 'UpdatePlayerPos')).toBe(false)

      // Step frame tick and build SceneSource snapshot
      session.tick(40, 1000)
      const frameSnap = session.sceneSource.buildFrameSnapshot()
      expect(frameSnap.levelId).toBe(1)
      expect(frameSnap.entities.unitDrawables.length).toBeGreaterThanOrEqual(1)

      // 3. Deterministic .d2cap offline replay
      const capHeader = formatD2CapHeader({
        format: 'd2cap-v1',
        createdAt: '2026-09-29T00:00:00Z',
        server: '127.0.0.1',
        account: 'webbottwo',
        character: 'webbottwo',
      })
      // 0x03 LoadAct (12B): act=1 (Act 2), seed=0x01020304, areaId=40 (Lut Gholein), objSeed=0
      const pktLoadAct = new Uint8Array([
        0x03, 0x01, 0x04, 0x03, 0x02, 0x01, 40, 0x00, 0, 0, 0, 0,
      ])
      // 0x15 ReassignPlayer (11B): unitType=0, id=1, x=620, y=640, snap=1
      const pktReassign = new Uint8Array([
        0x15, 0x00, 1, 0, 0, 0, 0x6c, 0x02, 0x80, 0x02, 1,
      ])
      const d2capText = [
        capHeader,
        formatD2CapEntry({ t: 10, conn: 'game', dir: 's2c', raw: pktLoadAct, packetId: 0x03 }),
        formatD2CapEntry({ t: 20, conn: 'game', dir: 's2c', raw: pktReassign, packetId: 0x15 }),
      ].join('\n')

      const loadedCount = session.loadD2CapReplay(d2capText)
      expect(loadedCount).toBe(2)
      expect(session.phase).toBe('replay')

      const replayedCount = session.replayAllD2Cap()
      expect(replayedCount).toBe(2)
      expect(session.world.areaId).toBe(40)
      expect(session.predictor.getSnapshot().logicalX).toBe(620)
      expect(session.predictor.getSnapshot().logicalY).toBe(640)
      expect(session.packetTap.entries.length).toBeGreaterThanOrEqual(2)

      // 4. Graceful disconnect recovery
      const disconnectReasons: string[] = []
      session.onDisconnect((r) => disconnectReasons.push(r))
      session.handleServerEvent(decodeCapturedGameS2cPacket(new Uint8Array([0x06]))) // 0x06 GameLogout
      await session.disconnect('Test server disconnect')
      expect(session.phase).toBe('disconnected')
      expect(session.disconnectReason).toBe('Test server disconnect')

      session.destroy()
    })

    it('replays all 4 live .d2cap wire captures through OnlineSession with 0 Opaque events and full 0x9C/0x9D item decoding', () => {
      const fixtureFiles = [
        'tests/fixtures/netproto/01-bncs-mcp-lobby.d2cap',
        'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap',
        'tests/fixtures/netproto/03-d2gs-items-npc-skills.d2cap',
        'tests/fixtures/netproto/04-d2gs-idle-60s.d2cap',
      ]

      for (const relPath of fixtureFiles) {
        const jsonlText = readFileSync(resolve(process.cwd(), relPath), 'utf8')
        const session = new OnlineSession({
          settingsStore: createSettingsStore(),
        })
        const events: ServerEvent[] = []
        session.onServerEvent((ev) => events.push(ev))

        const recordCount = session.loadD2CapReplay(jsonlText)
        expect(recordCount).toBeGreaterThan(100)
        const replayed = session.replayAllD2Cap()
        expect(replayed).toBe(recordCount)

        const opaqueEvents = events.filter((e) => e.type === 'Opaque')
        expect(opaqueEvents).toHaveLength(0)
        expect(events.length).toBeGreaterThan(50)

        expect(session.world.areaId).toBe(1)
        expect(session.world.self.name).toBe('WebBotOne')
        expect(session.world.containers.inventory.size).toBeGreaterThanOrEqual(2)
        expect(session.world.containers.equipment.size).toBeGreaterThanOrEqual(2)
        expect(session.world.containers.belt.size).toBeGreaterThanOrEqual(4)
        expect(session.hudManager.inventory.gridItems.length).toBeGreaterThanOrEqual(2)

        expect(session.packetTap.entries.length).toBe(recordCount)

        session.destroy()
      }
    })

    it('projects canonical 1.13c spell cast overlays, flying missiles, LevelView wall collisions, and one-shot impact explosions into SceneSource drawables (#550)', () => {
      const session = new OnlineSession({
        settingsStore: createSettingsStore(),
      })

      const walkable = new Uint8Array(200 * 200).fill(1)
      const blocked = new Uint8Array(200 * 200)
      const collisionMasks = new Uint16Array(200 * 200)
      // Block sub-tile at world (5056, 5050) -> local (56, 50) with 1.13c wall + missile barrier mask (0x0005)
      walkable[50 * 200 + 56] = 0
      blocked[50 * 200 + 56] = 1
      collisionMasks[50 * 200 + 56] = 0x0005

      session.levelView = {
        act: 0,
        areaId: 2,
        subOriginX: 5000,
        subOriginY: 5000,
        subWidth: 200,
        subHeight: 200,
        isoOriginX: 0,
        isoOriginY: 0,
        cellsX: 40,
        cellsY: 40,
        gridWidth: 200,
        blocked,
        walkable,
        collisionMasks,
        rooms: [],
        floors: [],
        shadows: [],
        walls: [],
        roofs: [],
        warps: [],
        presets: [],
      } as any

      session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId: 2 })
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 0, id: 1, classId: 1, name: 'Sorceress', x: 5050, y: 5050 },
        isSelf: true,
      })
      session.handleServerEvent({
        type: 'ActiveSkill',
        unitId: 1,
        hand: 'right',
        skill: 47, // Fire Ball
      })

      // Cast Fire Ball toward (5070, 5050); wall is at (5056, 5050)
      session.useSkillAt(5070, 5050, 'right')
      // 1.13c action-frame timing (#905): cltmissilea spawns at the cast animation's event frame
      const selfCast = session.world.units.get('player:1')?.castState
      session.world.expireCastStates(1000, selfCast?.missileFireDelayMs ?? 280)

      const snap0 = session.sceneSource.buildFrameSnapshot()
      expect(snap0.entities.overlayDrawables.some((o) => o.token === 'fire_cast_2' && o.loop === false)).toBe(true)
      const fireball0 = snap0.entities.missileDrawables.find((m) => m.missileKey === 'fireball')
      expect(fireball0).toBeDefined()
      expect(['additive', 'highlight']).toContain(fireball0?.blendMode)
      // 1.13c light records (#830): the fireball missile light (0x6fb63647: type 1, Missiles.txt Light 7,
      // RGB 255/178/64, Light Quality High only, Kill on removal) and the fire_cast_2 overlay light
      // (0x6fb1b49f–0x6fb1b4e0: type 1, overlay.bin InitRadius 1, then SetTargetRadius(Radius 9)).
      const fireballLight = snap0.entities.lightEmitters.find((e) => e.unitType === 3 && e.slot === 'unit')
      expect(fireballLight).toMatchObject({
        lightType: 1,
        radius: 7,
        red: 255,
        green: 178,
        blue: 64,
        fadeOnRemove: true,
        requiresHighQuality: true,
      })
      const castOverlay0 = snap0.entities.overlayDrawables.find((o) => o.token === 'fire_cast_2')
      const castLight = snap0.entities.lightEmitters.find(
        (e) => e.unitType === 0 && e.slot === `ov:${String(castOverlay0?.overlayId)}`,
      )
      expect(castLight).toMatchObject({ unitId: 1, lightType: 1, radius: 1, targetRadius: 9, red: 255, green: 178, blue: 64 })

      // Advance 7 ticks (280ms) -> fireball (0.9375 sub-tiles/tick) collides with blocked LevelView sub-tile at (5056, 5050)
      // and spawns one-shot explodingarrowexp
      for (let i = 1; i <= 7; i++) {
        session.tick(40, 1000 + i * 40)
      }
      const snapImpact = session.sceneSource.buildFrameSnapshot()
      expect(snapImpact.entities.missileDrawables.some((m) => m.missileKey === 'fireball')).toBe(false)
      const expDrawable = snapImpact.entities.missileDrawables.find(
        (m) => m.missileKey === 'explodingarrowexp',
      )
      expect(expDrawable).toBeDefined()
      expect(expDrawable?.loopAnim).toBe(false)

      // Advance past explosion and cast duration -> explosion removed and caster returns to neutral
      for (let i = 1; i <= 20; i++) {
        session.tick(40, 1280 + i * 40)
      }
      const snapAfter = session.sceneSource.buildFrameSnapshot()
      expect(snapAfter.entities.missileDrawables).toHaveLength(0)
      expect(snapAfter.entities.overlayDrawables).toHaveLength(0)

      // Challenge 2a & 2b: Local player state overlays (FrozenArmor=10, EnergyShield=30) propagate
      // through OnlineSession.buildRenderableUnits() AND when passing ClientUnit (UnitStateSet)
      // directly into buildSceneDrawables.
      session.handleServerEvent({
        type: 'StateSet',
        unit: { unitType: 0, id: 1 },
        state: 10, // FrozenArmor
      })
      session.handleServerEvent({
        type: 'StateSet',
        unit: { unitType: 0, id: 1 },
        state: 30, // EnergyShield
      })
      const selfRenderUnit = session
        .buildRenderableUnits()
        .find((u) => u.id === 1 && u.kind === 'player')
      expect(selfRenderUnit?.states).toEqual([10, 30])

      const snapBuffs = session.sceneSource.buildFrameSnapshot()
      expect(
        snapBuffs.entities.overlayDrawables.some((o) => o.token === 'frozenarmor' && o.loop === true),
      ).toBe(true)
      expect(
        snapBuffs.entities.overlayDrawables.some((o) => o.token === 'energyshield' && o.loop === true),
      ).toBe(true)

      // Direct ClientUnit (UnitStateSet iterable) input to buildSceneDrawables:
      const directDrawables = buildSceneDrawables(session.world.units.values(), { tick: 3 })
      expect(
        directDrawables.overlayDrawables.some((o) => o.token === 'frozenarmor' && o.loop === true),
      ).toBe(true)

      session.destroy()
    })
  })
})

