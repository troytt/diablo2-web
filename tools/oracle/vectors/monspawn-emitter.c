/*
 * Milestone 33 [K2] Exit-Gate D2TV Binary Vector Emitter: MONSPAWN
 *
 * Loads the real Diablo II v1.13c DLLs (Storm.dll, Fog.dll, D2Lang.dll,
 * D2Common.dll @ 0x6FD50000, D2Net.dll, D2Game.dll @ 0x6FC20000) and MPQ
 * data tables (D2Common.#10943), then executes real D2Game.dll monster
 * population routines across 1,200 vectors spanning Acts 1..5, difficulties
 * 0..2, Classic & Expansion modes, player counts 1..8, and 64-bit seeds:
 *
 *   1. D2Game:0x6FCEA760  REGIONS_SelectLevelMonsters
 *   2. D2Game:0x6FCFF080  MONSTER_RollPackRarityType
 *   3. D2Game:0x6FCFF4A0  MONSTER_ChooseMonsterClass
 *   4. D2Game:0x6FC66D40  REGPOP_UsesPartyBossGroup + sparsePopulate / MinGrp..MaxGrp
 *   5. D2Game:0x6FC43CA0  MONSTER_RollChampionOrUniqueMods
 *   6. D2Game:0x6FCCFDB0  MONSTER_InitStats (mlvl, HP, EXP, AC, resists, regen, MonProp)
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
#define MONSPAWN_COUNT   1200u
#define MONSPAWN_SEED    0x33334D4F4E535057ull

#pragma pack(push, 1)
typedef struct {
  /* Inputs (18 bytes) */
  uint32_t initSeedLo;
  uint32_t initSeedHi;
  uint16_t levelId;
  uint8_t  difficulty;
  uint8_t  bExpansion;
  uint8_t  nPlayers;
  uint8_t  roomsVisited;
  uint8_t  totalRooms;
  uint8_t  spawnedBosses;
  uint8_t  bossMode;      /* 0=natural rarity roll, 1=force elite (champ+uniq), 2=force unique-only */
  uint8_t  superPct;

  /* Outputs from real 1.13c DLL calls (46 bytes) */
  uint8_t  poolCount;
  uint8_t  totalRarity;
  int16_t  slot0ClassId;
  uint8_t  packRarityType;
  uint8_t  packCount;
  int16_t  chosenClassId;
  uint8_t  monFlags;
  uint8_t  umods[6];
  uint8_t  reserved0;
  uint16_t mlvl;
  int32_t  maxHp;
  int32_t  exp;
  int16_t  ac;
  int16_t  fireRes;
  int16_t  lightRes;
  int16_t  coldRes;
  int32_t  hpRegen;
  uint32_t outSeedLo;
  uint32_t outSeedHi;
} MonSpawnVectorRecord;
#pragma pack(pop)

typedef char MonSpawnSizeCheck[(sizeof(MonSpawnVectorRecord) == 64) ? 1 : -1];

typedef struct {
  uint32_t lo;
  uint32_t hi;
} D2Seed64;

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *D2Common_InitTables_t)(int, int, int);
typedef uint8_t *(__stdcall *D2Common_GetLevelsTxt_t)(int);
typedef int32_t(__stdcall *D2Common_GetUnitStat_t)(void *, int, int);
typedef void(__stdcall *D2Game_RollChampOrUnique_t)(void *, void *, int);

static uintptr_t g_game_rebase = 0;
static HMODULE g_hGame = NULL;
static HMODULE g_hCom = NULL;
static uint32_t g_cur_idx = 0;

static LONG WINAPI crash_filter(EXCEPTION_POINTERS *ep) {
  uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
  uintptr_t gameCanon = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (eip - g_game_rebase)
                            : 0;
  (void)g_hCom;
  CONTEXT *c = ep->ContextRecord;
  fprintf(stderr,
          "[monspawn-emitter] CRASH idx=%u code=0x%08lx eip=%p (gameVA=0x%08lx) "
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

/* D2Game:0x6FCEA760: eax = bIsNmOrHell, ebx = pSeed, stack(pLevelsTxt, pMonReg), ret 8 */
static void __attribute__((noinline)) call_SelectLevelMonsters(
    uint32_t bIsNmOrHell, D2Seed64 *pSeed, void *pLevelsTxt, void *pMonReg) {
  uintptr_t fn = 0x6FCEA760u + g_game_rebase;
  __asm__ volatile(
      "pushl %%edx\n\t"
      "pushl %%ecx\n\t"
      "call *%%esi\n\t"
      : "+a"(bIsNmOrHell), "+c"(pLevelsTxt), "+d"(pMonReg)
      : "b"(pSeed), "S"(fn)
      : "memory", "cc");
}

/* D2Game:0x6FCFF080: eax = pMonReg, stack(pRoom), ret 4 -> eax */
static uint32_t __attribute__((noinline)) call_RollPackRarityType(
    void *pMonReg, void *pRoom) {
  uint32_t ret = (uint32_t)(uintptr_t)pMonReg;
  uintptr_t fn = 0x6FCFF080u + g_game_rebase;
  __asm__ volatile(
      "pushl %%ecx\n\t"
      "call *%%esi\n\t"
      : "+a"(ret), "+c"(pRoom)
      : "S"(fn)
      : "edx", "memory", "cc");
  return ret;
}

typedef struct {
  void    *pGame;
  void   **ppOutMonStats;
  uint32_t nSuperPct;
} ChooseClassArgs;

/* D2Game:0x6FCFF4A0: eax = bElite, ecx = pRoom, edx = pMonReg, stack(pGame, ppOut, nSuperPct), ret 0xC */
static int32_t __attribute__((noinline)) call_ChooseMonsterClass(
    uint32_t bElite, void *pRoom, void *pMonReg, const ChooseClassArgs *args) {
  int32_t ret = (int32_t)bElite;
  uintptr_t fn = 0x6FCFF4A0u + g_game_rebase;
  __asm__ volatile(
      "pushl 8(%%ebx)\n\t"
      "pushl 4(%%ebx)\n\t"
      "pushl 0(%%ebx)\n\t"
      "call *%%esi\n\t"
      : "+a"(ret), "+c"(pRoom), "+d"(pMonReg)
      : "b"(args), "S"(fn)
      : "memory", "cc");
  return ret;
}

/* D2Game:0x6FC66D40: ecx = nClassId, ret -> eax */
static int32_t __attribute__((noinline)) call_UsesPartyBossGroup(int32_t nClassId) {
  int32_t ret = 0;
  uintptr_t fn = 0x6FC66D40u + g_game_rebase;
  __asm__ volatile(
      "call *%%esi\n\t"
      : "=a"(ret), "+c"(nClassId)
      : "S"(fn)
      : "edx", "memory", "cc");
  return ret;
}

/* D2Game:0x6FC211D0: ecx = pSeed, esi = nMax, ret -> eax */
static int32_t __attribute__((noinline)) call_RollLimitedFast(D2Seed64 *pSeed, int32_t nMax) {
  int32_t ret = 0;
  uintptr_t fn = 0x6FC211D0u + g_game_rebase;
  __asm__ volatile(
      "call *%%edx\n\t"
      : "=a"(ret), "+c"(pSeed), "+S"(nMax)
      : "d"(fn)
      : "memory", "cc");
  return ret;
}

typedef struct {
  void *pGame;
  void *pRoom;
  void *pOutfit;
} InitStatsArgs;

/* D2Game:0x6FCCFDB0: ebx = pUnit, stack(pGame, pRoom, pOutfit), ret 0xC */
static void __attribute__((noinline)) call_MonsterInitStats(
    void *pUnit, const InitStatsArgs *args) {
  uintptr_t fn = 0x6FCCFDB0u + g_game_rebase;
  __asm__ volatile(
      "pushl 8(%%edi)\n\t"
      "pushl 4(%%edi)\n\t"
      "pushl 0(%%edi)\n\t"
      "call *%%esi\n\t"
      : "+b"(pUnit)
      : "D"(args), "S"(fn)
      : "eax", "ecx", "edx", "memory", "cc");
}

static uint64_t splitmix64(uint64_t *state) {
  uint64_t z = (*state += 0x9E3779B97F4A7C15ull);
  z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
  z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
  return z ^ (z >> 31);
}

static int open_mpq_if_exists(SFileOpenArchive_t fnOpen, const char *name, DWORD prio, int req) {
  if (GetFileAttributesA(name) == INVALID_FILE_ATTRIBUTES) {
    if (req) {
      fprintf(stderr, "[monspawn-emitter] missing MPQ: %s\n", name);
      return 0;
    }
    return 1;
  }
  HANDLE hMpq = NULL;
  if (!fnOpen(name, prio, 0, &hMpq) || !hMpq) {
    if (!fnOpen(name, prio, 2, &hMpq) || !hMpq) {
      if (req) {
        fprintf(stderr, "[monspawn-emitter] failed to open MPQ: %s\n", name);
        return 0;
      }
    }
  }
  return 1;
}

/* 60 monster-populated levels across Acts 1..5 (excluding towns & Flying Scimitar lvl 74). */
static const uint16_t kSpawnLevels[60] = {
  /* Act 1 (16) */
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17, 21, 28, 35, 39,
  /* Act 2 (12) */
  41, 42, 43, 44, 45, 46, 47, 51, 56, 59, 62, 66,
  /* Act 3 (12) */
  76, 77, 78, 79, 80, 81, 82, 83, 84, 88, 94, 101,
  /* Act 4 (5) */
  104, 105, 106, 107, 108,
  /* Act 5 (15) */
  110, 111, 112, 113, 115, 117, 118, 119, 121, 122, 126, 128, 129, 130, 131
};

int main(int argc, char **argv) {
  const char *outPath = argc > 1 ? argv[1] : "monspawn-113c.d2tv";
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  SetUnhandledExceptionFilter(crash_filter);

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  HMODULE hGame  = LoadLibraryA("D2Game.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hNet || !hGame) {
    fprintf(stderr, "[monspawn-emitter] failed to load DLLs\n");
    return 2;
  }
  if ((uintptr_t)hCom != D2COM_PREF_BASE) {
    fprintf(stderr, "[monspawn-emitter] unexpected D2Common base %p\n", (void *)hCom);
    return 3;
  }
  g_hCom = hCom;
  g_hGame = hGame;
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
      pFree(*pp, "monspawn-emitter.c", 1, 0);
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
    fprintf(stderr, "[monspawn-emitter] D2Common.#10943 failed\n");
    return 5;
  }

  D2Common_GetLevelsTxt_t pGetLevelsTxt =
      (D2Common_GetLevelsTxt_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10014));
  D2Common_GetUnitStat_t pGetUnitStat =
      (D2Common_GetUnitStat_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10973));
  D2Game_RollChampOrUnique_t pRollChampOrUnique =
      (D2Game_RollChampOrUnique_t)(uintptr_t)(0x6FC43CA0u + g_game_rebase);

  MonSpawnVectorRecord *records =
      (MonSpawnVectorRecord *)calloc(MONSPAWN_COUNT, sizeof(MonSpawnVectorRecord));
  if (!records) return 6;

  static uint8_t s_game[0x1DF4];
  static uint8_t s_players[8][0x100];
  static uint8_t s_monReg[0x2E4];
  static uint8_t s_room[0x80];
  static uint8_t s_roomEx[0x80];
  static uint8_t s_drlgLevel[0x200];
  static uint8_t s_unit[0x100];
  static uint8_t s_monData[0x60];

  uint64_t rng = MONSPAWN_SEED;

  for (uint32_t i = 0; i < MONSPAWN_COUNT; i++) {
    g_cur_idx = i;
    MonSpawnVectorRecord *rec = &records[i];
    uint64_t s0 = splitmix64(&rng);
    uint64_t s1 = splitmix64(&rng);

    /* Include canonical edge seeds on early records. */
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

    uint16_t levelId = kSpawnLevels[i % 60u];
    uint8_t diff = (uint8_t)((i / 60u) % 3u);
    /* Act 5 levels (>= 109) require Expansion; Acts 1..4 test both Classic and Expansion. */
    uint8_t bExp = (levelId >= 109u) ? 1u : (uint8_t)((i % 5u == 4u) ? 0u : 1u);
    uint8_t nPlayers = (uint8_t)((s1 % 8u) + 1u);
    uint8_t totalRooms = (uint8_t)(((s1 >> 8) % 24u) + 4u);
    uint8_t roomsVisited = (uint8_t)(((s1 >> 16) % (uint32_t)totalRooms) + 1u);
    uint8_t spawnedBosses = (uint8_t)((s1 >> 24) % 8u);
    uint8_t bossMode = (uint8_t)(i % 3u);
    uint8_t superPct = (uint8_t)(((s1 >> 32) % 5u) * 20u);

    rec->levelId = levelId;
    rec->difficulty = diff;
    rec->bExpansion = bExp;
    rec->nPlayers = nPlayers;
    rec->roomsVisited = roomsVisited;
    rec->totalRooms = totalRooms;
    rec->spawnedBosses = spawnedBosses;
    rec->bossMode = bossMode;
    rec->superPct = superPct;

    uint8_t *pLevelsTxt = pGetLevelsTxt((int)levelId);
    if (!pLevelsTxt) {
      fprintf(stderr, "[monspawn-emitter] null LevelsTxt for level %u\n", levelId);
      return 7;
    }

    memset(s_game, 0, sizeof(s_game));
    s_game[0x6A] = bExp;
    s_game[0x6D] = diff;
    *(uint32_t *)(s_game + 0x70) = bExp ? 1u : 0u;
    memset(s_players, 0, sizeof(s_players));
    for (uint8_t p = 0; p < nPlayers && p < 8u; p++) {
      *(uint32_t *)(s_players[p] + 0x00) = 0u; /* UNIT_PLAYER */
      *(uint32_t *)(s_players[p] + 0x0C) = (uint32_t)(p + 1u);
      *(uint32_t *)(s_players[p] + 0x10) = 1u; /* PLRMODE_NEUTRAL */
      *(void **)(s_game + 0x1120 + (size_t)p * 4u) = s_players[p];
    }

    memset(s_monReg, 0, sizeof(s_monReg));
    s_monReg[0x00] = pLevelsTxt[0x03];
    *(uint32_t *)(s_monReg + 0x04) = (uint32_t)roomsVisited;
    *(uint32_t *)(s_monReg + 0x0C) = (uint32_t)totalRooms;
    *(uint32_t *)(s_monReg + 0x2B8) = *(uint32_t *)(pLevelsTxt + 0x1C + diff * 4u);
    s_monReg[0x2BC] = pLevelsTxt[0x28 + diff];
    s_monReg[0x2BD] = pLevelsTxt[0x2B + diff];
    s_monReg[0x2C8] = spawnedBosses;
    *(uint32_t *)(s_monReg + 0x2C0) = (uint32_t)levelId;

    memset(s_drlgLevel, 0, sizeof(s_drlgLevel));
    *(uint32_t *)(s_drlgLevel + 0x1D0) = (uint32_t)levelId;
    memset(s_roomEx, 0, sizeof(s_roomEx));
    *(void **)(s_roomEx + 0x58) = s_drlgLevel;
    memset(s_room, 0, sizeof(s_room));
    *(void **)(s_room + 0x10) = s_roomEx;

    D2Seed64 seed = {rec->initSeedLo, rec->initSeedHi};

    /* 1. Select level monster pool (D2Game:0x6FCEA760). */
    call_SelectLevelMonsters(diff != 0 ? 1u : 0u, &seed, pLevelsTxt, s_monReg);
    rec->poolCount = s_monReg[0x10];
    rec->totalRarity = s_monReg[0x11];
    rec->slot0ClassId = (rec->poolCount > 0) ? *(int16_t *)(s_monReg + 0x14) : -1;

    /* 2. Roll pack rarity type (D2Game:0x6FCFF080) on room seed (+0x6C). */
    *(D2Seed64 *)(s_room + 0x6C) = seed;
    uint32_t rarityType = call_RollPackRarityType(s_monReg, s_room);
    seed = *(D2Seed64 *)(s_room + 0x6C);
    rec->packRarityType = (uint8_t)rarityType;

    /* 3. Choose monster class (D2Game:0x6FCFF4A0). */
    uint32_t bElite = (bossMode != 0 || rarityType == 0) ? 1u : 0u;
    void *pMonStats = NULL;
    ChooseClassArgs chooseArgs = {s_game, &pMonStats, (uint32_t)superPct};
    *(D2Seed64 *)(s_room + 0x6C) = seed;
    int32_t chosenId = call_ChooseMonsterClass(bElite, s_room, s_monReg, &chooseArgs);
    seed = *(D2Seed64 *)(s_room + 0x6C);
    rec->chosenClassId = (int16_t)chosenId;

    if (!pMonStats || chosenId < 0) {
      rec->packCount = 0;
      rec->outSeedLo = seed.lo;
      rec->outSeedHi = seed.hi;
      continue;
    }

    /* 4. Roll pack member count (matching 0x6FC67BAD..0x6FC67C2D + 0x6FC67700). */
    uint8_t packCount = 1u;
    if (!bElite) {
      uint8_t minGrp = 1u;
      uint8_t maxGrp = 1u;
      if (!call_UsesPartyBossGroup(chosenId)) {
        minGrp = ((const uint8_t *)pMonStats)[0x2F];
        maxGrp = ((const uint8_t *)pMonStats)[0x30];
      }
      uint8_t sparse = ((const uint8_t *)pMonStats)[0x31];
      int skipPack = 0;
      if (sparse != 0) {
        /* 0x6FC67BDB..0x6FC67C13: raw 64-bit step % 100 > sparse skips pack */
        uint64_t prod = (uint64_t)seed.lo * 0x6AC690C5ull + (uint64_t)seed.hi;
        seed.lo = (uint32_t)prod;
        seed.hi = (uint32_t)(prod >> 32);
        if ((seed.lo % 100u) > (uint32_t)sparse) {
          skipPack = 1;
        }
      }
      if (skipPack || minGrp == 0 || maxGrp == 0 || maxGrp < minGrp) {
        packCount = 0u;
      } else {
        int32_t extra = call_RollLimitedFast(&seed, (int32_t)maxGrp - (int32_t)minGrp + 1);
        packCount = (uint8_t)((int32_t)minGrp + extra);
      }
    }
    rec->packCount = packCount;

    /* 5. Construct monster unit and roll Champion/Unique umods (0x6FC43CA0) + InitStats (0x6FCCFDB0). */
    memset(s_unit, 0, sizeof(s_unit));
    memset(s_monData, 0, sizeof(s_monData));
    *(uint32_t *)(s_unit + 0x00) = 1u; /* UNIT_MONSTER */
    *(uint32_t *)(s_unit + 0x04) = (uint32_t)chosenId;
    *(uint32_t *)(s_unit + 0x0C) = i + 1u;
    *(void **)(s_unit + 0x14) = s_monData;
    *(D2Seed64 *)(s_unit + 0x20) = seed;
    *(void **)(s_unit + 0x80) = s_game;
    *(void **)(s_monData + 0x00) = pMonStats;

    if (bElite) {
      int bAllowChampion = (bossMode == 2u) ? 0 : 1;
      s_monData[0x16] |= 0x08u; /* boss marker */
      pRollChampOrUnique(s_game, s_unit, bAllowChampion);
      if (s_monData[0x16] & 0x04u) {
        s_monData[0x16] &= (uint8_t)~0x08u;
      }
    }
    rec->monFlags = s_monData[0x16];
    for (int k = 0; k < 6; k++) {
      rec->umods[k] = s_monData[0x1C + k];
    }

    InitStatsArgs initArgs = {s_game, s_room, NULL};
    call_MonsterInitStats(s_unit, &initArgs);

    rec->mlvl     = (uint16_t)pGetUnitStat(s_unit, 12, 0);
    rec->maxHp    = pGetUnitStat(s_unit, 7, 0);
    rec->exp      = pGetUnitStat(s_unit, 13, 0);
    rec->ac       = (int16_t)pGetUnitStat(s_unit, 31, 0);
    rec->fireRes  = (int16_t)pGetUnitStat(s_unit, 39, 0);
    rec->lightRes = (int16_t)pGetUnitStat(s_unit, 41, 0);
    rec->coldRes  = (int16_t)pGetUnitStat(s_unit, 43, 0);
    rec->hpRegen  = pGetUnitStat(s_unit, 74, 0);

    D2Seed64 endSeed = *(D2Seed64 *)(s_unit + 0x20);
    rec->outSeedLo = endSeed.lo;
    rec->outSeedHi = endSeed.hi;
  }

  FILE *fp = fopen(outPath, "wb");
  if (!fp) {
    fprintf(stderr, "[monspawn-emitter] failed to open output: %s\n", outPath);
    return 8;
  }
  D2TVHeader hdr;
  d2tv_init_header(&hdr, "MONSPAWN", sizeof(MonSpawnVectorRecord), MONSPAWN_COUNT, MONSPAWN_SEED);
  if (fwrite(&hdr, sizeof(hdr), 1, fp) != 1 ||
      fwrite(records, sizeof(MonSpawnVectorRecord), MONSPAWN_COUNT, fp) != MONSPAWN_COUNT) {
    fclose(fp);
    return 9;
  }
  fclose(fp);
  printf("[monspawn-emitter] wrote %u MONSPAWN records (%u bytes each) to %s\n",
         MONSPAWN_COUNT, (unsigned)sizeof(MonSpawnVectorRecord), outPath);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
