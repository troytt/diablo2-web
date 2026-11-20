# D2Game / D2Common 1.13c 商人价格计算与买卖/赌博严格事务规范

> **Ground Truth**: `D2Common.dll` v1.13c (`ImageBase = 0x6FD50000`, `#10107` `ITEMS_GetTransactionCost` at `0x6FD78E80`), `D2Game.dll` v1.13c (`ImageBase = 0x6FC20000`, `0x6FCDE640` `NPC_BuyItem`, `0x6FCDF730` `NPC_InitStoreOrGamble`), `ItemCost` 与 `ItemRatio.txt`。
> **关联 Issue**: #1486 (Closes #1486)

---

## 1. 核心地址与交易类型规范

`D2Common.dll` `#10107` (`0x6FD79D60` -> `0x6FD78E80`):
`uint32_t __stdcall ITEMS_GetTransactionCost(D2GameStrc* pGame, D2UnitStrc* pPlayer, D2UnitStrc* pItem, D2UnitStrc* pNpc, int32_t nDifficulty, void* pItemCostTables, int32_t nTransactionType, int32_t nDiscount)`

### 交易类型 (`nTransactionType`):
- `0` (`D2C_TRANSACTION_BUY`): 玩家从商人购买商品。
- `1` (`D2C_TRANSACTION_SELL`): 玩家向商人出售商品。
- `2` (`D2C_TRANSACTION_GAMBLE`): 赌博购买。在 1.13c 中，`version >= 1` (`wItemFormat >= 1`) 时调用 `0x6FD78F38`：
  - `cost = computeGambleBaseCost113c(item.code, clvl, tables)`
  - 若有价格折扣（如吉德的幸运金币或边缘符文之语降低商人价格属性），按比例扣减：`cost = cost - (discount * cost / 100)`。
  - 绝不使用无等级缩放的 `info.cost`。
- `3` (`D2C_TRANSACTION_REPAIR`): 单件修理/充能费用。

---

## 2. 严格错误处理与禁止宽容兜底

1. **拒绝未知物品代码与非法条目**:
   - `0x6FCDE640` (`NPC_BuyItem`): 若物品在商人库存中不存在、或未处于合法赌博预览池中，直接拒绝交易，服务端不扣除金币，不下发物品。
   - 严禁将未知代码默认兜底为 `'cap'`。未知底材代码无法在 `Armor.txt` / `Weapons.txt` / `Misc.txt` 寻址时，必须直接拒绝交易。

2. **严禁 `cost / 4` 伪造公式**:
   - 无论物品是否包含完整 `rawItemData`，所有卖出估价一律通过 `TransactionCostInput` 传入 `computeTransactionCost113c(..., type=1)`，按 1.13c 官方公式（底材价格、耐暂度损耗、词缀乘数、商人等级上限）计算卖价。
   - 严禁在缺失 `rawItemData` 或异常时使用 `Math.floor(cost / 4)`。

3. **定价异常阻断交易**:
   - 若价格计算函数由于数据不匹配或损坏抛出异常，服务端捕获后必须直接中止交易，保证玩家金币与物品栏状态不发生任何改变，杜绝玩家利用兜底低价套购商品。
