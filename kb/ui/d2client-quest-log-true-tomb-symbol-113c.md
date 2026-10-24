# D2Client.dll 1.13c — Quest Log A2Q6 True Tomb symbol (`invps.dc6`)

Source: `samples/d2/D2Client.dll` (1.13c, image base `0x6fab0000`), read with `objdump -M intel`.
Found while fixing Issue #1008 (symbol never drawn because the port gated on a non-existent key `qstsa2q67`).

## Asset

`%s\ui\menu\invps` (string `0x6fb86e08`), loaded once by the quest panel init `0x6facda26..0x6facda51`
into `[0x6fbd2491]`. `data\global\ui\MENU\invps.DC6`: 1 direction, **7 frames of 102x93**, one per
Tal Rasha tomb (levels 66..72). Baked to `public/ui/invps.png` (horizontal strip) by `src/baker/packers/pack-ui.ts`.

## Tomb offset `[0x6fbd23e8]`

S2C `0x50` (D2Client handler `0x6fb5d4b0` -> `0x6fb5d4d9 call 0x6fb12e60` -> jump table -> `0x6fb12e9a jmp 0x6facc740`):

```
0x6facc740: if word[pkt+1] == 1:
              [0x6fbd23e4] = word[pkt+3]   ; Den of Evil remaining
              [0x6fbd23e8] = word[pkt+5]   ; true tomb offset (0..6)
              [0x6fbd23ec] = word[pkt+7]   ; Mount Arreat barbs remaining
```

Port: `QuestLogState.apply50()` -> `tombOffset` -> `WorldPanelsHud.tombOffset`.

## Gate (quest panel draw `0x6facf1e0..0x6facf73c`)

1. Per quest record (stride `0x26a`, base `0x6fbd24e9`) while iterating icons, `0x6facf46c..0x6facf480`:
   `word [rec+0x5] (0x6fbd24ee) == 0x3a0` (current page text string id) **and**
   `byte [rec+0x265] (0x6fbd274e) == 7` (page index) -> local flag `[esp+0xf] = 1`.
   Page index 7 of the A2Q6 state table (row 14) is `qstsa2q61a`
   "The Symbol of the True Tomb of Tal Rasha." / 「這的符號標示出真正的塔.拉夏古墓。」
   (`buildQuestLogPage` returns `slotPage(7)` when A2Q5 is done / done-now and status == 1).
2. After the icon loop, `0x6facf589..0x6facf5e3`: flag set **and** selected slot `[0x6fbd23f9] == 5`:
   - frame = `[0x6fbd23e8]`, replaced by `0` when `< 0` or `> 6` (`0x6facf5a8..0x6facf5b5`, not a clamp);
   - `0x6fabd096(cel, x = [0x6fbcb9a0] + 0x6e, y = [0x6fbcb9a4] + screenH - 0x6e, -1, drawMode 3, 0)`:
     bottom-left anchor, panel-relative **(110, 370)**; drawMode **3 = DRAWMODE_MODULATE** (port: canvas `'screen'`).
3. The title / body text (`0x6facf65d..0x6facf73a`) is drawn **after** the symbol, so text overlays it.

Implemented in `src/client/world/quest-log-state.ts` (`trueTombSymbolFrame113c`, `INVPS_*` constants) and
`src/client/ui/panels/left-dock-renderer.ts`; verified by `tests/client/quest-log-true-tomb-1008.test.ts`.
