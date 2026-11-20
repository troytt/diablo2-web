# D2Common AnimData Dispatcher & WeaponClass Timing (v1.13c)

> **Ground Truth**: `samples/d2/D2Common.dll` (`ImageBase = 0x6FD50000`), `data\global\animdata.d2`, `WeaponClass.txt`, `PlrMode.txt`, `Weapons.txt`.

---

## 1. 原版二进制逻辑 (`D2Common.dll`)

在 Diablo II v1.13c 中，玩家与变形单位的动画动作帧长与动作触发帧由 `AnimData.d2` 中的记录决定：

1. **COF 名称直接拼接 (`0x6FD93F81..0x6FD93F9A`)**：
   - 原版通过 `sprintf("%s%s%s", token, mode, wclass)`（格式串位于 `0x6FDE3428`）直接根据单位当前外形 Token、模式代码及武器类别拼出 7 字符 COF 名称。
   - 绝不存在“如果找不到就换一种武器类别（如 `HTH`、`1HS`），再找不到就换一种动作模式（如 `SCHTH`、`A1HTH`）”的多级回退链。
2. **武器类别有效集合 (`WeaponClass.txt`)**：
   - 官方有效 `wclass` 代码共 14 类：`hth`, `bow`, `1hs`, `1ht`, `stf`, `2hs`, `2ht`, `xbw`, `1js`, `1jt`, `1ss`, `1st`, `ht1`, `ht2`。
   - **`h2h` 绝非武器动画类别**：`h2h` 是 `ItemTypes.txt` 和 `Skills.txt` 中的物品类型代码；刺客单爪动画类别为 `ht1`，双爪动画类别为 `ht2`。
3. **真实 `AnimData.d2` 记录比对**：
   - `AIA1HT1` / `AIA1HT2`：11 帧，动画速度 208，动作帧在第 6 帧。
   - `AIA1HTH`（徒手）：11 帧，动画速度 256，动作帧在第 6 帧。爪类攻击速度低于徒手，误用 `HTH` 会导致攻速虚高 23%。
   - `AIS4HT1` / `AIS4HT2`（双龙剪 Dragon Claw）：12 帧，动画速度 208，动作帧在第 6 帧。
   - `AISCHTH`（普通施法）：17 帧，动画速度 256，动作帧在第 9 帧。若因误传 `h2h` 找不到 S4 记录而回退到 `AISCHTH`，动作完全失真。
4. **无动作事件记录的末帧触发**：
   - 对于无 `0x01` / `0x02` 标志事件的记录（例如 `40S1HTH` 16 帧、`TGS1HTH` 16 帧、`AIS3HT1` 10 帧），1.13c 动作在末帧完成判定（`framesPerDirection - 1` 或与 `GameInstance` 统一在完成时触发），绝非随意折半截取（`Math.trunc(frames / 2)`）。
5. **变形攻击延迟 (`D2Common.dll` `0x6FDA0CE0` `ShapeshiftWeaponDelay`)**：
   - 狼人（`40`）与熊人（`TG`）的攻击速度受人类形态武器基础延迟约束，按 `computeShapeshiftWeaponDelay113c` 复合计算步进速度。

## 2. Player-type start frame (`0x6FD82220`, table `0x6FDE4480`)

Mode-start init `0x6FD835F0` sets the animation position to `start << 8`, where `start = 0x6FD82220(class,
mode, wclass)`:

- Only for player-type units (players, and monsters remapped by a transform state, e.g. the Valkyrie with
  state 93 → class 0) in `A1` / `A2`.
- The weapon-class index comes from `0x6FDEF028`. An unknown class uses index 0.
- Amazon and Sorceress: `HTH` → 1; `1HS`, `1HT`, `STF`, `2HS`, `2HT` → 2. Every other class/weapon → 0.
- The action frame and the end then count from `start`: action after `ceil((event - start) * 256 / speed)`
  ticks, end after `ceil((frames - start) * 256 / speed)`.

TS: `playerAnimStartFrame113c` (`src/common/units/char-anim-speed.ts`), applied in `AnimDispatcher`
(unmorphed non-sequence A1/A2) and in NecroPet `petAttackTiming113c`. Oracle: `p52-amazon-defense` and
`p52-amazon-valkyrie` (`AMA12HT`, start 2: action +9, end +15).
