# Diablo II v1.13c Reverse-Engineering Knowledge Base (`kb/`)

> **Ground Truth Invariant**: All **185** documents in this knowledge base are reverse-engineered strictly and exclusively from the original **Diablo II: Lord of Destruction v1.13c** binary assembly (`D2Client.dll`, `D2Game.dll`, `D2Common.dll`, `D2Net.dll`, `D2CMP.dll`, `D2Multi.dll`, `D2MCPClient.dll`, `D2Gfx.dll`, `D2Direct3D.dll`, `D2Gdi.dll`, `D2Win.dll`, `D2Lang.dll`, `D2Launch.dll`, `D2sound.dll`, `Storm.dll`, `Fog.dll`) and official Blizzard 1.13c MPQ data tables (`Skills.txt`, `Missiles.txt`, `MonStats.txt`, `MonStats2.txt`, `MonUMod.txt`, `SuperUniques.txt`, `Objects.txt`, `ItemStatCost.txt`, `Properties.txt`, `TreasureClassEx.txt`, `States.txt`, `Sounds.txt`, etc.) in `samples/d2/` (`~/d2-data/`) as the sole ground truth.

---

## 目录概览 / Directory Overview (185 Specs)

```text
kb/
├── README.md                                  # 知识库分类总索引 (本文件，索引全部 185 份逆向规范)
├── missile-velocity-range-113c.md             # 投射物速度/加速度 8.16 定点截断、Range/LevRange 寿命、SubLoop 与减速箭
├── quests-item-pickup-and-find-113c.md        # 任务物品持有检查 (QUESTS_FindItemByCode) 与地面拾取冲突校验分离规范
├── engine/        (9)                         # 1:1 移植调用顺序对照、无头服务端宿主、AnimData 动作帧、状态计时、受击模式与 Wine Oracle 钩子约定
├── stats/         (2)                         # D2StatListStrc / D2StatListExStrc 内存布局与 ItemStatCost op 1..13 动态派生算子
├── progression/   (1)                         # 角色升级属性成长 (1/256 定点)、加点、佣兵成长与背包/储藏箱金币上限
├── save/          (1)                         # 单机 .d2s 地图种子派生与跨难度切换地图重掷规范
├── combat/       (16)                         # 命中/防御/动作速率、物理/元素伤害、抗性/吸收、反伤/受击触发、吸血吸蓝、硬直/格挡/击退/CB、毒伤/DoT/回血与经验分配
├── items/        (11)                         # 物品位流与属性函数、alvl 词缀权重、MonEquip 创建、TreasureClassEx 掉落、商店/赌博、腰带与地面标签
├── monsters/     (31)                         # 734 行怪物初始化种子、房间刷怪密度、怪物事件分发表、MonUMod 词缀、129 项 MonAI、召唤物/佣兵 AI 与 Boss 死亡演出
├── npc/           (3)                         # 城镇治疗 NPC、NPC 三次握手交互协议与 S2C 0x27 栈对齐填充守卫 (含冰封安雅)
├── world/         (5)                         # 各幕出生点特殊瓦片索引、同幕房间空间索引隔离、D2GAME_FindFreeCoords 空地搜索、商人定价与预设宝箱
├── objects/       (7)                         # 场景物件命中/距离、神殿 InitFn/OperateFn、水井与陷阱、跨层楼梯 (UNIT_TILE=5) 与任务传送门
├── quests/       (12)                         # A1Q4 女伯爵宝箱、A2Q6 插杖、A3Q5 议会与碎球、A4Q1/Q2 衣卒尔/地狱熔炉、A5Q2/Q5/Q6 救兵/三野蛮人/通关与日志同步
├── network/       (9)                         # D2Net 11 项 IAT 桥接、变长表与 C2S 分发、MCP/Ping/Storm 扇区解压、房间 AOI、0x1A..0x1F 经验属性、组队/敌对与单位报文队列
├── ui/           (19)                         # 底栏 HUD 几何、角色/佣兵面板、面板显示 Oracle、键位矩阵、玩家交易、注入/打孔窗口、任务槽位与大厅加入面板
├── skills/       (44)                         # SkillCalc/MissCalc 字节码、光环路由/过滤、弹道碰撞/穿透/爆炸半径、Boss 技能与 7 职业 21 系技能树全解
├── render/       (10)                         # 瓦片绘制顺序与屋顶揭开、eDrawMode 混合模式、PL2 状态染色、64 方向表、Gamma 斜坡、光源记录与震屏
└── audio/         (3)                         # Sounds.txt 记录池与 16 通道抢占、SoundEnviron 昼夜雨雷/音乐切换与 S2C 0x2C 声音事件码
```

---

## 0. 1:1 移植规范 / Porting Rules (`engine/`)

适用于所有 1:1 移植（怪物 AI 各族、宠物/召唤 AI、技能 SrvDo/SrvHit/SrvDmg、投射物、PATH/D2Common、物品/掉落、属性公式等）。子代理 prompt 必须引用本节。

1. **每移植一个原版函数，必须在 `kb/<领域>/` 对应文档新增或更新一节**：地址 + 调用约定、逐分支伪代码（标关键指令地址）、RNG 消耗表（种子 / 条件 / 取模）、读取的 txt/bin 字段（**禁止 `|| 默认值` 兜底**，缺数据即抛错）、对应 TS 函数链接。
2. **按领域归档**（如 `kb/monsters/d2game-<族>-ai-113c.md`、`kb/skills/…`、`kb/engine/…`）；已有文档就补充，不另起炉灶；新文档登记到本 README。
3. **代码与文档同一提交**；TS 函数注释写原版地址并链接到 kb 文档节。
4. **调用顺序普查**：被移植函数中对 `PATH_*` / `STATES_*` / `SEED_*` 等有顺序副作用的调用，逐行登记到 [`engine/path-call-order-audit-113c.md`](./engine/path-call-order-audit-113c.md)（原版地址 | 原版序列 | TS 调用点 | TS 序列 | 状态）。
5. **验证节奏**：移植 → 文档 → `npx tsx tools/oracle/trace-window.ts <scenario> --frame F --unit T:ID` 核对逐帧 RNG 抽取次数与调用点 → `parity-report` / check-div 确认已过场景不回退 → 汇报。

---

## 1. 引擎内核、属性算子、成长存档与 Oracle 底座 (`engine/`, `stats/`, `progression/`, `save/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`engine/path-call-order-audit-113c.md`](./engine/path-call-order-audit-113c.md) | `D2Game.dll` `0x6FD12599`, `0x6FC95EBE..0x6FC95EE7`, `0x6FC94D50`, `0x6FC95070` | `PATH_*` / `SEED_*` 有序副作用调用点逐行对照表（`#10286 SetTargetPos` 会清空 `pTargetUnit`）与 `\|\| 默认值` 兜底清理清单。 |
| [`engine/d2game-state-timer-113c.md`](./engine/d2game-state-timer-113c.md) | 定时状态移除帧（`STATES_SetTimer`） | 状态在 `应用帧 + 持续帧` 才移除（与应用发生在帧内哪个阶段无关）；回放器不在应用当帧衰减计时（oracle：Decrepify F=697 → F=797 消失）。 |
| [`engine/d2game-event-wheel-and-room-units-113c.md`](./engine/d2game-event-wheel-and-room-units-113c.md) | `D2Game.dll` `0x6FCAEA80` / `0x6FCAF070` / `0x6FCAEBC0`, `D2Common.dll` `#10531` / `#11016` | 事件轮节点布局、64 槽 + 常驻列表、分区顺序（导弹→玩家→怪物→物件→物品）、怪物事件类型、房间单位链表；oracle 顺序日志证据。 |
| [`engine/d2game-plrmode-gethit-113c.md`](./engine/d2game-plrmode-gethit-113c.md) | `D2Game.dll` `0x6FCFD1CE..0x6FCFD442` (`SUNITDMG_ExecuteEvents` 玩家分支), `0x6FC98430`, `0x6FC98550` | 战斗触发的玩家模式：闪避/规避 → S1(13)（状态 65/66 的技能）、格挡 BL(9) 受 `帧 - STAT95 > 15 + FBR/8` 门控、死亡/击退/受击；怪物挥击触发的模式持续 `ceil(frames*256/speed)`；施法/攻击模式结束跑动路径；SQ(18) 序列动画 `+0x48` 剩余计数（`0x6FD82460`/`#10426`）。 |
| [`engine/d2common-animdata-dispatcher-113c.md`](./engine/d2common-animdata-dispatcher-113c.md) | `D2Common.dll`, `AnimData.d2`, `WeaponClass.txt`, `PlrMode.txt` | 玩家与变形单位各动作模式按武器类型 (`WeaponClass`) 检索 `AnimData.d2` 帧长、动作触发帧 (`ActionFlag`) 与帧速基准。 |
| [`engine/d2common-unit-velocity-113c.md`](./engine/d2common-unit-velocity-113c.md) | `D2Common.dll` `#10819` (`0x6FD83140`, `UNITS_UpdateAnimRateAndVelocity`) | 单位行走/奔跑移速、技能固定移速 (`0x1000`)、装备/技能 FRW 收益递减、冰冷/衰老减速叠加与每帧子格位移步进运动学。 |
| [`engine/oracle-fn-harness-113c.md`](./engine/oracle-fn-harness-113c.md) | `tools/oracle/hook/fnharness.dll.c`, `D2Game.dll` `0x6FC4E2DB`, `0x6FC72712` | 函数级差分 Oracle 注入固件调用约定：劫持 `GAME_UpdateGameFrame` 并在真实游戏上下文中批量直接调用 `D2Common`/`D2Game` 原生函数。 |
| [`engine/oracle-hooks-113c.md`](./engine/oracle-hooks-113c.md) | `D2Game.dll` (`0x6FC20000`), `D2Common.dll` (`0x6FD50000`), `D2Client.dll` (`0x6FAB0000`) | 进程内 `d2oracle.c` 逐帧状态采集钩子地址全集：服务端帧驱动、单位链表遍历、属性读取与 RNG 种子快照点位。 |
| [`engine/d2game-headless-host-113c.md`](./engine/d2game-headless-host-113c.md) | `D2Game.dll` `#10037`, `#10038`, `#10017`, `#10040`, `#10008`, `#10024`; `D2Common.dll` `#10943`; `Fog.dll` `#10021`/`#10101` | 无头原版 1.13c 服务端宿主 (`d2host-113c.exe`)：零 `Game.exe`/Xvfb/Bink 直驱 `D2Game.#10040` + 单线程紧密循环推进 `D2Game.#10008`（纯步进循环 `~72–76 ms` QPC = `~23,600–25,052 fps` / `~940×–1,002×` 实时预算；含 DLL 初始化端到端墙钟 `~3.3 s` = `~21.5×` 实时，SHA-256 逐帧一致）。 |
| [`stats/d2common-statlist-struct-113c.md`](./stats/d2common-statlist-struct-113c.md) | `D2Common.dll` `0x6FD88100`, `0x6FD8AF00`, `0x6FD89CE0..0x6FD89F60`, `0x6FDC3CE3..0x6FDC3D35`, `0x6FD83CD0`, `0x6FD88730`; `D2Game.dll` `0x6FD00310`, `0x6FCAE6F0` | `D2StatListStrc` (`0x3C`) / `D2StatListExStrc` (`0x64` + `+0x58` `pStateFlags` `48` 字节状态位图，涵盖 `185` 项状态 `0..184`) 偏移冻结、有符号二分查找、`bKeepZero`、`0x6FD89DEA` 载体抑制、`wBaseDepStats` 存储源 `statId`、`SUNIT` 互换桶偏移与 `EVENT_FreeNode` 重入守卫。 |
| [`stats/d2common-statlist-op-dispatch-113c.md`](./stats/d2common-statlist-op-dispatch-113c.md) | `D2Common.dll` `0x6FD89530..0x6FD899F0` (`EvalStatWithOps`), `ItemStatCost.txt` | `ItemStatCost.txt` 派生算子 (`op 1..13`, `op param`, `op base`, `op stat1..3`) 动态求值规范（按等级缩放、百分比加成、基于属性转生命/法力等）。 |
| [`progression/d2game-levelup-vitals-gold-113c.md`](./progression/d2game-levelup-vitals-gold-113c.md) | `D2Game.dll` `0x6FD0B090`, `0x6FCEC960..0x6FD0AE20`, `0x6FC68BA0`; `D2Common.dll` `#10049`, `#11060` | 角色升级 `1/256` 定点属性成长并满额回满生命（存活时）/法力/耐力；手动加点仅增量累加 `LPV<<6` 不回满；佣兵升级属性成长（力量/敏捷/伤害 `/8`、四抗 `/4`）及背包金币 `clvl*10000` / 储藏箱 `2,500,000` 固定上限。 |
| [`save/d2s-map-seed-derivation-113c.md`](./save/d2s-map-seed-derivation-113c.md) | `.d2s` Header (`0xA8` difficulty, `0xAB` mapSeed) | 单机角色 `.d2s` 地图种子持久化、同难度重进复用地形种子与切换难度时重掷 `mapSeed` 规范。 |

---

## 2. 战斗结算、命中防御、异常状态与经验管线 (`combat/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`combat/d2game-tohit-defense-anim-rate-regen-113c.md`](./combat/d2game-tohit-defense-anim-rate-regen-113c.md) | `D2Common.dll` `#10621`, `#10672`, `0x6FD83180..0x6FD835E0`; `D2Game.dll` `0x6FCFDE90`, `0x6FCFC530` | 命中值 `AR = tohit + 5*dex - 35 + ToHitFactor` 与单一 `%AR` 加法池；无视/按比例扣减目标防御；防御 `dex/4` 与 `%ED` 加法池（下限 `-90%`）；PvP `17%` / 佣兵对 Boss `25%` 修正；IAS/FCR/FHR/FBR 有效帧速公式与三围每帧自然回复。 |
| [`combat/d2game-sunitdmg-rng-rolls-113c.md`](./combat/d2game-sunitdmg-rng-rolls-113c.md) | `D2Game.dll` `0x6FCBF210` (`SUNITDMG_RollDamage`), `0x6FCFC530` | 物理与五系元素伤害区间 `[min, max]` 使用攻击者 `D2SeedStrc` 逐系独立掷骰；命中率、闪避三姐妹 (`Dodge`/`Avoid`/`Evade`)、武器格挡、盾牌格挡、暴击 (`CS`/`DS`) 与压碎性打击 (`CB`) 各自消耗独立 `rand(100)` (Issue #1414)。 |
| [`combat/d2game-sunitdmg-player-defender-113c.md`](./combat/d2game-sunitdmg-player-defender-113c.md) | `D2Game.dll` `0x6FC64AC0`, `0x6FCFE5A0`, `0x6FCFDDE0`, `0x6FCFD450`, `0x6FCFC530`/`0x6FCFBED0`, `0x6FC970E0`, `0x6FCFED30`, `0x6FCFEBA0`, `0x6FC32EE0`, `0x6FCFE0C0` | 怪物近战命中玩家：怪物种子 to-hit → `FillPacket` 物理 `min + rand(max - min)`（256 定点、独占区间、当前 A1/A2/S1 模式伤害）→ `RAND(1)` → `MonStats.crit` 暴击；玩家种子 格挡 → 命中后护甲耐久（7 槽加权：`rand(7)`、`rand(权重和)`、`rand(100) < 10`）→ GetHit 档位 `rand(2)/rand(4)`；生命按 256 定点扣减；怪物挥击触发的 BL 模式持续 `ceil(frames*256/speed)` 帧。 |
| [`combat/d2game-effective-resist-113c.md`](./combat/d2game-effective-resist-113c.md) | `D2Game.dll` `0x6FCFB3C0` (`SUNITDMG_ApplyResistances`) | 有效抗性计算：免疫 (`>= 100`) 时仅破免类降抗按 `1/5` 生效，`passive_mastery` 减敌抗在破免后全额扣减；玩家与佣兵叠加难度 `ResistPenalty` (`0/-40/-100`) 且受上限约束（物理 `50%`，元素/毒 `75% + max <= 95%`，下限 `-100%`，Issue #1412）。 |
| [`combat/d2game-elemental-absorb-113c.md`](./combat/d2game-elemental-absorb-113c.md) | `D2Game.dll` `0x6FCFAD00`, `0x6FCFE237` | 元素百分比吸收（上限 `40%`）与固定点数值吸收在抗性扣减后的结算顺序：先治疗受击者当前生命，再从待扣伤害中扣除吸收量。 |
| [`combat/d2game-item-defense-absorb-thorns-ctc-113c.md`](./combat/d2game-item-defense-absorb-thorns-ctc-113c.md) | `D2Game.dll` `0x6FCFC0B0`, `0x6FCFBD00`, `0x6FCFAD00`, `0x6FCFE0C0`, `0x6FCFED30`, `0x6FC57030`, `0x6FCCD910`, `0x6FCCDCE0`, `0x6FCB8A70`, `0x6FC630D0` | 装备驱动防御全调用链：`DR/MDR` 跨系有符号溢出、吸收先疗后扣、`ITEMEVENTS` LIFO 去重顺序（`Iron Maiden` → `ATD`/`ATLD`/`受损转法力`/`受击触发 CtC` → 生命钳制与扣血 → 护甲耐久抽取 → `Thorns` 百分比反伤 → `GetHit`）及 `#42 静态力场` 结算。 |
| [`combat/d2game-life-mana-steal-113c.md`](./combat/d2game-life-mana-steal-113c.md) | `D2Game.dll` `0x6FCFBA40` (`SUNITDMG_ApplyLeeches`) | 生命/法力偷取：基于扣减物理抗性后的实际物理伤害，依次应用难度 `LifeStealDivisor`/`ManaStealDivisor` 与受击怪物 `MonStats.txt` `Drain` 效率百分比，并以 `>> 8` (`/256`) 换算固定点回复 (Issue #1413)。 |
| [`combat/d2common-10212-block-rate.md`](./combat/d2common-10212-block-rate.md) | `D2Common.dll` `#10212` (`0x6FD81D20`, `UNITS_GetBlockRate`), `D2Game.dll` | 玩家盾牌格挡率敏捷缩放公式 `(block * (dex - 15)) / (clvl * 2)`（奔跑时 `1/3`、上限 `75%`）、怪物 `NoShldBlock` 门控与格挡硬直动作模式分发。 |
| [`combat/d2game-gethit-recovery-113c.md`](./combat/d2game-gethit-recovery-113c.md) | `D2Game.dll` `0x6FCFB910..0x6FCFB9FC` (`SUNITDMG_CheckSkipGetHit`) | 受击硬直 (`GH`) 触发判定：`HitClass` 分母阈值（`maxhp / 16`、`maxhp / 8` 等）随机检定、不可打断动作模式优先级门控与眩晕 (`STATE_STUNNED`) 必出硬直规则。 |
| [`combat/d2game-knockback-crushing-blow-113c.md`](./combat/d2game-knockback-crushing-blow-113c.md) | `D2Game.dll`, `D2Common.dll`, `MonStats2.txt` | 装备击退 (`STAT_ITEM_KNOCKBACK = 81`) 体型尺寸概率检定、压碎性打击 (`CB`) 近战/远程 × 普通怪/Boss 当前生命百分比削减（受正物理抗性折减）与减速目标 (`Slow Target`) 上限规范。 |
| [`combat/d2game-cold-freeze-duration-113c.md`](./combat/d2game-cold-freeze-duration-113c.md) | `D2Game.dll` (`SUNITDMG_ApplyCold`, `SUNITDMG_ApplyFreeze`), `DifficultyLevels.txt` | 冰冷减速与冰冻持续帧计算：冰抗缩放、难度惩罚除数、无法冰冻 (`Cannot Be Frozen`) 免疫、半冰冻时间 (`Half Freeze Duration`) 与怪物 `chillEffectiveness` 门控。 |
| [`combat/d2-poison-dot-and-monster-missile-damage-113c.md`](./combat/d2-poison-dot-and-monster-missile-damage-113c.md) | `D2Common.dll` `#10413` (`0x6FDBBAA0`), `D2Game.dll` (`STATE_POISON`) | 怪物/陷阱弹道伤害包构建 (`D2Common#10413`)、多源毒素持续伤害 (`STATE_POISON`) 速率/帧长合并规则、`GreaterMummy` 毒雾 AI 与解毒药剂抗性加成。 |
| [`combat/d2game-statregen-dot-113c.md`](./combat/d2game-statregen-dot-113c.md) | `D2Game.dll` `0x6FC96740` (`0x6FC9684A`), `0x6FC97CB0` (`0x6FC97D12`), `0x6FCFCAB0`, `0x6FCFE0C0..0x6FCFE342`, `0x6FC63AA0` | 怪物 `Event 3` (`MONSTER_Event3_HpRegen`) 与玩家 `PLAYER_UpdateHpRegen` 逐帧 `STAT_HPREGEN` (`74`) 结算：`#10372` (`States.txt` `life=1`: `2/52/62`) 抑制天生 `(maxHp*damageRegen)>>12`、召唤物 `stat 74=0`、城镇 `#10057` 保底 vs 野外 `<1` 跳死、毒伤首帧直扣 + `state 86` 4 帧及 `dot_setstat_hook` Oracle 闭环。 |
| [`combat/d2game-missile-gethit-damagerate-srvdo148-113c.md`](./combat/d2game-missile-gethit-damagerate-srvdo148-113c.md) | `D2Game.dll` `0x6FC5AEE0`, `0x6FCFCAD0`, `0x6FCFC120`, `0x6FCCD580` | `Missiles.txt` `GetHit`/`SoftHit`/`KnockBack` 门控受击硬直与格挡动作、`DamageRate/1024` 缩放固定物理/法术减伤 (`stat 34`/`35`)、`NoMultiShot`/`NoUniqueMod` 精英词缀抑制与 `SKILLS_SrvDo148` 湮灭骑士四系随机弹道 (Issue #2017)。 |
| [`combat/d2game-monster-melee-skills-tohit-113c.md`](./combat/d2game-monster-melee-skills-tohit-113c.md) | `D2Game.dll` `0x6FCFE5A0`, `0x6FCB11B0`, `0x6FCB87D0`, `0x6FCD3F10`, `0x6FCD67EC` | 怪物近战技能命中检定、盾牌格挡交互与 `A1`/`A2`/`S1` 附带元素/状态伤害（重击、暗黑冲锋、攻城兽践踏、怪物狂乱等）规范。 |
| [`combat/d2game-experience-pipeline-113c.md`](./combat/d2game-experience-pipeline-113c.md) | `D2Game.dll` `0x6FCFC030` | 击杀怪物经验结算管线：多人游戏生命/经验倍率、角色与怪物等级差缩放表、70+ 级 `Experience.txt` `ExpRatio` 衰减、`+经验%` (`stat 85` / 经验神殿 `state 137`)、同区域队友分摊与佣兵击杀分成。 |

---

## 3. 物品系统、位流编解码、掉落与商店赌博 (`items/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`items/d2common-item-bitstream-props-reqs-113c.md`](./items/d2common-item-bitstream-props-reqs-113c.md) | `D2Common.dll` `0x6FD7A600`/`0x6FD7C0C0`, `0x6FD7813E`, `0x6FDEB0CC`, `#11151`, `#10244` | 物品位流属性列表编解码 (`(raw - SaveAdd) << ValShift`、链式后继属性 `17/48/50/52/54/57` 必写)、`Properties.txt` 函数表、紧凑耳朵存档位、按 `ilvl` 分档最大孔数以及无形 `-10` / 橙装词缀等级需求公式。 |
| [`items/d2game-affix-alvl-weighting-113c.md`](./items/d2game-affix-alvl-weighting-113c.md) | `D2Game.dll` `0x6FC344D0` (`ITEMS_RollAffix`) | 魔法/亮金/自带词缀等级 (`alvl`) 计算公式（`magic_lvl > 0` 分支与 `ilvl < 99 - qlvl/2` 转折点）及 `MagicPrefix`/`MagicSuffix` 频率加权抽样。 |
| [`items/d2game-monster-item-create-113c.md`](./items/d2game-monster-item-create-113c.md) | `D2Game.dll` `0x6FCCFCE0`, `0x6FC31980`, `0x6FC31490`, `0x6FC31070`, `0x6FC30A20`, `0x6FC35240`, `0x6FC344D0`, `0x6FC34210`, `0x6FC303C0`; `D2Common.dll` `#10996` -> `0x6FD95990` | MonEquip 物品 1:1 创建：单位种子 (`pItem+0x20`) 只掷耐久/AC/外观，所有词缀/稀有名/属性值掷在物品数据种子 (`pItemData+4`，`lo = 第二次游戏种子抽取, hi = 666`)；稀有词缀数 `[3,4,4,5,5,5,6,6][r&7]`、每次 `RollAffix` 必抽一次硬币、权重轮盘落空时取最后一个候选。 |
| [`items/d2game-treasure-class-drop-pipeline-113c.md`](./items/d2game-treasure-class-drop-pipeline-113c.md) | `D2Game.dll` `0x6FC51070`, `0x6FC51470`, `0x6FC4F2D0` | `TreasureClassEx.txt` 递归寻路、多人难度 `NoDrop` 指数衰减、MF 边际递减有效值转换、暗金物品单局防重位图 (`pGame->dwUniqueFlags`) 及同局二次命中降级为 3 倍耐久亮金 (Failed Unique) 规范。 |
| [`items/d2game-vendor-gamble-113c.md`](./items/d2game-vendor-gamble-113c.md) | `D2Game.dll` `0x6FCAF4E0..0x6FCB0320`, `0x6FCDCB20..0x6FCDF810` | 商人普通商店库存 (`pNpcRecord->pInventory`) 城镇共享、仅当城镇内最后一名玩家离开时清空刷新；赌博库存 (`pGambleList`) 按玩家隔离、每次打开重掷、单次 `ilvl` (`[clvl-5, clvl+4]`) 掷骰与 Failed Unique/Set 降级规范 (Issue #1357)。 |
| [`items/belt-capacity-113c.md`](./items/belt-capacity-113c.md) | `D2Common.dll` `#10690` (`INVENTORY_GetBeltCapacity`), `Armor.txt`, `belts.txt` | 腰带总格数由穿戴腰带的 `Armor.txt` `belt` 索引查 `belts.txt` `numboxes` 决定（裸装 4 格，轻/中/重型 8/12/16 格）；卸下或更换小容量腰带时溢出槽位的药水自动退回背包或掉落地面。 |
| [`items/belt-scrolls-town-portal-identify-113c.md`](./items/belt-scrolls-town-portal-identify-113c.md) | `D2Game.dll`, `D2Client.dll`, `Misc.txt`, `Skills.txt` | 腰带槽位存放回城卷轴 (`tsc`) 与辨识卷轴 (`isc`) 的使用路由 (`BeltUse` / `C2S 0x26` vs `C2S 0x3F`)、技能释放挂钩与 `S2C 0x9C 0x0F` (`RemoveFromBelt`) 消耗同步。 |
| [`items/item-addskill-tab-encoding-113c.md`](./items/item-addskill-tab-encoding-113c.md) | `D2Common.dll` `0x6FD98470` (func 10), `D2Client.dll` `0x6FB052E2` (descfunc 14) | `skilltab` 参数（线性 `class*3 + tab`）写入 `stat 188` 时编码为 `tab + 8*class`；客户端解码 `class = param >> 3`、`tab = param & 7`（修复法师火系 `8` 与死灵召唤系混淆，Issue #925）。 |
| [`items/d2client-ethereal-item-rendering.md`](./items/d2client-ethereal-item-rendering.md) | `D2Client.dll` `0x6FB1B5A0` (`GFX_DrawItem`), `D2gfx.dll` `0x6FA8B080` | 无形装备 (`IFLAG_ETHEREAL = 0x00400000`) 的 2D UI 精灵以 `DRAWMODE_TRANS50 = 1` (50% 透明度) 渲染；镶嵌其中的凹槽宝石/符文维持 100% 不透明 (`DRAWMODE_NORMAL = 5`)。 |
| [`items/d2client-ground-item-labels-113c.md`](./items/d2client-ground-item-labels-113c.md) | `D2Client.dll` `0x6FB20510` (`DrawGroundItemLabels`) | 按住 Alt 时地面物品标签文本拼装（金币数量前缀、孔数/无形灰字、辨识前后词缀名）、成色配色与碰撞避让布局规范。 |
| [`items/d2client-unidentified-tooltip-reqlevel.md`](./items/d2client-unidentified-tooltip-reqlevel.md) | `D2Client.dll` `0x6FB43D89`, `D2Common.dll` `0x6FD76190` | 未辨识物品在 Tooltip 中严格抑制 `Required Level` 行；仅辨识后 (`IFLAG_IDENTIFIED = 0x10`) 参与词缀需求等级计算，且未辨识护身符在背包中不生效。 |

---

## 4. 怪物系统、AI 状态机、随从寻路与 NPC 交互 (`monsters/`, `npc/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`monsters/d2game-monster-initstats-seeds-113c.md`](./monsters/d2game-monster-initstats-seeds-113c.md) | `D2Game.dll`, `D2Common.dll`, `MonStats.bin`, `MonLvl.bin` | 游戏全局种子派生每个怪物独立 `D2SeedStrc`、幕数换装调色板抽取与 `MONSTER_InitStats` 生命/防御/伤害/经验双端缩放顺序。 |
| [`monsters/d2game-room-monster-density-113c.md`](./monsters/d2game-room-monster-density-113c.md) | `D2Game.dll` `0x6FC67A20`, `Levels.txt` | 房间动态刷怪尝试次数、`MonDen` 密度检定（上限 `10000`）、群组数量 `[MinGrp, MaxGrp]` 与 `sparsePopulate` 稀疏房间门控。 |
| [`monsters/level-scripted-monster-preload-113c.md`](./monsters/level-scripted-monster-preload-113c.md) | `D2Game.dll`, `Levels.txt`, `SuperUniques.txt`, DS1 Presets | 超出 `Levels.txt` 随机池的四大类动态刷怪预加载清单：DS1 预设怪、固定 SuperUnique、混沌封印怪与毁灭王座巴尔五波随从 (Issue #1775)。 |
| [`monsters/d2game-minion-spawning-113c.md`](./monsters/d2game-minion-spawning-113c.md) | `D2Common.dll` `0x6FDAAA00`, `D2Game.dll` `0x6FC41F60`, `0x6FD0E480` | `MonStats.bin` `wMinion[0..1]` 随从链解析、金怪/固定暗金随从数量区间掷骰与领主光环/加成共享。 |
| [`monsters/d2game-monumod-selection-113c.md`](./monsters/d2game-monumod-selection-113c.md) | `D2Game.dll` `0x6FC43CA0`, `0x6FC43980..0x6FC451F0`, `MonUMod.bin` | 43 行 `MonUMod.txt` 精英怪词缀抽取资格（等级、难度词缀数、互斥组 `exclude1/2`、`fPick` 权重与多系强化抗性上限防三重免疫）。 |
| [`monsters/d2game-monumod-init-events-113c.md`](./monsters/d2game-monumod-init-events-113c.md) | `D2Game.dll` `0x6FD2E550` (`fpInit[0..42]`), `0x6FC41BE0` | 精英怪词缀初始化回调表（特别快速、诅咒、光环附魔、法力燃烧、传送回血等）、抗性加成与受击/死亡服务端事件表。 |
| [`monsters/d2client-champion-monster-name-113c.md`](./monsters/d2client-champion-monster-name-113c.md) | `D2Game.dll` `0x6FC43D5E`, `D2Client.dll` `0x6FAD0620` | Champion 头目怪标志 (`0x04`) 与专属词缀 (`36..39`: 幽灵/狂信/着魔/狂暴) 显示名拼装优先级及蓝色血条 (`color = 3`) 规则。 |
| [`monsters/d2game-fallen-ai-113c.md`](./monsters/d2game-fallen-ai-113c.md) | `D2Game.dll` `0x6FCA3130`, `0x6FD0E480`, `#10873` | `AiFallen` 思考、群怪随从生成、房间死亡环与逃跑、`pAiGeneral` 群体指令栈。 |
| [`monsters/d2game-monster-events-113c.md`](./monsters/d2game-monster-events-113c.md) | `D2Game.dll` `0x6FD1A498`, `0x6FC949A0`, `0x6FC94F20`, `0x6FD00750`, `0x6FD00B40`, `0x6FC969A0`, `0x6FCBD3B0` | 怪物 16+5 模式事件注册表 (`0x6FD1A498`)、持续帧动作模式 (`evType 0` 常驻队列 vs 单发槽位)、`MONSTER_DispatchEvent` (`0..14`：特别是 `DT (0)` 通过事件 `1` (`MON_EVENT_MODE_END`) 到 `DD (12)` 的槽位跳转与常驻链表重排，消除 `F790`/`F821` 伪漂移) 与 `AI_RunMonsterAI` 驱动器。 |
| [`monsters/d2game-monai-dispatch-table-113c.md`](./monsters/d2game-monai-dispatch-table-113c.md) | `D2Game.dll` `0x6FD2E668` (`gpHirelingAndPetAiFunctionTable`) / `0x6FD2E788` (`gpMonsterAiFunctionTable`) | `MonAI.txt` 全部怪物与随从/雇佣兵 AI 函数虚拟地址、初始化/思考回调与行为语义映射总表。 |
| [`monsters/monai-113c-profiles.md`](./monsters/monai-113c-profiles.md) | `MonStats.txt`, `MonAI.txt` | 怪物 AI 参数 (`aidel`, `aip1..aip8`) 在普通/噩梦/地狱三难度下的决策间隔、施法概率与索敌半径解析。 |
| [`monsters/d2common-path-wall-follow-113c.md`](./monsters/d2common-path-wall-follow-113c.md) | `D2Common.dll` `0x6FD68830` / `0x6FDA69E0` | `D2Common` 动态寻路左右手沿墙绕障子路径搜索 (`PATH_FindSubpathWithoutObstacles`) 与步进防抖终止条件。 |
| [`monsters/d2game-zombie-ai-113c.md`](./monsters/d2game-zombie-ai-113c.md) | `D2Game.dll` `AiZombie` `0x6FCA38B0`, `AI_ApproachTarget` `0x6FD12540`, `AI_IdleWander` `0x6FD11B10`, `MONSTER_StartMode` `0x6FC95E10` | 僵尸 AI 逐分支伪代码、单位种子 RNG 消耗表 (`aip4` 选 A1/A2、`aip2` 距离门控 `aip1` 追击、游荡 4 次抽取)、移动模式路径类型 13、攻击动作帧 `ceil(event*256/speed)` 与近战命中种子路由。 |
| [`monsters/d2game-necropet-ai-113c.md`](./monsters/d2game-necropet-ai-113c.md) | `D2Game.dll` `NecroPet` `0x6FC3E900`/`0x6FC3E640`, 跟随 `0x6FC3E140`, `PetMove` `0x6FC3CAE0`, AI 驱动 `0x6FCBD3B0`, 停顿 `0x6FD122C0` | 召唤物 (泥/血/铁/火魔像、女武神) AI 逐分支伪代码与 RNG 表、首次 AI 事件 +25/+20 帧、主人跟随状态机 (0/2/4)、`#10916` 区块编号比较。 |
| [`monsters/d2game-summon-pet-spawn-113c.md`](./monsters/d2game-summon-pet-spawn-113c.md) | `D2Game.dll` `D2GAME_SummonPet` `0x6FCC3610`, `SrvDo056_Golem` `0x6FC71750`, `SrvDo016_Valkyrie` `0x6FC6D710`, `0x6FC6E2A0` | 召唤生成: 外观与 `MONSTER_InitStats` HP 种子抽取、`summode` 初始模式、宠物等级 `min(clvl, 3*clvl/4+slvl)`、女武神 `MonEquip` 装备抽取。 |
| [`monsters/d2game-npc-wander-ai-113c.md`](./monsters/d2game-npc-wander-ai-113c.md) | `D2Game.dll` `0x6FC3DB40` (`AI_Npc`), `0x6FC39C20`, `0x6FC36A30` | 城镇 NPC 漫步 AI：瓦瑞夫首次进城问候寻路、DS1 路径节点环绕 (`PATHTYPE_MON_CIRCLE_CW` / `STRAIGHT`) 与玩家对话锁定暂停。 |
| [`monsters/d2game-pet-hireable-ai-113c.md`](./monsters/d2game-pet-hireable-ai-113c.md) | `D2Game.dll` `0x6FD2E788`, `PetType.txt`, `Hireling.txt` | 召唤物（骷髅、石魔、乌鸦、藤蔓、狼熊、影子大师、女武神）与四幕雇佣兵跟随拉回距离、索敌及技能释放 AI。 |
| [`monsters/d2game-mercenary-hire-aura-113c.md`](./monsters/d2game-mercenary-hire-aura-113c.md) | `D2Game.dll` `0x6FCEDBF0`, `0x6FD0D980`, `0x6FC68BA0`, `0x6FC3DD40`, `0x6FC3D3C0`, `0x6FC3C8A0`, `0x6FC3C4E0`, `0x6FCC0C70`; `D2Common.dll` `#11156` (`0x6FDA32C0`) | `.d2s` 雇佣兵进房优先加载与双种子派生、动态分段经验升等与 `MERCS_SetStats` 属性/抗性/技能插值、`Hireable` 跟随寻路 (`AIMERC_HireablePetMove`) 与远程风筝技能轮盘，以及圣骑士组队光环 (`AURA_RadialPulse`) 对雇佣兵辐射叠加。 |
| [`monsters/d2game-resurrector-ai-113c.md`](./monsters/d2game-resurrector-ai-113c.md) | `D2Game.dll`, `MonAI.txt`, `Skills.txt` | 沉沦魔巫师、大木乃伊等尸体复活型 AI 的空间尸体扫描半径、派系匹配与复活技能状态机。 |
| [`monsters/d2game-srvdo096-healer-ai-113c.md`](./monsters/d2game-srvdo096-healer-ai-113c.md) | `D2Game.dll` `0x6FCD3770` (`SKILLS_SrvDo096_ZakarumHeal_Bestow`) | 萨卡兰姆牧师/祭司治疗技能 (`#179`, `#182`, `#291`) 与督军鞭笞等辅助型怪物 AI 思考门控。 |
| [`monsters/d2game-vampire-ai-and-srvdo28-113c.md`](./monsters/d2game-vampire-ai-and-srvdo28-113c.md) | `D2Game.dll` `0x6FCA6900` (`AITHINK_Fn028_Vampire`) | 吸血鬼领主 AI 四技能轮转（火球、火墙、陨石、生命吸取弹道回血）与 `SrvDo028` / `SrvHit14` / `SrvHit31` 结算。 |
| [`monsters/d2game-willowisp-megademon-srvdo095-113c.md`](./monsters/d2game-willowisp-megademon-srvdo095-113c.md) | `D2Game.dll` `0x6FCA0F20`, `0x6FC38CE0`, `0x6FC379A0`, `0x6FCD32E0` | 电鬼 (`WillOWisp` 隐身游走与远程闪电弹)、巨型恶魔 (`Megademon`)、冰封魔怪与怪物地狱火 (`SrvDo095` 持续喷射帧伤害) 规范。 |
| [`monsters/d2game-spirit-trappedsoul-idle-align-ai-113c.md`](./monsters/d2game-spirit-trappedsoul-idle-align-ai-113c.md) | `D2Game.dll` `0x6FC360B0`, `MonStats.txt` (`Align`) | 墨菲斯托冤魂、受困灵魂、塔塔等静止/装饰性 AI 与 `MonStats.txt` `Align` (`0/1/2`) 阵营敌友规则。 |
| [`monsters/tentacle-submerge-emerge-113c.md`](./monsters/tentacle-submerge-emerge-113c.md) | `D2Game.dll`, `D2Common.dll` (`TE` / `TN`) | 第三幕水怪/河岸潜伏者 (`Water Watcher` / `River Stalker`) 潜伏下潜与破水浮出无敌/可攻击状态机。 |
| [`monsters/d2client-monster-death-state-113c.md`](./monsters/d2client-monster-death-state-113c.md) | `D2Client.dll` `0x6FAD1480`, `S2C 0x76`, `MonStats2.txt` | 怪物从 `MONMODE_DEATH (0) / MONMODE_DEAD (12)` 动画流转至尸体态、无尸体隐藏 (`corpseSel=0`)、碎冰消融与复活还原路径 (Issue #916)。 |
| [`monsters/d2client-monumod-death-fx-113c.md`](./monsters/d2client-monumod-death-fx-113c.md) | `D2Client.dll` `0x6FAD1660` (`MONUMOD_ClientDeathDispatch`) | 精英怪 `MonUMod` 与天生死亡客户端特效分发：火焰强化尸爆、冰冷强化霜之新星、闪电强化充能弹、圣甲虫与冥河娃娃自爆。 |
| [`monsters/d2client-boss-death-cltdo-113c.md`](./monsters/d2client-boss-death-cltdo-113c.md) | `D2Client.dll` `CltDoFunc 31/32/42/47/66`, `MissCltDoFunc 21/61` | 安达利尔火柱震屏、血鸟灵魂喷发、血鹰巢穴破壳、崔凡克议会灵魂飞升与督瑞尔/山克 (`MonUMod 22`) 死亡演出。 |
| [`monsters/d2client-boss-death-shows-113c.md`](./monsters/d2client-boss-death-shows-113c.md) | `D2Client.dll` `CltDoFunc 29/45/52/79/82/91`, `MissCltDo 26/28`, `MissCltHit 33` | 暗黑破坏神、墨菲斯托、拉达蒙特、召唤者、衣卒尔、尼拉塞克与巴尔死亡视觉特效及客户端弹道序列。 |
| [`monsters/d2client-monster-overlays-mephisto-113c.md`](./monsters/d2client-monster-overlays-mephisto-113c.md) | `D2Client.dll` `0x6FAFD610`, `0x6FB570C0`, `0x6FB607E0`, `MephistoOverlay.DC6` | 怪物常驻叠加层挂载与墨菲斯托白色灵雾 (`Overlay #122`) 循环播放及死亡 70 帧后 `UNITFLAG_DONOTDRAW` 同步消隐规范。 |
| [`monsters/diablo-baal-art-paging-921.md`](./monsters/diablo-baal-art-paging-921.md) | `src/baker/packers/pack-entity-assets.ts` | 暗黑破坏神 (`DI`) 与巴尔 (`42`) 超大尺寸多方向 DCC 精灵图集分页打包与 UV 采样防裁切规范 (Issue #921)。 |
| [`monsters/d2client-npc-interaction-range-113c.md`](./monsters/d2client-npc-interaction-range-113c.md) | `D2Common.dll` `#10407` (`0x6FDCFCD0`), `D2Client.dll` `0x6FACAFEA`, `0x6FAF83B0` | 点击怪物/NPC 单位尺寸修正距离 (`#10407 <= 2` 且无 `0x804` 阻挡) 与 NPC 对话框每帧仅校验存活、不做距离复检规范 (Issue #890)。 |
| [`npc/d2game-town-healers-113c.md`](./npc/d2game-town-healers-113c.md) | `D2Game.dll` `0x6FCDD810`, `0x6FCDD490`, `0x6FCDCBE0`, `D2Common.dll` `#10590` | 五幕 6 位城镇治疗师（阿卡拉、亚特玛、法拉、奥玛斯、贾梅拉、马拉）对话时自动回满角色生命/法力/耐力、清除中毒/冰冻/诅咒并同步治疗佣兵与召唤物。 |
| [`npc/npc-interact-0x13-0x28-0x2f-handshake-113c.md`](./npc/npc-interact-0x13-0x28-0x2f-handshake-113c.md) | `D2Client.dll`, `D2Game.dll` (`C2S 0x13 -> S2C 0x28 -> C2S 0x2F -> C2S 0x38`) | NPC 交互严格三次握手时序：解释为何客户端乐观抢发 `C2S 0x2F` 会导致远端 D2GS 商人打开空商店。 |
| [`npc/s2c-0x27-npc-info-a5q3-frozen-anya-113c.md`](./npc/s2c-0x27-npc-info-a5q3-frozen-anya-113c.md) | `D2Common.dll` `#10619`, `#10485`, `D2Game.dll` | `S2C 0x27` (`NPCInfo` 40 字节) 严格按 `count = pkt[6]` 读取并忽略未清零栈填充字节，以及 A5Q3 冰河解救冰封安雅交互流程。 |

---

## 5. 世界出生点、场景物件、神殿陷阱与五幕任务 (`world/`, `objects/`, `quests/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`world/d2common-act-spawn-location-raytrace-113c.md`](./world/d2common-act-spawn-location-raytrace-113c.md) | `D2Common.dll` `#10816` (`0x6FD8CDF0`), `#10864`/`#10479` (`0x6FD9AD20`) | 各幕出生点解析：`Levels.txt` `Position` 关卡选取 `style 30..33` 特殊瓦片（`index 0` 进城、`index 11` 回城门）再做空地搜索，以及包含起点的主轴 Bresenham `COLLISION_RayTrace` 视线检测。 |
| [`world/d2common-room-spatial-scoping-113c.md`](./world/d2common-room-spatial-scoping-113c.md) | `D2Common.dll` `#11022` (`0x6FD51330`, `DUNGEON_GetRoomAtPosition`) | 同幕房间空间索引隔离与野外接缝区域查询，防止不同幕重叠世界坐标误匹配 (Issue #2016)。 |
| [`world/d2common-vendor-pricing-113c.md`](./world/d2common-vendor-pricing-113c.md) | `D2Common.dll` `#10107` (`0x6FD78E80`), `D2Game.dll` `0x6FCDE640`, `ItemRatio.txt` | 商人买入/卖出/修理/充能/赌博价格精确计算（词缀/技能加价、降价属性与幕数卖出封顶 `5000..35000`）及严格金币/空间事务校验 (Issue #1486)。 |
| [`world/d2game-preset-objects-113c.md`](./world/d2game-preset-objects-113c.md) | `D2Game.dll` `0x6FC522B0`, `0x6FC531B0`, `Objects.txt` (`574..582`) | DS1 预设占位对象索引 (`574..582`) 在房间初始化时通过游戏种子解析为实际宝箱与超级宝箱 (`Super Chests`) 规范。 |
| [`world/d2game-find-free-coords-quest-spawns-113c.md`](./world/d2game-find-free-coords-quest-spawns-113c.md) | `D2Game.dll` `0x6FC54130`, `0x6FCDC050`, `0x6FC7C1F0`, `0x6FC7D760`, `0x6FCDB006` | `D2GAME_FindFreeCoords` 全 17 处动态任务 Boss/NPC/传送门 `maxRadius=100` (`0x64`) 空地环搜索与虚空拒刷规范（修复混沌西侧封印西希之王等虚空刷怪，Issue #2018）。 |
| [`objects/d2-npc-placeholder-objects-113c.md`](./objects/d2-npc-placeholder-objects-113c.md) | `D2Game.dll` `0x6FC89140`, `D2Client.dll` `0x6FAD5120`, `Objects.txt` (`InitFn 18/19`) | 城镇 NPC 静态占位 Object（杰海因、赫拉铁力、夸尔凯克、安雅）与 `0xAC AssignNPC` 动态实体双向互斥隐藏，消除幽灵重影 (Issue #900)。 |
| [`objects/d2client-object-interact-hittest-113c.md`](./objects/d2client-object-interact-hittest-113c.md) | `D2Common.dll` `#10594` (`0x6FD81000`), `D2Client.dll` `0x6FB568E0` | 物件交互距离按 `Objects.txt` `SizeX`/`SizeY` 包围盒计算并剔除 4 个角点，屏幕点击命中区分 `CollisionSubst` 包围盒与精灵帧边界。 |
| [`objects/d2game-roomtile-warp-113c.md`](./objects/d2game-roomtile-warp-113c.md) | `D2Client.dll` `0x6FACAED0`, `D2Game.dll` `0x6FCEE150`, `0x6FD019C0` | 跨层楼梯/入口 (`UNIT_TILE = 5`) 走近门控 (`#10407 <= 4`)、`UnitReassign` 同幕跨层即时切层、真实房间尺寸裁剪与同层多入口就近匹配 (Issue #1488)。 |
| [`objects/d2game-shrine-init-113c.md`](./objects/d2game-shrine-init-113c.md) | `D2Game.dll` `0x6FC4EF90` (`OBJECTS_InitFn01_Shrine`), `Shrines.txt` | 服务端神殿初始化 (`InitFn 1`)：按关卡等级与稀有度池抽样 `Shrines.txt` 子类 ID 并写入对象交互类型字节。 |
| [`objects/d2game-shrine-effects-113c.md`](./objects/d2game-shrine-effects-113c.md) | `D2Game.dll` `0x6FC8DA00`, `0x6FD1A5F8` (`OperateFn 2`) | 全部 22 种神殿触发效果分发表（恢复、抗性/战斗/技能/经验状态互斥覆盖、宝石升级神殿、火焰爆炸/怪物升级神殿与冷却重充）。 |
| [`objects/d2game-wells-and-traps-113c.md`](./objects/d2game-wells-and-traps-113c.md) | `D2Game.dll` `InitFn 16`, `OperateFn 22`, `OperateFn 7/30`, `0x6FD142D0` | 水井两段蓄水状态恢复与再生定时器 (`Object Event 2`)，以及开箱/开棺机关陷阱（毒云、火球、电球、飞镖等）触发规范。 |
| [`objects/portal-warps-sewers-baal-chamber-113c.md`](./objects/portal-warps-sewers-baal-chamber-113c.md) | `D2Game.dll` `0x6FD2E050`, `0x6FD27BB8` | 主线传送门（崔斯特瑞姆红门、神秘避难所、赫拉森传送门、憎恨囚牢、亚瑞特高原红门）、库拉斯特下水道拉杆与世界之石大殿进入门控。 |
| [`quests-item-pickup-and-find-113c.md`](./quests-item-pickup-and-find-113c.md) | `D2Game.dll` (`QUESTS_FindItemByCode` vs `ITEMS_CheckQuestItemPickup`) | 任务物品掉落/发放持有判定与地面拾取冲突校验（含 `questdiffcheck` 跨难度立方体/杖/克林姆遗物规则）分离规范。 |
| [`quests/d2game-quest-item-grant-pickup-113c.md`](./quests/d2game-quest-item-grant-pickup-113c.md) | `D2Game.dll` `0x6FC95DF0` (`QUESTS_CreateItem`), `0x6FCF7020` | NPC 发放任务物品满包自动落地 (`bDropIfFull=1`) 与地面拾取唯一性/空间前置预检，杜绝校验失败误删地面物品。 |
| [`quests/d2game-quest-log-sync-0x40-0x50-0x52-0x5d-113c.md`](./quests/d2game-quest-log-sync-0x40-0x50-0x52-0x5d-113c.md) | `D2Game.dll` `0x6FCEBD30`, `0x6FC54C00` (`updateType = 6`) | 任务日志请求 (`C2S 0x40`) 与 `S2C 0x28` (`updateType=6, unitId=0` 避免误触 NPC 菜单握手)、`0x50`、`0x52`、`0x5D` 状态同步规范。 |
| [`quests/d2game-a1q4-countess-tower-chest-113c.md`](./quests/d2game-a1q4-countess-tower-chest-113c.md) | `D2Game.dll` `0x6FC88AB0`, `0x6FC88B90`, `0x6FC85E90` (`Missiles.txt #332`) | A1Q4 遗忘高塔女伯爵首杀触发服务端弹道 `towerchestspawner` (`#332`) 开启专属宝箱 (`Objects.txt 371`) 喷发掉落规范。 |
| [`quests/a2q6-staff-orifice-show-113c.md`](./quests/a2q6-staff-orifice-show-113c.md) | `D2Game.dll` `OperateFn 25/48`, `D2Client.dll` `useitem.cpp` | A2Q6 赫拉迪姆杖孔洞 (`Id=152`) 放入 `hst` (`C2S 0x44`) 触发光束、震屏与督瑞尔房门开启演出（特殊任务事件 3）。 |
| [`quests/a3q5-travincal-council-113c.md`](./quests/a3q5-travincal-council-113c.md) | `D2Game.dll` `0x6FD09200`, `0x6FD07DB0`, `SuperUniques.txt` | A3Q5 崔凡克最高议会成员击杀回调、克林姆的连枷掉落与“漆黑神殿”任务完成判定。 |
| [`quests/a3-compelling-orb-smash-113c.md`](./quests/a3-compelling-orb-smash-113c.md) | `D2Game.dll` `0x6FC69130` (`OperateFn 53`) | A3Q5 装备克林姆的意志 (`qf2`) 击碎强制球体 (`Id=404`) 的状态流转、武器销毁与憎恨囚牢入口开启。 |
| [`quests/d2game-act4q1-izual-tyrael-113c.md`](./quests/d2game-act4q1-izual-tyrael-113c.md) | `D2Game.dll` `0x6FCDA68F`, `D2Client.dll` (`ACT4Q1`) | A4Q1 堕落天使衣卒尔击杀灵魂释放演出与回城对话泰瑞尔发放 `+2` 技能点奖励状态机。 |
| [`quests/a4q2-hellforge-show-113c.md`](./quests/a4q2-hellforge-show-113c.md) | `D2Client.dll` `0x6FB03220` (`event 14`, `CltDo 38..41`, `CltHit 42..43`) | A4Q2 地狱熔炉敲碎墨菲斯托灵魂之石的客户端熔岩飞溅特效演出与宝石/符文奖励掉落 (Issue #1492)。 |
| [`quests/a5q2-prison-rescue-and-whip-morph-113c.md`](./quests/a5q2-prison-rescue-and-whip-morph-113c.md) | `D2Game.dll` `0x6FC7A310..0x6FC7CB7F`, `0x6FC2D850`, `0x6FCCFC50..0x6FCD0318` | A5Q2 冰冻高地摧毁牢门 (`#434`) 破笼开门 (`#189`)、解救战俘 (`#534`) 三档符文奖励，以及督军鞭笞 (`#295`) 变形自爆怪属性重初始化规范 (Issue #2021)。 |
| [`quests/a5q5-ancients-altar-113c.md`](./quests/a5q5-ancients-altar-113c.md) | `D2Game.dll` (`a5q5.cpp`), `D2Client.dll` (`Objects 474..476, 546`) | A5Q5 亚瑞特巅峰远古野蛮人祭坛激活、三座雕像与怪物实体 (`540..542`) 双向状态生命周期及开门重置机制 (Issue #1774)。 |
| [`quests/a5-worldstone-shake-113c.md`](./quests/a5-worldstone-shake-113c.md) | `D2Client.dll` `0x6FB02410`, `0x6FB032C0` (`event 19`, `Missiles.txt #639`) | A5 世界之石大殿切换房间触发持续震屏演出 (`CltDo 66`) 规范 (Issue #1496)。 |
| [`quests/a5q6-game-completion-113c.md`](./quests/a5q6-game-completion-113c.md) | `D2Game.dll` `0x6FC7FD00` (`OperateFn 72`), `D2Client.dll` `0x6FB5F940` | A5Q6 击败巴尔后点击毁灭之末传送门 (`LastPortal`) -> `S2C 0x61 07` -> 头衔晋升与通关胜利结算画面 (Issue #924)。 |

---

## 6. 网络协议、房间 AOI、组队敌对与报文队列 (`network/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`network/d2game-d2net-iat-113c.md`](./network/d2game-d2net-iat-113c.md) | `D2Game.dll` IAT `0x6FD18B48..0x6FD18B70`, `D2Net.dll` (`#10003, #10017, #10000, #10016, #10035, #10014, #10015, #10002, #10001, #10009, #10021`) | `D2Game.dll` 全部 11 项 `D2Net.dll` 导入槽位调用约定、栈平衡字节数、无头宿主 `d2host-113c` 重定向与 `D2NetPacketSink113c` 同构发包契约。 |
| [`network/d2gs-c2s-dispatch-and-sizes-113c.md`](./network/d2gs-c2s-dispatch-and-sizes-113c.md) | `D2Net.dll` `0x6FBF6750`/`0x6FBF65D0`, `0x6FBFA900`; `D2Game.dll` `0x6FCEC550` | `D2Net` S2C/C2S 报文长度表与变长解析器、`D2Game` C2S 处理器分发表（含固定拒绝项 `0x2C/0x2D/0x39/0x45/0x52`）及 `S2C 0x22`/`0x73`/`0x9E..0xA2` 字段语义。 |
| [`network/d2net-mcp-ping-storm-comp-113c.md`](./network/d2net-mcp-ping-storm-comp-113c.md) | `D2Net.dll` `0x6FBF6D60`; `D2Client.dll` `0x6FAC4B00`; `D2MCPClient.dll` `0x6FA2A900`; `Storm.dll` | 5000ms 心跳 `Ping/Pong` RTT 均值、D2GS `0x68` 登录握手常量、`D2MCPClient` 全量 S2C 报文表与 `Storm.dll` MPQ 扇区解压掩码顺序。 |
| [`network/d2client-s2c-unit-queue-and-c2s-interact-113c.md`](./network/d2client-s2c-unit-queue-and-c2s-interact-113c.md) | `D2Client.dll` `0x6FB8DE60`, `0x6FB5CE20`, `0x6FADAC10`, `0x6FAC86A0` | 客户端按单位挂载的 S2C 回调报文队列 (`unit+0xD8`)、各单位类型点击交互发送节流与前置武器校验（克林姆意志/地狱熔炉锤）、行走最小步幅与 7 帧长按门控。 |
| [`network/d2game-room-aoi-113c.md`](./network/d2game-room-aoi-113c.md) | `D2Game.dll`, `D2Common.dll` `#10754` (`ROOM_GetNearRoomsList`) | 服务端基于活跃房间邻接列表 (`D2ActiveRoomStrc`) 的兴趣区域（AOI）加载/卸载 (`0x07`/`0x08`) 与跨关卡边界实体可见性广播规则。 |
| [`network/d2gs-0x1a-0x1f-exp-attr-113c.md`](./network/d2gs-0x1a-0x1f-exp-attr-113c.md) | `D2Client.dll` `0x6FB5E080..0x6FB5E310` | D2GS `0x1A` (u8) / `0x1B` (u16) 经验包为相对增量累加 (`AddStat`)，`0x1C` (u32) 为绝对总经验覆盖 (`SetStat`)；`0x1D..0x1F` 为属性 `BaseStat` 更新。 |
| [`network/d2gs-0x5d-relationship-113c.md`](./network/d2gs-0x5d-relationship-113c.md) | `D2Client.dll` `0x6FAC4850`, `D2Game.dll` (`C2S 0x5D` / `S2C 0x8C`) | 玩家关系控制协议：静音、尸体拾取授权与城镇宣战/解除敌对 (`C2S 0x5D`) 及全房关系标志广播 (`S2C 0x8C`)。 |
| [`network/d2gs-0x5e-party-state-machine-113c.md`](./network/d2gs-0x5e-party-state-machine-113c.md) | `D2Game.dll`, `D2Client.dll` (`C2S 0x5E`, `S2C 0x8B`, `S2C 0x8D`) | 多人组队按钮状态机：邀请、取消邀请、接受入队、离队解散握手与宣战自动退队联动。 |
| [`network/d2gs-0x7a-summon-action-and-0x03-load-act-113c.md`](./network/d2gs-0x7a-summon-action-and-0x03-load-act-113c.md) | `D2Net.dll` S2C 长度表, `D2Client.dll`, `D2Game.dll` (`S2C 0x7A`, `S2C 0x03`) | S2C `0x7A SummonAction` 固定 13 字节（无计数字段）与 `0x03 LoadAct` 12 字节报文布局，及 S2C 失步诊断 (Issue #2022)。 |

---

## 7. 用户界面、键位策略、HUD 几何与大厅面板 (`ui/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`ui/d2client-control-panel-hud-geometry-113c.md`](./ui/d2client-control-panel-hud-geometry-113c.md) | `D2Client.dll` `0x6FAD7290`, `0x6FAD6970`, `0x6FAD78B0`, `0x6FB13000` | `800×600` / `640×480` 底栏控制面板像素几何：经验条 119px 双线填充、耐力条黄/红/蓝变色、生命/法力球平滑插值、迷你面板位移隐藏与弹出式腰带坐标。 |
| [`ui/d2client-charsheet-vitals-113c.md`](./ui/d2client-charsheet-vitals-113c.md) | `D2Client.dll` `0x6FB6CEA0` (`UI_DrawCharSheet`), `0x6FB8D6F0`, `D2Common.dll` `#10913` | 角色属性面板耐力/生命/法力双框布局（**左框上限值、右框当前值**）与 `StatOpEngine` 全加成聚合上限规范 (Issue #903)。 |
| [`ui/oracle-client-display-113c.md`](./ui/oracle-client-display-113c.md) | `tools/oracle/hook/clientui.dll.c`, `D2Client.dll`, `D2Common.dll` | 客户端显示值 Oracle（P5.4）：原版 `D2Client.dll` 角色面板（生命/法力/耐力、左右键面板伤害、AR、防御、抗性）与技能提示精确取值证据。 |
| [`ui/d2win-d2lang-fonts-strings-113c.md`](./ui/d2win-d2lang-fonts-strings-113c.md) | `D2Lang.dll` `0x6FC09360`; `D2Win.dll` `0x6F8F2FE0`; `D2Launch.dll`; `D2Multi.dll` | `.tbl` 三层字符串优先级 (`patch 10000+ > expansion 20000+ > string`)、14 号字体度量表、颜色控制码、角色名过滤与难度解锁门控。 |
| [`ui/d2client-keyconfig-ui-policy-113c.md`](./ui/d2client-keyconfig-ui-policy-113c.md) | `D2Client.dll` `0x6FBA4F10`, `0x6FBCA2E0`, `0x6FB72790`, `0x6FB8D538` | 57 条键位命令表与 `default.key`、模态输入门控、左右侧面板互斥开关策略矩阵、死亡输入锁定、小地图淡出与聊天斜杠命令。 |
| [`ui/d2client-automap-waypoint-parity.md`](./ui/d2client-automap-waypoint-parity.md) | `D2Client.dll` `0x6FB12580` (`AUTOMAP_RevealRoom`), `0x6FB11D00` | 全 39 个小站小地图图元 (`307` / `617..619`) 地板层与对象层防重对齐规范 (Issue #867)。 |
| [`ui/d2client-hireables-portrait-lifebar.md`](./ui/d2client-hireables-portrait-lifebar.md) | `D2Client.dll` `0x6FB0AC70..0x6FB0C7F0` (`Hireables.cpp`) | 左上角随从/佣兵/队友头像框（`46×41` 头像、`46×5` 三色血条、56px 水平步进）绘制规范。 |
| [`ui/d2client-mercenary-screen-113c.md`](./ui/d2client-mercenary-screen-113c.md) | `D2Client.dll` `0x6FB4AE80` (`UI_DrawMercScreen`) | 佣兵装备属性面板（`O` 键）装备槽坐标、12 项属性文本排版与抗性满上限金字/负值红字门控。 |
| [`ui/d2client-level-entry-title-113c.md`](./ui/d2client-level-entry-title-113c.md) | `D2Client.dll` `0x6FB6F0D0`, `0x6FB8BE88` | 切换区域 120 帧居中 `EntryFile` DC6 横幅 (`Entering The Blood Moor` 等)、任务覆盖表与首次进图抑制规则 (Issue #1007)。 |
| [`ui/d2client-npc-menu-quest-gates-113c.md`](./ui/d2client-npc-menu-quest-gates-113c.md) | `D2Client.dll` `0x6FBA3BA0`, `0x6FBA2330`, `0x6FAF5CC0` | NPC 菜单静态项与 9 项任务门控动态项（东行/远航、雇佣、注入、打孔、刻名、泰瑞尔前往哈洛加斯等）。 |
| [`ui/d2client-barkscroll-scroin-113c.md`](./ui/d2client-barkscroll-scroin-113c.md) | `D2Client.dll` `0x6FB2C9F0`, `D2Gdi.dll` (`scroin*.dc6`) | A1Q3 艾尼弗斯卷轴 / 凯恩石柱开启顺序弹窗 (`scroin.dc6`..`scroin3.dc6`) 握手、符文发光动画与编号坐标偏移 (Issue #1622)。 |
| [`ui/d2client-quest-log-slots-113c.md`](./ui/d2client-quest-log-slots-113c.md) | `D2Client.dll` `0x6FACF1E0..0x6FACF73C`, `0x6FBA8100` | 任务面板（`Q` 键）6 图标槽位精确坐标（97px 步进）、`questsockets.dc6` 凹槽边框叠加与点击矩形 (Issue #914)。 |
| [`ui/d2client-quest-log-true-tomb-symbol-113c.md`](./ui/d2client-quest-log-true-tomb-symbol-113c.md) | `D2Client.dll` `0x6FACC740`, `0x6FACF46C` (`invps.dc6`) | A2Q6 塔拉夏真古墓符号 7 帧图标在任务面板第 7 页 (`qstsa2q61a`) 的调制混合绘制门控 (Issue #1008)。 |
| [`ui/d2client-useitem-imbue-socket-orifice-113c.md`](./ui/d2client-useitem-imbue-socket-orifice-113c.md) | `D2Client.dll` `0x6FB4F400..0x6FB50480` (`UI\useitem.cpp`) | 单格放入窗口：模式 0 赫拉迪姆杖孔洞 (`C2S 0x44`) 与模式 1 恰西注入/拉苏克打孔/安雅刻名 (`C2S 0x38`)。 |
| [`ui/d2client-vendor-stash-gold-display.md`](./ui/d2client-vendor-stash-gold-display.md) | `D2Client.dll` `0x6FB3CFB0` (`HUD_DrawPanelGoldBox`) | 储藏箱、物品栏与商人商店底部金币框数值读取、右对齐排版与按钮显隐门控。 |
| [`ui/d2client-player-trade-flow-113c.md`](./ui/d2client-player-trade-flow-113c.md) | `D2Client.dll` `0x6FB094C0..0x6FB0A230`; `D2Game.dll` `0x6FC90750..0x6FC927C0` | 玩家面对面交易完整状态机：请求弹窗 (`0x77`)、双栏面板 (`0x78`)、交易格同步、物品变动重置绿勾与防满包原子交换。 |
| [`ui/d2client-player-corpse-pickup-113c.md`](./ui/d2client-player-corpse-pickup-113c.md) | `D2Game.dll` `0x6FC7FBD0`; `D2Client.dll` `0x6FB01E80`, `0x6FB55440` | 玩家尸体 (`UNIT_PLAYER`) 同步、悬停优先级 `+1` 与点击拾取距离门控 (Issue #922)。 |
| [`ui/d2game-player-busy-gate-113c.md`](./ui/d2game-player-busy-gate-113c.md) | `D2Game.dll` `PLAYER_IsBusy`, `D2Client.dll` `0x6FB5A380` | 服务端 `PLAYER_IsBusy` 门控：关闭小站/储物箱/方块/NPC/交易面板时必须发送对应释放包，否则后续拾取与祭坛交互失效 (Issue #920)。 |
| [`ui/d2multi-join-game-panel-113c.md`](./ui/d2multi-join-game-panel-113c.md) | `D2Multi.dll` `0x6F9E3280`, `D2MCPClient.dll` `0x6FA26280` | 多人大厅加入游戏面板拼接布局、控件表与 `MCP_GAMEINFO (0x06)` 房间玩家详情解析。 |

---

## 8. 技能与弹道系统 (`skills/`, `missile-velocity-range-113c.md`)

### 8.1 分发总表、公式字节码与核心机制 (13 份)
- [`skills/d2-skills-missiles-dispatch-tables.md`](./skills/d2-skills-missiles-dispatch-tables.md): 全职业与怪物技能分发函数表 (`gpSkillSrvStartFnTable`, `gpSkillSrvDoFnTable`, `g_apfnSkillCltStFunc`, `g_apfnSkillCltDoFunc`, `g_apfnMissileCltDoFunc`, `g_apfnMissileCltHitFunc`) 及通用玩家动作。
- [`skills/d2common-skillcalc-callbacks-113c.md`](./skills/d2common-skillcalc-callbacks-113c.md): `Fog #10253` 公式字节码求值器、73 项 `SkillCalc` / 43 项 `MissCalc` 回调、`dm` 收益递减、`edmn`/`edmx` 元素协同、`enma`/`exma` 元素支配与 `oskill` 自身职业 `+3` 封顶规则。
- [`skills/skill-mana-start-do-nocost-113c.md`](./skills/skill-mana-start-do-nocost-113c.md): `Skills.txt` `startmana` 起手门槛、`usemanaondo` 关键帧扣蓝（引导技能按帧消耗）与 `nocostinstate` 免蓝状态机制。
- [`skills/d2-skill-hotkeys-selectskill-respec-113c.md`](./skills/d2-skill-hotkeys-selectskill-respec-113c.md): 技能快捷键 (`0x51`/`0x7B`)、服务端 `SelectSkill (0x3C)` 校验、`#10302` 等级归零摘除节点、阿卡拉/赦免徽章洗点 (`0x6FCC1280`) 与客户端槽位可选门控 (Issue #1490)。
- [`skills/aura-srvdo-stat-routing-113c.md`](./skills/aura-srvdo-stat-routing-113c.md): 服务端光环函数 (`SrvDo065` vs `SrvDo066`/`SrvDo081`) 施法者 `passivestat` 与受众 `aurastat` 分离路由规范 (Issue #1409)。
- [`skills/aura-target-filter-113c.md`](./skills/aura-target-filter-113c.md): 光环径向扫描 (`0x6FCC0C70`)：`aurarangecalc` 半径平方判定与 `aurafilter` 掩码位过滤规范 (Issue #1410)。
- [`skills/client-state-ids-113c.md`](./skills/client-state-ids-113c.md): 客户端技能预测使用的真实 `States.txt` 行号 (`blaze 13`、`conviction 28`、`stunned 21`、`progressive_* 122..127` 等) 与持续帧。
- [`skills/s2c-0xa3-cltprgfunc-dispatch-113c.md`](./skills/s2c-0xa3-cltprgfunc-dispatch-113c.md): `S2C 0xA3` 触发客户端 `Skills.txt` `cltprgfunc` 刺客聚气释放特效分发规范（`0x6FB5EFB0`）。
- [`skills/d2client-cltdofunc25-ring-113c.md`](./skills/d2client-cltdofunc25-ring-113c.md): `SkillCltDoFunc 25` (`0x6FB23CB0`) 64 向圆环弹道生成（霜之新星、新星、剧毒新星、战吼家族、暗黑火环等）。
- [`skills/missile-clthit31-icebreak-melt.md`](./skills/missile-clthit31-icebreak-melt.md): 冰冻碎裂 (`shatter=1`) 冰片飞溅与 `MissCltHitFunc[31]` (`0x6FB605B0`) 落地生成 `icebreak*melt` 融水动画规范 (Issue #1453)。
- [`skills/player-srvdo-missile-volleys-113c.md`](./skills/player-srvdo-missile-volleys-113c.md): 玩家 `srvdofunc` 多弹道齐射与特殊发射器（多重箭/牙、炮轰、充能弹、火焰风暴/龙卷风、骨墙、陨石、刀刃之怒等，Issue #1417）。
- [`skills/skill-damage-pct-calc-113c.md`](./skills/skill-damage-pct-calc-113c.md): `SrcDam` 武器攻击技能伤害加成百分比 (`dwEnDmgPct`) 按各 `srvstfunc`/`srvdofunc` 精确选择对应 `calc` 列或协同公式规范 (Issue #1418)。
- [`missile-velocity-range-113c.md`](./missile-velocity-range-113c.md): 投射物初速 `Vel + lvl * VelLev / 8`、`8.16` 定点截断步进、`Accel` 加速度、减速箭缩放、`Range + lvl * LevRange` 帧寿命与 `SubLoop` 循环帧校准 (Issue #1421)。

### 8.2 弹道与特效机制 (`skills/missiles/`, 7 份)
- [`skills/missiles/d2game-missile-srv-tables-113c.md`](./skills/missiles/d2game-missile-srv-tables-113c.md): 服务端弹道三张核心分发表（`pSrvDoFunc` 每帧推进、`pSrvHitFunc` 碰撞命中、`pSrvDmgFunc` 伤害修正）全表映射与 680 行 `Missiles.txt` 绑定规范。
- [`skills/missiles/d2game-srvhit01-fireball-113c.md`](./skills/missiles/d2game-srvhit01-fireball-113c.md): `MISSMODE_SrvHit01` (`0x6FC5B990`) 火球爆炸 1:1：单次伤害包 `0x6FC5A280`/`0x6FC59B40`（弹道自身 min/max + 专精，`min + RollLimited(弹道种子, max-min)`）、`HitFlags`/`ResultFlags` 合并、`0x6FCC0C70` 半径扫描（滤镜 `0x8583`，含被直接命中单位）与撞击停点；`SrvHitDispatch` 默认接触（火墙制造者 0 伤害包、LastCollide）、`SrvDmg03` 地面火（弹道种子两次抽取、软击 `0x4000`、1/256 血量）、弹道 LIFO 帧序、16.16 方向与 `SrvDo06` 步进门。
- [`skills/missiles/d2game-srvhit-radius-113c.md`](./skills/missiles/d2game-srvhit-radius-113c.md): 服务端弹道 `gpMissileSrvHitFnTable` (`0x6FD2DA48`, 59 项 `pSrvHitFunc`) 命中爆炸/溅射/弹跳半径解析（`sHitPar1`、`dHitPar1` 与 `Skills.txt` `aurarangecalc`/`calc1`/`calc2` 等轴测地面半径，Issue #1457）。
- [`skills/missiles/d2game-srvdo-06-23-30-druid-113c.md`](./skills/missiles/d2game-srvdo-06-23-30-druid-113c.md): 服务端弹道 `SrvDo 6` 与 `23..30`（熔岩巨石/火焰风暴尾迹、火山裂口、藤蔓、龙卷风周期范围伤害、火山喷发与狂犬病传染归属，Issues #1224–#1228）。
- [`skills/missiles/missile-collision-113c.md`](./skills/missiles/missile-collision-113c.md): `g_aMissileCollideTypes[9]` (`0x6FD2D928`) 碰撞掩码表、敌我单位过滤回调 (`0x6FC58FB0`) 与 `Size` 占地足迹重叠检测 (`0x6FDCF6A0`, Issue #1422)。
- [`skills/missiles/missile-pierce-113c.md`](./skills/missiles/missile-pierce-113c.md): 弹道穿透 `pierce_idx` (`stat 328`)：弹道创建期最多 4 次 `SEED_Rand % 100 < item_pierce + skill_pierce` 掷骰 (`0x6FC8F660`) 与命中单位时的递减消耗 (`0x6FC58F40`, Issue #1420)。
- [`skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md`](./skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md): 巫师陨石客户端 3D 下落轨迹 (`CltDoFunc=9`)、撞击闪光、震屏与 18 块地面火分散生成机制。

### 8.3 怪物与 Boss 技能 (`skills/bosses/`, 4 份)
- [`skills/bosses/d2game-boss-skill-slvl-hitshift-nova-parity-113c.md`](./skills/bosses/d2game-boss-skill-slvl-hitshift-nova-parity-113c.md): `MONSTER_InitSkills` (`0x6FCD019B`) 怪物注册技能等级难度加成、`HitShift` 精度缩放与 `SrvDo022` 环形新星弹道语义。
- [`skills/bosses/skills-boss-act1-act2-act3.md`](./skills/bosses/skills-boss-act1-act2-act3.md): 第一幕至第三幕关卡 Boss 与超级暗金怪技能（安达利尔、血鸟、女伯爵、格瑞斯华尔德、母牛之王、拉达蒙特、召唤者、督瑞尔、议会成员、墨菲斯托）。
- [`skills/bosses/skills-boss-act4-diablo.md`](./skills/bosses/skills-boss-act4-diablo.md): 第四幕 Boss 与混沌避难所封印怪（衣卒尔、海法斯特、暗黑破坏神、暗黑克隆体）。
- [`skills/bosses/skills-boss-act5-baal-ubers.md`](./skills/bosses/skills-boss-act5-baal-ubers.md): 第五幕关卡 Boss 与地狱火三魔神（山克、尼拉塞克、三野蛮人、巴尔、超级墨菲斯托/暗黑/巴尔、莉莉丝、超级督瑞尔/衣卒尔）。

### 8.4 玩家职业技能树 (`skills/player/`, 21 份文档 / 210 项技能)
- **亚马逊 (Amazon)**:
  - [`skills/player/skills-ama-bow-crossbow.md`](./skills/player/skills-ama-bow-crossbow.md) — 弓与十字弓技能 (Magic Arrow, Multiple Shot, Guided Arrow, Strafe 等)
  - [`skills/player/skills-ama-passive-magic.md`](./skills/player/skills-ama-passive-magic.md) — 被动与魔法技能 (Inner Sight, Dodge, Avoid, Evade, Valkyrie, Pierce 等)
  - [`skills/player/skills-ama-javelin-spear.md`](./skills/player/skills-ama-javelin-spear.md) — 标枪与长矛技能 (Jab, Power Strike, Charged Strike, Lightning Fury 等)
- **刺客 (Assassin)**:
  - [`skills/player/skills-ass-martial-arts.md`](./skills/player/skills-ass-martial-arts.md) — 武术技能 (Tiger Strike, Dragon Talon, Phoenix Strike 等)
  - [`skills/player/skills-ass-shadow-disciplines.md`](./skills/player/skills-ass-shadow-disciplines.md) — 暗影修行 (Burst of Speed, Fade, Weapon Block, Shadow Master 等)
  - [`skills/player/skills-ass-traps.md`](./skills/player/skills-ass-traps.md) — 陷阱技能 (Fire Blast, Lightning Sentry, Death Sentry 等)
- **野蛮人 (Barbarian)**:
  - [`skills/player/skills-bar-combat.md`](./skills/player/skills-bar-combat.md) — 战斗技能 (Bash, Leap Attack, Concentrate, Frenzy, Whirlwind 等)
  - [`skills/player/skills-bar-masteries.md`](./skills/player/skills-bar-masteries.md) — 战斗专家 (Sword Mastery, Iron Skin, Natural Resistance 等被动机制)
  - [`skills/player/skills-bar-warcries.md`](./skills/player/skills-bar-warcries.md) — 战吼技能 (Howl, Shout, Battle Orders, Battle Command, War Cry 等)
- **德鲁伊 (Druid)**:
  - [`skills/player/skills-dru-elemental.md`](./skills/player/skills-dru-elemental.md) — 元素技能 (Firestorm, Fissure, Tornado, Hurricane, Armageddon 等)
  - [`skills/player/skills-dru-shapeshifting.md`](./skills/player/skills-dru-shapeshifting.md) — 变形技能 (Werewolf, Werebear, Feral Rage, Fury 等)
  - [`skills/player/skills-dru-summoning.md`](./skills/player/skills-dru-summoning.md) — 召唤技能 (Raven, Oak Sage, Spirit Wolf, Summon Grizzly 等)
- **死灵法师 (Necromancer)**:
  - [`skills/player/skills-nec-curses.md`](./skills/player/skills-nec-curses.md) — 诅咒技能 (Amplify Damage, Iron Maiden, Decrepify, Lower Resist 等)
  - [`skills/player/skills-nec-poison-bone.md`](./skills/player/skills-nec-poison-bone.md) — 毒素与白骨技能 (Teeth, Corpse Explosion, Bone Spear, Bone Spirit, Poison Nova 等)
  - [`skills/player/skills-nec-summoning.md`](./skills/player/skills-nec-summoning.md) — 召唤技能 (Raise Skeleton, Clay Golem, Iron Golem, Revive 等)
- **圣骑士 (Paladin)**:
  - [`skills/player/skills-pal-combat.md`](./skills/player/skills-pal-combat.md) — 作战技能 (Smite, Charge, Blessed Hammer, Holy Shield, Zeal 等)
  - [`skills/player/skills-pal-defensive-auras.md`](./skills/player/skills-pal-defensive-auras.md) — 防御灵气 (Prayer, Cleansing, Defiance, Vigor, Salvation 等)
  - [`skills/player/skills-pal-offensive-auras.md`](./skills/player/skills-pal-offensive-auras.md) — 攻击灵气 (Might, Holy Fire, Thorns, Blessed Aim, Fanaticism, Conviction 等)
- **巫师 (Sorceress)**:
  - [`skills/player/skills-sor-cold.md`](./skills/player/skills-sor-cold.md) — 冰冻法术 (Ice Bolt, Frost Nova, Blizzard, Frozen Orb, Cold Mastery 等)
  - [`skills/player/skills-sor-fire.md`](./skills/player/skills-sor-fire.md) — 火焰法术 (Fire Bolt, Warmth, Fire Ball, Meteor, Hydra, Fire Mastery 等)
  - [`skills/player/skills-sor-lightning.md`](./skills/player/skills-sor-lightning.md) — 闪电法术 (Charged Bolt, Static Field, Teleport, Nova, Chain Lightning, Lightning Mastery 等)

---

## 9. 渲染层级、调色板光照与屏幕震动 (`render/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`render/d2client-tile-layer-order-113c.md`](./render/d2client-tile-layer-order-113c.md) | `D2Client.dll` `0x6FB2A72E`, `0x6FB3B110`; `D2Common.dll` `#10916` | 墙壁按 `nTileType` 分流（`16..19` 下层悬崖壁先于地板绘制）、上层墙遮挡玩家淡出与 POPS 屋顶/建筑揭开规范 (Issues #919, #1009)。 |
| [`render/dt1-material-flags-animated-113c.md`](./render/dt1-material-flags-animated-113c.md) | `D2Common.dll` `0x6FD62F20`; `D2CMP.dll` `#10051` (`0x6FE25300`) | DT1 `+0x06` `u16` 材质标志位：仅 `TILE_FLAGS_LAVA` (`0x100`) 为循环动画地板，消除 Act 5 雪地随机变体闪烁 (Issue #923)。 |
| [`render/d2gfx-draw-mode-113c.md`](./render/d2gfx-draw-mode-113c.md) | `D2Client.dll` `0x6FB1B11D`; `D2gfx.dll` `#10041`; `D2Direct3D.dll` `0x6F886B90` | `Overlay.txt` `Trans` 恒等映射为 `eDrawMode`，`Missiles.txt` `Trans 0/1/2 -> 5/3/4` 及 D3D 透明/加法/乘法混合状态 (Issues #1050–#1055)。 |
| [`render/d2client-drawmode-113c.md`](./render/d2client-drawmode-113c.md) | `D2Client.dll` `0x6FB633F7`, `0x6FB23CB0`, `0x6FB50DB0` | `eDrawMode` 汇总、客户端弹道视觉帧速 `AnimSpeed << 4`、`CltDoFunc 25` 64 环与 `States.txt` `castoverlay` 交接 `overlay1/2` 规范 (Issue #1057)。 |
| [`render/d2client-unit-light-records-113c.md`](./render/d2client-unit-light-records-113c.md) | `D2Client.dll` `0x6FAC92F5`, `0x6FAD0510`, `0x6FB63647`, `0x6FB1B360` | 单位光源记录（玩家 `13 + stat 89` 与 `stat 90` 光色、怪物/头目随机三原色光、弹道光源与状态叠加层 `InitRadius -> Radius`）规范 (Issues #830, #878)。 |
| [`render/d2win-pl2-layout-state-colorshift-113c.md`](./render/d2win-pl2-layout-state-colorshift-113c.md) | `D2Win.dll` `0x6F8EEF20`, `#10164`; `D2Client.dll` `0x6FB22130` | `PL2` 运行时内存偏移（`0x53500` 连续 128 张色相表）、`States.txt` `colorshift` 最高 `colorpri` 抢占染色及本地玩家 3D 模式抑制中毒绿染规则。 |
| [`render/d2cmp-direction-tables-113c.md`](./render/d2cmp-direction-tables-113c.md) | `D2CMP.dll` `0x6FE2E7D8..0x6FE2EBD8`, `0x6FE2F7D8..0x6FE2FBD8` | 64 逻辑方向至 `4/8/16/32/64` 向 DCC（置换顺序）与 COF（线性顺序）方向映射表（全部 640 项对齐）。 |
| [`render/d2gfx-gamma-contrast-113c.md`](./render/d2gfx-gamma-contrast-113c.md) | `D2gfx.dll` `0x6FA8AEE0`; `D2Direct3D.dll` `0x6F88A640`; `Fog.dll` `#10198` (`0x6FF712C0`) | 默认 Gamma (`155`) / Contrast (`100`) 配置项与 `Fog #10198` 构建 256 项 16 位硬件 Gamma 查找斜坡公式。 |
| [`render/d2client-hittest-overlay-height-shake-113c.md`](./render/d2client-hittest-overlay-height-shake-113c.md) | `D2Client.dll` `0x6FB568E0`, `0x6FB1B300`, `0x6FB3AD30`; `D2Common.dll` `#10172` | 单位悬停 COF 头部包围盒命中测试、叠加层 `Height` 垂直偏移、阴影抑制标志 (`0x20` / `state 146`) 与全量屏幕震动触发源及督瑞尔死亡时刻表。 |
| [`render/d2client-client-tables-units-113c.md`](./render/d2client-client-tables-units-113c.md) | `D2Client.dll` (`states.bin` `setfunc`/`remfunc`, `Objects ClientFn`, `Shrine` tables) | 客户端状态挂载/移除回调表、场景物件 `ClientFn` 视觉特效表与神殿/调色板辅助表审计。 |

---

## 10. 音效表、环境音/音乐切换与声音记录层 (`audio/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`audio/d2gs-0x2c-playsound-113c.md`](./audio/d2gs-0x2c-playsound-113c.md) | `D2Client.dll` `0x6FB5D740` (`0x2C`), `0x6FB5D760` (`0xA4`), `0x6FAD3F20`, `0x6FAD3200` | `S2C 0x2C PlaySound` 的 `u16` 字段为声音事件码而非 `Sounds.txt` 行号（含 7 职业 22 槽位语音表）；`S2C 0xA4 MonsterSpecialSkill` 不播放任何声音 (Issue #944)。 |
| [`audio/sound-records-113c.md`](./audio/sound-records-113c.md) | `D2Client.dll` `0x6FB0E8E1`, `0x6FB38A70`, `0x6FB38DD0`, `0x6FB0CE70`; `D2sound.dll` | `Sounds.txt` 4,699 行载入后处理、200 条声音记录池、Compound 变体选取、屏幕坐标衰减、2-tick 同 ID 去抖与 `4 立体声 + 12 单声道` 通道抢占规范 (Issue #943)。 |
| [`audio/d2client-soundenviron-music-areaspeech-113c.md`](./audio/d2client-soundenviron-music-areaspeech-113c.md) | `D2Client.dll` `0x6FAFF860` (`SoundEnvironTick`), `0x6FAF5660`, `0x6FAD3E20` | `SoundEnviron.txt` 昼夜交叉淡入淡出（250 tick）、雨声强度门控与随机雷声、BGM 75-tick 房间防抖与断点续播，以及 14 个区域首次进入职业独白语音表。 |
