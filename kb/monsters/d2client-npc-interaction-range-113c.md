# Diablo II 1.13c NPC Interaction Range & Open-Dialog Guard (`D2Client.dll`, `D2Common.dll`)

> Issue #890: an NPC dialog sometimes closed one 25 Hz frame after it opened. The port re-checked the
> player–NPC distance every frame with a legacy 1.10 melee table plus a "target is moving" bonus. 1.13c never
> re-checks the distance once the NPC menu is open.

## 1. Overview

| Step | Address (`D2Client.dll`, ImageBase `0x6FAB0000`) | Check |
|---|---|---|
| Click on a monster / NPC | ProcessClick monster case `0x6facafea..0x6facb0fa` | `#10407(target, player) <= 2` (MonStats `interact`) or `<= 5` (other monsters): send `0x13` at once, else walk and queue a pending `0x13` |
| Pending interaction after the walk | `0x6fac9ef0` | `#10407(target, player) <= 2` **and** `#10324(target, player, 0x804) == 0`, else walk again |
| Server `C2S 0x2F NpcInit` & quest-object interact | `D2Game.dll` `0x6fceccf0 -> 0x6fceb690` / `0x6fced45b -> 0x6fcecfe0` | Same Act (`0x6fceb370`) **and** Chebyshev sub-tile distance `max(\|dx\|, \|dy\|) <= 10` (`ebx = 0x0A`) |
| Every frame while `UI_NPCMENU` is open | `0x6faf83b0` (called from `0x6fb73d71`) | Player and NPC alive / present in `D2Client.dll`; web port additionally enforces the `<= 10` sub-tile tether (#1979) |

`#10407` is `D2Common.dll` `0x6FDCFCD0` (`UNITS_GetDistanceToOtherUnit`), the unit-size-adjusted table distance.

---

## 2. `#10407` Unit Distance (`D2Common.dll` `0x6FDCFCD0`)

Inputs: the two units' integer sub-tile positions (`pDynamicPath->wPosX/wPosY`, or `pStaticPath->x/y` for objects,
items and tiles) and their `UNITS_GetUnitSizeX` (`0x6FD80F80`: player `2`, monster MonStats2 `SizeX`, object
`Objects.txt` `SizeX`, item `1`).

1. `dx = |x1 - x2|`, `dy = |y1 - y2|`.
2. **Near branch** (`dx < 8 && dy < 8 && size1 < 4 && size2 < 4`):
   - `v = table_6FDDABC0[dx + dy * 8]`; a negative entry returns `0` at once.
   - If either size is `3`: `v -= 1` (clamped at `0`).
   - If either size is `<= 1`: `v += 1`.
3. **Far branch** (otherwise): `h = (size1 >> 1) + (size2 >> 1)`; `dx = max(dx - h, 0)`, `dy = max(dy - h, 0)`;
   return `2 * max(dx, dy) + min(dx, dy)`.

Table `0x6FDDABC0` (`int32[64]`, row = `dy`, column = `dx`):

| dy \ dx | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| 0 | -1 | -1 | -1 | 0 | 2 | 4 | 6 | 8 |
| 1 | -1 | -1 | 0 | 1 | 2 | 4 | 6 | 8 |
| 2 | -1 | 0 | 0 | 2 | 3 | 5 | 7 | 8 |
| 3 | 0 | 1 | 2 | 2 | 4 | 5 | 7 | 8 |
| 4 | 2 | 2 | 3 | 4 | 5 | 6 | 7 | 9 |
| 5 | 4 | 4 | 5 | 5 | 6 | 7 | 8 | 9 |
| 6 | 6 | 6 | 7 | 7 | 7 | 8 | 10 | 10 |
| 7 | 8 | 8 | 8 | 8 | 9 | 9 | 10 | 11 |

For the player (size 2) and a size-2 NPC, `#10407 <= 2` holds for `dy = 0, 1: dx <= 4`, `dy = 2, 3: dx <= 3`,
`dy = 4: dx <= 1` (and the symmetric offsets).

> The legacy 1.10-derived `DIST_TABLE_6FDD3200` in `src/common/skills/weapon-combat-meta.ts` is **not** this table
> (e.g. `(4, 0)` is `2` in both, but `(3, 0)` is `1` there and `0` here; `(5, 0)` is `3` there and `4` here).

---

## 3. ProcessClick Monster Case (`0x6facafea..0x6facb0fa`)

- Threshold `2` when the MonStats flags byte `+0x0d` has `gdwBitMasks[1]` set (`interact`, `dwMonStatsFlags`
  bit 9) @`0x6facb00a` / `0x6facb00f`; otherwise `5` @`0x6facb01b` (also when the MonStats lookup fails).
- `#10407(target, player)` via the thunk `0x6fabcc70` @`0x6facb0f1`; signed `jg` @`0x6facb0fa`.
- Too far: walk (`0x6facaea8` → `0x6fada7c0`) and store the pending interaction with `0x6fab2d50`
  (`+0x150 = 1`, `+0x154 = 0x13`, `+0x158` = unit type, `+0x15c` = unit id).

## 4. Pending Interaction (`0x6fac9ef0`)

- `#10407(target, player) <= 2`: `cmp eax, 2 ; ja` @`0x6fac9f07`, for every monster class.
- Then `#10324(target, player, 0x804) == 0` (thunk `0x6fabcf0a` @`0x6fac9f1d`), a collision test between the two units.
- Reached through `0x6facb320` and `0x6facbac7`.

## 5. Per-Frame NPC Guard (`0x6faf83b0`)

```
6faf83b0  mov  eax,[0x6fbcbbfc]        ; gpPlayerUnit
6faf83b5  test eax,eax ; je cancel
6faf83b9  cmp  dword [eax+0x10],0x11   ; PLRMODE_DEAD
6faf83bd  je   cancel
6faf83bf  call 0x6faf6150              ; NPC unit from the hash (id 0x6fbc971d)
...       cmp  dword [eax+0x10],0xc    ; MONMODE_DEAD -> cancel
6faf83d7  call 0x6faf6150 ; test ; jne keep   ; NULL NPC -> cancel
6faf83e0  call 0x6faf67c0              ; cancel:
6faf83e5  call 0x6faf8150
```

The rest of the function (`0x6faf83ea..0x6faf858d`) only drives the menu / speech state: `GetTickCount`
(`[0x6fb7ef5c]`) timers, `D2Common #11017` (thunk `0x6fabc202`) on `[player+0x60]`, and the UI helpers
`0x6faf2ad0`, `0x6fab1380`, `0x6fb38a70`, `0x6fac4660`, `0x6fb42850`, `0x6fb53840`, `0x6fb53d20`. None of its
direct calls is `#10407` (`0x6fabcc70`) or a collision test.

### 5.1 Server `0x0A` (10-Subtile) Interaction Tether (`D2Game.dll` `0x6fceccf0 -> 0x6fceb690`) & Web Viewport Clamping

In `D2Game.dll` (ImageBase `0x6FC20000`), `SCMD_NpcInit` (`0x6fced350`, `C2S 0x2F`) calls `0x6fceccf0` (`unitType == 1` NPC)
and `0x6fced45b -> 0x6fcecfe0` (`unitType == 2` quest/scroll object):

- `0x6fcecd29..0x6fcecd2e`: `mov ebx, 0x0A ; call 0x6fceb690` (`NPC_ValidateInteract`).
- `0x6fceb690..0x6fceb70b`: verifies same Act (`0x6fceb370`), then computes `|playerX - npcX| <= ebx` (`10`) and
  `|playerY - npcY| <= ebx` (`10`) in sub-tiles (`Chebyshev <= 10` = 2 floor tiles; opening range `#10407 <= 2` is at most 4 sub-tiles).
- `0x6fced45b`: passes `0x0A` (`10`) to `0x6fcecfe0` for object scroll / quest-object interactions.

Why the web client must enforce this `<= 10` sub-tile tether per tick (`enforceActiveInteractionRange113c`, Issue #1979):

1. Town areas keep a 3×3 `D2Room1` window (~`120×120` sub-tiles) active on D2GS (and local `GameInstance` keeps town NPCs
   loaded across town), so walking across town does not emit `S2C 0x0A UnitRemove` or `S2C 0x08 RoomHide` for the NPC.
2. `computeNpcDialogLayout` and `drawNpcMenuImpl` (`src/client/ui/panels/npc-dialog-menu.ts`) clamp NPC menu and speech
   boxes inside `[8..10, viewportWidth - width]`, which otherwise pins an unclosed dialog to the screen edge indefinitely
   when the player moves away via touch joystick, teleport/displacement, or delayed `S2C 0x28` handshake arrival.
3. Because `10` Chebyshev sub-tiles strictly contains every `#10407 <= 2` opening offset (`<= 4` sub-tiles) plus normal
   client/server prediction drift (`arrivedViaServer`), enforcing `isWithinNpcInteractTether113c` (`<= 10`) preserves all
   Issue #890 anti-instant-dismiss invariants while automatically dismissing NPC menus, speech boxes, vendor/service panels,
   and object scroll/orifice dialogs once `max(|dx|, |dy|) > 10`.

### 5.2 Unloaded / Missing Monster Unit Lifecycle (`D2Client.dll` `0x6FAF6150`, `0x6FAFBA20`, `0x6FAF8C80`, `0x6FB5C3D0` & `D2Game.dll` `0x6FC68410`, Issue #2009)

Multi-room towns (such as Act 3 Kurast Docks `Area 75`, which spans > `160` sub-tiles north-to-south) exceed the 3×3 `D2Room1`
AOI window (`PLAYER_UpdateRooms` `0x6FC6AC84` in `D2Game.dll`), so walking to the southern dockside or northern jungle gate
emits `S2C 0x0A UnitRemove` and `S2C 0x08 RoomHide` for town NPCs (`Ormus` `255`, `Alkor` `254`, `Asheara` `252`, `Cain` `246`,
`Hratli` `253`, `Meshif` `264`) and town objects (`Stash` `267`).

Disassembly of `D2Client.dll` (ImageBase `0x6FAB0000`) and `D2Game.dll` (ImageBase `0x6FC20000`) establishes five invariants:

1. **`D2CLIENT_GetCurrentInteractingNPC` (`0x6FAF6150`)**:
   Checks `byte [0x6FBC9721]` (`g_bIsInteractingWithNPC`), then looks up `dword [0x6FBC971D]` (`g_dwInteractedNpcId`) in
   `g_pClientUnitTable[UNIT_MONSTER]` (`0x6FBBA808[(npcId & 0x7F) * 4]`). Whenever the monster unit is absent from the client
   unit table, `0x6FAF6150` returns `NULL` (`0`).
2. **`D2CLIENT_InitNPCInteract` (`0x6FAFBA20` / `0x6FAFBAAE`)**:
   If `pNpcUnit == NULL` when initializing an NPC interaction (`C2S 0x2F NpcInit` / `S2C 0x28`), calls `0x6FAF92F0`
   (`D2CLIENT_CloseNPCInteract`) instead of arming `g_bIsInteractingWithNPC = 1`.
3. **`D2CLIENT_OpenNPCStore` (`0x6FAF8B67` / `0x6FAF8C80`)**:
   Calls `0x6FAF6150`; if `NULL`, jumps to `0x6FAF8FF1` and aborts opening trade/gamble/hire windows without dereferencing a
   null unit or crashing the UI loop.
4. **`S2C 0x08 RoomHide` (`0x6FB5C3D0`) & `D2CLIENT_RemoveClientUnit` (`0x6FB56EF0` / `0x6FB56D60`)**:
   Pruning monster/object units inside a hidden room rectangle must perform the exact same active-NPC cancel, shop clear,
   `npcMotion` lock release, Stash close, queued-packet drain, and town-NPC placeholder reconciliation as `S2C 0x0A UnitRemove`.
5. **`D2GAME_CancelMonsterInteractAll` (`0x6FC68410`) & `PLAYER_UpdateRooms` (`0x6FC6AC84`)**:
   Unloading an NPC's room from a player's AOI on the server clears `player.activeNpcId`, `lastNpcInteractHandshakeId`, and
   `activeVendorMode` so stale shop sessions never outlive AOI visibility.

---

## 6. Port Mapping

| 1.13c | Port |
|---|---|
| `#10407` `0x6FDCFCD0` | `D2Common_10399` / `D2Common_10399_AtSubtiles` (`src/common/path/step.ts`) |
| Thresholds `2` / `5` / `2` | `NPC_CLICK_INTERACT_DISTANCE_113C`, `MONSTER_CLICK_INTERACT_DISTANCE_113C`, `NPC_ARRIVAL_INTERACT_DISTANCE_113C`, `isNpcInInteractRange113c` (`src/client/input/click-rules-113c.ts`) |
| `D2Game` `0x6fceb690` / `0x6fcecfe0` (`0x0A`) | `NPC_INTERACT_TETHER_SUBTILES_113C = 10`, `isWithinNpcInteractTether113c` (`src/client/input/click-rules-113c.ts`) |
| Click / pending interaction | `CommandMapper.isWithinInteractionMeleeRange(..., 'click' / 'arrival')` |
| `0x6faf83b0` + `0x0A` tether | `enforceActiveInteractionRange113c` (`src/client/session/session-level-navigation.ts`) |
| `0x6FAF6150` / `0x6FAFBA20` / `0x6FAF8C80` / `0x6FB5C3D0` / `0x6FC68410` | `removeNonSelfUnit` (`client-world.ts`), `noteOutgoingCommandImpl` (`world-event-applier.ts`), `syncNpcInteractionImpl` (`hud-world-sync.ts`), `openNpcTradeImpl` / `openNpcGambleImpl` (`hud-command-actions.ts`), `RoomHide` (`session-event-processor.ts`), `emitRoomUnitsRemovedToPlayer` (`area-and-session.ts`) |

Not modelled: the pending path's collision test `#10324(target, player, 0x804)`. The web client's collision map
also contains object footprints, which could block an NPC that stands next to a stall; the D2GS server stays
authoritative for the interaction. The port also treats the death-animation modes (player / monster mode `0`) and
the world `dead` flags as dead (#866).

## 7. Related: `UNITS_IsInMeleeRange` (`D2Common.dll` `0x6fd826c0`)

The 1.13c melee check uses the same `#10407` (`0x6FDCFCD0`):

- `range = 0x6fd825c0(attacker) + arg3 + 1`; `dist = #10407(attacker, target)`.
- `dist <= 0` → in range; `range < dist` → out of range; else in range when the collision test
  `0x6fd814a0(attacker, target, 0x804)` returns `0`.
- Monster targets whose `0x6fd51860` index is `0x102` or `0x105` are also in range when `dist < 0x6fd825c0(attacker) + 8`.

The port's `isInMeleeRange113c` (`src/common/skills/weapon-combat-meta.ts`) still uses `DIST_TABLE_6FDD3200` and an
`isTargetMoving ? 1 : 0` bonus instead (follow-up).
