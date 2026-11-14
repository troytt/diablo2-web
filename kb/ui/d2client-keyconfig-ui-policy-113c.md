# D2Client.dll 1.13c 键位命令表、default.key、UI 开关策略矩阵

> 来源：`~/d2-data/D2Client.dll`（ImageBase `0x6FAB0000`）与 `~/d2-data/default.key` 反汇编/解析。

## 1. 命令处理表 `0x6FBA4F10`

`struct { void (*fnDown)(); void (*fnUp)(); DWORD dwAllowInModal; }[57]`，按 cmdId（0..0x38）索引。

- keydown 派发 `0x6FAE8BB0`：`test [msg.lParam], 0x40000000` → 自动重复直接忽略（`0x6fae8bb5`）；
  遍历绑定表 `0x6FBCA2E0`（10 字节 × 114）匹配 `vk`；`cmdId >= 0x39` 跳过；`vk == F4 && Alt` 跳过（Alt+F4）；
  `0x6FBCC434 == 2`（模态输入）时仅 `dwAllowInModal == 1` 的命令执行。
- keyup 派发 `0x6FAE8AD0`：同样的模态检查，无 repeat 检查，调用 `fnUp`。
- `dwAllowInModal = 1`：5 聊天、22 显示腰带、27..33 Say、41 清除消息、42 截图、44 切换武器、45 切换小地图、55 Say。
- 输入模式 `0x6FBCC434 = 2`：UI 打开回调 `0x6FB71C40` 中 NPC 商店 0x0C（`0x6fb71e06`）、储物箱 0x19（`0x6fb71fb8`）、
  方块 0x1A（`0x6fb72037`）；NPC 交互 `0x6FAFAD26` / `0x6FAFB07D`。

| cmd | default.key | 处理函数 | 说明 |
|---|---|---|---|
| 0 | A / C | `0x6FAEC5B0` | 角色（UI 2） |
| 1 | I / B | `0x6FAEC2A0` | 背包（UI 1） |
| 2 | P | `0x6FAEBFC0` | 组队（UI 0x16） |
| 3 | M | `0x6FAEBEB0` | 消息日志（UI 0x18） |
| 4 | Q | `0x6FAEC8C0` → `0x6FACE940(1)` | 任务日志（UI 0x0F），死亡时忽略 |
| 5 | Enter | `0x6FAEBC10` | 聊天 |
| 6 | H | `0x6FAEBA70` | 帮助（UI 0x21） |
| 7 | Tab / 0x100 | `0x6FAEB8B0` | 自动地图（UI 0x0A），按策略矩阵列 0x0A 判定 |
| 8 | F9 | `0x6FAEA690` → `0x6FB108D0(1)` | 自动地图居中 |
| 9 | F10 | `0x6FAE9E20` → `0x6FB0F970` | 自动地图淡出（注册表 "AutoMapFade"） |
| 10 | F11 | `0x6FAE9DF0` | "AutoMap Party"（`0x6FBA16B8`） |
| 11 | F12 | `0x6FAE9DC0` | "AutoMap Party Names"（`0x6FBA16BC`） |
| 12 | T | `0x6FAEB5B0` | 技能树（UI 4） |
| 13 | S | `0x6FAEB470` | 技能速选栏（UI 3） |
| 14..21 | F1..F8 | `0x6FAEADB0`.. | 技能槽 0..7；速选栏打开时 `0x6FAED180` 绑定，否则 `0x6FAED5B0` 选择；死亡时忽略 |
| 22 | \` | `0x6FAEB300` | 腰带弹窗（UI 0x1F） |
| 23..26 | 1..4 | `0x6FAEC9A0`.. | 使用腰带；`GetKeyState(VK_SHIFT)` → 给佣兵；死亡时忽略 |
| 27..33 | Num0..Num6 | `0x6FAE9D60`..`0x6FAE9CA0` | C2S 0x3F 短语 0x19..0x1F（直接 `0x6FAC43E0` 发送） |
| 34 | （无） | `0x6FAEAE40` / `0x6FAEADF0` | 按住跑步：按下置 `0x6FBCC3E8`，行走中发 0x53；松开且非常跑、跑步中发 0x54 |
| 35 | R / 0x102 | `0x6FAE9C60` | 切换跑/走（仅本地 `0x6FBCC3EC`） |
| 36 | Shift | `0x6FAE9C50` / `0x6FAE9C20` | 原地站立 |
| 37 | Alt / 0x101 | `0x6FAEB230` / `0x6FAEAEA0` | 显示物品（UI 0x0D） |
| 38 | Space | `0x6FAEA900` → `0x6FAF3870` | 清屏（关面板，必要时重置自动地图偏移） |
| 39 / 40 | 0x103 / 0x104 | `0x6FAEA8E0` / `0x6FAEA8C0` | 上/下一个技能（`0x6FAED6D0(±1)`） |
| 41 | N | `0x6FAE9C30` | 清除消息（屏幕消息计时清零） |
| 42 | PrintScreen | keyup `0x6FABD420` | 截图 |
| 43 | Z | `0x6FB0C3D0` | 头像 |
| 44 | W | `0x6FAEA9C0` | 切换武器 |
| 45 | V | `0x6FAE9D80` | "AutoMap Left"（`0x6FBCC240`） |
| 46..53 | （无） | `0x6FAEABB0`..`0x6FAEA9F0` | 技能槽 8..15；槽 9..15 需 `0x6FBC9854` |
| 54 | O | `0x6FAEAEE0` | 佣兵（UI 0x24） |
| 55 | Num7 | `0x6FAE9C80` | C2S 0x3F 短语 0x20 |
| 56 | Esc | `0x6FAEC880` | 游戏菜单 |

`0x100..0x102` 鼠标伪键尚未确认是哪几个按键；`0x103/0x104` 是滚轮。

## 2. default.key / `<角色>.key`

- `0x6FAE9910`（`CmdTbl.cpp`）读 `default.key` 前 `0x47A` 字节：`'WS'`、`WORD 0x25`、`WORD 0x47A`，然后是 114 条
  `{ DWORD cmd; WORD vk; DWORD slot; }`。安装目录里的文件还带有 cmd ≥ 0x39 的额外记录，1.13c 不读取。
- `0x6FAEA730` 读角色键位文件 `%s%s.key`（`0x476` 字节：`WORD 0x25` + 114 条），并校验没有重复键。
- `0x6FAE9A60` 写回 `default.key` 格式。

## 3. UI 开关 `SetUIState 0x6FB72790` 与策略矩阵 `0x6FB8D538`

- `0x6FBAAD80[38]` 存放各 UI 的打开标志。state 0 = 打开，1 = 关闭，2 = 切换。打开/切换时玩家已死亡
  （`IsUnitDead 0x6FB55440`）→ 不改变（例外：切换 UI 5 聊天）。死亡时打开游戏菜单 9 → 发 C2S 0x41。
- 打开前 `0x6FB71A80` 遍历已打开的 UI i：`desc[i][new]`（跳转表 `0x6FB71C20`）0 = 共存，1 = 关闭 i，2/3 = 拒绝打开，4 = 取消 NPC 交互。
- 聊天（5）/游戏菜单（9）在 `GetTickCount() < 0x6FBAAD50` 时拒绝打开；面板切换/关闭函数经 `0x6FB6E2E0` 把它设为 `now + 100`。
- `0x6FBC3A68 != 0` 时只允许 UI 0x0A / 0x13 / 0x11 / 6 / 7 打开。
- 已核实的 UI id（读写 `0x6FBAAD80 + 4*id`）：背包 1、角色 2、速选栏 3、技能树 4、聊天 5、NPC 菜单 8、游戏菜单 9、
  自动地图 0x0A、NPC 商店 0x0C、显示物品 0x0D、铁砧/打孔窗口 0x0E、任务日志 0x0F、小站 0x14、组队 0x16、交易 0x17、
  消息日志 0x18、储物箱 0x19、方块 0x1A、腰带 0x1F、帮助 0x21、佣兵 0x24。
- 矩阵原始行数据在 `src/client/ui/ui-policy-113c.ts` 中（每行 38 位数字）。

## 4. 自动地图淡出（F10）

- 循环 `0x6FAE9E20`：`fade = (fade + 1) & 3`；AutoMapMode == 1（小地图，`0x6FBCC1B0`）时没有状态 1（替换为 `prev ? 0 : 2`）。
- 渲染 `0x6FB1032E..0x6FB10454`（默认 drawmode 5）：fade 0 不透明；fade 1 仅全屏，在玩家周围按八方向距离
  `d < 50 / 100 / 150` 依次取 TRANS25 / 50 / 75；fade 2 全部 TRANS50；fade 3 仅 Act I / Act III（`[player+0x18]` 为 0 / 2）生效，
  小地图 TRANS50，全屏 TRANS75。

## 5. 聊天命令 `0x6FB207F0`

`/fps`、`/framerate`、`/players`（`strncmp` 8 字节 + `atoi` + 钳制到 1..8，改写成 "players set to %d" 后作为普通 0x15 发出；
仅当游戏类型 `0x6FBCC394` ∈ {0,1,6,8} 时）、`/nopickup`（切换 `0x6FBCC2F0`：悬停选择 `0x6FB01E80` 跳过地面物品）、`soundchaosdebug`、
`/msg` `/m` `/whisper` `/w`（`0x6FB20500`；用法错误提示 "&lt;BattleNet&gt;: Correct usage is: %s (name) (message)"）、
`/help` `/?`（`0x6FB20700`；带参数时提示 "&lt;BattleNet&gt;: Correct usage is: %s"）。
