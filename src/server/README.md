# `src/server` — 1.13c 权威游戏模拟引擎 (`D2Game.dll`) / 1.13c Authoritative Game Simulation Engine (`D2Game.dll`)

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

> [!WARNING]
> **服务端开发状态与运行模式说明（Current Status & Deployment Mode）**：
> `src/server`（共 **325 个 TypeScript 源码文件，约 14.1 万行代码**，配套 **164 套服务端测试 + 6 套 Wine 原生 DLL 差分 Oracle 测试**）已完成 25fps `GameInstance` 权威帧循环、**100.00% 1.13c 公式级对齐**（覆盖 12 大类、357 行 `Skills.txt`、801.7 万个比对值）、**100.0% 面板/技能树数值对齐**、7 职业 221 项技能、5 幕主线任务与超级崔斯特瑞姆（Pandemonium）、`.d2s` v96 存档读写，以及浏览器内单机回环适配器（`LocalLoopbackAdapter` + `LocalLobbyProvider`）与 1–8 人房间宿主（`MultiClientRoomHost`）。
> **但 `src/server` 目前仍处于实验完善阶段，尚未替代原版战网服务端闭环**：（1）不包含独立的 Node.js `BNCS (:6112)` / `MCP (:6113)` / 多房间 `D2GS (:4000)` 守护进程；（2）野外怪物 AI 决策时序与约 233 处共享 `GameInstance.rng` 调用点导致帧级严格锁步（Frame-Exact Lockstep）目前对齐至第 **60–66 帧**；（3）全五幕三难度（Normal $\rightarrow$ Hell）带毕业词缀/佣兵光环的长程回归审计仍在进行中。
> 因此，线上门户默认通过部署配置将内置单机入口关闭（`singlePlayerEnabled: false`），**完整联机体验请按照[根目录 `README.md`](../../README.md) 使用单客户端模式（Single-Client Mode）连接原版 C++ PvPGN + D2GS (v1.13c) 服务器**；本地开发调试可通过 `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev` 开启内置单机回环模式。

`src/server` 是 **Diablo II: Lord of Destruction (v1.13c)** 的确定性服务端权威模拟模块，对标原版 `D2Game.dll`（及服务端调用的 `D2Common.dll` 算子），负责 25fps（`40ms/tick`）世界模拟、战斗伤害结算、全职业技能与弹道执行、怪物/佣兵/召唤物 AI、五幕任务状态机、TreasureClass 掉落管线、赫拉迪克方块合成、玩家面对面交易与 `.d2s` 存档持久化。

---

### 1. 模块职责与架构边界

- **对应原版 DLL**：`D2Game.dll`（配合 `src/common` 中的 `D2Common.dll` 共享算子）。
- **TypeScript 工程约束（`tsconfig.server.json`）**：
  - `lib: ["ES2022", "WebWorker"]`, `types: []` —— **纯同构模块，严禁使用任何浏览器 DOM API 或 Node.js 内置模块（`node:net`、`fs`、`Buffer` 等）**，由 [`tests/arch/boundaries.test.ts`](../../tests/arch/boundaries.test.ts) Rules 3 & 4 强制门禁校验。
  - **确定性模拟约束（Deterministic Simulation）**：严禁调用 `Math.random`、`Date.now` 或 `performance.now`；随机性由 64 位进位乘法种子生成器（`D2Rng` / 单位级 `D2SeedStrc`）驱动，时间推进由 25fps 离散帧号（`tickCount`）驱动。
  - **单向依赖边界**：仅依赖 `src/common` 与 `src/netproto`（唯一门面入口 `src/netproto/index.ts`），严禁导入 `src/client`、`src/baker` 或 `plugins/`。客户端通过 `play.html` 外部模块脚本加载 `src/server/loopback-adapter.ts` 向 `src/netproto` 注册单机钩子（`registerLocalLobbyProvider` / `registerLocalServerFactory`），保持 `src/client/**` 对 `src/server/**` 零导入。

---

### 2. 目录结构

```text
src/server/
├── index.ts             # 模块导出门面 (GameInstance, LocalLoopbackAdapter, LocalLobbyProvider, MultiClientRoomHost, .d2s 读写器)
├── engine.ts            # 顶层模拟引擎导出门面
├── loopback-adapter.ts  # LocalLoopbackAdapter & LocalLobbyProvider：将单机 GameInstance 封装为标准 GameServerAdapter 与 LobbyProvider 契约并向 src/netproto 注册默认钩子
├── room-host.ts         # MultiClientRoomHost：多客户端 (1..8 玩家) 25Hz 权威房间宿主，支持 TsFramer 与原生二进制 D2GS 双协议接入
├── net/                 # 多人房间网络同步层
│   ├── aoi.ts           # 基于房间邻域的视野过滤 (Area of Interest) 与跨层可见性裁剪
│   ├── party.ts         # 组队邀请/共享状态机 (0x5E / 0x8B / 0x8D) 与敌对关系位图 (0x5D / 0x8C)
│   ├── session.ts       # RoomClientSession：单连接协议自适应会话，解码 80 个 D2GS C2S 操作码并通过 serverEventToS2cPackets 编码全部 44 种 ServerEvent
│   └── trade-manager-113c.ts # 城镇玩家面对面安全交易状态机 (0x77/0x78/0x79) 与 10×4 网格满包预检原子提交/回滚
├── combat/
│   └── pvp-engine-113c.ts    # 1.13c PvP 敌对宣战门控、17% 玩家对玩家伤害折算、尸体生成与耳朵 (Ear) 掉落结算
├── engine/              # 25fps 核心模拟引擎与战斗/弹道底座
│   ├── game-instance.ts      # 唯一线上/单机权威运行时门面 (GameInstance)
│   ├── game-instance/        # 28 个领域子模块 (frame-and-commands, world-spawning-and-aoi, unit-seeds-113c, player-combat-and-vitals,
│   │                         #   player-skills-*, monster-combat-ai, monster-melee-attacks, monster-damage, monster-death-and-xp,
│   │                         #   boss-encounters-ai, mercenaries, summoned-pets, missiles-step, quests-objects-and-portals,
│   │                         #   npc-vendors-and-artisans, item-stats-and-drops, trade-party-and-progression, snapshots-and-d2s 等)
│   ├── combat-pipeline.ts    # SUnitDmg 1.13c 命中率、闪避/格挡、逐系伤害掷骰、抗性折算、吸收、吸血吸蓝、CB/DS/OW 结算管线
│   ├── missile-engine.ts     # 8.16 定点步进弹道引擎、CollideType 掩码、Size 足迹重叠、pSrvDoFunc / pSrvHitFunc 溅射半径
│   ├── missile-pierce.ts     # 创建期最多 4 次 pierce_idx (stat 328) 掷骰与命中穿透递减
│   ├── player-srvdo-113c.ts  # 玩家多弹道齐射与特殊 srvdofunc 发射器 (多重箭/炮轰/充能弹/龙卷风/陨石/火墙/骨墙等)
│   ├── aura-scanner.ts       # 周期性径向光环索敌、aurafilter 掩码过滤与施法者 passivestat / 受众 aurastat 分离路由
│   ├── quests-113c.ts        # 五幕 27 个主支线任务 + Quest 41 阿卡拉洗点 + 秘密奶牛关状态机与奖励发放
│   ├── anim-dispatcher.ts    # 基于 AnimData.d2 与武器类型 (WeaponClass) 的动作帧长与关键帧 (ActionFlag) 触发器
│   ├── difficulty-resist-penalty.ts # 普通/噩梦/地狱抗性惩罚与经验衰减常量
│   ├── stat-list.ts          # 单位基础/修正属性表 (UnitStatList) 与 StatOp 派生计算
│   ├── state-bus.ts          # 定时状态/诅咒互斥槽位 (Attract 防覆盖) 与脏状态收集总线
│   ├── state-hash.ts         # 确定性帧状态快照与哈希校验器 (用于锁步回放与 Oracle 比对)
│   ├── world-arena.ts        # 房间网格与空间索引辅助容器
│   └── game-engine.ts        # [Legacy] 早期测试专用轻量引擎，生产路径严禁实例化
├── ai/                  # 怪物、城镇 NPC、佣兵与召唤物 AI
│   ├── monster-ai.ts         # 129 项 gpMonsterAiFunctionTable 分发、精英词缀行为与五幕 Boss 专属 AI/死亡演出
│   ├── town-npc-ai-113c.ts   # 城镇 NPC 巡逻漫步状态机 (AI_Npc 0x6FC3DB40) 与玩家靠近停步朝向
│   ├── mercenary-ai.ts       # 四幕佣兵 (罗格/沙漠枪兵/铁狼/野蛮人) 索敌、技能施放与跟随 AI
│   ├── summon-manager.ts     # 死灵骷髅/石魔/复生怪、德鲁伊灵兽/藤蔓/乌鸦、亚马逊女武神、刺客影子/陷阱生命周期管理
│   ├── monumod-113c.ts       # MonUMod 精英/头目词缀随机抽取、抗性加成与死亡自爆/冰环/充能弹事件
│   ├── monprop-113c.ts       # MonProp.txt 怪物天生附带属性挂载
│   ├── monequip-helper-113c.ts # MonEquip.txt 怪物与女武神/影子装备按等级初始化
│   ├── monster-missile-damage-113c.ts # D2Common #10413 怪物远程弹道伤害与毒素 DoT 帧率换算
│   └── room-streamer.ts      # 围绕玩家九宫格动态激活/休眠 DRLG 房间并按 MonDen / SuperUniques 刷怪
├── skills/              # 七大职业共 221 个技能与怪物技能执行器 (共 247 个文件)
│   ├── registry.ts           # Skills.txt srvstfunc / srvdofunc 注册分发中心
│   ├── impl/                 # 按 amazon / assassin / barbarian / druid / necromancer / paladin / sorceress / shared 拆分的 229 个技能实现模块
│   ├── martial-dualwield-113c.ts / whirlwind-113c.ts / passives-procs-113c.ts / p1-wave4-skills-113c.ts # 聚气双持、旋风斩、被动/触发技专项模块
│   └── skills.ts             # [Legacy] 早期技能兼容层，新逻辑统一收敛至 skills/impl/*
├── items/               # 1.13c 掉落、方块合成、符文之语与赌博/注入管线
│   ├── drop-pipeline.ts & drop-generator.ts & auto-tc.ts # TreasureClassEx 递归寻路、NoDrop 缩放、MF 四级品质判定与同局暗金防重
│   ├── cubemain-data-113c.ts # 151 行 Cubemain.txt 数据表 (146 条启用配方)
│   ├── cube-engine-113c.ts   # C2S 0x28 镶嵌、Gems.txt gemapplytype、78 条 Runes.txt 符文之语激活与 0x4F 0x18 赫拉迪克方块合成
│   ├── imbue.ts              # A1Q3 恰西注入亮金装备与 StaffMods 生成
│   ├── ground-items.ts       # 地面掉落物存活计时、Flippy 归属保护与拾取校验
│   └── server-item-data.ts   # 服务端物品表索引与紧凑/完整物品构建辅助
├── world/               # 关卡引导、交互物件、神殿与终局事件
│   ├── area-bootstrap.ts     # 基于 DRLG 几何与 DS1 预设实体的区域初始化引导器
│   ├── shrines-113c.ts       # 22 种神殿 InitFn 1 随机挑选与 OperateFn 2 增益/恢复/怪物升格/宝石神殿效果
│   ├── object-drops-113c.ts  # 普通箱子、上锁箱、超级宝箱 (Super Chests)、水井与机关陷阱结算
│   ├── objgroup-113c.ts & objgroup-data-113c.ts # ObjGroup.txt 随机物件组密度与替换生成
│   ├── pandemonium-113c.ts   # 1.13c 地狱火炬终局事件：三把钥匙合成器官红门、莉莉丝/超级督瑞尔/超级衣卒尔与超级崔斯特瑞姆三魔神
│   └── quests.ts             # 世界任务事件辅助桥接
└── save/                # 原版 1.13c .d2s v96 二进制角色存档读写器
    ├── d2s-reader.ts         # 解析 0xAA55AA55 头、校验和、gf 属性比特流、if 技能、96B 任务位图、小站、NPC 问候与角色/尸体/佣兵/铁魔 JM 物品表
    ├── d2s-writer.ts         # 逐比特回写标准 v96 .d2s 二进制存档并重算循环移位校验和
    └── save.ts               # 存档快照转换门面
```

---

### 3. 当前实现状态与 1.13c Oracle 对齐矩阵

项目通过 [`tools/oracle/`](../../tools/oracle) 在 Wine + Xvfb 下直接注入并运行原版 1.13c `Game.exe` / `D2Common.dll` / `D2Game.dll` / `D2Client.dll`，对 `src/server` 进行逐函数与逐帧差分审计（详见 [`docs/oracle/`](../../docs/oracle)）：

| 能力域 | 状态 | 对齐度 / 验证基线 | 证据文档与测试入口 |
| :--- | :---: | :--- | :--- |
| **1.13c 核心数学与技能/战斗公式** | ✅ 已完成 | **100.00% 逐位一致**（12 大类共 `3,752,296` 条请求、`8,017,070` 个返回值零误差；覆盖全部 **357 行 `Skills.txt`**、命中、格挡、抗性、偷取、伤害、经验、帧速、StatOp 与 `mulDiv113c`） | [`docs/oracle/P5-formula-sweep.md`](../../docs/oracle/P5-formula-sweep.md), `tools/oracle/fn-sweep.ts`, `tests/oracle/fn-sweep.test.ts` |
| **角色面板 / 技能列表 / 技能树 Tooltip 结算** | ✅ 已完成 | **100.0% 逐字段一致**（9 组职业/战吼 `BO/Shout/BC`/圣骑光环 `Concentration/Fanaticism` 场景，人物面板 23 项字段与技能伤害区间 **0 误差**） | [`docs/oracle/P5-client-display.md`](../../docs/oracle/P5-client-display.md), `tools/oracle/client-ui-compare.ts`, `tests/oracle/client-ui.test.ts` |
| **7 职业 221 项技能、弹道、光环与 PvP** | ✅ 主体就绪 | 221 个玩家技能 + 怪物技能执行器、`8.16` 定点弹道与 `pierce_idx`、防御/攻击光环路由、诅咒互斥槽位、PvP 宣战与 `17%` 伤害折算均已落地并通过 164 套服务端单测 | `src/server/skills/impl/`, `src/server/combat/pvp-engine-113c.ts`, `tests/server/` |
| **五幕任务、方块合成、掉落、交易与 `.d2s` 存档** | ✅ 主体就绪 | 五幕任务 (`quests-113c.ts`)、阿卡拉洗点 (`Quest 41`)、奶牛关、地狱火炬红门 (`pandemonium-113c.ts`)、146 条方块配方、78 条符文之语、`TreasureClassEx` 掉落、商人/赌博刷新、玩家面对面安全交易与 `.d2s` v96 读写均已实现 | `src/server/engine/game-instance.ts`, `src/server/engine/quests-113c.ts`, `src/server/items/`, `src/server/world/pandemonium-113c.ts`, `src/server/save/d2s-reader.ts`, `src/server/save/d2s-writer.ts` |
| **单机回环 (`LocalLoopbackAdapter`) 与多客户端房间宿主 (`MultiClientRoomHost`)** | 🟡 实验可用（默认门控关闭） | `play.html` 已挂载 `loopback-adapter.ts`（支持浏览器本地 `.d2s` 建角/存档进图），默认由 `site-config.json` / `VITE_ENABLE_SINGLE_PLAYER` 门控关闭；`RoomClientSession` 解码 **80 个 C2S 操作码**并精确编码**全部 44 种 `ServerEvent`**（零 `[0x04]` 占位包） | `src/server/loopback-adapter.ts`, `src/server/room-host.ts`, `src/server/net/session.ts`, `src/netproto/d2gs/s2c-encoder.ts` |
| **与原生 `D2Game.dll` 逐帧严格锁步（Frame-Exact Lockstep）** | 🟡 局部对齐（60–66 帧） | 全部 10 组 Oracle 黄金场景在帧号、全局种子 `gs`、单位种子 `seedLo/Hi`、属性与坐标上严格对齐至 **第 60 帧**（`a1-town-walk`，玩家轨迹对齐至 **155 帧**）与 **第 66 帧**（9 组鲜血荒地近战/法术/战吼/光环场景）；分叉后的 `SUnitDmg` 命中/格挡/暴击/伤害分布通过双侧各 `N = 100,000` 样本 KS 与 $\chi^2$ 统计检验（`p >= 0.001`） | [`docs/oracle/P4-first-divergence.md`](../../docs/oracle/P4-first-divergence.md), [`docs/oracle/P5-combat-scenarios.md`](../../docs/oracle/P5-combat-scenarios.md), [`docs/oracle/P5-statistical-fallback.md`](../../docs/oracle/P5-statistical-fallback.md), `tests/oracle/stat-tests.test.ts` |
| **独立战网网络守护进程（BNCS / MCP / 多房间 D2GS Daemon）** | ❌ 未实现 | `src/server` 仅为内存同构模拟库，尚未提供独立监听 TCP/WebSocket `:6112`、`:6113`、`:4000` 的 Node.js 服务器进程与账号/角色数据库 | 见下方 **第 4 节 Gap 1** |

---

### 4. 当前服务端已知 Gap 明细（Known Server-Side Gaps）

以下是 `src/server` 距离“完全替代原生 C++ PvPGN + D2GS 1.13c 并默认开放全流程单机/自建服”所剩的全部客观差距（审计基准见 [`docs/oracle/P0-audit.md`](../../docs/oracle/P0-audit.md) 与 [`docs/oracle/P4-first-divergence.md`](../../docs/oracle/P4-first-divergence.md)）：

#### Gap 1：缺少独立的战网前置与多房间网络守护进程（No Standalone Network Daemon）
- `src/server` 严格遵循 `tsconfig.server.json`（零 Node.js I/O），本身只提供单房间内存模拟引擎 `GameInstance` 与基于抽象 `ByteStream` 的 `MultiClientRoomHost` / `RoomClientSession`。
- 仓库目前**没有**独立的 Node.js 守护进程去承载：
  1. **BNCS (`:6112`)**：账号注册/密码存储、CD-Key 校验服务端、好友列表与战网聊天频道服务（对应 `bnetd`）。
  2. **MCP / Realm (`:6113`)**：跨房间角色档案持久化调度、公开房间列表查询（`MCP_GAMELIST` / `MCP_GAMEINFO`）、排队与 `GameHash/GameToken` 签发（对应 `d2cs` + `d2dbs`）。
  3. **多房间 D2GS 宿主 (`:4000`)**：真实 TCP/WebSocket 监听端口、多房间并发 Worker 池管理、崩溃恢复与定时落盘 `.d2s` 文件服务。

#### Gap 2：第 60–66 帧之后的逐帧严格锁步与单怪独立 `D2SeedStrc` 差距
虽然公式层已达到 100.00% 对齐，且已补齐按单位类型独立的 `nextUnitIdByType[0..5]`、房间延迟刷怪、城镇零耐力消耗、`GAME_InitSeed` 与 `MONSTER_InitStats` 13 槽外观调色板掷骰，但完整帧循环在约 2.4–2.6 秒后仍与原生 `D2Game.dll` 产生轨迹分叉：
- **城镇 NPC 营火绕障重试差异**：在 `a1-town-walk` 第 60 帧（及 `p52-*` 第 66 帧），瓦瑞夫（`hcIdx=155`）在罗格营地营火障碍旁触发 `PATHTYPE_WALL_FOLLOW` / `AI_Npc` 重选路点时，与原生 `D2Game.dll` 出现 1 个子格的步进分叉。
- **野外敌对怪物 `MonAI` 决策时序与共享 RNG 流污染**：
  - 野外沉沦魔/僵尸在房间激活后的 `AI_General` 索敌/逼近帧时序与原生 `D2Game.dll` 尚未逐拍锁死，导致双端在进入单次近战挥击结算前世界帧已错位（因此 P5.2/P5.5 目前采用 `N = 100,000` 统计等价检验兜底战斗伤害分布）。
  - 除单位生成与城镇 NPC 漫步已迁移至单位私有 `D2SeedStrc`（`unit-seeds-113c.ts`）外，战斗、敌对怪物 AI、掉落、弹道、神殿与佣兵中仍有 **约 233 处调用点**直接消费全局共享的 `GameInstance.rng`（此外 `frame-and-commands.ts` 每帧固定调用一次 `this.rng.nextUint32()`，`MissileEngine` 与 `AuraScanner` 仍持有固定常量种子的独立 `D2Rng`），一旦任一房间多刷或少刷一只怪就会级联偏移后续随机序列。

#### Gap 3：残余确定性细节、浮点三角函数与帧序边界差异（`P0-audit.md`）
- **局部未注入种子 / 浮点随机分支**：女武神与刺客影子召唤装备生成链（`summoned-pets.ts` $\rightarrow$ `mon-equip-113c.ts`）在未显式传入 `options.rng` 时存在未设种兜底分支；佣兵战斗（`mercenaries.ts`）仍有少量使用浮点 `rng.range()` 而非整数 `nextInt()` 的判定。
- **浮点三角/开方运算 vs 原版 `Fog` 定点查表**：`src/server` 内仍保留约 **713 处** `Math.sin` / `Math.cos` / `Math.atan2` / `Math.sqrt` / `Math.hypot` 浮点几何调用，尚未全部替换为 `D2Common` / `Fog` 256/512 项定点正余弦与整数平方根查表，极端角度下可能产生 1 子格舍入差异。
- **预设物件刷出时机与暂停帧步进细节**：预设怪物已改为随玩家邻域房间激活延迟刷出（`activateRoomUnits113c`），但预设场景物件（Preset Objects）仍在 `loadArea` 阶段一次性生成；单机 `paused` 暂停状态下，`stepFrame()` 仍会先执行 `0a–1b`（物件计时器与指令队列）再提前返回；非回放模式下 `LocalLoopbackAdapter.tick(dtMs)` 按宿主壁钟增量折算帧数。

#### Gap 4：属性/状态双轨存储与历史遗留模块共存
- **属性与状态双写同步成本**：玩家与怪物的生命/法力/基础四维同时维护在 `InternalPlayerRecord` 标量字段（如 `hpFixed`、`strength`）与 `UnitStatList`（`stat-list.ts`）中，定时状态同时维护在 `states: Set` / `stateTimers: Map` 与 `StateBus`（`state-bus.ts`）中，每次进入战斗/技能上下文需通过 `playerCombatContext` 同步桥接，尚未彻底收敛为单一权威数据源（Single Source of Truth）。
- **遗留测试引擎未退役**：早期简化版 `engine/game-engine.ts` 与 `skills/skills.ts` 仍保留在源码树中以兼容旧单测，尚未全部迁移并清理至唯一的 `GameInstance` + `skills/impl/*`。

#### Gap 5：D2GS 长尾下行报文覆盖与 `.d2cap` 服务端直灌回放缺失
- **D2GS 下行报文子集**：`RoomClientSession` 已解码 80 个 C2S 操作码，且 `serverEventToS2cPackets` 已精确编码全部 44 种 `ServerEvent`，但原版 1.13c 共定义了 167 个 S2C 操作码——未被 `ServerEvent` 建模的战网重连、调试及部分罕见演出操作码在内置服务端模式下不会下发。
- **缺少自包含 `.d2cap` 服务端重放对比器**：现有 `.d2cap` 抓包文件仅记录网络原始字节帧，未内嵌 `mapSeed`、权威帧边界与初始 `.d2s` 角色快照，尚无法将线上实录 C2S 流直接灌入 `GameInstance` 自动比对 S2C 输出流。

#### Gap 6：浏览器单机模式主线程运行与全五幕三难度长程回归覆盖
- **尚未迁移至独立 `WebWorker`**：浏览器单机回环模式（`LocalLoopbackAdapter`）虽然满足 `WebWorker` 编译约束，但当前在 `src/client/main.ts` 中仍挂载于浏览器 UI 主线程上按帧驱动，高密度怪物/弹道场景下会与 WebGL2 渲染共享主线程预算。
- **五幕全流程与复杂词缀组合 Oracle 覆盖待扩展**：当前 Wine Oracle 黄金追踪集（`tests/oracle/`）主要覆盖第 1 幕城镇与鲜血荒地的初始角色及 40 级技能对照，针对“全身毕业暗金/符文之语触发技（`item_*_skill` proc）+ 元素吸收 + 荆棘反伤 + 佣兵灵气叠加”以及 **Act 1 $\rightarrow$ Act 5 普通/噩梦/地狱全通关长程浸泡（Soak Test）** 的自动化差分审计尚未收尾。

---

### 5. 核心子系统概要

1. **25fps 核心引擎与战斗管线 (`engine/`, `combat/`)**：`GameInstance` 按固定 40ms 步长顺序执行：指令队列消费 $\rightarrow$ 状态衰减与 `Attract` 诅咒互斥守卫 $\rightarrow$ `AuraScanner` 防御/攻击光环属性挂载 $\rightarrow$ `MissileEngine` `8.16` 定点步进碰撞与最多 4 次 `pierce_idx` 穿透 $\rightarrow$ 怪物/佣兵/召唤物 AI 帧推进 $\rightarrow$ 脏属性与 `ServerEvent` 增量刷出。`combat-pipeline.ts` 严格执行 1.13c AR/DR 命中率、闪避三姐妹/武器格挡/盾牌格挡、攻击者逐系 `[min, max]` 掷骰、免疫 `1/5` 穿抗与难度惩罚、元素吸收、难度与怪物 `Drain` 折算吸血吸蓝，以及 CB / CS / DS / OW。
2. **全职业技能系统 (`skills/`)**：基于 `Skills.txt` 的 `srvstfunc` / `srvdofunc` 分发七大职业共 **221 项技能**，对齐协同加成公式、`SrcDam` 武器伤害列选择（`calc1`/`calc2`/`calc4`）、毒素 `EType=pois` 帧长缩放、`startmana`/`usemanaondo`/`nocostinstate` 法力门控、多弹道齐射与施法延迟（Casting Delay）。
3. **怪物 AI、房间流式激活与五幕任务 (`ai/`, `world/`, `engine/quests-113c.ts`)**：复刻 129 项 `gpMonsterAiFunctionTable` 怪物行为、城镇 NPC 漫步、精英怪 `MonUMod` 词缀与死亡特效、九宫格房间流式激活、22 类神殿、五幕全主支线任务（含恰西注入、赫拉迪姆杖孔洞、克林姆强制球体、地狱熔炉、拉苏克打孔、安雅抗性卷轴、远古野蛮人、巴尔通关、阿卡拉洗点、奶牛关与地狱火炬六 Boss 事件）。
4. **掉落、方块合成、玩家交易与 `.d2s` 存档 (`items/`, `net/trade-manager-113c.ts`, `save/`)**：复刻 `TreasureClassEx.txt` 递归寻路、`NoDrop` 多人指数缩放、MF 品质掷骰与同局暗金防重降级、商人城镇清空刷新与按玩家隔离赌博、146 条赫拉迪克方块启用配方、78 条符文之语、玩家 10×4 面对面原子交易，以及原版 `.d2s` v96 角色存档逐字节无损读写。

---

### 6. 常用开发与验证命令

```bash
# 1. 单独对 src/server 进行严格类型检查（验证零 DOM / 零 Node 依赖）
npx tsc -p tsconfig.server.json --noEmit

# 2. 运行架构边界测试与全部 164 套服务端单元/集成测试
npx vitest run tests/arch/boundaries.test.ts tests/server/

# 3. 运行 1.13c Oracle 对齐回归测试（公式黄金集、锁步回放基线、面板显示与 10 万样本统计分布检验）
npx vitest run tests/oracle/

# 4. 在本地开启内置单机回环模式启动开发服务器（默认 singlePlayerEnabled 为 false）
VITE_ENABLE_SINGLE_PLAYER=1 npm run dev
```

---
---

<a id="english"></a>

## English

> [!WARNING]
> **Server-Side Development Status & Deployment Mode Notice**:
> `src/server` (**325 TypeScript files, ~140.8k LOC**, backed by **164 server test suites + 6 Wine native-DLL differential Oracle test suites**) implements the 25fps `GameInstance` authoritative tick loop, **100.00% 1.13c formula-level parity** (`8,017,070` compared values across 12 categories and all 357 `Skills.txt` rows), **100.0% character sheet / skill tooltip parity**, all 221 player skills across 7 classes, 5-Act quests plus Secret Cow Level and Pandemonium (Uber Tristram), `.d2s` v96 binary save I/O, an in-browser Single-Player loopback adapter (`LocalLoopbackAdapter` + `LocalLobbyProvider`), and a 1–8 player room host (`MultiClientRoomHost`).
> **However, `src/server` is still experimental and does NOT yet replace a full native Battle.net server stack**: (1) there is no standalone Node.js `BNCS (:6112)` / `MCP (:6113)` / multi-room `D2GS (:4000)` network daemon; (2) hostile monster `MonAI` timing and ~233 shared-`GameInstance.rng` call sites limit strict frame-by-frame lockstep with native `D2Game.dll` to frames **60–66**; and (3) full 5-Act Normal $\rightarrow$ Hell soak audits with geared item procs and mercenary auras are still in progress.
> Accordingly, Single-Player mode fails closed by default in deployment config (`singlePlayerEnabled: false`). **For full online gameplay today, follow the Single-Client Mode guide in the [root `README.md`](../../README.md) to connect to a native C++ PvPGN + D2GS (v1.13c) server**; for local development/testing of the built-in server, run `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev`.

`src/server` is the deterministic authoritative server simulation module for **Diablo II: Lord of Destruction (v1.13c)**, targeting `D2Game.dll` (paired with shared `D2Common.dll` helpers in `src/common`). It drives the 25fps (`40ms/tick`) world loop, combat damage resolution, 7-class skill and missile execution, monster/mercenary/summon AI, 5-Act quest state machines, `TreasureClassEx` item drops, Horadric Cube recipes, player-to-player trade, and `.d2s` save persistence.

---

### 1. Module Responsibilities & Architectural Boundaries

- **Original DLL Counterpart**: `D2Game.dll` (together with shared `D2Common.dll` math/tables in `src/common`).
- **TypeScript Compiler Constraints (`tsconfig.server.json`)**:
  - `lib: ["ES2022", "WebWorker"]`, `types: []` — **Strictly isomorphic: zero browser DOM globals and zero Node.js built-ins (`node:net`, `fs`, `Buffer`, etc.)**, enforced by [`tests/arch/boundaries.test.ts`](../../tests/arch/boundaries.test.ts) Rules 3 & 4.
  - **Deterministic Simulation**: Calling `Math.random`, `Date.now`, or `performance.now` is forbidden; randomness flows through 64-bit carry-multiply `D2Rng` / per-unit `D2SeedStrc` seeds, and time advances strictly via discrete 25fps ticks (`tickCount`).
  - **One-Way Dependency Boundary**: Imports only `src/common` and `src/netproto` (exclusively via `src/netproto/index.ts`); importing `src/client`, `src/baker`, or `plugins/` is forbidden. In the browser, `play.html` loads `src/server/loopback-adapter.ts` as an external module script to register optional Single-Player hooks (`registerLocalLobbyProvider` / `registerLocalServerFactory`) into `src/netproto`, keeping `src/client/**` at zero imports from `src/server/**`.

---

### 2. Directory Structure

```text
src/server/
├── index.ts             # Module barrel export (GameInstance, LocalLoopbackAdapter, LocalLobbyProvider, MultiClientRoomHost, .d2s reader/writer)
├── engine.ts            # Top-level simulation engine facade
├── loopback-adapter.ts  # LocalLoopbackAdapter & LocalLobbyProvider wrapping single-player GameInstance behind GameServerAdapter & LobbyProvider hooks
├── room-host.ts         # MultiClientRoomHost multiplexing 1..8 clients over a 25Hz authoritative GameInstance (TsFramer & binary D2GS)
├── net/                 # Multiplayer room synchronization layer
│   ├── aoi.ts           # Room-neighborhood Area-of-Interest spatial filtering & cross-area visibility pruning
│   ├── party.ts         # Party invite/roster state machine (0x5E / 0x8B / 0x8D) & PvP hostility bitmaps (0x5D / 0x8C)
│   ├── session.ts       # RoomClientSession: auto-detecting transport session decoding 80 D2GS C2S opcodes & encoding all 44 ServerEvent variants
│   └── trade-manager-113c.ts # Town player-to-player safe trade state machine (0x77/0x78/0x79) with 10×4 atomic commit/rollback
├── combat/
│   └── pvp-engine-113c.ts    # 1.13c PvP hostility gates, 17% player-vs-player damage scaling, player corpses & Ear drops
├── engine/              # 25fps core simulation engine, combat & projectile pipelines
│   ├── game-instance.ts      # Canonical online/single-player authoritative runtime facade (GameInstance)
│   ├── game-instance/        # 28 domain modules (frame-and-commands, world-spawning-and-aoi, unit-seeds-113c, player-combat-and-vitals,
│   │                         #   player-skills-*, monster-combat-ai, monster-melee-attacks, monster-damage, monster-death-and-xp,
│   │                         #   boss-encounters-ai, mercenaries, summoned-pets, missiles-step, quests-objects-and-portals,
│   │                         #   npc-vendors-and-artisans, item-stats-and-drops, trade-party-and-progression, snapshots-and-d2s, etc.)
│   ├── combat-pipeline.ts    # SUnitDmg 1.13c hit chance, dodge/avoid/block, per-channel damage rolls, resists, absorb, leech & CB/DS/OW
│   ├── missile-engine.ts     # 8.16 fixed-point projectile stepping, CollideType masks, Size footprints, pSrvDoFunc / pSrvHitFunc splash radii
│   ├── missile-pierce.ts     # Creation-time 4-roll pierce_idx (stat 328) & per-hit consumption
│   ├── player-srvdo-113c.ts  # Player multi-missile volley & special srvdofunc emitters (Multiple Shot, Strafe, Charged Bolt, Tornado, Meteor, etc.)
│   ├── aura-scanner.ts       # Periodic radial aura scanning, aurafilter bitmasks & caster passivestat vs. target aurastat routing
│   ├── quests-113c.ts        # 5-Act 27 quest state machines + Quest 41 Akara Respec + Secret Cow Level rewards & triggers
│   ├── anim-dispatcher.ts    # AnimData.d2 & WeaponClass frame-length and ActionFlag keyframe trigger dispatcher
│   ├── difficulty-resist-penalty.ts # Normal/Nightmare/Hell resistance penalties & XP scaling constants
│   ├── stat-list.ts          # Unit base/modifier stat list (UnitStatList) & StatOp derived evaluation
│   ├── state-bus.ts          # Timed state durations, curse slot exclusivity (un-overridable Attract) & dirty state bus
│   ├── state-hash.ts         # Deterministic frame state snapshot & hash verifier for lockstep & Oracle diffs
│   ├── world-arena.ts        # Room grid & spatial lookup arena helpers
│   └── game-engine.ts        # [Legacy] Early test-only harness; never instantiated in production code
├── ai/                  # Monster, town NPC, mercenary & summon AI
│   ├── monster-ai.ts         # 129-entry gpMonsterAiFunctionTable dispatch, boss modifiers & Act Boss AI/death sequences
│   ├── town-npc-ai-113c.ts   # Town NPC patrol/wander state machine (AI_Npc 0x6FC3DB40) & greeting halts
│   ├── mercenary-ai.ts       # Act 1/2/3/5 hireling target acquisition, skill selection & follow AI
│   ├── summon-manager.ts     # Necromancer skeletons/golems/revives, Druid spirits/vines/ravens, Valkyrie & Assassin shadows/traps
│   ├── monumod-113c.ts       # MonUMod boss/champion affix selection, resistance bonuses & death explosion/nova/bolt events
│   ├── monprop-113c.ts       # MonProp.txt innate monster property attachment
│   ├── monequip-helper-113c.ts # MonEquip.txt monster & Valkyrie/Shadow equipment initialization
│   ├── monster-missile-damage-113c.ts # D2Common #10413 monster projectile damage & poison DoT rate scaling
│   └── room-streamer.ts      # Dynamic 3×3 DRLG room activation/hibernation & MonDen / SuperUniques spawning
├── skills/              # Server-side executors for all 221 player skills + monster skills (247 files)
│   ├── registry.ts           # Skills.txt srvstfunc / srvdofunc central dispatch registry
│   ├── impl/                 # 229 skill implementation modules organized under amazon / assassin / barbarian / druid / necromancer / paladin / sorceress / shared
│   ├── martial-dualwield-113c.ts / whirlwind-113c.ts / passives-procs-113c.ts / p1-wave4-skills-113c.ts # Martial charge/dual-wield, Whirlwind & passive/proc handlers
│   └── skills.ts             # [Legacy] Compatibility skill layer; canonical implementations live in skills/impl/*
├── items/               # 1.13c drop pipeline, Horadric Cube, runewords, gamble & Charsi Imbue
│   ├── drop-pipeline.ts & drop-generator.ts & auto-tc.ts # TreasureClassEx traversal, NoDrop scaling, 4-tier MF rolls & per-game unique dedup
│   ├── cubemain-data-113c.ts # 151-row Cubemain.txt table (146 enabled recipes)
│   ├── cube-engine-113c.ts   # C2S 0x28 socketing, Gems.txt gemapplytype, 78 Runes.txt runewords & 0x4F 0x18 Cube transmute
│   ├── imbue.ts              # A1Q3 Charsi Imbue rare generation & StaffMods
│   ├── ground-items.ts       # Ground drop expiration timers, flippy owner lock & pickup validation
│   └── server-item-data.ts   # Server item table lookups & compact/full item builders
├── world/               # Area bootstrap, interactive objects, shrines & endgame events
│   ├── area-bootstrap.ts     # DRLG geometry & DS1 preset entity level bootstrapper
│   ├── shrines-113c.ts       # 22 shrine types (InitFn 1 selection & OperateFn 2 buff/refill/monster-upgrade/gem-shrine effects)
│   ├── object-drops-113c.ts  # Chests, locked chests, Super Chests, water wells & object traps
│   ├── objgroup-113c.ts & objgroup-data-113c.ts # ObjGroup.txt procedural object group spawning
│   ├── pandemonium-113c.ts   # 1.13c Pandemonium Event: Key-set organ portals, Lilith / Uber Duriel / Uber Izual & Uber Tristram
│   └── quests.ts             # World quest trigger helpers
└── save/                # Authentic 1.13c .d2s v96 binary character save reader/writer
    ├── d2s-reader.ts         # Parses 0xAA55AA55 header, checksum, gf stats, if skills, 96B quests, waypoints, NPC intros & character/corpse/merc/IronGolem JM items
    ├── d2s-writer.ts         # Bit-accurate v96 .d2s serializer with rotate-add checksum recalculation
    └── save.ts               # Save snapshot conversion facade
```

---

### 3. Current Implementation Status & 1.13c Oracle Parity Matrix

Using [`tools/oracle/`](../../tools/oracle), the repository runs unmodified 1.13c `Game.exe` / `D2Common.dll` / `D2Game.dll` / `D2Client.dll` under Wine + Xvfb to audit `src/server` at both the function level and frame-by-frame simulation level (see [`docs/oracle/`](../../docs/oracle)):

| Capability Domain | Status | Parity / Verification Baseline | Evidence & Test Entry Points |
| :--- | :---: | :--- | :--- |
| **1.13c Core Math, Combat & Skill Formulas** | ✅ Complete | **100.00% bit-exact** (`8,017,070 / 8,017,070` values across `3,752,296` requests in all 12 categories; covers **all 357 `Skills.txt` rows**, hit chance, block, resists, leech, damage, XP, frame lengths, StatOp, and `mulDiv113c`) | [`docs/oracle/P5-formula-sweep.md`](../../docs/oracle/P5-formula-sweep.md), `tools/oracle/fn-sweep.ts`, `tests/oracle/fn-sweep.test.ts` |
| **Character Sheet, Skill List & Tooltip Resolution** | ✅ Complete | **100.0% field-exact** (9 class / `BO/Shout/BC` warcry / `Concentration/Fanaticism` aura scenarios; 23/23 character sheet fields and skill damage blocks match `D2Client.dll` with **0 mismatches**) | [`docs/oracle/P5-client-display.md`](../../docs/oracle/P5-client-display.md), `tools/oracle/client-ui-compare.ts`, `tests/oracle/client-ui.test.ts` |
| **7-Class 221 Skills, Missiles, Auras & PvP** | ✅ Implemented | All 221 player skills + monster skill handlers, `8.16` fixed-point missiles & `pierce_idx`, defensive/offensive aura stat routing, curse slot exclusivity, and PvP hostility + `17%` damage scaling backed by 164 server test suites | `src/server/skills/impl/`, `src/server/combat/pvp-engine-113c.ts`, `tests/server/` |
| **5-Act Quests, Cube, Drops, Trade & `.d2s` v96 Saves** | ✅ Implemented | 5-Act quests (`quests-113c.ts`), Akara respec (`Quest 41`), Secret Cow Level, Pandemonium / Uber Tristram (`pandemonium-113c.ts`), 146 enabled Cube recipes, 78 runewords, `TreasureClassEx` drops, vendor/gamble lifecycles, safe player trade, and `.d2s` v96 I/O | `src/server/engine/game-instance.ts`, `src/server/engine/quests-113c.ts`, `src/server/items/`, `src/server/world/pandemonium-113c.ts`, `src/server/save/d2s-reader.ts`, `src/server/save/d2s-writer.ts` |
| **Single-Player Loopback (`LocalLoopbackAdapter`) & Multiplayer Room Host (`MultiClientRoomHost`)** | 🟡 Experimental (Gated Off by Default) | `play.html` registers `loopback-adapter.ts` (browser `.d2s` character creation/persistence & local game entry), gated fail-closed behind `site-config.json` / `VITE_ENABLE_SINGLE_PLAYER`; `RoomClientSession` decodes **80 C2S opcodes** and encodes **all 44 `ServerEvent` variants** via `serverEventToS2cPackets` with zero `[0x04]` dummy fallbacks | `src/server/loopback-adapter.ts`, `src/server/room-host.ts`, `src/server/net/session.ts`, `src/netproto/d2gs/s2c-encoder.ts` |
| **Frame-Exact Lockstep vs. Native `D2Game.dll`** | 🟡 Partial (Frames 60–66) | All 10 Oracle golden scenarios match native `D2Game.dll` bit-for-bit (game seed `gs`, unit `seedLo/Hi`, stats, coordinates) through **frame 60** (`a1-town-walk`, player track through **frame 155**) and **frame 66** (9 Blood Moor melee/spell/warcry/aura scenarios); post-divergence `SUnitDmg` hit/block/crit/damage distributions pass two-sided `N = 100,000` KS & $\chi^2$ parity tests (`p >= 0.001`) | [`docs/oracle/P4-first-divergence.md`](../../docs/oracle/P4-first-divergence.md), [`docs/oracle/P5-combat-scenarios.md`](../../docs/oracle/P5-combat-scenarios.md), [`docs/oracle/P5-statistical-fallback.md`](../../docs/oracle/P5-statistical-fallback.md), `tests/oracle/stat-tests.test.ts` |
| **Standalone Battle.net Network Daemon (`BNCS` / `MCP` / Multi-Room `D2GS`)** | ❌ Not Implemented | `src/server` is an in-memory isomorphic simulation library; standalone Node.js TCP/WebSocket listeners on `:6112`, `:6113`, and `:4000` plus account/realm databases do not exist yet | See **Section 4, Gap 1** below |

---

### 4. Known Server-Side Gaps & Roadmap

Below is the complete, concrete inventory of gaps remaining before `src/server` can replace native C++ PvPGN + D2GS 1.13c or be enabled by default in public deployments (audited in [`docs/oracle/P0-audit.md`](../../docs/oracle/P0-audit.md) and [`docs/oracle/P4-first-divergence.md`](../../docs/oracle/P4-first-divergence.md)):

#### Gap 1: No Standalone Battle.net Pre-Game or Multi-Room Network Daemon
- Because `src/server` compiles with `types: []` (zero Node.js I/O), it provides `GameInstance` (single-room simulation) and `MultiClientRoomHost` / `RoomClientSession` over abstract `ByteStream` pairs.
- There is **no** standalone Node.js server binary implementing:
  1. **BNCS (`:6112`)**: Account registration/authentication database, server-side CD-Key/revision verification, friends list, and chat channels (`bnetd` equivalent).
  2. **MCP / Realm (`:6113`)**: Realm character storage/locking, public game list directory (`MCP_GAMELIST` / `MCP_GAMEINFO`), queue management, and `GameHash`/`GameToken` issuance (`d2cs` + `d2dbs` equivalent).
  3. **Multi-Room D2GS Process (`:4000`)**: Raw TCP/WebSocket socket listener, multi-room worker pool orchestration, crash recovery, and scheduled disk `.d2s` commits.

#### Gap 2: Frame-Exact Simulation & Per-Unit `D2SeedStrc` Divergence Past Frame 60–66
Despite 100.00% formula parity and exact alignment of per-type `nextUnitIdByType[0..5]`, deferred room monster spawning, zero town stamina drain, `GAME_InitSeed`, and 13-slot `MONSTER_InitStats` palette rolls, full-world lockstep diverges after ~2.4–2.6 seconds:
- **Town NPC Campfire Wall-Follow Retry**: At frame 60 (`a1-town-walk`) / frame 66 (`p52-*`), Warriv (`hcIdx=155`) diverges by 1 sub-tile when retrying a patrol waypoint around the Rogue Encampment campfire (`PATHTYPE_WALL_FOLLOW` / `AI_Npc`).
- **Hostile Monster `MonAI` Decision Timing & Shared RNG Contention**:
  - Wild-area `AI_General` / `MonAI` approach and think-tick cadence diverges before individual `SUnitDmg` swings align on the exact same frame as native `D2Game.dll` (requiring statistical equivalence testing in `tests/oracle/stat-tests.test.ts` for combat rolls).
  - While unit creation and town NPC wander now use per-unit `D2SeedStrc` (`unit-seeds-113c.ts`), **~233 call sites** across combat, hostile AI, item drops, missiles, shrines, and mercenaries still draw from the shared `GameInstance.rng` (alongside an unconditional per-frame `this.rng.nextUint32()` in `frame-and-commands.ts` and constant-seeded `MissileEngine.rng` / `AuraScanner`), causing any room-spawn difference to shift downstream RNG draws.

#### Gap 3: Remaining Determinism, Fixed-Point Trig & Tick-Order Micro-Gaps (`P0-audit.md`)
- **Residual unseeded / float RNG paths**: `mon-equip-113c.ts` (invoked for Valkyrie and Shadow Warrior/Master summons when `options.rng` is omitted) still has an unseeded fallback branch, and mercenary combat (`mercenaries.ts`) still contains float `rng.range()` hit/crit checks instead of integer `nextInt()`.
- **Floating-point trig/sqrt vs. 1.13c `Fog` lookup tables**: ~**713** `Math.sin` / `Math.cos` / `Math.atan2` / `Math.sqrt` / `Math.hypot` calls remain across server trajectory and distance helpers rather than `D2Common` / `Fog` fixed-point sin/cos and integer sqrt tables.
- **Preset object spawn timing & paused-frame step order**: Preset monsters defer spawning until room activation (`activateRoomUnits113c`), whereas preset objects still spawn eagerly during `loadArea`; while `paused` in Single-Player, `stepFrame()` still executes steps `0a–1b` (object timers and command queue) before returning; and non-replay `tick(dtMs)` adapters assign commands by wall-clock delta rather than stamped tick numbers.

#### Gap 4: Dual Stat/State Storage & Legacy Engine Coexistence
- **Dual Stat & State Representation**: Player/monster vitals and attributes are mirrored across both scalar fields on `InternalPlayerRecord` (`hpFixed`, `strength`, etc.) and `UnitStatList` (`stat-list.ts`), while timed buffs/curses exist in both `states: Set` / `stateTimers: Map` and `StateBus` (`state-bus.ts`), requiring manual re-sync bridges (`playerCombatContext`) instead of a single source of truth.
- **Unretired Legacy Harnesses**: Early simplified `engine/game-engine.ts` and `skills/skills.ts` still coexist alongside canonical `GameInstance` and `skills/impl/*` for older unit tests.

#### Gap 5: Long-Tail D2GS Wire Coverage & Self-Contained `.d2cap` Server Replay
- **Server-Emitted S2C Subset**: `RoomClientSession` decodes 80 C2S opcodes and `serverEventToS2cPackets` encodes all 44 `ServerEvent` variants, whereas native 1.13c defines 167 S2C opcodes—opcodes outside the `ServerEvent` domain model (realm relog, debug, unused/rare cinematic variants) are not emitted by `src/server`.
- **No End-to-End `.d2cap` Server Replay Comparator**: Existing `.d2cap` captures store raw wire packets without `mapSeed`, tick indices, or initial `.d2s` character state, preventing automated C2S-into-`GameInstance` replay diffing against recorded D2GS S2C streams.

#### Gap 6: Browser Main-Thread Execution & Full 5-Act Normal $\rightarrow$ Hell Soak Coverage
- **Main-Thread Single-Player Execution**: Although `src/server` is `WebWorker`-clean, `LocalLoopbackAdapter` currently ticks `GameInstance` on the browser main UI thread inside `src/client/main.ts` rather than offloading simulation to a dedicated `WebWorker`.
- **End-to-End 5-Act & Geared Item-Proc Oracle Soak**: Current Wine Oracle golden traces (`tests/oracle/`) focus on Act 1 Rogue Encampment and Blood Moor starter / L40 skill scenarios; geared item-proc (`item_*_skill`), elemental absorb, thorns, mercenary-aura stacking goldens, and automated Act 1 $\rightarrow$ Act 5 Normal / Nightmare / Hell full-playthrough soak audits remain open.

---

### 5. Core Subsystems Summary

1. **25fps Core Engine & Combat Pipeline (`engine/`, `combat/`)**: `GameInstance` advances in fixed 40ms ticks: command queue drain $\rightarrow$ state duration decay & un-overridable `Attract` curse exclusivity $\rightarrow$ `AuraScanner` defensive/offensive aura stat routing $\rightarrow$ `MissileEngine` `8.16` fixed-point stepping & up to 4 `pierce_idx` rolls $\rightarrow$ monster/mercenary/summon AI ticks $\rightarrow$ dirty stat & `ServerEvent` flush. `combat-pipeline.ts` executes 1.13c AR/DR hit chance, Dodge/Avoid/Evade/Weapon-Block/Shield-Block, per-channel `[min, max]` damage rolls, `1/5` immune pierce & difficulty resist penalties, elemental absorb, difficulty & monster `Drain`-scaled leech, and CB / CS / DS / OW.
2. **All-Class Skill System (`skills/`)**: Dispatches `Skills.txt` `srvstfunc` / `srvdofunc` handlers across all 7 classes (**221 player skills**), matching synergy formulas, per-handler `SrcDam` weapon damage % calc columns (`calc1`/`calc2`/`calc4`), poison `EType=pois` duration scaling, `startmana`/`usemanaondo`/`nocostinstate` mana gates, multi-missile volleys, and casting delays.
3. **Monster AI, Room Streaming & 5-Act Quests (`ai/`, `world/`, `engine/quests-113c.ts`)**: Implements the 129-entry `gpMonsterAiFunctionTable`, town NPC wandering, `MonUMod` boss affixes and death FX, 3×3 room streaming, 22 shrine types, and all 5-Act quests (including Charsi Imbue, Horadric Orifice, Compelling Orb, Hellforge, Larzuk Socket, Anya Resistance Scroll, Ancients, Baal completion, Akara Respec, Secret Cow Level, and the 6-boss Pandemonium / Uber Tristram event).
4. **Drops, Cube, Player Trade & `.d2s` Saves (`items/`, `net/trade-manager-113c.ts`, `save/`)**: Implements `TreasureClassEx.txt` traversal, player-count `NoDrop` scaling, 4-tier MF rolls with per-game unique deduplication, town-empty vendor refresh & per-player gamble rerolls, 146 enabled Horadric Cube recipes, 78 runewords, atomic 10×4 player-to-player trade, and byte-authentic `.d2s` v96 save reading/writing.

---

### 6. Common Verification Commands

```bash
# 1. Run strict typecheck on src/server (verifies zero DOM / zero Node dependencies)
npx tsc -p tsconfig.server.json --noEmit

# 2. Run architectural boundary checks and all 164 server unit/integration test suites
npx vitest run tests/arch/boundaries.test.ts tests/server/

# 3. Run 1.13c Oracle parity suites (formula goldens, lockstep baselines, client UI display & N=100,000 statistical tests)
npx vitest run tests/oracle/

# 4. Launch Vite dev server with experimental Single-Player loopback mode enabled locally (default is false)
VITE_ENABLE_SINGLE_PLAYER=1 npm run dev
```
