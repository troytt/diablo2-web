# `src/client` — 纯浏览器 WebGL2 渲染与交互客户端 / Pure Browser WebGL2 Rendering & Interactive Client

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/client` 是 **Diablo II: Lord of Destruction (v1.13c)** 的纯浏览器客户端实现，对标原版 `D2Client.dll`、`D2Gfx.dll`、`D2Win.dll`、`D2Launch.dll` 与 `D2Sound.dll`。

在生产默认的**单客户端模式（Single-Client Mode）**下，本模块仅通过 `src/netproto` 的 WebSocket 桥接协议与远端原生 C++ PvPGN + D2GS (1.13c) 通信，在浏览器端完成种子驱动的 DRLG 地图重建、25Hz `LogicClock` 逻辑帧同步、WebGL2 等距视角渲染（含 1.13c 人物/怪物斜向透视地面阴影、7 职业纸娃娃分层染色与 4 档画质预设）、客户端移动预测、全套经典 UI 交互及移动端紧凑触控 HUD（`ui/touch-controls.ts`）；当部署站点显式开启实验性单机开关（`singlePlayerEnabled: true`）时，亦可通过 `src/netproto` 注册的 `LocalLobbyProvider` / `LocalLoopbackAdapter` 无缝驱动本地单机角色与 `.d2s` 存档。

### 1. 模块职责与架构边界

- **主页面入口、单机门控与非侵入式插件宿主**：
  - [`index.html`](../../index.html) 为庇护之地主页门户，[`play.html`](../../play.html) 作为游戏客户端顶层组合根（Composition Root）：外部 `<script type="module" src="/src/server/loopback-adapter.ts">` 负责向 `src/netproto` 注册可选单机回环钩子（默认由 [`src/client/config/site-config.ts`](./config/site-config.ts) 读取 `/site-config.json` 或 `VITE_ENABLE_SINGLE_PLAYER` 并严格默认关闭 `singlePlayerEnabled: false`），内联 `<script type="module">` 仅导入 [`src/client/main.ts`](./main.ts) 的 `startPlayApp` 与 [`plugins/index.ts`](../../plugins/index.ts) 的 `BUILTIN_PLUGINS`、`PLUGIN_MENU_LAYOUT` 并启动客户端。
  - 可选客户端扩展插件统一解耦至顶层 [`plugins/`](../../plugins) 目录（内置 `kill-stats`、`drop-tracker`、`trade-hall`、`automap-reveal`（含小地图全图透视、雷达标记、光照预设与天气模式）、`extended-viewports`、`hud-enhancements`、`ground-item-beam`、`quick-cast`、`next-game` 及 15 项 QoL 扩展共 24 个插件，以及独立页面 [`plugins/kill-stats/index.html`](../../plugins/kill-stats/index.html)、[`plugins/drop-tracker/index.html`](../../plugins/drop-tracker/index.html) 和 [`plugins/trade-hall/index.html`](../../plugins/trade-hall/index.html)）。
  - `src/client` 通过 [`src/client/plugin-host/`](./plugin-host) 向插件提供只读会话视图（`PluginSessionView`）、受控客户端增强能力门面（`PluginClientCapabilities`）、动态工具栏句柄（`ToolbarContributionHandle.update`）、生命周期与语言切换钩子以及顶部工具栏插件配置菜单（`PluginMenu`，挂载 `data-d2-modal-overlay="plugins"` 并配合 `ui/dom-overlay.ts` 的 `isModalDomOverlayOpen()` 实现键盘输入隔离）。当插件被禁用时，宿主自动回退至 1.13c 原版默认行为（迷雾探索 `automapReveal: 'off'`、小地图雷达关闭、原版关卡光照 `lightingPreset: 'auto'`、原版天气 `weatherOverride: 'off'`、原版 `640x480` / `800x600` 分辨率、原版 HUD 数值显示）。**`src/client/**` 对 `src/server/**` 与 `plugins/**` 均保持零导入，且严禁包含任何具体插件 ID 引用**（由 `tests/arch/boundaries.test.ts` Rules 2 & 7–11 强制守卫）。
- **TypeScript 工程约束（`tsconfig.client.json` & `tsconfig.sw.json`）**：
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: []`（Service Worker 独立使用 `tsconfig.sw.json`）。
  - **严禁依赖 `src/server` 或 `src/baker`**，严禁导入任何 Node.js 内置模块（`fs`, `path`, `net`, `Buffer` 等）。
  - 仅依赖 `src/common`（DRLG 算法、动态寻路、格式解析器、数据表定义）与 `src/netproto`（协议唯一门面 `src/netproto/index.ts`）。

---

### 2. 目录结构

```text
src/client/
├── main.ts          # 客户端主入口：组装 WebGL2 画布、工具栏、前端战网/单机状态机、OnlineSession、PluginHost 与渲染循环
├── config/          # 部署级站点配置加载器 (site-config.ts：从 /site-config.json 或 VITE_ENABLE_SINGLE_PLAYER 解析 singlePlayerEnabled，默认 fail-closed false)
├── loop/            # 1.13c LogicClock：25Hz (40ms) 逻辑帧累加器、帧债追赶与 10s/3s 免追赶窗口保护
├── session/         # OnlineSession 会话协调器、单机存档桥接、.d2cap 离线重放器与 C2S 发包速率限制器 (OutboundRateLimiter)
├── world/           # ClientWorld & ClientUnit：由 ServerEvent 驱动的客户端权威状态镜像、对象 OP->ON 自动流转、静态 NPC 占位符互斥隐藏与碰撞盒计算
├── map/             # 种子驱动的客户端 DRLG 地图服务 (MapService, LevelView, TileAtlas GPU 瓦片加载)
├── automap/         # 1.13c 小地图网格管理、迷雾探索持久化、全图揭示模式 (off / level / act) 与怪物/神龛雷达标记
├── input/           # CommandMapper：鼠标/键盘/触控指令映射、1.13c 点击规则表 (click-rules-113c)、近战交互距离校验、城镇施法限制、120ms 移动合批与辅助策略
├── motion/          # 本地玩家移动预测 (LocalMovementPredictor)、远端实体插值器与动态寻路桥接
├── render/          # WebGL2 渲染管线 (SpriteRenderer draw/drawQuad, d2gl-postfx 后处理与 Gamma/对比度曲线, TileAtlasGpuCache, EntityArtLoader, 8 种 D2Gfx 混合模式)
├── scene/           # WorldRenderer (等距深度排序、lower-wall 16..19 先于地板层、上层墙遮挡淡出与 POPS 屋顶揭开、斜向透视地面阴影、7 职业纸娃娃分层染色、投射物/覆盖层/冰冻碎裂融水/怪物死亡特效) 与环境光照预设
├── weather/         # 1.13c WeatherEngine 雨/雪/闪电/雨滴水花/泥沼气泡粒子系统与天气资源加载器 (weather-assets)
├── audio/           # 1.13c WebAudio 音频引擎 (Sounds.txt 200 记录池、4 立体声+12 单声道抢占、S2C 0x2C 事件码分发、SoundEnviron 环境音、BGM 与 NPC 语音流)
├── view/            # 视口分辨率配置 (ViewportProfile: 640x480 / 800x600 / 1024x768 / 1068x600 / 1280x720) 与 SceneSource
├── ui/              # 游戏内 HUD 渲染与交互 (HudManager, 底部状态栏, 移动端紧凑触控 HUD touch-controls.ts, Minimap, 7 大面板, 玩家面对面交易面板, useitem 窗口, 区域进入横幅 Entering xxx, A5Q6 胜利画面, D2 点阵字体渲染)
├── ui-model/        # UI 纯视图状态模型 (HudModel, 角色面板双 AR/伤害引擎、套装加成、技能树、背包网格、商店/赌博/玩家交易/注入/方块交互)
├── guide/           # 五幕任务阶段图谱、跨层寻路引导 (LevelGraph / FlowField)、地面导航丝带与自动驾驶 (Autopilot)
├── multibox/        # 单标签页多开实例管理器 (MultiInstanceManager, SharedAssetPool 共享 GPU/音频纹理池, 焦点音频静音策略)
├── frontend/        # 战网与单机前置界面 (FrontendRenderer：中英双语 Gateway 选择、账号登录/注册、8 角色 11-byte statstring 纸娃娃预览、建房/加房大厅)
├── toolbar/         # 顶部 32px 工具栏 (连接状态与 RTT、服务器地址、分辨率与画质预设、多开标签切换、音量/语言控制、Plugins 菜单与动态插件插槽)
├── plugin-host/     # 非侵入式插件宿主与配置中心 (PluginHost, PluginConfigStore, PluginMenu, ModMenu 与公共契约 api.ts)
├── theme/           # 暗黑风格全局样式与插件菜单皮肤 (shell.css, plugin-menu.css)
├── i18n/            # 客户端中英双语状态管理 (lang.ts) 与本地化辅助函数
├── settings/        # 客户端持久化设置存储 (SettingsStore、default.key 57 项键位映射 key-bindings.ts、4 档画质预设 graphics-quality.ts 与 /players N 跨局持久化)
└── sw/              # Service Worker (sw.ts) + CacheUpdater：基于 SHA-256 清单的离线资产增量缓存
```

---

### 3. 核心数据流与子系统详解

#### 3.1 单客户端连接与会话生命周期 (`frontend/`, `session/`, `world/`)
1. **战网前置流程 (`FrontendRenderer` + `D2OnlineFlow`)**：
   - 启动后加载 `/ui/frontend/frontend-ui.json`，渲染原版风格登录界面、新账号注册、角色选择界面（解析 11 字节 `statstring` 实时合成 7 职业多部位纸娃娃预览）与战网大厅（Create Game / Join Game 房间列表），支持中英文界面动态切换（当站点配置 `singlePlayerEnabled: true` 时同时开放本地 Single Player 角色档案管理）。
   - 通过 `wsBridgeUrl`（默认 `/d2net`，可通过 URL 参数 `?wsBridge=...` 或顶部工具栏 Settings 面板配置）依次握手 BNCS (`/bnet`) 与 MCP (`/realm`)。
2. **进入游戏 (`OnlineSession` + `ClientWorld`)**：
   - 拿到 MCP 颁发的 `GameHash` 与 `GameToken` 后，连接 D2GS (`/game`) 并创建 `D2gsServerAdapter`（单机模式下则创建已注册的 `LocalLoopbackAdapter`）。
   - `OnlineSession` 订阅全部 `ServerEvent`，实时更新 `ClientWorld` 中的本地玩家属性、背包/穿戴物品、周围怪物/NPC 状态（含城镇静态占位 Object 与动态 NPC 互斥去重）、地面掉落与任务/小站进度，并支持所有交互对象（传送门、小站、憎恨囚牢第 3 层地狱之门 `HellGate` 等）从 `OP (1)` 到 `ON (2)` 模式的平滑循环动画过渡。

#### 3.2 种子驱动的客户端 DRLG 地图重建 (`map/`, `automap/`)
原生 D2GS **不会**在网络上传输完整的瓦片地图数据，仅在 `0x03 (LoadAct)` 包中下发 **32 位 `mapSeed`** 与当前 `areaId`（并伴随 `0x07/0x08` 房间加载通知）：
- `MapService` 在收到 `LoadAct` 后，使用 `src/common/drlg` 与服务端完全一致的 1.13c DRLG 算法，根据 `mapSeed` 在浏览器端毫秒级还原整张地图的 Floor / Wall / Roof / Collision 网格。
- 从 `/act-packs/tiles/` 按需流式加载对应 `LvlType` 的瓦片图集并上传至 `TileAtlasGpuCache`。

#### 3.3 25Hz 逻辑时钟、移动预测与网络平滑 (`loop/`, `motion/`, `input/`)
- **`LogicClock` (`loop/`)**：严格按照 1.13c 25Hz (40ms/tick) 固定步长推进客户端模拟与动画帧，保留帧债并在绘制前追赶（内置 10s/3s 异常挂起免追赶保护窗口）。
- **`LocalMovementPredictor` & `CommandMapper`**：玩家左键点击地面、可通行桥梁（如 `MephistoBridge`）或已开启门洞时，本地沿寻路网格按角色 `Velocity` 推进预测坐标，同时由 `OutboundRateLimiter`（120ms 移动合批节流）向 D2GS 发送移动/奔跑包，并在交互 NPC、宝箱、小站或传送门前校验近战接触距离。
- **`RemoteEntityInterpolator`**：结合 D2GS 下发的 `0x67/0x68/0x69/0x6D` 速度与漂移校正点，将离散实体移动转化为 60fps 连续内插位移与 25Hz 逐帧转身过渡。

#### 3.4 WebGL2 等距视角渲染器、画质预设与经典/触控 HUD (`render/`, `scene/`, `ui/`, `audio/`, `settings/`)
- **深度排序、墙壁遮挡淡出、斜向地面阴影与 4 档画质 (`WorldRenderer`, `graphics-quality.ts`)**：
  - 严格对齐 1.13c 帧绘制层级（`nTileType 16..19` 下层悬崖壁先于地板绘制、上层墙遮挡玩家淡出与 POPS 屋顶揭开 `0x6fb29f20`），将地面瓦片、单位斜向透视地面阴影（`drawQuad` 实现了 1.13c `scaleY = 0.5, shearX = -0.5` 向左上方倾斜 45° 的半透明地面投影）、地面物品 Flippy 动画、角色/怪物多部位 DCC/DC6 纸娃娃图层（支持 `PL2` 调色板行重映射染色）、投射物、状态覆盖层（`States.txt` / `overlay.bin`）、冰冻碎裂冰片与落地融水（`MissCltHitFunc[31]` `icebreak*melt`）、特殊词缀怪物与 Boss 死亡特效以及悬挑屋顶按等距子格深度严格排序合批绘制；支持 `low / medium / high / ultra` 四档画质预设调节分辨率缩放、阴影、动态点光源与粒子密度。
- **全套经典 HUD 面板、移动端触控布局与音频系统 (`ui/`, `ui-model/`, `audio/`)**：
  - 支持角色属性面板 (`C`/`A`，经 Wine `D2Client.dll` 校验 23 项字段与技能提示 100.0% 对齐)、背包与穿戴 (`I`/`B`，支持右键直接使用辨识卷轴/辨识之书 `C2S 0x20` / `S2C 0x3F` 并在辨识瞬间无延迟刷新悬停 Tooltip)、全套绿色套装加成与清单 Tooltip、技能树与快捷技能选择 (`T`/`S`)、任务日志 (`Q`，含 97px 步进 6 槽位与 A2Q6 真古墓符号 `invps.dc6`)、左上角队友/佣兵/召唤物头像框 (`O`)、小站传送菜单、NPC 商店/赌博/修理/阿卡拉洗点 (`Quest 41`)、`UI\useitem.cpp` 单格放入窗口（恰西注入、拉苏克打孔、安雅刻名、赫拉迪姆杖孔洞）、玩家面对面交易窗口 (`0x77`/`0x78`/`0x79`)、切换区域居中标题 (`Entering xxx`)、巴尔通关胜利画面 (`S2C 0x61 07`)、储物箱与赫拉迪克方块、高精度 Tab 小地图 (`Minimap`)、触屏设备自动启用的 D2R 风格紧凑虚拟摇杆与药水/技能轮盘 (`touch-controls.ts`)，以及 1.13c WebAudio 音效/环境音/音乐/NPC 语音播放系统。

---

### 4. 常用开发与验证命令

```bash
# 启动本地开发服务器 (默认监听 http://127.0.0.1:5173/play.html；加 VITE_ENABLE_SINGLE_PLAYER=1 可同时开启实验单机入口)
npm run dev

# 单独对 src/client 与 Service Worker 进行严格类型检查
npx tsc -p tsconfig.client.json --noEmit && npx tsc -p tsconfig.sw.json --noEmit

# 构建生产环境客户端静态包
npm run build
```

---
---

<a id="english"></a>

## English

`src/client` is the pure browser client implementation of **Diablo II: Lord of Destruction (v1.13c)**, corresponding to the original `D2Client.dll`, `D2Gfx.dll`, `D2Win.dll`, `D2Launch.dll`, and `D2Sound.dll`.

In the default **Single-Client Mode**, this module communicates with a remote native C++ PvPGN + D2GS (1.13c) server through `src/netproto`'s WebSocket bridge, performing seed-driven DRLG map reconstruction, 25Hz `LogicClock` simulation synchronization, WebGL2 isometric rendering (including authentic 1.13c sheared perspective ground shadows, 7-class paperdoll layer compositing, and 4-tier graphics quality presets), local movement prediction, full classic HUD interactions, and a compact D2R-style mobile touch HUD (`ui/touch-controls.ts`) in the browser. When explicitly enabled via deployment config (`singlePlayerEnabled: true`), it can also drive in-browser Single-Player sessions and `.d2s` saves through the `LocalLobbyProvider` / `LocalLoopbackAdapter` hooks registered on `src/netproto`.

### 1. Module Responsibilities & Architectural Boundaries

- **Composition Root, Single-Player Gate & Non-Intrusive Plugin Host**:
  - [`index.html`](../../index.html) serves as the Sanctuary homepage portal, and [`play.html`](../../play.html) serves as the game client Composition Root: an external `<script type="module" src="/src/server/loopback-adapter.ts">` registers optional Single-Player loopback hooks on `src/netproto` (gated fail-closed to `singlePlayerEnabled: false` by [`src/client/config/site-config.ts`](./config/site-config.ts) unless enabled via `/site-config.json` or `VITE_ENABLE_SINGLE_PLAYER`), while the inline `<script type="module">` imports exclusively `startPlayApp` from [`src/client/main.ts`](./main.ts) and `BUILTIN_PLUGINS`, `PLUGIN_MENU_LAYOUT` from [`plugins/index.ts`](../../plugins/index.ts).
  - Optional client extensions are completely decoupled into the top-level [`plugins/`](../../plugins) directory (shipping 24 built-in plugins: `kill-stats`, `drop-tracker`, `trade-hall`, `automap-reveal` [including automap reveal, radar markers, lighting presets & weather overrides], `extended-viewports`, `hud-enhancements`, `ground-item-beam`, `quick-cast`, `next-game`, and 15 QoL extensions, plus standalone dashboards [`plugins/kill-stats/index.html`](../../plugins/kill-stats/index.html), [`plugins/drop-tracker/index.html`](../../plugins/drop-tracker/index.html), and [`plugins/trade-hall/index.html`](../../plugins/trade-hall/index.html)).
  - `src/client` exposes a read-only session view (`PluginSessionView`), controlled client capabilities (`PluginClientCapabilities`), dynamic toolbar contribution handles (`ToolbarContributionHandle.update`), lifecycle/language hooks, and the top toolbar plugin configuration modal (`PluginMenu`, `[data-d2-modal-overlay="plugins"]`) via [`src/client/plugin-host/`](./plugin-host). Disabling any plugin automatically reverts the client to 1.13c vanilla defaults (`automapReveal: 'off'`, automap radar disabled, `lightingPreset: 'auto'`, `weatherOverride: 'off'`, `640x480` / `800x600` viewports, and vanilla HUD display). **`src/client/**` has zero imports from `src/server/**` or `plugins/**` and zero string literal references to any plugin ID** (enforced by `tests/arch/boundaries.test.ts` Rule 2 and Rules 7–11).
- **TypeScript Compiler Constraints (`tsconfig.client.json` & `tsconfig.sw.json`)**:
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: []` (the Service Worker uses `tsconfig.sw.json`).
  - **Never depends on `src/server` or `src/baker`**, and never imports Node.js builtins (`fs`, `path`, `net`, `Buffer`, etc.).
  - Depends solely on `src/common` (DRLG algorithms, dynamic pathing, binary parsers, data tables) and `src/netproto` (via the public barrel `src/netproto/index.ts`).

---

### 2. Directory Structure

```text
src/client/
├── main.ts          # Main client entry: wires WebGL2 canvas, Toolbar, Battle.net/Single-Player frontend state machine, OnlineSession, PluginHost & render loop
├── config/          # Runtime deployment site config loader (site-config.ts: resolves singlePlayerEnabled from /site-config.json or VITE_ENABLE_SINGLE_PLAYER, fail-closed false)
├── loop/            # 1.13c LogicClock: 25Hz (40ms) tick accumulator, tick-debt catch-up before draw, and 10s/3s no-catch-up guard windows
├── session/         # OnlineSession coordinator, Single-Player save bridge, .d2cap offline capture replayer, and C2S OutboundRateLimiter
├── world/           # ClientWorld & ClientUnit: ServerEvent-driven authoritative state mirror, OP->ON object transitions, static NPC placeholder deduplication & unit hitboxes
├── map/             # Seed-driven client DRLG map service (MapService, LevelView, TileAtlas GPU streaming)
├── automap/         # 1.13c Automap cell manager, fog-of-war exploration persistence, reveal modes (off / level / act) & monster/shrine radar markers
├── input/           # CommandMapper: mouse/keyboard/touch input mapping, 1.13c click rules (click-rules-113c), melee range checks, town skill restrictions, 120ms move coalescing & play assists
├── motion/          # Local player movement predictor (LocalMovementPredictor), remote entity interpolator & dynamic pathfinding bridge
├── render/          # WebGL2 rendering pipeline (SpriteRenderer draw/drawQuad, d2gl-postfx & gamma/contrast curves, TileAtlasGpuCache, EntityArtLoader, 8 D2Gfx blend modes)
├── scene/           # WorldRenderer (isometric depth sorting, lower-wall 16..19 pre-floor pass, upper-wall & POPS occlusion fade, unit perspective ground shadows, 7-class paperdoll PL2 tinting, missiles/overlays/icebreak melt/monster death FX) & lighting presets
├── weather/         # 1.13c WeatherEngine rain/snow/lightning/splash/bubble particle simulation and weather asset loader (weather-assets)
├── audio/           # 1.13c WebAudio engine (Sounds.txt 200-record pool, 4 stereo + 12 mono channel preemption, S2C 0x2C event dispatch, SoundEnviron, BGM & NPC speech streaming)
├── view/            # Formula-derived viewport profiles (640x480 / 800x600 / 1024x768 / 1068x600 / 1280x720) & SceneSource
├── ui/              # In-game HUD rendering & interaction (HudManager, control bar, compact mobile touch HUD touch-controls.ts, Minimap, 7 panels, player-to-player trade panel, useitem windows, Entering xxx banner, A5Q6 victory screen, bitmap fonts)
├── ui-model/        # Pure UI view models (HudModel, character sheet dual AR/damage engine, Set item bonuses, skill tree, inventory/vendor/trade/imbue/cube logic)
├── guide/           # 5-Act quest stage graph, cross-level navigation (LevelGraph / FlowField), ribbon trails & Autopilot
├── multibox/        # Single-tab multibox instance manager (MultiInstanceManager, SharedAssetPool GPU/audio cache, audio focus policy)
├── frontend/        # Battle.net & Single-Player pre-game UI (FrontendRenderer: bilingual ZH/EN Gateway select, login/registration, 8-slot 11-byte statstring paperdoll preview, lobby)
├── toolbar/         # Top 32px toolbar (connection status & RTT, server endpoint, viewport & graphics quality selectors, multibox tabs, audio/language toggles, Plugins menu & dynamic slot)
├── plugin-host/     # Non-intrusive plugin host & config store (PluginHost, PluginConfigStore, PluginMenu, ModMenu & public contract api.ts)
├── theme/           # Diablo stone UI theme & plugin menu styles (shell.css, plugin-menu.css)
├── i18n/            # Client bilingual language state (lang.ts) and localization helpers
├── settings/        # Persistent client settings store (SettingsStore, default.key 57-action key-bindings.ts, 4-tier graphics-quality.ts presets & /players N persistence)
└── sw/              # Service Worker (sw.ts) + CacheUpdater: SHA-256 manifest-driven incremental asset caching
```

---

### 3. Core Data Flows & Subsystems

#### 3.1 Single-Client Connection & Session Lifecycle (`frontend/`, `session/`, `world/`)
1. **Battle.net Pre-Game Flow (`FrontendRenderer` + `D2OnlineFlow`)**:
   - Loads `/ui/frontend/frontend-ui.json` on boot to render the authentic login screen, account registration, character selection (parsing 11-byte `statstring` data into live 7-class paperdoll avatars), and Battle.net lobby (Create Game / Join Game) with bilingual ZH/EN UI support (plus local Single Player character management when `singlePlayerEnabled: true`).
   - Connects sequentially to BNCS (`/bnet`) and MCP (`/realm`) through `wsBridgeUrl` (default `/d2net`, configurable via `?wsBridge=...` or the toolbar Settings modal).
2. **Entering the Game (`OnlineSession` + `ClientWorld`)**:
   - Connects to D2GS (`/game`) using the `GameHash` and `GameToken` issued by MCP and initializes `D2gsServerAdapter` (or initializes the registered `LocalLoopbackAdapter` in Single-Player mode).
   - `OnlineSession` subscribes to all `ServerEvent` emissions to update `ClientWorld` with local player stats, inventory/equipped items, nearby monsters/NPCs (reconciling static town placeholder Objects against dynamic NPCs), ground drops, and quest/waypoint progress, while automatically transitioning operating objects (`OP (1) -> ON (2)`) such as Town Portals, Waypoints, and the Durance Level 3 `HellGate`.

#### 3.2 Seed-Driven Client DRLG Map Reconstruction (`map/`, `automap/`)
Native D2GS **never** transmits full tile maps over the network; it only sends the **32-bit `mapSeed`** and `areaId` in `0x03 (LoadAct)` (followed by `0x07/0x08` room notifications):
- Upon receiving `LoadAct`, `MapService` runs the deterministic 1.13c DRLG algorithms from `src/common/drlg` using `mapSeed` to reconstruct the entire Floor / Wall / Roof / Collision grid in milliseconds.
- Streams the required `LvlType` tile atlases from `/act-packs/tiles/` into `TileAtlasGpuCache`.

#### 3.3 25Hz LogicClock, Movement Prediction & Network Smoothing (`loop/`, `motion/`, `input/`)
- **`LogicClock` (`loop/`)**: Advances client simulation and animation ticks at the exact 1.13c 25Hz (40ms/tick) cadence, accumulating tick debt and catching up before rendering (with 10s/3s guard windows).
- **`LocalMovementPredictor` & `CommandMapper`**: Predicts local player movement across walkable subtiles, bridges (`MephistoBridge`), and opened doors while throttling outbound `0x01 (Walk)` / `0x03 (Run)` packets via `OutboundRateLimiter` (120ms movement coalescing) and enforcing melee contact range before interacting with NPCs, chests, waypoints, or portals.
- **`RemoteEntityInterpolator`**: Combines D2GS `0x67/0x68/0x69/0x6D` velocity and drift-check points to interpolate remote entities at 60fps with 25Hz frame-by-frame turn transitions.

#### 3.4 WebGL2 Isometric Renderer, Graphics Presets & Classic/Touch HUD (`render/`, `scene/`, `ui/`, `audio/`, `settings/`)
- **Depth Sorting, Wall Occlusion Fade, Perspective Ground Shadows & 4-Tier Quality Presets (`WorldRenderer`, `graphics-quality.ts`)**:
  - Follows the exact 1.13c pass order (`nTileType 16..19` lower walls drawn before floor, upper-wall player occlusion fade, and POPS roof/building reveal `0x6fb29f20`), drawing floor tiles, authentic 1.13c perspective unit ground shadows (`drawQuad` with `scaleY = 0.5`, `shearX = -0.5`, `rgba(0,0,0,0.5)` anchored at foot baselines), ground item flippy animations, 7-class multi-part paperdoll DCC/DC6 layers (with per-layer `PL2` palette row remapping), projectiles, state overlays (`States.txt` / `overlay.bin`), freeze shatter shards & `icebreak*melt` puddles (`MissCltHitFunc[31]`), special monster affix & Boss death VFX, shrine overhead icons, and roof overhangs sorted by isometric sub-tile depth; includes `low / medium / high / ultra` graphics presets controlling render scale, shadows, dynamic point lights, and particle density.
- **Complete Classic HUD, Mobile Touch Controls & WebAudio Pipeline (`ui/`, `ui-model/`, `audio/`)**:
  - Character sheet (`C`/`A`, verified 100.0% field-exact across 23 fields & skill tooltips against Wine `D2Client.dll`), Inventory & Equipment (`I`/`B`, supporting right-click Scroll/Tome of Identify `C2S 0x20` / `S2C 0x3F` targeting and instant `hoveredItem` tooltip refresh upon identification), full Set item bonus/roster tooltips, Skill Tree & Speedbar (`T`/`S`), Quest Log (`Q`, with 97px-stride 6-slot geometry and A2Q6 True Tomb symbol `invps.dc6`), top-left Party/Mercenary/Summon portraits (`O`), Waypoint menu, NPC trade/gamble/repair/Akara respec (`Quest 41`), `UI\useitem.cpp` single-item box windows (Charsi Imbue, Larzuk Add Sockets, Anya Personalize, Horadric Orifice), in-room player-to-player trade panels (`0x77`/`0x78`/`0x79`), centered level entry banners (`Entering xxx`), Baal A5Q6 victory screen (`S2C 0x61 07`), Stash, Horadric Cube, accurate Tab Automap (`Minimap`), a compact D2R-style virtual joystick & potion/skill wheel for touch devices (`touch-controls.ts`), and the 1.13c WebAudio SFX/ambient/music/speech runtime.

---

### 4. Common Development & Verification Commands

```bash
# Start local Vite dev server (listens on http://127.0.0.1:5173/play.html; prepend VITE_ENABLE_SINGLE_PLAYER=1 to unlock experimental Single-Player)
npm run dev

# Run strict typecheck for src/client and the Service Worker
npx tsc -p tsconfig.client.json --noEmit && npx tsc -p tsconfig.sw.json --noEmit

# Build production static client bundle
npm run build
```
