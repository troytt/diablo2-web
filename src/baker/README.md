# `src/baker` — 离线 MPQ 美术资产与数据表烘焙管线 / Offline MPQ Asset & Data Table Baking Pipeline

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/baker` 是运行在 Node.js 环境下的离线资产烘焙（Baking）工具链，负责将原版 **Diablo II: Lord of Destruction (v1.13c)** 的 MPQ 归档文件（`d2data.mpq`、`d2char.mpq`、`d2exp.mpq`、`Patch_D2.mpq` 等）解码、调色板转换、合批打包并生成供浏览器客户端零 MPQ 开销直接消费的静态资产包（输出至 `public/`）。

### 1. 模块职责与架构边界

- **TypeScript 工程约束（`tsconfig.baker.json`）**：
  - `lib: ["ES2022"]`, `types: ["node"]` —— **纯 Node.js CLI 模块，严禁包含任何浏览器 DOM API**（由 `tests/arch/boundaries.test.ts` Rule 5 强制校验）。
  - 仅依赖 `src/common`（共享 MPQ 读取器、二进制格式解析器与 `pack-contract` 校验契约），严禁导入 `src/client`、`src/server` 或 `src/netproto`。
- **统一 CLI 入口**：[`src/baker/cli.ts`](./cli.ts)（通过 `npm run bake -- <target>` 调用）。

---

### 2. 目录结构

```text
src/baker/
├── cli.ts                  # 统一命令行入口，支持分项烘焙、全量烘焙 (all) 与契约校验 (--verify)
├── index.ts                # 模块导出入口
├── mpq-archive-source.ts   # 基于本地 MPQ 目录 (samples/d2/) 的多归档优先级读取源
├── packers/                # 核心美术与数据打包器 (瓦片、实体、角色纸娃娃、投射物、覆盖层、UI、前置界面、动画表、掉落/碰撞表等)
├── extract/                # 1.13c 权威 TXT/BIN 数据表、技能树/词缀/宝石字典、TTF 字体与 D2Net/D2Common 常量提取脚本
├── io/                     # 32-bit RGBA PNG 编码、TBL 写入、SHA-256 资产清单生成 (asset-manifest.ts) 与发布辅助工具
└── audit/                  # Fail-Fast 烘焙产物完整性校验器 (verify-packs, verify-tiles, verify-tile-alignment, verify-entity-packs, verify-audio-113c)
```

---

### 3. 烘焙目标与产物对照表

运行 `npm run bake -- <target>`（或对应 `npm run pack:*` 快捷命令）将从 `samples/d2/` 下的 MPQ 文件提取并生成以下静态资产：

| 烘焙子命令 (`cli.ts`) | 对应 `npm run` 快捷脚本 | 核心实现文件 | 输出目录 / 产物 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `tiles` | `npm run pack:tiles` | `packers/pack-tiles.ts` | `public/act-packs/tiles/` | 烘焙全部 5 幕共 233 个关卡 DT1 + 3 个通用 DT1 (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`) 瓦片图集及 `drlg-bundle.{json,bin}` |
| `ui` | `npm run pack:ui` | `packers/pack-ui.ts` | `public/ui/` | 烘焙游戏内 HUD 底栏、面板背景、按钮、7 职业技能图标、鼠标指针与物品栏网格 DC6 精灵图 |
| `frontend-ui` | `npm run pack:frontend` | `packers/pack-frontend-ui.ts` | `public/ui/frontend/` | 烘焙战网登录界面、角色选择营火背景、7 职业创建角色动画与大厅 UI 资源 |
| `cursor` | `npm run bake -- cursor` | `packers/pack-cursor.ts` | `public/ui/cursor.png` | 烘焙原版鼠标指针帧图集与 `cursor-meta.ts` 元数据 |
| `skills` | `npm run bake -- skills` | `packers/pack-skill-assets.ts` | `public/skills/` | 提取 7 职业与通用技能图标及 `manifest.json` 清单 |
| `animdata` | `npm run pack:animdata` | `packers/pack-animdata.ts` | `public/anim/` | 提取 `data/global/AnimData.d2` 全量 COF 动画帧数、速度与关键帧触发事件表 |
| `characters` | `npm run bake -- characters` | `packers/pack-characters.ts` | `public/entities/` | 烘焙 7 大职业基础躯干 (`char-*.r8` / `char-*.json`) 与 `character-manifest.json` |
| `char-layers` (`char-so`) | `npm run pack:char-so` | `packers/pack-char-so-layers.ts` | `public/chars/` | 烘焙 7 大职业 16 部件纸娃娃（Paperdoll）武器/防具外观分层 DCC/COF 图集 |
| `entities` | `npm run pack:entities` | `packers/pack-entity-assets.ts` | `public/entities/` | 烘焙全部怪物、SuperUniques（自动捆绑其随从 Minions）、NPC 与场景交互 Object 的 DCC/DC6/COF 图集 |
| `missiles` | `npm run pack:missiles` | `packers/pack-missiles.ts` | `public/missiles/` | 烘焙 `Missiles.txt` 全部投射物 32-bit RGBA 图集（含 `Trans: 1` 零黑边过滤与发光混合模式元数据） |
| `overlays` | `npm run pack:overlays` | `packers/pack-overlays.ts` | `public/overlays/` | 烘焙 `Overlays.txt` 全部光环、诅咒、Buff、命中特效、神殿图标与升级光柱 DCC 图集 |
| `overlay-rows` | `npm run bake -- overlay-rows` | `packers/pack-overlay-rows.ts` | `src/common/data/overlay-rows-113c.ts` | 从 `overlay.bin` 与 `States.txt` 提取 1.13c 权威状态叠加层参数表 |
| `input-tables` | `npm run bake -- input-tables` | `packers/pack-input-tables-113c.ts` | `src/common/data/input-tables-113c.ts` | 提取 1.13c 快捷键、控制动作与输入映射表 |
| `monstats2-flags` | `npm run bake -- monstats2-flags` | `packers/pack-monstats2-flags.ts` | `src/common/data/monstats2-flags-113c.ts` | 提取 `MonStats2.txt` 怪物碰撞/绘制/尸体/小地图标志位表 |
| `monster-path` | `npm run bake -- monster-path` | `packers/pack-monster-path-data.ts` | `src/common/data/monster-path-data-113c.ts` | 提取 `MonStats.txt` / `MonStats2.txt` 怪物寻路尺寸、速度与开门能力表 |
| `acts` | `npm run pack:acts` | `packers/pack-act-assets.ts` | `public/packs/act1..act5/` | 烘焙 5 幕预烘焙关卡场景 (`act1..act5/`)、场景物件图集、`index.json` 与 `world-graph.json` |
| `drop-data` | `npm run bake -- drop-data` | `packers/pack-canonical-drop-data.ts` | `src/common/data/canonical-drop-data.ts` | 提取并校验 `MonStats`、`SuperUniques` 与 `DifficultyLevels` 权威掉落数据表 |
| `tbl` | `npm run bake -- tbl` | `packers/pack-canonical-tbl.ts` | `src/common/i18n/canonical-tbl-data.ts` | 提取原版中英文 `.tbl` 字符串表（含资料片 NPC 对话中文补全） |
| `weather` | `npm run pack:weather` | `packers/pack-weather.ts` | `public/weather/weather.json` | 提取 1.13c 天气（LoadWeather 0x6fb31750）所需的 5 幕 `pal.dat` 调色板与实际绘制的 `Rain3`/`Rain4`/`bubble3` DC6 溅射/气泡帧（索引图集） |
| `sound-tables` | `npm run pack:sound-tables` | `packers/pack-sound-tables.ts` | `src/common/audio/sounds-113c.ts`, `src/common/audio/sound-environ-113c.ts` | 从 `Patch_D2.mpq` 提取 1.13c `Sounds.txt` (4,699 行，含 D2Client 0x6fb0e8e1 载入后处理)、`SoundEnviron.txt` (50 行) 与 `Levels.txt` `SoundEnv` (136 关) |
| `sfx` | `npm run pack:sfx` | `packers/pack-sfx.ts` | `public/sound/packs/sfx-core{,-2,-3}.bin` | 调用 `ffmpeg` (`libopus` 32 kbps CBR Ogg Opus) 将 653 条核心常驻音效从 `d2sfx.mpq` / `d2exp.mpq` 转码并合批打包 |
| `music` | `npm run pack:music` | `packers/pack-music.ts` | `public/music/` | 调用 `ffmpeg` (`libopus` 64 kbps CBR WebM Opus) 将 34 首背景音乐与过场曲从 `d2music.mpq` / `D2xMusic.mpq` 转码输出 |
| `manifest` | `npm run pack:manifest` | `io/asset-manifest.ts` | `public/asset-manifest.json` | 递归扫描 `public/` 计算所有资产的字节大小与 SHA-256 哈希，供客户端 Service Worker 增量更新使用 |
| `--verify` | `npm run bake:verify` | `cli.ts` + `audit/verify-entity-packs.ts` + `audit/verify-audio-113c.ts` | *(控制台校验报告)* | 执行 `src/common/pack-contract` 严格校验，确保零缺失文件 (`missingFiles === 0`)、136 关通用 DT1 完整且实体包与掉落表一致；最后运行与 `npm run verify:audio` 相同的 1.13c 音频审计（`tables` / `sfx-core` / `music` 全部已注册 section，任一失败即报错） |

---

### 4. 使用方法

#### 4.1 准备原版 1.13c MPQ 文件与 `ffmpeg`
所有 `public/` 下的离线烘焙产物均已加入 `.gitignore`（不纳入 Git 版本控制）。首次克隆仓库后，请先安装包含 `libopus` 编码器的 `ffmpeg`（推荐 `ffmpeg >= 7.0`，默认读取 `/usr/bin/ffmpeg`，亦可通过环境变量 `FFMPEG_PATH=/path/to/ffmpeg` 或 CLI 参数 `--ffmpeg /path/to/ffmpeg` 指定），并将原版 **Diablo II: Lord of Destruction v1.13c** 的 MPQ 文件放置在仓库根目录下的 `samples/d2/` 目录中（支持软链接，或通过 `D2_DATA_DIR` 环境变量指定目录）：

```text
samples/d2/
├── d2data.mpq       # 必需：基础数据、Act 1-4 瓦片、怪物、UI
├── d2char.mpq       # 必需：角色纸娃娃分层 DCC/COF 动画
├── d2exp.mpq        # 必需：毁灭之王资料片 (Act 5、德鲁伊/刺客、扩展暗金/符文/音效)
├── Patch_D2.mpq     # 必需：1.13c 最终补丁数据表 (Levels.txt, Skills.txt, SuperUniques.txt, Sounds.txt 等)
├── d2sfx.mpq        # 必需：原版基础音效 WAV (pack:sfx / verify:audio)
├── d2music.mpq      # 必需：Act 1-4 背景音乐 WAV (pack:music / verify:audio)
├── D2xMusic.mpq     # 必需：Act 5 资料片背景音乐 WAV (pack:music / verify:audio)
├── d2speech.mpq     # 必需：Act 1-4 语音/过场音频 WAV
└── d2xtalk.mpq      # 必需：Act 5 资料片语音 WAV
```

> **注意（`ffmpeg` 版本敏感度与孤儿文件清理）**：
> - `verify-audio-113c.ts` (`sfx-core`) 要求转码后的 Opus 解码时长与原版 22.05 kHz WAV 误差不超过 `±2.00ms`。旧版 `ffmpeg`（如 2018 年 `N-47683`）在 `22.05kHz -> 48kHz` 重采样尾帧会多填充约 158 个采样点（`+3.3ms`），导致 `sfx-core` 627/653 项校验失败。遇到该问题请升级至 `ffmpeg >= 7.0`（如 `7.0.2` / `8.1.2`）并重跑 `npm run pack:sfx && npm run pack:manifest`。
> - 当烘焙目标发生跨版本调整时，建议在运行 `npm run bake -- all` 前先清理旧的 `public/` 产物目录，防止历史遗留孤儿文件被扫描进 `public/asset-manifest.json`。

#### 4.2 执行全量或分项烘焙

```bash
# 一键执行全量离线资产烘焙 (animdata -> tiles -> characters -> char-layers -> entities -> overlay-rows -> cursor -> missiles -> overlays -> ui -> frontend-ui -> skills -> drop-data -> tbl -> weather -> sound-tables -> sfx -> music -> manifest)
npm run bake -- all

# 若系统 ffmpeg 不在 /usr/bin/ffmpeg，可通过 FFMPEG_PATH 或 --ffmpeg 指定：
# FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npm run bake -- all
# npm run bake -- all --ffmpeg /opt/homebrew/bin/ffmpeg

# （可选）烘焙 5 幕预烘焙场景包与世界拓扑图 (public/packs/) 并刷新清单
npm run pack:acts && npm run pack:manifest

# 或者按需单独烘焙某一类资源（例如仅重打包瓦片、前端 UI、音效或背景音乐）：
npm run pack:tiles
npm run pack:frontend
npm run pack:entities
npm run pack:char-so
npm run pack:weather
npm run pack:sfx
npm run pack:music
npm run pack:manifest

# 烘焙完成后执行严格完整性校验（Fail-Fast 契约检查）
npm run bake:verify
```

---
---

<a id="english"></a>

## English

`src/baker` is the Node.js offline asset baking toolchain. It decodes, palette-maps, packs, and validates original **Diablo II: Lord of Destruction (v1.13c)** MPQ archives (`d2data.mpq`, `d2char.mpq`, `d2exp.mpq`, `Patch_D2.mpq`, `d2sfx.mpq`, etc.) into static sprite atlases and binary bundles under `public/` so the browser client can consume them directly with zero runtime MPQ overhead.

### 1. Module Responsibilities & Architectural Boundaries

- **TypeScript Compiler Constraints (`tsconfig.baker.json`)**:
  - `lib: ["ES2022"]`, `types: ["node"]` — **Pure Node.js CLI module; referencing any browser DOM global is strictly forbidden** (enforced by `tests/arch/boundaries.test.ts` Rule 5).
  - Depends solely on `src/common` (shared MPQ reader, binary format parsers, and `pack-contract` validators); never imports `src/client`, `src/server`, or `src/netproto`.
- **Unified CLI Entry**: [`src/baker/cli.ts`](./cli.ts) (invoked via `npm run bake -- <target>`).

---

### 2. Directory Structure

```text
src/baker/
├── cli.ts                  # Unified CLI entry point supporting individual targets, full bake (all), and contract verification (--verify)
├── index.ts                # Module barrel export
├── mpq-archive-source.ts   # Multi-archive priority MPQ reader backed by local files in samples/d2/
├── packers/                # Asset & data packers (tiles, entities, character paperdoll layers, missiles, overlays, UI, frontend, animdata, drop/path tables)
├── extract/                # 1.13c TXT/BIN table extractors, skill-tree/affix/gem dictionary generators, TTF font builder & D2Net/D2Common table scripts
├── io/                     # 32-bit RGBA PNG encoder, TBL writer, SHA-256 asset-manifest.ts generator & pack publishing utilities
└── audit/                  # Fail-fast bake integrity auditors (verify-packs, verify-tiles, verify-tile-alignment, verify-entity-packs, verify-audio-113c)
```

---

### 3. Bake Targets & Output Artifacts

Running `npm run bake -- <target>` (or the corresponding `npm run pack:*` shortcut) extracts and generates the following static assets from the MPQ files in `samples/d2/`:

| Bake Subcommand (`cli.ts`) | `npm run` Shortcut | Implementation File | Output Path | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tiles` | `npm run pack:tiles` | `packers/pack-tiles.ts` | `public/act-packs/tiles/` | Bakes all 233 level DT1s across 5 acts + the 3 universal DT1s (`Blank.dt1`, `InvisWal.dt1`, `Warp.dt1`) into tile atlases and `drlg-bundle.{json,bin}` |
| `ui` | `npm run pack:ui` | `packers/pack-ui.ts` | `public/ui/` | Bakes in-game HUD control panel, panel backgrounds, buttons, 7-class skill icons, cursors, and inventory grid DC6 sprites |
| `frontend-ui` | `npm run pack:frontend` | `packers/pack-frontend-ui.ts` | `public/ui/frontend/` | Bakes Battle.net login screen, character selection campfire background, 7-class character creation animations, and lobby UI assets |
| `cursor` | `npm run bake -- cursor` | `packers/pack-cursor.ts` | `public/ui/cursor.png` | Bakes cursor sprite atlas and generates `cursor-meta.ts` |
| `skills` | `npm run bake -- skills` | `packers/pack-skill-assets.ts` | `public/skills/` | Extracts 7-class and general skill icon sprites and `manifest.json` |
| `animdata` | `npm run pack:animdata` | `packers/pack-animdata.ts` | `public/anim/` | Extracts `data/global/AnimData.d2` COF frame counts, animation speeds, and keyframe trigger events |
| `characters` | `npm run bake -- characters` | `packers/pack-characters.ts` | `public/entities/` | Bakes 7-class base torso atlases (`char-*.r8` / `char-*.json`) and `character-manifest.json` |
| `char-layers` (`char-so`) | `npm run pack:char-so` | `packers/pack-char-so-layers.ts` | `public/chars/` | Bakes 7-class 16-component paperdoll weapon/armor layer DCC/COF atlases |
| `entities` | `npm run pack:entities` | `packers/pack-entity-assets.ts` | `public/entities/` | Bakes all monsters, SuperUniques (automatically bundling their Minions), NPCs, and interactive world Objects into DCC/DC6/COF atlases |
| `missiles` | `npm run pack:missiles` | `packers/pack-missiles.ts` | `public/missiles/` | Bakes all `Missiles.txt` projectile 32-bit RGBA atlases (with zero-black-fringe alpha filtering for `Trans: 1` spells and blend mode metadata) |
| `overlays` | `npm run pack:overlays` | `packers/pack-overlays.ts` | `public/overlays/` | Bakes all `Overlays.txt` auras, curses, buffs, hit effects, shrine icons, and level-up beams into DCC atlases |
| `overlay-rows` | `npm run bake -- overlay-rows` | `packers/pack-overlay-rows.ts` | `src/common/data/overlay-rows-113c.ts` | Extracts 1.13c state overlay parameter tables from `overlay.bin` and `States.txt` |
| `input-tables` | `npm run bake -- input-tables` | `packers/pack-input-tables-113c.ts` | `src/common/data/input-tables-113c.ts` | Extracts 1.13c hotkey, control action, and input mapping tables |
| `monstats2-flags` | `npm run bake -- monstats2-flags` | `packers/pack-monstats2-flags.ts` | `src/common/data/monstats2-flags-113c.ts` | Extracts `MonStats2.txt` monster collision/draw/corpse/automap flag tables |
| `monster-path` | `npm run bake -- monster-path` | `packers/pack-monster-path-data.ts` | `src/common/data/monster-path-data-113c.ts` | Extracts `MonStats.txt` / `MonStats2.txt` monster pathfinding footprint, velocity, and door flags |
| `acts` | `npm run pack:acts` | `packers/pack-act-assets.ts` | `public/packs/act1..act5/` | Bakes 5-act prebaked level scenes (`act1..act5/`), object pages, `index.json`, and `world-graph.json` |
| `drop-data` | `npm run bake -- drop-data` | `packers/pack-canonical-drop-data.ts` | `src/common/data/canonical-drop-data.ts` | Extracts and audits `MonStats`, `SuperUniques`, and `DifficultyLevels` canonical drop tables |
| `tbl` | `npm run bake -- tbl` | `packers/pack-canonical-tbl.ts` | `src/common/i18n/canonical-tbl-data.ts` | Extracts canonical bilingual `.tbl` string tables (including expansion NPC dialogue Chinese translations) |
| `weather` | `npm run pack:weather` | `packers/pack-weather.ts` | `public/weather/weather.json` | Extracts what the 1.13c weather (LoadWeather 0x6fb31750) reads: the 5 act `pal.dat` palettes and the drawn `Rain3`/`Rain4`/`bubble3` DC6 splash/bubble frames (indexed atlas) |
| `sound-tables` | `npm run pack:sound-tables` | `packers/pack-sound-tables.ts` | `src/common/audio/sounds-113c.ts`, `src/common/audio/sound-environ-113c.ts` | Extracts the 1.13c `Sounds.txt` (4,699 rows, with the D2Client 0x6fb0e8e1 load post-processing), `SoundEnviron.txt` (50 rows) and `Levels.txt` `SoundEnv` (136 levels) from `Patch_D2.mpq` |
| `sfx` | `npm run pack:sfx` | `packers/pack-sfx.ts` | `public/sound/packs/sfx-core{,-2,-3}.bin` | Transcodes the 653 core resident SFX from `d2sfx.mpq` / `d2exp.mpq` into 32 kbps CBR Ogg Opus (`core.bin` + `core.json`) via `ffmpeg` (`libopus`) |
| `music` | `npm run pack:music` | `packers/pack-music.ts` | `public/music/` | Transcodes the 34 BGM & cutscene tracks from `d2music.mpq` / `D2xMusic.mpq` into 64 kbps CBR WebM Opus under `public/music/` via `ffmpeg` (`libopus`) |
| `manifest` | `npm run pack:manifest` | `io/asset-manifest.ts` | `public/asset-manifest.json` | Recursively scans `public/` to compute byte sizes and SHA-256 hashes for incremental Service Worker caching |
| `--verify` | `npm run bake:verify` | `cli.ts` + `audit/verify-entity-packs.ts` + `audit/verify-audio-113c.ts` | *(Console audit report)* | Runs strict `src/common/pack-contract` validation, enforcing `missingFiles === 0`, verifying all 3 universal DT1s across 136 levels, and auditing entity packs & drop data parity; finally runs the same 1.13c audio audit as `npm run verify:audio` (`tables` / `sfx-core` / `music`; any failure fails the command) |

---

### 4. Usage

#### 4.1 Prepare Original 1.13c MPQ Files & `ffmpeg`
All baked artifacts under `public/` are git-ignored (`.gitignore`). On a fresh clone, install `ffmpeg` compiled with `libopus` (`ffmpeg >= 7.0` recommended; defaults to `/usr/bin/ffmpeg` and can be overridden via `FFMPEG_PATH=/path/to/ffmpeg` or `--ffmpeg /path/to/ffmpeg`), and place or symlink your original **Diablo II: Lord of Destruction v1.13c** MPQ archives in `samples/d2/` at the repository root (or set `D2_DATA_DIR`):

```text
samples/d2/
├── d2data.mpq       # Required: base data, Act 1-4 tiles, monsters, UI
├── d2char.mpq       # Required: character paperdoll layer DCC/COF animations
├── d2exp.mpq        # Required: Lord of Destruction expansion (Act 5, Druid/Assassin, expansion items/runes/SFX)
├── Patch_D2.mpq     # Required: final 1.13c patch data tables (Levels.txt, Skills.txt, SuperUniques.txt, Sounds.txt, etc.)
├── d2sfx.mpq        # Required: base game SFX WAVs (pack:sfx / verify:audio)
├── d2music.mpq      # Required: Act 1-4 music WAVs (pack:music / verify:audio)
├── D2xMusic.mpq     # Required: Act 5 expansion music WAVs (pack:music / verify:audio)
├── d2speech.mpq     # Required: Act 1-4 speech/cinematic audio WAVs
└── d2xtalk.mpq      # Required: Act 5 expansion speech WAVs
```

> **Notes (`ffmpeg` Version Sensitivity & Orphan Cleanup)**:
> - `verify-audio-113c.ts` (`sfx-core`) requires decoded Opus durations to match the 1.13c 22.05 kHz WAV duration within `±2.00ms`. Legacy `ffmpeg` builds (e.g. 2018 `N-47683`) append `~158` trailing samples (`+3.3ms`) during `22.05kHz -> 48kHz` resampling, causing 627/653 rows in `sfx-core` to fail. Upgrade to `ffmpeg >= 7.0` (e.g. `7.0.2` / `8.1.2`) and re-run `npm run pack:sfx && npm run pack:manifest`.
> - When bake targets change across milestones, clean `public/` before running `npm run bake -- all` so stale orphan files are not indexed into `public/asset-manifest.json`.

#### 4.2 Run Full or Granular Baking

```bash
# Run full offline asset bake (animdata -> tiles -> characters -> char-layers -> entities -> overlay-rows -> cursor -> missiles -> overlays -> ui -> frontend-ui -> skills -> drop-data -> tbl -> weather -> sound-tables -> sfx -> music -> manifest)
npm run bake -- all

# Override ffmpeg binary path if not located at /usr/bin/ffmpeg:
# FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npm run bake -- all
# npm run bake -- all --ffmpeg /opt/homebrew/bin/ffmpeg

# (Optional) Bake 5-act prebaked map scenes & world graph (public/packs/) and refresh manifest
npm run pack:acts && npm run pack:manifest

# Or bake individual asset categories on demand:
npm run pack:tiles
npm run pack:frontend
npm run pack:entities
npm run pack:char-so
npm run pack:weather
npm run pack:sfx
npm run pack:music
npm run pack:manifest

# Verify baked output against fail-fast contracts
npm run bake:verify
```
