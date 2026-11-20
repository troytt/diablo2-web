# DT1 tile `+0x06` material flags and the 1.13c animated-tile gate (issue #923)

Ground truth: `samples/d2/D2Common.dll` (ImageBase `0x6fd50000`) and `samples/d2/D2CMP.dll` (ImageBase `0x6fe10000`)
1.13c, `objdump -d -M intel`. Port: `src/common/formats/dt1.ts` (`isAnimatedTile`), `src/common/drlg/drlg-anim.ts`.
Audit: `tools/verify-floor-flicker-923.ts` (all 136 levels, 32 frames + 5 camera offsets per view).

## 1. Byte `+7` is not an "animated" byte

The DT1 tile header word at `+0x06` is `D2TileLibraryEntryStrc::nFlags` (16-bit material flags):
`0x1` other, `0x2` water, `0x4` wood object, `0x8` indoor stone, `0x10` outdoor stone, `0x20` dirt, `0x40` sand,
`0x80` wood, `0x100` lava, `0x400` snow. The byte at `+7` (the port's `animated` field) is just its high byte.

1.13c D2CMP exports the getter as **ordinal `#10051`** (RVA `0x15300`: `movzx eax, word [eax+6]; ret 4`; D2Common
imports it at IAT `0x6fdd9014`, thunk `0x6fd592fa`). The 1.10f name `#10079_GetTileFlags` is a different ordinal in 1.13c.

## 2. Only `TILE_FLAGS_LAVA` animates

D2Common call sites of `#10051`:

| Address | Test | Meaning |
|---|---|---|
| `0x6fd62f20` | `test ah, 0x1` | `DRLGANIM_TestLoadAnimatedRoomTiles`: grow the room tile counts, set `DRLGROOMFLAG_ANIMATED_FLOOR` |
| `0x6fd62ff0` | `test ah, 0x1` | `DRLGANIM_AllocAnimationTileGrid`: build the frame list (`GetTiles(..., 40)`, alloc `0x14`) |
| `0x6fd7e17a`, `0x6fdb8b7b`, `0x6fdb8dd8`, `0x6fdb8edd`, `0x6fdb906b` | `test al, 0x1` | `TILE_FLAGS_OTHER` -> map tile `dwFlags \|= 4` |

So a tile animates iff `flags & 0x100` — bit 0 of byte `+7`. Among the floors placed in all 136 levels, only
`act4\lava\floor.dt1` style 20 (byte `+7` = `1`; River of Flame 107/108, Act 5 hell levels 125–127/135) qualifies. Act 5 `expansion\siege\snow.dt1` (styles 6 / 42) and `cliff.dt1` (style 37) snow floors
carry byte `+7` = `4` (`0x400` snow): they are ordinary rarity-picked floors.

## 3. Port defect fixed

`isAnimatedTile` returned true for any non-zero byte `+7`, so every Act 5 snow floor (Frigid Highlands 111, Arreat
Plateau 112, Frozen Tundra 117, Arreat Summit 120, Nihlathak's Temple 121 entrance) got an `animatedPlacements` list of
all same-style/sequence/type variants and `drawTileQuad` cycled them on the lava clock — the snow patches changed shape
every ~100 ms (3340 flickering screen locations in the 48 audited Act 5 views before the fix, 0 after). The DRLG side
(`drlg-anim.ts`) already tested `0x100` and was unaffected.
