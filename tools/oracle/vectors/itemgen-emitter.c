/*
 * Milestone 33 [K2] Exit-Gate D2TV Binary Vector Emitter: ITEMGEN
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll, D2Lang.dll,
 * D2Common.dll @ 0x6FD50000, D2Net.dll, D2Game.dll @ 0x6FC20000) and MPQ
 * data tables (D2Common.#10943), then executes real D2Game.dll / D2Common.dll
 * item generation, quality/affix rolling, ethereal bonus, and socket rolling
 * across 1,200 vectors:
 *
 *   1. D2Game:0x6FC2E860   ITEMS_InitBaseWeaponDamageStats
 *   2. D2Game:0x6FC2F700   ITEMS_RollBaseDefense
 *   3. D2Game:0x6FC34AF0   ITEMS_RollLowQualityDispatcher (0x6FC33E60 / 0x6FC337F0)
 *   4. D2Game:0x6FC340B0   ITEMS_RollSuperiorQuality
 *   5. D2Game:0x6FC303C0   ITEMS_RollMagicQuality (0x6FC344D0 / 0x6FC348A0)
 *   6. D2Game:0x6FC354F0   ITEMS_RollRareQualityDispatcher (0x6FC35240 / 0x6FC34F20)
 *   7. D2Game:0x6FC2EBB0   ITEMS_RollEthereal (D2Common:0x6FD96A40)
 *   8. D2Game:0x6FC2EC90   ITEMS_RollSockets (D2Common:0x6FD7A480)
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

#define D2COM_PREF_BASE  0x6FD50000u
#define D2GAME_PREF_BASE 0x6FC20000u
#define ITEMGEN_COUNT    1200u
#define ITEMGEN_SEED     0x33334954454D474Eull

#pragma pack(push, 1)
typedef struct {
  /* Inputs (16 bytes, +0..+15) */
  uint32_t initSeedLo;      /* +0 */
  uint32_t initSeedHi;      /* +4 */
  uint16_t itemId;          /* +8  (0..total_items-1) */
  uint8_t  ilvl;            /* +10 (1..99) */
  uint8_t  quality;         /* +11 (1=Low, 2=Normal, 3=Superior, 4=Magic, 6=Rare) */
  uint8_t  difficulty;      /* +12 (0..2) */
  uint8_t  dropFlags;       /* +13 (bit0=allowSockets, bit1=forceSockets, bit2=forceEthereal) */
  uint16_t itemFormat;      /* +14 (100=Expansion, 0=Classic) */

  /* Outputs from real 1.13c DLL calls (48 bytes, +16..+63) */
  uint32_t itemFlags;       /* +16 (pItemData->dwCommandFlags: 0x10=Identified, 0x800=Socketed, 0x400000=Ethereal) */
  int32_t  fileIndex;       /* +20 (pItemData->dwItemCell: Low/Superior index or -1) */
  uint16_t magicPrefix[3];  /* +24..+29 (pItemData->wMagicPrefix[0..2]) */
  uint16_t magicSuffix[3];  /* +30..+35 (pItemData->wMagicSuffix[0..2]) */
  uint16_t rarePrefix;      /* +36 (pItemData->wRarePrefix) */
  uint16_t rareSuffix;      /* +38 (pItemData->wRareSuffix) */
  int16_t  defense;         /* +40 (STAT_ARMORCLASS = 31) */
  int16_t  durability;      /* +42 (STAT_DURABILITY = 72) */
  int16_t  maxDurability;   /* +44 (STAT_MAXDURABILITY = 73) */
  int16_t  minDamage;       /* +46 (STAT_MINDAMAGE = 21) */
  int16_t  maxDamage;       /* +48 (STAT_MAXDAMAGE = 22) */
  int16_t  secMinDamage;    /* +50 (STAT_SECONDARY_MINDAMAGE = 23) */
  int16_t  secMaxDamage;    /* +52 (STAT_SECONDARY_MAXDAMAGE = 24) */
  uint8_t  finalQuality;    /* +54 (pItemData->dwQuality) */
  uint8_t  sockets;         /* +55 (STAT_ITEM_NUMSOCKETS = 194) */
  uint32_t outSeedLo;       /* +56 (pItemData->pSeed.lo ^ pUnit->pSeed.lo) */
  uint32_t outSeedHi;       /* +60 (pItemData->pSeed.hi ^ pUnit->pSeed.hi) */
} ItemGenVectorRecord;
#pragma pack(pop)

typedef char ItemGenSizeCheck[(sizeof(ItemGenVectorRecord) == 64) ? 1 : -1];

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *D2Common_InitTables_t)(int, int, int);

typedef uint8_t *(__stdcall *D2Common_GetItemsTxt_t)(int32_t itemId);
typedef int32_t(__stdcall *D2Common_CheckItemTypeId_t)(void *pItem, int32_t nItemType);
typedef int32_t(__stdcall *D2Common_CanLoseDurability_t)(void *pItem);
typedef void *(__stdcall *D2Common_AllocStatList_t)(void *pMemPool, uint32_t dwFlags, uint32_t dwTimeout, int32_t nUnitType, int32_t nUnitGUID);
typedef void(__stdcall *D2Common_SetUnitStat_t)(void *pUnit, int32_t nStatId, int32_t nValue, int32_t nLayer);
typedef int32_t(__stdcall *D2Common_GetUnitBaseStat_t)(void *pUnit, int32_t nStatId, int32_t nLayer);

typedef int32_t(__stdcall *D2Game_RollBaseDefense_t)(void *pItem);
typedef int32_t(__stdcall *D2Game_RollSuperiorQuality_t)(void *pItem, void *pGame);
typedef int32_t(__stdcall *D2Game_RollMagicQuality_t)(void **ppItem, void *pDrop);

static uintptr_t g_game_rebase = 0;
static uintptr_t g_com_rebase = 0;
static HMODULE g_hGame = NULL;
static HMODULE g_hCom = NULL;
static uint32_t g_cur_idx = 0;

static void write_u32(uint8_t *buf, size_t off, uint32_t v) {
  *(uint32_t *)(buf + off) = v;
}

static void write_u16(uint8_t *buf, size_t off, uint16_t v) {
  *(uint16_t *)(buf + off) = v;
}

static uint32_t read_u32(const uint8_t *buf, size_t off) {
  return *(const uint32_t *)(buf + off);
}

static uint16_t read_u16(const uint8_t *buf, size_t off) {
  return *(const uint16_t *)(buf + off);
}

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
  uintptr_t gameCanon = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (eip - g_game_rebase)
                            : 0;
  uintptr_t comCanon = (g_hCom && eip >= (uintptr_t)g_hCom && eip < (uintptr_t)g_hCom + 0xA0000u)
                           ? (eip - g_com_rebase)
                           : 0;
  CONTEXT *c = ep->ContextRecord;
  fprintf(stderr,
          "[itemgen-emitter] CRASH idx=%u code=0x%08lx eip=%p (gameVA=0x%08lx comVA=0x%08lx) "
          "addr=%p EAX=%08lx ECX=%08lx EDX=%08lx EBX=%08lx ESI=%08lx EDI=%08lx\n",
          g_cur_idx,
          (unsigned long)ep->ExceptionRecord->ExceptionCode,
          (void *)eip, (unsigned long)gameCanon, (unsigned long)comCanon,
          (void *)ep->ExceptionRecord->ExceptionInformation[1],
          (unsigned long)c->Eax, (unsigned long)c->Ecx, (unsigned long)c->Edx,
          (unsigned long)c->Ebx, (unsigned long)c->Esi, (unsigned long)c->Edi);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 99);
  return EXCEPTION_EXECUTE_HANDLER;
}

/*
 * Hook for D2Common:0x6FD960B0 (`ITEMS_ApplyItemQualityMods`, 6 args, `ret 0x18`)
 * so Superior / Magic / Rare quality rollers record their exact chosen indices and
 * prefix/suffix IDs without mutating base stats with random affix properties.
 */
static int32_t __stdcall hook_ITEMS_ApplyItemQualityMods(
    int32_t a1, int32_t a2, int32_t a3, int32_t a4, int32_t a5, int32_t a6) {
  (void)a1; (void)a2; (void)a3; (void)a4; (void)a5; (void)a6;
  return 1;
}

static void install_jmp_hook(uintptr_t target_va, void *hook_fn) {
  DWORD old_prot = 0;
  uint8_t *p = (uint8_t *)target_va;
  VirtualProtect(p, 8, PAGE_EXECUTE_READWRITE, &old_prot);
  p[0] = 0xE9; /* JMP rel32 */
  int32_t rel = (int32_t)((uintptr_t)hook_fn - (target_va + 5));
  memcpy(p + 1, &rel, 4);
}

/*
 * D2Game.dll custom-convention function wrappers:
 *
 * 1) 0x6FC2E860 (`ITEMS_InitBaseWeaponDamageStats`):
 *    Custom calling convention: `edi = pItem`, `ret`
 */
static __attribute__((noinline)) void call_D2Game_SetBaseWeaponDamageStats(void *pItem) {
  uintptr_t fn = 0x6FC2E860u + g_game_rebase;
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+D"(pItem), "+c"(fn)
    :
    : "eax", "edx", "memory", "cc"
  );
}

/*
 * 2) 0x6FC34AF0 (`ITEMS_RollLowQualityDispatcher`):
 *    Custom calling convention: `eax = pItem`, `[esp+4] = pGame`, `ret 4`
 */
static __attribute__((noinline)) int32_t call_D2Game_RollLowQuality(void *pItem, void *pGame) {
  uintptr_t fn = 0x6FC34AF0u + g_game_rebase;
  int32_t result = (int32_t)(uintptr_t)pItem;
  __asm__ volatile (
    "pushl %%ecx\n\t"
    "call *%%edx\n\t"
    : "+a"(result), "+c"(pGame), "+d"(fn)
    :
    : "memory", "cc"
  );
  return result;
}

/*
 * 3) 0x6FC354F0 (`ITEMS_RollRareQualityDispatcher`):
 *    Custom calling convention: `eax = pItem`, `edi = pDrop`, `ret`
 */
static __attribute__((noinline)) int32_t call_D2Game_RollRareQuality(void *pItem, void *pDrop) {
  uintptr_t fn = 0x6FC354F0u + g_game_rebase;
  int32_t result = (int32_t)(uintptr_t)pItem;
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+a"(result), "+D"(pDrop), "+c"(fn)
    :
    : "edx", "memory", "cc"
  );
  return result;
}

/*
 * 4) 0x6FC2EBB0 (`ITEMS_RollEthereal`):
 *    Custom calling convention: `esi = pItem`, `ebx = pDrop`, `ret`
 */
static __attribute__((noinline)) void call_D2Game_RollEthereal(void *pItem, void *pDrop) {
  uintptr_t fn = 0x6FC2EBB0u + g_game_rebase;
  __asm__ volatile (
    "call *%%ecx\n\t"
    : "+S"(pItem), "+b"(pDrop), "+c"(fn)
    :
    : "eax", "edx", "memory", "cc"
  );
}

/*
 * 5) 0x6FC2EC90 (`ITEMS_RollSockets`):
 *    Custom calling convention: `edi = pItem`, `ebx = pDrop`, `[esp+4] = pGame`, `ret 4`
 */
static __attribute__((noinline)) void call_D2Game_RollSockets(void *pItem, void *pDrop, void *pGame) {
  uintptr_t fn = 0x6FC2EC90u + g_game_rebase;
  __asm__ volatile (
    "pushl %%ecx\n\t"
    "call *%%edx\n\t"
    : "+D"(pItem), "+b"(pDrop), "+c"(pGame), "+d"(fn)
    :
    : "eax", "memory", "cc"
  );
}

static int open_mpq_if_exists(SFileOpenArchive_t fnOpen, const char *name, DWORD prio, int req) {
  if (GetFileAttributesA(name) == INVALID_FILE_ATTRIBUTES) {
    if (req) {
      fprintf(stderr, "[itemgen-emitter] missing MPQ: %s\n", name);
      return 0;
    }
    return 1;
  }
  HANDLE hMpq = NULL;
  if (!fnOpen(name, prio, 0, &hMpq) || !hMpq) {
    if (!fnOpen(name, prio, 2, &hMpq) || !hMpq) {
      if (req) {
        fprintf(stderr, "[itemgen-emitter] failed to open MPQ: %s\n", name);
        return 0;
      }
    }
  }
  return 1;
}

static uint8_t __attribute__((aligned(16))) s_game[0x2000];
static uint8_t __attribute__((aligned(16))) s_item[0x200];
static uint8_t __attribute__((aligned(16))) s_item_data[0x200];
static uint8_t __attribute__((aligned(16))) s_drop[0x100];

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "itemgen-113c.d2tv";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  HMODULE hGame  = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hNet || !hGame) {
    fprintf(stderr, "[itemgen-emitter] failed to load DLLs\n");
    return 2;
  }
  if ((uintptr_t)hCom != D2COM_PREF_BASE) {
    fprintf(stderr, "[itemgen-emitter] unexpected D2Common base %p\n", (void *)hCom);
    return 3;
  }
  g_hCom = hCom;
  g_hGame = hGame;
  g_com_rebase = (uintptr_t)hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)hGame - D2GAME_PREF_BASE;

  SMemFree_t pFree = (SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  SFileOpenArchive_t pOpen =
      (SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));
  {
    IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hStorm;
    IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)hStorm + dos->e_lfanew);
    uintptr_t rb = (uintptr_t)hStorm - nt->OptionalHeader.ImageBase;
    void **pp = (void **)(0x6FC43120u + rb);
    if (*pp) {
      pFree(*pp, "itemgen-emitter.c", 1, 0);
      *pp = NULL;
    }
  }

  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218)))();
  SetUnhandledExceptionFilter(crash_filter);

  if (!open_mpq_if_exists(pOpen, "d2data.mpq", 1000, 1) ||
      !open_mpq_if_exists(pOpen, "d2char.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2sfx.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2speech.mpq", 1000, 0) ||
      !open_mpq_if_exists(pOpen, "d2exp.mpq", 3000, 1) ||
      !open_mpq_if_exists(pOpen, "Patch_D2.mpq", 5000, 1)) {
    return 4;
  }

  int isExp = ((Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227)))();
  ((D2Lang_Init_t)(void (*)(void))GetProcAddress(hLang, MAKEINTRESOURCEA(10008)))(0, NULL, isExp);
  D2Common_InitTables_t pInitTables =
      (D2Common_InitTables_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10943));
  if (!pInitTables || !pInitTables(0, 0, 0)) {
    fprintf(stderr, "[itemgen-emitter] D2Common.#10943 failed\n");
    return 5;
  }

  /* Bind D2Common thunks via D2Game IAT jump table */
  D2Common_GetItemsTxt_t pGetItemsTxt =
      (D2Common_GetItemsTxt_t)(uintptr_t)(0x6FC2A53Eu + g_game_rebase);
  D2Common_CheckItemTypeId_t pCheckItemTypeId =
      (D2Common_CheckItemTypeId_t)(uintptr_t)(0x6FC2A430u + g_game_rebase);
  D2Common_AllocStatList_t pAllocStatList =
      (D2Common_AllocStatList_t)(uintptr_t)(0x6FC2A6A0u + g_game_rebase);
  D2Common_SetUnitStat_t pSetUnitStat =
      (D2Common_SetUnitStat_t)(uintptr_t)(0x6FC2A472u + g_game_rebase);
  D2Common_GetUnitBaseStat_t pGetUnitBaseStat =
      (D2Common_GetUnitBaseStat_t)(uintptr_t)(0x6FC2A3E2u + g_game_rebase);

  /* Hook D2Common:0x6FD960B0 (`ITEMS_ApplyItemQualityMods`) */
  install_jmp_hook((uintptr_t)(0x6FD960B0u + g_com_rebase), (void *)hook_ITEMS_ApplyItemQualityMods);

  /* Patch D2Game:0x6FC33DE0 (`ITEMS_RollAutoModOrStaffMods`, ret 4) to `xor eax, eax; ret 4` */
  {
    DWORD oldProt = 0;
    uint8_t *pAutoMod = (uint8_t *)(0x6FC33DE0u + g_game_rebase);
    VirtualProtect(pAutoMod, 16, PAGE_EXECUTE_READWRITE, &oldProt);
    pAutoMod[0] = 0x31; /* xor eax, eax */
    pAutoMod[1] = 0xC0;
    pAutoMod[2] = 0xC2; /* ret 4 */
    pAutoMod[3] = 0x04;
    pAutoMod[4] = 0x00;
  }

  /* Discover valid equippable item classIds (weapons = 45, armor = 2, ring = 10, amulet = 12, charm = 13) */
  uint16_t validItems[512];
  int numValidItems = 0;
  memset(s_item, 0, sizeof(s_item));
  write_u32(s_item, 0x00, 4u);
  for (int id = 0; id < 650 && numValidItems < 512; id++) {
    uint8_t *pTxt = pGetItemsTxt(id);
    if (!pTxt) continue;
    uint8_t spawnable = pTxt[0x10E];
    if (!spawnable && id >= 306) continue;
    write_u32(s_item, 0x04, (uint32_t)id);
    if (pCheckItemTypeId(s_item, 45) || pCheckItemTypeId(s_item, 2) ||
        pCheckItemTypeId(s_item, 10) || pCheckItemTypeId(s_item, 12) ||
        pCheckItemTypeId(s_item, 13)) {
      validItems[numValidItems++] = (uint16_t)id;
    }
  }
  if (numValidItems == 0) {
    fprintf(stderr, "[itemgen-emitter] discovered 0 candidate item IDs\n");
    return 6;
  }
  fprintf(stderr, "[itemgen-emitter] discovered %d candidate item IDs\n", numValidItems);

  D2Game_RollBaseDefense_t fnRollBaseDefense =
      (D2Game_RollBaseDefense_t)(uintptr_t)(0x6FC2F700u + g_game_rebase);
  D2Game_RollSuperiorQuality_t fnRollSuperior =
      (D2Game_RollSuperiorQuality_t)(uintptr_t)(0x6FC340B0u + g_game_rebase);
  D2Game_RollMagicQuality_t fnRollMagic =
      (D2Game_RollMagicQuality_t)(uintptr_t)(0x6FC303C0u + g_game_rebase);

  ItemGenVectorRecord *records =
      (ItemGenVectorRecord *)calloc(ITEMGEN_COUNT, sizeof(ItemGenVectorRecord));
  if (!records) return 7;

  static const uint8_t kQualities[8] = { 1, 2, 3, 4, 4, 6, 6, 2 };

  for (uint32_t idx = 0; idx < ITEMGEN_COUNT; idx++) {
    g_cur_idx = idx;
    uint16_t itemId = validItems[(idx * 13u + idx / 7u) % (uint32_t)numValidItems];
    uint8_t ilvl = (uint8_t)(1u + ((idx * 17u + 5u) % 99u));
    uint8_t quality = kQualities[idx % 8u];
    uint8_t difficulty = (uint8_t)(idx % 3u);
    uint8_t dropFlags = (uint8_t)(idx % 8u); /* bit0=allowSockets, bit1=forceSockets, bit2=forceEthereal */
    uint16_t itemFormat = (idx % 11u == 0u) ? 0u : 100u;

    uint32_t initSeedLo = 0x13579BDFu + idx * 0x01010103u + (uint32_t)itemId * 0x9E3779B9u;
    uint32_t initSeedHi = 0x0000029Au + (idx * 7919u) + (uint32_t)ilvl * 31337u;
    if (initSeedLo == 0u) initSeedLo = 1u;

    uint32_t itemSeedLo = initSeedLo ^ 0xA5A5A5A5u;
    uint32_t itemSeedHi = initSeedHi ^ 0x5A5A5A5Au;
    if (itemSeedLo == 0u) itemSeedLo = 1u;

    memset(s_game, 0, sizeof(s_game));
    memset(s_item, 0, sizeof(s_item));
    memset(s_item_data, 0, sizeof(s_item_data));
    memset(s_drop, 0, sizeof(s_drop));

    /* Setup s_game */
    write_u16(s_game, 0x28, itemFormat);
    s_game[0x6D] = difficulty;
    write_u32(s_game, 0x70, (itemFormat >= 100u) ? 1u : 0u);

    /* Setup s_item (`D2UnitStrc` type 4 = UNIT_ITEM) */
    write_u32(s_item, 0x00, 4u);            /* dwUnitType = 4 (UNIT_ITEM) */
    write_u32(s_item, 0x04, itemId);        /* dwClassId = itemId */
    write_u32(s_item, 0x0C, idx + 1u);      /* dwUnitId */
    write_u32(s_item, 0x14, (uint32_t)(uintptr_t)s_item_data); /* pItemData */
    write_u32(s_item, 0x20, initSeedLo);    /* pUnit->pSeed.lo */
    write_u32(s_item, 0x24, initSeedHi);    /* pUnit->pSeed.hi */
    write_u32(s_item, 0x28, initSeedLo);    /* dwInitSeed */
    void *pItemStats = pAllocStatList(NULL, 0u, 0u, 4, (int32_t)(idx + 1u));
    *(void **)(s_item + 0x5C) = pItemStats;

    /* Setup s_item_data (`D2ItemDataStrc` 1.13c layout) */
    write_u32(s_item_data, 0x00, quality);    /* dwQuality */
    write_u32(s_item_data, 0x04, itemSeedLo); /* pItemData->pSeed.lo */
    write_u32(s_item_data, 0x08, itemSeedHi); /* pItemData->pSeed.hi */
    write_u32(s_item_data, 0x0C, initSeedLo); /* dwItemSeed */
    write_u32(s_item_data, 0x10, initSeedLo); /* dwOwnerGuid (read by 0x6FD73BC0 in 0x6FC2EC90) */
    write_u32(s_item_data, 0x14, 0u);         /* dwItemFlags */
    write_u32(s_item_data, 0x18, 0u);         /* dwCommandFlags */
    write_u32(s_item_data, 0x28, 0xFFFFFFFFu);/* dwItemCell (Low/Superior index) */
    write_u32(s_item_data, 0x2C, ilvl);       /* dwItemLevel */
    write_u16(s_item_data, 0x30, itemFormat); /* wItemFormat */

    /* Setup s_drop (`D2ItemDropStrc` 1.13c layout, size 0x84) */
    uint32_t dwDropItemFlags = 0u;
    uint32_t dwDropFlags2 = 0u;
    if ((dropFlags & 2u) != 0u) {
      dwDropItemFlags |= 0x800u;
      dwDropFlags2 |= 0x10u;
    }
    if ((dropFlags & 4u) != 0u) {
      dwDropItemFlags |= 0x400000u;
      dwDropFlags2 |= 0x04u;
    }
    write_u32(s_drop, 0x08, (uint32_t)(uintptr_t)s_game); /* pDrop->pGame */
    write_u32(s_drop, 0x0C, ilvl);                        /* pDrop->nSpawnLevel */
    write_u32(s_drop, 0x14, (uint32_t)itemId);            /* pDrop->nId */
    write_u16(s_drop, 0x2A, itemFormat);                  /* pDrop->wItemFormat */
    write_u32(s_drop, 0x30, quality);                     /* pDrop->nQuality */
    write_u32(s_drop, 0x44, dwDropItemFlags);             /* pDrop->dwItemFlagsOverride */
    write_u32(s_drop, 0x80, dwDropFlags2);                /* pDrop->dwFlags2 */

    /* 1. Base stats initialization */
    uint8_t *pItemsTxt = pGetItemsTxt(itemId);
    call_D2Game_SetBaseWeaponDamageStats(s_item);
    if (pItemsTxt && pItemsTxt[0x113] == 0u && pItemsTxt[0x112] != 0u) {
      uint8_t baseDur = pItemsTxt[0x112];
      pSetUnitStat(s_item, 73, baseDur, 0); /* STAT_MAXDURABILITY */
      pSetUnitStat(s_item, 72, baseDur, 0); /* STAT_DURABILITY */
    }
    if (pCheckItemTypeId(s_item, 2)) {
      fnRollBaseDefense(s_item);
    }

    /* 2. Quality & affix rolls via real D2Game.dll functions */
    if (quality == 1u) {
      call_D2Game_RollLowQuality(s_item, s_game);
      write_u32(s_item_data, 0x18, read_u32(s_item_data, 0x18) | 0x10u);
    } else if (quality == 2u) {
      write_u32(s_item_data, 0x18, read_u32(s_item_data, 0x18) | 0x10u);
    } else if (quality == 3u) {
      fnRollSuperior(s_item, s_game);
      write_u32(s_item_data, 0x18, read_u32(s_item_data, 0x18) | 0x10u);
    } else if (quality == 4u) {
      void *pItemPtr = s_item;
      fnRollMagic(&pItemPtr, s_drop);
    } else if (quality == 6u) {
      call_D2Game_RollRareQuality(s_item, s_drop);
    }

    /* 3. Ethereal roll (`0x6FC2EBB0`) for Expansion (`itemFormat >= 100`) */
    if (itemFormat >= 100u) {
      call_D2Game_RollEthereal(s_item, s_drop);
    }

    /* 4. Socket roll (`0x6FC2EC90`) when `(dropFlags & 1) != 0` and (`quality <= 3 || (dropFlags & 2) != 0`) */
    if ((dropFlags & 1u) != 0u && (quality <= 3u || (dropFlags & 2u) != 0u)) {
      call_D2Game_RollSockets(s_item, s_drop, s_game);
    }

    /* Record inputs & outputs */
    ItemGenVectorRecord *rec = &records[idx];
    rec->initSeedLo     = initSeedLo;
    rec->initSeedHi     = initSeedHi;
    rec->itemId         = itemId;
    rec->ilvl           = ilvl;
    rec->quality        = quality;
    rec->difficulty     = difficulty;
    rec->dropFlags      = dropFlags;
    rec->itemFormat     = itemFormat;

    rec->itemFlags      = read_u32(s_item_data, 0x18);
    rec->fileIndex      = (int32_t)read_u32(s_item_data, 0x28);
    rec->magicPrefix[0] = read_u16(s_item_data, 0x38);
    rec->magicPrefix[1] = read_u16(s_item_data, 0x3A);
    rec->magicPrefix[2] = read_u16(s_item_data, 0x3C);
    rec->magicSuffix[0] = read_u16(s_item_data, 0x3E);
    rec->magicSuffix[1] = read_u16(s_item_data, 0x40);
    rec->magicSuffix[2] = read_u16(s_item_data, 0x42);
    rec->rarePrefix     = read_u16(s_item_data, 0x32);
    rec->rareSuffix     = read_u16(s_item_data, 0x34);

    rec->defense        = (int16_t)pGetUnitBaseStat(s_item, 31, 0);
    rec->durability     = (int16_t)pGetUnitBaseStat(s_item, 72, 0);
    rec->maxDurability  = (int16_t)pGetUnitBaseStat(s_item, 73, 0);
    rec->minDamage      = (int16_t)pGetUnitBaseStat(s_item, 21, 0);
    rec->maxDamage      = (int16_t)pGetUnitBaseStat(s_item, 22, 0);
    rec->secMinDamage   = (int16_t)pGetUnitBaseStat(s_item, 23, 0);
    rec->secMaxDamage   = (int16_t)pGetUnitBaseStat(s_item, 24, 0);
    rec->finalQuality   = (uint8_t)read_u32(s_item_data, 0x00);
    rec->sockets        = (uint8_t)pGetUnitBaseStat(s_item, 194, 0);
    rec->outSeedLo      = read_u32(s_item_data, 0x04) ^ read_u32(s_item, 0x20);
    rec->outSeedHi      = read_u32(s_item_data, 0x08) ^ read_u32(s_item, 0x24);
  }

  D2TVHeader hdr;
  d2tv_init_header(&hdr, "ITEMGEN", sizeof(ItemGenVectorRecord), ITEMGEN_COUNT, ITEMGEN_SEED);

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[itemgen-emitter] failed to open %s\n", outPath);
    free(records);
    return 8;
  }
  fwrite(&hdr, sizeof(hdr), 1, fp);
  fwrite(records, sizeof(ItemGenVectorRecord), ITEMGEN_COUNT, fp);
  fclose(fp);

  fprintf(stderr, "[itemgen-emitter] wrote %u ITEMGEN records (%u bytes each) to %s\n",
          (unsigned)ITEMGEN_COUNT, (unsigned)sizeof(ItemGenVectorRecord), outPath);
  free(records);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
