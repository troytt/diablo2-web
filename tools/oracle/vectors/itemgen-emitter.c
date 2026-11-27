/*
 * Milestone 33 [K2] Exit-Gate D2TV Binary Vector Emitter: ITEMGEN
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll, D2Lang.dll,
 * D2Common.dll @ 0x6FD50000, D2Net.dll, D2Game.dll @ 0x6FC20000) and MPQ
 * data tables (D2Common.#10943), then executes the UNHOOKED real 1.13c
 * item initialization, quality/affix/mod generation, and serialization
 * pipeline across 2,400 vectors (300 x all 8 qualities 1..8, ilvl 1..99,
 * Classic & Expansion, sockets & ethereal):
 *
 *   1. D2Common.#11166 (0x6FD8AF00)  STATLIST_CreateEx
 *   2. D2Game:0x6FC31070             ITEMS_InitCreatedItemStats (base stats,
 *      durability, defense, weapon damage, varGfx) -> D2Game:0x6FC30A20
 *      ITEMS_GenerateMagicOrRareAffixes covering ALL 8 qualities:
 *        - 1: Low Quality  (0x6FC34AF0 -> 0x6FC33E60 / 0x6FC337F0)
 *        - 2: Normal       (0x6FC307B0 -> 0x6FC30550 / 0x6FC30600)
 *        - 3: Superior     (0x6FC340B0)
 *        - 4: Magic        (0x6FC303C0 -> 0x6FC344D0 / 0x6FC348A0)
 *        - 5: Set          (0x6FC341E0 -> 0x6FC33C20 / 0x6FC33A30 + failed-Set 2x dur downgrade)
 *        - 6: Rare         (0x6FC354F0 -> 0x6FC35240 / 0x6FC34F20)
 *        - 7: Unique       (0x6FC2F370 + failed-Unique 3x dur downgrade)
 *        - 8: Crafted      (0x6FC34BF0)
 *      plus real D2Common:0x6FD960B0 ITEMS_ApplyItemQualityMods,
 *      D2Game:0x6FC33DE0 ITEMS_RollStaffModsOnItem,
 *      D2Game:0x6FC2EBB0 ITEMS_RollEthereal,
 *      D2Game:0x6FC2EC90 ITEMS_RollSockets, and wAutoPrefix automods.
 *   3. D2Common.#10987 (0x6FD79D00)  ITEMS_SerializeItemToBuffer
 *      (exact byte length + full 32-byte SHA-256 of the serialized bitstream).
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
#define ITEMGEN_COUNT    2400u
#define ITEMGEN_SEED     0x33334954454D474Eull

#pragma pack(push, 1)
typedef struct {
  /* Inputs (16 bytes, +0..+15) */
  uint32_t initSeedLo;          /* +0 */
  uint32_t initSeedHi;          /* +4 */
  uint16_t itemId;              /* +8  (0..total_items-1) */
  uint8_t  ilvl;                /* +10 (1..99) */
  uint8_t  quality;             /* +11 (1=Low,2=Normal,3=Superior,4=Magic,5=Set,6=Rare,7=Unique,8=Crafted) */
  uint8_t  difficulty;          /* +12 (0..2) */
  uint8_t  dropFlags;           /* +13 (bit0=allowSockets, bit1=forceSockets, bit2=forceEthereal) */
  uint16_t itemFormat;          /* +14 (100=Expansion, 0=Classic) */

  /* Outputs from real unhooked 1.13c DLL calls (84 bytes, +16..+99) */
  uint32_t itemFlags;           /* +16 (pItemData->dwCommandFlags) */
  int32_t  fileIndex;           /* +20 (pItemData->dwItemCell: Low/Superior/Set/Unique index or -1) */
  uint16_t magicPrefix[3];      /* +24..+29 (pItemData->wMagicPrefix[0..2]) */
  uint16_t magicSuffix[3];      /* +30..+35 (pItemData->wMagicSuffix[0..2]) */
  uint16_t rarePrefix;          /* +36 (pItemData->wRarePrefix) */
  uint16_t rareSuffix;          /* +38 (pItemData->wRareSuffix) */
  int16_t  defense;             /* +40 (STAT_ARMORCLASS = 31) */
  int16_t  durability;          /* +42 (STAT_DURABILITY = 72) */
  int16_t  maxDurability;       /* +44 (STAT_MAXDURABILITY = 73) */
  int16_t  minDamage;           /* +46 (STAT_MINDAMAGE = 21) */
  int16_t  maxDamage;           /* +48 (STAT_MAXDAMAGE = 22) */
  int16_t  secMinDamage;        /* +50 (STAT_SECONDARY_MINDAMAGE = 23) */
  int16_t  secMaxDamage;        /* +52 (STAT_SECONDARY_MAXDAMAGE = 24) */
  uint8_t  finalQuality;        /* +54 (pItemData->dwQuality) */
  uint8_t  sockets;             /* +55 (STAT_ITEM_NUMSOCKETS = 194) */
  uint32_t outSeedLo;           /* +56 (pItemData->pSeed.lo ^ pUnit->pSeed.lo) */
  uint32_t outSeedHi;           /* +60 (pItemData->pSeed.hi ^ pUnit->pSeed.hi) */
  uint16_t autoAffix;           /* +64 (pItemData->wAutoAffix) */
  uint16_t bitstreamBytes;      /* +66 (D2Common.#10987 serialized byte length) */
  uint8_t  bitstreamSha256[32]; /* +68..+99 (SHA-256 of D2Common.#10987 output buffer) */
} ItemGenVectorRecord;
#pragma pack(pop)

typedef char ItemGenSizeCheck[(sizeof(ItemGenVectorRecord) == 100) ? 1 : -1];

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
typedef void(__stdcall *D2Common_StatListCreateEx_t)(void *pUnit, uint32_t argFlags, void *pfOnValue, void *pGame);
typedef int32_t(__stdcall *D2Common_GetUnitBaseStat_t)(void *pUnit, int32_t nStatId, int32_t nLayer);
typedef uint32_t(__stdcall *D2Common_SerializeItem_t)(
    void *pItem, uint8_t *pOutBuf, uint32_t nMaxBytes,
    int32_t bWriteHeader, int32_t bIncludeSockets, int32_t bSimpleItemCodeOnly);

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

/* Self-contained FIPS-180-4 SHA-256 for #10987 bitstream hashing */
static uint32_t rotr32(uint32_t x, uint32_t n) {
  return (x >> n) | (x << (32u - n));
}

static void sha256_bytes(const uint8_t *data, size_t len, uint8_t out[32]) {
  static const uint32_t k[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
  };
  uint32_t h[8] = {
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
  };
  uint8_t padded[384];
  size_t total = len + 1u;
  size_t blocks = (total + 8u + 63u) / 64u;
  size_t paddedLen = blocks * 64u;
  if (paddedLen > sizeof(padded)) paddedLen = sizeof(padded);
  memset(padded, 0, paddedLen);
  if (len > 0) memcpy(padded, data, len);
  padded[len] = 0x80u;
  uint64_t bitLen = (uint64_t)len * 8ull;
  for (int b = 0; b < 8; b++) {
    padded[paddedLen - 1u - (size_t)b] = (uint8_t)(bitLen >> (b * 8));
  }
  for (size_t off = 0; off < paddedLen; off += 64u) {
    uint32_t w[64];
    for (int i = 0; i < 16; i++) {
      const uint8_t *p = padded + off + (size_t)i * 4u;
      w[i] = ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | (uint32_t)p[3];
    }
    for (int i = 16; i < 64; i++) {
      uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
      uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = h[0], b = h[1], c = h[2], d = h[3];
    uint32_t e = h[4], f = h[5], g = h[6], hh = h[7];
    for (int i = 0; i < 64; i++) {
      uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      uint32_t ch = (e & f) ^ ((~e) & g);
      uint32_t t1 = hh + S1 + ch + k[i] + w[i];
      uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
      uint32_t t2 = S0 + maj;
      hh = g; g = f; f = e; e = d + t1;
      d = c; c = b; b = a; a = t1 + t2;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d;
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  for (int i = 0; i < 8; i++) {
    out[i * 4 + 0] = (uint8_t)(h[i] >> 24);
    out[i * 4 + 1] = (uint8_t)(h[i] >> 16);
    out[i * 4 + 2] = (uint8_t)(h[i] >> 8);
    out[i * 4 + 3] = (uint8_t)(h[i]);
  }
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

typedef struct {
  void   *pGame;
  void   *pDrop;
  int32_t bGenQual;
} InitItemStatsArgs;

/*
 * D2Game:0x6FC31070 (`ITEMS_InitCreatedItemStats`):
 *   ebx = ppItem, stack(pGame, pDrop, bGenerateQualityMods), ret 0xC -> eax
 */
static __attribute__((noinline)) int32_t call_D2Game_InitCreatedItemStats(
    void **ppItem, const InitItemStatsArgs *args) {
  uintptr_t fn = 0x6FC31070u + g_game_rebase;
  int32_t ret = 0;
  __asm__ volatile (
    "pushl 8(%%edi)\n\t"
    "pushl 4(%%edi)\n\t"
    "pushl 0(%%edi)\n\t"
    "call *%%esi\n\t"
    : "=a"(ret), "+b"(ppItem)
    : "D"(args), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return ret;
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

typedef struct {
  uint16_t itemId;
  uint8_t  minLvl;
  uint8_t  isClassic;
} ItemCandidate;

static uint8_t __attribute__((aligned(16))) s_game[0x2000];
static uint8_t __attribute__((aligned(16))) s_item[0x200];
static uint8_t __attribute__((aligned(16))) s_item_data[0x200];
static uint8_t __attribute__((aligned(16))) s_static_path[0x40];
static uint8_t __attribute__((aligned(16))) s_drop[0x100];
static uint8_t __attribute__((aligned(16))) s_ser_buf[256];

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

  D2Common_GetItemsTxt_t pGetItemsTxt =
      (D2Common_GetItemsTxt_t)(uintptr_t)(0x6FC2A53Eu + g_game_rebase);
  D2Common_CheckItemTypeId_t pCheckItemTypeId =
      (D2Common_CheckItemTypeId_t)(uintptr_t)(0x6FC2A430u + g_game_rebase);
  D2Common_GetUnitBaseStat_t pGetUnitBaseStat =
      (D2Common_GetUnitBaseStat_t)(uintptr_t)(0x6FC2A3E2u + g_game_rebase);
  D2Common_StatListCreateEx_t pStatListCreateEx =
      (D2Common_StatListCreateEx_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11166));
  D2Common_SerializeItem_t pSerializeItem =
      (D2Common_SerializeItem_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10987));
  if (!pStatListCreateEx || !pSerializeItem) {
    fprintf(stderr, "[itemgen-emitter] missing D2Common.#11166 or #10987\n");
    return 5;
  }

  /* Read sgptDataTables for SetItems.txt and UniqueItems.txt discovery */
  const uint8_t *sgpt = *(const uint8_t *const *)(uintptr_t)(0x6FDE9E1Cu + g_com_rebase);
  const uint8_t *pSetItemsTxt = *(const uint8_t *const *)(sgpt + 0xC18);
  uint32_t nSetItemsCount = *(const uint32_t *)(sgpt + 0xC1C);
  const uint8_t *pUniqueItemsTxt = *(const uint8_t *const *)(sgpt + 0xC24);
  uint32_t nUniqueItemsCount = *(const uint32_t *)(sgpt + 0xC28);

  /* Discover candidate pools across weapons(45), armor(50='armo'), ring(10), amulet(12), charm(13), jewel(58) */
  ItemCandidate validAll[700];
  ItemCandidate validClassic[700];
  ItemCandidate setExp[400];
  ItemCandidate setClassic[400];
  ItemCandidate uniqExp[500];
  ItemCandidate uniqClassic[500];
  ItemCandidate craftExp[700];
  ItemCandidate craftClassic[700];
  int nValidAll = 0, nValidClassic = 0;
  int nSetExp = 0, nSetClassic = 0;
  int nUniqExp = 0, nUniqClassic = 0;
  int nCraftExp = 0, nCraftClassic = 0;

  memset(s_item, 0, sizeof(s_item));
  write_u32(s_item, 0x00, 4u);
  for (int id = 0; id < 650; id++) {
    uint8_t *pTxt = pGetItemsTxt(id);
    if (!pTxt) continue;
    uint8_t spawnable = pTxt[0x133]; /* D2ItemsTxt.nSpawnable (+0x133) */
    if (!spawnable) continue;
    uint8_t bQuest = pTxt[0x12A];    /* D2ItemsTxt.nQuest (+0x12A) */
    if (bQuest) continue;
    uint16_t wVer = read_u16(pTxt, 0xF6);
    uint8_t isCls = (wVer < 100u) ? 1u : 0u;
    uint32_t dwCode = read_u32(pTxt, 0x80);

    write_u32(s_item, 0x04, (uint32_t)id);
    int isWeapon = pCheckItemTypeId(s_item, 45);
    int isArmor  = pCheckItemTypeId(s_item, 50);
    int isRing   = pCheckItemTypeId(s_item, 10);
    int isAmulet = pCheckItemTypeId(s_item, 12);
    int isCharm  = pCheckItemTypeId(s_item, 13);
    int isJewel  = pCheckItemTypeId(s_item, 58);
    if (!isWeapon && !isArmor && !isRing && !isAmulet && !isCharm && !isJewel) continue;

    ItemCandidate base = { (uint16_t)id, 1u, isCls };
    if (nValidAll < 700) validAll[nValidAll++] = base;
    if (isCls && nValidClassic < 700) validClassic[nValidClassic++] = base;

    if (!isCharm) {
      if (nCraftExp < 700) craftExp[nCraftExp++] = base;
      if (isCls && !isJewel && nCraftClassic < 700) craftClassic[nCraftClassic++] = base;
    }

    /* Check matching SetItems.txt rows */
    int minSetExp = 1000, minSetCls = 1000;
    for (uint32_t s = 0; s < nSetItemsCount; s++) {
      const uint8_t *rec = pSetItemsTxt + s * 0x1B8u;
      if (read_u32(rec, 0x28) != dwCode) continue;
      if (read_u16(rec, 0x2C) == 0x1Du) continue; /* Cow King set needs drop flag bit0 */
      uint16_t sVer = read_u16(rec, 0x22);
      int16_t sLvl = (int16_t)read_u16(rec, 0x30);
      if (sLvl < 1) sLvl = 1;
      if (sLvl < minSetExp) minSetExp = sLvl;
      if (sVer < 100u && sLvl < minSetCls) minSetCls = sLvl;
    }
    if (minSetExp < 100 && nSetExp < 400) {
      setExp[nSetExp++] = (ItemCandidate){ (uint16_t)id, (uint8_t)minSetExp, isCls };
    }
    if (isCls && minSetCls < 100 && nSetClassic < 400) {
      setClassic[nSetClassic++] = (ItemCandidate){ (uint16_t)id, (uint8_t)minSetCls, 1u };
    }

    /* Check matching enabled UniqueItems.txt rows */
    int minUniqExp = 1000, minUniqCls = 1000;
    for (uint32_t u = 0; u < nUniqueItemsCount; u++) {
      const uint8_t *rec = pUniqueItemsTxt + u * 0x14Cu;
      if ((rec[0x2C] & 1u) == 0u) continue;
      if (read_u32(rec, 0x28) != dwCode) continue;
      uint16_t uVer = read_u16(rec, 0x24);
      int16_t uLvl = (int16_t)read_u16(rec, 0x34);
      if (uLvl < 1) uLvl = 1;
      if (uLvl < minUniqExp) minUniqExp = uLvl;
      if (uVer < 100u && uLvl < minUniqCls) minUniqCls = uLvl;
    }
    if (minUniqExp < 100 && nUniqExp < 500) {
      uniqExp[nUniqExp++] = (ItemCandidate){ (uint16_t)id, (uint8_t)minUniqExp, isCls };
    }
    if (isCls && minUniqCls < 100 && nUniqClassic < 500) {
      uniqClassic[nUniqClassic++] = (ItemCandidate){ (uint16_t)id, (uint8_t)minUniqCls, 1u };
    }
  }

  fprintf(stderr,
          "[itemgen-emitter] pools: valid=%d/%d set=%d/%d uniq=%d/%d craft=%d/%d\n",
          nValidAll, nValidClassic, nSetExp, nSetClassic, nUniqExp, nUniqClassic, nCraftExp, nCraftClassic);
  if (nValidAll == 0 || nSetExp == 0 || nUniqExp == 0 || nCraftExp == 0) {
    fprintf(stderr, "[itemgen-emitter] empty candidate pool\n");
    return 6;
  }

  ItemGenVectorRecord *records =
      (ItemGenVectorRecord *)calloc(ITEMGEN_COUNT, sizeof(ItemGenVectorRecord));
  if (!records) return 7;

  uint32_t finalQualCounts[10] = {0};

  for (uint32_t idx = 0; idx < ITEMGEN_COUNT; idx++) {
    g_cur_idx = idx;
    uint8_t quality = (uint8_t)((idx % 8u) + 1u); /* 1..8 uniformly: 300 each */
    uint32_t qRound = idx / 8u;                   /* 0..299 */
    uint8_t difficulty = (uint8_t)(idx % 3u);
    uint8_t dropFlags = (uint8_t)(qRound % 8u);   /* bit0=allowSockets, bit1=forceSockets, bit2=forceEthereal */
    uint16_t itemFormat = (qRound % 9u == 0u) ? 0u : 100u;
    uint8_t ilvl = (uint8_t)(1u + ((idx * 17u + 5u) % 99u));

    uint16_t itemId = 0;
    if (quality == 5u && (qRound % 4u != 3u)) {
      /* 75% Set vectors target Set-capable bases with sufficient ilvl -> genuine Set items */
      const ItemCandidate *pool = (itemFormat == 0u) ? setClassic : setExp;
      int nPool = (itemFormat == 0u) ? nSetClassic : nSetExp;
      const ItemCandidate *cand = &pool[(qRound * 7u + idx) % (uint32_t)nPool];
      itemId = cand->itemId;
      if (ilvl < cand->minLvl) {
        uint32_t span = 100u - (uint32_t)cand->minLvl;
        ilvl = (uint8_t)((uint32_t)cand->minLvl + (ilvl % (span > 0u ? span : 1u)));
      }
    } else if (quality == 7u && (qRound % 4u != 3u)) {
      /* 75% Unique vectors target Unique-capable bases with sufficient ilvl -> genuine Unique items */
      const ItemCandidate *pool = (itemFormat == 0u) ? uniqClassic : uniqExp;
      int nPool = (itemFormat == 0u) ? nUniqClassic : nUniqExp;
      const ItemCandidate *cand = &pool[(qRound * 11u + idx) % (uint32_t)nPool];
      itemId = cand->itemId;
      if (ilvl < cand->minLvl) {
        uint32_t span = 100u - (uint32_t)cand->minLvl;
        ilvl = (uint8_t)((uint32_t)cand->minLvl + (ilvl % (span > 0u ? span : 1u)));
      }
    } else if (quality == 8u) {
      /* Crafted vectors target rare/crafted-capable items */
      const ItemCandidate *pool = (itemFormat == 0u) ? craftClassic : craftExp;
      int nPool = (itemFormat == 0u) ? nCraftClassic : nCraftExp;
      itemId = pool[(qRound * 13u + idx) % (uint32_t)nPool].itemId;
    } else {
      const ItemCandidate *pool = (itemFormat == 0u) ? validClassic : validAll;
      int nPool = (itemFormat == 0u) ? nValidClassic : nValidAll;
      itemId = pool[(idx * 13u + idx / 7u) % (uint32_t)nPool].itemId;
    }

    uint32_t initSeedLo = 0x13579BDFu + idx * 0x01010103u + (uint32_t)itemId * 0x9E3779B9u;
    uint32_t initSeedHi = 0x0000029Au + (idx * 7919u) + (uint32_t)ilvl * 31337u;
    if (initSeedLo == 0u) initSeedLo = 1u;

    uint32_t itemSeedLo = initSeedLo ^ 0xA5A5A5A5u;
    uint32_t itemSeedHi = initSeedHi ^ 0x5A5A5A5Au;
    if (itemSeedLo == 0u) itemSeedLo = 1u;

    memset(s_game, 0, sizeof(s_game));
    memset(s_item, 0, sizeof(s_item));
    memset(s_item_data, 0, sizeof(s_item_data));
    memset(s_static_path, 0, sizeof(s_static_path));
    memset(s_drop, 0, sizeof(s_drop));

    /* Setup s_game */
    uint32_t bExp = (itemFormat >= 100u) ? 1u : 0u;
    write_u16(s_game, 0x28, itemFormat);
    s_game[0x6A] = (uint8_t)bExp;
    s_game[0x6D] = difficulty;
    write_u32(s_game, 0x70, bExp);
    write_u32(s_game, 0x74, bExp); /* ladder enabled for Expansion so ladder uniques also spawn */

    /* Setup deterministic static path for #10987 ground coords */
    write_u32(s_static_path, 0x0C, 100u);
    write_u32(s_static_path, 0x10, 200u);

    /* Setup s_item (`D2UnitStrc` type 4 = UNIT_ITEM) */
    write_u32(s_item, 0x00, 4u);                                  /* dwUnitType = 4 */
    write_u32(s_item, 0x04, itemId);                              /* dwClassId */
    write_u32(s_item, 0x0C, 1u);                                  /* dwUnitId */
    write_u32(s_item, 0x10, 3u);                                  /* dwAnimMode = IMODE_ONGROUND */
    write_u32(s_item, 0x14, (uint32_t)(uintptr_t)s_item_data);    /* pItemData */
    write_u32(s_item, 0x20, initSeedLo);                          /* pUnit->pSeed.lo */
    write_u32(s_item, 0x24, initSeedHi);                          /* pUnit->pSeed.hi */
    write_u32(s_item, 0x28, initSeedLo);                          /* dwInitSeed */
    write_u32(s_item, 0x2C, (uint32_t)(uintptr_t)s_static_path);  /* pPath */
    write_u32(s_item, 0x80, (uint32_t)(uintptr_t)s_game);         /* pGame */
    pStatListCreateEx(s_item, 0u, NULL, s_game);

    /* Setup s_item_data (`D2ItemDataStrc` 1.13c layout) */
    write_u32(s_item_data, 0x00, quality);    /* dwQuality */
    write_u32(s_item_data, 0x04, itemSeedLo); /* pItemData->pSeed.lo */
    write_u32(s_item_data, 0x08, itemSeedHi); /* pItemData->pSeed.hi */
    write_u32(s_item_data, 0x0C, initSeedLo); /* dwItemSeed */
    write_u32(s_item_data, 0x10, initSeedLo); /* dwOwnerGuid */
    write_u32(s_item_data, 0x14, 0u);         /* dwItemFlags */
    write_u32(s_item_data, 0x18, 0x80000u);   /* dwCommandFlags = ITEMCMD_INIT */
    write_u32(s_item_data, 0x28, 0xFFFFFFFFu);/* dwItemCell = -1 */
    write_u32(s_item_data, 0x2C, ilvl);       /* dwItemLevel */
    write_u16(s_item_data, 0x30, itemFormat); /* wItemFormat */
    s_item_data[0x45] = 0xFFu;                /* nInvPage = 0xFF */

    /* Setup s_drop (`D2ItemDropStrc` 1.13c layout, size 0x84) */
    uint32_t dwDropItemFlags = 0u;
    uint32_t dwDropFlags2 = 0u;
    if ((dropFlags & 1u) == 0u) {
      dwDropFlags2 |= 0x08u; /* NO_SOCKETS */
    }
    if ((dropFlags & 2u) != 0u) {
      dwDropItemFlags |= 0x800u;
      dwDropFlags2 |= 0x10u; /* FORCE_SOCKETS */
    }
    if ((dropFlags & 4u) != 0u) {
      dwDropItemFlags |= 0x400000u;
      dwDropFlags2 |= 0x04u; /* FORCE_ETHEREAL */
    }
    write_u32(s_drop, 0x08, (uint32_t)(uintptr_t)s_game); /* pDrop->pGame */
    write_u32(s_drop, 0x0C, ilvl);                        /* pDrop->nSpawnLevel */
    write_u32(s_drop, 0x14, (uint32_t)itemId);            /* pDrop->nId */
    write_u16(s_drop, 0x2A, itemFormat);                  /* pDrop->wItemFormat */
    write_u32(s_drop, 0x30, quality);                     /* pDrop->nQuality */
    write_u32(s_drop, 0x44, dwDropItemFlags);             /* pDrop->dwItemFlagsOverride */
    write_u32(s_drop, 0x80, dwDropFlags2);                /* pDrop->dwFlags2 */

    /* Execute real unhooked D2Game:0x6FC31070 -> 0x6FC30A20 */
    void *pItemPtr = s_item;
    InitItemStatsArgs initArgs = { s_game, s_drop, 1 };
    int32_t ok = call_D2Game_InitCreatedItemStats(&pItemPtr, &initArgs);
    if (!ok || pItemPtr != s_item) {
      fprintf(stderr, "[itemgen-emitter] 0x6FC31070 failed at idx=%u itemId=%u q=%u fmt=%u ok=%d\n",
              idx, itemId, quality, itemFormat, ok);
      return 8;
    }

    /* Serialize via real unhooked D2Common.#10987 (full server-side bitstream) */
    memset(s_ser_buf, 0, sizeof(s_ser_buf));
    uint32_t serBytes = pSerializeItem(s_item, s_ser_buf, (uint32_t)sizeof(s_ser_buf), 1, 1, 0);
    if (serBytes == 0u || serBytes > sizeof(s_ser_buf)) {
      fprintf(stderr, "[itemgen-emitter] #10987 failed at idx=%u serBytes=%u\n", idx, serBytes);
      return 9;
    }

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
    rec->autoAffix      = read_u16(s_item_data, 0x36);
    rec->bitstreamBytes = (uint16_t)serBytes;
    sha256_bytes(s_ser_buf, serBytes, rec->bitstreamSha256);

    if (rec->finalQuality < 10u) finalQualCounts[rec->finalQuality]++;
  }

  fprintf(stderr,
          "[itemgen-emitter] finalQuality distribution: "
          "q1=%u q2=%u q3=%u q4=%u q5(Set)=%u q6(Rare)=%u q7(Uniq)=%u q8(Craft)=%u\n",
          finalQualCounts[1], finalQualCounts[2], finalQualCounts[3], finalQualCounts[4],
          finalQualCounts[5], finalQualCounts[6], finalQualCounts[7], finalQualCounts[8]);

  D2TVHeader hdr;
  d2tv_init_header(&hdr, "ITEMGEN", sizeof(ItemGenVectorRecord), ITEMGEN_COUNT, ITEMGEN_SEED);

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[itemgen-emitter] failed to open %s\n", outPath);
    free(records);
    return 10;
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
