import { describe, expect, it, vi } from 'vitest'
import { decode0x58OpenUi } from '../src/netproto/d2gs/s2c/misc.js'
import { encodeC2sStaffInOrifice } from '../src/netproto/d2gs/c2s/interact.js'
import { encodeD2gsC2sCommand } from '../src/netproto/d2gs/registry.js'
import { WorldPanelsHud, isEligibleArtisanItem } from '../src/client/ui/world-panels.js'
import { HudManager } from '../src/client/ui/hud-manager.js'
import { CommandMapper } from '../src/client/input/command-mapper.js'
import { LocalMovementPredictor } from '../src/client/motion/predictor.js'
import { ClientWorld } from '../src/client/world/client-world.js'
import { HudModel } from '../src/client/ui-model/hud-model.js'
import type { ClientCommand } from '../src/netproto/domain/client-command.js'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

describe('Act 2 Quests Audit Fixes (1.13c Ground Truth)', () => {
  describe('S2C 0x58 OpenUi & C2S 0x44 StaffInOrifice', () => {
    it('decodes canonical 7-byte S2C 0x58 OpenUi with u32 unitId at pkt[1..5], u8 uiAction at pkt[5], u8 extra at pkt[6]', () => {
      // D2Client.dll 0x6fb50250: 0x58 | u32 unitId | u8 uiAction | u8 extra
      const openOrificePkt = new Uint8Array([0x58, 0x78, 0x56, 0x34, 0x12, 0x00, 0x00])
      const ev0 = decode0x58OpenUi(openOrificePkt)
      expect(ev0).toEqual({
        type: 'OpenUi',
        unitType: 2,
        unitId: 0x12345678,
        uiId: 0,
        extra: 0,
      })

      const completeOrificePkt = new Uint8Array([0x58, 0x78, 0x56, 0x34, 0x12, 0x05, 0x01])
      const ev5 = decode0x58OpenUi(completeOrificePkt)
      expect(ev5).toEqual({
        type: 'OpenUi',
        unitType: 0,
        unitId: 0x12345678,
        uiId: 5,
        extra: 1,
      })
    })

    it('encodes 17-byte C2S 0x44 StaffInOrifice matching D2Client.dll 0x6faac440 and D2Game.dll 0x6fc52be0', () => {
      const pkt = encodeC2sStaffInOrifice(0x12345678, 0x9abcdef0, 3, 0x11223344)
      expect(pkt.byteLength).toBe(17)
      const view = new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength)
      expect(view.getUint8(0)).toBe(0x44)
      expect(view.getUint32(1, true)).toBe(0x11223344)
      expect(view.getUint32(5, true)).toBe(0x12345678)
      expect(view.getUint32(9, true)).toBe(0x9abcdef0)
      expect(view.getUint32(13, true)).toBe(3)

      const viaRegistry = encodeD2gsC2sCommand({
        type: 'StaffInOrifice',
        orificeObjectId: 0x12345678,
        staffItemId: 0x9abcdef0,
        state: 3,
        playerUnitId: 0x11223344,
      })
      expect(Array.from(viaRegistry)).toEqual(Array.from(pkt))
    })
  })

  describe('A2Q2 / A2Q6 Horadric Orifice UI & Eligibility', () => {
    it('accepts only identified Horadric Staff (hst) in orifice slot (D2Client.dll 0x6faac640)', () => {
      expect(
        isEligibleArtisanItem('orifice', {
          code: 'hst',
          identified: true,
        } as any),
      ).toBe(true)
      expect(
        isEligibleArtisanItem('orifice', {
          code: 'hst',
          identified: false,
        } as any),
      ).toBe(false)
      expect(
        isEligibleArtisanItem('orifice', {
          code: 'msf',
          identified: true,
        } as any),
      ).toBe(false)
      expect(
        isEligibleArtisanItem('orifice', {
          code: 'vip',
          identified: true,
        } as any),
      ).toBe(false)
    })

    it('emits StaffInOrifice(state=3) on confirm and does not emit spurious cancel on panel close', () => {
      const world = new ClientWorld()
      const emitted: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        onCommand: (cmd: ClientCommand) => emitted.push(cmd),
      })

      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 7,
          classId: 1,
          name: 'Hero',
          x: 5000,
          y: 5000,
        },
      })

      // Server sends S2C 0x58 OpenUi(uiId=0, unitId=42)
      world.apply({
        type: 'OpenUi',
        unitType: 2,
        unitId: 42,
        uiId: 0,
        extra: 0,
      })
      expect(world.npcInteraction.window).toBe('orifice')
      expect(world.npcInteraction.npcId).toBe(42)

      // Confirm placing Horadric Staff (itemId=99) into Orifice (objectId=42)
      hudModel.confirmQuestReward(99, 42)
      // Simulate leaveLeftPanel calling closeActiveNpcPanel right after confirm
      hudModel.closeActiveNpcPanel()

      expect(emitted).toEqual([
        {
          type: 'StaffInOrifice',
          orificeObjectId: 42,
          staffItemId: 99,
          state: 3,
          playerUnitId: 7,
        },
      ])
    })

    it('emits StaffInOrifice(state=2) when cancelling orifice panel without sending 0x30 NpcCancel', () => {
      const world = new ClientWorld()
      const emitted: ClientCommand[] = []
      const hudModel = new HudModel({
        world,
        onCommand: (cmd: ClientCommand) => emitted.push(cmd),
      })

      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 7,
          classId: 1,
          name: 'Hero',
          x: 5000,
          y: 5000,
        },
      })
      world.apply({
        type: 'OpenUi',
        unitType: 2,
        unitId: 42,
        uiId: 0,
        extra: 0,
      })

      hudModel.closeActiveNpcPanel()
      expect(emitted).toEqual([
        {
          type: 'StaffInOrifice',
          orificeObjectId: 42,
          staffItemId: 0,
          state: 2,
          playerUnitId: 7,
        },
      ])
    })

    it('clicking world ground while orifice panel is open sends C2S 0x44 StaffInOrifice(state=2), returns slotted staff, and closes panel', () => {
      const selfX = 5000
      const selfY = 5000
      const orificeId = 42
      const world = new ClientWorld()
      const hud = new HudManager()
      hud.resize(1280, 720)
      const commands: ClientCommand[] = []
      let nowMs = 10_000

      const hudModel = new HudModel({
        world,
        hudManager: hud,
        onCommand: (cmd: ClientCommand) => {
          commands.push(cmd)
          world.noteOutgoingCommand(cmd, nowMs)
        },
        now: () => nowMs,
      })
      hud.commandSink = hudModel

      const predictor = new LocalMovementPredictor({ initialX: selfX, initialY: selfY })
      const walkable = new Uint8Array(128 * 128).fill(1)
      const levelView = {
        levelId: 72,
        subOriginX: selfX - 64,
        subOriginY: selfY - 64,
        subWidth: 128,
        subHeight: 128,
        walkable,
      }
      const mapper = new CommandMapper({
        world,
        hudManager: hud,
        hudModel,
        predictor,
        automapView: { getLevelView: () => levelView } as any,
        sendCommand: (cmd) => {
          commands.push(cmd)
          world.noteOutgoingCommand(cmd, nowMs)
        },
      })

      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 7, classId: 1, name: 'Hero', x: selfX, y: selfY },
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 'object', id: orificeId, classId: 152, mode: 1, x: selfX, y: selfY + 1 },
      })
      world.apply({
        type: 'OpenUi',
        unitType: 2,
        unitId: orificeId,
        uiId: 0,
        extra: 0,
      })
      hudModel.openArtisanWindow('orifice', orificeId)
      const slottedStaff = { id: '99', code: 'hst', name: 'Horadric Staff', invWidth: 1, invHeight: 4, identified: true } as any
      ;(hud.worldPanels as any).questRewardItem = slottedStaff
      expect(hud.leftPanel).toBe('orifice')
      expect(hud.rightPanel).toBe('inv')
      commands.length = 0

      nowMs += 200
      mapper.triggerPrimaryWorldAction(selfX + 6, selfY + 6, null, nowMs)

      expect(commands.filter((c) => c.type === 'StaffInOrifice')).toEqual([
        {
          type: 'StaffInOrifice',
          orificeObjectId: orificeId,
          staffItemId: 0,
          state: 2,
          playerUnitId: 7,
        },
      ])
      expect(commands.some((c) => c.type === 'Move')).toBe(true)
      expect(hud.leftPanel).toBe('none')
      expect(hud.rightPanel).toBe('none')
      expect((hud.worldPanels as any).questRewardItem).toBeNull()
      expect(hud.inventory.cursorItem).toBe(slottedStaff)
      expect(world.npcInteraction.window).toBe('none')
      expect(world.npcInteraction.npcId).toBeNull()
    })

    it('clicking the open orifice object again in melee range does not send duplicate C2S 0x13 Interact and keeps orifice panel open for confirmation', () => {
      const selfX = 5000
      const selfY = 5000
      const orificeId = 42
      const world = new ClientWorld()
      const hud = new HudManager()
      hud.resize(1280, 720)
      const commands: ClientCommand[] = []
      let nowMs = 10_000

      const hudModel = new HudModel({
        world,
        hudManager: hud,
        onCommand: (cmd: ClientCommand) => {
          commands.push(cmd)
          world.noteOutgoingCommand(cmd, nowMs)
        },
        now: () => nowMs,
      })
      hud.commandSink = hudModel

      const predictor = new LocalMovementPredictor({ initialX: selfX, initialY: selfY })
      const mapper = new CommandMapper({
        world,
        hudManager: hud,
        hudModel,
        predictor,
        sendCommand: (cmd) => {
          commands.push(cmd)
          world.noteOutgoingCommand(cmd, nowMs)
        },
      })

      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 7, classId: 1, name: 'Hero', x: selfX, y: selfY },
      })
      world.apply({
        type: 'UnitAssign',
        unit: { unitType: 'object', id: orificeId, classId: 152, mode: 1, x: selfX, y: selfY + 1 },
      })
      world.apply({
        type: 'OpenUi',
        unitType: 2,
        unitId: orificeId,
        uiId: 0,
        extra: 0,
      })
      hudModel.openArtisanWindow('orifice', orificeId)
      commands.length = 0

      const orificeUnit = world.getUnit('object', orificeId)!
      nowMs += 200
      const res = mapper.triggerPrimaryWorldAction(orificeUnit.x, orificeUnit.y, orificeUnit, nowMs)

      expect(res).toBeNull()
      expect(commands).toEqual([])
      expect(hud.leftPanel).toBe('orifice')
      expect(world.npcInteraction.window).toBe('orifice')
      expect(world.npcInteraction.npcId).toBe(orificeId)

      // Subsequent checkmark confirmation still emits StaffInOrifice(state = 3)
      hudModel.confirmQuestReward(99, orificeId)
      expect(commands).toEqual([
        {
          type: 'StaffInOrifice',
          orificeObjectId: orificeId,
          staffItemId: 99,
          state: 3,
          playerUnitId: 7,
        },
      ])
    })
  })

  describe('A2Q2 Horadric Scroll (tr1) Recipe Scroll UI', () => {
    it('opens recipescroll with a2q2scroll text and dispatches ItemUse when right-clicking tr1', () => {
      const world = new ClientWorld()
      const emitted: ClientCommand[] = []

      const worldPanels = new WorldPanelsHud()
      let leftPanel = 'none'
      const mockHudManager = {
        worldPanels,
        leftPanel: 'none',
        rightPanel: 'inv',
        inventory: { visible: true, cursorItem: null },
        skillsPanel: { visible: false },
        setLeftPanel: vi.fn((panel: string) => {
          leftPanel = panel
          mockHudManager.leftPanel = panel
        }),
      } as any

      const hudModel = new HudModel({
        world,
        onCommand: (cmd: ClientCommand) => emitted.push(cmd),
      })

      world.apply({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1,
          name: 'Hero',
          x: 5100,
          y: 5200,
        },
      })
      ;(world.containers.inventory as Map<number, any>).set(501, {
        id: 501,
        code: 'tr1',
        name: 'Horadric Scroll',
        baseName: 'Horadric Scroll',
        quality: 'normal',
        identified: true,
        gridX: 0,
        gridY: 0,
        gridW: 2,
        gridH: 2,
        container: 'inventory',
      })

      hudModel.hudManager = mockHudManager
      hudModel.useItem(501)

      expect(leftPanel).toBe('recipescroll')
      expect((worldPanels.recipeScrollText ?? '').length).toBeGreaterThan(10)
      expect(emitted).toEqual([
        {
          type: 'ItemUse',
          itemId: 501,
          at: { x: 5100, y: 5200 },
        },
      ])

      // Close button follows 1.13c semantics (issue #927): mouse-down latches the
      // depressed X, the close fires on mouse-up landing back on the button.
      let closed = false
      const hit = worldPanels.handleLeftDockClick(
        'recipescroll',
        240,
        440,
        {
          onClose: () => {
            closed = true
          },
        },
      )
      expect(hit).toBe(true)
      expect(closed).toBe(false)
      expect(worldPanels.hasPendingCloseRelease()).toBe(true)
      worldPanels.releaseCloseButton(240, 440, 240, 440)
      expect(closed).toBe(true)
    })
  })

  describe("A2Q5 Horazon's Journal (Object 357) S2C 0x27 -> C2S 0x31 QuestMessage", () => {
    it('dispatches QuestMessage(0xffffffff, 398) when closing object scroll with stringId 398 (AD2Q4a)', () => {
      const world = new ClientWorld()
      const emitted: ClientCommand[] = []

      const worldPanels = new WorldPanelsHud()
      const mockHudManager = {
        worldPanels,
        leftPanel: 'none',
        rightPanel: 'none',
        inventory: { visible: false, cursorItem: null },
        skillsPanel: { visible: false },
        setLeftPanel: vi.fn((p: string) => {
          mockHudManager.leftPanel = p
        }),
        closeAllPanels: vi.fn(),
        syncPublishedState: vi.fn(),
      } as any

      const hudModel = new HudModel({
        world,
        onCommand: (cmd: ClientCommand) => emitted.push(cmd),
      })

      // Object 357 (Horazon's Journal) exists in world
      world.apply({
        type: 'UnitAssign',
        unit: {
          unitType: 'object',
          id: 777,
          classId: 357,
          x: 5000,
          y: 5000,
        },
      })

      // Server sends S2C 0x27 NpcInfo for object 777 with stringId 398 ("AD2Q4a")
      world.apply({
        type: 'NpcInfo',
        kind: 'info',
        unitType: 2,
        npcId: 777,
        count: 1,
        messages: [{ stringId: 398, menu: 0 }],
      } as any)

      hudModel.hudManager = mockHudManager
      ;(hudModel as any).syncNpcInteraction(mockHudManager)
      expect(worldPanels.npcSpeech).not.toBeNull()
      expect(worldPanels.npcSpeech?.onClose).toBeTypeOf('function')

      // Closing the Horazon's Journal scroll must send 0x31 QuestMessage(0xffffffff, 398)
      worldPanels.npcSpeech?.onClose?.()
      expect(emitted).toContainEqual({
        type: 'QuestMessage',
        npcId: 0xffffffff,
        messageId: 398,
      })
    })
  })

  describe('A2Q6 Tal Rasha True Tomb Symbol (invps.dc6 tombOffset)', () => {
    it('propagates tombOffset from S2C 0x50 QuestState(item, type=1) into WorldPanelsHud', () => {
      const world = new ClientWorld()
      const worldPanels = new WorldPanelsHud()

      // S2C 0x50 QuestItemInfo: words = [1, den, tombOffset, barbs, 0, 0, 0]
      world.apply({
        type: 'QuestState',
        kind: 'item',
        source: 0x50,
        quests: [1, 0, 5, 0, 0, 0, 0],
      } as any)

      expect(world.questLog.tombOffset).toBe(5)
      worldPanels.applyServerQuestState({
        quests: world.quests,
        gameQuests: world.gameQuests,
        questStatusBytes: world.questStatusBytes,
        denMonstersRemaining: world.denMonstersRemaining,
        questBarbsRemaining: world.questBarbsRemaining,
        tombOffset: world.questLog.tombOffset,
      })
      expect(worldPanels.tombOffset).toBe(5)
    })
  })
})
