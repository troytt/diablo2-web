# Act 3 Quest 5 (`a3q5`, "The Blackened Temple") — Travincal Council & Drops (`D2Game.dll` 1.13c)

## 1. Authoritative Binary & MPQ Data

- **`D2Game.dll` `0x6FD09200` (`ACT3Q5_InitQuestData`, `questId = 0x15` = 21 `a3q5`)**:
  - Registers `Callback08_MonsterKilled = 0x6FD07DB0` and `Callback03_ChangedLevel = 0x6FD07560`.
- **`SuperUniques.txt` (`SUPERUNIQUES_113C_ROWS[26..31, 64]`)**:
  - **Travincal (`Area 83`)** only spawns two `MonStats.txt` Council `defId`s:
    - `26 Ismail Vilehand` -> `councilmember1` (`hcIdx 345`, `minGrp = 2, maxGrp = 2`)
    - `27 Geleb Flamefinger` -> `councilmember2` (`hcIdx 346`, `minGrp = 2, maxGrp = 2`)
    - `29 Toorc Icefist` -> `councilmember1` (`hcIdx 345`, `minGrp = 0, maxGrp = 0`)
  - **`councilmember3` (`hcIdx 347`)** never spawns in Travincal (`Area 83`); it only spawns in **Durance of Hate Level 3 (`Area 102`)** (`28 Bremm Sparkfist`, `31 Maffer Dragonhand`) and **Throne of Destruction (`Area 131`)** (`64 Bartuc the Bloody`).
- **`D2Game.dll` `0x6FC454B6 -> 0x6FC56050 -> 0x6FD073C0` (`ACT3Q5_RegisterSpawnedCouncilMember`)**:
  - Invoked when spawning Travincal Council Members (`areaId < 0x6C`, excluding Durance `102` and Throne `131`).
  - Records individual spawned `pMonster->dwUnitId` GUIDs in `[pQuestEx+0x10..0x24]` and tracks spawned (`[pQuestEx+0x30]`) and remaining (`[pQuestEx+0x34]`) Council counts.

## 2. Monster Death Callback (`0x6FD07DB0`)

1. **`0x6FD07E2F..0x6FD07EA2` — First Travincal Council Kill Drops `'qf1'` (`Khalim's Flail`)**:
   - Guarded by per-game flag `[pQuestEx+0x0D]` (`0 -> 1`).
   - Calls `0x6FD036A0` across quest-eligible players in the area: if any player has not completed `a3q3` (`0x12`) and lacks `'qf1'` / `'qf2'`, spawns `'qf1'` (`Khalim's Flail`) at the slain Council Member's coordinates.
2. **`0x6FD07EA4..0x6FD07EF3` — Subsequent Travincal Council Kill Drops Backup `'box'` (`Horadric Cube`)**:
   - Guarded by per-game flag `[pQuestEx+0x0E]` (`0 -> 1`).
   - If any quest-eligible player in Travincal (`Area 83`) lacks `'box'` (`Horadric Cube`), drops `'box'` so players who lost their Horadric Cube can transmute Khalim's Will (`'qf2'`).
3. **`0x6FD07F00..0x6FD07FB9` — `a3q5` Quest Completion**:
   - Decrements remaining Travincal Council count (`[pQuestEx+0x34]`); when `0` living Travincal Council Members remain, sets `QUEST_FLAG_COMPLETED_113C` on `a3q5` for quest-eligible party recipients in the area.
   - Council Members killed in Durance of Hate Level 3 (`Area 102`) or Throne of Destruction (`Area 131`) never trigger `a3q5` or drop `'qf1'`/`'box'`.
4. **`0x6FD0A22C..0x6FD0A262` (`ACT3Q3_OperateCompellingOrb`)**:
   - Smashing Compelling Orb (`Objects.txt 404`) with `'qf2'` also completes `a3q5` if not already completed.
