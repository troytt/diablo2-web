/**
 * Built-in plugins registry (`plugins/index.ts`).
 *
 * Includes 15 gameplay & QoL plugins and the grouped searchable ModMenu
 * contributed by David-Rodden (https://github.com/David-Rodden/diablo2-browser).
 * Special thanks to David-Rodden for contributing these plugins!
 * 特别感谢 David-Rodden 贡献这 15 款实用插件与分组搜索插件菜单！
 */

import type { D2WebPlugin, MenuLayout } from '../src/client/plugin-host/api.ts'
import { autoCombatPlugin } from './auto-combat/index.ts'
import { autoGoldPickupPlugin } from './auto-gold-pickup/index.ts'
import { automapRevealPlugin } from './automap-reveal/index.ts'
import { autoPotionPlugin } from './auto-potion/index.ts'
import { beltRefillPlugin } from './belt-refill/index.ts'
import { dragInteractPlugin } from './drag-interact/index.ts'
import { dropTrackerPlugin } from './drop-tracker/index.ts'
import { experienceBarPlugin } from './experience-bar/index.ts'
import { extendedViewportsPlugin } from './extended-viewports/index.ts'
import { groundItemBeamPlugin } from './ground-item-beam/index.ts'
import { hudEnhancementsPlugin } from './hud-enhancements/index.ts'
import { itemInfoPlugin } from './item-info/index.ts'
import { killStatsPlugin } from './kill-stats/index.ts'
import { lootAlertsPlugin } from './loot-alerts/index.ts'
import { lowLifeWarningPlugin } from './low-life-warning/index.ts'
import { monsterResistsPlugin } from './monster-resists/index.ts'
import { nextGamePlugin } from './next-game/index.ts'
import { pathGuidePlugin } from './path-guide/index.ts'
import { quickCastPlugin } from './quick-cast/index.ts'
import { runTimerPlugin } from './run-timer/index.ts'
import { stashDepositAllPlugin } from './stash-deposit-all/index.ts'
import { townPortalKeyPlugin } from './town-portal-key/index.ts'
import { tradeHallPlugin } from './trade-hall/index.ts'
import { upgradeHintsPlugin } from './upgrade-hints/index.ts'

export const BUILTIN_PLUGINS: readonly D2WebPlugin[] = [
  killStatsPlugin,
  dropTrackerPlugin,
  automapRevealPlugin,
  extendedViewportsPlugin,
  hudEnhancementsPlugin,
  groundItemBeamPlugin,
  quickCastPlugin,
  nextGamePlugin,
  tradeHallPlugin,
  dragInteractPlugin,
  stashDepositAllPlugin,
  experienceBarPlugin,
  autoGoldPickupPlugin,
  autoCombatPlugin,
  autoPotionPlugin,
  beltRefillPlugin,
  townPortalKeyPlugin,
  lowLifeWarningPlugin,
  upgradeHintsPlugin,
  pathGuidePlugin,
  itemInfoPlugin,
  lootAlertsPlugin,
  monsterResistsPlugin,
  runTimerPlugin,
]

export const PLUGIN_MENU_LAYOUT: MenuLayout = {
  groupOf: {
    'auto-combat': 'combat',
    'auto-potion': 'combat',
    'belt-refill': 'combat',
    'town-portal-key': 'combat',
    'low-life-warning': 'combat',
    'quick-cast': 'combat',
    'drag-interact': 'combat',
    'monster-resists': 'combat',
    'item-info': 'loot',
    'loot-alerts': 'loot',
    'upgrade-hints': 'loot',
    'ground-item-beam': 'loot',
    'auto-gold-pickup': 'loot',
    'stash-deposit-all': 'loot',
    'path-guide': 'map',
    'automap-reveal': 'map',
    'kill-stats': 'tracking',
    'drop-tracker': 'tracking',
    'run-timer': 'tracking',
    'experience-bar': 'tracking',
    'hud-enhancements': 'interface',
    'extended-viewports': 'interface',
    'next-game': 'interface',
    'trade-hall': 'interface',
  },
  plain: {
    'path-guide': {
      description: {
        zh: '告诉你当前任务下一步去哪：地面和小地图上画出路线，会用你已有的小站，并给路上的门和任务物件描边。（作者：David-Rodden，感谢贡献！）',
        en: 'Shows where to go next for your current quest. The route is drawn on the ground and the minimap, it uses the waypoints you have, and doors and quest objects along the way get an outline. (Author: David-Rodden — Special thanks for contributing!)',
      },
    },
    'automap-reveal': {
      name: { zh: '地图全开', en: 'Map Reveal' },
      description: {
        zh: '揭开本层或整幕的小地图，放大小站图标，标出附近的怪物和神龛，还能换光照和天气。',
        en: 'Reveals the automap for this level or the whole act, makes waypoint icons easier to spot, and marks nearby monsters and shrines. You can also change the lighting and weather.',
      },
      settings: {
        mode: { zh: '揭开范围', en: 'Reveal' },
        lightingPreset: { zh: '光照', en: 'Lighting' },
        weatherOverride: { zh: '天气', en: 'Weather' },
        showMonsters: { zh: '标出附近怪物', en: 'Mark nearby monsters' },
        showShrines: { zh: '标出神龛和类型', en: 'Mark shrines and their type' },
        showWaypoints: { zh: '放大小站图标', en: 'Bigger waypoint icons' },
      },
    },
    'ground-item-beam': {
      name: { zh: '掉落光柱', en: 'Loot Beams' },
      description: {
        zh: '暗金和套装物品落地时冒出一道光柱，名字一直显示，点名字就能捡。',
        en: 'Unique and set items get a beam of light when they drop, and their names stay on screen so you can click them to pick up.',
      },
      settings: {
        showUniqueSetBeams: { zh: '暗金和套装显示光柱', en: 'Beams on unique and set items' },
        alwaysShowUniqueSetLabels: { zh: '名字一直显示', en: 'Keep their names on screen' },
      },
    },
    'hud-enhancements': {
      name: { zh: '角色面板增强', en: 'Character Sheet Extras' },
      description: {
        zh: '属性和技能点按“基础+加成”显示，悬停属性时显示再加一点的效果，悬停伤害时显示怎么算出来的，支持高级属性与符文序号。',
        en: 'Shows stats and skill points as base + bonus, what one more point in a stat gets you, how your damage numbers are worked out, plus advanced stats and rune numbers.',
      },
      settings: {
        showBasePlusBonusStats: { zh: '属性显示 基础+加成', en: 'Stats as base + bonus' },
        showStatGainTooltips: { zh: '悬停属性显示加一点的效果', en: 'What +1 point gives, on hover' },
        showBasePlusBonusSkills: { zh: '技能点显示 基础+加成', en: 'Skill points as base + bonus' },
        showWeaponDamageFormula: { zh: '悬停伤害显示算法', en: 'Damage formula on hover' },
        showAdvancedStatsButton: { zh: '角色面板显示高级属性页按钮', en: 'Advanced stats button on character sheet' },
        showRuneNumbers: { zh: '符文名称显示序号 (#1~#33)', en: 'Show rune numbers (#1~#33)' },
      },
    },
    'quick-cast': {
      name: { zh: '快捷施法', en: 'Quick Cast' },
      description: {
        zh: '按下绑定的技能快捷键时直接在鼠标处施放，而不是只切换技能。绑定方法和原版一样：按 S 打开技能列表，悬停技能后按 F1-F8。城里不能放技能、冷却等规则照旧。',
        en: 'A bound skill hotkey casts the skill at your cursor instead of only switching to it. Bind keys the usual way: press S, hover a skill, press F1-F8. Town and cooldown rules still apply.',
      },
    },
    'next-game': {
      name: { zh: '下一局 (+1)', en: 'Next Game (+1)' },
      description: {
        zh: '工具栏多一个“+1”按钮：退出当前游戏，进入房间名尾号加一的新游戏，不用回大厅，直接出现在本幕城镇。',
        en: 'Adds a +1 button to the toolbar. It leaves this game and joins the next one (same name, number plus one) without the trip back to the lobby, so you land straight in town.',
      },
    },
    'kill-stats': {
      description: {
        zh: '按账号和角色记下普通、噩梦、地狱的击杀数，首领和超级精英单独计。',
        en: 'Counts your kills per account and character on Normal, Nightmare and Hell, with bosses and super uniques counted separately.',
      },
    },
    'drop-tracker': {
      description: {
        zh: '记下掉落的每件套装、暗金和符文（r01-r33），有单独的统计页，可以导出 JSON。',
        en: 'Logs every set item, unique and rune (r01-r33) that drops, with its own stats page and a JSON export.',
      },
    },
    'extended-viewports': {
      name: { zh: '画面尺寸', en: 'Screen Size' },
      description: {
        zh: '从 PD2 的分辨率列表里选更大或更宽的画面（默认 1068×600），和工具栏里的设置是同一个。',
        en: 'Pick a bigger or wider view from the PD2 resolution list (1068×600 by default). It is the same setting as the one in the toolbar.',
      },
      settings: { viewport: { zh: '画面尺寸', en: 'View size' } },
    },
  },
}
