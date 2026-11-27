# Diablo II: Lord of Destruction (v1.13c) — Web Port

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

> [!WARNING]
> **服务端开发状态说明（Server-Side Status Notice）**：
> - **线上主力模式（Single-Client Mode，已生产就绪）**：浏览器运行纯 Web 客户端（[`src/client`](./src/client) + [`src/netproto`](./src/netproto)），通过轻量 TCP-to-WebSocket 桥直接连入原版 C++ **PvPGN (`bnetd` / `d2cs` / `d2dbs`) + D2GS (v1.13c)** 战网服务器。
> - **内置服务端（[`src/server`](./src/server)，实验阶段 / 默认门控关闭）**：已完成 **100.00% 1.13c 公式级对齐**（801.7 万比对值 / 357 行技能表）、**100.0% 人物面板/技能提示对齐**、7 职业 221 项技能、五幕任务与地狱火炬事件、`.d2s` 存档读写及浏览器单机回环适配（`LocalLoopbackAdapter`，本地可通过 `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev` 开启）；但**尚无独立 `BNCS/MCP/D2GS` 网络守护进程**，且野外 `MonAI` 时序与约 233 处共享 `GameInstance.rng` 调用点使逐帧严格锁步暂停留在第 **60–66 帧**（详见下方 **2.1 节** 与 [`src/server/README.md`](./src/server/README.md)）。

### 1. 项目概述

本项目是 **《暗黑破坏神 II：毁灭之王》(Diablo II: Lord of Destruction v1.13c)** 的高精度 Web 移植实现。项目严格遵循原版 1.13c 反编译二进制汇编（`D2Common.dll`、`D2Client.dll`、`D2Game.dll`、`D2Net.dll`、`Bnclient.dll`、`D2MCPClient.dll`、`Fog.dll`、`D2Gfx.dll`、`D2Win.dll`、`D2Lang.dll`）与官方 MPQ 数据表（`Levels.txt`、`LvlTypes.txt`、`SuperUniques.txt`、`Skills.txt`、`Missiles.txt`、`Objects.txt`、`TreasureClassEx.txt` 等）作为唯一事实基准（Ground Truth）：

- **1:1 原生网络协议兼容**：完整实现 BNCS（战网登录/注册/聊天，端口 `6112`）、MCP（Realm 角色管理/建房加房，端口 `6113`）与 D2GS（Huffman 压缩帧、167 个 S2C 操作码、C2S 指令及 `0x9C/0x9D` 物品比特流，端口 `4000`），浏览器客户端可通过轻量 TCP-to-WebSocket 桥直接连入原版 C++ **PvPGN + D2GS (1.13c)** 战网服务器。
- **种子驱动的确定性 DRLG 地图重建与动态寻路**：1:1 复刻 `D2Common.dll` 64 位进位乘法随机数 (`0x6FDAA9E0`)、三大 DRLG 拓扑算法（Preset 预设、Maze 地牢迷宫、Outdoors 野外生成）与 `D2Common` 动态路径/步进碰撞引擎 (`src/common/path`)，客户端仅凭 D2GS 下发的 32 位 `mapSeed` 即可在浏览器端还原与 C++ 服务端逐格一致的瓦片地图与碰撞网格。
- **WebGL2 高性能等距渲染与离线资产管线**：通过 Node.js 离线烘焙管线 (`src/baker`) 将原版 MPQ 中的 DT1/DS1 瓦片、7 职业 16 部件纸娃娃 DCC/COF 动画、怪物/NPC 精灵、Missiles/Overlays 特效、PL2 调色板染色矩阵与 TBL 字符串表预编译为静态图集与二进制包，配合 Service Worker (`tsconfig.sw.json`) 增量缓存、25Hz `LogicClock` 帧同步与 WebGL2 合批渲染（含 1.13c 斜向透视地面阴影与加法混合发光特效）实现 60fps 流畅体验。
- **严格的模块化架构与可拔插扩展隔离**：全仓按原版 DLL 职责划分为五大核心代码模块、顶层可拔插扩展目录（`plugins/`，内置击杀统计、掉落统计、交易大厅、小地图全图透视（含光照预设与天气模式）、扩展分辨率、界面增强显示、地面光柱、快捷施法、快速下一房及 15 项 QoL 增强共 24 款插件）与独立工具集，由多套独立 `tsconfig.*.json` 与架构边界测试（`tests/arch/boundaries.test.ts`）强制保障零跨层污染。

---

### 2. 模块概述与 README 链接

项目源码按职责边界严格拆分为以下模块，点击各模块的 `README.md` 可查看中英双语的详细子目录结构、核心算法与验证命令：

| 模块路径 | 对标原版组件 | 状态 | 运行环境与边界约束 | 核心职责简述 | 详细文档 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| [`src/common`](./src/common) | `D2Common.dll` `Storm.dll` `D2Lang.dll` | ✅ 已就绪 | 纯 TypeScript (`ES2022`)，零 DOM / 零 Node.js 依赖 | MPQ 与原生二进制格式解析器 (DC6/DCC/DT1/DS1/COF/PL2/TBL)、`D2DataRegistry` 数据表中心、1.13c DRLG 随机地图生成算法、`D2Common` 动态寻路引擎 (`path/`)、64 位 `D2Rng` 与烘焙校验契约 (`pack-contract`) | [src/common/README.md](./src/common/README.md) |
| [`src/netproto`](./src/netproto) | `D2Net.dll` `Bnclient.dll` `D2MCPClient.dll` `Fog.dll` | ✅ 已就绪 | 纯协议栈模块，零外部模块依赖，唯一入口 `src/netproto/index.ts` | BNCS (`6112`) / MCP (`6113`) / D2GS (`4000`) 双向二进制协议编解码、XSHA-1 与 CheckRevision 认证、Fog.dll Huffman 编解码、167 个 S2C 操作码解析与 44 种 `ServerEvent` S2C 精确编码、物品比特流、单机大厅钩子注册与 WebSocket/TCP 传输层抽象 | [src/netproto/README.md](./src/netproto/README.md) |
| [`src/client`](./src/client) | `D2Client.dll` `D2Gfx.dll` `D2Win.dll` `D2Launch.dll` `D2Sound.dll` | ✅ 已就绪 | 纯浏览器客户端 (`DOM` + `WebGL2`)，零 Node / 零 `server` / 零 `baker` / 零 `plugins` 依赖 | 主门户 `index.html` 与游戏主入口 `play.html`、战网登录/选人/大厅前端界面、`OnlineSession` 与 `ClientWorld` 状态镜像、25Hz `LogicClock`、WebAudio 1.13c 音频引擎 (`audio/`)、4 档画质预设、移动端紧凑触控 HUD (`ui/touch-controls.ts`)、单页多开容器 (`multibox/`)、任务路线向导 (`guide/`)、非侵入式插件宿主 (`plugin-host/`)、种子驱动的实时 DRLG 地图重建、WebGL2 渲染器与全套经典 HUD 面板 | [src/client/README.md](./src/client/README.md) |
| [`plugins/`](./plugins) | 客户端外挂扩展生态 | ✅ 已就绪 | 浏览器扩展层 (`DOM`)，仅依赖 `src/common`、`src/netproto/index.ts` 与 `src/client/plugin-host/api.ts`，插件间严格物理隔离 | 独立于核心客户端的 24 款可拔插非 1.13c 辅助扩展（`kill-stats` 怪物击杀统计、`drop-tracker` 装备/符文掉落统计、`trade-hall` 在线交易大厅、`automap-reveal` 小地图全图揭示及环境光照/天气切换、`extended-viewports` 扩展高分宽屏视口、`hud-enhancements` 界面增强显示、`ground-item-beam` 地面光柱、`quick-cast` 快捷施法、`next-game` 快速下一房，以及 `path-guide`、`item-info`、`loot-alerts`、`upgrade-hints`、`monster-resists`、`experience-bar`、`run-timer`、`stash-deposit-all`、`drag-interact`、`low-life-warning`、`town-portal-key`、`auto-gold-pickup`、`auto-potion`、`belt-refill`、`auto-combat` 15 项 QoL 扩展），支持通过顶部工具栏 **Plugins** 菜单热插拔启停与 1.13c 原版回退 | [plugins/README.md](./plugins/README.md) |
| [`src/server`](./src/server) | `D2Game.dll` | 🟡 **实验阶段 (部分 Gap)** | 纯确定性模拟 (`ES2022` + `WebWorker`)，禁 DOM / 禁 Node / 禁非确定性随机与时钟 | 325 文件 / 14.1 万行代码：已实现 25fps `GameInstance`、100.00% 1.13c 公式级对齐、7 职业 221 项技能、五幕任务/方块/掉落/交易、`.d2s` 存档、单机回环（默认门控关闭）与 1–8 人 `MultiClientRoomHost`；尚缺独立战网网络守护进程及 60–66 帧后的全怪物 AI 逐帧锁步 | [src/server/README.md](./src/server/README.md) |
| [`src/baker`](./src/baker) | 离线资源构建管线 | ✅ 已就绪 | 纯 Node.js CLI 环境 (`types: ["node"]`)，禁 DOM / 禁 `client` / 禁 `server` | 从原版 1.13c MPQ 归档中提取并烘焙 Excel 数据表 (`excel`)、瓦片图集 (`tiles`)、角色/怪物/NPC 实体 (`entities`)、投射物 (`missiles`)、覆盖层 (`overlays`)、HUD/前端 UI、全谱系音频包 (`sfx`/`music`/`ambient-sounds`/`monster-sounds`/`speech`/`skill-sounds`)、动画表 (`animdata`)、部署站点开关中间件 (`site-config.ts`) 与 SHA-256 资产清单 (`asset-manifest.json`) | [src/baker/README.md](./src/baker/README.md) |
| [`tools/`](./tools) | 开发者、Oracle 与 QA 工具集 | ✅ 已就绪 | Node.js / Wine / 无头浏览器 CLI | Wine 原生 1.13c DLL 差分 Oracle 套件 (`tools/oracle/`)、无头协议测试机器人 (`d2-bot.ts`)、`.d2cap` 抓包离线重放器 (`netproto-replay.ts`)、`.d2s` 存档全解锁工具 (`d2s-unlock.ts`)、端到端浏览器验证 (`verify-play.ts`) 与 1.13c DRLG/音频/渲染差分对比验证工具 | [tools/README.md](./tools/README.md) |
| [`kb/`](./kb) | 1.13c 逆向工程知识库 | ✅ 持续沉淀 (162 篇) | Markdown 规范文档 | 基于原版 1.13c DLL 反汇编与 MPQ 数据表整理的 162 篇权威逆向规范（涵盖引擎/Oracle 钩子、战斗、210+ 技能与弹道、怪物 AI、掉落/方块、网络协议、五幕任务、UI 与音频） | [kb/README.md](./kb/README.md) |

#### 模块依赖拓扑图

```text
          ┌──────────────────┐          ┌────────────────────┐
          │    src/common    │          │    src/netproto    │
          │ (Pure TS Base)   │          │ (1.13c Wire Stack) │
          └────────┬─────────┘          └─────────┬──────────┘
                   │                              │
         ┌─────────┼──────────────────┐           │
         ▼         ▼                  ▼           ▼
┌─────────────┐ ┌──────────────┐   ┌─────────────────────────┐
│  src/baker  │ │  src/server  │   │       src/client        │
│ (Node CLI)  │ │ (Exp D2Game) │   │ (Browser WebGL2 Client) │
└─────────────┘ └──────┬───────┘   └────────────┬────────────┘
                       │                        ▲
                       │ (registers via         │ (plugin-host/api.ts only)
                       │  netproto lobby hooks) │
                       ▼                        │
            (play.html external)   ┌────────────┴────────────┐
            (loopback-adapter.ts)  │        plugins/         │
                                   │ (Isolated Extensions)   │
                                   └─────────────────────────┘
   *(注：src/client/** 对 src/server/** 与 plugins/** 保持零导入；play.html 通过外部模块脚本加载 loopback-adapter.ts 向 src/netproto 注册可选单机钩子)*
```

#### 2.1 内置服务端（`src/server`）当前状态与已知 Gap 概览

项目通过 [`tools/oracle/`](./tools/oracle) 在 Wine 下运行原版 1.13c `D2Common.dll` / `D2Game.dll` / `D2Client.dll` 进行逐函数与逐帧差分校验（完整审计见 [`docs/oracle/`](./docs/oracle) 与 [`src/server/README.md`](./src/server/README.md)）：

- **已完成并验证的能力**：
  1. **100.00% 公式级 1.13c 逐位一致**：`tools/oracle/fn-sweep.ts` 覆盖 12 大类（命中、格挡、抗性、偷取、伤害、经验、帧速、StatOp、全部 **357 行 `Skills.txt`** 等）共 **375.2 万次调用 / 801.7 万个返回值**，与原生 DLL 误差为 **0**。
  2. **100.0% 面板与技能树数值一致**：9 组多职业、野蛮人战吼（`BO/Shout/BC`）与圣骑士光环（`Concentration/Fanaticism`）场景下，人物面板 23 项字段与技能伤害提示与原生 `D2Client.dll` 100% 一致。
  3. **核心游戏子系统就绪**：25fps `GameInstance`、7 职业 221 项技能、8.16 定点弹道与穿透、129 项 `MonAI` 分发、五幕任务 + 阿卡拉洗点 + 奶牛关 + 地狱火炬六 Boss 事件、146 条方块配方、78 条符文之语、`TreasureClassEx` 掉落、面对面安全交易、`.d2s` v96 存档读写，以及解码 80 个 C2S / 精确编码全部 44 种 `ServerEvent` 的 `RoomClientSession`。
  4. **实验性本地单机回环模式**：`play.html` 已挂载 `LocalLobbyProvider` + `LocalLoopbackAdapter`，默认由部署配置 `singlePlayerEnabled: false` 门控关闭；本地开发可执行 `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev`（或在本地 `public/site-config.json` 中设置 `{ "singlePlayerEnabled": true }`）体验浏览器内建角、进图与本地存档。
- **当前主要 Gap（为何线上默认仍采用单客户端连接原生 D2GS）**：
  1. **无独立战网网络守护进程**：`src/server` 为纯内存同构库（零 Node.js 网络/磁盘 I/O），尚未实现独立监听 `:6112` (BNCS)、`:6113` (MCP/Realm 角色库) 与 `:4000` (多房间并发 D2GS) 的 Node.js 守护进程。
  2. **第 60–66 帧后的逐帧锁步分叉**：10 组 Oracle 黄金场景目前严格逐位锁步至第 **60–66 帧**（城镇玩家轨迹至 **155 帧**）；后续因瓦瑞夫营火绕障重试、野外敌对 `MonAI` 索敌时序差异，以及战斗/AI/掉落中尚存约 **233 处**共享 `GameInstance.rng` 调用点（尚未全部迁移至单怪私有 `D2SeedStrc`）而产生帧轨迹分叉（战斗伤害分布已由 `N = 100,000` 双侧统计检验兜底）。
  3. **残余定点三角查表与双轨状态收敛**：服务端仍余约 713 处 `Math.sin/cos/atan2/sqrt` 浮点调用待替换为 `Fog` 定点查表；单位属性/状态仍存在标量字段与 `UnitStatList`/`StateBus` 双写桥接；遗留测试引擎 `GameEngine` 尚未彻底退役。
  4. **主线程运行与全五幕三难度长程浸泡**：浏览器单机回环当前运行在 UI 主线程（尚未迁入独立 `WebWorker`），且带全身复杂触发词缀/元素吸收/佣兵灵气的五幕三难度全通关自动化浸泡审计仍在推进中。

---

### 3. 单客户端模式使用方法（Single-Client Mode Guide）

线上生产部署推荐在**单客户端模式**下运行：Web 前端作为纯粹的 1.13c 在线客户端运行（[`play.html`](./play.html)），所有战网账号认证、角色存档、房间管理与游戏权威战斗逻辑均由远端原版 **PvPGN (`bnetd` + `d2cs` + `d2dbs`) + D2GS (v1.13c)** 服务器承载。

完整跑通单客户端模式包含以下三个核心步骤：

#### 3.1 第一步：在 D2GS / PvPGN 机器上设置 TCP-to-WebSocket 桥

由于浏览器只支持 WebSocket (`ws://` / `wss://`) 而不支持直接建立原始 TCP Socket，需要在运行 PvPGN 与 D2GS 的服务器（或同内网网关机）上部署 **`websockify` + Nginx** 反向代理，将浏览器的三路 WebSocket 子路径桥接到对应的原生 TCP 端口：

```text
浏览器 Web 客户端 (src/netproto WsStream)
  │
  ├─ wss://<host>/d2net/bnet   ──► Nginx :443 ──► websockify 127.0.0.1:7001 ──► PvPGN bnetd (TCP :6112)
  ├─ wss://<host>/d2net/realm  ──► Nginx :443 ──► websockify 127.0.0.1:7002 ──► PvPGN d2cs  (TCP :6113)
  └─ wss://<host>/d2net/game   ──► Nginx :443 ──► websockify 127.0.0.1:7003 ──► D2GS 1.13c  (TCP :4000)
```

##### 1) 安装 `websockify`
在 Linux 网关/宿主机（例如 Ubuntu/Debian）上安装 `websockify`：
```bash
sudo apt-get update && sudo apt-get install -y websockify nginx
```

##### 2) 配置 `systemd` 守护服务管理 3 个桥接端口
创建环境变量配置目录 `/etc/d2ws` 及三个端点的配置文件（若 D2GS 运行在另一台内网 Windows 机器上，将 `TARGET` 中的 `127.0.0.1` 替换为对应的内网 IP 即可）：

```bash
sudo mkdir -p /etc/d2ws

# 1. BNCS (bnetd, TCP 6112)
sudo tee /etc/d2ws/bnet.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7001
TARGET=127.0.0.1:6112
EOF

# 2. MCP Realm (d2cs, TCP 6113)
sudo tee /etc/d2ws/realm.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7002
TARGET=127.0.0.1:6113
EOF

# 3. D2GS Game Server (D2GS.exe 1.13c, TCP 4000)
sudo tee /etc/d2ws/game.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7003
TARGET=127.0.0.1:4000
EOF
```

创建模板单元文件 `/etc/systemd/system/d2ws@.service` 并启动服务：

```bash
sudo tee /etc/systemd/system/d2ws@.service >/dev/null <<'EOF'
[Unit]
Description=Diablo II WebSocket-to-TCP Bridge (%i)
After=network.target

[Service]
Type=simple
EnvironmentFile=/etc/d2ws/%i.env
ExecStart=/usr/bin/websockify --heartbeat=30 ${LISTEN} ${TARGET}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now d2ws@bnet d2ws@realm d2ws@game
```

##### 3) 配置 Nginx `/d2net/*` WebSocket 反向代理
在 Nginx 站点配置（如 `/etc/nginx/sites-enabled/default`）的 `server` 块中加入 `/d2net/` 路由规则：

```nginx
# BNCS (端口 6112)
location = /d2net/bnet {
    proxy_pass http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}

# MCP Realm (端口 6113)
location = /d2net/realm {
    proxy_pass http://127.0.0.1:7002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}

# D2GS Game Server (端口 4000)
location = /d2net/game {
    proxy_pass http://127.0.0.1:7003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

重载 Nginx 配置并验证服务状态：
```bash
sudo nginx -t && sudo systemctl reload nginx
systemctl is-active d2ws@bnet d2ws@realm d2ws@game
```

> **提示**：客户端的 `createWsBridgeResolver`（位于 [`src/netproto/transport/endpoint.ts`](./src/netproto/transport/endpoint.ts)）会自动根据协议握手阶段返回的端口（`6112`、`6113`、`4000`）将连接重写至 `<wsBridgeUrl>/bnet`、`/realm` 与 `/game`，因此无需修改 D2GS 内部下发的 IP，只需确保 PvPGN 的 `realm.conf` / `address_translation.conf` 中配置的端口保持标准 `6113` 与 `4000` 即可。

---

#### 3.2 第二步：如何烘焙离线美术资源（Offline Asset Baking）

由于原版美术与音频资产存在版权限制且生成的 PNG/二进制图集体积较大，仓库已将 `public/` 下所有离线烘焙产物（`public/act-packs/`、`public/anim/`、`public/chars/`、`public/entities/`、`public/missiles/`、`public/music/`、`public/overlays/`、`public/packs/`、`public/sfx/`、`public/skills/`、`public/ui/`、`public/weather/` 与 `public/asset-manifest.json`）加入 `.gitignore` 并移出 Git 版本控制。**首次克隆仓库后，必须先执行离线资产烘焙，才能启动开发服务器、构建生产包或运行依赖美术资源的测试。**

##### 1) 安装项目依赖与系统转码工具（`ffmpeg` 与 `webp`）
```bash
npm install

# 音效 (pack:sfx) 与背景音乐 (pack:music) 烘焙依赖包含 libopus 编码器的 ffmpeg（推荐 ffmpeg >= 7.0，例如 Debian/Ubuntu apt 安装的 7.x / 8.x）；
# 静态图像旁路无损压缩 (pack:compress) 依赖 cwebp 工具（Debian/Ubuntu 包名为 webp）：
# sudo apt-get update && sudo apt-get install -y ffmpeg webp
/usr/bin/ffmpeg -version
cwebp -version
```

> **关于 `ffmpeg` 路径与版本要求**：
> - **可执行文件路径**：默认调用 `/usr/bin/ffmpeg`。若系统 `ffmpeg` 位于其他路径（如 Homebrew `/opt/homebrew/bin/ffmpeg` 或自定义静态编译版），可通过环境变量 `FFMPEG_PATH=/path/to/ffmpeg` 或 CLI 参数 `npm run bake -- all --ffmpeg /path/to/ffmpeg`（亦支持 `npm run pack:sfx -- --ffmpeg /path/to/ffmpeg`）显式指定。
> - **版本敏感度（推荐 `ffmpeg >= 7.0`）**：`npm run bake:verify` / `npm run verify:audio` 的 `sfx-core` 审计严格校验 Opus 解码时长与原版 22.05 kHz WAV 时长误差 `<= 2.00ms`。过旧的 `ffmpeg` 构建（如 2018 年 N-47683 等早期重采样实现）在 `22.05kHz -> 48kHz` 重采样尾帧会多填充约 158 个采样点（系统性偏移约 `+3.3ms`），导致 `sfx-core` 出现 627/653 项时长校验失败。若遇到该报错，请升级至 `ffmpeg >= 7.0`（如 `7.0.2` 或 `8.1.2`）后重新执行 `npm run pack:sfx && npm run pack:manifest`。

##### 2) 放置原版 1.13c MPQ 文件
将原版 **Diablo II: Lord of Destruction v1.13c** 的 MPQ 文件放入（或软链接至）仓库根目录下的 `samples/d2/` 目录（也可通过环境变量 `D2_DATA_DIR=/path/to/mpq` 指定路径，推荐使用 `samples/d2/` 软链接以兼容所有独立脚本）：

```bash
mkdir -p samples/d2
# 例如软链接本机已有的 MPQ 目录：
# ln -s /path/to/your/d2-mpqs/*.mpq samples/d2/

# 确保以下 MPQ 存在（全量烘焙、bake:verify 与 verify:audio 同时读取 4 个数据 MPQ 与音频 MPQ）：
ls -lh samples/d2/
# 数据 (4 个): d2data.mpq   d2char.mpq   d2exp.mpq   Patch_D2.mpq
# 音频 (5 个): d2sfx.mpq   d2music.mpq   D2xMusic.mpq   d2speech.mpq   d2xtalk.mpq
```

##### 3) 执行全量烘焙与契约校验
```bash
# 1. 一键烘焙全部核心离线资源到 public/ 并自动生成 public/asset-manifest.json
#    按序执行 24 个子目标: animdata -> excel -> tiles -> characters -> char-layers -> entities ->
#    overlay-rows -> cursor -> missiles -> overlays -> ui -> frontend-ui -> skills ->
#    drop-data -> tbl -> weather -> sound-tables -> sfx -> music -> ambient-sounds ->
#    monster-sounds -> speech -> skill-sounds -> manifest
npm run bake -- all

# 2. （可选）如需烘焙 5 幕预烘焙场景包与世界拓扑图 (public/packs/act1..act5, index.json, world-graph.json)
npm run pack:acts && npm run pack:manifest

# 3. 烘焙完成后执行严格 Fail-Fast 契约校验
#    验证项: 233+3 个 DT1 瓦片图集 (0 缺失文件 + InvisWal 地板契约)、全 136 关通用 DT1 覆盖、
#           1.13c 掉落表对齐 (734 怪物 / 66 超级暗金 / 3 难度)、Schema 2 实体包完整性与
#           1.13c 音频审计 (与 npm run verify:audio 同一模块：tables / sfx-core / music 等全部已注册 section)
npm run bake:verify
```

> **提示（跨里程碑重烘与清理孤儿产物）**：`npm run pack:manifest` 会递归扫描 `public/` 下所有文件并写入 `public/asset-manifest.json`。当拉取更新后遇到烘焙目标新增、重命名或移除（例如早期版本遗留的 `public/sound/weather/*.wav`），建议在重新执行 `npm run bake -- all` 前先清理旧的 `public/` 烘焙目录，以免已废弃的孤儿文件残留在 `asset-manifest.json` 中。

##### 4) 分项烘焙命令与产物路径速查
如果修改了某个打包器或只需单独重烘某一部分资源，可使用以下细粒度命令（重烘后建议运行 `npm run pack:manifest` 刷新 SHA-256 清单）：

| 命令 (`npm run ...`) | 等价 Baker CLI 目标 | 输出路径 | 烘焙内容说明 |
| :--- | :--- | :--- | :--- |
| `npm run pack:tiles` | `npm run bake -- tiles` | `public/act-packs/tiles/` | 全部 5 幕 233 个关卡 DT1 + 3 个通用 DT1 (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`) 图集及 `drlg-bundle.{json,bin}` |
| `npm run pack:acts` | `npm run bake -- acts` | `public/packs/` | 5 幕预烘焙关卡场景 (`act1..act5/`)、场景物件图集、`index.json` 与 `world-graph.json` |
| `npm run pack:animdata` | `npm run bake -- animdata` | `public/anim/` | 提取 `AnimData.d2` 全量 COF 动画帧数、帧率与关键帧事件表 |
| *(无快捷别名)* | `npm run bake -- excel` | `src/common/**/generated/` | 从数据 MPQ 解析 1.13c `data\global\excel\*.txt` 表格并生成强类型运行时数据模块 |
| *(无快捷别名)* | `npm run bake -- characters` | `public/entities/` | 7 大职业基础躯干图集 (`char-*.r8` / `char-*.json`) 与 `character-manifest.json` |
| `npm run pack:char-so` | `npm run bake -- char-layers` | `public/chars/` | 7 大职业 16 部件纸娃娃（Paperdoll）武器/防具外观分层 DCC/COF 图集 |
| `npm run pack:entities` | `npm run bake -- entities` | `public/entities/` | 全部怪物、SuperUniques（自动捆绑随从 Minions）、NPC 与交互 Object 的 DCC/DC6/COF 图集 |
| `npm run pack:missiles` | `npm run bake -- missiles` | `public/missiles/` | `Missiles.txt` 全部投射物 32-bit RGBA 图集（含 `Trans: 1` 零黑边过滤与混合模式元数据） |
| `npm run pack:overlays` | `npm run bake -- overlays` | `public/overlays/` | `Overlays.txt` 光环、诅咒、Buff、命中特效、神殿图标与升级光柱 DCC 图集 |
| `npm run pack:ui` | `npm run bake -- ui` | `public/ui/` | 游戏内 HUD 面板、小地图图集 (`public/ui/automap/`)、地面/背包物品图集、技能图标与鼠标指针 |
| `npm run pack:level-entry-titles` | *(独立脚本)* | `public/ui/level-entry-titles.*` | 烘焙 136 关区域进入标题 (`Entering xxx` DC6 图集) 与 `src/common/world/level-entry-titles-113c.ts` |
| `npm run pack:frontend` | `npm run bake -- frontend-ui` | `public/ui/frontend/` | 战网登录、角色选择营火、7 职业创建动画、中英文字体图集与大厅前置界面资源 |
| *(无快捷别名)* | `npm run bake -- cursor` / `pd2-hd-cursor` | `public/ui/cursor.png` | 原版鼠标指针精灵图集与 `src/client/render/cursor-meta.ts`（及可选高清指针图集） |
| *(无快捷别名)* | `npm run bake -- skills` | `public/skills/` | 7 职业与通用技能图标 (`Skillicon.DC6` 等) 及 `manifest.json` |
| `npm run pack:weather` | `npm run bake -- weather` | `public/weather/weather.json` | 1.13c 天气系统 (`LoadWeather` `0x6fb31750`) 5 幕 `pal.dat` 调色板与 `Rain3`/`Rain4`/`bubble3` 溅射/气泡帧 |
| `npm run pack:sound-tables` | `npm run bake -- sound-tables` | `src/common/audio/` | 从数据 MPQ 提取 1.13c `Sounds.txt` (4,699 行)、`SoundEnviron.txt` (50 行) 与 `Levels.txt` `SoundEnv` (136 关)，生成 `sounds-113c.ts` 与 `sound-environ-113c.ts` |
| `npm run pack:sfx` | `npm run bake -- sfx` | `public/sound/packs/sfx-core{,-2,-3}.bin` | 使用 `ffmpeg` (`libopus` 32 kbps CBR Ogg Opus) 将 653 条核心常驻音效从 `d2sfx.mpq` / `d2exp.mpq` 等打包为 `core.bin` 与 `core.json` |
| `npm run pack:ambient-sounds` / `pack:monster-sounds` / `pack:speech` / `pack:skill-sounds` | `npm run bake -- ambient-sounds` / `monster-sounds` / `speech` / `skill-sounds` | `public/sound/packs/` | 使用 `ffmpeg` (`libopus`) 将环境音效、怪物音效、NPC 语音 (`d2speech.mpq`/`d2xtalk.mpq`) 与技能音效分包转码输出 |
| `npm run pack:music` | `npm run bake -- music` | `public/music/` | 使用 `ffmpeg` (`libopus` 64 kbps CBR WebM Opus) 将 34 首背景音乐与过场曲从 `d2music.mpq` / `D2xMusic.mpq` 等转码输出至 `public/music/` |
| *(无快捷别名)* | `npm run bake -- <table-target>` | `src/common/{data,i18n}/` | 权威数据表提取：`overlay-rows`、`drop-data`、`tbl`、`input-tables`、`monstats2-flags`、`monster-path` |
| `npm run pack:manifest` | `npm run bake -- manifest` | `public/asset-manifest.json` | 递归扫描 `public/` 计算文件大小与 16 位 SHA-256 哈希，供客户端 Service Worker 增量缓存失效使用 |
| `npm run pack:compress` | *(独立脚本)* | `public/**/*.{webp,gz,br}` | 原地预生成 `.png.webp`（无损）、`.jpg.webp`（`q=82`）及 `.r8`/`.bin`/`.json` 的 `.gz`/`.br` 静态压缩旁路，大幅降低下载带宽 |

此外还提供专项离线校验脚本：`npm run verify:entities`（校验 `public/entities/`）、`npm run verify:tiles` / `npm run verify:alignment`（校验瓦片像素与等距对齐）、`npm run verify:packs`（将 `public/packs/` 场景包与 MPQ 实时解码逐字节比对）、`npm run verify:audio`（1.13c 音频管线审计：`tables` 音效表逐字节重烘比对、`sfx-core` 653 条 Opus 样本与原版 WAV 时长/相关性校验、`music` 34 首曲目完整性校验）。

##### 5) 静态资源带宽优化（WebP / Gzip / Brotli 旁路预压缩）
由于 `public/` 下的烘焙美术与旁路压缩文件（`*.webp`、`*.gz`、`*.br`）体积较大且已被 `.gitignore` 忽略，**在另外的服务器上拉取最新代码（`git pull`）或首次完成烘焙后，需在目标服务器上执行一次 `npm run pack:compress` 以启用全量带宽优化**：

```bash
# 1. 确保目标服务器已安装 cwebp（若未安装：sudo apt-get update && sudo apt-get install -y webp；也可用 CWEBP_PATH 或 --cwebp 指定路径。若未安装 cwebp，脚本会显式告警并仅生成 .gz/.br 旁路）
# 2. 在目标服务器原地生成 .webp 与 .gz / .br 旁路文件（支持增量跳过，已生成过的文件会按 mtime 秒级跳过；仅保留体积 < 原文件 95% 的有效旁路）
npm run pack:compress
```

- **压缩收益**：
  - **图像旁路（`.png.webp` / `.jpg.webp`）**：`ui/`、`missiles/`、`overlays/`、`skills/` 等 RGBA 图集采用 `cwebp -quiet -lossless -z 3`（像素与 Alpha 100% 无损），首页背景 `.jpg`/`.jpeg` 采用 `cwebp -quiet -q 82`，整体图像传输体积减少约 **52.8%**。
  - **二进制与元数据旁路（`.gz` / `.br`）**：针对 `.r8` 调色板索引像素流、`drlg-bundle.bin`、`palette.bin`、`meta.bin` 与 `.json` 预生成静态压缩包，体积减少约 **88.9%**（其中 `drlg-bundle.bin` 从 20.68 MB 降至 **1.08 MB**，减少 **94.8%**）。
- **服务端协商方式**：
  1. **使用 Vite（`npm run dev` 或 `npm run preview`）直接提供服务**：[`vite.config.ts`](./vite.config.ts) 已内置 [`createSidecarAssetHttpMiddleware`](./src/baker/io/sidecar-compression.ts)，跑完 `npm run pack:compress` 后自动根据请求头 `Accept: image/webp` 与 `Accept-Encoding: br, gzip` 透明返回旁路文件（响应头带 `X-Asset-Sidecar: webp|br|gzip`），**无需修改任何前端 URL 或服务器配置**。
  2. **使用 Nginx 直接托管静态目录（`dist/` 或 `public/`）**：在执行 `npm run build` 前先运行 `npm run pack:compress`（Vite 构建会自动将 `public/` 下的 `.webp`/`.gz`/`.br` 一并复制到 `dist/`），并在 Nginx 配置中加入以下旁路协商规则：

```nginx
# 1) 在 http {} 块中根据 Accept 请求头映射 .webp 后缀
map $http_accept $webp_suffix {
    default   "";
    "~*webp"  ".webp";
}

server {
    # ... 其余站点配置 ...

    # 2) 开启 .gz 静态预压缩直出（针对 .r8 / .bin / .json / .js / .css）
    gzip_static on;
    # brotli_static on; # 若 Nginx 编译了 ngx_brotli 模块可一并开启

    # 3) 针对 .png / .jpg 请求优先回退同名 .webp 旁路文件（前端 URL 保持 .png / .jpg 不变）
    location ~* \.(png|jpe?g)$ {
        add_header Vary Accept;
        try_files $uri$webp_suffix $uri =404;
    }
}
```

---

#### 3.3 第三步：如何启动服务与连接游戏

##### 方式 A：本地开发模式启动（Vite Dev Server）

```bash
npm run dev
```

- 启动后浏览器访问 **`http://127.0.0.1:5173/play.html`**（访问根路径 `/` 也会自动重写到 `/play.html`）。
- **默认代理配置**：[`vite.config.ts`](./vite.config.ts) 已内置 `/d2net` WebSocket 代理（默认转发至远端测试服 `wss://www.laiseek.xyz/d2net/*`），因此本地启动后可直接登录进入游戏。
- **自定义切换 D2GS 服务器地址**：
  1. **URL 参数方式**：访问 `http://127.0.0.1:5173/play.html?wsBridge=wss://your-d2gs-domain.com/d2net`（或本地桥 `ws://127.0.0.1:8080/d2net`）。
  2. **UI 设置面板方式**：点击画面顶部 32px 工具栏右侧的 **⚙ Settings** 按钮，修改 **WS Bridge URL** 并保存刷新。

##### 方式 B：生产环境构建与静态部署

```bash
# 1. 全仓类型检查（同时校验 common / netproto / server / client / sw / baker / root 七套 tsconfig）
npm run typecheck

# 2. 运行全量单元与架构边界测试
npm test

# 3. 构建生产静态产物（输出至 dist/，若需部署在 /diablo2/ 子路径下可执行 npm run build:game 输出至 dist-game/）
npm run build

# 4. 本地预览生产构建包
npm run preview
```

在生产环境 Nginx 中，只需将构建生成的 `dist/` 目录挂载为静态站点根目录（或子路径 `/diablo2/`），并与 **3.1 节** 中的 `/d2net/{bnet,realm,game}` WebSocket 反向代理配置在同一个域名下，即可通过浏览器直接访问完整的在线暗黑 II 体验。

##### 方式 C：使用命令行无头 Bot 快速验证服务连通性

无需打开浏览器，可在终端使用 [`tools/d2-bot.ts`](./tools/d2-bot.ts) 直接测试 TCP 桥与 D2GS 建房/进图流程：

```bash
npm run bot -- --bridge wss://your-d2gs-domain.com/d2net --user <账号> --pass <密码> --char <角色名>
```

### 4. 许可证与素材授权

- **代码**：本项目自身编写的源代码以 **MIT License** 授权，全文见 [`LICENSE`](./LICENSE)。你可以自由使用、修改、分发、商用与再许可，唯一义务是保留原版权声明与许可声明（`Copyright (c) 2026 troytt`）。
- **文档**：本仓库中的文档与说明文字（`README.md`、`docs/`、`kb/`）同样以 MIT 授权，欢迎转载，建议注明出处。
- **第三方代码**：移植或参考的第三方实现（如 StormLib）遵循其各自协议，详见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。
- **游戏素材不在授权范围内**：由《暗黑破坏神 II》原版 MPQ 提取或衍生的美术、音频、数据表、字符串表等资产，其版权归 Blizzard Entertainment 所有，本仓库不予授权、也不随产物分发（见上方"离线资产烘焙"说明，`public/` 下烘焙产物已从 Git 移出）。使用本项目时，你必须自行合法持有游戏本体与对应 MPQ，并自行承担相应责任。
- **无商标授权**：MIT 不授予本项目名称或作者名义的商标与背书权，请勿以"官方"或其他误导性名义发布衍生作品。

---
---

<a id="english"></a>

## English

> [!WARNING]
> **Server-Side Development Status Notice**:
> - **Production Online Mode (Single-Client Mode, Ready)**: The browser runs the pure Web client ([`src/client`](./src/client) + [`src/netproto`](./src/netproto)) and connects directly to an external native C++ **PvPGN (`bnetd` / `d2cs` / `d2dbs`) + D2GS (v1.13c)** Battle.net server stack via a lightweight TCP-to-WebSocket bridge.
> - **Built-in TypeScript Server ([`src/server`](./src/server), Experimental / Gated Off by Default)**: Achieves **100.00% 1.13c formula-level parity** (`8.01M` values / all 357 `Skills.txt` rows), **100.0% character sheet & skill tooltip parity**, 221 skills across 7 classes, 5-Act quests + Pandemonium, `.d2s` v96 save I/O, and an experimental in-browser Single-Player loopback (`LocalLoopbackAdapter`, enabled locally via `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev`); however, **standalone `BNCS/MCP/D2GS` network daemons are not yet implemented**, and hostile `MonAI` timing plus ~233 shared-`GameInstance.rng` call sites currently bound strict frame-exact lockstep to **frames 60–66** (see **Section 2.1** below and [`src/server/README.md`](./src/server/README.md)).

### 1. Project Overview

This repository is a high-fidelity Web port of **Diablo II: Lord of Destruction (v1.13c)**. Every subsystem is engineered strictly against decompiled v1.13c binary assembly (`D2Common.dll`, `D2Client.dll`, `D2Game.dll`, `D2Net.dll`, `Bnclient.dll`, `D2MCPClient.dll`, `Fog.dll`, `D2Gfx.dll`, `D2Win.dll`, `D2Lang.dll`) and official MPQ data tables (`Levels.txt`, `LvlTypes.txt`, `SuperUniques.txt`, `Skills.txt`, `Missiles.txt`, `Objects.txt`, `TreasureClassEx.txt`, etc.) as the single source of ground truth:

- **1:1 Native Wire Protocol Compatibility**: Full implementation of BNCS (Battle.net authentication, account registration & chat on port `6112`), MCP (Realm character management, game creation & join on port `6113`), and D2GS (Huffman-compressed framing, 167 S2C opcodes, C2S commands, and `0x9C/0x9D` item bitstreams on port `4000`). The browser client connects directly to unmodified C++ **PvPGN + D2GS (1.13c)** servers through a lightweight TCP-to-WebSocket proxy.
- **Seed-Driven Deterministic DRLG Map Reconstruction & Pathfinding**: Bit-exact port of `D2Common.dll`'s 64-bit carry-multiply PRNG (`0x6FDAA9E0`), all three DRLG topology generators (Preset, Maze, and Outdoors), and the `D2Common` dynamic path/step/collision footprint engine (`src/common/path`). From the 32-bit `mapSeed` sent by D2GS alone, the browser reconstructs the exact tile map and sub-tile collision grid matching the C++ server.
- **WebGL2 Isometric Rendering & Offline Asset Pipeline**: A Node.js offline baking pipeline (`src/baker`) pre-compiles DT1/DS1 tiles, 7-class 16-component paperdoll DCC/COF animations, monster/NPC sprites, Missiles/Overlays VFX, PL2 palette transforms, and TBL string tables from original MPQ archives into static atlases and binary bundles. Paired with incremental Service Worker caching (`tsconfig.sw.json`), a 25Hz `LogicClock` tick accumulator, and batched WebGL2 rendering (including authentic 1.13c sheared perspective ground shadows and additive spell blending), the client delivers smooth 60fps gameplay.
- **Strict Modular Architecture & Pluggable Extension Isolation**: The codebase is partitioned into five core modules mirroring original DLL boundaries, an isolated top-level `plugins/` directory (shipping 24 built-in plugins: `kill-stats`, `drop-tracker`, `trade-hall`, `automap-reveal` [including lighting presets & weather overrides], `extended-viewports`, `hud-enhancements`, `ground-item-beam`, `quick-cast`, `next-game`, and 15 QoL plugins), and standalone developer tools (`tools/`). Seven independent `tsconfig*.json` configs and automated architectural boundary tests (`tests/arch/boundaries.test.ts`) enforce zero cross-layer leakage.

---

### 2. Module Overview & README Links

The source tree is strictly partitioned by responsibility. Click each module's `README.md` for bilingual documentation covering directory layout, core algorithms, and verification commands:

| Module Path | Original DLL Counterpart | Status | Runtime & Boundary Constraints | Core Responsibilities | Documentation |
| :--- | :--- | :---: | :--- | :--- | :--- |
| [`src/common`](./src/common) | `D2Common.dll` `Storm.dll` `D2Lang.dll` | ✅ Ready | Pure TypeScript (`ES2022`), zero DOM / zero Node.js dependencies | MPQ & binary format parsers (DC6/DCC/DT1/DS1/COF/PL2/TBL), `D2DataRegistry` tables, 1.13c DRLG level generators, `D2Common` dynamic pathfinding (`path/`), 64-bit `D2Rng`, and offline asset contracts (`pack-contract`) | [src/common/README.md](./src/common/README.md) |
| [`src/netproto`](./src/netproto) | `D2Net.dll` `Bnclient.dll` `D2MCPClient.dll` `Fog.dll` | ✅ Ready | Pure protocol stack, zero external module dependencies, sole entry `src/netproto/index.ts` | BNCS (`6112`) / MCP (`6113`) / D2GS (`4000`) bidirectional binary framing & codecs, XSHA-1 & CheckRevision auth, `Fog.dll` Huffman compression/decompression, 167 S2C opcode decoders & 44-variant `ServerEvent` S2C encoder, item bitstream parser, local lobby registration hooks, and WebSocket/TCP stream abstraction | [src/netproto/README.md](./src/netproto/README.md) |
| [`src/client`](./src/client) | `D2Client.dll` `D2Gfx.dll` `D2Win.dll` `D2Launch.dll` `D2Sound.dll` | ✅ Ready | Pure browser client (`DOM` + `WebGL2`), zero Node / zero `server` / zero `baker` / zero `plugins` dependencies | Portal `index.html` & game entry `play.html`, Battle.net login/char-select/lobby frontend, `OnlineSession` & `ClientWorld` state mirror, 25Hz `LogicClock`, WebAudio 1.13c engine (`audio/`), 4-tier graphics quality presets, mobile compact touch HUD (`ui/touch-controls.ts`), single-tab multiboxing (`multibox/`), quest guide & autopilot (`guide/`), non-intrusive `plugin-host/`, seed-driven DRLG map service, WebGL2 renderer, and classic HUD panels | [src/client/README.md](./src/client/README.md) |
| [`plugins/`](./plugins) | Client Extension Ecosystem | ✅ Ready | Browser extension layer (`DOM`), imports only `src/common`, `src/netproto/index.ts`, and `src/client/plugin-host/api.ts`; strict inter-plugin isolation | 24 pluggable quality-of-life extensions outside core (`kill-stats`, `drop-tracker`, `trade-hall`, `automap-reveal` with lighting presets & weather overrides, `extended-viewports`, `hud-enhancements`, `ground-item-beam`, `quick-cast`, `next-game`, plus 15 QoL extensions: `path-guide`, `item-info`, `loot-alerts`, `upgrade-hints`, `monster-resists`, `experience-bar`, `run-timer`, `stash-deposit-all`, `drag-interact`, `low-life-warning`, `town-portal-key`, `auto-gold-pickup`, `auto-potion`, `belt-refill`, `auto-combat`), hot-swappable via the top toolbar **Plugins** menu with automatic 1.13c vanilla fallback | [plugins/README.md](./plugins/README.md) |
| [`src/server`](./src/server) | `D2Game.dll` | 🟡 **Experimental (Known Gaps)** | Pure deterministic simulation (`ES2022` + `WebWorker`), no DOM / no Node / no wall-clock or `Math.random` | 325 files / ~141k LOC: implements 25fps `GameInstance`, 100.00% 1.13c formula parity, 221 skills across 7 classes, 5-Act quests/Cube/drops/trade, `.d2s` saves, Single-Player loopback (gated off by default), and 1–8 player `MultiClientRoomHost`; still lacks a standalone Battle.net daemon and full `MonAI` frame-exact lockstep past frame 60–66 | [src/server/README.md](./src/server/README.md) |
| [`src/baker`](./src/baker) | Offline Asset Baking Pipeline | ✅ Ready | Pure Node.js CLI (`types: ["node"]`), no DOM / no `client` / no `server` | Extracts and bakes Excel data tables (`excel`), tile atlases (`tiles`), character/monster/NPC entities (`entities`), projectiles (`missiles`), overlays (`overlays`), HUD/frontend UI, audio packs (`sfx`/`music`/`ambient-sounds`/`monster-sounds`/`speech`/`skill-sounds`), `AnimData.d2` tables (`animdata`), `site-config.ts` middleware, and SHA-256 `asset-manifest.json` from 1.13c MPQs | [src/baker/README.md](./src/baker/README.md) |
| [`tools/`](./tools) | Developer, Oracle & QA Tooling | ✅ Ready | Node.js / Wine / Headless Browser CLIs | Wine native 1.13c DLL differential Oracle suite (`tools/oracle/`), headless protocol test bot (`d2-bot.ts`), `.d2cap` packet capture replayer (`netproto-replay.ts`), `.d2s` save unlocker (`d2s-unlock.ts`), E2E browser verifier (`verify-play.ts`), and 1.13c DRLG/audio/render differential verification tools | [tools/README.md](./tools/README.md) |
| [`kb/`](./kb) | 1.13c Reverse-Engineering KB | ✅ Active (162 specs) | Markdown Reference Specs | 162 reverse-engineering specifications grounded in 1.13c DLL disassembly and MPQ tables (covering engine/Oracle hooks, combat, 210+ skills & missiles, monster AI, drops/Cube, wire protocols, 5-Act quests, UI, and audio) | [kb/README.md](./kb/README.md) |

#### Module Dependency Topology

```text
          ┌──────────────────┐          ┌────────────────────┐
          │    src/common    │          │    src/netproto    │
          │ (Pure TS Base)   │          │ (1.13c Wire Stack) │
          └────────┬─────────┘          └─────────┬──────────┘
                   │                              │
         ┌─────────┼──────────────────┐           │
         ▼         ▼                  ▼           ▼
┌─────────────┐ ┌──────────────┐   ┌─────────────────────────┐
│  src/baker  │ │  src/server  │   │       src/client        │
│ (Node CLI)  │ │ (Exp D2Game) │   │ (Browser WebGL2 Client) │
└─────────────┘ └──────┬───────┘   └────────────┬────────────┘
                       │                        ▲
                       │ (registers via         │ (plugin-host/api.ts only)
                       │  netproto lobby hooks) │
                       ▼                        │
            (play.html external)   ┌────────────┴────────────┐
            (loopback-adapter.ts)  │        plugins/         │
                                   │ (Isolated Extensions)   │
                                   └─────────────────────────┘
   *(Note: src/client/** has zero imports from src/server/** or plugins/**; play.html loads loopback-adapter.ts as an external module script to register optional Single-Player hooks on src/netproto)*
```

#### 2.1 Built-in Server (`src/server`) Current Status & Known Gaps

Using [`tools/oracle/`](./tools/oracle), the repository runs unmodified 1.13c `D2Common.dll` / `D2Game.dll` / `D2Client.dll` under Wine for function-level and frame-by-frame differential verification (full reports in [`docs/oracle/`](./docs/oracle) and [`src/server/README.md`](./src/server/README.md)):

- **What Is Working & Verified**:
  1. **100.00% 1.13c Formula-Level Bit-Exact Parity**: `tools/oracle/fn-sweep.ts` verifies **8,017,070 values across 3,752,296 calls** in all 12 formula categories (hit chance, block, resists, leech, damage, XP, frame lengths, StatOp, and **all 357 `Skills.txt` rows**) with **0 mismatches** against native DLLs.
  2. **100.0% Character Sheet & Skill Tooltip Parity**: Across 9 multi-class, Barbarian warcry (`BO/Shout/BC`), and Paladin aura (`Concentration/Fanaticism`) scenarios, all 23 character sheet fields and skill damage blocks match `D2Client.dll` 100.0%.
  3. **Broad Subsystem Implementation**: 25fps `GameInstance`, all 221 player skills across 7 classes, `8.16` fixed-point missiles & pierce, 129-entry `MonAI` dispatch, 5-Act quests + Akara Respec + Secret Cow Level + 6-boss Pandemonium event, 146 enabled Cube recipes, 78 runewords, `TreasureClassEx` drops, safe player trade, `.d2s` v96 I/O, and `RoomClientSession` (decoding 80 C2S opcodes & encoding all 44 `ServerEvent` variants).
  4. **Experimental Local Single-Player Loopback**: `play.html` wires `LocalLobbyProvider` + `LocalLoopbackAdapter` behind `singlePlayerEnabled: false` by default; enable locally via `VITE_ENABLE_SINGLE_PLAYER=1 npm run dev` (or `{ "singlePlayerEnabled": true }` in local `public/site-config.json`) to create/save `.d2s` characters and enter Single-Player in the browser.
- **Current Server Gaps (Why Production Deployments Default to Single-Client Mode)**:
  1. **No Standalone Battle.net Network Daemon**: `src/server` is an in-memory isomorphic library (zero Node.js socket/disk I/O); standalone Node.js servers listening on `:6112` (BNCS), `:6113` (MCP/Realm DB), and `:4000` (multi-room D2GS) are not yet implemented.
  2. **Frame-Exact Lockstep Divergence Past Frame 60–66**: All 10 Oracle golden traces match native `D2Game.dll` bit-for-bit through **frame 60–66** (town player track through **frame 155**), after which Warriv campfire wall-follow retries, hostile `MonAI` decision cadence, and ~**233** remaining shared-`GameInstance.rng` call sites cause frame trajectories to diverge (combat `SUnitDmg` distributions are verified via two-sided `N = 100,000` statistical parity tests).
  3. **Residual Fixed-Point Lookup & Dual-State Cleanup**: ~713 `Math.sin/cos/atan2/sqrt` floating-point calls remain vs. `Fog` integer tables; unit stats/states still bridge scalar fields with `UnitStatList`/`StateBus`; and legacy test-only `GameEngine` is not yet retired.
  4. **Main-Thread Execution & 5-Act Soak Coverage**: Browser Single-Player currently ticks on the main UI thread (not yet offloaded to a `WebWorker`), and full 5-Act Normal $\rightarrow$ Hell soak audits with geared item procs, absorb, and mercenary auras remain in progress.

---

### 3. Single-Client Mode Guide

For production online play, run the project in **Single-Client Mode**: the web frontend runs as a pure 1.13c online client ([`play.html`](./play.html)), while account authentication, character persistence, room management, and authoritative combat simulation are handled by a remote native **PvPGN (`bnetd` + `d2cs` + `d2dbs`) + D2GS (v1.13c)** server.

Setting up Single-Client Mode end-to-end involves three steps:

#### 3.1 Step 1: Set Up the TCP-to-WebSocket Bridge on the D2GS / PvPGN Host

Browsers only support WebSocket (`ws://` / `wss://`) and cannot open raw TCP sockets directly. Deploy **`websockify` + Nginx** on the PvPGN/D2GS host (or a gateway machine on the same LAN) to bridge the three WebSocket sub-paths to their corresponding native TCP ports:

```text
Browser Web Client (src/netproto WsStream)
  │
  ├─ wss://<host>/d2net/bnet   ──► Nginx :443 ──► websockify 127.0.0.1:7001 ──► PvPGN bnetd (TCP :6112)
  ├─ wss://<host>/d2net/realm  ──► Nginx :443 ──► websockify 127.0.0.1:7002 ──► PvPGN d2cs  (TCP :6113)
  └─ wss://<host>/d2net/game   ──► Nginx :443 ──► websockify 127.0.0.1:7003 ──► D2GS 1.13c  (TCP :4000)
```

##### 1) Install `websockify`
On your Linux gateway/host (e.g., Ubuntu/Debian):
```bash
sudo apt-get update && sudo apt-get install -y websockify nginx
```

##### 2) Configure `systemd` Services for the 3 Bridge Ports
Create `/etc/d2ws` and the three endpoint environment files (if `D2GS.exe` runs on a separate LAN Windows machine, replace `127.0.0.1` in `TARGET` with that machine's LAN IP):

```bash
sudo mkdir -p /etc/d2ws

# 1. BNCS (bnetd, TCP 6112)
sudo tee /etc/d2ws/bnet.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7001
TARGET=127.0.0.1:6112
EOF

# 2. MCP Realm (d2cs, TCP 6113)
sudo tee /etc/d2ws/realm.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7002
TARGET=127.0.0.1:6113
EOF

# 3. D2GS Game Server (D2GS.exe 1.13c, TCP 4000)
sudo tee /etc/d2ws/game.env >/dev/null <<'EOF'
LISTEN=127.0.0.1:7003
TARGET=127.0.0.1:4000
EOF
```

Create the systemd template unit `/etc/systemd/system/d2ws@.service` and enable all three instances:

```bash
sudo tee /etc/systemd/system/d2ws@.service >/dev/null <<'EOF'
[Unit]
Description=Diablo II WebSocket-to-TCP Bridge (%i)
After=network.target

[Service]
Type=simple
EnvironmentFile=/etc/d2ws/%i.env
ExecStart=/usr/bin/websockify --heartbeat=30 ${LISTEN} ${TARGET}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now d2ws@bnet d2ws@realm d2ws@game
```

##### 3) Configure Nginx `/d2net/*` WebSocket Reverse Proxy
Add the `/d2net/` locations inside your Nginx `server` block (e.g., `/etc/nginx/sites-enabled/default`):

```nginx
# BNCS (Port 6112)
location = /d2net/bnet {
    proxy_pass http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}

# MCP Realm (Port 6113)
location = /d2net/realm {
    proxy_pass http://127.0.0.1:7002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}

# D2GS Game Server (Port 4000)
location = /d2net/game {
    proxy_pass http://127.0.0.1:7003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

Reload Nginx and verify that all bridge services are active:
```bash
sudo nginx -t && sudo systemctl reload nginx
systemctl is-active d2ws@bnet d2ws@realm d2ws@game
```

> **Tip**: The client's `createWsBridgeResolver` ([`src/netproto/transport/endpoint.ts`](./src/netproto/transport/endpoint.ts)) automatically rewrites connections based on the target port returned during protocol handshakes (`6112` $\rightarrow$ `/bnet`, `6113` $\rightarrow$ `/realm`, `4000` $\rightarrow$ `/game`). You do not need to alter the internal IP advertised by D2GS—just keep the standard ports `6113` and `4000` in PvPGN's `realm.conf` / `address_translation.conf`.

---

#### 3.2 Step 2: Offline Asset Baking

Because original game art and audio are copyrighted and the generated PNG/binary atlases are large, all baked artifacts under `public/` (`public/act-packs/`, `public/anim/`, `public/chars/`, `public/entities/`, `public/missiles/`, `public/music/`, `public/overlays/`, `public/packs/`, `public/sfx/`, `public/skills/`, `public/ui/`, `public/weather/`, and `public/asset-manifest.json`) are excluded from Git via `.gitignore`. **On a fresh clone, you must run the offline baking pipeline before starting `npm run dev`, running `npm run build`, or executing asset-dependent tests.**

##### 1) Install Dependencies & System Transcoders (`ffmpeg` & `webp`)
```bash
npm install

# Baking sound effects (pack:sfx) and music (pack:music) requires ffmpeg compiled with libopus (ffmpeg >= 7.0 recommended, e.g. 7.0.2 or 8.1.2);
# Static lossless WebP sidecar generation (pack:compress) requires cwebp (installed via the webp package on Debian/Ubuntu):
# sudo apt-get update && sudo apt-get install -y ffmpeg webp
/usr/bin/ffmpeg -version
cwebp -version
```

> **Note on `ffmpeg` Path & Version Sensitivity**:
> - **Executable Path**: Defaults to `/usr/bin/ffmpeg`. If your `ffmpeg` binary lives elsewhere (e.g. Homebrew `/opt/homebrew/bin/ffmpeg` or a custom build), pass `FFMPEG_PATH=/path/to/ffmpeg` or the CLI flag `npm run bake -- all --ffmpeg /path/to/ffmpeg` (also supported on `npm run pack:sfx -- --ffmpeg /path/to/ffmpeg`).
> - **Version Requirement (`ffmpeg >= 7.0` recommended)**: The `sfx-core` audit in `npm run bake:verify` / `npm run verify:audio` enforces `|decodedOpusSec - wavSec| <= 2.00ms`. Legacy `ffmpeg` builds (such as 2018 `N-47683` builds) append `~158` trailing samples (`~+3.3ms` systematic drift) when resampling `22.05kHz -> 48kHz`, causing 627/653 rows in `sfx-core` to fail duration verification. If you encounter this failure, upgrade to `ffmpeg >= 7.0` and re-run `npm run pack:sfx && npm run pack:manifest`.

##### 2) Provide Original 1.13c MPQ Archives
Copy or symlink your original **Diablo II: Lord of Destruction v1.13c** MPQ files into `samples/d2/` at the repository root (you can also set `D2_DATA_DIR=/path/to/mpq`, though symlinking `samples/d2/` is recommended for compatibility across all standalone scripts):

```bash
mkdir -p samples/d2
# Example: symlink from an existing local MPQ folder
# ln -s /path/to/your/d2-mpqs/*.mpq samples/d2/

# Ensure these MPQs are present (the full bake, bake:verify, and verify:audio read both the 4 data MPQs and the audio MPQs):
ls -lh samples/d2/
# Data (4): d2data.mpq   d2char.mpq   d2exp.mpq   Patch_D2.mpq
# Audio (5): d2sfx.mpq   d2music.mpq   D2xMusic.mpq   d2speech.mpq   d2xtalk.mpq
```

##### 3) Run Full Bake & Contract Verification
```bash
# 1. Bake all core offline assets into public/ and generate public/asset-manifest.json
#    Sequentially runs 24 targets: animdata -> excel -> tiles -> characters -> char-layers -> entities ->
#    overlay-rows -> cursor -> missiles -> overlays -> ui -> frontend-ui -> skills ->
#    drop-data -> tbl -> weather -> sound-tables -> sfx -> music -> ambient-sounds ->
#    monster-sounds -> speech -> skill-sounds -> manifest
npm run bake -- all

# 2. (Optional) Bake 5-act prebaked map scenes & world graph (public/packs/act1..act5, index.json, world-graph.json)
npm run pack:acts && npm run pack:manifest

# 3. Run fail-fast integrity & contract verification
#    Audits: 233+3 DT1 tile atlases (0 missing files + InvisWal floor contract), 136-level universal DT1
#            resolution, 1.13c drop table parity (734 MonsterKinds / 66 SuperUniques / 3 DifficultyLevels),
#            Schema 2 entity packs, and the 1.13c audio audit (the npm run verify:audio module: tables / sfx-core / music, etc.)
npm run bake:verify
```

> **Tip (Re-baking Across Milestones & Cleaning Orphan Artifacts)**: `npm run pack:manifest` recursively indexes every file present under `public/` into `public/asset-manifest.json`. When bake targets are added, renamed, or removed across milestones (for example, legacy `public/sound/weather/*.wav` files), clean your existing `public/` directory before running `npm run bake -- all` so stale orphan files are not left in `asset-manifest.json`.

##### 4) Granular Bake Commands & Canonical Output Paths
When iterating on a specific packer or refreshing a single asset category, use the granular commands below (run `npm run pack:manifest` afterward to refresh SHA-256 hashes):

| Command (`npm run ...`) | Equivalent Baker CLI Target | Output Path | Description |
| :--- | :--- | :--- | :--- |
| `npm run pack:tiles` | `npm run bake -- tiles` | `public/act-packs/tiles/` | Bakes all 5-act 233 level DT1s + 3 universal DT1s (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`) and `drlg-bundle.{json,bin}` |
| `npm run pack:acts` | `npm run bake -- acts` | `public/packs/` | Bakes 5-act prebaked level scenes (`act1..act5/`), object pages, `index.json`, and `world-graph.json` |
| `npm run pack:animdata` | `npm run bake -- animdata` | `public/anim/` | Extracts `AnimData.d2` COF frame count, animation speed, and keyframe trigger tables |
| *(no shortcut)* | `npm run bake -- excel` | `src/common/**/generated/` | Parses 1.13c `data\global\excel\*.txt` tables from the data MPQs into generated TypeScript modules |
| *(no shortcut)* | `npm run bake -- characters` | `public/entities/` | Bakes 7-class base torso atlases (`char-*.r8` / `char-*.json`) and `character-manifest.json` |
| `npm run pack:char-so` | `npm run bake -- char-layers` | `public/chars/` | Bakes 7-class 16-component paperdoll weapon/armor layer DCC/COF atlases |
| `npm run pack:entities` | `npm run bake -- entities` | `public/entities/` | Bakes all monsters, SuperUniques (auto-bundling Minions), NPCs, and interactive Objects DCC/DC6/COF atlases |
| `npm run pack:missiles` | `npm run bake -- missiles` | `public/missiles/` | Bakes all `Missiles.txt` projectile 32-bit RGBA atlases (with `Trans: 1` zero-black-fringe filtering & blend metadata) |
| `npm run pack:overlays` | `npm run bake -- overlays` | `public/overlays/` | Bakes all `Overlays.txt` auras, curses, buffs, hit VFX, shrine icons, and level-up DCC atlases |
| `npm run pack:ui` | `npm run bake -- ui` | `public/ui/` | Bakes in-game HUD panels, automap atlases (`public/ui/automap/`), ground/inventory item atlases, skill icons, and cursors |
| `npm run pack:level-entry-titles` | *(standalone script)* | `public/ui/level-entry-titles.*` | Bakes 136-level area entry banners (`Entering xxx` DC6 atlas) and `src/common/world/level-entry-titles-113c.ts` |
| `npm run pack:frontend` | `npm run bake -- frontend-ui` | `public/ui/frontend/` | Bakes Battle.net login, character select campfire, 7-class creation animations, EN/ZH font atlases, and lobby UI assets |
| *(no shortcut)* | `npm run bake -- cursor` / `pd2-hd-cursor` | `public/ui/cursor.png` | Bakes 1.13c cursor sprite sheet and generates `src/client/render/cursor-meta.ts` (plus optional HD cursor atlas) |
| *(no shortcut)* | `npm run bake -- skills` | `public/skills/` | Extracts 7-class and generic skill icon sprites (`Skillicon.DC6`, etc.) and `manifest.json` |
| `npm run pack:weather` | `npm run bake -- weather` | `public/weather/weather.json` | Extracts 1.13c weather (`LoadWeather` `0x6fb31750`) 5-act `pal.dat` palettes and `Rain3`/`Rain4`/`bubble3` frames |
| `npm run pack:sound-tables` | `npm run bake -- sound-tables` | `src/common/audio/` | Extracts the 1.13c `Sounds.txt` (4,699 rows), `SoundEnviron.txt` (50 rows) and `Levels.txt` `SoundEnv` (136 levels) from the data MPQs into `sounds-113c.ts` and `sound-environ-113c.ts` |
| `npm run pack:sfx` | `npm run bake -- sfx` | `public/sound/packs/sfx-core{,-2,-3}.bin` | Transcodes the 653 core resident SFX from `d2sfx.mpq` / `d2exp.mpq` into 32 kbps CBR Ogg Opus (`core.bin` + `core.json`) via `ffmpeg` (`libopus`) |
| `npm run pack:ambient-sounds` / `pack:monster-sounds` / `pack:speech` / `pack:skill-sounds` | `npm run bake -- ambient-sounds` / `monster-sounds` / `speech` / `skill-sounds` | `public/sound/packs/` | Transcodes ambient soundscapes, monster SFX, NPC speech (`d2speech.mpq`/`d2xtalk.mpq`), and skill SFX into Opus packs via `ffmpeg` (`libopus`) |
| `npm run pack:music` | `npm run bake -- music` | `public/music/` | Transcodes the 34 BGM & cutscene tracks from `d2music.mpq` / `D2xMusic.mpq` into 64 kbps CBR WebM Opus under `public/music/` via `ffmpeg` (`libopus`) |
| *(no shortcut)* | `npm run bake -- <table-target>` | `src/common/{data,i18n}/` | Extracts canonical 1.13c tables: `overlay-rows`, `drop-data`, `tbl`, `input-tables`, `monstats2-flags`, `monster-path` |
| `npm run pack:manifest` | `npm run bake -- manifest` | `public/asset-manifest.json` | Recursively scans `public/` to compute byte sizes and 16-hex SHA-256 hashes for incremental Service Worker cache invalidation |
| `npm run pack:compress` | *(standalone script)* | `public/**/*.{webp,gz,br}` | Pre-generates in-place `.png.webp` (lossless), `.jpg.webp` (`q=82`), and `.gz`/`.br` sidecars for `.r8`/`.bin`/`.json` assets to cut download bandwidth |

Additional standalone audit scripts are also available: `npm run verify:entities` (audits `public/entities/`), `npm run verify:tiles` / `npm run verify:alignment` (audits tile pixels and isometric alignment), `npm run verify:packs` (compares `public/packs/` scene JSONs byte-for-byte against live MPQ decoding), and `npm run verify:audio` (1.13c audio pipeline audit: `tables` byte-identical MPQ re-bake, `sfx-core` 653 Opus sample duration/correlation vs. 1.13c WAV, and `music` 34-track verification).

##### 5) Static Asset Bandwidth Optimization (WebP / Gzip / Brotli Sidecars)
Because baked `public/` assets and sidecar files (`*.webp`, `*.gz`, `*.br`) are excluded from Git via `.gitignore`, **after pulling the latest code (`git pull`) or baking on another server, run `npm run pack:compress` once on that server to enable full bandwidth savings**:

```bash
# 1. Ensure cwebp is installed on the target server (Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y webp, or set CWEBP_PATH / pass --cwebp <path>; if cwebp is missing, an explicit warning is emitted and .webp sidecars are skipped)
# 2. Generate in-place .webp and .gz / .br sidecars (incremental: already up-to-date files are skipped by mtime; only sidecars < 95% of source bytes are kept)
npm run pack:compress
```

- **Bandwidth Savings**:
  - **Image Sidecars (`.png.webp` / `.jpg.webp`)**: `ui/`, `missiles/`, `overlays/`, and `skills/` RGBA atlases are encoded with `cwebp -quiet -lossless -z 3` (100% pixel & alpha identical), while home background `.jpg`/`.jpeg` images use `cwebp -quiet -q 82`, reducing image payload size by **~52.8%**.
  - **Binary & JSON Sidecars (`.gz` / `.br`)**: Pre-compresses `.r8` indexed sprite sheets, `drlg-bundle.bin`, `palette.bin`, `meta.bin`, and `.json` metadata, cutting transfer size by **~88.9%** (e.g. `drlg-bundle.bin` drops from 20.68 MB to **1.08 MB**, **-94.8%**).
- **Server Content Negotiation**:
  1. **Serving via Vite (`npm run dev` or `npm run preview`)**: [`vite.config.ts`](./vite.config.ts) registers [`createSidecarAssetHttpMiddleware`](./src/baker/io/sidecar-compression.ts), which automatically negotiates `Accept: image/webp` and `Accept-Encoding: br, gzip` (adding `X-Asset-Sidecar: webp|br|gzip`) with **zero client URL changes or extra server config**.
  2. **Serving `dist/` or `public/` Directly via Nginx**: Run `npm run pack:compress` before `npm run build` (Vite copies all `.webp`/`.gz`/`.br` sidecars from `public/` into `dist/`), and add the following rules to your Nginx configuration:

```nginx
# 1) Inside http {}: map Accept: image/webp to the .webp sidecar suffix
map $http_accept $webp_suffix {
    default   "";
    "~*webp"  ".webp";
}

server {
    # ... existing site configuration ...

    # 2) Enable static pre-compressed .gz serving for .r8 / .bin / .json / .js / .css
    gzip_static on;
    # brotli_static on; # Enable if ngx_brotli is installed

    # 3) Transparently serve .png.webp / .jpg.webp when present while keeping client URLs unchanged
    location ~* \.(png|jpe?g)$ {
        add_header Vary Accept;
        try_files $uri$webp_suffix $uri =404;
    }
}
```

---

#### 3.3 Step 3: Start the Server & Connect to the Game

##### Option A: Local Development Server (Vite Dev Server)

```bash
npm run dev
```

- Open **`http://127.0.0.1:5173/play.html`** in your browser (visiting `/` automatically redirects to `/play.html`).
- **Default Proxy**: [`vite.config.ts`](./vite.config.ts) includes a built-in `/d2net` WebSocket proxy (forwarding to `wss://www.laiseek.xyz/d2net/*` by default), so you can log in and play immediately after starting `npm run dev`.
- **Custom D2GS Server Endpoint**:
  1. **Via URL Query Parameter**: Open `http://127.0.0.1:5173/play.html?wsBridge=wss://your-d2gs-domain.com/d2net` (or local bridge `ws://127.0.0.1:8080/d2net`).
  2. **Via In-Game Toolbar Settings**: Click the **⚙ Settings** button on the right side of the top 32px toolbar, update **WS Bridge URL**, and save.

##### Option B: Production Build & Static Deployment

```bash
# 1. Full-repo typecheck across all 7 tsconfig projects (common / netproto / server / client / sw / baker / root)
npm run typecheck

# 2. Run unit and architectural boundary test suites
npm test

# 3. Build production static bundle into dist/ (or run npm run build:game for /diablo2/ subpath output in dist-game/)
npm run build

# 4. Preview the production bundle locally
npm run preview
```

In production Nginx, serve the generated `dist/` directory as your static root (or under `/diablo2/`) alongside the `/d2net/{bnet,realm,game}` WebSocket reverse proxy from **Section 3.1** on the same domain.

##### Option C: Headless CLI Bot Connectivity Check

Verify your WebSocket bridge and D2GS room creation/entry directly from the terminal without opening a browser using [`tools/d2-bot.ts`](./tools/d2-bot.ts):

```bash
npm run bot -- --bridge wss://your-d2gs-domain.com/d2net --user <account> --pass <password> --char <character>
```

## License

- **Code**: all source code authored for this project is released under the **MIT License** — see [`LICENSE`](./LICENSE). You may use, modify, distribute, commercialize and sublicense it freely; the only obligation is to retain the copyright and permission notice (`Copyright (c) 2026 troytt`).
- **Documentation**: the docs in this repository (`README.md`, `docs/`, `kb/`) are likewise MIT-licensed; attribution is appreciated.
- **Third-party code**: ported or referenced third-party implementations (e.g. StormLib) remain under their own licenses — see [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
- **Game assets are NOT licensed here**: art, audio, data tables, string tables and any other assets extracted from or derived from Blizzard's original *Diablo II* MPQs remain the property of Blizzard Entertainment. They are neither licensed by this repository nor distributed with it (see the asset-baking note above; baked `public/` output is excluded from Git). You must legally own the game and its MPQs, and you are responsible for your own compliance.
- **No trademark grant**: MIT grants no rights to the project's name or the author's identity for endorsement purposes. Do not publish derivatives in a way that implies official status.
