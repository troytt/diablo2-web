/*
 * k1r2-laneC-it5-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with real D2CMP.dll and Fog.dll)
 * under Wine and emits differential test vectors (NDJSON) for Lane C Iteration 5:
 *   - B028 (13 functions across maze.ts, drlg-ver.ts, room-tile.ts) -> b028-vectors.ndjson
 *   - B031 (18 functions in dungeon.ts)                             -> b031-vectors.ndjson
 *
 * Build:
 *   i686-w64-mingw32-gcc-win32 -O2 -o k1r2-laneC-it5-emitter.exe \
 *     tools/oracle/vectors/k1r2-laneC-it5-emitter.c
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef uint32_t u32;
typedef int32_t  s32;
typedef uint16_t u16;
typedef int16_t  s16;
typedef uint8_t  u8;

#define EXPECTED_BASE 0x6FD50000u
#define ARENA_ADDR    0x10000000u
#define ARENA_SIZE    0x00080000u
#define HEAP_ADDR     0x40000000u
#define HEAP_SIZE     0x00080000u

static uintptr_t g_base = 0;
static u8 *g_arena = NULL;
static u8 *g_heap = NULL;
static u32 g_heap_off = 0;

static u32 g_frees[32];
static int g_num_frees = 0;

#define RVA(va) (g_base - EXPECTED_BASE + (u32)(va))
#define PTR(off) ((u32)(ARENA_ADDR + (u32)(off)))
#define MEM(off) (g_arena + (u32)(off))
#define U32_AT(off) (*(u32 *)MEM(off))
#define S32_AT(off) (*(s32 *)MEM(off))
#define U16_AT(off) (*(u16 *)MEM(off))
#define U8_AT(off)  (*(u8 *)MEM(off))

/* =========================================================================
 * DETERMINISTIC FOG POOL HOOKS (#10045 alloc, #10046 free, #10047 realloc)
 * ========================================================================= */

static u32 bump_alloc(u32 size) {
  u32 aligned = (g_heap_off + 3u) & ~3u;
  if (aligned + size > HEAP_SIZE) {
    fprintf(stderr, "Out of deterministic heap at 0x40000000\n");
    ExitProcess(4);
  }
  u32 p = HEAP_ADDR + aligned;
  memset(g_heap + aligned, 0, size);
  g_heap_off = aligned + size;
  return p;
}

static u32 __attribute__((fastcall)) stub_fog_10045(
  u32 ecx, u32 edx, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)file; (void)line; (void)zero;
  return bump_alloc(edx);
}

static void __attribute__((fastcall)) stub_fog_10046(
  u32 ecx, u32 edx, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)file; (void)line; (void)zero;
  if (g_num_frees < 32) {
    g_frees[g_num_frees++] = edx;
  }
}

static u32 __attribute__((fastcall)) stub_fog_10047(
  u32 ecx, u32 edx, u32 new_size, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)edx; (void)file; (void)line; (void)zero;
  return bump_alloc(new_size);
}

/* =========================================================================
 * MEMORY SNAPSHOT & NDJSON SERIALIZATION
 * ========================================================================= */

typedef struct {
  u32 addr;
  u32 len;
  int is_bytes;
  u8 *pre;
  u8 *post;
} TrackedBlock;

#define MAX_BLOCKS 32
static TrackedBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static void reset_case(void) {
  memset(g_arena, 0, 0x20000);
  if (g_heap_off > 0) {
    memset(g_heap, 0, (g_heap_off + 3u) & ~3u);
  }
  g_heap_off = 0;
  g_num_frees = 0;
  for (int i = 0; i < g_num_blocks; i++) {
    free(g_blocks[i].pre);
    free(g_blocks[i].post);
  }
  g_num_blocks = 0;
}

static void track_dwords(u32 addr, u32 byte_len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "Too many tracked blocks\n");
    ExitProcess(5);
  }
  TrackedBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len = byte_len;
  b->is_bytes = 0;
  b->pre = (u8 *)malloc(byte_len);
  b->post = (u8 *)malloc(byte_len);
  memcpy(b->pre, (const void *)(uintptr_t)addr, byte_len);
}

static void track_bytes(u32 addr, u32 byte_len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "Too many tracked blocks\n");
    ExitProcess(5);
  }
  TrackedBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len = byte_len;
  b->is_bytes = 1;
  b->pre = (u8 *)malloc(byte_len);
  b->post = (u8 *)malloc(byte_len);
  memcpy(b->pre, (const void *)(uintptr_t)addr, byte_len);
}

static void write_dword_kv(FILE *fp, int *first, u32 addr, u32 val) {
  if (!*first) fputc(',', fp);
  *first = 0;
  fprintf(fp, "\"0x%08x\":%u", addr, val);
}

static void write_byte_kv(FILE *fp, int *first, u32 addr, u8 val) {
  if (!*first) fputc(',', fp);
  *first = 0;
  fprintf(fp, "\"0x%08x\":%u", addr, (u32)val);
}

static void emit_case(
  FILE *fp,
  u32 va,
  int case_idx,
  const char *note,
  const u32 *args,
  int nargs,
  u32 eax
) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(uintptr_t)g_blocks[i].addr, g_blocks[i].len);
  }

  fprintf(fp, "{\"va\":\"0x%08x\",\"case\":%d,\"note\":\"%s\",\"in\":{\"args\":[", va, case_idx, note);
  for (int i = 0; i < nargs; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"mem\":{");
  int first_in = 1;
  for (int i = 0; i < g_num_blocks; i++) {
    TrackedBlock *b = &g_blocks[i];
    if (b->is_bytes) {
      for (u32 off = 0; off < b->len; off++) {
        write_byte_kv(fp, &first_in, b->addr + off, b->pre[off]);
      }
    } else {
      const u32 *words = (const u32 *)b->pre;
      u32 count = b->len / 4;
      for (u32 k = 0; k < count; k++) {
        write_dword_kv(fp, &first_in, b->addr + k * 4, words[k]);
      }
    }
  }
  fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
  int first_out = 1;
  for (int i = 0; i < g_num_blocks; i++) {
    TrackedBlock *b = &g_blocks[i];
    if (b->is_bytes) {
      for (u32 off = 0; off < b->len; off++) {
        if (b->post[off] != b->pre[off]) {
          write_byte_kv(fp, &first_out, b->addr + off, b->post[off]);
        }
      }
    } else {
      const u32 *pre_w = (const u32 *)b->pre;
      const u32 *post_w = (const u32 *)b->post;
      u32 count = b->len / 4;
      for (u32 k = 0; k < count; k++) {
        if (post_w[k] != pre_w[k]) {
          write_dword_kv(fp, &first_out, b->addr + k * 4, post_w[k]);
        }
      }
    }
  }
  if (g_heap_off > 0) {
    u32 heap_words = ((g_heap_off + 3u) & ~3u) / 4u;
    const u32 *hw = (const u32 *)g_heap;
    for (u32 k = 0; k < heap_words; k++) {
      write_dword_kv(fp, &first_out, HEAP_ADDR + k * 4, hw[k]);
    }
  }
  fprintf(fp, "},\"frees\":[");
  for (int i = 0; i < g_num_frees; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", g_frees[i]);
  }
  fprintf(fp, "]}}\n");
  fflush(fp);
}

/* =========================================================================
 * B028 REGISTER-ONLY INLINE ASM WRAPPERS (13 FUNCTIONS)
 * ========================================================================= */

/* 1. 0x6FD5E3E0: ecx = pLevel -> eax, ret */
static __attribute__((noinline)) u32 call_6FD5E3E0(u32 pLevel) {
  u32 r_eax = 0;
  u32 r_ecx = pLevel;
  u32 r_edx = (u32)RVA(0x6FD5E3E0);
  __asm__ volatile (
    "call *%2\n\t"
    : "=a"(r_eax), "+c"(r_ecx), "+d"(r_edx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 2. 0x6FD62E50: edi = pRoomEx, eax = bNoExtraWidth, edx = bNoExtraHeight,
 *    stack (pFlagGrid, pTypeGrid, nDefaultType), ret 0xC */
static __attribute__((noinline)) void call_6FD62E50(
  u32 pRoomEx, u32 bNoExtraWidth, u32 bNoExtraHeight,
  u32 pFlagGrid, u32 pTypeGrid, s32 nDefaultType
) {
  u32 sargs[4] = { pFlagGrid, pTypeGrid, (u32)nDefaultType, (u32)RVA(0x6FD62E50) };
  u32 r_edi = pRoomEx;
  u32 r_eax = bNoExtraWidth;
  u32 r_edx = bNoExtraHeight;
  uintptr_t r_ecx = (uintptr_t)sargs;
  __asm__ volatile (
    "pushl 8(%3)\n\t"
    "pushl 4(%3)\n\t"
    "pushl 0(%3)\n\t"
    "call *12(%3)\n\t"
    : "+D"(r_edi), "+a"(r_eax), "+d"(r_edx), "+c"(r_ecx)
    :
    : "ebx", "esi", "cc", "memory"
  );
}

/* 3. 0x6FD69950: eax = pLevel, edx = nLevelId -> eax, ret */
static __attribute__((noinline)) u32 call_6FD69950(u32 pLevel, s32 nLevelId) {
  u32 r_eax = pLevel;
  s32 r_edx = nLevelId;
  u32 r_ecx = (u32)RVA(0x6FD69950);
  __asm__ volatile (
    "call *%2\n\t"
    : "+a"(r_eax), "+d"(r_edx), "+c"(r_ecx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 4. 0x6FD6B3D0: edi = ppVertices, ebx = pMemPool, ret */
static __attribute__((noinline)) u32 call_6FD6B3D0(u32 ppVertices, u32 pMemPool) {
  u32 r_eax = 0;
  u32 r_edi = ppVertices;
  u32 r_ebx = pMemPool;
  u32 r_ecx = (u32)RVA(0x6FD6B3D0);
  __asm__ volatile (
    "call *%3\n\t"
    : "=a"(r_eax), "+D"(r_edi), "+b"(r_ebx), "+c"(r_ecx)
    :
    : "edx", "esi", "cc", "memory"
  );
  return r_eax;
}

/* 5. 0x6FD6B4B0: stdcall (pMemPool, pRoomCoords, pOtherList, nDir, bFlag), ret 0x14 */
typedef void (__stdcall *fn_6FD6B4B0_t)(u32, u32, u32, u32, u32);

/* 6. 0x6FD6B890: stdcall (nIndex) -> eax, ret 4 */
typedef u32 (__stdcall *fn_6FD6B890_t)(s32);

/* 7. 0x6FD8D920: esi = pLevel, stack [esp+4] = nVertexId, ret 4 */
static __attribute__((noinline)) void call_6FD8D920(u32 pLevel, s32 nVertexId) {
  u32 r_esi = pLevel;
  s32 r_eax = nVertexId;
  u32 r_ecx = (u32)RVA(0x6FD8D920);
  __asm__ volatile (
    "pushl %1\n\t"
    "call *%2\n\t"
    : "+S"(r_esi), "+a"(r_eax), "+c"(r_ecx)
    :
    : "ebx", "edx", "edi", "cc", "memory"
  );
}

/* 8. 0x6FDB7F50: eax = pRoomEx, edi = pMemPool, ret */
static __attribute__((noinline)) void call_6FDB7F50(u32 pRoomEx, u32 pMemPool) {
  u32 r_eax = pRoomEx;
  u32 r_edi = pMemPool;
  u32 r_ecx = (u32)RVA(0x6FDB7F50);
  __asm__ volatile (
    "call *%2\n\t"
    : "+a"(r_eax), "+D"(r_edi), "+c"(r_ecx)
    :
    : "ebx", "edx", "esi", "cc", "memory"
  );
}

/* 9. 0x6FDB7FD0: esi = pTileGrid, edi = nAddRoofs, ret */
static __attribute__((noinline)) void call_6FDB7FD0(u32 pTileGrid, s32 nAddRoofs) {
  u32 r_esi = pTileGrid;
  s32 r_edi = nAddRoofs;
  u32 r_ecx = (u32)RVA(0x6FDB7FD0);
  __asm__ volatile (
    "call *%2\n\t"
    : "+S"(r_esi), "+D"(r_edi), "+c"(r_ecx)
    :
    : "eax", "ebx", "edx", "cc", "memory"
  );
}

/* 10. 0x6FDB8040: eax = pRoomEx, ret */
static __attribute__((noinline)) void call_6FDB8040(u32 pRoomEx) {
  u32 r_eax = pRoomEx;
  u32 r_ecx = (u32)RVA(0x6FDB8040);
  __asm__ volatile (
    "call *%1\n\t"
    : "+a"(r_eax), "+c"(r_ecx)
    :
    : "ebx", "edx", "esi", "edi", "cc", "memory"
  );
}

/* 11. 0x6FDB8B90: ecx = pRoomEx, eax = dwTileFlags, stack [esp+4] = nOrientation -> eax, ret 4 */
static __attribute__((noinline)) u32 call_6FDB8B90(u32 pRoomEx, u32 dwTileFlags, s32 nOrientation) {
  u32 r_eax = dwTileFlags;
  u32 r_ecx = pRoomEx;
  s32 r_edx = nOrientation;
  u32 r_esi = (u32)RVA(0x6FDB8B90);
  __asm__ volatile (
    "pushl %2\n\t"
    "call *%3\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+S"(r_esi)
    :
    : "ebx", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 12. 0x6FDB8CD0: ecx = pRoomEx, edx = nX, ebx = dwTileFlags,
 *     stack (ppTileList, nY, pTileCache) -> eax, ret 0xC */
static __attribute__((noinline)) u32 call_6FDB8CD0(
  u32 pRoomEx, s32 nX, u32 dwTileFlags, u32 ppTileList, s32 nY, u32 pTileCache
) {
  u32 sargs[4] = { ppTileList, (u32)nY, pTileCache, (u32)RVA(0x6FDB8CD0) };
  u32 r_eax = 0;
  u32 r_ecx = pRoomEx;
  s32 r_edx = nX;
  u32 r_ebx = dwTileFlags;
  uintptr_t r_esi = (uintptr_t)sargs;
  __asm__ volatile (
    "pushl 8(%4)\n\t"
    "pushl 4(%4)\n\t"
    "pushl 0(%4)\n\t"
    "call *12(%4)\n\t"
    : "=a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+b"(r_ebx), "+S"(r_esi)
    :
    : "edi", "cc", "memory"
  );
  return r_eax;
}

/* 13. 0x6FDB8DF0: eax = pRoomEx, esi = pTileData, edx = nX, ecx = nY,
 *     stack (dwTileFlags, pTileCache), ret 8 */
static __attribute__((noinline)) void call_6FDB8DF0(
  u32 pRoomEx, u32 pTileData, s32 nX, s32 nY, u32 dwTileFlags, u32 pTileCache
) {
  u32 sargs[3] = { dwTileFlags, pTileCache, (u32)RVA(0x6FDB8DF0) };
  u32 r_eax = pRoomEx;
  u32 r_esi = pTileData;
  s32 r_edx = nX;
  s32 r_ecx = nY;
  uintptr_t r_edi = (uintptr_t)sargs;
  __asm__ volatile (
    "pushl 4(%4)\n\t"
    "pushl 0(%4)\n\t"
    "call *8(%4)\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+d"(r_edx), "+c"(r_ecx), "+D"(r_edi)
    :
    : "ebx", "cc", "memory"
  );
}

/* =========================================================================
 * B031 REGISTER-ONLY INLINE ASM & STDCALL WRAPPERS (18 FUNCTIONS)
 * ========================================================================= */

/* 1. 0x6FD7D600: eax = pDrlg, edi = nX, esi = nY -> eax, ret */
static __attribute__((noinline)) u32 call_6FD7D600(u32 pDrlg, s32 nX, s32 nY) {
  u32 r_eax = pDrlg;
  s32 r_edi = nX;
  s32 r_esi = nY;
  u32 r_ecx = (u32)RVA(0x6FD7D600);
  __asm__ volatile (
    "call *%3\n\t"
    : "+a"(r_eax), "+D"(r_edi), "+S"(r_esi), "+c"(r_ecx)
    :
    : "ebx", "edx", "cc", "memory"
  );
  return r_eax;
}

/* 3. 0x6FD8B3A0: ecx = pRoom -> eax, ret */
static __attribute__((noinline)) u32 call_6FD8B3A0(u32 pRoom) {
  u32 r_eax = 0;
  u32 r_ecx = pRoom;
  u32 r_edx = (u32)RVA(0x6FD8B3A0);
  __asm__ volatile (
    "call *%2\n\t"
    : "=a"(r_eax), "+c"(r_ecx), "+d"(r_edx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 10. 0x6FD8B5B0: eax = pRoom -> eax, ret */
static __attribute__((noinline)) u32 call_6FD8B5B0(u32 pRoom) {
  u32 r_eax = pRoom;
  u32 r_ecx = (u32)RVA(0x6FD8B5B0);
  __asm__ volatile (
    "call *%1\n\t"
    : "+a"(r_eax), "+c"(r_ecx)
    :
    : "ebx", "edx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef void (__stdcall *fn_std1_void_t)(u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef void (__stdcall *fn_std3_void_t)(u32, u32, u32);

/* =========================================================================
 * HELPER FOR BUILDING D2TileLibraryHashStrc NODES IN ARENA
 * ========================================================================= */
static u32 calc_tile_bucket(s32 orient, s32 style, s32 seq) {
  u8 al = (u8)seq;
  u8 cl = (u8)orient;
  u8 dl = (u8)style;
  u8 res = (u8)((u8)(al << 1) - cl + dl);
  return (u32)(res & 0x7Fu);
}

/* =========================================================================
 * EMIT B028 (13 FUNCTIONS)
 * ========================================================================= */
static void emit_b028(FILE *fp) {
  /* -----------------------------------------------------------------------
   * 1. 0x6FD5E3E0: DRLGMAZE_HasMapDS1113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      u8 diff;
      u32 vals[3];
    } cases[4] = {
      { "diff0_val1_returns_1", 0, { 1, 0, 0 } },
      { "diff1_val2_returns_0", 1, { 1, 2, 1 } },
      { "diff2_val1_returns_1", 2, { 0, 0, 1 } },
      { "diff2_val0_returns_0", 2, { 1, 1, 0 } },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pLevel = PTR(0x100);
      u32 pMaze  = PTR(0x300);
      u32 pDrlg  = PTR(0x400);

      U32_AT(0x100 + 0x14)  = pMaze;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x300 + 0x04)  = cases[c].vals[0];
      U32_AT(0x300 + 0x08)  = cases[c].vals[1];
      U32_AT(0x300 + 0x0C)  = cases[c].vals[2];
      U8_AT(0x400 + 0x450)  = cases[c].diff;

      track_dwords(pLevel, 0x1C0);
      track_dwords(pMaze, 0x10);
      track_bytes(pDrlg + 0x450, 4);

      u32 args[1] = { pLevel };
      u32 eax = call_6FD5E3E0(pLevel);
      emit_case(fp, 0x6FD5E3E0u, c, cases[c].note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 2. 0x6FD62E50: DRLGROOMTILE_CountPresetTileTypes113c (6 cases)
   * ----------------------------------------------------------------------- */
  {
    /* Case 0: maxH <= 0 early exit (nTileHeight = 0, bNoExtraHeight = 1) */
    {
      reset_case();
      u32 pRoomEx   = PTR(0x100);
      u32 pTileGrid = PTR(0x200);
      u32 pFlagGrid = PTR(0x300);
      U32_AT(0x100 + 0x3C) = 2;
      U32_AT(0x100 + 0x40) = 0;
      U32_AT(0x100 + 0x54) = pTileGrid;
      track_dwords(pRoomEx, 0xF0);
      track_dwords(pTileGrid, 0x30);
      u32 args[6] = { pRoomEx, 1, 1, pFlagGrid, 0, 10 };
      call_6FD62E50(pRoomEx, 1, 1, pFlagGrid, 0, 10);
      emit_case(fp, 0x6FD62E50u, 0, "maxH_zero_early_exit", args, 6, 0);
    }

    /* Case 1: maxW <= 0 skips inner loop (nTileWidth = 0, bNoExtraWidth = 1, maxH = 2) */
    {
      reset_case();
      u32 pRoomEx   = PTR(0x100);
      u32 pTileGrid = PTR(0x200);
      u32 pFlagGrid = PTR(0x300);
      U32_AT(0x100 + 0x3C) = 0;
      U32_AT(0x100 + 0x40) = 1;
      U32_AT(0x100 + 0x54) = pTileGrid;
      track_dwords(pRoomEx, 0xF0);
      track_dwords(pTileGrid, 0x30);
      u32 args[6] = { pRoomEx, 1, 0, pFlagGrid, 0, 10 };
      call_6FD62E50(pRoomEx, 1, 0, pFlagGrid, 0, 10);
      emit_case(fp, 0x6FD62E50u, 1, "maxW_zero_skips_inner_loop", args, 6, 0);
    }

    /* Case 2: pTypeGrid != 0, 3 cells with floor (0x02), wall (0x01), roof (0x08000000),
     *         and 1 cell with no 0x08000003 bits; D2CMP.#10059 returns 3 matches with wFlags = 0x0100 */
    {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pTileGrid  = PTR(0x200);
      u32 pFlagGrid  = PTR(0x300);
      u32 pFlagRows  = PTR(0x320);
      u32 pFlagCells = PTR(0x340);
      u32 pTypeGrid  = PTR(0x400);
      u32 pTypeRows  = PTR(0x420);
      u32 pTypeCells = PTR(0x440);
      u32 pHash      = PTR(0x500);
      u32 pNode      = PTR(0x800);
      u32 pBlk0      = PTR(0x840);
      u32 pBlk1      = PTR(0x860);
      u32 pBlk2      = PTR(0x880);
      u32 pEntry0    = PTR(0x900);

      /* w=2 (nTileWidth=2, bNoExtraWidth=1), h=2 (nTileHeight=2, bNoExtraHeight=1) */
      U32_AT(0x100 + 0x28) = 0x10u;
      U32_AT(0x100 + 0x3C) = 2;
      U32_AT(0x100 + 0x40) = 2;
      U32_AT(0x100 + 0x54) = pTileGrid;
      U32_AT(0x100 + 0x68) = pHash;

      U32_AT(0x200 + 0x18) = 10; /* nWallCapacity */
      U32_AT(0x200 + 0x20) = 20; /* nFloorCapacity */
      U32_AT(0x200 + 0x28) = 30; /* nRoofCapacity */

      U32_AT(0x300 + 0x00) = pFlagCells;
      U32_AT(0x300 + 0x04) = pFlagRows;
      U32_AT(0x320 + 0x00) = 0;
      U32_AT(0x320 + 0x04) = 2;

      /* style=3, seq=5 -> (3 << 20) | (5 << 8) = 0x00300500 */
      U32_AT(0x340 + 0x00) = 0x00300500u;              /* no 0x08000003 bits -> skipped */
      U32_AT(0x340 + 0x04) = 0x00300502u;              /* bit 0x02 -> floor */
      U32_AT(0x340 + 0x08) = 0x00300501u;              /* bit 0x01 -> wall */
      U32_AT(0x340 + 0x0C) = 0x08300500u;              /* bit 0x08000000 -> roof */

      U32_AT(0x400 + 0x00) = pTypeCells;
      U32_AT(0x400 + 0x04) = pTypeRows;
      U32_AT(0x420 + 0x00) = 0;
      U32_AT(0x420 + 0x04) = 2;
      U32_AT(0x440 + 0x00) = 4;
      U32_AT(0x440 + 0x04) = 4;
      U32_AT(0x440 + 0x08) = 4;
      U32_AT(0x440 + 0x0C) = 4;

      u32 bucket = calc_tile_bucket(4, 3, 5);
      U32_AT(0x500 + bucket * 4) = pNode;
      U32_AT(0x800 + 0x00) = 3; /* nStyle */
      U32_AT(0x800 + 0x04) = 5; /* nSeq */
      U32_AT(0x800 + 0x08) = 4; /* nOrientation */
      U32_AT(0x800 + 0x0C) = pBlk0;
      U32_AT(0x840 + 0x00) = pEntry0;
      U32_AT(0x840 + 0x04) = pBlk1;
      U32_AT(0x860 + 0x00) = pEntry0;
      U32_AT(0x860 + 0x04) = pBlk2;
      U32_AT(0x880 + 0x00) = pEntry0;
      U32_AT(0x880 + 0x04) = 0;
      U16_AT(0x900 + 0x06) = 0x0100u;

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pTileGrid, 0x30);
      track_dwords(pFlagGrid, 0x60);
      track_dwords(pTypeGrid, 0x60);
      track_dwords(pHash, 0x200);
      track_dwords(pNode, 0x110);

      u32 args[6] = { pRoomEx, 1, 1, pFlagGrid, pTypeGrid, 0 };
      call_6FD62E50(pRoomEx, 1, 1, pFlagGrid, pTypeGrid, 0);
      emit_case(fp, 0x6FD62E50u, 2, "type_grid_floor_wall_roof_capacities_updated", args, 6, 0);
    }

    /* Case 3: pTypeGrid == 0 (uses nDefaultType=9), bNoExtraWidth=0, bNoExtraHeight=0,
     *         wFlags lacks 0x0100 (0x00FF) -> capacities unchanged */
    {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pTileGrid  = PTR(0x200);
      u32 pFlagGrid  = PTR(0x300);
      u32 pFlagRows  = PTR(0x320);
      u32 pFlagCells = PTR(0x340);
      u32 pHash      = PTR(0x500);
      u32 pNode      = PTR(0x800);
      u32 pBlk0      = PTR(0x840);
      u32 pEntry0    = PTR(0x900);

      U32_AT(0x100 + 0x3C) = 0; /* +1 from bNoExtraWidth=0 -> maxW=1 */
      U32_AT(0x100 + 0x40) = 0; /* +1 from bNoExtraHeight=0 -> maxH=1 */
      U32_AT(0x100 + 0x54) = pTileGrid;
      U32_AT(0x100 + 0x68) = pHash;
      U32_AT(0x200 + 0x20) = 7;

      U32_AT(0x300 + 0x00) = pFlagCells;
      U32_AT(0x300 + 0x04) = pFlagRows;
      U32_AT(0x320 + 0x00) = 0;
      U32_AT(0x340 + 0x00) = 0x00200402u; /* style=2, seq=4, bit 0x02 */

      u32 bucket = calc_tile_bucket(9, 2, 4);
      U32_AT(0x500 + bucket * 4) = pNode;
      U32_AT(0x800 + 0x00) = 2; /* nStyle */
      U32_AT(0x800 + 0x04) = 4; /* nSeq */
      U32_AT(0x800 + 0x08) = 9; /* nOrientation */
      U32_AT(0x800 + 0x0C) = pBlk0;
      U32_AT(0x840 + 0x00) = pEntry0;
      U32_AT(0x840 + 0x04) = 0;
      U16_AT(0x900 + 0x06) = 0x00FFu; /* ah & 1 == 0 */

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pTileGrid, 0x30);
      track_dwords(pFlagGrid, 0x60);
      track_dwords(pHash, 0x200);
      track_dwords(pNode, 0x110);

      u32 args[6] = { pRoomEx, 0, 0, pFlagGrid, 0, 9 };
      call_6FD62E50(pRoomEx, 0, 0, pFlagGrid, 0, 9);
      emit_case(fp, 0x6FD62E50u, 3, "default_type_flags_without_0x100_no_update", args, 6, 0);
    }

    /* Case 4: D2CMP.#10059 returns 0 matches (empty hash slot) */
    {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pTileGrid  = PTR(0x200);
      u32 pFlagGrid  = PTR(0x300);
      u32 pFlagRows  = PTR(0x320);
      u32 pFlagCells = PTR(0x340);

      U32_AT(0x100 + 0x3C) = 1;
      U32_AT(0x100 + 0x40) = 1;
      U32_AT(0x100 + 0x54) = pTileGrid;
      U32_AT(0x300 + 0x00) = pFlagCells;
      U32_AT(0x300 + 0x04) = pFlagRows;
      U32_AT(0x340 + 0x00) = 0x00100103u;

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pTileGrid, 0x30);
      track_dwords(pFlagGrid, 0x60);

      u32 args[6] = { pRoomEx, 1, 1, pFlagGrid, 0, 5 };
      call_6FD62E50(pRoomEx, 1, 1, pFlagGrid, 0, 5);
      emit_case(fp, 0x6FD62E50u, 4, "find_tiles_zero_matches", args, 6, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 3. 0x6FD69950: DRLGROOMTILE_GetWarpLevelsArray113c (6 cases)
   * ----------------------------------------------------------------------- */
  {
    /* Cases 0..5:
     * 0: preset list first node match
     * 1: preset list second node match
     * 2: preset list miss -> fallback LevelDefBin
     * 3: preset list null -> valid LevelDefBin (levelId = 2)
     * 4: preset list null -> levelId < 0 (-1) -> returns 0x68
     * 5: preset list null -> levelId >= nLevels (5 >= 4) -> returns 0x68
     */
    for (int c = 0; c < 6; c++) {
      reset_case();
      u32 pLevel       = PTR(0x100);
      u32 pNode0       = PTR(0x200);
      u32 pNode1       = PTR(0x300);
      u32 sgpt         = PTR(0x400);
      u32 pLevelDefBin = PTR(0x2000);

      *(u32 *)RVA(0x6FDE9E1C) = sgpt;
      *(u32 *)RVA(0x6FDF0B38) = pLevelDefBin;
      U32_AT(0x400 + 0xC5C) = 4; /* nLevelsTxtRecordCount = 4 */

      U32_AT(0x200 + 0x00) = 10;
      U32_AT(0x200 + 0x44) = pNode1;
      U32_AT(0x300 + 0x00) = 25;
      U32_AT(0x300 + 0x44) = 0;

      U32_AT(0x100 + 0x90) = (c < 3) ? pNode0 : 0;

      s32 lvl = 0;
      const char *note = "";
      if (c == 0) { lvl = 10; note = "preset_first_node_match"; }
      else if (c == 1) { lvl = 25; note = "preset_second_node_match"; }
      else if (c == 2) { lvl = 3;  note = "preset_miss_fallback_leveldef"; }
      else if (c == 3) { lvl = 2;  note = "no_preset_valid_leveldef"; }
      else if (c == 4) { lvl = -1; note = "negative_level_id_returns_0x68"; }
      else { lvl = 5; note = "level_id_ge_count_returns_0x68"; }

      track_dwords(pLevel, 0xA0);
      track_dwords(pNode0, 0x48);
      track_dwords(pNode1, 0x48);
      track_dwords(sgpt + 0xC5C, 4);
      track_dwords((u32)RVA(0x6FDE9E1C), 4);
      track_dwords((u32)RVA(0x6FDF0B38), 4);

      u32 args[2] = { pLevel, (u32)lvl };
      u32 eax = call_6FD69950(pLevel, lvl);
      emit_case(fp, 0x6FD69950u, c, note, args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 4. 0x6FD6B3D0: DRLGVER_FreeVertices113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    /* Case 0: *ppVertices == 0 */
    {
      reset_case();
      u32 ppVerts = PTR(0x100);
      U32_AT(0x100) = 0;
      track_dwords(ppVerts, 4);
      u32 args[2] = { 0xCAFE0001u, ppVerts };
      (void)call_6FD6B3D0(ppVerts, 0xCAFE0001u);
      emit_case(fp, 0x6FD6B3D0u, 0, "null_head_noop", args, 2, 0);
    }
    /* Case 1: single node (pHead->pNext == 0) */
    {
      reset_case();
      u32 ppVerts = PTR(0x100);
      u32 v0      = PTR(0x200);
      U32_AT(0x100) = v0;
      U32_AT(0x200 + 0x10) = 0;
      track_dwords(ppVerts, 4);
      track_dwords(v0, 0x14);
      u32 args[2] = { 0xCAFE0001u, ppVerts };
      (void)call_6FD6B3D0(ppVerts, 0xCAFE0001u);
      emit_case(fp, 0x6FD6B3D0u, 1, "single_vertex_freed", args, 2, 0);
    }
    /* Case 2: 3-node null-terminated chain (v0 -> v1 -> v2 -> 0) */
    {
      reset_case();
      u32 ppVerts = PTR(0x100);
      u32 v0      = PTR(0x200);
      u32 v1      = PTR(0x240);
      u32 v2      = PTR(0x280);
      U32_AT(0x100) = v0;
      U32_AT(0x200 + 0x10) = v1;
      U32_AT(0x240 + 0x10) = v2;
      U32_AT(0x280 + 0x10) = 0;
      track_dwords(ppVerts, 4);
      track_dwords(v0, 0x14);
      track_dwords(v1, 0x14);
      track_dwords(v2, 0x14);
      u32 args[2] = { 0xCAFE0001u, ppVerts };
      (void)call_6FD6B3D0(ppVerts, 0xCAFE0001u);
      emit_case(fp, 0x6FD6B3D0u, 2, "three_node_null_terminated_chain", args, 2, 0);
    }
    /* Case 3: 3-node circular chain (v0 -> v1 -> v2 -> v0) */
    {
      reset_case();
      u32 ppVerts = PTR(0x100);
      u32 v0      = PTR(0x200);
      u32 v1      = PTR(0x240);
      u32 v2      = PTR(0x280);
      U32_AT(0x100) = v0;
      U32_AT(0x200 + 0x10) = v1;
      U32_AT(0x240 + 0x10) = v2;
      U32_AT(0x280 + 0x10) = v0;
      track_dwords(ppVerts, 4);
      track_dwords(v0, 0x14);
      track_dwords(v1, 0x14);
      track_dwords(v2, 0x14);
      u32 args[2] = { 0xCAFE0001u, ppVerts };
      (void)call_6FD6B3D0(ppVerts, 0xCAFE0001u);
      emit_case(fp, 0x6FD6B3D0u, 3, "three_node_circular_chain", args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 5. 0x6FD6B4B0: DRLGVER_CreateVerticesForRoom113c (6 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_6FD6B4B0_t fn = (fn_6FD6B4B0_t)RVA(0x6FD6B4B0);

    /* Helper macro-like setup for 4 base vertices v0 -> v1 -> v2 -> v3 -> v0
     * Room box: x in [10..30], y in [20..50]
     * v0: (10, 50), v1: (10, 20), v2: (30, 20), v3: (30, 50)
     */
    for (int c = 0; c < 6; c++) {
      reset_case();
      u32 v0 = PTR(0x100);
      u32 v1 = PTR(0x120);
      u32 v2 = PTR(0x140);
      u32 v3 = PTR(0x160);
      u32 pRoomCoords = PTR(0x200);
      u32 pOpt0       = PTR(0x240);
      u32 pNode0      = PTR(0x300);
      u32 pNode1      = PTR(0x340);

      U32_AT(0x100 + 0x00) = 10; U32_AT(0x100 + 0x04) = 50; U32_AT(0x100 + 0x10) = v1;
      U32_AT(0x120 + 0x00) = 10; U32_AT(0x120 + 0x04) = 20; U32_AT(0x120 + 0x10) = v2;
      U32_AT(0x140 + 0x00) = 30; U32_AT(0x140 + 0x04) = 20; U32_AT(0x140 + 0x10) = v3;
      U32_AT(0x160 + 0x00) = 30; U32_AT(0x160 + 0x04) = 50; U32_AT(0x160 + 0x10) = v0;

      /* pRoomCoords fallback box: x=12, y=25, w=10, h=15 */
      U32_AT(0x200 + 0x00) = 12;
      U32_AT(0x200 + 0x04) = 25;
      U32_AT(0x200 + 0x08) = 10;
      U32_AT(0x200 + 0x0C) = 15;

      /* pOpt0 box: x=14, y=28, w=8, h=12 */
      U32_AT(0x240 + 0x00) = 14;
      U32_AT(0x240 + 0x04) = 28;
      U32_AT(0x240 + 0x08) = 8;
      U32_AT(0x240 + 0x0C) = 12;

      u32 pOtherList = pNode0;
      u32 bFlag = 3;
      const char *note = "";

      if (c == 0) {
        pOtherList = 0;
        note = "empty_other_list_noop";
      } else if (c == 1) {
        /* Dir 0 (left edge y: 50->20, mult=-1), pOptCoords=0 (uses pRoomCoords y=25, h=15 -> 25..40), dwFlags=1 */
        U32_AT(0x300 + 0x04) = 0;
        U32_AT(0x300 + 0x08) = 1;
        U32_AT(0x300 + 0x10) = 0;
        U32_AT(0x300 + 0x14) = 0;
        note = "dir0_both_splits_with_flag2";
      } else if (c == 2) {
        /* Dir 1 (top edge x: 10->30, mult=+1), pOptCoords=pOpt0 (x=14, w=8 -> 14..22), dwFlags=0 */
        U32_AT(0x300 + 0x04) = 1;
        U32_AT(0x300 + 0x08) = 0;
        U32_AT(0x300 + 0x10) = pOpt0;
        U32_AT(0x300 + 0x14) = 0;
        bFlag = 5;
        note = "dir1_opt_coords_both_splits_flag1_only";
      } else if (c == 3) {
        /* Dir 2 (right edge y: 20->50, mult=+1), pOptCoords=pOpt0 (y=28, h=12 -> 28..40), dwFlags=1 */
        U32_AT(0x300 + 0x04) = 2;
        U32_AT(0x300 + 0x08) = 1;
        U32_AT(0x300 + 0x10) = pOpt0;
        U32_AT(0x300 + 0x14) = 0;
        note = "dir2_both_splits";
      } else if (c == 4) {
        /* Dir 3 (bottom edge x: 30->10, mult=-1), pOptCoords=0 (x=12, w=10 -> 12..22), dwFlags=0 */
        U32_AT(0x300 + 0x04) = 3;
        U32_AT(0x300 + 0x08) = 0;
        U32_AT(0x300 + 0x10) = 0;
        U32_AT(0x300 + 0x14) = 0;
        note = "dir3_both_splits";
      } else {
        /* Two nodes in pOtherList: node0 non-overlapping before start (x=2..6 on dir 1),
         * node1 non-overlapping after end (x=35..40 on dir 1) */
        U32_AT(0x200 + 0x00) = 2;
        U32_AT(0x200 + 0x08) = 4;
        U32_AT(0x240 + 0x00) = 35;
        U32_AT(0x240 + 0x08) = 5;
        U32_AT(0x300 + 0x04) = 1;
        U32_AT(0x300 + 0x10) = 0;
        U32_AT(0x300 + 0x14) = pNode1;
        U32_AT(0x340 + 0x04) = 1;
        U32_AT(0x340 + 0x10) = pOpt0;
        U32_AT(0x340 + 0x14) = 0;
        note = "two_nodes_non_overlapping_before_and_after";
      }

      track_dwords(v0, 0x80);
      track_dwords(pRoomCoords, 0x10);
      track_dwords(pOpt0, 0x10);
      track_dwords(pNode0, 0x60);

      u32 args[5] = { 0xCAFE0002u, v0, pRoomCoords, bFlag, pOtherList };
      fn(0xCAFE0002u, v0, pRoomCoords, bFlag, pOtherList);
      emit_case(fp, 0x6FD6B4B0u, c, note, args, 5, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 6. 0x6FD6B890: DATATBLS_GetCubemainTxtRecord113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_6FD6B890_t fn = (fn_6FD6B890_t)RVA(0x6FD6B890);
    s32 indices[4] = { 0, 1, 7, 15 };
    const char *notes[4] = {
      "index_0_base_ptr",
      "index_1_stride_328",
      "index_7_mid_table",
      "index_15_last_record",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pBase = PTR(0x2000);
      *(u32 *)RVA(0x6FDF1464) = pBase;
      *(u32 *)RVA(0x6FDF1468) = 16;

      track_dwords((u32)RVA(0x6FDF1464), 8);

      u32 args[1] = { (u32)indices[c] };
      u32 eax = fn(indices[c]);
      emit_case(fp, 0x6FD6B890u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 7. 0x6FD8D920: DRLGVER_ScaleOutdoorsVertices113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    /* Case 0: pVertices[nVertexId] == 0 -> rolls seed once and returns */
    {
      reset_case();
      u32 pLevel    = PTR(0x100);
      u32 pDrlg     = PTR(0x300);
      u32 pOutdoors = PTR(0x800);

      U32_AT(0x100 + 0x14)  = pOutdoors;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x100 + 0x1C4) = 0x12345678u;
      U32_AT(0x100 + 0x1C8) = 0x00000001u;
      U32_AT(0x300 + 0x478) = 0xCAFE0003u;
      U32_AT(0x800 + 0x68 + 2 * 4) = 0; /* pVertices[2] == 0 */

      track_dwords(pLevel, 0x1D0);
      track_dwords(pDrlg + 0x478, 4);
      track_dwords(pOutdoors, 0x220);
      track_dwords((u32)RVA(0x6FDE4020), 0x20);

      u32 args[2] = { pLevel, 2 };
      call_6FD8D920(pLevel, 2);
      emit_case(fp, 0x6FD8D920u, 0, "null_vertex_head_rolls_seed_once", args, 2, 0);
    }

    /* Case 1: bLevelType != 4 (prepends vertex), pHead->pNext == 0 -> returns before loop */
    {
      reset_case();
      u32 pLevel    = PTR(0x100);
      u32 pDrlg     = PTR(0x300);
      u32 pOutdoors = PTR(0x800);
      u32 v0        = PTR(0xB00);

      U32_AT(0x100 + 0x14)  = pOutdoors;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x100 + 0x1C4) = 0x11112222u;
      U32_AT(0x100 + 0x1C8) = 0x00000003u;
      U32_AT(0x300 + 0x478) = 0xCAFE0003u;

      U32_AT(0x800 + 0x68 + 1 * 4) = v0;
      /* ebx = pOutdoors + (1 * 5) * 4 = pOutdoors + 0x14 */
      U32_AT(0x800 + 0x14 + 0x170) = 11;
      U32_AT(0x800 + 0x14 + 0x174) = 22;
      U32_AT(0x800 + 0x14 + 0x1E8) = 33;
      U32_AT(0x800 + 0x14 + 0x1EC) = 44;
      U8_AT(0x800 + 0x14 + 0x1F0)  = 2; /* != 4 */

      U32_AT(0xB00 + 0x00) = 99;
      U32_AT(0xB00 + 0x04) = 88;
      U32_AT(0xB00 + 0x10) = 0;

      track_dwords(pLevel, 0x1D0);
      track_dwords(pDrlg + 0x478, 4);
      track_dwords(pOutdoors, 0x220);
      track_dwords(v0, 0x14);
      track_dwords((u32)RVA(0x6FDE4020), 0x20);

      u32 args[2] = { pLevel, 1 };
      call_6FD8D920(pLevel, 1);
      emit_case(fp, 0x6FD8D920u, 1, "level_type_not_4_prepend_single_vertex", args, 2, 0);
    }

    /* Case 2: bLevelType != 4, 3-node chain (v0 -> v1 -> v2 -> 0) */
    {
      reset_case();
      u32 pLevel    = PTR(0x100);
      u32 pDrlg     = PTR(0x300);
      u32 pOutdoors = PTR(0x800);
      u32 v0        = PTR(0xB00);
      u32 v1        = PTR(0xB20);
      u32 v2        = PTR(0xB40);

      U32_AT(0x100 + 0x14)  = pOutdoors;
      U32_AT(0x100 + 0x1C)  = 100;
      U32_AT(0x100 + 0x20)  = 200;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x100 + 0x1C4) = 0xABCDEF01u;
      U32_AT(0x100 + 0x1C8) = 0x00000005u;
      U32_AT(0x300 + 0x478) = 0xCAFE0003u;

      U32_AT(0x800 + 0x68 + 0 * 4) = v0;
      U32_AT(0x800 + 0x80)  = 70;
      U32_AT(0x800 + 0x84)  = 80;
      U32_AT(0x800 + 0xF8)  = 50;
      U32_AT(0x800 + 0xFC)  = 60;
      U32_AT(0x800 + 0x170) = 10;
      U32_AT(0x800 + 0x174) = 20;
      U32_AT(0x800 + 0x1E8) = 30;
      U32_AT(0x800 + 0x1EC) = 40;
      U8_AT(0x800 + 0x1F0)  = 1; /* != 4 */

      U32_AT(0xB00 + 0x00) = 1; U32_AT(0xB00 + 0x04) = 2; U32_AT(0xB00 + 0x10) = v1;
      U32_AT(0xB20 + 0x00) = 3; U32_AT(0xB20 + 0x04) = 4; U32_AT(0xB20 + 0x10) = v2;
      U32_AT(0xB40 + 0x00) = 5; U32_AT(0xB40 + 0x04) = 6; U32_AT(0xB40 + 0x10) = 0;

      track_dwords(pLevel, 0x1D0);
      track_dwords(pDrlg + 0x478, 4);
      track_dwords(pOutdoors, 0x220);
      track_dwords(v0, 0x60);
      track_dwords((u32)RVA(0x6FDE4020), 0x20);

      u32 args[2] = { pLevel, 0 };
      call_6FD8D920(pLevel, 0);
      emit_case(fp, 0x6FD8D920u, 2, "level_type_not_4_three_node_chain", args, 2, 0);
    }

    /* Case 3: bLevelType == 4 (skips prepend), 6-node chain (v0..v5) cycling idx through 0..3 */
    {
      reset_case();
      u32 pLevel    = PTR(0x100);
      u32 pDrlg     = PTR(0x300);
      u32 pOutdoors = PTR(0x800);
      u32 v0        = PTR(0xB00);

      U32_AT(0x100 + 0x14)  = pOutdoors;
      U32_AT(0x100 + 0x1C)  = 400;
      U32_AT(0x100 + 0x20)  = 500;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x100 + 0x1C4) = 0x00000003u;
      U32_AT(0x100 + 0x1C8) = 0x00000007u;
      U32_AT(0x300 + 0x478) = 0xCAFE0003u;

      U32_AT(0x800 + 0x68 + 0 * 4) = v0;
      U32_AT(0x800 + 0x80)  = 77;
      U32_AT(0x800 + 0x84)  = 88;
      U32_AT(0x800 + 0xF8)  = 55;
      U32_AT(0x800 + 0xFC)  = 66;
      U32_AT(0x800 + 0x170) = 15;
      U32_AT(0x800 + 0x174) = 25;
      U8_AT(0x800 + 0x1F0)  = 4; /* == 4 */

      for (int i = 0; i < 6; i++) {
        u32 off = 0xB00 + (u32)(i * 0x20);
        U32_AT(off + 0x00) = (u32)(i + 2);
        U32_AT(off + 0x04) = (u32)(i + 10);
        U32_AT(off + 0x10) = (i < 5) ? PTR(off + 0x20) : 0;
      }

      track_dwords(pLevel, 0x1D0);
      track_dwords(pDrlg + 0x478, 4);
      track_dwords(pOutdoors, 0x220);
      track_dwords(v0, 0xC0);
      track_dwords((u32)RVA(0x6FDE4020), 0x20);

      u32 args[2] = { pLevel, 0 };
      call_6FD8D920(pLevel, 0);
      emit_case(fp, 0x6FD8D920u, 3, "level_type_4_six_node_chain_wraps_idx", args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 8. 0x6FDB7F50: DRLGROOMTILE_FreeTileDataArrays113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      int has_grid;
      u32 walls, floors, roofs;
    } cases[4] = {
      { "null_tile_grid_noop", 0, 0, 0, 0 },
      { "all_three_arrays_freed", 1, PTR(0x400), PTR(0x500), PTR(0x600) },
      { "only_floors_freed", 1, 0, PTR(0x500), 0 },
      { "all_arrays_null_noop", 1, 0, 0, 0 },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx   = PTR(0x100);
      u32 pTileGrid = PTR(0x200);
      U32_AT(0x100 + 0x54) = cases[c].has_grid ? pTileGrid : 0;
      U32_AT(0x200 + 0x14) = cases[c].walls;
      U32_AT(0x200 + 0x1C) = cases[c].floors;
      U32_AT(0x200 + 0x24) = cases[c].roofs;

      track_dwords(pRoomEx, 0x60);
      track_dwords(pTileGrid, 0x30);

      u32 args[2] = { pRoomEx, 0xCAFE0004u };
      call_6FDB7F50(pRoomEx, 0xCAFE0004u);
      emit_case(fp, 0x6FDB7F50u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. 0x6FDB7FD0: DRLGROOMTILE_ReallocRoofTiles113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      u32 nRoofs;
      u32 nCap;
      s32 nAdd;
    } cases[4] = {
      { "add_zero_noop", 2, 4, 0 },
      { "nRoofs_0_add_2", 0, 0, 2 },
      { "nRoofs_1_add_3", 1, 1, 3 },
      { "nRoofs_4_add_2_links_chain", 4, 4, 2 },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pTileGrid = PTR(0x100);
      U32_AT(0x100 + 0x10) = cases[c].nRoofs;
      U32_AT(0x100 + 0x24) = PTR(0x300);
      U32_AT(0x100 + 0x28) = cases[c].nCap;

      track_dwords(pTileGrid, 0x30);

      u32 args[2] = { pTileGrid, (u32)cases[c].nAdd };
      call_6FDB7FD0(pTileGrid, cases[c].nAdd);
      emit_case(fp, 0x6FDB7FD0u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 10. 0x6FDB8040: DRLGROOMTILE_AllocTileData113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      u32 wallCap, floorCap, nFloors, roofCap, pRoofs;
    } cases[4] = {
      { "all_three_allocated", 2, 2, 2, 2, 0 },
      { "all_capacities_zero", 0, 0, 0, 0, 0 },
      { "roof_already_allocated_skipped", 1, 0, 0, 3, PTR(0x600) },
      { "floor_partial_zeroing_only", 0, 3, 1, 0, 0 },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx   = PTR(0x100);
      u32 pLevel    = PTR(0x200);
      u32 pDrlg     = PTR(0x400);
      u32 pTileGrid = PTR(0x900);

      U32_AT(0x100 + 0x54) = pTileGrid;
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x200 + 0x1B4) = pDrlg;
      U32_AT(0x400 + 0x478) = 0xCAFE0005u;

      U32_AT(0x900 + 0x18) = cases[c].wallCap;
      U32_AT(0x900 + 0x20) = cases[c].floorCap;
      /* Wait: in 0x6FDB8040, esi = pTileGrid + 0x14:
       * [esi+0x00] = pWalls (+0x14)
       * [esi+0x04] = nWallCap (+0x18)
       * [esi+0x08] = pFloors (+0x1C)
       * [esi+0x0C] = nFloorCap (+0x20)
       * [esi+0x10] = pRoofs (+0x24)
       * [esi+0x14] = nRoofCap (+0x28)
       */
      U32_AT(0x900 + 0x24) = cases[c].pRoofs;
      U32_AT(0x900 + 0x28) = cases[c].roofCap;

      track_dwords(pRoomEx, 0x60);
      track_dwords(pLevel + 0x1B4, 4);
      track_dwords(pDrlg + 0x478, 4);
      track_dwords(pTileGrid, 0x30);

      u32 args[1] = { pRoomEx };
      call_6FDB8040(pRoomEx);
      emit_case(fp, 0x6FDB8040u, c, cases[c].note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 11. 0x6FDB8B90: DRLGROOMTILE_GetTileCache113c (6 cases)
   * ----------------------------------------------------------------------- */
  {
    /* Case 0: primary match count == 0, fallback (10, 0, 0) returns pEntryFallback */
    {
      reset_case();
      u32 pRoomEx  = PTR(0x100);
      u32 pHash    = PTR(0x300);
      u32 pNodeFb  = PTR(0x600);
      u32 pBlkFb   = PTR(0x640);
      u32 pEntryFb = PTR(0x700);

      U32_AT(0x100 + 0x14) = 0x12345678u;
      U32_AT(0x100 + 0x18) = 0x00000001u;
      U32_AT(0x100 + 0x68) = pHash;

      u32 fbBucket = calc_tile_bucket(10, 0, 0);
      U32_AT(0x300 + fbBucket * 4) = pNodeFb;
      U32_AT(0x600 + 0x00) = 0;  /* nStyle */
      U32_AT(0x600 + 0x04) = 0;  /* nSeq */
      U32_AT(0x600 + 0x08) = 10; /* nOrientation */
      U32_AT(0x600 + 0x0C) = pBlkFb;
      U32_AT(0x640 + 0x00) = pEntryFb;
      U32_AT(0x640 + 0x04) = 0;
      U32_AT(0x700 + 0x20) = 5;

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pHash, 0x200);
      track_dwords(pNodeFb, 0x130);

      u32 flags = 0x00200300u; /* style=2, seq=3 */
      u32 args[3] = { pRoomEx, flags, 4 };
      u32 eax = call_6FDB8B90(pRoomEx, flags, 4);
      emit_case(fp, 0x6FDB8B90u, 0, "primary_miss_uses_fallback_10_0_0", args, 3, eax);
    }

    /* Case 1: dwTileFlags == 0, 1 match with rarity == 0 (totalRarity == 0, no seed roll) */
    {
      reset_case();
      u32 pRoomEx = PTR(0x100);
      u32 pHash   = PTR(0x300);
      u32 pNode   = PTR(0x600);
      u32 pBlk0   = PTR(0x640);
      u32 pEntry0 = PTR(0x700);

      U32_AT(0x100 + 0x14) = 0x12345678u;
      U32_AT(0x100 + 0x18) = 0x00000001u;
      U32_AT(0x100 + 0x68) = pHash;

      u32 bucket = calc_tile_bucket(2, 0, 0);
      U32_AT(0x300 + bucket * 4) = pNode;
      U32_AT(0x600 + 0x00) = 0; /* nStyle */
      U32_AT(0x600 + 0x04) = 0; /* nSeq */
      U32_AT(0x600 + 0x08) = 2; /* nOrientation */
      U32_AT(0x600 + 0x0C) = pBlk0;
      U32_AT(0x640 + 0x00) = pEntry0;
      U32_AT(0x640 + 0x04) = 0;
      U32_AT(0x700 + 0x20) = 0; /* rarity = 0 */

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pHash, 0x200);
      track_dwords(pNode, 0x130);

      u32 args[3] = { pRoomEx, 0, 2 };
      u32 eax = call_6FDB8B90(pRoomEx, 0, 2);
      emit_case(fp, 0x6FDB8B90u, 1, "flags_zero_single_match_zero_rarity", args, 3, eax);
    }

    /* Case 2: 1 match with rarity == 4 (power-of-two seed roll, ebp == 1 skips selection loop) */
    {
      reset_case();
      u32 pRoomEx = PTR(0x100);
      u32 pHash   = PTR(0x300);
      u32 pNode   = PTR(0x600);
      u32 pBlk0   = PTR(0x640);
      u32 pEntry0 = PTR(0x700);

      U32_AT(0x100 + 0x14) = 0x55556666u;
      U32_AT(0x100 + 0x18) = 0x00000002u;
      U32_AT(0x100 + 0x68) = pHash;

      u32 bucket = calc_tile_bucket(1, 3, 7);
      U32_AT(0x300 + bucket * 4) = pNode;
      U32_AT(0x600 + 0x00) = 3; /* nStyle */
      U32_AT(0x600 + 0x04) = 7; /* nSeq */
      U32_AT(0x600 + 0x08) = 1; /* nOrientation */
      U32_AT(0x600 + 0x0C) = pBlk0;
      U32_AT(0x640 + 0x00) = pEntry0;
      U32_AT(0x640 + 0x04) = 0;
      U32_AT(0x700 + 0x20) = 4;

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pHash, 0x200);
      track_dwords(pNode, 0x130);

      u32 flags = (3u << 20) | (7u << 8);
      u32 args[3] = { pRoomEx, flags, 1 };
      u32 eax = call_6FDB8B90(pRoomEx, flags, 1);
      emit_case(fp, 0x6FDB8B90u, 2, "single_match_pow2_rarity_rolls_seed", args, 3, eax);
    }

    /* Cases 3 & 4: 3 matches with rarities (2, 3, 5) -> totalRarity = 10 (non-pow2 div branch)
     * Case 5: 3 matches with rarities (1, 3, 4) -> totalRarity = 8 (pow2 mask branch) */
    for (int sub = 0; sub < 3; sub++) {
      reset_case();
      u32 pRoomEx = PTR(0x100);
      u32 pHash   = PTR(0x300);
      u32 pNode   = PTR(0x600);
      u32 pBlk0   = PTR(0x640);
      u32 pBlk1   = PTR(0x660);
      u32 pBlk2   = PTR(0x680);
      u32 pEntry0 = PTR(0x700);
      u32 pEntry1 = PTR(0x740);
      u32 pEntry2 = PTR(0x780);

      U32_AT(0x100 + 0x14) = (sub == 0) ? 0x00000001u : (sub == 1) ? 0x77778888u : 0x9999AAAAu;
      U32_AT(0x100 + 0x18) = (u32)(sub + 3);
      U32_AT(0x100 + 0x68) = pHash;

      u32 bucket = calc_tile_bucket(0, 5, 2);
      U32_AT(0x300 + bucket * 4) = pNode;
      U32_AT(0x600 + 0x00) = 5; /* nStyle */
      U32_AT(0x600 + 0x04) = 2; /* nSeq */
      U32_AT(0x600 + 0x08) = 0; /* nOrientation */
      U32_AT(0x600 + 0x0C) = pBlk0;
      U32_AT(0x640 + 0x00) = pEntry0;
      U32_AT(0x640 + 0x04) = pBlk1;
      U32_AT(0x660 + 0x00) = pEntry1;
      U32_AT(0x660 + 0x04) = pBlk2;
      U32_AT(0x680 + 0x00) = pEntry2;
      U32_AT(0x680 + 0x04) = 0;

      U32_AT(0x700 + 0x20) = (sub == 2) ? 1 : 2;
      U32_AT(0x740 + 0x20) = 3;
      U32_AT(0x780 + 0x20) = (sub == 2) ? 4 : 5;

      track_dwords(pRoomEx, 0xF0);
      track_dwords(pHash, 0x200);
      track_dwords(pNode, 0x1B0);

      u32 flags = (5u << 20) | (2u << 8);
      u32 args[3] = { pRoomEx, flags, 0 };
      u32 eax = call_6FDB8B90(pRoomEx, flags, 0);
      const char *note = (sub == 0)
        ? "three_matches_non_pow2_rarity_seed1"
        : (sub == 1)
          ? "three_matches_non_pow2_rarity_seed2"
          : "three_matches_pow2_rarity_8";
      emit_case(fp, 0x6FDB8B90u, 3 + sub, note, args, 3, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 12. 0x6FDB8CD0: DRLGROOMTILE_InitRoofTileData113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      int use_list;
      u32 nRoofs;
      s32 nX, nY;
      u32 dwTileFlags;
      u16 cmpFlags;
    } cases[4] = {
      { "with_list_all_flags_on",  1, 0, 15, 22, 0xB403008Cu, 0x0005u },
      { "no_list_all_flags_off",   0, 1, 10, 18, 0x00000000u, 0x0000u },
      { "with_list_positive_ebx_clears_bit3_then_0x4000000_sets_0x20c", 1, 2, 20, 12, 0x04000080u, 0x0001u },
      { "no_list_cmp_flag_0x04_only", 0, 0, 8, 30, 0x20010004u, 0x0004u },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pTileGrid  = PTR(0x200);
      u32 pRoofsArr  = PTR(0x300);
      u32 ppTileList = PTR(0x500);
      u32 pTileCache = PTR(0x600);

      memset(MEM(0x300), 0x5A, 0x100);

      U32_AT(0x100 + 0x34) = 10; /* nTileXPos */
      U32_AT(0x100 + 0x38) = 12; /* nTileYPos */
      U32_AT(0x100 + 0x54) = pTileGrid;

      U32_AT(0x200 + 0x10) = cases[c].nRoofs;
      U32_AT(0x200 + 0x24) = pRoofsArr;

      U32_AT(0x500) = 0x10000990u;
      U16_AT(0x600 + 0x06) = cases[c].cmpFlags;

      track_dwords(pRoomEx, 0x60);
      track_dwords(pTileGrid, 0x30);
      track_dwords(pRoofsArr, 0x100);
      track_dwords(ppTileList, 4);
      track_dwords(pTileCache, 0x10);

      u32 listArg = cases[c].use_list ? ppTileList : 0;
      u32 args[6] = {
        pRoomEx, (u32)cases[c].nX, cases[c].dwTileFlags,
        listArg, (u32)cases[c].nY, pTileCache
      };
      u32 eax = call_6FDB8CD0(
        pRoomEx, cases[c].nX, cases[c].dwTileFlags,
        listArg, cases[c].nY, pTileCache
      );
      emit_case(fp, 0x6FDB8CD0u, c, cases[c].note, args, 6, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 13. 0x6FDB8DF0: DRLGROOMTILE_InitTileData113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      int has_room_ex;
      s32 nX, nY;
      u32 dwTileFlags;
      u16 cmpFlags;
    } cases[4] = {
      { "with_room_ex_all_flags_on",  1, 18, 24, 0xB40F008Cu, 0x0005u },
      { "null_room_ex_all_flags_off", 0, 18, 24, 0x00000000u, 0x0000u },
      { "with_room_ex_layer2_and_0x4000000", 1, 5, 15, 0x04080080u, 0x0001u },
      { "null_room_ex_layer1_cmp_0x04", 0, 0, 0, 0x20040004u, 0x0004u },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pTileData  = PTR(0x200);
      u32 pTileCache = PTR(0x300);

      memset(MEM(0x200), 0x5A, 0x30);

      U32_AT(0x100 + 0x34) = 10;
      U32_AT(0x100 + 0x38) = 12;
      U16_AT(0x300 + 0x06) = cases[c].cmpFlags;

      track_dwords(pRoomEx, 0x40);
      track_dwords(pTileData, 0x30);
      track_dwords(pTileCache, 0x10);

      u32 roomArg = cases[c].has_room_ex ? pRoomEx : 0;
      u32 args[6] = {
        roomArg, pTileData, (u32)cases[c].nX,
        (u32)cases[c].nY, cases[c].dwTileFlags, pTileCache
      };
      call_6FDB8DF0(
        roomArg, pTileData, cases[c].nX,
        cases[c].nY, cases[c].dwTileFlags, pTileCache
      );
      emit_case(fp, 0x6FDB8DF0u, c, cases[c].note, args, 6, 0);
    }
  }
}

/* =========================================================================
 * EMIT B031 (18 FUNCTIONS)
 * ========================================================================= */
static void emit_b031(FILE *fp) {
  /* -----------------------------------------------------------------------
   * 1. 0x6FD7D600: DRLG_GetRoomExFromCoordinates113c (5 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      const char *note;
      s32 x, y;
    } cases[5] = {
      { "first_room_match", 12, 22 },
      { "x_lt_rx_on_first_matches_second", 5, 22 },
      { "y_lt_ry_on_first_matches_third", 12, 15 },
      { "x_ge_end_or_y_ge_end_matches_fourth", 25, 35 },
      { "no_room_matches_returns_0", 99, 99 },
    };
    for (int c = 0; c < 5; c++) {
      reset_case();
      u32 pDrlg = PTR(0x100);
      u32 r0    = PTR(0x200);
      u32 r1    = PTR(0x300);
      u32 r2    = PTR(0x400);
      u32 r3    = PTR(0x500);

      U32_AT(0x100 + 0x10) = r0;
      /* r0: [10..20) x [20..30) */
      S32_AT(0x200 + 0x34) = 10; S32_AT(0x200 + 0x38) = 20;
      S32_AT(0x200 + 0x3C) = 10; S32_AT(0x200 + 0x40) = 10;
      U32_AT(0x200 + 0x24) = r1;
      /* r1: [0..10) x [20..30) */
      S32_AT(0x300 + 0x34) = 0;  S32_AT(0x300 + 0x38) = 20;
      S32_AT(0x300 + 0x3C) = 10; S32_AT(0x300 + 0x40) = 10;
      U32_AT(0x300 + 0x24) = r2;
      /* r2: [10..30) x [10..20) */
      S32_AT(0x400 + 0x34) = 10; S32_AT(0x400 + 0x38) = 10;
      S32_AT(0x400 + 0x3C) = 20; S32_AT(0x400 + 0x40) = 10;
      U32_AT(0x400 + 0x24) = r3;
      /* r3: [20..30) x [30..40) */
      S32_AT(0x500 + 0x34) = 20; S32_AT(0x500 + 0x38) = 30;
      S32_AT(0x500 + 0x3C) = 10; S32_AT(0x500 + 0x40) = 10;
      U32_AT(0x500 + 0x24) = 0;

      track_dwords(pDrlg, 0x20);
      track_dwords(r0, 0x350);

      u32 args[3] = { pDrlg, (u32)cases[c].x, (u32)cases[c].y };
      u32 eax = call_6FD7D600(pDrlg, cases[c].x, cases[c].y);
      emit_case(fp, 0x6FD7D600u, c, cases[c].note, args, 3, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 2. 0x6FD8B350: DUNGEON_UpdateRoomIdleCounter113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8B350);
    struct {
      const char *note;
      u32 nClients;
      u32 idleCounter;
    } cases[3] = {
      { "clients_present_resets_idle_counter", 2, 17 },
      { "no_clients_increments_from_0", 0, 0 },
      { "no_clients_increments_from_41", 0, 41 },
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x0C) = cases[c].idleCounter;
      U32_AT(0x100 + 0x78) = cases[c].nClients;
      track_dwords(pRoom, 0x80);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8B350u, c, cases[c].note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 3. 0x6FD8B3A0: DUNGEON_VerifyRoomClientsNonNull113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    u32 counts[3] = { 0, 1, 3 };
    const char *notes[3] = {
      "zero_clients_returns_1",
      "one_non_null_client_returns_1",
      "three_non_null_clients_returns_1",
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      u32 pList = PTR(0x200);
      U32_AT(0x100 + 0x48) = pList;
      U32_AT(0x100 + 0x78) = counts[c];
      U32_AT(0x200 + 0x00) = 0x10000A00u;
      U32_AT(0x200 + 0x04) = 0x10000B00u;
      U32_AT(0x200 + 0x08) = 0x10000C00u;
      track_dwords(pRoom, 0x80);
      track_dwords(pList, 0x10);
      u32 args[1] = { pRoom };
      u32 eax = call_6FD8B3A0(pRoom);
      emit_case(fp, 0x6FD8B3A0u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 4. 0x6FD8B3F0: DUNGEON_SetRoomFlag2_113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD8B3F0);
    struct {
      const char *note;
      u32 initFlags;
      u32 bSet;
    } cases[3] = {
      { "set_bit2_from_clear", 0x00000100u, 1 },
      { "clear_bit2_from_set", 0x00000102u, 0 },
      { "set_bit2_with_nonzero_arg", 0x0000FF00u, 7 },
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x34) = cases[c].initFlags;
      track_dwords(pRoom, 0x40);
      u32 args[2] = { pRoom, cases[c].bSet };
      fn(pRoom, cases[c].bSet);
      emit_case(fp, 0x6FD8B3F0u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 5. 0x6FD8B440: DUNGEON_CheckRoomFlag2_113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8B440);
    u32 flags[3] = { 0x00000102u, 0x00000105u, 0xFFFFFFFFu };
    const char *notes[3] = {
      "bit2_set_returns_2",
      "bit2_clear_returns_0",
      "all_bits_set_returns_2",
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x34) = flags[c];
      track_dwords(pRoom, 0x40);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8B440u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 6. 0x6FD8B470: DUNGEON_GetRoomPortalList113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8B470);
    u32 ptrs[3] = { 0, PTR(0x300), PTR(0x450) };
    const char *notes[3] = {
      "null_portal_list",
      "portal_list_ptr_1",
      "portal_list_ptr_2",
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x18) = ptrs[c];
      track_dwords(pRoom, 0x30);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8B470u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 7. 0x6FD8B4A0: DUNGEON_FreeRoomPortalList113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FD8B4A0);
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      u32 pAct  = PTR(0x200);
      u32 n0    = PTR(0x300);
      u32 n1    = PTR(0x320);
      u32 n2    = PTR(0x340);

      U32_AT(0x100 + 0x2C) = pAct;
      U32_AT(0x200 + 0x5C) = 0xCAFE0007u;

      if (c == 0) {
        U32_AT(0x100 + 0x18) = 0;
      } else if (c == 1) {
        U32_AT(0x100 + 0x18) = n0;
        U32_AT(0x300 + 0x08) = 0;
      } else {
        U32_AT(0x100 + 0x18) = n0;
        U32_AT(0x300 + 0x08) = n1;
        U32_AT(0x320 + 0x08) = n2;
        U32_AT(0x340 + 0x08) = 0;
      }

      track_dwords(pRoom, 0x40);
      track_dwords(pAct, 0x60);
      track_dwords(n0, 0x60);

      u32 args[1] = { pRoom };
      fn(pRoom);
      const char *note = (c == 0) ? "empty_list_noop" : (c == 1) ? "single_node_freed" : "three_nodes_freed";
      emit_case(fp, 0x6FD8B4A0u, c, note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 8. 0x6FD8B500: DUNGEON_AddRoomPortalNode113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std3_void_t fn = (fn_std3_void_t)RVA(0x6FD8B500);
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      u32 pAct  = PTR(0x200);
      U32_AT(0x100 + 0x18) = (c == 2) ? PTR(0x300) : 0;
      U32_AT(0x100 + 0x2C) = pAct;
      U32_AT(0x200 + 0x58) = 0;
      U32_AT(0x200 + 0x5C) = 0xCAFE0008u;

      track_dwords(pRoom, 0x40);
      track_dwords(pAct, 0x60);

      u32 roomArg = (c == 0) ? 0 : pRoom;
      u32 args[3] = { roomArg, (u32)(10 + c), (u32)(20 + c) };
      fn(roomArg, (u32)(10 + c), (u32)(20 + c));
      const char *note = (c == 0) ? "null_room_noop" : (c == 1) ? "prepend_to_empty_list" : "prepend_to_existing_head";
      emit_case(fp, 0x6FD8B500u, c, note, args, 3, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. 0x6FD8B550: DUNGEON_GetRoomExFromRoom113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8B550);
    u32 vals[3] = { PTR(0x200), PTR(0x400), 0 };
    const char *notes[3] = { "room_ex_ptr_1", "room_ex_ptr_2", "room_ex_null" };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x10) = vals[c];
      track_dwords(pRoom, 0x20);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8B550u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 10. 0x6FD8B5B0: DUNGEON_GetCollisionGridFromRoomFast113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    u32 vals[3] = { PTR(0x280), PTR(0x500), 0 };
    const char *notes[3] = { "coll_grid_ptr_1", "coll_grid_ptr_2", "coll_grid_null" };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      U32_AT(0x100 + 0x20) = vals[c];
      track_dwords(pRoom, 0x30);
      u32 args[1] = { pRoom };
      u32 eax = call_6FD8B5B0(pRoom);
      emit_case(fp, 0x6FD8B5B0u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 11. 0x6FD8BA20: DUNGEON_GetAdjacentRoomsListFromRoom113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std3_void_t fn = (fn_std3_void_t)RVA(0x6FD8BA20);
    struct {
      const char *note;
      u32 ppNear;
      u32 nNear;
    } cases[3] = {
      { "adj_rooms_4", PTR(0x400), 4 },
      { "adj_rooms_0", 0, 0 },
      { "adj_rooms_9", PTR(0x500), 9 },
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pppOut  = PTR(0x200);
      u32 pnOut   = PTR(0x204);
      U32_AT(0x100 + 0x00) = cases[c].ppNear;
      U32_AT(0x100 + 0x24) = cases[c].nNear;
      U32_AT(0x200) = 0x5A5A5A5Au;
      U32_AT(0x204) = 0x5A5A5A5Au;
      track_dwords(pRoom, 0x30);
      track_dwords(pppOut, 8);
      u32 args[3] = { pRoom, pppOut, pnOut };
      fn(pRoom, pppOut, pnOut);
      emit_case(fp, 0x6FD8BA20u, c, cases[c].note, args, 3, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 12. 0x6FD8BA60: DUNGEON_GetRoomCoordinates113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD8BA60);
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom = PTR(0x100);
      u32 pOut  = PTR(0x200);
      memset(MEM(0x200), 0x5A, 0x20);
      for (int i = 0; i < 8; i++) {
        U32_AT(0x100 + 0x4C + i * 4) = (u32)((c + 1) * 100 + i);
      }
      track_dwords(pRoom, 0x80);
      track_dwords(pOut, 0x20);
      u32 roomArg = (c == 0) ? 0 : pRoom;
      u32 args[2] = { roomArg, pOut };
      fn(roomArg, pOut);
      const char *note = (c == 0) ? "null_room_zeroes_8_dwords" : (c == 1) ? "copies_8_coord_dwords_1" : "copies_8_coord_dwords_2";
      emit_case(fp, 0x6FD8BA60u, c, note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 13. 0x6FD8BD60: DUNGEON_GetLogicalRoomField30_113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8BD60);
    s32 vals[3] = { 0, 7, -42 };
    const char *notes[3] = { "field30_zero", "field30_positive_7", "field30_negative_42" };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom    = PTR(0x100);
      u32 pRoomEx  = PTR(0x200);
      u32 pLogical = PTR(0x300);
      U32_AT(0x100 + 0x10) = pRoomEx;
      U32_AT(0x200 + 0x64) = pLogical;
      S32_AT(0x300 + 0x30) = vals[c];
      track_dwords(pRoom, 0x20);
      track_dwords(pRoomEx, 0x70);
      track_dwords(pLogical, 0x40);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8BD60u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 14. 0x6FD8BE90: DUNGEON_AreAllAdjacentRoomsActive113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8BE90);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pRoomEx = PTR(0x200);
      u32 ppNear  = PTR(0x300);
      u32 adj0    = PTR(0x400);
      u32 adj1    = PTR(0x480);
      u32 adj2    = PTR(0x500);

      U32_AT(0x100 + 0x00) = ppNear;
      U32_AT(0x100 + 0x10) = pRoomEx;
      U32_AT(0x300 + 0x00) = adj0;
      U32_AT(0x300 + 0x04) = adj1;
      U32_AT(0x300 + 0x08) = adj2;

      const char *note = "";
      if (c == 0) {
        U32_AT(0x100 + 0x24) = 2;
        U32_AT(0x200 + 0x2C) = 3;
        note = "count_mismatch_returns_0";
      } else if (c == 1) {
        U32_AT(0x100 + 0x24) = 0;
        U32_AT(0x200 + 0x2C) = 0;
        note = "zero_adjacent_rooms_returns_1";
      } else if (c == 2) {
        U32_AT(0x100 + 0x24) = 3;
        U32_AT(0x200 + 0x2C) = 3;
        U32_AT(0x400 + 0x34) = 1;
        U32_AT(0x480 + 0x34) = 3;
        U32_AT(0x500 + 0x34) = 5;
        note = "three_adjacent_all_active_returns_1";
      } else {
        U32_AT(0x100 + 0x24) = 3;
        U32_AT(0x200 + 0x2C) = 3;
        U32_AT(0x400 + 0x34) = 1;
        U32_AT(0x480 + 0x34) = 2; /* bit 0 clear */
        U32_AT(0x500 + 0x34) = 1;
        note = "second_adjacent_inactive_returns_0";
      }

      track_dwords(pRoom, 0x450);

      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8BE90u, c, note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 15. 0x6FD8BF60: DUNGEON_HasRoomExWaypointFlags113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8BF60);
    u32 flags[3] = { 0x00010000u, 0x00020000u, 0xFFFCFFFFu };
    const char *notes[3] = {
      "flag_0x10000_returns_1",
      "flag_0x20000_returns_1",
      "waypoint_flags_clear_returns_0",
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pRoomEx = PTR(0x200);
      U32_AT(0x100 + 0x10) = pRoomEx;
      U32_AT(0x200 + 0x28) = flags[c];
      track_dwords(pRoom, 0x140);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8BF60u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 16. 0x6FD8BFB0: DUNGEON_GetLevelIdIfNotHidden113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8BFB0);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pRoomEx = PTR(0x200);
      u32 pLevel  = PTR(0x300);

      U32_AT(0x100 + 0x10)  = pRoomEx;
      U32_AT(0x200 + 0x28)  = (c == 1) ? 0x00800000u : 0x007FFFFFu;
      U32_AT(0x200 + 0x58)  = pLevel;
      U32_AT(0x300 + 0x1D0) = (c == 3) ? 109 : 42;

      track_dwords(pRoom, 0x400);

      u32 roomArg = (c == 0) ? 0 : pRoom;
      u32 args[1] = { roomArg };
      u32 eax = fn(roomArg);
      const char *note = (c == 0)
        ? "null_room_returns_0"
        : (c == 1)
          ? "hidden_flag_0x800000_returns_0"
          : (c == 2)
            ? "visible_returns_level_42"
            : "visible_returns_level_109";
      emit_case(fp, 0x6FD8BFB0u, c, note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 17. 0x6FD8C020: DUNGEON_AcquireRoomExDT1Mask113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8C020);
    struct {
      const char *note;
      u32 flags;
      u32 mask;
    } cases[3] = {
      { "flag_0x40000_set_returns_mask_unmodified_flags", 0x00040000u, 0x13572468u },
      { "flag_0x4000000_already_set_returns_0", 0x04000000u, 0x13572468u },
      { "neither_set_marks_0x4000000_and_returns_mask", 0x00000001u, 0xABCD1234u },
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pRoomEx = PTR(0x200);
      U32_AT(0x100 + 0x10) = pRoomEx;
      U32_AT(0x200 + 0x28) = cases[c].flags;
      U32_AT(0x200 + 0x5C) = cases[c].mask;
      track_dwords(pRoom, 0x170);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8C020u, c, cases[c].note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 18. 0x6FD8C330: DUNGEON_CheckPresetRoomFlag80_113c (3 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8C330);
    struct {
      const char *note;
      s32 nType;
      u32 fFlags;
    } cases[3] = {
      { "type_not_1_returns_0", 2, 0x000000FFu },
      { "type_1_flag_0x80_set_returns_0x80", 1, 0x00000180u },
      { "type_1_flag_0x80_clear_returns_0", 1, 0x0000017Fu },
    };
    for (int c = 0; c < 3; c++) {
      reset_case();
      u32 pRoom   = PTR(0x100);
      u32 pRoomEx = PTR(0x200);
      u32 pPreset = PTR(0x300);
      U32_AT(0x100 + 0x10) = pRoomEx;
      U32_AT(0x200 + 0x20) = pPreset;
      S32_AT(0x200 + 0x48) = cases[c].nType;
      U32_AT(0x300 + 0x54) = cases[c].fFlags;
      track_dwords(pRoom, 0x260);
      u32 args[1] = { pRoom };
      u32 eax = fn(pRoom);
      emit_case(fp, 0x6FD8C330u, c, cases[c].note, args, 1, eax);
    }
  }
}

int main(int argc, char **argv) {
  const char *b028_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/b028-vectors.ndjson";
  const char *b031_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/b031-vectors.ndjson";

  HMODULE hMod = LoadLibraryA("D2Common.dll");
  if (!hMod) {
    fprintf(stderr, "LoadLibraryA(D2Common.dll) failed: %lu\n", GetLastError());
    return 1;
  }
  g_base = (uintptr_t)hMod;

  g_arena = (u8 *)VirtualAlloc(
    (void *)(uintptr_t)ARENA_ADDR,
    ARENA_SIZE,
    MEM_COMMIT | MEM_RESERVE,
    PAGE_EXECUTE_READWRITE
  );
  if (!g_arena) {
    fprintf(stderr, "VirtualAlloc(ARENA_ADDR) failed: %lu\n", GetLastError());
    return 2;
  }

  g_heap = (u8 *)VirtualAlloc(
    (void *)(uintptr_t)HEAP_ADDR,
    HEAP_SIZE,
    MEM_COMMIT | MEM_RESERVE,
    PAGE_EXECUTE_READWRITE
  );
  if (!g_heap) {
    fprintf(stderr, "VirtualAlloc(HEAP_ADDR) failed: %lu\n", GetLastError());
    return 3;
  }

  DWORD oldProt = 0;
  VirtualProtect((void *)RVA(0x6FDD90AC), 0x30, PAGE_READWRITE, &oldProt);
  *(uintptr_t *)RVA(0x6FDD90D0) = (uintptr_t)stub_fog_10045;
  *(uintptr_t *)RVA(0x6FDD90CC) = (uintptr_t)stub_fog_10046;
  *(uintptr_t *)RVA(0x6FDD90AC) = (uintptr_t)stub_fog_10047;

  DWORD oldDataProt = 0;
  VirtualProtect((void *)RVA(0x6FDE9E1C), 0x8000, PAGE_READWRITE, &oldDataProt);

  FILE *fp28 = fopen(b028_out, "wb");
  if (!fp28) {
    fprintf(stderr, "Cannot open %s\n", b028_out);
    return 4;
  }
  emit_b028(fp28);
  fclose(fp28);

  FILE *fp31 = fopen(b031_out, "wb");
  if (!fp31) {
    fprintf(stderr, "Cannot open %s\n", b031_out);
    return 5;
  }
  emit_b031(fp31);
  fclose(fp31);

  return 0;
}
