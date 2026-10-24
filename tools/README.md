# `tools` — 开发者调试、协议重放与自动化验证工具集 / Developer Debugging, Protocol Replay & Automated Verification Tooling

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`tools/` 目录收录了围绕 **Diablo II: Lord of Destruction (v1.13c) Web Port** 的命令行辅助工具、无头协议测试机器人、封包回放分析器、存档修改器、1.13c DRLG 差分对比工具以及全谱系无头验证脚本。

---

### 1. 核心工具概览

| 脚本 / 目录 | 运行命令示例 | 功能说明 |
| :--- | :--- | :--- |
| [`d2-bot.ts`](./d2-bot.ts) | `npm run bot -- --help` | 无头 (Headless) 战网/D2GS 协议测试机器人。基于 `src/netproto` 直接通过原生 TCP 或 WebSocket 桥走完 BNCS 登录 $\rightarrow$ MCP 选人/建房 $\rightarrow$ D2GS 进图移动/施法全流程，无需启动浏览器即可验证服务端连通性。 |
| [`netproto-replay.ts`](./netproto-replay.ts) | `npx tsx tools/netproto-replay.ts <file.d2cap>` | `.d2cap` 网络抓包录制文件离线重放与解析工具。逐帧还原 Huffman 解压后的 S2C/C2S 十六进制流与解码后的 `ServerEvent` 明细，用于排查协议死锁或未知操作码。 |
| [`d2s-unlock.ts`](./d2s-unlock.ts) | `npx tsx tools/d2s-unlock.ts <char.d2s>` | 原版 1.13c `.d2s` 角色存档一键解锁工具。支持修改角色等级、属性点、技能点、金币，一键点亮全部三难度（Normal / Nightmare / Hell）全部 5 幕小站 (Waypoints) 与通关任务状态，并自动重算 `.d2s` 校验和。 |
| [`drlg-diff.ts`](./drlg-diff.ts) | `npx tsx tools/drlg-diff.ts` | DRLG 确定性差分对比工具。给定相同的 `mapSeed` 与 `areaId`，对比本仓库 DRLG 输出与 `D2Common.dll` Ground Truth 房间拓扑、瓦片 Style/Sequence 及碰撞网格的一致性。 |
| [`render-drlg-compare.ts`](./render-drlg-compare.ts) | `npx tsx tools/render-drlg-compare.ts` | 将 DRLG 生成的关卡碰撞网格、房间边界与瓦片图层渲染为可视化对比 PNG 图像，便于直观排查墙壁接缝与门洞连通性。 |
| [`verify-play.ts`](./verify-play.ts) | `npx tsx tools/verify-play.ts` | 端到端 `play.html` 冒烟验证脚本：使用无头浏览器启动客户端，验证战网前端 UI 加载、WebGL2 上下文初始化、静态资产零 404 以及 HUD 交互响应。 |

---

### 2. 专项回归验证脚本 (`tools/verify-*.ts`)

除了上述日常开发工具外，`tools/` 下还包含针对关键子系统的专项验证脚本：

- **`verify-automap.ts` / `verify-plugin-menu-browser.ts` / `verify-quest-fx-browser.ts`**：全谱系 136 关卡小地图图集（含 39 个小站 parity）校验、插件菜单端到端浏览器验证与特殊词缀怪物/Boss 死亡特效无头浏览器验证。
- **`verify-environment-browser.ts`**：1.13c 昼夜时钟无头浏览器验证（实服 S2C 0x53、注入昼/黄昏/夜/黎明四个时段的金值与截图、营火昼夜切换、136 关环境光渲染审计）。需 `D2W_PUBLIC_DIR`（含 `act-packs/tiles/index.json`）与 `D2_DATA_DIR`（1.13c MPQ）。
- **`verify-weather-browser.ts`**：1.13c 天气无头浏览器验证（天气资源与 LoadWeather、罗格营地实服下雨、`automap-reveal` 插件管理面板下拉切换雪/雨/默认与禁用恢复、136 关天气渲染审计（雨/雪/水花/气泡对照 MPQ Levels.txt `Act` / `Rain` / `Mud`）、136 关 × 强制雨/雪模拟扫描；逐像素帧校验：雨雪线条像素必须等于调色板颜色，其余变化像素必须落在水花/气泡帧矩形内）。需 `D2W_PUBLIC_DIR`（含 `act-packs/tiles/index.json` 与 `weather/weather.json`）与 `D2_DATA_DIR`（1.13c MPQ）。
- **`verify-world-graph.ts` / `verify-world-walk.ts`**：全幕关卡连通图与跨图行走可达性验证。
- **`verify-combat.ts` / `verify-items.ts` / `verify-monsters.ts` / `verify-objects.ts`**：战斗模拟、1.13c 掉落表、怪物属性与场景交互对象解析验证。
- **`verify-formats.ts` / `verify-dc6.ts` / `verify-dcc.ts` / `verify-dt1-pixels.ts` / `verify-tbl.ts`**：底层二进制格式（DC6/DCC/DT1/DS1/TBL）与 MPQ 解码验证。
- **`verify-bundle-no-mpq.ts` / `verify-deploy.ts` / `verify-renderer-lifecycle.ts`**：验证静态烘焙包脱离原始 MPQ 运行、部署完整性与 WebGL2 渲染器生命周期。

---

### 3. 典型使用示例

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

#### 使用 `netproto-replay.ts` 分析 `.d2cap` 抓包录制文件
通过 `OnlineSession` 录制导出或 `d2-bot.ts` 生成 `.d2cap` 文件后，可在终端离线回放：
```bash
npx tsx tools/netproto-replay.ts ./captures/session-2026.d2cap
```

---
---

<a id="english"></a>

## English

The `tools/` directory contains CLI utilities, a headless protocol test bot, a packet capture replayer, a `.d2s` save editor, 1.13c DRLG differential comparison tools, and automated verification scripts for the **Diablo II: Lord of Destruction (v1.13c) Web Port**.

---

### 1. Core Tools Overview

| Script / Directory | Example Command | Description |
| :--- | :--- | :--- |
| [`d2-bot.ts`](./d2-bot.ts) | `npm run bot -- --help` | Headless Battle.net / D2GS protocol test bot. Uses `src/netproto` over raw TCP or a WebSocket bridge to execute the full BNCS login $\rightarrow$ MCP character select / room creation $\rightarrow$ D2GS in-game walk/cast lifecycle without launching a browser. |
| [`netproto-replay.ts`](./netproto-replay.ts) | `npx tsx tools/netproto-replay.ts <file.d2cap>` | Offline replayer and analyzer for `.d2cap` packet capture files. Reconstructs frame-by-frame Huffman-decompressed S2C/C2S hex streams and decoded `ServerEvent` payloads to diagnose protocol bugs or unknown opcodes. |
| [`d2s-unlock.ts`](./d2s-unlock.ts) | `npx tsx tools/d2s-unlock.ts <char.d2s>` | One-click unlocker and editor for authentic 1.13c `.d2s` character save files. Modifies character level, stat/skill points, and gold, unlocks all 5-act waypoints and quest states across Normal / Nightmare / Hell, and recalculates the `.d2s` checksum. |
| [`drlg-diff.ts`](./drlg-diff.ts) | `npx tsx tools/drlg-diff.ts` | Deterministic DRLG differential comparison tool. Given a `mapSeed` and `areaId`, compares our TypeScript DRLG output against `D2Common.dll` ground truth across room topology, tile Style/Sequence, and collision grids. |
| [`render-drlg-compare.ts`](./render-drlg-compare.ts) | `npx tsx tools/render-drlg-compare.ts` | Renders DRLG collision grids, room boundaries, and tile layers into side-by-side comparison PNGs to visually inspect wall seams and doorway connectivity. |
| [`verify-play.ts`](./verify-play.ts) | `npx tsx tools/verify-play.ts` | End-to-end `play.html` smoke verifier: launches a headless browser to verify Battle.net frontend UI boot, WebGL2 context initialization, zero 404 static assets, and HUD responsiveness. |

---

### 2. Subsystem Verification Scripts (`tools/verify-*.ts`)

In addition to daily developer tools, `tools/` provides targeted verification scripts for core subsystems:

- **`verify-automap.ts` / `verify-plugin-menu-browser.ts` / `verify-quest-fx-browser.ts`**: Full-spectrum 136-level automap atlas (including 39-waypoint parity) verification, headless browser E2E testing for the plugin menu, and special monster affix / Boss death VFX browser verification.
- **`verify-environment-browser.ts`**: Headless browser verification of the 1.13c day/night clock (live S2C 0x53, injected Day / Dusk / Night / Dawn goldens with screenshots, campfire day/night switch, 136-level rendered ambient light audit). Needs `D2W_PUBLIC_DIR` (with `act-packs/tiles/index.json`) and `D2_DATA_DIR` (1.13c MPQs).
- **`verify-weather-browser.ts`**: Headless browser verification of the 1.13c weather (weather assets and LoadWeather, live rain in the Rogue Encampment, the `automap-reveal` plugin's `weatherOverride` select in PluginMenu switching between snow / rain / Default plus disable / re-enable, a 136-level rendered weather audit of rain / snow / splashes / bubbles against MPQ Levels.txt `Act` / `Rain` / `Mud`, and a 136-level × forced rain / snow simulation sweep). Per-pixel frame check: every rain / snow line pixel must hold its palette colour, and every other changed pixel must lie inside a splash / bubble cel rect. Needs `D2W_PUBLIC_DIR` (with `act-packs/tiles/index.json` and `weather/weather.json`) and `D2_DATA_DIR` (1.13c MPQs).
- **`verify-world-graph.ts` / `verify-world-walk.ts`**: Multi-act level connectivity graph and cross-level walkability verification.
- **`verify-combat.ts` / `verify-items.ts` / `verify-monsters.ts` / `verify-objects.ts`**: Combat simulation, 1.13c drop tables, monster attributes, and world object metadata verification.
- **`verify-formats.ts` / `verify-dc6.ts` / `verify-dcc.ts` / `verify-dt1-pixels.ts` / `verify-tbl.ts`**: Low-level binary format (DC6/DCC/DT1/DS1/TBL) and MPQ decompression verification.
- **`verify-bundle-no-mpq.ts` / `verify-deploy.ts` / `verify-renderer-lifecycle.ts`**: Verifies MPQ-free static bundle operation, deployment integrity, and WebGL2 renderer resource lifecycle.

---

### 3. Typical Usage Examples

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

#### Replay a `.d2cap` Capture with `netproto-replay.ts`
After exporting a `.d2cap` session capture from `OnlineSession` or `d2-bot.ts`, replay it offline in the terminal:
```bash
npx tsx tools/netproto-replay.ts ./captures/session-2026.d2cap
```
