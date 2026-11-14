# 1.13c Room Monster Density, Group Size & `sparsePopulate` (`D2Game.dll` `0x6FC67A20`)

## Binary Ground Truth (`samples/d2/D2Game.dll` & `samples/d2/D2Common.dll`)

### 1. Per-Room Attempt Count & `MonDen` Roll (`D2Game.dll` `0x6FC67A20`)

- **Function VA**: `0x6FC67A20` (image base `0x6FC20000`).
- **`MonDen` Cap (`0x6FC67A61..0x6FC67A72`)**:
  - Reads `pRegion->dwMonDen` at `[ebx+0x2b8]` (populated from `Levels.txt` `MonDen` / `MonDen(N)` / `MonDen(H)` at `+0x1c + difficulty * 4` by `0x6FCEABE8`).
  - If `dwMonDen > 10000` (`0x2710`), clamps `[ebx+0x2b8] = 10000`.
  - If `dwMonDen <= 0`, exits immediately (`0x6FC67A74..0x6FC67A81`).
- **Sub-tile Attempt Grid (`0x6FC67AD3..0x6FC67B17`)**:
  - Converts room tile bounds to sub-tiles via `D2Common.#11158` (`x *= 5`, `y *= 5`).
  - Divides room sub-tile width and height by `3` (`imul 0x55555556`) and multiplies them:
    ```
    attempts = Math.floor(wSub / 3) * Math.floor(hSub / 3)
    ```
- **Per-Attempt Independent Roll (`0x6FC67B39..0x6FC67B64`)**:
  - Picks a random sub-tile coordinate inside the room.
  - Rolls `r = rand() % 100000` (`mov ecx, 0x186a0; div ecx`).
  - Continues only when `r <= min(MonDen, 10000)` (`cmp edx, [ebx+0x2b8]; jg skip`).

### 2. Monster Kind Selection (`D2Game.dll` `0x6FCFF4A0`)

- Called at `0x6FC67B78` with `eax = 0` (normal branch `0x6FCFF51D..0x6FCFF565`):
  - Sums `Rarity` (`MonStats.bin +0x2e`) across the level's active monster table.
  - Rolls `1 + (rand() % totalRarity)` and walks the level's monster entries subtracting each `Rarity` until `<= 0`.

### 3. `sparsePopulate` Gate & Full `MinGrp..MaxGrp` Pack Spawn (`0x6FC67BC6..0x6FC67C33` & `0x6FC67700`)

- **`D2Common.dll` `MonStats.txt` Field Offsets (`0x6FDAADEE`)**:
  - `+0x2e`: `Rarity` (`uint8`)
  - `+0x2f`: `MinGrp` (`uint8`)
  - `+0x30`: `MaxGrp` (`uint8`)
  - `+0x31`: `sparsePopulate` (`uint8`)
- **`sparsePopulate` Gate (`0x6FC67BD4..0x6FC67C13`)**:
  - Reads `sparsePopulate = pMonStatsTxt->nSparsePopulate` (`[eax+0x31]`).
  - When `0 < sparsePopulate < 100` (`0x64`), rolls `r = rand() % 100` (`mov ecx, 0x64; div ecx`) and skips the pack if `r > sparsePopulate` (`cmp edx, sparsePopulate; jg skip`, pass probability `(sparsePopulate + 1) / 100`).
- **Full `MinGrp..MaxGrp` Pack Spawn (`0x6FC67700`)**:
  - Spawns the first member via `0x6FD0F510`, decrements `minGrp` and `maxGrp`, and spawns `minGrp + (rand() % (maxGrp - minGrp + 1))` additional members via `0x6FD0F570`.
  - Every successful attempt spawns a full `MinGrp..MaxGrp` group without any room headcount budget truncation.
  - Note on `0x6FC66D40`: for `wBaseId == 19` (`fallen1`) or `wBaseId == 91` (`scarab1`), `0x6FC67C23` passes `(1, 1)` to `0x6FC67700` because `0x6FD0F510` invokes `0x6FD0E480` (`SetBoss == 1` party minion spawner) which spawns `PartyMin..PartyMax` members matching `MinGrp..MaxGrp`.

## 136-Level Full-Spectrum Audit Report (Normal Difficulty, 80×80 Tiles = 17,777 Attempts)

| Level ID | Level Name | MonDen | Legacy `expectedPacks*3` | 1.13c Analytical Expected | 1.13c Monte Carlo Avg (150 seeds) | Relative Error |
| ---: | :--- | ---: | ---: | ---: | ---: | ---: |
| 1 | Act 1 - Town | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 2 | Act 1 - Wilderness 1 | 520 | 277 | 169.80 | 170.89 | 0.64% |
| 3 | Act 1 - Wilderness 2 | 520 | 277 | 157.45 | 159.19 | 1.11% |
| 4 | Act 1 - Wilderness 3 | 520 | 277 | 115.77 | 114.60 | 1.01% |
| 5 | Act 1 - Wilderness 4 | 520 | 277 | 200.67 | 200.11 | 0.28% |
| 6 | Act 1 - Wilderness 5 | 520 | 277 | 166.71 | 165.03 | 1.01% |
| 7 | Act 1 - Wilderness 6 | 520 | 277 | 250.07 | 248.87 | 0.48% |
| 8 | Act 1 - Cave 1 | 600 | 320 | 128.21 | 127.05 | 0.90% |
| 9 | Act 1 - Cave 2 | 600 | 320 | 203.00 | 200.33 | 1.31% |
| 10 | Act 1 - Cave 3 | 600 | 320 | 267.10 | 266.09 | 0.38% |
| 11 | Act 1 - Cave 4 | 600 | 320 | 253.74 | 250.81 | 1.16% |
| 12 | Act 1 - Cave 5 | 600 | 320 | 331.20 | 331.67 | 0.14% |
| 13 | Act 1 - Cave 2 Treasure | 600 | 320 | 203.00 | 205.53 | 1.25% |
| 14 | Act 1 - Cave 3 Treasure | 600 | 320 | 224.36 | 223.41 | 0.42% |
| 15 | Act 1 - Cave 4 Treasure | 600 | 320 | 253.74 | 254.77 | 0.41% |
| 16 | Act 1 - Cave 5 Treasure | 600 | 320 | 352.57 | 356.55 | 1.13% |
| 17 | Act 1 - Graveyard | 520 | 277 | 185.24 | 183.35 | 1.02% |
| 18 | Act 1 - Crypt 1 A | 1056 | 563 | 375.81 | 374.10 | 0.45% |
| 19 | Act 1 - Crypt 2 A | 1056 | 563 | 375.81 | 373.53 | 0.61% |
| 20 | Act 1 - Tower 2 | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 21 | Act 1 - Crypt 3 A | 1024 | 546 | 546.64 | 543.75 | 0.53% |
| 22 | Act 1 - Crypt 3 B | 1024 | 546 | 394.80 | 397.20 | 0.61% |
| 23 | Act 1 - Crypt 3 C | 1024 | 546 | 501.09 | 500.01 | 0.21% |
| 24 | Act 1 - Crypt 3 D | 1024 | 546 | 501.09 | 503.43 | 0.47% |
| 25 | Act 1 - Crypt 3 E | 1024 | 546 | 501.09 | 501.85 | 0.15% |
| 26 | Act 1 - Monastery | 600 | 320 | 249.29 | 250.43 | 0.46% |
| 27 | Act 1 - Courtyard 1 | 600 | 320 | 341.89 | 338.47 | 1.00% |
| 28 | Act 1 - Barracks | 680 | 363 | 343.01 | 344.85 | 0.54% |
| 29 | Act 1 - Jail 1 | 680 | 363 | 363.18 | 365.21 | 0.56% |
| 30 | Act 1 - Jail 2 | 680 | 363 | 343.01 | 341.44 | 0.46% |
| 31 | Act 1 - Jail 3 | 680 | 363 | 272.39 | 273.24 | 0.31% |
| 32 | Act 1 - Courtyard 2 | 720 | 384 | 384.52 | 383.41 | 0.29% |
| 33 | Act 1 - Cathedral | 680 | 363 | 211.86 | 213.48 | 0.77% |
| 34 | Act 1 - Catacombs 1 | 680 | 363 | 181.59 | 182.33 | 0.41% |
| 35 | Act 1 - Catacombs 2 | 680 | 363 | 226.99 | 229.19 | 0.97% |
| 36 | Act 1 - Catacombs 3 | 680 | 363 | 257.26 | 259.43 | 0.85% |
| 37 | Act 1 - Catacombs 4 | 680 | 363 | 302.65 | 300.61 | 0.67% |
| 38 | Act 1 - Tristram | 520 | 277 | 129.67 | 129.93 | 0.21% |
| 39 | Act 1 - Moo Moo Farm | 800 | 427 | 1067.95 | 1060.01 | 0.74% |
| 40 | Act 2 - Town | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 41 | Act 2 - Desert 1 | 880 | 469 | 365.44 | 366.99 | 0.43% |
| 42 | Act 2 - Desert 2 | 880 | 469 | 391.54 | 390.29 | 0.32% |
| 43 | Act 2 - Desert 3 | 880 | 469 | 450.27 | 455.56 | 1.18% |
| 44 | Act 2 - Desert 4 | 880 | 469 | 443.74 | 440.50 | 0.73% |
| 45 | Act 2 - Desert 5 | 880 | 469 | 261.03 | 257.78 | 1.24% |
| 46 | Act 2 - Valley of the Kings | 880 | 469 | 391.54 | 392.40 | 0.22% |
| 47 | Act 2 - Sewer 1 A | 680 | 363 | 351.08 | 350.53 | 0.16% |
| 48 | Act 2 - Sewer 1 B | 680 | 363 | 363.18 | 364.22 | 0.29% |
| 49 | Act 2 - Sewer 1 C | 680 | 363 | 338.97 | 339.16 | 0.06% |
| 50 | Act 2 - Harem | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 51 | Act 2 - Corrupt Harem 1 | 2200 | 1173 | 1212.94 | 1205.80 | 0.59% |
| 52 | Act 2 - Basement 1 | 2200 | 1173 | 1076.00 | 1072.47 | 0.33% |
| 53 | Act 2 - Basement 2 | 2200 | 1173 | 1212.94 | 1209.24 | 0.31% |
| 54 | Act 2 - Basement 3 | 2200 | 1173 | 1076.00 | 1074.31 | 0.16% |
| 55 | Act 2 - Tomb 1 A | 2200 | 1173 | 1095.56 | 1097.01 | 0.13% |
| 56 | Act 2 - Tomb 2 A | 2200 | 1173 | 717.33 | 713.55 | 0.53% |
| 57 | Act 2 - Tomb 2 B | 2200 | 1173 | 912.97 | 915.67 | 0.30% |
| 58 | Act 2 - Tomb 3 A | 2200 | 1173 | 847.76 | 848.25 | 0.06% |
| 59 | Act 2 - Tomb 1 Treasure | 2200 | 1173 | 1095.56 | 1093.39 | 0.20% |
| 60 | Act 2 - Tomb 2 Treasure | 2200 | 1173 | 521.70 | 521.87 | 0.03% |
| 61 | Act 2 - Tomb 3 Treasure | 2200 | 1173 | 1108.60 | 1108.50 | 0.01% |
| 62 | Act 2 - Lair 1 A | 990 | 528 | 822.13 | 815.57 | 0.80% |
| 63 | Act 2 - Lair 1 B | 990 | 528 | 499.15 | 497.47 | 0.34% |
| 64 | Act 2 - Lair 1 Treasure | 990 | 528 | 499.15 | 498.34 | 0.16% |
| 65 | Act 2 - Sewer 2 A | 680 | 363 | 399.50 | 394.29 | 1.31% |
| 66 | Act 2 - Tomb Tal 1 | 2200 | 1173 | 912.97 | 915.44 | 0.27% |
| 67 | Act 2 - Tomb Tal 2 | 2200 | 1173 | 782.54 | 778.57 | 0.51% |
| 68 | Act 2 - Tomb Tal 3 | 2200 | 1173 | 978.18 | 974.34 | 0.39% |
| 69 | Act 2 - Tomb Tal 4 | 2200 | 1173 | 1239.03 | 1239.22 | 0.02% |
| 70 | Act 2 - Tomb Tal 5 | 2200 | 1173 | 912.97 | 916.94 | 0.44% |
| 71 | Act 2 - Tomb Tal 6 | 2200 | 1173 | 1043.39 | 1035.95 | 0.71% |
| 72 | Act 2 - Tomb Tal 7 | 2200 | 1173 | 717.33 | 723.47 | 0.86% |
| 73 | Act 2 - Duriel's Lair | 2200 | 1173 | 1043.39 | 1042.79 | 0.06% |
| 74 | Act 2 - Arcane | 990 | 528 | 440.43 | 442.09 | 0.38% |
| 75 | Act 3 - Town | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 76 | Act 3 - Jungle 1 | 650 | 347 | 231.46 | 228.67 | 1.20% |
| 77 | Act 3 - Jungle 2 | 650 | 347 | 303.79 | 306.63 | 0.93% |
| 78 | Act 3 - Jungle 3 | 650 | 347 | 327.90 | 330.67 | 0.85% |
| 79 | Act 3 - Kurast 1 | 325 | 173 | 154.54 | 153.79 | 0.49% |
| 80 | Act 3 - Kurast 2 | 325 | 173 | 231.81 | 233.01 | 0.52% |
| 81 | Act 3 - Kurast 3 | 325 | 173 | 173.86 | 173.92 | 0.04% |
| 82 | Act 3 - Kurast 4 | 325 | 173 | 173.86 | 174.73 | 0.50% |
| 83 | Act 3 - Travincal | 325 | 173 | 86.93 | 85.39 | 1.77% |
| 84 | Act 3 - Spider 1 | 700 | 373 | 394.62 | 391.69 | 0.74% |
| 85 | Act 3 - Spider 2 | 700 | 373 | 373.85 | 369.57 | 1.15% |
| 86 | Act 3 - Dungeon 1 A | 700 | 373 | 394.62 | 391.17 | 0.87% |
| 87 | Act 3 - Dungeon 1 B | 700 | 373 | 342.70 | 344.09 | 0.41% |
| 88 | Act 3 - Dungeon 2 A | 700 | 373 | 228.46 | 226.67 | 0.79% |
| 89 | Act 3 - Dungeon 2 B | 700 | 373 | 207.69 | 204.45 | 1.56% |
| 90 | Act 3 - Dungeon 1 Treasure | 700 | 373 | 332.31 | 328.44 | 1.16% |
| 91 | Act 3 - Dungeon 2 Treasure | 700 | 373 | 270.00 | 272.82 | 1.04% |
| 92 | Act 3 - Sewer 1 | 650 | 347 | 308.61 | 307.39 | 0.39% |
| 93 | Act 3 - Sewer 2 | 650 | 347 | 231.46 | 235.79 | 1.87% |
| 94 | Act 3 - Temple 1 | 990 | 528 | 557.87 | 559.29 | 0.25% |
| 95 | Act 3 - Temple 2 | 990 | 528 | 557.87 | 560.27 | 0.43% |
| 96 | Act 3 - Temple 3 | 990 | 528 | 616.60 | 613.43 | 0.51% |
| 97 | Act 3 - Temple 4 | 990 | 528 | 587.23 | 596.49 | 1.58% |
| 98 | Act 3 - Temple 5 | 990 | 528 | 675.32 | 675.35 | 0.00% |
| 99 | Act 3 - Temple 6 | 990 | 528 | 645.96 | 649.09 | 0.48% |
| 100 | Act 3 - Mephisto 1 | 800 | 427 | 474.65 | 468.23 | 1.35% |
| 101 | Act 3 - Mephisto 2 | 800 | 427 | 355.98 | 354.86 | 0.32% |
| 102 | Act 3 - Mephisto 3 | 800 | 427 | 355.98 | 357.47 | 0.42% |
| 103 | Act 4 - Town | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 104 | Act 4 - Mesa 1 | 800 | 427 | 213.59 | 216.29 | 1.27% |
| 105 | Act 4 - Mesa 2 | 800 | 427 | 261.06 | 261.20 | 0.06% |
| 106 | Act 4 - Mesa 3 | 800 | 427 | 391.58 | 388.52 | 0.78% |
| 107 | Act 4 - Lava 1 | 800 | 427 | 332.25 | 329.15 | 0.93% |
| 108 | Act 4 - Diablo 1 | 800 | 427 | 308.52 | 311.13 | 0.85% |
| 109 | Act 5 - Town | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 110 | Act 5 - Siege 1 | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 111 | Act 5 - Barricade 1 | 450 | 240 | 180.39 | 182.33 | 1.08% |
| 112 | Act 5 - Barricade 2 | 350 | 187 | 155.99 | 157.48 | 0.95% |
| 113 | Act 5 - Ice Cave 1 | 700 | 373 | 311.54 | 310.98 | 0.18% |
| 114 | Act 5 - Ice Cave 1A | 800 | 427 | 498.38 | 502.10 | 0.75% |
| 115 | Act 5 - Ice Cave 2 | 700 | 373 | 405.00 | 403.77 | 0.31% |
| 116 | Act 5 - Ice Cave 2A | 600 | 320 | 347.23 | 345.37 | 0.54% |
| 117 | Act 5 - Barricade Snow | 550 | 293 | 220.39 | 216.29 | 1.86% |
| 118 | Act 5 - Ice Cave 3 | 650 | 347 | 327.90 | 332.05 | 1.27% |
| 119 | Act 5 - Ice Cave 3A | 650 | 347 | 376.12 | 374.53 | 0.42% |
| 120 | Act 5 - Mountain Top | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 121 | Act 5 - Temple Entrance | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 122 | Act 5 - Temple 1 | 700 | 373 | 311.54 | 313.32 | 0.57% |
| 123 | Act 5 - Temple 2 | 700 | 373 | 436.16 | 435.51 | 0.15% |
| 124 | Act 5 - Temple Boss | 700 | 373 | 415.39 | 414.43 | 0.23% |
| 125 | Act 5 - Hell 1 | 800 | 427 | 355.98 | 356.71 | 0.20% |
| 126 | Act 5 - Hell 2 | 800 | 427 | 213.59 | 215.15 | 0.73% |
| 127 | Act 5 - Hell 3 | 700 | 373 | 311.54 | 312.53 | 0.32% |
| 128 | Act 5 - Baal Temple 1 | 700 | 373 | 373.85 | 370.45 | 0.91% |
| 129 | Act 5 - Baal Temple 2 | 700 | 373 | 311.54 | 306.02 | 1.77% |
| 130 | Act 5 - Baal Temple 3 | 700 | 373 | 311.54 | 311.21 | 0.11% |
| 131 | Act 5 - Throne Room | 700 | 373 | 311.54 | 311.42 | 0.04% |
| 132 | Act 5 - World Stone | 0 | 0 | 0.00 | 0.00 | 0.00% |
| 133 | Act 5 - Pandemonium 1 | 1056 | 563 | 782.93 | 781.19 | 0.22% |
| 134 | Act 5 - Pandemonium 2 | 880 | 469 | 887.49 | 879.03 | 0.95% |
| 135 | Act 5 - Pandemonium 3 | 800 | 427 | 355.98 | 351.45 | 1.27% |
| 136 | Act 5 - Pandemonium Finale | 0 | 0 | 0.00 | 0.00 | 0.00% |


### 4. Per-Attempt Elite Pack Roll (`D2Game.dll` `0x6FC66CD0`, `0x6FCFF080` & `0x6FC43260`)

- **Room Counter Increment (`0x6FC66CD0` at `0x6FC66CE5`)**:
  - Each DRLG room activation increments `pMonsterRegion->dwRoomsPopulated` (`inc DWORD PTR [esi+0x2c4]`) before calling `0x6FC67A20`.
  - `pMonsterRegion` elite progression fields:
    - `+0x2bc` (`uint8`): `nMonUMin` (`Levels.txt` `MonUMin` / `MonUMin(N)` / `MonUMin(H)`)
    - `+0x2bd` (`uint8`): `nMonUMax` (`Levels.txt` `MonUMax` / `MonUMax(N)` / `MonUMax(H)`)
    - `+0x2c0` (`dword`): `dwNumRooms` (total DRLG rooms in the level)
    - `+0x2c4` (`dword`): `dwRoomsPopulated` (rooms populated so far)
    - `+0x2c8` (`dword`): `dwUniquePacksSpawned` (incremented in `0x6FC43260` at `0x6FC4326E`; decremented on placement failure at `0x6FC44ADB`)
- **Per-Attempt Elite vs. Normal Roll (`0x6FCFF080`, called at `0x6FC67B8E`)**:
  - Guard (`0x6FCFF08F..0x6FCFF09B`): if `nMonUMax < nMonUMin`, jumps to `L_normal`.
  - **Step A — Catch-up to `MonUMin` (`0x6FCFF09D..0x6FCFF0D8`)**:
    - When `dwUniquePacksSpawned < nMonUMin` and `dwNumRooms > 0`:
    - Rolls `r = rand() % 100` and compares against `threshold = trunc((dwRoomsPopulated * 100) / dwNumRooms)`.
    - If `r < threshold`, returns `0` (elite pack). Otherwise falls through (`jge L_max`) to Step B.
  - **Step B — 6% Bonus Roll up to `MonUMax` (`0x6FCFF0DA..0x6FCFF102`, `L_max`)**:
    - When `dwUniquePacksSpawned < nMonUMax`:
    - Rolls `r = rand() % 100`. If `r <= 5` (6% chance), returns `0` (elite pack).
  - **Step C — Normal Pack (`0x6FCFF104..0x6FCFF123`, `L_normal`)**:
    - Caller `0x6FC67B93` treats both non-zero return values (`1` and `2`) identically as a normal pack.

### 5. Difficulty-Specific Elite Candidate Pool & Empty `umon` Behavior (`D2Game.dll` `0x6FCFF4A0` & `0x6FC43CA0`)

- **`D2Common.dll` `Levels.txt` `mon`/`nmon`/`umon` Compiler (`0x6FDBF9B0..0x6FDBFA7A`)**:
  - Counts valid `>= 0` `MonStats.txt` indices in `umon1..25` (`+0x9a`) into `pLevelsTxt->nNumUMon` (`+0x35`) without copying `mon` or `nmon` into `umon`.
- **`D2Game.dll` `0x6FCFF4A0` (`eax = 1` Elite Selection)**:
  - Checks `pGame->nDifficulty` (`[ecx+0x6d]`) at `0x6FCFF4BF`:
    - **Nightmare & Hell (`nDifficulty != 0`, `0x6FCFF4C4: jne 0x6FCFF523`)**: jumps to `normal_pick` (`0x6FCFF523`), selecting from the level's chosen monster table (`types`, drawn from `nmon1..10`) weighted by `Rarity`.
    - **Normal (`nDifficulty == 0`, `0x6FCFF4D5..0x6FCFF518`)**: reads `nNumUMon = [edi+0x35]`. If `nNumUMon > 0`, picks uniformly `umon[rand() % nNumUMon]`.
    - **Empty `umon` on Normal (`nNumUMon == 0`, `0x6FCFF4D7: je 0x6FCFF52A`)**: sets `*ppMonStatsTxt = NULL` and returns `0`. `0x6FC679B0 -> 0x6FC43CA0` (`0x6FC43CB1: test edi, edi; je 0x6FC43EE4`) immediately aborts without spawning any monster and without incrementing `dwUniquePacksSpawned`.
    - Across all 136 levels in `Levels.txt`, 11 levels have `nNumUMon == 0`: 5 towns (`1, 40, 75, 103, 109`), 5 zero-density transition/boss rooms (`20, 50, 121, 132, 136`), and Act 5 Level `110` (`Act 5 - Siege 1` / Bloody Foothills, `MonDen = [0, 650, 650]`, `MonUMin = [1, 3, 4]`, `MonUMax = [2, 5, 6]`).

## 136-Level Expected Elite Pack Spectrum (Normal / Nightmare / Hell, 3×3 Rooms, 50 Seeds)

| Level ID | Level Name | `umon` Count | `nmon` Count | `MonUMin..Max` (N) | Avg Elites (N) | `MonUMin..Max` (NM) | Avg Elites (NM) | `MonUMin..Max` (H) | Avg Elites (H) |
| ---: | :--- | ---: | ---: | :---: | ---: | :---: | ---: | :---: | ---: |
| 1 | Act 1 - Town | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 2 | Act 1 - Wilderness 1 | 3 | 3 | 0..0 | 0.00 | 4..5 | 3.38 | 7..9 | 4.36 |
| 3 | Act 1 - Wilderness 2 | 4 | 4 | 1..1 | 0.98 | 4..5 | 3.54 | 7..9 | 4.54 |
| 4 | Act 1 - Wilderness 3 | 5 | 5 | 1..2 | 1.18 | 4..6 | 3.60 | 7..9 | 4.52 |
| 5 | Act 1 - Wilderness 4 | 5 | 5 | 1..2 | 1.28 | 4..6 | 3.42 | 7..9 | 4.24 |
| 6 | Act 1 - Wilderness 5 | 6 | 6 | 1..2 | 1.20 | 4..6 | 3.34 | 7..9 | 4.14 |
| 7 | Act 1 - Wilderness 6 | 5 | 5 | 1..2 | 1.12 | 4..6 | 3.40 | 7..9 | 4.44 |
| 8 | Act 1 - Cave 1 | 3 | 3 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 9 | Act 1 - Cave 2 | 3 | 3 | 1..2 | 1.42 | 4..6 | 3.72 | 6..8 | 4.48 |
| 10 | Act 1 - Cave 3 | 4 | 4 | 1..2 | 1.32 | 4..6 | 3.84 | 6..8 | 4.86 |
| 11 | Act 1 - Cave 4 | 4 | 4 | 1..2 | 1.34 | 4..6 | 3.56 | 6..8 | 4.38 |
| 12 | Act 1 - Cave 5 | 4 | 4 | 1..2 | 1.28 | 4..6 | 3.60 | 6..8 | 4.44 |
| 13 | Act 1 - Cave 2 Treasure | 3 | 3 | 1..2 | 1.24 | 2..3 | 2.10 | 2..3 | 2.10 |
| 14 | Act 1 - Cave 3 Treasure | 4 | 4 | 1..2 | 1.30 | 2..3 | 2.16 | 2..3 | 2.16 |
| 15 | Act 1 - Cave 4 Treasure | 4 | 4 | 1..2 | 1.32 | 2..3 | 2.22 | 2..3 | 2.22 |
| 16 | Act 1 - Cave 5 Treasure | 4 | 4 | 1..2 | 1.30 | 2..3 | 2.18 | 2..3 | 2.18 |
| 17 | Act 1 - Graveyard | 2 | 2 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 18 | Act 1 - Crypt 1 A | 2 | 2 | 1..1 | 1.00 | 3..4 | 3.36 | 4..5 | 4.26 |
| 19 | Act 1 - Crypt 2 A | 2 | 2 | 1..1 | 1.00 | 3..4 | 3.28 | 4..5 | 4.22 |
| 20 | Act 1 - Tower 2 | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 21 | Act 1 - Crypt 3 A | 4 | 4 | 1..1 | 1.00 | 2..3 | 2.52 | 3..4 | 3.42 |
| 22 | Act 1 - Crypt 3 B | 4 | 4 | 1..1 | 1.00 | 2..3 | 2.26 | 3..4 | 3.28 |
| 23 | Act 1 - Crypt 3 C | 4 | 4 | 1..1 | 1.00 | 2..3 | 2.38 | 3..4 | 3.32 |
| 24 | Act 1 - Crypt 3 D | 4 | 4 | 1..1 | 1.00 | 2..3 | 2.36 | 3..4 | 3.26 |
| 25 | Act 1 - Crypt 3 E | 4 | 4 | 1..1 | 1.00 | 2..3 | 2.44 | 3..4 | 3.32 |
| 26 | Act 1 - Monastery | 4 | 4 | 0..1 | 0.42 | 0..1 | 0.42 | 1..2 | 1.30 |
| 27 | Act 1 - Courtyard 1 | 4 | 4 | 0..1 | 0.36 | 1..2 | 1.30 | 2..3 | 2.16 |
| 28 | Act 1 - Barracks | 5 | 5 | 1..2 | 1.36 | 4..5 | 3.88 | 6..8 | 5.04 |
| 29 | Act 1 - Jail 1 | 5 | 5 | 1..2 | 1.42 | 4..5 | 4.02 | 6..8 | 5.28 |
| 30 | Act 1 - Jail 2 | 5 | 5 | 1..2 | 1.36 | 4..5 | 4.00 | 6..8 | 5.18 |
| 31 | Act 1 - Jail 3 | 5 | 5 | 1..2 | 1.36 | 4..5 | 3.98 | 6..8 | 5.12 |
| 32 | Act 1 - Courtyard 2 | 3 | 3 | 0..1 | 0.38 | 1..2 | 1.28 | 2..2 | 1.98 |
| 33 | Act 1 - Cathedral | 3 | 3 | 1..2 | 1.22 | 2..3 | 2.14 | 3..3 | 2.84 |
| 34 | Act 1 - Catacombs 1 | 3 | 3 | 1..2 | 1.28 | 4..5 | 3.92 | 6..8 | 5.14 |
| 35 | Act 1 - Catacombs 2 | 3 | 3 | 1..2 | 1.28 | 4..5 | 3.88 | 6..8 | 5.02 |
| 36 | Act 1 - Catacombs 3 | 3 | 3 | 1..2 | 1.44 | 4..5 | 3.90 | 6..8 | 4.86 |
| 37 | Act 1 - Catacombs 4 | 2 | 2 | 1..2 | 1.48 | 4..5 | 4.04 | 6..8 | 5.26 |
| 38 | Act 1 - Tristram | 4 | 4 | 1..2 | 1.28 | 3..4 | 2.98 | 5..6 | 4.06 |
| 39 | Act 1 - Moo Moo Farm | 3 | 3 | 0..1 | 0.42 | 3..4 | 3.24 | 6..8 | 5.36 |
| 40 | Act 2 - Town | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 41 | Act 2 - Desert 1 | 5 | 5 | 1..2 | 1.42 | 4..6 | 4.20 | 7..9 | 6.22 |
| 42 | Act 2 - Desert 2 | 4 | 4 | 1..2 | 1.40 | 4..6 | 4.24 | 7..9 | 6.48 |
| 43 | Act 2 - Desert 3 | 5 | 5 | 1..2 | 1.50 | 4..6 | 4.30 | 7..9 | 6.48 |
| 44 | Act 2 - Desert 4 | 5 | 5 | 1..2 | 1.46 | 4..6 | 4.22 | 7..9 | 6.26 |
| 45 | Act 2 - Desert 5 | 6 | 6 | 1..2 | 1.40 | 4..6 | 4.18 | 7..9 | 6.24 |
| 46 | Act 2 - Valley of the Kings | 5 | 5 | 0..0 | 0.00 | 3..4 | 3.34 | 7..9 | 6.62 |
| 47 | Act 2 - Sewer 1 A | 4 | 4 | 0..1 | 0.42 | 3..4 | 2.98 | 6..8 | 4.82 |
| 48 | Act 2 - Sewer 1 B | 4 | 4 | 0..1 | 0.36 | 3..4 | 3.02 | 6..8 | 4.98 |
| 49 | Act 2 - Sewer 1 C | 4 | 4 | 0..1 | 0.42 | 3..4 | 3.16 | 6..8 | 5.16 |
| 50 | Act 2 - Harem | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 51 | Act 2 - Corrupt Harem 1 | 5 | 5 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 52 | Act 2 - Basement 1 | 5 | 5 | 0..1 | 0.86 | 3..4 | 3.68 | 5..7 | 5.96 |
| 53 | Act 2 - Basement 2 | 5 | 5 | 0..1 | 0.90 | 3..4 | 3.84 | 5..7 | 6.10 |
| 54 | Act 2 - Basement 3 | 5 | 5 | 0..1 | 0.76 | 3..4 | 3.68 | 5..7 | 5.78 |
| 55 | Act 2 - Tomb 1 A | 3 | 3 | 0..1 | 0.86 | 3..4 | 3.76 | 6..8 | 6.98 |
| 56 | Act 2 - Tomb 2 A | 5 | 5 | 0..1 | 0.84 | 3..4 | 3.70 | 6..8 | 6.74 |
| 57 | Act 2 - Tomb 2 B | 5 | 5 | 0..1 | 0.82 | 3..4 | 3.64 | 6..8 | 6.82 |
| 58 | Act 2 - Tomb 3 A | 6 | 6 | 0..1 | 0.86 | 3..4 | 3.70 | 6..8 | 6.84 |
| 59 | Act 2 - Tomb 1 Treasure | 3 | 3 | 0..1 | 0.84 | 0..1 | 0.84 | 1..2 | 1.80 |
| 60 | Act 2 - Tomb 2 Treasure | 5 | 5 | 0..1 | 0.94 | 0..1 | 0.94 | 1..2 | 1.82 |
| 61 | Act 2 - Tomb 3 Treasure | 6 | 6 | 0..1 | 0.66 | 0..1 | 0.66 | 1..2 | 1.64 |
| 62 | Act 2 - Lair 1 A | 5 | 5 | 0..2 | 0.82 | 3..4 | 3.30 | 5..6 | 5.02 |
| 63 | Act 2 - Lair 1 B | 5 | 5 | 0..2 | 1.02 | 3..4 | 3.50 | 5..6 | 5.26 |
| 64 | Act 2 - Lair 1 Treasure | 5 | 5 | 0..2 | 0.70 | 2..3 | 2.46 | 4..5 | 4.24 |
| 65 | Act 2 - Sewer 2 A | 4 | 4 | 0..2 | 0.54 | 3..4 | 3.16 | 6..8 | 5.12 |
| 66 | Act 2 - Tomb Tal 1 | 7 | 7 | 0..2 | 1.40 | 4..6 | 5.08 | 7..9 | 7.92 |
| 67 | Act 2 - Tomb Tal 2 | 7 | 7 | 0..2 | 1.36 | 4..6 | 5.00 | 7..9 | 7.78 |
| 68 | Act 2 - Tomb Tal 3 | 7 | 7 | 0..2 | 1.46 | 4..6 | 5.00 | 7..9 | 7.94 |
| 69 | Act 2 - Tomb Tal 4 | 7 | 7 | 0..2 | 1.42 | 4..6 | 5.04 | 7..9 | 7.88 |
| 70 | Act 2 - Tomb Tal 5 | 7 | 7 | 0..2 | 1.48 | 4..6 | 5.04 | 7..9 | 7.82 |
| 71 | Act 2 - Tomb Tal 6 | 7 | 7 | 0..2 | 1.42 | 4..6 | 5.06 | 7..9 | 7.78 |
| 72 | Act 2 - Tomb Tal 7 | 7 | 7 | 0..2 | 1.50 | 4..6 | 5.22 | 7..9 | 7.96 |
| 73 | Act 2 - Duriel's Lair | 7 | 7 | 0..2 | 1.34 | 0..2 | 1.34 | 0..2 | 1.34 |
| 74 | Act 2 - Arcane | 3 | 3 | 0..1 | 0.56 | 4..5 | 4.18 | 7..9 | 6.62 |
| 75 | Act 3 - Town | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 76 | Act 3 - Jungle 1 | 6 | 6 | 1..2 | 1.30 | 4..6 | 3.78 | 10..15 | 5.70 |
| 77 | Act 3 - Jungle 2 | 6 | 6 | 1..2 | 1.36 | 4..6 | 3.84 | 10..15 | 5.56 |
| 78 | Act 3 - Jungle 3 | 7 | 7 | 1..2 | 1.34 | 4..6 | 3.86 | 10..15 | 5.46 |
| 79 | Act 3 - Kurast 1 | 4 | 4 | 1..2 | 1.04 | 4..6 | 2.62 | 7..9 | 2.84 |
| 80 | Act 3 - Kurast 2 | 4 | 4 | 1..2 | 1.14 | 4..6 | 2.56 | 7..9 | 2.84 |
| 81 | Act 3 - Kurast 3 | 4 | 4 | 1..2 | 1.22 | 4..6 | 2.80 | 7..9 | 3.12 |
| 82 | Act 3 - Kurast 4 | 3 | 3 | 1..2 | 1.10 | 4..6 | 2.76 | 7..9 | 2.92 |
| 83 | Act 3 - Travincal | 3 | 3 | 0..1 | 0.20 | 3..5 | 1.90 | 6..8 | 2.28 |
| 84 | Act 3 - Spider 1 | 5 | 5 | 0..1 | 0.36 | 3..4 | 3.16 | 4..5 | 4.08 |
| 85 | Act 3 - Spider 2 | 5 | 5 | 0..1 | 0.44 | 3..4 | 3.18 | 4..5 | 3.90 |
| 86 | Act 3 - Dungeon 1 A | 5 | 5 | 0..1 | 0.56 | 3..4 | 3.12 | 5..6 | 4.66 |
| 87 | Act 3 - Dungeon 1 B | 5 | 5 | 0..1 | 0.50 | 3..4 | 3.26 | 5..5 | 4.52 |
| 88 | Act 3 - Dungeon 2 A | 8 | 8 | 0..1 | 0.42 | 3..4 | 3.10 | 5..6 | 4.68 |
| 89 | Act 3 - Dungeon 2 B | 8 | 8 | 0..1 | 0.46 | 3..4 | 3.32 | 5..5 | 4.78 |
| 90 | Act 3 - Dungeon 1 Treasure | 4 | 4 | 0..1 | 0.44 | 1..2 | 1.40 | 2..3 | 2.24 |
| 91 | Act 3 - Dungeon 2 Treasure | 8 | 8 | 0..1 | 0.52 | 1..2 | 1.40 | 2..3 | 2.24 |
| 92 | Act 3 - Sewer 1 | 5 | 5 | 1..2 | 1.32 | 3..4 | 3.04 | 6..7 | 5.08 |
| 93 | Act 3 - Sewer 2 | 5 | 5 | 1..2 | 1.32 | 3..4 | 3.08 | 6..7 | 5.20 |
| 94 | Act 3 - Temple 1 | 4 | 4 | 1..2 | 1.44 | 1..2 | 1.44 | 2..2 | 2.00 |
| 95 | Act 3 - Temple 2 | 4 | 4 | 1..2 | 1.42 | 1..2 | 1.42 | 2..2 | 2.00 |
| 96 | Act 3 - Temple 3 | 4 | 4 | 1..2 | 1.44 | 1..2 | 1.44 | 2..2 | 2.00 |
| 97 | Act 3 - Temple 4 | 4 | 4 | 1..2 | 1.36 | 1..2 | 1.36 | 2..2 | 1.98 |
| 98 | Act 3 - Temple 5 | 4 | 4 | 1..2 | 1.34 | 1..2 | 1.34 | 2..2 | 2.00 |
| 99 | Act 3 - Temple 6 | 4 | 4 | 1..2 | 1.60 | 1..2 | 1.60 | 2..2 | 2.00 |
| 100 | Act 3 - Mephisto 1 | 4 | 4 | 1..2 | 1.50 | 3..4 | 3.34 | 5..7 | 5.06 |
| 101 | Act 3 - Mephisto 2 | 4 | 4 | 1..2 | 1.48 | 3..4 | 3.28 | 5..7 | 4.94 |
| 102 | Act 3 - Mephisto 3 | 2 | 2 | 1..2 | 1.42 | 3..4 | 3.28 | 5..7 | 4.96 |
| 103 | Act 4 - Town | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 104 | Act 4 - Mesa 1 | 6 | 6 | 0..1 | 0.58 | 5..6 | 4.74 | 8..10 | 5.74 |
| 105 | Act 4 - Mesa 2 | 6 | 6 | 0..1 | 0.54 | 5..6 | 4.90 | 8..10 | 6.82 |
| 106 | Act 4 - Mesa 3 | 7 | 7 | 0..1 | 0.54 | 5..6 | 4.90 | 8..10 | 6.46 |
| 107 | Act 4 - Lava 1 | 7 | 7 | 0..1 | 0.60 | 4..5 | 4.18 | 6..7 | 5.44 |
| 108 | Act 4 - Diablo 1 | 3 | 3 | 0..1 | 0.50 | 4..5 | 4.06 | 6..7 | 5.68 |
| 109 | Act 5 - Town | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 110 | Act 5 - Siege 1 | 0 | 10 | 1..2 | 0.00 | 3..5 | 3.20 | 4..6 | 3.92 |
| 111 | Act 5 - Barricade 1 | 1 | 10 | 1..2 | 1.22 | 6..7 | 4.10 | 9..11 | 4.44 |
| 112 | Act 5 - Barricade 2 | 1 | 10 | 1..2 | 1.04 | 6..7 | 2.80 | 9..11 | 2.82 |
| 113 | Act 5 - Ice Cave 1 | 2 | 10 | 0..1 | 0.54 | 4..5 | 3.88 | 7..9 | 5.42 |
| 114 | Act 5 - Ice Cave 1A | 3 | 10 | 0..1 | 0.52 | 3..4 | 3.20 | 6..8 | 5.02 |
| 115 | Act 5 - Ice Cave 2 | 2 | 10 | 0..1 | 0.40 | 4..5 | 4.06 | 7..9 | 5.90 |
| 116 | Act 5 - Ice Cave 2A | 2 | 10 | 0..1 | 0.42 | 3..4 | 3.08 | 6..8 | 4.80 |
| 117 | Act 5 - Barricade Snow | 1 | 10 | 2..3 | 2.08 | 4..6 | 3.50 | 9..11 | 4.48 |
| 118 | Act 5 - Ice Cave 3 | 2 | 10 | 0..1 | 0.54 | 4..5 | 3.86 | 7..9 | 5.22 |
| 119 | Act 5 - Ice Cave 3A | 3 | 10 | 0..1 | 0.48 | 3..4 | 3.06 | 6..8 | 4.74 |
| 120 | Act 5 - Mountain Top | 3 | 3 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 121 | Act 5 - Temple Entrance | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 122 | Act 5 - Temple 1 | 2 | 10 | 0..0 | 0.00 | 2..3 | 2.18 | 6..7 | 5.32 |
| 123 | Act 5 - Temple 2 | 3 | 10 | 0..0 | 0.00 | 2..3 | 2.18 | 6..7 | 4.96 |
| 124 | Act 5 - Temple Boss | 3 | 10 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 125 | Act 5 - Hell 1 | 2 | 10 | 0..1 | 0.46 | 1..2 | 1.36 | 3..4 | 3.22 |
| 126 | Act 5 - Hell 2 | 2 | 10 | 0..1 | 0.50 | 1..2 | 1.40 | 3..4 | 3.28 |
| 127 | Act 5 - Hell 3 | 2 | 10 | 0..1 | 0.54 | 1..2 | 1.42 | 3..4 | 3.12 |
| 128 | Act 5 - Baal Temple 1 | 3 | 10 | 0..0 | 0.00 | 2..3 | 2.28 | 6..8 | 5.34 |
| 129 | Act 5 - Baal Temple 2 | 2 | 10 | 0..0 | 0.00 | 2..3 | 2.36 | 6..8 | 5.28 |
| 130 | Act 5 - Baal Temple 3 | 3 | 10 | 0..0 | 0.00 | 2..3 | 2.24 | 6..8 | 5.04 |
| 131 | Act 5 - Throne Room | 2 | 10 | 0..0 | 0.00 | 1..2 | 1.42 | 4..5 | 4.08 |
| 132 | Act 5 - World Stone | 0 | 0 | 0..0 | 0.00 | 0..0 | 0.00 | 0..0 | 0.00 |
| 133 | Act 5 - Pandemonium 1 | 5 | 5 | 1..1 | 1.00 | 3..4 | 3.36 | 4..5 | 4.28 |
| 134 | Act 5 - Pandemonium 2 | 4 | 4 | 0..0 | 0.00 | 3..4 | 3.36 | 7..9 | 6.60 |
| 135 | Act 5 - Pandemonium 3 | 4 | 4 | 0..1 | 0.46 | 1..2 | 1.34 | 3..4 | 3.32 |
| 136 | Act 5 - Pandemonium Finale | 0 | 0 | 3..3 | 0.00 | 3..3 | 0.00 | 3..3 | 0.00 |

### 6. Level Monster Species Selection & `rangedspawn` (`D2Game.dll` `0x6FCEA760`)

- **Function VA**: `0x6FCEA760` (called from `REGIONS_AllocMonsterRegion` `0x6FCEAB30` at `0x6FCEAC36`).
- **`D2Common.dll` `Levels.txt` Offsets (`0x6FDBE300..0x6FDBFA7A`)**:
  - `+0x31` (`uint8`): `rangedspawn` (`0x6FDDFCE4`)
  - `+0x32` (`uint8`): `NumMon` (`0x6FDDFDB8`)
  - `+0x33` (`uint8`): `nNumMon` (valid `mon1..25` count)
  - `+0x34` (`uint8`): `nNumNMon` (valid `nmon1..25` count)
  - `+0x35` (`uint8`): `nNumUMon` (valid `umon1..25` count)
  - `+0x36` (`int16[25]`): `mon1..mon25`
  - `+0x68` (`int16[25]`): `nmon1..nmon25`
  - `+0x9a` (`int16[25]`): `umon1..umon25`
- **`D2Common.dll` `MonStats.txt` Flag Offsets (`0x6FDAAA40..0x6FDAB450`, `monstats.bin` record size `0x1a8`)**:
  - `+0x0c` bit `0` (`gdwBitMasks[0] = 0x01`): `isSpawn` (`0x6FDAB1E8`)
  - `+0x0f` bit `4` (`gdwBitMasks[4] = 0x10`, bit `0x1c` = 28 of `+0x0c`): `rangedtype` (`0x6FDAB3B9`)
  - `+0x2e` (`uint8`): `Rarity`
- **Exact Selection Rules in `0x6FCEA760`**:
  1. **Cap `NumMon` at 13 (`0x6FCEA76B..0x6FCEA780`)**: reads `edx = pLevelsTxt->nNumMon` (`[eax+0x32]`). If `edx > 13` (`0x0d`), clamps `edx = 13`.
  2. **Difficulty Pool (`0x6FCEA784..0x6FCEA79B`)**: Normal (`esi == 0`) uses `mon` (`+0x36`, count `+0x33`); Nightmare/Hell (`esi != 0`) uses `nmon` (`+0x68`, count `+0x34`). Clamps `wanted = min(edx, poolCount)`.
  3. **Uniform Draw Without Replacement (`0x6FCEA7DF..0x6FCEA825`)**: for each slot `0 .. wanted - 1`, rolls `idx = rand() % remaining.length` (`0x6FCEA80C: div ebp`) uniformly without `Rarity` weighting.
  4. **Slot-0 `rangedspawn` Rule (`0x6FCEA829..0x6FCEAA85`)**:
     - Checked only on slot 0 (`test ecx, ecx; jne 0x6fceaa87`) when `pLevelsTxt->nRangedSpawn != 0` (`mov cl, [eax+0x31]; test cl, cl; je 0x6fceaa87`).
     - Tests `pMonStatsTxt +0x0f` against `gdwBitMasks[4]` (`0x10`, `rangedtype`): `test BYTE PTR [edi+0x10], al; jne 0x6fceaa87`.
     - If `rangedtype != 0`, jumps to `0x6fceaa87` (accepts the ranged monster). If `rangedtype == 0`, re-rolls `idx = rand() % remaining.length`.
     - The loop body `0x6FCEA840..0x6FCEAA79` contains 5 unrolled check-and-reroll blocks (`0x6FCEA867`, `0x6FCEA8DA`, `0x6FCEA94D`, `0x6FCEA9BC`, `0x6FCEAA2F`) and loops 4 times (`0x6FCEAA7B: add ecx, 5; cmp ecx, 0x14; jl 0x6fcea840`), yielding up to `20` rerolls.
     - In 1.13c `Levels.txt`, 20 Act 5 rows have `rangedspawn = 1`: IDs `110..119`, `123..131`, and `135`.
  5. **Removal & `isSpawn` Gate (`0x6FCEAA87..0x6FCEAB0A`)**:
     - Decrements `remaining.length` and removes `remaining[idx]` via `memmove` (`0x6FC22AD0`).
     - Tests `pMonStatsTxt +0x0c` bit 0 (`isSpawn`). Note that `boss` (`+0x0c` bit 6) is NOT excluded here, allowing `putriddefiler1..4` (`isSpawn = 1, boss = 1`) on Levels `123, 124, 128, 130` to be selected.
     - Stores `Rarity` (`[eax+0x2e]`) in `pMonsterRegion` entry `+0x02` and accumulates `pMonsterRegion->nTotalRarity` (`+0x11`) for subsequent per-pack weighted draws (`0x6FCFF4A0`).
