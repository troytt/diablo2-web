# D2Client.dll 1.13c — Quest Log slot geometry (icons, sockets, hit-test)

Source: `samples/d2/D2Client.dll` (1.13c, image base `0x6fab0000`), quest panel draw routine around
`0x6facf1e0..0x6facf73c`, slot hit-test `0x6facc7a0`. Found while fixing Issue #914.

## Panel origin

`0x6fb739fb`: `[0x6fbcb9a0] = 0x50` (80), `[0x6fbcb9a4] = 0xffffffc4` (-60) in 800x600.
Draw calls compute `x = [0x6fbcb9a0] + relX`, `y = relY - [0x6fbcb9a4]`, i.e. panel top-left `(80, 60)`.
Mouse coordinates are converted to panel-relative before hit-tests (close button check `0x116..0x139 × 0x188..0x1a9`).

## Slot table `0x6fba8100` (6 × 16 bytes, int32, panel-relative)

| slot | drawX | drawY (DC6 bottom) | hitX | hitY |
|---|---|---|---|---|
| 0 | 26 | 121 | 32 | 65 |
| 1 | 123 | 121 | 128 | 65 |
| 2 | 220 | 121 | 224 | 65 |
| 3 | 26 | 218 | 32 | 163 |
| 4 | 123 | 218 | 128 | 163 |
| 5 | 220 | 218 | 224 | 163 |

Stride is 97 px in both axes (the pre-#914 web port used a guessed `28 + col*92, 64 + row*100` grid).

## Draw order and offsets

1. **Quest icon** (`Menu\<aXqY>.dc6`, every frame 72x86, DC6 offset `(0, -1)`), `0x6facf2c1..0x6facf4e0`:
   `D2gfx` cel draw at `(drawX, drawY)` = bottom-left anchor → top-left `(drawX + offX, drawY + offY - 86)`
   = `(drawX, drawY - 87)`. When the slot is the **mouse-down** slot (`0x6fbd23f5`) it is drawn with
   `x += [0x6fbd34bc]` (bss, 0) and `y += [0x6fbaa3fc]` (-1); state-3 (active) icons use frame `0x19` only while
   mouse-down (`0x6facf4ac`: `frame = (0x6fbd23f5 == slot) ? 0x19 : 0`), frame `0x18` = completed, `0x1a` = unstarted.
2. **Socket overlay** (`Menu\questsockets.dc6`, 2 frames 80x95, offset `(0,0)`), drawn AFTER the icon,
   `0x6facf4f3..0x6facf558`: frame = `(slot == selected 0x6fbd23f9) ? 1 : 0`, bottom-left
   `(drawX - 4, drawY + 5 + (selected ? [0x6fbaa3f8] = -1 : [0x6fbd34b8] = 0))`.

`questbackground.dc6` itself contains no niches — the arched stone niche is part of each quest icon frame.

## Hit-test `0x6facc7a0`

Iterates the first `[0x6fbd23e0]` (visible quest count) slots: hit when
`hitX <= relX < hitX + 0x38 (56)` and `hitY <= relY < hitY + 0x34 (52)` — the square picture area inside the niche.

Implemented in `src/client/ui/world-panels.ts` (`QUEST_SLOTS_113C`, `questIconTopLeft113c`,
`questSocketTopLeft113c`, `hitTestQuestSlot113c`), verified by `tests/client/quest-log-slots-914.test.ts`
(reads the table straight from the DLL when `samples/d2` is present).
