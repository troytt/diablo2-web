# D2Client 1.13c: boss death show dispatch, Diablo / Mephisto handlers, MissCltDoFunc 26 / 28, MissCltHitFunc 33

Issues #1203..#1208 (batch VFX-B17). Addresses are D2Client.dll 1.13c (ImageBase 0x6FAB0000, VMA = absolute).
See also `d2client-boss-death-cltdo-113c.md` (Blood Raven / Shenk, CltDoFunc 21 / 61).

## Dispatch `0x6fad0fb0` (MonUMod 22 `questcomplete` event 1)

`[esi+4]` = class, `[esi+0x10]` = mode. `class <= 0x100`: `class - 0x2d` indexes the byte table `0x6fad1140`
(199 entries), which selects one of 7 jump-table slots at `0x6fad1124`:

| byte | target | class | handler |
|---|---|---|---|
| 0 | 0x6fad1003 | 45 (corruptrogue3) | 0x6fb02860 |
| 1 | 0x6fad0fec | 156 Andariel | 0x6fb02230 |
| 2 | 0x6fad1031 | 211 Duriel | 0x6fb02620 |
| 3 | 0x6fad101a | 229 Radament | 0x6fb027a0 |
| 4 | 0x6fad1048 | 242 Mephisto | 0x6fb02270 |
| 5 | 0x6fad105d | 243 Diablo | 0x6fb02600 |
| 6 | 0x6fad111c | everything else | (none) |

`class == 0x100` (256 Izual) -> 0x6fb03070. `class > 0x100`: 0x10b = 267 -> 0x6fb02320, 0x11c = 284 **mode 14** ->
0x6fb026e0, 0x16e = 366 -> 0x6fb030d0, 0x1df = 479 -> 0x6fb02bd0, 0x21c..0x21e = 540..542 -> 0x6fb029f0, 0x220 = 544
-> 0x6fb02570. Every other case requires mode 0.

Not handled: 250 Summoner, 333 diabloclone, 526 nihlathakboss, 704..709 Uber bosses. (Nihlathak's
`nehlithakcontrol` 0x25e + 0x25b are created by 0x6fb02af0 at the monster class 0x20e found via 0x6fabc334.)
Note: `kb/quests/a3-compelling-orb-smash-113c.md` lists 211 / 229 the other way round; the byte table above is
authoritative (index 166 = 2, index 184 = 3).

## Create record of `0x6fb630f0`

Zeroed 0x5c bytes: `+0` flags, `+4` owner, `+8` source, `+0x10` missile class, `+0x14/+0x18` explicit start
(flag 1), `+0x1c/+0x20` target / target offset (flag 0x20 explicit, flag 2 relative to start), `+0x2c` =
`0x6fabc388(source missile)`, `+0x30` = level (`0x6fabc3fa` = GetMissileLevel). The death handlers write only
flags / owner / source / class / level: there is no range field, so a controller lives for its Missiles.txt `Range`
(+ LevRange * level). `#10637` / `#10019` (`0x6fabc448` / `0x6fabc394`) set TargetX / TargetY, read back with
`#11018` (`0x6fabc322`) / `0x6fabc4ba`. `#10985` (`0x6fabc4d2`) = elapsed frames.

## Diablo `0x6fb02600`

`0x6fba2134 = unit ? unit.id : -1`; nothing else. No missile (in particular no `diabwallmaker`, the Skills.txt
#197 DiabWall missile).

## Mephisto `0x6fb02270`

Three creates {flags 1, owner = source = Mephisto, level 1}, in order: 0x12b = 299 `mephistodeathcontrol`, then
SetTargetX(75) and SetTargetY(75); 0x166 = 358 `mephistoholedelay`; 0x132 = 306 `mephistodonotdraw`.

## The Countess `0x6fb02860` (`corruptrogue3`, MonStats 45, Issue #1215)

Searches current room and `D2Common.#10754` near rooms for `objects.txt` class `0x173` (`371`, Tower Tome / quest chest). If not found, falls back to `(x - 15, y - 15)`.
Creates:
- `0x123` = 291 `towermist` (`flags = 0x21`, moving from Countess `(x, y)` toward chest `(targetX, targetY)`, `Vel = 2`, `Range = 400`, `pCltDoFunc = 25` `0x6fb683d0`, `CltSubMissile1 = towermisttrail` #292, `ExplosionMissile` of #292 = `towermistfade` #330).
- `0x14c` = 332 `towerchestspawner` (`flags = 1`, stationary at `(targetX, targetY)`, `Range = 400`, `pCltDoFunc = 30` `0x6fb679f0`, `SetTargetY(0)`; at `elapsed == CltParam1` (150) sets `TargetY = 1` and spawns `towermisttrail` #292 every `CltParam2` (2) frames within `[-CltParam3, CltParam3]` = `[-5, 5]`).

## MissCltDoFunc table `0x6fb8d8a0`, MissCltHitFunc table `0x6fb8da10`

`[21]` 0x6fb686f0, `[26]` 0x6fb6b780, `[27]` 0x6fb68130, `[28]` 0x6fb68010, `[61]` 0x6fb6a600; CltHit `[33]`
0x6fb65dd0, `[34]` 0x6fb607e0. The range-end path 0x6fb61420 calls the CltHitFunc (`0x6fb615c8`).

## MissCltDoFunc[26] `0x6fb6b780` (mephistodeathcontrol)

missiles.bin: `+0x1e` CltSubMissile1, `+0x20` CltSubMissile2, `+0x58/+0x5c/+0x60` CltParam1/2/3.

- If CltSubMissile1: TargetX != 0 -> TargetX - 1; else `0x6fb682b0(missile, owner, sub1, CltParam3)` and
  TargetX = CltParam1 - 1.
- `0x6fb682b0`: {flags 2, owner, source = controller, level = controller level}; `dx = RAND(2P+1) - P`,
  `dy = RAND(2P+1) - P`, both 0 -> `dx = RAND(P-1) + 1`; the created missile gets TargetX(dx) / TargetY(dy).
- If CltSubMissile2: TargetY != 0 -> TargetY - 1; else {flags 0x102, owner, source = controller, sub2}, level =
  RAND(5) + 1, dx / dy as above with P = CltParam3 (both 0 -> RAND(P-1) + 1); created rock gets
  SetTargetX(RAND(5)); then TargetY = CltParam2 - 1.
- Tail: CltDoFunc 1 (0x6fb617c0).

With 16 / 4 / 20 and 75 / 75: firewallmakers at frames 75, 91, 107, ...; flying rocks at 75, 79, 83, ...

## MissCltDoFunc[28] `0x6fb68010` (mephistodonotdraw)

When `#10985` (elapsed) == CltParam1 (15): four CltSubMissile1 (corpseexplosion) {flags 0x2001, owner, explicit
start} at owner position + (x, y) from `0x6fb83e00` = {-1, 0, 1, 0} / `0x6fb83df0` = {0, -1, 0, 1}.

## MissCltHitFunc[33] `0x6fb65dd0` (mephistoflyingrocksbig)

`P = max(3, missiles.bin+0x6c)` (cHitPar1 = 20); repeat TargetX times (the RAND(5) from CltDoFunc 26): {flags
0x102, owner, source = rock, `+0x2c` CltHitSubMissile1 = mephistoflyingrockssmall}, level = RAND(5) + 1,
`dx = RAND(2P+1) - P`, `dy = RAND(2P+1) - P`, both 0 -> `dx = RAND(P) + 1`. The row's AlwaysExplode creates
`mephistoexplosionbig`; each small rock ends in `mephistoexplosionsmall`.

## RAND

`0x6fab1330`: n <= 0 -> 0 without a seed step; else one `0x6ac690c5` LCG step on the missile seed (unit+0x20),
`lo & (n-1)` for powers of two, `lo % n` otherwise.
