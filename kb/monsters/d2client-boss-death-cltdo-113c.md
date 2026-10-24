# D2Client 1.13c: Blood Raven / Shenk death shows (MonUMod 22) and MissCltDoFunc 21 / 61

Issues #1040, #1041, #1042. Addresses are D2Client.dll 1.13c (ImageBase 0x6FAB0000, VMA = absolute).

## Dispatch

- `0x6fad0fb0` is the MonUMod 22 `questcomplete` event-1 handler (`0x6fba9fe0[22*5+1]`, see
  `kb/quests/a3-compelling-orb-smash-113c.md`). It switches on the monster class (`[esi+4]`) and requires
  `[esi+0x10]` (mode) `== 0`: `0x10b` = 267 Blood Raven -> `0x6fb02320` (`0x6fad10c6`), `0x1df` = 479 overseer1 ->
  `0x6fb02bd0` (`0x6fad10d7`). The handler only runs for units that carry umod 22 (SuperUnique spawner), so a
  plain overseer1 has no death show. `0x25a` (overseercontrol) is referenced only from `0x6fb02bd0`.

## Blood Raven `0x6fb02320`

Three `0x6fb630f0` calls on a zeroed 0x5c-byte create record {flags 1, +4 owner = +8 source = Blood Raven}:

1. `0x11c` = 284 `brdeathcontrol`, then `#10637(missile, 0x32)` (SetTargetX 50, `0x6fabc448` -> IAT 0x6fb7e624).
2. `0x128` = 296 `brdeathspirits1`.
3. `0x125` = 293 `brdeathsmokes1`.

Each exactly once. There is no Missiles.txt row `brdeathspirits`. The S1 -> NU -> DT chains come from the rows'
`ExplosionMissile` + `AlwaysExplode` (Range 60 / 340 / 20).

## MissCltDoFunc[21] `brdeathcontrol` `0x6fb686f0`

- `owner = 0x6fb560d0(missile)`; no owner -> tail.
- `t = #11018(missile)` (GetTargetX, IAT 0x6fb7e560). `t != 0` -> `#10637(missile, t - 1)`.
- `t == 0`: create `missiles.bin[class]+0x1e` (CltSubMissile1 = `brdeathlightningbolt`) with flags 2 (target relative
  to start), owner = source = owner; `P = missiles.bin+0x58` (CltParam1 = 20); `dx = RAND(2P+1) - P`,
  `dy = RAND(2P+1) - P` on the missile seed (`unit+0x20`, `0x6fab1330`); if both are 0, `dx = RAND(P) + 1`. The bolt
  gets `#10637(bolt, dx)` and `0x6fabc394(bolt, dy)`. Then `#10637(missile, 0x6fb60050() - 1)`.
- `0x6fb60050`: `elapsed = #10985` (IAT 0x6fb7e680); `< 125` -> 25, `< 175` -> 10, `< 300` -> 3, else 15.

## Shenk `0x6fb02bd0`

`0x6fb5ff10(owner = monster, class 0x25a, x, y, 0, 1)` then `#10637(missile, 0x19)` (SetTargetX 25).

## MissCltDoFunc[61] `overseercontrol` `0x6fb6a600`

- Same countdown on TargetX (`#11018` / `#10637`).
- On 0: one seed step (`0x6ac690c5` LCG on `+0x20/+0x24`), `low bit 1` -> `0x1a0` = 416 `catapult cold ball`,
  `0` -> `0x1a6` = 422 `catapult meteor ball`; `0x6fb63fc0(missile, owner, class)`; then
  `#10637(missile, 0x6fb5ff80(#10985) - 1)`.
- `0x6fb5ff80`: `< 150` -> 20, `< 200` -> 15, `< 225` -> 10, `< 375` -> 5, else 25.
- No plague / charged / spike catapult row is ever created.

## `0x6fb63fc0` (catapult lob)

- Create {flags 1, owner, class}; start x = owner x (`+0xc` path / `0x6fabc3be`) + `RAND(20) - 10`, then start y =
  owner y (`+0x10` / `0x6fabc2ec`) + `RAND(20) - 10` (two more seed steps, x first).
- Asserts the created row's `missiles.bin+0x96` (Range) is 25 (`0x6fb6411a`).
- 3D trajectory record (gfx+0x30): x/y offsets `-25 * v` with `v` from D2Common #10065 (a 4-entry vector table
  `0x6fde4e78` = {(0,1),(1,0),(1,0),(-1,0)} indexed by a MonStats byte at +0x4b), velocity `v`; z = `0xc8000`
  (400 px), vz = `0xffff8000` (-16 px / frame), target z 0 -> lands after 25 frames; `0x6fb77fb0` steps it.
- The x/y lob offset (the #10065 vector) is not modelled yet; the z fall is.

## Impact

The balls' own rows drive the impact: 416 `CltHitFunc 48` (`0x6fb60b70`), 422 `CltHitFunc 50` (`0x6fb6aa70`,
`cHitPar1` 10 rocks / `cHitPar2` 15 lob velocity, `CltHitSubMissile1/2` = `moltenboulder-flyingrocks` /
`catapult meteor fire`). These two CltHitFuncs are not implemented in the web client yet.
