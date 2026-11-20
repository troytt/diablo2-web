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

## 3. Hover / Target Validation (`0x6FB01650`, `0x6FB01AE0`, `0x6FB01E80`, `#10648`, `#10787`) & Revival Paths

### 3.1 `UNITFLAG_ISDEAD` (`0x10000`) & `0x6FB56210` (`UNIT_RestoreAliveFlags`)

- In `D2Client.dll`, `0x6FB55440` (`UNIT_IsDead(pUnit)`) returns `1` when `(pUnit->dwFlags & 0x10000) != 0`; otherwise for `dwUnitType == 1` (`UNIT_MONSTER`) it returns `dwAnimMode == 0 (MONMODE_DEATH) || dwAnimMode == 12 (MONMODE_DEAD)`. It never inspects `STAT_HITPOINTS`.
- Monster command handler `0x6FAFDC70` prologue (`0x6FAFDC98..0x6FAFDCE7`):
  - if `ISDEAD` or (`type==1` and mode `0`/`12`) [or player mode `0`/`0x11`] and `cmd ∉ {8, 9}`:
    calls `0x6FB56210` (`UNIT_RestoreAliveFlags`), which executes `and ecx, 0xfffeffff` (`0x6FB56224`, clearing `UNITFLAG_ISDEAD 0x10000`), `#10938` (`PATH_SetUnitAliveCollision`), `0x6FAFC150`, and clears `dwFlagEx & 0x40000`;
  - else (alive): `#11011` (`D2Common_10214` living footprint refresh, thunk `0x6FABCD90`).
  - Within the 30-entry command jump table (`0x6FAFEBAC`), only `cmd 0x07` (`MONMODE_NEUTRAL` at `0x6FAFE8E6`, driven by `S2C 0x6D NPCStop` or `S2C 0x69 cmd 0x07`) also calls `0x6FB56210` at `0x6FAFE964`.
- `cmd 0x06` (`0x69` `MONMODE_GETHIT` at `0x6FAFE095`) and `cmd 0x13` (`0x0C` `NPCGetHit` at `0x6FAFE14D`) compute `edx = s[2] & 0x7f` and only call `D2Common.#10590(pUnit, STAT_HITPOINTS=6, edx << 8, 0)` when `edx != 0` (`test edx, edx; jz`). When `s[2] == 0x80` (`edx == 0`, sent on a killing blow), they leave `STAT_HITPOINTS = 0` untouched.

### 3.2 `D2Common.#10648` (`0x6FD6A520`), `0x6FB01E80` (Hover Priority), `0x6FB01AE0` & `0x6FB01650` (Action Target Validation)

- `D2Common.#10648` (`0x6FD6A520`, `UNITS_IsMonsterInDeathOrDeadMode(pUnit)`):
  returns `1` iff `pUnit != NULL && pUnit->dwUnitType == 1 && (pUnit->dwAnimMode == 0 || pUnit->dwAnimMode == 12)`.
- `0x6FB01E80..0x6FB02170` (Mouse Hover Candidate Scorer):
  - Calls `0x6FB568E0` (`UNIT_IsSelectableTarget`, which gates dead monsters via `D2Common.#10817` `UNITS_IsCorpseUseable`: `mCorpseSel` + `dwAnimMode == 12` + `!STATE_RED` + `!STATE_CORPSE_NODRAW`).
  - At `0x6FB0208B` and `0x6FB020B6`, calls `D2Common.#10648(pCandidate)`: if the monster is in `DT (0)` or `DD (12)`, its hover priority score is demoted to `-8` (`0xFFFFFFF8`), whereas living monsters receive `+4` (`0x6FB020CF`) or `+2` (`0x6FB020BC`), so any overlapping living unit or ground item always wins hover priority over a corpse.
- `0x6FB01AE0` (Mouse Action Target Validator) & `0x6FB01650` (Corpse Target Validator):
  - At `0x6FB01B50`, calls `0x6FB55440(pTarget)` (`UNIT_IsDead`).
  - When `UNIT_IsDead(pTarget) != 0` and the skill is not a corpse-targeting skill, `0x6FB01BD0..0x6FB01BEA` extracts the corpse's `(x, y)` coordinates and sets `pTarget = NULL` (`xor edi, edi`), converting bare left/right clicks on a corpse into ground `(x, y)` casts/moves (`SkillAt` / `Move`) instead of `SkillOn`.
  - At `0x6FB01C9C`, calls `D2Common.#10787(pSkill, pPlayer)` (`0x6FDA2340`, `SKILLS_CheckSkillCorpseTargetable`, which checks `(pSkillsTxt->dwFlags & 0x200) != 0` i.e. `Skills.txt` `TargetCorpse == 1`). Only when `#10787` returns `0` (`TargetCorpse == 1`) does `0x6FB01CB9` invoke `0x6FB01650` (`#10817` `UNITS_IsCorpseUseable` + `SelectProc` callback) to lock onto the corpse.

### 3.3 Post-Death Server Packets (`D2GAME_SyncMonsterToClient` `0x6FD13A40`) & Same-GUID Resurrection (`SKILLS_SrvDo097_Resurrect` `0x6FCD5BD0`)

- **Why the server sends `0x0C` after `0x69 cmd 0x08` in the same frame**:
  - In `D2Game.dll` `SUNITDMG_ExecuteEvents` (`0x6FCFD100`), a non-killing hit that skips `MONMODE_GETHIT` (`0x6FCFD159`) or changes HP by `> 4/128` without `HITFLAG_GETHIT` (`0x6FCFD438`) sets `pMonster->dwFlags |= 0x8000` (`UNITFLAG_UPGRLIFENHITCLASS`).
  - If a subsequent hit in the same 25Hz server frame kills the monster, `MONSTER_EnterDeathMode` (`0x6FC96270`) sets `dwAnimMode = 0 (DT)` and `dwFlags |= 0x0001` (`UNITFLAG_DOUPDATE`) without clearing `0x8000`.
  - In `D2GAME_SyncMonsterToClient` (`0x6FD13A40`), `dwFlags & 0x0001` (`0x6FD13B1F` -> `0x6FD135C0`) sends **`S2C 0x69` `cmd = 0x08` (`MONMODE_DEATH`)** first, and immediately afterward `dwFlags & 0x8000` (`0x6FD13BF1` -> `0x6FD13360`) sends **`S2C 0x0C` (`NPCGetHit`, `cmd = 0x13`)** with `pkt[8] = 0x80` (`curHp == 0` -> `0x00 | 0x80`).
- **Explicit Resurrection Signals**:
  1. **Necromancer `Revive` (`skillId = 95`)**: sets `STATE_REVIVE` (`96`) via `S2C 0xA8`.
  2. **Monster / Shaman Resurrection (`SKILLS_SrvDo097_Resurrect` `0x6FCD5BD0` -> `D2GAME_ResurrectUnit` `0x6FCD33B0`)** and **Self-Resurrect (`Reanimated Horde` `AI_SelfResurrect`)**:
     - Operates on an existing settled corpse (`MONMODE_DEAD = 12`) with the **same `unitId` (GUID)**.
     - Restores `STAT_HITPOINTS = STAT_MAXHP` (`lifeByte = 0x80`), clears `UNITFLAG_ISDEAD`, and calls `D2GAME_ChangeMonsterMode` (`0x6FC95E10`) with the mode from `MONSTER_GetResurrectMode` (`0x6FD13CB0`: `MONMODE_SEQUENCE = 14` if `MonStats2.txt` `mSQ` is set, else `MONMODE_SKILL1 = 8` if `ResurrectMode == 8`, else `MONMODE_NEUTRAL = 1`), emitting `S2C 0x69`/`0x6A` (`cmd = 14`, `8`, or `7`) or `S2C 0x6D` (`NPCStop`, `cmd = 7`, `life > 0`) on the `mode 12` corpse.

### 3.4 0xAC initial-mode normalisation by life percent is invented

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
