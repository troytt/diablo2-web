# D2Game 1.13c 商人商店生成、刷新生命周期与赌博机制逆向规范 (`D2Game.dll`)

> **Ground Truth**: `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`), `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`), 以及官方 1.13c MPQ 数据表 (`Armor.txt`, `Weapons.txt`, `Misc.txt`, `ItemTypes.txt`, `ItemRatio.txt`, `Gamble.txt`, `UniqueItems.txt`, `SetItems.txt`)。
> **关联 Issue**: #1326, #1354, #1355, #1356, #1357

---

## 1. 核心函数地址总表 (`D2Game.dll` v1.13c)

| 1.13c 地址 | 符号 / 功能命名 | 1.10f 常见参考名 | 核心职责 |
|---|---|---|---|
| `0x6FCAF4E0` | `NPC_InitVendorTemplate` | `NPC_InitVendor` | 从全局商人表 (`0x6FD30208` / `0x6FD30210`) 初始化 `D2NpcVendorStrc`，构建可售随机商品缓存 (`pItemCache`) 与常驻商品缓存 (`pPermCache`) |
| `0x6FCAF620` | `NPC_DestroyPlayerGambleInventory` | `NPC_FreeGamble` | 遍历 `pNpcRecord->pGambleList` (`+0x08`)，销毁指定 `dwPlayerGUID` 的赌博物品栏节点并释放其中所有预览物品 |
| `0x6FCAFBC0` | `NPC_InitGameNpcControl` | `NPC_AllocControl` | 为当前游戏分配 `[pGame+0x1D24]` (`D2NpcControlStrc`) 及 68 字节 (`0x44`) 步长的 `D2NpcRecordStrc` 数组 |
| `0x6FCB02E0` | `NPC_DestroyStoreInventory` | `NPC_FreeStore` | 清空 `pNpcRecord->pInventory` 中的所有商店物品，并将 `pNpcRecord->vendor.bItemsGenerated` (`+0x20`) 复位为 `0` |
| `0x6FCB0320` | `NPC_CheckTownEmptyAndRefresh` | `NPC_RefreshStores` | 检查对应幕城镇区域是否仍有玩家 (`0x6FC68390`)；仅当城镇区域内玩家数为 `0` 时调用 `0x6FCB02E0` 清空商店库存 |
| `0x6FCDCB20` | `NPC_GetVendorItemLevel` | `NPC_GetStoreIlvl` | 计算商店生成物品等级：`ilvl = max(1, cLvl + 5)`；普通难度 (`nDifficulty == 0`) 按幕数 `0..4` 截断上限 `[12, 20, 28, 36, 45]` |
| `0x6FCDCE00` | `NPC_RollNormalItemQuality` | `NPC_RollNormalQual` | 商店非魔法普通槽位 (`<Npc>Min..Max`) 品质判定 (`rand(100)`)：劣质 (`1`) / 普通 (`2`) / 超强 (`3`) |
| `0x6FCDD040` | `NPC_RollGambleUpgrade` | `NPC_RollGambleExcepElite` | 赌博底材升级判定：按 `ItemRatio.txt` 的 `GambleUber` / `GambleUltra` 与 `(ilvl - excepQlvl)` / `(ilvl - eliteQlvl)` 掷骰升级扩展/精华底材 |
| `0x6FCDE2A0` | `NPC_FillGamble` | `D2GAME_NPC_FillGamble_6FCC73E0` | 生成玩家专属赌博 10×10 网格：从 `Gamble.txt` (`level <= cLvl + 4`) 随机抽取底材，连续 12 次放置失败时停止 |
| `0x6FCDE640` | `NPC_BuyItem` | `D2GAME_NPC_BuyItem` | 处理 `C2S 0x32` 购买/赌博：赌博分支复用预览物品 `ilvl`，按 `100000` 分母掷骰暗金/套装/稀有/魔法并发放给玩家 |
| `0x6FCDEE30` | `NPC_GenerateStoreItem` | `D2GAME_NPC_GenerateStoreItem_6FCC6A60` | 生成单件商店商品：难度 > 0 且 `cLvl > 25` 时掷骰底材升级 (`NightmareUpgrade`/`HellUpgrade`/`ubercode`/`ultracode`)，调用 `D2GAME_CreateItemEx` (`0x6FC4EC10`) 并放入对应商店页 |
| `0x6FCDF1C0` | `NPC_EnsurePlayerGambleInventory` | `NPC_CreateGamble` | 为 `dwPlayerGUID` 在 `pNpcRecord->pGambleList` 中创建 `0x0C` 字节赌博节点并调用 `0x6FCDE2A0` (`NPC_FillGamble`) |
| `0x6FCDF2E0` | `NPC_GenerateStoreItems` | `D2GAME_NPC_FillStoreInventory_6FCC7100` | 生成商人全部普通商品 (`ilvl < 25` 时) 与魔法商品，填充 `pNpcRecord->pInventory` |
| `0x6FCDF730` | `NPC_InitStoreOrGamble` | `NPC_OpenTradeOrGamble` | 打开交易 (`bGamble = 0`) 或赌博 (`bGamble = 1`) 窗口时初始化或复用库存并向客户端同步 (`0x6FCDCD90`) |
| `0x6FCDF810` | `NPC_OpenStore` | `NPC_EntityActionOpenStore` | 校验 NPC 交易状态并在 `pNpcRecord->pPlayerTradeList` 中登记当前交互玩家，随后调用 `0x6FCDF730` |
| `0x6FCE00C0` | `PACKET_0x38_NpcAction` | `D2GAME_PACKET_0x38` | 处理 `C2S 0x38` (`NpcAction`)：Action `1` = 普通交易 (`bGamble = 0`)，Action `2` = 赌博 (`bGamble = 1`) |

---

## 2. `D2NpcRecordStrc` 与商店/赌博库存生命周期

### 2.1 `D2NpcRecordStrc` 结构布局 (`0x44` = 68 Bytes, `0x6FCAFBC0` / `0x6FCAF4E0`)

```c
struct D2NpcGambleStrc {          // sizeof = 0x0C (allocated at 0x6FCDF1FA)
    D2InventoryStrc* pInventory;  // +0x00: 玩家专属赌博 10x10 物品栏
    uint32_t         dwPlayerGUID;// +0x04: 玩家 unitId
    D2NpcGambleStrc* pNext;       // +0x08: 下一玩家节点
};

struct D2NpcVendorStrc {          // embedded at D2NpcRecordStrc + 0x20
    uint8_t  bItemsGenerated;     // +0x20 (vendor+0x00): 普通商店是否已生成 (0 = 未生成, 1 = 已生成)
    uint8_t  bMercInit;           // +0x21 (vendor+0x01)
    uint8_t  nAct;                // +0x22 (vendor+0x02): 所属幕数 (0..4)
    uint8_t  bIsVendor;           // +0x23 (vendor+0x03): 是否为商人
    uint8_t  pad24[3];            // +0x24..0x26
    uint8_t  bRefreshFlag;        // +0x27 (vendor+0x07): 强制刷新标志
    uint32_t dwLastRefreshTick;   // +0x28 (vendor+0x08)
    void*    pItemCache;          // +0x2C (vendor+0x0C): 可生成普通/魔法商品表项缓存
    int32_t  nItemCacheCount;     // +0x30 (vendor+0x10)
    int32_t* pPermCache;          // +0x34 (vendor+0x14): PermStoreItem 常驻商品 hcIdx 数组
    int32_t  nPermCacheCount;     // +0x38 (vendor+0x18)
    uint32_t dwReserved3C;        // +0x3C (vendor+0x1C)
};

struct D2NpcRecordStrc {          // sizeof = 0x44 (68 bytes)
    int32_t          nNpcClassId; // +0x00: MonStats hcIdx
    D2InventoryStrc* pInventory;  // +0x04: 城镇 NPC 共享的普通商店物品栏
    D2NpcGambleStrc* pGambleList; // +0x08: 按玩家 dwPlayerGUID 隔离的赌博物品栏链表
    uint8_t          bGambleInit; // +0x0C
    uint8_t          pad0D[3];
    void*            pMercData;   // +0x10
    void*            pEventList;  // +0x14
    void*            pTradePlayers;// +0x18: 当前打开该商店的玩家列表
    int32_t          bTrading;    // +0x1C
    D2NpcVendorStrc  vendor;      // +0x20..0x3F
    uint32_t         dwNpcGUID;   // +0x40
};
```

### 2.2 普通商店库存与赌博库存的刷新时机 (`0x6FCDF730`, `0x6FCB0320`, `0x6FCAF620`)

1. **普通交易窗口 (`bGamble == 0`) — 城镇共享、开关窗口不刷店、城镇全空才刷新**：
   - 在 `0x6FCDF730` (`NPC_InitStoreOrGamble`) 中：
     ```asm
     6fcdf755: lea  ebx, [esi+0x20]         ; ebx = &pNpcRecord->vendor
     6fcdf758: mov  al, [ebx]               ; al = vendor.bItemsGenerated
     6fcdf75a: test al, al
     6fcdf75c: jne  0x6fcdf76f              ; 已生成则跳过生成，直接复用 pNpcRecord->pInventory!
     6fcdf75e: mov  eax, [esp+0x14]         ; pPlayer
     6fcdf762: push eax
     6fcdf763: mov  eax, edi                ; pGame
     6fcdf765: call 0x6fcdf2e0              ; NPC_GenerateStoreItems
     6fcdf76a: mov  byte ptr [ebx], 0x1     ; vendor.bItemsGenerated = 1
     ```
   - 只要城镇区域内仍有至少一名玩家停留，`vendor.bItemsGenerated` 保持为 `1`，任何玩家反复打开/关闭交易窗口、或在交易与赌博窗口之间来回切换，均直接读取同一个 `pNpcRecord->pInventory`，绝不重新生成。
   - 在 `0x6FCB0320` (`NPC_CheckTownEmptyAndRefresh`) 中，每帧检查对应幕城镇区域内是否仍有玩家 (`call 0x6FC68390`)；**仅当该城镇区域内玩家人数降为 `0`（最后一名玩家离开该城镇区域）时**，才调用 `0x6FCB02E0` (`NPC_DestroyStoreInventory`) 清空 `pNpcRecord->pInventory` 并将 `vendor.bItemsGenerated` 置回 `0`。

2. **赌博窗口 (`bGamble == 1`) — 按玩家独立、每次打开赌博窗口重新生成**：
   - 在 `0x6FCDF730` (`0x6FCDF78C`) 中，当 `bGamble != 0` 时调用 `0x6FCDF1C0` (`NPC_EnsurePlayerGambleInventory`) -> `0x6FCDE2A0` (`NPC_FillGamble`)。
   - 当玩家关闭 NPC 窗口 (`C2S 0x30` -> `0x6FCDCB90` -> `0x6FC68300` -> `0x6FCAF620` `NPC_DestroyPlayerGambleInventory`) 时，服务端从 `pNpcRecord->pGambleList` 中移除并销毁该玩家的赌博物品栏节点；因此玩家每次打开赌博窗口都会生成全新的一页赌博预览物品。

---

## 3. 普通商店商品生成规则 (`0x6FCDCB20`, `0x6FCDF2E0`, `0x6FCDCE00`, `0x6FCDEE30`)

### 3.1 商店物品等级 `ilvl` 与普通难度幕数上限 (`0x6FCDCB20`)

```asm
6fcdcb26: push 0x0
6fcdcb28: push 0xc                          ; STAT_LEVEL (12)
6fcdcb2a: push eax                          ; pPlayer
6fcdcb2b: call 0x6fd1ab9c                   ; D2Common_GetUnitStat(pPlayer, STAT_LEVEL, 0)
6fcdcb32: add  eax, 0x5                     ; ilvl = cLvl + 5
6fcdcb35: cmp  byte ptr [esi+0x6d], 0x0     ; pGame->nDifficulty == 0 (Normal)?
6fcdcb39: jne  0x6fcdcb4b
6fcdcb3b: mov  ecx, [ecx*4+0x6fd296f8]      ; Normal Act caps: [12, 20, 28, 36, 45]
6fcdcb42: cmp  eax, ecx
6fcdcb44: jle  0x6fcdcb4b
6fcdcb46: mov  eax, ecx                     ; ilvl = min(ilvl, actCap)
6fcdcb4b: cmp  eax, 0x1
6fcdcb4e: jge  0x6fcdcb55
6fcdcb50: mov  eax, 0x1                     ; ilvl = max(1, ilvl)
```

- 公式：`ilvl = max(1, cLvl + 5)`；在普通难度 (`difficulty == 0`) 下按商人所在幕数 `actIndex` (`0..4`) 截断为 `[12, 20, 28, 36, 45]`。

### 3.2 普通商品与魔法商品数量及品质 (`0x6FCDF2E0`, `0x6FCDCE00`)

1. **普通槽位 (`<Npc>Min .. <Npc>Max`) 仅在 `ilvl < 25` 时生成 (`0x6FCDF3DE`)**：
   - `0x6FCDF3DE: cmp edi, 0x19; jge 0x6FCDF45E` — 当商店 `ilvl >= 25` 时跳过普通（白色/劣质/超强）槽位循环，只生成魔法槽位与常驻商品。
   - 当 `ilvl < 25` 时，数量 `count = min + rand(max - min + 1)`，每件调用 `0x6FCDCE00` (`NPC_RollNormalItemQuality`) 掷 `r = rand(100)`：
     - `ilvl < 5`：`r > 90` (`91..99`, 9%) 为劣质 (`LOW_QUALITY = 1`)，否则为普通 (`NORMAL = 2`)。
     - `5 <= ilvl < 10`：`r > 85` (`86..99`, 14%) 为超强 (`SUPERIOR = 3`)，否则为普通 (`NORMAL = 2`)。
     - `ilvl >= 10`：`r >= 75` (`75..99`, 25%) 为超强 (`SUPERIOR = 3`)，否则为普通 (`NORMAL = 2`)。

2. **魔法槽位 (`<Npc>MagicMin .. <Npc>MagicMax`, `<Npc>MagicLvl`) (`0x6FCDF468..0x6FCDF529`)**：
   - 额外上限奖励 `nBonus = (ilvl < 25) ? 1 : (rand(2) + 2)`（即 `ilvl >= 25` 时为 `2` 或 `3`）。
   - `maxRoll = magicMax + nBonus`；若 `magicMin < maxRoll`，生成数量 `count = magicMin + rand(maxRoll - magicMin)`。
   - 词缀等级通过 `<Npc>MagicLvl` 抬升用于词缀池筛选的等效 `ilvl` (`effectiveAffixIlvl = max(ilvl + magicLvl, base.level, 1)`)，而物品自身的 `item.ilvl` 保持为商店 `ilvl`。

### 3.3 噩梦/地狱底材升级与凹槽/职业技能 (`0x6FCDEE30`, `0x6FC4EC10`)

- **底材升级 (`0x6FCDEECE..0x6FCDF090`)**：仅当 `nDifficulty > 0 && cLvl > 25` 时触发：
  - **噩梦 (`nDifficulty == 1`)**：掷 `rand(100000) < (ilvl << 6) + 4000` (`64 * ilvl + 4000`) 升级为扩展级 (`ubercode`)；若未命中则应用 `NightmareUpgrade` 列重映射。
  - **地狱 (`nDifficulty == 2`)**：资料片模式下先掷 `rand(100000) < (ilvl << 4) + 1000` (`16 * ilvl + 1000`) 升级为精华级 (`ultracode`)；未命中再掷 `rand(100000) < (ilvl << 7) + 5000` (`128 * ilvl + 5000`) 升级为扩展级 (`ubercode`)；仍未命中则应用 `HellUpgrade` 列重映射。
- **凹槽与 Staffmods (`0x6FC4EC10` `D2GAME_CreateItemEx`)**：
  - 非魔法装备 (`quality <= 3`) 且底材 `gemsockets > 0` 时，按 `ItemTypes.txt` 的 `MaxSock1` (`ilvl < 25`)、`MaxSock25` (`25 <= ilvl < 40`)、`MaxSock40` (`ilvl >= 40`) 与 `base.maxSockets` 取下界掷凹槽数；魔法装备 (`quality == 4`) 仅由带打孔属性的魔法词缀 (`Mechanic's` / `Artisan's` / `Jeweler's`) 赋予凹槽。
  - 职业专属底材 (`wand`, `staf`, `orb`, `scep`, `head`, `pelt`, `phlm`, `h2h`, `h2h2`) 通过 `0x6FC4E520` (`ITEMS_RollStaffMods`) 生成最多 3 条 +1..+3 职业技能修正。

---

## 4. 赌博生成与购买揭晓机制 (`0x6FCDE2A0`, `0x6FCDD040`, `0x6FCDE640`)

### 4.1 赌博网格生成 (`0x6FCDE2A0` `NPC_FillGamble`)

```asm
6fcde344: push 0x0
6fcde346: push 0xc
6fcde348: push ebx                          ; pPlayer
6fcde349: call 0x6fd1ab9c                   ; cLvl = D2Common_GetUnitStat(pPlayer, STAT_LEVEL, 0)
...
6fcde361: mov  ecx, 0xa
6fcde366: div  ecx                          ; edx = rand(10) (0..9)
6fcde368: lea  edi, [edx+ebp-0x5]           ; ilvl = cLvl - 5 + rand(10)
6fcde36c: cmp  edi, 0x5
6fcde36f: jge  0x6fcde378
6fcde371: mov  edi, 0x5                     ; min ilvl = 5
...
6fcde4d9: add  dword ptr [esp+0x18], 0x1    ; ++failStreak
6fcde4df: cmp  dword ptr [esp+0x18], 0xc    ; failStreak < 12?
6fcde4e4: jl   0x6fcde300                   ; 连续 12 次放置失败后停止填充
```

1. **候选底材池**：从 `Gamble.txt` 筛选 `base.level <= cLvl + 4` 的底材，无硬编码 14 件上限，也不强制保底塞入戒指/项链。
2. **网格填充终止条件**：向 10×10 赌博网格持续随机抽取底材并尝试放置，每次成功放置将连续失败计数重置为 `0`，直到连续 `12` 次放置失败 (`failStreak >= 12`) 为止。
3. **单次 `ilvl` 掷骰**：在生成预览底材时掷一次 `ilvl = clamp(cLvl - 5 + rand(10), 5, 99)` 并保存在预览物品上；玩家点击购买 (`0x6FCDE640`) 时**直接复用该预览物品的 `ilvl`**，绝不二次重掷 `ilvl`。

### 4.2 赌博购买揭晓：底材升级、品质概率与降级耐久 (`0x6FCDD040`, `0x6FCDE640`)

1. **扩展 / 精华底材升级 (`0x6FCDD040` `NPC_RollGambleUpgrade`)**：
   - 基于揭示时的 `ilvl` 与目标扩展/精华底材的 `qlvl`，当 `ilvl >= target.level` 时计算升级概率（以 `10000` 为分母，`ItemRatio.txt` 中 `GambleUber = 90`, `GambleUltra = 33`）。
2. **品质概率 (`ItemRatio.txt` / `100000` 分母)**：
   - 暗金 (`Unique`)：`50 / 100,000` (`1 / 2000 = 0.05%`)
   - 套装 (`Set`)：`100 / 100,000` (`1 / 1000 = 0.10%`)
   - 稀有 (`Rare`)：`10,000 / 100,000` (`10.00%`)
   - 魔法 (`Magic`)：其余 `89,850 / 100,000` (`89.85%`)
3. **按 `rarity` 权重选取与 Failed Unique / Failed Set 降级规则**：
   - 当命中暗金或套装档位时，筛选 `enabled && !nolimit`、`code === resolvedBase.id` 且 `lvl <= ilvl` 的所有条目，按 `max(1, rarity)` 加权随机抽取。
   - **Failed Unique（暗金落空）**：若无合格暗金条目，降级为**稀有 (`Rare = 6`)**，且最大耐久度翻 **3 倍** (`durabilityMultiplier = 3`)。
   - **Failed Set（套装落空）**：若无合格套装条目，降级为**双倍耐久度的蓝色魔法物品 (`Magic = 4`, `durabilityMultiplier = 2`)**（绝不降级为稀有）。
