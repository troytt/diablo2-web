# D2Game Room AOI & Cross-Area Visibility (v1.13c)

> **Ground Truth**: `samples/d2/D2Game.dll` (`ImageBase = 0x6FC20000`), `samples/d2/D2Common.dll` (`ImageBase = 0x6FD50000`), `D2ActiveRoomStrc`, `D2Common.#10754` (`ROOM_GetNearRoomsList`).

---

## 1. 架构原理：基于房间（DRLG Room）的权威可见性

在 Diablo II v1.13c 原版服务端中，世界空间被划分为离散的矩形房间（`D2ActiveRoomStrc` / `D2Room1Strc`，通常为 8×8 tile 即 40×40 子格，或预制件尺寸）。
客户端对单位（玩家、怪物、物件、地面物品、传送门、地块楼梯）的可见性由**房间邻接集合**（`pRoom1->ppRoomsNear`）决定，而不是自造的二维欧式圆（`Math.hypot(dx, dy) <= R`）：

1. **房间揭示与隐藏 (`S2C 0x07 / 0x08`)**：
   - 当玩家移动至新房间附近时，服务端计算距玩家的切比雪夫/曼哈顿距离：
     - `dist <= ROOM_REVEAL_RADIUS_TILES (8 tile)`：触发 `S2C 0x07 MapAdd`，并在该房间矩形范围内派发存量单位生成包（`0x59` 玩家、`0xAC` 怪物、`0x9C` 物品、`0x09` 楼梯）。
     - `dist > ROOM_HIDE_RADIUS_TILES (16 tile)`：触发 `S2C 0x08 MapRemove`。
2. **跨区域缝合连接（Cross-Area Seam Adjacency）**：
   - 户外相连区域（如罗格营地 `areaId: 1` ↔ 鲜血荒野 `areaId: 2`）共享统一的世界坐标系。
   - 边界处的房间其 `ppRoomsNear` 列表中包含相邻区域在缝合处的相邻房间（`isAreaSeamAdjacent`）。
   - 站在城镇大门口的玩家，其活跃房间集合自然包含大门外鲜血荒野侧的近邻房间，因此大门外的怪物与移动广播对镇内玩家**完全可见**。
   - 1.13c 绝不会因为 `viewer.areaId !== target.areaId` 而强制将缝合处的近邻单位判定为不可见。

---

## 2. 之前实现的缺陷（Anti-Pattern）

在 `MultiClientRoomHost` 与 `AoiFilter` 的旧实现中存在三处严重违背 1.13c 原版的猜测代码：

1. **写死 80 子格圆形过滤 (`DEFAULT_AOI_RADIUS_SUBTILES = 80`)**：
   - 无任何 1.13c DLL/MPQ 出处。
   - 与 `GameInstance` 内部 8 tile 揭示 / 16 tile 隐藏的房间矩形机制冲突，导致单位在两层过滤边界来回抖动。
2. **同区域硬过滤 (`if (viewer.areaId !== target.areaId) return false`)**：
   - 导致城镇大门两边、或任意野外缝合交界处的单位被瞬间判定为超出视野。
3. **RoomHost 自行合成 `UnitAssign` 与 `UnitRemove`**：
   - 当单位跨过 80 子格阈值时，RoomHost 自行向客户端发送伪造的 `UnitRemove`。
   - 随后进入时又自行发送字段残缺的 `UnitAssign`（缺少血量比例、Boss 词缀、灵气光环等核心状态），且与 `GameInstance` 真实的房间事件队列脱节。
4. **宽松兜底回退 (`lookupUnitArea ?? 1`)**：
   - 查不到单位所在区域时硬编码回退为罗格营地（`areaId = 1`）。

---

## 3. 对齐规范

1. **权威事件流交付**：
   - `MultiClientRoomHost` 默认完全依托 `GameInstance.drainEvents(playerUnitId)` 进行权威事件分发，不叠加未配置的二次圆形过滤或合成 assign/remove。
   - 仅当测试或特殊场景显式传入 `aoiRadius` 时启用显式 AOI 模式。
2. **缝合区域继承**：
   - `AoiFilter.isInRange` 引入 `isSeamAdjacent` 判定；当两单位处于相邻缝合关卡时，不因 `areaId` 差异而截断。
3. **消除宽松兜底**：
   - `lookupUnitArea` 查不到时返回 `undefined`，不再回退到 `?? 1`。
