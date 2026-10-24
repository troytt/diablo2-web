# Diablo II v1.13c Reverse-Engineering Knowledge Base (`kb/`)

> **Ground Truth Invariant**: All documents in this knowledge base are reverse-engineered strictly and exclusively from the original Diablo II: Lord of Destruction v1.13c binary assembly (`D2Client.dll`, `D2Game.dll`, `D2Common.dll`, `D2CMP.dll`, `D2Multi.dll`, `D2MCPClient.dll`, `D2Gfx.dll`, `D2Win.dll`, `D2Lang.dll`, `Storm.dll`, `Fog.dll`, etc.) and official Blizzard 1.13c MPQ data tables (`Skills.txt`, `Missiles.txt`, `MonStats.txt`, `SuperUniques.txt`, `Objects.txt`, `Inventory.txt`, `States.txt`, `PetType.txt`, etc.) in `samples/d2/` (`~/d2-data/`) as the sole ground truth.

---

## 目录结构 / Directory Structure

```
kb/
├── README.md                                  # 知识库索引与架构概览 (本文件)
├── audio/                                     # 音效表与声音记录层
│   ├── d2gs-0x2c-playsound-113c.md            # D2GS 0x2C 声音事件码分发 (0x6fb5d740 -> 0x6fad3f20 -> 0x6fad3200) 与 0xA4 守卫
│   └── sound-records-113c.md                  # Sounds.txt 载入后处理、PlaySound/SoundUpdate/StartSound/AllocChannel 与 D2sound 输出
├── combat/                                    # 战斗结算
│   └── d2game-effective-resist-113c.md        # 有效抗性 0x6FCFB3C0：-敌抗、难度 ResistPenalty、玩家/佣兵上限 (物理 50 / 75+max ≤95)
├── items/                                     # 物品系统与渲染规范
│   ├── d2client-ethereal-item-rendering.md    # 无形装备 50% 半透明渲染与 GFX_DrawItem 调用规约
│   ├── d2client-unidentified-tooltip-reqlevel.md # 未辨识装备 Tooltip 需求等级显示门控
│   ├── d2game-vendor-gamble-113c.md           # D2Game 商人商店生成、城镇无人刷新生命周期与赌博机制逆向规范
│   └── item-addskill-tab-encoding-113c.md     # stat 188 技能系参数编码 tab + 8*class (func 10 / descfunc 14)
├── monsters/                                  # 怪物系统与属性解析
│   ├── d2client-champion-monster-name-113c.md # 头目怪(Champion)标志位、词缀与血条命名优先级
│   └── d2client-npc-interaction-range-113c.md # NPC 点击交互距离(#10407)与对话框每帧守卫(仅存活判定)
├── objects/                                   # 场景物件与交互逻辑
│   ├── d2-npc-placeholder-objects-113c.md     # 城镇 NPC 静态占位 Object (InitFn 18/19) 与动态实体互斥隐藏
│   ├── d2client-object-interact-hittest-113c.md # 物件交互距离计算(#10594)与屏幕点击命中判定
│   └── d2game-roomtile-warp-113c.md           # 跨层楼梯/入口 (UNIT_TILE=5) 交互、寻路、12x12房间裁剪与同幕往返规范
├── render/                                    # 渲染与光照
│   ├── d2client-drawmode-113c.md              # 绘制模式汇总、客户端 missile 动画速率 (AnimSpeed<<4)、CltDoFunc 25 64 环、States castoverlay
│   └── d2client-unit-light-records-113c.md    # 单位光源记录 (玩家/怪物/弹道/叠加层) 与 stat 89/90 回调
├── ui/                                        # 用户界面、HUD 与大厅协议
│   ├── d2client-automap-waypoint-parity.md    # 小地图 39 个小站图元 (307 / 617..619) 地板层与对象层对齐规范
│   ├── d2client-charsheet-vitals-113c.md      # 角色属性面板 (C/A 键) 耐力/生命/法力双框布局与底栏血球上限聚合
│   ├── d2client-hireables-portrait-lifebar.md # 左上角随从/佣兵头像与血条尺寸及渲染规则
│   ├── d2client-level-entry-title-113c.md     # 切换区域 "Entering xxx" 居中标题 (0x6fb6f0d0)：EntryFile DC6、任务覆盖表、120 帧、textShifts[1]
│   ├── d2client-npc-menu-quest-gates-113c.md  # NPC 菜单任务门控表 (0x6fba2330)：泰瑞尔前往哈洛加斯 = q[28] bit0 + 资料片
│   ├── d2client-mercenary-screen-113c.md      # 佣兵装备/属性面板 (O 键界面) 坐标与排版
│   ├── d2client-vendor-stash-gold-display.md  # 交易/个人储藏箱金币框渲染布局与文本对齐
│   └── d2multi-join-game-panel-113c.md        # 多人大厅加入游戏面板控件表与 MCP 0x06 协议
└── skills/                                    # 技能与弹道逆向工程参考
    ├── d2-skills-missiles-dispatch-tables.md  # 全技能与弹道分发函数总表与通用动作 (Dispatch Tables)
    ├── client-state-ids-113c.md               # 客户端技能预测使用的真实 States.txt 行号 (blaze 13 / conviction 28 / stunned 21 / cold 11 等) 与持续帧
    ├── bosses/                                # Boss 与超级暗金怪技能
    │   ├── skills-boss-act1-act2-act3.md      # Act 1-3 Boss 技能 (安达利尔、督瑞尔、墨菲斯托等)
    │   ├── skills-boss-act4-diablo.md         # Act 4 Boss 技能 (暗黑破坏神、混沌避难所封印怪等)
    │   └── skills-boss-act5-baal-ubers.md     # Act 5 & 6Boss 技能 (巴尔、地狱火三魔神等)
    ├── missiles/                              # 弹道机制与客户端轨迹渲染
    │   └── d2client-meteor-cltdofunc-clthitfunc.md # 陨石下落轨迹计算、撞击闪光与地面火判定
    └── player/                                # 玩家七大职业技能树 (21 份文档，210 项技能)
        ├── skills-ama-bow-crossbow.md         # 亚马逊：弓与十字弓技能 (Bow & Crossbow)
        ├── skills-ama-javelin-spear.md        # 亚马逊：标枪与长矛技能 (Javelin & Spear)
        ├── skills-ama-passive-magic.md        # 亚马逊：被动与魔法技能 (Passive & Magic)
        ├── skills-ass-martial-arts.md         # 刺客：武术技能 (Martial Arts)
        ├── skills-ass-shadow-disciplines.md   # 刺客：暗影修行 (Shadow Disciplines)
        ├── skills-ass-traps.md                # 刺客：陷阱技能 (Traps)
        ├── skills-bar-combat.md               # 野蛮人：战斗技能 (Combat Skills)
        ├── skills-bar-masteries.md            # 野蛮人：战斗专家 (Combat Masteries)
        ├── skills-bar-warcries.md             # 野蛮人：战吼技能 (Warcries)
        ├── skills-dru-elemental.md            # 德鲁伊：元素技能 (Elemental Skills)
        ├── skills-dru-shapeshifting.md        # 德鲁伊：变形技能 (Shape Shifting)
        ├── skills-dru-summoning.md            # 德鲁伊：召唤技能 (Summoning)
        ├── skills-nec-curses.md               # 死灵法师：诅咒技能 (Curses)
        ├── skills-nec-poison-bone.md          # 死灵法师：毒素与白骨技能 (Poison & Bone)
        ├── skills-nec-summoning.md            # 死灵法师：召唤技能 (Summoning)
        ├── skills-pal-combat.md               # 圣骑士：作战技能 (Combat Skills)
        ├── skills-pal-defensive-auras.md      # 圣骑士：防御灵气 (Defensive Auras)
        ├── skills-pal-offensive-auras.md      # 圣骑士：攻击灵气 (Offensive Auras)
        ├── skills-sor-cold.md                 # 巫师：冰冻法术 (Cold Spells)
        ├── skills-sor-fire.md                 # 巫师：火焰法术 (Fire Spells)
        └── skills-sor-lightning.md            # 巫师：闪电法术 (Lightning Spells)
```

---

## 1. 物品系统与渲染规范 (`items/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`items/d2client-ethereal-item-rendering.md`](./items/d2client-ethereal-item-rendering.md) | `D2Client.dll` `0x6FB1B5A0` (`GFX_DrawItem`), `D2gfx.dll` `0x6FA8B080` | 无形装备 (`IFLAG_ETHEREAL = 0x00400000`) 的 2D UI 精灵以 `DRAWMODE_TRANS50 = 1` (50% 透明度) 渲染；嵌入无形装备中的凹槽宝石/符文维持 100% 不透明 (`DRAWMODE_NORMAL = 5`)。 |
| [`items/d2client-unidentified-tooltip-reqlevel.md`](./items/d2client-unidentified-tooltip-reqlevel.md) | `D2Client.dll` `0x6FB43D89`, `D2Common.dll` `0x6FD76190` | 未辨识物品在 Tooltip 中严格抑制 `Required Level` (需求等级) 行；只有在辨识后 (`IFLAG_IDENTIFIED = 0x10`) 才参与词缀需求等级计算。护身符未辨识时在物品栏中不生效。 |
| [`items/d2game-vendor-gamble-113c.md`](./items/d2game-vendor-gamble-113c.md) | `D2Game.dll` `0x6FCAF4E0..0x6FCB0320`, `0x6FCDCB20..0x6FCDF810` | 商人普通商店库存 (`pNpcRecord->pInventory`) 城镇共享、开关窗口不重掷、仅当城镇内最后一名玩家离开时清空刷新；赌博库存 (`pGambleList`) 按玩家隔离、每次打开重掷、连续 12 次放置失败终止、单次 `ilvl` 掷骰、Failed Unique (`rare×3`) / Failed Set (`magic×2`) 降级规范 (Issue #1357)。 |
| [`items/item-addskill-tab-encoding-113c.md`](./items/item-addskill-tab-encoding-113c.md) | `D2Common.dll` `0x6FD98470` (property func 10), `D2Client.dll` `0x6FB052E2` (descfunc 14) | `skilltab` par (线性 `class*3+tab`, 0..20) 写入 stat 188 时编码为 `tab + 8*class` (Save Param Bits 16)；显示时 `class = param>>3`、`tab = param&7`，`tab>=3` 不显示。法师火系 = 8 (曾被误当线性键 8 = 死灵召唤, #925)。 |

---

## 2. 怪物系统与属性解析 (`monsters/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`monsters/d2client-champion-monster-name-113c.md`](./monsters/d2client-champion-monster-name-113c.md) | `D2Game.dll` `0x6FC43D5E`, `D2Client.dll` `0x6FAD0620` | Champion 头目怪生成时设置 `0x04` 标志，并带有专属 `MonUMod.txt` 词缀 (36: Ghostly, 37: Fanatic, 38: Possessed, 39: Berserker)。客户端解析显示名与血条颜色时，`0x04` 优先级高于普通的 `0x08` (Unique)，血条固定为蓝色 (`color = 3`)。 |
| [`monsters/d2client-npc-interaction-range-113c.md`](./monsters/d2client-npc-interaction-range-113c.md) | `D2Common.dll` `#10407` (`0x6FDCFCD0`), `D2Client.dll` `0x6facafea`, `0x6fac9ef0`, `0x6faf83b0` | 点击怪物/NPC 时以单位尺寸修正距离 `#10407` 判定：MonStats `interact` 置位阈值 `2`，否则 `5`；走近后的待定交互要求 `#10407 <= 2` 且 `#10324(..., 0x804) == 0`。NPC 对话框打开后每帧守卫 `0x6faf83b0` 只检查玩家/NPC 存活 (玩家模式 `0x11`、NPC 模式 `0xC`)，**不做距离复检** (Issue #890)。 |

---

## 3. 场景物件与交互逻辑 (`objects/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`objects/d2-npc-placeholder-objects-113c.md`](./objects/d2-npc-placeholder-objects-113c.md) | `D2Game.dll` `0x6fc89140`, `D2Client.dll` `0x6fad5120`, `Objects.txt` (`InitFn 18/19`) | 城镇 NPC 静态占位 Object (`121/122` 杰海因、`378/379` 赫拉铁力、`461/462` 夸尔凯克、`542/543` 安雅，`Token=ss`, `Selectable=0`) 与 `0xAC AssignNPC` 动态 NPC 实体 (`hcIdx = 201, 253, 515, 512`) 双向互斥隐藏，消除双重实体幽灵克隆 (Issue #900)。 |
| [`objects/d2client-object-interact-hittest-113c.md`](./objects/d2client-object-interact-hittest-113c.md) | `D2Common.dll` `#10594` (`0x6fd81000`), `D2Client.dll` `0x6fb568e0` | 物件交互距离严格按 `Objects.txt` 中的 `SizeX`/`SizeY` 计算包围盒并剔除 4 个极端角点（如艾维斯之树 `Id=30` 的 5×5 占地允许站在边缘交互）；屏幕命中测试分支于 `CollisionSubst` 固定包围盒与 DCC/DC6 动画帧扩展边界。 |
| [`objects/d2game-roomtile-warp-113c.md`](./objects/d2game-roomtile-warp-113c.md) | `D2Client.dll` `0x6facaed0..0x6facafe7`, `D2Game.dll` `0x6fcee150`, `0x6fcf02bc..0x6fcf0322`, `0x6fd019c0` | `UNIT_TILE (5)` 远距点击发送 `MoveToUnit(5, id)` 走近至 `#10407 <= 4` 且无 `0x804` 阻挡后发 `0x13`；同幕跨层在 `UnitReassign` 时立即同步当前层、`RoomHide` 按真实 `12×12`/`16×16` 房间尺寸裁剪、同层重复 `lvlWarpId` 按坐标就近匹配 (Issue #1488)。 |

---

## 4. 用户界面、HUD 与大厅协议 (`ui/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`ui/d2client-automap-waypoint-parity.md`](./ui/d2client-automap-waypoint-parity.md) | `D2Client.dll` `0x6FB12580` (`AUTOMAP_RevealRoom`), `0x6FB11D00..0x6FB11E60` (`AUTOMAP_AddRoomUnits`) | 小地图小站图元与 `Objects.txt` / `AutoMap.txt` 严格对齐：`AutoMap == 0` 的第 1–4 幕及哈洛加斯小站仅由地板层 (`Tile="fl", Style=0, Seq=54 -> 307`)、保存式城镇底图 (`40, 103, 109`) 或术士峡谷地板 (`617..619`) 表达，绝不向 `pObjects` 重复注入偏移的 `307`；仅 `Id = 402` (限 Level 74) 与第 5 幕野外/洞穴/神殿小站 (`494, 496, 511, 539`) 向 `pObjects` 写入单一 `307` (Issue #867)。 |
| [`ui/d2client-charsheet-vitals-113c.md`](./ui/d2client-charsheet-vitals-113c.md) | `D2Client.dll` `0x6FB6CEA0` (`UI_DrawCharSheet`), `0x6FB8D6F0`, `0x6FAD7BD0`, `0x6FAD7A90`, `D2Common.dll` `#10913/#10186/#10578` | 角色属性面板耐力/生命/法力双框严格按 `0x6FB8D6F0` 表项 `[7]..[13]`：**左框 (`ox+250`) 绘制上限值**（有加成时蓝字）、**右框 (`ox+291`) 绘制当前值**（白字）；底栏生命/法力球与耐力条上限统一通过 `StatOpEngine` 聚合装备、护身符、被动与状态加成，避免将满血当前值按未穿戴裸装 `BaseStats` 截断 (Issue #903)。 |
| [`ui/d2client-hireables-portrait-lifebar.md`](./ui/d2client-hireables-portrait-lifebar.md) | `D2Client.dll` `0x6FB0AC70..0x6FB0C7F0` (`Hireables.cpp`) | 界面左上角随从与佣兵头像框绘制规范：46×41 像素头像、46×5 像素血条、三色生命百分比阈值 (绿 $\ge 50\%$, 黄 $25\%\sim 49\%$, 红 $< 25\%$) 与 56px 水平排布步进。 |
| [`ui/d2client-mercenary-screen-113c.md`](./ui/d2client-mercenary-screen-113c.md) | `D2Client.dll` `0x6fb4ae80` (`UI_DrawMercScreen`) | 佣兵装备属性面板 (按 `O` 键打开) 的 800×600 与 640×480 布局、头部/衣服/左右手装备格坐标、12 项属性文本排版与抗性金字/红字门控。 |
| [`ui/d2client-vendor-stash-gold-display.md`](./ui/d2client-vendor-stash-gold-display.md) | `D2Client.dll` `0x6FB3CFB0` (`HUD_DrawPanelGoldBox`) | 储藏箱 (`nMode=0`)、物品栏 (`nMode=1`) 与商人商店 (`nMode=2`) 底部凹槽金币框绘制规范，涵盖 `STAT_GOLDBANK` 与 `STAT_GOLD` 读取、右对齐排版及商店模式下跳过金币按钮渲染。 |
| [`ui/d2client-player-corpse-pickup-113c.md`](./ui/d2client-player-corpse-pickup-113c.md) | `D2Game.dll` `D2GAME_CORPSE_Handler_6FC7FBD0`, `sub_6FC828D0`, `sub_6FC80440`; `D2Client.dll` `0x6fb01e80`, `0x6fb55440`, `0x6facb7f0`, `0x6facab20`, `0x6fac94e0` | 玩家尸体为新 GUID 的 `UNIT_PLAYER`（`0x59` → `0x0D` code 9 → `0x74`）；悬停仅跳过本地玩家、死亡玩家优先级 +1；不可攻击的非怪物单位点击进入交互处理 `C2S 0x13`（与左键技能无关），服务端 8 格内拾取、50 格内自动走近 (Issue #922)。 |
| [`ui/d2multi-join-game-panel-113c.md`](./ui/d2multi-join-game-panel-113c.md) | `D2Multi.dll` `0x6F9E3280`, `D2MCPClient.dll` `0x6FA26280` | 多人游戏大厅加入面板 (`joingamebckg.dc6` 373×373 拼接)、控件描述符表 (`0x6F9EA510`)、`MCP_GAMEINFO (0x06)` 二进制通信报文解析与右侧详情列表格式化规范。 |

---

## 5. 技能与弹道系统 (`skills/`)

### 5.1 分发总表与核心机制
- [`skills/d2-skills-missiles-dispatch-tables.md`](./skills/d2-skills-missiles-dispatch-tables.md): 全职业与怪物技能分发函数表 (`gpSkillSrvStartFnTable`, `gpSkillSrvDoFnTable`, `g_apfnSkillCltStFunc`, `g_apfnSkillCltDoFunc`, `g_apfnMissileCltDoFunc`, `g_apfnMissileCltHitFunc`) 及普通攻击、踢击、投掷、解除召唤、辨识/传送门书卷等通用玩家动作。

### 5.2 弹道与特效机制 (`skills/missiles/`)
- [`skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md`](./skills/missiles/d2client-meteor-cltdofunc-clthitfunc.md): 巫师陨石技能的客户端 3D 轨迹计算 (`CltDoFunc=9`, $vx=15, vz=-25$)、等轴测投影、撞击闪光、屏幕震颤与 18 块地面火分散生成机制。

### 5.3 怪物与 Boss 技能 (`skills/bosses/`)
- [`skills/bosses/skills-boss-act1-act2-act3.md`](./skills/bosses/skills-boss-act1-act2-act3.md): 第一幕至第三幕关卡 Boss 与超级暗金怪技能 (安达利尔、血乌、女伯爵、格瑞斯华尔德、母牛之王、拉达蒙特、钻地虫、召唤者、督瑞尔、议会成员、墨菲斯托)。
- [`skills/bosses/skills-boss-act4-diablo.md`](./skills/bosses/skills-boss-act4-diablo.md): 第四幕 Boss 与混沌避难所封印怪 (衣卒尔、海法斯特、暗黑破坏神、暗黑克隆体)。
- [`skills/bosses/skills-boss-act5-baal-ubers.md`](./skills/bosses/skills-boss-act5-baal-ubers.md): 第五幕关卡 Boss 与地狱火事件三魔神 (山克、尼拉塞克、古代人、巴尔、超级墨菲斯托、超级暗黑破坏神、超级巴尔、莉莉丝、超级督瑞尔、超级衣卒尔)。

### 5.4 玩家职业技能树 (`skills/player/`, 21 份文档 / 210 项技能)
- **亚马逊 (Amazon)**:
  - [`skills/player/skills-ama-bow-crossbow.md`](./skills/player/skills-ama-bow-crossbow.md) — 弓与十字弓技能 (Magic Arrow, Multiple Shot, Guided Arrow, Strafe 等)
  - [`skills/player/skills-ama-passive-magic.md`](./skills/player/skills-ama-passive-magic.md) — 被动与魔法技能 (Inner Sight, Dodge, Avoid, Evade, Valkyrie, Pierce 等)
  - [`skills/player/skills-ama-javelin-spear.md`](./skills/player/skills-ama-javelin-spear.md) — 标枪与长矛技能 (Jab, Power Strike, Charged Strike, Lightning Fury 等)
- **刺客 (Assassin)**:
  - [`skills/player/skills-ass-martial-arts.md`](./skills/player/skills-ass-martial-arts.md) — 武术技能 (Tiger Strike, Dragon Talon, Phoenix Strike 等)
  - [`skills/player/skills-ass-shadow-disciplines.md`](./skills/player/skills-ass-shadow-disciplines.md) — 暗影修行 (Burst of Speed, Fade, Weapon Block, Shadow Master 等)
  - [`skills/player/skills-ass-traps.md`](./skills/player/skills-ass-traps.md) — 陷阱技能 (Fire Blast, Lightning Sentry, Death Sentry 等)
- **野蛮人 (Barbarian)**:
  - [`skills/player/skills-bar-combat.md`](./skills/player/skills-bar-combat.md) — 战斗技能 (Bash, Leap Attack, Concentrate, Frenzy, Whirlwind 等)
  - [`skills/player/skills-bar-masteries.md`](./skills/player/skills-bar-masteries.md) — 战斗专家 (Sword Mastery, Iron Skin, Natural Resistance 等被动机制)
  - [`skills/player/skills-bar-warcries.md`](./skills/player/skills-bar-warcries.md) — 战吼技能 (Howl, Shout, Battle Orders, Battle Command, War Cry 等)
- **德鲁伊 (Druid)**:
  - [`skills/player/skills-dru-elemental.md`](./skills/player/skills-dru-elemental.md) — 元素技能 (Firestorm, Fissure, Tornado, Hurricane, Armageddon 等)
  - [`skills/player/skills-dru-shapeshifting.md`](./skills/player/skills-dru-shapeshifting.md) — 变形技能 (Werewolf, Werebear, Feral Rage, Fury 等)
  - [`skills/player/skills-dru-summoning.md`](./skills/player/skills-dru-summoning.md) — 召唤技能 (Raven, Oak Sage, Spirit Wolf, Summon Grizzly 等)
- **死灵法师 (Necromancer)**:
  - [`skills/player/skills-nec-curses.md`](./skills/player/skills-nec-curses.md) — 诅咒技能 (Amplify Damage, Iron Maiden, Decrepify, Lower Resist 等)
  - [`skills/player/skills-nec-poison-bone.md`](./skills/player/skills-nec-poison-bone.md) — 毒素与白骨技能 (Teeth, Corpse Explosion, Bone Spear, Bone Spirit, Poison Nova 等)
  - [`skills/player/skills-nec-summoning.md`](./skills/player/skills-nec-summoning.md) — 召唤技能 (Raise Skeleton, Clay Golem, Iron Golem, Revive 等)
- **圣骑士 (Paladin)**:
  - [`skills/player/skills-pal-combat.md`](./skills/player/skills-pal-combat.md) — 作战技能 (Smite, Charge, Blessed Hammer, Holy Shield, Zeal 等)
  - [`skills/player/skills-pal-defensive-auras.md`](./skills/player/skills-pal-defensive-auras.md) — 防御灵气 (Prayer, Cleansing, Defiance, Vigor, Salvation 等)
  - [`skills/player/skills-pal-offensive-auras.md`](./skills/player/skills-pal-offensive-auras.md) — 攻击灵气 (Might, Holy Fire, Thorns, Blessed Aim, Fanaticism, Conviction 等)
- **巫师 (Sorceress)**:
  - [`skills/player/skills-sor-cold.md`](./skills/player/skills-sor-cold.md) — 冰冻法术 (Ice Bolt, Frost Nova, Blizzard, Frozen Orb, Cold Mastery 等)
  - [`skills/player/skills-sor-fire.md`](./skills/player/skills-sor-fire.md) — 火焰法术 (Fire Bolt, Warmth, Fire Ball, Meteor, Hydra, Fire Mastery 等)
  - [`skills/player/skills-sor-lightning.md`](./skills/player/skills-sor-lightning.md) — 闪电法术 (Charged Bolt, Static Field, Teleport, Nova, Chain Lightning, Lightning Mastery 等)

---

## 6. 渲染与光照 (`render/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`render/d2client-unit-light-records-113c.md`](./render/d2client-unit-light-records-113c.md) | `D2Client.dll` `0x6fac92f5`, `0x6fac8bc0`, `0x6fac89a0`, `0x6fad0510`, `0x6fb63647`, `0x6fb1b360`, `0x6fb1b49f`, `0x6fb23410` | 单位光源记录与状态叠加层：玩家半径 13 + stat 89 (≤0 不变)、stat 90 颜色；怪物 MonStats2 光源与 MonUMod 3 (半径 7，Champion 随机 B/G/R)；弹道光仅在 Light Quality 高时创建、Flicker 与结束淡出；叠加层 `States.txt`/`states.bin` (`wOverlay[0..3]` + `pgsvoverlay` 3 行展开) 映射至 `overlay.bin` 绘制参数与 `InitRadius → Radius` 光源 (Issue #830, #878)。光照网格管线见 [`docs/lighting_grid_113c.md`](../docs/lighting_grid_113c.md) |
| [`render/d2gfx-draw-mode-113c.md`](./render/d2gfx-draw-mode-113c.md) | `D2Client.dll` `0x6FB1B11D`, `0x6FB1B2B2`, `0x6FB1CF32`; `D2gfx.dll` `#10041` (`0x6FA8B080`); `D2Direct3D.dll` `0x6F886B90` | Overlay.txt `Trans` 原值即 eDrawMode (恒等)，Missiles.txt `Trans` 0/1/2 → 5/3/4；各 eDrawMode 的 D3D 混合状态 (0-2 α25/50/75、3 加法 ONE/ONE、4 乘法 ZERO/SRCCOLOR、5/6/7/≥8 不透明)；烘焙不做黑色抠像 (Issue #1050-#1055) |
| [`render/d2client-drawmode-113c.md`](./render/d2client-drawmode-113c.md) | `D2Client.dll` `0x6FB633F7`, `0x6FB23CB0`, `0x6FB50DB0`, `0x6FB22C80`, `0x6FB23760`; `D2Direct3D.dll` `0x6F886CF4`; `D2Gdi.dll` `0x6F87633C` | eDrawMode 汇总 (Overlay Trans 恒等、Missile Trans 0/1/2→5/3/4、3=加法 ONE/ONE、4=乘法 ZERO/SRCCOLOR)；客户端 missile 视觉帧速 = `AnimSpeed<<4` 覆盖 (`animrate` 仅服务端)；CltDoFunc 25 客户端自生成 64 发半径 30 的环 (Range+LevRange*lvl)；States.txt castoverlay 在 state 设置时以 LOOPEX(4)/AURAEX(9) 播放后交接 overlay1/2 (Issue #1057) |
| [`render/dt1-material-flags-animated-113c.md`](./render/dt1-material-flags-animated-113c.md) | `D2Common.dll` `0x6fd62f20`, `0x6fd62ff0`; `D2CMP.dll` `#10051` (`0x6fe25300`) | DT1 `+0x06` 为 u16 材质标志 (byte +7 是其高字节，非独立 animated 字节)；仅 `TILE_FLAGS_LAVA` (`0x100`) 动画，Act 5 雪地 `0x400` 为普通随机变体地块 (Issue #923) |

---

## 7. 音效表与声音记录层 (`audio/`)

| 文档 | 核心逆向地址 / 模块 | 关键机制与规范 |
|---|---|---|
| [`audio/d2gs-0x2c-playsound-113c.md`](./audio/d2gs-0x2c-playsound-113c.md) | `D2Client.dll` `0x6fb5d740` (`0x2C`), `0x6fb5d760` (`0xA4`), `0x6fad3f20` (外层 `10..93`), `0x6fad3200` (玩家 `1..83`), `.rdata:0x6fba7694` | `S2C 0x2C PlaySound` 的 `u16` 字段为声音事件码而非 `Sounds.txt` 行号（如 `10 -> 2673 shrine_refill` vol 120，`13 -> 2634 object_trap_trigger`，`14 -> 2635 object_trap_release`，`93 -> 2553 object_corpse_loot`，以及 7 职业 22 槽位语音表）；`S2C 0xA4 MonsterSpecialSkill` 不播放任何声音 (Issue #944) |
| [`audio/sound-records-113c.md`](./audio/sound-records-113c.md) | `D2Client.dll` `0x6fb0e8e1` (表载入后处理), `0x6fb38a70` (PlaySound), `0x6fb38dd0` (SoundUpdate), `0x6fb0d7a0` (StartSound), `0x6fb0ce70` (AllocChannel), `0x6fb0d1d0` (UpdateChannel), `0x6fb0ee70` (变体选取); `D2Common.dll` `#10628`; `D2sound.dll` `#10047/#10008/#10028` | `Sounds.txt` 4699 行 groupBase/Group Size/nBlocks 后处理；200 条声音记录池、Compound 复用、本地玩家 +80 字节加法、屏幕坐标 `(Δcx, 2·Δcy, 640)`；同 id 2 tick 去抖比较计划开始时刻；16 通道 = 4 立体声 + 12 单声道分区抢占；淡入启动失败的循环记录 vol 0 永不重启等二进制怪癖 (Issue #943) |
