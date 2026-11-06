# `src/common` — 纯 TypeScript 共享底座模块 / Pure TypeScript Shared Foundation Module

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/common` 是 **Diablo II: Lord of Destruction (v1.13c)** Web 移植版的纯计算与数据结构底座，1:1 对齐原版 `D2Common.dll`、`Storm.dll` 与 `D2Lang.dll` 的核心逻辑，供客户端 (`src/client`)、内置服务端 (`src/server`)、离线烘焙管线 (`src/baker`)、扩展插件 (`plugins/`) 与 Oracle 差分套件 (`tools/oracle/`) 共同复用。

### 1. 模块职责与架构边界

- **对应原版 DLL**：`D2Common.dll`（DRLG 地图生成、动态寻路与步进碰撞引擎、数据表、碰撞掩码、单位/技能/物品基础公式、64 位定点乘除 `mulDiv113c`、64 位随机数）、`Storm.dll`（MPQ 归档解析与 PKWARE/Huffman/ADPCM 解压）、`D2Lang.dll`（`.tbl` 字符串表与本地化）。
- **TypeScript 工程约束（`tsconfig.common.json`）**：
  - `lib: ["ES2022"]`, `types: []` —— **零 DOM 依赖、零 Node.js API 依赖、零外部运行时依赖**。
  - 严禁依赖 `src/client`、`src/server`、`src/baker` 或 `src/netproto`（由 `tests/arch/boundaries.test.ts` Rules 1–4 强制门禁校验）。
  - 所有文件 I/O 均通过依赖注入的 `ArchiveSource` 接口完成，确保本模块可在浏览器主线程、WebWorker 与 Node.js 离线工具中无差别运行。

---

### 2. 目录结构

```text
src/common/
├── mpq/             # Storm.dll MPQ 归档读取器、Hash/Block 表解密、多算法解压扇区
├── formats/         # 原生二进制格式解析器 (DC6, DCC, DT1, DS1, COF, PL2, PAL, CEL, PCX, TBL, WAV, D2S, AnimData, Automap, Bitstream)
├── data/            # D2DataRegistry 数据表注册中心与 1.13c 算子 (mul-div-113c.ts 64 位有符号乘除 0x6FD511E0、calc-ast 字节码求值器、mon-equip-113c、skilldesc-table、canonical-drop/quest/vendor-data 等)
├── drlg/            # D2Common.dll 1.13c DRLG 随机地图生成器、关卡脚本预加载怪物表 (level-scripted-monsters-113c) 与碰撞/光照/POPS 网格
├── path/            # D2Common.dll 1.13c 动态路径规划 (path-compute)、左右手沿墙绕障、Q16.16 步进运动学 (step) 与碰撞足迹引擎 (collision)
├── world/           # 跨端共享的地图/关卡几何拓扑、下层墙分类 (isLowerWallType)、区域进入横幅状态机 (level-entry-title-113c)、Objects.txt 元数据与环境光照计算
├── items/           # 物品属性引擎 (StatOpEngine)、需求等级 (ITEMS_GetRequiredLevel)、腰带容量、套装加成 (set-bonuses)、词缀、孔数与 Tooltip 组装
├── skills/          # 357 行 Skills.txt 数值公式、协同加成 (Synergy)、光环目标过滤 (aura-filter.ts)、Town 施法限制与等级曲线解析
├── units/           # 单位属性 (StatList)、1.13c FCR/IAS/WSM/FHR/FBR 动画帧速与剪辑表 (char-anim-speed / char-anim-clips-113c)、冰冻碎裂判定 (monster-death-fx)、64 方向转换与状态位 (States)
├── audio/           # 1.13c Sounds.txt (4,699 行)、SoundEnviron.txt (50 行)、技能/怪物/物件/状态音效与 NPC 语音索引表
├── gfx/             # 1.13c D2gfx / D2Direct3D eDrawMode 混合模式映射 (draw-mode.ts) 与 Gamma/对比度斜率曲线 (gamma-contrast-113c.ts)
├── progression/     # 1.13c 角色等级经验阈值与经验衰减计算 (experience-113c.ts)
├── chat/            # 1.13c 聊天颜色码与消息格式化工具 (chat-113c.ts)
├── ui/              # 跨端共享的 UI 布局与高清指针元数据辅助模块
├── i18n/            # D2Lang.dll 字符串哈希与中英文双语 TBL / Tooltip 词典查找表
├── rng/             # D2Rng (64-bit Carry-Multiply 0x6FDAA9E0) 与 SplitMix64 空间哈希
└── pack-contract/   # 烘焙管线 (Baker) 与客户端 (Client) 共享的离线资产包 Schema 及校验契约
```

---

### 3. 核心子系统详解

#### 3.1 MPQ 与二进制格式解析 (`mpq/`, `formats/`)
- **`mpq-reader.ts`**：完整实现 MPQ v1 归档格式解析，支持 Hash Table / Block Table 加密种子计算、单文件与多扇区 PKWARE DCL / Zlib / Huffman 组合解压。
- **`dc6.ts` / `dcc.ts`**：解析 UI/物品/怪物/角色序列帧图像及方向图层数据，还原 DCC 变长比特流（Cell 缓冲与 EqualCells/PixelMask 双阶段编码）。
- **`dt1.ts` / `ds1.ts`**：解析地面/墙壁/屋顶瓦片（256×128 Isometric Diamond 与 RLE 子块）以及预制地图块（Floor/Wall/Shadow/Object/Substitution 图层与 NPC 巡逻路径）。
- **`cof.ts` / `animdata.ts`**：解析复合对象动画帧数、16 图层优先级组合顺序、关键帧触发事件（攻击命中、投射物释放、音效帧）及 `AnimData.d2` 动画速度表。
- **`pl2.ts` / `pal.ts`**：解析各幕 256 色调色板、光照衰减表、阴影混合表与 `RandTransforms` / `Colormap` 色彩变换矩阵（装备染色、怪物精英变色、冰冻/毒素变色）。

#### 3.2 数据注册中心与定点算子 (`data/`)
- **`D2DataRegistry` (`data/data-registry.ts`)**：集中加载并索引 `Levels.txt`、`LvlTypes.txt`、`LvlPrest.txt`、`LvlMaze.txt`、`LvlSub.txt`、`MonStats.txt`、`MonStats2.txt`、`SuperUniques.txt`、`Missiles.txt`、`Overlays.txt`、`Objects.txt`、`Skills.txt`、`SkillDesc.txt`、`SetItems.txt`、`Sets.txt`、`Armor/Weapons/Misc.txt` 等全量 1.13c 数据表，支持预烘焙快照与基于 `ArchiveSource` 的 MPQ 实时解析。
- **`mulDiv113c` (`data/mul-div-113c.ts`) & `calc-ast.ts`**：基于 `BigInt` 逐位复刻 `D2Common.dll` (`0x6FD511E0`) / `D2Game.dll` (`0x6FC214D0`) 的 `imul + idiv` 64 位有符号向零截断乘除算子及 73 个 `SkillCalc` / 43 个 `MissCalc` 字节码求值器，经 Wine `fn-sweep` 验证 801.7 万个公式返回值与原生 DLL 100.00% 逐位一致。

#### 3.3 1.13c DRLG 地图生成引擎 (`drlg/`) 与动态寻路引擎 (`path/`)
严格复刻 `D2Common.dll` 的确定性关卡生成与运动寻路流水线：
- **通用 DT1 强制加载 (`drlg-roomtile.ts`)**：遵循 `DRLGROOM_LoadDt1Files` (`0x6fdb8400`)，所有关卡无条件挂载 `Act1/Outdoors/Blank.dt1`、`InvisWal.dt1`（含 `style=49, sequence=7` 隐形碰撞地板）与 `Warp.dt1`。
- **三种生成拓扑**：
  - `drlg-preset.ts`：固定预设关卡（如罗格营地、鲁·高因、崔斯特瑞姆、混沌避难所、憎恨的囚牢第 3 层等）。
  - `drlg-maze.ts`：地牢迷宫房间拼接算法（如墓穴、修道院地下城、塔拉夏古墓等）。
  - `drlg-outdoors.ts` / `drlg-outwild.ts`：野外随机边界、道路、河流、预设营地塞入与主题墙壁围合（如鲜血荒地、冰冷之原、库拉斯特丛林等，与 1.13c `D2Common.dll` 逐次 RNG 调用对齐）。
- **1.13c 动态路径与碰撞步进引擎 (`path/`)**：
  - 复刻 `D2Common` 动态路径计算（`path-compute.ts`）、左右手沿墙绕障、Q16.16 步进位移（`step.ts`）与多尺寸单位碰撞足迹检测（`collision.ts`），精确对齐客户端与服务端单位移动轨迹。

#### 3.4 确定性随机数 (`rng/`) 与离线资产契约 (`pack-contract/`)
- **`D2Rng` (`rng/d2-rng.ts`)**：1:1 复刻 `D2Common.dll` 64 位进位乘法 PRNG（`seed = (0x6AC690C5 * low32 + carry) >>> 0`），保证给定相同的 32 位地图种子与难度，生成的地图拓扑与原生 C++ D2GS 完全一致。
- **`pack-contract/`**：定义 `public/` 下所有规范化离线资产包（`act-packs/tiles`、`entities`、`chars`、`missiles`、`overlays`、`ui`、`ui/frontend`、`anim`、`weather` 等）的 Schema 与 Fail-Fast 校验器（强制要求 `missingFiles === 0` 且三大通用 DT1 齐全）。

---

### 4. 常用验证命令

```bash
# 单独对 src/common 进行严格无 DOM / 无 Node 类型检查
npx tsc -p tsconfig.common.json --noEmit

# 运行架构边界与 DRLG / 公式黄金集单元测试
npx vitest run tests/arch/boundaries.test.ts tests/drlg-act1-oracle.test.ts tests/oracle/fn-sweep.test.ts
```

---
---

<a id="english"></a>

## English

`src/common` is the pure computation and data-structure foundation of the **Diablo II: Lord of Destruction (v1.13c)** Web port, faithfully mirroring the core logic of `D2Common.dll`, `Storm.dll`, and `D2Lang.dll` and shared across the browser client (`src/client`), built-in server (`src/server`), offline asset baker (`src/baker`), extensions (`plugins/`), and the Wine Oracle harness (`tools/oracle/`).

### 1. Module Responsibilities & Architectural Boundaries

- **Original DLL Counterparts**: `D2Common.dll` (DRLG level generation, dynamic pathfinding & step collision engine, data tables, collision masks, unit/skill/item formulas, 64-bit signed `mulDiv113c`, 64-bit PRNG), `Storm.dll` (MPQ archive parsing and PKWARE/Huffman/ADPCM decompression), and `D2Lang.dll` (`.tbl` string tables and localization).
- **TypeScript Compiler Constraints (`tsconfig.common.json`)**:
  - `lib: ["ES2022"]`, `types: []` — **Zero DOM dependencies, zero Node.js API dependencies, and zero external runtime dependencies**.
  - Never imports `src/client`, `src/server`, `src/baker`, or `src/netproto` (enforced by `tests/arch/boundaries.test.ts` Rules 1–4).
  - All file I/O is abstracted behind the dependency-injected `ArchiveSource` interface so this module runs identically in the browser main thread, WebWorkers, and Node.js CLI tools.

---

### 2. Directory Structure

```text
src/common/
├── mpq/             # Storm.dll MPQ archive reader, Hash/Block table decryption & multi-algorithm sector decompression
├── formats/         # Native binary format parsers (DC6, DCC, DT1, DS1, COF, PL2, PAL, CEL, PCX, TBL, WAV, D2S, AnimData, Automap, Bitstream)
├── data/            # D2DataRegistry table center & 1.13c primitives (mul-div-113c.ts bit-exact 0x6FD511E0 MulDiv, calc-ast evaluator, mon-equip-113c, skilldesc-table, canonical-drop/quest/vendor-data, etc.)
├── drlg/            # D2Common.dll 1.13c DRLG procedural level generators, per-level scripted monster tables (level-scripted-monsters-113c) & collision/lighting/POPS grids
├── path/            # D2Common.dll 1.13c dynamic path computation (path-compute), wall-following, Q16.16 step kinematics (step) & collision footprints (collision)
├── world/           # Shared level geometry, lower-wall routing (isLowerWallType), level entry banner state machine (level-entry-title-113c), Objects.txt metadata & environment lighting
├── items/           # Item StatOp engine, required level (ITEMS_GetRequiredLevel), belt capacity, Set bonuses (set-bonuses), affixes, sockets & tooltip builder
├── skills/          # 357-row Skills.txt formulas, synergy calculations, aura target filter (aura-filter.ts), town cast restrictions & level scaling curves
├── units/           # Unit StatList, 1.13c FCR/IAS/WSM/FHR/FBR animation speed & clip tables (char-anim-speed / char-anim-clips-113c), freeze shatter rules (monster-death-fx), dir64 helpers & unit states
├── audio/           # 1.13c Sounds.txt (4,699 rows), SoundEnviron.txt (50 rows), skill/monster/object/state sound tables & NPC speech indices
├── gfx/             # 1.13c D2gfx / D2Direct3D eDrawMode blend mode tables (draw-mode.ts) & gamma/contrast ramp curves (gamma-contrast-113c.ts)
├── progression/     # 1.13c character experience thresholds and level difference XP scaling (experience-113c.ts)
├── chat/            # 1.13c chat color codes and message formatting helpers (chat-113c.ts)
├── ui/              # Shared UI layout and HD cursor metadata helpers
├── i18n/            # D2Lang.dll string hashing and bilingual CHI/ENG TBL & tooltip lookup tables
├── rng/             # D2Rng (64-bit Carry-Multiply 0x6FDAA9E0) and SplitMix64 spatial hashing
└── pack-contract/   # Shared offline asset bundle schemas and fail-fast validators used by both Baker and Client
```

---

### 3. Core Subsystems

#### 3.1 MPQ & Binary Format Parsers (`mpq/`, `formats/`)
- **`mpq-reader.ts`**: Full MPQ v1 archive parser supporting Hash Table / Block Table seed decryption and single/multi-sector PKWARE DCL, Zlib, and Huffman decompression.
- **`dc6.ts` / `dcc.ts`**: Decodes UI, item, monster, and character sprite sequences and directional layers, including DCC variable-length bitstreams (`EqualCells` / `PixelMask` two-stage encoding).
- **`dt1.ts` / `ds1.ts`**: Parses floor/wall/roof isometric tiles (256×128 diamonds and RLE sub-blocks) and preset map stamps (Floor/Wall/Shadow/Object/Substitution layers and NPC paths).
- **`cof.ts` / `animdata.ts`**: Parses composite object animation frame counts, 16-layer draw priority tables, keyframe event triggers, and `AnimData.d2` frame speeds.
- **`pl2.ts` / `pal.ts`**: Parses 256-color act palettes, light attenuation tables, shadow blend tables, and `RandTransforms` / `Colormap` tint matrices.

#### 3.2 Data Registry & Fixed-Point Primitives (`data/`)
- **`D2DataRegistry` (`data/data-registry.ts`)**: Central index for `Levels.txt`, `LvlTypes.txt`, `LvlPrest.txt`, `LvlMaze.txt`, `LvlSub.txt`, `MonStats.txt`, `MonStats2.txt`, `SuperUniques.txt`, `Missiles.txt`, `Overlays.txt`, `Objects.txt`, `Skills.txt`, `SkillDesc.txt`, `SetItems.txt`, `Sets.txt`, `Armor/Weapons/Misc.txt`, and all other 1.13c data tables, supporting both pre-baked snapshots and live MPQ parsing via `ArchiveSource`.
- **`mulDiv113c` (`data/mul-div-113c.ts`) & `calc-ast.ts`**: `BigInt`-backed bit-exact port of `D2Common.dll` (`0x6FD511E0`) / `D2Game.dll` (`0x6FC214D0`) signed 64-bit truncating `imul + idiv` arithmetic and all 73 `SkillCalc` / 43 `MissCalc` bytecode callbacks—verified to 100.00% bit-exact parity across 8.017M values against native 1.13c DLLs.

#### 3.3 1.13c DRLG Map Generation Engine (`drlg/`) & Dynamic Path Engine (`path/`)
Faithfully replicates `D2Common.dll`'s deterministic level generation and unit pathing pipelines:
- **Mandatory Universal DT1 Loading (`drlg-roomtile.ts`)**: Per `DRLGROOM_LoadDt1Files` (`0x6fdb8400`), every level unconditionally loads `Act1/Outdoors/Blank.dt1`, `InvisWal.dt1` (including `style=49, sequence=7` invisible collision floor), and `Warp.dt1`.
- **Three Generation Topologies**:
  - `drlg-preset.ts`: Fixed preset levels (Rogue Encampment, Lut Gholein, Tristram, Chaos Sanctuary, Durance of Hate Level 3, etc.).
  - `drlg-maze.ts`: Dungeon maze room stitching (Catacombs, Maggot Lair, Tal Rasha's Tomb, etc.).
  - `drlg-outdoors.ts` / `drlg-outwild.ts`: Outdoor borders, dirt roads, rivers, preset sub-maps, and themed wall enclosures (bit-exact against 1.13c `D2Common.dll`).
- **1.13c Dynamic Path & Collision Footprint Engine (`path/`)**:
  - Ports `D2Common` dynamic path computation (`path-compute.ts`), left/right wall-following, Q16.16 step kinematics (`step.ts`), and unit collision footprint checks (`collision.ts`).

#### 3.4 Deterministic PRNG (`rng/`) & Offline Asset Contracts (`pack-contract/`)
- **`D2Rng` (`rng/d2-rng.ts`)**: Bit-exact port of `D2Common.dll`'s 64-bit carry-multiply PRNG (`seed = (0x6AC690C5 * low32 + carry) >>> 0`), guaranteeing identical level topologies between the browser and native C++ D2GS for any 32-bit `mapSeed` and difficulty.
- **`pack-contract/`**: Defines schemas and fail-fast validators for all canonical offline asset bundles under `public/` (`act-packs/tiles`, `entities`, `chars`, `missiles`, `overlays`, `ui`, `ui/frontend`, `anim`, `weather`, etc., enforcing `missingFiles === 0` and verifying the 3 universal DT1s).

---

### 4. Common Verification Commands

```bash
# Run strict DOM-free / Node-free typecheck on src/common
npx tsc -p tsconfig.common.json --noEmit

# Run architectural boundary, DRLG, and Oracle formula golden unit tests
npx vitest run tests/arch/boundaries.test.ts tests/drlg-act1-oracle.test.ts tests/oracle/fn-sweep.test.ts
```
