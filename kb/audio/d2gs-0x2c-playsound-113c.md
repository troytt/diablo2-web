# D2GS `0x2C PlaySound` 与 `0xA4 MonsterSpecialSkill` 逆向分析 (`D2Client.dll` v1.13c)

> **Ground Truth**: `D2Client.dll` v1.13c (`0x6fb5d740`, `0x6fb5d760`, `0x6fad3f20`, `0x6fad3200`, `0x6fb4cad0`, `.rdata:0x6fba7694`) 与 1.13c MPQ (`Sounds.txt` 4,699 行、`MonStats.txt` 734 行、`MonSounds.txt`)。

---

## 1. 核心结论

1. **D2GS `S2C 0x2C PlaySound` (`8` 字节) 的 `u16` 字段 (`+6`) 是声音事件码 (`eventCode`)，绝不是 `Sounds.txt` 行号**：
   - `0x6fb5d740` 在查找单位 `D2CLIENT_FindClientSideUnit(unitId, unitType)` (`0x6fb54e20`) 成功后，将 `*(u16*)(pkt+6)` 作为 `eventCode` 传入 `0x6fad3f20`。
   - 若 `pUnit == NULL`，直接返回，不播放任何声音。
2. **D2GS `S2C 0xA4 MonsterSpecialSkill` (`3` 字节) 不播放任何声音**：
   - 处理器 `0x6fb5d760` 仅调用 `0x6fb1a0c0(classId, 0)` 更新 UI 状态，无任何音频调用。

---

## 2. 外层事件码分发 (`0x6fad3f20`, `eventCode 10..93`)

| `eventCode` | 解析逻辑 | 产出 `Sounds.txt` ID / 行为 |
|---:|---|---|
| `10` | `PlaySound(2673 /* shrine_refill */, pUnit, 0, 0, 0)` + `SetSoundVolume(handle, 120)` | `soundId = 2673`, `volume = 120`, `volumeOverride = 120` |
| `12` | 读取单位 StatList (`flag=0x44`) `stat 350` (`modifierlist_skill`)，查 `Skills.txt` `stsound` | `soundId = stSoundId` |
| `13` | `PlaySound(2634 /* object_trap_trigger */, pUnit, 0, 0, 0)` | `soundId = 2634` |
| `14` | `PlaySound(2635 /* object_trap_release */, pUnit, 0, 0, 0)` | `soundId = 2635` |
| `15` | 仅 `classId == 271` (`roguehire`)：`PlaySound(4290 /* rogue_confirm_a_1 */, pUnit, 0, 0, 0)` | `speechSoundId = 4290` (`Stream = 1`) |
| `16` | 怪物挑衅 (`MonStats.txt` -> `MonSounds.txt` `+0x74 Taunt`) | 19 个 Boss/怪物 `classId` 映射到对应 `Stream = 1` Taunt 语音 (`MONSTER_TAUNT_BY_CLASS_ID_113C`) |
| `17` | 怪物逃跑 (`MonStats.txt` -> `MonSounds.txt` `+0x78 Flee`) | 仅 `fallen` 家族 (`classId` `19..23, 642..644`) 映射 `soundId = 917` (`monster_fallen_flee_1`), `delayTicks = 6..8` |
| `18` | 城镇 NPC 问候 (`0x6fb4cce0` -> `0x6fb4cad0`, `.rdata:0x6fb8f0dc..0x6fb8f37c`) | 35 个城镇 NPC `classId` 映射到 `Stream = 1` 问候语音 (`NPC_GREETING_BY_CLASS_ID_113C`) |
| `84..87` | 佣兵装备语音 (`271` `roguehire` vs 其他佣兵) | `84: 4615/4625`, `85: 4612/4616`, `86: 4613/4619`, `87: 4614/4622` |
| `90` | 远古野蛮人台词 (`4379 ancient_act5_reward_spiel`) | `speechSoundId = 4379` |
| `91` | 佣兵升级音效 (`8 cursor_level_up_hireling`，绑定本地玩家) | `soundId = 8` |
| `92` | 仅更新任务音乐计时器全局变量，不播放声音 | `null` |
| `93` | 尸体拾取音效 (`2553 object_corpse_loot`) | `soundId = 2553` |
| `default` | 仅当 `pUnit->dwUnitType == 0` (玩家单位) 时进入 `0x6fad3200` | 非玩家单位返回 `null` |

---

## 3. 7 职业语音表 (`.rdata:0x6fba7694` -> `0x6fba7560..0x6fba7668`) 与内层分发 (`0x6fad3200`)

`.rdata:0x6fba7694` 为 7 个职业结构体指针表，每个结构体包含 `11 × uint32` (`44` 字节)：

| 职业 (`classId`) | 结构体 VA | `+0x00 getHit1` | `+0x04 death1` | `+0x08 impossible1` (19) | `+0x0c needMana1` (21) | `+0x10 needKey1` (22) | `+0x14 cantCarry1` (23) | `+0x18 cantUseYet` (20) | `+0x1c notInTown1` (24) | `+0x20 chatBase` (25..32) | `+0x24 questBase` (33..83) | `+0x28 taunt1` (footstepBase) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `0` Amazon | `0x6fba7560` | `2878` | `2883` | `2953` | `2957` | `2955` | `2934` | `2936` | `2959` | `2937` | `2961` | `2768` |
| `1` Sorceress | `0x6fba7610` | `2910` | `2915` | `3265` | `3269` | `3267` | `3246` | `3248` | `3271` | `3249` | `3273` | `2720` |
| `2` Necromancer | `0x6fba75b8` | `2894` | `2899` | `3109` | `3113` | `3111` | `3090` | `3092` | `3115` | `3093` | `3117` | `2720` |
| `3` Paladin | `0x6fba75e4` | `2886` | `2891` | `3187` | `3191` | `3189` | `3168` | `3170` | `3193` | `3171` | `3195` | `2768` |
| `4` Barbarian | `0x6fba758c` | `2902` | `2907` | `3031` | `3035` | `3033` | `3012` | `3014` | `3037` | `3015` | `3039` | `2816` |
| `5` Druid | `0x6fba7668` | `2926` | `2931` | `3421` | `3425` | `3423` | `3402` | `3404` | `3427` | `3405` | `3429` | `2720` |
| `6` Assassin | `0x6fba763c` | `2918` | `2923` | `3343` | `3347` | `3345` | `3324` | `3326` | `3349` | `3327` | `3351` | `2720` |

- **任务独白延迟 (`0x6fad3474` + `.text:0x6fad35b4`)**：
  - 在 `33..83` 中，凡不属于任务音乐 Stinger 分支且满足 `((code - 38) >>> 0) > 18`（包含 `code == 36` 及 `57..83` 非 Stinger 项）或 `byte_6fad35b4[code - 38] == 1` 的事件码，均附带 `delayTicks = 12` (`0x0c`)。

---

## 4. 代码映射位置

- `src/client/audio/d2gs-play-sound-113c.ts`: `resolve0x2CPlaySound113c()`、`PLAYER_SOUND_TABLE_0x6FBA7694`、`MONSTER_TAUNT_BY_CLASS_ID_113C`、`FALLEN_CLASS_IDS_113C`、`NPC_GREETING_BY_CLASS_ID_113C`、`QUEST_VOICE_DELAY12_CODES`
- `src/client/world/client-world.ts`: `case 'PlaySound'`（含 `0xA4` 缺失 `ev.unit` 守卫）、`pushSoundRequest()` 与 `drainWorldSoundRequests()`
- `src/client/session/online-session.ts`: `drainWorldSoundRequests()` → `this.audioRuntime.playSound(...)`
- `src/client/audio/audio-runtime-113c.ts`: `playSound()`、`drainWorldRequests()` 与 `sessionEpoch` 异步解码隔离守卫
