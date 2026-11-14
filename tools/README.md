# `tools` — 开发者调试、1.13c Oracle 差分套件、协议重放与自动化验证工具集 / Developer Debugging, 1.13c Oracle Differential Suite, Protocol Replay & Automated Verification Tooling

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`tools/` 目录收录了围绕 **Diablo II: Lord of Destruction (v1.13c) Web Port** 的命令行辅助工具、**Wine 原生 1.13c DLL 差分对拍套件 (`tools/oracle/`)**、无头协议测试机器人、封包回放分析器、存档修改器、1.13c DRLG 差分对比工具、浏览器性能基准脚本以及全谱系无头验证脚本。

---

### 1. 核心工具概览

| 脚本 / 目录 | 运行命令示例 | 功能说明 |
| :--- | :--- | :--- |
| [`oracle/`](./oracle) | `npx tsx tools/oracle/parity-report.ts` | **1.13c 原生 DLL 差分对拍套件（Differential Oracle）**：通过 Wine 注入钩子 DLL 直接驱动原版 `D2Common.dll` / `D2Game.dll` / `D2Client.dll`，与 TypeScript 实现执行函数级（801.7 万公式值）、逐帧状态级与客户端面板显示值的三维差分校验。详见第 2 节。 |
| [`d2-bot.ts`](./d2-bot.ts) | `npm run bot -- --help` | 无头 (Headless) 战网/D2GS 协议测试机器人。基于 `src/netproto` 直接通过原生 TCP 或 WebSocket 桥走完 BNCS 登录 $\rightarrow$ MCP 选人/建房 $\rightarrow$ D2GS 进图移动/施法全流程，无需启动浏览器即可验证服务端连通性。 |
| [`netproto-replay.ts`](./netproto-replay.ts) | `npx tsx tools/netproto-replay.ts <file.d2cap>` | `.d2cap` 网络抓包录制文件离线重放与解析工具。逐帧还原 Huffman 解压后的 S2C/C2S 十六进制流与解码后的 `ServerEvent` 明细，用于排查协议死锁或未知操作码。 |
| [`d2s-unlock.ts`](./d2s-unlock.ts) | `npx tsx tools/d2s-unlock.ts <char.d2s>` | 原版 1.13c `.d2s` 角色存档一键解锁工具。支持修改角色等级、属性点、技能点、金币，一键点亮全部三难度（Normal / Nightmare / Hell）全部 5 幕小站 (Waypoints) 与通关任务状态，并自动重算 `.d2s` 校验和。 |
| [`drlg-diff.ts`](./drlg-diff.ts) | `npx tsx tools/drlg-diff.ts` | DRLG 确定性差分对比工具。给定相同的 `mapSeed` 与 `areaId`，对比本仓库 DRLG 输出与 `D2Common.dll` Ground Truth 房间拓扑、瓦片 Style/Sequence 及碰撞网格的一致性。 |
| [`render-drlg-compare.ts`](./render-drlg-compare.ts) | `npx tsx tools/render-drlg-compare.ts` | 将 DRLG 生成的关卡碰撞网格、房间边界与瓦片图层渲染为可视化对比 PNG 图像，便于直观排查墙壁接缝与门洞连通性。 |
| [`audit-parity.ts`](./audit-parity.ts) | `npx tsx tools/audit-parity.ts 1000 mephisto hell` | 1.13c `TreasureClassEx` 掉落率蒙特卡洛统计审计 CLI，对比大规模击杀样本下的暗金/套装/符文掉落分布与理论概率。 |
| [`benchmark-client-perf.ts`](./benchmark-client-perf.ts) | `npx tsx tools/benchmark-client-perf.ts` | 真实页面无头浏览器（WebGL2 + 2D Canvas）客户端渲染与帧耗时性能基准测试脚本。 |
| [`play-cdp-harness.ts`](./play-cdp-harness.ts) | *(供 `verify-*-browser.ts` 复用)* | 共享无头浏览器 CDP 自动化测试底座：拉起本地 Vite 服务并回放 `.d2cap` 建立真实在线会话，提供注入原始 S2C 封包、逐帧推进与多分辨率截图辅助接口。 |
| [`verify-play.ts`](./verify-play.ts) | `npx tsx tools/verify-play.ts` | 端到端 `play.html` 冒烟验证脚本：使用无头浏览器启动客户端，验证战网前端 UI 加载、WebGL2 上下文初始化、静态资产零 404 以及 HUD 交互响应。 |

---

### 2. 1.13c 原生二进制差分对拍套件 (`tools/oracle/`)

`tools/oracle/` 用于消除“肉眼读反汇编猜测行为”的误差，直接在 Wine 环境下调用原版 v1.13c DLL 或钩取每帧游戏状态，与 `src/common`、`src/server` 和 `src/client` 做自动化回归对拍（报告归档于 `docs/oracle/`，黄金基线由 `tests/oracle/*.test.ts` 门禁守护）：

| 组件 / 脚本 | 运行命令示例 | 职责说明 |
| :--- | :--- | :--- |
| [`oracle/hook/`](./oracle/hook) | `bash tools/oracle/hook/build.sh` | MinGW 32 位钩子与测试固件源码：`fnharness.dll.c`（函数级直接调用 `D2Common`/`D2Game` 导出与内部地址）、`d2oracle.c`（逐帧导出原版 `D2Game` 单位坐标/模式/生命法力/RNG 轨迹 NDJSON）、`clientui.dll.c`（导出原版 `D2Client` 角色面板/技能面板显示值）、`injector.c`（进程注入器）。 |
| [`oracle/fn-sweep.ts`](./oracle/fn-sweep.ts) | `npx tsx tools/oracle/fn-sweep.ts` | **P5.3 函数级全量差分扫描**：对比原版 DLL 与 TS 公式在 **8,017,678** 个采样点（含 `Skills.txt` 全部 357 行的等级 1..40 伤害/命中/法力消耗、AR/防御/格挡/经验/掉落/商人定价等）的输出，当前达成 **`0` 差异（`100.00%` 一致）**。 |
| [`oracle/run-replica.ts`](./oracle/run-replica.ts) & [`oracle/diff.ts`](./oracle/diff.ts) | `npx tsx tools/oracle/run-replica.ts <scenario.json> <out.ndjson>`<br>`npx tsx tools/oracle/diff.ts <oracle.ndjson> <replica.ndjson>` | **P2/P5 逐帧服务端复刻运行器与轨迹差分器**：无挂钟确定性步进 `GameInstance`，并与原版 `d2oracle` 录制的 NDJSON 轨迹逐帧比对单位坐标、动作模式、关键属性与 `D2SeedStrc` 种子，定位首个分叉帧；分叉后由 [`oracle/lib/stat-tests.ts`](./oracle/lib/stat-tests.ts) 执行 `N=100,000` 统计分布检验。 |
| [`oracle/parity-report.ts`](./oracle/parity-report.ts) | `npx tsx tools/oracle/parity-report.ts` | **逐帧锁步棘轮（Parity Ratchet）**：重放全部黄金场景并校验首次分叉帧绝不回退（基线记录于 `tests/fixtures/oracle/parity-baseline.json`）。 |
| [`oracle/client-ui-compare.ts`](./oracle/client-ui-compare.ts) | `npx tsx tools/oracle/client-ui-compare.ts <dir> --golden` | **P5.4 客户端面板显示值差分校验**：对比原版 `D2Client.dll` 与 TS 客户端在 7 大职业角色属性面板（生命/法力/耐力、面板伤害、AR、防御、四抗）与技能树伤害/消耗提示上的最终显示数值。 |
| `oracle/setup-wine.sh` / `run-oracle.sh` / `run-fn-oracle.sh` / `run-client-ui.sh` | `bash tools/oracle/run-fn-oracle.sh` | Wine 32 位运行环境初始化与原版进程采集自动化封装脚本。 |

---

### 3. 专项回归验证脚本 (`tools/verify-*.ts`)

除了上述日常开发与 Oracle 工具外，`tools/` 下还包含针对关键子系统的专项验证脚本：

- **`verify-automap.ts` / `verify-plugin-menu-browser.ts` / `verify-quest-fx-browser.ts` / `verify-shrine-fx-browser.ts`**：全谱系 136 关卡小地图图集（含 39 个小站 parity）校验、插件菜单端到端浏览器验证、特殊词缀怪物/Boss 死亡特效与神殿激活特效无头浏览器验证。
- **`verify-z-order-919.ts` / `verify-depth-order.ts` / `verify-floor-flicker-923.ts` / `verify-icebreak-melt-browser.ts` / `verify-backdrop-browser.ts`**：全 136 关瓦片绘制层级与墙壁遮挡/POPS 屋顶揭开审计（#919, #1009）、等轴测深度排序校验、DT1 熔岩动画标志防闪烁校验（#923）、冰冻碎裂冰片落地融水（#1453）与视口背景裁剪浏览器验证。
- **`verify-level-entry-title-browser.ts` / `verify-quest-slots-browser.ts` / `verify-useitem-browser.ts` / `verify-end-game-browser.ts` / `verify-ui-policy-browser.ts` / `verify-skill-tooltip-browser.ts` / `verify-stash-gold-cap-browser.ts`**：136 关区域进入横幅 `"Entering xxx"`（#1007）、任务日志 6 槽位与真古墓符号（#914, #1008）、`useitem.cpp` 恰西注入/拉苏克打孔/安雅刻名/赫拉迪姆杖孔洞窗口、A5Q6 巴尔通关胜利画面（#924）、面板互斥开关策略、技能树悬停提示与储藏箱金币上限无头浏览器验证。
- **`verify-gethit-anim-browser.ts` / `verify-merc-level-stats-browser.ts` / `verify-monster-colormap-browser.ts` / `verify-object-clientfn-browser.ts`**：受击硬直（`GH`）动画帧、佣兵升级属性成长、怪物 `PalShift` 调色板染色与场景物件 `ClientFn` 客户端特效无头浏览器验证。
- **`verify-audio.ts`**：1.13c 音频管线全谱系审计（`Sounds.txt` / `SoundEnviron.txt` 表逐字节重烘比对、`sfx-core` 653 条 Opus 样本与原版 WAV 时长/相关性校验、`music` 34 首曲目及环境/怪物/语音/技能音频包完整性校验）。
- **`gen-guide-graph.ts` / `gen-stat-engine-tables.ts`**：生成五幕关卡连接图谱（`src/client/guide/level-graph.gen.ts`）与属性引擎静态查找表。
- **`verify-environment-browser.ts`**：1.13c 昼夜时钟无头浏览器验证（实服 S2C `0x53`、注入昼/黄昏/夜/黎明四个时段的金值与截图、营火昼夜切换、136 关环境光渲染审计）。需 `D2W_PUBLIC_DIR`（含 `act-packs/tiles/index.json`）与 `D2_DATA_DIR`（1.13c MPQ）。
- **`verify-weather-browser.ts`**：1.13c 天气无头浏览器验证（天气资源与 `LoadWeather`、罗格营地实服下雨、`automap-reveal` 插件管理面板下拉切换雪/雨/默认与禁用恢复、136 关天气渲染审计及强制雨/雪逐像素帧校验）。需 `D2W_PUBLIC_DIR`（含 `act-packs/tiles/index.json` 与 `weather/weather.json`）与 `D2_DATA_DIR`（1.13c MPQ）。
- **`verify-world-graph.ts` / `verify-world-walk.ts` / `verify-collision-orientation.ts` / `audit-roof-walkable.ts`**：全幕关卡连通图、跨图行走可达性、DT1 碰撞朝向与屋顶可行走区域审计。
- **`verify-combat.ts` / `verify-items.ts` / `verify-monsters.ts` / `verify-objects.ts` / `verify-object-lookup.ts`**：战斗模拟、1.13c 掉落表、怪物属性与场景交互对象解析验证。
- **`verify-formats.ts` / `verify-dc6.ts` / `verify-dcc.ts` / `verify-dt1-pixels.ts` / `verify-tbl.ts` / `verify-mpq-roundtrip.ts` / `verify-implode.ts`**：底层二进制格式（DC6/DCC/DT1/DS1/TBL）与 MPQ PKWARE Implode 往返解码验证。
- **`verify-bundle-no-mpq.ts` / `verify-deploy.ts` / `verify-renderer-lifecycle.ts`**：验证静态烘焙包脱离原始 MPQ 运行、部署完整性与 WebGL2 渲染器生命周期。

---

### 4. 典型使用示例

#### 使用 `d2-bot.ts` 测试远端 D2GS 连通性
```bash
# 通过 WebSocket 桥连接远端战网并自动登录角色创建房间
npm run bot -- \
  --bridge wss://www.laiseek.xyz/d2net \
  --user myaccount \
  --pass mypassword \
  --char MySorceress \
  --game test01
```

#### 运行 1.13c Oracle 逐帧锁步报告与函数级回归
```bash
# 检查所有已录制黄金场景在 TS 服务端上的逐帧锁步基线
npx tsx tools/oracle/parity-report.ts

# 使用已采样的原版 DLL 黄金向量重跑 801.7 万公式点位回归校验
npx tsx tools/oracle/fn-sweep.ts --reuse
```

#### 使用 `netproto-replay.ts` 分析 `.d2cap` 抓包录制文件
通过 `OnlineSession` 录制导出或 `d2-bot.ts` 生成 `.d2cap` 文件后，可在终端离线回放：
```bash
npx tsx tools/netproto-replay.ts ./captures/session-2026.d2cap
```

---
---

<a id="english"></a>

## English

The `tools/` directory contains CLI utilities, the **Wine native 1.13c DLL differential Oracle suite (`tools/oracle/`)**, a headless protocol test bot, a packet capture replayer, a `.d2s` save editor, 1.13c DRLG differential comparison tools, headless browser performance benchmarks, and automated verification scripts for the **Diablo II: Lord of Destruction (v1.13c) Web Port**.

---

### 1. Core Tools Overview

| Script / Directory | Example Command | Description |
| :--- | :--- | :--- |
| [`oracle/`](./oracle) | `npx tsx tools/oracle/parity-report.ts` | **1.13c Native DLL Differential Oracle Suite**: Drives authentic `D2Common.dll` / `D2Game.dll` / `D2Client.dll` under Wine via injected C hook DLLs to cross-verify our TypeScript port across function formulas (8.017M values), frame-by-frame server simulation, and client UI readouts. See Section 2. |
| [`d2-bot.ts`](./d2-bot.ts) | `npm run bot -- --help` | Headless Battle.net / D2GS protocol test bot. Uses `src/netproto` over raw TCP or a WebSocket bridge to execute the full BNCS login $\rightarrow$ MCP character select / room creation $\rightarrow$ D2GS in-game walk/cast lifecycle without launching a browser. |
| [`netproto-replay.ts`](./netproto-replay.ts) | `npx tsx tools/netproto-replay.ts <file.d2cap>` | Offline replayer and analyzer for `.d2cap` packet capture files. Reconstructs frame-by-frame Huffman-decompressed S2C/C2S hex streams and decoded `ServerEvent` payloads to diagnose protocol bugs or unknown opcodes. |
| [`d2s-unlock.ts`](./d2s-unlock.ts) | `npx tsx tools/d2s-unlock.ts <char.d2s>` | One-click unlocker and editor for authentic 1.13c `.d2s` character save files. Modifies character level, stat/skill points, and gold, unlocks all 5-act waypoints and quest states across Normal / Nightmare / Hell, and recalculates the `.d2s` checksum. |
| [`drlg-diff.ts`](./drlg-diff.ts) | `npx tsx tools/drlg-diff.ts` | Deterministic DRLG differential comparison tool. Given a `mapSeed` and `areaId`, compares our TypeScript DRLG output against `D2Common.dll` ground truth across room topology, tile Style/Sequence, and collision grids. |
| [`render-drlg-compare.ts`](./render-drlg-compare.ts) | `npx tsx tools/render-drlg-compare.ts` | Renders DRLG collision grids, room boundaries, and tile layers into side-by-side comparison PNGs to visually inspect wall seams and doorway connectivity. |
| [`audit-parity.ts`](./audit-parity.ts) | `npx tsx tools/audit-parity.ts 1000 mephisto hell` | Monte Carlo statistical drop audit CLI for 1.13c `TreasureClassEx` pipelines across Unique, Set, and Rune outcomes. |
| [`benchmark-client-perf.ts`](./benchmark-client-perf.ts) | `npx tsx tools/benchmark-client-perf.ts` | Real-page headless browser (WebGL2 + 2D Canvas) client rendering and frame-time benchmark suite. |
| [`play-cdp-harness.ts`](./play-cdp-harness.ts) | *(shared by `verify-*-browser.ts`)* | Shared headless browser CDP test harness: boots `play.html` on Vite, replays `.d2cap` fixtures to establish a live session, and exposes helpers for raw S2C injection, deterministic ticking, and multi-resolution screenshots. |
| [`verify-play.ts`](./verify-play.ts) | `npx tsx tools/verify-play.ts` | End-to-end `play.html` smoke verifier: launches a headless browser to verify Battle.net frontend UI boot, WebGL2 context initialization, zero 404 static assets, and HUD responsiveness. |

---

### 2. 1.13c Native Binary Differential Oracle Suite (`tools/oracle/`)

`tools/oracle/` eliminates disassembly guesswork by executing the original v1.13c DLLs under Wine and comparing their exact outputs against `src/common`, `src/server`, and `src/client` (reports live in `docs/oracle/`, and golden baselines are enforced by `tests/oracle/*.test.ts`):

| Component / Script | Example Command | Description |
| :--- | :--- | :--- |
| [`oracle/hook/`](./oracle/hook) | `bash tools/oracle/hook/build.sh` | 32-bit MinGW C hooks & harnesses: `fnharness.dll.c` (direct calls into `D2Common`/`D2Game` exports and internal RVAs), `d2oracle.c` (frame-by-frame `D2Game` unit position/mode/vital/RNG NDJSON trace recorder), `clientui.dll.c` (`D2Client` character sheet & skill tooltip readout dumper), and `injector.c`. |
| [`oracle/fn-sweep.ts`](./oracle/fn-sweep.ts) | `npx tsx tools/oracle/fn-sweep.ts` | **P5.3 Function-Level Differential Sweep**: Evaluates **8,017,678** inputs across original DLLs vs. TypeScript formulas (including all 357 `Skills.txt` rows at `slvl 1..40`, AR/defense/block/XP/drop/vendor pricing), achieving **`0` divergences (`100.00%` parity)**. |
| [`oracle/run-replica.ts`](./oracle/run-replica.ts) & [`oracle/diff.ts`](./oracle/diff.ts) | `npx tsx tools/oracle/run-replica.ts <scenario.json> <out.ndjson>`<br>`npx tsx tools/oracle/diff.ts <oracle.ndjson> <replica.ndjson>` | **P2/P5 Deterministic Server Replica Runner & Trace Diff**: Steps `GameInstance` without wall-clock jitter and diffs unit coordinates, modes, stats, and `D2SeedStrc` states frame-by-frame against native `d2oracle` NDJSON traces; post-divergence combat/drop distributions are verified with `N=100,000` trials via [`oracle/lib/stat-tests.ts`](./oracle/lib/stat-tests.ts). |
| [`oracle/parity-report.ts`](./oracle/parity-report.ts) | `npx tsx tools/oracle/parity-report.ts` | **Frame Lockstep Parity Ratchet**: Replays all golden Oracle scenarios against the TS server and verifies that first-divergence frames never regress against `tests/fixtures/oracle/parity-baseline.json`. |
| [`oracle/client-ui-compare.ts`](./oracle/client-ui-compare.ts) | `npx tsx tools/oracle/client-ui-compare.ts <dir> --golden` | **P5.4 Client Display Differential**: Compares authentic `D2Client.dll` character sheet vitals/damage/AR/defense/resistances and skill tooltip readouts against the TS client across all 7 classes. |
| `oracle/setup-wine.sh` / `run-oracle.sh` / `run-fn-oracle.sh` / `run-client-ui.sh` | `bash tools/oracle/run-fn-oracle.sh` | Wine 32-bit prefix bootstrap and automated native capture shell wrappers. |

---

### 3. Subsystem Verification Scripts (`tools/verify-*.ts`)

In addition to daily developer and Oracle tools, `tools/` provides targeted verification scripts for core subsystems:

- **`verify-automap.ts` / `verify-plugin-menu-browser.ts` / `verify-quest-fx-browser.ts` / `verify-shrine-fx-browser.ts`**: Full-spectrum 136-level automap atlas (including 39-waypoint parity) verification, headless browser E2E testing for the plugin menu, special monster affix / Boss death VFX, and shrine activation VFX browser verification.
- **`verify-z-order-919.ts` / `verify-depth-order.ts` / `verify-floor-flicker-923.ts` / `verify-icebreak-melt-browser.ts` / `verify-backdrop-browser.ts`**: 136-level tile layer order & wall/POPS occlusion fade audit (#919, #1009), isometric depth-order checks, DT1 `TILE_FLAGS_LAVA` floor animation verification (#923), freeze shatter `icebreak*melt` puddle (#1453), and viewport backdrop clipping browser verification.
- **`verify-level-entry-title-browser.ts` / `verify-quest-slots-browser.ts` / `verify-useitem-browser.ts` / `verify-end-game-browser.ts` / `verify-ui-policy-browser.ts` / `verify-skill-tooltip-browser.ts` / `verify-stash-gold-cap-browser.ts`**: Headless browser verifiers for the 136-level `"Entering xxx"` banner (#1007), Quest Log 6-slot geometry & A2Q6 True Tomb symbol (#914, #1008), `useitem.cpp` Charsi Imbue / Larzuk Socket / Anya Personalize / Horadric Orifice windows, A5Q6 Baal completion victory screen (#924), UI panel toggle policy matrix, skill tooltips, and stash gold caps.
- **`verify-gethit-anim-browser.ts` / `verify-merc-level-stats-browser.ts` / `verify-monster-colormap-browser.ts` / `verify-object-clientfn-browser.ts`**: Headless browser verifiers for GetHit (`GH`) recovery animations, mercenary per-level stat growth, monster `PalShift` colormaps, and object `ClientFn` effects.
- **`verify-audio.ts`**: Full 1.13c audio pipeline audit (`Sounds.txt` / `SoundEnviron.txt` byte-identical MPQ re-bake, `sfx-core` 653 Opus sample duration/correlation vs. 1.13c WAV, and `music` / ambient / monster / speech / skill sound pack integrity checks).
- **`gen-guide-graph.ts` / `gen-stat-engine-tables.ts`**: Code generators for the 5-Act level connectivity graph (`src/client/guide/level-graph.gen.ts`) and stat engine lookup tables.
- **`verify-environment-browser.ts`**: Headless browser verification of the 1.13c day/night clock (live S2C `0x53`, injected Day / Dusk / Night / Dawn goldens with screenshots, campfire day/night switch, 136-level rendered ambient light audit). Needs `D2W_PUBLIC_DIR` (with `act-packs/tiles/index.json`) and `D2_DATA_DIR` (1.13c MPQs).
- **`verify-weather-browser.ts`**: Headless browser verification of the 1.13c weather (weather assets and `LoadWeather`, live rain in the Rogue Encampment, `automap-reveal` `weatherOverride` dropdown switching, 136-level rendered weather audit, and per-pixel rain/snow/splash/bubble frame verification). Needs `D2W_PUBLIC_DIR` (with `act-packs/tiles/index.json` and `weather/weather.json`) and `D2_DATA_DIR` (1.13c MPQs).
- **`verify-world-graph.ts` / `verify-world-walk.ts` / `verify-collision-orientation.ts` / `audit-roof-walkable.ts`**: Multi-act level connectivity graph, cross-level walkability, DT1 collision orientation, and roof walkability audits.
- **`verify-combat.ts` / `verify-items.ts` / `verify-monsters.ts` / `verify-objects.ts` / `verify-object-lookup.ts`**: Combat simulation, 1.13c drop tables, monster attributes, and world object metadata verification.
- **`verify-formats.ts` / `verify-dc6.ts` / `verify-dcc.ts` / `verify-dt1-pixels.ts` / `verify-tbl.ts` / `verify-mpq-roundtrip.ts` / `verify-implode.ts`**: Low-level binary format (DC6/DCC/DT1/DS1/TBL) and MPQ PKWARE Implode roundtrip decompression verification.
- **`verify-bundle-no-mpq.ts` / `verify-deploy.ts` / `verify-renderer-lifecycle.ts`**: Verifies MPQ-free static bundle operation, deployment integrity, and WebGL2 renderer resource lifecycle.

---

### 4. Typical Usage Examples

#### Test Remote D2GS Connectivity with `d2-bot.ts`
```bash
# Connect to a remote Battle.net server over the WebSocket bridge, log in, and create a game
npm run bot -- \
  --bridge wss://www.laiseek.xyz/d2net \
  --user myaccount \
  --pass mypassword \
  --char MySorceress \
  --game test01
```

#### Run the 1.13c Oracle Parity Ratchet & Function Sweep
```bash
# Check frame-by-frame lockstep baselines across all recorded golden scenarios
npx tsx tools/oracle/parity-report.ts

# Re-run the 8.017M-point function differential sweep against cached native DLL goldens
npx tsx tools/oracle/fn-sweep.ts --reuse
```

#### Replay a `.d2cap` Capture with `netproto-replay.ts`
After exporting a `.d2cap` session capture from `OnlineSession` or `d2-bot.ts`, replay it offline in the terminal:
```bash
npx tsx tools/netproto-replay.ts ./captures/session-2026.d2cap
```
