# Diablo II v1.13c 跨层楼梯/入口 (`UNIT_TILE = 5`) 交互、寻路与同幕切换规范

> **Ground Truth**: `D2Client.dll` (`ImageBase = 0x6FAB0000`), `D2Game.dll` (`ImageBase = 0x6FC20000`), `D2Common.dll` (`ImageBase = 0x6FD50000`), `LvlWarp.txt`, `LvlMaze.txt`, `LvlPrest.txt` (Diablo II: Lord of Destruction v1.13c).

---

## 1. 客户端点击 `UNIT_TILE = 5` 分支 (`D2Client.dll` `0x6FACAED0..0x6FACAFE7`)

在 `D2Client.dll` 左键目标点击分发中，当命中单位类型为 `UNIT_TILE (5)`（楼梯、洞口、地窖入口等 `S2C 0x09 AssignWarp` 实体）时：

```asm
0x6facaed0: call 0x6fab2d80                  ; 清空旧待定交互队列
0x6facaed5: mov ecx, [0x6fbc9828]            ; gdwNextWarpClickTick (500ms 冷却时间戳)
0x6facaedb: mov eax, [esi+0x34]              ; nowTick = GetTickCount()
0x6facaede: cmp eax, ecx
0x6facaee0: jb 0x6fac94be                    ; 若 nowTick < gdwNextWarpClickTick，忽略点击
0x6facaee7: push edi                         ; pWarpUnit (UNIT_TILE = 5)
0x6facaee8: push ebx                         ; pPlayerUnit (UNIT_PLAYER = 0)
0x6facaee9: call 0x6fb70de4                  ; D2Common.#10407(pPlayerUnit, pWarpUnit)
0x6facaeee: cmp eax, 0x4
0x6facaef1: jle 0x6facaf28                   ; 若距离 <= 4 子格，进入近距直接交互分支
```

### 1.1 远距走近分支 (`#10407 > 4`, `0x6FACAEF3..0x6FACAF26`)
1. 调用 `0x6FADA7C0` (`CMD_SendMoveToUnit`) 向服务端发送 `C2S 0x02 WalkToUnit` 或 `C2S 0x04 RunToUnit` (`unitType = 5, unitId = warpUnitId`)，并启动本地 `PATHTYPE_TOWARD` 预测移动。
2. 调用 `0x6FAB2D50(pPlayer, pWarpUnit, 2, 0)` 将 `(unitType = 5, unitId = warpUnitId)` 注册为待定到达交互目标；当后续每帧 tick 检测 `#10407(pPlayer, pWarpUnit) <= 4` 且无墙体阻挡 (`#10324(..., 0x804) == 0`) 时发送 `C2S 0x13 Interact(5, warpUnitId)`。

### 1.2 近距直接交互分支 (`#10407 <= 4`, `0x6FACAF28..0x6FACAFE7`)
1. 调用 `D2Common.#10324(pRoom, playerX, playerY, warpX, warpY, 0x0804)` 检查玩家与楼梯之间是否被墙体或关着的门 (`COLLIDE_WALL | COLLIDE_DOOR = 0x0804`) 阻挡：
   - 若被阻挡 (`eax != 0`)，播放无法进入语音并中止；
   - 若视线畅通 (`eax == 0`)，写入 `[0x6FBC9828] = GetTickCount() + 500` (`0x1F4 = 500ms`)，停止玩家路径 (`D2Common.#10142(pPath, 0)`)，并立即发送 `C2S 0x13 Interact(5, warpUnitId)` (`0x6FAB1D40`)。

---

## 2. 服务端 `MoveToUnit` (`C2S 0x02` / `0x04`) 与 `Interact` (`C2S 0x13`) 处理

### 2.1 `D2GAME_MoveToUnit_6FCEE150` (`0x6FCEE120` -> `0x6FCEE150`)
- `C2S 0x02 WalkToUnit` (`0x6FCEE120`) 与 `C2S 0x04 RunToUnit` (`0x6FCEE2D0`) 共用 `0x6FCEE150`。
- 在 `0x6FCEE21B` 处判定 `unitType == 5 (UNIT_TILE)`：
  - `UNIT_TILE` 为静态坐标单位 (`STATICPATH`)，读取 `wX = [pTileUnit+0x00]`, `wY = [pTileUnit+0x04]`；
  - 调用 `0x6FCFFDC0` (`UNIT_FollowOrPathToUnit`) 设置玩家路径目标并向该 `UNIT_TILE` 行走/奔跑。

### 2.2 `D2GAME_Interact_6FCF01D0` (`case 5` @ `0x6FCF02BC..0x6FCF0322`)
```asm
0x6fcf02bc: push esi                         ; pTileUnit (UNIT_TILE = 5)
0x6fcf02bd: push edi                         ; pPlayerUnit
0x6fcf02be: call 0x6fd2843a                  ; D2Common.#10407(pPlayerUnit, pTileUnit)
0x6fcf02c3: cmp eax, 0x4
0x6fcf02c6: jg 0x6fcf0334                    ; 距离 > 4 子格则忽略
0x6fcf02ef: push 0x804                       ; COLLIDE_WALL | COLLIDE_DOOR
...
0x6fcf02fd: call 0x6fd285ac                  ; D2Common.#10324 视线射线检测
0x6fcf0302: test eax, eax
0x6fcf0304: jnz 0x6fcf0334                   ; 有墙/门阻挡则忽略
0x6fcf0318: push 0
0x6fcf031a: push esi                         ; pTileUnit
0x6fcf031b: push edi                         ; pPlayerUnit
0x6fcf031c: mov eax, ebx                     ; pGame
0x6fcf031e: call 0x6fd01c00                  ; SUNIT_WarpPlayer -> ROOMTILE_WarpPlayer (0x6fd019c0)
```

### 2.3 `ROOMTILE_WarpPlayer` (`0x6FD019C0`) 与同幕跨层同步协议
1. `0x6FD019C0` 调用 `D2Common.#10035(pRoom, pTileUnit)` 解析配对目标房间与目标传送点坐标 `(destX, destY)`，并调用 `D2Common.#10256` 寻找目标楼梯旁可站立子格。
2. 同幕跨层切换（如第一幕监牢二层 `areaId = 30` ↔ 监牢三层 `areaId = 31`）不发送 `0x03 LoadAct`，而是按序下发：
   - 旧层视野房间的 `S2C 0x08 MapRemove` (`RoomHide`)；
   - 新层入口视野房间的 `S2C 0x07 MapAdd` (`RoomReveal`)；
   - 本地玩家的 `S2C 0x15 ReassignPlayer` (`UnitReassign`)；
   - 新层内单位的 `S2C 0x09 AssignWarp` / `0x51 AssignObject` / `0xAC AssignMonster` / `0x9C WorldItemAction`。

---

## 3. Web 端同幕往返与迷宫房间裁剪关键约束 (Issue #1488)

1. **`UnitReassign` 立即同步当前层 (`syncActiveAreaFromPlayerPosition`)**：
   - 同幕跨层（如 `30 -> 31 -> 30`）不触发 `LoadAct` (`0x03`)。必须在收到本地玩家 `UnitReassign` (`0x15`) 时立即同步 `lastSyncedAreaId` 并执行跨层旧单位清理，随后再接收新层的 `emitAreaSnapshotToPlayer` (`UnitAssign`)；若延迟到下一渲染帧才检测 `areaChanged`，会把刚刚收到的新层远程楼梯 (`UNIT_TILE`)、小站、任务物件与怪物当作旧层残留误删。
2. **`RoomHide` (`0x08`) 按真实 DRLG 房间尺寸裁剪 (`subW × subH`)**：
   - `LvlMaze.txt` / `LvlPrest.txt` 中地牢房间并非固定 `8×8` 地块 (`40×40` 子格)：如第一幕监牢 (`area 29..31`)、地下墓穴 (`area 34..37`)、第二幕下水道 (`area 47..49`)、蛆虫巢穴 (`area 62..64`) 为 **`12×12` 地块 (`60×60` 子格)**，神秘避难所 (`area 74`) 与世界之石大殿 (`area 128..131`) 为 **`16×16` 地块 (`80×80` 子格)**。
   - `RoomHide` 必须在移除 `_revealedRoomSeeds` 之前读取房间的真实 `(subW, subH)` 裁剪房间内非自身单位，避免 `8..11` 地块偏移处的旧层楼梯/怪物残留在重叠世界坐标上遮挡当前层楼梯。
3. **房间 AOI 动态进入时补发房间内单位 (`emitRoomUnitsToPlayer`)**：
   - 当玩家在层内移动使某房间重新进入 `ROOM_REVEAL_RADIUS_TILES (8)` 视野并触发 `RoomReveal` (`0x07`) 时，服务端同步下发该房间矩形 `[subX, subX + subW) × [subY, subY + subH)` 内的 `warpTiles`、`objects`、`monsters` 与 `groundItems`。
4. **同层重复 `lvlWarpId` 按坐标就近匹配目标层 (`session-render-builder.ts`)**：
   - 同一层可存在多个共享相同 `lvlWarpId` 的楼梯（如监牢三层 `area 31` 通往监牢二层 `area 30` 与内侧回廊 `area 32` 的两座楼梯均为 `lvlWarpId = 13`），匹配 `LevelView.warps` 时必须优先按世界子格距离 `hypot(w.subX - ux, w.subY - uy)` 就近匹配。
