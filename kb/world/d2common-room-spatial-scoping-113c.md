# Diablo II v1.13c Room-at-Coordinate Scoping & Cross-Act Coordinate Overlap Audit (`#2016`)

## 1. Binary Disassembly Ground Truth (`D2Common.dll` v1.13c)

### 1.1 `DUNGEON_GetRoomAtPosition` (`D2Common.#11022` @ `0x6FD51330`)
Register convention: `eax = pRoom` (`D2RoomStrc*`), `ebx = nX` (world sub-tile X), `edi = nY` (world sub-tile Y).

```asm
6fd51330: push   ecx
6fd51331: test   eax,eax
6fd51333: jne    0x6fd51337
6fd51335: pop    ecx
6fd51336: ret                           ; pRoom == NULL -> return NULL

; 1. Self-room check on pRoom->tCoords (nSubtileX/Y/Width/Height @ +0x4C..+0x58)
6fd51337: mov    ecx,DWORD PTR [eax+0x4c] ; nSubtileX
6fd5133a: cmp    ebx,ecx
6fd5133c: jl     0x6fd51357
6fd5133e: mov    edx,DWORD PTR [eax+0x54] ; nSubtileWidth
6fd51341: add    edx,ecx
6fd51343: cmp    ebx,edx
6fd51345: jge    0x6fd51357
6fd51347: mov    ecx,DWORD PTR [eax+0x50] ; nSubtileY
6fd5134a: cmp    edi,ecx
6fd5134c: jl     0x6fd51357
6fd5134e: mov    edx,DWORD PTR [eax+0x58] ; nSubtileHeight
6fd51351: add    edx,ecx
6fd51353: cmp    edi,edx
6fd51355: jl     0x6fd5139e               ; inside pRoom -> return pRoom

; 2. Adjacent-room list check on pRoom->ppRoomList (+0x00, count dwRoomsNear @ +0x24)
6fd51357: mov    edx,DWORD PTR [eax+0x24] ; dwRoomsNear
6fd5135a: mov    ecx,DWORD PTR [eax]      ; ppRoomList
6fd5135c: push   ebp
6fd5135d: xor    eax,eax
6fd5135f: test   edx,edx
6fd51361: push   esi
6fd51362: mov    DWORD PTR [esp+0x8],edx
6fd51366: jbe    0x6fd5139a
6fd51368: mov    esi,DWORD PTR [ecx+eax*4]
6fd5136b: test   esi,esi
6fd5136d: je     0x6fd51395
6fd5136f: cmp    ebx,DWORD PTR [esi+0x4c]
...
6fd5138d: cmp    edi,esi
6fd5138f: jl     0x6fd513a0               ; inside ppRoomList[i] -> return ppRoomList[i]
...
6fd5139a: pop    esi
6fd5139b: xor    eax,eax                  ; outside pRoom and ppRoomList -> return NULL
6fd5139d: pop    ebp
6fd5139e: pop    ecx
6fd5139f: ret
```

Key invariants:
1. **Self-room priority**: `pRoom` itself is tested before any neighbor.
2. **Seam-only neighbor traversal**: `ppRoomList` contains only rooms in the same DRLG level and stitched border rooms linked via `DRLG_LinkLevels` (`Vis > 0 && Warp == -1` / `DRLGOUTPLACE_CreateLevelConnections`).
3. **Strict `NULL` outside reachable seam rooms**: `COLLISION_CheckCollisionMask` (`0x6FD9B510`) treats `DUNGEON_GetRoomAtPosition == NULL` as `COLLIDE_MASK_INVALID` (`0x0027`, fully blocked void). It never searches rooms belonging to another `D2ActStrc*` (`Act 0..4`) or an unlinked dungeon level.

### 1.2 `ACT_FindActSpawnLocationEx` (`D2Common.#10816` @ `0x6FD8CDF0`) -> `DRLG_FindRoomExBySubTileCoordinates` (`0x6FD6A130`)
- Reads `pAct->pDrlg` (`mov ecx, [ecx+0x48]` @ `0x6FD8CE21`).
- Walks `pDrlg->pLevel` (`[ecx+0x47C]` @ `0x6FD6A16A`, linked via `+0x1AC`) matching the exact `nLevelId` (`cmp [ebp+0x1D0], edx` @ `0x6FD6A174`) before resolving rooms.

---

## 2. Full 136-Level `Levels.txt` World-Coordinate Overlap Audit

Scanning all `136` active rows in `Patch_D2.mpq` `data\global\excel\Levels.txt` (`108` fixed-offset levels + `28` `OffsetX = -1, OffsetY = -1` stitched outdoor levels):
- **Same-Act non-seam overlaps**: `0` (every fixed-offset level within an Act occupies a distinct `(OffsetX, OffsetY)` band, and every non-seam `Vis` warp pair within an Act is separated by `>= 200` sub-tiles).
- **Cross-Act fixed-offset bounding-box overlaps**: `100` pairs across Acts 1–5, plus all dynamic outdoor chains anchored at `(1000, 1000)` tiles (`(5000, 5000)` sub-tiles):

| World Tile Origin `(OffsetX, OffsetY)` | World Sub-Tile Origin | Overlapping Levels Across Acts |
| --- | --- | --- |
| `(1000, 1000)` + `(-1, -1)` outdoor chains | `(5000, 5000)` | `1` Rogue Encampment / `3` Cold Plains / `4` Stony Field (Act 1), `40` Lut Gholein (Act 2), `75` Kurast Docks (Act 3), `103` Pandemonium Fortress + `104` Outer Steppes (Act 4), `109` Harrogath (Act 5) |
| `(1500, 1000)` | `(7500, 5000)` | `8` Den of Evil (Act 1), `47` Lut Gholein Sewers L1 (Act 2), `84` Arachnid Lair (Act 3), `108` Chaos Sanctuary (Act 4) |
| `(1500, 1300)` | `(7500, 6500)` | `9` Cave L1 (Act 1), `48` Lut Gholein Sewers L2 (Act 2), `85` Spider Cavern (Act 3) |
| `(2000, 1000)` | `(10000, 5000)` | `18` Crypt (Act 1), `50` Harem L1 (Act 2), `86` Swampy Pit L1 (Act 3), `113` Crystalline Passage (Act 5) |
| `(2500, 1000)` | `(12500, 5000)` | `21` Forgotten Tower L3 (Act 1), `46` Canyon of the Magi (Act 2), `92` Kurast Sewers L1 (Act 3), `124` Halls of Vaught (Act 5) |
| `(3000, 1000)` | `(15000, 5000)` | `26` Monastery Gate (Act 1), `55` Stony Tomb L1 (Act 2), `94` Ruined Temple (Act 3), `131` Throne of Destruction (Act 5) |
| `(3500, 1000..1600)` | `(17500, 5000..8000)` | `29..31` Jail L1..3 (Act 1), `62..64` Maggot Lair L1..3 (Act 2), `100..102` Durance of Hate L1..3 (Act 3) |
| `(4500, 1000..1900)` | `(22500, 5000..9500)` | `34..37` Catacombs L1..4 (Act 1), `66..69` Tal Rasha's Tombs (Act 2) |
| `(5000, 1000)` | `(25000, 5000)` | `38` Tristram (Act 1), `74` Arcane Sanctuary (Act 2), `136` Uber Tristram (Act 5) |

---

## 3. Server Implementation Contract

Because `GameInstance.loadedAreas` retains areas loaded across multiple Acts and dungeons during a session, `areaIdAtWorldPoint(x, y, referenceAreaId)` and `lookupAreaIdWithSpatialIndex113c(host, index, x, y, referenceAreaId)` enforce the exact 1.13c scoping whenever `referenceAreaId` is supplied:
1. Check `findRoomRectInArea113c(index, referenceAreaId, x, y)` first and return `referenceAreaId` on hit.
2. Otherwise accept a candidate `room` in the spatial bucket **only** when `host.isAreaSeamAdjacent(referenceAreaId, room.areaId)` is `true`.
3. Return `undefined` outside `referenceAreaId` and its seam-adjacent neighbors so every caller (`isMonsterStepWalkable`, `findMonsterPath`, `missileSegmentBlocked`, `isRayBlockedByClosedDoor`, `hasInteractionLineOfSight`) falls back to `?? areaId` and evaluates void/wall collision against the unit's own level.
