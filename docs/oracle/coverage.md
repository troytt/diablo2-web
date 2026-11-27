# Oracle 覆盖率基线（Diablo II LoD 1.13c 服务端复刻）

> 统计日期：2026-11-05，M23 收尾（分支 `feat/oracle-closeout`，基于 `main` @ `cb807325`）。
> 本文档是"服务端复刻完成度"的统一度量；每完成一个里程碑（M23 起）都要重新计数并更新本页。
> 所有数字都可以复现，计数方法见文末"计数方法"一节。

## 1. 总表

| 维度 | Oracle 已覆盖（逐帧差分） | 原版全量 | 覆盖率 |
|---|---|---|---|
| 关卡 | 2：`1` Rogue Encampment、`2` Blood Moor | 136（Act1 39 / Act2 35 / Act3 28 / Act4 6 / Act5 28） | 1.5% |
| 难度 | 普通（`difficulty = 0`） | 3 | 1/3 |
| 地图种子 | 1（`seed = 12345`，所有场景同一张图） | 任意 | — |
| 游戏模式 | 单人，玩家数 1 | 多人、组队、`/players N`、PvP | — |
| 怪物类（出现在 golden trace 中） | 14：`zombie1`、`fallen1`、`quillrat1`、6 个城镇 NPC、`rogue1`、`cow`、`roguehire`、`claygolem`、`valkyrie`、`necroskeleton` | `MonStats.txt` 734 行（`enabled = 1` 的 703 行） | 2.0% |
| MonAI | 已移植并逐帧验证 5 个：`Zombie`、`NecroPet`（近战与跟随；`PetMove` 状态 1/3/5、远程分支未移植）、`Hireable`、`Npc`、`Idle` | `MonAI.txt` 148 行；启用怪物实际用到 144 种 | 3.4% |
| 技能（实机场景里主动选用） | 21 个（见 §3） | 玩家技能 210 / `Skills.txt` 357 行 | 10% |
| 技能（公式层） | 210 个玩家技能 × 等级 1..60 全部一致（`P5-formula-sweep.md`） | 210 | 100% |
| 任务 | 0 | 27（6 / 6 / 6 / 3 / 6） | 0% |
| C2S 封包类型（场景输入） | 6 种：`0x01`、`0x03`、`0x06`、`0x0C`、`0x0D`、`0x3C` | 游戏内处理器 91 个（`0x01..0x66` 去掉 11 个空槽，`kb/network/d2gs-c2s-dispatch-and-sizes-113c.md`） | 6.6% |
| S2C 封包 | 未纳入 Oracle trace（trace 记录的是服务端状态，不是封包） | `0x00..0xAF` | 0% |
| 函数映射（`function-map.md`） | 48 行：38 diff-verified、7 diff-observed、2 unverified、1 驱动 | D2Game + D2Common 数千个函数 | — |
| 逆向规范（`kb/`） | 179 篇 | — | — |

## 2. Golden 场景逐帧对齐

14 个场景，共 23,050 帧，已对齐 18,731 帧（81.3%）。新增的 Act 1 场景 `a1c-bloodmoor-fallen` 让分母变大，见 [`act1-plan.md`](./act1-plan.md)。

| 场景 | 总帧 | 已对齐 | 状态 / 第一处分歧 |
|---|---:|---:|---|
| `a1-bloodmoor-melee` | 1800 | 1800 | 全长零分歧 |
| `a1-town-walk` | 750 | 750 | 全长零分歧 |
| `p52-dot-ticks` | 1200 | 1200 | 全长零分歧 |
| `p52-item-defense` | 1600 | 1600 | 全长零分歧 |
| `p52-paladin-auras` | 1700 | 1700 | 全长零分歧 |
| `p52-paladin-merc-aura` | 1700 | 1700 | 全长零分歧 |
| `p52-sorceress-elemental` | 1800 | 1800 | 全长零分歧 |
| `p52-sorceress-fire-dot` | 1800 | 1800 | 全长零分歧 |
| `p52-necromancer-curses` | 2000 | 1516 | F1517 骷髅 #14 最大生命 757.5 vs 757.0（骷髅初始化 `0x6FC6E960` 未移植） |
| `p52-amazon-defense` | 1800 | 1225 | F1226 僵尸 #10 模式；F1206 一次未命中挥击玩家种子多抽 3 次，来源未明 |
| `p52-barbarian-warcries` | 1600 | 1104 | F1105 玩家坐标 y 差 1 |
| `p52-amazon-valkyrie` | 1500 | 989 | F990 女武神 y 差 1；F988 宠物种子多抽 1 次（`PetMove` 状态 1 未移植） |
| `p52-necromancer-poison-golem` | 1800 | 859 | F860 剧毒新星导弹提前 1 帧命中僵尸 #10 |
| `a1c-bloodmoor-fallen` | 2000 | 688 | F689 房间刷怪：Fallen 群第 4 只（#15，队长 #12 旁 (-2,+3)）在复刻中没有放下，游戏种子随之分歧 |

## 3. 实机场景主动选用的技能（21 个）

`32` Valkyrie、`41` Inferno、`47` Fire Ball、`51` Fire Wall、`53` Chain Lightning、`55` Glacial Spike、
`64` Frozen Orb、`66` Amplify Damage、`70` Raise Skeleton、`72` Weaken、`75` Clay Golem、`87` Decrepify、
`91` Lower Resist、`92` Poison Nova、`103` Thorns、`113` Concentration、`122` Fanaticism、`138` Shout、
`149` Battle Orders、`154` War Cry、`155` Battle Command。

另有被动技能（亚马逊的 Critical Strike / Dodge / Avoid / Evade 等）和佣兵技能（Inner Sight、Cold Arrow）在场景中生效，
但没有单独选用。

## 4. 公式层与客户端显示

| 类别 | golden 行数 | 已知不一致 |
|---|---:|---:|
| anim | 27,084 | 0 |
| block | 24,630 | 0 |
| dmg | 4,726 | 0 |
| exp | 24,823 | 0 |
| frames | 20,853 | 0 |
| hit | 11,090 | 0 |
| primitives | 19,715 | 0 |
| resist | 16,314 | 0 |
| skilleval | 4,818 | 0 |
| skills | 6,791 | 0 |
| stats | 25,244 | 0 |
| steal | 19,942 | 0 |

golden 文件里是抽样后的向量；harness 全量扫描（约 800 万个值）的一致率见 `P5-formula-sweep.md`。

客户端显示（P5.4）：9 组面板 golden，每组 90..111 个字段，`client-ui-known-mismatches.json` 为空。

## 5. 各幕范围（用于 M24..M28）

怪物类按 `Levels.txt` 的 `mon1..10` / `nmon1..10` / `umon1..10` 统计，不含预设 Boss 与 SuperUnique。

| 幕 | 关卡 | 怪物类 | 需要的 MonAI | 已移植 | 任务 |
|---|---:|---:|---:|---|---:|
| Act1 | 39 | 57 | 19 + 预设 5（`Andariel`、`BloodRaven`、`Griswold`、`Smith`、`NpcOutOfTown`） | `Zombie` | 6 |
| Act2 | 35 | 58 | 24 + 预设（`Duriel`、`Summoner`、`SandMaggotQueen` 等） | `Zombie` | 6 |
| Act3 | 28 | 57 | 29 + 预设（`Mephisto`、`HighPriest` 等） | `Zombie` | 6 |
| Act4 | 6 | 21 | 13 + 预设（`Izual`、`Diablo` 等） | 无 | 3 |
| Act5 | 28 | 174 | 54 + 预设（`BaalCrab`、`Nihlathak`、`Ancient` 等） | 无 | 6 |

Act1 需要新移植的 MonAI（括号内为使用该 AI 的怪物类数）：
`Fallen`(4)、`QuillRat`(4)、`CorruptRogue`(4)、`FallenShaman`(4)、`Skeleton`(4)、`Goatman`(4)、`CorruptArcher`(4)、
`SkeletonMage`(4)、`Bighead`(4)、`Brute`(3)、`CorruptLancer`(3)、`SkeletonBow`(3)、`FoulCrowNest`(2)、`BloodHawk`(2)、
`Wraith`(2)、`Fetish`(1)、`Arach`(1)、`Vampire`(1)，以及预设的 `Andariel`、`BloodRaven`、`Griswold`、`Smith`、`NpcOutOfTown`。

## 6. 代码规模

| 项 | 数值 |
|---|---:|
| `src/server` TS 文件 / 行数 | 333 / 152,917 |
| `src/common` TS 行数（含生成的数据表） | 550,827 |
| 文件名带 `113c` 的移植模块（不含生成表）/ 行数 | 70 / 50,987 |

"带 `113c` 的模块"只是移植代码的近似口径：有些 1:1 移植写在老文件里，也有一些 `113c` 文件只是部分移植。

## 7. 进度指标

后续统一用这两个比例汇报进度，不再用笼统的百分比：

1. **函数映射验证率** = diff-verified 行数 / function-map 登记行数（当前 38 / 48）。
2. **场景对齐率** = 已对齐帧数 / 计划场景总帧数（当前 18,731 / 23,050；每新增一个里程碑的场景，分母都会变大）。

## 8. 计数方法

- 关卡、怪物、MonAI、技能、SuperUnique：从 MPQ 读取 `Levels.txt`、`MonStats.txt`、`MonAI.txt`、`Skills.txt`、`SuperUniques.txt`
  （`src/baker/mpq-archive-source.ts` 的 `getSharedMountedArchives().readText(...)`），去掉 `Expansion` 分隔行和空行。
- 关卡与怪物类的"已覆盖"：遍历 `tests/fixtures/oracle/golden/*.oracle.ndjson.gz` 的每一帧，取 `t0`（玩家）和 `t1`（怪物）的
  `level` 字段（unit field 第 8 列）以及 `class` 字段。`a1-town-walk` 第 2 帧玩家的 level 字段是加载过程中的临时值 30，不计入。
- 技能与 C2S 类型：解析 `tests/fixtures/oracle/scenarios/*.json` 的 `inputs`；`0x3C` 的第 1..2 字节（小端）是技能 id。
- 场景对齐：`parity-baseline.json` 的值减 1（以总帧数为上限），与 `tools/oracle/parity-report.ts` 的输出一致。
- function-map：统计 `docs/oracle/function-map.md` 中以 `| D2` / `| Fog` 开头的表格行，按最后一列的状态分类。
- 代码行数：`git ls-files` 列出文件后逐个计行。
