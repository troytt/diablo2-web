import { describe, it, expect, beforeEach } from 'vitest'
import { SkillHotkeysHud, LEFT_SKILL_BOUNDS, RIGHT_SKILL_BOUNDS } from '../src/client/ui/hotkeys.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { SKILLS_BY_ID } from '../src/common/data/skills-catalog.ts'
import { createDemoHotkeys, seedDemoHotkeys, seedDemoSkillTree } from './fixtures/hud-demo-state.ts'
import { DEMO_SORCERESS_SKILLS } from './fixtures/demo-profile-data.ts'

describe('Issue Fix: Glacial Spike (#55) and All Active Skills on Quickbar Speedbars', () => {
  let hud: SkillHotkeysHud

  beforeEach(() => {
    // Widget tests: explicitly seed the legacy Sorceress quickbar (the HUD itself starts neutral).
    hud = createDemoHotkeys()
  })

  describe('1. Sorceress Right-Click & Left-Click Quickbar includes Glacial Spike', () => {
    it('has Glacial Spike (55) in DEMO_SORCERESS_SKILLS with level 10 and authentic mana', () => {
      const entry = DEMO_SORCERESS_SKILLS.find(s => s.skillId === 55)
      expect(entry).toBeDefined()
      expect(entry!.name).toBe('Glacial Spike')
      expect(entry!.nameZh).toBe('冰尖柱')
      expect(entry!.level).toBe(10)
      expect(entry!.manaCost).toBeCloseTo(14.5, 1)
      expect(entry!.leftUsable).toBe(true)
      expect(entry!.rightUsable).toBe(true)
    })

    it('shows Glacial Spike in right-click speedbar popup cells', () => {
      const rightCells = hud.getSpeedbarSkills('right')
      const spikeCell = rightCells.find(c => c.skill.skillId === 55)
      expect(spikeCell).toBeDefined()
      expect(spikeCell!.skill.name).toBe('Glacial Spike')
      expect(spikeCell!.skill.nameZh).toBe('冰尖柱')
    })

    it('shows Glacial Spike in left-click speedbar popup cells', () => {
      const leftCells = hud.getSpeedbarSkills('left')
      const spikeCell = leftCells.find(c => c.skill.skillId === 55)
      expect(spikeCell).toBeDefined()
      expect(spikeCell!.skill.name).toBe('Glacial Spike')
    })

    it('assigns Glacial Spike to right-click slot when clicked in right speedbar', () => {
      hud.openSpeedbar('right')
      expect(hud.selectionOpen).toBe('right')

      const rightCells = hud.getSpeedbarSkills('right')
      const spikeCell = rightCells.find(c => c.skill.skillId === 55)!
      expect(spikeCell).toBeDefined()

      const handled = hud.handleClick(spikeCell.x + 10, spikeCell.y + 10)
      expect(handled).toBe(true)
      expect(hud.rightSkillId).toBe(55)
      expect(hud.selectionOpen).toBeNull()
    })

    it('assigns Glacial Spike to left-click slot when clicked in left speedbar', () => {
      hud.openSpeedbar('left')
      expect(hud.selectionOpen).toBe('left')

      const leftCells = hud.getSpeedbarSkills('left')
      const spikeCell = leftCells.find(c => c.skill.skillId === 55)!
      expect(spikeCell).toBeDefined()

      const handled = hud.handleClick(spikeCell.x + 10, spikeCell.y + 10)
      expect(handled).toBe(true)
      expect(hud.leftSkillId).toBe(55)
      expect(hud.selectionOpen).toBeNull()
    })
  })

  describe('3. HudManager Skill Tree Allocation dynamically updates Available Skills', () => {
    const mockCanvas = {
      width: 800,
      height: 600,
      style: { cursor: '' },
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => null,
    } as unknown as HTMLCanvasElement

    function createMockHud() {
      const hud = new HudManager(mockCanvas, {
        onToggleAutomap: () => {},
        onWaypointTeleport: () => {},
      })
      // Server-assigned Sorceress with the legacy demo quickbar/skill tree seeded explicitly.
      hud.setCharacterClass('sor')
      seedDemoHotkeys(hud.hotkeys)
      seedDemoSkillTree(hud.skillTree)
      return hud
    }

    it('requests skill allocation through the command sink without local mutation', () => {
      const hudManager = createMockHud()
      // Open Skill tree panel
      hudManager.rightPanel = 'skill'
      hudManager.skillTree.visible = true
      hudManager.skillTree.unspentSkillPoints = 5

      // Select lightning tab (tab 1)
      hudManager.skillTree.activeTab = 1

      // Find Nova (48) which requires level 12 and has reqskills: Static Field (42) which is already allocated in starter
      const nova = hudManager.hotkeys.availableSkills.find(s => s.skillId === 48)
      expect(nova).toBeDefined()

      // Allocate point into Nova by clicking on it
      const node = hudManager.skillTree.getSkillTree().find(n => n.skillId === 48)!
      expect(node).toBeDefined()

      // Server authority: allocation is only requested through the command sink; nothing changes locally.
      const prevPoints = hudManager.skillTree.hardPoints.get(48) ?? 0
      const requested: number[] = []
      hudManager.commandSink = { allocateSkill: (id: number) => (requested.push(id), true) } as any
      const privateMethod = (hudManager as any).handleSkillAllocated.bind(hudManager)
      privateMethod(48)

      expect(requested).toEqual([48])
      expect(hudManager.skillTree.hardPoints.get(48) ?? 0).toBe(prevPoints)
      expect(hudManager.skillTree.unspentSkillPoints).toBe(5)
    })
  })
})
