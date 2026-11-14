# Diablo II 1.13c Player Body (Corpse) Sync, Hover & Pick-Up (`D2Game.dll`, `D2Client.dll`)

> Issue #922: after dying outdoors and resurrecting in town, the player walked back but could not click their own
> body. The port routed a click on a player unit to `Interact` only when the left skill was Attack (0); any other
> left skill fell through to a ground walk.

## 1. Server: the body is a new player unit (1.13c `D2Game.dll`)

- `PLRMODE_StartXY_Dead` → `D2GAME_CORPSE_Handler_6FC7FBD0`: `SUNIT_AllocUnitData(UNIT_PLAYER, owner class, x, y,
  …, PLRMODE_DEAD)` — a **new GUID**; owner name copied; `STATE_PLAYERBODY` on; `UNITFLAG_TARGETABLE` set,
  `UNITFLAG_CANBEATTACKED` cleared, `UNITFLAGEX_ISCORPSE`; 75 % of the lost experience stored on the body; equipped
  and cursor items duplicated onto it; then `0x8E CorpseAssign` (assign 1, owner, body) to every player.
- More than 15 bodies: items drop on the ground instead, no body.
- Sync to a client that gets the body's room (`D2GAME_SUNITMSG_FirstFn_6FCC5520`): `0x59 AssignPlayer`
  (body GUID, class, owner name, x, y) → `0x20` base stats → the mode send `stru_6FD30708[17]` = `sub_6FC82010`
  = **`0x0D` code `0x09`** with life % → **`0x74` (assign = `UNITFLAGEX_ISCORPSE`, owner GUID, body GUID)** →
  `0xAA` states (incl. `STATE_PLAYERBODY`).

## 2. Client hover (`D2Client.dll` HoverUpdate `0x6fb01e80`)

- Skips missiles and the local player unit only (`cmp ebp, ebx` @`0x6fb01fd7`, `ebx = [0x6fbcbbfc]`). No party /
  hostility filter for players.
- Type priority table `0x6fba2190`; a dead player (`0x6fb55440`: `UNITFLAG_ISDEAD 0x10000`, player mode `0` or
  `0x11`, monster mode `0` or `0x0c`) gets `+1` (@`0x6fb0207e`).

## 3. Client click (`0x6facb7f0` router → `0x6facab20` interact)

- A unit that is not attackable (the body has no `UNITFLAG_CANBEATTACKED`) and is not a monster goes to the interact
  handler `0x6facab20` (@`0x6facbb55`) regardless of the left skill. Jump table `0x6facb1b0`: player `0x6facadba`,
  monster `0x6facafea`, object `0x6facab50`, item `0x6facac9c`, tile `0x6facaed0`.
- Player case `0x6facadba`: `#10407(target, player) <= 4` and no `0x804` collision between them → send
  **`C2S 0x13` (type 0, body GUID)**; otherwise walk (`0x6fada7c0`) and queue the `0x13` (`0x6fab2d50`).

## 4. Server pick-up (`C2S 0x13` → `sub_6FC828D0`, player case)

- Distance `> 50`: ignored. `<= 8` and target in `PLRMODE_DEAD` (and no trade): `sub_6FC80440` — owner or a
  permitted party member (`PLAYERLIST_CheckFlag(owner, picker, 1)`); owner gets the stored experience back;
  `sub_6FC4AD80` re-equips the items; on success `0x8E` (assign 0), the body unit is removed (`0x0A`), sound `0x5D`;
  else sound `0x17`. `8 < d <= 50`: the server walks the player there (mode 3) and interacts on arrival.

## 5. Client `0x74` / `0x8E` handlers

- `0x74` → `0x6fac94e0`: when the owner is the local player, moves its equipped items client-side onto the body.
- `0x8E` → `0x6fb5d130`: adds/removes the (owner, body) pair in the roster corpse list (`0x6fb4d760` / `0x6fb4d700`).
