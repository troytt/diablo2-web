/**
 * Issue #2025 — Shift+Left-Click +5 batch stat & skill allocation (no +all).
 *
 * Verifies:
 * 1. CharacterSheetPanel: Shift+Left-Click on `[+]` allocates `min(5, statPoints)` via the same
 *    dispatch path as touch `[+5]` (`AddStatPoint 0x3A` with `count` in byte 2); right-click does nothing.
 * 2. SkillTreePanel: Shift+Left-Click on an allocatable skill allocates `min(5, unspent, maxLvl-cur, charLvl-reqLvl-cur+1)`
 *    without exceeding `maxlvl` (20), character level requirement, or missing prerequisites; right-click does nothing.
 * 3. End-to-end `OnlineSession` + `LocalLoopbackAdapter`:
 *    - Stat Shift+Click sends a single `AddStatPoint (0x3A)` with `count` and updates authoritative server stats.
 *    - Touch `[+5]` uses the same `allocateStat(key, count)` path with zero regression.
 *    - Skill Shift+Click paces `AddSkillPoint (0x3B)` packets across frames (>200ms) so `C2sIdenticalPacketDedupe113c`
 *      admits all points (`droppedCount === 0`), throttles overlapping rapid clicks, and leaves no rollback.
 */
import { describe, expect, it, vi } from 'vitest'
import { OnlineSession } from '../../src/client/session/online-session.ts'
import {
  CharacterSheetPanel,
  STAT_ALLOC_BUTTONS,
  STAT_BATCH5_BUTTONS,
} from '../../src/client/ui/character-sheet.ts'
import { SkillTreePanel } from '../../src/client/ui/skill-tree-panel.ts'
import { LocalLobbyProvider } from '../../src/server/loopback-adapter.ts'
import { encodeD2gsClientCommand } from '../../src/netproto/index.ts'

describe('Issue #2025 — Shift+Click +5 Stat & Skill Allocation (no +all)', () => {
  describe('CharacterSheetPanel Shift+Click & touch [+5]', () => {
    it('allocates min(5, statPoints) on Shift+Left-Click and 1 on normal Left-Click', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.attrs.statPoints = 12
      const calls: Array<{ key: string; count: number | undefined }> = []
      const str = STAT_ALLOC_BUTTONS.str

      // Normal click -> single point (1-arg callback signature preserved)
      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.handleMouseUp(str.x + 10, str.y + 10, (k, c) => calls.push({ key: k, count: c }), false)).toBe(true)
      expect(calls).toEqual([{ key: 'str', count: undefined }])

      // Shift+Left-Click -> +5
      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.handleMouseUp(str.x + 10, str.y + 10, (k, c) => calls.push({ key: k, count: c }), true)).toBe(true)
      expect(calls).toEqual([
        { key: 'str', count: undefined },
        { key: 'str', count: 5 },
      ])

      // Shift+Left-Click with < 5 remaining -> clamped to remaining (3)
      sheet.attrs.statPoints = 3
      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.handleMouseUp(str.x + 10, str.y + 10, (k, c) => calls.push({ key: k, count: c }), true)).toBe(true)
      expect(calls[2]).toEqual({ key: 'str', count: 3 })

      // Shift+Left-Click with 1 remaining -> single point
      sheet.attrs.statPoints = 1
      sheet.handleMouseDown(str.x + 10, str.y + 10)
      expect(sheet.handleMouseUp(str.x + 10, str.y + 10, (k, c) => calls.push({ key: k, count: c }), true)).toBe(true)
      expect(calls[3]).toEqual({ key: 'str', count: undefined })
    })

    it('cancels Shift+Left-Click allocation if dragged off the button before release', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.attrs.statPoints = 10
      const onAlloc = vi.fn()
      const dex = STAT_ALLOC_BUTTONS.dex

      sheet.handleMouseDown(dex.x + 10, dex.y + 10)
      expect(sheet.handleMouseUp(dex.x - 40, dex.y + 10, onAlloc, true)).toBe(false)
      expect(onAlloc).not.toHaveBeenCalled()
    })

    it('keeps touch [+5] button behavior intact through the same callback', () => {
      const sheet = new CharacterSheetPanel()
      sheet.visible = true
      sheet.touchBatchAllocEnabled = true
      sheet.attrs.statPoints = 4
      const onAlloc = vi.fn()
      const vit5 = STAT_BATCH5_BUTTONS.vit

      sheet.handleMouseDown(vit5.x + 10, vit5.y + 10)
      expect(sheet.handleMouseUp(vit5.x + 10, vit5.y + 10, onAlloc, false)).toBe(true)
      expect(onAlloc).toHaveBeenCalledTimes(1)
      expect(onAlloc).toHaveBeenCalledWith('vit', 4)
    })
  })

  describe('SkillTreePanel Shift+Click +5 clamping', () => {
    it('clamps Shift+Click allocation to min(5, unspent, maxlvl-cur, charLevel-reqLevel-cur+1)', () => {
      const tree = new SkillTreePanel('sor')
      tree.visible = true
      tree.activeTab = 0 // Fire Spells
      const fireBolt = tree.getSkillTree().find((n) => n.skillId === 36)!
      const fireBall = tree.getSkillTree().find((n) => n.skillId === 47)!
      const fbPos = SkillTreePanel.nodeScreenPos(fireBolt)
      const fballPos = SkillTreePanel.nodeScreenPos(fireBall)

      // 1. Level 10, 10 unspent, 0 hard points in Fire Bolt (reqLevel 1) -> +5
      tree.characterLevel = 10
      tree.unspentSkillPoints = 10
      const calls: Array<{ skillId: number; count: number | undefined }> = []
      tree.handleClick(fbPos.x + 10, fbPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), true)
      expect(calls[0]).toEqual({ skillId: 36, count: 5 })

      // 2. Unspent = 3 -> clamped to 3
      tree.unspentSkillPoints = 3
      tree.handleClick(fbPos.x + 10, fbPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), true)
      expect(calls[1]).toEqual({ skillId: 36, count: 3 })

      // 3. Fire Ball (reqLevel 12) without Fire Bolt prereq -> 0 calls
      tree.characterLevel = 20
      tree.unspentSkillPoints = 10
      tree.handleClick(fballPos.x + 10, fballPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), true)
      expect(calls).toHaveLength(2)

      // 4. Fire Ball with Fire Bolt = 1 at level 14 -> only levels 12, 13, 14 satisfy reqLevel+cur -> 3 points
      tree.hardPoints.set(36, 1)
      tree.characterLevel = 14
      tree.unspentSkillPoints = 10
      tree.handleClick(fballPos.x + 10, fballPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), true)
      expect(calls[2]).toEqual({ skillId: 47, count: 3 })

      // 5. Level 50, hardPoints = 18 -> capped at maxlvl 20 -> 2 points
      tree.characterLevel = 50
      tree.hardPoints.set(36, 18)
      tree.handleClick(fbPos.x + 10, fbPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), true)
      expect(calls[3]).toEqual({ skillId: 36, count: 2 })

      // 6. Normal click (shiftKey = false) -> 1 point
      tree.hardPoints.set(36, 0)
      tree.handleClick(fbPos.x + 10, fbPos.y + 10, (id, c) => calls.push({ skillId: id, count: c }), false)
      expect(calls[4]).toEqual({ skillId: 36, count: undefined })
    })
  })

  describe('OnlineSession E2E (desktop Shift+Click, touch [+5], and paced 0x3B queue)', () => {
    async function createLocalSorceressSession() {
      const lobby = new LocalLobbyProvider()
      await lobby.createCharacter({ name: 'ShiftHero', classId: 1 }) // Sorceress
      const session = new OnlineSession()
      const adapter = await lobby.enterGame({ charName: 'ShiftHero', difficulty: 0 })
      const characters = await lobby.listCharacters()
      session.attachGameServer(adapter, {
        localCharacter: {
          characters,
          selectedName: 'ShiftHero',
          writeProgression: (name, progression) => lobby.writeCharacterProgression(name, progression),
        },
      })
      session.tick(40, 1000)

      // Grant level + stat/skill points on the authoritative server
      const gameHost = adapter.game as any
      const player = Array.from(gameHost.players.values())[0] as any
      player.level = 15
      player.statPts = 12
      player.newSkills = 10
      gameHost.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 12, value: 15 })
      gameHost.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 4, value: 12 })
      gameHost.emitToPlayer(player.unitId, { type: 'UnitStatUpdate', unitType: 'player', unitId: player.unitId, statId: 5, value: 10 })
      session.tick(40, 1040)

      return { session, player }
    }

    it('allocates +5 stats on Shift+Left-Click via 0x3A count, ignores right-click, and preserves touch [+5]', async () => {
      const { session, player } = await createLocalSorceressSession()
      try {
        const hud = session.hudManager
        hud.openLeftPanel('char')
        const baseStr = player.strength
        const strBtn = STAT_ALLOC_BUTTONS.str
        const dock = hud.getDockingLayout()
        const panelY = dock.panelOffsetY ?? 0
        const sx = dock.leftDockX + strBtn.x + 10
        const sy = panelY + strBtn.y + 10

        // Right-click must NOT allocate or trigger +all
        hud.handleClick(sx, sy, 2, { shiftKey: true })
        hud.handleHudMouseUp(sx, sy, 2, true)
        session.tick(40, 1080)
        expect(player.strength).toBe(baseStr)
        expect(player.statPts).toBe(12)

        // Desktop Shift+Left-Click -> single 0x3A packet with count = 5
        hud.handleClick(sx, sy, 0, { shiftKey: true })
        hud.handleHudMouseUp(sx, sy, 0, true)
        session.tick(40, 1120)

        expect(player.strength).toBe(baseStr + 5)
        expect(player.statPts).toBe(7)
        expect(hud.charSheet.attrs.str).toBe(baseStr + 5)
        expect(hud.charSheet.attrs.statPoints).toBe(7)

        const outboundLog = (session as any).outboundCommandsLog as Array<{ type: string; statId?: number; count?: number }>
        const statCmd = outboundLog.find((c) => c.type === 'AddStatPoint')
        expect(statCmd).toEqual({ type: 'AddStatPoint', statId: 0, count: 5 })
        const wirePkt = encodeD2gsClientCommand(statCmd as any)[0]!
        expect(Array.from(wirePkt)).toEqual([0x3a, 0x00, 4])

        // Touch [+5] uses the exact same dispatch path (7 -> 2)
        hud.charSheet.touchBatchAllocEnabled = true
        const b5 = STAT_BATCH5_BUTTONS.str
        const b5x = dock.leftDockX + b5.x + 10
        const b5y = panelY + b5.y + 10
        hud.handleClick(b5x, b5y, 0)
        hud.handleHudMouseUp(b5x, b5y, 0, false)
        session.tick(40, 1160)
        expect(player.strength).toBe(baseStr + 10)
        expect(player.statPts).toBe(2)

        // Shift+Left-Click with only 2 remaining -> allocates remaining 2 (2 -> 0)
        hud.handleClick(sx, sy, 0, { shiftKey: true })
        hud.handleHudMouseUp(sx, sy, 0, true)
        session.tick(40, 1200)
        expect(player.strength).toBe(baseStr + 12)
        expect(player.statPts).toBe(0)
      } finally {
        session.leaveGame()
      }
    })

    it('paces Shift+Left-Click +5 skill allocation across frames (>200ms) with zero dedupe drops and throttles rapid re-clicks', async () => {
      const { session, player } = await createLocalSorceressSession()
      try {
        const hud = session.hudManager
        if (hud.rightPanel !== 'skill') hud.toggleRightPanel('skill')
        hud.skillTree.activeTab = 0 // Fire Spells
        const fireBolt = hud.skillTree.getSkillTree().find((n) => n.skillId === 36)!
        const fbPos = SkillTreePanel.nodeScreenPos(fireBolt)
        const dock = hud.getDockingLayout()
        const panelY = dock.panelOffsetY ?? 0
        // SkillTreePanel coordinates are relative to right panel dock (`toRightDockLocal`: x - (rightDockX - 400))
        const rx = dock.rightDockX - 400 + fbPos.x + 10
        const ry = panelY + fbPos.y + 10

        // Right-click on skill node must NOT allocate (+all is excluded)
        hud.handleClick(rx, ry, 2, { shiftKey: true })
        session.tick(40, 1080)
        expect(player.skills.get(36) ?? 0).toBe(0)
        expect(player.newSkills).toBe(10)

        // Shift+Left-Click on Fire Bolt -> queues 5 points (1 immediate + 4 paced at >=205ms intervals)
        hud.handleClick(rx, ry, 0, { shiftKey: true })
        // Duplicate rapid Shift+Left-Click immediately after -> throttled while batch is active
        hud.handleClick(rx, ry, 0, { shiftKey: true })

        // Step 25 frames of 40ms (1000ms total) so all 5 paced 0x3B packets are emitted and processed
        let t = 1080
        for (let i = 0; i < 25; i++) {
          t += 40
          session.tick(40, t)
        }

        expect(player.skills.get(36)).toBe(5)
        expect(player.newSkills).toBe(5)
        expect(hud.skillTree.getHardPoints(36)).toBe(5)
        expect(hud.skillTree.unspentSkillPoints).toBe(5)
        expect((session as any).c2sDedupe.droppedCount).toBe(0)
        const outboundLog = (session as any).outboundCommandsLog as Array<{ type: string }>
        expect(outboundLog.filter((c) => c.type === 'AddSkillPoint')).toHaveLength(5)
      } finally {
        session.leaveGame()
      }
    })
  })
})
