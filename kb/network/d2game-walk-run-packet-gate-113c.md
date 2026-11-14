# D2Game 1.13c walk/run location packet gate and player path type

Binary: `D2Game.dll` 1.13c, SHA-1 `b452c203b00f48bbb95cb5cda6419e4f2466cdea`.

## 1. C2S `0x01` WalkToLocation / `0x03` RunToLocation validator (`0x6FCEBF50`)

Callers: `Rcv0x01` `0x6FCEE0D0`, `Rcv0x03` `0x6FCEE040` (`0x6FCEE05A: call 0x6FCEBF50`, then
`0x6FCEE078: call 0x6FC98550`).

```asm
6fcebf60: cmp  DWORD PTR [esp+0xc],0x5     ; packet size must be 5, else return 3
6fcebf90: mov  bp,WORD PTR [ebx+0x3]       ; target Y (u16)
6fcebf96: mov  di,WORD PTR [ebx+0x1]       ; target X (u16)
6fcebf9a: mov  ebx,0x32                    ; max per-axis delta = 50 sub-tiles
6fcebfa3: call 0x6fceb690                  ; generic "unit within ebx of (x, y)" check
```

`0x6FCEB690` (shared with the `ebx = 0x0A` NPC interact tether, see
`kb/monsters/d2client-npc-interaction-range-113c.md`):

```asm
6fceb6f9: cmp ecx,ebx      ; |unitX - targetX| > ebx -> return 1 (reject)
6fceb6fb: jg  0x6fceb711
6fceb708: cmp eax,ebx      ; |unitY - targetY| > ebx -> return 1 (reject)
6fceb70a: jg  0x6fceb711
6fceb70c: xor eax,eax      ; accept
```

Result handling back in `0x6FCEBF50`:

```asm
6fcebfb2: test ebx,ebx
6fcebfb4: mov  eax,DWORD PTR [edx+0xa8]        ; pGame frame counter
6fcebfba: je   0x6fcec009                      ; accepted
6fcebfbc: sub  eax,DWORD PTR [ecx+0x168]       ; frames since last accepted walk/run packet
6fcebfc2: cmp  eax,0x19
6fcebfc5: jle  0x6fcec001                      ; <= 25 frames: drop silently
...                                            ; > 25 frames: re-send the unit position
6fcec00d: mov  DWORD PTR [ecx+0x168],eax       ; accepted: stamp the frame, write X / Y out
```

Rules:

- A walk/run location packet is accepted when `|dx| <= 50 && |dy| <= 50` relative to the unit's
  current sub-tile position (`jg`, so exactly 50 passes).
- A rejected packet never changes the unit's path.
- A rejected packet re-sends the unit position only when the last *accepted* walk/run packet is
  more than 25 frames old.

The original 800x600 client cannot click that far; a widescreen web client can.

## 2. Player path type for walk/run

`0x6FC98550` dispatches through the mode table `[mode*8 + 0x6FD1A3F8]` to `0x6FC98710`, which calls
`0x6FC98610` and then recomputes the path with `D2Common_10142(pPath, pUnit, 0)`. Walk and run do
not set a path type, so players keep the `PATHTYPE_STRAIGHT (7)` assigned by
`PATH_AllocDynamicPath`:

- `PATH_Straight_Compute` (`D2Common` `0x6FDB7AD0`): `PATH_Toward` first; A* only when the straight
  distance is at most 18 sub-tiles (`distSq <= 324`). There is no wider town budget.
- `D2Common_10142` resolves the target room with `DUNGEON_GetRoomAtPosition`: the target must lie in
  the start room or one of its adjacent rooms, otherwise 0 path points are produced and the unit
  does not move.
- `PATH_Toward` stops once the remaining distance is `<= 1`, so the end point can be one sub-tile
  short of the click.

The import thunk targets inside `0x6FC98610` / `0x6FC98710` were not resolved to ordinals in this
note; the path-type statement follows the call structure above plus an offline replay of recorded
live walks, where the `STRAIGHT` model matched server end points better than plain A*.

## 3. Web port mapping

| 1.13c | Web port |
|---|---|
| `0x6FCEBF50` / `0x6FCEB690` (`0x32`) server gate | `rejectWalkPacketBeyondAxisDelta113c`, `WALK_PACKET_MAX_AXIS_DELTA_113C`, `WALK_PACKET_REJECT_REASSIGN_FRAMES_113C` (`src/server/engine/game-instance/`) |
| Same gate, client side (no packet, no local prediction) | `MAX_WALK_PACKET_AXIS_DELTA_113C` in `walkAdjust113c` (`src/client/input/click-rules-113c.ts`) |
| `D2Common_10142` + `PATHTYPE_STRAIGHT` player path | `findPlayerPathD2Common113c` (`src/common/path/pathfind.ts`), used by `CommandMapper.startLocalPathPrediction` and the server `findPlayerPath` |
