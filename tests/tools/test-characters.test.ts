import { describe, expect, it } from 'vitest'
import { LocalLobbyProvider, readD2s, type LocalLoopbackAdapter } from '../../src/server/index.ts'
import { QUEST_FLAG_REWARD_PENDING_113C, questWordIndex113c } from '../../src/server/engine/quests-113c.ts'
import { characterBuild, describeBuild } from '../../src/common/items/character-build.ts'
import { CHARACTER_CLASS_NAMES } from '../../src/common/units/classes.ts'
import { TEST_CHARACTERS, testCharacterSaves } from '../../tools/test-characters.ts'

const saves = testCharacterSaves()
const itemCount = (name: string) => {
  const spec = TEST_CHARACTERS[name]!
  return Object.keys(spec.equipped).length + spec.belt.length + spec.inventory.length + spec.stash.length
}

async function enter(name: string): Promise<LocalLoopbackAdapter> {
  const lobby = new LocalLobbyProvider({ seed: 555 })
  await lobby.importCharacterD2s(saves.get(name)!)
  return lobby.enterGame({ charName: name, difficulty: 0 })
}

describe('test characters', () => {
  it.each([...saves.keys()])('%s round-trips through the save format', (name) => {
    const spec = TEST_CHARACTERS[name]!
    const save = readD2s(saves.get(name)!)
    expect(save).toMatchObject({ name, classId: CHARACTER_CLASS_NAMES.indexOf(spec.class as never), level: spec.level })
    expect(save.attributes).toMatchObject({ gold: spec.gold, goldBank: spec.stashGold })
    expect(save.items).toHaveLength(itemCount(name))
    expect(save.quests[0][questWordIndex113c('a1q5')!]! & QUEST_FLAG_REWARD_PENDING_113C).toBeTruthy()
    expect(save.items.filter((item) => item.quality === 7 && item.identified).every((item) => item.stats.length > 0)).toBe(true)
  })

  it.each([
    ['TestFireSorc', 'fire caster Sorceress'],
    ['TestHammerdin', 'magic caster Paladin'],
    ['TestBowazon', 'ranged Amazon'],
    ['TestFreshBarb', 'melee Barbarian'],
  ])('%s loads in Single Player as a %s with all its gear', async (name, build) => {
    const adapter = await enter(name)
    const state = adapter.game.getPlayerState(adapter.playerUnitId)!
    const spec = TEST_CHARACTERS[name]!
    expect(state.items).toHaveLength(itemCount(name))
    expect(state.items.filter((item) => item.location === 'equipped')).toHaveLength(Object.keys(spec.equipped).length)
    expect(state.items.filter((item) => item.location === 'stash')).toHaveLength(spec.stash.length)
    expect([state.gold, state.goldBank]).toEqual([spec.gold, spec.stashGold])
    expect(describeBuild(characterBuild({ classIndex: CHARACTER_CLASS_NAMES.indexOf(spec.class as never), level: state.level, strength: spec.attributes.strength, dexterity: spec.attributes.dexterity, skillPoints: state.skills }))).toBe(build)
    adapter.close()
  })
})
