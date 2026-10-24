# Game completion after Baal: "Destruction's End" portal → S2C 0x61 07 → victory screen (1.13c, issue #924)

## Server: LastPortal operate (D2Game.dll `0x6fc7fd00`, Objects.txt OperateFn 72)

`OBJECTS_OperateFunction72_LastPortal` (`D2Game.dll` `0x6fc7fd00`):

1. Quest 36 (A5Q6) data; return unless its `nLastPortalObjectMode == OBJMODE_OPENED (2)` (`0x6fc7fd34`).
2. `QUESTRECORD_GetQuestState(playerQuests[difficulty], 40 /*A5Q6 record*/, 13)` (`0x6fc7fd5b`); if
   not set → `SUNIT_AttachSound(player, 19)` and stop (`0x6fc7fe15`).
3. `LEVEL_WarpUnit(game, player, 109 /*Harrogath*/, 0)` (`0x6fc7fd76`) — the client receives the normal
   Harrogath load / assign packets first.
4. Save all clients (`0x6fc4de30` → `D2GAME_SAVE_WriteFile`).
5. If the client exists and `PLAYER_IsBusy == 0`: reset interact info, `pPlayerData->bBusy = 1`, send
   **`61 07`** (`0x6fc7fde9`), then `QUESTRECORD_SetQuestState(..., filter, 10)`.

There is no S2C 0x89 and no server-initiated game exit; the client leaves on its own.

## Client: S2C 0x61 is "play cinematic", not "can go to act"

`0x6fb5f940` → `0x6fb399a0(pkt[1])`. `pkt[1]` indexes a 12-byte table at `0x6fb91314`
(`{char* name, u8 localized, u8 sizeSuffix, ...}`, count `0x6fb91370 = 8`):

| idx | file | notes |
| --- | --- | --- |
| 0 | `d2_promo.bik` | |
| 1 | `d2intro%s.bik` | |
| 2 | `ACT02START%s.BIK` | |
| 3 | `ACT03START%s.BIK` | |
| 4 | `ACT04START%s.BIK` | |
| 5 | `ACT04END%s.BIK` | expansion (`0x6fbbf2f4`) chains idx 6 |
| 6 | `D2X_INTRO_%s.BIK` | |
| 7 | `D2X_OUT_%s.BIK` | ends the game |

`%s` = `640x292` (high-res video option `0x6fbbf2f2`) or `640x146`; localized files live under
`data\local\video\<lang>\` (e.g. `D2X_OUT_640x292.BIK`, 25.9 MB, in `D2xVideo.mpq`).

- `idx >= 8` → FatalAssert (`0x6fb399b3`, error 0xef).
- After the video every index sends C2S `0x48` (`0x6fb39e38`), which clears `bBusy`.
- idx 7 (`0x6fb39e48`): `[0x6fbcc3ac] = 0`, `[0x6fbcc3b0] = 1` ("game completed"), then `0x6faf2850`:
  `0x6fac4660` sends C2S **`0x69` LeaveGame** and `[0x6fbcc3a4] = 1` stops the game loop.
  (When `d2game.dll` is missing next to the exe, the video and the `0x48` are skipped, same exit.)

## Client: after the game loop (`0x6faf52a2..0x6faf53a3`)

With `[0x6fbcc3b0]` set, on the cached char info (`[0x6fbcb980]`, word `+0x1eb` = packed save flags,
progression in bits 8..12, `0x04` hardcore, `0x20` expansion):

```
old  = byte[+0x1ec] & 0x1f                 // cached progression
show = !(diff == 0 && (old == 8 || old == 12)) && !(diff == 1 && old == 12)
word[+0x1eb] = (word & 0xe0ff) | ((diff << 10) + 0x500)   // progression := diff*4 + 5
if (show) run the victory screen 0x6faf3a70 (800x600)
```

## Victory screen `0x6faf3a70`

Expansion game (`0x6fbc9854 != 0`; always the case after Baal):

- `data\global\ui\menu\endgame2.dc6`: 12 cells (256/256/256/32 x 256/256/88) drawn bottom-anchored at
  x 0/256/512/768, y 256/512/600 (D2gfx #10041).
- Palette `data\global\palette\endgame2\pal.dat` / `pal.pl2` (D2Win #10128, `0x6faf3b62`).
- Font42 (D2Win #10184 font 3), color 4 (gold), centered on `w/2`, y = text bottom (D2Win #10150):
  - y 100: string 5098 `Congratulations!` (`0x6faf3710`)
  - y 187: character name (char info `+0xb9`) (`0x6faf2c70`)
  - y 272: string 5100 `Will Henceforth Be Known As`
  - y 357: `GetCharacterTitle(class, p, hardcore, expansion) + name`, `p` = `4+exp` / `8+2exp` /
    `12+3exp` for normal / nightmare / hell.
- `ui\menu\endgameok.dc6` (2 frames 96x32, frame 1 = pressed) at `(w/2-48, h-80)` bottom-anchored;
  string 5102 `OK` in Font16 color 0 at `(w/2 - width/2 - p, h - 88 + p)`, `p = 2` while pressed.
- Input table `0x6fba4828`: L/R button down inside `[w/2-48, w/2+48] x [h-112, h-80]` → pressed
  (`0x6faf2f00`); L/R button up → unpressed, inside → done (`0x6faf2e70`); WM_KEYDOWN without
  lParam bit 30 → done (`0x6faf2170`).
- Classic games use `endgame.dc6` (640x480, 8 cells) and also draw string 5099
  `You Have Vanquished Diablo` at y 107 (classic Diablo kill path `0x6face259` → `0x6faf2bd0`).

## D2Win #10205 `GetCharacterTitle` (`0x6f8ebd00` → `0x6f8ebb50`)

Tier: expansion `p < 5 → 0, < 10 → 1, else 2 + (p >= 15)`; classic `p < 4, < 8, 2 + (p >= 12)`;
hardcore adds 3 to a non-zero tier. Class set (`0x6f8ebc78`, `[0,0,1,1,1,1,0,1,1,0]`, 0 = female).
Hardcoded English strings with a trailing space:

| tier | exp male | exp female | classic male | classic female |
| --- | --- | --- | --- | --- |
| 1 | Slayer | Slayer | Sir | Dame |
| 2 | Champion | Champion | Lord | Lady |
| 3 | Patriarch | Matriarch | Baron | Baroness |
| 4 | Destroyer | Destroyer | Count | Countess |
| 5 | Conqueror | Conqueror | Duke | Duchess |
| 6 | Guardian | Guardian | King | Queen |

## Port

- `src/client/session/game-completion-113c.ts`, `OnlineSession` `CanGoToAct` handler / `completeGame`.
- Frontend stage `end_game` (`FrontendRenderer.renderEndGame`), assets baked by
  `src/baker/packers/pack-frontend-ui.ts` into `public/ui/frontend/endgame/`.
- The Bink videos are not played (no web form of the BIK assets).
