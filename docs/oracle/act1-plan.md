# Act 1 全覆盖计划（M24，Oracle 逐帧差分）

目标：Act 1 的服务端行为在 Oracle 差分下与原版 1.13c 逐帧一致。范围与计数口径见
[`coverage.md`](./coverage.md) §5。

| 维度 | 原版全量（Act 1） | 已逐帧覆盖 |
|---|---|---|
| 关卡 | 39 | 2（`1` Rogue Encampment、`2` Blood Moor） |
| 怪物类（`Levels.txt` mon/nmon/umon） | 57 | 出现在 golden 中 3 个（`zombie1`、`fallen1`、`quillrat1`），逐帧对齐的只有 `zombie1` |
| MonAI | 19 + 预设 5 | `Zombie`（`NecroPet`、`Hireable`、`Npc`、`Idle` 不属于野外怪物） |
| 任务 | 6 | 0 |
| 难度 | 3 | 1（普通） |

## 1. 工作分解

按"一个场景引出一批 MonAI / 机制移植"的方式推进，每一步都先录原版 golden，再追第一处分歧。

1. **Blood Moor / Cold Plains 野怪**：`Fallen`、`FallenShaman`（复活）、`QuillRat`（远程刺）、`Goatman`、
   `Brute`、`Bighead`、`FoulCrowNest` / `BloodHawk`。
   第一个场景 `a1c-bloodmoor-fallen`（`tools/oracle/make-act1-scenarios.py`）：L1 野蛮人向西进入 Blood Moor，
   逐个击杀 Fallen #12..#15；原版双跑字节一致，trace 中还激活了 Fallen #19..#26 与 Quill Rat #27/#28。
   复刻第一处分歧在 **F689**：房间刷怪时 Fallen 群的第 4 只（#15，位于队长 #12 的 (-2,+3)）没有放下，
   之后游戏种子分歧。下一步：对照 `room-populate-113c.ts` `tryPlaceMonsterRing113c` 与原版放置函数
   （`MinGrp..MaxGrp` 环形放置、碰撞掩码），必要时用 `oracleDumpColl` 导出该房间碰撞。
2. **Den of Evil（任务 1）与 Burial Grounds（任务 2，Blood Raven 预设）**：任务状态机、
   `Corpsefire` / `Blood Raven` SuperUnique、任务奖励。
3. **Stony Field / Tristram（任务 4 Cain）、Dark Wood（任务 3 Inifuss）**：传送门、`Griswold`、`Rakanishu`。
4. **Outer Cloister ~ Catacombs**：`CorruptRogue`、`CorruptArcher`、`CorruptLancer`、`Skeleton`、`SkeletonBow`、
   `SkeletonMage`、`Wraith`、`Vampire`、`Arach`、`Fetish`（`Smith` 任务 5 `Horadric Malus`）。
5. **Andariel（任务 6）**：`Andariel` AI、毒云、Act 1 → Act 2 过关。
6. **噩梦 / 地狱**：同一批场景在 `difficulty = 1/2` 下重录。

## 2. 噩梦 / 地狱的前置条件（阻塞项）

`run-oracle-scenario.sh` 在 `difficulty != 0` 时直接退出，原因有两层：

1. 菜单脚本只有 `tools/oracle/menus/sp-first-char.txt`（普通难度），需要新增点选噩梦 / 地狱按钮的菜单脚本。
2. **存档必须已解锁该难度**。单机难度解锁记录在存档的通关进度里，`create-char.py` 生成的角色只能进普通难度；
   P5.2 规定存档不能手改字节。可行方案：
   - 仿照 `setexp` / `equip`，加一个只在存档制作时生效的 hook 操作，调用原版设置通关进度的函数后正常存档
     （需要先在 `D2Game.dll` 中定位该函数并写入 `kb/`）；
   - 或在原版中真实通关 Act 5（成本过高，不采用）。

在这一项解决之前，Act 1 的覆盖只能先做普通难度。

## 3. 每个场景的验收

- 原版双跑字节一致；golden 存入 `tests/fixtures/oracle/golden/`，`parity-baseline.json` 登记棘轮。
- 每个新移植的 MonAI / 函数在 `kb/monsters/` 有逐分支伪代码与 RNG 表，并加入 `function-map.md`。
- `coverage.md` 重新计数。
