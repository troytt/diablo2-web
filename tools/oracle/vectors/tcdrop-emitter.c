/*
 * Milestone 33 [K2] Exit-Gate D2TV Binary Vector Emitter: TCDROP
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll, D2Lang.dll,
 * D2Common.dll @ 0x6FD50000, D2Net.dll, D2Game.dll @ 0x6FC20000) and MPQ
 * data tables (D2Common.#10943), then executes real D2Game.dll TreasureClassEx
 * drop selection and quality rolling across 1,200 vectors:
 *
 *   1. D2Common:0x6FD972B0 (#10659) DATATBLS_GetTreasureClassExTxtRecord
 *   2. D2Game:0x6FC32380            ITEMS_SelectTreasureClassDrop
 *   3. D2Game:0x6FC2FC40            ITEMS_RollItemQualityForDrop
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
#define TCDROP_COUNT     1200u
#define TCDROP_SEED      0x3333544344524F50ull

#pragma pack(push, 1)
typedef struct {
  /* Inputs (18 bytes, +0..+17) */
  uint32_t initSeedLo;          /* +0 */
  uint32_t initSeedHi;          /* +4 */
  uint16_t tcId;                /* +8  (1..1012) */
  uint8_t  monsterLevel;        /* +10 (1..99) */
  uint8_t  difficulty;          /* +11 (0..2) */
  uint16_t mfBonus;             /* +12 (0..500) */
  uint8_t  bExpansion;          /* +14 (0..1) */
  uint8_t  nPartyFactor;        /* +15 (1..8) */
  uint8_t  bSkipNoDrop;         /* +16 (0..1) */
  uint8_t  maxDrops;            /* +17 (1..6) */

  /* Outputs from real 1.13c DLL calls (46 bytes, +18..+63) */
  uint16_t resolvedGroup;       /* +18 */
  uint16_t resolvedLevel;       /* +20 */
  int16_t  initPicks;           /* +22 */
  int32_t  rootEffectiveNoDrop; /* +24 */
  uint16_t droppedCount;        /* +28 */
  int16_t  dropClassIds[6];     /* +30..+41 (-1 if unused) */
  uint8_t  dropQualities[6];    /* +42..+47 (0 if unused) */
  uint8_t  dropFlags[6];        /* +48..+53 (0 if unused) */
  uint16_t firstUniqueSetIdx;   /* +54 */
  uint32_t outSeedLo;           /* +56 */
  uint32_t outSeedHi;           /* +60 */
} TcDropVectorRecord;
#pragma pack(pop)

typedef char TcDropSizeCheck[(sizeof(TcDropVectorRecord) == 64) ? 1 : -1];

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *D2Common_InitTables_t)(int, int, int);

typedef void *(__stdcall *D2Common_GetTcEx_t)(uint32_t wTcId, int32_t nLvl);
typedef void *(__stdcall *D2Common_AllocStatList_t)(void *pMemPool, uint32_t dwFlags, uint32_t dwTimeout, int32_t nUnitType, int32_t nUnitGUID);
typedef void(__stdcall *D2Common_SetUnitStat_t)(void *pUnit, int32_t nStatId, int32_t nValue, int32_t nParam);
typedef void(__stdcall *D2Game_SelectTcDrop_t)(
    void *pGame,
    void *pDropper,
    void *pKiller,
    void *pTc,
    int32_t nQualityOverride,
    int32_t nItemLevel,
    int32_t bSkipNoDrop,
    void **ppOutItems,
    int32_t *pnOutCount,
    int32_t nMaxDrops);

static uintptr_t g_game_rebase = 0;
static uintptr_t g_com_rebase = 0;
static HMODULE g_hGame = NULL;
static HMODULE g_hCom = NULL;
static uint32_t g_cur_idx = 0;

/* Captured drops during a single ITEMS_SelectTreasureClassDrop invocation */
static int32_t  g_cap_count = 0;
static int16_t  g_cap_classIds[16];
static uint8_t  g_cap_qualities[16];
static uint8_t  g_cap_flags[16];
static uint16_t g_cap_firstUniqueSetIdx = 0;

/* Dummy non-gold item unit returned by hook_6FC31880 so 0x6FC32380 increments *pnOutCount */
static uint8_t __attribute__((aligned(16))) g_dummy_item[0x100];

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
  uintptr_t gameCanon = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (eip - g_game_rebase)
                            : 0;
  CONTEXT *c = ep->ContextRecord;
  fprintf(stderr,
          "[tcdrop-emitter] CRASH idx=%u code=0x%08lx eip=%p (gameVA=0x%08lx) "
          "addr=%p EAX=%08lx ECX=%08lx EDX=%08lx EBX=%08lx ESI=%08lx EDI=%08lx\n",
          g_cur_idx,
          (unsigned long)ep->ExceptionRecord->ExceptionCode,
          (void *)eip, (unsigned long)gameCanon,
          (void *)ep->ExceptionRecord->ExceptionInformation[1],
          (unsigned long)c->Eax, (unsigned long)c->Ecx, (unsigned long)c->Edx,
          (unsigned long)c->Ebx, (unsigned long)c->Esi, (unsigned long)c->Edi);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 99);
  return EXCEPTION_EXECUTE_HANDLER;
}

static void * __stdcall hook_6FC31880(
    void *pGame,
    int32_t wItemId,
    int32_t quality,
    int32_t uniqueSetIdx,
    int32_t dropFlags) {
  (void)pGame;
  if (g_cap_count < 16) {
    g_cap_classIds[g_cap_count] = (int16_t)wItemId;
    g_cap_qualities[g_cap_count] = (uint8_t)quality;
    g_cap_flags[g_cap_count] = (uint8_t)dropFlags;
    if (g_cap_firstUniqueSetIdx == 0 && uniqueSetIdx > 0) {
      g_cap_firstUniqueSetIdx = (uint16_t)uniqueSetIdx;
    }
    g_cap_count++;
  }
  return (void *)g_dummy_item;
}

static void install_jmp_hook(uintptr_t target_va, void *hook_fn) {
  DWORD old_prot = 0;
  uint8_t *p = (uint8_t *)target_va;
  VirtualProtect(p, 8, PAGE_EXECUTE_READWRITE, &old_prot);
  p[0] = 0xE9; /* JMP rel32 */
  int32_t rel = (int32_t)((uintptr_t)hook_fn - (target_va + 5));
  memcpy(p + 1, &rel, 4);
}

static int32_t compute_root_effective_nodrop(
    const uint8_t *pTc,
    uint8_t bExpansion,
    uint8_t nPartyFactor,
    uint8_t bSkipNoDrop) {
  if (pTc == NULL || bSkipNoDrop != 0) {
    return 0;
  }
  int32_t nPicks = *(const int32_t *)(pTc + 0x10);
  if (nPicks < 0) {
    return 0;
  }
  int32_t noDrop = *(const int32_t *)(pTc + 0x14);
  int32_t prob = bExpansion ? *(const int32_t *)(pTc + 0x0C) : *(const int32_t *)(pTc + 0x08);
  if (noDrop <= 0 || prob <= 0) {
    return 0;
  }
  if (nPartyFactor <= 1) {
    return noDrop;
  }
  double baseRatio = (double)noDrop / (double)(noDrop + prob);
  long double ratioPow = (long double)baseRatio;
  for (int i = 1; i < (int)nPartyFactor; i++) {
    ratioPow *= (long double)baseRatio;
  }
  long double denom = 1.0L - ratioPow;
  if (denom < (long double)0.0001) {
    return 0;
  }
  return (int32_t)((ratioPow / denom) * (long double)prob);
}

static int open_mpq_if_exists(SFileOpenArchive_t fnOpen, const char *name, DWORD prio, int req) {
  if (GetFileAttributesA(name) == INVALID_FILE_ATTRIBUTES) {
    if (req) {
      fprintf(stderr, "[tcdrop-emitter] missing MPQ: %s\n", name);
      return 0;
    }
    return 1;
  }
  HANDLE hMpq = NULL;
  if (!fnOpen(name, prio, 0, &hMpq) || !hMpq) {
    if (!fnOpen(name, prio, 2, &hMpq) || !hMpq) {
      if (req) {
        fprintf(stderr, "[tcdrop-emitter] failed to open MPQ: %s\n", name);
        return 0;
      }
    }
  }
  return 1;
}

static uint64_t splitmix64(uint64_t *state) {
  uint64_t z = (*state += 0x9E3779B97F4A7C15ull);
  z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
  z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
  return z ^ (z >> 31);
}

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "tcdrop-113c.d2tv";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  HMODULE hGame  = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hNet || !hGame) {
    fprintf(stderr, "[tcdrop-emitter] failed to load DLLs\n");
    return 2;
  }
  if ((uintptr_t)hCom != D2COM_PREF_BASE) {
    fprintf(stderr, "[tcdrop-emitter] unexpected D2Common base %p\n", (void *)hCom);
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
      pFree(*pp, "tcdrop-emitter.c", 1, 0);
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
    fprintf(stderr, "[tcdrop-emitter] D2Common.#10943 failed\n");
    return 5;
  }

  /* Bind D2Common thunks via D2Game IAT jump table */
  D2Common_GetTcEx_t pGetTcEx =
      (D2Common_GetTcEx_t)(uintptr_t)(0x6FC2B44Au + g_game_rebase);
  D2Common_AllocStatList_t pAllocStatList =
      (D2Common_AllocStatList_t)(uintptr_t)(0x6FC2A6A0u + g_game_rebase);
  D2Common_SetUnitStat_t pSetUnitStat =
      (D2Common_SetUnitStat_t)(uintptr_t)(0x6FC2A472u + g_game_rebase);

  /* Install hook at D2Game:0x6FC31880 */
  install_jmp_hook((uintptr_t)(0x6FC31880u + g_game_rebase), (void *)hook_6FC31880);
  D2Game_SelectTcDrop_t pSelectTcDrop =
      (D2Game_SelectTcDrop_t)(uintptr_t)(0x6FC32380u + g_game_rebase);

  /* Dummy item (dwUnitType = 4, dwClassId = 0 'hax' non-gold) */
  memset(g_dummy_item, 0, sizeof(g_dummy_item));
  *(uint32_t *)(g_dummy_item + 0x00) = 4u;
  *(uint32_t *)(g_dummy_item + 0x04) = 0u;

  static uint8_t __attribute__((aligned(16))) s_game[0x2000];
  static uint8_t __attribute__((aligned(16))) s_dropper[0x200];
  static uint8_t __attribute__((aligned(16))) s_dropper_mon_data[0x100];
  static uint8_t __attribute__((aligned(16))) s_killer[0x200];
  static uint8_t __attribute__((aligned(16))) s_killer_mon_data[0x100];

  memset(s_game, 0, sizeof(s_game));
  memset(s_dropper, 0, sizeof(s_dropper));
  memset(s_dropper_mon_data, 0, sizeof(s_dropper_mon_data));
  memset(s_killer, 0, sizeof(s_killer));
  memset(s_killer_mon_data, 0, sizeof(s_killer_mon_data));

  *(uint32_t *)(s_dropper + 0x00) = 1u; /* UNIT_MONSTER */
  *(uint32_t *)(s_dropper + 0x04) = 0u;
  *(uint32_t *)(s_dropper + 0x0C) = 1u;
  *(void **)(s_dropper + 0x14) = s_dropper_mon_data;
  void *pDropperStats = pAllocStatList(NULL, 0u, 0u, 1, 1);
  *(void **)(s_dropper + 0x5C) = pDropperStats;

  *(uint32_t *)(s_killer + 0x00) = 1u; /* UNIT_MONSTER */
  *(uint32_t *)(s_killer + 0x04) = 0u;
  *(uint32_t *)(s_killer + 0x0C) = 2u;
  *(void **)(s_killer + 0x14) = s_killer_mon_data;
  void *pKillerStats = pAllocStatList(NULL, 0u, 0u, 1, 2);
  *(void **)(s_killer + 0x5C) = pKillerStats;

  uint32_t total_tcs = *(uint32_t *)(uintptr_t)(0x6FDF0898u + g_com_rebase);
  if (total_tcs == 0 || total_tcs > 2000u) {
    fprintf(stderr, "[tcdrop-emitter] unexpected total_tcs=%u\n", total_tcs);
    return 6;
  }

  TcDropVectorRecord *records =
      (TcDropVectorRecord *)calloc(TCDROP_COUNT, sizeof(TcDropVectorRecord));
  if (!records) return 7;

  static const uint16_t curated_tcs[] = {
    1, 2, 3, 7, 12, 18, 24, 33, 42, 55, 68, 75, 88, 96, 108, 120,
    135, 150, 165, 180, 195, 210, 225, 240, 260, 280, 300, 325, 350, 375, 400, 425,
    450, 475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725, 750, 775, 800, 825,
    850, 875, 900, 920, 940, 960, 980, 995, 1005, 1010, 1012
  };
  const size_t num_curated = sizeof(curated_tcs) / sizeof(curated_tcs[0]);
  static const uint16_t mf_table[] = { 0, 25, 50, 100, 150, 200, 250, 300, 400, 500 };

  uint64_t rng = TCDROP_SEED;

  for (uint32_t i = 0; i < TCDROP_COUNT; i++) {
    g_cur_idx = i;
    TcDropVectorRecord *rec = &records[i];
    uint64_t s0 = splitmix64(&rng);
    uint64_t s1 = splitmix64(&rng);
    (void)s1;

    if (i == 0) {
      rec->initSeedLo = 1u;
      rec->initSeedHi = 666u;
    } else if (i == 1) {
      rec->initSeedLo = 0xFFFFFFFFu;
      rec->initSeedHi = 0xFFFFFFFFu;
    } else if (i == 2) {
      rec->initSeedLo = 0u;
      rec->initSeedHi = 1u;
    } else {
      rec->initSeedLo = (uint32_t)s0;
      rec->initSeedHi = (uint32_t)(s0 >> 32);
      if (rec->initSeedLo == 0 && rec->initSeedHi == 0) rec->initSeedHi = 666u;
    }

    if (i < 900u) {
      rec->tcId = (uint16_t)((i * 7u + 1u) % total_tcs);
      if (rec->tcId == 0) rec->tcId = 1;
    } else {
      rec->tcId = curated_tcs[i % num_curated];
      if (rec->tcId >= total_tcs) rec->tcId = (uint16_t)(total_tcs - 1u);
    }

    rec->difficulty = (uint8_t)(i % 3u);
    rec->monsterLevel = (uint8_t)(1u + ((i * 13u + (uint32_t)rec->difficulty * 30u) % 99u));
    rec->mfBonus = mf_table[(i / 3u) % 10u];
    rec->bExpansion = (uint8_t)((i % 7u == 0u) ? 0u : 1u);
    rec->nPartyFactor = (uint8_t)(1u + ((i * 3u) % 8u));
    rec->bSkipNoDrop = (uint8_t)((i % 5u == 0u) ? 1u : 0u);
    rec->maxDrops = (uint8_t)(1u + ((i * 5u) % 6u));

    uint8_t *pTc = (uint8_t *)pGetTcEx(rec->tcId, 0);
    if (!pTc) {
      for (int k = 0; k < 6; k++) rec->dropClassIds[k] = -1;
      rec->outSeedLo = rec->initSeedLo;
      rec->outSeedHi = rec->initSeedHi;
      continue;
    }

    rec->resolvedGroup = *(uint16_t *)(pTc + 0x00);
    rec->resolvedLevel = *(uint16_t *)(pTc + 0x02);
    rec->initPicks = (int16_t)(*(int32_t *)(pTc + 0x10));
    rec->rootEffectiveNoDrop = compute_root_effective_nodrop(
        pTc, rec->bExpansion, rec->nPartyFactor, rec->bSkipNoDrop);

    *(uint8_t *)(s_game + 0x6A) = 1u; /* nGameType = 1 (SinglePlayer, honors 0x6FD31C1C) */
    *(uint8_t *)(s_game + 0x6D) = rec->difficulty;
    *(uint32_t *)(s_game + 0x70) = (uint32_t)rec->bExpansion;
    memset(s_game + 0x1B24, 0, 512);

    *(uint32_t *)(s_dropper + 0x20) = rec->initSeedLo;
    *(uint32_t *)(s_dropper + 0x24) = rec->initSeedHi;
    pSetUnitStat(s_dropper, 12, (int32_t)rec->monsterLevel, 0);
    pSetUnitStat(s_dropper, 100, 8, 0);

    *(int32_t *)(uintptr_t)(0x6FD31C1Cu + g_game_rebase) = ((int32_t)rec->nPartyFactor * 2) - 1;
    pSetUnitStat(s_killer, 80, (int32_t)rec->mfBonus, 0);

    g_cap_count = 0;
    g_cap_firstUniqueSetIdx = 0;
    memset(g_cap_classIds, 0xFF, sizeof(g_cap_classIds));
    memset(g_cap_qualities, 0, sizeof(g_cap_qualities));
    memset(g_cap_flags, 0, sizeof(g_cap_flags));

    int32_t outCount = 0;
    void *outItems[8] = {0};
    pSelectTcDrop(
        s_game,
        s_dropper,
        s_killer,
        pTc,
        0,
        (int32_t)rec->monsterLevel,
        (int32_t)rec->bSkipNoDrop,
        outItems,
        &outCount,
        (int32_t)rec->maxDrops);

    rec->droppedCount = (uint16_t)g_cap_count;
    for (int k = 0; k < 6; k++) {
      if (k < g_cap_count) {
        rec->dropClassIds[k] = g_cap_classIds[k];
        rec->dropQualities[k] = g_cap_qualities[k];
        rec->dropFlags[k] = g_cap_flags[k];
      } else {
        rec->dropClassIds[k] = -1;
        rec->dropQualities[k] = 0;
        rec->dropFlags[k] = 0;
      }
    }
    rec->firstUniqueSetIdx = g_cap_firstUniqueSetIdx;
    rec->outSeedLo = *(uint32_t *)(s_dropper + 0x20);
    rec->outSeedHi = *(uint32_t *)(s_dropper + 0x24);
  }

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[tcdrop-emitter] failed to open output: %s\n", outPath);
    return 8;
  }
  D2TVHeader hdr;
  d2tv_init_header(&hdr, "TCDROP", sizeof(TcDropVectorRecord), TCDROP_COUNT, TCDROP_SEED);
  if (fwrite(&hdr, sizeof(hdr), 1, fp) != 1 ||
      fwrite(records, sizeof(TcDropVectorRecord), TCDROP_COUNT, fp) != TCDROP_COUNT) {
    fclose(fp);
    return 9;
  }
  fclose(fp);
  printf("[tcdrop-emitter] wrote %u TCDROP records (%u bytes each) to %s\n",
         TCDROP_COUNT, (unsigned)sizeof(TcDropVectorRecord), outPath);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
