# `src/netproto` — 1.13c 权威网络协议与传输引擎 / 1.13c Authoritative Wire Protocol & Transport Engine

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`src/netproto` 是 **Diablo II: Lord of Destruction (v1.13c)** 的独立网络协议栈模块，1:1 复刻原版 `D2Net.dll`、`Bnclient.dll`、`D2MCPClient.dll` 与 `Fog.dll` 的二进制封包编解码、加密哈希、Huffman 压缩与状态机流转。

### 1. 模块职责与架构边界

- **对应原版 DLL**：
  - `Bnclient.dll`：BNCS（Battle.net Chat Server，默认 TCP `6112`）握手、CheckRevision 校验、CD-Key 哈希、XSHA-1 密码认证、账户注册（`Create New Account`）、180s `SID_NULL (0x00)` 保活与大厅聊天频道。
  - `D2MCPClient.dll`：MCP（Realm Server / `d2cs`，默认 TCP `6113`）领域登录、角色列表读取（含 11 字节 `statstring` 纸娃娃外观解析）、角色创建/删除、游戏房间创建 (`0x03`) 与加入 (`0x04`)。
  - `D2Net.dll` + `Fog.dll`：D2GS（Game Server，默认 TCP `4000`）帧头解析、动态 Huffman 解压、167 个 S2C 服务端下行指令解析、C2S 客户端上行指令编码、以及 `0x9C`/`0x9D` 物品比特流解析。
- **架构强隔离约束（`tsconfig.netproto.json`）**：
  - **零外部模块依赖**：`src/netproto` **不依赖** `src/common`、`src/client`、`src/server` 或 `src/baker`（由 `tests/arch/boundaries.test.ts` Rule 2 强制校验）。
  - **单一门面入口**：外部模块（如 `src/client`、`src/server`、`plugins/`、`tools/`）**必须且只能**通过 [`src/netproto/index.ts`](./index.ts) 导入符号，禁止跨入子目录深层路径导入（由 `tests/arch/boundaries.test.ts` Rules 6 & 9 强制守护）。

---

### 2. 目录结构

```text
src/netproto/
├── index.ts         # 模块唯一公开导出门面 (Public Facade)
├── core/            # Little-Endian BinaryReader / BinaryWriter / BitReader 及基础协议类型
├── transport/       # ByteStream 传输抽象、WebSocket 桥接流 (WsStream)、内存回环流与端点解析器
├── crypto/          # Broken SHA-1 (XSHA-1)、CheckRevision、CD-Key 解密哈希等 1.13c 加密算法
├── bncs/            # BNCS (端口 6112) 报文成帧、状态机、登录/注册/Realm 切换/大厅聊天/SID_NULL 保活协议
├── mcp/             # MCP (端口 6113) 报文成帧、角色列表 (0x19)、创建角色 (0x02)、建房/加房协议
├── d2gs/            # D2GS (端口 4000) Huffman 解压、S2C 167 操作码注册表、C2S 编码与物品 Bitstream
├── flow/            # D2OnlineFlow：串联 BNCS -> MCP -> D2GS 全链路自动重连与令牌交接编排器
├── domain/          # 协议无关领域契约：GameServerAdapter、ServerEvent、ClientCommand
└── ts/              # 预留的 TypeScript 远端服务协议适配层 (TsServerAdapter)
```

---

### 3. 核心子系统详解

#### 3.1 传输层与 WebSocket/TCP 桥接 (`transport/`)
由于浏览器无法直接发起原生 TCP 连接，而原生 PvPGN + D2GS 在消息体内嵌返回了内部 IP 与原始 TCP 端口（如 MCP 返回 D2GS IP + 端口 `4000`），`transport/endpoint.ts` 提供了可插拔的 `EndpointResolver`：
- **`createWsBridgeResolver(bridgeBaseUrl)`**：将目标端口动态映射为 Nginx + `websockify` 反向代理路径：
  - 端口 `6112` (BNCS) $\rightarrow$ `<bridgeBaseUrl>/bnet`（如 `wss://host/d2net/bnet`）
  - 端口 `6113` (MCP) $\rightarrow$ `<bridgeBaseUrl>/realm`（如 `wss://host/d2net/realm`）
  - 端口 `4000` (D2GS) $\rightarrow$ `<bridgeBaseUrl>/game`（如 `wss://host/d2net/game`）
- **`createTcpResolver()`**：供 Node.js 环境下的无头 Bot (`tools/d2-bot.ts`) 直连原生 TCP 端口。
- **`MemoryStream`**：零拷贝内存全双工字节流，供单元测试与本地闭环验证使用。

#### 3.2 BNCS 与 MCP 战网前置协议 (`crypto/`, `bncs/`, `mcp/`)
- **加密算法 (`crypto/`)**：精确实现暴雪特有的无左移循环 Broken SHA-1 (`xsha1.ts`)、基于 MPQ 版本特征码的 `CheckRevision` (`check-revision.ts`) 以及 16/26 位 D2/LoD 双 CD-Key 哈希封装。
- **全链路状态机 (`flow/online-flow.ts`)**：
  1. `BncsClient` 完成 `SID_AUTH_INFO (0x50)` $\rightarrow$ `SID_AUTH_CHECK (0x51)` $\rightarrow$ `SID_LOGONRESPONSE2 (0x3A)`（或新账户注册 `SID_CREATEACCOUNT2 0x3D`）$\rightarrow$ `SID_LOGONREALMEX (0x3E)` 获取 64 字节 MCP Cookie，并维持 180 秒 `SID_NULL (0x00)` 心跳。
  2. `McpClient` 携带 Cookie 连接 `d2cs`，执行 `MCP_STARTUP (0x01)` $\rightarrow$ `MCP_CHARLIST2 (0x19)` $\rightarrow$ `MCP_CHARLOGON (0x07)` $\rightarrow$ `MCP_CREATEGAME (0x03)` / `MCP_JOINGAME (0x04)` 获取 D2GS GameHash 与 GameToken。
  3. 自动交接至 `D2gsClient` 发起 `0x68 (D2GS_GAMELOGON)` 进入游戏世界。

#### 3.3 D2GS 游戏服协议与 Huffman 解压 (`d2gs/`)
- **报文成帧与解压 (`framer.ts`, `huffman.ts`)**：
  - 处理首包 `0xAF` 压缩协商握手。
  - 实现 `Fog.dll` 静态预置 Huffman 树比特流解码，并将单帧解压后的粘包数据依据 `packet-sizes.ts`（167 个 S2C 操作码定长/变长/回调计算表）精确切分为独立指令帧。
- **S2C 解析与领域映射 (`s2c-registry.ts`, `adapter.ts`)**：
  - 将底层二进制包（如 `0x03 LoadAct`、`0x07/0x08 MapAdd/Remove`、`0x0E SetObjectState`、`0x0F/0x10 PlayerMove`、`0x11 UnitOverlay`、`0x15 ReassignPlayer`、`0x3F UseStackableItem`、`0x51 AssignObject`、`0x58 OpenImbueUi`、`0x67..0x6D NPC Move/State`（含 `D2Client` 1.13c `s[7]` 漂移检查点）、`0x9C/0x9D ItemAction`、`0xA3 DelayedState`、`0xAC AssignNPC`、`0x18..0x1F Attribute/Orb Update` 等）无损转化为强类型的 `ServerEvent` 领域事件流。
- **C2S 指令编码与物品比特流解码 (`c2s.ts`, `item-bitstream.ts`)**：
  - 完整编码移动 (`0x01`/`0x03`)、施法 (`0x0C`/`0x0D`)、武器切换 (`0x17`)、拾取/穿戴/容器交换、右键使用卷轴/药水 (`0x20 ItemUse`)、辨识物品 (`0x27 IdentifyItem`)、NPC 赌博辨识 (`0x37 NpcIdentifyGamble`)、NPC 实体动作/恰西注入 (`0x38 EntityAction`)、位置同步 (`0x5F UpdatePlayerPos`) 等上行指令。
  - 逐比特解析 `0x9C`（地面/容器/商店物品）与 `0x9D`（穿戴/佣兵/鼠标物品）变长属性流（含 `IFLAG_DELETED`、`Save Bits` 与 `Save Add`）。

---

### 4. 常用验证命令

```bash
# 单独对 src/netproto 进行类型检查
npx tsc -p tsconfig.netproto.json --noEmit

# 运行协议编解码、Huffman 解压与边界单元测试
npx vitest run tests/netproto/

# 重放并检查 .d2cap 抓包录制文件
npx tsx tools/netproto-replay.ts <path-to-capture.d2cap>
```

---
---

<a id="english"></a>

## English

`src/netproto` is the self-contained network protocol stack for **Diablo II: Lord of Destruction (v1.13c)**, implementing a 1:1 port of the binary packet framing, cryptographic hashing, Huffman compression, and state machines from `D2Net.dll`, `Bnclient.dll`, `D2MCPClient.dll`, and `Fog.dll`.

### 1. Module Responsibilities & Architectural Boundaries

- **Original DLL Counterparts**:
  - `Bnclient.dll`: BNCS (Battle.net Chat Server, default TCP `6112`) handshake, CheckRevision verification, CD-Key hashing, XSHA-1 password authentication, account creation (`Create New Account`), 180s `SID_NULL (0x00)` keepalive, and lobby chat channels.
  - `D2MCPClient.dll`: MCP (Realm Server / `d2cs`, default TCP `6113`) realm logon, character list retrieval (with 11-byte `statstring` paperdoll decoding), character creation/deletion, and game creation (`0x03`) / join (`0x04`).
  - `D2Net.dll` + `Fog.dll`: D2GS (Game Server, default TCP `4000`) frame header parsing, dynamic Huffman decompression, 167 S2C server-to-client opcode decoders, C2S client-to-server command encoders, and `0x9C`/`0x9D` item bitstream decoding.
- **Strict Isolation Constraints (`tsconfig.netproto.json`)**:
  - **Zero External Module Dependencies**: `src/netproto` has **no dependencies** on `src/common`, `src/client`, `src/server`, or `src/baker` (enforced by `tests/arch/boundaries.test.ts` Rule 2).
  - **Single Public Facade**: External modules (`src/client`, `src/server`, `plugins/`, `tools/`) **must** import exclusively from [`src/netproto/index.ts`](./index.ts); deep imports into subdirectories are forbidden (enforced by `tests/arch/boundaries.test.ts` Rules 6 & 9).

---

### 2. Directory Structure

```text
src/netproto/
├── index.ts         # Sole public barrel export (Public Facade)
├── core/            # Little-Endian BinaryReader / BinaryWriter / BitReader and primitive wire types
├── transport/       # ByteStream abstraction, WebSocket bridge stream (WsStream), in-memory loopback stream & endpoint resolvers
├── crypto/          # Broken SHA-1 (XSHA-1), CheckRevision, CD-Key hash/shuffle & 1.13c cryptographic routines
├── bncs/            # BNCS (port 6112) framing, state machine, logon/register/realm-switch/chat/SID_NULL keepalive protocol
├── mcp/             # MCP (port 6113) framing, character list (0x19), character creation (0x02), create/join game protocol
├── d2gs/            # D2GS (port 4000) Huffman decompression, 167 S2C opcode registry, C2S encoders & item bitstreams
├── flow/            # D2OnlineFlow: end-to-end BNCS -> MCP -> D2GS token handoff and reconnection orchestrator
├── domain/          # Protocol-agnostic domain contract: GameServerAdapter, ServerEvent, ClientCommand
└── ts/              # Reserved TypeScript server protocol adapter (TsServerAdapter)
```

---

### 3. Core Subsystems

#### 3.1 Transport Layer & WebSocket/TCP Bridging (`transport/`)
Because browsers cannot open raw TCP sockets while native PvPGN + D2GS packets embed internal IP addresses and raw TCP ports (e.g., MCP returning the D2GS IP and port `4000`), `transport/endpoint.ts` provides a pluggable `EndpointResolver`:
- **`createWsBridgeResolver(bridgeBaseUrl)`**: Dynamically maps target TCP ports to Nginx + `websockify` reverse-proxy sub-paths:
  - Port `6112` (BNCS) $\rightarrow$ `<bridgeBaseUrl>/bnet` (e.g., `wss://host/d2net/bnet`)
  - Port `6113` (MCP) $\rightarrow$ `<bridgeBaseUrl>/realm` (e.g., `wss://host/d2net/realm`)
  - Port `4000` (D2GS) $\rightarrow$ `<bridgeBaseUrl>/game` (e.g., `wss://host/d2net/game`)
- **`createTcpResolver()`**: Used by the Node.js headless bot (`tools/d2-bot.ts`) to connect directly to raw TCP sockets.
- **`MemoryStream`**: Zero-copy in-memory full-duplex byte stream for unit testing and local loopback verification.

#### 3.2 BNCS & MCP Pre-Game Protocols (`crypto/`, `bncs/`, `mcp/`)
- **Cryptography (`crypto/`)**: Exact implementation of Blizzard's unrotated Broken SHA-1 (`xsha1.ts`), MPQ version-signature `CheckRevision` (`check-revision.ts`), and 16/26-character D2/LoD CD-Key hashing.
- **End-to-End Online Flow (`flow/online-flow.ts`)**:
  1. `BncsClient` executes `SID_AUTH_INFO (0x50)` $\rightarrow$ `SID_AUTH_CHECK (0x51)` $\rightarrow$ `SID_LOGONRESPONSE2 (0x3A)` (or `SID_CREATEACCOUNT2 0x3D`) $\rightarrow$ `SID_LOGONREALMEX (0x3E)` to obtain the 64-byte MCP cookie while sending 180s `SID_NULL (0x00)` heartbeats.
  2. `McpClient` connects to `d2cs` with the cookie and runs `MCP_STARTUP (0x01)` $\rightarrow$ `MCP_CHARLIST2 (0x19)` $\rightarrow$ `MCP_CHARLOGON (0x07)` $\rightarrow$ `MCP_CREATEGAME (0x03)` / `MCP_JOINGAME (0x04)` to obtain the D2GS `GameHash` and `GameToken`.
  3. Automatically hands off to `D2gsClient` (`0x68 D2GS_GAMELOGON`) to enter the game world.

#### 3.3 D2GS Game Server Protocol & Huffman Decompression (`d2gs/`)
- **Framing & Decompression (`framer.ts`, `huffman.ts`)**:
  - Handles the initial `0xAF` compression negotiation handshake.
  - Decodes `Fog.dll`'s static Huffman tree bitstream and splits coalesced decompressed payloads into individual packet frames using `packet-sizes.ts` (covering all 167 S2C opcodes).
- **S2C Decoding & Domain Mapping (`s2c-registry.ts`, `adapter.ts`)**:
  - Translates raw binary packets (`0x03 LoadAct`, `0x07/0x08 MapAdd/Remove`, `0x0E SetObjectState`, `0x0F/0x10 PlayerMove`, `0x11 UnitOverlay`, `0x15 ReassignPlayer`, `0x3F UseStackableItem`, `0x51 AssignObject`, `0x58 OpenImbueUi`, `0x67..0x6D NPC Move/State` with 1.13c `s[7]` drift-check coordinates, `0x9C/0x9D ItemAction`, `0xA3 DelayedState`, `0xAC AssignNPC`, `0x18..0x1F Attribute/Orb Update`, etc.) into strongly typed `ServerEvent` streams.
- **C2S Command Encoding & Item Bitstream Decoding (`c2s.ts`, `item-bitstream.ts`)**:
  - Encodes walk/run (`0x01`/`0x03`), skill casts (`0x0C`/`0x0D`), weapon switch (`0x17`), item pickup/equip/container moves, right-click scroll/tome/potion usage (`0x20 ItemUse`), item identification (`0x27 IdentifyItem`), gamble identification (`0x37 NpcIdentifyGamble`), NPC entity action / Charsi Imbue (`0x38 EntityAction`), position updates (`0x5F UpdatePlayerPos`), and more.
  - Bit-by-bit parser for `0x9C` (ground/container/shop items) and `0x9D` (equipped/mercenary/cursor items) variable-length stat streams (including `IFLAG_DELETED`, `Save Bits`, and `Save Add`).

---

### 4. Common Verification Commands

```bash
# Run strict typecheck on src/netproto
npx tsc -p tsconfig.netproto.json --noEmit

# Run protocol codec, Huffman decompression, and boundary unit tests
npx vitest run tests/netproto/

# Replay and inspect a recorded .d2cap packet capture
npx tsx tools/netproto-replay.ts <path-to-capture.d2cap>
```
