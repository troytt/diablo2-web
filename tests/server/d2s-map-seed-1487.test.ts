import { describe, expect, it } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  LocalLobbyProvider,
  generateD2sMapSeed,
} from '../../src/server/loopback-adapter.ts'
import { readD2sSave113c } from '../../src/server/save/d2s-reader.ts'

describe('Issue #1487: Single-player mapSeed derivation and difficulty switch parity', () => {
  it('generateD2sMapSeed generates non-zero 32-bit seeds distinct from previousSeed', () => {
    const prev = 0x12345678
    for (let i = 0; i < 50; i++) {
      const seed = generateD2sMapSeed(prev)
      expect(seed).toBeGreaterThan(0)
      expect(seed).toBeLessThanOrEqual(0xffffffff)
      expect(seed).not.toBe(prev)
    }
  })

  it('generateD2sMapSeed with D2Rng produces deterministic valid non-zero seeds', () => {
    const rng1 = new D2Rng(42)
    const rng2 = new D2Rng(42)

    const s1_a = generateD2sMapSeed(100, rng1)
    const s1_b = generateD2sMapSeed(s1_a, rng1)

    const s2_a = generateD2sMapSeed(100, rng2)
    const s2_b = generateD2sMapSeed(s2_a, rng2)

    expect(s1_a).toBe(s2_a)
    expect(s1_b).toBe(s2_b)
    expect(s1_a).not.toBe(100)
    expect(s1_b).not.toBe(s1_a)
    expect(s1_a).toBeGreaterThan(0)
    expect(s1_b).toBeGreaterThan(0)
  })

  it('entering same difficulty preserves existing .d2s mapSeed without reroll', async () => {
    const lobby = new LocalLobbyProvider({ seed: 777 })
    await lobby.createCharacter({ name: 'PaladinSp', classId: 'pal' })

    const initialD2s = lobby.getCharacterD2s('PaladinSp')!
    const parsedInitial = readD2sSave113c(initialD2s)
    expect(parsedInitial.activeDifficulty).toBe(0)
    const initialSeed = parsedInitial.mapSeed
    expect(initialSeed).toBe(777)

    // Enter game in difficulty 0 (same as initial activeDifficulty)
    const adapter = await lobby.enterGame({ charName: 'PaladinSp', difficulty: 0 })
    expect(adapter.getGameInstance().mapSeed).toBe(initialSeed)

    const afterD2s = lobby.getCharacterD2s('PaladinSp')!
    const parsedAfter = readD2sSave113c(afterD2s)
    expect(parsedAfter.activeDifficulty).toBe(0)
    expect(parsedAfter.mapSeed).toBe(initialSeed)
  })

  it('switching difficulty rerolls mapSeed to a distinct non-zero seed and updates .d2s save', async () => {
    const lobby = new LocalLobbyProvider({ seed: 1000 })
    await lobby.createCharacter({ name: 'SorcSp', classId: 'sor' })

    const initialD2s = lobby.getCharacterD2s('SorcSp')!
    const initialSeed = readD2sSave113c(initialD2s).mapSeed
    expect(initialSeed).toBe(1000)

    // Switch difficulty from Normal (0) to Nightmare (1)
    const adapterNm = await lobby.enterGame({ charName: 'SorcSp', difficulty: 1 })
    const nmSeed = adapterNm.getGameInstance().mapSeed
    expect(nmSeed).toBeGreaterThan(0)
    expect(nmSeed).not.toBe(initialSeed)

    const nmD2s = lobby.getCharacterD2s('SorcSp')!
    const parsedNm = readD2sSave113c(nmD2s)
    expect(parsedNm.activeDifficulty).toBe(1)
    expect(parsedNm.mapSeed).toBe(nmSeed)

    // Switch difficulty from Nightmare (1) to Hell (2)
    const adapterHell = await lobby.enterGame({ charName: 'SorcSp', difficulty: 2 })
    const hellSeed = adapterHell.getGameInstance().mapSeed
    expect(hellSeed).toBeGreaterThan(0)
    expect(hellSeed).not.toBe(nmSeed)
    expect(hellSeed).not.toBe(initialSeed)

    const hellD2s = lobby.getCharacterD2s('SorcSp')!
    const parsedHell = readD2sSave113c(hellD2s)
    expect(parsedHell.activeDifficulty).toBe(2)
    expect(parsedHell.mapSeed).toBe(hellSeed)
  })

  it('initial mapSeed 0 generates a valid non-zero seed upon entering game', async () => {
    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({ name: 'BarbSp', classId: 'bar' })

    // Simulate a save with mapSeed 0
    const rawD2s = lobby.getCharacterD2s('BarbSp')!
    const view = new DataView(rawD2s.buffer, rawD2s.byteOffset, rawD2s.byteLength)
    view.setUint32(0xab, 0, true) // force mapSeed = 0

    const adapter = await lobby.enterGame({ charName: 'BarbSp', difficulty: 0 })
    const effectiveSeed = adapter.getGameInstance().mapSeed
    expect(effectiveSeed).toBeGreaterThan(0)

    const updatedD2s = lobby.getCharacterD2s('BarbSp')!
    const parsedUpdated = readD2sSave113c(updatedD2s)
    expect(parsedUpdated.mapSeed).toBe(effectiveSeed)
  })

  it('explicit target.mapSeed is respected and not overwritten by difficulty change', async () => {
    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({ name: 'ZonSp', classId: 'ama' })

    const customSeed = 0x55aa3311
    const adapter = await lobby.enterGame({
      charName: 'ZonSp',
      difficulty: 1,
      mapSeed: customSeed,
    })

    expect(adapter.getGameInstance().mapSeed).toBe(customSeed)
  })

  it('seedGenerator option in LocalLobbyProviderOptions allows custom seed injection', async () => {
    let callCount = 0
    const lobby = new LocalLobbyProvider({
      seedGenerator: (_prev) => {
        callCount++
        return 0x99887766 + callCount
      },
    })

    await lobby.createCharacter({ name: 'NecroSp', classId: 'nec' })
    const createdD2s = lobby.getCharacterD2s('NecroSp')!
    const initialSeed = readD2sSave113c(createdD2s).mapSeed
    expect(initialSeed).toBe(0x99887767)

    // Switch difficulty to trigger seed generation
    const adapter = await lobby.enterGame({ charName: 'NecroSp', difficulty: 1 })
    expect(adapter.getGameInstance().mapSeed).toBe(0x99887768)
  })
})
