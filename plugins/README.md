# `plugins/` — 可拔插客户端扩展插件架构 / Pluggable Client Extension Architecture

**[简体中文](#简体中文) | [English](#english)**

---

<a id="简体中文"></a>

## 简体中文

`plugins/` 目录承载 **Diablo II: Lord of Destruction (v1.13c) Web Port** 的所有非 1.13c 原版增强插件。所有插件均位于核心 `src/` 之外，仅通过公共宿主契约（[`src/client/plugin-host/api.ts`](../src/client/plugin-host/api.ts)）访问只读会话视图（`PluginSessionView`）、受控客户端能力（`PluginClientCapabilities`）、配置存储与动态工具栏插槽，支持用户在顶部工具栏 **插件 / Plugins** 弹窗（`PluginMenu`，`[data-d2-modal-overlay="plugins"]`）中热插拔启停插件、调整插件设置项或打开独立插件看板页面。

---

### 1. 组合根与架构边界规则（`tests/arch/boundaries.test.ts`）

插件系统严格遵循核心零耦合原则，由 [`tests/arch/boundaries.test.ts`](../tests/arch/boundaries.test.ts)（Rules 1–10，零白名单例外）强制守卫：

1. **组合根（Composition Root — `play.html`）**：
   - [`play.html`](../play.html) 是唯一的客户端组合根，通过内联 `<script type="module">` 同时导入 `/src/client/main.ts` 的 `startPlayApp` 与 `/plugins/index.ts` 的 `BUILTIN_PLUGINS`，并调用 `startPlayApp({ plugins: BUILTIN_PLUGINS })`。
   - **`src/**` 对具体插件 100% 无感知**：`src/**`（含 `src/client/main.ts`）包含 **0 个** 指向 `plugins/` 的导入语句，且包含 **0 个** `'plugins/'` 或具体插件 ID（如 `'kill-stats'`、`'drop-tracker'`）的字符串字面量。
2. **Rule 7 — 根 HTML 入口与内联组合根校验**：
   - 仓库根目录唯一的 HTML 入口文件为 `play.html`。
   - `play.html` 声明本地 `D2Exocet`（`/ui/fonts/D2Exocet.ttf`）与 `D2Formal436`（`/ui/fonts/D2Formal436.ttf`）字体，且其内联 `<script type="module">` 仅导入 `['/src/client/main.ts', '/plugins/index.ts']`。
3. **Rule 9 — `plugins/` 依赖白名单、物理隔离与核心零耦合**：
   - `plugins/index.ts` 仅允许导入 `./<id>/index.ts` 与 `src/client/plugin-host/api.ts`。
   - `plugins/<id>/**` 仅允许导入：
     - 同一插件目录内部模块 `plugins/<id>/**`
     - `src/common/**`（只读 1.13c 数据表与通用解析器）
     - `src/netproto/index.ts`（协议栈唯一公共门面，严禁导入 `src/netproto/` 内部子路径）
     - `src/client/plugin-host/api.ts`（唯一允许导入的 `src/client/` 模块）
   - 严禁跨插件导入（`plugins/<a>/**` 不得导入 `plugins/<b>/**`），严禁导入 `src/client/` 内部实现（如 `world/`、`session/`、`ui/`、`render/`、`i18n/`、`settings/`）或 `src/server/**`、`src/baker/**`。
   - `plugins/**` 严禁包含任何 `node:*` 内置模块导入、严禁包含 `.test.ts` / `.spec.ts` 测试文件、严禁包含非字面量动态 `import(...)` 调用。
4. **Rule 10 — 独立插件 HTML 页面规范（`plugins/<id>/index.html`）**：
   - 每个 `plugins/<id>/index.html` 必须声明本地 `D2Exocet`（`/ui/fonts/D2Exocet.ttf`）与 `D2Formal436`（`/ui/fonts/D2Formal436.ttf`）`@font-face` 规则，且包含 **0 个** `http://` 或 `https://` 外部 URL。
   - 页面中的 `<script type="module" src="...">` 必须且只能引用本插件目录下的模块路径 `/plugins/<id>/...`。
   - `vite.config.ts` 会自动扫描所有 `plugins/<id>/index.html` 并注入 `build.rollupOptions.input['plugin-<id>']`。

---

### 2. 目录结构

```text
plugins/
├── README.md                  # 插件系统架构说明、API 契约与内置插件一览（中英双语）
├── index.ts                   # BUILTIN_PLUGINS 静态注册表（由组合根 play.html 导入并注入 startPlayApp）
├── kill-stats/                # 内置插件 1：怪物击杀统计 (id: 'kill-stats')
│   ├── index.ts               # killStatsPlugin 定义、激活/卸载生命周期、状态汇报与工具栏快捷入口管理
│   ├── index.html             # 独立击杀统计页面入口 (/plugins/kill-stats/index.html)
│   ├── page-main.ts           # 独立页面启动引导（调用 bootPluginPage(killStatsPlugin) 并捕获启动异常）
│   ├── stats-page.ts          # 独立统计页面 DOM 控制器（IndexedDB 读取、BroadcastChannel 同步、导入/导出/删除）
│   ├── kill-tracker.ts        # 实时击杀追踪器（监听 D2GS ServerEvent、严格校验角色身份并批量落盘）
│   ├── kill-stats-model.ts    # G-counter CRDT 模型、键值规范化与严格导入校验 (KillStatsImportError)
│   ├── kill-stats-store.ts    # IndexedDB ('d2web-kill-stats' v1) 存储仓库实现
│   ├── kill-stats-view.ts     # 首领/超级精英看板与怪物分类表纯视图模型构建器
│   ├── monster-kill-classes.ts# 基于 MonStats.txt (Align / killable / neverCount) 的可计数怪物分类表
│   └── stats-i18n.ts          # 统计页面中英双语词典
├── drop-tracker/              # 内置插件 2：装备与符文掉落统计 (id: 'drop-tracker', Issues #793, #802)
│   ├── index.ts               # dropTrackerPlugin 定义、实时工具栏计数徽标更新 (ToolbarContributionHandle.update) 与多语言同步
│   ├── drop-tracker.ts        # 实时地面掉落追踪器（识别绿色套装 quality=5、暗金传奇 quality=7 与符文 r01-r33）、IndexedDB 存储与 BroadcastChannel 广播
│   ├── index.html             # 独立掉落统计看板入口 (/plugins/drop-tracker/index.html)
│   └── standalone.ts          # 独立掉落统计页控制器（按品质/角色/场景筛选、搜索、JSON 导入导出与清空）
├── automap-reveal/            # 内置插件 3：小地图全图透视、雷达标记与环境/天气增强 (id: 'automap-reveal', Issues #714, #715, #789, #881)
│   └── index.ts               # 管理 automapReveal ('off' | 'level' | 'act')、lightingPreset (7 档光照预设)、weatherOverride ('off' | 'rain' | 'snow') 与附近怪物/神龛雷达标记（下拉框位于插件管理弹窗内），禁用时全部回退 1.13c 原版默认状态
├── extended-viewports/        # 内置插件 4：扩展分辨率视口 (id: 'extended-viewports', Issue #716)
│   └── index.ts               # 解锁 1024x768 / 1068x600 / 1280x720 扩展视口，禁用时仅开放 1.13c 原版 640x480 / 800x600 并自动收敛至 800x600
├── hud-enhancements/          # 内置插件 5：界面增强显示 (id: 'hud-enhancements')
│   └── index.ts               # 管理属性/技能基础+加成(x+y)、属性悬停增益提示与伤害计算公式，禁用时严格回退 1.13c 原版显示
├── quick-cast/                # 内置插件 6：快捷施法（PD2/D2R 同款，Issue #952）
│   └── index.ts               # 纯开关插件：激活时认领 quickCast 能力（CommandMapper.quickCastMode = true），原版绑定方式（按 S 技能弹窗悬停 + 可绑定技能快捷键）完全不变，但按下已绑定的快捷键不再切换技能而是直接在鼠标光标处施放（SelectSkill → SkillAt/SkillOn → SelectSkill 还原）；执行跟随绑定表而非固定键位（键位范围由 SKILL_HOTKEY_KEY_RE_113C 单点定义），禁用时自动释放认领并恢复原版按键行为
└── next-game/                 # 内置插件 7：快速下一房 (+1) (id: 'next-game')
    └── index.ts               # 在顶部工具栏提供 "+1" 按钮：点击后底层退出当前 D2GS 房间、将房间号 +1 并创建/进入新房间，同时保持游戏视口不返回大厅、不播放开门动画，视觉上直接从当前场景瞬移回当前幕城镇出生点
```

---

### 3. 插件接口契约（`src/client/plugin-host/api.ts`）

`src/client/plugin-host/api.ts` 是 `plugins/**` 唯一允许导入的 `src/client/` 模块，导出以下核心类型与函数：

```ts
export type {
  AutomapRadarConfig,
  AutomapRevealMode,
  ClientLightingPreset,
  GameLang,
  HudEnhancementsConfig,
  LightingPresetConfig,
  ViewportProfile,
  ViewportResolution,
  WeatherOverrideSetting, // 'off' | 'rain' | 'snow'（非 1.13c；'off' 即原版天气）
}

export interface LocalizedText {
  readonly zh: string
  readonly en: string
}

export type PluginSettingSpec =
  | {
      readonly kind: 'boolean'
      readonly key: string
      readonly label: LocalizedText
      readonly default: boolean
    }
  | {
      readonly kind: 'select'
      readonly key: string
      readonly label: LocalizedText
      readonly default: string
      readonly options: readonly {
        readonly value: string
        readonly label: LocalizedText
      }[]
    }

export type PluginActionSpec =
  | {
      readonly kind: 'link'
      readonly id: string
      readonly label: LocalizedText
      readonly href: string // 仅限应用内相对路径（如 'plugins/kill-stats/index.html'）
    }
  | {
      readonly kind: 'button'
      readonly id: string
      readonly label: LocalizedText
      run(ctx: PluginContext): void
    }

export interface D2WebPlugin {
  readonly id: string // kebab-case，全局唯一，必须与 plugins/<id>/ 目录名一致
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly defaultEnabled: boolean
  readonly settings?: readonly PluginSettingSpec[]
  readonly actions?: readonly PluginActionSpec[]
  activate(ctx: PluginContext): PluginInstance | Promise<PluginInstance>
}

export interface PluginInstance {
  deactivate(): void | Promise<void>
  getStatus?(): PluginStatus
}

export interface PluginStatus {
  readonly level: 'ok' | 'warn' | 'error'
  readonly text: LocalizedText
}

export type PluginSessionView = Pick<
  OnlineSession,
  'phase' | 'world' | 'loginHost' | 'getSnapshot' | 'onServerEvent' | 'onStateChange'
>

export interface ToolbarContributionPatch {
  readonly label?: LocalizedText | undefined
  readonly tooltip?: LocalizedText | undefined
}

export interface ToolbarContributionHandle {
  (): void
  readonly dispose: () => void
  readonly update?: (patch: ToolbarContributionPatch) => void
}

export interface PluginClientCapabilities {
  getAutomapReveal(): AutomapRevealMode
  setAutomapReveal(mode: AutomapRevealMode): void
  subscribeAutomapReveal(fn: (mode: AutomapRevealMode) => void): () => void
  getAutomapRadar(): AutomapRadarConfig
  setAutomapRadar(patch: Partial<AutomapRadarConfig>): void
  subscribeAutomapRadar(fn: (config: AutomapRadarConfig) => void): () => void
  getLightingPreset(): ClientLightingPreset
  setLightingPreset(preset: ClientLightingPreset): void
  subscribeLightingPreset(fn: (preset: ClientLightingPreset) => void): () => void
  getViewport(): ViewportResolution
  setViewport(viewport: ViewportResolution): void
  subscribeViewport(fn: (viewport: ViewportResolution) => void): () => void
  getAllowedViewports(): readonly ViewportResolution[]
  setAllowedViewports(resolutions: readonly ViewportResolution[]): void
  getHudEnhancements(): HudEnhancementsConfig
  setHudEnhancements(patch: Partial<HudEnhancementsConfig>): void
  subscribeHudEnhancements(fn: (config: HudEnhancementsConfig) => void): () => void
  getWeatherOverride(): WeatherOverrideSetting
  setWeatherOverride(mode: WeatherOverrideSetting): void
  subscribeWeatherOverride(fn: (mode: WeatherOverrideSetting) => void): () => void
}

export interface PluginContext {
  readonly pluginId: string
  readonly session: PluginSessionView
  readonly settings: {
    get(key: string): boolean | string
    set(key: string, value: boolean | string): void
    subscribe(fn: (key: string) => void): () => void
  }
  readonly toolbar: {
    addLink(spec: {
      id: string
      label: LocalizedText
      tooltip?: LocalizedText | undefined
      href: string
    }): ToolbarContributionHandle
    addButton(spec: {
      id: string
      label: LocalizedText
      tooltip?: LocalizedText | undefined
      onClick(): void
    }): ToolbarContributionHandle
    addSelect(spec: PluginToolbarSelectSpec): ToolbarContributionHandle
    addContribution?(spec: PluginToolbarContributionSpec): ToolbarContributionHandle
  }
  readonly client: PluginClientCapabilities
  readonly quickCast: PluginQuickCastPort // 非 1.13c：快捷施法开关（Issue #952，isEnabled / setEnabled 认领式，最后一个认领释放时回退原版）
  readonly lang: {
    get(): GameLang
    subscribe(fn: (lang: GameLang) => void): () => void
    onChange?(fn: (lang: GameLang) => void): () => void
  }
  readonly log: PluginLogger
  notifyStatusChanged(): void
}

export function validatePluginDefinition(plugin: D2WebPlugin): void
export function validatePluginRegistry(plugins: readonly D2WebPlugin[]): void
export function bootPluginPage(plugin: D2WebPlugin): PluginPageContext
```

#### 宿主生命周期与故障隔离保证（`PluginHost`）
- **启动期快速失败校验（`validatePluginRegistry`）**：校验每个插件的 kebab-case `id` 唯一性、非空双语 `name`/`description`、唯一设置项 `key`、`select` 默认值合法性以及相对路径 `link.href`（拒绝 `http://`、`https://`、`//`、`javascript:` 或 `/` 开头路径）。
- **动态工具栏文本持久化更新（`ToolbarContributionHandle.update`）**：插件通过 `toolbar.addLink` / `addButton` / `addContribution` 获取的句柄支持 `handle.update({ label, tooltip })`，宿主同步更新底层 `entry.spec` 并触发 `Toolbar.syncDom()`，确保在 `setRttMs()` 等周期性 DOM 刷新时不会丢失实时统计数字（如 `drop-tracker` 的实时掉落计数）。
- **串行化热插拔与 1.13c 原版回退（`setEnabled(id, enabled)`）**：同一插件的启停切换按序串行收敛；`deactivate` 时等待 `await instance.deactivate()`（例如 `kill-stats` 与 `drop-tracker` 会先执行 `await tracker.flushNow()` 落盘待写入数据），自动清理该插件注册的全部工具栏控件（`#d2-toolbar-plugin-slot`）及订阅，并自动将失去插件声明支撑的客户端能力回退至 1.13c 原版状态（`automapReveal -> 'off'`、`automapRadar -> { false, false }`、`lightingPreset -> 'auto'`、`allowedViewports -> ['640x480', '800x600']`、`weatherOverride -> 'off'`、`hudEnhancements -> { false, false, false, false }`）。
- **插件级异常隔离**：`activate`、`deactivate`、动作回调或订阅回调抛错/reject 时，宿主通过 `console.error` 记录堆栈、将该插件状态标记为 `level: 'error'` 并在工具栏 `#d2-toolbar-plugins-btn` 显示 `⚠`，绝不中断主游戏循环或其他插件。
- **独立页面引导（`bootPluginPage(plugin)`）**：供独立插件页面调用，自动解析语言（URL `?lang=` > `localStorage['d2web.settings.v1']` > `<html lang>`），自动同步 `<html lang>` 与 `document.title`，并通过 `storage` 事件实时同步语言与 `localStorage['d2web.plugins.v1']` 中的插件启停/设置状态。

#### 插件中英文双语统一规范（Unified Plugin i18n Specification）
1. **声明层与运行态契约（`LocalizedText`）**：插件描述符（`name`、`description`、`settings[].label`、`options[].label`、`actions[].label`）、运行态状态（`getStatus().text`）及动态工具栏句柄更新（`ToolbarContributionHandle.update({ label, tooltip })`）必须全部返回非空 `{ zh: string, en: string }`，由宿主统一校验。
2. **标准词典与插值器（`createPluginI18n` & `validatePluginI18nDictionary`）**：拥有独立页面或自定义 DOM 的插件必须在 `*-i18n.ts` 中使用 `createPluginI18n(pluginId, dict)` 定义类型安全词典 `PluginI18nDictionary<K>`，支持 `{param}` 占位符插值，并在词典创建期自动校验所有条目非空且 `en` 译文不含中文字符（`/[\u4e00-\u9fff]/`）。
3. **单一语种纯净渲染（Pure Single-Locale Rendering）**：`lang === 'zh'` 时只渲染中文名称与文案，严禁混排英文后缀（如 `(Normal)`）；`lang === 'en'` 时只渲染英文名称与文案（含 `title` 悬浮提示），严禁残留任何中文字符。
4. **全局语言开关双向同步**：插件严禁直接读写 `'d2web.settings.v1'`（由 `tests/arch/boundaries.test.ts` 强制拦截），必须统一通过运行态 `ctx.lang` 或独立页 `bootPluginPage(plugin)` 与全局中英文开关双向同步。

---

### 4. 存储键值与跨标签页通信规范

| 存储介质 / 通道 | 键名 / 标识 | 所属模块 | 用途与容错规范 |
| :--- | :--- | :--- | :--- |
| `localStorage` | `'d2web.plugins.v1'` | `PluginConfigStore` (`src/client/plugin-host/plugin-config-store.ts`) | 持久化各插件 `{ version: 1, plugins: { [id]: { enabled, settings } } }`。检测到损坏 JSON 或非法字段时：`console.error` 报警、在插件菜单展示 `#d2-plugin-menu-alert`（`role="alert"`）并在 `#d2-toolbar-plugins-btn` 显示 `⚠`，内存回退至插件声明默认值，但**绝不静默覆盖原始损坏的 `localStorage` 条目**，直至用户显式修改配置或点击 `#d2-plugin-menu-reset`（全部恢复默认）。 |
| `IndexedDB` | `'d2web-kill-stats'` (v1) | `IndexedDbKillStatsRepository` (`plugins/kill-stats/kill-stats-store.ts`) | 持久化怪物击杀统计数据，包含 `meta`（`replicaId` UUIDv4）、`characters`（按 `charKey` 索引的角色档案）与 `tallies`（按 `[replicaId, charKey, kind, difficulty, subject]` 主键存储的 G-counter 分片计数）三个 Object Store。导入/导出 JSON 格式标识为 `format: 'd2web-kill-stats'`, `version: 1`。 |
| `BroadcastChannel` | `'d2web-kill-stats'` | `KillTracker` & `KillStatsPage` (`plugins/kill-stats/`) | 每次 `KillTracker` 批量落盘或 `KillStatsPage` 导入/删除/清空成功后广播 `{ type: 'updated', at }`，触发已打开的 `/plugins/kill-stats/index.html` 标签页自动防抖刷新。 |
| `IndexedDB` | `'d2web-drop-stats'` (v1) | `IndexedDbDropStatsRepository` (`plugins/drop-tracker/drop-tracker.ts`) | 持久化地面掉落的套装（Set）、暗金（Unique）与符文（Rune `r01`–`r33`）记录，支持启动期同步水合（`hydrateSync: true`）与跨页面导入导出。 |
| `BroadcastChannel` | `'d2web-drop-stats'` | `DropTracker` & `standalone.ts` (`plugins/drop-tracker/`) | 地面掉落新增、清空或导入时跨标签页实时同步工具栏徽标计数与独立看板页（`/plugins/drop-tracker/index.html`）。 |

---

### 5. 如何新增插件（Authoring Checklist）

1. **创建插件目录与实现**：在 `plugins/<plugin-id>/index.ts` 中导出实现 `D2WebPlugin` 接口的插件对象（`id` 必须与目录名 `<plugin-id>` 完全一致）。若需独立页面，创建 `plugins/<plugin-id>/index.html`、使用 `createPluginI18n('<plugin-id>', dict)` 定义双语词典并调用 `bootPluginPage(plugin)`。
2. **注册到 `plugins/index.ts`**：在 `BUILTIN_PLUGINS` 数组中注册该插件（`vite.config.ts` 会自动发现 `plugins/<plugin-id>/index.html`）。
3. **遵循 1.13c Ground Truth 与 Fail-Fast 原则**：严禁添加宽松兜底默认值，所有依赖只允许指向 `./*`、`src/common/**`、`src/netproto/index.ts` 与 `src/client/plugin-host/api.ts`。
4. **编写测试**：在 `tests/plugins/` 下添加单元测试，并确保 `tests/plugins/registry.test.ts`（含双语词典与纯英文无 CJK 门禁）与 `tests/arch/boundaries.test.ts`（Rules 1–10）全部通过。

---

### 6. 内置插件一览

| 插件目录 | 插件 ID | 默认状态 | 说明 |
| :--- | :--- | :---: | :--- |
| [`plugins/kill-stats/`](./kill-stats) | `kill-stats` | 启用 | 怪物击杀统计插件与独立统计页面（`/plugins/kill-stats/index.html`），按 `(host, realm, account, charName, hardcore)` 追踪普通/噩梦/地狱难度下的怪物、首领与超级精英击杀数。 |
| [`plugins/drop-tracker/`](./drop-tracker) | `drop-tracker` | 启用 | 装备与符文掉落统计插件与独立看板（`/plugins/drop-tracker/index.html`），实时追踪绿色套装（`quality=5`）、暗金传奇（`quality=7`）与符文（`r01`–`r33`）地面掉落并在顶部工具栏动态更新 `掉落 绿X · 金Y · 符Z` 徽标。 |
| [`plugins/automap-reveal/`](./automap-reveal) | `automap-reveal` | 启用 | 小地图全图透视增强插件（`off / level / act`），揭示当前关卡或全幕所有非城镇瓦片与预设地标，支持显示附近怪物与神龛类型图标（Issue #881），并在插件管理弹窗内提供环境光照预设（`auto / noon / dusk / night / torch / cold / fullbright`）与天气模式（`off / rain / snow`）下拉框；禁用时强制恢复 1.13c 原版战争迷雾、昼夜光照与关卡自然天气。 |
| [`plugins/extended-viewports/`](./extended-viewports) | `extended-viewports` | 启用 | 扩展分辨率视口插件，启用时在工具栏分辨率下拉框中解锁 `1024x768`、`1068x600`、`1280x720`；禁用时仅保留 1.13c 原版 `640x480` 与 `800x600` 并自动收敛回 `800x600`。 |
| [`plugins/hud-enhancements/`](./hud-enhancements) | `hud-enhancements` | 启用 | 界面增强显示插件：支持角色属性与技能点 `基础+加成 (x+y)` 显示、人物属性面板悬停属性显示单点属性增益提示（`+x 生命`、`+y 近战伤害` 等），以及武器与人物面板伤害悬停显示计算公式；禁用时严格回退 1.13c 原版显示。 |
| [`plugins/quick-cast/`](./quick-cast) | `quick-cast` | 启用 | 快捷施法插件（Issue #952，PD2/D2R 同款）：纯开关、零配置。原版绑定方式（按 S 打开技能弹窗悬停技能 + 可绑定的技能快捷键，当前为原版 F1-F8）**完全不变**；插件开启后，按下已绑定的快捷键不再切换当前技能，而是立即在鼠标光标处施放该技能（内部按原版网络序列 `SelectSkill → 施法 → 还原` 执行），城镇禁技、施法锁定与冷却等原版门控全部保留。支持哪些按键由绑定流程决定（单点定义于 `SKILL_HOTKEY_KEY_RE_113C`），执行跟随绑定表，插件本身不限定键位。禁用插件即恢复原版切换技能行为。 |
| [`plugins/next-game/`](./next-game) | `next-game` | 启用 | 快速下一房（`+1`）插件：在顶部工具栏提供 `+1` 按钮，点击后底层自动退出当前游戏、将房间名尾号 `+1`（保留前导零与 15 字符上限）并创建/进入新房间，同时保持游戏视口不返回大厅、不播放开门动画，视觉上直接从当前场景瞬移回当前幕的城镇出生点。 |

---
---

<a id="english"></a>

## English

The `plugins/` directory hosts all non-vanilla quality-of-life extensions for the **Diablo II: Lord of Destruction (v1.13c) Web Port**. Every plugin lives outside the core `src/` tree and interacts with the client exclusively through the public host contract ([`src/client/plugin-host/api.ts`](../src/client/plugin-host/api.ts)), accessing a read-only session view (`PluginSessionView`), controlled client capabilities (`PluginClientCapabilities`), persistent settings, and dynamic toolbar slots. Users can hot-swap plugins, configure plugin settings, or open standalone plugin dashboards from the top toolbar **Plugins** modal (`PluginMenu`, `[data-d2-modal-overlay="plugins"]`).

---

### 1. Composition Root & Architectural Boundary Rules (`tests/arch/boundaries.test.ts`)

The plugin system enforces zero core coupling, guarded by [`tests/arch/boundaries.test.ts`](../tests/arch/boundaries.test.ts) (Rules 1–10, zero whitelist exceptions):

1. **Composition Root (`play.html`)**:
   - [`play.html`](../play.html) is the sole client composition root. Its inline `<script type="module">` imports `startPlayApp` from `/src/client/main.ts` and `BUILTIN_PLUGINS` from `/plugins/index.ts`, then invokes `startPlayApp({ plugins: BUILTIN_PLUGINS })`.
   - **`src/**` is 100% Plugin-Agnostic**: `src/**` (including `src/client/main.ts`) contains **zero** imports pointing to `plugins/` and **zero** string literals referencing `'plugins/'` or any specific plugin ID (such as `'kill-stats'` or `'drop-tracker'`).
2. **Rule 7 — Root HTML Entry & Inline Composition Check**:
   - `play.html` is the only HTML file in the repository root.
   - `play.html` declares local `D2Exocet` (`/ui/fonts/D2Exocet.ttf`) and `D2Formal436` (`/ui/fonts/D2Formal436.ttf`) fonts, and its inline `<script type="module">` imports exclusively `['/src/client/main.ts', '/plugins/index.ts']`.
3. **Rule 9 — `plugins/` Import Whitelist, Physical Isolation & Core Decoupling**:
   - `plugins/index.ts` may only import `./<id>/index.ts` and `src/client/plugin-host/api.ts`.
   - `plugins/<id>/**` may only import:
     - Internal modules within the same plugin directory `plugins/<id>/**`
     - `src/common/**` (read-only 1.13c data tables and format parsers)
     - `src/netproto/index.ts` (the sole public facade of the protocol stack; deep imports into `src/netproto/` are forbidden)
     - `src/client/plugin-host/api.ts` (the sole `src/client/` module accessible to plugins)
   - Cross-plugin imports (`plugins/<a>/**` importing `plugins/<b>/**`) and imports from internal `src/client/` modules (`world/`, `session/`, `ui/`, `render/`, `i18n/`, `settings/`), `src/server/**`, or `src/baker/**` are strictly forbidden.
   - `plugins/**` must contain zero `node:*` builtin imports, zero `.test.ts` / `.spec.ts` files, and zero non-literal dynamic `import(...)` calls.
4. **Rule 10 — Standalone Plugin HTML Page Policy (`plugins/<id>/index.html`)**:
   - Every `plugins/<id>/index.html` must declare local `D2Exocet` and `D2Formal436` `@font-face` rules and contain **zero** `http://` or `https://` external URLs.
   - Any `<script type="module" src="...">` tag in the page must reference only module paths under `/plugins/<id>/...`.
   - `vite.config.ts` automatically discovers all `plugins/<id>/index.html` pages and registers them under `build.rollupOptions.input['plugin-<id>']`.

---

### 2. Directory Structure

```text
plugins/
├── README.md                  # Bilingual plugin architecture guide, API contract, and built-in plugin catalog
├── index.ts                   # BUILTIN_PLUGINS static registry (imported by play.html and passed to startPlayApp)
├── kill-stats/                # Built-in Plugin 1: Monster Kill Statistics (id: 'kill-stats')
│   ├── index.ts               # killStatsPlugin descriptor, activate/deactivate lifecycle, status reporting & toolbar shortcut
│   ├── index.html             # Standalone statistics dashboard entry (/plugins/kill-stats/index.html)
│   ├── page-main.ts           # Standalone page bootstrapper (calls bootPluginPage(killStatsPlugin))
│   ├── stats-page.ts          # Standalone dashboard DOM controller (IndexedDB queries, BroadcastChannel sync, JSON import/export)
│   ├── kill-tracker.ts        # Real-time kill tracker (subscribes to D2GS ServerEvents, validates character identity, batches writes)
│   ├── kill-stats-model.ts    # G-counter CRDT model, key normalization, and fail-fast import validation (KillStatsImportError)
│   ├── kill-stats-store.ts    # IndexedDB ('d2web-kill-stats' v1) repository implementation
│   ├── kill-stats-view.ts     # Pure view-model builder for Boss/SuperUnique boards and monster class tables
│   ├── monster-kill-classes.ts# Countable monster classification derived from MonStats.txt (Align / killable / neverCount)
│   └── stats-i18n.ts          # Bilingual ZH/EN dictionary for the kill stats dashboard
├── drop-tracker/              # Built-in Plugin 2: Item & Rune Drop Tracker (id: 'drop-tracker', Issues #793, #802)
│   ├── index.ts               # dropTrackerPlugin descriptor, live toolbar badge updates (ToolbarContributionHandle.update) & i18n sync
│   ├── drop-tracker.ts        # Real-time ground drop tracker (Set quality=5, Unique quality=7, Runes r01-r33), IndexedDB & BroadcastChannel
│   ├── index.html             # Standalone drop tracker dashboard entry (/plugins/drop-tracker/index.html)
│   └── standalone.ts          # Standalone dashboard controller (filtering by quality/character/area, search, JSON export/clear)
├── automap-reveal/            # Built-in Plugin 3: Automap Reveal, Radar & Environment/Weather Overrides (id: 'automap-reveal', Issues #714, #715, #789, #881)
│   └── index.ts               # Manages automapReveal ('off' | 'level' | 'act'), lightingPreset (7 presets), weatherOverride ('off' | 'rain' | 'snow'), and nearby monster/shrine radar markers via PluginMenu dropdowns; reverts all to 1.13c defaults when disabled
├── extended-viewports/        # Built-in Plugin 4: Extended Viewport Resolutions (id: 'extended-viewports', Issue #716)
│   └── index.ts               # Unlocks 1024x768 / 1068x600 / 1280x720 viewports; restricts to native 1.13c 640x480 / 800x600 when disabled
├── hud-enhancements/          # Built-in Plugin 5: HUD Display Enhancements (id: 'hud-enhancements')
│   └── index.ts               # Manages base+bonus (x+y) stats/skills, hover stat gain tooltips & permanent globe HP/MP values; reverts to 1.13c vanilla display when disabled
├── quick-cast/                # Built-in Plugin 6: Quick Cast — cast bound skills directly on F1-F8 (PD2/D2R parity, Issue #952)
│   └── index.ts               # Toggle-only plugin: activation claims the quickCast capability (CommandMapper.quickCastMode = true); the native binding flow (S-popup hover + bindable skill hotkeys) is unchanged, but a bound hotkey press casts at the cursor (SelectSkill -> SkillAt/SkillOn -> SelectSkill restore) instead of switching skills; execution follows the binding maps rather than a fixed key range (bindable keys are defined once by SKILL_HOTKEY_KEY_RE_113C); disabling auto-releases the claim and restores vanilla key behavior
└── next-game/                 # Built-in Plugin 7: Quick Next Game (+1) (id: 'next-game')
    └── index.ts               # Adds a "+1" button to the top toolbar that exits the current D2GS room, increments the room number by +1, and creates/joins the new room in the background while keeping the in-game viewport active — visually teleporting directly from the current scene back to the current Act town
```

---

### 3. Host Lifecycle & Fault Isolation Guarantees (`PluginHost`)

- **Fail-Fast Boot Validation (`validatePluginRegistry`)**: Verifies kebab-case `id` uniqueness, non-empty bilingual `name`/`description`, unique setting `key`s, valid `select` defaults, and relative `link.href` paths (rejecting `http://`, `https://`, `//`, `javascript:`, or leading `/`).
- **Dynamic Toolbar Label Updates (`ToolbarContributionHandle.update`)**: Handles returned by `toolbar.addLink` / `addButton` / `addContribution` expose `handle.update({ label, tooltip })`, updating the underlying `entry.spec` and invoking `Toolbar.syncDom()` so dynamic counters (like `drop-tracker`'s live `Drops S:X · U:Y · R:Z` badge) persist across periodic RTT/status toolbar refreshes.
- **Serialized Hot-Swapping & 1.13c Vanilla Fallback (`setEnabled(id, enabled)`)**: Enable/disable transitions for a given plugin are serialized; `deactivate` awaits `instance.deactivate()` (flushing pending writes in `kill-stats` and `drop-tracker`), disposes all toolbar contributions and listeners registered by that plugin, and automatically resets any client capability no longer backed by an active plugin to its 1.13c vanilla default (`automapReveal -> 'off'`, `automapRadar -> { false, false }`, `lightingPreset -> 'auto'`, `allowedViewports -> ['640x480', '800x600']`, `weatherOverride -> 'off'`, `hudEnhancements -> { false, false, false, false }`).
- **Per-Plugin Fault Isolation**: Uncaught errors or promise rejections in `activate`, `deactivate`, action handlers, or subscriptions are logged via `console.error`, mark the offending plugin as `level: 'error'`, and surface a `⚠` badge on `#d2-toolbar-plugins-btn` without interrupting the main game loop or other plugins.
- **Standalone Page Bootstrapper (`bootPluginPage(plugin)`)**: Used by standalone plugin pages to resolve language preferences (URL `?lang=` > `localStorage['d2web.settings.v1']` > `<html lang>`), automatically synchronize `<html lang>` and `document.title`, and synchronize language and plugin enable/settings state across tabs via `storage` events.

#### Unified Plugin Bilingual (`zh` / `en`) i18n Specification
1. **Descriptor & Runtime Contract (`LocalizedText`)**: Every plugin descriptor field (`name`, `description`, `settings[].label`, `options[].label`, `actions[].label`), runtime `getStatus().text`, and dynamic toolbar handle update (`ToolbarContributionHandle.update({ label, tooltip })`) must provide non-empty `{ zh: string, en: string }` validated by the host.
2. **Typed Dictionary & Template Helper (`createPluginI18n` & `validatePluginI18nDictionary`)**: Standalone plugin dashboards and custom UIs define a `PluginI18nDictionary<K>` in `*-i18n.ts` via `createPluginI18n(pluginId, dict)` with `{param}` interpolation. At creation time, every entry is validated to have non-empty `zh` and `en` strings and zero CJK characters (`/[\u4e00-\u9fff]/`) in `en`.
3. **Pure Single-Locale Rendering**: When `lang === 'zh'`, render only Chinese labels/names without mixed English suffixes; when `lang === 'en'`, render only English labels/names (including `title` tooltips) with zero CJK characters.
4. **Two-Way Global Language Switch Sync**: Plugins must never directly read or write `'d2web.settings.v1'` (enforced by `tests/arch/boundaries.test.ts`), and must instead synchronize exclusively through runtime `ctx.lang` or standalone `bootPluginPage(plugin)`.

---

### 4. Storage Keys & Cross-Tab Channels

| Medium / Channel | Key / Name | Owner Module | Purpose & Fault-Tolerance Policy |
| :--- | :--- | :--- | :--- |
| `localStorage` | `'d2web.plugins.v1'` | `PluginConfigStore` (`src/client/plugin-host/plugin-config-store.ts`) | Persists `{ version: 1, plugins: { [id]: { enabled, settings } } }`. On corrupted JSON or invalid fields: logs via `console.error`, displays `#d2-plugin-menu-alert` (`role="alert"`), shows `⚠` on `#d2-toolbar-plugins-btn`, and falls back to plugin defaults in memory **without silently overwriting the raw corrupted `localStorage` entry** until the user explicitly changes a setting or clicks `#d2-plugin-menu-reset`. |
| `IndexedDB` | `'d2web-kill-stats'` (v1) | `IndexedDbKillStatsRepository` (`plugins/kill-stats/kill-stats-store.ts`) | Persists monster kill statistics across three object stores: `meta` (`replicaId` UUIDv4), `characters` (indexed by `charKey`), and `tallies` (G-counter shards keyed by `[replicaId, charKey, kind, difficulty, subject]`). JSON import/export schema: `format: 'd2web-kill-stats'`, `version: 1`. |
| `BroadcastChannel` | `'d2web-kill-stats'` | `KillTracker` & `KillStatsPage` (`plugins/kill-stats/`) | Broadcasts `{ type: 'updated', at }` after batch flushes or imports/deletes, triggering debounced live refreshes on open `/plugins/kill-stats/index.html` tabs. |
| `IndexedDB` | `'d2web-drop-stats'` (v1) | `IndexedDbDropStatsRepository` (`plugins/drop-tracker/drop-tracker.ts`) | Persists ground drop records for Set (`quality=5`), Unique (`quality=7`), and Rune (`r01`–`r33`) items with synchronous hydration support (`hydrateSync: true`) and JSON export. |
| `BroadcastChannel` | `'d2web-drop-stats'` | `DropTracker` & `standalone.ts` (`plugins/drop-tracker/`) | Synchronizes live drop counts and `/plugins/drop-tracker/index.html` dashboards across tabs whenever new drops are recorded or cleared. |

---

### 5. Authoring a New Plugin (Checklist)

1. **Create the Plugin Directory & Implementation**: Export a `D2WebPlugin` object from `plugins/<plugin-id>/index.ts` (where `id` matches `<plugin-id>`). For standalone dashboards, add `plugins/<plugin-id>/index.html`, define a typed bilingual dictionary via `createPluginI18n('<plugin-id>', dict)`, and initialize with `bootPluginPage(plugin)`.
2. **Register in `plugins/index.ts`**: Add the plugin to `BUILTIN_PLUGINS` (`vite.config.ts` automatically discovers `plugins/<plugin-id>/index.html`).
3. **Honor 1.13c Ground Truth & Fail-Fast Rules**: Never invent permissive fallback defaults; restrict imports to `./*`, `src/common/**`, `src/netproto/index.ts`, and `src/client/plugin-host/api.ts`.
4. **Add Tests**: Add unit tests under `tests/plugins/` and verify that `tests/plugins/registry.test.ts` (including bilingual dictionary and zero-CJK English gates) and `tests/arch/boundaries.test.ts` (Rules 1–10) pass.

---

### 6. Built-In Plugins Catalog

| Plugin Directory | Plugin ID | Default | Description |
| :--- | :--- | :---: | :--- |
| [`plugins/kill-stats/`](./kill-stats) | `kill-stats` | Enabled | Monster kill statistics tracker and standalone dashboard (`/plugins/kill-stats/index.html`), tracking Normal/Nightmare/Hell monster, Boss, and SuperUnique kills per `(host, realm, account, charName, hardcore)`. |
| [`plugins/drop-tracker/`](./drop-tracker) | `drop-tracker` | Enabled | Item & Rune drop tracker and standalone dashboard (`/plugins/drop-tracker/index.html`), tracking ground drops of Set items (`quality=5`), Unique items (`quality=7`), and Runes (`r01`–`r33`) in real time with a live `Drops S:X · U:Y · R:Z` toolbar badge. |
| [`plugins/automap-reveal/`](./automap-reveal) | `automap-reveal` | Enabled | Automap reveal enhancement (`off / level / act`), revealing all non-town tiles and preset landmarks for the current level or entire act, showing MapHack-style nearby monster crosshairs and shrine type icons (Issue #881), and providing environment lighting preset (`auto / noon / dusk / night / torch / cold / fullbright`) and weather mode (`off / rain / snow`) dropdowns inside the PluginMenu modal; reverts to 1.13c vanilla defaults when disabled. |
| [`plugins/extended-viewports/`](./extended-viewports) | `extended-viewports` | Enabled | Extended viewport resolution plugin unlocking `1024x768`, `1068x600`, and `1280x720` in the toolbar resolution selector; restricts to native 1.13c `640x480` and `800x600` (clamping back to `800x600`) when disabled. |
| [`plugins/hud-enhancements/`](./hud-enhancements) | `hud-enhancements` | Enabled | HUD display enhancements plugin: displays character attributes and skill points as `base+bonus (x+y)`, shows 1-point attribute gain tooltips (`+x Life`, `+y Melee Damage`, etc.) when hovering over attributes on the Character Sheet, and shows damage calculation formulas; reverts strictly to 1.13c vanilla display when disabled. |
| [`plugins/quick-cast/`](./quick-cast) | `quick-cast` | Enabled | Quick Cast plugin (Issue #952, PD2/D2R parity): a single toggle with zero configuration. The native binding flow (open the skill popup with S, hover a skill, press a bindable skill hotkey — currently the vanilla F1-F8) is completely unchanged; while enabled, pressing a bound hotkey no longer switches the active skill — it casts that skill instantly at the mouse cursor via the vanilla wire sequence `SelectSkill -> cast -> restore`, with all vanilla gates (town restrictions, cast lock, cooldown) enforced. The supported key set follows the binding flow (defined once in `SKILL_HOTKEY_KEY_RE_113C`) and execution follows the binding maps; the plugin itself fixes no key range. Disabling restores vanilla select-on-press behavior. |
| [`plugins/next-game/`](./next-game) | `next-game` | Enabled | Quick Next Game (`+1`) plugin: adds a `+1` button to the top toolbar that exits the current game, increments the room number by `+1` (preserving zero-padding and the 15-character limit), and creates/joins the new game in the background without entering the lobby or door loading screen — visually teleporting directly from the current scene back to the current Act town. |
