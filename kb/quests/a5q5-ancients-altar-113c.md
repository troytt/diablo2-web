# Diablo II v1.13c A5Q5: Rite of Passage (Ancients Altar, Statues & Monster `classId` Lifecycle)

Ground truth: `D2Game.dll` 1.13c (`ImageBase 0x6FC20000`, `a5q5.cpp` + `MonsterUnique.cpp`) and `D2Client.dll` 1.13c (`ImageBase 0x6FAB0000`, `SCmd.cpp`).
MPQ tables: `Objects.txt` (`474..476`, `546`, `547`), `MonStats.txt` (`0`, `540..542`), `SuperUniques.txt` (`43..45`).
Port: `src/server/engine/game-instance.ts`, `src/server/room-host.ts`, `src/netproto/d2gs/s2c/units.ts`, `src/client/world/client-world.ts`, `src/client/world/world-event-applier.ts`, `src/client/world/client-unit.ts`. Issue #1774.

## 1. Arreat Summit (`Levels.txt` ID 120) Objects & SuperUniques

| Kind | ID / `hcIdx` | Token / Key | Role |
|---|---|---|---|
| `Objects.txt` | `546` (`0x222`) | `AncientsAltar` (`OperateFn 65`) | Activates the Ancients encounter (`mode 0 -> 2`) |
| `Objects.txt` | `475` (`0x1DB`) | `AncientStatue3` (`OperateFn 63`) | Talic statue (`mode 0` stone -> `mode 4` empty pedestal -> `mode 2` golden victory statue) |
| `Objects.txt` | `476` (`0x1DC`) | `AncientStatue1` (`OperateFn 63`) | Madawc statue (`mode 0` -> `mode 4` -> `mode 2`) |
| `Objects.txt` | `474` (`0x1DA`) | `AncientStatue2` (`OperateFn 63`) | Korlic statue (`mode 0` -> `mode 4` -> `mode 2`) |
| `Objects.txt` | `547` (`0x223`) | `AncientsDoor` (`OperateFn 66`) | Worldstone Keep Level 1 gate; requires `a5q5` (`QFLAG_REWARDGRANTED` `0x0001` or `QFLAG_PRIMARYGOALDONE` `0x1000`) |
| `SuperUniques.txt` | `43` (`Ancient Barbarian 1`) | `MonStats` `540` `ancientbarb1` (`0D`) | Talic — Normal `ResPo = 70`, NM `70`, Hell `50` |
| `SuperUniques.txt` | `44` (`Ancient Barbarian 2`) | `MonStats` `541` `ancientbarb2` (`0F`) | Madawc — Normal `ResPo = 0`, NM `0`, Hell `50` |
| `SuperUniques.txt` | `45` (`Ancient Barbarian 3`) | `MonStats` `542` `ancientbarb3` (`0E`) | Korlic — Normal `ResPo = 70`, NM `70`, Hell `50` |

By contrast, `MonStats.txt` row `0` (`skeleton1`, `"Skeleton"` / `"骷髅"`, token `"SK"`) has `ResPo = [50, 75, 75]` across `[Normal, Nightmare, Hell]`.

## 2. `D2Game.dll` `a5q5.cpp` State Machine (`0x6FC7E0E0..0x6FC7E660`)

- **Altar Operate (`0x6FC7E560`, `OperateFn 65`)**:
  - Ignores interaction if `pAltar->eMode == 2` (`OBJMODE_OPENED`) or if the encounter is already active.
  - Transitions Altar `546` to `OBJMODE_OPENED` (`2`) and schedules the statue-awakening timer (`0x6FC7E420`).
- **Statue Awakening (`0x6FC7E420` -> `0x6FC56820` -> `0x6FC67CF0` -> `MONSTERUNIQUE_SpawnSuperUnique` `0x6FC451F0`)**:
  - Maps statue `classId` at `0x6FC7E467..0x6FC7E49C`:
    - `0x1DB` (`475`) -> `SuperUniques` index `0x2B` (`43`, `ancientbarb1`, `hcIdx 540`)
    - `0x1DC` (`476`) -> `SuperUniques` index `0x2C` (`44`, `ancientbarb2`, `hcIdx 541`)
    - `0x1DA` (`474`) -> `SuperUniques` index `0x2D` (`45`, `ancientbarb3`, `hcIdx 542`)
  - Sets each statue object to `mode = 4` (`OBJMODE_SPECIAL2`, empty pedestal) while its corresponding Ancient is alive.
  - `MONSTERUNIQUE_SpawnSuperUnique` (`0x6FC451F0`, difficulty count check at `0x6FC45353: mov al, [esi+0x6d]; test al, al; jbe 0x6fc45382`) rolls `pGame->nDifficulty` random `MonUMod`s in addition to fixed `Mod1..Mod3` (`0` random mods in Normal, `1` in Nightmare, `2` in Hell).
- **Town Portal Reset on Level 120 (`0x6FC7E3C0` -> `0x6FC7E0E0`)**:
  - Opening a Town Portal on `LEVEL_ARREATSUMMIT` (`120`) while the Ancients encounter is active despawns all living Ancients (`540..542`), restores statues `474..476` to `OBJMODE_NEUTRAL` (`0`), and resets Altar `546` to `OBJMODE_NEUTRAL` (`0`).
- **Victory (`0x6FC7E660`) & Worldstone Keep Gate (`0x6FC7E2E0`, `OperateFn 66`)**:
  - Killing the 3rd Ancient sets `a5q5` quest completion (`0x0001 | 0x0002 | 0x1000`), transitions statues `474..476` to `OBJMODE_OPENED` (`2`), and unlocks Gate `547` (`AncientsDoor`).
  - Before `a5q5` is completed, operating Gate `547` (`0x6FC7E2E0`) emits reject speech sound `19` (`PlaySound` `"I cannot"`) and leaves the gate closed (`mode 0`).

## 3. `D2Client.dll` Monster Unit Lookup, `0xAC AssignNPC` & `0x7A SummonAction`

- **Non-spawn S2C packets never fabricate monsters (`D2Client.dll 0x6FB54E20` / `D2CLIENT_FindServerSideUnit`)**:
  - Movement (`0x67..0x6D`), mode/hit/death (`0x0C`, `0x0D`, `0x69`), reassign (`0x15`), state (`0xA7..0xAA`), and stat (`0x19..0x20`) handlers look up `unitType = 1` in the client monster hash table; if the `unitId` was never assigned or was removed (`0x0A RemoveUnit` on AOI exit or death cleanup), the lookup returns `NULL` and the packet is dropped cleanly. Never create a placeholder monster with default `classId = 0` (`skeleton1`).
- **Authoritative `0xAC AssignNPC` (`D2Client.dll 0x6FB57780`)**:
  - Carries `unitId` (`u32`), `classId` (`u16` `MonStats` `hcIdx`), `(x, y)` (`u16`, `u16`), `lifePct` (`u8` `0..128`), `pktLen` (`u8`), and LSB bitstream (`4-bit mode`, optional `compInfo`, `flags`, `16-bit superUniqueId` when `flags & 0x02`, variable `bossMods` list when `flags & 0x08` without `0x02`, `16-bit nameSeed`, optional owner ID).
  - If `unitId` already exists in the client table with a different `classId` (server ID reuse or statue/minion slot reuse), the stale unit state (`classId`, `flags`, `superUniqueId`, `bossMods`, `nameSeed`, overlays, states, pet/merc links) must be discarded and replaced by the new `0xAC` unit.
  - When a culled monster re-enters a player's AOI after `0x0A RemoveUnit`, the server must re-emit `0xAC AssignNPC` (`UnitAssign`) before forwarding incremental movement/state packets.
- **`0x7A SummonAction` (`D2Client.dll 0x6FB5C720`)**:
  - Bytes `[2..3]` (`u16`) carry the summoned pet's `MonStats.txt` `hcIdx` (`pet.classId`), never the casting `Skills.txt` `skillId`.
- **Client `world.difficulty` Synchronization (`0x01 GameFlags` & `GameLogonAck`)**:
  - `world.difficulty` must update on every game join (`GameFlags` and `GameLogonAck`) so `getMonsterKindByHcIdx(unit.classId, world.difficulty)` never evaluates a Normal (`0`) game monster against a previous Nightmare (`1`) or Hell (`2`) session's resistance table.
