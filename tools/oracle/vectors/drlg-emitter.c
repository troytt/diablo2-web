/*
 * drlg-emitter.c — Real-DLL D2TV Vector Emitter for [K1-5] DRLG (136 Levels).
 *
 * Drives 1.13c D2Common.dll DRLG in server mode (bClient = 0) across the
 * frozen 50-seed x 3-difficulty x 136-level matrix (20,400 combinations):
 *   1. ACT_LoadAct (#10951, 0x6FD8CB30) with pGame on a PAGE_NOACCESS page
 *      and kernel32!GetTickCount IAT-patched to 0x00010000.
 *   2. DRLG_AllocLevel (#10207, 0x6FD7D9B0) + DRLG_InitLevel (#10322, 0x6FD7E360)
 *      for all levels of the act in ascending levelId order, snapshotting the
 *      canonical RoomEx layout before any room activation.
 *   3. Internal RoomEx activator (0x6FDCC270, eax = pRoomEx) for each room in
 *      list order, hashing the resulting D2RoomCollisionGridStrc headers and
 *      16-bit subtile collision maps.
 *   4. ACT_UnloadAct (#10868, 0x6FD8C990) after each act.
 *
 * Emits three D2TV v1 binary files (compressed to .d2tv.gz by run-drlg-emitter.sh):
 *   - DRLGDIG  (56 B x 20,400 records): layout & collision SHA-256 digests
 *   - DRLGROOM (48 B x ~20.5k records): full RoomEx layout for seed 12345 x diffs 0..2
 *   - DRLGCOLL (7,232 B x 169 records): full town collision grids for seed 12345, diff 0
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

/* ------------------------------- Portable FIPS 180-4 SHA-256 */

typedef struct {
  uint32_t state[8];
  uint64_t bitcount;
  uint8_t  buffer[64];
} Sha256Ctx;

static const uint32_t kSha256K[64] = {
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
  0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
  0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
  0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
  0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcU, 0x53380d13u,
  0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
  0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
  0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
  0x90befffaU, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
};

static inline uint32_t rotr32(uint32_t x, uint32_t n) {
  return (x >> n) | (x << (32u - n));
}

static void sha256_transform(Sha256Ctx *ctx, const uint8_t data[64]) {
  uint32_t w[64];
  for (int i = 0; i < 16; i++) {
    w[i] = ((uint32_t)data[i * 4 + 0] << 24) |
           ((uint32_t)data[i * 4 + 1] << 16) |
           ((uint32_t)data[i * 4 + 2] << 8)  |
           ((uint32_t)data[i * 4 + 3]);
  }
  for (int i = 16; i < 64; i++) {
    uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
    uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
    w[i] = w[i - 16] + s0 + w[i - 7] + s1;
  }
  uint32_t a = ctx->state[0];
  uint32_t b = ctx->state[1];
  uint32_t c = ctx->state[2];
  uint32_t d = ctx->state[3];
  uint32_t e = ctx->state[4];
  uint32_t f = ctx->state[5];
  uint32_t g = ctx->state[6];
  uint32_t h = ctx->state[7];
  for (int i = 0; i < 64; i++) {
    uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
    uint32_t ch = (e & f) ^ ((~e) & g);
    uint32_t temp1 = h + S1 + ch + kSha256K[i] + w[i];
    uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
    uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temp2 = S0 + maj;
    h = g;
    g = f;
    f = e;
    e = d + temp1;
    d = c;
    c = b;
    b = a;
    a = temp1 + temp2;
  }
  ctx->state[0] += a;
  ctx->state[1] += b;
  ctx->state[2] += c;
  ctx->state[3] += d;
  ctx->state[4] += e;
  ctx->state[5] += f;
  ctx->state[6] += g;
  ctx->state[7] += h;
}

static void sha256_init(Sha256Ctx *ctx) {
  ctx->state[0] = 0x6a09e667u;
  ctx->state[1] = 0xbb67ae85u;
  ctx->state[2] = 0x3c6ef372u;
  ctx->state[3] = 0xa54ff53au;
  ctx->state[4] = 0x510e527fu;
  ctx->state[5] = 0x9b05688cu;
  ctx->state[6] = 0x1f83d9abu;
  ctx->state[7] = 0x5be0cd19u;
  ctx->bitcount = 0;
  memset(ctx->buffer, 0, sizeof(ctx->buffer));
}

static void sha256_update(Sha256Ctx *ctx, const void *data, size_t len) {
  if (len == 0) return;
  const uint8_t *p = (const uint8_t *)data;
  size_t idx = (size_t)((ctx->bitcount >> 3) & 0x3Fu);
  ctx->bitcount += (uint64_t)len << 3;
  size_t partLen = 64u - idx;
  size_t i = 0;
  if (len >= partLen) {
    memcpy(&ctx->buffer[idx], p, partLen);
    sha256_transform(ctx, ctx->buffer);
    for (i = partLen; i + 63u < len; i += 64u) {
      sha256_transform(ctx, &p[i]);
    }
    idx = 0;
  }
  memcpy(&ctx->buffer[idx], &p[i], len - i);
}

static uint64_t sha256_final_low64_le(Sha256Ctx *ctx) {
  uint8_t pad[64];
  uint8_t lenBits[8];
  for (int i = 0; i < 8; i++) {
    lenBits[i] = (uint8_t)(ctx->bitcount >> ((7 - i) * 8));
  }
  size_t idx = (size_t)((ctx->bitcount >> 3) & 0x3Fu);
  size_t padLen = (idx < 56u) ? (56u - idx) : (120u - idx);
  memset(pad, 0, sizeof(pad));
  pad[0] = 0x80u;
  sha256_update(ctx, pad, padLen);
  sha256_update(ctx, lenBits, 8u);
  uint8_t digest[32];
  for (int i = 0; i < 8; i++) {
    digest[i * 4 + 0] = (uint8_t)(ctx->state[i] >> 24);
    digest[i * 4 + 1] = (uint8_t)(ctx->state[i] >> 16);
    digest[i * 4 + 2] = (uint8_t)(ctx->state[i] >> 8);
    digest[i * 4 + 3] = (uint8_t)(ctx->state[i]);
  }
  uint64_t lo = 0;
  memcpy(&lo, digest, sizeof(lo));
  return lo;
}

static uint64_t fnv64_bytes(const void *data, size_t len) {
  const uint8_t *p = (const uint8_t *)data;
  uint64_t h = 14695981039346656037ULL;
  for (size_t i = 0; i < len; i++) {
    h ^= (uint64_t)p[i];
    h *= 1099511628211ULL;
  }
  return h;
}

/* ------------------------------- Frozen 50-Seed List */

#define NUM_SEEDS 50
#define NUM_DIFFS 3
#define NUM_LEVELS 136

static uint32_t g_seeds[NUM_SEEDS];

static uint32_t splitmix32_step(uint32_t *state) {
  uint32_t z = (*state += 0x9E3779B9u);
  z = (z ^ (z >> 16)) * 0x85EBCA6Bu;
  z = (z ^ (z >> 13)) * 0xC2B2AE35u;
  return z ^ (z >> 16);
}

static void init_seed_list(void) {
  static const uint32_t fixed[9] = {
    12345u, 0u, 1u, 2u, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu, 0xDEADBEEFu, 777u
  };
  for (int i = 0; i < 9; i++) g_seeds[i] = fixed[i];
  uint32_t sm_state = 0x9E3779B9u;
  for (int i = 9; i < NUM_SEEDS; i++) {
    g_seeds[i] = splitmix32_step(&sm_state);
  }
}

/* ------------------------------- D2TV Record Layouts */

#pragma pack(push, 1)

typedef struct {
  uint32_t seed;          /* +0x00 */
  uint8_t  diff;          /* +0x04 */
  uint8_t  act;           /* +0x05 */
  uint16_t levelId;       /* +0x06 */
  uint8_t  drlgType;      /* +0x08 */
  uint8_t  flags;         /* +0x09: bit0 = preAllocated, bit1 = wasInit */
  uint16_t nRoomList;     /* +0x0A */
  int32_t  posX;          /* +0x0C */
  int32_t  posY;          /* +0x10 */
  int32_t  sizeX;         /* +0x14 */
  int32_t  sizeY;         /* +0x18 */
  uint32_t nRoomsField;   /* +0x1C */
  uint64_t layoutHash;    /* +0x20 */
  uint64_t collHash;      /* +0x28 */
  uint32_t nCollRooms;    /* +0x30 */
  uint32_t totalSubtiles; /* +0x34 */
} DrlgDigestRecord;       /* 56 bytes */

typedef struct {
  uint16_t marker;        /* +0x00: 0xFFFF for level header */
  uint16_t levelId;       /* +0x02: 1..136 */
  uint8_t  act;           /* +0x04: 0..4 */
  uint8_t  diff;          /* +0x05: 0..2 */
  uint8_t  flags;         /* +0x06: bit0 = preAllocated, bit1 = wasInit */
  uint8_t  reserved;      /* +0x07: 0 */
  uint32_t drlgType;      /* +0x08: [pLevel+0x00] */
  uint32_t dwFlags;       /* +0x0C: [pLevel+0x04] */
  uint32_t nRooms;        /* +0x10: [pLevel+0x08] */
  int32_t  posX;          /* +0x14: [pLevel+0x1C] */
  int32_t  posY;          /* +0x18: [pLevel+0x20] */
  int32_t  sizeX;         /* +0x1C: [pLevel+0x24] */
  int32_t  sizeY;         /* +0x20: [pLevel+0x28] */
  uint32_t nLevelType;    /* +0x24: [pLevel+0x1C0] */
  uint32_t seedLo;        /* +0x28: [pLevel+0x1C4] */
  uint32_t seedHi;        /* +0x2C: [pLevel+0x1C8] */
} DrlgLevelHeaderRecord;  /* 48 bytes */

typedef struct {
  uint16_t levelId;       /* +0x00: 1..136 */
  uint16_t idx;           /* +0x02: 0..nRoomList-1 */
  int32_t  x;             /* +0x04: [pRoomEx+0x34] */
  int32_t  y;             /* +0x08: [pRoomEx+0x38] */
  int32_t  w;             /* +0x0C: [pRoomEx+0x3C] */
  int32_t  h;             /* +0x10: [pRoomEx+0x40] */
  uint32_t nType;         /* +0x14: [pRoomEx+0x48] */
  uint32_t dwFlags;       /* +0x18: [pRoomEx+0x28] */
  int32_t  presetId;      /* +0x1C: nType==2 && [+0x20] ? [[+0x20]+0x00] : -1 */
  int32_t  presetSub;     /* +0x20: nType==2 && [+0x20] ? [[+0x20]+0x04] : -1 */
  uint32_t dwInitSeed;    /* +0x24: [pRoomEx+0x04] */
  uint32_t seedLo;        /* +0x28: [pRoomEx+0x14] */
  uint32_t seedHi;        /* +0x2C: [pRoomEx+0x18] */
} DrlgRoomRecord;         /* 48 bytes */

typedef struct {
  int32_t  nSubtileX;      /* +0x00 */
  int32_t  nSubtileY;      /* +0x04 */
  int32_t  nSubtileWidth;  /* +0x08 */
  int32_t  nSubtileHeight; /* +0x0C */
  int32_t  nTileX;         /* +0x10 */
  int32_t  nTileY;         /* +0x14 */
  int32_t  nTileWidth;     /* +0x18 */
  int32_t  nTileHeight;    /* +0x1C */
  uint16_t map[3600];      /* +0x20: 7,200 bytes (60x60 max subtiles) */
} DrlgCollRecord;          /* 7,232 bytes */

#pragma pack(pop)

/* ------------------------------- DLL Function Typedefs */

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *InitTables_t)(int, int, int);
typedef void *(__stdcall *LoadAct_t)(uint32_t nAct, uint32_t seed, uint32_t bClient, void *pGame,
                                     uint32_t diff, void *pool, uint32_t town, void *cb1, void *cb2);
typedef void(__stdcall *UnloadAct_t)(void *pAct);
typedef uint8_t *(__fastcall *AllocLevel_t)(void *pDrlg, int levelId);
typedef void(__stdcall *InitLevel_t)(void *pLevel);

static inline uint32_t rd32(const uint8_t *p, int off) {
  return *(const uint32_t *)(p + off);
}

static inline int32_t rdi32(const uint8_t *p, int off) {
  return *(const int32_t *)(p + off);
}

/* ------------------------------- VEH & Host Stubs */

static volatile LONG g_in_drlg = 0;
static uint32_t g_cur_seed = 0;
static uint32_t g_cur_diff = 0;
static uint32_t g_cur_level = 0;

static LONG CALLBACK drlg_veh(EXCEPTION_POINTERS *ep) {
  if (!g_in_drlg) return EXCEPTION_CONTINUE_SEARCH;
  fprintf(stderr, "[drlg-emitter] HARDWARE FAULT 0x%08lx at %p (av=%p) on seed=%u diff=%u level=%u\n",
          ep->ExceptionRecord->ExceptionCode,
          ep->ExceptionRecord->ExceptionAddress,
          (void *)(ep->ExceptionRecord->NumberParameters > 1 ? ep->ExceptionRecord->ExceptionInformation[1] : 0),
          g_cur_seed, g_cur_diff, g_cur_level);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 9);
  return EXCEPTION_CONTINUE_SEARCH;
}

static void __cdecl stub_fog_assert(const char *msg, const char *file, int line) {
  fprintf(stderr, "[drlg-emitter] FOG ASSERT '%s' at %s:%d (0x%x) on seed=%u diff=%u level=%u\n",
          msg ? msg : "?", file ? file : "?", line, line,
          g_cur_seed, g_cur_diff, g_cur_level);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 10);
}

static DWORD WINAPI stub_GetTickCount(void) {
  return 0x00010000u;
}

static void hook_iat_entry(HMODULE mod, void *origFn, void *newFn) {
  uint8_t *base = (uint8_t *)mod;
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)base;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)(base + dos->e_lfanew);
  DWORD impRva = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT].VirtualAddress;
  if (!impRva) return;
  IMAGE_IMPORT_DESCRIPTOR *imp = (IMAGE_IMPORT_DESCRIPTOR *)(base + impRva);
  for (; imp->Name; imp++) {
    IMAGE_THUNK_DATA32 *thunk = (IMAGE_THUNK_DATA32 *)(base + imp->FirstThunk);
    for (; thunk->u1.Function; thunk++) {
      if ((void *)(uintptr_t)thunk->u1.Function == origFn) {
        DWORD oldProt = 0;
        VirtualProtect(&thunk->u1.Function, 4, PAGE_READWRITE, &oldProt);
        thunk->u1.Function = (DWORD)(uintptr_t)newFn;
        VirtualProtect(&thunk->u1.Function, 4, oldProt, &oldProt);
      }
    }
  }
}

static uint8_t *call_activate_roomex(uintptr_t fnActivate, uint8_t *pRoomEx) {
  uint8_t *activeRoom = NULL;
  __asm__ volatile(
    "call *%[fn]"
    : "=a"(activeRoom)
    : "a"(pRoomEx), [fn] "r"(fnActivate)
    : "ecx", "edx", "memory", "cc"
  );
  return activeRoom;
}

/* ------------------------------- Dynamic Room Buffer */

static DrlgRoomRecord *g_room_recs = NULL;
static uint32_t g_room_count = 0;
static uint32_t g_room_cap = 0;

static void append_room_buf(const void *rec48) {
  if (g_room_count >= g_room_cap) {
    uint32_t newCap = g_room_cap ? g_room_cap * 2u : 32768u;
    DrlgRoomRecord *next = (DrlgRoomRecord *)realloc(g_room_recs, (size_t)newCap * sizeof(DrlgRoomRecord));
    if (!next) {
      fprintf(stderr, "[drlg-emitter] Out of memory growing g_room_recs\n");
      TerminateProcess(GetCurrentProcess(), 5);
    }
    g_room_recs = next;
    g_room_cap = newCap;
  }
  memcpy(&g_room_recs[g_room_count++], rec48, sizeof(DrlgRoomRecord));
}

static DrlgCollRecord *g_coll_recs = NULL;
static uint32_t g_coll_count = 0;
static uint32_t g_coll_cap = 0;

static void append_coll_buf(const DrlgCollRecord *rec) {
  if (g_coll_count >= g_coll_cap) {
    uint32_t newCap = g_coll_cap ? g_coll_cap * 2u : 256u;
    DrlgCollRecord *next = (DrlgCollRecord *)realloc(g_coll_recs, (size_t)newCap * sizeof(DrlgCollRecord));
    if (!next) {
      fprintf(stderr, "[drlg-emitter] Out of memory growing g_coll_recs\n");
      TerminateProcess(GetCurrentProcess(), 5);
    }
    g_coll_recs = next;
    g_coll_cap = newCap;
  }
  memcpy(&g_coll_recs[g_coll_count++], rec, sizeof(DrlgCollRecord));
}

static int is_town_level(int levelId) {
  return levelId == 1 || levelId == 40 || levelId == 75 || levelId == 103 || levelId == 109;
}

/* ------------------------------- Core Combo Runner */

static void run_seed_diff_combo(
    HMODULE hCom,
    LoadAct_t LoadAct,
    UnloadAct_t UnloadAct,
    AllocLevel_t AllocLevel,
    InitLevel_t InitLevel,
    void *pGame,
    uint32_t seed,
    uint8_t diff,
    DrlgDigestRecord *outDigests136,
    int captureRooms,
    int captureTownColl,
    uint64_t *outEnvHash) {
  static const int kActLo[5] = {1, 40, 75, 103, 109};
  static const int kActHi[5] = {39, 74, 102, 108, 136};
  uintptr_t fnActivate = (uintptr_t)hCom - 0x6FD50000u + 0x6FDCC270u;

  Sha256Ctx envSha;
  sha256_init(&envSha);

  g_cur_seed = seed;
  g_cur_diff = diff;

  for (uint8_t act = 0; act < 5; act++) {
    g_cur_level = (uint32_t)kActLo[act];
    g_in_drlg = 1;
    uint8_t *pAct = (uint8_t *)LoadAct(act, seed, 0, pGame, diff, NULL, (uint32_t)kActLo[act], NULL, NULL);
    if (!pAct) {
      fprintf(stderr, "[drlg-emitter] LoadAct returned NULL (seed=%u diff=%u act=%u)\n", seed, diff, act);
      TerminateProcess(GetCurrentProcess(), 11);
    }
    uint8_t *pEnv = *(uint8_t **)(pAct + 0x04);
    if (pEnv) {
      sha256_update(&envSha, pEnv, 0x38u);
    }

    uint8_t *pDrlg = *(uint8_t **)(pAct + 0x48);
    uint8_t *levels[137];
    uint8_t levelFlags[137];
    memset(levels, 0, sizeof(levels));
    memset(levelFlags, 0, sizeof(levelFlags));

    /* Step 1: Allocate + Init all levels in ascending order & snapshot layout BEFORE room activation */
    for (int L = kActLo[act]; L <= kActHi[act]; L++) {
      g_cur_level = (uint32_t)L;
      uint8_t *pLevel = *(uint8_t **)(pDrlg + 0x47C);
      while (pLevel && (int)rd32(pLevel, 0x1D0) != L) {
        pLevel = *(uint8_t **)(pLevel + 0x1AC);
      }
      uint8_t preAlloc = (pLevel != NULL) ? 1u : 0u;
      if (!pLevel) {
        pLevel = AllocLevel(pDrlg, L);
      }
      uint8_t wasInit = (rd32(pLevel, 0x10) != 0u) ? 1u : 0u;
      if (!wasInit) {
        InitLevel(pLevel);
      }
      uint8_t flags = (uint8_t)(preAlloc | (wasInit << 1));
      levels[L] = pLevel;
      levelFlags[L] = flags;

      DrlgLevelHeaderRecord lvlHdr;
      memset(&lvlHdr, 0, sizeof(lvlHdr));
      lvlHdr.marker     = 0xFFFFu;
      lvlHdr.levelId    = (uint16_t)L;
      lvlHdr.act        = act;
      lvlHdr.diff       = diff;
      lvlHdr.flags      = flags;
      lvlHdr.reserved   = 0;
      lvlHdr.drlgType   = rd32(pLevel, 0x00);
      lvlHdr.dwFlags    = rd32(pLevel, 0x04);
      lvlHdr.nRooms     = rd32(pLevel, 0x08);
      lvlHdr.posX       = rdi32(pLevel, 0x1C);
      lvlHdr.posY       = rdi32(pLevel, 0x20);
      lvlHdr.sizeX      = rdi32(pLevel, 0x24);
      lvlHdr.sizeY      = rdi32(pLevel, 0x28);
      lvlHdr.nLevelType = rd32(pLevel, 0x1C0);
      lvlHdr.seedLo     = rd32(pLevel, 0x1C4);
      lvlHdr.seedHi     = rd32(pLevel, 0x1C8);

      Sha256Ctx layoutSha;
      sha256_init(&layoutSha);
      sha256_update(&layoutSha, &lvlHdr, sizeof(lvlHdr));
      if (captureRooms) {
        append_room_buf(&lvlHdr);
      }

      uint16_t roomIdx = 0;
      for (uint8_t *r = *(uint8_t **)(pLevel + 0x10); r; r = *(uint8_t **)(r + 0x24)) {
        DrlgRoomRecord rr;
        memset(&rr, 0, sizeof(rr));
        rr.levelId    = (uint16_t)L;
        rr.idx        = roomIdx++;
        rr.x          = rdi32(r, 0x34);
        rr.y          = rdi32(r, 0x38);
        rr.w          = rdi32(r, 0x3C);
        rr.h          = rdi32(r, 0x40);
        rr.nType      = rd32(r, 0x48);
        rr.dwFlags    = rd32(r, 0x28);
        uint8_t *pTypeData = *(uint8_t **)(r + 0x20);
        if (rr.nType == 2u && pTypeData != NULL) {
          rr.presetId  = rdi32(pTypeData, 0x00);
          rr.presetSub = rdi32(pTypeData, 0x04);
        } else {
          rr.presetId  = -1;
          rr.presetSub = -1;
        }
        rr.dwInitSeed = rd32(r, 0x04);
        rr.seedLo     = rd32(r, 0x14);
        rr.seedHi     = rd32(r, 0x18);

        sha256_update(&layoutSha, &rr, sizeof(rr));
        if (captureRooms) {
          append_room_buf(&rr);
        }
      }

      DrlgDigestRecord *dig = &outDigests136[L - 1];
      memset(dig, 0, sizeof(*dig));
      dig->seed          = seed;
      dig->diff          = diff;
      dig->act           = act;
      dig->levelId       = (uint16_t)L;
      dig->drlgType      = (uint8_t)lvlHdr.drlgType;
      dig->flags         = flags;
      dig->nRoomList     = roomIdx;
      dig->posX          = lvlHdr.posX;
      dig->posY          = lvlHdr.posY;
      dig->sizeX         = lvlHdr.sizeX;
      dig->sizeY         = lvlHdr.sizeY;
      dig->nRoomsField   = lvlHdr.nRooms;
      dig->layoutHash    = sha256_final_low64_le(&layoutSha);
    }

    /* Step 2: Activate rooms in ascending levelId & RoomEx list order and hash collision grids */
    for (int L = kActLo[act]; L <= kActHi[act]; L++) {
      g_cur_level = (uint32_t)L;
      uint8_t *pLevel = levels[L];
      uint8_t *roomList[4096];
      int nr = 0;
      for (uint8_t *r = *(uint8_t **)(pLevel + 0x10); r && nr < 4096; r = *(uint8_t **)(r + 0x24)) {
        roomList[nr++] = r;
      }

      Sha256Ctx collSha;
      sha256_init(&collSha);
      uint32_t nCollRooms = 0;
      uint32_t totalSubtiles = 0;
      int recordTown = captureTownColl && is_town_level(L);

      for (int i = 0; i < nr; i++) {
        uint8_t *activeRoom = call_activate_roomex(fnActivate, roomList[i]);
        if (!activeRoom) continue;
        uint8_t *cg = *(uint8_t **)(activeRoom + 0x20);
        if (!cg) continue;
        uint32_t w = rd32(cg, 0x08);
        uint32_t h = rd32(cg, 0x0C);
        uint32_t cells = w * h;
        uint16_t *mapPtr = *(uint16_t **)(cg + 0x20);
        sha256_update(&collSha, cg, 32u);
        if (mapPtr && cells > 0) {
          sha256_update(&collSha, mapPtr, (size_t)cells * sizeof(uint16_t));
        }
        nCollRooms++;
        totalSubtiles += cells;

        if (recordTown) {
          DrlgCollRecord cr;
          memset(&cr, 0, sizeof(cr));
          memcpy(&cr, cg, 32u);
          if (mapPtr && cells > 0) {
            uint32_t copyCells = cells <= 3600u ? cells : 3600u;
            memcpy(cr.map, mapPtr, (size_t)copyCells * sizeof(uint16_t));
          }
          append_coll_buf(&cr);
        }
      }

      DrlgDigestRecord *dig = &outDigests136[L - 1];
      dig->collHash      = sha256_final_low64_le(&collSha);
      dig->nCollRooms    = nCollRooms;
      dig->totalSubtiles = totalSubtiles;
    }

    UnloadAct(pAct);
    g_in_drlg = 0;
  }

  if (outEnvHash) {
    *outEnvHash = sha256_final_low64_le(&envSha);
  }
}

static int write_d2tv_file(const char *path, const char *kind, uint16_t flags,
                           uint32_t recSize, uint32_t recCount, uint64_t seed,
                           const void *payload) {
  FILE *fp = fopen(path, "wb");
  if (!fp) {
    fprintf(stderr, "[drlg-emitter] Failed to open '%s' for writing\n", path);
    return -1;
  }
  D2TVHeader hdr;
  d2tv_init_header(&hdr, kind, recSize, recCount, seed);
  hdr.flags = flags;
  if (fwrite(&hdr, sizeof(hdr), 1, fp) != 1) {
    fclose(fp);
    return -1;
  }
  size_t totalBytes = (size_t)recSize * (size_t)recCount;
  if (totalBytes > 0 && fwrite(payload, 1, totalBytes, fp) != totalBytes) {
    fclose(fp);
    return -1;
  }
  fclose(fp);
  return 0;
}

int main(int argc, char **argv) {
  if (sizeof(DrlgDigestRecord) != 56 || sizeof(DrlgLevelHeaderRecord) != 48 ||
      sizeof(DrlgRoomRecord) != 48 || sizeof(DrlgCollRecord) != 7232) {
    fprintf(stderr, "[drlg-emitter] Struct size mismatch!\n");
    return 2;
  }

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  init_seed_list();

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hK32   = GetModuleHandleA("kernel32.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hK32) {
    fprintf(stderr, "[drlg-emitter] Failed to load 1.13c DLLs\n");
    return 3;
  }

  SMemFree_t pFree = (SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  SFileOpenArchive_t pOpen = (SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));
  {
    IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hStorm;
    IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)hStorm + dos->e_lfanew);
    uintptr_t rb = (uintptr_t)hStorm - nt->OptionalHeader.ImageBase;
    void **pp = (void **)(0x6FC43120u + rb);
    if (*pp) {
      pFree(*pp, "p", 1, 0);
      *pp = NULL;
    }
  }
  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218)))();

  static const char *const kMpqs[6] = {
    "d2data.mpq", "d2char.mpq", "d2sfx.mpq", "d2speech.mpq", "d2exp.mpq", "Patch_D2.mpq"
  };
  static const DWORD kPrio[6] = {1000, 1000, 1000, 1000, 3000, 5000};
  for (int i = 0; i < 6; i++) {
    HANDLE h = 0;
    if (!pOpen(kMpqs[i], kPrio[i], 0, &h)) {
      pOpen(kMpqs[i], kPrio[i], 2, &h);
    }
  }

  int isExp = ((Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227)))();
  ((D2Lang_Init_t)(void (*)(void))GetProcAddress(hLang, MAKEINTRESOURCEA(10008)))(0, NULL, isExp);
  if (!((InitTables_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10943)))(0, 0, 0)) {
    fprintf(stderr, "[drlg-emitter] DATATBLS_LoadAllTxts (#10943) failed\n");
    return 4;
  }

  /* Install VEH, Fog.#10024 assert stub, and kernel32!GetTickCount IAT stub */
  AddVectoredExceptionHandler(1, drlg_veh);
  void *origAssert = (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10024));
  void *origTick   = (void *)GetProcAddress(hK32, "GetTickCount");
  hook_iat_entry(hCom, origAssert, (void *)stub_fog_assert);
  hook_iat_entry(hCom, origTick, (void *)stub_GetTickCount);

  LoadAct_t LoadAct       = (LoadAct_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10951));
  UnloadAct_t UnloadAct   = (UnloadAct_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10868));
  AllocLevel_t AllocLevel = (AllocLevel_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10207));
  InitLevel_t InitLevel   = (InitLevel_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10322));
  void *pGame = VirtualAlloc(NULL, 0x2000, MEM_RESERVE | MEM_COMMIT, PAGE_NOACCESS);

  /* Mode 1: --verify-order (runs 3 seeds forward vs reverse to verify zero cross-seed cache drift + ENV stability) */
  if (argc >= 2 && strcmp(argv[1], "--verify-order") == 0) {
    DrlgDigestRecord fwd[3][136];
    DrlgDigestRecord rev[3][136];
    uint64_t envFwd[3] = {0}, envRev[3] = {0};
    for (int i = 0; i < 3; i++) {
      run_seed_diff_combo(hCom, LoadAct, UnloadAct, AllocLevel, InitLevel, pGame,
                          g_seeds[i], 0, fwd[i], 0, 0, &envFwd[i]);
    }
    for (int i = 2; i >= 0; i--) {
      run_seed_diff_combo(hCom, LoadAct, UnloadAct, AllocLevel, InitLevel, pGame,
                          g_seeds[i], 0, rev[i], 0, 0, &envRev[i]);
    }
    for (int i = 0; i < 3; i++) {
      if (memcmp(fwd[i], rev[i], sizeof(fwd[i])) != 0) {
        fprintf(stderr, "[drlg-emitter] Forward vs Reverse mismatch on seed[%d]=%u!\n", i, g_seeds[i]);
        TerminateProcess(GetCurrentProcess(), 12);
      }
      if (envFwd[i] != envRev[i] || envFwd[i] != envFwd[0]) {
        fprintf(stderr, "[drlg-emitter] ENV hash instability: %016llx vs %016llx!\n",
                (unsigned long long)envFwd[i], (unsigned long long)envRev[i]);
        TerminateProcess(GetCurrentProcess(), 13);
      }
    }
    printf("[drlg-emitter] --verify-order OK (3 seeds forward == reverse, envHash=%016llx)\n",
           (unsigned long long)envFwd[0]);
    fflush(stdout);
    TerminateProcess(GetCurrentProcess(), 0);
  }

  /* Default mode: <out_digest.d2tv> <out_rooms.d2tv> <out_coll.d2tv> */
  const char *outDigestPath = argc > 1 ? argv[1] : "drlg-digest-113c.d2tv";
  const char *outRoomsPath  = argc > 2 ? argv[2] : "drlg-rooms-s12345.d2tv";
  const char *outCollPath   = argc > 3 ? argv[3] : "drlg-coll-towns-s12345-d0.d2tv";

  uint32_t totalDigests = NUM_SEEDS * NUM_DIFFS * NUM_LEVELS;
  DrlgDigestRecord *allDigests = (DrlgDigestRecord *)calloc(totalDigests, sizeof(DrlgDigestRecord));
  if (!allDigests) {
    fprintf(stderr, "[drlg-emitter] Out of memory allocating allDigests\n");
    return 5;
  }

  uint64_t refEnvHash = 0;
  for (int sIdx = 0; sIdx < NUM_SEEDS; sIdx++) {
    uint32_t seed = g_seeds[sIdx];
    for (uint8_t diff = 0; diff < NUM_DIFFS; diff++) {
      int capRooms = (seed == 12345u) ? 1 : 0;
      int capColl  = (seed == 12345u && diff == 0u) ? 1 : 0;
      uint32_t baseIdx = ((uint32_t)sIdx * NUM_DIFFS + (uint32_t)diff) * NUM_LEVELS;
      uint64_t envHash = 0;
      run_seed_diff_combo(
          hCom, LoadAct, UnloadAct, AllocLevel, InitLevel, pGame,
          seed, diff, &allDigests[baseIdx], capRooms, capColl, &envHash);
      if (sIdx == 0 && diff == 0) {
        refEnvHash = envHash;
      } else if (envHash != refEnvHash) {
        fprintf(stderr, "[drlg-emitter] ENV hash drift on seed=%u diff=%u!\n", seed, diff);
        TerminateProcess(GetCurrentProcess(), 13);
      }
    }
    if ((sIdx + 1) % 10 == 0 || sIdx == NUM_SEEDS - 1) {
      fprintf(stderr, "[drlg-emitter] Progress: %d/%d seeds (%u combos)\n",
              sIdx + 1, NUM_SEEDS, (uint32_t)(sIdx + 1) * NUM_DIFFS);
      fflush(stderr);
    }
  }

  uint16_t hdrFlags = (uint16_t)(isExp ? 1u : 0u);
  uint64_t seedListFnv = fnv64_bytes(g_seeds, sizeof(g_seeds));

  if (write_d2tv_file(outDigestPath, "DRLGDIG", hdrFlags,
                      sizeof(DrlgDigestRecord), totalDigests, seedListFnv, allDigests) != 0) {
    TerminateProcess(GetCurrentProcess(), 14);
  }
  if (write_d2tv_file(outRoomsPath, "DRLGROOM", hdrFlags,
                      sizeof(DrlgRoomRecord), g_room_count, 12345ULL, g_room_recs) != 0) {
    TerminateProcess(GetCurrentProcess(), 15);
  }
  if (write_d2tv_file(outCollPath, "DRLGCOLL", hdrFlags,
                      sizeof(DrlgCollRecord), g_coll_count, 12345ULL, g_coll_recs) != 0) {
    TerminateProcess(GetCurrentProcess(), 16);
  }

  printf("[drlg-emitter] Done: DRLGDIG=%u recs, DRLGROOM=%u recs, DRLGCOLL=%u recs, envHash=%016llx\n",
         totalDigests, g_room_count, g_coll_count, (unsigned long long)refEnvHash);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
