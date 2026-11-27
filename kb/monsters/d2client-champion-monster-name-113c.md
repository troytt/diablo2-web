# D2Client.dll & D2Game.dll v1.13c Champion vs Unique Monster Flags & Lifebar Name Priority

## 1. Server Champion Spawn & `0xAC AssignNPC` Serialization (`D2Game.dll`, ImageBase `0x6FC20000`)

- `0x6FC43D5E` — Champion pack spawn sets `pMonsterData->fFlags |= 0x04` (`MONFLAG_CHAMPION`).
- `0x6FC43AE0` — Rolls 1 Champion-exclusive `MonUMod.txt` subtype (`champion == 1`, `cpick == 1` across Normal/Nightmare/Hell):
  - `16`: `champion`
  - `36`: `ghostly` (also sets `fFlags |= 0x40` `MONFLAG_GHOSTLY` at `0x6FC432B0`)
  - `37`: `fanatic`
  - `38`: `possessed`
  - `39`: `berserk`
- `0x6FC6FF60` (`0x6FC6FF91: mov edx, 0x8` ... `0x6FC6FFB9: or WORD PTR [eax+0x16], dx`) — Applying **any** `MonUMod` unconditionally sets `MONFLAG_UNIQUE (0x08)` on `pMonsterData->fFlags`.
- `0x6FCACA40` (`0x6FCACBD0..0x6FCACD4D`) — `S2C 0xAC AssignNPC` serializes the 5 monster flag bits (`0x04` Champion, `0x08` Unique, `0x02` SuperUnique, `0x10` Minion, `0x40` Ghostly), `bossMods[0..8]` (terminated by `0`), and a 16-bit `nameSeed`.
  - Consequently, every real 1.13c Champion packet arrives on the client with **both** `0x04` (`isChampion`) and `0x08` (`isUnique`) set (`fFlags = 0x0C`, or `0x4C` for Ghostly), plus a `nameSeed`.

## 2. Client Monster Name & Lifebar Rank Priority (`D2Client.dll`, ImageBase `0x6FAB0000`)

- `0x6FAD0620` (`sub_6FAD0620`) — Monster display name resolver evaluates flags in strict priority order:
  1. `0x6FAD06A2`: `fFlags & 0x02` (`MONFLAG_SUPERUNIQUE`) — resolves `SuperUniques.txt` `Name` string via `superUniqueId`.
  2. `0x6FAD0758`: `fFlags & 0x04` (`MONFLAG_CHAMPION`) — **checked before `0x08` (`Unique`)**:
     - Scans `.rdata:0x6FB86D64` (`4` entries + default fallback at index `4`) against `pMonsterData->nBossMods[0]`:
       - `36` -> `0x2B4C` (`"champghostlyX"` / `"Ghostly"` / `"幽靈的"`)
       - `37` -> `0x2B4D` (`"champfanaticX"` / `"Fanatic"` / `"狂信者"`)
       - `38` -> `0x2B4E` (`"champpossessedX"` / `"Possessed"` / `"著魔者"`)
       - `39` -> `0x2B4F` (`"champberserkX"` / `"Berserker"` / `"狂戰士"`)
       - Default / `16` -> `0x0C94` (`"Champion"` / `"Champion"` / `"頭目"`)
     - Formats with `.tbl` string `0x2B40` (`ChampFormatX`: `"%0 %1"`) and jumps to `0x6FAD095C`, bypassing `wNameSeed`.
  3. `0x6FAD0716` -> `0x6FAD08EF`: Only when neither `0x02` nor `0x04` is set does `fFlags & 0x08` roll random Unique prefix/suffix/appellation from `wNameSeed` (`nameSeed & 0xFF`).
- `0x6FB70850` (`0x6FB70A8B..0x6FB70AA6`) — Monster lifebar plaque color selector:
  - `0x6FB70A8B`: sets `color = 4` (`gold`) if `fFlags & 0x08` (`MONFLAG_UNIQUE`).
  - `0x6FB70AA1`: **overrides** `color = 3` (`blue`) if `fFlags & 0x04` (`MONFLAG_CHAMPION`).
