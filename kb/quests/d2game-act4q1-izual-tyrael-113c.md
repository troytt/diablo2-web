# D2Game.dll & D2Client.dll 1.13c — Act IV Quest 1 (`ACT4Q1` The Fallen Angel)

## Authoritative Binary References (`1.13c`)

- **Quest ID / `.d2s` Word**: `questId = 0x16` (`22`), `.d2s` / `S2C 0x28` word index `25` (`ACT_BASE[4] + 0`).
- **`D2Game.dll` Callbacks**:
  - `ACT4Q1_NpcActivate`: `0x6FCDA68F..0x6FCDA7E6`
  - `ACT4Q1_SpawnIzualGhost`: `0x6FCDA960..0x6FCDAA2B`
  - `ACT4Q1_UnitDied`: `0x6FCDABF0..0x6FCDAD32`
- **`D2Client.dll` Quest Log Row `25` (`0x6FBA8188 + 25 * 16`)**:
  - `RP_PATH` (`0x6FACD07C`): `row === 25` intentionally falls through (`skipPath18c = false`) to `NORMAL_S` (`0x6FACD28D`), rendering slot `3` (`qstsa4q13a`, `"Talk to Izual's Spirit."`) or slot `4` (`qstsa4q13`, `"See Tyrael for reward."`) while `QFLAG_REWARDPENDING` (`0x0002`) is active.
- **`MonStats.txt` Units**:
  - `hcIdx 256` (`izual`): hostile quest boss in Plains of Despair (`Area 105`).
  - `hcIdx 406` (`izualghost`): friendly talk-only spirit (`inTown=1`, `Align=2`, `killable=0`) spawned at `(monster.x, monster.y)` on Izual's death.
  - `hcIdx 367` (`tyrael2`): Pandemonium Fortress (`Area 103`) quest giver / turn-in NPC.

## Exact State Machine & Reward Flow

1. **Quest Initiation (`tyrael2` `hcIdx 367` in `Area 103`)**:
   - When `(w & (QFLAG_REWARDGRANTED | QFLAG_REWARDPENDING | QFLAG_USTARTED)) === 0`, talking to Tyrael sets `QFLAG_USTARTED` (`0x0004`, `A4Q1InitTyrael`).
   - Quest status byte: `1` (`qstsa4q11`, `"Look for Izual in the Plains of Despair."`) outside `Area 105`, or `2` (`qstsa4q12`, `"Destroy the demon that holds Izual's soul."`) inside `Area 105`.
2. **Izual Death (`ACT4Q1_UnitDied` `0x6FCDABF0` + `ACT4Q1_SpawnIzualGhost` `0x6FCDA960`)**:
   - Checks `(w & 0x0003) === 0` on eligible recipients (`killer` and same-area party allies in `Area 105`; `includeSameActTown = false`).
   - Sets **`0x2002` (`QFLAG_REWARDPENDING | QFLAG_COMPLETEDNOW`)** without setting `QFLAG_REWARDGRANTED` (`0x0001`), so `+2` skill points and Act 4 vendor `10%` discounts (`Halbu` `257`, `Jamella` `405`) remain withheld until Tyrael turn-in.
   - Spawns `izualghost` (`hcIdx 406`) at `(monster.x, monster.y)`.
   - Quest status byte while `0x0002` is set: `3` (`qstsa4q13a`, `"Talk to Izual's Spirit."`) in `Area 105` before `QFLAG_CUSTOM2` (`0x0020`), else `4` (`qstsa4q13`, `"See Tyrael for reward."`).
3. **Izual's Spirit Dialogue (`ACT4Q1_NpcActivate` on `hcIdx 406`)**:
   - Sets `QFLAG_CUSTOM2` (`0x0020`, `QUEST_FLAG_CUSTOM_5_113C`, `A4Q1SuccessfulIzual`) when `(w & 0x0003) !== 0`, advancing Plains of Despair quest log status from `3` to `4`.
4. **Tyrael Turn-In (`ACT4Q1_NpcActivate` on `hcIdx 367`)**:
   - When `(w & 0x0002) !== 0 && (w & 0x0001) === 0`, clears `QFLAG_REWARDPENDING` (`~0x0002`), sets `QFLAG_REWARDGRANTED | QFLAG_COMPLETEDNOW` (`0x2001`), adds `+2` to `STAT_NEWSKILLS` (`statId = 5`), and unlocks the `10%` discount at Halbu (`257`) and Jamella (`405`).
   - Independent of `ACT4Q2_NpcActivate` / `a4q3`: if the player slays both Izual and Diablo before speaking to Tyrael (`367`), a single interaction turns in `a4q1` (`+2` skills) **and** opens the Harrogath red portal (`Objects.txt 566`).
