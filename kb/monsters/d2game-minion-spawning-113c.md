# 1.13c `MonStats.bin` `wMinion[0..1]` & `D2Game.dll` Minion Spawning (`0x6FC41F60` / `0x6FD0E480`)

## Binary Ground Truth Summary

1. **`D2Common.dll` (`DATATBLS_CompileMonStatsTxt` `0x6FDAAA00`, Post-Fixup `0x6FDAA8A0`) & `Patch_D2.mpq` `data\global\excel\monstats.bin` (`0x1a8` = 424 bytes/row, 734 rows)**:
   - `+0x26` (`int16 wMinion[0]`): compiled verbatim from `MonStats.txt` `minion1` (`-1` when blank).
   - `+0x28` (`int16 wMinion[1]`): compiled verbatim from `MonStats.txt` `minion2` (`-1` when blank).
   - Across all 734 records in `Patch_D2.mpq` `monstats.bin`, `wMinion[0]` and `wMinion[1]` match `MonStats.txt` `minion1` and `minion2` with **0** discrepancies. Only **9** rows in 1.13c have `wMinion[1] >= 0` (e.g. `fetishshaman1..5` `hcIdx: 278..282` -> `fetish1..5` + `fetishblow1..5`).
   - Neither `D2Common.dll` (`0x6FDAAA00`, `0x6FDAA8A0`) nor `D2Game.dll` **ever** auto-populates a blank `minion2` from `NextInClass(minion1)`. Synthesizing `minion2 = NextInClass(minion1)` corrupts 60 rows across Acts 1–5 (for example, turning Act 1 `fallen4` / `fallenshaman4` into Act 5 Lv 40 `fallen5` `WarpedFallen`, and Act 1 `fetish1` `RatMan` into Act 3 Lv 24 `fetish2` `Fetish`).
   - `MonStatsTxt.wNextInClass` (`+0x04`) is read in `D2Game.dll` **only** via `0x6FC21D30` (`MONSTER_GetSubClassByIndex`), which has exactly three callers: Overseer Whip transform (`0x6FC2D8DE`), Act 2 Sarcophagus generator (`0x6FC67EE1`, `BaseId == 0x105`), and Flesh Spawner AI (`0x6FCA4454`, `BaseId == 0x12D`).

2. **`D2Game.dll` Unique Boss Minion Class Selection (`0x6FC41F60`, called by `0x6FC445A0` at `0x6FC445C4`)**:
   - `0x6FC41F6A`: reads `hcIdx = pBossUnit->dwTxtFileNo` (`[eax+0x04]`).
   - `0x6FC41F85`: indexes `&sgptDataTables->pMonStatsTxt[hcIdx]` (`imul 0x1a8`).
   - `0x6FC41F93`: reads `cx = row->wMinion[0]` (`mov 0x26(%ecx), %cx`).
   - If `0 <= wMinion[0] < nMonStatsTxtRecordCount`, returns `wMinion[0]`; otherwise returns `hcIdx` (the Unique boss's own class ID). `wMinion[1]` (`+0x28`) is never consulted for Unique boss minions.

3. **`D2Game.dll` Normal Party Minion Spawner (`0x6FD0E480`, called by `MONSTER_Create` `0x6FD0F41B` when `!(spawnFlags & 0x40)`)**:
   - `0x6FD0E4D9`: reads `wMinion[0]` (`+0x26`); returns immediately if `wMinion[0] < 0`.
   - `0x6FD0E5F5..0x6FD0E622`: reads `wMinion[1]` (`+0x28`); sets `maxIdx = 1` if `0 <= wMinion[1] < nMonStatsTxtRecordCount`, else `maxIdx = 0`.
   - `0x6FD0E623..0x6FD0E644`: rolls `partyCount` in `[nPartyMin, nPartyMax]` (`+0x2c`, `+0x2d`); returns if `partyCount <= 0`.
   - `0x6FD0E650..0x6FD0E6D1`: loops `partyCount` times, spawning `row->wMinion[idx]` (`movswl 0x26(%ebx,%ecx,2), %eax`) with `spawnFlags | 0x40` (preventing recursive party expansion) and advancing `idx = (idx + 1 > maxIdx) ? 0 : idx + 1` (round-robin).
