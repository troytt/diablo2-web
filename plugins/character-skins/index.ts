/**
 * Character Skins Plugin (`plugins/character-skins/index.ts`).
 *
 * Non-1.13c opt-in cosmetic character skin plugin:
 * - Default disabled (`defaultEnabled: false`): zero network requests and zero GPU memory when off.
 * - Built-in Necromancer (`ne`) -> Kel'Thuzad (Archlich) with Scourge summons, keeping Kel'Thuzad's
 *   appearance even when wearing full Trang-Oul's Avatar (`morphPolicy: 'keep-skin'`).
 * - Built-in Warcraft III heroes for the other six classes (Jaina, Sylvanas, Arthas, Grom,
 *   Malfurion, Maiev), without summon replacements.
 * - Supports importing custom `.d2skin.zip` skin packages into browser IndexedDB across all 7 classes.
 * - Disabling the plugin immediately releases all skin claims and restores 100% vanilla 1.13c graphics.
 */

import {
  type CharacterSkinMorphPolicy,
  type CharacterSkinScope,
  type D2WebPlugin,
  type PluginContext,
  type PluginInstance,
  type PluginStatus,
} from '../../src/client/plugin-host/api.ts'

/**
 * Classes with built-in skins: plugin setting key, the default built-in skin id, and any other
 * built-in skins offered for the class (every id is also a value of the setting).
 */
const BUILTIN_CLASS_SKINS: readonly {
  readonly cls: 'am' | 'so' | 'ne' | 'pa' | 'ba' | 'dz' | 'ai'
  readonly settingKey: string
  readonly skinId: string
  readonly otherSkinIds: readonly string[]
}[] = [
  { cls: 'ne', settingKey: 'neSkin', skinId: 'ne-wow-undead', otherSkinIds: ['ne-kelthuzad'] },
  { cls: 'so', settingKey: 'soSkin', skinId: 'so-wow-human-mage', otherSkinIds: ['so-jaina'] },
  { cls: 'am', settingKey: 'amSkin', skinId: 'am-wow-bloodelf', otherSkinIds: ['am-sylvanas'] },
  { cls: 'pa', settingKey: 'paSkin', skinId: 'pa-wow-dwarf', otherSkinIds: ['pa-arthas'] },
  { cls: 'ba', settingKey: 'baSkin', skinId: 'ba-wow-orc', otherSkinIds: ['ba-grom'] },
  { cls: 'dz', settingKey: 'dzSkin', skinId: 'dz-wow-nightelf', otherSkinIds: ['dz-malfurion'] },
  { cls: 'ai', settingKey: 'aiSkin', skinId: 'ai-wow-draenei', otherSkinIds: ['ai-maiev'] },
]

const isBuiltinSkinOf = (entry: (typeof BUILTIN_CLASS_SKINS)[number], id: string): boolean =>
  id === entry.skinId || entry.otherSkinIds.includes(id)

export function createCharacterSkinsPlugin(): D2WebPlugin {
  return {
    id: 'character-skins',
    name: {
      zh: '职业外观皮肤',
      en: 'Character Skins',
    },
    description: {
      zh: '非 1.13c 外观增强：将指定职业替换为高清真彩 RGBA 精灵皮肤（内置死灵法师 → 巫妖克尔苏加德整套天灾军团皮肤：含食尸鬼、亡灵巫师、岩石傀儡、憎恶、血肉傀儡、地狱火召唤物与专属头像，穿塔格奥套装亦保持巫妖外观；其余六个职业各内置一个魔兽争霸3英雄：法师吉安娜、亚马逊希尔瓦娜斯、圣骑士阿尔萨斯、野蛮人格罗姆、德鲁伊玛法里奥、刺客玛维），并支持本地导入 .d2skin.zip 皮肤包。关闭插件立即恢复 1.13c 原版外观。',
      en: "Non-1.13c cosmetic skins: replaces class & summon sprites with true-color RGBA + additive glow skin packs (includes Necromancer -> Kel'Thuzad + Warcraft III Scourge summon set & HUD portraits, keeping Lich visuals even with Trang-Oul's set; the other six classes each get a Warcraft III hero: Jaina, Sylvanas, Arthas, Grom, Malfurion, Maiev) and supports local .d2skin.zip packages. Disabling restores 1.13c vanilla.",
    },
    defaultEnabled: false,
    settings: [
      {
        kind: 'select',
        key: 'neSkin',
        label: {
          zh: '死灵法师外观',
          en: 'Necromancer Skin',
        },
        default: 'ne-wow-undead',
        options: [
          {
            value: 'ne-wow-undead',
            label: { zh: '亡灵死灵法师（随装备换装）', en: 'Undead Necromancer (follows equipment)' },
          },
          {
            value: 'ne-kelthuzad',
            label: { zh: '巫妖克尔苏加德（含天灾军团召唤物）', en: "Kel'Thuzad + Scourge Summons" },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'soSkin',
        label: {
          zh: '法师外观',
          en: 'Sorceress Skin',
        },
        default: 'so-wow-human-mage',
        options: [
          {
            value: 'so-wow-human-mage',
            label: { zh: '人类女法师（随装备换装）', en: 'Human Mage (follows equipment)' },
          },
          {
            value: 'so-jaina',
            label: { zh: '吉安娜·普罗德摩尔', en: 'Jaina Proudmoore' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'amSkin',
        label: {
          zh: '亚马逊外观',
          en: 'Amazon Skin',
        },
        default: 'am-wow-bloodelf',
        options: [
          {
            value: 'am-wow-bloodelf',
            label: { zh: '血精灵游侠（随装备换装）', en: 'Blood Elf Ranger (follows equipment)' },
          },
          {
            value: 'am-sylvanas',
            label: { zh: '黑暗游侠希尔瓦娜斯', en: 'Sylvanas (Dark Ranger)' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'paSkin',
        label: {
          zh: '圣骑士外观',
          en: 'Paladin Skin',
        },
        default: 'pa-wow-dwarf',
        options: [
          {
            value: 'pa-wow-dwarf',
            label: { zh: '矮人圣骑士（随装备换装）', en: 'Dwarf Paladin (follows equipment)' },
          },
          {
            value: 'pa-arthas',
            label: { zh: '阿尔萨斯王子', en: 'Arthas (Paladin)' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'baSkin',
        label: {
          zh: '野蛮人外观',
          en: 'Barbarian Skin',
        },
        default: 'ba-wow-orc',
        options: [
          {
            value: 'ba-wow-orc',
            label: { zh: '兽人战士（随装备换装，可双持）', en: 'Orc Warrior (follows equipment, dual wield)' },
          },
          {
            value: 'ba-grom',
            label: { zh: '格罗姆·地狱咆哮', en: 'Grom Hellscream' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'dzSkin',
        label: {
          zh: '德鲁伊外观',
          en: 'Druid Skin',
        },
        default: 'dz-wow-nightelf',
        options: [
          {
            value: 'dz-wow-nightelf',
            label: { zh: '暗夜精灵德鲁伊（随装备换装，变身狼人 / 熊人）', en: 'Night Elf Druid (follows equipment, worgen / furbolg forms)' },
          },
          {
            value: 'dz-malfurion',
            label: { zh: '玛法里奥·怒风', en: 'Malfurion Stormrage' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'aiSkin',
        label: {
          zh: '刺客外观',
          en: 'Assassin Skin',
        },
        default: 'ai-wow-draenei',
        options: [
          {
            value: 'ai-wow-draenei',
            label: { zh: '德莱尼刺客（随装备换装，可双持）', en: 'Draenei Assassin (follows equipment, dual wield)' },
          },
          {
            value: 'ai-maiev',
            label: { zh: '守望者玛维', en: 'Maiev Shadowsong (Warden)' },
          },
          {
            value: 'none',
            label: { zh: '原版 1.13c 外观', en: 'Vanilla 1.13c' },
          },
        ],
      },
      {
        kind: 'boolean',
        key: 'minionsEnabled',
        label: {
          zh: '召唤物跟随皮肤替换（食尸鬼/岩石傀儡/憎恶/地狱火等）',
          en: 'Replace Summoned Minions & Portraits',
        },
        default: true,
      },
      {
        kind: 'select',
        key: 'scope',
        label: {
          zh: '生效范围',
          en: 'Apply To',
        },
        default: 'self',
        options: [
          {
            value: 'self',
            label: { zh: '仅自己角色', en: 'My Character Only' },
          },
          {
            value: 'class',
            label: { zh: '同职业所有玩家', en: 'All Players of Same Class' },
          },
        ],
      },
      {
        kind: 'select',
        key: 'morphPolicy',
        label: {
          zh: '套装/技能变身时（如塔格奥）',
          en: 'When Morphed (e.g. Trang-Oul)',
        },
        default: 'keep-skin',
        options: [
          {
            value: 'keep-skin',
            label: { zh: '保持皮肤外观（不变身）', en: 'Keep Skin Appearance' },
          },
          {
            value: 'vanilla-morph',
            label: { zh: '显示原版变身外观', en: 'Show Vanilla Morph' },
          },
        ],
      },
    ],
    actions: [
      {
        kind: 'button',
        id: 'manage-skins',
        label: {
          zh: '导入 / 管理自定义皮肤 (.d2skin.zip)',
          en: 'Import / Manage Custom Skins (.d2skin.zip)',
        },
        run(ctx: PluginContext): void {
          ctx.characterSkins.openManagerModal()
        },
      },
    ],
    activate(ctx: PluginContext): PluginInstance {
      const readScope = (): CharacterSkinScope =>
        ctx.settings.get('scope') === 'class' ? 'class' : 'self'

      const readMorphPolicy = (): CharacterSkinMorphPolicy =>
        ctx.settings.get('morphPolicy') === 'vanilla-morph' ? 'vanilla-morph' : 'keep-skin'

      const readMinionsEnabled = (): boolean => ctx.settings.get('minionsEnabled') !== false

      const readSkinSetting = (settingKey: string, builtinId: string): string | null => {
        const raw = String(ctx.settings.get(settingKey) ?? builtinId)
        return raw === 'none' || raw === '' ? null : raw
      }

      let syncingFromService = false

      const applyFromSettings = (): void => {
        const currentSelected = ctx.characterSkins.getConfig().selectedByClass
        const selected: Record<string, string | null | undefined> = { ...currentSelected }
        for (const entry of BUILTIN_CLASS_SKINS) {
          const { cls, settingKey, skinId } = entry
          const current = currentSelected[cls]
          const wanted = readSkinSetting(settingKey, skinId)
          // Preserve a custom imported skin for the class if one is already active and the setting is not 'none'.
          selected[cls] =
            wanted === null ? null : current && !isBuiltinSkinOf(entry, current) && wanted === skinId ? current : wanted
        }
        ctx.characterSkins.setConfig({
          enabled: true,
          scope: readScope(),
          morphPolicy: readMorphPolicy(),
          minionsEnabled: readMinionsEnabled(),
          selectedByClass: selected,
        })
      }

      applyFromSettings()
      void ctx.characterSkins.ensureCatalogLoaded()

      const unsubSettings = ctx.settings.subscribe((key) => {
        if (syncingFromService) return
        const classSkin = BUILTIN_CLASS_SKINS.find((entry) => entry.settingKey === key)
        if (classSkin) {
          ctx.characterSkins.setConfig({
            selectedByClass: {
              ...ctx.characterSkins.getConfig().selectedByClass,
              [classSkin.cls]: readSkinSetting(classSkin.settingKey, classSkin.skinId),
            },
          })
          ctx.notifyStatusChanged()
        } else if (key === 'scope' || key === 'morphPolicy' || key === 'minionsEnabled') {
          ctx.characterSkins.setConfig({
            scope: readScope(),
            morphPolicy: readMorphPolicy(),
            minionsEnabled: readMinionsEnabled(),
          })
          ctx.notifyStatusChanged()
        }
      })

      const unsubService = ctx.characterSkins.subscribe(() => {
        const cfg = ctx.characterSkins.getConfig()
        for (const entry of BUILTIN_CLASS_SKINS) {
          const { cls, settingKey } = entry
          const activeId = cfg.selectedByClass[cls] ?? null
          const targetSettingVal = activeId === null ? 'none' : activeId
          if (
            ctx.settings.get(settingKey) !== targetSettingVal &&
            (activeId === null || isBuiltinSkinOf(entry, activeId))
          ) {
            syncingFromService = true
            try {
              ctx.settings.set(settingKey, targetSettingVal)
            } finally {
              syncingFromService = false
            }
          }
        }
        ctx.notifyStatusChanged()
      })

      const getStatus = (): PluginStatus => {
        const cfg = ctx.characterSkins.getConfig()
        const catalog = ctx.characterSkins.getCatalog()
        const activeZh: string[] = []
        const activeEn: string[] = []
        for (const [cls, skinId] of Object.entries(cfg.selectedByClass)) {
          if (!skinId) continue
          const found = catalog.find((e) => e.id === skinId)
          activeZh.push(found ? found.name.zh : `${cls.toUpperCase()}:${skinId}`)
          activeEn.push(found ? found.name.en : `${cls.toUpperCase()}:${skinId}`)
        }
        if (activeZh.length === 0) {
          return {
            level: 'ok',
            text: {
              zh: '已开启（当前全部为原版外观）',
              en: 'Active (All classes set to Vanilla)',
            },
          }
        }
        return {
          level: 'ok',
          text: {
            zh: `已启用：${activeZh.join(' / ')}`,
            en: `Active: ${activeEn.join(', ')}`,
          },
        }
      }

      return {
        getStatus,
        deactivate(): void {
          unsubSettings()
          unsubService()
          ctx.characterSkins.resetToVanilla()
        },
      }
    },
  }
}

export const characterSkinsPlugin: D2WebPlugin = createCharacterSkinsPlugin()
export default characterSkinsPlugin
