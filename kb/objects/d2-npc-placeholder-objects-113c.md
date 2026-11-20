# Diablo II 1.13c `Objects.txt` `InitFn` Dynamic NPC & Boss Spawners (`gpObjectInitFnTable`)

## 1. Overview & Architectural Problem

In Diablo II v1.13c, several town NPCs and the Act 5 Halls of Vaught SuperUnique boss **Nihlathak (`SU 60`, `hcIdx 526`)** are NOT placed in `MonPreset.txt`. Instead, map DS1 files stamp `Objects.txt` marker objects (`Token = ss` or `:m` lookup entries in `object-lookup-data.ts`) whose server-side `InitFn` (`D2Game.dll` `gpObjectInitFnTable` @ `0x6fd2e050`) spawns or relocates the dynamic `UNIT_MONSTER` (`0xAC AssignNPC`) based on party quest state:

1. **`Sync = 1` Static Placeholder Pairs (`Objects.txt` `121, 122, 378, 379`)**:
   Broadcast to clients via `S2C 0x51 AssignObject` with `Draw = 1` (`mon-je`, `mon-hr`) and `Selectable0..7 = 0`. When the dynamic `UNIT_MONSTER` (`201` Jerhyn or `253` Hratli) is active in `ClientWorld`, the static placeholder object must be hidden (`ClientUnit.hidden = true`) so no unclickable duplicate sprite renders.
2. **`Sync = 0` Server-Only Spawner Anchors (`Objects.txt` `382, 385, 459, 460, 461, 462, 542, 543, 567`)**:
   Server-only coordinate markers (`Sync = 0`) that `D2Game.dll` never sends via `0x51 AssignObject`. Recording their anchor coordinates on `LoadedAreaRecord.initFnAnchors` without broadcasting `UnitAssign` prevents unclickable ghost sprites for `459` (`XS` Anya) before `A5Q3` rescue, `460` (`XS` Frozen River Anya) after `A5Q3` rescue, `461` (`0J` Town Nihlathak) after `A5Q3` rescue, `462` (`0J` Halls of Vaught Nihlathak) after Boss Nihlathak dies, and `567` (`Zoo` Harrogath Zoo dummy).

---

## 2. Canonical 1.13c `gpObjectInitFnTable` (`0x6fd2e050`) Disassembly Ground Truth

| Act / Area | `Objects.txt` ID | `InitFn` (`D2Game.dll` VA) | `Sync` | DS1 Lookup Entry | Dynamic Unit Spawned | Quest / Lifecycle Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Act 1 (`Area 1`)** | **385** (`Cain Start Position`) | `54` (`0x6fc860d0`) | `0` | `110:385:DC:NU:d1:m` | **Deckard Cain** (`hcIdx 265`, `cain5`) | Spawns once `a1q3` (`The Search for Cain`) has `PRIMARY_GOAL_DONE \| REWARD_PENDING \| COMPLETED` |
| **Act 2 (`Area 40`)** | **121** (`Jerhyn Place Holder 1`) | `18` (`0x6fce7c20`) | `1` | `16:121:JE:NU:d1:m` | **Jerhyn** (`hcIdx 201`, `jerhyn`) | Spawns Jerhyn at docks/approach `(5147, 5191)` before any `a2q1..a2q6` progress |
| **Act 2 (`Area 40`)** | **122** (`Jerhyn Place Holder 2`) | `19` (`0x6fce9b70`) | `1` | `17:122:JE:NU:d7:m` | **Jerhyn** (`201`) + **Kaelan** (`331`, `act2guard2`) | Relocates/spawns Jerhyn at Palace entrance `(5071, 5148)` once any `a2q1..a2q6` flag is set; spawns Kaelan at `(obj122.x + 1, obj122.y)` until Duriel (`a2q6`) is slain (`0x6fce9b96..0x6fce9bfb`) |
| **Act 3 (`Area 75`)** | **378** (`Hratli Start`) | `49` (`0x6fd086a0`) | `1` | `109:378:HR:NU:d1:m` | **Hratli** (`hcIdx 253`, `hratli`) | Spawns Hratli at docks `(5122, 5165)` when `word 16 == 0` and `a3q1..a3q6` are all `0` |
| **Act 3 (`Area 75`)** | **379** (`Hratli End`) | `50` (`0x6fd08560`) | `1` | `110:379:HR:NU:d7:m` | **Hratli** (`hcIdx 253`, `hratli`) | Relocates/spawns Hratli at forge `(5219, 5038)` once `word 16 != 0` or any `a3q1..a3q6` flag is set |
| **Act 3 (`Area 75`)** | **382** (`Natalya Start`) | `52` (`0x6fd08310`) | `0` | `(preset 382)` | **Natalya** (`hcIdx 297`, `natalya`) | Spawns Natalya at `(5221, 5111)` while `a3q6` (`word 22` Mephisto) is uncompleted; removed once `a3q6` completes |
| **Act 5 (`Area 109`)** | **459** (`Drehya Start In Town`) | `66` (`0x6fc7eb30`) | `0` | `53:459:XS:NU:d7:m` | **Anya** (`hcIdx 512`, `drehya`) | Anchors Town Anya at `(5107, 5114)` once `a5q3` (`Prison of Ice`) has `REWARD_PENDING \| COMPLETED` |
| **Act 5 (`Area 114`)** | **460** (`Drehya_start_outside_town`) | `67` (`0x6fc7e8d0 -> 0x6fc7e940`) | `0` | `54:460:XS:NU:d1:m` | **Frozen Anya** (`Objects.txt 558`, `OperateFn 67`) | Spawns interactive `Objects.txt 558` (`anya_framing`, `mode = 0`) at `460`'s anchor while `a5q3` is unrescued; thawing `558` with `'ice'` (`0x6fc7cd50` / `0x6fc7c480`) transitions `558` to `mode = 2` and broadcasts `S2C 0x89` Event `16` (`anya center` `#528`) |
| **Act 5 (`Area 109`)** | **461** (`Nihlathak_inside_town`) | `68` (`0x6fc7c5c0`) | `0` | `55:461:0J:NU:d1:m` | **Nihlathak** (`hcIdx 514`, `nihlathak`) | Spawns Town Nihlathak at `(5076, 5126)` only while `a5q3` is unrescued AND no player has entered `Areas 121..124` (`0x6fc7f560`) |
| **Act 5 (`Area 124`)** | **462** (`Nihlathak_outside_town`) | `69` (`0x6fc7cf70`) | `0` | `56:462:0J:NU:d7:m` | **SuperUnique Nihlathak** (`SU 60`, `hcIdx 526`, `nihlathakboss`) | Spawns `SU 60` (`Nihlathak Boss` + minions) in Halls of Vaught (`Area 124`) DS1 room `(12705, 5020)` for `A5Q4` |
| **Act 5 (`Area 109`)** | **542 / 543** (`Larzuk Greeting / Standard`) | `70 / 71` (`0x6fc7c470` / `0x6fc7c3a0`) | `0` | `125:542:XR:NU:d1:m` / `126:543:XR:NU:m` | **Larzuk** (`hcIdx 511`, `larzuk`) | Unconditionally spawns Larzuk at `(5143, 5028)` in Harrogath (`Area 109`) |
| **Act 5 (`Area 120`)** | **547 / 564** (`AncientsDoor` / `SummitDoor`) | `73 / 76` (`0x6fc765b0` / `0x6fc773d0`) | `1` | `130:547` / `146:564` | *(In-place mode init)* | `547` (`-> 128`) starts `mode = 2` once `a5q5` is completed; `564` (`-> 118`) starts `mode = 2` while Ancients are inactive, locks to `mode = 0` during the fight (`OperateFn 71` @ `0x6fc7d690`), and reopens to `mode = 2` on 3rd Ancient death (`0x6fc7e660`) or Town Portal reset (`0x6fc7e0e0`) |
| **Act 5 (`Area 109`)** | **567** (`Zoo`) | `79` (`0x6fc77b80`) | `0` | `149:567` | *(Server-only ambient zoo marker)* | Server-only `Sync == 0` marker (`Token = ss`); never broadcast via `0x51 AssignObject` |

---

## 3. Server & Client Reconciliation Invariants

1. **Server `loadArea` (`src/server/engine/game-instance/area-and-session.ts`)**:
   - Records `initFnAnchors` for `121, 122, 378, 379, 382, 385, 459, 460, 461, 462, 542, 543` on `LoadedAreaRecord`.
   - Suppresses `spawnObject` (`UnitAssign`) for `Sync == 0` spawner markers (`382, 385, 459, 460, 461, 462, 542, 543, 567`).
   - Synthesizes `{ classId: 526, x, y, superUniqueIndex: 60 }` from `Object 462` in `Area 124` so SuperUnique Nihlathak spawns when his Halls of Vaught room activates.
   - Runs `syncRogueEncampmentA1Q3State113c` (`Area 1`), `syncLutGholeinAct2NpcState113c` (`Area 40`), `syncKurastDocksAct3NpcState113c` (`Area 75`), `syncHarrogathA5Q3State113c` (`Area 109`), and `syncFrozenRiverA5Q3State113c` (`Area 114`) on area load, player connect, area transitions, and quest flag updates.
2. **Client `NPC_PLACEHOLDER_OBJECTS` (`src/common/world/objects-meta.ts` & `ClientWorld`)**:
   - Maps `121/122 -> 201`, `378/379 -> 253`, `385 -> 265`, `459 -> 512`, `460 -> 527`, `461 -> 514`, `462 -> 526`, and `542/543 -> 511`.
   - Hides any `Sync == 1` static placeholder object whenever its paired dynamic `UNIT_MONSTER` is active in `ClientWorld`.
