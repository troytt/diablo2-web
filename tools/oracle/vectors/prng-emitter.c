/*
 * PRNG binary test vector emitter (Plan §3.6.2, Gitea Milestone 31 [K0]).
 *
 * When compiled with i686-w64-mingw32-gcc (_WIN32) and run in the 1.13c directory,
 * dynamically loads D2Game.dll (0x6FC21180) and D2Common.dll (0x6FD510B0) to collect
 * ground-truth vectors directly from the original x86 binaries and cross-checks
 * every record against the C reference implementation.
 */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "vector-format.h"

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#define PRNG_RECORD_SIZE 24

#pragma pack(push, 1)
typedef struct {
  uint32_t initial_lo;
  uint32_t initial_hi;
  uint32_t n_max;
  uint32_t next_lo;
  uint32_t next_hi;
  uint32_t rolled_val;
} PrngRecord;
#pragma pack(pop)

typedef struct {
  uint32_t lo;
  uint32_t hi;
} D2SeedStrc;

static inline int32_t seed_next_c(D2SeedStrc *pSeed) {
  uint64_t v = (uint64_t)pSeed->lo * 0x6AC690C5ULL + pSeed->hi;
  pSeed->lo = (uint32_t)v;
  pSeed->hi = (uint32_t)(v >> 32);
  return (int32_t)pSeed->lo;
}

/* D2Game 0x6FC21180 / D2Common 0x6FD510B0: signed int32_t nMax check (`test esi, esi; jg`). */
static inline uint32_t seed_roll_c(D2SeedStrc *pSeed, uint32_t nMax) {
  if ((int32_t)nMax <= 0) return 0;
  uint32_t raw = (uint32_t)seed_next_c(pSeed);
  return raw % nMax;
}

#ifdef _WIN32
static uintptr_t g_fn_d2game_roll = 0;
static uintptr_t g_fn_d2common_roll = 0;

/* Calls custom x86 convention `eax = fn(eax = nMax, ecx = pSeed)` */
static uint32_t call_dll_seed_roll(uintptr_t fn, D2SeedStrc *pSeed, uint32_t nMax) {
  uint32_t out;
  __asm__ volatile (
    "call *%[fn]"
    : "=a"(out), "+c"(pSeed)
    : "a"(nMax), [fn]"r"(fn)
    : "edx", "memory", "cc"
  );
  return out;
}
#endif

static void get_boundary_seed(uint32_t idx, uint32_t *lo, uint32_t *hi) {
  switch (idx) {
    case 0: *lo = 0u;          *hi = 0u;          break;
    case 1: *lo = 1u;          *hi = 0u;          break;
    case 2: *lo = 0u;          *hi = 1u;          break;
    case 3: *lo = 0xFFFFFFFFu; *hi = 0xFFFFFFFFu; break;
    case 4: *lo = 0x7FFFFFFFu; *hi = 0x7FFFFFFFu; break;
    case 5: *lo = 0x80000000u; *hi = 0x80000000u; break;
    case 6: *lo = 0xFFFFFFFFu; *hi = 0u;          break;
    case 7: *lo = 0u;          *hi = 0xFFFFFFFFu; break;
    default:
      *lo = idx * 0x9E3779B9u;
      *hi = idx * 0x85EBCA6Bu;
      break;
  }
}

int main(int argc, char **argv) {
  uint32_t count = 10000;
  uint64_t master_seed = 1337;
  const char *out_path = "prng-10k.d2tv";
  if (argc > 1) out_path = argv[1];
  if (argc > 2) count = (uint32_t)atoi(argv[2]);

#ifdef _WIN32
  LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  if (hFog) {
    typedef void (__fastcall *FogInitSysFn)(int, void *);
    FogInitSysFn pInitSys = (FogInitSysFn)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
    if (pInitSys) pInitSys(1, NULL);
  }
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  HMODULE hD2Game = LoadLibraryA("D2Game.dll");
  if (!hD2Common || !hD2Game) {
    fprintf(stderr, "Failed to load D2Common.dll / D2Game.dll (err=%lu)\n", GetLastError());
    return 2;
  }
  IMAGE_NT_HEADERS32 *ntCommon = (IMAGE_NT_HEADERS32 *)((uint8_t *)hD2Common + ((IMAGE_DOS_HEADER *)hD2Common)->e_lfanew);
  IMAGE_NT_HEADERS32 *ntGame   = (IMAGE_NT_HEADERS32 *)((uint8_t *)hD2Game   + ((IMAGE_DOS_HEADER *)hD2Game)->e_lfanew);
  g_fn_d2common_roll = (uintptr_t)hD2Common - ntCommon->OptionalHeader.ImageBase + 0x6FD510B0u;
  g_fn_d2game_roll   = (uintptr_t)hD2Game   - ntGame->OptionalHeader.ImageBase   + 0x6FC21180u;
#endif

  FILE *fp = fopen(out_path, "wb");
  if (!fp) {
    perror("fopen");
    return 1;
  }

  D2TVHeader hdr;
  d2tv_init_header(&hdr, "PRNG", sizeof(PrngRecord), count, master_seed);
  fwrite(&hdr, 1, sizeof(hdr), fp);

  uint32_t gen = (uint32_t)master_seed;
  #define NEXT_RAND() (gen = gen * 1103515245U + 12345U)

  /* Exact 16 boundary nMax values per Plan §3.6.2 */
  static const uint32_t edgeNMax[16] = {
    0u, 1u, 2u, 3u, 4u, 7u, 8u, 15u,
    16u, 255u, 256u, 65535u, 65536u, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu
  };

  for (uint32_t i = 0; i < count; i++) {
    uint32_t init_lo, init_hi, n_max;
    if (i < 512u) {
      get_boundary_seed(i >> 4, &init_lo, &init_hi);
      n_max = edgeNMax[i & 15u];
    } else {
      init_lo = NEXT_RAND();
      init_hi = NEXT_RAND();
      uint32_t r = NEXT_RAND();
      if ((r & 7u) == 0u) {
        n_max = edgeNMax[(r >> 3) & 15u];
      } else if ((r & 7u) == 1u) {
        n_max = NEXT_RAND();
      } else {
        n_max = (r % 100000u) + 1u;
      }
    }

    D2SeedStrc seed_c = { init_lo, init_hi };
    uint32_t val_c = seed_roll_c(&seed_c, n_max);

#ifdef _WIN32
    D2SeedStrc seed_game = { init_lo, init_hi };
    uint32_t val_game = call_dll_seed_roll(g_fn_d2game_roll, &seed_game, n_max);
    D2SeedStrc seed_common = { init_lo, init_hi };
    uint32_t val_common = call_dll_seed_roll(g_fn_d2common_roll, &seed_common, n_max);

    if (val_game != val_c || seed_game.lo != seed_c.lo || seed_game.hi != seed_c.hi ||
        val_common != val_game || seed_common.lo != seed_game.lo || seed_common.hi != seed_game.hi) {
      fprintf(stderr, "DLL vs C PRNG mismatch at #%u (nMax=0x%08X): game=(%u,%u,%u) common=(%u,%u,%u) c=(%u,%u,%u)\n",
              i, n_max,
              seed_game.lo, seed_game.hi, val_game,
              seed_common.lo, seed_common.hi, val_common,
              seed_c.lo, seed_c.hi, val_c);
      fclose(fp);
      return 3;
    }
#endif

    PrngRecord rec;
    rec.initial_lo = init_lo;
    rec.initial_hi = init_hi;
    rec.n_max = n_max;
    rec.next_lo = seed_c.lo;
    rec.next_hi = seed_c.hi;
    rec.rolled_val = val_c;

    fwrite(&rec, 1, sizeof(rec), fp);
  }

  fclose(fp);
#ifdef _WIN32
  printf("Wrote %u DLL-verified (D2Game+D2Common) PRNG vectors to %s\n", count, out_path);
  TerminateProcess(GetCurrentProcess(), 0);
#else
  printf("Wrote %u PRNG vectors to %s\n", count, out_path);
#endif
  return 0;
}
