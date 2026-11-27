# D2MOO (1.10f) to Diablo II v1.13c Binary Reference Index

> **License & Scope Notice**: [ThePhrozenKeep/D2MOO](https://github.com/ThePhrozenKeep/D2MOO) (MIT License, see `THIRD_PARTY_NOTICES.md`) describes **Diablo II v1.10f**. In this project, D2MOO is used **strictly as a read-only symbol, struct-field, and high-level intent reference**. Every address, register convention, ordinal, struct offset, and branch condition MUST be independently verified against the authoritative **v1.13c** binaries (`D2Game.dll` base `0x6FC20000`, `D2Common.dll` base `0x6FD50000`) before entering `kb/` or `src/d2kern-113c/`.
>
> **Differential Parity Closure Status**: The entire **`4,810 / 4,810` (`100.00%` `diff-verified`)** static call-graph room-tick/packet closure (`1,479 / 1,479` `D2Common.dll` + `3,331 / 3,331` `D2Game.dll`, `0` `ported`, `0` `unported`, `4,285` Tarjan SCCs across `37` topological levels `0..36`, `0` legacy imports) is ported and PE32-audited 1-to-1 in `src/d2kern-113c/`. At runtime:
> - **`[K1]`/`[K2]` (`5` scenarios)**: `runtimeExecGap = 0` across both `D2Common` and `D2Game` (`100.00%` of Wine-executed VAs hit in TypeScript at strict zero divergence).
> - **`[K3]` (`9 × p52-*` class skill/summon/aura/merc/missile scenarios, `15,700` golden frames)**: `15,682 / 15,682` post-boot frames at strict zero divergence with **`runtimeExecGap = 0`** across the 9-scenario union (`780 / 780` `D2Common` + `652 / 652` `D2Game` = `1,432 / 1,432` DLL-executed VAs hit in TypeScript).
> - **`[K4]` (`5` Act 1–5 quest & town NPC scenarios, `710` golden frames / `700` stepped frames + `1,440` real-DLL S2C D2TV binary vectors)**: `100.00%` strict zero divergence (`415 / 445` `D2Common` + `429 / 475` `D2Game` `dll ∩ ts` union under `F2` snapshot + `k4-quest-replay-113c.ts`, with `k4-act1-quest` at `273 / 273` `D2Game`).

---

## 1. Verified Systematic Differences: 1.10f (D2MOO) vs. v1.13c Binaries

| Dimension | 1.10f (D2MOO C++ Signatures) | v1.13c (`D2Game.dll` / `D2Common.dll`) | Verification Impact |
|---|---|---|---|
| **Compiler & Internal Calling Convention** | MSVC 6.0 standard `__fastcall` (`ecx`, `edx`, stack right-to-left) | MSVC 7.1 (`.NET 2003`) LTCG custom register conventions (`eax`, `ecx`, `edx`, `ebx`, `esi`, `edi` mixed with stack cleanup `ret N`) | Never trust D2MOO parameter order blindly; always verify prologue register reads and `ret N` stack cleanup in 1.13c x86 disassembly. Example: `0x6FCFE0C0` (`SUNITDMG_ApplyDamage`) takes `eax = pDefender` and stack `(pGame, pAttacker, bApplyResists, pDamage)` (`ret 0x10`). |
| **`0x6FC679B0` Boss Pack `pCoordNode` Arg** | Often misread as `nAnimMode` in 1.10f-derived notes | `MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0` takes **`pCoordNode`** (`D2RoomCoordListStrc*`) as its first parameter | Verified in 1.13c PE32 disassembly: `pCoordNode` is forwarded directly to `0x6FC44950` (`MONUMOD_SpawnMinionOrUniqueMonster`), `0x6FC448A0` (`MONUMOD_InitBossAndMinionPackUMods` with `(3, 6)` minion bounds), and `0x6FC67880` (`MONSTER_SpawnChampionPackMembers`). |
| **`D2StatListStrc` vs `D2StatListExStrc` (`0x80000000`)** | Uniform C++ helper accessors obscure raw struct offset split | `dwFlags & 0x80000000` (`STATLIST_EXTENDED` at `+0x10`) selects **`+0x48` (`FullStats`)** vs **`+0x24` (`Stats`)** | Verified at `D2Common` `0x6FD88A80` (`STATLIST_GetUnitStat`): extended `0x64`-byte unit statlists (`0x80000000` set) store accrued `FullStats` `(pStat, wStatCount)` at `+0x48/+0x4C` (with base `MyStats` at `+0x24/+0x28`), whereas basic `0x3C`-byte item/state modifier statlists (`0x80000000` clear) store `Stats` at `+0x24/+0x28`. |
| **`D2Game.dll` Indirect Dispatch Tables (`0x6FD1A..0x6FD40`)** | Source-level function tables at 1.10f `.data` addresses | Relocated & stride-packed across 1.13c `.rdata`/`.data` (`0x6FD1A078..0x6FD2F9B8` inside `0x6FC20000..0x6FD40000`) | All 30+ static & struct-field indirect tables are PE32-enumerated in `extract-callgraph.py`, including `0x6FD27238`/`+4` (stride-8 spell-icon phases), `0x6FD27338` (`SrvSt`), `0x6FD274A8` (`SrvDo`, 191 slots), `0x6FD277A8` (item events), `0x6FD279D0` (player skill modes), `0x6FD27B8C`/`BB8`/`D50` (objects), `0x6FD2D970`/`DA48`/`DB68` (missiles `SrvDo`/`SrvHit`/`SrvDmg`), `0x6FD2DBF0`/`DF6C` (quests), `0x6FD2E050..0x6FD2E334` (object init/spawners/hooks), `0x6FD2E550` (`monUModTable`), `0x6FD2E668..0x6FD2F0C8` (stride-16 AI init/think), `0x6FD2F448`/`0x6FD2F45C` (43×6 stride-24 `monUModCallbackMatrix`), `0x6FD2F850` (NPC path actions), and `0x6FD2F9B8` (`gpMonsterAiFunctionTable`). |
| **`D2Common.dll` Export Ordinals** | 1.10f ordinal numbering (`#10000..#111xx`) | Reshuffled in 1.11–1.13c (`D2Common.dll` base `0x6FD50000`) | Never copy D2MOO `#10xxx` ordinal numbers; always resolve IAT thunks in 1.13c `D2Game.dll` (`0x6FD18xxx`) to exact 1.13c `D2Common` VAs (`0x6FD5xxxx..0x6FDDxxxx`). |
| **Image Bases & Code Layout** | 1.10f `D2Game.dll` (`0x6FC30000`), `D2Common.dll` (`0x6FD40000`), source-file order | 1.13c `D2Game.dll` (`0x6FC20000`), `D2Common.dll` (`0x6FD50000`), LTCG-reordered `.text` | Subsystem clustering shifted substantially (e.g., `SUnitDmg` lives at `0x6FCFA660..0x6FCFF2B0` in 1.13c; `MonsterMode` at `0x6FC94800..0x6FC9B000`; `AiTactics` at `0x6FD11B10..0x6FD13500`). |
| **`D2GameStrc` Tail Layout (`+0x1DC8..+0x1DF3`)** | `sizeof = 0x1DE8` (includes `0x14`-byte `tGameTask` at `+0x1DC8`, no Uber fields) | `sizeof = 0x1DF4` (`tGameTask` removed in 1.11+; `nDebugBreakTrigger` at `+0x1DC8`, `nWorldEventState` at `+0x1DCC`, Pandemonium/Uber flags at `+0x1DD4..+0x1DF0`) | Verified in `0x6FC4E050` (`GAME_UpdateProgress`: `mov eax, [esi + 0x1dc8]`). Never use 1.10f offsets above `+0x1DC4` without 1.13c disassembly verification. |
| **`D2QuestDataStrc` Respec Slot (`+0xE4`)** | `sizeof = 0xF4` in 1.10f (D2MOO guards `nRespecQuestFilter` under `#if D2_VERSION_MINOR >= 14`) | **`sizeof = 0xF8` already in 1.13c** (Patch 1.13c introduced Akara Den of Evil respec `QUESTSTATEFLAG_A1Q1_RESPEC = 41` and Token of Absolution) | In 1.13c (`0x6FC548A0`), `nRespecQuestFilter` is ALREADY at `+0xE4`, shifting `pfStatusFilter` to `+0xE8`, `pfActiveFilter` to `+0xEC`, `pfSeqFilter` to `+0xF0`, and `pPrev` to `+0xF4`! Do NOT follow D2MOO's `>= 14` version guard. |
| **1.11–1.13c Balance & Bugfixes** | 1.10f Synergy / FE explosion / Mercenary aura / Oblivion Knight IM / Uber Pandemonium absent or pre-patch | 1.13c removes Iron Maiden from Act 4 Oblivion Knights, rescales Fire Enchanted death damage on Nightmare/Hell, adds Pandemonium/Token mechanics, and updates rune drop tables | Always treat 1.13c disassembly + 1.13c `Patch_D2.mpq` `.txt`/`.bin` tables as sole behavioral ground truth. |

---

## 2. Batch 1: Combat & Damage Pipeline (`SUnitDmg.cpp` $\leftrightarrow$ 1.13c `0x6FCFA660..0x6FCFF2B0`)

### Core Structs (`D2DamageStrc` = `0x70` bytes)
- `+0x00` `dwFlags` (`DAMAGEFLAG_*`): bit `0x01` = use `bSrcDam`, `0x20` = knockback, `0x80` = dodge/avoid, etc.
- `+0x04` `wResultFlags` (`RESULTFLAG_*`): `0x0001` hit, `0x0002` death, `0x0004` get-hit (`GH`), `0x0008` knockback, `0x0010` block, `0x0020` no-durability, `0x0100` dodge, `0x0200` avoid, `0x2000` weapon block, `0x4000` soft-death.
- `+0x08` `dwPhysDamage`, `+0x0C` `dwEnmgDamage`, `+0x10` `dwFireDamage`, `+0x14` `dwBurnDamage`, `+0x18` `dwBurnLen`, `+0x1C` `dwLtngDamage`, `+0x20` `dwMagDamage`, `+0x24` `dwColdDamage`, `+0x28` `dwPoisDamage`, `+0x2C` `dwPoisLen`, `+0x30` `dwColdLen`, `+0x34` `dwFrzLen`, `+0x38` `dwLifeLeech`, `+0x3C` `dwManaLeech`, `+0x40` `dwStamLeech`, `+0x44` `dwStunLen`, `+0x48` `dwAbsLife`, `+0x4C` `dwDmgTotal`, `+0x54` `dwPiercePct`, `+0x58` `dwDamageRate`, `+0x60` `dwHitClass`, `+0x64` `nHitClassActiveSet`, `+0x65` `nConvType`, `+0x68` `dwConvPct`, `+0x6C` `nOverlays`.

### Function Mapping (Batch 1 Combat Settlement Chain)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol (`SUnitDmg.h`) | Verified 1.13c Notes |
|---|---:|---|---|---|
| `0x6FCFD450` | `1,588B` | `SUNITDMG_FillDamageValues` | `SUNITDMG_FillDamageValues` | Computes weapon/monster base + mastery + `%ED` + elemental/poison/cold/freeze/leech/deadly-strike/crushing-blow into `D2DamageStrc`. Note: 1.13c player path initializes stack local leaving `dwBurnDamage` untouched unless burn stats exist. |
| `0x6FCFC0B0` | `1,152B` | `SUNITDMG_ApplyResistancesAndAbsorb` | `SUNITDMG_CalculateTotalDamage` / `SUNITDMG_ApplyResistancesAndAbsorb` | Iterates elemental/magic/physical channels (`0x6FCFBD00` channel helper), PvP/unit-type damage penalty (`0x6FCFA7A0`), resist pierce & caps (`[-100, maxResist]`), percent & flat absorb (`dwAbsLife`), and updates `dwDmgTotal`. |
| `0x6FCFE0C0` | `692B` | `SUNITDMG_ApplyDamage` | `SUNITDMG_ExecuteMissileDamage` / `SUNITDMG_ApplyDamage` | Custom 1.13c ABI (`eax = pDefender`, stack: `pGame, pAttacker, bApplyResists, pDamage`). Optionally runs `0x6FCFC0B0` when `bApplyResists != 0`, applies cold (`0x6FCFC780`), freeze (`0x6FCFDAC0`), poison (`0x6FCFCAB0`), burn (`0x6FCFC940`), stun (`0x6FCFCC20`), leech (`0x6FCFBA40`), subtracts HP (`STAT_HITPOINTS = 6`), and sets `RESULTFLAG_DEATH (0x02)` when HP reaches `0`. |
| `0x6FCFCF20` | `1,324B` | `SUNITDMG_ApplySideEffectsAndKill` | `SUNITDMG_ExecuteEvents` (post-damage tail) / `SUNITDMG_KillMonster` | Post-damage state transitions: triggers `MONMODE_GETHIT (3)` (`0x6FCFB910`), knockback, durability loss (`0x6FCFA660`), monster kill (`0x6FCFEEE0` $\to$ `MONSTER_StartDeath` `0x6FC96270`), experience (`0x6FCFFFD0` / `0x6FCFE380`), and S2C unit life/damage sync (`0x0C` / `0x0D`). |
| `0x6FCFBA40` | `690B` | `SUNITDMG_ApplyLifeManaSteal` | `SUNITDMG_AddLeechedLife` / `SUNITDMG_AddLeechedMana` (inlined caller) | Applies difficulty leech divisor (`DifficultyLevels.txt` LifeStealDivisor / ManaStealDivisor) + monster `Drain` effectiveness (`MonStats.txt` `Drain(N/Nm/H)`), adds HP/Mana/Stamina, and triggers `leech` overlay (`0x6FD82C10`). |
| `0x6FCFED30` | `632B` | `SUNITDMG_ExecuteEvents` | `SUNITDMG_ExecuteEvents` | Combat list (`D2CombatStrc`) melee/missile event dispatcher invoking attacker/defender melee events, `0x6FCFC0B0`, `0x6FCFE0C0`, and `0x6FCFCF20`. |
| `0x6FCFDE90` | `554B` | `SUNITDMG_GetResultFlags` | `SUNITDMG_GetResultFlags` | Rolls `IsHitSuccessful` (`0x6FCFDCA0`), `ApplyBlockOrDodge` (`0x6FCFB030`), weapon block, and sets `wResultFlags`. |
| `0x6FCFDDE0` | `172B` | `SUNITDMG_AllocCombat` | `SUNITDMG_AllocCombat` | Allocates `D2CombatStrc` node and prepends to `pAttacker` combat list. |

---

## 3. Batch 2: Monster AI & Mode Transitions (`AiThink.cpp`, `AiTactics.cpp`, `AiUtil.cpp`, `MonsterMode.cpp`)

### Function Mapping (Batch 2 Monster AI Chain)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol | Verified 1.13c Notes |
|---|---:|---|---|---|
| `0x6FCA3130` | `1,049B` | `AiFallen` | `AITHINK_Fn006_Fallen` (`AiThink.cpp`) | Index `6` in `gpMonsterAiFunctionTable` (`0x6FD2F9B8`). Checks popped `D2AiCmdStrc` (`0x6FC40EC0` flee trigger on ally death), shaman/boss rally, melee swing (`MONMODE_ATTACK1`/`ATTACK2`), approach (`0x6FD12540`), idle wander (`0x6FD11B10`), and stall (`0x6FD122C0`). |
| `0x6FCA38B0` | `619B` | `AiZombie` | `AITHINK_Fn001_Zombie` (`AiThink.cpp`) | Index `1` in `gpMonsterAiFunctionTable`. |
| `0x6FCBD3B0` | `351B` | `AI_RunMonsterAI` | `MONSTERAI_UpdateAiCallback` / `AIGENERAL_ExecuteAiFn` | Event `MON_EVENT_AI_THINK (2)` handler: validates mode/state and calls `0x6FCBD160` (`AI_DispatchTargetByAiFlag`). |
| `0x6FCBD160` | `583B` | `AI_DispatchTargetByAiFlag` | `AIUTIL_TargetDispatch` / `AITHINK_Execute` | Resolves `pAiGeneral` flags, invokes `0x6FD13220` (`AI_GeneralFindTargetOrThrottle`), computes melee range (`D2Common.#10399`), and calls `pAiGeneral->pfnThink` (`D2AiParamStrc` on stack). |
| `0x6FD13220` | `298B` | `AI_GeneralFindTargetOrThrottle` | `AITACTICS_IdleOrFindTarget` | Calls `0x6FCD1C90`; if no target within `aidist`, throttles via `AI_Stall` (`0x6FD122C0`). |
| `0x6FCD1C90` | `1,155B` | `AI_FindNearestPlayerOrAlly` | `AIUTIL_FindTarget` (`AiUtil.cpp`) | Walks active room + adjacent rooms (`0x6FCD1820` callback) to find closest valid hostile target, respecting alignment, untargetable states, and `aidist`. |
| `0x6FC95E10` | `560B` | `MONSTER_StartMode` | `D2GAME_MONSTERMODE_Change_6FC62E70` / `MONSTERMODE_EventHandler` | Central monster mode transition dispatcher via `monsterModeEventTable` (`0x6FD1A498`). |
| `0x6FC96270` | `768B` | `MONSTER_StartDeath` | `MONSTERMODE_StartDeath` (`MonsterMode.cpp`) | Mode `0` (`MONMODE_DEATH`) `pfnStart`: clears collision/events, inserts into room death ring (`D2Common.#10873` `0x6FD8AFD0`), broadcasts ally flee AI command (Fallen nearby flee!), runs boss/minion death hooks (`0x6FC955C0`), and rolls treasure-class item drops (`0x6FC95900` $\to$ `0x6FC31A70`). |
| `0x6FC96040` | `176B` | `MONSTER_EndDeath` | `MONSTERMODE_EndDeath` | Mode `0` `pfnEnd` (`20` frames later for Fallen): transitions unit `dwAnimMode` from `MONMODE_DEATH (0)` to `MONMODE_DEAD (12)` corpse state. |
| `0x6FC96BF0` | `809B` | `MONSTER_EndToAiOrNeutral` | `MONSTERMODE_EndToNeutralOrAi` | Mode `pfnEnd` for `GH`/`A1`/`A2`/`BL`/`SC`/`S1`/`WL`/`RN`: clears uninterruptible flag (`0x6FD02240`), transitions to `MONMODE_NEUTRAL (1)`, and schedules next `MON_EVENT_AI_THINK` tick (`aidel`). |
| `0x6FD12540` | `706B` | `AI_ApproachTarget` | `AITACTICS_WalkToTargetUnit` (`AiTactics.cpp`) | Pathfinds toward target unit and starts `MONMODE_WALK (2)` / `MONMODE_RUN (15)`. |
| `0x6FD12D80` | `664B` | `AI_FleeFrom` | `AITACTICS_WalkAwayFromUnit` (`AiTactics.cpp`) | Retreats away from threat source (`D2AiCmdStrc` cmd `2`). |
| `0x6FD11B10` | `460B` | `AI_IdleWander` | `AITACTICS_IdleWalk` (`AiTactics.cpp`) | Random short-step idle wander (`MONMODE_WALK`). |
| `0x6FD122C0` | `155B` | `AI_Stall` | `AITACTICS_Wait` (`AiTactics.cpp`) | Enters `MONMODE_NEUTRAL (1)` and schedules `MON_EVENT_AI_THINK` after `nDelay` frames. |

---

## 4. Batch 3: Room Presets, `MONREG` (`D2MonsterRegionStrc`), Inactive Unit Compression, & Monster Spawn Chain

### Core Structs (Disassembly-Verified against `0x6FCEAB30`, `0x6FC3F600`, `0x6FD0EF10`)
- **`D2MonsterRegionStrc`** (`sizeof = 0x2E4` bytes, verified at `0x6FCEABC0: mov edx, 0x2e4` / `rep stosd` `0xB9` dwords; stored at `pGame->pMonReg[1..nLevels-1]`, `+0xF0`):
  - `+0x00` `nAct` (`uint8_t`), `+0x04..+0x0F` room/spawn counters, `+0x10` `nMonCount`, `+0x11` `nTotalRarity`, `+0x12` `nSpawnCount`.
  - `+0x14` `pMonData[13]` (`13 * 0x34 = 0x2A4` bytes of `D2MonRegDataStrc`: `+0x00` `wMonHcIdx`, `+0x02` `nRarity`, `+0x03` `nComponentVariantsMax`, `+0x04` `nComponentVariants[3][16]`).
  - `+0x2B8` `dwMonDen`, `+0x2BC` `nBossMin`, `+0x2BD` `nBossMax`, `+0x2BE` `nMonWander`, `+0x2C0` `dwLevel`, `+0x2C8` `dwUniqueCount`, `+0x2CC` `dwMonSpawnCount`, `+0x2D0` `dwMonKillCount`, `+0x2D8` `nQuest`, `+0x2DC` `dwDungeonLevel`, `+0x2E0` `dwDungeonLevelEx`.
- **`D2MonsterSpawnParamsStrc`** (`sizeof = 0x26` bytes, stack-allocated in `0x6FD0F650` / `0x6FC561E0`):
  - `+0x00` `pGame`, `+0x04` `pRoom`, `+0x08` `pRoomCoordList`, `+0x0C` `nMonsterId`, `+0x10` `nAnimMode`, `+0x14` `nUnitGUID` (`0` = auto-allocate), `+0x18` `nX`, `+0x1C` `nY`, `+0x20` `nMaxSearchRings` (`-1` = exact subtile), `+0x24` `wFlags` (`int16_t`).
- **`D2InactiveMonsterNodeStrc`** (`sizeof = 0x5C` bytes, linked under `D2InactiveUnitListStrc` at `pGame->pInactiveUnitList[nAct]`, `+0xD8`):
  - `+0x00` `nX`, `+0x04` `nY`, `+0x08` `nClassId`, `+0x0C` `nUnitId`, `+0x10` `dwFlags`, `+0x14` `dwFlagsEx`, `+0x18` `dwTypeFlags`, `+0x1C` `dwOwnerGUID`, `+0x20` `pMinionList`, `+0x24` `pMapAI`, `+0x28` `nAiSpecialState`, `+0x2C` `nLevelId`, `+0x30` `wNameSeed`, `+0x32` `nMonUMods[9]`, `+0x3C` `wBossHcIdx`, `+0x40` `nExperience`, `+0x44` `nMaxHitpoints`, `+0x48` `nHitpoints`, `+0x4C` `nCmdParam1`, `+0x50` `nCmdParam2`, `+0x54` `nGameFrame`, `+0x58` `pNext`.

### Function Mapping (Batch 3 Room Presets, `MONREG`, & Monster Spawn)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol | Verified 1.13c ABI & Behavioral Notes |
|---|---:|---|---|---|
| `0x6FD01430` | `311B` | `ROOM_SpawnPresetUnits` | `D2GAME_PopulateRoom` / `SUNIT_SpawnPresetUnitsInRoom` | Iterates `D2PresetUnitStrc` chain (`pRoomEx + 0x5C`), skips entries with bit `1` set at `+0x1C`, dispatches `UNIT_MONSTER` (`0x6FC67CF0`), `UNIT_OBJECT` (`0x6FD013B0`), and `UNIT_TILE` warps. |
| `0x6FC67CF0` | `1,322B` | `ROOM_SpawnMonsterPreset` | `D2GAME_SpawnPresetMonster_6FC66560` (`MonsterRegion.cpp`) | Resolves preset monster ID / superunique (`SuperUniques.txt`), copies DRLG `pMapAI` (`+0x10` $\to$ `pAiGeneral + 0x38`), spawns town NPCs, superunique boss packs (`0x6FC451F0`), or normal preset monsters (`0x6FC66F70`). |
| `0x6FC4F0D0` | `545B` | `OBJECTS_PopulateRoom` | `OBJRGN_PopulateRoom` (`ObjRgn.cpp`) | Populates random shrines, chests, barrels (`0x6FC50800`), crates (`0x6FC50150`), and edge objects (`0x6FC4FA90`) per `Levels.txt` object density/groups. |
| `0x6FCEAB30` | `398B` | `MONREG_InitAllActMonsterRegions_6FCEAB30` | `MONSTERREGION_InitializeAll` (`MonsterRegion.cpp`) | Allocates `0x2E4`-byte `D2MonsterRegionStrc` per level (`1..nLevels-1`), rolls active monster species via `0x6FCEA760`, and builds component outfit variants (`0x6FCFF1A0`). |
| `0x6FCFF1A0` | `764B` | `MONREG_GenerateOutfitVariants` | `MONSTERREGION_InitializeAll` (component helper) | Pre-rolls up to 16 `MonStats2.txt` component variant combinations into `D2MonRegDataStrc::nComponentVariants[3][16]`. |
| `0x6FCEA5F0` | `256B` | `MONREG_GetOrCreateActOutfit` | `MONSTERREGION_GetMonsterComponentData` (`MonsterRegion.cpp`) | Looks up or dynamically registers `D2MonRegDataStrc` in `pMonReg[nLevelId]` for a spawned monster's visual equipment seed. |
| `0x6FC3F600` | `1,006B` | `MONSTER_SaveInactiveMonsterNode` | `SUNITINACTIVE_CompressInactiveUnit` (`SUnitInactive.cpp`) | Serializes an unloading room's live monster (coords, HP, UMods, boss/minion links, `pMapAI`, AI state) into a `0x5C`-byte `D2InactiveMonsterNodeStrc`. |
| `0x6FC3FB90` | `1,352B` | `MONREG_RestoreRoomMonstersFromNode` | `SUNITINACTIVE_RestoreInactiveUnits` (`SUnitInactive.cpp`) | Rehydrates saved `D2InactiveUnitListStrc` items, monsters, and objects when a room re-enters the active client neighborhood (`0x6FC3E960` / `0x6FC3EA40`). |
| `0x6FD0EF10` | `1,322B` | `MONSTER_Create` | `D2GAME_SpawnNormalMonster_6FC68E30` (`MonsterSpawn.cpp`) | Core server monster constructor (`D2MonsterSpawnParamsStrc*`): searches free subtile rings, allocates `D2UnitStrc`, initializes base stats from `MonStats.txt` + `MonLvl.txt`, equips `MonEquip.txt` (`0x6FCCFCE0`), and registers in `MONREG` (`0x6FCEA5B0`). |
| `0x6FD0F650` | `84B` | `MONSTER_SpawnAtCoords` | `D2GAME_SpawnMonster_6FC69F10` (`MonsterSpawn.cpp`) | Builds a `D2MonsterSpawnParamsStrc` frame on stack and tail-calls `0x6FD0EF10` (`MONSTER_Create`). |
| `0x6FD0E480` | `609B` | `MONSTER_SpawnPartyMinions` | `MONSTERSPAWN_SpawnMinionParty` (`MonsterSpawn.cpp`) | Spawns minion pack around leader using `MonStats.txt` `PartyMin`/`PartyMax` and links `D2MinionListStrc` (`0x6FD0DDB0`). |
| `0x6FC451F0` | `1,396B` | `MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0` | `MONSTERUNIQUE_SpawnSuperUnique` (`MonsterUnique.cpp`) | Spawns `SuperUniques.txt` boss, applies fixed + random `MonUMod` modifiers (`0x6FC43CA0`), and spawns champion/minion retinue (`wMonUModStrTable[22] == 0` `questcomplete` skipped). |

---

## 5. Batch 4: Item Stat Callbacks, Equipment Refresh, & S2C Unit/State Bitstream Sync

### Core Structs & Wire Protocols
- **`D2EquipmentRefreshStateStrc`** (`0x1C` bytes on stack during `0x6FCF51A0`): snapshots `(HP, Mana, Stamina, nRightSkillId, nLeftSkillId, nRightSkillOwnerGUID, nLeftSkillOwnerGUID)` before tearing down equipped item statlists and clamps/restores vitals + oskill/charged selections afterward.
- **Unit State Bitstream (`0x6FC9A5E0` / `0x6FC9A940`)**: packs `D2StatListExStrc` `gfFlags` / state array bits and per-state stat triplets via `Fog.#10126..#10130` (`D2BitBufferStrc`) into S2C `0xA7` (delayed state), `0xA8` (set state + bitstream), `0xA9` (clear state), and `0xAA` (full unit state sync).

### Function Mapping (Batch 4 Item Stat & S2C Sync)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol | Verified 1.13c ABI & Behavioral Notes |
|---|---:|---|---|---|
| `0x6FCF9470` | `1,676B` | `D2GAME_ITEMSTAT_OnStatChangedCallback` | `D2GAME_ITEMMODE_ServerStatlistCallback_6FC41910` (`ItemMode.cpp`) | Registered as server `pfOnValueChanged` on player/monster extended statlists. Reacts to `STAT_LEVEL (12)`, velocity/attack-rate shifts, skill/aura/pet-count stats (`0x6FCB6FA0`), and queues client stat sync updates. |
| `0x6FCF51A0` | `959B` | `D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats` | `D2GAME_ITEMS_UpdateInventoryItems_6FC44A90` (`ItemMode.cpp`) | Full equipment & charm stat pass: deactivates broken/unmet-requirement items (`0x6FCF46B0`), activates valid equipped + inventory charm statlists (`0x6FCF47C0`), refreshes set bonuses, and re-validates active skills. |
| `0x6FCF4FF0` | `80B` | `ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0` | `ITEMMODE_OnEquipItemUpdate` (`ItemMode.cpp`) | Triggered when inserting/equipping an item into `D2InventoryStrc`: activates equipped stats (`0x6FCF47C0`) and marks unit inventory update flags. |
| `0x6FC9B0A0` | `1,042B` | `UNIT_SendFullUnitSyncToClient` | `SUNITMSG_SendUnitToClient` (`SUnitMsg.cpp`) | Sends full S2C spawn/appearance packet for entering/nearby units: `0x59` (`UNIT_PLAYER`), `0xAC` (`UNIT_MONSTER` + `MONREG` component bitstream + UMods), `0x51` (`UNIT_OBJECT`), plus active states (`0x6FC9A940`). |
| `0x6FC9A5E0` | `853B` | `UNIT_SendGfxStatesBitstreamToClient` | `D2GAME_STATES_SendUnitStates_6FCC58E0` (`SUnitMsg.cpp`) | Encodes dirty Gfx state changes (`STATES_CheckStateMaskGfx`) into S2C `0xA8` / `0xA9` packets for a target `D2ClientStrc`. |
| `0x6FC9A940` | `783B` | `UNIT_SendAllStatesBitstreamToClient` | `D2GAME_STATES_SendUnitStateUpdates_6FCC5BE0` (`SUnitMsg.cpp`) | Encodes all active states on `pUnit` into S2C `0xAA` bitstream packet on room entry / unit sync. |
| `0x6FCAB0F0` | `242B` | `NET_SendPacket9D_ItemActionOwned_6FCAB0F0` | `D2GAME_SendPacket0x9D_6FC3E6F0` (`SCmd.cpp`) | Serializes owned/equipped/merc/belt item bitstream via `D2Common.ITEMS_SerializeItemToBitstream` into S2C `0x9D` (`compactItem == 1` zeros `magicPrefixId`/`magicSuffixId`). |
| `0x6FCAB010` | `222B` | `NET_SendPacket0x3E_ItemStatBitStream113c_6FCAB010` | `SCMD_SendPacket0x3E_ItemStats` (`SCmd.cpp`) | Packs single/multi item stat delta bitstream into S2C `0x3E`. |
| `0x6FCABC20` | `223B` | `NET_SendPacket9E9FA0_StatValue_6FCABC20` | `D2GAME_PACKETS_SendPacket0x9E_9F_A0_6FC3D520` | Selects 1-byte (`0x9E`), 2-byte (`0x9F`), or 4-byte (`0xA0`) merc/unit stat value packet by magnitude. |
| `0x6FCABB10` | `258B` | `NET_SendPacketA0A1A2_StatDelta_6FCABB10` | `D2GAME_PACKETS_SendPacket0xA0_A1_A2_6FC3D610` | Selects player `STAT_*` delta/value S2C `0xA0`/`0xA1`/`0xA2` packet. |
| `0x6FCABDA0` | `101B` | `NET_SendPacket1A1B1C_StatUpdate_6FCABDA0` | `D2GAME_PACKETS_SendPacket0x1A_B_C_6FC3D410` | Emits S2C `0x1A` (u8), `0x1B` (u16), or `0x1C` (u32) experience delta packet. |
| `0x6FCABE10` | `151B` | `NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10` | `D2GAME_PACKETS_SendPacket0x19_6FC3D3D0` / `0x1D..0x1F` | Emits S2C `0x19` (small gold byte delta) or `0x1D`/`0x1E`/`0x1F` (`STAT_GOLD = 14` update). |
| `0x6FCAB7F0` | `194B` | `NET_SendPacket95_LifeManaStamina_6FCAB7F0` | `SCMD_SendVitals` (`SCmd.cpp`) | Packs 15-bit HP, 15-bit Mana, 15-bit Stamina, and subtile coords/offsets into 13-byte S2C `0x95` bitstream. |
| `0x6FCAB8C0` | `227B` | `NET_SendPacket18_HpManaPot_6FCAB8C0` | `SCMD_SendVitalsAndPotionPrediction` (`SCmd.cpp`) | Packs HP/Mana/Stamina + 7-bit potion life/mana regen prediction + coords into 15-byte S2C `0x18` bitstream. |
| `0x6FCAB750` | `158B` | `NET_SendPacket96_WalkVerify_6FCAB750` | `D2GAME_PACKETS_SendPacket0x96_WalkVerify_6FC3DA90` | Packs 15-bit stamina + 15-bit `(X, Y)` + target velocity offsets into 9-byte S2C `0x96` walk-verify packet. |
| `0x6FCAD860` / `0x6FCAD990` | `297B` / `354B` | `NET_SendPacketMonsterMoveCoord_6FCAD860` / `TargetUnit_6FCAD990` | `D2GAME_PACKETS_SendPacket0x67` / `0x68` (`SCmd.cpp`) | Monster move-to-coord (`0x67`) and move-to-unit (`0x68`) S2C broadcasters. |

---

## 6. Batch 5: Game Frame Loop (`Game.cpp`), Event Timer Wheel (`Event.cpp`), C2S Dispatch, & Player Mode/Regen

### Core Structs & Disassembly-Verified Invariants
- **`D2EventTimerQueueStrc`** (`sizeof = 0xA20` bytes at `pGame->pTimerQueue`, `+0xB8`; `D2EventTimerStrc` = `0x28` bytes in 600-slot slabs `0x6FCAE420`):
  - `+0x000` `nArrayIndex` (`dwGameFrame & 0x3F` modulo-64 wheel cursor).
  - `+0x004` `pHead[5][64]` (`5 * 0x100 = 0x500` bytes), `+0x504` `pTail[5][64]` (`0x500` bytes), `+0xA04` `pInfinite[5]` (`0x14` bytes), `+0xA18` `pNextTimerToExecute`, `+0xA1C` `pSlabListHead`.
  - **CRITICAL 1.13c Wheel Row Remap (`0x6FCAF070`)**: Row index `0..4` is NOT `D2C_UnitTypes`! Row `0` = `UNIT_OBJECT (2)`, Row `1` = `UNIT_MONSTER (1)`, Row `2` = `UNIT_PLAYER (0)`, Row `3` = `UNIT_ITEM (4)`, Row `4` = `UNIT_MISSILE (3)`. Every tick, `EVENT_UpdateTimers` (`0x6FCAF070`) drains rows in exact order **`[2, 0, 1, 3, 4]`** = **Player $\to$ Object $\to$ Monster $\to$ Item $\to$ Missile** (for each row: `pInfinite[row]` with `bTimedEvents = 0`, then `pHead[row][nArrayIndex]` with `bTimedEvents = 1`).
- **`c2sPacketTable` (`0x6FD1A078`)**: `0x67` (`103`) 8-byte descriptors `{ pfnHandler, nFlags }` indexed by C2S opcode `0x00..0x66` in `0x6FCEC550` (`C2S_Dispatch`).

### Function Mapping (Batch 5 Frame Loop, Timer Wheel, C2S, & Player Tick)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol | Verified 1.13c ABI & Execution Order |
|---|---:|---|---|---|
| `0x6FC4E050` | `269B` | `GAME_UpdateProgress` (`D2Game.#10008` inner tick) | `GAME_UpdateProgress` (`Game.cpp`) | `eax = pGame`. Increments `pGame->dwGameFrame` (`+0xA8`), then executes: (1) `0x6FC4CA20` (`GAME_StepActEnvironmentCycles`), (2) `0x6FC49BE0` (arena/party sync), (3) `0x6FC4CBE0` (drain queued C2S packets), (4) `0x6FCAF070` (`EVENT_UpdateTimers`), (5) `0x6FC4D9B0` (`GAME_StepClientJoinStatesAndTimeouts`), (6) `0x6FCBD850` / `0x6FCBD5B0` (active room unit/AI neighborhood sweep), (7) `dwGameFrame % 20 == 0` $\to$ `0x6FC53B70` (quest timers), `dwGameFrame % 12 == 0` $\to$ `0x6FC4CF30` (client life/coord sync), `dwGameFrame % 11 == 0` $\to$ `DUNGEON_UpdateRoomActivity` across `pAct[0..4]`, and `0x6FC4C0F0` (flush S2C client buffers). |
| `0x6FCAF070` | `202B` | `EVENT_UpdateTimers` | `EVENT_IterateEvents` (`Event.cpp`) | `esi = pGame`. Sets `pTimerQueue->nArrayIndex = dwGameFrame & 0x3F`, then dispatches `0x6FCAE9A0` (Players), `0x6FCAECC0` (Objects), `0x6FCAEBC0` (Monsters), `0x6FCAEF20` (Items), and `0x6FCAEDD0` (Missiles). |
| `0x6FCAEA80` | `280B` | `EVENT_SetEvent` | `EVENT_ScheduleTimer` (`Event.cpp`) | Allocates `D2EventTimerStrc` (`0x6FCAE680` / `0x6FCAE540`) and links into `pHead[(unitType remap)][expireFrame & 0x3F]` + `pUnit` timer chain. |
| `0x6FCAE630` | `79B` | `EVENT_InitTimerQueue` | `EVENT_AllocEventQueue` (`Event.cpp`) | Allocates `0xA20`-byte `D2EventTimerQueueStrc` and initial 600-timer slab (`0x6FCAE420`). |
| `0x6FCEC550` | `298B` | `C2S_Dispatch` | `D2GAME_PACKET_Handler` (`Packet.cpp`) | `ebx = pPacket`, `esi = pPlayer`, stack `(pGame, nPacketLen)` (`ret 8`). Validates opcode `< 0x67`, checks dead/stunned/town action restrictions (`0x6FCEC67C` jump table), and invokes `c2sPacketTable[opcode]` (`0x6FD1A078`). |
| `0x6FCEE0D0` / `0x6FCEE040` | `68B` / `68B` | `C2S_Packet01_WalkToLocation` / `03_RunToLocation` | `PACKET_Clt01_WalkToXY` / `03_RunToXY` | Initiates `PLRMODE_WALK (2)` / `PLRMODE_RUN (3)` toward `(wX, wY)`. |
| `0x6FCEE520` / `0x6FCEE870` | `116B` / `118B` | `C2S_Packet0C_RightSkillOnLocation` / `0D_OnUnit` | `PACKET_Clt0C` / `0D` | Assigns active right-hand skill target and invokes `SKILLS_StartUsedSkill` (`0x6FCC0830`). |
| `0x6FCF0910` | `64B` | `D2Game_6FCF0910_113c` (C2S `0x13` Interact) | `PACKET_Clt13_UnitInteract` | Validates unit interaction packet and calls `0x6FCF01D0` (`C2S_ExecuteEntityInteractionOrRunToTarget`). |
| `0x6FC99B90` | `629B` | `PLAYER_StepModeWalkOrRun` | `PLRMODE_UpdateMovement` (`PlrModes.cpp`) | `EVENTTYPE_MODECHANGE (0)` handler for player walk/run: steps `D2DynamicPathStrc`, drains run stamina (`0x6FC97BB0`), triggers queued entity interaction upon arrival, or ends movement. |
| `0x6FC97CB0` / `0x6FC97950` / `0x6FC97A50` | `223B` / `254B` / `180B` | `PLAYER_UpdateHpRegen` / `ManaRegen` / `StaminaRegen` | `D2GAME_EVENTS_StatRegen_6FC80F80` helpers (`PlayerStats` / `PlrModes`) | Per-tick `EVENTTYPE_STATREGEN (3)` vital regeneration handlers for HP (`STAT_HPREGEN`), Mana (`STAT_MANARECOVERY`), and Stamina (standing/walking recovery). |

---

## 7. K3: Skills, Auras, Summons/Pets, Curses, Timed States, & Mercenaries (`Skills.cpp`, `PlayerPets.cpp`, `SUnitNpc.cpp`)

### Disassembly-Verified Skill & Pet Dispatch Tables
- **`gpSkillSrvStFnTable` (`0x6FD27338`, `92` entries)**: indexed by `D2SkillsTxt::wSrvStFunc` (`+0x06`) inside `0x6FCBFD00` (called by `0x6FCC0830` `SKILLS_StartUsedSkill`). Signature: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel) -> int32_t`.
- **`gpSkillSrvDoFnTable` (`0x6FD274A8`, `152+` entries)**: indexed by `D2SkillsTxt::wSrvDoFunc` (`+0x08`) or progressive charge `wSrvPrgFunc1..3` (`+0x168..+0x16C`) inside `0x6FCC19A0` (called by `0x6FCC2060` `SKILLS_DoUsedSkillAction` on anim action frame or cast completion).
- **Player Pet Table (`pPlayerData + 0x44`)**: points to `D2PlayerPetStrc` containing `PetType.txt`-indexed buckets (`nPetType = 1..19`, e.g., `3 = Golem`, `4 = Skeleton`, `5 = SkeletonMage`, `6 = Revive`, `7 = Hireable` mercenary, `11 = SpiritWolf`, `15 = Grizzly`, `16 = ShadowWarrior`, `17 = AssassinTrap`, `19 = Hydra`).

### Function Mapping (K3 Skills, States, Summons, & Mercenaries)

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol | Verified 1.13c Notes |
|---|---:|---|---|---|
| `0x6FCC0830` | `364B` | `SKILLS_StartUsedSkill113c` | `SKILLS_StartSkill` (`Skills.cpp`) | Validates skill usability, range, town flags, cooldown (`EVENTTYPE_REMOVESKILLCOOLDOWN = 14`), invokes `gpSkillSrvStFnTable[wSrvStFunc]` (`0x6FCBFD00`), and starts cast/attack anim mode (`0x6FCC1630`). |
| `0x6FCC2060` | `83B` | `SKILLS_DoUsedSkillAction113c` | `SKILLS_DoSkill` (`Skills.cpp`) | Resolves `pUnit` active `D2SkillStrc`, executes `0x6FCC19A0` (`gpSkillSrvDoFnTable` + mana consumption + missile spawn), and schedules periodic aura/channel events (`0x6FCBF3B0`). |
| `0x6FCC00B0` | `695B` | `STATES_CreateOrUpdateAuraStatList` | `SKILLS_ApplyAuraStatList` (`Skills.cpp`) | Creates or updates timed/aura `D2StatListStrc` (`STATLIST_AllocStatListEx`), evaluates `aurastat1..6` calcs, toggles target `nAuraTargetState`, and attaches state-removal callback (`0x6FCBF7A0`). |
| `0x6FC49240` | `359B` | `SKILLS_ApplyTimedSkillAuraToTarget_6FC49240` | `SKILLS_ApplyTimedState` (`Skills.cpp`) | Applies timed buff/debuff aura statlists (Battle Orders, Shout, Battle Command, Enchant, Shrine buffs) and schedules `EVENTTYPE_REMOVESTATE (12)`. |
| `0x6FC70250` | `531B` | `SKILLS_ApplyCurseStateAndStatsCallback_6FC70250` | `SKILLS_CurseAreaCallback` (`SkillNec.cpp`) | Clears mutually exclusive curse states (`0x6FCB0F30`), respects boss/attract/confuse immunity, applies curse statlist (`Amplify Damage`, `Decrepify`, `Lower Resist`, `Life Tap`), and sets monster AI special state (`0x6FC700A0`). |
| `0x6FCB0F30` | `262B` | `STATES_ClearCurseStatesOnUnit113c_6FCB0F30` | `STATES_RemoveCurses` | Clears existing curse state statlists before applying a new curse or cleansing shrine/well (`0x6FC89DE0`). |
| `0x6FCB5D50` | `641B` | `SKILLS_SummonMonsterFromSkillOrMissile_6FCB5D50` | `D2GAME_SummonPet_6FD14430` (`Skills.cpp`) | Spawns player summon (`D2SummonArgStrc`), links owner GUID, registers in `D2PlayerPetStrc`, and enforces `PetType.txt` group/count caps (`0x6FCB7C20`, `0x6FCB7F50`). |
| `0x6FCB6FA0` | `374B` | `PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0` | `PLAYERPETS_UpdatePetLimits` (`PlayerPets.cpp`) | Recomputes max summon counts across all `PetType.txt` slots when `+skills` equipment changes (`0x6FCF9470`) and unsummons excess pets (`0x6FCB6EA0`). |
| `0x6FC68FC0` | `585B` | `HIRELING_AssignMercenaryToPlayer_6FC68FC0` | `D2GAME_MERCS_Create_6FCC8630` (`SUnitNpc.cpp`) | Creates Act 1/2/3/5 hireling `UNIT_MONSTER`, binds `PETTYPE_HIREABLE (7)` slot (`0x6FCB7A20`), initializes `Hireling.txt` stats/skills, and broadcasts S2C `0x81` (`0x6FCB66E0`). |
| `0x6FCFDCB0` | `301B` | `HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0` | `SUNITDMG_AddMercExperience` (`SUnitDmg.cpp`) | Awards party/owner kill XP to active hireling, checks level-up threshold, and triggers `0x6FC68BA0` (`HIRELING_LevelUpHirelingAndSyncSkills`) + S2C `0x9E..0xA0` (`0x6FC68950`). |

---

## 8. K4: Act 1–5 Quest Descriptors (`D2QuestDataStrc`), Town NPC Interaction, & Quest Callback Matrix

### Disassembly-Verified 1.13c Quest & Interaction Struct Layouts
1. **`D2QuestDataStrc` (`sizeof = 0xF8` bytes in v1.13c — NOT 1.10f `0xF4`!)**:
   - `+0x00` `nQuestNo` (`int32_t`, internal quest index `0..36` in `gpQuestInitTable` `0x6FD2DBF0` [`count = 37` at `0x6FD2DF68`], plus `4` town intro descriptors in `gpQuestIntroTable` `0x6FD2DF6C`).
   - `+0x04` `pGame` (`D2GameStrc*`).
   - `+0x08` `nActNo` (`uint8_t`, `0..4`), `+0x09` `bNotIntro` (`uint8_t`, cleared to `0` by `0x6FC54440` when quest was completed in a prior game), `+0x0A` `bActive` (`uint8_t`, `1` when callback filter active), `+0x0B` `fLastState` (`uint8_t`, main quest log state), `+0x0C` `fState` (`uint8_t`, internal sequence substate), `+0x0D` `nInitNo` (`uint8_t`).
   - `+0x10` `dwFlags` (`uint32_t`), `+0x14` `nType` (`int32_t`), **`+0x18` `pQuestDataEx` (`void*` Act/Quest-specific state struct allocated via `Fog.#10045`)**.
   - `+0x1C` `tPlayerGUIDs` (`D2QuestGUIDStrc`: `uint32_t dwPlayerGUID[32]` at `+0x1C..+0x9B`, `uint16_t nPlayerCount` at `+0x9C`).
   - `+0xA0..+0xDB` `pfCallback[15]` (`void (__fastcall *)(D2QuestDataStrc* pQuest, D2QuestArgStrc* pQuestArg)`):
     * `[0x00]` `+0xA0` `QUESTEVENT_NPCACTIVATE` (invoked by `0x6FC54660` on C2S `0x2F`)
     * `[0x01]` `+0xA4` `QUESTEVENT_ITMPICKEDUP` (`0x6FC54510`)
     * `[0x02]` `+0xA8` `QUESTEVENT_NPCDEACTIVATE` (invoked by `0x6FC685C0` on C2S `0x30`)
     * `[0x03]` `+0xAC` `QUESTEVENT_CHANGEDLEVEL` (`0x6FC54860`)
     * `[0x04]` `+0xB0` `QUESTEVENT_ITEMDROPPED` (`0x6FC545A0`)
     * `[0x08]` `+0xC0` `QUESTEVENT_MONSTERKILLED`
     * `[0x0B]` `+0xCC` `QUESTEVENT_SCROLLMESSAGE` (invoked by `0x6FC55C90` on C2S `0x31`)
     * `[0x0D]` `+0xD4` `QUESTEVENT_PLAYERSTARTEDGAME` (invoked unconditionally on all quests by `0x6FC55090` `QUESTS_SequenceCycler`)
     * `[0x0E]` `+0xD8` `QUESTEVENT_PLAYERJOINEDGAME` (`0x6FC55395`)
   - `+0xDC` `pNPCMessages` (`D2NPCMessageListStrc*`), `+0xE0` `nQuestFilter` (`int32_t`, bitfield quest ID `0..40` in `D2BitBufferStrc`), **`+0xE4` `nRespecQuestFilter` (`int32_t`, `41` for `ACT1Q1`, `0` otherwise — present in 1.13c!)**, `+0xE8` `pfStatusFilter`, **`+0xEC` `pfActiveFilter` (NPC overhead `!` quest-alert check called by `0x6FC54EA0`)**, **`+0xF0` `pfSeqFilter`**, **`+0xF4` `pPrev` (`D2QuestDataStrc*`)**.
2. **`D2UnitStrc` Player $\leftrightarrow$ Town NPC Interaction Fields (verified at `0x6FCFFAE0` `SUNIT_SetInteractInfo`, `0x6FC687A0`, `0x6FC685C0`)**:
   - **`+0x64` `dwInteractUnitGUID`**: `uint32_t` GUID of NPC/object currently interacted with (`0xFFFFFFFF` when none).
   - **`+0x68` `nInteractUnitType`**: `uint32_t` `D2C_UnitTypes` (`1` = `UNIT_MONSTER` for town NPCs, `2` = `UNIT_OBJECT`, `6` when none).
   - **`+0x6C` `bInteracting`**: `uint8_t` (`1` while active NPC session open, `0` after C2S `0x30` cancel).
   - Town NPC `D2MonsterDataStrc + 0x30` (`pNpcInteract`) holds the server-side `D2InteractList` tracking interacting player GUIDs (`0x6FC687A0` / `0x6FC68300`) so `AI_TownNpc` (`0x6FC3DB40` / `0x6FC3BC60` / `0x6FCBCB00`) halts pathing while a player talks or trades.

### Core Quest Framework & Town NPC C2S Mapping

| 1.13c `D2Game` VA | Size | Manifest Symbol | D2MOO 1.10f Symbol (`Quests.h` / `SUnitNpc.h`) | Verified 1.13c Notes |
|---|---:|---|---|---|
| `0x6FC548A0` | `506B` | `QUESTS_AllocAndInitGameQuests_6FC548A0` | `QUESTS_QuestInit` (`Quests.cpp`) | Allocates `D2QuestInfoStrc` (`0x24` bytes at `pGame + 0x10F4`), global `D2BitBufferStrc`, and all `37 + 4 = 41` `0xF8`-byte `D2QuestDataStrc` nodes from `0x6FD2DBF0` & `0x6FD2DF6C`. |
| `0x6FC53CE0` | `172B` | `QUESTS_TriggerCallback` | `QUESTS_TriggerCallback` (`Quests.cpp`) | `edi = pQuestArg`, stack `(bCheckActive, bFilterAct)` (`ret 8`). Walks `pQuestControl->pLastQuest` via `+0xF4` (`pPrev`), optionally filtering by `bActive (+0x0A)` and player's current Act (`+0x08`), and invokes `pfCallback[cbIdx]`. |
| `0x6FC54EA0` | `399B` | `QUESTS_CheckNpcQuestInteractAlert` | `QUESTS_ActiveCycler` (`Quests.cpp`) | Invokes `pQuest->pfActiveFilter` (`+0xEC`) across active Act quests on C2S `0x13` NPC approach to emit S2C `0x5D` quest-alert indicators (`0x6FC54AA0`). |
| `0x6FC576F0` / `0x6FC89360` | `57B` / `179B` | `PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0` / `QUESTS_AllocBitBufferPair_6FC89360` | `PLRINTRO_Create` (`PlrIntro.cpp`) | Allocates the 3 per-difficulty `(pNpcIntroBits, pQuestIntroBits)` 64-bit `D2BitBufferStrc` pairs at `pPlayerData + 0x60..+0x68` (serialized in `.d2s` `w4` section; queried via `0x6FC89590` / set via `0x6FC895F0`). |
| `0x6FCF01D0` | `943B` | `C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0` | `PACKET_Clt13_InteractWithUnit` | Server entity-interact engine: verifies distance/LOS, records `dwInteractUnitGUID (+0x64)` & `nInteractUnitType (+0x68)`, halts NPC AI (`0x6FC687A0`), and triggers `0x6FC54EA0`. |
| `0x6FCEE440` | `102B` | `C2S_PacketTriggerMonsterSpawnNode_6FCEE440` | `PACKET_Clt2F_NpcInit` | C2S `0x2F` handler: validates active NPC interaction and invokes `0x6FC54660` (`cbIdx = 0x00` `QUESTEVENT_NPCACTIVATE`). |
| `0x6FCEC9D0` | `47B` | `PACKET_Srv2F_NpcQuestMessage_6FCEC9D0` | `PACKET_Clt31_QuestMessage` | C2S `0x31` handler: invokes `0x6FC55C90` (`cbIdx = 0x0B` `QUESTEVENT_SCROLLMESSAGE`) when NPC speech scroll completes, awarding quest items/skills/portals/states. |
| `0x6FCED480` | `107B` | `C2S_Packet30_CancelNpcInteract_6FCED480` | `PACKET_Clt30_NpcCancel` | C2S `0x30` handler: invokes `0x6FC685C0` (closes vendor/gamble + triggers `cbIdx = 0x02` `QUESTEVENT_NPCDEACTIVATE`) and resets `dwInteractUnitGUID = -1`, `nInteractUnitType = 6`, `bInteracting = 0`. |

### Complete Act 1–5 Quest Descriptor 1.13c VA Matrix (`0x6FD2DBF0` + `0x6FD2DF6C`)

| Act / Quest | `nQuestNo` (`nFilter`) | `pfnInit` | `pfActiveFilter` (`+0xEC`) | `pfSeqFilter` (`+0xF0`) | `cb00` `NpcActivate` (`+0xA0`) | `cb02` `NpcDeactivate` (`+0xA8`) | `cb0B` `ScrollMessage` (`+0xCC`) | `cb0D` `PlayerStarted` (`+0xD4`) |
|---|---:|---|---|---|---|---|---|---|
| **A1 Intro (Gheed/Charsi/Kashya/Warriv)** | Intro | `0x6FC83CC0` | `0x6FC82DF0` | — | `0x6FC82E50` | — | `0x6FC82F00` | — |
| **A1 Cain Intro** | Intro | `0x6FC82FA0` | — | — | `0x6FC824D0` | — | — | — |
| **A1Q0 Warriv Intro** | `0` (`0`) | `0x6FC82D90` | `0x6FC823F0` | — | `0x6FC82410` | — | `0x6FC82490` | — |
| **A1Q1 Den of Evil** (`+0xE4 = 41` Respec) | `1` (`1`) | `0x6FC85990` | `0x6FC80940` | `0x6FC82DF0` | `0x6FC82220` | `0x6FC83C40` | `0x6FC85260` | `0x6FC820E0` |
| **A1Q2 Sisters' Burial Grounds** | `2` (`2`) | `0x6FC89130` | `0x6FC80820` | `0x6FC81DB0` | `0x6FC81F50` | `0x6FC83AD0` | `0x6FC88920` | `0x6FC81E30` |
| **A1Q3 Tools of the Trade (Malus)** | `3` (`3`) | `0x6FC87210` | `0x6FC807D0` | `0x6FC81B70` | `0x6FC81C60` | `0x6FC83870` | `0x6FC87000` | `0x6FC81A80` |
| **A1Q4 Search for Cain** | `4` (`4`) | `0x6FC887D0` | `0x6FC80F20` | `0x6FC81750` | `0x6FC86960` | `0x6FC835D0` | `0x6FC86CE0` | `0x6FC81540` |
| **A1Q5 Forgotten Tower (Countess)** | `5` (`5`) | `0x6FC89200` | `0x6FC80750` | `0x6FC80EC0` | `0x6FC81030` | — | `0x6FC84430` | `0x6FC80E00` |
| **A1Q6 Sisters to the Slaughter** | `6` (`6`) | `0x6FC88060` | `0x6FC80660` | `0x6FC809E0` | `0x6FC80A80` | `0x6FC83190` | `0x6FC83F90` | `0x6FC808B0` |
| **A2 Town Intro** | Intro | `0x6FCE5730` | — | — | `0x6FCE4690` | — | `0x6FCE4780` | — |
| **A2Q0 Jerhyn / Warriv Intro** | `7` (`8`) | `0x6FCE5690` | `0x6FCE2590` | — | `0x6FCE4570` | — | `0x6FCE4620` | `0x6FCE44E0` |
| **A2Q1 Radament's Lair** | `8` (`9`) | `0x6FCE7B40` | `0x6FCE2520` | `0x6FCE3260` | `0x6FCE4320` | `0x6FCE61C0` | `0x6FCE6E90` | `0x6FCE41D0` |
| **A2Q2 Horadric Staff** | `9` (`10`) | `0x6FCE7ED0` | `0x6FCE5440` | `0x6FCE4030` | `0x6FCE5310` | — | `0x6FCE7DC0` | `0x6FCE3A80` |
| **A2Q3 Tainted Sun** | `10` (`11`) | `0x6FCE7480` | `0x6FCE2250` | `0x6FCE3710` | `0x6FCE37F0` | — | `0x6FCE6B30` | `0x6FCE72C0` |
| **A2Q4 Arcane Sanctuary** | `11` (`12`) | `0x6FCE9400` | `0x6FCE2080` | `0x6FCE34E0` | `0x6FCE4EA0` | `0x6FCE5DB0` | `0x6FCE85A0` | `0x6FCE3320` |
| **A2Q5 The Summoner** | `12` (`13`) | `0x6FCE7080` | `0x6FCE1E10` | `0x6FCE2E30` | `0x6FCE3080` | — | `0x6FCE67C0` | `0x6FCE2DC0` |
| **A2Q6 The Seven Tombs (Duriel)** | `13` (`14`) | `0x6FCE9F60` | `0x6FCE1C20` | `0x6FCE8990` | `0x6FCE2B00` | `0x6FCE5A60` | `0x6FCE8050` | `0x6FCE2900` |
| **A2Q7 Palace Guard Gate** | `14` (`31`) | `0x6FCE5790` | `0x6FCE2750` | — | `0x6FCE4900` | — | `0x6FCE4A40` | — |
| **A2Q8 Horazon / Palace Cellar** | `15` (`32`) | `0x6FCE4880` | `0x6FCE25F0` | — | `0x6FCE2680` | — | `0x6FCE2720` | — |
| **A3 Kurast Town Intro** | Intro | `0x6FD06700` | `0x6FD055C0` | — | `0x6FD055F0` | — | `0x6FD056E0` | — |
| **A3Q0 Hratli Dock Intro** | `16` (`16`) | `0x6FD06660` | `0x6FD03000` | — | `0x6FD054C0` | — | `0x6FD05540` | `0x6FD05450` |
| **A3Q1 Lam Esen's Tome** | `17` (`17`) | `0x6FD093C0` | `0x6FD053F0` | `0x6FD051B0` | `0x6FD05270` | — | `0x6FD08FE0` | `0x6FD050C0` |
| **A3Q2 Khalim's Will** | `18` (`18`) | `0x6FD07CE0` | `0x6FD04F60` | `0x6FD028A0` | `0x6FD04C90` | — | `0x6FD07940` | `0x6FD049E0` |
| **A3Q3 Blade of the Old Religion** | `19` (`19`) | `0x6FD09DC0` | `0x6FD04500` | `0x6FD02D40` | `0x6FD042F0` | `0x6FD06CF0` | `0x6FD09600` | `0x6FD06000` |
| **A3Q4 The Golden Bird** | `20` (`20`) | `0x6FD092D0` | `0x6FD04030` | `0x6FD03CA0` | `0x6FD03E30` | — | `0x6FD08B60` | `0x6FD03B40` |
| **A3Q5 The Blackened Temple** | `21` (`21`) | `0x6FD09200` | `0x6FD02AB0` | `0x6FD02B50` | `0x6FD03970` | — | `0x6FD089A0` | `0x6FD03850` |
| **A3Q6 The Guardian (Mephisto)** | `22` (`22`) | `0x6FD0A080` | `0x6FD028C0` | `0x6FD032B0` | `0x6FD033A0` | — | `0x6FD07080` | `0x6FD03120` |
| **A3 Dark Wanderer Prologue** | `23` (`34`) | `0x6FD05920` | `0x6FD028A0` | — | — | — | — | `0x6FD03050` |
| **A4 Tyrael Prologue** | `24` (`24`) | `0x6FCD9D80` | `0x6FCD8B50` | — | `0x6FCD9730` | — | `0x6FCD97A0` | — |
| **A4Q1 The Fallen Angel (Izual)** | `25` (`25`) | `0x6FCDAE40` | `0x6FCD8AE0` | `0x6FCD8A70` | `0x6FCD9560` | `0x6FCDA100` | `0x6FCDA5E0` | `0x6FCD9320` |
| **A4Q2 Terror's End (Diablo)** | `26` (`26`) | `0x6FCDC5F0` | `0x6FCD8970` | `0x6FCD9010` | `0x6FCD9070` | `0x6FCDB1B0` | `0x6FCDB250` | `0x6FCD8F20` |
| **A4Q3 Hell's Forge** | `27` (`27`) | `0x6FCDAD40` | `0x6FCD8810` | `0x6FCD8CA0` | `0x6FCD8CE0` | `0x6FCD9DE0` | `0x6FCDAA50` | `0x6FCD9830` |
| **A4 Hadriel Gate** | `28` (`33`) | `0x6FCD97D0` | `0x6FCD8B90` | — | `0x6FCD8C00` | — | — | — |
| **A5 Harrogath Town Intro** | `31` (`31`) | `0x6FC7A7C0` | `0x6FC79680` | `0x6FC7B0B0` | `0x6FC796B0` | — | `0x6FC797B0` | — |
| **A5Q1 Siege on Harrogath (Shenk)** | `35` (`35`) | `0x6FC7BEA0` | `0x6FC76D80` | `0x6FC78700` | `0x6FC787C0` | `0x6FC7A720` | `0x6FC7B4F0` | `0x6FC79450` |
| **A5Q2 Rescue on Mount Arreat** | `36` (`36`) | `0x6FC7CC70` | `0x6FC76C40` | `0x6FC78260` | `0x6FC783C0` | `0x6FC7A530` | `0x6FC7C9E0` | `0x6FC781A0` |
| **A5Q3 Prison of Ice (Anya)** | `37` (`37`) | `0x6FC7FC20` | `0x6FC77F50` | `0x6FC77FC0` | `0x6FC7DA70` | `0x6FC7A0A0` | `0x6FC7F5E0` | `0x6FC77E80` |
| **A5Q4 Betrayal of Harrogath** | `38` (`38`) | `0x6FC7D5C0` | `0x6FC76840` | `0x6FC779A0` | `0x6FC77A60` | `0x6FC7D520` | `0x6FC7B7A0` | `0x6FC7AE20` |
| **A5Q5 Rite of Passage (Ancients)** | `39` (`39`) | `0x6FC7FB50` | `0x6FC76810` | `0x6FC775E0` | `0x6FC775F0` | `0x6FC79BE0` | `0x6FC7F200` / `0x6FC77270` | `0x6FC77540` |
| **A5Q6 Eve of Destruction (Baal)** | `40` (`40`) | `0x6FC80080` | `0x6FC76EF0` | `0x6FC76FA0` | `0x6FC77000` | `0x6FC7D920` | — | `0x6FC78930` |

---

## 9. Static Call-Graph & Indirect-Dispatch Closure Summary (`4,810 / 4,810`)

| Closure Dimension | Authoritative v1.13c Binary Ground Truth (`manifest-113c.json`) | `src/d2kern-113c/` Status |
|---|---|---|
| **Reachable Static Closure** | `4,810` functions (`1,479` `D2Common.dll` + `3,331` `D2Game.dll`), `4,285` Tarjan SCCs across `37` topological levels `0..36`, `49` pruned host/CRT/Realm targets | **`4,810 / 4,810` (`100.00%` `diff-verified`)**, `0` `ported`, `0` `unported`, `0` legacy imports |
| **PE32 Indirect Call Audit** | Static `.rdata`/`.data` tables (`0x6FDE42F0..0x6FDEB25C` in `D2Common`; `0x6FD1A078..0x6FD2F9B8` in `D2Game`, incl. `0x6FD27000..0x6FD40000` skill/missile/quest/object/AI/UMod matrices), struct-field callback target sets (`pfCallback[0..14]`, `pfSeqFilter`, `pfStatusFilter`, `pfnInitFunc`, `D2ItemEventNode`), and `42` `VERIFIED_CALLER_CALLBACK_VAS` (`11` `D2Common` + `31` `D2Game`) | `0` unresolved `indirectUnknown` VAs (`sync-gates.py --check --strict-standins` + `instrument-va-trace.py --check` clean across `4,804` kernel symbols) |
| **Key PE32 Signature & Struct Fixes** | (1) Custom MSVC 7.1 LTCG register ABIs + `ret N`; (2) `MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0` first arg = `pCoordNode` + `(3, 6)` minion bounds; (3) `D2StatListExStrc` `STATLIST_EXTENDED` (`0x80000000` at `+0x10`) reading `FullStats` at `+0x48/+0x4C` vs basic `D2StatListStrc` `Stats` at `+0x24/+0x28`; (4) `D2QuestDataStrc` `sizeof = 0xF8` (`nRespecQuestFilter` at `+0xE4`) & `D2GameStrc` `sizeof = 0x1DF4` | Audited against 1.13c PE32 disassembly and locked in unit + longitudinal replay suites |
| **Runtime Execution vs DLL Coverage** | Headless Wine `d2host-113c.exe` + `d2oracle.dll` one-shot `INT3` across all `4,810` manifest entries (`*.coverage.ndjson.gz`) vs live `va-trace-113c` | **`[K1]`/`[K2]`**: `runtimeExecGap = 0` (`5/5` scenarios); **`[K3]`**: `runtimeExecGap = 0` (`9/9` `p52-*` scenarios, `15,700` frames, `780/780` `D2Common` + `652/652` `D2Game`); **`[K4]`**: `5/5` Act 1–5 quests (`710` frames, `0` strict diff, `415/445` `D2Common` + `429/475` `D2Game` `dll ∩ ts`, Act 1 `273/273` `D2Game`) |
