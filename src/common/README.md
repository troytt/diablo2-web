# `src/common` — 纯 TypeScript 共享底座模块 / Pure TypeScript Shared Foundation Module

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/common` 是 **Diablo II: Lord of Destruction (v1.13c)** Web 移植版的纯计算与数据结构底座，1:1 对齐原版 `D2Common.dll`、`Storm.dll` 与 `D2Lang.dll` 的核心逻辑。

### 1. 模块职责与架构边界

- **对应原版 DLL**：`D2Common.dll`（DRLG 地图生成、动态寻路与步进碰撞引擎、数据表、碰撞掩码、单位/技能/物品基础公式、64 位随机数）、`Storm.dll`（MPQ 归档解析与 PKWARE/Huffman/Adpcm 解压）、`D2Lang.dll`（`.tbl` 字符串表与本地化）。
- **TypeScript 工程约束（`tsconfig.common.json`）**：
  - `lib: ["ES2022"]`, `types: []` —— **零 DOM 依赖、零 Node.js API 依赖、零外部运行时依赖**。
  - 严禁依赖 `src/client`、`src/server`、`src/baker` 或 `src/netproto`（由 `tests/arch/boundaries.test.ts` Rules 1–4 强制门禁校验）。
  - 所有文件 I/O 均通过依赖注入的 `ArchiveSource` 接口完成，确保本模块可在浏览器主线程、WebWorker 与 Node.js 离线工具中无差别运行。

---

### 2. 目录结构

```text
src/common/
├── mpq/             # Storm.dll MPQ 归档读取器、Hash/Block 表解密、多算法解压扇区
├── formats/         # 原生二进制格式解析器 (DC6, DCC, DT1, DS1, COF, PL2, PAL, CEL, PCX, TBL, AnimData, Automap, Bitstream)
├── data/            # D2DataRegistry 数据表注册中心与 TXT/JSON 数据模型定义
├── drlg/            # D2Common.dll 1.13c DRLG 随机地图生成器与碰撞/光照网格
├── path/            # D2Common.dll 1.13c 动态路径规划 (path-compute)、步进运动学 (step) 与碰撞足迹引擎 (collision)
├── world/           # 跨端共享的地图/关卡几何拓扑、Objects.txt 模式可选中性/NPC 静态占位符映射 (objects-meta) 与环境光照计算 (environment)
├── items/           # 物品基础属性、需求等级 (ITEMS_GetRequiredLevel)、套装加成 (set-bonuses)、词缀、孔数与 Tooltip 组装
├── skills/          # 技能基础公式、协同加成 (Synergy)、Town 施法限制与等级曲线解析
├── units/           # 单位属性 (StatList)、1.13c FCR/IAS/WSM 动画帧速计算 (char-anim-speed)、64 方向转换与状态位 (States)
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

#### 3.2 数据注册中心 (`data/`)
- **`D2DataRegistry` (`data/index.ts`)**：集中加载并索引 `Levels.txt`、`LvlTypes.txt`、`LvlPrest.txt`、`LvlMaze.txt`、`LvlSub.txt`、`MonStats.txt`、`MonStats2.txt`、`SuperUniques.txt`、`Missiles.txt`、`Overlays.txt`、`Objects.txt`、`Skills.txt`、`SkillDesc.txt`、`SetItems.txt`、`Sets.txt`、`Armor/Weapons/Misc.txt` 等全量 1.13c 数据表。
- 支持注入内存 JSON 快照或基于 `ArchiveSource` 的 MPQ 实时解析。

#### 3.3 1.13c DRLG 地图生成引擎 (`drlg/`) 与动态寻路引擎 (`path/`)
严格复刻 `D2Common.dll` 的确定性关卡生成与运动寻路流水线：
- **通用 DT1 强制加载 (`drlg-roomtile.ts`)**：遵循 `DRLGROOM_LoadDt1Files` (`0x6fdb8400`)，所有关卡无条件挂载 `Act1/Outdoors/Blank.dt1`、`InvisWal.dt1`（含 `style=49, sequence=7` 隐形碰撞地板）与 `Warp.dt1`。
- **三种生成拓扑**：
  - `drlg-preset.ts`：固定预设关卡（如罗格营地、鲁·高因、崔斯特瑞姆、混沌避难所、憎恨的囚牢第 3 层等）。
  - `drlg-maze.ts`：地牢迷宫房间拼接算法（如墓穴、修道院地下城、塔拉夏古墓等）。
  - `drlg-outdoors.ts` / `drlg-outwild.ts`：野外随机边界、道路、河流、预设营地塞入与主题墙壁围合（如鲜血荒地、冰冷之原、库拉斯特丛林等，与 1.13c `D2Common.dll` 逐次 RNG 调用对齐）。
- **1.13c 动态路径与碰撞步进引擎 (`path/`)**：
  - 复刻 `D2Common` 动态路径计算（`path-compute.ts`）、步进位移（`step.ts`）与多尺寸单位碰撞足迹检测（`collision.ts`），精确对齐客户端与服务端单位移动轨迹。

#### 3.4 确定性随机数 (`rng/`) 与离线资产契约 (`pack-contract/`)
- **`D2Rng` (`rng/d2-rng.ts`)**：1:1 复刻 `D2Common.dll` 64 位进位乘法 PRNG（`seed = (0x6AC690C5 * low32 + carry) >>> 0`），保证给定相同的 32 位地图种子与难度，生成的地图拓扑与原生 C++ D2GS 完全一致。
- **`pack-contract/`**：定义 `public/` 下所有规范化离线资产包（`act-packs/tiles`、`entities`、`chars`、`missiles`、`overlays`、`ui`、`ui/frontend`、`anim`、`weather` 等）的 Schema 与 Fail-Fast 校验器（强制要求 `missingFiles === 0` 且三大通用 DT1 齐全）。

---

### 4. 常用验证命令

```bash
# 单独对 src/common 进行严格无 DOM / 无 Node 类型检查
npx tsc -p tsconfig.common.json --noEmit

# 运行架构边界与 DRLG / 寻路 / 格式解析单元测试
npx vitest run tests/arch/boundaries.test.ts tests/drlg-act1-oracle.test.ts
```

---
---

<a id="english"></a>

## English

`src/common` is the pure computation and data-structure foundation of the **Diablo II: Lord of Destruction (v1.13c)** Web port, faithfully mirroring the core logic of `D2Common.dll`, `Storm.dll`, and `D2Lang.dll`.

### 1. Module Responsibilities & Architectural Boundaries

- **Original DLL Counterparts**: `D2Common.dll` (DRLG level generation, dynamic pathfinding & step collision engine, data tables, collision masks, unit/skill/item formulas, 64-bit PRNG), `Storm.dll` (MPQ archive parsing and PKWARE/Huffman/ADPCM decompression), and `D2Lang.dll` (`.tbl` string tables and localization).
- **TypeScript Compiler Constraints (`tsconfig.common.json`)**:
  - `lib: ["ES2022"]`, `types: []` — **Zero DOM dependencies, zero Node.js API dependencies, and zero external runtime dependencies**.
  - Never imports `src/client`, `src/server`, `src/baker`, or `src/netproto` (enforced by `tests/arch/boundaries.test.ts` Rules 1–4).
  - All file I/O is abstracted behind the dependency-injected `ArchiveSource` interface so this module runs identically in the browser main thread, WebWorkers, and Node.js CLI tools.

---

### 2. Directory Structure

```text
src/common/
├── mpq/             # Storm.dll MPQ archive reader, Hash/Block table decryption & multi-algorithm sector decompression
├── formats/         # Native binary format parsers (DC6, DCC, DT1, DS1, COF, PL2, PAL, CEL, PCX, TBL, AnimData, Automap, Bitstream)
├── data/            # D2DataRegistry data table center and TXT/JSON schema definitions
├── drlg/            # D2Common.dll 1.13c DRLG procedural level generators and collision/lighting grids
├── path/            # D2Common.dll 1.13c dynamic path computation (path-compute), step kinematics (step) & collision footprints (collision)
├── world/           # Shared level geometry, Objects.txt mode selectability / NPC static placeholder mapping (objects-meta) & environment lighting (environment)
├── items/           # Item stat engine, required level (ITEMS_GetRequiredLevel), Set bonuses (set-bonuses), affixes, sockets & tooltip builder
├── skills/          # Skill formulas, synergy calculations, town cast restrictions & level scaling curves
├── units/           # Unit StatList, 1.13c FCR/IAS/WSM animation speed formulas (char-anim-speed), dir64 helpers & unit states
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

#### 3.2 Data Registry (`data/`)
- **`D2DataRegistry` (`data/index.ts`)**: Central index for `Levels.txt`, `LvlTypes.txt`, `LvlPrest.txt`, `LvlMaze.txt`, `LvlSub.txt`, `MonStats.txt`, `MonStats2.txt`, `SuperUniques.txt`, `Missiles.txt`, `Overlays.txt`, `Objects.txt`, `Skills.txt`, `SkillDesc.txt`, `SetItems.txt`, `Sets.txt`, `Armor/Weapons/Misc.txt`, and all other 1.13c data tables.
- Supports both pre-baked JSON snapshots and on-demand MPQ parsing via `ArchiveSource`.

#### 3.3 1.13c DRLG Map Generation Engine (`drlg/`) & Dynamic Path Engine (`path/`)
Faithfully replicates `D2Common.dll`'s deterministic level generation and unit pathing pipelines:
- **Mandatory Universal DT1 Loading (`drlg-roomtile.ts`)**: Per `DRLGROOM_LoadDt1Files` (`0x6fdb8400`), every level unconditionally loads `Act1/Outdoors/Blank.dt1`, `InvisWal.dt1` (including `style=49, sequence=7` invisible collision floor), and `Warp.dt1`.
- **Three Generation Topologies**:
  - `drlg-preset.ts`: Fixed preset levels (Rogue Encampment, Lut Gholein, Tristram, Chaos Sanctuary, Durance of Hate Level 3, etc.).
  - `drlg-maze.ts`: Dungeon maze room stitching (Catacombs, Maggot Lair, Tal Rasha's Tomb, etc.).
  - `drlg-outdoors.ts` / `drlg-outwild.ts`: Outdoor borders, dirt roads, rivers, preset sub-maps, and themed wall enclosures (bit-exact against 1.13c `D2Common.dll`).
- **1.13c Dynamic Path & Collision Footprint Engine (`path/`)**:
  - Ports `D2Common` dynamic path computation (`path-compute.ts`), step kinematics (`step.ts`), and unit collision footprint checks (`collision.ts`).

#### 3.4 Deterministic PRNG (`rng/`) & Offline Asset Contracts (`pack-contract/`)
- **`D2Rng` (`rng/d2-rng.ts`)**: Bit-exact port of `D2Common.dll`'s 64-bit carry-multiply PRNG (`seed = (0x6AC690C5 * low32 + carry) >>> 0`), guaranteeing identical level topologies between the browser and native C++ D2GS for any 32-bit `mapSeed` and difficulty.
- **`pack-contract/`**: Defines schemas and fail-fast validators for all canonical offline asset bundles under `public/` (`act-packs/tiles`, `entities`, `chars`, `missiles`, `overlays`, `ui`, `ui/frontend`, `anim`, `weather`, etc., enforcing `missingFiles === 0` and verifying the 3 universal DT1s).

---

### 4. Common Verification Commands

```bash
# Run strict DOM-free / Node-free typecheck on src/common
npx tsc -p tsconfig.common.json --noEmit

# Run architectural boundary and DRLG / format unit tests
npx vitest run tests/arch/boundaries.test.ts tests/drlg-act1-oracle.test.ts
```
