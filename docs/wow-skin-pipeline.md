# 把魔兽世界美术资源做成暗黑2 换装皮肤：操作指南

本文记录 `so-wow-human-mage` 皮肤（法师 → WoW 人类女性，随装备换装）的完整做法，供复现或扩展到其他职业。只写实际跑通过的步骤和踩过的坑。

## 1. 总体流程

```mermaid
flowchart LR
  A["下载 3.3.5 客户端包"] --> B["读 MPQ 补丁链"]
  B --> C["解析 M2 / .skin / .anim / BLP2 / DBC"]
  C --> D["选模型并出缩略图给用户挑"]
  D --> E["convert_wow_m2_to_glb.py 生成 GLB + paperdoll"]
  E --> F["gen-war3-skins.ts 打包到 public/skins"]
  F --> G["运行时：装备 → 槽位选项 → 外观"]
  G --> H["浏览器截图验证并合并"]
```

核心思路：**所有换装内容都打进一个 GLB**。武器、盾、头盔是并入的额外 geoset；衣服是贴图图层。运行时只做三件事：切 geoset 显隐、把图层合成到身体贴图、按武器选动作。

## 2. 获取资源

来源：archive.org 条目 `WoW_3.3.5-12340`。

| 文件 | 大小（字节） | md5 | 内容 |
|---|---|---|---|
| `3.3.5-12340_Common.zip` | 15,084,499,971 | `acbb233b015796ca60bb855d1a41b673` | 模型、贴图、动画 |
| `3.3.5-12340_enUS.zip` | 2,628,185,615 | `243917ea1be6a76a332c5306b19a789a` | 语言包，**DBC 表只在这里** |

要点：

- 单连接约 376 KB/s，必须分块并行：按 128 MB 一块、8 并发用 HTTP Range 下载，每块可续传，全部到齐后按偏移顺序拼接，再校验总大小。
- 请求带浏览器 `User-Agent` 和 `Referer`（条目详情页），块之间留 2 秒间隔。
- 放在数据目录 `$WOW_335_DIR` 下，不要放内存盘（两个包解压后约 35 GB）。
- 下载后必须核对 md5，再解压：`unzip -o -q <zip> 'Data/*.MPQ'`、`unzip -o -q <zip> '*.MPQ'`。

解压后的目录：

```
$WOW_335_DIR/
  Data/{common,common-2,expansion,lichking,patch,patch-2,patch-3}.MPQ
  Data/enUS/{locale-enUS,expansion-locale-enUS,lichking-locale-enUS,patch-enUS,patch-enUS-2,patch-enUS-3,...}.MPQ
  DBFilesClient/*.dbc        # 从语言包提取的 246 张表（按补丁链取最新版本）
```

工具通过环境变量 `WOW_335_DIR`（或转换器的 `--wow-dir` 参数）找这个目录。代码里不许写死机器相关的路径。

## 3. 文件格式与现成工具

工具都在 `tools/skin-baker/`：

| 文件 | 作用 |
|---|---|
| `wow_mpq.py` | MPQ v1/v2 读取：哈希表/块表解密、64 位偏移、zlib/bzip2、分扇区与单块。`WowData(root)` 按补丁链取最新版本 |
| `wow_blp.py` | BLP2 解码（调色板、DXT1/3/5、原始 BGRA）→ RGBA |
| `wow_m2.py` | M2 版本 264 + `.skin` + 外置 `.anim`：顶点、骨骼与动画轨、子网格、贴图单元、挂点 |
| `convert_wow_m2_to_glb.py` | 生成皮肤 GLB、预览图、`units.json`；`--verify` 自检，`--sheet` 出离线对照图 |
| `gen-war3-skins.ts` | 打包器（WC3 与 WoW 共用）；`source: 'wow'` 的条目走 WoW 转换器 |

格式要点：

- **补丁链顺序**（新覆盖旧）：`patch-3 → patch-2 → patch → lichking → expansion → common-2 → common`。DBC 的链：`patch-enUS-3 → patch-enUS-2 → patch-enUS → lichking-locale-enUS → expansion-locale-enUS → locale-enUS`。
- **仓库原有的 TS MPQ 读取器只支持 v1**，明确拒绝 v2，不要改它，用 `wow_mpq.py`。
- **M2 骨骼**：蒙皮矩阵 = `父 × T(pivot) × T(t) × R × S × T(-pivot)`。四元数是压缩的 16 位，解包见 `_unpack_quat`。
- **全局序列轨道必须忽略**。由全局序列驱动的骨骼（头发、披风的自由摆动）若参与采样，GLB 回放会和源数据对不上（实测偏差 5.3 单位）。`bone_local` 里这类轨道一律取静止值。
- **`.skin` 的三角形索引指向顶点查找表**，不是直接指向顶点。
- **动画别名**：序列标志 `0x40` 表示别名，要沿 `alias_next` 解析；标志 `0x20` 表示数据在 M2 内，否则在 `<模型名><动画ID 四位>-<子ID 两位>.anim`。
- **DBC**：文件头 `WDBC` + 记录数、字段数、记录大小、字符串块大小；字段都是 4 字节，字符串字段是字符串块内偏移。

用到的 DBC 字段（`ItemDisplayInfo.dbc`，25 个字段）：

| 下标 | 含义 |
|---|---|
| 1–2 | 模型名（左、右） |
| 3–4 | 模型贴图 |
| 7–9 | geoset 组（[0] 袖口，[2] 袍摆） |
| 13–14 | 头盔遮挡规则 ID（男、女） |
| 15–22 | 八个身体分区贴图：上臂、下臂、手、上身、下身、大腿、小腿、脚 |

`Item.dbc`（8 个字段）：下标 1 物品大类（2 武器、4 护甲）、2 子类、5 外观 ID、6 装备位置。

> [!IMPORTANT]
> 客户端 DBC **没有物品品质字段**，也没有物品名（都在服务器数据库）。"不用稀有/史诗"只能按模型命名近似：`_A_` / `_B_` / `_C_` 是通用款；带副本名、`pvp`、`raid`、`dungeon`、`_D_` 的是专属款。再配合"被多少件物品共用"排序。

## 4. 人物模型的关键数据

以 `Character\Human\Female\HumanFemale` 为例（122 根骨骼）。换种族/性别时这些都要重新读出来核对。

**身体贴图分区**（512×512 画布，护甲图层按这些矩形贴）：

| 分区 | 矩形 (x, y, w, h) | 分区 | 矩形 |
|---|---|---|---|
| AU 上臂 | 0, 0, 256, 128 | TU 上身 | 256, 0, 256, 128 |
| AL 下臂 | 0, 128, 256, 128 | TL 下身 | 256, 128, 256, 64 |
| HA 手 | 0, 256, 256, 64 | LU 大腿 | 256, 192, 256, 128 |
| FU 上脸 | 0, 320, 256, 64 | LL 小腿 | 256, 320, 256, 128 |
| FL 下脸 | 0, 384, 256, 128 | FO 脚 | 256, 448, 256, 64 |

底图 = 皮肤整图，再叠下脸、上脸、内裤、胸衣四张。

**护甲贴图命名**：`Item\TextureComponents\<分区目录>\<套装前缀>_<部件>_<分区>_<F|U>.blp`，女性 `F` 优先，没有再用通用 `U`。部件有 `sleeve`、`chest`、`pant`、`robe`、`boot`、`belt`、`glove`。合成顺序：裤 10、靴 20、袖/胸/袍 30、腰带 35。

**geoset 编号**（百位是组）：

| 编号 | 含义 |
|---|---|
| 0、702 | 身体、耳朵（常显） |
| 1 | 光头底模（戴全盔隐藏头发时显示） |
| 2–25 | 发型（现用 9，马尾，能露出头环） |
| 401 / 402 | 裸手 / 手套 |
| 501 / 502 | 裸小腿 / 靴筒 |
| 802 / 803 | 普通袖口 / 喇叭袖口 |
| 1301 / 1302 | 裤腿 / 袍摆 |

**挂点 ID**：0 盾牌，1 右手，2 左手，11 头盔。武器挂右手，**弓挂左手**。

**动画 ID**：0 站立，1 死亡，4 走，5 跑，9 受击，16/17/18/19 空手/单手/双手/长柄攻击，24 盾挡，26/27/28/29 单手/双手/长柄/弓的备战待机，46 射箭，48/49 弩的待机/射击，53 施法，107/108 投掷/投掷待机。

**模型比例**：模型单位是码，统一乘 50（`MODEL_SCALE`）；皮肤里 `px` 为 0.84 场景像素每单位。

## 5. 选模型的流程（和用户对齐）

每一类装备都按这个顺序做，不要直接写死：

1. 用 `Item.dbc` + `ItemDisplayInfo.dbc` 按子类统计每个模型被多少物品使用，按命名筛通用款。
2. 逐个核对模型和贴图文件在 MPQ 里存在。没有任何物品引用的模型没有配套贴图，直接排除。
3. 每个暗黑2 类别给 2–3 个候选，**渲染缩略图**放进计划文档让用户逐行选。
4. 用户选定后再改代码。

统计和缩略图用一次性脚本即可（未入库）：统计脚本读两张 DBC 并按子类计数；缩略图脚本复用 `wow_m2.py` / `wow_blp.py`，武器和盾单独渲染，头盔和衣服借转换器里的离线渲染函数 `render()` 穿到人物身上出图，发型也用同样方式对比。

踩过的坑：

- `club_1h_spiked_a_01` 是客户端的**占位模型**，所以每个武器子类都有物品引用它，复用次数最高但不能用。同理 `cloth_b_07brown` 在各护甲子类里都排第一，也要警惕。
- 通用头盔总共只有约 20 个，覆盖不了暗黑2 的头盔种类，最后经用户同意放宽到套装头盔。
- 长袍的腿部贴图多数叫 `_Pant_LU/LL`（配袍摆 geoset），只有少数套装有 `_Robe_LU/LL`。只按 `robe_` 找会露出肤色。
- 缩略图里每个模型各自缩放到撑满格子，**不代表相对大小**，要在说明里写清楚。
- WoW 早期女性护甲很多露腰露臂，是原美术，不是缺贴图。

## 6. 转换器：GLB 里放什么

`convert_wow_m2_to_glb.py` 输出与 `convert_war3_mdx_to_glb.py` 相同的 GLB 布局（单个 skin、纯平移的逆绑定矩阵、每个 geoset 图层一个 primitive、每个动画的 `extras`），另在根 `extras.paperdoll` 写入：

```json
{
  "canvas": 0,
  "hidden": [3, 4, 5],
  "slots": {
    "armor": { "none": {}, "quilted1": { "show": [7], "hide": [2], "layers": [{ "image": 12, "x": 256, "y": 0, "w": 256, "h": 128, "order": 30 }] } },
    "weapon": { "none": {}, "staff": { "show": [41], "hide": [], "layers": [] } }
  },
  "defaults": { "armor": "none", "weapon": "none" }
}
```

- `canvas`：身体贴图的图像下标。`hidden`：默认隐藏、被选项 `show` 才显示的 geoset。
- 每个槽位一组命名选项；选项可以显示/隐藏 geoset、添加贴图图层。
- **独立模型类装备**（武器、盾、头盔）：读对应 M2，顶点加上挂点位置，全部刚性绑定到挂点骨骼，作为新 geoset 并入。物品自己的贴图类型 2 用外观贴图，类型 0 用模型内写死的文件名。
- **衣服**：`ARMORS` 表里只写套装前缀、是否袍、袖口 geoset；图层由转换器按前缀自动收集。
- **动作**：每种握持方式（`1h`、`2h`、`2hl`、`bow`、`xbow`、`thrown`）导出一个待机和一个攻击动画，命名 `nu:<握持>`、`a1:<握持>`；`units.json` 里的 `aliases` 把每个武器选项（如 `nu:staff`）指到对应握持的动画，避免重复存动画。
- 当前槽位：`armor`（8 组 × 3 阶）、`helm`（11 类）、`weapon`（26 类）、`offhand`（7 类）。靴子不是槽位：底图和非袍类衣服上固定叠一双 `Leather_A_04Brown` 的靴子。

**按种族生成人物**：`SKINS` 里写 `"character": {race, sex, skin, hair, hair_colour, height}` 即可，`character_spec()` 会从 `CharSections.dbc`（皮肤、脸、内衣、头发贴图）和 `CharHairGeosets.dbc`（发型 → geoset）查出底图图层、发型和该种族实际存在的 geoset；头盔模型按种族/性别后缀取（`_HuF`、`_OrM`…），护甲贴图按性别取 `_M` / `_F`。三个索引与游戏创建角色界面一致（发型按非光头样式排序）。`height` 是相对身高：所有人物先归一到同一屏幕高度（`CHARACTER_HEIGHT_PX`），再乘它（矮人 0.88、兽人 1.06）。头发贴图行里写的头皮贴图有的并不存在，缺了就跳过。

**变身模型**：`"morphs": {"<暗黑2 变身 token>": {model, textures, height_px}}` 把生物模型转成 `morph-<token>.glb`（固定外观，无换装）。token：`40` 狼人（状态 139）、`tg` 熊人（状态 140）。

**双持**：`"dual_wield": True` 的人物（野蛮人、刺客）在 `offhand` 槽多出 `w-<武器>` 选项（单手与投掷类武器、双手剑），模型挂左手并做镜像；`weapon` 槽多出 `sword2h1`（单手握的双手剑，用单手动作）。

**共享武器包（精英暗金武器的专属外观）**：`UNIQUE_WEAPONS` 表把 62 把精英级暗金武器（`UniqueItems.txt` 行号）各对应到一个 WoW 模型。它们不进任何人物皮肤：`--weapon-pack` 把每把转成一个独立的小 GLB（武器自身坐标、单关节），打包后放在 `public/skins/wow-weapons/`（`weapons.json` 列出行号 → 文件和主手）。人物 GLB 的 `paperdoll.attachments` 只记录武器包 id 和左右手挂点（关节号 + 偏移）。运行时玩家拿着某把暗金武器时才下载那一个文件，按挂点刚性挂到手上（副手是右手模型的镜像）；加载完成前或站点没有武器包时，显示原来的家族模型和品质泛光。有专属外观的武器不再加泛光。握持动作仍由暗黑2 底材决定。大小按 WoW 原始比例（弓弩因此偏大），两个例外：标枪用长矛缩到 0.6；最长边不足 0.95 码的小件（魔杖、飞刀、飞斧、部分法球等）放大到 0.95 码，最多放大 1.6 倍。人物的渲染框按"能拿到的最长武器"计算，所以比不含武器包时大一些。打包：`npx tsx tools/skin-baker/gen-war3-skins.ts public/skins wow-weapons`。

**采样率**：动画默认按 30 Hz 采样；挥动特别快的人物（德莱尼女）长武器尖端会超出自检阈值，可在皮肤里写 `"sample_hz": 60.0`。

新增一个 WoW 皮肤要做的事：在 `SKINS` 里加一项（上面的 `character`，或像法师那样手写模型路径、底图贴图、发型、基础 geoset、各槽位表、动作表），在 `gen-war3-skins.ts` 的 `WAR3_SKINS` 里加一条 `source: 'wow'`，并在三处注册皮肤 id：`plugins/character-skins/index.ts`（下拉选项和 `otherSkinIds`）、`src/client/render/character-skin-cache.ts`（`BUILTIN_FALLBACK_SKINS`）。

## 7. 运行时与装备映射

| 文件 | 职责 |
|---|---|
| `src/common/units/mesh-skin-model.ts` | 解析 `paperdoll`；`resolveMeshSkinLook(model, 选择, 泛光)` 得到外观（可见 geoset、图层、泛光 geoset、缓存 key） |
| `src/common/units/mesh-skin-paperdoll.ts` | 暗黑2 装备 → 槽位选项；编码成字符串 key 挂在 drawable 上 |
| `src/client/render/mesh-skin-renderer.ts` | 按外观画：跳过隐藏 geoset；图层合成到身体贴图，按 `canvasKey` 缓存；物品泛光 |
| `src/client/session/session-render-builder.ts` | 从 `equipmentBySlot` 取物品代码和品质，生成 key（本地与远程玩家） |
| `src/client/scene/world-renderer.ts` | 把 key 解成外观传给渲染器；按武器选项选动作变体 |
| `src/common/units/character-skin.ts` | 清单校验；动作键允许 `<模式>:<武器选项>` |

映射规则都基于 1.13c 的 `Armor.txt` / `Weapons.txt` 行（经 `getEmbeddedDropTables()`），不按名字猜：

- **家族** = `normcode`（三阶共用）；**阶** = 代码等于 `normcode` / `ubercode` / `ultracode` 中的哪一个。
- **武器**：先按 `type`（`axe`、`swor`、`staf`…），再按家族细分（`mpi` 军用镐、`scm`/`sbr`/`flc` 弯刀、`tri` 三叉戟、`scy`/`wsc` 镰刀），双手标记把斧/锤/剑改成双手款。
- **盾**：`shie` 按家族分形状；`ashd`、`head` 按类型。
- **头盔**：`helm` 按家族；`circ`、`pelt`、`phlm` 按类型。
- **衣服**：`tors` 按家族归 8 组，再加阶号，如 `quilted2`。
- **手套、鞋子、腰带**不参与。
- **双持**：第一只手的武器是主武器，第二件武器进 `offhand` 槽的 `w-<武器>`；主武器是双手剑且另一只手有东西时改用 `sword2h1`（1.13c 野蛮人单手握双手剑）。皮肤没有对应选项时该槽保持为空。
- **品质泛光**（仅武器和盾）：品质 4 魔法蓝、5 套装绿、6 稀有黄、7 暗金、8 手工橙。实现是在叠加光晕层里画物品剪影，外加 8 个偏移采样做光晕。魔法、稀有、手工的强度是套装和暗金的一半。

暗黑2 的身体槽位：1 头、3 衣服、4/5 双手、10 手套、11/12 副武器组。副武器组只在"当前是第二组且 4/5 为空"时生效。

## 8. 打包与部署

```bash
# 只打这个皮肤（第二个参数是皮肤 id；不带则全部重打）
npx tsx tools/skin-baker/gen-war3-skins.ts public/skins so-wow-human-mage
```

- 打包器会先跑转换器的 `--verify`，再用运行时解析器 `parseMeshSkinModel` 读一遍 GLB，失败就中止。
- 产物：`public/skins/<id>/{hero-<hash>.glb, preview-<hash>.png, skin.json}` 和 `<id>.d2skin.zip`、`index.json`。
- `public/skins/` 不入库。合并后要把皮肤目录、zip、`index.json` 拷到实际提供页面的那个检出的 `public/skins/` 下。
- 当前体积：GLB 8.19 MB（gzip 约 6.95 MB），含 236 张贴图。

## 9. 验证清单

| 步骤 | 命令或做法 | 通过标准 |
|---|---|---|
| 转换自检 | `python3 tools/skin-baker/convert_wow_m2_to_glb.py --out-dir <tmp> --verify --sheet <png>` | 最大回放偏差 < 1.0 单位（现约 0.3）；对照图逐格看过 |
| 类型检查 | `npm run typecheck` | 0 错误 |
| 定向测试 | `npx vitest run tests/client/render tests/arch/boundaries.test.ts tests/sw/asset-cache.test.ts tests/baker tests/plugins tests/client/plugin-host tests/tools/test-characters.test.ts --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4` | 全过 |
| 回归 E2E | `xvfb-run -a npx tsx tools/verify-character-skins-browser.ts` | 全过（含纸娃娃用例和其余皮肤） |
| 游戏内截图 | 自写 CDP 脚本，逐件装备截图并断言映射 key 和动作 | 每张图实际看过 |
| 资产审计 | 扫描 GLB 内嵌 PNG 与预览图 | 只有 `IHDR`/`IDAT`/`IEND`，无禁用字符串 |

单元测试的写法：遍历 `Armor.txt` / `Weapons.txt` **全部行**，断言每行落到确定的选项、三阶归属一致、各选项的行数符合预期。新增类别时照此补。

游戏内截图脚本的做法：用 `tools/play-cdp-harness.ts` 的 `withPlayHarness` 启动页面；启用 `character-skins` 插件并把法师皮肤设为目标 id；往 `world.containers.equipmentBySlot` 写入 `{ code, quality, bodyLoc, ... }`，把 `session.selfAppearanceCache` 置空后 `renderFrame`；`Page.captureScreenshot` 截人物附近区域。

验证方面的坑：

- 没有可用显示的机器上，无头 Chrome 要套 `xvfb-run -a`，否则 WebGL2 可能不可用，页面启动报 `RendererError`。
- 临时工作树里 `public/missiles` 和 `public/overlays` 不能是整目录符号链接，否则 `tests/baker/sidecar-compression.test.ts` 里的 `git check-ignore` 返回 128。要建真实目录，里面再逐个链接。
- 工作树要链接 `samples/d2`，否则依赖数据的测试会失败。
- 动画快照里的动作名是 GLB 里的名字（如 `nu:2h`），不是别名（`nu:staff`）。
- 主机内存紧张时浏览器截图会非常慢，脚本要支持跳过已截的图续跑；不要并行开多个浏览器。
- 全量 Vitest 耗时很长；若只跑了定向测试，报告里要写明全量没跑。

## 10. 提交与发布规范

1. 在独立工作树里改，不直接改主检出；提交身份按仓库约定。
2. 提交前扫描暂存差异，不得出现个人或公司标识、home 路径、服务器地址、账号密码。
3. 变基到最新 `origin/main`，快进合并后推送，再同步提供页面的检出并拷贝皮肤资产。
4. 删除工作树和分支，用 `curl` 检查页面上的 `skin.json` 和 GLB 能取到。
5. 需求不明确或改动较大时，先出计划（含候选图）并等明确批准再改代码。

## 11. 在线测试角色的做法

1. 用仓库的机器人注册账号并建 1 级角色（首次用某账号时带上的密码会被登记）：`npx tsx tools/d2-bot.ts create-char --via=wss --ws-host=<站点> --account=<账号> --password=<密码> --char=<角色名> --class=1`。
2. 用 `tools/test-characters.ts` 的 `buildTestCharacter(name, spec)` 生成 99 级存档。物品只能是普通、暗金、套装（魔法和稀有生成不了）。
3. 天梯资料片角色要把存档偏移 `0x24` 的状态字节改成 `0x60`，再重算偏移 12 处的校验和（逐字节：`sum = rol(sum, 1) + byte`，计算时校验和字段先清零）。
4. 由有权限的人替换服务器存档目录里的 `charsave/<小写角色名>`（先备份原文件，用临时文件名写入再改名）。
5. 用机器人 `join --create-game --world` 进一次房间验证；进房后服务器会自己把角色摘要更新成 99 级。

容量限制：背包 10×4、箱子 6×8。衣服是 2×3，一个角色最多放 11 件（背包 5、箱子 6）；头盔 2×2。属性给到力量 250、敏捷 200 才能穿全部精英装备。服务器凭据不写进任何文件。

## 12. 已知限制与未完成事项

- 七个职业各有一个 WoW 换装皮肤（人类女、暗夜精灵女、血精灵女、亡灵男、矮人男、兽人男、德莱尼女），启用插件后是默认外观。死灵法师的召唤物保持原版。
- 精英暗金武器外观只覆盖武器（62 把）；普通/扩展级暗金、套装、符文之语、盾牌、头盔、衣服没有专属外观。模型不带粒子特效。只有站立姿势的游戏内截图。
- 双持没有专门的双持动作（用单手动作）；刺客踢击用攻击动作代替。
- 种族特有的细节没有做：暗夜精灵的眼睛发光和面纹、血精灵耳环、矮人胡子（所选外观无胡子）。
- 跑步、行走、死亡动作只在转换器离线效果图里看过，没有游戏内截图；都没有在线上服务器实测。
- 头盔和衣服没有品质泛光（衣服是贴图，做不了同样的泛光）。
- 截图验证都是直接写客户端装备表，没有在游戏里真实拖拽穿戴；远程玩家的换装路径没有实测；攻击动作没有截图。
- 首次选中皮肤要解码 236 张贴图，加载耗时没有测量；嫌慢可改成按需加载当前穿着的套装。
- 角色选择界面的篝火仍显示原版法师。
- 线上站点需要单独部署皮肤资产（资产不入库）。
- 这些美术资源的版权属于其权利人，公开站点使用前需自行判断。
