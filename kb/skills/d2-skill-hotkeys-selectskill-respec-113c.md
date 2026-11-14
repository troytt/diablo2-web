# D2 1.13c 技能快捷键 (`0x51`/`0x7B`)、技能切换 (`0x3C`/`0x23`) 与洗点重置 (`0x21`) 逆向规范

> **Ground Truth**: `D2Common.dll` (`ImageBase = 0x6FD50000`), `D2Game.dll` (`ImageBase = 0x6FC20000`), `D2Client.dll` (`ImageBase = 0x6FAB0000`).

---

## 1. 核心数据结构与全局表

### 1.1 `D2Common` 单位技能链表 (`D2SkillListStrc` & `D2SkillStrc`)

每个 `D2UnitStrc` 在 `+0xA8` (`pInfo`) 处持有 `D2SkillListStrc*`：

| 偏移 | 字段 | 类型 | 说明 |
|---|---|---|---|
| `+0x00` | `pMemPool` | `void*` | 内存池指针 |
| `+0x04` | `pFirstSkill` | `D2SkillStrc*` | 单位已拥有技能单向链表头 (`next` 在 `D2SkillStrc+0x04`) |
| `+0x08` | `pLeftSkill` | `D2SkillStrc*` | 当前左手选中技能指针 |
| `+0x0C` | `pRightSkill` | `D2SkillStrc*` | 当前右手选中技能指针 |
| `+0x10` | `pCurrentSkill` | `D2SkillStrc*` | 当前正在施放的技能指针 |

每个 `D2SkillStrc` 节点字段：
- `+0x00`: `pSkillsTxt` (`D2SkillsTxt*`，首字段 `+0x00` 为 `wSkillId`)
- `+0x04`: `pNextSkill` (`D2SkillStrc*`)
- `+0x28`: `nSkillLevel` (`int32_t`，基础技能等级)
- `+0x30`: `nQuantity` (`int32_t`，书卷/箭矢数量，`D2Common.#10353` `0x6FD9DD70`)
- `+0x34`: `dwOwnerGUID` (`uint32_t`，非聚气技能固定为 `0xFFFFFFFF` (`-1`)，聚气技能为所属装备 `dwUnitId`，`D2Common.#10304` `0x6FD9E2B0`)
- `+0x38`: `nCharges` (`int32_t`，当前剩余聚气次数，`D2Common.#10537` `0x6FD9E240`)

### 1.2 `D2Client.dll` 客户端 16 槽位技能快捷键表 (`0..15`)

| 全局地址 | 数组名 | 类型 | 初始/未绑定值 | 说明 |
|---|---|---|---|---|
| `0x6FBC9D30` | `gdwSkillHotkeySkillId[16]` | `int32_t[16]` | `-1` (`0xFFFFFFFF`) | 槽位绑定的技能 ID |
| `0x6FBC9E20` | `gdwSkillHotkeyIsLeft[16]` | `int32_t[16]` | `-1` (`0xFFFFFFFF`) | `1` = 左手，`0` = 右手 |
| `0x6FBC9DD0` | `gdwSkillHotkeyOwnerItemGUID[16]` | `uint32_t[16]` | `0xFFFFFFFF` (`-1`) | 聚气技能所属物品 `unitId`，非聚气为 `0xFFFFFFFF` |

---

## 2. `D2Common.dll` 技能等级置零与链表移除 (`#10302` `0x6FDA2BC0`)

### 2.1 `SKILLS_SetSkillLevel` (`D2Common.#10302`, `0x6FDA2BC0`)

函数签名：`void __stdcall SKILLS_SetSkillLevel(D2UnitStrc* pUnit, int nSkillId, int nSkillLevel, BOOL bReset, const char* szFile, int nLine)`

- 当 `nSkillLevel == 0` (`test edi, edi; jne 0x6FDA2C28`) 且 `bReset != 0` (`test eax, eax; je 0x6FDA2BEF`) 时：
  1. 调用 `SKILLS_RemoveSkill(pUnit, nSkillId, 0)` (`0x6FDA28B0`)。
  2. 调用 `SKILLS_RefreshPassiveSkills(pUnit, nSkillId)` (`0x6FDA2480`) 移除该技能挂载的被动状态列表 (`STATLIST_FreeStatList` `0x6FD8A9F0`)。

### 2.2 `SKILLS_RemoveSkill` (`0x6FDA28B0`)

当 `bDecrement == 0`（即 `S2C 0x21 UpdateSkill` 携带 `level = 0, bReset = 1` 或服务端洗点 `0x6FCBF9A0(wSkillId, 0, 1)`）时：
1. 若 `pInfo->pLeftSkill` (`[edi+0x08]`) 匹配 `(wSkillId == nSkillId && dwOwnerGUID == -1)`，立即调用 `0x6FD9ED60(pUnit, 0, -1)` 将左手技能重置为 `0` (`Attack`)。
2. 若 `pInfo->pRightSkill` (`[edi+0x0C]`) 匹配 `(wSkillId == nSkillId && dwOwnerGUID == -1)`，立即调用 `0x6FD9ECC0(pUnit, 0, -1)` 将右手技能重置为 `0` (`Attack`)。
3. 若 `pInfo->pCurrentSkill` (`[edi+0x10]`) 匹配，清空 `pInfo->pCurrentSkill = NULL`。
4. 遍历 `pInfo->pFirstSkill` 链表，定位匹配 `(wSkillId == nSkillId && dwOwnerGUID == -1)` 的 `D2SkillStrc` 节点，**将其从 `pFirstSkill` 链表中摘除并释放内存 (`0x6FD59228`)**。

> **关键推论**：在原版 `D2Common.dll` 中，洗点后基础等级归零（且无装备赋予该技能等级加成）的技能节点会直接从 `pPlayer->pInfo->pFirstSkill` 链表中被销毁；后续任何对该技能调用的 `SKILLS_GetSkillById(pPlayer, nSkillId, -1)` (`D2Common.#10708`, `0x6FD9F080`) 均返回 `NULL` (`0`)。

---

## 3. `D2Game.dll` 服务端洗点、技能选择 (`0x3C`) 与快捷键绑定 (`0x51`)

### 3.1 阿卡拉洗点 (`0x6FCE0500`) 与赦免徽章 (`toa`, `0x6FCF9F55`)

两处洗点入口均调用完全相同的三个核心函数：
1. `0x6FCF29F0(pPlayer)`: 销毁玩家所有召唤物/宠物。
2. `0x6FCC1280(pGame, pPlayer)` (`SKILLS_RespecPlayerSkills`):
   - 根据 `pPlayer->nClass` 从 `sgptDataTables` 获取该职业起始技能 ID 与技能总数 (`[edx]`..`[edx+ecx]`)。
   - 循环遍历本职业全部 30 个技能：
     - 调用 `SKILLS_GetSkillById(pPlayer, wSkillId, -1)` (`0x6FC2A3D0`) 与 `SKILLS_GetSkillLevel(pPlayer, pSkill, 0)` (`0x6FC2A400`, `bBonus = 0` 仅统计硬点)。
     - 累加硬点总数 `nRefundSkills += nBaseLevel`。
     - 调用 `0x6FCBF9A0(wSkillId, 0, 1)` 将技能等级设为 `0` (`bReset = 1`)。
     - 调用 `0x6FCAD5F0` 向客户端发送 `S2C 0x21 UpdateSkill` (`skillId = wSkillId, level = 0, bReset = 1`)。
   - 若 `nRefundSkills > 0`，调用 `STATLIST_AddUnitStat(pPlayer, STAT_NEWSKILLS (5), nRefundSkills, 0)` (`0x6FC2A4D2`) 并发送 `S2C 0x1D..0x1F` 属性同步包。
   - 调用 `0x6FCF24B0(pPlayer)` 与 `0x6FCF51A0(pGame, pPlayer, 0)` 重新评估身上穿戴装备的需求与装备赋予的技能加成。
   - 调用 `D2GAME_AssignSkill(pPlayer, 0, 0, -1)` 与 `D2GAME_AssignSkill(pPlayer, 1, 0, -1)` (`0x6FCC2100`) 将右手、左手当前技能強制重置为 `0` (`Attack`) 并下发 `S2C 0x23 AssignSkill`。
3. `0x6FD0AF80(pPlayer)` (`RespecPlayerStats`):
   - 读取 `CharStats.txt` 中该职业初始力量 (`+0x30`, stat 0)、敏捷 (`+0x31`, stat 2)、精力 (`+0x32`, stat 1)、体力 (`+0x33`, stat 3)。
   - 将四维基础值扣回初始值，并将扣除的点数总额加回 `STAT_STATPTS (4)`，同步生命/法力/耐力上限。

### 3.2 服务端 `C2S 0x3C SelectSkill` 处理函数 (`0x6FCEF480` -> `0x6FCC2100`)

1. 解包 9 字节报文：
   - `nSkillId = *(uint32_t*)(pPacket + 1) & 0x7FFFFFFF`（即低 16 位 `u16 skillId`）
   - `bLeft = (*(uint32_t*)(pPacket + 1) >> 31) & 1`（即 `pPacket[4] == 0x80`）
   - `dwItemId = *(uint32_t*)(pPacket + 5)`
2. 校验 `0 <= nSkillId < sgptDataTables->nSkillsTxtRecordCount`；越界则返回 `3`（丢弃）。
3. 调用 `pSkill = SKILLS_GetSkillById(pPlayer, nSkillId, dwItemId)` (`0x6FC2A3D0`)：
   - **若 `pSkill == NULL`，直接返回 `3`（拒绝切换，不修改左右手技能，也不回发 `S2C 0x23`）**。
4. 若 `dwItemId == 0xFFFFFFFF`（非聚气技能）：
   - 调用 `SKILLS_GetSkillLevel(pPlayer, pSkill, 1)` (`0x6FC2A400`, `bBonus = 1` 含装备加成后的有效等级)。
   - **若有效技能等级 `<= 0` (`test eax, eax; jle`)，直接返回 `3`（拒绝切换）**。
5. 若 `dwItemId != 0xFFFFFFFF`（聚气技能）：
   - 检查玩家身上 `pInventory` 对应 `dwItemId` 的已穿戴装备 (`INVENTORY_GetItemFromInventory`) 是否有效且拥有该聚气技能 (`0x6FCC2100`)。
6. 校验通过后，调用 `D2GAME_AssignSkill(pPlayer, bLeft, nSkillId, dwItemId)` (`0x6FCC2100`) 更新 `pInfo->pLeftSkill` / `pRightSkill` 并向客户端发送 `S2C 0x23 AssignSkill`。

### 3.3 服务端 `C2S 0x51 AssignSkillHotkey` 处理函数 (`0x6FCEBC70`)

1. 解包 9 字节报文：
   - `nSlot = (*(uint32_t*)(pPacket + 1) >> 16) & 0xFFFF`（校验 `0 <= nSlot < 16`）
   - `bLeft = (*(uint32_t*)(pPacket + 1) >> 15) & 1`
   - `nSkillId = *(uint32_t*)(pPacket + 1) & 0x7FFF`
   - `dwItemId = *(uint32_t*)(pPacket + 5)`
2. 若 `nSkillId > sgptDataTables->nSkillsTxtRecordCount`（如客户端解绑发送的 `0xFFFF & 0x7FFF = 0x7FFF`），将 `nSkillId` 设为 `-1` (`0xFFFFFFFF`) 并写入 `pPlayerData` 快捷键表 (`0x6FC57890`)。
3. 否则，调用 `SKILLS_GetSkillById(pPlayer, nSkillId, dwItemId)` (`0x6FC2A3D0`)；仅当返回非空时才写入 `pPlayerData` 快捷键表。

---

## 4. `D2Client.dll` 客户端快捷键校验、激活与自动解绑 (`0x6FAED110..0x6FAED6D0`)

### 4.1 槽位可选性门控：`IsSkillHotkeySlotSelectable` (`0x6FAED110`)

```asm
6faed110: push ecx
6faed111: mov  edx, DWORD PTR [eax*4+0x6fbc9d30] ; edx = gdwSkillHotkeySkillId[slot]
6faed118: cmp  edx, -1
6faed11b: je   0x6faed127                        ; return 0
6faed11d: mov  ecx, DWORD PTR ds:0x6fbcbbfc      ; ecx = pPlayer
6faed123: test ecx, ecx
6faed125: jne  0x6faed12b
6faed127: xor  eax, eax
6faed129: pop  ecx
6faed12a: ret
6faed12b: mov  eax, DWORD PTR [eax*4+0x6fbc9dd0] ; eax = gdwSkillHotkeyOwnerItemGUID[slot]
6faed133: push eax
6faed134: call 0x6fabc4ea                        ; D2Common.#10708 SKILLS_GetSkillById(pPlayer, edx, eax)
6faed139: mov  esi, eax
6faed13b: test esi, esi
6faed13d: jne  0x6faed144
6faed13f: xor  eax, eax                          ; pSkill == NULL -> return 0!
6faed141: pop  esi
6faed142: pop  ecx
6faed143: ret
6faed144: push esi
6faed145: call 0x6fabc7ae                        ; D2Common.#10304 SKILLS_GetOwnerGUID(pSkill)
6faed14a: cmp  eax, -1
6faed14d: je   0x6faed16c                        ; 非聚气技能且在 pFirstSkill 链表中 -> return 1
6faed14f: lea  ecx, [esp+0x4]
...
6faed15b: call 0x6fabc766                        ; D2Common.#10537 SKILLS_GetSkillInfo(..., &nCharges)
6faed164: mov  eax, DWORD PTR [esp+0x4]
6faed168: test eax, eax
6faed16a: jle  0x6faed13f                        ; 聚气次数 nCharges <= 0 -> return 0!
6faed16c: mov  eax, 1
```

### 4.2 按下技能快捷键：`ActivateSkillHotkeySlot` (`0x6FAED5B0`)

- 检查 `0 <= slot < 16` 且 `gdwSkillHotkeySkillId[slot] != -1`。
- **调用 `0x6FAED110(slot)` (`IsSkillHotkeySlotSelectable`)**。
- **若返回 `0`（例如洗点后技能已从 `pFirstSkill` 移除、卸下装备失去 oskill/聚气、或聚气次数耗尽），直接 `ret` 返回，既不发送 `C2S 0x3C SelectSkill`，也不修改本地左右手当前技能**。
- 若返回 `1`，构造并发送 `C2S 0x3C SelectSkill`，并更新本地选中技能。

### 4.3 鼠标滚轮切换快捷键技能：`CycleBoundSkills` (`0x6FAED6D0`)

- 循环遍历 16 个槽位，仅当槽位满足：
  1. `gdwSkillHotkeySkillId[slot] != -1`
  2. `gdwSkillHotkeyIsLeft[slot] == 0`（右手槽位）
  3. **`0x6FAED110(slot) != 0`（技能当前有效可选）**
  才调用 `0x6FAED5B0(slot)` 切换到该槽位。

### 4.4 技能数量/等级归零时自动解绑：`PruneZeroLevelSkillHotkeys` (`0x6FAED320` & `0x6FAED660`)

- `0x6FAED320(pSkillsTxt, nEffectiveCount)`:
  - 当 `nEffectiveCount <= 0` 时，遍历 `slot = 0..15`。
  - 若 `gdwSkillHotkeySkillId[slot] == pSkillsTxt->wSkillId`：
    - 将 `gdwSkillHotkeySkillId[slot]`、`gdwSkillHotkeyIsLeft[slot]`、`gdwSkillHotkeyOwnerItemGUID[slot]` 全部置为 `-1` (`0xFFFFFFFF`)。
    - 立即向服务端发送 `C2S 0x51 AssignSkillHotkey` (`slot`, `skillId = 0xFFFF`, `itemId = 0xFFFFFFFF`) 持久化解除绑定。

---

## 5. 装备赋予聚气技能 (`STAT_ITEM_CHARGED_SKILL = 204`) 全链路 (`D2Common` / `D2Game` / `D2Client`)

### 5.1 `D2Common.#10953 SKILLS_AddChargeSkill` (`0x6FD9EE00`)
- 函数签名：`D2SkillStrc* __stdcall SKILLS_AddChargeSkill(D2UnitStrc* pUnit, int nSkillId, int nSkillLevel, int nCharges, uint32_t dwItemGUID)`
- 校验 `pUnit->dwUnitType == UNIT_PLAYER (0)` 且 `pUnit->pInfo != NULL`。
- 分配 `D2SkillStrc` 节点并挂入 `pUnit->pInfo->pFirstSkill` 链表，写入：
  - `pSkill->nSkillLevel = nSkillLevel` (`+0x28`)
  - `pSkill->dwOwnerGUID = dwItemGUID` (`+0x34`，即赋予该聚气技能的装备 `pItem->dwUnitId`)
  - `pSkill->nCharges = nCharges` (`+0x38`)

### 5.2 穿戴/卸下/切换副手与施放扣减 (`D2Game.dll` & `D2Client.dll`)
- **穿戴/切换激活 (`D2Game.dll` `0x6FCF9A21`, `D2Client.dll` `0x6FB55A23`)**:
  - 遍历当前激活穿戴槽位（排除副手未激活槽位 `bodyLoc 11/12`、未鉴定物品 `ITEMFLAG_IDENTIFIED (0x10) == 0`、损坏物品 `ITEMFLAG_BROKEN (0x100) != 0`）上的 `STAT_ITEM_CHARGED_SKILL (204)` 属性。
  - 解码 `skillId = param >> 6`、`slvl = param & 0x3F`、`curCharges = value & 0xFF`、`maxCharges = (value >> 8) & 0xFF`。
  - 调用 `SKILLS_AddChargeSkill(pPlayer, skillId, slvl, curCharges, pItem->dwUnitId)` 将聚气技能加入玩家 `pFirstSkill` 链表。
- **施放扣减与耗尽自动切回普攻 (`D2Game.dll` `0x6FCBF4F8` & `D2Client.dll` `0x6FB35990`)**:
  - 当玩家当前选中的 `D2SkillStrc` 具有 `dwOwnerGUID != 0xFFFFFFFF` 时，施放不消耗法力，而是将 `nCharges - 1` 写回该装备的 `stat 204` (`(maxCharges << 8) | newCharges`)。
  - 服务端通过 `S2C 0x3E UpdateItemStats` (`stat = 204, param = (skillId << 6) | slvl, value = newCharges`) 通知客户端更新 `pSkill->nCharges` 与装备 `stat 204`。
  - 当 `newCharges <= 0` 时，服务端与客户端将该手当前选中技能重置为 `0` (`Attack`, `dwOwnerGUID = 0xFFFFFFFF`)。
- **卸下/切换副手清理 (`D2Game.dll` `0x6FCF2380`, `D2Client.dll` `0x6FB5599C`)**:
  - 移除该 `dwItemGUID` 对应的 `D2SkillStrc` 节点；若当前左手或右手正选中该 `dwItemGUID` 的聚气技能，立即重置为 `0` (`Attack`)。

### 5.3 客户端技能选择面板 (`Speedbar`) 聚气技能行与红底染色 (`D2Client.dll` `0x6FAC8D31`, `0x6FAEE927..0x6FAEEDAC`)
- **行分组 (`GetSkillSpeedbarRow` `0x6FAC8D10..0x6FAC8D54`)**:
  - 在 `0x6FAC8D31` 调用 `D2Common.#10304 SKILLS_GetOwnerGUID(pSkill)`：若 `dwOwnerGUID != -1` (`0xFFFFFFFF`)，强制归入 **第 4 行 (`row = 4`)**（聚气/卷轴/物品专属技能行），无论该技能原本属于哪个职业。
- **面板与底栏技能图标绘制 (`DrawSpeedbarSkillIcon` `0x6FAEE7C0`)**:
  - 在 `0x6FAEE927` 检查 `SKILLS_GetOwnerGUID(pSkill) != -1`：
    - 若是聚气技能，调用 `SKILLS_GetSkillInfo` (`0x6FAEE943`) 读取 `nCharges`。
    - 若 `nCharges <= 0` (`0x6FAEE952`)，设置 `bRedTint = 1` 将技能按钮染成红色不可用状态。
  - 在 `0x6FAEED6A..0x6FAEEDAC`：当鼠标悬停于聚气技能图标时，在技能名称下方额外追加一行蓝色 (`color = 3`) 文本：`ModStre10b ("Level") + " " + nLevel + " (" + sprintf(ModStre10d, nCharges, nMaxCharges) + ")"`；若 `nCharges <= 0`，则在右侧显示红色的 `(0)`。

