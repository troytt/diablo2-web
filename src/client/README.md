# `src/client` — 纯浏览器 WebGL2 渲染与交互客户端 / Pure Browser WebGL2 Rendering & Interactive Client

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/client` 是 **Diablo II: Lord of Destruction (v1.13c)** 的纯浏览器客户端实现，对标原版 `D2Client.dll`、`D2Gfx.dll`、`D2Win.dll`、`D2Launch.dll` 与 `D2Sound.dll`。

在**单客户端模式（Single-Client Mode）**下，本模块仅通过 `src/netproto` 的 WebSocket 桥接协议与远端原生 C++ PvPGN + D2GS (1.13c) 通信，在浏览器端完成种子驱动的 DRLG 地图重建、25Hz `LogicClock` 逻辑帧同步、WebGL2 等距视角渲染（含 1.13c 人物/怪物斜向透视地面阴影与 7 职业纸娃娃分层染色）、客户端移动预测与全套经典 UI 交互。

### 1. 模块职责与架构边界

- **主页面入口与非侵入式插件宿主**：
  - [`play.html`](../../play.html) 作为顶层组合根（Composition Root），通过内联 `<script type="module">` 导入 [`src/client/main.ts`](./main.ts) 的 `startPlayApp` 与 [`plugins/index.ts`](../../plugins/index.ts) 的 `BUILTIN_PLUGINS` 并启动客户端。
  - 可选客户端扩展插件统一解耦至顶层 [`plugins/`](../../plugins) 目录（内置 `kill-stats`、`drop-tracker`、`automap-reveal`（含小地图全图透视、雷达标记、光照预设与天气模式）、`extended-viewports` 与 `hud-enhancements` 五个插件，以及独立统计页 [`plugins/kill-stats/index.html`](../../plugins/kill-stats/index.html) 和 [`plugins/drop-tracker/index.html`](../../plugins/drop-tracker/index.html)）。
  - `src/client` 通过 [`src/client/plugin-host/`](./plugin-host) 向插件提供只读会话视图（`PluginSessionView`）、受控客户端增强能力门面（`PluginClientCapabilities`）、动态工具栏句柄（`ToolbarContributionHandle.update`）、生命周期与语言切换钩子以及顶部工具栏插件配置菜单（`PluginMenu`，挂载 `data-d2-modal-overlay="plugins"` 并配合 `ui/dom-overlay.ts` 的 `isModalDomOverlayOpen()` 实现键盘输入隔离）。当插件被禁用时，宿主自动回退至 1.13c 原版默认行为（迷雾探索 `automapReveal: 'off'`、小地图雷达关闭、原版关卡光照 `lightingPreset: 'auto'`、原版天气 `weatherOverride: 'off'`、原版 `640x480` / `800x600` 分辨率、原版 HUD 数值显示）。**`src/client/**` 具有零个来自 `plugins/**` 的导入且严禁包含任何具体插件 ID 引用**（由 `tests/arch/boundaries.test.ts` Rule 2 与 Rule 7–10 强制守卫）。
- **TypeScript 工程约束（`tsconfig.client.json` & `tsconfig.sw.json`）**：
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: []`（Service Worker 独立使用 `tsconfig.sw.json`）。
  - **严禁依赖 `src/server` 或 `src/baker`**，严禁导入任何 Node.js 内置模块（`fs`, `path`, `net`, `Buffer` 等）。
  - 仅依赖 `src/common`（DRLG 算法、动态寻路、格式解析器、数据表定义）与 `src/netproto`（协议唯一门面 `src/netproto/index.ts` 与 `D2gsServerAdapter`）。

---

### 2. 目录结构

```text
src/client/
├── main.ts          # 客户端主入口：组装 WebGL2 画布、工具栏、前端战网状态机、OnlineSession、PluginHost 与渲染循环
├── loop/            # 1.13c LogicClock：25Hz (40ms) 逻辑帧累加器、帧债追赶与 10s/3s 免追赶窗口保护
├── session/         # OnlineSession 会话协调器、.d2cap 离线重放器与 C2S 发包速率限制器 (OutboundRateLimiter)
├── world/           # ClientWorld & ClientUnit：由 ServerEvent 驱动的客户端权威状态镜像、对象 OP->ON 自动流转、静态 NPC 占位符互斥隐藏与碰撞盒计算
├── map/             # 种子驱动的客户端 DRLG 地图服务 (MapService, LevelView, TileAtlas GPU 瓦片加载)
├── automap/         # 1.13c 小地图网格管理、迷雾探索持久化、全图揭示模式 (off / level / act) 与怪物/神龛雷达标记
├── input/           # CommandMapper：鼠标/键盘指令映射、近战交互距离校验、城镇施法限制 (InTown)、120ms 移动合批节流与目标锁定
├── motion/          # 本地玩家移动预测 (LocalMovementPredictor)、远端实体插值器与 A* 寻路 (pathfind)
├── render/          # WebGL2 渲染管线 (SpriteRenderer draw/drawQuad, TileAtlasGpuCache, EntityArtLoader, 8 种 D2Gfx 混合模式)
├── scene/           # WorldRenderer (等距深度排序、人物/怪物斜向透视地面阴影、7 职业纸娃娃分层染色、投射物/覆盖层/怪物死亡特效/神殿头顶图标) 与环境光照预设
├── weather/         # 1.13c WeatherEngine 雨/雪/闪电/雨滴水花/泥沼气泡粒子系统与天气资源加载器 (weather-assets)
├── view/            # 视口分辨率配置 (ViewportProfile: 640x480 / 800x600 / 1024x768 / 1068x600 / 1280x720) 与 SceneSource
├── ui/              # 游戏内 HUD 渲染与交互 (HudManager, 底部状态栏, Minimap, 7 大面板, 恰西注入 Imbue 面板, 右键辨识卷轴/书, D2 点阵字体渲染)
├── ui-model/        # UI 纯视图状态模型 (HudModel, 角色面板双 AR/伤害引擎、套装加成、技能树、背包网格、商店/赌博/注入/方块交互)
├── frontend/        # 战网前置界面 (FrontendRenderer：中英双语 Gateway 选择、账号登录/注册、8 角色 11-byte statstring 纸娃娃预览、建房/加房大厅)
├── toolbar/         # 顶部 32px 工具栏 (连接状态与 RTT、服务器地址、分辨率切换、音量/语言控制、Plugins 菜单与动态插件插槽)
├── plugin-host/     # 非侵入式插件宿主与配置中心 (PluginHost, PluginConfigStore, PluginMenu 与公共契约 api.ts)
├── i18n/            # 客户端中英双语状态管理 (lang.ts) 与本地化辅助函数
├── settings/        # 客户端持久化设置存储 (SettingsStore / client-settings.ts，管理服务器地址与显示偏好)
├── sw/              # Service Worker (sw.ts) + CacheUpdater：基于 SHA-256 清单的离线资产增量缓存
└── assets/          # OPFS (Origin Private File System) 本地 MPQ 导入与缓存支持
```

---

### 3. 核心数据流与子系统详解

#### 3.1 单客户端连接与会话生命周期 (`frontend/`, `session/`, `world/`)
1. **战网前置流程 (`FrontendRenderer` + `D2OnlineFlow`)**：
   - 启动后加载 `/ui/frontend/frontend-ui.json`，渲染原版风格登录界面、新账号注册、角色选择界面（解析 11 字节 `statstring` 实时合成 7 职业多部位纸娃娃预览）与战网大厅（Create Game / Join Game 房间列表），支持中英文界面动态切换。
   - 通过 `wsBridgeUrl`（默认 `/d2net`，可通过 URL 参数 `?wsBridge=...` 或顶部工具栏 Settings 面板配置）依次握手 BNCS (`/bnet`) 与 MCP (`/realm`)。
2. **进入游戏 (`OnlineSession` + `ClientWorld`)**：
   - 拿到 MCP 颁发的 `GameHash` 与 `GameToken` 后，连接 D2GS (`/game`) 并创建 `D2gsServerAdapter`。
   - `OnlineSession` 订阅全部 `ServerEvent`，实时更新 `ClientWorld` 中的本地玩家属性、背包/穿戴物品、周围怪物/NPC 状态（含城镇静态占位 Object 与动态 NPC 互斥去重）、地面掉落与任务/小站进度，并支持所有交互对象（传送门、小站、憎恨囚牢第 3 层地狱之门 `HellGate` 等）从 `OP (1)` 到 `ON (2)` 模式的平滑循环动画过渡。

#### 3.2 种子驱动的客户端 DRLG 地图重建 (`map/`, `automap/`)
原生 D2GS **不会**在网络上传输完整的瓦片地图数据，仅在 `0x03 (LoadAct)` 包中下发 **32 位 `mapSeed`** 与当前 `areaId`（并伴随 `0x07/0x08` 房间加载通知）：
- `MapService` 在收到 `LoadAct` 后，使用 `src/common/drlg` 与服务端完全一致的 1.13c DRLG 算法，根据 `mapSeed` 在浏览器端毫秒级还原整张地图的 Floor / Wall / Roof / Collision 网格。
- 从 `/act-packs/tiles/` 按需流式加载对应 `LvlType` 的瓦片图集并上传至 `TileAtlasGpuCache`。

#### 3.3 25Hz 逻辑时钟、移动预测与网络平滑 (`loop/`, `motion/`, `input/`)
- **`LogicClock` (`loop/`)**：严格按照 1.13c 25Hz (40ms/tick) 固定步长推进客户端模拟与动画帧，保留帧债并在绘制前追赶（内置 10s/3s 异常挂起免追赶保护窗口）。
- **`LocalMovementPredictor` & `CommandMapper`**：玩家左键点击地面、可通行桥梁（如 `MephistoBridge`）或已开启门洞时，本地沿寻路网格按角色 `Velocity` 推进预测坐标，同时由 `OutboundRateLimiter`（120ms 移动合批节流）向 D2GS 发送移动/奔跑包，并在交互 NPC、宝箱、小站或传送门前校验近战接触距离。
- **`RemoteEntityInterpolator`**：结合 D2GS 下发的 `0x67/0x68/0x69/0x6D` 速度与漂移校正点，将离散实体移动转化为 60fps 连续内插位移与 25Hz 逐帧转身过渡。

#### 3.4 WebGL2 等距视角渲染器与经典 HUD (`render/`, `scene/`, `ui/`)
- **深度排序与斜向地面阴影 (`WorldRenderer`)**：
  - 将地面瓦片、单位斜向透视地面阴影（`drawQuad` 实现了 1.13c `scaleY = 0.5, shearX = -0.5` 向左上方倾斜 45° 的半透明地面投影）、地面物品 Flippy 动画、角色/怪物多部位 DCC/DC6 纸娃娃图层（支持 `PL2` 调色板行重映射染色）、投射物、状态覆盖层（`States.txt` / `overlay.bin`）、特殊词缀怪物与 Boss 死亡特效以及悬挑屋顶按等距子格深度严格排序合批绘制。
- **全套经典 HUD 面板 (`ui/`, `ui-model/`)**：
  - 支持角色属性面板 (`C`/`A`，精确计算双手法术/物理命中率、伤害与光环加成，严格遵循 1.13c 左框上限/右框当前值布局并与底栏红蓝球装备加成同步)、背包与穿戴 (`I`/`B`，支持右键直接使用辨识卷轴/辨识之书 `C2S 0x20` / `S2C 0x3F` 并在辨识瞬间无延迟刷新悬停 Tooltip)、全套绿色套装加成与清单 Tooltip、技能树与快捷技能选择 (`T`/`S`)、任务日志 (`Q`)、左上角队友/佣兵/召唤物头像框 (`O`)、小站传送菜单、NPC 商店/赌博/修理、恰西注入面板 (`C2S 0x38` / `S2C 0x58` Imbue)、储物箱与赫拉迪克方块以及高精度 Tab 小地图 (`Minimap`)。

---

### 4. 常用开发与验证命令

```bash
# 启动本地开发服务器 (默认监听 http://127.0.0.1:5173/play.html)
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

In **Single-Client Mode**, this module communicates with a remote native C++ PvPGN + D2GS (1.13c) server through `src/netproto`'s WebSocket bridge, performing seed-driven DRLG map reconstruction, 25Hz `LogicClock` simulation synchronization, WebGL2 isometric rendering (including authentic 1.13c sheared perspective ground shadows and 7-class paperdoll layer compositing), local movement prediction, and full classic HUD interactions in the browser.

### 1. Module Responsibilities & Architectural Boundaries

- **Composition Root & Non-Intrusive Plugin Host**:
  - [`play.html`](../../play.html) serves as the top-level Composition Root, using an inline `<script type="module">` to import `startPlayApp` from [`src/client/main.ts`](./main.ts) and `BUILTIN_PLUGINS` from [`plugins/index.ts`](../../plugins/index.ts).
  - Optional client extensions are completely decoupled into the top-level [`plugins/`](../../plugins) directory (shipping 5 built-in plugins: `kill-stats`, `drop-tracker`, `automap-reveal` [including automap reveal, radar markers, lighting presets & weather overrides], `extended-viewports`, and `hud-enhancements`, plus standalone dashboards [`plugins/kill-stats/index.html`](../../plugins/kill-stats/index.html) and [`plugins/drop-tracker/index.html`](../../plugins/drop-tracker/index.html)).
  - `src/client` exposes a read-only session view (`PluginSessionView`), controlled client capabilities (`PluginClientCapabilities`), dynamic toolbar contribution handles (`ToolbarContributionHandle.update`), lifecycle/language hooks, and the top toolbar plugin configuration modal (`PluginMenu`, `[data-d2-modal-overlay="plugins"]`) via [`src/client/plugin-host/`](./plugin-host). Disabling any plugin automatically reverts the client to 1.13c vanilla defaults (`automapReveal: 'off'`, automap radar disabled, `lightingPreset: 'auto'`, `weatherOverride: 'off'`, `640x480` / `800x600` viewports, and vanilla HUD display). **`src/client/**` has zero imports from `plugins/**` and zero string literal references to any plugin ID** (enforced by `tests/arch/boundaries.test.ts` Rule 2 and Rules 7–10).
- **TypeScript Compiler Constraints (`tsconfig.client.json` & `tsconfig.sw.json`)**:
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: []` (the Service Worker uses `tsconfig.sw.json`).
  - **Never depends on `src/server` or `src/baker`**, and never imports Node.js builtins (`fs`, `path`, `net`, `Buffer`, etc.).
  - Depends solely on `src/common` (DRLG algorithms, dynamic pathing, binary parsers, data tables) and `src/netproto` (via the public barrel `src/netproto/index.ts` and `D2gsServerAdapter`).

---

### 2. Directory Structure

```text
src/client/
├── main.ts          # Main client entry: wires WebGL2 canvas, Toolbar, Battle.net frontend state machine, OnlineSession, PluginHost & render loop
├── loop/            # 1.13c LogicClock: 25Hz (40ms) tick accumulator, tick-debt catch-up before draw, and 10s/3s no-catch-up guard windows
├── session/         # OnlineSession coordinator, .d2cap offline capture replayer, and C2S OutboundRateLimiter
├── world/           # ClientWorld & ClientUnit: ServerEvent-driven authoritative state mirror, OP->ON object transitions, static NPC placeholder deduplication & unit hitboxes
├── map/             # Seed-driven client DRLG map service (MapService, LevelView, TileAtlas GPU streaming)
├── automap/         # 1.13c Automap cell manager, fog-of-war exploration persistence, reveal modes (off / level / act) & monster/shrine radar markers
├── input/           # CommandMapper: mouse/keyboard input mapping, melee interaction range checks, town skill restrictions (InTown), 120ms move coalescing & target lock
├── motion/          # Local player movement predictor (LocalMovementPredictor), remote entity interpolator & A* pathfinding
├── render/          # WebGL2 rendering pipeline (SpriteRenderer draw/drawQuad, TileAtlasGpuCache, EntityArtLoader, 8 D2Gfx blend modes)
├── scene/           # WorldRenderer (isometric depth sorting, unit perspective ground shadows, 7-class paperdoll PL2 tinting, missiles/overlays/monster death FX/shrine icons) & lighting presets
├── weather/         # 1.13c WeatherEngine rain/snow/lightning/splash/bubble particle simulation and weather asset loader (weather-assets)
├── view/            # Formula-derived viewport profiles (640x480 / 800x600 / 1024x768 / 1068x600 / 1280x720) & SceneSource
├── ui/              # In-game HUD rendering & interaction (HudManager, control bar, Minimap, 7 panels, Charsi Imbue panel, right-click identify scroll/tome, bitmap fonts)
├── ui-model/        # Pure UI view models (HudModel, character sheet dual AR/damage engine, Set item bonuses, skill tree, inventory/vendor/imbue/cube logic)
├── frontend/        # Battle.net pre-game UI (FrontendRenderer: bilingual ZH/EN Gateway select, login/registration, 8-slot 11-byte statstring paperdoll preview, lobby)
├── toolbar/         # Top 32px toolbar (connection status & RTT, server endpoint, viewport selector, audio/language toggles, Plugins menu & dynamic slot)
├── plugin-host/     # Non-intrusive plugin host & config store (PluginHost, PluginConfigStore, PluginMenu & public contract api.ts)
├── i18n/            # Client bilingual language state (lang.ts) and localization helpers
├── settings/        # Persistent client settings store (SettingsStore / client-settings.ts for server URLs and display preferences)
├── sw/              # Service Worker (sw.ts) + CacheUpdater: SHA-256 manifest-driven incremental asset caching
└── assets/          # OPFS (Origin Private File System) local MPQ import and cache support
```

---

### 3. Core Data Flows & Subsystems

#### 3.1 Single-Client Connection & Session Lifecycle (`frontend/`, `session/`, `world/`)
1. **Battle.net Pre-Game Flow (`FrontendRenderer` + `D2OnlineFlow`)**:
   - Loads `/ui/frontend/frontend-ui.json` on boot to render the authentic login screen, account registration, character selection (parsing 11-byte `statstring` data into live 7-class paperdoll avatars), and Battle.net lobby (Create Game / Join Game) with bilingual ZH/EN UI support.
   - Connects sequentially to BNCS (`/bnet`) and MCP (`/realm`) through `wsBridgeUrl` (default `/d2net`, configurable via `?wsBridge=...` or the toolbar Settings modal).
2. **Entering the Game (`OnlineSession` + `ClientWorld`)**:
   - Connects to D2GS (`/game`) using the `GameHash` and `GameToken` issued by MCP and initializes `D2gsServerAdapter`.
   - `OnlineSession` subscribes to all `ServerEvent` emissions to update `ClientWorld` with local player stats, inventory/equipped items, nearby monsters/NPCs (reconciling static town placeholder Objects against dynamic NPCs), ground drops, and quest/waypoint progress, while automatically transitioning operating objects (`OP (1) -> ON (2)`) such as Town Portals, Waypoints, and the Durance Level 3 `HellGate`.

#### 3.2 Seed-Driven Client DRLG Map Reconstruction (`map/`, `automap/`)
Native D2GS **never** transmits full tile maps over the network; it only sends the **32-bit `mapSeed`** and `areaId` in `0x03 (LoadAct)` (followed by `0x07/0x08` room notifications):
- Upon receiving `LoadAct`, `MapService` runs the deterministic 1.13c DRLG algorithms from `src/common/drlg` using `mapSeed` to reconstruct the entire Floor / Wall / Roof / Collision grid in milliseconds.
- Streams the required `LvlType` tile atlases from `/act-packs/tiles/` into `TileAtlasGpuCache`.

#### 3.3 25Hz LogicClock, Movement Prediction & Network Smoothing (`loop/`, `motion/`, `input/`)
- **`LogicClock` (`loop/`)**: Advances client simulation and animation ticks at the exact 1.13c 25Hz (40ms/tick) cadence, accumulating tick debt and catching up before rendering (with 10s/3s guard windows).
- **`LocalMovementPredictor` & `CommandMapper`**: Predicts local player movement across walkable subtiles, bridges (`MephistoBridge`), and opened doors while throttling outbound `0x01 (Walk)` / `0x03 (Run)` packets via `OutboundRateLimiter` (120ms movement coalescing) and enforcing melee contact range before interacting with NPCs, chests, waypoints, or portals.
- **`RemoteEntityInterpolator`**: Combines D2GS `0x67/0x68/0x69/0x6D` velocity and drift-check points to interpolate remote entities at 60fps with 25Hz frame-by-frame turn transitions.

#### 3.4 WebGL2 Isometric Renderer & Classic HUD (`render/`, `scene/`, `ui/`)
- **Depth Sorting & Isometric Perspective Ground Shadows (`WorldRenderer`)**:
  - Draws floor tiles, authentic 1.13c perspective unit ground shadows (`drawQuad` with `scaleY = 0.5`, `shearX = -0.5`, `rgba(0,0,0,0.5)` anchored at foot baselines), ground item flippy animations, 7-class multi-part paperdoll DCC/DC6 layers (with per-layer `PL2` palette row remapping), projectiles, state overlays (`States.txt` / `overlay.bin`), special monster affix & Boss death VFX, shrine overhead icons, and roof overhangs sorted by isometric sub-tile depth.
- **Complete Classic HUD Panels (`ui/`, `ui-model/`)**:
  - Character sheet (`C`/`A`, enforcing 1.13c Left=Max / Right=Current vital boxes and syncing equipment/state max vitals into HUD globes), Inventory & Equipment (`I`/`B`, supporting right-click Scroll/Tome of Identify `C2S 0x20` / `S2C 0x3F` targeting and instant `hoveredItem` tooltip refresh upon identification), full Set item bonus/roster tooltips, Skill Tree & Speedbar (`T`/`S`), Quest Log (`Q`), top-left Party/Mercenary/Summon portraits (`O`), Waypoint menu, NPC trade/gamble/repair panels, Charsi Imbue panel (`C2S 0x38` / `S2C 0x58`), Stash, Horadric Cube, and accurate Tab Automap (`Minimap`).

---

### 4. Common Development & Verification Commands

```bash
# Start local Vite dev server (listens on http://127.0.0.1:5173/play.html)
npm run dev

# Run strict typecheck for src/client and the Service Worker
npx tsc -p tsconfig.client.json --noEmit && npx tsc -p tsconfig.sw.json --noEmit

# Build production static client bundle
npm run build
```
