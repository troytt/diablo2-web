# D2Client.dll v1.13c Automap Waypoint Parity (`Automap.cpp`)

## 1. D2Client.dll Ground Truth Assembly (`ImageBase 0x6FAB0000`)

### `AUTOMAP_AddRoomUnits` (`0x6fb11d00..0x6fb11e60`)

When DRLG rooms are initialized or populated into the client automap data structures (`pObjects`), objects are scanned and evaluated for automap representation:

```asm
0x6fb11d80: mov  ecx, [esi+0x14]       ; ecx = pObjectsTxt
0x6fb11d83: mov  ecx, [ecx+0x124]      ; ecx = pObjectsTxt->dwAutomap
0x6fb11d89: test ecx, ecx
0x6fb11d8b: je   0x6fb11e58            ; if (dwAutomap == 0) SKIP OBJECT ENTIRELY!
...
0x6fb11db5: cmp  eax, 0x2e             ; cmp levelId, 46 (Canyon of the Magi)
0x6fb11db8: je   0x6fb11e58            ; object 402 in level 46 is skipped (uses floor tiles 617..619)
```

### Invariant 1: Object `dwAutomap == 0` Never Injected into `pObjects`
In `Objects.txt`:
- **Act 1–4 Waypoints**: `119` (Rogue Encampment), `145`, `156`, `157`, `237`, `238`, `288`, `323`, `324`, `398`.
- **Act 5 Town Waypoint**: `429` (Harrogath).
All have `AutoMap = 0`. Their waypoint icon (`307`) is placed on the **floor layer (`pFloors`)** via `AutoMap.txt` floor rules:
`Tile = "fl", Style = 0, StartSequence = 54, EndSequence = 54 -> Cell 307`
Or pre-baked in saved town maps (`pExtras` in `generateTownSavedExtras` for levels 40, 103, 109).

### Invariant 2: Object-Layer Waypoints (`AutoMap == 307`)
Only 5 waypoint objects in `Objects.txt` have non-zero `AutoMap`:
1. `402` (Arcane Sanctuary waypoint, restricted to `levelId == 74` per `0x6fb11db5`; skipped in Canyon of the Magi `levelId == 46` which uses floor tiles `617..619`).
2. `494` (Act 5 outdoor waypoint: Frigid Highlands, Arreat Plateau, Frozen Tundra).
3. `496` (Act 5 ice caves waypoint: Crystalline Passage, Glacial Trail, Ancients' Way).
4. `511` (Act 5 temple/dungeon waypoint: Halls of Pain).
5. `539` (Act 5 keep waypoint: Worldstone Keep Level 2).

All these objects resolve to cell `307` (Waypoint). **They never resolve to `318`**, which in `MaxiMap.dc6`/`MaxiMapS.dc6` is the glittering quest chest (Sparkly Chest).

---

## 2. Issues Fixed in #867

1. **Duplicate / Shifted Waypoint Stacking**:
   - `level-view.ts` was passing `defaultWaypoints` to `buildLevelAutomap`, which injected a synthetic object cell at `(wp.x + 1, wp.y + 1)` alongside the authentic floor cell `307`.
   - Because the two cells differed by `+1, +1` sub-tile coordinates, the rendered sprites overlapped with a 4-pixel diagonal offset, deforming the clean waypoint diamond into an elongated 3-pillar shape.
   - Fixed by removing `defaultWaypoints` pass-through and enforcing single-layer generation in `buildLevelAutomap`:
     - Saved towns (`40, 103, 109`) use `pExtras`.
     - Canyon of the Magi (`46`) uses floor tiles `617..619`.
     - Acts 1–4 and town 429 use `pFloors` (`Tile="fl", Style=0, Seq=54`).
     - Only levels `74` and `>= 110` use `pObjects`.

2. **Erroneous Chest Fallback (`318 -> 307`)**:
   - `automap-table.ts` and `d2map.ts` incorrectly fell back to `318` for object 402 / level 74.
   - Fixed to return authentic `307`.

3. **Dual Viewport Parity**:
   - Verified that all 39 waypoint levels render a single, crisp waypoint diamond in both Corner Minimap (`bMinimap = true`, `MaxiMapS.dc6`, `nDivisor = 20`) and Full-Screen Automap (`bMinimap = false`, `MaxiMap.dc6`, `nDivisor = 10`).

---

## 3. `BH.dll` `0x101a94e0` (`Maphack::RevealRoomPresetUnits`) Preset Quest/Special Unit Automap Icons

In `BH.dll` maphack (`Maphack::RevealRoom` at `0x101a9370` -> `Maphack::RevealRoomPresetUnits` at `0x101a94e0`), room preset units (`pRoom2->pPreset`) with `AutoMap == 0` in `Objects.txt` or `MonStats2.txt` are assigned explicit `MaxiMap.dc6` automap icons in `pLayer->pObjects`:

### 3.1 Preset Objects (`pPreset->dwType == 2` at `0x101a9545..0x101a9613`)
- **`objectClassId == 152` (`0x98`, `orifice`, `"Where you place the Horadric staff"`)** in Act 2 Tal Rasha's Tomb (`TombWTalrasha.ds1`, `TombETalrasha.ds1`, `TombSTalrasha.ds1`, `TombNTalrasha.ds1`, levels `66..72`, DS1 `ObjPreset[126]`):
  - `Objects.txt` has `AutoMap = 0`.
  - `BH.dll` `0x101a9589..0x101a9599` (`cmp eax, 0x98; jnz ...; mov dword ptr [ebp-4], 0x12c`) assigns `cellNo = 300` (`0x12c`, bright red `X` quest marker in `MaxiMap.dc6`).
  - Note: Although both `Act2/Outdoors/KingWarp.ds1` (Canyon of the Magi waypoint, `LevelType = 16` `"2 Desert"`) and `Act2/Tomb/Tomb*Talrasha.ds1` (`LevelType = 17` `"2 Tomb"`) use the 4×4 sandstone platform (`fl style=10 seq=20..35`), `AutoMap.txt` rows 1280–1282 (`617..619`) apply only to `2 Desert` (`LevelType = 16`) for the Canyon of the Magi floor waypoint; in `2 Tomb`, the Horadric Orifice is marked via object `152 -> cellNo 300`.
- **`objectClassId == 371` (`0x173`, `LargeChestR`)**:
  - `BH.dll` `0x101a9577..0x101a9587` (`cmp eax, 0x173; jnz ...; mov dword ptr [ebp-4], 0x12d`) assigns `cellNo = 301` (`0x12d`, red iron cross chest marker in `MaxiMap.dc6`).
- **`objectClassId == 376` (`0x178`, `Hellforge`, `"Forge hell"` in Act 4 River of Flame)**:
  - `BH.dll` `0x101a95d3..0x101a95e1` (`cmp eax, 0x178; jnz ...; mov [ebp-4], eax`) assigns `cellNo = 376` (`0x178`, multicolored diamond forge marker in `MaxiMap.dc6`).
- **`objectClassId == 460` (`0x1cc`, `"Drehya Start Outside Town"` — Frozen Anya in Act 5 Frozen River)**:
  - `BH.dll` `0x101a959b..0x101a95a9` (`cmp eax, 0x1cc; jnz ...; mov dword ptr [ebp-4], 0x5bc`) assigns `cellNo = 1468` (`0x5bc`, Frozen Anya marker in `MaxiMap.dc6`).
- **`objectClassId == 580` (`0x244`, Lower Kurast Superchest) when `levelId == 79` (`0x4f`, Lower Kurast)**:
  - `BH.dll` `0x101a954e..0x101a9575` checks `pRoom2->pLevel->dwLevelNo == 0x4f` (`79`) and assigns `cellNo = 318` (`0x13e`, sparkling golden chest marker in `MaxiMap.dc6`); in other levels (`80`, `81`), `objectClassId == 580` is skipped (`-1`).

### 3.2 Preset Monsters (`pPreset->dwType == 1` at `0x101a9511..0x101a9543`)
- **`monsterClassId == 256` (`0x100`, `izual` in Act 4 Plains of Despair, placed via Act 4 `MonPreset[13]` in `Izual.ds1`)**:
  - `BH.dll` `0x101a9517..0x101a9527` (`cmp eax, 0x100; jnz ...; mov dword ptr [ebp-4], 0x12c`) assigns `cellNo = 300` (`0x12c`, bright red `X` quest marker in `MaxiMap.dc6`), bypassing `MonStats2.txt` `noMap = 1`.
- **`monsterClassId == 745` (`0x2e9`, `willowisptotem` / `gargoyletrap`)**:
  - `BH.dll` `0x101a9529..0x101a9541` (`cmp eax, 0x2e9; jnz ...; mov dword ptr [ebp-4], 0x2e9`) assigns `cellNo = 745` (`0x2e9`, pillar/totem marker in `MaxiMap.dc6`).

