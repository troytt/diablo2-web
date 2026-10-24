# D2Client 1.13c — Monster Death State, S2C 0x76, and Revival Paths (Refs #916)

Findings from investigating issue #916 (Travincal monsters "standing after death and still left-click
targetable"). All addresses are from the 1.13c `D2Client.dll` (base `0x6FAA0000`), `D2Common.dll` and
`D2Game.dll` in `samples/d2`.

## 1. Server side: how a monster death is sent

- `SUNITDMG_KillMonster` → `D2GAME_ModeChange_6FC65220(pGame, &modeChange{MONMODE_DEATH}, a3 = 1)`.
  With `a3 = 1` and the DT callback (`sub_6FC63B30` → `SUNIT_SetCombatMode(DT)`) the used skill is cleared
  (`if (a3 && nMode == nCurrentAnimMode) UNITS_SetUsedSkill(nullptr)`), so the per-client update
  `sub_6FC659E0` → `sub_6FC65C70` never replaces DT with a 0x4C/0x4D skill packet.
- DT/DD rows of `stru_6FD28988` are `{0,1,0,0,8,8}` / `{0,0,0,0,9,9}`: no target, no 0x68/0x6B/0x6C, so the
  death is always **S2C 0x69 cmd 0x08** (then cmd 0x09), `pkt[10] = direction`, `pkt[11] = last hit class`.
- Damage clamps HP: `nNewHp < 256 → 0` (`SUnitDmg.cpp`), and `MONSTER_DeleteEvents` deletes `STATREGEN` at
  death, so a corpse's HP percent (`D2Game 0x6FC97060`: `hp*128/maxhp`, `0x80` if `maxhp<=0 || hp>=maxhp`)
  stays 0.
- Right after the 0x69 in the same update, `UNITFLAG_UPGRLIFENHITCLASS` sends **S2C 0x0C** with the
  constant event byte `19` (`0x13`, `D2GAME_PACKETS_SendPacket0x0C_6FC3C8A0`).

## 2. S2C 0x76 is "clear hover text", not a mode change

- `D2Client 0x6FB5D370` (6 bytes `76 type id32`): `0x6FB54E20` lookup of `(type, id)`; if found and
  `unit+0xA4` (hover message) is non-null, `D2Common #10422` (CHAT_FreeHoverMsg) frees it and `unit+0xA4 = 0`.
  No mode, HP or flag change.
- `unit+0xA4` is written by the 0x26 overhead-chat path (`0x6FB2DEE7..0x6FB2DF23`).
- Server: `D2Game.dll` sends `0x76` when `UNITFLAG_HASTXTMSG` is set and `pHoverText == NULL`
  (hover timed out: `MonsterMode.cpp` FREEHOVER event; or freed at death: `sub_6FC63E80`).
- In 1.13c D2Game the only monster hover-text setter (AITACTICS_AddMessage-equivalent, `0x6FD118B0`) has no
  callers or references; unit+0xA4 is otherwise set for shrines (`0x6FC8DA00`) and player overhead chat
  (`0x6FCF00A0`). So in practice 0x76 targets players/objects, not dying monsters.
- The port decoded 0x76 as `UnitMode mode=1`, which cleared ISDEAD and stood dead units up in NU. Fixed in
  the Refs #916 change: `decode0x76HoverTextClear` → `UnitHoverTextClear` → clears `overheadText` only.

## 3. Open parity gaps (NOT changed yet — recorded for follow-up)

### 3.1 `UNITFLAG_ISDEAD` (0x10000) is never cleared by the 1.13c client

- Exhaustive scan of `D2Client.dll` and `D2Common.dll` disassembly: no `and …,0xfffeffff`, no byte/word clear
  of `unit+0xC6`, no `btr`. ISDEAD is only ever *set* (e.g. `0x6FAFE819`, `0x6FB54BE4`, `0x6FB611BA`).
- Monster command handler `0x6FAFDC70` prologue (`0x6FAFDC98..0x6FAFDCE7`):
  - if `ISDEAD` or (`type==1` and mode `0`/`12`) [or player mode `0`/`0x11`] and `cmd ∉ {8, 9}`:
    `#10938` (PATH_SetUnitAliveCollision, via thunk `0x6FABCD48`), `0x6FAFC150`, clear `dwFlagEx & 0x40000`;
  - else (alive): `#11011` (`D2Common_10214` living footprint refresh, thunk `0x6FABCD90`).
  - ISDEAD itself is left set.
- Port difference: `NpcMotion.executeCmd0x6FAFDC70` clears ISDEAD for every `cmd ∉ {8,9}` and runs the
  alive-restore block regardless of dead state; `ClientWorld.applyUnitModeImmediate` also clears 0x10000 when
  a non-death mode arrives for a dead monster. Not changed in #916 because resurrection
  (`SKILLS_SrvDo097_Resurrect`, same GUID, mode change only) needs the 1.13c hover/target rule for monsters
  (`0x6FB01650`, `0x6FB01AE0`, `#10648`) decoded first.

### 3.2 0xAC initial-mode normalisation by life percent is invented

- `D2Client 0x6FB5E420`: 4-bit mode read at `0x6FB5E462..0x6FB5E477` is passed as-is to unit creation
  (`0x6FB57780`); life is only written as stats: `STAT_MAXHP(7) = 0x8000` and `STAT_HITPOINTS(6) = pkt[11]<<8`
  (`0x6FB5E6BE..0x6FB5E6D7`). No mode override from life.
- Server `0x6FCACAC9`: mode sent is `8`→8, `9`→9, `12`/`0`→as-is, anything else→`1`.
- Port: `decode0xACAssignNpc` forces `12` when `lifePct <= 0` and an alive mode, and forces `1` (alive) when
  `lifePct > 0` even if the wire says DT/DD. Not hit in practice (corpse HP is 0, §1), but not 1.13c.

## 4. Verification notes

- Baked art: all 211 `public/entities/monster-*.json` packs have `dt`/`dd` exactly when MonStats2 `mDT`/`mDD`
  are set (0 mismatches); ZZ/ZP/HP packs carry both.
- Headless: real 0x69/0x6A/0x0C bytes for classes 235/238/345 on a MapService-built Travincal (level 83) map,
  packs of 8 overlapping monsters → 560/560 end dead in DT→DD, 0 exceptions.
- `D2gsAdapter` used to swallow listener exceptions (`catch { protocolErrors++ }`); it now reports each one via
  `console.error` with opcode, raw hex and stack, so a client-side throw while applying a death is visible.
