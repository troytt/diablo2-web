# `D2GAME_FindFreeCoords` (`0x6FC54130`) Dynamic Quest Boss, NPC & Portal Coordinate Snapping (v1.13c)

> **Ground Truth Source**: Disassembled from official Blizzard **Diablo II: Lord of Destruction v1.13c** `D2Game.dll` (`base = 0x6FC20000`, `samples/d2/D2Game.dll`) and verified against `Objects.txt`, `SuperUniques.txt`, and `Levels.txt`.

---

## 1. Engine Function Signature & Ring Search (`D2Game.dll` `0x6FC54130`)

```c
// D2Game.dll 0x6FC54130 (D2GAME_FindFreeCoords)
// Mutates *pCoord in-place to the nearest unblocked footprint on growing square rings
// r = 1..maxRadius around (*pCoord - nSize/2) and writes the owning D2ActiveRoomStrc*
// to *ppOutRoom (NULL when no unblocked cell exists within maxRadius).
void __stdcall D2GAME_FindFreeCoords(
    D2ActiveRoomStrc* pRoom,
    D2CoordStrc*      pCoord,         // [in/out] target world subtile (x, y)
    int               nSize,          // footprint width in subtiles (1, 2, 3, or 5)
    uint32_t          fCollisionMask, // e.g. 0x0100, 0x0400, 0x3E01, 0x3F11, 0xBE11
    D2ActiveRoomStrc** ppOutRoom,     // [out] resolved room or NULL if blocked everywhere
    int               nMaxRadius      // maximum search radius in subtiles (0x64 = 100)
);
```

Key disassembly prologue (`0x6FC54130..0x6FC54178`):
- `0x6FC54142`: `shr eax, 1` (`nSize / 2`) shifts the candidate center before testing room collision via `D2Common.#10134` / `COLLISION_GetFreeCoordinatesEx`.
- `0x6FC54169..0x6FC54178`: iterates square search rings `r = 1 .. nMaxRadius` (`[esp+0x6C]`).
- When no free footprint exists within `nMaxRadius`, `*ppOutRoom` remains `NULL` (`0`), and callers check `test reg, reg; je abort` rather than spawning a boss, NPC, or quest portal inside void/wall collision.

---

## 2. Complete Table of All 17 `D2GAME_FindFreeCoords` (`0x6FC54130`) Call Sites in `D2Game.dll`

Every dynamic quest, NPC, and portal caller in `D2Game.dll` passes **`push 0x64` (`maxRadius = 100` subtiles)**:

| # | Call Site VA | Subsystem / Quest | Raw Anchor Formula | `nSize` | `fCollisionMask` | `maxRadius` | Void-Abort Check |
|---|---|---|---|---|---|---|---|
| 1 | `0x6FC56272` | Town Portal (`#59`) field spawn | `(player.x, player.y)` jitter | `2` | `0x0100` | `0x64` (`100`) | `0x6FC5627B` |
| 2 | `0x6FC56376` | Town Portal (`#59`) town pad | Town portal pad coord | `2` | `0x0100` | `0x64` (`100`) | `0x6FC5637F` |
| 3 | `0x6FC56562` | Mercenary / Pet leash snap | `(owner.x, owner.y)` | `1` | `0x3E01` | `0x64` (`100`) | Uses resolved room |
| 4 | `0x6FC7BB7F` | Act 5 Portal / Waypoint helper | Target room coord | `2` | `0x8000` | `0x64` (`100`) | `0x6FC7BB88` |
| 5 | `0x6FC7C236` | **A5Q6 Baal Death -> `tyrael3` (`#521`)** | `(baal.x - 5, baal.y - 5)` | `5` | `0x0400` | `0x64` (`100`) | `0x6FC7C23E: test eax, eax; je 0x6FC7C296` |
| 6 | `0x6FC7C408` | **Act 5 Harrogath Town NPC Init (`InitFn 71`)** | `(obj.x, obj.y)` | `2` | `0x0100` | `0x64` (`100`) | `0x6FC7C411: test eax, eax; je 0x6FC7C474` |
| 7 | `0x6FC7D7BF` | **A5Q6 `"Destruction's End"` (`Objects.txt 565`)** | `(tyrael.x + 5, tyrael.y)` | `5` | `0x0400` | `0x64` (`100`) | `0x6FC7D7C8: test esi, esi; je 0x6FC7D904` |
| 8 | `0x6FC8618C` | Special Red Portal (`#60`) field mouth | `(caster.x, caster.y)` jitter | `2` | `0x0100` | `0x64` (`100`) | `0x6FC86197` |
| 9 | `0x6FC86247` | Special Red Portal (`#60`) dest mouth | Dest anchor coord | `2` | `0x0100` | `0x64` (`100`) | `0x6FC86250` |
| 10 | `0x6FC875A4` | **A1Q3 Cairn Stones -> Tristram Portal (`#60`)** | Cairn stone center | `3` | `0x0400` | `0x64` (`100`) | `0x6FC875AD: test edi, edi; je 0x6FC876D5` |
| 11 | `0x6FC8781B` | **A1Q3 Cain Gibbet (`#26`) -> Tristram Cain (`#265`)** | `(gibbet.x, gibbet.y)` | `2` | `0x0100` | `0x64` (`100`) | `0x6FC87824: test eax, eax; je 0x6FC8784F` |
| 12 | `0x6FCDB03B` | **A4Q3 `tyrael2` (`#367`) -> `Harrogath` Portal (`#566`)** | `(tyrael.x + 5, tyrael.y)` | `2` | `0x0400` | `0x64` (`100`) | `0x6FCDB044: test edi, edi; je 0x6FCDB19B` |
| 13 | `0x6FCDC0B2` | **A4Q3 Chaos Seal Bosses (`392, 394, 396`)** | Seal `+(dx, dy)` (see §3) | `3` | `0x3F11` | `0x64` (`100`) | `0x6FCDC0BB: test edi, edi; je 0x6FCDC20E` |
| 14 | `0x6FCE7CB7` | **Act 2 Lut Gholein Jerhyn (`#201`, `InitFn 18`)** | `(obj121.x, obj121.y)` | `2` | `0x0100` | `0x64` (`100`) | Uses snapped coord |
| 15 | `0x6FCE8721` | **A2Q6 Duriel's Lair -> `tyrael1` (`#251`)** | Back chamber anchor | `2` | `0xBE11` | `0x64` (`100`) | `0x6FCE872A: test eax, eax; je 0x6FCE887A` |
| 16 | `0x6FCE90E1` | **A2Q6 Horadric Orifice (`#152`) -> Duriel's Lair (`#100`)** | `(orifice.x - 10, orifice.y - 3)` | `3` | `0x0100` | `0x64` (`100`) | Spawns `Objects.txt 100` |
| 17 | `0x6FD058D4` | **A3Q2 Gidbinn Altar (`#86`) Boss Pack** | `(altar.x + dx, altar.y + dy)` | `3` | `0x3F11` | `0x64` (`100`) | `0x6FD058DD: test eax, eax; je 0x6FD05902` |

---

## 3. Why `maxRadius = 100` (`0x64`) Is Mandatory for Chaos Sanctuary Seal `394` (`Lord De Seis`)

In `D2Game.dll`, the three boss-bearing Chaos Sanctuary seals (`Area 108`) apply fixed signed displacements before calling `ACT4Q3_SpawnSealBoss` (`0x6FCDC050`):

1. **`Objects.txt 392` (`OperateFn 54` @ `0x6FCDC580` — `Grand Vizier of Chaos`)**:
   - `0x6FCDC5C8`: `add eax, -12` (`0xFFFFFFF4`), `0x6FCDC5CF`: `add edx, -52` (`0xFFFFFFCC`) -> `(-12, -52)`, `bossIdx = 1` (`push 1`).
2. **`Objects.txt 394` (`OperateFn 55` @ `0x6FCDC510` — `Lord De Seis`)**:
   - `0x6FCDC558`: `add eax, -39` (`0xFFFFFFD9`), `0x6FCDC55F`: `add edx, +33` (`0x21`) -> `(-39, +33)`, `bossIdx = 3` (`push 3`).
3. **`Objects.txt 396` (`OperateFn 56` @ `0x6FCDC4A0` — `Infector of Souls`)**:
   - `0x6FCDC4E8`: `add eax, +32` (`0x20`), `0x6FCDC4EF`: `add edx, +16` (`0x10`) -> `(+32, +16)`, `bossIdx = 2` (`push 2`).

Each wing of Chaos Sanctuary (`Act 4 - Diablo` DS1 presets) rolls one of **two mirror DS1 variants (`A` or `B`)**:
- On **North Wing Variant A (East-seal layout)**, Seal `394` sits on the East wall (`x ≈ 7812`), so `x - 39 = 7773` lands directly on the walkable hall center (`r = 0`).
- On **North Wing Variant B (West-seal layout)**, Seal `394` sits on the **West** wall `(7773, 5155)`. Adding `(-39, +33)` yields raw target **`(7734, 5188)`**, which is **33 subtiles West out in the unwalkable lava void** (`nearest 3×3 walkable floor = (7767, 5188)` at Chebyshev distance `r = 33`)!

Inside `0x6FCDC050`:
```asm
6fcdc0a2: 6a 64                push 0x64        ; maxRadius = 100 subtiles (>= 33!)
6fcdc0a4: 8d 4c 24 24          lea  ecx,[esp+0x24]
6fcdc0a8: 51                   push ecx         ; &pOutRoom
6fcdc0a9: 68 11 3f 00 00       push 0x3f11      ; COLLIDE_MASK_MONSTER_SPAWN
6fcdc0ae: 6a 03                push 0x3         ; nSize = 3 (3x3 footprint)
6fcdc0b0: 56                   push esi         ; &coord = (7734, 5188) -> mutated to (7767, 5188)
6fcdc0b1: 50                   push eax         ; pRoom
6fcdc0b2: e8 79 80 f7 ff       call 0x6fc54130  ; D2GAME_FindFreeCoords
6fcdc0b7: 8b 7c 24 20          mov  edi,[esp+0x20]
6fcdc0bb: 85 ff                test edi,edi
6fcdc0bd: 0f 84 4b 01 00 00    je   0x6fcdc20e  ; abort if pOutRoom == NULL
```
Any implementation that caps `maxRadius < 33` (such as `10`) and falls back to `rawX` drops `Lord De Seis` and his 5 Doom Knight minions into unwalkable void on ~50% of Chaos Sanctuary map seeds, permanently preventing `ACT4Q3_CheckSealCompletion` (`0x6FCDBD90`) from spawning Diablo (`#243`).

---

## 4. Act 4 & Act 5 Finale Portal/NPC Snapping (`0x6FCDB006`, `0x6FC7C1F0`, `0x6FC7D760`)

1. **Act 4 Q3 Pandemonium Fortress (`Area 103`) — `tyrael2` (`#367`) -> `Harrogath` Portal (`Objects.txt 566`)**:
   - `0x6FCDB00D`: adds `+5` to `tyrael.x` (`(tyrael.x + 5, tyrael.y)`).
   - `0x6FCDB01D..0x6FCDB03B`: calls `D2GAME_FindFreeCoords(..., nSize = 2, mask = 0x0400, maxRadius = 100)` and aborts if `pOutRoom == NULL` (`0x6FCDB044`).
2. **Act 5 Q6 Worldstone Chamber (`Area 132`) — Baal (`#544`) Death -> `tyrael3` (`#521`) & `"Destruction's End"` (`Objects.txt 565`)**:
   - `0x6FC7C20E..0x6FC7C236`: computes `(baal.x - 5, baal.y - 5)` and snaps via `D2GAME_FindFreeCoords(..., nSize = 5, mask = 0x0400, maxRadius = 100)` before spawning `tyrael3` (`0x209 = 521`). If Baal dies on the edge of the Worldstone bridge chasm, `tyrael3` snaps back onto the walkable bridge rather than floating over chasm void.
   - `0x6FC7D79A..0x6FC7D7BF`: computes `(tyrael.x + 5, tyrael.y)` and snaps via `D2GAME_FindFreeCoords(..., nSize = 5, mask = 0x0400, maxRadius = 100)` before spawning `LastPortal` (`0x235 = 565`, `OBJMODE_OPENED = 2`).
