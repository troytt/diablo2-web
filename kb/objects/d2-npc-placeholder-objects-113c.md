# Diablo II 1.13c NPC Static Map Placeholder Objects & Dynamic Entity Reconciliation

## 1. Overview & Architectural Problem

In Diablo II v1.13c, certain key town NPCs exist in two distinct formats within the game data:
1. **Dynamic Town Monster/NPC Entities**:
   Configured in `MonPreset.txt` and `MonStats.txt` (with `inTown = 1`, `interact = 1`). These are full game units spawned dynamically by the game server (`D2Game.dll`) and sent to the client via `0xAC AssignNPC` (or `0x0C`). They support interactive dialogue trees, quests, merchant menus, and walking/idle animations.
2. **Static DS1 Map Object Presets**:
   Configured in `Objects.txt` with dummy token `Token = ss` (Static Sprite) and specialized initialization functions (`InitFn = 18` or `InitFn = 19`). In map DS1 files, these are stamped as preset objects (`UNIT_OBJECT = 2`) with `:m` flags (`baseIsMonsters = true`).

When a client receives both the static object assignment (`0x51 AssignObject`) and the server's dynamic NPC assignment (`0xAC AssignNPC`), without explicit lifecycle mutual exclusion, both entities coexist in the client world at identical or adjacent locations. This results in **duplicate visual entities** (e.g. Issue #900: two Jerhyns in Lut Gholein, one clickable and one unclickable).

---

## 2. D2 1.13c Ground Truth: Static Placeholders & Dynamic Pairs

The following table records the canonical 1.13c pairing between `Objects.txt` static placeholders and `MonStats.txt` dynamic NPCs:

| Act | NPC Name | Dynamic `hcIdx` | MonStats Token | Object ID | `InitFn` | DS1 ID | DS1 Lookup Entry | Role / Location |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Act 2** | Jerhyn (杰海因) | **201** | `JE` | **121** | 18 | 16 | `121:JE:NU:d1:m` | Palace entrance (early quests) |
| **Act 2** | Jerhyn (杰海因) | **201** | `JE` | **122** | 19 | 17 | `122:JE:NU:d7:m` | Palace interior (Arcane Sanctuary quest) |
| **Act 3** | Hratli (赫拉铁力) | **253** | `HR` | **378** | 18 | 109 | `378:HR:NU:d1:m` | Kurast Docks (dockside forge) |
| **Act 3** | Hratli (赫拉铁力) | **253** | `HR` | **379** | 19 | 110 | `379:HR:NU:d7:m` | Kurast Docks (near town exit) |
| **Act 5** | Qual-Kehk (夸尔凯克)| **515** | `0J` | **461** | 18 | 55 | `461:0J:NU:d1:m` | Harrogath center |
| **Act 5** | Qual-Kehk (夸尔凯克)| **515** | `0J` | **462** | 19 | 56 | `462:0J:NU:d7:m` | Harrogath alternate |
| **Act 5** | Anya (安雅) | **512** | `XR` | **542** | 18 | 125 | `542:XR:NU:d1:m` | Harrogath town square |
| **Act 5** | Anya (安雅) | **512** | `XR` | **543** | 19 | 126 | `543:XR:NU:m` | Harrogath alternate |

### `Objects.txt` Attributes for Placeholder Rows
- `Token`: `ss`
- `Draw`: `1`
- `Selectable0..7`: `0` (non-interactive in all modes)
- `HasCollision`: `0` (no physical obstruction footprint)

Because `Selectable0..7` is `0`, the static object placeholder cannot be selected, hovered, or clicked. However, because `Draw` is `1` and the offline asset pack script maps DS1 token `JE` to the DCC/DC6 monster animation `mon-je`, the renderer displays the full animated sprite, appearing as a frozen or unclickable "ghost clone" next to the real NPC.

---

## 3. Native D2 `InitFn 18` / `InitFn 19` Behavior

In native Diablo II binary disassembly (`D2Game.dll` `0x6fc89140` and `D2Client.dll` `0x6fad5120`):
- `InitFn 18` & `InitFn 19` check player/party quest progress (e.g. Act 2 Quest 5 *The Summoner* and Quest 6 *The Seven Tombs*).
- When the condition is met for the dynamic NPC to be spawned at that post, the server initializes the dynamic entity and suppresses or hides the static object placeholder.
- In client-server web ports, packet ordering between `0x51 AssignObject` (map object population) and `0xAC AssignNPC` (active entity sync) can arrive in any sequence.
- Consequently, client-side reconciliation must guarantee invariant deduplication regardless of arrival order.

---

## 4. Client Reconciliation Invariants

To achieve 100% parity with Diablo II 1.13c and eliminate phantom duplicate NPCs:

1. **Mapping Registry**:
   `NPC_PLACEHOLDER_OBJECTS` in `src/common/world/objects-meta.ts` maps each placeholder object classId (`121`, `122`, `378`, etc.) to its corresponding dynamic monster `hcIdx` (`201`, `253`, etc.).
2. **Dynamic Reconciliation in `ClientWorld`**:
   - `ClientUnit.hidden: boolean`: Tracks visibility suppression.
   - When a monster unit of town NPC `hcIdx` is assigned (`UnitAssign`), `ClientWorld.reconcileNpcPlaceholderObjects(hcIdx)` marks corresponding placeholder objects as `hidden = true`.
   - When a static placeholder object is assigned (`UnitAssign`), it checks `ClientWorld.hasActiveMonsterNpc(placeholderHcIdx)`. If active, `unit.hidden = true`.
   - When a monster unit is removed (`UnitRemove`), `reconcileNpcPlaceholderObjects(removedMonsterClassId)` un-hides placeholder objects if no active dynamic NPC remains.
3. **Collision & Interaction Suppression**:
   - `updateObjectCollisionFootprint`: Hidden objects never stamp collision onto the pathing grid.
   - `CommandMapper.isSelectableCandidate` and `pickUnitAtSubtile`: Hidden units are immediately bypassed during cursor hit-testing and radial targeting.
4. **Rendering Gate**:
   - `OnlineSession.buildRenderableUnits()`: Bypasses any unit with `u.hidden === true` as well as any object whose `hasActiveMonsterNpc(placeholderHcIdx)` is true.
