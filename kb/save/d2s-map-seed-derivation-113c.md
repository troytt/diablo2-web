# Diablo II 1.13c Single-Player Map Seed Derivation & Difficulty Switch Parity

## 1. Overview & Binary Offsets

In Diablo II v1.13c:
- Character save files (`.d2s`, header format version 0x60 / 96):
  - Offset `0xA8` (168): `uint8 activeDifficulty` (0 = Normal, 1 = Nightmare, 2 = Hell).
  - Offset `0xAB` (171): `uint32 mapSeed` (little-endian 32-bit integer).
- When a player continues playing single-player in the **same difficulty**:
  - The mapSeed is preserved from the `.d2s` header.
  - Dungeon room placement, waypoints, shrines, and monster generation remain identical.
- When a player starts a single-player game in a **different difficulty** (or if `mapSeed == 0`):
  - Diablo II resets and rerolls the map layout.
  - The game generates a new 32-bit seed via system entropy and the canonical PRNG (`D2Common.10086` / `Fog.10086`).
  - The generated seed is non-zero and distinct from the prior seed.
  - The newly generated seed and updated `activeDifficulty` are written back into the character's `.d2s` save header upon entering the game.

## 2. Elimination of Fabricated Formulas

Prior web port code used a synthetic hash formula when switching difficulty:
```ts
// Fabricated / Non-canonical:
const baseSeed = ((parsed.mapSeed >>> 0) ^ ((requestedDifficulty + 1) * 0x9e3779b9)) >>> 0
const rng = new D2Rng(baseSeed || 1)
effectiveSeed = (rng.nextUint32() >>> 0) || 1
if (effectiveSeed === (parsed.mapSeed >>> 0)) {
  effectiveSeed = ((effectiveSeed + 0x13579bdf) >>> 0) || 1
}
```
This formula had several issues:
1. `0x9e3779b9` and `0x13579bdf` are synthetic constants with zero basis in Diablo II 1.13c binaries (`D2Common.dll`, `D2Game.dll`, `D2Launch.dll`).
2. Toggling back and forth between Normal and Nightmare produced deterministic repeats rather than true map rerolls.
3. Fallback character creation hardcoded `0x12345678` instead of drawing a valid random seed.

## 3. Canonical 1.13c Alignment

In `LocalLobbyProvider`:
1. `generateD2sMapSeed(previousSeed?, rng?)` draws a valid non-zero 32-bit integer using the canonical LCG or platform entropy (`crypto.getRandomValues`).
2. When switching difficulty or when `parsed.mapSeed === 0`, `LocalLobbyProvider` advances its PRNG stream or calls `generateD2sMapSeed`, ensuring the seed is non-zero and distinct from the previous seed.
3. When playing in the same difficulty, `parsed.mapSeed` is preserved unchanged.
4. Deterministic testing is fully supported via `options.seed`, `options.defaultMapSeed`, and `options.seedGenerator`.
