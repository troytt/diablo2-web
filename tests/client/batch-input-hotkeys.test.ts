import { describe, expect, it, vi } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { INV_GRID_ORIGIN, type UiInventoryItem } from '../../src/client/ui/inventory.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  SKILLS_META,
  canUseSkillInMorphState,
  canUseSkillWithWeapon,
} from '../../src/common/skills/skills-meta.ts'
import {
  encodeC2sAssignSkillHotkey,
  encodeC2sBeltUse,
  encodeC2sItemToBelt,
  encodeC2sRunToggle,
  encodeC2sSay,
  encodeD2gsClientCommand,
  type ClientCommand,
} from '../../src/netproto/index.ts'

function createHarness(startX = 5000, startY = 5000, areaId = 2) {
  const world = new ClientWorld()
  const hudManager = new HudManager()
  const sentCommands: ClientCommand[] = []
  const playedSounds: number[] = []
  hudManager.onPlayUiSound = (soundId) => {
    playedSounds.push(soundId)
  }
  const hudModel = new HudModel({
    world,
    hudManager,
    onCommand: (cmd) => sentCommands.push(cmd),
    playUiSound: (soundId) => playedSounds.push(soundId),
  })
  const predictor = new LocalMovementPredictor()
  predictor.setPosition(startX, startY)
  const rateLimiter = new OutboundRateLimiter({ moveMinIntervalMs: 0, skillMinIntervalMs: 0 })

  world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x11223344, areaId })
  world.apply({
    type: 'PlayerAssign',
    unitId: 1,
    classId: 1, // Sorceress
    name: 'Hero',
    x: startX,
    y: startY,
  })

  const mapper = new CommandMapper({
    world,
    hudManager,
    hudModel,
    predictor,
    rateLimiter,
    sendCommand: (cmd) => sentCommands.push(cmd),
  })

  return { world, hudManager, hudModel, predictor, mapper, sentCommands, playedSounds }
}

describe('Batch Input & Hotkeys (#1251, #1254, #1255, #1256, #1257, #1258)', () => {
  describe('#1251: Morph state skill restriction gate (Skills.txt restrict + State1..State3)', () => {
    it('populates canonical 1.13c restrict and state1..state3 metadata on SKILLS_META', () => {
      expect(SKILLS_META[0]).toMatchObject({ restrict: 1 }) // Attack
      expect(SKILLS_META[223]).toMatchObject({ restrict: 1, state1: 'wolf' }) // Werewolf
      expect(SKILLS_META[228]).toMatchObject({ restrict: 1, state1: 'bear' }) // Werebear
      expect(SKILLS_META[229]).toMatchObject({ restrict: 0 }) // Molten Boulder
      expect(SKILLS_META[232]).toMatchObject({ restrict: 2, state1: 'wolf' }) // Feral Rage
      expect(SKILLS_META[238]).toMatchObject({ restrict: 2, state1: 'wolf' }) // Rabies
      expect(SKILLS_META[239]).toMatchObject({
        restrict: 2,
        state1: 'wolf',
        state2: 'bear',
      }) // Fire Claws
      expect(SKILLS_META[243]).toMatchObject({ restrict: 2, state1: 'bear' }) // Shock Wave
      expect(SKILLS_META[249]).toMatchObject({
        restrict: 1,
        state1: 'wolf',
        state2: 'bear',
      }) // Armageddon
    })

    it('enforces restrict=0/1/2 across human, werewolf (139), werebear (140), and delirium (177)', () => {
      const human = new Set<number>()
      const werewolf = new Set<number>([139])
      const werebear = new Set<number>([140])
      const delirium = new Set<number>([177])

      // Attack (0): restrict=1, no state1..3 -> usable in all morph states
      expect(canUseSkillInMorphState(0, human)).toBe(true)
      expect(canUseSkillInMorphState(0, werewolf)).toBe(true)
      expect(canUseSkillInMorphState(0, werebear)).toBe(true)
      expect(canUseSkillInMorphState(0, delirium)).toBe(true)

      // Teleport (54) / Molten Boulder (229): restrict=0 -> human only
      expect(canUseSkillInMorphState(54, human)).toBe(true)
      expect(canUseSkillInMorphState(54, werewolf)).toBe(false)
      expect(canUseSkillInMorphState(229, werebear)).toBe(false)
      expect(canUseSkillInMorphState(229, delirium)).toBe(false)

      // Armageddon (249): restrict=1 + wolf/bear -> allow in human AND wolf/bear, block in delirium
      expect(canUseSkillInMorphState(249, human)).toBe(true)
      expect(canUseSkillInMorphState(249, werewolf)).toBe(true)
      expect(canUseSkillInMorphState(249, werebear)).toBe(true)
      expect(canUseSkillInMorphState(249, delirium)).toBe(false)

      // Rabies (238): restrict=2 + state1=wolf -> requires werewolf (139)
      expect(canUseSkillInMorphState(238, human)).toBe(false)
      expect(canUseSkillInMorphState(238, werewolf)).toBe(true)
      expect(canUseSkillInMorphState(238, werebear)).toBe(false)

      // Shock Wave (243): restrict=2 + state1=bear -> requires werebear (140)
      expect(canUseSkillInMorphState(243, human)).toBe(false)
      expect(canUseSkillInMorphState(243, werewolf)).toBe(false)
      expect(canUseSkillInMorphState(243, werebear)).toBe(true)

      // Fire Claws (239): restrict=2 + wolf/bear -> werewolf or werebear required; human & delirium blocked
      expect(canUseSkillInMorphState(239, human)).toBe(false)
      expect(canUseSkillWithWeapon(239, undefined, werewolf)).toBe(true)
      expect(canUseSkillWithWeapon(239, undefined, werebear)).toBe(true)
      expect(canUseSkillWithWeapon(239, undefined, delirium)).toBe(false)
    })

    it('blocks casting morph-restricted skills in CommandMapper and marks them red in SkillHotkeysHud', () => {
      const { world, hudManager, hudModel, mapper, sentCommands } = createHarness()
      world.self.rightSkill = 54 // Teleport (restrict=0)
      ;(world.self.states as Set<number>).add(139) // Werewolf
      hudModel.syncFromWorld()

      expect(hudManager.hotkeys.isSkillWeaponUsable(54)).toBe(false)
      expect(
        mapper.fromMouseDown({ button: 'right', worldX: 5010, worldY: 5010 }),
      ).toBeNull()
      expect(mapper.triggerSecondaryWorldAction(5010, 5010, null, 1000)).toBeNull()
      expect(sentCommands).toHaveLength(0)

      // Armageddon (249) is allowed in Werewolf (139)
      world.self.rightSkill = 249
      hudModel.syncFromWorld()
      expect(hudManager.hotkeys.isSkillWeaponUsable(249)).toBe(true)
      expect(
        mapper.fromMouseDown({ button: 'right', worldX: 5010, worldY: 5010 }),
      ).toMatchObject({ type: 'SkillAt', hand: 'right' })
    })
  })

  describe('#1254: Keydown deduplication & T vs S separation', () => {
    it('prevents double-toggling when the same KeyboardEvent reaches both CommandMapper and HudManager', () => {
      const { hudManager, mapper } = createHarness()
      const ev: { key: string; preventDefault: () => void; _d2KeyHandled?: boolean } = {
        key: 'i',
        preventDefault: () => {},
      }
      expect(hudManager.rightPanel).toBe('none')
      expect(mapper.handleKeyDown(ev, 1000)).toBe(true)
      expect(hudManager.rightPanel).toBe('inv')

      // Bubble listener on HudManager receives the same event object: must be a no-op
      hudManager.handleKeyDown(ev)
      expect(hudManager.rightPanel).toBe('inv')
    })

    it('separates T (Skill Tree panel only) from S (Speedbar skill popup only)', () => {
      const { hudManager } = createHarness()
      hudManager.handleKeyDown({ key: 't', preventDefault: () => {} })
      expect(hudManager.rightPanel).toBe('skill')
      expect(hudManager.hotkeys.openPopup).toBeNull()

      hudManager.handleKeyDown({ key: 's', preventDefault: () => {} })
      expect(hudManager.hotkeys.openPopup).toBe('right')
    })
  })

  describe('#1255: Mercenary potion feeding (Shift + 1..4 / Shift + Right-Click belt slot)', () => {
    it('rejects Shift+BeltUse when mercenary is missing or dead without emitting BeltUse', () => {
      const { world, hudModel, mapper, sentCommands } = createHarness()
      ;(world.containers.belt as Map<number, any>).set(0, {
        id: 101,
        code: 'hp1',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      })
      hudModel.syncFromWorld()

      mapper.handleKeyDown({ key: '!', code: 'Digit1', shiftKey: true, preventDefault: () => {} })
      expect(sentCommands).toHaveLength(0)
    })

    it('rejects feeding mana potions to a mercenary and plays merc cantuse sound (4612 / 4616)', () => {
      const { world, hudModel, mapper, sentCommands, playedSounds } = createHarness()
      world.apply({
        type: 'Merc',
        kind: 'assign',
        mercId: 50,
        ownerId: 1,
        classId: 271, // Rogue Scout
        nameId: 1,
      })
      ;(world.containers.belt as Map<number, any>).set(0, {
        id: 102,
        code: 'mp1',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      })
      hudModel.syncFromWorld()

      mapper.handleKeyDown({ key: '!', code: 'Digit1', shiftKey: true, preventDefault: () => {} })
      expect(sentCommands).toHaveLength(0)
      expect(playedSounds).toContain(4612)
    })

    it('plays mercenary thanks voice line (4615 / 4625) and sends BeltUse with useOnMerc=1 when feeding a healing potion', () => {
      const { world, hudModel, mapper, sentCommands, playedSounds } = createHarness()
      world.apply({
        type: 'Merc',
        kind: 'assign',
        mercId: 50,
        ownerId: 1,
        classId: 338, // Act 2 Guard
        nameId: 1,
      })
      ;(world.containers.belt as Map<number, any>).set(0, {
        id: 103,
        code: 'hp1',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      })
      hudModel.syncFromWorld()

      mapper.handleKeyDown({ key: '!', code: 'Digit1', shiftKey: true, preventDefault: () => {} })
      expect(sentCommands).toEqual([{ type: 'BeltUse', itemId: 103, useOnMerc: 1 }])
      expect(playedSounds).toContain(4625)
      expect(Array.from(encodeC2sBeltUse(103, true))).toEqual([
        0x26,
        103,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ])
    })

    it('plays Rogue Scout thanks voice line (4615) when Rogue merc is fed a rejuvenation potion', () => {
      const { world, hudModel, mapper, sentCommands, playedSounds } = createHarness()
      world.apply({
        type: 'Merc',
        kind: 'assign',
        mercId: 50,
        ownerId: 1,
        classId: 271,
        nameId: 1,
      })
      ;(world.containers.belt as Map<number, any>).set(0, {
        id: 104,
        code: 'rvs',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      })
      hudModel.syncFromWorld()

      mapper.handleKeyDown({ key: '!', code: 'Digit1', shiftKey: true, preventDefault: () => {} })
      expect(sentCommands).toEqual([{ type: 'BeltUse', itemId: 104, useOnMerc: 1 }])
      expect(playedSounds).toContain(4615)
    })
  })

  describe('#1256: Missing 1.13c keyboard bindings (V, ~/`, Z, H, N, Space, Enter, F9..F12, Home, Ctrl, Numpad 0..7)', () => {
    it('routes V to MiniMap toggle and ~/backtick to Belt popup toggle', () => {
      const { hudManager } = createHarness()
      const toggleMiniMap = vi.fn()
      ;(hudManager as any).onToggleAutomapMode = toggleMiniMap

      hudManager.handleKeyDown({ key: 'v', preventDefault: () => {} })
      expect(toggleMiniMap).toHaveBeenCalledTimes(1)
      expect(hudManager.belt.lockedOpen).toBe(false)

      hudManager.handleKeyDown({ key: '~', preventDefault: () => {} })
      expect(hudManager.belt.lockedOpen).toBe(true)
    })

    it('routes Z to party portrait toggle, H to help overlay toggle, N to clear chat overlay, and Space to close panels + center automap', () => {
      const { hudManager } = createHarness()
      const centerAutomap = vi.fn()
      ;(hudManager as any).onAutomapCenter = centerAutomap
      hudManager.chatOverlayMessages = [{ text: 'Hello', color: 0 }]

      expect(hudManager.showPartyPortraits).toBe(true)
      hudManager.handleKeyDown({ key: 'z', preventDefault: () => {} })
      expect(hudManager.showPartyPortraits).toBe(false)

      expect(hudManager.helpOverlayOpen).toBe(false)
      hudManager.handleKeyDown({ key: 'h', preventDefault: () => {} })
      expect(hudManager.helpOverlayOpen).toBe(true)

      hudManager.handleKeyDown({ key: 'n', preventDefault: () => {} })
      expect(hudManager.chatOverlayMessages).toHaveLength(0)

      hudManager.toggleRightPanel('inv')
      expect(hudManager.rightPanel).toBe('inv')
      hudManager.handleKeyDown({ key: ' ', code: 'Space', preventDefault: () => {} })
      expect(hudManager.rightPanel).toBe('none')
      expect(centerAutomap).toHaveBeenCalledTimes(1)
    })

    it('emits C2S 0x53/0x54 on Control momentary run hold and C2S 0x3F Say (25..32) on Numpad 0..7 with 1000ms debounce', () => {
      const { hudModel, mapper, sentCommands } = createHarness()
      hudModel.toggleRunWalk() // switch to walk mode (isRunMode = false)
      expect(hudModel.isRunMode).toBe(false)

      mapper.handleKeyDown({ key: 'Control', code: 'ControlLeft' }, 1000)
      expect(sentCommands).toEqual([{ type: 'RunToggle', run: true }])
      expect(Array.from(encodeC2sRunToggle(true))).toEqual([0x53])

      mapper.handleKeyUp({ key: 'Control', code: 'ControlLeft' }, 1100)
      expect(sentCommands).toEqual([
        { type: 'RunToggle', run: true },
        { type: 'RunToggle', run: false },
      ])
      expect(Array.from(encodeC2sRunToggle(false))).toEqual([0x54])

      sentCommands.length = 0
      mapper.handleKeyDown({ key: '0', code: 'Numpad0', preventDefault: () => {} }, 2000)
      mapper.handleKeyDown({ key: '1', code: 'Numpad1', preventDefault: () => {} }, 2500) // debounced (<1000ms)
      mapper.handleKeyDown({ key: '7', code: 'Numpad7', preventDefault: () => {} }, 3100) // allowed (>=1000ms)
      expect(sentCommands).toEqual([
        { type: 'Say', phraseId: 25 },
        { type: 'Say', phraseId: 32 },
      ])
      expect(Array.from(encodeC2sSay(25))).toEqual([0x3f, 25, 0x00])
    })
  })

  describe('#1257: Shift + Left-Click item quick-transfer (Inventory <-> Belt / Stash / Cube)', () => {
    it('encodes C2S 0x63 ItemToBelt as 5-byte [0x63, itemId:u32 LE] and dispatches autoBeltItem on Shift+Left-Click potion', () => {
      expect(Array.from(encodeC2sItemToBelt(0x11223344))).toEqual([0x63, 0x44, 0x33, 0x22, 0x11])

      const { hudManager, sentCommands, playedSounds } = createHarness()
      hudManager.toggleRightPanel('inv')
      const potion: UiInventoryItem = {
        id: '201',
        invFile: 'invhp1',
        code: 'hp1',
        name: 'Minor Healing Potion',
        nameZh: '',
        baseNameZh: '',
        quality: 'normal',
        identified: true,
        invWidth: 1,
        invHeight: 1,
        allowedSlots: [],
        stats: [],
      }
      hudManager.inventory.gridItems.push({ item: potion, col: 0, row: 0 })

      const clickX = INV_GRID_ORIGIN.x + 10
      const clickY = INV_GRID_ORIGIN.y + 10
      hudManager.handleClick(clickX, clickY, 0, { shiftKey: true })

      expect(sentCommands).toEqual([{ type: 'ItemToBelt', itemId: 201 }])
      expect(playedSounds).toContain(235)
    })

    it('quick-transfers inventory item to Stash (buffer 4) or Cube (buffer 3) on Shift+Left-Click when open', () => {
      const { hudManager, sentCommands } = createHarness()
      hudManager.toggleRightPanel('inv')
      hudManager.leftPanel = 'stash'
      const charm: UiInventoryItem = {
        id: '301',
        invFile: 'invcm1',
        code: 'cm1',
        name: 'Small Charm',
        nameZh: '',
        baseNameZh: '',
        quality: 'magic',
        identified: true,
        invWidth: 1,
        invHeight: 1,
        allowedSlots: [],
        stats: [],
      }
      hudManager.inventory.gridItems.push({ item: charm, col: 0, row: 0 })

      const clickX = INV_GRID_ORIGIN.x + 10
      const clickY = INV_GRID_ORIGIN.y + 10
      hudManager.handleClick(clickX, clickY, 0, { shiftKey: true })

      expect(sentCommands).toEqual([
        { type: 'ItemToCursor', itemId: 301 },
        { type: 'ItemPlace', itemId: 301, x: 0, y: 0, buffer: 4 },
      ])
    })
  })

  describe('#1258: Skill hotkey assignment (C2S 0x51), deduplication (0x6faed360), and mouse-wheel cycling (0x6faed6d0)', () => {
    it('encodes C2S 0x51 AssignSkillHotkey with hand bit 0x8000 and deduplicates previous slot for the same skill', () => {
      const encodedLeft = encodeC2sAssignSkillHotkey(0, 'left', 54, 0xffffffff)
      expect(Array.from(encodedLeft)).toEqual([
        0x51,
        54,
        0x80,
        0x00,
        0x00,
        0xff,
        0xff,
        0xff,
        0xff,
      ])

      const { world, hudManager, mapper, sentCommands } = createHarness()
      hudManager.hotkeys.openPopup = 'right'
      hudManager.hotkeys.hoveredPopupSkill = { side: 'right', skillId: 59 }

      mapper.handleKeyDown({ key: 'F1', preventDefault: () => {} }, 1000)
      expect(sentCommands).toEqual([
        { type: 'AssignSkillHotkey', slot: 0, hand: 'right', skill: 59, itemId: 0xffffffff },
      ])
      expect(world.skillHotkeys.get(0)).toEqual({
        hand: 'right',
        skill: 59,
        itemId: 0xffffffff,
      })

      // Rebinding the same (hand='right', skill=59) to F2 clears F1 (slot 0)
      sentCommands.length = 0
      hudManager.hotkeys.openPopup = 'right'
      hudManager.hotkeys.hoveredPopupSkill = { side: 'right', skillId: 59 }
      mapper.handleKeyDown({ key: 'F2', preventDefault: () => {} }, 1100)
      expect(hudManager.hotkeys.bindings.has('F1')).toBe(false)
      expect(hudManager.hotkeys.bindings.get('F2')).toEqual({ side: 'right', skillId: 59 })
      expect(world.skillHotkeys.has(0)).toBe(false)
      expect(world.skillHotkeys.get(1)).toEqual({
        hand: 'right',
        skill: 59,
        itemId: 0xffffffff,
      })
    })

    it('cycles bound skill hotkeys on mouse wheel up/down (0x6faed6d0) and emits SelectSkill (0x3C)', () => {
      const { world, hudManager, hudModel, sentCommands } = createHarness()
      hudModel.assignSkillHotkey(0, 'right', 47, 0xffffffff) // F1 -> Fire Ball (47)
      hudModel.assignSkillHotkey(2, 'right', 59, 0xffffffff) // F3 -> Frozen Orb (59)
      world.self.rightSkill = 47
      sentCommands.length = 0

      // Wheel down (+1) cycles from slot 0 (47) -> slot 2 (59)
      expect(hudManager.handleWheel(100)).toBe(true)
      expect(sentCommands).toEqual([
        { type: 'SelectSkill', hand: 'right', skill: 59, itemId: 0xffffffff },
      ])
      expect(Array.from(encodeD2gsClientCommand(sentCommands[0]!)[0]!)).toEqual([
        0x3c,
        59,
        0x00,
        0x00,
        0x00,
        0xff,
        0xff,
        0xff,
        0xff,
      ])
    })
  })
})
