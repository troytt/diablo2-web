# `src/netproto` — 1.13c 权威网络协议与传输引擎 / 1.13c Authoritative Wire Protocol & Transport Engine

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/netproto` 是 **Diablo II: Lord of Destruction (v1.13c)** 的独立双向网络协议栈模块，1:1 复刻原版 `D2Net.dll`、`Bnclient.dll`、`D2MCPClient.dll` 与 `Fog.dll` 的二进制封包编解码、加密哈希、Huffman 压缩/解压与状态机流转，同时提供连接客户端 (`src/client`) 与内置服务端 (`src/server`) 的零耦合领域契约与单机钩子注册表。

### 1. 模块职责与架构边界

- **对应原版 DLL**：
  - `Bnclient.dll`：BNCS（Battle.net Chat Server，默认 TCP `6112`）握手、CheckRevision 校验、CD-Key 哈希、XSHA-1 密码认证、账户注册（`Create New Account`）、180s `SID_NULL (0x00)` 保活与大厅聊天频道。
  - `D2MCPClient.dll`：MCP（Realm Server / `d2cs`，默认 TCP `6113`）领域登录、角色列表读取（含 11 字节 `statstring` 纸娃娃外观解析）、角色创建/删除、游戏房间创建 (`0x03`) 与加入 (`0x04`)。
  - `D2Net.dll` + `Fog.dll`：D2GS（Game Server，默认 TCP `4000`）双向成帧、动态 Huffman 压缩与解压、客户端全部 167 个 S2C 操作码解析、服务端全部 44 种 `ServerEvent` 到 S2C 报文的精确编码 (`s2c-encoder.ts`)、C2S 上行指令编解码，以及 `0x9C`/`0x9D` 物品比特流双向编解码。
- **架构强隔离约束（`tsconfig.netproto.json`）**：
  - **零外部模块依赖**：`src/netproto` **不依赖** `src/common`、`src/client`、`src/server` 或 `src/baker`（由 `tests/arch/boundaries.test.ts` Rule 2 强制校验）。
  - **单一门面入口**：外部模块（如 `src/client`、`src/server`、`plugins/`、`tools/`）**必须且只能**通过 [`src/netproto/index.ts`](./index.ts) 导入符号，禁止跨入子目录深层路径导入（由 `tests/arch/boundaries.test.ts` Rules 6 & 9 强制守护）。

---

### 2. 目录结构

```text
src/netproto/
├── index.ts         # 模块唯一公开导出门面 (Public Facade)
├── core/            # Little-Endian ByteReader / ByteWriter / BitReader / BitWriter、GBK/UTF-8 编码器及基础协议类型
├── transport/       # ByteStream 传输抽象、WebSocket 桥接流 (WsStream)、内存回环流 (MemoryStream) 与端点解析器
├── crypto/          # Broken SHA-1 (XSHA-1)、CheckRevision、CD-Key 解密哈希等 1.13c 加密算法
├── bncs/            # BNCS (端口 6112) 报文成帧、状态机、登录/注册/Realm 切换/大厅聊天/SID_NULL 保活协议
├── mcp/             # MCP (端口 6113) 报文成帧、角色列表 (0x19)、创建角色 (0x02)、建房/加房协议
├── d2gs/            # D2GS (端口 4000) Huffman 编解码、167 个 S2C 解码注册表、44 种 ServerEvent S2C 编码器 (s2c-encoder.ts)、C2S 成帧/编码与物品 Bitstream
├── flow/            # D2OnlineFlow：串联 BNCS -> MCP -> D2GS 全链路自动重连与令牌交接编排器
├── domain/          # 协议无关领域契约：GameServerAdapter、ServerEvent、ClientCommand、LobbyProvider 与单机钩子注册表 (lobby.ts)
└── ts/              # 定长帧头 JSON 传输适配层 (TsFramer / TsServerAdapter，供 MultiClientRoomHost 与集成测试双协议复用)
```

---

### 3. 核心子系统详解

#### 3.1 传输层与 WebSocket/TCP 桥接 (`transport/`, `domain/lobby.ts`)
由于浏览器无法直接发起原生 TCP 连接，而原生 PvPGN + D2GS 在消息体内嵌返回了内部 IP 与原始 TCP 端口（如 MCP 返回 D2GS IP + 端口 `4000`），`transport/endpoint.ts` 提供了可插拔的 `EndpointResolver`：
- **`createWsBridgeResolver(bridgeBaseUrl)`**：将目标端口动态映射为 Nginx + `websockify` 反向代理路径：
  - 端口 `6112` (BNCS) $\rightarrow$ `<bridgeBaseUrl>/bnet`（如 `wss://host/d2net/bnet`）
  - 端口 `6113` (MCP) $\rightarrow$ `<bridgeBaseUrl>/realm`（如 `wss://host/d2net/realm`）
  - 端口 `4000` (D2GS) $\rightarrow$ `<bridgeBaseUrl>/game`（如 `wss://host/d2net/game`）
- **`createTcpResolver()`**：供 Node.js 环境下的无头 Bot (`tools/d2-bot.ts`) 直连原生 TCP 端口。
- **`MemoryStream` & 单机解耦注册表 (`domain/lobby.ts`)**：提供零拷贝内存全双工字节流，以及 `registerLocalLobbyProvider` / `registerLocalServerFactory` 注册点，允许 `play.html` 通过外部加载 `src/server/loopback-adapter.ts` 注入内置单机回环适配器，同时保持 `src/client` 与 `src/server` 零直接导入。

#### 3.2 BNCS 与 MCP 战网前置协议 (`crypto/`, `bncs/`, `mcp/`)
- **加密算法 (`crypto/`)**：精确实现暴雪特有的无左移循环 Broken SHA-1 (`xsha1.ts`)、基于 MPQ 版本特征码的 `CheckRevision` (`check-revision.ts`) 以及 16/26 位 D2/LoD 双 CD-Key 哈希封装。
- **全链路状态机 (`flow/online-flow.ts`)**：
  1. `BncsClient` 完成 `SID_AUTH_INFO (0x50)` $\rightarrow$ `SID_AUTH_CHECK (0x51)` $\rightarrow$ `SID_LOGONRESPONSE2 (0x3A)`（或新账户注册 `SID_CREATEACCOUNT2 0x3D`）$\rightarrow$ `SID_LOGONREALMEX (0x3E)` 获取 64 字节 MCP Cookie，并维持 180 秒 `SID_NULL (0x00)` 心跳。
  2. `McpClient` 携带 Cookie 连接 `d2cs`，执行 `MCP_STARTUP (0x01)` $\rightarrow$ `MCP_CHARLIST2 (0x19)` $\rightarrow$ `MCP_CHARLOGON (0x07)` $\rightarrow$ `MCP_CREATEGAME (0x03)` / `MCP_JOINGAME (0x04)` 获取 D2GS GameHash 与 GameToken。
  3. 自动交接至 `D2gsClient` 发起 `0x68 (D2GS_GAMELOGON)` 进入游戏世界。

#### 3.3 D2GS 游戏服双向协议与 Huffman 压缩/解压 (`d2gs/`)
- **双向报文成帧与 Huffman 编解码 (`framing-s2c.ts`, `framing-c2s.ts`, `tables/huffman.ts`)**：
  - 处理首包未压缩 `[0xAF, 0x01]` 压缩协商握手。
  - 实现 `Fog.dll` 静态预置 Huffman 树比特流解压与服务端压缩打包 (`encodeD2gsCompressedPackets`)，并依据 `s2c-sizes.ts`（全部 167 个 S2C 操作码定长/变长表）与 C2S 变长表（`D2Net.dll` `0x6FBF65D0`）精确切分粘包帧。
- **客户端 S2C 解析与服务端 S2C 编码 (`s2c-registry.ts`, `s2c-encoder.ts`)**：
  - 客户端侧将全部 167 个底层 S2C 二进制包（`0x03 LoadAct`、`0x07/0x08 MapAdd/Remove`、`0x0E SetObjectState`、`0x0F/0x10 PlayerMove`、`0x11 UnitOverlay`、`0x15 ReassignPlayer`、`0x18..0x1F Attribute/Orb Update`、`0x3F UseStackableItem`、`0x51 AssignObject`、`0x58 OpenUi`、`0x61 PlayCinematic`、`0x67..0x6D NPC Move/State`、`0x77..0x79 PlayerTrade`、`0x8B..0x8D Party/Relation`、`0x9C/0x9D ItemAction`、`0xA3 DelayedState`、`0xAC AssignNPC` 等）无损转化为强类型 `ServerEvent`。
  - 服务端侧 `serverEventToS2cPackets`（`d2gs/s2c-encoder.ts`）将内置服务端产出的**全部 44 种 `ServerEvent` 变体**精确编码回原生 1.13c D2GS S2C 字节流（零 `[0x04]` 占位兜底），供 `MultiClientRoomHost` / `RoomClientSession` 直接驱动标准 D2GS 客户端。
- **C2S 指令编解码与物品比特流 (`c2s/`, `items/item-bitstream.ts`)**：
  - 完整编码移动 (`0x01`/`0x03`)、施法 (`0x05..0x11`)、单位交互 (`0x13`)、拾取/穿戴/容器交换、右键使用卷轴/药水 (`0x20`)、镶嵌 (`0x28`)、NPC 买卖/修理/赌博/注入/打孔/刻名 (`0x2F..0x38`)、赫拉迪姆杖孔洞确认 (`0x44`)、小站传送 (`0x49`)、UI/交易/储物箱/方块按钮 (`0x4F`)、组队与敌对 (`0x5D`/`0x5E`)、武器切换 (`0x60`) 等全部上行指令。
  - 双向逐比特解析与编码 `0x9C` / `0x9D` 变长物品属性流（严格处理 `(raw - SaveAdd) << ValShift`、`compactItem === 1` 清零魔法前后缀、链式属性跟随项与 `IFLAG_DELETED`）。

---

### 4. 常用验证命令

```bash
# 单独对 src/netproto 进行类型检查
npx tsc -p tsconfig.netproto.json --noEmit

# 运行协议编解码、Huffman 双向压缩解压与边界单元测试
npx vitest run tests/netproto/

# 重放并检查 .d2cap 抓包录制文件
npx tsx tools/netproto-replay.ts <path-to-capture.d2cap>
```

---
---

<a id="english"></a>

## English

`src/netproto` is the self-contained bidirectional network protocol stack for **Diablo II: Lord of Destruction (v1.13c)**, implementing a 1:1 port of the binary packet framing, cryptographic hashing, Huffman compression/decompression, and state machines from `D2Net.dll`, `Bnclient.dll`, `D2MCPClient.dll`, and `Fog.dll`, alongside zero-coupling domain contracts and local loopback hooks shared between `src/client` and `src/server`.

### 1. Module Responsibilities & Architectural Boundaries

- **Original DLL Counterparts**:
  - `Bnclient.dll`: BNCS (Battle.net Chat Server, default TCP `6112`) handshake, CheckRevision verification, CD-Key hashing, XSHA-1 password authentication, account creation (`Create New Account`), 180s `SID_NULL (0x00)` keepalive, and lobby chat channels.
  - `D2MCPClient.dll`: MCP (Realm Server / `d2cs`, default TCP `6113`) realm logon, character list retrieval (with 11-byte `statstring` paperdoll decoding), character creation/deletion, and game creation (`0x03`) / join (`0x04`).
  - `D2Net.dll` + `Fog.dll`: D2GS (Game Server, default TCP `4000`) bidirectional frame parsing, dynamic Huffman compression & decompression, 167 S2C opcode decoders, exhaustive 44-variant `ServerEvent`-to-S2C encoding (`s2c-encoder.ts`), C2S command codecs, and bidirectional `0x9C`/`0x9D` item bitstreams.
- **Strict Isolation Constraints (`tsconfig.netproto.json`)**:
  - **Zero External Module Dependencies**: `src/netproto` has **no dependencies** on `src/common`, `src/client`, `src/server`, or `src/baker` (enforced by `tests/arch/boundaries.test.ts` Rule 2).
  - **Single Public Facade**: External modules (`src/client`, `src/server`, `plugins/`, `tools/`) **must** import exclusively from [`src/netproto/index.ts`](./index.ts); deep imports into subdirectories are forbidden (enforced by `tests/arch/boundaries.test.ts` Rules 6 & 9).

---

### 2. Directory Structure

```text
src/netproto/
├── index.ts         # Sole public barrel export (Public Facade)
├── core/            # Little-Endian ByteReader / ByteWriter / BitReader / BitWriter, GBK/UTF-8 text codecs & primitive wire types
├── transport/       # ByteStream abstraction, WebSocket bridge stream (WsStream), in-memory loopback stream (MemoryStream) & endpoint resolvers
├── crypto/          # Broken SHA-1 (XSHA-1), CheckRevision, CD-Key hash/shuffle & 1.13c cryptographic routines
├── bncs/            # BNCS (port 6112) framing, state machine, logon/register/realm-switch/chat/SID_NULL keepalive protocol
├── mcp/             # MCP (port 6113) framing, character list (0x19), character creation (0x02), create/join game protocol
├── d2gs/            # D2GS (port 4000) Huffman codec, 167 S2C opcode registry, 44-variant ServerEvent S2C encoder (s2c-encoder.ts), C2S framer/encoders & item bitstreams
├── flow/            # D2OnlineFlow: end-to-end BNCS -> MCP -> D2GS token handoff and reconnection orchestrator
├── domain/          # Protocol-agnostic domain contracts: GameServerAdapter, ServerEvent, ClientCommand, LobbyProvider & local server hook registry (lobby.ts)
└── ts/              # Length-prefixed JSON wire transport adapter (TsFramer / TsServerAdapter used alongside binary D2GS by MultiClientRoomHost & tests)
```

---

### 3. Core Subsystems

#### 3.1 Transport Layer, WebSocket/TCP Bridging & Local Hooks (`transport/`, `domain/lobby.ts`)
Because browsers cannot open raw TCP sockets while native PvPGN + D2GS packets embed internal IP addresses and raw TCP ports (e.g., MCP returning the D2GS IP and port `4000`), `transport/endpoint.ts` provides a pluggable `EndpointResolver`:
- **`createWsBridgeResolver(bridgeBaseUrl)`**: Dynamically maps target TCP ports to Nginx + `websockify` reverse-proxy sub-paths:
  - Port `6112` (BNCS) $\rightarrow$ `<bridgeBaseUrl>/bnet` (e.g., `wss://host/d2net/bnet`)
  - Port `6113` (MCP) $\rightarrow$ `<bridgeBaseUrl>/realm` (e.g., `wss://host/d2net/realm`)
  - Port `4000` (D2GS) $\rightarrow$ `<bridgeBaseUrl>/game` (e.g., `wss://host/d2net/game`)
- **`createTcpResolver()`**: Used by the Node.js headless bot (`tools/d2-bot.ts`) to connect directly to raw TCP sockets.
- **`MemoryStream` & Local Loopback Hook Registry (`domain/lobby.ts`)**: Provides zero-copy full-duplex in-memory byte streams plus `registerLocalLobbyProvider` / `registerLocalServerFactory` hooks so `play.html` can wire `src/server/loopback-adapter.ts` without any `src/client` $\rightarrow$ `src/server` import.

#### 3.2 BNCS & MCP Pre-Game Protocols (`crypto/`, `bncs/`, `mcp/`)
- **Cryptography (`crypto/`)**: Exact implementation of Blizzard's unrotated Broken SHA-1 (`xsha1.ts`), MPQ version-signature `CheckRevision` (`check-revision.ts`), and 16/26-character D2/LoD CD-Key hashing.
- **End-to-End Online Flow (`flow/online-flow.ts`)**:
  1. `BncsClient` executes `SID_AUTH_INFO (0x50)` $\rightarrow$ `SID_AUTH_CHECK (0x51)` $\rightarrow$ `SID_LOGONRESPONSE2 (0x3A)` (or `SID_CREATEACCOUNT2 0x3D`) $\rightarrow$ `SID_LOGONREALMEX (0x3E)` to obtain the 64-byte MCP cookie while sending 180s `SID_NULL (0x00)` heartbeats.
  2. `McpClient` connects to `d2cs` with the cookie and runs `MCP_STARTUP (0x01)` $\rightarrow$ `MCP_CHARLIST2 (0x19)` $\rightarrow$ `MCP_CHARLOGON (0x07)` $\rightarrow$ `MCP_CREATEGAME (0x03)` / `MCP_JOINGAME (0x04)` to obtain the D2GS `GameHash` and `GameToken`.
  3. Automatically hands off to `D2gsClient` (`0x68 D2GS_GAMELOGON`) to enter the game world.

#### 3.3 Bidirectional D2GS Protocol & Huffman Codec (`d2gs/`)
- **Framing, Compression & Decompression (`framing-s2c.ts`, `framing-c2s.ts`, `tables/huffman.ts`)**:
  - Handles the initial uncompressed `[0xAF, 0x01]` compression greeting.
  - Decodes and encodes `Fog.dll`'s static Huffman bitstream (`encodeD2gsCompressedPackets`) and splits coalesced payloads into individual frames via `s2c-sizes.ts` (all 167 S2C opcodes) and the C2S variable-length resolver (`D2Net.dll` `0x6FBF65D0`).
- **Client S2C Decoding & Server S2C Encoding (`s2c-registry.ts`, `s2c-encoder.ts`)**:
  - On the client side, translates all 167 S2C opcodes (`0x03 LoadAct`, `0x07/0x08 MapAdd/Remove`, `0x0E SetObjectState`, `0x0F/0x10 PlayerMove`, `0x11 UnitOverlay`, `0x15 ReassignPlayer`, `0x18..0x1F Attribute/Orb Update`, `0x3F UseStackableItem`, `0x51 AssignObject`, `0x58 OpenUi`, `0x61 PlayCinematic`, `0x67..0x6D NPC Move/State`, `0x77..0x79 PlayerTrade`, `0x8B..0x8D Party/Relation`, `0x9C/0x9D ItemAction`, `0xA3 DelayedState`, `0xAC AssignNPC`, etc.) into strongly typed `ServerEvent` streams.
  - On the server side, `serverEventToS2cPackets` (`d2gs/s2c-encoder.ts`) exhaustively encodes **all 44 `ServerEvent` variants** into authentic 1.13c D2GS S2C wire packets (with zero `[0x04]` dummy fallbacks) so `MultiClientRoomHost` / `RoomClientSession` can drive standard D2GS clients directly.
- **C2S Command Codec & Item Bitstreams (`c2s/`, `items/item-bitstream.ts`)**:
  - Encodes walk/run (`0x01`/`0x03`), skill casts (`0x05..0x11`), unit interactions (`0x13`), item pickup/equip/container moves, right-click scroll/tome/potion usage (`0x20`), socketing (`0x28`), NPC buy/sell/repair/gamble/imbue/socket/personalize (`0x2F..0x38`), Horadric Orifice confirm (`0x44`), waypoint travel (`0x49`), UI/trade/stash/cube buttons (`0x4F`), party/hostility (`0x5D`/`0x5E`), weapon switch (`0x60`), and more.
  - Bidirectionally decodes and encodes `0x9C` and `0x9D` variable-length item stat bitstreams (honoring `(raw - SaveAdd) << ValShift`, explicit zeroing of `magicPrefixId/magicSuffixId` when `compactItem === 1`, chained stat followers, and `IFLAG_DELETED`).

---

### 4. Common Verification Commands

```bash
# Run strict typecheck on src/netproto
npx tsc -p tsconfig.netproto.json --noEmit

# Run protocol codec, bidirectional Huffman, and boundary unit tests
npx vitest run tests/netproto/

# Replay and inspect a recorded .d2cap packet capture
npx tsx tools/netproto-replay.ts <path-to-capture.d2cap>
```
