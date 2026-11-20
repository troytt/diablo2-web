/**
 * Character Skins Plugin (`plugins/character-skins/index.ts`).
 *
 * Non-1.13c opt-in cosmetic character skin plugin:
 * - Default disabled (`defaultEnabled: false`): zero network requests and zero GPU memory when off.
 * - Built-in Necromancer (`ne`) -> Kel'Thuzad (Archlich) true-color RGBA + additive glow skin,
 *   keeping Kel'Thuzad's appearance even when wearing full Trang-Oul's Avatar (`morphPolicy: 'keep-skin'`).
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

export function createCharacterSkinsPlugin(): D2WebPlugin {
  return {
    id: 'character-skins',
    name: {
      zh: '职业外观皮肤',
      en: 'Character Skins',
    },
    description: {
      zh: '非 1.13c 外观增强：将指定职业替换为高清真彩 RGBA 精灵皮肤（内置死灵法师 → 巫妖克尔苏加德整套天灾军团皮肤：含食尸鬼、亡灵巫师、憎恶、血肉憎恶、地穴领主、地狱火召唤物与专属头像，穿塔格奥套装亦保持巫妖外观），并支持本地导入 .d2skin.zip 皮肤包。关闭插件立即恢复 1.13c 原版外观。',
      en: "Non-1.13c cosmetic skins: replaces class & summon sprites with true-color RGBA + additive glow skin packs (includes Necromancer -> Kel'Thuzad + Warcraft III Scourge summon set & HUD portraits, keeping Lich visuals even with Trang-Oul's set) and supports local .d2skin.zip packages. Disabling restores 1.13c vanilla.",
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
        default: 'ne-kelthuzad',
        options: [
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
        kind: 'boolean',
        key: 'minionsEnabled',
        label: {
          zh: '召唤物跟随皮肤替换（食尸鬼/憎恶/地穴领主/地狱火等）',
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

      const readNeSkinSetting = (): string | null => {
        const raw = String(ctx.settings.get('neSkin') ?? 'ne-kelthuzad')
        return raw === 'none' || raw === '' ? null : raw
      }

      let syncingFromService = false

      const applyFromSettings = (): void => {
        const currentSelected = ctx.characterSkins.getConfig().selectedByClass
        const currentNe = currentSelected.ne
        const settingNe = readNeSkinSetting()
        // Preserve a custom imported 'ne' skin ID if one is already active and neSkin != 'none'
        const effectiveNe =
          settingNe === null
            ? null
            : currentNe && currentNe !== 'ne-kelthuzad' && settingNe === 'ne-kelthuzad'
              ? currentNe
              : settingNe
        ctx.characterSkins.setConfig({
          enabled: true,
          scope: readScope(),
          morphPolicy: readMorphPolicy(),
          minionsEnabled: readMinionsEnabled(),
          selectedByClass: {
            ...currentSelected,
            ne: effectiveNe,
          },
        })
      }

      applyFromSettings()
      void ctx.characterSkins.ensureCatalogLoaded()

      const unsubSettings = ctx.settings.subscribe((key) => {
        if (syncingFromService) return
        if (key === 'neSkin') {
          const raw = String(ctx.settings.get('neSkin') ?? 'ne-kelthuzad')
          ctx.characterSkins.setConfig({
            selectedByClass: {
              ...ctx.characterSkins.getConfig().selectedByClass,
              ne: raw === 'none' || raw === '' ? null : raw,
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
        const neId = cfg.selectedByClass.ne ?? null
        const targetSettingVal = neId === null ? 'none' : 'ne-kelthuzad'
        if (ctx.settings.get('neSkin') !== targetSettingVal && (neId === null || neId === 'ne-kelthuzad')) {
          syncingFromService = true
          try {
            ctx.settings.set('neSkin', targetSettingVal)
          } finally {
            syncingFromService = false
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
